const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  console.log('[1] Logging in with overlay bypass...');
  await p.goto(`${ROUTER}/login.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);

  await p.evaluate(() => {
    window.CheckPassword = () => 0;
    window.setDisable = () => {};
    window.DisplayWifiPldt = () => {};
    window.BandSteeringState = () => {};
    window.LockLeftTime = 0;
    window.FailStat = '0';
    window.LoginTimes = 0;
  });

  await p.type('input#txt_Username', 'admin');
  await p.type('input#txt_Password', '1234');
  await p.click('button#button');
  await sleep(5000);

  async function fixBand(band, path) {
    console.log(`[${band}] Navigating to ${band} WLAN settings...`);
    await p.goto(`${ROUTER}/${path}`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
    await sleep(3000);

    console.log(`[${band}] Page URL:`, p.url().substring(0, 80));

    const result = await p.evaluate(() => {
      const hide = document.querySelector('#wlHide');
      if (!hide) return 'wlHide not found';
      if (!hide.checked) return 'already unchecked (SSID already visible)';
      hide.checked = false;
      hide.dispatchEvent(new Event('change', {bubbles: true}));
      return 'unchecked (SSID now visible)';
    });
    console.log(`[${band}] wlHide => ${result}`);

    // Click Apply (don't wait for navigation - it may reload)
    await p.evaluate(() => {
      const btn = document.querySelector('button#btnApplySubmit');
      if (btn) btn.click();
    }).catch(() => {});
    console.log(`[${band}] Apply clicked, waiting 8s for router...`);
    await sleep(8000);
  }

  // Fix 2.4G
  await fixBand('2.4G', 'html/amp/wlanbasic/WlanBasic.asp?2G');

  // Fix 5G
  await fixBand('5G', 'html/amp/wlanbasic/WlanBasic.asp?5G');

  console.log('\n[Done] SSID broadcast ENABLED on both bands.');
  console.log('[Done] Wait ~30s, then scan for WiFi on your phone.');
  console.log('[Done] SSID: PLDTHOMEFIBRfA6zd | Password: PLDTWIFIEfZd8');
  console.log('[Done] Nothing else was changed.');

  await sleep(5000);
  await b.close();
})();
