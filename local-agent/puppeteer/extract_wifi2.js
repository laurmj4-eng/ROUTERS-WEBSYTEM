const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const b = await puppeteer.launch({headless:false, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors','--window-size=1280,720']});
  const [p] = await b.pages();

  // Login
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:20000});
  await p.evaluate(() => { window.setDisable = () => {}; });
  await p.type('input#txt_Username', 'adminpldt', {delay:20});
  await p.type('input#txt_Password', 'AC2DIU7QW3ERTY6UPAS4DFG', {delay:10});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));

  // Save session cookie
  const cookies = await p.cookies();
  console.log('Cookie:', cookies[0]?.name + '=' + cookies[0]?.value);

  // Access Device Access Control
  console.log('\nAccessing Device Access Control...');
  await p.goto('https://192.168.1.1/html/bbsp/acl/acl.asp', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,3000));
  console.log('ACL URL:', p.url());
  const aclContent = await p.content();
  console.log('ACL page length:', aclContent.length);
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\acl.html', aclContent);

  // Check for SSH/Telnet related content
  const telnetSSH = aclContent.match(/[Tt][Ee][Ll][Nn][Ee][Tt][^<]{0,200}|[Ss][Ss][Hh][^<]{0,200}|[Aa]ccess[^<]{0,200}|[Cc]ontrol[^<]{0,200}|[Ss]ervice[^<]{0,200}/g);
  if (telnetSSH) console.log('Matches:', telnetSSH.slice(0, 15));

  // Check all input fields
  const inputs = aclContent.match(/<input[^>]*name="[^"]*"[^>]*>/gi);
  if (inputs) console.log('Input fields:', inputs.slice(0, 20));

  // Check all select/option fields
  const selects = aclContent.match(/<select[^>]*>[\s\S]*?<\/select>/gi);
  if (selects) console.log('Select fields:', selects.slice(0, 5));

  // Try to navigate to TR-069 page
  console.log('\nAccessing TR-069...');
  await p.goto('https://192.168.1.1/html/ssmp/tr069/tr069.asp', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  const tr069Content = await p.content();
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\tr069.html', tr069Content);
  console.log('TR-069 length:', tr069Content.length);

  // Try accessing the 2.4G WLAN Basic page
  console.log('\nAccessing 2.4G WLAN Basic...');
  await p.goto('https://192.168.1.1/html/amp/wlanbasic/WlanBasic.asp?2G', {waitUntil:'networkidle0', ignoreHTTPSErrors:true, timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  const wlanContent = await p.content();
  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\wlan2g.html', wlanContent);
  console.log('WLAN 2.4G length:', wlanContent.length);

  const pskMatch = wlanContent.match(/wpaPskKey\s*=\s*new\s+Array\s*\([^;]+/);
  if (pskMatch) console.log('PSK array:', pskMatch[0].substring(0, 500));

  // Check for $2$ encrypted strings
  const encrypted = wlanContent.match(/\$2\$[^"']+/g);
  if (encrypted) console.log('Encrypted strings found:', encrypted.slice(0, 5));

  // Check for non-masked password
  const pwdVars = wlanContent.match(/PreSharedKey[^=]*=\s*["']([^"']+)["']/g);
  if (pwdVars) console.log('Pwd vars:', pwdVars.slice(0, 10));

  await new Promise(() => {});
})().catch(e => { console.error(e); process.exit(1); });
