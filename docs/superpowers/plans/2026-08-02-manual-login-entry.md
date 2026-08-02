# Manual Login Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/login`을 항상 수동 로그인 화면으로 만들고, 인증된 사용자가 이 경로에 접근하면 기존 세션을 자동으로 종료한다.

**Architecture:** canonical 로그인 경로는 Nitro 서버 미들웨어와 Nuxt 전역 인증 미들웨어 모두에서 SSO 예외로 처리한다. 전역 인증 미들웨어는 복원된 세션이 있으면 `logout()`을 수행하고 라우팅을 계속하며, 로그인 페이지는 자체 SSO 이동 없이 폼만 렌더링한다. 로그인 이외의 보호 경로는 기존 SSO 자동 진입을 그대로 유지한다.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, Vitest, Playwright

## Global Constraints

- 브라우저 인증은 백엔드 httpOnly 쿠키를 사용하며 프론트엔드에서 JWT를 저장하거나 읽지 않는다.
- 인증 API 호출은 기존 `stores/auth.ts`의 `logout()` 계약과 `credentials: 'include'`를 유지한다.
- `next`는 `getSafeNextPath()`가 허용하는 내부 경로만 수동 로그인 성공 후 복원한다.
- 신규 주석은 한글로 작성한다.
- 관련 없는 현재 작업 트리 변경은 수정하거나 스테이징하지 않는다.
- 설계 기준은 `docs/superpowers/specs/2026-08-02-manual-login-entry-design.md`이다.

---

## File Structure

- `it_frontend/app/middleware/auth.global.ts`: 로그인 경로의 세션 종료와 보호 경로의 SSO 진입을 구분한다.
- `it_frontend/tests/unit/middleware/auth.global.test.ts`: 인증 상태별 `/login` 동작과 보호 경로 회귀를 검증한다.
- `it_frontend/server/middleware/sso-auth-redirect.ts`: 모든 canonical 로그인 문서 요청을 서버 SSO 리다이렉트에서 제외한다.
- `it_frontend/tests/unit/server/sso-auth-redirect.test.ts`: 쿼리가 있는 로그인 경로도 서버에서 통과하는지 검증한다.
- `it_frontend/app/pages/login.vue`: 자동 SSO 이동 상태를 제거하고 수동 로그인 폼을 즉시 렌더링한다.
- `it_frontend/tests/e2e/static-auth.spec.ts`: Nitro가 없는 정적 배포에서 `/login`은 수동 폼, 보호 경로는 SSO라는 사용자 흐름을 검증한다.

---

### Task 1: 전역 인증 미들웨어의 로그인 경로 계약 변경

**Files:**
- Modify: `it_frontend/tests/unit/middleware/auth.global.test.ts`
- Modify: `it_frontend/app/middleware/auth.global.ts`

**Interfaces:**
- Consumes: `useAuth(): { isAuthenticated, restoreSession, bootstrapSession, logout }`, `isLoginPath(path)`, `getSafeNextPath(path)`
- Produces: 로그인 경로에서는 SSO 이동 없이 필요 시 `logout()`을 완료하고 라우팅을 계속하는 전역 가드

- [ ] **Step 1: 실패를 일으킬 프로덕션 변경을 명시한다**

`/login` 분기에서 `logout()` 호출이 빠지거나 `redirect`/`next` 때문에 `redirectToSso()`를 호출하면 아래 테스트가 실패해야 한다.

- [ ] **Step 2: 인증 상태별 실패 테스트를 작성한다**

`tests/unit/middleware/auth.global.test.ts`에 `mockLogout`을 추가하고 전역 `useAuth` mock에 연결한다.

```ts
const mockLogout = vi.fn();

vi.stubGlobal('useAuth', () => ({
    isAuthenticated: mockIsAuthenticated,
    restoreSession: mockRestoreSession,
    bootstrapSession: mockBootstrapSession,
    logout: mockLogout,
    isAdmin: mockIsAdmin,
}));
```

`beforeEach`에서 mock을 초기화하고 실제 store의 로그아웃 결과처럼 인증 ref를 비우게 한다.

```ts
mockLogout.mockReset();
mockLogout.mockImplementation(async () => {
    mockIsAuthenticated.value = false;
});
```

기존의 `/login?redirect` SSO 테스트와 인증 사용자 홈 이동 테스트를 다음 계약으로 교체한다.

