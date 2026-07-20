const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  let sessionCookie = null;
  p.on('response', async res => {
    if (res.url().includes('login.cgi')) {
      const sc = res.headers()['set-cookie'];
      if (sc) { const m = sc.match(/Cookie=([^;]+)/); if (m) sessionCookie = m[1]; }
    }
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (url.includes('backupcfg.cgi') || url.includes('dumpcfg.cgi') || ct.includes('octet-stream')) {
      const buffer = await res.buffer().catch(() => null);
      if (buffer && buffer.length > 0) {
        console.log('DOWNLOADED:', url, buffer.length, 'bytes');
        fs.writeFileSync('downloaded_config.bin', buffer);
        console.log('Saved to downloaded_config.bin');
      }
    }
  });

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:30000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  await p.type('input#txt_Username','adminpldt',{delay:15});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,3000));

  if (sessionCookie) {
    await p.setCookie({ name: 'Cookie', value: sessionCookie, domain: '192.168.1.1', path: '/', httpOnly: true, secure: true });
  }

  // Try 1: Navigate to Configuration File page
  console.log('--- Trying cfgfile.asp ---');
  await p.goto('https://192.168.1.1/html/ssmp/cfgfile/cfgfile.asp', {waitUntil:'networkidle0', timeout:15000});
  await new Promise(r => setTimeout(r,3000));
  
  const cfgHtml = await p.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, button, a'));
    return inputs.map(el => ({
      tag: el.tagName,
      id: el.id,
      name: el.name,
      type: el.type,
      value: el.value,
      href: el.href,
      onclick: el.getAttribute('onclick')?.substring(0,200)
    }));
  });
  console.log('cfgfile.asp inputs:');
  cfgHtml.forEach(inp => console.log(JSON.stringify(inp)));

  // Check for any download buttons
  await p.evaluate(() => {
    // Look for backup/download/export buttons and click them
    const all = document.querySelectorAll('*');
    all.forEach(el => {
      const text = el.innerText?.toLowerCase() || '';
      const onclick = el.getAttribute('onclick') || '';
      const id = el.id?.toLowerCase() || '';
      const href = el.href?.toLowerCase() || '';
      if (text.includes('backup') || text.includes('export') || text.includes('download') || text.includes('save') ||
          id.includes('backup') || id.includes('export') || id.includes('download') ||
          onclick.includes('backup') || onclick.includes('export') || onclick.includes('download') ||
          href.includes('backupcfg') || href.includes('dumpcfg')) {
        console.log('FOUND:', { tag: el.tagName, id: el.id, text: el.innerText?.substring(0,100), onclick: onclick?.substring(0,200) });
      }
    });
  });

  // Try 2: Direct GET to backupcfg.cgi with cookie
  console.log('\n--- Trying backupcfg.cgi GET ---');
  try {
    await p.goto('https://192.168.1.1/backupcfg.cgi', {waitUntil:'networkidle0', timeout:15000});
    await new Promise(r => setTimeout(r,3000));
    const body = await p.evaluate(() => document.body.innerText?.substring(0,500));
    console.log('Response:', body);
  } catch(e) { console.log('Error:', e.message); }

  // Try 3: dumpcfg.cgi
  console.log('\n--- Trying dumpcfg.cgi GET ---');
  try {
    await p.goto('https://192.168.1.1/dumpcfg.cgi', {waitUntil:'networkidle0', timeout:15000});
    await new Promise(r => setTimeout(r,3000));
    const body = await p.evaluate(() => document.body.innerText?.substring(0,500));
    console.log('Response:', body);
  } catch(e) { console.log('Error:', e.message); }

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
