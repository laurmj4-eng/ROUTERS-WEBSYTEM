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
  const ivRaw = (buf.slice(bc * BLOCK_SIZE - BLOCK_SIZE, bc * BLOCK_SIZE));
  const IV = (ivRaw.length % 5 === 0) ? HW_AES_PlainToBin(ivRaw) : null;
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

const filePath = require('os').homedir() + '/Downloads/hw_ctree (2).xml';
const xml = fs.readFileSync(filePath, 'utf8');

// Extract using simple PreSharedKey match and check which one is the actual WiFi one
const allMatches = [...xml.matchAll(/PreSharedKey="([^"]+)"/g)];
console.log('All PreSharedKey occurrences:');
allMatches.forEach((m, i) => {
  const ctx = xml.substring(Math.max(0, m.index - 80), m.index + m[0].length + 80);
  console.log(`\n[${i}] Value: "${m[1].substring(0, 30)}..."`);
  console.log('  Context:', ctx.replace(/\n/g, ' ').substring(0, 150));
});

// Get the right ones by context
// 2.4GHz is InstanceID="1" or the one with SSID starting with P
const ssids = [...xml.matchAll(/InstanceID="\d+"[^>]*?SSID="([^"]+)"/g)];
console.log('\n=== SSIDs found ===');
ssids.forEach(m => console.log(`  ${m[1]}`));
