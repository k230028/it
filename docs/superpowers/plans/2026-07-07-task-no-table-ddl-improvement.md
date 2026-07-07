# TASK 무테이블 DDL 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md` 잔여과제 중 테이블 구조 변경 없이 가능한 항목을 보안, 사용자 영향, 프론트/Tiptap, 품질, 운영 확장 순서로 개선한다.

**Architecture:** 물리 테이블 구조 변경(신규 테이블, 컬럼 추가/변경, PK 변경)은 금지하고, 기존 테이블·엔티티·API를 재사용한다. 인덱스, 뷰, 쿼리, API, 프론트엔드, 테스트, 운영 설정 변경은 허용한다. 루트 `C:\it`와 `it_backend`, `it_frontend`, `it_database`는 독립 Git 저장소이므로 커밋과 DDL 가드는 각 저장소 안에서 실행한다. 완료된 항목은 `TASK_DONE.md`로 옮기고 `TASK.md`에서는 삭제한다.

**Tech Stack:** Spring Boot 4.1.0, Java 25, Oracle, JPA/QueryDSL, Nuxt 4, Vue 3, TypeScript, Pinia, PrimeVue, Vitest, Playwright, Gradle.

## Global Constraints

- 신규 테이블, 컬럼 추가/변경, PK 변경 금지.
- 루트 `C:\it`, `it_backend`, `it_frontend`, `it_database`는 독립 Git 저장소다. 하위 프로젝트 변경은 해당 저장소 내부에서 별도 커밋한다.
- 모든 신규 JavaDoc/TSDoc/인라인 주석은 한글로 작성.
- 백엔드 보안 판단은 프론트 라우트 가드가 아니라 서비스/쿼리 계층에서 보장.
- 프론트 API 호출은 `credentials: 'include'` 및 기존 `$apiFetch`/`useApiFetch` 패턴 준수.
- 완료 항목은 `TASK_DONE.md`로 이동하고 `TASK.md`에서는 삭제.
- 구현 중 테이블 구조 변경이 필요하다고 확인된 항목은 즉시 제외 목록으로 이동.

---

## File Structure

### Backend

- `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`  
  Refresh Token 회전 동시성 제어.
- `it_backend/src/main/java/com/kdb/it/common/system/repository/RefreshTokenRepository.java`  
  토큰 조회/잠금 쿼리 추가 가능. 테이블 컬럼 변경 금지.
- `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`  
  동시성·다중 활성 토큰 방지 테스트.
- `it_backend/src/main/java/com/kdb/it/common/system/security/OwnershipVerifier.java` 및 도메인 서비스/Repository  
  무부서 비관리자 조회 차단 정책 적용 위치 확인.
- `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`  
  환율 규칙 통일.
- `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java`  
  환율 계산 기준 정합화.
- `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceXcrLookupTest.java`  
  환율 규칙 회귀 테스트.
- `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java`  
  요약 계산 회귀 테스트.
- `it_backend/src/main/java/com/kdb/it/common/board/**`  
  게시판 검색 제한, 페이지네이션, 깊이 제한, 테스트 확대.
- `it_backend/src/main/java/com/kdb/it/common/admin/realtime/**`  
  실시간 로그 검증·드릴다운·쿼리 개선.
- `it_backend/src/main/java/com/kdb/it/infra/eai/**`  
  EAI 설정/도메인 연결/실패 무전파 테스트.

### Frontend

- `it_frontend/app/stores/review.ts`  
  기존 `loadWarnings: string[]` 부분 실패 경고 구조를 유지하면서 문서 버전 본문·코멘트·이력 조회 실패 상태를 통합한다.
- `it_frontend/app/pages/info/documents/[id]/index.vue`  
  오류 상태 UI 표시.
- `it_frontend/app/composables/useTableCellSelection.ts`  
  클립보드 실패 진단.
- `it_frontend/app/composables/useNotifications.ts`  
  폴링 실패 중복 제한 진단.
- `it_frontend/app/pages/info/index.vue`  
  정적 KPI/공지/일정 운영 데이터 연동.
