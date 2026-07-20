# TEST.md E2E 스캐폴드 + Task 5 HTML 보고서 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TEST.md Task 4에 Playwright 스캐폴드 코드 4개를 추가하고, Task 5로 `generate-report.ts` 스크립트를 구현하여 FE/BE 커버리지·E2E 결과를 단일 HTML 파일(`docs/test/test-report-YYYY-MM-DD.html`)로 생성한다.

**Architecture:** TEST.md는 직접 편집하여 스캐폴드 섹션(Task 4)과 Task 5 섹션을 삽입한다. `generate-report.ts`는 Node.js `fs` + 정규식으로 Playwright JSON / Vitest JSON / Jacoco XML을 파싱하여 인라인 CSS 단일 HTML을 생성하는 ts-node CLI 스크립트다. 외부 패키지는 ts-node만 추가한다(Jacoco는 xml2js 없이 `matchAll` 정규식 파싱).

**Tech Stack:** TypeScript, ts-node, Node.js fs/path, Playwright JSON reporter, Vitest coverage-summary.json, Jacoco XML (matchAll 정규식 파싱)

---

## 파일 구조

| 동작 | 경로 | 책임 |
|------|------|------|
| Modify | `C:\it\TEST.md` | Task 4 스캐폴드 삽입 + Task 5 섹션 추가 + Verification Loop 보고서 명령 추가 |
| Modify | `it_frontend/playwright.config.ts` | JSON reporter 추가 |
| Modify | `it_frontend/package.json` | devDependencies ts-node 추가 |
| Create | `it_frontend/tests/e2e/generate-report.ts` | 보고서 생성 CLI 스크립트 |

---

## Task 1: Playwright JSON reporter + ts-node 추가

**Files:**
- Modify: `it_frontend/playwright.config.ts`
- Modify: `it_frontend/package.json`

- [ ] **Step 1: playwright.config.ts reporter를 배열로 교체**

현재 `reporter: 'html'`을 다음으로 교체한다:

```typescript
reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
],
```

- [ ] **Step 2: ts-node 설치**

```bash
cd it_frontend && npm i -D ts-node
```

Expected: `package.json` devDependencies에 `"ts-node": "^10.x.x"` 항목 추가됨.

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/playwright.config.ts it_frontend/package.json it_frontend/package-lock.json
git commit -m "chore: Playwright JSON reporter + ts-node devDependency 추가"
```

---

## Task 2: TEST.md — Task 4 스캐폴드 삽입

**Files:**
- Modify: `C:\it\TEST.md`

기존 `## [Task 4: E2E Test]` 섹션의 `### 발굴 대상 누락 시나리오 (예시)` 바로 앞에 아래 블록을 삽입한다.

- [ ] **Step 1: 신규 스캐폴드 파일 표 삽입**

