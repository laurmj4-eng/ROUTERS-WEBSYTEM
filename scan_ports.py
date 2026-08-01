import socket
import time
import struct

target = "10.0.0.1"

print("=== SNMP Scan (UDP 161) ===")
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.settimeout(3)
try:
    # Send a basic SNMP GET request
    s.sendto(b"0", (target, 161))
    data, addr = s.recvfrom(1024)
    print(f"  Port 161 OPEN! Response from {addr[0]}:{addr[1]} len={len(data)}")
except socket.timeout:
    print("  UDP 161: No response (likely closed/filtered)")
except Exception as e:
    print(f"  UDP 161 error: {e}")
s.close()

print()
print("=== UPnP Scan (UDP 1900) ===")
msg = b"M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: ssdp:all\r\n\r\n"
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
sock.settimeout(3)
sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)
try:
    sock.sendto(msg, ("239.255.255.250", 1900))
    start = time.time()
    found_target = False
    while time.time() - start < 3:
        try:
            data, addr = sock.recvfrom(2048)
            if addr[0] == target:
                found_target = True
                print(f"  UPnP reply from target {target}!")
                print(f"  {data[:200]}")
            elif addr[0].startswith("10.0."):
                print(f"  UPnP device: {addr[0]} - port {addr[1]}")
        except socket.timeout:
            break
    if not found_target:
        print("  No UPnP response from target")
except Exception as e:
    print(f"  UPnP error: {e}")
sock.close()

print()
print("=== Alt HTTP ports ===")
for port in [8080, 8888, 9090, 8443, 7547, 5555, 3000, 5000, 8000, 81, 88, 90, 443, 22, 23]:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(1)
        result = s.connect_ex((target, port))
        if result == 0:
            print(f"  TCP {port}: OPEN")
        s.close()
    except:
        pass
