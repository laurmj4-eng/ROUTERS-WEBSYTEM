#!/usr/bin/env node
'use strict';

const http = require('http');
const net = require('net');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT || '8787', 10);
const SCANNER = path.join(ROOT, 'scanner.cjs');

function loadConfig() {
  const cfg = { host: '192.168.1.1', port: 443, relay_token: '' };
  const f = path.join(ROOT, 'config.json');
  if (fs.existsSync(f)) {
    try { Object.assign(cfg, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch (e) {}
  }
  if (process.env.RELAY_TOKEN) cfg.relay_token = process.env.RELAY_TOKEN;
  return cfg;
}

const CONFIG = loadConfig();

function authorized(req) {
  if (!CONFIG.relay_token) return true;
  return req.headers['x-relay-token'] === CONFIG.relay_token;
}

function tcpCheck(host, port) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = net.connect({ host, port, timeout: 5000 });
    sock.once('connect', () => { sock.destroy(); resolve({ reachable: true, ms: Date.now() - t0 }); });
    sock.once('error', (e) => { sock.destroy(); resolve({ reachable: false, error: e.message }); });
    sock.once('timeout', () => { sock.destroy(); resolve({ reachable: false, error: 'timeout' }); });
  });
}

function runScanner(args, body) {
  return new Promise((resolve) => {
    const full = ['scanner.cjs', ...args];
    const child = execFile(process.execPath, full, { cwd: ROOT, timeout: 180000 }, (err, stdout, stderr) => {
      if (err) {
        const parsed = parseJson(stdout);
        resolve(parsed || { success: false, message: (stderr || stdout || err.message).slice(0, 500) });
        return;
      }
      resolve(parseJson(stdout) || { success: false, message: 'scanner produced no JSON output' });
    });
    child.on('error', (e) => resolve({ success: false, message: 'failed to start scanner: ' + e.message }));
  });
}

function parseJson(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try { const v = JSON.parse(lines[i]); if (v && typeof v === 'object') return v; } catch (e) {}
  }
  return null;
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', () => resolve(''));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/health') {
    return send(res, 200, { ok: true, agent: 'phone-agent', ts: Date.now() });
  }

if (!authorized(req)) {
    return send(res, 401, { success: false, message: 'Unauthorized: X-Relay-Token missing or invalid.' });
  }

  // The hosted (Render) site proxies to the tunnel using the app's own relay
  // paths (/api/relay/pldt/*). Accept both spellings.
  const ep = (url.pathname || '').replace(/^\/api\/relay\/pldt\//, '/');

  if (req.method === 'POST' && ep === '/check-connection') {
    const body = readBody(req);
    const tcp = await tcpCheck(CONFIG.host, CONFIG.port);
    if (!tcp.reachable) {
      return send(res, 200, { success: false, ip: CONFIG.host, port: CONFIG.port, message: 'Router unreachable: ' + tcp.error, reachable: false });
    }
    const scan = await runScanner(['check']);
    return send(res, 200, { success: scan.success, ip: CONFIG.host, port: CONFIG.port, reachable: true, login: scan, ms: tcp.ms });
  }

  if (req.method === 'POST' && ep === '/wifi-scan') {
    const raw = await readBody(req);
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = {}; }
    const args = [];
    if (data.mode) args.push('--mode', String(data.mode));
    if (data.username) args.push('--username', String(data.username));
    if (data.password) args.push('--password', String(data.password));
    if (data.router_ip) args.push('--router-ip', String(data.router_ip));
    const t0 = Date.now();
    const result = await runScanner(['scan', ...args]);
    const elapsed = Math.round((Date.now() - t0) / 1000);
    if (result.success === false || result.error) {
      return send(res, 200, { success: false, message: result.message || result.error || 'Scan failed', elapsed });
    }
    return send(res, 200, { success: true, data: (result.wifi || []).map((w) => ({ ...w })), elapsed });
  }

  if (req.method === 'POST' && ep === '/scan-password') {
    const raw = await readBody(req);
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = {}; }
    const args = [];
    if (data.username) args.push('--username', String(data.username));
    if (data.password) args.push('--password', String(data.password));
    if (data.router_ip) args.push('--router-ip', String(data.router_ip));
    args.push('--mode', 'adminpldt');
    const t0 = Date.now();
    const result = await runScanner(['scan-password', ...args]);
    const elapsed = Math.round((Date.now() - t0) / 1000);
    if (result.success === false || result.error) {
      return send(res, 200, { success: false, message: result.message || result.error || 'Scan failed', elapsed });
    }
    return send(res, 200, { success: true, data: result, elapsed });
  }

  return send(res, 404, { success: false, message: 'Not found. Use /health, /check-connection, /wifi-scan, /scan-password' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`phone-agent listening on http://0.0.0.0:${PORT} (router ${CONFIG.host}:${CONFIG.port}, token ${CONFIG.relay_token ? 'set' : 'NOT SET'})`);
});

