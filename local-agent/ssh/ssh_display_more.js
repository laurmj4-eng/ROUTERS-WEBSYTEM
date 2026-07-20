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

      // Test more files
      setTimeout(() => send('display file /mnt/jffs2/hw_boardinfo'), 4000);
      setTimeout(() => send('display file /mnt/jffs2/hw_boardinfo.bak'), 6000);
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree_bak.xml'), 8000);
      setTimeout(() => send('display file /mnt/jffs2/hw_default_ctree.xml'), 10000);
      setTimeout(() => send('display file /mnt/jffs2/hw_bootcfg.xml'), 12000);
      setTimeout(() => send('display file /mnt/jffs2/customize'), 14000);
      setTimeout(() => send('display file /mnt/jffs2/customizepara.txt'), 16000);
      setTimeout(() => send('display file /mnt/jffs2/dhcp6c'), 18000); // listed as dhcp6c in output

      setTimeout(() => send('quit'), 20000);
      setTimeout(() => stream.end(), 22000);
    });
  });

  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_display_more_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
