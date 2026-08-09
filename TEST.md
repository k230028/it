## 기본 지침
 - 이 작업은 새로운 테스트 코드를 작성하고, 기존 테스트 코드를 개선하는 작업이다.
 - 이 작업은 속도보다는 정확도가 중요한 작업이다.
 - 모든 계획과 실행(cli 명령어 포함)에 대해 확인받지 않고 작업을 진행한다.
 - 모든 문서 작업은 기존의 파일 인코딩(UTF-8)을 유지한다.
 - 전체 프로젝트, CLAUDE.md(코드 컨벤션), README.md(개발노트)를 충분히 숙지하여 테스트 코드를 작성한다.
 - **비즈니스 로직(코드 자체)은 절대 수정하지 않는다.**
 - Persona: 프로젝트의 테스트 코드를 작성 및 개선하는 Senior Software Engineer
 - Reference: 최우선 순위는 루트 CLAUDE.md → it_backend/CLAUDE.md → it_frontend/CLAUDE.md

## 서브에이전트 표기 규약
 - 아래 표의 역할 이름(`java-reviewer`, `tdd-guide`, `e2e-runner`, `qa-lead` 등)은 **전용 에이전트 정의가 아니라 범용 서브에이전트에 부여하는 역할 지시**다. 프로젝트에는 `.claude/agents/` 정의를 두지 않는다.
 - 병렬 역할은 `/superpowers:dispatching-parallel-agents` 절차로 띄우고, 담당 범위·출력 형식을 프롬프트에 명시한다.
 - 테스트 작성 절차는 `/superpowers:test-driven-development`를, 완료 선언 전 검증은 `/superpowers:verification-before-completion`을 따른다.
 - 프레임워크 기준은 `.claude/skills/`의 참조 스킬(CLAUDE.md §5.4)에서 로드한다 — BE는 `/springboot-tdd`·`/springboot-verification`, FE는 `/nuxt4-patterns`·`/vue-patterns`.
 - 단, 스킬 예시와 본 프로젝트가 다른 지점은 프로젝트 기준을 따른다. `/springboot-tdd`의 Testcontainers 대신 실제 Oracle 검증은 `./gradlew integrationTest`로 분리하고, `/springboot-verification`의 명령 예시 대신 CLAUDE.md §6 Health Stack 명령을 쓴다.
 - 브라우저 실검증은 Playwright MCP로 수행한다(두 서버 기동 전제).

## 대상 디렉토리
 - 백엔드 : it_backend\src\test
 - 프론트 : it_frontend\tests

## 목표
 - Vitest 커버리지 : 각 파일별 모든 지표 70% 이상
  1) Statements > 70%
  2) Branches > 70%
  3) Functions > 70%
  4) Lines > 70%
 - JUnit(Jacoco) 커버리지 : 각 파일별 모든 지표 70% 이상
  1) Branches > 70%
  2) Instructions > 70%
  3) Cyclomatic Complexity > 70%
  4) Lines > 70%
  5) Methods > 70%
  6) Classes > 70%
 - E2E 테스트 : 기존 시나리오 100% 성공 (+ 누락 시나리오 발굴·추가)

---

## [Task 1: Coverage Gap Analysis]

### 서브에이전트 역할 (병렬 실행)
다음 3개 역할을 병렬 서브에이전트로 실행하여 갭 파일 목록을 생성한다.

| 역할 | 담당 범위 | 출력 |
|---------|---------|------|
| `java-reviewer` | `it_backend` 전체 `.java` | 클래스별 Jacoco 기준 70% 미달 파일 목록 |
| `typescript-reviewer` | `it_frontend` 전체 `.ts`·`.vue` | 파일별 Vitest 기준 70% 미달 파일 목록 |
| `code-analyzer` | 전체 소스 | 테스트 없는 service·composable + 분기 미커버 코드 경로 탐지 |

### 통합 (순차 실행)
 - 3개 결과 병합 → `[BE 갭 파일 목록]` / `[FE 갭 파일 목록]` 두 목록으로 분류
 - Task 2·3 실행 전 인라인 메모로 전달

### 규칙
 - 실제 커버리지 리포트가 없는 경우 소스·테스트 파일 교차 분석으로 추정한다.
 - 우선순위: 커버리지 0%인 파일 > 50% 미만 > 70% 미만 순으로 정렬.

---

## [Task 2: Unit Test 보강]

### 서브에이전트 역할 (병렬 실행)
Task 1 갭 파일 목록을 기준으로 기존 파일의 커버리지 갭을 채운다.

