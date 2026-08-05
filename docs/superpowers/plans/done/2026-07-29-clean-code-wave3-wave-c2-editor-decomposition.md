# Clean Code Wave 3 Wave C2 Editor Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wave B 이후 editor 경계의 5개 800줄 초과 파일을 extension 책임, dialog, table control, CSS로 분리해 모두 800줄 이하로 만든다.

**Architecture:** 기존 `tiptap-extensions.ts`와 `tiptap-content-extensions.ts`는 compatibility barrel로 유지하고 실제 구현을 `extensions/media`, `extensions/table`, `extensions/content`로 이동한다. `TiptapEditor`는 TOC와 scoped CSS를 추출하고, `TiptapToolbar`는 insert dialog 상태·template을 한 child component로, table floating toolbar는 구조·표현·border drawer child component로 분리한다.

**Tech Stack:** Vue 3 SFC, Tiptap, ProseMirror, TypeScript, PostCSS, Vitest, Vue Test Utils, Playwright

## Global Constraints

- 선행: Wave B 완료 후 모든 경로는 `app/components/editor/**`다.
- component 이름, props, emits, exposed refs와 template 접근성 label을 유지한다.
- Tiptap node/mark name, schema attribute, PluginKey 문자열, command, parseHTML/renderHTML 결과를 유지한다.
- compatibility barrel의 runtime/type export 집합을 변경하지 않는다.
- CSS selector와 declaration을 변경하지 않는다. external stylesheet 추출 시 적용 범위만 child component까지 유지한다.
- 이번 작업에서 editor 기능 추가, 경고 정리, 디자인 변경을 하지 않는다.
- 각 task 완료 파일은 800줄 이하이고 신규 파일도 800줄 이하이어야 한다.

## File Map

| 영역 | 신규 파일 | 책임 |
| --- | --- | --- |
| extension media | `extensions/media/image.ts`, `extensions/media/excalidraw.ts` | image/excalidraw node |
| extension table | `extensions/table/widths.ts`, `row-resizing.ts`, `nodes.ts` | colwidth, row resize, table schema |
| extension content | `extensions/content/heading.ts`, `font-size.ts`, `attachment.ts`, `math.ts`, `variable.ts` | 문서 content extension |
| editor core | `tiptap-toc.ts`, `styles/tiptap-editor.css` | TOC 생성, editor scoped CSS |
| main toolbar | `TiptapInsertDialogs.vue` | link/image/file/excalidraw dialog 상태와 UI |
| table toolbar | `TiptapTableStructureControls.vue`, `TiptapTableAppearanceControls.vue`, `TiptapTableBorderDrawer.vue` | table 조작 UI 분리 |
| shared style | `styles/tiptap-table-toolbar.css` | table toolbar 전체 class style |

---

### Task 1: extension public contract 고정

**Files:**

- Create: `it_frontend/tests/unit/components/extensions/tiptap-barrel-contract.test.ts`

- [ ] **Step 1: 두 barrel의 runtime export characterization 작성**

```ts
import { describe, expect, it } from 'vitest';

describe('Tiptap extension barrel contract', () => {
    it('tiptap-extensions runtime export를 유지한다', async () => {
        const module = await import(
            '~/components/editor/extensions/tiptap-extensions'
        );
        expect(Object.keys(module).sort()).toEqual(
            [
                'AttachmentExtension',
                'BlockMathExtension',
                'CustomHeading',
                'CustomTable',
                'CustomTableCell',
                'CustomTableHeader',
                'ExcalidrawExtension',
                'FontSize',
                'InlineMathExtension',
                'ResizableImage',
                'RowResizingPlugin',
                'VariableExtension',
                'createAttachmentSuggestion',
                'createVariableSuggestion',
                'extractExcalidrawAttrs',
                'injectColwidthsFromColgroup',
                'normalizeColwidths',
            ].sort(),
        );
    });

    it('content barrel runtime export를 유지한다', async () => {
        const module = await import(
            '~/components/editor/extensions/tiptap-content-extensions'
        );
        expect(Object.keys(module).sort()).toEqual(
            [
                'AttachmentExtension',
                'BlockMathExtension',
                'CustomHeading',
                'FontSize',
                'InlineMathExtension',
                'VariableExtension',
                'createAttachmentSuggestion',
                'createVariableSuggestion',
                'injectColwidthsFromColgroup',
                'installReactiveVariableStorage',
                'normalizeColwidths',
            ].sort(),
        );
    });
});
```

