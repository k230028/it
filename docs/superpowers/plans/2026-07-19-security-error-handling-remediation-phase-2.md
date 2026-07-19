# 보안·에러 처리 잔여과제 Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SEC-06·SEC-07·SEC-03·ERR-05·ERR-07을 구현해 Refresh Token 평문 저장과 운영 인증 우회를 제거하고, 알림 재시도 및 프론트 실패 상태를 사용자에게 노출한다.

**Architecture:** 인증 영역은 Refresh Token SHA-256 조회값만 DB에 저장하고 로그아웃 시 Refresh 쿠키를 기준으로 패밀리를 폐기한다. 운영 환경은 위험 토글을 기동 단계에서 거부하고 SSO 성공 경계에서 세션 ID를 교체한다. EAI GWE 인터페이스 ID는 전용 설정 빈으로 단일화한다. 알림은 `CINFMM`을 상태 기반 outbox로 사용하되 enqueue 트랜잭션과 dispatch 트랜잭션을 분리해 커밋된 `PENDING` 행만 재시도한다. 프론트는 정상 빈 상태와 실패를 분리하고 기존 인라인 경고·재시도 패턴을 재사용한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Security, Spring Data JPA, Oracle, Flyway, Micrometer, Nuxt 4, Vue 3, TypeScript, Pinia, PrimeVue, Vitest, Playwright.

**참조 스펙:** `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md` §4

## Global Constraints

- 선행 조건: `docs/superpowers/plans/2026-07-19-sec-04-token-purpose-claim.md`가 먼저 구현되어 Refresh 경로가 `tokenUse=refresh`를 검증해야 한다.
- 모든 신규 JavaDoc/TSDoc/인라인 주석은 한글로 작성하고, public API·service 메서드는 입력값과 실패 조건을 기록한다.
- JWT는 httpOnly 쿠키로만 전달하며 토큰·휴대폰·OTP·개인정보를 로그에 남기지 않는다.
- 알림·감사 실패는 원 업무를 롤백하지 않는다. `CINFMM` enqueue 실패는 자동 복구할 영속 행이 없으므로 `notification.persist.failure` 메트릭과 error 로그로 탐지한다.
- 외부 발송은 at-least-once이다. EAI 성공 후 상태 커밋 전 장애가 나면 중복 발송될 수 있으므로 수신 시스템의 중복 허용을 전제로 하고 `infmMsgNo`를 운영 상관 ID로 사용한다.
- 알림 상태 코드는 `01=PENDING`, `02=SENT`, `03=FAILED`; 재시도는 60초 주기, 배치 50건, 최대 5회로 고정한다.
- 마이그레이션 파일은 `V20260719_NNN__CamelCase.sql` 형식이고 재실행 안전성을 유지한다. dev/prod 적용은 DBA 검토 후 수동으로 수행한다.
- DB 접두어를 애플리케이션 코드에 쓰지 않는다. 마이그레이션도 `CURRENT_SCHEMA=ITPOWN`을 전제로 한다.
- 프론트 store는 toast를 호출하지 않고 오류 상태 또는 warnings를 호출자에게 반환한다.
- 변경 후 백엔드는 `./gradlew clean test`, 프론트는 `npm run format:check`, `npm run check`, `npm test`를 통과해야 한다.

---

## File Structure

### Backend / Database

- Modify: `it_backend/src/main/java/com/kdb/it/common/system/entity/Crtokm.java` — 원문 토큰 매핑 제거, SHA-256 조회값만 유지.
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/repository/RefreshTokenRepository.java` — 원문 조회/삭제 제거.
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java` — 해시 전용 저장·조회와 쿠키 기반 로그아웃 패밀리 폐기.
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java` — 만료 Access Token 없이도 Refresh 쿠키로 로그아웃.
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java` — 운영 위험 토글 3종 fail-fast.
- Modify: `it_backend/src/main/java/com/kdb/it/common/sso/SsoController.java` — SSO 성공 시 `changeSessionId()`.
- Create: `it_backend/src/main/java/com/kdb/it/infra/eai/config/GweProperties.java` — `eai.gwe.if-id` 단일 설정 계약.
- Modify: `it_backend/src/main/java/com/kdb/it/infra/eai/config/EaiInfraConfig.java` — `GweProperties` 등록.
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouter.java` — 알림 GWE IF_ID 주입.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java` — 견적 GWE IF_ID 주입.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/service/DeliberationService.java` — 심의 GWE IF_ID 주입.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/service/ContractService.java` — 계약 GWE IF_ID 주입.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/service/PaymentService.java` — 지급 GWE IF_ID 주입.
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/entity/Cinfmm.java` — 발송상태·재시도횟수·오류내용 상태 전이.
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatchResult.java` — 발송 성공/실패 결과.
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationOutboxService.java` — PENDING 행 독립 커밋.
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationDispatchService.java` — 단건 발송·상태 갱신 독립 트랜잭션.
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/config/NotificationSchedulingConfig.java` — Spring scheduling 활성화.
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/scheduler/NotificationRetryScheduler.java` — 재시도 배치 진입점.
- Create: `it_database/migrations/V20260719_001__RemovePlainRefreshToken.sql`.
- Create: `it_database/migrations/V20260719_002__AddNotificationDispatchState.sql`.

### Frontend

- Modify: `it_frontend/app/components/ExcalidrawWrapper.vue`, `it_frontend/app/components/TiptapEditor.vue`, `it_frontend/app/components/MentionAutocomplete.vue` — 손상·카탈로그·멘션 검색 실패 UI.
- Modify: `it_frontend/app/composables/useCostListPage.ts`, `it_frontend/app/composables/useMentionAutocomplete.ts`, `it_frontend/app/composables/useProjectCurrencies.ts` — 빈 상태와 조회 실패 분리.
- Modify: `it_frontend/app/middleware/budget-period.ts`, `it_frontend/app/pages/project/bizplan/[abusMngNo].vue`, `it_frontend/app/pages/info/plan/[id].vue`, `it_frontend/app/stores/review.ts` — 실패 사유·재시도 노출.
- Create: `it_frontend/tests/unit/components/editor-error-state.test.ts`, `it_frontend/tests/unit/components/MentionAutocomplete.test.ts`, `it_frontend/tests/unit/pages/plan-output-error-state.test.ts`, `it_frontend/tests/e2e/security-error-remediation-phase2.spec.ts`.

---

### Task 1: SEC-06 Refresh Token 원문 제거 및 해시 전용 저장·조회 전환

**Files:**
- Create: `it_database/migrations/V20260719_001__RemovePlainRefreshToken.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/entity/Crtokm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/repository/RefreshTokenRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`

**Interfaces:**
- Consumes: `AuthService.sha256HexForToken(String): String`.
- Produces: `Crtokm.ecyRnwPubTokCone`을 유일한 Refresh Token 조회값으로 사용하고, 저장·회전·조회를 모두 SHA-256 HEX 기준으로 통일한다.

> **원자성 주의:** 원문 심볼 제거(엔티티·리포지토리)와 이를 참조하는 `AuthService`(회전 빌더·`issueNewRefreshFamily`·`findRefreshTokenByValue`) 수정은 **반드시 같은 커밋에서 함께** 수행한다. 분리하면 중간 상태의 `main`이 `.tokCone(...)`/`findByTokCone`/`fillEncryptedRenewalTokenIfMissing` 참조로 컴파일되지 않아 `./gradlew test` 게이트를 통과할 수 없다. 원문 제거의 실제 강제 수단은 단위 assertion이 아니라 심볼 제거(컴파일)와 마이그레이션(컬럼 NULL화)이다.

- [ ] **Step 1: 해시 전용 저장·조회 계약 테스트 정리**

`AuthServiceTest`에서 `tokCone` 원문 필드나 `findByTokCone` 폴백을 전제한 스텁·검증을 제거하고, 저장·조회를 해시로만 통일한 다음 두 계약을 남긴다.

```java
@Test
@DisplayName("로그인 - Refresh Token 원문 없이 SHA-256 조회값만 저장한다")
void login_refreshToken_해시만저장() {
    given(userRepository.findByEno("10001")).willReturn(Optional.of(user));
    given(passwordEncoder.matches("password", "encodedPwd")).willReturn(true);
    given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N"))
            .willReturn(Collections.emptyList());
    given(jwtUtil.generateAccessToken(anyString(), anyList(), any())).willReturn("access-token");
    given(jwtUtil.generateRefreshToken("10001")).willReturn("refresh-token");

    authService.login("10001", "password", "127.0.0.1", "Agent");

    ArgumentCaptor<Crtokm> captor = ArgumentCaptor.forClass(Crtokm.class);
    verify(refreshTokenRepository).save(captor.capture());
    assertThat(captor.getValue().getEcyRnwPubTokCone())
            .isEqualTo(AuthService.sha256HexForToken("refresh-token"));
}

