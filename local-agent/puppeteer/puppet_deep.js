#!/usr/bin/env node
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,900']});
  const [p] = await b.pages();

  // Monitor responses
  const responses = [];
  p.on('response', async res => {
    try {
      const url = res.url();
      if (url.includes('.asp') || url.includes('.cgi') || url.includes('.xml')) {
        const text = await res.text().catch(() => '');
        responses.push({ url: url.substring(0, 300), status: res.status(), len: text.length });
        // Save full response for key pages
        if (url.includes('guidepldt') || url.includes('WlanBasic') || url.includes('wlanbasic')) {
          const key = url.replace(/[^a-zA-Z0-9]/g, '_');
          fs.writeFileSync(`C:\\Users\\emili\\AppData\\Local\\Temp\\resp_${key}.html`, text);
        }
      }
    } catch(e) {}
  });

  // Login
  console.log('Logging in...');
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  await p.type('input#txt_Username','adminpldt',{delay:20});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  console.log('Logged in, URL:', p.url());

  // Extract session cookie
  const cookies = await p.cookies();
  const sessionCookie = cookies.find(c => c.name.includes('sid') || c.name.includes('Cookie') || c.name.includes('Session'));
  console.log('Session cookie:', JSON.stringify(sessionCookie));

  // Try guidepldtwificfg.asp (PLDT overlay)
  console.log('\nTrying guidepldtwificfg.asp...');
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/guidepldtwificfg.asp', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,3000));
  console.log('PLDT guide URL:', p.url());
  const guideHtml = await p.content();
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\guidepldt_page.html', guideHtml);

  // Check for passwords in guide page
  const guidePws = await p.evaluate(() => {
    const r = {};
    document.querySelectorAll('input').forEach(el => { r[el.id || el.name] = el.value; });
    r.body = document.body?.innerText?.substring(0, 2000) || '';
    return r;
  });
  console.log('Guide page inputs:', JSON.stringify(guidePws, null, 2));

  // Now check 5G WLAN page
  console.log('\nTrying WlanBasic.asp?5G...');
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?5G', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,4000));

  const wlan5g = await p.evaluate(() => {
    const r = {};
    r.allInputs = {};
    document.querySelectorAll('input').forEach(el => { if (el.value) r.allInputs[el.id || el.name] = el.value; });
    r.jsVars = {};
    ['wpaPskKey', 'WlanWifiArr', 'wlWpaPsk', 'twlWpaPsk', 'wifiPasswordMask', 'wlSsid', 'wlSsid1', 'wpapskpassword'].forEach(v => {
      try { r.jsVars[v] = JSON.stringify(window[v]).substring(0, 500); } catch(e) { r.jsVars[v] = 'ERROR'; }
    });
    // Search for any $2$ or encrypted patterns in DOM
    r.encrypted = [];
    try {
      const html = document.documentElement.innerHTML;
      const matches = html.match(/\$2\$[^"']+/g) || [];
      r.encrypted = matches.slice(0, 10);
    } catch(e) {}
    return r;
  });

  console.log('5G Inputs:', JSON.stringify(wlan5g.allInputs, null, 2));
  console.log('5G JS Vars:', JSON.stringify(wlan5g.jsVars, null, 2));
  console.log('5G Encrypted:', JSON.stringify(wlan5g.encrypted, null, 2));
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\wlan5g_state.json', JSON.stringify(wlan5g, null, 2));

  // Now check 2G page source for encrypted values
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,4000));

  const fullHtml = await p.content();
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\wlan2g_full.html', fullHtml);

  // Search for any encrypted patterns
  const searchResult = await p.evaluate(() => {
    const r = {};
    // Search all script tags content
    const scripts = document.querySelectorAll('script');
    r.scriptContents = [];
    scripts.forEach(s => {
      if (s.textContent && (s.textContent.includes('PreSharedKey') || s.textContent.includes('$2$') || s.textContent.includes('KeyPassphrase'))) {
        r.scriptContents.push(s.textContent.substring(0, 1000));
      }
    });
    // Check all hidden inputs
    r.hiddenInputs = {};
    document.querySelectorAll('input[type=hidden]').forEach(el => { r.hiddenInputs[el.id || el.name] = el.value; });
    // Check data attributes
    r.dataAttrs = [];
    document.querySelectorAll('[data-psk], [data-password], [data-key]').forEach(el => {
      r.dataAttrs.push({ id: el.id, dataset: JSON.parse(JSON.stringify(el.dataset)) });
    });
    return r;
  });

  console.log('\nScripts with PSK:', searchResult.scriptContents.length);
  console.log('Hidden inputs:', JSON.stringify(searchResult.hiddenInputs, null, 2));
  console.log('Data attrs:', JSON.stringify(searchResult.dataAttrs, null, 2));

  console.log('\n=== DONE ===');
  console.log('Saved files: guidepldt_page.html, wlan5g_state.json, wlan2g_full.html');
  
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
