const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ROUTER = process.argv[2] || '192.168.1.1';
const USER = process.argv[3] || 'admin';
const PASS = process.argv[4] || '1234';
const OUTDIR = process.argv[5] || path.join(require('os').tmpdir(), 'psk_scan');
const BRAVE = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  let sessionCookie = null;

  for (let attempt = 0; attempt < 3 && !sessionCookie; attempt++) {
    console.error(`[attempt ${attempt + 1}] launching...`);
    const browser = await puppeteer.launch({
      headless: false,
      executablePath: BRAVE,
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720', '--disable-blink-features=AutomationControlled']
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    page.on('response', async res => {
      try {
        if (res.url().includes('login.cgi')) {
          const sc = res.headers()['set-cookie'];
          if (sc) {
            const m = sc.match(/Cookie=([^;]+)/);
            if (m) { sessionCookie = m[1]; console.error('SESSION COOKIE:', sessionCookie); }
          }
        }
      } catch (e) {}
    });
    page.on('pageerror', e => console.error('pageerror:', e.message.slice(0, 120)));
    page.on('crash', () => console.error('TAB CRASHED'));

    try {
      console.error('goto admin.html...');
      await page.goto(`https://${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(2500);

      await page.evaluate(() => {
        window.setDisable = () => {};
        window.CheckPassword = () => 0;
        window.Userlevel = 0;
        window.preflag = 0;
      });

      console.error('driving login from page context...');
      const loginResult = await page.evaluate(async (u, p) => {
        const b64 = typeof window.base64encode === 'function'
          ? window.base64encode(p)
          : btoa(p);
        let cnt = '';
        try {
          const r = await fetch('/asp/GetRandCount.asp', { method: 'POST' });
          cnt = (await r.text()).trim();
        } catch (e) { return { err: 'randcount:' + e.message }; }
        const params = new URLSearchParams();
        params.append('UserName', u);
        params.append('PassWord', b64);
        params.append('Language', 'english');
        params.append('x.X_HW_Token', cnt);
        try {
          const resp = await fetch('/login.cgi', { method: 'POST', body: params });
          const text = await resp.text();
          return { ok: resp.ok, status: resp.status, cnt: cnt.slice(0, 20), body: text.slice(0, 120).replace(/\s+/g, ' ') };
        } catch (e) { return { err: 'login:' + e.message }; }
      }, USER, PASS);
      console.error('login result:', JSON.stringify(loginResult).slice(0, 300));
      await sleep(1500);

      for (let i = 0; i < 30 && !sessionCookie; i++) {
        await sleep(1000);
        if (!sessionCookie) {
          try {
            const cookies = await page.cookies();
            const co = cookies.find(c => c.name === 'Cookie');
            if (co) { sessionCookie = co.value; console.error('COOKIE FROM STORE:', sessionCookie); }
          } catch (e) {}
        }
      }

      if (!sessionCookie) { await browser.close(); continue; }

      console.error('goto cfgfile.asp...');
      for (let n = 0; n < 6; n++) {
        try {
          await page.goto(`https://${ROUTER}/html/ssmp/cfgfile/cfgfile.asp`, { waitUntil: 'domcontentloaded', timeout: 25000 });
          break;
        } catch (e) {
          console.error('nav fail', n + 1, e.message.slice(0, 70));
          await sleep(2000);
        }
      }
      await sleep(2500);

      if (!page.url().includes('cfgfile')) {
        console.error('redirected, retrying...');
        for (let n = 0; n < 6; n++) {
          try {
            await page.goto(`https://${ROUTER}/html/ssmp/cfgfile/cfgfile.asp`, { waitUntil: 'domcontentloaded', timeout: 25000 });
            break;
          } catch (e) { await sleep(2000); }
        }
        await sleep(2500);
      }

      let token = '';
      try {
        await page.waitForFunction(() => {
          const el = document.getElementById('hwonttoken');
          return el && el.value && el.value.length > 0;
        }, { timeout: 15000 }).catch(() => {});
        token = await page.evaluate(() => document.getElementById('hwonttoken')?.value || '');
      } catch (e) { console.error('token read fail:', e.message.slice(0, 80)); }

      console.error('hwonttoken =', token ? token.slice(0, 40) : 'MISSING', '| url =', page.url());

      if (!token) {
        await browser.close();
        continue;
      }

      console.error('preparing file load...');
      await page.evaluate(() => {
        try {
          const prep = new XMLHttpRequest();
          prep.open('GET', '/html/ssmp/common/StartFileLoad.asp', false);
          prep.send();
        } catch (e) {}
      });
      await sleep(1500);

      let xml = await page.evaluate(async (tok) => {
        try {
          const resp = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'x.X_HW_Token=' + encodeURIComponent(tok),
          });
          if (resp.ok) {
            const text = await resp.text();
            if (text && text.length > 500 && text.includes('<')) return text;
          }
        } catch (e) { console.error('fetch err:', e.message); }
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', false);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
          xhr.send('x.X_HW_Token=' + encodeURIComponent(tok));
          if (xhr.status === 200 && xhr.responseText && xhr.responseText.length > 500 && xhr.responseText.includes('<')) return xhr.responseText;
        } catch (e) {}
        return null;
      }, token);

      if (xml) {
        const file = path.join(OUTDIR, 'hw_ctree.xml');
        fs.writeFileSync(file, xml, 'utf8');
        console.error('CONFIG SAVED:', file, xml.length, 'bytes');
        console.log('CONFIG_OK');
        await browser.close();
        process.exit(0);
      }
      console.error('config download returned nothing');
      await browser.close();
    } catch (e) {
      console.error('flow error:', e.message.slice(0, 200));
      try { await browser.close(); } catch (e2) {}
    }
  }
  console.log(JSON.stringify({ error: 'no config obtained, sessionCookie=' + !!sessionCookie }));
  process.exit(1);
})();
