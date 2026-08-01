#!/usr/bin/env node
// Direct HTTP approach to Huawei router admin - no Puppeteer needed
const https = require('https');
const ROUTER = '192.168.1.1';

function httpsGet(path, cookie, postData) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: ROUTER, port: 443, path, method: postData ? 'POST' : 'GET',
      rejectUnauthorized: false, headers: { 'User-Agent': 'Mozilla/5.0' }
    };
    if (cookie) opts.headers.Cookie = cookie;
    if (postData) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = https.request(opts, (res) => {
      let data = '';
      // Don't wait for body if we just need headers
      res.on('data', chunk => { data += chunk; if (data.length > 200000) req.destroy(); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: data.substring(0, 50000), cookie: res.headers['set-cookie'] }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  // Step 1: Get login page to extract CSRF token
  console.log('[1] Getting admin.html for CSRF token...');
  const r1 = await httpsGet('/admin.html');
  console.log(`Status: ${r1.status}, Body length: ${r1.data.length}`);

  // Extract token from page
  const tokenMatch = r1.data.match(/getAuthToken\s*\(\s*\)\s*/);
  const xhwToken = r1.data.match(/x\.X_HW_Token\s*=\s*["']([^"']+)["']/);
  const tokenVar = r1.data.match(/var\s+(\w+)\s*=\s*["']([^"']+)["']/);
  console.log(`Token match: ${tokenMatch ? 'yes' : 'no'}, HWToken: ${xhwToken ? xhwToken[1] : 'no'}`);

  // Try to extract the JS that defines getAuthToken
  const scripts = [...r1.data.matchAll(/<script[^>]*src=["']([^"']+)["']/g)];
  console.log(`Scripts found: ${scripts.length}`);
  for (const s of scripts) {
    console.log(`  Script: ${s[1]}`);
    const r = await httpsGet(s[1]);
    if (r.data.includes('getAuthToken') || r.data.includes('X_HW_Token')) {
      const lines = r.data.split('\n').filter(l => l.includes('getAuthToken') || l.includes('X_HW_Token') || l.includes('X_HW_Token'));
      console.log(`    Found relevant content:`);
      lines.forEach(l => console.log(`    ${l.substring(0,200)}`));
    }
    // Also look for webSubmitForm
    if (r.data.includes('webSubmitForm')) {
      const lines = r.data.split('\n').filter(l => l.includes('webSubmitForm'));
      console.log(`    webSubmitForm found: ${lines.length > 0}`);
    }
    // Check if this script has the token
    const tok2 = r.data.match(/["']x\.X_HW_Token["'][\s,]*["']([^"']+)["']/);
    if (tok2) console.log(`    Token in script: ${tok2[1]}`);
  }

  // Step 2: Try to login with known password and get cookie
  console.log('\n[2] Logging in...');
  // Forward cookies from first request
  let cookie = '';
  if (r1.headers['set-cookie']) {
    cookie = r1.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    console.log(`Initial cookie: ${cookie}`);
  }
  
  // Try login with sample token
  const sampleToken = '36bf08032c2a6d7b3c33d208be742ac5754720a2c69d21be';
  const loginData = `UserName=admin&PassWord=Admin12345678&x.X_HW_Token=${sampleToken}`;
  const r2 = await httpsGet('/login.cgi', cookie, loginData);
  console.log(`Login status: ${r2.status}`);
  console.log(`Login response: ${r2.data.substring(0, 300)}`);
  if (r2.headers['set-cookie']) {
    cookie = r2.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    console.log(`Updated cookie: ${cookie}`);
  } else {
    console.log('No new cookie, trying with existing one');
  }

  // Step 3: Access admin.html with cookie
  console.log('\n[3] Accessing admin.html with auth...');
  const r3 = await httpsGet('/admin.html', cookie);
  console.log(`Status: ${r3.status}, Length: ${r3.data.length}`);
  // Save the HTML
  require('fs').writeFileSync('admin_auth.html', r3.data);
  console.log('Saved admin_auth.html');

  // Look for key elements
  const hasLoginForm = r3.data.includes('txt_Username');
  const hasIframes = r3.data.includes('<iframe');
  const frames = [...r3.data.matchAll(/<iframe[^>]*src=["']([^"']+)["']/g)];
  console.log(`Has login form: ${hasLoginForm}, Has iframes: ${hasIframes}`);
  frames.forEach(f => console.log(`  Frame src: ${f[1]}`));

  // Check for menu/tab structure
  const menuLinks = [...r3.data.matchAll(/href=["']([^"']+\.html?)["']/g)];
  const uniqueLinks = [...new Set(menuLinks.map(m => m[1]))];
  console.log(`Unique HTML links: ${uniqueLinks.length}`);
  uniqueLinks.forEach(l => console.log(`  ${l}`));

}
main().catch(err => { console.error('[-] Error:', err.message); });
