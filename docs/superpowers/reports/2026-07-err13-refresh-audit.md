# ERR-13 `useApiFetch` 재조회 실패 판정 감사 (2026-07-29)

## 배경

Nuxt `useAsyncData.execute()`의 catch는 재던지지 않는다. 실측 위치는
`it_frontend/node_modules/nuxt/dist/app/composables/asyncData.js:436-448`이다.

```js
}).catch((error) => {
    ...
    asyncData.error.value = createError(error);
    asyncData.data.value = unref(options.default());   // :448
    asyncData.status.value = "error";
})
```

`options.default`의 기본값은 같은 파일 `:44`(`opts.default ??= getDefault`)와 `:484`(`const getDefault = () => void 0`)에서
`() => undefined`로 확정된다.

따라서 `useApiFetch`(`it_frontend/app/composables/useApiFetch.ts:210` = `return useFetch<T>(url, params)`)가 돌려주는
`refresh()`는 **실패해도 항상 resolve**하며 다음 세 가지가 동시에 일어난다.

1. `error.value`에 원인이 담긴다.
2. `data.value`가 **기본값(`undefined`)으로 초기화**된다. (마지막 정상값이 유지되지 않는다)
3. `useApiFetch`의 `onRequestError`(`:140`)·`onResponseError`(`:167`)가 네트워크·403·404·5xx에 대해 자체 Toast를 띄운다.

이 세 번째 항목 때문에 "완전한 무음 실패"는 아니지만, **성공 안내와 실패 안내가 동시에 나가거나(모순),
로컬 복사본을 쓰는 화면에서는 낡은 값이 그대로 남는(오인)** 문제가 남는다. 아래 분류의 사용자 영향은 이 세 갈래로 나뉜다.

## 대상 식별 기준

`useApiFetch`(또는 이를 감싼 `fetchXxx`)에서 구조 분해한 `refresh`만 대상. 자체 `$apiFetch` 기반 동명 함수는 제외.

### 사용한 검색 명령과 실측 수치

| 명령 | 결과 |
| --- | --- |
| `rg -l "useApiFetch<" app` | 31개 파일 |
| `rg -n "refresh:\s*\w+\|\{\s*[^}]*\brefresh\b[^}]*\}\s*=" app` | 구조 분해·별칭 후보 73줄 |
| `rg -n "\brefresh\w*\s*\??\.?\(\)" app` (주석·테스트 제외) | 호출부 **139줄** |
| `rg -lU --multiline "try \{[\s\S]{0,600}?refresh\w*\(\)" app` | 30개 파일 |
| 위 정규식이 못 잡는 무괄호 템플릿 핸들러(`@click="refreshXxx"`) 수동 확인 | 2줄 추가 |

→ **총 조사 호출부 145개.**

> 위 표의 "139줄 + 2줄 추가 = 141"은 **정규식이 매칭한 소스 줄 수**다. 분류 표의 `건수`는 **호출 단위**로 세므로
> `app/pages/budget/work.vue:615`처럼 한 줄에 `refresh` 호출이 2개 들어있는 경우 줄 수(1)와 건수(2)가 다르다.
> 이 리포트 전체의 "총 조사 호출부"는 분류 표(§분류 결과)의 `건수` 합계인 **145**를 기준으로 통일했다(Minor 6 정정 및 재리뷰 Important 1 정정 반영).

> 계획서(`docs/superpowers/plans/2026-07-29-err13-fe15-19-remediation.md` 실행 전 확정된 사실)는
> "`useApiFetch` 소비 파일 44개 / `try { … await refresh…() }` 포함 파일 28개"로 기록했다.
> 2026-07-30 재실측 값은 **31개 / 30개**다. 조사 결론에는 영향이 없으나 전제 수치는 이 리포트 값을 따른다.

### 출처를 직접 열어 확인한 "동명 함수" 목록 (오탐 방지)

이름이 같지만 `useApiFetch` 유래가 아니어서 **기존 try/catch가 정상 동작**하는 함수들이다. 모두 정의부를 열어 확인했다.

