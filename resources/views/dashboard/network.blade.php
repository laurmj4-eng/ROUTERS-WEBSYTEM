<div class="page" id="page-network">
    <div class="card card-full">
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
</div>
