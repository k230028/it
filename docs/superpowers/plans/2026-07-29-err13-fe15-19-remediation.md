# ERR-13·FE-15~19 조치 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-07-29 ERR/FE 조치(ERR-11·ERR-12·FE-12~14)의 리뷰에서 파생된 6개 과제를 해소한다 — `useApiFetch` 재조회 실패 판정 오용 전수 교정(ERR-13), openapi-typescript 도입(FE-15), 편집 중 재조회 억제(FE-16), 오류 알림 중복 제거(FE-17), 네트워크 자동완성 경합 가드(FE-18), SFC 스타일 린트 커버리지(FE-19).

**Architecture:**

- ERR-13은 "조사 → 재발 방지 도구 → 교정" 순서로 진행한다. 교정 범위가 조사 결과에 달려 있으므로 **분류 기준을 계획에 못 박고** 실행자가 그 기준을 기계적으로 적용한다. 재발 방지는 올바른 사용법을 쉽게 만드는 방향(래퍼가 예외 변환 헬퍼를 함께 제공)으로 한다.
- FE-16·FE-17·FE-18은 ERR-11/ERR-12가 만든 계약(`viewMode`, `suppressNetworkError`, 시퀀스 가드 선례) 위에 얹는 소규모 수정이다.
- FE-19·FE-15는 도구 과제다. 둘 다 **먼저 측정하고 그 결과로 범위를 정한다**(위반량, 생성물 규모).

**Tech Stack:** Nuxt 4 / Vue 3 Composition API / TypeScript / PrimeVue / Vitest / Stylelint / openapi-typescript

**작업 저장소:** 코드 변경은 모두 `C:\it\it_frontend`(독립 git 저장소). 문서·리포트는 루트 `C:\it`. 커밋은 각 저장소 안에서 수행한다. Bash 작업 디렉터리는 호출 간 유지되므로 **모든 명령에 `cd <절대경로> &&`를 명시**하라.

---

## 실행 전 확정된 사실 (2026-07-29 실측)

계획 수립 중 직접 확인했다. 실행자는 이 전제를 신뢰해도 되지만, 어긋나면 즉시 보고하라.

| 항목 | 확인 결과 |
| --- | --- |
| `useApiFetch`(`app/composables/useApiFetch.ts:210`) | `return useFetch<T>(url, params)` — Nuxt 표준 반환. `refresh()`는 실패해도 reject하지 않고 `error.value`에 원인을 담으며 `data.value`를 기본값(`undefined`)으로 되돌린다 |
| `suppressNetworkError` 옵션 | `useApiFetch.ts:80`에 **이미 존재**하며 `:147`에서 네트워크 오류 토스트를 억제한다 |
| CI | `.github/workflows` **없음**. FE-15의 "CI diff 검증"은 npm 스크립트 + Health Stack 문서 편입으로 대체한다 |
| Stylelint | 루트 `.stylelintrc.json` 존재(`stylelint-config-standard` + `color-no-hex` 등 커스텀 규칙). `lint:css`는 `app/assets/css/**/*.css`만 검사. `postcss-html` **미설치**, `customSyntax` 미설정 |
| `fetchCosts()` 호출부 | 8곳(`useCostListPage.ts:78`, `pages/budget/approval.vue:73`, `pages/budget/list.vue:86`, `pages/info/index.vue:41`, `pages/project/{contract,deliberation,payment}/index.vue`) — 옵션을 `fetchCosts` 내부에 박으면 전 화면에 영향 |
| AutoComplete `@complete` 핸들러 | 16곳 중 대부분이 **클라이언트 배열 필터**(`searchMajorHdq`·`searchMajorDept`·`searchItDept`·`searchStatus`·`searchDept`·`searchAllType`·`searchAllDeptNm`·`searchAllApfSts`·`searchCTp`·`searchCTpDes`)라 경합이 성립하지 않는다. 네트워크 기반은 `searchEmployee`·`searchContinuation`·`searchContinueProjects` 계열뿐이다 |
| `useNotifications.ts:132`의 `void refresh().catch(...)` | **오탐이었다.** 그 `refresh`는 `:55`에 정의된 자체 `$apiFetch` 기반 함수라 정상적으로 reject한다. `usePendingApprovalCount`·`useApprovalDashboard`의 `refresh*`도 같은 이유로 정상. TASK.md ERR-13의 근거 문장은 2026-07-29에 이 사실로 정정했다 |
| `useApiFetch` 소비 파일 | 44개. 그중 `try { … await refresh…() }` 패턴을 포함한 파일 28개가 ERR-13 조사 표면이다 |

