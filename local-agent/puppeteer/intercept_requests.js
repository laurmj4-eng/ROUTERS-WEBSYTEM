#!/usr/bin/env node
/**
 * Intercept ALL network requests the WLAN page makes.
 * The admin JS may call hidden data endpoints that return raw config values.
 */
const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:true, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors']});
  const [p] = await b.pages();

  // Enable request interception
  await p.setRequestInterception(true);

  const captured = [];

  p.on('request', req => {
    const url = req.url();
    if (url.includes('192.168.1.1') && 
        !url.includes('.js') && 
        !url.includes('.css') && 
        !url.includes('.png') &&
        !url.includes('.gif') &&
        !url.includes('.ico') &&
        !url.includes('font')) {
      captured.push({ method: req.method(), url: url, type: req.resourceType(), headers: req.headers() });
    }
    req.continue();
  });

  p.on('response', async res => {
    const url = res.url();
    if (url.includes('192.168.1.1') && 
        !url.includes('.js') && 
        !url.includes('.css') && 
        !url.includes('.png') &&
        !url.includes('.gif') &&
        !url.includes('.ico') &&
        !url.includes('font')) {
      try {
        const text = await res.text().catch(() => '');
        const entry = captured.find(c => c.url === url);
        if (entry) entry.body = text.substring(0, 2000);
        entry.status = res.status();
      } catch(e) {}
    }
  });

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.CheckPassword=()=>0; window.setDisable=()=>{}; window.Userlevel=0; window.preflag=0; });
  await p.type('input#txt_Username','adminpldt',{delay:20});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:20});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  // Clear captured (login noise)
  captured.length = 0;

  // Navigate to WLAN page
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  console.log('=== Network requests during WLAN page load ===');
  for (const c of captured) {
    console.log(`\n${c.method} ${c.url}`);
    console.log(`  Status: ${c.status}, Type: ${c.type}`);
    if (c.body && c.body.length > 50) {
      // Check for non-asterisk values
      if (!c.body.includes('Cannot perform') && !c.body.includes('function(')) {
        console.log(`  Body preview: ${c.body.substring(0, 500)}`);
      }
    }
  }

  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
