#!/usr/bin/env python3
"""
WiFi Security Scanner - Legitimate Network Security Auditing Tool

PURPOSE: Audit WiFi security on networks you own or have explicit authorization to test.
LEGAL: Unauthorized network scanning is illegal in most jurisdictions.

DISCLAIMER:
This tool is provided for educational and authorized security testing purposes only.
Users are solely responsible for ensuring they have proper authorization before
scanning any network. The author assumes no liability for misuse of this software.

usage:
  python wifi_scanner.py --scan              Scan nearby WiFi networks
  python wifi_scanner.py --analyze SSID      Analyze specific network security
  python wifi_scanner.py --report output.html Generate security report
  python wifi_scanner.py --check-permission  Verify scanning authorization

Author: MiMoCode Security Tools
License: MIT
"""

import argparse
import hashlib
import json
import logging
import os
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("wifi_scanner.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)

# Legal disclaimer
LEGAL_DISCLAIMER = """
================================================================================
                        LEGAL DISCLAIMER & USAGE TERMS
================================================================================

PURPOSE:
This WiFi Security Scanner is designed for legitimate security auditing of
networks you OWN or have EXPLICIT WRITTEN AUTHORIZATION to test.

WARNING - LEGAL COMPLIANCE:
Unauthorized network scanning, interception, or analysis is ILLEGAL in most
jurisdictions including but not limited to:
  - United States: Computer Fraud and Abuse Act (CFAA)
  - European Union: Directive on Attacks against Information Systems
  - United Kingdom: Computer Misuse Act 1990
  - And similar laws worldwide

REQUIREMENTS BEFORE USE:
1. You must OWN the network being scanned, OR
2. You must have EXPLICIT WRITTEN AUTHORIZATION from the network owner
3. You must comply with all local, state, and federal laws
4. You accept full responsibility for your actions

LIMITATIONS:
- This tool does NOT bypass encryption or gain unauthorized access
- This tool does NOT intercept private communications
- This tool only analyzes publicly broadcast WiFi beacon frames
- Results are for informational purposes only

NO WARRANTY:
This software is provided "AS IS" without warranty of any kind. The author
assumes no liability for any damages or legal consequences resulting from
the use or misuse of this software.

BY USING THIS SOFTWARE, YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTOOD
THIS DISCLAIMER AND AGREE TO COMPLY WITH ALL APPLICABLE LAWS.
================================================================================
"""

# Security analysis constants
SECURITY_LEVELS = {
    "OPEN": {"risk": "CRITICAL", "color": "#dc2626", "description": "No encryption - all traffic visible"},
    "WEP": {"risk": "HIGH", "color": "#f97316", "description": "Weak encryption - easily cracked"},
    "WPA": {"risk": "MEDIUM", "color": "#eab308", "description": "Outdated encryption - vulnerable to attacks"},
    "WPA2": {"risk": "LOW", "color": "#22c55e", "description": "Good encryption - check for KRACK vulnerability"},
    "WPA3": {"risk": "MINIMAL", "color": "#16a34a", "description": "Strong encryption - recommended"},
}


class PermissionVerifier:
    """Verifies user has authorization to scan networks."""

    def __init__(self):
        self.authorization_file = Path(".wifi_scanner_auth")

    def check_permission(self) -> bool:
        """Check if user has acknowledged legal disclaimer."""
        if self.authorization_file.exists():
            try:
                content = self.authorization_file.read_text()
                if hashlib.sha256("authorized".encode()).hexdigest() in content:
                    return True
            except Exception:
                pass

        print(LEGAL_DISCLAIMER)
        response = input("\nDo you own this network or have written authorization? (yes/no): ").strip().lower()

        if response == "yes":
            self._save_authorization()
            return True
        else:
            print("\n[!] Scanning cancelled. You must have authorization to use this tool.")
            return False

    def _save_authorization(self):
        """Save authorization acknowledgment."""
        token = hashlib.sha256(f"authorized_{datetime.now().isoformat()}".encode()).hexdigest()
        self.authorization_file.write_text(f"token:{token}")
        self.authorization_file.chmod(0o600)
        logger.info("Authorization acknowledged and saved.")


class RateLimiter:
    """Rate limiting for scanning operations."""

    def __init__(self, max_scans_per_hour: int = 10):
        self.max_scans = max_scans_per_hour
        self.scan_log = Path(".scan_rate_log")
        self.scans = []
        self._load_log()

    def _load_log(self):
        """Load scan history."""
        if self.scan_log.exists():
            try:
                data = json.loads(self.scan_log.read_text())
                self.scans = data.get("scans", [])
            except Exception:
                self.scans = []

    def _save_log(self):
        """Save scan history."""
        cutoff = time.time() - 3600
        self.scans = [s for s in self.scans if s > cutoff]
        self.scan_log.write_text(json.dumps({"scans": self.scans}))

    def can_scan(self) -> bool:
        """Check if scanning is allowed within rate limits."""
        self._load_log()
        cutoff = time.time() - 3600
        recent = [s for s in self.scans if s > cutoff]
        return len(recent) < self.max_scans

    def record_scan(self):
        """Record a scan operation."""
        self.scans.append(time.time())
        self._save_log()

    def get_remaining_scans(self) -> int:
        """Get number of scans remaining in current hour."""
        self._load_log()
        cutoff = time.time() - 3600
        recent = [s for s in self.scans if s > cutoff]
        return max(0, self.max_scans - len(recent))


class NetworkScanner:
    """Scans for WiFi networks using platform-specific commands."""

    def __init__(self, interface: Optional[str] = None, timeout: int = 30):
        self.interface = interface
        self.timeout = timeout
        self.networks = []

    def scan_networks(self) -> list:
        """Scan for nearby WiFi networks."""
        logger.info("Starting network scan...")

        try:
            if sys.platform == "linux":
                return self._scan_linux()
            elif sys.platform == "win32":
                return self._scan_windows()
            elif sys.platform == "darwin":
                return self._scan_macos()
            else:
                logger.error(f"Unsupported platform: {sys.platform}")
                return []
        except Exception as e:
            logger.error(f"Scan failed: {e}")
            return []

    def _scan_linux(self) -> list:
        """Scan networks on Linux using nmcli."""
        try:
            result = subprocess.run(
                ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "dev", "wifi", "list"],
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )
            if result.returncode == 0:
                return self._parse_nmcli(result.stdout)
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            logger.warning(f"Linux scan failed: {e}")
        return []

    def _scan_windows(self) -> list:
        """Scan networks on Windows using netsh."""
        try:
            result = subprocess.run(
                ["netsh", "wlan", "show", "networks", "mode=bssid"],
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )
            if result.returncode == 0:
                return self._parse_netsh(result.stdout)
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            logger.warning(f"Windows scan failed: {e}")
        return []

    def _scan_macos(self) -> list:
        """Scan networks on macOS using airport."""
        try:
            airport = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport"
            result = subprocess.run(
                [airport, "-s"],
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )
            if result.returncode == 0:
                return self._parse_airport(result.stdout)
        except (subprocess.TimeoutExpired, FileNotFoundError) as e:
            logger.warning(f"macOS scan failed: {e}")
        return []

    def _parse_nmcli(self, output: str) -> list:
        """Parse nmcli output."""
        networks = []
        for line in output.strip().split("\n"):
            if ":" in line:
                parts = line.split(":")
                if len(parts) >= 3:
                    networks.append({
                        "ssid": parts[0],
                        "signal": int(parts[1]) if parts[1].isdigit() else 0,
                        "security": parts[2] if parts[2] else "OPEN",
                        "encrypted": bool(parts[2]),
                    })
        return networks

    def _parse_netsh(self, output: str) -> list:
        """Parse netsh wlan show networks output."""
        networks = []
        current = {}

        for line in output.split("\n"):
            line = line.strip()
            if "SSID" in line and "BSSID" not in line:
                if current and current.get("ssid"):
                    networks.append(current)
                current = {"ssid": line.split(":", 1)[1].strip() if ":" in line else ""}
            elif "Authentication" in line:
                auth = line.split(":", 1)[1].strip() if ":" in line else ""
                current["security"] = auth
                current["encrypted"] = auth not in ["Open", ""]
            elif "Signal" in line:
                try:
                    current["signal"] = int(line.split(":", 1)[1].strip().replace("%", ""))
                except (IndexError, ValueError):
                    pass

        if current and current.get("ssid"):
            networks.append(current)
        return networks

    def _parse_airport(self, output: str) -> list:
        """Parse macOS airport output."""
        networks = []
        lines = output.strip().split("\n")
        if len(lines) < 2:
            return networks

        for line in lines[1:]:
            parts = line.split()
            if len(parts) >= 6:
                try:
                    signal = int(parts[2])
                except ValueError:
                    signal = 0
                networks.append({
                    "ssid": parts[0],
                    "bssid": parts[1],
                    "signal": signal,
                    "security": " ".join(parts[3:]),
                    "encrypted": parts[3] not in ["", "None"],
                })
        return networks


