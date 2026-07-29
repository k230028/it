# Clean Code Wave 3 Wave C3 Composable Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `useTiptapTableTools.ts` 913줄과 `useCouncil.ts` 824줄을 기존 facade 반환 계약을 유지한 채 관심사별 composable로 분리한다.

**Architecture:** 두 원본 파일은 소비자 호환 facade로 남는다. Table tools는 cell appearance, border transaction, layout/width, floating lifecycle로 나누고 facade가 결과를 합성한다. Council은 공유 API context를 한 번 만들고 lifecycle, committee/schedule, evaluation, QnA, result, skip API module에 전달한 뒤 기존 key를 그대로 반환한다.

**Tech Stack:** Nuxt composables, Vue refs/computed/lifecycle, Tiptap/ProseMirror, TypeScript, Vitest

## Global Constraints

- `useTiptapTableTools(editor, normalizeColwidths)` 시그니처와 29개 반환 key를 유지한다.
- `useCouncil()` 인자 없음과 모든 반환 함수명·URL·HTTP method·payload·generic response type을 유지한다.
- GET은 `useApiFetch`, 명령형 요청은 `$apiFetch`를 계속 사용한다.
- store나 새 전역 상태를 만들지 않는다.
- facade에서 spread 충돌이 없도록 child module key를 사전 검증한다.
- 기존 오류 전파를 toast·fallback으로 바꾸지 않는다.
- lifecycle listener는 한 module만 소유하고 mount당 한 번만 등록·해제한다.
- 테스트 분리는 production 책임과 같은 경계를 사용한다.

## File Map

| facade | child module | 책임 |
| --- | --- | --- |
| `useTiptapTableTools.ts` | `tiptap-table/useTableCellAppearance.ts` | background/text/vertical alignment |
|  | `tiptap-table/useTableBorders.ts` | single/multi-cell border transaction |
|  | `tiptap-table/useTableLayout.ts` | width/full-width/table alignment/DOM sync |
|  | `tiptap-table/useTableFloatingPosition.ts` | position, palette outside click, lifecycle listeners |
| `useCouncil.ts` | `council/useCouncilApiContext.ts` | base URL와 `$apiFetch` |
|  | `council/useCouncilLifecycleApi.ts` | list/detail/create/approval/state transition |
|  | `council/useCouncilCommitteeApi.ts` | feasibility/committee/schedule |
|  | `council/useCouncilEvaluationApi.ts` | evaluation과 plan evaluation |
|  | `council/useCouncilQnaApi.ts` | preliminary/main QnA |
|  | `council/useCouncilResultApi.ts` | result/review/notify |
|  | `council/useCouncilSkipApi.ts` | skip request/decision |

---

### Task 1: facade 계약과 Council 미검증 API 고정

**Files:**

- Create: `tests/unit/composables/useTiptapTableTools.contract.test.ts`
- Create: `tests/unit/composables/useCouncil.contract.test.ts`
- Modify: `tests/unit/composables/useCouncil.test.ts`

- [ ] **Step 1: table facade key contract 작성**

기존 editor mock helper를 `useTiptapTableTools.test.ts`에서 test utility로 재사용하고 다음 exact key를 고정한다.

```ts
expect(Object.keys(useTiptapTableTools(editor, vi.fn())).sort()).toEqual(
    [
        'BORDER_DIRECTIONS',
        'BORDER_STYLES',
        'BORDER_WIDTHS',
        'TABLE_CELL_PALETTE',
        'applyCellBgColor',
        'applyCellBorderColor',
        'applyCellBorderStyle',
        'applyCellBorderWidth',
        'applySideBorder',
        'applyTableWidths',
        'borderPaletteVisible',
        'cellBgPaletteVisible',
        'currentCellBg',
        'currentCellBorderColor',
        'currentCellTextAlign',
        'currentCellVerticalAlign',
        'currentTableAlign',
        'pendingBorderColor',
        'pendingBorderStyle',
        'pendingBorderWidth',
        'setCellTextAlign',
        'setCellVerticalAlign',
        'setTableAlign',
        'setTableFullWidth',
        'tableFloatVisible',
        'tableFloatX',
        'tableFloatY',
        'tableOp',
        'updateTableFloat',
    ].sort(),
);
```