- [ ] **Step 2: baseline test 통과**

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/components/extensions/tiptap-barrel-contract.test.ts
```

- [ ] **Step 3: contract test 커밋**

```powershell
git add -- tests/unit/components/extensions/tiptap-barrel-contract.test.ts
git commit -m "test: Tiptap extension barrel 계약 고정"
```

---

### Task 2: extension 구현을 책임별 모듈로 분리

**Files:**

- Create: `app/components/editor/extensions/media/image.ts`
- Create: `app/components/editor/extensions/media/excalidraw.ts`
- Create: `app/components/editor/extensions/table/widths.ts`
- Create: `app/components/editor/extensions/table/row-resizing.ts`
- Create: `app/components/editor/extensions/table/nodes.ts`
- Create: `app/components/editor/extensions/content/heading.ts`
- Create: `app/components/editor/extensions/content/font-size.ts`
- Create: `app/components/editor/extensions/content/attachment.ts`
- Create: `app/components/editor/extensions/content/math.ts`
- Create: `app/components/editor/extensions/content/variable.ts`
- Modify: two compatibility barrel files

**Interfaces:**

- Preserves: Task 1 runtime export 집합과 `AttachmentItem`, `VariableSuggestItem`, `VariableSuggestState` type exports

- [ ] **Step 1: table width helper 추출**

`tiptap-content-extensions.ts`의 `normalizeColwidths`, `injectColwidthsFromColgroup`와 전용 `warnTableNormalization`을 `table/widths.ts`로 이동한다.

```ts
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { createRateLimitedWarn } from '~/utils/diagnostics';

export function normalizeColwidths(editor: Editor): void;
export function injectColwidthsFromColgroup(html: string): string;
```

함수 본문과 경고 메시지는 원본 그대로 유지한다.

- [ ] **Step 2: media extension 추출**

```text
media/image.ts
  ResizableImage
  ../ResizableImageNodeView.vue import

media/excalidraw.ts
  extractExcalidrawAttrs
  ExcalidrawExtension
  warnExcalidrawParse
  ../ExcalidrawNodeView.vue import
```

각 NodeView 경로는 새 파일 기준으로 `../../ResizableImageNodeView.vue`, `../../ExcalidrawNodeView.vue`를 사용한다.

- [ ] **Step 3: table extension 추출**

```text
table/row-resizing.ts
  RowResizingPluginKey
  RowResizingPlugin

table/nodes.ts
  CustomTable
  CustomTableCell
  CustomTableHeader
```

`nodes.ts`가 width 정규화가 필요하면 `./widths`만 import한다. `row-resizing.ts`와 `nodes.ts` 사이의 순환 import를 만들지 않는다.

- [ ] **Step 4: content extension 추출**

```text
content/heading.ts
  CustomHeading

content/font-size.ts
  FontSize

content/attachment.ts
  AttachmentItem
  createAttachmentSuggestion
  AttachmentExtension
  attachmentSuggestionPluginKey

content/math.ts
  InlineMathExtension
  BlockMathExtension

content/variable.ts
  VariableSuggestItem
  VariableSuggestState
  VariableExtension
  installReactiveVariableStorage
  createVariableSuggestion
  variableSuggestionPluginKey
  categoryLiteral
