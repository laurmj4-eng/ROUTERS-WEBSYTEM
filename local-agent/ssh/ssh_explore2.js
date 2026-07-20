const { Client } = require('ssh2');

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 5000 });
  });

  console.log('Connected! Getting interactive shell...');

  let output = '';

  conn.on('data', (data) => {
    console.log('DATA event (raw):', data.toString());
  });

  conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
    console.log('Keyboard-interactive auth:', prompts);
    finish(['adminHW']);
  });

  // Use shell mode for interactive access
  conn.shell({ term: 'vt100', rows: 80, cols: 200 }, (err, stream) => {
    if (err) { console.error('Shell error:', err); conn.end(); return; }

    let fullOutput = '';
    let cmdQueue = [
      'id\n',
      'pwd\n',
      'mount\n',
      'cat /proc/mtd\n',
      'ls -la /\n',
      'find / -name "hw_ctree*" -o -name "ctree*" 2>/dev/null | head -20\n',
      'exit\n',
    ];
    let cmdIdx = 0;

    stream.on('data', (data) => {
      const text = data.toString('utf8', 0, data.length);
      process.stdout.write(text);
      fullOutput += text;

      // When we see a prompt, send the next command
      if (text.includes('#') || text.includes('>') || text.includes('$')) {
        if (cmdIdx < cmdQueue.length) {
          setTimeout(() => {
            stream.write(cmdQueue[cmdIdx++]);
          }, 300);
        }
      }
    });

    stream.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    stream.on('close', () => {
      console.log('\n=== FULL OUTPUT ===');
      console.log(fullOutput.substring(0, 5000));
      conn.end();
    });

    // Send initial newline to get prompt
    setTimeout(() => {
      stream.write('\n');
    }, 1000);
  });
}

main().catch(e => console.error('Error:', e.message));
