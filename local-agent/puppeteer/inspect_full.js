const puppeteer = require('puppeteer');
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

  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  await p.type('input#txt_Username','adminpldt',{delay:15});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,3000));

  if (sessionCookie) {
    await p.setCookie({ name: 'Cookie', value: sessionCookie, domain: '192.168.1.1', path: '/', httpOnly: true, secure: true });
  }

  await p.goto('https://192.168.1.1/html/bbsp/acl/acl.asp', {waitUntil:'networkidle0', timeout:15000});
  await new Promise(r => setTimeout(r,4000));

  const allJS = await p.evaluate(() => {
    const funcs = {};
    for (const key of Object.keys(window)) {
      if (typeof window[key] === 'function' && key.includes('Submit') || key.includes('Form') || key.includes('SSH') || key.includes('Apply') || key.includes('Token')) {
        funcs[key] = window[key].toString().substring(0, 3000);
      }
    }
    return funcs;
  });

  for (const [k, v] of Object.entries(allJS)) {
    console.log(`\n=== ${k} ===`);
    console.log(v);
  }

  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
