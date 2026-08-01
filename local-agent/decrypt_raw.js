const crypto = require('crypto');
const fs = require('fs');
const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
function HW_AES_AesEnhSysToLong(buf) { let o=0,v3=1; for(let i=0;i<5;i++){o+=v3*buf[i];v3*=0x5D;} return o>>>0; }
function HW_AES_PlainToBin(buf) { if(buf.length%5!==0)return null; const o=Buffer.alloc(buf.length*4/5); let p=0; for(let i=0;i<o.length;i+=4){o.writeUInt32LE(HW_AES_AesEnhSysToLong(buf.slice(p,p+5)),i);p+=5;} return o; }
function decryptRaw(s) {
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
  return dec;
}
function unescapeXml(s) { return s.replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"'); }

const xml=fs.readFileSync(__dirname + '/check_config.xml','utf8');
// Get raw match for admin
const matches = [...xml.matchAll(/UserName="(admin|adminpldt)"[^>]*?Password="([^"]+)"/g)];
for (const m of matches) {
  const user = m[1];
  const encPw = unescapeXml(m[2]);
  const raw = decryptRaw(encPw);
  if (raw) {
    console.log(`${user}:`);
    console.log(`  Raw bytes (hex): ${raw.toString('hex')}`);
    console.log(`  Raw bytes length: ${raw.length}`);
    console.log(`  Raw bytes (base64): ${raw.toString('base64')}`);
    console.log(`  As string: ${raw.toString('utf8')}`);
    // Try as hex string
    const hexStr = raw.toString('utf8');
    console.log(`  As hex string length: ${hexStr.length}`);
    if (hexStr.length === 32) {
      console.log(`  This is an MD5 hash (32 hex chars)`);
    } else if (hexStr.length === 64) {
      console.log(`  This is a SHA-256 hash (64 hex chars)`);
    }
    console.log('');
  }
}
