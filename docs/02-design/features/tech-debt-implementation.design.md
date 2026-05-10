---
template: design
version: 1.3
feature: tech-debt-implementation
date: 2026-05-09
author: K140024 (박종훈)
project: IT 정보화 Portal (it_backend / it_frontend)
status: Draft
---

# tech-debt-implementation Design Document

> **Summary**: TASK.md Critical+High 18건 — 클린 아키텍처 방식으로 책임 분리·패턴 도입·TDD 이행
>
> **Project**: IT 정보화 Portal
> **Author**: K140024 (박종훈)
> **Date**: 2026-05-09
> **Status**: Draft
> **Planning Doc**: [tech-debt-implementation.plan.md](../01-plan/features/tech-debt-implementation.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | TASK.md Critical+High 항목이 운영 환경에서 보안 사고 및 장애 유발 가능성 높음 |
| **WHO** | 개발팀(코드 품질·안전성 직접 혜택), 운영팀(보안 사고 예방), 임직원 3,000명(서비스 안정성) |
| **RISK** | BudgetWorkService 쿼리 변경 시 예산 집계 로직 오차; ApplicationService 재구조화 시 결재 흐름 회귀 |
| **SUCCESS** | TASK.md Critical+High 18건 전량 [Done], 각 수정에 TDD 테스트 추가, CLAUDE.md 재발 방지 컨벤션 반영 |
| **SCOPE** | Phase 1: 보안(4) → Phase 2: 에러처리(4) → Phase 3: DB/JPA(6) → Phase 4: 프론트(2) → Phase 5: 사전협의(2) → Phase 6: 문서/컨벤션 |

---

## 1. Overview

### 1.1 Design Goals

1. **책임 분리**: 검증·잠금·쿼리 로직을 전용 클래스/서비스로 분리하여 SRP 준수
2. **실패 안전**: 환경변수 누락·예외 삼킴을 제거하여 운영 사고 조기 감지
3. **테스트 친화성**: 각 클래스가 단독으로 테스트 가능한 구조 설계 (TDD 우선)
4. **점진적 이행**: 기존 API 인터페이스는 유지하며 내부 구현만 교체

### 1.2 Design Principles

- **SRP**: 하나의 클래스는 하나의 변경 이유만 가진다
- **Fail-Fast**: 잘못된 상태(빈 환경변수, 비허용 확장자)는 즉시 예외로 알린다
- **TDD Red→Green→Refactor**: 각 수정 전 실패 테스트를 먼저 커밋한다
- **기존 인터페이스 보존**: 호출부 변경을 최소화하여 회귀 리스크 감소

---

## 2. Architecture Options

### 2.0 Architecture Comparison

| 기준 | Option A: 최소 변경 | Option B: 클린 아키텍처 | Option C: 실용적 균형 |
|------|:-:|:-:|:-:|
| 신규 파일 | ~3 | **~15** | ~7 |
| 수정 파일 | ~15 | ~16 | ~16 |
| 복잡도 | 낮음 | 높음 | 중간 |
| 유지보수성 | 중간 | **높음** | 높음 |
| 테스트 용이성 | 중간 | **높음** | 높음 |
| 회귀 위험 | 낮음 | 중간 | 낮음 |

**Selected: Option B — 클린 아키텍처**
**Rationale**: 각 책임을 전용 클래스로 분리하여 단위 테스트 커버리지 및 장기 유지보수성을 극대화한다.

### 2.1 Component Diagram

```
┌────────────────── 백엔드 신규 컴포넌트 (Option B) ──────────────────┐
│                                                                   │
│  Controller Layer                                                 │
│  ├── FileController       (기존 — FileOwnershipChecker 주입)      │
│  ├── GeminiController     (기존 — @PreAuthorize 추가)             │
│  ├── AuthController       (기존 — LoginAttemptService 주입)       │
│  └── ReviewerController   [신규] 검토자 목록 API                  │
│                                                                   │
│  Service Layer                                                    │
│  ├── AuthService          (기존 — LoginAttemptService 위임)       │
│  ├── FileService          (기존 — FileValidator·Checker 위임)     │
│  ├── ApplicationService   (기존 — ApprovalLineDelegate 추출)      │
│  ├── BudgetWorkService    (기존 — BudgetWorkQueryRepository 위임) │
│  ├── LoginAttemptService  [신규] Brute-force 추적·잠금            │
│  ├── ApprovalLineDelegate [신규] @Transactional public 위임       │
│  └── ReviewerService      [신규] 검토자 목록 조회                 │
│                                                                   │
│  Validator/Helper                                                 │
│  ├── FileValidator        [신규] 확장자 화이트리스트 검증          │
│  ├── FileOwnershipChecker [신규] 파일 소유권 검증                 │
│  └── EnvironmentValidator [신규] 구동 시 필수 환경변수 검사       │
│                                                                   │
│  Repository Layer                                                 │
│  ├── BudgetWorkQueryRepository     [신규 인터페이스]              │
│  ├── BudgetWorkQueryRepositoryImpl [신규 구현 — 최적화 쿼리]      │
│  └── Bprojm.UpdateCommand          [신규 Java record]            │
│                                                                   │
│  Database                                                         │
│  └── it_database/migrations/ — CAPPLA·BITEMM 인덱스 DDL          │
└───────────────────────────────────────────────────────────────────┘

┌────────────────── 프론트엔드 변경 ──────────────────────────────────┐
│  삭제: components/approval/ApplicationViewerDialog.vue (빈 쉘)    │
│  수정: utils/common.ts — formatDateTime 타입 정의 강화            │
│  수정: pages/guide/index.vue — 로컬 formatDateTime 제거           │
│  수정: pages/info/documents/[id]/index.vue — 로컬 제거            │
│  수정: stores/review.ts — 서버 API 기반으로 검토자 조회 전환      │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

**SEC-03 Brute-force 흐름:**
```
AuthController.login()
  → LoginAttemptService.checkLocked(userId)    // 잠금 여부 확인
  → AuthService.authenticate()                 // 실제 인증
  → LoginAttemptService.recordFailure(userId)  // 실패 시 기록
  → LoginAttemptService.recordSuccess(userId)  // 성공 시 카운터 초기화
```

**SEC-04 파일 업로드 흐름:**
```
FileController.upload()
  → FileValidator.validateExtension(filename)  // 화이트리스트 검증
  → FileService.uploadFileInternal()           // 실제 저장
```

**ERR-03/04 결재선 위임 흐름:**
```
ApplicationService.updateApprovalLine()       // public — AOP 적용 유효
  → ApprovalLineDelegate.doUpdate()           // public — @Transactional 실제 처리
    → 실패 시 예외 재발생 → 트랜잭션 롤백
```

**DB-01 N+1 제거 흐름:**
```
BudgetWorkService.getSummary()
  → BudgetWorkQueryRepository.findSummaryAggregated()  // 단일 집계 쿼리
  (기존: 루프 내 findApprovedCostsByPrefix 반복 호출 → 제거)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `LoginAttemptService` | USER 테이블 fail_count/lock_dt 컬럼 또는 CLOGNH | 실패 횟수 영속화 |
| `FileValidator` | 없음 (pure static) | 확장자 화이트리스트 검증 |
| `FileOwnershipChecker` | `FileRepository` | 파일 소유자 조회 |
| `ApprovalLineDelegate` | `ApplicationRepository` | @Transactional public 위임 |
| `EnvironmentValidator` | Spring `Environment` | 필수 환경변수 null/blank 검사 |
| `BudgetWorkQueryRepository` | QueryDSL DSL | 최적화 집계 쿼리 |
| `ReviewerService` | `OrganizationRepository` 계열 | 검토자 목록 조회 |

---

## 3. Data Model

### 3.1 신규 Java 클래스/레코드

#### `Bprojm.UpdateCommand` (Java record — DB-06)
```java
// Bprojm.java 내부 public record
public record UpdateCommand(
    String prjMngNo,
    String prjNm,
    String prjTypC,
    String sttDt,
    String endDt,
    BigDecimal plnAmt,
    // 기존 35+ 파라미터를 레코드로 압축
    String lstChgUsid
) {}
```

#### `LoginAttemptService` — DB 저장 방안
```sql
-- 방안 A: 기존 USER 테이블에 컬럼 추가 (실제 컬럼명은 DDL 확인 후 결정)
ALTER TABLE CUSERP ADD (
    LOGIN_FAIL_CNT  NUMBER(3)  DEFAULT 0,
    LOGIN_LOCK_DT   DATE
);

-- 방안 B: 기존 CLOGNH 이력 테이블 활용
--   최근 10분 내 실패 COUNT 쿼리로 임계값 초과 여부 판단
--   (테이블 구조 확인 후 결정)
```

> **Note**: 실제 테이블 구조는 `/pdca do` 단계에서 `it_database/` DDL 확인 후 방안 결정.

### 3.2 신규 DDL (it_database/migrations/)

파일명 컨벤션: `V{YYYYMMDD}_{순번}__{설명}.sql`

```sql
-- V20260510_001__add_cappla_composite_index.sql
CREATE INDEX IDX_CAPPLA_ORC_COMP
  ON CAPPLA (ORC_TB_CD, ORC_PK_VL, ORC_SNO_VL, APF_REL_SNO);

-- V20260510_002__add_bitemm_prj_mng_no_index.sql
CREATE INDEX IDX_BITEMM_PRJ_MNG_NO
  ON BITEMM (PRJ_MNG_NO);

-- V20260510_003__add_login_fail_columns.sql (방안 A 선택 시)
ALTER TABLE CUSERP ADD (LOGIN_FAIL_CNT NUMBER(3) DEFAULT 0, LOGIN_LOCK_DT DATE);
```

### 3.3 프론트엔드 타입

#### `formatDateTime` 함수 시그니처 (`utils/common.ts`)
```typescript
/** 날짜/시간 문자열을 지정 형식으로 포맷
 * @param dateStr - 8자리(YYYYMMDD), 14자리(YYYYMMDDHHmmss), ISO 형식 허용
 * @param format - 출력 형식 ('date'|'datetime'|'time'), 기본 'date'
 * @returns 포맷된 문자열, 빈값/null/undefined 이면 빈 문자열 반환
 */
export function formatDateTime(
  dateStr: string | null | undefined,
  format?: 'date' | 'datetime' | 'time'
): string
```

---

## 4. API Specification

### 4.1 신규 엔드포인트 목록 (REV-01/02)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/reviews/{prjMngNo}/reviewers` | 프로젝트별 검토자 목록 조회 | Required |
| POST | `/api/reviews/{prjMngNo}/sessions` | 사전협의 세션 생성 | Required |
| GET | `/api/reviews/{prjMngNo}/sessions/{sessionId}` | 세션 상태 조회 | Required |
| PUT | `/api/reviews/{prjMngNo}/sessions/{sessionId}` | 세션 상태 업데이트 | Required |

### 4.2 검토자 목록 API

#### `GET /api/reviews/{prjMngNo}/reviewers`

**Response (200 OK):**
```json
{
  "data": [
    {
      "reviewerId": "EMP001",
      "reviewerName": "홍길동",
      "teamName": "정보기술부",
      "role": "REVIEWER"
    }
  ]
}
```

**Errors:**
- `401 Unauthorized`: 인증 필요
- `404 Not Found`: 프로젝트 없음

### 4.3 기존 API 변경 사항

| 엔드포인트 | 변경 내용 | 신규 에러 |
|-----------|----------|-----------|
| `DELETE /api/files/{fileId}` | 소유권 검증 추가 (SEC-02) | `403` — 타인 파일 |
| `POST /api/files/upload` | 확장자 검증 추가 (SEC-04) | `400` — 비허용 확장자 |
| `POST /api/auth/login` | Brute-force 잠금 (SEC-03) | `423` — 계정 잠금 |

---

## 5. UI/UX Design

신규 화면 없음. 에러 피드백 UI 변경:
- 파일 삭제 403 → PrimeVue `$toast.add({ severity: 'error', ... })`
- 로그인 잠금 423 → 잠금 해제까지 남은 시간 표시 toast
- 파일 업로드 400 → 허용 확장자 목록 안내 toast

---

## 6. Error Handling

### 6.1 신규 에러 코드

| Code | HTTP | Message | 발생 위치 |
|------|------|---------|-----------|
| `FILE_EXTENSION_DENIED` | 400 | 허용되지 않은 파일 형식: {ext} | `FileValidator` |
| `FILE_OWNERSHIP_DENIED` | 403 | 본인이 업로드한 파일만 접근 가능 | `FileOwnershipChecker` |
| `LOGIN_ACCOUNT_LOCKED` | 423 | 계정 잠금. {N}분 후 재시도 | `LoginAttemptService` |
| `ENV_VAR_MISSING` | N/A — 구동 실패 | 필수 환경변수 미설정: {varName} | `EnvironmentValidator` |

### 6.2 예외 재포장 패턴 (ERR-02)

```java
// 기존 (스택트레이스 손실)
catch (IOException e) {
    throw new CustomGeneralException("파일 저장 실패");
}

// 개선 (cause 전달)
catch (IOException e) {
    throw new CustomGeneralException("파일 저장 실패: " + e.getMessage(), e);
}
```

### 6.3 결재선 위임 패턴 (ERR-03/04)

```java
// ApplicationService (기존 — public으로 위임)
@Transactional
public void updateApprovalLine(String id, List<ApprovalLine> lines) {
    approvalLineDelegate.doUpdate(id, lines);
}

// ApprovalLineDelegate (신규 — 실패 시 예외 재발생)
@Transactional
public void doUpdate(String id, List<ApprovalLine> lines) {
    try {
        // 결재선 업데이트 로직
    } catch (Exception e) {
        log.error("결재선 업데이트 실패 — id: {}", id, e);
        throw new CustomGeneralException("결재선 업데이트 실패", e);
    }
}
```

---

## 7. Security Considerations

- [x] SEC-01: `EnvironmentValidator` — 구동 시 `DB_PASSWORD`, `JWT_SECRET` 빈값 즉시 실패
- [x] SEC-02: `FileOwnershipChecker` — upload_user_id vs 현재 사용자 비교
- [x] SEC-03: `LoginAttemptService` — 5회/10분 임계값, DB 기반 영속화
- [x] SEC-04: `FileValidator.ALLOWED_EXTENSIONS` — 불변 Set, 화이트리스트
- [x] `@PreAuthorize("hasRole('ADMIN')")`: `GeminiController` 클래스 레벨 추가
- [x] XSS: 기존 `HtmlSanitizer` 유지, 신규 API 응답은 Jsoup escape 통과

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: Unit | `FileValidator`, `LoginAttemptService`, `EnvironmentValidator`, `formatDateTime` | JUnit 5 / Vitest | Do |
| L2: Integration | `AuthService` 잠금, `ApplicationService` @Transactional, `BudgetWorkService` 쿼리 | JUnit 5 + @DataJpaTest | Do |
| L3: E2E | 파일 업로드 거부, 로그인 잠금, 검토자 API | Playwright | Do |

### 8.2 L1: 단위 테스트 시나리오 (백엔드)

| # | 클래스 | 테스트 설명 | 예상 결과 |
|---|--------|------------|-----------|
| 1 | `FileValidator` | `.jsp` 업로드 시도 | `FileExtensionDeniedException` |
| 2 | `FileValidator` | `.pdf` 업로드 시도 | 통과 (예외 없음) |
| 3 | `FileValidator` | 빈 파일명 | `IllegalArgumentException` |
| 4 | `LoginAttemptService` | 5회 실패 후 6번째 시도 | `AccountLockedException` |
| 5 | `LoginAttemptService` | 4회 실패 후 성공 | 카운터 초기화, 잠금 없음 |
| 6 | `LoginAttemptService` | 잠금 후 10분 경과 시뮬레이션 | 재시도 허용 |
| 7 | `EnvironmentValidator` | `DB_PASSWORD` 빈값 | `IllegalStateException` |
| 8 | `EnvironmentValidator` | 모든 환경변수 설정 | 정상 (예외 없음) |
| 9 | `BudgetWorkService.getSummary` | 쿼리 실행 횟수 카운트 | 루프 무관 SQL 1회 |
| 10 | `ApprovalLineDelegate` | doUpdate 예외 발생 | 트랜잭션 롤백 확인 |

### 8.3 L1: 단위 테스트 시나리오 (프론트엔드)

| # | 함수 | 테스트 설명 | 예상 결과 |
|---|------|------------|-----------|
| 1 | `formatDateTime` | `'20260509'` 입력 | `'2026-05-09'` |
| 2 | `formatDateTime` | `'20260509143000'` + `'datetime'` | `'2026-05-09 14:30:00'` |
| 3 | `formatDateTime` | `null` 입력 | `''` |
| 4 | `formatDateTime` | `undefined` 입력 | `''` |
| 5 | `formatDateTime` | 기존 3개 호출 위치 출력 형식 동일성 | 기존 출력과 동일 |

### 8.4 L2: 통합 테스트 시나리오

| # | 대상 | 시나리오 | 성공 기준 |
|---|------|---------|-----------|
| 1 | `AuthService` | 5회 실패 → 6번째 올바른 PW | 423 Locked |
| 2 | `FileService` | 타인 파일 ID로 DELETE | 403 Forbidden |
| 3 | `BudgetWorkService.getSummary` | 기존 결과 vs 최적화 결과 | 금액 합계 동일 |
| 4 | `ApplicationService` | 결재선 업데이트 중 DB 오류 | 전체 롤백 확인 |

### 8.5 Seed Data Requirements

| Entity | 최소 수 | 필수 필드 |
|--------|:------:|-----------|
| 파일 레코드 (테스트용) | 2 | `uploadUserId`, `filePath`, `origNm` |
| 사용자 계정 | 1 | `userId`, `password`, `failCount=0` |
| 예산 집계 데이터 | 5+ 프로젝트 | `prjMngNo`, `bgrTypC`, `amt` |

---

## 9. Clean Architecture

### 9.1 Layer Structure (백엔드)

| Layer | 책임 | 신규 파일 위치 |
|-------|------|----------------|
| **Controller** | HTTP 진입점 | 기존 파일 수정 |
| **Service** | 비즈니스 로직, 트랜잭션 경계 | `common/iam/service/`, `domain/approval/service/` |
| **Validator/Helper** | 순수 검증 로직 (DB 없음) | `common/util/`, `infra/file/` |
| **Repository** | 최적화 쿼리 | `domain/budget/work/repository/` |
| **Domain** | 엔티티, Command record | 기존 엔티티 내부 중첩 |

### 9.2 신규 파일 목록

**백엔드 신규 파일:**

| 파일 경로 | 역할 | Phase |
|-----------|------|-------|
| `common/system/EnvironmentValidator.java` | 환경변수 검증 | SEC-01 |
| `infra/file/FileValidator.java` | 확장자 화이트리스트 | SEC-04 |
| `infra/file/FileOwnershipChecker.java` | 파일 소유권 확인 | SEC-02 |
| `common/iam/service/LoginAttemptService.java` | Brute-force 추적 | SEC-03 |
| `domain/approval/service/ApprovalLineDelegate.java` | @Transactional 위임 | ERR-03/04 |
| `domain/budget/work/repository/BudgetWorkQueryRepository.java` | 최적화 쿼리 인터페이스 | DB-01~03 |
| `domain/budget/work/repository/BudgetWorkQueryRepositoryImpl.java` | 최적화 쿼리 구현 | DB-01~03 |
| `domain/council/controller/ReviewerController.java` | 검토자 목록 API | REV-02 |
| `domain/council/service/ReviewerService.java` | 검토자 비즈니스 로직 | REV-02 |

**DDL 파일:**

| 파일 경로 | 용도 |
|-----------|------|
| `it_database/migrations/V20260510_001__add_cappla_index.sql` | DB-04 |
| `it_database/migrations/V20260510_002__add_bitemm_index.sql` | DB-05 |
| `it_database/migrations/V20260510_003__add_login_fail_cols.sql` | SEC-03 (방안 A) |

**테스트 파일 (TDD — Do 단계에서 Red 먼저):**

| 파일 경로 | 테스트 대상 |
|-----------|------------|
| `test/.../FileValidatorTest.java` | SEC-04 |
| `test/.../LoginAttemptServiceTest.java` | SEC-03 |
| `test/.../EnvironmentValidatorTest.java` | SEC-01 |
| `test/.../FileOwnershipCheckerTest.java` | SEC-02 |
| `test/.../ApprovalLineDelegateTest.java` | ERR-03/04 |
| `test/.../BudgetWorkQueryTest.java` | DB-01~03 |

**프론트엔드 변경:**

| 파일 경로 | 변경 유형 | Phase |
|-----------|-----------|-------|
| `tests/unit/utils/formatDateTime.test.ts` | 신규 (TDD Red) | FE-02 |
| `tests/unit/stores/review.test.ts` | 신규 (TDD Red) | REV-01 |
| `app/utils/common.ts` | 수정 | FE-02 |
| `app/pages/guide/index.vue` | 수정 | FE-02 |
| `app/pages/info/documents/[id]/index.vue` | 수정 | FE-02 |
| `app/stores/review.ts` | 수정 | REV-01/02 |
| `app/components/approval/ApplicationViewerDialog.vue` | **삭제** | FE-01 |

### 9.3 Dependency Rules

```
Controller → Service → Validator/Helper  (단방향)
Service    → Repository                  (단방향)
Validator  → 없음 (pure logic, no DB)
```

---

## 10. Coding Convention Reference

### 10.1 백엔드 신규 클래스 네이밍

| 클래스 유형 | 패턴 | 예시 |
|------------|------|------|
| Validator | `{Domain}Validator` | `FileValidator` |
| Checker | `{Domain}Checker` | `FileOwnershipChecker` |
| Delegate | `{Context}Delegate` | `ApprovalLineDelegate` |
| Java record | 엔티티 내부 `public record` | `Bprojm.UpdateCommand` |
| 에러 메시지 | 한글 + 원인 정보 | `"파일 확장자 불허: " + ext` |

### 10.2 TDD 커밋 컨벤션

```
test: [SEC-04] FileValidator 확장자 거부 RED 테스트 추가
feat: [SEC-04] FileValidator 확장자 화이트리스트 구현
refactor: [SEC-04] FileService FileValidator 위임 전환
```

### 10.3 재발 방지 패턴 요약 (CLAUDE.md 반영 예정)

| 재발 유형 | 방지 패턴 | 참조 클래스 |
|----------|----------|------------|
| 환경변수 기본값 하드코딩 | `EnvironmentValidator` 강제 실패 | SEC-01 |
| private @Transactional | public 위임 메서드 분리 | `ApprovalLineDelegate` |
| 예외 삼킴 | `log.error(msg, e)` + cause 전달 | ERR-02 패턴 |
| 확장자 무검증 | `FileValidator.validateExtension()` | SEC-04 |
| 유틸 함수 중복 | `utils/common.ts` 먼저 확인 | FE-02 |

---

## 11. Implementation Guide

### 11.1 File Structure

```
it_backend/src/main/java/com/kdb/it/
├── common/
│   ├── system/EnvironmentValidator.java     [신규] SEC-01
│   └── iam/service/LoginAttemptService.java [신규] SEC-03
├── domain/
│   ├── approval/service/
│   │   └── ApprovalLineDelegate.java        [신규] ERR-03/04
│   ├── budget/work/repository/
│   │   ├── BudgetWorkQueryRepository.java   [신규] DB-01~03
│   │   └── BudgetWorkQueryRepositoryImpl.java [신규]
│   └── council/
│       ├── controller/ReviewerController.java [신규] REV-02
│       └── service/ReviewerService.java       [신규] REV-02
└── infra/file/
    ├── FileValidator.java                   [신규] SEC-04
    └── FileOwnershipChecker.java            [신규] SEC-02

it_database/migrations/
├── V20260510_001__add_cappla_index.sql      [신규] DB-04
├── V20260510_002__add_bitemm_index.sql      [신규] DB-05
└── V20260510_003__add_login_fail_cols.sql   [신규] SEC-03

it_frontend/app/
├── utils/common.ts                          [수정] FE-02
├── pages/guide/index.vue                   [수정] FE-02
├── pages/info/documents/[id]/index.vue     [수정] FE-02
├── stores/review.ts                         [수정] REV-01/02
└── components/approval/
    └── ApplicationViewerDialog.vue          [삭제] FE-01
```

### 11.2 Implementation Order

```
Sprint 1 — Phase 1: 보안
  1. test: EnvironmentValidatorTest (RED)
  2. feat: EnvironmentValidator + application.properties :default 제거 (GREEN)
  3. test: FileValidatorTest 확장자 거부 (RED)
  4. feat: FileValidator + FileService 위임 (GREEN)
  5. test: FileOwnershipCheckerTest (RED)
  6. feat: FileOwnershipChecker + FileController 위임 (GREEN)
  7. test: LoginAttemptServiceTest 잠금 플로우 (RED)
  8. feat: LoginAttemptService + AuthService 위임 + DDL (GREEN)

Sprint 2 — Phase 2: 에러 처리
  9.  feat: SsoController catch log.error() 추가
  10. test: FileService IOException 스택트레이스 보존 (RED)
  11. feat: FileService IOException cause 전달 (GREEN)
  12. test: ApprovalLineDelegateTest @Transactional 롤백 (RED)
  13. feat: ApprovalLineDelegate 추출 + ApplicationService 위임 (GREEN)
  14. feat: ApplicationService:207 예외 재발생 처리

Sprint 3 — Phase 3: DB/JPA
  15. DDL: CAPPLA + BITEMM 인덱스 마이그레이션 파일 생성
  16. test: BudgetWorkQueryTest getSummary 결과 동일성 (RED)
  17. feat: BudgetWorkQueryRepository N+1 제거 (GREEN)
  18. test: BudgetWorkQueryTest getProjectSummary IN절 (RED)
  19. feat: IN절 일괄 조회 구현 (GREEN)
  20. test: BudgetWorkQueryTest applyRates MERGE (RED)
  21. feat: Oracle MERGE INTO 구현 (GREEN)
  22. test: Bprojm UpdateCommand 프로젝트 수정 (RED)
  23. feat: Bprojm.UpdateCommand record + 기존 호출부 전환 (GREEN)

Sprint 4 — Phase 4: 프론트엔드
  24. test: formatDateTime.test.ts Vitest (RED)
  25. feat: utils/common.ts formatDateTime 타입 강화 (GREEN)
  26. refactor: guide/index.vue, documents/[id]/index.vue 로컬 제거
  27. del: components/approval/ApplicationViewerDialog.vue 삭제
  28. verify: npx nuxt typecheck 통과 확인

Sprint 5 — Phase 5: 사전협의
  29. feat: ReviewerController + ReviewerService API
  30. test: stores/review.test.ts 서버 전환 (RED)
  31. feat: stores/review.ts defaultReviewers 제거 + API 조회 (GREEN)
  32. feat: 사전협의 세션 서버 영속화 API + Store 전환

Sprint 6 — Phase 6: 문서 현행화
  33. TASK.md 18건 [Done] 전환 및 조치 내용 기록
  34. it_backend/CLAUDE.md §5.10~5.13 추가
  35. it_frontend/CLAUDE.md 컨벤션 섹션 추가
```

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | 설명 | 예상 턴 |
|--------|-----------|------|:------:|
| 보안 검증 클래스 | `phase-1` | FileValidator, FileOwnershipChecker, LoginAttemptService, EnvironmentValidator | 40-50 |
| 에러처리 리팩토링 | `phase-2` | SsoController, FileService, ApprovalLineDelegate | 30-40 |
| DB/JPA 최적화 | `phase-3` | BudgetWorkQueryRepository, DDL, Bprojm.UpdateCommand | 50-60 |
| 프론트엔드 | `phase-4` | formatDateTime 통합, ApplicationViewerDialog 삭제 | 20-25 |
| 사전협의 서버화 | `phase-5` | ReviewerController, ReviewerService, stores/review.ts | 40-50 |
| 문서 현행화 | `phase-6` | TASK.md, CLAUDE.md 업데이트 | 15-20 |

#### Recommended Session Plan

| 세션 | Phase | Scope | 예상 턴 |
|------|-------|-------|:------:|
| Session 1 | Plan + Design | 전체 | 현재 세션 |
| Session 2 | Do | `--scope phase-1` | 40-50 |
| Session 3 | Do | `--scope phase-2` | 30-40 |
| Session 4 | Do | `--scope phase-3` | 50-60 |
| Session 5 | Do | `--scope phase-4,phase-5` | 50-60 |
| Session 6 | Do + Check + Doc | `--scope phase-6` + analyze | 30-40 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-09 | Initial draft — Option B 클린 아키텍처, 18건 설계 | K140024 |
