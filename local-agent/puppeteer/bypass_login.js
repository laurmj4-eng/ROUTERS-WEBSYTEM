const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:true, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors']});
  const [p] = await b.pages();

  // Navigate to login page
  console.log('Navigating to login...');
  await p.goto('https://192.168.1.1/', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));

  // Set preflag=0 to bypass PLDT overlay and use standard login
  console.log('Bypassing overlay...');
  await p.evaluate(() => {
    window.preflag = 0;
    window.setDisable = () => {};
    window.DisplayWifiPldt = () => { console.log('DisplayWifiPldt blocked'); };
  });

  // Type credentials
  await p.type('input#txt_Username', 'adminpldt', {delay:10});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:10});

  // Get cookies before login
  const cookiesBefore = await p.cookies();
  console.log('Cookies before:', JSON.stringify(cookiesBefore));

  // Click login
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  // Check cookies after login
  const cookiesAfter = await p.cookies();
  console.log('Cookies after:', JSON.stringify(cookiesAfter));

  // Now try to access various config endpoints
  const endpoints = [
    '/cgi-bin/backupcfg.cgi',
    '/dumpcfg.cgi',
    '/backupcfg.cgi',
    '/cgi-bin/dumpcfg.cgi',
    '/cgi-bin/config.cgi',
    '/cgi-bin/download.cgi?file=config',
    '/backupsettings.conf',
    '/cfgfile.xml',
    '/config.xml',
    '/api/admin/config',
  ];

  for (const ep of endpoints) {
    try {
      const resp = await p.goto(`https://192.168.1.1${ep}`, {waitUntil:'domcontentloaded', timeout:8000});
      const status = resp.status();
      const contentType = resp.headers()['content-type'] || '';
      const text = await p.evaluate(() => document.body.innerText.substring(0, 500));

      if (status !== 404 && status !== 403 && status !== 302) {
        console.log(`\n=== FOUND ${ep} (status ${status}, type ${contentType}) ===`);
        console.log('Response:', text.substring(0, 300));
        
        // Save full response
        const fullHtml = await p.evaluate(() => document.documentElement.outerHTML);
        require('fs').writeFileSync(`config_${ep.replace(/[\/\?&=]/g,'_')}.bin`, fullHtml);
        console.log(`Saved to config_${ep.replace(/[\/\?&=]/g,'_')}.bin`);
      }
    } catch(e) {
      console.log(`${ep}: ERR ${e.message.substring(0, 60)}`);
    }
  }

  await b.close();
  console.log('\nDone');
})().catch(e => { console.error(e); process.exit(1); });
