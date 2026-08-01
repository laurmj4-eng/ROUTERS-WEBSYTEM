#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const ROUTER = 'https://192.168.1.1';

const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function HW_AES_AesEnhSysToLong(buf) { let o=0,v3=1; for(let i=0;i<5;i++){o+=v3*buf[i];v3*=0x5D;} return o>>>0; }
function HW_AES_LongToAesEnhSys(v) { const b=Buffer.alloc(5); v=v>>>0; for(let i=0;i<5;i++){b[i]=v%0x5D;v=Math.floor(v/0x5D);} return b; }
function HW_AES_PlainToBin(buf) { if(buf.length%5!==0)return null; const o=Buffer.alloc(buf.length*4/5); let p=0; for(let i=0;i<o.length;i+=4){o.writeUInt32LE(HW_AES_AesEnhSysToLong(buf.slice(p,p+5)),i);p+=5;} return o; }
function HW_AES_BinToPlain(buf) { const o=Buffer.alloc(buf.length*5/4); let p=0; for(let i=0;i<buf.length;i+=4){HW_AES_LongToAesEnhSys(buf.readUInt32LE(i)).copy(o,p);p+=5;} return o; }
function encryptHuawei(pt) {
  const IV=crypto.randomBytes(16);
  const cipher=crypto.createCipheriv('aes-256-cbc',Buffer.from(KEY_HEX,'hex'),IV);
  let e=Buffer.concat([cipher.update(Buffer.from(pt,'utf8')),cipher.final()]);
  const combined=Buffer.concat([e,IV]);
  const enc=HW_AES_BinToPlain(combined);
  for(let i=0;i<enc.length;i++){if(enc[i]===0x1e)enc[i]=0x7e;else enc[i]+=0x21;}
  return '$2'+enc.toString('ascii')+'$';
}
function decryptHuawei(s) {
  if(!s.startsWith('$2')||!s.endsWith('$'))return null;
  const t=s.substring(2,s.length-1);
  const b=Buffer.from(t,'ascii');
  for(let i=0;i<b.length;i++){if(b[i]===0x7e)b[i]=0x1e;else b[i]-=0x21;}
  const BS=0x14; if(b.length%BS!==0)return null;
  const bc=Math.floor(b.length/BS), ivR=b.slice(bc*BS-BS,bc*BS), IV=HW_AES_PlainToBin(ivR);
  const da=HW_AES_PlainToBin(b.slice(0,bc*BS-BS)); if(!da||!IV)return null;
  const d=crypto.createDecipheriv('aes-256-cbc',Buffer.from(KEY_HEX,'hex'),IV); d.setAutoPadding(false);
  let dec=Buffer.concat([d.update(da),d.final()]); const pad=dec[dec.length-1];
  if(pad>0&&pad<=16)dec=dec.slice(0,dec.length-pad);
  return dec.toString('utf8').replace(/\0+$/,'');
}
function unescapeXml(s) { return s.replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(c)); }
function escapeXml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
function hashPassword(pwd) { const md5=crypto.createHash('md5').update(pwd).digest(); return crypto.createHash('sha256').update(md5).digest('hex'); }

const NEW_PASS = 'Admin12345';
const NEW_HASH = hashPassword(NEW_PASS);
console.log('New hash:', NEW_HASH);

