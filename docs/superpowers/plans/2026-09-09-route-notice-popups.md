# Route Notice Popups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공통 및 화면별 작성 안내 팝업 네 종류를 관리하고 대상 화면에서 오늘 숨김과 순차 노출을 지원한다.

**Architecture:** 백엔드는 허용 목록 enum으로 문서 식별자와 관리번호 접두사를 고정하고 기존 공통 팝업 API를 유형별 API로 확장한다. 프론트엔드는 `AppShell`의 단일 컨트롤러가 현재 경로에 맞는 공통/화면 안내를 조회해 큐로 표시하며, 유형·날짜·콘텐츠 버전별 쿠키로 오늘 숨김을 판정한다.

**Tech Stack:** Java 25, Spring Boot 4, JUnit/MockMvc, Nuxt 4, Vue 3, TypeScript, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-09-09-route-notice-popups.md`

## Global Constraints

- 사용자 지정 식별자와 경로 매핑을 그대로 적용한다.
- 전역 오버레이는 `AppShell`에 한 번만 마운트한다.
- 기존 공유 작업공간의 관련 없는 변경을 수정하거나 되돌리지 않는다.
- 신규 주석은 한글로 작성한다.
- 구현 전에 관련 테스트가 실패하는지 확인한다.

---

### Task 1: 허용 목록 기반 팝업 API

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/popup/CommonPopupType.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/popup/CommonPopupService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/popup/CommonPopupCreationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/popup/CommonPopupController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/popup/AdminCommonPopupController.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/popup/*Test.java`

**Interfaces:**
- Produces: `CommonPopupType.fromKey(String)`, 사용자 `GET /api/common-popup/{type}`, 관리자 `GET|PUT|DELETE /api/admin/common-popup/{type}`

- [ ] 유형별 조회·저장·중지·접두사 테스트를 추가한다.
- [ ] 관련 JUnit 테스트를 실행해 새 계약이 실패하는지 확인한다.
- [ ] 네 유형만 허용하는 enum과 일반화된 서비스·컨트롤러를 구현한다.
- [ ] 관련 JUnit 테스트를 다시 실행해 통과를 확인한다.

### Task 2: 데이터베이스 활성 문서 불변식 검토

**Files:**
- Inspect: `it_database/migrations/V20260907_002__ClassifyGuideDocumentsAndExpandProjectContent.sql`

**Interfaces:**
- Consumes: `common.info`, `common.ordn`, `common.cost`와 각 전용 관리번호 접두사
- Produces: 기존 `(DOC_DTL_ITM_C, DOC_TTL_CONE)` 활성 문서 유일 인덱스 재사용 결정

- [x] 기존 BGDOCM 인덱스 작성 규칙과 운영 메타데이터 검증 패턴을 확인한다.
- [x] 현재 일반 유일 인덱스가 새 식별자에도 동일 불변식을 보장하므로 중복 DDL을 만들지 않는다.

### Task 3: 단일 전역 컨트롤러의 경로별 큐와 오늘 숨김

**Files:**
- Modify: `it_frontend/app/types/common-popup.ts`
- Modify: `it_frontend/app/composables/useCommonPopup.ts`
- Modify: `it_frontend/app/components/layout/CommonPopupDialog.vue`
- Modify: `it_frontend/i18n/messages/layout.ts`
- Test: `it_frontend/tests/unit/composables/useCommonPopup.test.ts`
- Test: `it_frontend/tests/unit/components/layout/CommonPopupDialog.test.ts`

**Interfaces:**
- Produces: 현재 표시 유형·내용, `close(dismissToday?: boolean)`, 경로 진입별 공통→화면 안내 큐

- [ ] 네 경로 매핑, 큐 순서, 재진입, 자정 만료, 버전 변경 테스트를 작성한다.
- [ ] Vitest를 실행해 새 동작이 실패하는지 확인한다.
- [ ] 유형별 API 조회와 방문 큐, 다음 자정 만료 쿠키를 구현한다.
- [ ] 체크박스 문구를 `오늘 하루 보지 않기`로 바꾸고 열릴 때 상태를 초기화한다.
- [ ] 관련 Vitest를 다시 실행해 통과를 확인한다.

### Task 4: 네 종류 관리자 편집 화면

**Files:**
- Modify: `it_frontend/app/composables/admin/useCommonPopupAdmin.ts`
- Modify: `it_frontend/app/pages/admin/common-popup.vue`
- Modify: `it_frontend/i18n/messages/admin.ts`
- Test: `it_frontend/tests/unit/pages/AdminCommonPopup.test.ts`

**Interfaces:**
- Consumes: 관리자 유형별 공통 팝업 API
- Produces: 네 안내별 독립 조회·저장·게시 중지 UI

- [ ] 네 식별자의 편집·저장·게시 중지 테스트를 추가한다.
- [ ] Vitest를 실행해 실패를 확인한다.
- [ ] 반복 가능한 편집 섹션 모델과 유형별 API 호출을 구현한다.
- [ ] 관련 Vitest를 다시 실행해 통과를 확인한다.

### Task 5: 계약 생성과 통합 검증

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/common/popup/CommonPopupOpenApiContractTest.java`
- Regenerate: `it_frontend/app/types/api.d.ts`
- Test: 관련 백엔드·프론트 테스트

**Interfaces:**
- Consumes: 최종 OpenAPI 경로와 DTO
- Produces: 동기화된 프론트 API 타입과 회귀 검증 결과

- [ ] OpenAPI 경로 계약 테스트를 추가하고 실패를 확인한다.
- [ ] OpenAPI 및 프론트 타입을 재생성한다.
- [ ] 백엔드 `./gradlew test --tests 'com.kdb.it.common.popup.*'`를 실행한다.
- [ ] 프론트 관련 Vitest와 `npm run check`, `npm run format:check`, `npm run lint:css`를 실행한다.
- [ ] 영향 범위 E2E 테스트로 화면 진입 노출을 확인한다.
