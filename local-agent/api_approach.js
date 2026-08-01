#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const ROUTER = 'https://192.168.1.1';
const USER = 'admin';
const PASS = 'Admin12345678';
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Huawei encryption helpers
const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
function HW_AES_AesEnhSysToLong(buf) { let o=0,v3=1; for(let i=0;i<5;i++){o+=v3*buf[i];v3*=0x5D;} return o>>>0; }
function HW_AES_LongToAesEnhSys(v) { const b=Buffer.alloc(5); v=v>>>0; for(let i=0;i<5;i++){b[i]=v%0x5D;v=Math.floor(v/0x5D);} return b; }
function HW_AES_PlainToBin(buf) { if(buf.length%5!==0)return null; const o=Buffer.alloc(buf.length*4/5); let p=0; for(let i=0;i<o.length;i+=4){o.writeUInt32LE(HW_AES_AesEnhSysToLong(buf.slice(p,p+5)),i);p+=5;} return o; }
function HW_AES_BinToPlain(buf) { const o=Buffer.alloc(buf.length*5/4); let p=0; for(let i=0;i<buf.length;i+=4){HW_AES_LongToAesEnhSys(buf.readUInt32LE(i)).copy(o,p);p+=5;} return o; }
function encryptHuawei(pt) { const IV=crypto.randomBytes(16); const cipher=crypto.createCipheriv('aes-256-cbc',Buffer.from(KEY_HEX,'hex'),IV); let e=Buffer.concat([cipher.update(Buffer.from(pt,'utf8')),cipher.final()]); const combined=Buffer.concat([e,IV]); const enc=HW_AES_BinToPlain(combined); for(let i=0;i<enc.length;i++){if(enc[i]===0x1e)enc[i]=0x7e;else enc[i]+=0x21;} return '$2'+enc.toString('ascii')+'$'; }

async function main() {
  const browser = await PUPPETEER.launch({
    headless: true, ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  // Login
  await page.goto(`${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);
  await page.evaluate((u, p) => {
    window.CheckPassword=()=>0; window.setDisable=()=>{}; window.DisplayWifiPldt=()=>{}; window.preflag=0;
    document.querySelector('input#txt_Username').value = u;
    const pw = document.querySelector('input#txt_Password');
    if (pw) pw.type = 'text'; pw.value = p;
  }, USER, PASS);
  await sleep(500);
  await page.evaluate(() => document.getElementById('button').click());
  await sleep(5000);
  console.log(`URL: ${page.url()}`);

  // Now call API endpoints from within the logged-in page context
  // Use saveConfig.cgi or similar to save settings
  // Or use webSubmitForm to add a URL filter

  // First, let's try setting a DNS hijack via set.cgi
  // This is a known Huawei CGI that can set TR-069 parameters
  
  console.log('\n[API] Trying to add URL filter via submit...');

  // Approach: Use webSubmitForm (available on the admin page) to set URL filter
  const result1 = await page.evaluate(async () => {
    const results = [];
    
    // Get a fresh token first
    try {
      const tResp = await fetch('/html/ssmp/common/getRandString.asp');
      const token = (await tResp.text()).trim();
      results.push('Token: ' + token);
      
      // Try set.cgi to add UrlFilter
      // UrlFilter is at: InternetGatewayDevice.X_HW_Security.UrlFilter.1
      // Or try the set.cgi with a parameter
      
      // Method: Directly try cfgfiledown.cgi with token
      const dlResp = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'x.X_HW_Token=' + encodeURIComponent(token),
        credentials: 'include'
      });
      results.push('Config download: HTTP ' + dlResp.status + ', ' + (await dlResp.text()).substring(0, 100));
    } catch(e) {
      results.push('Error: ' + e.message);
    }
    
    return results;
  });
  result1.forEach(r => console.log('  ' + r));

  // Try using the webSubmitForm class to add URL filter
  console.log('\n[API] Trying webSubmitForm to add URL filter...');
  const result2 = await page.evaluate(async () => {
    const results = [];
    
    // Get fresh token
    const tResp = await fetch('/html/ssmp/common/getRandString.asp');
    const token = (await tResp.text()).trim();
    results.push('Token: ' + token);
    
    // Try to use webSubmitForm - create form and set URL filter
    // The URL filter CGI might be at specific paths
    try {
      // Try multiple CGI endpoints
      const cgis = [
        { url: '/set.cgi?x=InternetGatewayDevice.X_HW_Security.UrlFilter.1.Url&RequestFile=admin.html', method: 'POST' },
        { url: '/html/ssmp/security/urlfilter.cgi', method: 'POST' },
      ];
      
      for (const cgi of cgis) {
        try {
          const r = await fetch(cgi.url, {
            method: cgi.method,
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: 'x.X_HW_Token=' + encodeURIComponent(token) + '&Url=lpb.lpbpisowifi.com&Enable=1',
            credentials: 'include'
          });
          results.push(cgi.url + ': HTTP ' + r.status + ' ' + (await r.text()).substring(0, 100));
        } catch(e) {
          results.push(cgi.url + ': Error ' + e.message);
        }
      }
    } catch(e) {
      results.push('Error: ' + e.message);
    }
    
    return results;
  });
  result2.forEach(r => console.log('  ' + r));

  await browser.close();
}
main().catch(err => { console.error('Error:', err.message); process.exit(1); });
