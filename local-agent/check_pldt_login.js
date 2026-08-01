const PUPPETEER = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ROUTER = 'https://192.168.1.1';

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  // Capture XHR responses
  p.on('response', async res => {
    const url = res.url();
    if (url.includes('get_') || url.includes('set_') || url.includes('wifi_status')) {
      try {
        const txt = await res.text().catch(() => '');
        if (txt.length > 5) console.log(`\nXHR ${url.substring(0, 80)}\n${txt.substring(0, 1500)}`);
      } catch(e) {}
    }
  });

  // Navigate to PLDT login page
  console.log('Loading PLDT login page...');
  await p.goto(`${ROUTER}/html/login_pldt.html`, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 10000}).catch(e => console.log(`Nav error: ${e.message.substring(0, 60)}`));
  await sleep(3000);

  const pageInfo = await p.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({id: i.id, name: i.name, type: i.type}));
    const buttons = Array.from(document.querySelectorAll('button, input[type=button], input[type=submit]')).map(b => ({id: b.id, text: (b.value || b.textContent || '').substring(0, 30)}));
    return {url: window.location.href.substring(0, 80), title: document.title?.substring(0, 50), inputs, buttons, body: document.body?.innerHTML?.substring(0, 1500) || ''};
  }).catch(() => ({}));
  console.log('Page info:', JSON.stringify(pageInfo, null, 2));

  // If we got here, try the login
  if (pageInfo.inputs && pageInfo.inputs.length > 0) {
    console.log('\nAttempting login (try 1: admin / 1234)...');
    
    // Try to set values and click login
    const loginResult = await p.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      let userField = null, passField = null, loginBtn = null;
      
      inputs.forEach(i => {
        const id = (i.id || '').toLowerCase();
        const name = (i.name || '').toLowerCase();
        const type = (i.type || '').toLowerCase();
        if (id.includes('user') || name.includes('user') || id.includes('name') || name.includes('name')) userField = i;
        if (type === 'password' || id.includes('pass') || name.includes('pass') || id.includes('pwd') || name.includes('pwd')) passField = i;
        if (type === 'submit' || type === 'button' || id.includes('login') || id.includes('btn')) loginBtn = i;
      });
      
      buttons = Array.from(document.querySelectorAll('button, input[type=button], input[type=submit]'));
      if (!loginBtn && buttons.length > 0) loginBtn = buttons[buttons.length - 1];
      
      return {
        userField: userField ? {id: userField.id, name: userField.name} : null,
        passField: passField ? {id: passField.id, name: passField.name} : null,
        loginBtn: loginBtn ? {id: loginBtn.id, tag: loginBtn.tagName, text: loginBtn.value || loginBtn.textContent} : null
      };
    });
    console.log('Login fields:', JSON.stringify(loginResult));
  }

  await sleep(3000);
  await b.close();
})();
