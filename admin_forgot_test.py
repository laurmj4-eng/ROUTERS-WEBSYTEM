import requests
import time

TARGET = "http://10.0.0.1"
ADMIN = f"{TARGET}/admin/index"

# Test admin forgot without captcha
print("=== Admin Forgot Test ===")

# Test 1: No captcha parameter
s = requests.Session()
resp = s.post(f"{ADMIN}?execute=1&exec=forgot",
             data={"license": "0", "sdcard": "1234567890"},
             timeout=30)
print(f"Test 1 (no captcha): [{len(resp.text)}b] '{resp.text.strip()}'")

# Test 2: With empty captcha
resp2 = s.post(f"{ADMIN}?execute=1&exec=forgot",
              data={"license": "0", "sdcard": "1234567890", "captcha": ""},
              timeout=30)
print(f"Test 2 (empty captcha): [{len(resp2.text)}b] '{resp2.text.strip()}'")

# Test 3: With wrong captcha
resp3 = s.post(f"{ADMIN}?execute=1&exec=forgot",
              data={"license": "0", "sdcard": "1234567890", "captcha": "wrong"},
              timeout=30)
print(f"Test 3 (wrong captcha): [{len(resp3.text)}b] '{resp3.text.strip()}'")

# Test 4: With valid captcha (need to solve it)
s4 = requests.Session()
# Get captcha
s4.get(f"{ADMIN}?action=captcha.js")
# For now, try with captcha value '0' 
resp4 = s4.post(f"{ADMIN}?execute=1&exec=forgot",
               data={"license": "0", "sdcard": "1234567890", "captcha": "0"},
               timeout=30)
print(f"Test 4 (captcha=0): [{len(resp4.text)}b] '{resp4.text.strip()}'")

# Now try with different license values
print("\n=== License variations ===")
for lic in ["0", "1", "false", "true", "null", "admin", "test", " ", ""]:
    s = requests.Session()
    resp = s.post(f"{ADMIN}?execute=1&exec=forgot",
                 data={"license": lic, "sdcard": "1234567890"},
                 timeout=10)
    result = resp.text.strip()
    print(f"  license='{lic}': [{len(resp.text)}b] '{result[:60]}'")

# Check response time
print("\n=== Response timing ===")
start = time.time()
s5 = requests.Session()
resp5 = s5.post(f"{ADMIN}?execute=1&exec=forgot",
               data={"license": "0", "sdcard": "1234567890"},
               timeout=60)
elapsed = time.time() - start
print(f"Response time: {elapsed:.2f}s")
print(f"Response: '{resp5.text.strip()}'")
