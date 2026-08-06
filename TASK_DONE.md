# ✅ IT Portal 완료·종료 내역 (Archive)

> 🗓️ **기준일:** 2026-07-30
> 🎯 **목적:** [`TASK.md`](TASK.md)에서 분리한 완료(✅)·해소(✔️)·감내(☑️)·폐기(⛔) 항목을 보관합니다.

### 🔑 범례 (Legend)

| 상태 | 의미 |
| :--: | --- |
| ✅ Done | 완료 |
| ✔️ Resolved | 해소(거짓양성 등) |
| ☑️ Accepted | 감내(업스트림 미해결) |
| ⛔ Discarded | 사용자 범위 결정으로 폐기 |

---

## 🗂️ 진행 중에서 종료된 항목 (영역별)

### ✅ 2026-08-06 잔여과제 저비용 배치 1 (ERR-14·BE-34·FE-21·FE-30①)

> 설계 `docs/superpowers/specs/2026-08-06-task-quickfix-batch1-design.md`, 실행 계획 `docs/superpowers/plans/2026-08-06-task-quickfix-batch1.md`을 실행했다. 세 항목이 계획이 상정한 것과 다른 결말을 맞았다 — **ERR-14는 고친 것이 아니라 이미 해소돼 있었고 `TASK.md`의 근거가 낡아 있었다.** **BE-34는 증상 자체가 재현되지 않아 재현 불가로 종결했다**(애노테이션은 유지하되 원인 해결로 단정하지 않는다). **FE-30①은 계획이 상정한 명시 `key` 분리가 불필요한 것으로 드러났다.**
>
> 최종 검증: `npm run format:check`·`npm run lint`·`npm run typecheck`(0 errors)·`npm run codegen:check` 통과, 프론트 단위 테스트 **2374/2374(195파일)** 통과, `./gradlew check` 통과(2589 tests, JaCoCo 97%/88%). `npm run test:e2e`는 계획대로 실행하지 않았다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✔️ Resolved | ERR-14 | **재현 불가(분기 A)로 종결** — 고친 것이 아니라 이미 해소돼 있었다. `useApiFetchRefreshCoordinator.ts:45-57`의 `phase === 'retrying' → terminateCycle` 경로가 이미 401 재조회 루프를 끊는다: 401 → 갱신 성공 → 재조회 → 401이 오면 새 주기를 열지 않고 세션을 종료한다. **`TASK.md`의 근거가 낡아 있었다** — 지목했던 `useApiFetch.ts`의 `isRefreshing`·`tokenRefreshSignal`은 저장소에 더 이상 존재하지 않는다(401 처리가 그 사이 코디네이터로 분리됨). 회귀 방지로 특성화 테스트 3건을 추가하고 그 분기가 의도된 상한임을 코드 주석으로 고정했다 | it_frontend `ad2fa0b`, `c977de3` | `tests/unit/composables/useApiFetchRefreshCoordinator.test.ts` 신규 3건 통과. 리뷰어가 독립 추적으로 vacuous가 아님을 확인 — 재시도 파동이 부른 401이 같은 주기의 'retrying' phase를 만나 `refresh` 1회 / `terminateSession` 1회로 종료하는 경로를 테스트가 실제로 지난다 |
| ✔️ Resolved | BE-34 | **재현 불가로 종결(사용자 결정).** 실행 중이던 백엔드(IDE 산출물 `bin\main`, `@ParameterObject` 미적용)와 `./gradlew bootRun`으로 띄운 백엔드(적용, 포트 28081) 두 스펙을 파라미터명·개수까지 비교한 결과 완전히 동일했고 양쪽 모두 `arg0`이 **0건**이었다. 6개 오퍼레이션 전부 실제 필드명으로 전개된다(예: `getProjects` → `apfSts, bseYy, stsTc, bzTpC, dvmDpmC, svnDpmC, odnYn`). 커밋돼 있던 `api.d.ts`의 파라미터명도 `arg0`이 아니라 `condition`이었다 — 래퍼 객체 참조였을 뿐이다. 통제군·처치군이 동일하므로 **`@ParameterObject` 애노테이션이 정상화의 원인이 아니다** — 근본 원인(CGLIB 프록시 여부)은 **미확인**으로 남는다 — 증상 자체가 재현되지 않아 원인 조사를 수행하지 않았다. 계획이 적어둔 actuator `beans` 확인은 **시도하지 않았다**(기본 노출 설정이 `management.endpoints.web.exposure.include=health,metrics`라 그 엔드포인트는 열려 있지 않다). 다시 `arg0`이 관측되면 이 실측이 재관측의 출발점이다. `@ParameterObject` 6곳은 springdoc이 POJO 쿼리 파라미터에 권장하는 명시적 선언이고 바인딩 불변·테스트 통과로 무해해 **유지**한다(사용자 결정, 원인 해결이라 단정하지 않음) | it_backend `d7f924e2` (부수 성과: `api.d.ts` 재생성 it_frontend `35d7c85`) | 컨트롤러 6개 지점 전부 `@ParameterObject` 적용 확인, `@ModelAttribute`·`@PageableDefault` 속성 보존, `./gradlew test` 대상 컨트롤러 테스트 58건 통과. 두 백엔드 인스턴스(28080 IDE 기동·28081 `bootRun`)의 `/v3/api-docs` 비교로 `arg0` 0건·완전 동일 실측. `api.d.ts` 재생성으로 paths 160 불변, schemas 234 → **229**(래퍼 DTO 5개 제거: `ProjectSearchCondition`·`FileDto.SearchCondition`·`CostSearchCondition`·`BoardPostSearchCondition`·`Pageable`), 소비처 영향 0(`npm run check` clean) |
| ✅ Done | FE-21 | `useMentionAutocomplete.ts`·`useGlobalSearch.ts` 두 곳에 요청 시퀀스 토큰을 도입했다. 토큰을 요청 시작 전에 캡처하고 모든 `await` 이후 비교한다. `items`/`suggestions`뿐 아니라 `searchLoading`·`searchError`, `close()`까지 판정 대상으로 포함했다. `GlobalSearchBar.vue`에 디바운스는 **추가하지 않았다** — 가드로 경합이 사라지고, 디바운스는 입력 반응성에 영향을 주는 별개 결정이라 분리했다. 같은 가드의 순서 역전 검증 테스트 공백이던 FE-28②가 함께 소진됐다 | it_frontend `8905cc5`, `082a251`, `f8c6f2d` | `useMentionAutocomplete.test.ts`·`useGlobalSearch.test.ts` 전량 통과. 리뷰어가 `items`(154-156)·`searchLoading`(finally 164)·`searchError`(catch 159-161)·`close()`(238) 네 지점 전부 확인. 변이 검증: 낡은 응답이 최신 요청 진행 중 도착하는 신규 테스트에서 가드 제거 시 해당 테스트만 실패, 나머지는 통과 |

> **FE-30①(참고, ID는 `TASK.md`에 존속)**: `useApprovalDashboard`·`useDocumentDashboard` 두 파사드가 `useApiFetch` 반환 필드 7개(`data`·`pending`·`error`·`status`·`refresh`·`runWithErrorToastSuppressed`·`enableKeepPreviousData`)를 노출하도록 완료했다(it_frontend `989d48e`). **계획이 상정한 명시 `key` 분리는 불필요한 것으로 드러나 도입하지 않았다** — 두 URL의 소비처가 각각 1곳뿐이고(`approval/index.vue`, `info/documents/index.vue`) 사이드바 배지는 별도 엔드포인트를 써서 키 공유가 없다. FE-30 자체는 ②(FE-19 grandfather 규칙 단위 전환)가 남아 `TASK.md`에서 계속 추적한다.
>
> **병합·`versions.lock` 보류**: it_frontend `feature/task-quickfix-batch1`, it_backend `feature/be34-openapi-parameter-names` 두 브랜치 모두 `main` 병합과 `scripts/update-versions-lock.ps1` 갱신을 사용자 판단으로 보류했다 — 사용자가 같은 브랜치에서 동시에 작업 중이라 지금 병합하면 작업물이 섞인다.

### ✅ 2026-08-06 CQ-01 대형 서비스 분해·BE-30 결정론 보완

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | CQ-01 | `CouncilController` 분해에 이어 서비스 3개를 도메인 경계로 분리: `ProjectService` 1549→670 (`ProjectQueryService` 104, `ProjectQueryAssembler` 283), `CostService` 1159→351 (`CostQueryService` 96, `CostQueryAssembler` 527, `CostTerminalAssembler` 148), `BudgetWorkService` 1156→77 (`BudgetRateApplicationService` 263, `BudgetSummaryService` 355, `BudgetProjectSummaryService` 351, `BudgetIoeCatalog` 50). 신규 운영 소스는 모두 800줄 이하이며 ratchet 기준선은 `ProjectDto` 1070, `CouncilDto` 990, `AdminService` 866, `ApplicationService` 852, `CostDto` 801 다섯 개만 남았다. | backend `f80b5b8`, `c35945d`, `24e139e`, `659041a`, `19b0a90`, `4e491b1`, `15f09b33`; frontend `b014ec4`, `acf0d60` | backend `./gradlew check --rerun-tasks`: 2580 tests, 0 failure/error, 1 skipped. `./gradlew integrationTest --rerun-tasks`: 107 tests 중 103 pass, 4 skipped, 0 failure/error. 격리 포트 28083에서 OpenAPI paths 160/schemas 234 및 `npm run codegen:check` 통과. 두 프론트 생성 커밋은 선언 순서만 동기화했고 API 의미 변경은 없다. `npm run format:check`·`npm run check` 통과. |
| ✅ Done | BE-30 | 동일 표시명 그룹의 ioeC·편성률을 encounter order가 아니라 최신 대표행에서 함께 취하도록 고정했다. | backend `e206cf0` | 대표행의 `bgNo` 우선순위와 동일 행 값 연결을 서비스 계약 테스트로 검증했고, 전체 `integrationTest` 게이트도 통과했다. |

> **프론트 테스트 감내:** 전체 `npm test` 2282건 중 2277건 통과, 실패 5건은 CQ-01 이전부터 있던 범위 밖 항목으로 의도적으로 수정·마스킹하지 않았다(`admin/codes.vue` max-lines 1건, council-manager redirect 기대값 4건).
>
> **통합 게이트 정합화:** IAM 정확 계약 테스트의 `getPtCNm` 누락은 production CQ-01 범위 밖의 기존 assertion drift로, 별도 test-only 커밋 backend `d5221bab`에서 보정했다.
>
> **병합 후 정정(2026-08-06):** 위 "기준선 다섯 개" 서술은 병합 시점 기준 **네 개**다 — 같은 날 병렬로 진행된 BE-29(아래 절)가 공통코드 CRUD를 `AdminCodeService`로 추출해 `AdminService`를 866→581줄로 줄이면서 그 항목을 등재 해제했다. 현재 기준선은 `ProjectDto` 1070 · `CouncilDto` 990 · `ApplicationService` 852 · `CostDto` 801 네 개다.
>
> **`CouncilController` 분해의 스펙 영향 확인 완료(2026-08-06):** 분해 당시 "빈이 1개에서 7개가 되어 springdoc의 `paths` 순서가 달라질 수 있다"는 미확인 사항을 남겼는데, BE-31 작업에서 백엔드를 기동해 재생성한 결과 **`paths` 순서 변경은 0건**이었다. `codegen:check`도 드리프트 없음(paths 160 / schemas 234)으로 통과했다 — 이 분해로 인한 스펙 회귀는 없다.

### ✅ 2026-08-06 비-CQ 잔여과제 Quick Win (BE-26·BE-29·BE-31·FE-24·FE-33)

