/**
 * LPB Piso WiFi automation — opens 10.0.0.1, performs time/voucher operations.
 */

const LPB_BASE = process.env.LPB_URL || 'http://10.0.0.1';

/**
 * Opens the LPB portal. The portal shows "Device Checking! Please Wait"
 * on the first load (with an auto-refresh), then serves the real page on
 * the second load. Uses exactly 2 navigations and verifies via portaljs.
 */
async function openPortal(page) {
  console.log('[lpb] Opening portal...');
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${LPB_BASE}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    }).catch(() => {});

    await sleep(1600); // let the "Device Checking" auto-refresh happen

    await page.goto(`${LPB_BASE}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    }).catch(() => {});

    if (await isPortalReady(page)) {
      console.log('[lpb] Portal loaded');
      return true;
    }
    console.log(`[lpb] Portal not ready yet (attempt ${attempt + 1})`);
  }
  throw new Error('LPB portal did not load — still showing Device Checking');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * True when the page is on the real portal: the SSE endpoint returns
 * remaining-seconds and/or voucher codes.
 */
async function isPortalReady(page) {
  try {
    const state = await getState(page);
    return state.remaining_seconds != null || state.vouchers.length > 0;
  } catch {
    return false;
  }
}

/**
 * Reads current portal state (remaining seconds + voucher codes) via the SSE endpoint.
 */
async function getState(page) {
  const state = await page.evaluate(async (base) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${base}/admin/index?portaljs=1`, { signal: controller.signal });
      const body = await res.text();
      const gnr = body.match(/gnr\ndata: (\d+)/);
      const vouchers = [...body.matchAll(/applyvoucher\('([^']+)'/g)].map((m) => m[1]);
      return {
        remaining_seconds: gnr ? parseInt(gnr[1], 10) : null,
        vouchers,
      };
    } finally {
      clearTimeout(timer);
    }
  }, LPB_BASE);
  return state;
}

/**
 * Sends a single sconvert request from inside the page (same origin, cookies kept).
 * Returns the response text ("1" = success).
 */
async function sconvert(page, amountminutes) {
  return page.evaluate(async ({ base, amountminutes }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${base}/admin/index?sconvert=1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `amountminutes=${amountminutes}`,
        signal: controller.signal,
      });
      return res.text();
    } finally {
      clearTimeout(timer);
    }
  }, { base: LPB_BASE, amountminutes });
}

/**
 * Adds time using the negative-minute trick.
 * @param {number} days - days to add (negative value sent internally)
 */
async function addTime(page, days) {
  const minutes = -(days * 1440);
  console.log(`[lpb] Adding ${days} days (amountminutes=${minutes})...`);
  const result = await sconvert(page, minutes);
  if (result === '1') {
    console.log(`[lpb] Time added: +${days} days`);
    return { success: true, added_days: days };
  }
  throw new Error(`Add time failed — server responded: ${JSON.stringify(result)}`);
}

/**
 * Converts available time into vouchers.
 * @param {number} days - voucher duration in days (minutes = days * 1440)
 * @param {number} count - number of vouchers to generate
 */
async function convertToVouchers(page, days, count) {
  const minutesPerVoucher = days * 1440;
  console.log(`[lpb] Converting to ${count} voucher(s) of ${days} day(s) (${minutesPerVoucher} min each)...`);
  const created = [];
  for (let i = 1; i <= count; i++) {
    const result = await sconvert(page, minutesPerVoucher);
    if (result === '1') {
      created.push(minutesPerVoucher);
      if (i % 10 === 0 || i === count) {
        console.log(`[lpb] Generated ${i}/${count}`);
      }
    } else {
      console.log(`[lpb] Stop at voucher ${i} — response: ${JSON.stringify(result)}`);
      break;
    }
    await sleep(150);
  }
  if (!created.length) {
    throw new Error('No vouchers generated — not enough time or server rejected');
  }
  return { success: true, generated: created.length };
}

module.exports = { openPortal, getState, addTime, convertToVouchers };
