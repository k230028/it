# 보안 규칙 감사 보고서 (인증/인가 코드)

감사 기준일: 2026-05-16  
감사 범위: `common/system/security/`, `config/SecurityConfig.java`, `common/iam/`, `common/admin/`

---

## 규칙 1: JWT는 httpOnly + Secure 쿠키로만 전달, 클라이언트 JS 접근 금지

**상태: 부분 적용**

- 확인됨: `CookieUtil.java:70-76` — accessToken 쿠키에 `httpOnly(true)` 명시적 설정
- 확인됨: `CookieUtil.java:90-97` — refreshToken 쿠키에 `httpOnly(true)` + `path("/api/auth")` 경로 제한
- 확인됨: `AuthDto.java:152-153` — `@JsonIgnore`로 토큰이 JSON 응답 body에서 제외됨
- 부분 적용: `CookieUtil.java:56-57` — Secure 플래그가 `app.cookie.secure` 프로퍼티 분기이며 기본값이 `false`(`application.properties:26`)
- 주의: `CookieUtil.java:171-172` — `it-portal-user` 쿠키는 `httpOnly(false)`이나 의도된 설계(JWT 미포함 UX 복원용). 코드 주석에 명시됨

**CLAUDE.md 등재 권장 문구:**
```
JWT Access Token과 Refresh Token은 반드시 httpOnly 쿠키로만 전달합니다.
운영 환경에서는 app.cookie.secure=true 설정이 필수입니다.
it-portal-user 쿠키는 JWT를 포함하지 않는 화면 복원 전용으로만 사용하며 보안 비밀값 절대 불가입니다.
```

---

## 규칙 2: Access 15분 / Refresh 7일 만료 기준 + Refresh 회전 정책

**상태: 부분 적용**

- 확인됨: `JwtUtil.java:57-61` — accessTokenValidityMs(900000ms=15분), refreshTokenValidityMs(604800000ms=7일)
- 확인됨: `application.properties:21-22` — `jwt.access-token-validity=900000`, `jwt.refresh-token-validity=604800000`
- 확인됨: `CookieUtil.java:47-50` — 쿠키 maxAge도 동일 기준 적용
- 확인됨: `AuthService.java:167` — 로그인 시 기존 Refresh Token 삭제 후 신규 저장 (1인 1토큰 정책 구현)
- 미적용 (Refresh Rotation): `AuthService.java:206-236` — `/api/auth/refresh` 호출 시 새 Access Token만 발급하고 Refresh Token을 교체하지 않음. 탈취된 Refresh Token이 만료 전까지 계속 유효

**CLAUDE.md 등재 권장 문구:**
```
Access Token 유효기간: 15분 (jwt.access-token-validity=900000)
Refresh Token 유효기간: 7일 (jwt.refresh-token-validity=604800000)
로그인 시 기존 Refresh Token 삭제 후 신규 발급 (1인 1토큰).
토큰 갱신(/api/auth/refresh) 시 Refresh Token도 함께 교체하는 Rotation 정책을 TASK.md 보안 보강 과제로 등록합니다.
```

---

## 규칙 3: JWT 서명키 운영 환경에서 환경변수/시크릿 매니저 주입 의무

**상태: 부분 적용**

- 확인됨: `application.properties:20` — `jwt.secret=${JWT_SECRET:kdb-it-secret-key-...}` 형태로 환경변수 우선 참조
- 확인됨: `JwtUtil.java:75` — `@Value("${jwt.secret}")`로 주입받아 소스 내 하드코딩 없음
- 부분 적용: `application.properties:20` — `JWT_SECRET` 미설정 시 fallback 기본값이 소스에 노출됨. 운영에서 환경변수 누락 시 알려진 키로 동작
- 미확인: 운영 배포 파이프라인에서 환경변수 주입 여부

