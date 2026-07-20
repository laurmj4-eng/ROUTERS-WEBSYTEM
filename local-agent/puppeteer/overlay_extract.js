#!/usr/bin/env node
/**
 * Login WITHOUT bypasses to trigger PLDT2 overlay,
 * then extract ALL passwords from the page.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,900']});
  const [p] = await b.pages();

  // Capture ALL network responses
  const responses = [];
  p.on('response', async res => {
    try {
      const url = res.url();
      if (url.includes('.asp') || url.includes('.cgi') || url.includes('.xml')) {
        const text = await res.text().catch(() => '');
        responses.push({ url: url.substring(0, 200), status: res.status(), text: text.substring(0, 5000) });
      }
    } catch(e) {}
  });

  // Login without bypasses to trigger PLDT2 overlay
  console.log('Navigating to login...');
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));

  // Only override setDisable so the button works (do NOT set preflag=0, do NOT override CheckPassword)
  await p.evaluate(() => { window.setDisable = () => {}; });

  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,8000));

  console.log('URL after login:', p.url());

  // Capture ALL JavaScript variables and DOM content
  const state = await p.evaluate(() => {
    const r = {};

    // 1. pwd_modify overlay
    const ov = document.getElementById('pwd_modify');
    if (ov) {
      r.overlay = {
        display: ov.style.display,
        html: ov.innerHTML.substring(0, 2000),
      };
      // All inputs in overlay
      r.overlayInputs = {};
      ov.querySelectorAll('input').forEach(el => {
        r.overlayInputs[el.id || el.name] = {
          value: el.value || '',
          type: el.type,
          placeholder: el.placeholder || '',
        };
      });
    }

    // 2. ALL input fields on the page
    r.allInputs = {};
    document.querySelectorAll('input').forEach(el => {
      if (el.id || el.name) {
        r.allInputs[el.id || el.name] = {
          value: el.value || '',
          type: el.type,
          display: el.style.display,
        };
      }
    });

    // 3. JavaScript global variables
    r.jsVars = {};
    const varsToCheck = [
      'WlanWifiArr', 'wlanWifiArr', 'wifiPasswordMask',
      'preflag', 'CfgMode', 'Userlevel', 'gUser', 'gUserId',
      'ssid_2g', 'ssid_5g', 'wifiPskKey', 'wpaPskKey',
      'wlWpaPsk', 'wlSsid', 'wlWpaGlobalPsk',
      'loid', 'password', 'adminPassword', 'adminName',
    ];
    varsToCheck.forEach(v => {
      try { r.jsVars[v] = JSON.stringify(window[v]).substring(0, 500); } catch(e) { r.jsVars[v] = 'ERROR'; }
    });

    // 4. Read entire body as text
    r.bodyText = document.body?.innerText?.substring(0, 3000) || '';

    return r;
  });

  console.log('\n=== STATE DUMP ===');
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\overlay_state.json', JSON.stringify(state, null, 2));

  console.log('Overlay:', JSON.stringify(state.overlay, null, 2));
  console.log('Overlay Inputs:', JSON.stringify(state.overlayInputs, null, 2));
  console.log('JS Vars:', JSON.stringify(state.jsVars, null, 2));

  // 5. Now navigate to WLAN page to check there too
  console.log('\n=== Navigating to WlanBasic.asp?2G ===');
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,5000));

  const wlanState = await p.evaluate(() => {
    const r = {};
    r.allInputs = {};
    document.querySelectorAll('input').forEach(el => {
      if (el.id || el.name) r.allInputs[el.id || el.name] = el.value || '';
    });

    r.jsVars = {};
    ['WlanWifiArr', 'wlanWifiArr', 'wifiPasswordMask', 'wlWpaPsk', 'twlWpaPsk', 'wlSsid', 'wlWpaGlobalPsk', 'wpaPskKey'].forEach(v => {
      try { r.jsVars[v] = JSON.stringify(window[v]).substring(0, 500); } catch(e) {}
    });

    // Check ALL global variables
    r.allGlobals = {};
    try {
      for (const key in window) {
        if (typeof window[key] === 'string' && window[key].length > 0 && window[key].length < 500) {
          if (key.toLowerCase().includes('pass') || key.toLowerCase().includes('psk') || key.toLowerCase().includes('ssid') || key.toLowerCase().includes('wifi') || key.toLowerCase().includes('wlan')) {
            r.allGlobals[key] = window[key];
          }
        }
      }
    } catch(e) {}

    // Body text
    r.bodyText = document.body?.innerText?.substring(0, 2000) || '';
    return r;
  });

  console.log('WLAN Inputs:', JSON.stringify(wlanState.allInputs, null, 2));
  console.log('WLAN JS Vars:', JSON.stringify(wlanState.jsVars, null, 2));
  console.log('WLAN Globals:', JSON.stringify(wlanState.allGlobals, null, 2));
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\wlan_state.json', JSON.stringify(wlanState, null, 2));

  // Save network responses
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\net_responses.json', JSON.stringify(responses, null, 2));
  console.log('\nNetwork responses saved. Count:', responses.length);

  console.log('\n=== DONE ===');
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
