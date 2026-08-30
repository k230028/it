# TASK.md 2026-08-30 Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TASK.md의 활성 오류·성능·타입·품질 과제를 구현하고, 재발 방지 규칙을 관련 README.md와 CLAUDE.md에 반영한다.

**Architecture:** 이관 입력은 파싱 결과와 진단을 분리해 malformed 값을 정상 기본값으로 흘려보내지 않는다. 목록·bulk 조회는 DB projection/페이지네이션/IN 배치로 경계를 명확히 하고, 프론트는 단일 조회 수명주기와 공통 접근 컨텍스트를 사용한다. API 계약 변경은 백엔드 OpenAPI 테스트를 먼저 통과시킨 뒤 프론트 codegen을 재생성한다.

**Tech Stack:** Java 25, Spring Boot, JPA/QueryDSL, Gradle/Spotless/Javadoc, Nuxt 4, Vue 3, TypeScript, Vitest, Playwright, OpenAPI Generator.

**Spec:** `TASK.md`

## Global Constraints

- 기존 미커밋 변경은 보존하고, 작업 대상 파일의 diff를 확인한 뒤 필요한 부분만 수정한다.
- 새 Java/TypeScript 주석은 한국어로 작성한다.
- `TEST.md` 및 참 양성 E2E 기대값은 약화하거나 수정하지 않는다.
- 이관 malformed 값은 blank와 구분하고 commit 경로에서 정상 기본값으로 저장되지 않게 한다.
- API 계약은 백엔드 테스트와 프론트 `npm run codegen:check`를 함께 통과시킨다.
- 완료 전 백엔드·프론트 정적 검사와 관련 테스트의 실제 출력으로 검증한다.

---