```ts
it.each([
    { query: { redirect: '/info/projects/PRJ-2026-0014' } },
    { query: { next: '/info/projects/PRJ-2026-0014' } },
])('미인증 사용자의 /login 쿼리 %o는 SSO 없이 수동 로그인 화면을 표시한다', async ({ query }) => {
    mockIsAuthenticated.value = false;

    await (authGlobalMiddleware as MiddlewareHandler)({ path: '/login', query }, {});

    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockAbortNavigation).not.toHaveBeenCalled();
    expect(mockNavigateTo).not.toHaveBeenCalled();
});

it('인증된 사용자가 /login에 접근하면 로그아웃하고 로그인 화면을 표시한다', async () => {
    mockIsAuthenticated.value = true;

    await (authGlobalMiddleware as MiddlewareHandler)({ path: '/login', query: {} }, {});

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockIsAuthenticated.value).toBe(false);
    expect(mockAbortNavigation).not.toHaveBeenCalled();
    expect(mockNavigateTo).not.toHaveBeenCalled();
});
```

배열 `redirect` 테스트는 다음과 같이 SSO 미호출 계약으로 교체한다.

```ts
it('/login에 redirect 배열이 있어도 수동 로그인 화면을 표시한다', async () => {
    mockIsAuthenticated.value = false;

    await (authGlobalMiddleware as MiddlewareHandler)(
        { path: '/login', query: { redirect: ['/info/projects', '/info/cost'] } },
        {},
    );

    expect(mockAbortNavigation).not.toHaveBeenCalled();
    expect(mockNavigateTo).not.toHaveBeenCalled();
});
```

`error=x&error=sso`에서 SSO를 기대하던 테스트도 다음 계약으로 교체한다. `error=sso&error=x` 테스트는 기존 SSO 미호출 기대를 유지한다.

```ts
it('/login?error=x&error=sso도 SSO 없이 수동 로그인 화면을 표시한다', async () => {
    mockIsAuthenticated.value = false;

    await (authGlobalMiddleware as MiddlewareHandler)(
        {
            path: '/login',
            query: { redirect: '/info/projects', error: ['x', 'sso'] },
        },
        {},
    );

    expect(mockAbortNavigation).not.toHaveBeenCalled();
    expect(mockNavigateTo).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: 테스트가 기존 구현에서 올바르게 실패하는지 확인한다**

Run:

```powershell
npx vitest run tests/unit/middleware/auth.global.test.ts
```

Expected: 인증 사용자 테스트는 `mockLogout` 호출 횟수가 0이어서 실패하고, 안전한 `redirect`/`next` 테스트는 `abortNavigation`이 호출되어 실패한다.

- [ ] **Step 4: 전역 미들웨어를 최소 변경한다**

`app/middleware/auth.global.ts`에서 사용하지 않게 된 `isSsoError` import를 제거하고 `logout`을 받는다.

```ts
import { getSafeNextPath, isLoginPath } from '#shared/utils/safeNextPath';

const { isAuthenticated, restoreSession, bootstrapSession, logout } = useAuth();
```

로그인 경로 분기를 다음과 같이 변경한다.

```ts
const isLoginRoute = to.name === 'login' || isLoginPath(to.path);
if (isLoginRoute) {
    if (import.meta.client) {
        document.documentElement.style.visibility = '';
    }
    if (isAuthenticated.value) {
        await logout();
    }
    return;
}
```

로그인 경로가 아닌 보호 경로의 `getSafeNextPath(to.fullPath ?? to.path)` 및 `redirectToSso()` 로직은 변경하지 않는다. 파일 상단 처리 흐름과 로그인 분기 주석을 새 계약에 맞춰 갱신한다.

- [ ] **Step 5: 단위 테스트를 통과시킨다**

Run:

```powershell
npx vitest run tests/unit/middleware/auth.global.test.ts
```

Expected: 파일 내 모든 테스트 PASS.

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git add -- app/middleware/auth.global.ts tests/unit/middleware/auth.global.test.ts
git commit -m "fix: 로그인 경로에서 기존 세션 종료"
```

---

### Task 2: Nitro 서버 미들웨어의 로그인 경로 SSO 예외 통일

**Files:**
- Modify: `it_frontend/tests/unit/server/sso-auth-redirect.test.ts`
- Modify: `it_frontend/server/middleware/sso-auth-redirect.ts`

**Interfaces:**
- Consumes: `isLoginPath(path)`, `getSafeNextPath(pathAndQuery)`
- Produces: canonical 로그인 HTML 요청은 쿼리와 쿠키 유무에 관계없이 Nuxt 애플리케이션으로 통과시키는 서버 미들웨어

