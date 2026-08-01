from PIL import Image
import io
import requests

# Get captcha
resp = requests.get("http://10.0.0.1/admin/index?action=captcha.js")
img = Image.open(io.BytesIO(resp.content))

print(f"Size: {img.size}")
print(f"Mode: {img.mode}")
print(f"Format: {img.format}")

# Convert to RGB for pixel analysis
if img.mode == "P":
    img = img.convert("RGB")

w, h = img.size
print(f"Dimensions: {w}x{h}")

# Print ASCII representation
for y in range(h):
    row = ""
    for x in range(w):
        r, g, b = img.getpixel((x, y))[:3]
        is_black = (r + g + b) < 384
        row += "#" if is_black else " "
    print(f"|{row}|")

# Save the image
img.save("captcha.png")
print("\nImage saved as captcha.png")
