@php
    $tools = $tools ?? 'all';
    $families = [
        'lpb' => ['label' => 'LPB Piso WiFi', 'pages' => ['lpb-piso', 'lpb-password']],
        'pldt' => ['label' => 'PLDT WiFi', 'pages' => ['scanner', 'password-scanner', 'log']],
        'adu' => ['label' => 'ADU Piso WiFi', 'pages' => ['adu-piso']],
    ];
    $pages = $tools === 'all' ? array_values(array_unique(array_merge(...array_column($families, 'pages')))) : ($families[$tools]['pages'] ?? []);
    $familyLabel = $tools === 'all' ? 'All tools' : ($families[$tools]['label'] ?? $tools);
    $defaultPage = $pages[0] ?? 'log';

    $nav = [
        'scanner' => ['&#128269;', 'Password Scanner Using Admin', 'nav-icon-scanner'],
        'password-scanner' => ['&#128477;', 'Password Scanner using adminpldt', 'nav-icon-password-scanner'],
        'log' => ['&#128196;', 'Activity Log', 'nav-icon-log'],
        'adu-piso' => ['&#9202;', 'ADU PISO WIFI TOOLS', 'nav-icon-adu'],
        'lpb-piso' => ['&#128176;', 'LPB Piso WiFi Model', 'nav-icon-lpb'],
        'lpb-password' => ['&#128273;', 'LPB Piso WiFi Password Model', 'nav-icon-lpb-pass'],
    ];

    $pageTitles = [
        'scanner' => ['Password Scanner Using Admin', 'Scan router config using adminpldt to decrypt WiFi passwords and crack admin hashes'],
        'password-scanner' => ['Password Scanner using adminpldt', 'Decrypt WiFi passwords from router config backup using adminpldt credentials'],
        'log' => ['Activity Log', 'View all triggered actions and their status'],
        'lpb-piso' => ['LPB Piso WiFi Model', 'Add time and convert to vouchers on LPB Piso WiFi'],
        'adu-piso' => ['ADU Piso WiFi Tools', 'Add time and convert vouchers on the ADU AdoPiSoft piso wifi'],
        'lpb-password' => ['LPB Piso WiFi Password Model', 'Admin credentials for LPB Piso WiFi, recovered via print.js SQL injection'],
    ];

    $pageView = [
    ];
