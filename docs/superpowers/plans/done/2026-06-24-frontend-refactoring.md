# 프론트엔드 리팩토링 (Phase 0~4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TASK.md 프론트엔드 리팩토링 항목 중 실재가 검증된 버그·dead code·중복을 제거하고 구조 결정을 반영한다 (Mock→API는 별도 spec).

**Architecture:** 위험도 오름차순(현행화 → 버그 → dead code → 추출 → 결정)으로 진행한다. 리팩토링은 외부 동작을 보존하며, 유일한 행동 변경(Phase 1 버그)은 TDD로 고정한다. 각 Phase 종료 시 `npm run check`(typecheck+lint) 0/0 + `npm test` green 게이트를 통과한다.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, TypeScript, PrimeVue, Pinia, Vitest, ESLint/Prettier.

**작업 디렉토리:** 모든 `npm`/`git` 명령은 `C:\it\it_frontend`(프론트) 기준. 단, `TASK.md`/`TASK_DONE.md`는 리포지토리 루트 `C:\it`.

**참조 spec:** `docs/superpowers/specs/2026-06-24-frontend-refactoring-design.md`

---

## File Structure

| 파일 | 책임 | Phase |
| --- | --- | --- |
| `C:\it\TASK.md`, `C:\it\TASK_DONE.md` | stale 항목 이관 | 0 |
| `app/pages/info/council-request/result/[id].vue` | 검토 진행 노출 조건 버그 수정 | 1 |
| `app/utils/councilStatus.ts` (신규) | `isReviewProgressEnabled` 순수 함수 | 1 |
| `tests/unit/utils/councilStatus.test.ts` (신규) | Phase 1 단위 테스트 | 1 |
| `app/components/AppSidebar.vue` | `_isGroupExpanded` 제거 | 2 |
| `app/pages/project/contract/index.vue` | 잔재 주석 제거 | 2 |
| `app/pages/budget/list.vue` | dead import/함수 제거 | 2 |
| `app/composables/useDocumentStatusApi.ts` (신규) | `changeStatus` 공통 헬퍼 | 3 |
| `app/composables/useProjectCostSelector.ts` (신규) | 사업집행 selector 공통 | 3 |
| `app/composables/{useEstimates,useDeliberations,useContracts,usePayments}.ts` | 공통 헬퍼 사용 | 3 |
| `app/pages/project/{deliberation,contract,payment}/index.vue` | selector composable 사용 | 3 |
| `app/composables/useProjectOptions.ts` | 인라인 후 제거(조건부) | 3 |
| `app/pages/admin/{auth-grades,roles}.vue` | `useYnOptions` 중복 제거 | 3 |
| `app/components/.../ResultForm.vue`, `app/composables/useTableColumnResize.ts` | 마이너 스타일 | 3 |
| Phase 4 대상 파일군 | 구조 결정 반영 | 4 |

---

## Phase 0 — TASK.md 현행화

### Task 0.1: stale 항목을 TASK_DONE.md로 이관

**Files:**
- Modify: `C:\it\TASK.md` (§🎨 프론트엔드 리팩토링)
- Modify: `C:\it\TASK_DONE.md`

- [ ] **Step 1: 현재 build green 재확인 (이관 근거 확보)**

Run (`C:\it\it_frontend`):
```bash
npm run check
```
Expected: typecheck 0 errors, ESLint `0 problems` 또는 `0 errors` (경고만 허용). 결과를 이관 사유에 인용한다.

- [ ] **Step 2: RichEditor 부재 재확인**

Run (`C:\it\it_frontend`):
```bash
grep -rln -i "richeditor" app/ ; echo "exit=$?"
```
Expected: 매칭 0건(컴포넌트/참조 없음 → 마이그레이션 불필요).

- [ ] **Step 3: TASK.md에서 stale 6항목 제거**

`C:\it\TASK.md` §🎨 프론트엔드 리팩토링 표에서 아래 행을 삭제한다:
- `RichEditor.client.vue` → `TiptapEditor`/`TiptapToolbar` 마이그레이션 검토
- 프론트 ESLint 오류 정리 (2026-05-14 기준 62 errors / 137 warnings)
- 전산업무비 컴포넌트 지급주기 prop 이름 정합화
- 협의회 결과 페이지 단일 template root 복구
- `pages/info/plan/[id].vue` 타입체크 실패 수정
- 프론트 typecheck 실패 현행화 (2026-06-01)
- 프론트 ESLint 오류 현행화 (2026-06-01 기준 73 errors)

- [ ] **Step 4: TASK_DONE.md에 이관 기록 추가**

