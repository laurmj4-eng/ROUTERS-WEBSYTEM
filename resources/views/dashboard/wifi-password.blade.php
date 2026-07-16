<div class="page" id="page-wifi-pass">
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
            <button type="submit" class="btn-primary" id="btnSave" style="width:100%">
                Update Wi-Fi Password
            </button>
        </form>
    </div>
</div>
