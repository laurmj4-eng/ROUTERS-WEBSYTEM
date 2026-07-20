const net = require('net');

const ROUTER = '192.168.1.1';
const FTP_PORT = 21;

async function tryFTP() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    
    let response = '';
    socket.on('data', (data) => {
      response += data.toString();
      if (response.includes('220 ') || response.includes('ready')) {
        // Send USER
        socket.write('USER root\r\n');
      }
      if (response.includes('331 ') || response.includes('password')) {
        socket.write('PASS adminHW\r\n');
      }
      if (response.includes('230 ') || response.includes('successful') || response.includes('logged in')) {
        // Try to list files
        socket.write('PASV\r\n');
      }
      if (response.includes('227 ')) {
        // PASV mode - try listing
        socket.write('LIST /mnt/jffs2/hw_ctree.xml\r\n');
        setTimeout(() => {
          socket.write('QUIT\r\n');
        }, 1000);
      }
    });

    socket.on('connect', () => {
      console.log('FTP: Connected to port 21');
    });

    socket.on('close', () => {
      console.log('FTP: Response:', response.substring(0, 500).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' '));
      resolve(response);
    });

    socket.on('error', (e) => {
      console.log('FTP: Error:', e.message);
      resolve(e.message);
    });

    socket.on('timeout', () => {
      console.log('FTP: Timeout');
      socket.destroy();
      resolve('timeout');
    });

    socket.connect(FTP_PORT, ROUTER);
  });
}

(async () => {
  console.log('=== Checking FTP ===');
  await tryFTP();
  console.log('\n=== Done ===');
})();
