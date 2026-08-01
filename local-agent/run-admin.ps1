Set-ExecutionPolicy Bypass -Scope Process -Force
$DIR = "C:\xampp\htdocs\3rdlaravel\local-agent"

Write-Host "=== Step 1: Setup Certificates & Hosts ===" -ForegroundColor Cyan
& "$DIR\setup-proxy.ps1"

if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    Write-Host "Setup had issues, continuing anyway..." -ForegroundColor Yellow
}

Write-Host "`n=== Step 2: Starting Proxy Server ===" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the proxy.`n" -ForegroundColor Yellow

node "$DIR\openrouter-proxy.js"

Read-Host "`nProxy stopped. Press Enter to exit."