```

NodeView import는 각 content 파일에서 `../../<NodeView>.vue`를 사용한다.

- [ ] **Step 5: compatibility barrel을 명시적 re-export만 남기도록 축소**

```ts
// tiptap-content-extensions.ts
export { CustomHeading } from './content/heading';
export { FontSize } from './content/font-size';
export {
    AttachmentExtension,
    createAttachmentSuggestion,
} from './content/attachment';
export type { AttachmentItem } from './content/attachment';
export { BlockMathExtension, InlineMathExtension } from './content/math';
export {
    VariableExtension,
    createVariableSuggestion,
    installReactiveVariableStorage,
} from './content/variable';
export type {
    VariableSuggestItem,
    VariableSuggestState,
} from './content/variable';
export {
    injectColwidthsFromColgroup,
    normalizeColwidths,
} from './table/widths';
```

```ts
// tiptap-extensions.ts
export { ResizableImage } from './media/image';
export {
    ExcalidrawExtension,
    extractExcalidrawAttrs,
} from './media/excalidraw';
export { RowResizingPlugin } from './table/row-resizing';
export {
    CustomTable,
    CustomTableCell,
    CustomTableHeader,
} from './table/nodes';
export {
    AttachmentExtension,
    BlockMathExtension,
    CustomHeading,
    FontSize,
    InlineMathExtension,
    VariableExtension,
    createAttachmentSuggestion,
    createVariableSuggestion,
    injectColwidthsFromColgroup,
    normalizeColwidths,
} from './tiptap-content-extensions';
export type { AttachmentItem } from './tiptap-content-extensions';
```

`installReactiveVariableStorage`와 variable suggestion type은 기존 상위 barrel export가 아니므로 추가 노출하지 않는다. Task 1 contract test로 runtime export가 정확히 같은지 검증한다.

- [ ] **Step 6: extension 테스트와 정적 검사**

```powershell
npm test -- `
  tests/unit/components/extensions/tiptap-barrel-contract.test.ts `
  tests/unit/components/extensions/tiptap-error-diagnostics.test.ts `
  tests/unit/components/extensions/variableExtension.test.ts `
  tests/unit/components/extensions/variableStorageReactivity.test.ts `
  tests/unit/components/TiptapEditor.test.ts
npm run check
```

- [ ] **Step 7: extension 분해 커밋**

```powershell
git add -- app/components/editor/extensions
git add -- tests/unit/components/extensions/tiptap-barrel-contract.test.ts
git commit -m "refactor: Tiptap extension 책임별 분리"
```

---

### Task 3: `TiptapEditor`의 TOC와 scoped CSS 추출

**Files:**

- Create: `app/components/editor/tiptap-toc.ts`
- Create: `app/components/editor/styles/tiptap-editor.css`
- Modify: `app/components/editor/TiptapEditor.vue`
- Create: `tests/unit/components/tiptap-toc.test.ts`

**Interfaces:**

- Produces: `extractToc(editor: Editor): TiptapTocItem[]`
- Preserves: `update:toc` emit payload

- [ ] **Step 1: TOC pure helper 실패 테스트 작성**

```ts
import { describe, expect, it, vi } from 'vitest';
import { extractToc } from '~/components/editor/tiptap-toc';

describe('extractToc', () => {
    it('heading 순서와 level을 반환하고 id가 없는 heading에 id를 주입한다', () => {
        const steps: unknown[] = [];
        const setNodeMarkup = vi.fn(() => {
            steps.push({});
        });
        const dispatch = vi.fn();
        const editor = {
            state: {
                tr: { steps, setNodeMarkup },
                doc: {
                    descendants(callback: (node: any, pos: number) => void) {
                        callback(
                            {
                                type: { name: 'heading' },
                                attrs: { id: 'fixed', level: 2 },
                                textContent: '고정 제목',
                            },
                            1,
                        );
                        callback(
                            {
                                type: { name: 'heading' },
                                attrs: { id: null, level: 3 },
                                textContent: '신규 제목',
                            },
                            2,
                        );
                    },
                },
            },
            view: { dispatch },
        };

        const result = extractToc(editor as any);

        expect(result[0]).toEqual({ id: 'fixed', level: 2, text: '고정 제목' });
        expect(result[1]).toEqual({
            id: expect.stringMatching(/^heading-/),
            level: 3,
            text: '신규 제목',
        });
        expect(setNodeMarkup).toHaveBeenCalledWith(
            2,
            undefined,
            expect.objectContaining({ id: expect.stringMatching(/^heading-/) }),
        );
        expect(dispatch).toHaveBeenCalledOnce();
    });
});
```

