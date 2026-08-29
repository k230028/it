# IT Portal 잔여과제

|   우선순위   | 의미           |
| :-----------: | -------------- |
|  🔴 Critical  | 즉시 조치      |
|    🟠 High    | 조속 조치      |
|   🟡 Medium   | 계획 반영      |
|    🟢 Low    | 선택 개선      |
| 🏛️ External | 외부/운영 의존 |
|    ✅ Done    | 확인 완료      |

## 🔒 보안

| ID     | 우선순위  | 유형   | 과제                                            | 근거/조건                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | --------- | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-18 | 🟡 Medium | 인증   | `OwnershipVerifier.isCurrentUserAdmin` fail-open 완화 | 2026-08-23 이후 델타에서 `authentication.getPrincipal() instanceof CustomUserDetails user && user.isAdmin()`(principal 타입이 다르면 **거부**)가 권한 문자열 폴백 `getAuthorities().anyMatch("ROLE_ADMIN")`으로 바뀌었고 Javadoc의 "주체가 CustomUserDetails가 아니면 false" 문구도 함께 삭제됐다. 현재 운영에서는 `JwtAuthenticationFilter`가 항상 `CustomUserDetails`를 심으므로 폴백에 도달하지 않아 악용 불가이나, 다른 인증 메커니즘이 추가되면 권한 문자열만으로 관리자 판정이 통과한다. fail-closed 복원 또는 폴백을 둔 의도의 명시적 문서화가 필요하다. 델타 diff로 확인. |
| SEC-19 | 🟢 Low    | 파일   | 사업 첨부 삭제가 부모 사업 쓰기 권한을 재평가하지 않음 | `ProjectFileTargetWriteAuthorizer`가 `allowsGenericMutation()`을 오버라이드하지 않아 인터페이스 기본값 `true`를 쓴다. 첨부 **연결**은 판정기를 통과해야 하지만 `DELETE /api/files/{flMpnId}`는 업로더 본인 여부만 본다. 업로더가 이후 부서 이동·사업 주관부서 변경으로 해당 사업 쓰기 권한을 잃어도 삭제는 계속 성공한다. `BannerFileTargetWriteAuthorizer`·`RequestFormFileTargetWriteAuthorizer`만 `false`로 이 경로를 닫아 두었다. 종류별로 이 기본값을 명시 판단하도록 정리한다. |
| SEC-20 | 🟢 Low    | 암호   | `TokenFingerprint`가 JWT 서명 비밀키를 HMAC 키로 재사용 | `jwt.secret` 하나가 JJWT HS256 서명, Refresh Token 지문, MFA 지문 세 용도에 쓰인다. 현재는 `refresh-token:`·`mfa:` 도메인 구분자와 JWT 입력이 항상 base64url로 시작한다는 점 때문에 교차 위조가 성립하지 않는다. 접두사 없는 세 번째 용도가 추가되면 그 보장이 깨지므로, 별도 키 분리(또는 HKDF 파생)나 최소한 클래스 Javadoc의 전제 명시가 필요하다. |
| SEC-21 | 🟢 Low    | 정보노출 | `CustomGeneralException` 메시지에 서버 절대경로 포함  | `GlobalExceptionHandler.handleCustomGeneralException`이 `e.getMessage()`를 400 응답 본문에 그대로 싣는다. `FileUploadUnitService`의 저장 디렉터리 생성 실패 메시지가 서버 파일시스템 절대경로를 포함해 인증 사용자에게 노출된다. 포괄 `Exception`·`RuntimeException` 핸들러는 일반화된 문구만 반환하는 것과 대비된다. 경로는 로그에만 남긴다. |
| SEC-22 | 🟢 Low    | 입력   | `@ModelAttribute` 마스 어사인먼트 전역 방어선 부재     | 저장소 전체에 `@InitBinder`·`setDisallowedFields`가 0건이다. 현재 `@ModelAttribute` 바인딩 대상 4개(`BoardPostDto`·`FileDto`·`CostDto`·`ProjectDto`의 `SearchCondition`)를 전수 확인한 결과 실제 취약점은 없고 `BoardPostDto.SearchCondition.ignorePublicationPeriod`는 `@Setter(AccessLevel.NONE)`로 정확히 잠겨 있다(SEC-17 조치). 다만 새 DTO에 서버 전용 필드가 setter와 함께 추가되면 이를 잡는 장치가 리뷰뿐이다. `@ControllerAdvice` 수준 `@InitBinder` 또는 ArchUnit 규칙으로 구조화한다. |

