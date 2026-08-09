# TASK.md 저비용 잔여과제 배치 2 — 조치계획

작성일: 2026-08-07
기준 HEAD: it_frontend `2070472`, it_backend `4e28ee7e`, versions.lock 갱신시각 2026-08-06 21:59

전제: 2026-08-06 배치 1(ERR-15·FE-26·FE-28②③·FE-29①·FE-30①③·BE-27·BE-34·CQ-23) 완료 이후 남은 항목만 대상으로 한다.
아래 수치는 전부 이 문서 작성 시점에 실측한 값이며 TASK.md에 기록된 과거 측정값과 다를 수 있다.

---

## 실행 결과 — Tier 1 완료 (2026-08-07)

**Tier 1 7건 전부 완료.** Tier 2·3은 미착수이며 아래 본문의 착수 조건이 그대로 유효하다.

| 항목 | 상태 | 실행 커밋 |
| --- | --- | --- |
| T1-1 `versions.lock` 갱신 | 완료 (마지막에 재실행) | root — 이 문서와 같은 커밋 |
| T1-2 CQ-24 ① max-lines 800 복귀 | 완료. `CouncilService` 821 → 770 분해 후 `LIMIT` 850 → 800 복원 | backend `e2f6f4d5` |
| T1-3 CQ-24 ② `startPreparation` 계약 확인 | 완료. production이 이미 05~13 상태에서 멱등 반환해 테스트 변경이 정당함을 확인 | backend `e2f6f4d5` |
| T1-4 FE-29 잔여 개명 | 완료. `refreshFailedAfterSave` → `refreshFailed`, 짝인 `retryRefreshAfterSave` → `retryRefreshOnly` | frontend `25a8b2d` |
| T1-5 `AttachmentNodeView` 죽은 CSS 제거 | 완료 | frontend `25a8b2d` |
| T1-6 FE-19 `color-no-hex` 전용 파일 | 완료. `YearPickerTitle`은 `25a8b2d`, 나머지 5개는 `ef0746d` | frontend `25a8b2d`·`ef0746d` |
| T1-7 FE-19 소규모 혼합 파일 | 완료. `StyledDataTable`·`ResourceTableSection`은 `25a8b2d`, `budget/summary`는 `ef0746d` | frontend `25a8b2d`·`ef0746d` |

**실측 결과 vs 기대치**

| 지표 | 착수 시점 | 기대 | 실제 |
| --- | --- | --- | --- |
| FE-19 SFC 위반 | 197건 / 25파일 | 165건 | **164건 / 16파일** |
| `.stylelintrc.json` `ignoreFiles` | 28항목 | 19항목 | **19항목** |

**계획과 달라진 점 3가지**

1. **`ignoreFiles` 제거가 2회가 아니라 1회로 끝났다.** T1-6·T1-7이 각각 제거를 예정했으나, 이전 배치에서 위반 0건을 만들어놓고도 훅에 막혀 남아 있던 3건(`YearPickerTitle`·`StyledDataTable`·`ResourceTableSection`)이 있어 9줄을 한 번에 회수했다.
2. **줄 수 불변이 자동으로 보장되지 않았다.** 계획은 "hex → 토큰 치환은 줄 수가 변하지 않는다"를 전제했으나, `var(--토큰명)`이 hex보다 길어 Prettier `printWidth: 100`을 넘기면 줄바꿈이 삽입돼 CQ-15 기준선 파일 3개가 각각 +4줄이 된다. 토큰 이름을 17자 이하로 잡아 회피했다. **이 배치에서 얻은 규칙: CQ-15 기준선 파일의 토큰 치환은 이름 길이를 먼저 계산한다.**
3. **`budget/summary.vue`의 `no-descending-specificity`를 규칙 순서 교환으로 풀지 않았다.** 계획은 순서를 바꾸라고 했고 "렌더 결과가 바뀔 수 있으니 브라우저로 확인" 단서를 달았다. 실제로는 `--section-row-*` 토큰이 `:root.dark`에서 스스로 뒤바뀌므로 `.dark` 전용 규칙 자체가 불필요해졌고, 그 규칙을 지우자 위반이 함께 사라졌다. **순서를 바꾸지 않았으므로 캐스케이드가 달라지지 않았고 브라우저 확인이 필요 없다.**

**검증**: `format:check` / `check` / `lint:css` / `test`(203파일 2424건) 전부 통과. `test:e2e`는 배치 1과 같은 이유로 실행하지 않았다.

**다음 착수 대상**: T2-1(`selector-class-pattern` 81건 — 3부류 정책 확정 선행). 이 결정 하나가 잔여 164건의 절반이다.

---

## 실행 결과 — T2-1 완료 (2026-08-07)

**BEM 허용으로 정책 확정**(사용자 결정). 3부류 전부 처리해 `selector-class-pattern` **147건(SFC 81 + `tiptap-editor.css` 66)이 0건**이 됐다.

| 지표 | T1 완료 시점 | 실제 |
| --- | --- | --- |
| FE-19 SFC 위반 | 164건 / 16파일 | **83건 / 14파일** |
| `selector-class-pattern` | 81건(SFC) / 147건(전체) | **0건** |
| `ignoreFiles` | 19항목 | **17항목** |

실행 커밋: frontend `a459b08`(조치)·`d998bbd`(규칙 등재)

**계획의 전제 하나가 틀렸다 — `ignoreSelectors`는 존재하지 않는다**

