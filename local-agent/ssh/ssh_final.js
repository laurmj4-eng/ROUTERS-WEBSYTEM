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
      // uppercase extension
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree.XML'), 4000);
      // try without extension
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree'), 6000);
      // backup without xml
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree_bak'), 8000);
      // default ctree
      setTimeout(() => send('display file /mnt/jffs2/hw_default_ctree'), 10000);
      // list commands
      setTimeout(() => send('?'), 12000);
      setTimeout(() => send('quit'), 16000);
      setTimeout(() => stream.end(), 18000);
    });
  });

  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_final_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
