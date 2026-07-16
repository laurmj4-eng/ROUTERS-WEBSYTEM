#!/usr/bin/env python3
"""
CLI entry point for Default Credential Scanner and Password Discovery.

Usage:
  python cli.py --url http://192.168.1.1                    Test actual logins (default)
  python cli.py --url http://192.168.1.1 --report-only       Report candidates without testing
  python cli.py --url http://192.168.1.1 --output text       Human-readable output
  python cli.py --url http://192.168.1.1 --discover          Brute-force discover password
  python cli.py --url http://192.168.1.1 --discover --wordlist custom.txt

Exit codes:
  0 = no default credentials found
  1 = error (scanner failure)
  2 = DEFAULT CREDENTIALS FOUND
  3 = PASSWORD DISCOVERED
"""

import argparse
import json
import sys
from pathlib import Path

from scanner import DefaultCredentialScanner


def main():
    parser = argparse.ArgumentParser(
        description="Default Credential Scanner and Password Discovery"
    )
    parser.add_argument(
        "--url",
        default="http://192.168.1.1",
        help="Router URL (default: http://192.168.1.1)",
    )
    parser.add_argument(
        "--db",
        default=str(Path(__file__).parent / "credentials.db"),
        help="Path to SQLite credentials database",
    )
    parser.add_argument(
        "--seed",
        default=str(Path(__file__).parent / "credentials.json"),
        help="Path to JSON seed file",
    )
    parser.add_argument(
        "--report-only",
        action="store_true",
        help="Report candidate credentials without testing logins",
    )
    parser.add_argument(
        "--output",
        choices=["json", "text"],
        default="json",
        help="Output format (default: json)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=8,
        help="HTTP request timeout in seconds (default: 8)",
    )
    parser.add_argument(
        "--known-user",
        default=None,
        help="Known username to test first (current/active credential)",
    )
    parser.add_argument(
        "--known-pass",
        default=None,
        help="Known password to test first (current/active credential)",
    )

    # Discovery mode options
    parser.add_argument(
        "--discover",
        action="store_true",
        help="Enable brute-force password discovery mode",
    )
    parser.add_argument(
        "--wordlist",
        default=str(Path(__file__).parent / "wordlists" / "common-router-passwords.txt"),
        help="Path to password wordlist file",
    )
    parser.add_argument(
        "--max-attempts",
        type=int,
        default=500,
        help="Maximum passwords to try in discovery mode (default: 500)",
    )
    parser.add_argument(
        "--username",
        default="admin",
        help="Username to use for discovery (default: admin)",
    )

    args = parser.parse_args()

    # Discovery mode
    if args.discover:
        _run_discovery(args)
        return

    # Default credential scan mode
    known_creds = []
    if args.known_user and args.known_pass:
        known_creds.append((args.known_user, args.known_pass))

    scanner = DefaultCredentialScanner(
        target_url=args.url,
        db_path=args.db,
        seed_path=args.seed,
        test_login=not args.report_only,
        timeout=args.timeout,
        known_creds=known_creds,
    )

    result = scanner.scan()

    if args.output == "json":
        print(json.dumps(result, indent=2))
    else:
        _print_text(result)

    if result.get("success"):
        sys.exit(2)
    elif result.get("simulated"):
        sys.exit(0)
    else:
        sys.exit(0)


def _run_discovery(args):
    """Run password discovery mode."""
    from discover import PasswordDiscovery

    discovery = PasswordDiscovery(
        target_url=args.url,
        wordlist_path=args.wordlist,
        username=args.username,
        max_attempts=args.max_attempts,
        timeout=args.timeout,
    )

    result = discovery.discover()

    # Output final summary (progress events already printed to stdout)
    if args.output == "text":
        _print_discovery_text(result)

    if result.get("success"):
        sys.exit(3)
    else:
        sys.exit(0)


def _print_discovery_text(result: dict):
    """Print human-readable discovery output."""
    model = result.get("model", "Unknown")

    print(f"\n{'='*50}")
    print(f"  Password Discovery Results")
    print(f"{'='*50}")
    print(f"  Model:  {model}")
    print(f"  Target: {result.get('username', 'admin')}@router")
    print(f"  Time:   {result.get('elapsed_seconds', 0)}s")

    if result.get("success"):
        print(f"\n  *** PASSWORD DISCOVERED ***")
        print(f"  Username: {result['username']}")
        print(f"  Password: {result['password']}")
        print(f"  Found at attempt: {result['attempted']}/{result['total']}")
    else:
        print(f"\n  Status:   Password NOT found in wordlist")
        print(f"  Tested:   {result.get('attempted', 0)}/{result.get('total', 0)}")
        lockouts = result.get("lockout_encounters", 0)
        if lockouts:
            print(f"  Lockouts: {lockouts} (bypassed via JS injection)")

    print(f"{'='*50}\n")


def _print_text(result: dict):
    """Print human-readable output."""
    model = result.get("model", "Unknown")
    vendor = result.get("vendor", "Unknown")
    tested = result.get("tested", 0)

    print(f"\n{'='*50}")
    print(f"  Default Credential Scan Results")
    print(f"{'='*50}")
    print(f"  Model:  {model}")
    print(f"  Vendor: {vendor or 'N/A'}")

    if result.get("simulated"):
        print(f"\n  Mode:   REPORT ONLY (no logins tested)")
        candidates = result.get("candidates", [])
        if candidates:
            print(f"\n  {len(candidates)} candidate credentials found:")
            for c in candidates:
                print(f"    - {c['username']}:{c['password']}")
        else:
            print(f"\n  No candidate credentials in database.")
    elif result.get("success"):
        cred_type = result.get("credential_type", "default")
        if cred_type == "known":
            print(f"\n  *** CURRENT ACTIVE PASSWORD FOUND ***")
        else:
            print(f"\n  *** DEFAULT CREDENTIALS FOUND ***")
        print(f"  Username: {result['username']}")
        print(f"  Password: {result['password']}")
        print(f"  Tested:   {tested} combinations")
    else:
        print(f"\n  Status:   No credentials found")
        print(f"  Tested:   {tested} combinations")

    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
