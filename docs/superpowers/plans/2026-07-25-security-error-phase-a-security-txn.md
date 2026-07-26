# Phase A — 보안 트랜잭션 무결성 (SEC-09 → SEC-08) Implementation Plan

> **검토 반영일:** 2026-07-25
>
> **상태:** Engineering Review 반영 완료, 구현 가능
> **실행 원칙:** SEC-09를 먼저 완료한 뒤 SEC-08을 수행한다. 두 작업은 `AuthService`와 테스트 픽스처를 공유하므로 같은 작업선에서 순차 실행한다.

**Goal:** 로그인 거부 뒤에도 실패 이력과 감사 컬럼이 확정되어 계정 잠금이 실제로 동작하게 하고(SEC-09), Refresh Token 재사용·만료 탐지 뒤 패밀리 폐기가 롤백이나 비관적 락에 유실되지 않게 한다(SEC-08).

**Architecture:**

- SEC-09는 `LoginHistoryWriter(REQUIRES_NEW)`를 만들지 않는다. `AuthService.login()`의 단일 트랜잭션에서 실패 이력을 저장하고 타입 예외 `LoginRejectedException`에만 `noRollbackFor`를 적용한다. 예상한 로그인 거부만 커밋하고 DB·프로그래밍 오류는 롤백한다.
- 비인증 인증 흐름의 감사자는 전역 `SYSTEM` 폴백으로 숨기지 않는다. `AnonymousAuthenticationToken`은 `AuditorAware`에서 제외하고, 인증 서비스가 로그인 이력에는 `SYSTEM`, Refresh Token에는 해당 `eno`를 명시한다.
- SEC-08은 기존 비관적 쓰기 잠금과 2-트랜잭션 경계를 유지한다. 회전 트랜잭션이 타입 마커 예외로 종료되어 락을 해제한 뒤, 오케스트레이터가 `RefreshTokenRevoker(REQUIRES_NEW)`로 패밀리를 삭제·flush한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, Spring Security, Oracle, JUnit 5, Mockito, MockMvc

---

## 확정 결정과 불변식

1. `TPRMPP_CLOGNH`와 `TPRMPP_CRTOKM`의 `FST_ENR_USID`/`LST_CHG_USID`는 운영 DB에서 `NOT NULL`이다.
2. public 로그인·refresh 요청에는 인증된 JWT principal이 없을 수 있다. 통합 테스트가 임의 `SecurityContext`를 심어 이 사실을 가리면 안 된다.
3. 로그인 거부만 커밋 대상이다. 이력 저장 실패, 사용자 조회 장애, 토큰 발급 오류 등 예상하지 않은 예외는 전체 롤백한다.
4. `findByEcyRnwPubTokCone`과 `findByFamNmAndAvlYn`는 `PESSIMISTIC_WRITE`다. 잠금 보유 중 별도 삭제 트랜잭션을 시작하지 않는다.
5. Refresh Token grace 내 동시 요청은 패밀리를 폐기하지 않고 현재 요청만 거부한다. grace 밖 재사용과 만료는 패밀리를 폐기한다.

```text
SEC-09 로그인 실패

public POST /login
  -> AuthService.login() [단일 TX, noRollbackFor=LoginRejectedException]
      -> 잠금 확인
      -> 사용자/비밀번호 검증 실패
      -> Clognh(SYSTEM 감사자) 저장
      -> LoginRejectedException
  -> TX COMMIT
  -> HTTP 400

예상하지 않은 Repository/DB 예외
  -> RuntimeException
  -> TX ROLLBACK
  -> 실패를 로그인 거부로 오인하지 않음
```

```text
SEC-08 Refresh Token

POST /refresh
  -> AuthService.refreshAccessToken() [비트랜잭션 오케스트레이터]
      -> RefreshTokenRotator.rotate() [TX + PESSIMISTIC_WRITE]
          ├─ 활성/정상: 기존 토큰 회전 + 신규 토큰 저장 -> COMMIT
          ├─ grace 내 재제출: ConcurrentRefreshException -> ROLLBACK/락 해제
          └─ 재사용/만료: FamilyRevocationRequiredException -> ROLLBACK/락 해제
      -> 재사용/만료만 RefreshTokenRevoker.revoke() [REQUIRES_NEW + flush]
      -> InvalidRefreshTokenException
  -> AuthController가 인증 쿠키 무효화
```

---

## What already exists

