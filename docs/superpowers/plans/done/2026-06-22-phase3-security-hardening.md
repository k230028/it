# Phase 3 — 보안 하드닝 Implementation Plan (T8–T11)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 보안 하드닝 4개 테마를 구현한다 — (T8) 구동 시 운영 필수 키 검증 확장, (T9) CORS·헤더·프록시 화이트리스트화 + 경로 정합 + 클라이언트 IP 파싱 정정, (T10) Refresh Token 회전(Access Token 블록리스트는 인프라 부재로 명시적 스파이크), (T11) PII 노출 차단(응답 권한 한정 + 로그 강등/제거 + EAI 가드).

**Architecture:** T8은 기존 `EnvironmentValidator`(@PostConstruct)에 운영 프로파일 전용 검증 메서드를 추가해 빈값/와일드카드를 기동 시 차단한다. T9는 `SecurityConfig`의 CORS 빈과 라우트 매처, `AuthController.getClientIp`를 수정한다. T10은 `AuthService.refreshAccessToken`에서 새 Refresh Token을 발급·교체(회전)한다. T11은 `UserService.getUser`에 본인/관리자 접근 제어를 추가(`OwnershipVerifier` 재사용)하고, `CouncilService`/`BoardCommentService`의 PII INFO 로그를 강등·제거하며, `EaiProperties`에 enabled+blank-url 가드를 둔다.

**Tech Stack:** Java 25, Spring Boot 4.1.0, Spring Security, JUnit 5 + AssertJ + Mockito. 빌드/테스트: `./gradlew`(루트 `it_backend`).

**선행 의존성 메모:** T11 Task 11a는 Phase 1 산출물 `com.kdb.it.common.system.security.OwnershipVerifier`(소유자-또는-관리자 검증, 실패 시 `AccessDeniedException`)와 `GlobalExceptionHandler`의 403 매핑을 재사용한다. 만약 OwnershipVerifier가 아직 머지되지 않았다면 Task 11a를 인라인 검증(`AccessDeniedException` 직접 throw)으로 대체하고 후속에 위임으로 전환한다 — Task 본문에 분기 메모를 남긴다.

---

## 조사 노트 (실제 코드 대조 결과 — 계획 정확도 근거)

- **T8 `EnvironmentValidator`**: 현재 `DB_PASSWORD`/`JWT_SECRET`만 검증(`common/system/EnvironmentValidator.java:36-48`). `gemini.api.key`·`eai.*`·`cors.allowed-origins`·SSO 운영값 검증 없음 → **OPEN, 확장 필요**.
- **T9 CORS allowedHeaders**: `configuration.setAllowedHeaders(List.of("*"))` (`config/SecurityConfig.java:201`) → **OPEN**.
- **T9 allowed-origins 기본값**: `@Value("${cors.allowed-origins:*}")` (`SecurityConfig.java:73`) — 코드 기본값이 `*`. 단, 베이스 `application.properties:69`는 `cors.allowed-origins=`(빈값)으로 두어 미설정 시 빈 오리진. 그래도 **코드 기본값 `*`는 제거 대상(OPEN)**.
- **T9 라우트 경로**: `.requestMatchers("/api/plan/**").hasRole("ADMIN")` (`SecurityConfig.java:140`) — 실제 컨트롤러는 `@RequestMapping("/api/plans")`(`domain/budget/plan/controller/PlanController.java:47`)라 **현재 URL 패턴 보호가 무력**(클래스 레벨 `@PreAuthorize`가 이중 방어 중이나 SecurityConfig 매처는 오발). **OPEN**.
- **T9 getClientIp**: `AuthController.getClientIp`(`common/system/controller/AuthController.java:254-274`)는 `X-Forwarded-For`를 **무조건 신뢰**하고 멀티 IP를 분리하지 않음(`split(",")[0]` 없음). 신뢰 프록시 allowlist 없음. **OPEN**.
- **T10 Refresh Rotation**: `AuthService.refreshAccessToken`(`common/system/service/AuthService.java:206-236`)은 새 Access Token만 발급하고 **Refresh Token을 회전하지 않음**(기존 토큰 그대로 유지). **OPEN**. Access Token Blocklist용 Redis/캐시 인프라는 코드베이스에 **부재** → **스파이크로 분리**.
- **T11 UserDto.DetailResponse 권한**: `UserController.getUser`(`common/iam/controller/UserController.java:70-74`) → `UserService.getUser`(`common/iam/service/UserService.java:69-76`)는 **인증만 요구하고 본인/관리자 제한 없음** → 임의 인증 사용자가 타인 휴대폰/내선/이메일 PII 조회 가능. **OPEN**.
- **T11 eno INFO 로그**: 실제 위치는 `domain/council/service/CouncilService.java:112`(`[CouncilList] eno=...`) 1건. (스펙의 "eno INFO 로그"는 이 건을 가리킴; `domain` 전역 grep 결과 추가 INFO eno 로그 없음.) **OPEN**.
- **T11 BoardCommentService 멘션 로그**: `BoardCommentService.publishMentionNotifications`(`common/board/service/BoardCommentService.java:251,265,267,276` + 메서드 내 1건 추가 = 총 5건 `[멘션 진단]` INFO, FIXME 등록됨 `:242`). **OPEN**.
- **T11 EaiService `e.getMessage()`**: `infra/eai/service/EaiService.java:61,82`에서 `e.getMessage()`를 결과 메시지에 직접 노출. 단 예외는 전파하지 않고 `EaiResult.failure(...)`로만 표현하며 로그도 warn. **부분적 — 안전 추출 헬퍼로 정돈(메시지 null/길이 가드)**. 위험도 LOW.
- **T11 EaiProperties enabled+blank-url 가드**: `EaiProperties`(`infra/eai/config/EaiProperties.java:36-49`)는 charset/timeout/식별자만 보정하고 **`enabled=true && url 공백` 가드 없음** → 운영에서 enabled=true인데 URL 미주입 시 런타임에야 발견. **OPEN**. (T8에서 EAI_URL 구동 검증을 추가하면 중복 방어 — T8과 T11에서 각각 다른 계층 방어로 둘 다 둔다.)

> **이미 잘 되어 있는 부분(추가 작업 불필요):** `application-prod.properties`는 이미 모든 비밀값을 기본값 없이(`${DB_PASSWORD}`, `${JWT_SECRET}`, `${EAI_URL}`) 두고, `app.cookie.secure=true`/`app.dev.user-switch.enabled=false`/`app.sso.allow-direct-eno=false`를 운영 고정값으로 둠. T8은 "프로파일 파일이 올바른지"가 아니라 "런타임 해석값이 빈값/와일드카드면 기동 차단"을 보강하는 것이 목적이다.

---

## File Structure

