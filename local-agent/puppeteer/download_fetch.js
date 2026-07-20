const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const b = await puppeteer.launch({headless:true, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors']});
  const [p] = await b.pages();

  let sessionCookie = null;
  p.on('response', async res => {
    if (res.url().includes('login.cgi')) {
      const sc = res.headers()['set-cookie'];
      if (sc) { const m = sc.match(/Cookie=([^;]+)/); if (m) sessionCookie = m[1]; }
    }
  });

  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:30000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  if (await p.$('input#txt_Username')) {
    await p.type('input#txt_Username','adminpldt',{delay:15});
    await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
    await p.click('button#button');
    await new Promise(r => setTimeout(r,3000));
  }

  if (sessionCookie) await p.setCookie({ name:'Cookie', value:sessionCookie, domain:'192.168.1.1', path:'/', httpOnly:true, secure:true });

  await p.goto('https://192.168.1.1/html/ssmp/cfgfile/cfgfile.asp', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  const token = await p.evaluate(() => document.getElementById('hwonttoken').value);
  console.log('Token:', token);

  // Use fetch API from browser context
  const result = await p.evaluate(async (token) => {
    // Step 1: StartFileLoad
    await fetch('/html/ssmp/common/StartFileLoad.asp', { method: 'GET' });
    
    // Step 2: Download the config file
    const res = await fetch('/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp&x.X_HW_Token=' + token, {
      method: 'GET',
      credentials: 'include'  // sends cookies
    });
    
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Return as base64
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return { size: bytes.length, b64: btoa(binary), type: res.headers.get('content-type'), disp: res.headers.get('content-disposition') };
  }, token);

  console.log('Result size:', result.size);
  console.log('Content-Type:', result.type);
  console.log('Content-Disposition:', result.disp);

  const buffer = Buffer.from(result.b64, 'base64');
  fs.writeFileSync('hw_ctree_downloaded.xml', buffer);
  console.log('FILE SAVED: hw_ctree_downloaded.xml');
  console.log('Hex header:', buffer.slice(0, 32).toString('hex'));
  console.log('First 200 chars:', buffer.toString('utf8').substring(0, 200));

  await b.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
