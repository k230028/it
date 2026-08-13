# Sparrow 정적분석 검출 전수 분류 (2026-08-12)

원본: `vul.txt` — Java/JSP 162건 + JavaScript 11건 = **총 173건** (검출일 2026-08-10~11)
분석 기준 코드: `it_backend` / `it_frontend` 현재 `main` 브랜치 작업본

> **조치 상태 (2026-08-13)**: §6의 1~4단계 완료. 프론트 6파일(신규 2), 백엔드 10파일 수정.
> 게이트 통과 — 프론트 `format:check`·`check`·`test`(258파일 3106테스트), 백엔드 `clean test`·`check`.
> 조사 과정에서 분류가 바뀐 항목은 §8에 정정 이력으로 남겼습니다.

## 0. 요약

경로 기준으로 **운영 코드 48건, 테스트 코드 125건**입니다.

| 판정 | 건수 | 설명 |
| --- | ---: | --- |
| **A. 실조치 필요** | 9 | 실제 방어가 없거나 catch 범위가 과도한 지점. 코드 수정 대상 |
| **B. 오탐이나 검출기 보정 가능** | 21 | 동작은 정상. 재검출 방지용 무해한 보정 대상 |
| **C. 설계 의도 (수정 시 기능 훼손)** | 18 | 아키텍처가 명시적으로 요구하는 코드. 예외 승인 대상 |
| **D. 테스트 코드 오탐** | 125 | 테스트 메서드명·단언문에 검출기 오작동. 운영 산출물 미포함 |
| 합계 | 173 | |

> A/B 건수는 조치 과정에서 호출자 체인을 확인해 초판(A 11 / B 19)에서 정정한 값입니다. 상세는 §8.
> 아래 §1·§2의 항목별 표는 **조치 단위**로 묶여 있어 초판 구성을 유지합니다(A-2에 오탐 2건 포함).

**보안 분류(체커 타입=보안) 32건 중 실제 보안 결함은 0건입니다.**

| 보안 체커 | 총 | 운영 코드 | 판정 |
| --- | ---: | ---: | --- |
| `MISSING_LOGIN_CONTROL` | 23 | 1 | 전부 오탐. 로그인 제어는 서비스 계층에 존재 (§2 B-6) |
| `FORBIDDEN.INSECURE_RANDOM` | 5 | 4 | 비보안 용도 ID 생성. 보정 권고 (§2 B-3) |
| `USING_HASH_WITHOUT_SALT` | 3 | 2 | 솔트 적용 시 기능 파손 (§2 B-4) |
| `INTEGER_OVERFLOW` | 1 | 1 | 오버플로우 수학적으로 불가 (§2 B-5) |

---

## 1. A. 실조치 필요 (11건)

### A-1. 프론트 빈 catch 블록 — 3건

| ID | 파일 | 라인 | 현재 상태 |
| --- | --- | ---: | --- |
| 967068 | `it_frontend/app/composables/admin/useAdminLogColumns.ts` | 119 | `catch { /* 주석만 */ }` |
| 967069 | `it_frontend/app/composables/useRealtimeLogPreferences.ts` | 96 | `catch { /* 주석만 */ }` |
| 967070 | `it_frontend/app/utils/diagnostics.ts` | 11 | `catch { /* 주석만 */ }` |

셋 다 의도(파싱 실패 시 기본 컬럼 복원 / 저장 실패는 메모리 상태 유지 / 콘솔 출력 실패 무시)를 한글 주석으로 남겼으나 실행문이 없습니다. Sparrow는 주석을 실행문으로 세지 않습니다.

**조치**: catch 본문에 실행문을 추가합니다.
- `useAdminLogColumns.ts` / `useRealtimeLogPreferences.ts` — `createRateLimitedWarn`(`app/utils/diagnostics.ts`) 호출을 추가하면 기존 프로젝트 유틸을 재사용하면서 실행문 요건도 만족합니다.
- `diagnostics.ts` — catch 안에서 다시 `console`을 부를 수 없으므로 `void error;` 같은 명시적 소비문으로 대체합니다.