@Test
@DisplayName("refreshAccessToken - 해시 조회값으로 토큰을 찾고 회전 행에도 해시만 저장한다")
void refresh_해시조회_해시저장() {
    given(jwtUtil.validateToken("refresh-token")).willReturn(true);
    Crtokm stored = Crtokm.builder().eno("10001").famNm("FAM-1").avlYn("Y")
            .ecyRnwPubTokCone(AuthService.sha256HexForToken("refresh-token"))
            .endDtm(LocalDateTime.now().plusDays(1)).build();
    given(refreshTokenRepository.findByEcyRnwPubTokCone(AuthService.sha256HexForToken("refresh-token")))
            .willReturn(Optional.of(stored));
    given(userRepository.findByEno("10001")).willReturn(Optional.of(user));
    given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N"))
            .willReturn(Collections.emptyList());
    given(jwtUtil.generateAccessToken(anyString(), anyList(), any())).willReturn("access-token");
    given(jwtUtil.generateRefreshToken("10001")).willReturn("new-refresh-token");

    authService.refreshAccessToken("refresh-token");

    ArgumentCaptor<Crtokm> captor = ArgumentCaptor.forClass(Crtokm.class);
    verify(refreshTokenRepository, atLeastOnce()).save(captor.capture());
    assertThat(captor.getAllValues()).anySatisfy(saved ->
            assertThat(saved.getEcyRnwPubTokCone())
                    .isEqualTo(AuthService.sha256HexForToken("new-refresh-token")));
}
```

- [ ] **Step 2: 베이스라인 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"`

Expected: 현행은 원문과 해시를 병행 저장하므로 위 두 계약은 통과한다(GREEN). 본 태스크는 원문 계약을 걷어내는 삭제 리팩터이며, RED는 Step 4에서 원문 심볼을 제거하는 순간 이를 참조하던 `AuthService`가 컴파일 오류로 드러나는 형태로 발생한다. 원문 부재 자체는 Step 3 마이그레이션과 Step 5 통합 회귀(`./gradlew clean test`)로 담보한다.

- [ ] **Step 3: 멱등 마이그레이션 작성**

```sql
DECLARE
    v_nullable VARCHAR2(1);
BEGIN
    SELECT NULLABLE INTO v_nullable
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'TPRMPP_CRTOKM' AND COLUMN_NAME = 'API_TOK_CONE';
    IF v_nullable = 'N' THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CRTOKM MODIFY (API_TOK_CONE NULL)';
    END IF;
END;
/

UPDATE TPRMPP_CRTOKM
   SET ECY_RNW_PUB_TOK_CONE = LOWER(RAWTOHEX(STANDARD_HASH(API_TOK_CONE, 'SHA256')))
 WHERE ECY_RNW_PUB_TOK_CONE IS NULL
   AND API_TOK_CONE IS NOT NULL;

UPDATE TPRMPP_CRTOKM SET API_TOK_CONE = NULL WHERE API_TOK_CONE IS NOT NULL;

DECLARE
    v_nullable VARCHAR2(1);
BEGIN
    SELECT NULLABLE INTO v_nullable
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'TPRMPP_CRTOKM' AND COLUMN_NAME = 'ECY_RNW_PUB_TOK_CONE';
    IF v_nullable = 'Y' THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CRTOKM MODIFY (ECY_RNW_PUB_TOK_CONE NOT NULL)';
    END IF;
END;
/
```

- [ ] **Step 4: 원문 계약 제거와 AuthService 해시 전용 전환(동일 변경)**

엔티티·리포지토리·서비스를 한 번에 정리한다(위 원자성 주의 참조).

1. `Crtokm`: `tokCone` 필드와 `fillEncryptedRenewalTokenIfMissing`를 삭제하고 `ecyRnwPubTokCone`을 필수값으로 바꾼다.

```java
@Column(name = "ECY_RNW_PUB_TOK_CONE", nullable = false, length = 900,
        comment = "암호화갱신발행토큰내용")
private String ecyRnwPubTokCone;
```

2. `RefreshTokenRepository`: `findByTokCone`·`deleteByTokCone`를 삭제한다.

3. `AuthService`: `issueNewRefreshFamily`와 회전 토큰 builder에서 `.tokCone(...)`을 제거하고, 조회 헬퍼를 해시 전용으로 단순화한다(기존 `findByTokCone` 폴백·`fillEncryptedRenewalTokenIfMissing` 호출 제거).

```java
private Crtokm findRefreshTokenByValue(String refreshTokenValue) {
    return refreshTokenRepository.findByEcyRnwPubTokCone(sha256HexForToken(refreshTokenValue))
            .orElseThrow(() -> new RuntimeException("Refresh Token을 찾을 수 없습니다."));
}
```

- [ ] **Step 5: 컴파일·테스트 통과 확인 및 커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"`

Expected: `compileJava` 통과 후 PASS. (엔티티·리포지토리·서비스를 함께 정리하지 않으면 여기서 컴파일 실패한다.)

```bash
git add it_database/migrations/V20260719_001__RemovePlainRefreshToken.sql \
  it_backend/src/main/java/com/kdb/it/common/system/entity/Crtokm.java \
  it_backend/src/main/java/com/kdb/it/common/system/repository/RefreshTokenRepository.java \
  it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java \
  it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java
git commit -m "fix(auth): Refresh Token 원문 제거·해시 전용 저장/조회 전환 (SEC-06)"
```

---

### Task 2: SEC-06 쿠키 기반 로그아웃 패밀리 폐기

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java`

**Interfaces:**
- Produces: `AuthService.logoutByRefreshToken(String token, String authenticatedEno, String ip, String userAgent): void`.
- Failure: 쿠키 토큰이 DB에 없어도 브라우저 쿠키 삭제는 성공하고, 인증 사용자가 있으면 해당 사용자 패밀리를 폐기한다.

- [ ] **Step 1: 만료 Access Token 상태 로그아웃 실패 테스트 작성**

```java
@Test
@DisplayName("logout - 인증 정보가 없어도 Refresh 쿠키로 서버 패밀리를 폐기한다")
void logout_access만료_refresh쿠키로폐기() {
    SecurityContextHolder.clearContext();
    MockHttpServletRequest request = new MockHttpServletRequest();
    request.setCookies(new Cookie(CookieUtil.REFRESH_TOKEN_COOKIE, "refresh-token"));
    given(cookieUtil.deleteAccessTokenCookie()).willReturn(deleteAccess);
    given(cookieUtil.deleteRefreshTokenCookie()).willReturn(deleteRefresh);

    controller.logout(request);

    verify(authService).logoutByRefreshToken(eq("refresh-token"), isNull(), anyString(), any());
}
```

`AuthServiceTest`에는 해시 조회와 불일치 쿠키 방어를 추가한다.

```java
@Test
@DisplayName("logoutByRefreshToken - 쿠키 해시로 토큰 소유자 패밀리를 폐기한다")
void logoutByRefreshToken_해시조회_패밀리폐기() {
    String raw = "refresh-token";
    Crtokm stored = Crtokm.builder().eno("10001").famNm("FAM-1").avlYn("Y")
            .ecyRnwPubTokCone(AuthService.sha256HexForToken(raw))
            .endDtm(LocalDateTime.now().plusDays(1)).build();
    given(refreshTokenRepository.findByEcyRnwPubTokCone(AuthService.sha256HexForToken(raw)))
            .willReturn(Optional.of(stored));

    authService.logoutByRefreshToken(raw, null, "127.0.0.1", "Agent");

    verify(refreshTokenRepository).deleteByEno("10001");
}
```

- [ ] **Step 2: RED 확인**

Run: `cd it_backend && ./gradlew test --tests "*AuthControllerTest" --tests "*AuthServiceTest"`

Expected: `logoutByRefreshToken` 미정의로 컴파일 실패.

- [ ] **Step 3: 쿠키 해시 기반 로그아웃 구현**

해시 전용 저장·조회(`issueNewRefreshFamily`·회전 빌더·`findRefreshTokenByValue`)는 Task 1에서 이미 전환했으므로, 여기서는 Refresh 쿠키 해시로 소유자 패밀리를 폐기하는 `logoutByRefreshToken`만 추가한다.

```java
@Transactional
public void logoutByRefreshToken(String refreshTokenValue, String authenticatedEno,
                                 String ipAddress, String userAgent) {
    Crtokm stored = refreshTokenRepository
            .findByEcyRnwPubTokCone(sha256HexForToken(refreshTokenValue))
            .orElse(null);
    String tokenEno = stored == null ? null : stored.getEno();
    if (tokenEno != null) refreshTokenRepository.deleteByEno(tokenEno);
    if (authenticatedEno != null && !authenticatedEno.isBlank()
            && !authenticatedEno.equals(tokenEno)) {
        log.warn("로그아웃 Access/Refresh 사용자 불일치 — 두 토큰 패밀리를 폐기합니다.");
        refreshTokenRepository.deleteByEno(authenticatedEno);
    }
    String historyEno = tokenEno != null ? tokenEno : authenticatedEno;
    if (historyEno != null && !historyEno.isBlank()) recordLogout(historyEno, ipAddress, userAgent);
}
```

- [ ] **Step 4: 컨트롤러에서 Refresh 쿠키 우선 폐기**

```java
String refreshToken = extractCookieValue(httpRequest, CookieUtil.REFRESH_TOKEN_COOKIE);
Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
String authenticatedEno = authentication != null && authentication.isAuthenticated()
        ? authentication.getName() : null;