_SEC-17 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 잔여과제 저비용 배치를 참조합니다. SEC-04·SEC-05 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-19 Remediation Phase 1, SEC-06은 같은 문서의 2026-07-19 배포 정합성 후속, SEC-08·SEC-09는 2026-07-25 보안 트랜잭션 무결성 절을 참조합니다._

_SEC-10(지정맥 BioAgent 연동 규격 반영)과 SEC-11(지정맥 해시 검증 도입)은 `mfa.md` 반입 직후 같은 작업에서 해소해 표에 남기지 않습니다. 규격과 구현 대조 결과는 `it_frontend/README.md`의 「추가 인증(MFA) 연결」을 참조합니다._

_SEC-12 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-28 활성 잔여과제 일괄 조치 기록을 참조합니다._

## 🤝 사전협의

> 현재 활성 사전협의 과제 없음. 2026-07-26 완료·폐기 항목은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다.

## ⚠️ 에러 처리

> 현재 활성 에러 처리 과제 없음.

_ERR-09·ERR-10 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-26 에러 표면화·복구 기록을, ERR-06은 2026-07-19 Remediation Phase 1, ERR-05는 같은 문서의 2026-07-19 배포 정합성 후속 기록을 참조합니다. ERR-11·ERR-12는 같은 문서의 2026-07-29 저장 복구·조회 실패 표면화 기록을, ERR-13은 2026-07-31 ERR-13·FE-15~19 조치 기록을, ERR-14는 2026-08-06 잔여과제 저비용 배치 1 기록을 참조합니다._

## 🎨 프론트엔드

| ID    | 우선순위  | 유형   | 과제                                          | 근거/조건                                                                                                                                                                                                                                                                                                                                                       |
| ----- | --------- | ------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-61 | 🟡 Medium | 검증   | 입력 한도 판정이 `VARCHAR2(n CHAR)`의 실제 제약을 막지 못함 | `useProjectFormByteLimits`의 상한 7개가 모두 대상 컬럼 `CHAR_LENGTH`의 정확히 **3배 바이트**다(**로컬 실측**: `ABUS_NM` 100 C↔300, `ABUS_CONE`·`CPN_SAF_CONE` 1000 C↔3000, `ABUS_NCS_CONE` 300 C↔900, `DGOG_PPO_CONE`·`PLM_DES` 4000 C↔12000, `ABUS_RNG_CONE` 600 C↔1800 — 7개 전부 CHAR semantics). 즉 한글 최악 바이트만 막고, **ASCII 위주 입력은 `n`자를 넘어도 화면을 통과**해 서버에서 `ORA-12899`가 난다(예: `ABUS_NM`에 영문 200자). 백엔드 DTO에도 대응 `@Size`가 없어 마지막 방어선이 없다. `measureDatabaseText`가 계산하는 `characters`도 앱 코드에서 소비되지 않는다. **조치**: 판정을 글자 수와 바이트의 논리곱으로 바꾸고 백엔드 `@Size`를 함께 건다. 2026-08-29 REVIEW에서 한계를 주석·문서에 명시해 두었다. |
| FE-62 | 🟢 Low    | API패턴 | 협의회 첨부 내려받기가 공통 composable을 쓰지 않음      | `CouncilNotice.vue`·`CouncilAttachments.vue`가 raw `fetch(..., { credentials: 'include' })` + Blob + `<a download>` 15줄을 각각 중복 보유한다. 같은 델타가 `useAttachmentDownload`를 신설하고 `it_frontend/CLAUDE.md` §5가 이를 규칙화했는데 두 파일은 헤더 주석만 갱신되고 내려받기 경로는 남았다. raw `fetch`는 `$apiFetch`의 401→갱신→세션 만료 재진입 흐름을 타지 않아 토큰 만료 시 사용자가 재인증되지 않는다. 협의회 전용 Toast 문구가 필요하면 `useAttachmentDownload`에 문구 주입 인자를 추가한다. |
| FE-63 | 🟢 Low    | 오류   | 계속계약 전년도 상세 조회 실패가 무음 폴백            | `useCostCarryOver.applyContinuation`이 `catch (e) { console.warn(...); fullSource = source; }`로 요약 데이터를 대신 쓰고 그대로 진행해 사용자에게는 "불러오기 성공"으로 보인다. 목록 응답도 `CostTerminalAssembler.attachList()`로 단말기를 조립하므로 실질 데이터 손실 가능성은 낮으나, 403 같은 권한 실패까지 무음 처리된다. 폴백 시 경고 Toast를 띄우거나, 목록이 이미 단말기를 포함한다는 사실에 맞춰 상세 조회 자체를 제거하고 낡은 주석을 정정한다. |

