const puppeteer = require('puppeteer');
const { Client } = require('ssh2');

(async () => {
  const b = await puppeteer.launch({headless:true, ignoreHTTPSErrors:true, args:['--no-sandbox','--ignore-certificate-errors']});
  const [p] = await b.pages();

  // Try login with current password
  console.log('Checking admin login...');
  await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:15000});
  await new Promise(r => setTimeout(r,2000));
  await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
  await p.type('input#txt_Username','adminpldt',{delay:20});
  await p.type('input#txt_Password','AC2DIU7QW3ERTY6UPAS4DFG',{delay:15});
  await p.click('button#button');
  await new Promise(r => setTimeout(r,5000));
  console.log('After login URL:', p.url());

  const loggedIn = p.url().includes('index.asp') || p.url().includes('admin');
  console.log('Login successful:', loggedIn);

  if (loggedIn) {
    // Re-enable SSH
    console.log('\nGoing to Device Access Control...');
    await p.goto('https://192.168.1.1/html/ssmp/devicecontrol/devicecontrol.asp', {waitUntil:'networkidle0', timeout:15000});
    await new Promise(r => setTimeout(r,3000));

    const sshState = await p.evaluate(() => {
      const cb = document.querySelector('input[name="sshEnable"], input[id="sshEnable"]');
      if (cb) return { checked: cb.checked, type: cb.type, id: cb.id, name: cb.name };
      // Try finding any checkbox
      const allCbs = document.querySelectorAll('input[type="checkbox"]');
      const result = {};
      allCbs.forEach(c => { if (c.id) result[c.id] = c.checked; });
      return { notFound: true, allCheckboxes: result };
    });
    console.log('SSH checkbox state:', JSON.stringify(sshState));

    // Try clicking SSH checkbox and apply
    await p.evaluate(() => {
      const cb = document.querySelector('input[name="sshEnable"], input[id="sshEnable"]');
      if (cb) { if (!cb.checked) cb.click(); }
    });

    // Find and click Apply/Save button
    await p.evaluate(() => {
      const btns = document.querySelectorAll('input[type="submit"], input[value="Apply"], input[value="apply"], button');
      btns.forEach(btn => {
        const text = (btn.value || btn.textContent || '').toLowerCase();
        if (text.includes('apply') || text.includes('save') || text.includes('submit')) {
          btn.click();
        }
      });
    });
    await new Promise(r => setTimeout(r,5000));

    // Test SSH
    console.log('\nTesting SSH...');
    try {
      const conn = new Client();
      await new Promise((resolve, reject) => {
        conn.on('ready', resolve);
        conn.on('error', reject);
        conn.connect({ host: '192.168.1.1', port: 22, username: 'root', password: 'adminHW', readyTimeout: 10000 });
      });
      console.log('SSH RECONNECTED!');
      conn.end();
    } catch(e) {
      console.log('SSH still failing:', e.message);
    }
  } else {
    // Try default PLDT password
    console.log('\nTrying default PLDT password...');
    await p.goto('https://192.168.1.1/admin.html', {waitUntil:'domcontentloaded', timeout:15000});
    await new Promise(r => setTimeout(r,2000));
    await p.evaluate(() => { window.setDisable = () => {}; window.CheckPassword = () => 0; window.Userlevel = 0; window.preflag = 0; });
    await p.type('input#txt_Username','adminpldt',{delay:20});
    // Try common PLDT default passwords
    const passwords = ['AC2DIU7QW3ERTY6UPAS4DFG', 'adminpldt', 'admin', 'pldtadmin', 'pldt', '1234567890'];
    for (const pw of passwords) {
      console.log(`Trying password: ${pw}`);
      await p.evaluate(() => { document.querySelector('input#txt_Password').value = ''; });
      await p.type('input#txt_Password', pw, {delay:10});
      await p.click('button#button');
      await new Promise(r => setTimeout(r,3000));
      if (p.url().includes('index.asp') || p.url().includes('admin.asp')) {
        console.log('LOGGED IN with:', pw);
        break;
      }
    }
  }

  console.log('\n=== DONE ===');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
