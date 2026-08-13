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
            <div class="empty-state">Enter admin credentials and click "Scan WiFi Passwords" to read the latest WiFi SSID + password directly from the router.</div>
        </div>
    </div>
</div>