`C:\it\TASK_DONE.md` 적절한 위치에 추가:
```markdown
| ✅ Done | [완료 2026-06-24] 프론트 build health 6항목 stale 정리 — lint 0 errors/2 warnings, typecheck 0 errors, RichEditor 컴포넌트/참조 부재 확인. ESLint 62/73 errors, typecheck 4건, 단일 template root, 전산업무비 prop, plan/[id] 타입, RichEditor 마이그레이션 모두 해소됨 | 2026-06-24 build 검증 |
```

- [ ] **Step 5: 재확인 필요분 처리**

다음 2건은 실코드 확인 후 결정한다:
- cost 컴포넌트 type-only import 정리: `npm run lint`가 0 errors이므로 lint 관점 해소. 단순 스타일 잔여가 없으면 TASK.md에서 제거하고 Step 4 기록에 합산.
- 위원유형 라벨 중복(D6): 아래 명령으로 실재 확인.
```bash
grep -n "당연\|소집\|간사\|getMemberTypeLabel\|typeLabel" app/components/council/ScheduleStatus.vue app/components/council/CommitteeList.vue app/components/council/CommitteeSelector.vue
```
실재하면 Phase 3 Task 3.1로 유지, 부재면 TASK.md에서 제거.

- [ ] **Step 6: Commit**

```bash
cd /c/it && git add TASK.md TASK_DONE.md && git commit -m "docs: 프론트 build health stale 6항목 TASK_DONE 이관"
```

---

## Phase 1 — Logic 버그 수정 (reviewProgressEnabled)

`councilStatus` 비교를 문자열 사전순(`>= '05'`)에서 허용 상태 집합 판정으로 교체한다. `'SKIPPED'`는 `'S' > '0'`이라 현재 `true`로 새는 버그.

### Task 1.1: 순수 함수 + 단위 테스트

**Files:**
- Create: `app/utils/councilStatus.ts`
- Test: `tests/unit/utils/councilStatus.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/utils/councilStatus.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isReviewProgressEnabled } from '~/utils/councilStatus';

describe('isReviewProgressEnabled', () => {
    it('PREPARING(05) 이상 단계는 노출 허용', () => {
        expect(isReviewProgressEnabled('05')).toBe(true);
        expect(isReviewProgressEnabled('10')).toBe(true);
        expect(isReviewProgressEnabled('13')).toBe(true);
    });

    it('결재완료(04) 이하 단계는 미노출', () => {
        expect(isReviewProgressEnabled('01')).toBe(false);
        expect(isReviewProgressEnabled('04')).toBe(false);
    });

    it("생략(SKIPPED) 협의회는 미노출 — 사전순 비교 버그 회귀 방지", () => {
        expect(isReviewProgressEnabled('SKIPPED')).toBe(false);
    });

    it('null/undefined는 미노출', () => {
        expect(isReviewProgressEnabled(null)).toBe(false);
        expect(isReviewProgressEnabled(undefined)).toBe(false);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run (`C:\it\it_frontend`): `npx vitest run tests/unit/utils/councilStatus.test.ts`
Expected: FAIL — `Cannot find module '~/utils/councilStatus'` 또는 `isReviewProgressEnabled is not a function`.

- [ ] **Step 3: 최소 구현 작성**

`app/utils/councilStatus.ts`:
```ts
/**
 * ============================================================================
 * [utils/councilStatus] 협의회 상태 코드 판정 유틸
 * ============================================================================
 * 협의회 진행상태(asctStsC) 기반 화면 노출 조건을 순수 함수로 제공합니다.
 * 문자열 사전순 비교('SKIPPED' >= '05' 오탐)를 방지하기 위해 허용 집합으로 판정합니다.
 * ============================================================================
 */
import type { CouncilStatus } from '~/types/council';

/**
 * 위원 결과서 검토 진행상황 노출 허용 상태 집합 (PRD §30)
 * PREPARING(05) 이후 모든 정상 단계. 생략(SKIPPED)·결재완료 이전(01~04)은 제외.
 */
const REVIEW_PROGRESS_STATUSES: ReadonlySet<CouncilStatus> = new Set<CouncilStatus>([
    '05', '06', '07', '08', '09', '10', '11', '12', '13',
]);

/**
 * 위원 검토 진행상황 패널 노출 가능 여부.
 *
 * @param status 협의회 진행상태(asctStsC). null/undefined면 false.
 * @returns 허용 상태 집합에 포함되면 true.
 */
