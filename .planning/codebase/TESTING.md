# Testing Patterns

**Analysis Date:** 2026-05-19

The project is a split monorepo with two test stacks:
- **Backend** (`it_backend/`): JUnit 5 + Mockito + Spring Boot Test + JaCoCo.
- **Frontend** (`it_frontend/`): Vitest + happy-dom + Vue Test Utils + Pinia testing, plus Playwright for E2E.

## Test Framework

### Backend

**Runner:** JUnit 5 (`useJUnitPlatform()` in `it_backend/build.gradle`).

**Assertion Library:** AssertJ (`org.assertj.core.api.Assertions.assertThat`, `assertThatThrownBy`).

**Mocking:** Mockito (`@ExtendWith(MockitoExtension.class)`, `@Mock`, `@InjectMocks`, `BDDMockito.given`).

**Spring Test:** `@WebMvcTest` (slice tests) + `MockMvc` + `@MockitoBean` for collaborators (`it_backend/src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java`).

**Coverage:** JaCoCo `0.8.13` (Java 25 support), configured in `it_backend/build.gradle`.

**Dependencies (`it_backend/build.gradle`):**
- `spring-boot-starter-webmvc-test`
- `spring-boot-starter-data-jpa-test`
- `spring-boot-starter-security-test`
- `spring-boot-restdocs` (Spring REST Docs)
- `org.springframework.restdocs:spring-restdocs-mockmvc`

**Run commands:**
```bash
./gradlew test                # 전체 테스트 + JaCoCo 리포트 자동 생성
./gradlew clean test          # 클린 후 전체 재검증 (인증·결재·파일·QueryDSL 변경 시)
./gradlew jacocoTestReport    # 커버리지 리포트만 재생성
./gradlew jacocoTestCoverageVerification  # 임계치(70%) 검증
```

### Frontend Unit Tests

**Runner:** Vitest `^4.0.18` (`it_frontend/package.json`).

**Environment:** `happy-dom` (`it_frontend/vitest.config.ts`).

**Component testing:** `@vue/test-utils ^2.4.6`.

**Pinia testing:** `@pinia/testing ^1.0.3`, `setActivePinia(createPinia())` per test.

**Config:** `it_frontend/vitest.config.ts`.

**Run commands:**
```bash
npm test                  # 단발 실행 (vitest run)
npm run test:watch        # 워치 모드
npm run test:coverage     # v8 커버리지
npm run test:ui           # Vitest UI
```

### Frontend E2E Tests

**Framework:** Playwright `^1.58.2` (`it_frontend/playwright.config.ts`).

**Run commands:**
```bash
npm run test:auth         # 로그인 세션 setup (수동 로그인, headed)
npm run test:e2e          # 전체 E2E 실행
npm run test:e2e:ui       # Playwright UI
npm run generate-report   # HTML 리포트 생성
```

## Test File Organization

### Backend (mirrors `src/main/java` package structure)

```
it_backend/src/test/java/com/kdb/it/
├── ItApplicationTests.java                 ← @SpringBootTest 컨텍스트 로드 확인
├── config/
│   └── TestSecurityConfig.java             ← @WebMvcTest용 Security 우회 설정
├── common/
│   ├── admin/{controller,service}/
│   ├── approval/{controller,service}/
│   ├── board/{controller,service}/
│   ├── code/{controller,service}/
│   ├── iam/{controller,service}/
│   ├── system/{controller,service,security,tiptap/...}/
│   └── util/                               ← CookieUtilTest, HtmlSanitizerTest 등
├── domain/
│   ├── budget/{cost,document,plan,project,status,work}/{controller,service,entity,repository}/
│   ├── council/{controller,service}/
│   └── log/listener/                       ← AuditLogPersisterTest, ChangeLogEntityListenerTest
├── exception/                              ← GlobalExceptionHandlerTest
└── infra/
    ├── ai/{controller,service}/
    └── file/                               ← FileValidatorTest, FileOwnershipCheckerTest
```

**Naming:**
- Unit / slice tests: `XxxTest.java`.
- Unit web-layer tests labeled with class name pattern `XxxUnitTest.java` also observed (e.g., `BoardControllerUnitTest.java`).

### Frontend Unit Tests (`it_frontend/tests/unit/`)

