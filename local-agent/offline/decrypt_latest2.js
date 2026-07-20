const crypto = require('crypto');
const fs = require('fs');

const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
const BLOCK_SIZE = 0x14;

function unescapeXml(s) {
  return s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}

function decryptHuawei(encryptedStr) {
  encryptedStr = unescapeXml(encryptedStr);
  if (!encryptedStr.startsWith('$2') || !encryptedStr.endsWith('$')) return null;
  const trimmed = encryptedStr.substring(2, encryptedStr.length - 1);
  console.log('Trimmed length:', trimmed.length, 'chars');
  const buf = Buffer.from(trimmed, 'ascii');
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x7e) buf[i] = 0x1e;
    else buf[i] -= 0x21;
  }
  console.log('Buffer length:', buf.length);
  if (buf.length % BLOCK_SIZE !== 0) {
    console.log('Not aligned to', BLOCK_SIZE, '(remainder:', buf.length % BLOCK_SIZE, ')');
    return null;
  }
  const bc = Math.floor(buf.length / BLOCK_SIZE);
  const ivRaw = HW_AES_PlainToBin(buf.slice(bc * BLOCK_SIZE - BLOCK_SIZE));
  const data = HW_AES_PlainToBin(buf.slice(0, bc * BLOCK_SIZE - BLOCK_SIZE));
  if (!data || !ivRaw) { console.log('PlainToBin failed'); return null; }
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

const xml = fs.readFileSync(require('os').homedir() + '/Downloads/hw_ctree (2).xml', 'utf8');

const ssid24 = xml.match(/InstanceID="1"[^>]*?SSID="([^"]+)"/);
const ssid5g = xml.match(/InstanceID="5"[^>]*?SSID="([^"]+)"/);

const psk24Match = xml.match(/<WLANConfigurationInstance[^>]*?InstanceID="1"[\s\S]*?<PreSharedKeyInstance[^>]*?PreSharedKey="([^"]+)"/);
const psk5gMatch = xml.match(/<WLANConfigurationInstance[^>]*?InstanceID="5"[\s\S]*?<PreSharedKeyInstance[^>]*?PreSharedKey="([^"]+)"/);

console.log('=== CURRENT WIFI PASSWORDS ===');
if (psk24Match) {
  const e24 = '$2' + psk24Match[1] + '$';
  console.log('2.4GHz encrypted length:', e24.length);
  const d24 = decryptHuawei(e24);
  console.log('2.4GHz (' + (ssid24 ? ssid24[1] : '?') + '): ' + d24);
}
if (psk5gMatch) {
  const e5g = '$2' + psk5gMatch[1] + '$';
  console.log('5GHz encrypted length:', e5g.length);
  const d5g = decryptHuawei(e5g);
  console.log('5GHz (' + (ssid5g ? ssid5g[1] : '...') + '): ' + d5g);
}