`TASK.md`에서 Clean Code 부채(CQ-\*)를 제외한 활성 항목을 전수 분류해, 설계 결정·DBA 협의·외부 의존 없이 코드로 끝낼 수 있는 것만 골라 상환했다. 계획·분류 근거는 `docs/superpowers/plans/2026-08-05-non-cq-quick-wins.md`.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | BE-29 | 공통코드 CRUD의 캐시 무효화 공백을 해소했다. `AdminService`의 코드 CRUD 5개(`getCodes`·`createCode`·`updateCode`·`deleteCode`·`bulkUpsertCodes`)와 private 헬퍼(`CodeKey`·`validateCodeKey`·`toCodeResponse`)를 신설 `AdminCodeService`(346줄)로 **순수 이동**하고, 쓰기 4개에 `CodeService.java:116-120`과 동일한 `@Caching(evict={budgetPeriod, codesByCid}, allEntries=true)`를 적용했다. `AdminController`는 배선만 바꿨고 URL·`@Operation`·`@PreAuthorize`·DTO는 불변이다. **애노테이션만 추가하는 최초 계획은 CQ-01 동결선과 충돌해 폐기했다** — `AdminService`가 866줄로 등재돼 있고 동결선은 실측과 기준값의 정확한 일치를 요구하므로 한 줄도 더할 수 없었다. 기준선 파일 11행이 "기준값 상향은 허용된 해소 수단이 아니다"라고 명시하고 8행이 "같은 PR에서 동등 이상 분량을 추출해 상쇄한다"를 지시하므로, 사용자 결정에 따라 추출로 상쇄했다. 결과적으로 `AdminService`가 866→**581줄**이 되어 800 이하로 내려가 **기준선 항목 자체를 삭제**했다(규약 9행). CQ-01의 "해당 도메인 기능 변경 착수 시 분해" 트리거 원칙과도 정합한다 | it_backend `699dbbb` | 이동 순수성을 기계적으로 재현 검증했다 — 이전 버전에서 공통코드 섹션을 추출해 `@Caching` 블록만 제거하고 diff한 결과 `EXIT:0`(애노테이션 외 한 글자도 다르지 않음). 리플렉션 회귀 테스트 `AdminCodeServiceCacheEvictTest`가 RED 4/4 → GREEN 4/4. 옮긴 테스트 10개가 1:1 대응하며 단언 내용 불변. self-invocation 없음 확인(`bulkUpsertCodes`가 다른 public 쓰기 메서드를 부르지 않아 프록시 우회 경로 없음). `common/admin` 전체에서 `Ccodem`/`CodeRepository` 참조가 `AdminCodeService`에만 남아 잔여 캐시 쓰기 경로 0건. `./gradlew clean test` + `jacocoTestCoverageVerification spotlessCheck` 모두 BUILD SUCCESSFUL, `MaxLinesRatchetTest` 6/6 통과. JaCoCo 클래스별 70% 규칙 때문에 테스트 4개를 추가했고, 그 과정에서 기존 `getCodes` 테스트가 `@DisplayName`이 약속한 이름 변환을 실제로는 단언하지 않던 것을 발견해 별도 테스트로 보강했다 |
| ✅ Done | BE-26 | `AdminService.getOrganizations`의 등록·변경자명 N+1을 제거했다. `toOrgResponse`가 행마다 단건 `resolveUserName(String)`을 호출하던 것을, 같은 클래스에 이미 있던 배치 헬퍼(`loadUserNameMap`/`resolveUserName(eno, map)`)를 써서 배치 조회 1회로 바꿨다. 같은 클래스의 로그인 이력 조회가 쓰던 모범형을 그대로 따랐다. **`TASK.md`가 우려하던 "동작 차이"는 실재하지 않았다** — 단건 경로의 `Optional.map(...).orElse(eno)`는 매핑 결과가 null이면 빈 Optional이 되어 `eno`를 돌려주므로, 배치 경로의 `getOrDefault(eno, eno)`와 결과가 같다. 이름이 null인 등록 사용자에 대해 신·구 경로가 동일하게 동작한다 | it_backend `b6f2c7b` | `getOrganizations_사용자명_배치조회_1회` 테스트가 RED(`WantedButNotInvoked` — 배치 메서드 미호출) → GREEN. `AdminDto.OrgResponse`의 record 필드 순서(`AdminDto.java:249-260`)와 새 `toOrgResponse`의 생성자 인자 순서를 1:1 대조해 완전 일치 확인(둘 다 String인 인자가 뒤바뀌어도 컴파일되므로 이 대조가 필수였다). `loadUserNameMap`이 빈 Set에 `Map.of()` 조기 반환하므로 조직 0건이면 쿼리 자체가 나가지 않음을 확인. `./gradlew check` BUILD SUCCESSFUL. `AdminService.java` 581→591줄(800 미만, ratchet 무관) |
| ✅ Done | BE-31 | 공통 첨부파일 API의 실제 파라미터는 `pkColNm`·`pkCone`인데 `GuideDocController`의 `@Operation(description=...)` 2곳이 레거시 `orcDtt`·`orcPkVl`로 안내하던 것을 정정하고, 프론트 생성 타입을 재생성했다. 이 문자열은 OpenAPI 스펙을 타고 `app/types/api.d.ts`에 실려 소비자가 잘못된 파라미터명을 따라 쓰게 했고, 실제로 `guide/index.vue`가 400을 받은 전례가 있다(2026-08-01 `fe5be3b`). 4-repo 규약대로 백엔드 계약 커밋 → 프론트 재생성 커밋 → `versions.lock` 순서로 처리했다 | it_backend `5a7b7b7` · it_frontend `4751211` · root `d2f7ff4` | 정정 전 `FileDto.SearchCondition`(L146·149·152)·`UpdateRequest`(L54·60)·`BulkDeleteRequest`(L127·133)와 `FileController`의 `@RequestPart("pkColNm")`/`("pkCone")`(L146-150)로 실제 파라미터명을 검증했다. 잔여 grep 결과 예산작업 도메인의 `orcPkVl`(BBUGTM 실제 필드명)과 화면의 지역 변수명만 남아 대상이 아님을 확인. `./gradlew check` BUILD SUCCESSFUL, `npm run codegen:check` 드리프트 없음(paths 160 / schemas 234), `npm run check` 클린. **CQ-01 후속 확인 동반 완료**: `CouncilController` 7분해로 인한 `paths` 순서 변경 0건 — 회귀 없음. 재생성 시 무관한 드리프트(객체형 쿼리 파라미터명 `arg0` 유실) 6건이 함께 드러나 `TASK.md` BE-34로 분리 등재했다 |
| ✅ Done | FE-24 | `admin/boards`가 재조회 보존을 잃었던 트레이드오프를 해소했다. `useBoard`가 키 없이 `${BASE}/boards/meta`를 열어 관리자 화면과 공개 게시판 화면이 같은 asyncData 키를 공유했고, Nuxt는 같은 키의 최초 인스턴스가 만든 `default`만 보관하므로 관리자 화면이 보존을 켜면 공개 화면까지 켜졌다. 그래서 ERR-13에서 `enableKeepPreviousData` 노출을 포기했고 관리자 화면은 재조회 실패 시 목록이 비었다. `useBoard(options?: { key?: string })`로 명시 키를 받아 `admin/boards`만 `'admin-board-meta'`를 열고 스위치를 노출했다. JSDoc 2곳(`useBoard.ts`·`admin/boards/index.vue`)의 비노출 사유 서술도 정정했다 | it_frontend `e04c4d6` · `80fe195` | RED(`expected '0' to be '1'` — 수정 전 재조회 실패 후 목록이 빔) → GREEN. **숨은 위험이던 `key: undefined` 동등성을 Nuxt 소스로 직접 확인**했다 — `node_modules/nuxt/dist/app/composables/fetch.js:74`가 `toValue(fetchOptions.key) \|\| "$f" + hash(...)`로 단순 속성 접근·`\|\|` 판정만 하므로 `'key' in options` 검사가 없고, 키 미전달과 `{ key: undefined }`가 같은 키를 만든다. 공개 화면 4개 호출부(`board/index.vue:13`·`[blbMngNo]/index.vue:24`·`form.vue:33`·`[nacMngNo]/index.vue:25`)가 전부 인자 없이 호출함을 확인. 기존 공개 화면 테스트가 그대로 통과. **회귀 가드 보강(`80fe195`)**: 최초 테스트 3개가 관리자 화면 단독 마운트로 "보존이 켜지는가"(증상)만 확인하고 "키 분리 유지"(원인)는 잡지 못하는 것을 리뷰가 지적해, 호출부 계약을 단언하는 가드를 추가했다. 두 화면 동시 마운트로 누출을 재현하는 방식은 테스트 대역(`tests/support/nuxtAsyncData.ts:228-244`)이 호출마다 독립 ref를 만들고 `options.key`를 실행 코드에서 읽지 않아 **구조적으로 불가능**함을 확인하고 근거를 테스트 주석에 남겼다 |
| ✅ Done | FE-33 | 게시판 첨부 업로드·삭제 성공 뒤의 목록 재조회가 가드의 `attemptRefresh`가 아니라 원시 `refresh()`를 호출해, 실패해도 `refreshFailed` 배너가 뜨지 않던 것을 고쳤다. 가드 생성 시점에 `enableKeepPreviousData()`가 켜져 있어 데이터는 보존됐지만 실패 판정은 `attemptRefresh`가 담당하므로, 사용자가 낡은 목록을 최신으로 오인하는 상태였다. `edit.vue`에 첨부 삭제 UI가 있어 실제로 밟히는 경로다. 두 호출부를 Class B 문구("쓰기는 반영되었고 목록만 못 불러왔다")와 함께 `attemptRefresh`로 전환하고, 미사용이 된 `refresh` 바인딩을 제거했다 | it_frontend `bf41a06` · `9e40218` | 삭제 경로 RED(`expected false to be true` — 배너 미렌더) → GREEN. `.message-stub`이 `edit.vue`의 첨부 배너(단일 `<Message v-if="attachmentsRefreshFailed">`)를 잡는 것이 맞고 게시물 본문 배너가 아님을 확인(거짓 통과 아님). `refresh` 바인딩 제거는 반환 객체에 노출된 적이 없고(`git show bf41a06^`로 확인) 소비처 의존도 0건이라 계약 무변경. **업로드 경로 가드 보강(`9e40218`)**: 두 호출부를 고쳤는데 배너 단언이 삭제 경로에만 있어 형제 호출부의 같은 회귀를 못 잡는다는 리뷰 지적에 따라, `uploadPendingFiles`를 실제로 호출하는(=`attemptRefresh`를 우회하지 않는) composable 단위 테스트를 추가했다. RED 확인 시 나머지 19개는 통과해 지적이 정확했음이 확인됐다 |

> **동반 문서 정정**: FE-24로 `it_frontend/CLAUDE.md` §2와 `docs/guides/architecture/api-client.md`의 "`useMenu`·`useBoard`는 스위치를 의도적으로 비노출" 서술이 사실과 달라져 정정했다(it_frontend `97f8f12`). 같은 문장이 `admin/menus`를 한 덩어리로 묶던 것도 갈랐다 — 그 화면에는 가드가 둘이고 사이드바(`useMenu`)는 보존이 꺼지지만 관리 트리(`fetchAdminTree`)는 켜진다.

> **미완료로 남긴 것**: FE-19(자동 수정분만 해소, `color-no-hex`·`selector-class-pattern` 잔여) · FE-22(옵션 도입 완료, 지점별 적용 잔여) · FE-30(③만 처리, ①② 결정 선행) — 셋 다 `TASK.md`에 잔여 범위를 명시해 남겼다. 실행 중 새로 등재한 것은 BE-34(OpenAPI 파라미터명 `arg0` 유실)다.

> **병합 시점에 확인한 두 가지**(2026-08-06):
> ① 실행 중 FE-34(프론트 `npm test` 선행 실패 2건 — `admin/codes.vue` max-lines 1건, council-manager redirect 4건)를 등재했으나, **병합 결과 194개 파일 2365개 테스트가 전부 통과**해 해소됐다. 이 브랜치는 해당 테스트도 대상 파일도 건드리지 않았으므로(`git diff main...HEAD`로 확인) 같은 기간 `main`에서 진행된 CQ-01 후속 작업이 함께 해소한 것이다. 그래서 `TASK.md`에서 FE-34를 제거했다.
> ② `api.d.ts`는 `main`도 병렬로 재생성해 병합에서 충돌했다. 생성물이므로 손으로 병합하지 않고 **병합된 백엔드를 기동해 `npm run codegen`으로 재생성**했다(`it_frontend` `30cfdca`). 재생성 결과는 `main` 대비 BE-31의 `@description` 2곳 정정과 스키마 프로퍼티 순서 noise뿐이었고 `codegen:check` 드리프트 없음으로 통과했다. **`arg0` 드리프트는 이 diff에 나타나지 않았다** — `main`이 이미 같은 상태였다는 뜻이며, BE-34가 이 브랜치와 무관한 선행 조건임이 재확인됐다.

### ✅ 2026-08-05 FE-31 admin/menus 관리 트리 가드 주석 정정

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | FE-31 | `app/pages/admin/menus/index.vue`(65~72행 → 76행)의 관리 트리 재조회 실패 가드 주석을 실제 동작에 맞춰 정정했다. 기존 주석은 "실패하면 `adminTree`가 undefined가 되어 좌측 편집 트리가 빈다"고 서술했으나, 실측 결과 `fetchAdminTree()`가 `useApiFetch` 반환 객체를 그대로 돌려주고 화면이 그것을 `useRefreshGuard`에 그대로 넘기므로(`useRefreshGuard.ts:204`) 가드 생성 시점에 `enableKeepPreviousData()`가 실제로 켜진다. 재조회 실패 시(401·403 제외) `adminTree`는 비지 않고 직전 정상값을 유지하므로 좌측 트리는 빈 트리가 아니라 낡은 값으로 남는다 — 정정한 주석은 이 사실과, 화면이 멀쩡해 보여 사용자가 낡은 값을 최신으로 오인하기 쉬우므로 배너가 오히려 더 중요하다는 점을 함께 서술한다. 주석 문구만 교체했고 동작 코드는 변경하지 않았다 | it_frontend `ec182bc` | `npm run format:check`·`npm run check`(typecheck+lint) 모두 클린 종료(오류 0건). 정정 전 `useAdminMenu.ts:38`의 `fetchAdminTree`가 `useApiFetch(...)`를 감싸지 않고 그대로 반환함과, `useRefreshGuard.ts:198,204`의 `keepPreviousData` 기본값 `true`·생성 시점 `enableKeepPreviousData()` 호출을 코드로 확인한 뒤 주석을 교체했다 |

### ✔️ 2026-08-01 Prettier 잔여 위반 해소 (CQ-20)

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✔️ Resolved | CQ-20 | ERR-13·FE-15~19 브랜치 이전부터 남아 있던 Prettier 포맷 드리프트 3개 파일(`app/composables/useAuth.ts`, `app/types/menu.ts`, `tests/unit/composables/useAdminMenu.test.ts`)이 별도 조치 없이 해소된 것을 확인했다 | — (별도 커밋 없이 해소 확인) | 2026-08-01 세 파일 모두 `npx prettier --check` 통과. 같은 시점 `npm run format:check`가 함께 보고한 2건(`useLatestRequest.test.ts`, `useProjectFormCodes.test.ts`)은 미커밋·미추적 작업 트리 파일이라 이 항목의 커밋된 부채가 아니었다 |

> **후속**: 2026-08-04 Wave B 실행 중 `app/pages/info/council-request/prepare/[id].vue`에서 같은 클래스의 드리프트가 **추가로** 발견돼 정리했다. 이 파일은 긴 줄이 풀리며 731→803줄로 실제 크기가 드러나 `TASK.md` CQ-15의 ratchet 기준선에 등록됐다(상세는 아래 Wave B·C 절).

### ✅ 2026-08-04 Clean Code Wave 3 Wave B·C (CQ-16 완료 / CQ-15 진행)

> 계획 `plans/done/2026-07-29-clean-code-wave3-wave-b-frontend-structure.md`, `…-wave-c1-hwpx-decomposition.md`, `…-wave-c3-composable-decomposition.md`를 실행했다. 대상은 `it_frontend` 단일 저장소이며 동작·UI·route·API·props/emits·CSS 선언은 변경하지 않았다.
>
> **계획서 수치는 실행 시점에 재실측했다.** cross-check commit은 frontend `937f5f9`였으나 실행 시점 HEAD는 `f11ef47`였고, 800줄 초과 운영 파일은 30개가 아니라 **31개**였다(`app/composables/useApiFetch.ts` 813 신규 초과, 다수 파일 증가). 생성물 `app/types/api.d.ts`(13,368줄)는 ESLint 전역 ignores 대상이라 제외했다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | CQ-16 | editor 14개 → `app/components/editor/`(+`extensions/`), layout 10개 → `app/components/layout/` 이동. 자동 등록에 의존하던 production 소비자 17곳에 명시적 import를 추가하고 기존 명시 import 4곳의 경로를 갱신했다. root에는 CQ-18 후보 4개만 남는다 | it_frontend `fe1bc56`(editor), `bb08ea3`(layout) | `component-boundaries.test.ts` 신규 2건이 두 디렉터리 구성과 root 잔여 4개를 고정. 이전 경로·자동등록 잔존 grep 0건. 전체 2216 테스트 통과, `check`·`format:check`·`lint:css` 클린 |
| 🔄 진행 | CQ-15 | 증가 불가 ratchet 도입(31개 기준선) 후 즉시 분해 4건 완료 — `utils/hwpx.ts` 1502→314, `composables/useCouncil.ts` 824→57, `composables/useTiptapTableTools.ts` 913→70, `components/editor/TiptapEditor.vue` 1329→781. 기준 항목 4개 삭제 | it_frontend `7ac70c3`(ratchet), `52868b6`·`c5d6fdc`(C-1), `d11091a`·`26049e1`·`9cb31ac`(C-3), `e97f870`(C-2 일부) | 공개 계약을 먼저 characterization test로 고정한 뒤 분해: HWPX runtime export 2개 + ZIP entry 10종, `useCouncil` 47 key, `useTiptapTableTools` 29 key. 분해 후 production consumer 변경 **0건**. 전체 2234 테스트 통과 |

> 최종 품질 게이트(`e97f870`): `npm run format:check`·`npm run check`·`npm run lint:css` 클린, `npx vitest run` **178 files / 2234 tests 통과**. `npm run test:e2e`는 프론트·백엔드·DB 동시 기동이 필요해 이번 실행 환경에서 수행하지 못했다 — CQ-22의 착수 조건으로 남겼다.
>
> **판단이 필요했던 지점 4가지**
>
> 1. **ratchet을 ESLint가 아닌 Vitest로 구현** — 계획서는 `eslint.config.mjs`에 `max-lines` 규칙을 추가하도록 했으나 config-protection 훅이 해당 파일 수정을 차단했다. 사용자 결정에 따라 `scripts/max-lines-baselines.mjs`(기준값 SoT) + architecture test 조합으로 확정했다. 테스트가 기준 파일의 **증가와 감소를 모두 실패**시키고 기준선 밖 파일의 800줄 초과도 막으므로 정지선 목적은 동일하게 달성한다. 대신 에디터 인라인 경고는 없다.
> 2. **`.stylelintrc.json` 경로 재지정** — 컴포넌트 이동으로 FE-19 grandfather 경로 8개가 어긋나 `lint:css`가 153건 실패했다. 예외를 새로 추가하지 않고 경로만 옮겨 이동 전과 **정확히 같은 검사 범위**를 복원했다. C-2에서 TiptapEditor의 scoped CSS를 외부 파일로 뺄 때도 `.vue` 항목을 `styles/tiptap-editor.css`로 **이동**해 예외 개수를 늘리지 않았다.
> 3. **기준 항목 1개 증가(31→32 후 최종 28)** — `app/pages/info/council-request/prepare/[id].vue`는 HEAD에 있던 Prettier 드리프트를 정리하자 긴 줄이 풀리며 731→803줄로 실제 크기가 드러났다. 로직 추가가 아니므로 기준선에 등록하고 C-4 상환 대상으로 남겼다.
> 4. **테스트 파일 재배치 생략** — C-3 계획은 테스트도 `council/*.test.ts`·`tiptap-table/*.test.ts`로 쪼개도록 했으나, Wave B에서 확정한 "테스트 재배치는 불필요한 churn" 판단을 따라 기존 위치를 유지했다. production 책임 경계는 계약 테스트가 이미 고정한다.
>
> **후속 등록**: C-2 잔여 4개(툴바 2개·extension barrel 2개)는 `TASK.md` **CQ-22**로 등록했다. 툴바 2개는 E2E 없이는 회귀를 관찰할 수 없어 보류했다.

### ✅ 2026-08-04 Clean Code Wave 3 Wave A (CQ-17·CQ-06)

