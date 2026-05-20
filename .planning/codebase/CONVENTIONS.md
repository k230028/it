# Coding Conventions

**Analysis Date:** 2026-05-19

## Comment Policy (전사 규칙)

Per `CLAUDE.md` §4.1 (한글 주석 원칙):

- All new comments (JavaDoc / TSDoc / inline) MUST be written in **Korean (한글)**.
- Skip comments on trivial assignments / accessor methods.
- Public APIs, service methods, composable return functions: document inputs, failure conditions in Korean.
- TODO / FIXME entries must be actionable sentences. Long-term tasks belong in `TASK.md` (root) or per-module `TASK.md`.
- File header blocks use the established banner pattern:
  ```ts
  /**
   * ============================================================================
   * [path/file.ts] 한 줄 요약
   * ============================================================================
   * 상세 설명...
   * ============================================================================
   */
  ```
  Examples: `it_frontend/app/utils/common.ts`, `it_frontend/app/stores/auth.ts`, `it_frontend/app/composables/useApiFetch.ts`.

## Naming Patterns

### Database / Entity / Column (SoT: `META.md` + `DOMAIN.md`)

**Table naming (`it_backend/CLAUDE.md` §5.2):**
- Pattern: `TAAABB_{1자리 구분값}{4자리 도메인}{1자리 용도}`
- 1자리 구분값: `C` (공통), `B` (비즈니스)
- 4자리 도메인: domain-specific (e.g., `BLBC`, `USER`, `PROJ`)
- 1자리 용도: `M` (마스터), `L` (로그), `H` (이력), `I` (인덱스/매핑 — observed)
- Examples: `TAAABB_CBLBMM` (공통 게시판 메타), `TAAABB_BPROJM` (비즈니스 사업 마스터), `TAAABB_CLOGNH` (공통 로그인 이력).

**Column naming:**
- All columns MUST resolve to a `DOMAIN.md` term (예: 금액 → `*_AMT`, 일자 → `*_DT`, 여부 → `*_YN`, 명칭 → `*_NM`, GUID → `GUID`, 사용자ID → `*_USID`).
- Reserved common columns (BaseEntity): `DEL_YN`, `GUID`, `FST_ENR_DTM`, `FST_ENR_USID`, `LST_CHG_DTM`, `LST_CHG_USID`.
- Soft delete only — `DEL_YN='Y'`. Physical delete is forbidden.
- `@Column(name = "...", length = ..., comment = "...")` is **required** on entity fields (`it_backend/CLAUDE.md` §5.2 example).

### Java (Backend)

- Classes / Records / Enums: `PascalCase` (e.g., `AuthService`, `BprojmL`, `Ccodem`).
- Methods / fields / parameters / locals: `camelCase`.
- Constants (`static final`): `SCREAMING_SNAKE_CASE` (e.g., `CookieUtil.ACCESS_TOKEN_COOKIE`).
- Packages: lowercase reverse domain — root `com.kdb.it.*`.
- Entity classes follow the table physical name in PascalCase: table `TAAABB_CUSERI` → entity `CuserI`; table `TAAABB_BPROJM` → entity `Bprojm`; log entities suffixed `L` (e.g., `BprojmL`, `CcodemL`).
- DTO classes group related shapes via nested static classes — file `AuthDto.java` contains `AuthDto.LoginRequest`, `AuthDto.LoginResponse`, `AuthDto.SignupRequest` (`it_backend/CLAUDE.md` §5.3).

### TypeScript / Vue (Frontend)

- Components: `PascalCase.vue` (e.g., `AppSidebar.vue`, `StyledDataTable.vue`, `EmployeeSearchDialog.vue`).
- Composables: `useXxx.ts` with `use` prefix (e.g., `useApiFetch`, `useBoard`, `useTableCellSelection`).
- Stores: lowercase `xxx.ts` under `app/stores/` (e.g., `auth.ts`, `review.ts`). Store id matches filename: `defineStore('auth', ...)`.
- Utilities: lowercase / kebab-case under `app/utils/` (`common.ts`, `hwpx.ts`, `hwpx-images.ts`).
- Types: lowercase under `app/types/` (`auth.ts`, `board.ts`, `review.ts`).
- Functions / variables / locals: `camelCase`.
- Booleans: `is` / `has` / `should` / `can` prefix (`isAuthenticated`, `isAdmin`, `isRefreshing`).
- Types / Interfaces: `PascalCase` (`User`, `LoginRequest`, `ApiFetchOptions`).
- Role constants: `UPPER_SNAKE_CASE` exposed via `ROLE` object — `ROLE.ADMIN` / `ROLE.USER` / `ROLE.DEPT_MANAGER` (`it_frontend/app/types/auth.ts`).
- Files emitted by Tiptap / PrimeVue passthrough: keep PascalCase component prop names; use `kebab-case` for DOM-bound props in templates.

## Code Style

### Backend (Java)

**Formatting:**
- No Checkstyle / Spotless configuration is currently present in `it_backend/build.gradle`. JavaDoc encoding is fixed to `UTF-8`. `tasks.withType(JavaCompile)` enforces `options.encoding = 'UTF-8'` and `-parameters` (required by Spring 6.1+ implicit name removal).
- Indentation observed: 4 spaces (mixed tabs in some legacy files — keep file-local style consistent).