테스트의 editor mock은 프로젝트 테스트 규약에 따라 필요한 Tiptap 경계에서만 `any`를 사용한다.

- [ ] **Step 2: helper 부재 실패 확인**

```powershell
npm test -- tests/unit/components/tiptap-toc.test.ts
```

- [ ] **Step 3: TOC helper 구현·호출 변경**

`TiptapEditor.vue:140-171` 로직을 다음 함수로 이동한다.

```ts
import type { Editor } from '@tiptap/core';

export interface TiptapTocItem {
    id: string;
    level: number;
    text: string;
}

export const extractToc = (editor: Editor): TiptapTocItem[] => {
    const toc: TiptapTocItem[] = [];
    const transaction = editor.state.tr;
    editor.state.doc.descendants((node, pos) => {
        if (node.type.name !== 'heading') return;
        let id = node.attrs.id as string | null;
        if (!id) {
            id = `heading-${Math.random().toString(36).slice(2, 11)}`;
            transaction.setNodeMarkup(pos, undefined, { ...node.attrs, id });
        }
        toc.push({ id, level: node.attrs.level, text: node.textContent });
    });
    if (transaction.steps.length > 0) editor.view.dispatch(transaction);
    return toc;
};
```

`TiptapEditor`는 기존 호출 지점에서 `emit('update:toc', extractToc(editorInstance))`를 사용한다.

- [ ] **Step 4: scoped style을 external file로 이동**

기존 `<style lang="postcss" scoped>` 내부 526줄을 내용 변경 없이 `styles/tiptap-editor.css`로 이동하고 SFC에는 다음만 남긴다.

```vue
<style lang="postcss" scoped src="./styles/tiptap-editor.css"></style>
```

- [ ] **Step 5: editor 테스트·시각 흐름 검증**

```powershell
npm test -- `
  tests/unit/components/tiptap-toc.test.ts `
  tests/unit/components/TiptapEditor.test.ts `
  tests/unit/components/editor-error-state.test.ts
npm run check
npm run test:e2e -- tests/e2e/tiptap-variable.spec.ts tests/e2e/error-recovery-tiptap.spec.ts
```

Expected: `TiptapEditor.vue` 800줄 이하.

- [ ] **Step 6: editor core 커밋**

```powershell
git add -- app/components/editor/TiptapEditor.vue
git add -- app/components/editor/tiptap-toc.ts app/components/editor/styles/tiptap-editor.css
git add -- tests/unit/components/tiptap-toc.test.ts
git commit -m "refactor: Tiptap editor TOC와 스타일 분리"
```

---

### Task 4: main toolbar insert dialog 추출

**Files:**

- Create: `app/components/editor/TiptapInsertDialogs.vue`
- Modify: `app/components/editor/TiptapToolbar.vue`
- Create: `tests/unit/components/TiptapInsertDialogs.test.ts`

**Interfaces:**

```ts
export interface TiptapInsertDialogsExpose {
    openLink: () => void;
    openImage: () => void;
    openAttachment: () => void;
    openExcalidraw: () => void;
}
```

- [ ] **Step 1: dialog expose와 취소 경로 테스트 작성**

`TiptapInsertDialogs.test.ts`는 shallow mount 후 exposed 네 메서드가 존재하고, `openLink()`가 현재 editor link attr을 form state에 반영하며 취소가 editor command를 실행하지 않는지 검증한다.

```ts
expect(Object.keys(wrapper.vm.$.exposed ?? {}).sort()).toEqual(
    ['openAttachment', 'openExcalidraw', 'openImage', 'openLink'].sort(),
);
```

- [ ] **Step 2: `TiptapInsertDialogs.vue`로 상태와 template을 함께 이동**

Props:

```ts
const props = defineProps<{
    editor: Editor | null;
    imageUploadFn?: (file: File) => Promise<string>;
    fileUploadFn?: (file: File) => Promise<{ flMngNo: string; flNm: string; flSz: number }>;
    attachmentList?: AttachmentItem[];
    fileDeleteFn?: (fileId: string) => Promise<void>;
}>();
```

이동 책임:

```text
link state + open/apply
image URL/file state + upload
attachment upload/list/delete confirmation
Excalidraw wrapper ref + save/initial data
기존 Dialog template 4개
```

`formatFileSize`, `useConfirm`, `useToast`, `ExcalidrawWrapper` import도 child로 이동한다. 기존 toast 문구와 error propagation을 변경하지 않는다.

- [ ] **Step 3: toolbar는 버튼과 child ref만 유지**

```ts
const insertDialogs = ref<TiptapInsertDialogsExpose | null>(null);
```

기존 버튼 handler를 다음 호출로 교체한다.

```text
openLinkDialog       → insertDialogs.value?.openLink()
openImageDialog      → insertDialogs.value?.openImage()
openFileAttach       → insertDialogs.value?.openAttachment()
insertExcalidraw     → insertDialogs.value?.openExcalidraw()
```

template 끝에 child를 명시적으로 배치한다.

```vue
<TiptapInsertDialogs
    ref="insertDialogs"
    :editor="editor"
    :image-upload-fn="imageUploadFn"
    :file-upload-fn="fileUploadFn"
    :attachment-list="attachmentList"
    :file-delete-fn="fileDeleteFn"
