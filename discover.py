import socket
import struct
import time

target = "10.0.0.1"

# Get TCP timestamp from SYN-ACK to estimate uptime
print("=== TCP Timestamp (uptime estimation) ===")
try:
    # Create raw socket for TCP
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    s.connect((target, 80))
    
    # Get socket info
    info = s.getsockname()
    print(f"Connected from {info}")
    
    # Try to get TCP info via getsockopt
    # On Windows, TCP_INFO might not be available
    try:
        # Windows doesn't support TCP_INFO easily
        pass
    except:
        pass
    
    s.close()
except Exception as e:
    print(f"TCP connect error: {e}")

# Alternative: use scapy to get TCP timestamp
print("\n=== Scapy TCP Timestamp ===")
try:
    import scapy.all as scapy
    scapy.conf.use_pcap = True
    
    # SYN packet with timestamp option
    ip = scapy.IP(dst=target)
    tcp = scapy.TCP(dport=80, flags="S", options=[("Timestamp", (int(time.time()), 0))])
    syn = ip/tcp
    
    # Send and receive
    ans = scapy.sr1(syn, timeout=5, verbose=0)
    
    if ans and ans.haslayer(scapy.TCP):
        # Check for Timestamp option in response
        opts = ans.getlayer(scapy.TCP).options
        print(f"TCP options: {opts}")
        for opt_name, opt_val in opts:
            if opt_name == "Timestamp":
                ts_val, ts_echo = opt_val
                print(f"Timestamp value (uptime): {ts_val}")
                print(f"Timestamp echo (our TS): {ts_echo}")
                print(f"Estimated uptime: {ts_val / 1000:.1f} seconds = {ts_val/1000/3600:.1f} hours")
                # TSecr is typically in ms, divided by 1000 gives seconds
            
        # Also get the window size for OS fingerprinting
        print(f"Window: {ans.getlayer(scapy.TCP).window}")
    
    # Also try HTTP request to get Server header
    if ans and ans.haslayer(scapy.Raw):
        pass
    
except Exception as e:
    import traceback
    print(f"Error: {e}")
    traceback.print_exc()

# DNS timing - measure response time
print("\n=== DNS Response Time ===")
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(5)
    
    # Query for a domain likely NOT cached
    import random
    domain = f"test-{random.randint(1,99999)}.com"
    query_id = random.randint(0, 65535)
    
    header = struct.pack(">HHHHHH", query_id, 0x0100, 1, 0, 0, 0)
    qname = b""
    for part in domain.split("."):
        qname += bytes([len(part)]) + part.encode()
    qname += b"\x00"
    question = qname + struct.pack(">HH", 1, 1)
    query = header + question
    
    start = time.time()
    s.sendto(query, (target, 53))
    data, _ = s.recvfrom(2048)
    elapsed = time.time() - start
    print(f"Uncached query: {elapsed:.3f}s")
    
    # Query for cached domain
    domain2 = "lpb.lpbpisowifi.com"
    qname2 = b""
    for part in domain2.split("."):
        qname2 += bytes([len(part)]) + part.encode()
    qname2 += b"\x00"
    question2 = qname2 + struct.pack(">HH", 1, 1)
    query2 = struct.pack(">HHHHHH", query_id+1, 0x0100, 1, 0, 0, 0) + question2
    
    start = time.time()
    s.sendto(query2, (target, 53))
    data2, _ = s.recvfrom(2048)
    elapsed2 = time.time() - start
    print(f"Cached query: {elapsed2:.3f}s")
    
    s.close()
except Exception as e:
    print(f"DNS error: {e}")

# Try to identify the interface the device is on
print("\n=== Network Discovery ===")
try:
    # Scan for other devices on the network
    for last_octet in [1, 2, 254]:
        ip = f"10.0.0.{last_octet}"
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        try:
            s.connect((ip, 80))
            print(f"{ip}:80 - OPEN")
        except:
            print(f"{ip}:80 - closed/filtered")
        s.close()
except:
    pass