---

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `docs/superpowers/reports/2026-07-err13-refresh-audit.md`(루트) | ERR-13 조사 산출물 | 신규 |
| `app/composables/useApiFetch.ts` | API 래퍼 | `refreshOrThrow` 제공 (ERR-13 재발 방지) |
| `app/composables/useApiFetch.test.ts`(기존 테스트) | 래퍼 계약 | `refreshOrThrow` 테스트 |
| `docs/guides/architecture/api-client.md` | API 사용 규약 | 재조회 실패 판정 규약 명문화 |
| ERR-13 교정 대상 파일 | 조사 결과에 따라 결정 | Class A·B 교정 |
| `app/composables/costList/useCostEditingState.ts` | 편집 상태 | 편집 모드 재조회 억제 (FE-16) |
| `app/composables/useCost.ts` | 비용 API | `fetchCosts` 옵션 인자 (FE-17) |
| `app/composables/useCostListPage.ts` | costList façade | `suppressNetworkError` 전달 (FE-17) |
| `app/composables/useLatestRequest.ts` | 요청 시퀀스 가드 | 신규 (FE-18) |
| `app/composables/costList/useCostRowEditing.ts`·`useCostCarryOver.ts`·`app/features/project/useContinueProjectSearch.ts` | 자동완성 | 가드 적용 (FE-18) |
| `.stylelintrc.json`·`package.json` | 린트 설정 | SFC 스타일 검사 (FE-19) |
| `package.json`·`scripts/codegen.mjs`·`app/types/api.d.ts` | codegen | openapi-typescript 도입 (FE-15) |

---

## Task 1: ERR-13 A — `useApiFetch` 유래 `refresh` 호출부 조사·분류

**Files:**
- Create: `C:\it\docs\superpowers\reports\2026-07-err13-refresh-audit.md` (루트 저장소)

**성격:** 조사 산출물. 코드는 바꾸지 않는다. Task 3의 교정 범위가 여기서 결정된다.

- [ ] **Step 1: 대상 식별**

`useApiFetch`가 돌려주는 `refresh`만 대상이다. 자체 `$apiFetch` 기반 함수는 정상 reject하므로 제외한다.

```bash
cd C:/it/it_frontend && rg -n "useApiFetch<" app -l
```

```bash
cd C:/it/it_frontend && rg -n "refresh:\s*\w+|\{\s*[^}]*\brefresh\b[^}]*\}\s*=" app
```

각 후보의 **정의 위치를 직접 열어** `useApiFetch`(또는 이를 감싼 `fetchXxx`) 유래인지, 자체 `$apiFetch` 함수인지 확인한다. 이름만 보고 분류하지 마라 — 초기 등록 시 `useNotifications.ts:132`를 오탐으로 넣은 전례가 있다.

- [ ] **Step 2: 호출부 분류**

식별된 각 호출부를 아래 4개 클래스 중 하나로 분류한다.

| 클래스 | 정의 | 조치 |
| --- | --- | --- |
| **A. 죽은 판정** | `try/catch`나 `.catch()`로 실패를 판정하고 catch에서 상태 변경·사용자 안내를 한다. 그 분기는 도달 불가 | Task 3에서 교정 |
| **B. 조용한 낡음** | 쓰기(`$apiFetch`) 성공 직후 재조회를 호출하고 결과를 확인하지 않는다. 재조회가 실패하면 사용자는 성공 안내와 함께 낡은 목록을 최신으로 오인한다 | Task 3에서 교정 |
| **C. 의도된 무시** | 폴링·배지 등 비핵심 백그라운드 조회로, 실패 시 마지막 정상값 유지가 문서화된 계약(`it_frontend/CLAUDE.md` §2) | 조치 없음 (근거를 리포트에 기록) |
| **D. 해당 없음** | `useApiFetch` 유래가 아님(자체 `$apiFetch` 함수 등) | 조치 없음 |

- [ ] **Step 3: 리포트 작성**

`C:\it\docs\superpowers\reports\2026-07-err13-refresh-audit.md`를 만든다. `<...>`는 실측으로 채우고 추정치를 실측처럼 적지 마라.

```markdown
# ERR-13 `useApiFetch` 재조회 실패 판정 감사 (2026-07-29)

## 배경
Nuxt `useAsyncData.execute()`의 catch는 재던지지 않는다(`node_modules/nuxt/dist/app/composables/asyncData.js`).
따라서 `useApiFetch`가 돌려주는 `refresh()`는 실패해도 항상 resolve하며 `error.value`에만 원인이 남는다.

## 대상 식별 기준
`useApiFetch`(또는 이를 감싼 `fetchXxx`)에서 구조 분해한 `refresh`만 대상. 자체 `$apiFetch` 기반 동명 함수는 제외.

## 분류 결과

| 파일:라인 | refresh 출처 | 클래스 | 사용자 영향 | 조치 |
| --- | --- | :--: | --- | --- |
| <app/...> | <useApiFetch 유래 / 자체 함수> | <A/B/C/D> | <구체적 증상> | <교정 / 없음> |

- 총 조사 호출부: <n>개 (A: <n>, B: <n>, C: <n>, D: <n>)

## 교정 우선순위
1. <Class A 중 사용자 안내가 잘못 나가는 지점>
2. <Class B 중 쓰기 후 데이터 정합성이 중요한 화면>

## 조치 없음 근거
- <Class C·D 각각에 대해 왜 안전한지 한 줄>
```

- [ ] **Step 4: 커밋 (루트 저장소)**

```bash
cd C:/it && git add docs/superpowers/reports/2026-07-err13-refresh-audit.md && git commit -m "docs: ERR-13 useApiFetch 재조회 실패 판정 감사 결과 기록"
```

---

## Task 2: ERR-13 B — `refreshOrThrow` 헬퍼와 규약 문서화 (재발 방지)

**Files:**
- Modify: `it_frontend/app/composables/useApiFetch.ts`
- Test: `it_frontend/tests/unit/composables/useApiFetch.test.ts` (기존 파일에 추가)
- Modify: `it_frontend/docs/guides/architecture/api-client.md`

