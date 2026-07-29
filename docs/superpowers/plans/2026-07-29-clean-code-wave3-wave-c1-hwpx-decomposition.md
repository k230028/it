# Clean Code Wave 3 Wave C1 HWPX Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1,502줄 `app/utils/hwpx.ts`를 model, header XML, HTML parser, section XML, public facade로 분리하면서 HWPX binary와 공개 API를 그대로 유지한다.

**Architecture:** `app/utils/hwpx.ts`는 preprocessing, image resolution, style registry, JSZip packaging을 조정하는 public facade로 남긴다. 내부 `hwpx/` 모듈은 순환 없이 `model → parser/header/section → facade` 방향으로만 의존하며, 각 파일을 800줄 이하로 제한한다.

**Tech Stack:** TypeScript, DOMParser, JSZip, HWPX XML, Vitest, ESLint max-lines ratchet

## Global Constraints

- 선행: Wave B 완료 후 `app/utils/hwpx.ts: 1502` 기준선이 존재해야 한다.
- public runtime export는 `preprocessHtmlForHwpx`, `htmlToHwpxBlob` 두 개를 유지한다.
- public type export는 `HwpxTitleOptions`, `HwpxBlobOptions`를 유지한다.
- `htmlToHwpxBlob`의 세 인자와 기본값, 반환 `Promise<Blob>`을 변경하지 않는다.
- ZIP entry 이름, mimetype STORE 처리, XML namespace, HWPUNIT 계산, title table, preview text를 변경하지 않는다.
- 이미지 fetch 실패는 성공 이미지와 분리하고 `onImageFailures` callback으로 전달하는 현재 의미를 유지한다.
- 이번 작업에서는 XML 내용 개선, 파일 포맷 변경, 새 dependency 도입을 하지 않는다.
- 각 extraction commit에서 관련 테스트와 `npm run check`를 통과시킨다.

## File Map

| 파일 | 책임 |
| --- | --- |
| `app/utils/hwpx.ts` | public API, preprocessing, image resolution, style registry, JSZip packaging |
| `app/utils/hwpx/model.ts` | HWPX 상수, node 타입, XML escape |
| `app/utils/hwpx/header-xml.ts` | char/paragraph style와 `Contents/header.xml` 생성 |
| `app/utils/hwpx/html-parser.ts` | HTML DOM을 `DocNode[]`로 변환 |
| `app/utils/hwpx/section-xml.ts` | `DocNode[]`를 `Contents/section0.xml`로 변환 |
| `tests/unit/utils/hwpx-public-contract.test.ts` | public export와 ZIP entry 호환성 |
| `tests/unit/utils/hwpx.test.ts` | 기존 XML·표·이미지·변수 black-box 회귀 |

## Internal Interfaces

```text
model.ts
  CHAR_PR / CharPrId
  PARA_PR / ParaPrId
  TAG_MAP / TagStyle
  TABLE_WIDTH=48190, ROW_HEIGHT=1848, CELL_BF_TH=4, CELL_BF_TD=3
  DEFAULT_LINESEG
  TextRun, ParagraphNode, CellData, TableNode, DocNode
  escXml(value): string

header-xml.ts
  makeCharPr(id, height, fontIdx, borderFillId, options): string
  makeDynamicBorderFill(id, fillColor): string
  buildHeaderXml(images, extraCharPrXml, extraCharPrCount,
                 extraBorderFillXml, extraBorderFillCount): string

html-parser.ts
  htmlToDocNodes(html, imgMap?): DocNode[]

section-xml.ts
  buildSectionXml(nodes, headerTable?): string
  buildTitleTableNode(options): TableNode
```

---

### Task 1: 공개 계약 characterization 고정

**Files:**

- Create: `it_frontend/tests/unit/utils/hwpx-public-contract.test.ts`
- Test: `it_frontend/tests/unit/utils/hwpx.test.ts`

- [ ] **Step 1: runtime export와 package entry 테스트 작성**

