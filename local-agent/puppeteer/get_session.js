#!/usr/bin/env node
/**
 * Standalone: login to router, GET session cookie, DEMO cookie-only auth.
 *
 * Watch the browser as it:
 *   1. Loads admin.html — see the login form
 *   2. Makes password VISIBLE — you'll see the password being typed
 *   3. Logs in with adminpldt:AC2DIU7QW3ERTY6UPAS4DFG
 *   4. Extracts the session cookie
 *   5. DEMO: clears cookies, sets ONLY the session cookie,
 *      then opens an admin page WITHOUT re-logging in
 *
 * The browser is NON-headless — you see everything live.
 * Close the browser window to exit.
 */
const puppeteer = require('puppeteer');
const { loginAndGetSessionToken } = require('./router/automation');

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors',
      '--window-size=1280,720',
    ],
  });

  const [page] = await browser.pages();
  page.setDefaultTimeout(30000);

  try {
    const cookie = await loginAndGetSessionToken(page, 'adminpldt', 'AC2DIU7QW3ERTY6UPAS4DFG', {
      showPassword: true,
      demoReuse: true,
    });

    console.log(`\n=== FINAL RESULT ===`);
    console.log(`Session Cookie: ${cookie}\n`);
    console.log(`Browser is still open — look at the screen.`);
    console.log(`That admin page loaded with ONLY the session cookie.`);
    console.log(`No login form, no password prompt — just pure cookie auth.`);
    console.log(`\nClose the browser window or press Ctrl+C to exit.\n`);
  } catch (err) {
    console.error(`\n✖ FAILED: ${err.message}\n`);
  }

  // Keep browser open so user can see the result
  await new Promise(() => {});
})().catch(err => {
  console.error(err);
  process.exit(1);
});