@endphp
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
        .nav-icon-scanner { background: #422006; }
        .nav-icon-password-scanner { background: #4a1942; }
        .console-wrap { background:#0d1117; border:1px solid #30363d; border-radius:8px; overflow:hidden; }
        .console-header { background:#161b22; padding:8px 16px; border-bottom:1px solid #30363d; display:flex; align-items:center; gap:8px; }
        .console-label { color:#8b949e; font-size:11px; font-weight:600; text-transform:uppercase; }
        .console-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#3fb950; }
        .console-status { color:#8b949e; font-size:11px; }
        .console-body { padding:12px 16px; font-family:'Cascadia Code','Fira Code','Consolas',monospace; font-size:12px; line-height:1.6; color:#e6edf3; max-height:400px; overflow-y:auto; white-space:pre-wrap; word-break:break-all; }
        .console-dot-idle { background:#8b949e; animation:none !important; }
.nav-icon-log { background: #1e293b; border: 1px solid #334155; }
.nav-icon-lpb { background: #064e3b; }
.nav-icon-lpb-pass { background: #1e1b4b; }
.nav-icon-adu { background: #312e81; }

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
            .form-row { flex-direction: column; gap: 0; }
        }

        /* Mobile drawer */
        .hamburger {
            display: none;
            position: fixed;
            top: 14px;
            left: 14px;
            z-index: 300;
            background: #1e293b;
            border: 1px solid #334155;
            color: #e2e8f0;
            width: 42px;
            height: 42px;
            border-radius: 10px;
            font-size: 18px;
            cursor: pointer;
            align-items: center;
            justify-content: center;
        }
        .drawer-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(2, 6, 23, 0.7);
            z-index: 199;
        }
        .drawer-overlay.show { display: block; }
        .drawer-top {
            display: none;
            padding: 16px 20px;
            border-bottom: 1px solid #334155;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        .drawer-top .username { font-size: 13px; color: #94a3b8; word-break: break-all; }
        .drawer-top .btn-logout {
            background: #1e293b;
            border: 1px solid #334155;
            color: #94a3b8;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 12px;
            cursor: pointer;
            flex-shrink: 0;
        }
        .drawer-top .btn-logout:hover { border-color: #ef4444; color: #f87171; }
        .sidebar-close {
            display: none;
            position: absolute;
            top: 14px;
            right: 14px;
            background: transparent;
            border: 1px solid #334155;
            color: #94a3b8;
            width: 34px;
            height: 34px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
            z-index: 301;
        }
        @media (max-width: 768px) {
            .hamburger { display: flex; }
            .drawer-top { display: flex; }
            .sidebar-close { display: block; }
            .sidebar {
                display: flex;
                transform: translateX(-100%);
                transition: transform 0.25s ease;
                box-shadow: 4px 0 30px rgba(0,0,0,0.5);
                z-index: 200;
            }
            .sidebar.open { transform: translateX(0); }
            .main-header { padding: 16px 16px 16px 70px; }
        }
    </style>
</head>
<body>

<button class="hamburger" onclick="toggleDrawer(true)" title="Menu">&#9776;</button>

<div class="drawer-overlay" id="drawerOverlay" onclick="toggleDrawer(false)"></div>

<div class="sidebar" id="sidebar">
    <button class="sidebar-close" onclick="toggleDrawer(false)" title="Close">&#10005;</button>
    <div class="sidebar-header">
        <div class="icon">&#9881;</div>
        <div>
            <h1>{{ $familyLabel }}</h1>
            <p>{{ $tools === 'all' ? 'All tool families' : ($families[$tools]['pages'] ?? [] ? 'Select a tool below' : '') }}</p>
        </div>
    </div>

    <div class="drawer-top">
        <span class="username">{{ auth()->user()?->name ?? 'Guest' }} &lt;{{ auth()->user()?->email ?? '' }}&gt;</span>
        <a href="{{ url('/') }}" class="btn-logout">&#8592; All tools</a>
    </div>

    <div class="sidebar-nav">
        <div class="sidebar-nav-label">{{ $familyLabel }}</div>
        @foreach ($pages as $pg)
            <div class="sidebar-nav-item" data-page="{{ $pg }}" onclick="navigateTo('{{ $pg }}')">
                <div class="nav-icon {{ $nav[$pg][2] ?? 'nav-icon-log' }}">{!! $nav[$pg][0] ?? '&#128196;' !!}</div>
                {{ $nav[$pg][1] ?? $pg }}
            </div>
        @endforeach
    </div>

    <div class="sidebar-footer">
        <div class="status-dot" title="Agent Connected"></div>
        Agent Connected
    </div>
</div>

<div class="main">
    <div class="main-header">
        <h2 id="pageTitle">Router Control Dashboard</h2>
        <p id="pageSubtitle">Select a tool from the sidebar</p>
    </div>

    <div class="main-body">

        @if ($tools !== 'lpb')
        <div class="card card-full" style="margin-bottom:20px;padding:20px 24px;">
            <div class="card-title" style="margin-bottom:12px;">
                <span>&#128279;</span> Relay / Target URL
                <span class="badge badge-blue" id="relayStatus">Unknown</span>
            </div>
            <div class="form-row">
                <div class="form-group" style="margin-bottom:0;flex:3;">
                    <input id="relayUrl" placeholder="https://xxx.trycloudflare.com" />
                    <div class="password-hint">
                        @if ($tools === 'lpb' || $tools === 'adu')
                            Paste the tunnel URL from your phone (cloudflared) that exposes the piso portal @ 10.0.0.1.
                        @else
                            Paste the tunnel URL from your shop machine (cloudflared) that exposes the phone-agent relay, so the hosted site can reach the router @ 192.168.1.1. Run: <code>cloudflared tunnel --url http://127.0.0.1:8787</code> — bare URL, no path (the phone-agent serves its own root).
                        @endif
                    </div>
                </div>
                <div class="form-group" style="margin-bottom:0;flex:1;">
                    @if ($tools === 'pldt')
                        <button class="btn-secondary" id="btnRelayTest" onclick="testRelay()" style="margin-right:8px;">Test</button>
                    @endif
                    <button class="btn-primary" id="btnRelaySave" onclick="saveRelay()">Save target</button>
                </div>
            </div>
        </div>
        @endif

        @foreach ($pages as $pg)
            @include($pageView[$pg] ?? 'dashboard.' . $pg)
        @endforeach

    </div>
</div>

<div class="toast" id="toast"></div>

<script>
    const API_BASE = '/api';
    let logPage = 1;
    const logPerPage = 10;

    // Inject the CSRF token (Laravel's XSRF-TOKEN cookie) into every fetch call.
    (function () {
        const originalFetch = window.fetch;
        window.fetch = function (url, options) {
            options = options || {};
            options.headers = options.headers || {};
            if (!options.headers['X-XSRF-TOKEN']) {
                const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
                if (match) {
                    options.headers['X-XSRF-TOKEN'] = decodeURIComponent(match[1]);
                }
            }
            return originalFetch.call(this, url, options);
        };
    })();

    function toggleDrawer(open) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('drawerOverlay');
        sidebar.classList.toggle('open', open);
        overlay.classList.toggle('show', open);
    }

    function esc(s) {
        if (s == null) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(s)));
        return div.innerHTML;
    }

    // --- Navigation ---
    const FAMILY = @json($tools);
    const pageTitles = @json(array_intersect_key($pageTitles, array_flip($pages)));

    function navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + page).classList.add('active');

        document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`.sidebar-nav-item[data-page="${page}"]`).classList.add('active');

        const title = pageTitles[page] || [page, ''];
        document.getElementById('pageTitle').textContent = title[0];
        document.getElementById('pageSubtitle').textContent = title[1];

        toggleDrawer(false);

        if (page === 'log') refreshLogs();
        if (page === 'lpb-piso') lpbConnect();
        if (page === 'adu-piso') aduRefreshState();
    }

    // --- Relay / Target ---
    async function loadRelay() {
        try {
            const res = await fetch(`${API_BASE}/relay/${FAMILY}`, { headers: { 'Accept': 'application/json' } });
            const data = await res.json();
            const el = document.getElementById('relayUrl');
            const badge = document.getElementById('relayStatus');
            if (data.active) {
                el.value = data.url;
                badge.textContent = 'Active: ' + data.url.replace(/^https?:\/\//, '');
                badge.className = 'badge badge-green';
            } else {
                el.value = data.url;
                badge.textContent = 'Not set — using default';
                badge.className = 'badge badge-yellow';
            }
        } catch (err) {
            console.error('Relay load failed:', err);
        }
    }

    async function saveRelay() {
        const btn = document.getElementById('btnRelaySave');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
            const res = await fetch(`${API_BASE}/relay/${FAMILY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent((document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/) || [])[1] || '') },
                body: JSON.stringify({ url: document.getElementById('relayUrl').value.trim() })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Target saved.');
                loadRelay();
            } else {
                showToast(data.message || 'Failed to save target.', 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = 'Save target';
    }

    async function testRelay() {
        const btn = document.getElementById('btnRelayTest');
        const badge = document.getElementById('relayStatus');
        const url = document.getElementById('relayUrl').value.trim();
        if (!url) { showToast('Paste the tunnel URL first.', 'error'); return; }
        btn.disabled = true;
        btn.textContent = 'Testing...';
        badge.textContent = 'Testing tunnel...';
        badge.className = 'badge badge-blue';
        try {
            const res = await fetch(`${API_BASE}/router/relay-test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent((document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/) || [])[1] || '') },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            if (data.success) {
                badge.textContent = 'OK — router reachable';
                badge.className = 'badge badge-green';
                showToast(data.message || 'Tunnel works.');
            } else {
                badge.textContent = 'Test failed';
                badge.className = 'badge badge-red';
                showToast(data.message || 'Tunnel test failed.', 'error');
            }
        } catch (err) {
            badge.textContent = 'Test failed';
            badge.className = 'badge badge-red';
            showToast('Connection error: ' + err.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = 'Test';
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

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!')).catch(() => {});
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Copied to clipboard!');
        }
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

    // --- Password Scanner Using Admin ---
    async function triggerWifiScan() {
        const username = document.getElementById('wifiScanUser').value.trim();
        const password = document.getElementById('wifiScanPass').value.trim();
        if (!username || !password) {
            showToast('Please enter both admin username and password.', 'error');
            return;
        }
        const routerIp = '192.168.1.1';
        const btn = document.getElementById('btnWifiScan');
        const btnText = btn.querySelector('.btn-text');
        const results = document.getElementById('wifiScanResults');
        const badge = document.getElementById('wifiScanBadge');
        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Connecting...';
        badge.textContent = 'Connecting... please wait';
        badge.className = 'badge badge-blue';
        results.innerHTML = `
            <div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px">
                <div style="width:22px;height:22px;border:2px solid #334155;border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 10px"></div>
                Connecting to ${routerIp}...
            </div>`;

        let reachable = false;
        let ckMessage = '';
        try {
            const ck = await fetch(`${API_BASE}/router/check-connection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ router_ip: routerIp })
            });
            const ckData = await ck.json();
            reachable = !!ckData.success;
            ckMessage = ckData.message || '';
        } catch (err) {
            reachable = false;
        }

        if (!reachable) {
            badge.textContent = 'Not reachable';
            badge.className = 'badge badge-red';
            results.innerHTML = `<div class="empty-state">${esc(ckMessage || `Cannot reach ${routerIp}. If you are using the hosted site: check the Relay / Target URL (must be the bare tunnel URL, e.g. https://xxx.trycloudflare.com, no path) and that the relay + cloudflared are running on the shop machine.`)}</div>`;
            btn.disabled = false;
            btn.classList.remove('loading');
            btnText.textContent = 'Scan WiFi Passwords';
            return;
        }

        badge.textContent = 'Connected';
        badge.className = 'badge badge-green';
        btnText.textContent = 'Scanning...';
        results.innerHTML = `
            <div style="padding:24px;text-align:center;color:#94a3b8;font-size:13px">
                <div style="width:22px;height:22px;border:2px solid #334155;border-top-color:#22c55e;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 10px"></div>
                Connected to ${routerIp} &#10003; Logging in to router, skipping the password-change popup, and reading WiFi bands... this can take ~30 seconds.
            </div>`;
        try {
            const res = await fetch(`${API_BASE}/router/wifi-scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ username, password, router_ip: routerIp })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`WiFi password scan completed! (Log #${data.log_id})`);
                badge.textContent = `Completed · ${data.data.length} bands`;
                badge.className = 'badge badge-green';
                renderWifiScanResults(data.data || [], data.elapsed);
                refreshLogs();
            } else {
                badge.textContent = 'Failed';
                badge.className = 'badge badge-red';
                const detail = data.error ? ` <div style="margin-top:6px;font-family:monospace;font-size:11px;word-break:break-all">${esc(data.error)}</div>` : '';
                results.innerHTML = `<div class="empty-state">Scan failed. ${esc(data.message || 'Check that the admin credentials are correct and the router is reachable.')}${detail}</div>`;
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
            badge.textContent = 'Error';
            results.innerHTML = `<div class="empty-state">Connection error: ${esc(err.message)}</div>`;
        }
        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = 'Scan WiFi Passwords';
    }

    function renderWifiScanResults(entries, elapsed) {
        const container = document.getElementById('wifiScanResults');
        if (!entries.length) {
            container.innerHTML = '<div class="empty-state">Scan completed but no WiFi credentials were found.</div>';
            return;
        }
        let html = `<div class="wifi-history-time">Latest scan${elapsed ? ' · took ' + elapsed + 's' : ''}</div>`;
        entries.forEach(item => {
            const passId = 'wifi-pass-' + Math.random().toString(36).slice(2, 9);
            const maskedPass = item.password ? '*'.repeat(Math.min(item.password.length, 16)) : 'N/A';
            html += `
            <div class="wifi-scan-result">
                <span class="band-badge ${esc(item.band)}">${esc(item.band)}</span>
                <div class="wifi-info">
                    <div class="wifi-ssid">${esc(item.ssid || 'Unknown SSID')}</div>
                    <div class="wifi-pass" id="${passId}" data-raw="${esc(item.password || '')}" data-visible="false">${esc(maskedPass)}</div>
                    <div class="wifi-meta">
                        ${item.encryption ? 'Encryption: ' + esc(item.encryption) : ''}
                        ${item.authentication ? ' · Auth: ' + esc(item.authentication) : ''}
                        ${item.router_ip ? ' · Router: ' + esc(item.router_ip) : ''}
                    </div>
                </div>
                <div class="wifi-actions">
                    <button onclick="toggleWifiPass('${passId}')" title="Show/Hide">&#128065;</button>
                    <button onclick="copyWifiPass('${passId}')" title="Copy">&#128203;</button>
                </div>
            </div>`;
        });
        container.innerHTML = html;
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
                const a = actionMap[log.action_type] || { cls: 'action-password', label: esc(log.action_type) };
                const payload = log.payload ? esc(log.payload).substring(0, 20) + (esc(log.payload).length > 20 ? '...' : '') : '---';
                const time = new Date(log.created_at).toLocaleString();
                html += `<tr>
                    <td>#${log.id}</td>
                    <td><span class="action-badge ${a.cls}">${a.label}</span></td>
                    <td style="color:#94a3b8">${payload}</td>
                    <td><span class="status status-${esc(log.status)}">${esc(log.status)}</span></td>
                    <td style="color:#94a3b8">${esc(log.triggered_by)}</td>
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

    // --- Password Scanner using adminpldt ---
    function pskRenderCredential(label, value, color, badgeCls) {
        if (!value) return '';
        const id = 'psk-' + label.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        return `<div style="background:#0f172a;border:1px solid ${color};border-radius:10px;padding:14px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span class="band-badge ${badgeCls}">${esc(label)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
                <span style="color:#64748b;font-size:12px">Value:</span>
                <span style="color:${color};font-weight:600;font-family:monospace;word-break:break-all" id="${id}" data-raw="${esc(value)}" data-visible="false">${esc('*'.repeat(Math.min(value.length, 16)))}</span>
                <button onclick="togglePassword('${id}')" style="background:transparent;border:1px solid #334155;color:#94a3b8;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:11px;flex-shrink:0">&#128065;</button>
            </div>
        </div>`;
    }

    function pskRenderAdmin(admin) {
        const label = admin.username + (admin.service !== 'WebUI' ? ' (' + admin.service + ')' : '');
        const info = [];
        if (admin.passmode) info.push('PassMode=' + admin.passmode);
        if (admin.level !== undefined) info.push('Level=' + admin.level);
        if (admin.password_cracked) info.push('CRACKED!');
        const infoHtml = info.length ? '<span style="color:#64748b;font-size:11px;margin-left:8px">' + esc(info.join(' &middot; ')) + '</span>' : '';
        let html = `<div style="background:#0f172a;border:1px solid #4a1942;border-radius:10px;padding:14px;margin-bottom:8px">`;
        html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
            <span style="color:#e2e8f0;font-weight:600;font-size:13px">${esc(label)}</span>${infoHtml}</div>`;
        if (admin.password) {
            const id = 'psk-admin-' + admin.username + (admin.service || '');
            html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="color:#c084fc;font-weight:600;font-family:monospace;word-break:break-all;font-size:13px" id="${id}" data-raw="${esc(admin.password)}" data-visible="false">${esc('*'.repeat(Math.min(admin.password.length, 16)))}</span>
                <button onclick="togglePassword('${id}')" style="background:transparent;border:1px solid #334155;color:#94a3b8;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:11px;flex-shrink:0">&#128065;</button>
            </div>`;
        } else if (admin.password_hash) {
            const hashId = 'psk-hash-' + admin.username;
            html += `<div style="font-size:11px;color:#94a3b8;word-break:break-all;cursor:pointer" onclick="togglePassword('${hashId}')">
                Hash: <span id="${hashId}" data-raw="${esc(admin.password_hash)}" data-visible="false">${esc(admin.password_hash.substring(0, 16) + '...')}</span>
            </div>`;
        }
        html += `</div>`;
        return html;
    }

    async function triggerPskScan() {
        const username = document.getElementById('pskUsername').value.trim();
        const password = document.getElementById('pskPassword').value.trim();
        const routerIp = document.getElementById('pskRouterIp').value.trim() || '192.168.1.1';
        if (!username || !password) {
            showToast('Please enter both admin username and password.', 'error');
            return;
        }
        const btn = document.getElementById('btnPskScan');
        const btnText = btn.querySelector('.btn-text');
        const badge = document.getElementById('pskBadge');
        const statusDiv = document.getElementById('pskStatus');
        const statusText = document.getElementById('pskStatusText');
        const resultsDiv = document.getElementById('pskResults');

        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Downloading...';
        badge.textContent = 'Scanning';
        badge.className = 'badge badge-yellow';
        statusDiv.style.display = 'block';
        statusText.textContent = 'Launching browser and logging into router...';
        resultsDiv.innerHTML = '';

        try {
            const res = await fetch(`${API_BASE}/router/scan-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ username, password, router_ip: routerIp })
            });
            const data = await res.json();
            statusDiv.style.display = 'none';

            if (!data.success) {
                badge.textContent = 'Failed';
                badge.className = 'badge badge-red';
                resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                    <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; ${esc(data.message || 'Scan failed')}</div>
                    <div style="color:#94a3b8;font-size:12px">Raw: ${esc(data.raw_output || '')}</div>
                </div>`;
                showToast(data.message || 'Password scan failed.', 'error');
                btn.disabled = false;
                btn.classList.remove('loading');
                btnText.textContent = 'Get XML File';
                return;
            }

            const d = data.data;
            badge.textContent = 'Completed';
            badge.className = 'badge badge-green';

            let html = `<div style="margin-top:8px">`;
            html += `<div style="color:#94a3b8;font-size:12px;margin-bottom:12px">Decrypted in ${data.elapsed || 0}s</div>`;

            if (d.wifi) {
                html += `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px">
                    <div style="color:#f1f5f9;font-weight:600;margin-bottom:12px">&#128246; WiFi Passwords</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">`;
                if (d.wifi.password_24) html += pskRenderCredential('2.4GHz (' + esc(d.wifi.ssid_24 || '') + ')', d.wifi.password_24, '#60a5fa', 'band-24g');
                if (d.wifi.password_5g) html += pskRenderCredential('5GHz (' + esc(d.wifi.ssid_5g || '') + ')', d.wifi.password_5g, '#c084fc', 'band-5g');
                html += `</div></div>`;
            }

            if (d.admins && d.admins.length) {
                html += `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px">
                    <div style="color:#f1f5f9;font-weight:600;margin-bottom:12px">&#128274; Admin Credentials</div>`;
                d.admins.forEach(a => { html += pskRenderAdmin(a); });
                html += `<div style="color:#64748b;font-size:11px;margin-top:8px">* PassMode 3 hashes are SHA-256 of the password. PBKDF2 verification via IteratePassword is available for cracking.</div>`;
                html += `</div>`;
            }

            if (d.other_credentials && d.other_credentials.length) {
                html += `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px">
                    <div style="color:#f1f5f9;font-weight:600;margin-bottom:12px">&#128273; Other Service Credentials</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">`;
                d.other_credentials.forEach(o => {
                    const label = o.service + (o.username ? ' (' + esc(o.username) + ')' : '');
                    if (o.password) html += pskRenderCredential(label, o.password, '#94a3b8', '');
                });
                html += `</div></div>`;
            }

            html += `</div>`;
            resultsDiv.innerHTML = html;
            showToast('All credentials decrypted successfully!');
        } catch (err) {
            badge.textContent = 'Error';
            badge.className = 'badge badge-red';
            statusDiv.style.display = 'none';
            resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; Connection Error</div>
                <div style="color:#94a3b8;font-size:12px">${esc(err.message)}</div>
            </div>`;
            showToast('Connection error: ' + err.message, 'error');
        }

        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = 'Get XML File';
    }

    async function triggerConfigUpload() {
        const fileInput = document.getElementById('configFileInput');
        const file = fileInput.files[0];
        if (!file) { showToast('Please select an XML config file first.', 'error'); return; }

        const btn = document.getElementById('btnUploadScan');
        const btnText = btn.querySelector('.btn-text');
        const badge = document.getElementById('uploadBadge');
        const statusDiv = document.getElementById('uploadStatus');
        const statusText = document.getElementById('uploadStatusText');
        const resultsDiv = document.getElementById('uploadResults');

        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Scanning...';
        badge.textContent = 'Processing';
        badge.className = 'badge badge-yellow';
        statusDiv.style.display = 'block';
        statusText.textContent = 'Uploading and processing config file...';
        resultsDiv.innerHTML = '';

        try {
            const fd = new FormData();
            fd.append('config_file', file);

            const res = await fetch(`${API_BASE}/router/scan-config-file`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                body: fd
            });
            const data = await res.json();
            statusDiv.style.display = 'none';

            if (!data.success) {
                badge.textContent = 'Failed';
                badge.className = 'badge badge-red';
                resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                    <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; ${esc(data.message || 'Scan failed')}</div>
                    <div style="color:#94a3b8;font-size:12px">Raw: ${esc(data.raw_output || '')}</div>
                </div>`;
                showToast(data.message || 'Config file scan failed.', 'error');
                btn.disabled = false;
                btn.classList.remove('loading');
                btnText.textContent = 'Scan File';
                return;
            }

            const d = data.data;
            badge.textContent = 'Completed';
            badge.className = 'badge badge-green';

            let html = `<div style="margin-top:8px">`;
            html += `<div style="color:#94a3b8;font-size:12px;margin-bottom:12px">Processed in ${data.elapsed || 0}s</div>`;

            if (d.wifi) {
                html += `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px">
                    <div style="color:#f1f5f9;font-weight:600;margin-bottom:12px">&#128246; WiFi Passwords</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">`;
                if (d.wifi.password_24) html += pskRenderCredential('2.4GHz (' + esc(d.wifi.ssid_24 || '') + ')', d.wifi.password_24, '#60a5fa', 'band-24g');
                if (d.wifi.password_5g) html += pskRenderCredential('5GHz (' + esc(d.wifi.ssid_5g || '') + ')', d.wifi.password_5g, '#c084fc', 'band-5g');
                html += `</div></div>`;
            }

            if (d.admins && d.admins.length) {
                html += `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px">
                    <div style="color:#f1f5f9;font-weight:600;margin-bottom:12px">&#128274; Admin Credentials</div>`;
                d.admins.forEach(a => { html += pskRenderAdmin(a); });
                html += `<div style="color:#64748b;font-size:11px;margin-top:8px">* PassMode 3 hashes are SHA-256 of the password. PBKDF2 verification via IteratePassword is available for cracking.</div>`;
                html += `</div>`;
            }

            if (d.other_credentials && d.other_credentials.length) {
                html += `<div style="background:#1e293b;border:1px solid #334155;border-radius:12px;padding:16px;margin-bottom:16px">
                    <div style="color:#f1f5f9;font-weight:600;margin-bottom:12px">&#128273; Other Service Credentials</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">`;
                d.other_credentials.forEach(o => {
                    const label = o.service + (o.username ? ' (' + esc(o.username) + ')' : '');
                    if (o.password) html += pskRenderCredential(label, o.password, '#94a3b8', '');
                });
                html += `</div></div>`;
            }

            html += `</div>`;
            resultsDiv.innerHTML = html;
            showToast('Config file processed successfully!');
        } catch (err) {
            badge.textContent = 'Error';
            badge.className = 'badge badge-red';
            statusDiv.style.display = 'none';
            resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; Connection Error</div>
                <div style="color:#94a3b8;font-size:12px">${esc(err.message)}</div>
            </div>`;
            showToast('Connection error: ' + err.message, 'error');
        }

        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = 'Scan File';
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

    // --- Admin Credentials (Current) ---
    async function triggerTestAdminCred() {
        const routerIp = document.getElementById('adminCredRouterIp').value.trim() || '192.168.1.1';
        const username = 'admin';
        const password = 'Admin12345678';

        const btn = document.getElementById('btnTestAdminCred');
        const btnText = btn.querySelector('.btn-text');
        const badge = document.getElementById('adminCredBadge');
        const statusDiv = document.getElementById('adminCredStatus');
        const statusText = document.getElementById('adminCredStatusText');
        const resultsDiv = document.getElementById('adminCredResults');

        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Testing...';
        badge.textContent = 'Testing';
        badge.className = 'badge badge-yellow';
        statusDiv.style.display = 'block';
        statusText.textContent = 'Testing admin login on router...';
        resultsDiv.innerHTML = '';

        try {
            const res = await fetch(`${API_BASE}/router/test-credential`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ username, password, router_ip: routerIp })
            });
            const data = await res.json();
            statusDiv.style.display = 'none';

            if (!data.success) {
                badge.textContent = 'Failed';
                badge.className = 'badge badge-red';
                resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                    <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; ${esc(data.message || 'Login test failed')}</div>
                </div>`;
                showToast('Admin login test failed.', 'error');
            } else {
                badge.textContent = 'Verified';
                badge.className = 'badge badge-green';
                resultsDiv.innerHTML = `<div style="background:#0f3d0f;border:1px solid #166534;border-radius:8px;padding:16px;margin-top:8px">
                    <div style="color:#4ade80;font-weight:600;margin-bottom:4px">&#10003; Login successful as admin</div>
                    <div style="color:#94a3b8;font-size:12px">Post-login URL: ${esc(data.url || 'N/A')}</div>
                </div>`;
                showToast('Admin login verified!');
            }
        } catch (err) {
            badge.textContent = 'Error';
            badge.className = 'badge badge-red';
            statusDiv.style.display = 'none';
            resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; Connection Error</div>
                <div style="color:#94a3b8;font-size:12px">${esc(err.message)}</div>
            </div>`;
            showToast('Connection error: ' + err.message, 'error');
        }

        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = 'Test Login';
    }
    // --- Admin Change Password (Shows manual command) ---
    async function triggerChangeAdminPw() {
        const newPw = document.getElementById('adminNewPassword').value.trim();
        if (!newPw || newPw.length < 8) {
            showToast('Password must be at least 8 characters.', 'error');
            return;
        }
        const routerIp = document.getElementById('adminCredRouterIp').value.trim() || '192.168.1.1';

        const btn = document.getElementById('btnChangeAdminPw');
        const btnText = btn.querySelector('.btn-text');
        const badge = document.getElementById('adminCredBadge');
        const resultsDiv = document.getElementById('adminCredResults');
        const pwDisplay = document.getElementById('adminCredPassword');
        const consoleWrap = document.getElementById('adminCredConsoleWrap');
        const consoleEl = document.getElementById('adminCredConsole');
        const consoleStatus = document.getElementById('consoleStatus');
        const consoleDot = document.getElementById('consoleDot');

        btn.disabled = true;
        btnText.textContent = 'Launching...';
        badge.textContent = 'Launching';
        badge.className = 'badge badge-yellow';
        resultsDiv.innerHTML = '';
        consoleEl.innerHTML = '';
        consoleWrap.style.display = 'block';
        consoleStatus.textContent = 'Launching...';
        consoleDot.style.background = '#f0883e';

        const appendConsole = (text) => {
            consoleEl.innerHTML += esc(text) + '\n';
            consoleEl.scrollTop = consoleEl.scrollHeight;
        };

        appendConsole('Sending request to server...');

        try {
            const res = await fetch(`${API_BASE}/router/change-admin-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ password: newPw, router_ip: routerIp })
            });
            const data = await res.json();

            if (!data.success) {
                badge.textContent = 'Failed';
                badge.className = 'badge badge-red';
                consoleStatus.textContent = 'Failed';
                consoleDot.style.background = '#f85149';
                resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                    <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; ${esc(data.message || 'Failed')}</div>
                </div>`;
                appendConsole('❌ ' + (data.message || 'Failed'));
            } else {
                badge.textContent = `New: ${esc(newPw)}`;
                badge.className = 'badge badge-green';
                pwDisplay.textContent = newPw;
                pwDisplay.dataset.raw = newPw;
                pwDisplay.dataset.visible = 'true';

                appendConsole('✅ Terminal + browser launched on your desktop!');
                appendConsole('');
                appendConsole('📌 Look for:');
                appendConsole('   • Terminal window titled "CGI Password Reset"');
                appendConsole('   • Chromium browser opening the router admin page');
                appendConsole('');
                appendConsole(`🔑 New password: ${esc(newPw)}`);
                appendConsole('');
                appendConsole('⏳ The exploit runs automatically.');
                appendConsole('   Watch the browser to see each step.');

                resultsDiv.innerHTML = `<div style="background:#0f3d0f;border:1px solid #166534;border-radius:8px;padding:16px;margin-top:8px">
                    <div style="color:#4ade80;font-weight:600;margin-bottom:4px">&#10003; Terminal + browser opened on your desktop!</div>
                    <div style="color:#94a3b8;font-size:12px">
                        A terminal window titled <b>"CGI Password Reset"</b> is running on your Windows machine.<br>
                        A Chromium browser will open visibly — watch it perform the exploit live.<br>
                        <b>New password: ${esc(newPw)}</b>
                    </div>
                </div>`;
                showToast('Desktop terminal + browser launched!');
                consoleStatus.textContent = 'Running on desktop';
                consoleDot.style.background = '#3fb950';
            }
        } catch (err) {
            badge.textContent = 'Error';
            badge.className = 'badge badge-red';
            consoleStatus.textContent = 'Error';
            consoleDot.style.background = '#f85149';
            appendConsole('❌ Error: ' + err.message);
            resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; ${esc(err.message)}</div>
            </div>`;
        }

        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = 'Go';
    }

    // --- Restore Default Configuration ---
    async function triggerRestoreDefault() {
        const routerIp = document.getElementById('restoreRouterIp').value.trim() || '192.168.1.1';
        const username = document.getElementById('restoreUsername').value.trim();
        const password = document.getElementById('restorePassword').value.trim();
        if (!username || !password) {
            showToast('Please enter admin username and password.', 'error');
            return;
        }
        if (!confirm('WARNING: This will factory reset the router!\n\nAll settings (WiFi, admin password, config) will be lost.\nDevice will restart.\n\nAre you sure you want to continue?')) return;

        const btn = document.getElementById('btnRestoreDefault');
        const btnText = btn.querySelector('.btn-text');
        const badge = document.getElementById('restoreBadge');
        const statusDiv = document.getElementById('restoreStatus');
        const statusText = document.getElementById('restoreStatusText');
        const resultsDiv = document.getElementById('restoreResults');

        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Restoring...';
        badge.textContent = 'Restoring';
        badge.className = 'badge badge-red';
        statusDiv.style.display = 'block';
        statusText.textContent = 'Dispatching restore command to agent...';
        resultsDiv.innerHTML = '';

        try {
            const res = await fetch(`${API_BASE}/router/restore-default`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ username, password, router_ip: routerIp })
            });
            const data = await res.json();
            statusDiv.style.display = 'none';

            if (!data.success) {
                badge.textContent = 'Failed';
                badge.className = 'badge badge-red';
                resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                    <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; ${esc(data.message || 'Restore failed')}</div>
                </div>`;
                showToast('Restore default failed.', 'error');
            } else {
                badge.textContent = 'Dispatched';
                badge.className = 'badge badge-green';
                resultsDiv.innerHTML = `<div style="background:#0f3d0f;border:1px solid #166534;border-radius:8px;padding:16px;margin-top:8px">
                    <div style="color:#4ade80;font-weight:600;margin-bottom:4px">&#10003; Restore default command dispatched!</div>
                    <div style="color:#94a3b8;font-size:12px">Log #${data.log_id}. Agent will now log in as adminpldt and restore defaults. Router will reboot shortly.</div>
                </div>`;
                showToast('Restore default command sent!');
            }
        } catch (err) {
            badge.textContent = 'Error';
            badge.className = 'badge badge-red';
            statusDiv.style.display = 'none';
            resultsDiv.innerHTML = `<div style="background:#450a0a;border:1px solid #991b1b;border-radius:8px;padding:16px;margin-top:8px">
                <div style="color:#f87171;font-weight:600;margin-bottom:4px">&#10007; Connection Error</div>
                <div style="color:#94a3b8;font-size:12px">${esc(err.message)}</div>
            </div>`;
            showToast('Connection error: ' + err.message, 'error');
        }

        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = 'Restore Defaults';
    }

    // --- Init ---
    if (document.getElementById('relayUrl')) loadRelay();
    navigateTo('{{ $defaultPage }}');
    if (pageTitles['scanner']) {
        loadDefaultCredential();
    }
    if (pageTitles['log']) {
        refreshLogs();
        setInterval(refreshLogs, 5000);
    }
</script>

</body>
</html>
