#!/usr/bin/env node
/**
 * adminpldt (PLDT2 superadmin) WiFi Scan CLI
 *
 * Different workflow from the `admin` account:
 *  - Login via /admin.html (NOT login.asp)
 *  - Keep the real CheckPassword (correct flow) — only override setDisable
 *  - On success the forced password-change overlay (pwd_modify/base_mask) appears
 *  - SKIP the overlay (hide it), then read 2.4G/5G SSID + password from WlanBasic
 *
 * Usage:
 *   node adminpldt_scan.js --username adminpldt --password AC2... [--router-ip 192.168.1.1]
 *
 * Output: a single JSON line on stdout:
 *   {"wifi":[{"band":"2.4G","ssid":"...","password":"...",...}, ...]}
 */

const puppeteer = require('puppeteer');

function parseArgs() {
  const args = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    const m = /^--([\w-]+)(?:=(.*))?$/.exec(raw[i]);
    if (m) args[m[1]] = m[2] !== undefined ? m[2] : raw[++i];
  }
  return args;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killChrome(browser) {
  try {
    const pid = browser.process()?.pid;
    if (pid) {
      require('child_process').execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
    }
  } catch (e) { /* already gone */ }
}

// Keep the real CheckPassword; only make the login button work
const SET_DISABLE_BYPASS = () => {
  window.setDisable = () => {};
};

const SKIP_OVERLAY = () => {
  const overlay = document.getElementById('pwd_modify');
  if (overlay) overlay.style.display = 'none';
  const mask = document.getElementById('base_mask');
  if (mask) mask.style.display = 'none';
};

async function readBand(page, band, index, routerIp) {
  const path = band === '2.4G' ? '2G' : '5G';
  await page.goto(`https://${routerIp}/html/amp/wlanbasic/WlanBasic.asp?${path}`, {
    waitUntil: 'domcontentloaded',
    ignoreHTTPSErrors: true,
  });
  await sleep(2500);

  return page.evaluate((idx) => {
    const ssidEl = idx === 0
      ? document.querySelector('#wlSsid') || document.querySelector('#txt_ssidname')
      : document.querySelector('#txt_ssidname5g') || document.querySelector('#txt_ssidname');
    const passEl = idx === 0
      ? document.querySelector('#wlWpaPsk') || document.querySelector('#twlWpaPsk')
      : document.querySelector('#txt_ssidpassword5g') || document.querySelector('#txt_ssidpassword');
    const jsSsid = typeof WlanWifiArr !== 'undefined' && WlanWifiArr[idx] ? WlanWifiArr[idx].ssid : null;
    const jsPass = typeof wpaPskKey !== 'undefined' && wpaPskKey[idx] ? wpaPskKey[idx].value : null;
    return {
      ssid: ssidEl ? ssidEl.value : jsSsid,
      password: passEl ? passEl.value : jsPass,
    };
  }, index).catch(() => ({ ssid: null, password: null }));
}

(async () => {
  const args = parseArgs();
  const username = args.username || 'adminpldt';
  const password = args.password || 'AC2DIU7QW3ERTY6UPAS4DFG';
  const routerIp = args['router-ip'] || '192.168.1.1';

  const result = { wifi: [] };
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors'],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);

    // 1. Login via admin.html — the correct entry for the adminpldt (PLDT2) account
    await page.goto(`https://${routerIp}/admin.html`, {
      waitUntil: 'domcontentloaded',
      ignoreHTTPSErrors: true,
    });
    await sleep(2500);

    // 2. Only override setDisable — keep the REAL CheckPassword
    await page.evaluate(SET_DISABLE_BYPASS);

    // 3. Login
    await page.type('input#txt_Username', username);
    await page.type('input#txt_Password', password);
    await page.click('button#button');
    await sleep(5000);

    const loginState = await page.evaluate(() => ({
      userlevel: (() => { try { return String(window.Userlevel); } catch (e) { return 'err'; } })(),
      hasOverlay: !!document.getElementById('pwd_modify'),
      hasLoginForm: !!document.getElementById('txt_Username'),
    })).catch(() => ({ userlevel: 'err', hasOverlay: false, hasLoginForm: true }));

    if (!loginState.hasOverlay || loginState.userlevel !== '2') {
      result.error = `Login failed — Userlevel=${loginState.userlevel}, overlay=${loginState.hasOverlay}`;
      console.log(JSON.stringify(result));
      return;
    }

    // 4. Login OK — SKIP the forced password-change overlay
    await page.evaluate(SKIP_OVERLAY);
    await page.evaluate(SET_DISABLE_BYPASS).catch(() => {});
    await sleep(500);

    // 5. Read both bands
    for (const [band, idx] of [['2.4G', 0], ['5G', 1]]) {
      const data = await readBand(page, band, idx, routerIp);
      result.wifi.push({
        band,
        ssid: data.ssid,
        password: data.password,
        encryption: 'AES',
        authentication: 'WPA2 PreSharedKey',
      });
    }
  } catch (err) {
    result.error = err.message;
  } finally {
    if (browser) {
      killChrome(browser);
      await browser.close().catch(() => {});
    }
  }

  console.log(JSON.stringify(result));
  process.exit(0);
})();
