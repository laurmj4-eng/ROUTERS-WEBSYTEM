const { Client } = require('ssh2');

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
      if (err) { console.error('Shell error:', err); resolve('SHELL_ERR:' + err.message); return; }

      stream.on('data', (data) => {
        process.stdout.write(data.toString());
        fullOutput += data.toString();
      });

      stream.on('close', () => resolve(fullOutput));

      const send = (cmd) => stream.write(cmd + '\r\n');

      setTimeout(() => send(''), 500);
      setTimeout(() => send('su'), 1500);

      // Explore wap list commands
      setTimeout(() => send('wap list ?'), 4000);
      setTimeout(() => send('wap list path /mnt'), 6000);
      setTimeout(() => send('wap list path /'), 8000);

      // Try various display file syntaxes
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree.xml'), 10000);
      setTimeout(() => send('display file hw_ctree.xml'), 12000);
      setTimeout(() => send('display file /etc/passwd'), 14000);
      setTimeout(() => send('display file /proc/cpuinfo'), 16000);

      // Some debug commands  
      setTimeout(() => send('display backup list'), 18000);
      setTimeout(() => send('display flashlock status'), 20000);
      setTimeout(() => send('display startup info'), 22000);
      setTimeout(() => send('display macaddress'), 24000);

      setTimeout(() => send('exit'), 26000);
      setTimeout(() => stream.end(), 28000);
    });
  });

  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_displayfile_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
