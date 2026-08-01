const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});

  // Fresh incognito context to avoid cached session
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();

  // Capture XHR responses
  p.on('response', async res => {
    const url = res.url();
    if (url.includes('get_wifi') || url.includes('set_wifi') || url.includes('bandSteering') || url.includes('ssid_pwd')) {
      try {
        const txt = await res.text().catch(() => '');
        if (txt.length > 5) console.log(`\n>>> XHR: ${url.substring(0, 80)}\n${txt.substring(0, 1500)}`);
      } catch(e) {}
    }
  });

  // Navigate directly to the PLDT login page
  console.log('1. Loading PLDT login page...');
  await p.goto(`${ROUTER}/html/login_pldt.html`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 10000}).catch(e => console.log(`   Nav: ${e.message.substring(0, 60)}`));
  await sleep(3000);
  console.log('   URL:', p.url().substring(0, 80));

  // If redirect to root, check if already logged in
  if (p.url() === `${ROUTER}/` || p.url() === `${ROUTER}`) {
    console.log('   At root page - already logged in or redirected');
    const overlay = await p.evaluate(() => document.getElementById('pwd_modify')?.style?.display !== 'none');
    console.log('   pwd_modify visible:', overlay);
  } else {
    // Login via the PLDT login page fields
    console.log('2. Logging in with admin:1234...');
    await p.type('input#txt_Username', 'admin');
    await p.type('input#txt_Password', '1234');
    await p.click('button#button');
    await sleep(5000);
    console.log('   Post-login URL:', p.url().substring(0, 80));
  }

  // Try XHR API calls directly via fetch
  console.log('\n3. Calling XHR API endpoints...');
  const endpoints = [
    'get_wifi_status',
    'get_wifi_status_5G',
    'get_bandSteering_wlan',
    'get_ssid_pwd',
  ];

  for (const ep of endpoints) {
    try {
      const response = await p.evaluate(async (endpoint) => {
        const r = await fetch('/' + endpoint, {credentials: 'include'});
        const txt = await r.text();
        return {status: r.status, data: txt.substring(0, 2000)};
      }, ep);
      console.log(`\n${ep} (HTTP ${response.status}):`);
      if (response.status === 200) {
        console.log(response.data);
      } else {
        console.log(`   Failed - status ${response.status}`);
      }
    } catch(e) {
      console.log(`\n${ep}: Error - ${e.message.substring(0, 60)}`);
    }
  }

  // If XHR endpoints work, try to get/set WiFi radio state
  // Look for the XHR object on page
  const hasXhrUtil = await p.evaluate(() => {
    return {
      hasXHR: typeof XHR !== 'undefined',
      hasXHRSync: typeof XHR !== 'undefined' && typeof XHR.get !== 'undefined',
    };
  }).catch(() => ({}));
  console.log('\nXHR utility:', JSON.stringify(hasXhrUtil));

  if (hasXhrUtil.hasXHR) {
    console.log('\n4. Trying XHR.get for WiFi status...');
    const result = await p.evaluate(async () => {
      return new Promise((resolve) => {
        XHR.get('get_wifi_status', null, (d) => resolve(JSON.stringify(d)), 'text');
        setTimeout(() => resolve('timeout'), 5000);
      });
    }).catch(e => `Error: ${e.message}`);
    console.log('   Result:', result?.substring(0, 2000));
  }

  await sleep(5000);
  await ctx.close();
  await b.close();
})();
