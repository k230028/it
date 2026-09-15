<#
.SYNOPSIS
  분석/설계서 작성용 변경 내역 수집기.

.DESCRIPTION
  루트(C:\it)와 it_backend, it_frontend, it_database 네 저장소에서 지정 시각 이후의
  커밋·변경 파일·미커밋 작업 내역을 Markdown 한 장으로 모은다.
  기록만 하며 저장소 상태를 바꾸지 않는다.

.PARAMETER Since
  수집 시작 시각. YYMMDD, YYYYMMDD, YYYY-MM-DD 또는 'YYYY-MM-DD HH:mm' 형식.
  날짜만 주면 그날 00:00부터 포함한다.

.PARAMETER Until
  수집 종료 시각(기본 현재). Since와 같은 형식.

.PARAMETER Root
  워크스페이스 루트(기본: 스크립트 위치에서 역산한 C:\it).

.PARAMETER Output
  결과 Markdown 경로. 생략하면 표준 출력으로 낸다.

.EXAMPLE
  ./collect-changes.ps1 -Since 260914 -Output tmp/design-doc/changes.md
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Since,
    [string]$Until,
    [string]$Root,
    [string]$Output
)

$ErrorActionPreference = 'Stop'
$US = [string][char]0x1f   # git 출력 필드 구분자
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function ConvertTo-DateTimeArg {
    param([string]$Value, [switch]$EndOfDay)
    $v = $Value.Trim()
    $formats = @('yyMMdd', 'yyyyMMdd', 'yyyy-MM-dd', 'yyyy-MM-dd HH:mm', 'yyyy-MM-dd HH:mm:ss')
    foreach ($f in $formats) {
        try {
            $dt = [datetime]::ParseExact($v, $f, [System.Globalization.CultureInfo]::InvariantCulture)
            if ($EndOfDay -and $f.Length -le 10) { $dt = $dt.Date.AddDays(1).AddSeconds(-1) }
            return $dt
        } catch { }
    }
    throw "시각 형식을 해석할 수 없습니다: '$Value' (허용: YYMMDD, YYYYMMDD, YYYY-MM-DD, 'YYYY-MM-DD HH:mm')"
}

if (-not $Root) { $Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path }
$sinceDt = ConvertTo-DateTimeArg $Since
$untilDt = if ($Until) { ConvertTo-DateTimeArg $Until -EndOfDay } else { Get-Date }
$sinceArg = $sinceDt.ToString('yyyy-MM-dd HH:mm:ss')
$untilArg = $untilDt.ToString('yyyy-MM-dd HH:mm:ss')

$repos = @(
    @{ Name = 'root';        Path = $Root;                            Kind = '공통 문서·도구' },
    @{ Name = 'it_backend';  Path = (Join-Path $Root 'it_backend');   Kind = '소스코드(백엔드)' },
    @{ Name = 'it_frontend'; Path = (Join-Path $Root 'it_frontend');  Kind = '소스코드(프론트)' },
    @{ Name = 'it_database'; Path = (Join-Path $Root 'it_database');  Kind = 'DB' }
)

# 파일 경로를 설계서 분류 축으로 매핑한다. 첫 매칭이 우선한다.
$classifiers = @(
    @{ Label = '화면(page)';        Pattern = '^app/pages/' },
    @{ Label = '컴포넌트';           Pattern = '^app/components/' },
    @{ Label = 'composable·feature'; Pattern = '^app/(composables|features)/' },
    @{ Label = '유틸·타입';          Pattern = '^app/(utils|types|stores|plugins)/' },
    @{ Label = 'i18n·문구';          Pattern = '^(i18n/|scripts/user-facing-copy-allowlist\.json)' },
    @{ Label = '프론트 테스트(Vitest)'; Pattern = '^tests/unit/' },
    @{ Label = '프론트 테스트(E2E)';   Pattern = '^tests/e2e/' },
    @{ Label = 'Controller';         Pattern = '^src/main/java/.*/controller/' },
    @{ Label = 'Service';            Pattern = '^src/main/java/.*/service/' },
    @{ Label = 'Repository';         Pattern = '^src/main/java/.*/repository/' },
    @{ Label = 'DTO·모델';           Pattern = '^src/main/java/.*/(dto|model|entity)/' },
    @{ Label = '백엔드 기타';        Pattern = '^src/main/' },
    @{ Label = '백엔드 테스트(JUnit·Jacoco)'; Pattern = '^src/test/' },
    @{ Label = 'DB 마이그레이션';    Pattern = '^migrations/V' },
    @{ Label = 'DB 검증·데이터';     Pattern = '^migrations/_' },
    @{ Label = '문서';               Pattern = '\.(md|markdown)$|^docs/|^prds/' },
    @{ Label = '의존성·빌드';        Pattern = '(package(-lock)?\.json|build\.gradle|nuxt\.config\.ts|versions\.lock)$' },
    @{ Label = '기타';               Pattern = '.' }
)