**의도:** 올바른 사용법을 쉽게 만든다. 예외 흐름으로 쓰고 싶으면 `refreshOrThrow()`, 상태 흐름으로 쓰고 싶으면 `error`를 직접 본다. 어느 쪽이든 "실패가 조용히 사라지는" 경로가 없어진다.

- [ ] **Step 1: 테스트 작성 (RED)**

기존 `tests/unit/composables/useApiFetch.test.ts`의 mock 구조를 먼저 읽고 그 형식에 맞춰 최하단에 추가한다.

```ts
describe('refreshOrThrow — ERR-13 재조회 실패 판정', () => {
    it('재조회가 성공하면 예외 없이 반환한다', async () => {
        const error = ref<unknown>(undefined);
        const refresh = vi.fn().mockResolvedValue(undefined);

        await expect(refreshOrThrow(refresh, error)).resolves.toBeUndefined();
    });

    it('재조회가 실패(error 세팅)하면 예외로 올린다', async () => {
        const error = ref<unknown>(undefined);
        /* Nuxt 실제 계약: reject하지 않고 error ref에 원인을 담는다 */
        const refresh = vi.fn().mockImplementation(async () => {
            error.value = new Error('네트워크 오류');
        });

        await expect(refreshOrThrow(refresh, error)).rejects.toThrow('네트워크 오류');
    });

    it('직전 실패의 잔여 error는 성공 판정을 오염시키지 않는다', async () => {
        const error = ref<unknown>(new Error('이전 실패'));
        /* Nuxt는 성공 시 error.value를 undefined로 명시적으로 비운다 */
        const refresh = vi.fn().mockImplementation(async () => {
            error.value = undefined;
        });

        await expect(refreshOrThrow(refresh, error)).resolves.toBeUndefined();
    });
});
```

- [ ] **Step 2: RED 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/composables/useApiFetch.test.ts`
Expected: FAIL — `refreshOrThrow is not defined`. 실제 출력을 보고에 포함하라.

- [ ] **Step 3: 헬퍼 구현**

`app/composables/useApiFetch.ts` 최하단에 추가하고 export한다. `Ref` 타입 import가 없으면 함께 추가한다.

```ts
/**
 * `useApiFetch`의 재조회를 예외 기반으로 감싼다 (ERR-13).
 *
 * Nuxt `useAsyncData.execute()`의 catch는 재던지지 않으므로 `refresh()`는 실패해도 항상
 * resolve하고 `error` ref에만 원인이 남는다. 따라서 `try { await refresh() } catch {}`는
 * 도달하지 못하는 죽은 분기가 된다. 예외 흐름으로 실패를 다루려는 호출자는 이 헬퍼를 쓴다.
 * 상태 흐름으로 다루려면 헬퍼 없이 `error.value`를 직접 확인한다.
 *
 * @param refresh useApiFetch가 돌려준 refresh 함수
 * @param error useApiFetch가 돌려준 error ref (성공 시 Nuxt가 undefined로 비운다)
 * @throws 재조회 실패 시 `error.value`에 담긴 원인
 */
export const refreshOrThrow = async (
    refresh: () => Promise<void>,
    error: Ref<unknown>,
): Promise<void> => {
    await refresh();
    if (error.value) throw error.value;
};
```

- [ ] **Step 4: GREEN 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/composables/useApiFetch.test.ts`
Expected: PASS

- [ ] **Step 5: 규약 문서화**

`docs/guides/architecture/api-client.md`에 아래 절을 추가한다(문서의 기존 어투·구조에 맞춰 위치를 잡아라).

```markdown
## 재조회(refresh) 실패 판정

`useApiFetch`가 돌려주는 `refresh()`는 Nuxt `useAsyncData` 계약을 따르므로 **실패해도 reject하지 않습니다.**
실패 시 `error` ref에 원인이 담기고 `data`는 기본값(`undefined`)으로 되돌아갑니다. 성공 시 Nuxt가 `error`를 비웁니다.

- `try { await refresh() } catch { ... }` / `refresh().catch(...)` 는 **도달하지 않는 죽은 분기**입니다. 쓰지 마세요.
- 상태로 다룰 때: `await refresh()` 뒤에 `error.value`를 확인합니다.
- 예외로 다룰 때: `refreshOrThrow(refresh, error)`를 사용합니다.
- 쓰기 성공 직후의 재조회는 실패를 반드시 판정하세요. 판정하지 않으면 사용자는 성공 안내와 함께 낡은 목록을 최신으로 오인합니다.
- 테스트에서 재조회 실패를 모사할 때는 **reject가 아니라** "resolve + `data` 초기화 + `error` 세팅"으로 모킹해야 실제 계약과 일치합니다.

주의: 같은 이름이라도 자체 `$apiFetch` 기반으로 정의한 `refresh` 함수(예: `useNotifications`)는 정상적으로 reject하므로 기존 try/catch가 맞습니다.
```

- [ ] **Step 6: 검증**

```bash
cd C:/it/it_frontend && npx vitest run && npm run format:check && npm run check
```
Expected: 전체 통과, 실패 0, "0 tests collected" 없음

- [ ] **Step 7: 커밋**

