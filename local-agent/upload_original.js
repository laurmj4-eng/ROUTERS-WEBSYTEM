#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const fs = require('fs');
const ROUTER = 'https://192.168.1.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();
  
  // Login
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => { window.CheckPassword=()=>0; window.setDisable=()=>{}; window.DisplayWifiPldt=()=>{}; window.preflag=0; document.querySelector('input#txt_Username').value='adminpldt'; document.querySelector('input#txt_Password').value='AC2DIU7QW3ERTY6UPAS4DFG'; });
  await sleep(500);
  await p.evaluate(() => document.getElementById('button').click());
  await sleep(5000);
  
  // Config page
  await p.goto(ROUTER + '/html/ssmp/cfgfile/cfgfile.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  
  const tk = await p.evaluate(() => document.getElementById('hwonttoken')?.value || '');
  console.log('Token:', tk);
  
  // Download original unmodified config
  let xml = await p.evaluate(async (t) => {
    try {
      const r = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
        method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'x.X_HW_Token=' + encodeURIComponent(t), credentials: 'include'
      });
      if (r.ok) return await r.text();
    } catch(e) {}
    return null;
  }, tk);
  console.log('Downloaded:', xml?.length, 'bytes');
  
  // Save original config
  const origPath = require('path').join(__dirname, 'original_config.xml');
  fs.writeFileSync(origPath, xml);
  console.log('Saved original to:', origPath);
  
  // Upload original config (unmodified)
  const fileInput = await p.$('input[type=file]');
  await fileInput.uploadFile(origPath);
  console.log('File set');
  
  console.log('Submitting original config...');
  await Promise.all([
    p.waitForNavigation({timeout: 60000}).catch(e => console.log('Nav error:', e.message)),
    p.evaluate(() => document.getElementById('fr_uploadSetting').submit())
  ]);
  await sleep(3000);
  console.log('URL:', p.url());
  const txt = await p.evaluate(() => document.body.innerText.substring(0, 200));
  console.log('Page text:', txt);
  
  await b.close();
})();
