# Starts Prelegal locally on Windows: builds the static frontend and runs the
# FastAPI backend in the background with uv. (Temporary: Docker will replace this.)
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $Root ".run"
$PidFile = Join-Path $RunDir "backend.pid"
$LogFile = Join-Path $RunDir "backend.log"
$Port = if ($env:PORT) { $env:PORT } else { "8000" }
$Url = "http://localhost:$Port"

foreach ($tool in "npm", "uv") {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "'$tool' is required but not installed."
    }
}

if ((Test-Path $PidFile) -and (Get-Process -Id (Get-Content $PidFile) -ErrorAction SilentlyContinue)) {
    Write-Host "Prelegal is already running at $Url (pid $(Get-Content $PidFile))."
    exit 0
}

Write-Host "Building frontend..."
Push-Location (Join-Path $Root "frontend")
try {
    if (-not (Test-Path "node_modules")) { npm ci; if ($LASTEXITCODE) { throw "npm ci failed" } }
    npm run build; if ($LASTEXITCODE) { throw "Frontend build failed" }
} finally {
    Pop-Location
}

Write-Host "Starting backend..."
New-Item -ItemType Directory -Force $RunDir | Out-Null
# The backend loads ../.env (OPENROUTER_API_KEY) itself.
$uvArgs = @("run", "prelegal-backend")
$env:PORT = $Port
$proc = Start-Process uv -ArgumentList $uvArgs -WorkingDirectory (Join-Path $Root "backend") `
    -RedirectStandardOutput $LogFile -RedirectStandardError "$LogFile.err" -WindowStyle Hidden -PassThru
Set-Content -Path $PidFile -Value $proc.Id

for ($i = 0; $i -lt 60; $i++) {
    try {
        Invoke-RestMethod "$Url/api/health" -TimeoutSec 2 | Out-Null
        Write-Host "Prelegal is running at $Url (logs: $LogFile)"
        exit 0
    } catch {
        if ($proc.HasExited) { break }
        Start-Sleep -Seconds 1
    }
}
throw "Backend did not start. See $LogFile and $LogFile.err"
