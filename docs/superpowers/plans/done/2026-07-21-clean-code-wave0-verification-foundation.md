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
- Conditional Modify: 커버리지 미달 클래스의 기존 테스트 — Task 1에서 확인된 위반 지표를 70%까지 보강할 때만 수정

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

- [ ] **Step 3 (Task 1이 FAILED인 경우에만): 미달 지표 보강 또는 임시 기준선 설정**

원칙: 알려진 미달 클래스를 CLASS 규칙에서 통째로 제외하지 않는다. 먼저 위반 분기를 직접 테스트해 70%를 충족하고, 당장 보강할 수 없는 경우에만 해당 클래스·지표에 한정한 임시 규칙을 둔다.

2026-07-21 사전 진단 기준으로 번들 라인은 96%이며 아래 CLASS 위반만 확인됐다. 실행 시 Task 1 결과로 반드시 최신화한다.

- `com.kdb.it.domain.council.service.FeasibilityService`: BRANCH 0.50, COMPLEXITY 0.58
- `com.kdb.it.common.system.service.AuthService`: COMPLEXITY 0.69

우선순위:

1. 위반 클래스의 기존 테스트에 누락 분기·예외 경로를 추가해 모든 CLASS 지표를 0.70 이상으로 만든다.
2. 테스트 보강이 이번 Wave 범위를 넘어가면 일반 CLASS 0.70 규칙에서는 해당 클래스만 제외하고, 같은 클래스에 대한 전용 `includes` 규칙을 추가한다. 전용 규칙에는 LINE과 이미 0.70 이상인 지표는 0.70을 유지하고, 미달 지표만 Task 1 실측값을 소수점 둘째 자리에서 내림한 값으로 설정한다.
3. 임시 규칙마다 날짜·실측값·목표 0.70·TASK.md 추적 번호를 주석으로 남긴다. 임시 규칙이 하나라도 남으면 CQ-13을 Done 처리하지 않는다.

BUNDLE(전역) 규칙까지 위반한 경우에만 첫 번째 `rule`의 `minimum = 0.70`을 실측치에서 0.05 단위로 내림한 값으로 바꾼다:

```gradle
			limit {
				// 시작 임계값: 2026-07-21 실측 기준(목표 0.70으로 점진 상향, TASK.md CQ-13 추적)
				counter = 'LINE'
				value   = 'COVEREDRATIO'
				minimum = 0.65
			}
```

- CLASS 임시 규칙 예시(수치는 Task 1 실측으로 교체):

```gradle
		rule {
			element = 'CLASS'
			// 임시 예외 클래스는 아래 전용 규칙에서 별도 기준으로 계속 검증한다
			excludes = [
				'com.kdb.it.domain.council.service.FeasibilityService',
			]
			// 기존 LINE/BRANCH/COMPLEXITY 0.70 limit 유지
		}
		rule {
			element = 'CLASS'
			includes = ['com.kdb.it.domain.council.service.FeasibilityService']
			limit {
				counter = 'LINE'
				value = 'COVEREDRATIO'
				minimum = 0.70
			}
			limit {
				// 임시 기준: 2026-07-21 실측 0.50, 목표 0.70 (TASK.md CQ-13)
				counter = 'BRANCH'
				value = 'COVEREDRATIO'
				minimum = 0.50
			}
			limit {
				// 임시 기준: 2026-07-21 실측 0.58, 목표 0.70 (TASK.md CQ-13)
				counter = 'COMPLEXITY'
				value = 'COVEREDRATIO'
				minimum = 0.58
			}
		}
```

`AuthService`에도 같은 방식의 전용 규칙을 추가하되 LINE/BRANCH는 0.70을 유지하고 COMPLEXITY만 최신 실측값으로 설정한다. 클래스 전체를 검증 대상에서 사라지게 하는 `excludes`만 추가하고 끝내면 안 된다.

- [ ] **Step 4: 게이트 동작 확인**