```bash
cd C:/it/it_frontend && git add app/composables/useApiFetch.ts tests/unit/composables/useApiFetch.test.ts docs/guides/architecture/api-client.md && git commit -m "feat: 재조회 실패를 예외로 올리는 refreshOrThrow 헬퍼와 판정 규약 추가 (ERR-13)"
```

---

## Task 3: ERR-13 C — Class A·B 호출부 교정

**Files:**
- Modify: Task 1 리포트가 Class A·B로 분류한 파일들
- Test: 교정한 지점마다 대응 단위 테스트

**범위:** Task 1 리포트의 A·B 항목 전부. C·D는 건드리지 않는다. 리포트에 없는 파일을 추가로 손대지 마라.

- [ ] **Step 1: 교정 규칙 적용**

각 지점에 아래 규칙을 기계적으로 적용한다.

**Class A(죽은 판정):** 예외 기반 판정을 제거하고 둘 중 하나로 바꾼다.
- 실패를 사용자에게 알려야 하면: `await refresh()` 후 `if (error.value) { … }`
- 호출자에게 전파해야 하면: `await refreshOrThrow(refresh, error)`

catch 블록이 하던 사용자 안내·상태 변경은 새 분기로 **그대로 옮긴다. 없애지 마라.**

**Class B(조용한 낡음):** 쓰기 성공 후 재조회 실패를 감지해 사용자에게 알린다. ERR-11에서 확립한 문구 형태를 따른다 — "쓰기는 반영되었고 목록만 못 불러왔다"는 사실을 분명히 하고, **쓰기를 재시도하지 말고 재조회만** 다시 시도할 경로를 제공한다.

- [ ] **Step 2: 지점별 테스트 (각 지점마다 RED 먼저)**

교정한 각 지점에 최소 1개 테스트를 추가한다. **재조회 실패 mock은 반드시 실제 계약을 따라야 한다:**

```ts
/* Nuxt 계약: 실패해도 resolve하고, data를 비우고, error에 원인을 담는다 */
const failingRefresh = vi.fn().mockImplementation(async () => {
    data.value = undefined;
    error.value = new Error('네트워크 오류');
});
```

`mockRejectedValue`로 모킹하면 실제와 다른 계약을 검증하는 것이므로 **금지**한다.

각 테스트는 "재조회 실패 시 사용자에게 알린다 / 상태가 남는다"를 단언한다. 교정 전 코드에서 실패하는지(RED) 실측으로 확인한 뒤 구현하라.

- [ ] **Step 3: 검증**

```bash
cd C:/it/it_frontend && npx vitest run && npm run format:check && npm run check
```
Expected: 전체 통과

- [ ] **Step 4: 커밋**

지점이 여러 화면에 걸치면 **화면·도메인 단위로 커밋을 쪼개라**(한 커밋에 전부 몰아넣지 마라).

```bash
cd C:/it/it_frontend && git commit -m "fix: <도메인>의 재조회 실패를 error 기준으로 판정 (ERR-13)"
```

---

## Task 4: FE-16 — 편집 모드에서 우발적 재조회 억제

**Files:**
- Modify: `it_frontend/app/composables/costList/useCostEditingState.ts`
- Test: `it_frontend/tests/unit/composables/costList/useCostPersistence.test.ts`(기존 `mountIntegration` 헬퍼 재사용) 또는 신규 `useCostEditingState.test.ts`

**사용자 결정(2026-07-29):** 편집 모드에서는 재조회를 억제한다. 편집 중 데이터는 사용자가 만든 상태가 유일한 진실이며, 편집 종료 시 한 번 갱신한다.

- [ ] **Step 1: 테스트 작성 (RED)**

`useCostEditingState`는 `onActivated`를 쓰므로 컴포넌트 마운트가 필요하다. 기존 `tests/unit/composables/costList/useCostPersistence.test.ts`의 `mountIntegration` 헬퍼 패턴을 따르라.

검증할 계약:
1. `viewMode`가 `'edit'`일 때 `onActivated`가 발생해도 `refreshCostsRaw`가 호출되지 않는다.
2. `viewMode`가 `'view'`일 때는 기존대로 호출된다(첫 활성화 스킵 규칙 유지).
3. 편집 모드에서 억제된 뒤 조회 모드로 전환되면 **그때 한 번** 갱신된다.
4. 억제가 없었다면 유실됐을 `_status='modified'` 행의 편집값이 그대로 남는다.

