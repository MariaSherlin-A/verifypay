# One-click restart for the VerifyPay CRE runner (Windows).
# The website (Vercel) and backend (Railway) run in the cloud; only this runner runs on the laptop.
# After a shutdown, run this: it opens the live site and starts the runner, which catches up on
# every registration it missed (it remembers the last block it checked in .state.json).
#
# Usage: double-click start.bat, or:  powershell -ExecutionPolicy Bypass -File start.ps1 [--recheck-now] [--dry-run]

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# Make the CRE CLI and Bun findable even in a terminal opened before they were installed.
$env:Path = "$env:LOCALAPPDATA\Programs\cre;$env:USERPROFILE\.bun\bin;" + $env:Path

foreach ($tool in 'node', 'cre', 'bun') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "Missing '$tool'. Install it first (see cre/README.md)." -ForegroundColor Red
        exit 1
    }
}
if (-not (Test-Path '..\.env')) {
    Write-Host "cre\.env is missing (it must contain CRE_ETH_PRIVATE_KEY)." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path 'node_modules')) { npm i }

Write-Host 'Opening the live site: https://verifypay-arc.vercel.app' -ForegroundColor Cyan
Start-Process 'https://verifypay-arc.vercel.app'

Write-Host 'Starting the CRE runner. Keep this window open; Ctrl+C stops it.' -ForegroundColor Cyan
Write-Host 'If it says you are not logged in, run:  cre login' -ForegroundColor DarkGray
node runner.mjs @args
