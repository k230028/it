---
template: plan
version: 1.3
feature: tech-debt-implementation
date: 2026-05-09
author: K140024 (박종훈)
project: IT 정보화 Portal (it_backend / it_frontend)
status: Draft
---

# tech-debt-implementation Planning Document

> **Summary**: TASK.md Critical+High 18건 이행 — 보안·에러처리·DB최적화·프론트 리팩토링, TDD 방법론 적용, 재발 방지 컨벤션 반영
>
> **Project**: IT 정보화 Portal
> **Author**: K140024 (박종훈)
> **Date**: 2026-05-09
> **Status**: Draft
> **Source**: `C:/it/TASK.md` (기준일 2026-05-06, 최종 업데이트 2026-05-09)

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | TASK.md에 축적된 보안 취약점(비밀값 하드코딩, Brute-force 무방비, 파일 확장자 무검증), 에러 삼킴, N+1 쿼리, 프론트 중복 코드가 운영 리스크 및 유지보수 비용을 증가시킴 |
| **Solution** | Critical+High 18건을 TDD(Red→Green→Refactor) 방법론으로 단계적 이행 후 TASK.md 현행화, 재발 방지를 위해 CLAUDE.md·README에 컨벤션 추가 |
| **Function/UX Effect** | 운영 보안 리스크 제거, 결재·파일·예산 기능 안정성 향상, 프론트 날짜 표시 일관성 확보 |
| **Core Value** | 기술 부채 해소로 신규 기능 개발 속도 향상 및 운영 보안·안정성 확보 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | TASK.md Critical+High 항목이 운영 환경에서 보안 사고 및 장애 유발 가능성 높음 |
| **WHO** | 개발팀(코드 품질·안전성 직접 혜택), 운영팀(보안 사고 예방), 임직원 3,000명(서비스 안정성) |
| **RISK** | BudgetWorkService 쿼리 변경 시 예산 집계 로직 오차 발생 가능; ApplicationService @Transactional 재구조화 시 결재 흐름 회귀 |
| **SUCCESS** | TASK.md Critical+High 18건 전량 [Done], 각 수정에 TDD 테스트 추가, CLAUDE.md 재발 방지 컨벤션 반영 |
| **SCOPE** | Phase 1: 보안(4) → Phase 2: 에러처리(4) → Phase 3: DB/JPA(6) → Phase 4: 프론트(2) → Phase 5: 사전협의(2) → Phase 6: 문서/컨벤션 |

---

## 1. Overview

### 1.1 Purpose

`TASK.md`에 등록된 Critical·High 우선순위 기술 부채 18건을 체계적으로 이행하여 운영 보안 및 코드 품질을 개선한다.
각 수정은 **TDD(Red→Green→Refactor)** 방법론을 적용하며, 이행 완료 후 TASK.md를 현행화하고
동일 유형 문제 재발을 막기 위해 CLAUDE.md에 코딩 컨벤션을 추가한다.

### 1.2 Background

- `REVIEW.md` 정비(2026-05-06/09) 과정에서 발굴된 항목들이 TASK.md에 등록됨
- 보안 항목(비밀값 기본값, Brute-force, 파일 확장자)은 운영 배포 전 반드시 해소해야 함
- 에러 삼킴·스택트레이스 손실은 장애 원인 분석을 어렵게 하는 직접적 운영 리스크
- N+1 쿼리(BudgetWorkService)는 예산 화면 성능 저하의 주요 원인

### 1.3 Related Documents

- Source: `C:/it/TASK.md`
- 백엔드 SoT: `it_backend/CLAUDE.md`
- 프론트 SoT: `it_frontend/CLAUDE.md`
- 데이터 모델: `it_backend/docs/guides/data-model.md`

---

## 2. Scope

### 2.1 In Scope — Critical+High 18건

**Phase 1 — 보안 (4건)**
- [ ] SEC-01: `application.properties` 비밀값 `:default` 제거 + 구동 시 강제 실패 (Critical)
- [ ] SEC-02: `FileController`·`GeminiController` 소유권 검증 또는 `@PreAuthorize` 추가 (High)
- [ ] SEC-03: 로그인 Brute-force 보호 — DB 기반 실패 횟수(5회/10분) + 계정 잠금 (High)
- [ ] SEC-04: `FileService.uploadFileInternal()` 확장자 화이트리스트 검증 (High)