- [ ] **Step 2: RED 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/composables/costList/`
Expected: 신규 테스트 실패. 실제 출력을 보고에 포함하라.

- [ ] **Step 3: 구현**

`useCostEditingState.ts`의 `onActivated` 훅이 편집 모드에서는 재조회를 건너뛰게 하고, 억제된 갱신이 있었으면 조회 모드 복귀 시 한 번 수행하도록 `viewMode` watch를 추가한다. 한글 주석으로 이유(FE-16: 미저장 편집 유실 방지)를 남긴다.

주의:
- 기존 "첫 활성화 스킵"(`isFirstActivation`) 규칙을 깨지 마라.
- 억제 플래그는 이 composable 지역 상태로 둔다. 모듈 전역에 두면 페이지 인스턴스 간 간섭이 생긴다(`useTiptapVariables`의 교차 에디터 버그 전례).
- 복귀 시 갱신에서도 재조회 실패를 조용히 삼키지 마라(ERR-13 규약 적용).

- [ ] **Step 4: 다른 재조회 경로 점검**

`useCostTerminalDialogs.ts`·`useCostExcelTransfer.ts`·`useCostCarryOver.ts`도 `refreshCostsRaw`를 호출한다. 이들은 **사용자가 명시적으로 일으킨 동작의 후속 갱신**이므로 억제 대상이 아니다. 각 호출부를 열어 실제로 그러한지 확인하고, 편집 중 사용자 편집을 덮어쓸 수 있는 경로가 있으면 보고하라. 임의로 확대 적용하지 마라.

- [ ] **Step 5: 검증·커밋**

```bash
cd C:/it/it_frontend && npx vitest run && npm run format:check && npm run check
```

```bash
cd C:/it/it_frontend && git commit -m "fix: 전산업무비 편집 모드에서 우발적 재조회를 억제해 미저장 편집 유실 방지 (FE-16)"
```

---

## Task 5: FE-17 — 목록 재조회 실패 시 오류 알림 중복 제거

**Files:**
- Modify: `it_frontend/app/composables/useCost.ts`
- Modify: `it_frontend/app/composables/useCostListPage.ts`
- Test: `it_frontend/tests/unit/composables/useCost.test.ts`

**배경:** ERR-11이 전산업무비 목록에 재조회 실패 배너·토스트를 붙였는데 `useApiFetch`의 `onRequestError`/`onResponseError`가 이미 네트워크·5xx 토스트를 띄운다. 같은 실패가 2~3중으로 표시된다.

**주의:** `fetchCosts()`는 8곳에서 호출된다. 옵션을 `fetchCosts` 내부에 고정하면 자체 오류 UI가 없는 화면(`pages/info/index.vue` 등)에서 사용자가 아무 안내도 못 받는다. 반드시 **호출부에서 선택**하게 만든다.

- [ ] **Step 1: 테스트 작성 (RED)**

`fetchCosts`가 두 번째 인자로 받은 옵션을 `useApiFetch`에 그대로 전달하는지 검증한다. 기존 `tests/unit/composables/useCost.test.ts`의 `useApiFetch` 모킹 방식을 먼저 읽고 그 형식을 따르라. query만 넘기는 기존 호출 형태도 함께 검증해 회귀를 막아라.

- [ ] **Step 2: RED 확인** — 실제 출력을 보고에 포함하라.

- [ ] **Step 3: 구현**

```ts
    /**
     * IT 관리비 목록 조회
     *
     * @param query 조회 조건 (선택)
     * @param options useApiFetch 옵션 (선택). 화면이 자체 오류 UI를 제공하면
     *                `suppressNetworkError: true`로 공통 토스트 중복을 막는다 (FE-17)
     */
    const fetchCosts = (
        query?: Record<string, string>,
        options?: { suppressNetworkError?: boolean },
    ) => {
        return useApiFetch<ItCost[]>(API_BASE_URL, { ...(query ? { query } : {}), ...options });
    };
```

`useCostListPage.ts:78`에서 `suppressNetworkError: true`를 전달하고, 이 화면은 ERR-11 배너·토스트로 자체 안내를 제공한다는 취지를 한글 주석으로 남긴다.

- [ ] **Step 4: 5xx 경로 확인**

`useApiFetch.ts`의 `onResponseError`에서 `status >= 500` 토스트가 `suppressNetworkError`로 함께 억제되는지 코드로 확인하라. 억제되지 않으면 5xx 중복이 남으므로 그 사실을 보고하고 추가 옵션이 필요한지 판단하라. **`useApiFetch`의 억제 조건 자체를 임의로 바꾸지 마라** — 44개 소비자에 영향이 간다.

- [ ] **Step 5: 검증·커밋**

```bash
cd C:/it/it_frontend && npx vitest run && npm run format:check && npm run check
```

```bash
cd C:/it/it_frontend && git commit -m "fix: 전산업무비 목록의 재조회 실패 알림 중복 제거 (FE-17)"
```

---

## Task 6: FE-18 — 네트워크 기반 자동완성의 응답 순서 역전 가드

**Files:**
- Create: `it_frontend/app/composables/useLatestRequest.ts`
- Test: `it_frontend/tests/unit/composables/useLatestRequest.test.ts` (신규)
- Modify: `it_frontend/app/features/project/useContinueProjectSearch.ts`
- Modify: `it_frontend/app/composables/costList/useCostRowEditing.ts`(`searchEmployee`)·`useCostCarryOver.ts`(`searchContinuation`)

**범위 한정(실측):** `@complete` 핸들러 16곳 중 클라이언트 배열 필터는 경합이 성립하지 않는다. 네트워크 기반 3계열만 대상이다. 대상 판별은 핸들러 본문에 `$apiFetch`·`useApiFetch` 호출이 있는지로 한다 — 실행 시 다시 확인하고, 계획에 없는 네트워크 핸들러가 발견되면 보고 후 포함하라.

- [ ] **Step 1: 공통 가드 테스트 작성 (RED)**

`tests/unit/composables/useLatestRequest.test.ts` 신규 생성. 검증할 계약:
1. 최신 요청의 결과는 반영된다.
2. 앞선 요청이 뒤늦게 도착하면 그 결과는 버려진다.
3. 요청이 하나뿐이면 정상 반영된다.
4. 서로 다른 키(행별 자동완성 등)는 서로 간섭하지 않는다.

`app/composables/useTiptapVariables.ts:88`의 `insertRequestSeq`가 같은 문제를 해결한 선례다. 그 의미론(키 단위 시퀀스, 늦은 응답 폐기)을 참고하되 자동완성에 맞게 일반화하라.

- [ ] **Step 2: RED 확인** — 실제 출력을 보고에 포함하라.

- [ ] **Step 3: 공통 가드 구현**

`app/composables/useLatestRequest.ts`를 만든다. **공개 API는 아래 형태로 고정한다** — Step 1의 테스트와 Step 4의 세 적용 지점이 같은 계약을 가정해야 한다.

```ts
/**
 * 같은 키에 대한 요청 중 "가장 마지막에 시작된 것"만 결과를 반영하도록 하는 시퀀스 가드 (FE-18).
 *
 * 자동완성처럼 입력마다 요청이 나가는 화면에서는 앞선 요청의 응답이 뒤늦게 도착해
 * 최신 결과를 덮어쓸 수 있다. 요청 시작 시 `begin(key)`으로 받은 토큰을 응답 처리 직전
 * `isLatest(token)`으로 확인해, 최신이 아니면 아무것도 하지 않는다(no-op).
 *
 * 상태는 호출한 composable 인스턴스에 귀속된다 — 모듈 전역으로 두면 한 페이지의 여러
 * 자동완성이 서로의 시퀀스를 증가시켜 정상 응답이 폐기되는 교차 간섭이 생긴다
 * (`useTiptapVariables`가 같은 실수를 겪은 전례).
 *
 * @returns begin(요청 시작·토큰 발급), isLatest(응답이 아직 최신인지 확인)
 */