| 함수 | 정의 위치 | 기반 |
| --- | --- | --- |
| `useNotifications().refresh` | `app/composables/useNotifications.ts:55` | `$apiFetch` (reject함) |
| `usePendingApprovalCount().refresh` | `app/composables/usePendingApprovalCount.ts:91` | `$apiFetch` |
| `refreshPendingApprovalCount` | `app/composables/usePendingApprovalCount.ts:64` | `$apiFetch` |
| `refreshApprovalBadgeCount` | `app/composables/useApprovalDashboard.ts:132` | `$apiFetch` |
| `useAuth().refresh` | `app/composables/useAuth.ts:174` → `stores/auth.ts` | Nuxt `$fetch` (토큰 갱신) |
| `refreshProject` (소요예산 상세) | `app/pages/project/estimate/[docNo].vue:51` | `$apiFetch` |
| `refreshProject` (사업계획 상세) | `app/pages/project/bizplan/[abusMngNo].vue:71` | `$apiFetch` |
| `refreshAttachments` (가이드) | `app/pages/guide/index.vue:247` | `$apiFetch` (주석에 이유 명시) |
| `refreshNuxtData` | Nuxt 전역 API | 구조 분해 `refresh` 아님 |

`useApprovalDashboard().refresh`·`useDocumentDashboard().refresh`는 `useApiFetch` 유래지만
소비자(`app/pages/approval/index.vue:25`, `app/pages/info/documents/index.vue`)가 `refresh`를 구조 분해하지 않아 **호출부가 0개**다.

## 분류 결과

같은 파일 안에서 패턴·사용자 영향이 완전히 동일한 호출부는 한 행에 라인을 모두 나열하고 `건수`로 표기했다.
행 수는 68개, 합계 건수는 145개다.

### Class A — 죽은 판정 (교정 대상)

| 파일:라인 | 건수 | refresh 출처 | 클래스 | 사용자 영향 | 조치 |
| --- | :--: | --- | :--: | --- | --- |
| (해당 없음) | 0 | — | A | — | — |

**A가 0인 근거 (실측).** `try { …refresh… } catch`·`refresh().catch()` 형태를 정규식으로 전수 조회한 결과
"refresh 자체의 실패를 판정하는" 블록은 아래 3곳뿐이었고, 셋 다 A가 아니다.

- `app/components/NotificationBell.vue:33-41`(`try`는 33-35, `catch`는 35-40, 함수 종료는 41) — `try { await refresh() } catch`. 그러나 이 `refresh`는
  `useNotifications.ts:55`의 `$apiFetch` 함수라 **정상 reject**한다. → Class D.
- `app/components/AppSidebar.vue:74-79` — `try/finally`(중복 호출 가드)일 뿐 catch가 없고, `refresh`도 `$apiFetch` 유래다. → Class D.
- `app/composables/costList/useCostPersistence.ts:174-198`(함수 정의는 174, `try`는 176, 본문 끝은 198) — `try/catch`가 있으나 **실패 판정은 `error.value` 기준**이고
  try/catch는 동기 예외 방어선이라고 주석에 명시돼 있다(ERR-11에서 이미 교정). → Class C.

**"쓰기 + 성공 토스트 + `await refresh()`"가 한 `try` 안에 들어 있는 다수 지점을 A로 넣지 않은 이유:**
그 catch는 **쓰기 실패에 대해서는 도달 가능**하며 실제로 필요한 분기다. 죽은 것은 "refresh 실패 시의 도달"뿐이고,
필요한 조치도 A의 처방("catch가 하던 안내를 새 분기로 옮긴다")이 아니라 B의 처방("쓰기는 반영됐고 목록만 못 불러왔다"는
별도 안내 + 재조회만 재시도)이다. 그러므로 전부 Class B로 분류했다. Task 3에서 **이 지점들의 기존 catch를 제거하지 마라.**

### Class B — 조용한 낡음 (교정 대상, 84건)