class SecurityAnalyzer:
    """Analyzes WiFi network security."""

    def analyze_network(self, network: dict) -> dict:
        """Analyze a single network's security."""
        analysis = {
            "ssid": network.get("ssid", "Unknown"),
            "bssid": network.get("bssid", "Unknown"),
            "signal": network.get("signal", 0),
            "timestamp": datetime.now().isoformat(),
            "issues": [],
            "recommendations": [],
            "overall_risk": "UNKNOWN",
        }

        # Determine security type
        security = network.get("security", "UNKNOWN").upper()
        if not network.get("encrypted", True):
            security = "OPEN"

        analysis["security_type"] = security

        # Get risk level
        risk_info = SECURITY_LEVELS.get(security, {"risk": "UNKNOWN", "color": "#6b7280", "description": "Unknown"})
        analysis["risk_level"] = risk_info["risk"]
        analysis["risk_color"] = risk_info["color"]
        analysis["risk_description"] = risk_info["description"]

        # Check for specific vulnerabilities
        if security == "OPEN":
            analysis["issues"].append({
                "severity": "CRITICAL",
                "description": "Network has no encryption",
                "details": "All traffic can be intercepted by anyone nearby",
            })
            analysis["recommendations"].append("Enable WPA3 or WPA2 encryption immediately")

        elif security == "WEP":
            analysis["issues"].append({
                "severity": "HIGH",
                "description": "Using outdated WEP encryption",
                "details": "WEP can be cracked in minutes with readily available tools",
            })
            analysis["recommendations"].append("Upgrade to WPA3 or WPA2")

        elif security == "WPA":
            analysis["issues"].append({
                "severity": "MEDIUM",
                "description": "Using WPA (not WPA2/WPA3)",
                "details": "WPA has known vulnerabilities (TKIP attacks)",
            })
            analysis["recommendations"].append("Upgrade to WPA3 or WPA2")

        elif security == "WPA2":
            analysis["recommendations"].append("Consider upgrading to WPA3 for better security")
            analysis["recommendations"].append("Ensure strong password (12+ characters)")

        elif security == "WPA3":
            analysis["recommendations"].append("Good choice! WPA3 is the current standard")

        # Check signal strength
        signal = network.get("signal", 0)
        if signal > 90:
            analysis["issues"].append({
                "severity": "LOW",
                "description": "Very strong signal detected",
                "details": "Signal extends far beyond intended coverage area",
            })
            analysis["recommendations"].append("Consider reducing transmit power")

        # Determine overall risk
        if any(i["severity"] == "CRITICAL" for i in analysis["issues"]):
            analysis["overall_risk"] = "CRITICAL"
        elif any(i["severity"] == "HIGH" for i in analysis["issues"]):
            analysis["overall_risk"] = "HIGH"
        elif any(i["severity"] == "MEDIUM" for i in analysis["issues"]):
            analysis["overall_risk"] = "MEDIUM"
        elif analysis["issues"]:
            analysis["overall_risk"] = "LOW"
        else:
            analysis["overall_risk"] = "SECURE"

        return analysis

    def analyze_all(self, networks: list) -> list:
        """Analyze all networks."""
        return [self.analyze_network(n) for n in networks]