### A-2. 널 방어가 실제로 없는 지점 — 3건

| ID | 파일:라인 | 내용 |
| --- | --- | --- |
| 967234 | `FileService.java:523` | `originalFilename`이 null인 경로에서 `filePath.getFileName()`을 호출. 루트 경로에서 `null` 반환 가능 |
| 967235 | `FileUploadUnitService.java:64` | `MultipartFile.getOriginalFilename()`은 계약상 `null` 반환 가능. `generateFlPysNm`·`validateExtension`에 그대로 전달 |
| 967221 | `AuditLogPersister.java:258` | `f.getAnnotation(Column.class)`가 `null`이면 `.name()`에서 NPE. 호출자(`copyColumnFields`)가 필터링하지만 메서드 자체에는 전제 검증 없음 |

**조치**: 명시적 널 가드 또는 `Objects.requireNonNull` + 한글 실패 메시지를 추가합니다. `FileUploadUnitService`는 `fileValidator.validateExtension` **앞에서** 원본 파일명 null을 거부하는 편이 계약이 분명합니다.

### A-3. 지나치게 넓은 catch 중 좁힐 수 있는 것 — 5건

§3의 "설계상 격리 경계"와 달리, 실제로 던져지는 예외 타입이 확정적인데 `Exception`으로 받고 있습니다. 좁히면 예상 밖 예외가 숨지 않습니다.

| ID | 파일:라인 | 실제 발생 예외 | 좁힐 대상 |
| --- | --- | --- | --- |
| 967080 | `ApprovalLineDelegate.java:73` | Jackson 직렬화/역직렬화 | `JsonProcessingException`, `ClassCastException` |
| 967079 | `ApprovalLineDelegate.java:103` | Jackson 직렬화/역직렬화 | `JsonProcessingException`, `ClassCastException` |
| 967096 | `AuditLogIdGenerator.java:63` | JDBC | `SQLException` |
| 967098 | `AuditLogPersister.java:116` | 리플렉션 인스턴스화·필드 접근 | `ReflectiveOperationException` |
| 967102 | `GeminiService.java:185` | 외부 HTTP + 응답 파싱 | `RestClientException`, `IOException` |

**조치**: 다중 catch(`catch (A | B e)`)로 좁힙니다. 기존 래핑 예외 타입과 로그 메시지는 그대로 둡니다.

> `ApprovalLineDelegate:103`의 `(ObjectNode) objectMapper.readTree(json)` 캐스팅 때문에 `ClassCastException`을 반드시 포함해야 합니다. 배열이나 스칼라 JSON이 저장돼 있으면 이 경로로 들어옵니다.

---

## 2. B. 오탐이나 검출기 보정 가능 (19건)

동작은 이미 올바릅니다. 다음 스캔에서 재검출되지 않도록 무해한 보정만 적용합니다.

### B-1. 백엔드 빈 catch — 3건 (967089, 967090, 967091)

| ID | 위치 |
| --- | --- |
| 967090 | `SsoController.java:635` (`resolveVerifiedEno`) |
| 967089 | `SsoController.java:678` (`invalidateSession`) |
| 967091 | `AuthController.java:299` (`invalidateSession`) |

셋 다 `catch (IllegalStateException ignored)` + 한글 의도 주석입니다. 동시 요청이 세션을 먼저 무효화한 경우를 흡수하는 정상 방어 코드입니다.

**보정**: catch 본문에 `log.trace(...)` 한 줄 추가.

⚠ 두 클래스의 `invalidateSession`은 **`private static`** 메서드이며, 로거 사정이 서로 다릅니다.
- `SsoController` — `private static final Logger log`가 이미 선언돼 있습니다(`SsoController.java:52`). 바로 사용 가능합니다.
- `AuthController` — **로거가 전혀 없습니다.** `@Slf4j`도 `Logger` 필드도 없으므로(`@RestController`/`@RequestMapping`/`@Tag`만 선언) 로거 추가가 선행돼야 합니다. `SsoController`와 같은 `private static final Logger` 방식으로 맞추면 static 메서드에서 그대로 쓸 수 있습니다.

