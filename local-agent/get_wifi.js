const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  console.log('1. Navigating to login page...');
  await p.goto(`${ROUTER}/login.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);

  // JS Injection: bypass the forced password change overlay
  console.log('2. Injecting JS overlay bypass...');
  await p.evaluate(() => {
    window.CheckPassword = () => 0;
    window.setDisable = () => {};
    window.DisplayWifiPldt = () => {};
    window.BandSteeringState = () => {};
    window.LockLeftTime = 0;
    window.FailStat = '0';
    window.LoginTimes = 0;
  });

  console.log('3. Logging in with admin:1234...');
  await p.type('input#txt_Username', 'admin');
  await p.type('input#txt_Password', '1234');
  await p.click('button#button');
  await sleep(5000);
  console.log('   Post-login URL:', p.url());

  console.log('4. Navigating to 2.4G WiFi settings...');
  await p.goto(`${ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);
  console.log('   2.4G page URL:', p.url());

  // Extract 2.4G SSID and password from page DOM
  const wifi24 = await p.evaluate(() => {
    const ssid = document.querySelector('#wlSsid') || document.querySelector('#txt_ssidname');
    const pass = document.querySelector('#wlWpaPsk') || document.querySelector('#twlWpaPsk');
    const jsSsid = typeof WlanWifiArr !== 'undefined' && WlanWifiArr[0] ? WlanWifiArr[0].ssid : null;
    const jsPass = typeof wpaPskKey !== 'undefined' && wpaPskKey[0] ? wpaPskKey[0].value : null;
    return {
      ssid: ssid ? ssid.value : jsSsid,
      password: pass ? pass.value : jsPass
    };
  }).catch(() => ({ssid: null, password: null}));
  console.log('   2.4G ->', JSON.stringify(wifi24));

  console.log('5. Navigating to 5G WiFi settings...');
  await p.goto(`${ROUTER}/html/amp/wlanbasic/WlanBasic.asp?5G`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);
  console.log('   5G page URL:', p.url());

  const wifi5 = await p.evaluate(() => {
    const ssid = document.querySelector('#txt_ssidname5g') || document.querySelector('#txt_ssidname');
    const pass = document.querySelector('#txt_ssidpassword5g') || document.querySelector('#txt_ssidpassword');
    const jsSsid = typeof WlanWifiArr !== 'undefined' && WlanWifiArr.length > 1 && WlanWifiArr[1] ? WlanWifiArr[1].ssid : null;
    const jsPass = typeof wpaPskKey !== 'undefined' && wpaPskKey.length > 1 && wpaPskKey[1] ? wpaPskKey[1].value : null;
    return {
      ssid: ssid ? ssid.value : jsSsid,
      password: pass ? pass.value : jsPass
    };
  }).catch(() => ({ssid: null, password: null}));
  console.log('   5G ->', JSON.stringify(wifi5));

  console.log('\n========== WIFI CREDENTIALS ==========');
  console.log(`  2.4G SSID:     ${wifi24.ssid || '(not found)'}`);
  console.log(`  2.4G Password: ${wifi24.password || '(not found)'}`);
  console.log(`  5G   SSID:     ${wifi5.ssid || '(not found)'}`);
  console.log(`  5G   Password: ${wifi5.password || '(not found)'}`);
  console.log('======================================\n');
  console.log('Read-only: no passwords were changed.');

  await sleep(5000);
  await b.close();
})();