본문 §T2-1 ①은 "`selector-class-pattern`에 `ignoreSelectors`(정규식)를 추가한다. FE-19가 `:deep`/`:global`을 `ignorePseudoClasses`로 처리한 것과 같은 방식이다"라고 적었다. **stylelint 17.12.0의 `selector-class-pattern`에는 그 옵션이 없다.** `node_modules/stylelint/lib/rules/selector-class-pattern/index.mjs`의 `validateOptions`가 `actual: primary, possible: [isRegExp, isString]`만 검사하며 보조 옵션을 전혀 받지 않는다. `ignorePseudoClasses`를 가진 `selector-pseudo-class-no-unknown`과 다른 규칙이라 유추가 성립하지 않았다.

→ 벤더 예외를 **정규식 선두 분기**로 넣어 해결했다. 최종 패턴:

```
^(ProseMirror(-[a-z]+)*|tableWrapper|selectedCell|ML__[a-z0-9-]+)$|^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$
```

**3부류 처리 결과**

| 부류 | 처리 | 비고 |
| --- | --- | --- |
| ① vendor | 정규식 선두 분기 허용 | `ProseMirror(-*)`·`tableWrapper`·`selectedCell`은 ProseMirror가 DOM에 주입, `ML__*`는 MathLive. 우리가 이름을 정할 수 없다 |
| ② DB 컬럼명 유래 | 개명 16곳 / 3파일 | `.cgprEno-cell`→`.cgpr-eno-cell`, `.curC-select`→`.cur-c-select`, `.curC-col`→`.cur-c-col`. `<template>` 클래스 문자열 포함. TS의 `cgprEno`는 DB 컬럼명이라 유지 |
| ③ 프로젝트 BEM | **공식 표기로 인정** | 각 구성요소의 kebab-case는 계속 강제하므로 `foo__Bar`·`foo--`는 여전히 거부된다 |

**검증 방식** — 정규식은 조용히 틀리기 쉬워 두 방향으로 확인했다.

1. 실제 클래스명 **49종 전수** + 개명 전 이름(`cgprEno-cell` 등) 회귀 케이스로 accept/reject를 검증했다.
2. **RED 확인**: 게이트 대상 파일에 임시로 `.redProbeCell`을 넣으면 실패하고 `.probe__ok--fine`(BEM)은 통과한다. 규칙이 실제로 돌고 있음을 확인한 뒤 되돌렸다.

**부수 확인 → 조치 완료 (frontend `534b4b6`)**: `app/pages/info/cost/index.vue`의 `.cgpr-eno-cell` 3개 규칙이 도달 불가능함을 확인하고 삭제했다.

도달 불가능 근거 3가지:

1. `.cgpr-eno-cell`이 `<style scoped>`(1052~1069행)에만 있고 `<template>`(138~1044행)에는 없다.
2. Vue scoped CSS는 **자식 컴포넌트의 루트 요소까지는 닿지만**, `index.vue`는 그 마크업을 가진 `CostFormTableSection`/`TerminalTableSection`을 **아예 렌더하지 않는다**(import 없음 · Nuxt 자동 임포트 사용 없음 · 동적 컴포넌트 없음). 두 컴포넌트의 루트도 각각 `<StyledDataTable>`과 `.terminal-table`이라 `.cgpr-eno-cell`이 아니다.
3. 이 클래스가 마크업에 등장하는 파일은 그 둘뿐이고 **둘 다 자기 `<style scoped>`에 동일한 규칙을 갖고 있다**(3개 블록이 바이트 단위로 동일). 삭제해도 표시가 달라질 대상이 없다.

`git log -S'class="cgprEno-cell"'` 결과 `index.vue`에 이 마크업이 존재한 이력이 없다 — 섹션 컴포넌트 추출 시 **옮긴** 게 아니라 CSS만 **복사돼** 남은 것이다.

CQ-15 기준선 1140 → **1120**. ratchet이 `toBe(baseline)` 정확 일치라 **감소도 실패시키므로** `scripts/max-lines-baselines.mjs`를 함께 낮춰야 한다(주석: "증가는 물론 감소도 실패시켜 기준값을 반드시 함께 낮추게 만듭니다").

**정책 등재**: `it_frontend/CLAUDE.md` §5에 클래스 명명 규칙과 "CQ-15 기준선 파일의 토큰 치환은 이름 길이를 먼저 계산한다"를 재사용 규칙으로 남겼다.

**남은 Tier 2**: T2-2(FE-22 `notifyMode: 'banner'` 적용 지점 선정 — 57개 소비처 manifest 선행).

---

## 실행 결과 — T2-2 완료 (2026-08-07)

**본문 §T2-2의 선정 기준은 54개 가드 중 0개를 고른다.** 그 이유가 구조적이라 옵션의 granularity 자체를 바꿔야 했다.

실행 커밋: frontend `8f04574`

### manifest 실측 (착수 전제였던 산출물)

가드 생성 지점 **54개** — `grep`이 잡은 56건 중 2건은 `useApprovalDashboard`/`useDocumentDashboard`의 JSDoc `@example`이다.

