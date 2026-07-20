const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');

const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
const BLOCK_SIZE = 0x14;

function HW_AES_AscUnvisible(str) {
  const buf = Buffer.from(str, 'ascii');
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x7e) buf[i] = 0x1e;
    else buf[i] -= 0x21;
  }
  return buf;
}

function HW_AES_AesEnhSysToLong(buf) {
  let out = 0, v3 = 1;
  for (let i = 0; i < 5; i++) { out += v3 * buf[i]; v3 *= 0x5D; }
  return out;
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

function decryptHuawei(encryptedStr) {
  if (!encryptedStr.startsWith('$2') || !encryptedStr.endsWith('$')) return null;
  const trimmed = encryptedStr.substring(2, encryptedStr.length - 1);
  const unvisible = HW_AES_AscUnvisible(trimmed);
  const blockCount = Math.floor(unvisible.length / BLOCK_SIZE);
  if (unvisible.length !== BLOCK_SIZE * blockCount) return null;
  const ivBlock = unvisible.slice(blockCount * BLOCK_SIZE - BLOCK_SIZE);
  const IV = HW_AES_PlainToBin(ivBlock);
  const dataAll = HW_AES_PlainToBin(unvisible.slice(0, blockCount * BLOCK_SIZE - BLOCK_SIZE));
  const key = Buffer.from(KEY_HEX, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, IV);
  decipher.setAutoPadding(false);
  let dec = decipher.update(dataAll);
  dec = Buffer.concat([dec, decipher.final()]);
  const padLen = dec[dec.length - 1];
  if (padLen > 0 && padLen <= 16) dec = dec.slice(0, dec.length - padLen);
  return dec.toString('utf8').replace(/\0+$/, '');
}

(async () => {
  const b = await puppeteer.launch({headless:true, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors']});
  const [p] = await b.pages();

  let sessionCookie = null;
  p.on('response', async res => {
    if (res.url().includes('login.cgi')) {
      const sc = res.headers()['set-cookie'];
      if (sc) { const m = sc.match(/Cookie=([^;]+)/); if (m) sessionCookie = m[1]; }
    }
  });

  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:30000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  if (await p.$('input#txt_Username')) {
    await p.type('input#txt_Username','adminpldt',{delay:15});
    await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
    await p.click('button#button');
    await new Promise(r => setTimeout(r,3000));
  }

  if (sessionCookie) await p.setCookie({ name:'Cookie', value:sessionCookie, domain:'192.168.1.1', path:'/', httpOnly:true, secure:true });

  await p.goto('https://192.168.1.1/html/ssmp/cfgfile/cfgfile.asp', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  const result = await p.evaluate(async () => {
    const token = document.getElementById('hwonttoken').value;
    await fetch('/html/ssmp/common/StartFileLoad.asp', { method: 'GET', credentials: 'include' });
    await new Promise(r => setTimeout(r, 500));

    const opts = { credentials: 'include', headers: { 'Cookie': document.cookie } };
    const data = await fetch('/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp&x.X_HW_Token=' + token, opts);
    const buf = await data.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { size: bytes.length, b64: btoa(bin) };
  });

  if (!result || result.size < 1000) {
    console.log('Download failed or too small, trying alternative...');
    // Fall back to clicking button
    const token = await p.evaluate(() => document.getElementById('hwonttoken').value);
    console.log('Token:', token);
    await p.evaluate(() => { document.getElementById('downloadconfigbutton').click(); });
    await new Promise(r => setTimeout(r, 5000));
    await b.close();
    console.log('Check Downloads folder for hw_ctree.xml, then run decrypt manually.');
    process.exit(1);
  }

  await b.close();

  const xmlBuf = Buffer.from(result.b64, 'base64');
  const xmlStr = xmlBuf.toString('utf8');

  // Extract PreSharedKey for 2.4GHz (InstanceID="1")
  const match24 = xmlStr.match(/<WLANConfigurationInstance[^>]*?InstanceID="1"[^>]*?>[\s\S]*?<PreSharedKeyInstance[^>]*?PreSharedKey="([^"]+)"/);
  const match5g = xmlStr.match(/<WLANConfigurationInstance[^>]*?InstanceID="5"[^>]*?>[\s\S]*?<PreSharedKeyInstance[^>]*?PreSharedKey="([^"]+)"/);

  // Also extract SSIDs
  const ssid24 = xmlStr.match(/InstanceID="1"[^>]*?SSID="([^"]+)"/);
  const ssid5g = xmlStr.match(/InstanceID="5"[^>]*?SSID="([^"]+)"/);

  console.log('=== NEW WIFI PASSWORDS ===');
  if (match24) {
    const encrypted = '$2' + match24[1] + '$';
    const decrypted = decryptHuawei(encrypted);
    console.log(`2.4GHz (${ssid24 ? ssid24[1] : 'PLDTHOMEFIBRBd6BN'}): ${decrypted}`);
  }
  if (match5g) {
    const encrypted = '$2' + match5g[1] + '$';
    const decrypted = decryptHuawei(encrypted);
    console.log(`5GHz (${ssid5g ? ssid5g[1] : '...'}): ${decrypted}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
