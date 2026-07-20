const puppeteer = require('puppeteer');
const { Client } = require('ssh2');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  let sessionCookie = null;
  p.on('response', async res => {
    if (res.url().includes('login.cgi')) {
      const headers = res.headers();
      const sc = headers['set-cookie'];
      if (sc) { const m = sc.match(/Cookie=([^;]+)/); if (m) sessionCookie = m[1]; }
    }
  });

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

  // Navigate to ACL/Device Access Control
  await p.goto('https://192.168.1.1/html/bbsp/acl/acl.asp', {waitUntil:'networkidle0', timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  console.log('ACL URL:', p.url());

  // Find SSH checkbox and click it
  const sshed = await p.evaluate(() => {
    // Find all checkboxes on the page
    const cbs = document.querySelectorAll('input[type="checkbox"]');
    const results = [];
    cbs.forEach(cb => {
      results.push({ id: cb.id, name: cb.name, checked: cb.checked, display: cb.style.display, parentText: cb.closest('tr')?.innerText?.substring(0,100) });
    });
    return results;
  });

  console.log('Checkboxes found:', sshed.length);
  sshed.forEach(s => console.log(JSON.stringify(s)));

  // Try to find and click SSH checkbox
  await p.evaluate(() => {
    const cbs = document.querySelectorAll('input[type="checkbox"]');
    for (const cb of cbs) {
      const row = cb.closest('tr');
      if (row && row.innerText.toLowerCase().includes('ssh')) {
        console.log('Found SSH checkbox:', cb.id);
        if (!cb.checked) { cb.click(); console.log('Clicked SSH'); }
        break;
      }
    }
  });
  await new Promise(r => setTimeout(r,1000));

  // Click Apply/Save
  await p.evaluate(() => {
    const btns = document.querySelectorAll('input[type="submit"], input[value="Apply"]');
    btns.forEach(b => { console.log('Clicking:', b.value || b.id); b.click(); });
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

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
