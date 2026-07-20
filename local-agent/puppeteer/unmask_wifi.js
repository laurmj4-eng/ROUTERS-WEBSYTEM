#!/usr/bin/env node
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(()=>{window.CheckPassword=()=>0;window.setDisable=()=>{};window.Userlevel=0;window.preflag=0;});
  await p.type('input#txt_Username','adminpldt',{delay:30});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:20});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  // Navigate to WiFi 2.4G page
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,4000));

  // Find all show/hide elements and checkboxes
  const info = await p.evaluate(() => {
    const r = {};

    // Check for show/hide checkbox
    const cb = document.getElementById('hidewlWpaPsk');
    r.hidewlWpaPsk = cb ? { exists: true, checked: cb.checked, display: cb.style.display } : { exists: false };

    // All checkboxes on page
    r.checkboxes = [];
    document.querySelectorAll('input[type=checkbox]').forEach(c => {
      r.checkboxes.push({ id: c.id, checked: c.checked, display: c.style.display });
    });

    // Password fields
    const pw = document.getElementById('wlWpaPsk');
    r.wlWpaPsk = pw ? { value: pw.value, type: pw.type, display: pw.style.display } : null;
    r.twlWpaPsk_el = document.getElementById('twlWpaPsk');
    r.twlWpaPsk = r.twlWpaPsk_el ? { value: r.twlWpaPsk_el.value, type: r.twlWpaPsk_el.type, display: r.twlWpaPsk_el.style.display } : null;

    // Elements with Show/Hide in ID
    r.showHideEls = [];
    document.querySelectorAll('[id*="hide" i], [id*="show" i]').forEach(el => {
      r.showHideEls.push({ id: el.id, tag: el.tagName, type: el.type, value: el.value, display: el.style.display });
    });

    // wifiPasswordMask
    try { r.wifiPasswordMask = window.wifiPasswordMask; } catch(e) {}

    return r;
  });
  console.log('Page info:', JSON.stringify(info, null, 2));

  // If checkbox exists, click it
  if (info.hidewlWpaPsk.exists) {
    await p.evaluate(() => {
      const cb = document.getElementById('hidewlWpaPsk');
      if (cb) { cb.click(); }
    });
    await new Promise(r => setTimeout(r,1000));
    const after = await p.evaluate(() => {
      return {
        wlWpaPsk: document.getElementById('wlWpaPsk')?.value,
        twlWpaPsk: document.getElementById('twlWpaPsk')?.value,
        twlWpaPsk_display: document.getElementById('twlWpaPsk')?.style?.display,
      };
    });
    console.log('After checkbox click:', JSON.stringify(after));
  }

  // Get password from Windows
  let wifiPwd = null;
  try {
    const out = execSync('netsh wlan show profile name="PLDTHOMEFIBR_5G" key=clear', { encoding: 'utf8', timeout: 5000 });
    const match = out.match(/Key Content\s*:\s*(.+)/);
    if (match) wifiPwd = match[1].trim();
  } catch(e) {}
  console.log('WiFi password from Windows:', wifiPwd || 'not found');

  // Unmask the password on the page: change type to text and set real value
  if (wifiPwd) {
    await p.evaluate((pwd) => {
      const pw = document.getElementById('wlWpaPsk');
      if (pw) {
        pw.type = 'text';
        pw.value = pwd;
      }
      // Also show the text version
      const txt = document.getElementById('twlWpaPsk');
      if (txt) {
        txt.style.display = '';
        txt.value = pwd;
      }
    }, wifiPwd);
    console.log('Password unmasked on page!');
  }

  // Keep browser open
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
