const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Monitor ALL Set-Cookie responses
  let sessionCookie = null;
  p.on('response', async res => {
    const headers = res.headers();
    if (headers['set-cookie']) {
      console.log('Set-Cookie from', res.url(), ':', headers['set-cookie']);
    }
  });

  // Step 1: Login to admin.html
  console.log('=== STEP 1: Login ===');
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:20000});
  await p.evaluate(() => { window.setDisable = () => {}; });
  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:10});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  console.log('URL:', p.url());
  const cookies = await p.cookies();
  console.log('Cookies:', JSON.stringify(cookies));
  if (cookies.length > 0) sessionCookie = cookies[0].name + '=' + cookies[0].value;

  // Step 2: Try index.asp
  console.log('\n=== STEP 2: index.asp ===');
  await p.goto('https://192.168.1.1/index.asp', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  console.log('URL:', p.url());
  const idxContent = await p.content();
  console.log('index.asp length:', idxContent.length);
  console.log('Contains frame:', idxContent.includes('<frame'));
  console.log('Contains menu:', idxContent.includes('menu') || idxContent.includes('Menu'));

  // Step 3: Try to navigate to WLAN page from index
  if (p.url().includes('index.asp') || p.url().includes('admin')) {
    console.log('\n=== STEP 3: Try WLAN page ===');
    await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
    await new Promise(r => setTimeout(r,3000));
    console.log('WLAN URL:', p.url());
    const wlContent = await p.content();
    console.log('WLAN length:', wlContent.length);
    // Check if we're still on the login page
    if (wlContent.includes('txt_Username')) {
      console.log('WLAN page: Redirected to login');
    } else {
      // Search for password in the page
      const pskMatch = wlContent.match(/wpaPskKey\s*=\s*new\s+Array\s*\([^;]+/);
      if (pskMatch) console.log('PSK key array:', pskMatch[0].substring(0, 500));
      const pwdMatch = wlContent.match(/password[^=]*=\s*['"]([^'"]+)['"]/gi);
      if (pwdMatch) console.log('Password matches:', pwdMatch.slice(0, 10));
    }
  }

  // Step 4: Try config download
  console.log('\n=== STEP 4: Config download ===');
  for (const url of ['/backupcfg.cgi', '/dumpcfg.cgi', '/html/ssmp/cfgfile/cfgfile.asp', '/html/ssmp/cfgfile/hw_ctree.xml']) {
    await p.goto('https://192.168.1.1' + url, {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
    await new Promise(r => setTimeout(r,1000));
    const content = await p.content();
    const isConfig = !content.includes('<!DOCTYPE') && content.length > 100;
    console.log(url, '->', p.url().substring(0, 80), '| length:', content.length, '| isConfig:', isConfig);
    if (isConfig) {
      console.log('CONFIG CONTENT (first 2000):', content.substring(0, 2000));
    }
  }

  // Step 5: Try wlsettings
  console.log('\n=== STEP 5: wlsettings ===');
  for (const url of ['/wlsettings/wlbasic.asp', '/wlsecurity/wlsecurity.asp']) {
    await p.goto('https://192.168.1.1' + url, {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
    await new Promise(r => setTimeout(r,1000));
    const content = await p.content();
    console.log(url, '->', p.url().substring(0, 80), '| length:', content.length);
    if (content.includes('wpaPskKey')) {
      const pskMatch = content.match(/wpaPskKey[^;]+/);
      if (pskMatch) console.log('PSK:', pskMatch[0].substring(0, 300));
    }
  }

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
