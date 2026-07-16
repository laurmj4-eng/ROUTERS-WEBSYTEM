const { execSync } = require('child_process');
const selectors = require('./selectors');

const ROUTER_URL = () => `https://${process.env.ROUTER_IP}`;
const GOTO_OPTS = { waitUntil: 'domcontentloaded', timeout: 30000, ignoreHTTPSErrors: true };

/**
 * Wait helper — resolves after ms milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if the current browser page has an active (non-expired) router session.
 * Navigates to a lightweight post-login page and checks if we get redirected
 * back to login.asp. Returns false if redirected or on any error.
 */
async function isLoggedIn(page) {
  try {
    console.log('[session] Checking session validity...');
    await page.goto(`${ROUTER_URL()}/html/amp/wlanbasic/WlanBasic.asp?2G`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
      ignoreHTTPSErrors: true,
    });
    await sleep(2000);
    const url = page.url();
    const loggedIn = url.includes('WlanBasic');
    console.log(`[session] URL: ${url}`);
    console.log(`[session] ${loggedIn ? 'Session valid — skipping login' : 'Session expired — re-login required'}`);
    return loggedIn;
  } catch (err) {
    console.error(`[session] Session check failed: ${err.message}`);
    return false;
  }
}

/**
 * Inject JavaScript overrides that bypass the forced password-change overlay
 * and lockout mechanisms on PLDT2-config firmware.
 *
 * Called AFTER page load but BEFORE clicking login, so our overrides replace
 * the page's functions directly.
 *
 * @param {import('puppeteer').Page} page
 */
async function injectOverlayBypass(page) {
  await page.evaluate(() => {
    // Bypass CheckPassword — always return 0 (non-default password)
    // This prevents SubmitForm() from showing the overlay
    window.CheckPassword = () => 0;

    // Neutralize setDisable — prevents inputs/buttons from being disabled
    window.setDisable = () => {};

    // Neutralize DisplayWifiPldt — the function that shows the overlay
    window.DisplayWifiPldt = () => {};

    window.BandSteeringState = () => {};

    // Reset lockout state
    window.LockLeftTime = 0;
    window.FailStat = '0';
    window.LoginTimes = 0;
  });
  console.log('[bypass] Overlay bypass injected');
}

/**
 * Check whether the forced password-change overlay is visible.
 * This overlay appears when the admin logs in with the default password
 * on PLDT2-config firmware.
 */
