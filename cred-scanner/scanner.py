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
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


class DefaultCredentialScanner:
    """Scans a router for default/hardcoded credentials."""

    # Huawei/PLDT-specific CSRF cookie
    PLDT_COOKIE = "body:Language::id=-1"

    # HTTP scheme — set by _detect_scheme()
    _scheme = "https"

    # Known login page patterns per vendor
    LOGIN_PATTERNS = {
        "Huawei": {
            "csrf_url": "/asp/GetRandCount.asp",
            "login_url": "/login.cgi",
            "csrf_regex": r"<RandCount>(\d+)</RandCount>",
            "method": "huawei",
        },
        "ZTE": {
            "login_url": "/cgi-bin/luci",
            "method": "form",
        },
        "Cisco": {
            "login_url": "/cgi-bin/login",
            "method": "form",
        },
    }

    def __init__(
        self,
        target_url: str,
        db_path: str,
        seed_path: str = None,
        test_login: bool = True,
        timeout: int = 8,
        known_creds: list = None,
    ):
        # Default to HTTPS if no scheme provided
        if not target_url.startswith("http"):
            target_url = f"https://{target_url}"
        self.target_url = target_url.rstrip("/")
        self.db_path = db_path
        self.seed_path = seed_path
        self.test_login = test_login
        self.timeout = timeout
        self.known_creds = known_creds or []  # List of (user, pass) tuples to test FIRST

        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        })

        requests.packages.urllib3.disable_warnings(
            requests.packages.urllib3.exceptions.InsecureRequestWarning
        )

    # ── Public API ────────────────────────────────────────────────────

    def scan(self) -> dict:
        """Full scan: detect model → test known creds → query DB → test defaults."""
        logger.info(f"Starting credential scan against {self.target_url}")

        model = self._detect_model()
        vendor = self._identify_vendor(model)
        logger.info(f"Detected: vendor={vendor}, model={model}")

        self._ensure_db()
        db_creds = self._query_credentials(model, vendor)
        logger.info(f"Found {len(db_creds)} candidate credentials in database")

        # Combine: known creds first, then DB defaults
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

        tested = 0
        for username, password, cred_type in all_creds:
            tested += 1
            try:
                if self._test_login(username, password):
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
                logger.debug(f"Login attempt failed with error: {e}")
                continue

        logger.info(f"Scan complete. Tested {tested} combinations. No credentials found.")
        return {
            "success": False,
            "model": model,
            "vendor": vendor,
            "tested": tested,
        }

    # ── Model Detection ───────────────────────────────────────────────

    def _detect_model(self) -> str:
        """Detect router model using multiple methods."""
        # Method 1: Scrape login page for model string
        model = self._scrape_model_from_page()
        if model:
            return model

        # Method 2: Check Server header
        model = self._check_server_header()
        if model:
            return model

        # Method 3: Try device info API
        model = self._try_device_info_api()
        if model:
            return model

        return "Unknown"

    def _scrape_model_from_page(self) -> Optional[str]:
        """Extract model from the router login page HTML."""
        try:
            resp = self.session.get(
                self.target_url, timeout=self.timeout, allow_redirects=True
            )
            html = resp.text

            # Method 1: Look for ProductName JS variable (Huawei/PLDT pattern)
            # e.g. ProductName = 'HG8145X6\x2d10';
            product_match = re.search(
                r"ProductName\s*=\s*['\"]([^'\"]+)['\"]", html
            )
            if product_match:
                raw = product_match.group(1)
                # Decode JS escape sequences like \x2d -> -
                decoded = raw.encode().decode("unicode_escape")
                if decoded:
                    return decoded.strip()

            # Method 2: Look for other JS variables containing model info
            for var_name in ["ModelName", "Model", "DeviceModel", "device_model"]:
                var_match = re.search(
                    rf"{var_name}\s*=\s*['\"]([^'\"]+)['\"]", html
                )
                if var_match:
                    return var_match.group(1).strip()

            # Method 3: Regex patterns for model strings in HTML
            patterns = [
                r"HG[\d]+[A-Z]?\d*[-]?\d*",       # HG8145X6-10, HG8245H, etc.
                r"EG[\d]+[A-Z]?\d*[-]?\d*",        # EG8145V5, etc.
                r"ZXHN\s+[A-Z]?\d+[A-Z]*",         # ZXHN H108N
                r"TD-[\w]+",                         # TP-Link TD-W8961N
                r"Archer\s+[A-Z]\d+",               # TP-Link Archer AX23
                r"DGND[\d]+",                        # Netgear DGND3700
                r"DPC[\d]+",                         # Cisco DPC3941T
                r"EPC[\d]+",                         # Cisco EPC3925
                r"DIR-[\d]+[A-Z]*",                  # D-Link DIR-825
                r"DIR-[\d]+L",                       # D-Link DIR-850L
                r"DSL-[\d]+",                        # D-Link DSL-3790
                r"R\d{4}",                           # Netgear R7000
                r"C\d{3,4}",                         # Netgear C7000
                r"F\d{3,4}[NL]?",                    # ZTE F660, F670L
            ]

            for pattern in patterns:
                match = re.search(pattern, html, re.IGNORECASE)
                if match:
                    return match.group(0).strip()

        except requests.RequestException as e:
            logger.debug(f"Failed to scrape login page: {e}")

        return None

    def _check_server_header(self) -> Optional[str]:
        """Check HTTP Server header for model info."""
        try:
            resp = self.session.get(
                self.target_url, timeout=self.timeout, allow_redirects=True
            )
            server = resp.headers.get("Server", "")
            if server:
                logger.debug(f"Server header: {server}")
                # Some routers embed model in Server header
                for pattern in [r"HG[\d]+", r"ZXHN[\s\w]+", r"THOMSON"]:
                    match = re.search(pattern, server, re.IGNORECASE)
                    if match:
                        return match.group(0).strip()
        except requests.RequestException:
            pass
        return None

    def _try_device_info_api(self) -> Optional[str]:
        """Try common device info API endpoints."""
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
        """Identify vendor from model string using the seed database."""
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
        """Create SQLite DB from seed JSON if it doesn't exist."""
        db_file = Path(self.db_path)
        if db_file.exists():
            return

        seed = self._load_seed()
        if not seed:
            logger.warning("No seed file found and no existing DB — cannot query credentials")
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
        """Load the JSON seed file."""
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
        """Query SQLite DB for credential candidates matching the model/vendor."""
        if not Path(self.db_path).exists():
            return []

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Exact model match
        cursor.execute(
            "SELECT username, password FROM credentials WHERE model = ?",
            (model,),
        )
        results = cursor.fetchall()

        # Fallback: vendor match if no exact model hit
        if not results and vendor:
            cursor.execute(
                "SELECT username, password FROM credentials WHERE vendor = ?",
                (vendor,),
            )
            results = cursor.fetchall()

        # Fallback: try partial model match
        if not results and model != "Unknown":
            cursor.execute(
                "SELECT username, password FROM credentials WHERE model LIKE ?",
                (f"%{model}%",),
            )
            results = cursor.fetchall()

        conn.close()
        return results

    # ── Login Testing ─────────────────────────────────────────────────

    def _test_login(self, username: str, password: str) -> bool:
        """Test a credential pair against the router."""
        # Determine login method based on detected vendor/model
        vendor = self._identify_vendor(self._detect_model())

        if vendor == "Huawei":
            return self._test_huawei_login(username, password)
        else:
            return self._test_generic_login(username, password)

    def _test_huawei_login(self, username: str, password: str) -> bool:
        """Huawei/PLDT login test using Selenium (real browser).
        
        Raw HTTP requests can't verify login on this router because
        sessions are managed entirely via JavaScript/document.cookie.
        """
        driver = None
        try:
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

            # Navigate to login page
            driver.get(self.target_url + "/")
            time.sleep(1)

            # Inject overlay bypass (same as the Puppeteer agent)
            driver.execute_script("""
                // Override PLDT overlay functions
                if (typeof CheckPassword !== 'undefined') {
                    window.CheckPassword = function() { return 0; };
                }
                if (typeof setDisable !== 'undefined') {
                    window.setDisable = function() {};
                }
                if (typeof DisplayWifiPldt !== 'undefined') {
                    window.DisplayWifiPldt = function() {};
                }
                // Remove overlay elements
                var overlay = document.getElementById('pwd_modify');
                if (overlay) overlay.style.display = 'none';
                var mask = document.getElementById('base_mask');
                if (mask) mask.style.display = 'none';
                // Force Userlevel to 0 (normal user)
                if (typeof Userlevel !== 'undefined') {
                    window.Userlevel = 0;
                }
                if (typeof preflag !== 'undefined') {
                    window.preflag = 0;
                }
            """)

            # Fill in username and password
            user_field = driver.find_element(By.ID, "txt_Username")
            pass_field = driver.find_element(By.ID, "txt_Password")

            user_field.clear()
            user_field.send_keys(username)
            pass_field.clear()
            pass_field.send_keys(password)

            # Click login button
            login_btn = driver.find_element(By.ID, "button")
            login_btn.click()

            # Wait for navigation — login succeeds if URL does NOT contain login.asp
            time.sleep(2)

            current_url = driver.current_url

            # If still on login page, login failed
            if "login.asp" in current_url or "login.cgi" in current_url:
                return False

            # Check if we're on the home page or a logged-in page
            page_source = driver.page_source
            has_login_form = "txt_Username" in page_source

            # If login form is still visible, we're not logged in
            if has_login_form:
                return False

            # We're logged in — try to access a protected page to confirm
            try:
                driver.get(self.target_url + "/html/amp/wlanbasic/WlanBasic.asp?2G")
                time.sleep(2)
                protected_url = driver.current_url
                protected_source = driver.page_source

                # If redirected to login.asp, session is invalid
                if "login.asp" in protected_url:
                    return False

                # If we can see WiFi settings, we're authenticated
                if "Ssid" in protected_source or "ssid" in protected_source.lower():
                    return True

                # 403 on the protected page means we're NOT logged in
                if "403" in driver.title or "Forbidden" in protected_source:
                    return False

                # If we got here without being redirected, consider it success
                if "login.asp" not in protected_url:
                    return True

            except Exception:
                pass

            return False

        except Exception as e:
            logger.debug(f"Selenium login test failed: {e}")
            return False
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass

    def _test_generic_login(self, username: str, password: str) -> bool:
        """Generic login for non-Huawei devices."""
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

                # Check for successful login indicators
                if resp.status_code in [200, 301, 302]:
                    # Negative indicators: login page still shown
                    lower_text = resp.text.lower()
                    if any(x in lower_text for x in ["login failed", "invalid password", "incorrect password", "wrong password"]):
                        continue

                    # Positive indicators
                    if any(x in lower_text for x in ["welcome", "dashboard", "status", "home", "logout"]):
                        return True

                    # Check for session cookies
                    for cookie in self.session.cookies:
                        if any(x in cookie.name.lower() for x in ["session", "sid", "token", "auth"]):
                            return True

                    # 302 redirect often means success
                    if resp.status_code in [301, 302]:
                        return True

            except requests.RequestException:
                continue

        return False