> 계획 `docs/superpowers/plans/done/2026-07-29-clean-code-wave3-wave-a-backend-refactors.md`(Task 1~4)를 실행했다. 대상은 `it_backend` 단일 저장소이며 REST API·DTO·DB 스키마·트랜잭션 경계·인증 실패 의미는 변경하지 않았다.
>
> 계획서의 cross-check commit은 backend `74814d3`였으나 실행 시점 HEAD는 `b4ae577`였다. 착수 전 `loadAthIds` grep으로 계획서가 지목한 5개 호출 지점(`AuthService:188/313/397/442`, `RefreshTokenRotator:125`)과 2개 private 구현(`AuthService:496`, `RefreshTokenRotator:180`)이 모두 그대로임을 확인한 뒤 진행했다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | CQ-17 | `common.iam.service.UserRoleResolver` 신설로 역할 조회 정책 단일화. 활성·미삭제 조회(`eno`,`useYn='Y'`,`delYn='N'`), 조회 순서 보존 immutable 목록, 빈 결과 `ATH_USER` 폴백, Repository 예외 원본 전파를 단독 소유한다. 로그인·세션 복원·개발 사용자 전환·SSO·Refresh **5경로 전부** 전환하고 `AuthService`·`RefreshTokenRotator`의 중복 `loadAthIds` 2개와 `RoleRepository` 의존을 제거했다 | it_backend `391bd37` | `UserRoleResolverTest` 3건(다건 순서·불변성, 폴백, 원본 예외 동일성) 신규. `AuthServiceTest`·`RefreshTokenRotatorTest`를 resolver mock으로 재배선하면서 JWT 발급 검증을 `anyList()`에서 **정확값 인자**로 좁혀 resolver 결과가 토큰·응답에 그대로 전달되는지 고정. 게이트: `loadAthIds` production grep 0건, 두 소비자 파일 `RoleRepository` grep 0건 |
| ✅ Done | CQ-21 | 백엔드 `spotlessCheck` 위반 해소로 main의 `./gradlew check` 게이트 복구. 2026-08-01 REVIEW가 지목한 파일(`domain/menu/repository/CmenumRepositoryCustom.java`)은 이미 해소돼 있었고, 실제 잔여 위반은 `domain/budget/project/repository/ProjectItemRepository.java`의 `hasSecuritySystemItem()` JavaDoc 줄바꿈 1건이었다(작업 트리 미수정, HEAD 상태) | it_backend `3f65cf5` | `./gradlew spotlessApply` 후 해당 파일만 분리 커밋. 같은 시점 `./gradlew check` **BUILD SUCCESSFUL** |
| ✅ Done | CQ-06 | `Bcostm.update`의 20개 위치 인자를 `@Builder Bcostm.UpdateCommand` record로 전환. `dfrCleC`·`abusTc`의 `CodeDefaults.orNotApplicable` 보정은 `update(UpdateCommand)` 본문에 유지하고, null 명령은 어떤 필드도 바꾸기 전에 `Objects.requireNonNull`로 실패한다. production 호출부는 계획서 확정대로 `CostService.java:312` 1곳뿐이었고 `:383` `Btermm.update`는 CQ-19로 남겼다 | it_backend `47fa027` | `BcostmUpdateCommandTest` 2건(20개 필드 전량 매핑 + 두 기본값 보정, null 명령 부분변경 없음) 신규. `CostServiceTest`에 요청→command 20필드 매핑을 record 동등성으로 한 번에 고정하는 테스트 추가, 기존 계약명·환율 회귀 verify 2곳을 command captor로 전환. 계획서의 임시 20인자 오버로드는 **커밋에 남기지 않았다** — `Bcostm`의 public `update` 선언은 `update(UpdateCommand)` 1개 |

> 최종 품질 게이트: `cd it_backend && ./gradlew check` → **BUILD SUCCESSFUL**(Spotless·전체 단위 테스트·JaCoCo 검증 통과, 3분 24초).
>
> **부수 사실 2건**: ① 착수 시점 `./gradlew check`는 **이미 main에서 실패**하고 있었다 — 원인은 이번 변경과 무관한 `ProjectItemRepository.java` JavaDoc 줄바꿈 1건으로, `TASK.md` CQ-21이 기록한 위반 파일(`CmenumRepositoryCustom.java`)과 달랐다. `spotlessApply` 후 해당 파일만 분리 커밋(`3f65cf5`)해 CQ-21을 완료 처리했다. ② 신규 파일이 LF로 작성돼 Spotless 줄바꿈 위반이 났고 `spotlessApply` 결과를 별도 커밋(`b66ccee`)으로 남겼다.
>
> `versions.lock`은 갱신하지 않았다 — API 호환 조합이 바뀌지 않는 백엔드 내부 리팩터링이다.

### ✅ 2026-07-31 ERR-13·FE-15~19 조치

> 계획 `docs/superpowers/plans/done/2026-07-29-err13-fe15-19-remediation.md`(Task 1~9)를 실행했다. it_frontend 브랜치 `feature/err13-fe15-19-remediation`(main 대비 71커밋, `3a01cbd`…`48a8563`)을 `main`에 로컬 병합했다(병합 커밋 `02faaba`, 충돌 없음 — 병합 전 `main`이 분기 이후 움직이지 않았음을 확인). **push는 하지 않았다.**
>
> **중요한 사실**: 감사 결과 Class A(죽은 `try/catch` 판정)는 **0건**이었다 — 계획서가 전제한 "죽은 try/catch 판정" 결함은 실제로 존재하지 않았고, 진짜 결함은 "쓰기 성공 안내 직후 재조회 실패를 판정하지 않는 것"(Class B)이었다. 이번 브랜치 실행 중 **계약 서술이 여섯 번 틀렸고 매번 Nuxt 소스 실측으로만 정정됐다**(예: `refresh()`가 reject한다는 최초 가정, dedupe-abort 반환값, `createError` 조건, 보존 파사드 노출 범위 등). 후속 작업자는 Nuxt `useAsyncData`/`useApiFetch` 계약을 절대 추측하지 말고 실행으로 확인해야 한다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | ERR-13 | `useApiFetch` 유래 `refresh()` 호출부 전수 조사·분류(감사 리포트 `docs/superpowers/reports/2026-07-err13-refresh-audit.md`: 총 **145건** = A **0**·B **84**·C **35**(C-2 7, C-3 28)·D **26**) 후 교정 대상 **112곳**(B 84 + C-3 28) 전량 교정. 공통 가드 `useRefreshGuard`(마지막 정상값 보존 포함)와 예외 승격 헬퍼 `refreshOrThrow` 신설, 재조회 실패 시 배너·재시도 제공, 가드가 도는 구간에만 공통 오류 토스트 억제 | it_frontend `3a01cbd`…`48a8563`(main 대비 71커밋 중 ERR-13 계열; 대표: `3a01cbd` refreshOrThrow 헬퍼, `0807a8e` useRefreshGuard 신설, `68fe44c` 3-keep 마지막 정상값 보존, `82f1a0e` 401 투명 재조회 화면 유지 실측, `aa4dc2a` 협의회 개최 결과 최종 지점) | 병합 후 `main`에서 전체 166 files/2129 tests 통과, `npm run check` 클린. 교정 지점마다 실제 계약 기반(resolve + `data` 초기화 + `error` 세팅) mock 테스트, `refreshOrThrow` 계약 테스트 3건, 401 투명 재조회 경로에서 화면이 비지 않음을 증상으로 관찰하는 테스트(`82f1a0e`) 포함 |
| ✅ Done | FE-16 | 전산업무비 편집 모드에서 KeepAlive `onActivated`로 인한 우발적 재조회를 억제해 미저장 편집 유실 방지 | it_frontend `34671ff` | 편집 모드 재조회 억제·조회 모드 복귀 시 1회 갱신·편집값 보존 단위 테스트 통과 |
| ✅ Done | FE-17 | 전산업무비 목록 재조회 실패 알림 중복 제거. `fetchCosts()`에 `suppressNetworkError` opt-in 옵션 추가, 다른 7개 호출부는 동작 불변 | it_frontend `9a2ffa4`, `faa39d6` | `fetchCosts` 옵션 전달 단위 테스트, 전산업무비 화면 공통 토스트 억제 확인, 다른 호출부 회귀 테스트 통과 |
| ✅ Done | FE-18 | `searchDept`·`searchAllType`·`searchMajorHdq`·`searchEmployee`·`searchContinueProjects` 등 AutoComplete 계열 응답 순서 역전 가드 `useLatestRequest` 도입·적용, 재리뷰에서 `useEmployeeSearch` 누락분 추가 반영 | it_frontend `9ceb404`, `215e62f` | `useLatestRequest` 계약 테스트 4건, 네트워크 자동완성 3계열 각각 늦은 응답 폐기 테스트 통과 |
| ☑️ Accepted(부분) | FE-19 | SFC `<style scoped>`를 `lint:css` 검사 범위(postcss-html customSyntax)에 포함. 실측 총 580건/37개 파일 중 `:deep`/`:global` 157건은 config 교정(`ignorePseudoClasses`)으로 위반 아님 재분류, 잔여 423건/28개 파일은 `ignoreFiles`로 grandfather 처리해 신규·미변경 139개 SFC부터 즉시 게이트 적용 | it_frontend `2a355df` | `npx stylelint "app/**/*.vue" --custom-syntax postcss-html` 실측(580건/37파일), `npm run lint:css` 통과. **잔여 423건/28개 파일 정리는 `TASK.md` FE-19에 남아 있다**(58→57 수치 정정 포함) |
| ☑️ Accepted(부분) | FE-15 | openapi-typescript codegen 파이프라인(`scripts/codegen.mjs`, `npm run codegen`/`codegen:check`) 도입, 생성물 `app/types/api.d.ts` 커밋, `useCost.ts` 1개 도메인에 적용해 스펙 불일치 시 `typecheck` 실패를 실증 | it_frontend `47594a7`, `4bc0b13`(npm ci peer 충돌 해소), `de89541`(codegen:check Windows CRLF 오탐 방지) | `npm run codegen`·`codegen:check` 동작, 생성물 diff 0, 필드 삭제 통제 변이로 typecheck 실패 실증. **전면 마이그레이션은 `TASK.md` FE-15에 남아 있다**(생성 스키마 전부 optional·nullable 미반영 등 백엔드 OpenAPI 애노테이션 보강 선행 필요) |

> 최종 품질 게이트(병합 후 `main`, `02faaba`): `npx vitest run` 166 files/2129 tests 통과(실패 0), `npm run check` 클린. `npm run format:check` 잔여 위반은 브랜치 이전부터 있던 3개 파일(`app/composables/useAuth.ts`, `app/types/menu.ts`, `tests/unit/composables/useAdminMenu.test.ts`)뿐이며 `TASK.md`에 `CQ-20`으로 별도 등록했다.
>
> **후속 등록**: 이 브랜치 실행 중 리뷰가 코드로 확인했으나 범위 밖이라 고치지 않은 항목은 `TASK.md`에 `ERR-14`(401 무한 재조회 폭주 가능성)·`ERR-15`(ERR-13 census가 놓친 무괄호 템플릿 바인딩 3지점)·`FE-20`(편집 중 다른 행 미저장 편집 덮어쓰기)·`FE-21`(FE-18 census가 놓친 자동완성 2지점)·`FE-22`~`FE-26`(토스트 억제 옵션 부재·`clearNuxtData`/언마운트 purge 미검증·`admin/boards` 보존 트레이드오프·`ResultForm` 배너 2중 노출 가능성·`prepare/[id].vue` 탭 가시성 한계)·`CQ-20`(format:check 잔여 3파일)로 등록했다.
>
> **통합 리뷰 사후 실행(2026-07-31)**: main 병합·푸시 후 브랜치를 가로지르는 통합 리뷰 3건(A: 적용 지점 / B: 테스트 / C: composable·설정, `it_frontend/.superpowers/sdd/integration-findings.md`)을 사후 실행했다. **각 리뷰의 최대 목표는 통과했다** — 파사드 누락 0건 / `mockRejectedValue` 규율 142건 전수 준수 / 설정 5종 실측 확인 / 가드 43 ↔ 배너 43 누락 0. 그러나 **개별 단계 리뷰가 구조적으로 볼 수 없던 결함 3종**이 드러나 사용자 결정("사용자 영향 + 테스트 신뢰도"까지 고친다)에 따라 후속 커밋 10개로 수정했다: ① 보존(`keptValueForFailure`)이 `data`만 유지하고 `error.value`는 세팅된 채 남겨, 템플릿이 `error`를 먼저 분기하면 보존된 데이터가 가려지거나 배너에 도달하지 못했던 것(`app/pages/info/documents/[id]/index.vue` 등 7개 화면) ② `app/composables/costList/useCostEditingState.ts`만 `refreshOrThrow` 3-인자 형태로 공유 가드를 우회해 배너 없이 자체 토스트만 뜨고 5xx에서는 공통 토스트와 겹쳐 2개가 뜨던 것 ③ 테스트 대역 5곳(`useCost.test.ts`·`useCostListPage.test.ts`·costList 3파일)이 "실패 시 `data`가 undefined로 비워진다"는 3-keep 이전 모델을 손으로 재현해, 전산업무비 화면의 ERR-13 배선(보존·억제·배너)이 회귀 검출 범위 밖이던 것. 수정 상세는 `it_frontend/.superpowers/sdd/integration-fix-A-report.md`(그룹 ①②④⑤)·`integration-fix-B-report.md`(그룹 ③)를 참조. 최종 `npx vitest run`은 **167 files / 2152 tests 전부 통과**(통합 리뷰 전 166 files/2129 tests → +23). 수정 과정에서 새로 드러난 결함과 잔여 지적은 `TASK.md`에 `ERR-15`(admin/logs census 누락 추가)·`FE-27`~`FE-33`(테스트 위생·커버리지 공백·A/C Minor·admin/menus 주석 표류·`createNuxtFetchFake` 참조 재사용 한계·게시판 첨부 가드 밖 경로)로 등록했다.
>
> **교훈**: 각 단계 리뷰는 "배너가 템플릿에 있는가"만 확인했고 **주변 `v-if` 체인이 배너에 도달하게 해주는가**는 아무도 보지 않았다. 단계별 리뷰만으로는 브랜치를 가로지르는 결함을 못 잡는다.

### ✅ 2026-07-29~30 SEC-11~15 보안 조치 완료

