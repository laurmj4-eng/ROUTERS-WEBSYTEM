const { Client } = require('ssh2');

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 10000 });
  });

  console.log('Connected!\n');

  let fullOutput = '';

  const result = await new Promise((resolve) => {
    conn.shell({ term: 'vt100', rows: 100, cols: 200 }, (err, stream) => {
      if (err) { console.error('Shell error:', err); resolve('SHELL_ERR:' + err.message); return; }

      stream.on('data', (data) => {
        const text = data.toString('utf8', 0, data.length);
        process.stdout.write(text);
        fullOutput += text;
      });

      stream.on('close', () => resolve(fullOutput));

      const send = (cmd) => {
        console.log(`  [sending] ${cmd}`);
        stream.write(cmd + '\r\n');
      };

      // Stay at SU_WAP> level; don't enter shell
      setTimeout(() => send(''), 500);
      setTimeout(() => send('su'), 1500);
      
      // Commands at SU_WAP> level
      setTimeout(() => send('?'), 4000);
      setTimeout(() => send('help'), 6000);
      setTimeout(() => send('display version'), 8000);      // already know this works
      setTimeout(() => send('display deviceInfo'), 10000);   // already know this works
      setTimeout(() => send('display wlan config'), 12000);
      setTimeout(() => send('display wifi config'), 14000);
      setTimeout(() => send('display wlan info'), 16000);
      setTimeout(() => send('display optic info'), 18000);
      setTimeout(() => send('display current-configuration'), 20000);
      setTimeout(() => send('display running-config'), 22000);
      setTimeout(() => send('display config'), 24000);
      setTimeout(() => send('display wlan all'), 26000);
      
      // Try to read config file
      setTimeout(() => send('load hw_ctree.xml'), 28000);
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree.xml'), 30000);
      setTimeout(() => send('backup cfg by tftp svrip 192.168.1.100 remotefile hw_ctree.xml'), 32000);
      
      setTimeout(() => send('exit'), 35000);
      setTimeout(() => stream.end(), 37000);
    });
  });

  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_suwap_output.txt', fullOutput);
  console.log('\nFull output saved. Checking for WiFi password...');

  // Extract potential WiFi password
  const pskMatch = fullOutput.match(/PreSharedKey[^<]*/g);
  if (pskMatch) console.log('PreSharedKey found:', pskMatch);
  const ssidMatch = fullOutput.match(/SSID[^<]*/g);
  if (ssidMatch) console.log('SSID found:', ssidMatch);
  const passMatch = fullOutput.match(/password[^<]*/gi);
  if (passMatch) console.log('Password matches:', passMatch);

  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
