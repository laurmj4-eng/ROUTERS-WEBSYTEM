import requests
import re

TARGET = "http://10.0.0.1"

resp = requests.get(f"{TARGET}/admin/index.php", timeout=10)

with open("admin_login.html", "w", encoding="utf-8") as f:
    f.write(resp.text)

print(f"Status: {resp.status_code}")
print(f"Length: {len(resp.text)} bytes")
print(f"Headers: {dict(resp.headers)}")
print()

# Extract forms
forms = re.findall(r"<form[^>]*>.*?</form>", resp.text, re.DOTALL | re.I)
print(f"Forms found: {len(forms)}")
for i, form in enumerate(forms):
    # Get form action and method
    action = re.search(r'action=["\']([^"\']*)["\']', form)
    method = re.search(r'method=["\']([^"\']*)["\']', form)
    print(f"Form {i}: action={action.group(1) if action else '?'}, method={method.group(1) if method else '?'}")
    
    # Get input fields
    inputs = re.findall(r"<input[^>]+>", form, re.I)
    for inp in inputs:
        n = re.search(r'name=["\']([^"\']*)["\']', inp)
        v = re.search(r'value=["\']([^"\']*)["\']', inp)
        t = re.search(r'type=["\']([^"\']*)["\']', inp)
        print(f"  Input: name={n.group(1) if n else '?'}, type={t.group(1) if t else '?'}, value={v.group(1)[:20] if v else '?'}")
    print()

# Show all input fields on the page
all_inputs = re.findall(r"<input[^>]+>", resp.text, re.I)
print(f"Total inputs: {len(all_inputs)}")

# Show scripts
scripts = re.findall(r"<script[^>]*>.*?</script>", resp.text, re.DOTALL | re.I)
print(f"\nScripts: {len(scripts)}")
for s in scripts[:3]:
    print(f"  {s[:300]}")
