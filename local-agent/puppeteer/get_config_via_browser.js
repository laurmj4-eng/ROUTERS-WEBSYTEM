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
    // Catch backupcfg responses
    if (res.url().includes('backupcfg.cgi') || res.url().includes('dumpcfg.cgi')) {
      console.log('Response from:', res.url());
      console.log('Status:', res.status());
      const text = await res.text().catch(() => '');
      console.log('Body:', text.substring(0, 500));
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

  // Try backupcfg.cgi
  console.log('\n--- Trying backupcfg.cgi ---');
  await p.goto('https://192.168.1.1/backupcfg.cgi', {waitUntil:'networkidle0', timeout:15000}).catch(e => console.log('Error:', e.message));
  await new Promise(r => setTimeout(r,3000));

  // Try backupcfg.cgi with POST
  console.log('\n--- Trying backupcfg.cgi POST ---');
  const r1 = await p.evaluate(async () => {
    const res = await fetch('https://192.168.1.1/backupcfg.cgi');
    return { status: res.status, body: await res.text().then(t => t.substring(0,300)).catch(() => '') };
  });
  console.log('Result:', JSON.stringify(r1));

  // Try dumpcfg.cgi
  console.log('\n--- Trying dumpcfg.cgi ---');
  const r2 = await p.evaluate(async () => {
    const res = await fetch('https://192.168.1.1/dumpcfg.cgi');
    return { status: res.status, body: await res.text().then(t => t.substring(0,300)).catch(() => '') };
  });
  console.log('Result:', JSON.stringify(r2));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
