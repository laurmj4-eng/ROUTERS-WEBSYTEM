#!/usr/bin/env node
// Download config and upload with URL filter via direct HTTP
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const ROUTER = '192.168.1.1';
const USER = 'admin';
const PASS = 'Admin12345678';
const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';

function request(path, method = 'GET', body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: ROUTER, port: 443, path, method,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    };
    if (cookie) opts.headers['Cookie'] = cookie;
    if (body) {
      opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        resolve({ status: res.statusCode, headers: res.headers, data, setCookie });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: Get login page to extract CSRF token
  console.log('[1] Getting admin page for CSRF token...');
  const r1 = await request('/admin.html');
  const html = r1.data;
  
  // Find token in inline script
  const tokenMatch = html.match(/getAuthToken\s*\(\s*\)\s*\{\s*return\s*['"]([^'"]+)/);
  const tokenMatch2 = html.match(/x\.X_HW_Token\s*=\s*['"]([^'"]+)/);
  const tokenMatch3 = html.match(/X_HW_Token\s*=\s*['"]([^'"]+)/);
  let token = tokenMatch?.[1] || tokenMatch2?.[1] || tokenMatch3?.[1];
  
  // Also search scripts
  if (!token) {
    const scripts = [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/g)];
    for (const s of scripts) {
      try {
        const rs = await request(s[1].startsWith('/') ? s[1] : '/' + s[1].replace('../', ''));
        if (rs.data.includes('getAuthToken')) {
          const t = rs.data.match(/['"]x\.X_HW_Token['"][\s,]*['"]([^'"]+)['"]/);
          if (t) { token = t[1]; break; }
        }
      } catch(e) {}
    }
  }
  
  console.log(`Token: ${token || 'NOT FOUND'}`);
  if (!token) { console.log('Cannot proceed without token'); process.exit(1); }

  // Step 2: Login
  console.log('[2] Logging in...');
  const loginBody = `UserName=${USER}&PassWord=${PASS}&x.X_HW_Token=${token}`;
  const r2 = await request('/login.cgi', 'POST', loginBody);
  console.log(`Login status: ${r2.status}`);
  
  let cookie = '';
  if (r2.setCookie) {
    cookie = r2.setCookie.map(c => c.split(';')[0]).join('; ');
    console.log(`Cookie: ${cookie.substring(0, 100)}`);
  } else {
    // Try to get cookie from redirect response
    // The login redirects to admin.html with cookies already set
    console.log('No new cookie, checking response...');
    console.log(`Response body: ${r2.data.substring(0, 200)}`);
  }

  // Step 3: Access admin.html to get authenticated token
  console.log('\n[3] Getting authenticated token...');
  const r3 = await request('/admin.html', 'GET', null, cookie);
  const authHtml = r3.data;
  
  // Extract new token (might be different after auth)
  const authToken = authHtml.match(/x\.X_HW_Token\s*=\s*['"]([^'"]+)/)?.[1] || 
                    authHtml.match(/X_HW_Token\s*=\s*['"]([^'"]+)/)?.[1] || token;
  console.log(`Auth token: ${authToken}`);
  
  // Update cookie if set
  if (r3.setCookie) {
    cookie = r3.setCookie.map(c => c.split(';')[0]).join('; ');
  }
  console.log(`Cookie: ${cookie.substring(0, 100)}`);

  // Step 4: Try config download
  console.log('\n[4] Downloading config...');
  const dlBody = `x.X_HW_Token=${encodeURIComponent(authToken)}`;
  const r4 = await request('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', 'POST', dlBody, cookie);
  console.log(`Config download status: ${r4.status}, size: ${r4.data.length}`);
  if (r4.data.length > 1000) {
    fs.writeFileSync('downloaded_config.xml', r4.data);
    console.log('Saved to downloaded_config.xml');
    console.log(`First 500 chars: ${r4.data.substring(0, 500)}`);
  } else {
    console.log(`Response: ${r4.data.substring(0, 500)}`);
  }

  // Step 5: Try uploading a modified config
  // First check if there's a config upload page
  console.log('\n[5] Checking config upload page...');
  const r5 = await request('/html/ssmp/cfgfile/cfgfile.asp', 'GET', null, cookie);
  console.log(`Config page status: ${r5.status}, size: ${r5.data.length}`);
  fs.writeFileSync('config_page.html', r5.data);
  console.log(`Response: ${r5.data.substring(0, 500)}`);
}
main().catch(err => console.error('Error:', err.message));
