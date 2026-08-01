const crypto = require('crypto');
const fs = require('fs');

const adminHash = '216e56564d58fd5ca70362f781f9cd9b1870d12559acc7f500f2dc1ec5d333b5';
const adminpldtHash = 'f776ec89235eb872f1e56e783ddabff5cfaf9de547769e5680088e5dde0599b8';
const adminSalt = 'd0T=B6MdEJC71q=KuYx2Rc=+';
const adminpldtSalt = '2X9=L2xxdeIAD0qv8es5WxPK';

const wordlist = [
  'admin', 'password', '1234', 'pldthome', 'PLDT', 'pldt', 'adminpldt',
  'useradmin', 'root', 'admin123', 'Admin', 'PASSWORD', 'Pldthome',
  'PLDTHOME', 'pldthome123', 'adminpldt123', 'telecom', 'admin@123',
  'Admin123', 'Admin@123', 'password123', 'Password123',
  'NkncqvS6vTkF1BTs',
  '', 'guest', 'administrator', 'AdminAdmin',
  '1234567890', '0123456789',
  'adminadmin', 'password1', 'qwerty12345', '12345',
  '123456', 'pass123', 'p@ssw0rd', 'letmein', 'welcome',
  '1q2w3e4r', 'qwertyuiop', 'asdfghjkl',
  'adminpldt', 'admin pldt', 'adminpldt!', 'adminpldt2023',
  'pldtadmin', 'pldt admin', 'PLDTadmin',
  'superadmin', 'SuperAdmin', 'super admin',
  // Serial-based (common for PLDT Huawei)
  '48575443E8B5B1A2', '48575443E8B5B1A', 'E8B5B1A2',
  // PLDT specific
  'pldthub', 'PLDTHUB', 'pldtadmin',
  'yourpassword', 'huawei', 'Huawei',
  'admintelecom', 'telecomadmin', 'telecom admin',
  'admintelekom', 'Telkom', 'telkom',
  'user', 'User', '12345678', '87654321',
  // random tries
  'pldt2016', 'pldt2017', 'pldt2018', 'pldt2019', 'pldt2020',
  'pldt2021', 'pldt2022', 'pldt2023', 'pldt2024',
];

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }
function md5(s) { return crypto.createHash('md5').update(s, 'utf8').digest('hex'); }

console.log('=== admin (PassMode=2) ===');
// Try MD5 variations
for (const w of wordlist) {
  // MD5(password)
  if (md5(w) === adminHash) { console.log(`MD5(${w}) = MATCH`); }
  // MD5(password + salt)
  if (md5(w + adminSalt) === adminHash) { console.log(`MD5(${w}+salt) = MATCH`); }
  // MD5(salt + password)
  if (md5(adminSalt + w) === adminHash) { console.log(`MD5(salt+${w}) = MATCH`); }
  // SHA256(password)
  if (sha256(w) === adminHash) { console.log(`SHA256(${w}) = MATCH`); }
  // SHA256(password + salt)
  if (sha256(w + adminSalt) === adminHash) { console.log(`SHA256(${w}+salt) = MATCH`); }
  // SHA256(salt + password)
  if (sha256(adminSalt + w) === adminHash) { console.log(`SHA256(salt+${w}) = MATCH`); }
}

console.log('\n=== adminpldt (PassMode=3) ===');
for (const w of wordlist) {
  // SHA256(password)
  if (sha256(w) === adminpldtHash) { console.log(`SHA256(${w}) = MATCH`); }
  // SHA256(password + salt)
  if (sha256(w + adminpldtSalt) === adminpldtHash) { console.log(`SHA256(${w}+salt) = MATCH`); }
  // SHA256(salt + password)
  if (sha256(adminpldtSalt + w) === adminpldtHash) { console.log(`SHA256(salt+${w}) = MATCH`); }
  // MD5(password)
  if (md5(w) === adminpldtHash) { console.log(`MD5(${w}) = MATCH`); }
}

console.log('\nDone.');