export const isReviewProgressEnabled = (status: CouncilStatus | null | undefined): boolean => {
    if (!status) return false;
    return REVIEW_PROGRESS_STATUSES.has(status);
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run (`C:\it\it_frontend`): `npx vitest run tests/unit/utils/councilStatus.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/utils/councilStatus.ts tests/unit/utils/councilStatus.test.ts
git commit -m "feat: 협의회 검토 노출 판정 순수 함수 추가 (SKIPPED 사전순 버그 차단)"
```

### Task 1.2: result/[id].vue가 순수 함수 사용

**Files:**
- Modify: `app/pages/info/council-request/result/[id].vue:162-167`

- [ ] **Step 1: import 추가**

`<script setup>` 상단 import 블록에 추가:
```ts
import { isReviewProgressEnabled } from '~/utils/councilStatus';
```

- [ ] **Step 2: computed 교체**

`app/pages/info/council-request/result/[id].vue:162-167`의 현재 코드
```ts
const reviewProgressEnabled = computed(() => {
    const s = councilStatus.value;
    if (!s) return false;
    // FIXME: 문자열 사전순 비교라 'SKIPPED' >= '05'도 true — 생략된 협의회에서 검토 패널이 노출될 수 있음. 허용 상태 집합(Set.has) 판정으로 교체 필요.
    return s >= '05';
});
```
를 다음으로 교체(FIXME 주석 제거):
```ts
const reviewProgressEnabled = computed(() => isReviewProgressEnabled(councilStatus.value));
```

- [ ] **Step 3: 정적 검사 통과 확인**

Run (`C:\it\it_frontend`): `npm run check`
Expected: typecheck 0 errors, lint 0 errors. (`councilStatus.value` 타입이 `CouncilStatus | null`과 호환되는지 확인 — 불일치 시 `councilStatus` 선언 타입을 확인하고 필요 시 함수 인자 타입을 맞춘다.)

- [ ] **Step 4: 전체 테스트 통과 확인**

Run (`C:\it\it_frontend`): `npm test`
Expected: PASS (기존 + 신규).

- [ ] **Step 5: Commit**

```bash
git add app/pages/info/council-request/result/\[id\].vue
git commit -m "fix: 생략 협의회에서 위원 검토 패널 오노출 차단 (Set 판정 적용)"
```

---

## Phase 2 — Dead code 정리

### Task 2.1: AppSidebar `_isGroupExpanded` 제거

**Files:**
- Modify: `app/components/AppSidebar.vue:189-192`

- [ ] **Step 1: 참조 0건 확인**

Run (`C:\it\it_frontend`): `grep -n "_isGroupExpanded" app/components/AppSidebar.vue`
Expected: 선언부(189) 1건만. 호출부 없음.

- [ ] **Step 2: 함수 제거**

`app/components/AppSidebar.vue`에서 아래 블록 전체 삭제:
```ts
const _isGroupExpanded = (_label: string) => {
    // 현재는 모든 그룹을 펼친 상태로 취급합니다. 실제 접힘 상태는 expandedGroups에서 관리합니다.
    return true;
};
```
(바로 아래 `// 접힘/펼침 그룹 상태` 주석과 `expandedGroups`/`toggleGroup`는 유지.)

- [ ] **Step 3: 정적 검사 통과 확인**

Run (`C:\it\it_frontend`): `npm run check`
Expected: 0/0.

- [ ] **Step 4: Commit**

```bash
git add app/components/AppSidebar.vue
git commit -m "refactor: AppSidebar 미사용 _isGroupExpanded 제거"
```

### Task 2.2: contract/index.vue 잔재 주석 제거

**Files:**
- Modify: `app/pages/project/contract/index.vue:58`

- [ ] **Step 1: 현재 상태 확인**

Run (`C:\it\it_frontend`): `grep -n "── 상태 표시 ──" app/pages/project/contract/index.vue`
Expected: line 58 `/* ── 상태 표시 ── */` (함수 본문 없는 빈 주석). line 13(파일 헤더 범례)은 대상 아님.

- [ ] **Step 2: 빈 주석 제거**

line 58의 `/* ── 상태 표시 ── */` 한 줄만 삭제. (estimate/index.vue의 statusLabel 헬퍼 자리였으나 contract엔 함수가 없음.)

- [ ] **Step 3: 정적 검사 통과 확인**

Run (`C:\it\it_frontend`): `npm run check`
Expected: 0/0.

- [ ] **Step 4: Commit**

```bash
git add app/pages/project/contract/index.vue
git commit -m "refactor: contract/index 잔재 상태표시 주석 제거"
```

### Task 2.3: budget/list.vue dead code 정리

**Files:**
- Modify: `app/pages/budget/list.vue`

- [ ] **Step 1: dead 식별 (import/함수/변수 인벤토리)**

`app/pages/budget/list.vue`를 읽고, 탭 제거 이후 미사용된 항목을 식별한다. ESLint가 현재 0 errors이므로 `no-unused-vars`로는 안 걸리는 "선언되었으나 템플릿/로직에서 실제로 안 쓰이는" 항목(예: 미사용 filter/pageSize/download 함수)을 수동 확인한다.
```bash
grep -n "pageSize\|download\|filter" app/pages/budget/list.vue
```
각 식별자에 대해 템플릿(`<template>`)·script 내 참조를 grep으로 확인하고, 참조 0건만 제거 대상으로 분류한다.

- [ ] **Step 2: 미사용 항목 제거**

Step 1에서 참조 0건으로 확인된 import/함수/변수만 삭제한다. 참조가 1건이라도 있으면 보존한다(보수적 제거).

- [ ] **Step 3: 정적 검사 + 테스트 통과 확인**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, 테스트 green.

- [ ] **Step 4: 화면 동작 수동 확인(선택)**

`npm run dev` 후 `/budget/list` 진입 — 목록/필터 동작 회귀 없음 확인.

- [ ] **Step 5: Commit**

```bash
git add app/pages/budget/list.vue
git commit -m "refactor: budget/list 탭 제거 후 dead code 정리"
```

---

## Phase 3 — 중복 제거 / 추출

각 Task는 추출 후 호출부 동작 동일성을 보존한다. 공개 시그니처 변경 금지.

### Task 3.1: 위원유형 라벨 통일 (Phase 0 Step 5에서 실재 확인된 경우만)

**Files:**
- Modify: `app/components/council/ScheduleStatus.vue`
- Modify: `app/components/council/CommitteeList.vue`
- Modify: `app/components/council/CommitteeSelector.vue`

- [ ] **Step 1: 현 구현·공통 함수 확인**

```bash
grep -n "getMemberTypeLabel" app/composables/useCouncilCodes.ts
grep -n "당연\|소집\|간사\|vlrTc\|typeLabel" app/components/council/ScheduleStatus.vue app/components/council/CommitteeList.vue app/components/council/CommitteeSelector.vue
```
`useCouncilCodes().getMemberTypeLabel`이 존재하면 SoT로 사용. 없으면 본 Task를 건너뛰고 spec에 노트.

- [ ] **Step 2: ScheduleStatus.vue 로컬 맵 → 공통 함수 교체**

`ScheduleStatus.vue`의 로컬 위원유형 맵(`{'01':'당연', ...}`)을 제거하고 `const { getMemberTypeLabel } = useCouncilCodes();` 도입 후 호출부를 `getMemberTypeLabel(vlrTc)`로 교체.

- [ ] **Step 3: CommitteeList/CommitteeSelector 1줄 래퍼 제거**

두 컴포넌트의 `typeLabel` 1줄 래퍼를 제거하고 템플릿에서 `getMemberTypeLabel(...)` 직접 사용.

- [ ] **Step 4: 정적 검사 + 테스트**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, green.

- [ ] **Step 5: Commit**

```bash
git add app/components/council/ScheduleStatus.vue app/components/council/CommitteeList.vue app/components/council/CommitteeSelector.vue
git commit -m "refactor: 위원유형 라벨 useCouncilCodes로 통일"
```

### Task 3.2: `changeStatus` 공통 헬퍼 추출

4개 composable의 `changeStatus(docNo, stsTc)`는 URL의 base만 다르고 본문 동일하다. 공통 헬퍼로 통합하되 각 composable의 공개 `changeStatus` 시그니처는 유지한다.

**Files:**
- Create: `app/composables/useDocumentStatusApi.ts`
- Test: `tests/unit/composables/useDocumentStatusApi.test.ts`
- Modify: `app/composables/{useEstimates,useDeliberations,useContracts,usePayments}.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/composables/useDocumentStatusApi.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createChangeStatus } from '~/composables/useDocumentStatusApi';

describe('createChangeStatus', () => {
    it('주어진 base URL에 /{docNo}/status POST 호출', async () => {
        const apiFetch = vi.fn().mockResolvedValue(undefined);
        const changeStatus = createChangeStatus(apiFetch, 'http://x/api/project/estimates');
        await changeStatus('DOC1', '42');
        expect(apiFetch).toHaveBeenCalledWith('http://x/api/project/estimates/DOC1/status', {
            method: 'POST',
            body: { stsTc: '42' },
        });
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run (`C:\it\it_frontend`): `npx vitest run tests/unit/composables/useDocumentStatusApi.test.ts`
Expected: FAIL — 모듈/함수 없음.

- [ ] **Step 3: 헬퍼 구현**

`app/composables/useDocumentStatusApi.ts`:
```ts
/**
 * ============================================================================
 * [useDocumentStatusApi] 사업집행 문서 상태전이 공통 헬퍼
 * ============================================================================
 * 소요예산/과업심의/계약/지급 4개 도메인의 changeStatus가 동일한 본문으로
 * `{base}/{docNo}/status`에 POST하므로 base URL만 다른 호출을 팩토리로 통합합니다.
 * 각 composable의 공개 changeStatus 시그니처는 유지합니다.
 * ============================================================================
 */
type ApiFetch = <T>(url: string, opts: { method: string; body: unknown }) => Promise<T>;

/**
 * 상태전이 함수 생성.
 *
 * @param apiFetch $apiFetch 주입 (절대 URL 필수, CLAUDE.md §4.3.1)
 * @param baseUrl 도메인 base (예: `${apiBase}/api/project/estimates`)
 * @returns (docNo, stsTc) => Promise<void>
 */
export const createChangeStatus = (apiFetch: ApiFetch, baseUrl: string) => {
    return async (docNo: string, stsTc: string): Promise<undefined> => {
        return apiFetch<undefined>(`${baseUrl}/${docNo}/status`, {
            method: 'POST',
            body: { stsTc },
        });
    };
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run (`C:\it\it_frontend`): `npx vitest run tests/unit/composables/useDocumentStatusApi.test.ts`
Expected: PASS.

- [ ] **Step 5: 4개 composable 적용**

각 composable(`useEstimates`/`useDeliberations`/`useContracts`/`usePayments`)에서 `changeStatus` 인라인 구현을 다음으로 교체. (예: useEstimates.ts:118-123)
```ts
import { createChangeStatus } from '~/composables/useDocumentStatusApi';
// ...composable 내부, $apiFetch와 API_BASE_URL 확보 이후:
const changeStatus = createChangeStatus($apiFetch, API_BASE_URL);
```
주석은 각 도메인 상태전이 설명(예: 41→42→49)을 `createChangeStatus` 호출 위에 유지한다. `return { ..., changeStatus, ... }` 노출은 그대로.

- [ ] **Step 6: 정적 검사 + 테스트**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, green (기존 4개 composable 테스트 포함).

- [ ] **Step 7: Commit**

```bash
git add app/composables/useDocumentStatusApi.ts tests/unit/composables/useDocumentStatusApi.test.ts app/composables/useEstimates.ts app/composables/useDeliberations.ts app/composables/useContracts.ts app/composables/usePayments.ts
git commit -m "refactor: 사업집행 changeStatus 공통 헬퍼로 4중복 통합"
```

### Task 3.3: `useProjectCostSelector` 추출

**Files:**
- Create: `app/composables/useProjectCostSelector.ts`
- Modify: `app/pages/project/{deliberation,contract,payment}/index.vue`

- [ ] **Step 1: 중복 상태·로직 인벤토리**

3개 페이지를 읽고 공통 반응형 상태/함수를 식별한다:
```bash
grep -n "selectedTgt\|selectedProject\|selectedCost\|hasTarget\|selectedCncdRfrNo\|resetSelection" app/pages/project/deliberation/index.vue app/pages/project/contract/index.vue app/pages/project/payment/index.vue
```
3개 페이지에서 구현이 동일한지 확인한다(차이가 있으면 차이를 옵션 인자로 흡수).

- [ ] **Step 2: composable 작성**

`app/composables/useProjectCostSelector.ts`에 공통 상태를 추출한다. 공개 형태:
```ts
/**
 * ============================================================================
 * [useProjectCostSelector] 사업집행 대상(사업/전산업무비) 선택 상태 공통
 * ============================================================================
 * deliberation/contract/payment index.vue가 동일하게 보유하던
 * 대상구분 선택 상태와 초기화 로직을 단일 소스로 제공합니다.
 * ============================================================================
 */
import { computed, ref } from 'vue';

export const useProjectCostSelector = () => {
    const selectedTgt = ref<string | null>(null);
    const selectedProject = ref<unknown | null>(null);
    const selectedCost = ref<unknown | null>(null);
    const selectedCncdRfrNo = ref<string | null>(null);

    const hasTarget = computed(() => selectedProject.value !== null || selectedCost.value !== null);

    const resetSelection = (): void => {
        selectedTgt.value = null;
        selectedProject.value = null;
        selectedCost.value = null;
        selectedCncdRfrNo.value = null;
    };

    return { selectedTgt, selectedProject, selectedCost, selectedCncdRfrNo, hasTarget, resetSelection };
};
```
주의: Step 1에서 확인한 실제 타입(`selectedProject`/`selectedCost`의 도메인 타입)으로 `unknown`을 교체한다. 페이지별로 타입이 다르면 제네릭 `useProjectCostSelector<P, C>()`로 일반화한다.

- [ ] **Step 3: 3개 페이지 적용**

각 index.vue에서 중복 `ref`/`computed`/`resetSelection` 선언을 제거하고:
```ts
const { selectedTgt, selectedProject, selectedCost, selectedCncdRfrNo, hasTarget, resetSelection } = useProjectCostSelector();
```
로 교체. 템플릿 바인딩은 동일 이름이므로 무수정.

- [ ] **Step 4: 정적 검사 + 테스트**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, green.

- [ ] **Step 5: 화면 회귀 수동 확인(선택)**

`npm run dev` → `/project/deliberation`, `/project/contract`, `/project/payment` 각각 대상 선택/초기화 동작 확인.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useProjectCostSelector.ts app/pages/project/deliberation/index.vue app/pages/project/contract/index.vue app/pages/project/payment/index.vue
git commit -m "refactor: 사업집행 대상 선택 상태 useProjectCostSelector로 공통화"
```

### Task 3.4: `useProjectOptions` 인라인 전환 (사용처 1곳일 때만)

**Files:**
- Modify: `app/pages/info/projects/form.vue`
- Delete(조건부): `app/composables/useProjectOptions.ts`

- [ ] **Step 1: 실제 사용처 수 확인**

```bash
grep -rln "useProjectOptions" app/
```
composable 자체 주석은 projects/form.vue + cost/form.vue 2곳을 주장하나, 실제 import는 grep으로 확정한다.
- **사용처 1곳(projects/form.vue)일 때만** 인라인 진행(Step 2~).
- **2곳 이상이면** 인라인 시 중복 발생 → 본 Task를 건너뛰고 TASK.md 항목을 "공통 유지" 사유로 종료 처리.

- [ ] **Step 2: form.vue에 인라인**

`projects/form.vue`에서 `useProjectOptions()` 호출을 제거하고 동등 로컬 선언으로 대체:
```ts
const currentYear = new Date().getFullYear();
const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
const prjTypeOptions = ['신규', '계속'];
```
(반환되던 두 값 모두 인라인. 사용하지 않는 값은 두지 않음.)

- [ ] **Step 3: composable 파일 삭제**

```bash
git rm app/composables/useProjectOptions.ts
```

- [ ] **Step 4: 정적 검사 + 테스트**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, green (useProjectOptions 단위 테스트가 있으면 함께 제거).

- [ ] **Step 5: Commit**

```bash
git add app/pages/info/projects/form.vue
git commit -m "refactor: 단일 사용 useProjectOptions를 form.vue에 인라인"
```

### Task 3.5: 관리자 `사용여부` 옵션/태그 중복 제거

**Files:**
- Modify: `app/pages/admin/auth-grades.vue`, `app/pages/admin/roles.vue`
- Create(필요 시): `app/composables/useYnOptions.ts` 또는 `app/utils/ynOptions.ts`

- [ ] **Step 1: 중복 식별**

```bash
grep -n "useYnOptions\|사용\|미사용\|ynOptions\|getYnTag" app/pages/admin/auth-grades.vue app/pages/admin/roles.vue
```
두 페이지의 동일한 옵션 배열과 태그 표시 로직을 확인한다. 이미 `useYnOptions`가 한쪽에 있으면 그것을 공용으로 승격, 없으면 신규 생성.

- [ ] **Step 2: 공통 모듈 작성**

옵션 배열 + 태그 클래스 로직을 `app/composables/useYnOptions.ts`(또는 `utils/ynOptions.ts`)로 단일화:
```ts
/** 사용여부(Y/N) 공통 선택지 및 표시 헬퍼 */
export const useYnOptions = () => {
    const ynOptions = [
        { label: '사용', value: 'Y' },
        { label: '미사용', value: 'N' },
    ];
    const getYnLabel = (v: string): string => (v === 'Y' ? '사용' : '미사용');
    return { ynOptions, getYnLabel };
};
```
실제 두 페이지가 쓰던 라벨/값/태그 클래스에 맞춰 필드를 정확히 옮긴다.

- [ ] **Step 3: 두 페이지 적용**

각 페이지의 로컬 옵션/라벨 로직을 제거하고 공통 모듈을 import해 사용.

- [ ] **Step 4: 정적 검사 + 테스트**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, green.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useYnOptions.ts app/pages/admin/auth-grades.vue app/pages/admin/roles.vue
git commit -m "refactor: 관리자 사용여부 옵션/표시 로직 공통화"
```

### Task 3.6: 마이너 스타일 정리 (ResultForm, useTableColumnResize)

**Files:**
- Modify: `app/components/council/result/ResultForm.vue` (경로는 grep으로 확정)
- Modify: `app/composables/useTableColumnResize.ts`

- [ ] **Step 1: ResultForm emit/type 단순화**

```bash
grep -rn "ResultData\|defineEmits\|'saved'\|'confirmed'" app/components/**/ResultForm.vue
```
미사용 `ResultData` import 제거, emit 오버로드를 단일 시그니처(`(e: 'saved' | 'confirmed'): void`)로 축약.

- [ ] **Step 2: useTableColumnResize 스타일 일관화**

`Number.parseInt`/`Number.parseFloat`, `Array.from` 등 숫자 파싱/배열 초기화 스타일을 파일 내 일관되게 정리(동작 불변).

- [ ] **Step 3: 정적 검사 + 테스트**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, green.

- [ ] **Step 4: Commit**

```bash
git add app/components/council/result/ResultForm.vue app/composables/useTableColumnResize.ts
git commit -m "refactor: ResultForm emit/type 및 useTableColumnResize 스타일 정리"
```

---

## Phase 4 — 구조 결정 항목

각 Task 시작 전 spec §3 Phase 4 권장안을 확인하고, 이견이 없으면 권장안대로 진행한다.

### Task 4.1: `useDeptFilter` — 규칙 폐기

**Files:**
- Modify: `C:\it\it_frontend\CLAUDE.md` §4.7.1.3
- Modify: `C:\it\TASK.md`, `C:\it\TASK_DONE.md`

- [ ] **Step 1: CLAUDE.md 정리**

`it_frontend/CLAUDE.md` §4.7.1.3에 "공통 `useDeptFilter`는 도입하지 않음. 페이지별 `bbrC` 전달 + 백엔드 최종 검증 방식을 표준으로 유지(YAGNI)." 명시.

- [ ] **Step 2: TASK.md 항목 종료**

"공통 `useDeptFilter` composable 구현 또는 규칙 폐기 결정" 항목을 제거하고 TASK_DONE.md에 "2026-06-24 폐기 결정" 기록.

- [ ] **Step 3: Commit**

```bash
cd /c/it && git add it_frontend/CLAUDE.md TASK.md TASK_DONE.md && git commit -m "docs: useDeptFilter 공통화 폐기 결정 반영"
```

### Task 4.2: `/admin/boards` 레이아웃 일관화

**Files:**
- Modify: `app/pages/admin/boards.vue` (경로는 grep으로 확정)

- [ ] **Step 1: 현재 definePageMeta 확인**

```bash
grep -rn "definePageMeta\|middleware\|layout" app/pages/admin/boards*.vue
```
Expected: `middleware: 'admin'`만 있고 `layout: 'admin'` 없음.

- [ ] **Step 2: layout 추가**

`definePageMeta({ middleware: 'admin' })` → `definePageMeta({ middleware: 'admin', layout: 'admin' })`.

- [ ] **Step 3: 정적 검사 + 화면 확인**

Run (`C:\it\it_frontend`): `npm run check`
이어 `npm run dev` → `/admin/boards` 진입, 관리자 레이아웃 적용 확인.

- [ ] **Step 4: Commit**

```bash
git add app/pages/admin/boards.vue
git commit -m "fix: /admin/boards 관리자 레이아웃 적용"
```

### Task 4.3: `ReviewVersionHistory.formatDateTime` 도메인 전용 명명

**Files:**
- Modify: `app/components/review/ReviewVersionHistory.vue`

- [ ] **Step 1: 로컬 함수 의도 확인**

```bash
grep -n "formatDateTime" app/components/review/ReviewVersionHistory.vue
```
공통 `utils/common.formatDateTime`과 다른 축약 표시면 도메인 전용 이름(예: `formatVersionTimestamp`)으로 변경. 동일 동작이면 공통 함수로 교체.

- [ ] **Step 2: 이름 변경 또는 공통화 적용**

- 축약 의도 유지: 로컬 함수명을 `formatVersionTimestamp`로 rename(호출부 동기화).
- 공통과 동일: 로컬 제거 후 `import { formatDateTime } from '~/utils/common'`.

- [ ] **Step 3: 정적 검사 + 테스트**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, green.

- [ ] **Step 4: Commit**

```bash
git add app/components/review/ReviewVersionHistory.vue
git commit -m "refactor: ReviewVersionHistory 날짜 포맷 함수 명확화"
```

### Task 4.4: `useNotifications` 모듈 싱글턴 → `useState` SSR-safe 전환

**Files:**
- Modify: `app/composables/useNotifications.ts:17-21`
- Modify: `C:\it\it_frontend\CLAUDE.md` §4.7.3
- Test: `tests/unit/composables/useNotifications.test.ts` (있으면 갱신)

- [ ] **Step 1: 현재 모듈 스코프 상태 확인**

```bash
grep -n "unreadCount\|items\|loading\|pollHandle\|ref(" app/composables/useNotifications.ts | head -20
```
모듈 최상단의 `const unreadCount = ref(0)` 등 싱글턴 상태를 식별한다.

- [ ] **Step 2: `useState`로 전환**

모듈 스코프 `ref`를 composable 내부 `useState` 키 기반으로 이동:
```ts
const unreadCount = useState<number>('notif:unreadCount', () => 0);
const items = useState<NotificationItem[]>('notif:items', () => []);
const loading = useState<boolean>('notif:loading', () => false);
```
`pollHandle`(타이머 핸들)은 SSR 비대상·클라이언트 전용이므로 모듈 스코프 유지 가능하나, 테스트 누출 방지를 위해 `useState<ReturnType<typeof setInterval> | null>('notif:pollHandle', () => null)` 또는 클라이언트 가드와 함께 둔다. 기존 §4.7.3 계약(폴링 에러 삼킴, 사용자 호출 전파)·공개 함수 시그니처는 유지한다.

- [ ] **Step 3: 정적 검사 + 테스트**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, green. 기존 useNotifications 테스트의 모듈 싱글턴 가정이 깨지면 `useState` mock(`vi.mock('#app')`)으로 갱신.

- [ ] **Step 4: 드롭다운/폴링 회귀 확인(선택)**

`npm run dev` → 알림 드롭다운 열기/읽음/폴링 동작 확인.

- [ ] **Step 5: CLAUDE.md §4.7.3 노트 갱신 + Commit**

`useNotifications` 상태가 `useState` 기반 SSR-safe임을 §4.7.3 "반응형 상태" 항목에 반영.
```bash
git add app/composables/useNotifications.ts it_frontend/CLAUDE.md tests/unit/composables/useNotifications.test.ts
git commit -m "refactor: useNotifications 싱글턴을 useState SSR-safe 상태로 전환"
```

### Task 4.5: `useNotifications.refresh()` 호출부 toast 보장

**Files:**
- Modify: `app/components/AppHeader.vue` (실제 호출부는 grep으로 확정)

- [ ] **Step 1: 명시적 호출부 식별**

```bash
grep -rn "\.refresh()\|useNotifications" app/components app/layouts | grep -i "notif\|header"
```
드롭다운 열기 등 `refresh()` 직접 호출 위치를 찾는다.

- [ ] **Step 2: catch+toast 보강**

호출부가 try-catch 없이 `refresh()`를 호출하면 CLAUDE.md §4.2.1 패턴으로 감싼다:
```ts
const toast = useToast();
try {
    await refresh();
} catch (error: unknown) {
    const message = (error as { data?: { message?: string } })?.data?.message || '알림을 불러오지 못했습니다.';
    toast.add({ severity: 'error', summary: '오류', detail: message, life: 3000 });
}
```
이미 처리돼 있으면 변경 없이 Task 종료(확인만).

- [ ] **Step 3: 정적 검사 + 테스트**

Run (`C:\it\it_frontend`): `npm run check && npm test`
Expected: 0/0, green.

- [ ] **Step 4: Commit**

```bash
git add app/components/AppHeader.vue
git commit -m "fix: 알림 새로고침 실패 시 호출부 toast 보강"
```

### Task 4.6: Tiptap 표 도구 계약 문서화

**Files:**
- Modify: `app/composables/useTiptapTableTools.ts` (TSDoc 보강)
- Create: `it_frontend/docs/guides/tiptap-table-tools.md`

- [ ] **Step 1: 공개 API 인벤토리**

```bash
grep -n "return {\|export\|const .* = " app/composables/useTiptapTableTools.ts | head -40
```
공개 함수/반환값과 `TiptapTableFloatingToolbar.vue`의 연동 지점을 정리한다.

- [ ] **Step 2: TSDoc 보강**

각 공개 함수에 입력/실패조건/저장영향(특히 `syncColumnWidths`의 빈 catch 의미)을 한글 TSDoc으로 명시한다.

- [ ] **Step 3: 가이드 문서 작성**

`it_frontend/docs/guides/tiptap-table-tools.md`에 사용 계약(공개 API, 호출 순서, 실패/저장 영향, 툴바 연동)을 정리한다.

- [ ] **Step 4: 정적 검사**

Run (`C:\it\it_frontend`): `npm run check`
Expected: 0/0.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useTiptapTableTools.ts it_frontend/docs/guides/tiptap-table-tools.md
git commit -m "docs: Tiptap 표 도구 계약 문서화 및 TSDoc 보강"
```

---

## 최종 검증

- [ ] **전체 게이트**

Run (`C:\it\it_frontend`):
```bash
npm run check && npm test && npm run format:check
```
Expected: typecheck 0, lint 0 errors, 테스트 green, 포맷 준수.

- [ ] **TASK.md 정합**

`C:\it\TASK.md` §🎨 프론트엔드 리팩토링에 처리 완료 항목이 남아있지 않은지, 이관 기록이 `TASK_DONE.md`에 있는지 확인.

---

## Self-Review 노트 (작성자 확인)

- **Spec 커버리지:** Phase 0(stale 정리)·1(B 버그)·2(C dead code)·3(D 추출)·4(결정 6건) 모두 Task 매핑됨. Phase 5(F Mock→API)는 의도적 범위 외(별도 spec).
- **조건부 Task 명시:** Task 3.1(라벨 중복), 3.4(useProjectOptions 인라인)은 grep 실측 결과에 따라 진행/생략 분기 — 거짓 작업 방지.
- **타입 일관성:** Phase 1 `isReviewProgressEnabled(status: CouncilStatus | null | undefined)`, Phase 3 `createChangeStatus(apiFetch, baseUrl)` 시그니처가 사용처와 일치.
- **게이트 일관성:** 모든 Phase 종료에 `npm run check`(+필요 시 `npm test`) 동일 적용.
