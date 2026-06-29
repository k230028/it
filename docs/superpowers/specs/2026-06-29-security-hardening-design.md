# 보안 하드닝 (TASK 보안·에러처리 전수 조치) 설계

> 🗓️ 작성일: 2026-06-29
> 🎯 목적: `TASK.md` 🔒 보안 7건과 ⚠️ 에러처리 잔여를 전수 조치한다. 결정 필요 항목은 본 설계에서 확정했다.
> 관련: [`TASK.md`](../../../TASK.md), 스파이크 [`2026-06-22-phase3-security-hardening-spike-blocklist.md`](../plans/2026-06-22-phase3-security-hardening-spike-blocklist.md)

---

## 1. 배경 및 확정된 결정

W2b 완료 후 잔여 보안 7건 + 에러처리 1건을 "모두 조치"하기로 했다. 결정 필요 항목은 브레인스토밍에서 확정:

| 항목 | 결정 |
| --- | --- |
| #1 `Authorization: Bearer` 헤더 폴백 | **운영 비활성화** — config gate(`app.auth.allow-bearer-header`, 기본 false), dev/swagger만 허용 |
| #4 Access Token Blocklist | **감내(☑️ Accepted)** — stateless 15분 단기 토큰·사내 3천명·T10로 탈취 탐지 대체. 미구현, 문서화만 |
| #5 [T10] Refresh Token 재사용 탐지 | **구현** — 토큰 패밀리/세대 스키마 + 회전 재작업 |
| #6 Tiptap metadata 카탈로그 권한 | **부서(bbrC) 기준 제한** |
| #7 사업집행 `changeStatus` role | **ADMIN 전용 전이** |

에러처리 "클래스 JavaDoc 누락 컨트롤러"는 W2b PR-2(`30dc249`)에서 이미 완료 → stale 종료.

## 2. PR 구성 (영역/위험도 분리)

| 단계 | 저장소 | 포함 | 성격 |
| --- | --- | --- | --- |
| **Phase 0** | parent | 에러처리 stale 종료 + #4 Blocklist 감내 문서화 | 백로그 정비 |
| **PR-1 토큰 하드닝** | it_backend | #1 Bearer gate + #5 T10 재사용 탐지(Flyway 스키마) | 동작 변경 + 스키마, 단독 격리 |
| **PR-2 권한 강화** | it_backend | #7 changeStatus ADMIN 전용 + #6 Tiptap metadata 부서 필터 | 동작 변경, TDD |
| **PR-3 운영검증+E2E** | it_backend + it_frontend | #3 SSO 안전장치 + #2 쿠키 변조 E2E | 안전장치 + 검증 |

진행 순서: Phase 0 → PR-1 → PR-2 → PR-3.

## 3. Phase 0 — 백로그 정비 (parent repo)

- 에러처리 §의 "클래스 JavaDoc 누락 컨트롤러 (PR-2 처리 예정)" 행 제거 → `TASK_DONE.md`로 이관(W2b PR-2 `30dc249`에서 AdminMenuController/AdminRouteController/MenuQueryController 보강 완료).
- 보안 § #4 Blocklist 행을 `⬜ Open` → `☑️ Accepted`로 변경, 근거(stateless·단기토큰·T10 대체) 1줄 추가.
- 본 설계 진행 시작 노트 추가.

## 4. PR-1 — 토큰 하드닝 (it_backend)

### 4.1 #1 Bearer 헤더 폴백 gate
- **문제**: `JwtAuthenticationFilter.java:165-168`이 쿠키 부재 시 무조건 `Authorization: Bearer`를 폴백 추출 — XSS로 탈취한 토큰의 헤더 전송 경로가 운영에서도 열림.
- **설계**: `app.auth.allow-bearer-header` 프로퍼티 신설. 베이스 `application.properties` 기본 `false`, `application-dev`/swagger 사용 프로파일에서 `true` 오버라이드. 필터가 플래그 false면 Bearer 추출 분기를 건너뛰고 쿠키 토큰만 사용.
- **검증(TDD)**: 필터 단위테스트 — 플래그 true 시 Bearer 토큰 인증, false 시 Bearer 무시(쿠키만). 기존 인증 흐름 회귀 없음.
- **문서**: `it_backend/CLAUDE.md §5.6` 토큰 추출 우선순위에 게이트 명시.

