const { Client } = require('ssh2');
const fs = require('fs');

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 10000 });
  });

  console.log('Connected! Trying SCP download...');

  // Try SCP to download hw_ctree.xml
  try {
    await new Promise((resolve, reject) => {
      conn.scp({
        host: '192.168.1.1',
        port: 22,
        username: 'root',
        password: 'adminHW',
      }, '/mnt/jffs2/hw_ctree.xml', 'C:\\Users\\emili\\AppData\\Local\\Temp\\hw_ctree.xml', (err) => {
        if (err) { reject(err); return; }
        resolve();
      });
    });
    console.log('SCP download successful!');
    const size = fs.statSync('C:\\Users\\emili\\AppData\\Local\\Temp\\hw_ctree.xml').size;
    console.log('File size:', size, 'bytes');
  } catch (e) {
    console.log('SCP failed:', e.message);
  }

  // Try SFTP
  try {
    const sftp = await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) { reject(err); return; }
        resolve(sftp);
      });
    });
    console.log('SFTP session opened!');

    // List files in /mnt/jffs2
    const files = await new Promise((resolve, reject) => {
      sftp.readdir('/mnt/jffs2', (err, list) => {
        if (err) { reject(err); return; }
        resolve(list);
      });
    });
    console.log('Files in /mnt/jffs2 via SFTP:', files.map(f => f.filename).join(', '));

    // Try to read hw_ctree.xml
    const ws = fs.createWriteStream('C:\\Users\\emili\\AppData\\Local\\Temp\\hw_ctree_sftp.xml');
    await new Promise((resolve, reject) => {
      sftp.fastGet('/mnt/jffs2/hw_ctree.xml', 'C:\\Users\\emili\\AppData\\Local\\Temp\\hw_ctree_sftp.xml', {}, (err) => {
        if (err) { reject(err); return; }
        resolve();
      });
    });
    console.log('SFTP download successful!');
    const size = fs.statSync('C:\\Users\\emili\\AppData\\Local\\Temp\\hw_ctree_sftp.xml').size;
    console.log('File size:', size, 'bytes');
  } catch (e) {
    console.log('SFTP failed:', e.message);
  }

  conn.end();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
