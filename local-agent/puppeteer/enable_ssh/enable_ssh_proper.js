const puppeteer = require('puppeteer');
const { Client } = require('ssh2');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Monitor network requests
  p.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('set.cgi')) {
      console.log('>>> POST to set.cgi');
      console.log('    Data:', req.postData()?.substring(0, 500));
    }
  });

  let sessionCookie = null;
  p.on('response', async res => {
    if (res.url().includes('login.cgi')) {
      const headers = res.headers();
      const sc = headers['set-cookie'];
      if (sc) { const m = sc.match(/Cookie=([^;]+)/); if (m) sessionCookie = m[1]; }
    }
    if (res.url().includes('set.cgi')) {
      const text = await res.text().catch(() => '');
      console.log('<<< set.cgi response:', text.substring(0, 200));
    }
  });

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  await p.type('input#txt_Username','adminpldt',{delay:20});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,3000));

  if (sessionCookie) {
    await p.setCookie({ name: 'Cookie', value: sessionCookie, domain: '192.168.1.1', path: '/', httpOnly: true, secure: true });
  }

  // Go to ACL page
  await p.goto('https://192.168.1.1/html/bbsp/acl/acl.asp', {waitUntil:'networkidle0', timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  // Check SSH checkbox
  await p.evaluate(() => {
    const cb = document.getElementById('sshlan');
    if (cb) { 
      console.log('SSHLAN found, checked:', cb.checked);
      cb.checked = true; 
      // Also trigger change event
      const evt = new Event('change', { bubbles: true });
      cb.dispatchEvent(evt);
    }
  });

  // Wait for any JS processing
  await new Promise(r => setTimeout(r,500));

  // Find and click Apply/Submit button
  await p.evaluate(() => {
    // Try various selectors for the submit button
    const btn = document.querySelector('input[type="submit"], input.btnApply, input[onclick*="Apply"], input.btPreference');
    if (btn) { console.log('Clicking:', btn.id || btn.value || 'unknown'); btn.click(); return; }
    // Try by value
    const btns = document.querySelectorAll('input');
    btns.forEach(b => {
      if (b.value && b.value.toLowerCase().includes('apply')) {
        console.log('Clicking Apply button');
        b.click();
      }
    });
  });

  await new Promise(r => setTimeout(r,10000));

  // Test SSH
  console.log('Testing SSH...');
  const testSSH = () => new Promise((resolve) => {
    const conn = new Client();
    conn.on('ready', () => { console.log('SSH READY!'); conn.end(); resolve(true); });
    conn.on('error', (e) => { resolve(false); });
    conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 10000 });
    setTimeout(() => { conn.end(); resolve(false); }, 8000);
  });

  for (let i = 0; i < 5; i++) {
    const ok = await testSSH();
    if (ok) { console.log('SSH CONNECTED!'); break; }
    console.log(`Attempt ${i+1}: SSH not ready, waiting...`);
    await new Promise(r => setTimeout(r, 3000));
  }

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