Run: `cd C:\it\it_backend; ./gradlew check`
Expected: 출력에 `:jacocoTestCoverageVerification` 실행이 포함되고 `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit (it_backend 저장소)**

```bash
cd C:\it\it_backend
git add build.gradle
# Step 3에서 테스트를 보강했다면 실제로 수정한 파일만 함께 스테이징
git add src/test/java/com/kdb/it/domain/council/service/FeasibilityServiceTest.java src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java
git commit -m "chore: JaCoCo 커버리지 검증을 check 게이트에 연결"
```

두 테스트 중 수정하지 않은 파일은 `git add` 대상에서 빼고 실행한다.

---

### Task 3: PDF docDefinition 구조 회귀 테스트 (CQ-04)

기존 `tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`는 올바른 프로젝트·비용·결재선 픽스처와 pdfmake 0.3 Promise형 `getBlob()` mock을 이미 갖고 있다. 별도 테스트 파일에 mock과 픽스처를 복제하지 않고 기존 파일에 **정규화된 docDefinition 구조 스냅샷**을 추가해, Wave 2에서 `useItBudgetApprovalFormPdf.ts`(1,288줄)를 분해할 때 전후 동일성을 판별한다.

**Files:**
- Modify: `it_frontend/tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`
- Create: `it_frontend/tests/unit/features/approval/forms/itBudget/__snapshots__/useItBudgetApprovalFormPdf.test.ts.snap` (첫 실행에서 Vitest가 생성)

- [ ] **Step 1: 회귀 테스트 작성**

기존 mock과 `project`/`cost`/`approvalLine` 픽스처는 수정하지 않는다. 특히 현재 구현은 `await pdfGenerator.getBlob()`을 사용하므로 콜백형 mock을 새로 만들지 말고 기존 `mocks.getBlob.mockResolvedValue(...)`를 그대로 사용한다.

describe 블록 앞에 다음 정규화 헬퍼를 추가한다. 함수는 고정 문자열로 바꿔 스냅샷을 결정적으로 만들고, 객체 키를 정렬하되 `content`, 표 body/widths, `colSpan`/`rowSpan`, 스타일 값, `pageBreak`, footer/layout 존재 등 문서 구조는 보존한다.

```ts
/**
 * pdfmake 문서 정의를 결정적인 스냅샷 값으로 정규화한다.
 * 함수 구현은 직렬화하지 않되 함수가 존재한다는 구조 정보는 보존한다.
 */
function normalizePdfNode(node: unknown): unknown {
    if (typeof node === 'function') return '[Function]';
    if (node == null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(normalizePdfNode);

    return Object.fromEntries(
        Object.entries(node as Record<string, unknown>)
            .filter(([, value]) => value !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, value]) => [key, normalizePdfNode(value)]),
    );
}
```

기존 describe 마지막에 다음 테스트를 추가한다:

```ts
it('고정 픽스처의 docDefinition 구조와 표시값이 스냅샷과 일치한다 (CQ-04)', async () => {
    // 준비
    const { generateReport } = usePdfReport();

    // 실행
    await generateReport([project as any], approvalLine, [cost as any]);

    // 검증
    const docDefinition = mocks.createPdf.mock.calls[0][0];
    const normalized = normalizePdfNode(docDefinition);
    const serialized = JSON.stringify(normalized);
    expect(serialized).toContain('정보화사업');
    expect(serialized).toContain('공급사');
    expect(serialized).toContain('기안자');
    expect(normalized).toMatchSnapshot();
});
```

테스트 코드의 기존 `any`는 테스트용 부분 픽스처에 한해 ESLint 설정에서 허용된다. 프로덕션 `any` 제거 범위와 혼동하지 않는다.

- [ ] **Step 2: 첫 실행으로 스냅샷 생성**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`
Expected: PASS, `1 snapshot written` — `__snapshots__/useItBudgetApprovalFormPdf.test.ts.snap` 생성