### B-2. 널 반환 역참조 — 오탐 8건

| ID | 위치 | 오탐 근거 |
| --- | --- | --- |
| 967156, 967157 | `JwtAuthenticationFilter.java:158-159` | `StringUtils.hasText(bearerToken)` 가드가 이미 있음. Sparrow가 Spring 유틸의 널 검사 의미를 모름 |
| 967150 | `MentionExtractor.java:48` | `matcher.find()` 성공 후 **필수** 캡처그룹 `(K\d{6,8})`의 `group(1)`은 널이 될 수 없음 |
| 967185 | `BudgetProjectSummaryService.java:128` | 바로 앞줄 `computeIfAbsent`로 키 삽입이 보장된 뒤의 `get(sourceKey)` |
| 967236, 967237, 967238, 967239 | `SsoController.java:150, 236, 413, 432` | `resolveFrontendBaseUrl`은 `getAllowedOrigin(origin).orElse(frontendUrl)`로 널이 아님. 문자열 `+` 연결은 피연산자가 널이어도 NPE 미발생 |

**보정**:
- `JwtAuthenticationFilter` — `bearerToken != null && StringUtils.hasText(...)`로 명시 검사를 앞에 붙입니다.
- `BudgetProjectSummaryService`, `SsoController` — 지역변수로 받아 널 체크하거나 `Objects.requireNonNullElse`로 검출기가 인식 가능한 형태를 만듭니다.
- `MentionExtractor` — 정규식 계약이 명확하고 방어 코드가 오히려 오해를 낳으므로 **예외 승인(§5)** 으로 처리하는 편이 낫습니다.

### B-3. 예측 가능 난수 — 4건 (967067, 967071, 967072, 967073)

| ID | 위치 | 용도 |
| --- | --- | --- |
| 967067 | `tiptap-toc.ts:34` | 에디터 heading 앵커 DOM id (`heading-xxxxxxxxx`) |
| 967071, 967072 | `section-xml.ts:40, 41` | HWPX 문서 내부 그림 `picId` / `instId` |
| 967073 | `section-xml.ts:144` | HWPX 문서 내부 표 `tblId` |

전부 문서·DOM 내부 식별자이며 인증·세션·토큰과 무관합니다. 예측 가능해도 공격 표면이 없습니다. 다만 대체 비용이 매우 낮습니다.

**보정**: `crypto.randomUUID()` 또는 `crypto.getRandomValues(new Uint32Array(1))[0]`로 교체합니다.
⚠ HWPX id는 Hangul 출력 포맷상 31비트 양의 정수여야 하므로 `getRandomValues` 결과에 `& 0x7fffffff`를 적용합니다. 프론트는 CSR 전용(`ssr: false`)이라 `crypto` 전역 사용에 SSR 가드가 필요 없습니다.

### B-4. 솔트 없는 해시 — 2건 (967154, 967159)

| ID | 위치 | 오탐 근거 |
| --- | --- | --- |
| 967154 | `AuthService.java:488` `sha256HexForToken` | 대상이 사용자 비밀번호가 아니라 **서버가 생성한 256비트 랜덤 Refresh Token**입니다. 사전 공격 대상이 아니며, DB 조회 키(`ECY_RNW_PUB_TOK_CONE`)로 쓰므로 결정적 해시여야 합니다. 솔트를 넣으면 조회가 불가능해집니다 — `it_backend/CLAUDE.md` §5 규정 |
| 967159 | `SecurityConfig.java:330` `cspHash` | CSP `script-src 'sha256-...'` 소스 표현식은 W3C CSP Level 3이 솔트 없는 SHA-256을 규정합니다. 솔트를 넣으면 브라우저가 SSO CS 모드 브리지 스크립트를 차단합니다 |

**보정 불가 — 예외 승인 대상.** 솔트를 넣으면 기능이 깨집니다.

