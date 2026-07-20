# 테스트 커버리지 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비즈니스 로직을 변경하지 않고 백엔드·프론트엔드 단위 테스트와 E2E 시나리오를 보강하고 재현 가능한 HTML 결과 보고서를 생성한다.

**Architecture:** 기존 JUnit 5/Mockito, Vitest, Playwright 테스트 패턴을 유지하며 실제 커버리지 리포트의 파일별 미달 분기를 우선 보강한다. 테스트 작성 영역을 백엔드, 프론트엔드, E2E로 분리하고 마지막에 전체 커버리지와 정적 품질 게이트를 순차 실행한다.

**Tech Stack:** Java 25, Spring Boot 4, JUnit 5, Mockito, JaCoCo, Nuxt 4, Vue 3, TypeScript, Vitest, Playwright

---

### Task 1: 커버리지 기준선 확정

**Files:**
- Read: `it_backend/build/reports/jacoco/test/jacocoTestReport.xml`
- Read: `it_frontend/coverage/coverage-summary.json`

- [ ] 백엔드 테스트와 JaCoCo 보고서를 단독 실행하여 병렬 실행으로 오염되지 않은 기준선을 생성한다.
- [ ] 프론트엔드 Vitest 커버리지를 실행하고 실패 테스트 및 70% 경계 파일을 기록한다.
- [ ] 소스와 테스트를 교차 확인하여 리포트 미산출 파일을 별도 분류한다.

### Task 2: 백엔드 미달 분기 보강

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/**/*Test.java`

- [ ] `ApprovalStatus`, `NativeRowMapper`, `OwnershipVerifier`, `CustomUserDetails`의 성공·실패·경계 분기를 AAA 테스트로 추가한다.
- [ ] `DocVersionCodec`, `DateFormatUtil`, `BudgetAmountCalculator`, `HtmlSanitizer`의 null·잘못된 입력·허용/차단 분기를 추가한다.
- [ ] 관련 테스트를 먼저 실행한 뒤 전체 `test jacocoTestReport`를 실행한다.

### Task 3: 프론트엔드 미달 분기 보강

**Files:**
- Modify: `it_frontend/tests/unit/**/*.test.ts`

- [ ] `useCouncilCodes`의 상태 코드 계약 변경을 실제 소스 값과 맞춰 회귀 테스트 기대값을 갱신한다.
- [ ] `costListPageHelpers.ts`의 정상·빈 값·경계 입력을 직접 검증하는 신규 단위 테스트를 추가한다.
- [ ] 분기 커버리지 경계 파일의 실패·fallback 경로를 보강하고 `npm run test:coverage`로 확인한다.

### Task 4: E2E 시나리오 완성

**Files:**
- Modify: `it_frontend/tests/e2e/budget.spec.ts`
- Modify: `it_frontend/tests/e2e/documents.spec.ts`
- Modify: `it_frontend/tests/e2e/access-control.spec.ts`
- Modify: `it_frontend/tests/e2e/file-upload.spec.ts`

- [ ] 실제 라우트와 접근 가능한 셀렉터를 사용해 예산·사전협의·접근 제어·첨부파일 흐름을 검증한다.
- [ ] 각 네트워크 mock은 요청 방식과 응답 본문을 명시하고 사용자 결과를 단언한다.
- [ ] 선택 spec과 전체 Playwright 스위트를 실행해 실패 원인을 테스트 코드 범위에서 해소한다.

### Task 5: 정적 점검과 결과 보고

**Files:**
- Modify: `it_frontend/tests/e2e/generate-report.ts`
- Create: `docs/test/test-report-2026-07-02.html`

- [ ] FE `check`, `lint:css`, `format:check`를 실행한다.
- [ ] BE `clean compileJava --warning-mode all`, `javadoc`를 실행한다.
- [ ] Playwright JSON, Vitest JSON, JaCoCo XML을 읽는 단일 HTML 보고서를 생성한다.
- [ ] 데이터가 없는 섹션도 중단하지 않고 표시되는지 확인한다.
- [ ] 전체 검증 명령을 새로 실행한 결과만으로 최종 달성 여부를 판정한다.
