# WiFi Security Scanner

Legitimate network security auditing tool for testing WiFi networks you own or have authorization to test.

## Legal Disclaimer

**Unauthorized network scanning is illegal in most jurisdictions.** This tool is provided for educational and authorized security testing purposes only. You must:

1. Own the network being scanned, OR
2. Have explicit written authorization from the network owner
3. Comply with all local, state, and federal laws

## Usage

```bash
# First run - must acknowledge legal disclaimer
python wifi_scanner.py --scan

# Analyze specific network
python wifi_scanner.py --analyze "MyWiFi"

# Generate HTML security report
python wifi_scanner.py --report security_report.html

# Check authorization status
python wifi_scanner.py --check-permission

# List stored scan results
python wifi_scanner.py --list-scans

# Verbose output
python wifi_scanner.py --scan --verbose
```

## Features

- **Permission Verification** — Must acknowledge legal disclaimer before scanning
- **Rate Limiting** — Max 10 scans per hour to prevent abuse
- **Multi-Platform** — Works on Linux, Windows, and macOS
- **Security Analysis** — Risk assessment for WEP/WPA/WPA2/WPA3/OPEN networks
- **Encrypted Storage** — Scan results stored with encryption
- **HTML Reports** — Professional security reports with recommendations
- **Error Handling** — Timeouts, graceful failures, logging

## Security Levels

| Security Type | Risk Level | Description |
|---------------|------------|-------------|
| WPA3 | MINIMAL | Strong encryption - recommended |
| WPA2 | LOW | Good encryption - check for KRACK |
| WPA | MEDIUM | Outdated - vulnerable to attacks |
| WEP | HIGH | Weak - easily cracked |
| OPEN | CRITICAL | No encryption - all traffic visible |

## Dependencies

- Python 3.8+
- No external packages required (uses stdlib only)

## Files Created

- `wifi_scanner.py` — Main scanner script
- `.wifi_scanner_auth` — Authorization token (auto-created)
- `.scan_rate_log` — Rate limiting log (auto-created)
- `.scanner_data/` — Encrypted scan results (auto-created)
- `wifi_scanner.log` — Error/activity log
