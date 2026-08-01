#!/usr/bin/env node
/**
 * Encrypt a password hash using Huawei's AES scheme and substitute it into the config.
 * Then upload the modified config back to the router.
 */
const PUPPETEER = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const ROUTER = 'https://192.168.1.1';

const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Huawei AES encoding/decoding ──

function HW_AES_AesEnhSysToLong(buf) {
  let out = 0, v3 = 1;
  for (let i = 0; i < 5; i++) { out += v3 * buf[i]; v3 *= 0x5D; }
  return out >>> 0;
}

function HW_AES_LongToAesEnhSys(val) {
  const buf = Buffer.alloc(5);
  let v = val >>> 0;
  for (let i = 0; i < 5; i++) { buf[i] = v % 0x5D; v = Math.floor(v / 0x5D); }
  return buf;
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

function HW_AES_BinToPlain(buf) {
  const out = Buffer.alloc(buf.length * 5 / 4);
  let pos = 0;
  for (let i = 0; i < buf.length; i += 4) {
    HW_AES_LongToAesEnhSys(buf.readUInt32LE(i)).copy(out, pos);
    pos += 5;
  }
  return out;
}

function encryptHuawei(plaintext) {
  const IV = crypto.randomBytes(16);
  const key = Buffer.from(KEY_HEX, 'hex');
  // Let Node.js handle PKCS7 padding via cipher.final()
  const cipher = crypto.createCipheriv('aes-256-cbc', key, IV);
  let encrypted = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);

  // Encode ciphertext + IV with BinToPlain
  const combined = Buffer.concat([encrypted, IV]); // IV appended at the end
  const encoded = HW_AES_BinToPlain(combined);

  // Apply ASCII offset transformation (reverse of decrypt)
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === 0x1e) encoded[i] = 0x7e;
    else encoded[i] += 0x21;
  }

  return '$2' + encoded.toString('ascii') + '$';
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

