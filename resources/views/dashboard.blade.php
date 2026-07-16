<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Router Control Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; }

        /* Sidebar */
        .sidebar {
            width: 260px;
            min-width: 260px;
            background: #1e293b;
            border-right: 1px solid #334155;
            display: flex;
            flex-direction: column;
            height: 100vh;
            position: fixed;
            top: 0;
            left: 0;
            z-index: 100;
        }
        .sidebar-header {
            padding: 24px 20px;
            border-bottom: 1px solid #334155;
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .sidebar-header .icon {
            width: 40px;
            height: 40px;
            background: #2563eb;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
        }
        .sidebar-header h1 {
            font-size: 15px;
            font-weight: 700;
            color: #f8fafc;
            line-height: 1.3;
        }
        .sidebar-header p {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
        }

        .sidebar-nav {
            flex: 1;
            padding: 12px 10px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            overflow-y: auto;
        }
        .sidebar-nav-label {
            font-size: 10px;
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 16px 12px 6px;
        }
        .sidebar-nav-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 11px 14px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 500;
            color: #94a3b8;
            cursor: pointer;
            transition: all 0.15s;
            user-select: none;
            border: 1px solid transparent;
        }
        .sidebar-nav-item:hover {
            background: rgba(37,99,235,0.08);
            color: #e2e8f0;
        }
        .sidebar-nav-item.active {
            background: rgba(37,99,235,0.15);
            color: #60a5fa;
            border-color: rgba(37,99,235,0.25);
        }
        .sidebar-nav-item .nav-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
        }
        .nav-icon-reboot { background: #3b0764; }
        .nav-icon-session { background: #14532d; }
        .nav-icon-wifi-pass { background: #1e3a5f; }
        .nav-icon-network { background: #065f46; }
        .nav-icon-scanner { background: #422006; }
        .nav-icon-log { background: #1e293b; border: 1px solid #334155; }

        .sidebar-footer {
            padding: 16px 20px;
            border-top: 1px solid #334155;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #64748b;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #22c55e;
            animation: pulse 2s infinite;
        }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* Main content */
        .main {
            flex: 1;
            margin-left: 260px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .main-header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border-bottom: 1px solid #1e293b;
            padding: 20px 32px;
        }
        .main-header h2 {
            font-size: 20px;
            font-weight: 700;
            color: #f8fafc;
        }
        .main-header p {
            font-size: 13px;
            color: #64748b;
            margin-top: 4px;
        }

        .main-body {
            padding: 28px 32px;
            flex: 1;
        }

        /* Pages (hidden by default) */
        .page { display: none; }
        .page.active { display: block; }

        /* Cards */
        .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 16px;
            padding: 28px;
            max-width: 800px;
        }
        .card-full { max-width: 100%; }
        .card-title {
            font-size: 16px;
            font-weight: 600;
            color: #f1f5f9;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .badge {
            font-size: 11px;
            padding: 3px 10px;
            border-radius: 20px;
            font-weight: 500;
        }
        .badge-blue { background: #1e3a5f; color: #60a5fa; }
        .badge-green { background: #14532d; color: #4ade80; }
        .badge-red { background: #450a0a; color: #f87171; }
        .badge-yellow { background: #422006; color: #fbbf24; }
        .badge-purple { background: #3b0764; color: #c084fc; }

        /* Reboot */
        .reboot-zone { text-align: center; padding: 20px 0; }
        .reboot-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 36px;
            transition: transform 0.3s;
        }
        .reboot-icon:hover { transform: scale(1.05); }
        .reboot-desc { color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.6; }
        .btn-primary {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            border: none;
            padding: 12px 32px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37,99,235,0.3); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-reboot {
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            color: white;
            border: none;
            padding: 14px 40px;
            border-radius: 12px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-reboot:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(220,38,38,0.3); }
        .btn-reboot:active { transform: translateY(0); }
        .btn-reboot:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* Forms */
        .form-group { margin-bottom: 18px; }
        .form-group label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #94a3b8;
            margin-bottom: 6px;
        }
        .form-group input, .form-group select {
            width: 100%;
            padding: 12px 14px;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 10px;
            color: #f1f5f9;
            font-size: 14px;
            transition: border-color 0.2s;
        }
        .form-group input:focus, .form-group select:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
        }
        .form-group input::placeholder { color: #475569; }
        .password-hint { font-size: 11px; color: #64748b; margin-top: 4px; }
        .form-row { display: flex; gap: 16px; }
        .form-row .form-group { flex: 1; }

        /* Network Status */
        .network-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .network-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .network-item { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px; position: relative; }
        .network-item .label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .network-item .value { font-size: 15px; font-weight: 600; color: #f1f5f9; }
        .network-item .value.masked { color: #94a3b8; }
        .toggle-pass {
            position: absolute;
            top: 12px;
            right: 12px;
            background: transparent;
            border: 1px solid #334155;
            color: #94a3b8;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .toggle-pass:hover { border-color: #60a5fa; color: #60a5fa; }
        .network-meta { display: flex; gap: 24px; padding-top: 16px; border-top: 1px solid #334155; flex-wrap: wrap; }
        .network-meta-item { font-size: 13px; color: #94a3b8; }
        .network-meta-item span { color: #f1f5f9; font-weight: 600; }
        .status-connected { color: #4ade80; }
        .status-disconnected { color: #f87171; }
        .status-unknown { color: #fbbf24; }
        .btn-scan {
            background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .btn-scan:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(22,163,74,0.3); }
        .btn-scan:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-scan .spinner { display: none; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .btn-scan.loading .spinner { display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .no-data { color: #475569; font-style: italic; }

        /* WiFi Scanner */
        .wifi-scan-result {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 10px;
            margin-bottom: 8px;
        }
        .wifi-scan-result .band-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .band-24g { background: #1e3a5f; color: #60a5fa; }
        .band-5g { background: #3b0764; color: #c084fc; }
        .wifi-scan-result .wifi-info { flex: 1; }
        .wifi-scan-result .wifi-ssid { font-size: 14px; font-weight: 600; color: #f1f5f9; }
        .wifi-scan-result .wifi-pass { font-size: 13px; color: #94a3b8; margin-top: 2px; }
        .wifi-scan-result .wifi-meta { font-size: 11px; color: #64748b; margin-top: 4px; }
        .wifi-scan-result .wifi-actions { display: flex; gap: 6px; }
        .wifi-scan-result .wifi-actions button {
            background: transparent;
            border: 1px solid #334155;
            color: #94a3b8;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .wifi-scan-result .wifi-actions button:hover { border-color: #60a5fa; color: #60a5fa; }
        .wifi-history-time { font-size: 11px; color: #64748b; }

        /* Session */
        .session-active { background: #14532d; color: #4ade80; }
        .session-expired { background: #450a0a; color: #f87171; }
        .session-unknown { background: #422006; color: #fbbf24; }

        /* Activity Log */
        .log-table { width: 100%; border-collapse: collapse; }
        .log-table th { text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px; border-bottom: 1px solid #334155; }
        .log-table td { padding: 12px; font-size: 13px; border-bottom: 1px solid #1e293b; }
        .log-table tr:hover td { background: rgba(37,99,235,0.05); }
        .status { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; display: inline-block; }
        .status-pending { background: #422006; color: #fbbf24; }
        .status-success { background: #14532d; color: #4ade80; }
        .status-failed { background: #450a0a; color: #f87171; }
        .action-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; }
        .action-reboot { background: #3b0764; color: #c084fc; }
        .action-password { background: #1e3a5f; color: #60a5fa; }
        .action-scan { background: #14532d; color: #4ade80; }
        .empty-state { text-align: center; padding: 40px 0; color: #475569; font-size: 14px; }
        .log-pagination { display: flex; justify-content: center; align-items: center; gap: 16px; padding: 14px 0 4px; }
        .log-pagination button { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 6px 14px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
        .log-pagination button:hover:not(:disabled) { border-color: #60a5fa; color: #60a5fa; }
        .log-pagination button:disabled { opacity: 0.3; cursor: not-allowed; }
        .log-pagination span { font-size: 12px; color: #64748b; }

        /* Toast */
        .toast {
            position: fixed;
            top: 24px;
            right: 24px;
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            z-index: 999;
            transform: translateX(120%);
            transition: transform 0.3s ease;
        }
        .toast.show { transform: translateX(0); }
        .toast-success { background: #14532d; color: #4ade80; border: 1px solid #166534; }
        .toast-error { background: #450a0a; color: #f87171; border: 1px solid #991b1b; }

        @media (max-width: 768px) {
            .sidebar { display: none; }
            .main { margin-left: 0; }
            .main-body { padding: 16px; }
            .network-grid { grid-template-columns: 1fr; }
            .form-row { flex-direction: column; gap: 0; }
        }
    </style>
</head>
<body>

<div class="sidebar">
    <div class="sidebar-header">
        <div class="icon">&#9881;</div>
        <div>
            <h1>Router Control</h1>
            <p>Huawei HG8145X6-10</p>
        </div>
    </div>

    <div class="sidebar-nav">
        <div class="sidebar-nav-label">Router</div>
        <div class="sidebar-nav-item active" data-page="reboot" onclick="navigateTo('reboot')">
            <div class="nav-icon nav-icon-reboot">&#8635;</div>
            System Reboot
        </div>
        <div class="sidebar-nav-item" data-page="session" onclick="navigateTo('session')">
            <div class="nav-icon nav-icon-session">&#128274;</div>
            Router Session
        </div>
        <div class="sidebar-nav-item" data-page="wifi-pass" onclick="navigateTo('wifi-pass')">
            <div class="nav-icon nav-icon-wifi-pass">&#128190;</div>
            Wi-Fi Password
        </div>
        <div class="sidebar-nav-item" data-page="network" onclick="navigateTo('network')">
            <div class="nav-icon nav-icon-network">&#128246;</div>
            Network Status
        </div>

        <div class="sidebar-nav-label">Tools</div>
        <div class="sidebar-nav-item" data-page="scanner" onclick="navigateTo('scanner')">
            <div class="nav-icon nav-icon-scanner">&#128269;</div>
            WiFi Password Scanner
        </div>
        <div class="sidebar-nav-item" data-page="log" onclick="navigateTo('log')">
            <div class="nav-icon nav-icon-log">&#128196;</div>
            Activity Log
        </div>
    </div>

    <div class="sidebar-footer">
        <div class="status-dot" title="Agent Connected"></div>
        Agent Connected
    </div>
</div>

<div class="main">
    <div class="main-header">
        <h2 id="pageTitle">System Reboot</h2>
        <p id="pageSubtitle">Reboot your Huawei router remotely</p>
    </div>

    <div class="main-body">

        @include('dashboard.reboot')
        @include('dashboard.session')
        @include('dashboard.wifi-password')
        @include('dashboard.network')
        @include('dashboard.scanner')
        @include('dashboard.log')

    </div>
</div>

<div class="toast" id="toast"></div>

<script>
    const API_BASE = '/api';
    let logPage = 1;
    const logPerPage = 10;

    // --- Navigation ---
    const pageTitles = {
        'reboot':      ['System Reboot', 'Reboot your Huawei router remotely'],
        'session':     ['Router Session', 'View and check agent session status'],
        'wifi-pass':   ['Wi-Fi Password', 'Change the Wi-Fi password on both 2.4G and 5G'],
        'network':     ['Network Status', 'View connected devices and network info'],
        'scanner':     ['WiFi Password Scanner', 'Discover saved WiFi passwords from the router'],
        'log':         ['Activity Log', 'View all triggered actions and their status'],
    };

    function navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + page).classList.add('active');

        document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`.sidebar-nav-item[data-page="${page}"]`).classList.add('active');

        const title = pageTitles[page] || [page, ''];
        document.getElementById('pageTitle').textContent = title[0];
        document.getElementById('pageSubtitle').textContent = title[1];

        if (page === 'log') refreshLogs();
        if (page === 'network') refreshRouterStatus();
        if (page === 'scanner') loadWifiPasswords();
    }

    // --- Toast ---
    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast toast-${type} show`;
        setTimeout(() => toast.classList.remove('show'), 4000);
    }

    // --- Helpers ---
    function togglePassword(id) {
        const el = document.getElementById(id);
        if (el.tagName === 'INPUT') {
            el.type = el.type === 'password' ? 'text' : 'password';
            return;
        }
        const raw = el.dataset.raw;
        if (!raw) return;
        const visible = el.dataset.visible === 'true';
        el.textContent = visible ? '*'.repeat(Math.min(raw.length, 12)) : raw;
        el.dataset.visible = visible ? 'false' : 'true';
        el.classList.toggle('masked', visible);
    }

    function setLoading(btnId, loading) {
        const btn = document.getElementById(btnId);
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.textContent;
            btn.textContent = 'Dispatching...';
        } else {
            btn.disabled = false;
            btn.textContent = btn.dataset.originalText || btn.textContent;
        }
    }

    // --- Reboot ---
    async function triggerReboot() {
        if (!confirm('Are you sure you want to reboot the router?')) return;
        setLoading('btnReboot', true);
        try {
            const res = await fetch(`${API_BASE}/router/reboot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Reboot dispatched! (Log #${data.log_id})`);
                refreshLogs();
            } else {
                showToast('Failed to dispatch reboot.', 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        setLoading('btnReboot', false);
    }

    // --- Password Change ---
    async function triggerPasswordChange(e) {
        e.preventDefault();
        let pw = document.getElementById('newPassword').value;
        let cpw = document.getElementById('confirmPassword').value;
        if (pw !== cpw) {
            showToast('Passwords do not match!', 'error');
            return false;
        }
        if (!/[^a-zA-Z0-9]/.test(pw)) {
            pw = pw + '!';
            cpw = cpw + '!';
        }
        if (pw.length < 8) {
            showToast('Password must be at least 8 characters.', 'error');
            return false;
        }
        setLoading('btnSave', true);
        try {
            const res = await fetch(`${API_BASE}/router/password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ new_password: pw, new_password_confirmation: cpw })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Password change dispatched! (Log #${data.log_id})`);
                document.getElementById('passwordForm').reset();
                refreshLogs();
            } else {
                showToast(data.message || 'Validation failed.', 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        setLoading('btnSave', false);
        return false;
    }

    // --- Network Status ---
    async function refreshRouterStatus() {
        try {
            const res = await fetch(`${API_BASE}/router/status`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            const s = data.data;
            if (!s) return;

            const el = (id, val) => { document.getElementById(id).textContent = val || '--'; };
            el('ssid2g', s.wifi_name_2g);
            el('ssid5g', s.wifi_name_5g);

            const passEl2g = document.getElementById('pass2g');
            const passEl5g = document.getElementById('pass5g');
            passEl2g.textContent = s.wifi_password_2g ? '*'.repeat(Math.min(s.wifi_password_2g.length, 12)) : '--';
            passEl5g.textContent = s.wifi_password_5g ? '*'.repeat(Math.min(s.wifi_password_5g.length, 12)) : '--';
            passEl2g.dataset.raw = s.wifi_password_2g || '';
            passEl5g.dataset.raw = s.wifi_password_5g || '';
            passEl2g.dataset.visible = 'false';
            passEl5g.dataset.visible = 'false';

            const connEl = document.getElementById('connStatus');
            connEl.textContent = s.connection_status || 'Unknown';
            connEl.className = s.connection_status === 'connected' ? 'status-connected'
                : s.connection_status === 'disconnected' ? 'status-disconnected'
                : 'status-unknown';

            el('deviceCount', s.total_connected_devices);
            const lastScan = s.last_scanned_at ? new Date(s.last_scanned_at).toLocaleString() : 'Never';
            el('lastScan', lastScan);

            const badge = document.getElementById('scanBadge');
            if (s.last_scanned_at) {
                badge.textContent = 'Last scan: ' + lastScan;
                badge.className = 'badge badge-green';
            }
        } catch (err) {
            console.error('Failed to fetch router status:', err);
        }
    }

    async function triggerScan() {
        const btn = document.getElementById('btnScan');
        const btnText = btn.querySelector('.btn-text');
        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Scanning...';
        try {
            const res = await fetch(`${API_BASE}/router/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Scan dispatched! (Log #${data.log_id})`);
                refreshLogs();
                pollScanStatus(data.log_id);
            } else {
                showToast('Failed to dispatch scan.', 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = 'Scan Network';
    }

    let scanPollCount = 0;
    function pollScanStatus(logId) {
        scanPollCount = 0;
        const interval = setInterval(async () => {
            scanPollCount++;
            if (scanPollCount > 30) { clearInterval(interval); showToast('Scan timed out.', 'error'); return; }
            try {
                const res = await fetch(`${API_BASE}/router/logs`, { headers: { 'Accept': 'application/json' } });
                const data = await res.json();
                const log = data.data?.find(l => l.id === logId);
                if (log && log.status !== 'pending') {
                    clearInterval(interval);
                    if (log.status === 'success') {
                        showToast('Network scan completed!');
                        refreshRouterStatus();
                    } else {
                        showToast('Network scan failed. Check agent logs.', 'error');
                    }
                    refreshLogs();
                }
            } catch {}
        }, 2000);
    }

    // --- WiFi Password Scanner ---
    async function triggerWifiScan() {
        const username = document.getElementById('wifiScanUser').value.trim();
        const password = document.getElementById('wifiScanPass').value.trim();
        if (!username || !password) {
            showToast('Please enter both admin username and password.', 'error');
            return;
        }
        const btn = document.getElementById('btnWifiScan');
        const btnText = btn.querySelector('.btn-text');
        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Scanning...';
        document.getElementById('wifiScanBadge').textContent = 'Scanning...';
        document.getElementById('wifiScanBadge').className = 'badge badge-blue';
        try {
            const res = await fetch(`${API_BASE}/router/wifi-scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`WiFi password scan dispatched! (Log #${data.log_id})`);
                pollWifiScanStatus(data.log_id);
                refreshLogs();
            } else {
                showToast('Failed to dispatch WiFi scan.', 'error');
                document.getElementById('wifiScanBadge').textContent = 'Failed';
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
            document.getElementById('wifiScanBadge').textContent = 'Error';
        }
        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = 'Scan WiFi Passwords';
    }

    let wifiPollCount = 0;
    function pollWifiScanStatus(logId) {
        wifiPollCount = 0;
        const interval = setInterval(async () => {
            wifiPollCount++;
            if (wifiPollCount > 40) {
                clearInterval(interval);
                document.getElementById('wifiScanBadge').textContent = 'Timed out';
                showToast('WiFi scan timed out.', 'error');
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/router/logs`, { headers: { 'Accept': 'application/json' } });
                const data = await res.json();
                const log = data.data?.find(l => l.id === logId);
                if (log && log.status !== 'pending') {
                    clearInterval(interval);
                    if (log.status === 'success') {
                        showToast('WiFi password scan completed!');
                        document.getElementById('wifiScanBadge').textContent = 'Completed';
                        document.getElementById('wifiScanBadge').className = 'badge badge-green';
                        loadWifiPasswords();
                    } else {
                        showToast('WiFi scan failed. Check agent logs.', 'error');
                        document.getElementById('wifiScanBadge').textContent = 'Failed';
                    }
                    refreshLogs();
                }
            } catch {}
        }, 2000);
    }

    async function loadWifiPasswords() {
        try {
            const res = await fetch(`${API_BASE}/scan/wifi-passwords`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            const container = document.getElementById('wifiScanResults');
            const entries = data.data || [];
            if (!entries.length) {
                container.innerHTML = '<div class="empty-state">No WiFi passwords scanned yet. Click the scan button above.</div>';
                document.getElementById('wifiScanBadge').textContent = 'Not scanned';
                return;
            }
            const grouped = {};
            entries.forEach(e => {
                const key = e.scanned_at;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(e);
            });
            let html = '';
            Object.entries(grouped).forEach(([time, items]) => {
                html += `<div style="margin-bottom:16px">`;
                html += `<div class="wifi-history-time" style="margin-bottom:8px">Scanned: ${new Date(time).toLocaleString()}</div>`;
                items.forEach(item => {
                    const bandCls = item.band === '2.4G' ? 'band-24g' : 'band-5g';
                    const passId = `wifi-pass-${item.id}`;
                    const maskedPass = item.password ? '*'.repeat(Math.min(item.password.length, 16)) : 'N/A';
                    html += `
                    <div class="wifi-scan-result">
                        <span class="band-badge ${bandCls}">${item.band}</span>
                        <div class="wifi-info">
                            <div class="wifi-ssid">${item.ssid || 'Unknown SSID'}</div>
                            <div class="wifi-pass" id="${passId}" data-raw="${item.password || ''}" data-visible="false">${maskedPass}</div>
                            <div class="wifi-meta">
                                ${item.encryption ? 'Encryption: ' + item.encryption : ''}
                                ${item.authentication ? ' · Auth: ' + item.authentication : ''}
                                ${item.router_ip ? ' · Router: ' + item.router_ip : ''}
                            </div>
                        </div>
                        <div class="wifi-actions">
                            <button onclick="toggleWifiPass('${passId}')" title="Show/Hide">&#128065;</button>
                            <button onclick="copyWifiPass('${passId}')" title="Copy">&#128203;</button>
                        </div>
                    </div>`;
                });
                html += `</div>`;
            });
            container.innerHTML = html;
            document.getElementById('wifiScanBadge').textContent = `${entries.length} entries`;
            document.getElementById('wifiScanBadge').className = 'badge badge-green';
        } catch (err) {
            console.error('Failed to load WiFi passwords:', err);
        }
    }

    function toggleWifiPass(id) {
        const el = document.getElementById(id);
        const raw = el.dataset.raw;
        if (!raw) return;
        const visible = el.dataset.visible === 'true';
        el.textContent = visible ? '*'.repeat(Math.min(raw.length, 16)) : raw;
        el.dataset.visible = visible ? 'false' : 'true';
    }

    function copyWifiPass(id) {
        const el = document.getElementById(id);
        const raw = el.dataset.raw;
        if (!raw) return;
        navigator.clipboard.writeText(raw).then(() => showToast('Password copied!'));
    }

    // --- Activity Log ---
    async function refreshLogs() {
        try {
            const res = await fetch(`${API_BASE}/router/logs?page=${logPage}&per_page=${logPerPage}`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            const container = document.getElementById('logContainer');
            const countBadge = document.getElementById('logCount');
            const meta = data.meta || {};
            if (!data.data || data.data.length === 0) {
                container.innerHTML = '<div class="empty-state">No actions recorded yet.</div>';
                countBadge.textContent = '0 entries';
                return;
            }
            countBadge.textContent = `${meta.total || data.data.length} entries`;
            let html = `<table class="log-table">
                <thead><tr><th>ID</th><th>Action</th><th>Payload</th><th>Status</th><th>Triggered By</th><th>Time</th></tr></thead>
                <tbody>`;
            data.data.forEach(log => {
                const actionMap = {
                    reboot: { cls: 'action-reboot', label: 'Reboot' },
                    password_change: { cls: 'action-password', label: 'Password Change' },
                    scan: { cls: 'action-scan', label: 'Network Scan' },
                    wifi_password_scan: { cls: 'action-scan', label: 'WiFi Password Scan' },
                };
                const action = actionMap[log.action_type] || { cls: 'action-password', label: log.action_type };
                const payload = log.payload ? log.payload.substring(0, 20) + (log.payload.length > 20 ? '...' : '') : '---';
                const time = new Date(log.created_at).toLocaleString();
                html += `<tr>
                    <td>#${log.id}</td>
                    <td><span class="action-badge ${action.cls}">${action.label}</span></td>
                    <td style="color:#94a3b8">${payload}</td>
                    <td><span class="status status-${log.status}">${log.status}</span></td>
                    <td style="color:#94a3b8">${log.triggered_by}</td>
                    <td style="color:#64748b;font-size:12px">${time}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            const lastPage = meta.last_page || 1;
            if (lastPage > 1) {
                html += `<div class="log-pagination">
                    <button onclick="goLogPage(${logPage - 1})" ${logPage <= 1 ? 'disabled' : ''}>&#9664; Prev</button>
                    <span>Page ${logPage} of ${lastPage}</span>
                    <button onclick="goLogPage(${logPage + 1})" ${logPage >= lastPage ? 'disabled' : ''}>Next &#9654;</button>
                </div>`;
            }
            container.innerHTML = html;
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        }
    }

    function goLogPage(page) {
        logPage = page;
        refreshLogs();
    }

    // --- Session Status ---
    async function checkSessionStatus() {
        const btn = document.getElementById('btnCheckSession');
        if (!btn) return;
        const btnText = btn.querySelector('.btn-text');
        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Checking...';
        try {
            const res = await fetch(`${API_BASE}/router/session-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showToast('Session check dispatched — waiting for agent...');
                pollSessionStatus(data.log_id);
            } else {
                showToast('Failed to dispatch session check.', 'error');
                btn.disabled = false;
                btn.classList.remove('loading');
                btnText.textContent = 'Check Session';
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
            btn.disabled = false;
            btn.classList.remove('loading');
            btnText.textContent = 'Check Session';
        }
    }

    let sessionPollCount = 0;
    function pollSessionStatus(logId) {
        sessionPollCount = 0;
        const interval = setInterval(async () => {
            sessionPollCount++;
            if (sessionPollCount > 30) {
                clearInterval(interval);
                showToast('Session check timed out.', 'error');
                const btn = document.getElementById('btnCheckSession');
                btn.disabled = false;
                btn.classList.remove('loading');
                btn.querySelector('.btn-text').textContent = 'Check Session';
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/router/session-status`, {
                    headers: { 'Accept': 'application/json' }
                });
                const data = await res.json();
                const s = data.data;
                if (s.status !== 'unknown' && s.checked_at) {
                    clearInterval(interval);
                    updateSessionUI(s);
                    const btn = document.getElementById('btnCheckSession');
                    btn.disabled = false;
                    btn.classList.remove('loading');
                    btn.querySelector('.btn-text').textContent = 'Check Session';
                }
            } catch {}
        }, 2000);
    }

    function updateSessionUI(s) {
        const badge = document.getElementById('sessionBadge');
        const icon = document.getElementById('sessionIcon');
        const msg = document.getElementById('sessionMsg');
        const lastChecked = document.getElementById('sessionLastChecked');
        if (s.status === 'active') {
            badge.textContent = 'Active';
            badge.className = 'badge session-active';
            icon.textContent = '\u{1F513}';
            msg.textContent = 'Session is valid \u2014 login will be skipped for next action.';
            msg.style.color = '#4ade80';
        } else if (s.status === 'expired') {
            badge.textContent = 'Expired';
            badge.className = 'badge session-expired';
            icon.textContent = '\u{1F512}';
            msg.textContent = 'Session expired \u2014 agent will re-login on next action.';
            msg.style.color = '#f87171';
        } else {
            badge.textContent = 'Unknown';
            badge.className = 'badge session-unknown';
            icon.textContent = '\u{1F50D}';
            msg.textContent = 'No session data yet. Run an action first.';
            msg.style.color = '#fbbf24';
        }
        if (s.checked_at) lastChecked.textContent = new Date(s.checked_at).toLocaleString();
    }

    // --- Credential Pre-fill ---
    async function loadDefaultCredential() {
        try {
            const res = await fetch(`${API_BASE}/router/credential`, { headers: { 'Accept': 'application/json' } });
            const data = await res.json();
            if (data.data) {
                const userInput = document.getElementById('wifiScanUser');
                const passInput = document.getElementById('wifiScanPass');
                if (data.data.username) userInput.value = data.data.username;
                if (data.data.password) passInput.value = data.data.password;
            }
        } catch {}
    }

    // --- Init ---
    refreshRouterStatus();
    loadWifiPasswords();
    loadDefaultCredential();
    refreshLogs();
    setInterval(refreshLogs, 5000);
</script>

</body>
</html>
