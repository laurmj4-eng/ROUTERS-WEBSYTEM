#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const fs = require('fs');
const ROUTER = 'https://192.168.1.1';
const USER = 'admin';
const PASS = 'Admin12345678';
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function main() {
  const browser = await PUPPETEER.launch({
    headless: true, ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);

  // Capture ALL responses
  const responses = [];
  page.on('response', resp => {
    const url = resp.url().substring(0, 120);
    if (url.includes('/login.cgi') || url.includes('/admin.html') || url.includes('/dumpcfg') || url.includes('getRandString')) {
      const headers = resp.headers();
      responses.push({ url, status: resp.status(), setCookie: headers['set-cookie'] || 'none', contentType: headers['content-type'] || '' });
    }
  });

  // Login  
  await page.goto(`${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);
  await page.type('input#txt_Username', USER, { delay: 3 });
  await page.evaluate(() => { const p = document.querySelector('input#txt_Password'); if (p) p.type = 'text'; });
  await page.type('input#txt_Password', PASS, { delay: 3 });
  await page.click('button#button');
  await sleep(3000);
  console.log(`Current URL: ${page.url()}`);

  // Check login state
  const loggedIn = await page.evaluate(() => {
    return { hasLoginForm: !!document.querySelector('input#txt_Username'), htmlSize: document.body?.innerHTML?.length || 0, title: document.title };
  });
  console.log(`Has login form: ${loggedIn.hasLoginForm}, size: ${loggedIn.htmlSize}, title: "${loggedIn.title}"`);

  // Print captured responses
  console.log('\nCaptured responses:');
  responses.forEach(r => console.log(`  ${r.url}: ${r.status}, set-cookie: ${r.setCookie?.substring(0,100)}`));

  // Navigate to dumpcfg and capture response
  console.log('\nNavigating to dumpcfg...');
  const dumpResp = await page.goto(`${ROUTER}/dumpcfg`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(1000);
  const dumpHeaders = dumpResp.headers();
  console.log(`dumpcfg status: ${dumpResp.status()}`);
  console.log(`dumpcfg set-cookie: ${(dumpHeaders['set-cookie'] || 'none').substring(0, 100)}`);
  const dumpHtml = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '');
  console.log(`dumpcfg body: ${dumpHtml}`);

  // Now try with fetch with credentials
  console.log('\nTrying fetch with credentials from current page...');
  const fetchResult = await page.evaluate(async () => {
    try {
      const r = await fetch('/dumpcfg', { credentials: 'include', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
      const text = await r.text();
      return { status: r.status, size: text.length, preview: text.substring(0, 200) };
    } catch(e) { return { error: e.message }; }
  });
  console.log(`fetch result: ${JSON.stringify(fetchResult)}`);

  await browser.close();
}
main().catch(err => { console.error('Error:', err.message); process.exit(1); });