function hashPassword(pwd) {
  const md5 = crypto.createHash('md5').update(pwd).digest();
  return crypto.createHash('sha256').update(md5).digest('hex');
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ── Main ──

async function main() {
  const NEW_ADMIN_PASS = 'Admin12345';
  const NEW_HASH = hashPassword(NEW_ADMIN_PASS);
  console.log('New password hash:', NEW_HASH);

  // Verify encrypt/decrypt roundtrip
  const encTest = encryptHuawei(NEW_HASH);
  const decTest = decryptHuawei(encTest);
  console.log('Encrypt/decrypt roundtrip test:', decTest === NEW_HASH ? 'PASS' : 'FAIL');
  if (decTest !== NEW_HASH) { process.exit(1); }

  const browser = await PUPPETEER.launch({
    headless: true, ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors', '--disable-web-security'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  // ── Login as adminpldt ──
  await page.goto(ROUTER + '/admin.html', { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);
  await page.evaluate(() => {
    window.CheckPassword = () => 0; window.setDisable = () => {};
    window.DisplayWifiPldt = () => {}; window.preflag = 0;
    document.querySelector('input#txt_Username').value = 'adminpldt';
    document.querySelector('input#txt_Password').value = 'AC2DIU7QW3ERTY6UPAS4DFG';
  });
  await sleep(500);
  await page.evaluate(() => document.getElementById('button').click());
  await sleep(5000);

  // ── Go to config page ──
  await page.goto(ROUTER + '/html/ssmp/cfgfile/cfgfile.asp', { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);

  // Get token
  const token = await page.evaluate(() => {
    const el = document.getElementById('hwonttoken');
    return el ? el.value : null;
  });
  console.log('Token:', token);
  if (!token) { console.log('No token - exiting'); await browser.close(); return; }

  // ── Download config ──
  console.log('Downloading config...');
  let xmlContent = await page.evaluate(async (tk) => {
    try {
      const r = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'x.X_HW_Token=' + encodeURIComponent(tk),
        credentials: 'include'
      });
      if (r.ok) return await r.text();
    } catch(e) {}
    return null;
  }, token);

  if (!xmlContent || xmlContent.length < 1000) {
    console.log('Fetch failed, trying XHR...');
    xmlContent = await page.evaluate((tk) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', false);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.send('x.X_HW_Token=' + encodeURIComponent(tk));
        if (xhr.status === 200 && xhr.responseText.length > 1000) return xhr.responseText;
      } catch(e) {}
      return null;
    }, token);
  }

  if (!xmlContent) { console.log('Download failed'); await browser.close(); return; }
  console.log('Downloaded:', xmlContent.length, 'bytes');

  // ── Modify admin password in XML ──
  const encryptedNewPass = encryptHuawei(NEW_HASH);
  const escapedEncPass = escapeXml(encryptedNewPass);
  console.log('New encrypted password (first 40 chars):', encryptedNewPass.substring(0, 40) + '...');

  // Match the admin WebUserInfoInstance Password attribute
  const adminPwdRegex = /(<X_HW_WebUserInfoInstance[^>]*?UserName="admin"[^>]*?Password=")([^"]*)(")/;
  const match = xmlContent.match(adminPwdRegex);
  if (!match) {
    console.log('Could not find admin Password attribute in XML');
    // Try a broader search
    const adminSection = xmlContent.match(/UserName="admin"[^>]*?>/);
    if (adminSection) console.log('Found admin section:', adminSection[0].substring(0, 200));
    await browser.close();
    return;
  }

  function unescapeXml(s) {
    return s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c));
  }

  const rawOldEnc = unescapeXml(match[2]);
  console.log('Old encrypted password (first 40 chars):', rawOldEnc.substring(0, 40) + '...');
  const decrypted = decryptHuawei(rawOldEnc);
  console.log('Decrypted old password:', decrypted);

  const modifiedXml = xmlContent.replace(match[0], match[1] + escapedEncPass + match[3]);
  fs.writeFileSync('modified_config.xml', modifiedXml);
  console.log('Saved modified config');

  // ── Verify modification ──
  const verifyMatch = modifiedXml.match(adminPwdRegex);
  if (verifyMatch) {
    const rawNewEnc = unescapeXml(verifyMatch[2]);
    const decAgain = decryptHuawei(rawNewEnc);
    console.log('Verify - decrypted new password:', decAgain);
    console.log('Verify match:', decAgain === NEW_HASH ? 'PASS' : 'FAIL');
    if (decAgain !== NEW_HASH) { await browser.close(); return; }
  }

  // ── Upload config ──
  console.log('\n=== Uploading modified config ===');

  const uploadResult = await page.evaluate((xml) => {
    return new Promise((resolve) => {
      try {
        const blob = new Blob([xml], {type: 'text/xml'});
        const file = new File([blob], 'config.xml', {type: 'text/xml'});
        const dt = new DataTransfer();
        dt.items.add(file);
        const fi = document.querySelector('input[type=file]');
        if (!fi) { resolve({error: 'No file input'}); return; }
        fi.files = dt.files;

        // Submit via XHR
        const form = document.getElementById('fr_uploadSetting');
        if (!form) { resolve({error: 'No form'}); return; }
        const fd = new FormData(form);
        fd.append('FileType', 'config');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', form.action, true);
        xhr.timeout = 60000;
        xhr.onload = () => resolve({status: xhr.status, text: xhr.responseText.substring(0, 500)});
        xhr.onerror = () => resolve({error: 'XHR error'});
        xhr.ontimeout = () => resolve({error: 'XHR timeout'});
        xhr.send(fd);
      } catch(e) { resolve({error: e.message}); }
    });
  }, modifiedXml);

  console.log('Upload response:', JSON.stringify(uploadResult));
  await sleep(5000);

  // ── Verify with fresh context ──
  console.log('\n=== Verifying admin:Admin12345 ===');
  const ctx2 = await browser.createBrowserContext();
  const p2 = await ctx2.newPage();

  await p2.goto(ROUTER + '/admin.html', { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);
  await p2.evaluate(() => {
    window.CheckPassword = () => 0; window.setDisable = () => {};
    window.DisplayWifiPldt = () => {}; window.preflag = 0;
    document.querySelector('input#txt_Username').value = 'admin';
    document.querySelector('input#txt_Password').value = 'Admin12345';
  });
  await sleep(500);
  await p2.evaluate(() => document.getElementById('button').click());
  await sleep(5000);
  console.log('Post-login URL:', p2.url());

  await p2.goto(ROUTER + '/html/bbsp/userdevinfo/userdevinfo.asp', { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(1000);
  const hl = await p2.evaluate(() => !!document.querySelector('input#txt_Username'));
  const txt = await p2.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('Has login form:', hl);
  console.log('Text:', txt.substring(0, 60));
  console.log('=>', hl ? '❌ FAILED - admin:Admin12345 does not work' : '✅ SUCCESS - admin:Admin12345 works!');

  await ctx2.close();
  await browser.close();
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
