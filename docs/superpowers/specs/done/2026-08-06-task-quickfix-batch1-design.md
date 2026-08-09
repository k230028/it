# 잔여과제 저비용 배치 1 조치 설계 — ERR-14 · BE-34 · FE-21 · FE-30①

- 작성일: 2026-08-06
- 대상 과제: `TASK.md` **ERR-14**(401 무한 재조회) · **BE-34**(OpenAPI 파라미터명 유실) · **FE-21**(자동완성 응답 순서 역전) + **FE-28②** · **FE-30①**(대시보드 파사드 스위치 비노출)
- 기준 커밋: root `8aface0`, backend `981b112a`, frontend `9cf9d84`
- 문서 성격: 설계 스펙. 구현 순서·태스크 분해는 후속 실행계획이 SoT
- 상태: 2026-08-06 구현 완료 (실행 SoT: [`plans/2026-08-06-task-quickfix-batch1.md`](../plans/2026-08-06-task-quickfix-batch1.md)). 병합과 `versions.lock` 갱신은 사용자 판단으로 보류.
- **⚠️ 이 문서의 전제 일부가 실행 중 거짓으로 판명됐습니다.** §1.1은 ERR-14만 낡은 근거로 봤지만 실제로는 **BE-34의 증상(`arg0`)도 재현되지 않았고**, §3.4가 상정한 FE-30①의 명시 `key` 분리도 불필요했습니다. §3.2의 BE-34 서술(우회가 이름을 고정한다)은 **실행 결과와 다릅니다** — 애노테이션은 스펙을 바꾸지 않았습니다. 확정된 결과는 [`TASK_DONE.md`](../../../TASK_DONE.md)의 2026-08-06 잔여과제 저비용 배치 1 절을 SoT로 보십시오.

---

## 1. 배경과 선별 기준

`TASK.md`의 활성 잔여과제 중 **코드 변경만으로 완결되는 항목**을 골라 한 배치로 묶습니다. 선별 기준은 다음 두 가지를 모두 만족하는 것입니다.

1. 업무 담당자·DBA 협의나 정책 확정이 선행되지 않는다
2. 검증이 단위 수준에서 가능하다 (E2E·브라우저 QA 불필요)

이 기준으로 제외된 항목과 사유:

| 제외 항목 | 사유 |
| --- | --- |
| SEC-10, BE-18, BE-23, EAI-01/02/05/06 | 외부·운영 의존 (advisory 판정, 운영 관측, 벤더·팀 합의) |
| BE-19, BE-21, BE-32, BE-33 | 업무 정의 확정이 선행 (누락 vs 고의 '해당없음', 결재유형 의미, 대표상태 정의) |
| BE-20, BE-22 | DBA 협의·운영 사전 확인 선행 |
| BE-24, BE-25, BE-27 | Oracle 통합 테스트 기반 검증이 범위의 본체 |
| CQ-15, CQ-22, CQ-18, CQ-19 | 대규모 리팩터링 또는 정책 확정 선행 |
| FE-19 잔여, FE-22 잔여, FE-20, FE-25, FE-26 | 화면별·정책 판단이 조치의 본체 |
| FE-23, FE-27, FE-28①③, FE-32 | 테스트 위생·보강. 이번 배치와 성격이 달라 다음 배치로 분리 |
| ERR-15 | census 재조사가 선행돼야 분량이 확정됨 |

### 1.1 착수 전 실측으로 드러난 것

**ERR-14의 근거가 낡았습니다.** `TASK.md`는 `app/composables/useApiFetch.ts`의 `onResponseError` 401 분기(대략 487~503행)와 모듈 전역 `isRefreshing`·`tokenRefreshSignal`을 지목하지만, 그 구조는 현재 존재하지 않습니다. 401 처리는 [`app/composables/api/useApiFetchRefreshCoordinator.ts`](../../../it_frontend/app/composables/api/useApiFetchRefreshCoordinator.ts)로 분리됐고, `useApiFetch.ts:494`는 `refreshCoordinator.onResponseError(response.status)` 한 줄만 호출합니다. 저장소 전체에 `tokenRefreshSignal`은 0건입니다.

코디네이터는 갱신 주기를 `refreshing → retrying → terminating → completed` phase로 관리하며, **재시도 파동 중(`phase === 'retrying'`) 다시 401이 오면 `terminateCycle`로 세션을 종료**합니다(45~57행). ERR-14가 서술한 무한 루프 경로가 이미 끊겨 있을 가능성이 높으나, **코드를 읽어 판정하지 않고 실측으로 판정합니다**(§3.1).