- `it_frontend/app/utils/common.ts`  
  파일 크기·금액 표시 정책 정리.
- `it_frontend/app/components/TiptapEditor.vue`, `it_frontend/app/composables/useTiptapVariables.ts`  
  Tiptap 변수 prop 확대와 작성 직후 해석.
- `it_frontend/app/pages/admin/realtime-logs.vue`, `it_frontend/app/components/admin/realtime/**`  
  실시간 로그 UX 확장.
- `it_frontend/app/pages/board/**`, `it_frontend/app/components/board/**`  
  게시판 페이지네이션/검색/깊이 제한.

---

### Task 0: Scope Guard and Baseline

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`
- Read: `docs/superpowers/specs/2026-07-07-task-no-table-ddl-improvement-design.md`

**Interfaces:**
- Consumes: `TASK.md` IDs.
- Produces: 작업 중 제외 항목을 기록할 "테이블 DDL 필요" 판정 규칙.

- [ ] **Step 1: 작업 범위 확인**

Run:

```powershell
Get-Content -LiteralPath 'C:\it\TASK.md'
Get-Content -LiteralPath 'C:\it\docs\superpowers\specs\2026-07-07-task-no-table-ddl-improvement-design.md'
```

Expected: `TASK.md`가 `ID | 우선순위 | 유형 | 과제 | 근거/조건` 표 형식이며, 설계 문서의 포함/제외 항목과 일치한다.

- [ ] **Step 2: DDL 금지 검색 기준 준비**

Run before every commit:

```powershell
cd C:\it\it_database
git diff -- migrations ITPOWN_DDL_live.sql | Select-String -Pattern 'CREATE TABLE|ALTER TABLE|ADD .*COLUMN|DROP COLUMN|PRIMARY KEY|CONSTRAINT'
cd C:\it\it_backend
git diff -- src/main/resources | Select-String -Pattern 'CREATE TABLE|ALTER TABLE|ADD .*COLUMN|DROP COLUMN|PRIMARY KEY|CONSTRAINT'
```

Expected: 테이블 구조 변경 SQL이 없어야 한다. 인덱스, 뷰, 쿼리 변경은 허용한다.

- [ ] **Step 3: 기존 변경 보호**

Run in each repository:

```powershell
cd C:\it
git status --short
cd C:\it\it_backend
git status --short
cd C:\it\it_frontend
git status --short
cd C:\it\it_database
git status --short
```

Expected: 사용자 변경(`prds/` 등)이 보이면 건드리지 않는다. 본 계획의 변경 파일만 stage한다.

---

### Task 1: P0 Security Invariants

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/repository/RefreshTokenRepository.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`
- Potentially modify service/repository list filters discovered by `rg "bbrC|null|isAdmin|ROLE" it_backend/src/main/java`

**Interfaces:**
- Consumes: existing `AuthService.refreshAccessToken(String refreshTokenValue)` behavior returning `AuthDto.RefreshResponse`.
- Produces: refresh rotation path that cannot leave more than one active token per family; query/list behavior that denies non-admin users without `bbrC`.

- [ ] **Step 1: Write failing Refresh Token concurrency test**

Add or extend `AuthServiceTest` with a test named:

```java
@Test
void refreshToken_concurrentRotation_keepsSingleActiveTokenPerFamily() {
    // 동일 refresh token 값으로 두 번 회전을 시도했을 때 활성 토큰이 1개만 남아야 한다.
}
```

The test must assert that the second rotation either reuses the first successful result within the existing grace policy or fails without saving another active token.