_FE-59·FE-60 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-28 활성 잔여과제 일괄 조치 기록을 참조합니다._

_FE-47·FE-48 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 E2E 안정화 절을 참조합니다. FE-54 완료 근거는 같은 문서의 2026-08-23 FE-54·MIG-01 절을 참조합니다. FE-56·FE-58 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 잔여과제 저비용 배치 4를 참조합니다. FE-57 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 잔여과제 저비용 배치 2를 참조합니다. FE-37 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-18 FE-37 사이트 전체 고정 문구 i18n 이관 기록을 참조합니다. 2026-07-26 잔여과제 통합 조치의 완료·폐기 이력은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다. FE-21과 FE-30①·FE-28②는 같은 문서의 2026-08-06 잔여과제 저비용 배치 1 기록을, FE-36은 2026-08-09 잔여과제 일괄 조치 기록을, FE-38은 2026-08-17 DDL 불필요 잔여과제 배치 기록을, FE-41·FE-42는 같은 날 배치 4 기록을, FE-40은 배치 5 기록을, FE-39·FE-43은 배치 6 기록을 참조합니다. FE-44(다국어 관리 조회 실패 표면화)는 2026-08-18 다국어 관리·변경로그 구현 배치에서 처리했습니다(`docs/superpowers/plans/2026-08-18-translation-admin-and-change-log.md` 및 이 배치의 커밋 참조). FE-45(다국어 관리 편집 진입 키보드 접근성)는 전제가 거짓으로 밝혀져 과제에서 제외합니다 — PrimeVue 4.5.5는 Enter/Space 키 활성화도 `onEnterKey → onRowClick` 경로로 `row-click`에 합류시켜 애초부터 키보드로 도달할 수 있었습니다._

## ⚙️ 백엔드

