# ✅ IT Portal 완료·종료 내역 (Archive)

> 🗓️ **기준일:** 2026-07-06
> 🎯 **목적:** [`TASK.md`](TASK.md)에서 분리한 완료(✅)·해소(✔️)·감내(☑️) 항목을 보관합니다.

### 🔑 범례 (Legend)

| 상태 | 의미 |
| :--: | --- |
| ✅ Done | 완료 |
| ✔️ Resolved | 해소(거짓양성 등) |
| ☑️ Accepted | 감내(업스트림 미해결) |

---

## 🗂️ 진행 중에서 종료된 항목 (영역별)

### 🧩 2026-07-02 협의회 후속 정비 + 작성자 소속 컬럼

> `TASK.md`에서 종료 이관. 협의회 관리 액션 서버 권한·컬럼 드리프트·생략판정 필터 3건은 `REVIEW.md` 델타 정비 중 라이브 스키마/코드 대조로 완료 확인. 작성자 소속 컬럼(AuthorOrg)은 신규 구현·테스트 완료. 코드 커밋은 중첩 repo(`it_backend` main `20fcafb`·`769130a`·`9432023`, `it_database` main `6feb16e`).

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 협의회 개최준비 전이의 서버 권한·심의유형 범위 검증 추가 — ITPAD001 전체 심의유형, ITPAD002 `dbrTc='04'`만 허용을 서비스 최종 경계로 적용 | `CouncilService.verifyCouncilManager(asctId, userDetails)` 신설(admin∪정보보호관리자+dbrTc04) + `CouncilController` 관리 액션 12개(start/complete/start-preparation/schedule confirm·confirm-written/result save·update·confirm·approval/notify)에 principal 가드 부착, skip·approval콜백은 `verifyAdmin` 전용. 커밋 `9432023`, 종료일: 2026-07-02 |
| ✅ Done | 🟠 High | [버그] 협의회 `CouncilRepository` BPROJM 컬럼 드리프트 2건 (`task_11b75a35`) — 라이브 스키마 대조로 `p.BBR_C`는 `p.SVN_DPM_C`(존재)로 정합, `IT_PTL_STS_TC`는 BPROJM이 아닌 `ps.`(TPRMPP_BPROJA 서브쿼리) 대상이며 BPROJA에 컬럼 존재 확인 → `ORA-00904` 미발생. 협의회 리팩토링 과정에서 해소됨 | `CouncilRepository.findByDepartment`/`findProjectsForCouncilAll`/`findProjectsForCouncilByDepartment`, 라이브 `all_tab_columns`(ITPOWN.TPRMPP_BPROJM: `SVN_DPM_C`/`IT_PTL_RPR_STS_TC`, TPRMPP_BPROJA: `IT_PTL_STS_TC`), 검증일: 2026-07-02 |
| ✅ Done | 🟢 Low | 생략 판정 요청 목록의 삭제여부 필터를 DB 쿼리로 이동 — `getActiveSkipRequests()`가 `findByDelYn("N")`로 DB 필터 적용(기존 `findAll()` 후 JVM 필터 제거) | `CouncilSkipService.getActiveSkipRequests()`, `BaskpmRepository.findByDelYn`, 커밋 `769130a`, 종료일: 2026-07-02 |
| ✅ Done | 🟡 Medium | 작성자 소속 컬럼(AuthorOrg) 신규 구현 — `AuthorOrg`(record)/`AuthorOrgResolver`(사번→CuserI 조회로 주관부서·주관팀·인사상위조직 스냅샷) 추가, BPROJM `SVN_TEM_C`·BCOSTM `PRLM_HRK_OGZ_C_CONE`·BRDOCM `SVN_DPM_C`/`SVN_TEM_C`(+ `*L` 미러)를 신규 생성 시 작성자 기준으로 채움. `V20260701_002`는 2026-07-06 로컬 DDL 확인 기준으로 dev/prod 적용 완료 판정 | `common/iam/service/AuthorOrg*`, `ProjectService`/`CostService`/`ServiceRequestDocService`, `it_database/migrations/V20260701_002`, 커밋 `20fcafb`/`6feb16e`, 종료일: 2026-07-02 |

### 🗄️ 2026-07-06 DB/JPA dev/prod 적용 확인

- ✅ P4 후보 인덱스 `V20260629_002~005` 적용 확인
  - 근거: `it_database/ITPOWN_DDL_live.sql`
  - 확인 인덱스: `IX_BASCTM_PRJ_DEL`, `IX_BCMMTM_ENO_DEL_ASCT`, `IX_BRDOCM_DEL_DOC_VRS_FED`, `IX_BRIVGM_DOC_VRS_DEL_FED`
- ✅ 작성자 소속 컬럼 `V20260701_002` 적용 확인
  - 근거: `it_database/ITPOWN_DDL_live.sql`
  - 확인 컬럼: `BPROJM/BPROJL.SVN_TEM_C`, `BCOSTM/BCOSTL.PRLM_HRK_OGZ_C_CONE`, `BRDOCM/BRDOCL.SVN_DPM_C/SVN_TEM_C`
- 판정 기준: 로컬 DDL(`C:\it\it_database\ITPOWN_DDL_live.sql`)에 적용 완료가 확인되면 dev/prod도 적용 완료로 간주한다.

### ✅ 2026-07-07 TASK 잔여 조치(Subagent-Driven)

> `TASK.md`의 에러 처리, DB/JPA, 프론트/백엔드 리팩토링 잔여 중 구현 가능한 항목을 Subagent-Driven 방식으로 조치하고 이관. DB 컬럼은 사용자 결정에 따라 `API_TOK_HASH_CONE`이 아니라 `ECY_RNW_PUB_TOK_CONE`(암호화갱신발행토큰내용, `VARCHAR2(900)`)로 반영.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | Refresh Token 원문 조회 대신 암호화갱신발행토큰내용 기반 조회·UNIQUE 인덱스 정합화 | `it_backend` `f9912d7`, `1c48abc`; `it_database` `f02d3b9`. `Crtokm.ECY_RNW_PUB_TOK_CONE`, `RefreshTokenRepository.findByEcyRnwPubTokCone`, 기존 원문 fallback/backfill 테스트 완료 |
| ✅ Done | 🟡 Medium | Tiptap metadata 캐시 null 부서 키 격리 | `it_backend` `f9912d7`, `1c48abc`. `metadataCacheKey`: `ANONYMOUS`/`ALL`/`DEPT:<bbrC>`/`USER_NO_DEPT:<username>` 테스트 완료 |
| ✅ Done | 🟠 High | 예산 작업 DUP 기준코드 조회 실패 시 계산·저장 차단 | `it_frontend` `88d0565`. `work.vue` loaded/error 상태와 toast, 저장·계산 guard 반영 |
| ✅ Done | 🟠 High | HWPX 이미지 변환 실패 부분 성공 결과·누락 목록 노출 | `it_frontend` `88d0565`. `convertHtmlImagesForHwpx()`가 `{ images, failures }` 반환, export warning 및 단위 테스트 반영 |
| ✅ Done | 🟡 Medium | 감사로그 리플렉션 필드 접근·설정 실패 진단 보강 | `it_backend` `f9f24a5`, `6854fbe`. `targetClass`/`fieldName` warn 경로와 회귀 테스트 반영 |
| ✅ Done | 🟡 Medium | 정보기술부문 예산 조회/비교 화면 Mock 제거와 API wiring | `it_frontend` `a8ce04d`, `7e1d4f3`; `it_backend` `6854fbe`. summary/comparison API 연결, FSS mapping 응답 DTO·화면 렌더링 반영 |
| ✅ Done | 🟡 Medium | `useProjects`/`useTabs` 타입 정리와 파일 크기 표시 일부 공통화 | `it_frontend` `a8ce04d`. 프로젝트 mutation payload 타입, 최소 라우트 입력 타입, 문서 form/detail·`AttachmentNodeView` `formatFileSize` 공통 유틸 사용 |
| ✅ Done | 🟡 Medium | 파일 다건 업로드 부분 성공 트랜잭션 계약 정리 | `it_backend` `d25dc87`. `FileUploadUnitService` `REQUIRES_NEW`, `uploadFiles` per-file success/fail 응답, 두 번째 DB 저장 실패 회귀 테스트 반영 |
| ✅ Done | 🟡 Medium | 감사로그 리스너·EstimateRepository 로컬 Oracle 통합 테스트 보강 | `it_backend` `d25dc87`. `AuditLogPersisterIntegrationTest`, `EstimateRepositoryIntegrationTest` 추가 |

검증:
- Backend focused: `./gradlew --no-daemon test --tests AuthServiceTest --tests TiptapVariableServiceTest --tests ItBudgetServiceTest --tests ItBudgetControllerTest --tests AuditLogPersisterTest --tests FileServiceTest --warning-mode all` 성공.
- Backend integration: `./gradlew --no-daemon integrationTest --tests EstimateRepositoryIntegrationTest --tests AuditLogPersisterIntegrationTest --warning-mode all` 성공.
- Frontend focused: `npm test -- tests/unit/utils/hwpx-images.test.ts tests/unit/composables/useTabs.test.ts tests/unit/utils/common.test.ts` 성공(182 tests).
- Backend full: `./gradlew --no-daemon cleanTest test --warning-mode all` 성공. Frontend `npm run typecheck`는 기존 테스트 fixture 타입 오류(`tests/e2e/generate-report.ts`, 다수 unit test fixture)로 실패하며 이번 변경 파일 진단은 확인되지 않음.
### 🗄️ 2026-06-30 DB/JPA 최적화 (P0~P5)

> `TASK.md` 🗄️ DB/JPA § 12건 전체 조치 완료 이관. 페이즈별 서브에이전트 구현 + 2단계 리뷰(스펙·품질) + 폴리시. 코드 커밋은 중첩 repo(`it_backend` main `0e247a5`, `it_database` main `37fd523`). design: `docs/superpowers/specs/2026-06-29-db-jpa-optimization-design.md`, plans: `docs/superpowers/plans/2026-06-29-db-jpa-p0~p5-*.md`. 검증: 로컬 Oracle `@DataJpaTest`(`@Tag("it")`) 하네스 신설(P0).

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | [P0] 로컬 Oracle 기반 `@DataJpaTest` 통합 테스트 인프라 신설 — `AbstractOracleRepositoryTest`+`OracleAvailableCondition`(DB 미가동 자동 스킵), `application-test-it.properties`(ddl-auto=none), `integrationTest` Gradle 태스크(`@Tag("it")` 로컬 전용) | `it_backend` `support/*`, `build.gradle`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `BudgetWorkService.applyItemRates()` 전체 BBUGTM 메모리 로드+루프 Soft Delete → `@Modifying` 벌크 UPDATE(감사컬럼 수동 세팅, AuditorAware) | `BbugtmRepository.softDeleteByBseYy`, `BudgetWorkService`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `FeasibilityService.replacePerformances()` JPQL DELETE 직후 `flush()` 명시(순서 보장) | `FeasibilityService`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `EvaluationService`·`CommitteeService` 사용자명 N+1 — **기구현 확인**(`findByEnoIn`), 회귀 테스트로 고정(배치 1회·per-row 0회) | `EvaluationServiceTest`/`CommitteeServiceTest`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `CouncilService` per-evaluator count 반복 → JPQL GROUP BY 배치(`countByEnoForCouncil`)로 N+1 제거 + DB 검증 IT | `EvaluationRepository`, `CouncilService.completeCouncil`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `findProjectsForCouncilAll/ByDepartment`(18컬럼) native `Object[]` → `CouncilProjectRow.fromRow` 단일 팩토리 봉인(§5.5.4 `NativeRowMapper`), `CouncilService` 직접 캐스트 제거 | `CouncilProjectRow`, `NativeRowMapper`, `CouncilRepository`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | 나머지 Native `Object[]` 반환(`Council`/`Application`/`ServiceRequestDoc`/`LoginHistory`/`Evaluation`) → DTO `fromRow` 봉인 + 동등성 IT | `*Row` DTO 5종, 각 Repository default 래퍼, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `ProjectRepositoryImpl`/`CostRepositoryImpl` `selectFrom` 전체 컬럼 → 목록용 경량 QueryDSL `Projections.constructor`(대용량 텍스트 제외), 상세 경로 불변 | `ProjectRepositoryImpl.searchListByCondition`, `CostRepositoryImpl.searchListByCondition`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | 협의회 `BASCTM`/`BCMMTM` 역방향 인덱스 — `V20260629_002`(EXPLAIN: BASCTM Full Scan 제거). 최초 dev/prod 적용은 DBA 위임으로 추적했으나 2026-07-06 로컬 DDL 확인 기준으로 적용 완료 판정 | `it_database/migrations/V20260629_002`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `BRDOCM.findLatestVersionsAll()` 복합 인덱스 — `V20260629_003`(상관 MAX 서브쿼리 cost 9→7; 외부 ORDER BY SORT는 미제거 명시). 최초 dev/prod 적용은 DBA 위임으로 추적했으나 2026-07-06 로컬 DDL 확인 기준으로 적용 완료 판정 | `it_database/migrations/V20260629_003`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `BRIVGM` 검토의견 목록 인덱스 — `V20260629_004`(EXPLAIN: SORT ORDER BY 제거, cost 3→2). 최초 dev/prod 적용은 DBA 위임으로 추적했으나 2026-07-06 로컬 DDL 확인 기준으로 적용 완료 판정 | `it_database/migrations/V20260629_004`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | 실시간 로그 피드 `V_ITPAPP_LOG_FEED` 실행계획 검증 — 뷰가 20개 *L UNION ALL이라 단일 커버 인덱스 불가; 누락된 `TPRMPP_CCODEL(CHG_DTM)`만 `V20260629_005` 보완(집계 24→22). 피드 스냅샷 경로는 인덱스 효과 없음(☑️ 감내). 2026-07-06 로컬 DDL 확인 기준으로 적용 완료 판정 | `it_database/migrations/V20260629_005`, EXPLAIN 노트 `docs/superpowers/notes/2026-06-29-p4-explain-results.md`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | [T13] 캐시 TTL 미적용 보완 — `ConcurrentMapCacheManager`→`CaffeineCacheManager`(per-cache TTL: codes*/menuAuthMap 1h, tiptapMetadata 10m, unread 60s), `TransactionAwareCacheManagerProxy`로 evict 커밋 후 지연, `ProjectService` 쓰기경로 `tiptapMetadata` `@CacheEvict` 추가. 캐시명 6종·기존 evict 의미 보존 | `CacheConfig`, `ProjectService`, `spring-boot-starter-cache`, 종료일: 2026-06-30 |