| 파일 | 책임 | 작업 |
| --- | --- | --- |
| `common/system/EnvironmentValidator.java` | 운영 필수 키(gemini/eai/cors/sso) 빈값·와일드카드 검증 추가 | Modify |
| `test/.../common/system/EnvironmentValidatorTest.java` | 신규 검증 분기 테스트 추가 | Modify |
| `config/SecurityConfig.java` | allowedHeaders 명시화, allowed-origins 코드 기본값 제거, `/api/plan/**`→`/api/plans/**` | Modify |
| `test/.../config/SecurityConfigCorsTest.java` | CORS 설정 단위 테스트(헤더/오리진) | Create |
| `common/system/controller/ClientIpResolver.java` | 멀티 IP 분리 + 신뢰 프록시 게이트 정적 유틸 | Create |
| `common/system/controller/AuthController.java` | `getClientIp`를 `ClientIpResolver` 위임으로 교체 | Modify |
| `test/.../common/system/controller/ClientIpResolverTest.java` | IP 파싱 단위 테스트 | Create |
| `common/system/service/AuthService.java` | `refreshAccessToken` Refresh Token 회전 | Modify |
| `common/system/dto/AuthDto.java` | `RefreshResponse.refreshToken` 필드 추가 | Modify |
| `test/.../common/system/service/AuthServiceTest.java` | 회전(rotation) 검증 테스트 추가/수정 | Modify |
| `common/iam/service/UserService.java` | `getUser`에 본인/관리자 접근 제어 추가 | Modify |
| `common/iam/controller/UserController.java` | `getUser`에 `@AuthenticationPrincipal` 전달 | Modify |
| `test/.../common/iam/service/UserServiceTest.java` | 비본인·비관리자 → 403 테스트 | Create/Modify |
| `domain/council/service/CouncilService.java` | `[CouncilList] eno=...` INFO → DEBUG 강등 | Modify |
| `common/board/service/BoardCommentService.java` | `[멘션 진단]` INFO 로그 5건 제거 | Modify |
| `infra/eai/config/EaiProperties.java` | `enabled=true && url blank` 가드 추가 | Modify |
| `test/.../infra/eai/config/EaiPropertiesTest.java` | enabled+blank-url → 예외 테스트 | Create/Modify |
| `infra/eai/service/EaiService.java` | `e.getMessage()` 안전 추출 헬퍼 | Modify |
| `docs/superpowers/plans/2026-06-22-phase3-security-hardening-spike-blocklist.md` | (T10 스파이크) Access Token Blocklist 설계 메모 | Create |

모든 메인 경로 접두사: `it_backend/src/main/java/com/kdb/it/` (테스트는 `it_backend/src/test/java/com/kdb/it/`).

---

## Task 8: 구동 시 환경검증 확장 (EnvironmentValidator)

