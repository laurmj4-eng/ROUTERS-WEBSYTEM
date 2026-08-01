const crypto = require('crypto');
const fs = require('fs');
const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
function HW_AES_AesEnhSysToLong(buf) { let o=0,v3=1; for(let i=0;i<5;i++){o+=v3*buf[i];v3*=0x5D;} return o>>>0; }
function HW_AES_PlainToBin(buf) { if(buf.length%5!==0)return null; const o=Buffer.alloc(buf.length*4/5); let p=0; for(let i=0;i<o.length;i+=4){o.writeUInt32LE(HW_AES_AesEnhSysToLong(buf.slice(p,p+5)),i);p+=5;} return o; }
function decrypt(s) {
  if(!s.startsWith('$2')||!s.endsWith('$'))return null;
  const t=s.substring(2,s.length-1);
  const b=Buffer.from(t,'ascii');
  for(let i=0;i<b.length;i++){if(b[i]===0x7e)b[i]=0x1e;else b[i]-=0x21;}
  const BS=0x14; if(b.length%BS!==0)return null;
  const bc=Math.floor(b.length/BS), ivR=b.slice(bc*BS-BS,bc*BS), IV=HW_AES_PlainToBin(ivR);
  const da=HW_AES_PlainToBin(b.slice(0,bc*BS-BS)); if(!da||!IV)return null;
  const d=crypto.createDecipheriv('aes-256-cbc',Buffer.from(KEY_HEX,'hex'),IV); d.setAutoPadding(false);
  let dec=Buffer.concat([d.update(da),d.final()]); const pad=dec[dec.length-1];
  if(pad>0&&pad<=16)dec=dec.slice(0,dec.length-pad);
  return dec.toString('utf8').replace(/\0+$/,'');
}
function unescapeXml(s) { return s.replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"'); }

const xml=fs.readFileSync('check_config.xml','utf8');

// Get adminpldt section
const apMatch = xml.match(/UserName="adminpldt"[\s\S]*?<\/X_HW_WebUserInfoInstance>/);
if (apMatch) {
  const section = apMatch[0];
  // Find iterate password
  const itMatch = section.match(/IteratePassword[^>]*?Password="([^"]+)"/);
  if (itMatch) {
    const dec = decrypt(unescapeXml(itMatch[1]));
    console.log('adminpldt iterate password:', dec);
    const saltM = section.match(/IteratePassword[^>]*?Salt="([^"]+)"/);
    const cntM = section.match(/IteratePassword[^>]*?IterateCount="([^"]+)"/);
    console.log('salt:', saltM ? saltM[1] : '?', 'count:', cntM ? cntM[1] : '?');
    
    // Compute PBKDF2
    const pwd = 'AC2DIU7QW3ERTY6UPAS4DFG';
    const pbkdf2 = crypto.pbkdf2Sync(pwd, saltM[1], parseInt(cntM[1]), 32, 'sha256').toString('hex');
    console.log('PBKDF2 match:', pbkdf2 === dec ? 'YES' : 'NO');
    console.log('PBKDF2(adminpldt):', pbkdf2);
  }
}

// Also check admin iterate
const aMatch = xml.match(/UserName="admin"[\s\S]*?<\/X_HW_WebUserInfoInstance>/);
if (aMatch) {
  const section = aMatch[0];
  const itMatch = section.match(/IteratePassword[^>]*?Password="([^"]+)"/);
  if (itMatch) {
    const dec = decrypt(unescapeXml(itMatch[1]));
    console.log('\nadmin iterate password:', dec);
    const saltM = section.match(/IteratePassword[^>]*?Salt="([^"]+)"/);
    const cntM = section.match(/IteratePassword[^>]*?IterateCount="([^"]+)"/);
    console.log('salt:', saltM ? saltM[1] : '?', 'count:', cntM ? cntM[1] : '?');
  }
}
