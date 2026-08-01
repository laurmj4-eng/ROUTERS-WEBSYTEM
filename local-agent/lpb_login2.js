const PUPPETEER = require('puppeteer');
const ROUTER = 'http://10.0.0.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, args: ['--no-sandbox', '--window-size=1280,720']});
  const p = await b.newPage();

  // Intercept all network requests
  const requests = [];
  p.on('request', req => {
    if (req.method() === 'POST') {
      requests.push({
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
        postData: req.postData()
      });
      console.log('\n=== INTERCEPTED POST ===');
      console.log('URL:', req.url());
      console.log('Post data:', req.postData());
    }
  });

  p.on('response', resp => {
    const url = resp.url();
    if (url.includes('exec=')) {
      resp.text().then(t => {
        console.log('\n=== RESPONSE from', url, '===');
        console.log(t?.substring(0, 500));
      }).catch(() => {});
    }
  });

  // Navigate to login page
  await p.goto(ROUTER + '/admin/index', {waitUntil: 'domcontentloaded'});
  await sleep(2000);
  console.log('Page loaded');

  // Fill in the login form using the DOM
  await p.evaluate(() => {
    document.querySelector('#username').value = 'admin';
    document.querySelector('#password').value = '123456789';
    document.querySelector('#captcha').value = '';
  });
  
  await sleep(500);

  // Click the Sign In button
  await p.evaluate(() => {
    document.querySelector('#kt_login_signin_submit').click();
  });
  
  await sleep(5000);
  
  console.log('\n=== ALL INTERCEPTED POSTS ===');
  console.log(JSON.stringify(requests, null, 2));
  
  console.log('\nCurrent URL:', p.url());
  const text = await p.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '');
  console.log('Page text:', text);

  await sleep(5000);
  await b.close();
})();
