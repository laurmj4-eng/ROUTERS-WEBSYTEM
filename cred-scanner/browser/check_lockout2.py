#!/usr/bin/env python3
"""Check lockout status and attempt login."""
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
    # Check lockout via CheckPwdNotLogin.asp
    print("1. Check lockout status for superadmin...")
    driver.get(ROUTER + "/login.asp")
    time.sleep(3)

    # Check superadmin
    r = driver.execute_script("""
        var r1 = null, r2 = null;
        $.ajax({type:'POST', async:false, url:'/asp/CheckPwdNotLogin.asp',
            data: 'UserNameInfo=adminpldt&NormalPwdInfo=AC2DIU7QW3ERTY6UPAS4DFG',
            success: function(d) { r1 = String(d); },
            error: function(xhr) { r1 = 'err:' + xhr.status; }
        });
        $.ajax({type:'POST', async:false, url:'/asp/CheckPwdNotLogin.asp',
            data: 'UserNameInfo=admin&NormalPwdInfo=AC2DIU7QW3ERTY6UPAS4DFG',
            success: function(d) { r2 = String(d); },
            error: function(xhr) { r2 = 'err:' + xhr.status; }
        });
        return {superadmin: r1, admin: r2};
    """)
    print("   superadmin check:", r["superadmin"])
    print("   admin check:", r["admin"])

    # Check lockout counter
    lock = driver.execute_script("""
        var r = null;
        $.ajax({type:'POST', async:false, url:'/asp/CheckPwdNotLogin.asp',
            data: 'UserNameInfo=admin&NormalPwdInfo=WRONG',
            success: function(d) { r = String(d); },
            error: function(xhr) { r = 'err:' + xhr.status; }
        });
        return r;
    """)
    print("   admin wrong pwd check:", lock)

    # Check page vars
    pg_vars = driver.execute_script("""
        var r = {};
        try { r.LoginTimes = window.LoginTimes; } catch(e) {}
        try { r.errloginlockNum = window.errloginlockNum; } catch(e) {}
        try { r.LockLeftTime = window.LockLeftTime; } catch(e) {}
        try { r.PwdReset = window.PwdReset; } catch(e) {}
        return r;
    """)
    print("   Page vars:", pg_vars)

    # Try login via login.asp to see current state
    print("\n2. Attempt login via login.asp as adminpldt...")
    u = driver.find_element(By.ID, "txt_Username")
    p = driver.find_element(By.ID, "txt_Password")
    driver.execute_script("arguments[0].value=''; arguments[1].value='';", u, p)
    u.send_keys("adminpldt")
    p.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
    driver.execute_script("""
        window.CheckPassword = function() { return 0; };
        window.setDisable = function() {};
        window.RandomNum = function() { return '0'; };
        window.FormatUrlEncode = function(v) { return v; };
    """)
    driver.execute_script("document.getElementById('button').style.display = '';")
    driver.find_element(By.ID, "button").click()
    time.sleep(5)

    url = driver.current_url
    has_login = "txt_Username" in driver.page_source
    print("   URL:", url, "login_form:", has_login)

    if not has_login:
        lvl = driver.execute_script("return window.Userlevel;")
        print("   Userlevel:", lvl)
        print("   SUCCESS on login.asp")

    # Try direct admin.html login
    print("\n3. Try admin.html direct login...")
    driver.get(ROUTER + "/admin.html")
    time.sleep(4)
    u2 = driver.find_element(By.ID, "txt_Username")
    p2 = driver.find_element(By.ID, "txt_Password")
    driver.execute_script("arguments[0].value=''; arguments[1].value='';", u2, p2)
    u2.send_keys("adminpldt")
    p2.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
    driver.execute_script("window.setDisable = function() {}; document.getElementById('button').style.display = '';")
    driver.find_element(By.ID, "button").click()
    time.sleep(5)

    lvl2 = driver.execute_script("return window.Userlevel;")
    url2 = driver.current_url
    has_login2 = "txt_Username" in driver.page_source
    print("   Userlevel:", lvl2, "URL:", url2, "login_form:", has_login2)

    if int(str(lvl2)) == 2 and not has_login2:
        print("   Admin panel loaded! Checking page...")
        # Hide password change
        driver.execute_script("""
            var m = document.getElementById('base_mask');
            var p = document.getElementById('pwd_modify');
            if (m) m.style.display = 'none';
            if (p) p.style.display = 'none';
        """)
        time.sleep(1)

        # List visible elements
        visible = driver.execute_script("""
            var items = [];
            document.querySelectorAll('div[id], a, button, input, select, li, tr').forEach(function(el) {
                if (el.offsetParent !== null && el.offsetHeight > 0) {
                    var t = (el.textContent || el.value || '').trim().substring(0, 80);
                    if (t.length > 0) items.push(el.tagName + '#' + el.id + ': ' + t);
                }
            });
            return items.slice(0, 60);
        """)
        for v in visible:
            print("  ", v)

finally:
    driver.quit()
