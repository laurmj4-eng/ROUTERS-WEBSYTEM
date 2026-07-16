<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Router Control Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }

        .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #1e293b; padding: 20px 32px; display: flex; align-items: center; gap: 16px; }
        .header .icon { width: 44px; height: 44px; background: #2563eb; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .header h1 { font-size: 22px; font-weight: 700; color: #f8fafc; }
        .header p { font-size: 13px; color: #64748b; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; display: inline-block; margin-left: auto; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

        .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; }
        .card-title { font-size: 16px; font-weight: 600; color: #f1f5f9; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
        .card-title .badge { font-size: 11px; padding: 3px 10px; border-radius: 20px; font-weight: 500; }
        .badge-blue { background: #1e3a5f; color: #60a5fa; }
        .badge-green { background: #14532d; color: #4ade80; }
        .badge-red { background: #450a0a; color: #f87171; }
        .badge-yellow { background: #422006; color: #fbbf24; }
        .badge-purple { background: #3b0764; color: #c084fc; }

        .full-width { grid-column: 1 / -1; }

        /* Reboot Card */
        .reboot-zone { text-align: center; padding: 20px 0; }
        .reboot-icon { width: 80px; height: 80px; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 36px; transition: transform 0.3s; }
        .reboot-icon:hover { transform: scale(1.05); }
        .reboot-desc { color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
        .btn-reboot { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; border: none; padding: 14px 40px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; letter-spacing: 0.3px; }
        .btn-reboot:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(220,38,38,0.3); }
        .btn-reboot:active { transform: translateY(0); }
        .btn-reboot:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        /* Password Card */
        .form-group { margin-bottom: 18px; }
        .form-group label { display: block; font-size: 13px; font-weight: 500; color: #94a3b8; margin-bottom: 6px; }
        .form-group input { width: 100%; padding: 12px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #f1f5f9; font-size: 14px; transition: border-color 0.2s; }
        .form-group input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
        .form-group input::placeholder { color: #475569; }
        .btn-save { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border: none; padding: 12px 32px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; width: 100%; }
        .btn-save:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(37,99,235,0.3); }
        .btn-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .password-hint { font-size: 11px; color: #64748b; margin-top: 4px; }

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

        /* Network Status Card */
        .network-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .network-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .network-item { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px; }
        .network-item .label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .network-item .value { font-size: 15px; font-weight: 600; color: #f1f5f9; }
        .network-item .value.masked { color: #94a3b8; }
        .network-item { position: relative; }
        .toggle-pass { position: absolute; top: 12px; right: 12px; background: transparent; border: 1px solid #334155; color: #94a3b8; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .toggle-pass:hover { border-color: #60a5fa; color: #60a5fa; }
        .network-meta { display: flex; gap: 24px; padding-top: 16px; border-top: 1px solid #334155; }
        .network-meta-item { font-size: 13px; color: #94a3b8; }
        .network-meta-item span { color: #f1f5f9; font-weight: 600; }
        .status-connected { color: #4ade80; }
        .status-disconnected { color: #f87171; }
        .status-unknown { color: #fbbf24; }
        .btn-scan { background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); color: white; border: none; padding: 10px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; }
        .btn-scan:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(22,163,74,0.3); }
        .btn-scan:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-scan .spinner { display: none; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
        .btn-scan.loading .spinner { display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .no-data { color: #475569; font-style: italic; }

        /* Network Security Scan Card */
        .severity-critical { background: #450a0a; color: #f87171; }
        .severity-high { background: #431407; color: #fb923c; }
        .severity-medium { background: #422006; color: #fbbf24; }
        .severity-low { background: #14532d; color: #4ade80; }
        .severity-info { background: #1e3a5f; color: #60a5fa; }
        .deviation-unknown_device { background: #450a0a; color: #f87171; }
        .deviation-missing_device { background: #422006; color: #fbbf24; }
        .deviation-ip_conflict { background: #431407; color: #fb923c; }
        .deviation-mac_changed { background: #1e3a5f; color: #60a5fa; }
        .deviation-wrong_subnet { background: #422006; color: #fbbf24; }
        .scan-progress { height: 3px; background: #334155; border-radius: 2px; margin: 12px 0; overflow: hidden; }
        .scan-progress-bar { height: 100%; background: linear-gradient(90deg, #2563eb, #7c3aed); width: 0%; transition: width 0.5s ease; }
        .finding-row { display: flex; align-items: center; gap: 12px; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; margin-bottom: 8px; }
        .finding-row .severity-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; white-space: nowrap; }
        .finding-row .finding-detail { flex: 1; }
        .finding-row .finding-title { font-size: 13px; font-weight: 600; color: #f1f5f9; }
        .finding-row .finding-meta { font-size: 11px; color: #64748b; margin-top: 2px; }

        /* WiFi Password Scanner */
        .wifi-scan-result { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; margin-bottom: 8px; }
        .wifi-scan-result .band-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .wifi-scan-result .band-24g { background: #1e3a5f; color: #60a5fa; }
        .wifi-scan-result .band-5g { background: #3b0764; color: #c084fc; }
        .wifi-scan-result .wifi-info { flex: 1; }
        .wifi-scan-result .wifi-ssid { font-size: 14px; font-weight: 600; color: #f1f5f9; }
        .wifi-scan-result .wifi-pass { font-size: 13px; color: #94a3b8; margin-top: 2px; }
        .wifi-scan-result .wifi-meta { font-size: 11px; color: #64748b; margin-top: 4px; }
        .wifi-scan-result .wifi-actions { display: flex; gap: 6px; }
        .wifi-scan-result .wifi-actions button { background: transparent; border: 1px solid #334155; color: #94a3b8; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .wifi-scan-result .wifi-actions button:hover { border-color: #60a5fa; color: #60a5fa; }
        .wifi-history-time { font-size: 11px; color: #64748b; }

        /* Toast */
        .toast { position: fixed; top: 24px; right: 24px; padding: 16px 24px; border-radius: 12px; font-size: 14px; font-weight: 500; z-index: 999; transform: translateX(120%); transition: transform 0.3s ease; }
        .toast.show { transform: translateX(0); }
        .toast-success { background: #14532d; color: #4ade80; border: 1px solid #166534; }
        .toast-error { background: #450a0a; color: #f87171; border: 1px solid #991b1b; }

        @media (max-width: 768px) {
            .container { grid-template-columns: 1fr; padding: 16px; }
        }
    </style>
</head>
<body>

<div class="header">
    <div class="icon">&#9881;</div>
    <div>
        <h1>Router Control Dashboard</h1>
        <p>Huawei HG8145X6-10 &middot; PLDT Home Fiber</p>
    </div>
    <span class="status-dot" title="Agent Connected"></span>
</div>

{{-- Dashboard Content --}}
<div id="dashboardContent" class="container">

    {{-- Reboot Card --}}
    <div class="card">
        <div class="card-title">
            System Reboot
            <span class="badge badge-blue">Puppeteer</span>
        </div>
        <div class="reboot-zone">
            <div class="reboot-icon">&#8635;</div>
            <p class="reboot-desc">
                Triggers a remote reboot of your router.<br>
                The local agent will automate the admin panel<br>
                to perform a system restart.
            </p>
            <button class="btn-reboot" id="btnReboot" onclick="triggerReboot()">
                Reboot Router
            </button>
        </div>
    </div>

    {{-- Password Change Card --}}
    <div class="card">
        <div class="card-title">
            Wi-Fi Password
            <span class="badge badge-green">2.4G + 5G</span>
        </div>
        <form id="passwordForm" onsubmit="return triggerPasswordChange(event)">
            <div class="form-group">
                <label>New Wi-Fi Password</label>
                <input type="password" id="newPassword" placeholder="Enter new password" required minlength="8" maxlength="63">
                <p class="password-hint">8-63 characters. The agent will update both 2.4G and 5G networks.</p>
            </div>
            <div class="form-group">
                <label>Confirm Password</label>
                <input type="password" id="confirmPassword" placeholder="Repeat new password" required minlength="8">
            </div>
            <button type="submit" class="btn-save" id="btnSave">
                Update Wi-Fi Password
            </button>
        </form>
    </div>

    {{-- Network Status Card --}}
    <div class="card full-width">
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                Network Status
                <span class="badge badge-green" id="scanBadge">Not scanned</span>
            </div>
            <button class="btn-scan" id="btnScan" onclick="triggerScan()">
                <span class="spinner"></span>
                <span class="btn-text">Scan Network</span>
            </button>
        </div>
        <div class="network-grid">
            <div class="network-item">
                <div class="label">2.4G Network Name</div>
                <div class="value" id="ssid2g"><span class="no-data">--</span></div>
            </div>
            <div class="network-item">
                <div class="label">2.4G Password</div>
                <div class="value masked" id="pass2g"><span class="no-data">--</span></div>
                <button class="toggle-pass" onclick="togglePassword('pass2g')" title="Show/Hide">&#128065;</button>
            </div>
            <div class="network-item">
                <div class="label">5G Network Name</div>
                <div class="value" id="ssid5g"><span class="no-data">--</span></div>
            </div>
            <div class="network-item">
                <div class="label">5G Password</div>
                <div class="value masked" id="pass5g"><span class="no-data">--</span></div>
                <button class="toggle-pass" onclick="togglePassword('pass5g')" title="Show/Hide">&#128065;</button>
            </div>
        </div>
        <div class="network-meta">
            <div class="network-meta-item">Connection: <span id="connStatus">Unknown</span></div>
            <div class="network-meta-item">Connected Devices: <span id="deviceCount">0</span></div>
            <div class="network-meta-item">Last Scan: <span id="lastScan">Never</span></div>
        </div>
    </div>

    {{-- WiFi Password Scanner --}}
    <div class="card full-width">
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
        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:140px;margin-bottom:0">
                <label>Admin Username</label>
                <input type="text" id="wifiScanUser" placeholder="e.g. admin" value="">
            </div>
            <div class="form-group" style="flex:1;min-width:140px;margin-bottom:0;position:relative">
                <label>Admin Password</label>
                <input type="password" id="wifiScanPass" placeholder="Router admin password" value="">
                <button class="toggle-pass" onclick="togglePassword('wifiScanPass')" title="Show/Hide" style="top:32px">&#128065;</button>
            </div>
        </div>
        <div id="wifiScanResults">
            <div class="empty-state">Enter admin credentials and click "Scan WiFi Passwords" to discover saved credentials from the router.</div>
        </div>
    </div>

    {{-- Network Diagnostic --}}
    <div class="card full-width">
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                Network Diagnostic
                <span class="badge badge-blue" id="diagBadge">Idle</span>
            </div>
            <button class="btn-scan" id="btnDiagnose" onclick="triggerDiagnose()">
                <span class="spinner"></span>
                <span class="btn-text">Run Diagnostic</span>
            </button>
        </div>
        <p style="color:#64748b;font-size:13px;margin-bottom:16px">
            Switch agent to TP-Link vendo WiFi, try to access 10.0.0.1, then report results.
        </p>
        <div id="diagResults">
            <div class="empty-state">Click "Run Diagnostic" to test connectivity to the TP-Link vendo.</div>
        </div>
    </div>

    {{-- Network Security Scan Card --}}
    <div class="card full-width">
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                Network Security Scan
                <span class="badge badge-blue" id="scanStatusBadge">Idle</span>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn-scan" id="btnPassiveScan" onclick="startPassiveScan()">
                    <span class="spinner"></span>
                    <span class="btn-text">Passive Scan</span>
                </button>
                <button class="btn-scan" id="btnFullScan" onclick="startFullScan()" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)">
                    <span class="spinner"></span>
                    <span class="btn-text">Full Audit</span>
                </button>
            </div>
        </div>

        {{-- Scan Summary Grid --}}
        <div class="network-grid" id="scanSummary">
            <div class="network-item">
                <div class="label">Devices Found</div>
                <div class="value" id="scanDeviceCount">--</div>
            </div>
            <div class="network-item">
                <div class="label">Critical Vulnerabilities</div>
                <div class="value" style="color:#f87171" id="scanCriticalCount">--</div>
            </div>
            <div class="network-item">
                <div class="label">Unknown Devices</div>
                <div class="value" style="color:#fbbf24" id="scanUnknownCount">--</div>
            </div>
            <div class="network-item">
                <div class="label">Missing Devices</div>
                <div class="value" style="color:#fb923c" id="scanMissingCount">--</div>
            </div>
        </div>

        <div class="network-meta">
            <div class="network-meta-item">Rate Limit: <span id="scanRateLimit">-- scans remaining</span></div>
        </div>

        {{-- Scan Progress --}}
        <div id="scanProgressSection" style="display:none">
            <div class="scan-progress">
                <div class="scan-progress-bar" id="scanProgressBar"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b">
                <span id="scanPhaseText">—</span>
                <span id="scanProgressText">0%</span>
            </div>
        </div>

        {{-- Vulnerability Findings Table --}}
        <div id="vulnerabilitySection" style="display:none">
            <div class="card-title" style="margin-top:24px;margin-bottom:12px">
                Vulnerability Findings
                <span class="badge" style="background:#450a0a;color:#f87171" id="vulnCountBadge">0</span>
            </div>
            <div id="vulnContainer"></div>
        </div>

        {{-- Topology Deviations --}}
        <div id="topologySection" style="display:none">
            <div class="card-title" style="margin-top:24px;margin-bottom:12px">
                Topology Deviations
                <span class="badge" style="background:#422006;color:#fbbf24" id="topoCountBadge">0</span>
            </div>
            <div id="topoContainer"></div>
        </div>

        {{-- Topology Upload --}}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155">
            <div class="card-title" style="margin-bottom:12px">Upload Topology Baseline</div>
            <form id="topoForm" onsubmit="return uploadTopology(event)" style="display:flex;gap:12px;align-items:flex-end">
                <div class="form-group" style="flex:1;margin-bottom:0">
                    <label>Baseline Name</label>
                    <input type="text" id="topoName" placeholder="e.g., home-network" required>
                </div>
                <div class="form-group" style="flex:2;margin-bottom:0">
                    <label>JSON or CSV File</label>
                    <input type="file" id="topoFile" accept=".json,.csv" required
                        style="padding:10px;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#f1f5f9;font-size:13px">
                </div>
                <button type="submit" class="btn-save" style="width:auto;padding:12px 24px" id="btnTopoUpload">Upload</button>
            </form>
            <div id="topoBaselines" style="margin-top:12px"></div>
        </div>

        {{-- Scheduled Scans --}}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155">
            <div class="card-title" style="margin-bottom:12px">Scheduled Scans</div>
            <form id="scheduleForm" onsubmit="return createSchedule(event)" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
                <div class="form-group" style="flex:1;min-width:150px;margin-bottom:0">
                    <label>Schedule Name</label>
                    <input type="text" id="schedName" placeholder="e.g., Daily Audit" required>
                </div>
                <div class="form-group" style="flex:1;min-width:120px;margin-bottom:0">
                    <label>Frequency</label>
                    <select id="schedFrequency" style="width:100%;padding:10px;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#f1f5f9;font-size:13px">
                        <option value="hourly">Hourly</option>
                        <option value="daily" selected>Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                    </select>
                </div>
                <button type="submit" class="btn-save" style="width:auto;padding:12px 24px">Create</button>
            </form>
            <div id="scheduleList" style="margin-top:12px"></div>
        </div>

        {{-- Admin Password Rotation --}}
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155">
            <div class="card-title" style="margin-bottom:12px">
                Admin Password Rotation
                <span class="badge badge-blue" id="rotationStatusBadge">Checking...</span>
            </div>
            <div class="network-grid" id="rotationSummary">
                <div class="network-item">
                    <div class="label">Rotation Count</div>
                    <div class="value" id="rotationCount">--</div>
                </div>
                <div class="network-item">
                    <div class="label">Last Rotated</div>
                    <div class="value" id="rotationLastAt">--</div>
                </div>
                <div class="network-item">
                    <div class="label">Next Scheduled</div>
                    <div class="value" id="rotationNextAt">--</div>
                </div>
                <div class="network-item">
                    <div class="label">Last Result</div>
                    <div class="value" id="rotationLastResult">--</div>
                </div>
            </div>
            <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn-scan" id="btnRotateNow" onclick="triggerRotation()" style="background:linear-gradient(135deg,#dc2626,#b91c1c)">
                    <span class="spinner"></span>
                    <span class="btn-text">Rotate Now</span>
                </button>
                <button class="btn-scan" id="btnRollback" onclick="triggerRollback()" style="background:linear-gradient(135deg,#f97316,#ea580c);display:none">
                    <span class="btn-text">Rollback</span>
                </button>
            </div>

            {{-- External Change Alert --}}
            <div id="externalChangeAlert" style="display:none;margin-top:16px;padding:16px;background:#450a0a;border:1px solid #991b1b;border-radius:12px">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                    <span style="color:#f87171;font-size:16px">&#9888;</span>
                    <span style="color:#f87171;font-weight:600;font-size:14px">External Password Change Detected</span>
                </div>
                <p style="color:#fca5a5;font-size:13px;margin-bottom:12px" id="externalChangeMsg">
                    The agent detected that the router admin password was changed externally.
                    Update the credentials below to restore agent access.
                </p>
                <form id="credUpdateForm" onsubmit="return updateCredentials(event)" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
                    <div class="form-group" style="flex:1;min-width:120px;margin-bottom:0">
                        <label>Username</label>
                        <input type="text" id="credUsername" value="admin" required>
                    </div>
                    <div class="form-group" style="flex:2;min-width:150px;margin-bottom:0">
                        <label>New Password</label>
                        <input type="password" id="credPassword" placeholder="Enter new admin password" required minlength="8">
                    </div>
                    <button type="submit" class="btn-save" style="width:auto;padding:12px 24px" id="btnUpdateCred">Update</button>
                </form>
            </div>
            <div id="rotationHistory" style="margin-top:12px"></div>
        </div>
    </div>

    {{-- Activity Log --}}
    <div class="card full-width">
        <div class="card-title">
            Activity Log
            <span class="badge badge-blue" id="logCount">0 entries</span>
        </div>
        <div id="logContainer">
            <div class="empty-state">No actions recorded yet. Trigger a reboot or password change to see activity here.</div>
        </div>
    </div>

</div>

{{-- Toast --}}
<div class="toast" id="toast"></div>

<script>
    const API_BASE = '/api';
    let eventSource = null;
    let logPage = 1;
    const logPerPage = 10;

    function showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast toast-${type} show`;
        setTimeout(() => toast.classList.remove('show'), 4000);
    }

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

    async function triggerReboot() {
        if (!confirm('Are you sure you want to reboot the router?')) return;
        setLoading('btnReboot', true);
        try {
            const res = await fetch(`${API_BASE}/router/reboot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                }
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

    async function triggerPasswordChange(e) {
        e.preventDefault();
        let pw = document.getElementById('newPassword').value;
        let cpw = document.getElementById('confirmPassword').value;
        if (pw !== cpw) {
            showToast('Passwords do not match!', 'error');
            return false;
        }

        // Automatically append '!' if the password lacks a special character
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
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ new_password: pw, new_password_confirmation: cpw })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Password change dispatched! (Log #${data.log_id})`);
                document.getElementById('passwordForm').reset();
                refreshLogs();
            } else {
                const msg = data.message || 'Validation failed.';
                showToast(msg, 'error');
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
        }
        setLoading('btnSave', false);
        return false;
    }

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
                showToast(`Scan dispatched! (Log #${data.log_id}) — waiting for results...`);
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
            if (scanPollCount > 30) {
                clearInterval(interval);
                showToast('Scan timed out. Check if the agent is running.', 'error');
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/router/logs`, { headers: { 'Accept': 'application/json' } });
                const data = await res.json();
                const log = data.data?.find(l => l.id === logId);
                if (log && log.status !== 'pending') {
                    clearInterval(interval);
                    if (log.status === 'success') {
                        showToast('Network scan completed successfully!');
                        refreshRouterStatus();
                    } else {
                        showToast('Network scan failed. Check agent logs.', 'error');
                    }
                    refreshLogs();
                }
            } catch {
                // keep polling
            }
        }, 2000);
    }

    async function refreshRouterStatus() {
        try {
            const res = await fetch(`${API_BASE}/router/status`, {
                headers: {
                    'Accept': 'application/json',
                }
            });
            const data = await res.json();
            const s = data.data;
            if (!s) return;

            const el = (id, val) => {
                document.getElementById(id).textContent = val || '--';
            };
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

    refreshLogs();
    refreshRouterStatus();
    setInterval(refreshLogs, 5000);
    setInterval(refreshRouterStatus, 10000);

    // --- Network Security Scan ---
    async function startPassiveScan() {
        await runScan({ scan_type: 'passive', sources: ['arp', 'dhcp'] });
    }

    async function startFullScan() {
        const fw = prompt('Enter firmware version (e.g., V300R015C10):');
        if (!fw) return;

        await runScan({
            scan_type: 'full',
            sources: ['arp', 'dhcp'],
            firmware_version: fw,
            vendor: 'huawei',
            product: 'hg8145x6',
        });
    }

    async function runScan(config) {
        const btn = document.getElementById(config.scan_type === 'full' ? 'btnFullScan' : 'btnPassiveScan');
        const btnText = btn.querySelector('.btn-text');
        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Scanning...';
        document.getElementById('scanStatusBadge').textContent = 'Queued...';
        document.getElementById('scanProgressSection').style.display = 'block';

        try {
            const res = await fetch(`${API_BASE}/scan/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(config),
            });
            const data = await res.json();

            if (data.success) {
                showToast('Scan queued! Connecting to progress stream...');
                connectSSE(data.session_id);
                refreshLogs();
            } else {
                showToast(data.message || 'Scan failed.', 'error');
                document.getElementById('scanStatusBadge').textContent = 'Failed';
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
            document.getElementById('scanStatusBadge').textContent = 'Error';
        }

        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = config.scan_type === 'full' ? 'Full Audit' : 'Passive Scan';
    }

    function renderScanResults(session) {
        const badge = document.getElementById('scanStatusBadge');
        badge.textContent = `Completed ${new Date(session.completed_at).toLocaleTimeString()}`;
        badge.className = 'badge badge-green';

        document.getElementById('scanDeviceCount').textContent = session.discovered_devices?.length || 0;

        const vulns = session.vulnerability_findings || [];
        const critical = vulns.filter(v => v.severity === 'critical').length;
        document.getElementById('scanCriticalCount').textContent = critical;

        const deviants = session.topology_deviations || [];
        document.getElementById('scanUnknownCount').textContent = deviants.filter(d => d.deviation_type === 'unknown_device').length;
        document.getElementById('scanMissingCount').textContent = deviants.filter(d => d.deviation_type === 'missing_device').length;

        // Render vulnerabilities
        const vulnSection = document.getElementById('vulnerabilitySection');
        const vulnContainer = document.getElementById('vulnContainer');
        if (vulns.length > 0) {
            vulnSection.style.display = 'block';
            document.getElementById('vulnCountBadge').textContent = vulns.length;
            vulnContainer.innerHTML = vulns.map(v => `
                <div class="finding-row">
                    <span class="severity-badge severity-${v.severity}">${v.severity}</span>
                    <div class="finding-detail">
                        <div class="finding-title">${v.cve_id} — ${v.description?.substring(0, 80) || 'No description'}</div>
                        <div class="finding-meta">CVSS ${v.cvss_score || 'N/A'} · ${v.affected_component} · ${v.source}</div>
                    </div>
                </div>
            `).join('');
        } else {
            vulnSection.style.display = 'none';
        }

        // Render topology deviations
        const topoSection = document.getElementById('topologySection');
        const topoContainer = document.getElementById('topoContainer');
        if (deviants.length > 0) {
            topoSection.style.display = 'block';
            document.getElementById('topoCountBadge').textContent = deviants.length;
            topoContainer.innerHTML = deviants.map(d => `
                <div class="finding-row">
                    <span class="severity-badge deviation-${d.deviation_type}">${d.deviation_type.replace('_', ' ')}</span>
                    <div class="finding-detail">
                        <div class="finding-title">${d.details?.message || d.deviation_type}</div>
                        <div class="finding-meta">${JSON.stringify(d.details?.device || d.details?.ip || '').substring(0, 80)}</div>
                    </div>
                </div>
            `).join('');
        } else {
            topoSection.style.display = 'none';
        }
    }

    // --- Topology Upload ---
    async function uploadTopology(e) {
        e.preventDefault();
        const name = document.getElementById('topoName').value;
        const file = document.getElementById('topoFile').files[0];
        if (!name || !file) return;

        const formData = new FormData();
        formData.append('name', name);
        formData.append('topology_file', file);

        const btn = document.getElementById('btnTopoUpload');
        btn.disabled = true;
        btn.textContent = 'Uploading...';

        try {
            const res = await fetch(`${API_BASE}/scan/topology/upload`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                },
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                showToast('Topology baseline uploaded!');
                document.getElementById('topoForm').reset();
                refreshBaselines();
            } else {
                showToast(data.message || 'Upload failed.', 'error');
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Upload';
        return false;
    }

    async function refreshBaselines() {
        try {
            const res = await fetch(`${API_BASE}/scan/topology/baselines`, {
                headers: {
                    'Accept': 'application/json',
                }
            });
            const data = await res.json();
            const container = document.getElementById('topoBaselines');
            if (!data.data?.length) {
                container.innerHTML = '<span style="color:#475569;font-size:12px">No baselines uploaded.</span>';
                return;
            }
            container.innerHTML = data.data.map(b => `
                <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;margin-bottom:6px;font-size:12px">
                    <span style="color:#f1f5f9;font-weight:600">${b.name}</span>
                    <span style="color:#64748b">${b.filename} · ${new Date(b.created_at).toLocaleDateString()}</span>
                </div>
            `).join('');
        } catch {}
    }

    // Auto-load dashboard data and baselines
    async function loadScanDashboard() {
        try {
            const res = await fetch(`${API_BASE}/scan/dashboard`, {
                headers: {
                    'Accept': 'application/json',
                }
            });
            const data = await res.json();
            if (data.data?.latest_scan) {
                renderScanResults(data.data.latest_scan);
            }
            if (data.data?.rate_limit) {
                document.getElementById('scanRateLimit').textContent = `${data.data.rate_limit.remaining} scans remaining`;
            }
        } catch {}
    }

    loadScanDashboard();
    refreshBaselines();

    // --- Dashboard Init ---
    function showDashboard() {
        document.getElementById('dashboardContent').style.display = 'block';
        refreshRouterStatus();
        loadScanDashboard();
        refreshBaselines();
        refreshSchedules();
    }

    function checkAuth() {
        showDashboard();
    }

    // --- SSE Progress Streaming ---
    function connectSSE(sessionId) {
        if (eventSource) {
            eventSource.close();
        }

        const progressSection = document.getElementById('scanProgressSection');
        const progressBar = document.getElementById('scanProgressBar');
        const progressText = document.getElementById('scanProgressText');
        const phaseText = document.getElementById('scanPhaseText');
        const badge = document.getElementById('scanStatusBadge');

        progressSection.style.display = 'block';
        badge.textContent = 'Connecting...';
        badge.className = 'badge badge-blue';

        eventSource = new EventSource(`${API_BASE}/scan/${sessionId}/stream`);

        eventSource.addEventListener('connected', (e) => {
            const data = JSON.parse(e.data);
            badge.textContent = 'Running';
            updateProgressUI(data.progress, data.status);
        });

        eventSource.addEventListener('progress', (e) => {
            const data = JSON.parse(e.data);
            updateProgressUI(data.progress, data.status);
            if (data.current_phase) {
                phaseText.textContent = data.current_phase.replace('_', ' ').toUpperCase();
            }
            badge.textContent = data.status === 'completed' ? 'Complete' : 'Running';
            badge.className = data.status === 'completed' ? 'badge badge-green' : 'badge badge-blue';
        });

        eventSource.addEventListener('done', (e) => {
            const data = JSON.parse(e.data);
            eventSource.close();
            eventSource = null;

            if (data.status === 'completed') {
                badge.textContent = 'Complete';
                badge.className = 'badge badge-green';
                showToast('Scan completed!');
                loadScanResults(sessionId);
            } else {
                badge.textContent = 'Failed';
                badge.className = 'badge badge-red';
                showToast('Scan failed.', 'error');
            }
        });

        eventSource.onerror = () => {
            badge.textContent = 'Connection lost';
            badge.className = 'badge badge-yellow';
            eventSource.close();
            eventSource = null;
        };
    }

    function updateProgressUI(progress, status) {
        const bar = document.getElementById('scanProgressBar');
        bar.style.width = `${progress}%`;
        document.getElementById('scanProgressText').textContent = `${progress}%`;
    }

    async function loadScanResults(sessionId) {
        try {
            const res = await fetch(`${API_BASE}/scan/results/${sessionId}`, {
                headers: { 'Accept': 'application/json' },
            });
            const data = await res.json();
            if (data.data) {
                renderScanResults(data.data);
            }
        } catch (err) {
            console.error('Failed to load scan results:', err);
        }
    }

    // --- Schedule Management ---
    async function createSchedule(e) {
        e.preventDefault();
        const name = document.getElementById('schedName').value;
        const frequency = document.getElementById('schedFrequency').value;

        try {
            const res = await fetch(`${API_BASE}/scan/schedules`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    frequency,
                    scan_config: { scan_type: 'passive', sources: ['arp', 'dhcp'] },
                }),
            });
            const data = await res.json();
            if (data.success) {
                showToast('Schedule created!');
                document.getElementById('scheduleForm').reset();
                refreshSchedules();
            } else {
                showToast(data.message || 'Failed to create schedule.', 'error');
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
        return false;
    }

    async function refreshSchedules() {
        try {
            const res = await fetch(`${API_BASE}/scan/schedules`, {
                headers: { 'Accept': 'application/json' },
            });
            const data = await res.json();
            const container = document.getElementById('scheduleList');
            if (!data.data?.length) {
                container.innerHTML = '<span style="color:#475569;font-size:12px">No schedules configured.</span>';
                return;
            }
            container.innerHTML = data.data.map(s => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#0f172a;border:1px solid #334155;border-radius:8px;margin-bottom:6px;font-size:12px">
                    <div>
                        <span style="color:#f1f5f9;font-weight:600">${s.name}</span>
                        <span style="color:#64748b;margin-left:8px">${s.frequency} · ${s.is_active ? 'Active' : 'Paused'}</span>
                    </div>
                    <div style="display:flex;gap:8px">
                        <button onclick="toggleSchedule(${s.id}, ${!s.is_active})" class="btn-save" style="padding:4px 10px;font-size:11px;width:auto">${s.is_active ? 'Pause' : 'Resume'}</button>
                        <button onclick="deleteSchedule(${s.id})" style="padding:4px 10px;font-size:11px;background:#450a0a;color:#f87171;border:none;border-radius:6px;cursor:pointer">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch {}
    }

    async function toggleSchedule(id, isActive) {
        try {
            await fetch(`${API_BASE}/scan/schedules/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_active: isActive }),
            });
            refreshSchedules();
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    async function deleteSchedule(id) {
        if (!confirm('Delete this schedule?')) return;
        try {
            await fetch(`${API_BASE}/scan/schedules/${id}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' },
            });
            refreshSchedules();
            showToast('Schedule deleted.');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    // --- Admin Password Rotation ---
    async function loadRotationStatus() {
        try {
            const res = await fetch(`${API_BASE}/router/rotation/status`, {
                headers: { 'Accept': 'application/json' },
            });
            const data = await res.json();

            const badge = document.getElementById('rotationStatusBadge');
            const statusMap = {
                active: { text: 'Active', cls: 'badge badge-green' },
                pending: { text: 'Rotating...', cls: 'badge badge-blue' },
                failed: { text: 'Failed', cls: 'badge badge-red' },
                not_configured: { text: 'Not Configured', cls: 'badge badge-blue' },
            };
            const s = statusMap[data.status] || { text: data.status || 'Unknown', cls: 'badge badge-blue' };
            badge.textContent = s.text;
            badge.className = s.cls;

            document.getElementById('rotationCount').textContent = data.rotation_count || 0;
            document.getElementById('rotationLastAt').textContent = data.last_rotated_at
                ? new Date(data.last_rotated_at).toLocaleString() : '--';
            document.getElementById('rotationNextAt').textContent = data.scheduled_at
                ? new Date(data.scheduled_at).toLocaleString() : '--';

            const resultEl = document.getElementById('rotationLastResult');
            const rollbackBtn = document.getElementById('btnRollback');
            if (data.last_result) {
                resultEl.textContent = data.last_result.success ? 'Success' : (data.last_result.message || 'Failed');
                resultEl.style.color = data.last_result.success ? '#4ade80' : '#f87171';
                rollbackBtn.style.display = data.last_result.success ? 'none' : 'flex';
            } else {
                resultEl.textContent = '--';
                resultEl.style.color = '';
                rollbackBtn.style.display = 'none';
            }

            // Store credential_id for rollback
            window._rotationCredentialId = data.credential_id;
        } catch {}
    }

    async function loadRotationHistory() {
        try {
            const res = await fetch(`${API_BASE}/router/rotation/history`, {
                headers: { 'Accept': 'application/json' },
            });
            const data = await res.json();
            const container = document.getElementById('rotationHistory');
            const logs = data.data || [];
            if (!logs.length) {
                container.innerHTML = '<span style="color:#475569;font-size:12px">No rotation history.</span>';
                return;
            }
            container.innerHTML = logs.slice(0, 10).map(l => {
                const statusCls = l.status === 'success' ? 'color:#4ade80' : l.status === 'failure' ? 'color:#f87171' : 'color:#fbbf24';
                return `<div style="display:flex;justify-content:space-between;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;margin-bottom:6px;font-size:12px">
                    <span style="color:#f1f5f9;font-weight:600">${l.action}</span>
                    <span style="${statusCls}">${l.status}</span>
                    <span style="color:#64748b">${new Date(l.created_at).toLocaleString()}</span>
                </div>`;
            }).join('');
        } catch {}
    }

    async function triggerRotation() {
        if (!confirm('Trigger immediate admin password rotation? The router admin password will be changed.')) return;
        const btn = document.getElementById('btnRotateNow');
        btn.disabled = true;
        btn.querySelector('.btn-text').textContent = 'Rotating...';
        try {
            const res = await fetch(`${API_BASE}/router/rotation/trigger`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            });
            const data = await res.json();
            if (data.error) {
                showToast(data.error, 'error');
            } else {
                showToast('Password rotation initiated!');
                loadRotationStatus();
                loadRotationHistory();
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Rotate Now';
    }

    async function triggerRollback() {
        const credId = window._rotationCredentialId;
        if (!credId) return;
        if (!confirm('Rollback to the previous admin password?')) return;
        try {
            const res = await fetch(`${API_BASE}/router/rotation/rollback/${credId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            });
            const data = await res.json();
            if (data.error) {
                showToast(data.error, 'error');
            } else {
                showToast('Rolled back to previous password.');
                loadRotationStatus();
                loadRotationHistory();
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    }

    loadRotationStatus();
    loadRotationHistory();

    // --- External Change Detection ---
    async function checkExternalChange() {
        try {
            const res = await fetch(`${API_BASE}/router/rotation/status`, {
                headers: { 'Accept': 'application/json' },
            });
            const data = await res.json();

            const alertEl = document.getElementById('externalChangeAlert');
            const msgEl = document.getElementById('externalChangeMsg');
            const titleEl = alertEl.querySelector('span[style*="font-weight:600"]');

            if (data.status === 'failed' && data.last_result) {
                const type = data.last_result.type;
                const alertConfig = {
                    external_change: {
                        title: 'External Password Change Detected',
                        msg: data.last_result.message || 'The agent detected that the router admin password was changed externally.',
                        color: '#f87171',
                    },
                    factory_reset: {
                        title: 'Router Factory Reset Detected',
                        msg: `The router appears to have been factory reset. IP changed to ${data.last_result.hostname || 'unknown'}. Auto-recovery failed — update credentials manually.`,
                        color: '#dc2626',
                    },
                    dhcp_renewal: {
                        title: 'DHCP Renewal Detected',
                        msg: `Router IP address changed. Login still failing — credentials may need update.`,
                        color: '#f97316',
                    },
                    router_replacement: {
                        title: 'Router Replacement Detected',
                        msg: 'MAC address changed — this appears to be a different router. Manual setup required.',
                        color: '#dc2626',
                    },
                };

                const config = alertConfig[type] || alertConfig.external_change;
                alertEl.style.display = 'block';
                alertEl.style.borderColor = config.color;
                if (titleEl) titleEl.textContent = config.title;
                msgEl.textContent = config.msg;
            } else {
                alertEl.style.display = 'none';
            }
        } catch {}
    }

    async function updateCredentials(e) {
        e.preventDefault();
        const username = document.getElementById('credUsername').value;
        const password = document.getElementById('credPassword').value;
        const btn = document.getElementById('btnUpdateCred');
        btn.disabled = true;
        btn.textContent = 'Updating...';

        try {
            const res = await fetch(`${API_BASE}/router/rotation/update-credentials`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    router_ip: '192.168.1.1',
                    username,
                    password,
                }),
            });
            const data = await res.json();
            if (data.error) {
                showToast(data.error, 'error');
            } else {
                showToast('Credentials updated! Agent will use new password.');
                document.getElementById('externalChangeAlert').style.display = 'none';
                loadRotationStatus();
                loadRotationHistory();
            }
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Update';
        return false;
    }

    // Check for external changes on load and every 30s
    checkExternalChange();
    setInterval(checkExternalChange, 30000);

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
                document.getElementById('wifiScanBadge').className = 'badge badge-blue';
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
                showToast('WiFi scan timed out. Check if the agent is running.', 'error');
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
                        document.getElementById('wifiScanBadge').className = 'badge badge-blue';
                    }
                    refreshLogs();
                }
            } catch {
                // keep polling
            }
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

            // Group by scan time
            const grouped = {};
            entries.forEach(e => {
                const key = e.scanned_at;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(e);
            });

            let html = '';
            Object.entries(grouped).forEach(([time, items]) => {
                const timeStr = new Date(time).toLocaleString();
                html += `<div style="margin-bottom:16px">`;
                html += `<div class="wifi-history-time" style="margin-bottom:8px">Scanned: ${timeStr}</div>`;
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

    // --- Network Diagnostic ---
    async function triggerDiagnose() {
        const btn = document.getElementById('btnDiagnose');
        const btnText = btn.querySelector('.btn-text');
        btn.disabled = true;
        btn.classList.add('loading');
        btnText.textContent = 'Diagnosing...';
        document.getElementById('diagBadge').textContent = 'Running...';
        document.getElementById('diagBadge').className = 'badge badge-blue';

        try {
            const res = await fetch(`${API_BASE}/router/diagnose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Network diagnostic dispatched! (Log #${data.log_id})`);
                pollDiagStatus(data.log_id);
                refreshLogs();
            } else {
                showToast('Failed to dispatch diagnostic.', 'error');
                document.getElementById('diagBadge').textContent = 'Failed';
            }
        } catch (err) {
            showToast('Connection error: ' + err.message, 'error');
            document.getElementById('diagBadge').textContent = 'Error';
        }
        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = 'Run Diagnostic';
    }

    let diagPollCount = 0;
    function pollDiagStatus(logId) {
        diagPollCount = 0;
        const interval = setInterval(async () => {
            diagPollCount++;
            if (diagPollCount > 60) {
                clearInterval(interval);
                document.getElementById('diagBadge').textContent = 'Timed out';
                showToast('Diagnostic timed out. WiFi switch may take longer.', 'error');
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/router/logs`, { headers: { 'Accept': 'application/json' } });
                const data = await res.json();
                const log = data.data?.find(l => l.id === logId);
                if (log && log.status !== 'pending') {
                    clearInterval(interval);
                    if (log.status === 'success') {
                        showToast('Diagnostic completed!');
                        document.getElementById('diagBadge').textContent = 'Done';
                        document.getElementById('diagBadge').className = 'badge badge-green';
                        loadDiagResults();
                    } else {
                        showToast('Diagnostic failed. Check agent logs.', 'error');
                        document.getElementById('diagBadge').textContent = 'Failed';
                    }
                    refreshLogs();
                }
            } catch {}
        }, 3000);
    }

    async function loadDiagResults() {
        try {
            const res = await fetch(`${API_BASE}/scan/diagnose`, { headers: { 'Accept': 'application/json' } });
            const data = await res.json();
            const container = document.getElementById('diagResults');
            const results = data.data || [];

            if (!results.length) {
                container.innerHTML = '<div class="empty-state">No diagnostic results yet.</div>';
                return;
            }

            let html = '';
            results.forEach(r => {
                const time = new Date(r.created_at).toLocaleString();
                const statusColor = r.url_reachable ? '#22c55e' : '#ef4444';
                const statusText = r.url_reachable ? 'Reachable' : 'Unreachable';
                html += `
                <div style="border:1px solid #334155;border-radius:8px;padding:12px;margin-bottom:10px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                        <strong style="color:#f1f5f9">${r.target_url || 'N/A'}</strong>
                        <span style="color:${statusColor};font-weight:600">${statusText}</span>
                    </div>
                    <div style="font-size:13px;color:#94a3b8">
                        <div>Time: ${time}</div>
                        <div>WiFi Connected: ${r.wifi_connected ? 'Yes' : 'No'} ${r.ip_address ? '· IP: ' + r.ip_address : ''}</div>
                        <div>Switched from "${r.original_ssid || '?'}" → "${r.target_ssid || '?'}"</div>
                        ${r.page_title ? '<div>Page Title: ' + r.page_title + '</div>' : ''}
                        ${r.error ? '<div style="color:#f87171">Error: ' + r.error + '</div>' : ''}
                        ${r.page_content_snippet ? '<div style="margin-top:6px;background:#0f172a;border:1px solid #334155;border-radius:4px;padding:8px;font-family:monospace;font-size:12px;color:#94a3b8;max-height:100px;overflow:auto;white-space:pre-wrap">' + escapeHtml(r.page_content_snippet) + '</div>' : ''}
                    </div>
                </div>`;
            });
            container.innerHTML = html;
        } catch (err) {
            console.error('Failed to load diagnostics:', err);
        }
    }

    function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // Load diagnostic results on page load
    loadDiagResults();

    // Load WiFi passwords on page load
    loadWifiPasswords();

    // Pre-fill WiFi scanner credentials from database
    async function loadDefaultCredential() {
        try {
            const res = await fetch(`${API_BASE}/router/credential`, {
                headers: { 'Accept': 'application/json' }
            });
            const data = await res.json();
            if (data.data) {
                const userInput = document.getElementById('wifiScanUser');
                const passInput = document.getElementById('wifiScanPass');
                if (data.data.username) userInput.value = data.data.username;
                if (data.data.password) passInput.value = data.data.password;
            }
        } catch {}
    }
    loadDefaultCredential();

    // Initialize auth check
    checkAuth();
</script>

</body>
</html>
