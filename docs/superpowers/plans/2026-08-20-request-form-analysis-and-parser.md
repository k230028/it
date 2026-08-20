# 편성요청서 분석·파서 보강 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폴더 업로드 분석 진행을 다이얼로그로 표시하고, 요청서 파일만 안전하게 파싱하며, 실제 경상사업 1건 파일을 정상 처리하고, 부서별 파일/BLOCKER 목록 UI로 진단을 재구성한다.

**Architecture:** 기존 `RequestFormImportService`의 `archiveOnly`와 `useRequestFormUpload`의 배치 진행 상태를 확장한다. 파싱 대상 판정은 프론트 manifest와 백엔드 서비스 양쪽에 두고, 업로드 파일 목록은 `File[] + FileResult[]`로 만든 표시 전용 트리에서 관리한다. 수정 가능한 진단은 메인 테이블, 수정 불가능한 진단은 파일 목록 다이얼로그가 각각 소유한다.

**Tech Stack:** Java 25, Spring Boot 4, Apache POI, JUnit 5, Nuxt 4, Vue 3, TypeScript, PrimeVue, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-20-request-form-analysis-and-parser-design.md`

## Global Constraints

- 실제 `sample/` 업무 파일은 읽기 전용 로컬 회귀에만 사용하고 저장소에 복사하거나 커밋하지 않는다.
- 신규 JavaDoc·TSDoc·인라인 주석은 한글로 작성한다.
- 다른 세션의 공유 체크아웃 변경을 건드리지 않고 격리 worktree에서 작업한다.
- 생성 코드 `app/types/api.d.ts`는 백엔드 계약이 바뀔 때만 격리 백엔드를 대상으로 재생성한다.
- 모든 동작 변경은 RED를 확인한 테스트 이후에 구현한다.
- 다운로드 가능한 저장 원본 다이얼로그와 분석 단계 읽기 전용 다이얼로그의 책임을 합치지 않는다.

---

### Task 1: 실제 경상사업 1건 파서 예외 재현과 수정

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestForm2026SampleSmokeTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/migration/request/support/RequestFormFixtures.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/RecurringProjectFormAdapterTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/RecurringProjectFormAdapter.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/ResourceTableReader.java` (RED stack이 이 reader를 지목할 때만)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/FormText.java` (RED stack이 셀 형식 변환을 지목할 때만)

**Interfaces:**
- Consumes: `WorkbookReader.open`, `WorkbookReader.classify`, `FormSheetAdapter.adapt`, `RequestFormFileImporter.preview`
- Produces: 경상사업 데이터 행이 정확히 1건인 유효 양식의 `FileResult`가 `FILE_UNREADABLE` 없이 사업 1건과 실제 품목·금액을 포함한다.

- [ ] **Step 1: 실제 파일을 여는 로컬 회귀 테스트를 작성한다**

환경변수 `REQUEST_FORM_SAMPLE_2026_DIR` 또는 기존 `sample/2026` 아래에서 파일명이 `[자료1] 2026년 전산예산 편성 요청서_IT인프라 자원증설.xls`인 파일을 찾는다. 파일이 없으면 skip하되, 있으면 실제 `RequestFormImportService` 처리 경로와 동일한 reader/adapter 조합을 실행하고 예외 없이 경상사업 결과가 만들어진다고 단언한다.

- [ ] **Step 2: RED를 실행하고 최초 예외를 기록한다**

Run:

```powershell
cd C:\it\it_backend\.worktrees\request-form-analysis-parser
$env:REQUEST_FORM_SAMPLE_2026_DIR='C:\it\sample\2026'
./gradlew test --tests '*RequestForm2026SampleSmokeTest*' --console=plain --info
```

Expected: 현재 `FILE_UNREADABLE`을 만드는 실제 예외와 최초 실패 reader/행/셀이 확인된다. 보고서에 stack trace의 코드 위치와 잘못된 전제를 기록한다.

- [ ] **Step 3: 비식별 최소 POI fixture 테스트를 먼저 작성한다**

실제 파일에서 관측한 시트명, 단일 데이터 행, 바로 뒤 합계/빈 행, 병합 셀·셀 타입만 재현한다. `RecurringProjectFormAdapterTest`는 사업 1건, 품목과 금액, 진단에 `FILE_UNREADABLE`이 없음을 검증한다.

- [ ] **Step 4: 최소 fixture 테스트도 RED인지 확인한다**

Run:

```powershell
./gradlew test --tests '*RecurringProjectFormAdapterTest*' --console=plain
```

Expected: 실제 파일과 같은 원인으로 실패한다.

- [ ] **Step 5: 확인된 최초 원인만 수정한다**

단일 행 뒤에 다음 데이터 행이 있다고 가정하거나 합계/병합 셀을 데이터 셀 타입으로 강제 변환하는 부분을 안전한 종료 조건으로 바꾼다. 빈 행·합계행이면 반복을 종료하고, 값이 있는 단일 행은 보존한다.

- [ ] **Step 6: GREEN과 인접 adapter 회귀를 실행한다**

Run:

```powershell
./gradlew test --tests '*RequestForm2026SampleSmokeTest*' --tests '*RecurringProjectFormAdapterTest*' --tests '*FormAdapterEdgeCaseTest*' --console=plain
```

- [ ] **Step 7: 원인·수정·테스트를 자체 검토하고 커밋한다**

```powershell
git add src/main/java/com/kdb/it/domain/migration/request/service/adapter src/test/java/com/kdb/it/domain/migration/request/service/RequestForm2026SampleSmokeTest.java src/test/java/com/kdb/it/domain/migration/request/service/adapter/RecurringProjectFormAdapterTest.java src/test/java/com/kdb/it/domain/migration/request/support/RequestFormFixtures.java
git commit -m "fix(request): parse single recurring project form"
```

### Task 2: 요청서 파일명 분류와 원본 보관 계약

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormParseTarget.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormParseTargetTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormImportService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormImportServiceTest.java`
- Modify: `it_frontend/app/composables/migration/useRequestFormUpload.ts`
- Modify: `it_frontend/tests/unit/composables/migration/useRequestFormUpload.test.ts`

