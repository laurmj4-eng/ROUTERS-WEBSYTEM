const { Client } = require('ssh2');
const conn = new Client();
let output = '';

conn.on('ready', () => {
  console.log('SSH ready');
  conn.shell({ term: 'vt100', cols: 200, rows: 200 }, (err, stream) => {
    if (err) { console.error('shell err:', err.message); conn.end(); return; }
    stream.on('data', d => {
      const s = d.toString();
      output += s;
      process.stdout.write(s);
    });
    stream.on('close', () => {
      console.log('\n[Session closed]');
      conn.end();
    });
    stream.stderr.on('data', d => process.stderr.write(d.toString()));

    // Send commands after shell is ready
    setTimeout(() => {
      stream.write('display file /mnt/jffs2/hw_ctree.xml\n');
    }, 2000);
    setTimeout(() => {
      stream.write('\n');
      process.exit(0);
    }, 15000);
  });
});

conn.on('error', e => {
  console.error('SSH error:', e.message);
  process.exit(1);
});

conn.connect({
  host: '192.168.1.1',
  port: 22,
  username: 'root',
  password: 'adminHW',
  readyTimeout: 15000
});
