# 보안·에러 처리 잔여과제 조치 설계 (Remediation Roadmap)

- **작성일**: 2026-07-19
- **상태**: 승인 대기 (사용자 검토 중)
- **범위**: `TASK.md`의 🔒 보안(SEC-03~07), ⚠️ 에러 처리(ERR-03~07) 전 10개 항목
- **형태**: 통합 로드맵 1건 — 우선순위 3단계(Phase) 구성. 각 항목은 설계 수준까지 기술하고, 실제 구현은 Phase별 후속 계획(plan)으로 진행
- **선행 관련 스펙**:
  - `2026-06-22-ownership-authorization-hardening-design.md` (OwnershipVerifier 기반 인가)
  - `2026-06-29-security-hardening-design.md` (보안 강화 1차)
  - `2026-06-23-backend-error-handling-design.md`, `2026-06-24-frontend-error-handling-design.md`, `2026-06-24-frontend-error-feedback-sweep-design.md` (에러 처리 패턴 계보)

---

## 1. 목표와 비목표

### 1.1 목표

1. 인증·인가의 실제 우회 경로(토큰 용도 미검증, 비게시판 파일 무인가 읽기)를 차단한다.
2. 토큰 저장·로그아웃·운영 토글의 잔여 위험을 제거한다.
3. 실패를 삼키되 **유실을 탐지·복구할 수 없는** 경로(감사로그, AFTER_COMMIT 알림)에 관측·재시도 수단을 추가한다.
4. 조회·변환 실패가 **정상 빈 상태와 구분 불가능하게** 처리되는 프론트 경로를 사용자에게 드러낸다.

### 1.2 비목표 (명시적 제외)

- 알림·감사 실패가 원 업무를 롤백하게 만들지 않는다. **CLAUDE.md §7의 "실패가 원 업무를 롤백하면 안 되는 부수효과" 정책은 유지**하고, 탐지·복구 수단만 추가한다.
- SSE/WebSocket 실시간 push 전환(LOG-03)·EAI 운영값 확정(EAI-*) 등 외부·운영 의존 과제는 본 로드맵 범위 밖이다.
- ERR-04는 운영 코드 변경을 만들지 않는다(§5.2 참조).

### 1.3 기존 정책과의 정합성

| 정책 SoT | 본 설계의 준수/변경 |
| --- | --- |
| CLAUDE.md §5 (인증·인가) | SEC-04/06/07은 §5를 **강화**. **SEC-05는 §5의 "그 외 업무 파일 읽기는 별도 소유권 제한이 구현된 것으로 간주하지 않습니다" 문장을 반전** → §5 및 `file-security.md`·`data-scope.md` 동시 갱신 필요 |
| CLAUDE.md §6 (부서·소유권 범위) | SEC-05는 `OwnershipVerifier`·`AuthorOrgResolver`·`bbrC` JWT 기준 재사용 |
| CLAUDE.md §7 (이벤트·알림·외부 연동) | ERR-05/06은 삼킴·비롤백 정책 **유지**, 관측·복구만 추가 |

---

## 2. 실행 순서 (Phase)

| Phase | 우선순위 | 항목 | 성격 |
| :---: | :---: | --- | --- |
| **1** | 🔴 High | SEC-04, SEC-05, ERR-06 | 실제 우회·유실 위험 즉시 차단 |
| **2** | 🟠 Medium | SEC-06, SEC-07, SEC-03, ERR-05, ERR-07 | 잔여 위험·신뢰성·UX |
| **3** | 🟢 Low | ERR-03, ERR-04 | 정리·문서화 |

Phase 내 항목은 상호 독립적이라 병렬 진행 가능하다. 단 **SEC-06은 SEC-04(토큰 용도 claim) 이후**에 착수해 토큰 검증 로직 충돌을 피한다.

---

## 3. Phase 1 — 🔴 High

### 3.1 SEC-04 · Access/Refresh 토큰 용도 구분과 검증 강제