- [ ] **Step 3: 재실행으로 스냅샷 고정 확인**

Run: 같은 명령 재실행
Expected: PASS, `1 snapshot passed` (written 아님)

- [ ] **Step 4: 스냅샷 내용 검수**

생성된 `.snap` 파일을 열어 다음을 검수한다.

- 프로젝트·비용·결재선의 고정 값(`정보화사업`, `공급사`, `기안자`)이 들어 있다.
- `content`, `table.body`, `widths`, `colSpan`/`rowSpan`, `styles`, `defaultStyle`, `pageBreak`가 실제 생성 결과에 존재하는 범위에서 보존된다.
- footer와 table layout 함수는 `[Function]`으로 남아 구조적 존재가 확인된다. 구체 콜백 반환값은 기존 테스트의 footer/layout 검증이 계속 담당한다.

Expected: 단순 텍스트 목록이 아니라 문서 구조와 표시값을 함께 고정한 스냅샷

- [ ] **Step 5: HWPX/Excel 기존 기준선 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/utils/hwpx.test.ts tests/unit/utils/hwpx-images.test.ts tests/unit/utils/hwpx-package-xml.test.ts tests/unit/utils/excel.test.ts tests/unit/composables/useHwpxExport.direct.test.ts`
Expected: 전부 PASS — HWPX/Excel은 기존 테스트가 이미 회귀 기준 역할을 하므로 추가 작성 없음(이 확인으로 CQ-04의 HWPX/Excel 범위 종결)

- [ ] **Step 6: Commit (루트 저장소)**

```bash
cd C:\it
git add it_frontend/tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts it_frontend/tests/unit/features/approval/forms/itBudget/__snapshots__/
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

CQ-04와 CQ-05 행의 우선순위를 `✅ Done`으로 바꾸고 근거/조건을 완료 근거로 교체한다. CQ-13은 임시 커버리지 규칙 유무에 따라 분기한다.

- CQ-04: `2026-07-21 기존 useItBudgetApprovalFormPdf.test.ts에 PDF docDefinition 정규화 구조 스냅샷 추가. 고정 표시값·표 구조·스타일·페이지 구분을 검증하고 HWPX/Excel은 기존 단위 테스트가 기준선 역할 확인`
- CQ-05: `2026-07-21 test:e2e:core 명령 고정(로그인·프로젝트·결재 3개 spec). API 모킹 기반이라 Oracle·백엔드 불필요, 절차는 it_frontend/README.md`
- CQ-13:
  - 모든 BUNDLE/CLASS 기준이 0.70이면 `✅ Done`: `2026-07-21 check → jacocoTestCoverageVerification 의존성 연결, BUNDLE/CLASS 70% 검증 통과`
  - 임시 전용 규칙이 남으면 기존 우선순위를 유지: `2026-07-21 check 게이트 연결 완료. 임시 기준 클래스·지표·현재값·목표 0.70을 명시하고 테스트 보강 후 예외 제거 필요`

- [ ] **Step 3: TASK_DONE.md에 이관 기록 추가**

기존 형식(날짜 절 + 항목별 근거)을 따라 `2026-07-21 Clean Code Wave 0` 절을 추가하고 완료된 항목의 근거와 커밋 해시를 기록한다. CQ-13에 임시 규칙이 남은 경우 TASK_DONE.md로 이관하지 않는다.

- [ ] **Step 4: Commit (루트 저장소)**

```bash
cd C:\it
git add TASK.md TASK_DONE.md
git commit -m "docs: Clean Code Wave 0 완료 이관 (CQ-04, CQ-05, CQ-13)"
```

위 메시지는 CQ-13까지 70% 기준을 충족한 경우에만 사용한다. 임시 커버리지 규칙이 남으면 `docs: Clean Code Wave 0 완료 이관 (CQ-04, CQ-05) 및 CQ-13 현황 갱신`으로 커밋한다.