현재 return은 위 29개이며 이 executable contract를 SoT로 사용한다.

- [ ] **Step 2: Council facade key contract 작성**

```ts
expect(Object.keys(useCouncil()).sort()).toEqual(
    [
        'completeCouncil',
        'confirmResult',
        'confirmSchedule',
        'confirmWrittenMeeting',
        'createCouncil',
        'createMainQna',
        'createQna',
        'createSkipRequest',
        'deleteMainQna',
        'fetchCommittee',
        'fetchCouncil',
        'fetchCouncilList',
        'fetchDefaultCommittee',
        'fetchEvaluationSummary',
        'fetchFeasibility',
        'fetchMainQnaList',
        'fetchMyEvaluation',
        'fetchMyPlanEvaluation',
        'fetchMyResultReview',
        'fetchMySchedule',
        'fetchPlanEvaluationSummary',
        'fetchPlanResultSummary',
        'fetchPlanTargets',
        'fetchQnaList',
        'fetchResult',
        'fetchScheduleStatus',
        'fetchSkipRequest',
        'fetchSkipRequests',
        'notifyCouncil',
        'replyMainQna',
        'replyQna',
        'requestApproval',
        'requestResultApproval',
        'reviewResult',
        'saveCommittee',
        'saveEvaluation',
        'saveFeasibility',
        'savePlanEvaluation',
        'saveResult',
        'skipCouncil',
        'startCouncil',
        'startPreparation',
        'submitSchedule',
        'submitSkipDecision',
        'syncReviewStatus',
        'updateMainQna',
        'updateQna',
    ].sort(),
);
```

- [ ] **Step 3: 기존 테스트가 빠뜨린 11개 API characterization 추가**

`useCouncil.test.ts`의 기존 `$apiFetch`·`useApiFetch` mock 패턴으로 다음 계약을 추가한다.

| 함수 | 기대 계약 |
| --- | --- |
| `confirmWrittenMeeting` | `PUT /{id}/schedule/confirm-written` |
| `startPreparation` | `PATCH /{id}/start-preparation` |
| `createSkipRequest` | `POST /{id}/skip-request`, payload 전달 |
| `submitSkipDecision` | `POST /{id}/skip-request/decision`, payload 전달 |
| `fetchSkipRequest` | GET `/{id}/skip-request`, `suppressNotFound: true` |
| `fetchSkipRequests` | GET `/skip-requests` |
| `fetchPlanTargets` | GET `/{id}/plan-targets` |
| `fetchPlanEvaluationSummary` | GET `/{id}/plan-evaluation` |
| `fetchMyPlanEvaluation` | GET `/{id}/plan-evaluation/my`, `suppressNotFound: true` |
| `savePlanEvaluation` | `POST /{id}/plan-evaluation`, payload 전달 |
| `fetchPlanResultSummary` | GET `/{id}/plan-evaluation/result-summary` |

URL·method·body는 production 코드의 현재 literal을 그대로 기대값으로 사용한다.

- [ ] **Step 4: characterization 테스트 통과**

```powershell
cd C:\it\it_frontend
npm test -- `
  tests/unit/composables/useTiptapTableTools.contract.test.ts `
  tests/unit/composables/useCouncil.contract.test.ts `
  tests/unit/composables/useCouncil.test.ts