**현황/격차**
- `JwtUtil.generateAccessToken`(claims: `sub`,`athIds`,`bbrC`), `generateRefreshToken`(claims: `sub`,`jti`) 모두 **용도(type) claim이 없다**.
- `JwtUtil.validateToken`은 서명+만료만 검사한다. 두 토큰은 **동일 `secretKey`로 서명**된다.
- 결과: refresh 토큰을 `accessToken` 쿠키로 제출하면 `JwtAuthenticationFilter`를 통과한다. `athIds`가 없어 기본 `ROLE_USER`(`ITPZZ001`)로 다운그레이드되지만, **access 보호 경로에 대한 기본 인증 접근이 성립**한다.

**목표**: 각 토큰이 자신의 용도 경로에서만 유효하도록 강제한다.

**조치 설계**
1. `JwtUtil`: 발급 시 `typ` claim 추가 — access는 `"access"`, refresh는 `"refresh"`.
2. `JwtUtil`: `parseTokenType(token)` 또는 `validateToken(token, expectedType)` 추가. 기대 용도 불일치 시 인증 실패로 처리.
3. `JwtAuthenticationFilter`: access 경로에서 `typ=access`만 인정.
4. `AuthService.refreshAccessToken`: `typ=refresh`만 인정(현행 DB 조회 미스 의존 → 명시적 claim 검증으로 대체·보강).
5. **롤링 배포 호환**: 배포 과도기에 `typ` 없는 기존 토큰 존재 가능.
   - access 필터: `typ` 부재를 한시 허용(access 15분 만료로 자연 소멸). 전환 완료 후 엄격화하는 후속 커밋을 계획에 포함.
   - refresh: 부재도 엄격 거부(7일 수명이라 한시 허용 위험이 큼) → 기존 refresh 토큰 보유자는 재로그인 유도.

**영향 파일**: `common/system/security/JwtUtil.java`, `JwtAuthenticationFilter.java`, `common/system/service/AuthService.java`

**검증**
- 단위: refresh 토큰 → access 경로 401, access 토큰 → `/api/auth/refresh` 401, 정상 access → 통과.
- `typ` 없는 토큰의 과도기 동작(access 허용 / refresh 거부) 테스트.

---

### 3.2 SEC-05 · 비게시판 업무 파일 읽기 권한을 부모 자원 기준으로 검증

> ⚠️ **정책 반전 항목**: 이 변경은 CLAUDE.md §5에 문서화된 현행 정책("그 외 업무 파일 읽기는 별도 소유권 제한이 구현된 것으로 간주하지 않습니다")을 **의도적으로 뒤집는다**. 코드와 함께 정책 문서를 갱신한다.

**현황/격차**
- `FileOwnershipChecker.canRead(Cfilem, user)`: `pkColNm != "공통게시판"`이면 **리포지토리 조회 없이 `true` 반환**(무조건 허용). 공통게시판만 게시물 공개여부(`isPostVisible`)를 검증.
- `checkReadAccess`(단건 다운로드·미리보기·메타)와 `FileService.getFiles`(목록 필터)가 모두 `canRead`에 위임 → **모든 비게시판 업무 파일이 임의 인증 사용자에게 열림**.
- 파일 종류 키는 `PK_COL_NM`(예: `요구사항정의서`, `정보화사업`, `전산관리비`, `공통게시판`), 연결 레코드 키는 `PK_CONE`. (레거시 `ORC_DTT` 컬럼은 존재하지 않음 — javadoc 잔재)
- 파일 종류 문자열은 **프론트 업로드 호출부에서 `pkColNm` RequestPart로 지정**되므로, 완전 매핑을 위해 전체 종류 집합을 먼저 확정해야 한다.

**목표**: 파일 종류별로 부모 업무 자원의 읽기 권한과 동일하게 검증하고, 목록·메타·다운로드·미리보기에 일관 적용한다. (사용자 결정: **종류별 부모권한 완전 매핑**)

