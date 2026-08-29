# IT Portal 잔여과제 전체 조치계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `C:\it\TASK.md`의 활성 잔여과제 19건(SEC-18~22, FE-61~63, BE-78~83, CQ-34~40, REPO-04)을 안전하게 해소하고, 검증 결과와 운영 조치까지 추적 가능한 상태로 만든다.

**Architecture:** 백엔드 API·검증 계약과 DB 표준을 먼저 확정한 뒤 프론트엔드가 생성된 계약과 공통 제한/인증 유틸리티를 사용하도록 한다. 보안 권한·세션 갱신·파일 아카이브는 공통 컴포넌트로 수렴시키고, 운영 조치(REPO-04)와 데이터 기반 인덱스 검토(BE-83)는 코드 변경과 분리한다. 운영 DB의 `VARCHAR2` 표준은 BYTE이므로 BE-78은 DB 타입 변경이 아니라 byte-aware 애플리케이션 검증으로 처리한다.

**Tech Stack:** Spring Boot 4 / Java 25 / Gradle / JPA / Oracle / Flyway, Nuxt 4 / Vue 3 / TypeScript / Pinia / PrimeVue, Vitest / Playwright.

**Spec:** `C:\it\TASK.md`

## Global Constraints

- 저장소는 `C:\it\it_backend`, `C:\it\it_frontend`, `C:\it\it_database`의 독립 Git 저장소 3개와 루트 문서 저장소로 운영한다. API 변경은 백엔드 먼저 반영하고 OpenAPI/codegen 이후 프론트엔드를 반영한다.
- 이미 적용된 Flyway 스크립트는 수정하지 않는다. DB 변경은 `C:\it\it_database\migrations\V{YYYYMMDD_NNN}__CamelCase.sql` 새 파일로만 추가한다.
- Flyway는 로컬 검증 환경에서만 실행한다. 개발/운영 적용은 DBA/운영 절차로 넘기며 Oracle 계정·비밀번호·Wallet 경로·토큰·시크릿을 명령행, 문서, 로그, 커밋에 남기지 않는다.
- 백엔드는 `./gradlew test`, `./gradlew check`, 필요 시 `./gradlew bootJar`를 사용한다. 프론트엔드는 `npm run format:check`, `npm run check`, `npm test`를 기본 게이트로 사용하고, API 계약 변경 시 `npm run codegen:check`, 사용자 흐름 변경 시 `npm run test:e2e`를 추가한다.
- 새 JavaDoc, TypeScript 문서, 인라인 주석은 한글로 작성한다. 컨트롤러는 DTO만 반환하고 엔티티를 직접 노출하지 않으며, 입력 DTO에는 `@Valid`, 서비스 계층에는 권한 검사를 유지한다.
- 현재 작업 트리의 변경사항은 사용자 소유로 간주한다. 구현 전 각 저장소에서 `git status --short`와 대상 파일의 `git diff`를 확인하고, 이미 수정된 파일은 필요한 hunk만 추가한다. `git reset --hard`, 무관한 파일 되돌리기, 전체 파일 덮어쓰기를 하지 않는다.
- `REPO-04`는 SQL/마이그레이션 파일을 수정하는 과제가 아니라 환경별 `flyway repair` 운영 조치다. `BE-83`은 실데이터와 실행계획이 확보되기 전까지 인덱스를 만들지 않는다.

## Dependency Order