**Phase 2 — 에러 처리 (4건)**
- [ ] ERR-01: `SsoController.complete()` catch 블록에 `log.error()` 추가 (High)
- [ ] ERR-02: `FileService.java:318,325` IOException → `CustomGeneralException(msg, e)` cause 전달 (High)
- [ ] ERR-03: `ApplicationService.updateApprovalLineInDetail()` private `@Transactional` 제거·위임 메서드 추출 (High)
- [ ] ERR-04: `ApplicationService.java:207` 결재선 업데이트 실패 시 예외 재발생 → 롤백 보장 (High)

**Phase 3 — DB/JPA 최적화 (6건)**
- [ ] DB-01: `BudgetWorkService.getSummary()` N+1 → 단일 집계 쿼리 통합 (High)
- [ ] DB-02: `BudgetWorkService.getProjectSummary()` BBUGTM 루프 → IN절 일괄 조회 (High)
- [ ] DB-03: `BudgetWorkService.applyRates()` 개별 Upsert → Oracle MERGE INTO 또는 벌크 (High)
- [ ] DB-04: `CAPPLA` 테이블 복합 인덱스 존재 확인 및 미비 시 DDL 추가 (High)
- [ ] DB-05: `BITEMM(PRJ_MNG_NO)` 단일 컬럼 인덱스 확인 및 미비 시 추가 (High)
- [ ] DB-06: `Bprojm.update()` 35+ 파라미터 → `UpdateCommand` 객체 도입 (High)