| ID    | 우선순위  | 유형 | 과제                                                | 근거/조건                                                                                                                                                                                                                                                                                                                                                     |
| ----- | --------- | ---- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE-78 | 🟠 High   | DB   | `BTERMM`·`BTERML`의 조직명 스냅샷이 BYTE semantics로 생성됨 | `V20260828_003__AddTerminalOrgNameSnapshots.sql`이 `ADD (SVN_DPM_NM VARCHAR2(100))`으로 CHAR 지정 없이 컬럼을 만들어 인스턴스 기본값 BYTE로 생성됐다. **로컬 실측**: `TPRMPP_BTERMM`·`TPRMPP_BTERML`은 `100 B`인데 동일 논리 컬럼을 가진 `BCOSTM`·`BCOSTL`·`BPROJM`·`BPROJL`·`BRDOCM`·`BRDOCL` 6개는 모두 `100 C`다. 엔티티는 `@Column(length = 100)`으로 글자 수를 전제하므로 한글 34자부터 `ORA-12899`가 난다. 5일 전 `V20260823_002`(BE-65)가 같은 부류를 CHAR로 정렬한 정책의 역행이다. **조치**: 신규 Flyway로 두 테이블을 `VARCHAR2(100 CHAR)`로 MODIFY. 적용된 `V20260828_003`은 수정하지 않는다. 그 스크립트 말미 검증 블록이 `DATA_LENGTH = 100`을 하드코딩하므로 CHAR 전환 시 `CHAR_LENGTH = 100 AND CHAR_USED = 'C'` 기준으로 함께 바꾼다. |
| BE-79 | 🟡 Medium | JPA  | 결재선 재정렬 native UPDATE에 `clearAutomatically` 누락 | `ApproverRepository`의 두 native UPDATE가 `DCR_SQN_SNO`를 바꾸는데 이 컬럼은 `@IdClass(CdecimId)`의 PK 구성요소다. `@Modifying(flushAutomatically = true)`만 있고 `clearAutomatically = true`가 없어, 직전에 `getApprovers()`로 managed 상태가 된 `Cdecim`들이 옛 순번을 든 채 1차 캐시에 남는다. 같은 트랜잭션에서 그중 하나라도 더럽혀지면 flush가 옛 PK로 나가 **다른 결재자 행**을 덮어쓴다. 현재 호출 흐름(`updateApprovalOrder`)은 `Capplm`만 수정해 발현하지 않는 잠복 결함이다. 저장소의 다른 `@Modifying` 6곳은 모두 두 속성을 함께 쓴다. |
| BE-80 | 🟢 Low    | 코드 | `@Transactional`이 private 메서드에 붙어 무효           | `AuthService.issueLoginTokens`가 `@Transactional(noRollbackFor = LoginRejectedException.class)`를 달고 있으나 private이고 유일한 호출자가 같은 클래스의 `completeLogin`이라 프록시를 우회한다. 실제 경계는 `completeLogin`이 소유하며 `noRollbackFor`는 적용되지 않는다. 이 경로는 실패 이력을 저장하지 않아 기능상 문제는 없으나 "롤백 정책이 걸려 있다"는 잘못된 신호를 남긴다. 애너테이션을 제거한다. (2026-08-29 REVIEW에서 오해를 유발하던 고아 JavaDoc은 실제 계약에 맞게 정정했고, 애너테이션 제거만 남았다.) |
| BE-81 | 🟢 Low    | JPA  | `BitemmL.ABUS_MNG_NO` 선언 길이가 실제 컬럼보다 큼      | `@Column(name = "ABUS_MNG_NO", length = 32)`인데 **로컬 실측** `TPRMPP_BITEML.ABUS_MNG_NO`는 `VARCHAR2(30 CHAR)`이고 마스터 `Bitemm`도 `length = 30`이다. 이번 델타가 `BtermmL`의 동일 부류 과대선언(32→16·15·14)을 일괄 정정하면서 이 한 건만 남았다. 현재 채번 형식이 훨씬 짧아 발현 가능성은 낮다. DB 변경 불필요 — 엔티티만 `30`으로 정정. |
| BE-82 | 🟢 Low    | 오류 | 편성요청서 반입 원본 보관 실패가 결과에 드러나지 않음      | `RequestFormSourceFileArchiver`의 두 지점이 `catch (RuntimeException e) { log.error(...); return; }`로 로그만 남긴다. 원장은 이미 커밋됐으므로 트랜잭션을 되돌리지 않는 판단 자체는 타당하나, `ImportSummary`·`FileResult` 어디에도 보관 실패를 담을 필드가 없어 관리자는 "반영 완료"를 보고 나중에 첨부 0건을 발견한다. 실패 파일명을 요약에 실어 화면 경고로 노출한다. |
| BE-83 | 🟢 Low    | 성능 | 신규 조회 조건 컬럼 인덱스 부재                          | `BtermmRepository.findServiceNamesByTmnClsfC`는 `delYn`·`tmnClsfC`로 거르는데 `TPRMPP_BTERMM`에는 `PK`와 `IX_TPRMPP_BTERMM_01(BG_NO,BG_SNO)`뿐이다(조인 대상 `BCOSTM`이 주도할 가능성은 있음). `GuideDocRepository.findByDocTtlConeAndDocMngNoStartingWithAndDelYn`은 `UX_BGDOCM_FDOC_TARGET`이 함수 기반이라 매칭되지 않아 full scan이다. **실데이터가 없어 플랜 실측을 못 했으므로 지금 인덱스를 만들지 않는다.** 데이터가 쌓인 뒤 실측해 필요하면 Flyway로 추가한다. |