**조치 설계**
1. **파일 종류 집합 확정(구현 선행 작업)**: 프론트 업로드 호출부(`pkColNm` 지정 지점) + 로컬 Oracle `SELECT DISTINCT PK_COL_NM FROM TPRMPP_CFILEM`을 대조해 실제 사용 종류를 열거한다. 결과를 본 스펙 §7 미결 항목에 확정 기재.
2. **Resolver 레지스트리 도입**:
   - 인터페이스 `FileReadAuthorizer { boolean canRead(Cfilem file, CustomUserDetails user); }`.
   - 종류별 구현을 `Map<String(pkColNm), FileReadAuthorizer>`로 등록(스프링 빈 수집).
   - 각 구현은 `PK_CONE`로 부모 레코드를 조회해 해당 도메인의 기존 읽기 권한을 재사용한다.
     - 예) `정보화사업` → 사업 주관부서(`BPROJM.SVN_DPM_C`) 또는 관리자(사업계획 정책과 정합).
     - 예) `공통게시판` → 현행 `isPostVisible` 유지.
     - 소유자 기준이 필요한 종류 → `OwnershipVerifier`/`FST_ENR_USID` 재사용.
3. **default-deny(fail-safe)**: 레지스트리에 등록되지 않은 종류는 **관리자 외 거부**. 신규 종류 추가 시 authorizer 등록을 강제.
4. `canRead`를 레지스트리 위임 구조로 재작성. `checkReadAccess`·`getFiles` 경로는 그대로 `canRead` 사용(일관성 유지).
5. **정책 문서 갱신**: `it_backend/CLAUDE.md` §5, `docs/guides/security/file-security.md`, `docs/guides/security/data-scope.md`를 새 규칙으로 정정.

**영향 파일**: `infra/file/FileOwnershipChecker.java`, 신규 `infra/file/authz/*Authorizer.java` + 레지스트리, `infra/file/service/FileService.java`(필요 시), 각 도메인 권한 조회 재사용부, 정책 문서 3종.

**검증**
- 통합(`@Tag("it")`): 종류별로 (a) 부모권한 보유 사용자 허용, (b) 타부서/무권한 사용자 거부를 목록·메타·다운로드·미리보기 4경로에서 확인.
- default-deny: 미등록 종류 파일이 일반 사용자에게 거부되는지 확인.

---

### 3.3 ERR-06 · 감사로그 저장 실패의 지속 탐지 수단 추가

**현황/격차**
- `ChangeLogEntityListener.persistLog`가 `AuditLogPersister.persist` 실패를 `catch (Exception) → log.error`로 **삼킨다**(원 업무 보호 목적, 의도적). 삼킴 자체는 CLAUDE.md §9(감사) 및 주석에 명시된 설계.
- 문제: **메트릭·알람이 없어** 감사 추적 유실을 지속적으로 식별할 수 없다. `log.error` 한 줄에만 의존.
- 재귀 로깅 위험: 현재는 catch 내부에서 DB 쓰기를 하지 않아 **우연히** 방지된 상태(코드 가드는 없음). 향후 알람을 순진하게 추가하면 감사 대상 재기록으로 재귀 유발 가능.

**목표**: 삼킴·원업무 보호 정책은 유지하되, 감사 유실을 즉시·지속적으로 탐지하고 향후 알람 확장을 안전화한다.

**조치 설계**
1. `persistLog` catch에 **Micrometer 카운터** 증가: `audit.log.write.failure`(태그: 엔티티 타입, 작업 유형). 운영 대시보드·알람이 이를 소비.
2. 구조화 error 로그 유지(엔티티/PK/작업). 비밀값·PII 미기록(CLAUDE.md §9).
3. **재귀 방지 가드**: `ThreadLocal<Boolean>` 플래그로 "감사 실패 처리 중" 재진입을 차단. 향후 catch 내 알림/감사 유발 코드가 추가돼도 재귀 불가하도록 명시적 가드를 지금 심는다.
4. 폭주 방지: 필요 시 카운터 외 로그는 rate-limit.

**영향 파일**: `domain/log/listener/ChangeLogEntityListener.java`, (메트릭 설정) Micrometer 등록부.

**검증**
- 감사 저장 강제 실패 주입 시: 원 업무 커밋 유지 + `audit.log.write.failure` 증가 + 재귀 미발생. 기존 삼킴 계약 테스트(`ChangeLogEntityListenerTest`) 확장.

