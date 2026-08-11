# Internal MFA Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 수동 로그인과 사용자 전자결재 명령에 지정맥·FIDO·mOTP MFA를 강제하고, 전자결재 동작마다 새 MFA를 요구한다.

**Architecture:** 로그인 대기 거래와 MFA 거래를 만료 가능한 서버 메모리 저장소에 두고, 인증수단별 공급자를 공통 서비스 뒤에 배치한다. 로그인은 자격증명 검증과 토큰 발급을 분리하며, 결재 변경 메서드는 공통 MFA 가드가 1회용 증표를 검증·소비한다. Nuxt는 공통 MFA 대화상자와 실행 래퍼로 로그인 및 결재 UI를 연결한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Security, Java 동시성 컬렉션, Nuxt 4 CSR, Vue 3, Pinia, PrimeVue, Vitest, Playwright

## Global Constraints

- 신규 주석과 public API 설명은 한글로 작성한다.
- JWT는 기존 httpOnly 쿠키 정책을 유지하고 프론트엔드는 토큰을 읽거나 저장하지 않는다.
- `local-ext`는 대화상자 확인 시 모의 성공하고 `local-int`, `dev`, `prod`에서는 실제 연동만 허용한다.
- `local-int`와 `dev`의 OnePass 기본 URL은 `https://dopsap.kdb.co.kr:20443/interfBiz/processRequest.do`, `prod`는 `https://opsap.kdb.co.kr:20443/interfBiz/processRequest.do`이다.
- 기본 `siteId`는 `SIT01KDBBANK00000000`, `svcId`는 `SVC12SIT01KDBBANK000`이다.
- 마지막 인증수단 기본값은 `FINGER_VEIN`이며 쿠키에는 인증수단 코드만 저장한다.
- 전자결재 인증 상태는 재사용하지 않으며 신청·승인·반려·회수 등 각 동작마다 새 MFA를 수행한다.
- SSO, 개발 사용자 전환, 조회·임시저장, 외부 전자결재 콜백은 MFA 대상에서 제외한다.
- MFA를 위해 DB 테이블, JPA 엔티티, Flyway 마이그레이션을 추가하지 않는다.
- 각 동작은 실패 테스트를 먼저 실행한 뒤 최소 구현으로 통과시킨다.

## File Structure

### Backend repository (`C:\it\it_backend`)

- Create `src/main/java/com/kdb/it/common/mfa/config/MfaProperties.java`: 프로파일별 MFA 설정과 필수값.
- Create `src/main/java/com/kdb/it/common/mfa/config/MfaConfig.java`: 실제·모의 공급자 선택과 HTTP 클라이언트 구성.
- Create `src/main/java/com/kdb/it/common/mfa/domain/*`: 인증수단, 용도, 상태 enum과 메모리 거래 모델.
- Create `src/main/java/com/kdb/it/common/mfa/store/*`: 로그인 대기·MFA 거래의 만료 가능한 메모리 저장 및 원자적 소비.
- Create `src/main/java/com/kdb/it/common/mfa/provider/*`: 모의, OnePass FIDO/mOTP, 지정맥 결과 공급자.
- Create `src/main/java/com/kdb/it/common/mfa/service/MfaService.java`: 거래 생성·검증·취소·상태·소비 오케스트레이션.
- Create `src/main/java/com/kdb/it/common/mfa/controller/MfaController.java`: `/api/mfa` 계약.
- Create `src/main/java/com/kdb/it/common/mfa/security/MfaRequired.java`: 결재 명령 표시용 어노테이션.
- Create `src/main/java/com/kdb/it/common/mfa/security/MfaGuardAspect.java`: 결재 증표 검증·소비.
- Create `src/main/java/com/kdb/it/common/mfa/exception/*`: 표준 MFA 오류와 예외 매핑.
- Modify `src/main/java/com/kdb/it/common/system/controller/AuthController.java`: `/login/start`, `/login/complete` 및 기존 우회 경로 제거.
- Modify `src/main/java/com/kdb/it/common/system/service/AuthService.java`: 자격증명 검증과 토큰 발급 분리.
- Modify `src/main/java/com/kdb/it/common/system/dto/AuthDto.java`: 로그인 대기/완료 DTO.
- Modify `src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java`: 신청·승인/반려·일괄승인·회수 MFA 강제.
- Modify 도메인별 전자결재 상신 컨트롤러: 신청서를 생성하는 명령에 MFA 강제.
- Modify `src/main/java/com/kdb/it/config/SecurityConfig.java`: 로그인 시작·완료 및 MFA 시작 경로 접근 정책과 BioAgent CSP 연결 정책 검토.
- Modify `src/main/resources/application*.properties`: 프로파일별 MFA 설정.