| 파일:라인 | 건수 | refresh 출처 | 클래스 | 사용자 영향 | 조치 |
| --- | :--: | --- | :--: | --- | --- |
| `app/composables/costList/useCostEditingState.ts` 경유 `useCostTerminalDialogs.ts:205,208` | 2 | `fetchCosts`(useApiFetch) | B | 단말기 저장 후 재조회 실패 시 `useCostEditingState.ts:141`의 `if (!list) return` 가드 때문에 로컬 `costs`가 **갱신 없이 그대로 남는다**(진짜 stale) | 교정 |
| `app/composables/costList/useCostExcelTransfer.ts:214` | 1 | `fetchCosts` | B | 일괄 업로드 "N건 성공" 토스트가 나가지만 표는 업로드 전 데이터 그대로 | 교정 |
| `app/components/council/schedule/ScheduleInput.vue:200` | 1 | `fetchMySchedule` | B | "제출 완료" 토스트 후 `myScheduleData=undefined` → `isSubmitted`(`:109`)가 **false로 뒤집혀 미제출로 표시**되고, `watch`(`:98`)의 null 가드로 선택 슬롯은 남아 화면이 자기모순 상태가 된다 | 교정 |
| `app/pages/project/payment/[docNo].vue:112,141,267,296` | 4 | `fetchPayment` | B | 저장/제출/완료확정 성공 토스트 직후 `watch(detail)`(`:86`)가 `undefined`를 받아 **입력 폼이 빈 값으로 초기화**된다 | 교정 |
| `app/pages/project/contract/[docNo].vue:126,155,229,258` | 4 | `fetchContract` | B | 위와 동일(입찰/계약 상세) | 교정 |
| `app/pages/project/deliberation/[docNo].vue:123,152,243,272` | 4 | `fetchDeliberation` | B | 위와 동일(과업심의 상세) | 교정 |
| `app/pages/project/estimate/[docNo].vue:195,218,349,372` | 4 | `fetchEstimate` | B | 위와 동일(소요예산 산정 상세) | 교정 |
| `app/components/council/qna/CouncilQna.vue:91,158,227` | 3 | `fetchQnaList` | B | 질의 등록/수정/답변 "완료" 토스트 후 Q&A 목록이 비어 등록 실패로 오인 | 교정 |
| `app/components/council/mainqna/MainQnaSection.vue:75,125,176,201` | 4 | `fetchMainQnaList` | B | 위와 동일(본회의 Q&A) | 교정 |
| `app/components/council/notice/CouncilNotice.vue:126,188` | 2 | `fetchFiles` | B | 업로드/삭제 "완료" 토스트 후 첨부 목록이 비어 다시 업로드를 시도하게 됨(중복 업로드 유발) | 교정 |
| `app/components/council/result/ResultForm.vue:112` | 1 | `fetchResult` | B | "저장 완료" 후 결과서 폼 값이 사라지고 `emit('saved')`는 그대로 발생 | 교정 |
| `app/components/board/BoardCommentTree.vue:94,113,138,154` | 4 | `useBoardComment`(useApiFetch, `useBoardComment.ts:27`) | B | 댓글 등록/대댓글/수정/삭제 후 입력창은 비워지고 댓글 트리가 사라져 실패로 오인 | 교정 |
| `app/pages/budget/work.vue:615`(호출 2개, 한 줄에 병기) | 2 | `useApiFetch`(`:513`,`:522` 직접 호출) | B | "N건 처리" 토스트 직전 `Promise.all([refreshSummary(), refreshProjectSummary()])` 미판정 → 편성 결과 표가 비거나 응답 body로 덮어쓴 값만 남아 서버 상태와 불일치 | 교정 |
| `app/pages/guide/index.vue:430,461` | 2 | `fetchGuideDocuments` | B | 가이드 저장/삭제 성공 토스트 후 단계 목록이 사라지고, `:461`은 삭제 성공 토스트보다 먼저 실행돼 삭제 여부를 알 수 없게 됨 | 교정 |
| `app/pages/approval/list.vue:228,302` | 2 | `fetchApprovals` | B | 일괄 결재·회수 성공 후 결과 Dialog는 뜨지만 결재 목록이 비어 처리 결과를 확인할 수 없음 | 교정 |
| `app/pages/admin/codes.vue:156,381` | 2 | `fetchCodes` | B | `useAdminTableEdit.onBatchSave` 안. 저장/업로드 성공 토스트 직전 재조회 실패 → 편집 모드는 종료되고 표는 빈 상태 | 교정 |
| `app/pages/admin/users.vue:114` | 1 | `fetchUsers` | B | 위와 동일 | 교정 |
| `app/pages/admin/roles.vue:93` | 1 | `fetchRoles` | B | 위와 동일 | 교정 |
| `app/pages/admin/auth-grades.vue:93` | 1 | `fetchAuthGrades` | B | 위와 동일 | 교정 |
| `app/pages/admin/organizations.vue:97` | 1 | `fetchOrganizations` | B | 위와 동일 | 교정 |
| `app/pages/admin/routes/index.vue:53` | 1 | `fetchAllRoutes` | B | 위와 동일 | 교정 |
| `app/pages/admin/boards/index.vue:67,92` | 2 | `useBoard`(useApiFetch, `useBoard.ts:25`) | B | 게시판 저장/삭제 성공 토스트 후 게시판 목록이 사라짐 | 교정 |
| `app/pages/admin/menus/index.vue:94,107,125` | 3 | `fetchAdminTree` | B | 메뉴 저장/삭제/이동 후 관리 트리가 비어 작업 결과를 확인할 수 없음 | 교정 |
| `app/pages/admin/menus/index.vue:95,108,126` | 3 | `useMenu`(useApiFetch, `useMenu.ts:88`) | B | 사이드바 메뉴 트리가 비어 **전역 내비게이션이 사라짐**(가장 파급이 큼) | 교정 |
| `app/pages/info/documents/[id]/index.vue:236,266,410,461,462,560,561` | 7 | `fetchDocument`·`fetchFiles` | B | 첨부 업로드/삭제·저장·새 버전 생성 성공 토스트 후 본문 또는 첨부 목록이 사라짐. `:461/:462`, `:560/:561`은 두 재조회를 연달아 호출하며 둘 다 미판정 | 교정 |
| `app/pages/info/documents/list.vue:88` | 1 | `fetchDocuments` | B | "삭제 완료" 토스트 후 목록이 비어 전량 삭제로 오인 | 교정 |
| `app/pages/info/plan/[id].vue:239` | 1 | `fetchPlan` | B | 계획 텍스트 저장 후 `isEditing=false`로 조회 모드 전환되는데 상세가 비어 저장 실패로 오인 | 교정 |
| `app/pages/info/council-request/index.vue:284,383` | 2 | `fetchCouncilList`·`fetchSkipRequests` | B | `:284`는 신규 협의회 생성 후 목록 갱신 없이 상세로 이동(복귀 시 빈 목록), `:383`은 판정 상신 성공 토스트 후 두 목록이 함께 비워짐 | 교정 |
| `app/pages/info/council-request/[id].vue:293,413,586,655` | 4 | `fetchCouncil`·`fetchSkipRequest` | B | 생략 처리·생략 판정 요청·작성완료·결재 요청 성공 안내 후 협의회 상세가 비어 단계 전이 결과를 확인할 수 없음. `:586`은 재조회 실패 상태에서 결재 Dialog를 그대로 연다 | 교정 |
| `app/pages/info/council-request/prepare/[id].vue:241,290,300,328,362` | 5 | `fetchCouncil` | B | 결과서 확정·위원 확정·일정 확정·개최·완료 성공 토스트 후 상세가 비어 탭 전환 대상 상태를 판단할 수 없음 | 교정 |
| `app/pages/info/council-request/prepare/[id].vue:281,292` | 2 | `ScheduleStatus`가 `defineExpose`한 `refreshStatus`(`ScheduleStatus.vue:47`) | B | 일정 제출·위원 확정 후 응답 현황(전체/미응답 수)이 0으로 표시되어 미응답으로 오인 | 교정 |
| `app/pages/info/council-request/result/[id].vue:288,324,362` | 3 | `fetchCouncil` | B | 결재 요청·결과서 작성 시작·추진부서 통보 성공 토스트 후 상세가 비어 다음 버튼 노출 조건이 무너짐 | 교정 |
| `app/pages/info/council-request/result/[id].vue:379,383,387,391` | 4 | `fetchCouncil` | B | 자식 컴포넌트의 쓰기 성공 이벤트(`onScheduleSubmitted`/`onEvaluationSubmitted`/`onResultSaved`/`onResultConfirmed`) 직후 재조회 미판정. 자식이 이미 성공 토스트를 띄운 상태라 전형적 "성공 안내 + 낡은 화면" | 교정 |