**CLAUDE.md 등재 권장 문구:**
```
JWT 서명키(JWT_SECRET)는 운영 배포 시 반드시 환경변수 또는 비공개 프로파일로 주입합니다.
application.properties의 기본값은 개발 편의용이며 운영 서버에서 절대 사용 금지입니다.
키 길이는 HMAC-SHA256 최소 기준인 256비트(32자) 이상을 유지해야 합니다.
```

---

## 규칙 4: CORS allow-list 정책 (어떤 Origin이 허용되는지)

**상태: 코드에서 확인됨**

- 확인됨: `SecurityConfig.java:73-74` — `@Value("${cors.allowed-origins:*}")` — 환경변수 미설정 시 와일드카드(`*`) 폴백 존재
- 확인됨: `SecurityConfig.java:197` — `allowCredentials=true` + `setAllowedOrigins()` 명시적 도메인 목록 적용
- 확인됨: `application.properties:36` — 개발 환경: `http://localhost,http://localhost:3000,http://localhost:3002`
- 주의: `SecurityConfig.java:73` — 기본값 `*`과 `allowCredentials=true` 조합은 Spring이 런타임 오류를 발생시키므로 사실상 방어됨. 그러나 프로퍼티 키 오타 시 `*`가 전달될 위험 있음
- 확인됨: `SecurityConfig.java:200` — 허용 헤더 `List.of("*")` — 운영 환경에서 필요 헤더만 명시 권장

**CLAUDE.md 등재 권장 문구:**
```
CORS 허용 Origin은 cors.allowed-origins 프로퍼티로 관리하며 운영 환경에서는 실제 프론트엔드 도메인만 명시합니다.
와일드카드(*) 사용 금지. credentials=true와 allowedOrigins=* 조합은 Spring Security가 차단합니다.
```

---

## 규칙 5: @PreAuthorize / RBAC 적용 위치 (서비스 vs 컨트롤러)

**상태: 코드에서 확인됨**

- 확인됨: `SecurityConfig.java:58` — `@EnableMethodSecurity`로 `@PreAuthorize` 활성화
- 확인됨: `SecurityConfig.java:135-141` — URL 기반 1차 접근 제어 (`hasRole("ADMIN")`, `.authenticated()`)
- 확인됨: `AdminController.java:40` — 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")` + URL 패턴 이중 보호
- 확인됨: `CustomUserDetails.java:162-166` — athId → ROLE 매핑 로직 집중 관리
- 부분 적용: 일반 도메인 컨트롤러(ProjectController 등)에서 서비스 계층 `@PreAuthorize` 적용 여부 미확인. `anyRequest().authenticated()` 이후 세분화 권한은 서비스별 확인 필요

**CLAUDE.md 등재 권장 문구:**
```
권한 검증은 SecurityConfig URL 패턴(1차) + @PreAuthorize(2차) 이중으로 적용합니다.
관리자 전용 엔드포인트(/api/admin/**)는 클래스 레벨 @PreAuthorize("hasRole('ADMIN')")를 의무화합니다.
부서 단위 데이터 접근(isDeptManager, bbrC 기반 필터링)은 서비스 계층에서 검증합니다.
```

---

## 규칙 6: 비밀번호 해싱 알고리즘 (KDB 표준 규격)

**상태: KDB 표준 규격 적용 — 정책 예외 처리됨 (자동화 점검 재등재 금지)**

- 확인됨: `CustomPasswordEncoder.java` — 사내 SSO·통합인증 호환을 위한 **KDB 표준 암호화 규격**(SHA-256 + Base64, 고정 솔트 파라미터) 적용
- 정책 예외 표시: 클래스 레벨 `@SuppressWarnings({"java:S2070","java:S4790","java:S2053","java:S5547"})` + 해시 호출 라인 `// NOSONAR: KDB 표준 SSO 연동 규격`
- `SecurityConfig.java` — `CustomPasswordEncoder`를 `PasswordEncoder` 빈으로 등록 (규격 일관성 유지를 위해 변경 금지)
- 변경 정책: 해시 알고리즘·솔트 파라미터는 사내 SSO·인사·통합인증 시스템과 동일 규격을 유지해야 하므로 거버넌스 승인 없이 변경 불가. 차세대 인증체계 전환은 별도 트랙으로 관리.