| 순서 | 작업 묶음 | 선행 이유 | 완료 시점 |
|---|---|---|---|
| 0 | 기준선·변경범위 고정 | dirty worktree, DB 버전, 현재 API 계약을 먼저 보존 | 착수 직후 |
| 1 | BE-78 표준 확인·byte 계약 | 운영 표준(BYTE)을 변경하지 않고 데이터 입력 장애를 차단 | 백엔드 검증/운영 기준 확인 |
| 2 | BE-81, BE-79, BE-80 | 독립적인 ORM/트랜잭션 안전성 정리 | 백엔드 단위/통합 테스트 완료 |
| 3 | SEC-18/19/21/22 + CQ-38 | 권한과 오류 노출 방어를 공통 보안 계층에서 먼저 확정 | 보안 회귀 테스트 완료 |
| 4 | BE-82 + FE-61/CQ-34 | API 응답과 입력 제한 계약을 백엔드부터 고정 | codegen 후 프론트 테스트 완료 |
| 5 | FE-62/63 | 공통 다운로드와 비용 이월 동작을 프론트에 적용 | Vitest/E2E 완료 |
| 6 | CQ-36 + CQ-40 | 중복 아카이브/UTF-8 로직을 공통화하되 기존 동작을 보존 | 회귀 테스트 완료 |
| 7 | CQ-37 | 인증 갱신 상태를 `$apiFetch`와 `useApiFetch` 사이에서 단일화 | 동시 401 테스트 완료 |
| 8 | CQ-39, CQ-35, BE-83, REPO-04 | 저위험 정리·스냅샷·측정/운영 조치 | 전체 검증과 운영 인계 |

## Implementation Tasks

### 0. 기준선과 작업 경계 고정

- [x] 루트와 세 저장소에서 현재 브랜치, `git status --short`, 대상 파일 diff를 기록한다. 특히 이미 dirty한 `AuthService.java`, `useDatabaseByteLimit.ts`, `textLength.ts`, `ITPOWN_DDL_live.sql`은 기존 변경과 이번 변경을 분리한다.
- [x] `C:\it\versions.lock`의 현재 기준을 보존하고, 각 저장소의 변경이 검증된 뒤에만 커밋 SHA와 갱신시각을 갱신한다.
- [x] DB migration은 추가하지 않기로 확정하고 `C:\it\it_database\migrations`의 기존 이력을 변경하지 않는다. 운영 표준 BYTE에 맞춰 BE-78은 애플리케이션 검증으로 처리한다.
- [x] 구현 전/후에 다음 명령의 결과를 작업 기록에 남긴다.

  ```powershell
  git -C C:\it status --short
  git -C C:\it\it_backend status --short
  git -C C:\it\it_frontend status --short
  git -C C:\it\it_database status --short
  rg -n "SEC-18|FE-61|BE-78|CQ-34|REPO-04" C:\it\TASK.md
  ```

### 1. BE-78 — 운영 표준 BYTE 유지 및 byte-aware 검증

- [x] 운영 표준이 전체 `VARCHAR2`에 BYTE라는 사실을 기준선으로 확정한다. `ITPOWN.TPRMPP_BTERMM.SVN_DPM_NM`과 `TPRMPP_BTERML.SVN_DPM_NM`은 `VARCHAR2(100 BYTE)` 상태를 유지한다.
- [x] `V20260828_003__AddTerminalOrgNameSnapshots.sql`은 수정하지 않고, 이 과제를 위해 CHAR 전환용 새 migration도 만들지 않는다. `meta\table.txt`의 `VARCHAR2 100` 행도 BYTE/CHAR 구분을 표현하지 않으므로 수정하지 않는다.
- [x] `ALL_TAB_COLUMNS`에서 두 컬럼의 `DATA_LENGTH = 100`, `CHAR_USED = 'B'`를 확인하고, `CHAR_LENGTH`를 애플리케이션 문자 수 한도로 해석하지 않는다. `ITPOWN_DDL_live.sql`을 재추출할 때도 현재 운영 표준인 `VARCHAR2(100 BYTE)`를 명시적으로 확인한다.
- [x] 두 컬럼에 실제 값을 저장하는 백엔드 경로를 추적해 UTF-8 byte 길이 100 이하를 저장 전에 보장한다. 100 byte 경계, 한글 초과, surrogate pair 경계를 테스트한다. `CQ-40` 공통 `Utf8ByteLimit`을 먼저 사용할 수 있으면 재사용하고, 중복 byte 계산을 새로 만들지 않는다.
- [x] API 입력 검증이 필요한 경로에는 문자 수 `@Size`만 추가하지 말고 byte-aware custom validator 또는 서비스 검증을 적용한다. entity `@Column(length = 100)`은 DB semantics를 CHAR로 바꾸는 설정으로 사용하지 않는다.
- [x] `C:\it\it_database\docs\operations\2026-08-29-terminal-org-name-byte-semantics.md`에 BYTE 표준, 현재 메타데이터, 저장 전 검증, 100 byte 경계 테스트, DBA 확인 내용을 기록한다. 비밀값은 기록하지 않는다.
- [x] 완료조건: CHAR 변경 migration이 없고, 기존 migration 파일 diff가 없으며, `CHAR_USED = 'B'` 검증과 백엔드 byte 경계 테스트가 통과한다.

