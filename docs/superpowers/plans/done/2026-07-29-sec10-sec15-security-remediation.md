# SEC-10~15 보안 조치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md`의 SEC-10~15를 위험도 순서로 조치해 SSO 민감 로그, SSO 복귀 경로, 운영 API 문서 노출, 쿠키 JWT의 CSRF 경계, Oracle 운영 스크립트의 비밀번호 노출을 검증 가능한 상태로 만들고, `brace-expansion`은 호환 백포트 출시 직후 안전하게 갱신할 수 있는 게이트를 확정한다.

**Architecture:** 즉시 수정 가능한 항목은 저장소별로 독립 커밋과 회귀 테스트를 만든다. SSO 로그와 경로는 `common.sso` 내부의 작은 공통 유틸로 정책을 한곳에 모으고, 운영 OpenAPI는 springdoc의 프로파일 속성으로 엔드포인트를 끄는 동시에 Security 허용 목록에서도 제외한다. CSRF는 현재 `SameSite=Lax` + 명시 CORS 경계를 유지하되 완화 트리거와 전환 방식을 문서·테스트로 고정하고, Oracle 스크립트는 애플리케이션이 비밀번호를 받지 않고 Oracle 클라이언트 프롬프트 또는 Wallet이 인증을 담당하게 한다.

**Tech Stack:** Java 25 / Spring Boot 4.1 / Spring Security / springdoc-openapi 3.0.3 / JUnit 5 + AssertJ + Mockito + MockMvc + Logback `ListAppender`, Nuxt 4 / TypeScript / Vitest, PowerShell 5.1·7 / Oracle SQL*Plus·SQLcl·Data Pump, npm lockfile

## Global Constraints

- 모든 신규 JavaDoc/TSDoc/인라인 주석은 한글로 작성한다.
- 브라우저 JWT는 httpOnly 쿠키로만 유지하고 Access 15분, Refresh 7일, `SameSite=Lax`를 바꾸지 않는다.
- `/sso/**`의 외부 콜백 CORS는 `allowCredentials=false`를 유지하며 일반 `/api/**`로 확대하지 않는다.
- 운영 `prod`에서는 OpenAPI JSON·Swagger UI를 모두 비활성화한다. 로컬·개발 프로파일의 익명 문서 접근은 유지한다.
- SSO `next`는 단일 `/`로 시작해야 하며 `//` 및 `/login` 접두 경로를 거부한다.
- 로그에는 원문 토큰, 세션 ID, 사번, 벤더 응답 본문, 예외 메시지에 포함될 수 있는 요청 URI를 남기지 않는다.
- DB 비밀번호를 PowerShell 매개변수, 프로세스 인자, 셸 이력, 임시 SQL 파일에 넣지 않는다.
- `npm audit fix --force`는 Nuxt/ExcelJS 하향 변경을 유발하므로 실행하지 않는다.
- `brace-expansion` 5.x의 5.0.8 override를 1.x/2.x 소비자에게 전역 적용하지 않는다. minimatch 3.x/9.x의 CJS 계약을 보존한다.
- `C:\it` 루트와 `it_backend`, `it_frontend`, `it_database`는 별도 저장소다. 교차 저장소 변경 후 `scripts/update-versions-lock.ps1`로 호환 커밋 조합을 갱신한다.
- 현재 `C:\it\TASK.md`에는 사용자 소유의 포맷 변경이 있으므로 구현 중 이를 덮어쓰거나 되돌리지 않는다.

---

## 조사 기준선과 실행 순서

| 순서 | 항목 | 상태 | 완료 판단 |
| ---: | --- | --- | --- |
| 1 | SEC-12 SSO 로그 | 즉시 구현 | 성공·거부·통신 실패 로그 어디에도 테스트 sentinel 원문이 없음 |
| 2 | SEC-14 SSO `next` | 즉시 구현 | 백엔드와 프론트 4개 진입점이 동일한 허용/거부 표를 통과 |
| 3 | SEC-13 OpenAPI | 즉시 구현 | dev/local 문서 접근 가능, prod 문서 bean·endpoint 비활성 + Security 공개 제외 |
| 4 | SEC-15 CSRF 경계 | 즉시 문서·회귀 게이트 | 경로별 위협 모델, 완화 트리거, CORS/쿠키 회귀 테스트 존재 |
| 5 | SEC-11 DB 자격증명 | 즉시 구현 | 프로세스 인자·소스·문서에 비밀번호가 없고 PS 5.1 파싱 통과 |
| 6 | SEC-10 의존성 | 외부 릴리스 대기 | 1.x/2.x 호환 패치 출시 후 lockfile 갱신, 해당 advisory만 audit에서 제거 |

2026-07-29 실측:

- `it_frontend/package-lock.json`에는 취약 1.1.16/2.1.2와 패치 5.0.8이 함께 존재한다.
- npm 배포 최신은 1.x=1.1.16, 2.x=2.1.2, 5.x=5.0.8이다.
- GHSA-mh99-v99m-4gvg의 공식 patched version은 아직 5.0.8뿐이다.
- `npm audit`은 `brace-expansion` 외의 별도 취약점도 보고하므로 “전체 audit 0건”을 SEC-10 완료 기준으로 사용하지 않는다.
- `TASK.md`에 적힌 1.1.17/2.1.3은 확정 버전이 아니라 향후 백포트 예시로 취급한다.

## 파일 책임 맵

| 파일 | 책임 |
| --- | --- |
| `it_backend/src/main/java/com/kdb/it/common/sso/SsoLogSanitizer.java` | SSO 로그용 값 비노출 표현과 예외 유형 축약 |
| `it_backend/src/main/java/com/kdb/it/common/sso/SsoAgentClient.java` | 허용 필드만 구조화 로깅 |
| `it_backend/src/main/java/com/kdb/it/common/sso/SsoNextPathValidator.java` | 백엔드 SSO 내부 복귀 경로 단일 정책 |
| `it_backend/src/main/java/com/kdb/it/common/sso/SsoController.java` | SSO 진입 저장·완료 리다이렉트에서 공통 검증 적용 |
| `it_frontend/shared/utils/safeNextPath.ts` | 프론트 CSR/Nitro/수동 로그인 공통 `next` 정책 (app·server 양쪽에서 import) |
| `it_frontend/vitest.config.ts` | `#shared` alias와 커버리지 include에 신규 공용 디렉터리 반영 |
| `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java` | OpenAPI 공개 조건과 CORS/CSRF 보안 경계 |
| `it_backend/src/main/resources/application-prod.properties` | 운영 springdoc 완전 비활성 |
| `it_backend/docs/guides/security/authentication-authorization.md` | 경로별 CSRF 위협 모델과 보강 트리거 SoT |
| `it_database/apply-ddl-live.ps1`, `export-ddl-live.ps1` | 비밀번호를 받지 않는 SQL*Plus/SQLcl 호출 |
| `it_database/README.MD` | Data Pump·DDL 프롬프트/Wallet 실행 절차 |
| `scripts/verify-sec11-powershell.ps1` | 가짜 Oracle 클라이언트 argv 검사, UTF-8 BOM, PowerShell 5.1 파싱 게이트 |
| `CLAUDE.md` (루트) | §3.1.1 로컬 Oracle 접속 절차를 프롬프트 방식으로 정정 |
| `it_frontend/package-lock.json` | SEC-10 백포트 출시 후에만 변경 |

---

### Task 1: SEC-12 — SSO 검증 로그에서 세션·사번·응답 본문 제거

**Files:**

- Create: `it_backend/src/main/java/com/kdb/it/common/sso/SsoLogSanitizer.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/sso/SsoAgentClient.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/sso/SsoController.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/sso/SsoAgentClientTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/sso/SsoControllerTest.java`

