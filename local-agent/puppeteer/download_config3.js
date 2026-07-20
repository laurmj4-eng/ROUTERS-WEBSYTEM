const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
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

  if (sessionCookie) {
    await p.setCookie({ name: 'Cookie', value: sessionCookie, domain: '192.168.1.1', path: '/', httpOnly: true, secure: true });
  }

  await p.goto('https://192.168.1.1/html/ssmp/cfgfile/cfgfile.asp', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  // Check variables
  const vars = await p.evaluate(() => ({
    isCfgFileNeedPwd: typeof isCfgFileNeedPwd !== 'undefined' ? isCfgFileNeedPwd : 'undefined',
    showCfgKeyOption: typeof showCfgKeyOption !== 'undefined' ? showCfgKeyOption : 'undefined',
    reqFile: typeof reqFile !== 'undefined' ? reqFile : 'undefined',
    isWebLoadConfigfile: typeof isWebLoadConfigfile !== 'undefined' ? isWebLoadConfigfile : 'undefined',
  }));
  console.log('Variables:', JSON.stringify(vars));

  // Put the token here for direct use
  const token = await p.evaluate(() => getValue('onttoken'));
  console.log('Token:', token);

  // Set up response capture for cfgfiledown.cgi
  p.on('response', async res => {
    if (res.url().includes('cfgfiledown.cgi')) {
      console.log('*** cfgfiledown.cgi response ***');
      console.log('Status:', res.status());
      console.log('Content-Type:', res.headers()['content-type']);
      console.log('Content-Disposition:', res.headers()['content-disposition']);
      const buffer = await res.buffer().catch(() => null);
      if (buffer) {
        console.log('Size:', buffer.length, 'bytes');
        fs.writeFileSync('cfgfiledown_response.bin', buffer);
        console.log('Saved!');
      }
      const text = buffer?.toString('utf8').substring(0, 500);
      if (text) console.log('Content preview:', text);
    }
  });

  // Click the Download button
  await p.evaluate(() => {
    document.getElementById('downloadconfigbutton').click();
  });

  await new Promise(r => setTimeout(r, 10000));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
