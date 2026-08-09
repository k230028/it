# 비DDL 잔여과제 Wave 1 감사·정책 정렬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FE-29와 BE-32를 근거·테스트와 함께 종결하고, BE-03·BE-18·BE-23·LOG-03·LOG-04의 현재 외부 차단 증거와 재개 조건을 재현 가능한 문서로 고정한다.

**Architecture:** 프론트 문구는 문자열 총량이 아니라 `useRefreshGuard.retryFailureDetail`이라는 실행 맥락으로 분류한다. 협의회 상태는 현재 Oracle `IT_PTL_STS_TC` 코드셋과 `45 → 완료코드` 흐름을 단일 근거로 삼아 백엔드 상수와 테스트를 정렬한다. 운영 의존 항목은 코드로 추측하지 않고 저장소·로컬 로그·설정에서 확인된 사실과 운영에서 추가로 받아야 할 증거를 하나의 보고서에 기록한다.

**Tech Stack:** Nuxt 4/Vue 3/Vitest, Spring Boot 4.1/Java 25/JUnit 5/Mockito, Oracle 21c, Markdown, PowerShell, Git.

## Global Constraints

- `it_database/migrations/`, live DDL, 테이블·인덱스·시퀀스 정의를 변경하지 않는다.
- 사용자 작업 트리의 BRD-03·BRD-05·BRD-06·EAI-01·EAI-02·EAI-05·EAI-06·EAI-07 제거와 BRD 표 재정렬은 스테이징하지 않는다.
- `it_backend/graphify-out/`은 읽거나 커밋하지 않는다.
- BE-32는 테스트 기대값을 먼저 `49`로 바꾸어 RED를 확인한 뒤 운영 코드를 수정한다.
- 외부 조건이 증명되지 않은 BE-03·BE-18·BE-23·LOG-03·LOG-04는 `TASK_DONE.md`로 옮기지 않는다.
- 백엔드 커밋을 먼저 만들고 루트 `versions.lock`과 추적 문서를 뒤이어 커밋한다.

---

### Task 1: 작업공간과 테스트 기준선 검증

**Files:**
- Read: `TASK.md`
- Read: `it_frontend/package.json`
- Read: `it_backend/build.gradle`
- Preserve: `it_backend/graphify-out/`

**Interfaces:**
- Consumes: 현재 루트·프론트·백엔드·DB HEAD와 사용자 비스테이징 변경
- Produces: Wave 1 변경 전 통과하는 프론트·백엔드 테스트 기준선

- [ ] **Step 1: 네 저장소 상태와 DDL 기준 확인**

Run:

```powershell
git status --short
git -C it_frontend status --short
git -C it_backend status --short
git -C it_database status --short
git -C it_database diff -- migrations
```

Expected: 루트는 사용자 `TASK.md`만 수정, 프론트·DB clean, 백엔드는 기존 `graphify-out/`만 비추적, migration diff 0건.

- [ ] **Step 2: 프론트 전체 단위 테스트 기준선 실행**

Run:

```powershell
npm test
```

Working directory: `it_frontend`

Expected: exit 0, 실패 0건.

- [ ] **Step 3: 백엔드 전체 단위 테스트 기준선 실행**

Run:

```powershell
./gradlew.bat test
```

Working directory: `it_backend`

Expected: `BUILD SUCCESSFUL`.

---

### Task 2: FE-29 “다시” 문구 의미 감사와 Accepted 판정

**Files:**
- Read: `it_frontend/app/composables/useRefreshGuard.ts:107-108,225-226,295`
- Read: `it_frontend/app/**/*.{ts,vue}`의 `retryFailureDetail` 소비처
- Read: `it_frontend/CLAUDE.md:28`
- Create: `docs/superpowers/reports/2026-08-09-non-ddl-wave1-evidence.md`

**Interfaces:**
- Consumes: `useRefreshGuard({ retryFailureDetail })`과 최초 로드·쓰기 후 재조회 오류 문구
- Produces: `retryFailureDetail`은 “다시 불러오지 못했습니다”, 최초 로드 또는 첫 후속 조회 결과 설명은 “불러오지 못했습니다”를 허용한다는 감사 결론

