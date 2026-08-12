const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';
const BRAVE = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const USERNAME = process.env.RT_USER || 'adminpldt';
const PASSWORD = process.env.RT_PASS || 'AC2DIU7QW3ERTY6UPAS4DFG';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({
    headless: false, executablePath: BRAVE, ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720', '--disable-blink-features=AutomationControlled']
  });
  const p = await b.newPage();

  console.log('1. Opening', ROUTER + '/admin.html');
  try {
    await p.goto(ROUTER + '/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 45000});
  } catch (e) { console.log('   goto warning (continuing):', e.message.slice(0, 60)); }
  try {
    await p.waitForSelector('#txt_Username', {timeout: 45000});
    console.log('   Login form loaded. URL:', p.url());
  } catch (e) {
    console.log('   ERROR: login form not found. URL:', p.url());
    const t = await p.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => '');
    console.log('   Body:', t);
    await b.close();
    process.exit(1);
  }
  await sleep(2000);

  // ONLY enable the login button. Do NOT touch CheckPassword.
  await p.evaluate(() => { window.setDisable = () => {}; });

  // Type credentials with real input events
  await p.type('#txt_Username', USERNAME, {delay: 25});
  await p.type('#txt_Password', PASSWORD, {delay: 15});

  // Captcha? if visible, wait 30s for user to type it in the window
  const cap = await p.evaluate(() => {
    const el = document.getElementById('VerificationCode');
    if (!el) return false;
    const st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && el.offsetParent !== null;
  });
  if (cap) {
    console.log('!! CAPTCHA VISIBLE — credentials filled. Type the captcha in the Brave window; login in 30s.');
    await sleep(30000);
  }

  // Click login
  const clicked = await p.evaluate(() => {
    const cands = ['#button', 'button#button', 'input[type=button]', 'input[value=Login]'];
    for (const s of cands) {
      const el = document.querySelector(s);
      if (el && getComputedStyle(el).display !== 'none') { el.click(); return s; }
    }
    return null;
  });
  console.log('2. Clicked login button:', clicked);
  await sleep(8000);
  console.log('   URL after login:', p.url());

  // Step 3: READ the overlay pre-filled WiFi fields (cleartext, zero writes)
  const ov = await p.evaluate(() => {
    const g = id => { const el = document.getElementById(id); return el ? el.value : null; };
    return {
      ssid1_name: g('ssid1_name'),
      ssid1_password: g('ssid1_password'),
      ssid2_name: g('ssid2_name'),
      ssid2_password: g('ssid2_password'),
    };
  });
  console.log('3. Overlay fields:', JSON.stringify(ov));

  // Step 4: SKIP the overlay via JS injection — NO form submission at all
  await p.evaluate(() => {
    window.onbeforeunload = null;
    ['pwd_modify', 'default_pwdmodify'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.display = 'none'; el.remove(); }
    });
    document.body.style.overflow = 'auto';
  });
  await sleep(1000);

  // If overlay gave us the WiFi creds, we are done (pure DOM read)
  if (ov.ssid1_name && ov.ssid1_password) {
    console.log('\n================ RESULT (READ-ONLY) ================');
    console.log('  2.4GHz  SSID:', ov.ssid1_name, '| WiFi Password:', ov.ssid1_password);
    console.log('  5GHz    SSID:', ov.ssid2_name, '| WiFi Password:', ov.ssid2_password);
    console.log('=====================================================');
    console.log('Nothing was modified: login (session only) + DOM reads. Overlay skipped, NOT submitted.');
    await sleep(1500);
    await b.close();
    return;
  }

  // Step 5: Fallback — extract from WlanBasic.asp pages (2G and 5G)
  const wlanExtract = async (band) => {
    try {
      await p.goto(ROUTER + '/html/amp/wlanbasic/WlanBasic.asp?' + band, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000});
    } catch (e) { console.log('   ' + band + ' goto warning:', e.message.slice(0, 60)); }
    await sleep(5000);

    const before = await p.evaluate(() => {
      const g = id => { const el = document.getElementById(id); return el ? el.value : null; };
      let wlanArr = null;
      try { wlanArr = JSON.stringify(window.WlanWifiArr || window.wlanWifiArr || null); } catch(e) {}
      return {
        ssid: g('wlSsid') || g('ssid'),
        psk: g('wlWpaPsk'),
        pskText: g('twlWpaPsk'),
        hideCb: document.getElementById('hidewlWpaPsk') ? document.getElementById('hidewlWpaPsk').checked : null,
        wifiPasswordMask: (typeof window.wifiPasswordMask !== 'undefined') ? JSON.stringify(window.wifiPasswordMask) : null,
        WlanWifiArr: wlanArr,
        allPasswords: [...document.querySelectorAll('input[type=password]')].map(i => ({id: i.id, value: i.value})),
      };
    });
    console.log('   ' + band + ' BEFORE:', JSON.stringify(before));

    // Client-side show/hide toggle (cosmetic JS only — changes nothing on the router)
    const after = await p.evaluate(() => {
      const cb = document.getElementById('hidewlWpaPsk');
      if (cb && !cb.checked) { cb.click(); }
      const el = document.getElementById('wlWpaPsk') || document.getElementById('twlWpaPsk');
      const twl = document.getElementById('twlWpaPsk');
      if (twl) twl.style.display = '';
      return {
        psk: el ? el.value : null,
        twlWpaPsk: twl ? twl.value : null,
        inputs: [...document.querySelectorAll('input[type=password], input[id*=Psk], input[id*=psk]')].map(i => ({id: i.id, value: i.value, type: i.type})),
      };
    });
    console.log('   ' + band + ' AFTER toggle:', JSON.stringify(after));
    return { before, after };
  };

  console.log('4. Overlay fields empty — extracting from WLAN pages');
  const w24 = await wlanExtract('2G');
  const w5 = await wlanExtract('5G');

  const results = [];
  for (const [label, w] of [['2.4GHz', w24], ['5GHz', w5]]) {
    const cand = w.before.psk || w.before.pskText || (w.after.inputs.find(i => i.id === 'wlWpaPsk') || {}).value || (w.after.inputs.find(i => i.id === 'twlWpaPsk') || {}).value;
    const ssid = w.before.ssid;
    if (ssid && cand) results.push({label, ssid, psk: cand});
  }

  if (results.length) {
    console.log('\n================ RESULT (READ-ONLY) ================');
    for (const r of results) {
      console.log('  ' + r.label + '  SSID: ' + r.ssid + '  | WiFi Password: ' + r.psk);
    }
    console.log('=====================================================');
    console.log('Nothing was modified: login (session only) + DOM reads. Overlay skipped, NOT submitted.');
    await sleep(1500);
    await b.close();
    return;
  }

  // Step 6: Last resort — config download + Huawei decrypt
  console.log('5. WLAN fields masked/empty — trying config download');
  try {
    await p.goto(ROUTER + '/html/ssmp/cfgfile/cfgfile.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000});
  } catch (e) { console.log('   cfgfile goto warning:', e.message.slice(0, 60)); }
  await sleep(6000);
  if (p.url().includes('default_pwdmodify') || p.url().includes('pwd_modify')) {
    console.log('   Blocked by overlay redirect — overriding location via JS injection');
    await p.evaluate(() => { window.stop(); window.location.href = '/html/ssmp/cfgfile/cfgfile.asp'; });
    await sleep(4000);
  }
  console.log('   Final URL:', p.url());

  const token = await p.evaluate(() => {
    const els = ['hwonttoken', 'X_HW_Token', 'x.X_HW_Token'];
    for (const id of els) {
      const el = document.getElementById(id);
      if (el && el.value) return el.value;
    }
    const any = document.querySelector('input[type=hidden]');
    return any ? ('HIDDEN-FIELD:' + any.id + '=' + any.value.slice(0, 40)) : '';
  }).catch(() => '');
  console.log('   hwonttoken:', token ? 'present' : 'MISSING');

  if (!token) {
    console.log('ERROR: no token — cannot download config. Aborting without changes.');
    await b.close();
    process.exit(1);
  }

  // READ-ONLY config download (no settings are written)
  let xml = await p.evaluate(async (t) => {
    try {
      const r = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
        method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'x.X_HW_Token=' + encodeURIComponent(t), credentials: 'include'
      });
      if (r.ok) return await r.text();
    } catch(e) {}
    return null;
  }, token).catch(() => null);

  if (!xml) { console.log('ERROR: config download failed. Aborting without changes.'); await b.close(); process.exit(1); }

  // Decrypt the Huawei-encoded WiFi PSKs (crypto only, no router writes)
  const ssid24 = xml.match(/InstanceID="1"[^>]*?SSID="([^"]+)"/);
  const ssid5  = xml.match(/InstanceID="5"[^>]*?SSID="([^"]+)"/);

  const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
  const HW_AES_AesEnhSysToLong = (buf) => { let o=0,v3=1; for(let i=0;i<5;i++){o+=v3*buf[i];v3*=0x5D;} return o>>>0; };
  const HW_AES_PlainToBin = (buf) => { if(buf.length%5!==0)return null; const o=Buffer.alloc(buf.length*4/5); let p=0; for(let i=0;i<o.length;i+=4){o.writeUInt32LE(HW_AES_AesEnhSysToLong(buf.slice(p,p+5)),i);p+=5;} return o; };
  function decryptHuawei(s) {
    if(!s.startsWith('$2')||!s.endsWith('$'))return null;
    const t=s.substring(2,s.length-1); const b=Buffer.from(t,'ascii');
    for(let i=0;i<b.length;i++){if(b[i]===0x7e)b[i]=0x1e;else b[i]-=0x21;}
    const BS=0x14; if(b.length%BS!==0)return null;
    const bc=Math.floor(b.length/BS), ivR=b.slice(bc*BS-BS,bc*BS), IV=HW_AES_PlainToBin(ivR);
    const da=HW_AES_PlainToBin(b.slice(0,bc*BS-BS)); if(!da||!IV)return null;
    const d=require('crypto').createDecipheriv('aes-256-cbc',Buffer.from(KEY_HEX,'hex'),IV); d.setAutoPadding(false);
    let dec=Buffer.concat([d.update(da),d.final()]); const pad=dec[dec.length-1];
    if(pad>0&&pad<=16)dec=dec.slice(0,dec.length-pad);
    return dec.toString('utf8').replace(/\0+$/,'');
  }
  const unescapeXml = s => s.replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"');

  const pskMatches = [...xml.matchAll(/PreSharedKey="([^"]+)"/g)];
  console.log('\n================ RESULT (READ-ONLY) ================');
  for (let i = 0; i < pskMatches.length; i++) {
    const dec = decryptHuawei(unescapeXml(pskMatches[i][1]));
    const label = i === 0 ? '2.4GHz' : (i === 1 ? '5GHz' : 'Band ' + (i+1));
    const ssid = i === 0 ? (ssid24 ? ssid24[1] : '?') : (i === 1 ? (ssid5 ? ssid5[1] : '?') : '?');
    console.log(`  ${label}`);
    console.log(`    SSID: ${ssid}`);
    console.log(`    WiFi Password: ${dec}`);
  }
  console.log('=====================================================');
  console.log('Nothing was modified: only login + config download (read) were performed. Overlay NOT submitted.');

  await sleep(2000);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