**배경:** 현재 `EnvironmentValidator`는 `DB_PASSWORD`/`JWT_SECRET`만 검사한다. 운영(`prod`) 프로파일에서 `gemini.api.key`·`eai.url`(eai.enabled=true일 때)·`cors.allowed-origins`(와일드카드 금지)·SSO 운영값(`app.sso.allow-direct-eno` false 고정, `app.frontend-url` 비공백)이 누락/오설정이면 보안 사고로 이어지므로 기동 시 차단한다. 운영 외 프로파일(local/dev)에서는 개발 편의를 위해 신규 검증을 적용하지 않는다(프로파일 게이트).

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java`

- [ ] **Step 1: 실패 테스트 추가 (RED)**

기존 4건 테스트는 `@Mock Environment`로 베이스 검증을 다룬다. 신규 검증은 **운영 프로파일에서만** 동작해야 하므로 `MockEnvironment`로 활성 프로파일·프로퍼티를 한 번에 구성한다(spring-test에 포함). 기존 테스트는 그대로 두고 아래를 클래스 끝에 추가한다. import 추가:

```java
import org.springframework.mock.env.MockEnvironment;
```

```java
    // ── 운영 프로파일 전용 키 검증 (T8) ───────────────────────────────────

    private MockEnvironment prodEnvWithAllRequired() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");
        env.setProperty("spring.datasource.password", "pw");
        env.setProperty("jwt.secret", "super-secret-key-at-least-256-bits-long-xxxxxxxxxxxxxxxxxxxxxxxx");
        env.setProperty("gemini.api.key", "gk-real-key");
        env.setProperty("eai.enabled", "true");
        env.setProperty("eai.url", "http://eai.internal/std");
        env.setProperty("cors.allowed-origins", "https://it.kdb.co.kr");
        env.setProperty("app.sso.allow-direct-eno", "false");
        env.setProperty("app.frontend-url", "https://it.kdb.co.kr");
        return env;
    }

    @Test
    @DisplayName("운영 프로파일에서 모든 운영 필수 키가 채워지면 예외 없음")
    void validate_prodAllKeysSet_noException() {
        EnvironmentValidator validator = new EnvironmentValidator(prodEnvWithAllRequired());
        assertThatCode(validator::validate).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("운영 프로파일에서 gemini.api.key 빈값이면 기동 차단")
    void validate_prodBlankGeminiKey_throws() {
        MockEnvironment env = prodEnvWithAllRequired();
        env.setProperty("gemini.api.key", "");
        EnvironmentValidator validator = new EnvironmentValidator(env);
        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("GEMINI_API_KEY");
    }

    @Test
    @DisplayName("운영 프로파일에서 eai.enabled=true인데 eai.url 빈값이면 기동 차단")
    void validate_prodEaiEnabledBlankUrl_throws() {
        MockEnvironment env = prodEnvWithAllRequired();
        env.setProperty("eai.url", "");
        EnvironmentValidator validator = new EnvironmentValidator(env);
        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("EAI_URL");
    }

    @Test
    @DisplayName("운영 프로파일에서 eai.enabled=false면 eai.url 빈값이어도 통과")
    void validate_prodEaiDisabledBlankUrl_noException() {
        MockEnvironment env = prodEnvWithAllRequired();
        env.setProperty("eai.enabled", "false");
        env.setProperty("eai.url", "");
        EnvironmentValidator validator = new EnvironmentValidator(env);
        assertThatCode(validator::validate).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("운영 프로파일에서 cors.allowed-origins가 와일드카드(*)면 기동 차단")
    void validate_prodCorsWildcard_throws() {
        MockEnvironment env = prodEnvWithAllRequired();
        env.setProperty("cors.allowed-origins", "*");
        EnvironmentValidator validator = new EnvironmentValidator(env);
        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("cors.allowed-origins");
    }

    @Test
    @DisplayName("운영 프로파일에서 cors.allowed-origins 빈값이면 기동 차단")
    void validate_prodCorsBlank_throws() {
        MockEnvironment env = prodEnvWithAllRequired();
        env.setProperty("cors.allowed-origins", "");
        EnvironmentValidator validator = new EnvironmentValidator(env);
        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("cors.allowed-origins");
    }

    @Test
    @DisplayName("운영 프로파일에서 app.sso.allow-direct-eno=true면 기동 차단")
    void validate_prodSsoDirectEnoTrue_throws() {
        MockEnvironment env = prodEnvWithAllRequired();
        env.setProperty("app.sso.allow-direct-eno", "true");
        EnvironmentValidator validator = new EnvironmentValidator(env);
        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("allow-direct-eno");
    }

    @Test
    @DisplayName("운영 프로파일에서 app.frontend-url 빈값이면 기동 차단")
    void validate_prodBlankFrontendUrl_throws() {
        MockEnvironment env = prodEnvWithAllRequired();
        env.setProperty("app.frontend-url", "");
        EnvironmentValidator validator = new EnvironmentValidator(env);
        assertThatThrownBy(validator::validate)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("app.frontend-url");
    }

    @Test
    @DisplayName("비운영 프로파일(local-ext)에서는 운영 전용 키가 비어도 통과")
    void validate_nonProdProfile_skipsProdKeys() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("local-ext");
        env.setProperty("spring.datasource.password", "pw");
        env.setProperty("jwt.secret", "super-secret-key-at-least-256-bits-long-xxxxxxxxxxxxxxxxxxxxxxxx");
        // gemini/eai/cors/sso 미설정
        EnvironmentValidator validator = new EnvironmentValidator(env);
        assertThatCode(validator::validate).doesNotThrowAnyException();
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.EnvironmentValidatorTest"`
Expected: FAIL — 운영 전용 검증 미구현이라 빈 gemini/eai/cors/sso에도 예외가 발생하지 않음(신규 테스트 다수 RED).

- [ ] **Step 3: 검증 확장 구현 (GREEN)**

`EnvironmentValidator.java`의 `validate()`를 교체하고 헬퍼를 추가한다. 교체 전:

```java
    @PostConstruct
    public void validate() {
        checkRequired("spring.datasource.password", "DB_PASSWORD");
        checkRequired("jwt.secret", "JWT_SECRET");
    }
```

교체 후:

```java
    @PostConstruct
    public void validate() {
        // 전 프로파일 공통: 비밀값 빈값 차단
        checkRequired("spring.datasource.password", "DB_PASSWORD");
        checkRequired("jwt.secret", "JWT_SECRET");

        // 운영 프로파일에서만: 운영 필수 키 빈값/와일드카드/위험 토글 차단
        if (isProdProfile()) {
            validateProdKeys();
        }
    }

    /** 활성 프로파일에 {@code prod}가 포함되어 있으면 운영 검증을 수행합니다. */
    private boolean isProdProfile() {
        for (String profile : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(profile)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 운영 전용 필수 키 검증 — 빈값/와일드카드/위험 토글을 기동 시 차단합니다.
     *
     * <ul>
     *   <li>{@code gemini.api.key} → {@code GEMINI_API_KEY} 비공백</li>
     *   <li>{@code eai.enabled=true}이면 {@code eai.url} → {@code EAI_URL} 비공백</li>
     *   <li>{@code cors.allowed-origins} 비공백 + 와일드카드({@code *}) 금지</li>
     *   <li>{@code app.sso.allow-direct-eno} 운영 false 고정</li>
     *   <li>{@code app.frontend-url} 비공백</li>
     * </ul>
     */
    private void validateProdKeys() {
        checkRequired("gemini.api.key", "GEMINI_API_KEY");

        boolean eaiEnabled = Boolean.parseBoolean(environment.getProperty("eai.enabled", "false"));
        if (eaiEnabled) {
            checkRequired("eai.url", "EAI_URL");
        }

        String corsOrigins = environment.getProperty("cors.allowed-origins");
        if (corsOrigins == null || corsOrigins.isBlank()) {
            throw new IllegalStateException(
                    "운영 필수 키 미설정: cors.allowed-origins — 운영에서는 명시적 오리진이 필요합니다.");
        }
        if (corsOrigins.contains("*")) {
            throw new IllegalStateException(
                    "운영 보안 위반: cors.allowed-origins 와일드카드(*) 금지 — 실제 오리진을 나열하세요. (현재값=" + corsOrigins + ")");
        }

        boolean allowDirectEno = Boolean.parseBoolean(environment.getProperty("app.sso.allow-direct-eno", "false"));
        if (allowDirectEno) {
            throw new IllegalStateException(
                    "운영 보안 위반: app.sso.allow-direct-eno=true 금지 — SSO 우회 로그인 경로입니다.");
        }

        String frontendUrl = environment.getProperty("app.frontend-url");
        if (frontendUrl == null || frontendUrl.isBlank()) {
            throw new IllegalStateException(
                    "운영 필수 키 미설정: app.frontend-url — SSO 완료 리다이렉트 대상이 필요합니다.");
        }
    }
```

클래스 JavaDoc의 "검증 대상" 목록에도 운영 전용 키 4종을 한 줄로 추가한다(주석 현행화). 기존 import는 그대로 유지.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.EnvironmentValidatorTest"`
Expected: PASS (기존 4 + 신규 9 테스트 전체 통과).

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/EnvironmentValidator.java src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java && git commit -m "feat: validate prod-required env keys (gemini/eai/cors/sso) at startup"
```

---

## Task 9: CORS·헤더·프록시 정비 (SecurityConfig + getClientIp)

각 하위 단계는 독립 커밋 가능하나 한 Task로 묶어 검증한다.

### Task 9a: CORS allowedHeaders 명시화 + allowed-origins 코드 기본값 제거

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`
- Test: `it_backend/src/test/java/com/kdb/it/config/SecurityConfigCorsTest.java` (Create)

**배경:** `setAllowedHeaders(List.of("*"))`는 운영에서 불필요하게 모든 요청 헤더를 허용한다. `Content-Type`, `Authorization`, `X-Requested-With`만 명시한다. 또한 `@Value("${cors.allowed-origins:*}")`의 코드 기본값 `*`를 제거해(`:` 뒤 빈값) 프로퍼티 미설정 시 와일드카드로 구동되는 사고 경로를 차단한다. (베이스 `application.properties`는 이미 빈값이라 동작 변화는 "환경변수 누락 시 빈 오리진=거부"로 안전해진다.)

- [ ] **Step 1: 실패 테스트 작성 (RED)**

Create `it_backend/src/test/java/com/kdb/it/config/SecurityConfigCorsTest.java`:

```java
package com.kdb.it.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.system.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * SecurityConfig CORS 설정 단위 테스트 (T9a) — 허용 헤더 명시화/오리진 검증.
 */
class SecurityConfigCorsTest {

    private CorsConfiguration corsFor(String origins) {
        SecurityConfig config = new SecurityConfig(Mockito.mock(JwtAuthenticationFilter.class));
        ReflectionTestUtils.setField(config, "allowedOrigins", origins);
        UrlBasedCorsConfigurationSource source =
                (UrlBasedCorsConfigurationSource) config.corsConfigurationSource();
        // "/**" 매핑을 직접 조회 — 요청 mock보다 결정적
        return source.getCorsConfigurations().get("/**");
    }

    @Test
    @DisplayName("allowedHeaders는 와일드카드(*)가 아니라 명시 헤더 목록이어야 한다")
    void allowedHeaders_명시목록() {
        CorsConfiguration cors = corsFor("https://it.kdb.co.kr");
        assertThat(cors.getAllowedHeaders())
                .containsExactlyInAnyOrder("Content-Type", "Authorization", "X-Requested-With");
        assertThat(cors.getAllowedHeaders()).doesNotContain("*");
    }

    @Test
    @DisplayName("allowCredentials=true 와 함께 명시 오리진을 허용한다")
    void allowedOrigins_명시오리진() {
        CorsConfiguration cors = corsFor("https://it.kdb.co.kr");
        assertThat(cors.getAllowCredentials()).isTrue();
        assertThat(cors.getAllowedOrigins()).containsExactly("https://it.kdb.co.kr");
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.config.SecurityConfigCorsTest"`
Expected: FAIL — 현재 `allowedHeaders`가 `["*"]`라 `containsExactlyInAnyOrder` 불일치.

- [ ] **Step 3: 구현 (GREEN)**

`SecurityConfig.java:73` 수정 — 코드 기본값 `*` 제거:

```java
        @Value("${cors.allowed-origins:}")
        private String allowedOrigins;
```

`SecurityConfig.java:201` 수정 — 명시 헤더:

```java
                // 허용 헤더 명시화: 운영에서 필요한 표준 헤더만 허용 (와일드카드 제거)
                configuration.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-Requested-With"));
```

JavaDoc의 "허용 헤더: 전체 (`*`)" 문구도 "허용 헤더: 명시 목록(Content-Type/Authorization/X-Requested-With)"으로 갱신.

- [ ] **Step 4: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.config.SecurityConfigCorsTest"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/config/SecurityConfig.java src/test/java/com/kdb/it/config/SecurityConfigCorsTest.java && git commit -m "feat: explicit CORS allowedHeaders and drop wildcard origin default"
```

### Task 9b: 라우트 경로 정합 `/api/plan/**` → `/api/plans/**`

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java:140`

**배경:** 실제 컨트롤러는 `/api/plans`인데 SecurityConfig 매처는 `/api/plan/**`라 URL 패턴 ADMIN 보호가 적용되지 않는다(클래스 레벨 `@PreAuthorize`가 방어 중이나 이중 방어 의도가 무력). 경로를 정합한다. 기존 `PlanControllerTest`(`it_backend/src/test/java/com/kdb/it/domain/budget/plan/controller/PlanControllerTest.java`)가 `/api/plans` 인증/권한을 이미 커버하므로 회귀 테스트로 활용한다.

- [ ] **Step 1: 구현**

`SecurityConfig.java:140` 수정:

```java
                                                // 정보기술부문계획 — 관리자 전용 (컨트롤러 실제 경로 /api/plans 와 정합)
                                                .requestMatchers("/api/plans/**").hasRole("ADMIN")
```

- [ ] **Step 2: 회귀 테스트 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.plan.controller.PlanControllerTest"`
Expected: PASS (기존 `/api/plans` 401/200/201/204 테스트 그대로 통과).

- [ ] **Step 3: 문서 동기화**

`it_backend/CLAUDE.md`의 `/api/plan/**` 불일치 추적 문구(2곳: §"SecurityConfig URL 패턴 보호 대상", §"공개/비공개 엔드포인트")와 `it_backend/README.md:693`의 "구 경로 `/api/plan/**`가 남아 있어 정비 필요" 문구를 `/api/plans/**` 정합 완료로 갱신.

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/config/SecurityConfig.java CLAUDE.md README.md && git commit -m "fix: align security route matcher to /api/plans/**"
```

### Task 9c: getClientIp 멀티 IP 분리 + 신뢰 프록시 allowlist

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/controller/ClientIpResolver.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java:254-274`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/controller/ClientIpResolverTest.java` (Create)

**배경:** `X-Forwarded-For`에 여러 IP가 콤마로 들어오면 현재 코드는 `"1.2.3.4, 5.6.7.8"` 전체 문자열을 IP로 사용한다. 또한 헤더를 무조건 신뢰해 IP 위조가 가능하다. (1) 첫 번째 IP만 사용(`split(",")[0].trim()`), (2) 직접 연결(`request.getRemoteAddr()`)이 **신뢰 프록시 allowlist**에 있을 때만 XFF 헤더를 신뢰하도록 정정한다. allowlist는 프로퍼티(`app.trusted-proxies`, CSV, 기본 빈값)로 주입한다.

- [ ] **Step 1: 실패 테스트 작성 (RED)**

`getClientIp`는 현재 `AuthController` private 메서드라 단위 테스트가 어렵다. 순수 정적 유틸 `ClientIpResolver`로 추출하고 컨트롤러는 위임한다. Create `it_backend/src/test/java/com/kdb/it/common/system/controller/ClientIpResolverTest.java`:

```java
package com.kdb.it.common.system.controller;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * ClientIpResolver 단위 테스트 (T9c) — 멀티 IP 분리 + 신뢰 프록시 게이트.
 */
class ClientIpResolverTest {

    private HttpServletRequest req(String remoteAddr, String xff) {
        HttpServletRequest r = Mockito.mock(HttpServletRequest.class);
        Mockito.when(r.getRemoteAddr()).thenReturn(remoteAddr);
        Mockito.when(r.getHeader("X-Forwarded-For")).thenReturn(xff);
        return r;
    }

    @Test
    @DisplayName("신뢰 프록시에서 온 멀티 IP XFF는 첫 번째 IP만 반환한다")
    void trustedProxy_multiIp_firstOnly() {
        HttpServletRequest r = req("10.0.0.1", "203.0.113.7, 10.0.0.1");
        assertThat(ClientIpResolver.resolve(r, Set.of("10.0.0.1"))).isEqualTo("203.0.113.7");
    }

    @Test
    @DisplayName("신뢰되지 않은 직접 연결이면 XFF를 무시하고 remoteAddr을 반환한다")
    void untrustedProxy_ignoresXff() {
        HttpServletRequest r = req("198.51.100.9", "1.1.1.1");
        assertThat(ClientIpResolver.resolve(r, Set.of("10.0.0.1"))).isEqualTo("198.51.100.9");
    }

    @Test
    @DisplayName("allowlist가 비어 있으면(미설정) remoteAddr을 그대로 사용한다")
    void emptyAllowlist_usesRemoteAddr() {
        HttpServletRequest r = req("203.0.113.50", "1.1.1.1, 2.2.2.2");
        assertThat(ClientIpResolver.resolve(r, Set.of())).isEqualTo("203.0.113.50");
    }

    @Test
    @DisplayName("XFF가 없으면 remoteAddr을 반환한다")
    void noXff_remoteAddr() {
        HttpServletRequest r = req("203.0.113.77", null);
        assertThat(ClientIpResolver.resolve(r, Set.of("203.0.113.77"))).isEqualTo("203.0.113.77");
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.controller.ClientIpResolverTest"`
Expected: 컴파일 실패 — `ClientIpResolver` 심볼 없음.

- [ ] **Step 3: 유틸 구현 + 컨트롤러 위임 (GREEN)**

Create `it_backend/src/main/java/com/kdb/it/common/system/controller/ClientIpResolver.java`:

```java
package com.kdb.it.common.system.controller;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;

/**
 * 클라이언트 IP 추출 유틸 — 멀티 IP 분리 + 신뢰 프록시 게이트.
 *
 * <p>{@code X-Forwarded-For}는 임의 위조가 가능하므로, 직접 연결한 프록시
 * ({@link HttpServletRequest#getRemoteAddr()})가 신뢰 allowlist에 포함된 경우에만
 * 헤더를 신뢰합니다. 멀티 IP({@code "client, proxy1, proxy2"})는 최좌측(원 클라이언트)만 사용합니다.</p>
 */
public final class ClientIpResolver {

    private ClientIpResolver() {
    }

    /**
     * 신뢰 프록시 게이트를 적용해 클라이언트 IP를 추출합니다.
     *
     * @param request        HTTP 요청
     * @param trustedProxies 신뢰하는 직접 연결 프록시 IP 집합. 비어 있으면 XFF를 신뢰하지 않음.
     * @return 원 클라이언트 IP(신뢰 시 XFF 최좌측, 아니면 remoteAddr)
     */
    public static String resolve(HttpServletRequest request, Set<String> trustedProxies) {
        String remoteAddr = request.getRemoteAddr();
        if (trustedProxies != null && trustedProxies.contains(remoteAddr)) {
            String xff = request.getHeader("X-Forwarded-For");
            if (xff != null && !xff.isBlank() && !"unknown".equalsIgnoreCase(xff)) {
                String first = xff.split(",")[0].trim(); // 최좌측(원 클라이언트)
                if (!first.isEmpty()) {
                    return first;
                }
            }
        }
        return remoteAddr;
    }
}
```

`AuthController.java` 수정 — 신뢰 프록시 프로퍼티 주입 필드 추가(클래스 상단 필드 영역):

```java
    /** 신뢰하는 역방향 프록시 IP 목록(CSV). 운영 Nginx 등. 비어 있으면 XFF 미신뢰. */
    @org.springframework.beans.factory.annotation.Value("${app.trusted-proxies:}")
    private String trustedProxiesCsv;
```

`getClientIp(HttpServletRequest)` 본문(`AuthController.java:254-274`)을 위임으로 교체:

```java
    private String getClientIp(HttpServletRequest request) {
        java.util.Set<String> trusted = (trustedProxiesCsv == null || trustedProxiesCsv.isBlank())
                ? java.util.Set.of()
                : java.util.Arrays.stream(trustedProxiesCsv.split(","))
                        .map(String::trim).filter(s -> !s.isEmpty())
                        .collect(java.util.stream.Collectors.toUnmodifiableSet());
        return ClientIpResolver.resolve(request, trusted);
    }
```

(메서드 JavaDoc은 신뢰 프록시 게이트 동작으로 갱신.) 프로퍼티 문서화: 베이스 `application.properties`에 `app.trusted-proxies=`(빈값) 한 줄, `application-prod.properties`에 `app.trusted-proxies=${APP_TRUSTED_PROXIES:}`(운영 Nginx IP 주입용) 추가.

- [ ] **Step 4: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.controller.ClientIpResolverTest"`
Expected: PASS (4 tests).

- [ ] **Step 5: 영향 테스트 + 커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.controller.*"`
Expected: PASS (AuthController 관련 기존 테스트 회귀 없음).

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/controller/ClientIpResolver.java src/main/java/com/kdb/it/common/system/controller/AuthController.java src/test/java/com/kdb/it/common/system/controller/ClientIpResolverTest.java src/main/resources/application.properties src/main/resources/application-prod.properties && git commit -m "feat: trusted-proxy gated client IP resolution with multi-IP split"
```

---

## Task 10: 토큰 수명주기 — Refresh Token Rotation

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java:206-236`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/dto/AuthDto.java` (`RefreshResponse`)
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java` (refresh 핸들러)
- Test: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`

**배경:** 현재 `refreshAccessToken`은 새 Access Token만 발급하고 제출된 Refresh Token을 그대로 둔다(회전 없음). 회전을 적용하면 탈취된 Refresh Token의 재사용 위험을 줄인다. 회전: (1) 기존 토큰 `delete`, (2) 새 Refresh Token 생성·저장, (3) 응답 DTO에 새 Refresh Token 포함 → 컨트롤러가 쿠키 재설정.

> **Access Token Blocklist는 본 Task에서 구현하지 않는다.** 코드베이스에 Redis/분산 캐시 인프라가 없어(Spring Cache는 `@Cacheable` 로컬만, 분산 블록리스트 부재) 단기 Access Token(15분) 즉시 무효화는 별도 인프라 도입이 선행되어야 한다. Task 10b(스파이크)로 분리한다.

### Task 10a: Refresh Token 회전 구현

- [ ] **Step 1: 기존 테스트 수정 + 회전 테스트 추가 (RED)**

`refreshTokenValidityMs`(`@Value` 주입 필드)가 회전 시 endDtm 계산에 쓰이므로 테스트에 주입이 필요하다. `AuthServiceTest`에 `@BeforeEach`를 추가한다. import 추가:

```java
import org.springframework.test.util.ReflectionTestUtils;
```

클래스에 추가:

```java
        @org.junit.jupiter.api.BeforeEach
        void setUp() {
                ReflectionTestUtils.setField(authService, "refreshTokenValidityMs", 604_800_000L);
        }
```

기존 `refreshAccessToken_유효한토큰_새AccessToken반환`(라인 216-239)에는 회전으로 새 refresh 토큰 발급 호출이 추가되므로 stub 한 줄을 더한다:

```java
                given(jwtUtil.generateRefreshToken("10001")).willReturn("new-refresh-token");
```

신규 테스트 추가(Refresh Token 갱신 섹션 끝):

```java
        @Test
        @DisplayName("refreshAccessToken - 회전: 기존 Refresh Token 삭제 후 새 토큰 저장 및 응답 포함")
        void refreshAccessToken_회전_새RefreshToken발급() {
                // given
                String oldRefresh = "old-refresh-token";
                Crtokm stored = Crtokm.builder()
                                .tokCone(oldRefresh).eno("10001")
                                .endDtm(LocalDateTime.now().plusDays(7))
                                .build();
                given(jwtUtil.validateToken(oldRefresh)).willReturn(true);
                given(refreshTokenRepository.findByTokCone(oldRefresh)).willReturn(Optional.of(stored));
                given(userRepository.findByEno("10001")).willReturn(Optional.of(
                                CuserI.builder().eno("10001").usrNm("홍길동").bbrC("BBR001").delYn("N").build()));
                given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N"))
                                .willReturn(Collections.emptyList());
                given(jwtUtil.generateAccessToken(anyString(), anyList(), any())).willReturn("new-access-token");
                given(jwtUtil.generateRefreshToken("10001")).willReturn("new-refresh-token");

                // when
                AuthDto.RefreshResponse response = authService.refreshAccessToken(oldRefresh);

                // then
                assertThat(response.getAccessToken()).isEqualTo("new-access-token");
                assertThat(response.getRefreshToken()).isEqualTo("new-refresh-token");
                verify(refreshTokenRepository, times(1)).delete(stored);
                verify(refreshTokenRepository, times(1)).save(any(Crtokm.class));
        }
```

> 실행자 메모: 다른 `refreshAccessToken_*` 테스트(만료/DB없음/사용자없음)는 회전 코드(delete 이후)에 도달하기 전에 예외로 종료되므로 추가 stub이 불필요하다 — `lenient()` 불필요.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"`
Expected: FAIL — `response.getRefreshToken()` 메서드 부재(컴파일) 및 회전 미구현(delete/save 미호출).

- [ ] **Step 3: DTO 필드 추가 + 회전 구현 (GREEN)**

`AuthDto.RefreshResponse`(파일 `it_backend/src/main/java/com/kdb/it/common/system/dto/AuthDto.java`)에 `private String refreshToken;` 필드 추가 + `@Schema(description="회전된 Refresh Token")` (기존 `@Builder`/`@Getter` 패턴 유지).

`AuthService.refreshAccessToken`(`:223-235` 구간, 새 Access Token 생성 이후)을 아래로 교체:

```java
        // Refresh 시에도 최신 자격등급 반영 (자격등급 변경 시 즉시 적용)
        String eno = refreshToken.getEno();
        CuserI user = userRepository.findByEno(eno)
                .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        List<String> athIds = loadAthIds(eno);

        // 새로운 Access Token 생성 (최신 자격등급 및 부서코드 반영)
        String newAccessToken = jwtUtil.generateAccessToken(eno, athIds, user.getBbrC());

        // Refresh Token 회전: 제출된 토큰 폐기 후 신규 발급·저장 (탈취 재사용 방어)
        refreshTokenRepository.delete(refreshToken);
        String newRefreshTokenValue = jwtUtil.generateRefreshToken(eno);
        Crtokm rotated = Crtokm.builder()
                .tokCone(newRefreshTokenValue)
                .eno(eno)
                .endDtm(LocalDateTime.now().plus(Duration.ofMillis(refreshTokenValidityMs)))
                .build();
        refreshTokenRepository.save(rotated);

        return AuthDto.RefreshResponse.builder()
                .accessToken(newAccessToken)            // 새 Access Token
                .refreshToken(newRefreshTokenValue)     // 회전된 Refresh Token (컨트롤러가 쿠키 재설정)
                .build();
```

- [ ] **Step 4: 컨트롤러 Refresh 쿠키 재설정**

`AuthController`의 `/api/auth/refresh` 핸들러가 회전된 `refreshToken`으로 Refresh 쿠키를 재설정하도록 수정한다. 실행자 메모: 현재 refresh 핸들러를 읽고, 응답 DTO `getRefreshToken()`이 non-null이면 **로그인 시 Refresh 쿠키 설정 코드와 동일 패턴**(`CookieUtil`, `path="/api/auth"`, maxAge 7일, httpOnly, sameSite=Lax, secure=`app.cookie.secure`)으로 쿠키를 재설정한다. 기존 refresh 컨트롤러 테스트가 있으면 새 쿠키 검증을 추가한다.

- [ ] **Step 5: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"`
Expected: PASS (회전 테스트 포함 전체 통과).

추가 회귀:
Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.controller.*"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/service/AuthService.java src/main/java/com/kdb/it/common/system/dto/AuthDto.java src/main/java/com/kdb/it/common/system/controller/AuthController.java src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java && git commit -m "feat: rotate refresh token on access-token refresh"
```

### Task 10b (스파이크, 선택): Access Token Blocklist 설계 메모

**Files:**
- Create: `docs/superpowers/plans/2026-06-22-phase3-security-hardening-spike-blocklist.md`

- [ ] **Step 1: 스파이크 문서 작성 (코드 변경 없음)**

다음을 1페이지로 정리해 의사결정 게이트에 올린다 — 본 작업은 구현이 아니라 **결정 산출물**이다:
- 현황: 분산 캐시/Redis 부재. Access Token 15분 단기. 즉시 무효화 미지원.
- 옵션 A(도입 안 함): 단기 만료 + Refresh 회전(Task 10a)으로 사실상 충분 — 추가 인프라 비용 0.
- 옵션 B(DB 블록리스트): `jti` 클레임 + 폐기 테이블 + 필터 단계 조회. 매 요청 DB 조회 비용.
- 옵션 C(Redis 블록리스트): TTL=토큰 잔여수명. 인프라 도입 필요.
- 권고: 운영 트래픽/위협 모델 확정 전까지 **옵션 A 유지**, 강제 로그아웃 요건 발생 시 옵션 C 채택.
- TASK.md "토큰 수명주기" 항목을 "Refresh 회전 완료 / Blocklist는 스파이크 결정 대기"로 갱신.

- [ ] **Step 2: 커밋**

```bash
cd /c/it && git add docs/superpowers/plans/2026-06-22-phase3-security-hardening-spike-blocklist.md && git commit -m "docs: spike note for access-token blocklist decision (deferred)"
```

---

## Task 11: PII 노출 차단

각 하위 단계는 독립 커밋 가능.

### Task 11a: UserDto.DetailResponse 본인/ADMIN 한정

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/service/UserService.java:69-76`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/controller/UserController.java:70-74`
- Test: `it_backend/src/test/java/com/kdb/it/common/iam/service/UserServiceTest.java` (Create or Modify)

**배경:** `GET /api/users/{eno}`는 인증만 요구하고 본인/관리자 제한이 없어, 임의 인증 사용자가 타인의 휴대폰번호·내선번호·이메일(PII)을 조회할 수 있다. `UserService.getUser`에 현재 사용자 인자를 추가하고 본인 또는 관리자만 허용한다. (Phase 1 `OwnershipVerifier` 재사용 — 미머지 시 인라인 `AccessDeniedException`.)

- [ ] **Step 1: 실패 테스트 작성 (RED)**

Create/Modify `it_backend/src/test/java/com/kdb/it/common/iam/service/UserServiceTest.java`:

```java
package com.kdb.it.common.iam.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.UserRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

/**
 * UserService 상세 조회 권한 테스트 (T11a) — 본인/관리자만 PII 조회.
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    private CuserI user(String eno) {
        return CuserI.builder().eno(eno).usrNm("홍길동").bbrC("BBR001").cpnTpn("010-0000-0000").build();
    }

    @Test
    @DisplayName("본인 사번 상세 조회는 허용된다")
    void getUser_owner_allowed() {
        given(userRepository.findByEno("E0001")).willReturn(Optional.of(user("E0001")));
        CustomUserDetails me = Mockito.mock(CustomUserDetails.class);
        given(me.isAdmin()).willReturn(false);
        given(me.getEno()).willReturn("E0001");

        assertThatCode(() -> userService.getUser("E0001", me)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("관리자는 타인 상세 조회가 허용된다")
    void getUser_admin_allowed() {
        given(userRepository.findByEno("E0002")).willReturn(Optional.of(user("E0002")));
        CustomUserDetails admin = Mockito.mock(CustomUserDetails.class);
        given(admin.isAdmin()).willReturn(true);

        assertThat(userService.getUser("E0002", admin).getEno()).isEqualTo("E0002");
    }

    @Test
    @DisplayName("본인도 관리자도 아니면 AccessDeniedException")
    void getUser_other_denied() {
        CustomUserDetails other = Mockito.mock(CustomUserDetails.class);
        given(other.isAdmin()).willReturn(false);
        given(other.getEno()).willReturn("E9999");

        assertThatThrownBy(() -> userService.getUser("E0002", other))
                .isInstanceOf(AccessDeniedException.class);
    }
}
```

> 실행자 메모: 권한 거부를 소유자 조회보다 **먼저** 수행해 존재 여부 누설(타인 사번 존재 탐색)을 막는다 — `getUser_other_denied`는 `userRepository.findByEno` stub 없이도 통과해야 한다(불필요한 stubbing 경고 회피).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.iam.service.UserServiceTest"`
Expected: 컴파일 실패 — `getUser(String, CustomUserDetails)` 시그니처 없음.

- [ ] **Step 3: 구현 (GREEN)**

`UserService.getUser`(`:69-76`)를 교체:

```java
    /**
     * 사번별 사용자 상세 조회 — 본인 또는 관리자만 허용(PII 보호).
     *
     * @param eno         조회할 사번
     * @param currentUser 현재 인증 사용자
     * @return 사용자 상세 응답 DTO
     * @throws org.springframework.security.access.AccessDeniedException 본인도 관리자도 아닌 경우
     * @throws IllegalArgumentException 해당 사번의 사용자가 없는 경우
     */
    public UserDto.DetailResponse getUser(String eno, CustomUserDetails currentUser) {
        // 권한 검증을 조회보다 먼저 수행 — 타인 사번 존재 여부 누설 방지
        com.kdb.it.common.system.security.OwnershipVerifier.verifyOwnerOrAdmin(eno, currentUser);

        CuserI user = userRepository.findByEno(eno)
                .orElseThrow(() -> new IllegalArgumentException("User not found with eno: " + eno));

        return UserDto.DetailResponse.fromEntity(user, user.getBbrNm());
    }
```

import 추가: `import com.kdb.it.common.system.security.CustomUserDetails;`

> **OwnershipVerifier 미머지 시 폴백:** `verifyOwnerOrAdmin` 호출을 아래 인라인으로 대체한다.
> ```java
> if (currentUser == null
>         || (!currentUser.isAdmin() && !eno.equals(currentUser.getEno()))) {
>     throw new org.springframework.security.access.AccessDeniedException("본인 또는 관리자만 조회할 수 있습니다.");
> }
> ```

`UserController.getUser`(`:70-74`) 수정 — 현재 사용자 주입·전달:

```java
    @GetMapping("/{eno}")
    @Operation(summary = "사용자 상세 조회", description = "행번으로 사용자 상세 정보를 조회합니다. 본인 또는 관리자만 가능합니다.")
    public ResponseEntity<UserDto.DetailResponse> getUser(
            @PathVariable("eno") String eno,
            @org.springframework.security.core.annotation.AuthenticationPrincipal CustomUserDetails currentUser) {
        return ResponseEntity.ok(userService.getUser(eno, currentUser));
    }
```

import 추가: `import com.kdb.it.common.system.security.CustomUserDetails;`

- [ ] **Step 4: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.iam.service.UserServiceTest"`
Expected: PASS (3 tests). 403 매핑은 `GlobalExceptionHandler`(Phase 1)에서 `AccessDeniedException`→403 처리.

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/iam/service/UserService.java src/main/java/com/kdb/it/common/iam/controller/UserController.java src/test/java/com/kdb/it/common/iam/service/UserServiceTest.java && git commit -m "feat: restrict user detail (PII) to self or admin"
```

### Task 11b: eno INFO 로그 강등 + 멘션 진단 INFO 로그 제거

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java:112-113,119`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardCommentService.java` (`[멘션 진단]` 5건)

**배경:** PII(사번)가 INFO로 운영 로그에 남는다. `CouncilService`의 `[CouncilList] eno=...`는 DEBUG로 강등하고, `BoardCommentService.publishMentionNotifications`의 `[멘션 진단]` INFO 로그 5건은 FIXME대로 제거한다. 로그 변경은 동작 영향이 없어 **컴파일+기존 테스트 회귀로 검증**한다(전용 RED 불요).

- [ ] **Step 1: CouncilService 로그 강등**

`CouncilService.java:112`의 `log.info("[CouncilList] eno=...` → `log.debug(...)`로 변경. 같은 메서드 `:119`의 `log.info("[CouncilList] admin query result count=...")`는 PII 미포함이나 일관성 위해 `log.debug`로 함께 강등.

- [ ] **Step 2: BoardCommentService 멘션 진단 로그 제거**

`publishMentionNotifications`(`:251,265,267,276` 및 메서드 내 잔여 `[멘션 진단]` INFO) — 총 5건의 `log.info("[멘션 진단] ...")` 문장을 모두 삭제한다. 메서드 JavaDoc(`:240-241`)의 "임시 진단 로그 주의" 단락과 FIXME 주석(`:242`)도 함께 제거한다. 진단 외 정상 동작(추출·union·존재검증·발행) 코드는 보존한다. 로그 제거로 미사용이 되는 import가 생기면 함께 정리.

- [ ] **Step 3: 회귀 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.board.service.*" --tests "com.kdb.it.domain.council.service.*"`
Expected: PASS (로그 변경은 동작 무관, 기존 테스트 그대로 통과).

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/council/service/CouncilService.java src/main/java/com/kdb/it/common/board/service/BoardCommentService.java && git commit -m "refactor: demote/remove PII (eno) INFO logs in council/board services"
```

### Task 11c: EaiProperties enabled+blank-url 가드 + EaiService 안전 메시지 추출

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/eai/config/EaiProperties.java:36-49`
- Test: `it_backend/src/test/java/com/kdb/it/infra/eai/config/EaiPropertiesTest.java` (Create or Modify)
- Modify: `it_backend/src/main/java/com/kdb/it/infra/eai/service/EaiService.java:61,82`

**배경:** `EaiProperties`는 식별자 길이만 검증하고 `enabled=true && url 공백` 조합을 막지 않는다(운영에서 전송 시점에야 발견). 컴팩트 생성자에 가드를 추가한다(T8 구동 검증과 별개 계층 방어 — 둘 다 둔다). 또한 `EaiService`는 `e.getMessage()`를 결과 메시지에 직접 넣는데, null/과도한 길이를 방어하는 안전 추출 헬퍼로 정돈한다(위험도 LOW, 정합성 목적).

- [ ] **Step 1: 실패 테스트 작성 (RED)**

Create/Modify `it_backend/src/test/java/com/kdb/it/infra/eai/config/EaiPropertiesTest.java`:

```java
package com.kdb.it.infra.eai.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * EaiProperties 컴팩트 생성자 가드 테스트 (T11c).
 */
class EaiPropertiesTest {

    private EaiProperties props(boolean enabled, String url) {
        return new EaiProperties(enabled, url, "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
    }

    @Test
    @DisplayName("enabled=true 인데 url이 공백이면 IllegalStateException")
    void enabledTrueBlankUrl_throws() {
        assertThatThrownBy(() -> props(true, " "))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("eai.url");
    }

    @Test
    @DisplayName("enabled=false 면 url이 공백이어도 허용")
    void disabledBlankUrl_ok() {
        assertThatCode(() -> props(false, "")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("enabled=true 이고 url이 있으면 허용")
    void enabledWithUrl_ok() {
        assertThatCode(() -> props(true, "http://eai.internal/std")).doesNotThrowAnyException();
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.eai.config.EaiPropertiesTest"`
Expected: FAIL — `enabledTrueBlankUrl_throws`가 예외를 기대하나 현재 가드 없음.

- [ ] **Step 3: 가드 구현 (GREEN)**

`EaiProperties.java`의 컴팩트 생성자(`:36-49`) 끝(길이 검증 뒤)에 추가:

```java
        if (enabled && (url == null || url.isBlank())) {
            throw new IllegalStateException("eai.enabled=true이면 eai.url(EAI_URL)이 필요합니다.");
        }
```

- [ ] **Step 4: EaiService 안전 메시지 추출**

`EaiService.java`에 헬퍼 추가:

```java
    /** 예외 메시지를 안전하게 추출 — null/과도한 길이를 방어해 결과/로그 오염을 막는다. */
    private static String safeMessage(Throwable e) {
        String msg = e.getMessage();
        if (msg == null || msg.isBlank()) {
            return e.getClass().getSimpleName();
        }
        return msg.length() > 200 ? msg.substring(0, 200) + "...(생략)" : msg;
    }
```

`:61` `return EaiResult.failure("전문 조립 실패: " + e.getMessage());` → `... + safeMessage(e));`
`:82` `return EaiResult.failure("전송 실패: " + e.getMessage());` → `... + safeMessage(e));`
warn 로그의 `e.getMessage()`(`:59`, `:81`)도 일관성 위해 `safeMessage(e)`로 통일(선택).

- [ ] **Step 5: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.eai.*"`
Expected: PASS (EaiProperties 신규 + 기존 EAI 테스트 통과).

- [ ] **Step 6: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/infra/eai/config/EaiProperties.java src/main/java/com/kdb/it/infra/eai/service/EaiService.java src/test/java/com/kdb/it/infra/eai/config/EaiPropertiesTest.java && git commit -m "feat: guard eai enabled+blank-url and safe exception message extraction"
```

---

## Task 12: 통합 검증 & 백로그 동기화

**Files:**
- Modify: `TASK.md`, `TASK_DONE.md` (루트), `docs/superpowers/specs/2026-06-22-backend-improvement-roadmap-design.md`(메모)

- [ ] **Step 1: Phase 3 영향 범위 테스트 재실행**

Run:
```
cd it_backend && ./gradlew test \
  --tests "com.kdb.it.common.system.EnvironmentValidatorTest" \
  --tests "com.kdb.it.config.SecurityConfigCorsTest" \
  --tests "com.kdb.it.common.system.controller.*" \
  --tests "com.kdb.it.common.system.service.AuthServiceTest" \
  --tests "com.kdb.it.common.iam.service.UserServiceTest" \
  --tests "com.kdb.it.common.board.service.*" \
  --tests "com.kdb.it.domain.council.service.*" \
  --tests "com.kdb.it.infra.eai.*" \
  --tests "com.kdb.it.domain.budget.plan.controller.PlanControllerTest"
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 2: 전체 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava compileTestJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 백로그 이관**

`TASK.md`의 🔒 보안 섹션에서 본 Phase 3로 해소된 항목(allowedHeaders `*`, allowed-origins `*` 기본값, `/api/plan/**` 불일치, getClientIp 멀티 IP·신뢰 프록시, UserDto PII, eno/멘션 INFO 로그, EaiProperties 가드, Refresh 회전, 구동 환경검증 확장)을 제거하고, `TASK_DONE.md`에 근거(`파일:라인`)와 함께 이관한다. Access Token Blocklist는 "스파이크 결정 대기"로 유지(미완료).

`docs/superpowers/specs/2026-06-22-backend-improvement-roadmap-design.md`의 Phase 3 테마(T8–T11)에 본 계획으로 구현 완료(Blocklist는 스파이크) 한 줄 메모 추가.

- [ ] **Step 4: 커밋**

```bash
cd /c/it && git add TASK.md TASK_DONE.md docs/superpowers/specs/2026-06-22-backend-improvement-roadmap-design.md && git commit -m "docs: move Phase 3 security hardening items to TASK_DONE"
```

---

## Self-Review

- **Spec coverage:** 본 계획은 로드맵 Phase 3의 T8(구동 환경검증 확장), T9(CORS allowedHeaders 명시화·allowed-origins `*` 기본값 제거·`/api/plan/**`→`/api/plans/**`·getClientIp 멀티 IP+신뢰 프록시), T10(Refresh Token 회전 / Blocklist는 인프라 부재로 스파이크 분리), T11(UserDto.DetailResponse 본인·ADMIN 한정·eno INFO 로그 DEBUG 강등·BoardCommentService 멘션 INFO 5건 제거·EaiService 안전 메시지·EaiProperties enabled+blank-url 가드)을 모두 다룬다. ✓
- **Placeholder scan:** 모든 코드 스텝에 실제 인용 코드 포함. "추가하세요/유사하게" 류 핸드웨이빙 없음(컨트롤러 refresh 쿠키 재설정만 기존 로그인 패턴 재사용 메모). ✓
- **실제 코드 대조(조사 노트):** allowedHeaders=`List.of("*")`(SecurityConfig:201), allowed-origins 코드 기본값 `*`(:73), 라우트 `/api/plan/**`(:140), getClientIp 무조건 신뢰(AuthController:254-274), refreshAccessToken 회전 없음(AuthService:206-236), getUser 권한 없음(UserService:69-76), eno INFO=CouncilService:112, 멘션 INFO 5건=BoardCommentService(:251,265,267,276+1), EaiProperties enabled+url 가드 부재(:36-49) — 전부 라이브 코드로 확인. ✓
- **이미 처리된 부분 명시:** `application-prod.properties`는 이미 비밀값 기본값 제거·운영 토글 고정 상태. T8은 "런타임 해석값 빈값/와일드카드 차단"을 보강하는 보완 방어이며 기존 prod 파일을 재작성하지 않음. ✓
- **needs-decision:** T10 Access Token Blocklist는 Redis/분산 캐시 인프라 부재로 **구현하지 않고 스파이크 문서(Task 10b)로 결정 게이트에 회부**. 기본 권고는 옵션 A(단기 만료+Refresh 회전) 유지. ✓
- **Type consistency:** `OwnershipVerifier.verifyOwnerOrAdmin(String, CustomUserDetails)`(Phase 1) 재사용 시그니처 일치, 미머지 폴백(인라인 `AccessDeniedException`) 명시. `AuthDto.RefreshResponse.refreshToken` 신규 필드가 Task 10a 테스트↔구현에서 일치. `ClientIpResolver.resolve(HttpServletRequest, Set<String>)` 시그니처가 테스트↔구현 일치. `EaiProperties`(record) 10-인자 생성자(enabled,url,charset,connectTimeout,readTimeout,sysEnvTc,fwdiSysC,bzCS3,appC,appBzLv1C)가 테스트와 일치. `CustomUserDetails.isAdmin()/getEno()` 실제 시그니처 확인. ✓
- **주의(실행자):** (1) T9a CORS 테스트는 `UrlBasedCorsConfigurationSource.getCorsConfigurations().get("/**")` 직접 조회 방식 사용(요청 mock보다 결정적). (2) T10a는 `AuthDto.RefreshResponse` 필드 추가 + `AuthController` refresh 쿠키 재설정까지 해야 회전이 실효. (3) T11a 권한 검증은 조회보다 **선행**해 사번 존재 누설 방지. (4) `AuthServiceTest`에 `@BeforeEach`로 `refreshTokenValidityMs` 주입 필요(회전 시 endDtm 계산). ✓