| 분류 | 수 | 판정 |
| --- | --- | --- |
| `onActivated` 구동 | **16** | 직접 13 + `budget/list.vue`의 `refreshBudgetList()` 경유 **간접 3** |
| ↳ 그중 [다시 조회] 재시도 UI 보유 | **16 (전부)** | 종전 기준상 **전부 제외** |
| ↳ 재시도 UI 없음 | **0** | **후보 0건** |
| `onActivated` 비구동 | 38 | 반복 실행이 아니라 제외 |

`notifyMode` 실제 소비처는 **0곳**이었다(유일한 등장은 `cost/terminal/[id].vue:50` 주석).

### 왜 0건인가 — 두 가지 구조적 이유

1. **`retryRefresh`는 `attemptRefresh(retryFailureDetail)` 그 자체다.** 같은 인스턴스이므로 `'banner'`를 켜면 사용자가 [다시 조회]를 눌러 일으킨 재시도까지 침묵한다. 그리고 이 저장소는 `onActivated` 가드 16개 전부에 재시도 버튼을 달아 두었다(ERR-13/FE-25가 세운 좋은 패턴).
2. **한 인스턴스가 C-3와 Class B를 겸한다.** `documents/[id]/index.vue`의 `attemptFilesRefresh`는 6곳에서 호출되는데 `onActivated` 1곳과 **파일 업로드(283)·삭제(316) 등 쓰기 직후 5곳**이 섞여 있다. 인스턴스 단위로 끄면 가드 JSDoc이 명시적으로 금지한 "저장 직후 실패 침묵"이 일어난다.

즉 소비처 0곳은 지점 선정을 안 해서가 아니라 **적용 가능한 지점이 없었기 때문**이다.

### 조치 — 억제를 호출 단위로 (사용자 결정)

`notifyMode`(인스턴스 단위)를 제거하고 `attemptRefresh(문구, { silent: true })`를 도입했다.

- 기본값이 종전 동작이라 나머지 38개 가드는 영향이 없다.
- `retryRefresh`는 사용자 명시 조작이므로 억제 대상이 아니다 — silent 호출이 앞서 있어도 항상 Toast를 띄운다.
- `onActivated` 호출 **16곳에만** 적용. **검색·페이지 이동은 제외**했다(`board/[blbMngNo]/index.vue`의 `attemptPostsRefresh` 3곳 중 2곳은 사용자가 일으킨 조작이라 Toast를 유지).

TDD로 진행했다. `notifyMode` 테스트 1건을 호출 단위 계약 4건으로 교체했고, 핵심은 **"silent 호출 뒤에도 `retryRefresh`는 Toast를 띄운다"** — 인스턴스 단위였을 때 표현 자체가 불가능했던 조합이다. RED(2건 실패) 확인 후 구현했다.

### 예상 밖이었던 것 — 줄 수

옵션 추가로 CQ-15 기준선 파일 6개가 +2~+4가 됐고, 기준선에 **없던** `info/cost/[id].vue`가 799 → 801로 800 상한을 넘었다. 기준값 상향과 기준선 신규 등재는 **둘 다 금지 방향**이라 양쪽 다 쓸 수 없었다.

→ 가드 JSDoc이 이미 권위 있게 설명하는 **중복 주석을 압축해 상쇄**했다. 결과적으로 5개 파일이 1줄씩 줄어 기준값을 함께 낮췄다(ratchet이 `toBe(baseline)` 정확 일치라 **감소도 동반 갱신이 필수**다).

**이 배치에서 얻은 규칙**(`it_frontend/CLAUDE.md` §2 등재): 자동 반복 재조회만 `silent`로 끄고 쓰기 직후와 재시도는 끄지 않는다.

**남은 Tier 2**: 없음. 다음은 Tier 3(FE-28① → FE-23 → FE-27 → FE-32, 전부 재조사 선행).

---

## 실행 결과 — FE-28① 완료 (2026-08-07)

Tier 3의 첫 항목. **재조사가 작업량의 대부분**이라던 예측대로, 대상 확정이 절반이었다.

실행 커밋: frontend `5626ce1`

### 재조사 — "14파일"의 정체

`onActivated`를 쓰는 파일은 20개지만, **재조회를 일으키는 것만** 세면 정확히 14개이고 이것이 TASK.md에 기록된 수와 일치한다.

| 구분 | 대상 |
| --- | --- |
| 재조회 O (14) | 페이지 12 + `useCostEditingState`(`refreshCostsRaw`) + `useInfoHomeFeed`(`loadNotices`/`loadSchedules`) |
| 재조회 X (6) | `useScrollSpy`·`usePlanToc`(observer 재연결), `useProjectFormLoad`·`budget/report`·`guide/index`(상태 초기화), `cost/form`(코드 로드) |

### 커버리지 — 14개 중 7개만 덮여 있었다

| 상태 | 대상 |
| --- | --- |
| ✅ 커버 (7) | `useCostEditingState` · `useInfoHomeFeed`(둘 다 실제 KeepAlive 사이클) + `plan/index` · `plan/[id]` · `projects/index` · `documents/list` · `documents/[id]/index`(`refresh-banner-visibility.test.ts`) |
| ❌ 공백 (7) | `approval/list` · `board/[blbMngNo]/index` · `budget/approval` · `budget/list` · `cost/[id]` · `cost/terminal/[id]` · `projects/[id]` |

**함정 하나**: `budget/approval`·`projects/[id]`는 테스트 파일이 있어 파일명 대조만 하면 "커버됨"으로 잘못 세게 된다. 실제로는 `readFileSync` + `toContain` 문자열 단언이라 **`onActivated`를 전혀 구동하지 않는다**. 소스 문자열 검사는 이 경로의 회귀를 잡지 못하므로 커버로 세지 않았다.