**Phase 4 — 프론트엔드 리팩토링 (2건)**
- [ ] FE-01: `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 (High)
- [ ] FE-02: `formatDateTime` 3중 중복 구현 → `utils/common.ts` 단일 함수로 통합 (High)

**Phase 5 — 사전협의 (2건)**
- [ ] REV-01: 사전협의 세션/코멘트 상태 서버 영속화 전환 (High)
- [ ] REV-02: 검토자 목록 서버 API 조회 + `defaultReviewers` 하드코딩 제거 (High)

**Phase 6 — TASK.md 현행화 + 컨벤션 반영**
- [ ] TASK.md: 완료된 항목을 [Done]으로 이동 및 조치 내용 기록
- [ ] `it_backend/CLAUDE.md`: 재발 방지 컨벤션 추가 (§5.10~5.13)
- [ ] `it_frontend/CLAUDE.md`: 재발 방지 컨벤션 추가 (신규 섹션)

### 2.2 Out of Scope

- Medium·Low 우선순위 항목 (별도 스프린트로 추적)
- 사전협의 첨부파일 응답 매핑 (Medium — 서버 영속화 선행 필요)
- `RichEditor.client.vue` → TiptapEditor 마이그레이션 (HTML 구조 영향도 분석 선행)
- SHA-256 패스워드 → BCrypt 점진 전환 (레거시 SSO 연동 제약, 별도 검토)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 환경변수 미설정(빈값) 시 `IllegalStateException`으로 구동 즉시 실패 | Critical | Pending |
| FR-02 | `FileController` 본인 파일 여부 검증 로직 추가 | High | Pending |
| FR-03 | `GeminiController` 인증된 사용자 호출 가능하나 속도 제한 또는 `@PreAuthorize` 추가 | High | Pending |
| FR-04 | 로그인 연속 실패 5회 시 10분 잠금, DB 기반 (기존 CLOGNH 테이블 활용) | High | Pending |
| FR-05 | 허용 확장자 화이트리스트: `.pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif` | High | Pending |
| FR-06 | SSO 인증 실패 원인이 로그(`log.error`)로 남고 스택트레이스 포함 | High | Pending |
| FR-07 | `FileService` IOException 재포장 시 cause 체인 유지 → 스택트레이스 보존 | High | Pending |
| FR-08 | `ApplicationService.updateApprovalLineInDetail` Spring AOP 적용 유효화 (public 메서드로 위임) | High | Pending |
| FR-09 | 결재선 업데이트 실패 시 `@Transactional` 롤백 보장, 호출자에게 예외 전파 | High | Pending |
| FR-10 | `BudgetWorkService.getSummary()` N+1 제거 — 단일 집계 쿼리 결과 동일성 보장 | High | Pending |
| FR-11 | `BudgetWorkService.getProjectSummary()` IN절 조회 — 결과 동일성 보장 | High | Pending |
| FR-12 | `BudgetWorkService.applyRates()` 벌크/MERGE 전환 — 결과 동일성 보장 | High | Pending |
| FR-13 | CAPPLA/BITEMM 인덱스 DDL 적용 — `it_database/` 마이그레이션 파일 생성 | High | Pending |
| FR-14 | `Bprojm.update()` → `UpdateCommand` 객체 도입, 기존 호출부 전환 | High | Pending |
| FR-15 | `ApplicationViewerDialog.vue` 빈 파일 삭제, auto-import 충돌 없음 확인 | High | Pending |
| FR-16 | `formatDateTime(dateStr, format?)` 단일 함수 `utils/common.ts` 추가, 3곳 교체 | High | Pending |
| FR-17 | 사전협의 세션/코멘트 서버 API 저장·조회로 전환 | High | Pending |
| FR-18 | `stores/review.ts` `defaultReviewers` 하드코딩 제거, 서버 API 기반 조회 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 보안 | 빈 환경변수 시 즉시 구동 실패 | `./gradlew bootRun`으로 확인 |
| 보안 | 파일 악성 확장자 업로드 거부 (400 반환) | JUnit 단위 테스트 |
| 성능 | BudgetWorkService 쿼리 실행 횟수 감소 (N+1 → 1) | 쿼리 카운트 테스트 |
| 안정성 | 결재선 업데이트 실패 시 트랜잭션 롤백 | JUnit 통합 테스트 |
| 회귀 | 기존 JUnit 586건 / Vitest 902건 100% 통과 | `./gradlew test` / `npx vitest run` |
| TDD | 각 수정 항목마다 테스트 선작성(Red) 후 구현(Green) | 커밋 히스토리 검토 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] Critical+High 18건 전량 구현 완료 및 TASK.md [Done] 전환
- [ ] 각 항목별 JUnit(백엔드) 또는 Vitest(프론트엔드) 테스트 추가 (TDD Red→Green)
- [ ] `./gradlew test` exit 0 (기존 586건 유지 + 신규 테스트 통과)
- [ ] `npx vitest run` exit 0 (기존 902건 유지 + 신규 테스트 통과)
- [ ] `it_backend/CLAUDE.md` §5.10~5.13 재발 방지 컨벤션 섹션 추가
- [ ] `it_frontend/CLAUDE.md` 재발 방지 컨벤션 섹션 추가
- [ ] `TASK.md` 완료 섹션에 18건 이동 (날짜·조치 기록)

### 4.2 Quality Criteria

- [ ] 새로운 TypeScript 에러 미발생 (`npx nuxt typecheck` 유지)
- [ ] 보안: 파일 확장자 검증 — 허용 목록 외 업로드 400 Bad Request
- [ ] 보안: 환경변수 미설정 시 구동 즉시 예외 (운영 미설정 사고 예방)
- [ ] 코드 리뷰: code-reviewer 에이전트 통과

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| BudgetWorkService 집계 쿼리 변경 후 예산 금액 오차 | High | Medium | 변경 전 SQL 결과 샘플 스냅샷 캡처 → 변경 후 비교 검증 |
| `updateApprovalLineInDetail` AOP 재구조화 후 결재 흐름 회귀 | High | Low | JUnit 통합 테스트(결재 전체 플로우) 먼저 작성(Red) 후 리팩토링 |
| `Bprojm.update()` UpdateCommand 도입 후 기존 호출부 누락 | Medium | Low | `grep -r "\.update("` 전수 검색 후 일괄 전환 |
| `stores/review.ts` 서버 영속화 전환 후 UI 상태 오류 | Medium | Medium | Vitest mock 테스트 + 수동 QA |
| CAPPLA 인덱스 추가 중 테이블 잠금 (운영 대용량) | High | Low | `CREATE INDEX ONLINE` 옵션 적용 검토 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `application.properties` | Config | `:default` 기본값 제거, 빈값 구동 시 실패 로직 추가 |
| `FileController.java` | Controller | 소유권 검증 또는 `@PreAuthorize` 추가 |
| `GeminiController.java` | Controller | 호출 제한 또는 `@PreAuthorize` 추가 |
| `AuthService.java` | Service | 로그인 실패 카운터 + 잠금 로직 추가 |
| `FileService.java` | Service | 확장자 화이트리스트 검증 추가, IOException 재포장 수정 |
| `SsoController.java` | Controller | catch 블록 `log.error()` 추가 |
| `ApplicationService.java` | Service | `updateApprovalLineInDetail` public 위임 메서드 추출, 실패 시 예외 재발생 |
| `BudgetWorkService.java` | Service | getSummary/getProjectSummary/applyRates 쿼리 최적화 |
| `BudgetWorkRepository(Impl).java` | Repository | 집계 쿼리·IN절·MERGE 쿼리 추가 |
| `Bprojm.java` | Entity/Repository | `update()` 파라미터 → `UpdateCommand` 리팩토링 |
| `it_database/` | DDL | CAPPLA, BITEMM 인덱스 마이그레이션 파일 추가 |
| `components/approval/ApplicationViewerDialog.vue` | Vue Component | 파일 삭제 |
| `utils/common.ts` | Utility | `formatDateTime` 통합 함수 추가 |
| `pages/guide/index.vue`, `pages/info/documents/[id]/index.vue` | Page | 로컬 `formatDateTime` 제거 후 `utils/common.ts` 참조 |
| `stores/review.ts` | Pinia Store | 세션→서버 영속화 전환, `defaultReviewers` 제거 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `FileController` | DELETE | 파일 삭제 API — 인증 사용자 전체 접근 가능 | Breaking (소유권 검증 추가) |
| `AuthService.login()` | EXEC | 로그인 플로우 전체 | Needs verification |
| `ApplicationService.updateApprovalLineInDetail` | WRITE | 결재선 등록/수정 시 호출 | Breaking (트랜잭션 구조 변경) |
| `BudgetWorkService.getSummary()` | READ | 예산현황 화면 | Needs verification (결과 동일성) |
| `Bprojm.update()` | WRITE | 프로젝트 수정 경로 전체 | Breaking (시그니처 변경) |
| `formatDateTime` | READ | `pages/guide/index.vue`, `pages/info/documents/[id]/index.vue` | Breaking (import 경로 변경) |
| `stores/review.ts` state | READ/WRITE | 사전협의 화면 전체 | Breaking (서버 API 전환) |

### 6.3 Verification

- [ ] `FileController` 소유권 검증 — 타인 파일 삭제 시도 403 반환 테스트
- [ ] `AuthService` 6회 실패 시 잠금 → 10분 후 해제 JUnit 테스트
- [ ] `ApplicationService` 결재 전체 플로우 JUnit 통합 테스트
- [ ] `BudgetWorkService` 변경 전/후 집계 결과 동일성 검증
- [ ] 프론트 `formatDateTime` 교체 후 날짜 표시 Vitest 테스트

---

## 7. Architecture Considerations

### 7.1 Project Level

Enterprise (기존 레이어드 아키텍처 유지)

### 7.2 Key Architectural Decisions

| Decision | Selected | Rationale |
|----------|----------|-----------|
| Brute-force 저장소 | DB (CLOGNH 테이블 또는 USER 테이블 fail_count 컬럼) | Redis 미설치 환경, 인프라 추가 없이 구현 |
| ApplicationService AOP 수정 | public 위임 메서드 추출 (위임 패턴) | private @Transactional Spring AOP 무효 → public 분리 |
| BudgetWork 쿼리 최적화 | Oracle MERGE INTO + IN절 (QueryDSL/Native 혼용) | 기존 Oracle 환경 활용, 쿼리 실행 횟수 최소화 |
| formatDateTime 통합 | `utils/common.ts` 단일 유틸 함수 | DRY 원칙, 출력 형식 일관성 |
| 파일 확장자 검증 | `FileService` 내 화이트리스트 상수 + 검증 메서드 | 진입점 단일화, 테스트 용이성 |
| 결재선 실패 처리 | 예외 재발생 + 트랜잭션 롤백 | 사용자 지정: "예외 재발생, 롤백 보장" |
| Bearer 헤더 폴백 | 운영에서도 유지 + CLAUDE.md 명시 | 사용자 지정: Swagger/Postman 편의 유지 |

### 7.3 TDD 워크플로우 (각 항목 적용)

```
1. RED   : 테스트 파일 먼저 작성 → 실패 확인
2. GREEN : 최소 구현으로 테스트 통과
3. REFACTOR: 코드 품질 개선 (가독성, 중복 제거)
4. VERIFY : ./gradlew test 또는 npx vitest run 전체 통과 확인
```

**백엔드 TDD 예시 (SEC-03 Brute-force)**:
```java
// RED: 먼저 작성
@Test
void 로그인_연속_5회_실패시_계정잠금() {
    for (int i = 0; i < 5; i++) {
        assertThrows(BadCredentialsException.class,
            () -> authService.login("testUser", "wrongPw"));
    }
    assertThrows(LockedException.class,
        () -> authService.login("testUser", "correctPw"));
}

