const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  // Login as admin:1234
  await p.goto(ROUTER + '/html/login_pldt.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => {
    window.CheckPassword = () => 0;
    document.getElementById('user_name').value = 'admin';
    document.getElementById('loginpp').value = '1234';
  });
  await sleep(500);
  await p.evaluate(() => document.getElementById('login_btn').click());
  await sleep(5000);

  console.log('Logged in. URL:', p.url());

  // Query all known XHR endpoints via the page's XHR utility
  const endpoints = [
    'get_bandSteering_wlan',
    'get_wifi_status',
    'get_wifi_status_5G',
    'get_login_user',
    'get_ssid_pwd',
    'get_device_info',
    'getAllConfigInfo',
    'wifi_get_security',
    'get_wifi_basic_info',
    'get_wifi_advance_info',
    'get_wifi_mac_filter',
  ];

  for (const ep of endpoints) {
    const result = await p.evaluate(async (endpoint) => {
      try {
        if (typeof XHR !== 'undefined' && XHR.get) {
          const data = await new Promise((resolve, reject) => {
            XHR.get(endpoint, null, (d) => resolve(d), 'text');
            setTimeout(() => resolve({error: 'timeout'}), 5000);
          });
          return {method: 'XHR.get', data: JSON.stringify(data).substring(0, 2000)};
        }
      } catch(e) {
        return {error: e.message};
      }
      return {error: 'XHR not available'};
    }, ep);
    console.log(`\n${ep}:`);
    console.log(result.data || JSON.stringify(result));
  }

  await b.close();
})();
