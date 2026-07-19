# SEC-04 Access/Refresh 토큰 용도 구분·검증 강제 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JWT에 용도(`tokenUse`)를 부여하고, Access 인증 경로는 Access 또는 한시적 레거시 토큰만 허용하며 갱신 경로는 Refresh 토큰만 허용한다. 잘못된 갱신 토큰은 HTTP 401과 인증 쿠키 삭제로 재로그인을 유도한다.

**Architecture:** `JwtUtil`이 발급 시 `tokenUse=access|refresh`를 넣고 `validateToken(token, expectedUse, allowLegacy)`에서 서명·만료·용도를 한 계약으로 검증한다. Access 필터의 허용 목록은 `access`와 클레임 없는 레거시 토큰뿐이며 `refresh`, 미지원 문자열, 문자열이 아닌 값은 모두 거부한다. 갱신 서비스는 `refresh`만 허용하고 전용 `InvalidRefreshTokenException`을 던진다. 컨트롤러는 이 예외를 HTTP 401로 변환하면서 Access/Refresh 쿠키를 모두 만료시킨다.

**Tech Stack:** Java 25, Spring Boot 4.1, JJWT, Spring Security, JUnit 5, Mockito, MockMvc, AssertJ.

## Global Constraints

- Access 경로 허용 목록은 `tokenUse=access`와 `tokenUse`가 없는 배포 전 토큰뿐이다.
- Refresh 경로는 `tokenUse=refresh`만 허용한다. 레거시 Refresh 토큰은 재로그인 대상이다.
- `unknown`, 빈 문자열, 숫자·배열 등 미지원 클레임 값은 두 경로 모두 거부한다.
- 잘못된 Refresh 토큰 응답은 400이 아니라 401이며 Access/Refresh 쿠키를 모두 만료시킨다.
- Bearer 헤더 허용 설정이 켜진 경우에도 쿠키와 동일한 용도 검증을 적용한다.
- 토큰 본문이나 전체 토큰 문자열은 로그에 남기지 않는다.
- 신규 JavaDoc과 인라인 주석은 한글로 작성한다.

**참조 스펙:** `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md` §3.1

**배포 주의:** 기존 Access 토큰은 만료 시점까지 허용하지만 기존 Refresh 토큰은 다음 갱신에서 401 처리된다. 배포 공지에 재로그인 가능성을 명시하고, Access 토큰 최대 수명인 15분이 지난 뒤 `allowLegacy=false`로 전환하는 후속 작업을 `TASK.md`에 등록한다.

---

## File Structure

- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtUtil.java`
  - 용도 상수, 발급 클레임, 기대 용도 검증 오버로드 추가.
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java`
  - 쿠키·Bearer Access 인증에 동일한 allowlist 적용.
- Create: `it_backend/src/main/java/com/kdb/it/exception/InvalidRefreshTokenException.java`
  - Refresh 검증 실패 전용 예외.
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
  - Refresh 전용 검증과 전용 예외 사용.
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java`
  - 401 응답과 두 쿠키 삭제.
- Modify: `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java`
  - 컨트롤러 밖으로 전파된 전용 예외도 401로 보장.
- Modify tests: `JwtUtilTest.java`, `JwtAuthenticationFilterTest.java`, `AuthServiceTest.java`, `AuthControllerTest.java`, `GlobalExceptionHandlerTest.java`.
- Modify: `TASK.md`
  - 레거시 Access 허용 제거 후속 작업 등록.

---

## Task 1: JwtUtil 발급·용도 allowlist 검증 (RED → GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtUtil.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/security/JwtUtilTest.java`

**Produces:** `boolean validateToken(String token, String expectedUse, boolean allowLegacy)`

- [ ] **Step 1: 실패 테스트 작성**

실제 테스트용 시크릿으로 다음 토큰을 생성해 표의 결과를 모두 검증한다.

| 클레임 | expectedUse | allowLegacy | 결과 |
| --- | --- | --- | --- |
| `access` | `access` | `true` | true |
| `refresh` | `access` | `true` | false |
| 없음 | `access` | `true` | true |
| 없음 | `access` | `false` | false |
| `refresh` | `refresh` | `false` | true |
| `access` | `refresh` | `false` | false |
| `unknown` | `access` | `true` | false |
| 숫자 `1` | `access` | `true` | false |