**B 소계: 84건.**(`app/pages/budget/work.vue:615`는 한 줄에 `refreshSummary()`·`refreshProjectSummary()` 2개 호출이 있어 2건으로 계수했다 — Minor 6 정정)

### Class C — 의도된 무시 / 오인 유도 없음 (조치 없음, 35건)

근거 유형을 3가지로 나눠 표기했다. `C-1`만 계획서가 말한 "문서화된 계약"이고, `C-2`·`C-3`은 그와 다른 근거이므로 구분한다.

- **C-1** `it_frontend/CLAUDE.md` §2 "폴링·배지처럼 비핵심 백그라운드 조회는 마지막 정상 상태를 유지할 수 있다"에 해당.
- **C-2** 이미 `error` **상태 기준으로 판정**하고 있음(예외 기반이 아니므로 ERR-13 오용이 아님).
- **C-3** 쓰기 성공 안내가 선행하지 않는 재조회. 실패해도 "성공했다"는 신호를 주지 않고, `data`가 비워진다.
  `useApiFetch`의 `onRequestError`(`:140`)·`onResponseError`(`:167`)는 네트워크 오류·403·404·5xx에서만 오류 Toast를 띄우므로
  이 범위의 실패는 사용자가 인지하지만, GET에 400/409/422 같은 그 외 4xx가 오면 Toast 없이 화면만 비게 된다.

