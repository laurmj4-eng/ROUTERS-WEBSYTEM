const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TARGET_HASH = '8e06d03d5bbbc77a9b31674c71edbf3f8b6e8a6fbda26ae865e659b0bb07028d'.toLowerCase();
const WORDLIST_DIR = path.join(__dirname, '..', 'cred-scanner', 'wordlists');
const WORDLIST_PATH = path.join(WORDLIST_DIR, 'common-router-passwords.txt');

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function leet(s) {
  return s
    .replace(/a/gi, '4').replace(/e/gi, '3').replace(/i/gi, '1').replace(/o/gi, '0')
    .replace(/s/gi, '5').replace(/t/gi, '7').replace(/b/gi, '8').replace(/g/gi, '9');
}

function leet2(s) {
  return s
    .replace(/a/gi, '@').replace(/e/gi, '3').replace(/i/gi, '!').replace(/o/gi, '0')
    .replace(/s/gi, '$').replace(/t/gi, '+').replace(/l/gi, '1');
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

// Common number suffixes, years, and special chars
const suffixes = ['', '1', '12', '123', '1234', '12345', '0', '01', '007', '69', '420',
  '2020', '2021', '2022', '2023', '2024', '2025', '2026', '21', '22', '23', '24', '25', '26',
  '!', '@', '#', '1!', '123!', '!1', '@1', '#1',
  '!', '!!', '?', '.', '*', '_', '-',
];

const prefixes = ['', 'P@ss', 'P@$$', 'P@$$w0rd', 'pass', 'Pass', 'PASS'];

const wordlist = fs.readFileSync(WORDLIST_PATH, 'utf8')
  .split(/\r?\n/)
  .map(w => w.trim())
  .filter(w => w && !w.startsWith('#'));

let tested = 0;

function check(word) {
  tested++;
  if (sha256(word) === TARGET_HASH) return word;
  return null;
}

// Phase 1: direct wordlist words
console.error('Phase 1: Direct wordlist (' + wordlist.length + ' words)...');
for (const w of wordlist) {
  const r = check(w);
  if (r) { console.log(JSON.stringify({ found: true, password: r, method: 'direct', tested })); process.exit(0); }
}

// Phase 2: case variants
console.error('Phase 2: Case variants...');
for (const w of wordlist) {
  for (const variant of [
    w.toLowerCase(),
    w.toUpperCase(),
    capitalize(w),
    w.replace(/^(.)/, c => c.toUpperCase()),
  ]) {
    if (variant !== w) {
      const r = check(variant);
      if (r) { console.log(JSON.stringify({ found: true, password: r, method: 'case_variant', tested })); process.exit(0); }
    }
  }
}

// Phase 3: word + number suffixes
console.error('Phase 3: Word + suffix...');
for (const w of wordlist) {
  for (const sfx of suffixes) {
    if (!sfx) continue;
    const r = check(w + sfx);
    if (r) { console.log(JSON.stringify({ found: true, password: r, method: 'suffix', tested })); process.exit(0); }
    const r2 = check(capitalize(w) + sfx);
    if (r2) { console.log(JSON.stringify({ found: true, password: r2, method: 'suffix_cap', tested })); process.exit(0); }
  }
}

// Phase 4: leet speak
console.error('Phase 4: Leet speak...');
for (const w of wordlist) {
  const r = check(leet(w));
  if (r) { console.log(JSON.stringify({ found: true, password: r, method: 'leet1', tested })); process.exit(0); }
  const r2 = check(leet2(w));
  if (r2) { console.log(JSON.stringify({ found: true, password: r2, method: 'leet2', tested })); process.exit(0); }
  const r3 = check(leet(capitalize(w)));
  if (r3) { console.log(JSON.stringify({ found: true, password: r3, method: 'leet_cap', tested })); process.exit(0); }
}

// Phase 5: reversed words
console.error('Phase 5: Reversed words...');
for (const w of wordlist) {
  const rev = w.split('').reverse().join('');
  const r = check(rev);
  if (r) { console.log(JSON.stringify({ found: true, password: r, method: 'reverse', tested })); process.exit(0); }
  const r2 = check(capitalize(rev));
  if (r2) { console.log(JSON.stringify({ found: true, password: r2, method: 'reverse_cap', tested })); process.exit(0); }
}

// Phase 6: prefix + word
console.error('Phase 6: Prefix + word...');
for (const w of wordlist) {
  for (const pfx of prefixes) {
    if (!pfx) continue;
    const r = check(pfx + w);
    if (r) { console.log(JSON.stringify({ found: true, password: r, method: 'prefix', tested })); process.exit(0); }
    const r2 = check(pfx + w.toLowerCase());
    if (r2) { console.log(JSON.stringify({ found: true, password: r2, method: 'prefix_lower', tested })); process.exit(0); }
  }
}

// Phase 7: common passwords not in the wordlist
console.error('Phase 7: Common passwords...');
const commonPasswords = [
  'admin', 'Admin', 'ADMIN', 'admin1', 'Admin1', 'Admin123', 'admin123',
  'password', 'Password', 'password1', 'Password1', 'Password123',
  'pldt', 'PLDT', 'Pldt', 'pldtadmin', 'PLDTadmin', 'PLDTAdmin',
  'pldthome', 'PLDTHOME', 'PLDTHOMEFIBR', 'pldthomefibr',
  'fiber', 'fiberhome', 'FiberHome', 'PLDTFiber',
  'router', 'Router', 'ROUTER', 'router1', 'Router1',
  'adminpldt', 'adminPLDT', 'AdminPLDT', 'ADMINPLDT',
  'guest', 'Guest', 'GUEST', 'user', 'User', 'USER',
  'root', 'Root', 'ROOT', 'toor', 'Toor',
  '123456', '1234567', '12345678', '123456789', '1234567890',
  'qwerty', 'Qwerty', 'qwerty1', 'Qwerty1', 'qwerty123',
  'letmein', 'Letmein', 'welcome', 'Welcome', 'Welcome1',
  'changeme', 'Changeme', 'default', 'Default',
  'pass', 'Pass', 'PASS', 'pass123', 'Pass123',
  'p@ssword', 'P@ssword', 'p@ssword1', 'P@ssword1',
  'p@$$word', 'P@$$Word', 'p@$$w0rd',
  'Admin1234', 'admin1234', 'ADMIN1234',
  'pldthomefibr', 'PLDTHOMEFIBR', 'Pldthomefibr',
  'PLDTWIFI', 'pldtwifi', 'pldtwifi123',
  'opencode', 'opencode1',
  'iloveyou', 'sunshine', 'princess', 'monkey',
  'passw0rd', 'P@ssw0rd', 'p@ssw0rd',
  'admin2020', 'admin2021', 'admin2022', 'admin2023', 'admin2024', 'admin2025', 'admin2026',
  'Admin2020', 'Admin2021', 'Admin2022', 'Admin2023', 'Admin2024', 'Admin2025', 'Admin2026',
  'Pldt2020', 'Pldt2021', 'Pldt2022', 'Pldt2023', 'Pldt2024', 'Pldt2025', 'Pldt2026',
  'pldt2020', 'pldt2021', 'pldt2022', 'pldt2023', 'pldt2024', 'pldt2025', 'pldt2026',
];

for (const pw of commonPasswords) {
  const r = check(pw);
  if (r) { console.log(JSON.stringify({ found: true, password: r, method: 'common_list', tested })); process.exit(0); }
}

// Phase 8: try replacing letters with numbers
console.error('Phase 8: Number substitutions...');
for (const w of wordlist) {
  for (let i = 0; i <= 9999; i++) {
    const padded = String(i).padStart(4, '0');
    const r = check(w + padded);
    if (r) { console.log(JSON.stringify({ found: true, password: r, method: 'brute_suffix_4digit', tested })); process.exit(0); }
  }
}

// Phase 9: double words
console.error('Phase 9: Word combinations...');
for (const w1 of wordlist) {
  for (const w2 of wordlist.slice(0, 100)) {
    const combo = w1 + w2;
    const r = check(combo);
    if (r) { console.log(JSON.stringify({ found: true, password: r, method: 'combination', tested })); process.exit(0); }
    const r2 = check(capitalize(w1) + w2);
    if (r2) { console.log(JSON.stringify({ found: true, password: r2, method: 'combination_cap', tested })); process.exit(0); }
  }
}

console.log(JSON.stringify({ found: false, tested }));
