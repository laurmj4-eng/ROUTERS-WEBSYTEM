#!/usr/bin/env python3
"""Verify if admin password actually changed."""
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
    driver.set_page_load_timeout(15)
    return driver


def try_login(driver, username, password):
    driver.get(f"{ROUTER}/login.asp")
    time.sleep(3)
    user = driver.find_element(By.ID, "txt_Username")
    pw = driver.find_element(By.ID, "txt_Password")
    driver.execute_script("arguments[0].value='';", user)
    driver.execute_script("arguments[0].value='';", pw)
    user.send_keys(username)
    pw.send_keys(password)
    driver.execute_script("window.CheckPassword = function() { return 0; }; window.setDisable = function() {};")
    driver.execute_script("document.getElementById('button').style.display='';")
    driver.find_element(By.ID, "button").click()
    time.sleep(4)
    url = driver.current_url
    has_login = "txt_Username" in driver.page_source
    return url, has_login


def main():
    driver = setup_driver()
    try:
        # Test new password
        url1, login1 = try_login(driver, "admin", "Admin9999")
        print(f"admin:Admin9999 -> URL: {url1}, login form: {login1}")

        if not login1:
            driver.get(f"{ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G")
            time.sleep(3)
            has_login2 = "txt_Username" in driver.page_source
            print(f"  Protected page accessible: {not has_login2}")

        # Test old password
        url2, login2 = try_login(driver, "admin", "Admin1234")
        print(f"admin:Admin1234 -> URL: {url2}, login form: {login2}")

        if not login2:
            driver.get(f"{ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G")
            time.sleep(3)
            has_login3 = "txt_Username" in driver.page_source
            print(f"  Protected page accessible: {not has_login3}")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
