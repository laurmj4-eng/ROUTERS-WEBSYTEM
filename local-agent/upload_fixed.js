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

function sha256(password) { return crypto.createHash('sha256').update(password, 'utf8').digest('hex'); }

const NEW_PASS = 'Admin12345';
// PassMode 2 uses SHA256(password) directly
const NEW_HASH = sha256(NEW_PASS);
// Also compute SHA256(MD5(password)) in case PassMode 3 is used
const NEW_HASH_MD5 = (function() { const m=crypto.createHash('md5').update(NEW_PASS).digest(); return crypto.createHash('sha256').update(m).digest('hex'); })();
console.log('SHA256(password):', NEW_HASH, '(for PassMode 2)');
console.log('SHA256(MD5(password)):', NEW_HASH_MD5, '(for PassMode 1/3)');

(async () => {
  const testEnc = encryptHuawei(NEW_HASH);
  if (decryptHuawei(testEnc) !== NEW_HASH) { console.log('Encrypt/decrypt FAIL'); process.exit(1); }

  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,400']});
  const p = await b.newPage();

  // Login
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => { window.CheckPassword=()=>0; window.setDisable=()=>{}; window.DisplayWifiPldt=()=>{}; window.preflag=0; document.querySelector('input#txt_Username').value='adminpldt'; document.querySelector('input#txt_Password').value='AC2DIU7QW3ERTY6UPAS4DFG'; });
  await sleep(500);
  await p.evaluate(() => document.getElementById('button').click());
  await sleep(5000);

  await p.goto(ROUTER + '/html/ssmp/cfgfile/cfgfile.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);

  const tk = await p.evaluate(() => document.getElementById('hwonttoken')?.value || '');
  if (!tk) { console.log('No token'); await b.close(); return; }
  console.log('Token:', tk);

  // Download config
  let xml = await p.evaluate(async (t) => {
    try { const r = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:'x.X_HW_Token='+encodeURIComponent(t), credentials:'include' }); if(r.ok) return await r.text(); } catch(e) {}
    return null;
  }, tk);
  if (!xml) { console.log('Download failed'); await b.close(); return; }
  console.log('Downloaded:', xml.length, 'bytes');

  const escPassword = escapeXml(encryptHuawei(NEW_HASH));

  // Modify config — replace admin Password only, keep PassMode as-is (currently 2)
  xml = xml.replace(
    /(<X_HW_WebUserInfoInstance[^>]*?UserName="admin"[^>]*?Password=")[^"]*(")/,
    (m, p1, p2) => p1 + escPassword + p2
  );

  // Verify
  const vMatch = xml.match(/UserName="admin"[^>]*?Password="([^"]+)"/);
  if (vMatch) {
    const dec = decryptHuawei(unescapeXml(vMatch[1]));
    console.log('Verification:', dec === NEW_HASH ? 'PASS' : 'FAIL (got: ' + dec + ')');
    if (dec !== NEW_HASH) { await b.close(); return; }
  }

  // Save and upload
  const fp = __dirname + '/upload_config.xml';
  fs.writeFileSync(fp, xml);

  const fi = await p.$('input[type=file]');
  await fi.uploadFile(fp);
  console.log('Uploading...');
  await Promise.all([
    p.waitForNavigation({timeout: 60000}).catch(e => console.log('Nav timeout:', e.message)),
    p.evaluate(() => document.getElementById('fr_uploadSetting').submit())
  ]);
  await sleep(3000);
  const result = await p.evaluate(() => document.body.innerText.substring(0, 200));
  console.log('Upload result:', result);
  if (!result.includes('Successfully')) { console.log('Upload FAILED'); await b.close(); return; }

  // Wait for reboot
  console.log('Waiting for router to reboot...');
  for (let i = 0; i < 30; i++) {
    try {
      await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', timeout: 10000, ignoreHTTPSErrors: true});
      console.log('Router back up after ~' + (i + 1) * 10 + 's');
      break;
    } catch(e) {
      await sleep(10000);
    }
  }

  // Clear cookies and test admin
  const cookies = await p.cookies();
  for (const c of cookies) await p.deleteCookie(c);
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => {
    window.CheckPassword=()=>0; window.setDisable=()=>{}; window.DisplayWifiPldt=()=>{}; window.preflag=0;
    window.LockLeftTime=0; window.FailStat='0'; window.LoginTimes=0;
    document.querySelector('input#txt_Username').value='admin';
    document.querySelector('input#txt_Password').value='Admin12345';
  });
  await sleep(500);
  await p.evaluate(() => document.getElementById('button').click());
  await sleep(5000);
  console.log('Login URL:', p.url());

  await p.goto(ROUTER + '/html/bbsp/userdevinfo/userdevinfo.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(1000);
  const hl = await p.evaluate(() => !!document.querySelector('input#txt_Username'));
  console.log('admin login:', hl ? '❌ FAILED' : '✅ SUCCESS');

  await b.close();
})();