발급 메서드도 각각 `getTokenUse(token)`이 `access`, `refresh`를 반환하는지 검증한다. 만료·위조 토큰은 용도가 맞더라도 false여야 한다.

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.JwtUtilTest"`

Expected: 컴파일 실패 — 용도 상수와 검증 오버로드 미존재.

- [ ] **Step 3: 상수와 발급 클레임 추가**

```java
public static final String TOKEN_USE_CLAIM = "tokenUse";
public static final String TOKEN_USE_ACCESS = "access";
public static final String TOKEN_USE_REFRESH = "refresh";
```

`generateAccessToken`에는 `.claim(TOKEN_USE_CLAIM, TOKEN_USE_ACCESS)`, `generateRefreshToken`에는 `.claim(TOKEN_USE_CLAIM, TOKEN_USE_REFRESH)`를 추가한다. 클레임 키는 스펙의 논리명 `typ` 대신 기존 구현 계획과 충돌 없는 애플리케이션 전용 키 `tokenUse`로 고정한다.

- [ ] **Step 4: 조회와 기대 용도 검증 구현**

```java
public String getTokenUse(String token) {
    Object value = getClaims(token).get(TOKEN_USE_CLAIM);
    return value instanceof String tokenUse ? tokenUse : null;
}

public boolean validateToken(String token, String expectedUse, boolean allowLegacy) {
    if (!TOKEN_USE_ACCESS.equals(expectedUse) && !TOKEN_USE_REFRESH.equals(expectedUse)) {
        throw new IllegalArgumentException("지원하지 않는 JWT 기대 용도입니다: " + expectedUse);
    }
    try {
        Claims claims = getClaims(token);
        Object value = claims.get(TOKEN_USE_CLAIM);
        if (value == null) {
            return allowLegacy;
        }
        return value instanceof String tokenUse && expectedUse.equals(tokenUse);
    } catch (JwtException | IllegalArgumentException exception) {
        log.warn("JWT 서명·만료·용도 검증에 실패했습니다: {}", exception.getMessage());
        return false;
    }
}
```

추가 import는 `io.jsonwebtoken.JwtException`이다. `getTokenUse`는 진단·테스트용이며 보안 결정은 반드시 검증 오버로드를 사용한다. 오버로드는 Claims를 한 번만 파싱하며, 숫자 등 비문자 값이 `null` 조회와 혼동되어 허용되지 않도록 원본 `Object`를 직접 검사한다.

- [ ] **Step 5: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.JwtUtilTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/common/system/security/JwtUtil.java src/test/java/com/kdb/it/common/system/security/JwtUtilTest.java
git commit -m "feat(auth): JWT 용도 클레임과 allowlist 검증 추가 (SEC-04)"
```

---

## Task 2: Access 쿠키·Bearer 경로 용도 강제 (RED → GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/security/JwtAuthenticationFilterTest.java`

- [ ] **Step 1: 필터 실패 테스트 작성**

`JwtAuthenticationFilterTest`에 다음 행렬을 추가한다. 각 거부 사례는 인증 객체가 없고 `filterChain.doFilter`가 한 번 호출되어야 한다.

| 입력 경로 | 검증 오버로드 반환 | 기대 |
| --- | --- | --- |
| accessToken 쿠키 | true | 인증 설정 |
| accessToken 쿠키의 Refresh 토큰 | false | 미인증 |
| accessToken 쿠키의 unknown 용도 | false | 미인증 |
| 레거시 Access 토큰 | true | 인증 설정 |
| Bearer Refresh, `allowBearerToken=true` | false | 미인증 |
| Bearer Access, `allowBearerToken=true` | true | 인증 설정 |
| Bearer Access, `allowBearerToken=false` | 호출 없음 | 미인증 |

모든 허용 테스트는 다음 정확한 스텁을 사용한다.

```java
given(jwtUtil.validateToken(jwt, JwtUtil.TOKEN_USE_ACCESS, true)).willReturn(true);
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.JwtAuthenticationFilterTest"`

Expected: 기존 `validateToken(jwt)` 호출 때문에 신규 스텁이 사용되지 않아 실패.

- [ ] **Step 3: 필터 검증 호출 교체**

