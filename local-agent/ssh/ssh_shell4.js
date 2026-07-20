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

      // Sequence
      setTimeout(() => send(''), 500);            // wake up
      setTimeout(() => send('su'), 1500);           // elevate from WAP> to SU_WAP>
      setTimeout(() => send('shell'), 4000);        // enter Linux shell
      setTimeout(() => send('id'), 7000);
      setTimeout(() => send('mount'), 9000);
      setTimeout(() => send('ls -la /'), 11000);
      setTimeout(() => send('ls -la /mnt'), 13000);
      setTimeout(() => send('ls -la /flash'), 15000);
      setTimeout(() => send('find / -name "hw_ctree*"'), 17000);
      setTimeout(() => send('cat /mnt/jffs2/hw_ctree.xml | head -500'), 20000);
      setTimeout(() => send('exit'), 30000);
      setTimeout(() => stream.end(), 32000);
    });
  });

  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_output4.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
