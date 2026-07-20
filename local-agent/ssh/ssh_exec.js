const { Client } = require('ssh2');
const fs = require('fs');

async function tryExec(conn, command) {
  return new Promise((resolve) => {
    let output = '';
    conn.exec(command, (err, stream) => {
      if (err) { resolve({ command, error: err.message }); return; }
      stream.on('data', (data) => { output += data.toString(); });
      stream.stderr.on('data', (data) => { output += '[STDERR]' + data.toString(); });
      stream.on('close', (code) => {
        resolve({ command, code, output: output.substring(0, 3000) });
      });
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 10000 });
  });

  console.log('Connected! Trying exec() commands...\n');

  const commands = [
    'cat /mnt/jffs2/hw_ctree.xml',
    '/bin/cat /mnt/jffs2/hw_ctree.xml',
    '/bin/busybox cat /mnt/jffs2/hw_ctree.xml',
    'dd if=/mnt/jffs2/hw_ctree.xml bs=1024 count=100',
    'id',
    'ls /mnt/jffs2/',
    'echo test',
    'uname -a',
    'busybox --help',
  ];

  for (const cmd of commands) {
    const result = await tryExec(conn, cmd);
    console.log(`$ ${cmd}`);
    console.log(`  Exit: ${result.code ?? 'ERR'}, Output: ${(result.output || result.error || '').substring(0, 500)}`);
    console.log('');
  }

  conn.end();
  console.log('=== DONE ===');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
