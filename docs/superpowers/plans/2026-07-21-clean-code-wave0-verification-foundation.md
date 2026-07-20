# Clean Code Wave 0 — 검증 기반 구축 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wave 2 리팩터링의 안전망이 될 JaCoCo 커버리지 게이트(CQ-13), PDF 산출물 구조 회귀 테스트(CQ-04), E2E 핵심 정기 실행 명령(CQ-05)을 구축한다.

**Architecture:** 기존 검증 자산(JaCoCo 70% 검증 태스크, PDF/HWPX/Excel 단위 테스트, E2E 18개 spec)을 새로 만들지 않고 게이트 연결·스냅샷·고정 명령으로 "잠근다". 백엔드는 Gradle `check` 의존성 연결, 프론트는 Vitest 회귀 테스트 1건과 npm script 1건 추가가 전부다.

**Tech Stack:** Gradle(JaCoCo 0.8.13, Java 25 toolchain), Vitest 4(happy-dom), Playwright 1.58

**스펙:** `docs/superpowers/specs/2026-07-21-clean-code-debt-design.md`

---

## 전제/주의 (전 태스크 공통)

- `it_backend`는 **별도 git 저장소**다. 백엔드 변경 커밋은 반드시 `C:\it\it_backend` 안에서 수행한다. 프론트(`it_frontend`)와 문서는 루트 저장소(`C:\it`)에서 커밋한다.
- Gradle 명령은 항상 `cd C:\it\it_backend` 후 실행한다(백그라운드 셸은 cwd를 상속하지 않음). 파일 락(`binary/output.bin`) 오류가 나면 `--no-daemon`을 붙이고 잔여 데몬을 정리한다.
- E2E는 `tests/e2e/helpers/mockApi.ts`의 `page.route()` 전면 모킹 + 모의 SSO 쿠키(`it-portal-user`) 방식이라 **백엔드·로컬 Oracle 없이 실행 가능**하다. TASK.md CQ-05의 "Oracle·인증 데이터 의존성 정리" 전제는 이미 해소된 상태다.
- 작업 시작 전 `git status`(루트와 it_backend 각각)가 이 작업 외 변경으로 오염되어 있지 않은지 확인한다.

---

### Task 1: 현재 커버리지 실측 (CQ-13 사전 측정)

**Files:** 없음 (측정만)

- [ ] **Step 1: 커버리지 검증 실행**

Run: `cd C:\it\it_backend; ./gradlew test jacocoTestCoverageVerification`
Expected: `BUILD SUCCESSFUL` → 현행 코드가 70% 기준 충족(Task 2 Step 3 생략).
`BUILD FAILED` + `Rule violated for ...` 로그가 나오면 **위반 규칙(BUNDLE/CLASS)과 클래스 목록을 기록**해 Task 2 Step 3 분기에 사용한다.

- [ ] **Step 2: 번들 커버리지 수치 기록**

Run: `C:\it\it_backend\build\reports\jacoco\test\html\index.html`을 열어(또는 Read) Total 행의 라인 커버리지 %를 기록.
Expected: 실측 수치 확보 (예: `Total 74%`)

---

### Task 2: 커버리지 검증을 check 게이트에 연결 (CQ-13)

**Files:**
- Modify: `it_backend/build.gradle` — `jacocoTestCoverageVerification` 블록(현재 171~208행)과 그 직후

- [ ] **Step 1: 검증 태스크에 test 의존성 추가**

`jacocoTestCoverageVerification {` 여는 줄 바로 아래에 `dependsOn test`를 추가:

```gradle
jacocoTestCoverageVerification {
	// 실행 데이터(.exec) 확보를 위해 test 이후 실행되도록 보장
	dependsOn test
	afterEvaluate {
```

- [ ] **Step 2: check 게이트 연결**

`jacocoTestCoverageVerification` 블록의 닫는 `}` 다음, `tasks.named('test')` 블록 앞에 추가:

```gradle
// CQ-13: 커버리지 기준을 기본 품질 게이트에 연결 — `check`만 실행해도 자동 검증된다
tasks.named('check') {
	dependsOn jacocoTestCoverageVerification
}
```

- [ ] **Step 3 (Task 1이 FAILED인 경우에만): 시작 임계값 조정**

원칙: 기준을 없애지 않고, 실측 기반 시작값에서 점진 상향한다.

