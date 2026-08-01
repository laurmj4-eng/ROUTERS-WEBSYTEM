<div class="page" id="page-lpb-piso">
    <div class="card card-full">
        <div class="card-title">
            LPB Piso WiFi Model
            <span class="badge badge-purple">10.0.0.1</span>
            <span class="badge badge-blue" id="lpbStatusBadge">Unknown</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
            <div class="network-item">
                <div class="label">Remaining Time</div>
                <div class="value" id="lpbRemainingTime">--</div>
            </div>
            <div class="network-item">
                <div class="label">Available Vouchers</div>
                <div class="value" id="lpbVoucherCount">0</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:16px">&#9203; Add Time</div>
                <div class="form-group">
                    <label>Days to Add</label>
                    <input type="number" id="lpbAddDays" min="1" value="500" placeholder="e.g. 500">
                </div>
                <button class="btn-primary" id="btnLpbAddTime" onclick="lpbAddTime()" style="width:100%">Add Time</button>
                <div class="password-hint" style="margin-top:8px">Uses the negative-minute trick via <code>sconvert</code>. 500 days = -720000 minutes.</div>
            </div>

            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:16px">&#127973; Convert to Vouchers</div>
                <div class="form-group">
                    <label>Voucher Duration (days)</label>
                    <input type="number" id="lpbVoucherDays" min="1" max="30" value="7">
                </div>
                <div class="form-group">
                    <label>Number of Vouchers</label>
                    <input type="number" id="lpbVoucherCountInput" min="1" value="1" placeholder="e.g. 5">
                </div>
                <button class="btn-primary" id="btnLpbConvert" onclick="lpbConvertToVouchers()" style="width:100%">Convert to Vouchers</button>
                <div class="password-hint" style="margin-top:8px">Converts your existing time into voucher codes. Each voucher = days x 1440 minutes.</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:16px">&#128279; Connection</div>
                <div class="password-hint" style="margin-bottom:12px">Target is configured on the local agent via <code>LPB_URL</code> env (default <code>http://10.0.0.1</code>). Operations are executed by the agent's Puppeteer browser.</div>
                <button class="btn-scan" id="btnLpbConnect" onclick="lpbConnect()" style="width:100%;justify-content:center">
                    <span class="btn-text">Connect</span>
                </button>
                <div class="password-hint" style="margin-top:8px">Only works from a browser that is already on the LPB WiFi network (same session cookies).</div>
            </div>

            <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
                <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:16px">&#128196; Voucher Codes</div>
                <div style="max-height:280px;overflow-y:auto">
                    <div class="wifi-scan-result" style="display:none" id="lpbNoVouchers">
                        <div class="wifi-info">
                            <div class="wifi-ssid">No vouchers yet</div>
                            <div class="wifi-pass">Convert time above to generate voucher codes.</div>
                        </div>
                    </div>
                    <div id="lpbVoucherList"></div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    let lpbVouchers = [];

    function lpbFetch(url, options = {}) {
        return fetch(`/api${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(options.headers || {})
            }
        });
    }

    async function lpbConnect() {
        const btn = document.getElementById('btnLpbConnect');
        const text = btn.querySelector('.btn-text');
        btn.disabled = true;
        text.textContent = 'Connecting...';
        document.getElementById('lpbStatusBadge').textContent = 'Connecting';
        document.getElementById('lpbStatusBadge').className = 'badge badge-yellow';
        try {
            const res = await lpbFetch('/lpb/trigger', {
                method: 'POST',
                body: JSON.stringify({ action: 'connect' })
            });
            const data = await res.json();
            if (data.success) {
                await lpbWaitForReport(data.log_id);
                document.getElementById('lpbStatusBadge').textContent = 'Connected';
                document.getElementById('lpbStatusBadge').className = 'badge badge-green';
                showToast('LPB portal opened by local agent!');
            } else {
                document.getElementById('lpbStatusBadge').textContent = 'Failed';
                document.getElementById('lpbStatusBadge').className = 'badge badge-red';
                showToast('Failed to dispatch connect to agent.', 'error');
            }
        } catch (err) {
            document.getElementById('lpbStatusBadge').textContent = 'Error';
            document.getElementById('lpbStatusBadge').className = 'badge badge-red';
            showToast('Connection error: ' + err.message, 'error');
        }
        btn.disabled = false;
        text.textContent = 'Connect';
    }

    async function lpbWaitForReport(logId, timeoutMs = 60000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const res = await lpbFetch('/lpb/state');
            const data = await res.json();
            const s = data.data || {};
            if (s.remaining_seconds != null && s.vouchers) {
                lpbApplyState(s);
                return true;
            }
            await new Promise(r => setTimeout(r, 1500));
        }
        showToast('Agent did not report back in time.', 'error');
        return false;
    }

    function lpbApplyState(s) {
        if (s.remaining_seconds != null) lpbUpdateTime(s.remaining_seconds);
        if (s.vouchers) lpbParseVouchers(s.vouchers);
    }

    function lpbUpdateTime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hrs = Math.floor((seconds % 86400) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        let parts = [];
        if (days) parts.push(days + ' d');
        if (hrs) parts.push(hrs + ' hr');
        if (mins) parts.push(mins + ' min');
        document.getElementById('lpbRemainingTime').textContent = parts.join(' ') || seconds + ' sec';
    }

    function lpbParseVouchers(vouchers) {
        if (vouchers && vouchers.length) {
            lpbVouchers = vouchers;
            document.getElementById('lpbVoucherCount').textContent = vouchers.length;
            renderLpbVouchers();
        } else {
            document.getElementById('lpbVoucherCount').textContent = '0';
            document.getElementById('lpbNoVouchers').style.display = 'flex';
            document.getElementById('lpbVoucherList').innerHTML = '';
        }
    }

    function renderLpbVouchers() {
        const container = document.getElementById('lpbVoucherList');
        const noVouchers = document.getElementById('lpbNoVouchers');
        if (!lpbVouchers.length) {
            noVouchers.style.display = 'flex';
            container.innerHTML = '';
            return;
        }
        noVouchers.style.display = 'none';
        container.innerHTML = lpbVouchers.map((code, i) => `
            <div class="wifi-scan-result">
                <div class="wifi-info">
                    <div class="wifi-ssid">${i + 1}. ${esc(code)}</div>
                </div>
                <div class="wifi-actions">
                    <button onclick="copyToClipboard('${esc(code)}')" title="Copy">&#128203;</button>
                </div>
            </div>
        `).join('');
    }

    async function lpbAddTime() {
        const days = parseInt(document.getElementById('lpbAddDays').value);
        if (!days || days < 1) {
            showToast('Enter a valid number of days.', 'error');
            return;
        }
        const btn = document.getElementById('btnLpbAddTime');
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Dispatching to agent...';
        try {
            const res = await lpbFetch('/lpb/trigger', {
                method: 'POST',
                body: JSON.stringify({ action: 'add_time', days })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Agent adding ${days} days...`);
                await lpbWaitForReport(data.log_id, 90000);
            } else {
                showToast('Failed to dispatch add-time to agent.', 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = original;
    }

    async function lpbConvertToVouchers() {
        const days = parseInt(document.getElementById('lpbVoucherDays').value);
        const count = parseInt(document.getElementById('lpbVoucherCountInput').value);
        if (!days || days < 1) {
            showToast('Enter a valid voucher duration.', 'error');
            return;
        }
        if (!count || count < 1) {
            showToast('Enter a valid number of vouchers.', 'error');
            return;
        }
        const btn = document.getElementById('btnLpbConvert');
        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Dispatching to agent...';
        try {
            const res = await lpbFetch('/lpb/trigger', {
                method: 'POST',
                body: JSON.stringify({ action: 'convert', days, count })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Agent converting ${count} x ${days}d vouchers...`);
                await lpbWaitForReport(data.log_id, 300000);
            } else {
                showToast('Failed to dispatch conversion to agent.', 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = original;
    }

    async function lpbRefreshState() {
        try {
            const res = await lpbFetch('/lpb/state');
            const data = await res.json();
            if (data.data && Object.keys(data.data).length) lpbApplyState(data.data);
        } catch (err) {
            console.error('Failed to refresh LPB state:', err);
        }
    }

    lpbRefreshState();
    setInterval(lpbRefreshState, 15000);
</script>
