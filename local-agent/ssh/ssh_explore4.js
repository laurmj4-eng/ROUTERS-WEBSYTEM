const { Client } = require('ssh2');

function sshExec(conn, cmd) {
  return new Promise((resolve) => {
    let out = '';
    conn.exec(cmd, (err, stream) => {
      if (err) { resolve('ERR:' + err.message); return; }
      stream.on('data', d => { out += d.toString(); });
      stream.stderr.on('data', d => { out += d.toString(); });
      stream.on('close', () => resolve(out));
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

  console.log('Connected. Testing various commands...\n');

  // Test 1: Simple echo
  console.log('=== Test 1: Simple commands ===');
  for (const cmd of ['echo test123', '/bin/echo test123', 'printf "test123\n"']) {
    const out = await sshExec(conn, cmd);
    console.log(`"${cmd}" => [${out.trim()}]`);
  }

  // Test 2: Check what shell we're in
  for (const cmd of ['echo $0', 'whoami', 'id']) {
    const out = await sshExec(conn, cmd);
    console.log(`"${cmd}" => [${out.trim()}]`);
  }

  // Test 3: Huawei WAP commands
  const wapCmds = ['display version', 'display deviceInfo', 'display wifi config'];
  for (const cmd of wapCmds) {
    const out = await sshExec(conn, cmd);
    console.log(`"${cmd}" => [${out.trim().substring(0, 200)}]`);
  }

  // Test 4: Shell escape attempt
  for (const cmd of ['sh', '!sh', 'shell', 'system shell']) {
    const out = await sshExec(conn, cmd);
    console.log(`"${cmd}" => [${out.trim().substring(0, 200)}]`);
  }

  conn.end();
  console.log('\nComplete');
}

main().catch(e => console.error('Error:', e.message));
