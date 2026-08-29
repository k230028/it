# 테스트 커버리지 및 E2E 보강 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비즈니스 로직을 변경하지 않고 실제 커버리지 기준선에 따라 백엔드·프론트엔드 테스트와 E2E 시나리오를 보강하고 검증 보고서를 생성한다.

**Architecture:** 먼저 백엔드 JaCoCo와 프론트엔드 Vitest의 현재 산출물을 새로 생성하고 소스-테스트 교차 분석으로 우선순위를 확정한다. 테스트 변경은 기존 JUnit 5/Mockito, Vitest, Playwright 패턴을 따르며, 마지막에 정적 점검과 단일 HTML 보고서로 결과를 고정한다.

**Tech Stack:** Java 25, Spring Boot 4, JUnit 5, Mockito, JaCoCo, Nuxt 4, Vue 3, TypeScript, Vitest, Playwright

**Spec:** `C:\it\TEST.md`

## Global Constraints

- 비즈니스 로직(코드 자체)은 절대 수정하지 않는다.
- 신규 테스트는 성공·실패·경계 사례를 AAA 패턴으로 검증한다.
- 백엔드는 `it_backend\src\test`, 프론트엔드는 `it_frontend\tests`에만 테스트를 추가·개선한다.
- 기존 UTF-8 인코딩을 유지하고 신규 Java 주석은 한글로 작성한다.
- FE의 Nuxt `$fetch`는 `vi.stubGlobal('$fetch', mockFetch)`로 모킹한다.
- E2E는 실제 서버를 대상으로 하고 `page.route()` 모킹은 허용된 단위 E2E에만 사용한다.

### Task 1: 실제 기준선 및 갭 분석

**Files:**
- Read: `it_backend/src/main/java/**/*.java`
- Read: `it_backend/src/test/java/**/*.java`
- Read: `it_frontend/app/**/*.{ts,vue}`
- Read: `it_frontend/tests/**/*.{ts,vue}`
- Generate: `it_backend/build/reports/jacoco/test/jacocoTestReport.xml`
- Generate: `it_frontend/coverage/coverage-summary.json`

- [ ] `./gradlew test jacocoTestReport`를 실행하고 XML에서 클래스별 70% 미달 지표를 추출한다.
- [ ] `npm run test:coverage`를 실행하고 JSON에서 파일별 70% 미달 지표를 추출한다.
- [ ] 테스트 파일이 없는 service/composable/store/utility/middleware를 소스-테스트 파일명으로 교차 분석한다.
- [ ] 0%, 50% 미만, 70% 미만 순으로 보강 순서를 기록한다.

### Task 2: 백엔드 단위 테스트 보강

**Files:**
- Modify/Create: `it_backend/src/test/java/com/kdb/it/**/*Test.java`

- [ ] 기준선에서 가장 우선순위가 높은 순수 서비스·유틸·보안 계약 대상의 테스트를 먼저 작성한다.
- [ ] 각 대상에 대해 정상·예외·경계 입력을 AAA 형식으로 추가하고 Mockito 검증은 외부 상호작용에 한정한다.
- [ ] 특정 테스트를 먼저 실행해 실패 원인을 확인한 뒤 전체 백엔드 테스트와 JaCoCo를 재실행한다.

### Task 3: 프론트엔드 단위 테스트 보강

**Files:**
- Modify/Create: `it_frontend/tests/unit/**/*.test.ts`

- [ ] 기준선 70% 미달 파일의 실제 분기와 기존 테스트를 대조한다.
- [ ] composable/store/utility/middleware의 정상·실패·경계 상태를 명시적 import 및 프로젝트 mock 규칙으로 보강한다.
- [ ] 변경한 테스트를 단독 실행한 뒤 `npm run test:coverage`로 전체 지표를 확인한다.

### Task 4: E2E 시나리오 보강

**Files:**
- Modify/Create: `it_frontend/tests/e2e/budget.spec.ts`
- Modify/Create: `it_frontend/tests/e2e/documents.spec.ts`
- Modify/Create: `it_frontend/tests/e2e/access-control.spec.ts`
- Modify/Create: `it_frontend/tests/e2e/file-upload.spec.ts`

- [ ] 실제 라우트·셀렉터·API 계약을 확인하여 스캐폴드와 누락 시나리오를 구현한다.
- [ ] 두 서버가 기동된 상태에서 전체 Playwright를 실행하고 실패 spec을 원인별로 보강한다.
- [ ] 브라우저 기반 검증 결과와 Playwright JSON 결과를 교차 확인한다.

### Task 5: HTML 보고서 생성

**Files:**
- Modify/Create: `it_frontend/tests/e2e/generate-report.ts`
- Generate: `docs/test/test-report-2026-08-29.html`

- [ ] FE coverage JSON, BE JaCoCo XML, Playwright JSON이 없어도 각 섹션을 데이터 없음으로 표시하도록 보고서 생성기를 확인한다.
- [ ] `npm run generate-report`를 실행하고 요약 카드·미달 행·E2E 결과를 확인한다.

### Task 6: 정적 점검 및 최종 검증

**Files:**
- Read/Modify only if needed: 테스트 파일·테스트 주석·보고서 생성기

- [ ] `npm run check`, `npm run lint:css`, `npx prettier --check .`를 실행한다.
- [ ] `./gradlew clean compileJava --warning-mode all`, `./gradlew javadoc`를 실행한다.
- [ ] 전체 테스트·커버리지·E2E·보고서 생성 결과를 다시 확인하고 미달 항목은 사실대로 기록한다.