### Frontend repository (`C:\it\it_frontend`)

- Create `app/types/mfa.ts`: MFA API와 UI 상태 타입.
- Create `app/composables/useMfa.ts`: 인증수단 쿠키, 거래 API, BioAgent/FIDO/mOTP 상태 기계.
- Create `app/composables/useMfaProtectedAction.ts`: 매 결재 명령 전에 MFA를 수행하고 명령을 한 번 실행.
- Create `app/components/mfa/MfaDialog.vue`: 공통 선택·검증 대화상자.
- Modify `app/pages/login.vue`: 자격증명 단계와 MFA 단계 연결.
- Modify `app/stores/auth.ts`: `login/start`와 `login/complete` 호출 분리.
- Modify `app/composables/useApprovals.ts` 및 도메인별 결재 명령 composable: 공통 MFA 실행 래퍼 적용.
- Regenerate `app/types/api.ts`: OpenAPI 계약 반영.

---

### Task 1: MFA 메모리 거래 모델과 저장소

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/domain/MfaMethod.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/domain/MfaPurpose.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/domain/MfaTransactionStatus.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/domain/LoginPendingTransaction.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/domain/MfaTransaction.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/LoginPendingTransactionStore.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/MfaTransactionStore.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/InMemoryLoginPendingTransactionStore.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStore.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStoreTest.java`

**Interfaces:**
- Produces: `MfaMethod { FINGER_VEIN, FIDO, MOTP }`, `MfaPurpose { LOGIN, APPROVAL }`.
- Produces: `MfaTransaction.verify(Instant)`, `fail(Instant, int maxFailures)`, and immutable expiry/status accessors.
- Produces: `Optional<MfaTransaction> consumeVerifiedOnce(String tokenHash, String eno, MfaPurpose purpose, Instant now)` using an atomic map operation.

- [ ] **Step 1: Write failing tests** for pending→verified, expiration, wrong-user/purpose rejection, failure lock, one-time consumption, and two concurrent consumers where exactly one succeeds. Use a fixed `Clock`.
- [ ] **Step 2: Run RED** with `./gradlew test --tests '*InMemoryMfaTransactionStoreTest'`; expect missing MFA domain/store types.
- [ ] **Step 3: Implement minimal immutable domain models and store interfaces** without JPA annotations or database dependencies.
- [ ] **Step 4: Implement thread-safe in-memory stores** with `ConcurrentHashMap.compute`/`remove` semantics, lazy expiry cleanup, and no scheduled task requirement.
- [ ] **Step 5: Run GREEN** with `./gradlew test --tests '*InMemoryMfaTransactionStoreTest'` and `./gradlew test`.
- [ ] **Step 6: Commit** `feat: MFA 메모리 거래 저장소 추가` in `it_backend`.

### Task 2: MFA 설정과 프로파일 안전장치

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/config/MfaProperties.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/config/MfaConfig.java`
- Modify: `it_backend/src/main/resources/application.properties`
- Modify: `it_backend/src/main/resources/application-local-ext.properties`
- Modify: `it_backend/src/main/resources/application-local-int.properties`
- Modify: `it_backend/src/main/resources/application-dev.properties`
- Modify: `it_backend/src/main/resources/application-prod.properties`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/config/MfaConfigurationTest.java`

**Interfaces:**
- Produces: `MfaProperties(endpoint, siteId, svcId, connectTimeout, readTimeout, mockEnabled, challengeTtl, maxFailures)`.
- Produces: exactly one `MfaProviderRegistry` bean per supported profile.

- [ ] **Step 1: Write failing context tests** asserting `local-ext` selects mock, `local-int/dev` select development OnePass, `prod` selects production OnePass, and `prod + mock=true` fails startup.
- [ ] **Step 2: Run RED** with `./gradlew test --tests '*MfaConfigurationTest'`; expect missing configuration.
- [ ] **Step 3: Implement typed properties and validation** with defaults from Global Constraints, 90-second challenge TTL, five-second connect/read timeouts, and five failed attempts per transaction. 인증 재사용 TTL 속성은 만들지 않는다.
- [ ] **Step 4: Add profile properties**. `local-ext` alone sets `app.mfa.mock-enabled=true`; the other three explicitly set false and the appropriate endpoint.
- [ ] **Step 5: Run GREEN** with the focused test and `./gradlew test`.
- [ ] **Step 6: Commit** `feat: MFA 프로파일 설정 추가` in `it_backend`.

### Task 3: OnePass, 지정맥, 모의 공급자

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/MfaProvider.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/MfaProviderRegistry.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/MockMfaProvider.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/OnePassClient.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/FidoMfaProvider.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/MotpMfaProvider.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/FingerVeinMfaProvider.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/provider/OnePassClientTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/provider/MfaProviderRegistryTest.java`