- [ ] **Step 1: 실행 맥락별 소비처 census 재현**

Run:

```powershell
$files = rg -l "retryFailureDetail" app --glob '*.ts' --glob '*.vue'
"files=$($files.Count)"
rg -n -C 1 "retryFailureDetail" app --glob '*.ts' --glob '*.vue'
"plain=$((rg -o '불러오지 못했습니다' app --glob '*.ts' --glob '*.vue' | Measure-Object).Count)"
"again=$((rg -o '다시 불러오지 못했습니다' app --glob '*.ts' --glob '*.vue' | Measure-Object).Count)"
```

Working directory: `it_frontend`

Expected: `retryFailureDetail` 소비 파일 46개, 전체 “불러오지 못했습니다” 141건, 그중 “다시 불러오지 못했습니다” 69건. 모든 `retryFailureDetail` 리터럴 또는 참조 상수의 최종 값에는 “다시 불러오지 못했습니다”가 포함된다.

- [ ] **Step 2: 감사 보고서에 FE-29 결론 기록**

Create the report section with these exact facts:

```markdown
## FE-29 — 최초 조회와 재조회 문구

- `retryFailureDetail` 소비 파일은 46개이며 기본값을 포함한 재시도 실패 문구는 모두 “다시 불러오지 못했습니다”를 사용한다.
- 전체 141건을 문자열만으로 나누면 “다시” 포함 69건, 미포함 72건이지만 미포함 문구는 최초 로드 실패 또는 쓰기 성공 직후 첫 재조회 결과를 설명한다.
- 따라서 두 표현은 동의어 표기 드리프트가 아니라 실행 맥락 차이다. 전역 치환은 최초 실패와 재시도 실패를 뭉개므로 수행하지 않는다.
- 재시도 버튼의 `다시 조회`/`다시 시도` 구분과 함께 `it_frontend/CLAUDE.md` §2의 현재 규칙을 유지한다.
```

- [ ] **Step 3: 프론트 소스 무변경 확인**

Run:

```powershell
git status --short
git diff --check
```

Working directory: `it_frontend`

Expected: 변경 파일 0건.

---

### Task 3: BE-32 협의회 완료 상태를 49로 정렬

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java:209-221,768-782`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java:111-115,410-476`
- Evidence: `it_frontend/app/utils/common.ts:359-365`
- Evidence: local Oracle `ITPOWN.TPRMPP_CCODEM`

**Interfaces:**
- Consumes: 협의회 신청 시 상태 `45`와 현재 코드셋 `41/45/49 = 타당성검토 요청/진행/완료`
- Produces: `PRJ_STS_COUNCIL_DONE = "49"`; `notifyCouncil`과 `skipCouncil`이 BPROJA를 타당성검토 완료로 전이

- [ ] **Step 1: 현재 Oracle 코드셋을 읽기 전용으로 재확인**

Run:

```powershell
$sql = @'
set pagesize 100 linesize 200 feedback off verify off heading on echo off
select CDVA_ID, CDVA_NM, CO_CDVA_NM, DEL_YN
from ITPOWN.TPRMPP_CCODEM
where CO_C_ID_NM = 'IT_PTL_STS_TC'
  and CDVA_ID in ('31','39','41','45','49')
order by CDVA_ID;
exit
'@
($env:DB_PASSWORD + "`n" + $sql) | & sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

Expected: `31=요구사항 구체화 진행중`, `39=요구사항 구체화 완료`, `41=타당성검토 정실협 요청 작성중`, `45=타당성검토 정실협 진행중`, `49=타당성검토 정실협 완료`.

- [ ] **Step 2: 테스트 기대값을 49로 바꾸어 RED 작성**

Change both assertions to:

```java
verify(bprojaSyncService).upsert("PRJ-2026-0001", "PRJ-2026-0001", "49");
```

The first assertion is in `skipCouncil_APPROVED상태_SKIPPED전이`, the second in `notifyCouncil_정상통보_NotifyResponse반환`.

- [ ] **Step 3: 표적 테스트가 기존 39 때문에 실패하는지 확인**

