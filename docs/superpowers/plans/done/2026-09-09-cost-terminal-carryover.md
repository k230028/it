# Cost Terminal Carryover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 금융정보단말기를 부모 전산업무비에 직접 저장하고 전년도 복사본을 단말기 포함 수정 가능 신규 행으로 만든다.

**Architecture:** 백엔드에 부모 업무 필드를 전체 치환하지 않는 단말기 전용 PUT 경로를 추가한다. 프론트엔드는 연결 신규 모드에서 이 경로를 사용하고, 전년도 복제는 식별·결재 메타데이터를 제거하는 순수 변환으로 통일한다.

**Tech Stack:** Spring Boot, JPA, JUnit 5, Nuxt 4, Vue 3, TypeScript, Vitest

**Spec:** `docs/superpowers/specs/done/2026-09-09-cost-terminal-carryover-design.md`

## Global Constraints

- 공유 워킹트리의 무관한 변경을 수정하거나 되돌리지 않는다.
- 백엔드 API 계약을 먼저 확정하고 프론트 소비 코드를 뒤이어 변경한다.
- 신규 주석과 공개 메서드 설명은 한글로 작성한다.
- 운영 코드보다 회귀 테스트를 먼저 작성하고 예상 원인으로 실패하는지 확인한다.

---

### Task 1: 부모 단말기 전용 저장 API

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/dto/CostTerminalDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyGuard.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostTerminalUpdateService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostTerminalUpdateServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/controller/CostControllerTest.java`

**Interfaces:**
- Consumes: 부모 관리번호, 선택 순번, `terminals`, `concurrencyStamp`
- Produces: `PUT /api/cost/{itMngcNo}/terminals?sno={bgSno}` 및 부모 동일 개정본의 BTERMM 치환

- [x] **Step 1: 실패 테스트 작성** — 서비스 테스트에서 부모 잠금·검증 후 단말 동기화와 부모 요약 갱신을 검증하고, 컨트롤러 테스트에서 PUT 계약을 검증한다.
- [x] **Step 2: RED 확인** — `./gradlew test --tests '*CostTerminalUpdateServiceTest*' --tests '*CostControllerTest*replaceTerminals*'`가 미구현 메서드/경로 때문에 실패하는지 확인한다.
- [x] **Step 3: 최소 구현** — 전용 요청 DTO, 엔티티 요약 갱신 메서드, 서비스 트랜잭션, 컨트롤러 PUT 경로를 추가한다.
- [x] **Step 4: GREEN 확인** — 같은 테스트를 재실행해 통과시킨다.

### Task 2: 프론트엔드 부모 직접 저장 전환

**Files:**
- Modify: `it_frontend/app/composables/useCost.ts`
- Modify: `it_frontend/app/components/cost/TerminalFormDialog.vue`
- Test: `it_frontend/tests/unit/components/cost/TerminalFormDialog.test.ts`

**Interfaces:**
- Consumes: Task 1의 `PUT /api/cost/{id}/terminals`, 부모 `bgSno`, `concurrencyStamp`
- Produces: `replaceTerminals(id, payload, bgSno)`와 연결 모드의 동일 부모 저장

- [x] **Step 1: 실패 테스트 작성** — 연결 모드가 별도 BCOSTM 생성 대신 부모 단말기 치환 함수를 호출하고 부모 순번·스탬프를 전달하는지 검증한다.
- [x] **Step 2: RED 확인** — 대상 Vitest가 기존 `createLinkedCost` 호출 때문에 실패하는지 확인한다.
- [x] **Step 3: 최소 구현** — 부모 조회 응답을 편집 모델로 유지하고 새 API 함수를 호출한다.
- [x] **Step 4: GREEN 확인** — TerminalFormDialog 테스트를 통과시킨다.

### Task 3: 전년도 복제 정규화와 수정 가능 상태

**Files:**
- Modify: `it_frontend/app/composables/costList/useCostCarryOver.ts`
- Modify: `it_frontend/app/composables/costList/useCostEditingState.ts`
- Test: `it_frontend/tests/unit/composables/costList/useCostCarryOver.test.ts`
- Test: `it_frontend/tests/unit/composables/costList/useCostEditingState.test.ts`

**Interfaces:**
- Consumes: 전년도 `ItCost`
- Produces: 서버 식별자·결재 메타데이터가 없는 깊은 복사 신규 행

- [x] **Step 1: 실패 테스트 작성** — 전년도 복사본의 단말기 식별자 제거, 결재 메타 제거, 신규 행 편집 가능을 각각 검증한다.
- [x] **Step 2: RED 확인** — 대상 Vitest가 잔존 식별자/결재 상태 때문에 실패하는지 확인한다.
- [x] **Step 3: 최소 구현** — 복제 정규화 함수와 신규 행 잠금 예외를 구현한다.
- [x] **Step 4: GREEN 확인** — 대상 테스트를 통과시킨다.

### Task 4: 통합 검증

**Files:**
- Verify only

**Interfaces:**
- Consumes: Tasks 1–3의 API와 UI 계약
- Produces: 회귀 없는 검증 결과

- [x] **Step 1: 백엔드 관련 테스트 실행** — 비용 컨트롤러·서비스·조회 조립 테스트를 실행한다.
- [x] **Step 2: 프론트엔드 관련 테스트 실행** — 단말기 다이얼로그·전년도 복사·목록 편집 상태 테스트를 실행한다.
- [x] **Step 3: 정적 검사 실행** — 변경 파일 대상 포맷·타입·lint 검사를 실행하고 결과를 기록한다.

## 검증 메모

- 변경 대상 백엔드 테스트와 조회 조립 회귀 테스트는 통과했다.
- 변경 대상 프론트엔드 테스트 및 고정 문구 ratchet 106건은 통과했다.
- 전체 테스트의 잔여 실패는 공용 팝업 요청 파라미터 이름 4건과 사업 예산 화면 테스트 2건으로, 공유 워킹트리의 별도 변경 영역이다.
- OpenAPI 코드 생성은 별도 공용 팝업 변경으로 애플리케이션 컨텍스트가 시작되지 않아 실행하지 못했다.