function Get-Classification {
    param([string]$Path)
    foreach ($c in $classifiers) { if ($Path -match $c.Pattern) { return $c.Label } }
    return '기타'
}

function Convert-Status {
    param([string]$Code)
    switch -Regex ($Code) {
        '^A' { '신설' }
        '^D' { '삭제' }
        '^R' { '이동' }
        default { '변경' }
    }
}

$sb = [System.Text.StringBuilder]::new()
function Add-Line { param([string]$Text = '') [void]$sb.AppendLine($Text) }

Add-Line "# 변경 내역 수집 결과"
Add-Line
Add-Line "- 수집 구간: $sinceArg ~ $untilArg"
Add-Line "- 수집 시각: $((Get-Date).ToString('yyyy-MM-dd HH:mm'))"
Add-Line "- 작성자(git user.name): $(git -C $Root config user.name)"
Add-Line

$allFiles = @{}   # key: repo|path → @{Repo, Path, Status, Class, Commits}

foreach ($repo in $repos) {
    $p = $repo.Path
    if (-not (Test-Path (Join-Path $p '.git'))) { continue }
    $branch = git -C $p rev-parse --abbrev-ref HEAD
    Add-Line "## 저장소: $($repo.Name) ($branch) — $($repo.Kind)"
    Add-Line

    $log = git -C $p log --since="$sinceArg" --until="$untilArg" --date=format:'%Y-%m-%d %H:%M' --format='%H%x1f%h%x1f%ad%x1f%an%x1f%s' --reverse
    $commits = @($log | Where-Object { $_ })
    Add-Line "### 커밋 ($($commits.Count)건, 오래된 순)"
    Add-Line
    if ($commits.Count -eq 0) { Add-Line "- (없음)"; Add-Line }
    foreach ($line in $commits) {
        $parts = $line -split $US
        $full, $short, $date, $author, $subject = $parts
        Add-Line "- ``$short`` $date $author — $subject"
        $files = git -C $p show --name-status --format= $full | Where-Object { $_ }
        foreach ($f in $files) {
            $cols = $f -split "`t"
            $code = $cols[0]
            $path = if ($code -match '^R') { $cols[2] } else { $cols[1] }
            $status = Convert-Status $code
            if ($code -match '^R') {
                # 구간 안에서 신설된 뒤 이동한 파일은 옛 경로를 지우고 새 경로를 신설로 본다
                $oldKey = "$($repo.Name)|$($cols[1])"
                if ($allFiles.ContainsKey($oldKey)) {
                    if ($allFiles[$oldKey].Status -eq '신설') { $status = '신설' }
                    $allFiles.Remove($oldKey)
                }
            }
            Add-Line "    - [$status] $path"
            $key = "$($repo.Name)|$path"
            if (-not $allFiles.ContainsKey($key)) {
                $allFiles[$key] = [pscustomobject]@{ Repo = $repo.Name; Path = $path; Status = $status; Class = (Get-Classification $path); Commits = [System.Collections.Generic.List[string]]::new() }
            } elseif ($status -eq '삭제') {
                $allFiles[$key].Status = '삭제'
            }
            $allFiles[$key].Commits.Add($short)
        }
    }
    Add-Line

    $dirty = @(git -C $p status --porcelain | Where-Object { $_ })
    Add-Line "### 미커밋 작업 ($($dirty.Count)건)"
    Add-Line
    if ($dirty.Count -eq 0) { Add-Line "- (없음)" }
    foreach ($d in $dirty) {
        $code = $d.Substring(0, 2).Trim()
        $path = $d.Substring(3).Trim()
        $status = switch -Regex ($code) { '^\?\?|^A' { '신설' } '^D' { '삭제' } default { '변경' } }
        Add-Line "- [$status·미커밋] $path"
        $key = "$($repo.Name)|$path"
        if (-not $allFiles.ContainsKey($key)) {
            $allFiles[$key] = [pscustomobject]@{ Repo = $repo.Name; Path = $path; Status = $status; Class = (Get-Classification $path); Commits = [System.Collections.Generic.List[string]]::new() }
        }
        $allFiles[$key].Commits.Add('(미커밋)')
    }
    Add-Line
}