String ipAddress = getClientIp(httpRequest);
String userAgent = httpRequest.getHeader("User-Agent");
if (refreshToken != null && !refreshToken.isBlank()) {
    authService.logoutByRefreshToken(refreshToken, authenticatedEno, ipAddress, userAgent);
} else if (authenticatedEno != null) {
    authService.logout(authenticatedEno, ipAddress, userAgent);
}
```

- [ ] **Step 5: 테스트·커밋**

Run: `cd it_backend && ./gradlew test --tests "*AuthControllerTest" --tests "*AuthServiceTest"`

Expected: PASS.

```bash
git add it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java \
  it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java \
  it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java \
  it_backend/src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java
git commit -m "fix(auth): Refresh 쿠키 기반 로그아웃 패밀리 폐기 (SEC-06)"
```

---

### Task 3: SEC-07 운영 위험 토글 fail-fast

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java`
- Modify: `it_backend/src/main/resources/application-prod.properties`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java`

**Interfaces:**
- Consumes: Spring `Environment`.
- Produces: prod에서 `sso.mock-enabled`, `app.auth.allow-bearer-header`, `app.cookie.secure`의 안전값을 강제한다.

- [ ] **Step 1: 세 위험 설정 테스트 추가**

```java
@ParameterizedTest
@ValueSource(strings = {"sso.mock-enabled", "app.auth.allow-bearer-header"})
@DisplayName("운영 프로파일에서 인증 우회 토글이 true면 기동 차단")
void validate_prodBypassToggleTrue_throws(String key) {
    MockEnvironment env = prodEnvWithAllRequired();
    env.setProperty(key, "true");
    assertThatThrownBy(() -> new EnvironmentValidator(env).validate())
            .isInstanceOf(IllegalStateException.class).hasMessageContaining(key);
}

@Test
@DisplayName("운영 프로파일에서 app.cookie.secure=false면 기동 차단")
void validate_prodCookieNotSecure_throws() {
    MockEnvironment env = prodEnvWithAllRequired();
    env.setProperty("app.cookie.secure", "false");
    assertThatThrownBy(() -> new EnvironmentValidator(env).validate())
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("app.cookie.secure");
}
```

`prodEnvWithAllRequired()`에 안전 기본값 3개를 명시한다.

```java
env.setProperty("sso.mock-enabled", "false");
env.setProperty("app.auth.allow-bearer-header", "false");
env.setProperty("app.cookie.secure", "true");
```

- [ ] **Step 2: RED 확인**

Run: `cd it_backend && ./gradlew test --tests "*EnvironmentValidatorTest"`

Expected: 신규 3개 테스트 FAIL.

- [ ] **Step 3: 운영 검증 구현**

```java
private void rejectTrue(String key, String reason) {
    if (Boolean.parseBoolean(environment.getProperty(key, "false"))) {
        throw new IllegalStateException("운영 보안 위반: " + key + "=true 금지 — " + reason);
    }
}

private void validateProdKeys() {
    // 기존 필수키 검증 유지
    rejectTrue("sso.mock-enabled", "모의 SSO 로그인 경로입니다.");
    rejectTrue("app.auth.allow-bearer-header", "Bearer 헤더 인증 폴백입니다.");
    // CookieUtil이 ${app.cookie.secure:false}로 읽으므로 미설정=비Secure다. 검증 기본값도 false로 맞춰
    // 값이 비어 있으면 통과시키지 않는다(운영 프로파일은 app.cookie.secure=true로 명시되어 있어야 한다).
    if (!Boolean.parseBoolean(environment.getProperty("app.cookie.secure", "false"))) {
        throw new IllegalStateException("운영 보안 위반: app.cookie.secure가 true가 아님 — 인증 쿠키에 Secure가 필요합니다.");
    }
}
```

`application-prod.properties`에는 base(`application.properties`)에만 있는 Bearer 폴백 토글을 명시적으로 고정한다. `sso.mock-enabled=false`와 `app.cookie.secure=true`는 이미 `application-prod.properties`에 존재하므로 중복 추가하지 말고 값만 재확인한다.

```properties
app.auth.allow-bearer-header=false
```

- [ ] **Step 4: 테스트·커밋**

Run: `cd it_backend && ./gradlew test --tests "*EnvironmentValidatorTest"`

Expected: PASS.

```bash
git add it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java \
  it_backend/src/main/resources/application-prod.properties \
  it_backend/src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java
git commit -m "fix(security): 운영 인증 우회 토글 기동 차단 (SEC-07)"
```

---

### Task 4: SEC-07 SSO 세션 ID 교체

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/sso/SsoController.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/sso/SsoControllerTest.java`

**Interfaces:**
- Produces: SSO 성공 결과가 세션에 승격되기 직전 `HttpServletRequest.changeSessionId()`를 호출한다.
- Failure: 세션이 없거나 SSO 결과가 실패면 세션 ID를 변경하지 않는다.

- [ ] **Step 1: 성공/실패 경계 테스트 작성**

```java
@Test
@DisplayName("GET /sso/loginProc - 인증 성공 시 세션 ID를 교체하고 검증 사번을 보존한다")
void loginProc_성공_세션ID교체() throws Exception {
    MockHttpSession session = new MockHttpSession();
    String oldId = session.getId();
    session.setAttribute("resultCode", "000000");
    session.setAttribute("resultData", "K150024");

    mockMvc.perform(get("/sso/loginProc").session(session)).andExpect(status().is3xxRedirection());

    assertThat(session.getId()).isNotEqualTo(oldId);
    assertThat(session.getAttribute("ssoVerifiedEno")).isEqualTo("K150024");
}
```

- [ ] **Step 2: RED 확인**

Run: `cd it_backend && ./gradlew test --tests "*SsoControllerTest"`

Expected: 세션 ID가 동일해 FAIL.

- [ ] **Step 3: 성공 경계에 ID 교체 추가**

`proceedToComplete`의 `verified` 분기에 추가한다.

```java
if (verified) {
    request.changeSessionId();
    session.setAttribute(SSO_VERIFIED_ENO_SESSION_KEY, resultData);
}
```

- [ ] **Step 4: 테스트·커밋**

Run: `cd it_backend && ./gradlew test --tests "*SsoControllerTest"`

Expected: PASS.

```bash
git add it_backend/src/main/java/com/kdb/it/common/sso/SsoController.java \
  it_backend/src/test/java/com/kdb/it/common/sso/SsoControllerTest.java
git commit -m "fix(sso): 인증 성공 경계 세션 ID 교체 (SEC-07)"
```

---

### Task 5: SEC-03 GWE IF_ID 설정 단일화

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/infra/eai/config/GweProperties.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/eai/config/EaiInfraConfig.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouter.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/service/DeliberationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/service/ContractService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/service/PaymentService.java`
- Modify: `it_backend/src/main/resources/application.properties`
- Test: `it_backend/src/test/java/com/kdb/it/infra/eai/config/GwePropertiesTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouterTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/deliberation/service/DeliberationServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/contract/service/ContractServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/payment/service/PaymentServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/eai/service/EaiServiceTest.java`

**Interfaces:**
- Produces: `GweProperties.ifId(): String`, 기본값 `IPPG00000001`, 정확히 12자.

- [ ] **Step 1: 설정 계약 테스트 작성**

```java
@Test
@DisplayName("GWE IF_ID 미설정 시 현재 임시값을 기본 사용한다")
void defaults() {
    assertThat(new GweProperties(null).ifId()).isEqualTo("IPPG00000001");
}