### 조치

신규 `tests/unit/pages/onactivated-refresh-guard.test.ts`가 공백 7개를 덮는다. 화면마다 **세 축**을 함께 고정한다.

1. **가드 경로가 실제로 돈다** — KeepAlive deactivate→activate로 두 번째 이후 `onActivated`를 재현하고 배너 도달을 본다.
2. **보존이 걸린다** — 재조회가 실패해도 직전 정상값이 화면에 남는다.
3. **Toast가 뜨지 않는다** — 직전에 붙인 FE-22 `{ silent: true }`의 회귀 방지. 이 축이 있어 T2-2 조치가 조용히 되돌아가지 않는다.

관측 방식은 `refresh-banner-visibility.test.ts`와 같다: 실제 파사드 → 실제 `useApiFetch`를 그대로 쓰고 `useFetch` 자리에만 `createNuxtFetchFake`를 끼운다.

**RED 확인 2종** — 세 축이 실제로 관측되는지 검증했다.

- `cost/[id]`에서 `{ silent: true }`를 빼면 → Toast 단언 실패
- `budget/list`에서 `onActivated` 재조회를 빼면 → 배너 단언 실패

### 하네스에서 걸린 것 (다음에 같은 테스트를 쓸 때의 함정)

- `afterEach`의 `vi.unstubAllGlobals()`는 **파일 수준 전역 스텁까지 지운다** — 두 번째 테스트부터 `definePageMeta`·`useApiFetch`가 사라져 마운트가 깨진다. `vi.clearAllMocks()`만 쓴다.
- `PageHeader` 스텁이 `#title` 슬롯을 렌더하지 않으면 상세 화면의 "보존된 값이 남아 있는가"를 관측할 수 없다 — 상세 화면은 조회 결과를 그 슬롯에 넣는다.
- `useRoute` 스텁에 `query`를 빠뜨리면 `approval/list`의 탭 필터(`route.query.tab`)가 undefined 역참조로 터진다.

**남은 Tier 3**: FE-23 · FE-27 · FE-32.

---

## 실행 결과 — FE-27 완료 (2026-08-07)

실행 커밋: frontend `5d49ed4`

계획서는 "세부 좌표가 산출물에 없어 재조사 선행"이라고만 적었다. 실제로 `integration-findings.md` 193행은 **한 줄 요약뿐**이고 개별 기록이 없어, 204개 테스트 파일을 전면 재조사했다.

### 결론 — 5종 중 2종만 실재했다

| 종 | 결과 | 근거 |
| --- | --- | --- |
| ① 스파이 미복원 | **9파일** | `vi.spyOn` 수 > `mockRestore` 수 |
| ② 대역 파일 간 공유 | **0건** | `sharedEntries`는 `createNuxtFetchFake` **내부**(인스턴스별) + vitest 파일 단위 격리가 기본 |
| ③ 죽은 mock 배치 | **0건** | 선언 후 미참조 `vi.fn` 0건, 존재하지 않는 모듈 겨냥 `vi.mock` 0건 |
| ④ `cdvaNm` 분기 사문화 | **1건 확정** | `useCostExcelTransfer.test.ts` |
| ⑤ `stubGlobal` 미복원 | **1건 확정** | `useCostListPage.test.ts` |

### 근본 원인 — `clearMocks`는 구현을 되돌리지 않는다

`vitest.config.ts`에는 `clearMocks: true`만 있고 **`restoreMocks`가 없다**. `clearMocks`는 호출 기록(`mock.calls`)만 지우고 `spyOn`이 갈아끼운 **구현은 남긴다**. 그래서 스파이를 걸지 않은 뒤 테스트가 앞 테스트의 대역을 그대로 물려받는다. ①이 실재 위험인 이유가 이것이다.

**전역 해법은 쓸 수 없다.** `restoreMocks: true`를 켜면 모듈 수준 `spyOn`을 파일 전체 픽스처로 쓰는 파일(`useHwpxExport.direct`·`excel`)이 첫 테스트 뒤 픽스처를 잃고 깨진다. `unstubGlobals: true`는 더 위험하다 — `tests/setup.ts`가 등록한 Nuxt auto-import 전역 스텁까지 매 테스트 후 지워 스위트 전체가 무너진다(FE-28①에서 같은 함정을 실제로 밟았다).

### ④ — 사문화의 정체

production `codeId`(`useCostExcelTransfer.ts:117`)는 `(o.cdvaNm ?? o.cNm) === cNm`으로 매칭한다. 그런데 테스트의 `option()` 헬퍼는 3번째 인자로 `cdvaNm`을 받아 두고도 **호출부 4곳이 전부 2개 인자만 넘겼다** — `cdvaNm`이 항상 `undefined`라 매칭이 늘 `cNm` 분기로만 귀결했고, 우선순위가 한 번도 검증된 적이 없었다.

`cNm ≠ cdvaNm`인 옵션으로 두 케이스를 추가했다(`cdvaNm`으로 매칭 / `cNm`으로는 매칭 안 됨). **RED 확인**: 우선순위를 `cNm ?? cdvaNm`으로 뒤집으면 둘 다 실패한다.

### ⑤ — 복원 위치가 문제였다

