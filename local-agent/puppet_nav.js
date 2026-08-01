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

  // Login
  await page.goto(`${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);
  const hasLogin = await page.evaluate(() => !!document.querySelector('input#txt_Username'));
  if (hasLogin) {
    await page.type('input#txt_Username', USER, { delay: 3 });
    await page.evaluate(() => { const p = document.querySelector('input#txt_Password'); if (p) p.type = 'text'; });
    await page.type('input#txt_Password', PASS, { delay: 3 });
    await page.click('button#button');
    await sleep(3000);
  }
  console.log(`URL: ${page.url()}`);

  // Navigate to dumpcfg directly (GET, should include auth)
  console.log('\n[4] Fetching dumpcfg via navigation...');
  try {
    await page.goto(`${ROUTER}/dumpcfg`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 10000 });
    await sleep(1000);
    const content = await page.evaluate(() => document.body?.innerText || document.documentElement?.outerHTML || '');
    if (content.length > 200) {
      console.log(`dumpcfg: ${content.length} chars`);
      fs.writeFileSync('dumpcfg_puppet.xml', content);
      console.log(`Starts with: ${content.substring(0, 300)}`);
    } else {
      console.log(`dumpcfg body: ${content.substring(0, 200)}`);
    }
  } catch(e) {
    console.log(`dumpcfg error: ${e.message}`);
  }

  // Try navigating to the config page 
  console.log('\n[5] Trying config upload page...');
  const tryUrls = [
    '/html/ssmp/cfgfile/cfgfile.asp',
    '/html/ssmp/security/security.asp',
    '/html/ssmp/security/urlfilter.asp',
  ];
  for (const url of tryUrls) {
    try {
      await page.goto(`${ROUTER}${url}`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true, timeout: 8000 });
      await sleep(500);
      const html = await page.evaluate(() => document.documentElement?.outerHTML?.substring(0, 500) || 'no html');
      console.log(`\n${url}:`);
      console.log(html.substring(0, 300));
    } catch(e) {
      console.log(`\n${url}: ERROR ${e.message}`);
    }
  }

  await browser.close();
}
main().catch(err => { console.error('Error:', err.message); process.exit(1); });
