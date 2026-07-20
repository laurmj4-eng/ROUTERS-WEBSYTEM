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

      // Check for backup directories
      setTimeout(() => send('wap list path /mnt/backup'), 4000);
      setTimeout(() => send('wap list path /backup'), 6000);
      setTimeout(() => send('wap list path /'), 8000);
      
      // Try to find hw_ctree.xml via different paths
      setTimeout(() => send('wap list path /mnt/jffs2 | include hw_ctree'), 10000);
      
      // Try restore backup with full path
      setTimeout(() => send('restore backup ?'), 12000);
      
      // Try display file on board_type again to confirm it works
      setTimeout(() => send('display file /mnt/jffs2/board_type'), 14000);
      
      // Check if there's a way to get backup files
      setTimeout(() => send('display backup list'), 16000);
      
      // Try set ssid command
      setTimeout(() => send('set ssid ?'), 18000);

      setTimeout(() => send('quit'), 20000);
      setTimeout(() => stream.end(), 22000);
    });
  });

  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_backup_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
