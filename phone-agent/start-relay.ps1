# Starts the phone-agent relay + cloudflared tunnel and auto-saves the fresh
# tunnel URL to the live site (/api/relay/pldt/tunnel-url). Double-click
# start-relay.cmd (or run this) after every PC reboot — no URL pasting needed.
# -BootDelay: sleep this many seconds before starting (used by the autostart
# scheduled task so WiFi/internet is up before cloudflared connects).
param([int]$BootDelay = 0)
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$cfgFile = Join-Path $root 'config.json'
$cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$liveSite = 'https://piso-wifi-tools.onrender.com'

if ($BootDelay -gt 0) {
    Write-Host "Waiting $BootDelay s for network..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $BootDelay
}

if (Test-Path $cfgFile) {
    try { $cfg = Get-Content $cfgFile -Raw | ConvertFrom-Json } catch { }
}
if (-not $cfg.relay_token) {
    Write-Host 'ERROR: relay_token is empty in config.json' -ForegroundColor Red
    exit 1
}
if ($cfg.live_site) { $liveSite = $cfg.live_site }

Write-Host 'Starting PLDT relay...' -ForegroundColor Cyan

# 1. Stop any previous relay/tunnel started by this script
foreach ($pidFile in @('relay.pid', 'tunnel.pid')) {
    $pf = Join-Path $root $pidFile
    if (Test-Path $pf) {
        $old = (Get-Content $pf -Raw).Trim()
        if ($old -and (Get-Process -Id $old -ErrorAction SilentlyContinue)) {
            Stop-Process -Id $old -Force -ErrorAction SilentlyContinue
            Write-Host "  stopped old process $old ($pidFile)" -ForegroundColor DarkGray
        }
        Remove-Item $pf -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 2

# 2. Start the relay (node server.cjs)
$relay = Start-Process node -ArgumentList 'server.cjs' -WorkingDirectory $root `
    -WindowStyle Hidden -RedirectStandardOutput (Join-Path $root 'relay.log') `
    -RedirectStandardError (Join-Path $root 'relay.err.log') -PassThru
$relay.Id | Set-Content (Join-Path $root 'relay.pid')
Write-Host "  relay started (pid $($relay.Id))" -ForegroundColor DarkGray

$ready = $false
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 3
        if ($h.ok) { $ready = $true; break }
    } catch { }
}
if (-not $ready) {
    Write-Host 'ERROR: relay did not start. Check relay.err.log' -ForegroundColor Red
    exit 1
}
Write-Host '  relay healthy on 8787' -ForegroundColor DarkGray

# 3. Start the tunnel (quick tunnel on trycloudflare.com)
if (-not (Test-Path $cloudflared)) {
    Write-Host "ERROR: cloudflared not found at $cloudflared. Install: winget install --id cloudflare.cloudflared" -ForegroundColor Red
    exit 1
}
$tunnel = Start-Process $cloudflared -ArgumentList 'tunnel', '--url', 'http://127.0.0.1:8787' `
    -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $root 'tunnel.log') `
    -RedirectStandardError (Join-Path $root 'tunnel.err.log') -PassThru
$tunnel.Id | Set-Content (Join-Path $root 'tunnel.pid')
Write-Host "  tunnel started (pid $($tunnel.Id))" -ForegroundColor DarkGray

$url = $null
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    $log = ''
    foreach ($f in @('tunnel.err.log', 'tunnel.log')) {
        if (Test-Path (Join-Path $root $f)) { $log += Get-Content (Join-Path $root $f) -Raw }
    }
    $m = [regex]::Match($log, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($m.Success) { $url = $m.Value; break }
}
if (-not $url) {
    Write-Host 'ERROR: no tunnel URL within 60s. Check tunnel.err.log' -ForegroundColor Red
    exit 1
}
Write-Host "Tunnel URL: $url" -ForegroundColor Green

# 4. Save it to the live site so the Relay card is always current.
#    Form-encoded POST: PowerShell 5.1 mangles embedded double quotes when
#    passing -d JSON to native curl.exe (the data would arrive quote-less).
$token = $cfg.relay_token
$post = & curl.exe -s -X POST -H "X-Relay-Token: $token" -H 'Content-Type: application/x-www-form-urlencoded' --data-urlencode "url=$url" "$liveSite/api/relay/pldt/tunnel-url"
Write-Host "Saved to live site: $post" -ForegroundColor DarkGray

Write-Host ''
Write-Host 'Relay is live. Scans work from the live site now.' -ForegroundColor Green
Write-Host 'Keep this window closed/minimized. To stop: close it or run stop-relay.' -ForegroundColor DarkGray