@Test
@DisplayName("GWE IF_ID는 KDB 전문 규격 12자리여야 한다")
void invalidLength() {
    assertThatThrownBy(() -> new GweProperties("SHORT"))
            .isInstanceOf(IllegalStateException.class).hasMessageContaining("12자리");
}
```

- [ ] **Step 2: RED 확인**

Run: `cd it_backend && ./gradlew test --tests "*GwePropertiesTest"`

Expected: 클래스 미정의로 컴파일 실패.

- [ ] **Step 3: 설정 record와 등록 구현**

```java
@ConfigurationProperties(prefix = "eai.gwe")
public record GweProperties(String ifId) {
    public GweProperties {
        if (ifId == null || ifId.isBlank()) ifId = "IPPG00000001";
        if (ifId.length() != 12) {
            throw new IllegalStateException("eai.gwe.if-id는 12자리여야 합니다: " + ifId);
        }
    }
}
```

`EaiInfraConfig`의 등록을 `@EnableConfigurationProperties({EaiProperties.class, GweProperties.class})`로 바꾸고 `application.properties`에 추가한다.

```properties
eai.gwe.if-id=${EAI_GWE_IF_ID:IPPG00000001}
```

- [ ] **Step 4: 다섯 발송 경로를 `gweProperties.ifId()`로 교체**

각 클래스에 `private final GweProperties gweProperties;`를 추가하고 다음 호출로 통일한다.

```java
EaiRequest.gwe(gweProperties.ifId(), GwePayload.builder()
        // 기존 payload 필드는 그대로 유지
        .build())
```

테스트에서는 `new GweProperties("TEST00000001")`를 생성자에 전달하고 captor의 `ifId()`가 동일한지 검증한다.

- [ ] **Step 5: 중복 상수 잔존 검사·테스트·커밋**

Run: `rg -n 'IPPG00000001' it_backend/src/main/java`

Expected: `GweProperties.java` 기본값 1건만 출력.

Run: `cd it_backend && ./gradlew test --tests "*GwePropertiesTest" --tests "*NotificationDispatcherRouterTest" --tests "*EstimateServiceTest" --tests "*DeliberationServiceTest" --tests "*ContractServiceTest" --tests "*PaymentServiceTest"`

Expected: PASS.

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/config \
  it_backend/src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouter.java \
  it_backend/src/main/java/com/kdb/it/domain/{estimate,deliberation,contract,payment}/service \
  it_backend/src/main/resources/application.properties it_backend/src/test/java
git commit -m "refactor(eai): GWE IF_ID 설정 단일화 (SEC-03)"
```

---

### Task 6: ERR-05 CINFMM 상태 모델과 DDL

**Files:**
- Create: `it_database/migrations/V20260719_002__AddNotificationDispatchState.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/entity/Cinfmm.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/entity/CinfmmTest.java`

**Interfaces:**
- Produces: `markDispatchSent`, `markDispatchFailed`, `canRetry` 상태 전이.

- [ ] **Step 1: 상태 전이 테스트 작성**

```java
@Test
@DisplayName("발송 실패는 FAILED 상태와 재시도 횟수·오류내용을 기록한다")
void markDispatchFailed_recordsFailure() {
    Cinfmm notification = pending();
    notification.markDispatchFailed("EAI timeout");
    assertThat(notification.getInfmSdStsC()).isEqualTo(Cinfmm.DISPATCH_FAILED);
    assertThat(notification.getReTryNot()).isEqualTo(1);
    assertThat(notification.getErrCone()).isEqualTo("EAI timeout");
    assertThat(notification.getSdDtm()).isNotNull();
}

@Test
@DisplayName("5회 실패한 알림은 더 이상 재시도하지 않는다")
void canRetry_exhausted_false() {
    Cinfmm notification = pending();
    for (int i = 0; i < 5; i++) notification.markDispatchFailed("장애");
    assertThat(notification.canRetry(5)).isFalse();
}
```

- [ ] **Step 2: RED 확인**

Run: `cd it_backend && ./gradlew test --tests "*CinfmmTest"`

Expected: 상태 필드·메서드 미정의로 컴파일 실패.

- [ ] **Step 3: DDL 작성**

`INFM_SD_STS_C VARCHAR2(2) DEFAULT '02' NOT NULL`, `RE_TRY_NOT NUMBER(5) DEFAULT 0 NOT NULL`, `ERR_CONE VARCHAR2(100)`를 존재 여부 검사 후 추가한다. 역사 데이터는 중복 재발송 방지를 위해 모두 `02`로 백필하고, 인덱스 `IX_CINFMM_SD_RETRY(INFM_SD_STS_C, RE_TRY_NOT, SD_DTM)`를 생성한다. 파일 전체를 다음과 같이 작성한다.

```sql
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
      FROM ALL_TAB_COLUMNS
     WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
       AND TABLE_NAME = 'TPRMPP_CINFMM'
       AND COLUMN_NAME = 'INFM_SD_STS_C';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE q'[ALTER TABLE TPRMPP_CINFMM ADD (INFM_SD_STS_C VARCHAR2(2 CHAR) DEFAULT '02')]';
    END IF;
    EXECUTE IMMEDIATE q'[COMMENT ON COLUMN TPRMPP_CINFMM.INFM_SD_STS_C IS '알림발송상태코드(01=PENDING, 02=SENT, 03=FAILED)']';

    SELECT COUNT(*) INTO v_count
      FROM ALL_TAB_COLUMNS
     WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
       AND TABLE_NAME = 'TPRMPP_CINFMM'
       AND COLUMN_NAME = 'RE_TRY_NOT';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CINFMM ADD (RE_TRY_NOT NUMBER(5) DEFAULT 0)';
    END IF;
    EXECUTE IMMEDIATE q'[COMMENT ON COLUMN TPRMPP_CINFMM.RE_TRY_NOT IS '재시도횟수']';

    SELECT COUNT(*) INTO v_count
      FROM ALL_TAB_COLUMNS
     WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
       AND TABLE_NAME = 'TPRMPP_CINFMM'
       AND COLUMN_NAME = 'ERR_CONE';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CINFMM ADD (ERR_CONE VARCHAR2(100 CHAR))';
    END IF;
    EXECUTE IMMEDIATE q'[COMMENT ON COLUMN TPRMPP_CINFMM.ERR_CONE IS '오류내용']';

END;
/

UPDATE TPRMPP_CINFMM
   SET INFM_SD_STS_C = '02'
 WHERE INFM_SD_STS_C IS NULL;

UPDATE TPRMPP_CINFMM
   SET RE_TRY_NOT = 0
 WHERE RE_TRY_NOT IS NULL;

ALTER TABLE TPRMPP_CINFMM MODIFY (INFM_SD_STS_C DEFAULT '02' NOT NULL);
ALTER TABLE TPRMPP_CINFMM MODIFY (RE_TRY_NOT DEFAULT 0 NOT NULL);

DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
      FROM ALL_INDEXES
     WHERE OWNER = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')
       AND INDEX_NAME = 'IX_CINFMM_SD_RETRY';
    IF v_count = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_CINFMM_SD_RETRY ON TPRMPP_CINFMM (INFM_SD_STS_C, RE_TRY_NOT, SD_DTM)';
    END IF;
END;
/
```

- [ ] **Step 4: 엔티티 상태 구현**

```java
public static final String DISPATCH_PENDING = "01";
public static final String DISPATCH_SENT = "02";
public static final String DISPATCH_FAILED = "03";

@Column(name = "INFM_SD_STS_C", length = 2, nullable = false, comment = "알림발송상태코드")
private String infmSdStsC;
@Column(name = "RE_TRY_NOT", nullable = false, comment = "재시도횟수")
private Integer reTryNot;
@Column(name = "ERR_CONE", length = 100, comment = "오류내용")
private String errCone;

public void markDispatchSent(String sdTc, String payload) {
    this.sdTc = sdTc;
    this.sdDocCone = payload;
    this.sdDtm = LocalDateTime.now();
    this.infmSdStsC = DISPATCH_SENT;
    this.errCone = null;
}

public void markDispatchFailed(String errorMessage) {
    this.infmSdStsC = DISPATCH_FAILED;
    this.reTryNot = (this.reTryNot == null ? 0 : this.reTryNot) + 1;
    this.sdDtm = LocalDateTime.now();
    this.errCone = errorMessage == null ? null : errorMessage.substring(0, Math.min(100, errorMessage.length()));
}

public boolean canRetry(int maxAttempts) {
    return !DISPATCH_SENT.equals(infmSdStsC) && (reTryNot == null ? 0 : reTryNot) < maxAttempts;
}
```

