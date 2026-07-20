const crypto = require('crypto');

const BLOCK_SIZE = 0x14;
const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';

function HW_AES_AscUnvisible(encryptedStr) {
  const buf = Buffer.from(encryptedStr, 'ascii');
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x7e) buf[i] = 0x1e;
    else buf[i] = buf[i] - 0x21;
  }
  return buf;
}

function HW_AES_AesEnhSysToLong(buffer) {
  let output = 0;
  let v3 = 1;
  for (let i = 0; i < 5; i++) {
    output += v3 * buffer[i];
    v3 *= 0x5D;
  }
  return output;
}

function HW_AES_PlainToBin(buffer) {
  if (buffer.length % 5 !== 0) return null;
  const output = Buffer.alloc(buffer.length * 4 / 5);
  let periodFive = 0;
  for (let i = 0; i < output.length; i += 4) {
    const _long = HW_AES_AesEnhSysToLong(buffer.slice(periodFive, periodFive + 5));
    output.writeUInt32LE(_long, i);
    periodFive += 5;
  }
  return output;
}

function hexFromBytes(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function decryptHuawei(encryptedStr) {
  if (!encryptedStr.startsWith('$2') || !encryptedStr.endsWith('$')) {
    return null;
  }
  
  // Trim $2 and trailing $
  const trimmed = encryptedStr.substring(2, encryptedStr.length - 1);
  
  // Step 1: Decode ASCII to bytes
  const unvisible = HW_AES_AscUnvisible(trimmed);
  
  // Step 2: Verify block alignment
  const blockCount = Math.floor(unvisible.length / BLOCK_SIZE);
  if (unvisible.length !== BLOCK_SIZE * blockCount) return null;
  
  // Step 3: Last block is the IV
  const ivBlock = unvisible.slice(blockCount * BLOCK_SIZE - BLOCK_SIZE, blockCount * BLOCK_SIZE);
  const IV = HW_AES_PlainToBin(ivBlock);
  
  // Step 4: Remaining data is ciphertext
  const dataAll = HW_AES_PlainToBin(unvisible.slice(0, blockCount * BLOCK_SIZE - BLOCK_SIZE));
  
  // Step 5: AES-256-CBC decrypt
  const key = Buffer.from(KEY_HEX, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, IV);
  decipher.setAutoPadding(false);
  
  let decrypted = decipher.update(dataAll);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  // Remove padding (PKCS7)
  const padLen = decrypted[decrypted.length - 1];
  if (padLen > 0 && padLen <= 16) {
    decrypted = decrypted.slice(0, decrypted.length - padLen);
  }
  
  return decrypted.toString('utf8');
}

// Test with the PSK values from the config
const psk24 = '$2>E6>:M3D2>|}\'v:Dw2q5i:nv=&|vw7azq~.]bBz!$';
const psk5g = '$2cJg~)r7aq3GnNoIdAe05,U}c*7S==PHNQ\\SEBm1P$';

console.log('Decrypting 2.4GHz PreSharedKey...');
const pw24 = decryptHuawei(psk24);
console.log('2.4GHz password:', pw24 || 'FAILED');

console.log('\nDecrypting 5GHz PreSharedKey...');
const pw5g = decryptHuawei(psk5g);
console.log('5GHz password:', pw5g || 'FAILED');

// Also test with known passwords from config for verification
console.log('\n--- Testing with known encrypted values ---');
const testCases = [
  // These are WEP keys and DHCP values - test if they decrypt
  { label: 'WEPKey1', val: '$2&@(81ns\'4MR&:U&U+!1Tb&(BB^uN=9tNpQVe"\\u\'$' },
  { label: 'TR069 Password', val: '$2<I$|.=wz8G/Y,]T6:oqX$tYl(rFX`OR{vyJQ=Y,I$' },
];

for (const tc of testCases) {
  const result = decryptHuawei(tc.val);
  console.log(`${tc.label}: ${result || 'FAILED'}`);
}
