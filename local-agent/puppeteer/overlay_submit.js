const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Intercept ALL network requests
  p.on('request', req => {
    if (req.method() !== 'OPTIONS') {
      console.log('>>> REQUEST:', req.method(), req.url());
    }
  });

  p.on('response', res => {
    if (res.status() !== 200 || res.url().includes('resource/')) {
      console.log('<<< RESPONSE:', res.status(), res.url());
    }
  });

  // Navigate
  console.log('Navigating to admin.html...');
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:20000});
  await new Promise(r => setTimeout(r,2000));

  // Override setDisable to allow interaction
  await p.evaluate(() => {
    window.setDisable = () => {};
  });

  // Type credentials
  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:10});

  // Click login button
  console.log('Clicking login...');
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  // Check overlay state
  const state = await p.evaluate(() => ({
    overlayVisible: document.getElementById('pwd_modify')?.style.display === 'block',
    ssid1_name: document.getElementById('ssid1_name')?.value,
    ssid1_password: document.getElementById('ssid1_password')?.value,
  }));
  console.log('Overlay state:', JSON.stringify(state));

  // Fill in the overlay form
  console.log('Filling overlay form...');
  await p.evaluate(() => {
    document.getElementById('old_password').value = 'AC2DIU7QW3ERTY6UPAS4DFG';
    document.getElementById('new_password').value = 'PLDTpass123!';
    document.getElementById('confirm_password').value = 'PLDTpass123!';
    document.getElementById('ssid1_password').value = 'PLDTwifi123!';
    document.getElementById('ssid1_confirm_password').value = 'PLDTwifi123!';
  });

  // Click Update button
  console.log('Clicking Update...');
  await p.evaluate(() => {
    document.getElementById('button_update').click();
  });

  // Wait for navigation after form submit
  await new Promise(r => setTimeout(r,10000));

  console.log('Final URL:', p.url());
  console.log('Page content (first 500):', (await p.content()).substring(0, 500));

  // Now try accessing admin.html again to see if full panel appears
  console.log('\n--- Trying admin.html after password change ---');
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:20000});
  const html = await p.content();
  console.log('admin.html content (first 1000):', html.substring(0, 1000));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
