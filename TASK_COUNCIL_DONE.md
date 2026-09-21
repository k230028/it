# IT정보화포탈 정보화실무협의회 완료·종료 내역

[TASK_COUNCIL.md](TASK_COUNCIL.md)에서 분리한 완료·해소·감내·폐기 항목을 보관합니다. 공통 과제 이력은 [TASK_DONE.md](TASK_DONE.md)를 참조합니다.

| 상태 | 의미 |
| :--: | --- |
| ✅ Done | 구현 및 해당 범위 검증 완료 |
| ✔️ Resolved | 해소(거짓양성 등) |
| ☑️ Accepted | 근거를 기록하고 감내 |
| ⛔ Discarded | 사용자 범위 결정으로 폐기 |

검증 완료 후 날짜별로 `ID / 상태 / 조치 / 근거` 표와 검증 결과를 추가합니다.

## 2026-09-21

| ID | 상태 | 조치 | 근거 |
| --- | :--: | ---- | ---- |
| COUNCIL-008 | ✅ Done | 협의회 목록 툴바의 `[개발용] 사용자 전환` 버튼·`SwitchUserDialog` 마운트·`showSwitchUserDialog` ref·import와 i18n `council.list.switchUser`/`switchUserHint`(ko/en) 제거. 역할 검사 없이 모든 사용자에게 보이던 진입점만 없앴고, 사용자 전환은 공통 헤더(`AppHeader`, `v-if="isAdmin()"`)가 계속 제공 | [목록](it_frontend/app/pages/info/council-request/index.vue) · [헤더](it_frontend/app/components/layout/AppHeader.vue) |
| COUNCIL-007 | ✅ Done | 목록 조회 안정 정렬 + 연도·부서 검색. 백엔드 목록 쿼리 4개(`findByDepartment`·`findByCommitteeMember`·`findProjectsForCouncilAll`·`findProjectsForCouncilByDepartment`)의 `ORDER BY FST_ENR_DTM DESC` 뒤에 키 컬럼(`IT_PTL_ASCT_ID` / `ABUS_MNG_NO, SNO`) tie-breaker를 두고, 정렬이 없던 계획협의회(02) 파생 조회는 서비스에서 같은 기준으로 정렬. 프론트 `council-list-filter`에 사업연도(`prjYy`)·주관부서(`svnDpm`) 필터·옵션 추가(응답 필드 재사용, API 변경 없음), 부서 필터는 IT관리자·정보보호관리자에게만 노출 | [리포지토리](it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java) · [필터](it_frontend/app/features/council/request/council-list-filter.ts) |
| COUNCIL-007 (서버 페이징·상한) | ☑️ Accepted | 로컬(운영 덤프) 기준 `TPRMPP_BASCTM` 활성 7건·`TPRMPP_BPROJM` 활성 45건으로 수십 건 규모이고, 4개 쿼리 모두 권한 범위(전체/부서/배정위원)의 DB 필터가 이미 걸려 있으며 화면은 `useProgressiveList` 점진 노출을 쓴다. 서버 페이징은 API 계약 변경(codegen)과 정렬 규칙(신청 건 우선→심의유형) 이전을 동반하므로 연 수백 건을 넘거나 목록 응답이 체감 지연될 때 별도 설계로 도입한다. 정보보호관리자 분기의 전건 조회 후 메모리 필터도 같은 근거로 유지 | 동일 |
| COUNCIL-006 | ✅ Done | KeepAlive(`app.vue` `max: 10`) 재방문 시 협의회 화면 4개가 `onActivated`에서 최신 상태를 조용히 재조회. 목록: 협의회 목록+생략 판정함, 개최준비·결과: 협의회 상태(단계), Step1: 상세는 항상, 타당성검토표는 `formDirty`가 아닐 때만(편집 중 입력 보존). 첫 마운트 직후 발화는 `skipFirstActivation`으로 건너뛰어 초기 lazy 조회를 dedupe-cancel하지 않음. 검토표 조회에 `useRefreshGuard`를 붙여 실패 시 마지막 값을 보존(ERR-13 3keep)하고 COUNCIL-004 배너·잠금으로 안내 | [래퍼](it_frontend/app/features/council/request/activation-refresh.ts) · [페이지 상태](it_frontend/app/composables/useCouncilRequestPage.ts) |
| COUNCIL-004 | ✅ Done | 타당성검토표 초기 조회 실패와 미작성 구분. GET은 미작성이면 200/null, 실패면 data 비움+`status='error'`라 data만으로는 같았고, 실패를 신규 작성으로 프리필해 임시저장하면 기존 저장본을 BPROJM 기본값으로 덮어쓸 수 있었음. `fetchCouncilRequestPageData`가 `feasibilityFetch` 핸들을 함께 넘기고 `useCouncilRequestPage`가 `initialLoadFailed`·`initialLoadFailureDetail`·`canEdit`·`retryInitialLoad`를 제공. 실패 상태는 빈 폼+편집·첨부·저장 버튼 잠금, `saveTemp`/`saveComplete`는 서버 호출 없이 토스트, 페이지 상단 오류 배너의 [새로고침]이 상세·검토표를 재조회 | [페이지 상태](it_frontend/app/composables/useCouncilRequestPage.ts) · [페이지](it_frontend/app/pages/info/council-request/[id].vue) |
| COUNCIL-003 | ✅ Done | 사업 목록 신청 다이얼로그의 심의유형 선택지에서 계획협의회(02) 제거. 02는 계획(BPLANM)에 붙어 `reqDocNo`가 필요해 사업 카드에서 신청하면 `CreateRequest.isTargetPresent` 400이 났음. 선택지 규칙을 `features/council/request/council-apply-options.ts`(`applyDbrTcOptions`·`defaultApplyDbrTc`)로 분리하고 기본 선택값은 03 우선. 계획 상세(`/info/plan/[id]` → `usePlanDetailPage.handleRequestCouncil`) 신청 경로는 유지 | [선택지](it_frontend/app/features/council/request/council-apply-options.ts) · [목록](it_frontend/app/pages/info/council-request/index.vue) |

