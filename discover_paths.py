import requests

TARGET = "http://10.0.0.1"

# Test which paths return something different from 133b "Please Wait"
test_paths = [
    "/",
    "/admin/",
    "/admin/index.php",
    "/admin/index.html",
    "/admin/index",
    "/execute.js",
    "/execute.php",
    "/index.php",
    "/index.html",
    "/portal.html",
    "/login.html",
    "/login.php",
    "/forgot.html",
    "/forgot.php",
    "/admin/login",
    "/admin/login.html",
    "/admin/forgot",
    "/admin/forgot.html",
    "/admin/captcha",
    "/assets/",
    "/assets/files/",
]

for path in test_paths:
    try:
        s = requests.Session()
        resp = s.get(f"{TARGET}{path}", timeout=5, allow_redirects=False)
        length = len(resp.text)
        snippet = resp.text[:60].replace("\n", " ").replace("\r", "")
        status = resp.status_code
        redirect = resp.headers.get("Location", "")
        print(f"  {path}: {status} {length}b - {snippet}")
        if redirect:
            print(f"    -> Location: {redirect}")
    except Exception as e:
        print(f"  {path}: error {e}")
