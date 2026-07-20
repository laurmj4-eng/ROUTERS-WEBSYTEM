#!/usr/bin/env python3
"""
Default Credential Scanner
Scans router admin panels for default/hardcoded credentials.

Detects router model, queries a credential database (SQLite seeded from JSON),
and tests login combinations against the device.

Supports: Huawei, ZTE, Cisco, TP-Link, Netgear, D-Link, MikroTik, Comtrend
"""

import base64
import json
import logging
import re
import sqlite3
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

CHROME_PATHS = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


def _find_chrome() -> Optional[str]:
    for p in CHROME_PATHS:
        if Path(p).exists():
            return p
    return None


class DefaultCredentialScanner:
    """Scans a router for default/hardcoded credentials."""

    def __init__(
        self,
        target_url: str,
        db_path: str,
        seed_path: str = None,
        test_login: bool = True,
        timeout: int = 8,
        known_creds: list = None,
    ):
        self.target_url = self._normalize_url(target_url)
        self.db_path = db_path
        self.seed_path = seed_path
        self.test_login = test_login
        self.timeout = timeout
        self.known_creds = known_creds or []

        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

        requests.packages.urllib3.disable_warnings(
            requests.packages.urllib3.exceptions.InsecureRequestWarning
        )

        self._cached_model = None
        self._cached_vendor = None
        self._driver = None

    # ── URL Handling ───────────────────────────────────────────────────

    @staticmethod
    def _normalize_url(url: str) -> str:
        if not url.startswith("http"):
            url = f"https://{url}"
        return url.rstrip("/")

    def _ensure_working_scheme(self):
        """If HTTPS fails, try HTTP. If HTTP fails, try HTTPS. Update target_url."""
        for scheme in ["https", "http"]:
            test_url = re.sub(r"^https?://", f"{scheme}://", self.target_url)
            try:
                resp = self.session.get(
                    test_url, timeout=self.timeout, allow_redirects=True
                )
                if resp.status_code in [200, 301, 302, 403]:
                    self.target_url = test_url.rstrip("/")
                    logger.info(f"Using {scheme.upper()} scheme: {self.target_url}")
                    return
            except requests.RequestException:
                continue

        logger.warning(f"Cannot reach router at {self.target_url}")

    # ── Selenium Browser Management ───────────────────────────────────

    def _create_browser(self) -> webdriver.Chrome:
        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.add_argument("--disable-gpu")
        opts.add_argument("--ignore-certificate-errors")
        opts.add_argument("--window-size=1280,720")
        chrome_path = _find_chrome()
        if chrome_path:
            opts.binary_location = chrome_path

        driver = webdriver.Chrome(options=opts)
        driver.set_page_load_timeout(15)
        return driver

    def _get_browser(self) -> webdriver.Chrome:
        """Get or create a reusable browser instance."""
        if self._driver is None:
            self._driver = self._create_browser()
        return self._driver

    def _close_browser(self):
        if self._driver:
            try:
                self._driver.quit()
            except Exception:
                pass
            self._driver = None

    # ── Public API ────────────────────────────────────────────────────

    def scan(self) -> dict:
        """Full scan: detect model -> test known creds -> query DB -> test defaults."""
        logger.info(f"Starting credential scan against {self.target_url}")

        self._ensure_working_scheme()

        model = self._detect_model()
        vendor = self._identify_vendor(model)
        self._cached_model = model
        self._cached_vendor = vendor
        logger.info(f"Detected: vendor={vendor}, model={model}")

        self._ensure_db()
        db_creds = self._query_credentials(model, vendor)
        logger.info(f"Found {len(db_creds)} candidate credentials in database")

        all_creds = []
        for user, pwd in self.known_creds:
            all_creds.append((user, pwd, "known"))
        for user, pwd in db_creds:
            all_creds.append((user, pwd, "default"))

        if not self.test_login:
            return {
                "success": False,
                "simulated": True,
                "model": model,
                "vendor": vendor,
                "tested": 0,
                "candidates": [{"username": c[0], "password": c[1]} for c in all_creds],
            }

        if not all_creds:
            logger.info("No credentials to test")
            return {
                "success": False,
                "model": model,
                "vendor": vendor,
                "tested": 0,
            }

        use_selenium = vendor == "Huawei"
        if use_selenium:
            logger.info("Using Selenium browser session for Huawei login tests")
            self._driver = self._create_browser()

        tested = 0
        try:
            for username, password, cred_type in all_creds:
                tested += 1
                logger.info(f"Testing [{tested}/{len(all_creds)}]: {username}:{password} ({cred_type})")
                try:
                    if use_selenium:
                        result = self._test_huawei_login(username, password)
                    else:
                        result = self._test_generic_login(username, password)

                    if result:
                        label = "CURRENT PASSWORD" if cred_type == "known" else "DEFAULT CREDENTIAL"
                        logger.warning(f"{label} FOUND: {username}:{password}")
                        return {
                            "success": True,
                            "model": model,
                            "vendor": vendor,
                            "username": username,
                            "password": password,
                            "credential_type": cred_type,
                            "tested": tested,
                        }
                except Exception as e:
                    logger.debug(f"Login attempt failed: {e}")
                    continue
        finally:
            if use_selenium:
                self._close_browser()

        logger.info(f"Scan complete. Tested {tested} combinations. No credentials found.")
        return {
            "success": False,
            "model": model,
            "vendor": vendor,
            "tested": tested,
        }

    # ── Model Detection ───────────────────────────────────────────────

    def _detect_model(self) -> str:
        model = self._scrape_model_from_page()
        if model:
            return model
        model = self._check_server_header()
        if model:
            return model
        model = self._try_device_info_api()
        if model:
            return model
        return "Unknown"

    def _scrape_model_from_page(self) -> Optional[str]:
        urls_to_try = [
            f"{self.target_url}/login.asp",
            f"{self.target_url}/",
        ]
        for url in urls_to_try:
            try:
                resp = self.session.get(url, timeout=self.timeout, allow_redirects=True)
                html = resp.text

                product_match = re.search(
                    r"ProductName\s*=\s*['\"]([^'\"]+)['\"]", html
                )
                if product_match:
                    raw = product_match.group(1)
                    decoded = raw.encode().decode("unicode_escape")
                    if decoded:
                        return decoded.strip()

                for var_name in ["ModelName", "Model", "DeviceModel", "device_model"]:
                    var_match = re.search(
                        rf"{var_name}\s*=\s*['\"]([^'\"]+)['\"]", html
                    )
                    if var_match:
                        return var_match.group(1).strip()

                patterns = [
                    r"HG[\d]+[A-Z]?\d*[-]?\d*",
                    r"EG[\d]+[A-Z]?\d*[-]?\d*",
                    r"ZXHN\s+[A-Z]?\d+[A-Z]*",
                    r"TD-[\w]+",
                    r"Archer\s+[A-Z]\d+",
                    r"DGND[\d]+",
                    r"DPC[\d]+",
                    r"EPC[\d]+",
                    r"DIR-[\d]+[A-Z]*",
                    r"DSL-[\d]+",
                    r"R\d{4}",
                    r"C\d{3,4}",
                    r"F\d{3,4}[NL]?",
                ]
                for pattern in patterns:
                    match = re.search(pattern, html, re.IGNORECASE)
                    if match:
                        return match.group(0).strip()
            except requests.RequestException as e:
                logger.debug(f"Failed to scrape {url}: {e}")
                continue
        return None

    def _check_server_header(self) -> Optional[str]:
        try:
            resp = self.session.get(
                self.target_url, timeout=self.timeout, allow_redirects=True
            )
            server = resp.headers.get("Server", "")
            if server:
                for pattern in [r"HG[\d]+", r"ZXHN[\s\w]+", r"THOMSON"]:
                    match = re.search(pattern, server, re.IGNORECASE)
                    if match:
                        return match.group(0).strip()
        except requests.RequestException:
            pass
        return None

    def _try_device_info_api(self) -> Optional[str]:
        endpoints = [
            "/api/system/deviceinfo",
            "/api/v1/device/info",
            "/cgi-bin/deviceinfo",
            "/boardData.html",
        ]
        for endpoint in endpoints:
            try:
                resp = self.session.get(
                    urljoin(self.target_url + "/", endpoint.lstrip("/")),
                    timeout=self.timeout,
                )
                if resp.status_code == 200:
                    data = resp.json() if "json" in resp.headers.get("Content-Type", "") else {}
                    for key in ["model", "Model", "deviceModel", "productName"]:
                        if key in data:
                            return str(data[key])
            except (requests.RequestException, json.JSONDecodeError):
                continue
        return None

    # ── Vendor Identification ─────────────────────────────────────────

    def _identify_vendor(self, model: str) -> Optional[str]:
        model_upper = model.upper().replace(" ", "")

        vendor_indicators = {
            "Huawei": ["HG", "EG", "MA", "AR"],
            "ZTE": ["ZXHN", "ZXE", "F6", "F8", "ZXDSL"],
            "Cisco": ["DPC", "EPC", "CISCO", "LINKSYS"],
            "TP-Link": ["TD", "ARCHER", "DECO", "TL"],
            "Netgear": ["DGND", "R7", "R8", "R6", "C7", "D6", "Nighthawk"],
            "D-Link": ["DIR", "DSL", "DAP", "DCS", "DES", "DIS"],
            "MikroTik": ["RB", "ROUTERBOARD", "HAP", "HEX", "CCR", "CRS"],
            "Comtrend": ["AR", "VR", "CT", "COMTREND"],
        }

        for vendor, prefixes in vendor_indicators.items():
            for prefix in prefixes:
                if model_upper.startswith(prefix):
                    return vendor
        return None

    # ── Credential Database ───────────────────────────────────────────

    def _ensure_db(self):
        db_file = Path(self.db_path)
        if db_file.exists():
            return

        seed = self._load_seed()
        if not seed:
            logger.warning("No seed file found and no existing DB")
            return

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS credentials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vendor TEXT NOT NULL,
                model TEXT NOT NULL,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                critical INTEGER DEFAULT 0
            )
        """)

        for vendor_data in seed.get("vendors", []):
            vendor_name = vendor_data["name"]
            critical = 1 if vendor_data.get("critical", False) else 0
            models = vendor_data.get("models", [])
            credentials = vendor_data.get("credentials", [])

            for model in models:
                for cred in credentials:
                    cursor.execute(
                        "INSERT INTO credentials (vendor, model, username, password, critical) VALUES (?, ?, ?, ?, ?)",
                        (vendor_name, model, cred["username"], cred["password"], critical),
                    )

        conn.commit()
        conn.close()
        logger.info(f"Seeded credential database at {self.db_path}")

    def _load_seed(self) -> Optional[dict]:
        paths_to_try = [
            self.seed_path,
            str(Path(__file__).parent / "credentials.json"),
            str(Path(__file__).parent.parent / "cred-scanner" / "credentials.json"),
        ]
        for path in paths_to_try:
            if path and Path(path).exists():
                with open(path, "r") as f:
                    return json.load(f)
        return None

    def _query_credentials(self, model: str, vendor: Optional[str]) -> list:
        if not Path(self.db_path).exists():
            return []

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute(
            "SELECT username, password FROM credentials WHERE model = ?",
            (model,),
        )
        results = cursor.fetchall()

        if not results and vendor:
            cursor.execute(
                "SELECT username, password FROM credentials WHERE vendor = ?",
                (vendor,),
            )
            results = cursor.fetchall()

        if not results and model != "Unknown":
            cursor.execute(
                "SELECT username, password FROM credentials WHERE model LIKE ?",
                (f"%{model}%",),
            )
            results = cursor.fetchall()

        conn.close()
        return results

    # ── Huawei Login Testing (Selenium) ───────────────────────────────

    def _inject_huawei_bypasses(self, driver):
        """Inject JS overrides to bypass PLDT overlay and lockout."""
        driver.execute_script("""
            window.CheckPassword = function() { return 0; };
            window.setDisable = function() {};
            window.DisplayWifiPldt = function() {};
            window.BandSteeringState = function() {};
            window.LockLeftTime = 0;
            window.FailStat = '0';
            window.LoginTimes = 0;
            window.Userlevel = 0;
            window.preflag = 0;
            var el = document.getElementById('pwd_modify');
            if (el) el.style.display = 'none';
            var mask = document.getElementById('base_mask');
            if (mask) mask.style.display = 'none';
        """)

    def _test_huawei_login(self, username: str, password: str) -> bool:
        """Test Huawei/PLDT login using a shared Selenium browser session.

        Key fixes over previous version:
        - Navigates to /login.asp (not /)
        - Waits for the login button to be VISIBLE before interacting
        - Reuses the same browser instance (no Chrome-per-attempt)
        - Injects bypasses before clicking
        """
        driver = self._get_browser()
        try:
            driver.get(f"{self.target_url}/login.asp")

            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.ID, "txt_Username"))
            )

            try:
                WebDriverWait(driver, 8).until(
                    lambda d: d.find_element(By.ID, "button").is_displayed()
                )
            except Exception:
                driver.execute_script(
                    "document.getElementById('button').style.display = '';"
                )
                time.sleep(0.5)

            self._inject_huawei_bypasses(driver)

            lockout = driver.execute_script("""
                return (window.LockLeftTime || 0) > 0;
            """)
            if lockout:
                logger.warning("Router is locked out, waiting...")
                self._wait_lockout(driver)
                driver.get(f"{self.target_url}/login.asp")
                WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.ID, "txt_Username"))
                )
                self._inject_huawei_bypasses(driver)

            user_field = driver.find_element(By.ID, "txt_Username")
            pass_field = driver.find_element(By.ID, "txt_Password")

            driver.execute_script("arguments[0].value = '';", user_field)
            driver.execute_script("arguments[0].value = '';", pass_field)
            user_field.send_keys(username)
            pass_field.send_keys(password)

            login_btn = driver.find_element(By.ID, "button")
            login_btn.click()

            time.sleep(3)

            current_url = driver.current_url

            if "login.asp" in current_url or "login.cgi" in current_url:
                page_src = driver.page_source
                if "loginfail" in page_src:
                    is_visible = driver.execute_script("""
                        var el = document.getElementById('loginfail');
                        return el && el.style.display !== 'none';
                    """)
                    if is_visible:
                        logger.debug(f"Login failed for {username} (error shown)")
                        return False
                return False

            try:
                driver.get(f"{self.target_url}/html/amp/wlanbasic/WlanBasic.asp?2G")
                time.sleep(2)
                protected_url = driver.current_url

                if "login.asp" in protected_url or "login.cgi" in protected_url:
                    return False

                protected_src = driver.page_source

                if "txt_Username" in protected_src:
                    return False

                if "/wlanbasic/" in protected_url.lower():
                    return True

                has_wifi_form = (
                    "wlSsid" in protected_src or
                    "wlWpaPsk" in protected_src or
                    "PreSharedKey" in protected_src or
                    "FrameWlanSetting" in protected_src
                )
                if has_wifi_form:
                    return True

            except Exception:
                pass

            return False

        except Exception as e:
            logger.debug(f"Huawei login test error: {e}")
            return False

    def _wait_lockout(self, driver, max_wait: int = 300):
        """Wait for server-side lockout to expire."""
        start = time.time()
        while time.time() - start < max_wait:
            try:
                remaining = driver.execute_script(
                    "return window.LockLeftTime || 0;"
                )
            except Exception:
                remaining = 60

            if remaining <= 0:
                break

            logger.info(f"Lockout active — {remaining}s remaining")
            time.sleep(min(remaining + 2, 30))

    # ── Generic Login Testing (HTTP) ──────────────────────────────────

    def _test_generic_login(self, username: str, password: str) -> bool:
        """Generic login for non-Huawei devices via HTTP."""
        login_endpoints = [
            "/cgi-bin/login",
            "/cgi-bin/luci",
            "/login",
            "/auth/login",
            "/api/login",
            "/goform/login",
        ]

        for endpoint in login_endpoints:
            try:
                login_url = urljoin(self.target_url + "/", endpoint.lstrip("/"))
                data = {
                    "username": username,
                    "password": password,
                    "user": username,
                    "passwd": password,
                }

                resp = self.session.post(
                    login_url, data=data,
                    timeout=self.timeout, allow_redirects=True,
                )

                if resp.status_code in [200, 301, 302]:
                    lower_text = resp.text.lower()
                    if any(x in lower_text for x in ["login failed", "invalid password", "incorrect password", "wrong password"]):
                        continue

                    if any(x in lower_text for x in ["welcome", "dashboard", "status", "home", "logout"]):
                        return True

                    for cookie in self.session.cookies:
                        if any(x in cookie.name.lower() for x in ["session", "sid", "token", "auth"]):
                            return True

                    if resp.status_code in [301, 302]:
                        return True

            except requests.RequestException:
                continue

        return False
