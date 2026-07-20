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
    const url = res.url();
    if (url.includes('.cgi') && res.status() === 200) {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('xml') || ct.includes('octet') || ct.includes('download')) {
        const buffer = await res.buffer().catch(() => null);
        if (buffer && buffer.length > 100) {
          console.log('POSSIBLE CONFIG:', url, buffer.length, 'bytes, type:', ct);
          fs.writeFileSync('cfg_download.bin', buffer);
        }
      }
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

  const backupSettingFunc = await p.evaluate(() => {
    return typeof backupSetting === 'function' ? backupSetting.toString() : 'not found';
  });
  console.log('=== backupSetting() ===');
  console.log(backupSettingFunc);

  const AisDownloadConfig = await p.evaluate(() => {
    return typeof AisDownloadConfig === 'function' ? AisDownloadConfig.toString().substring(0, 2000) : 'not found';
  });
  console.log('\n=== AisDownloadConfig() ===');
  console.log(AisDownloadConfig);

  const GetToken = await p.evaluate(() => {
    return typeof GetToken === 'function' ? GetToken.toString() : 'not found';
  });
  console.log('\n=== GetToken() ===');
  console.log(GetToken);

  // Check what backupSetting does
  const fullJs = await p.evaluate(() => {
    // Collect all function definitions that might be relevant
    const names = Object.getOwnPropertyNames(window);
    const funcs = {};
    names.forEach(n => {
      if (typeof window[n] === 'function' && (n.toLowerCase().includes('backup') || n.toLowerCase().includes('download') || n.toLowerCase().includes('cfg') || n.toLowerCase().includes('save'))) {
        try {
          const str = window[n].toString();
          if (str.length < 5000) funcs[n] = str;
        } catch(e) {}
      }
    });
    return funcs;
  });
  
  Object.entries(fullJs).forEach(([k, v]) => {
    if (k !== 'backupSetting') {
      console.log(`\n=== ${k} ===`);
      console.log(v.substring(0, 500));
    }
  });

  await b.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
