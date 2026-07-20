const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors']});
  const [p] = await b.pages();

  await p.goto('https://192.168.1.1/', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,2000));

  // Let PLDT2 overlay appear naturally with preflag=1
  // Login naturally - DON'T override anything
  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  console.log('URL after login:', p.url());

  // Check state - overlay should be visible
  const state = await p.evaluate(() => ({
    overlayDisplay: document.getElementById('pwd_modify')?.style?.display,
    url: location.href,
    preflag: window.preflag,
    CfgMode: window.CfgMode,
  }));
  console.log('State:', JSON.stringify(state));

  // Now intercept ALL requests and responses
  const capturedData = [];
  await p.setRequestInterception(true);
  p.on('request', req => {
    if (req.url().includes('backupcfg') || req.url().includes('dumpcfg') || 
        req.url().includes('config') || req.url().includes('download') ||
        req.url().includes('cfgfile') || req.url().includes('.xml') ||
        req.url().includes('.bin') || req.url().includes('.conf')) {
      console.log('INTERCEPTED REQUEST:', req.url(), req.method());
    }
    req.continue();
  });

  p.on('response', async resp => {
    const url = resp.url();
    if (url.includes('backupcfg') || url.includes('dumpcfg') || 
        url.includes('config') || url.includes('download') ||
        url.includes('cfgfile') || url.includes('.xml') ||
        url.includes('.bin') || url.includes('.conf')) {
      try {
        const buffer = await resp.buffer();
        const text = buffer.toString('utf8').substring(0, 200);
        console.log(`\nRESPONSE ${resp.status()} ${url}: ${text}`);
      } catch(e) {}
    }
  });

  // Try to navigate to maintenance diagnosis page
  const maintenancePaths = [
    '/html/amp/diagnosis/diagnosis.asp',
    '/html/amp/maintenance/diagnosis.asp',
    '/html/amp/system/diagnosis.asp',
    '/diagnostics.asp',
    '/diagnostic.asp',
    '/html/amp/system/tools.asp',
    '/html/amp/maintenance/config.asp',
    '/Cusmenu/menu.html',
    '/menu.html',
    '/top.html',
    '/wlsettings/wlbasic.asp',
  ];

  for (const path of maintenancePaths) {
    try {
      console.log(`\nTrying: ${path}...`);
      const resp = await p.goto(`https://192.168.1.1${path}`, {waitUntil:'domcontentloaded', timeout:8000});
      const status = resp.status();
      const body = await p.evaluate(() => document.body.innerText.substring(0, 300));
      console.log(`  Status: ${status}, Body: ${body.substring(0, 100)}`);
      
      if (!body.includes('Waiting') && !body.includes('Login') && status === 200) {
        console.log(`  *** POTENTIAL: ${path}`);
        const fullHtml = await p.evaluate(() => document.documentElement.outerHTML);
        require('fs').writeFileSync(`page_${path.replace(/[\/\?&=]/g,'_')}.html`, fullHtml);
      }
    } catch(e) {
      console.log(`  Error: ${e.message.substring(0, 60)}`);
    }
  }

  // Keep browser open
  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
