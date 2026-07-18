# SEC-04 Access/Refresh 토큰 용도 구분·검증 강제 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 토큰에 용도(`tokenUse`) 클레임을 부여하고, Access 경로는 Refresh 토큰을 거부하며 갱신 경로는 Refresh 토큰만 허용하도록 강제한다.

**Architecture:** `JwtUtil`이 발급 시 `tokenUse` 클레임(`access`/`refresh`)을 넣고 `getTokenUse(token)`로 이를 노출한다. `JwtAuthenticationFilter`는 서명·만료 검증 후 `tokenUse=refresh`이면 인증하지 않는다(용도 미상 `null`·`access`는 통과 — 롤링 배포 과도기 호환). `AuthService.refreshAccessToken`은 `tokenUse=refresh`만 허용하고, 그 외(Access·용도 미상)는 거부한다(배포 전 Refresh 토큰 보유자는 재로그인 유도).

**Tech Stack:** Java 25, Spring Boot 4.1, JJWT(`io.jsonwebtoken`), Spring Security, JUnit 5, Mockito, AssertJ.

**참조 스펙:** `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md` §3.1

**배포 주의:** Refresh 경로를 엄격 검증하므로, 배포 전에 발급된 Refresh 토큰(`tokenUse` 없음)은 다음 갱신 시 거부되어 재로그인이 유발된다(설계상 의도). Access 경로는 과도기 동안 `tokenUse` 없는 토큰을 허용하므로 진행 중 세션은 즉시 끊기지 않는다.

---

## File Structure

- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtUtil.java`
  - `tokenUse` 상수 3종, 발급 2메서드에 클레임 추가, `getTokenUse(String)` 추가.
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java`
  - `doFilterInternal`에서 Refresh 토큰의 Access 경로 인증 거부.
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
  - `refreshAccessToken` 진입부에 Refresh 전용 용도 가드.
- Modify (test): `JwtUtilTest.java`, `JwtAuthenticationFilterTest.java`, `AuthServiceTest.java`.

---

## Task 1: JwtUtil 용도 클레임·조회 (RED → GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtUtil.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/security/JwtUtilTest.java`

- [ ] **Step 1: 실패 테스트 추가**

`JwtUtilTest.java` 상단 import에 추가:

```java
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
```

클래스 내부(마지막 `@Test` 뒤)에 테스트 3개 추가:

```java
    @Test
    @DisplayName("generateAccessToken - tokenUse 클레임이 access 로 발급된다")
    void generateAccessToken_tokenUse_access() {
        String token = jwtUtil.generateAccessToken("10001", TEST_ATH_IDS, TEST_BBR_C);
        assertThat(jwtUtil.getTokenUse(token)).isEqualTo(JwtUtil.TOKEN_USE_ACCESS);
    }

    @Test
    @DisplayName("generateRefreshToken - tokenUse 클레임이 refresh 로 발급된다")
    void generateRefreshToken_tokenUse_refresh() {
        String token = jwtUtil.generateRefreshToken("10001");
        assertThat(jwtUtil.getTokenUse(token)).isEqualTo(JwtUtil.TOKEN_USE_REFRESH);
    }

    @Test
    @DisplayName("getTokenUse - tokenUse 클레임이 없는 배포 전 토큰은 null 을 반환한다")
    void getTokenUse_클레임없음_null반환() {
        // 배포 전(과도기) 토큰: 동일 시크릿으로 서명하되 tokenUse 클레임 없음
        SecretKey key = Keys.hmacShaKeyFor(TEST_SECRET.getBytes(StandardCharsets.UTF_8));
        String legacy = Jwts.builder()
                .subject("10001")
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ACCESS_VALIDITY_MS))
                .signWith(key)
                .compact();
        assertThat(jwtUtil.getTokenUse(legacy)).isNull();
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.JwtUtilTest"`
Expected: 컴파일 실패 — `JwtUtil.TOKEN_USE_ACCESS`/`TOKEN_USE_REFRESH` 상수와 `getTokenUse` 메서드가 아직 없음.

- [ ] **Step 3: JwtUtil에 상수·클레임·조회 추가**

`JwtUtil` 클래스 본문 상단(필드 `secretKey` 선언 위, 약 51행)에 상수 추가:

```java
    /** 토큰 용도 클레임 키 */
    public static final String TOKEN_USE_CLAIM = "tokenUse";
    /** 토큰 용도 값 — Access Token */
    public static final String TOKEN_USE_ACCESS = "access";
    /** 토큰 용도 값 — Refresh Token */
    public static final String TOKEN_USE_REFRESH = "refresh";
```