Run:

```powershell
./gradlew.bat test --tests "com.kdb.it.domain.council.service.CouncilServiceTest"
```

Working directory: `it_backend`

Expected: 두 테스트가 실제 호출 인자 `39`, 기대 인자 `49` 불일치로 FAIL.

- [ ] **Step 4: 운영 상수와 JavaDoc을 최소 수정**

Change the constant and every adjacent transition comment to:

```java
/** 타당성검토 정실협 완료 상태 (통보·생략 시 전이) (49) */
private static final String PRJ_STS_COUNCIL_DONE = "49";
```

`notifyCouncil` JavaDoc과 `skipCouncil` 처리 내용은 `45 → 49`로 적고, 존재하지 않는 과거 값 `32`와 잘못된 완료 값 `39`를 제거한다.

- [ ] **Step 5: 표적 테스트 GREEN 확인**

Run:

```powershell
./gradlew.bat test --tests "com.kdb.it.domain.council.service.CouncilServiceTest"
```

Expected: PASS.

- [ ] **Step 6: 백엔드 품질 게이트 실행**

Run:

```powershell
./gradlew.bat check
git diff --check
```

Expected: `BUILD SUCCESSFUL`, 공백 오류 0건.

- [ ] **Step 7: 백엔드 커밋**

```powershell
git add -- src/main/java/com/kdb/it/domain/council/service/CouncilService.java src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java
git commit -m "fix: 협의회 완료 사업상태를 코드셋에 정렬"
```

---

### Task 4: 운영·외부 의존 5건의 증거와 재개 조건 기록

**Files:**
- Modify: `docs/superpowers/reports/2026-08-09-non-ddl-wave1-evidence.md`
- Read: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ReviewerController.java:39-53`
- Read: `it_backend/sso/README.md`
- Read: `docs/superpowers/notes/2026-07-07-realtime-log-explain.md`
- Read: `it_backend/src/main/resources/logback-spring.xml`
- Read: `docs/superpowers/reports/2026-07-be03-projection-survey.md`

**Interfaces:**
- Consumes: git 이력, 로컬 월별 로그, 저장소 설정·운영 노트
- Produces: BE-18·BE-23·LOG-03·LOG-04·BE-03의 확인된 사실, 미확인 외부 증거, 정확한 재개 명령

- [ ] **Step 1: BE-18 배포·WARN 근거 재현**

Run:

```powershell
git log --all --date=iso --format='%h %ad %s' -S'@GetMapping("/reviewers")' -- src/main/java/com/kdb/it/domain/budget/document/controller/ReviewerController.java
rg -c "폐기 예정 검토자 경로가 호출되었습니다" C:\itp_log\*.log
```

Working directory: `it_backend`

Expected: 전역 API 도입 커밋 `8d1f7e44`(2026-07-21), 로컬 2026-06~08 로그 WARN 0건. 로컬 로그는 운영 배포 증거가 아니므로 구 경로 제거 조건은 미충족으로 판정한다.

- [ ] **Step 2: BE-23 아티팩트 저장소 증거 재현**

Run:

```powershell
git ls-files sso
rg -n "Nexus|Artifactory|사내 저장소|artifact|아티팩트" README.md CLAUDE.md docs sso
```

Working directory: `it_backend`

Expected: 추적 파일은 `sso/README.md`뿐이며 벤더 배포물의 내부 좌표·소유 저장소·접근권한은 없음. `C:\maven-repo`와 내부 Nexus는 일반 Gradle 의존성 경로이지 벤더 원본 보관 결정을 대신하지 않는다.

- [ ] **Step 3: LOG-03·LOG-04 현재 설정 대조**

Run:

```powershell
rg -n "동시 관리자|p95|AWR|온라인 조회 기본 대상|최근 30일" docs/superpowers/notes/2026-07-07-realtime-log-explain.md
rg -n "maxHistory|totalSizeCap" it_backend/src/main/resources/logback-spring.xml
rg -n "intervalMs|5000|setInterval" it_frontend/app/composables/useRealtimeLogs.ts
```

Expected: push 검토 조건은 관리자 20명/30분, p95 1초/10분, AWR 상위 부하이며 현재 폴링은 5초. application file log는 12개월/3GB지만 DB 감사로그 30일 온라인 보존 시행값은 없음.

- [ ] **Step 4: BE-03 잔여 경계 대조**

Run:

```powershell
rg -n "결정 #1|결정 #2|결정 #3|결정 #4|결정 #5|ProjectKeyView|wide 응답|운영 AWR" docs/superpowers/reports/2026-07-be03-projection-survey.md
git -C it_backend log -1 --oneline
Get-Content versions.lock
```

Expected: 안전 범위 프로젝션은 이미 구현됐고, 잔여는 운영 AWR, Project/Cost wide 계약 분리, BBUGTM·ProjectKeyView 대표/namespace 결정이다. `versions.lock`은 현재 백엔드 HEAD를 가리키도록 이번 파동 마지막에 다시 갱신한다.

- [ ] **Step 5: 보고서에 운영 항목별 판정 기록**

Append these sections:

```markdown
## BE-18 — 구 검토자 API