- [ ] **Step 2: Run focused backend test and verify failure**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.common.system.service.AuthServiceTest --warning-mode all
```

Expected: new concurrency/invariant assertion fails before implementation.

- [ ] **Step 3: Implement token rotation guard without table DDL**

Use existing columns (`FAM_NM`, `AVL_YN`, token lookup hash) and transaction boundaries. Preferred implementation order:

1. Add repository query for active tokens by family if not present.
2. Mark the old token inactive before issuing the new token.
3. Validate no more than one active token exists for a family after rotation.
4. If repository locking is needed, use JPA lock annotation or transaction isolation without schema change.

- [ ] **Step 4: Write failing no-department access test**

Add focused tests for one representative high-risk list service first. The test name must follow this pattern:

```java
@Test
void list_nonAdminWithoutDepartment_deniesWholeDepartmentSearch() {
    // 부서코드가 없는 비관리자는 전체 조회로 폴백하지 않는다.
}
```

Expected behavior: return empty result or throw access denied according to the domain's existing error style. Prefer access denied for sensitive list APIs.

- [ ] **Step 5: Implement no-department policy in backend boundary**

Apply a shared helper or local guard:

```java
if (!user.isAdmin() && !StringUtils.hasText(user.getBbrC())) {
    throw new AccessDeniedException("부서 정보가 없는 사용자는 전체 조회할 수 없습니다.");
}
```

Use the actual `CustomUserDetails` role helper names in the codebase. Do not add DB columns.

- [ ] **Step 6: Verify**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.common.system.service.AuthServiceTest --warning-mode all
.\gradlew test --warning-mode all
```

Expected: focused test and full backend test pass.

- [ ] **Step 7: Commit**

```powershell
cd C:\it\it_backend
git add -- src/main/java src/test/java
git commit -m "fix: 무테이블 DDL 보안 불변식 강화"
```

---

### Task 2: P1 User-Visible Error States and Currency Rule

**Files:**
- Modify: `it_frontend/app/stores/review.ts`
- Modify: `it_frontend/app/pages/info/documents/[id]/index.vue`
- Modify: `it_frontend/app/composables/useTableCellSelection.ts`
- Modify: `it_frontend/app/composables/useNotifications.ts`
- Test: `it_frontend/tests/unit/stores/review.test.ts`
- Test: `it_frontend/tests/unit/composables/useTableCellSelection.direct.test.ts`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceXcrLookupTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java`

**Interfaces:**
- Produces: review store keeps the existing `loadWarnings: string[]` return path and extends it into named warning categories only if the UI needs stable per-section rendering.
- Produces: one currency conversion policy shared by work and summary calculations.

- [ ] **Step 1: Add review store warning-state tests**

`review.ts` already returns `loadWarnings: string[]` from `loadSession()`. Extend the tests around that mechanism instead of adding a parallel error system. Add assertions that failed body/comment/history loads return the expected Korean warning strings and do not silently look like a successful empty load. Use a shape like:

```ts
const warnings = await store.loadSession(docId, version);
expect(warnings).toContain('버전 이력을 불러오지 못했습니다.');
expect(warnings).toContain('코멘트를 불러오지 못했습니다.');
```

If section-specific UI rendering needs stable keys, add a derived structure such as `loadWarningState` from the existing warning strings. Do not introduce `versionLoadError`, `commentsLoadError`, or `historyLoadError` as a second source of truth.

- [ ] **Step 2: Integrate review warning state**

Keep the existing `loadWarnings` collection and normalize warning emission through a small helper:

```ts
type ReviewLoadWarningCode = 'VERSION_HISTORY' | 'COMMENTS' | 'REVIEWERS';

const REVIEW_LOAD_WARNING_MESSAGES: Record<ReviewLoadWarningCode, string> = {
    VERSION_HISTORY: '버전 이력을 불러오지 못했습니다.',
    COMMENTS: '코멘트를 불러오지 못했습니다.',
    REVIEWERS: '검토자 목록을 불러오지 못했습니다.',
};