**Interfaces:**

- Produces: package-private `SsoLogSanitizer.masked(String): String`
- Produces: package-private `SsoLogSanitizer.exceptionType(Throwable): String`
- Preserves: `SsoAgentClient.authorize(String, String, String): TokenAuthResult`
- Preserves: 인증 성공 시 `TokenAuthResult.resultData()`에는 원래 사번을 반환한다. 바꾸는 것은 로그뿐이다.

- [ ] **Step 1: 성공·거부·통신 실패 로그 캡처 테스트를 먼저 작성한다**

`SsoAgentClientTest`에 Logback `ListAppender<ILoggingEvent>`를 붙이고 각 응답에 고유 sentinel을 넣는다.

```java
private static final String TOKEN_SENTINEL = "token-RAW-7Q2";
private static final String SESSION_SENTINEL = "session-RAW-8R3";
private static final String ENO_SENTINEL = "K999999";
private static final String BODY_SENTINEL = "response-body-RAW-9S4";

private List<String> formattedMessages(ListAppender<ILoggingEvent> appender) {
    return appender.list.stream().map(ILoggingEvent::getFormattedMessage).toList();
}
```

검증은 성공 응답의 `user.id`, 실패 응답의 추가 필드와 `resultMessage`, 예외 메시지에 각각 sentinel을 넣은 뒤 다음 계약을 사용한다.

```java
assertThat(logs)
        .noneMatch(message -> message.contains(TOKEN_SENTINEL))
        .noneMatch(message -> message.contains(SESSION_SENTINEL))
        .noneMatch(message -> message.contains(ENO_SENTINEL))
        .noneMatch(message -> message.contains(BODY_SENTINEL));
assertThat(result.resultData()).isEqualTo(ENO_SENTINEL);
```

`SsoControllerTest`에는 `checkauth` 검증 실패 경로에 IP sentinel을 추가한다. `X-Forwarded-For: 203.0.113.77` 헤더로 요청하고 로그 어디에도 `203.0.113.77`과 `remoteAddr` 원문이 없음을 같은 `noneMatch` 계약으로 확인한다. `isServerAlive()` 실패 경로는 예외 메시지에 sentinel을 심어 동일하게 검증한다.

- [ ] **Step 2: 해당 테스트만 실행해 원문 노출로 실패하는지 확인한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.common.sso.SsoAgentClientTest"
```

Expected: 기존 INFO/WARN 로그에 `secureSessionId`, `resultData`, 실패 응답 본문 또는 예외 메시지가 포함되어 FAIL.

- [ ] **Step 3: SSO 전용 로그 비노출 유틸을 최소 구현한다**

```java
final class SsoLogSanitizer {
    private SsoLogSanitizer() {}

    static String masked(String value) {
        return value == null || value.isBlank() ? "(없음)" : "***(len=" + value.length() + ")";
    }

    static String exceptionType(Throwable error) {
        return error == null ? "Unknown" : error.getClass().getSimpleName();
    }
}
```

문자열 앞부분·해시를 남기지 않는다. 사번처럼 후보 공간이 작은 값은 해시도 재식별 위험이 있으므로 길이만 남긴다.

- [ ] **Step 4: `SsoAgentClient` 로그를 허용 필드 목록으로 축소한다**

허용 필드는 endpoint base URL, `agentId`, `requestData`의 필드명, `resultCode`, `useCSMode`, 값 존재 여부, 예외 클래스명이다. 다음 원문은 제거한다: `secureToken`, `secureSessionId`, `resultData`, 전체 `body`, 벤더 `resultMessage`, `e.toString()`, stack trace 인자.

```java
log.info(
        "SSO 토큰 검증 요청 - url: {}, agentId: {}, requestData: {}, secureSessionId: {}",
        props.tokenAuthorizationUrl(),
        props.agentId(),
        props.requestData(),
        SsoLogSanitizer.masked(secureSessionId));

log.info(
        "SSO 토큰 검증 성공 - resultCode: {}, useCSMode: {}, 사용자 식별값 존재: {}",
        resultCode,
        useCSMode,
        !resultData.isBlank());

log.warn("SSO 토큰 검증 거부 - resultCode: {}", resultCode);

log.warn(
        "SSO 토큰 검증 통신 실패 - url: {}, 오류 유형: {}",
        props.tokenAuthorizationUrl(),
        SsoLogSanitizer.exceptionType(e));
```

client IP도 요청 로그에서 제거한다. 운영 추적이 필요하면 이미 신뢰 프록시 정책을 거친 별도 접근 로그와 상관 분석한다.

같은 클래스의 `isServerAlive()`도 현재 `e.toString()`을 WARN으로 남긴다. `authorize()`만 고치면 예외 메시지에 섞여 나올 수 있는 요청 URI·내부 호스트가 이 경로로 그대로 남으므로 함께 바꾼다.

```java
log.warn(
        "SSO 인증서버 통신 점검 실패 - url: {}, 오류 유형: {}",
        props.checkServerUrl(),
        SsoLogSanitizer.exceptionType(e));
```

- [ ] **Step 5: `SsoController`의 사번·IP 로그도 같은 정책으로 맞춘다**

`complete()` 성공 DEBUG와 실패 ERROR/WARN의 `verifiedEno`/`eno` 원문을 `SsoLogSanitizer.masked(...)`로 바꾼다. 예외 메시지나 예외 객체를 운영 로그에 넘기지 않고 예외 유형만 기록한다.

`checkauth()`의 토큰 검증 실패 WARN도 함께 정리한다. 현재 `remoteAddr`, `X-Forwarded-For`, `X-Real-IP`, `Proxy-Client-IP`, `WL-Proxy-Client-IP` 5종을 모두 남기는데, Step 4에서 `SsoAgentClient`의 clientIP를 제거하면서 이곳만 두면 같은 SSO 흐름 안에서 IP 로깅 정책이 갈라진다. `resultCode`와 "프록시 헤더 존재 여부"(boolean)만 남기고 IP 원문은 제거한다.

```java
log.warn(
        "SSO 토큰 검증 실패 - resultCode: {}, 프록시 헤더 존재: {}",
        result.resultCode(),
        request.getHeader("X-Forwarded-For") != null);
```

clientIP 불일치 진단이 필요하면 신뢰 프록시 정책을 거친 접근 로그와 `resultCode` 시각으로 상관 분석한다. 이 진단 목적 자체는 유지하되 SSO 애플리케이션 로그를 IP 보관소로 쓰지 않는다.

- [ ] **Step 6: 로그 테스트와 SSO 전체 테스트를 통과시킨다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.common.sso.*"
```

Expected: PASS, 반환 데이터와 SSO 흐름은 불변이며 로그 sentinel만 사라짐.

- [ ] **Step 7: SEC-12를 독립 커밋한다**

```powershell
git add src/main/java/com/kdb/it/common/sso src/test/java/com/kdb/it/common/sso
git commit -m "fix: SSO 검증 로그 민감정보 제거 (SEC-12)"
```

---

### Task 2: SEC-14 — 백엔드 SSO `next` 공통 검증기 적용

**Files:**

- Create: `it_backend/src/main/java/com/kdb/it/common/sso/SsoNextPathValidator.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/sso/SsoNextPathValidatorTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/sso/SsoController.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/sso/SsoControllerTest.java`

**Interfaces:**

- Produces: `SsoNextPathValidator.safePath(String): Optional<String>`
- Produces: `SsoNextPathValidator.safePathOrRoot(String): String`
- Contract: `/`, `/info/projects`, `/info?q=1#top` 허용. null/blank, `https://...`, `//host`, `/login`, `/login?...`, `/login/...` 거부.

- [ ] **Step 1: 허용/거부 표를 파라미터화 단위 테스트로 고정한다**

