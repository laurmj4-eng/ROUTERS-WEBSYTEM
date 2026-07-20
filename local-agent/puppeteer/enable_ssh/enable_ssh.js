const puppeteer = require('puppeteer');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:20000});
  await p.evaluate(() => { window.setDisable = () => {}; });
  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:10});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,8000));

  console.log('URL:', p.url());

  // Get index page and find menu links
  const menuLinks = await p.evaluate(() => {
    const links = [];
    document.querySelectorAll('a, area, [onclick]').forEach(el => {
      const href = el.href || el.getAttribute('onclick') || '';
      if (href.includes('ssmp') || href.includes('security') || href.includes('acl') || href.includes('device') || href.includes('telnet') || href.includes('ssh')) {
        links.push({tag: el.tagName, text: el.innerText?.substring(0, 50), href: href.substring(0, 200)});
      }
    });
    return links;
  });
  console.log('Security-related links:', JSON.stringify(menuLinks));

  // Try known security pages
  const securityUrls = [
    '/html/ssmp/security/security.asp',
    '/html/ssmp/acl/acl.asp',
    '/html/ssmp/devicecontrol/devicecontrol.asp',
    '/html/ssmp/acl/aclservices.asp',
    '/html/ssmp/tr069/tr069.asp',
    '/html/amp/deviceaccess/DeviceAccess.asp',
    '/html/amp/acl/Acl.asp',
  ];

  for (const url of securityUrls) {
    await p.goto('https://192.168.1.1' + url, {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:10000});
    await new Promise(r => setTimeout(r,1000));
    const content = await p.content();
    const hasForm = content.includes('form') || content.includes('TELNET') || content.includes('SSH') || content.includes('acl');
    const length = content.length;
    const isLogin = content.includes('txt_Username');
    console.log(url, 'len:', length, 'hasForm:', hasForm, 'isLogin:', isLogin);
    if (!isLogin && length > 1000) {
      // Save for inspection
      const fs = require('fs');
      const safeName = url.replace(/[\/\.]/g, '_');
      fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\' + safeName + '.html', content);
      console.log('  -> Saved');
      // Show TELNET/SSH related content
      const telnetMatch = content.match(/[Tt][Ee][Ll][Nn][Ee][Tt][^<]{0,100}/g);
      const sshMatch = content.match(/[Ss][Ss][Hh][^<]{0,100}/g);
      if (telnetMatch) console.log('  TELNET:', telnetMatch.slice(0, 3));
      if (sshMatch) console.log('  SSH:', sshMatch.slice(0, 3));
    }
  }

  console.log('\n=== Trying to find left/right frame menu ===');
  await p.goto('https://192.168.1.1/frame.asp', {waitUntil:'domcontentloaded', ignoreHTTPSErrors:true, timeout:10000});
  await new Promise(r => setTimeout(r,1000));
  const frameContent = await p.content();
  console.log('frame.asp length:', frameContent.length);
  const fs = require('fs');
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\frame.html', frameContent);
  
  const linkMatches = frameContent.match(/href="[^"]*"/g);
  if (linkMatches) console.log('Frame links:', linkMatches.slice(0, 30));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