| 파일:라인 | 건수 | refresh 출처 | 클래스 | 사용자 영향 | 조치 |
| --- | :--: | --- | :--: | --- | --- |
| `app/composables/costList/useCostPersistence.ts:177` | 1 | `fetchCosts` | C-2 | 없음. `attemptRefresh`(`:175`)가 `error.value`로 판정해 `refreshFailedAfterSave` 배너 + Toast를 띄우고 재조회만 재시도한다(ERR-11 교정 완료) | 없음 |
| `app/composables/useBoardAttachments.ts:199,236` | 2 | `useApiFetch`(`useBoardAttachments.ts:121`) | C-2 | 없음. 실패가 `error` computed(`operationError ?? loadError`)에 담기고 `app/pages/board/[blbMngNo]/[nacMngNo]/edit.vue:229`가 이를 렌더링한다. `form.vue`는 이 목록을 표시하지 않아 영향 없음 | 없음 |
| `app/composables/useBoardAttachments.ts:157` | 1 | 동일 | C-3 | 게시물 전환 시 초기 로드. 쓰기 선행 없음 | 없음 |
| `app/components/council/committee/CommitteeSelector.vue:381` | 1 | `fetchCommittee` | C-2 | `v-else-if="fetchError"` 블록 안의 [다시 시도] 버튼. 재시도 실패 시 오류 블록이 그대로 유지된다 | 없음 |
| `app/pages/budget/summary.vue:194` | 1 | `fetchSummary` | C-2 | 위와 동일(`v-else-if="error"` 블록의 [다시 조회]) | 없음 |
| `app/pages/budget/comparison.vue:217,284` | 2 | `fetchComparison` | C-2 | 위와 동일 | 없음 |
| `app/pages/project/payment/index.vue:164`·`estimate/index.vue:291`·`deliberation/index.vue:163`·`contract/index.vue:157`·`bizplan/index.vue:170` | 5 | 각 `fetchXxx` | C-3 | 툴바 [새로고침] 버튼. 실패 시 목록이 비고 `useApiFetch` 오류 Toast가 뜬다. 성공 안내 없음 | 없음 |
| `app/pages/approval/list.vue:387` | 1 | `fetchApprovals` | C-3 | 위와 동일 | 없음 |
| `app/pages/info/council-request/index.vue:606` | 1 | `fetchCouncilList` | C-3 | 위와 동일 | 없음 |
| `app/pages/info/documents/list.vue:187` | 1 | `fetchDocuments` | C-3 | 위와 동일 | 없음 |
| `app/pages/approval/list.vue:92` | 1 | `fetchApprovals` | C-3 | KeepAlive `onActivated` 재조회 | 없음 |
| `app/pages/info/projects/index.vue:61`·`info/projects/[id].vue:61` | 2 | `fetchProjects`·`fetchProject` | C-3 | 동일 | 없음 |
| `app/pages/info/plan/index.vue:33`·`info/plan/[id].vue:57` | 2 | `fetchPlans`·`fetchPlan` | C-3 | 동일 | 없음 |
| `app/pages/info/cost/[id].vue:40`·`info/cost/terminal/[id].vue:25` | 2 | `fetchCost` | C-3 | 동일 | 없음 |
| `app/pages/info/documents/list.vue:44` | 1 | `fetchDocuments` | C-3 | 동일(첫 활성화 스킵 가드 있음) | 없음 |
| `app/pages/info/documents/[id]/index.vue:148,149` | 2 | `fetchDocument`·`fetchFiles` | C-3 | 동일. 같은 `onActivated`의 `try/catch`는 `$apiFetch`인 `fetchVersionHistory` 전용이라 유효하다 | 없음 |
| `app/pages/budget/approval.vue:115,116` | 2 | `fetchProjects`·`fetchCosts` | C-3 | 동일 | 없음 |
| `app/pages/budget/list.vue:95`(호출 3개, 한 줄에 병기) | 3 | `fetchProjects`×2·`fetchCosts` | C-3 | 동일. `onActivated`(`:104-106`)가 호출하는 `refreshBudgetList` 래퍼(`:94-96`) 내부의 `Promise.all([refreshProjects(), refreshOrdinary(), refreshCosts()])`가 재조회 3건을 수행한다 | 없음 |
| `app/composables/costList/useCostEditingState.ts:198` | 1 | `fetchCosts` | C-3 | 동일. 별건으로 **FE-16(Task 4)**이 편집 모드 억제를 다루므로 ERR-13에서는 손대지 않는다 | 없음 |
| `app/pages/board/[blbMngNo]/index.vue:41` | 1 | `searchPosts` | C-3 | KeepAlive 재조회 | 없음 |
| `app/pages/board/[blbMngNo]/index.vue:71,78` | 2 | `searchPosts` | C-3 | 검색·페이징 조건 변경 재조회. 쓰기 선행 없음 | 없음 |