---

## 4. Phase 2 — 🟠 Medium

### 4.1 SEC-06 · 로그아웃·Refresh Token 저장·로그 마스킹 보강

**현황/격차**
- `Crtokm.tokCone`(`API_TOK_CONE`)에 refresh JWT를 **평문 저장**. SHA-256(`ECY_RNW_PUB_TOK_CONE`)은 조회용으로만 병행 → DB 유출 시 사용 가능한 토큰 노출.
- `AuthController.logout`은 SecurityContext의 `eno`로 폐기한다. **access 토큰이 만료되면** 컨텍스트가 비어 `deleteByEno`가 호출되지 않고 쿠키만 클라이언트에서 삭제 → refresh 패밀리가 서버에 최대 7일 잔존.
- 로그 마스킹은 대체로 양호(전체 JWT 로깅 없음) — 잔여 점검만.

**목표**: refresh 토큰을 비가역 저장하고, access 만료 상태에서도 로그아웃이 서버 패밀리를 폐기하게 한다.

**조치 설계**
1. **해시 전용 저장**: `tokCone` 평문 저장 중단. 회전·재사용 탐지·조회를 모두 SHA-256(`ecyRnwPubTokCone`) 기준으로 통일(현행 `findByEcyRnwPubTokCone`·`sha256HexForToken` 재사용). 저장 컬럼은 해시만 유지.
2. **쿠키 기반 로그아웃**: `AuthController.logout`이 `refreshToken` 쿠키(경로 `/api/auth`)를 읽어 해시→패밀리 조회→`deleteBy...`로 폐기. access 만료 여부와 무관하게 동작. SecurityContext 존재 시 `eno` 교차검증.
3. **마이그레이션**: 기존 평문 로우는 Flyway로 정리(컬럼 용도 변경/평문 값 제거). 기존 보유자는 재로그인 유도. `V{YYYYMMDD_NNN}__` 규칙 준수, 적용 스크립트 수정 금지.
4. 로그 마스킹 잔여 점검: 실패 응답 본문 등 재확인(신규 위반 없으면 무변경).

**영향 파일**: `common/system/entity/Crtokm.java`, `common/system/repository/RefreshTokenRepository.java`, `common/system/service/AuthService.java`, `common/system/controller/AuthController.java`, `it_database/migrations/V*.sql`.

**검증**
- access 만료 상태 로그아웃 → 서버 refresh 패밀리 revoke 확인.
- 저장 로우에 평문 토큰 부재 확인. 회전·재사용 탐지 회귀 테스트.

---

### 4.2 SEC-07 · 운영 인증 우회 토글과 SSO 세션 고정 방어 검증

**현황/격차**
- `EnvironmentValidator.validateProdKeys`가 `app.sso.allow-direct-eno`·`app.dev.user-switch.enabled`·CORS 와일드카드는 차단하지만 **`sso.mock-enabled`·`app.auth.allow-bearer-header`는 미검증** → 운영에서 조용히 켜질 수 있음(mock SSO는 임의 `mockEno` 로그인).
- SSO 성공 경계(`SsoController.complete`/`proceedToComplete`)에서 **세션 ID 재발급 없음**(`changeSessionId` 미사용) → 세션 고정 공격에 노출.
- `app.cookie.secure` 기본 `false` + `EnvironmentValidator` 미검증 → 운영 오설정 시 `Secure` 없는 인증 쿠키 발급 가능.

**목표**: 운영 기동에서 우회 토글을 차단하고, SSO 인증 경계에서 세션 고정을 방어한다.

**조치 설계**
1. `EnvironmentValidator.validateProdKeys`에 운영 차단 추가: `sso.mock-enabled=true`, `app.auth.allow-bearer-header=true`, `app.cookie.secure=false` → 기동 실패(fail-fast).
2. SSO 성공 경계에서 `request.changeSessionId()` 호출로 JSESSIONID 교체(검증 eno 소비 직전/직후). 세션 스코프 검증 데이터 이관 주의.
3. 쿠키 정책 재확인: 운영에서 `Secure` 강제(위 1의 검증으로 담보).