### 2. BE-79/80/81 — ORM·트랜잭션 안전성

- [x] `C:\it\it_backend\src\main\java\com\kdb\it\common\approval\repository\ApproverRepository.java`의 두 native `UPDATE`에 `clearAutomatically = true`를 추가한다. `flushAutomatically = true`는 유지한다.
- [x] 해당 repository 동작을 확인하는 통합 테스트를 `C:\it\it_backend\src\test\java\com\kdb\it\common\approval\repository\ApproverRepositoryIntegrationTest.java`에 추가하거나 기존 동일 책임 테스트에 보강한다. managed entity의 이전 PK 상태가 bulk update 뒤 재flush되지 않는지 확인한다.
- [x] `C:\it\it_backend\src\main\java\com\kdb\it\common\system\service\AuthService.java`의 private `issueLoginTokens`에서 self-invocation으로 적용되지 않는 `@Transactional(noRollbackFor = LoginRejectedException.class)`을 제거한다. 실제 경계인 `completeLogin`의 트랜잭션과 기존 실패 의미를 보존한다.
- [x] `AuthServiceTest.java`와 `AuthServiceCrtokmAuditIT.java`에서 토큰 발급 성공, 로그인 거부 시 rollback/audit 동작을 확인한다. 이미 수정된 파일이므로 기존 JavaDoc 변경을 덮어쓰지 않는다.
- [x] `C:\it\it_backend\src\main\java\com\kdb\it\domain\log\entity\BitemmL.java`의 `ABUS_MNG_NO` 길이를 DB/master 기준인 30으로 맞춘다. DB migration은 만들지 않는다. entity 메타데이터 회귀 테스트를 추가한다.

### 3. SEC-18/19/21/22 + CQ-38 — 권한·오류 노출 방어

- [x] `OwnershipVerifier.isCurrentUserAdmin()`을 fail-closed로 바꾼다. `CustomUserDetails`가 아닌 principal은 관리자 authority 문자열을 fallback으로 인정하지 않으며, 현재 JWT 필터 경로를 회귀 테스트한다.
- [x] `OwnershipVerifier`에 사용자 정보를 직접 받는 boolean predicate를 추가해 `verifyModifiable`과 파일 authorizer가 같은 판정을 사용하도록 한다. `ProjectFileTargetWriteAuthorizer`는 그 predicate를 호출하고 `allowsGenericMutation()`을 명시적으로 `false`로 override한다.
- [x] `OwnershipVerifierTest.java`와 `ProjectFileTargetWriteAuthorizerTest.java`에 다음 경우를 추가한다: creator/동일 부서 manager/admin 허용, 타인 거부, 비표준 principal 관리자 authority 거부, parent project 권한 상실 후 파일 DELETE 거부, generic mutation 거부. 기존 Banner/RequestForm authorizer 동작도 유지한다.
- [x] `FileUploadUnitService`에서 저장 디렉터리 절대경로가 예외 메시지에 들어가지 않도록 한다. 절대경로는 서버 로그에만 남기고 클라이언트에는 일반화된 메시지를 반환한다. `GlobalExceptionHandlerTest.java`와 `FileUploadUnitServiceTest.java`에서 응답 body에 드라이브/절대경로가 없는지 검증한다. 업무 오류 메시지를 전부 무차별 일반화하지 않는다.
- [x] `@ModelAttribute` 대상 중 서버 전용 `ignorePublicationPeriod`가 외부 파라미터로 주입되지 않도록 `@ControllerAdvice`의 `@InitBinder` 보호를 추가하고, 현재 `BoardPostDto`, `FileDto`, `CostDto`, `ProjectDto` 검색 DTO의 정상 필드 바인딩은 보존한다. `MassAssignmentProtectionTest.java`에서 공격 필드와 정상 필드를 함께 검증한다.
- [x] SEC-20은 `jwt.secret`을 JWT/refresh/MFA fingerprint에 재사용하지 않도록 `security.token-fingerprint-secret`을 별도 secret으로 도입한다. 모든 환경 설정/배포 secret을 32바이트 이상으로 준비하고, `TokenFingerprint`는 새 키만 사용하게 한다. 기존 prefix(`refresh-token:`, `mfa:`)는 domain separation 방어로 유지한다.
- [x] secret 전환은 구 토큰 fingerprint가 필요한 refresh/MFA 흐름의 만료·재인증 정책을 먼저 확인한 뒤 적용한다. `TokenFingerprintTest.java`에 domain별 서로 다른 결과와 새 키 사용을 검증하고, secret 누락 시 안전하게 기동 실패하는 설정 테스트를 둔다.