- 전역 경로 도입은 `8d1f7e44`(2026-07-21)이다.
- 로컬 2026-06~08 로그에는 구 경로 WARN이 0건이지만 운영 배포 릴리스와 운영 WARN 14일 자료는 저장소에 없다.
- 재개 조건: 운영 배포 식별자·배포일과 그 이후 14일 로그에서 WARN 0건을 함께 제시한다.

## BE-23 — SSO 벤더 배포물

- Git 추적 파일은 보존 규칙을 담은 `sso/README.md`뿐이다.
- 일반 Gradle 의존성용 `C:\maven-repo`·내부 Nexus 설명은 있으나 벤더 원본의 저장소 좌표·소유자·접근권한은 없다.
- 재개 조건: SSO 운영 담당자가 저장소 URL/좌표, 접근 주체, 계약상 보존기간을 확정한다.

## LOG-03 — Push 전환

- 현재 5초 폴링을 유지한다.
- 전환 조건은 관리자 20명 이상 30분, p95 1초 초과 10분, AWR 상위 부하 반복 중 하나이며 운영 측정값은 저장소에 없다.
- 재개 조건: 같은 관측 구간의 동시 사용자·API p95·AWR 증거를 제공한다.

## LOG-04 — 로그 보존

- 파일 로그는 12개월/3GB이지만 이는 DB 감사로그 정책이 아니다.
- DB 감사로그의 최근 30일 온라인 조회 권고는 문서화됐으나 기관 보존기간·삭제/백업 실행 주체가 미확정이다.
- 재개 조건: 보존기간, 백업 위치, 삭제 승인 주체, 복구 점검 주기를 운영 정책으로 확정한다.

## BE-03 — 프로젝션 잔여

- 승인된 안전 범위는 구현 완료다.
- 잔여는 운영 AWR 기반 재조정, Project/Cost wide API 계약 분리, BBUGTM·ProjectKeyView 대표/namespace 결정이다.
- AWR는 운영 자료를 기다리고, 코드로 가능한 wide 계약 분리는 Wave 3 계획에서 수행한다.
```

- [ ] **Step 6: 보고서 무결성 검사**

Run:

```powershell
rg -n "FE-29|BE-18|BE-23|LOG-03|LOG-04|BE-03" docs/superpowers/reports/2026-08-09-non-ddl-wave1-evidence.md
git diff --check -- docs/superpowers/reports/2026-08-09-non-ddl-wave1-evidence.md
```

Expected: 여섯 ID가 모두 존재하고 공백 오류 0건.

---

### Task 5: TASK 추적 문서 정비와 루트 커밋

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`
- Modify: `versions.lock`
- Add: `docs/superpowers/reports/2026-08-09-non-ddl-wave1-evidence.md`
- Add: `docs/superpowers/plans/2026-08-09-non-ddl-wave1-audit-policy.md`

**Interfaces:**
- Consumes: FE-29 Accepted 결론, BE-32 백엔드 커밋 SHA, 운영 증거 보고서
- Produces: FE-29·BE-32 활성 행 제거, 나머지 5건의 최신 재개 조건, 호환 서브레포 SHA

