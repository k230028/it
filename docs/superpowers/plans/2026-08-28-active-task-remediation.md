# 활성 잔여과제 일괄 조치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md`의 활성 항목 중 BE-64를 제외한 FE-59·FE-60·BE-76·BE-77·BE-75·SEC-12를 구현과 검증 근거가 있는 상태로 종결한다.

**Architecture:** 기존 API·서비스·E2E 구조를 유지하고 각 결함을 가장 가까운 계약 테스트로 고정한다. OpenAPI 이름은 DTO에서 고유화하고, 영속성 재저장은 삭제 행을 포함한 조회 후 복원하는 기존 패턴을 따른다. 테스트 부채는 Playwright 시나리오와 동적 예산연도 fixture로 해소하며 Javadoc은 경고 유형별 최소 주석과 기준선 검사로 관리한다.

**Tech Stack:** Java 25, Spring Boot 4, JUnit 5, Spring Data JPA, springdoc, Nuxt 4, TypeScript, Playwright, Vitest, Gradle

**Spec:** 사용자 승인 설계(2026-08-28 대화)

## Global Constraints

- BE-64는 변경하지 않는다.
- 기존 사용자 변경을 되돌리거나 덮어쓰지 않는다.
- 신규 JavaDoc·TSDoc·인라인 주석은 한글로 작성한다.
- API 계약 변경 뒤 프론트 OpenAPI 타입을 재생성하고 검사한다.
- 각 동작 변경은 실패하는 회귀 테스트를 먼저 확인한다.

---

### Task 1: OpenAPI SaveRequest 고유화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/budgetnote/BudgetCardNoteDto.java`
- Test: `it_backend/src/test/java/**/OpenApi*Test.java`
- Generated: `it_frontend/app/types/api.d.ts`

- [ ] 충돌을 재현하는 OpenAPI 계약 테스트를 추가하고 실패를 확인한다.
- [ ] 두 요청 DTO에 고유한 `@Schema(name=...)`를 부여한다.
- [ ] 백엔드 계약 테스트와 프론트 codegen/check를 통과시킨다.

### Task 2: E2E 예산연도 안정화

**Files:**
- Modify: `it_frontend/tests/e2e/*.spec.ts`

- [ ] 고정 `bseYy`가 실제 연도 필터에 쓰이는 스펙을 전수 분류한다.
- [ ] 관련 fixture를 `defaultBudgetYear()` 기반으로 바꾼다.
- [ ] 대상 스펙을 8월 기준으로 실행해 목록과 동작을 검증한다.

### Task 3: GUID 보존 재저장

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/**/service/*.java`
- Test: 대응 서비스 단위 테스트

- [ ] 7개 흐름마다 삭제 행과 같은 PK가 있는 경우를 재현하는 실패 테스트를 추가한다.
- [ ] 삭제분 포함 조회 후 기존 엔티티 복원 또는 GUID 보존으로 저장한다.
- [ ] 각 대상 테스트와 전체 백엔드 테스트를 통과시킨다.

### Task 4: OnePass 거부 상태 경계

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/OnePassClient.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/provider/OnePassClientTest.java`
- Modify: MFA 연동 문서(필요 시)

- [ ] 현행 규격·fixture가 제공하는 상태값을 확인한다.
- [ ] 알려진 거부 상태가 있으면 실패 판정 테스트와 구현을 추가한다.
- [ ] 상태값이 없으면 임의 추정을 금지하는 계약 테스트와 외부 의존 근거를 문서화한다.

### Task 5: 관리자·사업단계 E2E

**Files:**
- Create/Modify: `it_frontend/tests/e2e/admin/*.spec.ts`
- Create: `it_frontend/tests/e2e/project-stage-actions.spec.ts`

- [ ] 공통 관리자 API fixture와 화면별 저장 시나리오를 작성한다.
- [ ] 관리자 편집 화면 13개의 진입·조회·핵심 편집 동작을 검증한다.
- [ ] 심의·계약·지급 상세의 저장·검증·상신 흐름을 검증한다.
- [ ] 신규 스펙을 실행하고 실패 원인을 수정한다.

### Task 6: Javadoc 기준선 제거

**Files:**
- Modify: `it_backend/src/main/java/**/*.java`
- Modify: `it_backend/build.gradle` 또는 Javadoc 검증 스크립트

- [ ] 현재 Javadoc 출력을 저장해 경고 유형과 파일을 재확인한다.
- [ ] 기본 생성자·타입·반환값·매개변수 주석을 패키지 단위로 보강한다.
- [ ] `./gradlew javadoc` 경고 0건과 빌드 성공을 확인한다.
- [ ] 신규 경고가 빌드 게이트에서 탐지되는 기준을 추가한다.

### Task 7: 통합 검증과 과제 이관

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`
- Modify: `versions.lock` (호환 조합이 바뀐 경우)

- [ ] 백엔드 `test`, `check`, `bootJar`, `javadoc`을 실행한다.
- [ ] 프론트 `format:check`, `check`, `test`, 관련/전체 E2E, `codegen:check`을 실행한다.
- [ ] 완료 근거와 제한을 `TASK_DONE.md`에 기록한다.
- [ ] `TASK.md`에는 제외 요청된 BE-64만 활성 상태로 남긴다.
