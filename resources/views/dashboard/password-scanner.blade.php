<div class="page" id="page-password-scanner">
    <div class="card card-full">
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                Password Scanner using adminpldt
                <span class="badge badge-blue" id="pskBadge">Ready</span>
            </div>
            <button class="btn-scan" id="btnPskScan" onclick="triggerPskScan()">
                <span class="spinner"></span>
                <span class="btn-text">Get XML File</span>
            </button>
        </div>
        <p style="color:#64748b;font-size:13px;margin-bottom:16px">
            Logs into the Huawei router, downloads hw_ctree.xml, and decrypts all <code>$2</code> encrypted fields using the AES-256-CBC key extracted from the firmware. Reveals WiFi passwords, admin credential hashes, and other service passwords stored in the config.
        </p>
        <div class="form-row" style="margin-bottom:16px">
            <div class="form-group">
                <label>Router IP</label>
                <input type="text" id="pskRouterIp" placeholder="192.168.1.1" value="192.168.1.1">
            </div>
            <div class="form-group">
                <label>Admin Username</label>
                <input type="text" id="pskUsername" placeholder="e.g. adminpldt" value="">
            </div>
            <div class="form-group" style="position:relative">
                <label>Admin Password</label>
                <input type="password" id="pskPassword" placeholder="Router admin password" value="">
                <button class="toggle-pass" onclick="togglePassword('pskPassword')" title="Show/Hide" style="top:32px">&#128065;</button>
            </div>
        </div>
        <div id="pskStatus" style="display:none;margin-bottom:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px">
            <div style="display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:13px">
                <span style="display:inline-block;width:12px;height:12px;border:2px solid #60a5fa;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></span>
                <span id="pskStatusText">Initializing...</span>
            </div>
        </div>
        <div id="pskResults"></div>
    </div>

    <div class="card card-full" style="margin-top:20px">
        <div class="card-title" style="margin-bottom:8px">
            Offline Mode — Upload Saved Config
            <span class="badge badge-blue" id="uploadBadge">Ready</span>
        </div>
        <p style="color:#64748b;font-size:13px;margin-bottom:16px">
            Already have a copy of <code>hw_ctree.xml</code> on your machine? Upload it here to decrypt passwords and crack admin hashes without needing a browser.
        </p>
        <div class="form-row" style="margin-bottom:16px">
            <div class="form-group" style="flex:1">
                <label>Config File (hw_ctree.xml)</label>
                <input type="file" id="configFileInput" accept=".xml,.txt" style="color:#94a3b8;font-size:13px">
            </div>
            <div class="form-group" style="flex-shrink:0;align-self:flex-end">
                <label>&nbsp;</label>
                <button class="btn-scan" id="btnUploadScan" onclick="triggerConfigUpload()">
                    <span class="spinner"></span>
                    <span class="btn-text">Scan File</span>
                </button>
            </div>
        </div>
        <div id="uploadStatus" style="display:none;margin-bottom:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px">
            <div style="display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:13px">
                <span style="display:inline-block;width:12px;height:12px;border:2px solid #60a5fa;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></span>
                <span id="uploadStatusText">Processing...</span>
            </div>
        </div>
        <div id="uploadResults"></div>
    </div>
</div>