- [ ] **Step 5: 테스트·커밋**

Run: `cd it_backend && ./gradlew test --tests "*CinfmmTest"`

Expected: PASS.

```bash
git add it_database/migrations/V20260719_002__AddNotificationDispatchState.sql \
  it_backend/src/main/java/com/kdb/it/common/notification/entity/Cinfmm.java \
  it_backend/src/test/java/com/kdb/it/common/notification/entity/CinfmmTest.java
git commit -m "feat(notification): 발송 상태와 재시도 횟수 모델 추가 (ERR-05)"
```

---

### Task 7: ERR-05 enqueue와 dispatch 트랜잭션 분리

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatchResult.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationOutboxService.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationDispatchService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcher.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouter.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/event/NotificationEventListener.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationService.java` — 조회·읽음 책임만 남기고 `send` 제거.
- Create: `it_backend/src/test/java/com/kdb/it/common/notification/service/NotificationOutboxServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/notification/service/NotificationDispatchServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/notification/event/NotificationEventListenerTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouterTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/notification/service/NotificationServiceTest.java`

**Interfaces:**
- Produces: `NotificationOutboxService.enqueue(NotificationEvent): String`, `NotificationDispatchService.dispatch(String): void`.
- Failure: enqueue 실패는 listener가 metric/log 후 삼키고, dispatch 실패는 FAILED 행으로 커밋한다.

- [ ] **Step 1: 서비스 경계 실패 테스트 작성**

```java
@Test
@DisplayName("enqueue는 PENDING 행을 저장하고 ID를 반환한다")
void enqueue_pendingSaved() {
    given(repository.getNextVal()).willReturn(7L);
    String id = service.enqueue(event);
    ArgumentCaptor<Cinfmm> captor = ArgumentCaptor.forClass(Cinfmm.class);
    verify(repository).saveAndFlush(captor.capture());
    assertThat(id).isEqualTo(captor.getValue().getInfmMsgNo());
    assertThat(captor.getValue().getInfmSdStsC()).isEqualTo(Cinfmm.DISPATCH_PENDING);
}

@Test
@DisplayName("dispatch 실패는 FAILED 상태를 남기고 예외를 전파하지 않는다")
void dispatch_failure_marksFailed() {
    Cinfmm row = pending();
    given(repository.findById(row.getInfmMsgNo())).willReturn(Optional.of(row));
    given(dispatcher.dispatch(row, row.getSdDocCone()))
            .willReturn(NotificationDispatchResult.failure("timeout"));
    service.dispatch(row.getInfmMsgNo());
    assertThat(row.getInfmSdStsC()).isEqualTo(Cinfmm.DISPATCH_FAILED);
}
```

- [ ] **Step 2: RED 확인**

Run: `cd it_backend && ./gradlew test --tests "*NotificationOutboxServiceTest" --tests "*NotificationDispatchServiceTest"`

Expected: 신규 클래스 미정의로 컴파일 실패.

- [ ] **Step 3: 발송 결과 계약과 router 구현**

```java
public record NotificationDispatchResult(boolean success, String errorMessage) {
    public static NotificationDispatchResult sent() { return new NotificationDispatchResult(true, null); }
    public static NotificationDispatchResult failure(String message) { return new NotificationDispatchResult(false, message); }
}
```

`NotificationDispatcher.dispatch`는 결과를 반환하고 router는 실패를 삼키지 말고 결과로 변환한다. `EaiResult.skipped()` 접근값이 true인 경우는 개발환경 의도적 미전송이므로 SENT로 처리한다.

```java
if (result.success() || result.skipped()) return NotificationDispatchResult.sent();
return NotificationDispatchResult.failure(result.errorMessage());
```

router 리팩터 시 다음을 함께 정리한다.
- 기존 `dispatch`의 `finally { markDispatched(...) }`와 인앱 분기의 `markDispatched(...)` 호출을 **제거한다.** 발송 상태 기록(`markDispatchSent`/`markDispatchFailed`) 책임은 `NotificationDispatchService`로 이관되므로 router가 상태를 이중으로 찍지 않는다.
- 인앱 채널(`CHANNEL_INAPP`)과 미지원 채널 폴백은 외부 전송이 없으므로 `NotificationDispatchResult.sent()`를 반환한다(발송 메타 기록은 dispatch service의 `markDispatchSent`가 담당).

- [ ] **Step 4: PENDING 독립 커밋 서비스 구현**

```java
@Service
@RequiredArgsConstructor
public class NotificationOutboxService {
    private final CinfmmRepository repository;

    // 기존 NotificationService.send가 갖던 미읽음 카운트 캐시 무효화 책임을 이관한다(배지 즉시 반영).
    // import: org.springframework.cache.annotation.CacheEvict
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @CacheEvict(value = "notificationUnreadCount", key = "#event.recipientEno()",
            condition = "#event.recipientEno() != null")
    public String enqueue(NotificationEvent event) {
        if (event.recipientEno() == null || event.recipientEno().isBlank()) return null;
        String id = String.format("INF-%d-%08d", LocalDate.now().getYear(), repository.getNextVal());
        Cinfmm row = Cinfmm.builder()
                .infmMsgNo(id).infmSvcTc(event.infmSvcTc())
                .ttl(clamp(event.ttl(), 100)).infmMsgCone(clamp(event.infmMsgCone(), 4000))
                .infmRcdUrl(clamp(event.infmRcdUrl(), 300)).rmsEno(event.recipientEno())
                .inqYn("N").sdTc(event.sdTc()).sdDocCone(event.sdPayload())
                .infmSdStsC(Cinfmm.DISPATCH_PENDING).reTryNot(0).build();
        repository.saveAndFlush(row);
        return id;
    }

    private static String clamp(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) return value;
        return value.substring(0, maxLength);
    }
}
```

- [ ] **Step 5: 발송 독립 트랜잭션과 listener 연결**

```java
@Value("${notification.retry.max-attempts:5}")
private int maxAttempts;

@Transactional(propagation = Propagation.REQUIRES_NEW)
public void dispatch(String infmMsgNo) {
    Cinfmm row = repository.findById(infmMsgNo).orElseThrow();
    if (Cinfmm.DISPATCH_SENT.equals(row.getInfmSdStsC())) return;
    NotificationDispatchResult result = dispatcher.dispatch(row, row.getSdDocCone());
    if (result.success()) row.markDispatchSent(row.getSdTc(), row.getSdDocCone());
    else {
        row.markDispatchFailed(result.errorMessage());
        meterRegistry.counter("notification.dispatch.failure", "channel", safeChannel(row.getSdTc())).increment();
        if (row.getReTryNot() >= maxAttempts) {
            meterRegistry.counter("notification.dispatch.exhausted", "channel", safeChannel(row.getSdTc())).increment();
        }
    }
}

private static String safeChannel(String channel) {
    return channel == null || channel.isBlank() ? "unknown" : channel;
}
```

listener 공통 헬퍼는 적재와 발송 예외를 분리해 원 업무 비롤백을 유지한다. 발송 단계의 예상 실패는 `NotificationDispatchService`가 FAILED 상태로 커밋하고, 예상 밖 예외만 listener의 `notification.dispatch.unexpected` 카운터에 기록한다.

```java
private void enqueueAndDispatch(NotificationEvent event) {
    String id;
    try {
        id = outboxService.enqueue(event);
    } catch (Exception ex) {
        meterRegistry.counter("notification.persist.failure", "type", safeType(event.infmSvcTc())).increment();
        log.error("알림 outbox 적재 실패: svcTc={}", event.infmSvcTc(), ex);
        return;
    }
    if (id == null) return;
    try {
        dispatchService.dispatch(id);
    } catch (Exception ex) {
        meterRegistry.counter("notification.dispatch.unexpected", "type", safeType(event.infmSvcTc())).increment();
        log.error("알림 발송 처리 중 예상 밖 오류: infmMsgNo={}, svcTc={}", id, event.infmSvcTc(), ex);
    }
}

private static String safeType(String type) {
    return type == null || type.isBlank() ? "unknown" : type;
}
```

- [ ] **Step 6: 관련 테스트·커밋**

Run: `cd it_backend && ./gradlew test --tests "*Notification*Test"`

Expected: PASS.

```bash
git add it_backend/src/main/java/com/kdb/it/common/notification it_backend/src/test/java/com/kdb/it/common/notification
git commit -m "feat(notification): outbox 적재와 발송 트랜잭션 분리 (ERR-05)"
```

---

### Task 8: ERR-05 실패·정체 알림 재시도 스케줄러

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/config/NotificationSchedulingConfig.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/scheduler/NotificationRetryScheduler.java`
- Modify: `it_backend/src/main/resources/application.properties`
- Create: `it_backend/src/test/java/com/kdb/it/common/notification/scheduler/NotificationRetrySchedulerTest.java`