### B-5. 정수 오버플로우 — 1건 (967233)

`EaiInfraConfig.java:36` — `SECURE_RANDOM.nextInt(999_999_999) + 1`.
최댓값 1,000,000,000이 `Integer.MAX_VALUE`(2,147,483,647)의 절반 이하입니다. 오버플로우가 발생할 수 없습니다.

**보정 불가 — 예외 승인 대상.**

### B-6. 로그인 제어 누락 — 1건 (967092)

`AuthController.java:135` `login`. Sparrow가 컨트롤러 메서드만 보고 판정했습니다.

실제 시도 횟수 제한은 서비스 계층 `AuthService.java:164`의 `loginAttemptService.checkLocked(eno)`에 있습니다. 잠금 동작은 `AuthServiceTest.login_계정잠금_기존잠금예외유지_이력미추가`가, 실패 이력 커밋 격리는 `AuthLoginFailureIsolationIT`가 고정합니다.

**보정 불가 — 예외 승인 대상.** Controller → Service → Repository 레이어 규칙상 컨트롤러에 중복 구현하지 않습니다.

---

## 3. C. 설계 의도 (18건)

### C-1. 부수효과 격리 경계 — 12건

`catch (Exception)`이 **아키텍처 요구사항**인 지점입니다. 근거: `it_backend/CLAUDE.md` §7 — "알림·메일처럼 실패가 원 업무를 롤백하면 안 되는 부수효과는 `@TransactionalEventListener(AFTER_COMMIT)`를 사용", "EAI 실패는 원 업무를 실패시키지 않으며". 여기서 예외 타입을 좁히면 미처 예상 못한 런타임 예외가 정상 업무 트랜잭션을 롤백시킵니다.

| ID | 위치 | 역할 |
| --- | --- | --- |
| 967083 | `NotificationEventListener.java:73` | 결재 결과 알림 실패가 결재를 롤백하지 않음 |
| 967084 | `NotificationEventListener.java:130` | 회수 알림 실패 격리 |
| 967081 | `NotificationEventListener.java:147` | outbox 적재 실패 → `notification.persist.failure` 메트릭 |
| 967082 | `NotificationEventListener.java:162` | 발송 실패 → `notification.dispatch.unexpected` 메트릭 |
| 967085 | `NotificationRetryScheduler.java:47` | 한 건 실패가 재시도 배치 전체를 중단하지 않음 |
| 967097 | `AuditFailureRecorder.java:61` | 메트릭 기록 실패가 감사 실패 처리를 다시 실패시키지 않음 |
| 967099 | `AuditLogPersister.java:81` | 감사 쓰기 실패 → 실패 recorder 위임 |
| 967100 | `ChangeLogEntityListener.java:107` | 감사 예약 실패 격리 |
| 967101 | `ChangeLogEntityListener.java:117` | recorder 빈 조회조차 실패한 경우의 2차 방어 |
| 967103 | `FileService.java:324` | 다건 업로드 중 일부 실패를 실패 목록으로 수집 |
| 967086 | `SsoAgentClient.java:60` | 외부 인증서버 점검 실패 → `false` 반환 후 수동 로그인 폴백 |
| 967087 | `SsoAgentClient.java:129` | 외부 토큰 검증 통신 실패 → `999999` 실패 코드 |

### C-2. 필터·컨트롤러 최상위 방어 — 2건

| ID | 위치 | 역할 |
| --- | --- | --- |
| 967093 | `JwtAuthenticationFilter.java:119` | 인증 처리 오류가 필터 체인을 끊지 않고 미인증 상태로 진행 |
| 967088 | `SsoController.java:420` | SSO 완료 처리 실패를 오류 리다이렉트로 전환. 내부 2차 catch는 이미 `IOException`으로 좁혀져 있음 |

### C-3. 즉시 재던지는 catch — 3건

로그·래핑 후 바로 던지므로 예외를 삼키지 않습니다. 검출기가 `catch (Exception)` 형태만 보고 판정했습니다.