### 4. BE-82 — 원본 파일 아카이브 실패를 결과에 노출

- [x] `RequestFormSourceFileArchiver.archive(...)`가 실패 파일 key/name을 encounter order의 중복 없는 `List<String>`으로 반환하도록 바꾼다. 업로드/링크 RuntimeException은 기존처럼 ledger commit을 rollback하지 않되, 실패 항목을 로그에 남기고 결과로 전달한다.
- [x] `C:\it\it_backend\src\main\java\com\kdb\it\domain\migration\request\dto\RequestFormDto.java`의 `ImportSummary`에 `archiveFailedFileKeys`를 추가하고 빈 목록을 기본값으로 보장한다. `RequestFormImportService.importBatch`가 archive 결과를 summary에 넣도록 연결한다.
- [x] 모든 `FileResult`/`ImportSummary` 생성부를 갱신하고 `RequestFormSourceFileArchiverTest.java`, `RequestFormImportServiceTest.java`에 성공·부분실패·다중실패·dry-run(항상 빈 목록) 케이스를 추가한다.
- [x] OpenAPI 생성 계약을 갱신한 뒤 프론트 codegen 타입을 업데이트한다. 실패 목록은 절대경로가 아닌 화면에 표시 가능한 파일 식별자만 포함한다.

### 5. FE-61 + CQ-34 — 프로젝트 입력 제한을 문자 수와 바이트 수로 통합

- [x] `C:\it\it_frontend\app\utils\projectFormLimits.ts`를 새 제한 SoT로 만든다. 프로젝트명/설명/현황/필요성/기대효과/미추진문제/범위/계속사업의 DB 문자 한도와 기존 UTF-8 최악 바이트 한도를 한 객체에 둔다. 기존 값은 각각 100/1000/1000/300/4000/4000/600 문자와 300/3000/3000/900/12000/12000/1800 byte이며, ordinary 여부에 따른 necessity limit을 명시한다.
- [x] `useProjectFormByteLimits.ts`, `form.vue`, `template restoreRejectedInput`, `TextLengthIndicator`의 하드코딩 숫자를 이 SoT에서 읽도록 바꾼다. CQ-34의 `BYTE_LIMITS` 이름이 필요한 기존 호출은 같은 모듈에서 export하고, 실제 검증에는 문자/바이트 쌍을 사용한다.
- [x] `textLength.ts`에 `measureDatabaseText`의 `characters`와 `bytes`를 모두 사용하는 `isDatabaseTextWithinLimit(value, { maxCharacters, maxBytes })`를 추가한다. 기존 byte-only 호출은 호환성을 유지하되 프로젝트 입력은 새 predicate를 사용한다.
- [x] `useDatabaseByteLimit.ts`의 `acceptText`, `createModel`, `restoreRejectedInput`이 숫자 byte limit 또는 `{ maxCharacters, maxBytes }`를 받을 수 있게 한다. 초과 시 Toast에 문자/바이트 한도를 모두 표시한다.
- [x] `TextLengthIndicator.vue`와 필요한 `TiptapEditor.vue`에 선택적 `maxCharacters`를 추가해 기존 byte-only 화면을 깨지 않으면서 프로젝트 입력은 두 조건을 표시/검사한다.
- [x] `textLength.test.ts`, `useProjectFormByteLimits.test.ts`, `TextLengthIndicator.test.ts`, `TiptapEditor.test.ts`에 ASCII 101자, 한글 byte 초과, 각 필드 정확한 경계, 문자/바이트 중 하나만 초과하는 경우를 추가한다. `npm run format:check`, `npm run check`, `npm test`로 검증한다.