```markdown
### 신규 스캐폴드 (e2e-runner가 구현 채움)

| 파일 | 시나리오 | 비고 |
|------|---------|------|
| `tests/e2e/budget.spec.ts` | 예산작성 → 경상사업 → 결재 상신 플로우 | 설계 시나리오 2번 |
| `tests/e2e/documents.spec.ts` | 사전협의 신규 작성 → 저장 → 목록/상세 확인 | 설계 시나리오 1번 |
| `tests/e2e/access-control.spec.ts` | 비관리자 `/admin/**` 접근 시 `/` 리다이렉트 | ROLE 접근 제어 |
| `tests/e2e/file-upload.spec.ts` | 첨부파일 업로드·다운로드 플로우 | page.route() mock 허용 |
```

- [ ] **Step 2: budget.spec.ts 스캐폴드 코드 블록 삽입**

```typescript
// [스캐폴드] tests/e2e/budget.spec.ts
// e2e-runner가 아래 describe/test 구조를 유지하며 실제 셀렉터·단언을 채운다.
import { test, expect } from '@playwright/test';
import { mockApi, mockCommonApis, setLoggedIn } from './helpers/mockApi';

test.describe('예산 작성 플로우', () => {
    test.beforeEach(async ({ page }) => {
        await setLoggedIn(page);
        await mockCommonApis(page);
        // TODO: e2e-runner — 예산 관련 API mock 추가
    });

    test('경상사업 예산 작성 후 결재 상신이 완료된다', async ({ page }) => {
        // TODO: e2e-runner — 구현
    });
});
```

- [ ] **Step 3: documents.spec.ts 스캐폴드 코드 블록 삽입**

```typescript
// [스캐폴드] tests/e2e/documents.spec.ts
import { test, expect } from '@playwright/test';
import { mockApi, mockCommonApis, setLoggedIn } from './helpers/mockApi';

test.describe('사전협의 문서 작성 플로우', () => {
    test.beforeEach(async ({ page }) => {
        await setLoggedIn(page);
        await mockCommonApis(page);
        // TODO: e2e-runner — 문서 관련 API mock 추가
    });

    test('사전협의 신규 작성 후 목록에 표시된다', async ({ page }) => {
        // TODO: e2e-runner — 구현
    });

    test('작성한 사전협의 상세 내용을 확인할 수 있다', async ({ page }) => {
        // TODO: e2e-runner — 구현
    });
});
```

- [ ] **Step 4: access-control.spec.ts 스캐폴드 코드 블록 삽입**

```typescript
// [스캐폴드] tests/e2e/access-control.spec.ts
import { test, expect } from '@playwright/test';
import { setLoggedIn } from './helpers/mockApi';

test.describe('권한 접근 제어', () => {
    test('비관리자가 /admin 접근 시 메인으로 리다이렉트된다', async ({ page }) => {
        await setLoggedIn(page, {
            eno: 'E002', empNm: '일반사용자',
            athIds: ['ITPZZ001'], bbrC: 'D001', temC: 'T001'
        });
        await page.goto('/admin');
        // TODO: e2e-runner — 리다이렉트 확인 (toHaveURL 등)
    });

    test('관리자는 /admin에 정상 접근한다', async ({ page }) => {
        await setLoggedIn(page, {
            eno: 'E000', empNm: '관리자',
            athIds: ['ITPAD001'], bbrC: 'D001', temC: 'T001'
        });
        await page.goto('/admin');
        // TODO: e2e-runner — 관리자 페이지 렌더링 확인
    });
});
```

- [ ] **Step 5: file-upload.spec.ts 스캐폴드 코드 블록 삽입**

```typescript
// [스캐폴드] tests/e2e/file-upload.spec.ts
import { test, expect } from '@playwright/test';
import { mockCommonApis, setLoggedIn } from './helpers/mockApi';

test.describe('파일 업로드·다운로드', () => {
    test.beforeEach(async ({ page }) => {
        await setLoggedIn(page);
        await mockCommonApis(page);
    });

    test('파일을 업로드하면 목록에 표시된다', async ({ page }) => {
        // TODO: e2e-runner — page.route()로 업로드 API mock 후 구현
    });

    test('업로드된 파일을 다운로드할 수 있다', async ({ page }) => {
        // TODO: e2e-runner — download 이벤트 대기 후 확인
    });
});
```

- [ ] **Step 6: 커밋**

```bash
git add "C:\it\TEST.md"
git commit -m "docs: TEST.md Task 4에 E2E Playwright 스캐폴드 4개 추가"
```

---

## Task 3: TEST.md — Task 5 섹션 + Verification Loop 업데이트

**Files:**
- Modify: `C:\it\TEST.md`

- [ ] **Step 1: Task 5 섹션 삽입**

`## [검증: Verification Loop]` 바로 앞에 다음 섹션을 삽입한다:

```markdown
## [Task 5: HTML 결과 보고서]

### 에이전트 (순차 실행)

Task 4 완료 후 `e2e-runner` 단독 실행.

| 에이전트 | 담당 |
|---------|------|
| `e2e-runner` | `it_frontend/tests/e2e/generate-report.ts` 작성 및 실행 → HTML 보고서 생성 |

### 입력 소스

| 소스 | 경로 |
|------|------|
| Playwright JSON | `it_frontend/test-results/results.json` |
| Vitest JSON | `it_frontend/coverage/coverage-summary.json` |
| Jacoco XML | `it_backend/build/reports/jacoco/test/jacocoTestReport.xml` |

소스 파일이 없으면 해당 섹션을 "데이터 없음"으로 표시하고 종료하지 않는다.

### 출력

- 경로: `C:\it\docs\test\test-report-YYYY-MM-DD.html`
- 형식: 단일 HTML (외부 CDN 없이 인라인 CSS)
- 내용: 종합 Pass/Fail 대시보드 + FE 커버리지 테이블 + BE 커버리지 테이블 + E2E 결과 테이블

### 실행 명령

```bash
cd it_frontend && npx ts-node tests/e2e/generate-report.ts
```

### 규칙

- 70% 미달 파일/클래스: 빨간 행 강조, 상단 정렬
- `docs/test/` 디렉토리 없으면 자동 생성
- `generate-report.ts`는 `.spec.ts`가 아니므로 Playwright testDir 수집에서 자동 제외됨
```

- [ ] **Step 2: Verification Loop 코드 블록에 보고서 명령 추가**

`### 1단계 — 실질 측정 (Bash)` 코드 블록의 `# E2E 실행` 줄 아래에 추가:

```bash
# HTML 보고서 생성
cd it_frontend && npx ts-node tests/e2e/generate-report.ts
# → C:\it\docs\test\test-report-YYYY-MM-DD.html 생성
```

- [ ] **Step 3: 커밋**

```bash
git add "C:\it\TEST.md"
git commit -m "docs: TEST.md Task 5 HTML 보고서 섹션 + Verification Loop 보고서 명령 추가"
```

---

## Task 4: generate-report.ts 구현

**Files:**
- Create: `it_frontend/tests/e2e/generate-report.ts`

스크립트 구조: `parseVitest` → `parseJacoco` → `parsePlaywright` → `generateHtml` → `main`

- [ ] **Step 1: generate-report.ts 생성**

`it_frontend/tests/e2e/generate-report.ts`를 아래 내용으로 생성한다.

Jacoco XML 파싱은 `String.prototype.matchAll()`을 사용한다 (Node.js child_process 불필요).

```typescript
import * as fs from 'fs';
import * as path from 'path';

// ─── 타입 ─────────────────────────────────────────────────────

interface VitestMetric { pct: number }
interface VitestFileCoverage {
    statements: VitestMetric; branches: VitestMetric;
    functions: VitestMetric;  lines: VitestMetric;
}
interface VitestFile {
    path: string; stmts: number; branch: number; funcs: number; lines: number;
}
interface JacocoClass {
    name: string; branch: number; instruction: number;
    line: number; method: number; complexity: number;
}
interface PlaywrightSpec {
    title: string; suitePath: string;
    status: 'passed' | 'failed' | 'skipped'; duration: number;
}

// ─── 파싱 ─────────────────────────────────────────────────────

function parseVitest(jsonPath: string): VitestFile[] | null {
    if (!fs.existsSync(jsonPath)) return null;
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as Record<string, VitestFileCoverage>;
    return Object.entries(raw)
        .filter(([k]) => k !== 'total')
        .map(([filePath, m]) => ({
            path: filePath,
            stmts: m.statements.pct,
            branch: m.branches.pct,
            funcs: m.functions.pct,
            lines: m.lines.pct,
        }));
}

function calcPct(missed: number, covered: number): number {
    return covered + missed === 0 ? 100 : Math.round((covered / (covered + missed)) * 100);
}

function extractCounter(body: string, type: string): number {
    const pattern = new RegExp(`<counter type="${type}" missed="(\\d+)" covered="(\\d+)"`);
    const found = body.match(pattern);
    return found ? calcPct(parseInt(found[1]), parseInt(found[2])) : 100;
}

function parseJacoco(xmlPath: string): JacocoClass[] | null {
    if (!fs.existsSync(xmlPath)) return null;
    const xml = fs.readFileSync(xmlPath, 'utf-8');
    const pattern = /<class name="([^"]+)"[^>]*>([\s\S]*?)<\/class>/g;
    return Array.from(xml.matchAll(pattern), ([, rawName, body]) => ({
        name: rawName.split('/').pop() ?? rawName,
        branch:      extractCounter(body, 'BRANCH'),
        instruction: extractCounter(body, 'INSTRUCTION'),
        line:        extractCounter(body, 'LINE'),
        method:      extractCounter(body, 'METHOD'),
        complexity:  extractCounter(body, 'COMPLEXITY'),
    }));
}

function collectSpecs(suites: any[], results: PlaywrightSpec[], parent = ''): void {
    for (const suite of suites ?? []) {
        const suitePath = parent ? `${parent} > ${suite.title}` : suite.title;
        for (const spec of suite.specs ?? []) {
            const result = spec.tests?.[0]?.results?.[0];
            const status: PlaywrightSpec['status'] =
                spec.ok ? 'passed' : (result?.status === 'skipped' ? 'skipped' : 'failed');
            results.push({ title: spec.title, suitePath, status, duration: result?.duration ?? 0 });
        }
        collectSpecs(suite.suites ?? [], results, suitePath);
    }
}

function parsePlaywright(jsonPath: string): { specs: PlaywrightSpec[]; totalDuration: number } | null {
    if (!fs.existsSync(jsonPath)) return null;
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    const specs: PlaywrightSpec[] = [];
    collectSpecs(raw.suites ?? [], specs);
    return { specs, totalDuration: raw.stats?.duration ?? 0 };
}

// ─── HTML 생성 ────────────────────────────────────────────────

function pctCell(value: number): string {
    return `<td class="${value < 70 ? 'fail-cell' : 'pass-cell'}">${value.toFixed(1)}%</td>`;
}

function statusBadge(status: PlaywrightSpec['status']): string {
    const cls   = { passed: 'pass', failed: 'fail', skipped: 'skip' }[status];
    const label = { passed: 'PASS', failed: 'FAIL', skipped: 'SKIP' }[status];
    return `<span class="badge ${cls}">${label}</span>`;
}

function resultIcon(ok: boolean | null): string {
    return ok === null ? '⬜' : ok ? '✅' : '❌';
}

function allAbove70(values: number[]): boolean {
    return values.every(v => v >= 70);
}

function generateHtml(
    vitestFiles: VitestFile[] | null,
    jacocoClasses: JacocoClass[] | null,
    playwright: { specs: PlaywrightSpec[]; totalDuration: number } | null,
    generatedAt: string,
): string {
    const feOk = vitestFiles
        ? vitestFiles.every(f => allAbove70([f.stmts, f.branch, f.funcs, f.lines]))
        : null;
    const beOk = jacocoClasses
        ? jacocoClasses.every(c => allAbove70([c.branch, c.instruction, c.line, c.method]))
        : null;
    const e2eOk = playwright
        ? playwright.specs.every(s => s.status !== 'failed')
        : null;
    const overallOk = feOk !== false && beOk !== false && e2eOk !== false;

    const duration = playwright
        ? `${Math.floor(playwright.totalDuration / 60000)}m ${Math.floor((playwright.totalDuration % 60000) / 1000)}s`
        : '-';

    const e2eSummary = playwright
        ? `${playwright.specs.filter(s => s.status === 'passed').length}/${playwright.specs.length} ${resultIcon(e2eOk)}`
        : `${resultIcon(null)} N/A`;

    const feRows = vitestFiles
        ? [...vitestFiles]
            .sort((a, b) =>
                Math.min(a.stmts, a.branch, a.funcs, a.lines) -
                Math.min(b.stmts, b.branch, b.funcs, b.lines))
            .map(f => {
                const fail = !allAbove70([f.stmts, f.branch, f.funcs, f.lines]);
                const label = f.path.replace(/.*?it_frontend[\\/]/, '');
                return `<tr class="${fail ? 'row-fail' : ''}">` +
                    `<td>${label}</td>${pctCell(f.stmts)}${pctCell(f.branch)}${pctCell(f.funcs)}${pctCell(f.lines)}</tr>`;
            }).join('')
        : '<tr><td colspan="5" class="no-data">데이터 없음 — npm run test:coverage 먼저 실행</td></tr>';

    const beRows = jacocoClasses
        ? [...jacocoClasses]
            .sort((a, b) =>
                Math.min(a.branch, a.instruction, a.line, a.method) -
                Math.min(b.branch, b.instruction, b.line, b.method))
            .map(c => {
                const fail = !allAbove70([c.branch, c.instruction, c.line, c.method]);
                return `<tr class="${fail ? 'row-fail' : ''}">` +
                    `<td>${c.name}</td>${pctCell(c.branch)}${pctCell(c.instruction)}` +
                    `${pctCell(c.line)}${pctCell(c.method)}${pctCell(c.complexity)}</tr>`;
            }).join('')
        : '<tr><td colspan="6" class="no-data">데이터 없음 — ./gradlew test jacocoTestReport 먼저 실행</td></tr>';

    const e2eRows = playwright
        ? [...playwright.specs]
            .sort((a, b) => (a.status === 'failed' ? 0 : 1) - (b.status === 'failed' ? 0 : 1))
            .map(s =>
                `<tr class="${s.status === 'failed' ? 'row-fail' : ''}">` +
                `<td>${s.suitePath}</td><td>${s.title}</td>` +
                `<td>${statusBadge(s.status)}</td><td>${(s.duration / 1000).toFixed(1)}s</td></tr>`)
            .join('')
        : '<tr><td colspan="4" class="no-data">데이터 없음 — npm run test:e2e 먼저 실행</td></tr>';

    const css = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b}
.hdr{background:#1e293b;color:#fff;padding:24px 32px}
.hdr h1{font-size:20px;margin-bottom:4px}
.hdr .meta{font-size:13px;color:#94a3b8}
.summary{display:flex;gap:16px;padding:24px 32px}
.card{background:#fff;border-radius:8px;padding:20px 24px;flex:1;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.card .lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.card .val{font-size:26px;font-weight:600}
.section{margin:0 32px 32px;background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden}
.section h2{margin:0;padding:14px 20px;font-size:14px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;color:#475569}
table{width:100%;border-collapse:collapse;font-size:13px}
th{background:#f8fafc;padding:10px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;color:#475569;white-space:nowrap}
td{padding:8px 12px;border-bottom:1px solid #f1f5f9;word-break:break-all}
.row-fail{background:#fef2f2}
.row-fail:hover{background:#fee2e2}
tr:not(.row-fail):hover td{background:#f8fafc}
.pass-cell{color:#16a34a;font-weight:500}
.fail-cell{color:#dc2626;font-weight:600}
.no-data{text-align:center;color:#94a3b8;padding:24px;font-size:12px}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
.badge.pass{background:#dcfce7;color:#16a34a}
.badge.fail{background:#fee2e2;color:#dc2626}
.badge.skip{background:#f1f5f9;color:#64748b}`;

    return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IT Portal 테스트 결과 보고서</title>
<style>${css}</style>
</head>
<body>
<div class="hdr">
  <h1>IT Portal 테스트 결과 보고서</h1>
  <div class="meta">생성: ${generatedAt} | E2E 실행 시간: ${duration}</div>
</div>
<div class="summary">
  <div class="card">
    <div class="lbl">종합 결과</div>
    <div class="val">${overallOk ? '✅ PASS' : '❌ FAIL'}</div>
  </div>
  <div class="card">
    <div class="lbl">FE 커버리지 (70%+)</div>
    <div class="val">${resultIcon(feOk)} ${feOk === null ? 'N/A' : feOk ? 'PASS' : 'FAIL'}</div>
  </div>
  <div class="card">
    <div class="lbl">BE 커버리지 (70%+)</div>
    <div class="val">${resultIcon(beOk)} ${beOk === null ? 'N/A' : beOk ? 'PASS' : 'FAIL'}</div>
  </div>
  <div class="card">
    <div class="lbl">E2E 시나리오</div>
    <div class="val">${e2eSummary}</div>
  </div>
</div>
<div class="section">
  <h2>Frontend 커버리지 (Vitest)</h2>
  <table>
    <thead><tr><th>파일</th><th>Statements</th><th>Branches</th><th>Functions</th><th>Lines</th></tr></thead>
    <tbody>${feRows}</tbody>
  </table>
</div>
<div class="section">
  <h2>Backend 커버리지 (Jacoco)</h2>
  <table>
    <thead><tr><th>클래스</th><th>Branch</th><th>Instruction</th><th>Line</th><th>Method</th><th>Complexity</th></tr></thead>
    <tbody>${beRows}</tbody>
  </table>
</div>
<div class="section">
  <h2>E2E 결과 (Playwright)</h2>
  <table>
    <thead><tr><th>Suite</th><th>시나리오</th><th>결과</th><th>실행 시간</th></tr></thead>
    <tbody>${e2eRows}</tbody>
  </table>
</div>
</body>
</html>`;
}

// ─── 메인 ─────────────────────────────────────────────────────

function main(): void {
    const rootDir = path.resolve(__dirname, '../../..');
    const feDir   = path.join(rootDir, 'it_frontend');

    const vitestPath     = path.join(feDir, 'coverage/coverage-summary.json');
    const playwrightPath = path.join(feDir, 'test-results/results.json');
    const jacocoPath     = path.join(rootDir, 'it_backend/build/reports/jacoco/test/jacocoTestReport.xml');

    const vitestFiles    = parseVitest(vitestPath);
    const jacocoClasses  = parseJacoco(jacocoPath);
    const playwrightData = parsePlaywright(playwrightPath);

    if (!vitestFiles)    console.warn('⚠  Vitest JSON 없음 → FE 섹션 비워짐');
    if (!jacocoClasses)  console.warn('⚠  Jacoco XML 없음 → BE 섹션 비워짐');
    if (!playwrightData) console.warn('⚠  Playwright JSON 없음 → E2E 섹션 비워짐');

    const now         = new Date();
    const dateStr     = now.toISOString().slice(0, 10);
    const generatedAt = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    const outputDir = path.join(rootDir, 'docs/test');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `test-report-${dateStr}.html`);
    const html = generateHtml(vitestFiles, jacocoClasses, playwrightData, generatedAt);
    fs.writeFileSync(outputPath, html, 'utf-8');
    console.log(`✅ 보고서 생성 완료: ${outputPath}`);
}

main();
```

- [ ] **Step 2: 커밋**

```bash
git add it_frontend/tests/e2e/generate-report.ts
git commit -m "feat: generate-report.ts HTML 보고서 생성 스크립트 추가"
```

---

## Task 5: 동작 검증

**Files:**
- Execute: `it_frontend/tests/e2e/generate-report.ts`
- Read: `docs/test/test-report-YYYY-MM-DD.html`

- [ ] **Step 1: 소스 데이터 없이 실행 (smoke test)**

```bash
cd it_frontend && npx ts-node tests/e2e/generate-report.ts
```

Expected (에러 없이 종료):
```
⚠  Vitest JSON 없음 → FE 섹션 비워짐
⚠  Jacoco XML 없음 → BE 섹션 비워짐
⚠  Playwright JSON 없음 → E2E 섹션 비워짐
✅ 보고서 생성 완료: C:\it\docs\test\test-report-YYYY-MM-DD.html
```

- [ ] **Step 2: HTML 파일 존재 확인**

```powershell
Get-ChildItem "C:\it\docs\test\"
```

Expected: `test-report-YYYY-MM-DD.html` 파일 존재.

- [ ] **Step 3: HTML 구조 확인 (브라우저에서 열어 확인)**

1. 상단 요약 카드 4개 표시 (종합/FE/BE/E2E)
2. FE 섹션: "데이터 없음 — npm run test:coverage 먼저 실행"
3. BE 섹션: "데이터 없음 — ./gradlew test jacocoTestReport 먼저 실행"
4. E2E 섹션: "데이터 없음 — npm run test:e2e 먼저 실행"

- [ ] **Step 4: 최종 커밋**

```bash
git add "C:\it\docs\test\"
git commit -m "chore: HTML 보고서 초기 생성본 추가"
```

---

## Self-Review

| 스펙 요구사항 | 구현 Task |
|-------------|---------|
| Task 4 스캐폴드 4개 (budget/documents/access-control/file-upload) | Task 2 Step 2-5 |
| Playwright JSON reporter 추가 | Task 1 Step 1 |
| ts-node 설치 | Task 1 Step 2 |
| Task 5 섹션 TEST.md 추가 | Task 3 Step 1 |
| Verification Loop 보고서 명령 추가 | Task 3 Step 2 |
| Vitest JSON 파싱 | Task 4 (`parseVitest`) |
| Jacoco XML 파싱 (matchAll 정규식) | Task 4 (`parseJacoco` + `extractCounter`) |
| Playwright JSON 파싱 | Task 4 (`parsePlaywright` + `collectSpecs`) |
| HTML 4섹션 (대시보드/FE/BE/E2E) | Task 4 (`generateHtml`) |
| 70% 미달 빨간 행 강조 + 상단 정렬 | Task 4 (`row-fail`, `sort`) |
| docs/test/ 자동 생성 | Task 4 (`mkdirSync`) |
| 소스 없으면 "데이터 없음" + 경고 | Task 4 (`null` 반환 + `console.warn`) |
| docs/test/test-report-YYYY-MM-DD.html | Task 4 (`main`) |
| smoke test 검증 | Task 5 Step 1-3 |

**Placeholder 없음:** 모든 Step에 실행 명령 또는 완전한 코드 포함.

**타입 일관성:** `VitestFile` / `JacocoClass` / `PlaywrightSpec` 타입이 파싱 → generateHtml → HTML 행 생성까지 일관되게 사용됨.
