/**
 * Reports the status of a router action back to the Laravel API.
 *
 * PATCH /api/router/log/{logId}/status
 * Body: { "status": "success" | "failed" }
 */
async function reportStatus(logId, status) {
  const url = `${process.env.LARAVEL_API_URL}/router/log/${logId}/status`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LARAVEL_API_TOKEN}`,
      },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      console.error(`[laravel-client] Status report failed: ${res.status} ${res.statusText}`);
    } else {
      console.log(`[laravel-client] Log #${logId} → ${status}`);
    }
  } catch (err) {
    console.error('[laravel-client] Could not reach Laravel API:', err.message);
  }
}

module.exports = { reportStatus };
