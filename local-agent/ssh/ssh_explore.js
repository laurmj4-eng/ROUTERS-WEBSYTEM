const { Client } = require('ssh2');
const conn = new Client();

const commands = [
  'display version',
  'display current-configuration',
  'display wlan',
  'display wlan 0',
  'display wlan all',
  'get wlan',
  'get wlan 1',
  'display board_item',
  'display language',
  'display dns',
  'display wan',
  'display lan',
  'display device',
  'display system',
  'display sys',
  'display diagnose',
  'display debug',
  'display mib',
  'display oam',
  'display traffic',
  'display cpu',
  'display memory',
  'display process',
  'display log',
  'display logbuffer',
  'display hardware',
  'display board',
  'display product',
  'display backup',
  'list',
  'help',
  '?',
  'ls',
  'pwd',
  'whoami',
];

let cmdIdx = 0;
let output = '';
let waitingForPrompt = false;

conn.on('ready', () => {
  console.log('SSH ready');
  conn.shell({ term: 'vt100', cols: 200, rows: 200 }, (err, stream) => {
    if (err) { console.error('shell err:', err.message); conn.end(); return; }
    
    stream.on('data', d => {
      const s = d.toString();
      output += s;
      process.stdout.write(s);
      
      // If we see the WAP prompt, send next command
      if (s.includes('WAP>') || s.includes('WAP#')) {
        waitingForPrompt = false;
        if (cmdIdx < commands.length) {
          setTimeout(() => {
            stream.write(commands[cmdIdx] + '\n');
            cmdIdx++;
          }, 500);
        } else {
          setTimeout(() => { conn.end(); process.exit(0); }, 1000);
        }
      }
    });
    
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    
    stream.on('close', () => { conn.end(); process.exit(0); });
    
    // Send first command after shell starts
    setTimeout(() => {
      stream.write(commands[cmdIdx] + '\n');
      cmdIdx++;
    }, 2000);
  });
});

conn.on('error', e => { console.error('SSH error:', e.message); process.exit(1); });

conn.connect({
  host: '192.168.1.1', port: 22,
  username: 'root', password: 'adminHW',
  readyTimeout: 15000
});