- [ ] **Step 1: 실패를 일으킬 프로덕션 변경을 명시한다**

로그인 경로에 안전한 `redirect` 또는 `next` 쿼리가 있을 때 `sendRedirect()`가 실행되면 아래 테스트가 실패해야 한다.

- [ ] **Step 2: 쿼리가 있는 로그인 경로 실패 테스트를 작성한다**

`tests/unit/server/sso-auth-redirect.test.ts`에 다음 표 기반 테스트를 추가한다.

```ts
it.each([
    '/login?next=%2Finfo%2Fprojects',
    '/LOGIN?redirect=%2Finfo%2Fcost',
    '/%6cogin?error=x&next=%2Finfo',
])('로그인 경로 %s는 쿼리와 관계없이 수동 로그인 화면으로 통과한다', (requestTarget) => {
    const event = createEvent(requestTarget);

    const result = handler(event);

    expect(result).toBeUndefined();
    expect(mockSendRedirect).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: 테스트가 기존 구현에서 올바르게 실패하는지 확인한다**

Run:

```powershell
npx vitest run tests/unit/server/sso-auth-redirect.test.ts
```

Expected: 안전한 `next` 또는 `redirect`를 가진 로그인 요청이 `redirected`를 반환해 신규 테스트가 실패한다.

- [ ] **Step 4: 서버 미들웨어를 최소 변경한다**

`server/middleware/sso-auth-redirect.ts`에서 HTML/정적 리소스 판별 직후 로그인 경로를 반환한다.

```ts
if (!isHtmlNavigation(event) || isPublicAssetPath(path)) {
    return;
}

if (isLoginRoute) {
    return;
}

if (getCookie(event, 'it-portal-user')) {
    return;
}
```

기존 `error=sso` 전용 예외와 로그인 경로용 `redirectPath` 삼항식을 제거하고 보호 경로만 검증한다.

```ts
const redirectPath = getSafeNextPath(`${path}${url.search}`);
if (!redirectPath) {
    return;
}
```

파일 주석의 주요 예외 설명도 “모든 canonical 로그인 경로”로 갱신한다.

- [ ] **Step 5: 서버 미들웨어 단위 테스트를 통과시킨다**

Run:

```powershell
npx vitest run tests/unit/server/sso-auth-redirect.test.ts
```

Expected: 파일 내 모든 테스트 PASS이며 `/loginish`와 보호 경로 SSO 테스트도 유지된다.

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git add -- server/middleware/sso-auth-redirect.ts tests/unit/server/sso-auth-redirect.test.ts
git commit -m "fix: 로그인 문서 요청의 SSO 리다이렉트 제외"
```

---

### Task 3: 로그인 페이지의 자동 SSO 이동 제거

**Files:**
- Modify: `it_frontend/tests/e2e/static-auth.spec.ts`
- Modify: `it_frontend/app/pages/login.vue`

**Interfaces:**
- Consumes: `useAuth().login(credentials)`, `getSafeNextPath(route.query.next)`, `isSsoError(route.query.error)`
- Produces: 진입 즉시 수동 로그인 폼을 표시하고 로그인 성공 후 안전한 `next`로 이동하는 `/login` 페이지

- [ ] **Step 1: 실패를 일으킬 프로덕션 변경을 명시한다**

로그인 페이지의 `onMounted()`가 `/sso/business`로 이동하거나 `autoRedirecting`이 폼을 숨기면 아래 브라우저 테스트가 실패해야 한다.

- [ ] **Step 2: 정적 배포 로그인 흐름 실패 테스트를 작성한다**

`tests/e2e/static-auth.spec.ts`의 반복 error 기반 테스트를 수동 로그인 계약으로 교체한다.

```ts
test('/login은 next 쿼리가 있어도 SSO 없이 수동 로그인 화면을 표시한다', async ({ page }) => {
    await mockUnauthenticatedSession(page);
    let ssoRequestCount = 0;
    await page.route('**/sso/business?*', (route) => {
        ssoRequestCount++;
        return route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<html><body>unexpected SSO</body></html>',
        });
    });

    await page.goto('/login?next=%2Finfo%2Fprojects');

    await expect(page.getByLabel('행번')).toBeVisible();
    await expect(page.getByLabel('ESSO 비밀번호')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
    expect(ssoRequestCount).toBe(0);
});

test('/login의 SSO 실패 안내는 유지한다', async ({ page }) => {
    await mockUnauthenticatedSession(page);

    await page.goto('/LOGIN?error=sso');

    await expect(page.getByText('SSO 인증에 실패했습니다.')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
});
```

