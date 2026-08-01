const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  console.log('[1] Logging in...');
  await p.goto(`${ROUTER}/login.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);
  await p.evaluate(() => {
    window.CheckPassword = () => 0; window.setDisable = () => {}; window.DisplayWifiPldt = () => {}; window.BandSteeringState = () => {}; window.LockLeftTime = 0; window.FailStat = '0'; window.LoginTimes = 0;
  });
  await p.type('input#txt_Username', 'admin');
  await p.type('input#txt_Password', '1234');
  await p.click('button#button');
  await sleep(5000);

  async function fixBand(label, path) {
    console.log(`\n[${label}] Loading page...`);
    await p.goto(`${ROUTER}/${path}`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
    await sleep(3000);

    // Read the hwonttoken for authenticated request
    const state = await p.evaluate(() => {
      const token = document.getElementById('hwonttoken')?.value || '';
      const enable = document.getElementById('wlEnbl');
      const hide = document.getElementById('wlHide');
      const ssid = document.getElementById('wlSsid1');
      return {
        token,
        enblChecked: enable ? enable.checked : null,
        hideChecked: hide ? hide.checked : null,
        ssid: ssid ? ssid.value : null,
        path: window.location.pathname + window.location.search,
        html: document.body?.innerHTML?.substring(0, 500) || ''
      };
    }).catch(() => ({}));

    console.log(`[${label}] Token: ${state.token?.substring(0, 20)}...`);
    console.log(`[${label}] wlEnbl: ${state.enblChecked}, wlHide: ${state.hideChecked}, SSID: ${state.ssid}`);

    // Use the router's set.cgi endpoint directly with proper form data
    const formData = new URLSearchParams();
    if (path.includes('?2G') || label === '2.4G') {
      formData.append('wlEnbl', 'ON');
      formData.append('wlEnable', 'ON');
      formData.append('wlSsid1', 'PLDTHOMEFIBRfA6zd');
      formData.append('wlHide', '');
      formData.append('wlAuthMode', 'wpa2-psk');
      formData.append('wlEncryption', 'AESEncryption');
      formData.append('wlWpaPsk', 'PLDTWIFIEfZd8');
      formData.append('X_HW_Token', state.token);
      formData.append('wlEnbl', 'ON');
    } else {
      formData.append('wlEnbl', 'ON');
      formData.append('wlEnable', 'ON');
      formData.append('wlSsid1', 'PLDTHOMEFIBRfA6zd');
      formData.append('wlHide', '');
      formData.append('wlAuthMode', 'wpa2-psk');
      formData.append('wlEncryption', 'AESEncryption');
      formData.append('wlWpaPsk', 'PLDTWIFIEfZd8');
      formData.append('X_HW_Token', state.token);
    }

    console.log(`[${label}] POSTing to set.cgi...`);
    try {
      const response = await p.evaluate(async (fd) => {
        const r = await fetch('/html/amp/wlanbasic/set.cgi', {
          method: 'POST',
          headers: {'Content-Type': 'application/x-www-form-urlencoded'},
          body: fd,
          credentials: 'include'
        });
        return {ok: r.ok, status: r.status, text: (await r.text()).substring(0, 500)};
      }, formData.toString());
      console.log(`[${label}] Response:`, JSON.stringify(response));
    } catch (err) {
      console.log(`[${label}] Fetch error:`, err.message.substring(0, 100));
    }

    await sleep(3000);
  }

  await fixBand('2.4G', 'html/amp/wlanbasic/WlanBasic.asp?2G');
  await fixBand('5G', 'html/amp/wlanbasic/WlanBasic.asp?5G');

  // Reboot the router to apply changes
  console.log('\n[3] Navigating to reboot page...');
  await p.goto(`${ROUTER}/html/ssmp/management/reboot.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(3000);
  console.log('   Reboot page URL:', p.url().substring(0, 80));

  const rebootBtn = await p.$('input[value="Reboot"], input[value="Restart"], button[onclick*="eboot"]').catch(() => null);
  if (rebootBtn) {
    console.log('   Found reboot button, clicking...');
    p.once('dialog', d => d.accept()).catch(() => {});
    await rebootBtn.click().catch(() => {});
    console.log('   Reboot command sent. Router will restart in ~2-3 minutes.');
    console.log('   After reboot, WiFi should be broadcasting.');
    await sleep(5000);
  } else {
    console.log('   No reboot button found. Please manually reboot the router.');
  }

  console.log('\n[Done] WiFi settings saved + reboot initiated.');
  console.log('[Done] Wait 3-5 minutes, then scan for PLDTHOMEFIBRfA6zd');
  console.log('[Done] Password: PLDTWIFIEfZd8');

  await sleep(3000);
  await b.close();
})();
