#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');

const ROUTER = 'https://192.168.1.1';
const USER = 'admin';
const PASS = 'Admin12345678';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Huawei AES helpers (same as upload_both.js) ──
const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
function HW_AES_AesEnhSysToLong(buf) { let o=0,v3=1; for(let i=0;i<5;i++){o+=v3*buf[i];v3*=0x5D;} return o>>>0; }
function HW_AES_LongToAesEnhSys(v) { const b=Buffer.alloc(5); v=v>>>0; for(let i=0;i<5;i++){b[i]=v%0x5D;v=Math.floor(v/0x5D);} return b; }
function HW_AES_PlainToBin(buf) { if(buf.length%5!==0)return null; const o=Buffer.alloc(buf.length*4/5); let p=0; for(let i=0;i<o.length;i+=4){o.writeUInt32LE(HW_AES_AesEnhSysToLong(buf.slice(p,p+5)),i);p+=5;} return o; }
function HW_AES_BinToPlain(buf) { const o=Buffer.alloc(buf.length*5/4); let p=0; for(let i=0;i<buf.length;i+=4){HW_AES_LongToAesEnhSys(buf.readUInt32LE(i)).copy(o,p);p+=5;} return o; }
function encryptHuawei(pt) { const IV=crypto.randomBytes(16); const cipher=crypto.createCipheriv('aes-256-cbc',Buffer.from(KEY_HEX,'hex'),IV); let e=Buffer.concat([cipher.update(Buffer.from(pt,'utf8')),cipher.final()]); const combined=Buffer.concat([e,IV]); const enc=HW_AES_BinToPlain(combined); for(let i=0;i<enc.length;i++){if(enc[i]===0x1e)enc[i]=0x7e;else enc[i]+=0x21;} return '$2'+enc.toString('ascii')+'$'; }
function decryptHuawei(s) { if(!s.startsWith('$2')||!s.endsWith('$'))return null; const t=s.substring(2,s.length-1); const b=Buffer.from(t,'ascii'); for(let i=0;i<b.length;i++){if(b[i]===0x7e)b[i]=0x1e;else b[i]-=0x21;} const BS=0x14; if(b.length%BS!==0)return null; const bc=Math.floor(b.length/BS), ivR=b.slice(bc*BS-BS,bc*BS), IV=HW_AES_PlainToBin(ivR); const da=HW_AES_PlainToBin(b.slice(0,bc*BS-BS)); if(!da||!IV)return null; const d=crypto.createDecipheriv('aes-256-cbc',Buffer.from(KEY_HEX,'hex'),IV); d.setAutoPadding(false); let dec=Buffer.concat([d.update(da),d.final()]); const pad=dec[dec.length-1]; if(pad>0&&pad<=16)dec=dec.slice(0,dec.length-pad); return dec.toString('utf8').replace(/\0+$/,''); }
function unescapeXml(s) { return s.replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(c)); }
function escapeXml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }

async function main() {
  const browser = await PUPPETEER.launch({
    headless: true, ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  // 1. Go to admin page
  console.log('[1] Loading admin page...');
  await page.goto(`${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);

  // 2. Login using the upload_both.js approach (direct evaluate)
  console.log('[2] Logging in via evaluate...');
  await page.evaluate((user, pass) => {
    window.CheckPassword=()=>0; window.setDisable=()=>{};
    window.DisplayWifiPldt=()=>{}; window.preflag=0;
    window.LockLeftTime=0; window.FailStat='0'; window.LoginTimes=0;
    const u = document.querySelector('input#txt_Username');
    const p = document.querySelector('input#txt_Password');
    if (u) u.value = user;
    if (p) { p.type = 'text'; p.value = pass; }
  }, USER, PASS);
  await sleep(500);
  
  console.log('[3] Clicking login button...');
  await page.evaluate(() => document.getElementById('button').click());
  await sleep(3000);
  console.log(`URL: ${page.url()}`);

  // 4. Navigate to config page
  console.log('[4] Going to config page...');
  await page.goto(`${ROUTER}/html/ssmp/cfgfile/cfgfile.asp`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);
  console.log(`Config page URL: ${page.url()}`);

  // 5. Get token
  const tk = await page.evaluate(() => {
    const el = document.getElementById('hwonttoken');
    return el ? el.value : '';
  });
  console.log(`Token: ${tk || 'NOT FOUND'}`);
  
  if (tk) {
    // 6. Download config
    console.log('[5] Downloading config...');
    const xml = await page.evaluate(async (token) => {
      const r = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'x.X_HW_Token=' + encodeURIComponent(token),
        credentials: 'include'
      });
      if (r.ok) return await r.text();
      return 'ERROR: ' + r.status;
    }, tk);
    
    if (xml.startsWith('ERROR')) {
      console.log(`Download error: ${xml}`);
    } else {
      console.log(`Config downloaded: ${xml.length} bytes`);
      fs.writeFileSync('router_config.xml', xml);
      
      // 7. Modify config - add URL filter entry
      console.log('[6] Modifying config...');
      let modified = xml;
      
      // Add UrlFilter entry
      const urlFilterTag = '<UrlFilter NumberOfInstances="0"/>';
      const urlFilterNew = '<UrlFilter NumberOfInstances="1"><UrlFilterInstance InstanceID="1" Url="lpb.lpbpisowifi.com" UrlPort="443" Enable="1"/></UrlFilter>';
      if (modified.includes(urlFilterTag)) {
        modified = modified.replace(urlFilterTag, urlFilterNew);
        console.log('Added URL filter entry');
      } else {
        // Try adding inside X_HW_Security
        const secEnd = '</X_HW_Security>';
        const secStart = modified.indexOf(secEnd);
        if (secStart > 0) {
          const filterAdd = '\n<UrlFilter NumberOfInstances="1"><UrlFilterInstance InstanceID="1" Url="lpb.lpbpisowifi.com" UrlPort="443" Enable="1"/></UrlFilter>\n';
          modified = modified.substring(0, secStart) + filterAdd + modified.substring(secStart);
          console.log('Inserted URL filter before X_HW_Security end');
        }
      }
      
      // Also set UrlFilterPolicy=1 and UrlFilterRight=0 (block)
      modified = modified.replace(/UrlFilterPolicy="0"/, 'UrlFilterPolicy="1"');
      
      fs.writeFileSync('modified_config.xml', modified);
      console.log('Modified config saved');
      
      // 8. Upload config
      console.log('[7] Uploading config...');
      
      // Check if we're still on config page with upload form
      const hasForm = await page.evaluate(() => !!document.getElementById('fr_uploadSetting') || !!document.querySelector('input[type=file]'));
      console.log(`Has upload form: ${hasForm}`);
      
      if (hasForm) {
        const fileInput = await page.$('input[type=file]');
        if (fileInput) {
          await fileInput.uploadFile('modified_config.xml');
          console.log('File attached');
          await sleep(500);
          
          // Submit
          await page.evaluate(() => {
            const form = document.getElementById('fr_uploadSetting');
            if (form) form.submit();
          });
          console.log('Form submitted, waiting for response...');
          await sleep(5000);
          const result = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
          console.log(`Upload result: ${result}`);
        }
      }
    }
  }

  await browser.close();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
