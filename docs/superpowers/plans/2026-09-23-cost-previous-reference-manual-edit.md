# Cost Previous Reference Manual Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전산업무비 단건 수정 화면에서 다른 부서의 직전 연도 관리번호를 안전하게 직접 연결하고 전년도 예산을 자동 반영한다.

**Architecture:** 부서 상세조회 권한은 그대로 유지하고, 최소 필드만 반환하는 전년도 참조 전용 API를 추가한다. 프론트는 읽기 전용 기본 상태에서 수정 모드로 전환해 정확 조회 후에만 모델을 확정하며 저장 직전에도 검증 상태를 확인한다.

**Tech Stack:** Spring Boot, JPA repository, Vue 3/Nuxt, PrimeVue, Vitest, JUnit 5/Mockito

**Spec:** `docs/superpowers/specs/2026-09-23-cost-previous-reference-manual-edit.md`

## Global Constraints

- 다른 부서의 전체 전산업무비 상세정보는 노출하지 않는다.
- 현재 항목의 직전 연도 관리번호만 허용한다.
- 기존 전년도 항목 선택 다이얼로그 동작을 유지한다.
- `it_frontend` 작업트리의 기존 사용자 변경을 보존한다.

## Review Focus

- 존재하지 않는 관리번호는 404와 전용 안내로 처리되는가.
- 존재하지만 직전 연도가 아닌 관리번호는 400과 전용 안내로 처리되는가.
- 다른 부서 항목도 최소정보 API로 연결 가능한가.
- 입력 도중 또는 검증 실패 상태에서 저장이 차단되는가.
- 기존 `[연결]` 선택으로 적용한 항목은 검증 완료 상태로 유지되는가.

---

### Task 1: 전년도 참조 조회 및 저장 검증 API

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/dto/CostQueryDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostQueryService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostQueryServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/controller/CostControllerTest.java`

**Interfaces:**
- Produces: `GET /api/cost/previous-reference/{costBgNo}?currentYear=YYYY`
- Produces: `CostQueryDto.PreviousReference(costBgNo, bseYy, prevBgAmt, prevCurC)`
- Consumes: 기존 `CostRepository.findByCostBgNoAndDelYn` 및 `CostDto.UpdateRequest`

- [ ] **Step 1: 실패 테스트 작성** — 정상·미존재·연도불일치 조회와 수정 저장 재검증을 명시한다.
- [ ] **Step 2: RED 확인** — `./gradlew test --tests '*CostQueryServiceTest' --tests '*CostControllerTest' --tests '*CostServiceTest'`가 새 API/메서드 부재로 실패해야 한다.
- [ ] **Step 3: 최소 구현** — 최소 응답 DTO, 공개 조회 엔드포인트, 직전 연도 판정과 수정 저장 검증을 추가한다.
- [ ] **Step 4: GREEN 확인** — 같은 테스트 명령이 통과해야 한다.

### Task 2: 단건 수정 화면의 수정/확인 UX

**Files:**
- Modify: `it_frontend/app/composables/useCost.ts`
- Modify: `it_frontend/app/components/cost/CostFormSections.vue`
- Modify: `it_frontend/app/pages/info/cost/form.vue`
- Modify: `it_frontend/i18n/messages/cost.ts`
- Test: `it_frontend/tests/unit/components/cost/CostFormSections.test.ts`
- Test: `it_frontend/tests/unit/composables/useCost.test.ts`
- Test: `it_frontend/tests/unit/pages/costFormPage.test.ts` 또는 동등한 기존 페이지 소스 계약 테스트

**Interfaces:**
- Consumes: Task 1의 전년도 참조 API와 `PreviousReference` 응답
- Produces: `[연결][수정]`, 수정 중 `[확인][취소]`, 인라인 오류, 저장 차단 상태

- [ ] **Step 1: 실패 테스트 작성** — 버튼 순서, 입력 전환/이벤트, API 요청, 성공 반영, 오류 문구, 미검증 저장 차단을 명시한다.
- [ ] **Step 2: RED 확인** — 관련 Vitest 파일이 새 동작 부재로 실패해야 한다.
- [ ] **Step 3: 최소 구현** — 조회 함수와 편집 상태를 추가하고 기존 선택 적용 시 검증 완료로 전환한다.
- [ ] **Step 4: GREEN 확인** — 관련 Vitest 파일이 통과해야 한다.

### Task 3: 통합 검증

**Files:**
- Verify only: backend/frontend affected files

**Interfaces:**
- Consumes: Task 1과 Task 2 전체 계약
- Produces: 정적 검사와 회귀 테스트 증거

- [ ] **Step 1: 백엔드 비용 도메인 테스트 실행** — `./gradlew test --tests 'com.kdb.it.domain.budget.cost.*'`.
- [ ] **Step 2: 프론트 관련 단위 테스트 실행** — 변경된 테스트들과 `npm run typecheck`.
- [ ] **Step 3: 변경 파일 diff를 검토** — 기존 사용자 변경과 섞이지 않았는지 확인한다.

