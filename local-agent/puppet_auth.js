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

  await page.setRequestInterception(true);
  let requests = [];
  page.on('request', req => {
    requests.push({ url: req.url().substring(0,120), method: req.method(), type: req.resourceType() });
    if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) req.abort();
    else req.continue();
  });
  page.on('requestfinished', req => {
    if (req.url().includes('login.cgi') || req.url().includes('getRandString')) {
      console.log(`  >> Response for ${req.url().substring(0,80)}: ${req.response()?.status()}`);
    }
  });

  // Navigate to admin page
  console.log('[1] Loading admin page...');
  await page.goto(`${ROUTER}/admin.html`, { waitUntil: 'domcontentloaded', ignoreHTTPSErrors: true });
  await sleep(2000);
  console.log(`URL: ${page.url()}`);

  // Check login form
  const hasLogin = await page.evaluate(() => !!document.querySelector('input#txt_Username'));
  console.log(`Has login form: ${hasLogin}`);

  if (hasLogin) {
    console.log('[2] Logging in...');
    await page.type('input#txt_Username', USER, { delay: 3 });
    
    // Get actual password field and enter password
    await page.evaluate(() => {
      const p = document.querySelector('input#txt_Password');
      if (p) p.type = 'text';
    });
    await page.type('input#txt_Password', PASS, { delay: 3 });
    
    // Listen for network requests after click
    console.log('[3] Clicking login...');
    await page.click('button#button');
    
    // Wait for navigation/redirect
    await sleep(3000);
    console.log(`URL after click: ${page.url()}`);

    // Wait a bit more and check again
    await sleep(2000);
    console.log(`URL after 2s more: ${page.url()}`);

    // Check cookies
    const cookies = await page.cookies();
    console.log(`\nCookies (${cookies.length}):`);
    cookies.forEach(c => console.log(`  ${c.name} = ${c.value.substring(0,40)}...`));
    
    // Try localStorage/sessionStorage
    const storageInfo = await page.evaluate(() => {
      return {
        sessionStorage: Object.keys(sessionStorage).join(', '),
        localStorage: Object.keys(localStorage).join(', '),
      };
    }).catch(() => ({ sessionStorage: 'error', localStorage: 'error' }));
    console.log(`SessionStorage keys: ${storageInfo.sessionStorage}`);
    console.log(`LocalStorage keys: ${storageInfo.localStorage}`);

    // Try to call config download CGI from within the page context
    console.log('\n[4] Testing authenticated endpoints via fetch...');
    const results = await page.evaluate(async () => {
      const endpoints = [
        '/html/ssmp/common/getRandString.asp',
        '/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp',
        '/dumpcfg',
        '/html/ssmp/security/security.asp',
        '/html/ssmp/security/urlfilter.asp',
      ];
      const out = [];
      for (const ep of endpoints) {
        try {
          const opts = { method: ep.includes('cfgfile') ? 'POST' : 'GET', credentials: 'include' };
          if (ep.includes('cfgfile')) {
            const t = await fetch('/html/ssmp/common/getRandString.asp');
            const token = await t.text();
            opts.body = 'x.X_HW_Token=' + encodeURIComponent(token.trim());
            opts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
          }
          const r = await fetch(ep, opts);
          const text = await r.text();
          out.push(`${ep}: HTTP ${r.status}, ${text.length} chars, cookie=${document.cookie?.substring(0,30)}`);
        } catch(e) {
          out.push(`${ep}: ERROR ${e.message}`);
        }
      }
      return out;
    });
    results.forEach(r => console.log(`  ${r}`));
  }

  await browser.close();
}
main().catch(err => { console.error('Error:', err.message); process.exit(1); });
