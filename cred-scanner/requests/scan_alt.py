#!/usr/bin/env python3
"""Port scan + try alternative Huawei/PLDT endpoints while lockout expires."""
import requests, urllib3, socket, ssl, time, struct

urllib3.disable_warnings()
ROUTER = "192.168.1.1"

# 1. Port scan
print("=" * 60)
print("1. TCP PORT SCAN")
print("=" * 60)
common_ports = [21, 22, 23, 53, 80, 443, 554, 8080, 8443, 1900, 37215, 49000, 49152, 49153, 50000, 52869, 36866]
open_ports = []
for port in common_ports:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        result = s.connect_ex((ROUTER, port))
        if result == 0:
            open_ports.append(port)
            print("  PORT " + str(port) + " OPEN")
        s.close()
    except:
        pass
print("  Open ports:", open_ports)

# 2. Try UPnP/SOAP on common ports
print("\n" + "=" * 60)
print("2. UPnP/SOAP ENDPOINTS")
print("=" * 60)
for port in [80, 443, 37215, 49000, 52869]:
    urls = [
        "http://" + ROUTER + ":" + str(port) + "/tr064/",
        "http://" + ROUTER + ":" + str(port) + "/UPnP/",
        "http://" + ROUTER + ":" + str(port) + "/igddesc.xml",
        "http://" + ROUTER + ":" + str(port) + "/description.xml",
        "http://" + ROUTER + ":" + str(port) + "/rootDesc.xml",
    ]
    for url in urls:
        try:
            r = requests.get(url, timeout=3, verify=False)
            if r.status_code != 0:
                print("  " + url + " -> " + str(r.status_code) + " (" + str(len(r.text)) + " bytes)")
                if len(r.text) > 0 and len(r.text) < 2000:
                    print("    " + r.text[:200])
        except:
            pass

# 3. Try Huawei TR-064/UPnP on HTTPS
print("\n" + "=" * 60)
print("3. HTTPS TR-064/UPnP")
print("=" * 60)
for port in [443, 49152, 37215]:
    try:
        s = requests.Session()
        s.verify = False
        r = s.get("https://" + ROUTER + ":" + str(port) + "/", timeout=3)
        print("  HTTPS :/" + str(port) + "/ -> " + str(r.status_code) + " (" + str(len(r.text)) + " bytes)")
        print("    " + r.text[:300])
    except Exception as e:
        print("  HTTPS :/" + str(port) + "/ -> " + str(e)[:80])

# 4. Try Huawei SOAP TR-064 actions
print("\n" + "=" * 60)
print("4. HUAWEI SOAP TR-064 ACTIONS")
print("=" * 60)
soap_actions = [
    ("http://192.168.1.1:37215/HGAuthService", "HA1", "<?xml version=\"1.0\"?><s:Envelope s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\" xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\"><s:Body><u:Login xmlns:u=\"urn:dslforum-org:service:DeviceInfo:1\"><NewUsername>admin</NewUsername><NewPassword>admin</NewPassword></u:Login></s:Body></s:Envelope>"),
    ("http://192.168.1.1:37215/tr064desc.xml", "", ""),
    ("http://192.168.1.1:37215/HGAuthService/control", "HA1", ""),
]
for url, action, body in soap_actions:
    try:
        headers = {"Content-Type": 'text/xml; charset="utf-8"', "SOAPAction": '"' + action + '"'}
        r = requests.post(url, data=body, headers=headers, timeout=3, verify=False)
        print("  " + url + " -> " + str(r.status_code) + " " + r.text[:200])
    except Exception as e:
        print("  " + url + " -> " + str(e)[:80])