**영향 파일**: `common/system/EnvironmentValidator.java`, `common/sso/SsoController.java`, (참조) `common/util/CookieUtil.java`, `common/sso/SsoProperties.java`.

**검증**
- 운영 프로파일에서 금지 토글 활성 시 기동 실패.
- 로그인 전후 JSESSIONID 변경 확인(세션 고정 방어).

---

### 4.3 SEC-03 · 외부 EAI/GWE 발송 채널 IF_ID 단일화

**현황/격차**
- 임시 GWE `IF_ID="IPPG00000001"`가 `NotificationDispatcherRouter.GWE_IF_ID` 상수 1곳 + **집행 4단계 서비스에 하드코딩 4곳**(`EstimateService:278`, `DeliberationService:212`, `ContractService:210`, `PaymentService:248`)에 중복. 설정 프로퍼티화 안 됨 → 운영 확정 시 5곳 수정 필요.

**목표**: IF_ID를 단일 설정 지점으로 모으고, 4단계 서비스가 이를 참조하게 한다.

**조치 설계**
1. 설정 프로퍼티 `eai.gwe.if-id` 신설(기본값=현 임시값 `IPPG00000001`, 환경변수 주입 가능). CLAUDE.md §7·EAI 가이드 정합.
2. `NotificationDispatcherRouter`와 집행 4단계 서비스의 하드코딩·상수를 프로퍼티 주입으로 교체. 운영 확정 시 **프로퍼티 1곳만 변경**.
3. 테스트 상수(`EaiServiceTest`)도 프로퍼티/공용 상수 참조로 정리.

**영향 파일**: `common/notification/dispatcher/NotificationDispatcherRouter.java`, `domain/estimate|deliberation|contract|payment/service/*Service.java`, EAI 설정 프로퍼티 클래스, 관련 테스트.

**검증**: 프로퍼티 미주입=기본값 사용, 주입=반영. 4단계 발송 경로 회귀.

---

### 4.4 ERR-05 · AFTER_COMMIT 알림 실패의 재시도·운영 탐지 경로 추가

**현황/격차**
- `NotificationEventListener`의 3개 `@TransactionalEventListener(AFTER_COMMIT)` 핸들러와 `NotificationDispatcherRouter.dispatchGwe`가 실패를 전부 `log.warn`으로 삼킨다. **outbox·재시도·알람 없음**.
- `Cinfmm.markDispatched`가 `finally`에서 `SD_DTM`을 찍어 **"발송 시도"일 뿐 "발송 성공" 신호가 아니다**. 성공/실패를 구분하는 상태가 없다.
- `NotificationService.send`의 `saveAndFlush`가 AFTER_COMMIT 리스너 안에서 실패하면 원 업무는 이미 커밋되어 알림만 유실.

**목표**: 삼킴·비롤백 정책을 유지하되, 유실을 탐지하고 자동 복구(재시도)한다. (사용자 결정: **Cinfmm 상태기반 outbox 확장**)

**조치 설계**
1. `Cinfmm`에 **명시적 발송상태** `SD_ST`(예: `PENDING`/`SENT`/`FAILED`) 추가. `SD_DTM`은 "시도 시각"으로 의미 유지, 성공 판정은 `SD_ST=SENT`로 분리.
2. 발송 경로:
   - 저장 직후 `PENDING`.
   - dispatcher 성공 → `SENT`(+ `SD_DTM`).
   - 실패/예외 → `FAILED`(+ 실패 사유 최소 기록) + **실패 메트릭**(`notification.dispatch.failure`).
3. **스케줄 재발송**: 주기 작업이 `FAILED`(및 오래된 `PENDING`) 행을 조회해 제한 횟수 재시도. 재시도 소진 시 상태 유지 + 운영 알람 대상.
4. Flyway로 `SD_ST` 컬럼 추가(`@Column` 한글 comment, 기본값·기존 로우 백필 정책 명시).
5. `Cinfmm` 자체를 outbox로 사용(별도 테이블 미신설, KISS).

