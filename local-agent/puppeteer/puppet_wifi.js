const puppeteer = require('puppeteer');

const ROUTER_IP = '192.168.1.1';

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Step 1: Login to admin panel
  console.log('Navigating to admin.html...');
  await page.goto(`https://${ROUTER_IP}/admin.html`, {
    waitUntil: 'networkidle0',
    timeout: 30000,
    rejectUnauthorized: false,
  });

  console.log('Page loaded.');
  // Get page title and content snippet
  const title = await page.title();
  console.log('Title:', title);

  // Wait a bit and check for login form
  await new Promise(r => setTimeout(r, 2000));

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body text preview:', bodyText.substring(0, 500));

  // Check for login fields
  const html = await page.content();
  console.log('HTML preview:', html.substring(0, 2000));

  // Try to see if there's a login form
  const inputs = await page.evaluate(() => {
    const all = document.querySelectorAll('input');
    return Array.from(all).map(i => ({ id: i.id, name: i.name, type: i.type, placeholder: i.placeholder }));
  });
  console.log('Input fields:', JSON.stringify(inputs, null, 2));

  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
  console.log('Done');
})();