### 4.2 #5 [T10] Refresh Token 재사용 탐지
- **현황**: refresh token 엔티티 `Crtokm`(repo `RefreshTokenRepository`). `AuthService.refreshAccessToken`(L231-271)은 회전 시 구 토큰을 **삭제**하고 신규 저장 — 회전된 구 토큰 재제출 시 `findByTokCone` 미발견으로 단순 실패(`Refresh Token을 찾을 수 없습니다`). 탈취 후 재사용을 "정상 만료"와 구분 못 하고, 패밀리 폐기도 없음.
- **설계**:
  - **스키마(Flyway)**: `TPRMPP_CRTOKM`에 `ATR_GRP_ID`(속성그룹ID=토큰패밀리, 로그인 1회=1패밀리, VARCHAR2(50)) + `USE_YN`(사용여부, VARCHAR2(1): Y=활성 토큰 / N=회전된 구토큰) 컬럼 추가. `it_database/migrations/V*.sql` 신규(체크섬 추적 — 기존 스크립트 수정 금지).
  - **회전 로직 재작업**: 로그인 시 새 `ATR_GRP_ID` 부여(`USE_YN='Y'`). 회전 시 구 토큰을 삭제 대신 **`USE_YN='N'`(회전됨) 표식 유지**, 신규 토큰을 동일 `ATR_GRP_ID`·`USE_YN='Y'`로 저장. refresh 시:
    - 제출 토큰 `USE_YN='Y'`(활성) → 정상 회전.
    - 제출 토큰 `USE_YN='N'`(이미 회전됨) → **재사용 탐지 → 해당 패밀리(`ATR_GRP_ID`/eno) 전체 폐기**(로그 경고). 공격자·정상 사용자 모두 재인증 요구.
    - 미발견/만료 → 기존 처리.
  - **저장 증가 관리**: ROTATED 토큰 보존으로 행 증가 → 만료 경과분 정리(만료 시 또는 로그아웃 시 패밀리 일괄 삭제, 선택적 정리 배치). "1인 1 패밀리"로 동시 패밀리 수 제한.
  - **Repository**: `findByTokCone`(유지) + `deleteByFmlyId`/`findByFmlyId`/만료정리 메서드 추가.
- **검증(TDD)**: ① 정상 회전(ACTIVE→새토큰), ② 재사용(구 ROTATED 재제출→패밀리 전체 폐기 후 거부), ③ 만료, ④ 로그아웃 시 패밀리 삭제. 기존 `AuthServiceTest` 회전 테스트 전부 통과(회귀 격리).
- **격리 이유**: 회전 흐름은 인증 핵심 경로 → 단독 PR로 집중 검증.

## 5. PR-2 — 권한 강화 (it_backend)

### 5.1 #7 changeStatus ADMIN 전용
- **현황**: `Estimate/Deliberation/Contract/PaymentService.changeStatus`가 `OwnershipVerifier.verifyOwnerOrAdmin` + 인접 상태전이 검증만 수행 — 역할 분기 없음(소유자도 전이 가능).
- **설계**: changeStatus 진입 시 **ADMIN 전용 검증**으로 변경 — `CustomUserDetails.isAdmin()` 아니면 `AccessDeniedException`(403). 인접 상태전이 규칙(`작성중↔진행중↔완료`)은 유지. 4개 서비스 동일 적용.
- **동작 변경 명시**: 기존 소유자 전이 허용 → ADMIN만. 업무 결정(브레인스토밍 확정). update/delete/save* 등 다른 경로의 `verifyOwnerOrAdmin`은 유지(상태전이만 ADMIN).
- **검증(TDD)**: 비ADMIN(소유자 포함)→403, ADMIN→정상 전이, 비인접 전이는 기존대로 거부. CLAUDE.md §5.18 갱신("changeStatus 역할 분기 = ADMIN 전용 적용").