**Interfaces:**
- Produces: `MfaChallengeData start(MfaStartContext context)` and `MfaVerificationResult verify(MfaVerifyContext context)`.
- Produces: safe response data containing only `challengeId`, optional QR data, and expiry—not raw external response objects.

- [ ] **Step 1: Write failing HTTP mapping tests** for mOTP `requestServiceAuth`/`requestVerifyOtp`, FIDO `requestServiceAuth`/`trResultConfirm`, `resultCode=100000`, FIDO `trStatus=1`, timeout, malformed JSON, and oversized QR response.
- [ ] **Step 2: Run RED** with `./gradlew test --tests '*OnePassClientTest' --tests '*MfaProviderRegistryTest'`.
- [ ] **Step 3: Implement the minimal client and providers**. Generate a 20-digit `svcTrId`; never log OTP, QR, external response body, or token. The 지정맥 provider validates a transaction nonce and accepts only normalized `FE00`; document the client-attestation limitation in its JavaDoc.
- [ ] **Step 4: Implement mock behavior** so start returns normal display data and verify succeeds only after an explicit verify request; it must not auto-complete on dialog open.
- [ ] **Step 5: Run GREEN** with focused tests and `./gradlew test`.
- [ ] **Step 6: Commit** `feat: MFA 인증 공급자 연동` in `it_backend`.

### Task 4: MFA 거래 서비스와 API

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/dto/MfaDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/service/MfaService.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/controller/MfaController.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/exception/MfaErrorCode.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/exception/MfaException.java`
- Modify: existing global exception handler under `it_backend/src/main/java/com/kdb/it/exception`
- Modify: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/service/MfaServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/controller/MfaControllerTest.java`

**Interfaces:**
- Produces: `startChallenge(MfaStartRequest, Optional<CustomUserDetails>, pendingCookie)`.
- Produces: `verifyChallenge(UUID, MfaVerifyRequest, Optional<CustomUserDetails>, pendingCookie)`.
- Produces: `cancelChallenge(UUID, ...)` and `getApprovalStatus(CustomUserDetails, proofCookie)`.
- Produces errors: `MFA_REQUIRED`, `MFA_EXPIRED`, `MFA_FAILED`, `MFA_UNAVAILABLE`, `MFA_LOCKED`.

