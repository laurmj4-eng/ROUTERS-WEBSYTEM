const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  // Fetch all JS files that might contain fhdecrypt
  const jsFiles = [
    '/js/aes.js', '/js/util_functions.js', '/js/util.js',
    '/js/xhr.js', '/js/validate.js', '/js/i18n.js',
    '/js/loadcss.js', '/js/util_global_vars.js',
    '/js/default_pwdmodify_pldt.js',
  ];

  for (const js of jsFiles) {
    try {
      await p.goto(ROUTER + js, {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 5000});
      await sleep(300);
      const text = await p.evaluate(() => document.body.innerText).catch(() => '');
      // Search for fhdecrypt
      if (text.includes('fhdecrypt') || text.includes('fhEncrypt') || text.includes('decrypt')) {
        const lines = text.split('\n');
        const relevant = lines.filter(l => l.includes('fhdecrypt') || l.includes('fhEncrypt') || l.includes('decrypt') || l.includes('AES'));
        console.log(`\n=== ${js} (${text.length} bytes) ===`);
        relevant.forEach(l => console.log(l.substring(0, 200)));
      }
    } catch(e) {
      console.log(`Error fetching ${js}: ${e.message.substring(0,60)}`);
    }
  }

  // Also check if fhdecrypt is available on the page after login
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

  const decryptTest = await p.evaluate(() => {
    const fns = [];
    if (typeof fhdecrypt !== 'undefined') fns.push('fhdecrypt');
    if (typeof fhEncrypt !== 'undefined') fns.push('fhEncrypt');
    if (typeof aes_encrypt !== 'undefined') fns.push('aes_encrypt');
    if (typeof aes_decrypt !== 'undefined') fns.push('aes_decrypt');
    if (typeof decrypt !== 'undefined') fns.push('decrypt');
    return {available: fns, source: fhdecrypt ? fhdecrypt.toString().substring(0, 500) : 'N/A'};
  });
  console.log('\n\nAvailable decrypt functions:', JSON.stringify(decryptTest, null, 2));

  // Try using fhdecrypt to decrypt the PreSharedKey
  if (decryptTest.available.includes('fhdecrypt')) {
    const decrypted = await p.evaluate(() => {
      const psk = '740A43B6F50929A77420BA8F2183784A';
      const ssid = '3C6397D3597E39AF24D941A31E28217548435357063A7EC1146928959F4C86BF';
      return {
        psk: fhdecrypt(psk),
        ssid: fhdecrypt(ssid),
      };
    });
    console.log('Decrypted values:', JSON.stringify(decrypted));
  }

  await b.close();
})();