Add-Line "## 변경 파일 집계 (저장소 → 분류 → 파일)"
Add-Line
$grouped = $allFiles.Values | Sort-Object { $_.Repo }, { $_.Class }, { $_.Path }
foreach ($repoGroup in ($grouped | Group-Object Repo)) {
    Add-Line "### $($repoGroup.Name) ($($repoGroup.Count)파일)"
    Add-Line
    foreach ($classGroup in ($repoGroup.Group | Group-Object Class)) {
        Add-Line "- **$($classGroup.Name)** ($($classGroup.Count))"
        foreach ($f in $classGroup.Group) {
            $c = ($f.Commits | Select-Object -Unique) -join ','
            Add-Line "  - [$($f.Status)] $($f.Path) ($c)"
        }
    }
    Add-Line
}

Add-Line "## 일자별 활동 (진행경과 초안용, 시각 오름차순)"
Add-Line
# 진행경과 한 줄은 'YY.MM.DD(요일) HH:MM 단위이므로 커밋 시각(분)과 해시를 함께 남긴다
$events = [System.Collections.Generic.List[object]]::new()
foreach ($repo in $repos) {
    $p = $repo.Path
    if (-not (Test-Path (Join-Path $p '.git'))) { continue }
    $rows = git -C $p log --since="$sinceArg" --until="$untilArg" --date=format:'%Y-%m-%d %H:%M' --format='%ad%x1f%h%x1f%s' --reverse | Where-Object { $_ }
    foreach ($r in $rows) {
        $d, $h, $s = $r -split $US
        $events.Add([pscustomobject]@{ At = [datetime]::ParseExact($d, 'yyyy-MM-dd HH:mm', $null); Repo = $repo.Name; Hash = $h; Subject = $s })
    }
    # 미커밋 작업은 해시가 없으므로 변경 파일의 최종 수정 시각을 사건 시각으로 쓴다
    $dirtyPaths = @(git -C $p status --porcelain | Where-Object { $_ } | ForEach-Object { $_.Substring(3).Trim() })
    $dirtyFiles = @($dirtyPaths | ForEach-Object { Get-Item -LiteralPath (Join-Path $p $_) -ErrorAction SilentlyContinue } | Where-Object { $_ -and -not $_.PSIsContainer })
    if ($dirtyFiles.Count -gt 0) {
        $latest = ($dirtyFiles | Sort-Object LastWriteTime | Select-Object -Last 1).LastWriteTime
        $events.Add([pscustomobject]@{ At = $latest; Repo = $repo.Name; Hash = '(미커밋)'; Subject = "미커밋 $($dirtyPaths.Count)건 · 최종 수정 시각 기준" })
    }
}
$dayNames = @('일', '월', '화', '수', '목', '금', '토')
foreach ($dayGroup in ($events | Sort-Object At | Group-Object { $_.At.ToString('yyyy-MM-dd') })) {
    $dt = [datetime]::ParseExact($dayGroup.Name, 'yyyy-MM-dd', $null)
    $label = "'" + $dt.ToString('yy.MM.dd') + '(' + $dayNames[[int]$dt.DayOfWeek] + ')'
    Add-Line "- $label — $($dayGroup.Count)건"
    foreach ($e in $dayGroup.Group) { Add-Line "  - $($e.At.ToString('HH:mm')) ``$($e.Hash)`` $($e.Repo): $($e.Subject)" }
}
Add-Line

Add-Line "## 참고 문서 후보"
Add-Line
$docCandidates = $allFiles.Values | Where-Object { $_.Repo -eq 'root' -and $_.Path -match '^(prds/|docs/superpowers/(specs|plans)/).*.md$' } | Sort-Object Path
foreach ($doc in $docCandidates) { Add-Line "- $($doc.Path) [$($doc.Status)]" }
$prdRecent = Get-ChildItem (Join-Path $Root 'prds') -Recurse -Filter 'PRD_*.md' -ErrorAction SilentlyContinue |
    Where-Object { $_.BaseName -match 'PRD_(\d{8})' -and ([datetime]::ParseExact($Matches[1], 'yyyyMMdd', $null)) -ge $sinceDt.AddDays(-7) } |
    ForEach-Object { $_.FullName.Substring($Root.Length + 1).Replace('\', '/') }
foreach ($prd in $prdRecent) { if ($docCandidates.Path -notcontains $prd) { Add-Line "- $prd [기간 근접 PRD]" } }
Add-Line "- TASK.md / TASK_DONE.md (기간 내 등록·완료 항목 확인)"

$text = $sb.ToString()
if ($Output) {
    $dir = Split-Path -Parent $Output
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
    [System.IO.File]::WriteAllText($Output, $text, [System.Text.UTF8Encoding]::new($false))
    Write-Host "수집 결과 저장: $Output ($($allFiles.Count)파일)"
} else {
    Write-Output $text
}
