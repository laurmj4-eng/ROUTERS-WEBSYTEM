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

      // Try all display file syntax variants
      setTimeout(() => send('display file ?'), 4000);
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree.xml'), 6000);
      setTimeout(() => send('display file filename /mnt/jffs2/hw_ctree.xml'), 8000);
      setTimeout(() => send('display file name /mnt/jffs2/hw_ctree.xml'), 10000);
      setTimeout(() => send('display file path /mnt/jffs2/hw_ctree.xml'), 12000);
      setTimeout(() => send('display file url /mnt/jffs2/hw_ctree.xml'), 14000);
      setTimeout(() => send('display file source /mnt/jffs2/hw_ctree.xml'), 16000);
      setTimeout(() => send('display backup list'), 18000);
      setTimeout(() => send('display system info'), 20000);

      // Try from the shell too
      setTimeout(() => send('shell'), 22000);
      setTimeout(() => send('cat /mnt/jffs2/hw_ctree.xml'), 25000);
      setTimeout(() => send('busybox cat /mnt/jffs2/hw_ctree.xml 2>/dev/null; echo DONE'), 27000);
      setTimeout(() => send('getcustominfo.sh /mnt/jffs2/hw_ctree.xml'), 29000);
      setTimeout(() => send('exit'), 31000);

      // Back at SU_WAP, try wap commands
      setTimeout(() => send('display flashlock status'), 33000);
      setTimeout(() => send('display startup info'), 35000);
      setTimeout(() => send('display sysinfo'), 37000);

      setTimeout(() => send('exit'), 39000);
      setTimeout(() => stream.end(), 41000);
    });
  });

  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_readfile_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
