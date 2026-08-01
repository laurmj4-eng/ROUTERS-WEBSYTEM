#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const fs = require('fs');
const ROUTER = '192.168.1.1';
const USER = 'admin';
const PASS = 'Admin12345678';
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await PUPPETEER.launch({
    headless: true, ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();

  // Abort images/fonts/other to speed up
  await page.setRequestInterception(true);
  page.on('request', req => {
    const type = req.resourceType();
    if (['image', 'font', 'media', 'stylesheet'].includes(type)) req.abort();
    else req.continue();
  });

  // Navigate and capture early
  await page.goto(`https://${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 15000 });
  await sleep(1500);

  // Check login form
  const hasLogin = await page.evaluate(() => !!document.querySelector('input#txt_Username'));
  console.log(`Has login form: ${hasLogin}, URL: ${page.url()}`);

  if (hasLogin) {
    await page.type('input#txt_Username', USER, { delay: 3 });
    await page.evaluate(() => { const p = document.querySelector('input#txt_Password'); if (p) p.type = 'text'; });
    await page.type('input#txt_Password', PASS, { delay: 3 });
    await page.click('button#button');
    await sleep(3000);
    console.log(`After login URL: ${page.url()}`);
  }

  // Capture HTML immediately - don't wait for full load
  const html = await page.evaluate(() => document.documentElement?.outerHTML || 'no html');
  fs.writeFileSync('admin_page.html', html);
  console.log(`admin.html saved (${html.length} chars)`);

  // Get key info
  const info = await page.evaluate(() => {
    const scripts = Array.from(document.scripts).map(s => s.src).filter(Boolean).slice(0, 15);
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => f.src).filter(Boolean).slice(0, 10);
    const bodyText = (document.body?.innerText || '').substring(0, 500);
    const frameCount = window.frames?.length || 0;
    // Try to find the topology/frame structure
    const topFrame = document.querySelector('[name="top"]')?.src || '';
    const menuFrame = document.querySelector('[name="menu"]')?.src || '';
    const contentFrame = document.querySelector('[name="content"]', '[name="main"]')?.src || '';
    return { scripts, iframes, bodyText, frameCount, topFrame, menuFrame, contentFrame };
  });
  console.log(`Frame count: ${info.frameCount}`);
  console.log(`topFrame: ${info.topFrame}`);
  console.log(`menuFrame: ${info.menuFrame}`);
  console.log(`contentFrame: ${info.contentFrame}`);
  console.log(`Scripts: ${JSON.stringify(info.scripts)}`);
  console.log(`Iframes: ${JSON.stringify(info.iframes)}`);
  console.log(`Body text: ${info.bodyText}`);

  await browser.close();
}
main().catch(err => { console.error('[-] Error:', err.message); process.exit(1); });