**C 소계: 35건** (C-1 0건, C-2 7건, C-3 28건).(`app/pages/budget/list.vue:95`는 한 줄에 `refreshProjects()`·`refreshOrdinary()`·`refreshCosts()` 3개 호출이 있어 `work.vue:615`와 같은 방식(호출 단위)으로 3건으로 계수했다. 같은 함수의 `:105`는 그 호출을 감싼 래퍼 `refreshBudgetList()`를 부르는 지점일 뿐 `refresh`를 직접 호출하지 않아 계수에서 제외했다 — 재리뷰 지적 반영)

> **C-1이 0건이라는 점을 명시한다.** 계획서의 C 정의는 "폴링·배지"를 전제하는데,
> 실제 폴링·배지 경로(`AppSidebar`·`NotificationBell`·`usePendingApprovalCount`·`useApprovalDashboard`)는
> 전부 `$apiFetch` 기반이라 **Class D**로 빠졌다. 즉 "문서화된 계약"만으로 제외된 항목은 하나도 없다.

### Class D — 해당 없음 (`useApiFetch` 유래 아님, 26건)

| 파일:라인 | 건수 | refresh 출처 | 클래스 | 사용자 영향 | 조치 |
| --- | :--: | --- | :--: | --- | --- |
| `app/composables/useApiFetch.ts:171` | 1 | `useAuth().refresh` → `stores/auth.ts`(`$fetch`) | D | 토큰 갱신. 정상 reject하며 `finally`로 플래그를 해제한다 | 없음 |
| `app/plugins/auth.ts:110` | 1 | 동일 | D | 동일 | 없음 |
| `app/composables/useNotifications.ts:132` | 1 | 자체 `$apiFetch`(`:55`) | D | 폴링 `.catch()`가 **실제로 동작**한다. 과거 오탐으로 등록된 지점 | 없음 |
| `app/components/NotificationBell.vue:34` | 1 | 동일 | D | `safeRefresh`의 `try/catch`가 정상 동작해 warn Toast를 띄운다 | 없음 |
| `app/composables/usePendingApprovalCount.ts:105` | 1 | 자체 `$apiFetch`(`:91`) | D | 내부에서 catch 후 `console.warn`. 문서화된 배지 계약 | 없음 |
| `app/components/AppSidebar.vue:75,89,95` | 3 | `usePendingApprovalCount().refresh` | D | 라우트 전환·60초 폴링 배지 갱신 | 없음 |
| `app/composables/useApprovalDashboard.ts:165` | 1 | `refreshApprovalBadgeCount`(`:132`, `$apiFetch`) | D | 배지 마운트 조회 | 없음 |
| `app/pages/approval/list.vue:230,303,305` | 3 | `refreshApprovalBadgeCount`·`refreshPendingApprovalCount` | D | 배지 갱신. 내부 catch로 비즈니스 성공을 실패로 만들지 않는다 | 없음 |
| `app/pages/budget/report.vue:389` | 1 | `refreshPendingApprovalCount` | D | 동일 | 없음 |
| `app/pages/project/estimate/[docNo].vue:70,219,373` | 3 | 자체 `$apiFetch`(`:51`) | D | `projectError` 상태로 판정한다 | 없음 |
| `app/pages/project/bizplan/[abusMngNo].vue:85,504,582` | 3 | 자체 `$apiFetch`(`:71`) | D | `projectLoadError` 상태로 판정하고 `:582`에 [다시 불러오기] 제공 | 없음 |
| `app/pages/guide/index.vue:204,331,368,485,756` | 5 | 자체 `$apiFetch`(`:247`) | D | `attachmentLoadError` 상태로 판정한다. 주석에 `useApiFetch`를 쓰지 않는 이유가 명시돼 있다 | 없음 |
| `app/components/AppHeader.vue:212,215` | 2 | Nuxt `refreshNuxtData` | D | 구조 분해 `refresh`가 아니다. 탭 이동 시 전역 재조회이며 성공 안내가 선행하지 않는다 | 없음 |