- `LoginAttemptService.checkLocked()`와 최근 실패 횟수 조회가 이미 존재한다. 새 잠금 저장소를 만들지 않고 커밋된 `CLOGNH`를 그대로 사용한다.
- `Clognh.createLoginSuccess/createLoginFailure/createLogout` 팩토리가 존재한다. 감사자 명시 계약만 보강한다.
- `RefreshTokenRepository`의 비관적 쓰기 잠금, 토큰 패밀리·grace 동작, `deleteByEno`가 존재한다.
- `AuthController`의 invalid refresh 쿠키 무효화 경로와 `InvalidRefreshTokenException` 응답 계약을 재사용한다.
- `AuditFailureIsolationIT`의 Oracle 정리·시드 패턴은 재사용하되, 인증 흐름 테스트에는 `SecurityContext` 주입 패턴을 복사하지 않는다.

## NOT in scope

- 전역 `AuditorAware`의 `SYSTEM` 폴백: 배치·스케줄러의 누락까지 숨길 수 있어 제외한다.
- JWT 수명·쿠키 정책·토큰 스키마 변경: 이번 목표는 트랜잭션 무결성이다.
- 사용자별 Refresh Token 다중 패밀리 지원: 현재 1인 1패밀리 정책을 유지한다.
- 로그인 실패 메시지/화면 개편: 기존 HTTP 계약을 유지한다.
- DB DDL/Flyway: 운영 컬럼 계약을 코드와 테스트가 충족하도록 고친다.

---

## File Structure

```text
it_backend/
  src/main/java/com/kdb/it/
    config/JpaAuditConfig.java
    domain/entity/BaseEntity.java
    exception/LoginRejectedException.java                 # 신규
    common/system/entity/Clognh.java
    common/system/entity/Crtokm.java
    common/system/service/AuthService.java
    common/system/service/RefreshTokenRotator.java        # 신규
    common/system/service/RefreshTokenRevoker.java        # 신규
    common/system/service/RefreshRotationResult.java      # 신규 record
    common/system/exception/
      ConcurrentRefreshException.java                     # 신규, package-private 가능
      FamilyRevocationRequiredException.java              # 신규, package-private 가능
  src/test/java/com/kdb/it/
    common/system/service/AuthServiceTest.java
    common/system/service/RefreshTokenRotatorTest.java     # 신규
    common/system/service/RefreshTokenRevokerTest.java     # 신규
    common/system/AuthLoginFailureIsolationIT.java         # 신규 @Tag("it")
    common/system/RefreshTokenIsolationIT.java              # 신규 @Tag("it")
    common/system/controller/AuthControllerTest.java
```

복잡한 상태 전이 ASCII 주석은 `AuthService.refreshAccessToken`과 `RefreshTokenRotator.rotate`에 위 다이어그램의 축약본으로 추가한다. 단순 엔티티 팩토리에는 다이어그램을 넣지 않는다.

---

## Workstream A1 — SEC-09 로그인 실패 이력과 명시적 감사자

### Task 1 — 감사자 계약을 명시적으로 만든다

**Files**

- Modify: `it_backend/src/main/java/com/kdb/it/config/JpaAuditConfig.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/entity/BaseEntity.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/entity/Clognh.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/entity/Crtokm.java`
- Modify/Create matching unit tests

**RED**

- `JpaAuditConfigTest`: `AnonymousAuthenticationToken`이면 `Optional.empty()`를 반환한다.
- `ClognhTest`: 로그인 성공·실패·로그아웃 이력의 최초/최종 변경 사용자가 `SYSTEM`이다.
- `CrtokmTest`: 신규 토큰은 `eno`로 최초/최종 감사자를 채우고, 회전 시 최종 감사자를 `eno`로 갱신한다.
- blank 감사자를 전달하면 즉시 `IllegalArgumentException`으로 실패한다.

**GREEN**

1. `JpaAuditConfig`에서 다음 조건을 모두 비감사 요청으로 취급한다.
   - authentication이 null
   - `!authentication.isAuthenticated()`
   - `authentication instanceof AnonymousAuthenticationToken`
2. `BaseEntity`에 자식 엔티티만 호출할 수 있는 protected final 메서드를 추가한다.
   - 신규 엔티티용 `initializeAuditActors(String actor)`
   - 수정용 `changeAuditActor(String actor)`
   - 입력은 nonblank 검증
3. `Clognh`의 세 팩토리는 builder 또는 위 메서드로 `SYSTEM`을 명시한다.
4. `Crtokm` 생성 경로는 `eno`를 최초/최종 감사자로 명시하고 `markRotated()`는 토큰 소유자 `eno`로 최종 감사자를 갱신한다.
5. public API·service 메서드와 실패 조건을 설명하는 신규 JavaDoc/주석은 한글로 작성한다.

