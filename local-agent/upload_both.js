#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const ROUTER = 'https://192.168.1.1';

const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Huawei AES helpers ──
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

function hashPassword(pwd) {
  const md5=crypto.createHash('md5').update(pwd).digest();
  return crypto.createHash('sha256').update(md5).digest('hex');
}
function pbkdf2Password(pwd, salt, count) {
  return crypto.pbkdf2Sync(pwd, salt, count, 32, 'sha256').toString('hex');
}

async function login(page) {
  await page.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await page.evaluate(() => {
    window.CheckPassword=()=>0; window.setDisable=()=>{}; window.DisplayWifiPldt=()=>{}; window.preflag=0;
    document.querySelector('input#txt_Username').value='adminpldt';
    document.querySelector('input#txt_Password').value='AC2DIU7QW3ERTY6UPAS4DFG';
  });
  await sleep(500);
  await page.evaluate(() => document.getElementById('button').click());
  await sleep(5000);
}

async function downloadConfig(page, tk) {
  let xml = await page.evaluate(async (t) => {
    try {
      const r = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
        method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'x.X_HW_Token=' + encodeURIComponent(t), credentials: 'include'
      });
      if (r.ok) return await r.text();
    } catch(e) {}
    return null;
  }, tk);
  return xml;
}

async function uploadConfig(page, filePath) {
  const fi = await page.$('input[type=file]');
  await fi.uploadFile(filePath);
  console.log('File set, submitting...');
  await Promise.all([
    page.waitForNavigation({timeout: 60000}).catch(e => console.log('Nav timeout:', e.message)),
    page.evaluate(() => document.getElementById('fr_uploadSetting').submit())
  ]);
  await sleep(3000);
  const result = await page.evaluate(() => document.body.innerText.substring(0, 200));
  console.log('Upload result:', result);
  return result.includes('Successfully');
}