### 6. FE-62/63 — 첨부 다운로드와 비용 이월

- [x] `CouncilNotice.vue`와 `CouncilAttachments.vue`의 raw `fetch`/Blob/anchor 구현을 제거하고 `C:\it\it_frontend\app\composables\useAttachmentDownload.ts`의 `downloadAttachment`와 `downloadingFileId`를 사용한다. 공통 `$apiFetch` 경로를 통해 401 refresh, 오류 Toast, 동시 다운로드 표시를 보장한다.
- [x] 두 컴포넌트의 업로드/삭제 Toast는 유지하고, 다운로드 전용 중복 상태와 불필요한 `getDownloadUrl` destructuring만 제거한다. composable 단위 테스트와 컴포넌트 바인딩 테스트에서 raw `fetch`가 재도입되지 않았는지 확인한다.
- [x] `useCostCarryOver.ts`에서 list 응답이 `CostTerminalAssembler.attachList()`를 통해 terminal을 이미 포함한다는 계약을 `useCost.ts`/assembler와 테스트로 확인한다. 확인 결과가 현재 계약과 같으면 `fetchCostOnce` detail 재조회와 실패 시 조용한 summary fallback을 제거하고 list source를 그대로 복사한다.
- [x] `useCostCarryOver.test.ts`에서 terminal 포함 source가 detail API 없이 이월되는지, 불필요한 fallback/오류 은닉이 없는지 검증한다. 현재 목록 계약이 충족되어 detail 호출과 무음 fallback을 제거했다.

### 7. CQ-36 — 첨부 아카이브 공통 지원 추출

- [x] `BoardAttachmentArchiveService.java`와 `RequestFormSourceArchiveService.java`의 공통 7개 동작(요청 검증, 선택, 중복 이름, 경로 안전성, preflight, zip streaming)을 `C:\it\it_backend\src\main\java\com\kdb\it\infra\file\service\AttachmentArchiveSupport.java`로 추출한다.
- [x] 공통 지원부는 승인된 파일 목록과 서비스별 entry-name policy/download callback을 받아 opaque `ArchivePlan`을 만들고, plan 검증 전에는 다운로드/response output을 시작하지 않는다. Board는 flat 이름 정책, request source는 안전한 상대경로 정책을 wrapper가 보존한다.
- [x] 두 기존 서비스는 file kind, 메시지, entry path 전략, zip factory만 소유하고 공통 plan/streaming을 위임한다. `FileController.java`의 prepare/write 연결과 public 응답 의미를 보존한다.
- [x] 기존 두 서비스 테스트와 `FileControllerTest.java`를 보강해 선택 subset, 잘못된 ID, duplicate rename, path traversal 방어, nested path, stream close, preflight 실패 시 다운로드 0회를 모두 검증한다. archive focused 테스트와 백엔드 전체 테스트를 실행했다.

### 8. CQ-37 — 인증 갱신 coordinator 단일화

