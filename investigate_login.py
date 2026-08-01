import requests
import threading

TARGET = "http://10.0.0.1"

# Investigate login.html timeout
print("=== login.html investigation ===")

try:
    resp = requests.get(f"{TARGET}/login.html", timeout=15)
    print(f"Status: {resp.status_code}")
    print(f"Length: {len(resp.text)} bytes")
    print(f"Headers: {dict(resp.headers)}")
    print(f"Content: {resp.text[:200]}")
except requests.exceptions.Timeout:
    print("Timeout after 15s - still waiting!")
    
    # Try with shorter timeout to see partial response
    try:
        resp = requests.get(f"{TARGET}/login.html", timeout=1, stream=True)
        # Read partial
        chunk = resp.raw.read(500, decode_content=True)
        print(f"Partial ({len(chunk)}b): {chunk[:200]}")
    except:
        pass
except Exception as e:
    print(f"Error: {e}")

# Compare with other HTML paths
print("\n=== HTML path comparison ===")
for html_path in ["/index.html", "/login.html", "/admin.html", "/portal.html",
                   "/dashboard.html", "/config.html", "/settings.html"]:
    try:
        resp = requests.get(f"{TARGET}{html_path}", timeout=5)
        print(f"  {html_path}: {resp.status_code} {len(resp.text)}b {resp.text[:60]}")
    except requests.exceptions.Timeout:
        print(f"  {html_path}: TIMEOUT")
    except Exception as e:
        print(f"  {html_path}: error {e}")

# Check if login.html or login.php has a different handler
print("\n=== Login method comparison ===")
for method in ["GET", "POST"]:
    try:
        resp = requests.request(method, f"{TARGET}/login.html", timeout=5)
        print(f"  {method} login.html: {resp.status_code} {len(resp.text)}b {resp.text[:60]}")
    except requests.exceptions.Timeout:
        print(f"  {method} login.html: TIMEOUT")
    except Exception as e:
        print(f"  {method} login.html: {e}")

# Check if login.html with params has different behavior
print("\n=== login.html with params ===")
for params in [{"exec": "login"}, {"action": "login"}, {"execute": "1", "exec": "login"}]:
    try:
        resp = requests.get(f"{TARGET}/login.html", params=params, timeout=5)
        print(f"  login.html?{params}: {resp.status_code} {len(resp.text)}b {resp.text[:60]}")
    except requests.exceptions.Timeout:
        print(f"  login.html?{params}: TIMEOUT")
    except Exception as e:
        print(f"  login.html?{params}: {e}")