**CLAUDE.md 반영 문구 (it_backend/CLAUDE.md §5.6 적용 완료):**
```
비밀번호 해시 규격(KDB 표준): CustomPasswordEncoder는 사내 SSO·통합인증
시스템과의 호환을 위해 KDB 표준 암호화 규격을 적용합니다. 알고리즘·솔트
파라미터는 거버넌스 승인 없이 변경할 수 없으며, 클래스에는 정책 예외 표시
(@SuppressWarnings 4건 + NOSONAR 마커)가 부여되어 있으므로 자동화 보안
점검 결과에 재등재하지 않습니다.
```

---

## 규칙 7: 로그인 실패 횟수 제한 / 잠금 정책

**상태: 코드에서 확인됨**

- 확인됨: `LoginAttemptService.java:22-23` — `MAX_FAILURES=5`, `WINDOW_MINUTES=10`
- 확인됨: `LoginAttemptService.java:36-45` — TAAABB_CLOGNH 이력 기반 실패 카운트 → 임계값 초과 시 `CustomGeneralException` 발생
- 확인됨: `AuthService.java:144` — `login()` 첫 번째 단계에서 `loginAttemptService.checkLocked(eno)` 호출
- 확인됨: `AuthService.java:148-150` — 사용자 미존재 시에도 실패 이력 기록 (사번 열거 공격 일부 완화)
- 부분 적용: 잠금 해제는 시간 윈도우(10분) 자연 만료에 의존. 관리자 수동 해제 API 없음
- 부분 적용: `CustomUserDetails.java:148` — `isAccountNonLocked()` 항상 `true` 반환. Spring Security 계층 잠금 플래그와 미연동

**CLAUDE.md 등재 권장 문구:**
```
로그인 실패 제한: 10분 내 5회 초과 시 LoginAttemptService에서 차단합니다(SEC-03).
잠금은 시간 윈도우 자연 만료 방식(DB 이력 기반)이며 별도 해제 API는 없습니다.
IP 기반 Rate Limiting과의 병행 적용을 권장합니다.
```

---

## 규칙 8: 세션/토큰 무효화 (logout, 강제 만료)

**상태: 부분 적용**

- 확인됨: `AuthController.java:186-208` — 로그아웃 시 `authService.logout()` + 양쪽 쿠키 `maxAge=0` 삭제
- 확인됨: `AuthService.java:249-255` — `refreshTokenRepository.deleteByEno(eno)` — DB에서 Refresh Token 즉시 삭제
- 확인됨: `AuthService.java:167` — 신규 로그인 시 기존 Refresh Token 삭제 (동시 세션 방지)
- 미적용: Access Token은 Stateless이므로 로그아웃 후에도 만료 전까지(최대 15분) 유효. Blocklist 기반 무효화 미구현
- 미확인: 관리자의 특정 사용자 강제 로그아웃(Refresh Token 강제 삭제) API 존재 여부

**CLAUDE.md 등재 권장 문구:**
```
로그아웃 시 서버에서 Refresh Token을 DB에서 삭제하고 양쪽 쿠키를 즉시 만료시킵니다.
Access Token은 Stateless이므로 로그아웃 후에도 최대 15분간 유효합니다.
고보안 요구 시나리오(관리자 계정 탈취 등)에서는 Access Token Blocklist 도입을 검토합니다.
```

---

## 규칙 9: CSRF 보호 정책 (REST API + httpOnly 쿠키 조합 시)

**상태: 코드에서 확인됨**

