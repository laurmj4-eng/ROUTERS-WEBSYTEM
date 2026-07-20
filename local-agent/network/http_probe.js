const https = require('https');
const http = require('http');
const fs = require('fs');
const { Client } = require('ssh2');

const ROUTER = '192.168.1.1';

// Disable certificate validation for testing
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Common config download endpoints
const ENDPOINTS = [
  // Direct backup endpoints
  { path: '/backupcfg.cgi', proto: 'https', method: 'GET' },
  { path: '/dumpcfg.cgi', proto: 'https', method: 'GET' },
  { path: '/backupsettings.conf', proto: 'https', method: 'GET' },
  { path: '/backupsettings.txt', proto: 'https', method: 'GET' },
  { path: '/cgi-bin/backupcfg.cgi', proto: 'https', method: 'GET' },
  { path: '/cgi-bin/dumpcfg.cgi', proto: 'https', method: 'GET' },
  // GetConfig ASP endpoints
  { path: '/asp/GetConfig.asp?para=WLANConfiguration', proto: 'https', method: 'GET' },
  { path: '/asp/GetConfig.asp?para=PreSharedKey', proto: 'https', method: 'GET' },
  { path: '/asp/GetConfig.asp?para=InternetGatewayDevice', proto: 'https', method: 'GET' },
  // Hidden config files
  { path: '/hw_ctree.xml', proto: 'https', method: 'GET' },
  { path: '/ctree.txt', proto: 'https', method: 'GET' },
  // PLDT overlay page
  { path: '/html/amp/wlanbasic/guidepldtwificfg.asp', proto: 'https', method: 'GET' },
  // frame.asp
  { path: '/frame.asp', proto: 'https', method: 'GET' },
  // Try wlanconfig
  { path: '/asp/wlanconfig.asp', proto: 'https', method: 'GET' },
  // Try with HTTP too
  { path: '/backupcfg.cgi', proto: 'http', method: 'GET' },
  { path: '/dumpcfg.cgi', proto: 'http', method: 'GET' },
  { path: '/backupsettings.conf', proto: 'http', method: 'GET' },
  { path: '/backupsettings.txt', proto: 'http', method: 'GET' },
  { path: '/hw_ctree.xml', proto: 'http', method: 'GET' },
];

async function tryEndpoint(endpoint) {
  return new Promise((resolve) => {
    const client = endpoint.proto === 'https' ? https : http;
    const req = client.get(`${endpoint.proto}://${ROUTER}${endpoint.path}`, { 
      rejectUnauthorized: false,
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString();
        // Limit to 1MB
        if (data.length > 1000000) { req.destroy(); }
      });
      res.on('end', () => {
        resolve({
          endpoint: endpoint.path,
          proto: endpoint.proto,
          status: res.statusCode,
          contentType: res.headers['content-type'] || '',
          contentLength: res.headers['content-length'] || data.length,
          preview: data.substring(0, 500).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''),
        });
      });
    });
    req.on('error', (e) => resolve({ endpoint: endpoint.path, proto: endpoint.proto, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ endpoint: endpoint.path, proto: endpoint.proto, error: 'timeout' }); });
  });
}

(async () => {
  console.log('=== Probing HTTP/S endpoints ===\n');
  
  const results = [];
  for (const ep of ENDPOINTS) {
    const r = await tryEndpoint(ep);
    if (r.status && r.status === 200) {
      console.log(`[200] ${ep.proto}://${ROUTER}${ep.path}`);
      console.log(`  Content-Type: ${r.contentType}`);
      console.log(`  Length: ${r.contentLength}`);
      console.log(`  Preview: ${r.preview.substring(0, 300)}`);
      results.push(r);
    } else if (r.status) {
      console.log(`[${r.status}] ${ep.proto}://${ROUTER}${ep.path}`);
    } else {
      console.log(`[ERR] ${ep.proto}://${ROUTER}${ep.path}: ${r.error}`);
    }
  }

  if (results.length > 0) {
    fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\http_probe_results.json', JSON.stringify(results, null, 2));
    console.log(`\n${results.length} successful responses saved.`);
  }

  console.log('\n=== Done ===');
})();
