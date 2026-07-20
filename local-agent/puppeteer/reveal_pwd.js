#!/usr/bin/env node
/**
 * Login to router, go to WiFi admin page, reveal the password field.
 * Changes type="password" to type="text" so you can see the asterisks as text.
 */
const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Step 1: Login
  console.log('Logging in...');
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.CheckPassword=()=>0; window.setDisable=()=>{}; window.Userlevel=0; window.preflag=0; });
  await p.type('input#txt_Username','adminpldt',{delay:30});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:20});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  // Step 2: Navigate to WiFi 2.4G admin page
  console.log('Navigating to WiFi settings...');
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  // Step 3: Reveal the password — change input type from password to text
  console.log('Revealing password field...');
  await p.evaluate(() => {
    // Change the main password field
    const pw = document.getElementById('wlWpaPsk');
    if (pw) {
      pw.type = 'text';
      pw.style.backgroundColor = '#ffffcc'; // highlight it
      pw.style.fontWeight = 'bold';
      pw.style.fontSize = '14px';
    }
    // Also reveal the text version
    const txt = document.getElementById('twlWpaPsk');
    if (txt) {
      txt.style.display = '';
      txt.style.backgroundColor = '#ffffcc';
      txt.style.fontWeight = 'bold';
    }
    // Also show WEP keys if any
    for (let i = 1; i <= 4; i++) {
      const k = document.getElementById('wlKeys' + i);
      if (k) k.type = 'text';
      const tk = document.getElementById('twlKeys' + i);
      if (tk) tk.style.display = '';
    }
    // Make the show/hide checkbox visible and click it
    const cb = document.getElementById('hidewlWpaPsk');
    if (cb) {
      cb.style.display = '';
      cb.checked = false;
    }
    // Show any hidden labels
    const hideId2 = document.getElementById('hideId2');
    if (hideId2) hideId2.style.display = '';
    const hidewlWpaPsk_icon = document.getElementById('hidewlWpaPsk_icon');
    if (hidewlWpaPsk_icon) hidewlWpaPsk_icon.style.display = '';
  });

  console.log('Done! Password field is now text — you can see the value.');
  console.log('Close the browser window to exit.');

  // Keep open
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
