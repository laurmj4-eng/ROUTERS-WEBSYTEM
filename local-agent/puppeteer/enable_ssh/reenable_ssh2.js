const puppeteer = require('puppeteer');
const { Client } = require('ssh2');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  await p.type('input#txt_Username','adminpldt',{delay:20});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));
  console.log('URL:', p.url());

  // Go to Device Access Control
  await p.goto('https://192.168.1.1/html/ssmp/devicecontrol/devicecontrol.asp', {waitUntil:'networkidle0', timeout:15000});
  await new Promise(r => setTimeout(r,3000));
  console.log('Device Control page loaded');

  // Check SSH checkbox state
  const state = await p.evaluate(() => {
    const cb = document.querySelector('input[name="sshEnable"], input[id="sshEnable"], input[type="checkbox"]');
    if (cb) return { id: cb.id, name: cb.name, checked: cb.checked };
    // List all checkboxes
    const all = {};
    document.querySelectorAll('input[type="checkbox"]').forEach(c => { all[c.id || c.name] = c.checked; });
    return { notFound: true, all };
  });
  console.log('SSH state:', JSON.stringify(state));

  // Click SSH enable if found
  await p.evaluate(() => {
    const cb = document.querySelector('input[name="sshEnable"], input[id="sshEnable"]');
    if (cb) { cb.checked = true; console.log('SSH checked'); }
  });

  // Click Apply
  await p.evaluate(() => {
    const btns = document.querySelectorAll('input[type="submit"], input[value="Apply"]');
    btns.forEach(b => b.click());
  });
  await new Promise(r => setTimeout(r,5000));

  // Test SSH
  try {
    const conn = new Client();
    await new Promise((resolve, reject) => {
      conn.on('ready', resolve);
      conn.on('error', reject);
      conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 10000 });
    });
    console.log('SSH RECONNECTED!');
    conn.end();
  } catch(e) {
    console.log('SSH still down:', e.message);
  }

  // Check WLAN status
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,3000));
  const wlan = await p.evaluate(() => {
    return {
      wlEnbl: document.getElementById('wlEnbl')?.value,
      wlEnable: document.getElementById('wlEnable')?.value,
      wlSsid1: document.getElementById('wlSsid1')?.value,
      wlHide: document.getElementById('wlHide')?.value,
      wlWpaPsk: document.getElementById('wlWpaPsk')?.value,
    };
  });
  console.log('WLAN status:', JSON.stringify(wlan));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
