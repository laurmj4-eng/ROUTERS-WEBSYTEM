const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');

const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
const BLOCK_SIZE = 0x14;

function decryptHuawei(encryptedStr) {
  if (!encryptedStr.startsWith('$2') || !encryptedStr.endsWith('$')) return null;
  const trimmed = encryptedStr.substring(2, encryptedStr.length - 1);
  const buf = Buffer.from(trimmed, 'ascii');
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x7e) buf[i] = 0x1e;
    else buf[i] -= 0x21;
  }
  if (buf.length % BLOCK_SIZE !== 0) return null;
  const bc = Math.floor(buf.length / BLOCK_SIZE);
  const ivRaw = HW_AES_PlainToBin(buf.slice(bc * BLOCK_SIZE - BLOCK_SIZE));
  const data = HW_AES_PlainToBin(buf.slice(0, bc * BLOCK_SIZE - BLOCK_SIZE));
  const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(KEY_HEX, 'hex'), ivRaw);
  d.setAutoPadding(false);
  let dec = Buffer.concat([d.update(data), d.final()]);
  const pad = dec[dec.length - 1];
  if (pad > 0 && pad <= 16) dec = dec.slice(0, dec.length - pad);
  return dec.toString('utf8').replace(/\0+$/, '');
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

  // Login
  console.log('Logging in...');
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
  console.log('Session cookie:', sessionCookie?.substring(0, 30) + '...');

  // Go to cfgfile page
  console.log('Opening cfgfile page...');
  await p.goto('https://192.168.1.1/html/ssmp/cfgfile/cfgfile.asp', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  // Wait for the page to fully load
  await p.waitForFunction(() => document.getElementById('hwonttoken')?.value?.length > 0, {timeout: 10000});
  const token = await p.evaluate(() => document.getElementById('hwonttoken').value);
  const reqFile = await p.evaluate(() => typeof reqFile !== 'undefined' ? reqFile : 'html/ssmp/cfgfile/cfgfile.asp');
  console.log('Token:', token);

  // Step 1: Call StartFileLoad via XHR
  await p.evaluate(() => {
    return new Promise((resolve) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/html/ssmp/common/StartFileLoad.asp', false);
      xhr.send();
      resolve();
    });
  });
  console.log('StartFileLoad done');

  // Step 2: Download via XHR (synchronous to guarantee cookies)
  const result = await p.evaluate(async (token, reqFile) => {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/cfgfiledown.cgi?&RequestFile=' + reqFile + '&x.X_HW_Token=' + token, false);
      xhr.overrideMimeType('text/plain; charset=x-user-defined');
      xhr.send();
      
      if (xhr.status !== 200) return { error: 'Status ' + xhr.status };
      
      var binStr = xhr.responseText;
      var bytes = [];
      for (var i = 0; i < binStr.length; i++) {
        bytes.push(binStr.charCodeAt(i) & 0xff);
      }
      
      // Base64 encode
      var binary = '';
      for (var i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return { size: bytes.length, b64: btoa(binary) };
    } catch(e) {
      return { error: e.message };
    }
  }, token, reqFile);

  console.log('Download result:', result.size ? result.size + ' bytes' : result.error);

  if (result.error) {
    console.log('XHR failed, trying page.goto approach...');
    // Try navigation instead
    p.on('response', async res => {
      if (res.url().includes('cfgfiledown.cgi')) {
        try {
          const text = await res.text();
          const buf = Buffer.from(text, 'binary');
          console.log('Response size:', buf.length, 'bytes');
          const xmlStr = buf.toString('utf8');
          
          const ssid24 = xmlStr.match(/InstanceID="1"[^>]*?SSID="([^"]+)"/);
          const ssid5g = xmlStr.match(/InstanceID="5"[^>]*?SSID="([^"]+)"/);
          const psk24 = xmlStr.match(/<PreSharedKeyInstance[^>]*?PreSharedKey="([^"]+)"/);
          
          const psk24Matches = [...xmlStr.matchAll(/PreSharedKey="([^"]+)"/g)];
          if (psk24Matches.length >= 2) {
            const e24 = '$2' + psk24Matches[0][1] + '$';
            const e5g = '$2' + psk24Matches[1][1] + '$';
            console.log('\n=== DECRYPTED PASSWORDS ===');
            console.log('2.4GHz (' + (ssid24 ? ssid24[1] : 'PLDTHOMEFIBRBd6BN') + '): ' + decryptHuawei(e24));
            console.log('5GHz (' + (ssid5g ? ssid5g[1] : '...') + '): ' + decryptHuawei(e5g));
          }
        } catch(e) { console.log('Error:', e.message); }
      }
    });
    
    await p.goto('https://192.168.1.1/cfgfiledown.cgi?&RequestFile=' + reqFile + '&x.X_HW_Token=' + token, {waitUntil:'domcontentloaded', timeout:15000});
    await new Promise(r => setTimeout(r, 3000));
  } else {
    // Process the XHR result
    const xmlBuf = Buffer.from(result.b64, 'base64');
    const xmlStr = xmlBuf.toString('utf8');
    
    const ssid24 = xmlStr.match(/InstanceID="1"[^>]*?SSID="([^"]+)"/);
    const ssid5g = xmlStr.match(/InstanceID="5"[^>]*?SSID="([^"]+)"/);
    
    const psk24Matches = [...xmlStr.matchAll(/PreSharedKey="([^"]+)"/g)];
    if (psk24Matches.length >= 2) {
      const e24 = '$2' + psk24Matches[0][1] + '$';
      const e5g = '$2' + psk24Matches[1][1] + '$';
      console.log('\n=== DECRYPTED PASSWORDS ===');
      console.log('2.4GHz (' + (ssid24 ? ssid24[1] : 'PLDTHOMEFIBRBd6BN') + '): ' + decryptHuawei(e24));
      console.log('5GHz (' + (ssid5g ? ssid5g[1] : '...') + '): ' + decryptHuawei(e5g));
    }
  }

  await b.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
