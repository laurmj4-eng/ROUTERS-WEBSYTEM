$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
foreach ($pidFile in @('relay.pid', 'tunnel.pid')) {
    $pf = Join-Path $root $pidFile
    if (Test-Path $pf) {
        $old = (Get-Content $pf -Raw).Trim()
        if ($old -and (Get-Process -Id $old -ErrorAction SilentlyContinue)) {
            Stop-Process -Id $old -Force -ErrorAction SilentlyContinue
            Write-Host "stopped $pidFile (pid $old)"
        }
        Remove-Item $pf -Force -ErrorAction SilentlyContinue
    }
}
Write-Host 'Relay stopped.'
