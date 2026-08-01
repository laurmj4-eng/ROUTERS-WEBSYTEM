const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  // Login
  await p.goto(ROUTER + '/html/login_pldt.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => {
    window.CheckPassword = () => 0;
    document.getElementById('user_name').value = 'admin';
    document.getElementById('loginpp').value = '1234';
  });
  await sleep(500);
  await p.evaluate(() => document.getElementById('login_btn').click());
  await sleep(3000);

  // Query multiple endpoints for full diagnosis
  const endpoints = {
    bandSteering: 'get_bandSteering_wlan',
    wifi2g: 'get_wifi_status',
    wifi5g: 'get_wifi_status_5G',
  };

  const results = {};
  for (const [key, ep] of Object.entries(endpoints)) {
    results[key] = await p.evaluate(async (endpoint) => {
      return new Promise((resolve) => {
        XHR.get(endpoint, null, (d) => resolve(d));
        setTimeout(() => resolve({error: 'timeout'}), 5000);
      });
    }, ep);
  }

  // Decrypt using page's built-in fhdecrypt
  const decrypted = await p.evaluate(() => {
    if (typeof fhdecrypt === 'undefined') return {error: 'fhdecrypt not available'};
    return {
      ssid2g: fhdecrypt('3C6397D3597E39AF24D941A31E28217548435357063A7EC1146928959F4C86BF'),
      psk2g: fhdecrypt('740A43B6F50929A77420BA8F2183784A'),
      ssid5g: fhdecrypt('3C6397D3597E39AF24D941A31E28217548435357063A7EC1146928959F4C86BF'),
      psk5g: fhdecrypt('740A43B6F50929A77420BA8F2183784A'),
    };
  });

  console.log('\n=== WiFi Status ===');
  console.log(`SSID: ${decrypted.ssid2g}`);
  console.log(`WiFi Password: ${decrypted.psk2g}`);
  console.log(`SSID Hidden: ${results.bandSteering?.bandSteering?.X_FH_SSIDHide === '1' ? 'YES (devices cannot see it)' : 'NO'}`);
  console.log(`Encryption: ${results.bandSteering?.bandSteering?.WPAEncryptionModes}`);
  console.log(`Band Steering: ${results.bandSteering?.bandSteering?.X_FH_BandSteeringEnable === '1' ? 'Enabled' : 'Disabled'}`);

  // Check for MAC filtering
  console.log('\n=== Client Info ===');
  if (results.wifi2g?.wifi_status) {
    for (const ap of results.wifi2g.wifi_status) {
      const ssidDec = (typeof fhdecrypt === 'function') ? '?' : '?';
      console.log(`AP: ${ap.Enable === '1' ? 'Enabled' : 'Disabled'} BSSID: ${ap.BSSID} Clients: ${ap.TotalPacketsReceived || '?'}`);
    }
  }

  await b.close();
})();