**Interfaces:**
- Consumes: `NotificationDispatchService.dispatch(String)`.
- Produces: 최대 50개 FAILED 행과 생성 후 60초가 지난 PENDING 행을 60초마다 재시도한다.

- [ ] **Step 1: 배치 제한·소진 제외 테스트 작성**

```java
@Test
@DisplayName("재시도 배치는 조회된 ID만 dispatch하고 개별 실패 후에도 다음 건을 계속한다")
void retry_continuesAfterFailure() {
    given(repository.findRetryableIds(anyList(), eq(5), any(LocalDateTime.class), any(Pageable.class)))
            .willReturn(List.of("INF-1", "INF-2"));
    doThrow(new IllegalStateException("lock")).when(dispatchService).dispatch("INF-1");
    scheduler.retry();
    verify(dispatchService).dispatch("INF-1");
    verify(dispatchService).dispatch("INF-2");
}
```

- [ ] **Step 2: RED 확인**

Run: `cd it_backend && ./gradlew test --tests "*NotificationRetrySchedulerTest"`

Expected: 클래스 미정의로 컴파일 실패.

- [ ] **Step 3: 조회 쿼리와 설정 추가**

```java
@Query("select c.infmMsgNo from Cinfmm c where c.delYn = 'N' " +
       "and c.infmSdStsC in :statuses and c.reTryNot < :maxAttempts " +
       "and (c.infmSdStsC = '03' or c.fstEnrDtm <= :pendingBefore) " +
       "order by coalesce(c.sdDtm, c.fstEnrDtm) asc")
List<String> findRetryableIds(List<String> statuses, int maxAttempts,
                              LocalDateTime pendingBefore, Pageable pageable);
```

```properties
notification.retry.enabled=true
notification.retry.fixed-delay-ms=60000
notification.retry.max-attempts=5
notification.retry.batch-size=50
```

- [ ] **Step 4: scheduler 구현**

Spring scheduling 활성화는 알림 패키지 내부 설정으로 제한한다.

```java
@Configuration(proxyBeanMethods = false)
@EnableScheduling
public class NotificationSchedulingConfig {
}
```

```java
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "notification.retry.enabled", havingValue = "true", matchIfMissing = true)
public class NotificationRetryScheduler {
    private final CinfmmRepository repository;
    private final NotificationDispatchService dispatchService;
    @Value("${notification.retry.max-attempts:5}") private int maxAttempts;
    @Value("${notification.retry.batch-size:50}") private int batchSize;

    @Scheduled(fixedDelayString = "${notification.retry.fixed-delay-ms:60000}")
    public void retry() {
        List<String> ids = repository.findRetryableIds(
                List.of(Cinfmm.DISPATCH_PENDING, Cinfmm.DISPATCH_FAILED),
                maxAttempts, LocalDateTime.now().minusSeconds(60),
                PageRequest.of(0, batchSize));
        for (String id : ids) {
            try { dispatchService.dispatch(id); }
            catch (Exception ex) { log.warn("알림 재시도 처리 실패: infmMsgNo={}", id, ex); }
        }
    }
}
```

- [ ] **Step 5: 테스트·커밋**

Run: `cd it_backend && ./gradlew test --tests "*NotificationRetrySchedulerTest" --tests "*NotificationDispatchServiceTest"`

Expected: PASS.

```bash
git add it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepository.java \
  it_backend/src/main/java/com/kdb/it/common/notification/config/NotificationSchedulingConfig.java \
  it_backend/src/main/java/com/kdb/it/common/notification/scheduler \
  it_backend/src/main/resources/application.properties \
  it_backend/src/test/java/com/kdb/it/common/notification/scheduler
git commit -m "feat(notification): 실패 알림 제한 재시도 스케줄러 추가 (ERR-05)"
```

---

### Task 9: ERR-07 Excalidraw·Tiptap 실패 상태

**Files:**
- Modify: `it_frontend/app/components/ExcalidrawWrapper.vue`
- Modify: `it_frontend/app/components/TiptapEditor.vue`
- Test: `it_frontend/tests/unit/components/editor-error-state.test.ts`

**Interfaces:**
- Produces: 손상 장면은 빈 신규 캔버스와 구분되며 원문을 덮어쓰지 않는다. 변수 카탈로그 실패는 인라인 경고와 재시도 버튼을 제공한다.

- [ ] **Step 1: 실패 상태 렌더 테스트 작성**

`ExcalidrawWrapper`에는 손상 JSON을 전달하고, `TiptapEditor`의 `loadMetadata` mock은 첫 호출을 reject하도록 설정한다. 두 테스트의 핵심 assertion은 다음과 같다.

```ts
expect(wrapper.text()).toContain('장면 데이터가 손상되었습니다');
expect(wrapper.find('[data-testid="retry-variable-metadata"]').exists()).toBe(true);
```

- [ ] **Step 2: Excalidraw 손상 상태 구현**

```ts
const sceneParseError = ref(false);

try {
    const parsed = JSON.parse(props.initialSceneData);
    initialData = {
        elements: parsed.elements || [],
        appState: {
            ...(parsed.appState || {}),
            collaborators: new Map(),
        },
        files: parsed.files || {},
    };
} catch (error) {
    sceneParseError.value = true;
    console.warn('[ExcalidrawWrapper] 초기 데이터 파싱 실패', error);
}
```

`sceneParseError`는 `exportData`보다 앞에서 선언한다. `exportData` 시작부에서 저장을 차단하고, 원문은 변경하지 않은 `props.initialSceneData`에 보존한다.

```ts
if (sceneParseError.value) {
    toast.add({
        severity: 'error',
        summary: '다이어그램 저장 차단',
        detail: '손상된 원본을 덮어쓰지 않도록 저장을 차단했습니다.',
        life: 4000,
    });
    return null;
}
```

템플릿 최상단에 경고를 추가한다.

```vue
<Message v-if="sceneParseError" severity="error" :closable="false">
    장면 데이터가 손상되었습니다. 빈 캔버스로 저장하면 원본이 유실될 수 있어 저장을 차단했습니다.
</Message>
```

- [ ] **Step 3: Tiptap 카탈로그 재시도 구현**

```ts
const metadataLoading = ref(false);
const metadataError = ref(false);
const loadVariableMetadata = async () => {
    metadataLoading.value = true;
    metadataError.value = false;
    try {
        await loadMetadata();
        const storage = editor.value?.storage as Record<string, any> | undefined;
        if (storage?.tiptapVariable) storage.tiptapVariable.metadata = variableMetadata.value;
    } catch (error) {
        metadataError.value = true;
        console.warn('[TiptapEditor] 변수 카탈로그 로드 실패', error);
    } finally {
        metadataLoading.value = false;
    }
};
```

```vue
<Message v-if="metadataError" severity="warn" :closable="false">
    변수 목록을 불러오지 못했습니다.
    <Button data-testid="retry-variable-metadata" label="다시 시도" text size="small"
            :loading="metadataLoading" @click="loadVariableMetadata" />
</Message>
```

- [ ] **Step 4: 테스트·커밋**

Run: `cd it_frontend && npm test -- --run tests/unit/components/editor-error-state.test.ts`

Expected: PASS.

```bash
git add it_frontend/app/components/{ExcalidrawWrapper,TiptapEditor}.vue \
  it_frontend/tests/unit/components/editor-error-state.test.ts
git commit -m "fix(frontend): 에디터 손상·카탈로그 실패 상태 노출 (ERR-07)"
```

---

### Task 10: ERR-07 자동완성·통화 조회 실패 상태

**Files:**
- Modify: `it_frontend/app/composables/useCostListPage.ts`
- Modify: `it_frontend/app/composables/useMentionAutocomplete.ts`
- Modify: `it_frontend/app/composables/useProjectCurrencies.ts`
- Modify: `it_frontend/app/components/MentionAutocomplete.vue`
- Modify: `it_frontend/app/pages/info/cost/index.vue`
- Modify: `it_frontend/app/components/board/BoardCommentTree.vue`
- Modify: `it_frontend/app/pages/board/[blbMngNo]/form.vue`
- Modify: `it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/edit.vue`
- Modify: `it_frontend/app/pages/info/projects/form.vue`
- Modify: `it_frontend/app/pages/project/bizplan/[abusMngNo].vue`
- Test: `it_frontend/tests/unit/composables/useCostListPage.test.ts`
- Test: `it_frontend/tests/unit/composables/useMentionAutocomplete.test.ts`
- Test: `it_frontend/tests/unit/composables/useProjectCurrencies.test.ts`
- Create: `it_frontend/tests/unit/components/MentionAutocomplete.test.ts`