### Task 1: 이관 비율·일반관리비 오염 진단

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/AdapterSupport.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationCellChecks.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationIoeCatalogReader.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationDiagnosticCode.java` and API contract metadata as needed
- Test: existing migration validator/catalog/adapter tests plus focused regression tests

**Interfaces:** blank rate remains the explicit 1.0 default; malformed rate produces a distinct diagnostic and cannot be treated as a valid multiplier. A malformed `DUP_IOE_MNGC` value produces an explicit configuration outcome/diagnostic instead of indistinguishable 100% fallback.

- [ ] Write failing tests for blank-vs-malformed adjustment rate and malformed `DUP_IOE_MNGC`.
- [ ] Run the focused backend tests and verify they fail for the current silent fallback.
- [ ] Implement the smallest typed parse/result and diagnostic flow; keep normal missing values compatible.
- [ ] Run migration validator, adapter, catalog, and OpenAPI diagnostic-code tests.

### Task 2: 협의회 조회 실패 표면화

**Files:**
- Modify: `it_frontend/app/components/council/result/ResultForm.vue`
- Modify: `it_frontend/app/components/council/notice/CouncilNotice.vue`
- Modify: related i18n messages and component tests only when required

**Interfaces:** each initial council fetch exposes `loading`, `error`, `retry`, and `empty` as distinct states; failed requests clear/avoid success-derived fallback data.

- [ ] Add failing component tests for rejected result/notice requests, retry, and no false “수립” fallback.
- [ ] Run those tests and confirm current empty catch/null fallback fails them.
- [ ] Add explicit error refs and retry actions while preserving successful empty and 조정 states.
- [ ] Run focused Vitest tests and relevant frontend typecheck.

### Task 3: 프론트 초기 조회 중복 제거

**Files:**
- Modify: `it_frontend/app/app.vue` or the actual duplicate route/render owner identified by the tests
- Modify: `it_frontend/app/composables/useInfoHomeFeed.ts`
- Modify: review page/session owner and `useDocuments`/review composables as required
- Test: `it_frontend/tests/e2e/info-home.spec.ts`, `review-comment-attachments.spec.ts` are read-only acceptance tests; add unit regressions elsewhere

**Interfaces:** one logical page entry creates one initial request per endpoint; reactivation refreshes only after the first activation, and initial failure is not silently retried.

- [ ] Add failing unit-level lifecycle/dedup tests for the info feed and review session.
- [ ] Run the existing Playwright acceptance tests to capture the current duplicate counts.
- [ ] Remove duplicate initial watcher/render paths and use stable request keys/shared in-flight promises where separate consumers legitimately exist.
- [ ] Run the two E2E specs and related unit tests; do not reduce their expected request counts.

### Task 4: 프론트 타입 부채 및 접근 판정 공통화

**Files:**
- Modify: `it_frontend/app/composables/useApiFetch.ts`
- Modify: `it_frontend/app/composables/useAdminTableEdit.ts`
- Create or modify: `it_frontend/app/composables/council/useCouncilAccessContext.ts`
- Modify: `useCouncilPreparationAccess.ts`, `useCouncilResultAccess.ts`
- Test: related composable unit tests and type-level assertions

**Interfaces:** the API option adapter accepts a typed public option shape and returns the exact `useFetch` option shape without `any`; admin rows have separate metadata-bearing input and cleaned business output types; both council access composables consume one normalized context.

- [ ] Add failing type/unit tests for option forwarding, metadata removal, and shared access semantics.
- [ ] Run frontend typecheck/tests and confirm the current casts or duplicated behavior fail the new assertions.
- [ ] Implement typed adapters and the shared council access context without changing public behavior.
- [ ] Run `npm run check`, focused Vitest tests, and lint/type checks.

### Task 5: 프로젝트·비용 목록 projection/page 처리

**Files:**
- Modify: project/cost repository custom interfaces and implementations
- Modify: `ProjectQueryService.java`, `CostQueryService.java`, response/page DTOs/controllers as required
- Test: project/cost repository and service tests

**Interfaces:** list searches use bounded page/size, explicit stable ordering, DB-side projection, and count; existing response fields remain compatible unless a documented additive page wrapper is required.

- [ ] Add failing repository/service tests asserting projection, bounds, ordering, and response mapping.
- [ ] Run focused tests and verify current full-entity unbounded fetch violates them.
- [ ] Implement QueryDSL projection and pagination with a safe default/max size and preserve detail queries.
- [ ] Run focused tests plus backend check for API compatibility.

### Task 6: 신청서·생략판정 batch 조회

**Files:**
- Modify: `ApplicationService.java` and repository projection/query interfaces
- Modify: `CouncilSkipService.java` and council repository/service query interfaces
- Test: application bulk/list and council skip tests

**Interfaces:** list and bulk application assembly performs bounded master read plus IN-batched approver/requester/department reads; skip requests load active councils by ID set and preserve source order and missing-data semantics.

- [ ] Add failing query-count/order/duplicate-ID tests for application bulk and skip list.
- [ ] Run focused tests and confirm per-ID detail/council calls are observed.
- [ ] Implement batched reads and in-memory maps, retaining authorization and soft-delete predicates.
- [ ] Run focused service/repository tests and full backend test suite.

### Task 7: 게시판 공통 helper 및 OpenAPI 계약

**Files:**
- Create or modify shared board lookup/text helper in the existing board service package
- Modify: `BoardPostService.java`, `BoardCommentService.java`
- Modify: `CostTerminalDto.java`, `ApiResponseOpenApiContractTest.java`
- Regenerate: `it_frontend/app/types/api.d.ts`

**Interfaces:** board/post lookup and safe text normalization have one implementation while preserving service-specific authorization/locking behavior. Terminal snapshot name fields are required nullable OpenAPI properties and appear in generated frontend types.

- [ ] Add failing helper parity tests and OpenAPI required-property assertions for both names.
- [ ] Run focused tests to verify current duplication/contract omission.
- [ ] Extract the shared helper, update DTO/test metadata, start the backend, then run frontend codegen and codegen check.
- [ ] Run board/contract tests and frontend typecheck.

### Task 8: 공통 데이터 이관 dry-run 보강

**Files:**
- Modify: `CommonDataMigrationService.java` and related planner/diagnostic classes
- Test: common migration planner/service/controller tests

**Interfaces:** large code-ID loads use chunks of at most 900; orphan translations cover menu and length-prefixed common-code keys; ATH_ID candidates require `delYn='N'`; dry-run reports `LENGTH_EXCEEDED` before commit.

- [ ] Add failing tests for >900 IDs, common-code orphan keys, deleted ATH_ID, and overlong target columns.
- [ ] Run focused tests and verify current implementation misses each case.
- [ ] Implement the four validations using existing diagnostic contracts and no applied migration edits.
- [ ] Run all migration tests and API contract tests.

### Task 9: Javadoc/Spotless/프로젝트 규칙 문서화

**Files:**
- Modify: `it_backend/scripts/check-javadoc-warnings.ps1` and baseline/config as justified by measured output
- Modify only intended files for Spotless violations after diff review
- Modify: relevant root/backend/frontend `README.md` and `CLAUDE.md` sections
- Modify: `TASK.md`, append completion evidence to `TASK_DONE.md`

**Interfaces:** Javadoc warning checks always rerun the task and fail above the measured accepted baseline; format checks pass for the touched worktree. Documentation states the request deduplication, projection/pagination, batch-query, typed-contract, and migration-validation rules.

- [ ] Add/adjust regression checks for the script invocation and documentation rules where practical.
- [ ] Run the Javadoc script and Spotless check to capture current failures.
- [ ] Add `--rerun`/baseline policy, format only reviewed target files, and document the new rules.
- [ ] Move only verified completed active rows from TASK.md to TASK_DONE.md with test evidence.

### Task 10: Full verification

- [ ] Run backend focused tests, `./gradlew.bat test`, `check`, `bootJar`, and Javadoc/Spotless checks.
- [ ] Run frontend `npm run format:check`, `npm run check`, `npm test`, `npm run codegen:check`, and relevant E2E specs.
- [ ] Inspect every repository diff/status and confirm no unrelated user changes were overwritten.
- [ ] Only after fresh outputs pass, mark the plan and TASK entries complete.