`useCostListPage.test.ts`는 `bbrC` 없는 `useAuth` 스텁을 **테스트 본문 끝**에서 수동 복원하고 있었다. 그 앞 단언이 하나라도 실패하면 복원 문장에 도달하지 못해 빈 `bbrC`가 이 파일의 뒤 테스트 전부로 새고, **실패 1건이 연쇄 실패로 번진다**. `describe`로 묶고 복원을 `afterEach`로 옮겼다.

> 같은 이유로 ④의 대역 복원도 처음부터 `afterEach`에 뒀다 — 모듈 수준 `ref`를 테스트 본문에서 되돌리면 같은 함정에 빠진다.

**남은 Tier 3**: FE-23 · FE-32.

---

## 실행 결과 — FE-23 · FE-32 완료 (2026-08-07) — **배치 2 종료**

둘 다 `tests/support/nuxtAsyncData.ts`가 대상이라 묶어 처리했다. 실행 커밋: frontend `9890e79`

### FE-32 — 같은 참조 재대입

성공 분기가 `control.value`를 **그대로** 돌려줘, 테스트가 `control.value`를 바꾸지 않은 채 성공을 2회 이상 재현하면 `data.value`에 동일 참조가 재대입돼 `shallowRef`가 변경을 감지하지 못했다. 실제 ofetch는 매 응답을 새로 파싱하므로 대역의 충실도 공백이다.

**착수 전 영향 조사** — 계획서가 "전 파일 영향 검토 선행"을 요구한 부분:

| 확인 | 결과 |
| --- | --- |
| `control.value` 제자리 변형(`push`/`splice`/속성 대입) | **0건** (전부 재대입, 10곳) |
| `data.value` 참조 동일성 단언 | **0건** |

→ 얕은 복사가 안전하다고 판정하고 `freshResponse()`를 도입했다. **깊은 복사는 쓰지 않는다** — `shallowRef` 트리거에는 최상위 참조만 새로우면 충분하고, 깊은 복사는 중첩 객체의 참조 동일성을 깨 멀쩡한 단언을 무너뜨린다.

**RED**: `freshResponse`를 되돌리면 `data` 워처가 한 번도 돌지 않아(관측 배열이 빈 채) 실패한다.

### FE-23 — `clear()` 밖의 두 비우기 경로

보존 실측은 `clear()`(반환 객체 메서드)에만 있었고, `clearNuxtData()`와 언마운트 purge는 "같은 `clearNuxtDataByKey`를 타므로 구조적으로 동일하다"는 **추론**에만 의존했다.

**핵심 차이**: 두 경로는 반환 객체를 거치지 않고 **키로** 항목을 찾아 비운다 — 소비자가 `clear()`를 노출하지 않아도 일어난다. 그래서 대역이 만든 항목을 키로 등록(`clearHandlesByKey`)하고 `control.clearNuxtData(key?)`·`control.purgeOnUnmount(key?)`를 노출했다.

Nuxt에서 셋 다 `clearNuxtDataByKey` 하나로 모이므로 **대역도 `clearEntry` 하나를 공유**하고, 이름만 나눠 테스트가 어느 경로를 재현하는지 드러낸다. `describe.each`로 두 경로에 같은 3케이스를 건다.

**RED**: `useApiFetch`의 `errorAtRequestStart` 판별을 제거하면 새 두 경로가 기존 `clear()` 테스트와 **함께** 3건 실패한다 — 추론이 실측으로 바뀌었다.

### 손대지 않은 것

`useCostPersistence`의 취소 복원과 `admin/menus` 트리 재조회는 `control.value`를 새 배열로 갈아 끼워 FE-32를 우회해 왔다. 이제 없어도 되지만 명시적이라 해롭지 않고, 건드리면 무관한 회귀 위험만 생긴다.

---

## 배치 2 최종 상태

**Tier 1 · 2 · 3 전부 완료.** 이 계획서의 잔여 항목은 없다.

| Tier | 항목 | 상태 |
| --- | --- | --- |
| 1 | T1-1 ~ T1-7 | 완료 (2026-08-07) |
| 2 | T2-1 `selector-class-pattern` · T2-2 FE-22 | 완료 |
| 3 | FE-28① · FE-27 · FE-23 · FE-32 | 완료 |

최종 게이트: `format:check` / `check` / `lint:css` / `test` **204파일 2443건** 통과.

**이 배치에서 반복적으로 드러난 것** — 계획 단계의 전제가 실측과 어긋난 사례가 3건이었다.

1. **T2-1** — `selector-class-pattern`에 `ignoreSelectors` 옵션이 있다고 전제했으나 stylelint 17.12.0에는 없다.
2. **T2-2** — 인스턴스 단위 `notifyMode`로 적용 가능한 지점이 있다고 전제했으나 0개였다.
3. **FE-27** — 위생 5종이 모두 실재한다고 전제했으나 2종만 실재했다.

세 건 모두 "계획서를 그대로 실행"했다면 잘못된 결과를 냈을 것이다. 착수 시 전제를 먼저 실측하는 단계가 실제로 값을 했다.

---

## 0. 착수 전 반드시 알아야 할 상태 변화