**Interfaces:**
- Produces: 각 composable이 `loading`, `error`, `retry`를 반환한다.

- [ ] **Step 1: 세 composable RED 테스트 추가**

```ts
expect(composer.searchError.value).toBe(true);
await composer.retrySearch();
expect(mockApiFetch).toHaveBeenCalledTimes(2);
```

```ts
expect(currencies.loadError.value).toBe(true);
expect(currencies.currencyOptions.value).toEqual(['KRW']);
```

- [ ] **Step 2: 상태 구현**

`useCostListPage`에는 마지막 검색 요청과 오류 상태를 보존한다.

```ts
const continuationSearchError = ref(false);
const lastContinuationSearch = ref<{ query: string; data: ItCost } | null>(null);

const searchContinuation = async (event: { query: string }, data: ItCost) => {
    lastContinuationSearch.value = { query: event.query, data };
    continuationSearchError.value = false;
    const prevYear = data.bseYy
        ? String(Number(data.bseYy) - 1)
        : String((selectedYear.value ?? currentYear) - 1);
    try {
        const results = await $apiFetch<ItCost[]>(`${config.public.apiBase}/api/cost`, {
            query: { bseYy: prevYear, tmnYn: data.tmnYn },
        });
        const keyword = event.query.trim().toLowerCase();
        continuationSuggestions.value = (results ?? []).filter(
            (cost) => !keyword || cost.cttNm?.toLowerCase().includes(keyword),
        );
    } catch (error) {
        continuationSuggestions.value = [];
        continuationSearchError.value = true;
        console.warn('[CostList] 계속계약 자동완성 조회 실패', error);
    }
};

const retryContinuationSearch = async () => {
    const last = lastContinuationSearch.value;
    if (last) await searchContinuation({ query: last.query }, last.data);
};
```

`useMentionAutocomplete`의 `runSearch` 시작/종료와 catch에 다음 상태를 연결하고 반환 객체에 세 값을 추가한다.

```ts
const searchLoading = ref(false);
const searchError = ref(false);

const runSearch = async (): Promise<void> => {
    searchLoading.value = true;
    searchError.value = false;
    try {
        const keyword = query.value.trim();
        const orgCode = user.value?.bbrC ?? '';
        const params: Record<string, string> = {};
        if (keyword) {
            params.keyword = keyword;
        } else {
            if (!orgCode) {
                items.value = [];
                return;
            }
            params.orgCode = orgCode;
        }
        const result = await $apiFetch<UserSuggestion[]>(SEARCH_URL, { query: params });
        items.value = (result ?? []).slice(0, 8);
        selectedIndex.value = 0;
    } catch (error) {
        items.value = [];
        searchError.value = true;
        console.warn('[MentionAutocomplete] 사용자 검색 실패', error);
    } finally {
        searchLoading.value = false;
    }
};

const retrySearch = (): Promise<void> => runSearch();
```

`MentionAutocomplete`에는 `loading`, `error` props와 `retry` emit을 추가하고 `active && (loading || error || items.length > 0)`일 때 popup을 표시한다.

```vue
<li v-if="error" class="px-3 py-2 text-sm text-red-600">
    사용자 검색에 실패했습니다.
    <button type="button" class="ml-2 underline" @mousedown.prevent="emit('retry')">다시 시도</button>
</li>
```

`useProjectCurrencies`에는 `loading`과 `loadError`를 추가한다.

```ts
const loading = ref(false);
const loadError = ref(false);

const loadCurrencyOptions = async () => {
    loading.value = true;
    loadError.value = false;
    try {
        const base = `${runtimeConfig.public.apiBase}/api/ccodem`;
        const list = await $apiFetch<CcodemCurrencyItem[]>(`${base}/CUR_C`);
        const rates: Record<string, number> = { KRW: 1 };
        const codes: string[] = [];
        for (const currency of list ?? []) {
            const code = currency.cdva || currency.cdvaDtl || '';
            if (!code || code === 'KRW') continue;
            codes.push(code);
            const rate = Number(currency.cdvaDtlC);
            if (Number.isFinite(rate)) rates[code] = rate;
        }
        previewRates.value = rates;
        currencyOptions.value = ['KRW', ...codes];
    } catch (error) {
        loadError.value = true;
        console.warn('[ProjectCurrencies] 통화 목록 조회 실패', error);
    } finally {
        loading.value = false;
    }
};
```

- [ ] **Step 3: 소비 화면 연결**

`useCostListPage`는 `continuationSearchError`를 반환하고 `info/cost/index.vue`의 AutoComplete 아래에 인라인 재시도 문구를 둔다. `useProjectCurrencies` 소비 화면은 KRW-only 축소 상태를 경고하고 `loadCurrencyOptions` 버튼을 제공한다. 멘션 소비 화면은 동일 props/emit을 전달한다.

- [ ] **Step 4: 테스트·커밋**

Run: `cd it_frontend && npm test -- --run tests/unit/composables/useMentionAutocomplete.test.ts tests/unit/composables/useProjectCurrencies.test.ts tests/unit/composables/useCostListPage.test.ts`

Expected: PASS.

```bash
git add it_frontend/app/composables/{useMentionAutocomplete,useProjectCurrencies,useCostListPage}.ts \
  it_frontend/app/components/MentionAutocomplete.vue it_frontend/app/pages/board \
  it_frontend/app/components/board/BoardCommentTree.vue it_frontend/app/pages/info/cost/index.vue \
  it_frontend/app/pages/info/projects/form.vue it_frontend/app/pages/project/bizplan \
  it_frontend/tests/unit
git commit -m "fix(frontend): 자동완성·통화 조회 실패와 빈 결과 분리 (ERR-07)"
```

---

### Task 11: ERR-07 예산기간·사업개요·PDF·인쇄 실패 상태

**Files:**
- Modify: `it_frontend/app/middleware/budget-period.ts`
- Modify: `it_frontend/app/pages/budget/index.vue`
- Modify: `it_frontend/app/pages/project/bizplan/[abusMngNo].vue`
- Modify: `it_frontend/app/pages/info/plan/[id].vue`
- Test: `it_frontend/tests/unit/middleware/budget-period.test.ts`
- Create: `it_frontend/tests/unit/pages/plan-output-error-state.test.ts`

**Interfaces:**
- Produces: `/budget?periodError=lookup`과 화면별 재시도 상태.

- [ ] **Step 1: 미들웨어 실패 사유 테스트 작성**

```ts
mockFetch.mockRejectedValue(new Error('기간 조회 실패'));
await (budgetPeriodMiddleware as MiddlewareHandler)();
expect(mockNavigateTo).toHaveBeenCalledWith({ path: '/budget', query: { periodError: 'lookup' } });
```

- [ ] **Step 2: 미들웨어와 예산 화면 구현**

```ts
} catch (error) {
    console.warn('[budget-period] 신청기간 조회 실패', error);
    return navigateTo({ path: '/budget', query: { periodError: 'lookup' } });
}
```

예산 화면은 query가 `lookup`이면 인라인 경고와 현재 경로 재시도 버튼을 표시한다.

- [ ] **Step 3: 사업개요 재시도 구현**

```ts
const projectLoadError = ref(false);
const refreshProject = async () => {
    projectLoadError.value = false;
    try { project.value = await $apiFetch<ProjectDetail>(url); }
    catch (error) {
        project.value = null;
        projectLoadError.value = true;
        console.warn('[bizplan] 사업 개요 조회 실패', error);
    }
};
```

개요 영역에 `다시 불러오기` 버튼을 연결한다.

- [ ] **Step 4: PDF 복구·인쇄 실패 사용자 피드백 구현**

`info/plan/[id].vue`의 layout 복구 catch는 error toast와 다음 안전 복구를 실행한다.

```ts
} catch (error) {
    console.warn('[downloadPdf] 레이아웃 복구 실패', error);
    document.querySelectorAll<HTMLElement>('.grid').forEach((grid) => grid.classList.add('xl:grid-cols-4'));
    toast.add({ severity: 'warn', summary: '화면 복구 확인', detail: 'PDF 생성 후 화면 배치를 복구했습니다. 이상이 계속되면 새로고침하세요.', life: 5000 });
}
```

인쇄 catch는 `cleanup()` 후 dialog를 다시 열고 toast를 표시한다.