async function isPasswordChangeOverlayVisible(page) {
  try {
    await page.waitForSelector(selectors.forcedPasswordChange.container, {
      visible: true,
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect lockout state (too many failed login attempts).
 */
async function isLockedOut(page) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el && el.style.display !== 'none';
  }, selectors.status.errorContainer);
}

/**
 * Log in to the Huawei HG8145X6-10 admin panel.
 *
 * The login page (login.asp) loads JavaScript that hides the login button
 * until LoadFrame() runs.  We wait for the button to become visible before
 * clicking, which guarantees JS initialisation is complete.
 *
 * @param {import('puppeteer').Page} page
 * @returns {Promise<'ok' | 'overlay' | 'locked'>}
 */
async function loginRouter(page, username = null, password = null) {
  username = username || process.env.ROUTER_USER;
  password = password || process.env.ROUTER_PASS;

  await page.goto(`${ROUTER_URL()}/login.asp`, GOTO_OPTS);

  // The login button starts hidden; LoadFrame() sets display:''
  await page.waitForSelector(selectors.login.loginButton, {
    visible: true,
    timeout: 10000,
  });

  // Inject overlay bypass AFTER page load — overrides page's CheckPassword
  await injectOverlayBypass(page);

  // Check for lockout before attempting login
  if (await isLockedOut(page)) {
    throw new Error('Router is locked out — too many failed attempts.');
  }

  await page.type(selectors.login.username, username);
  await page.type(selectors.login.password, password);

  // Click login — overlay bypass ensures form submits normally
  await page.click(selectors.login.loginButton);
  await new Promise(r => setTimeout(r, 5000));

  return 'ok';
}

/**
 * Execute a router reboot via Puppeteer.
 *
 * Strategy: navigate to the post-login admin panel, find the System Tools
 * menu, expand it, click Reboot, then confirm.
 *
 * Because the Huawei admin panel uses a frame-based layout, we target the
 * inner frame that contains the actual page content.  If the frame cannot
 * be located (ISP firmware variation), we fall back to navigating the
 * reboot URL directly.
 *
 * @param {import('puppeteer').Page} page
 */
async function executeRouterReboot(page) {
  const baseUrl = ROUTER_URL();
  console.log('[automation] Starting router reboot via direct navigation...');

  // The reboot page is at html/ssmp/reset/reset.asp or a known fallback.
  const rebootPaths = [
    'html/ssmp/reset/reset.asp',
    'html/amp/maintenance/Reboot.asp',
    'html/ssmp/management/reboot.asp',
    'html/bbsp/management/reboot.asp',
  ];

  let rebooted = false;

  for (const rebootPath of rebootPaths) {
    try {
      const frame = await loadFrame(page, rebootPath);
      if (!frame) continue;

      await sleep(1000);

      // Common Huawei reboot button selectors
      const rebootBtn = await frame.$(
        'input[value="Reboot"], input[value="Restart"], ' +
        'button[onclick*="eboot"], input[onclick*="eboot"], ' +
        'input[type="button"][value*="eboot"], #RebootSC'
      );

      if (rebootBtn) {
        // Accept any confirmation dialog
        page.once('dialog', (dialog) => dialog.accept());
        await rebootBtn.click();
        await sleep(2000);
        // Accept a possible second dialog
        page.once('dialog', (dialog) => dialog.accept());
        await sleep(3000);
        console.log(`[automation] Reboot command sent via frame path: ${rebootPath}`);
        rebooted = true;
        break;
      } else {
        console.log(`[automation] No reboot button found at ${rebootPath}, trying next...`);
      }
    } catch (err) {
      console.log(`[automation] Frame reboot attempt failed for ${rebootPath}: ${err.message}`);
    }
  }

  if (!rebooted) {
    // Last resort: dump the reboot frame HTML for debugging
    try {
      const frame = await loadFrame(page, rebootPaths[0]);
      if (frame) {
        const fs = require('fs');
        fs.writeFileSync('iframe-reboot-debug.html', await frame.content());
        console.log('[automation] Dumped reboot frame to iframe-reboot-debug.html for debugging.');
      }
    } catch (_) {}
    throw new Error('Could not locate reboot button on any known path.');
  }
}

/**
 * Change the Wi-Fi password using the forced password-change overlay.
 *
 * This overlay is shown on PLDT2-config firmware when the admin logs in
 * with the default password.  It contains fields for:
 *   - Old admin password
 *   - New admin password + confirm
 *   - 2.4G Wi-Fi SSID + password + confirm
 *   - 5G Wi-Fi SSID + password + confirm  (if band steering is OFF)
 *
 * The form posts to MdfPwdAdminNoLg.cgi (for Userlevel==2 admin).
 *
 * @param {import('puppeteer').Page} page
 * @param {string} newPassword   The new Wi-Fi password to apply
 * @param {string} currentPass   The current admin password (needed for old_password field)
 */
async function executePasswordChangeViaOverlay(page, newPassword, currentPass) {
  const s = selectors.forcedPasswordChange;

  // Fill old admin password
  await page.type(s.oldPassword, currentPass);

  // Fill new admin password (same as Wi-Fi password for simplicity)
  await page.type(s.newPassword, currentPass);
  await page.type(s.confirmPassword, currentPass);

  // Fill 2.4G Wi-Fi password
  await page.type(s.ssid1Password, newPassword);
  await page.type(s.ssid1ConfirmPW, newPassword);

  // Handle band steering — if unchecked, also set the 5G password
  const bandSteeringChecked = await page.$eval(s.bandSteering, (el) => el.checked);
  if (!bandSteeringChecked) {
    await page.type(s.ssid2Password, newPassword);
    await page.type(s.ssid2ConfirmPW, newPassword);
  }

  // Click Update -> calls SubmitUpdate() -> POSTs to MdfPwdAdminNoLg.cgi
  // The router processes the CGI and may not navigate — just click and wait
  await page.click(s.updateButton).catch(() => {});
  console.log('[automation] Overlay Update clicked, waiting for router to process...');

  // Wait for the router to process (it may reboot or just refresh)
  await new Promise(r => setTimeout(r, 10000));

  console.log('[automation] Password change submitted via overlay.');
}

/**
 * Main password-change function.
 *
 * Decides whether to use the overlay (default-password scenario) or
 * navigate to the WLAN settings page (non-default-password scenario).
 *
 * @param {import('puppeteer').Page} page
 * @param {string} newPassword
 */
async function executePasswordChange(page, newPassword) {
  const currentPass = process.env.ROUTER_PASS;

  // If the overlay is visible, use it directly (handles both bands at once)
  if (await isPasswordChangeOverlayVisible(page)) {
    await executePasswordChangeViaOverlay(page, newPassword, currentPass);
    return;
  }

  const baseUrl = ROUTER_URL();

  /**
   * Helper: navigate to a WLAN page, set both password fields via evaluate,
   * and click the Apply button.  Returns true on success.
   */
  async function changeWlanPassword(wlanPath, label) {
    try {
      const cleanPath = wlanPath.replace(/^\//, '');
      await page.goto(`${baseUrl}/${cleanPath}`, { ...GOTO_OPTS, timeout: 10000 });
      await sleep(2000);

      // Dynamically find ALL password-related fields on the page.
      // Huawei firmware uses different IDs per page/band, so we search broadly.
      const fieldsUpdated = await page.evaluate((newPwd) => {
        const elements = new Set();

        // Known password field IDs across Huawei firmware variants
        const knownIds = [
          'wlWpaPsk', 'twlWpaPsk',
          'txt_ssidpassword', 'txt_ssidpassword5g',
          'ssidpassword', 'ssidpassword5g',
          'PreSharedKey', 'wpaKey',
          'password', 'txt_password',
        ];
        knownIds.forEach(id => {
          const el = document.getElementById(id);
          if (el && el.tagName === 'INPUT') elements.add(el);
        });

        // Broad selector: any input that looks like a WiFi password field
        document.querySelectorAll(
          'input[type="password"], input[type="text"][name*="Key"], ' +
          'input[type="text"][name*="password"], input[type="text"][name*="psk"], ' +
          'input[type="text"][id*="password"], input[type="text"][id*="Psk"]'
        ).forEach(el => {
          // Skip hidden fields and very short max-length (likely not password)
          if (el.type !== 'hidden' && el.maxLength !== 0) {
            elements.add(el);
          }
        });

        elements.forEach(f => {
          f.value = newPwd;
          f.dispatchEvent(new Event('input',  { bubbles: true }));
          f.dispatchEvent(new Event('change', { bubbles: true }));
        });

        return elements.size;
      }, newPassword);

      console.log(`[automation] ${label}: Set ${fieldsUpdated} field(s).`);

      if (fieldsUpdated > 0) {
        const saveBtn = await page.$(
          'button#btnApplySubmit, input[value="Apply"], input[value="Save"], ' +
          'button[onclick*="ubmit"], input[type="submit"]'
        );
        if (saveBtn) {
          page.once('dialog', (dialog) => dialog.accept());
          await saveBtn.click();
          await sleep(4000);
          console.log(`[automation] ${label}: Password submitted.`);
          return true;
        }
        console.warn(`[automation] ${label}: Apply button not found.`);
      }
    } catch (err) {
      console.error(`[automation] ${label}: Failed — ${err.message}`);
    }
    return false;
  }

  // Change 2.4G password
  const ok24 = await changeWlanPassword(selectors.postLogin.wlan24G, '2.4G');
  // Change 5G password
  const ok5  = await changeWlanPassword(selectors.postLogin.wlan5G,  '5G');

  if (ok24 || ok5) {
    console.log(`[automation] WiFi password changed — 2.4G: ${ok24}, 5G: ${ok5}`);
    return;
  }

  throw new Error('Could not complete WiFi password change on either band.');
}


/**
 * Scrape the first matching value from an array of selectors.
 *
 * Tries each selector in order and returns the value of the first
 * element found.  Returns null if no element matches.
 *
 * @param {import('puppeteer').Page} page
 * @param {string[]} selectors
 * @returns {Promise<string|null>}
 */
async function scrapeFirstMatch(context, selectorList) {
  for (const sel of selectorList) {
    try {
      const value = await context.$eval(sel, (el) => el.value ?? el.textContent?.trim() ?? '');
      if (value) {
        console.log(`[automation] Found value with selector "${sel}": "${value}"`);
        return value;
      }
    } catch {
      // Selector not found, try next
    }
  }
  return null;
}

/**
 * Helper to navigate the page directly to an ASP path and return data via JS eval.
 * The Huawei router ASP pages embed all config values as inline JavaScript variables.
 * Since cookies are shared in the same browser page, we can navigate directly.
 */
async function loadFrame(page, path) {
  const baseUrl = ROUTER_URL();
  // Ensure the path starts with /
  const fullPath = path.startsWith('http') ? path : `${baseUrl}/${path.replace(/^\//, '')}`;

  try {
    await page.goto(fullPath, { waitUntil: 'domcontentloaded', timeout: 12000, ignoreHTTPSErrors: true });
    await sleep(1500);
    const url = page.url();
    console.log(`[automation] Direct navigation to: ${url}`);
    // Return the page itself as the "frame" context
    return page;
  } catch (err) {
    console.log(`[automation] Direct navigation failed for ${path}: ${err.message}`);
    return null;
  }
}

/**
 * Execute a full network scan of the Huawei HG8145X6-10.
 *
 * Scrapes:
 *   1. 2.4G WLAN page — SSID name and password
 *   2. 5G WLAN page — SSID name and password
 *   3. Connected devices — count of DHCP clients
 *   4. Connection status — internet/WAN state
 *
 * @param {import('puppeteer').Page} page
 * @returns {Promise<Object>} scanData
 */
async function executeNetworkScan(page) {
  const baseUrl = ROUTER_URL();
  const scan = selectors.networkScan;

  const result = {
    wifi_name_2g: null,
    wifi_password_2g: null,
    wifi_name_5g: null,
    wifi_password_5g: null,
    connection_status: 'unknown',
    total_connected_devices: 0,
  };

  // --- 1. Scrape 2.4G WLAN settings ---
  try {
    console.log('[automation] Navigating to 2.4G WLAN settings...');
    const frame24 = await loadFrame(page, scan.wlan24G.path);
    if (frame24) {
      result.wifi_name_2g = await scrapeFirstMatch(frame24, scan.wlan24G.ssidName);
      if (!result.wifi_name_2g) {
        result.wifi_name_2g = await frame24.evaluate(() => typeof WlanWifiArr !== 'undefined' && WlanWifiArr[0] ? WlanWifiArr[0].ssid : null).catch(() => null);
      }
      result.wifi_password_2g = await scrapeFirstMatch(frame24, scan.wlan24G.ssidPassword);
      if (!result.wifi_password_2g) {
        result.wifi_password_2g = await frame24.evaluate(() => typeof wpaPskKey !== 'undefined' && wpaPskKey[0] ? wpaPskKey[0].value : null).catch(() => null);
      }
    }
    console.log(`[automation] 2.4G — SSID: ${result.wifi_name_2g}, Password: ${result.wifi_password_2g ? '***' : 'N/A'}`);
  } catch (err) {
    console.error('[automation] Failed to scrape 2.4G WLAN page:', err.message);
  }

  // --- 2. Scrape 5G WLAN settings ---
  try {
    console.log('[automation] Navigating to 5G WLAN settings in frame...');
    const frame5 = await loadFrame(page, scan.wlan5G.path);
    if (frame5) {
      result.wifi_name_5g = await scrapeFirstMatch(frame5, scan.wlan5G.ssidName);
      if (!result.wifi_name_5g) {
        // Huawei usually stores 5G in index 1 or depending on the band setup. WlanWifiArr[1] or similar.
        result.wifi_name_5g = await frame5.evaluate(() => typeof WlanWifiArr !== 'undefined' && WlanWifiArr.length > 1 && WlanWifiArr[1] ? WlanWifiArr[1].ssid : null).catch(() => null);
      }
      result.wifi_password_5g = await scrapeFirstMatch(frame5, scan.wlan5G.ssidPassword);
      if (!result.wifi_password_5g) {
        result.wifi_password_5g = await frame5.evaluate(() => typeof wpaPskKey !== 'undefined' && wpaPskKey.length > 1 && wpaPskKey[1] ? wpaPskKey[1].value : null).catch(() => null);
      }
    }
    console.log(`[automation] 5G — SSID: ${result.wifi_name_5g}, Password: ${result.wifi_password_5g ? '***' : 'N/A'}`);
  } catch (err) {
    console.error('[automation] Failed to scrape 5G WLAN page:', err.message);
  }

  // --- 3. Scrape connected devices ---
  try {
    console.log('[automation] Navigating to network map for device count...');
    const devicePaths = [scan.connectedDevices.path, ...scan.connectedDevices.fallbackPaths];

    for (const devicePath of devicePaths) {
      try {
        const frameDevice = await loadFrame(page, devicePath);
        if (!frameDevice) continue;

        // Try to read a device count element first
        const countStr = await scrapeFirstMatch(frameDevice, scan.connectedDevices.deviceCount);
        if (countStr) {
          const parsed = parseInt(countStr, 10);
          if (!isNaN(parsed)) {
            result.total_connected_devices = parsed;
            console.log(`[automation] Device count from element: ${parsed}`);
            break;
          }
        }

        // Fallback: count table rows (excluding header)
        const rowCount = await frameDevice.$$eval(
          scan.connectedDevices.deviceRows,
          (rows) => rows.length
        ).catch(() => 0);

        // Subtract 1 for header row if present
        result.total_connected_devices = Math.max(0, rowCount - 1);
        console.log(`[automation] Device count from table rows: ${result.total_connected_devices}`);
        break;
      } catch {
        console.log(`[automation] Device path ${devicePath} failed, trying next...`);
      }
    }
  } catch (err) {
    console.error('[automation] Failed to scrape connected devices:', err.message);
  }

  // --- 4. Check connection status ---
  try {
    console.log('[automation] Checking connection status...');
    const statusSelectors = scan.connectionStatus.indicators;

    for (const statusPath of scan.connectionStatus.paths) {
      try {
        const frameStatus = await loadFrame(page, statusPath);
        if (!frameStatus) continue;

        const statusText = await scrapeFirstMatch(frameStatus, statusSelectors);
        if (statusText) {
          result.connection_status = statusText.toLowerCase().includes('connect') ? 'connected' : statusText;
          console.log(`[automation] Connection status: ${result.connection_status}`);
          break;
        }
      } catch {
        // Try next path
      }
    }
  } catch (err) {
    console.error('[automation] Failed to check connection status:', err.message);
  }

  console.log('[automation] Network scan complete:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * Change the router admin panel password (not WiFi password).
 *
 * Navigates to the admin account management page, fills old/new/confirm
 * password fields, and submits.
 *
 * @param {import('puppeteer').Page} page
 * @param {string} newPassword
 */
async function executeAdminPasswordChange(page, newPassword) {
  const baseUrl = ROUTER_URL();
  console.log('[automation] Starting admin password change...');

  const adminPages = [
    'html/ssmp/management/accmgmt/usermgmt.asp',
    'html/ssmp/management/account management/user management.asp',
  ];

  let navigated = false;
  for (const adminPage of adminPages) {
    try {
      await page.goto(`${baseUrl}/${adminPage}`, { ...GOTO_OPTS, timeout: 10000 });
      await sleep(2000);
      navigated = true;
      console.log(`[automation] Navigated to admin page: ${adminPage}`);
      break;
    } catch {
      continue;
    }
  }

  if (!navigated) {
    // Fallback: try to find "Management" or "Account" link in the sidebar
    const links = await page.$$('a');
    for (const link of links) {
      const text = await page.evaluate((el) => el.textContent, link);
      if (/management|account|system|admin/i.test(text)) {
        await link.click();
        await sleep(2000);
        navigated = true;
        break;
      }
    }
  }

  if (!navigated) {
    throw new Error('Could not navigate to admin password change page');
  }

  // Look for password change form elements
  const currentPassSelectors = [
    '#OldPassword', '#oldPassword', '#old_password',
    'input[name="OldPassword"]', 'input[name="oldPassword"]',
  ];

  const newPassSelectors = [
    '#NewPassword', '#newPassword', '#new_password',
    'input[name="NewPassword"]', 'input[name="newPassword"]',
  ];

  const confirmPassSelectors = [
    '#ConfirmPassword', '#confirmPassword', '#confirm_password',
    'input[name="ConfirmPassword"]', 'input[name="repassword"]',
  ];

  const submitSelectors = [
    '#applyBtn', '#submitBtn', 'input[type="submit"]',
    'button[type="submit"]', '#btnApply',
  ];

  // Type current password
  const currentPassField = await scrapeFirstMatch(page, currentPassSelectors);
  if (currentPassField) {
    await page.click(currentPassSelectors.find((s) => {
      try { return page.$(s); } catch { return false; }
    }) || currentPassSelectors[0], { clickCount: 3 });
    await page.type(currentPassSelectors[0], process.env.ROUTER_PASS);
  }

  // Type new password
  const newPassField = await scrapeFirstMatch(page, newPassSelectors);
  if (newPassField) {
    await page.click(newPassSelectors[0], { clickCount: 3 });
    await page.type(newPassSelectors[0], newPassword);
  }

  // Type confirmation
  const confirmField = await scrapeFirstMatch(page, confirmPassSelectors);
  if (confirmField) {
    await page.click(confirmPassSelectors[0], { clickCount: 3 });
    await page.type(confirmPassSelectors[0], newPassword);
  }

  // Handle confirmation dialog
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });

  // Submit
  const submitBtn = await scrapeFirstMatch(page, submitSelectors);
  if (submitBtn) {
    await page.click(submitSelectors[0]);
  } else {
    throw new Error('Submit button not found on admin password change page');
  }

  // Wait for response
  await sleep(3000);

  console.log('[automation] Admin password change submitted.');
  return 'ok';
}

/**
 * Get the router's current MAC address and IP from the ARP table.
 * Returns { mac, ip } or null if not found.
 */
function getRouterArpEntry() {
  try {
    const routerIp = process.env.ROUTER_IP;
    let output;

    if (process.platform === 'win32') {
      output = execSync('arp -a', { encoding: 'utf8', timeout: 5000 });
      // Windows format: "192.168.1.1    aa-bb-cc-dd-ee-ff    dynamic"
      const lines = output.split('\n');
      for (const line of lines) {
        const match = line.match(/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})/i);
        if (match && match[1] === routerIp) {
          return { ip: match[1], mac: match[2].replace(/-/g, ':').toUpperCase() };
        }
      }
    } else {
      // Linux: parse /proc/net/arp
      const fs = require('fs');
      if (fs.existsSync('/proc/net/arp')) {
        const lines = fs.readFileSync('/proc/net/arp', 'utf8').split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4 && parts[0] === routerIp && parts[2] !== '0x0') {
            return { ip: parts[0], mac: parts[3].toUpperCase() };
          }
        }
      }
    }
  } catch (err) {
    console.error('[automation] Failed to get ARP entry:', err.message);
  }
  return null;
}