### 🔒 2026-06-29 보안하드닝 정비

> 보안 하드닝 착수 정비. `TASK.md`에서 종료 이관한 항목. plan: `docs/superpowers/plans/2026-06-29-security-hardening.md`, design: `docs/superpowers/specs/2026-06-29-security-hardening-design.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | 클래스 JavaDoc 누락 컨트롤러 소수 잔여 (전수 86% 완료) — `AdminMenuController`/`AdminRouteController`/`MenuQueryController` 클래스 JavaDoc 보강 완료로 종료 | W2b PR-2 `30dc249`, 종료일: 2026-06-29 |

### 🔒 2026-06-29 보안 하드닝 구현

> `TASK.md` 🔒 보안 § 잔여 6건 구현 완료 이관(#1·#2·#3·#5·#6·#7). 코드 커밋은 중첩 `it_backend`/`it_frontend`/`it_database` repo. #4 Blocklist는 감내(☑️ Accepted)로 보안 §에 유지. plan: `docs/superpowers/plans/2026-06-29-security-hardening.md`, design: `docs/superpowers/specs/2026-06-29-security-hardening-design.md`. 보안 § 잔여 = Blocklist(감내) 외 0건.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 결정 + CLAUDE.md 명시 — `app.auth.allow-bearer-header` 플래그로 게이팅(base/prod=false, dev/local=true), 헤더 폴백 비활성 시 쿠키 전용 | `JwtAuthenticationFilter`, `it_backend/CLAUDE.md §5.6`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `it-portal-user` 쿠키 변조 시 프론트 관리자 가드 E2E 검증 — 백엔드 경계 테스트 `AdminSecurityBoundaryTest`가 `/api/admin/**`은 JWT 필수(`it-portal-user` 무시)→401 입증, 프론트 E2E 스펙 `access-control.spec.ts` 추가(로컬 실행) | `AdminSecurityBoundaryTest`, `tests/e2e/access-control.spec.ts`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | SSO 운영 설정 검증 강화 — `EnvironmentValidator`가 prod에서 `allow-direct-eno`/`frontend-url`/cors 이미 차단, `app.dev.user-switch.enabled=true` prod 가드 추가. `getClientIp`는 이미 `ClientIpResolver`(trusted-proxy) 적용. CLAUDE.md §5.6 정정 | `EnvironmentValidator`, `ClientIpResolver`, `it_backend/CLAUDE.md §5.6`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | [후속/T10] Refresh Token 재사용 탐지(토큰 패밀리/세대) — `TPRMPP_CRTOKM`에 `FAM_NM`/`AVL_YN` 추가(Flyway `V20260629_001`), `AuthService` 패밀리 회전 + 재사용 탐지(회전 grace 윈도우로 다중탭 오탐 방지) | `TPRMPP_CRTOKM`(`V20260629_001`), `AuthService`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | Tiptap 변수 metadata 프로젝트 카탈로그 권한 필터링 — `getMetadata(user)` 부서(bbrC) 필터(ADMIN/부서매니저 전체), 캐시 키 사용자 부서 기준 분리 | `TiptapVariableController.java`, `TiptapVariableService.java`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | 사업집행 4단계 `changeStatus` role 분기(구 [W3 카브아웃]) — ADMIN 전용 전이로 구현(`OwnershipVerifier.verifyAdmin`, 4개 서비스 적용), CLAUDE.md §5.18 갱신 | `EstimateService`/`DeliberationService`/`ContractService`/`PaymentService`, `OwnershipVerifier.verifyAdmin`, `it_backend/CLAUDE.md §5.18`, 종료일: 2026-06-29 |

### 🔒 보안

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🔴 Critical | 베이스/운영 `application.properties` 비밀값 기본값(`DB_PASSWORD`, `JWT_SECRET`) 제거 — 빈값이면 `EnvironmentValidator`가 기동 차단. local/dev 프로파일의 개발 기본값은 운영 배포 체크리스트에서 별도 확인 | `application.properties`, `application-prod.properties` 검증일: 2026-06-21 |
| ✅ Done | 🟠 High | `FileController`·`GeminiController` 등 `@PreAuthorize` 미적용 컨트롤러에 소유권 검증 또는 권한 어노테이션 추가                                                         | `FileOwnershipChecker` 적용, `GeminiController` ADMIN 전용                                |
| ✅ Done | 🟠 High | 로그인 Brute-force 보호 — 연속 실패 횟수 임계값(예: 5회/10분) + 계정 잠금 또는 지연 응답 적용                                                                              | `LoginAttemptService` 구현, `AuthService.login()` 연동                                    |
| ✅ Done | 🟠 High | 파일 업로드 확장자 화이트리스트 검증 추가 (`FileService.uploadFileInternal()`)                                                                                  | `FileValidator` 구현, `FileService` 연동                                                  |

#### 🔐 2026-06-23 소유권/권한 검증 하드닝 (`feature/ownership-authorization-hardening`)

> 공통 유틸 `OwnershipVerifier.verifyOwnerOrAdmin(ownerEno, user)`(`common/system/security`, 실패 시 `AccessDeniedException`→403) 표준 도입 후 쓰기·읽기 경로에 일괄 적용. 전체 백엔드 테스트 스위트 통과(`./gradlew clean test` BUILD SUCCESSFUL).

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `FileController` 다운로드/미리보기/단건조회/목록조회에 파일 읽기 권한 검증 적용 | `FileOwnershipChecker.checkReadAccess()`/`canRead()` 적용, 완료일: 2026-06-23 |
| ✅ Done | 🟠 High | `FileController.updateFileMeta()`와 `deleteFilesByOrc()`에 소유권/관리자 권한 검증 추가 | updateFileMeta→소유권 검증, deleteFilesByOrc→owner-or-admin(403), 완료일: 2026-06-23 |
| ✅ Done | 🟠 High | 요구사항 정의서 생성/수정/삭제/새 버전 생성 API 소유권 검증 추가 | `ServiceRequestDocService` update/createNewVersion/delete에 `OwnershipVerifier` 적용, 컨트롤러 `@AuthenticationPrincipal` 전달, 완료일: 2026-06-23 |
| ✅ Done | 🟠 High | 사업집행 4단계 서비스 쓰기 메서드(update/delete/changeStatus/save*) 소유자/관리자 검증 추가 | `EstimateService`/`DeliberationService`/`ContractService`/`PaymentService`에 `OwnershipVerifier.verifyOwnerOrAdmin` 적용, 완료일: 2026-06-23 |
| ✅ Done | 🟡 Medium | `GET /api/documents/dashboard`·`/badge-count` — 클라이언트 제공 `bbrC` 신뢰 제거, 서버측 검증 | 관리자=요청값, 비관리자=JWT 클레임 `bbrC` 서버측 강제, 완료일: 2026-06-23 |
| ✅ Done | 🟡 Medium | 소유권 검증 403 표준화 — `BoardPostService`/`BoardCommentService` 본인 게시물·댓글 수정/삭제 실패 400→403 | `OwnershipVerifier.verifyOwnerOrAdmin()`(`AccessDeniedException`)로 통일, 완료일: 2026-06-23 |
| ✅ Done | 🟢 Low | `it_backend/CLAUDE.md §5.18` 보안 규칙에 `OwnershipVerifier`를 소유권 검증 표준 수단으로 명시 | §5.18 보안 규칙 블록 갱신, 완료일: 2026-06-23 |

### ⚠️ 에러 처리 (백엔드 Critical+High, `feature/error-handling-backend`)

> `TASK.md` "에러 처리" 백엔드 3건 해소. 전체 백엔드 테스트 스위트 `./gradlew test` BUILD SUCCESSFUL, 프론트 `npm run typecheck` 통과. 설계/계획: `docs/superpowers/specs/2026-06-23-backend-error-handling-design.md`, `docs/superpowers/plans/2026-06-23-backend-error-handling.md`. (프론트 에러 처리 sweep 12건은 `TASK.md`에 잔존)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🔴 Critical | `ApplicationService.getApplicationsByIds()`·`ProjectService.getProjectsByIds()`·`CostService.getCostsByIds()` — `null` 반환 + `Objects::nonNull` 필터 제거, 부분 성공 래퍼 `*Dto.BulkResponse{items, failedIds}` 반환 + 실패 ID `log.warn`. 컨트롤러 3곳·프론트 `useProjects`/`useCost` 언랩(failedIds 시 toast 경고)까지 반영 | `BulkResponse` 도입, 완료일: 2026-06-24 |
| ✅ Done | 🟠 High | `NotificationEventListener.onApprovalCompleted()`·`onApprovalRecalled()` — AFTER_COMMIT 핸들러에 `@Transactional(REQUIRES_NEW)` 추가(§5.16, `NotificationService.send()`와 동일 근거) | `NotificationEventListener.java`, 완료일: 2026-06-24 |
| ✅ Done | 🟠 High | `ChangeLogEntityListener.persistLog()` 감사로그 실패 로그 `log.warn`→`log.error` 승격(모니터링 알람 노출) + 운영 알람 확장점 주석 | `ChangeLogEntityListener.java`, 완료일: 2026-06-24 |

### 📦 의존성 취약점 (Snyk, 업스트림 미해결)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✔️ Resolved | 🟠 High | `io.jsonwebtoken:jjwt-jackson@0.13.0` 전이 `jackson-core@2.12.7` Snyk 거짓 양성 — `build.gradle` resolutionStrategy에서 `jackson-core`/`jackson-databind`를 `2.21.2`로 강제. 실제 runtimeClasspath 해소 버전도 `2.21.2` 확인 (2026-05-27) | `build.gradle` jackson 2.x strict force, `./gradlew dependencyInsight` 검증 |
| ☑️ Accepted | 🟠 High | `org.springdoc:springdoc-openapi-starter-webmvc-ui@3.0.3` — 14건 전이 취약점 업스트림 패치 없음. Spring Boot 4.x 호환 최신 3.0.3 사용 중. 차기 springdoc 릴리스 모니터링 필요 | Snyk Priority 542, "Fixable issues 0" (jackson-core, spring-boot-autoconfigure 전이) |
| ☑️ Accepted | 🟡 Medium | `com.querydsl:querydsl-jpa@5.1.0` — SQL Injection(CWE-89, CVSS 6.9) 업스트림 패치 없음. 프로젝트 내 사용은 정적 Q클래스 + `BooleanBuilder` 기반으로 사용자 입력 문자열 직접 SQL 결합 경로 없음. 신규 QueryDSL 사용 시 `Expressions.template()` 등 raw 표현식 회피 | Snyk SNYK-JAVA-COMQUERYDSL-8400287, "Fixable issues 0" |

### 🤝 사전협의

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 프로젝트별 검토자 목록 서버 API 조회로 전환 + `defaultReviewers` 하드코딩 제거 | `ReviewerController` + `ReviewerService` TDD 구현, `stores/review.ts` API 연동 |

### ⚠️ 에러 처리 (주석 FIXME 등록 완료 — 코드 수정 후속)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `SsoController.complete()` catch 블록에 `log.error()` 추가                                                                                                                                               | SSO 인증 실패 원인 추적 불가 — FIXME 주석 존재                                                 |
| ✅ Done | 🟠 High | `FileService.java:318,325` IOException → `CustomGeneralException(msg, e)` — cause 전달                                                                                                                | 스택 트레이스 손실 — FIXME 주석 존재                                                         |
| ✅ Done | 🟠 High | `ApplicationService.updateApprovalLineInDetail()` private `@Transactional` 제거·`ApprovalLineDelegate` 위임 메서드 추출                                                                                      | Spring AOP 무효 — FIXME 주석 존재                                                      |
| ✅ Done | 🟠 High | `ApplicationService.java:207` 결재선 업데이트 실패 처리 방침 결정 (`warn`만 vs 예외 재발생)                                                                                                                              | @Transactional 컨텍스트에서 롤백 없이 커밋됨                                                  |
| ✅ Done | 🟠 High | `NotificationService.send()` — `recipientEno` null/blank 가드 구현 완료 (`null \|\| isBlank()` 조건 후 warn 로그 + return null) | `NotificationService.java:48-50`, 검증일: 2026-06-01 |
| ✅ Done | 🟡 Medium | `budget/approval.vue:458-460` PDF 생성 실패 시 `alert()` 사용 — PrimeVue `toast.error`로 교체 완료 | `pages/budget/approval.vue:458-459`, 검증일: 2026-06-21 |
| ✅ Done | 🟡 Medium | 프론트엔드 `alert()` → PrimeVue `toast` 교체: `approval/list.vue:204` | `pages/approval/list.vue:213-221` toast 처리 확인, 검증일: 2026-06-05 |
| ✅ Done | 🟠 High | `approval/list.vue:213-214` — 결재 처리 실패 시 `console.error`만 출력, `toast.error` 사용자 알림 없음 (CLAUDE.md 4.2.1 위반) | `pages/approval/list.vue:213-221` toast 처리 확인, 검증일: 2026-06-05 |
| ✅ Done | 🟠 High | `budget/report.vue:170-172,249-251` — PDF 생성/데이터 로드 실패 toast 및 버튼 비활성화 처리 완료 | `pages/budget/report.vue:176-184,263-270,284`, 검증일: 2026-06-21 |
| ✅ Done | 🟠 High | `info/projects/report.vue:164-166,199-201` — PDF 생성/프로젝트 로드 실패 toast 및 실패 상태 UI 처리 완료 | `pages/info/projects/report.vue:168-176,208-215,325`, 검증일: 2026-06-21 |

#### 2026-06-24 프론트엔드 에러 처리 sweep (TASK.md에서 이관, 2026-06-27)

> `TASK.md` "에러 처리" 섹션의 프론트 toast/silent-failure 26건(✅ Done 16 + ✔️ Resolved 10) 일괄 이관. 조치/확인일 2026-06-24.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] 프론트 toast 누락 다발 — 구체 사이트(`useCostListPage` 코드로드/검색, `projects/form.vue`, `terminal/[id].vue`, `ResourceTableSection` 등) 개별 항목으로 분해·조치 완료. 잔여 silent 경로는 아래 개별 행 참조 | 본 섹션 개별 행으로 분해, 조치일: 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] 사전협의 자동 저장 실패 사용자 알림 및 재시도 정책 보강 — `console.warn`과 경고 toast 적용 확인 | `pages/info/documents/[id]/review.vue:180`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟡 Medium | [확인 2026-06-24] 사전협의 버전/코멘트/검토자 — `stores/review.ts`가 실패 시 `loadWarnings` 리스트로 호출자에 전달(toast 표시)하도록 기조치 확인 | `stores/review.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] 전산업무비 일괄 업로드 실패 행/원인 상세화 — 행별 catch가 `err.data?.message` 추출해 `failedReasons` 수집, 집계 toast detail에 실패 사유 요약(최대 5건 + 외 N건) 노출 | `useCostListPage.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] HWPX 내보내기 이미지 fetch 실패 시 `src` 포함 `console.warn` 진단 로그 추가(외부 export catch는 toast 유지) | `useHwpxExport.ts`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `useTiptapImageInsertion.ts` blob URL 해제 — 성공/실패 경로 모두 `URL.revokeObjectURL()` 보장 확인(기조치) | `useTiptapImageInsertion.ts` 현행 코드 확인, 2026-06-24 |
| ✔️ Resolved | 🟡 Medium | [확인 2026-06-24] `usePdfReport.ts` 한글 폰트 로드 실패 시 `console.error` + 경고 toast('일부 글자가 깨질 수 있습니다') 후 Roboto 폴백 기조치 확인 | `usePdfReport.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] HWPX/Tiptap 실패 경로 보강 — `ExcalidrawNodeView` SVG 재생성 실패 `loadError` 표시, `useTiptapTableTools.syncColumnWidths`·`useHwpxExport` warn 로그. `hwpx-images.ts`는 선택적 null 처리로 기조치 확인 | `ExcalidrawNodeView.vue`, `useHwpxExport.ts`, `useTiptapTableTools.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `useTiptapTableTools.syncColumnWidths` 빈 catch → `catch (e)` + `console.warn` 추가 | `useTiptapTableTools.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] 손상된 `it-portal-user` 쿠키/구버전 `localStorage.user` 파싱 실패 시 `console.warn` + 손상 데이터 정리(쿠키 만료, `user.value=null`) | `stores/auth.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `info/projects/form.vue` 편집 모드 데이터 로드 실패 시 toast 후 목록 리다이렉트 적용 확인 | `pages/info/projects/form.vue:712`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `approval/[apfMngNo].vue` 결재 상세 로드 실패 — `toast.error` + `/approval/list` 리다이렉트 적용 확인(기조치) | `pages/approval/[apfMngNo].vue` 현행 코드 확인, 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `board/[blbMngNo]/[nacMngNo]/index.vue` 삭제 실패 — `console.error` + `toast.error` 적용 확인(기조치) | `pages/board/[blbMngNo]/[nacMngNo]/index.vue` 현행 코드 확인, 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `EmployeeSearchDialog.vue` 조직도·부서원 목록 로드 실패 — 양쪽 경로 `toast.error` 적용 확인(기조치) | `components/common/EmployeeSearchDialog.vue` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `ExcalidrawWrapper.vue` 내보내기·초기화·장면 복원 실패 toast 적용 확인 | `components/ExcalidrawWrapper.vue:92`, `components/ExcalidrawWrapper.vue:160`, `components/ExcalidrawWrapper.vue:201`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `useEmployeeSearch.ts` 직원 검색 실패 — warn toast + 빈 목록 처리 적용 확인(기조치) | `composables/useEmployeeSearch.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟠 High | [완료 2026-06-24] `useGlobalSearch` 실패를 빈 결과와 구분 — `console.warn` + `searchError` ref 인라인 오류 상태, `GlobalSearchBar`가 "검색 중 오류" 표시(타입어헤드 노이즈 방지로 toast 미사용). 단위 테스트 추가 | `composables/useGlobalSearch.ts`, `components/GlobalSearchBar.vue`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `useCostListPage.ts` 공통코드 로드 실패 — `toast.error` 적용 확인(기조치) | `composables/useCostListPage.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `useCostListPage` 전년도 상세 조회 폴백 실패 `console.warn` 추가(요약 데이터 폴백 추적). 자동완성 빈 결과 폴백은 정상 UX로 유지 | `useCostListPage.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `ResourceTableSection.vue` 소요자원 코드 로드 실패 시 `useToast` 추가 + `toast.error` 알림 | `components/projects/ResourceTableSection.vue`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `terminal/[id].vue` 삭제 실패 시 `useToast` import + `toast.error`(백엔드 메시지 추출) 추가 | `pages/info/cost/terminal/[id].vue`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `info/cost/form.vue` 초기 데이터 로드 실패 — `toast.error` 적용 확인(기조치) | `pages/info/cost/form.vue` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `ResultReviewProgress.vue` 상태 전이 실패 `console.warn` 기록 추가 확인 (toast 억제 유지) | `components/council/result/ResultReviewProgress.vue:60`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `council-request/[id].vue` `saveTemp`/`saveComplete`/`submitApproval` 3개 catch를 `catch (e: unknown)` + `err.data?.message` 추출로 통일 | `pages/info/council-request/[id].vue`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `council-request/[id].vue` `councilStatus` `?? '01'`→`?? null`(fail-closed). `readonly = councilStatus !== '01'`로 로드 실패(null) 시 화면 잠금, 정상 DRAFT 편집 불변 | `pages/info/council-request/[id].vue`, 조치일: 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `CommitteeSelector.vue`(위원 저장·기본위원)·`ScheduleStatus.vue`(일정 확정) catch를 `catch (e: unknown)` + `err.data?.message` 추출로 통일 | `CommitteeSelector.vue`, `ScheduleStatus.vue`, 조치일: 2026-06-24 |

### 🗄️ DB / JPA 최적화

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `BudgetWorkService.getSummary()` — 비목 루프 내 `findApprovedCostsByPrefix`/`findApprovedItemsByPrefix` N+1 → 단일 집계 쿼리 통합 | `BudgetWorkQueryRepository` 개선 완료 |
| ✅ Done | 🟠 High | `CAPPLA` 테이블 복합 인덱스(`ORC_TB_CD, ORC_PK_VL, ORC_SNO_VL, APF_REL_SNO`) 존재 여부 DDL 확인 및 미비 시 추가 | `V20260510_001__add_cappla_composite_index.sql` |
| ✅ Done | 🟠 High | `BITEMM(PRJ_MNG_NO)` 단일 컬럼 인덱스 존재 여부 확인 및 미비 시 추가 | `V20260510_002__add_bitemm_prj_mng_no_index.sql` |
| ✅ Done | 🟠 High | `Bprojm.update()` 35+ 파라미터 → `BprojmUpdateCommand` 객체 도입으로 시그니처 단순화 | `Bprojm.java` 리팩토링 완료 |
| ✅ Done | 🔴 Critical | `TPRMPP_CINFMM` 테이블명 매핑 확인 — V20260520_001이 `TAAABB_CINFMM` 생성, V20260521_006(line 60)이 `TPRMPP_CINFMM`으로 RENAME. 마이그레이션 체인 정상 확인. 엔티티 `@Table` 매핑 유효 | 2026-05-22 직접 검증 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `AdminMenuService.create()`/`delete()` 트랜잭션 경계 재검증 — 클래스 레벨 `@Transactional` 적용 확인 | `AdminMenuService.java:24`, 탐지: 2026-06-22, 조치일: 2026-06-24 |

### 🎨 프론트엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 — 실제 컴포넌트가 `components/ApplicationViewerDialog.vue`로 이전됨       | auto-import 이름 충돌 위험 해소                 |
| ✅ Done | 🟠 High | `formatDateTime` 중복 구현 통합 — `utils/common.ts`, `pages/guide/index.vue`, `pages/info/documents/[id]/index.vue` 3개 상이한 구현 | `utils/common.ts` 단일 구현으로 통합             |
| ✅ Done | 🟠 High | `stores/review.ts` 검토자 조회 `$apiFetch('/api/...')` 상대 URL 제거 — `${config.public.apiBase}`를 붙여 Nuxt origin 오호출 방지 | `stores/review.ts`, 조치일: 2026-06-21 |
| ✅ Done | 🟠 High | `useCouncilCodes.ts` 코드명 필드 불일치 수정 — `statusMap`/`hearingMap`/`memberTypeMap` 모두 `c.cdvaNm` 매핑 사용, `CodeItem`에 `cNm`/`cdvaNm` 정의 확인 | 코드 확인 2026-06-12: `useCouncilCodes.ts:68,73,78` |

#### 2026-06-24 프론트엔드 리팩토링 일괄 처리 (Phase 0~4, spec/plan: `docs/superpowers/specs|plans/2026-06-24-frontend-refactoring*`)

| ✅ Done | 🟠 High | `result/[id].vue` `reviewProgressEnabled` `s >= '05'` 사전순 비교 버그 수정 — `app/utils/councilStatus.ts`의 `isReviewProgressEnabled`(허용 상태 Set.has) 순수 함수 추출 + 단위테스트. `'SKIPPED'` 오노출 차단 | 조치일: 2026-06-24, `84581e2`/`dd3d8e4` |
| ✅ Done | 🟢 Low | `AppSidebar.vue` 미사용 `_isGroupExpanded` 제거 | 조치일: 2026-06-24, `c7e0fd9` |
| ✅ Done | 🟢 Low | `contract/index.vue` 빈 `/* ── 상태 표시 ── */` 잔재 주석 제거 | 조치일: 2026-06-24, `b06c309` |
| ✅ Done | 🟡 Medium | `budget/list.vue` 탭 제거 후 dead code 정리 — 미사용 filter/pageSize/download/computed 다수 제거(참조 0건 검증) | 조치일: 2026-06-24, `7b9aebb` |
| ✅ Done | 🟢 Low | 사업집행 4개 composable `changeStatus` 중복 → `useDocumentStatusApi.ts`의 `createChangeStatus(apiFetch, baseUrl)` 팩토리로 통합(공개 시그니처 유지) + 단위테스트 | 조치일: 2026-06-24, `274b15d` |
| ✅ Done | 🟡 Medium | `useProjectOptions.ts` 단일 사용 확인 후 `projects/form.vue`에 인라인, composable·테스트 제거 | 조치일: 2026-06-24, `b4eaca1` |
| ✅ Done | 🟢 Low | 사업집행 3개 페이지 대상선택 상태 → `useProjectCostSelector.ts` 공통화(watch/hasTarget/selectedCncdRfrNo/resetSelection 동작 보존) | 조치일: 2026-06-24, `509dd0f` |
| ✅ Done | 🟡 Medium | 관리자 `사용여부` 옵션/태그 중복 → `useYnOptions.ts`(ynOptions/getYnLabel/getYnSeverity) 공통화, auth-grades·roles 적용 | 조치일: 2026-06-24, `4c28a26` |
| ✅ Done | 🟢 Low | `ResultForm.vue` emit/type 단순화 — 이미 목표 상태(emit 단일 union, `ResultData` 미import) 확인 | 검증일: 2026-06-24 (코드 변경 불요) |
| ✅ Done | 🟢 Low | `useTableColumnResize.ts` 숫자 파싱/배열 스타일 — 이미 `Number.parseInt`/`Array.from` 일관 적용 확인 | 검증일: 2026-06-24 (코드 변경 불요) |
| ✔️ Resolved | 🟢 Low | 위원유형 라벨 중복 — `CommitteeList.vue`/`CommitteeSelector.vue`는 이미 `getMemberTypeLabel` 사용. `ScheduleStatus.vue`는 좁은 `구분` 컬럼용 축약 라벨('당연'/'소집')을 의도적으로 유지(전체 라벨 '당연위원'과 다름, 동작 보존) | 검증일: 2026-06-24 (의도된 차이 수용) |
| ✅ Done | 🟡 Medium | `useDeptFilter` — 공통 composable 미도입 폐기 결정, `it_frontend/CLAUDE.md` §4.7.1.3 반영(YAGNI) | 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | `/admin/boards` 관리자 레이아웃 적용 — `definePageMeta`에 `layout: 'admin'` 추가 | 조치일: 2026-06-24, `be537ec` |
| ✅ Done | 🟢 Low | `ReviewVersionHistory.vue` 로컬 `formatDateTime`을 축약 전용 `formatVersionTimestamp`로 개명(공통 함수와 혼동 방지) | 조치일: 2026-06-24, `6494b6a` |
| ✅ Done | 🟡 Medium | `useNotifications` 모듈 싱글턴 상태(`unreadCount`/`items`/`loading`)를 `useState` SSR-safe로 전환(계약·공개 API 보존), CLAUDE.md §4.7.3 반영, 테스트 갱신 | 조치일: 2026-06-24, `3ab412b` |
| ✔️ Resolved | 🟢 Low | `useNotifications.refresh()` 호출부 toast — `NotificationBell`/`NotificationDropdown` 사용자 호출 경로 모두 try-catch+toast 보유 확인 | 검증일: 2026-06-24 (이미 충족) |
| ✅ Done | 🟡 Medium | Tiptap 표 도구 계약 문서화 — `useTiptapTableTools.ts` TSDoc 보강 + `docs/guides/tiptap-table-tools.md` 신규(syncTableWidths swallowed-catch/저장영향 명시) | 조치일: 2026-06-24, `0f773c8` |
| ✅ Done | 🟠 High | 협의회 평가 요약 템플릿 닫힘 구조 정리 | ESLint 단독 실행 2026-06-12: `EvalSummaryPanel.vue` 오류 0건 (847a947 개선 반영) |
| ✅ Done | 🟠 High | `utils/common.ts` 협의회 상태/심의유형 매핑 구 3자리 코드 잔재 수정 — `COUNCIL_STATUS_TAG_MAP` 키와 `getHearingTypeLabel` switch case를 2자리(`'01'`~`'13'`/`'01'`~`'05'`)로 교체. dead branch 해소(`getCouncilTagClass`/`getHearingTypeLabel` 정상 동작). `tests/unit/utils/common.test.ts` 해당 케이스 2자리로 갱신, 124 tests 통과 | `app/utils/common.ts:342-356,375-383`, 검증일: 2026-06-15 |
| ✅ Done | 🟠 High | [완료 2026-06-24] 프론트 build health 6항목 stale 정리 — lint 0 errors/2 warnings, typecheck 0 errors, RichEditor 컴포넌트/참조 부재 확인. ESLint 62/73 errors, typecheck 4건, 단일 template root, 전산업무비 prop, plan/[id] 타입, RichEditor 마이그레이션 모두 해소. cost 컴포넌트 type-only import 정리도 lint 0 errors로 동반 해소(7행째 이관) | 2026-06-24 build 검증 |

### 🟠 2026-06-27 High 잔여 조치 (Batch 1~3, `feature/task-high-remediation`)

> `TASK.md` 🟠 High 잔여 6건 조치. 설계/계획: `docs/superpowers/specs/2026-06-27-task-high-remediation-design.md`, `docs/superpowers/plans/2026-06-27-task-high-remediation.md`.
> 변경 영역 테스트 통과(`CostServiceTest` 40건, `BudgetWorkServiceTest` 전건). 전체 스위트 `./gradlew clean test`의 잔여 실패 8건(`FrontendUrlPropertyResolutionTest`·`ProjectServiceXcrLookupTest`·`CommitteeServiceTest`)은 베이스 커밋 `6a4b0f9`에서도 동일 재현되는 **기존 실패**로, 본 조치와 무관함을 워크트리 대조로 확인(2026-06-27).
> 최종 리뷰(2026-06-27, java/database reviewer)에서 알림 발송 진입 로그(`NotificationService.java:51`)의 수신자 사번 INFO 노출 추가 발견 → `973732b`로 강등. SSO 인증 흐름 INFO eno 노출은 별도 항목으로 `TASK.md` 등록.
> 인덱스 마이그레이션은 로컬 Oracle XE 호환을 위해 `ONLINE` 절을 생략(XE 미지원). dev/prod DBA 적용 시 대용량 테이블(CDECIM/CAPPLM) 락 최소화를 위해 `ONLINE` 옵션 적용을 권장.
> 커밋: it_backend `439023c`/`607092b`/`f988b35`/`af5135b`/`ba9f740`/`b8c8fc4`/`973732b`, it_database `a863dd2`, 루트 문서 `34fd26f`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 게시판 멘션·결재 알림 진단 로그 운영 노출 정리 — `BoardPostService` 멘션 진단 6건, `ApplicationService` 결재요청 알림 진단(결재자 사번), `NotificationService` 발송 진입(수신자 사번) INFO→DEBUG 강등 (PII 운영 로그 미노출) | `BoardPostService.java`(439023c), `ApplicationService.java`(607092b), `NotificationService.java`(973732b), 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | `BudgetWorkService.applyRates()` 원본 레코드별 개별 Upsert SELECT N+1 제거 — BCOSTM/BITEMM 테이블별 키맵 일괄 조회로 전환(동일런 dedup 동등성 보존) | `BudgetWorkService.java`(ba9f740/b8c8fc4), `BbugtmRepository.findByBseYyAndFntTbNmAndDelYn`, 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | `CostService.enrichCostListBatch()` 단말기 첨부 N+1 제거 — `tmnYn='Y'` 행 단말기를 IN 일괄 조회 후 그룹핑 | `CostService.java`(f988b35), `BtermmRepository.findByTermBgNoInAndDelYn`, 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | 전산업무비 삭제(`CostService.deleteCost`) 단말기 조회 N+1 제거 — 비용별 반복 조회를 IN 일괄 조회로 전환(`DEL_YN='N'`만 대상, 멱등) | `CostService.java`(f988b35/af5135b), 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | 결재 대기/대시보드 쿼리 인덱스 보강 — 실제 쿼리 술어 기준으로 `IX_CDECIM_PENDING(DCR_ENO, DCD_STS_C, APF_DCM_NO)`·`IX_CAPPLM_USER_STS(DCD_REQ_USID, APF_PRG_STS_C, DCD_REQ_DTM)` 추가(멱등 가드) | `V20260627_001__AddDashboardListIndexes.sql`(a863dd2), 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | 요구사항 정의서 대시보드 `BRDOCM`/`BRIVGM` 보조 인덱스 — `IX_BRDOCM_ENR_DEL(FST_ENR_USID, DEL_YN)`·`IX_BRIVGM_DOC_DEL_FSG(DOC_MNG_NO, DEL_YN, FSG_YN)` 추가(멱등 가드) | `V20260627_001__AddDashboardListIndexes.sql`(a863dd2), 조치일: 2026-06-27 |

### 🟠 2026-06-29 bbrC 부서 필터 적용 (보안 High W1, it_backend main 통합)

> `TASK.md` W1 보안 High. subagent-driven 실행(implementer→spec 리뷰→코드품질 리뷰). 설계/계획: `docs/superpowers/specs/2026-06-28-task-remediation-design.md` §6.1, `docs/superpowers/plans/2026-06-28-bbrc-dept-filter.md`.
> 커밋(it_backend main): `88e1419`/`8f0151e`/`f0c9f8b`(3 RepositoryImpl) + `2ff2399`(코드리뷰 반영) + `4ee3ebd`(§5.18 문서).
> 검증: `compileJava` BUILD SUCCESSFUL, 전체 `test`는 기존 실패 8건(`FrontendUrlPropertyResolutionTest`·`ProjectServiceXcrLookupTest`·`CommitteeServiceTest`)만 — 베이스 main에서 동일 재현 확인(본 변경 무파손).
> **런타임 검증 완료(2026-06-29, 로컬 Oracle 실데이터)**: 실행단계 문서가 DB에 0건이라 가상 과업심의 3행(부서150 사업·부서180 사업·부서180 전산업무비)을 실제 `TPRMPP_BPROJM`/`TPRMPP_BCOSTM`에 조인(read-only)해 필터 술어 검증 — 관리자(필터없음)=3행·부서 해석 정확, bbrC=150→1행, bbrC=180→2행(사업+전산업무비), bbrC=999→0행(타부서 격리). 대상 2종 분기·부서 격리 정상 확인. (서비스의 bbrC 도출 계층은 본 변경과 무관·기존 유지)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 사업집행 ②과업심의·③계약·④지급 목록 `bbrC` 부서 필터 적용 — 대상구분 100=`Bprojm.svnDpmC`/200=`Bcostm.costSvnDpmC`를 `cncdRfrNo` 키로 LEFT JOIN(최신 `lstYn='Y'`) 후 `Expressions.anyOf(allOf(...))` 분기 비교 + `.distinct()` 가드. `EstimateRepositoryImpl` 패턴을 2대상으로 확장. 일반 사용자 타부서 열람 차단 | `DeliberationRepositoryImpl`/`ContractRepositoryImpl`/`PaymentRepositoryImpl`, `it_backend/CLAUDE.md §5.18`, 통합일: 2026-06-29 |
| ✅ Done | 🟠 High | 과업심의 목록 부서(bbrC) 필터 미적용 — 위 작업으로 동일 해소(과업심의=Deliberation 목록 동일 RepositoryImpl) | 별도 항목이었으나 통합 해소 |

### 🧹 2026-06-29 영향도 낮은 백로그 묶음 처리 (W2+Low 13건, 4 PR)

> `TASK.md` 실행 로드맵 W2(코드부채) + Low 잔여 13건을 단독 수정 가능한 영향도 낮은 작업으로 묶어 4 PR로 처리. 설계/계획: `docs/superpowers/specs/2026-06-29-low-impact-task-bundling-design.md`, `docs/superpowers/plans/2026-06-29-low-impact-task-bundling.md`.
> 커밋: it_backend `b58558d..1da0e32`(4 PR), it_frontend `9035174`.
> W2에 함께 묶여 있던 2건(사업집행 4단계 `changeStatus` role 분기·품목 금액 환율 환산 규칙 통일)은 각각 업무요건 확정·단일 규칙 결정이 선행되어야 하므로 카브아웃하여 `TASK.md` W3로 재범위(Open 유지).

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | SSO 인증 흐름 INFO 로그 사번(eno) 평문 노출 → INFO→DEBUG 강등 (알림/게시판 PII 강등 2026-06-27 동일 정책) | `SsoController.java:321,373`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | mutating 컨트롤러 요청 본문 `@Valid` 누락 보강 — 협의회/게시판 POST·PUT DTO 검증 일관성 회복 + 핵심 필드 제약 | `CouncilController.java`, `BoardPostController.java`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `LoginAttemptService` 클래스 레벨 `@Transactional(readOnly=true)` 적용 (조회 전용 트랜잭션 경계 명시) | `LoginAttemptService.java`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `PlanService` 클래스 레벨 `@Transactional(readOnly=true)` 적용 — 쓰기 메서드는 `@Transactional` 오버라이드 | `PlanService.java:43`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `council-request/result/[id].vue` catch 바인딩 통일(`catch (e: unknown)` + `err.data?.message`) + 통보 성공·수신자 null 시 무피드백 보완 | `pages/info/council-request/result/[id].vue:273,299,314`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `ScheduleService` 위원 사용자명 조회 N+1 제거 — 위원별 `findByEno` 반복을 `findByEnoIn` 일괄 조회로 전환 | `ScheduleService.java:311`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `CouncilService.deriveCurrentYearBudget` 협의회 목록 N+1 제거 — 행별 `findByAbusMngNoAndDelYn` 호출을 품목 배치 prefetch로 전환 | `CouncilService`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `Deliberation/Contract/PaymentService.get()` 상세 조회 대상명 별도 SELECT 제거 — `loadCurrent()`+`resolveTargetName()` 2쿼리를 BPROJM/BCOSTM LEFT JOIN 단일 쿼리로 통합(`EstimateRepositoryImpl` 패턴) | `DeliberationService.java:148`, `ContractService.java:146`, `PaymentService.java:176`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `CinfmmRepositoryImpl.markAllReadByRmsEno()` 벌크 UPDATE 감사컬럼(`LST_CHG_DTM`/`LST_CHG_USID`) 명시 SET — JPA Auditing 우회/1차 캐시 stale 해소 | `CinfmmRepositoryImpl.java:67-78`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `BtermmL.IND_RSN` `@Column(length)` 600→200 — `TPRMPP_BTERML` DDL 정합(BcostmL 2026-06-22 정정과 동일) | `BtermmL.java`, `TPRMPP_BTERML`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `ApplicationContextHolder.publishEvent()` 미사용 메서드 + 구 `@TransactionalEventListener(BEFORE_COMMIT)` JavaDoc 제거 (`AuditLogEvent`는 2026-06-22 삭제됨) | `ApplicationContextHolder.java:38-53`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `CodeNameMapBuilder` → `common.util` 패키지 이동 — `CostService`/`ProjectService` 공유 유틸 위치 정리 | `CodeNameMapBuilder`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | EAI `HostAddressProvider` IP/MAC 조회 실패 진단 로깅 보강 — 원인 예외 없는 info만 남던 경로에 `log.warn`+예외 추가(전문 공통부 공백 추적성 확보) | `HostAddressProvider.java:34,57`, 조치일: 2026-06-29 |

### 🧹 2026-06-29 재검증 종료

> `TASK.md` 잔여 항목을 6개 병렬 에이전트로 코드 재대조한 결과, 이미 해소·정정 완료되었거나 코드 부재로 실행 불가한 7건을 종료 이관. 재범위/문구 정정 7건은 `TASK.md` 본문에 반영(Open 유지). plan: `docs/superpowers/plans/2026-06-29-task-recheck-improvement.md`, design: `docs/superpowers/specs/2026-06-29-task-recheck-improvement-design.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E 검증 — 회귀 테스트 존재 확인 | `plugins/auth.ts:113-115`, `tests/unit/plugins/auth.test.ts:136-146`, `tests/e2e/session.spec.ts:75-125`, 검증일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `AdminDto` 잔여 DTO JavaDoc 보강 — 전 중첩 DTO 문서화 완료 확인 | `AdminDto.java` 전 중첩 DTO 문서화 완료, 검증일: 2026-06-29 |
| ✅ Done | 🟡 Medium | 메타 `BPAYTM/BPAYTL.DFR_DT` NULL여부 N→Y 정정 — `table.csv` 이미 Y 등재 확인 | `table.csv` 이미 Y, 검증일: 2026-06-29 |
| ✅ Done | 🟡 Medium | 메타 `BPOVWM PRJ_BG_AMR→RQM_BG_AMT` — 메타 정정 완료. (운영 데이터 이관은 EXTERNAL로 `TASK.md` 메타 섹션에 1줄 유지) | 메타 정정 완료, 검증일: 2026-06-29 |
| ✔️ Resolved | 🟡 Medium | 실시간로그 `V20260531_001` 마이그레이션 적용 검증 — STALE: 해당 마이그레이션 미존재. `V_ITPAPP_LOG_FEED`는 비버전 로컬 DDL | `ITPOWN_DDL_live.sql:3609`(비버전 로컬 DDL), 검증일: 2026-06-29 |
| ✔️ Resolved | 🟡 Medium | `board/index.vue` + `AppSidebar.vue` 공통 권한 필터 추출 (inqAthC 중복) — 재검증 결과 코드 부재로 종료(실행불가): `inqAthC`가 프론트·백 코드에 부재(문서 prose만 존재) | `board/index.vue`/`AppSidebar.vue` `inqAthC` 코드 부재, 검증일: 2026-06-29 |
| ✔️ Resolved | 🟡 Medium | 게시판 권한 코드(`inqAthC`/`enrAthC`) `ROLE.ADMIN` 외 역할 매핑 통합테스트 — 재검증 결과 코드 부재로 종료(실행불가): `inqAthC`/`enrAthC`가 프론트·백 코드에 부재(문서 prose만 존재) | 권한 코드 `inqAthC`/`enrAthC` 코드 부재, 검증일: 2026-06-29 |

