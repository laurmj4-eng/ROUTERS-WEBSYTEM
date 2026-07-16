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
    wlan24G:  'html/amp/wlanbasic/WlanBasic.asp?2G',
    wlan5G:   'html/amp/wlanbasic/WlanBasic.asp?5G',
    // System Tools → Reboot page
    reboot:   'html/ssmp/management/reboot.asp',
  },

  // Network scan — selectors for scraping router configuration.
  networkScan: {
    wlan24G: {
      path: 'html/amp/wlanbasic/WlanBasic.asp?2G',
      ssidName: [
        'input#wlSsid',
        'input#txt_ssidname',
        'input[name="SSIDName"]',
        'input[name="ssid"]',
        'input[name="WLASSSID"]',
      ],
      ssidPassword: [
        'input#wlWpaPsk',
        'input#txt_ssidpassword',
        'input[name="PreSharedKey"]',
        'input[name="KeyPassphrase"]',
        'input[name="WPAKey"]',
      ],
    },
    wlan5G: {
      path: 'html/amp/wlanbasic/WlanBasic.asp?5G',
      ssidName: [
        'input#txt_ssidname5g',
        'input#txt_ssidname',
        'input[name="SSIDName"]',
        'input[name="ssid"]',
        'input[name="WLASSSID"]',
      ],
      ssidPassword: [
        'input#txt_ssidpassword5g',
        'input#txt_ssidpassword',
        'input[name="PreSharedKey"]',
        'input[name="KeyPassphrase"]',
        'input[name="WPAKey"]',
      ],
    },
    connectedDevices: {
      path: 'html/bbsp/userdevinfo/userdevinfo.asp',
      fallbackPaths: [
        'html/ssmp/dhcp/clients.asp',
        'html/ssmp/status/dhcp_list.asp',
      ],
      deviceRows: 'table#devlist tr.trTabContent, table.dhcp_list tr, table.ClientList tr, table#dhcp_list tr, table tr',
      deviceCount: [
        'span#device_count',
        'span.device-num',
        'td.device_count',
      ],
    },
    connectionStatus: {
      paths: [
        'html/ssmp/waninfo/waninfo.asp',
        'html/bbsp/waninfo/waninfo.asp',
        'html/ssmp/deviceinfo/deviceinfo.asp',
      ],
      indicators: [
        'span#internet_status',
        'span#wan_status',
        'div.wan-status',
        'td.connection_status',
        'span.connection-status',
      ],
    },
  },
};
