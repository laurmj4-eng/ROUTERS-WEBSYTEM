<div class="page" id="page-scanner">
    <div class="card card-full">
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                Password Scanner Using Admin
                <span class="badge badge-blue" id="wifiScanBadge">Not scanned</span>
            </div>
            <button class="btn-scan" id="btnWifiScan" onclick="triggerWifiScan()">
                <span class="spinner"></span>
                <span class="btn-text">Scan WiFi Passwords</span>
            </button>
        </div>
        <p style="color:#64748b;font-size:13px;margin-bottom:16px">
            Scrape current WiFi SSID + password directly from the Huawei router admin panel.
        </p>
        <div class="form-row" style="margin-bottom:16px">
            <div class="form-group">
                <label>Admin Username</label>
                <input type="text" id="wifiScanUser" placeholder="e.g. admin" value="">
            </div>
            <div class="form-group" style="position:relative">
                <label>Admin Password</label>
                <input type="password" id="wifiScanPass" placeholder="Router admin password" value="">
                <button class="toggle-pass" onclick="togglePassword('wifiScanPass')" title="Show/Hide" style="top:32px">&#128065;</button>
            </div>
        </div>
        <div id="wifiScanResults">
            <div class="empty-state">Enter admin credentials and click "Scan WiFi Passwords" to discover saved credentials from the router.</div>
        </div>
    </div>

    <div class="card card-full" style="margin-top:16px">
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                Default Credential Scan
                <span class="badge" id="credScanBadge" style="background:#1e293b;color:#94a3b8">No scan yet</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <label style="display:flex;align-items:center;gap:4px;color:#94a3b8;font-size:12px;cursor:pointer">
                    <input type="checkbox" id="credReportOnly"> Report only
                </label>
                <button class="btn-scan" id="btnCredScan" onclick="triggerCredScan()">
                    <span class="spinner"></span>
                    <span class="btn-text">Scan Now</span>
                </button>
            </div>
        </div>
        <p style="color:#64748b;font-size:13px;margin-bottom:16px">
            Test for known default/hardcoded credentials on the router. Checks against a database of vendor-specific defaults.
        </p>
        <div id="credScanResults">
            <div class="empty-state">Click "Scan Now" to test for default credentials on the router.</div>
        </div>
    </div>

    <div class="card card-full" style="margin-top:16px">
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                Password Discovery
                <span class="badge" id="discoverBadge" style="background:#1e293b;color:#94a3b8">Not started</span>
            </div>
            <button class="btn-scan" id="btnDiscover" onclick="triggerDiscovery()">
                <span class="spinner"></span>
                <span class="btn-text">Discover Password</span>
            </button>
        </div>
        <p style="color:#64748b;font-size:13px;margin-bottom:16px">
            Brute-force discover the admin password using a dictionary attack. Uses lockout bypass to try passwords faster. Tests against a wordlist of common router passwords.
        </p>
        <div class="form-row" style="margin-bottom:16px">
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="discoverUser" placeholder="admin" value="admin">
            </div>
            <div class="form-group">
                <label>Max Attempts</label>
                <input type="number" id="discoverMaxAttempts" placeholder="500" value="500" min="1" max="2000">
            </div>
        </div>
        <div id="discoverProgress" style="display:none;margin-bottom:16px">
            <div style="background:#1e293b;border-radius:6px;padding:12px 16px">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                    <span style="color:#94a3b8;font-size:12px" id="discoverStatus">Starting...</span>
                    <span style="color:#94a3b8;font-size:12px" id="discoverCount">0/0</span>
                </div>
                <div style="background:#0f172a;border-radius:4px;height:8px;overflow:hidden">
                    <div id="discoverProgressBar" style="background:linear-gradient(90deg,#3b82f6,#8b5cf6);height:100%;width:0%;transition:width 0.3s"></div>
                </div>
                <div style="color:#64748b;font-size:11px;margin-top:8px" id="discoverLog">Waiting to start...</div>
            </div>
        </div>
        <div id="discoverResults">
            <div class="empty-state">Click "Discover Password" to start brute-forcing the admin password.</div>
        </div>
    </div>

    <script>
    let discoverPolling = null;

    function triggerDiscovery() {
        const btn = document.getElementById('btnDiscover');
        const badge = document.getElementById('discoverBadge');
        const resultsDiv = document.getElementById('discoverResults');
        const progressDiv = document.getElementById('discoverProgress');
        const progressBar = document.getElementById('discoverProgressBar');
        const statusEl = document.getElementById('discoverStatus');
        const countEl = document.getElementById('discoverCount');
        const logEl = document.getElementById('discoverLog');

        const username = document.getElementById('discoverUser').value || 'admin';
        const maxAttempts = document.getElementById('discoverMaxAttempts').value || 500;

        btn.classList.add('loading');
        btn.disabled = true;
        badge.textContent = 'Discovering...';
        badge.style.background = '#7c3aed';
        badge.style.color = '#fff';
        progressDiv.style.display = 'block';
        progressBar.style.width = '0%';
        statusEl.textContent = 'Launching browser...';
        countEl.textContent = '0/' + maxAttempts;
        logEl.textContent = 'Connecting to router...';
        resultsDiv.innerHTML = '';

        fetch('/api/credential-scan/discover', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                username: username,
                max_attempts: parseInt(maxAttempts),
            }),
        })
        .then(r => r.json())
        .then(json => {
            btn.classList.remove('loading');
            btn.disabled = false;

            if (!json.data) {
                badge.textContent = 'Error';
                badge.style.background = '#dc2626';
                badge.style.color = '#fff';
                statusEl.textContent = 'Error';
                logEl.textContent = json.message || 'Discovery failed';
                return;
            }

            const d = json.data;

            if (d.found_default && d.credential_type === 'discovered') {
                badge.textContent = 'PASSWORD FOUND';
                badge.style.background = '#16a34a';
                badge.style.color = '#fff';
                progressBar.style.width = '100%';
                progressBar.style.background = 'linear-gradient(90deg,#16a34a,#22c55e)';
                statusEl.textContent = 'PASSWORD FOUND!';
                countEl.textContent = d.credentials_tested + ' attempts';
                logEl.textContent = 'Password discovered in ' + (d.credentials_tested || 0) + ' attempts';

                resultsDiv.innerHTML = `
                    <div style="background:#052e16;border:1px solid #16a34a;border-radius:8px;padding:16px;margin-bottom:12px">
                        <div style="color:#86efac;font-weight:700;margin-bottom:8px">&#10003; PASSWORD DISCOVERED</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;color:#86efac;font-size:13px">
                            <div><span style="color:#4ade80">Model:</span> ${esc(d.router_model || 'Unknown')}</div>
                            <div><span style="color:#4ade80">Username:</span> ${esc(d.username || 'admin')}</div>
                            <div style="grid-column:span 2"><span style="color:#4ade80">Password:</span> <strong>${esc(d.password)}</strong></div>
                        </div>
                        <div style="color:#4ade80;font-size:12px;margin-top:8px">Found at attempt ${esc(d.credentials_tested)} of ${esc((d.candidates && d.candidates.total) || d.credentials_tested)}</div>
                    </div>`;
            } else {
                badge.textContent = 'Not found';
                badge.style.background = '#1e293b';
                badge.style.color = '#94a3b8';
                progressBar.style.width = '100%';
                progressBar.style.background = '#64748b';
                statusEl.textContent = 'Complete — not found';
                countEl.textContent = (d.credentials_tested || 0) + ' tested';
                logEl.textContent = 'Password not found in wordlist. Tried ' + (d.credentials_tested || 0) + ' passwords.';

                resultsDiv.innerHTML = `
                    <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px;color:#94a3b8;font-size:13px">
                        &#10003; Discovery complete — password not found in wordlist. Tested ${esc(d.credentials_tested || 0)} combinations.
                        Model: ${esc(d.router_model || 'Unknown')}
                    </div>`;
            }
        })
        .catch(err => {
            btn.classList.remove('loading');
            btn.disabled = false;
            badge.textContent = 'Error';
            badge.style.background = '#dc2626';
            badge.style.color = '#fff';
            statusEl.textContent = 'Error';
            logEl.textContent = err.message;
            resultsDiv.innerHTML = '<div class="empty-state" style="color:#ef4444">Network error: ' + esc(err.message) + '</div>';
        });
    }

    function triggerCredScan() {
        const btn = document.getElementById('btnCredScan');
        const badge = document.getElementById('credScanBadge');
        const resultsDiv = document.getElementById('credScanResults');
        const reportOnly = document.getElementById('credReportOnly').checked;

        btn.classList.add('loading');
        btn.disabled = true;
        badge.textContent = 'Scanning...';
        badge.style.background = '#1e293b';
        badge.style.color = '#facc15';
        resultsDiv.innerHTML = '<div class="empty-state" style="color:#facc15">Testing credential combinations against the router...</div>';

        fetch('/api/credential-scan/trigger', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({ report_only: reportOnly }),
        })
        .then(r => r.json())
        .then(json => {
            btn.classList.remove('loading');
            btn.disabled = false;

            if (!json.data) {
                badge.textContent = 'Error';
                badge.style.background = '#dc2626';
                badge.style.color = '#fff';
                resultsDiv.innerHTML = '<div class="empty-state" style="color:#ef4444">' + esc(json.message || 'Scan failed') + '</div>';
                return;
            }

            const d = json.data;
            if (d.found_default) {
                const isKnown = d.credential_type === 'known';
                badge.textContent = isKnown ? 'PASSWORD ACTIVE' : 'DEFAULT FOUND';
                badge.style.background = isKnown ? '#b45309' : '#dc2626';
                badge.style.color = '#fff';
                const label = isKnown ? 'Current admin password confirmed active' : 'Default credentials active on this router!';
                resultsDiv.innerHTML = `
                    <div style="background:${esc(isKnown ? '#451a0a' : '#451a1a')};border:1px solid ${esc(isKnown ? '#b45309' : '#dc2626')};border-radius:8px;padding:16px;margin-bottom:12px">
                        <div style="color:${esc(isKnown ? '#fcd34d' : '#fca5a5')};font-weight:700;margin-bottom:8px">&#9888; ${esc(label)}</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;color:${esc(isKnown ? '#fcd34d' : '#fca5a5')};font-size:13px">
                            <div><span style="color:${esc(isKnown ? '#fbbf24' : '#f87171')}">Model:</span> ${esc(d.router_model || 'Unknown')}</div>
                            <div><span style="color:${esc(isKnown ? '#fbbf24' : '#f87171')}">Vendor:</span> ${esc(d.vendor || 'N/A')}</div>
                            <div><span style="color:${esc(isKnown ? '#fbbf24' : '#f87171')}">Username:</span> ${esc(d.username)}</div>
                            <div><span style="color:${esc(isKnown ? '#fbbf24' : '#f87171')}">Password:</span> ${esc(d.password)}</div>
                        </div>
                        <div style="color:${esc(isKnown ? '#fbbf24' : '#f87171')};font-size:12px;margin-top:8px">Tested ${esc(d.credentials_tested)} combinations</div>
                    </div>`;
            } else if (d.simulated) {
                badge.textContent = 'Report only';
                badge.style.background = '#1e293b';
                badge.style.color = '#94a3b8';
                const candidates = d.candidates || [];
                let html = `<div style="color:#94a3b8;font-size:13px;margin-bottom:8px">Model: ${esc(d.router_model || 'Unknown')} — ${esc(candidates.length)} candidate credentials found (not tested)</div>`;
                if (candidates.length > 0) {
                    html += '<div style="background:#1e293b;border-radius:6px;padding:8px 12px;font-size:12px;color:#94a3b8">';
                    candidates.forEach(c => { html += '<div>' + esc(c.username) + ':' + esc(c.password) + '</div>'; });
                    html += '</div>';
                }
                resultsDiv.innerHTML = html;
            } else {
                badge.textContent = 'Secure';
                badge.style.background = '#166534';
                badge.style.color = '#86efac';
                resultsDiv.innerHTML = `
                    <div style="background:#14532d;border:1px solid #166534;border-radius:8px;padding:12px 16px;color:#86efac;font-size:13px">
                        &#10003; No default credentials found. Tested ${esc(d.credentials_tested || 0)} combinations.
                        Model: ${esc(d.router_model || 'Unknown')} &middot; Vendor: ${esc(d.vendor || 'N/A')}
                    </div>`;
            }
        })
        .catch(err => {
            btn.classList.remove('loading');
            btn.disabled = false;
            badge.textContent = 'Error';
            badge.style.background = '#dc2626';
            badge.style.color = '#fff';
            resultsDiv.innerHTML = '<div class="empty-state" style="color:#ef4444">Network error: ' + esc(err.message) + '</div>';
        });
    }

    // Load latest scan on page load
    fetch('/api/credential-scans/latest')
        .then(r => r.json())
        .then(json => {
            if (json.data && json.data.id) {
                const d = json.data;
                const badge = document.getElementById('credScanBadge');
                const resultsDiv = document.getElementById('credScanResults');
                const ago = new Date(d.created_at).toLocaleString();
                if (d.found_default) {
                    const isKnown = d.credential_type === 'known';
                    badge.textContent = isKnown ? 'PASSWORD ACTIVE' : 'DEFAULT FOUND';
                    badge.style.background = isKnown ? '#b45309' : '#dc2626';
                    badge.style.color = '#fff';
                    const label = isKnown ? 'Current admin password is active' : 'Last scan found default credentials';
                    resultsDiv.innerHTML = `
                        <div style="background:${esc(isKnown ? '#451a0a' : '#451a1a')};border:1px solid ${esc(isKnown ? '#b45309' : '#dc2626')};border-radius:8px;padding:16px">
                            <div style="color:${esc(isKnown ? '#fcd34d' : '#fca5a5')};font-weight:700;margin-bottom:4px">&#9888; ${esc(label)}</div>
                            <div style="color:${esc(isKnown ? '#fbbf24' : '#f87171')};font-size:13px">${esc(d.router_model || 'Unknown')} &middot; ${esc(d.vendor || 'N/A')} &middot; ${esc(d.username)}:${esc(d.password)}</div>
                            <div style="color:${esc(isKnown ? '#fbbf24' : '#f87171')};font-size:11px;margin-top:4px">${esc(ago)}</div>
                        </div>`;
                } else {
                    badge.textContent = 'Secure';
                    badge.style.background = '#166534';
                    badge.style.color = '#86efac';
                    resultsDiv.innerHTML = `<div class="empty-state" style="color:#86efac">Last scan: ${esc(ago)} — no defaults found (${esc(d.credentials_tested || 0)} tested)</div>`;
                }
            }
        })
        .catch(() => {});
    </script>