| ID | 위치 | 동작 |
| --- | --- | --- |
| 967078 | `ApplicationService.java:434` | `RuntimeException` 래핑 후 던져 일괄 결재 전체 롤백 |
| 967094 | `CouncilApprovalEventListener.java:82` | `log.error` 후 `throw e` |
| 967095 | `CouncilSkipApprovalEventListener.java:56` | `log.error` 후 `throw e` |

### C-4. 문서화된 널 허용 계약 — 1건

| ID | 위치 | 근거 |
| --- | --- | --- |
| 967162 | `ServiceRequestDocService.java:272` | `OrgNameResolver.resolveName()`은 조직코드 미등록 시 **의도적으로** `null`을 반환합니다(`OrgNameResolver.java:30, 35`). 수신 측 `Brdocm.assignAuthorOrg` JavaDoc도 "부서명/팀명 (코드 미등록 시 null 허용)"으로 계약을 명시합니다. 조직명 스냅샷이 없는 경우를 null로 표현하는 것이 설계입니다 |

**널 허용 확인 완료**: 이 건은 널이 실제로 흐르므로 A(실결함)로 오분류하기 쉽습니다. 물리·ORM 양쪽에서 NULL 허용을 확인했습니다.
- 물리 DDL — `V20260708_004__AddSvnOrgNameColumns.sql:29-30`이 `TPRMPP_BRDOCM.SVN_DPM_NM`/`SVN_TEM_NM`을 NOT NULL 제약 없이 추가
- ORM — `Brdocm.java:89, 93`의 `@Column`에 `nullable = false`가 없어 JPA 기본값(nullable) 적용

따라서 **C 확정**이며 코드 수정 대상이 아닙니다.

---

## 4. D. 테스트 코드 오탐 (125건)

운영 산출물(WAR / 정적 번들)에 포함되지 않는 `src/test/**`, `tests/**` 경로 검출입니다. **운영 위험 0.**

| 검출기 | 건수 | 오탐 사유 |
| --- | ---: | --- |
| `NULL_RETURN_STD` | 73 | `*ProjectionIt`, `*ContractTest`의 단언문. `assertThat(map.get(k))` 형태에서 `Map.get`/`Optional` 반환을 널 검사 없이 쓴다고 판정. 테스트에서는 널이 곧 실패 신호이므로 방어 코드가 오히려 검증을 무력화 |
| `MISSING_LOGIN_CONTROL` | 22 | 테스트 **메서드명**에 `login`이 들어가면 무조건 검출. `AuthServiceTest.login_성공_LoginResponse반환` 등. 로그인 제어를 검증하는 테스트가 로그인 제어 누락으로 잡히는 역설 |
| `NULL_RETURN` | 10 | `FeasibilityServiceTest`, `GlobalExceptionHandlerTest`의 `ResponseEntity.getBody()` 단언 |
| `FORWARD_NULL` | 4 | `BcostmUpdateCommandTest`, `BtermmUpdateCommandTest`, `ProjectBudgetSummaryServiceTest`의 `assertThatThrownBy(() -> x.update(null))` — **널을 넘기는 것이 테스트의 목적** |
| `EMPTY_CATCH_BLOCK` | 4 | `AuthServiceTest:219`(예외 발생 자체가 검증 대상), `AuditFailureIsolationIT:194`, E2E `session.spec.ts` 2건, `access-control.spec.ts` |
| `IMPROPER_CHECK` | 3 | `ReviewCommentServiceTest`(리플렉션 픽스처 설정) 2건, `AuthServiceTest` 1건 |
| `RESOURCE_LEAK` | 1 | `MaxLinesRatchetTest:182` — `properties.load(new InputStreamReader(in, UTF_8))`. 감싸인 `InputStream in`은 try-with-resources로 닫히고 `InputStreamReader`는 별도 OS 자원을 보유하지 않으므로 실제 누수 없음. 정리하려면 `InputStreamReader`를 try-with-resources 안으로 옮기면 됨 |
| `NULL_RETURN_STD` (동 파일) | (73에 포함) | `MaxLinesRatchetTest:186` — `properties.getProperty(name)`의 `name`이 `stringPropertyNames()`에서 왔으므로 널 불가 |
| `USING_HASH_WITHOUT_SALT` | 1 | `BoardReplySequenceMigrationSourceTest.sha256` — 마이그레이션 소스 무결성 비교용 체크섬. 자격증명 아님 |
| `FORBIDDEN.INSECURE_RANDOM` | 1 | `review.test.ts:97` 테스트 픽스처 생성 |
| **합계** | **125** | |