// GREEN: AuthService.login()에 fail_count 로직 추가 후 통과
```

**프론트 TDD 예시 (FE-02 formatDateTime 통합)**:
```typescript
// RED: 먼저 작성
describe('formatDateTime', () => {
  it('8자리 날짜 문자열을 YYYY-MM-DD 형식으로 변환', () => {
    expect(formatDateTime('20260509')).toBe('2026-05-09')
  })
  it('빈 문자열 입력 시 빈 문자열 반환', () => {
    expect(formatDateTime('')).toBe('')
  })
})

// GREEN: utils/common.ts에 함수 구현 후 통과
```

---

## 8. Convention Prerequisites

### 8.1 재발 방지 컨벤션 — 백엔드 (it_backend/CLAUDE.md §5.10~5.13 추가)

**§5.10 비밀값 관리**
- `application.properties`의 `${VAR:default}` 형태 **절대 금지**. `:default` 없이 `${VAR}` 형태만 허용.
- 필수 환경변수는 구동 시 빈값 검사 후 `IllegalStateException` 발생.

**§5.11 @Transactional + Spring AOP 규칙**
- `private` 메서드에 `@Transactional` 적용 **금지** — Spring AOP 프록시가 인터셉트하지 않음.
- 자기 호출(`this.method()`) 형태는 `@Transactional` 무효 — public 위임 메서드 분리 필수.

**§5.12 에러 처리 규칙**
- catch 블록에서 `log.error()` 생략 시 **FIXME 주석 필수**. 빈 catch 블록 작성 금지.
- 예외 재포장 시 반드시 cause 전달: `new CustomException(msg, originalException)`.

**§5.13 파일 업로드 보안**
- 파일 업로드 진입점에 반드시 확장자 화이트리스트 검증 적용.
- 허용 확장자 목록은 `FileService.ALLOWED_EXTENSIONS` 상수로 중앙 관리.

### 8.2 재발 방지 컨벤션 — 프론트엔드 (it_frontend/CLAUDE.md 추가)

**유틸 함수 중복 방지**
- `utils/common.ts`에 이미 구현된 함수(`formatDateTime` 등)를 먼저 확인 후 재사용. 페이지·컴포넌트 내 로컬 재정의 금지.

**빈 컴포넌트 파일 금지**
- 실질적 내용 없는 Vue SFC(빈 쉘)는 커밋 금지. 이전한 파일은 삭제 후 `npx nuxt typecheck`로 auto-import 충돌 확인.

**Pinia Store 서버 동기화 원칙**
- 비즈니스 데이터(코멘트, 검토자 등)를 로컬 Mock으로 초기화하는 경우 TASK.md에 등록 후 추적.

---

## 9. Implementation Order

```
Sprint 1 — 보안 (Phase 1): SEC-01 → SEC-04 → SEC-02 → SEC-03
  Step 1: SEC-01 — 환경변수 미설정 강제 실패 (TDD: 구동 시 예외 검증)
  Step 2: SEC-04 — 파일 확장자 화이트리스트 (TDD: 악성 확장자 거부 테스트)
  Step 3: SEC-02 — FileController/GeminiController @PreAuthorize (TDD: 403 테스트)
  Step 4: SEC-03 — Brute-force 보호 DB 기반 (TDD: 5회 실패 잠금 테스트)

