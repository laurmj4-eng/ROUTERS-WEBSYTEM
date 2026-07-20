const puppeteer = require('puppeteer');
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

  const html = await p.evaluate(() => {
    // Get all input elements
    const inputs = Array.from(document.querySelectorAll('input, button, select'));
    return inputs.map(el => ({
      tag: el.tagName,
      id: el.id,
      name: el.name,
      type: el.type,
      value: el.value,
      onclick: el.getAttribute('onclick')?.substring(0,100),
      style: el.style.cssText?.substring(0,80),
      visible: el.offsetParent !== null
    }));
  });

  console.log('=== All inputs/buttons ===');
  html.forEach(inp => console.log(JSON.stringify(inp, null, 2)));

  // Check forms
  const forms = await p.evaluate(() => {
    return Array.from(document.forms).map(f => ({
      id: f.id,
      name: f.name,
      action: f.action,
      method: f.method
    }));
  });
  console.log('\n=== Forms ===');
  forms.forEach(f => console.log(JSON.stringify(f)));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