const pushLoadWarning = (warnings: string[], code: ReviewLoadWarningCode) => {
    warnings.push(REVIEW_LOAD_WARNING_MESSAGES[code]);
};
```

Replace duplicated string pushes with this helper. Preserve prior data unless the existing UI requires clearing stale content.

- [ ] **Step 3: Show document error state**

In `pages/info/documents/[id]/index.vue`, render a small PrimeVue `Message` or existing local error component when `loadSession()`이 반환한 `loadWarnings`(또는 파생 `loadWarningState`)에 해당 섹션 경고가 있을 때. Text must be user-facing Korean copy such as `문서 내용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.`

- [ ] **Step 4: Add duplicate-limited diagnostics**

In `useTableCellSelection.ts` and `useNotifications.ts`, keep polling/clipboard UX quiet but log or expose a throttled diagnostic. Use a timestamp guard:

```ts
let lastWarnAt = 0;
const warnOncePerMinute = (message: string, error: unknown) => {
    const now = Date.now();
    if (now - lastWarnAt < 60_000) return;
    lastWarnAt = now;
    console.warn(message, error);
};
```

- [ ] **Step 5: Decide and encode currency rule**

Use this rule for the implementation plan: monetary item amounts are stored in their source currency, and KRW summary values apply `xcr` exactly once at aggregation/display boundary. Remove any path that applies `xcr` twice or not at all for the same KRW summary.

- [ ] **Step 6: Add backend currency regression tests**

Add tests where `amt=100`, `xcr=1300`. Expected KRW summary is `130000`, never `100` and never `169000000`.

- [ ] **Step 7: Verify**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/stores/review.test.ts tests/unit/composables/useTableCellSelection.direct.test.ts
cd C:\it\it_backend
.\gradlew test --tests "*BudgetWorkService*" --tests "*ProjectBudgetSummaryService*" --warning-mode all
```

Expected: all focused tests pass.

- [ ] **Step 8: Commit**

```powershell
cd C:\it\it_frontend
git add -- app tests
git commit -m "fix: 문서 오류 상태 진단 개선"
cd C:\it\it_backend
git add -- src/main/java src/test/java
git commit -m "fix: 문서 오류 상태와 환율 규칙 정합화"
```

---

### Task 3: P2 Frontend and Tiptap Immediate Improvements

**Files:**
- Modify: `it_frontend/app/pages/info/index.vue`
- Modify: `it_frontend/app/utils/common.ts`
- Modify: `it_frontend/app/pages/budget/approval.vue`
- Modify: `it_frontend/app/pages/budget/list.vue`
- Modify: `it_frontend/app/pages/info/plan/form.vue`
- Modify: `it_frontend/app/pages/info/documents/form.vue`
- Modify: `it_frontend/app/pages/info/documents/[id]/index.vue`
- Modify: `it_frontend/app/components/TiptapEditor.vue`
- Modify: `it_frontend/app/composables/useTiptapVariables.ts`
- Test: `it_frontend/tests/unit/utils/common.test.ts`
- Test: `it_frontend/tests/unit/composables/useTiptapVariables.test.ts`

**Interfaces:**
- Produces: common display helpers used consistently.
- Produces: Tiptap variable nodes resolve immediately after insertion.

- [ ] **Step 1: Add common display utility tests**

Extend `common.test.ts` for null/zero amount and file size behavior. Expected:

```ts
expect(formatFileSize(null)).toBe('');
expect(formatFileSize(0)).toBe('0 B');
expect(formatBudget(0, '원')).toBe('0');
```

- [ ] **Step 2: Replace local formatting duplicates**

Search:

```powershell
cd C:\it\it_frontend
rg -n "formatFileSize|toLocaleString|formatBudget" app/pages/budget app/pages/info/plan app/pages/info/documents
```

Replace page-local helpers with imports from `~/utils/common`. Preserve screen-specific unit suffixes.

- [ ] **Step 3: Convert `info/index.vue` static data to API-backed data**

Use existing APIs first. If a compact backend summary API is necessary, add a read-only controller/service method that aggregates from existing repositories without table DDL. Do not add tables or columns.

- [ ] **Step 4: Add Tiptap resolve-after-insert test**

In `useTiptapVariables.test.ts`, assert that a newly inserted token calls `resolveTokens([token])` and receives `OK`, `MISSING`, `FORBIDDEN`, or `INVALID` status instead of leaving `LOADING`.

- [ ] **Step 5: Implement resolve-after-insert**

Wire insertion flow so that after a token node is created, `resolveTokens` is called and the editor storage/state is updated. Avoid circular dependency from components to store; keep API calls in composable or editor integration layer.