`generateAccessToken`의 빌더(약 118~125행)에서 `.claim("bbrC", bbrC)` 다음 줄에 추가:

```java
                .claim(TOKEN_USE_CLAIM, TOKEN_USE_ACCESS) // 용도: Access
```

`generateRefreshToken`의 빌더(약 154~160행)에서 `.id(UUID.randomUUID().toString())` 다음 줄에 추가:

```java
                .claim(TOKEN_USE_CLAIM, TOKEN_USE_REFRESH) // 용도: Refresh
```

`getBbrCFromToken` 메서드(약 196~198행) 아래에 조회 메서드 추가:

```java
    /**
     * JWT 토큰에서 용도(tokenUse) 클레임 추출.
     *
     * <p>서명·만료 검증을 통과한 토큰에만 사용해야 한다({@link #validateToken(String)} 이후).
     * 배포 전 발급된 토큰은 클레임이 없어 {@code null}을 반환한다.</p>
     *
     * @param token JWT 토큰 문자열
     * @return 용도 값({@code access}/{@code refresh}), 클레임 없으면 {@code null}
     */
    public String getTokenUse(String token) {
        return (String) getClaims(token).get(TOKEN_USE_CLAIM);
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.JwtUtilTest"`
Expected: PASS (신규 3개 포함 전부 통과).

- [ ] **Step 5: 커밋**

```bash
cd it_backend
git add src/main/java/com/kdb/it/common/system/security/JwtUtil.java src/test/java/com/kdb/it/common/system/security/JwtUtilTest.java
git commit -m "feat(auth): JWT tokenUse 용도 클레임 발급·조회 추가 (SEC-04)"
```

---

## Task 2: Access 경로에서 Refresh 토큰 거부 (RED → GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/security/JwtAuthenticationFilterTest.java`

- [ ] **Step 1: 실패 테스트 추가**

`JwtAuthenticationFilterTest.java` 클래스 내부(마지막 `@Test` 뒤)에 추가:

```java
    @Test
    @DisplayName("doFilterInternal: Refresh Token을 accessToken 쿠키로 제출하면 인증하지 않고 체인을 통과한다")
    void doFilterInternal_Refresh토큰_Access경로_인증거부() throws Exception {
        // given
        String refreshJwt = "refresh.jwt.value";
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie(CookieUtil.ACCESS_TOKEN_COOKIE, refreshJwt));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain filterChain = mock(FilterChain.class);

        given(jwtUtil.validateToken(refreshJwt)).willReturn(true);
        given(jwtUtil.getTokenUse(refreshJwt)).willReturn(JwtUtil.TOKEN_USE_REFRESH);

        // when
        jwtAuthenticationFilter.doFilterInternal(request, response, filterChain);

        // then: 인증 미설정 + 필터 체인 통과
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(filterChain).doFilter(request, response);
    }
```

> 참고: `MockHttpServletRequest`/`MockHttpServletResponse`/`Cookie`/`CookieUtil`/`mock`/`verify`/`given`/`assertThat`는 이 테스트 파일에 이미 import되어 있다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.JwtAuthenticationFilterTest"`
Expected: FAIL — 현재 필터는 용도를 검사하지 않아 Refresh 토큰으로도 인증이 설정되므로 `getAuthentication()`이 null이 아님.

- [ ] **Step 3: 필터에 용도 검사 추가**

`doFilterInternal`의 인증 블록(약 103~130행)을 아래로 교체한다. 기존 인증 설정 본문은 그대로 두고 Refresh 거부 분기만 감싼다:

```java
            // 토큰이 있고 서명/만료 검증을 통과한 경우에만 인증 설정
            if (StringUtils.hasText(jwt) && jwtUtil.validateToken(jwt)) {
                // SEC-04: Refresh Token이 Access 경로(accessToken 쿠키/Bearer)로 제출되면 인증하지 않는다.
                // 용도 미상(null)·Access 용도는 통과(롤링 배포 과도기 호환).
                if (JwtUtil.TOKEN_USE_REFRESH.equals(jwtUtil.getTokenUse(jwt))) {
                    logger.warn("Refresh Token이 Access 경로로 제출되어 인증을 거부합니다: " + request.getRequestURI());
                } else {
                    // 토큰의 Payload에서 사번, 자격등급 목록, 부서코드 추출
                    String       eno    = jwtUtil.getEnoFromToken(jwt);
                    List<String> athIds = jwtUtil.getAthIdsFromToken(jwt);
                    String       bbrC   = jwtUtil.getBbrCFromToken(jwt);

                    // JWT 클레임으로 CustomUserDetails 생성 (DB 재조회 없음 - 성능 최적화)
                    CustomUserDetails userDetails = new CustomUserDetails(eno, athIds, bbrC);

                    // Spring Security 인증 객체 생성 (credentials=null: 이미 토큰으로 인증됨)
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
                    // 요청 상세 정보(IP, 세션 등)를 인증 객체에 추가
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    // SecurityContextHolder에 인증 정보 설정
                    SecurityContextHolder.getContext().setAuthentication(authentication);

                    logger.debug("JWT 인증 성공: " + eno + " - " + request.getRequestURI());
                }
            } else if (StringUtils.hasText(jwt)) {
                // 토큰은 있지만 검증 실패(만료, 서명 오류 등)
                logger.warn("=== JWT 토큰 검증 실패 ===");
                logger.warn("요청 URI: " + request.getRequestURI());
                // 보안상 토큰 앞 20자만 로그에 출력
                logger.warn("토큰: " + jwt.substring(0, Math.min(20, jwt.length())) + "...");
                logger.warn("=======================");
            }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.JwtAuthenticationFilterTest"`
Expected: PASS. 기존 정상 인증 테스트는 `getTokenUse`가 스텁되지 않아 `null`을 반환(LENIENT) → Refresh 아님으로 판정되어 인증이 설정되므로 계속 통과.

- [ ] **Step 5: 커밋**

```bash
cd it_backend
git add src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java src/test/java/com/kdb/it/common/system/security/JwtAuthenticationFilterTest.java
git commit -m "feat(auth): Access 경로에서 Refresh Token 인증 거부 (SEC-04)"
```

---

## Task 3: 갱신 경로 Refresh 전용 강제 (RED → GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`

- [ ] **Step 1: 신규 실패 테스트 + 기존 테스트 스텁 보강**

먼저 `AuthServiceTest.java`의 `// ── Refresh Token 갱신 테스트 ──` 섹션에 신규 테스트를 추가한다:

```java
        @Test
        @DisplayName("refreshAccessToken - Access 용도 토큰 제출 시 예외 (Refresh 전용만 허용)")
        void refreshAccessToken_Access용도토큰_예외() {
                // given
                String accessToken = "access.token.value";
                given(jwtUtil.validateToken(accessToken)).willReturn(true);
                given(jwtUtil.getTokenUse(accessToken)).willReturn(JwtUtil.TOKEN_USE_ACCESS);

                // when & then: 가드에서 거부, DB 조회·사용자 조회 이전에 예외
                assertThatThrownBy(() -> authService.refreshAccessToken(accessToken))
                                .isInstanceOf(RuntimeException.class)
                                .hasMessageContaining("유효하지 않은 Refresh Token");
                verify(userRepository, never()).findByEno(anyString());
        }
```

다음으로, 새 가드가 기존 정상 흐름 테스트를 깨지 않도록 **`validateToken(...)=true`를 스텁하는 모든 기존 refresh 테스트**에 `getTokenUse` 스텁을 한 줄씩 추가한다. 규칙: 각 테스트의 `given(jwtUtil.validateToken(<tok>)).willReturn(true);` 바로 아래에 다음을 삽입한다.

```java
                given(jwtUtil.getTokenUse(<tok>)).willReturn(JwtUtil.TOKEN_USE_REFRESH);
```

적용 대상 테스트와 `<tok>` 값(총 11개):

| 테스트 메서드 | `<tok>` |
| --- | --- |
| `refreshAccessToken_유효한토큰_새AccessToken반환` | `refreshTokenValue` (`"valid-refresh-token"`) |
| `refreshAccessToken_회전_새RefreshToken발급` | `oldRefresh` (`"old-refresh-token"`) |
| `refreshAccessToken_재사용탐지_패밀리폐기` | `reused` |
| `refreshAccessToken_grace내_패밀리유지` | `recent` |
| `refreshAccessToken_정상회전_구토큰유지` | `oldRefresh` (`"active-token"`) |
| `refreshToken_concurrentRotation_keepsSingleActiveTokenPerFamily` | `oldRefresh` (`"active-token"`) |
| `refreshAccessToken_만료된DB토큰_예외발생및삭제` | `tokenValue` |
| `refreshAccessToken_DB토큰없음_예외발생` | `"missing-refresh"` |
| `refreshAccessToken_사용자없음_예외발생` | `tokenValue` |
| `refreshAccessToken_encryptedLookupValue_queriesAndSavesLookupValue` | `oldRefresh` (`"active-refresh-token"`) |
| `refreshAccessToken_legacyToken_fallbackRawLookupAndBackfillsLookupValue` | `oldRefresh` (`"legacy-refresh-token"`) |