- BUNDLE(전역) 규칙 위반 시 — 첫 번째 `rule`의 `minimum = 0.70`을 실측치에서 0.05 단위로 내림한 값으로 바꾸고 주석을 남긴다:

```gradle
			limit {
				// 시작 임계값: 2026-07-21 실측 기준(목표 0.70으로 점진 상향, TASK.md CQ-13 추적)
				counter = 'LINE'
				value   = 'COVEREDRATIO'
				minimum = 0.65
			}
```

- CLASS 규칙 위반 시 — 위반 클래스를 해당 rule에 명시적으로 제외하고, 제외 목록을 TASK.md CQ-13 행의 근거/조건에 그대로 기록한다:

```gradle
		rule {
			element = 'CLASS'
			// 시작 제외: 2026-07-21 기준 커버리지 미달 클래스 — 점진 해소 대상 (TASK.md CQ-13)
			excludes = [
				'com.kdb.it.<위반 클래스 FQCN을 Task 1 기록에서 그대로 옮김>',
			]
```

- [ ] **Step 4: 게이트 동작 확인**

Run: `cd C:\it\it_backend; ./gradlew check`
Expected: 출력에 `:jacocoTestCoverageVerification` 실행이 포함되고 `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit (it_backend 저장소)**

```bash
cd C:\it\it_backend
git add build.gradle
git commit -m "chore: JaCoCo 커버리지 검증을 check 게이트에 연결"
```

---

### Task 3: PDF docDefinition 구조 회귀 테스트 (CQ-04)

기존 `tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`는 생성 "흐름"을 검증한다. 이 태스크는 **생성된 문서의 내용(텍스트·구조)**을 스냅샷으로 고정해, Wave 2에서 `useItBudgetApprovalFormPdf.ts`(1,288줄)를 분해할 때 전후 동일성을 판별하는 기준을 만든다.

**Files:**
- Create: `it_frontend/tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.regression.test.ts`
- 참고(수정 없음): 기존 테스트 `useItBudgetApprovalFormPdf.test.ts` — 모킹 블록(14~43행)과 픽스처가 있으면 **그대로 재사용**하고 아래 코드의 모킹·픽스처를 대체한다.

- [ ] **Step 1: 회귀 테스트 작성**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProjectDetail } from '~/composables/useProjects';
import type { ItCost } from '~/composables/useCost';
import type { ApprovalLine } from '~/types/approvalForm';

/**
 * CQ-04: PDF 산출물 구조 회귀 기준.
 * pdfMake.createPdf에 전달되는 docDefinition을 캡처해
 * 텍스트 추출 결과를 스냅샷으로 고정한다.
 * useItBudgetApprovalFormPdf.ts 분해(Wave 2, CQ-02) 전후에
 * 이 스냅샷이 달라지면 동작이 변한 것이다.
 */
const captured: { docDef: unknown } = { docDef: null };

vi.mock('pdfmake/build/pdfmake', () => ({
    default: {
        createPdf: vi.fn((docDef: unknown) => {
            captured.docDef = docDef;
            return { getBlob: (cb: (b: Blob) => void) => cb(new Blob(['pdf'])) };
        }),
        addVirtualFileSystem: vi.fn(),
        addFonts: vi.fn(),
        vfs: {},
        fonts: {},
    },
}));
vi.mock('pdfmake/build/vfs_fonts', () => ({ default: {} }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }));

// 폰트 fetch 실패 → Roboto 폴백 경로로 고정(결정적 실행)
vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('font fetch disabled in test'))));

/** docDefinition 트리에서 모든 텍스트 노드를 순서대로 추출 */
function extractTexts(node: unknown): string[] {
    if (node == null) return [];
    if (typeof node === 'string') return node === '' ? [] : [node];
    if (typeof node === 'number') return [String(node)];
    if (Array.isArray(node)) return node.flatMap(extractTexts);
    if (typeof node === 'object') {
        const o = node as Record<string, unknown>;
        const table = o.table as Record<string, unknown> | undefined;
        return [
            ...extractTexts(o.text),
            ...extractTexts(o.content),
            ...extractTexts(o.stack),
            ...extractTexts(o.columns),
            ...extractTexts(table?.body),
        ];
    }
    return [];
}

/** 고정 픽스처 — 기존 useItBudgetApprovalFormPdf.test.ts에 픽스처가 있으면 그것을 재사용 */
const fixtureProjects = [
    {
        abusMngNo: 'A2026-001',
        abusNm: '차세대 IT포탈 고도화',
        svnDpmC: 'D001',
        bseYy: '2026',
    },
] as unknown as ProjectDetail[];

const fixtureApprovalLine = {
    drafterName: '홍길동',
    drafterDate: '2026-07-21',
} as unknown as ApprovalLine;

const fixtureCosts = [] as ItCost[];

describe('useItBudgetApprovalFormPdf 구조 회귀 (CQ-04)', () => {
    beforeEach(() => {
        captured.docDef = null;
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    });

    it('고정 픽스처의 docDefinition 텍스트 추출 결과가 스냅샷과 일치한다', async () => {
        // Arrange
        const { useItBudgetApprovalFormPdf } = await import(
            '~/features/approval/forms/itBudget/useItBudgetApprovalFormPdf'
        );
        const { generateReport } = useItBudgetApprovalFormPdf();

        // Act
        await generateReport(fixtureProjects, fixtureApprovalLine, fixtureCosts, {});

        // Assert
        expect(captured.docDef).not.toBeNull();
        expect(extractTexts(captured.docDef)).toMatchSnapshot();
    });

    it('문서 구조 불변식: 스타일 정의와 본문이 존재한다', async () => {
        // Arrange
        const { useItBudgetApprovalFormPdf } = await import(
            '~/features/approval/forms/itBudget/useItBudgetApprovalFormPdf'
        );
        const { generateReport } = useItBudgetApprovalFormPdf();

        // Act
        await generateReport(fixtureProjects, fixtureApprovalLine, fixtureCosts, {});

        // Assert
        const docDef = captured.docDef as Record<string, unknown>;
        expect(Array.isArray(docDef.content)).toBe(true);
        expect((docDef.content as unknown[]).length).toBeGreaterThan(0);
        expect(docDef.styles).toBeDefined();
    });
});
```