Sprint 2 — 에러 처리 (Phase 2): ERR-01 → ERR-02 → ERR-03 → ERR-04
  Step 5: ERR-01 — SsoController log.error() (단순 추가)
  Step 6: ERR-02 — FileService IOException cause 전달
  Step 7: ERR-03 — ApplicationService AOP 수정 (TDD: 결재 플로우 통합 테스트 선작성)
  Step 8: ERR-04 — 결재선 실패 예외 재발생 (TDD: 롤백 검증)

Sprint 3 — DB/JPA (Phase 3): DB-04/05 → DB-01 → DB-02 → DB-03 → DB-06
  Step 9 : DB-04, DB-05 — 인덱스 DDL 추가 (EXPLAIN PLAN 검증)
  Step 10: DB-01 — getSummary N+1 제거 (TDD: 쿼리 카운트 + 결과 동일성)
  Step 11: DB-02 — getProjectSummary IN절 (TDD: 결과 동일성)
  Step 12: DB-03 — applyRates MERGE INTO (TDD: 결과 동일성)
  Step 13: DB-06 — Bprojm UpdateCommand 도입 (TDD: 프로젝트 수정 테스트)

Sprint 4 — 프론트 (Phase 4): FE-01 → FE-02
  Step 14: FE-01 — ApplicationViewerDialog.vue 빈 쉘 삭제 (typecheck 확인)
  Step 15: FE-02 — formatDateTime 통합 (TDD: Vitest 단위 테스트 선작성)