**D 소계: 26건.**

### 총계

- 총 조사 호출부: **145개** (A: **0**, B: **84**, C: **35**, D: **26**)
- Task 3의 교정 범위 = Class B 84건 (A는 없음).

## 교정 우선순위

Class A가 없으므로 계획서의 우선순위 1번(사용자 안내가 잘못 나가는 A 지점)은 해당 없음이다.
아래는 Class B 안에서 **재조회 실패가 "빈 화면"이 아니라 "낡은 값·뒤집힌 상태"로 나타나는 순서**로 정렬했다.
이 순서를 정한 실측 근거는 각 화면이 서버 `data`를 로컬 복사본에 옮길 때 null 가드를 두는지 여부다.

1. **`app/composables/costList/useCostTerminalDialogs.ts:205,208` + `useCostExcelTransfer.ts:214`** —
   `useCostEditingState.ts:141`의 `if (!list) return` 때문에 재조회가 실패해도 로컬 `costs`가 갱신 없이 유지된다.
   145건 중 **유일하게 "낡은 목록을 최신으로 오인"이 문자 그대로 성립**하는 지점이다.
   같은 파일의 `useCostPersistence.attemptRefresh`가 이미 올바른 처방을 갖고 있으므로 **그 헬퍼를 재사용**하면 된다.
2. **`app/components/council/schedule/ScheduleInput.vue:200`** — `isSubmitted`가 false로 뒤집혀 이미 제출한 일정을
   "미제출"로 표시한다. 사용자가 중복 제출을 시도할 수 있는 상태 오표시다.
3. **`app/pages/admin/menus/index.vue:95,108,126`(`useMenu().refresh`)** — 실패 시 사이드바 메뉴 트리 전체가 비어
   전역 내비게이션이 사라진다. 파급 범위가 화면 하나에 그치지 않는다.
