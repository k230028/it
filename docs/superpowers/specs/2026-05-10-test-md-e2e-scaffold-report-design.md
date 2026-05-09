# TEST.md 개선 — E2E 스캐폴드 + HTML 결과 보고서 (Task 5)

**날짜:** 2026-05-10  
**목적:** TEST.md Task 4에 Playwright 스캐폴드 코드를 추가하고, Task 5를 신설하여 커버리지·E2E 결과를 단일 HTML 파일로 출력하는 Node.js 스크립트를 구현한다.

---

## 1. 배경

### 현재 상태 (AS-IS)

- Task 4는 `e2e-runner` / `qa-lead` 에이전트 지시만 있고, 에이전트가 참고할 코드 틀이 없어 구현 방향이 불명확하다.
- 기존 E2E 파일 4개(auth / projects / cost / approval)는 존재하지만 설계 문서에 명시된 핵심 플로우(사전협의 작성, 예산 결재 상신)가 빠져 있다.
- 전체 테스트 결과(FE 커버리지 + BE 커버리지 + E2E)를 한 곳에서 확인하는 수단이 없다.

### 목표 상태 (TO-BE)

- Task 4: 누락 시나리오별 파일명·describe/test 구조를 인라인 스캐폴드로 명시 → 에이전트가 구현만 채운다.
- Task 5: `generate-report.ts` 스크립트로 Playwright JSON + Vitest JSON + Jacoco XML을 파싱하여 단일 HTML 보고서를 생성한다.

---

## 2. Task 4 변경 — E2E 스캐폴드

### 2.1 기존 파일 (완성도 확인·개선 대상)

| 파일 | 현재 커버 시나리오 |
|------|----------------|
| `tests/e2e/auth.spec.ts` | 로그인 성공/실패 |
| `tests/e2e/projects.spec.ts` | 프로젝트 목록·상태 태그 |
| `tests/e2e/cost.spec.ts` | 전산업무비 목록 |
| `tests/e2e/approval.spec.ts` | 전자결재 목록·상태 태그 |

### 2.2 신규 스캐폴드 파일 (e2e-runner가 구현 채움)

| 파일 | 시나리오 | 비고 |
|------|---------|------|
| `tests/e2e/budget.spec.ts` | 예산작성 → 경상사업 → 결재 상신 플로우 | 설계 시나리오 2번 |
| `tests/e2e/documents.spec.ts` | 사전협의 신규 작성 → 저장 → 목록/상세 확인 | 설계 시나리오 1번 |
| `tests/e2e/access-control.spec.ts` | 비관리자 `/admin/**` 접근 시 `/` 리다이렉트 확인 | ROLE 접근 제어 |
| `tests/e2e/file-upload.spec.ts` | 첨부파일 업로드·다운로드 플로우 | page.route() mock 허용 |

### 2.3 스캐폴드 코드 (TEST.md 인라인 삽입)

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
        // TODO: e2e-runner — /admin 접근 후 리다이렉트 확인
    });

    test('관리자는 /admin에 정상 접근한다', async ({ page }) => {
        await setLoggedIn(page, {
            eno: 'E000', empNm: '관리자',
            athIds: ['ITPAD001'], bbrC: 'D001', temC: 'T001'
        });
        // TODO: e2e-runner — 구현
    });
});
```

```typescript
// [스캐폴드] tests/e2e/file-upload.spec.ts
import { test, expect } from '@playwright/test';
import { mockApi, mockCommonApis, setLoggedIn } from './helpers/mockApi';

