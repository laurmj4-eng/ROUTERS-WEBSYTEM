import scapy.all as scapy
import threading
import time
import socket
import struct
import sys

TARGET = "10.0.0.1"
OUR_IP = "10.0.20.233"
scapy.conf.use_pcap = True

found_port = [None]
scan_done = threading.Event()
icmp_events = {}
lock = threading.Lock()

def icmp_sniffer(duration=300):
    """Sniff for ICMP Port Unreachable from target"""
    def process_pkt(pkt):
        if pkt.haslayer(scapy.ICMP):
            icmp = pkt.getlayer(scapy.ICMP)
            # Type 3 = Destination Unreachable, Code 3 = Port Unreachable
            if icmp.type == 3 and icmp.code == 3:
                # The ICMP payload contains the original IP header + 8 bytes of UDP
                if pkt.haslayer(scapy.Raw):
                    payload = pkt.getlayer(scapy.Raw).load
                    if len(payload) >= 8:
                        # Original destination port is in the UDP header (bytes 2-3 of UDP)
                        orig_dport = (payload[2] << 8) | payload[3]
                        with lock:
                            icmp_events[orig_dport] = time.time()
    
    try:
        scapy.sniff(prn=process_pkt, store=0, timeout=duration)
    except:
        pass

def scan_port_range(start_port, end_port, icmp_sniff_timeout=0.05):
    """Scan UDP ports and check for ICMP responses"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    
    for port in range(start_port, end_port + 1):
        if scan_done.is_set():
            break
        
        # Send empty UDP packet to the port
        try:
            s.sendto(b"", (TARGET, port))
        except:
            pass
        
        if port % 10 == 0:
            time.sleep(0.05)  # Respect ICMP rate limit
    
    s.close()

def check_results(total_ports):
    """Find ports that did NOT receive ICMP (potentially open)"""
    # Scan range completed, check which ports are missing ICMP responses
    # We need to check the target port specifically
    missing_ports = []
    for port in range(1025, total_ports + 1025):
        if port not in icmp_events:
            missing_ports.append(port)
    return missing_ports

print("=== ICMP-based Source Port Detection ===")
print("Target:", TARGET)
print("Our IP:", OUR_IP)

# Start ICMP sniffer in background
sniffer = threading.Thread(target=icmp_sniffer, args=(300,), daemon=True)
sniffer.start()
time.sleep(0.5)

# Scan ports in batches
batch_size = 100
start_port = 1025
end_port = 65535
total = end_port - start_port + 1

for batch_start in range(start_port, end_port + 1, batch_size):
    if scan_done.is_set():
        break
    
    batch_end = min(batch_start + batch_size - 1, end_port)
    print(f"\r[*] Scanning {batch_start}-{batch_end} ({batch_start-start_port}/{total})", end="")
    
    scan_port_range(batch_start, batch_end)
    
    # Check for ICMP responses after each batch
    missing = []
    for p in range(batch_start, batch_end + 1):
        if p not in icmp_events:
            missing.append(p)
    
    if missing:
        for p in missing:
            print(f"\n[?] Port {p}: No ICMP response (possibly open!)")
            found_port[0] = p
            # This is an over-approximation (might be rate-limited)
            # But if only 1-2 ports are missing, they're strong candidates
    
    time.sleep(0.1)  # Let ICMP responses arrive

# Final analysis
total_icmp = len(icmp_events)
print(f"\n\nTotal ICMP responses: {total_icmp}")
print(f"Total ports scanned: {total}")
print(f"Ports with no ICMP: {total - total_icmp}")

# Show ports with no ICMP
missing = []
for p in range(start_port, end_port + 1):
    if p not in icmp_events:
        missing.append(p)

if len(missing) <= 10:
    print(f"\n[+] Candidate open ports: {missing}")
    for p in missing:
        print(f"\n[*] Verifying port {p}...")
        # Try to send a UDP packet and sniff for any reaction
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)
        try:
            s.sendto(b"\x00" * 100, (TARGET, p))
            # If no ICMP back and no response, port might be open but our packet was ignored
        except:
            pass
        s.close()
else:
    print(f"\n[-] {len(missing)} ports have no ICMP (too many - rate limiting)")
    print("[-] Try running with longer delays")
