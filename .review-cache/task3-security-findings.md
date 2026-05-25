# 보안 검토 결과 (task3-security-findings)

검토일: 2026-05-26  
검토 범위: `it_backend` 인증/인가 코드 (`SecurityConfig`, `JwtUtil`, `JwtAuthenticationFilter`, `AuthService`, `AuthController`, `DevAuthController`, `SsoController`, `CookieUtil`, `CustomPasswordEncoder`, `application.properties`)

---

## CRITICAL

### SEC-CRIT-01 — 운영 환경에서도 개발용 사용자 전환 API 노출 위험

**파일**: `DevAuthController.java`  
**라인**: 51  
```java
@ConditionalOnProperty(name = "app.dev.user-switch.enabled", havingValue = "true", matchIfMissing = true)
```
**문제**: `matchIfMissing = true`이므로 `app.dev.user-switch.enabled` 설정이 없으면 컨트롤러가 기본 활성화됩니다.  
`application.properties`에도 `app.dev.user-switch.enabled=true`로 설정되어 있습니다.  
이 API는 비밀번호 없이 임의 사번으로 JWT 쿠키를 재발급(`POST /api/auth/dev/switch-user`)하므로, 운영 배포 시 미설정이면 인증 우회가 됩니다.  
**영향**: OWASP A07 - Identification and Authentication Failures  
**조치**: 운영 프로파일에 `app.dev.user-switch.enabled=false` 명시 필수. `matchIfMissing`을 `false`로 변경하거나, 클래스 자체를 dev 프로파일 전용으로 제한(`@Profile("dev")`).

---

### SEC-CRIT-02 — `application.properties`에 하드코딩된 비밀값 기본값

**파일**: `application.properties`  
**라인**: 6, 20  
```properties
spring.datasource.password=${DB_PASSWORD:kdb1234!!}
jwt.secret=${JWT_SECRET:kdb-it-secret-key-for-jwt-token-generation-and-validation-must-be-at-least-256-bits}
```
**문제**: 환경변수 미설정 시 소스코드에 내장된 기본값이 운영에 그대로 사용됩니다.  
`EnvironmentValidator`는 프로퍼티 해석 결과가 빈값일 때만 차단하지만, 위의 기본값은 비어있지 않으므로 검증을 통과합니다.  
DB 비밀번호와 JWT 시크릿이 코드 저장소에 평문으로 존재합니다.  
**영향**: OWASP A02 - Cryptographic Failures, 비밀값 노출  
**조치**: `:default` 부분 제거. `EnvironmentValidator`에서 직접 환경변수 값을 검증하도록 수정.

---

## HIGH

### SEC-HIGH-01 — `Authorization: Bearer` 헤더 폴백이 운영 환경에서도 동작

**파일**: `JwtAuthenticationFilter.java`  
**라인**: 166–168  
```java
String bearerToken = request.getHeader("Authorization");
if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
    return bearerToken.substring(7);
}
```
**문제**: 헤더 폴백은 Swagger/Postman 편의용이지만 운영에서도 동일하게 동작합니다.  
httpOnly 쿠키 전략을 우회할 수 있으며, localStorage에서 읽은 토큰을 헤더로 보낼 수 있어 XSS 이후 2차 공격 경로가 됩니다.  
**영향**: OWASP A07 - Identification and Authentication Failures  
**조치**: 운영 프로파일에서 헤더 폴백 비활성화 또는 환경 플래그로 제어. 현재 CLAUDE.md §5.6에 결정 보류 상태 — 결정 필요.

---

### SEC-HIGH-02 — X-Forwarded-For 헤더 무조건 신뢰 (IP 위조 가능)

**파일**: `AuthController.java`  
**라인**: 254–272, `getClientIp()` 메서드  
**문제**: `X-Forwarded-For` 헤더를 아무 검증 없이 신뢰합니다. Nginx 등 리버스 프록시가 앞에 없을 경우 클라이언트가 임의 IP를 주입할 수 있어 로그인 이력의 IP 정보가 위조될 수 있습니다.  
**영향**: OWASP A05 - Security Misconfiguration (운영 인프라 구성 의존)  
**조치**: Nginx/WAF에서 `X-Forwarded-For`를 신뢰된 프록시만 설정하도록 인프라 구성. 인프라 설정이 불확실한 경우 `request.getRemoteAddr()` 우선 사용.

---

### SEC-HIGH-03 — `app.sso.allow-direct-eno` 활성화 시 인증 우회

**파일**: `SsoController.java`  
**라인**: 71, 250–252  
```java
@Value("${app.sso.allow-direct-eno:false}")
private boolean allowDirectEno;
// ...
if (allowDirectEno && directEno != null && !directEno.isBlank()) {
    return directEno; // GET 파라미터 eno=값으로 임의 사번 JWT 발급
}
```
**문제**: `app.sso.allow-direct-eno=true`이면 GET 파라미터 `eno=`에 임의 사번을 전달하여 SSO 절차 없이 JWT를 발급받을 수 있습니다. 기본값은 `false`이나, 개발 환경에서 `true`로 설정 후 운영 배포 시 실수로 포함되면 완전한 인증 우회가 발생합니다.  
**영향**: OWASP A07 - Identification and Authentication Failures  
**조치**: 기본값 `false` 유지 확인, 배포 체크리스트에 명시. 개발 프로파일 전용으로 제한 권장.

---

### SEC-HIGH-04 — 비밀번호 에러 메시지 분리 (사용자 열거 가능)

