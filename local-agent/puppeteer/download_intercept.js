const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1024,768']});
  const [p] = await b.pages();

  // Enable request interception
  await p.setRequestInterception(true);

  p.on('request', req => {
    req.continue();
  });

  // Capture responses with raw body
  const cdp = await p.target().createCDPSession();
  await cdp.send('Network.enable');

  cdp.on('Network.responseReceived', async params => {
    const url = params.response.url;
    if (url.includes('cfgfiledown.cgi')) {
      console.log('*** cfgfiledown.cgi DETECTED ***');
      console.log('URL:', url);
      console.log('Status:', params.response.status);
      console.log('Headers:', JSON.stringify(params.response.headers));
      console.log('Request ID:', params.requestId);
      
      try {
        const { body, base64Encoded } = await cdp.send('Network.getResponseBody', {
          requestId: params.requestId
        });
        const buf = base64Encoded ? Buffer.from(body, 'base64') : Buffer.from(body);
        console.log('Body size:', buf.length, 'bytes');
        fs.writeFileSync('hw_ctree_downloaded.xml', buf);
        console.log('FILE SAVED!');
        console.log('Hex header:', buf.slice(0, 32).toString('hex'));
        console.log('First 200 chars:', buf.toString('utf8').substring(0, 200));
      } catch(e) {
        console.log('Error getting body:', e.message);
      }
    }
  });

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

  const token = await p.evaluate(() => document.getElementById('hwonttoken').value);
  console.log('Token:', token);

  // Click the Download button
  await p.evaluate(() => {
    document.getElementById('downloadconfigbutton').click();
  });

  // Wait for download
  await new Promise(r => setTimeout(r, 10000));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
