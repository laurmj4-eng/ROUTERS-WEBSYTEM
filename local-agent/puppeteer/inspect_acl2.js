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

  const jsCode = await p.evaluate(() => {
    return {
      submitForm: typeof SubmitForm === 'function' ? SubmitForm.toString().substring(0, 2000) : 'not found',
      sshEnable: typeof SSHEnable === 'function' ? SSHEnable.toString().substring(0, 2000) : 'not found',
      getToken: typeof GetToken === 'function' ? GetToken.toString().substring(0, 500) : 'not found',
      getTokenVal: typeof GetTokenVal === 'function' ? GetTokenVal.toString().substring(0, 500) : 'not found',
    };
  });

  console.log('=== SubmitForm ===');
  console.log(jsCode.submitForm);
  console.log('\n=== SSHEnable ===');
  console.log(jsCode.sshEnable);
  console.log('\n=== GetToken ===');
  console.log(jsCode.getToken);
  console.log('\n=== GetTokenVal ===');
  console.log(jsCode.getTokenVal);

  // Check the onload logic too
  const onload = await p.evaluate(() => {
    const scripts = Array.from(document.scripts).map(s => s.textContent);
    return scripts[scripts.length - 1]?.substring(0, 3000) || 'none';
  });
  console.log('\n=== Last script ===');
  console.log(onload);

  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
