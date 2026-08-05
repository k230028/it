# Clean Code Wave 3 Wave C Frontend Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wave B의 증가 불가 ratchet을 이용해 HWPX, Tiptap editor, 대형 composable의 8개 기준 항목을 제거하고 나머지 22개 UI 파일에는 기능 변경 시 발동하는 분해 계약을 적용한다.

**Architecture:** 즉시 분해 가능한 세 subsystem은 각각 별도 실행계획과 독립 커밋군으로 수행한다. 외부 소비자가 사용하는 `hwpx.ts`, `tiptap-*.ts`, `useTiptapTableTools`, `useCouncil` facade는 유지하고 내부 책임만 작은 모듈로 이동해 import/API churn을 제한한다. 화면 20개와 공통·비용 컴포넌트 2개는 일괄 분해하지 않고 기능 변경 PR마다 하나의 관심사를 추출한다.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Tiptap, JSZip, Vitest, Vue Test Utils, Playwright, ESLint max-lines ratchet

## Global Constraints

- 선행 계획 [`Wave B`](2026-07-29-clean-code-wave3-wave-b-frontend-structure.md)가 완료되어 `max-lines` ratchet과 `components/editor`·`components/layout` 경계가 존재해야 한다.
- 모든 공개 함수명, 타입, component props/emits, auto-import 이름, route, API URL·method·payload·response 타입을 유지한다.
- 새 모듈은 800줄 이하로 작성하고, 분해 완료 파일은 같은 커밋에서 `OVERSIZED_FILE_BASELINES` 항목을 삭제한다.
- “줄 수 맞추기”를 위한 의미 없는 래퍼·재export 계층은 만들지 않는다. facade는 실제 호환 경계인 네 곳에만 둔다.
- 동작 변경과 구조 분해를 같은 커밋에 섞지 않는다.
- HWPX는 생성 ZIP entry, XML 구조, 이미지 실패 처리, public export를 보존한다.
- editor는 Tiptap extension 이름·schema·PluginKey와 UI 접근성 label을 보존한다.
- composable은 기존 반환 객체의 key와 함수 시그니처를 보존한다.
- 모든 신규 주석과 TSDoc은 한글로 작성한다.

## Child Plan Index

| 순서 | 실행계획 | 제거 기준 | 완료 후 잔여 |
| ---: | --- | ---: | ---: |
| C-1 | [`HWPX 분해`](2026-07-29-clean-code-wave3-wave-c1-hwpx-decomposition.md) | 1 | 29 |
| C-2 | [`Editor 분해`](2026-07-29-clean-code-wave3-wave-c2-editor-decomposition.md) | 5 | 24 |
| C-3 | [`Composable 분해`](2026-07-29-clean-code-wave3-wave-c3-composable-decomposition.md) | 2 | 22 |
| C-4 | 이 문서의 trigger playbook | PR별 1개 이상 | 점진 감소 |

## Review Decisions

| 결정 | 확정안 | 이유 |
| --- | --- | --- |
| C-1 public entry | `app/utils/hwpx.ts` 유지 | `useHwpxExport`와 테스트 import를 바꾸지 않는다. |
| C-2 compatibility entry | `editor/extensions/tiptap-extensions.ts`, `tiptap-content-extensions.ts` 유지 | extension 소비자와 mock 경로를 안정화한다. |
| C-2 UI 분리 | dialog·table control·CSS·variable resolution 기준 | template와 상태 소유권을 함께 이동해 prop drilling을 제한한다. |
| C-3 public entry | `useTiptapTableTools`, `useCouncil` 유지 | 다수 화면의 destructuring 계약을 바꾸지 않는다. |
| C-4 방식 | 일괄 프로젝트 금지, 기능 변경 PR 동반 추출 | 22개 UI 파일의 회귀 표면과 서로 다른 도메인 책임을 한 번에 묶지 않는다. |

## Dependency Order

```text
Wave B ratchet + component move
            │
            ├─ C-1 HWPX ─────────────────────────┐
            ├─ C-2 Editor ───────────────────────┼─> Wave C immediate gate
            └─ C-3 Composables ──────────────────┘         │
                                                           v
                                              C-4 triggered repayment
```

- C-1, C-2, C-3은 서로 다른 파일을 수정하므로 별도 worktree에서 병렬 실행할 수 있다.
- 세 lane 모두 `scripts/max-lines-baselines.mjs`를 수정하므로 병합 시 기준 항목 삭제 충돌을 수동으로 합친다. 최종 결과는 기존 30개 중 8개가 제거된 22개다.
- C-2는 Wave B의 editor 경로를 전제로 하므로 Wave B와 병렬 실행하지 않는다.

---

### Task 1: C-1 HWPX child plan 실행

**Files:**

- Plan: `docs/superpowers/plans/2026-07-29-clean-code-wave3-wave-c1-hwpx-decomposition.md`

- [ ] **Step 1: C-1 계획의 모든 task를 순서대로 실행**
- [ ] **Step 2: `app/utils/hwpx.ts`가 800줄 이하이고 public export가 동일한지 확인**
- [ ] **Step 3: `app/utils/hwpx.ts` 기준 항목 삭제를 확인**

Expected public exports:

```ts
export interface HwpxTitleOptions;
export interface HwpxBlobOptions;
export function preprocessHtmlForHwpx(html: string): string;
export const htmlToHwpxBlob: (
    html: string,
    title?: string | HwpxTitleOptions,
    opts?: HwpxBlobOptions,
) => Promise<Blob>;
```

---

### Task 2: C-2 Editor child plan 실행

**Files:**

- Plan: `docs/superpowers/plans/2026-07-29-clean-code-wave3-wave-c2-editor-decomposition.md`