주의: `generateReport` 시그니처는 `(projects, approvalLine, costs = [], options)`다(원본 195행). 픽스처 필드가 실제 타입과 어긋나 렌더 내용이 빈약해도 무방하다 — 회귀 기준은 "같은 입력 → 같은 출력"의 고정이지 완전한 데이터가 아니다. 단, 픽스처는 이 파일에 하드코딩해 절대 변하지 않게 한다.

- [ ] **Step 2: 첫 실행으로 스냅샷 생성**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.regression.test.ts`
Expected: PASS, `1 snapshot written` — `__snapshots__/useItBudgetApprovalFormPdf.regression.test.ts.snap` 생성

- [ ] **Step 3: 재실행으로 스냅샷 고정 확인**

Run: 같은 명령 재실행
Expected: PASS, `1 snapshot passed` (written 아님)

- [ ] **Step 4: 스냅샷 내용 검수**

생성된 `.snap` 파일을 Read로 열어 텍스트 배열이 비어있지 않고 제목·헤더 문자열이 포함됐는지 확인한다. 텍스트가 0~2개뿐이면 픽스처 필드가 실제 타입과 어긋난 것이므로 기존 테스트의 픽스처를 가져와 보강한 뒤 Step 2부터 재수행.
Expected: 스냅샷에 문서 제목/결재선/표 헤더 등 의미 있는 문자열 존재

- [ ] **Step 5: HWPX/Excel 기존 기준선 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/utils/hwpx.test.ts tests/unit/utils/hwpx-images.test.ts tests/unit/utils/hwpx-package-xml.test.ts tests/unit/utils/excel.test.ts tests/unit/composables/useHwpxExport.direct.test.ts`
Expected: 전부 PASS — HWPX/Excel은 기존 테스트가 이미 회귀 기준 역할을 하므로 추가 작성 없음(이 확인으로 CQ-04의 HWPX/Excel 범위 종결)

- [ ] **Step 6: Commit (루트 저장소)**

```bash
cd C:\it
git add it_frontend/tests/unit/features/approval/forms/itBudget/
git commit -m "test: IT예산 결재 PDF docDefinition 구조 회귀 스냅샷 추가 (CQ-04)"
```

---

### Task 4: E2E 핵심 3시나리오 고정 명령 (CQ-05)

로그인(`auth.spec.ts`), 프로젝트 조회/생성(`projects.spec.ts`), 결재 처리(`approval.spec.ts`)는 이미 존재한다. 이를 단일 명령으로 묶고 절차를 문서화한다.