- [ ] **Step 1: Write failing service tests** for login ownership through pending cookie, approval ownership through JWT, purpose mismatch, expiry, cancellation, max failures, one-time consumption, and raw-secret log exclusion.
- [ ] **Step 2: Write failing controller tests** for `POST /api/mfa/challenges`, `POST /{id}/verify`, and `DELETE /{id}`, including unauthenticated approval rejection.
- [ ] **Step 3: Run RED** with `./gradlew test --tests '*MfaServiceTest' --tests '*MfaControllerTest'`.
- [ ] **Step 4: Implement service and controller**. Store only SHA-256 proof hashes, place proof values in httpOnly cookies, and return remaining seconds rather than trusting browser time.
- [ ] **Step 5: Implement standardized exception responses** and permit only the login-purpose MFA start/verify paths without JWT; service-level ownership checks remain mandatory.
- [ ] **Step 6: Run GREEN** with focused tests and `./gradlew test`.
- [ ] **Step 7: Commit** `feat: MFA 거래 API 추가` in `it_backend`.

### Task 5: 수동 로그인 2단계 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/dto/AuthDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java`

**Interfaces:**
- Produces: `POST /api/auth/login/start` returning `LoginStartResponse(pendingId, expiresAt)` and a pending httpOnly cookie.
- Produces: `POST /api/auth/login/complete` consuming verified LOGIN proof and returning the existing `LoginResponse` plus JWT cookies.
- Removes: public direct token issuance from `POST /api/auth/login`.

- [ ] **Step 1: Write failing tests** proving valid credentials do not issue JWT, completion without verified MFA fails, wrong-user/expired proof fails, successful completion issues both JWT cookies once, and replay fails.
- [ ] **Step 2: Run RED** with `./gradlew test --tests '*AuthServiceTest' --tests '*AuthControllerTest'`.
- [ ] **Step 3: Refactor minimally**: extract credential verification from token issuance, create a pending transaction after verification, and call the existing token issuance only after atomic LOGIN proof consumption.
- [ ] **Step 4: Remove the bypass** by replacing or rejecting the old `/login` token-issuing behavior. Keep SSO and `DevAuthController` unchanged.
- [ ] **Step 5: Run GREEN** with focused tests, `./gradlew test`, and SSO controller tests.
- [ ] **Step 6: Commit** `feat: 수동 로그인 MFA 강제` in `it_backend`.

