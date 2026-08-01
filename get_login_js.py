import requests

TARGET = "http://10.0.0.1"

resp = requests.get(f"{TARGET}/admin/js/login.js?ref=1785327949", timeout=10)
print(f"Status: {resp.status_code}")
print(f"Length: {len(resp.text)} bytes")
print(f"Content-Type: {resp.headers.get('Content-Type')}")
print()
print(resp.text)
