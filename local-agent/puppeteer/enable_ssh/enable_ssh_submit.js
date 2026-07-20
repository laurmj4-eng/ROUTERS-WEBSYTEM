const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  p.on('console', msg => console.log('BROWSER:', msg.text()));

  // Intercept set.cgi POST
  p.on('request', req => {
    if (req.url().includes('set.cgi') && req.method() === 'POST') {
      console.log('>>> SET.CGI POST:', req.postData()?.substring(0, 1000));
    }
  });
  p.on('response', async res => {
    if (res.url().includes('set.cgi')) {
      const text = await res.text().catch(() => '');
      console.log('<<< SET.CGI RESP:', text.substring(0, 500));
    }
  });

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
  await new Promise(r => setTimeout(r,3000));

  console.log('Page loaded. Checking SSH checkbox...');

  // Check SSH checkbox and submit
  await p.evaluate(() => {
    document.getElementById('sshlan').checked = true;
    SSHEnable(document.getElementById('sshlan'));
    SubmitForm();
  });

  await new Promise(r => setTimeout(r,5000));
  
  // Don't close browser, leave it open
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
