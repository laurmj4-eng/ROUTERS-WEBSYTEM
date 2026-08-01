from PIL import Image
import io
import requests
import hashlib

TARGET = "http://10.0.0.1"
CAPTCHA_URL = f"{TARGET}/admin/index?action=captcha.js"

# Get multiple captchas and compare
for i in range(5):
    s = requests.Session()
    resp = s.get(CAPTCHA_URL)
    img = Image.open(io.BytesIO(resp.content))
    
    # Get pixel hash
    pixel_data = resp.content
    h = hashlib.md5(pixel_data).hexdigest()[:8]
    
    # Get session ID
    sid = dict(s.cookies).get("PHPSESSID", "?")
    
    # Save each captcha
    img.save(f"captcha_{i}.png")
    
    print(f"Captcha {i}: session={sid[:20]}... md5={h} size={img.size}")
    
    # Simple OCR attempt - find the "empty space" pattern
    # Check if captcha is always the same
