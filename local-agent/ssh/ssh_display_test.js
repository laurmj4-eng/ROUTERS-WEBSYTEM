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
      if (err) { console.error('Shell error:', err); resolve('SHELL_ERR:' + err.message); return; }

      stream.on('data', (data) => {
        process.stdout.write(data.toString());
        fullOutput += data.toString();
      });

      stream.on('close', () => resolve(fullOutput));

      const send = (cmd) => stream.write(cmd + '\r\n');

      setTimeout(() => send(''), 500);
      setTimeout(() => send('su'), 1500);

      // Try small text files first
      setTimeout(() => send('display file /mnt/jffs2/customize.txt'), 4000);
      setTimeout(() => send('display file /mnt/jffs2/hard_version'), 6000);
      setTimeout(() => send('display file /mnt/jffs2/board_type'), 8000);
      setTimeout(() => send('display file /mnt/jffs2/main_version'), 10000);
      setTimeout(() => send('display file /mnt/jffs2/lastword'), 12000);
      
      // Try with different path format (no leading /)
      setTimeout(() => send('display file mnt/jffs2/hw_ctree.xml'), 14000);
      // Try from /
      setTimeout(() => send('display file flash:/mnt/jffs2/hw_ctree.xml'), 16000);
      // Try with quotes
      setTimeout(() => send('display file "/mnt/jffs2/hw_ctree.xml"'), 18000);

      setTimeout(() => send('quit'), 20000);
      setTimeout(() => stream.end(), 22000);
    });
  });

  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_display_test_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