- [ ] **Step 6: Apply Tiptap variable props to target pages**

Targets:

```text
it_frontend/app/pages/info/documents/[id]/index.vue
it_frontend/app/pages/info/plan/form.vue
it_frontend/app/pages/info/documents/form.vue
it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/index.vue
it_frontend/app/pages/guide/index.vue
```

Pass existing document/project/year context. Use `?? ''` for nullable HTML props.

- [ ] **Step 7: Verify**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/utils/common.test.ts tests/unit/composables/useTiptapVariables.test.ts
npm run typecheck
```

Expected: unit tests pass. `typecheck` should pass or report only pre-existing fixture errors; capture any failures in the task summary.

- [ ] **Step 8: Commit**

```powershell
cd C:\it\it_frontend
git add -- app tests
git commit -m "feat: 프론트 표시 정책과 Tiptap 변수 즉시 해석 개선"
```

---

### Task 4: P3 Backend Quality and Test Coverage

**Files:**
- Test: `it_frontend/tests/unit/utils/hwpx.test.ts`
- Test: `it_frontend/tests/unit/utils/hwpx-images.test.ts`
- Test: `it_frontend/tests/unit/composables/useHwpxExport.direct.test.ts`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImplTest.java`
- Modify/Test: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepositoryImpl.java`
- Modify/Test: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepositoryImpl.java`
- Modify/Test: `it_backend/src/main/java/com/kdb/it/common/notification/**`
- Modify/Test: selected DTO/controller Javadoc files from `BE-06`

**Interfaces:**
- Produces: regression test coverage without table DDL.
- Produces: common notification wording helper if duplication is reduced.

- [ ] **Step 1: Expand HWPX/PDF/Excel regression tests**

Add tests around table cells, image failures, variable nodes, and export warnings using existing utilities. Do not modify document schema.

- [ ] **Step 2: Add `CinfmmRepositoryImpl` integration test**

Use existing `AbstractOracleRepositoryTest` where Oracle is available. Test `markAllReadByRmsEno` updates rows and audit columns using current table columns.

- [ ] **Step 3: Validate projection DTO coverage**

For `ProjectRepositoryImpl` and `CostRepositoryImpl`, ensure list queries select lightweight DTO rows and tests assert large text/body columns are not required for list screens.

- [ ] **Step 4: Consolidate notification wording**

Create or reuse a small helper for null-safe truncation. Example interface:

```java
public final class NotificationMessageFormatter {
    private NotificationMessageFormatter() {
    }

    public static String abbreviate(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return "";
        }
        if (value.length() <= maxLength) {
            return value;
        }
        if (maxLength <= 1) {
            return value.substring(0, maxLength);
        }
        return value.substring(0, maxLength - 1) + "…";
    }
}
```

Use only if at least two services can share it without widening dependencies.

- [ ] **Step 5: Reduce Javadoc warnings in priority files**

Target `CouncilDto`, `BudgetStatusDto`, `Bprojm`, `ContractController`. Add meaningful Korean JavaDoc for public DTO fields/methods. Do not add noisy comments to trivial assignments.