### Task 6: 전자결재 서버 강제와 1회용 소비

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/security/MfaRequired.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/mfa/security/MfaGuardAspect.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java`
- Modify: controllers found by `rg -n 'applicationService\.submit|requestApproval|submitDecision|submit.*Approval' src/main/java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/security/MfaGuardAspectTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/controller/ApplicationControllerTest.java`

**Interfaces:**
- Produces: `@MfaRequired(purpose = MfaPurpose.APPROVAL)` on user-triggered mutating methods.
- Consumes: approval proof cookie and authenticated `CustomUserDetails`.

- [ ] **Step 1: Inventory endpoints** with the stated `rg` command and record the exact protected/excluded list in the test parameter source. Protect common submit, approve/reject, bulk approve/reject, recall, and domain-specific electronic-approval submissions; exclude callbacks, GET, and draft save.
- [ ] **Step 2: Write failing aspect tests** for missing, expired, wrong-user, already-consumed, and valid one-time proofs; verify the target service is never invoked on rejection and invoked once on success.
- [ ] **Step 3: Run RED** with `./gradlew test --tests '*MfaGuardAspectTest' --tests '*ApplicationControllerTest'`.
- [ ] **Step 4: Implement the annotation and guard** with transaction ordering that atomically reserves/consumes a one-time proof before the domain command. Reusable proof remains valid until server expiry.
- [ ] **Step 5: Annotate the inventory** and add MockMvc coverage for every protected endpoint category and at least one excluded callback.
- [ ] **Step 6: Run GREEN** with focused tests and `./gradlew check`.
- [ ] **Step 7: Commit** `feat: 전자결재 MFA 검증 강제` in `it_backend`.

### Task 7: 프론트 공통 MFA 상태 기계와 대화상자

**Files:**
- Create: `it_frontend/app/types/mfa.ts`
- Create: `it_frontend/app/composables/useMfa.ts`
- Create: `it_frontend/app/components/mfa/MfaDialog.vue`
- Test: `it_frontend/tests/unit/composables/useMfa.test.ts`
- Test: `it_frontend/tests/unit/components/mfa/MfaDialog.test.ts`

**Interfaces:**
- Produces: `openMfa(options): Promise<MfaCompletion>` with `{ purpose, loginPendingId? }`.
- Produces: last-method cookie `mfa-last-method`, default `FINGER_VEIN`.
- Produces: cleanup of WebSocket, poll timer, countdown timer, and server challenge on close/unmount.

- [ ] **Step 1: Write failing composable tests** for default 지정맥, valid cookie restoration, invalid cookie fallback, explicit local-ext verification, FIDO polling stop, mOTP submit, BioAgent `FE00`, and cleanup.
- [ ] **Step 2: Write failing component tests** proving method selection, QR/OTP/BioAgent views, error codes, disabled duplicate submit, and absence of authentication-reuse controls.
- [ ] **Step 3: Run RED** with `npm test -- useMfa.test.ts MfaDialog.test.ts`.
- [ ] **Step 4: Implement the composable** using `$apiFetch`, `ws://127.0.0.1:8089/bio`, and `BioAgent://`; normalize only known FE codes and never render server text with `v-html`.
- [ ] **Step 5: Implement the PrimeVue dialog** with accessible labels, focus return, countdown, and no authentication-reuse controls.
- [ ] **Step 6: Run GREEN** with focused tests, `npm run check`, and `npm run lint:css`.
- [ ] **Step 7: Commit** `feat: 공통 MFA 인증 대화상자 추가` in `it_frontend`.

### Task 8: 로그인 화면과 인증 스토어 연결

