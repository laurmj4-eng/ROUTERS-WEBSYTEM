const puppeteer = require('puppeteer');
const { Client } = require('ssh2');

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
      }
    }
  });

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  await p.type('input#txt_Username','adminpldt',{delay:20});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:10});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,3000));

  console.log('Session cookie:', sessionCookie ? sessionCookie.substring(0,50) : 'NONE');

  if (!sessionCookie) { console.log('No cookie!'); await new Promise(()=>{}); return; }

  // Set cookie manually
  await p.setCookie({
    name: 'Cookie',
    value: sessionCookie,
    domain: '192.168.1.1',
    path: '/',
    httpOnly: true,
    secure: true,
  });

  // Try accessing WLAN page directly
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,4000));
  console.log('WLAN URL:', p.url());

  // Check if we can read current config
  const state = await p.evaluate(() => {
    const r = {};
    r.allInputs = {};
    document.querySelectorAll('input').forEach(el => { if (el.id) r.allInputs[el.id] = el.value; });
    r.jsVars = {};
    try { r.jsVars.wpaPskKey = JSON.stringify(window.wpaPskKey).substring(0,500); } catch(e) {}
    try { r.jsVars.wlanWifiArr = JSON.stringify(window.WlanWifiArr).substring(0,500); } catch(e) {}
    try { r.jsVars.wlSsid1 = window.wlSsid1; } catch(e) {}
    try { r.jsVars.wpapskpassword = window.wpapskpassword; } catch(e) {}
    try { r.jsVars.wifiPasswordMask = window.wifiPasswordMask; } catch(e) {}
    return r;
  });
  console.log('WLAN state:', JSON.stringify(state, null, 2));

  // Also try the PLDT guide page
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/guidepldtwificfg.asp', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,3000));
  const guideState = await p.evaluate(() => {
    const r = {};
    r.allInputs = {};
    document.querySelectorAll('input').forEach(el => { r[el.id || el.name] = el.value; });
    return r;
  });
  console.log('Guide state:', JSON.stringify(guideState, null, 2));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
