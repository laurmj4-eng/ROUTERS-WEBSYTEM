/**
 * Huawei HG8145X6-10 (PLDT Home Fiber) CSS Selectors
 * Source: Raw login.asp HTML analysis
 *
 * All selectors use stable ID attributes that are hardcoded in the
 * router firmware — they will not change across minor layout updates.
 */

module.exports = {
  login: {
    username:     'input#txt_Username',
    password:     'input#txt_Password',
    loginButton:  'button#button',
  },

  forcedPasswordChange: {
    container:       'div#pwd_modify',
    oldPassword:     'input#old_password',
    newPassword:     'input#new_password',
    confirmPassword: 'input#confirm_password',
    ssid1Name:       'input#ssid1_name',
    ssid1Password:   'input#ssid1_password',
    ssid1ConfirmPW:  'input#ssid1_confirm_password',
    ssid2Name:       'input#ssid2_name',
    ssid2Password:   'input#ssid2_password',
    ssid2ConfirmPW:  'input#ssid2_confirm_password',
    bandSteering:    'input#steering_box',
    updateButton:    'button#button_update',
  },

  status: {
    errorContainer: 'div#loginfail',
    errorDiv:       'div#DivErrPage',
  },

  // Post-login pages — selectors discovered after authentication.
  // These targets are navigated to inside the frame-based admin panel.
  postLogin: {
    // WLAN 2.4G Basic Settings page (typical Huawei ONT path)
    wlan24G:  '/html/ssmp/wireless/basic/index.asp',
    wlan5G:   '/html/ssmp/wireless/basic5g/index.asp',
    // System Tools → Reboot page
    reboot:   '/html/ssmp/management/reboot.asp',
  },
};
