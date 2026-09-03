# Frontend Health Stack Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CQ-42~CQ-44를 해결해 프론트 정적 검사, 타입 검사, max-lines ratchet을 모두 통과시킨다.

**Architecture:** 먼저 동작 변경 없는 정규식·pdfmake 타입 오류를 고쳐 검사 신호를 복구한다. 이후 7개 초과 파일의 상태 로직은 composable로, 반복되는 표시 영역은 작은 컴포넌트로 옮기며 원래 페이지와 에디터는 조합 책임만 남긴다.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, pdfmake, ESLint, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-03-task-backlog-remediation-design.md`

## Global Constraints

- `scripts/max-lines-baselines.mjs`의 예외 맵은 늘리지 않는다.
- 추출 전후 props, emits, 접근성 이름, Tiptap command 호출 순서와 PDF 출력 구조를 보존한다.
- 신규 `.ts`·`.vue` 파일은 800줄 이하여야 한다.
- 신규 주석은 한글로 작성한다.

---

### Task 1: CQ-43 멘션 정규식 lint 복구

**Files:**
- Modify: `it_frontend/app/utils/boardContent.ts:26`
- Test: `it_frontend/tests/unit/utils/boardContent.test.ts`

**Interfaces:** `renderTiptapMentions(html: string): string`의 공개 시그니처와 변환 결과를 유지한다.

- [ ] **Step 1: 속성 없는 span과 정상 멘션 회귀 테스트를 추가한다**

```ts
expect(renderTiptapMentions('<span>plain</span>')).toBe('<span>plain</span>');
expect(
    renderTiptapMentions(
        '<span class="mention" data-type="tiptap-mention" data-mention-eno="123">@홍길동</span>',
    ),
).toContain('data-mention-eno="123"');
```

- [ ] **Step 2: focused test와 lint가 현재 상태를 재현하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils/boardContent.test.ts; npm run lint`

Expected: 단위 테스트는 기존 동작을 고정하고 lint는 `regexp/no-contradiction-with-assertion`으로 실패한다.

- [ ] **Step 3: 정규식의 속성 구간을 한 글자 이상으로 좁힌다**

```ts
/<span([^>]+\bdata-type=["']tiptap-mention["'][^>]*)>([\s\S]*?)<\/span>/gi
```

- [ ] **Step 4: 단위 테스트와 lint를 다시 실행한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils/boardContent.test.ts; npm run lint`

Expected: 두 명령 모두 PASS.

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/utils/boardContent.ts tests/unit/utils/boardContent.test.ts
git -C C:\it\it_frontend commit -m "fix: 게시판 멘션 정규식 lint 복구"
```

### Task 2: CQ-44 pdfmake Content 타입 복구

**Files:**
- Modify: `it_frontend/app/features/approval/forms/itBudget/pdf/projectSection.ts`
- Create: `it_frontend/tests/unit/features/approval/forms/itBudget/projectSection.test.ts`

**Interfaces:** `appendProjectDetailSections(content, projects, approvalLine, hideHeader, tableLayout, document?)`와 생성되는 pdfmake 노드 순서를 유지한다.

- [ ] **Step 1: 정보화사업과 경상사업이 custom layout을 가진 표 노드를 만드는 테스트를 작성한다**

```ts
const content: Content[] = [];
appendProjectDetailSections(content, [projectFixture], approvalLineFixture, true, tableLayout);
expect(content.some(node => typeof node === 'object' && 'table' in node)).toBe(true);
```

- [ ] **Step 2: typecheck 실패를 재현한다**

Run: `cd C:\it\it_frontend; npm run typecheck`

Expected: `projectSection.ts`의 `{ table, layout }` 두 지점에서 `Content` 배정 오류가 발생한다.

- [ ] **Step 3: 표 노드 타입을 pdfmake가 허용하는 조합으로 명시한다**

```ts
const withLayout = (
    node: Omit<ContentTable, 'layout'>,
    layout: CustomTableLayout,
): ContentTable => ({
    ...node,
    layout,
});
```

`projectSection.ts`의 type import에 `ContentTable`을 추가한다.

`content.push({ table: ..., layout: tableLayout })` 네 곳은 `content.push(withLayout({ table: ... }, tableLayout))`으로 조립한다. 문자열 레이아웃인 `noBorders`는 기존 `Content` 리터럴을 유지한다.

- [ ] **Step 4: focused test와 typecheck를 실행한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/features/approval/forms/itBudget/projectSection.test.ts; npm run typecheck`

Expected: PASS이며 생성된 표 개수와 순서가 유지된다.

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/features/approval/forms/itBudget/pdf/projectSection.ts tests/unit/features/approval/forms/itBudget/projectSection.test.ts
git -C C:\it\it_frontend commit -m "fix: 전산예산 PDF 표 레이아웃 타입 정합화"
```