코드 변경(COUNCIL-003): `it_frontend` — `features/council/request/council-apply-options.ts`(신규), `pages/info/council-request/index.vue`, 테스트 1개. 백엔드·`CouncilApplyDialog`·i18n·계획 상세 경로 변경 없음(백엔드는 계획 상세 경로가 쓰므로 02 신청 API를 그대로 받는다). 01(중장기계획)은 `ADMIN_CREATABLE_TYPES`에 있어 선택지에 유지.

검증 결과(COUNCIL-003):

- `council-apply-options.test.ts` 6건 통과 — 역할 조합·정보보호 소요자원·"어떤 조합에도 02 없음"·기본값 03 우선.
- `tests/unit/features/council`·`tests/unit/components/council` 12개 파일 58건 통과, `npm run typecheck`·eslint(대상 3파일) 통과.

미검증 범위(COUNCIL-003): 목록 페이지 자체의 컴포넌트 테스트는 없음(다이얼로그 props 배선은 타입 검사로만 확인). 실제 브라우저에서 IT관리자 계정의 선택지 표시.

코드 변경(COUNCIL-004): `it_frontend` — `composables/useCouncilRequestPage.ts`, `pages/info/council-request/[id].vue`, `i18n/messages/council.ts`(council.request 키 3개 ko/en), `tests/unit/composables/useCouncilRequestPage.test.ts`. 백엔드·DTO·다른 화면 변경 없음. 판정은 예외가 아니라 조회 `status` 기준(ERR-13)이며 401·403도 같은 배너로 다룬다.

검증 결과(COUNCIL-004):

- `useCouncilRequestPage.test.ts` 46건 통과(신규 6건 — 검토표 실패 시 빈 폼·잠금, 미작성(200/null)은 기존대로 프리필, 실패 상태 임시저장·작성완료 차단, 상세 실패도 같은 플래그, 재조회 성공 시 해제·저장값 프리필, 재실패 시 유지).
- 협의회 컴포넌트·기능·페이지 경계 테스트 14개 파일 104건 통과, `npm run typecheck`·eslint(대상 3파일)·prettier 통과.

미검증 범위(COUNCIL-004): 페이지 템플릿(배너·버튼 `v-if`)은 타입 검사로만 확인. 실제 브라우저에서 백엔드를 내린 채 진입하는 시나리오. 보존 데이터가 있는 재조회 실패(쓰기 후)는 기존 ERR-13 가드가 계속 담당.

