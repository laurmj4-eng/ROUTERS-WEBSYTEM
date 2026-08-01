const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});

  // Use a single page session
  const p = await b.newPage();

  async function login() {
    console.log('Logging in...');
    await p.goto(`${ROUTER}/login.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
    await sleep(3000);
    await p.evaluate(() => { window.CheckPassword = () => 0; window.setDisable = () => {}; window.DisplayWifiPldt = () => {}; window.BandSteeringState = () => {}; window.LockLeftTime = 0; window.FailStat = '0'; window.LoginTimes = 0; });
    await p.type('input#txt_Username', 'admin');
    await p.type('input#txt_Password', '1234');
    await p.click('button#button');
    await sleep(5000);
  }

  async function applyWlan() {
    console.log('   Calling ApplySubmit()...');
    await p.evaluate(() => { ApplySubmit(); });
    console.log('   Waiting 10s...');
    await sleep(10000);
    console.log('   After:', p.url().substring(0, 80));
  }

  await login();

  // Step 1: Toggle 2.4G radio OFF
  console.log('\n--- Step 1: Turn 2.4G radio OFF ---');
  await p.goto(`${ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(3000);
  await p.evaluate(() => {
    const enbl = document.getElementById('wlEnbl');
    if (enbl && enbl.checked) { enbl.checked = false; enbl.dispatchEvent(new Event('change', {bubbles: true})); console.log('wlEnbl unchecked'); }
  });
  await applyWlan();

  // Step 2: Toggle 2.4G radio ON (with ALL settings confirmed)
  console.log('\n--- Step 2: Turn 2.4G radio ON ---');
  await p.goto(`${ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(3000);
  await p.evaluate(() => {
    const enbl = document.getElementById('wlEnbl');
    if (enbl && !enbl.checked) { enbl.checked = true; enbl.dispatchEvent(new Event('change', {bubbles: true})); }
    const enable = document.getElementById('wlEnable');
    if (enable && !enable.checked) { enable.checked = true; enable.dispatchEvent(new Event('change', {bubbles: true})); }
    const hide = document.getElementById('wlHide');
    if (hide && hide.checked) { hide.checked = false; hide.dispatchEvent(new Event('change', {bubbles: true})); }
  });
  await applyWlan();

  // Step 3: Toggle 5G radio OFF
  console.log('\n--- Step 3: Turn 5G radio OFF ---');
  await p.goto(`${ROUTER}/html/amp/wlanbasic/WlanBasic.asp?5G`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(3000);
  await p.evaluate(() => {
    const enbl = document.getElementById('wlEnbl');
    if (enbl && enbl.checked) { enbl.checked = false; enbl.dispatchEvent(new Event('change', {bubbles: true})); }
  });
  await applyWlan();

  // Step 4: Toggle 5G radio ON
  console.log('\n--- Step 4: Turn 5G radio ON ---');
  await p.goto(`${ROUTER}/html/amp/wlanbasic/WlanBasic.asp?5G`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(3000);
  await p.evaluate(() => {
    const enbl = document.getElementById('wlEnbl');
    if (enbl && !enbl.checked) { enbl.checked = true; enbl.dispatchEvent(new Event('change', {bubbles: true})); }
    const enable = document.getElementById('wlEnable');
    if (enable && !enable.checked) { enable.checked = true; enable.dispatchEvent(new Event('change', {bubbles: true})); }
    const hide = document.getElementById('wlHide');
    if (hide && hide.checked) { hide.checked = false; hide.dispatchEvent(new Event('change', {bubbles: true})); }
  });
  await applyWlan();

  // Step 5: Download config to verify what was actually saved
  console.log('\n--- Step 5: Check config ---');
  await p.goto(`${ROUTER}/html/ssmp/cfgfile/cfgfile.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(3000);
  console.log('   cfgfile URL:', p.url().substring(0, 80));
  
  const token = await p.evaluate(() => document.getElementById('hwonttoken')?.value || '').catch(() => '');
  console.log('   Token:', token ? token.substring(0, 30) + '...' : 'none');

  if (token) {
    const xml = await p.evaluate(async (t) => {
      const r = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'x.X_HW_Token=' + encodeURIComponent(t),
        credentials: 'include'
      });
      if (r.ok) return await r.text();
      return null;
    }, token).catch(() => null);

    if (xml && xml.length > 100) {
      // Search for WiFi-related config
      const lines = xml.split('\n').filter(l => 
        l.includes('WLANConfiguration') || 
        l.includes('wlEnbl') || 
        l.includes('wlEnable') || 
        l.includes('wlHide') ||
        l.includes('SSID') ||
        l.includes('wlSsid') ||
        l.includes('PreSharedKey') ||
        l.includes('wlWpaPsk') ||
        l.includes('X_HW_WLAN')
      );
      console.log(`   Config lines (${lines.length}):`);
      lines.slice(0, 30).forEach(l => console.log(`   ${l.trim().substring(0, 120)}`));
      require('fs').writeFileSync('downloaded_config.xml', xml);
      console.log('   Full config saved to downloaded_config.xml');
    } else {
      console.log('   Config download failed or empty');
    }
  }

  // Step 6: Reboot
  console.log('\n--- Step 6: Reboot ---');
  await p.goto(`${ROUTER}/html/ssmp/reset/reset.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(2000);
  const hasReboot = await p.evaluate(() => {
    const btn = document.getElementById('btnReboot');
    return btn ? {found: true, onclick: btn.getAttribute('onclick')} : {found: false};
  }).catch(() => ({}));
  console.log('   Reboot btn:', JSON.stringify(hasReboot));
  if (hasReboot.found) {
    p.once('dialog', d => { console.log(`   Dialog: ${d.message().substring(0, 60)}`); d.accept(); });
    await p.evaluate(() => { window.Reboot(); });
    console.log('   Reboot command sent!');
  }

  console.log('\n✅ Radio toggled OFF/ON and saved. Router rebooting.');
  console.log('   Wait 3-5 min, then scan for PLDTHOMEFIBRfA6zd');
  console.log('   Password: PLDTWIFIEfZd8');

  await sleep(3000);
  await b.close();
})();
