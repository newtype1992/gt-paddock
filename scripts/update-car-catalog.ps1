$ErrorActionPreference = 'Stop'
$commit = (Invoke-RestMethod 'https://api.github.com/repos/ddm999/gt7info/commits/web-new').sha
$base = "https://raw.githubusercontent.com/ddm999/gt7info/$commit/_data/db"
$makers = @{}
(Invoke-RestMethod "$base/maker.csv" | ConvertFrom-Csv) | ForEach-Object { $makers[$_.ID] = $_.Name }
$cars = [ordered]@{}
(Invoke-RestMethod "$base/cars.csv" | ConvertFrom-Csv) | ForEach-Object {
    $cars[$_.ID] = @{ model = $_.ShortName; manufacturer = $makers[$_.Maker] }
}
if ($cars['82'].model -ne "Supra RZ '97" -or $cars.Count -lt 400) { throw 'Unexpected car catalog' }
$catalog = @{ source = 'https://github.com/ddm999/gt7info'; commit = $commit; cars = $cars }
$catalog | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot '../src/gt7-cars.json')
Write-Output "Imported $($cars.Count) car models at $commit"
