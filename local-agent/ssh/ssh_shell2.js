const { Client } = require('ssh2');

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 10000 });
  });

  console.log('Connected!\n');

  let state = 'init'; // init -> su -> su_pwd -> shell -> linux_cmds
  let suPwdAttempts = 0;
  let fullOutput = '';
  let finalResolve = null;
  let cmdDone = false;

  const result = await new Promise((resolve) => {
    finalResolve = resolve;

    conn.shell({ term: 'vt100', rows: 100, cols: 200 }, (err, stream) => {
      if (err) { console.error('Shell error:', err); resolve('SHELL_ERR:' + err.message); return; }

      const shell = stream;

      const send = (txt) => {
        console.log('>>>', txt.replace(/\n/g, '\\n'));
        shell.write(txt);
      };

      shell.on('data', (data) => {
        const text = data.toString('utf8', 0, data.length);
        fullOutput += text;
        process.stdout.write(text);

        // Detect prompt
        const lines = text.split('\n');
        const lastLine = lines[lines.length - 1].trim();

        if (text.includes('Password') && state === 'su') {
          state = 'su_pwd';
          send('adminHW\n');
          return;
        }

        if (lastLine === 'WAP>' || text.trim().endsWith('WAP>')) {
          if (state === 'init') {
            state = 'su';
            send('su\n');
          } else if (state === 'su_pwd' || state === 'su') {
            // su might not work, try without password
            send('su\n');
          } else {
            // Still in WAP - try shell command directly
            send('shell\n');
          }
          return;
        }

        if (lastLine === 'SU_WAP>' || text.trim().endsWith('SU_WAP>')) {
          state = 'shell';
          send('shell\n');
          return;
        }

        if (text.includes('#') || text.includes('$')) {
          // We have a Linux shell!
          if (state !== 'done') {
            state = 'done';
            cmdDone = true;

            // Run commands to find and dump config
            const cmds = [
              'id\n',
              'mount\n',
              'ls -la /\n',
              'ls -la /mnt/\n',
              'ls -la /flash/\n',
              'find / -name "hw_ctree*" -o -name "backupcfg*" -o -name "ctree*" 2>/dev/null\n',
              'cat /etc/passwd\n',
            ];

            let i = 0;
            const sendNext = () => {
              if (i < cmds.length) {
                const c = cmds[i++];
                console.log('>>>', c.replace(/\n/g, '\\n'));
                shell.write(c);
                setTimeout(sendNext, 2000);
              } else {
                // Read config file
                shell.write('cat /mnt/jffs2/hw_ctree.xml 2>/dev/null | head -500\n');
                setTimeout(() => {
                  shell.write('aescrypt2 1 /mnt/jffs2/hw_ctree.xml /tmp/hw_ctree_dec.xml 2>/dev/null; cat /tmp/hw_ctree_dec.xml 2>/dev/null | head -500\n');
                }, 3000);
                setTimeout(() => {
                  shell.write('grep PreSharedKey /tmp/hw_ctree_dec.xml 2>/dev/null\n');
                }, 6000);
                setTimeout(() => {
                  shell.write('exit\n');
                }, 10000);
              }
            };
            sendNext();
          }
          return;
        }
      });

      shell.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
        fullOutput += data.toString();
      });

      shell.on('close', () => {
        console.log('\n=== CLOSED ===');
        resolve(fullOutput);
      });

      // Start by sending newlines to get a prompt
      setTimeout(() => send('\n'), 500);
    });
  });

  console.log('\n=== FINAL OUTPUT ===');
  console.log(result.substring(0, 10000));

  // Save full output to file
  require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_output.txt', result);
  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