**권고**: `NULL_RETURN_STD`와 `MISSING_LOGIN_CONTROL` 둘이 테스트 경로에서 95건(전체의 55%)을 만들고 있습니다. Sparrow 프로젝트 설정에서 `src/test/**`, `tests/**`를 분석 제외하거나 별도 심각도로 분리하면 다음 스캔부터 노이즈가 사라집니다. **125건을 단건 예외 처리하는 것보다 이쪽이 압도적으로 효율적입니다.**

---

## 5. 예외 승인 요청 목록 (코드 수정 불가·불필요)

기능이 깨지거나 아키텍처에 반하므로 "오탐"으로 종결 처리해야 하는 건입니다.

| ID / 범위 | 위치 | 사유 요약 |
| --- | --- | --- |
| 967154 | `AuthService.java:488` | 랜덤 토큰의 결정적 조회 해시. 솔트 적용 시 DB 조회 불가 |
| 967159 | `SecurityConfig.java:330` | CSP W3C 스펙이 솔트 없는 SHA-256 규정. 솔트 적용 시 스크립트 차단 |
| 967233 | `EaiInfraConfig.java:36` | 최댓값 10억 < `Integer.MAX_VALUE`. 오버플로우 수학적으로 불가 |
| 967092 | `AuthController.java:135` | 로그인 시도 제한은 `AuthService.java:164`에 존재. 레이어 규칙상 중복 구현 안 함 |
| 967150 | `MentionExtractor.java:48` | 정규식 필수 캡처그룹은 널 반환 불가 |
| C-1~C-4 (18건) | §3 표 참조 | 부수효과 격리·재던지기·문서화된 널 허용 계약 |
| D (125건) | §4 표 참조 | 테스트 코드. 운영 산출물 미포함 |

---

## 6. 조치 순서 제안

| 단계 | 대상 | 검증 명령 |
| --- | --- | --- |
| 1 | A-1 프론트 빈 catch 3건 + B-3 난수 4건 | `npm run check`, `npm run format:check`, `npm test` |
| 2 | A-2 백엔드 널 방어 3건 | `./gradlew test` |
| 3 | A-3 catch 좁히기 5건 | `./gradlew clean test` (인증·결재·파일·감사로그 공통 변경이므로 `clean` 필요) |
| 4 | B-1 백엔드 빈 catch 3건 + B-2 널 보정 5건 | `./gradlew check` |
| 5 | §5 예외 승인 제출 | — |
| 6 | 테스트 경로 스캔 제외 협의 | — |

1단계와 2·3단계는 저장소가 달라 독립적으로 진행 가능합니다. 교차 저장소 커밋 순서 규칙(백엔드 계약 먼저)은 이번 변경에 API 계약 변경이 없으므로 적용되지 않습니다.

## 6-1. 조치 결과 (2026-08-13 완료)

### 프론트엔드

| 파일 | 변경 |
| --- | --- |
| `app/utils/secureId.ts` **(신규)** | `secureRandomInt31()`·`secureRandomToken()` — Web Crypto 기반 식별자 생성. 미지원 환경 폴백 포함 |
| `tests/unit/utils/secureId.test.ts` **(신규)** | 범위·길이·문자셋·폴백 계약 8건 |
| `app/utils/hwpx/section-xml.ts` | `picId`·`instId`·`tblId`를 `secureRandomInt31()`로 교체 |
| `app/components/editor/tiptap-toc.ts` | heading 앵커 id를 `secureRandomToken(9)`로 교체 |
| `app/composables/admin/useAdminLogColumns.ts` | 빈 catch → 손상값 제거 + `createRateLimitedWarn` 경고 |
| `app/composables/useRealtimeLogPreferences.ts` | 빈 catch → 저장 실패 경고 |
| `app/utils/diagnostics.ts` | 빈 catch → 실패한 경고가 간격 제한을 소모하지 않도록 시각 복원 |
| `tests/unit/utils/diagnostics.test.ts` | 위 동작 회귀 테스트 1건 추가 |