```

- [ ] **Step 5: 계약 테스트 커밋**

```powershell
git add -- tests/unit/composables
git commit -m "test: 대형 composable facade 계약 고정"
```

---

### Task 2: `useTiptapTableTools`를 네 책임으로 분리

**Files:**

- Create: `app/composables/tiptap-table/table-tool-types.ts`
- Create: `app/composables/tiptap-table/useTableCellAppearance.ts`
- Create: `app/composables/tiptap-table/useTableBorders.ts`
- Create: `app/composables/tiptap-table/useTableLayout.ts`
- Create: `app/composables/tiptap-table/useTableFloatingPosition.ts`
- Modify: `app/composables/useTiptapTableTools.ts`
- Split tests: `tests/unit/composables/tiptap-table/*.test.ts`

**Interfaces:**

```ts
export type EditorRef = Ref<Editor | null | undefined>;
export type NormalizeColwidths = (editor: Editor) => void;
```

- [ ] **Step 1: shared types·options 추출**

`table-tool-types.ts`:

```ts
import type { Editor } from '@tiptap/core';
import type { Ref } from 'vue';

export type EditorRef = Ref<Editor | null | undefined>;
export type NormalizeColwidths = (editor: Editor) => void;
export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type BorderOption = { value: string | null; label: string; title?: string };
export type BorderDirection = { value: string; label: string; icon: string };
```

- [ ] **Step 2: cell appearance 이동**

다음 원본 책임을 `useTableCellAppearance(editor)`로 이동한다.

```text
TABLE_CELL_PALETTE
cellBgPaletteVisible
currentCellBg / applyCellBgColor
currentCellTextAlign / setCellTextAlign
currentCellVerticalAlign / setCellVerticalAlign
```

반환 key는 facade key와 같은 이름을 사용한다.

- [ ] **Step 3: border transaction 이동**

다음을 `useTableBorders(editor)`로 이동한다.

```text
BORDER_STYLES, BORDER_WIDTHS, BORDER_DIRECTIONS
borderPaletteVisible
pendingBorderStyle/Width/Color
currentCellBorderColor
applyCellBorderStyle/Width/Color
_updateCellSideAttributes
applySideBorder
```

ProseMirror `CellSelection`, `TableMap`, transaction과 adjacent cell mirroring은 이 module만 import한다.

- [ ] **Step 4: layout·DOM width sync 이동**

다음을 `useTableLayout(editor)`로 이동한다.

```text
setTableFullWidth
currentTableAlign / setTableAlign
applyTableWidths
syncTableWidths
getTableElement
resize start/end state
```

`syncTableWidths`, resize handler는 floating lifecycle이 소비하므로 return에 포함하되 최종 facade에는 노출하지 않는다.

- [ ] **Step 5: floating position·lifecycle 이동**

```ts
export const useTableFloatingPosition = (
    editor: EditorRef,
    cellBgPaletteVisible: Ref<boolean>,
    layoutEvents: {
        getTableElement: () => HTMLTableElement | null;
        syncTableWidths: () => void;
        onTableResizeStart: (event: MouseEvent) => void;
        onTableResizeEnd: () => void;
    },
) => {
    // tableFloatVisible/X/Y, updateTableFloat, outside click,
    // mounted/unmounted listener를 원본 그대로 소유
};
```

`onMounted`·`onUnmounted`는 이 파일에만 남긴다.

- [ ] **Step 6: facade에서 합성하고 public key만 반환**

```ts
export const useTiptapTableTools = (
    editor: Ref<Editor | null | undefined>,
    normalizeColwidths: (editor: Editor) => void,
) => {
    const appearance = useTableCellAppearance(editor);
    const borders = useTableBorders(editor);
    const layout = useTableLayout(editor);
    const floating = useTableFloatingPosition(editor, appearance.cellBgPaletteVisible, {
        getTableElement: layout.internalApi.getTableElement,
        syncTableWidths: layout.internalApi.syncTableWidths,
        onTableResizeStart: layout.internalApi.onTableResizeStart,
        onTableResizeEnd: layout.internalApi.onTableResizeEnd,
    });
    const tableOp = (operation: () => void) => {
        operation();
        nextTick(() => {
            if (editor.value) normalizeColwidths(editor.value);
        });
    };

    return {
        ...appearance.publicApi,
        ...borders.publicApi,
        ...layout.publicApi,
        ...floating.publicApi,
        tableOp,
    };
};
```

각 child는 `{ publicApi, internalApi? }`를 반환해 내부 listener 함수가 facade public key에 섞이지 않게 한다.

- [ ] **Step 7: 기존 test block을 책임별 파일로 이동**

```text
tiptap-table/useTableCellAppearance.test.ts
  background, text/vertical alignment fallback

tiptap-table/useTableBorders.test.ts
  single/multi selection, inner/all/clear, adjacent mirroring

tiptap-table/useTableLayout.test.ts
  full width, DOM sync, table align, resize

tiptap-table/useTableFloatingPosition.test.ts
  position, outside click, mount/unmount listener

useTiptapTableTools.contract.test.ts
  exact 29 public keys
```

테스트 본문은 기존 28개를 삭제하지 않고 해당 파일로 이동한다.

- [ ] **Step 8: table tools 검증·커밋**

```powershell
npm test -- tests/unit/composables/tiptap-table tests/unit/composables/useTiptapTableTools.contract.test.ts
npm run check
git add -- app/composables/useTiptapTableTools.ts app/composables/tiptap-table
git add -- tests/unit/composables
git commit -m "refactor: Tiptap table tools 책임 분리"
```

---

### Task 3: `useCouncil` API를 여섯 도메인 모듈로 분리

**Files:**

- Create: `app/composables/council/useCouncilApiContext.ts`
- Create: six `useCouncil*Api.ts` files
- Create: `app/composables/council/types.ts`
- Modify: `app/composables/useCouncil.ts`
- Split: `tests/unit/composables/council/*.test.ts`

- [ ] **Step 1: 공유 context와 public type 이동**

```ts
// council/useCouncilApiContext.ts
export const useCouncilApiContext = () => {
    const { $apiFetch } = useNuxtApp();
    const config = useRuntimeConfig();
    return {
        base: `${config.public.apiBase}/api/council`,
        apiFetch: $apiFetch,
    };
};

export type CouncilApiContext = ReturnType<typeof useCouncilApiContext>;
```

`NotifyInfo`, `CreateCouncilRequest`는 `council/types.ts`로 이동하고 facade에서 type re-export한다.

```ts
export type { CreateCouncilRequest, NotifyInfo } from './council/types';
```

각 API module 첫 줄에서 context를 기존 지역명으로 구조 분해해 함수 body의 URL·request 코드를 그대로 유지한다.

```ts
const { base: BASE, apiFetch: $apiFetch } = context;
```

- [ ] **Step 2: lifecycle API 이동**

`useCouncilLifecycleApi(context)`:

```text
fetchCouncilList
fetchCouncil
createCouncil
requestApproval
startCouncil
completeCouncil
skipCouncil
startPreparation
```

- [ ] **Step 3: committee·schedule API 이동**

`useCouncilCommitteeApi(context)`:

```text
fetchFeasibility
saveFeasibility
fetchDefaultCommittee
fetchCommittee
saveCommittee
fetchScheduleStatus
confirmSchedule
confirmWrittenMeeting
fetchMySchedule
submitSchedule
```

- [ ] **Step 4: evaluation API 이동**

`useCouncilEvaluationApi(context)`:

```text
fetchEvaluationSummary
fetchMyEvaluation
saveEvaluation
fetchPlanTargets
fetchPlanEvaluationSummary
fetchMyPlanEvaluation
savePlanEvaluation
fetchPlanResultSummary
```

- [ ] **Step 5: QnA·result·skip API 이동**

```text
useCouncilQnaApi
  fetchQnaList/createQna/updateQna/replyQna
  fetchMainQnaList/createMainQna/updateMainQna/replyMainQna/deleteMainQna

useCouncilResultApi
  fetchResult/saveResult/confirmResult/reviewResult
  syncReviewStatus/fetchMyResultReview/requestResultApproval/notifyCouncil

useCouncilSkipApi
  createSkipRequest/submitSkipDecision/fetchSkipRequest/fetchSkipRequests
```

각 함수의 body는 기존 URL·option object·return type을 verbatim 이동한다.

- [ ] **Step 6: facade 합성**

```ts
export const useCouncil = () => {
    const context = useCouncilApiContext();
    return {
        ...useCouncilLifecycleApi(context),
        ...useCouncilCommitteeApi(context),
        ...useCouncilEvaluationApi(context),
        ...useCouncilQnaApi(context),
        ...useCouncilResultApi(context),
        ...useCouncilSkipApi(context),
    };
};
```

Task 1의 exact key contract가 key 누락·충돌을 차단한다.

- [ ] **Step 7: 테스트를 API module별로 분리**

```text
council/useCouncilLifecycleApi.test.ts
council/useCouncilCommitteeApi.test.ts
council/useCouncilEvaluationApi.test.ts
council/useCouncilQnaApi.test.ts
council/useCouncilResultApi.test.ts
council/useCouncilSkipApi.test.ts
useCouncil.contract.test.ts
```

기존 38개와 Task 1에서 추가한 11개를 합쳐 최소 49개 API 테스트를 유지한다.

- [ ] **Step 8: Council 검증·커밋**

```powershell
npm test -- tests/unit/composables/council tests/unit/composables/useCouncil.contract.test.ts
npm run check
git add -- app/composables/useCouncil.ts app/composables/council
git add -- tests/unit/composables
git commit -m "refactor: Council API composable 도메인 분리"
```

---

### Task 4: 두 facade ratchet 제거와 전체 검증

**Files:**

- Modify: `scripts/max-lines-baselines.mjs`
- Modify: `tests/unit/architecture/max-lines-ratchet.test.ts`

- [ ] **Step 1: facade와 child 줄 수 확인**

```powershell
Get-ChildItem app/composables/tiptap-table,app/composables/council -Recurse -File |
  ForEach-Object {
    [pscustomobject]@{ Path = $_.FullName; Lines = (Get-Content -LiteralPath $_.FullName).Count }
  } |
  Sort-Object Lines -Descending
```

`useTiptapTableTools.ts`, `useCouncil.ts`와 모든 child가 800줄 이하여야 한다.

- [ ] **Step 2: 두 기준 항목 삭제**

```text
app/composables/useTiptapTableTools.ts
app/composables/useCouncil.ts
```

C-1·C-2가 선행된 통합 branch에서는 architecture test 기대 수를 24에서 22로 낮춘다.

- [ ] **Step 3: consumer import 변화 없음 확인**

```powershell
git diff -- app/components app/pages | Select-String -Pattern "useCouncil|useTiptapTableTools"
```

Expected: production consumer 변경 0건.

- [ ] **Step 4: 전체 검증**

```powershell
npm test -- `
  tests/unit/composables/tiptap-table `
  tests/unit/composables/council `
  tests/unit/composables/useTiptapTableTools.contract.test.ts `
  tests/unit/composables/useCouncil.contract.test.ts `
  tests/unit/architecture/max-lines-ratchet.test.ts
npm run format:check
npm run check
npm test
```

- [ ] **Step 5: C-3 완료 커밋**

```powershell
git add -- scripts/max-lines-baselines.mjs
git add -- tests/unit/architecture/max-lines-ratchet.test.ts
git commit -m "chore: composable 파일 크기 기준 제거 (CQ-15 C-3)"
```

## Test Coverage

```text
TABLE TOOLS
  [★★★] exact 29 facade keys
  [★★★] appearance fallback
  [★★★] single/multi-cell border transaction
  [★★★] width/position/lifecycle cleanup

COUNCIL
  [★★★] exact 47 facade keys
  [★★★] GET URL/options
  [★★★] command method/body
  [★★★] 기존 미검증 11개 API 추가
  [★★★] error propagation 유지

RATCHET
  [★★★] facade 2개 <= 800
  [★★★] baseline 2개 삭제
```

## Baseline Evidence

- Cross-check commit: frontend `937f5f9`
- `useTiptapTableTools.ts`: 913 lines, 28 existing tests
- `useCouncil.ts`: 824 lines, 38 existing tests
- Council uncovered before this plan: 11 methods
- Production `useCouncil()` consumers: 19
- Production `useTiptapTableTools()` consumers: `TiptapEditor.vue` 1
