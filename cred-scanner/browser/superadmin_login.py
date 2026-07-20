#!/usr/bin/env python3
"""Login via superadmin correctly - don't override CheckPassword for PLDT2."""
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
    print("Logging in as adminpldt:AC2DIU7QW3ERTY6UPAS4DFG (correct flow)...")
    driver = setup_driver()

    try:
        driver.get(f"{ROUTER}/admin.html")
        time.sleep(4)

        # Fill login form - DON'T override CheckPassword
        user = driver.find_element(By.ID, "txt_Username")
        pw = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value='';", user)
        driver.execute_script("arguments[0].value='';", pw)
        user.send_keys("adminpldt")
        pw.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")

        # Only override setDisable and make button visible - keep CheckPassword!
        driver.execute_script("""
            window.setDisable = function() {};
            document.getElementById('button').style.display = '';
        """)

        # Click login
        driver.find_element(By.ID, "button").click()
        print("Clicked login button...")
        time.sleep(5)

        url = driver.current_url
        src = driver.page_source
        print(f"After login URL: {url}")
        print(f"Page size: {len(src)} chars")

        # Check if we're still on admin.html (not redirected)
        if "login.asp" in url or "login.cgi" in url:
            print("REDIRECTED - login failed!")
            # Save for debugging
            with open("admin_fail.html", "w", encoding="utf-8") as f:
                f.write(src)
            return

        # Check if password change form appeared
        has_old_pwd = "old_password" in src
        has_login_form = "txt_Username" in src
        print(f"Has password change form: {has_old_pwd}")
        print(f"Has login form: {has_login_form}")

        # Save full page
        with open("admin_loggedin.html", "w", encoding="utf-8") as f:
            f.write(src)

        # Extract visible text and elements
        info = driver.execute_script("""
            var r = {};
            r.inputs = [];
            document.querySelectorAll('input').forEach(function(el) {
                r.inputs.push({
                    id: el.id, name: el.name, type: el.type,
                    value: el.value ? el.value.substring(0, 80) : '',
                });
            });
            r.buttons = [];
            document.querySelectorAll('button, input[type=button]').forEach(function(el) {
                r.buttons.push({id: el.id, text: (el.textContent || el.value || '').trim()});
            });
            r.allText = document.body ? document.body.innerText.substring(0, 5000) : '';
            r.jsVars = {};
            try {
                ['Userlevel', 'CfgMode', 'LoginTimes', 'Ssid1'].forEach(function(v) {
                    if (typeof window[v] !== 'undefined') r.jsVars[v] = String(window[v]).substring(0, 100);
                });
            } catch(e) {}
            return r;
        """)

        print("\n=== JS Variables ===")
        for k, v in info.get("jsVars", {}).items():
            print(f"  {k} = {v}")

        print("\n=== INPUTS ===")
        for inp in info.get("inputs", []):
            print(f"  id={inp['id']:30s} name={inp['name']:30s} type={inp['type']:15s} val={inp['value'][:40]}")

        print("\n=== BUTTONS ===")
        for btn in info.get("buttons", []):
            print(f"  id={btn['id']:30s} text={btn['text'][:40]}")

        print("\n=== VISIBLE TEXT ===")
        print(info.get("allText", "")[:3000])

        # If password change form is visible, try to use it
        if has_old_pwd:
            print("\n=== Password change form visible! ===")
            print("The superadmin page shows a password change form.")
            print("This form is for changing the ADMIN password (not superadmin).")
            print("We need to enter the OLD admin password, which we don't know.")
            print("BUT: the CheckPassword endpoint might help us verify passwords here too.")

        # Try GetUserInfo AJAX
        print("\n=== Trying AJAX endpoints ===")
        ajax_tests = [
            ("/asp/GetUserInfo.asp", "POST"),
            ("/asp/GetRandCount.asp", "POST"),
        ]
        for ajax_url, method in ajax_tests:
            try:
                result = driver.execute_script("""
                    var result = null;
                    $.ajax({
                        type: arguments[1],
                        async: false,
                        cache: false,
                        url: arguments[0],
                        success: function(data) { result = data; }
                    });
                    return result;
                """, ajax_url, method)
                print(f"  {ajax_url} -> {str(result)[:300]}")
            except Exception as e:
                print(f"  {ajax_url} -> ERROR: {str(e)[:100]}")

        # Try to access other admin pages while logged in
        print("\n=== Trying to access admin pages ===")
        admin_pages = [
            "/html/amp/wlanbasic/WlanBasic.asp?2G",
            "/html/amp/system/DeviceInfo.asp",
            "/html/amp/system/Password.asp",
            "/html/amp/advanced/UserMgmt.asp",
        ]
        for page in admin_pages:
            try:
                driver.get(f"{ROUTER}{page}")
                time.sleep(2)
                page_url = driver.current_url
                page_src = driver.page_source
                has_login = "txt_Username" in page_src
                print(f"  {page:50s} -> {'LOGIN' if has_login else f'OK ({len(page_src)} chars)'} [{page_url[-30:]}]")
                if not has_login:
                    # Save and show content
                    fname = page.replace("/", "_").replace("?", "_") + ".html"
                    with open(fname, "w", encoding="utf-8") as f:
                        f.write(page_src)
                    text = driver.execute_script("return document.body ? document.body.innerText.substring(0, 1000) : '';")
                    print(f"    Text: {text[:200]}")
            except Exception as e:
                print(f"  {page} -> ERROR: {str(e)[:60]}")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