- [x] `plugins/auth.ts`의 module-level `refreshPromise`와 `useApiFetchRefreshCoordinator.ts`의 `activeCycle` 중복 책임을 제거한다. refresh, retry consumer 등록, ERR-14 phase cap, logout/redirect는 기존 coordinator가 단일 소유한다.
- [x] `$apiFetch`가 `useSessionRefreshCoordinator.ts` 또는 동일 factory를 통해 같은 `activeCycle`에 등록되도록 연결한다. `useApiFetch.ts`의 scoped retry semantics와 현재 logout/redirect 동작은 유지한다.
- [x] coordinator API는 한 refresh당 refresh 요청 1회, 성공 시 등록 소비자 모두 1회 retry, refresh 실패/재시도 401 시 terminate 1회라는 불변조건을 문서화하고 구현한다. composable setup context 밖에서 Nuxt composable을 호출하지 않도록 factory 경계를 명확히 한다.
- [x] `useApiFetchRefreshCoordinator.test.ts`, `useSessionRefreshCoordinator.test.ts`, `useApiFetch.test.ts`와 신규 `tests/unit/plugins/auth.test.ts`에서 `$apiFetch`+`useApiFetch` 동시 401, refresh 성공, refresh 실패, retry 401, ERR-14 phase cap을 검증한다.

### 9. CQ-40 — UTF-8 byte 제한 공통화

- [x] `C:\it\it_backend\src\main\java\com\kdb\it\common\util\Utf8ByteLimit.java`를 공통 유틸리티 SoT로 만들고, 현재 `domain\migration\request\service\Utf8ByteLimit.java`의 `length`/codepoint-safe `truncate` 동작을 이전한다. 모든 import를 먼저 갱신한 후 구 클래스를 제거한다.
- [x] `Cinfmm.java`, `NotificationOutboxService.java`, `MigrationCellChecks.java`, `MailHtml.java`의 직접 CharsetDecoder/Encoder 및 byte-length 구현을 공통 유틸리티로 대체한다. null, empty, 정확한 경계, 한글 부분 절단, surrogate pair 동작을 기존 기대와 비교한다.
- [x] 기존 `Utf8ByteLimitTest.java`, `CinfmmTest.java`, `NotificationOutboxServiceTest.java`, `MailHtmlTest.java`를 공통 회귀 세트로 정리하고, 동일 문자열이 모든 소비자에서 같은 byte 길이/절단 결과를 내는지 검증한다.

### 10. CQ-39 — 저위험 중복·export 정리

- [x] `ProjectBudgetSummaryService.java`에서 `ioeC() != null` 필터를 한 번 계산해 `validItems`와 `mplItems`가 재사용하게 한다.
- [x] `ApplicationServiceRecallTest.java`의 사용하지 않는 `assertThat` import를 제거한다.
- [x] `requestFormSourceTree.ts`의 외부 참조가 없는 `SourceFileKind`, `headerSection.ts`의 외부 참조가 없는 `buildApprovalTable`, `budgetWorkDefaults.ts`의 외부 참조 없는 타입 export를 전체 repo `rg` 확인 후 downgrade/remove한다. Vue template/동적 import가 없는지 확인하고 `npm run check`로 마무리한다.

### 11. CQ-35 — live DDL 스냅샷 재추출

- [ ] 현재 dirty한 `C:\it\it_database\ITPOWN_DDL_live.sql`의 기존 diff를 먼저 보존한다. `C:\it\it_database\export-ddl-live.ps1`를 승인된 로컬 Wallet/DB 환경에서 실행해 현재 DB의 CFILEM 명칭, BTERMM/BTERML snapshot column, metadata/table 정의를 재추출한다.
- [ ] DB 실행은 하지 않고 파일 snapshot만 갱신한다. 사용자 기존 변경 hunk와 재추출 결과를 분리해 검토하며, secret·접속정보가 output에 들어가지 않았는지 확인한다.
- [ ] migration history 및 `V20260828_003` 결과와 snapshot diff를 대조하고, DDL snapshot은 배포용 migration 대체물이 아님을 문서에 남긴다.

### 12. BE-83 — 측정 전 인덱스 보류

- [ ] `BtermmRepository.findServiceNamesByTmnClsfC`와 `GuideDocRepository` 조회의 실제 운영/개발 데이터 분포, predicate 선택도, 실행계획을 DBA와 함께 측정한다.
- [x] 측정 전에는 index migration을 생성하지 않는다. 후보 인덱스가 필요할 때만 실행계획 전/후, DML 비용, 사용률과 함께 별도 승인 후 Flyway로 추가한다.
- [x] 측정 결과와 “현재는 보류” 결정을 `docs/operations` 또는 성능 검토 문서에 기록한다.

