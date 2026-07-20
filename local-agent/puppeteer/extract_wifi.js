const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Log network for debugging
  p.on('response', async res => {
    if (res.url().includes('WlanBasic') || res.url().includes('wlbasic') || res.url().includes('wlan')) {
      console.log('WLAN response:', res.status(), res.url());
      if (res.url().includes('asp')) {
        const text = await res.text();
        console.log('WLAN content (first 2000):', text.substring(0, 2000));
      }
    }
  });

  // Pre-login: override setDisable to make button clickable
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,1000));
  await p.evaluate(() => { window.setDisable = () => {}; });

  // Login
  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:10});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,3000));

  console.log('After login URL:', p.url());

  // Save the session cookie for later use
  const cookies = await p.cookies();
  console.log('Session cookie:', JSON.stringify(cookies));

  // Try navigating directly to WLAN page
  console.log('\nAccessing WLAN Basic page...');
  const wlanResp = await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  console.log('WLAN page status:', wlanResp.status());
  
  await new Promise(r => setTimeout(r,3000));
  const wlanUrl = p.url();
  console.log('WLAN page URL:', wlanUrl);
  const wlanContent = await p.content();
  console.log('WLAN page length:', wlanContent.length);

  // Search for password patterns
  const pwdMatches = wlanContent.match(/PreSharedKey|wpaPskKey|passphrase|PassPhrase|"\\x2a\\x2a|password|PskKey/gi);
  console.log('Password matches:', pwdMatches ? pwdMatches.slice(0, 20) : 'none');

  // Check if it's the login page or the actual WLAN page
  const isLoginPage = wlanContent.includes('txt_Username') || wlanContent.includes('adminpldt');
  console.log('Is login page:', isLoginPage);

  // Look for the password value in JavaScript arrays
  const pskMatch = wlanContent.match(/wpaPskKey[^;]+/);
  if (pskMatch) console.log('wpaPskKey line:', pskMatch[0]);

  // Try the config download page
  console.log('\nAccessing config download page...');
  const cfgResp = await p.goto('https://192.168.1.1/html/ssmp/cfgfile/cfgfile.asp', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  console.log('Config page status:', cfgResp.status());
  await new Promise(r => setTimeout(r,2000));
  const cfgContent = await p.content();
  console.log('Config page length:', cfgContent.length);
  console.log('Config page first 500:', cfgContent.substring(0, 500));

  // Try direct config download
  console.log('\nTrying direct config download...');
  const downloadResp = await p.goto('https://192.168.1.1/backupcfg.cgi', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  console.log('Download status:', downloadResp.status());
  console.log('Download URL:', p.url());
  const dlContent = await p.content();
  console.log('Download content (first 500):', dlContent.substring(0, 500));

  // Try dumpcfg
  console.log('\nTrying dumpcfg...');
  const dumpResp = await p.goto('https://192.168.1.1/dumpcfg.cgi', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  console.log('dumpcfg status:', dumpResp.status());
  console.log('dumpcfg URL:', p.url());
  const dumpContent = await p.content();
  console.log('dumpcfg content (first 500):', dumpContent.substring(0, 500));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
