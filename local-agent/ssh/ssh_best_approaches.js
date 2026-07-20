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

      // Try diagnostic displays that might leak passwords
      setTimeout(() => send('display pppoe client all'), 4000);
      setTimeout(() => send('display voip info'), 8000);
      setTimeout(() => send('display cwmp status'), 12000);
      setTimeout(() => send('display tr069 info'), 16000);

      // Try tricks to bypass .xml filter
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree.xml '), 20000);
      setTimeout(() => send('display file /mnt/jffs2//hw_ctree.xml'), 22000);
      setTimeout(() => send('display file $PWD/hw_ctree.xml'), 24000);
      
      // shell with argument
      setTimeout(() => send('shell cat /mnt/jffs2/hw_ctree.xml'), 26000);
      
      // wificmd might show psk
      setTimeout(() => send('wificmd --help'), 28000);
      setTimeout(() => send('display radio stats'), 30000);

      setTimeout(() => send('quit'), 34000);
      setTimeout(() => stream.end(), 36000);
    });
  });

  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_best_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
