const crypto = require('crypto');

// Encrypted PreSharedKeys from the config
const psk24 = '$2>E6>:M3D2>|}\'v:Dw2q5i:nv=&|vw7azq~.]bBz!$';
const psk5g = '$2cJg~)r7aq3GnNoIdAe05,U}c*7S==PHNQ\\SEBm1P$';

// Serial number from cert
const serial = '2150086451AGR2013034';

// Known Huawei DES decryption function
function decryptHuaweiDES(encrypted, key) {
  try {
    // Remove $2 prefix and $ suffix
    let data = encrypted;
    if (data.startsWith('$2')) data = data.substring(2);
    if (data.endsWith('$')) data = data.substring(0, data.length - 1);
    
    // Decode: each char represents 6 bits (base64-like encoding)
    // Huawei uses a custom encoding: chars are shifted by some value
    // The actual algorithm: each byte of plaintext XOR with key byte, then encode
    
    // Let me try a different approach - Huawei uses DES ECB mode
    // First, convert the encoded string to bytes
    const keyBuf = Buffer.from(key.substring(0, 8), 'utf8');
    const decipher = crypto.createDecipheriv('des-ecb', keyBuf, null);
    decipher.setAutoPadding(false);
    
    // The encrypted data uses a custom base encoding
    // Characters in $2...$ use a specific charset
    // Let's try to find the intermediate representation
    
    // Actually, Huawei's $2 format uses a simple character substitution
    // This is the actual algorithm from reverse-engineered Huawei code:
    // 1. Each character maps to a 6-bit value from a charset
    // 2. The 6-bit values form bytes (8 bits each)
    // 3. DES decrypt those bytes with the key
    
    const charset = '!$&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    
    // Build reverse map
    const charToVal = {};
    for (let i = 0; i < charset.length; i++) {
      charToVal[charset[i]] = i;
    }
    
    // Decode the string (without $2 prefix and $ suffix)
    data = encrypted.substring(2, encrypted.length - 1);
    
    // Convert 6-bit characters to bytes
    const bits = [];
    for (const ch of data) {
      if (charToVal[ch] !== undefined) {
        const val = charToVal[ch];
        for (let b = 5; b >= 0; b--) {
          bits.push((val >> b) & 1);
        }
      }
    }
    
    // Convert bits to bytes
    const bytes = [];
    for (let i = 0; i + 7 < bits.length; i += 8) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        byte = (byte << 1) | bits[i + b];
      }
      bytes.push(byte);
    }
    
    const encryptedBuf = Buffer.from(bytes);
    
    // DES ECB decrypt
    try {
      const dec = crypto.createDecipheriv('des-ecb', keyBuf, null);
      dec.setAutoPadding(false);
      let decrypted = dec.update(encryptedBuf);
      decrypted = Buffer.concat([decrypted, dec.final()]);
      
      // Remove padding (PKCS5)
      const padLen = decrypted[decrypted.length - 1];
      if (padLen > 0 && padLen < 9) {
        decrypted = decrypted.slice(0, decrypted.length - padLen);
      }
      
      const result = decrypted.toString('utf8');
      // Check if result looks like a password (printable ASCII)
      if (/^[\x20-\x7E]+$/.test(result) && result.length >= 4) {
        return result;
      }
    } catch(e) {}
    
    // Try with padding
    try {
      const dec2 = crypto.createDecipheriv('des-ecb', keyBuf, null);
      let decrypted2 = dec2.update(encryptedBuf);
      decrypted2 = Buffer.concat([decrypted2, dec2.final()]);
      const result2 = decrypted2.toString('utf8');
      if (/^[\x20-\x7E]+$/.test(result2) && result2.length >= 4) {
        return result2;
      }
    } catch(e) {}
    
  } catch(e) {}
  return null;
}

// Try common keys
const keys = [
  serial.substring(0, 8),         // First 8 chars of serial: 21500864
  serial.substring(2, 10),        // 50086451
  'adminHW',                       // Standard Huawei
  'adminhw',                       // lowercase
  'AdminHW',                       // Capitalized
  'PLDT1234',                      // PLDT-specific
  'pldtadmin',                     // PLDT
  serial.substring(serial.length - 8), // Last 8: 013034
  'HG8145X6',                      // Model name
];

console.log('Encrypted 2.4GHz PSK:', psk24);
console.log('Encrypted 5GHz PSK:', psk5g);
console.log('Serial:', serial);
console.log('');

for (const key of keys) {
  const result = decryptHuaweiDES(psk24, key);
  if (result) {
    console.log(`*** SUCCESS with key "${key}" => ${result}`);
  }
}

// Try all possible 8-byte combinations from serial
for (let i = 0; i <= serial.length - 8; i++) {
  const key = serial.substring(i, i + 8);
  const result = decryptHuaweiDES(psk24, key);
  if (result) {
    console.log(`*** SUCCESS with serial segment "${key}" => ${result}`);
  }
}

console.log('\nNo key worked.');
