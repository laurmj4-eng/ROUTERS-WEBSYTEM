const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1024,768']});
  const [p] = await b.pages();

  p.on('console', msg => console.log('B:', msg.text()));

  let sessionCookie = null;
  p.on('response', async res => {
    if (res.url().includes('login.cgi')) {
      const sc = res.headers()['set-cookie'];
      if (sc) { const m = sc.match(/Cookie=([^;]+)/); if (m) sessionCookie = m[1]; }
    }
  });

  // Login
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

  // Go to cfgfile page
  await p.goto('https://192.168.1.1/html/ssmp/cfgfile/cfgfile.asp', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  // Capture the download via request interception
  p.on('response', async res => {
    if (res.url().includes('cfgfiledown.cgi')) {
      console.log('GOT RESPONSE FROM cfgfiledown.cgi');
      const disp = res.headers()['content-disposition'] || '';
      console.log('Content-Disposition:', disp);
      const ct = res.headers()['content-type'];
      console.log('Content-Type:', ct);
      
      // Use the CDPSession to get the body
      const client = await p.target().createCDPSession();
      const { body, base64Encoded } = await client.send('Network.getResponseBody', {
        requestId: res.request()._requestId
      });
      
      const buffer = base64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body);
      console.log('Body size:', buffer.length, 'bytes');
      fs.writeFileSync('hw_ctree_downloaded.xml', buffer);
      console.log('FILE SAVED: hw_ctree_downloaded.xml');
      
      // Show hex header
      console.log('Hex header:', buffer.slice(0, 32).toString('hex'));
      console.log('First 100 chars:', buffer.toString('utf8').substring(0, 100));
    }
  });

  // First call StartFileLoad
  await p.evaluate(() => {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/html/ssmp/common/StartFileLoad.asp', false);
    xhr.send();
    console.log('StartFileLoad done');
  });

  await new Promise(r => setTimeout(r, 1000));

  // Then navigate to cfgfiledown with token
  const token = await p.evaluate(() => document.getElementById('hwonttoken').value);
  console.log('Token:', token);
  
  await p.goto(`https://192.168.1.1/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp&x.X_HW_Token=${token}`, {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r, 5000));

  console.log('Done. Check hw_ctree_downloaded.xml');
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
