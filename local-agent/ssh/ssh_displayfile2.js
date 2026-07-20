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

      // Try display file with ? for help
      setTimeout(() => send('display file ?'), 4000);
      // Various syntax attempts
      setTimeout(() => send('display file url file:///mnt/jffs2/hw_ctree.xml'), 6000);
      setTimeout(() => send('display filename hw_ctree.xml'), 8000);
      setTimeout(() => send('display file-name hw_ctree.xml'), 10000);
      setTimeout(() => send('display configfile hw_ctree.xml'), 12000);
      // Try with path parameter keyword
      setTimeout(() => send('display file /mnt/jffs2/hw_ctree.xml format 0'), 14000);
      // Try load command
      setTimeout(() => send('load hw_ctree.xml'), 16000);
      // Try with no parameters to see usage
      setTimeout(() => send('display file'), 18000);

      setTimeout(() => send('quit'), 20000);
      setTimeout(() => stream.end(), 22000);
    });
  });

  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_displayfile2_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
