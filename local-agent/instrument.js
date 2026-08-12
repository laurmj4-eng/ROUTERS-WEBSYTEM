const puppeteer = require('puppeteer');
const BRAVE = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const ROUTER = '192.168.1.1';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: BRAVE,
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  page.on('dialog', async d => { console.error('DIALOG:', d.message().slice(0, 80)); await d.dismiss(); });
  page.on('pageerror', e => console.error('pageerror:', e.message.slice(0, 150)));
  page.on('crash', () => console.error('TAB CRASHED'));
  page.on('response', async res => {
    try {
      if (/\.(cgi|asp)/.test(res.url())) {
        const h = res.headers();
        console.error(`RESP ${res.status()} ${res.url().replace('https://192.168.1.1', '')} set-cookie=${h['set-cookie'] ? h['set-cookie'].slice(0, 100) : '-'}`);
      }
    } catch (e) {}
  });

  // 1) First clean visit: dump server-embedded globals BEFORE any override
  await page.goto(`https://${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);
  const g1 = await page.evaluate(() => ({
    url: location.href,
    Userlevel: typeof Userlevel !== 'undefined' ? Userlevel : null,
    UserLeveladmin: typeof UserLeveladmin !== 'undefined' ? UserLeveladmin : null,
    preflag: typeof preflag !== 'undefined' ? preflag : null,
    CfgMode: typeof CfgMode !== 'undefined' ? CfgMode : null,
    ModifyPasswordFlag: typeof ModifyPasswordFlag !== 'undefined' ? ModifyPasswordFlag : null,
    pwdmodify: typeof pwdmodify !== 'undefined' ? pwdmodify : null,
    LoginTimes: typeof LoginTimes !== 'undefined' ? LoginTimes : null,
  }));
  console.error('GLOBALS (clean visit):', JSON.stringify(g1));

  // 2) Now the fetch-driven login WITHOUT overrides, replicating the firmware's non-PLDT path
  const lr = await page.evaluate(async () => {
    const res = [];
    const doLogin = async (u, p) => {
      const b64 = typeof window.base64encode === 'function' ? window.base64encode(p) : btoa(p);
      let cnt = '';
      try { const r = await fetch('/asp/GetRandCount.asp', { method: 'POST' }); cnt = (await r.text()).trim(); res.push('randcount=' + cnt); } catch (e) { res.push('randcount ERR ' + e.message); }
      const params = new URLSearchParams();
      params.append('UserName', u);
      params.append('PassWord', b64);
      params.append('Language', 'english');
      params.append('x.X_HW_Token', cnt);
      try {
        const r = await fetch('/login.cgi', { method: 'POST', body: params });
        const t = await r.text();
        res.push('login.cgi status=' + r.status + ' body=' + t.replace(/\s+/g, ' ').slice(0, 150));
      } catch (e) { res.push('login ERR ' + e.message); }
    };
    await doLogin('admin', '1234');
    return res;
  });
  console.error('LOGIN RESULT:', JSON.stringify(lr));
  await sleep(2000);

  // 3) Dump all cookies now
  const ck = await page.cookies();
  console.error('COOKIES:', JSON.stringify(ck.map(c => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }))));

  // 4) Reload admin.html with whatever cookies exist — dump globals again + alert behavior
  await page.goto(`https://${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(2500);
  const g2 = await page.evaluate(() => ({
    url: location.href,
    Userlevel: typeof Userlevel !== 'undefined' ? Userlevel : null,
    UserLeveladmin: typeof UserLeveladmin !== 'undefined' ? UserLeveladmin : null,
    preflag: typeof preflag !== 'undefined' ? preflag : null,
    ModifyPasswordFlag: typeof ModifyPasswordFlag !== 'undefined' ? ModifyPasswordFlag : null,
    loginFormVisible: !!document.querySelector('input#txt_Username'),
  }));
  console.error('GLOBALS (after login attempt):', JSON.stringify(g2));

  // 5) cfgfile.asp with these cookies
  await page.goto(`https://${ROUTER}/html/ssmp/cfgfile/cfgfile.asp`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => console.error('cfg goto err', e.message.slice(0, 80)));
  await sleep(2000);
  console.error('CFG URL:', page.url());
  const tok = await page.evaluate(() => document.getElementById('hwonttoken')?.value || 'MISSING').catch(e => 'eval err ' + e.message.slice(0, 60));
  console.error('hwonttoken:', String(tok).slice(0, 60));

  await browser.close();
})();
