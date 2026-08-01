import requests
import re

TARGET = "http://10.0.0.1"
ADMIN = f"{TARGET}/admin/index"

# Get admin forgot view
print("=== Admin Forgot View ===")
resp = requests.get(f"{ADMIN}?action=forgot.js", timeout=10)
text = resp.text
print(f"Length: {len(text)} bytes")

# Extract forms
forms = re.findall(r"<form[^>]*>.*?</form>", text, re.DOTALL | re.I)
print(f"Forms: {len(forms)}")
for i, form in enumerate(forms):
    action = re.search(r'action=["\']([^"\']*)["\']', form)
    method = re.search(r'method=["\']([^"\']*)["\']', form)
    print(f"Form {i}: action={action.group(1) if action else '?'}, method={method.group(1) if method else '?'}")
    inputs = re.findall(r"<input[^>]*>", form, re.I)
    for inp in inputs:
        n = re.search(r'name=["\']([^"\']*)["\']', inp)
        t = re.search(r'type=["\']([^"\']*)["\']', inp)
        i_name = re.search(r'id=["\']([^"\']*)["\']', inp)
        print(f"  Input: name={n.group(1) if n else '?'}, id={i_name.group(1) if i_name else '?'}, type={t.group(1) if t else '?'}")

# Get scripts
scripts = re.findall(r"<script[^>]*src=[\"']([^\"']*)[\"'][^>]*>", text, re.I)
print(f"\nScripts: {len(scripts)}")
for s in scripts:
    if "login" in s or "forgot" in s or "main" in s:
        print(f"  {s}")

# Fuzz action values
print("\n=== Fuzzing action values ===")
actions = ["status", "status.js", "system", "system.js", "info", "info.js", 
           "health", "health.js", "api", "api.js", "ping", "ping.js",
           "version", "version.js", "test", "test.js", "debug", "debug.js",
           "config", "config.js", "settings", "settings.js", "help", "help.js",
           "login", "login.js", "logout", "logout.js",
           "forgot", "forgot.js", "captcha", "captcha.js",
           "dashboard", "dashboard.js", "profile", "profile.js",
           "user", "user.js", "users", "users.js",
           "getstatus", "getconfig", "getinfo", "getdata",
           "export", "import", "backup", "restore",
           "phpinfo", "phpinfo.js", "_", "_test", "undefined"]

for action in actions:
    try:
        resp = requests.get(f"{ADMIN}?action={action}", timeout=5)
        # Interesting responses: non-standard sizes (not 5353 for login, not 6258 for forgot)
        length = len(resp.text)
        if length not in [5353, 6258, 0, 133]:
            print(f"  action={action}: {length}b (non-standard!)")
            if length > 0:
                print(f"    First 100 chars: {resp.text[:100]}")
        elif length == 0:
            # Empty response might be a redirect
            print(f"  action={action}: {length}b (empty - redirect?)")
            # Check location header
            loc = resp.headers.get("Location", "")
            if loc:
                print(f"    Location: {loc}")
    except Exception as e:
        pass

# Also try POST to forgot with the admin endpoint
print("\n=== Admin Forgot Form Submit ===")
resp = requests.post(f"{ADMIN}?execute=1&exec=forgot", 
                    data={"license": "0", "sdcard": "1234567890",
                          "username": "admin", "email": "admin@test.com"},
                    timeout=10)
print(f"  {len(resp.text)}b: {resp.text[:150]}")

# Try admin forgot with license=0
resp = requests.post(f"{ADMIN}?action=forgot.js&execute=1&exec=forgot",
                    data={"license": "0", "sdcard": "1234567890"},
                    timeout=10)
print(f"  forgot+execute: {len(resp.text)}b: {resp.text[:150]}")