**나머지 3건은 지목된 결함이 현재도 실재합니다.**

- BE-34: 백엔드 운영 소스 전체에 `@ParameterObject` 사용이 0건입니다.
- FE-21: [`useMentionAutocomplete.ts:146-148`](../../../it_frontend/app/composables/useMentionAutocomplete.ts)이 `await` 직후 순서 판정 없이 `items.value`에 대입합니다.
- FE-30①: [`useApprovalDashboard.ts:111`](../../../it_frontend/app/composables/useApprovalDashboard.ts)과 [`useDocumentDashboard.ts:102`](../../../it_frontend/app/composables/useDocumentDashboard.ts)이 `{ data, pending, refresh }`만 반환합니다.

---

## 2. 실행 순서

`C:\it\CLAUDE.md` §2의 4-repo 규약(백엔드 계약 커밋 먼저, 이를 참조하는 프론트 커밋을 뒤이어)과 의존 관계를 반영합니다.

```
T0  ERR-14 조사        (프론트, 코드 변경 0)
T1  BE-34 우회 적용     (백엔드)  ─┐ 계약 변경
T2  api.d.ts 재생성     (프론트) ─┘ 백엔드 커밋 후
T3  ERR-14 분기 처리    (프론트)
T4  FE-21 + FE-28②     (프론트)
T5  FE-30①             (프론트)
T6  문서·versions.lock
```

T0을 맨 앞에 두는 이유는 조사 결과가 T3의 분량을 결정하기 때문입니다. "이미 해소"로 판정되면 T3은 회귀 테스트 1개 + 문서 이관으로 줄어듭니다.

T1이 T2보다 앞서는 것은 4-repo 규약의 요구이며, T2는 T1이 만든 스펙 변화를 프론트 생성 타입에 반영하는 후속 커밋입니다.

---

## 3. 항목별 설계

### 3.1 ERR-14 — 401 무한 재조회 (T0/T3)

**조사 방법.** 코드 판독이 아니라 **RED 시도**로 판정합니다. 서버가 갱신 후에도 계속 401을 내놓는 상황을 대역으로 만들고, `refresh` 호출 횟수가 유한한지 단언하는 테스트를 먼저 씁니다.

- 대역 조건: 모든 요청이 401을 반환하고 `refresh()`는 항상 성공(`true`)을 반환
- 관측 대상: `refresh` 호출 횟수, `terminateSession` 호출 여부
- 기대(결함이 해소됐다면): 유한 횟수 안에 `terminateSession`이 정확히 1회 호출되고 루프가 멈춘다

**분기 A — 테스트가 통과(이미 유한).** [`useApiFetchRefreshCoordinator.ts:49-52`](../../../it_frontend/app/composables/api/useApiFetchRefreshCoordinator.ts)의 `phase === 'retrying' → terminateCycle` 경로가 루프를 끊고 있다는 뜻입니다. 이 테스트를 회귀 테스트로 남기고 ERR-14를 `TASK_DONE.md`로 이관합니다. 이관 기록에는 "코디네이터 도입으로 구조적으로 해소됐고, 재발을 막는 실측 테스트를 함께 추가함"과 **근거란이 낡아 있었다는 사실**을 함께 남깁니다.

**분기 B — 테스트가 실패(여전히 무한).** 주기 단위 재시도 상한을 도입합니다. 상한은 `useApiFetch.ts` 호출부가 아니라 **코디네이터에** 둡니다 — 상한은 개별 인스턴스가 아니라 전역 갱신 주기의 속성이고, 호출부에 두면 인스턴스마다 따로 세어 합산 상한이 무의미해지기 때문입니다.

**검증.** `npm test`.

### 3.2 BE-34 — OpenAPI 파라미터명 `arg0` 유실 (T1/T2)

**조치 범위는 저비용 우회입니다.** `TASK.md`가 기록한 근본 원인 후보(CGLIB 프록시화, Spring Framework 7 discovery, springdoc 3.0.3의 Boot 4 호환)는 어느 쪽이든 이번 배치의 선별 기준을 벗어납니다. 우회는 원인과 무관하게 이름을 고정합니다.

6곳에 `@ParameterObject`(`org.springdoc.core.annotations.ParameterObject`)를 **추가**합니다. 기존 `@ModelAttribute`는 **제거하지 않습니다** — 바인딩 동작을 바꾸지 않기 위해서입니다.