```java
@ParameterizedTest
@ValueSource(strings = {"/", "/info/projects", "/info/projects?tab=1#top"})
void safePath_내부경로는허용(String value) {
    assertThat(SsoNextPathValidator.safePath(value)).contains(value);
}

@ParameterizedTest
@NullAndEmptySource
@ValueSource(strings = {" ", "https://evil.example", "//evil.example", "/login", "/login?next=/", "/login/callback"})
void safePath_외부경로와로그인재진입은거부(String value) {
    assertThat(SsoNextPathValidator.safePath(value)).isEmpty();
    assertThat(SsoNextPathValidator.safePathOrRoot(value)).isEqualTo("/");
}
```

- [ ] **Step 2: 컨트롤러의 우회 경로 회귀 테스트를 추가한다**

`SsoControllerTest`에 다음을 추가한다.

1. `business("//evil.example", origin, ...)`는 next 세션·쿠키를 저장하지 않음.
2. `complete(..., "//evil.example", allowedOrigin, ...)`는 프론트 루트로 이동.
3. `complete(..., "/login?next=/admin", allowedOrigin, ...)`는 프론트 루트로 이동.
4. `frontendUrl=""`, 허용 origin 없음, `next="//evil.example"`이면 `Location: /`이며 `//evil.example`가 아님.
5. 파라미터가 안전하지 않고 쿠키가 안전하더라도 “파라미터 우선 후 거부”로 처리한다. 공격자가 query로 쿠키의 안전값을 덮어쓴 경우 쿠키로 재폴백하지 않는다.

- [ ] **Step 3: 테스트가 기존 `startsWith("/")` 구현에서 실패하는지 확인한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.common.sso.SsoNextPathValidatorTest" --tests "com.kdb.it.common.sso.SsoControllerTest"
```

Expected: 검증기 미존재 또는 `//`, `/login`이 허용되어 FAIL.

- [ ] **Step 4: 검증기를 구현하고 SSO 진입·전달·완료 세 경계에 적용한다**

```java
final class SsoNextPathValidator {
    private static final String LOGIN_PATH = "/login";

    private SsoNextPathValidator() {}

    static Optional<String> safePath(String value) {
        if (value == null
                || value.isBlank()
                || !value.startsWith("/")
                || value.startsWith("//")
                || value.startsWith(LOGIN_PATH)) {
            return Optional.empty();
        }
        return Optional.of(value);
    }

    static String safePathOrRoot(String value) {
        return safePath(value).orElse("/");
    }
}
```

적용 위치:

- `business()`: 검증에 성공한 next만 세션과 SSO next 쿠키에 저장.
- `buildCompleteRedirect()`: 세션에서 온 값도 다시 검증한 뒤 query에 포함.
- `complete()`: query/cookie 우선순위를 먼저 결정한 뒤 `safePathOrRoot(effectiveNext)`로 최종 목적지 생성.

- [ ] **Step 5: 백엔드 SSO 테스트를 통과시킨다**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.common.sso.*"
```

- [ ] **Step 6: SEC-14 백엔드 경계를 독립 커밋한다**

```powershell
git add src/main/java/com/kdb/it/common/sso src/test/java/com/kdb/it/common/sso
git commit -m "fix: SSO 내부 복귀 경로 검증 통일 (SEC-14)"
```

---

### Task 3: SEC-14 — 프론트 네 진입점의 `next` 검증을 공용 유틸로 통일

**Files:**

- Create: `it_frontend/shared/utils/safeNextPath.ts`
- Create: `it_frontend/tests/unit/shared/safeNextPath.test.ts`
- Modify: `it_frontend/vitest.config.ts`
- Modify: `it_frontend/app/middleware/auth.global.ts`
- Modify: `it_frontend/server/middleware/sso-auth-redirect.ts`
- Modify: `it_frontend/app/pages/login.vue`
- Modify: `it_frontend/tests/unit/middleware/auth.global.test.ts`

**Interfaces:**

- Produces: `getSafeNextPath(value: unknown): string | undefined`
- Consumes (진입점 4개, 전부 이 유틸만 사용):
  1. `auth.global.ts` — CSR 라우트 가드의 `redirect`/`next` 쿼리
  2. `sso-auth-redirect.ts` — Nitro 미들웨어의 `redirect`/`next` 쿼리
  3. `login.vue` SSO 시작 — `/sso/business?next=` 로 넘길 값
  4. `login.vue` 수동 로그인 완료 — `router.push` 목적지
- Mirrors: Task 2의 Java 허용/거부 표.

**배치 근거 (`app/utils`가 아니라 `shared/`):**

`sso-auth-redirect.ts`는 Nitro 서버 미들웨어이고 나머지 셋은 app 코드다. `.nuxt/tsconfig.server.json`의 `include`는 `../server/**/*`와 `../shared/**/*.d.ts`뿐이라 `app/**`이 서버 프로젝트 범위 밖이다(`~~/*` → `../*` 매핑 자체는 존재하고 composite 프로젝트가 아니어서 typecheck가 즉시 깨지지는 않지만, 설계상 지원 경로가 아니다). 같은 파일의 `#shared/*` → `../shared/*` 매핑과 `tsconfig.shared.json`의 `../shared/**/*` include가 app·server 공용 코드를 위해 준비된 경로이므로 이쪽을 쓴다. 저장소에 `~~/`·`@@/` import 선례는 0건이다.

- [ ] **Step 1: vitest가 `#shared`를 해석하도록 설정을 먼저 연다**

`vitest.config.ts`는 현재 `~`/`@` → `app`만 정의하므로 `#shared` import가 해석되지 않는다. alias와 커버리지 include를 함께 추가한다.

```ts
// resolve.alias
'#shared': resolve(__dirname, 'shared'),

// test.coverage.include — 기존 4개 항목에 추가
'shared/**/*.ts',
```

커버리지 include를 빼면 `shared/`로 옮긴 유틸이 `thresholds.lines: 70` 산정에서 통째로 빠져 실측 커버리지가 왜곡된다. 두 변경은 한 커밋에 함께 넣는다.

- [ ] **Step 2: 순수 유틸 테스트로 Java와 같은 입력 표를 작성한다**

```ts
expect(getSafeNextPath('/')).toBe('/');
expect(getSafeNextPath('/info/projects?tab=1#top')).toBe('/info/projects?tab=1#top');
expect(getSafeNextPath('//evil.example')).toBeUndefined();
expect(getSafeNextPath('/login')).toBeUndefined();
expect(getSafeNextPath('/login/callback')).toBeUndefined();
expect(getSafeNextPath('https://evil.example')).toBeUndefined();
expect(getSafeNextPath(['/info/projects', '//evil.example'])).toBe('/info/projects');
```

- [ ] **Step 3: 현재 `login.vue`의 두 경로가 `//`를 거부하지 않아 테스트가 실패함을 확인한다**

`login.vue`에는 약한 검증이 **두 곳**이다. 둘 다 회귀 대상이다.

| 위치 | 현재 식 | 통과해 버리는 입력 |
| --- | --- | --- |
| SSO 시작 (`redirect`/`next` → `/sso/business?next=`) | `redirectPath?.startsWith('/')` | `//evil.example`, `/login?next=/admin` |
| 수동 로그인 완료 (`router.push`) | `next?.startsWith('/') && !next.startsWith('/login')` | `//evil.example` |

Run:

```powershell
cd C:\it\it_frontend
npx vitest run tests/unit/shared/safeNextPath.test.ts tests/unit/middleware/auth.global.test.ts
```

Expected: 유틸 미존재로 `safeNextPath.test.ts`가 FAIL.