| 역할 | 담당 | 참조 기준 |
|---------|------|---------|
| `tdd-guide` (BE) | BE 갭 파일 → JUnit 5 / Mockito 테스트 작성 | `/springboot-tdd` + `it_backend/CLAUDE.md` |
| `tdd-guide` (FE) | FE 갭 파일 → Vitest 테스트 작성 | `/vue-patterns` + `it_frontend/CLAUDE.md` |

### 규칙
 - `it_frontend/CLAUDE.md §4.10` Mock 규칙 준수
   - Nuxt `$fetch` → `vi.stubGlobal('$fetch', mockFetch)`
   - `process.client` → `Object.assign(process, { client: true })`
   - Nuxt auto-import(`#app`, `#imports`)는 Vitest 미지원 → `ref`, `computed`, `defineStore` 등 명시적 import
 - `it_backend/CLAUDE.md §5.5` 트랜잭션·JPA Dirty Checking 패턴 이해 후 테스트 작성
 - AAA(Arrange-Act-Assert) 패턴 필수. 성공·실패·엣지 케이스 3종 이상.
 - 테스트 파일 위치
   - FE: `it_frontend/tests/unit/{composables,stores,utils,middleware}/*.test.ts`
   - BE: `it_backend/src/test/java/com/kdb/it/**/*Test.java`

---

## [Task 3: 신규 도메인 테스트]

### 서브에이전트 역할 (병렬 실행)
테스트 파일 자체가 없는 도메인을 발굴하여 신규 테스트를 작성한다.

| 역할 | 담당 |
|---------|------|
| `java-reviewer` | 테스트 없는 서비스·컨트롤러 발굴 → 신규 JUnit 테스트 작성 |
| `typescript-reviewer` | 테스트 없는 composable·페이지 발굴 → 신규 Vitest 테스트 작성 |

### 규칙
 - Task 2와 동일한 Mock 규칙·AAA 패턴 적용.
 - 컨트롤러 테스트: `@WebMvcTest` + `MockMvc` 패턴. 서비스 테스트: `@ExtendWith(MockitoExtension.class)`.

---

## [Task 4: E2E Test]

### 서브에이전트 역할 (병렬 실행)
기존 시나리오(it\it_frontend\tests\e2e)의 완성도를 높이고, 누락 시나리오를 발굴하여 it\it_frontend\tests\e2e Playwright 코드로 추가한다.