코드 변경(COUNCIL-006): `it_frontend` — `features/council/request/activation-refresh.ts`(신규), `composables/useCouncilRequestPage.ts`(`refreshOnActivated`, 검토표 가드), `pages/info/council-request/index.vue`·`[id].vue`·`prepare/[id].vue`·`result/[id].vue`, 테스트 2개. 실패 문구는 기존 키(`council.list.retryFailure`·`council.request.skipReqRetryFailure`·`detailRetryFailure`) 재사용으로 i18n 추가 없음. 백엔드 변경 없음.

검증 결과(COUNCIL-006):

- `activation-refresh.test.ts` 3건(첫 호출 무시·인스턴스별 계수·반환값 전달), `useCouncilRequestPage.test.ts` 신규 3건(편집 전 두 조회 재조회·편집 중 상세만·검토표 재조회 실패 시 값 보존+잠금+Toast 없음) 통과.
- 협의회 관련 15개 파일 110건 통과, `npm run typecheck`·eslint(대상 8파일)·prettier 통과.

미검증 범위(COUNCIL-006): 개최준비·결과 페이지의 하위 조회(위원·일정·결과서·Q&A)는 재활성화 때 다시 읽지 않음(각 저장 흐름의 재조회가 담당). `onActivated` 발화 자체는 KeepAlive 통합 테스트가 없어 실제 브라우저 확인 필요. 목록의 계획협의회 카드 통계(`useCouncilPlanStats`)는 목록 데이터 변경에 따라 갱신되는지 별도 확인하지 않음.

코드 변경(COUNCIL-007): `it_backend` — `CouncilRepository.java`(ORDER BY 4곳), `CouncilService.java`(02 목록 정렬), `CouncilRepositoryQueryTest.java`. `it_frontend` — `features/council/request/council-list-filter.ts`, `pages/info/council-request/index.vue`, `i18n/messages/council.ts`(council.list 키 2개 ko/en), `council-list-filter.test.ts`. DTO·OpenAPI 계약 변경 없음.

검증 결과(COUNCIL-007):

- 백엔드: `CouncilRepositoryQueryTest.listQueries_useStableOrdering`(4개 쿼리 ORDER BY 단언) 포함 `com.kdb.it.domain.council.*` 423건 통과, 실패 0. `spotlessJavaCheck` 통과. 실제 Oracle에 대한 정렬 결과 비교는 하지 않음(구문은 기존 컬럼만 사용).
- 프론트: `council-list-filter.test.ts` 13건(신규 3건 — 연도 옵션 내림차순·완전일치, 부서 옵션 라벨 해석·완전일치, 초기화·isFiltered 포함) 포함 `tests/unit/features/council` 46건 통과, `npm run typecheck`·eslint·prettier 통과.

미검증 범위(COUNCIL-007): 목록 페이지 템플릿(필터 Select 2개, 관리자 전용 노출)은 타입 검사로만 확인. 부서 옵션 순서는 목록 원본 순서(정렬하지 않음).

코드 변경(COUNCIL-008): `it_frontend` — `pages/info/council-request/index.vue`, `i18n/messages/council.ts`. 다이얼로그 컴포넌트·`useAuth.switchUser`·백엔드 변경 없음. 함께 발견한 후속: COUNCIL-006에서 추가한 검토표 재조회 가드의 `logLabel` 한글 리터럴이 `user-facing-copy-ratchet` 기준선(`useCouncilRequestPage.ts`=2)을 3으로 넘겨 영문 접두어로 정정.

검증 결과(COUNCIL-008): `npm run check:copy`(고정 리터럴 ratchet 3건) 통과, `npm run typecheck`·eslint·prettier 통과, `useCouncilRequestPage.test.ts` 48건 통과. 목록 페이지 컴포넌트 테스트는 없음.

미검증 범위(COUNCIL-008): 실제 브라우저에서 일반 사용자 화면의 버튼 부재 확인.

## 2026-09-20