export function useLatestRequest(): {
    /** 요청 시작을 기록하고 이 요청을 식별하는 토큰을 반환한다. key 생략 시 단일 시퀀스를 쓴다. */
    begin: (key?: string) => LatestRequestToken;
    /** 해당 토큰이 그 키의 최신 요청인지 확인한다. 늦게 도착한 이전 요청이면 false. */
    isLatest: (token: LatestRequestToken) => boolean;
};
```

`LatestRequestToken`은 이 모듈이 export하는 불투명 타입으로 두어 호출자가 내부 표현(시퀀스 번호)에 의존하지 못하게 한다.

사용 형태:

```ts
const { begin, isLatest } = useLatestRequest();

const search = async (event: { query: string }) => {
    const token = begin();
    const rows = await fetchSomething(event.query);
    if (!isLatest(token)) return; // 늦게 도착한 이전 요청 — 최신 결과를 덮어쓰지 않는다
    suggestions.value = rows;
};
```

- [ ] **Step 4: 적용**

세 핸들러에 가드를 적용한다. 각각:
- 응답이 최신이 아니면 `suggestions`·오류 상태를 **건드리지 않는다**(no-op).
- ERR-12에서 만든 `continueSearchError` 계약을 깨지 마라 — 늦은 실패 응답이 최신 성공 상태를 오류로 덮어쓰면 안 된다.

- [ ] **Step 5: 적용 지점 회귀 테스트**

각 핸들러마다 "늦게 도착한 이전 요청의 결과가 최신 결과를 덮어쓰지 않는다"를 검증하는 테스트를 추가한다. `useContinueProjectSearch.test.ts`는 이미 있으므로 거기에 추가하고, 나머지는 해당 composable 테스트에 추가한다.

- [ ] **Step 6: 검증·커밋**

```bash
cd C:/it/it_frontend && npx vitest run && npm run format:check && npm run check
```

```bash
cd C:/it/it_frontend && git commit -m "fix: 네트워크 기반 자동완성에 응답 순서 역전 가드 적용 (FE-18)"
```

---

## Task 7: FE-19 — SFC `<style scoped>` 린트 커버리지

**Files:**
- Modify: `it_frontend/package.json` (devDependency, `lint:css` 스크립트)
- Modify: `it_frontend/.stylelintrc.json` (`overrides` + `customSyntax`)

**성격:** 먼저 **측정**하고 그 결과로 범위를 정한다. 기존 위반이 대량이면 전면 적용은 별도 과제로 분리한다.

- [ ] **Step 1: 위반량 측정 (코드 변경 전)**

```bash
cd C:/it/it_frontend && npm install --no-save postcss-html && npx stylelint "app/**/*.vue" --custom-syntax postcss-html 2>&1 | tail -30
```

기록할 값: 위반 총 건수, 위반 파일 수, 규칙별 상위 3개. **추정하지 말고 실제 출력을 남겨라.**

- [ ] **Step 2: 범위 결정**

측정 결과에 따라 하나를 택하고 이유를 커밋 본문에 남긴다.

- **위반이 소수(대략 20건 이하)면:** 이번 태스크에서 전부 고치고 `lint:css` 대상에 SFC를 포함한다.
- **위반이 다수면:** 게이트를 먼저 세운다(신규·변경 파일만 검사하거나, 문제 규칙만 SFC 한정으로 완화). 남은 정리는 `TASK.md`에 별도 항목으로 등록한다. **기존 위반을 숨기려고 규칙을 전역에서 끄지 마라.**

`.stylelintrc.json`의 `color-no-hex`는 "hex 대신 토큰 사용" 규약이다. SFC에 hex가 다수라면 그것이 곧 디자인 토큰 규약 위반이므로 끄지 말고 Step 2 판단에 반영하라.

- [ ] **Step 3: 설정 반영**

`postcss-html`을 devDependency로 정식 설치하고, `.stylelintrc.json`에 `overrides`로 `*.vue`에 `customSyntax`를 지정한다. `package.json`의 `lint:css` 글롭에 SFC를 추가한다.

- [ ] **Step 4: 검증·커밋**

```bash
cd C:/it/it_frontend && npm run lint:css && npm run check && npx vitest run
```
Expected: `lint:css` 통과(또는 Step 2에서 정한 범위 내 통과)

```bash
cd C:/it/it_frontend && git commit -m "chore: SFC <style scoped>를 Stylelint 검사 범위에 포함 (FE-19)"
```

---

## Task 8: FE-15 — openapi-typescript 도입

**Files:**
- Modify: `it_frontend/package.json` (devDependency + `codegen`·`codegen:check` 스크립트)
- Create: `it_frontend/scripts/codegen.mjs`
- Create: `it_frontend/app/types/api.d.ts` (생성물, 커밋 대상)
- Modify: `it_frontend/docs/guides/architecture/api-client.md`
- Modify: `C:\it\CLAUDE.md` (Health Stack 표)

**전제(스파이크 결론, `docs/superpowers/reports/2026-07-fe12-openapi-codegen-spike.md`):** openapi-typescript 조건부 채택, orval 보류. 타입만 생성하고 기존 `$apiFetch`/`useApiFetch` 래퍼는 그대로 둔다. 실측: paths 159 / schemas 234, 생성물 1파일 13,328줄, 런타임 의존성 0.

**중요:** CI가 없다(`.github/workflows` 부재). "CI에서 diff 검증"은 불가능하므로 로컬 `codegen:check` 스크립트를 만들고 Health Stack 문서에 편입한다.

- [ ] **Step 1: 생성 스크립트 작성**

`scripts/codegen.mjs`를 만든다. 요구사항:
- 백엔드 `/v3/api-docs`에서 스펙을 받아 `app/types/api.d.ts`를 생성한다.
- 백엔드 URL은 환경변수로 재정의 가능하게 하고 기본값은 `http://localhost:28080`.
- `--check` 플래그를 주면 생성물을 임시 위치에 만들어 기존 파일과 비교하고, 다르면 **비영 종료 코드**로 실패한다(스펙과 커밋된 타입의 드리프트 감지).
- 백엔드에 접속하지 못하면 명확한 안내와 함께 실패한다(조용히 성공하지 마라).
- `scripts/generate.mjs`의 기존 스타일(인자 파싱·실패 시 종료)을 참고해 일관되게 작성한다.