| 컨트롤러 | 행 | 파라미터 | 현재 |
| --- | ---: | --- | --- |
| `domain/budget/project/controller/ProjectController.java` | 77 | `condition` | `@ModelAttribute` |
| `infra/file/controller/FileController.java` | 71 | `condition` | `@ModelAttribute` |
| `domain/budget/cost/controller/CostController.java` | 168 | `condition` | `@ModelAttribute` |
| `common/board/controller/BoardPostController.java` | 37 | `cond` | `@ModelAttribute` |
| `common/admin/controller/AdminController.java` | 367 | `pageable` | `@PageableDefault(size = 50, sort = "lgnDtm", …)` |
| `common/admin/controller/AdminController.java` | 426 | `pageable` | `@PageableDefault(size = 100)` |

**근본 원인 1차 확인.** 검증을 위해 어차피 백엔드를 기동하므로, `TASK.md`가 적어둔 "다음 확인 순서 ①"을 함께 수행합니다 — 컨트롤러 빈의 `getClass().getName()`에 `$$SpringCGLIB$$` 접미사가 붙는지 확인합니다. **결과는 `TASK.md`에 기록만 하고 수정은 이번 범위 밖**입니다. 프록시가 아니면 원인이 Spring Framework 7 discovery 또는 springdoc 호환으로 좁혀지므로, 후속 항목의 착수 비용이 줄어듭니다.

**검증.** 백엔드 + 로컬 Oracle 기동 → `npm run codegen` 재생성 → 다음 세 가지를 확인합니다.

1. 대상 6개 오퍼레이션(`getProjects`·`getFiles`·`getCostList`·`searchPosts`·`getLoginHistory`·`getLogs`)의 파라미터명이 `arg0`/`arg1`에서 실제 이름으로 바뀐다
2. `paths 160 / schemas 234`가 불변이다 (오퍼레이션 증감 없음)
3. `app/types/api.d.ts` diff가 위 6건에만 국한된다

프론트 소비처가 0건이므로 `api.d.ts` 재생성은 컴파일 영향이 없어야 합니다. 영향이 나오면 우회가 의도 밖 변경을 일으킨 것이므로 중단하고 재검토합니다.

### 3.3 FE-21 + FE-28② — 자동완성 응답 순서 역전 (T4)

두 composable에 **요청 시퀀스 토큰**을 도입해, 응답이 도착했을 때 자신이 최신 요청일 때만 상태를 씁니다.

- `app/composables/useMentionAutocomplete.ts` — `runSearch` (게시판 @멘션)
- `app/composables/useGlobalSearch.ts` — `searchByName` (헤더 통합검색)

**`items`뿐 아니라 `searchLoading`·`searchError`도 같은 판정을 받아야 합니다.** 낡은 응답이 로딩 상태를 먼저 꺼거나 이미 성공한 검색의 오류 플래그를 세우는 것도 같은 결함의 표현입니다. `catch`·`finally` 블록도 순서 판정 안에 둡니다.

**`GlobalSearchBar.vue:163`의 디바운스는 추가하지 않습니다.** `TASK.md`는 디바운스 부재를 경합 조건의 일부로 적었지만, 시퀀스 가드를 붙이면 경합 자체가 사라집니다. 디바운스는 호출 횟수를 줄이는 별개의 최적화이고 입력 반응성에 영향을 주므로, 이 항목에서 함께 결정하지 않습니다.

**FE-28②** — `TASK.md` FE-28의 ②는 "가드가 붙은 뒤에도 순서 역전 동작을 검증하는 테스트가 없다"이며 FE-21 착수 시 함께 처리하도록 등재돼 있습니다. 두 composable 각각에 다음을 검증하는 테스트를 추가합니다: 느린 첫 응답이 빠른 두 번째 응답의 결과를 덮어쓰지 않는다.

기존 테스트 파일(`tests/unit/composables/useMentionAutocomplete.test.ts`, `useGlobalSearch.test.ts`)에 추가합니다.

**검증.** `npm test`.

### 3.4 FE-30① — 대시보드 파사드의 스위치 비노출 (T5)

FE-24가 `useBoard`에 적용한 처방을 그대로 씁니다: **명시 `key`로 소비자를 분리한 뒤 `enableKeepPreviousData`를 노출**합니다.

- `app/composables/useApprovalDashboard.ts` (98~111행 부근)
- `app/composables/useDocumentDashboard.ts` (96~102행 부근)

**착수 전 필수 확인 두 가지.**

