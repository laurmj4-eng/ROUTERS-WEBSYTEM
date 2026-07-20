const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Monitor ALL network requests
  p.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('set.cgi')) {
      console.log('>>> POST to set.cgi:', req.url().substring(0, 200));
    }
  });
  p.on('response', res => {
    if (res.url().includes('set.cgi')) {
      console.log('<<< Response from set.cgi:', res.status(), res.url().substring(0, 150));
    }
    if (res.url().includes('acl.asp')) {
      console.log('<<< ACL page loaded');
    }
  });

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:20000});
  await p.evaluate(() => { window.setDisable = () => {}; });
  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:10});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  // Navigate to Device Access Control
  await p.goto('https://192.168.1.1/html/bbsp/acl/acl.asp', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,3000));

  // Check current checkbox states
  const state = await p.evaluate(() => {
    return {
      sshlan: document.getElementById('sshlan')?.checked,
      sshwan: document.getElementById('sshwan')?.checked,
      telnetlan: document.getElementById('telnetlan')?.checked,
      sshlanEl: document.getElementById('sshlan')?.outerHTML,
      hwonttoken: document.getElementById('hwonttoken')?.value,
    };
  });
  console.log('Current state:', JSON.stringify(state));

  // If SSH is disabled, enable it
  if (state.sshlan === false) {
    console.log('Enabling SSH LAN...');
    await p.evaluate(() => {
      const cb = document.getElementById('sshlan');
      if (cb) cb.checked = true;
    });
    console.log('SSH LAN checkbox set to true');
  }

  // Click Apply button - find it
  const buttons = await p.evaluate(() => {
    const btnList = [];
    document.querySelectorAll('input[type="button"], button').forEach(el => {
      if (el.id || el.value || el.innerText) {
        btnList.push({id: el.id, value: el.value, text: el.innerText?.substring(0,20)});
      }
    });
    return btnList;
  });
  console.log('Buttons:', JSON.stringify(buttons));

  // Try clicking the apply button
  const clicked = await p.evaluate(() => {
    const btn = document.getElementById('btnApply') || 
               document.querySelector('input[value="Apply"]') ||
               document.querySelector('input[value="apply"]') ||
               document.querySelector('button:contains("Apply")');
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log('Clicked Apply:', clicked);

  await new Promise(r => setTimeout(r,5000));

  console.log('After apply URL:', p.url());

  // Check state again
  const state2 = await p.evaluate(() => {
    return {
      sshlan: document.getElementById('sshlan')?.checked,
      url: window.location.href,
    };
  });
  console.log('State after apply:', JSON.stringify(state2));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