**파일**: `AuthService.java`  
**라인**: 148–158  
```java
if (userOpt.isEmpty()) {
    throw new RuntimeException("사용자를 찾을 수 없습니다.");
}
// ...
if (!passwordEncoder.matches(...)) {
    throw new RuntimeException("비밀번호가 일치하지 않습니다.");
}
```
**문제**: 에러 메시지가 분리되어 있어 공격자가 사번 존재 여부를 열거할 수 있습니다.  
**영향**: OWASP A07 - Identification and Authentication Failures (User Enumeration)  
**조치**: 두 경우 모두 "사번 또는 비밀번호가 올바르지 않습니다." 와 같이 동일한 메시지로 통일.

---

### SEC-HIGH-05 — `athIds` 클레임 타입 불일치 시 권한 조용히 제거

**파일**: `JwtUtil.java`  
**라인**: 171–173  
```java
// TODO: [B-M-04] athIds 클레임 타입 불일치 시 빈 권한 목록 반환 (warn 로그 없음)
return List.of();
```
**문제**: JWT의 `athIds` 클레임이 예상 타입(`List<String>`)이 아닐 경우 빈 리스트를 반환합니다.  
`CustomUserDetails`는 빈 리스트를 받으면 `ITPZZ001`(일반사용자)를 기본 적용하므로 관리자 세션이 일반 사용자로 강등될 수 있으며, warn 로그가 없어 탐지가 어렵습니다.  
**영향**: OWASP A01 - Broken Access Control  
**조치**: 타입 불일치 시 `log.warn()` 추가.

---

## MEDIUM

### SEC-MED-01 — 쿠키 Secure 플래그 기본값 false

**파일**: `application.properties` (라인 26), `CookieUtil.java` (라인 56–57)  
**문제**: `app.cookie.secure=false`가 기본값이므로 HTTP 환경에서 accessToken/refreshToken 쿠키가 암호화 없이 전송됩니다.  
**영향**: OWASP A02 - Cryptographic Failures  
**조치**: 운영 배포 시 `app.cookie.secure=true` 설정 필수 (CLAUDE.md 기재됨). 배포 파이프라인에서 자동 검증 추가 권장.

---

### SEC-MED-02 — Brute-force 잠금이 사번 기준만 (IP/기기 기준 없음)

**파일**: `LoginAttemptService` 참조  
**문제**: Brute-force 보호가 사번 기준 5회/10분입니다. 다른 사번으로 반복 시도하거나 IP를 바꾸며 공격하는 credential stuffing에 대한 방어가 없습니다.  
**영향**: OWASP A07 - Identification and Authentication Failures  
**조치**: IP 기준 전역 Rate Limiting 추가 권장 (TASK.md 등록 대상).

---

### SEC-MED-03 — 토큰 갱신 시 Refresh Token 로테이션 미적용

**파일**: `AuthService.java`, `refreshAccessToken()` 메서드  
**문제**: Access Token만 새로 발급하고 Refresh Token은 교체하지 않습니다. Refresh Token이 탈취된 경우 만료(7일)까지 계속 사용될 수 있습니다.  
**영향**: OWASP A07  
**조치**: Refresh Token 사용 시 새 Refresh Token도 함께 발급하는 Token Rotation 패턴 적용 검토.

---

### SEC-MED-04 — `DevAuthController.listUsers()`에서 전체 사용자 목록 노출

**파일**: `DevAuthController.java`  
**라인**: 67–76, `GET /api/auth/dev/users`  
**문제**: 컨트롤러 활성화 시 인증 사용자라면 누구나 전체 임직원 목록(사번/이름/부서)을 조회할 수 있습니다. `SecurityConfig`에서 `/api/auth/dev/**`에 대한 별도 Role 제한이 없습니다.  
**영향**: OWASP A01 - Broken Access Control (정보 노출)  
**조치**: SEC-CRIT-01 조치와 동일 (비활성화). 또는 `@PreAuthorize("hasRole('ADMIN')")` 추가.

---

## LOW

### SEC-LOW-01 — 공개 엔드포인트에 Rate Limiting 미적용

**파일**: `SecurityConfig.java`  
**문제**: `/api/auth/login`, `/api/auth/refresh` 등 공개 엔드포인트에 서버 레벨 Rate Limiting이 없습니다. Brute-force 보호는 로그인 서비스 계층에서만 동작합니다.  
**영향**: OWASP A07  
**조치**: Nginx rate limit 또는 Spring Bucket4j 도입 권장.

---

### SEC-LOW-02 — Swagger UI가 운영에서도 permitAll

**파일**: `SecurityConfig.java`  
**라인**: 127–128  
**문제**: Swagger UI가 인증 없이 접근 가능하며, 운영 프로파일에서 명시적으로 비활성화하는 설정이 없습니다.  
**영향**: OWASP A05 - Security Misconfiguration (API 명세 노출)  
**조치**: 운영 프로파일에 `springdoc.api-docs.enabled=false`, `springdoc.swagger-ui.enabled=false` 추가.

---

### SEC-LOW-03 — CSP에 `style-src 'unsafe-inline'` 포함

**파일**: `SecurityConfig.java`  
**라인**: 114  
**문제**: `style-src 'unsafe-inline'`은 CSS injection 공격 벡터를 열어둡니다.  
**영향**: OWASP A05  
**조치**: 가능하면 nonce 기반 또는 hash 기반으로 전환.

---

## 정책 예외 (재검토 불필요)

- **`CustomPasswordEncoder` SHA-256 + 빈 솔트**: KDB 사내 SSO 표준 규격이므로 보안 점검 결과에 재등재하지 않음. `@SuppressWarnings` 4건 + `NOSONAR` 마커 처리됨.

---

*검토자: security-reviewer agent (claude-sonnet-4-6), 2026-05-26*