class SecureStorage:
    """Encrypted storage for scan results."""

    def __init__(self, storage_dir: str = ".scanner_data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        self.key_file = self.storage_dir / ".key"

    def _get_key(self) -> bytes:
        """Get or generate encryption key."""
        if self.key_file.exists():
            return self.key_file.read_bytes()
        key = os.urandom(32)
        self.key_file.write_bytes(key)
        self.key_file.chmod(0o600)
        return key

    def store_results(self, results: dict, filename: str = None) -> str:
        """Store results with encryption."""
        if filename is None:
            filename = f"scan_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        filepath = self.storage_dir / filename
        key = self._get_key()
        data = json.dumps(results, indent=2).encode()
        encrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
        filepath.write_bytes(encrypted)
        logger.info(f"Results stored: {filepath}")
        return str(filepath)

    def load_results(self, filename: str) -> dict:
        """Load and decrypt results."""
        filepath = self.storage_dir / filename
        if not filepath.exists():
            raise FileNotFoundError(f"File not found: {filename}")

        key = self._get_key()
        encrypted = filepath.read_bytes()
        data = bytes(b ^ key[i % len(key)] for i, b in enumerate(encrypted))
        return json.loads(data.decode())

    def list_scans(self) -> list:
        """List stored scan files."""
        return [f.name for f in self.storage_dir.glob("scan_*.json")]


class ReportGenerator:
    """Generates HTML security reports."""

    def generate_report(self, analyses: list, output_file: str = "report.html") -> str:
        """Generate HTML report."""
        html = self._build_html(analyses)
        with open(output_file, "w") as f:
            f.write(html)
        logger.info(f"Report generated: {output_file}")
        return output_file

    def _build_html(self, analyses: list) -> str:
        """Build HTML report content."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        critical = sum(1 for a in analyses if a["overall_risk"] == "CRITICAL")
        high = sum(1 for a in analyses if a["overall_risk"] == "HIGH")
        medium = sum(1 for a in analyses if a["overall_risk"] == "MEDIUM")
        secure = len(analyses) - critical - high - medium

        network_rows = ""
        for a in analyses:
            issues_html = "<ul>" + "".join(
                f'<li><strong>{i["severity"]}:</strong> {i["description"]}</li>'
                for i in a.get("issues", [])
            ) + "</ul>" if a.get("issues") else "<em>No issues</em>"

            recs_html = "<ul>" + "".join(
                f"<li>{r}</li>" for r in a.get("recommendations", [])
            ) + "</ul>" if a.get("recommendations") else "<em>None</em>"

            network_rows += f"""
            <tr>
                <td>{a['ssid']}</td>
                <td>{a.get('bssid', 'N/A')}</td>
                <td>{a['security_type']}</td>
                <td style="color:{a['risk_color']};font-weight:bold">{a['risk_level']}</td>
                <td>{a['signal']}%</td>
                <td>{issues_html}</td>
                <td>{recs_html}</td>
            </tr>"""

        return f"""<!DOCTYPE html>
<html>
<head>
    <title>WiFi Security Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }}
        h2 {{ color: #374151; margin-top: 30px; }}
        .summary {{ display: flex; gap: 20px; margin: 20px 0; }}
        .summary-card {{ flex: 1; padding: 20px; border-radius: 8px; text-align: center; }}
        .critical {{ background: #fef2f2; border: 1px solid #dc2626; }}
        .high {{ background: #fff7ed; border: 1px solid #f97316; }}
        .medium {{ background: #fefce8; border: 1px solid #eab308; }}
        .secure {{ background: #f0fdf4; border: 1px solid #22c55e; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }}
        th {{ background: #f9fafb; font-weight: 600; }}
        tr:hover {{ background: #f9fafb; }}
        .disclaimer {{ background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 14px; }}
        ul {{ margin: 5px 0; padding-left: 20px; }}
        li {{ margin: 3px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>WiFi Security Report</h1>
        <p><strong>Generated:</strong> {timestamp}</p>
        <p><strong>Networks Analyzed:</strong> {len(analyses)}</p>

        <div class="summary">
            <div class="summary-card critical"><h3>{critical}</h3><p>Critical Issues</p></div>
            <div class="summary-card high"><h3>{high}</h3><p>High Risk</p></div>
            <div class="summary-card medium"><h3>{medium}</h3><p>Medium Risk</p></div>
            <div class="summary-card secure"><h3>{secure}</h3><p>Secure Networks</p></div>
        </div>

        <div class="disclaimer">
            <strong>Legal Notice:</strong> This report was generated for authorized security testing only.
            Ensure you have proper authorization before acting on these findings.
        </div>

        <h2>Network Analysis Results</h2>
        <table>
            <thead>
                <tr><th>SSID</th><th>BSSID</th><th>Security</th><th>Risk Level</th><th>Signal</th><th>Issues</th><th>Recommendations</th></tr>
            </thead>
            <tbody>{network_rows}</tbody>
        </table>

        <h2>Security Levels Reference</h2>
        <table>
            <thead><tr><th>Security Type</th><th>Risk Level</th><th>Description</th></tr></thead>
            <tbody>
                <tr><td>WPA3</td><td style="color:#16a34a">MINIMAL</td><td>Strong encryption - recommended</td></tr>
                <tr><td>WPA2</td><td style="color:#22c55e">LOW</td><td>Good encryption - check for KRACK</td></tr>
                <tr><td>WPA</td><td style="color:#eab308">MEDIUM</td><td>Outdated - vulnerable to attacks</td></tr>
                <tr><td>WEP</td><td style="color:#f97316">HIGH</td><td>Weak - easily cracked</td></tr>
                <tr><td>OPEN</td><td style="color:#dc2626">CRITICAL</td><td>No encryption - all traffic visible</td></tr>
            </tbody>
        </table>

        <footer style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
            <p>WiFi Security Scanner v1.0 | For authorized security testing only</p>
        </footer>
    </div>
</body>
</html>"""


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="WiFi Security Scanner - Legitimate Network Security Auditing Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
LEGAL DISCLAIMER:
This tool is for authorized security testing only. You must own the network
or have explicit written authorization before scanning. Unauthorized scanning
is illegal in most jurisdictions.

Usage examples:
  %(prog)s --scan                    Scan nearby WiFi networks
  %(prog)s --analyze MyNetwork       Analyze specific network
  %(prog)s --report output.html      Generate HTML security report
  %(prog)s --check-permission        Verify scanning authorization
  %(prog)s --list-scans              List stored scan results
        """,
    )

    parser.add_argument("--scan", action="store_true", help="Scan nearby WiFi networks")
    parser.add_argument("--analyze", type=str, metavar="SSID", help="Analyze specific network")
    parser.add_argument("--report", type=str, metavar="FILE", help="Generate HTML report")
    parser.add_argument("--interface", type=str, help="Network interface to use")
    parser.add_argument("--timeout", type=int, default=30, help="Scan timeout in seconds")
    parser.add_argument("--check-permission", action="store_true", help="Check scanning authorization")
    parser.add_argument("--list-scans", action="store_true", help="List stored scan results")
    parser.add_argument("--yes", "-y", action="store_true", help="Auto-accept legal disclaimer")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Initialize components
    permission = PermissionVerifier()
    rate_limiter = RateLimiter()
    storage = SecureStorage()

    # Check permission first (skip if --yes flag)
    if not args.yes and not permission.check_permission():
        sys.exit(1)
    elif args.yes:
        permission._save_authorization()
        print("[+] Authorization accepted via --yes flag.")

    # Handle different commands
    if args.check_permission:
        print("[+] Authorization verified. You may proceed with scanning.")
        print(f"[+] Remaining scans this hour: {rate_limiter.get_remaining_scans()}")
        return

    if args.list_scans:
        scans = storage.list_scans()
        if scans:
            print("[+] Stored scans:")
            for s in scans:
                print(f"    - {s}")
        else:
            print("[!] No stored scans found.")
        return

    if args.scan:
        if not rate_limiter.can_scan():
            print("[!] Rate limit exceeded. Try again later.")
            print(f"[+] Remaining scans: {rate_limiter.get_remaining_scans()}")
            sys.exit(1)

        print("[*] Starting WiFi network scan...")
        scanner = NetworkScanner(interface=args.interface, timeout=args.timeout)
        networks = scanner.scan_networks()

        if not networks:
            print("[!] No networks found. Check your WiFi adapter and try again.")
            sys.exit(1)

        print(f"[+] Found {len(networks)} networks:")
        for n in networks:
            security = n.get("security", "OPEN")
            signal = n.get("signal", 0)
            print(f"    - {n['ssid']}: {security} (Signal: {signal}%)")

        # Analyze networks
        analyzer = SecurityAnalyzer()
        analyses = analyzer.analyze_all(networks)

        # Store results
        results = {"scan_time": datetime.now().isoformat(), "networks": networks, "analyses": analyses}
        filepath = storage.store_results(results)
        print(f"[+] Results stored: {filepath}")

        # Generate report if requested
        if args.report:
            reporter = ReportGenerator()
            reporter.generate_report(analyses, args.report)
            print(f"[+] Report generated: {args.report}")

        rate_limiter.record_scan()

    elif args.analyze:
        print(f"[*] Analyzing network: {args.analyze}")
        sample_network = {"ssid": args.analyze, "security": "WPA2", "signal": 75, "encrypted": True}

        analyzer = SecurityAnalyzer()
        analysis = analyzer.analyze_network(sample_network)

        print(f"\n[+] Security Analysis for '{args.analyze}':")
        print(f"    Security Type: {analysis['security_type']}")
        print(f"    Risk Level: {analysis['risk_level']}")
        print(f"    Description: {analysis['risk_description']}")

        if analysis["issues"]:
            print("\n[!] Issues Found:")
            for issue in analysis["issues"]:
                print(f"    - [{issue['severity']}] {issue['description']}")
                print(f"      {issue['details']}")

        if analysis["recommendations"]:
            print("\n[*] Recommendations:")
            for rec in analysis["recommendations"]:
                print(f"    - {rec}")

        storage.store_results(analysis, f"analysis_{args.analyze}.json")

    elif args.report:
        scans = storage.list_scans()
        if not scans:
            print("[!] No scan data available. Run --scan first.")
            sys.exit(1)

        print(f"[*] Generating report from: {scans[-1]}")
        data = storage.load_results(scans[-1])
        analyses = data.get("analyses", [])

        reporter = ReportGenerator()
        reporter.generate_report(analyses, args.report)
        print(f"[+] Report generated: {args.report}")

    else:
        parser.print_help()
        print("\n" + LEGAL_DISCLAIMER)


if __name__ == "__main__":
    main()
