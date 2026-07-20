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

// Unescape XML entities
function unescapeXml(s) {
  return s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"');
}

// Get the PreSharedKey values directly - unescape first to get correct lengths
const allMatches = [...xml.matchAll(/PreSharedKey="([^"]+)"/g)];

const raw24 = allMatches[0][1];
const raw5g = allMatches[1][1];

console.log('Raw 2.4GHz PSK:', raw24);
console.log('Length:', raw24.length);
console.log('');

const psk24 = unescapeXml(raw24);
const psk5g = unescapeXml(allMatches[1][1]);

console.log('Unescaped 2.4GHz:', psk24);
console.log('Length:', psk24.length);
console.log('');

const pw24 = decryptHuawei(psk24);
const pw5g = decryptHuawei(psk5g);

console.log('=== NEW WIFI PASSWORDS ===');
console.log('2.4GHz (PLDTHOMEFIBRBd6BN): ' + pw24);
console.log('5GHz (...): ' + pw5g);