```
tests/
├── setup.ts                                ← Vitest 전역 셋업 (vi.stubGlobal)
├── unit/
│   ├── components/
│   │   ├── VariableNodeView.test.ts
│   │   └── extensions/variableExtension.test.ts
│   ├── composables/                        ← 약 40개 use*.test.ts
│   ├── middleware/                         ← admin.test.ts, auth.global.test.ts, budget-period.test.ts, plan.test.ts
│   ├── plugins/                            ← auth.test.ts, excalidraw-css.test.ts, router-error.test.ts, theme.test.ts
│   ├── stores/                             ← auth.test.ts, review.test.ts (+ .direct, .branches)
│   └── utils/                              ← common.test.ts, excel.test.ts, hwpx.test.ts 외
└── e2e/
    ├── helpers/mockApi.ts                  ← page.route() 헬퍼
    ├── auth.setup.ts                       ← 수동 로그인 세션 저장 (.auth/user.json)
    ├── auth.spec.ts                        ← 로그인 격리 테스트 (storageState: undefined)
    └── *.spec.ts                           ← 화면별 시나리오
```

**Naming:**
- Unit: `<source-file-stem>.test.ts` (1:1 매핑) — e.g., `useApiFetch.ts` ↔ `useApiFetch.test.ts`.
- Extra slice tests: `.direct.test.ts` (격리된 인라인 구현 테스트), `.branches.test.ts` (분기 보강 테스트). Example: `useAuth.test.ts` + `useAuth.direct.test.ts`, `stores/review.test.ts` + `review.branches.test.ts` + `review.direct.test.ts`.
- E2E: `*.spec.ts`.

## Test Structure

### AAA (Arrange-Act-Assert) Pattern

Mandated by `TEST.md` Task 2 규칙. Korean comment markers `// given` / `// when` / `// then` are the canonical form on the backend (BDDMockito style).

### Backend test skeleton

```java
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private AuthService authService;

    @Test
    @DisplayName("login - 성공 시 LoginResponse (eno, empNm, accessToken) 반환")
    void login_성공_LoginResponse반환() {
        // given
        CuserI user = CuserI.builder()
                .eno("10001").usrNm("홍길동").usrEcyPwd("encodedPwd").delYn("N").build();
        given(userRepository.findByEno("10001")).willReturn(Optional.of(user));
        given(passwordEncoder.matches("password", "encodedPwd")).willReturn(true);
        given(jwtUtil.generateAccessToken(anyString(), anyList(), any())).willReturn("access-token");

        // when
        AuthDto.LoginResponse response =
            authService.login("10001", "password", "127.0.0.1", "TestAgent");

        // then
        assertThat(response).isNotNull();
        assertThat(response.getEno()).isEqualTo("10001");
        assertThat(response.getAccessToken()).isEqualTo("access-token");
    }
}
```

Source: `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`.

### Backend `@WebMvcTest` controller skeleton

```java
@WebMvcTest(AuthController.class)
@Import({ TestSecurityConfig.class, JacksonConfig.class })
class AuthControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockitoBean private AuthService authService;
    @MockitoBean private CookieUtil cookieUtil;
    @MockitoBean private JwtUtil jwtUtil;

    @Test
    @DisplayName("POST /api/auth/login - 성공 시 200 + Set-Cookie 헤더")
    void login_성공_200및쿠키반환() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().string("Set-Cookie", containsString("HttpOnly")));
    }
}
```

Source: `it_backend/src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java`.

- Slice loads only the web layer.
- `TestSecurityConfig` (`it_backend/src/test/java/com/kdb/it/config/TestSecurityConfig.java`) replaces the real `SecurityConfig`, permits `/api/auth/**` and `/sso/**`, and `@WithMockUser` covers everything else.
- All collaborators are `@MockitoBean`.

### Frontend Vitest skeleton

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { ref, computed } from 'vue';

