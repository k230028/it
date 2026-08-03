# Clean Code Wave 3 Wave B Frontend Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프론트 운영 소스의 800줄 상한을 증가 불가 ratchet으로 강제하고, editor 관련 파일 14개와 layout 컴포넌트 10개를 기능 경계로 이동하면서 모든 소비자를 명시적 import로 고정한다.

**Architecture:** `scripts/max-lines-baselines.mjs`가 기존 800줄 초과 파일의 현재 물리 줄 수를 단일 기준으로 제공하고 ESLint flat config가 신규 파일 800줄 상한과 기존 파일별 동결선을 함께 적용한다. 컴포넌트 이동은 동작 변경 없이 `app/components/editor`와 `app/components/layout`로 나누며, Nuxt 자동 등록명 변화에 의존하지 않도록 모든 production 소비자에 명시적 import를 추가한다.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, ESLint flat config, Vitest, Vue Test Utils, Playwright, npm

## Global Constraints

- 기준 브랜치는 `it_frontend`의 `main`, cross-check commit은 `937f5f9`다. 실행 시 HEAD가 다르면 Task 1의 30개 기준선과 Task 2·3 소비자 manifest를 다시 측정한 뒤 계획의 숫자를 갱신한다.
- 동작, UI, route, API, component props/emits, CSS와 테스트 시나리오는 변경하지 않는다.
- 신규 운영 `.ts`·`.vue` 파일은 800줄을 넘을 수 없다.
- 기존 기준선은 증가시킬 수 없다. 파일이 줄어들면 같은 커밋에서 기준값도 현재 줄 수로 낮추고, 800줄 이하가 되면 기준 항목을 삭제한다.
- `tests/**`, 생성물, 설정 파일은 `max-lines` 대상에서 제외한다.
- `components/editor`와 `components/layout`의 컴포넌트는 production 소비자가 명시적으로 import한다. Nuxt 자동 등록 접두사에 의존하지 않는다.
- 이동 커밋에는 경로·import·파일 헤더 경로 외의 동작 변경이나 내부 분해를 섞지 않는다.
- 모든 신규 주석과 TSDoc은 한글로 작성한다.
- 각 task는 실패 또는 기준 상태 확인 → 최소 변경 → 대상 테스트 → 독립 커밋 순서로 진행한다.

## Execution Preconditions

- `git -C C:\it\it_frontend status --short`가 깨끗해야 한다. 기존 변경이 있으면 `superpowers:using-git-worktrees`로 별도 worktree를 만든다.
- root 계획 문서는 구현과 다른 저장소다. 구현 중 `C:\it\TASK.md`·`TASK_DONE.md`를 stage하지 않는다.
- Playwright 검증 전 프론트 `http://localhost:3000`과 백엔드 `http://localhost:28080`이 테스트 설정에 맞게 실행 중인지 확인한다.
- 현재 기준 테스트 증거는 2026-07-29의 `npm run check` 성공과 관련 Vitest 10파일·128테스트 통과다. 기존 Vue 경고는 baseline으로 기록하되 새 경고를 추가하지 않는다.

---

## Review Decisions

| 결정 | 확정안 | 이유 |
| --- | --- | --- |
| ratchet SoT | `scripts/max-lines-baselines.mjs` | ESLint config와 검증 테스트가 같은 객체를 사용해 기준 복제를 피한다. |
| 줄 수 정의 | UTF-8 파일의 물리 줄 수, 마지막 개행은 별도 빈 줄로 세지 않음 | ESLint `max-lines`의 `skipBlankLines=false`, `skipComments=false` 결과와 현재 30개 실측이 일치한다. |
| 실행 순서 | ratchet → editor 이동 → layout 이동 | 동결선을 먼저 세우고, Wave C가 다루는 에디터 5개 경로를 먼저 안정화한다. |
| editor extensions 위치 | `app/components/editor/extensions` | NodeView와 editor component가 함께 변경되므로 같은 기능 경계에 둔다. |
| 공통 UI 4개 | 루트 유지 | `PageHeader`, `AppDialogFooter`, `TableCard`, `AppDialogHeader`는 CQ-18 범위다. |
| import 정책 | production 소비자 전부 명시적 import | 이동 후 자동 등록명이 바뀌어도 template 이름과 런타임 계약을 보존한다. |
| 테스트 경로 | 기능 분류와 별개로 기존 테스트 디렉터리 유지 | 이번 Wave는 production 구조만 정리하며 테스트 재배치는 불필요한 churn이다. |

