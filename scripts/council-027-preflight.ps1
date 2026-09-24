param(
    [string]$FrontendUrl = 'http://localhost:3000',
    [string]$BackendUrl = 'http://localhost:28080'
)

$ErrorActionPreference = 'Stop'
$failedChecks = [System.Collections.Generic.List[string]]::new()

function Test-LocalEndpoint {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
        Write-Host "[PASS] $Name HTTP $($response.StatusCode)"
        return
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -ge 300 -and $statusCode -lt 500) {
            Write-Host "[PASS] $Name HTTP $statusCode (authentication or redirect response)"
            return
        }
        Write-Host "[FAIL] $Name connection failed: $($_.Exception.Message)"
        $script:failedChecks.Add($Name)
    }
}

Test-LocalEndpoint -Name 'frontend' -Url $FrontendUrl
Test-LocalEndpoint -Name 'backend health' -Url "$BackendUrl/actuator/health"

$sqlplus = Get-Command sqlplus -ErrorAction Stop
$readinessSql = Join-Path $PSScriptRoot 'council-027-readiness.sql'

Write-Host '[INFO] Querying role and eligible-project counts without personal identifiers.'
& $sqlplus.Source '-s' '/ as sysdba' "@$readinessSql"
if ($LASTEXITCODE -ne 0) {
    throw "[FAIL] Oracle readiness query failed (exit=$LASTEXITCODE)"
}

if ($failedChecks.Count -gt 0) {
    throw "[FAIL] COUNCIL-027 preflight failed: $($failedChecks -join ', ')"
}

Write-Host '[PASS] COUNCIL-027 preflight completed.'