> 계획 `docs/superpowers/plans/done/2026-07-29-sec10-sec15-security-remediation.md`의 완료 항목만 이관했다. SEC-10은 1.x/2.x 호환 백포트가 공식 advisory에서 식별될 때까지 `TASK.md`에 유지한다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | SEC-11 | Oracle 도구의 비밀번호를 명령행·환경변수·임시 SQL에서 제거하고 수동 콘솔 프롬프트와 무인 Wallet 별칭을 분리했다. fake client가 모든 argv와 두 번째·중첩 `@sqlfile`까지 재귀 추적해 비밀 sentinel을 거부하고, SPOOL/포함 경로도 검사한다. Wallet 생성·배포·실재 검증은 운영/DBA 절차로 남긴다. | database 변경 `d5756ad`(호환 HEAD `0af106f`); root `604ff1e`…`892f447` | `verify-sec11-powershell.ps1`을 PS7·Windows PowerShell 5.1에서 각각 종료 0로 재실행. Process CommandLine, prompt/Wallet, repository DDL·임시/중첩 SQL, BOM 없는 한글 스크립트 파싱 검증 통과. |
| ✅ Done | SEC-12 | `SsoAgentClient.authorize()`·`isServerAlive()`, `SsoController.loginProc()`·`checkauth()`·`complete()`의 token/session/eno/body/IP 원문을 제거했다. 유효 resultCode 진단은 유지하되 제어문자·포맷 문자열·과대 resultCode는 한 줄 안전 표현으로 바꾸고, 비정상 길이는 UTF-16 unit이 아닌 Unicode code point 수로 기록한다. | backend `c8861cc`…`eb79b76`(호환 main HEAD `ae61469`) | `authorize_비정상resultCode_로그주입차단_반환값유지`, `loginProc_비정상resultCode_로그주입차단_인증결과유지`, `checkauth_비정상resultCode_로그주입차단`, `checkauth_유효resultCode_로그진단유지`, `ssoLogSanitizer_resultCode_보충문자길이코드포인트기준` 및 기존 sentinel log-capture 테스트. |
| ✅ Done | SEC-13 | prod에서 OpenAPI 두 속성을 false로 강제하고 override·누락·빈값을 차단했다. 운영 위험 Boolean은 Spring `Binder`의 typed binding과 같은 true/false 별칭을 사용하되 공백·오타는 fail-closed이며, lazy initialization에서도 validator를 eager 실행한다. active profile을 우선하고 없을 때 default profile을 사용하며 `prod`/`PROD`를 모두 운영으로 판정한다. | backend `e8d8aa4`…`312367a`(호환 main HEAD `ae61469`) | prod 문서 endpoint 익명 401/인증 404·local/dev 유지, `lazyProd_dangerousToggle_failsDuringStartup`, `validate_prodDirectEnoSpringTrueAliases_throws`, `validate_prodDirectEnoInvalidBoolean_throwsWithoutValue`, default/uppercase PROD 실제 startup 및 active non-prod 우선 테스트. |
| ✅ Done | SEC-14 | Java/TypeScript가 내부 단일 `/` 경로를 브라우저 기준으로 canonicalize하고 dot segment·unreserved percent encoding을 정규화하되 안전한 query/hash suffix 원문은 보존한다. 외부/scheme-relative, 역슬래시·인코딩 구분자/제어문자, 잘못된 percent encoding, canonical 첫 `login` segment를 거부한다. 프론트 배열 쿼리는 **첫 요소가 문자열일 때 그 값만 사용**하며 첫 값이 비문자/위험하면 뒤의 안전값으로 폴백하지 않는다. malformed 상태 쿠키는 비밀 노출 없이 루트 복구하고 반복 `error`도 첫 문자열만 판정한다. 새 `business` 진입은 새 next 판정 전에 이전 `ssoNext`·`ssoOrigin` 세션 값과 쿠키를 먼저 제거해 위험한 새 입력이 과거 복귀 상태를 되살리지 못하게 한다. | backend `20827a8`…`bfcc9e1`(main HEAD `ae61469`); frontend `3e5637a`…`f079900`(main HEAD `f079900`) | Java/TS canonical allow/deny 표, safe suffix 보존, malformed 쿠키 복구 및 auth/server middleware 반복 error·배열 테스트에 더해 `business_안전하지않은새next_이전복귀상태제거`가 세션 제거·쿠키 만료·루트 복귀를 고정한다. `npm run test:e2e:static` 종료 0. |
| ✅ Done | SEC-15 | 기존 CSRF 보강 트리거 5개와 운영 `JSESSIONID`의 Secure·HttpOnly·SameSite=Lax 강제를 유지하면서 실제 자동 자격증명·상태 변경 경계를 보강했다. SSO 세션은 한 번만 소비하고 로그아웃 시 서버 세션을 무효화하며, 프론트 로그아웃은 POST를 사용하고 서버 실패에도 로컬 인증 상태를 정리한다. 새 업무 진입도 이전 복귀 세션·쿠키를 비운 뒤 새 목적지를 판정한다. 게시물 상세 GET/조회수 POST를 분리했고, 게시판·게시물·댓글의 계층 소속과 작성자 소유권 및 비활성 게시판 쓰기 거부를 서버에서 검증한다. 게시물·댓글 쓰기와 답글 순서는 managed 감사 갱신, 비관적 잠금, 원자적 꼬리 순번 배정으로 동시성을 보장한다. DB는 `V20260730_001` DML 보정과 `V20260730_002` 답글 꼬리 인덱스를 분리했으며, disposable schema marker/token으로 오실행을 막는 마이그레이션 IT를 제공한다. | backend SEC-15 계열 `c9bca15`…`bfcc9e1`(main HEAD `ae61469`); frontend `8e94190`…`f079900`(main HEAD `f079900`); database `de35930`…`0af106f`(main HEAD `0af106f`); root FP `33ade11`…`b33d148` | 실제 Oracle에서 `BoardWriteConcurrencyIT`·`BoardPostViewAuditIT`가 동시 쓰기/조회 감사·잠금 계약을 통과했다. `BoardReplySequenceMigrationIT`는 `@JdbcTest` 최소 JDBC slice, 테스트 DB 자동 교체 금지, 알림 재시도·Spring task scheduler 비활성 구성으로 격리했다. disposable 환경이 없어 4/4 의도적으로 skip됐고, 로컬 Docker daemon/Testcontainers도 없어 V001/V002 런타임 적용 성공을 주장하지 않는다. marker/token을 갖춘 disposable Oracle에서의 migration runtime은 배포 전 필수 게이트다. |

> 최종 품질 게이트(2026-07-30): 호환 main HEAD는 backend `ae61469`, frontend `f079900`, database `0af106f`다. backend `ae61469`에서 `gradlew clean check`는 단위 테스트 2,505건(실패·오류 0, 스킵 1)과 Spotless·JaCoCo를 통과했고, `BoardWriteConcurrencyIT`·`BoardPostViewAuditIT`·`BoardReplySequenceMigrationIT` 집중 `integrationTest`도 17건 중 13건 성공·실패/오류 0으로 종료했다. 실제 Oracle 게시판 동시성·감사 테스트는 실행됐고 migration IT 4건은 disposable 환경 부재로 의도적으로 skip됐다. `cf62c96`은 migration IT를 scheduler 없는 `@JdbcTest` slice로 격리했고 `bfcc9e1`은 새 업무 진입의 과거 복귀 상태 제거 회귀를 추가했으며, 병합 후 `ae61469`는 migration SHA를 LF canonical text에 고정해 Windows CRLF 체크아웃에서도 같은 DB SoT를 검증한다. frontend `npm run format:check`, `npm run check`, 전체 Vitest는 main에서 종료 0이었고, 사용자 `nuxt dev`와 생성 산출물 경합을 피한 동일 `f079900` 격리 worktree에서 `npm run test:e2e:static` 2/2가 통과했다. `verify-sec11-powershell.ps1`은 PS7·Windows PowerShell 5.1에서 각각 종료 0이었다. FP generator 결과는 UFP 1,305, 총 278개 기능(ILF 37, EIF 2, EI 136, EO 31, EQ 72)이며 root 증빙 HEAD는 `b33d148`이다.

> 운영 보안 escalation: 역사적 문서·계획·완료 기록에서 평문 자격증명으로 보일 수 있는 값이 관찰되었으나 이번 범위 밖이다. 값을 이 문서에 재노출하지 않으며, 저장소 접근 이력·비밀 관리 담당자와 별도 비밀 스캔/접근 영향·필요 시 rotation 및 승인된 정리 절차를 평가한다. 이번 작업에서는 history rewrite·rotation을 수행하지 않았다.

### ✅ 2026-07-29 ERR-11·ERR-12·FE-12(스파이크)·FE-13·FE-14 조치

> 계획 `docs/superpowers/plans/2026-07-29-err11-12-fe12-14-remediation.md`를 서브에이전트 기반(구현 → 스펙 리뷰 → 품질 리뷰 → 재작업 루프)으로 실행했다. 구현은 `it_frontend` 브랜치 `feature/err-fe-remediation-20260729`에 있으며 **아직 main에 병합되지 않았다** — 병합 후 `scripts/update-versions-lock.ps1`로 `versions.lock`을 갱신해야 한다. 리뷰 과정에서 계획 자체의 오진 2건(FE-14 수정 지점, ERR-11 재조회 상호작용)과 Nuxt `useAsyncData` 계약 오해 1건이 드러나 계획을 정정하며 진행했고, 파생 과제는 ERR-13·FE-15~19로 등록했다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | FE-14 | Tiptap 변수 칩이 재시도 성공값을 반영하지 않던 간헐 버그 해소. 원인은 병합 로직이 아니라 **반응성 경계**였다: Tiptap core의 `Extendable.storage` getter가 `addStorage()` 반환값을 객체 스프레드로 복사해 확장 정의의 반응형이 사라지고, `@tiptap/vue-3`의 `editor.storage`는 `beforeTransaction`에서만 trigger되는 `customRef`라 값 재할당이 `VariableNodeView`의 computed를 무효화하지 못했다(무관한 트랜잭션 발생 시에만 우연히 갱신 → flaky). `VariableExtension.onBeforeCreate`에서 살아 있는 `editor.storage.tiptapVariable`을 `shallowReactive`로 교체 | it_frontend `92331bb`(무효 시도) → `94a626e`(mock 경계 회귀) → `3577eea`(최종) | 실제 `@tiptap/vue-3` Editor 경로 단위 테스트 2건(설치 전 미전파/설치 후 전파), `error-recovery-tiptap.spec.ts` `--repeat-each=5` 5회 연속 통과(+리뷰어 3회 추가), 전체 148 files/1886 tests. 리뷰어가 Tiptap core 소스와 자체 프로브로 `beforeCreate`가 NodeView 마운트보다 선행하고 `editor.storage.tiptapVariable === editor.extensionStorage.tiptapVariable`임을 독립 검증 |
| ✅ Done | ERR-11 | 전산업무비 일괄 저장의 부분 실패 복구. ① 실패 행별 사유(`_saveError`)·편집값·`_status`를 편집 모드에 보존하고 성공 행만 정리 ② `costsRaw` watcher가 실패 행을 서버 데이터로 덮어쓰지 않도록 보존(스냅샷은 서버 원본 기준 유지) ③ 재조회 실패를 `error` ref로 판정해 배너·재시도(`retryRefreshAfterSave`) 제공, 성공한 쓰기는 재전송하지 않음 ④ 취소 경로의 미처리 예외 처리 ⑤ 화면 표면화(실패 배너·재조회 실패 배너·실패 행 강조 `row-save-failed`) | it_frontend `8af9d9f`·`17940b0`·`7e85e97`·`482d324`·`9602152`·`334eea2`·`ae4317e` | 단위·통합 테스트 15건(부분 실패·전체 실패·성공 회귀·재조회 실패·중복 저장 차단·유령 배너 해제·취소 경로·실제 watcher 통합), 리뷰어가 소스만 되돌려 RED 재현 및 `StyledDataTable` 실제 DOM 렌더로 `tr.row-save-failed` 적용 확인, 전체 149 files/1905 tests |
| ✅ Done | ERR-12 | 계속사업 자동완성의 조회 실패를 "결과 없음"과 구분. `continueSearchError`로 사유를 남기고 인라인 `Message`+[다시 시도](로딩 상태 포함) 제공, 사업구분 전환 시 낡은 오류 정리 | it_frontend `32aee86`·`d67a23e` | 단위 테스트 4건(빈 결과·실패·재시도·오류 초기화), watcher 초기화 한 줄 제거로 RED 실측, 전체 150 files/1909 tests |
| ✅ Done | FE-13 | `it_frontend/docs/design/`을 `docs/preview/`로 통합하고 `docs/guides/README.md`에 위치 규약 명시(참조 0건 사전 확인) | it_frontend `8034ae0` | `git grep`으로 두 경로 참조 0건 확인, rename으로 이력 보존, `docs/design` 제거 확인 |
| ✅ Done | FE-12(스파이크) | openapi-typescript vs orval 실측 비교 완료 — **openapi-typescript 조건부 채택, orval 보류**. 도입 실행은 FE-15로 재등록 | 루트 `fa27c6d` (리포트) | 실측: 스펙 paths 159·operations 235·schemas 234(OpenAPI 3.1), openapi-typescript 1파일 13,328줄·런타임 의존성 0, orval 37파일 15,594줄·mutator 위임 구조 확인. 프론트 저장소 무변경 확인. 리포트 `docs/superpowers/reports/2026-07-fe12-openapi-codegen-spike.md` |

### ✅ 2026-07-27 BE-03 보수적 프로젝션 1차 적용 (6개 묶음 + 가이드 목록 계약 분리)

> 사용자 승인(2026-07-27: "6건 전부 구현" + "가이드 목록 계약 분리 지금 함께")에 따라 경계선 6개 묶음 전부에 응답 전용 프로젝션을 적용했다. 응답 JSON은 가이드 목록(승인된 계약 변경, `feat!`)을 제외하고 전부 불변이며, 읽기·쓰기 공유 메서드는 기존 엔티티 경로를 유지했다. 잔여 과제(운영 관측 조정, Project/Cost·알림함 계약 분리, BBUGTM 재계획, versions.lock)는 `TASK.md` BE-03 참조. 조사 중 발견된 부수 이슈는 BE-25(캐시 공백)·BE-26(N+1)·BE-27(IT fixture 격리)로 분리 등록.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | BE-03(1차) | ① Estimate 상세 `EstimateDetailView`(7컬럼) ② Application 읽기 `ApplicationReadView`(8컬럼, 죽은 오버로드 제거) ③ 공통코드 REST `CcodemResponseRow`(18컬럼, 캐시·직접 소비자 불변) ④ 게시판 메타·댓글 목록 `BoardMetaListRow`/`BoardCommentListRow` ⑤ 조직 소비자별 `OrganizationListView`/`OrganizationAdminView`(인메모리 delYn 필터→쿼리 필터) ⑥ 가이드 목록 계약 분리(`GuideDocListView`+`ListResponse`, 본문 CLOB 제외) + 프론트 전환(목록 Summary 타입, 선택 시 단건 본문 조회, 상세 로드 실패 시 빈 본문 덮어쓰기 차단) | it_backend `feature/be03-conservative-projections` `7e73d18`…`b6714db`(11커밋); it_frontend `feature/be03-guide-list-split` `c23413a`·`8b45d3a` | 신규 조회마다 Oracle IT 동등성 케이스(로컬 Oracle 실제 실행 GREEN, `Projections.constructor` 순서 검출 fixture 보강 포함), 백엔드 전체 `./gradlew test`·`integrationTest` GREEN, 프론트 `npm run check`+`npm test` 1834건 GREEN, Task별 2단계 리뷰(프론트 CRITICAL 빈 본문 덮어쓰기 경로 발견·수정 포함) 및 전체 최종 리뷰 READY TO MERGE. 계획: `docs/superpowers/plans/2026-07-27-be03-conservative-projections.md` |

### ✅ 2026-07-27 BE-17 프로젝션 보류 정책 4건 확정·대표행 결정론화 구현

> 2026-07-27 사용자 확정 정책: ① BITEMM GCL 대표행 = `LST_YN='Y'` 우선(없으면 SNO 최대 폴백) ② BBUGTM 편성률 대표행 = 최신 편성 실행(`bgNo` 최대, 동률 시 `sno` 최대) ③ BPROJM 배치 사업명 = `LST_YN='Y'` 행 이름(없으면 관리번호 폴백)으로 단건 조회와 통일 ④ `getProjectSummary` 그룹 키 = `(orcTb, pkVl)` 복합키 분리. 차단 해제된 BBUGTM·`ProjectKeyView` 프로젝션은 BE-03 보수적 프로젝션 후속 재계획 시 포함한다. 범위 외로 발견된 `getSummary` 표시명 병합 블록의 잔여 encounter-order 채택은 BE-24로 분리 등록했다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | BE-17 | 대표행 셀렉터 3종 신설(`BudgetRepresentativeSelector`·`ItemRepresentativeSelector`·`ProjectRepresentativeSelector`)과 `BudgetWorkService`의 encounter-order 채택 지점 교체(getIoeCategories 편성률, getProjectSummary 헤더 편성률·품목 편성행·BITEMM 그룹핑·배치 사업명, computeMplAdjustment 품목 대표행·비목 분류 편성행), `SourceKey(orcTb, pkVl)` 복합키 분리 및 `orcTbMap` 제거 | it_backend `feature/be17-representative-row-policies` 브랜치 `bdf3c92`…`579accd` 11커밋 | TDD RED→GREEN 단계별 실증(구버전 구현 복원 실패 실증 포함), 신규 단위 테스트 21건 추가·전체 `./gradlew test` BUILD SUCCESSFUL, Task별 스펙·품질 2단계 리뷰 및 전체 최종 리뷰 READY TO MERGE. 구현 계획: `docs/superpowers/plans/2026-07-27-be17-representative-row-policies.md` |

### ⛔ 2026-07-26 프론트엔드 잔여과제 범위 종료

> 사용자 결정에 따라 아래 항목은 구현 완료로 간주하지 않고 후속 범위에서 폐기했다. 알려진 제한과 검증 증거는 추후 의사결정에 참고할 수 있도록 보존한다.