test.describe('파일 업로드·다운로드', () => {
    test.beforeEach(async ({ page }) => {
        await setLoggedIn(page);
        await mockCommonApis(page);
    });

    test('파일을 업로드하면 목록에 표시된다', async ({ page }) => {
        // TODO: e2e-runner — page.route()로 업로드 API mock 후 구현
    });

    test('업로드된 파일을 다운로드할 수 있다', async ({ page }) => {
        // TODO: e2e-runner — 구현
    });
});
```

---

## 3. Task 5 신설 — HTML 결과 보고서

### 3.1 에이전트

`e2e-runner` 단독 실행 (Task 4 완료 후 순차 실행).

### 3.2 스크립트

| 항목 | 내용 |
|------|------|
| 파일 경로 | `it_frontend/tests/e2e/generate-report.ts` |
| 실행 명령 | `cd it_frontend && npx ts-node tests/e2e/generate-report.ts` |
| 의존성 | `ts-node` (없으면 `npm i -D ts-node` 추가) |

### 3.3 입력 소스

| 소스 | 경로 | 파싱 대상 |
|------|------|---------|
| Playwright JSON | `it_frontend/test-results/results.json` | 시나리오별 pass/fail/skip, 실행 시간 |
| Vitest JSON | `it_frontend/coverage/coverage-summary.json` | 파일별 statements/branches/functions/lines |
| Jacoco XML | `it_backend/build/reports/jacoco/test/jacocoTestReport.xml` | 클래스별 branch/instruction/line/method/class/complexity |

소스 파일이 없으면 스크립트는 에러를 출력하고 해당 섹션을 "데이터 없음"으로 표시한다.

### 3.4 출력

| 항목 | 내용 |
|------|------|
| 경로 | `C:\it\docs\test\test-report-YYYY-MM-DD.html` |
| 형식 | 단일 HTML (외부 CDN 없이 인라인 CSS/JS) |

### 3.5 HTML 구성

```
┌─────────────────────────────────────────────────────────┐
│  IT Portal 테스트 결과 보고서                              │
│  생성: YYYY-MM-DD HH:mm  |  총 실행 시간: Xm Xs           │
├──────────┬──────────────┬──────────────┬──────────────  │
│ 종합 결과 │  FE 커버리지  │  BE 커버리지  │  E2E          │
│  ✅/❌   │  ✅/❌ 70%+  │  ✅/❌ 70%+  │  N/M 성공      │
├──────────┴──────────────┴──────────────┴──────────────  │
│ [1] Frontend 커버리지 (파일별 Vitest 4지표 테이블)          │
│     파일명 | Stmts | Branch | Funcs | Lines | 상태       │
│     ── 70% 미달 파일 상단 정렬, 빨간 행 강조 ──            │
├─────────────────────────────────────────────────────────┤
│ [2] Backend 커버리지 (클래스별 Jacoco 6지표 테이블)          │
│     클래스명 | Branch | Instr | Line | Method | 상태     │
├─────────────────────────────────────────────────────────┤
│ [3] E2E 결과 (시나리오별 pass/fail/skip 행 + 실행 시간)     │
└─────────────────────────────────────────────────────────┘
```

**종합 결과 판정:** FE 전체 70%+ AND BE 전체 70%+ AND E2E 100% 모두 충족 시 ✅, 하나라도 미달 시 ❌

**강조 규칙:**
- 70% 미달 파일/클래스: 빨간 행(`background: #fee2e2`), 상단 정렬
- E2E 실패 시나리오: 빨간 행

### 3.6 Jacoco XML 파싱 전략

Node.js 내장 `DOMParser` 미지원 → `xml2js` 패키지 사용. 없으면 정규식 fallback.

```
jacocoTestReport.xml 구조:
<report>
  <package name="...">
    <class name="...">
      <counter type="BRANCH" missed="N" covered="M"/>
      <counter type="LINE" missed="N" covered="M"/>
      ...
    </class>
  </package>
</report>
```

파싱 후 `covered / (covered + missed) * 100`으로 비율 계산.

### 3.7 Verification Loop 추가 명령

```bash
# HTML 보고서 생성 (Verification Loop 마지막 단계에 추가)
cd it_frontend && npx ts-node tests/e2e/generate-report.ts
# → C:\it\docs\test\test-report-YYYY-MM-DD.html 생성
```

---

## 4. TEST.md 최종 구조 (변경 후)

| Task | 변경 사항 |
|------|---------|
| Task 1 | 변경 없음 |
| Task 2 | 변경 없음 |
| Task 3 | 변경 없음 |
| Task 4 | **스캐폴드 코드 블록 4개 추가** (budget / documents / access-control / file-upload) |
| Task 5 | **신설** — `e2e-runner`가 `generate-report.ts` 작성 및 HTML 보고서 생성 |
| Verification Loop | **보고서 생성 명령 추가** |

---

## 5. 구현 시 주의사항

- `generate-report.ts`는 파일 IO와 문자열 템플릿만 사용. `ts-node` + `xml2js` 외 추가 패키지 금지.
- 보고서 디렉토리 `docs/test/`가 없으면 스크립트가 자동 생성(`fs.mkdirSync`).
- 비즈니스 로직(기존 소스 코드)은 절대 수정하지 않는다.
- `generate-report.ts` 자체는 E2E 테스트 파일이 아니므로 `playwright.config.ts` testMatch 패턴에 걸리지 않도록 경로 확인 필요.