**Lombok usage (`it_backend/CLAUDE.md` §5.1):**
- `@Getter`, `@RequiredArgsConstructor`, `@SuperBuilder`, `@NoArgsConstructor` are the canonical set.
- Constructor injection via `@RequiredArgsConstructor` + `private final` (no field injection).
- Entities use `@SuperBuilder` so subclasses (log entities under `domain/log`) can extend `BaseEntity` / `BaseLogEntity`.

**Swagger / Validation (`it_backend/CLAUDE.md` §5.5.2):**
- Every mutating endpoint (POST / PUT / DELETE) request body uses `@Valid`.
- DTOs MUST carry `@Schema(name, description)`.

### Frontend (TypeScript / Vue)

**Linting (`it_frontend/eslint.config.mjs`):**
- Base: `@nuxt/eslint-config/flat` with `tooling: true` + `typescript.strict: true`.
- Custom rules:
  - `@typescript-eslint/no-unused-vars: warn` with `argsIgnorePattern: '^_'` and `varsIgnorePattern: '^_'`.
  - `@typescript-eslint/consistent-type-imports: error` — type-only imports must use `import type`.
  - `no-undef: off` (TS handles this more accurately).
- Ignored paths: `tailwind.config.js`, `eslint.config.mjs`, `coverage/**`, `test-results/**`, `.nuxt/**`, `.output/**`, `dist/**`.
- Run via `npm run lint` (from `it_frontend/`).

**TypeScript:**
- `it_frontend/tsconfig.json` extends `./.nuxt/tsconfig.json` (Nuxt-generated strict config).
- `<script setup lang="ts">` required for components (`it_frontend/CLAUDE.md` §4.1).
- Type-only imports: `import type { Foo } from '...'`.

**No formatter config (Prettier / Biome) committed.** Observed source uses 4-space indentation in `app/composables/**` and `app/utils/**`, with single quotes for strings.

## Import Organization

**Frontend (observed pattern in `it_frontend/app/composables/useApiFetch.ts`, `it_frontend/app/stores/auth.ts`):**
1. Type-only imports (`import type { ... }`).
2. Third-party libraries (`primevue/usetoast`, `pinia`).
3. Project imports via `~/` alias (`~/types/auth`, `~/utils/common`).

**Backend (observed pattern in `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`):**
1. `com.kdb.it.*` project imports (alphabetised).
2. `lombok.*` annotations.
3. `org.springframework.*` framework imports.
4. `java.*` / `java.util.*` standard library.

**Path aliases (frontend):**
- `~` and `@` both resolve to `app/` (configured in `nuxt.config.ts` and mirrored in `it_frontend/vitest.config.ts` resolve.alias).
- `#imports` is the Nuxt auto-import alias; in tests it is replaced by `vue` (vitest config).

## Error Handling

### Frontend (`it_frontend/CLAUDE.md` §4.2.1)

- **Forbidden:** `console.error` alone — no user feedback.
- **Required:** API failure surfaces via PrimeVue `useToast()` or an inline UI overlay.
- Canonical pattern:
  ```ts
  import { useToast } from 'primevue/usetoast';
  const toast = useToast();
  try {
      await $apiFetch('/api/projects', { method: 'POST', body: payload });
      toast.add({ severity: 'success', summary: '완료', detail: '저장되었습니다.', life: 3000 });
  } catch (error) {
      const message = (error as { data?: { message?: string } })?.data?.message
          ?? '작업 처리 중 오류가 발생했습니다.';
      toast.add({ severity: 'error', summary: '오류', detail: message, life: 3000 });
  }
  ```
- Sensitive server-side messages should be rewritten to generic UI text.
- **Pinia store actions** (`it_frontend/CLAUDE.md` §4.8.1): propagate the error to the caller (throw or no `catch`). Toast in components, not stores — prevents dependency inversion.
- `useApiFetch` (`it_frontend/app/composables/useApiFetch.ts`) handles 401 → refresh → retry, plus de-duplicates network-error toasts within 1s using a module-level timestamp.

### Backend (`it_backend/CLAUDE.md` §6 + global exception handler)

- Domain failures throw `RuntimeException` subclasses with Korean messages — e.g., `throw new RuntimeException("사용자를 찾을 수 없습니다.")` (`it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`).
- `GlobalExceptionHandler` (`it_backend/src/main/java/com/kdb/it/exception/`) maps exceptions to API responses; see `GlobalExceptionHandlerTest` for the contract.
- HTTP status mapping: `200`, `201`, `204`, `400`, `401`, `403` (per `it_backend/CLAUDE.md` §6). Never expose stack traces or SQL errors in responses.
- `@Valid` failures auto-map to `400 Bad Request`.

## Logging

**Backend:** SLF4J / Logback (`logback 1.5.32` forced via Snyk rule in `it_backend/build.gradle`). No `System.out.println` in production code.

