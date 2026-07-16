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

/**
 * Reports network scan results back to the Laravel API.
 *
 * POST /api/router/scan/results
 * Body: { log_id, wifi_name_2g, wifi_password_2g, ... }
 */
async function reportScanResults(logId, scanData) {
  const url = `${process.env.LARAVEL_API_URL}/router/scan/results`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LARAVEL_API_TOKEN}`,
      },
      body: JSON.stringify({ log_id: logId, ...scanData }),
    });

    if (!res.ok) {
      console.error(`[laravel-client] Scan results report failed: ${res.status} ${res.statusText}`);
    } else {
      console.log(`[laravel-client] Scan results posted for log #${logId}`);
    }
  } catch (err) {
    console.error('[laravel-client] Could not reach Laravel API for scan results:', err.message);
  }
}

/**
 * Reports password rotation status back to the Laravel API.
 *
 * POST /api/router/rotation/agent-report
 * Body: { credential_id, action, details }
 */
async function reportRotationStatus(credentialId, action, details = {}) {
  const url = `${process.env.LARAVEL_API_URL}/router/rotation/agent-report`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LARAVEL_API_TOKEN}`,
      },
      body: JSON.stringify({
        credential_id: credentialId,
        action,
        details,
      }),
    });

    if (!res.ok) {
      console.error(`[laravel-client] Rotation status report failed: ${res.status} ${res.statusText}`);
    } else {
      console.log(`[laravel-client] Rotation #${credentialId} → ${action}`);
    }
  } catch (err) {
    console.error('[laravel-client] Could not reach Laravel API for rotation status:', err.message);
  }
}

async function reportWifiPasswords(passwords) {
  const url = `${process.env.LARAVEL_API_URL}/scan/wifi-passwords`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LARAVEL_API_TOKEN}`,
      },
      body: JSON.stringify({ passwords }),
    });

    if (!res.ok) {
      console.error(`[laravel-client] WiFi passwords report failed: ${res.status} ${res.statusText}`);
    } else {
      console.log(`[laravel-client] WiFi passwords reported (${passwords.length} entries)`);
    }
  } catch (err) {
    console.error('[laravel-client] Could not reach Laravel API for WiFi passwords:', err.message);
  }
}

async function reportDiagnoseResult(logId, result) {
  const url = `${process.env.LARAVEL_API_URL}/scan/diagnose`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LARAVEL_API_TOKEN}`,
      },
      body: JSON.stringify({ log_id: logId, result }),
    });

    if (!res.ok) {
      console.error(`[laravel-client] Diagnose report failed: ${res.status} ${res.statusText}`);
    } else {
      console.log(`[laravel-client] Diagnose result reported`);
    }
  } catch (err) {
    console.error('[laravel-client] Could not reach Laravel API for diagnose:', err.message);
  }
}

module.exports = { reportStatus, reportScanResults, reportRotationStatus, reportWifiPasswords, reportDiagnoseResult };