**검증**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*JpaAuditConfigTest" --tests "*ClognhTest" --tests "*CrtokmTest"
```

**커밋**

```powershell
git add src/main/java/com/kdb/it/config/JpaAuditConfig.java `
        src/main/java/com/kdb/it/domain/entity/BaseEntity.java `
        src/main/java/com/kdb/it/common/system/entity/Clognh.java `
        src/main/java/com/kdb/it/common/system/entity/Crtokm.java `
        src/test/java/com/kdb/it/config/JpaAuditConfigTest.java `
        src/test/java/com/kdb/it/common/system/entity/ClognhTest.java `
        src/test/java/com/kdb/it/common/system/entity/CrtokmTest.java
git commit -m "fix: 비인증 인증 흐름의 감사자를 명시적으로 기록 (SEC-09)"
```

### Task 2 — 로그인 거부만 커밋하는 단일 트랜잭션

**Files**

- Create: `it_backend/src/main/java/com/kdb/it/exception/LoginRejectedException.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java` only if the current RuntimeException 400 body cannot be preserved by subtype inheritance alone

**RED**

- 없는 사번과 잘못된 비밀번호가 `LoginRejectedException`을 던지고 실패 이력을 한 번 저장한다.
- 잠긴 계정은 기존 잠금 예외를 유지하고 새 실패 행을 추가하지 않는다.
- `loginHistoryRepository.save()`가 실패하면 원래 DB 예외가 전파된다.
- 토큰 발급·자격 조회 등 성공 경로 후반부의 예상하지 않은 예외는 `LoginRejectedException`으로 바뀌지 않는다.

**GREEN**

1. `LoginRejectedException extends RuntimeException`을 추가한다.
2. `login()`을 다음과 같이 제한한다.

```java
@Transactional(noRollbackFor = LoginRejectedException.class)
public AuthDto.LoginResponse login(...) {
    ...
}
```

3. 사용자 미존재와 비밀번호 불일치에서 실패 이력을 저장한 뒤 `LoginRejectedException`을 던진다.
4. `noRollbackFor = RuntimeException.class`처럼 범위가 넓은 규칙은 금지한다.
5. `LoginHistoryWriter`와 `REQUIRES_NEW` 로그인 실패 경로는 만들지 않는다.
6. 기존 400 상태·응답 메시지를 회귀 테스트로 고정한다.

**검증**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"
```

**커밋**

```powershell
git add src/main/java/com/kdb/it/exception/LoginRejectedException.java `
        src/main/java/com/kdb/it/common/system/service/AuthService.java `
        src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java `
        src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java
git commit -m "fix: 로그인 거부 이력을 단일 트랜잭션에서 커밋 (SEC-09)"
```

`GlobalExceptionHandler.java`가 변경되지 않았다면 해당 경로는 `git add`에서 제외한다.

### Task 3 — public HTTP + Oracle 격리 통합 테스트

**Files**

- Create: `it_backend/src/test/java/com/kdb/it/common/system/AuthLoginFailureIsolationIT.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java`

**필수 시나리오**

1. 테스트가 `SecurityContextHolder`에 인증을 주입하지 않았음을 시작 시 단언한다.
2. 존재하는 테스트 사용자의 잘못된 비밀번호로 public `/api/auth/login`을 5회 호출한다.
3. 매 요청은 기존 로그인 거부 HTTP 계약을 반환하고, Oracle에는 실패 이력 5건이 커밋된다.
4. 5건 모두 `FST_ENR_USID=LST_CHG_USID=SYSTEM`이다.
5. 6번째 호출은 잠금 계약을 반환하고 추가 실패 행을 만들지 않는다.
6. 실패 이력 저장에 예상하지 않은 DB 오류를 주입한 통합 테스트는 전체 롤백과 5xx/원인 전파를 확인한다.
7. 로그인 성공 시 생성되는 Refresh Token은 감사자 두 칼럼이 해당 `eno`다.

테스트 데이터는 고정 사번으로 격리하고 `@AfterEach`에서 해당 로그인 이력·토큰만 명시적으로 삭제한다. 전체 테이블 삭제는 금지한다.

**검증**

```powershell
cd C:\it\it_backend
.\gradlew test -PincludeTags=it --tests "com.kdb.it.common.system.AuthLoginFailureIsolationIT"
.\gradlew test --tests "com.kdb.it.common.system.controller.AuthControllerTest"
```

**커밋**

```powershell
git add src/test/java/com/kdb/it/common/system/AuthLoginFailureIsolationIT.java `
        src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java
git commit -m "test: public 로그인 실패 커밋과 감사자 계약 검증 (SEC-09)"
```

