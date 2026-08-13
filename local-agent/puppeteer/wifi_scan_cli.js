#!/usr/bin/env node
/**
 * WiFi Password Scan CLI
 *
 * Logs into a Huawei/PLDT router, injects JS bypasses to skip the forced
 * password-change overlay, then reads the current 2.4G and 5G WiFi SSID +
 * password straight from the WlanBasic pages.
 *
 * Usage:
 *   node wifi_scan_cli.js --username admin --password 1234 [--router-ip 192.168.1.1]
 *
 * Output: a single JSON line on stdout:
 *   {"wifi":[{"band":"2.4G","ssid":"...","password":"...","encryption":"AES","authentication":"WPA2 PreSharedKey"}, ...]}
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

const INJECT_BYPASS = () => {
  window.CheckPassword = () => 0;
  window.setDisable = () => {};
  window.DisplayWifiPldt = () => {};
  window.BandSteeringState = () => {};
  window.LockLeftTime = 0;
  window.FailStat = '0';
  window.LoginTimes = 0;
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
  const username = args.username || 'admin';
  const password = args.password || '1234';
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

    // 1. Login page
    await page.goto(`https://${routerIp}/login.asp`, {
      waitUntil: 'domcontentloaded',
      ignoreHTTPSErrors: true,
    });
    await sleep(2500);

    // 2. Inject overlay bypass before submitting
    await page.evaluate(INJECT_BYPASS);

    // 3. Login
    await page.type('input#txt_Username', username);
    await page.type('input#txt_Password', password);
    await page.click('button#button');
    await sleep(5000);

    const postLoginUrl = page.url();
    const loginState = await page.evaluate(() => ({
      hasOverlay: !!document.getElementById('pwd_modify'),
      loginFail: (() => { const el = document.getElementById('loginfail'); return !!el && el.style.display !== 'none'; })(),
    })).catch(() => ({ hasOverlay: false, loginFail: false }));

    if (loginState.loginFail) {
      result.error = 'Invalid username or password';
      console.log(JSON.stringify(result));
      return;
    }

    if (!loginState.hasOverlay && /login\.asp|login\.cgi/i.test(postLoginUrl)) {
      result.error = 'Login failed — still on login page';
      console.log(JSON.stringify(result));
      return;
    }

    // Successful login shows the forced password-change popup (pwd_modify) —
    // hide it via JS injection and re-inject the bypasses
    await page.evaluate(() => {
      const overlay = document.getElementById('pwd_modify');
      if (overlay) overlay.style.display = 'none';
      const mask = document.getElementById('base_mask');
      if (mask) mask.style.display = 'none';
    });
    await page.evaluate(INJECT_BYPASS).catch(() => {});
    await sleep(500);

    // 4. Read both bands
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
