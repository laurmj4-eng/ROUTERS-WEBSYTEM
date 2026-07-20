const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();

const commands = [
  'tftp',
  'tftp -l /mnt/jffs2/hw_ctree.xml -p 192.168.1.100',
  'tftp put /mnt/jffs2/hw_ctree.xml',
  'upload',
  'download',
  'backup config',
  'backup configuration',
  'display backup file 1',
  'display backup file 2',
  'display backup all',
  'display backup config',
  'display current-config',
  'display running-config',
  'display configuration',
  'get wlan SSID',
  'get wlan PreSharedKey',
  'get wlan WPAKey',
  'get wlan KeyPassphrase',
  'display wifi',
  'display wifissid',
  'display wlan security',
  'display wlan station',
  'display wlan sta',
  'display wlan info',
  'show wlan',
  'show wifi',
  'display wlan allinfo',
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
      
      if (s.includes('WAP>') || s.includes('WAP#') || s.includes('# ') || s.includes(']:~$')) {
        if (cmdIdx < commands.length) {
          setTimeout(() => {
            stream.write(commands[cmdIdx] + '\n');
            cmdIdx++;
          }, 400);
        } else {
          setTimeout(() => {
            fs.writeFileSync('ssh_wlan_out.txt', fullOutput);
            console.log('\n=== SAVED ===');
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
