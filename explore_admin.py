import requests
import re
import time

TARGET = "http://10.0.0.1"
ADMIN = f"{TARGET}/admin/index"

# Check the admin forgot page
print("=== Admin Forgot Page ===")
resp = requests.get(f"{ADMIN}?action=forgot.js", timeout=10)
print(f"Status: {resp.status_code}")
print(f"Length: {len(resp.text)} bytes")
print(f"Headers: Set-Cookie={resp.headers.get('Set-Cookie', 'none')[:50]}")
# Check if it's HTML or JSON
if resp.text.startswith("<"):
    print(f"HTML ({len(resp.text)}b): {resp.text[:500]}")
elif resp.text.startswith("{"):
    print(f"JSON: {resp.text[:500]}")
else:
    print(f"Raw: {resp.text[:500]}")

# Check the captcha endpoint
print()
print("=== Captcha ===")
resp2 = requests.get(f"{ADMIN}?action=captcha.js", timeout=10)
print(f"Status: {resp2.status_code}")
print(f"Content-Type: {resp2.headers.get('Content-Type')}")
print(f"Length: {len(resp2.content)} bytes")
print(f"Headers: {dict(resp2.headers)}")
if len(resp2.content) < 200:
    print(f"Content: {resp2.text}")

# Try admin login directly via execute.js
print()
print("=== Admin Login via execute.js ===")
s = requests.Session()

# Try the login with exec=login (same as portal)
resp3 = s.post(f"{TARGET}/execute.js", params={"exec": "login"}, 
              data={"username": "admin", "password": "test", "captcha": "1234"}, timeout=10)
print(f"exec=login response: [{len(resp3.text)}b] {resp3.text[:100]}")

# Check if we got admin privileges after login
resp4 = s.get(f"{ADMIN}?action=dashboard", timeout=10)
print(f"Dashboard after login: [{len(resp4.text)}b] {resp4.text[:80]}")

# Try the forgot via admin.php
print()
print("=== Admin forgot flow ===")
for path in ["/admin/index.php?action=forgot.js", 
             "/admin/index?action=forgot.js",
             "/admin/forgot", "/admin/forgot.js"]:
    try:
        resp = requests.get(f"{TARGET}{path}", timeout=10)
        print(f"{path}: [{len(resp.text)}b] {resp.text[:100]}")
    except Exception as e:
        print(f"{path}: error {e}")

# Try to find admin login JS file
print()
print("=== Admin JS ===")
for js_path in ["/admin/assets/js/login.js", "/admin/assets/js/main.js",
                "/admin/assets/js/script.js", "/assets/js/login.js",
                "/assets/files/login.js", "/admin/js/login.js"]:
    try:
        resp = requests.get(f"{TARGET}{js_path}", timeout=5)
        if len(resp.text) > 10:
            print(f"{js_path}: [{len(resp.text)}b] {resp.text[:200]}")
    except:
        pass