_BE-75·BE-76·BE-77 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-28 활성 잔여과제 일괄 조치 기록을 참조합니다._

_BE-51 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-24 BE-51 `TPRMPP_CFILEM` 부모 키 컬럼 개명·폭 축소 절을 참조합니다 — 추가한 `V20260824_003__RenameAndResizeCfilemParentKeyColumns.sql`은 로컬 기동으로 적용됐으며 dev/prod는 DBA 적용 대기 상태입니다. BE-57 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 BE-57 원격 WAS 로그 다운로드 복구 절을 참조합니다. BE-72(`MAXVALUE 9999` 시퀀스 `CYCLE`)는 2026-08-23 ☑️ 감내로 종료했습니다 — 발동 조건이 "연 10,000건 채번"이라 도달할 수 없고, `NOCYCLE` 회귀는 오히려 누적 9,999건에서 영구 정지를 부릅니다. 근거와 정정 내용은 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 BE-72 감내 판정을 참조합니다. BE-65(BE-73 ② 포함) 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 잔여과제 저비용 배치 3을 참조합니다 — 추가한 `V20260823_002__AlignByteSemanticColumnsToCharSemantics.sql`은 로컬 기동·DBA 적용 대기 상태이며 인계 노트는 [`it_database/docs/operations/2026-08-23-char-semantics-alignment-handover.md`](it_database/docs/operations/2026-08-23-char-semantics-alignment-handover.md)입니다. BE-67·BE-70·BE-73 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 잔여과제 저비용 배치 2를 참조합니다(BE-73③이 추가한 `V20260823_001__AlignPersonNameBackfillPredicate.sql`은 로컬 기동·DBA 적용 대기 상태입니다). BE-68·BE-69·BE-74 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 잔여과제 저비용 배치를 참조합니다. BE-34 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-06 잔여과제 저비용 배치 1 기록을, BE-35·BE-38·BE-39는 같은 문서의 2026-08-17 DDL 불필요 잔여과제 배치 2 기록을, BE-37·BE-40은 같은 날 배치 3 기록을 참조합니다. BE-41·BE-42·BE-43·BE-44·BE-46은 2026-08-18 다국어 관리·변경로그 구현 배치에서 처리했습니다(`docs/superpowers/plans/2026-08-18-translation-admin-and-change-log.md` 및 이 배치의 커밋 참조). BE-49(다국어 변경로그·메뉴 시드 마이그레이션 유실)는 2026-08-19 당일 복원·적용해 종료했습니다([`TASK_DONE.md`](TASK_DONE.md) 2026-08-19 절 참조)._

## 🔄 수기 엑셀 이관

> 현재 활성 수기 엑셀 이관 과제 없음.

_MIG-01 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 MIG-01 이관 배선 절을 참조합니다. MIG-02·MIG-04·MIG-06·MIG-15·MIG-19·MIG-20·MIG-21·MIG-23 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-17 DDL 불필요 잔여과제 배치 기록을, MIG-13·MIG-18은 같은 날 배치 3 기록을, MIG-10·MIG-25는 배치 4 기록을, MIG-22·MIG-24는 배치 5 기록을, MIG-03·MIG-14·MIG-16·MIG-17·MIG-26은 배치 6 기록을 참조합니다._

## 🧹 Clean Code 부채