| ID | 상태 | 조치 | 근거 |
| --- | :--: | ---- | ---- |
| COUNCIL-001 | ✅ Done | `CouncilAccessGuard.verifyReadable`로 협의회 상세·타당성검토표 조회를 시스템관리자, 심의유형 04의 정보보호관리자, 활성 연결 사업의 주관부서, 해당 협의회 활성 배정위원으로 제한. `CouncilService.findReadableCouncil`을 사용자 상세 조회와 `FeasibilityService` 조회에 적용 | [설계](docs/superpowers/specs/done/2026-09-20-council-access-and-draft-protection.md) · [가드](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilAccessGuard.java) |
| COUNCIL-002 | ✅ Done | `CouncilAccessGuard.lockWritableDraft`가 `CouncilRepository.findByIdForUpdate`(`PESSIMISTIC_WRITE`, 잠금 3,000ms)로 원장을 잠근 뒤 수정 권한(관리자·정보보호 04·주관부서, 위원 자격 제외)과 작성중(`01`)·비계획협의회 상태를 검사. 권한 없음 403, 삭제·미존재 404, 비작성중·잠금 초과 409. `FeasibilityService` POST/PUT에 적용 | 동일 |
| COUNCIL-011 | ✅ Done | `CouncilAccessGuard`에 `verifyManageable`·`verifyOwningOrManageable`·`verifyCommitteeOrManageable`·`verifyCreatable`을 추가하고 평가위원 편성(관리자, 상태 04·05만, 위반 409)·결재 상신(주관부서·관리자, 권한을 상태보다 먼저)·사전 Q&A 질문(배정위원·관리자)·협의회 신청(관리자 01/02/03/05, 정보보호관리자 04, 일반부서는 주관 사업 03·정보보호 항목 있으면 04, 관리자 04도 정보보호 항목 필요)에 적용 | [설계](docs/superpowers/specs/done/2026-09-20-council-write-boundaries-design.md) · [계획](docs/superpowers/plans/done/2026-09-20-council-write-boundaries.md) |
| COUNCIL-005 | ✅ Done | 협의회 자유입력 21개 필드를 DB BYTE 한도로 정합: 엔티티 10개 `@PrePersist/@PreUpdate`(`CouncilTextLimits`, 초과 시 400)와 프론트 `councilFormLimits` 단일 출처 + `createModel`/`acceptText` 거부 + `TextLengthIndicator`, 글자 수 `maxlength`·자리표시자 "(최대 N자)" 제거, 회의장소 결합값 100B 검사 | [설계](docs/superpowers/specs/done/2026-09-20-council-text-byte-limits-design.md) · [계획](docs/superpowers/plans/done/2026-09-20-council-text-byte-limits.md) |

코드 변경: `it_backend` — `CouncilAccessGuard.java`(신규), `CouncilService.java`, `FeasibilityService.java`, `CouncilRepository.java`, `CouncilServiceTest.java`, `CouncilAccessBoundaryTest.java`(신규), `docs/guides/security/data-scope.md`. 요청·응답 DTO와 DB 스키마는 변경 없음.

검증 결과:

- `CouncilAccessBoundaryTest` 31건 통과 — 타 부서 조회·저장 거부, 비작성중 상태 덮어쓰기 거부, 주관부서 작성중 조회·저장, 작성완료 후 재저장 거부, 배정위원 조회 허용·타 부서 저장 거부, 관리자 작성완료본 덮어쓰기 거부, 정보보호관리자 심의유형 범위, 계획협의회 검토표 생성 거부, 부서·인증·사번 누락 거부, 비정상 principal 거부, 삭제 원장 저장 거부, 잠금 초과 409·미기록, HTTP POST/PUT 403·409.
- `com.kdb.it.domain.council.*` 27개 테스트 클래스 370건 통과, 실패 0.
- `spotlessJavaCheck` 통과.
- 백엔드 전체 `./gradlew test` 5,608건 통과, 실패 0, 건너뜀 2 (품질 게이트).

미검증 범위: Oracle 실제 잠금 대기 시간과 운영 사용자 연동은 별도 검증 대상. 작성중 동시 편집의 오래된 입력 덮어쓰기는 COUNCIL-012, 신규 신청과 다른 하위 API 권한은 COUNCIL-011, 프론트 편집 가능 상태·오류 안내 정렬은 COUNCIL-004·009에서 계속 관리.