| 상태 | ID | 폐기 범위 | 보존 근거 |
| :--: | :--: | --- | --- |
| ⛔ Discarded | REV-01 | 사전협의 검토자·세션 상태 서버 영속화와 실제 인증 완료 흐름 | 계약·메타용어 미승인 상태에서 구현하지 않는다는 계획 게이트를 준수했으며 메모리 전용 흐름은 현행 유지 |
| ⛔ Discarded | REV-04 | 검토의견 첨부 배치 조회의 URL 길이·Oracle `IN` 1,000개 상한 보강 | 현재 배치 계약은 유지하며 대규모 부모 요청 최적화는 수행하지 않음 |
| ⛔ Discarded | TIP-02 | Tiptap 사업 변수·실DB·HWPX 전체 인수조건 완성 | 자동화 subset과 expected-failure 증거는 `docs/03-analysis/tiptap-operational-validation.md`에 보존 |
| ⛔ Discarded | TIP-03 | `CAP_BUDGET`의 `IOE_CPIT` 포함 정책 결정과 런타임 정렬 | 2026년 `IOE_CPIT` 0건으로 합계는 일치하지만 3종·4종 정책 불일치는 미해결 상태로 보존 |
| ⛔ Discarded | TIP-05 | 변수 칩·다크모드·키보드·ARIA·모바일 실화면 재검증 | 브라우저 미가용으로 미수행한 검증 범위와 코드 점검 결과는 `docs/03-analysis/tiptap-accessibility-findings.md`에 보존 |
| ⛔ Discarded | TIP-07 | 변수 NodeView `data-token` DOM 계약과 비동기 해석 즉시 반영 | 알려진 결함과 expected-failure 테스트는 보존하되 제품 수정은 수행하지 않음 |
| ⛔ Discarded | TIP-08 | 변수 칩 다크 대비와 Suggestion 팝업 접근성·모바일 경계 | 측정된 대비·ARIA·viewport clamp 제한은 보존하되 제품 수정은 수행하지 않음 |
| ⛔ Discarded | TIP-09 | HWPX 내보내기 전 최신 변수값 재해석 | stale `data-snapshot` 출력 결함과 expected-failure 테스트는 보존하되 제품 수정은 수행하지 않음 |

### ✅ 2026-07-26 프론트엔드 잔여과제 통합 조치 완료 이관

> 기존 FE-01 완료 기록은 KPI·진행현황 API 전환 범위다. 아래 FE-01은 그 후속인 공지·협의회 일정 운영 피드 범위를 별도로 기록한다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | REV-02 | 검토의견 응답의 작성자 사번·이름·현재 팀명을 배치 프로젝션으로 조회하고 프론트 `authorTeam` 문자열 매핑·표시를 연결했다. | backend `805ba14`; frontend `96cd7ad` | 작성자 프로젝션 배치 호출 단위 테스트, 백엔드·프론트 focused/full 테스트와 정적 검증 통과, 작업 리뷰 Approved |
| ✅ Done | REV-03 | 검토의견별 첨부 배치 조회, 상위 문서 기반 읽기 권한, 댓글 작성자·관리자 쓰기 권한, 작성·조회·삭제 UI와 부모별 독립 재시도/폐기를 연결했다. 후속 통합 리뷰에서 재시도 세션 격리와 실제 HTTP 권한 경계도 보강했다. | backend `1e38af2`, `989df67`, `cd7d402`, `df26a06`; frontend `10a96f0`, `0168b2f`, `e1d4038` | backend focused 25/25·전체 테스트·Spotless·Oracle/MockMvc download/preview 403 통과, frontend focused 50/50·전체 142파일/1,791건·`npm run check`·Playwright 2/2 통과, mutation RED와 재리뷰 Approved |
| ✅ Done | FE-01 | 정보 홈의 정적 공지·일정을 공개 공지 게시물과 접근 가능한 확정 협의회 일정 API로 교체하고 영역별 로딩·오류·빈 상태·재시도를 제공했다. 후속 통합 리뷰에서 화면 재활성화 시 피드 갱신을 보강했다. | backend `96048c6`; frontend `f8fa350`, `e728738`, `d4360ca` | 공개 게시물 Oracle 통합 3건·백엔드 전체 테스트/Spotless, frontend focused 6건·전체 테스트·`npm run check`·정보 홈 Playwright 3/3 통과 |
| ✅ Done | FE-04 | 사업계획·소요예산·협의회 목록을 필터·정렬 후 최초 20건, 20건 단위 더보기로 점진 노출하고 검색·필터 변경 시 노출 수를 초기화했다. 네트워크 페이지네이션은 실서버 p95 측정 전까지 별도 게이트로 남겼다. | root `d8fa8b8`, `910b367`, `7f2fd06`; frontend `c029c5f`, `fa1367b` | 1,000건에서 화면별 20카드, 필터 중앙값 21.2~27.0ms; 전체 frontend 1,775건·`npm run check` 통과, 재현 가능한 env-gated 성능 하네스와 리뷰 Approved |
| ✅ Done | FE-07 | `budget/status.vue`의 PrimeVue footer 바인딩 3곳을 `:footer-class`로 정정하고 합계 회귀 테스트를 갱신했다. | frontend `7be77dc` | 대상 ESLint 0 warning/0 error, footer 합계 Vitest 2/2, 전체 137파일/1,759건·`npm run check` 통과 |
| ✅ Done | FE-08 | `useCostRowEditing().addRow()`의 맨 앞 삽입, 사용자 코드, 선택 연도/기본 연도, `abusTc`·`dfrCleC` 해당없음 기본값을 실제 composable 테스트로 잠갔다. | frontend `5c799ca`, `631a996` | focused Vitest 4/4, `unshift`→`push` 통제 변이 RED 확인, cost Playwright 6/6·전체 테스트·`npm run check` 통과 |
| ✅ Done | FE-09 | Excel 지급주기 전용 매퍼를 추가해 공백·미매칭 값을 해당없음 코드로 저장하고 실제 워크시트 행 번호의 집계 경고를 표시했다. 공용 nullable `codeId()` 계약은 유지했다. | frontend `500f486`, `631a996` | 매퍼 Vitest 3/3, 실제 XLSX Playwright에서 물리 행 번호와 저장 payload `dfrCleC='0'` 검증, 통제 변이 RED·cost Playwright 6/6·`npm run check` 통과 |
| ✅ Done | FE-10 | 백엔드 `CodeDefaults.NOT_APPLICABLE`에 대응하는 `NOT_APPLICABLE_CODE='0'`을 추가하고 비용·단말·자원 생성 경로의 업무상 해당없음 기본값 8곳을 통합했다. | frontend `ec13c87` | focused 테스트 11건, 잔여 `abusTc: '0'`/`dfrCleC: '0'` 검색 0건, 전체 테스트·`npm run check` 통과 |
| ✅ Done | FE-11 | 계약방법 누락 저장 시 삭제되지 않은 원본 행 번호와 총 건수를 안내하고 첫 오류 combobox 스크롤·포커스, `aria-invalid`, 선택 즉시 오류 해제를 구현했다. | frontend `5e23825`, `fb0d31c` | unit 1/1, bizplan Playwright 1/1, 전체 138파일/1,760건·`npm run check`·Prettier/diff check 통과, 접근성 수정 재리뷰 Approved |
| ✅ Done | TIP-06 | StarterKit의 `link`·`underline` 등록을 비활성화하고 기존 독립 Link/Underline 옵션을 유지해 Tiptap 중복 확장 경고를 제거했다. | frontend `116009e` | 실제 editor 마운트 RED→GREEN 8/8, 상세·편집 재진입 Playwright 3/3, 전체 137파일/1,759건·`npm run check` 통과 |
| ✅ Done | BRD-11 | 기존 공통 파일 API로 게시글 첨부 작성·조회·추가·삭제를 연결하고 서버 `flApgYn`/`flNbr` 캐시, 파일 크기 메타, 부분 실패 재시도를 보강했다. 후속 통합 리뷰에서 route의 부모 전환 반응성·동기화를 보완했다. | database `6e1a9c5`; backend `3366c73`, `b92c8ce`, `ae8e29c`; frontend `8087aa4`, `015aabd`, `6f9142c`, `628204f` | migration 로컬 2회 적용·`APG_FL_SZ NUMBER(10)` 확인, backend 전체 2,269건·Spotless, frontend 전체 1,784건·board Playwright 9/9·`npm run check` 통과, 동시성·중복 파일명·부모 식별자 재시도 리뷰 Approved |

### ✅ 2026-07-26 프론트 Prettier 포맷 드리프트 정리 (FE-03)

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | FE-03 | Prettier 포맷 드리프트 일괄 정리 | 기능 변경이 끝난 시점의 `prettier --list-different` 기준선 39개를 보존한 뒤 `npm run format`을 한 번 적용했다. Git 콘텐츠 diff는 기준선의 부분집합인 13개였고 기준선 밖 변경은 0개였다. |

- 프론트 커밋: `3038532`.
- 검증: `npm run format:check`·`npm run check` 통과, `npm test` 143파일·1,811건 통과, staged/commit diff check 통과.
- 포맷 전용 리뷰: 줄바꿈·들여쓰기·공백 정리만 포함하고 의미 변경이 없음을 확인해 Approved.

### ✅ 2026-07-26 프론트 포맷터·사업카드 색상 정책 정리 (FE-02, FE-05, FE-06)

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | FE-02 | 잔여 파일 크기·통화·금액 표시 중복 공통화 | 검토의견 팝오버·메신저는 공용 `formatFileSize`를 사용하고, 의미가 같은 네 상세 화면의 통화 표시는 신규 `formatCurrencyAmount`로 통합했다. 표현 의미가 다른 로컬 포맷터는 유지했다. |
| ✅ Done | FE-05 | 목록 예산 축약 포맷터 이름 충돌 해소 | 두 목록 화면의 동명 로컬 `formatBudget`을 제거하고 경계·음수 계약을 고정한 공용 `formatBudgetCompact`로 승격해 기존 단위 변환용 `formatBudget`과 이름·용도를 분리했다. |
| ✅ Done | FE-06 | `ProjectListCard` 상태·칩 톤을 의미 클래스 정책으로 통합 | 상태 5톤과 보조 칩 4톤을 `.project-card-status--*`·`.project-card-chip--*`로 옮기고 `tags.css`의 일반 `span`용 `@apply` 규칙으로 관리한다. PrimeVue `.kdb-tag-*`의 `!important`와 CTA `.v3-cta--*` 색상 계약은 변경하지 않았다. |

- 프론트 커밋: `d9b8a52`(FE-02·FE-05), `39024e9`(FE-06).
- 검증: `npm test` 143파일·1,811건 통과, `npm run check` 통과, `npm run lint:css` 통과, 지정 포맷터 중복 검색 0건.
- 비차단 확인: 기존 밝은/어두운 pixel baseline 또는 screenshot 시나리오가 없어 픽셀 비교는 실행하지 않았고, 전체 tone 의미 매핑과 CTA 불변을 단위/CSS 게이트로 고정했다.
- 기존의 “FE-02 예산 목록/승인 화면 금액 0 표시 정책 보정” 완료 기록은 별도 과거 범위이므로 아래 기록을 유지한다.

### ✅ 2026-07-26 에러 표면화·복구 (ERR-09, ERR-10)

> `TASK.md`의 ⚠️ 에러 처리 ERR-09·ERR-10을 구현·검증하고 종료 이관했습니다. 설계: `docs/superpowers/specs/2026-07-25-security-error-remediation-sec08-err10-design.md` §4(Phase B)·§5(Phase C), 계획: `docs/superpowers/plans/done/2026-07-25-security-error-phase-b-backend-surfacing.md`·`docs/superpowers/plans/done/2026-07-25-security-error-phase-c-frontend-states.md`. it_backend 브랜치 `feat/err08-err09-backend-surfacing`를 main에 병합(머지 `6fa3cf9`, ERR-09 NativeRowMapper 중앙 진단)하고, `feat/err10-council-sync-auth`를 main에 병합(머지 `0a98a43`, ERR-10 C4-1). it_frontend 브랜치 `feat/err08-banner-err10-frontend`를 main에 병합(머지 `a90f79c`, ERR-10 C1~C4-2 + ERR-08 스냅샷 배너).

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | ERR-09 | 네이티브 조회 타입 변환 실패를 실제 NULL과 구분 | `NativeRowMapper`의 날짜 문자열·미지원 JDBC 타입 변환 실패를 원본 값·타입 문맥과 함께 중앙에서 진단(경고)하도록 전환하고 변환 회귀 테스트를 추가했다. it_backend main 병합(`6fa3cf9`). |
| ✅ Done | ERR-10 | 프론트 핵심 업무의 실패 폴백을 사용자 오류 상태로 승격 | 4개 레인 모두 "조용히 삼키기" 대신 사용자 오류 상태로 표면화: (C1) 통화 조회 single-flight + last-known-good 상태머신(`useProjectCurrencies`, eager 옵션 하위호환), (C2) Tiptap 단건 해석 ERROR 승격·재시도와 인스턴스 스코프 시퀀스 가드(`useTiptapVariables`/`TiptapEditor.vue`, 기존 배치 STALE 계약 보존), (C3) 최신 revision PDF만 미리보기·상신 + Blob URL 누수 방지 순수 상태머신(`utils/reportPdfState.ts`/`projects/report.vue`), (C4) 협의회 상태 동기화 실패를 auth/permanent/transient로 분류·재시도 배너·epoch 가드(`utils/statusSyncError.ts`/`ResultReviewProgress.vue`) + 백엔드 `syncReviewStatus` 관리자 권한 강제(C4-1). |

- 최종 검증: it_frontend `npm run check`(타입·ESLint 0 errors)·`npm test`(135파일 1746 통과)·신규 e2e 5종(통화·Tiptap·PDF·스냅샷·협의회 sync) 통과. it_backend `./gradlew test`·`spotlessCheck` BUILD SUCCESSFUL. 태스크별 2단계 리뷰(스펙 준수·코드 품질) + 최종 홀리스틱 프론트 리뷰 READY-TO-MERGE(교차 레인 일관성·하위호환·회귀 없음 확인).
- 최종 게이트 재검증(2026-07-26): 이관 전 root `0439417`, frontend 제품/E2E `8d3eda3`·최종 테스트 `4e91e9c`, backend `52552cc`에서 수행한 정확한 명령·종료 코드·레인 C1~C4 PASS 수락은 [`2026-07-26-err10-final-gate.md`](docs/superpowers/evidence/2026-07-26-err10-final-gate.md)에 고정했다. 해당 영수증에 따라 it_frontend `npm run typecheck`·`npm run lint`·`npm test -- --run`·지정 Playwright 4개 spec(9건), it_backend `./gradlew test`·`./gradlew spotlessCheck`가 모두 종료 코드 0이다. 기준일자 필수화 뒤 누락된 `TerminalFormDialog` 정상 통화 fixture에는 유효 `cdvaDtl`을 보강했다(`4e91e9c`). lint의 `budget/status.vue` `:footerClass` 3건은 FE-07 소유 경고로 제품 코드 변경 없이 보류했다.
- 최종 수정 라운드(2026-07-26): frontend `a6f0cba`에서 PDF 생성 실패 뒤 결재선을 바꾸지 않는 명시적 `다시 시도`를 추가하고, Tiptap의 삭제 ERROR 토큰 정리·문서/변수 맵 전환 중 구 비동기 응답 격리를 보강했다. TDD RED(신규 3건 실패) 뒤 GREEN(집중 19/19)과 영향 E2E 5/5를 확인했으며, 최종 `npm run check`·전체 Vitest 135파일/1,751건·지정 ERR-10 Playwright 9/9가 모두 종료 코드 0이다. 정확한 명령과 SHA는 같은 [`최종 게이트 영수증`](docs/superpowers/evidence/2026-07-26-err10-final-gate.md)의 “최종 수정 라운드 추가 증빙”에 고정했다.
- 잔여 후속(비차단): `TerminalFormDialog` eager:false 다이얼로그가 `cost`를 초기 로드 후 다시 null로 만들 경우의 상태 리셋 방지(key-stable 래퍼/문서화), `ResultReviewProgress`의 `asctId`를 반응형으로 바꾸는 미래 caller에서 자동 트리거 지연 가능성 문서화, 분당 1회 toast 스로틀 공용 헬퍼 추출(DRY) — 별도 과제로 추적.

