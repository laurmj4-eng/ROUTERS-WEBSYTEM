const { Client } = require('ssh2');

function sshExec(conn, cmd) {
  return new Promise((resolve) => {
    let out = '';
    conn.exec(cmd, (err, stream) => {
      if (err) { resolve('EXEC_ERR:' + err.message); return; }
      stream.on('data', d => out += d.toString());
      stream.stderr.on('data', d => out += d.toString());
      stream.on('close', (code) => resolve(out || '(exit:' + code + ')'));
    });
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 5000 });
  });

  console.log('=== Connected! ===\n');

  // Try simple commands first
  const cmds = [
    'echo HELLO_WORLD',
    'busybox echo BUSYBOX_OK',
    '/bin/busybox echo BB_OK',
    'sh -c "echo SH_OK"',
  ];

  for (const cmd of cmds) {
    console.log(`$ ${cmd}`);
    const out = await sshExec(conn, cmd);
    console.log('=>', out.trim());
  }

  // Try reading the config file with different methods
  const readCmds = [
    'cat /mnt/jffs2/hw_ctree.xml',
    'busybox cat /mnt/jffs2/hw_ctree.xml',
    'dd if=/mnt/jffs2/hw_ctree.xml bs=1024 count=100 2>/dev/null',
    'cat /flash/hw_ctree.xml',
    'cat /dev/mtdblock2',
    'cat /dev/mtdblock3',
    'ls -la /mnt/jffs2/',
    'find / -type f 2>/dev/null | head -50',
  ];

  for (const cmd of readCmds) {
    console.log(`\n$ ${cmd}`);
    const out = await sshExec(conn, cmd);
    console.log(out.substring(0, 2000) || '(empty)');
  }

  conn.end();
  console.log('\nDone');
}

main().catch(e => console.error('Error:', e.message));