4. **문서·협의회 다단계 화면** — `info/documents/[id]/index.vue`(7건),
   `council-request/{[id],prepare/[id],result/[id]}`(18건). 성공 토스트로 단계 전이를 알린 직후 상세가 비어
   다음 단계 버튼 노출 조건이 무너진다. 결재·상신처럼 되돌리기 어려운 액션이 포함된다.
5. **쓰기 후 상세 폼이 초기화되는 프로젝트 상세 4종** — `payment`·`contract`·`deliberation`·`estimate`의 `[docNo].vue`(16건).
   저장 성공 토스트 직후 폼이 빈 값이 되어 "저장이 날아갔다"는 오해를 부른다.
6. **관리자 표 일괄 저장 7화면**(`admin/*`, 9건) + **목록·첨부 계열**(나머지). 패턴이 동일해 기계적으로 처리 가능하다.

## 조치 없음 근거

- **Class C-2 (7건)** — `useCostPersistence.attemptRefresh`, `useBoardAttachments`(`edit.vue:229` 렌더),
  오류 블록 안의 [다시 조회]/[다시 시도] 버튼(`summary.vue:194`, `comparison.vue:217,284`, `CommitteeSelector.vue:381`).
  모두 예외가 아니라 `error` **상태**로 실패를 판정하고 화면에 남긴다. ERR-13이 문제 삼는 "예외 기반 죽은 판정"이 아니다.
- **Class C-3 (28건)** — `onActivated` 재조회, 툴바 [새로고침], 검색·페이징 조건 변경, 부모 전환 시 초기 로드.
  **쓰기 성공 안내가 선행하지 않으므로 "성공 안내 + 낡은 화면"이라는 오인 구조 자체가 성립하지 않는다.**
  실패 시 `data`가 `undefined`로 초기화되어 화면이 비고, `useApiFetch.ts:140/167`의 Toast가 네트워크·403·404·5xx는 알린다.
  다만 이 범위 밖의 4xx(예: GET 요청에 대한 400/409/422)는 Toast 없이 빈 화면만 남는다.
- **Class D (26건)** — `$apiFetch`/`$fetch`/`refreshNuxtData` 기반이라 `useAsyncData` 계약을 따르지 않는다.
  `$apiFetch` 계열은 **정상 reject**하므로 기존 `try/catch`·`.catch()`가 그대로 유효하다.
  배지·폴링 계열(`usePendingApprovalCount`, `useApprovalDashboard`, `useNotifications`)은 내부에서 catch 후
  `console.warn`만 남기는데, 이는 `it_frontend/CLAUDE.md` §2 "폴링·배지처럼 비핵심 백그라운드 조회는 마지막 정상 상태를
  유지할 수 있지만 진단 로그는 보장한다"에 부합한다.

## Task 3 실행자에게 남기는 주의

1. **A는 없다.** 계획서 Task 3 Step 1의 "Class A 처방"은 적용 대상이 없다.
   B 지점의 기존 `catch`는 **쓰기 실패용으로 여전히 필요하다. 제거하지 마라.**
2. **B 84건은 한 태스크에 담기 어렵다.** 계획서는 "교정한 각 지점에 최소 1개 테스트"를 요구한다.
   위 우선순위 1~3(6건)을 먼저 지점별 테스트와 함께 처리하고, 4~6은 화면·도메인 단위 커밋으로 분할하거나
   잔여분을 `TASK.md`에 별도 항목으로 등록할 것을 권한다. 진행 방침은 사용자 확인이 필요하다.
3. **테스트 mock은 "resolve + `data`를 `undefined`로 초기화 + `error` 세팅"이어야 한다.**
   `data`를 비우지 않는 mock은 위 1번 우선순위(로컬 복사본 stale)를 재현하지 못한다.
4. **중복 알림에 주의하라.** 재조회 실패 시 `useApiFetch`가 이미 Toast를 띄우므로(네트워크·403·404·5xx),
   교정으로 추가하는 안내가 그대로 겹친다. FE-17(Task 5)의 `suppressNetworkError` 선택 패턴과 함께 판단해야 한다.
5. `useCostEditingState.ts:198`은 **FE-16(Task 4)**의 대상이다. ERR-13에서 중복 수정하지 마라.