- [ ] **Step 1: 완료 2건을 TASK_DONE에 기록**

Add a dated section with:

```markdown
### 2026-08-09 비DDL Wave 1 감사·정책 정렬

| 상태 | ID | 결과 | 근거 |
| --- | --- | --- | --- |
| ☑️ Accepted | FE-29 | “다시” 유무는 최초 로드/첫 후속 조회와 명시적 재시도 실패의 실행 맥락 차이이므로 전역 치환하지 않는다. | Wave 1 evidence 보고서, `it_frontend/CLAUDE.md` §2 |
| ✅ Done | BE-32 | 협의회 통보·생략 후 BPROJA 상태를 현재 코드셋의 타당성검토 완료 `49`로 정렬했다. | `CouncilServiceTest`, `versions.lock`의 `it_backend` SHA |
```

- [ ] **Step 2: TASK 활성 행 정비**

- Remove FE-29 and BE-32 rows.
- Keep BE-18, BE-23, LOG-03, LOG-04 active and append the matching report section link plus its exact external evidence requirement.
- Keep BE-03 active, mark `versions.lock` update as completed, and state that Project/Cost wide contract split is scheduled for Wave 3 while AWR and representative/namespace decisions remain external.

- [ ] **Step 3: versions.lock 갱신**

Run:

```powershell
.\scripts\update-versions-lock.ps1
```

Expected: backend SHA equals Task 3 commit; frontend/database SHA unchanged.

- [ ] **Step 4: 사용자 TASK 변경을 제외한 이번 ID만 index에 구성**

Build the staged `TASK.md` from HEAD plus only these intended IDs:

```powershell
$script = @'
const fs = require('node:fs');
let head = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => head += chunk);
process.stdin.on('end', () => {
  const working = fs.readFileSync('TASK.md', 'utf8');
  const ids = new Set(['BE-03', 'BE-18', 'BE-23', 'LOG-03', 'LOG-04']);
  const replacements = new Map();
  for (const line of working.split(/\r?\n/)) {
    const match = line.match(/^\|\s*([A-Z]+-\d+)\s*\|/);
    if (match && ids.has(match[1])) replacements.set(match[1], line);
  }
  const output = head
    .split('\n')
    .filter(line => !/^\|\s*(FE-29|BE-32)\s*\|/.test(line))
    .map(line => {
      const match = line.match(/^\|\s*([A-Z]+-\d+)\s*\|/);
      return match && replacements.has(match[1]) ? replacements.get(match[1]) : line;
    })
    .join('\n');
  process.stdout.write(output);
});
'@
$blob = (git show HEAD:TASK.md | node -e $script | git hash-object -w --stdin).Trim()
git update-index --add --cacheinfo 100644 $blob TASK.md
```

- [ ] **Step 5: 나머지 루트 파일 스테이징과 분리 검증**

Run:

```powershell
git add -- TASK_DONE.md versions.lock docs/superpowers/reports/2026-08-09-non-ddl-wave1-evidence.md docs/superpowers/plans/2026-08-09-non-ddl-wave1-audit-policy.md
git diff --cached --check
git diff --cached -- TASK.md
git diff -- TASK.md
```

Expected: cached TASK diff에는 FE-29·BE-32 제거와 BE-03·BE-18·BE-23·LOG-03·LOG-04 갱신만 있다. unstaged TASK diff에는 사용자 BRD·EAI 변경만 남는다.

- [ ] **Step 6: 루트 커밋**

```powershell
git commit -m "docs: 비DDL Wave 1 감사와 정책 정렬"
```

- [ ] **Step 7: 파동 종료 검증**

Run:

```powershell
git show --check --stat HEAD
git -C it_backend show --check --stat HEAD
git -C it_database diff -- migrations
git status --short
git -C it_frontend status --short
git -C it_backend status --short
git -C it_database status --short
```

Expected: DDL diff 0건, 프론트·DB clean, 백엔드는 기존 `graphify-out/`만 남고, 루트는 사용자 `TASK.md` 변경만 남는다.