---

## Workstream A2 — SEC-08 Refresh Token 패밀리 폐기

### Task 4 — 회전 트랜잭션과 폐기 트랜잭션을 분리한다

**Files**

- Create: `RefreshTokenRotator.java`
- Create: `RefreshTokenRevoker.java`
- Create: `RefreshRotationResult.java`
- Create: typed marker exceptions
- Create: corresponding unit tests

**RED 계약**

- 활성·정상 토큰: 기존 토큰 `AVL_YN=N`, 새 토큰 저장, access/refresh 결과 반환
- grace 내 회전 토큰 재제출: `ConcurrentRefreshException`, 패밀리 삭제 없음
- grace 밖 회전 토큰 재제출: `FamilyRevocationRequiredException(REUSED)`
- 만료 토큰: `FamilyRevocationRequiredException(EXPIRED)`
- 사용자 미존재·저장 오류: 원인 예외 전파, 보안 마커로 오분류하지 않음
- revoker는 `deleteByEno` 후 `flush()`를 호출

**GREEN 계약**

- `RefreshTokenRotator.rotate()`는 별도 Spring bean의 `@Transactional` 메서드다.
- repository의 기존 `PESSIMISTIC_WRITE`를 유지한다.
- 재사용/만료 마커 예외가 회전 트랜잭션을 롤백하도록 checked 예외로 바꾸거나 `rollbackFor`를 명시한다.
- `RefreshTokenRevoker.revokeByEno()`만 `REQUIRES_NEW`를 사용한다.
- revoker는 회전 트랜잭션이 종료된 뒤에만 호출된다.
- Refresh Token 생성·회전 감사자는 토큰 소유자 `eno`다.

**단위 검증**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*RefreshTokenRotatorTest" --tests "*RefreshTokenRevokerTest"
```

**커밋**

```powershell
git add src/main/java/com/kdb/it/common/system/service/RefreshTokenRotator.java `
        src/main/java/com/kdb/it/common/system/service/RefreshTokenRevoker.java `
        src/main/java/com/kdb/it/common/system/service/RefreshRotationResult.java `
        src/main/java/com/kdb/it/common/system/exception/ConcurrentRefreshException.java `
        src/main/java/com/kdb/it/common/system/exception/FamilyRevocationRequiredException.java `
        src/test/java/com/kdb/it/common/system/service/RefreshTokenRotatorTest.java `
        src/test/java/com/kdb/it/common/system/service/RefreshTokenRevokerTest.java
git commit -m "refactor: Refresh Token 회전과 패밀리 폐기 경계 분리 (SEC-08)"
```

### Task 5 — `AuthService.refreshAccessToken`을 비트랜잭션 오케스트레이터로 전환한다

**Files**

- Modify: `AuthService.java`
- Modify: `AuthServiceTest.java`
- Modify: `AuthControllerTest.java`

**RED**

- 정상 결과는 rotator 결과를 그대로 반환한다.
- grace 예외는 revoker를 호출하지 않고 재시도 가능한 현재 요청 실패로 전파한다.
- 재사용/만료 마커는 revoker를 한 번 호출한 뒤 `InvalidRefreshTokenException`으로 변환한다.
- revoker 실패는 성공처럼 숨기지 않고 원인 예외를 전파한다.
- invalid refresh HTTP 응답은 access/refresh 쿠키를 모두 무효화한다.

**GREEN**

- `refreshAccessToken()`의 `@Transactional`을 제거한다.
- rotator 호출 외부에서만 revoker를 호출한다.
- 문자열 메시지 비교 대신 타입과 reason enum으로 분기한다.
- grace 실패와 보안 폐기를 같은 예외로 합치지 않는다.

**검증 및 커밋**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest" `
               --tests "com.kdb.it.common.system.controller.AuthControllerTest"
git add src/main/java/com/kdb/it/common/system/service/AuthService.java `
        src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java `
        src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java