/**
 * Resolve the router's hostname via reverse DNS.
 * Returns hostname string or null.
 */
function getRouterHostname() {
  try {
    const routerIp = process.env.ROUTER_IP;
    const output = execSync(`nslookup ${routerIp}`, { encoding: 'utf8', timeout: 3000 });
    const match = output.match(/name\s*=\s*(.+)/i);
    if (match) {
      const hostname = match[1].trim().replace(/\.$/, '');
      return hostname !== routerIp ? hostname : null;
    }
  } catch {
    // nslookup failed, try getenthosts
    try {
      const routerIp = process.env.ROUTER_IP;
      const output = execSync(`getent hosts ${routerIp}`, { encoding: 'utf8', timeout: 3000 });
      const parts = output.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] !== routerIp) {
        return parts[1];
      }
    } catch {}
  }
  return null;
}

/**
 * Test login with given credentials. Returns 'ok', 'overlay', 'locked', or 'failed'.
 */
async function testLogin(page, username, password) {
  try {
    const result = await loginRouter(page, username, password);
    return result;
  } catch {
    return 'failed';
  }
}

/**
 * Dismiss the forced password-change overlay by hiding/removing it via JS.
 * Returns true if overlay was found and removed.
 */
async function dismissOverlay(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('pwd_modify');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.remove();
      return true;
    }
    return false;
  }).catch(() => false);
}