단, 이 두 테스트는 `login.vue`를 로드하지 않는다. `login.vue`는 페이지 컴포넌트이고 이 저장소는 페이지를 단위 테스트가 아니라 E2E로 덮는다(`it_frontend/CLAUDE.md` §7, `vitest.config.ts`의 커버리지 include에도 `app/pages`가 없다). 따라서 위 두 경로의 회귀 방지는 "유틸이 유일한 판정자"라는 구조로 보장하고, 잔존 여부는 Step 6에서 정적 검사로 확인한다. `login.vue`만을 위한 단위 테스트를 새로 만들지 않는다.

- [ ] **Step 4: 공통 유틸을 구현한다**

```ts
const firstString = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
        return typeof value[0] === 'string' ? value[0] : undefined;
    }
    return typeof value === 'string' ? value : undefined;
};

export const getSafeNextPath = (value: unknown): string | undefined => {
    const next = firstString(value);
    if (!next?.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) {
        return undefined;
    }
    return next;
};
```

- [ ] **Step 5: 네 호출부가 모두 이 유틸만 사용하도록 바꾼다**

- `auth.global.ts`: 로컬 `getSingleQueryValue`/`getSafeNextPath` 제거 후 `#shared/utils/safeNextPath` import.
- `sso-auth-redirect.ts`: 로컬 검증기 제거 후 `#shared/utils/safeNextPath` import.
- `login.vue` SSO 시작: `const redirectPath = getSafeNextPath(route.query.redirect ?? route.query.next)` 로 바꾸고, 값이 있을 때만 `searchParams.set('next', redirectPath)`. 기존 `redirectPath?.startsWith('/')` 조건 제거.
- `login.vue` 수동 로그인 완료: `router.push(getSafeNextPath(route.query.next) ?? '/')`. 기존 `startsWith` 복합식 제거.

`login.vue`의 두 곳 중 하나만 고치면 순서표 2행의 "프론트 4개 진입점이 동일한 허용/거부 표를 통과" 기준을 못 채운다. SSO 시작 경로는 백엔드 Task 2 검증기가 뒤에서 막아 주지만, 프론트가 애초에 `//evil.example`을 `/sso/business`로 넘기지 않는 것이 이 Task의 계약이다.

- [ ] **Step 6: 단위·정적 검증을 실행한다**

```powershell
cd C:\it\it_frontend
npx vitest run tests/unit/shared/safeNextPath.test.ts tests/unit/middleware/auth.global.test.ts
npm run check
```

`npm run check`는 `nuxt typecheck`와 `eslint .`를 순차 실행한다. `#shared` import가 Nitro 빌드에서도 해석되는지는 타입체크만으로 확정되지 않으므로 `npm run dev`로 1회 기동해 `sso-auth-redirect.ts`가 로드되는지 확인한다. `npm run generate` 정적 배포에서는 이 미들웨어가 실행되지 않으므로(`it_frontend/CLAUDE.md` §3) 개발 기동이 유일한 런타임 검증 경로다.

이어서 네 진입점에 중복 검증이 남지 않았는지 정적으로 확인한다.

```powershell
# 기대: 출력 없음 — next 경로 판정이 전부 getSafeNextPath로 모였음
Select-String -Path app\middleware\auth.global.ts, server\middleware\sso-auth-redirect.ts, app\pages\login.vue -Pattern "startsWith\('/'\)|startsWith\('//'\)|startsWith\('/login'\)"

# 기대: 4개 진입점이 모두 공용 유틸을 참조
Select-String -Path app\middleware\auth.global.ts, server\middleware\sso-auth-redirect.ts, app\pages\login.vue -Pattern "getSafeNextPath"
```

첫 명령이 무언가를 출력하면 로컬 검증기가 남아 있다는 뜻이므로 Step 5로 돌아간다.

- [ ] **Step 7: 프론트 경계를 독립 커밋한다**

```powershell
git add shared/utils/safeNextPath.ts vitest.config.ts app/middleware/auth.global.ts server/middleware/sso-auth-redirect.ts app/pages/login.vue tests/unit
git commit -m "fix: SSO next 경로 검증 공통화 (SEC-14)"
```

---

### Task 4: SEC-13 — prod OpenAPI/Swagger 비활성 + 공개 허용 목록 연동

**Files:**

- Modify: `it_backend/src/main/resources/application-prod.properties`
- Modify: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`
- Modify: `it_backend/src/main/java/com/kdb/it/config/SwaggerConfig.java`
- Create: `it_backend/src/test/java/com/kdb/it/config/OpenApiProfilePropertyTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/config/SecurityConfigTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/config/OpenApiDisabledSecurityTest.java`
- Modify: `it_backend/README.md`

**Interfaces:**

- Consumes: `springdoc.api-docs.enabled`
- Consumes: `springdoc.swagger-ui.enabled`
- Contract: 두 속성 기본값은 true, prod는 둘 다 false.
- Contract: `springdoc.api-docs.enabled=false`이면 OpenAPI 경로는 Security `permitAll`에도 들어가지 않는다.

- [ ] **Step 1: 실제 프로파일 파일 속성 테스트를 먼저 작성한다**

`OpenApiProfilePropertyTest`는 `ResourcePropertySource`로 실제 파일을 읽어 다음을 검증한다.

```java
assertThat(prod.getProperty("springdoc.api-docs.enabled")).isEqualTo("false");
assertThat(prod.getProperty("springdoc.swagger-ui.enabled")).isEqualTo("false");
assertThat(localExt.getProperty("springdoc.api-docs.enabled")).isNull();
assertThat(localInt.getProperty("springdoc.api-docs.enabled")).isNull();
assertThat(dev.getProperty("springdoc.api-docs.enabled")).isNull();
```

null은 springdoc 기본 true를 사용한다는 뜻이다. 로컬·개발 파일에 중복 true를 적지 않는다.

- [ ] **Step 2: enabled/disabled 보안 경계 테스트를 추가한다**

- 기존 `SecurityConfigTest` 컨텍스트는 문서 enabled 상태에서 익명 `GET /v3/api-docs`가 200임을 검증.
- `OpenApiDisabledSecurityTest`는 같은 최소 앱을 `springdoc.api-docs.enabled=false`, `springdoc.swagger-ui.enabled=false`로 띄운다.
- disabled 상태에서 익명 `/v3/api-docs`, `/v3/api-docs.yaml`, `/swagger-ui/index.html`, `/swagger-ui.html`이 200/3xx가 아니고 공개 허용도 되지 않음을 검증한다. Security 경계는 401, 리소스 비활성 경계는 인증 사용자에게 404가 기대값이다.

- [ ] **Step 3: 테스트가 prod 속성 부재와 전 환경 permitAll 때문에 실패하는지 확인한다**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.config.OpenApiProfilePropertyTest" --tests "com.kdb.it.config.*OpenApi*SecurityTest"
```

- [ ] **Step 4: prod에서 springdoc API와 UI를 모두 끈다**

`application-prod.properties` 보안 토글 절에 추가:

```properties
# 운영에서는 API 명세와 Swagger UI를 외부에 노출하지 않는다.
springdoc.api-docs.enabled=false
springdoc.swagger-ui.enabled=false
```

- [ ] **Step 5: Security 공개 목록을 `springdoc.api-docs.enabled`와 연동한다**

`SecurityConfig`에 문서 경로 상수와 속성을 둔다.

```java
private static final String[] OPEN_API_PATHS = {
    "/swagger-ui/**",
    "/swagger-resources/**",
    "/webjars/**",
    "/swagger-ui.html",
    "/v3/api-docs",
    "/v3/api-docs/**",
    "/v3/api-docs.yaml"
};

@Value("${springdoc.api-docs.enabled:true}")
private boolean apiDocsEnabled;
```