### 13. REPO-04 — Flyway checksum repair 운영 조치

- [x] `C:\it\docs\operations\2026-08-29-flyway-checksum-repair.md`에 대상 환경, 승인자, 사전 backup/중지 조건, before checksum, repair 실행, after validate 결과를 기록할 양식을 만든다. 계정/비밀번호는 기록하지 않는다.
- [ ] 각 환경에서 `flyway_schema_history`의 `V20260825_001` checksum과 현재 migration artifact를 대조한다. 구 checksum으로 이미 적용된 환경만 애플리케이션 중지 후 승인된 Flyway workflow에서 1회 `flyway repair`한다.
- [ ] repair 후 `flyway validate`, 애플리케이션 기동 health check, history success=1을 확인한다. history row 삭제/수동 checksum SQL 수정/스크립트 편집은 금지한다.
- [x] 현재 로컬에서 확인된 13개 delta row와 success=1 상태는 기준선으로 남기고, 환경별 결과를 분리 기록한다.

## Verification and Release Handoff

- [ ] 백엔드: 대상 단위 테스트 → 관련 통합 테스트 → `./gradlew check` → 필요 시 `./gradlew bootJar` 순서로 실행한다. 대상 테스트와 전체 `./gradlew test`는 통과했으나, `check`의 기존 Spotless 위반 81건은 별도 정리 과제로 남겼다.
- [x] 프론트엔드: `npm run format:check` → `npm run check` → `npm test` → API/flow 변경 시 `npm run codegen:check` 순서로 실행한다. `npm run test:e2e`는 별도 실행 환경이 필요한 운영 흐름으로 이번 작업에서 실행하지 않았다.
- [x] DB: 이번 BE-78에 대해서는 migration을 만들거나 적용하지 않는다. 기존 migration 파일 정적 검토, `ALL_TAB_COLUMNS`의 `DATA_LENGTH = 100`/`CHAR_USED = 'B'` 기준, `flyway_schema_history` 상태, 백엔드 byte 경계값 검증을 문서화했다. 별도 migration이 필요한 다른 과제는 만들지 않았다.
- [x] 보안 회귀: fail-closed principal, generic mutation, mass assignment, 절대경로 비노출, fingerprint secret 분리, 동시 401 1회 refresh를 확인한다.
- [x] 문서화: 각 완료 task ID와 검증 명령/결과를 `C:\it\TASK_DONE.md`에 추가하고, 검증이 끝난 ID만 `C:\it\TASK.md`에서 제거한다. 실패·보류인 CQ-35/BE-83/REPO-04는 완료로 표시하지 않는다.
- [x] 세 저장소 커밋 SHA가 확정된 후 `C:\it\versions.lock`을 갱신하고, 최종 `git status --short`에서 의도한 파일만 남겼는지 확인한다.

## Suggested Commit/Delivery Slices

1. `backend: enforce terminal org name byte semantics` — BE-78 및 운영 표준 문서.
2. `backend: harden ownership and transaction boundaries` — SEC-18/19/21/22, CQ-38, BE-79/80/81.
3. `backend: report source archive failures` — BE-82와 OpenAPI.
4. `frontend: centralize project database text limits` — FE-61/CQ-34와 codegen 영향.
5. `frontend: unify attachment download and carry-over behavior` — FE-62/63.
6. `backend: consolidate archive and utf8 support` — CQ-36/CQ-40.
7. `frontend: share session refresh coordinator` — CQ-37.
8. `chore: refresh ddl snapshot and remove dead exports` — CQ-35/CQ-39.
9. 운영 인계 — BE-83 측정 결과와 REPO-04 repair 결과를 별도 기록.

계획의 코드 slice는 구현·검증을 완료했으며, CQ-35 라이브 DDL 재추출과 REPO-04 환경별 repair는 승인된 운영 접근이 필요한 인계 항목으로 남겼다. BE-83은 실데이터·실행계획 측정 전 인덱스를 만들지 않는 보류 결정으로 종료했다.