`secureRandomToken`은 `Math.random().toString(36)`이 후행 0 절삭으로 길이가 들쭉날쭉하던 문제도 함께 해소합니다(항상 요청 길이를 채움).

#### 미검출 동일 패턴 일괄 정리 (2026-08-13 추가)

Sparrow가 잡지 않았으나 같은 방식으로 식별자를 만들던 곳까지 확장 적용했습니다. **이제 프론트 전체에서 `Math.random()`은 `secureId.ts`의 미지원 환경 폴백 2곳에만 남습니다.**

| 파일 | 변경 |
| --- | --- |
| `app/components/editor/extensions/content/heading.ts:14` | `tiptap-toc.ts`와 동일 목적(heading 앵커 id). deprecated `substr`도 함께 제거 |
| `app/components/review/ReviewMessenger.vue:89` | 첨부 임시 id |
| `app/components/review/ReviewCommentPopover.vue:146` | 첨부 임시 id |
| `tests/unit/stores/review.test.ts:96-97` | 선언만 있고 사용처가 없는 `_generateId` 죽은 코드 제거 (Sparrow 967077 해소) |

첨부 임시 id는 난수부를 **3자 → 9자**로 늘렸습니다. `att-${Date.now()}-${난수}` 형식인데 여러 파일을 한 번에 첨부하면 `forEach` 루프가 같은 밀리초에 돌아 `Date.now()`가 동일해지므로, 실질 유일성이 난수 3자(36³ ≈ 4.7만)에만 걸려 있었습니다. 이 id는 Vue `:key`와 삭제 대상 지정에 쓰이므로 충돌 시 잘못된 항목이 지워질 수 있습니다. id를 파싱하는 곳은 없어 길이 변경은 안전합니다.

백엔드 운영 코드에는 `Math.random()`·`new Random()`·`ThreadLocalRandom` 사용처가 없습니다(`EaiInfraConfig`가 이미 `SecureRandom` 사용).

### 백엔드

| 파일 | 변경 |
| --- | --- |
| `FileUploadUnitService.java` | 원본 파일명을 진입 시점에 확정하고 null을 `CustomGeneralException`으로 거부. 이후 3개 사용처를 지역변수로 통일 |
| `FileService.java` | `Path.getFileName()` 널 반환 방어 후 확장자 없음으로 폴백 |
| `AuditLogPersister.java` | `columnName` 널 전제 명시 / `createSnapshot` catch를 `ReflectiveOperationException \| ClassCastException`으로 축소 / `setField`의 `throws Exception`을 `throws ReflectiveOperationException`으로 축소 |
| `ApprovalLineDelegate.java` | `doUpdate` → `JsonProcessingException`, `applyRecallInfo` → `JsonProcessingException \| ClassCastException` |
| `AuditLogIdGenerator.java` | catch를 `SQLException`으로 축소 — JavaDoc이 이미 문서화한 `IllegalStateException` 전파와 코드가 일치하게 됨 |
| `GeminiService.java` | `extractText` 널 반환 차단(잠재 NPE 제거) 후 catch를 `RestClientException`으로 축소 |
| `SsoController.java` | 빈 catch 2곳에 `log.trace` 추가 / `resolveFrontendBaseUrl`에서 널 아님 확정 (널 검출 4건이 이 한 곳으로 수렴) |
| `AuthController.java` | 로거 신규 추가 후 빈 catch에 `log.trace` |
| `JwtAuthenticationFilter.java` | `Authorization` 헤더 명시적 널 검사 추가 |
| `BudgetProjectSummaryService.java` | `computeIfAbsent` 반환값 재사용으로 중복 `get()` 제거 |

