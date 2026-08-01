const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();

  // Capture ALL responses to see what happens during ApplySubmit
  p.on('response', async res => {
    const url = res.url();
    if (url.includes('set.cgi') || url.includes('login.cgi') || url.includes('MdfPwd')) {
      try {
        const txt = await res.text().catch(() => '');
        console.log(`\n=== Response ${res.status()} ${url.substring(0, 100)} ===`);
        console.log(txt.substring(0, 1000));
      } catch(e) {}
    }
  });

  console.log('Logging in...');
  await p.goto(`${ROUTER}/login.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);
  await p.evaluate(() => { window.CheckPassword = () => 0; window.setDisable = () => {}; window.DisplayWifiPldt = () => {}; window.BandSteeringState = () => {}; window.LockLeftTime = 0; window.FailStat = '0'; window.LoginTimes = 0; });
  await p.type('input#txt_Username', 'admin');
  await p.type('input#txt_Password', '1234');
  await p.click('button#button');
  await sleep(5000);

  console.log('\nNavigating to WLAN 2.4G...');
  await p.goto(`${ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(3000);

  // Check if there's also /admin.html accessible
  console.log('\nChecking /admin.html...');
  await p.goto(`${ROUTER}/admin.html`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 10000}).catch(e => console.log(`   admin.html error: ${e.message.substring(0, 60)}`));
  await sleep(2000);
  console.log('   /admin.html URL:', p.url().substring(0, 80));
  const adminPage = await p.evaluate(() => ({
    hasLoginForm: !!document.getElementById('txt_Username'),
    hasAdminFields: !!document.getElementById('txt_Password'),
    buttons: Array.from(document.querySelectorAll('button, input[type=button], input[type=submit]')).map(b => ({id: b.id, value: (b.value || '').substring(0, 30)})),
    hasPwdModify: !!document.getElementById('pwd_modify'),
  })).catch(() => ({}));
  console.log('   admin.html content:', JSON.stringify(adminPage));

  // Navigate back to WLAN page and call ApplySubmit, capturing the response
  console.log('\nCalling ApplySubmit() on 2.4G...');
  await p.goto(`${ROUTER}/html/amp/wlanbasic/WlanBasic.asp?2G`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(2000);

  // Monitor for set.cgi request/response
  await p.evaluate(() => { ApplySubmit(); });
  console.log('   ApplySubmit called, waiting for response...');
  await sleep(15000);

  console.log('\nFinal URL:', p.url().substring(0, 100));

  await sleep(3000);
  await ctx.close();
  await b.close();
})();
