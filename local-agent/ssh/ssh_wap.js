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

      // Test various WAP commands to find WiFi password
      setTimeout(() => send(''), 500);
      setTimeout(() => send('su'), 1500);
      setTimeout(() => send('shell'), 4000); // try crippled shell
      setTimeout(() => send('getcustominfo.sh'), 7000);
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree.xml'), 10000);
      setTimeout(() => send('display file /flash/hw_ctree.xml'), 14000);
      setTimeout(() => send('display file /etc/wlan/wlan_config.xml'), 18000);
      setTimeout(() => send('display wifi config'), 22000);
      setTimeout(() => send('display wlan info'), 25000);
      setTimeout(() => send('display wlan config'), 28000);

      // If display file shows config, try getting more
      setTimeout(() => {
        send('backup cfg by tftp svrip 192.168.1.100 remotefile hw_ctree.xml');
      }, 31000);

      setTimeout(() => send('exit'), 34000);
      setTimeout(() => stream.end(), 36000);
    });
  });

  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_wap_output.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
