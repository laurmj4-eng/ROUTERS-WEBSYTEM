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

const xml = fs.readFileSync(process.argv[2] || require('os').homedir() + '/Downloads/hw_ctree (2).xml', 'utf8');

const ssid24 = xml.match(/InstanceID="1"[^>]*?SSID="([^"]+)"/);
const ssid5g = xml.match(/InstanceID="5"[^>]*?SSID="([^"]+)"/);
const pskMatches = [...xml.matchAll(/PreSharedKey="([^"]+)"/g)];

console.log('=== CURRENT WIFI PASSWORDS ===');
if (pskMatches.length >= 2) {
  const e24 = '$2' + pskMatches[0][1] + '$';
  const e5g = '$2' + pskMatches[1][1] + '$';
  const d24 = decryptHuawei(e24);
  const d5g = decryptHuawei(e5g);
  console.log('2.4GHz (' + (ssid24 ? ssid24[1] : '?') + '): ' + d24);
  console.log('5GHz (' + (ssid5g ? ssid5g[1] : '...') + '): ' + d5g);
}