첫 번째 보호 경로 SSO 테스트는 변경하지 않아 회귀 경계로 유지한다.

- [ ] **Step 3: 브라우저 테스트가 기존 구현에서 올바르게 실패하는지 확인한다**

Run:

```powershell
npx playwright test tests/e2e/static-auth.spec.ts --config playwright.static.config.ts
```

Expected: `/login?next=...`가 SSO 응답으로 이동해 행번 입력을 찾지 못하거나 SSO 요청 횟수가 1이 되어 신규 테스트가 실패한다.

- [ ] **Step 4: 로그인 페이지를 최소 변경한다**

`app/pages/login.vue`에서 `autoRedirecting` ref와 SSO URL을 만드는 `onMounted()` 코드를 제거한다. 테마 초기화만 유지한다.

```ts
onMounted(() => {
    document.documentElement.classList.toggle('dark', isDark.value);
    document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light';
});
```

템플릿의 로그인 카드와 푸터에서 `v-if="!autoRedirecting"`를 제거한다. `hasSsoError`, 입력 검증, `login()` 호출, `router.push(getSafeNextPath(route.query.next) ?? '/')`는 유지한다. 파일 설명은 `/login`이 항상 수동 로그인 화면이라는 계약으로 갱신한다.

- [ ] **Step 5: 정적 배포 인증 E2E를 통과시킨다**

Run:

```powershell
npx playwright test tests/e2e/static-auth.spec.ts --config playwright.static.config.ts
```

Expected: 수동 로그인 2개 시나리오와 보호 경로 SSO 시나리오가 모두 PASS.

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git add -- app/pages/login.vue tests/e2e/static-auth.spec.ts
git commit -m "fix: 로그인 페이지를 수동 인증 진입점으로 변경"
```

---

### Task 4: 전체 인증 회귀 및 정적 품질 검증

**Files:**
- Verify only: `it_frontend`

**Interfaces:**
- Consumes: Task 1~3의 구현과 테스트
- Produces: 단위 테스트, 정적 인증 E2E, 타입 검사, ESLint, Prettier 검증 결과

- [ ] **Step 1: 관련 단위 테스트를 함께 실행한다**

Run:

```powershell
npx vitest run tests/unit/middleware/auth.global.test.ts tests/unit/server/sso-auth-redirect.test.ts tests/unit/shared/safeNextPath.test.ts tests/unit/stores/auth.direct.test.ts
```

Expected: 지정한 모든 테스트 PASS.

- [ ] **Step 2: 전체 프론트 단위 테스트를 실행한다**

Run:

```powershell
npm test
```

Expected: 전체 Vitest 테스트 PASS, 실패 0개.

- [ ] **Step 3: 정적 배포 인증 E2E를 다시 실행한다**

Run:

```powershell
npm run test:e2e:static -- tests/e2e/static-auth.spec.ts
```

Expected: `static-auth.spec.ts`의 모든 시나리오 PASS.

- [ ] **Step 4: 타입 검사와 ESLint를 실행한다**

Run:

```powershell
npm run check
```

Expected: TypeScript와 ESLint 오류 0개.

- [ ] **Step 5: 포맷 검사를 실행한다**

Run:

```powershell
npm run format:check
```

Expected: 변경 파일을 포함한 전체 Prettier 검사 PASS. 실패하면 아래 명령으로 대상 파일만 정리한 후 Step 1~5를 다시 실행한다.

```powershell
npx prettier --write app/middleware/auth.global.ts server/middleware/sso-auth-redirect.ts app/pages/login.vue tests/unit/middleware/auth.global.test.ts tests/unit/server/sso-auth-redirect.test.ts tests/e2e/static-auth.spec.ts
```

- [ ] **Step 6: 최종 diff 범위를 확인한다**

Run:

```powershell
git status --short
git diff --check
git diff -- app/middleware/auth.global.ts server/middleware/sso-auth-redirect.ts app/pages/login.vue tests/unit/middleware/auth.global.test.ts tests/unit/server/sso-auth-redirect.test.ts tests/e2e/static-auth.spec.ts
```

Expected: 작업 대상 여섯 파일만 이번 기능 diff에 포함되고, 기존 비용 화면 관련 변경은 그대로 보존되며, 공백 오류가 없다.