- [ ] **Step 1: C-2 계획의 extension → editor core → toolbar 순서를 지킨다**
- [ ] **Step 2: 다음 다섯 기준 항목이 모두 삭제됐는지 확인**

```text
app/components/editor/TiptapEditor.vue
app/components/editor/TiptapToolbar.vue
app/components/editor/TiptapTableFloatingToolbar.vue
app/components/editor/extensions/tiptap-extensions.ts
app/components/editor/extensions/tiptap-content-extensions.ts
```

- [ ] **Step 3: 기존 editor public component·extension 이름이 유지되는지 확인**

---

### Task 3: C-3 Composable child plan 실행

**Files:**

- Plan: `docs/superpowers/plans/2026-07-29-clean-code-wave3-wave-c3-composable-decomposition.md`

- [ ] **Step 1: `useTiptapTableTools` facade 분해와 테스트 분리를 완료**
- [ ] **Step 2: `useCouncil` facade 분해와 누락 API 테스트 보강을 완료**
- [ ] **Step 3: 두 facade 기준 항목 삭제를 확인**

---

### Task 4: 즉시 실행분 전체 게이트

**Files:**

- Verify: `it_frontend/**`
- Modify: `it_frontend/scripts/max-lines-baselines.mjs`

- [ ] **Step 1: ratchet 잔여 수와 물리 줄 수 확인**

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts
```

Expected: 기준 항목 22개. Architecture test의 최초 30개 고정 assertion은 Wave C에서 `22`로 낮추고 “추가 금지·현재 파일과 일치” 의미를 유지한다.

- [ ] **Step 2: 전체 품질 게이트 실행**

```powershell
npm run format:check
npm run check
npm test
npm run test:e2e
```

Expected: 모두 exit code 0, 신규 경고 없음.

- [ ] **Step 3: exact 잔여 목록 확인**

```powershell
@'
import { OVERSIZED_FILE_BASELINES } from './scripts/max-lines-baselines.mjs';
console.log(Object.keys(OVERSIZED_FILE_BASELINES).sort().join('\n'));
'@ | node --input-type=module -
```

Expected: 다음 20개 page와 두 component만 출력.

```text
app/components/common/EmployeeSearchDialog.vue
app/components/cost/TerminalTableSection.vue
app/pages/admin/codes.vue
app/pages/admin/logs/[logKey].vue
app/pages/budget/approval.vue
app/pages/budget/list.vue
app/pages/budget/status.vue
app/pages/budget/work.vue
app/pages/guide/index.vue
app/pages/info/cost/form.vue
app/pages/info/cost/index.vue
app/pages/info/council-request/[id].vue
app/pages/info/council-request/index.vue
app/pages/info/council-request/result/[id].vue
app/pages/info/documents/[id]/index.vue
app/pages/info/plan/[id].vue
app/pages/info/plan/form.vue
app/pages/info/projects/[id].vue
app/pages/info/projects/form.vue
app/pages/info/projects/index.vue
app/pages/project/bizplan/[abusMngNo].vue
app/pages/project/estimate/[docNo].vue
```

---

## C-4 Trigger Playbook

### 적용 대상

- ratchet에 남은 page 20개
- `app/components/common/EmployeeSearchDialog.vue`
- `app/components/cost/TerminalTableSection.vue`

### 발동 조건

대상 파일의 production 코드가 기능·오류 처리·UI 계약 변경으로 수정되는 모든 PR에서 발동한다. 오탈자, import 정렬, 자동 포맷만 수행하는 PR은 발동하지 않는다.

### 필수 분해량

- 같은 PR에서 최소 하나의 독립 관심사를 component, composable 또는 pure utility로 추출한다.
- 원본 파일의 물리 줄 수는 PR 시작 기준보다 감소해야 한다.
- 추출 파일은 800줄 이하이고 단독 단위 테스트 또는 기존 사용자 흐름 테스트로 검증돼야 한다.
- 기준 파일이 여전히 800줄 초과면 기준값을 새 실제 줄 수로 낮춘다. 800줄 이하가 되면 기준 항목을 삭제한다.

### 고정 분해 방향

| 대상 유형 | 첫 추출 우선순위 |
| --- | --- |
| 조회·필터 중심 page | API/필터/정렬/페이지 상태를 `use<Domain>Page` composable로 추출 |
| 대형 form page | form section component와 validation/DTO mapping composable 분리 |
| 상세 page | header/action, summary, tab/section component 분리 |
| `EmployeeSearchDialog` | 검색 요청·debounce·선택 상태를 `useEmployeeSearchDialog`로 추출 |
| `TerminalTableSection` | row 편집·금액 계산을 composable, dialog/template block을 child component로 추출 |

### PR 검증 템플릿

```powershell
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts <변경 도메인 테스트>
npm run format:check
npm run check
npm test
```

사용자 흐름이 바뀌면 관련 Playwright spec을 추가해 `npm run test:e2e -- <spec>`을 실행한다.

## Completion Criteria

- C-1·C-2·C-3 child plan 완료
- 즉시 제거 대상 8개가 모두 800줄 이하
- ratchet 기준 30개 → 22개
- 기존 public facade와 component 계약 유지
- 전체 프론트 품질 게이트 통과
- `TASK.md` CQ-15에 “즉시 분해 8개 완료, C-4 22개 trigger 상환 중” 상태 기록

## Baseline Evidence

- Frontend branch: `main`
- Cross-check commit: `937f5f9`
- Wave B 전 baseline: 30개
- C-1~3 관련 baseline tests: 10 files, 128 tests passed
- Baseline `npm run check`: 성공