### 5.2 #6 Tiptap metadata 부서 필터
- **현황**: `TiptapVariableService.getMetadata`(인자 없음, `@Cacheable("tiptapMetadata")` 단일 캐시)가 전 인증 사용자에게 동일 PROJ 카탈로그 반환. resolve 단계는 이미 PROJ를 ADMIN/부서매니저로 제한(FORBIDDEN).
- **설계**: `getMetadata(CustomUserDetails user)`로 변경 — PROJ 카탈로그 프로젝트를 사용자 `bbrC` 기준 필터(ADMIN/부서매니저는 전체). `TiptapVariableController.getMetadata`가 principal 전달. 캐시 키를 부서(bbrC) 기준으로 변경(부서별 캐시) 또는 ADMIN/일반 + bbrC 조합.
- **검증(TDD)**: 일반 사용자→본인 부서 사업만, ADMIN→전체. 캐시 키 분리 동작 확인.

## 6. PR-3 — 운영 안전장치 + E2E

### 6.1 #3 SSO 운영 설정 검증 (it_backend)
- **현황**: `app.sso.allow-direct-eno=false`(기본 안전), `getClientIp()`가 `X-Forwarded-For`를 무조건 신뢰(IP 위조 가능, CLAUDE.md §5.6).
- **설계(코드 가능 범위)**:
  - `EnvironmentValidator` 확장: 운영 프로파일에서 `app.sso.allow-direct-eno=true` 또는 `app.dev.user-switch.enabled=true`면 기동 차단(고위험 개발용 플래그 운영 노출 방지). `app.frontend-url` 빈값 경고.
  - `AuthController.getClientIp()`: XFF 신뢰를 설정화 — `app.security.trusted-proxy-enabled`(기본 운영 true/로컬 false 등) 또는 신뢰 프록시 뒤에서만 XFF 채택, 그 외 `request.getRemoteAddr()` 사용.
- **검증(TDD)**: EnvironmentValidator — 운영+위험플래그 조합 시 예외. getClientIp — 신뢰 설정 on/off별 IP 출처.
- **범위 외(ops)**: `app.frontend-url`/CORS 실제 운영값 주입은 배포 체크리스트.

### 6.2 #2 it-portal-user 쿠키 변조 E2E (it_frontend)
- **현황**: `access-control.spec.ts`가 정상 역할 쿠키의 가드 동작은 검증하나, 위조 쿠키 케이스는 없음.
- **설계**: E2E 추가 — 위조 `it-portal-user`(ITPAD001 권한) 쿠키 + 유효 JWT(httpOnly accessToken) 없음 상태로 `/admin` 접근 → 관리자 화면 미노출 확인(프론트 가드 리다이렉트 또는 백엔드 API 401/403로 데이터 미표시). 프론트 쿠키는 UX 상태일 뿐 최종 권한은 백엔드 JWT가 판단함을 고정.
- **검증**: Playwright E2E. 백엔드+프론트 dev 기동 필요(실행은 환경 의존 — 미기동 시 스펙 작성·로컬 실행 가이드까지).

## 7. 검증 전략

- 백엔드: 대상 클래스 TDD + `./gradlew test` 신규 실패 0건(기존 8건 — CORS 속성해석·XCR·Committee — 무관). Flyway 마이그레이션은 `local-ext`/`local-int` 기동 적용 확인.
- 프론트: E2E + `npm run typecheck && npm run lint`.
- 통합테스트 인프라 부재(T18)로 #5의 실제 DB 회전은 단위(Mockito) + 마이그레이션 적용 기동으로 검증.

## 8. 범위 외 (별도)

- #4 Blocklist 구현(감내 결정), Bearer 운영 플래그 실제 주입·`app.frontend-url` 실제값(ops/배포), DECISION이었던 환율 통일(별도 트랙).
