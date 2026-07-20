#!/usr/bin/env python3
import time
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

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

print("Navigating to login...")
driver.get("https://192.168.1.1/")
time.sleep(2)

print("Current URL:", driver.current_url)
print("Title:", driver.title)

try:
    user_field = driver.find_element(By.ID, "txt_Username")
    print("Username field found")
except Exception as e:
    print("Username field NOT found:", e)

driver.execute_script("""
    window.CheckPassword = function() { return 0; };
    window.setDisable = function() {};
    window.DisplayWifiPldt = function() {};
    window.Userlevel = 0;
    window.preflag = 0;
    var overlay = document.getElementById("pwd_modify");
    if (overlay) overlay.style.display = "none";
    var mask = document.getElementById("base_mask");
    if (mask) mask.style.display = "none";
""")

user_field = driver.find_element(By.ID, "txt_Username")
pass_field = driver.find_element(By.ID, "txt_Password")
user_field.clear()
user_field.send_keys("admin")
pass_field.clear()
pass_field.send_keys("Admin1234")

login_btn = driver.find_element(By.ID, "button")
login_btn.click()
time.sleep(3)

print("After login URL:", driver.current_url)
print("After login Title:", driver.title)

src = driver.page_source
has_login_form = "txt_Username" in src
print("Still has login form:", has_login_form)

try:
    err = driver.execute_script(
        'return document.getElementById("loginfail") ? '
        'document.getElementById("loginfail").style.display : "no element"'
    )
    print("Login fail display:", err)
except Exception as e:
    print("Error checking loginfail:", e)

print("Navigating to protected page...")
driver.get("https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G")
time.sleep(3)
print("Protected URL:", driver.current_url)
print("Protected Title:", driver.title)
src2 = driver.page_source
print("Has login form on protected:", "txt_Username" in src2)
print("Has Ssid:", "Ssid" in src2 or "ssid" in src2.lower())

# Dump first 500 chars of protected page
print("--- PROTECTED PAGE SNIPPET ---")
print(src2[:500])
print("--- END ---")

driver.quit()
print("Done")
