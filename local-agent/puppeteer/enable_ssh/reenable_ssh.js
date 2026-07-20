const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:20000});
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  await p.type('input#txt_Username','adminpldt',{delay:20});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  console.log('Logged in, URL:', p.url());

  // Go to Device Access Control page
  await p.goto('https://192.168.1.1/html/ssmp/devicecontrol/devicecontrol.asp', {waitUntil:'networkidle0', timeout:15000});
  await new Promise(r => setTimeout(r,3000));
  console.log('Device Control URL:', p.url());

  // Enable SSH
  await p.evaluate(() => {
    const sshCheckbox = document.querySelector('input[name="sshEnable"]') || document.querySelector('input[id="sshEnable"]');
    if (sshCheckbox) { sshCheckbox.checked = true; console.log('SSH checkbox checked'); } else { console.log('SSH checkbox not found'); }
  });

  // Click Apply
  const btn = await p.$('input[value="Apply"], button:contains("Apply"), input[type="submit"]');
  if (btn) { await btn.click(); console.log('Clicked Apply'); } else { console.log('Apply button not found, trying form submit'); }
  await new Promise(r => setTimeout(r,5000));

  // Test SSH
  const { Client } = require('ssh2');
  const conn = new Client();
  try {
    await new Promise((resolve, reject) => {
      conn.on('ready', resolve);
      conn.on('error', reject);
      conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 10000 });
    });
    console.log('SSH RECONNECTED successfully!');
    conn.end();
  } catch(e) {
    console.log('SSH still not available:', e.message);
  }

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
