const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,900']});
  const [p] = await b.pages();

  let sessionCookie = null;
  p.on('response', async res => {
    if (res.url().includes('login.cgi')) {
      const headers = res.headers();
      const setCookie = headers['set-cookie'];
      if (setCookie) {
        const match = setCookie.match(/Cookie=([^;]+)/);
        if (match) sessionCookie = match[1];
        console.log('Got session cookie');
      }
    }
  });

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  await p.type('input#txt_Username','adminpldt',{delay:20});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,3000));

  // Set the cookie manually
  if (sessionCookie) {
    await p.setCookie({
      name: 'Cookie',
      value: sessionCookie,
      domain: '192.168.1.1',
      path: '/',
      httpOnly: true,
      secure: true,
    });
  }

  // Navigate to 2.4G WLAN settings
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  console.log('WLAN page loaded. Browser open for you to see.');
  console.log('SSID:', await p.evaluate(() => document.getElementById('wlSsid1')?.value));
  console.log('WiFi enabled:', await p.evaluate(() => document.getElementById('wlEnable')?.value));

  // Keep browser open
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