describe('useAuth — RBAC 권한 헬퍼', () => {
    let userRef: ReturnType<typeof ref<User | null>>;

    beforeEach(() => {
        setActivePinia(createPinia());
        userRef = ref<User | null>(null);
        vi.clearAllMocks();
    });

    describe('isAdmin()', () => {
        it('ITPAD001 자격등급 포함 시 true를 반환한다', () => {
            // Arrange
            userRef.value = { eno: 'E001', empNm: '관리자', athIds: [ROLE.ADMIN], ... };
            const { isAdmin } = makeUseAuth(userRef);

            // Act + Assert
            expect(isAdmin()).toBe(true);
        });
    });
});
```

Source: `it_frontend/tests/unit/composables/useAuth.test.ts`.

**Parameterised tables** use `it.each([...])` (observed in `it_frontend/tests/unit/utils/common.test.ts`):
```ts
it.each([
    ['결재완료', 'kdb-tag-green'],
    ['반려',     'kdb-tag-red'],
    ['결재중',   'kdb-tag-blue'],
])('상태 "%s"는 클래스 "%s"를 반환한다', (status, expected) => {
    expect(getApprovalTagClass(status)).toBe(expected);
});
```

## Mocking

### Backend (Mockito + BDD)

- `BDDMockito.given(...).willReturn(...)` is preferred over `when().thenReturn()` (observed in `AuthServiceTest`, `BoardPostServiceTest`).
- Verifications: `verify(repository, times(1)).save(any())`, `verify(repo, never()).deleteById(any())`.
- Stub argument matchers: `anyString()`, `anyList()`, `any(SomeType.class)`.
- For controller slices use `@MockitoBean` (Spring Boot 3.4+ / 4.x replacement for `@MockBean`).

### Frontend (Vitest + vi.stubGlobal)

Per `it_frontend/CLAUDE.md` §4.10 and `it_frontend/tests/setup.ts`:

```ts
// Nuxt $fetch → vi.stubGlobal로 대체
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

// 클라이언트 환경 시뮬레이션
Object.assign(process, { client: true });

// Nuxt auto-import (#app, #imports)는 Vitest 미지원
// → ref, computed, defineStore 등은 테스트 파일에서 명시적 import
```

**Global setup (`it_frontend/tests/setup.ts`)** stubs every Nuxt auto-import that source files reference at module-evaluation time:

| Stub | Replacement |
|------|-------------|
| `ref`, `computed`, `reactive`, `watch`, `watchEffect`, `nextTick` | Real Vue functions |
| `defineNuxtRouteMiddleware`, `defineNuxtPlugin` | Identity wrappers |
| `navigateTo` | `vi.fn()` |
| `useRuntimeConfig` | Returns `{ public: { apiBase: 'http://localhost:8080' } }` |
| `useNuxtApp` | Returns `{ $apiFetch: vi.fn() }` |
| `useCookie` | Returns a `ref()` (honours `opts.default`) |
| `useRoute` | `{ params: {}, query: {}, path: '/' }` |
| `useRouter` | `{ push: vi.fn(), replace: vi.fn() }` |
| `useFetch` | Mock returning `{ data, pending, error, refresh }` refs |
| `useToast` | Returns `{ add: vi.fn() }` |
| `refreshCookie` | `vi.fn()` |

Individual tests may override any stub with `vi.stubGlobal(...)`.

**`import.meta.client` / `import.meta.server`:** The custom Vite plugin `nuxtMetaPlugin` in `it_frontend/vitest.config.ts` rewrites these to `true` / `false` at transform time so tests behave as client-side code.

### E2E (Playwright `page.route`)

Helper: `it_frontend/tests/e2e/helpers/mockApi.ts`.

```ts
import { mockLoginApi, mockApi, mockCommonApis, setLoggedIn } from './helpers/mockApi';

await mockLoginApi(page);              // POST /api/auth/login → 200
await mockApi(page, '/api/projects', mockProjects);
await mockCommonApis(page);            // 배지/메타 등 사이드바 공통 API 안정화
await setLoggedIn(page);               // it-portal-user 쿠키 주입 (로그인 플로우 우회)
```

`mockApi` adds CORS preflight handling (`OPTIONS → 204`) and `Access-Control-Allow-*` headers so the dev server `http://localhost:3002` accepts mocked responses.

### What to Mock

- **Backend:** Repositories, `PasswordEncoder`, `JwtUtil`, external clients (`GeminiService` deps), `CookieUtil` in controller slices. Do NOT mock the class under test.
- **Frontend:** Nuxt auto-imports (`$fetch`, `useCookie`, `useRoute`), `useToast` from PrimeVue, store cross-calls. Do NOT mock the utility / composable / store under test.