git commit -m "fix: Refresh Token 패밀리 폐기를 락 해제 뒤 확정 (SEC-08)"
```

### Task 6 — Oracle 동시성·교착 회귀 테스트

**Files**

- Create: `it_backend/src/test/java/com/kdb/it/common/system/RefreshTokenIsolationIT.java`

**필수 시나리오**

1. 재사용 토큰을 제출하면 요청 실패 후에도 해당 `eno` 패밀리가 커밋 삭제된다.
2. 만료 토큰도 동일하게 패밀리가 커밋 삭제된다.
3. 같은 활성 토큰을 두 스레드가 동시에 제출한다.
   - 한 요청만 회전에 성공한다.
   - 다른 요청은 grace 실패한다.
   - 패밀리는 폐기되지 않는다.
   - 활성 토큰은 정확히 한 건이다.
4. 모든 동시성 테스트를 `assertTimeoutPreemptively` 또는 Future timeout으로 감싸 교착을 실패로 검출한다.
5. timeout 발생 시 스레드 dump를 남기고 테스트 executor를 `finally`에서 종료한다.
6. invalid refresh MockMvc 테스트는 쿠키 `Max-Age=0`/만료 계약을 확인한다.

**검증**

```powershell
cd C:\it\it_backend
.\gradlew test -PincludeTags=it --tests "com.kdb.it.common.system.RefreshTokenIsolationIT"
```

**커밋**

```powershell
git add src/test/java/com/kdb/it/common/system/RefreshTokenIsolationIT.java
git commit -m "test: Refresh Token 동시 회전과 패밀리 폐기 교착 회귀 검증 (SEC-08)"
```

---

## Task 7 — 최종 검증과 완료 이관

```powershell
cd C:\it\it_backend
.\gradlew test
.\gradlew test -PincludeTags=it --tests "com.kdb.it.common.system.AuthLoginFailureIsolationIT" `
                                --tests "com.kdb.it.common.system.RefreshTokenIsolationIT"
.\gradlew spotlessCheck
```

**완료 조건**

- [ ] public 로그인 실패 5건이 SecurityContext 조작 없이 커밋되고 6번째 요청이 잠긴다.
- [ ] 로그인 이력 감사자는 `SYSTEM`, Refresh Token 감사자는 `eno`다.
- [ ] 예상하지 않은 예외는 `noRollbackFor` 대상이 아니며 전체 롤백한다.
- [ ] 동시 refresh 테스트가 timeout 안에 종료된다.
- [ ] grace 내 재제출은 패밀리를 유지하고 재사용·만료는 패밀리를 폐기한다.
- [ ] invalid refresh 응답이 인증 쿠키를 무효화한다.
- [ ] 신규 파일을 포함한 모든 커밋이 명시적 `git add`를 사용한다.
- [ ] `TASK.md`의 SEC-09·SEC-08을 실제 구현·검증 근거와 함께 `TASK_DONE.md`로 한 번에 이관한다.

---

## 실패 모드와 관측 계약

| 코드 경로 | 운영 실패 | 테스트 | 처리 | 사용자 결과 |
|---|---|---|---|---|
| public 로그인 실패 | 감사자 null/anonymous로 INSERT 실패 | HTTP+Oracle IT | 명시적 `SYSTEM` | 기존 로그인 거부 |
| 로그인 실패 저장 | DB 장애를 정상 거부로 오인 | unit+IT | 원인 예외 롤백/전파 | 명확한 서버 오류 |
| 로그인 실패 폭주 | `REQUIRES_NEW` 추가 연결 고갈 | 구조로 제거 | 단일 TX | 지연·교착 방지 |
| refresh 동시 요청 | 비관적 락 교착 | 2-thread timeout IT | 회전 TX 종료 뒤 폐기 | 한 요청 성공, 한 요청 재시도 |
| refresh 재사용 | 원 트랜잭션 롤백으로 폐기 유실 | Oracle IT | revoker 별도 커밋 | 401 + 쿠키 제거 |
| revoker DB 실패 | 폐기를 성공으로 오인 | unit | 원인 예외 전파 | 서버 오류, 운영 로그 |

## 실행 순서와 병렬화

| Step | Modules touched | Depends on |
|---|---|---|
| A1-1 감사자 | config/, entity/ | — |
| A1-2 로그인 TX | exception/, service/ | A1-1 |
| A1-3 로그인 IT | test/auth/ | A1-2 |
| A2-1 회전·폐기 | service/, repository/ | A1 완료 |
| A2-2 오케스트레이터 | service/, controller test/ | A2-1 |
| A2-3 동시성 IT | test/auth/ | A2-2 |

**Lane A:** A1-1 → A1-2 → A1-3 → A2-1 → A2-2 → A2-3

`AuthService`와 인증 테스트 픽스처를 공유하므로 Phase A 내부는 순차 구현한다. Phase B/C의 독립 모듈과는 병렬 실행할 수 있다.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | STALE | 이전 리뷰 이후 39 commits, 현재 계획에는 미적용 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | SEC-09 트랜잭션·감사자와 SEC-08 동시성 테스트 보완 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — 구현 가능