### Task 3: TiptapToolbar 책임 분리

**Files:**
- Modify: `it_frontend/app/components/editor/TiptapToolbar.vue`
- Create: `it_frontend/app/components/editor/toolbar/TiptapTextStyleControls.vue`
- Create: `it_frontend/app/components/editor/toolbar/TiptapInsertControls.vue`
- Create: `it_frontend/app/components/editor/toolbar/TiptapMathEmojiControls.vue`
- Test: `it_frontend/tests/unit/components/TiptapToolbar.test.ts`

**Interfaces:** 하위 컴포넌트는 `editor: Editor`를 받고, 스크린샷만 `screenshot-capture` 이벤트로 상위에 전달한다.

- [ ] **Step 1: 기존 toolbar 버튼, disabled 상태, command 호출 테스트를 보강한다**

테스트는 글꼴·크기·색상, 표 삽입, 수식·이모지, 스크린샷 이벤트를 각각 한 번씩 고정한다.

- [ ] **Step 2: 기존 테스트를 실행해 기준 동작을 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/TiptapToolbar.test.ts`

Expected: PASS.

- [ ] **Step 3: 텍스트 스타일 제어를 추출한다**

```ts
defineProps<{ editor: Editor }>();
```

글꼴, 크기, 글자색, 강조색, 목록 스타일과 관련 메뉴 상태만 `TiptapTextStyleControls.vue`로 이동한다.

- [ ] **Step 4: 삽입과 수식·이모지 제어를 추출한다**

표·링크·첨부 삽입은 `TiptapInsertControls.vue`, 수식·이모지 메뉴는 `TiptapMathEmojiControls.vue`로 이동한다. 상위는 세 컴포넌트와 기존 `TiptapInsertDialogs`를 조합한다.

- [ ] **Step 5: 테스트와 줄 수 게이트를 실행한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/TiptapToolbar.test.ts tests/unit/architecture/max-lines-ratchet.test.ts`

Expected: PASS, 네 파일 모두 800줄 이하.

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/components/editor/TiptapToolbar.vue app/components/editor/toolbar tests/unit/components/TiptapToolbar.test.ts
git -C C:\it\it_frontend commit -m "refactor: Tiptap 도구막대 책임 분리"
```

### Task 4: TiptapEditor 변수 해석 책임 분리

**Files:**
- Modify: `it_frontend/app/components/editor/TiptapEditor.vue`
- Create: `it_frontend/app/composables/editor/useTiptapVariableResolution.ts`
- Create: `it_frontend/tests/unit/composables/editor/useTiptapVariableResolution.test.ts`
- Test: `it_frontend/tests/unit/components/TiptapEditor.test.ts`

**Interfaces:** composable은 `resolveMissingVariables`, `retryErrorVariables`, `hasErrorVariables`, `metadataLoading`, `metadataError`를 반환한다.

- [ ] **Step 1: stale 응답 무시와 실패 토큰 재시도 테스트를 새 composable 계약으로 작성한다**

```ts
expect(result.hasErrorVariables.value).toBe(true);
await result.retryErrorVariables();
expect(result.hasErrorVariables.value).toBe(false);
```

- [ ] **Step 2: 테스트가 composable 부재로 실패하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/composables/editor/useTiptapVariableResolution.test.ts`

Expected: import 실패.

- [ ] **Step 3: lines 218~398의 메타데이터·토큰 해석 상태를 composable로 옮긴다**

에디터 인스턴스와 `emit('update:modelValue')` 콜백을 인자로 받고, DOM 이벤트·extension 구성은 `TiptapEditor.vue`에 남긴다.

- [ ] **Step 4: 에디터 회귀 테스트와 줄 수 게이트를 실행한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/TiptapEditor.test.ts tests/unit/composables/editor/useTiptapVariableResolution.test.ts tests/unit/architecture/max-lines-ratchet.test.ts`

Expected: PASS, `TiptapEditor.vue`가 800줄 이하.

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/components/editor/TiptapEditor.vue app/composables/editor/useTiptapVariableResolution.ts tests/unit/components/TiptapEditor.test.ts tests/unit/composables/editor/useTiptapVariableResolution.test.ts
git -C C:\it\it_frontend commit -m "refactor: Tiptap 변수 해석 로직 분리"
```

### Task 5: 정보화사업·전산업무비 상세 화면 분리

**Files:**
- Modify: `it_frontend/app/pages/info/projects/[id].vue`
- Modify: `it_frontend/app/pages/info/cost/[id].vue`
- Create: `it_frontend/app/components/projects/ProjectDetailSections.vue`
- Create: `it_frontend/app/components/cost/CostDetailSections.vue`
- Create: `it_frontend/tests/unit/components/projects/ProjectDetailSections.test.ts`
- Create: `it_frontend/tests/unit/components/cost/CostDetailSections.test.ts`