1. **키 공유 파급.** `it_frontend/CLAUDE.md` §2가 기록한 양방향 한계 — Nuxt는 같은 키의 최초 인스턴스가 만든 설정 하나만 보관하므로, 가드가 그 키를 먼저 열면 같은 키를 나중에 여는 **비가드 소비자까지 보존이 켜집니다**. 두 URL을 다른 곳에서도 여는지 grep으로 확인한 뒤 키를 정합니다.
2. **비노출이 의도적이었는지.** `TASK.md`도 "의도적 판단인지 미확인"으로 적어뒀습니다. git log로 도입 경위를 확인하고, 의도적 판단이었다는 근거가 나오면 노출하지 않고 그 사실을 `TASK.md`에 기록하는 것으로 항목을 닫습니다.

**범위는 노출까지입니다.** 소비처 화면에 실제 가드를 붙이는 것은 화면별 판단이므로 FE-22 잔여와 함께 남깁니다. 이 항목의 결함 서술이 "소비처가 가드를 만들 수 없다"이므로, 만들 수 있게 하는 것으로 충족됩니다.

**검증.** 기존 테스트 4종(`useApprovalDashboard.test.ts`·`.direct.test.ts`, `useDocumentDashboard.test.ts`·`.direct.test.ts`) + 보존 동작 신규 테스트, `npm test`.

---

## 4. 브랜치와 품질 게이트

| 저장소 | 브랜치 | 게이트 |
| --- | --- | --- |
| `it_backend` | `feature/be34-openapi-parameter-names` | `./gradlew check` |
| `it_frontend` | `feature/task-quickfix-batch1` | `npm run check`, `npm test`, `npm run codegen:check` |

커밋 순서는 백엔드 → 프론트입니다. 병합 후 `scripts/update-versions-lock.ps1`로 `versions.lock`을 갱신합니다.

**E2E(`npm run test:e2e`)는 실행하지 않습니다.** 4건 모두 단위 수준에서 관측 가능하고, `TASK.md` CQ-22가 기록한 대로 이 환경에서는 프론트·백엔드·DB 동시 기동이 어려워 E2E 결과를 신뢰할 수 없습니다. BE-34 검증에 필요한 것은 백엔드 + Oracle뿐이며 프론트·브라우저는 필요하지 않습니다.

---

## 5. 위험과 대응

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| `@ParameterObject` 추가가 `@ModelAttribute` 바인딩 동작을 바꾼다 | 검색 API 회귀 | 기존 컨트롤러 테스트로 확인. 어긋나면 `@Parameter(name=...)`로 대체 |
| FE-30①의 asyncData 키 파급으로 비가드 소비자에 보존이 켜진다 | 의도치 않은 화면에서 오류 시 낡은 값 표시 | 노출 전 키 공유 grep 선행, 필요 시 명시 키로 분리 |
| ERR-14 조사가 "재현됨"으로 나온다 | T3 분량 증가 | 그 시점에 계속할지 사용자에게 재확인 |
| FE-30①의 비노출이 의도적 판단이었다 | 되돌려야 하는 변경 | git log 확인을 착수 조건으로 둠 |
| BE-34 우회가 스펙에 예상 밖 변화를 만든다 | 계약 드리프트 | paths/schemas 수 불변 + `api.d.ts` diff 국한 확인, 어긋나면 중단 |

---

## 6. 문서 갱신 (T6)

| 항목 | 처리 |
| --- | --- |
| ERR-14 | 분기 A면 `TASK_DONE.md` 이관(근거가 낡았던 사실 포함). 분기 B면 상한 도입 기록 후 이관 |
| BE-34 | 우회 적용 사실과 근본 원인 1차 확인 결과를 반영. 근본 원인이 남으면 잔여로 재서술 |
| FE-21 | `TASK_DONE.md` 이관 |
| FE-28 | ②만 소진. 잔여 ①(`onActivated` 14파일)·③(codegen 판정 로직 단위 테스트)을 명시적으로 남김 |
| FE-30 | ① 소진. 잔여 ②(`ignoreFiles` 파일 단위 grandfather)만 남김 |

완료 항목은 `TASK_DONE.md`로 이관하고 `TASK.md`에는 참조 문장만 남깁니다. `CLAUDE.md`에는 이번 배치에서 규칙으로 일반화할 것이 없으므로 수정하지 않습니다 — 시점성 수치와 개별 조치 기록은 `CLAUDE.md`에 남기지 않는다는 §4.3 규약을 따릅니다.
