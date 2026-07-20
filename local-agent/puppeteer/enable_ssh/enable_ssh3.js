const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  let postUrl = '';
  p.on('request', req => {
    if (req.method() === 'POST') {
      console.log('>>> POST', req.url().substring(0, 250));
      if (req.url().includes('set.cgi')) { postUrl = req.url(); }
    }
  });
  p.on('response', async res => {
    if (res.url().includes('set.cgi')) {
      console.log('<<< set.cgi response:', res.status());
      const text = await res.text();
      console.log('Response body:', text.substring(0, 500));
    }
  });

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:20000});
  await p.evaluate(() => { window.setDisable = () => {}; });
  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:10});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  // Navigate to ACL page
  await p.goto('https://192.168.1.1/html/bbsp/acl/acl.asp', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  // Enable SSH LAN checkbox
  await p.evaluate(() => {
    const cb = document.getElementById('sshlan');
    if (cb && !cb.checked) { cb.checked = true; console.log('SSH enabled'); }
  });

  // Click Apply button
  await p.evaluate(() => {
    const btn = document.getElementById('bttnApply');
    if (btn) { console.log('Clicking Apply'); btn.click(); }
  });

  await new Promise(r => setTimeout(r,8000));
  console.log('After apply URL:', p.url());

  // Check port 22
  const net = require('net');
  const checkPort = (host, port) => new Promise(resolve => {
    const s = new net.Socket();
    s.setTimeout(3000);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { s.destroy(); resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.connect(port, host);
  });

  const port22 = await checkPort('192.168.1.1', 22);
  console.log('Port 22 (SSH):', port22 ? 'OPEN' : 'CLOSED');

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
