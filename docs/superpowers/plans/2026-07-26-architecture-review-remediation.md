# 아키텍처 리뷰 조치 Implementation Plan (2026-07-08 리뷰 기준)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/architecture-review-2026-07-08.md`의 미해결 **저장소 위생·문서 정합성** 지적(#1·#2·#4·#5·#7·#8·#9·#15)을 저장소별 원자적 커밋으로 종료하고, 구조 리팩터(#10·#11·#12)와 타입 codegen(#14)은 별도 계획으로 위임한다. DB 부트스트랩(#13)은 조치 불요로 판단해 범위에서 제외한다.

**Architecture:** 변경은 4개 독립 Git 저장소(`C:\it`, `it_backend`, `it_frontend`, `it_database`)에 걸친다. 각 저장소에서 원자적으로 커밋하며, 커밋 전 반드시 해당 저장소 루트로 이동한다. 비밀값·바이너리의 **완전 제거**처럼 히스토리 재작성이 필요한 항목은 "working-tree 정리(즉시 효과)"와 "히스토리 purge(force-push+전원 재클론, 유지보수 창)"로 분리한다. 전 태스크가 문서·설정·추적 정리라 코드 동작을 바꾸지 않는다.

**Tech Stack:** Git / git-filter-repo, PowerShell, Oracle Data Pump(expdp/impdp), Nuxt 4

---

## Global Constraints

- **저장소 경계**: `C:\it`(문서·도구), `it_backend`, `it_frontend`, `it_database`는 각각 독립 Git 저장소다. 커밋은 항상 해당 저장소 루트에서 수행하고, 한 태스크가 두 저장소를 건드리면 각각 원자적 커밋을 만든다.
- **히스토리 재작성 분리**: 이미 커밋된 비밀값/바이너리를 과거 히스토리에서까지 지우는 작업은 **force-push + 전원 재클론**을 유발하므로 기본 태스크에 넣지 않는다. 기본 태스크는 working-tree 추적 해제·치환까지 하고, 히스토리 purge는 각 태스크의 "선택: 히스토리 정리" 절로 분리한다(`it_database/README.MD` §4.2 런북과 동일 원칙).
- **비밀값 비노출**: 평문 비밀번호 원문을 이 문서를 포함한 어떤 신규 추적 파일에도 옮겨 적지 않는다.
- **문서/주석 한글**: 신규 문서·주석은 한글로 작성한다.
- **범위 밖 위임**: 구조 리팩터 지적 #10(백엔드 대형 서비스)·#11(프론트 800줄)·#12(components/editor)는 `docs/clean-code-review-2026-07-07.md` §3.2 및 `docs/superpowers/plans/done/2026-07-21-clean-code-wave2-structure-types.md` 후속으로 위임한다. #14(OpenAPI codegen)은 별도 스파이크로 분리한다. 본 계획은 이들을 구현하지 않는다.
- **검증 후 커밋**: 각 태스크는 grep/빌드/기동 등 검증 명령으로 완료를 확인한 뒤 커밋한다.
- **DB 스키마 규약**: 물리 컬럼명은 `C:\it\meta\meta.txt` 용어를 쓰고 코드/스크립트에 `ITPOWN.` 접두어를 쓰지 않는다. Flyway 파일명은 `V{YYYYMMDD_NNN}__{CamelCase}.sql`이며 적용된 스크립트는 수정하지 않는다.

---

## 1. 범위와 기준선

### 1.1 대상 지적 (open 항목만)

| # | 항목 | 리뷰 상태 | 본 계획 처리 |
| --- | --- | --- | --- |
| 1 | 백엔드 런타임 로그 폴더 로컬 잔존 | 🟡 부분 | 해소 확인만(로컬 폴더 삭제 완료 재실측) |
| 15 | it_database README가 삭제된 connect-db 스크립트 참조 | ⚠️ 잔존 | README 참조 현행화 |
| 9 | 프론트 빌드 캐시·preview 추적 | 🟡 부분 | `tsconfig.test.tsbuildinfo` 추적 해제, `preview/` 이동 |
| 8 | 벤더 SSO 바이너리 + 미사용 lombok.jar 추적 | ⚠️ 잔존 | working-tree 추적 해제 + 외부화 |
| 7 | DB 평문 비밀번호 하드코딩 | ⚠️ 잔존 | 파라미터/환경변수화 + 플레이스홀더 |
| 2 | 4-repo 구조 미문서화 | ⚠️ 잔존 | CLAUDE.md 토폴로지 + `versions.lock` |
| 4 | AGENTS.md 낡은 사본 | 🟡 부분 | 얇은 포인터 문서화 |
| 5 | 작업 추적 채널 분산 | ⚠️ 잔존 | §4.3 역할 명시 + 일회성 문서 정리 |

