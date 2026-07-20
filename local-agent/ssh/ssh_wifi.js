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
        stream.write(cmd + '\r\n');
      };

      setTimeout(() => send(''), 500);
      setTimeout(() => send('su'), 1500);

      // WiFi-specific WAP commands
      setTimeout(() => send('display wifi information'), 4000);
      setTimeout(() => send('display wifi ap'), 6000);
      setTimeout(() => send('display wifi associate'), 8000);
      setTimeout(() => send('display wlan config'), 10000);
      setTimeout(() => send('get wlan basic'), 12000);
      setTimeout(() => send('get wlan advance'), 14000);
      setTimeout(() => send('get wlan associated'), 16000);
      setTimeout(() => send('get wifi para'), 18000);
      setTimeout(() => send('display connection all'), 20000);
      setTimeout(() => send('display wlanmac'), 22000);

      // Try reading config with display file
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree.xml'), 24000);
      setTimeout(() => send('display file /flash/hw_ctree.xml'), 26000);

      // Try wap list to explore filesystem
      setTimeout(() => send('wap list path /'), 28000);
      setTimeout(() => send('wap list path /mnt/jffs2'), 30000);

      setTimeout(() => send('exit'), 32000);
      setTimeout(() => stream.end(), 34000);
    });
  });

  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_wifi_output.txt', fullOutput);
  console.log('\n=== COMPLETE ===');

  // Search for password patterns
  const lines = fullOutput.split('\n');
  for (const line of lines) {
    if (line.toLowerCase().includes('key') || line.toLowerCase().includes('pass') || 
        line.toLowerCase().includes('psk') || line.toLowerCase().includes('ssid')) {
      console.log('>', line.trim());
    }
  }

  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
