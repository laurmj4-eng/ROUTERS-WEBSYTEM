/**
 * Tulog Wifi Extender Scanner
 *
 * Sequential-switch vulnerability scanner:
 *   1. Save current SSID (guaranteed restore point)
 *   2. Verify target SSID is visible (abort cleanly if not — never strands the laptop)
 *   3. Connect to target with polling (no premature revert)
 *   4. LAN scan while connected: gateway ping, ARP table, ping sweep,
 *      port scan, HTTP admin page probes, beacon analysis
 *   5. Restore original WiFi (retried up to ~2 min, always attempted)
 *
 * No internet required — all targets are local to the target network.
 */

const { execSync } = require('child_process');
const net = require('net');
const http = require('http');

const DEFAULT_PORTS = [80, 443, 8080, 23, 22, 53, 81, 8888, 5555, 2323, 7547, 8443];
const SWEEP_RANGES = [
  { base: '10.0.0', from: 1, to: 40 },
  { base: '10.0.12', from: 1, to: 30 },
];

function run(cmd, timeoutMs = 15000) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs });
  } catch (err) {
    return err.stdout || '';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TulogScanner {
  constructor(options = {}) {
    this.targetSsid = options.ssid || 'Tulog Wifi Extender';
    this.restoreSsid = options.restoreSsid || null;
    this.ports = (options.ports || DEFAULT_PORTS).map(Number).filter(Boolean);
    this.connectTimeoutMs = options.connectTimeoutMs || 45000;
    this.pollIntervalMs = 3000;
  }

  getCurrentWifiSSID() {
    const out = run('netsh wlan show interfaces');
    const match = out.match(/SSID\s*:\s*(.+)/);
    return match ? match[1].trim() : null;
  }

  isNetworkVisible(ssid) {
    const out = run('netsh wlan show networks mode=bssid');
    return out.includes(ssid);
  }

  connectWithPolling(ssid) {
    const current = this.getCurrentWifiSSID();
    if (current === ssid) {
      console.log('[tulog] Already connected to target — skipping connect command');
      return true;
    }
    run(`netsh wlan connect name="${ssid}"`);
    const deadline = Date.now() + this.connectTimeoutMs;
    while (Date.now() < deadline) {
      const seen = this.getCurrentWifiSSID();
      if (seen === ssid) return true;
      if (seen && seen !== ssid && Date.now() > deadline - 15000) {
        console.log(`[tulog] Polling... still on "${seen}"`);
      }
      sleepSync(this.pollIntervalMs);
    }
    return this.getCurrentWifiSSID() === ssid;
  }

  getWifiInterface() {
    const out = run('ipconfig');
    const section = out.split(/Wireless LAN adapter/).slice(1).join('');
    const ip = section.match(/IPv4 Address[^\d]*([\d.]+)/);
    const gw = section.match(/Default Gateway[^\d]*([\d.]+)/);
    return { ip: ip ? ip[1] : null, gateway: gw ? gw[1] : null };
  }

  getInterfaceDetail() {
    const out = run('netsh wlan show interfaces');
    return {
      bssid: (out.match(/BSSID\s*:\s*([0-9a-f:]+)/i) || [])[1] || null,
      signal: parseInt((out.match(/Signal\s*:\s*(\d+)%/) || [])[1] || '0', 10),
      band: (out.match(/Band\s*:\s*(.+)/) || [])[1]?.trim() || null,
    };
  }

  pingHost(ip, timeoutMs = 500) {
    const out = run(`ping -n 1 -w ${timeoutMs} ${ip}`);
    return out.includes('Reply from') || out.includes('bytes=32');
  }

  pingSweep() {
    const alive = [];
    for (const { base, from, to } of SWEEP_RANGES) {
      for (let i = from; i <= to; i++) {
        const ip = `${base}.${i}`;
        if (this.pingHost(ip)) {
          alive.push(ip);
        }
      }
    }
    return alive;
  }

  getArpTable() {
    const out = run('arp -a');
    const entries = [];
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s*([\d.]+)\s+([0-9a-f-]{17})\s+dynamic/i);
      if (m) entries.push({ ip: m[1], mac: m[2] });
    }
    return entries;
  }

  async portScan(host) {
    const open = [];
    for (const port of this.ports) {
      if (await this._checkPort(host, port, 700)) {
        open.push(`${host}:${port}`);
      }
    }
    return open;
  }

  _checkPort(host, port, timeoutMs) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish(true));
      socket.once('timeout', () => finish(false));
      socket.once('error', () => finish(false));
      socket.connect(port, host);
    });
  }

  async httpProbe(url) {
    return new Promise((resolve) => {
      const req = http.get(url, { timeout: 8000 }, (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
          if (body.length > 4000) res.destroy();
        });
        res.on('end', () => {
          const title = (body.match(/<title[^>]*>(.*?)<\/title>/i) || [])[1] || '';
          resolve({ url, status: res.statusCode, title: title.trim() });
        });
        res.on('error', () => resolve({ url, error: 'read error' }));
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ url, error: 'timeout' });
      });
      req.on('error', () => resolve({ url, error: 'unreachable' }));
    });
  }

  restoreWifi(ssid) {
    if (!ssid) return 'none';
    const deadline = Date.now() + 120000;
    let attempts = 0;
    let issued = false;
    while (Date.now() < deadline) {
      attempts++;
      const current = this.getCurrentWifiSSID();
      if (current === ssid) return 'restored';
      if (!issued || (attempts % 4 === 0)) {
        run(`netsh wlan connect name="${ssid}"`);
        issued = true;
      }
      sleepSync(10000);
    }
    return `failed (last ssid: ${this.getCurrentWifiSSID() || 'none'}, attempts: ${attempts})`;
  }

  beaconAnalysis() {
    const out = run('netsh wlan show networks mode=bssid');
    const lines = out.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const s = lines[i].match(/SSID \d+ : (.+)/);
      if (s && s[1].trim() === this.targetSsid) {
        const block = lines.slice(i, i + 12).join('\n');
        const auth = (block.match(/Authentication\s*:\s*(.+)/) || [])[1]?.trim() || null;
        const enc = (block.match(/Encryption\s*:\s*(.+)/) || [])[1]?.trim() || null;
        const signal = parseInt((block.match(/Signal\s*:\s*(\d+)%/) || [])[1] || '0', 10);
        const security = /open/i.test(auth) ? 'OPEN' : (auth || 'UNKNOWN').toUpperCase();
        const risk = security === 'OPEN' ? 'CRITICAL' : security === 'WEP' ? 'HIGH' : security === 'WPA' ? 'MEDIUM' : security === 'WPA2' ? 'LOW' : security === 'WPA3' ? 'MINIMAL' : 'UNKNOWN';
        return { ssid: s[1].trim(), security, encryption: enc, signal, risk };
      }
    }
    return null;
  }

  async run() {
    const started = Date.now();
    const originalSsid = this.restoreSsid || this.getCurrentWifiSSID();
    const report = {
      original_ssid: originalSsid,
      target_ssid: this.targetSsid,
      status: 'failed',
      connected: false,
      bssid: null,
      signal: null,
      band: null,
      ip_address: null,
      gateway: null,
      gateway_mac: null,
      ports_open: [],
      http_probes: [],
      devices_found: [],
      beacon_analysis: null,
      restore_status: null,
      error: null,
    };

    try {
      console.log(`[tulog] Target: ${this.targetSsid} (original: ${originalSsid})`);

      if (!this.isNetworkVisible(this.targetSsid)) {
        report.status = 'ssid_not_in_range';
        report.error = `SSID "${this.targetSsid}" not visible — powered off, out of range, or hidden.`;
        console.log(`[tulog] ${report.error}`);
        return report;
      }
      console.log('[tulog] Target SSID is visible — proceeding');

      report.beacon_analysis = this.beaconAnalysis();
      console.log(`[tulog] Beacon analysis: ${JSON.stringify(report.beacon_analysis)}`);

      const connected = this.connectWithPolling(this.targetSsid);
      report.connected = connected;
      if (!connected) {
        report.error = 'Failed to connect to target SSID (connect timeout).';
        console.log(`[tulog] ${report.error}`);
        return report;
      }
      console.log('[tulog] Connected to target');

      await sleep(6000);
      const detail = this.getInterfaceDetail();
      Object.assign(report, detail);

      const { ip, gateway } = this.getWifiInterface();
      report.ip_address = ip;
      report.gateway = gateway;
      console.log(`[tulog] IP: ${ip}, Gateway: ${gateway}`);

      const arp = this.getArpTable();
      report.gateway_mac = gateway ? (arp.find((e) => e.ip === gateway)?.mac || null) : null;
      report.devices_found = arp.map((e) => ({ ip: e.ip, mac: e.mac }));
      console.log(`[tulog] ARP entries: ${arp.length}`);

      const alive = this.pingSweep();
      console.log(`[tulog] Ping sweep alive: ${alive.join(', ') || 'none'}`);
      for (const ip of alive) {
        if (!report.devices_found.some((d) => d.ip === ip)) {
          report.devices_found.push({ ip });
        }
      }

      const targets = [...new Set([gateway, ...alive].filter(Boolean))];
      for (const t of targets) {
        const open = await this.portScan(t);
        report.ports_open.push(...open);
        console.log(`[tulog] Ports open on ${t}: ${open.join(', ') || 'none'}`);
      }

      const probeUrls = [];
      for (const t of targets) {
        probeUrls.push(`http://${t}/`, `http://${t}/login`, `http://${t}/admin`);
      }
      for (const u of probeUrls) {
        report.http_probes.push(await this.httpProbe(u));
      }

      report.status = report.gateway ? 'completed' : 'partial';
      if (!report.gateway) {
        report.error = report.error || 'Connected but no gateway found — network unreachable at L3.';
      }
      console.log(`[tulog] Scan ${report.status}`);
    } catch (err) {
      report.error = err.message;
      console.error(`[tulog] Scan error: ${err.message}`);
    } finally {
      console.log(`[tulog] Restoring original WiFi: ${originalSsid}`);
      report.restore_status = this.restoreWifi(originalSsid);
      report.duration_ms = Date.now() - started;
      console.log(`[tulog] Restore status: ${report.restore_status}`);
    }

    return report;
  }
}

function sleepSync(ms) {
  execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds ${ms}"`, { timeout: ms + 10000 });
}

module.exports = { TulogScanner };
