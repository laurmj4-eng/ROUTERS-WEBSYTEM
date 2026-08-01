const PUPPETEER = require('puppeteer');
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const b = await PUPPETEER.launch({headless: true, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors']});
  const p = await b.newPage();
  await p.goto('https://192.168.1.1/admin.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  
  // Get SubmitForm source
  const src = await p.evaluate(() => {
    // Try to find the function definition in inline scripts
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      if (s.textContent && s.textContent.includes('SubmitForm')) {
        const lines = s.textContent.split('\n').filter(l => l.includes('SubmitForm') || l.includes('CheckPassword') || l.includes('PassWord'));
        return lines.slice(0, 30).join('\n');
      }
    }
    return 'Not found in inline scripts';
  });
  console.log('SubmitForm/PassWord lines:', src);
  
  // Also check for XMLHttpRequest to login.cgi
  const handlers = await p.evaluate(() => {
    const results = {};
    // Check if PassWord hidden field exists
    const pw = document.querySelector('input[name=PassWord]');
    results.hasPassWordInput = !!pw;
    results.passWordValue = pw ? pw.value : null;
    // Check all input names
    const inputs = Array.from(document.querySelectorAll('input')).map(i => i.name);
    results.inputNames = inputs;
    return results;
  });
  console.log('Form inputs:', JSON.stringify(handlers));
  
  await b.close();
})();
