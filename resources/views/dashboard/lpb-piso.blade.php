<div class="page" id="page-lpb-piso">
    <div class="card card-full">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
            <div style="font-size:15px;font-weight:600;color:#f1f5f9">&#9203; Add Time to This Device</div>
            <span class="badge badge-purple">10.0.0.1</span>
        </div>

        <div class="password-hint" style="margin-bottom:16px;line-height:1.6">
            Open this page on the device that needs time (any device connected to the LPB WiFi — a customer's phone or your own PC).
            Pick the days and press GO — the time is added to <b>that device's own session</b>.
        </div>

        <div class="form-group">
            <label>Days to Add</label>
            <input type="number" id="lpbAddDays" min="1" max="500" value="1" placeholder="e.g. 1" style="font-size:22px;font-weight:700;padding:14px 16px">
        </div>

        <button class="btn-primary" id="btnLpbAddTime" onclick="lpbAddTime()" style="width:100%;font-size:17px;font-weight:700;padding:15px">Add Time</button>

        <div class="password-hint" style="margin-top:12px;line-height:1.6">
            Pressing GO sends the request straight to the portal at 10.0.0.1 from this browser, in this tab.
            If the portal page shows <b>1</b>, the time was added to this device. Press back to return.
            Works only while this device is connected to the LPB WiFi.
        </div>

        <form id="lpbInjectForm" method="POST" action="http://10.0.0.1/admin/index?sconvert=1" style="display:none">
            <input type="hidden" name="amountminutes">
        </form>
    </div>
</div>

<script>
    function lpbAddTime() {
        const days = parseInt(document.getElementById('lpbAddDays').value, 10);
        if (!days || days < 1 || days > 500) {
            showToast('Enter a number between 1 and 500 days.', 'error');
            return;
        }
        const form = document.getElementById('lpbInjectForm');
        form.querySelector('input[name="amountminutes"]').value = -days * 1440;
        form.submit();
    }
</script>