```ts
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import * as hwpx from '../../../app/utils/hwpx';

describe('hwpx public contract', () => {
    it('runtime export를 두 공개 함수로 제한한다', () => {
        expect(Object.keys(hwpx).sort()).toEqual(['htmlToHwpxBlob', 'preprocessHtmlForHwpx']);
    });

    it('필수 HWPX package entry와 mimetype을 유지한다', async () => {
        const blob = await hwpx.htmlToHwpxBlob('<p>계약 고정</p>', '계약 테스트');
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());

        const packageFiles = Object.values(zip.files)
            .filter((entry) => !entry.dir)
            .map((entry) => entry.name)
            .sort();
        expect(packageFiles).toEqual(
            [
                'Contents/content.hpf',
                'Contents/header.xml',
                'Contents/section0.xml',
                'META-INF/container.rdf',
                'META-INF/container.xml',
                'META-INF/manifest.xml',
                'Preview/PrvText.txt',
                'mimetype',
                'settings.xml',
                'version.xml',
            ].sort(),
        );
        await expect(zip.file('mimetype')?.async('string')).resolves.toBe(
            'application/hwp+zip',
        );
    });
});
```

- [ ] **Step 2: characterization baseline 통과 확인**

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/utils/hwpx-public-contract.test.ts tests/unit/utils/hwpx.test.ts
```

Expected: 신규 테스트와 기존 24개 `hwpx.test.ts` 테스트 통과.

- [ ] **Step 3: characterization test 커밋**

```powershell
git add -- tests/unit/utils/hwpx-public-contract.test.ts
git commit -m "test: HWPX 공개 계약 고정"
```

---

### Task 2: model과 header XML 추출

**Files:**

- Create: `it_frontend/app/utils/hwpx/model.ts`
- Create: `it_frontend/app/utils/hwpx/header-xml.ts`
- Modify: `it_frontend/app/utils/hwpx.ts:37-470`

**Interfaces:**

- Produces: `CHAR_PR`, `PARA_PR`, table constants, `DocNode` 계열 타입
- Produces: `makeCharPr`, `makeDynamicBorderFill`, `buildHeaderXml`

- [ ] **Step 1: model 타입과 상수를 verbatim 이동**

다음 원본 범위를 `model.ts`로 이동하고 `export`만 추가한다.

```text
hwpx.ts:41-189
  CHAR_PR, CharPrId
  PARA_PR, ParaPrId
  TAG_MAP
  TABLE_WIDTH, ROW_HEIGHT, CELL_BF_TH, CELL_BF_TD
  DEFAULT_LINESEG
  TextRun, ParagraphNode, CellData, TableNode, DocNode
  escXml
```

`TagStyle`은 익명 `TAG_MAP` value 타입을 다음 named interface로 바꾼다.

```ts
export interface TagStyle {
    para: ParaPrId;
    char: CharPrId;
    prefix?: string;
    prefixChar?: CharPrId;
}

