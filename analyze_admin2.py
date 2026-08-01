import re

with open("admin_login.html", "r", encoding="utf-8") as f:
    text = f.read()

# Show all script tags
scripts = re.findall(r'<script[^>]*src=["\']([^"\']*)["\'][^>]*>', text, re.I)
print("External scripts:")
for s in scripts:
    print(f"  {s}")

# Show inline scripts
inline = re.findall(r'<script[^>]*>(.*?)</script>', text, re.DOTALL | re.I)
print(f"\nInline scripts: {len(inline)}")
for s in inline:
    if len(s.strip()) > 0:
        print(f"  [{len(s)}b]: {s[:300]}")

# Output the full HTML
with open("admin_full.txt", "w", encoding="utf-8") as f:
    f.write(text)
print(f"\nFull HTML saved ({len(text)} bytes)")
