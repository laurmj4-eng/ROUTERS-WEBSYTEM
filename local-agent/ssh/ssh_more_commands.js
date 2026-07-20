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

      setTimeout(() => send('restore backup ?'), 4000);
      setTimeout(() => send('save data ?'), 6000);
      setTimeout(() => send('load pack ?'), 8000);
      setTimeout(() => send('load ssh-pubkey ?'), 10000);
      setTimeout(() => send('session cli ?'), 12000);
      setTimeout(() => send('session cli'), 14000);
      setTimeout(() => send('diagnose ?'), 16000);
      setTimeout(() => send('start diagnose ?'), 18000);
      setTimeout(() => send('display backup list'), 20000);
      setTimeout(() => send('get wlan basic'), 22000);

      setTimeout(() => send('quit'), 24000);
      setTimeout(() => stream.end(), 26000);
    });
  });

  fs.writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_more_commands_out.txt', fullOutput);
  console.log('\n=== COMPLETE ===');
  conn.end();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