> #3(meta 경로)·#6(EXPDAT.DMP 정책)은 이미 해소/확정되어 제외한다. #13(DB 빈 스키마 부트스트랩)은 조치 불요로 판단해 범위에서 제외한다.

### 1.2 현재 기준선(2026-07-26 실측)

- `it_backend/LOG_PATH_IS_UNDEFINED/`는 **추적 해제·gitignore 완료**, 로컬 폴더도 삭제 확인(2026-07-26 재실측).
- `it_database/EXPDAT.DMP`는 git 관리 유지 확정(#6). 정리 런북은 `it_database/README.MD` §4.2.
- `it_frontend/tsconfig.test.tsbuildinfo` 추적 중, `.gitignore` 미등록. `it_frontend/preview/*.html` 5건 추적.
- `it_backend/lib/lombok.jar`(~2MB) 추적·미참조(`build.gradle`은 Gradle lombok 의존성 사용). `it_backend/sso/` 24개 파일 추적(.class 5종 포함).
- 평문 비밀번호가 `it_database`의 `export.par`/`import.par`/`import_data_only.par`/`apply-ddl-live.ps1:6`/`export-ddl-live.ps1:6`/`README.MD:130,136`에 잔존.
- `C:\it\.gitignore` 1~3행이 3개 서브레포 제외. 루트에 `versions.lock`/`.gitmodules` 없음.
- `C:\it\AGENTS.md`는 `CLAUDE.md` 대비 82행 상이(포트는 정정됨).
- `it_database/README.MD` 25·30·222·231행이 부재 스크립트 `connect-db.ps1/.bat` 참조.
- 루트 `ETC.md`는 untracked, `DB_GAP.md`는 수정 상태(M)로 미커밋 변경 보유.

---

## 2. 실행 순서

| 단계 | 목적 | 포함 태스크 | 선행조건 |
| --- | --- | --- | --- |
| 1 | 즉시 위생(저위험) | 1-1 로그폴더 확인, 1-2 README connect-db, 1-3 프론트 캐시/preview | 없음 |
| 2 | 저장소 위생(추적 정리) | 2-1 lombok/SSO, 2-2 DB 비밀번호 | 단계 1과 병행 가능 |
| 3 | 문서 정합성 | 3-1 4-repo 토폴로지+versions.lock, 3-2 AGENTS.md, 3-3 작업채널 | 없음 |
| 4 | 후속 위임(범위 밖 기록) | 4-1 구조 리팩터·codegen 위임 메모 | 단계 1~3 |

---

## 3. 단계별 상세 계획

### 단계 1. 즉시 위생

#### 작업 1-1. 백엔드 로그 로컬 폴더 해소 확인 (#1)

대상: it_backend (확인만, 커밋 없음 — 2026-07-26 재실측에서 폴더 삭제 완료 확인)

- [ ] **Step 1: 폴더 부재와 미추적 상태를 확인한다.**

```powershell
cd C:\it\it_backend
Test-Path .\LOG_PATH_IS_UNDEFINED          # => False
git status --short LOG_PATH_IS_UNDEFINED   # 출력 없음
```

Expected: 폴더 없음·추적 없음. 만약 재생성돼 있으면 `Remove-Item -Recurse -Force`로 삭제 후 Step 2로 원인을 확인.

- [ ] **Step 2: logback 기본 경로가 지정돼 폴더가 재생성되지 않는지 확인한다.**

```powershell
Select-String -Path .\src\main\resources\logback-spring.xml -Pattern 'LOG_PATH'
```

Expected: local `c:/itp_log`, prod `/log/springitp` 기본값 존재. 확인 완료 시 #1 종료(리뷰 문서 상태만 갱신).

#### 작업 1-2. it_database README connect-db 참조 현행화 (#15)

대상: it_database

**Files:**
- Modify: `it_database/README.MD` (25, 30, 222, 231행 부근)

- [ ] **Step 1: 부재 스크립트 참조를 확인한다.**

```powershell
cd C:\it\it_database
Select-String -Path .\README.MD -Pattern 'connect-db'
Test-Path .\connect-db.ps1   # => False
Test-Path .\connect-db.bat   # => False
```

Expected: 4개 참조 존재, 두 스크립트 부재.

- [ ] **Step 2: 각 참조를 현재 접속 방법(직접 sqlplus)으로 교체한다.** `connect-db.ps1`/`connect-db.bat` 호출 블록을 아래로 치환하고, "루트 CLAUDE.md §3.1.1 참조" 문구를 남긴다.

```powershell
# 애플리케이션 계정 접속 (connect-db.ps1 대체)
sqlplus ITPAPP/<password>@127.0.0.1:11521/XEPDB1
# 포트 확인 테스트도 동일 접속으로 수행한다.
```

- [ ] **Step 3: 잔여 참조가 없는지 검증한다.**

```powershell
Select-String -Path .\README.MD -Pattern 'connect-db'
```

Expected: 출력 없음(0건).

- [ ] **Step 4: 커밋한다.**

```powershell
cd C:\it\it_database
git add README.MD
git commit -m "docs: README의 부재 connect-db 스크립트 참조를 직접 sqlplus 접속으로 현행화 (#15)"
```

#### 작업 1-3. 프론트 빌드 캐시 추적 해제 + preview 이동 (#9)

대상: it_frontend

**Files:**
- Modify: `it_frontend/.gitignore`
- Untrack: `it_frontend/tsconfig.test.tsbuildinfo`
- Move: `it_frontend/preview/*.html` → `it_frontend/docs/preview/`

- [ ] **Step 1: 현재 추적 상태를 확인한다.**

```powershell
cd C:\it\it_frontend
git ls-files tsconfig.test.tsbuildinfo preview/
```

Expected: `tsconfig.test.tsbuildinfo`과 `preview/*.html` 5건이 나열됨.

- [ ] **Step 2: `.gitignore`에 빌드 캐시를 추가한다.**

```text
# 증분 타입체크 캐시 (빌드 산출물)
tsconfig.test.tsbuildinfo
```

- [ ] **Step 3: 캐시 추적을 해제하고 preview를 docs로 이동한다.**

```powershell
git rm --cached tsconfig.test.tsbuildinfo
New-Item -ItemType Directory -Force docs\preview | Out-Null
git mv preview\*.html docs\preview\
```

- [ ] **Step 4: 정적 검사로 회귀 없음을 확인한다.**

```powershell
npm run check
```

Expected: PASS(타입/lint 0). preview 이동은 소스 참조가 없으므로 빌드 영향 없음(참조가 있으면 경로를 함께 수정).

- [ ] **Step 5: 커밋한다.** `tsconfig.test.tsbuildinfo` 삭제는 Step 3의 `git rm --cached`로 이미 스테이징되어 있고, Step 2에서 gitignore에 등록했으므로 `git add` 대상에 넣으면 "ignored path" 오류가 난다 — add 목록에서 제외한다.

```powershell
git add .gitignore docs/preview
git commit -m "chore: 타입체크 캐시 추적 해제 및 preview를 docs로 이동 (#9)"
```

- [ ] **Step 6: (선택) 히스토리 정리** — 캐시 파일이 커진 이력이 있으면 유지보수 창에서 `git filter-repo --path tsconfig.test.tsbuildinfo --invert-paths` 후 force-push. 크기가 작으면 생략.

---

### 단계 2. 저장소 위생

#### 작업 2-1. lombok.jar 제거 + SSO 벤더 배포물 외부화 (#8)

대상: it_backend

**Files:**
- Untrack/Delete: `it_backend/lib/lombok.jar`
- Untrack + 외부 이전: `it_backend/sso/` (벤더 배포물)
- Modify: `it_backend/.gitignore`

- [ ] **Step 1: lombok이 Gradle 의존성으로 관리되는지 확인한다(=lib/lombok.jar은 중복).**

```powershell
cd C:\it\it_backend
Select-String -Path .\build.gradle -Pattern 'lombok'
git ls-files lib/lombok.jar
```

Expected: `compileOnly`/`annotationProcessor` lombok 존재, `lib/lombok.jar` 추적됨.

- [ ] **Step 2: lombok.jar 추적 해제·삭제 후 빌드가 정상인지 확인한다.**

```powershell
git rm lib/lombok.jar
.\gradlew compileJava --console=plain
```

Expected: 컴파일 PASS(annotation processor는 Gradle 의존성으로 동작).

- [ ] **Step 3: SSO 벤더 배포물을 저장소 밖(사내 아티팩트 저장소/공유 경로)으로 이전하고 추적을 해제한다.** 실제 이전 위치를 팀과 합의한 뒤:

```powershell
# 사내 아티팩트 저장소로 복사(경로는 합의값으로 대체) 후 추적 해제
git rm -r --cached "sso"
```

`.gitignore`에 추가:

```text
/lib/lombok.jar
/sso/
```

- [ ] **Step 4: 빌드/테스트가 SSO 소스에 의존하지 않는지 확인한다.**

```powershell
.\gradlew test --console=plain
```

Expected: PASS(SSO 배포물은 런타임 벤더 산출물이며 Gradle 빌드 입력이 아님). 만약 참조가 발견되면 이전 위치를 빌드 설정에 반영.

- [ ] **Step 5: 커밋한다.**

```powershell
git add .gitignore
git commit -m "chore: 미사용 lib/lombok.jar 제거, SSO 벤더 배포물 저장소 외부화 (#8)"
```

- [ ] **Step 6: (선택) 히스토리 정리** — `.class`/`.jar` 과거 블롭까지 제거하려면 유지보수 창에서 `git filter-repo --path lib/lombok.jar --path sso --invert-paths` 후 force-push + 전원 재클론 공지(README §4.2와 동일 원칙).

#### 작업 2-2. DB 접속 비밀번호 파라미터/환경변수화 (#7)

대상: it_database

**Files:**
- Modify: `it_database/export.par`, `import.par`, `import_data_only.par`
- Modify: `it_database/apply-ddl-live.ps1`, `export-ddl-live.ps1`
- Modify: `it_database/README.MD` (130, 136행 예시)

- [ ] **Step 1: 평문 비밀번호 노출 지점을 확인한다.**

```powershell
cd C:\it\it_database
git grep -n "ITPAPP/" -- *.par *.ps1 README.MD
```

Expected: `.par` 3건 `USERID=...`, `.ps1` 2건, README 2건.

- [ ] **Step 2: `.par`에서 `USERID` 줄을 제거하고 접속은 실행 시 인자로 넘긴다.** 각 `.par`는 `DIRECTORY/DUMPFILE/...`만 유지하고, 실행 예시를 다음으로 바꾼다:

```powershell
# 비밀번호를 파일에 두지 않고 실행 시 전달 (환경변수 활용)
impdp "ITPAPP/$env:DB_PASSWORD@127.0.0.1:11521/xepdb1" parfile=.\import.par
expdp "ITPAPP/$env:DB_PASSWORD@127.0.0.1:11521/xepdb1" parfile=.\export.par
```

- [ ] **Step 3: `.ps1`의 하드코딩 기본값을 환경변수 기본값 + 부재 시 즉시 실패로 바꾼다.** `apply-ddl-live.ps1`·`export-ddl-live.ps1`의 `$Password` 리터럴 기본값을 `$env:DB_PASSWORD`로 교체한다. `[Parameter(Mandatory)]`는 쓰지 않는다 — Mandatory가 붙으면 PowerShell이 기본값을 무시하고 프롬프트를 띄워(비대화형에서는 실패) 환경변수 폴백이 동작하지 않는다.

```powershell
param(
  [string]$Password = $env:DB_PASSWORD,
  # ...기존 파라미터 유지
)
if (-not $Password) { throw 'DB_PASSWORD 환경변수 또는 -Password 인자가 필요합니다.' }
```

- [ ] **Step 4: README 예시의 비밀번호를 플레이스홀더로 교체한다.** `CREATE USER ... IDENTIFIED BY "<password>"` 형태로 바꾸고, "환경변수 `DB_PASSWORD`로 주입" 문구를 추가한다(루트 CLAUDE.md §4.2 원칙 링크).

- [ ] **Step 5: working-tree에 평문 비밀번호가 남지 않았는지 검증한다.** (`ITPAPP/` 단순 검색은 작업 1-2에서 넣는 플레이스홀더 예시 `ITPAPP/<password>`에도 걸리므로 쓰지 않는다.)

```powershell
git grep -n "USERID=" -- *.par                 # 0건 (접속은 실행 시 인자로만)
git grep -nE 'Password *= *"' -- *.ps1         # 리터럴 기본값 0건
Select-String -Path README.MD -Pattern 'IDENTIFIED BY'   # "<password>" 플레이스홀더만
```

Expected: `.par`의 `USERID` 0건, `.ps1` 리터럴 기본값 0건, README는 `<password>` 플레이스홀더만 잔존.

- [ ] **Step 6: 커밋한다.**

```powershell
git add export.par import.par import_data_only.par apply-ddl-live.ps1 export-ddl-live.ps1 README.MD
git commit -m "security: DB 접속 비밀번호를 환경변수/파라미터로 전환하고 문서 예시를 플레이스홀더로 교체 (#7)"
```

- [ ] **Step 7: (선택·권장) 히스토리 정리 + 자격 회전** — 로컬 XE 개발 비밀번호라 위험도는 낮으나, 완전 제거를 원하면 유지보수 창에서 `git filter-repo`로 과거 노출을 제거하고 로컬 DB 비밀번호를 회전한다. 운영 DB에는 이 값이 쓰이지 않음을 재확인한다.

---

### 단계 3. 문서 정합성

#### 작업 3-1. 4-repo 토폴로지 명문화 + versions.lock (#2)

대상: C:\it(루트)

**Files:**
- Modify: `C:\it\CLAUDE.md` (§2 디렉토리 구조)
- Create: `C:\it\versions.lock`
- Create: `C:\it\scripts\update-versions-lock.ps1` (서브레포 HEAD 기록 도구)

- [ ] **Step 1: 현재 서브레포 HEAD를 수집한다.**

```powershell
cd C:\it
foreach ($r in 'it_frontend','it_backend','it_database') {
  "{0} {1}" -f $r, (git -C $r rev-parse HEAD)
}
```

- [ ] **Step 2: `versions.lock`을 생성한다.** 각 서브레포의 origin URL·브랜치·HEAD SHA·기록시각을 한 줄씩 담는다(호환 커밋 조합 기록).

```text
# 서브레포 커밋 잠금 — 릴리스/재현용. update-versions-lock.ps1로 갱신.
it_frontend  https://github.com/gonnabe88/it_frontend  main  <sha>
it_backend   https://github.com/gonnabe88/it_backend   main  <sha>
it_database  https://github.com/gonnabe88/it_database  main  <sha>
```

- [ ] **Step 3: 갱신 스크립트를 만든다.** `scripts/update-versions-lock.ps1`이 위 수집 로직으로 `versions.lock`을 다시 쓰게 한다.

- [ ] **Step 4: CLAUDE.md §2에 4-repo 토폴로지를 명문화한다.** "C:\it는 문서·도구만 추적하고 it_frontend/it_backend/it_database는 각각 독립 원격 저장소이며, 호환 조합은 `versions.lock`에 기록한다. 교차 변경은 백엔드 계약 커밋을 먼저, 이를 참조하는 프론트 커밋을 뒤이어 만든다."

- [ ] **Step 5: MEMORY의 "중첩 저장소는 it_backend" 기록도 3개 전부로 정정할 것을 후속 메모로 남긴다(개인 메모리 파일).**

- [ ] **Step 6: 커밋한다.**

```powershell
cd C:\it
git add CLAUDE.md versions.lock scripts/update-versions-lock.ps1
git commit -m "docs: 4-repo 토폴로지 명문화 및 versions.lock 도입 (#2)"
```

#### 작업 3-2. AGENTS.md 얇은 포인터화 (#4)

대상: C:\it(루트)

**Files:**
- Modify: `C:\it\AGENTS.md`

- [ ] **Step 1: 현재 드리프트 규모를 확인한다.**

```powershell
cd C:\it
git diff --no-index CLAUDE.md AGENTS.md | Measure-Object -Line
```

Expected: 다수 상이 라인(중복 관리 확인).

- [ ] **Step 2: AGENTS.md를 "본문은 CLAUDE.md를 SoT로 따른다"는 얇은 포인터로 축소한다.** 에이전트 특화 지침만 남기고 나머지는 CLAUDE.md 참조 링크로 대체한다.

- [ ] **Step 3: 핵심 사실이 CLAUDE.md와 어긋나지 않는지 확인한다.**

```powershell
Select-String -Path .\AGENTS.md -Pattern '8080|meta.csv'
```

Expected: 0건(포트·경로 오기 없음).

- [ ] **Step 4: 커밋한다.**

```powershell
git add AGENTS.md
git commit -m "docs: AGENTS.md를 CLAUDE.md 참조 포인터로 축소해 이중관리 해소 (#4)"
```

#### 작업 3-3. 작업 추적 채널 역할 명시 + 일회성 문서 정리 (#5)

대상: C:\it(루트)

**Files:**
- Modify: `C:\it\CLAUDE.md` (§4.3 문서 관리)
- Move: 루트 일회성 지시문서 `DB_GAP.md`·`CLEAN_CODE_REVIEW.md`·`ETC.md` → `docs/prompts/` (README 공식 워크플로우로 등재된 `REVIEW.md`·`TEST.md`는 등재 확인 후 유지/이동 판단)

- [ ] **Step 1: 현재 채널을 재확인한다.**

```powershell
cd C:\it
Get-ChildItem *.md | Select-Object Name
Test-Path TaskNotes
```

- [ ] **Step 2: CLAUDE.md §4.3에 채널별 역할을 1줄씩 명시한다.** TASK.md(활성 부채)·TASK_DONE.md(완료 이관)·docs/superpowers(계획/스펙)·prds(요구)·TaskNotes(개인 Obsidian, 흡수/폐기 대상)를 표로 정리한다.

- [ ] **Step 3: README 공식 워크플로우가 아닌 일회성 지시문서를 `docs/prompts/`로 이동한다.** `ETC.md`는 untracked라 `git mv`가 실패하므로 `Move-Item` + `git add`로 처리한다. `DB_GAP.md`는 수정 상태(M)라 미커밋 수정분이 이동 커밋에 함께 포함되므로 `git diff DB_GAP.md`로 내용 확인 후 진행한다.

```powershell
New-Item -ItemType Directory -Force docs\prompts | Out-Null
git mv DB_GAP.md CLEAN_CODE_REVIEW.md docs\prompts\   # tracked 파일 (등재 여부 확인 후 대상 확정)
Move-Item ETC.md docs\prompts\                        # untracked라 git mv 불가
git add docs\prompts\ETC.md
```

- [ ] **Step 4: 커밋한다.**

```powershell
git add CLAUDE.md docs/prompts
git commit -m "docs: 작업 추적 채널 역할 명시 및 일회성 지시문서 정리 (#5)"
```

---

### 단계 4. 후속 위임(범위 밖 기록)

#### 작업 4-1. 구조 리팩터·codegen 위임 메모

대상: C:\it(루트) — 추적만 하고 본 계획에서 구현하지 않음

- [ ] **Step 1: TASK.md에 위임 항목을 등재한다(중복 방지 위해 기존 항목 확인 후).**
  - #10 백엔드 대형 서비스 분해(ProjectService 1,350·CouncilController 1,215·CostService 1,046) → `docs/clean-code-review-2026-07-07.md` §5 4순위 및 clean-code wave 후속.
  - #11 프론트 잔여 800줄(24개) → 동 4순위.
  - #12 `components/editor`·`components/layout` 분리 → 동 후속.
  - #14 OpenAPI codegen 도입 검토 → 별도 스파이크(openapi-typescript/orval 비교).
- [ ] **Step 2: 커밋한다.**

```powershell
cd C:\it
git add TASK.md
git commit -m "docs: 아키텍처 리뷰 구조 리팩터·codegen 항목 후속 위임 등재 (#10~12, #14)"
```

---

## 4. 완료 기준 (Definition of Done)

- 단계 1~3의 각 태스크가 검증 명령 통과 후 해당 저장소에 원자적으로 커밋됨.
- `git grep`으로 평문 비밀번호 하드코딩 0건(working-tree), 미사용 `lib/lombok.jar` 추적 0건, `tsconfig.test.tsbuildinfo` 추적 0건.
- `C:\it\CLAUDE.md`가 4-repo 토폴로지를 정확히 기술, `AGENTS.md` 드리프트 해소, `versions.lock` 존재.
- 히스토리 재작성이 필요한 선택 단계는 별도 유지보수 창 과제로 남고, 각 태스크 본문은 working-tree 기준으로 완료 판정.
- `docs/architecture-review-2026-07-08.md`의 해당 지적 상태를 ✅로 갱신(별도 문서 현행화).

## 5. Self-Review 메모

- **커버리지**: 리뷰 open 지적 8건(#1·#2·#4·#5·#7·#8·#9·#15) 각각 태스크 존재. #13(DB 부트스트랩)은 조치 불요 판단으로 제외, 구조 리팩터(#10~12)·codegen(#14)은 4-1에서 명시적 위임.
- **저장소 경계**: 모든 커밋 명령에 `cd <repo>` 선행.
- **비밀값**: 본 문서에 평문 비밀번호 원문 미포함(플레이스홀더 `<password>`만 사용).
- **파괴적 작업**: 히스토리 purge·force-push는 전부 "선택" 절로 격리하고 재클론 공지를 전제.