| 역할         | 담당                                                                      |
| ------------ | ----------------------------------------------------------------------- |
| `e2e-runner` | 기존 시나리오 완성도 확인·개선 + 미정의 시나리오 갭 탐지 → Playwright spec 작성/보강               |
| `qa-lead`    | Playwright MCP로 실제 브라우저 기반 동작 검증 (http://localhost:3000) → 성공/실패 + 개선 포인트 리포트 |

### 통합 (순차 실행)
 - `e2e-runner` 신규 시나리오 + `qa-lead` 리포트 교차 검토
 - `qa-lead` 실패 항목은 수정 후 재실행

### 신규 스캐폴드 (e2e-runner가 구현 채움)

| 파일 | 시나리오 | 비고 |
|------|---------|------|
| `tests/e2e/budget.spec.ts` | 예산작성 → 경상사업 → 결재 상신 플로우 | 설계 시나리오 2번 |
| `tests/e2e/documents.spec.ts` | 사전협의 신규 작성 → 저장 → 목록/상세 확인 | 설계 시나리오 1번 |
| `tests/e2e/access-control.spec.ts` | 비관리자 `/admin/**` 접근 시 `/` 리다이렉트 | ROLE 접근 제어 |
| `tests/e2e/file-upload.spec.ts` | 첨부파일 업로드·다운로드 플로우 | page.route() mock 허용 |

#### budget.spec.ts 스캐폴드

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

#### documents.spec.ts 스캐폴드

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

#### access-control.spec.ts 스캐폴드

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

#### file-upload.spec.ts 스캐폴드

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

### 발굴 대상 누락 시나리오 (예시)
 - 로그인 / 로그아웃 / 토큰 만료 흐름
 - 관리자 페이지 접근 제어 (비관리자 차단 확인)
 - 파일 업로드·다운로드 플로우
 - 권한별 메뉴 노출 차이 (ROLE.ADMIN vs ROLE.USER vs ROLE.DEPT_MANAGER)

### 참조 도구
 - Playwright MCP — `qa-lead`가 브라우저 자동화 검증 시 사용
 - E2E 서버: http://localhost:3000 (프론트) + http://localhost:28080 (API)

### 규칙
 - Mock API 없이 실제 서버 대상으로 실행한다. (두 서버 모두 기동 상태 전제)
 - Playwright `page.route()`를 이용한 API mock은 단위 E2E 테스트에서만 허용.

---

## [Task 5: HTML 결과 보고서]

### 서브에이전트 역할 (순차 실행)

Task 4 완료 후 `e2e-runner` 단독 실행.

| 역할 | 담당 |
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
- 내용: 종합 수치 요약 카드(상단) + FE 커버리지 테이블 + BE 커버리지 테이블 + E2E 결과 테이블

#### 상단 요약 카드 구성 (4개)

| 카드 | 표시 값 | 보조 표시 |
|------|---------|----------|
| FE 커버리지 | 전체 평균 % (예: 74.2%) | 70% 미달 파일 수 / 전체 파일 수 |
| BE 커버리지 | 전체 평균 % (예: 81.5%) | 70% 미달 클래스 수 / 전체 클래스 수 |
| E2E 테스트 | 성공률 % (예: 92.3%) | 성공 건수 / 전체 건수 |
| 전체 목표 달성 | 달성 지표 수 / 전체 지표 수 (예: 8 / 11) | 미달 지표 목록 요약 |

카드 배경색: 평균 ≥ 70% (또는 E2E 100%) → 초록, 미달 → 빨강. PASS/FAIL 텍스트는 사용하지 않는다.

### 실행 명령

```bash
cd it_frontend && npm run generate-report
```

### 규칙

- 70% 미달 파일/클래스: 빨간 행 강조, 상단 정렬
- `docs/test/` 디렉토리 없으면 자동 생성
- `generate-report.ts`는 `.spec.ts`가 아니므로 Playwright testDir 수집에서 자동 제외됨

---

## [Task 6: 정적 점검 (Static Analysis)]

테스트 커버리지와 별개로 **타입·린트·포맷·문서·컴파일 경고**를 점검하여 코드 품질 게이트를 통과시킨다.
이 작업은 비즈니스 로직을 수정하지 않으며, 위반 발견 시 테스트 코드·주석·포맷 한정으로만 정정한다.

### 점검 항목 및 명령어

점검 기준 로드는 BE `/springboot-verification`, FE `/nuxt4-patterns`를 참고하되, 실행 명령은 아래 표(= CLAUDE.md §6 Health Stack)를 그대로 사용한다.

| 항목 | 영역 | 명령어 | 설정 SoT | 통과 기준 |
|------|------|--------|----------|----------|
| Type Check | FE | `cd it_frontend && npm run typecheck` | `nuxt.config.ts` (`nuxt typecheck`) | 타입 에러 0건 |
| ESLint | FE | `cd it_frontend && npm run lint` | `eslint.config.mjs` | error 0건 (warning 최소화) |
| Stylelint | FE | `cd it_frontend && npm run lint:css` | `eslint.config.mjs`/stylelint | error 0건 |
| 통합 점검 | FE | `cd it_frontend && npm run check` | `typecheck && lint` 묶음 | 두 단계 모두 통과 |
| Prettier | FE | `cd it_frontend && npx prettier --check .` | (현재 미구성 — 아래 주의 참조) | 포맷 차이 0건 |
| Javadoc | BE | `cd it_backend && ./gradlew javadoc` | `build.gradle` `tasks.withType(Javadoc)` (UTF-8) | 오류 0건, 경고 정리 |
| Compile Warning | BE | `cd it_backend && ./gradlew clean compileJava` | `build.gradle` `tasks.withType(JavaCompile)` | deprecation/unchecked 경고 신규 발생 0건 |

### 항목별 규칙

#### 1) Type Check (FE)
- `npm run typecheck`는 `nuxt typecheck`(vue-tsc 기반)를 실행한다.
- 테스트 코드(`tests/**`)에서 발생한 타입 에러는 **테스트 코드 측에서** 해결한다. 소스 타입 정의는 변경 금지.
- Nuxt auto-import 미지원 환경(Vitest)에서는 `ref`/`computed`/`defineStore` 등을 명시적 import 하여 타입 누락을 방지한다(Task 2 규칙과 동일).

#### 2) ESLint / Stylelint (FE)
- `npm run lint`(=`eslint .`)와 `npm run lint:css`(=`stylelint app/assets/css/**/*.css`)를 실행한다.
- 자동 수정은 `npx eslint . --fix`, `npx stylelint "app/assets/css/**/*.css" --fix`로 한정 적용한다.
- 룰 자체(`eslint.config.mjs`)는 임의로 완화하지 않는다. 규칙 변경이 필요하면 별도 합의 후 진행.
- `npm run check`로 typecheck + lint를 한 번에 검증할 수 있다.

#### 3) Prettier (FE) — ⚠️ 현재 미구성
- **현황**: `it_frontend`에 `prettier` 의존성과 설정 파일(`.prettierrc*`, `package.json#prettier`)이 **존재하지 않는다.** 따라서 현재는 ESLint 포맷 규칙이 사실상의 포맷 기준이다.
- 포맷 일관성 점검이 필요하면 1회성으로 `npx prettier --check .`를 실행하되, 설정이 없으므로 Prettier 기본값이 적용되는 점에 주의한다.
- Prettier를 정식 도입하려면 (별도 합의 후): `prettier` devDependency 추가 → `.prettierrc` 작성 → `eslint-config-prettier`로 ESLint와 규칙 충돌 제거 → `package.json`에 `"format": "prettier --write ."`, `"format:check": "prettier --check ."` 스크립트 추가.
- **이 작업 범위에서는 Prettier 강제 적용으로 인한 대량 포맷 변경(diff 노이즈)을 만들지 않는다.**

#### 4) Javadoc (BE)
- `./gradlew javadoc`로 `src/main/java` 전체 Javadoc 생성을 검증한다(인코딩 UTF-8, `build.gradle`).
- Javadoc 경고(파라미터 누락, 잘못된 `@link`, 빈 `@return` 등)는 **주석 보강으로** 해소한다. 메서드 시그니처·로직은 변경 금지.
- 표준 양식은 `it_backend/docs/guides/comment-style.md` 기준(루트 §4.1 한글 주석 원칙 준수).

#### 5) Compile Warning (BE)
- `./gradlew clean compileJava`로 메인 소스 컴파일 경고를 확인한다(테스트 컴파일은 `compileTestJava`).
- 현재 `build.gradle`은 `-parameters`·UTF-8만 지정하며 `-Xlint`는 비활성 상태이다. 경고를 상세히 보려면 `--warning-mode all`로 점검한다:
  ```bash
  cd it_backend && ./gradlew clean compileJava --warning-mode all
  ```
  (deprecation/unchecked까지 강제로 보려면 `build.gradle`의 `JavaCompile` 블록에 `options.compilerArgs.add('-Xlint:all')` 추가를 별도 합의 후 진행.)
- `deprecation`·`unchecked` 경고는 **테스트 작성 과정에서 새로 유입되지 않도록** 한다. 기존 소스 경고는 기록만 하고 `TASK.md`에 등록(소스 수정 금지 원칙).

### 실행 순서 (권장)
1. FE: `npm run check` (typecheck → lint) → `npm run lint:css`
2. BE: `./gradlew clean compileJava --warning-mode all` (경고 확인) → `./gradlew javadoc`
3. (선택) Prettier: `npx prettier --check .` — 미구성 상태이므로 참고용

---

## [검증: Verification Loop]

### 1단계 — 실질 측정 (Bash)

```bash
# 백엔드 커버리지 측정
cd it_backend && ./gradlew test jacocoTestReport
# → build/reports/jacoco/test/html/index.html 파싱, 70% 미달 파일 목록 추출

# 프론트엔드 커버리지 측정
cd it_frontend && npm run test:coverage
# → coverage/index.html 파싱, 70% 미달 파일 목록 추출

# E2E 실행
cd it_frontend && npm run test:e2e
# → 실패 spec 목록 추출

# HTML 보고서 생성
cd it_frontend && npm run generate-report
# → C:\it\docs\test\test-report-YYYY-MM-DD.html 생성
```

### 2단계 — 코드리뷰

 - `qa-lead` — 70% 미달 파일 테스트 코드 검토, 누락 케이스·Mock 오류 지적

### 반복 조건

| 종료 조건 | 기준 |
|-----------|------|
| 전체 BE 파일 Jacoco 6개 지표 | 각 70% 이상 |
| 전체 FE 파일 Vitest 4개 지표 | 각 70% 이상 |
| E2E 시나리오 | 100% 성공 |

미달 파일 존재 시 → Task 2 또는 Task 3 해당 역할만 재실행 → 검증 반복.  
E2E 실패 시 → Task 4 `e2e-runner` 재실행 → 검증 반복.  
**모든 조건 충족 시 종료.**