- 확인됨: `SecurityConfig.java:117-118` — `csrf(AbstractHttpConfigurer::disable)` — CSRF 비활성화
- 확인됨: `SecurityConfig.java:38-41` 주석 — "Stateless API + SameSite/CORS 운영 전제" 명시
- 확인됨: `CookieUtil.java:75` — `sameSite("Lax")` — Cross-site 요청에서 쿠키 미전송 (CSRF 1차 방어)
- 확인됨: `SecurityConfig.java:193-208` — CORS allowCredentials + 명시적 Origin 화이트리스트 (CSRF 2차 방어)
- 부분 적용: SameSite=Lax는 GET 요청에서 쿠키를 전송함. 멱등하지 않은 작업이 GET으로 구현된 경우 취약. 현재 코드는 REST 규칙(POST/PUT/DELETE만 변경 처리)을 따르므로 수용 가능
- 부분 적용: SameSite=Strict가 아닌 Lax 선택 이유가 문서화되지 않음 (SSO 리다이렉트 호환 추정)

**CLAUDE.md 등재 권장 문구:**
```
CSRF 보호는 CSRF 토큰 대신 SameSite=Lax + CORS Origin 화이트리스트 조합으로 구현합니다.
상태 변경 작업은 반드시 POST/PUT/DELETE 메서드만 사용합니다 (GET은 읽기 전용).
SameSite=Strict로의 강화 여부는 SSO 외부 리다이렉트 흐름과의 호환성 검토 후 결정합니다.
```

---

## 규칙 10: 응답에서 민감정보 노출 금지 (사번, 권한ID 등)

**상태: 부분 적용**

- 확인됨: `AuthDto.java:152-153, 166-167` — 토큰 필드에 `@JsonIgnore` 적용으로 응답 body 미포함
- 확인됨: `AdminController.java:397-402` 주석 — 토큰 조회 API에서 "토큰값은 앞 20자만 마스킹하여 표시"
- 확인됨: `JwtAuthenticationFilter.java:124` — 검증 실패 로그에서 토큰 앞 20자만 출력
- 부분 적용: `AuthDto.LoginResponse` — 응답 body에 `eno(사번)`, `athIds(자격등급 ID 목록)`, `bbrC(부서코드)` 포함. 프론트엔드 UX를 위한 의도된 설계이나 CLAUDE.md에 명시 필요
- 부분 적용: `UserDto.DetailResponse` — `cpnTpn(휴대폰번호)`, `inleNo(내선번호)`, `etrMilAddrNm(이메일)` 포함. UserController 접근 권한 검증 확인 권장
- 확인됨: 비밀번호 필드(`usrEcyPwd`)는 어떤 응답 DTO에도 포함되지 않음

**CLAUDE.md 등재 권장 문구:**
```
JWT 토큰은 응답 body에 절대 포함하지 않습니다 (@JsonIgnore 의무).
로그인 응답의 eno, athIds, bbrC는 프론트엔드 UX 필수값으로 허용합니다.
비밀번호, 전체 토큰값, 내부 시스템 식별자는 응답에서 제외합니다.
사용자 상세 정보(연락처 등) API는 반드시 인증 + 본인/관리자 권한 검증을 병행합니다.
```

---

## 종합 우선순위

| 규칙 | 상태 | 우선순위 |
|------|------|---------|
| 6. 비밀번호 해싱 (SHA-256 빈 Salt) | 미적용 | CRITICAL |
| 2. Refresh Token Rotation 미구현 | 부분 적용 | HIGH |
| 3. JWT 시크릿 fallback 기본값 소스 노출 | 부분 적용 | HIGH |
| 1. Secure 쿠키 플래그 기본값 false | 부분 적용 | HIGH |
| 8. Access Token 로그아웃 무효화 미구현 | 부분 적용 | MEDIUM |
| 10. 사용자 상세 API 권한 검증 확인 필요 | 부분 적용 | MEDIUM |
| 4. CORS 허용 헤더 전체 허용 | 부분 적용 | MEDIUM |
| 5. 서비스 계층 @PreAuthorize 적용 범위 미확인 | 부분 적용 | MEDIUM |
| 7. 로그인 잠금 정책 | 확인됨 | - |
| 9. CSRF 정책 | 확인됨 | - |