**CQ-24가 "미커밋"이 아니다.** TASK.md는 `it_backend` 작업트리에 미커밋 변경 4건이 있다고 기록하지만, 두 저장소 모두 작업트리가 깨끗하고 해당 변경은 `관리자 메뉴 개선` 커밋(backend `4e28ee7e`, frontend `2070472`)에 그대로 실려 이미 main에 들어갔다. 즉 **판단 없이 커밋된 상태**이며 항목 성격이 "커밋할지 되돌릴지 판단"에서 "커밋된 게이트 완화를 되돌릴지 판단"으로 바뀌었다.

실측 확인:

- `it_backend/src/test/java/com/kdb/it/architecture/MaxLinesRatchetTest.java:35` → `LIMIT = 850` (종전 800)
- 같은 파일 70·123·146행의 안내 문구도 850으로 바뀜
- 반면 기준선 파일 `src/test/resources/architecture/max-lines-baselines.properties`의 규칙 주석은 여전히 **"여기 없는 파일이 800줄을 넘으면 실패한다"** — 코드와 문서가 불일치
- 이 완화의 실제 수혜자는 `com/kdb/it/domain/council/service/CouncilService.java` = **821줄**. 기준선에 등재돼 있지 않으며 LIMIT이 800이면 즉시 실패한다. 850으로 올린 덕에 통과 중이다.

**`versions.lock`도 두 저장소 모두 뒤처져 있다** (lock: frontend `0ad2829` / backend `1c6da6be` ↔ 현재: `2070472` / `4e28ee7e`). BE-03 잔여 ④와 동일 작업이다.

---

## 1. Tier 1 — 판단 불필요, 즉시 처리 (권장 1차 배치)

### T1-1. `versions.lock` 갱신 (BE-03 잔여 ④)

`scripts/update-versions-lock.ps1` 1회 실행. 다른 작업들을 커밋한 뒤 마지막에 한 번 더 실행한다.

### T1-2. CQ-24 ① — 백엔드 max-lines 상한 800 복귀

두 단계로 나뉜다. 순서가 중요하다.

1. `CouncilService.java`를 821 → 800 이하로 줄인다. 21줄 이상 추출하면 된다.
   같은 도메인에 `PlanEvaluationService`(630)가 이미 있으므로 협의회 통보/생략 흐름이나 상태 전이 헬퍼를 별도 클래스로 빼는 방향이 자연스럽다.
   **기준선 신규 등재는 금지 방향**이다 (기준선 파일 주석: "기준값 상향은 허용된 해소 수단이 아니다").
2. `MaxLinesRatchetTest.LIMIT`을 850 → 800으로 되돌리고 안내 문구 3곳(70·123·146행)도 함께 복원한다.
3. 검증: `cd it_backend && ./gradlew test --tests '*MaxLinesRatchetTest'`

되돌리지 않기로 결정한다면 기준선 properties의 주석 800을 850으로 고쳐 코드와 맞추고, 완화 사유를 CQ-24에 기록해 조용한 완화 상태를 끝낸다. **둘 중 어느 쪽이든 현재의 "코드 850 / 문서 800" 불일치는 남겨두면 안 된다.**

### T1-3. CQ-24 ② — `CouncilServiceTest.startPreparation` 계약 변경 확인

"결재완료 아니면 거부" → "이미 개최준비면 멱등 유지"로 바뀐 테스트가 대응하는 production 변경과 함께 커밋됐는지 `git show 4e28ee7e -- '*CouncilService*'`로 확인한다. production 변경 없이 테스트만 바뀌었다면 테스트가 실제 계약을 검증하지 않는 상태다.

### T1-4. FE-29 잔여 — `refreshFailedAfterSave` 개명

실측 범위: **6파일 23곳**.

```
app/composables/costList/useCostEditingState.ts
app/composables/costList/useCostPersistence.ts
app/composables/useCostListPage.ts
app/pages/info/cost/index.vue
tests/unit/composables/costList/useCostPersistence.test.ts
tests/unit/composables/useCostListPage.test.ts
```

저장 이후가 아닌 경로에도 쓰이므로 `refreshFailed` 정도로 좁힌다. 순수 기계적 개명이며 동작 변화가 없다.
**주의**: `app/pages/info/cost/index.vue`는 CQ-15 기준선 1140줄이다. 이름 길이만 바뀌므로 줄 수는 불변이지만, Prettier 재포맷으로 줄바꿈이 달라지지 않는지 `npm run format:check`로 확인한다.

### T1-5. `AttachmentNodeView.vue`의 죽은 CSS 선언 제거

`app/components/editor/AttachmentNodeView.vue:352`의 `select-events: none;`은 존재하지 않는 CSS 속성이다(바로 아래 줄에 정상적인 `user-select: none;`이 있다). 브라우저가 무시하므로 동작 변화 없이 삭제 가능하다. FE-19의 `property-no-unknown` 1건이 여기다.

### T1-6. FE-19 부분 해소 — `color-no-hex` 전용 파일 6개

hex → `docs/guides/styling/design-tokens.md` 토큰 치환은 **줄 수가 변하지 않아 CQ-15 ratchet과 충돌하지 않는다**. 이것이 이 배치에서 FE-19를 건드릴 수 있는 이유다.

| 파일 | 위반 | CQ-15 기준선 |
| --- | --- | --- |
| `app/components/layout/GlobalSearchBar.vue` | 5 (전부 hex) | 해당 없음 |
| `app/components/review/ReviewEditor.vue` | 4 (전부 hex) | 해당 없음 |
| `app/pages/budget/list.vue` | 4 (전부 hex) | 1203 (줄 수 유지 필요) |
| `app/pages/budget/approval.vue` | 4 (전부 hex) | 1072 (줄 수 유지 필요) |
| `app/pages/info/projects/index.vue` | 4 (전부 hex) | 855 (줄 수 유지 필요) |
| `app/components/common/YearPickerTitle.vue` | 3 (전부 hex) | 해당 없음 |

