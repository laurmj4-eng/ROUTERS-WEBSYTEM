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

  async function dumpPage(label, path) {
    await p.goto(`${ROUTER}/${path}`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
    await sleep(3000);
    const d = await p.evaluate(() => {
      const all = [];
      document.querySelectorAll('select, input, button').forEach(el => {
        if (el.id || el.name) {
          const info = {id: el.id, name: el.name, type: el.type || el.tagName};
          if (el.type === 'checkbox') info.checked = el.checked;
          if (el.tagName === 'SELECT') {
            info.value = el.value;
            info.options = Array.from(el.options).map(o => ({val: o.value, txt: o.text.substring(0, 40)}));
          } else if (el.type === 'text' || el.type === 'hidden') {
            info.value = el.value.substring(0, 60);
          }
          all.push(info);
        }
      });
      // Also try to read JS variables
      const jsVars = {};
      try { jsVars.wlChannel = window.wlChannel; } catch(e) {}
      try { jsVars.wlCountry = window.wlCountry; } catch(e) {}
      try { jsVars.wlBand = window.wlBand; } catch(e) {}
      try { jsVars.WlanWifiArr = window.WlanWifiArr; } catch(e) {}
      try { jsVars.wlanpage = window.wlanpage; } catch(e) {}
      try { jsVars.CfgMode = window.CfgMode; } catch(e) {}
      return {elements: all, jsVars, url: window.location.href};
    }).catch(() => ({elements: [], jsVars: {}, url: ''}));
    console.log(`\n=== ${label} (${d.url.substring(0, 80)}) ===`);
    console.log('JS Vars:', JSON.stringify(d.jsVars, null, 2));
    const relevant = d.elements.filter(e => 
      ['wlChannel','wlCountry','wlBand','wlEnbl','wlEnable','wlHide','wlSsid','wlWpaPsk'].some(k => e.id?.includes(k) || e.name?.includes(k)) ||
      e.tagName === 'SELECT' || e.type === 'checkbox'
    );
    console.log('Controls:', JSON.stringify(relevant, null, 2));
  }

  await dumpPage('2.4G', 'html/amp/wlanbasic/WlanBasic.asp?2G');
  await dumpPage('5G', 'html/amp/wlanbasic/WlanBasic.asp?5G');

  // Check if onclick on Apply button exists
  console.log('\n=== Apply button handlers ===');
  for (const path of ['html/amp/wlanbasic/WlanBasic.asp?2G', 'html/amp/wlanbasic/WlanBasic.asp?5G']) {
    await p.goto(`${ROUTER}/${path}`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
    await sleep(2000);
    const btnInfo = await p.evaluate(() => {
      const btn = document.getElementById('btnApplySubmit');
      if (!btn) return {found: false};
      const onclick = btn.getAttribute('onclick');
      const listeners = typeof getEventListeners !== 'undefined' ? getEventListeners(btn) : 'N/A';
      return {found: true, onclick: onclick ? onclick.substring(0, 200) : null, text: btn.innerHTML?.substring(0, 100) || btn.value?.substring(0, 100)};
    }).catch(() => ({}));
    console.log(path.substring(0, 40), ':', JSON.stringify(btnInfo));
  }

  await sleep(3000);
  await b.close();
})();
