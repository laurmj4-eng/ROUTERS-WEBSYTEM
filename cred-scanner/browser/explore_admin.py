#!/usr/bin/env python3
"""Explore admin.html page content after superadmin login."""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import os, time, json

def main():
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

    try:
        driver.get("https://192.168.1.1/admin.html")
        time.sleep(4)

        # Login
        try:
            user = driver.find_element(By.ID, "txt_Username")
            pw = driver.find_element(By.ID, "txt_Password")
            driver.execute_script("arguments[0].value='';", user)
            driver.execute_script("arguments[0].value='';", pw)
            user.send_keys("adminpldt")
            pw.send_keys("z6dtnxg3ocz4")
            driver.execute_script("document.getElementById('button').style.display='';")
            driver.execute_script("""
                window.CheckPassword = function() { return 0; };
                window.setDisable = function() {};
                window.Userlevel = 0;
                window.preflag = 0;
            """)
            driver.find_element(By.ID, "button").click()
            time.sleep(5)
        except Exception as e:
            print(f"Login attempt: {e}")

        print(f"URL: {driver.current_url}")
        print(f"Title: {driver.title}")

        src = driver.page_source
        print(f"Page source: {len(src)} chars")
        print()

        # Dump full page source
        with open("admin_page.html", "w", encoding="utf-8") as f:
            f.write(src)
        print("Full page source saved to admin_page.html")

        # Get all elements
        info = driver.execute_script("""
            var r = {};
            r.inputs = [];
            document.querySelectorAll('input').forEach(function(el) {
                r.inputs.push({id: el.id, name: el.name, type: el.type, value: el.value.substring(0,50)});
            });
            r.buttons = [];
            document.querySelectorAll('button, input[type=button], input[type=submit]').forEach(function(el) {
                r.buttons.push({id: el.id, text: (el.textContent || el.value || '').trim().substring(0,50)});
            });
            r.selects = [];
            document.querySelectorAll('select').forEach(function(el) {
                var opts = [];
                el.querySelectorAll('option').forEach(function(o) { opts.push(o.value + ':' + o.textContent.trim()); });
                r.selects.push({id: el.id, name: el.name, options: opts.slice(0, 15)});
            });
            r.iframes = [];
            document.querySelectorAll('iframe').forEach(function(el) {
                r.iframes.push({id: el.id, src: el.src, name: el.name});
            });
            r.allText = document.body ? document.body.innerText.substring(0, 3000) : '';
            r.tables = document.querySelectorAll('table').length;
            r.links = [];
            document.querySelectorAll('a[href]').forEach(function(el) {
                r.links.push({href: el.href, text: el.textContent.trim().substring(0, 50)});
            });
            return r;
        """)

        print("\n=== INPUTS ===")
        for inp in info.get("inputs", []):
            print(f"  {inp}")
        print("\n=== BUTTONS ===")
        for btn in info.get("buttons", []):
            print(f"  {btn}")
        print("\n=== SELECTS ===")
        for sel in info.get("selects", []):
            print(f"  {sel}")
        print("\n=== IFRAMES ===")
        for iframe in info.get("iframes", []):
            print(f"  {iframe}")
        print(f"\n=== TABLES: {info.get('tables', 0)} ===")
        print("\n=== LINKS ===")
        for link in info.get("links", []):
            print(f"  {link}")
        print("\n=== VISIBLE TEXT ===")
        print(info.get("allText", "")[:3000])

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