/**
 * Scrape WiFi passwords from both 2.4G and 5G WLAN pages.
 * This is a focused scan — only extracts SSID + password for each band.
 * If the password field is masked, it clicks the "Show" checkbox first.
 *
 * @param {import('puppeteer').Page} page  Already logged-in page
 * @returns {Promise<Array<{ssid: string, password: string, band: string, encryption: string, authentication: string}>>}
 */
async function executeWifiPasswordScan(page) {
  const baseUrl = ROUTER_URL();
  const scan = selectors.networkScan;
  const results = [];

  const bands = [
    { band: '2.4G', config: scan.wlan24G },
    { band: '5G', config: scan.wlan5G },
  ];

  for (const { band, config } of bands) {
    try {
      console.log(`[wifi-scan] Navigating to ${band} WLAN page...`);
      const frame = await loadFrame(page, config.path);
      if (!frame) {
        console.log(`[wifi-scan] Could not load ${band} page, skipping.`);
        continue;
      }

      await sleep(2000);

      // Try clicking any "Show password" checkbox to unmask the value
      await frame.evaluate(() => {
        const showBtns = document.querySelectorAll(
          'input[type="checkbox"][onclick*="showKey"], ' +
          'input[type="checkbox"][onclick*="ShowKey"], ' +
          'input[type="checkbox"][onclick*="show"], ' +
          'input[type="checkbox"]#showPassword, ' +
          'input[type="checkbox"]#show_key, ' +
          '.show-password, .eye-icon, .pwd-toggle'
        );
        showBtns.forEach(btn => {
          if (!btn.checked) btn.click();
        });
      }).catch(() => {});

      await sleep(500);

      // Scrape SSID name
      let ssid = await scrapeFirstMatch(frame, config.ssidName);
      if (!ssid) {
        ssid = await frame.evaluate(() => {
          if (typeof WlanWifiArr !== 'undefined' && WlanWifiArr[0]) return WlanWifiArr[0].ssid;
          return null;
        }).catch(() => null);
      }

      // Scrape password — try value first, then textContent for unmasked fields
      let password = await scrapeFirstMatch(frame, config.ssidPassword);
      if (!password) {
        password = await frame.evaluate(() => {
          if (typeof wpaPskKey !== 'undefined' && wpaPskKey[0]) return wpaPskKey[0].value;
          return null;
        }).catch(() => null);
      }

      // If password is still empty, try reading from all password-type inputs
      if (!password) {
        password = await frame.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="password"], input[type="text"][name*="Key"], input[type="text"][name*="psk"]');
          for (const input of inputs) {
            if (input.value && input.value.length >= 8) return input.value;
          }
          return null;
        }).catch(() => null);
      }

      // Scrape encryption type
      const encryption = await frame.evaluate(() => {
        const sel = document.querySelector('select[name*="Encry"], select[name*="encry"], select#wlSecMode, select#securityMode');
        return sel ? sel.options[sel.selectedIndex]?.text?.trim() : null;
      }).catch(() => null);

      // Scrape authentication type
      const authentication = await frame.evaluate(() => {
        const sel = document.querySelector('select[name*="Auth"], select[name*="auth"], select#wlAuthMode');
        return sel ? sel.options[sel.selectedIndex]?.text?.trim() : null;
      }).catch(() => null);

      console.log(`[wifi-scan] ${band} — SSID: ${ssid}, Password: ${password ? '***' : 'N/A'}, Encryption: ${encryption || 'N/A'}`);

      results.push({
        ssid: ssid || null,
        password: password || null,
        band,
        encryption: encryption || null,
        authentication: authentication || null,
      });
    } catch (err) {
      console.error(`[wifi-scan] Failed to scan ${band}:`, err.message);
      results.push({
        ssid: null,
        password: null,
        band,
        encryption: null,
        authentication: null,
      });
    }
  }

  console.log(`[wifi-scan] Complete: ${JSON.stringify(results, null, 2)}`);
  return results;
}

