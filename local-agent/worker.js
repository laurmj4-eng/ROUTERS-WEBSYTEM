/**
 * Router Control Local Agent
 *
 * Connects to the Laravel Reverb WebSocket server on the public
 * "router-control" channel and listens for RouterActionTriggered events.
 * When an event arrives, Puppeteer automates the Huawei HG8145X6-10
 * admin panel to execute the requested action.
 *
 * Usage:
 *   cd local-agent
 *   npm install
 *   npm start
 */

require('dotenv').config();

const puppeteer = require('puppeteer');
const Pusher = require('pusher-js');

const { loginRouter, executeRouterReboot, executePasswordChange } = require('./router/automation');
const { reportStatus } = require('./services/laravel-client');

const RECONNECT_DELAY = 5000;

async function handleEvent(browser, data) {
  console.log(`\n[worker] Received action: ${data.action} (log #${data.log_id})`);

  const page = await browser.newPage();

  try {
    // Step 1 — Log in to the router
    const loginResult = await loginRouter(page);
    console.log(`[worker] Login result: ${loginResult}`);

    if (loginResult === 'locked') {
      await reportStatus(data.log_id, 'failed');
      return;
    }

    // Step 2 — Execute the requested action
    if (data.action === 'reboot') {
      await executeRouterReboot(page);
    } else if (data.action === 'password_change') {
      const newPassword = data.parameters?.new_password;
      if (!newPassword) {
        console.error('[worker] No new_password in event parameters.');
        await reportStatus(data.log_id, 'failed');
        return;
      }
      await executePasswordChange(page, newPassword);
    } else {
      console.warn(`[worker] Unknown action: ${data.action}`);
      await reportStatus(data.log_id, 'failed');
      return;
    }

    // Step 3 — Report success
    await reportStatus(data.log_id, 'success');
    console.log(`[worker] Action ${data.action} completed successfully.`);
  } catch (err) {
    console.error(`[worker] Action ${data.action} failed:`, err.message);
    await reportStatus(data.log_id, 'failed');
  } finally {
    await page.close();
  }
}

async function main() {
  console.log('[worker] Starting Router Control Agent...');
  console.log(`[worker] Router target: http://${process.env.ROUTER_IP}`);
  console.log(`[worker] Reverb host: ${process.env.REVERB_SCHEME}://${process.env.REVERB_HOST}:${process.env.REVERB_PORT}`);

  // Launch a shared Puppeteer browser instance
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  console.log('[worker] Puppeteer browser launched.');

  // Connect to Laravel Reverb via Pusher protocol
  const pusher = new Pusher(process.env.REVERB_APP_KEY, {
    wsHost: process.env.REVERB_HOST,
    wsPort: parseInt(process.env.REVERB_PORT, 10),
    wssPort: parseInt(process.env.REVERB_PORT, 10),
    forceTLS: process.env.REVERB_SCHEME === 'https',
    disableStats: true,
    enabledTransports: ['ws', 'wss'],
  });

  pusher.connection.bind('state_change', (states) => {
    console.log(`[worker] Pusher state: ${states.previous} → ${states.current}`);
  });

  pusher.connection.bind('error', (err) => {
    console.error('[worker] Pusher connection error:', err);
  });

  // Subscribe to the public "router-control" channel
  const channel = pusher.subscribe('router-control');

  channel.bind('pusher:subscription_succeeded', () => {
    console.log('[worker] Subscribed to channel: router-control');
    console.log('[worker] Waiting for commands...\n');
  });

  channel.bind('pusher:subscription_error', (err) => {
    console.error('[worker] Subscription error:', err);
  });

  // Listen for the broadcasted event
  channel.bind('RouterActionTriggered', (data) => {
    handleEvent(browser, data).catch((err) => {
      console.error('[worker] Unhandled error in handleEvent:', err);
    });
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[worker] Shutting down...');
    pusher.disconnect();
    await browser.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[worker] Shutting down...');
    pusher.disconnect();
    await browser.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