```java
if (StringUtils.hasText(jwt)
        && jwtUtil.validateToken(jwt, JwtUtil.TOKEN_USE_ACCESS, true)) {
    String eno = jwtUtil.getEnoFromToken(jwt);
    List<String> athIds = jwtUtil.getAthIdsFromToken(jwt);
    String bbrC = jwtUtil.getBbrCFromToken(jwt);
    CustomUserDetails userDetails = new CustomUserDetails(eno, athIds, bbrC);
    UsernamePasswordAuthenticationToken authentication =
            new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities());
    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
    SecurityContextHolder.getContext().setAuthentication(authentication);
} else if (StringUtils.hasText(jwt)) {
    logger.warn("JWT 서명·만료 또는 Access 용도 검증에 실패했습니다: " + request.getRequestURI());
}
```

쿠키와 Bearer는 기존 추출 우선순위를 유지하고, 추출 이후 동일한 검증 오버로드를 한 번만 호출한다. 로그에는 토큰 접두부도 남기지 않는다.

- [ ] **Step 4: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.JwtAuthenticationFilterTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java src/test/java/com/kdb/it/common/system/security/JwtAuthenticationFilterTest.java
git commit -m "feat(auth): Access 경로 JWT 용도 allowlist 강제 (SEC-04)"
```

---

## Task 3: Refresh 전용 예외와 서비스 가드 (RED → GREEN)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/exception/InvalidRefreshTokenException.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`

- [ ] **Step 1: 실패 테스트 작성**

Access·레거시·unknown·서명 오류 토큰은 모두 `InvalidRefreshTokenException`이고, `refreshTokenRepository`와 `userRepository`에는 상호작용이 없어야 한다. 정상 테스트의 첫 스텁은 다음으로 통일한다.

```java
given(jwtUtil.validateToken(token, JwtUtil.TOKEN_USE_REFRESH, false)).willReturn(true);
```

거부 테스트는 같은 호출을 false로 스텁한다. 기존 `validateToken(token)` 및 `getTokenUse(token)` 스텁은 제거해 strict Mockito 불필요 스텁을 방지한다.

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"`

Expected: 전용 예외와 용도 검증 오버로드 미사용으로 실패.

- [ ] **Step 3: 전용 예외와 가드 구현**

```java
package com.kdb.it.exception;

/** Refresh Token 검증·조회·회전 실패를 HTTP 401 계약으로 전달하는 예외. */
public class InvalidRefreshTokenException extends RuntimeException {
    public InvalidRefreshTokenException() {
        super("유효하지 않은 Refresh Token입니다.");
    }
}
```

`AuthService.refreshAccessToken`의 첫 DB 접근 전에 추가한다.

```java
if (!jwtUtil.validateToken(
        refreshTokenValue, JwtUtil.TOKEN_USE_REFRESH, false)) {
    throw new InvalidRefreshTokenException();
}
```

해당 메서드 안의 서명 실패·DB 미존재·만료·재사용 감지 중 클라이언트에 재로그인이 필요한 분기는 모두 `InvalidRefreshTokenException`으로 통일한다. 내부 원인은 토큰 값 없이 서버 로그로만 구분한다.

- [ ] **Step 4: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/exception/InvalidRefreshTokenException.java src/main/java/com/kdb/it/common/system/service/AuthService.java src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java
git commit -m "feat(auth): Refresh 검증 실패 전용 예외 적용 (SEC-04)"
```

---

## Task 4: HTTP 401·쿠키 삭제 계약 (RED → GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/exception/GlobalExceptionHandlerTest.java`

- [ ] **Step 1: MockMvc 실패 테스트 작성**

- Refresh 쿠키 없음 → 401, Access·Refresh 삭제 `Set-Cookie` 2개.
- 서비스가 `InvalidRefreshTokenException` 발생 → 401, 삭제 쿠키 2개, 응답 본문 `다시 로그인해 주세요.`.
- 정상 갱신 → 기존 200, 새 Access 쿠키, 회전 시 새 Refresh 쿠키.
- 다른 컨트롤러에서 전용 예외가 advice까지 전파된 경우 → 401.

삭제 쿠키는 이름만 보지 말고 `Max-Age=0`, `HttpOnly`, 운영 설정에 맞는 `Path`를 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.controller.AuthControllerTest" --tests "com.kdb.it.exception.GlobalExceptionHandlerTest"`

Expected: 기존 RuntimeException 400 매핑 또는 쿠키 미삭제로 실패.

