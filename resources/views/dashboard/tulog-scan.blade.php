<div class="page" id="page-tulog-scan">
    <div class="card card-full">
        <div class="card-title">
            Tulog Wifi Extender Scan
            <span class="badge badge-purple">WiFi Switch</span>
            <span class="badge badge-blue" id="tulogStatusBadge">Idle</span>
        </div>

        <div class="password-hint" style="margin-bottom:16px">
            The local agent temporarily disconnects this laptop from your current WiFi, connects to
            <code>Tulog Wifi Extender</code>, performs the vulnerability scan (beacon analysis, ARP sweep,
            gateway port scan, admin page probe), then reconnects to your original network.
            Only scan networks you own or are authorized to test.
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
            <div class="network-item">
                <div class="label">Target SSID</div>
                <div class="value" id="tulogTargetSsid">Tulog Wifi Extender</div>
            </div>
            <div class="network-item">
                <div class="label">Last Scan</div>
                <div class="value" id="tulogLastScan">--</div>
            </div>
        </div>

        <button class="btn-scan" id="btnTulogScan" onclick="tulogStartScan()" style="width:100%;justify-content:center;margin-bottom:20px">
            <span class="spinner"></span>
            <span class="btn-text">Scan Tulog Wifi Extender</span>
        </button>

        <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;margin-bottom:20px;display:none" id="tulogResultBox">
            <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:12px">&#128269; Scan Result</div>
            <div id="tulogResultContent"></div>
        </div>

        <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px">
            <div style="font-size:15px;font-weight:600;color:#f1f5f9;margin-bottom:12px">&#128196; Scan History</div>
            <div id="tulogHistoryList">
                <div class="wifi-scan-result">
                    <div class="wifi-info">
                        <div class="wifi-ssid">No scans yet</div>
                        <div class="wifi-pass">Trigger a scan above to populate history.</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    function tulogFetch(url, options = {}) {
        return fetch(`/api${url}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(options.headers || {})
            }
        });
    }

    function tulogSetBadge(text, className) {
        const b = document.getElementById('tulogStatusBadge');
        b.textContent = text;
        b.className = 'badge ' + (className || 'badge-blue');
    }

    async function tulogStartScan() {
        const btn = document.getElementById('btnTulogScan');
        const text = btn.querySelector('.btn-text');
        btn.disabled = true;
        text.textContent = 'Scanning (WiFi will switch — ~2-3 min)...';
        tulogSetBadge('Scanning', 'badge-yellow');
        document.getElementById('tulogResultBox').style.display = 'none';
        try {
            const res = await tulogFetch('/agent/tulog/scan', {
                method: 'POST',
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (!data.success) {
                tulogSetBadge('Failed', 'badge-red');
                showToast('Failed to dispatch tulog scan.', 'error');
            } else {
                showToast('Tulog scan dispatched to local agent. Results will appear shortly.');
                tulogPollResult(data.log_id);
            }
        } catch (err) {
            tulogSetBadge('Error', 'badge-red');
            showToast('Connection error: ' + err.message, 'error');
        }
        btn.disabled = false;
        text.textContent = 'Scan Tulog Wifi Extender';
    }

    function tulogPollResult(logId, attempts = 0) {
        if (attempts > 60) {
            tulogSetBadge('Timeout', 'badge-red');
            return;
        }
        setTimeout(async () => {
            try {
                const res = await tulogFetch('/agent/tulog/history');
                const data = await res.json();
                const list = data.data || [];
                const scan = list.find(s => String(s.log_id) === String(logId));
                if (scan) {
                    tulogRenderResult(scan);
                    tulogRenderHistory(list);
                    tulogSetBadge(scan.status.toUpperCase(), scan.status === 'completed' || scan.status === 'partial' ? 'badge-green' : 'badge-red');
                    return;
                }
                tulogPollResult(logId, attempts + 1);
            } catch (err) {
                tulogPollResult(logId, attempts + 1);
            }
        }, 5000);
    }

    function tulogRenderResult(scan) {
        const box = document.getElementById('tulogResultBox');
        box.style.display = 'block';
        document.getElementById('tulogLastScan').textContent = scan.created_at || '--';

        let html = '';
        const k = (label, val) => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1e293b">
            <span style="color:#94a3b8">${label}</span><span style="color:#e2e8f0;font-weight:600">${val}</span></div>`;

        html += k('Status', esc(scan.status));
        html += k('Connected', scan.connected ? 'YES' : 'NO');
        if (scan.bssid) html += k('BSSID', esc(scan.bssid));
        if (scan.signal != null) html += k('Signal', scan.signal + '%');
        if (scan.band) html += k('Band', esc(scan.band));
        if (scan.ip_address) html += k('IP Address', esc(scan.ip_address));
        if (scan.gateway) html += k('Gateway', esc(scan.gateway) + (scan.gateway_mac ? ' (' + esc(scan.gateway_mac) + ')' : ''));
        if (scan.error) html += k('Error', esc(scan.error));
        if (scan.duration_ms != null) html += k('Duration', (scan.duration_ms / 1000).toFixed(1) + 's');
        html += k('WiFi Restored', esc(scan.restore_status || 'n/a'));

        const ports = scan.ports_open || [];
        if (ports.length) {
            html += `<div style="margin-top:12px"><b style="color:#f1f5f9">Open Ports</b><div style="margin-top:6px">`;
            ports.forEach(p => { html += `<span class="badge badge-red" style="margin-right:6px">${esc(p)}</span>`; });
            html += `</div></div>`;
        }

        const probes = scan.http_probes || [];
        if (probes.length) {
            html += `<div style="margin-top:12px"><b style="color:#f1f5f9">HTTP Probes</b><div style="margin-top:6px">`;
            probes.forEach(p => { html += `<div class="password-hint">${esc(p.url)} → ${esc(p.status || p.error)} ${p.title ? '· ' + esc(p.title) : ''}</div>`; });
            html += `</div></div>`;
        }

        const devices = scan.devices_found || [];
        if (devices.length) {
            html += `<div style="margin-top:12px"><b style="color:#f1f5f9">Devices Found</b><div style="margin-top:6px">`;
            devices.forEach(d => { html += `<div class="password-hint">${esc(d.ip)}${d.mac ? ' (' + esc(d.mac) + ')' : ''}</div>`; });
            html += `</div></div>`;
        }

        const beacon = scan.beacon_analysis;
        if (beacon && beacon.security) {
            html += `<div style="margin-top:12px"><b style="color:#f1f5f9">Beacon Analysis</b>
                <div class="password-hint">Security: ${esc(beacon.security)} · Encryption: ${esc(beacon.encryption || 'n/a')}</div>
                <div class="password-hint">${beacon.risk === 'CRITICAL' ? '&#9888;&#65039; Open network — all traffic visible, anyone can join. Recommend WPA2/WPA3.' : 'Risk: ' + esc(beacon.risk)}</div></div>`;
        }

        document.getElementById('tulogResultContent').innerHTML = html;
    }

    function tulogRenderHistory(list) {
        const el = document.getElementById('tulogHistoryList');
        if (!list.length) {
            el.innerHTML = `<div class="wifi-scan-result"><div class="wifi-info">
                <div class="wifi-ssid">No scans yet</div><div class="wifi-pass">Trigger a scan above.</div></div></div>`;
            return;
        }
        let html = '';
        list.forEach(s => {
            const ok = s.status === 'completed' || s.status === 'partial';
            html += `<div class="wifi-scan-result">
                <div class="wifi-info">
                    <div class="wifi-ssid">${esc(s.target_ssid || 'Tulog Wifi Extender')}
                        <span class="badge ${ok ? 'badge-green' : 'badge-red'}" style="margin-left:8px">${esc(s.status)}</span></div>
                    <div class="wifi-pass">${esc(s.created_at || '')} · Gateway ${esc(s.gateway || 'n/a')} · Ports ${(s.ports_open || []).join(', ') || 'none'}${s.error ? ' · ' + esc(s.error) : ''}</div>
                </div>
            </div>`;
        });
        el.innerHTML = html;
    }

    async function tulogLoadHistory() {
        try {
            const res = await tulogFetch('/agent/tulog/history');
            const data = await res.json();
            tulogRenderHistory(data.data || []);
        } catch (err) {}
    }
    tulogLoadHistory();
</script>