| ID    | 우선순위 | 유형   | 과제                                    | 근거/조건                                                                                                                                                                                                                                                                                                             |
| ----- | -------- | ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CQ-34 | 🟢 Low   | 구조   | 입력 바이트 상한이 필드당 최대 3곳에 하드코딩 | 같은 필드의 상한이 `useProjectFormByteLimits`의 `createModel(..., 300)`, 템플릿의 `restoreRejectedInput($event, …, 300)`, `<TextLengthIndicator :max-bytes="300">` 세 곳에 각각 리터럴로 존재한다(`guardedNecessity`는 `isOrdinary ? 12000 : 900` 분기까지 템플릿에 재현). 현재 값은 전부 일치하나, 하나만 바뀌면 "입력은 거부되는데 카운터는 여유 있다고 표시"가 조용히 발생한다. 컬럼별 상한을 `BYTE_LIMITS` 상수로 한 곳에 노출하고 템플릿이 그것을 참조하게 한다. FE-61과 함께 처리하면 좋다. |
| CQ-35 | 🟢 Low   | 문서동기화 | `ITPOWN_DDL_live.sql` 라이브 덤프가 최신 스키마 반영 전 | 마지막 재생성(`54038c7`) 이후 스키마가 바뀌어 덤프가 `V20260824_003` 이전 상태다. `TPRMPP_CFILEM` 블록이 여전히 개명 전 컬럼명을 보여 주고(파일 전체에 새 컬럼명 0건), `TPRMPP_BTERMM`·`TPRMPP_BTERML`에는 `V20260828_003`이 추가한 조직명 스냅샷 컬럼이 없다. `meta/table.txt`는 정상 갱신돼 있어 두 문서가 서로 어긋난다. 현재 DB에서 재추출해 커밋한다(DDL 실행 아님). |
| CQ-36 | 🟡 Medium | 중복   | 첨부 ZIP 아카이브 서비스 2개가 사실상 통째로 복제됨 | `BoardAttachmentArchiveService`(173줄)와 `RequestFormSourceArchiveService`(188줄)의 `prepareArchive`/`writeArchive`/`validateRequest`/`resolveSelection`/`preflight`/`uniqueEntryName`/`writeZip` 7개 메서드와 `ArchivePlan`·`ArchiveFile` record가 구조·제어흐름까지 동일하고, BE-67 헤더 선확정 금지 Javadoc 문단은 문자 단위로 같다. 두 서비스의 2단계 분할은 **이번 델타에서 각각 따로 추가**됐다(`961251b8`·`207ba5a9`·`a201e9db`). 차이는 파일종류 상수, 오류 문구, 엔트리명 도출(상대경로 유지 vs 평면 sanitize), `zipOutputStreamFactory` 주입 유무뿐. 공통 지원 타입으로 검증·선택해석·중복명 채번·ZIP 스트리밍을 올리고 두 서비스는 종류·엔트리명 전략·문구만 제공하도록 축소한다. BE-67 계약이 두 곳에 복제된 상태라 한쪽만 고쳐지는 드리프트 위험이 크다. |
| CQ-37 | 🟡 Medium | 중복   | 401 토큰갱신 조정자가 두 벌이고 상태를 공유하지 않음 | `plugins/auth.ts`의 모듈 지역 `refreshPromise` 단일비행과 `useApiFetchRefreshCoordinator`의 `activeCycle`이 각각 (a) 갱신 단일비행 (b) 성공 시 재시도 (c) 실패 시 `logout()` + `redirectAfterSessionExpiry`를 중복 수행하는데 공유 상태가 없다. `$apiFetch` 경로와 `useApiFetch` 경로에서 401이 동시에 나면 `refresh()`가 두 번 발생하고, 조정자의 ERR-14 상한(`phase === 'retrying'` 즉시 종료)이 `$apiFetch` 쪽 401에는 걸리지 않는다. 두 경로 모두 델타 커밋 `92e0e5b7`에서 도입·변경됐다. 조정자 하나로 단일화한다. |
| CQ-38 | 🟢 Low   | 중복   | 권한 판정식이 인가기와 `OwnershipVerifier`에 이중 구현 | `ProjectFileTargetWriteAuthorizer`(델타 신규)의 판정식이 `OwnershipVerifier.verifyModifiable`과 동일하고 클래스 Javadoc도 그렇게 선언한다. 재사용하지 못한 이유는 시그니처뿐이다 — `verifyModifiable`은 SecurityContext에서 사용자를 꺼내 예외를 던지는데 인가기는 명시적 `user` 인자와 boolean 반환이 필요하다. `OwnershipVerifier`에 boolean 판정 메서드를 추가하고 `verifyModifiable`이 그것을 호출하게 하면 "본문은 못 고치는데 첨부는 바꿀 수 있다"는 드리프트가 구조적으로 차단된다. SEC-19와 함께 처리한다. |
| CQ-39 | 🟢 Low   | 정리   | 델타에서 확인된 소규모 정리 5건                    | ① `ProjectBudgetSummaryService`의 `validItems`(:145)와 `mplItems`(:158)가 같은 필터(`item.ioeC() != null`)를 두 번 계산 — `mplItems` 제거하고 재사용. ② `ApplicationServiceRecallTest:3`의 `assertThat` static import가 미사용(본문은 `assertThatThrownBy`만 사용). ③ `requestFormSourceTree.ts:9`의 `SourceFileKind`, ④ `headerSection.ts:60`의 `buildApprovalTable`, ⑤ `budgetWorkDefaults.ts:1,10`의 `BudgetWorkDefaultRateInput`·`BudgetWorkDefaultRates`가 각각 외부 참조 0건 — `export` 강등 검토. 미사용 판정은 인라인 `import('~/utils/…').T` 형태와 `.vue` 템플릿을 포함한 저장소 전체 grep으로 확인했다. |
| CQ-40 | 🟢 Low   | 중복   | UTF-8 바이트 절단 유틸이 두 벌                     | 델타 신규 `Utf8ByteLimit`(코드포인트 누적)과 기존 `Cinfmm.clampToBytes`(`CharsetDecoder` IGNORE)가 같은 목적(Oracle BYTE 시맨틱 컬럼 `ORA-12899` 방지)을 서로 다른 기법으로 구현한다. `NotificationOutboxService`·`MigrationCellChecks`·`MailHtml`도 각각 바이트 길이를 직접 계산한다. `Utf8ByteLimit`을 공통 위치로 승격해 통합한다. |