**Files:**
- Modify: `it_frontend/package.json` — scripts 블록(5~23행)
- Modify: `it_frontend/README.md` — 테스트 절(없으면 신설)

- [ ] **Step 1: npm script 추가**

`"test:e2e": "playwright test",` 라인 아래에 추가:

```json
"test:e2e:core": "playwright test tests/e2e/auth.spec.ts tests/e2e/projects.spec.ts tests/e2e/approval.spec.ts",
```

- [ ] **Step 2: 명령 실행 검증**

Run: `cd C:\it\it_frontend; npm run test:e2e:core`
Expected: 3개 spec의 전체 테스트 PASS. Playwright webServer가 `npx nuxt dev --port 3002`를 자동 기동하므로 별도 서버 준비 불필요. 3002 포트가 이미 사용 중이면 기존 서버를 재사용한다(`reuseExistingServer`).

- [ ] **Step 3: 실행 절차 문서화**

`it_frontend/README.md`에 아래 절을 추가한다(기존 테스트 절이 있으면 그 하위에). 코드펜스는 실제 파일에서 일반 ``` 로 작성한다:

> ## 핵심 E2E 정기 실행
>
> 배포 전(운영 `npm run generate` 직전)과 주요 화면 리팩터링 후에는 핵심 3시나리오 E2E를 실행한다.
>
>     npm run test:e2e:core
>
> - 대상: 로그인(`auth.spec.ts`), 프로젝트 조회/생성(`projects.spec.ts`), 결재 처리(`approval.spec.ts`)
> - 사전조건 없음: API는 `tests/e2e/helpers/mockApi.ts`로 전면 모킹되고 인증은 테스트용 쿠키 주입 방식이라 백엔드·로컬 Oracle 기동이 필요 없다. dev 서버(3002)는 Playwright가 자동 기동한다.
> - 전체 E2E는 `npm run test:e2e`, 결과 리포트는 `npm run generate-report`.

- [ ] **Step 4: Commit (루트 저장소)**

```bash
cd C:\it
git add it_frontend/package.json it_frontend/README.md
git commit -m "test: E2E 핵심 3시나리오 정기 실행 명령 test:e2e:core 고정 (CQ-05)"
```

---

### Task 5: Wave 0 종료 처리 (TASK.md 현행화)

**Files:**
- Modify: `TASK.md` — [Clean Code 부채] 표의 CQ-04, CQ-05, CQ-13 행
- Modify: `TASK_DONE.md` — 완료 근거 기록

- [ ] **Step 1: 전체 검증 일괄 실행**

Run:
```bash
cd C:\it\it_frontend && npm run check && npm test
cd C:\it\it_backend && ./gradlew check
```
Expected: 모두 성공. (`npm run format:check`는 기존 드리프트 FE-03(33개 파일)으로 실패할 수 있으므로 이번 변경 파일이 위반 목록에 없는 것만 확인한다.)

- [ ] **Step 2: TASK.md 행 갱신**

CQ-04, CQ-05, CQ-13 행의 우선순위를 `✅ Done`으로 바꾸고 근거/조건을 완료 근거로 교체:
- CQ-04: `2026-07-21 PDF docDefinition 구조 스냅샷 회귀 테스트 추가(useItBudgetApprovalFormPdf.regression.test.ts). HWPX/Excel은 기존 단위 테스트가 기준선 역할 확인`
- CQ-05: `2026-07-21 test:e2e:core 명령 고정(로그인·프로젝트·결재 3개 spec). API 모킹 기반이라 Oracle·백엔드 불필요, 절차는 it_frontend/README.md`
- CQ-13: `2026-07-21 check → jacocoTestCoverageVerification 의존성 연결` (Task 2 Step 3을 수행했다면 조정한 임계값·제외 클래스 목록도 함께 기록)

- [ ] **Step 3: TASK_DONE.md에 이관 기록 추가**

기존 형식(날짜 절 + 항목별 근거)을 따라 `2026-07-21 Clean Code Wave 0` 절을 추가하고 위 세 항목의 완료 근거와 커밋 해시를 기록한다.

- [ ] **Step 4: Commit (루트 저장소)**

```bash
cd C:\it
git add TASK.md TASK_DONE.md
git commit -m "docs: Clean Code Wave 0 완료 이관 (CQ-04, CQ-05, CQ-13)"
```