/>
```

- [ ] **Step 4: toolbar 테스트·정적 검사**

```powershell
npm test -- `
  tests/unit/components/TiptapInsertDialogs.test.ts `
  tests/unit/components/TiptapEditor.test.ts `
  tests/unit/components/editor-error-state.test.ts
npm run check
```

Expected: `TiptapToolbar.vue` 800줄 이하.

- [ ] **Step 5: toolbar dialog 커밋**

```powershell
git add -- app/components/editor/TiptapToolbar.vue
git add -- app/components/editor/TiptapInsertDialogs.vue
git add -- tests/unit/components/TiptapInsertDialogs.test.ts
git commit -m "refactor: Tiptap insert dialog 분리"
```

---

### Task 5: table floating toolbar presentation 분리

**Files:**

- Create: `TiptapTableStructureControls.vue`
- Create: `TiptapTableAppearanceControls.vue`
- Create: `TiptapTableBorderDrawer.vue`
- Create: `styles/tiptap-table-toolbar.css`
- Modify: `TiptapTableFloatingToolbar.vue`
- Create: `tests/unit/components/TiptapTableFloatingToolbar.test.ts`

- [ ] **Step 1: main orchestration contract 테스트 작성**

shallow mount에서 세 child가 렌더되고 다음 callback identity를 그대로 전달하는지 검증한다.

```text
structure: editor, tableOp
appearance: cell palette, align callbacks, setTableFullWidth
border drawer: style/width/color models, applySideBorder
```

- [ ] **Step 2: structure control 추출**

기존 template의 행·열 추가/삭제, 셀 병합/분리, header row/column 구간을 `TiptapTableStructureControls.vue`로 이동한다.

```ts
const props = defineProps<{
    editor: Editor;
    tableOp: (operation: () => void) => void;
}>();
```

editor command chain과 tooltip·aria-label을 그대로 유지한다.

- [ ] **Step 3: appearance control 추출**

셀 배경, table 정렬, cell 수평·수직 정렬, full width, table 삭제 구간을 `TiptapTableAppearanceControls.vue`로 이동한다. 모든 callback은 props로 받고 child에서 editor transaction을 새로 구현하지 않는다.

- [ ] **Step 4: border drawer 추출**

border style·width·color·direction drawer를 `TiptapTableBorderDrawer.vue`로 이동한다. `visible`, pending style/width/color는 `defineModel`로 양방향 연결한다.

```ts
const visible = defineModel<boolean>('visible', { required: true });
const pendingStyle = defineModel<string | null>('pendingStyle', { required: true });
const pendingWidth = defineModel<string | null>('pendingWidth', { required: true });
const pendingColor = defineModel<string | null>('pendingColor', { required: true });
```

- [ ] **Step 5: shared CSS 추출**

현재 `TiptapTableFloatingToolbar.vue`의 style block 전체를 `styles/tiptap-table-toolbar.css`로 이동한다. child에도 적용되도록 main에서 unscoped external style로 로드한다.