Sprint 5 — 사전협의 (Phase 5): REV-02 → REV-01
  Step 16: REV-02 — 검토자 목록 API 엔드포인트 추가 (TDD: API 테스트)
  Step 17: REV-01 — 세션/코멘트 서버 영속화 (TDD: Store 동작 Vitest 테스트)

Sprint 6 — 문서 현행화 (Phase 6)
  Step 18: TASK.md 완료 섹션 이동 (18건 전량)
  Step 19: it_backend/CLAUDE.md §5.10~5.13 추가
  Step 20: it_frontend/CLAUDE.md 컨벤션 섹션 추가
```

---

## 10. TASK.md 현행화 계획

### 10.1 이행 중 업데이트 방법

각 항목 구현 완료 시:
1. TASK.md 해당 행의 `[Open]` → `[Done]`으로 변경
2. `## 완료` 섹션에 행 이동
3. 날짜(YYYY-MM-DD), 영역, 조치 내용 기록

예시:
```markdown
| [Done] | 2026-05-10 | 보안 | SEC-01: application.properties 비밀값 :default 제거 + 구동 시 강제 실패 적용 |
```

### 10.2 전체 완료 후 검토

- 모든 18건 [Done] 전환 확인
- TASK.md `## 진행 중` 섹션에 남은 항목(Medium/Low)만 남아 있는지 검증
- 기준일 업데이트

---

## 11. Next Steps

1. [ ] `/pdca design tech-debt-implementation` — 각 Phase별 상세 설계 (쿼리 스펙, API 스펙 포함)
2. [ ] Sprint 1부터 `/pdca do tech-debt-implementation --scope phase-1` 순서로 이행
3. [ ] 각 Sprint 완료 후 `/pdca analyze tech-debt-implementation` 갭 분석

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-09 | Initial draft — TASK.md Critical+High 18건 이행계획 | K140024 |
