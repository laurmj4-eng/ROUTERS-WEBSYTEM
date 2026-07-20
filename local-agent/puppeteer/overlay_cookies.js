const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Log ALL cookies before and after
  console.log('Initial cookies:', JSON.stringify(await p.cookies()));

  // Monitor responses for Set-Cookie
  p.on('response', async res => {
    const headers = res.headers();
    if (headers['set-cookie']) {
      console.log('<<< Set-Cookie from', res.url(), ':', headers['set-cookie']);
    }
  });

  // Navigate to login page
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:20000});
  console.log('After page load cookies:', JSON.stringify(await p.cookies()));

  // Override setDisable
  await p.evaluate(() => { window.setDisable = () => {}; });

  // Type credentials
  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:10});

  // Click login
  await p.click('button#button');
  await new Promise(r => setTimeout(r,3000));

  console.log('After login click cookies:', JSON.stringify(await p.cookies()));
  console.log('Current URL:', p.url());

  // Wait for navigation
  await new Promise(r => setTimeout(r,5000));

  console.log('After navigation cookies:', JSON.stringify(await p.cookies()));
  console.log('Current URL:', p.url());

  // Now try to access admin.html again
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  console.log('After admin reload URL:', p.url());
  const hasMenu = await p.evaluate(() => {
    return {
      url: window.location.href,
      hasFrame: !!document.querySelector('frame'),
      bodyHTML: document.body.innerHTML.substring(0, 300),
    };
  });
  console.log('Admin page state:', JSON.stringify(hasMenu));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