> `refreshAccessToken_유효하지않은토큰_예외발생`은 `validateToken`이 `false`라 가드의 `getTokenUse`에 도달하지 않으므로 스텁을 추가하지 **않는다**(strict Mockito의 불필요 스텁 오류 방지).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"`
Expected: 신규 `refreshAccessToken_Access용도토큰_예외` FAIL — 아직 가드가 없어 `getTokenUse`가 호출되지 않고 로직이 DB 조회로 진행되어 다른 예외/경로가 발생. (`getTokenUse` 미사용으로 strict Mockito `UnnecessaryStubbingException`이 날 수도 있음 — 둘 다 "가드 미구현" 신호로 정상.)

- [ ] **Step 3: AuthService에 Refresh 전용 가드 추가**

`refreshAccessToken`의 서명/만료 검증 블록(약 236~238행) 바로 다음, DB 조회(`findRefreshTokenByValue`, 약 241행) 앞에 추가:

```java
        // SEC-04: Refresh 전용 토큰만 허용. Access Token 또는 용도 미상(배포 전) 토큰은 거부(재로그인 유도).
        if (!JwtUtil.TOKEN_USE_REFRESH.equals(jwtUtil.getTokenUse(refreshTokenValue))) {
            throw new RuntimeException("유효하지 않은 Refresh Token입니다.");
        }
```

> `JwtUtil`은 이미 `AuthService`에 주입되어 있고(`jwtUtil` 필드) import되어 있으므로 추가 import 불필요.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"`
Expected: PASS — 신규 거부 테스트 통과 + Step 1에서 스텁 보강한 기존 refresh 테스트 전부 통과.

- [ ] **Step 5: 커밋**

```bash
cd it_backend
git add src/main/java/com/kdb/it/common/system/service/AuthService.java src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java
git commit -m "feat(auth): 토큰 갱신 경로에 Refresh 전용 용도 검증 강제 (SEC-04)"
```

---

## Task 4: 인증 도메인 전체 회귀

**Files:** (없음 — 검증)

- [ ] **Step 1: 인증 공통 변경 전체 테스트**

CLAUDE.md §9(인증 공통 변경)에 따라 clean 포함 실행:

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL. (파일 락 발생 시 `--no-daemon` 병행)

- [ ] **Step 2: 결과 확인**

전체 스위트 GREEN 확인. 실패 시 실패 테스트명·메시지를 근거로 원인 수정 후 재실행(신규 가드로 인한 미보강 refresh 테스트가 있는지 우선 점검).

---

## Self-Review

- **Spec coverage(§3.1):** `tokenUse` 클레임 발급(Task 1) ✓, `validateToken(token, expectedType)` 취지의 용도 검증을 `getTokenUse` + 호출부 분기로 구현(Task 1·2·3) ✓, Access 경로 Refresh 거부(Task 2) ✓, 갱신 경로 Refresh 전용(Task 3) ✓, 롤링 배포 호환(Access는 `null` 허용, Refresh 엄격 — Task 2·3 주석·헤더) ✓.
- **Placeholder scan:** 없음. 기존 테스트 보강은 대상 테이블 + `<tok>` 값으로 구체화.
- **Type consistency:** 상수 `JwtUtil.TOKEN_USE_CLAIM/ACCESS/REFRESH`와 메서드 `getTokenUse(String):String`가 필터·서비스·세 테스트에서 동일하게 사용. 필터는 `TOKEN_USE_REFRESH.equals(...)`(Refresh만 거부), 서비스는 `!TOKEN_USE_REFRESH.equals(...)`(Refresh만 허용)로 방향이 목적과 일치.
- **후속(과도기 종료 후):** Access 경로도 `tokenUse` 필수로 엄격화하는 후속 커밋을 Phase 2 이후 별도 반영(본 계획 범위 외, 스펙 §3.1-5).
