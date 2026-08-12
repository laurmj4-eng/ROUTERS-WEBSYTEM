<div class="page" id="page-scan-agency">
    <div class="card" style="padding: 0; overflow: hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border,#333)">
            <div>
                <div class="card-title" style="border:none;padding:0">Scan Agent</div>
                <div style="color:#94a3b8;font-size:12px;margin-top:2px">Standalone scan tools &mdash; http://localhost:4333</div>
            </div>
            <div style="display:flex;gap:8px">
                <a href="http://localhost:4333" target="_blank" rel="noopener" class="btn-logout" style="display:inline-block;text-align:center;padding:6px 12px;line-height:1.2">Open in new tab</a>
                <button class="btn-logout" onclick="document.getElementById('scanAgencyFrame').contentWindow.location.reload()" style="display:inline-block;text-align:center;padding:6px 12px;line-height:1.2">Reload</button>
            </div>
        </div>
        <iframe id="scanAgencyFrame" src="http://localhost:4333/?key={{ $scanKey ?? '' }}" style="width:100%;height:calc(100vh - 260px);min-height:500px;border:none;background:#fff"></iframe>
    </div>
</div>