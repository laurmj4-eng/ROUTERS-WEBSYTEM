const { Client } = require('ssh2');
const fs = require('fs');

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 10000 });
  });

  let fullOutput = '';
  const result = await new Promise((resolve) => {
    conn.shell({ term: 'vt100', rows: 100, cols: 200 }, (err, stream) => {
      if (err) { resolve('SHELL_ERR:' + err.message); return; }
      stream.on('data', d => { process.stdout.write(d.toString()); fullOutput += d.toString(); });
      stream.on('close', () => resolve(fullOutput));
      const send = (cmd) => stream.write(cmd + '\r\n');
      setTimeout(() => send(''), 500);
      setTimeout(() => send('su'), 1500);

      // Try get wlan with various params
      setTimeout(() => send('get wlan basic all'), 4000);
      setTimeout(() => send('get wlan enable 2.4G'), 6000);
      setTimeout(() => send('get wlan advance'), 8000);
      setTimeout(() => send('get wlan associated'), 10000);

      // Check if there's a way to get PSK
      setTimeout(() => send('get wlan para'), 12000);
      setTimeout(() => send('display wifi ap'), 14000);
      setTimeout(() => send('display wifi pa type'), 16000);

      // Try restore backup with index  
      setTimeout(() => send('restore backup file 1'), 18000);
      setTimeout(() => send('display current-configuration | include PreSharedKey'), 20000);
      setTimeout(() => send('display current-configuration | include KeyPassphrase'), 22000);

      setTimeout(() => send('quit'), 24000);
      setTimeout(() => stream.end(), 26000);
    });
  });

  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_wlan_get_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