**Interfaces:**
- Produces backend: `RequestFormParseTarget.isTarget(String originalFilename): boolean`
- Produces frontend: manifest entry `archiveOnly=true` unless basename contains `요청서` and extension is `.xls`/`.xlsx` case-insensitively.
- Consumes: existing `RequestFormDto.FileEntry.archiveOnly`, `RequestFormSourceFileArchiver.ArchivePlanItem`.

- [ ] **Step 1: 백엔드 파일명 판정 RED 테스트를 작성한다**

Cases: `2026 요청서.xls`, `[자료1] 요청서.XLSX`는 true; `견적서.xlsx`, `요청서.pdf`, `요청서폴더/견적서.xls`, `요청서`는 false. 경로가 들어오면 마지막 basename만 판정한다.

- [ ] **Step 2: RED 확인 후 순수 판정기를 구현한다**

```powershell
./gradlew test --tests '*RequestFormParseTargetTest*' --console=plain
```

- [ ] **Step 3: 조작된 manifest 방어 테스트를 작성한다**

`archiveOnly=false`로 들어온 `견적서.xlsx`가 adapter/importer로 전달되지 않고, commit archive plan에는 포함되며 결과 목록에는 추가되지 않는다고 검증한다.

- [ ] **Step 4: 서비스에서 effective archive-only를 적용해 GREEN으로 만든다**

`entry.archiveOnly() || !RequestFormParseTarget.isTarget(file.getOriginalFilename())`를 단일 판정으로 사용한다. `fileKey` 폴더명이 아니라 실제 업로드 파일 basename을 검증한다.

- [ ] **Step 5: 프론트 manifest 분류 RED 테스트를 작성한다**

기존 파일 확장자 판정 대신 동일한 basename 규칙이 적용되고, non-target 파일도 batch와 archive group에서 제거되지 않는다고 검증한다.

- [ ] **Step 6: 프론트 최소 구현 후 양쪽 focused GREEN을 실행한다**

```powershell
./gradlew test --tests '*RequestFormParseTargetTest*' --tests '*RequestFormImportServiceTest*' --console=plain
cd C:\it\it_frontend\.worktrees\request-form-analysis-parser
npx vitest run tests/unit/composables/migration/useRequestFormUpload.test.ts
```

- [ ] **Step 7: 저장소별 지정 경로만 커밋한다**

Backend: `feat(request): parse request-named workbooks only`

Frontend: `feat(migration): classify request form upload targets`

