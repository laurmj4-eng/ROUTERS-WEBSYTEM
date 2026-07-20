#!/usr/bin/env python3
"""Direct approach: POST to login.cgi via requests, bypassing client-side JS."""
import requests, urllib3, base64, time

urllib3.disable_warnings()

ROUTER = "https://192.168.1.1"

s = requests.Session()
s.verify = False

# First get a CSRF token
print("1. Getting CSRF token...")
try:
    r = s.get(ROUTER + "/admin.html", timeout=10)
    print("   admin.html status:", r.status_code, "size:", len(r.text))
except Exception as e:
    print("   Error:", e)

# Get CSRF token
try:
    r = s.post(ROUTER + "/asp/GetRandCount.asp", timeout=10)
    token = r.text.strip()
    print("   CSRF token:", token[:50])
except Exception as e:
    print("   Error getting token:", e)
    token = ""

# Check lockout state via CheckPwdNotLogin.asp
print("\n2. CheckPwdNotLogin.asp tests...")
for user, pwd in [
    ("adminpldt", "AC2DIU7QW3ERTY6UPAS4DFG"),
    ("admin", "AC2DIU7QW3ERTY6UPAS4DFG"),
    ("admin", "wrong"),
]:
    try:
        r = s.post(ROUTER + "/asp/CheckPwdNotLogin.asp",
                    data={"UserNameInfo": user, "NormalPwdInfo": pwd},
                    timeout=10)
        print("   " + user + ":" + pwd[:10] + " -> " + repr(r.text.strip()) + " status:" + str(r.status_code))
    except Exception as e:
        print("   " + user + " -> Error:", e)

# Try login.cgi directly
print("\n3. Direct login.cgi POST...")
pwd_b64 = base64.b64encode(b"AC2DIU7QW3ERTY6UPAS4DFG").decode()
for user, pwd_b64_val, label in [
    ("adminpldt", pwd_b64, "adminpldt b64"),
    ("admin", base64.b64encode(b"AC2DIU7QW3ERTY6UPAS4DFG").decode(), "admin b64"),
    ("adminpldt", "AC2DIU7QW3ERTY6UPAS4DFG", "adminpldt plain"),
]:
    try:
        # Set cookie first
        s.cookies.set("Cookie", "body:Language:english:id=-1", domain="192.168.1.1", path="/")
        r = s.post(ROUTER + "/login.cgi",
                   data={
                       "UserName": user,
                       "PassWord": pwd_b64_val,
                       "Language": "english",
                       "x.X_HW_Token": token,
                   },
                   allow_redirects=True,
                   timeout=10)
        print("   " + label + " -> status:" + str(r.status_code) +
              " url:" + r.url +
              " size:" + str(len(r.text)) +
              " has_login:" + str("txt_Username" in r.text))
        if "txt_Username" not in r.text:
            print("   SUCCESS! Response snippet:", r.text[:300])
    except Exception as e:
        print("   " + label + " -> Error:", e)

# Also try with the cookie set differently
print("\n4. Try with explicit cookie header...")
import http.cookiejar
s2 = requests.Session()
s2.verify = False
s2.headers.update({
    "Cookie": "Cookie=body:Language:english:id=-1"
})
r = s2.post(ROUTER + "/login.cgi",
            data={
                "UserName": "adminpldt",
                "PassWord": base64.b64encode(b"AC2DIU7QW3ERTY6UPAS4DFG").decode(),
                "Language": "english",
                "x.X_HW_Token": token,
            },
            allow_redirects=True,
            timeout=10)
print("   status:", r.status_code, "url:", r.url, "has_login:", "txt_Username" in r.text)

print("\n5. Check what pages accept session cookies...")
# Check if login created any session
print("   Cookies:", dict(s.cookies))
print("   s2 Cookies:", dict(s2.cookies))