## Data Flow

```text
scripts/max-lines-baselines.mjs
          ├─> eslint.config.mjs
          │      ├─ 신규 app/**/*.ts|vue: max 800
          │      └─ 기존 초과 파일: 파일별 현재 기준선
          └─> max-lines-ratchet.test.ts
                 ├─ 파일 존재
                 ├─ 실제 줄 수 = 기준값
                 └─ ESLint 계산 결과 검증

루트 components
  ├─ editor 14개 ──> 명시적 import 소비자
  ├─ layout 10개 ──> 명시적 import 소비자
  └─ 범용 UI 4개 ──> CQ-18까지 루트 유지
```

## File Map

| 파일 | 책임 |
| --- | --- |
| `it_frontend/scripts/max-lines-baselines.mjs` | 기존 800줄 초과 운영 파일의 동결선 SoT |
| `it_frontend/eslint.config.mjs` | 신규 800줄 상한과 기존 파일별 기준선 적용 |
| `it_frontend/tests/unit/architecture/max-lines-ratchet.test.ts` | 기준 파일·물리 줄 수·ESLint 계산 결과 검증 |
| `it_frontend/tests/unit/architecture/component-boundaries.test.ts` | editor/layout/root 파일 경계 재발 방지 |
| `it_frontend/app/components/editor/**` | Tiptap, NodeView, Excalidraw, Mention 기능 경계 |
| `it_frontend/app/components/layout/**` | 애플리케이션 shell, navigation, search, notification, global dialogs |

---

### Task 1: 800줄 증가 불가 ratchet 도입

**Files:**

- Create: `it_frontend/scripts/max-lines-baselines.mjs`
- Modify: `it_frontend/eslint.config.mjs`
- Create: `it_frontend/tests/unit/architecture/max-lines-ratchet.test.ts`

**Interfaces:**

- Produces: `MAX_NEW_FILE_LINES: 800`
- Produces: `OVERSIZED_FILE_BASELINES: Readonly<Record<string, number>>`
- Consumed by: ESLint flat config, architecture test, Wave C의 기준선 삭제

- [ ] **Step 1: 기준선 모듈 부재를 보여주는 실패 테스트 작성**

```ts
// tests/unit/architecture/max-lines-ratchet.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import {
    MAX_NEW_FILE_LINES,
    OVERSIZED_FILE_BASELINES,
} from '../../../scripts/max-lines-baselines.mjs';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));

const physicalLineCount = (path: string): number => {
    const source = readFileSync(resolve(repoRoot, path), 'utf8');
    const lines = source.split(/\r?\n/);
    return source.endsWith('\n') ? lines.length - 1 : lines.length;
};

describe('max-lines ratchet', () => {
    it('30개 기존 초과 파일의 실제 줄 수를 현재 기준으로 고정한다', () => {
        expect(Object.keys(OVERSIZED_FILE_BASELINES)).toHaveLength(30);
        for (const [path, baseline] of Object.entries(OVERSIZED_FILE_BASELINES)) {
            expect(path).toMatch(/^app\/.*\.(ts|vue)$/);
            expect(path).not.toMatch(/^tests\//);
            expect(baseline).toBeGreaterThan(MAX_NEW_FILE_LINES);
            expect(physicalLineCount(path), path).toBe(baseline);
        }
    });

    it('신규 운영 파일과 기존 초과 파일에 서로 다른 상한을 계산한다', async () => {
        const eslint = new ESLint();
        const newFileConfig = await eslint.calculateConfigForFile('app/__max_lines_probe__.ts');
        const existingConfig = await eslint.calculateConfigForFile('app/utils/hwpx.ts');

        expect(newFileConfig?.rules?.['max-lines']).toEqual([
            2,
            { max: MAX_NEW_FILE_LINES, skipBlankLines: false, skipComments: false },
        ]);
        expect(existingConfig?.rules?.['max-lines']).toEqual([
            2,
            {
                max: OVERSIZED_FILE_BASELINES['app/utils/hwpx.ts'],
                skipBlankLines: false,
                skipComments: false,
            },
        ]);
    });
});
```

