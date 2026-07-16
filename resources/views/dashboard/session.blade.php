<div class="page" id="page-session">
    <div class="card">
        <div class="card-title">
            Router Session
            <span class="badge" id="sessionBadge">Checking...</span>
        </div>
        <div style="text-align:center;padding:12px 0">
            <div id="sessionIcon" style="font-size:48px;margin-bottom:12px">&#128274;</div>
            <p id="sessionMsg" style="color:#94a3b8;font-size:13px;margin-bottom:16px">
                Checking router session status...
            </p>
            <div style="display:flex;gap:8px;justify-content:center">
                <button class="btn-scan" id="btnCheckSession" onclick="checkSessionStatus()" style="background:linear-gradient(135deg,#2563eb,#1d4ed8)">
                    <span class="spinner"></span>
                    <span class="btn-text">Check Session</span>
                </button>
            </div>
        </div>
        <div id="sessionDetails" style="margin-top:12px;font-size:12px;color:#64748b;text-align:center">
            Last checked: <span id="sessionLastChecked">Never</span>
        </div>
    </div>
</div>