- [ ] **Step 3: 컨트롤러 401 helper 적용**

```java
private ResponseEntity<String> unauthorizedRefreshResponse() {
    ResponseCookie deleteAccess = cookieUtil.deleteAccessTokenCookie();
    ResponseCookie deleteRefresh = cookieUtil.deleteRefreshTokenCookie();
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .header(HttpHeaders.SET_COOKIE, deleteAccess.toString())
            .header(HttpHeaders.SET_COOKIE, deleteRefresh.toString())
            .body("다시 로그인해 주세요.");
}
```

`refresh`에서 쿠키가 없으면 helper를 반환하고, 서비스 호출만 다음처럼 감싼다.

```java
final AuthDto.RefreshResponse response;
try {
    response = authService.refreshAccessToken(refreshToken);
} catch (InvalidRefreshTokenException exception) {
    return unauthorizedRefreshResponse();
}
```

- [ ] **Step 4: advice fallback을 401로 구현**

```java
@ExceptionHandler(InvalidRefreshTokenException.class)
public ResponseEntity<String> handleInvalidRefreshToken(
        InvalidRefreshTokenException exception) {
    return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body("다시 로그인해 주세요.");
}
```

이 handler는 쿠키를 직접 다룰 수 없는 비-인증 컨트롤러의 방어선이다. `/api/auth/refresh`는 반드시 컨트롤러 helper를 거쳐 쿠키까지 삭제한다.

- [ ] **Step 5: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.controller.AuthControllerTest" --tests "com.kdb.it.exception.GlobalExceptionHandlerTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/common/system/controller/AuthController.java src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java src/test/java/com/kdb/it/exception/GlobalExceptionHandlerTest.java
git commit -m "fix(auth): 잘못된 Refresh 토큰을 401과 쿠키 삭제로 처리 (SEC-04)"
```

---

## Task 5: 레거시 종료 추적과 전체 회귀

**Files:**
- Modify: `TASK.md`

- [ ] **Step 1: 후속 작업 등록**

`TASK.md` 보안 섹션에 다음 완료 조건을 포함한다.

```text
- [ ] SEC-04 후속: 배포 후 Access Token 최대 수명(15분) 경과 확인 뒤
  JwtAuthenticationFilter의 allowLegacy를 false로 변경하고,
  tokenUse 없는 Access 토큰이 거부되는 테스트를 기본 계약으로 전환한다.
```

- [ ] **Step 2: 인증 회귀 실행**

Run: `cd it_backend && ./gradlew clean test`

Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 커밋**

```bash
cd C:/it
git add TASK.md
git commit -m "docs(security): JWT 레거시 허용 종료 조건 등록 (SEC-04)"
```

---

## NOT in scope

- JWT 서명 키 교체·키 ID(`kid`) 도입: 용도 혼동과 별개의 키 관리 과제다.
- Refresh Token 저장 구조·회전 알고리즘 변경: 기존 패밀리·재사용 탐지 로직을 보존한다.
- 프론트엔드 토큰 저장: 현재 httpOnly 쿠키 정책을 유지하며 프론트가 JWT를 읽지 않는다.

## What already exists

- `JwtUtil`의 서명·만료 검증과 Access/Refresh 발급 메서드는 재사용한다.
- `JwtAuthenticationFilter`의 쿠키 우선 및 선택적 Bearer 추출 정책은 유지한다.
- `AuthService`의 Refresh DB 조회·만료·회전·재사용 방어 흐름은 용도 가드 이후 그대로 사용한다.
- `CookieUtil`의 생성·삭제 메서드를 재사용하며 쿠키 속성을 중복 구현하지 않는다.

## Self-Review

- **Allowlist:** Access는 `access|legacy-null`, Refresh는 `refresh`만 허용하며 unknown·비문자 값 테스트가 있다.
- **HTTP contract:** 잘못된 갱신 토큰은 전용 예외, 401, 두 쿠키 삭제로 일관된다.
- **Transport parity:** 쿠키와 선택적 Bearer가 동일한 검증 오버로드를 사용한다.
- **Migration:** 기존 Access 세션의 15분 호환과 Refresh 재로그인 영향을 명시했고 종료 작업을 추적한다.
- **Regression:** 유틸·필터·서비스·컨트롤러·advice와 전체 인증 테스트를 순서대로 실행한다.