- [ ] **Step 2: 테스트가 기준선 모듈 부재로 실패하는지 확인**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts
```

Expected: `scripts/max-lines-baselines.mjs`를 찾지 못해 실패.

- [ ] **Step 3: 현재 30개 기준선 모듈 작성**

```js
// scripts/max-lines-baselines.mjs
/** 신규 운영 TypeScript·Vue 파일의 최대 물리 줄 수 */
export const MAX_NEW_FILE_LINES = 800;

/**
 * 2026-07-29 기준 기존 초과 파일의 감소 전용 상한입니다.
 *
 * 파일이 줄면 값을 현재 줄 수로 낮추고, 800줄 이하가 되면 항목을 삭제합니다.
 * 새 경로 추가와 값 증가는 허용하지 않습니다.
 */
export const OVERSIZED_FILE_BASELINES = Object.freeze({
    'app/components/common/EmployeeSearchDialog.vue': 899,
    'app/components/cost/TerminalTableSection.vue': 813,
    'app/components/extensions/tiptap-content-extensions.ts': 1079,
    'app/components/extensions/tiptap-extensions.ts': 1007,
    'app/components/TiptapEditor.vue': 1328,
    'app/components/TiptapTableFloatingToolbar.vue': 1104,
    'app/components/TiptapToolbar.vue': 1287,
    'app/composables/useCouncil.ts': 824,
    'app/composables/useTiptapTableTools.ts': 913,
    'app/pages/admin/codes.vue': 1026,
    'app/pages/admin/logs/[logKey].vue': 957,
    'app/pages/budget/approval.vue': 1031,
    'app/pages/budget/list.vue': 1153,
    'app/pages/budget/status.vue': 1260,
    'app/pages/budget/work.vue': 970,
    'app/pages/guide/index.vue': 915,
    'app/pages/info/cost/form.vue': 1037,
    'app/pages/info/cost/index.vue': 1174,
    'app/pages/info/council-request/[id].vue': 1009,
    'app/pages/info/council-request/index.vue': 863,
    'app/pages/info/council-request/result/[id].vue': 1040,
    'app/pages/info/documents/[id]/index.vue': 1447,
    'app/pages/info/plan/[id].vue': 1239,
    'app/pages/info/plan/form.vue': 1260,
    'app/pages/info/projects/[id].vue': 1169,
    'app/pages/info/projects/form.vue': 1252,
    'app/pages/info/projects/index.vue': 812,
    'app/pages/project/bizplan/[abusMngNo].vue': 1116,
    'app/pages/project/estimate/[docNo].vue': 827,
    'app/utils/hwpx.ts': 1502,
});
```

- [ ] **Step 4: ESLint flat config에 신규 상한과 기존 기준선 적용**

`eslint.config.mjs` 상단에 다음 import를 추가한다.

```js
import {
    MAX_NEW_FILE_LINES,
    OVERSIZED_FILE_BASELINES,
} from './scripts/max-lines-baselines.mjs';
```

`eslintConfigPrettier` 앞에 다음 flat config들을 추가한다.

```js
    {
        files: ['app/**/*.{ts,vue}'],
        ignores: Object.keys(OVERSIZED_FILE_BASELINES),
        rules: {
            'max-lines': [
                'error',
                {
                    max: MAX_NEW_FILE_LINES,
                    skipBlankLines: false,
                    skipComments: false,
                },
            ],
        },
    },
    ...Object.entries(OVERSIZED_FILE_BASELINES).map(([file, max]) => ({
        files: [file],
        rules: {
            'max-lines': [
                'error',
                {
                    max,
                    skipBlankLines: false,
                    skipComments: false,
                },
            ],
        },
    })),