# 5. Try Huawei hidden endpoints on HTTPS
print("\n" + "=" * 60)
print("5. HIDDEN HUAWEI ENDPOINTS (HTTPS)")
print("=" * 60)
hidden_urls = [
    "/html/ssmp/telephony/diagnostic/VoIPDiag.asp",
    "/html/ssmp/usb/USBManage.asp",
    "/html/ssmp/usb/USBStorage.asp",
    "/html/ssmp/amp/CloudManage.asp",
    "/html/ssmp/mgmt/RouterManagement.asp",
    "/html/ssmp/remote/RemoteManage.asp",
    "/html/amp/wan/WanConnList.asp",
    "/html/amp/lan/LanConfig.asp",
    "/html/amp/firewall/FirewallPolicy.asp",
    "/html/amp/route/RouteConfig.asp",
    "/html/amp/dns/DnsConfig.asp",
    "/html/amp/dhcp/DhcpConfig.asp",
    "/html/amp/nat/NatConfig.asp",
    "/html/amp/qos/QoSConfig.asp",
    "/html/amp/voip/VoIPConfig.asp",
    "/html/amp/igmp/IGMPConfig.asp",
    "/html/amp/ddns/DDNSConfig.asp",
    "/html/amp/urlfilter/URLFilterConfig.asp",
    "/html/amp/parental/ParentalControl.asp",
    "/html/amp/alarm/AlarmConfig.asp",
    "/html/amp/log/LogConfig.asp",
    "/html/amp/time/TimeConfig.asp",
    "/html/amp/upgrade/UpgradeFirmware.asp",
    "/html/amp/reboot/RebootConfig.asp",
    "/html/amp/restore/RestoreConfig.asp",
    "/html/amp/diagnostic/Diagnostic.asp",
    "/html/amp/tr069/TR069Config.asp",
    "/html/amp/acs/ACSConfig.asp",
    "/html/amp/vlan/VLANConfig.asp",
    "/html/amp/multicast/MulticastConfig.asp",
    "/html/ssmp/accout/UserMgr.asp",
    "/html/ssmp/mgmt/SysManage.asp",
    "/asp/SetDebug.asp",
    "/asp/GetDebug.asp",
    "/asp/BalanceAPI.asp",
]
try:
    s = requests.Session()
    s.verify = False
    s.cookies.set("Cookie", "body:Language:english:id=-1")
    for url in hidden_urls:
        try:
            r = s.get("https://" + ROUTER + url, timeout=3)
            has_login = "txt_Username" in r.text
            if r.status_code != 0:
                print("  " + url + " -> " + str(r.status_code) + " login:" + str(has_login) + " size:" + str(len(r.text)))
                if not has_login and len(r.text) > 1000:
                    print("    CONTENT: " + r.text[:200])
        except:
            pass
except Exception as e:
    print("  Error:", e)

# 6. Try config download
print("\n" + "=" * 60)
print("6. CONFIG DOWNLOAD/BACKUP")
print("=" * 60)
config_urls = [
    "/backupsettings.conf",
    "/config.xml",
    "/backup.cgi",
    "/cgi-bin/export_settings.cgi",
    "/romfile.cfg",
    "/config/back.cfg",
    "/gateway.lp",
    "/html/ssmp/mgmt/BackupCfg.asp",
]
try:
    s = requests.Session()
    s.verify = False
    s.cookies.set("Cookie", "body:Language:english:id=-1")
    for url in config_urls:
        try:
            r = s.get("https://" + ROUTER + url, timeout=3)
            print("  " + url + " -> " + str(r.status_code) + " type:" + r.headers.get("Content-Type", "?") + " size:" + str(len(r.text)))
            if r.status_code == 200 and len(r.text) > 100:
                print("    " + r.text[:200])
        except:
            pass
except Exception as e:
    print("  Error:", e)

# 7. Try enabling telnet/SSH via CWMP
print("\n" + "=" * 60)
print("7. TR-069/CWMP ENDPOINTS")
print("=" * 60)
cwmp_urls = [
    "/tr069",
    "/tr069acs",
    "/cwmp",
    "/acs",
    "/cpe",
    "/tr069/config.asp",
    "/html/ssmp/tr069/TR069Config.asp",
    "/html/amp/tr069/TR069Config.asp",
]
try:
    s = requests.Session()
    s.verify = False
    s.cookies.set("Cookie", "body:Language:english:id=-1")
    for url in cwmp_urls:
        try:
            r = s.get("https://" + ROUTER + url, timeout=3)
            print("  " + url + " -> " + str(r.status_code) + " size:" + str(len(r.text)))
            if r.status_code == 200:
                print("    " + r.text[:200])
        except:
            pass
except Exception as e:
    print("  Error:", e)

print("\n" + "=" * 60)
print("DONE")
