<div class="page" id="page-adu-piso">
    <div class="card card-full">
        <div class="card-title">
            ADU Piso WiFi Tools
            <span class="badge badge-purple">10.0.0.1</span>
            <span class="badge badge-blue" id="aduStatusBadge">Unknown</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-bottom:20px">
            <div class="network-item">
                <div class="label">Session Remaining</div>
                <div class="value" id="aduRemainingTime">--</div>
            </div>
            <div class="network-item">
                <div class="label">Session ID</div>
                <div class="value" id="aduSessionId">--</div>
            </div>
            <div class="network-item">
                <div class="label">Unused Vouchers</div>
                <div class="value" id="aduVoucherCount">0</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:16px">&#9202; Add Time</div>
                <div class="form-group">
                    <label>Session ID</label>
                    <input type="number" id="aduSessionIdInput" min="1" value="24484">
                </div>
                <div class="form-group">
                    <label>Seconds to Add</label>
                    <input type="number" id="aduSeconds" min="60" value="3600" placeholder="3600 = 1 hour">
                    <div class="password-hint">Quick: <a href="#" onclick="aduSetSeconds(3600);return false">+1h</a> &middot; <a href="#" onclick="aduSetSeconds(86400);return false">+1d</a> &middot; <a href="#" onclick="aduSetSeconds(432000);return false">+5d</a> &middot; <a href="#" onclick="aduSetSeconds(864000);return false">+10d</a> &middot; <a href="#" onclick="aduSetSeconds(8640000);return false">+100d</a></div>
                </div>
                <button class="btn-primary" id="btnAduAddTime" onclick="aduAddTime()" style="width:100%">Add Time</button>
                <div class="password-hint" style="margin-top:8px">Flips <code>install_wizard=false</code>, adds the seconds to the session via <code>updateSession(add_values)</code>, then flips it back automatically.</div>
            </div>

            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:16px">&#127973; Convert Voucher</div>
                <div class="form-group">
                    <label>Voucher</label>
                    <select id="aduVoucherSelect">
                        <option value="">-- load state first --</option>
                    </select>
                    <div class="password-hint">Only unused vouchers are listed.</div>
                </div>
                <div class="form-group">
                    <label>New Duration (days)</label>
                    <input type="number" id="aduVoucherDays" min="1" max="365" value="5">
                </div>
                <button class="btn-primary" id="btnAduConvert" onclick="aduConvert()" style="width:100%">Convert Voucher</button>
                <div class="password-hint" style="margin-top:8px">Rewrites the selected voucher's duration via <code>PUT /settings/vouchers/:id</code> (no admin session needed with the wizard flip).</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:16px">&#128196; Voucher Codes</div>
                <div style="max-height:300px;overflow-y:auto">
                    <div class="wifi-scan-result" style="display:none" id="aduNoVouchers">
                        <div class="wifi-info">
                            <div class="wifi-ssid">No vouchers</div>
                            <div class="wifi-pass">The customer account has no vouchers yet.</div>
                        </div>
                    </div>
                    <div id="aduVoucherList"></div>
                </div>
            </div>

            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:16px">&#128272; Admin Credentials</div>
                <button class="btn-primary" id="btnAduAdminPwd" onclick="aduGetAdminPassword()" style="width:100%">Get Admin Password</button>
                <div id="aduAdminResult" style="display:none;margin-top:12px">
                    <div class="password-hint">Username: <strong id="aduAdminUser"></strong></div>
                    <div class="password-hint">Password: <strong id="aduAdminPass"></strong> <a href="#" onclick="aduTogglePassword();return false" id="aduPwdToggle">show</a></div>
                    <button class="btn-scan" onclick="copyToClipboard(document.getElementById('aduAdminPass').textContent)" style="margin-top:8px;width:100%">Copy Password</button>
                </div>
                <div class="password-hint" style="margin-top:8px">Opens the install wizard, reads <code>/accounts/me</code>, restores it automatically.</div>
            </div>

            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:16px">&#128279; Connection</div>
                <div class="password-hint" style="margin-bottom:12px">Target is configured via <code>ADU_URL</code> env (default <code>http://10.0.0.1</code>). Customer session via <code>ADU_CUSTOMER_USER</code> / <code>ADU_CUSTOMER_PASS</code>, client device via <code>ADU_TMP_CLIENT_ID</code>.</div>
                <button class="btn-scan" id="btnAduConnect" onclick="aduRefreshState()" style="width:100%;justify-content:center">
                    <span class="spinner"></span>
                    <span class="btn-text">Refresh State</span>
                </button>
                <div class="password-hint" style="margin-top:8px">Must be reachable from this machine (connected to the ADU piso wifi network). Every action opens and closes the wizard by itself.</div>
            </div>
        </div>
    </div>
</div>

<script>
    let aduVouchers = [];

    function aduFetch(url, options = {}) {
        return fetch(`/api${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(options.headers || {})
            }
        });
    }

    function aduFormatTime(seconds) {
        if (seconds == null) return '--';
        const days = Math.floor(seconds / 86400);
        const hrs = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const parts = [];
        if (days) parts.push(days + ' d');
        if (hrs) parts.push(hrs + ' hr');
        if (mins) parts.push(mins + ' min');
        return parts.join(' ') || seconds + ' sec';
    }

    function aduSetSeconds(sec) {
        document.getElementById('aduSeconds').value = sec;
    }

    async function aduRefreshState() {
        const btn = document.getElementById('btnAduConnect');
        if (btn) {
            btn.disabled = true;
            btn.querySelector('.btn-text').textContent = 'Refreshing...';
        }
        document.getElementById('aduStatusBadge').textContent = 'Checking';
        document.getElementById('aduStatusBadge').className = 'badge badge-yellow';
        try {
            const res = await aduFetch('/adu/status');
            const data = await res.json();
            if (!data.success) {
                document.getElementById('aduStatusBadge').textContent = 'Unreachable';
                document.getElementById('aduStatusBadge').className = 'badge badge-red';
                showToast(data.message || 'Could not reach the ADU portal.', 'error');
                return;
            }
            document.getElementById('aduStatusBadge').textContent = 'Connected';
            document.getElementById('aduStatusBadge').className = 'badge badge-green';

            const sessions = Array.isArray(data.sessions) ? data.sessions : [];
            const session = sessions[0] || null;
            if (session) {
                document.getElementById('aduRemainingTime').textContent = aduFormatTime(session.remaining_time_seconds);
                document.getElementById('aduSessionId').textContent = session.id;
                document.getElementById('aduSessionIdInput').value = session.id;
            } else {
                document.getElementById('aduRemainingTime').textContent = '--';
                document.getElementById('aduSessionId').textContent = '--';
            }
            aduVouchers = data.vouchers || [];
            aduRenderVouchers();
            aduFillSelect();
        } catch (err) {
            document.getElementById('aduStatusBadge').textContent = 'Error';
            document.getElementById('aduStatusBadge').className = 'badge badge-red';
            showToast('Connection error: ' + err.message, 'error');
        }
        if (btn) {
            btn.disabled = false;
            btn.querySelector('.btn-text').textContent = 'Refresh State';
        }
    }

    function aduUnused() {
        return aduVouchers.filter(v => !v.session_id && !v.activated_at);
    }

    function aduRenderVouchers() {
        const container = document.getElementById('aduVoucherList');
        const noVouchers = document.getElementById('aduNoVouchers');
        if (!aduVouchers.length) {
            noVouchers.style.display = 'flex';
            container.innerHTML = '';
            return;
        }
        noVouchers.style.display = 'none';
        container.innerHTML = aduVouchers.map(v => {
            const used = v.session_id || v.activated_at;
            const duration = v.minutes ? v.minutes + ' min (' + (v.minutes / 1440).toFixed(1) + ' d)' : '--';
            return `
                <div class="wifi-scan-result">
                    <div class="wifi-info">
                        <div class="wifi-ssid">#${v.id} &middot; ${esc(v.code)} ${used ? '<span class="badge badge-red">used</span>' : '<span class="badge badge-green">unused</span>'}</div>
                        <div class="wifi-pass">${esc(duration)} &middot; ${esc(v.megabytes || 0)} MB &middot; ${v.allow_pause ? 'pause' : 'no-pause'}</div>
                    </div>
                    <div class="wifi-actions">
                        <button onclick="copyToClipboard('${esc(v.code)}')" title="Copy">&#128203;</button>
                    </div>
                </div>`;
        }).join('');
    }

    function aduFillSelect() {
        const sel = document.getElementById('aduVoucherSelect');
        const unused = aduUnused();
        sel.innerHTML = unused.length
            ? unused.map(v => `<option value="${v.id}">#${v.id} &middot; ${v.code} (${v.minutes ? Math.round(v.minutes / 1440) : 0} d)</option>`).join('')
            : '<option value="">-- no unused vouchers --</option>';
    }

    async function aduAddTime() {
        const sessionId = parseInt(document.getElementById('aduSessionIdInput').value);
        const seconds = parseInt(document.getElementById('aduSeconds').value);
        if (!sessionId || !seconds || seconds < 60) {
            showToast('Enter a valid session ID and at least 60 seconds.', 'error');
            return;
        }
        const btn = document.getElementById('btnAduAddTime');
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Adding...';
        try {
            const res = await aduFetch('/adu/add-time', {
                method: 'POST',
                body: JSON.stringify({ session_id: sessionId, seconds })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Added ${seconds} s to session ${sessionId}!`);
                document.getElementById('aduRemainingTime').textContent = aduFormatTime(data.session.remaining_time_seconds);
                document.getElementById('aduSessionId').textContent = sessionId;
            } else {
                showToast(data.message || 'Add-time failed.', 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = original;
    }

    async function aduConvert() {
        const voucherId = parseInt(document.getElementById('aduVoucherSelect').value);
        const days = parseInt(document.getElementById('aduVoucherDays').value);
        if (!voucherId || !days || days < 1) {
            showToast('Pick a voucher and enter a valid duration.', 'error');
            return;
        }
        const minutes = days * 1440;
        const btn = document.getElementById('btnAduConvert');
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Converting...';
        try {
            const res = await aduFetch('/adu/convert-voucher', {
                method: 'POST',
                body: JSON.stringify({ voucher_id: voucherId, minutes })
            });
            const data = await res.json();
            if (data.success) {
                const v = data.voucher;
                showToast(`Voucher ${v.code} is now ${Math.round(v.minutes / 1440)} days!`);
                aduRefreshState();
            } else {
                showToast(data.message || 'Conversion failed.', 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = original;
    }

    let aduAdminPassword = '';
    let aduAdminPasswordVisible = false;

    async function aduGetAdminPassword() {
        const btn = document.getElementById('btnAduAdminPwd');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Fetching...';
        }
        document.getElementById('aduAdminResult').style.display = 'none';
        try {
            const res = await aduFetch('/adu/admin-credentials');
            const data = await res.json();
            if (data.success && data.account) {
                aduAdminPassword = data.account.password || '';
                document.getElementById('aduAdminUser').textContent = data.account.username || '—';
                document.getElementById('aduAdminPass').textContent = '••••••';
                document.getElementById('aduAdminResult').style.display = 'block';
                aduAdminPasswordVisible = false;
                document.getElementById('aduPwdToggle').textContent = 'show';
                showToast('Admin credentials retrieved.');
            } else {
                showToast(data.message || 'Could not retrieve credentials.', 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Get Admin Password';
        }
    }

    function aduTogglePassword() {
        aduAdminPasswordVisible = !aduAdminPasswordVisible;
        const passEl = document.getElementById('aduAdminPass');
        const toggleEl = document.getElementById('aduPwdToggle');
        if (aduAdminPasswordVisible) {
            passEl.textContent = aduAdminPassword;
            toggleEl.textContent = 'hide';
        } else {
            passEl.textContent = '••••••';
            toggleEl.textContent = 'show';
        }
    }

    aduRefreshState();
    setInterval(aduRefreshState, 30000);
</script>
