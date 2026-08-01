#!/usr/bin/env node
// Block lpb.lpbpisowifi.com via Huawei router config manipulation
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

const ROUTER = '192.168.1.1';
const USER = 'admin';
const PASS = 'Admin12345678';
const BLOCK_DOMAIN = 'lpb.lpbpisowifi.com';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpRequest(path, method = 'GET', body = null, cookie = '') {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: ROUTER, port: 443, path, method,
      rejectUnauthorized: false,
      headers: { 'User-Agent': 'Mozilla/5.0' }
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
        let setCookie = null;
        if (res.headers['set-cookie']) {
          setCookie = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        }
        resolve({ status: res.statusCode, data, cookie: setCookie });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function getToken() {
  const r = await httpRequest('/html/ssmp/common/getRandString.asp');
  return r.data.trim();
}

async function main() {
  // Get fresh token
  const token = await getToken();
  console.log(`Token: ${token}`);

  // Login
  const loginBody = `UserName=${USER}&PassWord=${PASS}&x.X_HW_Token=${token}`;
  const r = await httpRequest('/login.cgi', 'POST', loginBody);
  console.log(`Login status: ${r.status}, cookie: ${r.cookie ? 'got it' : 'none'}`);
  let cookie = r.cookie || '';

  // Access admin.html to confirm auth and get new token
  const r2 = await httpRequest('/admin.html', 'GET', null, cookie);
  cookie = r2.cookie || cookie; // update cookie
  const authHtml = r2.data;
  console.log(`Admin page size: ${authHtml.length}`);

  // Check if we're authenticated by looking for the login form
  const isAuthed = !authHtml.includes('txt_Username');
  console.log(`Authenticated: ${isAuthed}`);

  // Get a fresh token for subsequent requests
  const token2 = r2.data.match(/getAuthToken/)? await getToken() : token;
  console.log(`Token2: ${token2}`);

  // Try to access config download CGI
  console.log('\n--- Attempting config download ---');
  const dlBody = `x.X_HW_Token=${encodeURIComponent(token2)}`;
  const dl = await httpRequest('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', 'POST', dlBody, cookie);
  console.log(`Download status: ${dl.status}, size: ${dl.data.length}`);
  if (dl.data.length > 1000 && !dl.data.includes('error')) {
    fs.writeFileSync('downloaded_config.xml', dl.data);
    console.log('Config saved!');
    // Search for URL filter related content
    console.log(`Config starts with: ${dl.data.substring(0, 200)}`);
  } else {
    console.log(`Response: ${dl.data.substring(0, 500)}`);
  }

  // Alternative: Try a different config download approach
  console.log('\n--- Trying alternative config download ---');
  const dl2 = await httpRequest('/html/ssmp/cfgfile/backupSettings.conf?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', 'GET', null, cookie);
  console.log(`Status: ${dl2.status}, size: ${dl2.data.length}`);
  if (dl2.data.length > 100) console.log(`Body: ${dl2.data.substring(0, 300)}`);

  // Try dumpcfg
  console.log('\n--- Trying dumpcfg ---');
  const dl3 = await httpRequest('/dumpcfg', 'GET', null, cookie);
  console.log(`Status: ${dl3.status}, size: ${dl3.data.length}`);
  if (dl3.data.length > 100) {
    fs.writeFileSync('dumpcfg.xml', dl3.data);
    console.log(`First 200: ${dl3.data.substring(0, 200)}`);
  }

  // Check if there are any URL filter or security CGIs
  console.log('\n--- Checking security/filter pages ---');
  for (const p of ['/html/ssmp/security/urlfilter.asp', '/html/ssmp/firewall/ipfilter.asp', '/html/ssmp/security/security.asp']) {
    const r = await httpRequest(p, 'GET', null, cookie);
    console.log(`${p}: status=${r.status}, size=${r.data.length}, hasLogin=${r.data.includes('txt_Username')}`);
    if (r.data.length > 100 && !r.data.includes('txt_Username')) {
      console.log(`  Preview: ${r.data.substring(0, 300)}`);
    }
  }
}
main().catch(err => console.error('Error:', err.message));
