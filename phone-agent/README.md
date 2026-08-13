# phone-agent

Runs the PLDT router WiFi scan (admin AND adminpldt) on **Termux (Android phone)**
with **zero browser automation** — pure HTTP via `curl` (the router blocks Node's
TLS stack, but accepts curl). Exposes the same relay contract as the Render
service expects, so the live site can scan the router even when the PC is off.

```
live site (Render)  -->  cloudflared tunnel  -->  phone-agent :8787  -->  router (curl)
```

## Files

- `scanner.cjs` — pure-HTTP router scanner (login.cgi session, WlanBasic read,
  cfgfiledown.cgi config download, Huawei AES decrypt, PBKDF2/SHA-256 admin
  hash extraction + wordlist crack). No npm dependencies.
- `server.cjs` — token-guarded HTTP relay: `POST /check-connection`,
  `POST /wifi-scan`, `POST /scan-password` (same contract as
  `RelayPldtController`).
- `config.json` — router host + admin/adminpldt credentials + relay token
  (copy from `config.example.json`; also overridable via env `RELAY_TOKEN`,
  `RT_HOST`).
- `start.sh` — starts server + cloudflared tunnel (Termux).
- `start-relay.cmd` / `start-relay.ps1` — Windows one-click: starts relay +
  tunnel, then **auto-saves the fresh tunnel URL to the live site** (no
  re-pasting in the Relay card). `stop-relay.cmd` stops both.
- `install-autostart.cmd` / `uninstall-autostart.cmd` — install/remove the
  autostart: copies `start-relay-hidden.vbs` into the Windows Startup folder,
  so the relay starts automatically at every logon (hidden, 45s network
  delay, no admin needed). Requires the PC to auto-login.

## Termux setup (first time, on the phone)

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs curl cloudflared termux-api
termux-wake-lock
```

## Configure

```bash
cd phone-agent
cp config.example.json config.json
nano config.json
```

Set:

- `relay_token` — MUST equal the `RELAY_TOKEN` environment variable set on
  Render (same value the live site uses to authenticate relay calls).
- `host` — the router IP reachable from the phone's WiFi (default `192.168.1.1`).
- `admin.username` / `admin.password` — normal admin account.
- `adminpldt.username` / `adminpldt.password` — PLDT superadmin account
  (default `adminpldt` / `AC2DIU7QW3ERTY6UPAS4DFG`).

## Run (Windows, recommended)

The PC is the relay: double-click **`start-relay.cmd`** after every boot. It
starts the relay + cloudflared and saves the new tunnel URL to the live site
automatically (`POST /api/relay/pldt/tunnel-url`, shared token) — nothing to
paste. Stop with `stop-relay.cmd`.

The PC must stay on the WiFi that reaches the router (`config.json` → `host`).

## Auto-start on boot (optional, Windows)

```bat
cd C:\xampp\htdocs\3rdlaravel\phone-agent
install-autostart.cmd
```

Copies `start-relay-hidden.vbs` into the Windows Startup folder: at every
logon the relay + tunnel start hidden (45s delay for the network), and the
fresh tunnel URL is saved to the live site automatically. The PC must boot
straight into Windows (auto-login). Verify with
`dir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PisoPldtRelay.vbs"`;
remove with `uninstall-autostart.cmd`.

## Run (Termux)

```bash
./start.sh
```

cloudflared prints a URL like `https://xxx.trycloudflare.com`. Keep Termux in
the foreground (or use `tmux`). **The URL changes every restart** — after each
restart, open the live site, Router Settings → Relay, paste the new URL and
click Test.

The phone must stay connected to the WiFi that reaches the router.

## Test without a tunnel

```bash
node scanner.cjs check
node scanner.cjs scan --mode admin
node scanner.cjs scan-password --mode adminpldt
```

## Relay endpoint contract

| Endpoint | Method | Auth header | Body | Returns |
|---|---|---|---|---|
| `/health` | GET | none | — | `{ok:true}` |
| `/check-connection` | POST | `X-Relay-Token` | — | `{success,ip,port,reachable,login,ms}` |
| `/wifi-scan` | POST | `X-Relay-Token` | `{mode?,username?,password?,router_ip?}` | `{success,data:[{band,ssid,password}],elapsed}` |
| `/scan-password` | POST | `X-Relay-Token` | `{username?,password?,router_ip?}` | `{success,data:{wifi:{ssid_24,password_24,ssid_5g,password_5g},admins:[...],other_credentials:[...]},elapsed}` |

`wifi-scan` data matches the app's `WifiPassword` rows: `band` = `2.4G` | `5G`.
`scan-password` runs the adminpldt (config download) tool — same output shape
as `getxml_file.js` on the PC agent.

## Notes

- Nothing is modified on the router: login session + config download only
  (read-only). The adminpldt overlay is a password-change form and is never
  submitted.
- The router locks an account temporarily after ~5 failed login attempts
  (firmware `LoginTimes`/`LockLeftTime`). The scanner sends exactly ONE
  login attempt per account per run (browser-style flow for `admin`, plain
  flow for `adminpldt`) so it never triggers the lock itself. If a lock is
  already active, wait a few minutes and retry.
- **One session per IP:** the firmware keeps only ONE active account session
  per client IP and rejects a different account's login until the existing
  session expires (idle timeout ~10-30 min, no server logout endpoint). So
  don't run `wifi-scan` (admin) and `scan-password` (adminpldt) back to
  back — wait a few minutes between them, and avoid logging into the router
  UI from the same WiFi right before a scan. When the login fails for this
  reason the scanner says so explicitly.
- If the router asks for a captcha, the login fails with a clear message —
  keep creds correct and the captcha won't appear.
- `config.json` and `*.txt` jar files are gitignored — never commit the token.