### 🔍 2026-06-28 코드 대조 검증 — stale Open 이관

> `TASK.md` 전체 ⬜ Open 항목을 6개 병렬 에이전트로 코드베이스 대조 검증(read-only) 후, 실제 이미 해소된 stale 3건만 이관. 대부분 항목은 정상 추적(STILL_OPEN) 재확인. spot-check로 에이전트 오판 2건 정정 — `ApplicationContextHolder.publishEvent()`는 구 이벤트 기반 감사로그 JavaDoc(38-53행)이 잔존해 Open 유지, `BRIVGM` 인덱스는 06-27 추가분(`IX_BRIVGM_DOC_DEL_FSG`)이 대시보드용 별개라 검토의견 목록 쿼리는 미커버로 Open 유지. 검증 기록·잔여 로드맵·보안 High 2건 상세 설계: `docs/superpowers/specs/2026-06-28-task-remediation-design.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `ProjectService.enrichProjectListBatch()` 사업별 비목 요약 N+1 제거 — BBUGTM을 사업 키 묶음으로 일괄 조회 | `ProjectService.java:715`(enrich)·`:678` `bbugtmRepository.sumDupBgByPrjMngNos()` 배치, `BbugtmRepositoryImpl.java:262` 집계, 검증일: 2026-06-28 |
| ✔️ Resolved | 🟢 Low | `applyAthIds()` 적용 대상 최소화 — prune된 트리에만 적용 + `MenuAuthMapProvider` 캐시(2026-06-22)로 권한Map 조회비용 해소 → 추가 최적화 실익 낮음, 현행 유지 | `MenuQueryService.java:47-49,61-68`, 검증일: 2026-06-28 |
| ✅ Done | 🟡 Medium | 메타 미등재 테이블 12종(사업집행 4단계 `BESTIM/BESTTM/BDELIM/BCONTM/BPAYMM/BPAYTM` + 각 `*L` 로그) 등재 — 컬럼명은 이미 표준 명칭 사용 | `meta/table.csv` 해당 12테이블 등재 확인, 검증일: 2026-06-28 |

### 🔎 2026-06-22 코드 대조 검증 완료 (백엔드)

> 백엔드 4개 섹션 ⬜ Open 항목을 라이브 IDE 진단 + 코드 광범위 대조로 검증, 완료 확정분.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `CodeController.createCcodem()`/`updateCcodem()` `@Valid` 추가 — Bean Validation이 컨트롤러 진입 시 동작하도록 일관성 확보                                        | `CodeController.java:68,81` — ✅ 검증 2026-06-22: CodeController.java:75,97 `@Valid @RequestBody` 적용 확인 |
| ✅ Done | 🟡 Medium | `FeasibilityService.replacePerformances()` 물리 DELETE 예외 정책 정리 — `Bperfm` 성과지표도 Soft Delete 원칙을 지키도록 PK 재삽입 문제를 해결하거나 운영 예외로 승인 | `FeasibilityService.java:223`, 발견일: 2026-06-01 — ✅ 검증 2026-06-22: FeasibilityService.java:170-173 하드딜리트 사유(복합PK+merge del_yn) JavaDoc 명문화 → 운영 예외 승인 |
| ✅ Done | 🟡 Medium | `ServiceRequestDocService.getDashboard()` 네이티브 쿼리 결과 직접 캐스트 안전 변환 적용 — Oracle JDBC/Hibernate 반환 타입 차이로 `ClassCastException` 가능. `RealtimeLogRepository`의 `toStr`/`Number` 변환 패턴 참고 | `ServiceRequestDocService.java:295,307`, 탐지: 2026-06-21 — ✅ 검증 2026-06-22: ServiceRequestDocService.java:294-311 toLdt() instanceof 분기 + try/catch 적용 |
| ✅ Done | 🟢 Low | `BestimL`/`BesttmL` 로그 엔티티가 `SEQ_BESTIL`/`SEQ_BESTTL` 시퀀스를 정확히 참조하는지 `AuditLogIdGenerator` 파생 로직과 대조 검증 (`V20260607_004`에서 `SEQ_BESTIDL→SEQ_BESTTL` rename) | `V20260607_004:15`, `V20260607_002:105-107`, 탐지: 2026-06-09 — ✅ 검증 2026-06-22: V20260607_004:14-15 rename + AuditLogIdGenerator:40 파생 정합 + @Table 매핑 확인 |
| ✅ Done | 🟡 Medium | `BprojmL` 변경로그 엔티티에 `cncdRfrNo`(`CNCD_RFR_NO`) 컬럼 누락 — 마스터 `Bprojm`은 보유(`Bprojm.java:203`)하나 미러 엔티티에 미정의. `AuditLogPersister`가 필드명 기준 복사하므로 관련프로젝트관리번호 변경이 감사로그에 미기록. `BprojmL`에 필드 추가 + `TPRMPP_BPROJL` ADD 마이그레이션 필요 | `BprojmL.java`, 탐지: 2026-06-14 — ✅ 검증 2026-06-22: BprojmL.java:34 필드 + V20260612_002:1009 TPRMPP_BPROJL ADD CNCD_RFR_NO |
| ✅ Done | 🟠 High | 알림 시스템 백엔드 단위·통합 테스트 추가 — `NotificationServiceTest`(Mockito), `MentionExtractorTest`(순수 단위), `CinfmmRepositoryImplTest`(Testcontainers/H2). 커버리지 대상: 빈 수신자 가드, REQUIRES_NEW 전파, markAllRead 행 수, 멘션 추출 엣지케이스 | `it_backend/src/test/` — notification 패키지 테스트 없음 — ✅ 검증 2026-06-22: NotificationServiceTest/MentionExtractorTest/NotificationEventListenerTest/NotificationControllerTest 존재(CinfmmRepositoryImplTest만 잔여) |
| ✅ Done | 🟠 High | Tiptap 변수 시스템 백엔드 단위 테스트 추가 — `TiptapTokenParserTest`(정규식·switch·IllegalArgumentException), `TiptapVariableServiceTest`(Mockito: MISSING/INVALID·금액 포맷·null 가드) | `it_backend/src/test/` — tiptap 패키지 테스트 없음 — ✅ 검증 2026-06-22: TiptapTokenParserTest/TiptapVariableServiceTest/TiptapVariableControllerTest 존재 |
| ✅ Done | 🟠 High | `QnaService.updateQna()` 관리자 수정 무력화(`ROLE_ITPAD001`) 교정 — `OwnershipVerifier.verifyOwnerOrAdmin()`로 교체, 비소유자 403 매핑 | — ✅ 구현 2026-06-22(feat/ownership-verifier-foundation): `OwnershipVerifier`(공통 유틸) 도입 + `GlobalExceptionHandler` AccessDeniedException→403 + `QnaService.java` 권한 검증 위임. Plan: docs/superpowers/plans/2026-06-22-ownership-verifier-foundation.md |

### ✅ 2026-06-22 백엔드 로드맵 Phase 2-5 실행 완료

> 백엔드 개선 로드맵 Phase 2~5를 브랜치 `backend-roadmap-phase2-5`에서 구현·코드리뷰 완료. (코드 커밋은 중첩 `it_backend` repo, 마이그레이션은 `it_database` repo)

#### Phase 2 — 에러 전파·입력 안정성

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 리소스 미존재 시 HTTP 404 반환을 위한 전용 `NotFoundException` 도입 + `GlobalExceptionHandler` 매핑 | 구현 2026-06-22: `NotFoundException`(404) + `GlobalExceptionHandler` `ResponseStatusException` 핸들러 |
| ✅ Done | 🟠 High | `ResponseStatusException` 전용 핸들러 추가 — 서비스에서 던진 404/500 상태가 `RuntimeException` 포괄 핸들러에 의해 400으로 바뀌지 않도록 분리 | 구현 2026-06-22: `GlobalExceptionHandler`에 `ResponseStatusException` 핸들러 추가 |
| ✅ Done | 🟡 Medium | `ChangeLogEntityListener.java:133-137` `delYn` 리플렉션 접근 실패 시 warn 로그 + 스택트레이스 추가 | 구현 2026-06-22: 에러 로깅 표준화 9곳 중 하나 |
| ✅ Done | 🟠 High | `PlanService.java:443` `JsonProcessingException` cause 전달 — `ResponseStatusException` 3인수 생성자로 교체 | 구현 2026-06-22: snapshot 직렬화 실패 cause 보존 |
| ✅ Done | 🟠 High | `PlanService.applyExistingPlanSnapshot()` 빈 `catch (JsonProcessingException) {}` — 스냅샷 파싱 실패 로깅 | 구현 2026-06-22: `PlanService.java:133-137`(FIXME [B-H-05]) cause 로깅 |
| ✅ Done | 🟡 Medium | `FileService.downloadFile()` `MalformedURLException` 원인 예외 보존 + `uploadFiles` warn 로깅 | 구현 2026-06-22: `FileService` cause 전달·warn 추가 |
| ✅ Done | 🟠 High | `SsoController.complete()` `sendRedirect` IOException 로깅 | 구현 2026-06-22: 에러 로깅 표준화 |
| ✅ Done | 🟡 Medium | `AdminLogService.readField()` 필드 미발견 시 `log.warn` 추가 (TODO [B-M-01]) | 구현 2026-06-22: `AdminLogService.java:232-241` warn 추가 |
| ✅ Done | 🟡 Medium | `CustomUserDetails` — `athIds` 클레임 타입 불일치 시 `log.warn` 추가 | 구현 2026-06-22: `JwtUtil` athIds warn |
| ✅ Done | 🟡 Medium | `AuditLogPersister` CHG_USID null warn · `CouncilService` 회의일자 warn · `NotificationService` 길이 clamp | 구현 2026-06-22: 에러 로깅 표준화 9곳 |
| ✅ Done | 🟢 Low | `NotificationEvent` `infTtl`(100자)·`infCone`(300자) 길이 강제 — 초과 시 clamp 적용 | 구현 2026-06-22: `NotificationService.send()` 길이 clamp |
| ✅ Done | 🟠 High | `GeminiService` `RestClient`에 `connectTimeout`/`readTimeout` 설정 — 스레드 풀 고갈 방지 | 구현 2026-06-22: connect/read timeout 적용 |
| ✅ Done | 🟡 Medium | Gemini 첨부 파일 실제 크기 제한 구현 | 구현 2026-06-22: `Files.readAllBytes` 전 첨부 크기 사전검사 |
| ✅ Done | 🟡 Medium | Gemini 요청 DTO 검증 추가 — `@NotBlank`, `@Size`, 첨부 개수 제한 | 구현 2026-06-22: `GeminiDto` Bean Validation |
| ✅ Done | 🟡 Medium | `NotificationController` `size` 파라미터 상한 — `@Max(100)` 또는 클램핑 | 구현 2026-06-22: `NotificationController` `@Max` Bean Validation |
| ✅ Done | 🟡 Medium | `@Valid` 입력검증 일관화 — `ApplicationController`, 사업집행 4단계 DTO, `TiptapVariableService` FORBIDDEN 분기 | 구현 2026-06-22: `@Valid`/`@Max` 적용 + Tiptap FORBIDDEN 분기 |
| ✅ Done | 🟡 Medium | 사업집행 4단계 DTO — 금융 금액 필드(`cttAmt`, `dfrAmt`) `@DecimalMin`, YN 플래그 `@Pattern` 적용 | 구현 2026-06-22: 4단계 DTO Bean Validation |

#### Phase 3 — 보안 하드닝

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `gemini.api.key` 운영 필수 검증 — `EnvironmentValidator` 검증 대상 포함 | 구현 2026-06-22: `EnvironmentValidator` gemini 키 검증 |
| ✅ Done | 🟡 Medium | `EnvironmentValidator`에 `eai.enabled`/`EAI_URL` 운영값 검증 추가 | 구현 2026-06-22: `EnvironmentValidator` eai 검증 |
| ✅ Done | 🟠 High | `cors.allowed-origins` 기본값 `*` 제거 + 빈값/와일드카드 운영 차단 가드 | 구현 2026-06-22: `EnvironmentValidator` cors wildcard 검증 + 기본값 제거 + blank 가드 |
| ✅ Done | 🟡 Medium | `SecurityConfig.allowedHeaders` `List.of("*")` → 실제 사용 헤더 명시 화이트리스트 | 구현 2026-06-22: `allowedHeaders` 명시 |
| ✅ Done | 🟡 Medium | `SecurityConfig` 관리자 URL 패턴 `/api/plan/**`을 실제 `/api/plans/**`와 일치 정비 | 구현 2026-06-22: 라우트 `/api/plans` 정합 |
| ✅ Done | 🟢 Low | `AuthController.getClientIp()` — `X-Forwarded-For` 멀티 IP 미분리 | 구현 2026-06-22: `ClientIpResolver` 멀티IP+신뢰프록시 |
| ✅ Done | 🟡 Medium | X-Forwarded-For 신뢰 프록시 목록 제한 | 구현 2026-06-22: `ClientIpResolver` 신뢰프록시 처리 |
| ✅ Done | 🟠 High | Refresh Token Rotation 도입 — `/api/auth/refresh` 시 Refresh Token도 신규 발급·DB 교체 | 구현 2026-06-22: `AuthService` Refresh Token Rotation |
| ✅ Done | 🟡 Medium | `UserDto.DetailResponse` 휴대폰/내선/이메일 PII 노출 본인·ADMIN 한정 | 구현 2026-06-22: `UserService` PII self/admin 한정(`OwnershipVerifier`) |
| ✅ Done | 🟡 Medium | 사번(`eno`) PII INFO 로그 정책 — DEBUG 강등 | 구현 2026-06-22: eno/bbrC INFO→DEBUG, `BoardCommentService` 멘션 INFO 제거 |
| ✅ Done | 🟡 Medium | `EaiService.sendEai()` 전송 실패 로그 — EAI URL/내부 경로 노출 방지 | 구현 2026-06-22: `EaiService` safeMessage |
| ✅ Done | 🟢 Low | `EaiProperties` `enabled=true`+`url` 공백/null 가드 추가 | 구현 2026-06-22: `EaiProperties` enabled+blank-url 가드 |

#### Phase 4 — 성능

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 요구사항 정의서 목록 작성자명 조회 N+1 제거 | 구현 2026-06-22: `ServiceRequestDocService` 배치화 |
| ✅ Done | 🟡 Medium | `ReviewCommentService` 검토의견 작성자명 조회 N+1 제거 | 구현 2026-06-22: `ReviewCommentService` 배치화 |
| ✅ Done | 🟠 High | `ApplicationService.getApplications()` 결재자 목록 N+1 제거 | 구현 2026-06-22: `ApplicationService.getApplications` 배치화 |
| ✅ Done | 🟡 Medium | `ApplicationService.getPendingCount()` full entity 조회 후 `.size()` → `count` 쿼리 | 구현 2026-06-22: `getPendingCount` COUNT 전환 |
| ✅ Done | 🟠 High | `BudgetWorkService.getProjectSummary()` BBUGTM 루프 N+1 + `resolveProjectName()` IN절 일괄 조회 | 구현 2026-06-22: `BudgetWorkService` 배치화 |
| ✅ Done | 🟡 Medium | `GET /api/notifications/unread-count` 상시 `COUNT(*)` → 캐시 | 구현 2026-06-22: `NotificationService` unread-count 캐시(evict-on-write) |
| ✅ Done | 🟡 Medium | `TiptapVariableService.getMetadata()`·`resolve()` 매 호출 DB 조회 → 캐시 | 구현 2026-06-22: `TiptapVariableService` metadata 캐시 + 인트라-요청 memoize |
| ✅ Done | 🟠 High | 메뉴 권한 매핑 `athByMenu()` 캐시 도입 | 구현 2026-06-22: `MenuAuthMapProvider` 캐시(evict-on-write) |
| ✅ Done | 🟠 High | 결재 대기/대시보드·요구사항 정의서·사업집행 4단계 목록·메뉴 활성조회 인덱스 보강 | 구현 2026-06-22: 인덱스 마이그레이션 `V20260622_003`(`IDX_BESTIM_LIST/FST_DTM`, `IDX_BDELIM_LIST/FST_DTM`, `IDX_BCONTM_LIST/FST_DTM`, `IDX_BPAYMM_LIST/FST_DTM`, `IDX_CMENUM_DEL`, `IDX_CMENUA_DEL` 포함) |
| ✅ Done | 🟢 Low | `SEQ_CINFMM` 및 사업집행 4단계 마스터 시퀀스 `NOCACHE → CACHE 20` 변경 | 구현 2026-06-22: 시퀀스 CACHE 20 마이그레이션 `V20260622_004`(`SEQ_BESTIM`, `SEQ_BDELIM`, `SEQ_BCONTM`, `SEQ_BPAYMM` 포함) |
| ✔️ Resolved | 🟡 Medium | `BPAYTM` 회차별 지급 조회 보조 인덱스 검토 — `(DOC_MNG_NO, DOC_VRS_SNO)` 선행 조건은 기존 PK 프리픽스로 커버되어 별도 인덱스 제외 | 검토 2026-06-22: `V20260622_003` 주석에 중복 제외 사유 기록 |
| ✅ Done | 🟡 Medium | `CouncilRepository.updateProjectStatus()` `@Modifying` 후 1차 캐시 stale 정합 | 구현 2026-06-22: `clearAutomatically`/`flushAutomatically` 적용 |

#### Phase 5 — 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `buildCodeNameMap` 중복 private 메서드 추출 — 공통 유틸로 단일화 | 구현 2026-06-22: `CodeNameMapBuilder` 공통 추출(`CostService`/`ProjectService` 위임) |
| ✅ Done | 🟢 Low | `BbugtmRepositoryImpl.sumCostDupBg`/`sumAssetDupBg` 공통 private 메서드 추출 | 구현 2026-06-22: `sumDupBg` 3건 통합 |
| ✅ Done | 🟢 Low | `AuditLogEvent.java` 정리 — 잔여 이벤트 기반 감사로그 제거 | 구현 2026-06-22: `AuditLogEvent` 삭제 |
| ✅ Done | 🟢 Low | `BcostmL` JPA `@Column(length)` 실제 DDL/마스터와 불일치 정정 | 구현 2026-06-22: `BcostmL` @Column length 12건 정정 |
| ✅ Done | 🟡 Medium | `stream().collect(Collectors.toList())` → `.toList()` 전환 | 구현 2026-06-22: 50/51건 전환 (소비자 코드 가변성 확인) |
| ✅ Done | 🟢 Low | `BoardCommentService` 미사용 import 제거 · `FileService` `FL_MNG_NO_RETRY` 제거 | 구현 2026-06-22: dead code 정리 |

## 📋 완료 로그 (시간순)

| 상태 | 일자 | 영역 | 조치 |
| :--: | :--: | :--: | --- |
| ✅ Done | 2026-06-29 | 보안 | 보안 하드닝 구현 완료 — `TASK.md` 🔒 보안 § 잔여 6건(#1·#2·#3·#5·#6·#7) 조치·`TASK_DONE.md` 이관. ① `Authorization: Bearer` 헤더 폴백 `app.auth.allow-bearer-header` 게이팅(base/prod=false)·CLAUDE.md §5.6; ② `AdminSecurityBoundaryTest`로 `/api/admin/**` JWT 필수(`it-portal-user` 무시)→401 입증 + 프론트 `access-control.spec.ts`; ③ SSO 운영 설정 검증(`EnvironmentValidator` prod 가드 + `app.dev.user-switch.enabled` 추가, `ClientIpResolver` 기적용); ④ [T10] Refresh Token 재사용 탐지(`TPRMPP_CRTOKM` FAM_NM/AVL_YN, Flyway `V20260629_001`, `AuthService` 패밀리 회전+grace 윈도우); ⑤ Tiptap 변수 metadata bbrC 부서 권한 필터(`getMetadata(user)`·캐시 키 분리); ⑥ 사업집행 4단계 `changeStatus` ADMIN 전용 전이(`OwnershipVerifier.verifyAdmin` 4개 서비스, CLAUDE.md §5.18). #4 Blocklist는 감내(☑️ Accepted)로 보안 §에 유지 → 보안 § 잔여 = Blocklist(감내) 외 0건. plan `docs/superpowers/plans/2026-06-29-security-hardening.md`·design `docs/superpowers/specs/2026-06-29-security-hardening-design.md`. |
| ✅ Done | 2026-06-29 | 백로그 | TASK.md 재검증 반영 — `TASK.md` 잔여 항목을 6개 병렬 에이전트로 코드 재대조. 이미 해소·정정 완료 또는 코드 부재로 실행 불가한 7건 종료 이관(`$apiFetch` 401 E2E 검증·`AdminDto` JavaDoc·메타 `BPAYTM/BPAYTL.DFR_DT` N→Y·메타 `BPOVWM PRJ_BG_AMR→RQM_BG_AMT`·실시간로그 `V20260531_001` STALE·게시판 `inqAthC` 공통필터 추출·`inqAthC/enrAthC` 매핑 통합테스트 — 후 2건은 코드 부재로 실행불가). 재범위/문구 정정 7건은 `TASK.md` 본문 반영(Open 유지): `EvaluationService`·`CommitteeService` N+1(ScheduleService 완료)·`CouncilService` L298 per-evaluator count 분리·클래스 JavaDoc 잔여(전수 86%)·IT부문 예산 화면 wiring 잔여·본문 최대크기 정책(DECISION)·`findProjectsForCouncilAll/ByDepartment`(18컬럼) 메서드명/컬럼수 정정·환율 환산 활성 충돌(`BudgetWorkService` no-xcr vs `ProjectBudgetSummaryService` ×xcr). 2차 안전 묶음 W2b 착수. plan `docs/superpowers/plans/2026-06-29-task-recheck-improvement.md`·design `docs/superpowers/specs/2026-06-29-task-recheck-improvement-design.md`. |
| ✅ Done | 2026-06-29 | 백로그 | 영향도 낮은 백로그 묶음 처리 — 실행 로드맵 W2(코드부채)+Low 잔여 13건을 단독 수정 가능한 영향도 낮은 작업으로 묶어 4 PR(it_backend `b58558d..1da0e32`, it_frontend `9035174`)로 처리·`TASK_DONE.md` 이관. SSO eno 로그 INFO→DEBUG 강등, `@Valid` 보강(Council/BoardPost), 클래스레벨 `@Transactional(readOnly)`(Plan/LoginAttempt), N+1 제거 4건(ScheduleService·CouncilService.deriveCurrentYearBudget·Deliberation/Contract/Payment.get), `CinfmmRepositoryImpl` 감사컬럼 명시 SET, `BtermmL` length 600→200, `ApplicationContextHolder` 미사용 메서드/구주석 제거, `CodeNameMapBuilder` common.util 이동, `HostAddressProvider` 진단 로깅, council-request/result catch 통일. W2에 묶여 있던 2건(`changeStatus` role 분기·환율 환산 규칙 통일)은 업무요건/단일규칙 결정 선행 필요로 카브아웃하여 W3 재범위(Open 유지). 설계/계획: `docs/superpowers/specs/2026-06-29-low-impact-task-bundling-design.md`, `docs/superpowers/plans/2026-06-29-low-impact-task-bundling.md`. |
| ✅ Done | 2026-06-28 | 백로그 | TASK.md 코드 대조 검증 — 6개 병렬 에이전트로 전체 ⬜ Open 항목을 코드베이스 대조(read-only). 실제 해소된 stale 3건 이관(`ProjectService` 비목 N+1 제거, `applyAthIds` 실익 낮음 종료, 메타 12종 등재). spot-check로 `ApplicationContextHolder` 잔여 JavaDoc·`BRIVGM` 검토의견 인덱스는 Open 유지로 정정. 잔여 항목을 Wave 1~4 실행 로드맵으로 재정리, 보안 High 2건(bbrC 부서필터·사전협의 서버영속화) 상세 설계 문서화(`docs/superpowers/specs/2026-06-28-task-remediation-design.md`). |
| ✅ Done | 2026-06-27 | 백엔드 | 테스트 스텁 정합(후속/T) 검증 종료 — 백로그가 "실패 6건"으로 추적하던 `CostServiceTest`(`@Mock CodeNameMapBuilder` 누락)·`BudgetWorkServiceTest`(단일키→배치 finder 스텁) 항목을 `./gradlew test --tests *CostServiceTest --tests *BudgetWorkServiceTest`로 재검증 → **BUILD SUCCESSFUL**. CostServiceTest는 `@Mock CodeNameMapBuilder`+`@BeforeEach` 기본값 적용 완료, BudgetWorkServiceTest는 배치 finder 스텁 반영 완료. 06-22 이후 커밋에서 해소된 stale 백로그로 확정·종료. |
| ✅ Done | 2026-06-27 | 백로그 | TASK.md 완료 항목 아카이빙 — "에러 처리" 프론트 sweep 26건(2026-06-24)을 dated 서브섹션으로 이관, `AdminMenuService` DB/JPA 1건 이관, 테스트 스텁 stale 항목 종료. TASK.md는 잔여 ⬜ Open만 유지. High 잔여 7건 코드 검증 후 조치 계획 수립(`docs/superpowers/specs/2026-06-27-task-high-remediation-design.md`). |
| ✅ Done | 2026-06-22 | 백엔드 로드맵 | 백엔드 개선 로드맵 Phase 2~5 실행(브랜치 `backend-roadmap-phase2-5`, 코드리뷰 완료). **Phase 2**: `NotFoundException`(404)+`ResponseStatusException` 핸들러, 에러 로깅 표준화 9곳, `GeminiService` 타임아웃+첨부 크기 사전검사, 입력검증(`@Valid`/`@Max`/Bean Validation + Tiptap FORBIDDEN). **Phase 3**: `EnvironmentValidator` 운영 필수키 검증(gemini/eai/cors), CORS allowedHeaders 명시·기본값 제거·blank 가드, `/api/plans` 라우트 정합, `ClientIpResolver`, Refresh Token Rotation, `UserService` PII 한정, eno/bbrC 로그 DEBUG 강등, `EaiService` safeMessage·blank-url 가드. **Phase 4**: N+1 배치화(ServiceRequestDoc/ReviewComment/Application/BudgetWork), 캐시(notification unread-count·tiptap metadata·MenuAuthMap, evict-on-write), 인덱스 `V20260622_003`·시퀀스 CACHE 20 `V20260622_004`, `CouncilRepository.updateProjectStatus` clear/flush. **Phase 5**: `CodeNameMapBuilder` 공통 추출, `sumDupBg` 통합, `AuditLogEvent` 삭제, `BcostmL` length 12건 정정, `.toList()` 50/51 전환, dead code 정리. 후속(테스트 스텁·통합테스트 인프라·프로젝션 DTO·토큰 재사용 탐지·캐시 TTL 등)은 TASK.md 신규 등록. |
| ✅ Done | 2026-06-21 | 주석/문서/백로그 | REVIEW.md 재실행 — 병렬 에이전트 관찰 결과와 직접 검증을 통합. **Task1**: `NotificationEvent`/`NotificationEventListener`의 AFTER_COMMIT “비동기” 주석을 실제 동기 콜백 설명으로 정정, `ApplicationService.bulkApprove()` 반환/롤백 JavaDoc 정정, `ReviewerController` `@PathVariable(name)` 명시, 프론트 `$apiFetch`/`useApiFetch` 예시 절대 URL 정정, `stores/review.ts` 검토자 조회 상대 URL을 `${config.public.apiBase}`로 수정. **Task2/3**: 루트/BE/FE README·CLAUDE에 백엔드 포트 28080, Spring Boot 4.1.0, 소스 통계(BE 349/120/74/35, FE 83/56/67/109), 보안 기본값(DB/JWT 기본값 제거, cookie secure=true), `CouncilController` 메서드 레벨 권한 예외, Playwright 3002를 반영. **Task4**: DB/JWT 기본값 제거·프론트 PDF 실패 toast 완료 항목 [Done] 전환, 요구사항 정의서 소유권 검증과 `ServiceRequestDocService` 네이티브 타입 변환 과제 신규 등록. 검증: `it_backend ./gradlew.bat compileJava`, `it_frontend npm run typecheck` 통과. |
| ✅ Done | 2026-06-14 | 주석/문서/백로그 | REVIEW.md 재실행 (델타: 2026-06-12 회차 이후 BE `26a71cd..HEAD` 금액 컬럼 개편·미사용 테이블 정비·폐쇄망 빌드, FE/DB 동일 구간). **Task1**: 검증 후 stale 주석 5건 교정 — `CostRepositoryCustom`(@param 필드명)·`CostRepositoryImpl`(예시 SQL `IT_MNGC_NO`→`BG_NO`) 금액 컬럼 개편 반영, `BplanmL` IT_PRJ_RMK 주석(`IT예산비고`→`IT프로젝트비고`), `types/council.ts` 2자리 코드 주석 2건. java/ts/silent-failure 병렬 탐지는 다수 기추적·오탐 확인. **Task2/3**: 소스 통계 현행화(BE 350→347 Java/115→116 test/79→77 엔티티/36→38 컨트롤러, FE 84→83 컴포넌트·types 11→15, `@IdClass` 15→29), 감사로그 31→30 전반 반영(Bchklc 드롭, JavaDoc 예시 중복 보정), 폐쇄망 빌드는 이미 문서화 확인, Bchklc 드롭에 따른 README 트리·감사표·data-model 참조 3건 정리 + 협의회 10→9 Repository 정정. **Task4**: 신규 5건 등록 — `common.ts` 3자리 dead branch(High), `BprojmL` CNCD_RFR_NO 누락(Medium), `AdminLogService.readField` warn 누락(Medium), `BcostmL` length 불일치(Low), `result/[id].vue` catch 바인딩(Low). `PlanService` 빈 catch 라인 현행화(126-130→133-137), 메타 미등재 BCHKLC 드롭 반영. |
| ✅ Done | 2026-06-12 | 주석/문서/백로그 | REVIEW.md 재실행 (델타 중심: BE 26a71cd 메뉴 athIds, FE 9dcdc68..HEAD 4커밋) — Task1: 협의회 상태코드 3→2자리 전환 미반영 주석 5건 교정(`[id].vue`, `result/[id].vue`), `MenuQueryService.getMenuTree` JavaDoc athIds 반영, `types/menu.ts` athIds TSDoc 전환, 오류삼킴 FIXME/TODO 5곳 등록. Task2/3: FE README 메뉴 표시 유틸·council 2자리 코드 반영, 루트 README 메뉴 숨김 계층(`admin:true` 플래그→DB 권한 매핑) 정정·감사로그 고정 카운트 제거, BE CLAUDE.md §5.5.5 athIds 이원 용도·메뉴 유형 HED 허용(`AdminMenuService:174` 기준) 반영, 감사로그 31쌍 재검증(검증일 부기), FE CLAUDE.md 메뉴 왕관 유틸·협의회 2자리 코드 규칙 추가(인증 코드 무변경 확인으로 보안 규칙 보강 불필요). Task4: silent-failure 4건(High 1)·메뉴 DB 4건(캐시·인덱스, High 2)·리팩토링 3건 신규 등록, `useCouncilCodes` cdvaNm·`EvalSummaryPanel` 템플릿 오류 해소 확인 → [Done] 전환. |
| ✅ Done | 2026-06-09 | 주석/문서/백로그 | REVIEW.md 재실행 — Task1: java/typescript/silent-failure 병렬 탐지 결과 검증(기존 추적·false positive 다수 확인, `MenuChildrenResolver` 영문주석 지적은 이미 한글로 오탐), 신규 도메인 코드는 한글 주석 충실 → `PaymentController` 클래스 주석 1건 보강. Task2/3: 정보화사업 집행 4단계(`domain/{estimate,deliberation,contract,payment}`, `/api/project/**`)와 `infra/eai`를 BE/FE README·CLAUDE.md에 반영, 소스 통계 현행화(BE 291→350 Java/96→115 test/64→79 entity/감사로그 25→31, FE composables 52→56/pages 58→67), CLAUDE.md §5.18~5.19 집행 4단계·EAI 섹션 신설. Task3 security-reviewer: 집행 4단계 소유권 검증 누락·bbrC 필터 미적용 등 HIGH 2건 외 보안 7건 등록. Task4 database-reviewer: 시퀀스 NOCACHE·DEL_YN 복합인덱스·상세 N+1 등 DB 7건 등록. |
| ✅ Done | 2026-06-05 | 주석/문서/백로그 | REVIEW.md 재실행 — DB 기반 메뉴(`domain/menu`, `useMenu`, `useAdminMenu`) 주석과 README/CLAUDE 반영, 소스 통계 현행화(백엔드 291 Java/96 test/63 entity, 프론트 84 components/52 composables/58 pages), 실시간 로그 타입 경로 정정. stale `approval/list.vue` toast 항목 [Done] 전환, `PlanService` 라인 근거 126-130으로 현행화, 프론트 silent fallback 3건과 DB N+1/실시간 로그 인덱스 후보 추가. |
| ✅ Done | 2026-06-01 | 백로그 | silent-failure-hunter·refactor-cleaner·database-reviewer·security-reviewer 4개 분석 결과 신규 7건(High 3·Medium 4) 추가. `NotificationService.send()` recipientEno null 가드 구현 완료 확인 → [Done] 전환. `QnaService` ROLE_ITPAD001·`PlanService.java:108` 빈 catch 코드 미수정 확인 → [Open] 유지. `cors.allowed-origins` High 보안 항목 신규 등록. `Collectors.toList()` 48곳 파일 목록 구체화. `ChangeLogEntityListener:133` Medium·`PlanService:443` High·`budget/approval.vue:458` Medium silent-failure 신규 등록. DB N+1 2건(`BudgetWorkService.getProjectSummary` High·`resolveProjectName` Medium) 신규 등록. |
| ✅ Done | 2026-06-01 | 주석/문서 | REVIEW.md 전체 재실행 — Task1: java/typescript/silent-failure 병렬 탐지 후 `CouncilService`, `info/plan/[id].vue`, `budget/status.vue` 무시형 실패 경로에 한글 TODO 주석 추가. Task2/3: BE/FE README·CLAUDE.md에 실시간 로그 모니터링(`common/admin/realtime`, `useRealtimeLogs`, `/api/admin/realtime-logs`), Nitro `server/` 구조, 최신 파일 수 반영. Task4: 2026-06-01 typecheck/lint 실패, 실시간 로그 검증, N+1/인덱스 후보를 신규 백로그로 등록 |
| ✅ Done | 2026-05-29 | 주석/문서 | REVIEW.md 전체 재실행 — Task1: java/typescript/silent-failure 병렬 탐지 후 검증, 잘못된 주석 3건 교정(`AuthService` 로그인이력 테이블명 `TPRMPP_CLOGNH`, `AuthController` 로그인 응답 필드 주석, `review.ts` nextVersion JSDoc 0.01/2자리), `QnaService` ROLE_ITPAD001 버그 FIXME 추가. Task2/3: BE/FE README·CLAUDE.md에 IT부문 예산 도메인(`domain/budget/it`, `/api/budget/it` ADMIN 전용)·신규 composable(useItBudget/useItProjectRows/useApprovalStatus) 반영. Task4: security-reviewer 신규 2건(문서 대시보드 bbrC 신뢰, getClientIp XFF 미분리) + QnaService 권한 버그 등록. 다수 기존 탐지 항목은 이전 회차에서 이미 수정됨(stale) 확인 |
| ✅ Done | 2026-05-26 | 백로그 | REVIEW.md Task 4 — refactor-cleaner·database-reviewer·silent-failure-hunter 분석. `task1-silent-failures.md` HIGH 이상 항목 전수 검토 후 신규 14건(Critical 1·High 13) 에러 처리 섹션에 등록. 기존 항목 완료 여부 코드 확인(모두 Open 유지). 기준일 2026-05-26 갱신. |
| ✅ Done | 2026-05-22 | 주석 | REVIEW.md Task 1 — java-reviewer·typescript-reviewer·silent-failure-hunter·comment-analyzer 병렬 분석. `@Valid` 누락 FIXME(ApplicationController, ProjectController, PlanController), `@Transactional(readOnly=true)` TODO(PlanService), 유니코드 이스케이프 TODO(CouncilService), 빈 catch [HIGH] TODO 3건(stores/review.ts), FIXME(budget/report.vue), 폴링 정책 주석 보강(useNotifications.ts), 고아 JavaDoc 삭제(NotificationService.java) |
| ✅ Done | 2026-05-22 | 문서 | REVIEW.md Task 2/3 — BE/FE README.md 및 CLAUDE.md에 알림 시스템(common/notification), Tiptap 변수 시스템(common/system/tiptap) 섹션 추가. 컴포넌트 72개·Composable 48개 카운트 갱신. 루트 README §18.10 현행화 메모 추가 |
| ✅ Done | 2026-05-17 | 주석 | REVIEW.md Task 1 재실행 — Java/TypeScript 주석 불일치 교정, Excalidraw/HWPX/Tiptap/Auth 실패 경로 TODO/FIXME 추가, `Bcmmtm.cnfmYn` 컬럼 comment 보강 |
| ✅ Done | 2026-05-19 | 주석/문서 | REVIEW.md 재점검 — 깨진 한글 주석, JavaDoc 위치 오류, 게시판 QueryDSL 설명, 관리자 미들웨어 적용 범위 문서 보강 |
| ✅ Done | 2026-05-17 | 문서 | 루트/백엔드/프론트 README·CLAUDE 현행화 — 테스트 수, Nuxt 버전, 실제 API 경로(`/api/cost`, `/api/plans`), Gemini 관리자 권한, 감사로그 저장 시점 정정 |
| ✅ Done | 2026-05-16 | 주석 | java-reviewer / typescript-reviewer / silent-failure-hunter 탐지 후 comment-analyzer로 48개 파일에 한글 주석/FIXME 마커 적용 (`TaskNotes/review_task1_applied.md`) |
| ✅ Done | 2026-05-16 | 문서 | 루트/it_backend/it_frontend README·CLAUDE.md 현행화 — 모노레포 구조, 캐시 전략(@Cacheable codesByCid·budgetPeriod), @Valid 일관성, 감사로그 BaseLogEntity 패턴, 이벤트 리스너 선택 기준, 프론트 에러 처리/Pinia 에러 전파 규칙 추가 |
| ✅ Done | 2026-05-16 | 보안 | security-reviewer 10개 보안 규칙 감사 — 신규 Critical/High 항목(BCrypt 전환, Refresh Token Rotation, CORS allowedHeaders 화이트리스트 등) TASK.md 등록 |
| ✅ Done | 2026-05-14 | 문서 | 공통 게시판(`common/board`, `/board`, `/admin/boards`)을 루트/백엔드/프론트 README·CLAUDE에 반영 |
| ✅ Done | 2026-05-14 | 문서 | 로그인 Brute-force 보호 설명을 DB 로그인 이력(`TPRMPP_CLOGNH`) 집계 방식으로 정정 |
| ✅ Done | 2026-05-14 | 주석 | `AdminDto`, `BoardPostRepositoryImpl`, `Cblbcm`, 일부 프론트 파일 헤더/계약 주석 보강 |
| ✅ Done | 2026-05-14 | 문서 | `useDeptFilter` 미구현 상태를 프론트 CLAUDE/README에 반영하고 후속 과제로 이동 |
| ✅ Done | 2026-05-10 | 사전협의 | `stores/review.ts` `defaultReviewers` 하드코딩 제거 → `ReviewerService`/`ReviewerController`/`ReviewerDto` TDD 구현 + API 조회 연동 |
| ✅ Done | 2026-05-10 | 프론트엔드 | `formatDateTime` 3개 중복 구현 → `utils/common.ts` 단일 구현으로 통합 |
| ✅ Done | 2026-05-10 | 프론트엔드 | `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 |
| ✅ Done | 2026-05-10 | 문서 | 실제 설정 기준 로컬 포트(프론트 3000, 백엔드 8080)와 비밀값 기본값 잔존 상태를 README/CLAUDE/TASK에 반영 |
| ✅ Done | 2026-05-10 | DB/JPA | `CAPPLA` 복합 인덱스 추가 마이그레이션 확인 (`V20260510_001__add_cappla_composite_index.sql`) |
| ✅ Done | 2026-05-10 | DB/JPA | `BITEMM(PRJ_MNG_NO)` 인덱스 추가 마이그레이션 확인 (`V20260510_002__add_bitemm_prj_mng_no_index.sql`) |
| ✅ Done | 2026-05-09 | 보안 | `EnvironmentValidator` — `spring.datasource.password`, `jwt.secret` 빈값 fast-fail 검증 추가 (단, 개발 기본값 제거는 미완료) |
| ✅ Done | 2026-05-09 | 보안 | `FileOwnershipChecker` 소유권 검증 → `FileController` 적용, `GeminiController` `@PreAuthorize("hasRole('ADMIN')")` 추가 |
| ✅ Done | 2026-05-09 | 보안 | `LoginAttemptService` — `TPRMPP_CLOGNH` 로그인 실패 이력 기반 5회/10분 Brute-force 차단, `AuthService.login()` 연동 |
| ✅ Done | 2026-05-09 | 보안 | `FileValidator` — 허용 확장자 화이트리스트 검증, `FileService.uploadFileInternal()` 연동 |
| ✅ Done | 2026-05-09 | 에러처리 | `SsoController.complete()` catch → `log.error()` 추가 |
| ✅ Done | 2026-05-09 | 에러처리 | `FileService.java` IOException → `CustomGeneralException(msg, e)` cause 전달 |
| ✅ Done | 2026-05-09 | 에러처리 | `ApplicationService.updateApprovalLineInDetail()` → `ApprovalLineDelegate` 위임 메서드 추출, private `@Transactional` 제거 |
| ✅ Done | 2026-05-09 | 에러처리 | `ApplicationService.java` 결재선 업데이트 실패 시 예외 재발생 방침 적용 |
| ✅ Done | 2026-05-09 | DB/JPA | `BudgetWorkQueryRepository` — `getSummary()` 비목 루프 N+1 → 단일 집계 쿼리 통합 |
| ✅ Done | 2026-05-09 | DB/JPA | `Bprojm.update()` 35+ 파라미터 → `BprojmUpdateCommand` 객체 도입 |
| ✅ Done | 2026-05-09 | 주석 | java-reviewer·typescript-reviewer 탐지 결과 → 오류 주석 교정, 누락 JavaDoc/TSDoc 추가 |
| ✅ Done | 2026-05-09 | 주석 | silent-failure-hunter 탐지 결과 → 에러 삼킴 30개 위치에 TODO/FIXME 한글 주석 추가 |
| ✅ Done | 2026-05-09 | 문서 | it_backend/README.md, it_frontend/README.md 전면 재작성 (설계 결정, API 맵, 보안 흐름 포함) |
| ✅ Done | 2026-05-09 | 문서 | it_backend/CLAUDE.md §5.6 보안 규칙 보강 (미적용 컨트롤러 목록, 비밀값 기본값 위험, Brute-force 등) |
| ✅ Done | 2026-04-29 | 인증 | Access Token 쿠키 Max-Age를 JWT 기본 유효시간 15분과 일치시킴 |
| ✅ Done | 2026-04-29 | 문서 | 인증 주석을 httpOnly 쿠키 전략 기준으로 정리 |
| ✅ Done | 2026-04-29 | 테스트 | `CookieUtilTest`를 추가하여 JWT 쿠키 보안 속성과 만료 시간을 검증 |
| ✅ Done | 2026-05-06 | 문서 | JWT 설정 키명과 CORS 개발 Origin 문서를 실제 설정값 기준으로 갱신 |
| ✅ Done | 2026-05-06 | 주석 | 사전협의 코멘트 작성자 팀명/첨부파일 TODO를 백엔드 DTO와 프론트 매퍼에 명시 |

## ☑️ 완료된 체크리스트

- [x] 백엔드 실시간 로그 API 구현 — `RealtimeLogController`/`RealtimeLogService`/`RealtimeLogRepository`, `V_ITPAPP_LOG_FEED` 조회, ADMIN 권한 테스트와 서비스 단위 테스트 추가
- [x] 메타(table.csv) `CBLBCM/CBLBCL` 게시물고유ID 컬럼 정정 — DB·엔티티는 `NAC_UNQ_ID` VARCHAR2(16) 변경 완료(`V20260612_003`), table.csv도 `NAC_UNQ_ID`(16)·`DFR_DT`(지급일자) 등재 반영 확인(2026-06-12). 컬럼 순서 정합은 `V20260612_004`로 완료.