**영향 파일**: `common/notification/entity/Cinfmm.java`, `common/notification/service/NotificationService.java`, `common/notification/dispatcher/NotificationDispatcherRouter.java`, 신규 재발송 스케줄러, `it_database/migrations/V*.sql`.

**검증**
- EAI 강제 실패 → `SD_ST=FAILED` 기록 + 메트릭 증가 + 원 업무 미롤백.
- 재시도 성공 시 `SENT` 전이. 재시도 소진 시 `FAILED` 잔존·알람 대상 확인.

---

### 4.5 ERR-07 · 정상 빈 상태와 조회·변환 실패를 구분하는 화면 상태 추가

**현황/격차**: 아래 10개 프론트 경로가 조회/변환 실패를 **정상 빈 상태와 동일하게** 처리(TODO 표시). 목록은 조사로 확정됨.

| # | 파일:라인 | 현재 동작 |
| --- | --- | --- |
| 1 | `it_frontend/app/components/ExcalidrawWrapper.vue:131` | JSON.parse 실패 → 빈 캔버스(손상=신규 구분 불가) |
| 2 | `it_frontend/app/components/TiptapEditor.vue:333` | `loadMetadata` 실패 → 변수 카탈로그 조용히 비활성 |
| 3 | `it_frontend/app/composables/useCostListPage.ts:1511` | 검색 실패 → `[]`("결과 없음"으로 표시) |
| 4 | `it_frontend/app/composables/useMentionAutocomplete.ts:143` | 검색 실패 → `[]`("후보 없음") |
| 5 | `it_frontend/app/composables/useProjectCurrencies.ts:46` | 통화 조회 실패 → KRW-only 축소 |
| 6 | `it_frontend/app/middleware/budget-period.ts:58` | 기간 조회 실패 → 사유 없이 `/budget` 리다이렉트 |
| 7 | `it_frontend/app/pages/project/bizplan/[abusMngNo].vue:75` | 개요 재조회 실패 → `null`(개요 조용히 숨김) |
| 8 | `it_frontend/app/pages/info/plan/[id].vue:968` | PDF 후처리 복원 실패 → 화면 깨진 채 방치 |
| 9 | `it_frontend/app/pages/info/plan/[id].vue:1051` | 인쇄 실패 → 피드백 없음 |
| 10 | `it_frontend/app/stores/review.ts:332` | 과거버전 본문 조회 실패 → 빈 내용 유지 |

**목표**: 각 경로에서 "정상 빈 상태"와 "조회/변환 실패"를 구분해 사용자에게 드러낸다.

**조치 설계**
1. **tri-state 도입**: 각 경로에 `loading / empty / error` 상태를 분리. 조회 실패는 인라인 경고 + 재시도, 정상 빈 결과는 기존 빈 상태 유지.
2. **패턴 준수**(review-load-warning): store는 toast를 직접 호출하지 않고 **warnings 리스트를 반환**, 호출 컴포넌트가 인라인 경고/toast로 표면화(CLAUDE.md 프론트 규칙 정합, 선행 스펙 `frontend-error-feedback-sweep` 계보).
3. **변환 실패**(Excalidraw/Tiptap/PDF/인쇄)는 진단 로그 + 재시도 UI. 손상 데이터는 "빈 신규"와 구분되는 안내.

**영향 파일**: 위 표 10개 경로 + 관련 표시 컴포넌트.

**검증**: 각 경로에 fetch/parse 실패 주입 시 빈 상태와 구분되는 경고·재시도가 노출되는지(수동 QA + 가능한 단위 테스트).

---

## 5. Phase 3 — 🟢 Low

### 5.1 ERR-03 · 남은 무시형 실패 경로의 사용자 피드백 기준 정리