### ✅ 2026-07-25 보안 트랜잭션 무결성 (SEC-08, SEC-09)

> `TASK.md`의 🔒 보안 SEC-08·SEC-09를 구현·검증하고 종료 이관했습니다. 설계: `docs/superpowers/specs/2026-07-25-security-error-remediation-sec08-err10-design.md` §3(Phase A), 계획: `docs/superpowers/plans/2026-07-25-security-error-phase-a-security-txn.md`. it_backend 브랜치 `feat/sec09-sec08-txn-integrity`를 main에 병합(머지 커밋 `34822a4`).

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | SEC-09 | 로그인 실패 이력의 롤백 독립성과 계정 잠금 동작 보장 | `AuthService.login()`을 `@Transactional(noRollbackFor = LoginRejectedException.class)` 단일 트랜잭션으로 바꿔 로그인 거부(실패 이력)만 커밋하고 DB·프로그래밍 예외는 전체 롤백한다. 비인증 인증 흐름의 감사자를 명시적으로 기록(`JpaAuditConfig`가 `AnonymousAuthenticationToken` 제외, `Clognh` 로그인 이력=`SYSTEM`, `Crtokm` 토큰=소유자 `eno`)해 NOT NULL 감사컬럼 위반을 방지한다. 실 Oracle IT `AuthLoginFailureIsolationIT`가 익명 컨텍스트에서 public 로그인 실패 5건 커밋(감사자 SYSTEM)+6회째 계정 잠금+DB 오류 시 전체 롤백을 검증. `LoginHistoryWriter`/`REQUIRES_NEW`는 도입하지 않음(단일 트랜잭션 방식). |
| ✅ Done | SEC-08 | Refresh Token 재사용 탐지 시 패밀리 폐기 커밋 보장 | 회전과 폐기를 2개 트랜잭션으로 분리했다. `RefreshTokenRotator.rotate()`(`@Transactional`, PESSIMISTIC_WRITE)가 재사용/만료를 삭제 없이 마커 예외로 신호해 회전 트랜잭션을 롤백(비관적 락 해제)하고, 비트랜잭션 오케스트레이터 `AuthService.refreshAccessToken()`이 락 해제 뒤 `RefreshTokenRevoker.revokeByEno()`(`REQUIRES_NEW`+flush)로 패밀리를 확정 폐기한 뒤 `InvalidRefreshTokenException`으로 거부한다. grace 내 동시 재제출은 패밀리를 유지(`ConcurrentRefreshException`). 실 Oracle IT `RefreshTokenIsolationIT`가 재사용·만료 시 패밀리 커밋 삭제(COUNT=0)와 2스레드 동시 회전의 교착 부재(타임아웃 가드)·단일 활성 토큰을 검증. SEC-01(단일 활성)·SEC-04(tokenUse=refresh) 불변식 보존. |

- 최종 검증: it_backend `./gradlew clean check integrationTest` BUILD SUCCESSFUL(unit·JaCoCo 커버리지 게이트·spotlessCheck·로컬 Oracle `@Tag("it")` 통합). 최종 홀리스틱 보안 리뷰 READY(교차 통합·회귀 없음, SEC-08/SEC-09 모두 실 DB 근거로 종결).
- 잔여 후속(비차단): `loadAthIds` 중복 제거(DRY), `refreshAccessToken` 비트랜잭션 전제조건 런타임 가드, revoker 폐기 실패 시 쿠키 삭제 정책 — 별도 과제로 추적.

### ✅ 2026-07-25 백엔드 2026-07-21 범위 잔여과제 정리 (Wave 1~3)

> 2026-07-21 계획 범위의 `TASK.md` 백엔드 과제 중 즉시 구현 가능한 항목과 ERR-08을 해소하고, BE-02·BE-06을 상시 규칙으로 `it_backend/CLAUDE.md`에 이관했습니다. 이후 추가된 BE-19~22는 별도 과제로 유지합니다. 설계: `docs/superpowers/specs/2026-07-21-backend-backlog-cleanup-design.md`, 계획: `docs/superpowers/plans/2026-07-21-backend-backlog-cleanup.md`.

| 상태 | Wave | 과제 | 조치 |
| ---- | ---- | ---- | ---- |
| ✅ Done | 1 | BE-15 `Bplana` 복합키 길이 정합화 | ORM length를 32→30으로 변경해 물리 DDL·`Bplanm`과 일치시키고 `BplanaColumnContractTest`로 계약을 고정했다. |
| ✅ Done | 1 | BE-14 BPLANA 역방향 조회 인덱스 | `V20260725_001__AddBplanaReqDocNoIndex.sql`로 `(REQ_DOC_NO, DEL_YN, ABUS_MNG_NO)` 인덱스를 멱등 이력화했다. 로컬 63행에서 `INDEX RANGE SCAN`, SELECT Cost 3을 확인했고 `BplanaReqDocNoLookupIt`로 실제 Oracle 조회를 검증했다. DB 커밋 `cbd81a1`. |
| ✅ Done | 1 | BE-16 공통코드 업로드 배치화 | 선조회 1회(`findAllByCIdInAndDelYn`) + 메모리 upsert + `saveAll`로 전환하고 요청 내 중복 키의 마지막 값 반영 의미를 보존했다. |
| ✅ Done | 2 | BE-13 기준 계획 탐색 N+1·동률 제거 | `findBaselineReqDocNos` 조인 단건 조회와 `IT_PTL_ASCT_ID DESC` tie-break를 적용했다. 로컬 BASCTM 3행에서 Cost 5, BPLANM full scan + 기존 `IX_TPRMPP_BASCTM_01` range scan을 확인해 추가 인덱스는 만들지 않았고 `CouncilBaselineLookupIt`로 계약을 고정했다. |
| ✅ Done | 2 | ERR-08 스냅샷 손상·빈 결과 구분 | 심의 대상 경로의 JSON 파싱 실패는 문서번호를 포함한 `DataCorruptionException`으로 HTTP 500을 반환하고, 결과서 사업명은 WARN+관리번호 폴백을 유지했으며 기준 계획 조회의 예외 스킵을 제거했다. |
| ✅ Done | 2 | BE-12 사업 일괄 상세 N+1 제거 | 사업·결재선·조직·코드·품목·예산·IOE 명칭을 영역별 IN 배치 조회 후 메모리 조립하도록 전환했다. 입력 순서·중복·실패 ID 계약과 단건/일괄 상세 parity, IOE 공통코드 조회 횟수, 중복 활성 사업 데이터 손상 계약을 `ProjectServiceTest`·`ProjectServiceCoverageTest`로 검증했다. |
| ✅ Done | 3 | BE-02 통합 테스트 하네스 규칙화 | 미보유 Oracle IT 3건(BPLANA 역방향 조회·기준 계획·사업별 평가의견)을 보충하고 “신규 QueryDSL·JPQL·네이티브 조회는 실제 Oracle IT 필수” 규칙을 `it_backend/CLAUDE.md` §9로 이관했다. |
| ✅ Done | 3 | BE-06 Javadoc 정책 이관 | “신규 미분류 경고 불허 + 기능 변경 시 의미 있는 공개 계약부터 점진 정리” 정책을 `it_backend/CLAUDE.md` §9로 이관하고 수치형 잔여 과제 추적을 종료했다. |

- 재분류: BE-03·BE-18은 재개 조건을 명시해 🏛️ External로 전환했다. BE-17의 완료된 BESTTM PK 정합화는 결정 대상에서 제외하고, 나머지 네 정책은 사용자 결정 후 별도 기록한다. BE-19~22는 이 계획과 무관한 별도 과제로 유지한다.
- 최종 코드: `it_backend` 병합 커밋 `31641eb`; 인덱스 이력은 `it_database` 커밋 `cbd81a1`.
- 최종 검증: `./gradlew clean check --rerun-tasks` BUILD SUCCESSFUL(8분 27초, 단위 테스트 2,205건·실패 0·오류 0·skip 1, JaCoCo·Spotless 통과), 이어서 `./gradlew integrationTest --rerun-tasks` BUILD SUCCESSFUL(57건·실패 0·오류 0·skip 0).

### ✅ 2026-07-25 TASK.md 완료 항목 정리 이관

> `TASK.md` Clean Code 부채 §에서 `✅ Done` 항목을 활성 목록에서 제거하고 정리했습니다. CQ-02·03·04·05·07·08·10·11·12·13·14는 아래 2026-07-21 Clean Code Wave 0·1·2 절에 이미 완료 근거가 등재되어 있어(중복 잔존분) `TASK.md`에서만 제거했습니다. 아직 미이관 상태였던 `CQ-09`만 아래에 완료 근거를 신규 등재합니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | CQ-09 | 파일 업로드 서비스 추출 후 `FileService`의 dead code 제거 | 2026-07-19 확인: 업로드 경로 생성·디렉터리 준비·UUID 채번은 `FileUploadUnitService`로 이동했고 `FileService`의 잔여 private 메서드·필드·import는 모두 사용 중이라 제거 대상 dead code가 없음을 확인했다. 추출 커밋 `d25dc87`, 후속 정리 `bb5b64c`(2026-07-25 두 커밋 모두 it_backend 저장소에 존재 재확인). |

### ✅ 2026-07-21 Clean Code Wave 2 (구조·타입 개선)

> Clean Code 부채 이행계획(`docs/superpowers/plans/2026-07-21-clean-code-wave2-structure-types.md`)의 Wave 2를 완료했습니다. Wave 0에서 구축한 안전망(PDF 구조 스냅샷·`test:e2e:core`·커버리지 게이트) 위에서 모두 기능 불변으로 수행했습니다. 분해 전 검증 기준은 `docs/superpowers/notes/2026-07-21-wave2-qa-checklist.md`에 고정했습니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | CQ-11 | `default`·`admin` 레이아웃의 중복 앱 셸 공통화 | 템플릿·스타일이 100% 동일하던 두 레이아웃의 골격을 `components/AppShell.vue`로 추출하고 각 레이아웃을 얇은 래퍼로 전환했다. 레이아웃 이름(`default`/`admin`)과 페이지의 `layout: 'admin'` 선언, 라우트 가드 구조는 그대로 유지된다. 일반·관리자 화면 E2E(core 14건 + access-control·realtime-logs 9건) 통과. it_frontend 커밋 `c26d0d5`. |
| ✅ Done | CQ-03 | 프로덕션 `any` 타입 우회 제거 | 4개 배치로 나눠 제거했다. 배치① 결재·사업집행(`ccd17ae`, `c45d78e`) — 공용 `getErrorMessage(unknown, fallback)`를 `utils/common.ts`에 추가해 `catch (e: any)` 패턴을 대체. 배치② Tiptap·Excel·PDF(`486b629`, `344d759`, `cd919b7`) — `@tiptap/core`·exceljs 제공 타입 적용, pdfmake 0.3 런타임과 0.2 타입 선언의 불일치는 `pdf/compat.ts` 단일 경계로 격리. 배치③ 가이드 문서(`8e14f43`). 배치④ 예산·인라인편집·info·잔여(`20a4f42`, `ac75df1`, `965e4a3`). 정당 사유 잔여는 3건(파일·사유는 TASK.md 기재)이며 각 지점에 사유 주석이 있다. |
| ✅ Done | CQ-02 | 대형 프론트 composable/page 분해 | 4개 파일을 façade·ctx 팩토리 패턴으로 분해했다(모두 기능 불변, 템플릿·페이지 무변경). ① IT예산 PDF: 1,290 → **661줄**, `pdf/` 4모듈(fonts·textPrimitives·headerSection·projectSection) — 각 커밋마다 CQ-04 스냅샷 `passed`(재작성 없음) 확인(`1005f73`~`83df597`). ② 계획 상세: 2,158 → **1,239줄**, `features/plan/` 5모듈(Excel·HWPX·PDF·인쇄·TOC)(`f1c4ad0`~`0f9834b`). ③ 사업 폼: 2,192 → **1,229줄**, `features/project/` 6모듈(모델·코드필드·직원검색·저장·계속사업·로드)(`06edd16`~`7233cd8`). ④ 전산업무비 목록: façade **380줄** + `costList/` 7모듈 — 공개 키 82개 기준선 테스트로 계약 불변을 고정했고 소비 페이지 `pages/info/cost/index.vue`는 0변경(`84b4679`~`d51d07f`). |

- 최종 검증: `npm run check` 0 errors, `npm test` 128 파일/1,645건 통과, `npm run test:e2e:core` 14건 통과. 도메인별로 `budget`·`cost`·`documents`·`projects`·`tiptap-variable` spec을 각 분해 단계에서 함께 실행했다.
- 수동 QA 체크리스트(`docs/superpowers/notes/2026-07-21-wave2-qa-checklist.md`)의 화면 확인 항목은 사용자 수행 대상으로 남아 있다.

### ✅ 2026-07-21 Clean Code Wave 1 (저위험 일괄 정리)

> Clean Code 부채 이행계획(`docs/superpowers/plans/2026-07-21-clean-code-wave1-low-risk-cleanup.md`)의 Wave 1을 완료했습니다. 모든 태스크는 동작 변경 없는 기능 불변 정리입니다. CQ-01·CQ-06은 Wave 3 조건부 항목으로 착수 트리거를 TASK.md에 확정했습니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | CQ-07 | Java 포맷터 도입과 매직 넘버 상수화 | Spotless(google-java-format 1.28.0 AOSP 4칸 들여쓰기) 도입 후 전체 634개 파일 일괄 포맷을 단독 커밋으로 분리했다(it_backend `ac3d058`). spotlessCheck는 check 게이트에 자동 연결된다. 편성률 매직 넘버는 `DEFAULT_DUP_RT`·`PERCENT_BASE` 상수로 정리했고(it_backend `755f278`), Toast 표시시간은 `TOAST_LIFE` 상수를 도입해 장시간 표시(5000/6000/8000) 21개소를 선도 전환했다(it_frontend `d61da36`). 잔여 3000/4000 리터럴은 신규 코드 상수 필수 규칙(it_frontend/CLAUDE.md)으로 점진 관리한다. |
| ✅ Done | CQ-08 | `AdminMenuController.move` 요청 본문 검증 규칙 재정의 | "null=루트 이동" 규칙을 현행 유지로 확정하고 코드 변경 없이 `MoveRequest` Javadoc·Swagger 스키마 설명과 컨트롤러 Javadoc에 명시했다. 빈 본문({})도 루트 이동으로 해석되며 잘못된 대상·순환 계층은 서비스 계층이 검증한다. it_backend 커밋 `a980da3`. |
| ✅ Done | CQ-10 | 미사용 프론트 컴포넌트 제거 | 자동 등록명(디렉터리 접두사·Lazy 변형 포함) 전수 grep으로 참조 0건을 재확인한 뒤 `IconActivity.vue`, `ReviewVersionHistory.vue`를 제거했다. 타입 검사·단위 테스트 통과. it_frontend 커밋 `d14d847`. |
| ✅ Done | CQ-12 | 백엔드 Gradle 프로젝트 설명 교체 | `description = 'IT Project Portal backend API'`(ASCII)로 교체. it_backend 커밋 `31e0b07`. |
| ✅ Done | CQ-14 | 미사용 REST Docs·Asciidoctor 빌드 설정 제거 | `src/docs`·REST Docs 테스트 미사용을 재확인하고 asciidoctor 플러그인, snippetsDir ext, restdocs 의존성 2건, test outputs.dir, asciidoctor 태스크 블록을 제거했다. `clean check` 통과, `tasks --all`에서 asciidoctor 태스크 소멸 확인. it_backend 커밋 `95929fd`. |

- 최종 검증: it_backend `./gradlew check` BUILD SUCCESSFUL(테스트·커버리지 게이트·spotlessCheck 포함), it_frontend `npm run check`·`npm test`(128 파일/1,636건) 통과.
- Wave 3 조건부 확정: CQ-01(대형 서비스 분해)·CQ-06(Bcostm.update record 전환)은 해당 도메인 기능 변경 착수 시 함께 수행하는 트리거를 TASK.md에 기록했다.

### ✅ 2026-07-21 Clean Code Wave 0 (검증 기반 구축)