### What NOT to Mock

- DTOs / entities (use real builders).
- Pure utility functions (`utils/common.ts`) — test directly.
- `BaseEntity` lifecycle — covered via integration / listener tests (`AuditLogPersisterTest`, `ChangeLogEntityListenerTest`).

## Fixtures and Factories

**Backend:** Entities built inline using Lombok builders.
```java
CuserI user = CuserI.builder()
        .eno("10001").usrNm("홍길동").usrEcyPwd("encodedPwd").delYn("N")
        .build();
```
No shared fixture directory; rebuild per test for isolation.

**Frontend:** Inline literal objects, often near the test. Shared E2E mock data is defined inside helpers in `it_frontend/tests/e2e/helpers/mockApi.ts` (e.g., default user `{ eno: 'E001', empNm: '홍길동' }`).

## Coverage

### Backend (JaCoCo — `it_backend/build.gradle`)

**Target (per `TEST.md` 목표):** ≥ 70% for every counter at the **class level**.
- LINE ≥ 70%
- BRANCH ≥ 70%
- COMPLEXITY ≥ 70%
- INSTRUCTION ≥ 70%
- METHOD ≥ 70%
- CLASS ≥ 70%

**Verification rule (excerpt):**
```groovy
jacocoTestCoverageVerification {
    violationRules {
        rule { limit { counter='LINE'; value='COVEREDRATIO'; minimum=0.70 } }
        rule {
            element='CLASS'
            limit { counter='LINE';       value='COVEREDRATIO'; minimum=0.70 }
            limit { counter='BRANCH';     value='COVEREDRATIO'; minimum=0.70 }
            limit { counter='COMPLEXITY'; value='COVEREDRATIO'; minimum=0.70 }
        }
    }
}
```

**Excluded from coverage:**
```
**/Q*.class                  ← QueryDSL 자동 생성
**/ItApplication.class       ← 진입점
**/*Config*.class            ← Spring 설정
**/*Properties*.class        ← @ConfigurationProperties
**/*Dto*.class, **/*Dto$*    ← DTO + 정적 중첩
**/*Entity*.class, **/entity/**
**/exception/**              ← 예외 클래스
**/infra/ai/**               ← Gemini 외부 연동
**/repository/**             ← Repository 인터페이스/QueryDSL 구현체
**/domain/log/**             ← 감사로그 인프라 (통합 테스트)
```

**View coverage:**
```bash
./gradlew test                # 자동으로 jacocoTestReport finalizedBy 실행
start it_backend/build/reports/jacoco/test/html/index.html
```

### Frontend (Vitest v8 — `it_frontend/vitest.config.ts`)

**Provider:** `v8`.

**Reporters:** `text`, `html`, `lcov`, `json-summary`.

**Included paths** (only — pages/layouts/components are E2E-covered):
```
app/utils/**/*.ts
app/stores/**/*.ts
app/composables/**/*.ts
app/middleware/**/*.ts
```

**Excluded:** `app/**/*.d.ts`, `node_modules/**`, `tests/**`.

**Threshold (config):** `lines: 70`.

**Per-file target (per `TEST.md`):** ≥ 70% on Statements / Branches / Functions / Lines.

**View coverage:**
```bash
npm run test:coverage
start it_frontend/coverage/index.html
```

## Test Types

### Unit Tests

- **Backend:** Service / utility / security component tests — `@ExtendWith(MockitoExtension.class)`. Examples: `AuthServiceTest`, `BoardPostServiceTest`, `JwtUtilTest`, `CustomPasswordEncoderTest`, `HtmlSanitizerTest`, `LoginAttemptServiceTest`.
- **Frontend:** Pure utilities, Pinia stores, composables, plugins, middleware. Examples: `it_frontend/tests/unit/utils/common.test.ts`, `it_frontend/tests/unit/stores/auth.test.ts`, `it_frontend/tests/unit/composables/useApiFetch.test.ts`, `it_frontend/tests/unit/middleware/admin.test.ts`.

### Integration / Slice Tests

