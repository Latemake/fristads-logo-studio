$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
$studioAddress = 'http://localhost:3000'
Set-Location -LiteralPath $studioRoot
try {
    $studioRunning = $false
    try {
        $studioHealth = Invoke-RestMethod -Uri "$studioAddress/api/health" -TimeoutSec 2
        $studioRunning = $studioHealth.app -eq 'fristads-logo-studio'
    } catch { }
    if (-not $studioRunning) {
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Asenna Node.js 22 tai uudempi ja kaynnista uudelleen.' }
        if (-not (Test-Path -LiteralPath (Join-Path $studioRoot 'node_modules'))) {
            & npm.cmd install
            if ($LASTEXITCODE -ne 0) { throw 'Riippuvuuksien asennus epaonnistui.' }
        }
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw 'Sovelluksen koonti epaonnistui.' }
        $studioNode = (Get-Command node).Source
        $studioData = Join-Path $studioRoot 'data'
        New-Item -ItemType Directory -Path $studioData -Force | Out-Null
        Start-Process -FilePath $studioNode -ArgumentList @('server/index.js','--production') -WorkingDirectory $studioRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $studioData 'server.log') -RedirectStandardError (Join-Path $studioData 'server-error.log')
        for ($studioAttempt = 0; $studioAttempt -lt 30; $studioAttempt++) {
            Start-Sleep -Milliseconds 500
            try {
                $studioHealth = Invoke-RestMethod -Uri "$studioAddress/api/health" -TimeoutSec 1
                if ($studioHealth.app -eq 'fristads-logo-studio') { $studioRunning = $true; break }
            } catch { }
        }
        if (-not $studioRunning) { throw 'Palvelin ei kaynnistynyt. Tarkista data/server-error.log ja ettei portti 3000 ole varattu.' }
    }
    Start-Process $studioAddress
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Sulje painamalla Enter'
    exit 1
}