**Interfaces:** 페이지는 라우트, history/reapplication 명령, fetch 오류만 담당한다. 섹션 컴포넌트는 이미 계산된 표시 모델과 `scrollTo(sectionId)`를 props/callback으로 받는다.

- [ ] **Step 1: 주요 섹션과 terminal/ordinary 분기 렌더 테스트를 작성한다**

- [ ] **Step 2: 테스트가 새 컴포넌트 부재로 실패하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/projects/ProjectDetailSections.test.ts tests/unit/components/cost/CostDetailSections.test.ts`

Expected: import 실패.

- [ ] **Step 3: 상세 표시 template과 지역 CSS를 새 컴포넌트로 이동한다**

페이지의 `openHistory`, `createReapplication/reapply`, `deleteDraft`와 route query `sno` 처리는 이동하지 않는다.

- [ ] **Step 4: 컴포넌트 테스트와 max-lines 테스트를 실행한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/projects/ProjectDetailSections.test.ts tests/unit/components/cost/CostDetailSections.test.ts tests/unit/architecture/max-lines-ratchet.test.ts`

Expected: PASS, 두 페이지와 두 컴포넌트 모두 800줄 이하.

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/pages/info/projects/[id].vue app/pages/info/cost/[id].vue app/components/projects/ProjectDetailSections.vue app/components/cost/CostDetailSections.vue tests/unit/components/projects/ProjectDetailSections.test.ts tests/unit/components/cost/CostDetailSections.test.ts
git -C C:\it\it_frontend commit -m "refactor: 예산 상세 화면 섹션 분리"
```

### Task 6: 정보화 대시보드와 폼 화면 분리

**Files:**
- Modify: `it_frontend/app/pages/info/index.vue`
- Modify: `it_frontend/app/pages/info/projects/form.vue`
- Modify: `it_frontend/app/pages/info/cost/form.vue`
- Create: `it_frontend/app/components/info/InfoBudgetTimingSection.vue`
- Create: `it_frontend/app/components/projects/ProjectFormSections.vue`
- Create: `it_frontend/app/components/cost/CostFormSections.vue`
- Create: `it_frontend/tests/unit/components/info/InfoBudgetTimingSection.test.ts`
- Create: `it_frontend/tests/unit/components/projects/ProjectFormSections.test.ts`
- Create: `it_frontend/tests/unit/components/cost/CostFormSections.test.ts`

**Interfaces:** 대시보드 섹션은 `projectRows`, `costRows`, `loading`, `error`, `retry`를 받는다. 폼 섹션은 model과 validation error를 받고 save/cancel 명령은 페이지에 남긴다.

- [ ] **Step 1: 대시보드 실패·재시도와 폼 입력 이벤트 특성 테스트를 작성한다**

- [ ] **Step 2: 새 컴포넌트 부재로 테스트가 실패하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/info/InfoBudgetTimingSection.test.ts tests/unit/components/projects/ProjectFormSections.test.ts tests/unit/components/cost/CostFormSections.test.ts`

Expected: import 실패.

- [ ] **Step 3: template 섹션을 추출하고 명령 흐름은 원래 페이지에 유지한다**

`saveCosts`, `cancel`, 직원 선택 dialog, 환율 변경처럼 상태를 바꾸는 명령은 props 이벤트로 연결하되 소유권은 페이지/composable에 둔다.

- [ ] **Step 4: 전체 줄 수 ratchet을 통과시킨다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/architecture/max-lines-ratchet.test.ts`

Expected: 초과 파일 목록이 비어 PASS.

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/pages/info/index.vue app/pages/info/projects/form.vue app/pages/info/cost/form.vue app/components/info/InfoBudgetTimingSection.vue app/components/projects/ProjectFormSections.vue app/components/cost/CostFormSections.vue tests/unit/components/info/InfoBudgetTimingSection.test.ts tests/unit/components/projects/ProjectFormSections.test.ts tests/unit/components/cost/CostFormSections.test.ts
git -C C:\it\it_frontend commit -m "refactor: 정보화 대시보드와 예산 폼 섹션 분리"
```

### Task 7: 프론트 전체 검증

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:** CQ-42~CQ-44 완료 근거를 실행 결과와 커밋으로 기록한다.

- [ ] **Step 1: 전체 Health Stack을 실행한다**

Run: `cd C:\it\it_frontend; npm run format:check; npm run check; npm test`

Expected: 모두 exit code 0.

- [ ] **Step 2: 완료 기록을 갱신한다**

`TASK_DONE.md`에 CQ-42~CQ-44의 변경 파일, 검증 명령과 결과를 기록하고 `TASK.md`에서 세 행만 제거한다.

- [ ] **Step 3: 루트 문서 변경을 커밋한다**

```powershell
git -C C:\it add TASK.md TASK_DONE.md
git -C C:\it commit -m "docs: 프론트 Health Stack 과제 완료 기록"
```