// Verify encrypt/decrypt
const encTest = encryptHuawei(NEW_HASH);
const decTest = decryptHuawei(encTest);
if (decTest !== NEW_HASH) { console.log('Roundtrip FAIL'); process.exit(1); }
console.log('Roundtrip OK');

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();
  
  // ── Login ──
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => { window.CheckPassword=()=>0; window.setDisable=()=>{}; window.DisplayWifiPldt=()=>{}; window.preflag=0; document.querySelector('input#txt_Username').value='adminpldt'; document.querySelector('input#txt_Password').value='AC2DIU7QW3ERTY6UPAS4DFG'; });
  await sleep(500);
  await p.evaluate(() => document.getElementById('button').click());
  await sleep(5000);
  
  // ── Config page ──
  await p.goto(ROUTER + '/html/ssmp/cfgfile/cfgfile.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  
  // Dump form info
  const formInfo = await p.evaluate(() => {
    const f = document.getElementById('fr_uploadSetting');
    if (!f) return {error: 'no form'};
    const inputs = Array.from(f.querySelectorAll('input')).map(i => ({id: i.id, name: i.name, type: i.type, value: i.value}));
    return {action: f.action, method: f.method, enctype: f.enctype, inputs};
  });
  console.log('Form info:', JSON.stringify(formInfo, null, 2));
  
  const tk = await p.evaluate(() => document.getElementById('hwonttoken')?.value || '');
  console.log('Token:', tk);
  
  // ── Download config ──
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
  if (!xml) { console.log('Download failed'); await b.close(); return; }
  console.log('Downloaded:', xml.length, 'bytes');
  
  // Check if file already modified (maybe previous upload changed it)
  const m = xml.match(/UserName="admin"[^>]*?Password="([^"]+)"/);
  if (m) {
    const dec = decryptHuawei(unescapeXml(m[1]));
    console.log('Current admin hash:', dec);
    if (dec === NEW_HASH) { console.log('Already modified!'); }
  }
  
  // ── Modify XML ──
  const encPwd = encryptHuawei(NEW_HASH);
  const escaped = escapeXml(encPwd);
  
  // Replace Password (use function to avoid $ backreference corruption)
  xml = xml.replace(
    /(<X_HW_WebUserInfoInstance[^>]*?UserName="admin"[^>]*?Password=")[^"]*(")/,
    (m, p1, p2) => p1 + escaped + p2
  );
  // Also change PassMode to 1 to use simple SHA256(MD5()) hash
  xml = xml.replace(
    /(<X_HW_WebUserInfoInstance[^>]*?UserName="admin"[^>]*?PassMode=")3(")/,
    (m, p1, p2) => p1 + '1' + p2
  );
  
  // Verify
  const vm = xml.match(/UserName="admin"[^>]*?Password="([^"]+)"/);
  const vp = xml.match(/UserName="admin"[^>]*?PassMode="([^"]+)"/);
  if (vm) console.log('Modified pwd verifies:', decryptHuawei(unescapeXml(vm[1])) === NEW_HASH ? 'OK' : 'FAIL');
  console.log('PassMode:', vp ? vp[1] : '?');
  console.log('PassMode changed:', vp && vp[1] === '1' ? 'YES' : 'NO');
  
  // ── Upload via NATIVE form submission ──
  // Set the file input using CDP to bypass DataTransfer limitations
  const filePath = require('path').join(__dirname, 'upload_config.xml');
  fs.writeFileSync(filePath, xml);
  console.log('Saved upload config to:', filePath);
  
  // Set file on input and submit
  const fileInput = await p.$('input[type=file]');
  await fileInput.uploadFile(filePath);
  console.log('File set on input');
  
  // Submit form and wait for navigation
  console.log('Submitting form...');
  await Promise.all([
    p.waitForNavigation({timeout: 60000}).catch(e => { console.log('Nav error:', e.message); }),
    p.evaluate(() => document.getElementById('fr_uploadSetting').submit())
  ]);
  
  await sleep(5000);
  console.log('URL after upload:', p.url());
  const pageText = await p.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Page text:', pageText);
  
  // ── Wait for any processing, then check ──
  await sleep(10000);
  
  // Re-login and check admin
  console.log('\n=== Verifying admin:Admin12345 ===');
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  
  // Clear existing cookies to get fresh session
  const cookies = await p.cookies();
  for (const c of cookies) { await p.deleteCookie(c); }
  
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => { window.CheckPassword=()=>0; window.setDisable=()=>{}; window.DisplayWifiPldt=()=>{}; window.preflag=0; LockLeftTime=0; FailStat='0'; LoginTimes=0; document.querySelector('input#txt_Username').value='admin'; document.querySelector('input#txt_Password').value='Admin12345'; });
  await sleep(500);
  await p.evaluate(() => document.getElementById('button').click());
  await sleep(5000);
  console.log('Post-login URL:', p.url());
  
  await p.goto(ROUTER + '/html/bbsp/userdevinfo/userdevinfo.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(1000);
  const hl = await p.evaluate(() => !!document.querySelector('input#txt_Username'));
  const txt = await p.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('Has login form:', hl);
  console.log('Text:', txt.substring(0, 60));
  console.log('=>', hl ? '❌ FAILED' : '✅ SUCCESS');
  
  await b.close();
})();
