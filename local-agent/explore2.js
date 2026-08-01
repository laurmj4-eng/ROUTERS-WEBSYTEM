const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  // Fetch the key JS files
  for (const js of ['/js/default_pwdmodify_pldt.js', '/js/access.js', '/js/util.js', '/js/util_functions.js']) {
    try {
      await p.goto(ROUTER + js, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 5000});
      await sleep(500);
      const text = await p.evaluate(() => document.body.innerText).catch(() => '');
      // Print first 1500 chars
      console.log(`\n=== ${js} ===`);
      console.log(text.substring(0, 2000));
    } catch(e) {
      console.log(`\n=== ${js} === ERROR: ${e.message.substring(0,60)}`);
    }
  }

  // Now login and check what the Cancel button does
  console.log('\n\n=== Login and check Cancel button ===');
  await p.goto(ROUTER + '/html/login_pldt.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => {
    window.CheckPassword = () => 0;
    document.getElementById('user_name').value = 'admin';
    document.getElementById('loginpp').value = '1234';
  });
  await sleep(500);
  await p.evaluate(() => document.getElementById('login_btn').click());
  await sleep(3000);

  // Check the Cancel button's onclick
  const cancelInfo = await p.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, input[type=button]'));
    const info = buttons.map(b => ({
      id: b.id, value: b.value, type: b.type, 
      onclick: b.getAttribute('onclick'),
      onclicks: b.onclick ? b.onclick.toString() : null
    }));
    return info;
  });
  console.log('Buttons:', JSON.stringify(cancelInfo, null, 2));

  // Also check what happens when clicking Cancel
  // Try overriding session check and navigating
  await p.evaluate(() => {
    // Override any blocking functions
    window.isForceModifyPwd = () => false;
    window.forceModifyFlag = false;
    window.skipFlag = true;
  });
  
  // Click Cancel and see what happens
  const cancelBtn = await p.$('input[value="Cancel"]');
  if (cancelBtn) {
    console.log('Clicking Cancel...');
    await cancelBtn.click();
    await sleep(2000);
    console.log('URL after Cancel:', p.url());
    console.log('Text:', await p.evaluate(() => document.body.innerText.substring(0, 200)).catch(() => '?'));
  }

  // Also try: the Cancel might use window.location or parent.location
  await p.goto(ROUTER + '/html/login_pldt.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  await p.evaluate(() => {
    window.CheckPassword = () => 0;
    document.getElementById('user_name').value = 'admin';
    document.getElementById('loginpp').value = '1234';
  });
  await sleep(500);
  await p.evaluate(() => document.getElementById('login_btn').click());
  await sleep(3000);

  // After login, try directly hitting the main admin index
  // Check if there's a referrer requirement
  console.log('\n=== Testing with Referer header ===');
  await p.goto(ROUTER + '/html/bbsp/userdevinfo/userdevinfo.asp', {
    waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 5000,
    referer: ROUTER + '/html/default_pwdmodify_pldt.html'
  }).catch(() => {});
  await sleep(1000);
  console.log('URL with Referer:', p.url(), 'Text:', await p.evaluate(() => document.body.innerText.substring(0, 100)).catch(() => '?'));

  await b.close();
})();
