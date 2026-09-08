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
    Write-Host 'Port 4181 is already in use. Keep the existing GT Paddock companion running, or close it before starting another.'
    Read-Host 'Press Enter to close'
    exit 0
}
Write-Host 'GT Paddock companion / Keep this window open while driving.'
Write-Host 'Enter the pairing code below in Live telemetry. Ctrl+C stops recording.'
Set-Location -LiteralPath $root
& $python -u (Join-Path $PSScriptRoot 'main.py') --ps-ip $PlayStationIP
Read-Host 'Companion stopped. Press Enter to close'
