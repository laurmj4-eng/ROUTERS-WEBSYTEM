#!/usr/bin/env node
const PUPPETEER = require('puppeteer');
const crypto = require('crypto');
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
  page.setDefaultTimeout(15000);

  // Abort unnecessary resources
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });

  // Login
  console.log('[1] Loading admin page...');
  await page.goto(`${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);

  const needsLogin = await page.evaluate(() => !!document.querySelector('input#txt_Username'));
  if (needsLogin) {
    console.log('[2] Logging in...');
    await page.type('input#txt_Username', USER, { delay: 5 });
    await page.evaluate(() => { const p = document.querySelector('input#txt_Password'); if (p) p.type = 'text'; });
    await page.type('input#txt_Password', PASS, { delay: 5 });
    await page.click('button#button');
    await sleep(3000);
  }
  console.log(`URL: ${page.url()}`);

  // Now use fetch via page.evaluate to download config
  console.log('[3] Downloading config via fetch...');
  const config = await page.evaluate(async () => {
    // Get fresh token
    const tokenResp = await fetch('/html/ssmp/common/getRandString.asp');
    const token = await tokenResp.text();
    
    // Download config
    const resp = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'x.X_HW_Token=' + encodeURIComponent(token.trim()),
      credentials: 'include'
    });
    if (resp.ok) return await resp.text();
    return 'ERROR: ' + resp.status + ' ' + (await resp.text()).substring(0,200);
  });
  
  if (config.startsWith('ERROR')) {
    console.log(`Config download failed: ${config}`);
    // Try dumpcfg instead
    console.log('Trying dumpcfg...');
    const dumpcfg = await page.evaluate(async () => {
      const r = await fetch('/dumpcfg');
      return await r.text();
    });
    fs.writeFileSync('dumpcfg_from_puppet.xml', dumpcfg);
    console.log(`dumpcfg saved (${dumpcfg.length} chars)`);
    console.log(`First 300: ${dumpcfg.substring(0, 300)}`);
  } else {
    fs.writeFileSync('config_from_router.xml', config);
    console.log(`Config saved (${config.length} chars)`);
    console.log(`First 300: ${config.substring(0, 300)}`);
  }

  // Check if logged in by examining cookies
  const cookies = await page.cookies();
  console.log(`\nCookies: ${cookies.map(c => c.name + '=' + c.value.substring(0,20)).join(', ')}`);

  // Try to list available security/filter pages
  console.log('\n[4] Exploring admin pages...');
  const pages = ['/html/ssmp/security/urlfilter.asp', '/html/ssmp/firewall/ipfilter.asp', '/html/ssmp/security/security.asp'];
  for (const p of pages) {
    try {
      const html = await page.evaluate(async (url) => {
        const r = await fetch(url);
        if (r.ok) return await r.text();
        return 'HTTP ' + r.status;
      }, p);
      console.log(`${p}: ${html.substring(0, 200).replace(/\n/g, ' ')}`);
    } catch(e) {
      console.log(`${p}: ERROR ${e.message}`);
    }
  }

  await browser.close();
}
main().catch(err => { console.error('Error:', err.message); process.exit(1); });
