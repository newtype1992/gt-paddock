param([string]$PlayStationIP = '192.168.2.20')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
    Write-Host 'The companion environment is missing. See companion/README.md for installation.'
    Read-Host 'Press Enter to close'
    exit 1
}
if (Get-NetTCPConnection -State Listen -LocalPort 4181 -ErrorAction SilentlyContinue) {
    Write-Host 'The companion port is already in use. Look for GT Paddock Companion in the taskbar. Older versions show the pairing code in their terminal. Stop that companion before launching this updated window; do not interrupt an active drive.'
    Read-Host 'Press Enter to close'
    exit 0
}
Write-Host 'GT Paddock companion / Keep this window open while driving.'
Write-Host 'Use Copy code in the GT Paddock Companion window, then paste into Live telemetry.'
Set-Location -LiteralPath $root
& $python -u (Join-Path $PSScriptRoot 'main.py') --ps-ip $PlayStationIP --pairing-window
Read-Host 'Companion stopped. Press Enter to close'