```

- [ ] **Step 5: ratchet 테스트와 전체 정적 검사 통과 확인**

```powershell
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts
npm run check
```

Expected: 테스트 2건 통과, `npm run check` 성공, 기존 30개 파일에 신규 오류 없음.

- [ ] **Step 6: ratchet 커밋**

```powershell
git add -- scripts/max-lines-baselines.mjs eslint.config.mjs
git add -- tests/unit/architecture/max-lines-ratchet.test.ts
git commit -m "chore: 프론트 파일 크기 ratchet 추가 (CQ-15)"
```

---

### Task 2: editor 기능 경계로 14개 파일 이동

**Files:**

- Create directory: `it_frontend/app/components/editor`
- Move: root editor Vue files 11개 → `app/components/editor/`
- Move: `app/components/extensions/tiptap-*.ts` 3개 → `app/components/editor/extensions/`
- Modify: editor production 소비자 12개
- Modify: editor test·mock 소비자 7개
- Modify: `it_frontend/scripts/max-lines-baselines.mjs`
- Create: `it_frontend/tests/unit/architecture/component-boundaries.test.ts`

**Interfaces:**

- Preserves: component names, props, emits, Tiptap extension exports와 `useTiptapTableTools` 계약
- Produces: `~/components/editor/*.vue`, `~/components/editor/extensions/tiptap-*.ts`

- [ ] **Step 1: editor 경계의 실패하는 architecture test 작성**

```ts
// tests/unit/architecture/component-boundaries.test.ts
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const componentRoot = fileURLToPath(new URL('../../../app/components', import.meta.url));
const files = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort();

describe('component 기능 경계', () => {
    it('editor 컴포넌트와 확장을 editor 디렉터리에 모은다', () => {
        expect(files(`${componentRoot}/editor`)).toEqual(
            [
                'AttachmentNodeView.vue',
                'BlockMathNodeView.vue',
                'ExcalidrawNodeView.vue',
                'ExcalidrawWrapper.vue',
                'InlineMathNodeView.vue',
                'MentionAutocomplete.vue',
                'ResizableImageNodeView.vue',
                'TiptapEditor.vue',
                'TiptapTableFloatingToolbar.vue',
                'TiptapToolbar.vue',
                'VariableNodeView.vue',
            ].sort(),
        );
        expect(files(`${componentRoot}/editor/extensions`)).toEqual(
            [
                'tiptap-content-extensions.ts',
                'tiptap-extensions.ts',
                'tiptap-toolbar-options.ts',
            ].sort(),
        );
    });
});
```

- [ ] **Step 2: 테스트가 `components/editor` 부재로 실패하는지 확인**

```powershell
npm test -- tests/unit/architecture/component-boundaries.test.ts
```

Expected: `ENOENT`로 실패.

- [ ] **Step 3: exact source/target를 검증하고 파일 이동**

```powershell
$editorMoves = [ordered]@{
  'app/components/TiptapEditor.vue' = 'app/components/editor/TiptapEditor.vue'
  'app/components/TiptapToolbar.vue' = 'app/components/editor/TiptapToolbar.vue'
  'app/components/TiptapTableFloatingToolbar.vue' = 'app/components/editor/TiptapTableFloatingToolbar.vue'
  'app/components/AttachmentNodeView.vue' = 'app/components/editor/AttachmentNodeView.vue'
  'app/components/BlockMathNodeView.vue' = 'app/components/editor/BlockMathNodeView.vue'
  'app/components/InlineMathNodeView.vue' = 'app/components/editor/InlineMathNodeView.vue'
  'app/components/ResizableImageNodeView.vue' = 'app/components/editor/ResizableImageNodeView.vue'
  'app/components/VariableNodeView.vue' = 'app/components/editor/VariableNodeView.vue'
  'app/components/ExcalidrawNodeView.vue' = 'app/components/editor/ExcalidrawNodeView.vue'
  'app/components/ExcalidrawWrapper.vue' = 'app/components/editor/ExcalidrawWrapper.vue'
  'app/components/MentionAutocomplete.vue' = 'app/components/editor/MentionAutocomplete.vue'
  'app/components/extensions/tiptap-content-extensions.ts' = 'app/components/editor/extensions/tiptap-content-extensions.ts'
  'app/components/extensions/tiptap-extensions.ts' = 'app/components/editor/extensions/tiptap-extensions.ts'
  'app/components/extensions/tiptap-toolbar-options.ts' = 'app/components/editor/extensions/tiptap-toolbar-options.ts'
}
foreach ($entry in $editorMoves.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $entry.Key)) { throw "이동 원본 없음: $($entry.Key)" }
  if (Test-Path -LiteralPath $entry.Value) { throw "이동 대상 이미 존재: $($entry.Value)" }
}
New-Item -ItemType Directory -Force -Path app/components/editor/extensions | Out-Null
foreach ($entry in $editorMoves.GetEnumerator()) {
  Move-Item -LiteralPath $entry.Key -Destination $entry.Value
}
```

- [ ] **Step 4: production 소비자에 명시적 import 추가·경로 변경**

다음 manifest를 빠짐없이 반영한다.

| 소비자 | import |
| --- | --- |
| `app/pages/guide/index.vue` | `import TiptapEditor from '~/components/editor/TiptapEditor.vue'` |
| `app/pages/project/bizplan/[abusMngNo].vue` | 같은 `TiptapEditor` import |
| `app/pages/info/projects/form.vue` | 같은 `TiptapEditor` import |
| `app/pages/info/plan/form.vue` | 같은 `TiptapEditor` import |
| `app/pages/info/plan/[id].vue` | 같은 `TiptapEditor` import |
| `app/pages/info/documents/form.vue` | 같은 `TiptapEditor` import |
| `app/pages/info/documents/[id]/index.vue` | 같은 `TiptapEditor` import |
| `app/components/review/ReviewEditor.vue` | 같은 `TiptapEditor` import |
| `app/components/board/BoardCommentTree.vue` | `~/components/editor/MentionAutocomplete.vue` |
| `app/pages/board/[blbMngNo]/form.vue` | 같은 `MentionAutocomplete` 경로 |
| `app/pages/board/[blbMngNo]/[nacMngNo]/edit.vue` | 같은 `MentionAutocomplete` 경로 |
| `app/composables/useTiptapTableTools.ts` | `../components/editor/extensions/tiptap-toolbar-options` |

이동된 `TiptapEditor.vue`에는 아래 import를 추가해 자동 등록을 제거한다.

```ts
import TiptapTableFloatingToolbar from './TiptapTableFloatingToolbar.vue';
```

이동된 `TiptapToolbar.vue`에는 아래 import를 추가한다.

```ts
import ExcalidrawWrapper from './ExcalidrawWrapper.vue';
```

- [ ] **Step 5: test·mock의 exact 경로 갱신**

```text
tests/unit/components/TiptapEditor.test.ts
  ~/components/TiptapEditor.vue
    → ~/components/editor/TiptapEditor.vue
  ~/components/extensions/tiptap-extensions
    → ~/components/editor/extensions/tiptap-extensions

tests/unit/components/editor-error-state.test.ts
  ~/components/ExcalidrawWrapper.vue
    → ~/components/editor/ExcalidrawWrapper.vue
  ~/components/TiptapEditor.vue
    → ~/components/editor/TiptapEditor.vue
  ~/components/extensions/tiptap-extensions
    → ~/components/editor/extensions/tiptap-extensions

tests/unit/components/MentionAutocomplete.test.ts
  ~/components/MentionAutocomplete.vue
    → ~/components/editor/MentionAutocomplete.vue

tests/unit/components/VariableNodeView.test.ts
  ../../../app/components/VariableNodeView.vue
    → ../../../app/components/editor/VariableNodeView.vue

tests/unit/components/extensions/tiptap-error-diagnostics.test.ts
  ~/components/extensions/*
    → ~/components/editor/extensions/*

tests/unit/components/extensions/variableExtension.test.ts
  ../../../../app/components/extensions/tiptap-content-extensions
    → ../../../../app/components/editor/extensions/tiptap-content-extensions

tests/unit/components/extensions/variableStorageReactivity.test.ts
  ~/components/extensions/tiptap-content-extensions
    → ~/components/editor/extensions/tiptap-content-extensions
```

- [ ] **Step 6: ratchet의 다섯 editor 기준 경로만 이동**

`scripts/max-lines-baselines.mjs`에서 값은 유지하고 키만 다음처럼 바꾼다.

```js
'app/components/editor/TiptapEditor.vue': 1328,
'app/components/editor/TiptapTableFloatingToolbar.vue': 1104,
'app/components/editor/TiptapToolbar.vue': 1287,
'app/components/editor/extensions/tiptap-content-extensions.ts': 1079,
'app/components/editor/extensions/tiptap-extensions.ts': 1007,
```

- [ ] **Step 7: 이전 경로와 자동등록 의존이 남지 않았는지 확인**

```powershell
rg -n "~/components/(Tiptap|AttachmentNodeView|BlockMathNodeView|InlineMathNodeView|ResizableImageNodeView|VariableNodeView|Excalidraw|MentionAutocomplete)|components/extensions/tiptap" app tests
rg -n "<TiptapEditor|<MentionAutocomplete|<TiptapTableFloatingToolbar|<ExcalidrawWrapper" app --glob "*.vue"
```

Expected:

- 첫 grep 0건
- 두 번째 grep의 모든 production 소비 파일에 대응하는 명시적 import 존재

- [ ] **Step 8: editor 구조·기능 검증**

```powershell
npm test -- `
  tests/unit/architecture/component-boundaries.test.ts `
  tests/unit/architecture/max-lines-ratchet.test.ts `
  tests/unit/components/TiptapEditor.test.ts `
  tests/unit/components/editor-error-state.test.ts `
  tests/unit/components/MentionAutocomplete.test.ts `
  tests/unit/components/VariableNodeView.test.ts `
  tests/unit/components/extensions/tiptap-error-diagnostics.test.ts `
  tests/unit/components/extensions/variableExtension.test.ts `
  tests/unit/components/extensions/variableStorageReactivity.test.ts `
  tests/unit/composables/useTiptapTableTools.test.ts
npm run check
npm run test:e2e -- tests/e2e/tiptap-variable.spec.ts tests/e2e/error-recovery-tiptap.spec.ts
```

Expected: 대상 Vitest·정적 검사·두 Playwright spec 통과.

- [ ] **Step 9: editor 이동 커밋**

```powershell
git add -- app/components/editor app/composables/useTiptapTableTools.ts
git add -u -- app/components
git add -- app/pages app/components/board app/components/review
git add -- tests/unit/components tests/unit/composables
git add -- tests/unit/architecture/component-boundaries.test.ts
git add -- scripts/max-lines-baselines.mjs
git diff --cached --name-only
git commit -m "refactor: editor 컴포넌트 경계 정리 (CQ-16)"
```

`git diff --cached --name-only`에 manifest 밖 파일이 있으면 commit하지 않는다.

---

### Task 3: layout 기능 경계로 10개 파일 이동

**Files:**

- Create directory: `it_frontend/app/components/layout`
- Move: layout Vue 파일 10개 → `app/components/layout/`
- Modify: production 소비자 11개
- Modify: `it_frontend/tests/unit/architecture/component-boundaries.test.ts`

**Interfaces:**

- Preserves: `AppShell`, navigation, search, notification, dialog component 이름과 props/emits
- Produces: `~/components/layout/*.vue`

- [ ] **Step 1: layout과 root 잔여 파일을 고정하는 실패 assertion 추가**

`component-boundaries.test.ts`에 다음 테스트를 추가한다.

```ts
it('layout 컴포넌트를 layout에 모으고 root에는 CQ-18 후보만 남긴다', () => {
    expect(files(`${componentRoot}/layout`)).toEqual(
        [
            'AppBreadcrumb.vue',
            'AppHeader.vue',
            'AppShell.vue',
            'AppSidebar.vue',
            'ApplicationViewerDialog.vue',
            'GeminiChat.vue',
            'GlobalSearchBar.vue',
            'NotificationBell.vue',
            'NotificationDropdown.vue',
            'SwitchUserDialog.vue',
        ].sort(),
    );
    expect(files(componentRoot)).toEqual(
        ['AppDialogFooter.vue', 'AppDialogHeader.vue', 'PageHeader.vue', 'TableCard.vue'].sort(),
    );
});
```

- [ ] **Step 2: layout 디렉터리 부재로 실패하는지 확인**

```powershell
npm test -- tests/unit/architecture/component-boundaries.test.ts
```

Expected: layout assertion이 `ENOENT`로 실패.

- [ ] **Step 3: exact source/target를 검증하고 이동**

```powershell
$layoutMoves = [ordered]@{
  'app/components/AppShell.vue' = 'app/components/layout/AppShell.vue'
  'app/components/AppHeader.vue' = 'app/components/layout/AppHeader.vue'
  'app/components/AppSidebar.vue' = 'app/components/layout/AppSidebar.vue'
  'app/components/AppBreadcrumb.vue' = 'app/components/layout/AppBreadcrumb.vue'
  'app/components/GlobalSearchBar.vue' = 'app/components/layout/GlobalSearchBar.vue'
  'app/components/NotificationBell.vue' = 'app/components/layout/NotificationBell.vue'
  'app/components/NotificationDropdown.vue' = 'app/components/layout/NotificationDropdown.vue'
  'app/components/GeminiChat.vue' = 'app/components/layout/GeminiChat.vue'
  'app/components/SwitchUserDialog.vue' = 'app/components/layout/SwitchUserDialog.vue'
  'app/components/ApplicationViewerDialog.vue' = 'app/components/layout/ApplicationViewerDialog.vue'
}
foreach ($entry in $layoutMoves.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $entry.Key)) { throw "이동 원본 없음: $($entry.Key)" }
  if (Test-Path -LiteralPath $entry.Value) { throw "이동 대상 이미 존재: $($entry.Value)" }
}
New-Item -ItemType Directory -Force -Path app/components/layout | Out-Null
foreach ($entry in $layoutMoves.GetEnumerator()) {
  Move-Item -LiteralPath $entry.Key -Destination $entry.Value
}
```

- [ ] **Step 4: 모든 layout 소비자에 명시적 import 추가·갱신**

| 소비자 | import |
| --- | --- |
| `app/layouts/default.vue` | `import AppShell from '~/components/layout/AppShell.vue'` |
| `app/layouts/admin.vue` | 같은 `AppShell` import |
| `app/components/layout/AppShell.vue` | `./AppHeader.vue`, `./AppSidebar.vue` |
| `app/components/layout/AppHeader.vue` | `./GlobalSearchBar.vue`, `./NotificationBell.vue` |
| `app/components/layout/NotificationBell.vue` | `./NotificationDropdown.vue` |
| `app/components/PageHeader.vue` | `~/components/layout/AppBreadcrumb.vue` |
| `app/pages/info/documents/form.vue` | `~/components/layout/GeminiChat.vue` |
| `app/pages/info/documents/[id]/index.vue` | 같은 `GeminiChat` import |
| `app/pages/info/council-request/index.vue` | `~/components/layout/SwitchUserDialog.vue` |
| `app/pages/approval/list.vue` | `~/components/layout/ApplicationViewerDialog.vue` |
| `app/pages/budget/list.vue` | 같은 `ApplicationViewerDialog` import |

이동한 파일 상단의 `[components/Foo.vue]` 경로 주석은 `[components/layout/Foo.vue]`로만 갱신하고 다른 설명은 바꾸지 않는다.

- [ ] **Step 5: 이전 경로와 자동등록 의존 제거 확인**

```powershell
rg -n "~/components/(AppShell|AppHeader|AppSidebar|AppBreadcrumb|GlobalSearchBar|NotificationBell|NotificationDropdown|GeminiChat|SwitchUserDialog|ApplicationViewerDialog)\\.vue" app tests
rg -n "<AppShell|<AppHeader|<AppSidebar|<AppBreadcrumb|<GlobalSearchBar|<NotificationBell|<NotificationDropdown|<GeminiChat|<SwitchUserDialog|<ApplicationViewerDialog" app --glob "*.vue"
```

Expected:

- 첫 grep 0건
- 두 번째 grep의 모든 production 소비자에 `~/components/layout/` 또는 같은 디렉터리 상대 import 존재

- [ ] **Step 6: layout 구조와 사용자 흐름 검증**

```powershell
npm test -- tests/unit/architecture/component-boundaries.test.ts tests/unit/architecture/max-lines-ratchet.test.ts
npm run check
npm run test:e2e -- `
  tests/e2e/auth.spec.ts `
  tests/e2e/role-menu.spec.ts `
  tests/e2e/notifications.spec.ts `
  tests/e2e/approval.spec.ts `
  tests/e2e/budget.spec.ts
```

Expected: architecture test, 정적 검사와 지정 Playwright spec 통과.

- [ ] **Step 7: layout 이동 커밋**

```powershell
git add -- app/components/layout app/layouts app/pages
git add -- app/components/PageHeader.vue
git add -u -- app/components
git add -- tests/unit/architecture/component-boundaries.test.ts
git diff --cached --name-only
git commit -m "refactor: layout 컴포넌트 경계 정리 (CQ-16)"
```

---

### Task 4: Wave B 전체 게이트와 추적 문서 완료

**Files:**

- Verify: `it_frontend/**`
- Modify after success: `C:\it\TASK.md`
- Modify after success: `C:\it\TASK_DONE.md`
- Move after success: 이 계획 → `docs/superpowers/plans/done/`

**Interfaces:**

- Consumes: Task 1~3의 frontend 커밋 3개
- Produces: CQ-16 완료 근거와 CQ-15 ratchet 도입 근거

- [ ] **Step 1: 전체 프론트 품질 게이트 실행**

```powershell
cd C:\it\it_frontend
npm run format:check
npm run check
npm test
npm run test:e2e
```

Expected: 네 명령 모두 exit code 0. 기존 baseline 경고 외 신규 경고 없음.

- [ ] **Step 2: 정적 완료 조건 확인**

```powershell
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts tests/unit/architecture/component-boundaries.test.ts
Get-ChildItem -LiteralPath app/components -File | Select-Object -ExpandProperty Name
git status --short
git log -3 --oneline
```

Expected:

- root component 파일은 `AppDialogFooter.vue`, `AppDialogHeader.vue`, `PageHeader.vue`, `TableCard.vue` 네 개
- ratchet 기준 30개와 실제 물리 줄 수 일치
- frontend 커밋 3개 확인

- [ ] **Step 3: root 추적 문서 이관**

`TASK.md`의 CQ-16을 제거하고 `TASK_DONE.md`에 다음 실제 근거를 기록한다.

- editor 14개와 layout 10개 이동
- root 잔여 4개는 CQ-18 유지
- architecture test 2개
- `npm run format:check`, `npm run check`, `npm test`, `npm run test:e2e` 결과
- 실제 frontend 커밋 3개

CQ-15는 완료 처리하지 않고 “30개 증가 불가 ratchet 도입 완료, Wave C에서 기준 항목 제거 중”으로 갱신한다.

- [ ] **Step 4: 완료 계획 이관과 root 문서 커밋**

root의 `TASK.md`, `TASK_DONE.md`, 계획 경로가 구현 전 별도 변경과 섞이지 않았는지 targeted status로 확인한 후 Wave A 계획의 안전한 `Move-Item`·targeted `git add` 패턴을 사용한다.

```powershell
git -C C:\it status --short -- `
  TASK.md `
  TASK_DONE.md `
  docs/superpowers/plans/2026-07-29-clean-code-wave3-wave-b-frontend-structure.md
```

예상하지 않은 기존 변경이 있으면 root 문서 commit을 중단한다.

## Test Coverage

```text
RATCHET
  [★★★] 신규 app/**/*.ts|vue → max 800
  [★★★] 기존 30개 → 현재 기준 초과 차단
  [★★★] 파일 감소 → 기준 동반 감소
  [★★★] 800 이하 → 기준 삭제

EDITOR MOVE
  [★★★] 14개 exact 경로
  [★★★] production 명시적 import
  [★★★] test/mock/상대경로 갱신
  [★★★] Tiptap 변수·오류·extension·E2E

LAYOUT MOVE
  [★★★] 10개 exact 경로
  [★★★] shell/header/sidebar/search/notification
  [★★★] global dialogs
  [★★★] auth/menu/notification/approval/budget E2E

GAPS: 0
```

## Parallelization

- Task 1은 모든 후속 task의 선행 조건이다.
- Task 2와 Task 3은 파일 경계가 다르지만 둘 다 `component-boundaries.test.ts`와 root component 경로를 수정하므로 같은 worktree에서 순차 실행한다.
- Wave C는 Task 2의 editor 이동 커밋과 Task 4 전체 게이트가 끝난 뒤 시작한다.

## Baseline Evidence

- Frontend branch: `main`
- Cross-check commit: `937f5f9`
- Oversized production files: 30
- Baseline `npm run check`: 성공
- Baseline related Vitest: 10 files, 128 tests passed
- Baseline warnings: 기존 NodeView 필수 prop/injection 경고와 composable lifecycle 경고가 존재하며 이번 Wave에서 증가시키지 않는다.