> Clean Code 부채 이행계획(`docs/superpowers/plans/2026-07-21-clean-code-wave0-verification-foundation.md`)의 Wave 0을 완료했습니다. Wave 2 리팩터링의 안전망(커버리지 게이트·PDF 회귀 스냅샷·핵심 E2E 명령)을 구축했습니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | CQ-04 | PDF/HWPX/Excel 산출물 회귀 테스트 기준 수립 | 기존 `useItBudgetApprovalFormPdf.test.ts`에 docDefinition 정규화 구조 스냅샷(고정 표시값·표 구조·스타일·페이지 구분 보존, 함수는 `[Function]`으로 구조만 고정)을 추가하고 재실행 고정을 확인했다. HWPX/Excel은 기존 단위 테스트 5개 파일 104건이 기준선 역할을 함을 확인했다. it_frontend 커밋 `7141c7a`. |
| ✅ Done | CQ-05 | E2E 핵심 3개 시나리오를 정기 실행 경로에 편입 | `test:e2e:core` npm script로 로그인·프로젝트 조회/생성·결재 처리 3개 spec을 단일 명령으로 고정하고 실행 절차를 `it_frontend/README.md`에 문서화했다. API 전면 모킹(mockApi.ts) + 테스트 쿠키 주입 방식이라 백엔드·Oracle 기동이 불필요하다. it_frontend 커밋 `6921ab6`. |
| ✅ Done | CQ-13 | JaCoCo 커버리지 검증을 기본 `check` 게이트에 연결 | `jacocoTestCoverageVerification`에 `dependsOn test`를 추가하고 `check`가 커버리지 검증에 의존하도록 연결했다. 사전 실측에서 확인된 CLASS 위반 2건은 임시 기준선 없이 테스트 보강으로 해소했다: `FeasibilityService`(자체점검 upsert·검증 분기 8건 추가, BRANCH 0.50→1.00·COMPLEXITY 0.56→1.00), `AuthService`(토큰 패밀리 중복 예외 1건 추가, COMPLEXITY 0.69→0.72). it_backend 커밋 `1f0301d`. |

- 최종 검증: it_backend `./gradlew check` BUILD SUCCESSFUL(커버리지 게이트 포함), it_frontend `npm run check`·`npm test` 통과, `npm run test:e2e:core` 14건 통과(최초 실행 1건 플레이키 재실행 확인).

### ✅ 2026-07-20 백엔드 잔여과제 조치(Phase A~C)

> `BE-09`의 비결정 대표행 선택, `BE-10`의 팀 조회 N+1·검토자 API 계약, `BE-11`의 파일 메타 NULL 정책을 정리하고, 조사에서 승인된 `BE-03` 안전 후보를 응답 전용 프로젝션으로 전환했습니다. `BE-06`은 최신 전수 기준선으로 상위 오염원과 요청 DTO 경고를 분류·정리했습니다. `BE-07`·`BE-08`의 기존 완료 판정도 함께 종료 이관합니다.

| 상태 | Phase | 종료 항목 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | A | BE-09 비용·사업계획 대표행 결정성 | 비용 대표행 선택기를 공용화하고 최신·일련번호 tie-break를 고정했으며 사업계획 `BG_NO` 연계 키도 결정적 규칙으로 교체했다. 백엔드 병합 커밋 `78306bd`. |
| ✅ Done | B | BE-10 팀 조회 배치화·전역 검토자 API | `findByTemCInAndDelYn` 배치 조회, 팀장 우선·사번 tie-break, 전역 `/api/reviews/reviewers` 계약과 프론트 연동을 적용했다. 백엔드 병합 `d949cab`, 프론트 병합 `be2f4b5`. 구 문서별 경로 제거는 관측 조건이 남아 `TASK.md` BE-18로 추적한다. |
| ✅ Done | B | BE-11 `CFILEM` NULL 정책 통일 | 실제 Oracle과 읽기 소비 경로에 맞춰 `FL_NM`, `FL_PYS_NM`, `FL_KPN_PTH`의 ORM null 계약과 응답 처리를 일치시켰다. 백엔드 병합 `d949cab`. |
| ✅ Done | C | BE-03 안전 프로젝션 구현 | 게시글, 사용자·조직·팀 대표, 계획·안전 예산, 결재 응답, 계약·심의·지급 상세, 관리자 파일·토큰·로그인 이력, 요구사항 버전 조회를 응답 전용 프로젝션으로 분리했다. 백엔드 병합 `540d456`; 후보 판정 보고서 `docs/superpowers/reports/2026-07-be03-projection-survey.md`; Oracle 29개 repository signature·30개 before/after 시나리오 PASS 기록 `it_backend/.superpowers/sdd/task-13-step8-oracle-matrix.md`. |
| ✅ Done | C | BE-06 Javadoc 경고 분류·정리 | Task 14 기준 1,176건에서 `Bprojm`, `ContractController`, `CouncilProjectRow`, `UmsPayload`, `Btermm`과 `ApplicationDto` 요청 DTO의 122건을 해소했다. 최종 1,054건 중 `ApplicationDto` 11건은 역할별 허용 잔여이며 신규 미분류는 0건이다. 백엔드 병합 `540d456`; 최종 기록 `it_backend/.superpowers/sdd/task-17-final-verification.md`. |
| ✅ Done | 선행 확인 | BE-07 CFILEM 컬럼명 정합·BE-08 BTERMM 인덱스 검토 | 활성 Java/SQL과 실제 `TPRMPP_CFILEM` 컬럼명이 일치하고, `TPRMPP_BTERMM(BG_NO,BG_SNO)` 인덱스가 현재 조회와 데이터 규모에 충분해 추가 인덱스가 불필요함을 확인했다. |

- 최종 백엔드 검증: `./gradlew test --rerun-tasks` 2,170건(실패 0, 오류 0, Oracle 수동 통합 1건 skip), `./gradlew javadoc --rerun-tasks` 성공·1,054 warnings.
- Phase B 통합 검증: 로컬 Oracle `integrationTest` 32건(실패·오류·skip 0), 프론트 Vitest 1,633건 통과.

### ✅ 2026-07-19 보안·에러 처리 Remediation Phase 1

> `TASK.md`의 `SEC-04`, `SEC-05`, `ERR-06`을 코드·정책 문서·회귀 테스트 및 로컬 DB 적용 이력과 대조하고 구현 완료로 판정해 종료 이관했습니다. 설계는 `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md`의 Phase 1을 따릅니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | SEC-04 | Access/Refresh Token 용도 구분과 검증 강제 | JWT에 `tokenUse=access/refresh`를 발급하고 Access 필터와 Refresh 서비스가 각 용도 allowlist를 검증합니다. 과도기 Access 토큰만 claim 누락을 허용하며 Refresh 경로는 누락·오용·비문자 claim을 거부하고 401 응답과 인증 쿠키 삭제를 수행합니다. |
| ✅ Done | SEC-05 | 비게시판 업무 파일의 부모 자원 기준 읽기 권한 검증 | `FileReadAuthorizerRegistry`와 게시판·가이드·요구사항 정의서·협의회 authorizer를 적용했습니다. 미등록·null 종류는 기본 거부하고 목록·메타·다운로드·미리보기 네 경로가 동일 검증을 사용합니다. 부모 키 요청 캐시와 레거시 키 정규화도 반영했으며, `V20260719_001__NormalizeCfilemParentKeys.sql`이 로컬 DB 설치 순번 45·성공 상태로 적용된 것을 확인했습니다. |
| ✅ Done | ERR-06 | 감사로그 저장 실패의 지속 탐지·격리 | 원 업무 커밋 후 감사로그를 `REQUIRES_NEW`로 저장하고 실패를 `audit.log.write.failure` 메트릭과 구조화 ERROR 로그로 노출합니다. `ThreadLocal` 재진입 가드로 실패 기록의 재귀를 차단하고 `/actuator/metrics`는 관리자에게만 허용합니다. 감사 저장 실패가 원 업무를 롤백하지 않는 계약도 Oracle 통합 테스트로 확인했습니다. |

- 주요 구현: `it_backend` SEC-04 커밋 `c507935`, `5ecb527`, `cf70912`, `8137fc5`; SEC-05 커밋 `1608287`, `c7512cb`, `5206e6e`, `b78ef29`, `a840483`, `d8212ec`, `ee25c14`, `94601a3`, `32b1f22`, `fb0f7ea`, `2d34dc6`, `82f5b06`; ERR-06 커밋 `66d3658`, `05e2689`, `0a337bf`, `cbf770e`, `6627817`, `204df59`, `0506a7c`.
- DB 정합화: `it_database` 커밋 `3183b60`, `it_database/migrations/V20260719_001__NormalizeCfilemParentKeys.sql`; 로컬 `ITPOWN.FLYWAY_SCHEMA_HISTORY` 적용 성공 확인.
- 2026-07-19 재검증: SEC-05 코드 범위를 포함한 선별 단위·서비스·컨트롤러 테스트 159건과 Oracle 통합 테스트(`FileReadAuthorizationIT`, `AuditFailureIsolationIT`) 11건 모두 통과(실패·오류·스킵 0건).

### ✅ 2026-07-19 보안·에러 처리 Remediation Phase 2

> `TASK.md`의 `SEC-03`, `SEC-07`, `ERR-07`을 구현·검증하고 종료 이관했습니다. 설계는 `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md`, 실행 계획은 `docs/superpowers/plans/2026-07-19-security-error-handling-remediation-phase-2.md`를 따릅니다. SEC-06은 원문 제거 마이그레이션의 Flyway 버전 중복, ERR-05는 그 뒤 마이그레이션 미적용이 재확인되어 `TASK.md`로 환원했습니다(이후 아래 2026-07-19 배포 정합성 후속에서 종료).

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | SEC-03 | GWE `IF_ID` 설정 단일화 | `GweProperties`와 `eai.gwe.if-id`를 유일한 설정 원천으로 적용하고 dispatcher·집행 4단계의 중복 상수를 제거했습니다. |
| ✅ Done | SEC-07 | 운영 위험 토글 기동 차단·SSO 세션 고정 방어 | `prod`에서 mock SSO·Bearer 폴백·`Secure=false`를 fail-fast 처리하고 SSO 인증 성공 시 세션 ID를 교체합니다. |
| ✅ Done | ERR-07 | 정상 빈 상태와 조회·변환 실패 UI 분리 | 에디터·자동완성·통화·예산기간·사업개요·과거버전·PDF/인쇄 경로에 경고, 재시도, 기존 데이터 유지 또는 대체 출력을 적용했습니다. |

- 주요 파일: `it_backend/common/system/service/AuthService`, `EnvironmentValidator`, `common/notification/**`, `infra/eai/config/GweProperties`, `it_frontend/app/components/editor/**`, `app/composables/**`, `app/pages/**`, `app/stores/review.ts`
- 검증 명령: `it_backend ./gradlew clean test`, `it_frontend npm run format:check`, `npm run check`, `npm test`, `npx playwright test tests/e2e/security-error-remediation-phase2.spec.ts --project=chromium`

### ✅ 2026-07-19 보안·에러 처리 배포 정합성 후속 (SEC-06·ERR-05)

> Phase 2에서 `TASK.md`로 환원했던 `SEC-06`(Flyway 버전 중복)·`ERR-05`(알림 outbox 마이그레이션 미적용)를 마이그레이션 개번·적용·검증 완료로 종료 이관했습니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | SEC-06 | Refresh Token 원문 제거 마이그레이션의 Flyway 버전 중복 해소·적용 | `it_database` 커밋 `0e286a6`이 `V20260719_001__RemovePlainRefreshToken.sql`을 `V20260719_003`으로 개번했습니다(성공 적용된 SEC-05 `V20260719_001__NormalizeCfilemParentKeys.sql`은 미수정, 설치 순번 45 유지). 로컬 `ITPOWN.FLYWAY_SCHEMA_HISTORY`에 설치 순번 47·버전 `20260719.003`·성공 상태로 2026-07-19 적용을 확인했습니다. 적용 후 `TPRMPP_CRTOKM.API_TOK_CONE`은 NULL 허용으로 전환되고 전 행 원문이 NULL이며, `ECY_RNW_PUB_TOK_CONE`은 NOT NULL로 전환되고 해시 누락 0행입니다. |
| ✅ Done | ERR-05 | 알림 outbox 상태 마이그레이션 적용 | `V20260719_002__AddNotificationDispatchState.sql`이 설치 순번 46·성공 상태로 2026-07-19 적용을 확인했습니다. `TPRMPP_CINFMM`에 `INFM_SD_STS_C`(NOT NULL, 기본 '02')·`RE_TRY_NOT`(NOT NULL, 기본 0)·`ERR_CONE`(NULL 허용) 컬럼과 `IX_CINFMM_SD_RETRY(INFM_SD_STS_C, RE_TRY_NOT, SD_DTM)` 인덱스가 생성됐습니다. 재시도 동작은 `NotificationDispatchServiceTest`·`CinfmmTest` 단위 6건과 `CinfmmRepositoryImplTest` 로컬 Oracle 통합 2건 통과로 검증했습니다. |

- 검증 명령: `it_backend ./gradlew test --tests '*NotificationDispatchServiceTest' --tests '*CinfmmTest' --tests '*CinfmmRepositoryImplTest'`, `./gradlew integrationTest --tests '*CinfmmRepositoryImpl*'` 모두 성공(실패·오류·스킵 0건).

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
| ✅ Done | 🟢 Low | `EaiServiceTest`에 `umsTrSno=""`/비숫자 케이스 추가 | `EaiServiceTest.umsTrSnoBlank_returnsFailure`, `EaiServiceTest.umsTrSnoNonNumeric_returnsFailure`가 `Integer.parseInt` 실패 → `EaiResult.failure` 경로를 검증 |

검증:
- Backend focused: `./gradlew --no-daemon test --tests AuthServiceTest --tests TiptapVariableServiceTest --tests ItBudgetServiceTest --tests ItBudgetControllerTest --tests AuditLogPersisterTest --tests FileServiceTest --warning-mode all` 성공.
- Backend integration: `./gradlew --no-daemon integrationTest --tests EstimateRepositoryIntegrationTest --tests AuditLogPersisterIntegrationTest --warning-mode all` 성공.
- Frontend focused: `npm test -- tests/unit/utils/hwpx-images.test.ts tests/unit/composables/useTabs.test.ts tests/unit/utils/common.test.ts` 성공(182 tests).
- Backend full: `./gradlew --no-daemon cleanTest test --warning-mode all` 성공. Frontend `npm run typecheck`는 기존 테스트 fixture 타입 오류(`tests/e2e/generate-report.ts`, 다수 unit test fixture)로 실패하며 이번 변경 파일 진단은 확인되지 않음.

### ✅ 2026-07-07 무테이블 DDL 잔여 개선