### 부수 개선 2건

조치 중 발견해 함께 고친 실제 결함입니다.

1. **`GeminiService.extractText`의 잠재 NPE** — `getText()`가 null이면 호출자가 곧바로 `.length()`를 불러 NPE가 났습니다. 원인이 드러나는 예외로 대체했습니다.
2. **`AuditLogIdGenerator`의 JavaDoc 불일치** — "NEXTVAL 결과 없음 시 `IllegalStateException`"이라 문서화했지만 실제로는 `catch (Exception)`이 잡아 `RuntimeException`으로 재포장하고 있었습니다. catch를 좁히며 해소됐습니다.

## 7. 확인 완료 / 잔여 항목

### 확인 완료

| 항목 | 결과 |
| --- | --- |
| 967162 `BRDOCM` 조직명 컬럼 NULL 허용 | **NULL 허용 확인.** 물리 DDL(`V20260708_004`)·엔티티(`Brdocm.java:89, 93`) 양쪽 무제약 → §3 C-4 확정 |
| B-1 로거 존재 여부 | `SsoController` 보유(`:52`), **`AuthController` 미보유** → 로거 추가 선행 필요 |

### 잔여

1. **B-3 HWPX id 범위 (실사용 확인 필요)** — `& 0x7fffffff` 적용 후 Hangul 뷰어가 문서를 정상적으로 여는지 실제 산출물로 확인이 필요합니다. 기존 `Math.floor(Math.random() * 0x7fffffff)`가 0~`0x7ffffffe`, 신규가 0~`0x7fffffff`로 상한만 1 늘었고 단위 테스트는 범위를 고정했지만, HWPX 왕복은 실제 뷰어로만 검증됩니다.
2. **A-3 영향 범위** — 확인 완료. `./gradlew clean test`와 `check` 모두 통과했고, 기존 `ApprovalLineDelegateTest`(`CustomGeneralException` + `JsonProcessingException` cause, `IllegalStateException`)와 `GeminiServiceTest`(`RestClientException` cause) 기대가 그대로 유지됩니다.

## 8. 분류 정정 이력

조치 과정에서 실제 코드를 다시 확인해 판정이 바뀐 항목입니다. **A(실조치 필요) 초기 11건 중 2건이 오탐이었습니다.**

| ID | 위치 | 초기 판정 | 정정 | 근거 |
| --- | --- | --- | --- | --- |
| 967235 | `FileUploadUnitService.java:64` | A-2 실결함 | **B (오탐)** | 바로 앞 `:61`의 `fileValidator.validateExtension`이 이미 null을 거부합니다(`FileValidator.java:30-32`). 다만 그 거부가 `IllegalArgumentException`(500 응답)이라, 조치 시 업무 예외로 바꿔 응답 코드를 바로잡았습니다 |
| 967221 | `AuditLogPersister.java:258` | A-2 실결함 | **B (오탐)** | 유일한 호출자 `collectColumnFields`가 `isAnnotationPresent(Column.class)`로 필터링합니다(`:275`) |
| 967162 | `ServiceRequestDocService.java:272` | A-2 실결함(초판) | **C (설계)** | `OrgNameResolver.resolveName()`의 널 반환이 문서화된 계약이며 물리 DDL·엔티티 모두 NULL 허용 |

정정 후 실제 결함은 **A-1 프론트 빈 catch 3건 + `FileService:523` 1건 + A-3 catch 범위 5건 = 9건**이며, 여기에 조치 중 발견한 부수 결함 2건(§6-1)이 더해집니다. 나머지는 전부 오탐 보정이었습니다.

**교훈**: `NULL_RETURN_STD`는 호출자의 사전 검증을 인식하지 못합니다. 이 검출기의 건은 **호출 지점만 보지 말고 호출자 체인을 따라가야** 실결함과 오탐이 갈립니다.