코드 변경(COUNCIL-011): `it_backend` — `CouncilAccessGuard.java`, `CommitteeService.java`, `CouncilApprovalService.java`, `QnaService.java`, `CouncilService.java`, `CouncilAccessBoundaryTest.java`, `CommitteeServiceTest.java`, `CouncilApprovalServiceTest.java`, `QnaServiceTest.java`. 사용자 승인으로 `common/approval/service/CouncilJsonlessApprovalWorkflowTest.java`의 생성자 목 인자 1개만 보강. 컨트롤러·DTO·DB·프론트 변경 없음.

검증 결과(COUNCIL-011):

- `CouncilAccessBoundaryTest` 58건 통과(기존 31건 + 신규 27건) — 가드 판정 행렬, 위원 편성 권한·상태(04·05 허용, 그 밖의 12개 상태 409), 결재 상신 권한 우선(403 → 400 순), Q&A 질문 위원·관리자, 신청 거부 시 채번·영속화 미호출, 인증 누락.
- `com.kdb.it.domain.council.*` 397건 통과, 실패 0.
- 백엔드 전체 `./gradlew test` 5,635건 통과, 실패 0, 건너뜀 2. `spotlessJavaCheck` 통과.

미검증 범위(COUNCIL-011): 사전 Q&A 질문의 단계별 허용 시점(상태 가드 미적용), 결재 상신 원장 잠금(COUNCIL-012), 조회 API 11개(COUNCIL-013), 운영 사용자 연동.

코드 변경(COUNCIL-005): `it_backend` — `domain/council/entity/CouncilTextLimits.java`(신규), 엔티티 10개(`Bpovwm`·`Bperfm`·`Bchklm`·`Bevalm`·`Bplevm`·`Brsltm`·`Bpqnam`·`Bmqnam`·`Baskpm`·`Basctm`), 테스트 2개(`CouncilTextLimitsTest`·`CouncilEntityByteLimitTest`). `it_frontend` — `features/council/councilFormLimits.ts`·`meetingPlace.ts`(신규), 협의회 컴포넌트 8개(`FeasibilityOverview`·`FeasibilityPerformance`·`FeasibilitySelfCheck`·`EvaluationForm`·`PlanPprtForm`·`ResultForm`·`CouncilQna`·`MainQnaSection`·`ScheduleStatus`)와 페이지 2개(`council-request/index.vue`·`[id].vue`), 사용자 승인으로 `i18n/messages/council.ts` 자리표시자 문구 18건 정리, 테스트 3개. DTO·컨트롤러·DB·공통 유틸 변경 없음.

검증 결과(COUNCIL-005):

- 백엔드: `CouncilTextLimitsTest` 2건, `CouncilEntityByteLimitTest` 23건, `com.kdb.it.domain.council.*` 422건 통과, 실패 0. 전체 `./gradlew test` 5,660건 중 5,659건 통과, 건너뜀 2, 실패 1 — `common.mfa.provider.OnePassClientTest.fidoStart_exposesChallengeThroughClientFacade`(협의회 무관, 응답 Content-Type 파싱 예외)로 단독 재실행 시 18건 전부 통과. `spotlessJavaCheck` 통과.
- 프론트: `councilFormLimits.test.ts` 3건, `meetingPlace.test.ts` 2건, `FeasibilityOverview-byte-limit.test.ts` 2건, 협의회 컴포넌트·기능 테스트 통과, `npm run typecheck`·`lint`·`check:copy`·`format:check` 통과. `npm test` 6,078건 중 6,076건 통과, 실패 2 — `pages/project-domain-i18n.test.ts`·`components/approval/ItBudgetSourceChangedDialog.test.ts`(협의회 무관, 로컬 Node ICU가 한국어 시각을 `오전` 대신 `AM`으로 렌더).
- `app/components/council`·`app/pages/info/council-request`에 `maxlength`·`{ max: N }` 잔존 0건.

미검증 범위(COUNCIL-005): `v-model` 배선 컴포넌트(평가·계획평가·결과서·질의응답·장소·사유)는 타입 검사와 기존 테스트로만 확인했고 거부 동작의 컴포넌트 테스트는 두지 않음(거부 규칙 자체는 `useDatabaseByteLimit` 테스트가 담당). 실제 브라우저에서의 붙여넣기 복원, 서버 400 메시지의 화면 노출(COUNCIL-009).
