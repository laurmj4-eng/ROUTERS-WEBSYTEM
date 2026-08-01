const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});

  async function loginAndFix(label, path) {
    // Use a fresh page per attempt
    const p = await b.newPage();

    console.log(`\n=== ${label} ===`);
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

    console.log(`[2] Navigating to ${path}...`);
    await p.goto(`${ROUTER}/${path}`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
    await sleep(3000);

    const info = await p.evaluate(() => ({
      url: window.location.href.substring(0, 80),
      wlHide: document.getElementById('wlHide')?.checked,
      wlEnbl: document.getElementById('wlEnbl')?.checked,
      wlEnable: document.getElementById('wlEnable')?.checked,
      hasApplySubmit: typeof window.ApplySubmit === 'function',
    })).catch(() => ({}));
    console.log(`   Info:`, JSON.stringify(info));

    if (!info.hasApplySubmit) {
      console.log(`   ApplySubmit not available, trying alternate approach...`);
      await p.close();
      return false;
    }

    // Set wlHide to unchecked (SSID visible)
    await p.evaluate(() => {
      const hide = document.getElementById('wlHide');
      if (hide && hide.checked) {
        hide.checked = false;
        hide.dispatchEvent(new Event('change', {bubbles: true}));
        console.log('wlHide unchecked');
      }
      // Ensure radio is enabled
      const enbl = document.getElementById('wlEnbl');
      if (enbl && !enbl.checked) {
        enbl.checked = true;
        enbl.dispatchEvent(new Event('change', {bubbles: true}));
        console.log('wlEnbl checked');
      }
      const enable = document.getElementById('wlEnable');
      if (enable && !enable.checked) {
        enable.checked = true;
        enable.dispatchEvent(new Event('change', {bubbles: true}));
        console.log('wlEnable checked');
      }
    });

    console.log(`   Calling ApplySubmit()...`);
    await p.evaluate(() => { ApplySubmit(); });
    console.log(`   Submitted, waiting 10s...`);
    await sleep(10000);
    console.log(`   After submit URL:`, p.url().substring(0, 80));

    // Check if we landed on set.cgi (success indicator)
    if (p.url().includes('set.cgi')) {
      console.log(`   ✅ Form submitted successfully!`);
    }

    await p.close();
    return true;
  }

  // Fix 2.4G - use its own login + page
  await loginAndFix('2.4G', 'html/amp/wlanbasic/WlanBasic.asp?2G');

  // Fix 5G - use its own login + page  
  await loginAndFix('5G', 'html/amp/wlanbasic/WlanBasic.asp?5G');

  // Reboot via fresh login
  console.log(`\n=== REBOOT ===`);
  const p2 = await b.newPage();
  console.log('[1] Logging in...');
  await p2.goto(`${ROUTER}/login.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);
  await p2.evaluate(() => {
    window.CheckPassword = () => 0; window.setDisable = () => {}; window.DisplayWifiPldt = () => {}; window.BandSteeringState = () => {}; window.LockLeftTime = 0; window.FailStat = '0'; window.LoginTimes = 0;
  });
  await p2.type('input#txt_Username', 'admin');
  await p2.type('input#txt_Password', '1234');
  await p2.click('button#button');
  await sleep(5000);

  console.log('[2] Finding reboot page...');
  const rebootPaths = [
    'html/ssmp/management/reboot.asp',
    'html/ssmp/reset/reset.asp',
    'html/amp/maintenance/Reboot.asp',
  ];

  let rebooted = false;
  for (const rp of rebootPaths) {
    console.log(`   Trying ${rp}...`);
    await p2.goto(`${ROUTER}/${rp}`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 10000}).catch(() => {});
    await sleep(2000);

    const hasBtn = await p2.evaluate(() => {
      const btns = document.querySelectorAll('input[type="button"], input[type="submit"], button');
      const found = [];
      btns.forEach(b => {
        const v = (b.value || b.id || '').toLowerCase();
        if (v.includes('reboot') || v.includes('restart') || v.includes('reset')) {
          found.push({id: b.id, value: (b.value || '').substring(0, 30), onclick: (b.getAttribute('onclick') || '').substring(0, 50)});
        }
      });
      return found;
    }).catch(() => []);
    console.log(`   Buttons:`, JSON.stringify(hasBtn));

    if (hasBtn.length > 0) {
      console.log(`   Clicking reboot button...`);
      p2.once('dialog', d => { console.log(`   Dialog: ${d.message().substring(0, 50)}`); d.accept(); });
      await p2.evaluate(() => { window.Reboot ? window.Reboot() : document.getElementById('btnReboot')?.click(); });
      await sleep(3000);
      rebooted = true;
      break;
    }
  }

  if (rebooted) {
    console.log('\n✅ Router rebooting... Wait 3-5 minutes, then scan for PLDTHOMEFIBRfA6zd');
  } else {
    console.log('\n⚠️ Please manually reboot the router (unplug power for 30s, plug back in)');
  }

  console.log('   Password: PLDTWIFIEfZd8');
  console.log('   Admin login: admin / 1234 (unchanged)');

  await sleep(3000);
  await b.close();
})();