```vue
<style lang="postcss" src="./styles/tiptap-table-toolbar.css"></style>
```

class 이름이 `tiptap-table-*` namespace를 사용하므로 다른 화면 selector와 충돌하지 않는지 `rg -n "tiptap-table-" app`으로 확인한다.

- [ ] **Step 6: table toolbar 검증**

```powershell
npm test -- `
  tests/unit/components/TiptapTableFloatingToolbar.test.ts `
  tests/unit/composables/useTiptapTableTools.test.ts `
  tests/unit/components/TiptapEditor.test.ts
npm run check
npm run test:e2e -- tests/e2e/tiptap-variable.spec.ts
```

Expected: main과 신규 child 모두 800줄 이하.

- [ ] **Step 7: table toolbar 커밋**

```powershell
git add -- app/components/editor/TiptapTableFloatingToolbar.vue
git add -- app/components/editor/TiptapTableStructureControls.vue
git add -- app/components/editor/TiptapTableAppearanceControls.vue
git add -- app/components/editor/TiptapTableBorderDrawer.vue
git add -- app/components/editor/styles/tiptap-table-toolbar.css
git add -- tests/unit/components/TiptapTableFloatingToolbar.test.ts
git commit -m "refactor: Tiptap table toolbar 표현 분리"
```

---

### Task 6: 다섯 ratchet 기준 제거와 전체 editor gate

**Files:**

- Modify: `scripts/max-lines-baselines.mjs`
- Modify: `tests/unit/architecture/max-lines-ratchet.test.ts`

- [ ] **Step 1: 모든 editor source 줄 수 확인**

```powershell
Get-ChildItem -Path app/components/editor -Recurse -File |
  Where-Object { $_.Extension -in '.ts', '.vue', '.css' } |
  ForEach-Object {
    [pscustomobject]@{ Path = $_.FullName; Lines = (Get-Content -LiteralPath $_.FullName).Count }
  } |
  Sort-Object Lines -Descending
```

Expected: 모든 파일 800줄 이하.

- [ ] **Step 2: 다섯 기준 항목 삭제**

```text
app/components/editor/TiptapEditor.vue
app/components/editor/TiptapToolbar.vue
app/components/editor/TiptapTableFloatingToolbar.vue
app/components/editor/extensions/tiptap-extensions.ts
app/components/editor/extensions/tiptap-content-extensions.ts
```

architecture test 기준 수를 C-1 이후 29에서 24로 낮춘다.

- [ ] **Step 3: 전체 editor 품질 게이트**

```powershell
npm test -- tests/unit/components tests/unit/composables/useTiptapTableTools.test.ts
npm run format:check
npm run check
npm test
npm run test:e2e -- tests/e2e/tiptap-variable.spec.ts tests/e2e/error-recovery-tiptap.spec.ts
```

- [ ] **Step 4: C-2 완료 커밋**

```powershell
git add -- scripts/max-lines-baselines.mjs
git add -- tests/unit/architecture/max-lines-ratchet.test.ts
git commit -m "chore: editor 파일 크기 기준 제거 (CQ-15 C-2)"
```

## Test Coverage

```text
EXTENSIONS
  [★★★] runtime barrel export exact
  [★★★] schema/parser/plugin diagnostics
  [★★★] variable storage reactivity

EDITOR
  [★★★] TOC id/level/text
  [★★★] variable error/retry
  [★★★] external scoped CSS + E2E

TOOLBARS
  [★★★] dialog expose/cancel/error
  [★★★] table structure/appearance/border callbacks
  [★★★] tooltip/aria-label preservation

RATCHET
  [★★★] 5 original files <= 800
  [★★★] 5 baseline entries removed
```

## Baseline Evidence

- Cross-check commit: frontend `937f5f9`
- `TiptapEditor.vue`: 1,328
- `TiptapToolbar.vue`: 1,287
- `TiptapTableFloatingToolbar.vue`: 1,104
- `tiptap-content-extensions.ts`: 1,079
- `tiptap-extensions.ts`: 1,007
- Relevant baseline: 8 editor tests plus `useTiptapTableTools`, all passing in the 128-test bundle