각 파일을 0건으로 만든 뒤 `.stylelintrc.json`의 `ignoreFiles`에서 제거해 게이트 대상으로 되돌린다.
**`.stylelintrc.json`은 config-protection 훅 대상**이다. 면제를 없애는 강화 방향이므로 2026-08-06 `9cf9d84`(AppShell.vue) 선례와 같이 사용자 승인이 필요하다.

기대 효과: 197건 → **173건**, `ignoreFiles` 28항목 → 22항목.

### T1-7. FE-19 부분 해소 — 소규모 혼합 파일 3개

| 파일 | 위반 | 내용 |
| --- | --- | --- |
| `app/components/common/StyledDataTable.vue` | 2 | `rgba(255,255,255,*)` 금지 목록 위반(L229·L239) → 토큰 치환 |
| `app/components/projects/ResourceTableSection.vue` | 1 | `no-descending-specificity`(L386) → 규칙 순서 교환 |
| `app/pages/budget/summary.vue` | 5 | hex 4 + `no-descending-specificity` 1 |

셋 다 CQ-15 기준선 밖이라 줄 수 제약이 없다. 다만 `no-descending-specificity`는 규칙 **순서**를 바꾸는 것이므로 실제 렌더 결과가 바뀔 수 있다 — 해당 화면을 브라우저로 눈으로 확인한다.

**Tier 1 합산 기대 효과**: FE-19 197 → 165건, `ignoreFiles` 28 → 19항목. CQ-24 해소. FE-29 잔여 3건 중 1건 해소.

---

## 2. Tier 2 — 결정 1회면 대량 해소 (권장 2차 배치)

### T2-1. FE-19 `selector-class-pattern` 정책 확정 (81건)

현재 81건이 세 부류로 갈린다. **부류별 처리 방식이 다르므로 결정을 먼저 내려야 한다.**

1. **vendor 클래스 — config 교정 대상, 위반 아님**
   `.ML__contains-highlight`·`.ML__focused`(MathLive), `.ProseMirror*`(Tiptap). 우리가 이름을 정할 수 없다.
   → `.stylelintrc.json`의 `selector-class-pattern`에 `ignoreSelectors`(정규식)를 추가한다. FE-19가 `:deep`/`:global`을 `ignorePseudoClasses`로 처리한 것과 같은 방식이다.
   해당 파일: `BlockMathNodeView.vue`(3), `InlineMathNodeView.vue`(3), `VariableNodeView.vue`·`board/[blbMngNo]/[nacMngNo]/index.vue` 일부.

2. **DB 컬럼명 유래 camelCase — kebab 전환 대상**
   `.cgprEno-cell`(3파일 9건), `.curC-select`(1), `.curC-col`(2). 컬럼명을 그대로 클래스명에 넣은 것이라 정당성이 없다.
   → `.cgpr-eno-cell`·`.cur-c-col`로 바꾼다. **`<template>`의 클래스 문자열도 함께 바꿔야 하고 3개 파일이 같은 이름을 공유**하므로 한 번에 처리한다: `CostFormTableSection.vue`, `TerminalTableSection.vue`, `pages/info/cost/index.vue`.
   `pages/info/cost/index.vue`는 CQ-15 기준선 1140줄이므로 줄 수 불변을 확인한다.

3. **프로젝트 BEM 표기 — 정책 결정 필요**
   `.realtime-feed-row--new` 같은 `__`/`--` 표기. 나머지 대부분이 여기 속한다.
   → **결정 사항**: BEM을 공식 표기로 인정하고 `selector-class-pattern`을 BEM 허용 정규식으로 바꿀 것인가, 아니면 kebab-case를 강제하고 기존 클래스를 전부 개명할 것인가. 전자는 config 1줄, 후자는 다수 파일 개명이다.

이 결정 하나로 81건 중 대부분이 정리된다.

### T2-2. FE-22 — `notifyMode: 'banner'` 적용 지점 선정

옵션은 도입 완료(`useRefreshGuard.ts:132`)이나 **소비처가 0곳**이다. 현재 `useRefreshGuard` 소비 파일은 57개.

적용 판단 규칙을 먼저 세운다:

- 적용 대상: 재시도 UI(배너의 [다시 조회])가 **없고** `onActivated`로 반복 실행되는 C-3 지점
- 제외: 쓰기가 선행한 Class B 지점, 배너가 스크롤 아래에 묻히는 지점(FE-25에서 기각된 사유와 동일)
- `notifyMode`는 가드 **인스턴스 단위**라 `retryRefresh()`까지 침묵한다 — 재시도 버튼이 있는 지점에 켜면 사용자 조작에 아무 반응이 없어 보인다

착수 시 57개 소비처의 (지점 분류 × 재시도 UI 유무) manifest 작성이 선행돼야 한다. Tier 1보다 명백히 비싸다.

---

## 3. Tier 3 — 테스트 전용 (사용자 영향 0, 독립 실행 가능)

