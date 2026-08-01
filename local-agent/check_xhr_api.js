const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  console.log('Logging in via login.asp...');
  await p.goto(`${ROUTER}/login.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);
  await p.evaluate(() => { window.CheckPassword = () => 0; window.setDisable = () => {}; window.DisplayWifiPldt = () => {}; window.BandSteeringState = () => {}; window.LockLeftTime = 0; window.FailStat = '0'; window.LoginTimes = 0; });
  await p.type('input#txt_Username', 'admin');
  await p.type('input#txt_Password', '1234');
  await p.click('button#button');
  await sleep(5000);

  // Intercept XHR responses to see what endpoints are available
  const xhrResponses = [];
  p.on('response', async res => {
    const url = res.url();
    if (url.includes('get_') || url.includes('set_') || url.includes('wifi') || url.includes('WLAN') || url.includes('wlan')) {
      try {
        const txt = await res.text().catch(() => '');
        if (txt.length > 10 && txt.length < 5000) {
          xhrResponses.push({url: url.substring(0, 100), data: txt.substring(0, 800)});
        }
      } catch(e) {}
    }
  });

  // Navigate to the WLAN page to trigger XHR calls
  console.log('Navigating to WLAN page to capture API calls...');
  await p.goto(`${ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G`, {waitUntil: 'networkidle0', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(5000);

  console.log(`\nCaptured ${xhrResponses.length} XHR responses:`);
  xhrResponses.forEach(r => console.log(`\n${r.url}\n${r.data.substring(0, 500)}`));

  // Now try calling XHR endpoints directly
  console.log('\n\n--- Direct XHR API calls ---');
  const endpoints = [
    'get_wifi_status',
    'get_wifi_status_5G', 
    'get_bandSteering_wlan',
    'get_ssid_pwd',
    'get_login_user',
  ];

  for (const ep of endpoints) {
    try {
      const result = await p.evaluate(async (endpoint) => {
        const r = await fetch('/' + endpoint, {credentials: 'include'});
        if (r.ok) return await r.text();
        return `HTTP ${r.status}`;
      }, ep);
      console.log(`\n${ep}: ${result.substring(0, 1000)}`);
    } catch(e) {
      console.log(`\n${ep}: Error - ${e.message.substring(0, 80)}`);
    }
  }

  // Also check if there's a navigator.sendBeacon or XHR object on page
  const pageXhr = await p.evaluate(() => {
    const hasXhr = typeof XHR !== 'undefined';
    const hasJquery = typeof $ !== 'undefined';
    return {hasXhr, hasJquery, url: window.location.href.substring(0, 80)};
  }).catch(() => ({}));
  console.log('\nPage context:', JSON.stringify(pageXhr));

  await sleep(3000);
  await b.close();
})();