```ts
} catch (error) {
    console.error('[doPrint] window.print 실패', error);
    cleanup();
    printDialogVisible.value = true;
    toast.add({ severity: 'error', summary: '인쇄 실패', detail: '인쇄 창을 열지 못했습니다. 다시 시도하세요.', life: 4000 });
}
```

- [ ] **Step 5: 테스트·커밋**

Run: `cd it_frontend && npm test -- --run tests/unit/middleware/budget-period.test.ts tests/unit/pages/plan-output-error-state.test.ts`

Expected: PASS.

```bash
git add it_frontend/app/middleware/budget-period.ts it_frontend/app/pages/budget/index.vue \
  it_frontend/app/pages/project/bizplan/[abusMngNo].vue it_frontend/app/pages/info/plan/[id].vue \
  it_frontend/tests/unit
git commit -m "fix(frontend): 예산기간·개요·출력 실패 재시도 노출 (ERR-07)"
```

---

### Task 12: ERR-07 과거버전 본문 실패를 store warning으로 전달

**Files:**
- Modify: `it_frontend/app/stores/review.ts`
- Modify: `it_frontend/app/composables/useReview.ts`
- Modify: `it_frontend/app/pages/info/documents/[id]/review.vue`
- Test: `it_frontend/tests/unit/stores/review.direct.test.ts`

**Interfaces:**
- Produces: `viewVersion(version): Promise<string[]>`, warning key `VERSION_CONTENT`.

- [ ] **Step 1: 실패·재시도 테스트 작성**

```ts
mockApiFetch.mockRejectedValueOnce(new Error('network'));
const warnings = await store.viewVersion('1.0');
expect(warnings).toContain('VERSION_CONTENT');
expect(store.currentContent).not.toBe('');
```

- [ ] **Step 2: store가 기존 내용을 보존하고 warning을 반환하도록 구현**

```ts
async function viewVersion(version: string | null): Promise<string[]> {
    const warnings: string[] = [];
    viewingVersion.value = version;
    if (!session.value) return warnings;
    const targetVersion = version ?? session.value.currentVersion;
    if (version) {
        const selectedVersion = session.value.versions.find((item) => item.version === version);
        if (selectedVersion && !selectedVersion.content) {
            try {
                const { $apiFetch } = useNuxtApp();
                const config = useRuntimeConfig();
                type SimpleFetch = (url: string) => Promise<{ redtConeInf: string }>;
                const document = await ($apiFetch as unknown as SimpleFetch)(
                    `${config.public.apiBase}/api/documents/${session.value.docMngNo}?version=${Number.parseFloat(version)}`,
                );
                selectedVersion.content = document.redtConeInf ?? '';
            } catch (error) {
                warnings.push('VERSION_CONTENT');
                viewingVersion.value = null;
                console.warn('[review] 과거 버전 본문 조회 실패', error);
            }
        }
    }
    try {
        const api = useReviewCommentApi();
        session.value.comments = await api.fetchComments(
            session.value.docMngNo,
            Number.parseFloat(targetVersion),
        );
    } catch (error) {
        warnings.push('COMMENTS');
        console.warn('[review] 버전 코멘트 재조회 실패', error);
    }
    return warnings;
}
```

실패 시 `ver.content`를 빈 문자열로 덮지 않고 기존 최신 본문을 유지한다.

- [ ] **Step 3: 호출 화면에서 인라인 경고·재조회 연결**

```ts
const versionWarnings = ref<string[]>([]);
const requestedVersion = ref<string | null>(null);
const onViewVersion = async (version: string | null) => {
    requestedVersion.value = version;
    versionWarnings.value = await viewVersion(version);
};
```

```vue
<Message v-if="versionWarnings.includes('VERSION_CONTENT')" severity="warn" :closable="false">
    선택한 버전의 본문을 불러오지 못했습니다.
    <Button label="다시 시도" text size="small" @click="onViewVersion(requestedVersion)" />
</Message>
```

- [ ] **Step 4: 테스트·커밋**

Run: `cd it_frontend && npm test -- --run tests/unit/stores/review.direct.test.ts`

Expected: PASS.

```bash
git add it_frontend/app/stores/review.ts it_frontend/app/composables/useReview.ts \
  it_frontend/app/pages/info/documents/[id]/review.vue it_frontend/tests/unit/stores/review.direct.test.ts
git commit -m "fix(review): 과거버전 본문 실패 warning·재시도 제공 (ERR-07)"
```

---

### Task 13: Phase 2 통합 검증·정책 문서·과제 이관

**Files:**
- Modify: `it_backend/CLAUDE.md`
- Modify: `it_backend/docs/guides/security/authentication-authorization.md`
- Modify: `it_backend/docs/guides/integrations/eai.md`
- Modify: `it_backend/docs/guides/integrations/notifications.md`
- Modify: `it_frontend/docs/guides/architecture/api-client.md`
- Create: `it_frontend/tests/e2e/security-error-remediation-phase2.spec.ts`
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:**
- Produces: 구현과 일치하는 운영·재시도 계약 및 완료 이력.

- [ ] **Step 1: E2E 핵심 흐름 작성**

```ts
test('조회 실패가 빈 상태가 아니라 재시도 가능한 경고로 보인다', async ({ page }) => {
    await page.route('**/api/ccodem/budget-period', (route) => route.abort());
    await page.goto('/info/projects/form');
    await expect(page).toHaveURL(/\/budget\?periodError=lookup/);
    await expect(page.getByText('신청 기간을 확인하지 못했습니다')).toBeVisible();
});
```

- [ ] **Step 2: 정책 문서 갱신**

다음 확정값을 문서에 그대로 기록한다.

- Refresh Token DB 저장은 SHA-256 HEX만 사용하고 원문은 저장하지 않는다.
- 운영에서 mock SSO, Bearer 폴백, Secure=false는 기동 실패한다.
- `eai.gwe.if-id`가 GWE IF_ID의 단일 설정이다.
- 알림 재시도는 60초/50건/최대 5회이며 `CINFMM` 상태 코드를 사용한다.
- enqueue 실패는 메트릭 탐지만 가능하고 원 업무는 롤백하지 않는다.

- [ ] **Step 3: 전체 검증**

Run: `cd it_backend && ./gradlew clean test`

Expected: BUILD SUCCESSFUL.

Run: `cd it_frontend && npm run format:check && npm run check && npm test`

Expected: 모든 명령 exit 0.

Run: `cd it_frontend && npm run test:e2e -- tests/e2e/security-error-remediation-phase2.spec.ts`

Expected: PASS.

- [ ] **Step 4: TASK 완료 이관 및 최종 커밋**

`TASK.md`에서 SEC-03·06·07, ERR-05·07을 제거하고 `TASK_DONE.md`에 구현 파일과 검증 명령을 함께 기록한다.

```bash
git add it_backend/CLAUDE.md it_backend/docs it_frontend/docs \
  it_frontend/tests/e2e/security-error-remediation-phase2.spec.ts TASK.md TASK_DONE.md
git commit -m "docs: Phase 2 보안·에러 처리 정책과 완료 이력 반영"
```

---

## 배포 순서와 롤백

1. DBA가 `V20260719_001`, `V20260719_002`를 적용하고 백필 건수·NULL 건수를 확인한다.
2. 백엔드를 배포한다. `notification.persist.failure`, `notification.dispatch.failure`을 즉시 관찰한다.
3. 프론트 정적 산출물을 배포한다.
4. 인증 이상 시 애플리케이션만 이전 버전으로 롤백할 수 없다. 원문 토큰이 이미 제거되므로 해시 조회 버전을 유지하고 SEC-06 이후 코드만 forward-fix한다.
5. 알림 재시도 폭주 시 `notification.retry.enabled=false`로 scheduler만 중지하고 PENDING/FAILED 행은 보존한다.

## 수동 검증 체크리스트

- Access Token 만료 후 `/api/auth/logout`이 Refresh 쿠키의 서버 패밀리를 삭제한다.
- DB `API_TOK_CONE`에 비NULL 값이 0건이고 `ECY_RNW_PUB_TOK_CONE`가 모두 비NULL이다.
- prod에서 세 위험 설정 각각으로 기동이 실패한다.
- SSO 로그인 전후 JSESSIONID가 다르며 검증 사번은 유지된다.
- EAI 실패 시 원 업무가 성공하고 CINFMM이 FAILED로 남은 뒤 재시도로 SENT가 된다.
- 재시도 5회 소진 행은 더 호출되지 않으며 메트릭으로 식별된다.
- ERR-07 열 경로에서 API/parse 실패가 정상 빈 상태와 다른 문구·재시도를 보여준다.
