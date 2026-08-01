const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  console.log('Logging in...');
  await p.goto(`${ROUTER}/login.asp`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(3000);
  await p.evaluate(() => { window.CheckPassword = () => 0; window.setDisable = () => {}; window.DisplayWifiPldt = () => {}; window.BandSteeringState = () => {}; window.LockLeftTime = 0; window.FailStat = '0'; window.LoginTimes = 0; });
  await p.type('input#txt_Username', 'admin');
  await p.type('input#txt_Password', '1234');
  await p.click('button#button');
  await sleep(5000);

  async function checkBand(label, path) {
    await p.goto(`${ROUTER}/${path}`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
    await sleep(3000);
    const s = await p.evaluate(() => {
      const g = id => { const e = document.getElementById(id); return e ? {tag: e.tagName, type: e.type, val: e.value, checked: e.checked} : null; };
      const s = id => { const e = document.getElementById(id); return e ? {val: e.value, txt: e.options[e.selectedIndex]?.text} : null; };
      return {
        wlEnbl: g('wlEnbl'),
        wlEnable: g('wlEnable'),
        wlHide: g('wlHide'),
        wlSsid1: g('wlSsid1'),
        wlAuthMode: s('wlAuthMode'),
        wlChannel: s('wlChannel'),
        wlCountry: g('wlCountry'),
        wlBand: s('wlBand'),
        url: window.location.href.substring(0, 100),
        html: document.body?.innerHTML?.substring(0, 3000) || ''
      };
    }).catch(() => ({}));
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify(s, null, 2));
    return s;
  }

  await checkBand('2.4G', 'html/amp/wlanbasic/WlanBasic.asp?2G');
  await checkBand('5G', 'html/amp/wlanbasic/WlanBasic.asp?5G');

  console.log('\nDone - check output above.');
  await sleep(5000);
  await b.close();
})();
