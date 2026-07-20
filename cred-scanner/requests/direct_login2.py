#!/usr/bin/env python3
"""Direct login.cgi POST with full response inspection and protected page access."""
import requests, urllib3, base64

urllib3.disable_warnings()
ROUTER = "https://192.168.1.1"

s = requests.Session()
s.verify = False

# Get CSRF token
r = s.get(ROUTER + "/admin.html", timeout=10)
# Get token from the HTML
import re
token_match = re.search(r"cnt\s*=\s*['\"]([^'\"]+)", r.text)
token = token_match.group(1) if token_match else ""
print("1. CSRF token:", token[:50] if token else "not found in HTML")

# Actually get it from the endpoint using raw bytes
r2 = s.get(ROUTER + "/asp/GetRandCount.asp", timeout=10)
raw = r2.content
print("   Raw token bytes:", raw[:50])
try:
    token = raw.decode("utf-8-sig").strip()
except:
    token = raw.decode("latin-1").strip()
print("   Token:", token[:50])

# Set up cookie manually
s.cookies.set("Cookie", "body:Language:english:id=-1")

# Try login
print("\n2. Direct login.cgi POST as adminpldt...")
pwd_b64 = base64.b64encode(b"AC2DIU7QW3ERTY6UPAS4DFG").decode()
print("   Password b64:", pwd_b64)

r = s.post(ROUTER + "/login.cgi",
           data={
               "UserName": "adminpldt",
               "PassWord": pwd_b64,
               "Language": "english",
               "x.X_HW_Token": token,
           },
           allow_redirects=True,
           timeout=10)

print("   Status:", r.status_code)
print("   Final URL:", r.url)
print("   Response headers:", dict(r.headers))
print("   Set-Cookie:", r.headers.get("Set-Cookie", "none"))
print("   Cookies after:", dict(s.cookies))
print("   Response body (full, 2000 chars):")
print(r.text[:2000])

# Now try to access protected pages with this session
print("\n3. Accessing protected pages with session...")
for pg in ["/html/amp/wlanbasic/WlanBasic.asp?2G",
           "/html/ssmp/info/basic/system_info.asp",
           "/html/ssmp/accout/UserInfo.asp"]:
    try:
        r = s.get(ROUTER + pg, timeout=10)
        has_login = "txt_Username" in r.text
        print("   " + pg + " -> status:" + str(r.status_code) +
              " login:" + str(has_login) + " size:" + str(len(r.text)))
        if not has_login and len(r.text) > 1000:
            # Extract some visible content
            from html.parser import HTMLParser
            class TextExtractor(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.text = []
                    self.in_script = False
                def handle_starttag(self, tag, attrs):
                    if tag in ('script', 'style'):
                        self.in_script = True
                def handle_endtag(self, tag):
                    if tag in ('script', 'style'):
                        self.in_script = False
                def handle_data(self, data):
                    if not self.in_script:
                        t = data.strip()
                        if t:
                            self.text.append(t)
            te = TextExtractor()
            te.feed(r.text[:10000])
            content = " ".join(te.text[:20])
            print("   Content preview:", content[:200])
    except Exception as e:
        print("   " + pg + " -> Error:", e)
