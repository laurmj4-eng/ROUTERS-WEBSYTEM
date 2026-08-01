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

  async function enableSSIDBroadcast(label, path) {
    console.log(`\n[${label}] Navigating to ${path}...`);
    await p.goto(`${ROUTER}/${path}`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
    await sleep(3000);

    // Verify current state via JS variables
    const before = await p.evaluate(() => ({
      enable: window.WlanWifiArr?.[0]?.enable,
      ssid: window.WlanWifiArr?.[0]?.ssid,
      channel: window.WlanWifiArr?.[0]?.channel,
      autoChannel: window.WlanWifiArr?.[0]?.AutoChannelEnable,
      power: window.WlanWifiArr?.[0]?.power,
    })).catch(() => ({}));
    console.log(`[${label}] JS state before:`, JSON.stringify(before));

    // Ensure SSID is NOT hidden (uncheck wlHide), radio enabled, SSID set
    await p.evaluate(() => {
      const hide = document.getElementById('wlHide');
      if (hide) { hide.checked = false; hide.dispatchEvent(new Event('change', {bubbles: true})); }

      const enbl = document.getElementById('wlEnbl');
      if (enbl && !enbl.checked) { enbl.checked = true; enbl.dispatchEvent(new Event('change', {bubbles: true})); }

      const enable = document.getElementById('wlEnable');
      if (enable && !enable.checked) { enable.checked = true; enable.dispatchEvent(new Event('change', {bubbles: true})); }
    });

    console.log(`[${label}] Calling ApplySubmit()...`);
    await p.evaluate(() => { ApplySubmit(); });
    console.log(`[${label}] ApplySubmit() called, waiting 10s...`);
    await sleep(10000);

    const afterUrl = p.url().substring(0, 80);
    console.log(`[${label}] After submit URL: ${afterUrl}`);
  }

  await enableSSIDBroadcast('2.4G', 'html/amp/wlanbasic/WlanBasic.asp?2G');
  await enableSSIDBroadcast('5G', 'html/amp/wlanbasic/WlanBasic.asp?5G');

  console.log('\n[Done] Settings saved via ApplySubmit(). Wait 60s, then scan for WiFi.');
  console.log('[Done] SSID: PLDTHOMEFIBRfA6zd | Password: PLDTWIFIEfZd8');

  await sleep(5000);
  await b.close();
})();
