[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$workspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$databaseRoot = Join-Path $workspaceRoot 'it_database'
$backendRoot = Join-Path $workspaceRoot 'it_backend'
$scriptTargets = @(
    (Join-Path $databaseRoot 'apply-ddl-live.ps1'),
    (Join-Path $databaseRoot 'export-ddl-live.ps1'),
    (Join-Path $backendRoot 'scripts\generate-jwt-secret.ps1')
)
$applyScript = $scriptTargets[0]
$exportScript = $scriptTargets[1]
$sentinel = 'SEC11_PASSWORD_SENTINEL_7f3d'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('itp-sec11-{0}' -f [Guid]::NewGuid().ToString('N'))
$originalPath = $env:PATH
$originalPassword = $env:DB_PASSWORD
$hadPassword = Test-Path Env:\DB_PASSWORD

function Assert-Condition {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-Utf8Bom {
    param([string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    Assert-Condition -Condition ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) -Message "UTF-8 BOM is missing: $Path"
}

function Assert-ParseableInWindowsPowerShell {
    param([string]$Path)

    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$errors)
    Assert-Condition -Condition ($errors.Count -eq 0) -Message "Windows PowerShell 5.1 parser errors: $Path - $(($errors | ForEach-Object { $_.Message }) -join '; ')"
}

function Assert-NoPasswordParameter {
    param([string]$Path)

    $command = Get-Command -Name $Path -ErrorAction Stop
    Assert-Condition -Condition (-not $command.Parameters.ContainsKey('Password')) -Message "Password parameter still exists: $Path"
}

function Assert-OracleClientConnectionArguments {
    param(
        [string]$Kind,
        [string]$Mode,
        [string[]]$CapturedArguments
    )

    $expectedConnect = if ($Mode -eq 'wallet') { '/@ITPAPP_SEC11_WALLET' } else { 'ITPAPP@127.0.0.1:11521/XEPDB1' }
    Assert-Condition -Condition ($CapturedArguments -contains $expectedConnect) -Message "$Kind $Mode did not pass expected connect identifier: $expectedConnect"

    $loginOptionCount = @($CapturedArguments | Where-Object { $_ -eq '-L' }).Count
    Assert-Condition -Condition ($loginOptionCount -eq 1) -Message "$Kind $Mode must pass exactly one -L Oracle client option; found $loginOptionCount"

    if ($Mode -eq 'prompt') {
        Assert-Condition -Condition (-not ($CapturedArguments -contains '-S')) -Message "$Kind prompt mode must allow Oracle password prompt by omitting -S"
    } else {
        Assert-Condition -Condition ($CapturedArguments -contains '-S') -Message "$Kind wallet mode should use silent Oracle client option"
    }
}

function Assert-OracleClientArgumentAssertionSelfTest {
    $missingLoginOptionRejected = $false
    try {
        Assert-OracleClientConnectionArguments -Kind 'self-test' -Mode 'prompt' -CapturedArguments @('ITPAPP@127.0.0.1:11521/XEPDB1')
    } catch {
        $missingLoginOptionRejected = $_.Exception.Message -like '*-L Oracle client option*'
    }

    Assert-Condition -Condition $missingLoginOptionRejected -Message 'SEC-11 verifier self-test did not reject synthetic argv without -L'
}

function Assert-FakeOracleClientSqlInspection {
    param(
        [string]$FakeClientCommand,
        [string]$TestDirectory
    )

    $safeSqlPath = Join-Path $TestDirectory 'fake-client-safe.sql'
    $secondSafeSqlPath = Join-Path $TestDirectory 'fake-client-second-safe.sql'
    $secretSqlPath = Join-Path $TestDirectory 'fake-client-secret.sql'
    $safeIncludeSqlPath = Join-Path $TestDirectory 'fake-client-safe-include.sql'
    $secretIncludeSqlPath = Join-Path $TestDirectory 'fake-client-secret-include.sql'
    $selfTestCapturePath = Join-Path $TestDirectory 'fake-client-self-test.argv'
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($safeSqlPath, "PROMPT safe SQL`r`n", $utf8NoBom)
    [System.IO.File]::WriteAllText($secondSafeSqlPath, "PROMPT second safe SQL`r`n", $utf8NoBom)
    [System.IO.File]::WriteAllText($secretSqlPath, "PROMPT $sentinel`r`n", $utf8NoBom)
    [System.IO.File]::WriteAllText($safeIncludeSqlPath, "@`"$secondSafeSqlPath`"`r`n", $utf8NoBom)
    [System.IO.File]::WriteAllText($secretIncludeSqlPath, "@`"$secretSqlPath`"`r`n", $utf8NoBom)
    $env:SEC11_CAPTURE_FILE = $selfTestCapturePath

    & $FakeClientCommand -L 'ITPAPP@127.0.0.1:11521/XEPDB1' "@$safeSqlPath" "@$safeIncludeSqlPath" 2>$null | Out-Null
    $safeExitCode = $LASTEXITCODE
    Assert-Condition -Condition ($safeExitCode -eq 0) -Message "Fake Oracle client rejected sentinel-free synthetic SQL with exit code $safeExitCode"

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $FakeClientCommand -L 'ITPAPP@127.0.0.1:11521/XEPDB1' "@$safeSqlPath" "@$secretSqlPath" 2>$null | Out-Null
        $secretExitCode = $LASTEXITCODE

        & $FakeClientCommand -L 'ITPAPP@127.0.0.1:11521/XEPDB1' "@$secretIncludeSqlPath" 2>$null | Out-Null
        $includedSecretExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    Assert-Condition -Condition ($secretExitCode -ne 0) -Message 'Fake Oracle client did not reject sentinel in the second synthetic @sqlfile'
    Assert-Condition -Condition ($includedSecretExitCode -ne 0) -Message 'Fake Oracle client did not reject sentinel in an included synthetic @sqlfile'
}

function Invoke-OracleScriptAndAssert {
    param(
        [string]$Kind,
        [string]$Mode,
        [string]$CapturePath,
        [string]$ApplyDdlPath,
        [string]$ExportOutputPath
    )

    $env:SEC11_CAPTURE_FILE = $CapturePath
    if ($Kind -eq 'apply') {
        if ($Mode -eq 'wallet') {
            & $applyScript -DdlPath $ApplyDdlPath -LogPath (Join-Path $testRoot ("$Mode-apply.log")) -Client sqlplus -WalletAlias ITPAPP_SEC11_WALLET
        } else {
            & $applyScript -DdlPath $ApplyDdlPath -LogPath (Join-Path $testRoot ("$Mode-apply.log")) -Client sqlplus
        }
    } else {
        if ($Mode -eq 'wallet') {
            & $exportScript -OutputPath $ExportOutputPath -Client sqlplus -WalletAlias ITPAPP_SEC11_WALLET
        } else {
            & $exportScript -OutputPath $ExportOutputPath -Client sqlplus
        }
    }
    Assert-Condition -Condition ($LASTEXITCODE -eq 0) -Message "$Kind $Mode execution failed with exit code $LASTEXITCODE"

    $capturedArguments = @(Get-Content -LiteralPath $CapturePath -ErrorAction Stop)
    $sentinelArgument = $capturedArguments | Where-Object { $_.Contains($sentinel) } | Select-Object -First 1
    Assert-Condition -Condition ($null -eq $sentinelArgument) -Message "$Kind $Mode passed the DB_PASSWORD sentinel to Oracle client argv"

    Assert-OracleClientConnectionArguments -Kind $Kind -Mode $Mode -CapturedArguments $capturedArguments

    if ($Kind -eq 'export') {
        Assert-Condition -Condition (Test-Path -LiteralPath $ExportOutputPath) -Message "Export $Mode did not create the expected DDL output"
    }
}

try {
    Assert-OracleClientArgumentAssertionSelfTest

    foreach ($scriptTarget in $scriptTargets) {
        Assert-Condition -Condition (Test-Path -LiteralPath $scriptTarget) -Message "Missing SEC-11 target: $scriptTarget"
        Assert-NoPasswordParameter -Path $scriptTarget
        Assert-Utf8Bom -Path $scriptTarget
        Assert-ParseableInWindowsPowerShell -Path $scriptTarget
    }

    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    $fakeClientDirectory = Join-Path $testRoot 'fake-oracle-client'
    New-Item -ItemType Directory -Path $fakeClientDirectory -Force | Out-Null
    $fakeClientScript = Join-Path $fakeClientDirectory 'capture-client.ps1'
    $fakeClientCommand = Join-Path $fakeClientDirectory 'sqlplus.cmd'

    [System.IO.File]::WriteAllText($fakeClientScript, @'
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ClientArguments)
$ErrorActionPreference = 'Stop'
[System.IO.File]::WriteAllLines($env:SEC11_CAPTURE_FILE, $ClientArguments)
$sentinel = 'SEC11_PASSWORD_SENTINEL_7f3d'
$pendingSqlPaths = New-Object 'System.Collections.Generic.Queue[string]'
$visitedSqlPaths = @{}

function Resolve-SqlPath {
    param(
        [string]$Candidate,
        [string]$BaseDirectory
    )

    $trimmedCandidate = $Candidate.Trim()
    if ($trimmedCandidate.Length -ge 2 -and $trimmedCandidate.StartsWith('"') -and $trimmedCandidate.EndsWith('"')) {
        $trimmedCandidate = $trimmedCandidate.Substring(1, $trimmedCandidate.Length - 2)
    }
    if (-not [System.IO.Path]::IsPathRooted($trimmedCandidate)) {
        $trimmedCandidate = Join-Path $BaseDirectory $trimmedCandidate
    }
    return [System.IO.Path]::GetFullPath($trimmedCandidate)
}

foreach ($clientArgument in $ClientArguments) {
    if ($clientArgument.StartsWith('@') -and $clientArgument.Length -gt 1) {
        try {
            $pendingSqlPaths.Enqueue((Resolve-SqlPath -Candidate $clientArgument.Substring(1) -BaseDirectory (Get-Location).Path))
        } catch {
            [Console]::Error.WriteLine('Fake Oracle client could not resolve a SQL file.')
            exit 2
        }
    }
}

while ($pendingSqlPaths.Count -gt 0) {
    $sqlPath = $pendingSqlPaths.Dequeue()
    if ($visitedSqlPaths.ContainsKey($sqlPath)) {
        continue
    }
    $visitedSqlPaths[$sqlPath] = $true

    if (-not [System.IO.File]::Exists($sqlPath)) {
        [Console]::Error.WriteLine('Fake Oracle client could not read a SQL file.')
        exit 2
    }
    try {
        $sql = [System.IO.File]::ReadAllText($sqlPath)
    } catch {
        [Console]::Error.WriteLine('Fake Oracle client could not read a SQL file.')
        exit 2
    }
    if ($sql.IndexOf($sentinel, [System.StringComparison]::Ordinal) -ge 0) {
        [Console]::Error.WriteLine('Fake Oracle client rejected SQL input.')
        exit 3
    }

    $spoolMatch = [System.Text.RegularExpressions.Regex]::Match($sql, '(?im)^\s*SPOOL\s+"(?<path>[^"]+)"')
    if ($spoolMatch.Success) {
        $outputPath = $spoolMatch.Groups['path'].Value.Replace('\\', '\')
        [System.IO.File]::WriteAllText($outputPath, '')
    }

    $includeMatches = [System.Text.RegularExpressions.Regex]::Matches($sql, '(?im)^\s*@(?:"(?<quoted>[^"]+)"|(?<plain>[^\s\r\n]+))\s*$')
    foreach ($includeMatch in $includeMatches) {
        $includeCandidate = if ($includeMatch.Groups['quoted'].Success) {
            $includeMatch.Groups['quoted'].Value
        } else {
            $includeMatch.Groups['plain'].Value
        }
        try {
            $pendingSqlPaths.Enqueue((Resolve-SqlPath -Candidate $includeCandidate -BaseDirectory ([System.IO.Path]::GetDirectoryName($sqlPath))))
        } catch {
            [Console]::Error.WriteLine('Fake Oracle client could not resolve a SQL file.')
            exit 2
        }
    }
}
exit 0
'@, (New-Object System.Text.UTF8Encoding($false)))
    [System.IO.File]::WriteAllText($fakeClientCommand, "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0capture-client.ps1`" %*`r`nexit /b %ERRORLEVEL%`r`n", [System.Text.Encoding]::ASCII)

    $env:PATH = "$fakeClientDirectory;$originalPath"
    $env:DB_PASSWORD = $sentinel
    Assert-FakeOracleClientSqlInspection -FakeClientCommand $fakeClientCommand -TestDirectory $testRoot
    $repositoryDdlPath = Join-Path $databaseRoot 'ITPOWN_DDL_live.sql'
    Assert-Condition -Condition (Test-Path -LiteralPath $repositoryDdlPath) -Message "Missing repository DDL fixture: $repositoryDdlPath"
    $repositoryDdlHashBefore = (Get-FileHash -LiteralPath $repositoryDdlPath -Algorithm SHA256).Hash

    Invoke-OracleScriptAndAssert -Kind 'apply' -Mode 'prompt' -CapturePath (Join-Path $testRoot 'apply-prompt.argv') -ApplyDdlPath $repositoryDdlPath -ExportOutputPath $null
    Invoke-OracleScriptAndAssert -Kind 'export' -Mode 'prompt' -CapturePath (Join-Path $testRoot 'export-prompt.argv') -ApplyDdlPath $null -ExportOutputPath (Join-Path $testRoot 'export-prompt.sql')
    Invoke-OracleScriptAndAssert -Kind 'apply' -Mode 'wallet' -CapturePath (Join-Path $testRoot 'apply-wallet.argv') -ApplyDdlPath $repositoryDdlPath -ExportOutputPath $null
    Invoke-OracleScriptAndAssert -Kind 'export' -Mode 'wallet' -CapturePath (Join-Path $testRoot 'export-wallet.argv') -ApplyDdlPath $null -ExportOutputPath (Join-Path $testRoot 'export-wallet.sql')

    $repositoryDdlHashAfter = (Get-FileHash -LiteralPath $repositoryDdlPath -Algorithm SHA256).Hash
    Assert-Condition -Condition ($repositoryDdlHashAfter -eq $repositoryDdlHashBefore) -Message 'Repository DDL changed during fake-client verification'

    Write-Host 'SEC-11 PowerShell verification passed.' -ForegroundColor Green
} finally {
    $env:PATH = $originalPath
    if ($hadPassword) {
        $env:DB_PASSWORD = $originalPassword
    } else {
        Remove-Item Env:\DB_PASSWORD -ErrorAction SilentlyContinue
    }
    Remove-Item Env:\SEC11_CAPTURE_FILE -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
