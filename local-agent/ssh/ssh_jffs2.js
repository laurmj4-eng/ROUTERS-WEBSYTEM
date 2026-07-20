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

      // Explore jffs2
      setTimeout(() => send('wap list path /mnt/jffs2'), 4000);
      setTimeout(() => send('wap list path /flash'), 6000);

      // Try display file with different paths
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree.xml'), 8000);
      setTimeout(() => send('display file hw_ctree.xml'), 10000);
      setTimeout(() => send('display file mnt/jffs2/hw_ctree.xml'), 12000);

      // Try reading via set command  
      setTimeout(() => send('display wlan config'), 14000);

      // Check for aescrypt2
      setTimeout(() => send('which aescrypt2'), 16000);
      setTimeout(() => send('aescrypt2'), 18000);

      setTimeout(() => send('quit'), 20000);
      setTimeout(() => stream.end(), 22000);
    });
  });

  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_jffs2_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
