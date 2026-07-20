const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const commands = [
  'cat /mnt/jffs2/hw_ctree.xml',
  'shell',
  'sh',
  '!ls',
  '!cat /mnt/jffs2/hw_ctree.xml',
  '/bin/sh',
  'exec cat /mnt/jffs2/hw_ctree.xml',
  'system cat /mnt/jffs2/hw_ctree.xml',
  'cli',
  'bash',
  'debug shell',
  'diagnose shell',
  'su shell',
  'start shell',
  'pwd',
  'ls',
  'll /mnt/jffs2/',
  'ls -la /mnt/jffs2/',
];

let cmdIdx = 0;
let fullOutput = '';

conn.on('ready', () => {
  console.log('SSH ready');
  conn.shell({ term: 'vt100', cols: 200, rows: 200 }, (err, stream) => {
    if (err) { console.error('shell err:', err.message); conn.end(); return; }
    
    stream.on('data', d => {
      const s = d.toString();
      fullOutput += s;
      process.stdout.write(s);
      
      if (s.includes('WAP>') || s.includes('WAP#') || s.includes('# ')) {
        if (cmdIdx < commands.length) {
          setTimeout(() => {
            stream.write(commands[cmdIdx] + '\n');
            cmdIdx++;
          }, 300);
        } else {
          setTimeout(() => {
            fs.writeFileSync('ssh_explore_out.txt', fullOutput);
            console.log('\nSaved to ssh_explore_out.txt');
            conn.end();
            process.exit(0);
          }, 500);
        }
      }
    });
    
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => { process.exit(0); });
    
    setTimeout(() => {
      stream.write(commands[cmdIdx] + '\n');
      cmdIdx++;
    }, 1500);
  });
});

conn.on('error', e => { console.error('SSH error:', e.message); process.exit(1); });

conn.connect({
  host: '192.168.1.1', port: 22,
  username: 'root', password: 'adminHW',
  readyTimeout: 15000
});
