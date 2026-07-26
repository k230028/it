# update-versions-lock.ps1
# 용도: it_frontend/it_backend/it_database 서브레포의 origin URL·브랜치·HEAD SHA를 실측해
#       C:\it\versions.lock을 통째로 재작성한다(데이터 행은 멱등, 갱신시각 줄은 매번 갱신).
#       릴리스/재현 시 호환 커밋 조합 기록용.
# 사용: PowerShell에서 .\scripts\update-versions-lock.ps1 실행 (인자 없음)

$ErrorActionPreference = 'Stop'

# 루트 저장소 경로는 스크립트 위치 기준으로 고정한다.
$rootDir = Split-Path -Parent $PSScriptRoot
$lockPath = Join-Path $rootDir 'versions.lock'
$subRepos = @('it_frontend', 'it_backend', 'it_database')

# git 명령을 실행하고 실패 시 한글 오류로 즉시 중단한다.
function Get-GitValue([string]$repoPath, [string[]]$gitArgs) {
    $result = (& git -C $repoPath @gitArgs 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $result) {
        throw "git 명령 실패: 저장소 '$repoPath'에서 'git $($gitArgs -join ' ')' 실행에 실패했습니다 (종료 코드: $LASTEXITCODE)."
    }
    return ($result | Select-Object -First 1).ToString().Trim()
}

$lines = @(
    '# 서브레포 커밋 잠금 — 릴리스/재현용. scripts/update-versions-lock.ps1로 갱신.'
    '# 형식: <레포>  <origin URL>  <브랜치>  <HEAD SHA>  (갱신시각은 마지막 줄 주석)'
)

foreach ($repo in $subRepos) {
    $repoPath = Join-Path $rootDir $repo
    if (-not (Test-Path (Join-Path $repoPath '.git'))) {
        throw "서브레포 경로가 없거나 git 저장소가 아닙니다: $repoPath"
    }
    $origin = Get-GitValue $repoPath @('remote', 'get-url', 'origin')
    $branch = Get-GitValue $repoPath @('branch', '--show-current')
    $sha    = Get-GitValue $repoPath @('rev-parse', 'HEAD')
    $lines += ('{0,-12} {1,-45} {2,-5} {3}' -f $repo, $origin, $branch, $sha)
}

$lines += ('# 갱신시각: {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))

# versions.lock을 통째로 재작성한다. 에디션(5.1/7) 무관하게 BOM 없는 UTF-8로 고정한다.
[System.IO.File]::WriteAllLines($lockPath, $lines, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "versions.lock 갱신 완료: $lockPath"