export const TAG_MAP: Readonly<Record<string, TagStyle>> = {
    p: { para: PARA_PR.NORMAL, char: CHAR_PR.NORMAL },
    h1: { para: PARA_PR.H2, char: CHAR_PR.BOLD, prefix: '□ ', prefixChar: CHAR_PR.SYM },
    h2: {
        para: PARA_PR.H2,
        char: CHAR_PR.H3_HEAD,
        prefix: '□ ',
        prefixChar: CHAR_PR.H3_HEAD,
    },
    h3: { para: PARA_PR.H3, char: CHAR_PR.SYM, prefix: ' ㅇ ', prefixChar: CHAR_PR.SYM },
    h4: { para: PARA_PR.H4, char: CHAR_PR.SYM, prefix: '  - ', prefixChar: CHAR_PR.SYM },
    h5: { para: PARA_PR.H3, char: CHAR_PR.BOLD },
    h6: { para: PARA_PR.H3, char: CHAR_PR.BOLD },
};
```

- [ ] **Step 2: header builder를 verbatim 이동**

`hwpx.ts:195-470`의 다음 함수들을 `header-xml.ts`로 이동한다.

```ts
makeCharPr
makeParaPr
makeDynamicBorderFill
makeFontface
buildHeaderXml
```

새 파일의 import는 다음으로 제한한다.

```ts
import { COMMON_XMLNS } from '../hwpx-package-xml';
import type { ResolvedImage } from '../hwpx-images';
```

`makeParaPr`와 `makeFontface`는 파일 내부 함수로 유지하고 나머지 세 함수만 export한다.

- [ ] **Step 3: facade와 남은 helper의 import 갱신**

```ts
import {
    CELL_BF_TD,
    CHAR_PR,
    PARA_PR,
    TABLE_WIDTH,
    type DocNode,
    type TableNode,
    type TextRun,
} from './hwpx/model';
import {
    buildHeaderXml,
    makeCharPr,
    makeDynamicBorderFill,
} from './hwpx/header-xml';
```

`hwpx.ts`에서 이동한 선언을 삭제한다. 중복 상수나 re-export를 남기지 않는다.

- [ ] **Step 4: HWPX 회귀와 정적 검사**

```powershell
npm test -- tests/unit/utils/hwpx-public-contract.test.ts tests/unit/utils/hwpx.test.ts
npm run check
```

- [ ] **Step 5: model/header extraction 커밋**

```powershell
git add -- app/utils/hwpx.ts app/utils/hwpx/model.ts app/utils/hwpx/header-xml.ts
git commit -m "refactor: HWPX model과 header XML 분리"
```

---

### Task 3: HTML parser 추출

**Files:**

- Create: `it_frontend/app/utils/hwpx/html-parser.ts`
- Modify: `it_frontend/app/utils/hwpx.ts:482-882`
- Test: `it_frontend/tests/unit/utils/hwpx.test.ts`

**Interfaces:**

- Consumes: model constants/types, `PendingImage`
- Produces: `htmlToDocNodes(html, imgMap): DocNode[]`

- [ ] **Step 1: parser가 처리하는 black-box 경로 확인**

기존 `hwpx.test.ts`의 다음 describe가 모두 존재하는지 확인한다.

```text
단순 표
colspan 병합
rowspan 병합
열 너비 비율
셀 스타일
단락 및 목록 변환
복합 병합
이미지 포함 변환
변수 노드 치환
```

- [ ] **Step 2: parser 함수와 private helper 이동**

`hwpx.ts:482-882`의 `cssColorToHex`, `extractRuns`, `htmlToDocNodes`를 `html-parser.ts`로 verbatim 이동한다. 앞의 두 함수는 private로 유지하고 `htmlToDocNodes`만 export한다.

내부 함수 계약은
`htmlToDocNodes: (html: string, imgMap?: Map<string, PendingImage>) => DocNode[]`로
고정한다. `PendingImage`와 model의 상수·타입은 각 선언 파일에서 명시적으로
import하고, 원본 `htmlToDocNodes` 본문 전체를 그대로 이동한다.
로직·조건·fallback을 재작성하지 않는다.

- [ ] **Step 3: facade import와 중복 제거**

```ts
import { htmlToDocNodes } from './hwpx/html-parser';
```

원본 세 함수를 `hwpx.ts`에서 삭제한다.

- [ ] **Step 4: parser 중심 테스트와 전체 HWPX 테스트**

```powershell
npm test -- tests/unit/utils/hwpx.test.ts tests/unit/utils/hwpx-public-contract.test.ts
npm run check
```

- [ ] **Step 5: parser extraction 커밋**

```powershell
git add -- app/utils/hwpx.ts app/utils/hwpx/html-parser.ts
git commit -m "refactor: HWPX HTML parser 분리"
```

---

### Task 4: section XML과 title table 추출

**Files:**

- Create: `it_frontend/app/utils/hwpx/section-xml.ts`
- Modify: `it_frontend/app/utils/hwpx.ts:891-1236`

**Interfaces:**

- Produces: `buildSectionXml(nodes, headerTable)`
- Produces: `buildTitleTableNode(options)`
- Consumes: `HwpxTitleOptions` type-only import from facade

- [ ] **Step 1: section builder 이동**

다음 함수와 전용 helper를 `section-xml.ts`로 이동한다.

```text
buildPicRunXml
runToXml
buildParaXml
buildTableXml
buildTblElementOnly
buildSectionXml
buildTitleTableNode
defaultYearMonth
```

타입 순환을 피하기 위해 `HwpxTitleOptions`를 facade에서 가져오지 않고 `model.ts`로 이동한다.

```ts
// model.ts
export interface HwpxTitleOptions {
    left?: string;
    center: string;
    right?: string;
}
```

facade는 이를 type re-export한다.

```ts
export type { HwpxTitleOptions } from './hwpx/model';
import type { HwpxTitleOptions } from './hwpx/model';
```

`section-xml.ts` import:

```ts
import { COMMON_XMLNS } from '../hwpx-package-xml';
import {
    CELL_BF_TD,
    CHAR_PR,
    DEFAULT_LINESEG,
    PARA_PR,
    ROW_HEIGHT,
    TABLE_WIDTH,
    escXml,
    type CharPrId,
    type DocNode,
    type HwpxTitleOptions,
    type ParaPrId,
    type TableNode,
    type TextRun,
} from './model';
```

- [ ] **Step 2: facade import와 타입 export 정리**

```ts
import { buildSectionXml, buildTitleTableNode } from './hwpx/section-xml';
export type { HwpxTitleOptions } from './hwpx/model';
```

`hwpx.ts`에는 같은 이름의 interface와 helper를 남기지 않는다.

- [ ] **Step 3: 회귀 검증**

```powershell
npm test -- tests/unit/utils/hwpx-public-contract.test.ts tests/unit/utils/hwpx.test.ts
npm run check
```

- [ ] **Step 4: section extraction 커밋**

```powershell
git add -- app/utils/hwpx.ts app/utils/hwpx/model.ts app/utils/hwpx/section-xml.ts
git commit -m "refactor: HWPX section XML 분리"
```

---

### Task 5: facade 800줄 이하·ratchet 제거·전체 검증

**Files:**

- Modify: `it_frontend/app/utils/hwpx.ts`
- Modify: `it_frontend/scripts/max-lines-baselines.mjs`
- Modify: `it_frontend/tests/unit/architecture/max-lines-ratchet.test.ts`

- [ ] **Step 1: facade에 남길 책임 확인**

`hwpx.ts`에는 다음만 남긴다.

```text
public options type
preprocessHtmlForHwpx
htmlToHwpxBlob
image resolve/size/failure orchestration
dynamic border/color registry orchestration
JSZip package assembly
```

Expected: `hwpx.ts` 800줄 이하, 각 `app/utils/hwpx/*.ts` 800줄 이하.

- [ ] **Step 2: ratchet 기준 삭제**

```js
// scripts/max-lines-baselines.mjs에서 이 항목 삭제
'app/utils/hwpx.ts': 1502,
```

architecture test의 기대 기준 수를 30에서 29로 낮춘다.

- [ ] **Step 3: 이전 private helper 중복이 없는지 확인**

```powershell
rg -n "const (buildHeaderXml|htmlToDocNodes|buildSectionXml|buildTitleTableNode|makeDynamicBorderFill)" app/utils/hwpx.ts
```

Expected: 0건.

- [ ] **Step 4: HWPX와 전체 품질 게이트**

```powershell
npm test -- `
  tests/unit/utils/hwpx-public-contract.test.ts `
  tests/unit/utils/hwpx.test.ts `
  tests/unit/utils/hwpx-images.test.ts `
  tests/unit/utils/hwpx-package-xml.test.ts `
  tests/unit/composables/useHwpxExport.direct.test.ts `
  tests/unit/architecture/max-lines-ratchet.test.ts
npm run format:check
npm run check
npm test
```

Expected: 모든 명령 성공, `hwpx.ts` public contract와 package entries 동일.

- [ ] **Step 5: C-1 완료 커밋**

```powershell
git add -- app/utils/hwpx.ts app/utils/hwpx
git add -- scripts/max-lines-baselines.mjs
git add -- tests/unit/architecture/max-lines-ratchet.test.ts
git commit -m "refactor: HWPX 변환 단계 모듈화 (CQ-15 C-1)"
```

## Test Coverage

```text
PUBLIC CONTRACT
  [★★★] runtime exports
  [★★★] function signatures via typecheck
  [★★★] ZIP entry set + mimetype

PARSER
  [★★★] paragraph/list/table
  [★★★] colspan/rowspan/width
  [★★★] inline styles/variables/images

XML/PACKAGE
  [★★★] header/section/content manifest
  [★★★] image success/partial failure
  [★★★] JSZip failure propagation

RATCHET
  [★★★] hwpx.ts <= 800
  [★★★] 기준 항목 1개 삭제
```

## Baseline Evidence

- Cross-check commit: frontend `937f5f9`
- Source: `app/utils/hwpx.ts`, 1,502 lines
- Runtime exports: `preprocessHtmlForHwpx`, `htmlToHwpxBlob`
- Direct production consumer: `app/composables/useHwpxExport.ts`
- Baseline HWPX tests: `hwpx.test.ts` 24, `hwpx-images.test.ts` 14