`authorizeHttpRequests` 구성에서 인증/SSO 공개 경로를 먼저 `permitAll`하고, `apiDocsEnabled`일 때만 `OPEN_API_PATHS`를 `permitAll`한다. false일 때는 이 경로들이 `.anyRequest().authenticated()`로 떨어진다.

주의 — 이 목록은 현재 permitAll 집합보다 **한 항목 넓다**. 기존 목록의 `/v3/api-docs/**`는 `/v3/api-docs.yaml`을 매칭하지 않으므로(`/**`는 경로 세그먼트 경계에서만 확장) 지금 `.yaml`은 익명 접근 대상이 아니다. `OPEN_API_PATHS`에 `.yaml`을 넣으면 local/dev에서 익명 접근이 새로 열린다. JSON과 YAML의 노출 범위를 일치시키려는 의도적 확대이며, prod에서는 `apiDocsEnabled=false`로 두 형식이 함께 닫히므로 순증 위험은 개발 프로파일에 한정된다. 이 확대를 원하지 않으면 `OPEN_API_PATHS`에서 `/v3/api-docs.yaml`을 빼고 Step 2의 disabled 테스트에서도 해당 케이스를 제거한다.

- [ ] **Step 6: `SwaggerConfig` bean도 API docs 속성에 조건부로 등록한다**

```java
@Configuration
@ConditionalOnProperty(
        name = "springdoc.api-docs.enabled",
        havingValue = "true",
        matchIfMissing = true)
public class SwaggerConfig {
}
```

운영에서 메타데이터·Bearer 스키마 bean도 만들지 않도록 한다.

- [ ] **Step 7: README의 문서 접근 범위를 명시한다**

로컬 실행 절의 Swagger URL은 유지하고 바로 아래에 “local-ext/local-int/dev에서만 활성, prod에서는 API docs와 UI 모두 비활성”을 추가한다.