- [ ] **Step 6: Verify**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/utils/hwpx.test.ts tests/unit/utils/hwpx-images.test.ts tests/unit/composables/useHwpxExport.direct.test.ts
cd C:\it\it_backend
.\gradlew test --tests "*CinfmmRepositoryImpl*" --tests "*ProjectRepositoryImpl*" --tests "*CostRepositoryImpl*" --warning-mode all
.\gradlew javadoc --warning-mode all
```

Expected: focused tests pass. Javadoc warning count decreases for touched files.

- [ ] **Step 7: Commit**

```powershell
cd C:\it\it_frontend
git add -- tests
git commit -m "test: 프론트 문서 내보내기 회귀 범위 확대"
cd C:\it\it_backend
git add -- src/main/java src/test/java
git commit -m "test: 무테이블 DDL 품질 회귀 범위 확대"
```

---

### Task 5: P4 Operational Extensions

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/realtime/**`
- Modify: `it_frontend/app/pages/admin/realtime-logs.vue`
- Modify: `it_frontend/app/components/admin/realtime/**`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/**`
- Modify: `it_frontend/app/pages/board/**`
- Modify: `it_frontend/app/components/board/**`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/eai/**`
- Modify: domain services in `it_backend/src/main/java/com/kdb/it/domain/{estimate,deliberation,contract,payment}/service`
- Test: relevant backend unit tests and `it_frontend/tests/e2e/admin/realtime-logs.spec.ts`, `it_frontend/tests/e2e/board.spec.ts`

**Interfaces:**
- Produces: operational enhancements that do not require table columns.
- Produces: EAI domain dispatch calls that fail closed as side effects.

- [ ] **Step 1: Realtime logs verification and drilldown**

Add/extend tests for:

```text
admin access: 200
normal user access: 403
anonymous access: 401
since cursor: returns only newer rows
row click: opens BEFORE/AFTER detail
```

Use existing `/admin/logs/[logKey]` data path where possible.

- [ ] **Step 2: Realtime logs filter persistence**

Store user filters in `localStorage` with a scoped key such as `itp:admin:realtimeLogs:filters`. Do not store credentials or sensitive data.

- [ ] **Step 3: Realtime logs operational policy and push option**

Cover `LOG-03` and `LOG-04` explicitly:

```text
LOG-03: SSE/WebSocket 전환은 구현 전환이 아니라 운영 임계치와 feature flag 설계로 문서화한다. 실제 push 전환은 별도 기능으로 분리한다.
LOG-04: 보존 정책은 현재 조회/아카이브 View 분리 설계와 운영 설정 문서로 남긴다. 테이블 분리나 신규 아카이브 테이블은 금지한다.
```

If implementation needs a new table or column, leave `LOG-03`/`LOG-04` in `TASK.md`.

- [ ] **Step 4: Realtime logs explain-plan and index-only database change**

Cover `LOG-06` explicitly. In `it_database`, only index/view scripts are allowed. Run local Oracle `EXPLAIN PLAN` and record the result in a note file such as:

```text
docs/superpowers/notes/2026-07-07-realtime-log-explain.md
```

If an index is added, commit inside `C:\it\it_database` only:

```powershell
cd C:\it\it_database
git add -- migrations
git commit -m "perf: 실시간 로그 조회 인덱스 보강"
```

- [ ] **Step 5: Board no-DDL improvements**

Implement only no-DDL board work:

```text
BRD-01: enforce current VARCHAR2(4000) body limit in validation/UI
BRD-02: Oracle Text/index plan only if no table column change
BRD-03: Redis counter design/feature flag, no schema dependency
BRD-04: notification event wiring
BRD-07: UI depth cap 5
BRD-08: search keyword minimum length 2
BRD-09: server-side pagination using existing query
BRD-10: service tests
```

Skip `BRD-05`, `BRD-06`, `BRD-11`.

- [ ] **Step 6: EAI operational settings and domain dispatch**

Ensure `eai.enabled` and `eai.url` are environment-driven. Connect `EaiService.sendEai()` from status transition points as side effects. Wrap dispatch:

```java
try {
    eaiService.sendEai(request);
} catch (Exception e) {
    log.warn("EAI 발송 실패 — 원 업무 처리는 유지합니다.", e);
}
```

Prefer `EaiResult.failure` handling over catching broad exceptions if current service already guarantees no throw.

- [ ] **Step 7: NotificationDispatcher-to-EAI bridge**

Cover `EAI-03` explicitly. Add an implementation of `NotificationDispatcher` or a router that delegates configured external channels to `EaiService` while preserving the existing in-app behavior. The interface must remain:

```java
void dispatch(Cinfmm notification, String sdPayload);
```

Expected behavior:

```text
INAPP channel remains local.
External EAI channel calls EaiService.sendEai().
EaiResult.failure logs warn and does not throw.
```

- [ ] **Step 8: Verify**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*RealtimeLog*" --tests "*Board*" --tests "*Eai*" --warning-mode all
cd C:\it\it_frontend
npm test -- tests/unit/utils/realtimeLogs.test.ts
npm run test:e2e -- tests/e2e/admin/realtime-logs.spec.ts tests/e2e/board.spec.ts
```

Expected: backend tests pass. E2E requires frontend/backend dev servers; if unavailable, record that as an execution blocker.

- [ ] **Step 9: Commit**

```powershell
cd C:\it\it_backend
git add -- src/main/java src/test/java
git commit -m "feat: 무테이블 DDL 백엔드 운영 확장 개선"
cd C:\it\it_frontend
git add -- app tests
git commit -m "feat: 무테이블 DDL 프론트 운영 확장 개선"
cd C:\it
git add -- docs/superpowers/notes
git commit -m "feat: 무테이블 DDL 운영 확장 개선"
```

---

### Task 6: Documentation and TASK Cleanup

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`
- Modify if needed: `it_backend/CLAUDE.md`
- Modify if needed: `it_frontend/CLAUDE.md`

**Interfaces:**
- Consumes: completed task IDs from Tasks 1-5.
- Produces: `TASK.md` containing only remaining work.

- [ ] **Step 1: Move completed IDs**

For each completed ID, add a dated row to `TASK_DONE.md` with:

```text
상태 | 우선순위 | 과제 | 근거
```

The 근거 cell must include touched files and verification command.

- [ ] **Step 2: Remove completed IDs from TASK.md**

Delete completed rows from `TASK.md`. Keep excluded table-DDL items in `TASK.md`.

- [ ] **Step 3: Update CLAUDE.md only for durable rules**

Only add rules that will prevent recurrence, such as Refresh Token concurrency policy or board search minimum length. Do not add volatile counts.

- [ ] **Step 4: Final verification**

Run:

```powershell
cd C:\it
git diff -- TASK.md TASK_DONE.md
cd C:\it\it_backend
git diff -- CLAUDE.md
cd C:\it\it_frontend
git diff -- CLAUDE.md
cd C:\it\it_database
git diff -- migrations ITPOWN_DDL_live.sql | Select-String -Pattern 'CREATE TABLE|ALTER TABLE|ADD .*COLUMN|DROP COLUMN|PRIMARY KEY|CONSTRAINT'
cd C:\it\it_backend
git diff -- src/main/resources | Select-String -Pattern 'CREATE TABLE|ALTER TABLE|ADD .*COLUMN|DROP COLUMN|PRIMARY KEY|CONSTRAINT'
```

Expected: docs reflect completed work; no forbidden table DDL appears.

- [ ] **Step 5: Commit**

```powershell
cd C:\it
git add -- TASK.md TASK_DONE.md
git commit -m "docs: 무테이블 DDL 개선 완료 항목 정리"
cd C:\it\it_backend
git add -- CLAUDE.md
git commit -m "docs: 무테이블 DDL 백엔드 규칙 반영"
cd C:\it\it_frontend
git add -- CLAUDE.md
git commit -m "docs: 무테이블 DDL 프론트 규칙 반영"
```

---

## Self-Review

- Spec coverage: P0 covers `SEC-01`, `SEC-02`; P1 covers `ERR-01`, `ERR-02`, `BE-04`; P2 covers `FE-01`, `FE-02`, `TIP-01`, `TIP-04`; P3 covers `BE-01`, `BE-02`, `BE-03`, `BE-05`, `BE-06`, `TIP-02`, `TIP-03`, `TIP-05`; P4 covers `LOG-01~07`, `EAI-02~04`, `EAI-07`, `BRD-01~04`, `BRD-07~10`.
- Exclusions: `REV-01~03`, `BRD-05`, `BRD-06`, `BRD-11`, `EAI-01`, `EAI-05`, `EAI-06`, `META-01~03` remain out of implementation scope.
- Placeholder scan: 통과. 미정 표기와 불완전 구현 지시가 없다.
- Type consistency: `AuthService.refreshAccessToken(String)` matches the current service method. `review.ts` keeps `loadWarnings: string[]` as the single source of truth for partial load failures.