/**
 * Get the currently connected WiFi SSID.
 */
function getCurrentWifiSSID() {
  try {
    const output = execSync('netsh wlan show interfaces', { encoding: 'utf8', timeout: 5000 });
    const match = output.match(/SSID\s*:\s*(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Switch WiFi network using netsh.
 * Returns true on success.
 */
function switchWifi(ssid) {
  try {
    execSync('netsh wlan disconnect', { encoding: 'utf8', timeout: 10000 });
    console.log('[wifi-switch] Disconnected from current network');
  } catch {}
  try {
    execSync(`netsh wlan connect name="${ssid}"`, { encoding: 'utf8', timeout: 15000 });
    return true;
  } catch (err) {
    console.error(`[wifi-switch] Failed to connect to ${ssid}:`, err.message);
    return false;
  }
}

/**
 * Force DHCP renewal on the Wi-Fi adapter.
 */
function renewDhcp() {
  try {
    execSync('netsh interface ip set address "Wi-Fi" dhcp', { encoding: 'utf8', timeout: 10000 });
    console.log('[dhcp] Set Wi-Fi to DHCP');
  } catch (err) {
    console.log('[dhcp] Could not set DHCP (may need admin):', err.message);
  }
}

/**
 * Diagnostic: switch to a WiFi network, try to access a URL, report results.
 *
 * @param {import('puppeteer').Page} page
 * @param {string} ssid       WiFi network name to connect to
 * @param {string} url        URL to try accessing
 * @param {number} waitMs     Time to wait after WiFi switch for DHCP
 * @returns {Object} diagnostic results
 */
async function diagnoseNetwork(page, ssid, url, waitMs = 10000) {
  const result = {
    original_ssid: getCurrentWifiSSID(),
    target_ssid: ssid,
    target_url: url,
    wifi_connected: false,
    ip_address: null,
    url_reachable: false,
    page_title: null,
    page_content_snippet: null,
    error: null,
  };

  // Step 1: Switch WiFi
  console.log(`[diagnose] Switching from "${result.original_ssid}" to "${ssid}"...`);
  const switched = switchWifi(ssid);
  if (!switched) {
    result.error = 'Failed to initiate WiFi switch';
    return result;
  }

  // Step 2: Force DHCP and wait
  renewDhcp();
  console.log(`[diagnose] Waiting ${waitMs / 1000}s for connection...`);
  await sleep(waitMs);

  // Step 3: Check connection — poll a few times
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const ipOutput = execSync('ipconfig', { encoding: 'utf8', timeout: 5000 });
      const ipMatch = ipOutput.match(/Wireless LAN adapter Wi-Fi:[\s\S]*?IPv4 Address.*?:\s*([\d.]+)/);
      result.ip_address = ipMatch ? ipMatch[1] : null;
      result.wifi_connected = result.ip_address && !result.ip_address.startsWith('169.254');
      if (result.wifi_connected) break;
    } catch (err) {
      result.error = `ipconfig failed: ${err.message}`;
    }
    if (attempt < 3) {
      console.log(`[diagnose] Attempt ${attempt}: no valid IP yet, waiting 5s...`);
      await sleep(5000);
    }
  }

  console.log(`[diagnose] WiFi connected: ${result.wifi_connected}, IP: ${result.ip_address}`);

  // Step 4: Try to access URL
  if (result.wifi_connected) {
    try {
      console.log(`[diagnose] Navigating to ${url}...`);
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
        ignoreHTTPSErrors: true,
      });

      result.url_reachable = response ? response.ok() : false;
      result.page_title = await page.title().catch(() => null);
      result.page_content_snippet = await page.evaluate(() => {
        return document.body ? document.body.innerText.substring(0, 500) : null;
      }).catch(() => null);

      console.log(`[diagnose] URL reachable: ${result.url_reachable}, title: ${result.page_title}`);
    } catch (err) {
      result.error = `Navigation failed: ${err.message}`;
      console.error(`[diagnose] Navigation error:`, err.message);
    }
  } else {
    result.error = result.error || 'Not connected to WiFi — no valid IP address';
  }

  // Step 5: Switch back to original WiFi
  if (result.original_ssid && result.original_ssid !== ssid) {
    console.log(`[diagnose] Switching back to "${result.original_ssid}"...`);
    switchWifi(result.original_ssid);
    renewDhcp();
    await sleep(8000);
  }

  console.log(`[diagnose] Results:`, JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  loginRouter,
  isLoggedIn,
  executeRouterReboot,
  executePasswordChange,
  executePasswordChangeViaOverlay,
  executeAdminPasswordChange,
  executeNetworkScan,
  executeWifiPasswordScan,
  injectOverlayBypass,
  dismissOverlay,
  getCurrentWifiSSID,
  switchWifi,
  diagnoseNetwork,
  getRouterArpEntry,
  getRouterHostname,
  testLogin,
};