| ID | 내용 | 선행 조건 |
| --- | --- | --- |
| FE-23 | `clearNuxtData()`·언마운트 purge 경로 실측 테스트 보강 | 테스트 대역이 두 경로를 구현하지 않으므로 대역 확장이 먼저 |
| FE-27 | 테스트 위생 5종(스파이 미복원·mock 공유·죽은 mock·사문화 분기·`stubGlobal` 미복원) | 세부 좌표가 산출물에 없어 `tests/unit`·`tests/integration` 재조사 선행 |
| FE-28 ① | `onActivated` → 재조회 가드 경로 무테스트 화면 14개 | 파일 목록이 산출물에 없어 재조사 선행. 🟡 Medium이라 Tier 3 중 우선순위 최상 |
| FE-32 | `createNuxtFetchFake`가 성공 반복 시 동일 객체 참조 재대입 | 성공 경로에서 새 객체 반환으로 바꾸면 **실패 경로의 참조 동일성 단언 전 파일**에 영향 — 검토 선행 |

FE-27·FE-28①은 "재조사"가 실제 작업량의 대부분이다. Tier 1·2와 달리 착수 전 규모를 알 수 없다.

---

## 4. "쉬워 보이지만 아닌" 항목 — 이번 배치에서 제외

착수 판단을 흐리지 않도록 근거와 함께 명시한다.

### BE-19 (`abusTc`에 `@NotBlank` 추가) — 프론트 선행 작업 필요

한 줄 어노테이션처럼 보이지만 그렇지 않다. `app/pages/info/projects/form.vue`에 **`abusTc` 바인딩이 아예 없다**(`grep -rn "abusTc" app/pages/info/projects/` → `index.vue`의 표시용 2곳뿐). 지금 `@NotBlank`를 붙이면 현재 프론트의 사업 등록이 400으로 전부 실패한다.
→ 순서: ① 사업 등록 폼에 사업구분 입력 추가 ② 백엔드 `@NotBlank` ③ `CodeDefaults.orNotApplicable()` 폴백(`ProjectDto.java:272`) 유지 여부 결정.

### FE-29 "다시" 문구 혼재 — 대량 치환이 아니라 규칙 정의 문제

실측: `"불러오지 못했습니다"` 72건 vs `"다시 불러오지 못했습니다"` 69건. 어느 쪽도 소수가 아니다.
두 문구는 실제로 **다른 상황**(최초 로드 실패 vs 재조회 실패)을 가리킬 가능성이 높다. 일괄 치환하면 의미를 뭉갠다.
→ 먼저 "최초 로드 = 불러오지 못했습니다 / 재조회 = 다시 불러오지 못했습니다" 규칙을 확정한 뒤, 141곳을 규칙 기준으로 감사한다. 저비용 작업이 아니다.

### FE-19 `rule-empty-line-before` 38건 — CQ-15 ratchet과 정면 충돌

`--fix`가 빈 줄을 삽입해 줄 수를 늘린다. 잔여 38건은 전부 CQ-15 기준선 파일(`budget/work.vue` 1036, `info/plan/[id].vue` 1284 등)에 있어 기준값 상향 없이는 처리할 수 없고, 상향은 금지 방향이다.
→ 해당 파일이 CQ-15로 분해돼 기준선에서 빠진 뒤에 처리한다. 2026-08-06에 이미 같은 이유로 되돌린 이력이 있다.

### FE-19 `media-feature-range-notation` 2건 — 브라우저 지원 정책 결정

이 저장소에 browserslist도 `postcss-preset-env`도 없고 autoprefixer는 range 문법을 down-level하지 않는다. 전환하면 Safari 16.4 미만에서 미디어 블록이 통째로 무시된다.
→ 최소 지원 브라우저 확정이 선행. 확정 전까지 규칙을 `"prefix"`로 고정하는 편이 안전하다.

### FE-20 (편집 중 다른 행 미저장 편집 덮어쓰기) — 동작 결함

🟢 Low이지만 데이터 유실 경로다. `useCostEditingState.ts`의 merge watcher가 `_saveError` 보유 행만 보존하는 사각지대를 넓히는 변경이며, 보존 대상을 잘못 넓히면 정상 재조회 결과가 낡은 편집으로 덮인다. 저비용 배치가 아니라 별도 TDD 대상.

### BE-20 / BE-32 / BE-33 / CQ-18 / CQ-19 / CQ-22 / LOG-03·04 / BRD-* / EAI-* / SEC-10

업무 담당자·DBA 확정, 소비처 manifest, 두 서버 기동 환경, 외부 벤더 판정 중 하나 이상이 선행 조건이다. 코드 작업으로 시작할 수 없다.

---

## 5. 실행 순서 제안

```
1차 (반나절): T1-2 → T1-3 → T1-4 → T1-5 → T1-6 → T1-7 → T1-1
2차 (결정 후): T2-1 (선행: 3부류 정책 확정)
3차 (재조사 후): FE-28① → FE-23 → FE-27 → FE-32
```

각 단계 검증:

```
cd it_frontend && npm run format:check && npm run check && npm run lint:css && npm test
cd it_backend && ./gradlew check
```

1차 완료 후 TASK.md의 CQ-24·FE-19·FE-29를 실측값으로 갱신하고 완료분은 TASK_DONE.md로 이관한다.
`.stylelintrc.json` 수정 2회(T1-6·T1-7)는 config-protection 훅에 걸리므로 사용자 승인을 미리 받아둔다.
