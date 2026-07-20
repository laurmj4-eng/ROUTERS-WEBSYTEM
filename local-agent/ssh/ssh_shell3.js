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

      stream.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
        fullOutput += data.toString();
      });

      stream.on('close', () => resolve(fullOutput));

      // Send commands with delays
      setTimeout(() => stream.write('\n'), 300);
      setTimeout(() => stream.write('su\n'), 1500);
      setTimeout(() => stream.write('adminHW\n'), 3000);
      setTimeout(() => stream.write('shell\n'), 5000);
      setTimeout(() => {
        stream.write('id\n');
        stream.write('mount\n');
        stream.write('ls -la /\n');
      }, 7000);
      setTimeout(() => {
        stream.write('find / -name "hw_ctree*" -o -name "backupcfg*" -o -name "ctree*" 2>/dev/null\n');
      }, 10000);
      setTimeout(() => {
        stream.write('ls -la /mnt/jffs2/ 2>/dev/null; ls -la /flash/ 2>/dev/null; ls -la /var/ 2>/dev/null\n');
      }, 14000);
      setTimeout(() => {
        stream.write('cat /mnt/jffs2/hw_ctree.xml 2>/dev/null | head -400\n');
      }, 18000);
      setTimeout(() => {
        // Try to decrypt too
        stream.write('which aescrypt2 2>/dev/null; which cfgtool 2>/dev/null\n');
      }, 22000);
      setTimeout(() => {
        stream.write('exit\n');
      }, 26000);
      setTimeout(() => {
        stream.end();
      }, 28000);
    });
  });

  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_output3.txt', fullOutput);
  console.log('\n=== COMPLETE (output saved to ssh_output3.txt) ===');
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