> `TASK.md`에서 DB 테이블/컬럼/PK 변경이 불필요한 항목만 선별해 Subagent-Driven 방식으로 구현·검증. 중첩 저장소별로 커밋했으며, 루트 저장소에서 무시되는 하위 저장소 파일은 각 저장소 내부에서만 커밋했다. 실행 계획: `docs/superpowers/plans/2026-07-07-task-no-table-ddl-improvement.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | SEC-01 Refresh Token 회전 동시성·활성 토큰 1개 불변식 강화 | `it_backend` `db7322d..46b6959`; `AuthService`, `AuthServiceTest`. 검증: `./gradlew test --tests com.kdb.it.common.system.service.AuthServiceTest --warning-mode all`, `./gradlew test --warning-mode all` |
| ✅ Done | 🟡 Medium | SEC-02 부서코드 없는 비관리자 조회 차단 | `it_backend` `db7322d`; `PaymentService`, `PaymentServiceTest`. 검증: `./gradlew test --tests com.kdb.it.domain.payment.service.PaymentServiceTest --warning-mode all` |
| ✅ Done | 🟡 Medium | ERR-01 문서 버전 본문·코멘트·이력 조회 실패를 `loadWarnings` 기반 오류 상태로 표시 | `it_frontend` `df3fb05..9664e78`; `stores/review.ts`, `pages/info/documents/[id]/*`, `review.direct.test.ts`. 검증: `npm test -- tests/unit/stores/review.direct.test.ts`, `npm run typecheck` |
| ✅ Done | 🟡 Medium | ERR-02 클립보드 기록 실패 중복 제한 진단 추가 | `it_frontend` `df3fb05`; `useTableCellSelection.ts`, 관련 단위 테스트. 검증: `npm test -- tests/unit/composables/useTableCellSelection.direct.test.ts` |
| ✅ Done | 🟡 Medium | FE-01 `info/index.vue` KPI·진행현황 정적 데이터 API 기반 전환 | `it_frontend` `85461b1`; `app/pages/info/index.vue`. 검증: `npm run typecheck` |
| ✅ Done | 🟢 Low | FE-02 예산 목록/승인 화면 금액 0 표시 정책 보정 | `it_frontend` `0463584`; `budget/approval.vue`, `budget/list.vue`. 검증: `npm test -- tests/unit/composables/useTiptapVariables.test.ts`, `npm run typecheck` |
| ✅ Done | 🟡 Medium | BE-01 HWPX/문서 내보내기 회귀 테스트 범위 확대 | `it_frontend` `32348d8`; `hwpx.test.ts`, `hwpx-images.test.ts`, `useHwpxExport.direct.test.ts`. 검증: `npm test -- tests/unit/utils/hwpx.test.ts tests/unit/utils/hwpx-images.test.ts tests/unit/composables/useHwpxExport.direct.test.ts` |
| ✅ Done | 🟡 Medium | BE-02 `CinfmmRepositoryImpl` Oracle 통합 테스트 추가 | `it_backend` `53bc356`; `CinfmmRepositoryImplTest`. 검증: `./gradlew integrationTest --tests "*CinfmmRepositoryImpl*" --warning-mode all` |
| ✅ Done | 🟡 Medium | BE-03 `ProjectRepositoryImpl`/`CostRepositoryImpl` 목록 프로젝션 회귀 가드 추가 | `it_backend` `53bc356`; `ProjectRepositoryImplTest`, `CostRepositoryImplTest`. 검증: `./gradlew test --tests "*ProjectRepositoryImpl*" --tests "*CostRepositoryImpl*" --warning-mode all` |
| ✅ Done | 🟡 Medium | BE-04 품목 금액 환율 환산 규칙 통일 — `BITEMM.amt`는 KRW 금액으로 직접 합산 | `it_backend` `c2aa574..d407430`; `BudgetWorkService`, `ProjectBudgetSummaryService`, Budget query repositories. 검증: `./gradlew test --tests "*BudgetWorkService*" --tests "*ProjectBudgetSummaryService*" --warning-mode all` |
| ✅ Done | 🟢 Low | BE-05 알림 문구 null-safe 말줄임 공통화 | `it_backend` `53bc356`; `NotificationMessageFormatter`, `ApplicationService`, `BoardPostService`, `BoardCommentService`, `NotificationEventListener`. 검증: `./gradlew test --tests "*NotificationMessageFormatter*" --warning-mode all` |
| ✅ Done | 🟢 Low | BE-06 `CouncilDto`·`BudgetStatusDto` Javadoc 경고 정리 | `it_backend` `53bc356`; DTO JavaDoc 보강. 검증: `./gradlew javadoc --warning-mode all` |
| ✅ Done | 🟡 Medium | TIP-01 Tiptap 변수 prop 적용 범위 확대 | `it_frontend` `85461b1..3f3c4ac`; 문서/계획/게시판/가이드 페이지. 검증: `npm test -- tests/unit/composables/useTiptapVariables.test.ts`, `npm run typecheck` |
| ✅ Done | 🟡 Medium | TIP-04 VariableNodeView 작성 직후 `resolveTokens` 호출 및 비동기 응답 병합 보강 | `it_frontend` `85461b1..0463584`; `TiptapEditor.vue`, `useTiptapVariables.ts`. 검증: `npm test -- tests/unit/composables/useTiptapVariables.test.ts`, 재리뷰 clean |
| ✅ Done | 🟡 Medium | LOG-01 `/api/admin/realtime-logs` 관리자/일반/미인증·커서 검증 보강 | `it_backend` `87ed5bd`; `RealtimeLogControllerTest`, `RealtimeLogRepositoryTest`. 검증: `./gradlew test --tests "*RealtimeLog*" --warning-mode all` |
| ✅ Done | 🟡 Medium | LOG-02 라이브 피드 행 클릭에서 로그번호 포함 상세 이동 연결 | `it_frontend` `6f7d736`; `RealtimeDetailDrawer.vue`, `RealtimeFeedTable.vue`, `admin/logs/[logKey].vue`, E2E. 검증: `npm run test:e2e -- tests/e2e/admin/realtime-logs.spec.ts` |
| ✅ Done | 🟢 Low | LOG-03 SSE/WebSocket 전환 운영 임계치·feature flag 설계 문서화 | 루트 `3d137d6`; `docs/superpowers/notes/2026-07-07-realtime-log-explain.md`. 실제 push 구현은 별도 잔여로 유지 |
| ✅ Done | 🟢 Low | LOG-04 로그 보존 정책·아카이브 분리 View 운영 방향 문서화 | 루트 `3d137d6`; 신규 테이블 없이 운영 정책 노트 작성. 실제 보존기간 시행은 별도 잔여로 유지 |
| ✅ Done | 🟢 Low | LOG-05 실시간 로그 즐겨찾기·필터 브라우저 저장 | `it_frontend` `c1f14a9`; key `it-portal:realtime-log-preferences:v1`, schema `{ version: 1; favoriteLogKeys: string[]; filter: 'all' \| 'favorites' }`. 동일 브라우저 프로필의 UI 선호만 저장하며 서버·계정 간 동기화하지 않고 사용자·권한·인증정보·로그 행은 저장하지 않음. 검증: 단위 10/10, E2E 5/5, 전체 1,801, `npm run check` |
| ✅ Done | 🟡 Medium | LOG-06 `V_ITPAPP_LOG_FEED` 실행계획/인덱스 현황 기록 | 루트 `3d137d6`; 기존 `V20260629_005`와 `IX_CCODEL_CHG_DTM` 유효성 확인, 신규 DDL 없음 |
| ✅ Done | 🟡 Medium | LOG-07 실시간 로그 Playwright E2E 실행 | `it_frontend` `6f7d736`; `tests/e2e/admin/realtime-logs.spec.ts`. 검증: `npm run test:e2e -- tests/e2e/admin/realtime-logs.spec.ts` |
| ✅ Done | 🟡 Medium | BRD-01 게시판 본문 4000자 정책 검증 추가 | `it_backend` `61d26d4`, `it_frontend` `487bcb1`; `BoardPostDto`, board form/edit UI, controller tests. 검증: `./gradlew test --tests "*Board*" --no-daemon --max-workers=1`, `npm run test:e2e -- tests/e2e/board.spec.ts` |
| ✅ Done | 🟢 Low | BRD-04 게시판 멘션 알림 연동 확인·회귀 유지 | `it_backend` `61d26d4`; 기존 `BoardPostService`/`BoardCommentService` 알림 이벤트 경로 유지 및 테스트 통과 |
| ✅ Done | 🟢 Low | BRD-07 답변글·댓글 깊이 UI 5단계 캡 | `it_frontend` `487bcb1`; `BoardCommentTree.vue`, board detail/list 화면. 검증: `npm run typecheck`, `npm run test:e2e -- tests/e2e/board.spec.ts` |
| ✅ Done | 🟢 Low | BRD-08 게시판 검색 키워드 최소 2자 강제 | `it_backend` `61d26d4`, `it_frontend` `487bcb1`; `BoardPostService.validateSearchCondition`, board E2E. 검증: `./gradlew test --tests "*Board*"`, `npm run test:e2e -- tests/e2e/board.spec.ts` |
| ✅ Done | 🟡 Medium | BRD-09 게시물 목록 서버사이드 페이지네이션 | `it_backend` `61d26d4`, `it_frontend` `487bcb1`; backend `Page<BoardPostDto.ListItem>`, frontend `BoardPostPage`. 검증: backend Board tests + board E2E |
| ✅ Done | 🟡 Medium | BRD-10 게시판 단위/E2E 테스트 확대 | `it_backend` `61d26d4`, `it_frontend` `487bcb1`; `BoardPostControllerTest`, `BoardPostServiceTest`, `board.spec.ts`. 검증: `./gradlew test --tests "*Board*"`, `npm run test:e2e -- tests/e2e/board.spec.ts` |
| ✅ Done | 🟢 Low | EAI-03 `NotificationDispatcher` → `EaiService` 라우터 연결 | `it_backend` `56a8cee..86eaa04`; `NotificationDispatcherRouter`, `NotificationService`, `NotificationDispatcherRouterTest`. 검증: `./gradlew test --tests "*Notification*" --warning-mode all` |
| ✅ Done | 🟡 Medium | EAI-04 `Estimate`/`Deliberation`/`Contract`/`PaymentService` 상태전이 EAI side-effect 연결 | `it_backend` `56a8cee`; 4개 도메인 서비스·테스트. 검증: `./gradlew test --tests "*EstimateServiceTest" --tests "*DeliberationServiceTest" --tests "*ContractServiceTest" --tests "*PaymentServiceTest" --warning-mode all` |

검증:
- Backend Task 5 focused: `./gradlew test --tests "*RealtimeLog*" --tests "*Board*" --tests "*Eai*" --tests "*Notification*" --tests "*ApplicationServiceTest" --warning-mode all` 성공.
- Frontend: `npm run typecheck`, `npm run test:e2e -- tests/e2e/board.spec.ts`, `npm run test:e2e -- tests/e2e/admin/realtime-logs.spec.ts` 성공.
- DDL 가드: `it_database`와 `it_backend/src/main/resources` diff에서 `CREATE TABLE|ALTER TABLE|ADD .*COLUMN|DROP COLUMN|PRIMARY KEY|CONSTRAINT` 금지 패턴 없음.

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

> `TASK.md` 🔒 보안 § 잔여 6건 구현 완료 이관(#1·#2·#3·#5·#6·#7). 코드 커밋은 중첩 `it_backend`/`it_frontend`/`it_database` repo. #4 Blocklist는 감내(☑️ Accepted)로 종료 이관. plan: `docs/superpowers/plans/2026-06-29-security-hardening.md`, design: `docs/superpowers/specs/2026-06-29-security-hardening-design.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 결정 + CLAUDE.md 명시 — `app.auth.allow-bearer-header` 플래그로 게이팅(base/prod=false, dev/local=true), 헤더 폴백 비활성 시 쿠키 전용 | `JwtAuthenticationFilter`, `it_backend/CLAUDE.md §5.6`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `it-portal-user` 쿠키 변조 시 프론트 관리자 가드 E2E 검증 — 백엔드 경계 테스트 `AdminSecurityBoundaryTest`가 `/api/admin/**`은 JWT 필수(`it-portal-user` 무시)→401 입증, 프론트 E2E 스펙 `access-control.spec.ts` 추가(로컬 실행) | `AdminSecurityBoundaryTest`, `tests/e2e/access-control.spec.ts`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | SSO 운영 설정 검증 강화 — `EnvironmentValidator`가 prod에서 `allow-direct-eno`/`frontend-url`/cors 이미 차단, `app.dev.user-switch.enabled=true` prod 가드 추가. `getClientIp`는 이미 `ClientIpResolver`(trusted-proxy) 적용. CLAUDE.md §5.6 정정 | `EnvironmentValidator`, `ClientIpResolver`, `it_backend/CLAUDE.md §5.6`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | [후속/T10] Refresh Token 재사용 탐지(토큰 패밀리/세대) — `TPRMPP_CRTOKM`에 `FAM_NM`/`AVL_YN` 추가(Flyway `V20260629_001`), `AuthService` 패밀리 회전 + 재사용 탐지(회전 grace 윈도우로 다중탭 오탐 방지) | `TPRMPP_CRTOKM`(`V20260629_001`), `AuthService`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | Tiptap 변수 metadata 프로젝트 카탈로그 권한 필터링 — `getMetadata(user)` 부서(bbrC) 필터(ADMIN/부서매니저 전체), 캐시 키 사용자 부서 기준 분리 | `TiptapVariableController.java`, `TiptapVariableService.java`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | 사업집행 4단계 `changeStatus` role 분기(구 [W3 카브아웃]) — ADMIN 전용 전이로 구현(`OwnershipVerifier.verifyAdmin`, 4개 서비스 적용), CLAUDE.md §5.18 갱신 | `EstimateService`/`DeliberationService`/`ContractService`/`PaymentService`, `OwnershipVerifier.verifyAdmin`, `it_backend/CLAUDE.md §5.18`, 종료일: 2026-06-29 |
| ☑️ Accepted | 🟡 Medium | Access Token Blocklist 도입 검토 — stateless JWT·access 15분 단기·사내 3천명 조건에서 잔존 access(최대 15분) 위험 수용 | `AuthService.logout()`은 refresh 삭제, T10 재사용 탐지로 탈취 대응. 2026-06-29 감내 결정 |

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

### 2026-07-19 — 보안·에러 처리 Remediation Phase 3 (ERR-03·ERR-04)

- **변경 파일**
  - 프론트 진단·복구: `app/utils/diagnostics.ts`, `app/utils/file-meta-update.ts`, `app/composables/useHwpxExport.ts`, `app/composables/useExcalidrawAttachment.ts`, 문서 등록·상세/사업 등록/가이드/예산 현황 화면, Tiptap 확장·표 도구와 관련 단위 테스트.
  - 비운영 자산 경계: `it_backend/sso/README.md`, 양쪽 `oss/README.md`, Maven/npm 로컬 저장소 PowerShell 도구의 의도적 인코딩 실패 진단.
- **자동 검증 4개**
  1. `it_frontend npm run format:check` — PASS.
  2. `it_frontend npm run check` — PASS(0 errors, 기존 `vue/attribute-hyphenation` 경고 3건).
  3. `it_frontend npm test` — 전체 Vitest suite PASS.
  4. `it_backend .\gradlew.bat clean test --console=plain` — `BUILD SUCCESSFUL`.
- **QA 시나리오 5개 결과** — 브라우저 수동 조작 대신 동일 실패를 자동 주입하거나 소스 계약으로 재현했다.
  1. 부서 조회·Excalidraw 변환 실패 후에도 HWPX 생성이 계속되고 `일부 내용 제외` 경고가 각각 1회 노출됨 — `useHwpxExport.direct.test.ts` PASS.
  2. 파일 메타 일부 실패 ID 보존, 경고와 재시도 버튼, 성공 ID 치환 계약 — `file-meta-update.test.ts`, `useExcalidrawAttachment.test.ts`, `document-file-meta-warning.test.ts` PASS.
  3. 가이드 첨부 실패를 정상 빈 목록과 구분하고 재시도 제공 — `guide-attachment-error.test.ts` PASS.
  4. 손상된 예산 컬럼 설정 삭제, 기본값 복구, 제한 경고 계약 — `budgetStatusFooterTotals.test.ts` PASS.
  5. Tiptap DOM 매핑 반복 실패를 분당 1회·`tablePos` 포함 진단으로 제한하고 DOM 전용 보정이 문서 모델을 변경하지 않음 — `tiptap-error-diagnostics.test.ts`, `useTiptapTableTools.test.ts` PASS.
- **벤더 샘플 유지 결정** — SSO 공급 계약과 장애 대응 참고자료이므로 유지한다. Gradle `main`·`test` 소스셋과 운영 WAR에는 포함하지 않고, 향후 정적분석에서는 `it_backend/sso/**`를 vendor/non-production 경로로 제외한다. 삭제는 계약·보존 기간·운영 담당자 승인을 확인하는 별도 작업에서만 결정한다.

## 📋 완료 로그 (시간순)

| 상태 | 일자 | 영역 | 조치 |
| :--: | :--: | :--: | --- |
| ✅ Done | 2026-07-19 | 보안/에러 처리 | SEC-04·SEC-05·ERR-06 완료 재검증 — JWT 용도 allowlist, 업무 파일 부모 권한·default-deny와 SEC-05 마이그레이션 적용 성공, 감사로그 실패 메트릭·재진입 방지·트랜잭션 격리를 확인. 선별 테스트 159건과 Oracle 통합 테스트 11건 통과. SEC-06은 별도 Flyway 정합성 잔여로 환원. |
| ✅ Done | 2026-07-19 | 에러처리/비운영 자산 | ERR-03·ERR-04 완료 — HWPX 부분 누락 경고, 파일 메타 실패 ID 보존·재시도, 보조 조회 오류 상태, 손상 설정 복구, Tiptap rate-limit 진단을 반영하고 SSO/OSS 비운영 경계와 스캔 제외·삭제 판단 기준을 문서화. 프론트 전체 게이트와 백엔드 `clean test` 통과. |
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
