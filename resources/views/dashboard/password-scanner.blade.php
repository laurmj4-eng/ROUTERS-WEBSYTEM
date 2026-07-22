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
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                Admin Credentials (Current)
                <span class="badge badge-green" id="adminCredBadge">Known</span>
            </div>
            <button class="btn-scan" id="btnTestAdminCred" onclick="triggerTestAdminCred()" style="background:#059669">
                <span class="spinner"></span>
                <span class="btn-text">Test Login</span>
            </button>
        </div>
        <p style="color:#94a3b8;font-size:13px;margin-bottom:16px">
            Current working credentials for the <code>admin</code> user on this router. Set via CGI password reset exploit.
        </p>
        <div class="form-row" style="margin-bottom:16px">
            <div class="form-group">
                <label>Router IP</label>
                <input type="text" id="adminCredRouterIp" placeholder="192.168.1.1" value="192.168.1.1">
            </div>
        </div>
        <div style="background:#0f172a;border:1px solid #059669;border-radius:10px;padding:16px;margin-bottom:16px">
            <div style="display:flex;align-items:center;gap:12px;flex:1">
                <div style="background:#059669;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;flex-shrink:0">&#128274;</div>
                <div>
                    <div style="color:#e2e8f0;font-weight:600;font-size:14px">admin</div>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                        <span style="color:#64748b;font-size:12px">Password:</span>
                        <span style="color:#4ade80;font-weight:600;font-family:monospace;font-size:14px" id="adminCredPassword" data-raw="Admin12345678" data-visible="true">Admin12345678</span>
                        <button onclick="togglePassword('adminCredPassword')" style="background:transparent;border:1px solid #334155;color:#94a3b8;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:11px;flex-shrink:0">&#128065;</button>
                        <button onclick="copyToClipboard('Admin12345678')" style="background:transparent;border:1px solid #334155;color:#94a3b8;width:24px;height:24px;border-radius:4px;cursor:pointer;font-size:11px;flex-shrink:0" title="Copy password">&#128203;</button>
                    </div>
                </div>
            </div>
        </div>
        <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:16px">
            <div style="display:flex;align-items:center;gap:12px">
                <div style="flex:1">
                    <label style="color:#94a3b8;font-size:12px;display:block;margin-bottom:4px">Change Password (visible browser)</label>
                    <input type="text" id="adminNewPassword" placeholder="Enter new admin password" value="Admin12345678" style="width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#e2e8f0;font-size:13px">
                </div>
                <button class="btn-scan" id="btnChangeAdminPw" onclick="triggerChangeAdminPw()" style="background:#059669;margin-top:16px;white-space:nowrap">
                    <span class="spinner"></span>
                    <span class="btn-text">Go</span>
                </button>
            </div>
            <div style="color:#64748b;font-size:11px;margin-top:8px">&#128065; Browser will open visibly so you can watch the exploit in action.</div>
        </div>
        <div id="adminCredConsoleWrap" class="console-wrap" style="display:none;margin-top:16px">
            <div class="console-header">
                <span class="console-label">Console</span>
                <span class="console-dot" id="consoleDot"></span>
                <span class="console-status" id="consoleStatus">Running...</span>
            </div>
            <div class="console-body" id="adminCredConsole"></div>
        </div>
        <div id="adminCredStatus" style="display:none;margin-top:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px">
            <div style="display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:13px">
                <span style="display:inline-block;width:12px;height:12px;border:2px solid #059669;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></span>
                <span id="adminCredStatusText">Testing login...</span>
            </div>
        </div>
        <div id="adminCredResults" style="margin-top:8px"></div>
    </div>

    <div class="card card-full" style="margin-top:20px">
        <div class="network-header">
            <div class="card-title" style="margin-bottom:0">
                Restore Default Configuration
                <span class="badge badge-blue" id="restoreBadge">Ready</span>
            </div>
            <button class="btn-scan" id="btnRestoreDefault" onclick="triggerRestoreDefault()">
                <span class="spinner"></span>
                <span class="btn-text">Restore Defaults</span>
            </button>
        </div>
        <p style="color:#f87171;font-size:13px;margin-bottom:16px">
            &#9888; WARNING: This will reset ALL router settings (WiFi passwords, admin password, custom configs) to factory defaults. The <code>adminpldt</code> default password will be restored. Router will reboot.
        </p>
        <div class="form-row" style="margin-bottom:16px">
            <div class="form-group">
                <label>Router IP</label>
                <input type="text" id="restoreRouterIp" placeholder="192.168.1.1" value="192.168.1.1">
            </div>
            <div class="form-group">
                <label>Admin Username</label>
                <input type="text" id="restoreUsername" placeholder="e.g. adminpldt" value="adminpldt">
            </div>
            <div class="form-group" style="position:relative">
                <label>Admin Password</label>
                <input type="password" id="restorePassword" placeholder="Adminpldt password" value="">
                <button class="toggle-pass" onclick="togglePassword('restorePassword')" title="Show/Hide" style="top:32px">&#128065;</button>
            </div>
        </div>
        <div id="restoreStatus" style="display:none;margin-bottom:16px;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:12px 16px">
            <div style="display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:13px">
                <span style="display:inline-block;width:12px;height:12px;border:2px solid #ef4444;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></span>
                <span id="restoreStatusText">Restoring defaults...</span>
            </div>
        </div>
        <div id="restoreResults"></div>
    </div>
</div>
