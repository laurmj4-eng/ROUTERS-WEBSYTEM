// Scan the admin page structure on this router firmware
const PUPPETEER = require('puppeteer');
const ROUTER = 'https://192.168.1.1';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const b = await PUPPETEER.launch({headless: false, ignoreHTTPSErrors: true, args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']});
  const p = await b.newPage();

  // Navigate to main admin page
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'networkidle0', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(3000);

  // Dump full page structure
  const structure = await p.evaluate(() => {
    const result = { url: window.location.href };

    // HTML structure
    result.doctype = document.doctype ? document.doctype.name : 'none';
    result.title = document.title;
    
    // Frames
    const frames = Array.from(document.querySelectorAll('frame, iframe')).map(f => ({
      name: f.name || f.id,
      src: f.src,
      tag: f.tagName
    }));
    result.frames = frames;

    // Scripts
    const scripts = Array.from(document.querySelectorAll('script')).map((s,i) => ({
      idx: i,
      src: s.src,
      inline: s.textContent ? s.textContent.substring(0, 100) : ''
    }));
    result.scripts = scripts;

    // Forms
    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      id: f.id, action: f.action, method: f.method
    }));
    result.forms = forms;
    
    // Links
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => !h.startsWith('javascript:'));
    result.links = links;

    return result;
  }).catch(e => ({error: e.message}));

  console.log('Page structure:');
  console.log(JSON.stringify(structure, null, 2));

  // If there are frames, dump each frame's content structure
  if (structure.frames && structure.frames.length > 0) {
    for (const frameInfo of structure.frames) {
      const frame = p.frames().find(f => f.name() === frameInfo.name || f.url().includes(frameInfo.src));
      if (!frame) continue;
      
      const fi = await frame.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        inputs: Array.from(document.querySelectorAll('input')).map(i => ({id: i.id, name: i.name, type: i.type})),
        links: Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => !h.startsWith('javascript:')),
        text: document.body ? document.body.innerText.substring(0, 500) : 'no body',
      })).catch(e => ({error: e.message}));
      console.log(`\nFrame "${frameInfo.name}" (${frameInfo.src}):`);
      console.log(JSON.stringify(fi, null, 2));
    }
  }

  // Also try logging in first then scanning
  console.log('\n\n=== Now trying login first, then scanning ===');
  
  // Go to login page
  await p.goto(ROUTER + '/html/login_pldt.html', {waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true});
  await sleep(2000);
  
  // Login as admin:1234
  await p.evaluate(() => {
    window.CheckPassword = () => 0;
    document.getElementById('user_name').value = 'admin';
    document.getElementById('loginpp').value = '1234';
  });
  await sleep(500);
  
  // Intercept navigation to capture redirect
  p.once('request', req => {
    if (req.url().includes('login.cgi')) console.log('login POST:', req.postData());
  });
  await p.evaluate(() => document.getElementById('login_btn').click());
  await sleep(3000);
  
  console.log('After login URL:', p.url());

  // Now navigate to admin.html
  await p.goto(ROUTER + '/admin.html', {waitUntil: 'networkidle0', ignoreHTTPSErrors: true, timeout: 15000}).catch(() => {});
  await sleep(5000);

  const postLoginStructure = await p.evaluate(() => {
    const result = { url: window.location.href };
    result.title = document.title;
    result.frames = Array.from(document.querySelectorAll('frame, iframe')).map(f => ({name: f.name || f.id, src: f.src}));
    const forms = Array.from(document.querySelectorAll('form')).map(f => ({id: f.id, action: f.action}));
    result.forms = forms;
    const links = Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => !h.startsWith('javascript:'));
    result.links = links;
    result.bodyText = document.body ? document.body.innerText.substring(0, 1000) : 'no body';
    return result;
  }).catch(e => ({error: e.message}));

  console.log('\nAdmin page after login:');
  console.log(JSON.stringify(postLoginStructure, null, 2));

  // Check for overlay/forced password
  if (postLoginStructure.bodyText && postLoginStructure.bodyText.includes('Account Management')) {
    console.log('\nDetected: Forced password change overlay is present');
  }

  // Scan further - check if iframe exists and dump its content
  if (postLoginStructure.frames) {
    for (const fi of postLoginStructure.frames) {
      const frame = p.frames().find(f => f.name() === fi.name || (fi.src && f.url().includes(fi.src)));
      if (!frame) {
        console.log(`Frame ${fi.name} not found in puppeteer frames`);
        continue;
      }
      const fc = await frame.evaluate(() => ({
        url: window.location.href,
        inputs: Array.from(document.querySelectorAll('input')).map(i => ({id: i.id, name: i.name, value: i.value, type: i.type})),
        links: Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => !h.startsWith('javascript:')),
        text: document.body ? document.body.innerText.substring(0, 500) : '',
      })).catch(e => ({error: e.message}));
      console.log(`\nFrame "${fi.name}" content:`);
      console.log(JSON.stringify(fc, null, 2));
    }
  }

  await sleep(3000);
  await b.close();
})();