### Task 3: 전결권자 본부장 정규화

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/FormApproverReaderTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/FormApproverReader.java`

**Interfaces:**
- Produces: 전결권자 원문에 `본부장`이 포함되면 approver role은 정확히 `지역본부장`.

- [ ] **Step 1: `지역본부장`, `동남권본부장`, 공백 포함 본부장 표현의 RED 테스트를 작성한다**
- [ ] **Step 2: 기존 `부장`·`팀장` 결과가 유지되는 보호 테스트를 추가한다**
- [ ] **Step 3: focused 테스트로 RED를 확인한다**

```powershell
./gradlew test --tests '*FormApproverReaderTest*' --console=plain
```

- [ ] **Step 4: `contains("본부장")` 우선 정규화를 기존 일반 직책 처리보다 앞에 추가한다**
- [ ] **Step 5: GREEN, diff check, 커밋한다**

Commit: `fix(request): normalize headquarters approver role`

### Task 4: 폴더 업로드 분석 진행 다이얼로그

**Files:**
- Modify: `it_frontend/app/components/migration/RequestFormCommitProgressDialog.vue`
- Modify: `it_frontend/tests/unit/components/migration/RequestFormCommitProgressDialog.test.ts`
- Modify: `it_frontend/app/composables/migration/useRequestFormUpload.ts`
- Modify: `it_frontend/app/pages/admin/migration/requests.vue`
- Modify: `it_frontend/tests/unit/pages/requestFormMigrationPageBoundary.test.ts`
- Modify: `it_frontend/i18n/messages/migration.ts`

**Interfaces:**
- Progress component gains `mode: 'analysis' | 'commit'` or equivalent explicit title/copy props.
- Page presents independent analysis and commit terminal states while consuming the same upload counters.

- [ ] **Step 1: component mode RED 테스트를 작성한다**

분석 모드는 `[편성요청서 분석]`·`파일 분석 중`, 반영 모드는 기존 문구를 표시한다. 두 모드 모두 running에서 close/ESC/mask를 막고 terminal에서만 닫힌다.

- [ ] **Step 2: page ordering RED 테스트를 작성한다**

폴더 선택 후 dry-run API 호출 전에 분석 running 다이얼로그가 렌더되고 `nextTick()`이 완료되는지 검증한다. 성공/실패 전환과 다음 선택 시 초기화도 검증한다.

- [ ] **Step 3: focused RED를 확인한다**

```powershell
npx vitest run tests/unit/components/migration/RequestFormCommitProgressDialog.test.ts tests/unit/pages/requestFormMigrationPageBoundary.test.ts
```

- [ ] **Step 4: 최소 상태 오케스트레이션과 한·영 문구를 구현한다**

분석 성공 요약은 분석 대상 파일 수, 부서 수, 차단 파일 수를 사용한다. 원본 전용 파일 수는 별도 `분석 제외`로 표시할 수 있으나 서버의 applied/blocked 의미를 바꾸지 않는다.

- [ ] **Step 5: focused GREEN과 style/copy check를 실행한다**

```powershell
npx vitest run tests/unit/components/migration/RequestFormCommitProgressDialog.test.ts tests/unit/pages/requestFormMigrationPageBoundary.test.ts
npm run lint:css
npm run check:copy
```

- [ ] **Step 6: 지정 경로만 커밋한다**

Commit: `feat(migration): show request form analysis progress`

### Task 5: 부서 파일/BLOCKER 트리 다이얼로그

**Files:**
- Create: `it_frontend/app/components/migration/RequestFormAnalysisFilesDialog.vue`
- Create: `it_frontend/app/utils/requestFormAnalysisFiles.ts`
- Test: `it_frontend/tests/unit/utils/requestFormAnalysisFiles.test.ts`
- Test: `it_frontend/tests/unit/components/migration/RequestFormAnalysisFilesDialog.test.ts`
- Modify: `it_frontend/app/components/migration/RequestFormResultTable.vue`
- Modify: `it_frontend/tests/unit/components/migration/RequestFormResultTable.test.ts`
- Modify: `it_frontend/app/components/migration/RequestFormResultTable.vue`
- Modify: `it_frontend/app/pages/admin/migration/requests.vue`
- Modify: `it_frontend/app/composables/migration/useRequestFormPage.ts`
- Modify: `it_frontend/i18n/messages/migration.ts`
- Modify: `it_frontend/tests/unit/architecture/component-boundaries.test.ts`

**Interfaces:**
- `buildRequestFormAnalysisTree(files, results, dept): AnalysisFolderTree` combines `webkitRelativePath`, archive-only classification, and matching `FileResult.fileKey`.
- Dialog props: selected department label, tree/files; no download or selection emits.
- Main table rows include only diagnostics where `decision !== 'NONE'`.

- [ ] **Step 1: 순수 트리/집계 RED 테스트를 작성한다**

중첩 폴더, 부서별 파일 수, 파일별 BLOCKER 수, 폴더 하위 BLOCKER 합계, 분석 제외 상태, 동일 파일명/다른 경로를 검증한다.

- [ ] **Step 2: 결과 테이블 진단 필터 RED 테스트를 작성한다**

`decision=NONE` WARNING/BLOCKER는 행과 결정 열에서 사라지고 `SELECT/TEXT/DATE/AMOUNT_UNIT`은 유지되어야 한다.

- [ ] **Step 3: 다이얼로그 RED 테스트를 작성한다**

모든 폴더 기본 펼침, 파일/폴더 BLOCKER 뱃지, 파일 클릭 상세 펼침, 수정 불가능 진단 메시지, 분석 제외 상태, 체크박스·다운로드 없음, 표준 header/footer를 검증한다.

- [ ] **Step 4: 부서 뱃지 RED 테스트를 작성한다**

직접 파일 나열이 사라지고 `파일 4건 · BLOCKER 2건` 버튼이 보이며 선택한 부서 파일만 다이얼로그에 전달되는지 검증한다.

- [ ] **Step 5: focused RED를 실행한다**

```powershell
npx vitest run tests/unit/utils/requestFormAnalysisFiles.test.ts tests/unit/components/migration/RequestFormAnalysisFilesDialog.test.ts tests/unit/components/migration/RequestFormResultTable.test.ts tests/unit/pages/requestFormMigrationPageBoundary.test.ts
```

- [ ] **Step 6: 순수 유틸 → 다이얼로그 → 결과 테이블 → 페이지 연결 순서로 최소 구현한다**

기존 `requestFormSourceTree.ts`의 안전한 상대경로·아이콘 표현을 재사용하되 저장 파일 DTO로 강결합된 코드는 복사하지 않고 공통 순수 helper만 추출한다.

- [ ] **Step 7: focused GREEN과 접근성/스타일 검증을 실행한다**

```powershell
npx vitest run tests/unit/utils/requestFormAnalysisFiles.test.ts tests/unit/components/migration/RequestFormAnalysisFilesDialog.test.ts tests/unit/components/migration/RequestFormResultTable.test.ts tests/unit/pages/requestFormMigrationPageBoundary.test.ts
npm run lint:css
npm run check
```

- [ ] **Step 8: 지정 경로만 커밋한다**

Commit: `feat(migration): show department source diagnostics tree`

### Task 6: 통합 E2E·전체 회귀·호환 버전 기록

**Files:**
- Modify: `it_frontend/tests/e2e/request-form-migration.spec.ts`
- Modify: `versions.lock`

**Interfaces:**
- Consumes: Tasks 1–5의 backend/frontend 계약.

- [ ] **Step 1: E2E를 먼저 확장한다**

폴더 업로드 후 분석 다이얼로그 running/terminal 상태, 부서 파일 뱃지, 파일 목록 다이얼로그, 중첩 폴더, 분석 제외 견적 파일, BLOCKER 상세 펼침을 검증한다. commit 버튼은 누르지 않아 업무 DB 데이터를 남기지 않는다.

- [ ] **Step 2: focused E2E를 실행한다**

```powershell
npm run test:e2e -- tests/e2e/request-form-migration.spec.ts
```

- [ ] **Step 3: 백엔드 health stack을 실행한다**

```powershell
./gradlew test --rerun-tasks --console=plain
./gradlew check --console=plain
./gradlew bootJar --console=plain
```

기존 JaCoCo/Spotless 기준선이 남으면 feature-owned 경로와 분리해 기록하고, 기능 소유 파일은 모두 통과해야 한다.

- [ ] **Step 4: 프론트 health stack을 실행한다**

```powershell
npm run format:check
npm run check
npm test
npm run lint:css
```

- [ ] **Step 5: 실제 샘플 회귀 결과를 기록한다**

문제 파일의 최초 원인, 수정한 reader/조건, 파싱된 경상사업·품목 수를 보고서에 남긴다. 실제 파일·실명·예산액은 출력하거나 커밋하지 않는다.

- [ ] **Step 6: 세 격리 저장소 HEAD로 `versions.lock`을 갱신한다**

공유 checkout이 아닌 backend/frontend/database worktree의 branch와 full SHA를 기록한다.

- [ ] **Step 7: E2E와 lock 파일을 저장소별로 커밋한다**

Frontend: `test: 편성요청서 분석 파일 흐름 검증`

Root: `chore: 편성요청서 분석 호환 버전 기록`

- [ ] **Step 8: 전체 브랜치 코드리뷰와 수정 루프를 수행한다**

Critical/Important는 모두 수정하고 재검토한다. Minor는 사용자 요구와 직접 관련된 경우 같은 브랜치에서 정리한다.