- [ ] **Step 8: 프로파일·전체 config 테스트를 통과시킨다**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.config.*"
```

- [ ] **Step 9: SEC-13을 독립 커밋한다**

```powershell
git add src/main/java/com/kdb/it/config src/main/resources/application-prod.properties src/test/java/com/kdb/it/config README.md
git commit -m "fix: 운영 OpenAPI 문서 노출 차단 (SEC-13)"
```

---

### Task 5: SEC-15 — 쿠키 JWT CSRF 위협 모델과 회귀 게이트 확정

**Files:**

- Modify: `it_backend/docs/guides/security/authentication-authorization.md`
- Modify: `it_backend/src/test/java/com/kdb/it/config/SecurityConfigCorsTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/config/SecurityConfigTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/util/CookieUtilTest.java`
- Modify: `it_backend/CLAUDE.md` only if the durable trigger wording is not already fully represented; do not duplicate the detailed table.

**Interfaces:**

- Preserves: CSRF global disable under the current threat assumptions.
- Defines future switch: any trigger hit means the same change set must enable CSRF token or an equivalent server-validated Origin/nonce defense before deployment.

- [ ] **Step 1: 가이드에 경로별 위협 모델 표를 작성한다**

표에는 다음 행과 결론을 정확히 포함한다.

| 경로 | 자동 전송 자격증명 | 상태 변경 | 현재 방어 | 잔여 위험 |
| --- | --- | --- | --- | --- |
| `POST /api/auth/login` | 기존 JWT 불필요 | Access/Refresh 발급 | 명시 CORS, 로그인 검증·잠금 | 로그인 CSRF는 공격자 계정 세션 주입 관점에서 별도 관찰 |
| `POST /api/auth/refresh` | Refresh 쿠키(`/api/auth`) | 토큰 회전 | SameSite=Lax, 명시 Origin, POST | SameSite 완화 시 최우선 CSRF 토큰 대상 |
| `POST /api/auth/logout` 및 인증 변경 API | Access/Refresh 쿠키 | 세션/DB 변경 | SameSite=Lax, 명시 Origin, unsafe method | CORS만 단독 방어로 간주하지 않음 |
| `POST/PUT/PATCH/DELETE /api/**` | Access 쿠키(`/`) | 업무 데이터 변경 | SameSite=Lax, 명시 Origin, 인증·인가 | 교차 사이트 SPA/iframe 도입 시 보강 필요 |
| `GET/POST /sso/**` | API 자격증명 공유 안 함 | 외부 인증 콜백 | `allowCredentials=false`, 서버 검증 세션 | 예외를 `/api/**`로 확대 금지 |
| `GET /api/auth/sso/complete` | 검증된 SSO 세션/상태 쿠키 | JWT 쿠키 발급 | 검증 사번 1회 소비, origin allowlist, safe next | 일반 상태 변경 GET의 선례로 확대 금지 |

- [ ] **Step 2: 보강 트리거와 목표 구현을 문서에 고정한다**

다음 중 하나라도 발생하면 현재 `csrf.disable()` 유지가 금지된다.

1. Access/Refresh/User/SSO 상태 쿠키 중 하나를 `SameSite=None`으로 변경.
2. credentialed `/api/**`에 새 교차 사이트 Origin을 추가하거나 wildcard/pattern으로 완화.
3. 프론트를 cross-site iframe에 임베드하거나 별도 사이트의 SPA가 쿠키 API를 호출.
4. GET으로 업무 상태 변경 엔드포인트 추가.
5. `/sso/**`의 `allowCredentials`를 true로 변경.

목표 구현은 Spring Security `CookieCsrfTokenRepository` 또는 동등한 synchronizer/double-submit token을 사용하고, 프론트 `$apiFetch`/`useApiFetch`가 unsafe method에 헤더를 전송하며, 로그인·refresh·logout·SSO complete의 토큰 발급/회전 예외를 별도 테스트한다. Origin/Referer 검증만으로 대체하려면 누락 헤더 정책과 신뢰 프록시 경계를 문서화하고 보안 리뷰 승인을 받는다.

- [ ] **Step 3: CORS 설정 단위 테스트를 강화한다**

`SecurityConfigCorsTest`에 다음 계약을 추가한다.

```java
assertThat(apiCors.getAllowCredentials()).isTrue();
assertThat(apiCors.getAllowedOriginPatterns()).isNullOrEmpty();
assertThat(apiCors.checkOrigin("https://evil.example")).isNull();

assertThat(ssoCors.getAllowCredentials()).isFalse();
assertThat(ssoCors.checkOrigin("https://esso.example")).isNotNull();
assertThat(ssoCors.getAllowedMethods()).containsExactlyInAnyOrder("GET", "POST", "OPTIONS");
```

- [ ] **Step 4: 실제 FilterChain의 악성 Origin 차단 테스트를 추가한다**

`SecurityConfigTest`의 최소 앱에 테스트 전용 `POST /api/security-probe` 컨트롤러를 등록한다.

```java
@RestController
static class SecurityProbeController {
    @PostMapping("/api/security-probe")
    Map<String, String> mutate() {
        return Map.of("status", "ok");
    }
}
```

`ActuatorSecurityTestApp`은 `@SpringBootConfiguration` + `@Import({...})` 구성이라 컴포넌트 스캔이 없다. 중첩 `@RestController`를 선언만 하면 핸들러가 매핑되지 않으므로 `@Import` 목록에 명시적으로 추가한다.

```java
@Import({
    SecurityConfig.class,
    JwtAuthenticationFilter.class,
    JwtUtil.class,
    AuditFailureRecorder.class,
    SecurityProbeController.class
})
static class ActuatorSecurityTestApp {}
```

허용 origin 케이스가 성립하는 근거: `src/test/resources/application-test.properties`가 `cors.allowed-origins=http://localhost:3000`을 지정하고 이 테스트는 `@ActiveProfiles("test")`다. 이 값을 바꾸면 두 단언이 함께 깨진다.

검증:

```java
mockMvc.perform(
                post("/api/security-probe")
                        .header(HttpHeaders.ORIGIN, "https://evil.example")
                        .cookie(accessTokenCookie(List.of(CustomUserDetails.ATH_USER))))
        .andExpect(status().isForbidden());

mockMvc.perform(
                post("/api/security-probe")
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                        .cookie(accessTokenCookie(List.of(CustomUserDetails.ATH_USER))))
        .andExpect(status().isOk())
        .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3000"));
```

- [ ] **Step 5: 모든 인증 관련 쿠키의 SameSite 계약을 한 테스트에서 읽기 쉽게 고정한다**

기존 `CookieUtilTest`의 개별 검증을 유지하고, Access/Refresh/User/SSO next/SSO origin 생성·삭제 cookie를 모아 모두 `SameSite=Lax`인지 검증한다. 테스트 중복을 피하기 위해 기존 helper로 생성하고 새 production helper는 만들지 않는다.

- [ ] **Step 6: 보안 경계 테스트를 실행한다**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.config.SecurityConfigCorsTest" --tests "com.kdb.it.config.SecurityConfigTest" --tests "com.kdb.it.common.util.CookieUtilTest"
```

- [ ] **Step 7: SEC-15를 독립 커밋한다**

```powershell
git add docs/guides/security/authentication-authorization.md src/test/java/com/kdb/it/config src/test/java/com/kdb/it/common/util/CookieUtilTest.java CLAUDE.md
git commit -m "test: 쿠키 JWT CSRF 보안 경계 고정 (SEC-15)"
```

---

### Task 6: SEC-11 — Oracle 스크립트의 비밀번호 프로세스 인자 제거와 PS 5.1 호환

**Files:**

- Modify: `it_database/apply-ddl-live.ps1`
- Modify: `it_database/export-ddl-live.ps1`
- Modify: `it_database/README.MD`
- Modify: `CLAUDE.md` (루트 §3.1.1 로컬 Oracle DB 접속)
- Re-encode only: `it_backend/scripts/generate-jwt-secret.ps1`
- Create: `scripts/verify-sec11-powershell.ps1`

**Interfaces:**

- Removes: `-Password` PowerShell parameter and `DB_PASSWORD` fallback from the two DDL scripts.
- Adds: optional `-WalletAlias <tns-alias>`.
- Default: `Username@Host:Port/ServiceName`만 프로세스 인자로 넘기고 Oracle 클라이언트가 콘솔에서 비밀번호를 프롬프트.
- Wallet: `/@WalletAlias`만 넘기며 외부 비밀번호 저장소를 사용.

- [ ] **Step 1: 실행 기반 보안·인코딩 검증 스크립트를 먼저 작성한다**

`scripts/verify-sec11-powershell.ps1`은 다음 3가지를 실패 조건으로 검사한다.

1. PowerShell 명령 메타데이터에 `Password` 매개변수가 존재하거나, 임시 가짜 Oracle 클라이언트로 두 DDL 스크립트를 실제 실행했을 때 캡처한 argv에 `DB_PASSWORD` sentinel이 존재.
2. 세 한글 PowerShell 파일 첫 3바이트가 `EF BB BF`가 아님.
3. Windows PowerShell 5.1의 `System.Management.Automation.Language.Parser.ParseFile`이 오류를 반환.

가짜 Oracle 클라이언트는 임시 디렉터리의 `sqlplus.cmd`로 만들고 해당 디렉터리를 테스트 프로세스의 PATH 앞에 둔다. 클라이언트는 전달받은 argv를 임시 캡처 파일에 기록하고, export 스크립트가 넘긴 `@temp.sql`의 `SPOOL` 경로를 읽어 빈 DDL 산출물을 만든 뒤 0으로 종료한다. 검증 스크립트는 테스트 동안 다음 sentinel을 환경변수에 설정하되 스크립트 인자로 전달하지 않는다.

```powershell
$env:DB_PASSWORD = 'SEC11_PASSWORD_SENTINEL_7f3d'
```

실행 후 두 캡처 모두 `SEC11_PASSWORD_SENTINEL_7f3d`를 포함하지 않고, 연결 식은 프롬프트 모드의 `ITPAPP@127.0.0.1:11521/XEPDB1`만 포함해야 한다. README와 루트 `CLAUDE.md`는 사람 대상 운영 절차이므로 문자열 테스트를 만들지 않고 Task 6 리뷰에서 아래 현재 위치가 모두 프롬프트/Wallet 예시로 바뀌었는지 확인한다.

| 파일 | 위치 | 현재 형태 |
| --- | --- | --- |
| `it_database/README.MD` | 26, 220 | `sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1` |
| `it_database/README.MD` | 239, 250, 272 | `impdp`/`expdp "ITPAPP/$env:DB_PASSWORD@..."` |
| `it_database/README.MD` | 243, 278 | "환경변수 `DB_PASSWORD` 또는 `-Password` 인자로 전달" 서술 |
| 루트 `CLAUDE.md` | §3.1.1 (3곳) | `sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1` |

대상 3개:

```powershell
$scriptTargets = @(
    'C:\it\it_database\apply-ddl-live.ps1',
    'C:\it\it_database\export-ddl-live.ps1',
    'C:\it\it_backend\scripts\generate-jwt-secret.ps1'
)
```

검증 스크립트 자체는 작업공간 루트를 `$PSScriptRoot\..`에서 계산하며 사용자별 절대 경로를 하드코딩하지 않는다.

- [ ] **Step 2: 현재 상태에서 검증을 실행해 Password 매개변수 또는 BOM 누락으로 실패함을 확인한다**

```powershell
cd C:\it
pwsh -NoProfile -File .\scripts\verify-sec11-powershell.ps1
```

Expected: 명령 메타데이터의 `Password` 매개변수 또는 UTF-8 BOM 누락을 보고하고 non-zero exit. 기존 스크립트는 비밀번호가 필수이므로 가짜 클라이언트 실행 단계에 도달하지 못해도 올바른 RED다.

- [ ] **Step 3: 두 DDL 스크립트에서 비밀번호 입력 책임을 제거한다**

공통 파라미터는 다음 형태로 바꾼다.

```powershell
[string]$Username = "ITPAPP",
[string]$WalletAlias,
[string]$Schema = "ITPOWN"
```

연결 식:

```powershell
$connectIdentifier = if ([string]::IsNullOrWhiteSpace($WalletAlias)) {
    "$Username@$HostName`:$Port/$ServiceName"
} else {
    "/@$WalletAlias"
}
```

호출 규칙:

- 프롬프트 모드: `-S`를 빼서 비밀번호 프롬프트가 보이게 하고 `-L`, 연결 식, `@script`만 전달. `-L`은 로그온을 1회만 시도하므로 잘못된 비밀번호에서 무한 재프롬프트 없이 종료한다. `-S` 제거로 배너 출력이 늘지만 `apply-ddl-live.ps1`은 stdout을 파싱하지 않고 `$LASTEXITCODE`만 검사하므로 안전하다(현행 328~331행). `export-ddl-live.ps1`도 같은 구조인지 수정 전에 확인한다.
- Wallet 모드: 비밀번호 프롬프트가 없으므로 기존 silent 옵션 사용 가능.
- 로그에는 username/host/service 또는 wallet alias만 기록하고 비밀번호 변수 자체를 만들지 않음.
- 임시 SQL 파일에도 `CONNECT user/password` 문을 쓰지 않음.

- [ ] **Step 4: Data Pump·DDL·대화형 접속 문서를 프롬프트/Wallet 방식으로 갱신한다**

먼저 대화형 `sqlplus` 예시를 두 문서에서 함께 고친다. `it_database/README.MD` 26·220행과 루트 `CLAUDE.md` §3.1.1의 3곳은 같은 문장이므로 동일 형태로 맞춘다.

```powershell
# 변경 전
sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1

# 변경 후 — 비밀번호는 sqlplus가 콘솔에서 프롬프트로 받는다
sqlplus ITPAPP@127.0.0.1:11521/XEPDB1
```

스크립트 일괄 실행 예시(`sqlplus ... @경로\스크립트.sql`)도 같은 규칙을 따른다. 루트 `CLAUDE.md`는 `it_database`와 별도 저장소이므로 Step 8에서 루트 커밋에 포함한다.

Data Pump 프롬프트 예:

```powershell
impdp ITPAPP@127.0.0.1:11521/XEPDB1 parfile=.\it_database\import.par
impdp ITPAPP@127.0.0.1:11521/XEPDB1 parfile=.\it_database\import_data_only.par
expdp ITPAPP@127.0.0.1:11521/XEPDB1 parfile=.\it_database\export.par
.\it_database\apply-ddl-live.ps1
.\it_database\export-ddl-live.ps1
```

Wallet 예:

```powershell
impdp /@ITPAPP_PROD parfile=.\it_database\import.par
expdp /@ITPAPP_PROD parfile=.\it_database\export.par
.\it_database\apply-ddl-live.ps1 -WalletAlias ITPAPP_PROD
.\it_database\export-ddl-live.ps1 -WalletAlias ITPAPP_PROD
```

문서에는 Wallet alias가 `tnsnames.ora`와 Oracle Secure External Password Store에 사전 등록되어야 하며 wallet 파일 권한은 실행 계정으로 제한한다는 전제를 적는다. CI/무인 실행은 환경변수 평문 폴백을 재도입하지 않고 Wallet만 사용한다.

- [ ] **Step 5: 세 PowerShell 파일을 UTF-8 BOM으로 저장한다**

대상은 두 DB 스크립트와 `generate-jwt-secret.ps1`이다. 코드 동작 변경은 JWT 스크립트에 넣지 않는다. 저장 후 Git diff에서 JWT 파일은 BOM 외 본문 변경이 없어야 한다.

- [ ] **Step 6: PS 7과 Windows PowerShell 5.1 검증을 모두 실행한다**

```powershell
cd C:\it
pwsh -NoProfile -File .\scripts\verify-sec11-powershell.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-sec11-powershell.ps1
```

Expected: 둘 다 exit 0.

- [ ] **Step 7: 실제 Oracle 클라이언트 스모크 테스트를 수행한다**

개발 DB에서 `export-ddl-live.ps1`을 프롬프트 방식으로 1회 실행한다. 별도 터미널에서 실행 중인 `sqlplus`/`sql` 프로세스의 CommandLine을 조회해 비밀번호가 없고 `ITPAPP@127.0.0.1:11521/XEPDB1`만 있는지 확인한다. 산출 DDL 생성과 종료 코드 0도 확인한다.

Wallet이 준비된 환경에서는 같은 작업을 `-WalletAlias`로 1회 실행한다. Wallet 미구성 환경이면 이 케이스는 “운영 인계 검증 필요”로 결과에 명시하되 프롬프트 검증은 생략하지 않는다.

- [ ] **Step 8: 저장소별로 독립 커밋한다**

`it_database`:

```powershell
git add apply-ddl-live.ps1 export-ddl-live.ps1 README.MD
git commit -m "fix: Oracle 도구 비밀번호 인자 제거 (SEC-11)"
```

`it_backend`:

```powershell
git add scripts/generate-jwt-secret.ps1
git commit -m "chore: PowerShell 5.1 한글 스크립트 인코딩 보정 (SEC-11)"
```

루트:

```powershell
git add scripts/verify-sec11-powershell.ps1 CLAUDE.md
git commit -m "test: PowerShell 보안 및 인코딩 검증 추가 (SEC-11)"
```

---

### Task 7: SEC-10 — 1.x/2.x 호환 백포트 출시 후 조건부 lockfile 갱신

**Files:**

- Conditional Modify: `it_frontend/package-lock.json`
- Conditional Modify: `it_frontend/package.json` only if a narrow major-compatible override is proven necessary.
- Modify on completion: `TASK.md`, `TASK_DONE.md`

**Interfaces:**

- Preserves: `overrides["minimatch@10"]["brace-expansion"] = "^5.0.8"`.
- Rejects: top-level/global `"brace-expansion": "^5.0.8"` override.
- Exit condition: official advisory and npm registry both identify compatible patched releases for every installed 1.x/2.x line.

- [ ] **Step 1: 실행 당일 공식 릴리스 게이트를 확인한다**

```powershell
cd C:\it\it_frontend
npm view brace-expansion dist-tags versions --json
npm ls brace-expansion --all
```

동시에 GHSA-mh99-v99m-4gvg의 `Patched versions`를 확인한다. 1.x와 2.x 중 하나라도 패치가 없으면 여기서 중단하고 SEC-10을 `TASK.md`에 유지한다. 예상 버전 번호만 보고 진행하지 않는다.

- [ ] **Step 2: 백포트가 모두 존재할 때 lockfile을 정상 범위 안에서 갱신한다**

```powershell
cd C:\it\it_frontend
npm update brace-expansion
```

기존 minimatch의 `^1.1.7`, `^2.0.1`/`^2.0.2` 범위가 패치 버전을 선택하게 한다. npm이 오래된 중첩 lock을 유지할 때만 소비자별 dependency chain을 확인하고, 각 minimatch major가 원래 허용하는 brace-expansion major 안에서 narrow override를 추가한다.

- [ ] **Step 3: 설치 트리에서 취약 버전이 사라졌는지 확인한다**

```powershell
npm ls brace-expansion --all
```

2026-07-29 실측 기준 취약 사본의 실제 중첩 위치는 다음과 같다. `npm ls` 출력은 minimatch major별로 묶여 나오지 않고 아래 소비자 패키지 아래에 직접 붙으므로, 기대값을 "minimatch 3.x → …" 형태로 읽지 말고 경로별로 확인한다.

| 설치 경로 | 현재 버전 |
| --- | --- |
| `eslint/node_modules/brace-expansion` | 1.1.16 |
| `@eslint/config-array/node_modules/brace-expansion` | 1.1.16 |
| `@eslint/eslintrc/node_modules/brace-expansion` | 1.1.16 |
| `glob/node_modules/brace-expansion` | 1.1.16 |
| `editorconfig/node_modules/brace-expansion` | 2.1.2 |
| `js-beautify/node_modules/brace-expansion` | 2.1.2 |
| `nitropack/node_modules/brace-expansion` | 2.1.2 |
| `readdir-glob/node_modules/brace-expansion` | 2.1.2 |
| `minimatch/node_modules/brace-expansion` | 5.0.8 (override 적용 완료) |

Expected:

- 위 표의 1.x 4개 경로가 모두 공식 패치된 1.x로 올라감.
- 위 표의 2.x 4개 경로가 모두 공식 패치된 2.x로 올라감.
- `minimatch/node_modules/brace-expansion`은 5.0.8 이상 유지.
- `invalid`, `deduped invalid`, peer 오류 없음.

새 경로가 추가되었거나 위 목록이 실행 시점과 다르면 표를 실측으로 갱신한 뒤 판단한다.

- [ ] **Step 4: 해당 advisory만 audit에서 사라졌는지 구조적으로 검사한다**

```powershell
$auditJson = npm audit --json
$audit = $auditJson | ConvertFrom-Json
if ($null -ne $audit.vulnerabilities.'brace-expansion') {
    throw 'GHSA-mh99-v99m-4gvg가 npm audit에 남아 있습니다.'
}
```

다른 advisory가 남아 있어 `npm audit` 프로세스 자체가 1을 반환하는 것은 SEC-10 실패가 아니다. 결과 보고에는 전체 건수와 `brace-expansion` 제거 여부를 구분한다.

- [ ] **Step 5: 빌드 도구 호환 회귀를 실행한다**

```powershell
npm run format:check
npm run check
npm test
npm run generate -- --dry-run
```

Expected: 모두 PASS. CJS named export 오류나 minimatch 로딩 오류가 없어야 한다.

- [ ] **Step 6: diff가 의도한 의존성만 바꾸는지 확인하고 커밋한다**

```powershell
git diff -- package.json package-lock.json
git add package.json package-lock.json
git commit -m "fix: brace-expansion 호환 백포트 반영 (SEC-10)"
```

Nuxt, ExcelJS, ESLint의 major downgrade가 보이면 커밋하지 않고 lockfile 변경을 되돌린 뒤 원인을 재분석한다.

---

### Task 8: 전체 검증, 운영 인계, TASK 이관

**Files:**

- Modify: `TASK.md`
- Modify: `TASK_DONE.md`
- Modify: `versions.lock`
- Move after implementation completion: this plan from `docs/superpowers/plans/` to `docs/superpowers/done/` if the project’s existing done naming convention is preserved.

- [ ] **Step 1: 백엔드 전체 품질 게이트를 실행한다**

```powershell
cd C:\it\it_backend
.\gradlew clean test
.\gradlew check
```

Expected: PASS. 보안 공통 변경이므로 부분 테스트만으로 완료하지 않는다.

- [ ] **Step 2: 프론트 전체 품질 게이트를 실행한다**

```powershell
cd C:\it\it_frontend
npm run format:check
npm run check
npm test
```

SEC-10이 아직 대기 중이어도 SEC-14 프론트 변경 검증은 수행한다.

- [ ] **Step 3: PowerShell 보안 게이트를 재실행한다**

```powershell
cd C:\it
pwsh -NoProfile -File .\scripts\verify-sec11-powershell.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-sec11-powershell.ps1
```

- [ ] **Step 4: 운영 인계 체크리스트를 기록한다**

다음 증거를 `TASK_DONE.md`에 요약한다.

- SEC-12: 로그 캡처 sentinel(token/session/eno/body/IP) 비노출 테스트명과 적용된 4개 로그 경로.
- SEC-13: prod springdoc 두 속성 false와 anonymous/authenticated endpoint 기대값.
- SEC-14: Java/TypeScript 공통 허용·거부 입력 표와 프론트 진입점 4개 정적 확인(Task 3 Step 6) 결과.
- SEC-15: CSRF 보강 트리거 5개와 회귀 테스트명.
- SEC-11: 프로세스 CommandLine 확인, PS 5.1/7 파싱, Wallet 미검증 여부, 그리고 `it_database/README.MD`·루트 `CLAUDE.md`에서 정리한 자격증명 표기 위치.
- SEC-10: 실제 적용한 1.x/2.x/5.x 버전과 advisory 제거 결과. 아직 백포트가 없으면 기록·이관하지 않음.

- [ ] **Step 5: 완료된 TASK만 이관한다**

SEC-11~15 중 검증 완료된 행을 `TASK.md`에서 제거하고 `TASK_DONE.md`에 날짜·커밋·테스트 근거와 함께 추가한다. SEC-10은 Task 7의 공식 릴리스 게이트가 열리기 전까지 그대로 유지한다. 사용자의 기존 `TASK.md` 포맷 변경은 보존한다.

- [ ] **Step 6: 네 저장소 호환 커밋 조합을 갱신한다**

```powershell
cd C:\it
.\scripts\update-versions-lock.ps1
git diff -- versions.lock TASK.md TASK_DONE.md
```

- [ ] **Step 7: 루트 문서 변경을 커밋한다**

```powershell
git add TASK.md TASK_DONE.md versions.lock docs/superpowers scripts
git commit -m "docs: SEC-10~15 보안 조치 결과 기록"
```

## 완료 기준

- SEC-12: `SsoAgentClient.authorize()`/`isServerAlive()`와 `SsoController.checkauth()`/`complete()` 네 경로 모두에서 원문 token/session/eno/body/message/IP sentinel이 로그에 없고 인증 결과 반환은 불변.
- SEC-14: 백엔드와 프론트가 같은 safe-next 입력 표를 사용하고, 프론트 진입점 4개(`auth.global.ts`, `sso-auth-redirect.ts`, `login.vue` SSO 시작, `login.vue` 수동 완료)가 전부 공용 유틸만 호출하며, `//`, `/login`, 외부 URL, 빈 frontend URL 회귀가 테스트됨.
- SEC-13: prod에서 springdoc API/UI bean과 endpoint가 비활성이고 Security 공개 목록에서도 제외됨. local/dev 문서 접근은 유지.
- SEC-15: 현재 `csrf.disable()`의 전제, 경로별 잔여 위험, 보강 트리거, 목표 전환 방식이 문서화되고 설정 완화 시 테스트가 실패.
- SEC-11: DB 비밀번호가 소스·README·PowerShell 인자·프로세스 CommandLine·임시 SQL에 없고 PS 5.1/7에서 파싱됨.
- SEC-10: 외부 백포트가 실제 출시된 경우에만 완료. 모든 설치 line이 공식 patched version이고 빌드 도구 테스트가 통과.
- 각 저장소의 관련 테스트와 전체 품질 게이트가 통과하고 `versions.lock`이 실제 커밋 조합을 가리킴.

## 명시적 비범위

- SEC-10과 별개로 `npm audit`이 보고한 Nuxt/archiver/ExcelJS/ESLint 계열 다른 advisory의 일괄 해결.
- 현재 조건에서 CSRF 토큰을 즉시 도입하는 것. 트리거가 없는 동안에는 기존 UX/API 계약을 바꾸지 않는다.
- SSO 벤더 프로토콜, token authorization query-string 계약, `requestData` 추출 결과의 업무 사용 변경.
- Oracle Wallet 생성·배포 자동화와 wallet 파일 자체의 저장소 반입. Wallet은 DBA/운영 비밀 관리 절차의 대상이다.
- 운영 Swagger를 별도 관리자 네트워크에 재노출하는 기능. 필요하면 prod 비활성 정책을 대체하는 별도 승인 과제로 계획한다.

## 참고 근거

- GitHub Advisory GHSA-mh99-v99m-4gvg: 2026-07-24 갱신 상태에서 `brace-expansion <=5.0.7`, patched `5.0.8`만 명시(2026-07-30 재확인).
- npm `brace-expansion` dist-tags: `maintenance-v1=1.1.17`, `maintenance-v2=2.1.3`. 공식 advisory의 patched version에는 아직 포함되지 않았으며 설치 상태는 1.1.16/2.1.2/5.0.8, `npm audit`은 총 23건(22 high, `brace-expansion` high 포함)이다(2026-07-30 확인).
- SEC-15 최종 호환 main HEAD: backend `ae61469`, frontend `f079900`, database `0af106f`, root FP 증빙 `b33d148`. 후속 `cf62c96`은 `BoardReplySequenceMigrationIT`를 scheduler가 비활성화된 `@JdbcTest` 최소 JDBC slice로 격리했고, `bfcc9e1`은 새 업무 진입 전에 과거 복귀 세션·쿠키를 제거하며, 병합 후 `ae61469`는 migration source SHA를 줄끝 독립적으로 고정한다. migration IT 4건은 disposable 환경 부재로 skip됐으며 runtime은 배포 전 필수 게이트다.
- springdoc 공식 properties: `springdoc.api-docs.enabled=false`, `springdoc.swagger-ui.enabled=false`.
