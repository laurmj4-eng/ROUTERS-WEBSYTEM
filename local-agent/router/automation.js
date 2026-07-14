const selectors = require('./selectors');

const ROUTER_URL = () => `http://${process.env.ROUTER_IP}`;

/**
 * Wait helper — resolves after ms milliseconds.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
async function loginRouter(page) {
  await page.goto(`${ROUTER_URL()}/login.asp`, {
    waitUntil: 'networkidle0',
    timeout: 15000,
  });

  // The login button starts hidden; LoadFrame() sets display:''
  await page.waitForSelector(selectors.login.loginButton, {
    visible: true,
    timeout: 10000,
  });

  // Check for lockout before attempting login
  if (await isLockedOut(page)) {
    throw new Error('Router is locked out — too many failed attempts.');
  }

  await page.type(selectors.login.username, process.env.ROUTER_USER);
  await page.type(selectors.login.password, process.env.ROUTER_PASS);

  // Click login and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
    page.click(selectors.login.loginButton),
  ]);

  // After login the router may show the forced password-change overlay
  // (happens when CfgMode is PLDT2 and the current password is the default).
  if (await isPasswordChangeOverlayVisible(page)) {
    return 'overlay';
  }

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

  // Attempt 1: navigate directly to the known reboot path
  try {
    await page.goto(`${baseUrl}${selectors.postLogin.reboot}`, {
      waitUntil: 'networkidle0',
      timeout: 10000,
    });

    // Wait for the page content to settle
    await sleep(2000);

    // Look for a reboot confirmation button — common Huawei patterns:
    //   <input type="button" value="Reboot" onclick="..." />
    //   <button id="reboot_btn" ...>Reboot</button>
    const rebootBtn = await page.$('input[value="Reboot"], input[value="Restart"], button[onclick*="eboot"], input[onclick*="eboot"]');

    if (rebootBtn) {
      await rebootBtn.click();
      await sleep(1000);

      // Handle confirmation dialog if one appears
      page.once('dialog', (dialog) => dialog.accept());

      // Wait for the router to acknowledge (page may freeze during reboot)
      await sleep(3000);
      console.log('[automation] Reboot command sent successfully.');
      return;
    }
  } catch (err) {
    console.log('[automation] Direct reboot page navigation failed, trying frame-based approach...');
  }

  // Attempt 2: navigate the frame-based admin panel
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 10000 });
    await sleep(2000);

    // The Huawei admin panel loads content in frames; try to find the main frame
    const frames = page.frames();
    for (const frame of frames) {
      const url = frame.url();
      if (url.includes('index.asp') || url.includes('main.asp') || url.includes('menu.asp')) {
        // Look for "System Tools" or similar in the frame
        const systemToolsLink = await frame.$('a[href*="management"], a:has-text("System Tools"), a:has-text("Maintenance")');
        if (systemToolsLink) {
          await systemToolsLink.click();
          await sleep(2000);

          const rebootLink = await frame.$('a[href*="reboot"], a:has-text("Reboot"), a:has-text("Restart")');
          if (rebootLink) {
            await rebootLink.click();
            await sleep(2000);

            const confirmBtn = await frame.$('input[value="Reboot"], input[value="OK"], button[onclick*="eboot"]');
            if (confirmBtn) {
              page.once('dialog', (dialog) => dialog.accept());
              await confirmBtn.click();
              await sleep(3000);
              console.log('[automation] Reboot command sent via frame navigation.');
              return;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[automation] Frame-based reboot failed:', err.message);
  }

  throw new Error('Could not locate reboot button. Provide the post-login HTML for exact selectors.');
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

  // Click Update → calls SubmitUpdate() → POSTs to MdfPwdAdminNoLg.cgi
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {}),
    page.click(s.updateButton),
  ]);

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

  // If the overlay is visible, use it directly
  if (await isPasswordChangeOverlayVisible(page)) {
    await executePasswordChangeViaOverlay(page, newPassword, currentPass);
    return;
  }

  // Otherwise, navigate to WLAN settings post-login
  const baseUrl = ROUTER_URL();
  try {
    // Try direct path to 2.4G WLAN settings
    await page.goto(`${baseUrl}${selectors.postLogin.wlan24G}`, {
      waitUntil: 'networkidle0',
      timeout: 10000,
    });
    await sleep(2000);

    // Look for PreSharedKey / password field on the WLAN page
    const pskField = await page.$('input[name*="PreSharedKey"], input[name*="KeyPassphrase"], input[type="password"][id*="password"], input[name*="psk"]');
    if (pskField) {
      // Clear existing value and type new password
      await pskField.click({ clickCount: 3 });
      await pskField.type(newPassword);

      // Look for Save/Apply button
      const saveBtn = await page.$('input[value="Apply"], input[value="Save"], button[onclick*="ubmit"], input[type="submit"]');
      if (saveBtn) {
        page.once('dialog', (dialog) => dialog.accept());
        await saveBtn.click();
        await sleep(3000);
        console.log('[automation] WiFi password changed via WLAN settings page.');
        return;
      }
    }
  } catch (err) {
    console.error('[automation] WLAN settings page navigation failed:', err.message);
  }

  throw new Error('Could not complete WiFi password change. Provide post-login HTML for exact selectors.');
}

module.exports = {
  loginRouter,
  executeRouterReboot,
  executePasswordChange,
};
