import requests

TARGET = "http://10.0.0.1"

# Get nginx version
resp = requests.get(TARGET, timeout=10)
print(f"Nginx: {resp.headers.get('Server', '?')}")

# Check for PHP version in headers
for h, v in resp.headers.items():
    print(f"  {h}: {v}")

# Check for common exploit paths
paths = ["/.git/config", "/.env", "/admin/.env", "/backup.sql", "/dump.sql",
         "/phpinfo.php", "/info.php", "/test.php", "/debug.php",
         "/server-status", "/nginx-status", "/status",
         "/admin/backup.sql", "/admin/dump.sql",
         "/assets/", "/files/", "/uploads/",
         "/config.php", "/admin/config.php",
         "/admin/assets/", "/admin/files/",
         "/execute.php", "/admin/execute.php"]

for path in paths:
    try:
        r = requests.get(f"{TARGET}{path}", timeout=5, allow_redirects=False)
        if r.status_code not in [302, 404, 403]:
            print(f"  {path}: {r.status_code} ({len(r.text)}b) {r.text[:100] if len(r.text) < 200 else r.text[:50]+'...'}")
    except:
        pass