```json
    "codegen": "node scripts/codegen.mjs",
    "codegen:check": "node scripts/codegen.mjs --check",
```

- [ ] **Step 2: 최초 생성물 커밋**

백엔드를 기동한 상태에서 `npm run codegen`을 실행해 `app/types/api.d.ts`를 만든다. 생성물은 **커밋한다** — 백엔드 없이도 타입 검사가 되어야 하기 때문이다. 파일 상단에 "자동 생성물, 직접 수정 금지, `npm run codegen`으로 갱신"을 한글 주석으로 남긴다(생성기가 헤더를 못 붙이면 스크립트에서 붙여라).

- [ ] **Step 3: 최초 적용 범위 — 한 도메인만**

`useCost.ts` **한 곳**에만 생성 타입을 적용해 실효성을 확인한다. 서버 응답과 1:1 대응하는 수기 DTO 타입을 생성 타입으로 대체하거나, 생성 타입과의 호환성을 컴파일 타임에 강제하는 형태로 연결한다.

효과 검증: 스펙과 어긋난 필드를 일부러 참조했을 때 `npm run typecheck`가 실패하는지 확인하고 실제 출력을 보고에 포함하라(확인 후 원복).

**전면 마이그레이션은 하지 마라.** 이번 태스크의 목적은 파이프라인 구축과 1개 도메인 실증이다.

- [ ] **Step 4: 문서화**

- `docs/guides/architecture/api-client.md`에 codegen 사용법(생성·검증 명령, 언제 돌리는지, 생성물 수정 금지)을 추가한다.
- 루트 `C:\it\CLAUDE.md` §6 Health Stack 표에 `npm run codegen:check`(디렉터리 `it_frontend`, 용도 "백엔드 스펙과 프론트 생성 타입 드리프트 검사") 행을 추가한다.

- [ ] **Step 5: 검증·커밋**

```bash
cd C:/it/it_frontend && npm run check && npx vitest run && npm run format:check
```

```bash
cd C:/it/it_frontend && git commit -m "feat: openapi-typescript 타입 codegen 파이프라인 도입 (FE-15)"
```

```bash
cd C:/it && git add CLAUDE.md && git commit -m "docs: Health Stack에 codegen:check 추가 (FE-15)"
```

---

## Task 9: TASK.md 정리

**Files:**
- Modify: `C:\it\TASK.md`
- Modify: `C:\it\TASK_DONE.md`
- Modify: `C:\it\versions.lock` (병합 후)

- [ ] **Step 1: 완료 이관**

