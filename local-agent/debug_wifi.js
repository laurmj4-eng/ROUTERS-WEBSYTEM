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

  // Check various WiFi-related pages
  const pagesToCheck = [
    'html/amp/wlanschedule/WlanSchedule.asp',
    'html/amp/wlanadvanced/WlanAdvanced.asp',
    'html/amp/wlanradio/WlanRadio.asp',
    'html/amp/wlanbasic/WlanBasic.asp?2G',
    'html/ssmp/wireless/basic/index.asp',
  ];

  for (const pg of pagesToCheck) {
    console.log(`\n=== ${pg} ===`);
    await p.goto(`${ROUTER}/${pg}`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 10000}).catch(e => console.log(`   Navigation error: ${e.message.substring(0, 60)}`));
    await sleep(2000);
    const info = await p.evaluate(() => {
      const allControls = [];
      document.querySelectorAll('input, select, button').forEach(el => {
        const id = el.id || '';
        const name = el.name || '';
        if (id || name) {
          const c = {id, name, type: el.type || el.tagName};
          if (el.type === 'checkbox') c.checked = el.checked;
          if (el.tagName === 'SELECT') {
            c.value = el.value;
            c.options = Array.from(el.options).map(o => o.value.substring(0, 30));
          } else if (el.value && el.value.length < 100) {
            c.value = el.value.substring(0, 60);
          }
          allControls.push(c);
        }
      });
      // Get JS variables
      const js = {};
      try { js.WlanScheduleEnable = window.WlanScheduleEnable; } catch(e) {}
      try { js.wlSchedEnbl = window.wlSchedEnbl; } catch(e) {}
      try { js.schedEnabled = window.schedEnabled; } catch(e) {}
      try { js.wlRadioEnable = window.wlRadioEnable; } catch(e) {}
      try { js.CfgMode = window.CfgMode; } catch(e) {}
      try { js.wlanpage = window.wlanpage; } catch(e) {}
      try { js.bodyStart = document.body?.innerHTML?.substring(0, 300) || ''; } catch(e) {}
      return {url: window.location.href.substring(0, 100), controls: allControls, js, title: document.title?.substring(0, 80)};
    }).catch(() => ({}));
    console.log(`   URL: ${info.url}`);
    console.log(`   Title: ${info.title}`);
    if (info.js) console.log(`   JS:`, JSON.stringify(info.js));
    const relevant = info.controls?.filter(c => 
      /wlSchedule|wlSched|wlRadio|wlEnbl|wlEnable|wlHide|wlBand|wlPower|wlCountry|wlChannel|enable|sched/i.test(c.id || c.name)
    ) || [];
    if (relevant.length) console.log(`   Relevant:`, JSON.stringify(relevant, null, 2));
  }

  await sleep(3000);
  await b.close();
})();
