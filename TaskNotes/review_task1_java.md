# Task 1 — Java/Spring 한글 주석 품질 감사 보고서

## 1. 누락 주석 (Missing Comments)

### 1-1. 컨트롤러

- **`common/code/controller/CodeController.java:19`** — 클래스 JavaDoc 1줄, URL/보안/테이블 미기재
  - 제안: `/** 공통코드(TAAABB_CCODEM) CRUD REST 컨트롤러. 기본 URL: /api/ccodem. 보안: JWT 인증 필요. 복합PK(cId, cdva, sttDt) 기반 CRUD. */`
- **`common/code/controller/CodeController.java:26`** — `private final CodeService codeService` 필드 주석 없음
- **`common/code/controller/CodeController.java:65`** — `createCcodem()` `@param request` 설명 없음
- **`common/code/controller/CodeController.java:81`** — `updateCcodem()` `@return` 누락
- **`domain/council/controller/CouncilController.java:80~끝`** — 클래스 내 모든 엔드포인트 메서드 JavaDoc 없음

### 1-2. 서비스

- **`common/code/service/CodeService.java:19`** — 클래스 JavaDoc에 `@Cacheable`/`@CacheEvict` 전략 미기재
- **`common/code/service/CodeService.java:26`** — `private final CodeRepository` 필드 주석 없음
- **`common/code/service/CodeService.java:67`** — `findCodeEntitiesByCId()` 캐시 동작 미기재
- **`domain/council/service/CouncilService.java:98~116`** — Unicode 이스케이프 한글 리터럴 인라인 주석 불일치

### 1-3. 리포지토리 구현체 (QueryDSL Impl)

- **`common/code/repository/CodeRepositoryImpl.java:24,38,52,61,70`** — 5개 메서드 모두 JavaDoc 없음

## 2. 스테일/부정확 주석

- **`common/code/service/CodeService.java:19`** — 클래스 JavaDoc이 캐시 동작 미언급, 메서드 어노테이션과 불일치
- **`exception/CustomGeneralException.java:9~10`** — "사용 위치" 기재 부정확
- **`domain/council/service/CouncilService.java:98~116`** — Unicode 이스케이프 인라인 주석 일관성 없음

## 3. 아키텍처·트랜잭션·예외 처리 이슈

### HIGH — `@Valid` 누락 (입력 검증 미동작)
- **`common/code/controller/CodeController.java:68`** `createCcodem` — `@Valid` 없음
- **`common/code/controller/CodeController.java:81`** `updateCcodem` — `@Valid` 없음

### HIGH — 리소스 미존재 HTTP 상태 불일치 (400 vs 404)
- **`common/iam/controller/UserController.java:72`** — 사번 미존재 시 400 반환
- **`domain/budget/document/service/GuideDocService.java:65,129,154`** — 문서번호 미존재 시 400 반환

### MEDIUM — JPQL 벌크 DELETE + 1차 캐시 경고 누락
- **`domain/council/service/FeasibilityService.java:224`** — `executeUpdate()` 직후 `persist()` 반복. stale 캐시 위험

### MEDIUM — `@Transactional(readOnly=true)` 클래스 수준 경고
- **`domain/budget/status/service/BudgetStatusService.java:25`** — 쓰기 메서드 추가 시 오버라이드 필요 — 미명시

### MEDIUM — 이벤트 리스너 트랜잭션 의미
- **`domain/council/service/CouncilApprovalEventListener.java:64`** — `@EventListener` vs `@TransactionalEventListener` 차이 미설명

### MEDIUM — PII 로그 경고
- **`domain/council/service/CouncilService.java:94`** — 사번(eno)을 INFO 로그 기록

## 4. 요약

| 범주 | 건수 | 위험도 |
|---|---|---|
| `@Valid` 누락 | 2 | HIGH |
| HTTP 상태 불일치 | 4 | HIGH |
| CouncilController 엔드포인트 JavaDoc 누락 | 전체 | MEDIUM |
| CodeService JavaDoc | 3 | MEDIUM |
| CodeRepositoryImpl 메서드 JavaDoc | 5 | MEDIUM |
| JPQL 벌크 DELETE 캐시 경고 | 1 | MEDIUM |
| readOnly 클래스 오버라이드 경고 | 1 | MEDIUM |
| 이벤트 리스너 트랜잭션 주석 | 1 | MEDIUM |
| PII 로그 경고 | 1 | MEDIUM |
| 스테일/부정확 주석 | 3 | LOW |

**TASK.md 승급 후보:**
1. `@Valid` 일관성 부재 — CodeController createCcodem/updateCcodem
2. NotFoundException 전용 클래스 도입 (UserController, GuideDocService)
3. 사번(eno) PII 로그 정책 정립