- **Backend `@WebMvcTest`:** controller-layer slices with `TestSecurityConfig` (`it_backend/src/test/java/com/kdb/it/common/system/controller/AuthControllerTest.java`).
- **Backend `@SpringBootTest`:** `ItApplicationTests` — context-load smoke test.
- **Entity listener integration:** `AuditLogPersisterTest`, `ChangeLogEntityListenerTest`, `CouncilApprovalEventListenerTest` (JPA + event-driven flow).
- **Repository QueryDSL:** `ProjectRepositoryImplTest` exercises the `RepositoryCustom` / `RepositoryImpl` pair.

### E2E Tests (`it_frontend/tests/e2e/`)

- Framework: Playwright (Chromium only — `workers: 1`, `headless: true`).
- Base URL: `http://localhost:3002` (dev server auto-started by `playwright.config.ts` `webServer`).
- Three projects in `playwright.config.ts`:
  1. `setup` (headed) — manual login, persists session to `.auth/user.json`.
  2. `chromium` — feature tests; each test injects its own auth cookie / API mocks via `setLoggedIn` + `mockApi`.
  3. `auth-tests` — runs `auth.spec.ts` with `storageState: undefined` so login is exercised fresh.
- Scenarios covered: 로그인, 게시판, 결재, 예산, 비용, 문서, 파일 업로드, 프로젝트, 권한 메뉴, 세션, Tiptap 변수, 접근 제어. See `it_frontend/tests/e2e/*.spec.ts`.

## Common Patterns

### Async Testing

```ts
// Vitest
await expect(asyncFn()).resolves.toEqual(expected);
await expect(asyncFn()).rejects.toThrow('에러 메시지');

// Playwright API 응답 대기
const loginResponse = page.waitForResponse(
    res => res.url().includes('/api/auth/login') && res.status() === 200
);
await page.getByRole('button', { name: '로그인' }).click();
await loginResponse;
```

```java
// AssertJ
assertThatThrownBy(() -> authService.login("99999", "pwd", "127.0.0.1", "Agent"))
    .isInstanceOf(RuntimeException.class)
    .hasMessageContaining("사용자를 찾을 수 없습니다");
```

### Error / Failure-path Testing

Backend canonical pattern (`AuthServiceTest`):
```java
// given
given(userRepository.findByEno("99999")).willReturn(Optional.empty());

// when & then
assertThatThrownBy(() -> authService.login("99999", "pwd", "127.0.0.1", "Agent"))
    .isInstanceOf(RuntimeException.class)
    .hasMessageContaining("사용자를 찾을 수 없습니다");
```

Frontend canonical pattern (composables): drive the mock `$fetch` to reject and assert that the toast / re-throw happens at the right layer.

### Test Isolation

- **Frontend:** `clearMocks: true` (`it_frontend/vitest.config.ts`) auto-clears `vi.fn()` state between tests. `beforeEach` resets Pinia via `setActivePinia(createPinia())`.
- **Backend:** `@ExtendWith(MockitoExtension.class)` resets mocks per test. Stateless services + per-method `@Mock` instances.
- **E2E:** `context.clearCookies()` + `localStorage.clear()` per test (`auth.spec.ts` `beforeEach`) to avoid SSO/session bleed-through.

### before/after Hooks

- **Backend:** `@BeforeEach` for service construction (or rely on `@InjectMocks`).
- **Frontend Vitest:** `beforeEach` for Pinia + `vi.clearAllMocks()`.
- **Playwright:** `test.beforeEach` for cookie / storage reset, then per-test `page.route` mocks.

## Mandatory Test Triggers (`it_frontend/CLAUDE.md` §4.10 + `it_backend/CLAUDE.md` §5.9 + 5.14)

- New utility function → unit test covering all branches.
- New store action → success + failure + edge cases.
- New page → at least one Playwright E2E covering the core scenario.
- New Repository / Service query that accepts `bbrC` → both null and value cases (`it_backend/CLAUDE.md` §5.14 TDD 의무).
- HWPX / Excel export changes → update `it_frontend/tests/unit/utils/hwpx.test.ts` (`it_frontend/CLAUDE.md` §4.7.2).
- Cache-affecting changes in `CodeService` → reverify `@CacheEvict` behaviour (`it_backend/CLAUDE.md` §5.5.1).

---

*Testing analysis: 2026-05-19*