**Frontend:** No structured logger configured. `console.log` is generally forbidden in production code (per global TS rules); UI feedback is the PrimeVue toast (`it_frontend/CLAUDE.md` §4.2.1). `console.error` alone is explicitly forbidden — must accompany user-visible feedback.

## Comments / JavaDoc / TSDoc

**Korean is mandatory** for all new comments (root `CLAUDE.md` §4.1).

**Frontend file header convention** (heavy banner — observed in `it_frontend/app/utils/common.ts`, `it_frontend/app/stores/auth.ts`, `it_frontend/app/composables/useApiFetch.ts`):
```ts
/**
 * ============================================================================
 * [path/to/file.ts] 짧은 설명
 * ============================================================================
 * 상세 설명, 인증 전략, 사용 원칙 등...
 * ============================================================================
 */
```

**Function-level TSDoc** includes `@param`, `@returns`, `@example` and Korean prose:
```ts
/**
 * 예산 금액을 지정된 단위로 변환하여 포맷팅된 문자열로 반환
 * @param amount - 변환할 원(KRW) 단위의 숫자 금액
 * @param unit   - 표시 단위 ('원' | '천원' | '백만원' | '억원')
 * @returns 로케일 기반으로 포맷팅된 금액 문자열
 * @example formatBudget(1500000, '천원') // → '1,500'
 */
```

**Backend JavaDoc convention** (observed in `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`):
```java
/**
 * 인증(Authentication) 서비스
 *
 * <p>사용자 회원가입, 로그인, 토큰 갱신, 로그아웃 비즈니스 로직을 처리합니다.</p>
 *
 * <p>인증 방식: JWT 기반 Stateless 인증</p>
 * <ul>
 *   <li>Access Token: 단기 유효 (기본 15분)</li>
 *   ...
 * </ul>
 */
```

JavaDoc reference: `it_backend/docs/guides/comment-style.md`.

## Function Design

- **Backend:** Service methods carry transaction annotations (`@Transactional` for writes, `@Transactional(readOnly = true)` for reads — `it_backend/CLAUDE.md` §5.5). Class-level read-only with explicit override on writes is the canonical pattern (used in `CodeService`).
- **Frontend composables:** return an object with named refs / functions (`return { user, isAuthenticated, isAdmin, ... }`). Never return positional tuples.
- Function size: keep <50 lines; extract helpers for branchy logic. `it_frontend/app/utils/common.ts` shows the pattern (`calcCapLevel` / `calcOpLevel` extracted helpers).
- Immutability: prefer `const` + new-object spreads (`{ ...user, name }`). Do not mutate parameters.

## Module Design

### Backend layering (`it_backend/CLAUDE.md` §4.1)

```
Controller → Service → Repository → Oracle DB
```

- Controllers: REST endpoints, thin. `@RestController` + `@RequestMapping("/api/...")`.
- Services: business logic, transactional boundary. `@Service`.
- Repositories: `JpaRepository` for basic CRUD; `RepositoryCustom` + `RepositoryImpl` (QueryDSL) for dynamic queries.
- Entities under `domain/**/entity/` or `common/**/entity/`. Log entities under `domain/log/` use `*L` suffix.

### Frontend layering (`it_frontend/CLAUDE.md` §4.6)

- Source root is `app/` (Nuxt 4 convention — files MUST live under `app/`).
- Pages → composables → stores → API utilities (`useApiFetch` / `$apiFetch`).
- Server-side rendering helpers in `app/plugins/` (`theme.server.ts`, `excalidraw-css.client.ts`, etc.).
- `components/common/**` is auto-prefixed with `Common` — use **explicit imports** for clarity (`it_frontend/CLAUDE.md` §4.9).

## Exports

**Frontend:**
- `export const` for utilities and composables. Default exports avoided.
- Type re-exports use `export type { ... }`.
- No barrel files observed in `app/utils/` or `app/composables/`; each file is imported directly via `~/utils/common`, `~/composables/useApiFetch`, etc.

**Backend:**
- One public top-level class per file (`AuthService.java`, `AuthController.java`).
- DTO files contain nested static classes only (no extra top-level types).

## Security-Sensitive Conventions

- **XSS:** `v-html` content MUST go through `isomorphic-dompurify` on the frontend AND `HtmlSanitizer.sanitize()` on the backend (`it_frontend/CLAUDE.md` §4.5, `it_backend/CLAUDE.md` §5.13).
- **JWT storage:** httpOnly cookies only — never `localStorage` for tokens (`it_frontend/CLAUDE.md` §4.7.1).
- **Admin gates:** `definePageMeta({ middleware: 'admin' })` on the page + `@PreAuthorize("hasRole('ADMIN')")` on the controller (class-level). Frontend middleware is UX-only; backend is the security boundary (`it_frontend/CLAUDE.md` §4.4.1).
- **Secrets:** `spring.datasource.password`, `jwt.secret`, `gemini.api.key` MUST come from environment variables. `EnvironmentValidator` checks at `@PostConstruct` (`it_backend/CLAUDE.md` §5.10). Frontend uses `runtimeConfig` (`it_frontend/CLAUDE.md` §4.3) — never hardcode `apiBase`.

---

*Convention analysis: 2026-05-19*
