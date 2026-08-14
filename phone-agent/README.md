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

One paste does everything (installs, clones, configures the token, starts):

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs curl cloudflared termux-api git openssh termux-wake-lock
git clone --depth 1 https://github.com/laurmj4-eng/ROUTERS-WEBSYTEM.git
cd ROUTERS-WEBSYTEM/phone-agent
cp config.example.json config.json
sed -i 's/CHANGE_ME_to_the_RELAY_TOKEN_from_Render/olyzSW1HpvhjPG4XukxDcaVQ92FqdT3Yme8ObwRABMsLgC6E/' config.json
./start.sh
```

## Configure (manual, only if you didn't use the one-paste)

```bash
cd ROUTERS-WEBSYTEM/phone-agent
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
cd ROUTERS-WEBSYTEM/phone-agent
./start.sh
```

`start.sh` starts the relay, then tries cloudflared (trycloudflare.com). If
that network blocks Cloudflare (TLS error), it **automatically falls back to
a localhost.run tunnel**. Whichever URL appears is **auto-saved to the live
site** (`/api/relay/pldt/tunnel-url`) — nothing to paste. Keep Termux open
(`termux-wake-lock` is applied automatically). Ctrl+C stops it.

The phone must be on the WiFi that reaches the target router
(`config.json` → `host`, default `192.168.1.1`).

> Only ONE relay URL is live at a time — the last device that started its
> relay wins. When the phone relays, the home PC's relay should be stopped
> (or will re-take over on its next start).

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
  login attempt per account per run so it never triggers the lock itself.
  If a lock is already active, wait a few minutes and retry.
- **adminpldt login requires `Referer: https://host/admin.html`** (the login
  form lives on `/admin.html`, not `/login.asp`). Any other referer makes the
  router answer "Waiting..." and grant NO session — this was the root cause of
  every "no session granted"/"blocked" failure. The scanner sends the correct
  referer on both `GetRandCount` and `login.cgi`, plus `Origin` (matching the
  real form submit).
- **One session per IP (any account):** the firmware keeps only ONE active
  account session per client IP and rejects ANY login while it is held
  (verified live: an admin session blocks adminpldt logins). Sessions expire
  on their own (~15-20 min observed), there is no logout endpoint, and only a
  router reboot clears them instantly. Consequences:
  - `wifi-scan` (admin) and `scan-password` (adminpldt) cannot overlap — but
    with a ~15-20 min TTL, waiting a short while between them works.
  - Don't keep `192.168.1.1` open in any browser while scanning from the
    same network — the tab's session blocks the scan until it expires.
  - `check-connection` never logs in (TCP + login-page probe only), so the
    Test button and pre-checks do NOT create sessions.
  - `scan-password` goes straight to adminpldt (the only account that can
    download the config) and never logs in as admin first — an admin-first
    step would block its own adminpldt login (one session per IP).
  - Since `scan-password` returns the wifi passwords too (plaintext from the
    config file), prefer it as the single scan — avoid `wifi-scan` unless the
    config download fails.
- `config.json` and `*.txt` jar files are gitignored — never commit the token.