**현황/격차**: 참조 패턴 확인 — `useTableCellSelection.ts:335`(clipboard-diagnostic, `warnOncePerMinute`), `stores/review.ts`(warnings-list). 백엔드 운영코드엔 빈 catch 없음. 프론트 잔여 후보:
- `useHwpxExport.ts:81,131`, `pages/info/documents/[id]/index.vue:426`, `pages/info/documents/form.vue:258`, `pages/info/projects/form.vue:1311`, `pages/guide/index.vue:194`, `pages/budget/status.vue:400`, `components/extensions/tiptap-extensions.ts:129`, `tiptap-content-extensions.ts:176`, `composables/useTiptapTableTools.ts:689`.

**조치 설계**: 위 잔여 후보에 `warnOncePerMinute`/warnings-list 패턴을 일괄 적용(ERR-07과 동일 패턴의 후속). 신규 발견 경로도 같은 패턴 적용.

**검증**: 각 경로 실패 주입 시 진단/피드백 노출.

### 5.2 ERR-04 · 반입 SSO 샘플·로컬 스크립트의 빈 catch 분리 관리

**현황/격차**: 대상 빈 catch는 **전부 비운영**.
- SSO 벤더 샘플(`it_backend/sso/별첨1._SSO_Web_Agent...`의 `.jsp`/`.java`)은 Gradle 소스셋(`src/main/java`) 밖 → **컴파일·스캔 비대상**. 관련 의존성은 `build.gradle`에서 이미 제거됨.
- 로컬 스크립트(`it_backend/oss/rebuild-local-maven-repo.ps1:33`, `it_frontend/oss/rebuild-local-npm-repo.ps1:30`)의 빈 catch는 콘솔 인코딩 best-effort로 의도적.
- 정적분석 플러그인 없음(JaCoCo만).

**조치 설계**(운영 코드 변경 없음):
1. 비운영 샘플/스크립트가 빌드·스캔 비대상임을 문서화(해당 디렉토리 README 또는 주석). 또는 dead 벤더 샘플 디렉토리 삭제 여부를 별도 결정.
2. 향후 정적분석(SpotBugs/PMD 등) 도입 시 **제외 규칙을 명시**해 비운영 샘플 오탐을 방지.

**검증**: 빌드/스캔 대상에 비운영 샘플이 포함되지 않음을 재확인.

---

## 6. 리스크와 완화

| 리스크 | 완화 |
| --- | --- |
| SEC-04/06 토큰 로직 변경이 로그인·갱신 흐름을 깨뜨림 | 롤링 배포 호환책(§3.1) + 인증 공통 변경 시 `./gradlew clean test`(CLAUDE.md §9) |
| SEC-05 완전 매핑이 정상 사용자 접근을 과차단 | 종류별 부모권한을 **기존 도메인 규칙 재사용**으로 도출, 통합 테스트로 양방향(허용/거부) 검증, 종류 집합 사전 확정 |
| SEC-05 정책 반전이 문서와 불일치 | 코드와 동시 문서 3종 갱신(§3.2-5) |
| ERR-05 스키마 변경(`SD_ST`)의 기존 로우 처리 | Flyway 기본값·백필 정책 명시, 로컬만 자동 적용·dev/prod DBA 수동(CLAUDE.md §3) |
| 감사/알림 catch 확장이 재귀·폭주 유발 | ThreadLocal 가드(ERR-06) + 카운터 위주·로그 rate-limit(ERR-05/06) |

---

## 7. 미결 항목 (구현 계획에서 확정)

1. **SEC-05 전체 `PK_COL_NM` 종류 집합**: 프론트 업로드 호출부 + `SELECT DISTINCT PK_COL_NM` 대조로 열거하고 종류별 부모권한 규칙표를 확정.
2. **ERR-05 재시도 정책 수치**: 재시도 최대 횟수·백오프·스케줄 주기.
3. **SEC-06 기존 평문 토큰 처리**: 일괄 무효화(재로그인) vs 백필. 운영 영향 확인 후 결정.
4. **ERR-04 벤더 샘플 삭제 여부**: 문서화만 vs 디렉토리 삭제.

---

## 8. 다음 단계

본 스펙 승인 후 `writing-plans` 스킬로 Phase별 구현 계획(plan)을 작성한다. Phase 1(High) 계획을 우선 수립하고, Phase 2·3은 순차 진행한다.