(async () => {
  const NEW_PASS = 'Admin12345';
  const NEW_HASH = hashPassword(NEW_PASS);
  console.log('SHA256(MD5(password)):', NEW_HASH);

  // Verify encrypt/decrypt
  const testEnc = encryptHuawei(NEW_HASH);
  if (decryptHuawei(testEnc) !== NEW_HASH) { console.log('Encrypt/decrypt FAIL'); process.exit(1); }
  console.log('Encrypt/decrypt OK');

  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,400']});
  const p = await b.newPage();

  // ── Login ──
  await login(p);
  
  // ── Config page ──
  await p.goto(ROUTER + '/html/ssmp/cfgfile/cfgfile.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  
  const tk = await p.evaluate(() => document.getElementById('hwonttoken')?.value || '');
  console.log('Token:', tk);
  if (!tk) { console.log('No token'); await b.close(); return; }

  // ── Download ──
  let xml = await downloadConfig(p, tk);
  if (!xml) { console.log('Download failed'); await b.close(); return; }
  console.log('Downloaded:', xml.length, 'bytes');

  // Extract admin's iterate salt and count
  const adminSection = xml.match(/UserName="admin"[\s\S]*?<\/X_HW_WebUserInfoInstance>/);
  if (!adminSection) { console.log('Admin section not found'); await b.close(); return; }

  const saltMatch = adminSection[0].match(/IteratePassword[\s\S]*?Salt="([^"]+)"/);
  const countMatch = adminSection[0].match(/IteratePassword[\s\S]*?IterateCount="([^"]+)"/);
  const adminSaltMatch = xml.match(/UserName="admin"[^>]*?Salt="([^"]+)"/);

  if (!saltMatch || !countMatch) { console.log('Iterate fields not found'); await b.close(); return; }

  const iterateSalt = unescapeXml(saltMatch[1]);
  const iterateCount = parseInt(countMatch[1]);
  console.log('Admin iterate salt:', iterateSalt);
  console.log('Admin iterate count:', iterateCount);

  // Compute PBKDF2 hash
  const pbkdf2Hash = pbkdf2Password(NEW_PASS, iterateSalt, iterateCount);
  console.log('PBKDF2(password):', pbkdf2Hash);

  // Encrypt both values
  const encPassword = encryptHuawei(NEW_HASH);
  const encIterate = encryptHuawei(pbkdf2Hash);
  const escPassword = escapeXml(encPassword);
  const escIterate = escapeXml(encIterate);

  console.log('Encrypted password (first 30):', encPassword.substring(0, 30) + '...');
  console.log('Encrypted iterate (first 30):', encIterate.substring(0, 30) + '...');

  // Modify config — update BOTH Password AND IteratePassword
  const passRegex = /(<X_HW_WebUserInfoInstance[^>]*?UserName="admin"[^>]*?Password=")[^"]*(")/;
  const itRegex = /(<X_HW_IteratePassword[^>]*?Password=")[^"]*(")/;

  // Only replace within admin's section
  const adminStart = xml.indexOf('UserName="admin"');
  const adminEnd = xml.indexOf('</X_HW_WebUserInfoInstance>', adminStart) + '</X_HW_WebUserInfoInstance>'.length;

  const before = xml.substring(0, adminStart);
  const adminBlock = xml.substring(adminStart, adminEnd);
  const after = xml.substring(adminEnd);

  let modifiedAdmin = adminBlock.replace(passRegex, (m, p1, p2) => p1 + escPassword + p2);
  modifiedAdmin = modifiedAdmin.replace(itRegex, (m, p1, p2) => p1 + escIterate + p2);

  // Verify modifications
  const vPass = modifiedAdmin.match(/Password="([^"]+)"/);
  const vIter = modifiedAdmin.match(/IteratePassword[^>]*?Password="([^"]+)"/);
  if (vPass) console.log('Password decrypt test:', decryptHuawei(unescapeXml(vPass[1])) === NEW_HASH ? 'OK' : 'FAIL');
  if (vIter) console.log('Iterate decrypt test:', decryptHuawei(unescapeXml(vIter[1])) === pbkdf2Hash ? 'OK' : 'FAIL');

  const modifiedXml = before + modifiedAdmin + after;
  const filePath = __dirname + '/upload_config.xml';
  fs.writeFileSync(filePath, modifiedXml);
  console.log('Saved modified config');

  // Keep PassMode=3 (don't change it)
  const pm = modifiedXml.match(/UserName="admin"[^>]*?PassMode="([^"]+)"/);
  console.log('PassMode:', pm ? pm[1] : '?');

  // ── Upload ──
  const ok = await uploadConfig(p, filePath);
  if (!ok) { console.log('Upload FAILED'); await b.close(); return; }
  console.log('Upload SUCCESSFUL. Router will reboot.');

  // Wait for reboot
  console.log('Waiting 120s for reboot...');
  await sleep(120000);

  // Verify admin login
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', timeout: 10000, ignoreHTTPSErrors: true});
      console.log('Router back up (attempt ' + attempt + ')');
      break;
    } catch(e) {
      console.log('Waiting for router... (' + attempt + ')');
      await sleep(15000);
    }
  }

  // Clear cookies
  const cookies = await p.cookies();
  for (const c of cookies) await p.deleteCookie(c);

  console.log('\n=== Testing admin:Admin12345 ===');
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => {
    window.CheckPassword=()=>0; window.setDisable=()=>{};
    window.DisplayWifiPldt=()=>{}; window.preflag=0;
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
  const txt = await p.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('Has login form:', hl);
  console.log('Text:', txt.substring(0, 60));
  console.log('=>', hl ? '❌ FAILED' : '✅ SUCCESS');

  if (hl) {
    // Check adminpldt to verify config integrity
    await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
    await sleep(2000);
    await p.evaluate(() => {
      window.CheckPassword=()=>0; window.setDisable=()=>{};
      window.DisplayWifiPldt=()=>{}; window.preflag=0;
      document.querySelector('input#txt_Username').value='adminpldt';
      document.querySelector('input#txt_Password').value='AC2DIU7QW3ERTY6UPAS4DFG';
    });
    await sleep(500);
    await p.evaluate(() => document.getElementById('button').click());
    await sleep(5000);
    await p.goto(ROUTER + '/html/bbsp/userdevinfo/userdevinfo.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
    await sleep(1000);
    const hl2 = await p.evaluate(() => !!document.querySelector('input#txt_Username'));
    console.log('adminpldt:', hl2 ? '❌ FAILED' : '✅ works');
  }

  await b.close();
})();
