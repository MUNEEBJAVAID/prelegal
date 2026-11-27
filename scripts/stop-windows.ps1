# Stops the Prelegal backend started by start-windows.ps1.
$ErrorActionPreference = "Stop"

$PidFile = Join-Path (Split-Path -Parent $PSScriptRoot) ".run\backend.pid"

if (-not (Test-Path $PidFile)) {
    Write-Host "Prelegal is not running."
    exit 0
}

$backendPid = Get-Content $PidFile
if (Get-Process -Id $backendPid -ErrorAction SilentlyContinue) {
    # /T also stops the Python server that `uv run` launched.
    # (A child may already have exited; that error is harmless.)
    & taskkill /PID $backendPid /T /F *> $null
    Write-Host "Prelegal stopped."
} else {
    Write-Host "Prelegal is not running."
}
Remove-Item $PidFile -Force