**Files:**
- Modify: `it_frontend/app/types/auth.ts`
- Modify: `it_frontend/app/stores/auth.ts`
- Modify: `it_frontend/app/pages/login.vue`
- Test: `it_frontend/tests/unit/stores/auth.test.ts`
- Test: `it_frontend/tests/unit/pages/login.test.ts`
- Test: `it_frontend/tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `authStore.startLogin(credentials)`, `openMfa({ purpose: 'LOGIN', loginPendingId })`, `authStore.completeLogin()`.
- Produces: authenticated user state only after login completion.

- [ ] **Step 1: Write failing store tests** proving start does not set user, completion sets user, failure leaves user empty, and repeat submission is coalesced or disabled.
- [ ] **Step 2: Write failing page tests** for credential→MFA transition, cancel returning to credentials, expiration reset, and no five-minute checkbox on login.
- [ ] **Step 3: Run RED** with `npm test -- auth.test.ts login.test.ts`.
- [ ] **Step 4: Implement the two-step store and page flow** while preserving httpOnly token handling and existing safe redirect behavior.
- [ ] **Step 5: Update E2E fixtures** so `local-ext` opens the dialog and requires an explicit confirmation before login succeeds.
- [ ] **Step 6: Run GREEN** with focused tests and `npm run test:e2e -- auth.spec.ts`.
- [ ] **Step 7: Commit** `feat: 수동 로그인 MFA 화면 연결` in `it_frontend`.

### Task 9: 전자결재 프론트 연결과 API 생성 타입

**Files:**
- Create: `it_frontend/app/composables/useMfaProtectedAction.ts`
- Modify: `it_frontend/app/composables/useApprovals.ts`
- Modify: all composables/pages corresponding to Task 6 endpoint inventory.
- Modify: `it_frontend/app/types/api.ts` through the repository code-generation command.
- Test: `it_frontend/tests/unit/composables/useMfaProtectedAction.test.ts`
- Test: existing approval composable/page tests.
- Test: `it_frontend/tests/e2e/static-auth.spec.ts` or a new focused MFA approval spec.

**Interfaces:**
- Produces: `runWithApprovalMfa<T>(action: () => Promise<T>): Promise<T>`.
- Behavior: always open MFA before the action; on `MFA_REQUIRED`/`MFA_EXPIRED`, do not reuse the previous proof and retry only after a new MFA, at most once.

- [ ] **Step 1: Write failing wrapper tests** for a dialog on every action, one-time proof use, error-triggered single retry after new MFA, cancel, and prevention of duplicate action execution.
- [ ] **Step 2: Run RED** with `npm test -- useMfaProtectedAction.test.ts`.
- [ ] **Step 3: Implement the wrapper** and route every protected frontend command from Task 6 through it. Do not wrap queries, drafts, or callbacks.
- [ ] **Step 4: Regenerate OpenAPI types** using the existing codegen script and run `npm run codegen:check`.
- [ ] **Step 5: Add E2E coverage** for approval/rejection and two consecutive commands each prompting for a new MFA.
- [ ] **Step 6: Run GREEN** with unit tests, focused E2E, `npm run format:check`, `npm run check`, and `npm run lint:css`.
- [ ] **Step 7: Commit** `feat: 전자결재 MFA 화면 연결` in `it_frontend`.

### Task 10: 통합 검증, 문서, 호환 커밋 잠금

**Files:**
- Modify: `CLAUDE.md` only if a durable MFA security rule is not already captured.
- Modify: `it_backend/README.md` and `it_frontend/README.md` with profile variables and local test flow.
- Modify: `versions.lock` using `scripts/update-versions-lock.ps1`.
- Move completed spec/plan to `docs/superpowers/done/` only after all verification succeeds.

**Interfaces:**
- Produces: reproducible profile configuration and compatible backend/frontend/database commit set.

- [ ] **Step 1: Run backend verification**: `./gradlew test`, `./gradlew check`, and `./gradlew jacocoTestCoverageVerification`.
- [ ] **Step 2: Run frontend verification**: `npm run format:check`, `npm run check`, `npm run lint:css`, `npm test`, `npm run codegen:check`, and the MFA E2E suite with both servers running under `local-ext`.
- [ ] **Step 3: Perform security checks**: confirm no OTP/QR/proof logging, no direct `/login` JWT issuance, no unprotected inventoried approval command, `prod` mock fail-fast, and logout proof deletion.
- [ ] **Step 4: Update operational docs** with `MFA_ENDPOINT`, `MFA_SITE_ID`, `MFA_SVC_ID`, timeouts, profile behavior, BioAgent prerequisite, and the 지정맥 client-attestation limitation.
- [ ] **Step 5: Update `versions.lock`** after database, backend, and frontend commits are final; verify the recorded SHAs match each repository HEAD.
- [ ] **Step 6: Commit root documentation and lock changes** with `docs: MFA 운영 및 호환 버전 기록`.

## Plan Self-Review

- Spec coverage: all 13 design sections map to Tasks 1–10; SSO/callback exclusions, local-ext explicit confirmation, last-method cookie, per-action one-time consumption, no DB schema change, and profile URLs are explicit.
- Placeholder scan: no deferred implementation marker remains; endpoint inventory is an executable discovery step whose acceptance categories are fixed by the approved design.
- Type consistency: `MfaMethod`, `MfaPurpose`, `MfaTransactionStatus`, `openMfa`, and `runWithApprovalMfa` retain the same names across producer and consumer tasks.