해소된 항목을 `TASK.md`에서 제거하고 `TASK_DONE.md`에 `## 2026-07-30 ERR-13·FE-15~19 조치` 절로 옮긴다. 각 항목에 커밋 해시와 검증 근거(테스트 파일·실측 수치)를 기록한다.

부분 완료 항목은 남기고 근거를 갱신한다:
- FE-15는 파이프라인 구축·1개 도메인 적용까지가 이번 범위이므로 전면 마이그레이션이 남으면 그 내용으로 갱신한다.
- FE-19에서 위반이 다수라 게이트만 세웠다면 잔여 정리를 새 항목으로 등록한다.
- ERR-13 Class A·B 교정이 일부만 끝났다면 남은 지점을 명시한다.

- [ ] **Step 2: 계획 문서 이관**

이 계획을 `docs/superpowers/plans/done/`으로 옮긴다(프로젝트 규약).

- [ ] **Step 3: 병합·잠금 갱신**

작업 브랜치를 `main`에 병합한 뒤:

```bash
cd C:/it && pwsh -File scripts/update-versions-lock.ps1
```

- [ ] **Step 4: 커밋**

```bash
cd C:/it && git add TASK.md TASK_DONE.md versions.lock docs/superpowers/plans && git commit -m "docs: ERR-13·FE-15~19 완료 이관 및 버전 잠금 갱신"
```

`TASK.md`는 다른 세션이 동시에 편집할 수 있다. 커밋 전에 `git diff TASK.md`로 내 편집 외의 변경이 섞여 있는지 확인하고, 있으면 사용자에게 알린 뒤 처리 방침을 확인하라.

---

## 검증 요약 (완료 판정 기준)

| 과제 | 판정 근거 |
| --- | --- |
| ERR-13 | 감사 리포트에 전 호출부 분류(A/B/C/D)와 근거 기록, Class A·B 전량 교정, 교정 지점마다 **실제 계약 기반 mock**(resolve + `data` 초기화 + `error` 세팅) 테스트, `refreshOrThrow` 계약 테스트 3건, 가이드 규약 명문화 |
| FE-15 | `npm run codegen`·`codegen:check` 동작, 생성물 커밋, 1개 도메인 적용 후 스펙 불일치 시 `typecheck` 실패 실증 |
| FE-16 | 편집 모드 재조회 억제·조회 모드 복귀 시 1회 갱신·편집값 보존 테스트 통과 |
| FE-17 | `fetchCosts` 옵션 전달 테스트, 전산업무비 화면에서 공통 토스트 억제 확인, 다른 7개 호출부 동작 불변 |
| FE-18 | `useLatestRequest` 계약 테스트 4건, 네트워크 자동완성 3계열 각각 늦은 응답 폐기 테스트 |
| FE-19 | 위반량 실측 기록, 결정한 범위에서 `npm run lint:css` 통과 |
| 공통 | `npx vitest run` 전체 통과(실패 0, "0 tests collected" 없음), `npm run check`, `npm run format:check` |

## 실행 순서 권고

1. **Task 1~3 (ERR-13)** — 🟡 Medium이며 사용자에게 잘못된 성공 안내가 나가는 정합성 문제다. 조사(1) → 헬퍼·규약(2) → 교정(3) 순서를 지켜라. Task 2를 먼저 해야 Task 3에서 쓸 도구가 생긴다.
2. **Task 4 (FE-16)** — 데이터 유실 성격이라 나머지 Low보다 앞선다.
3. **Task 5 (FE-17)**, **Task 6 (FE-18)** — UX·경합.
4. **Task 7 (FE-19)**, **Task 8 (FE-15)** — 도구. 둘 다 측정 결과에 따라 범위가 달라지므로 마지막에 둔다.
5. **Task 9** — 문서 마감.

## 이 계획을 실행할 때 반드시 지킬 규율 (직전 계획 실행에서 얻음)

1. **계약을 추측하지 말고 실측하라.** 직전 계획은 `refresh()`가 reject한다고 가정했다가 세 번째 리뷰 라운드에서야 틀렸음이 드러났다. 새 API·라이브러리 동작에 기대는 수정은 반드시 실행으로 확인하고 그 출력을 보고에 남겨라.
2. **테스트 mock이 실제 계약과 다르면 그 테스트는 무의미하다.** 통과하던 테스트 13개가 전부 잘못된 계약을 모킹했던 전례가 있다.
3. **커밋 전에 전체 `npx vitest run`을 돌려라.** 대상 테스트만 돌리고 커밋해 다른 스위트를 깨뜨린 전례가 있다.
4. **모킹 경계를 우회하는 값(value) import를 추가하지 마라.** `.vue` 파일에 새 런타임 import를 넣기 전에 그 파일의 기존 테스트가 무엇을 `vi.mock`하는지 확인하라.
5. **RED를 실제 출력으로 확인한 뒤 구현하라.** 구현 후에 테스트를 쓰면 그 테스트가 회귀를 잡는지 알 수 없다.
6. **Bash 작업 디렉터리는 호출 간 유지된다.** 모든 명령에 `cd <절대경로> &&`를 명시하라. 루트(`C:\it`)와 프론트(`C:\it\it_frontend`)에 같은 이름의 `docs/superpowers/plans` 디렉터리가 있어 혼동하기 쉽다.