_CQ-32는 2026-08-23 저비용 배치 3에서 종료했습니다 — ③ 폴더 트리 빌더는 실측 결과 통합하지 않기로 결정하고(노드 타입·정렬 규칙·집계 필드가 달라 제네릭 배관이 중복보다 큽니다) basename 헬퍼만 합쳤습니다. CQ-30(등재 이후 이미 해소돼 있어 해소 처리)·CQ-31·CQ-33 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-23 잔여과제 저비용 배치를 참조합니다. CQ-02~05·07~14 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-21 Clean Code Wave 0·1·2와 2026-07-25 정리 이관 절을, CQ-06·17·21은 2026-08-04 Wave 3 Wave A 절을, CQ-16은 2026-08-04 Wave 3 Wave B·C 절을, CQ-20은 2026-08-01 Prettier 잔여 해소 절을, CQ-25·26은 2026-08-09 잔여과제 일괄 조치 절을 참조합니다. CQ-27·CQ-28은 2026-08-18 다국어 관리·변경로그 구현 배치에서 처리했습니다(`docs/superpowers/plans/2026-08-18-translation-admin-and-change-log.md` 및 이 배치의 커밋 참조)._

## 📝 Tiptap 변수 입력

> 현재 활성 Tiptap 변수 입력 과제 없음. 2026-07-26 완료·폐기 항목과 알려진 제한은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다.

## 📡 실시간 로그

> 현재 활성 실시간 로그 과제 없음.