</div>

<div class="card card-full" style="margin-top:16px">
    <div class="network-header">
        <div class="card-title" style="margin-bottom:0">
            WiFi PSK Brute-Force
            <span class="badge" id="bfBadge" style="background:#1e293b;color:#94a3b8">Idle</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
            <button class="btn-scan" id="btnBfStart" onclick="startBruteForce()">
                <span class="spinner"></span>
                <span class="btn-text">Start Brute-Force</span>
            </button>
            <button class="btn-scan" id="btnBfStop" onclick="stopBruteForce()" style="background:#dc2626;display:none">
                <span class="btn-text">Stop</span>
            </button>
        </div>
    </div>
    <p style="color:#64748b;font-size:13px;margin-bottom:16px">
        Brute-force WiFi PSK passwords using Windows netsh. Tries each password by creating a temporary WiFi profile and attempting to connect. ~2.5s per attempt.
    </p>
    <div class="form-row" style="margin-bottom:16px">
        <div class="form-group">
            <label>Target SSID</label>
            <input type="text" id="bfSsid" placeholder="e.g. PLDTHOMEFIBRBd6BN" value="PLDTHOMEFIBRBd6BN">
        </div>
        <div class="form-group">
            <label>Wordlist</label>
            <select id="bfWordlist">
                <option value="pldtwifi_5k">PLDT WiFi 5K (PLDTWIFI + random)</option>
                <option value="pldt_built-in">PLDT Built-in (148 common)</option>
                <option value="custom">Custom file path...</option>
            </select>
        </div>
    </div>
    <div class="form-row" style="margin-bottom:16px;display:none" id="bfCustomRow">
        <div class="form-group" style="flex:1">
            <label>Custom Wordlist Path</label>
            <input type="text" id="bfCustomPath" placeholder="C:\path\to\wordlist.txt">
        </div>
    </div>

    <div id="bfProgress" style="display:none;margin-bottom:16px">
        <div style="background:#1e293b;border-radius:8px;padding:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="color:#94a3b8;font-size:13px" id="bfStatus">Starting...</span>
                <span style="color:#94a3b8;font-size:13px" id="bfCount">0/0</span>
            </div>
            <div style="background:#0f172a;border-radius:4px;height:12px;overflow:hidden;margin-bottom:12px">
                <div id="bfProgressBar" style="background:linear-gradient(90deg,#3b82f6,#06b6d4);height:100%;width:0%;transition:width 0.3s;border-radius:4px"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
                <div style="text-align:center">
                    <div style="color:#64748b;font-size:11px">Speed</div>
                    <div style="color:#e2e8f0;font-size:18px;font-weight:700" id="bfSpeed">0/min</div>
                </div>
                <div style="text-align:center">
                    <div style="color:#64748b;font-size:11px">Elapsed</div>
                    <div style="color:#e2e8f0;font-size:18px;font-weight:700" id="bfElapsed">0s</div>
                </div>
                <div style="text-align:center">
                    <div style="color:#64748b;font-size:11px">ETA</div>
                    <div style="color:#e2e8f0;font-size:18px;font-weight:700" id="bfEta">--</div>
                </div>
            </div>
            <div style="background:#0f172a;border-radius:4px;padding:8px 12px;font-family:monospace;font-size:12px;color:#94a3b8;max-height:120px;overflow-y:auto" id="bfLog">
                Waiting to start...
            </div>
        </div>
    </div>

    <div id="bfResults"></div>

    <script>
    let bfSessionId = null;
    let bfPolling = null;
    let bfChannel = null;

    document.getElementById('bfWordlist').addEventListener('change', function() {
        document.getElementById('bfCustomRow').style.display = this.value === 'custom' ? 'flex' : 'none';
    });

    function bfFormatTime(seconds) {
        if (seconds < 60) return seconds + 's';
        if (seconds < 3600) return Math.floor(seconds/60) + 'm ' + (seconds%60) + 's';
        return Math.floor(seconds/3600) + 'h ' + Math.floor((seconds%3600)/60) + 'm';
    }

    function bfAddLog(msg) {
        const log = document.getElementById('bfLog');
        const line = document.createElement('div');
        line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
        if (log.children.length > 100) log.removeChild(log.firstChild);
    }

    function startBruteForce() {
        const btnStart = document.getElementById('btnBfStart');
        const btnStop = document.getElementById('btnBfStop');
        const badge = document.getElementById('bfBadge');
        const progressDiv = document.getElementById('bfProgress');
        const resultsDiv = document.getElementById('bfResults');
        const logEl = document.getElementById('bfLog');
        const ssid = document.getElementById('bfSsid').value;
        const wordlist = document.getElementById('bfWordlist').value;

        if (!ssid) { showToast('Enter a target SSID', 'error'); return; }

        const body = { ssid: ssid };
        if (wordlist === 'custom') {
            body.wordlist = document.getElementById('bfCustomPath').value;
        } else {
            body.wordlist = wordlist;
        }

        btnStart.classList.add('loading');
        btnStart.disabled = true;
        badge.textContent = 'Starting...';
        badge.style.background = '#7c3aed';
        badge.style.color = '#fff';
        progressDiv.style.display = 'block';
        resultsDiv.innerHTML = '';
        logEl.innerHTML = '';
        document.getElementById('bfProgressBar').style.width = '0%';
        document.getElementById('bfStatus').textContent = 'Connecting to agent...';
        document.getElementById('bfCount').textContent = '0/0';
        document.getElementById('bfSpeed').textContent = '0/min';
        document.getElementById('bfElapsed').textContent = '0s';
        document.getElementById('bfEta').textContent = '--';
        bfAddLog('Sending brute-force command to agent...');

        fetch('/api/router/bruteforce/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify(body),
        })
        .then(r => r.json())
        .then(json => {
            bfSessionId = json.session_id;
            btnStart.classList.remove('loading');
            btnStart.style.display = 'none';
            btnStop.style.display = 'inline-flex';
            badge.textContent = 'Running';
            badge.style.background = '#3b82f6';
            badge.style.color = '#fff';
            document.getElementById('bfStatus').textContent = 'Brute-force started (session #' + bfSessionId + ')';
            bfAddLog('Agent received command. Session #' + bfSessionId);

            bfStartPolling(bfSessionId);
        })
        .catch(err => {
            btnStart.classList.remove('loading');
            btnStart.disabled = false;
            badge.textContent = 'Error';
            badge.style.background = '#dc2626';
            badge.style.color = '#fff';
            bfAddLog('Error: ' + err.message);
        });
    }

    function stopBruteForce() {
        if (!bfSessionId) return;
        fetch('/api/router/bruteforce/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            body: JSON.stringify({ session_id: bfSessionId }),
        }).then(() => {
            bfAddLog('Stop signal sent');
            document.getElementById('bfBadge').textContent = 'Stopping...';
        }).catch(err => bfAddLog('Stop error: ' + err.message));
    }

    function bfStartPolling(sessionId) {
        if (bfPolling) clearInterval(bfPolling);
        bfPolling = setInterval(() => {
            fetch('/api/router/bruteforce/status/' + sessionId)
                .then(r => r.json())
                .then(s => bfUpdateUI(s))
                .catch(() => {});
        }, 2000);
    }

    function bfUpdateUI(s) {
        const badge = document.getElementById('bfBadge');
        const progressBar = document.getElementById('bfProgressBar');
        const statusEl = document.getElementById('bfStatus');
        const countEl = document.getElementById('bfCount');
        const speedEl = document.getElementById('bfSpeed');
        const elapsedEl = document.getElementById('bfElapsed');
        const etaEl = document.getElementById('bfEta');
        const resultsDiv = document.getElementById('bfResults');
        const btnStart = document.getElementById('btnBfStart');
        const btnStop = document.getElementById('btnBfStop');

        const pct = s.percent || 0;
        progressBar.style.width = pct + '%';
        countEl.textContent = (s.current_index || 0) + '/' + (s.total || 0);
        speedEl.textContent = (s.speed_per_min || 0) + '/min';
        elapsedEl.textContent = bfFormatTime(s.elapsed_seconds || 0);
        etaEl.textContent = s.eta_minutes > 0 ? '~' + s.eta_minutes + 'min' : '--';

        if (s.current_password) {
            statusEl.textContent = 'Trying: ' + s.current_password;
            if (s.last_state !== 'auth_fail') bfAddLog(s.current_password + ' -> ' + s.last_state);
        }

        if (s.status === 'completed' || s.status === 'failed' || s.status === 'aborted') {
            clearInterval(bfPolling);
            bfPolling = null;
            btnStop.style.display = 'none';
            btnStart.style.display = 'inline-flex';
            btnStart.disabled = false;

            if (s.found_password) {
                badge.textContent = 'FOUND!';
                badge.style.background = '#16a34a';
                badge.style.color = '#fff';
                progressBar.style.background = 'linear-gradient(90deg,#16a34a,#22c55e)';
                bfAddLog('PASSWORD FOUND: ' + s.found_password);
                resultsDiv.innerHTML = `
                    <div style="background:#052e16;border:1px solid #16a34a;border-radius:8px;padding:16px;margin-top:8px">
                        <div style="color:#86efac;font-weight:700;margin-bottom:8px">PASSWORD FOUND</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;color:#86efac;font-size:13px">
                            <div><span style="color:#4ade80">Password:</span> <strong>${esc(s.found_password)}</strong></div>
                            <div><span style="color:#4ade80">IP:</span> ${esc(s.found_ip || 'N/A')}</div>
                            <div><span style="color:#4ade80">Attempts:</span> ${esc(s.current_index)}/${esc(s.total)}</div>
                            <div><span style="color:#4ade80">Time:</span> ${esc(bfFormatTime(s.elapsed_seconds))}</div>
                        </div>
                    </div>`;
            } else if (s.status === 'aborted') {
                badge.textContent = 'Stopped';
                badge.style.background = '#b45309';
                badge.style.color = '#fff';
                bfAddLog('Brute-force stopped by user');
                resultsDiv.innerHTML = '<div style="background:#451a0a;border:1px solid #b45309;border-radius:8px;padding:12px;color:#fcd34d;font-size:13px">Brute-force stopped at ' + esc(s.current_index || 0) + '/' + esc(s.total || 0) + '</div>';
            } else {
                badge.textContent = 'Not found';
                badge.style.background = '#64748b';
                badge.style.color = '#fff';
                bfAddLog('Password not found after ' + (s.total || 0) + ' attempts');
                resultsDiv.innerHTML = '<div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px;color:#94a3b8;font-size:13px">Password not found after ' + esc(s.total || 0) + ' attempts (' + esc(bfFormatTime(s.elapsed_seconds || 0)) + ')</div>';
            }
        }
    }
    </script>
</div>
