<div class="page" id="page-scanner">
    <div class="card card-full">
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                WiFi Password Scanner
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
                            <div><span style="color:#4ade80">Model:</span> ${d.router_model || 'Unknown'}</div>
                            <div><span style="color:#4ade80">Username:</span> ${d.username || 'admin'}</div>
                            <div style="grid-column:span 2"><span style="color:#4ade80">Password:</span> <strong>${d.password}</strong></div>
                        </div>
                        <div style="color:#4ade80;font-size:12px;margin-top:8px">Found at attempt ${d.credentials_tested} of ${(d.candidates && d.candidates.total) || d.credentials_tested}</div>
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
                        &#10003; Discovery complete — password not found in wordlist. Tested ${(d.credentials_tested || 0)} combinations.
                        Model: ${d.router_model || 'Unknown'}
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
            resultsDiv.innerHTML = '<div class="empty-state" style="color:#ef4444">Network error: ' + err.message + '</div>';
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
                resultsDiv.innerHTML = '<div class="empty-state" style="color:#ef4444">' + (json.message || 'Scan failed') + '</div>';
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
                    <div style="background:${isKnown ? '#451a0a' : '#451a1a'};border:1px solid ${isKnown ? '#b45309' : '#dc2626'};border-radius:8px;padding:16px;margin-bottom:12px">
                        <div style="color:${isKnown ? '#fcd34d' : '#fca5a5'};font-weight:700;margin-bottom:8px">&#9888; ${label}</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;color:${isKnown ? '#fcd34d' : '#fca5a5'};font-size:13px">
                            <div><span style="color:${isKnown ? '#fbbf24' : '#f87171'}">Model:</span> ${d.router_model || 'Unknown'}</div>
                            <div><span style="color:${isKnown ? '#fbbf24' : '#f87171'}">Vendor:</span> ${d.vendor || 'N/A'}</div>
                            <div><span style="color:${isKnown ? '#fbbf24' : '#f87171'}">Username:</span> ${d.username}</div>
                            <div><span style="color:${isKnown ? '#fbbf24' : '#f87171'}">Password:</span> ${d.password}</div>
                        </div>
                        <div style="color:${isKnown ? '#fbbf24' : '#f87171'};font-size:12px;margin-top:8px">Tested ${d.credentials_tested} combinations</div>
                    </div>`;
            } else if (d.simulated) {
                badge.textContent = 'Report only';
                badge.style.background = '#1e293b';
                badge.style.color = '#94a3b8';
                const candidates = d.candidates || [];
                let html = `<div style="color:#94a3b8;font-size:13px;margin-bottom:8px">Model: ${d.router_model || 'Unknown'} — ${candidates.length} candidate credentials found (not tested)</div>`;
                if (candidates.length > 0) {
                    html += '<div style="background:#1e293b;border-radius:6px;padding:8px 12px;font-size:12px;color:#94a3b8">';
                    candidates.forEach(c => { html += '<div>' + c.username + ':' + c.password + '</div>'; });
                    html += '</div>';
                }
                resultsDiv.innerHTML = html;
            } else {
                badge.textContent = 'Secure';
                badge.style.background = '#166534';
                badge.style.color = '#86efac';
                resultsDiv.innerHTML = `
                    <div style="background:#14532d;border:1px solid #166534;border-radius:8px;padding:12px 16px;color:#86efac;font-size:13px">
                        &#10003; No default credentials found. Tested ${d.credentials_tested || 0} combinations.
                        Model: ${d.router_model || 'Unknown'} &middot; Vendor: ${d.vendor || 'N/A'}
                    </div>`;
            }
        })
        .catch(err => {
            btn.classList.remove('loading');
            btn.disabled = false;
            badge.textContent = 'Error';
            badge.style.background = '#dc2626';
            badge.style.color = '#fff';
            resultsDiv.innerHTML = '<div class="empty-state" style="color:#ef4444">Network error: ' + err.message + '</div>';
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
                        <div style="background:${isKnown ? '#451a0a' : '#451a1a'};border:1px solid ${isKnown ? '#b45309' : '#dc2626'};border-radius:8px;padding:16px">
                            <div style="color:${isKnown ? '#fcd34d' : '#fca5a5'};font-weight:700;margin-bottom:4px">&#9888; ${label}</div>
                            <div style="color:${isKnown ? '#fbbf24' : '#f87171'};font-size:13px">${d.router_model || 'Unknown'} &middot; ${d.vendor || 'N/A'} &middot; ${d.username}:${d.password}</div>
                            <div style="color:${isKnown ? '#fbbf24' : '#f87171'};font-size:11px;margin-top:4px">${ago}</div>
                        </div>`;
                } else {
                    badge.textContent = 'Secure';
                    badge.style.background = '#166534';
                    badge.style.color = '#86efac';
                    resultsDiv.innerHTML = `<div class="empty-state" style="color:#86efac">Last scan: ${ago} — no defaults found (${d.credentials_tested || 0} tested)</div>`;
                }
            }
        })
        .catch(() => {});
    </script>
</div>