## 📬 공통 게시판

> 현재 활성 과제 없음.

_BOARD-1(게시판 다국어 메시지의 `@`가 vue-i18n 링크 문법으로 해석돼 500)은 2026-08-19 TEST.md 실행 후속으로 해소했습니다 — `i18n/messages/board.ts`의 ko·en 5개 키를 `{'@'}` 리터럴 보간으로 이스케이프했고, 회귀 방지로 `tests/unit/i18n/messages.test.ts`에 전체 메시지를 vue-i18n 컴파일러에 통과시키는 테스트를 두었습니다. `board.spec.ts` 9건 전부 통과로 확인했습니다._

## 🗂️ 저장소 위생

| ID      | 우선순위    | 유형 | 과제                                          | 근거/조건                                                                                                                                                                                                                                                                                                                                       |
| ------- | ----------- | ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REPO-04 | 🏛️ External | DB   | `V20260825_001` 체크섬 변경 이력에 대한 환경 안내 | `V20260825_001__AddFormGuideUniquenessAndAdminMenu.sql`의 내용이 main 이력상 3번 달라졌다(`1b2d47e` → `75fd958` → `7b6d190` → `8d0dc42`). 마지막 커밋은 목표 상태를 `V20260825_002`로 분리하며 원본을 `75fd958` 내용으로 되돌린 올바른 처리이고, **로컬 실측 결과 `ITPOWN.FLYWAY_SCHEMA_HISTORY`의 델타 13건(20260823.001~005, 20260824.001~003, 20260825.001~002, 20260828.001~003)이 전부 `success = 1`**이다. 다만 2026-08-25에 `1b2d47e`나 `7b6d190` 시점을 당겨 `flyway migrate`를 실행한 **다른 개발자 환경**은 다른 체크섬이 기록돼 있어 이후 pull 시 `FlywayValidateException`으로 기동이 막힌다. 해당 환경은 `flyway repair`를 1회 수행한다. **스크립트는 수정하지 않는다.** |

_2026-08-29 REVIEW에서 `versions.lock`을 `scripts/update-versions-lock.ps1`로 갱신했습니다 — 기록이 2026-08-26에 멈춰 있었고 브랜치 필드가 세 저장소 모두 `codex/project-form-guide`였으나 실제로는 전부 `main`이었습니다. 기록된 SHA 3건은 `git cat-file -e`로 실재를 확인했고(유령 SHA 없음), 백엔드 기록이 델타 마지막 12개 커밋을, 데이터베이스 기록이 `V20260828_001~003`을 누락하고 있었습니다._

_REPO-01 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-17 업무 판단 반영 배치 6 기록을, REPO-02·REPO-03은 같은 날 DDL 불필요 잔여과제 배치 2 기록을 참조합니다._

_2026-08-17 루트 추적 정리: `.agents/`(로컬 에이전트 하네스 설정 4건)·`TaskNotes/`(개인 Obsidian 볼트 12건)·`.review-cache/`(일회성 리뷰 탐지 캐시 9건)·`.superpowers/`(브레인스토밍 런타임 pid·상태 2건)를 `git rm --cached`로 추적 해제하고 `.gitignore`에 등록했습니다. `.superpowers/`는 규칙이 이미 있었는데 추적이 먼저라 무력화된 경우였습니다. 파일은 모두 워킹트리에 남아 있어 로컬 동작에는 영향이 없습니다. `.agents/`의 FP 자료는 손실이 없습니다 — `workflows/Detailed_FP_Estimation_Workflow.md`(105줄)는 추적 중인 `FP/FP.md`(166줄, CSV 산출·생성기 연동 규칙 추가)의 옛 판본이고, `skills/fp/SKILL.md`의 복잡도 매트릭스·점수표도 `FP/FP.md`에 동일하게 있습니다. 나머지 두 스킬(`hookify-rules`, `plankton-code-quality`)은 Codex용 커뮤니티 도구 참조라 이 프로젝트와 무관합니다._
