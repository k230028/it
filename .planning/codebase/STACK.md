# Technology Stack

**Analysis Date:** 2026-05-19

## Languages

**Primary:**
- Java 25 — Backend (`it_backend/build.gradle` toolchain `JavaLanguageVersion.of(25)`)
- TypeScript ~5.x — Frontend (`it_frontend/tsconfig.json` extends Nuxt-generated config)
- Vue SFC (`<script setup lang="ts">`) — Frontend components under `it_frontend/app/`
- SQL (Oracle dialect) — DDL/DML scripts in `it_database/migrations/` and `it_backend/src/main/resources/sql/`

**Secondary:**
- JSP — Legacy SSO entry points in `it_backend/src/main/webapp/sso/` (`business.jsp`, `agentProc.jsp`)
- JavaScript (ES modules) — Build/test configs such as `it_frontend/tailwind.config.js`, `it_frontend/eslint.config.mjs`
- PowerShell/Batch — Local DB tooling (`it_database/connect-db.ps1`, `it_database/connect-db.bat`)

## Runtime

**Backend Runtime:**
- JVM: Java 25 (Gradle toolchain enforced in `it_backend/build.gradle`)
- Servlet container: Embedded Tomcat (Spring Boot starter web) plus `tomcat-embed-jasper` for direct JSP execution under `it_backend/src/main/webapp/sso/`
- Deployment artifact: WAR (`it_backend/build.gradle` applies `id 'war'`); local dev via `./gradlew bootRun`, prod via `java -jar ooo.war`
- Server port: 8080 (`http://localhost:8080`)

**Frontend Runtime:**
- Node.js (version not pinned via `.nvmrc`; `@types/node` ^25.5.0 in devDependencies suggests Node 20+)
- Nuxt 4 in SPA mode (`ssr: false` in `it_frontend/nuxt.config.ts`); production output is static via `npm run generate` and served by WebToB (`https://it.kdb.co.kr:20443`)
- Dev port: 3000 (`npm run dev`), E2E dev port: 3002 (`it_frontend/playwright.config.ts`)

**Package Managers:**
- Gradle (Groovy DSL) — Backend; wrapper checked in (`it_backend/gradlew`, `it_backend/gradle/`)
- npm — Frontend; `it_frontend/package.json` + `it_frontend/package-lock.json` (lockfile present)

## Frameworks

**Backend Core:**
- Spring Boot 4.0.5 (`org.springframework.boot` plugin in `it_backend/build.gradle`)
- Spring Web (`spring-boot-starter-web`) — REST controllers under `it_backend/src/main/java/com/kdb/it/**/controller/`
- Spring Data JPA (`spring-boot-starter-data-jpa`) — Repositories under `**/repository/`
- Spring Security (`spring-boot-starter-security`) — Config in `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`
- Spring Validation (`spring-boot-starter-validation`) — Bean Validation on DTOs
- Spring Boot Actuator (`spring-boot-starter-actuator`) — Operational endpoints
- Spring Boot DevTools (`developmentOnly`) — Hot reload in development
- QueryDSL 5.1.0 (jakarta classifier) — Dynamic queries; config bean in `it_backend/src/main/java/com/kdb/it/config/QuerydslConfig.java`

**Backend Cache:**
- Spring Cache abstraction with `ConcurrentMapCacheManager` (in-memory) — see `it_backend/src/main/java/com/kdb/it/config/JpaAuditConfig.java` (`@EnableCaching`, caches `codesByType`, `codesByCid`, `budgetPeriod`)

**Frontend Core:**
- Nuxt 4 (`nuxt` ^4.0.0) — Vue 3 meta-framework, SPA mode
- Vue 3 (`vue` ^3.5.26) + Vue Router (`vue-router` ^4.6.4)
- PrimeVue ^4.5.4 (`primevue`, `@primevue/themes`, `@primevue/nuxt-module`) — UI component library with Aura theme (custom Indigo preset in `it_frontend/nuxt.config.ts`)
- Tailwind CSS ^3.4.17 (`tailwindcss`, `@nuxtjs/tailwindcss`, `autoprefixer`, `postcss`) — Utility CSS (`it_frontend/tailwind.config.js`)
- Pinia ^3.0.4 (`pinia`, `@pinia/nuxt`) — Client state, stores under `it_frontend/app/stores/`
- Tiptap 3.x (`@tiptap/vue-3`, `@tiptap/starter-kit`, plus ~20 `@tiptap/extension-*` packages) — Rich-text editor for guides and review documents

**Frontend Build/Bundler:**
- Vite (bundled with Nuxt) — config tweaks in `it_frontend/nuxt.config.ts` (`vite.optimizeDeps.include` for `react`, `react-dom`, `quill`; `mathlive` excluded for client-only loading)
- Sass ^1.97.2 — Optional styling

**API Documentation:**
- SpringDoc OpenAPI 3.0.3 (`springdoc-openapi-starter-webmvc-ui`) — Swagger UI at `http://localhost:8080/swagger-ui/index.html`, config in `it_backend/src/main/java/com/kdb/it/config/SwaggerConfig.java`

**Testing Frameworks:**
- JUnit 5 (`spring-boot-starter-webmvc-test`, `useJUnitPlatform()` in `it_backend/build.gradle`) — Backend unit/integration tests
- Spring REST Docs (`spring-boot-restdocs`, `spring-restdocs-mockmvc`, `org.asciidoctor.jvm.convert`) — API doc snippets from tests
- Vitest ^4.0.18 (`vitest`, `@vitest/coverage-v8`, `@vitest/ui`) — Frontend unit tests (`it_frontend/vitest.config.ts`)
- Playwright ^1.58.2 (`@playwright/test`) — Frontend E2E tests on port 3002 (`it_frontend/playwright.config.ts`)
- happy-dom ^20.8.3 + `@vue/test-utils`, `@pinia/testing` — Vitest DOM environment and helpers
- JaCoCo 0.8.13 — Backend coverage (70% line/branch/complexity thresholds in `it_backend/build.gradle`)

**Build/Dev Tools:**
- Gradle wrapper — Backend
- Lombok — Backend boilerplate reduction (`@Getter`, `@RequiredArgsConstructor`, `@Slf4j`, `@SuperBuilder`)
- `spring-boot-configuration-processor` — `@ConfigurationProperties` metadata
- ESLint ^9.39.2 + `@nuxt/eslint-config` (flat config in `it_frontend/eslint.config.mjs`, type-aware strict mode)
- cross-env ^10.1.0 — Cross-platform env vars in npm scripts
- ts-node ^10.9.2 — Used by Playwright report generation script

## Key Dependencies

**Backend Critical:**
- `io.jsonwebtoken:jjwt-api:0.13.0` (+ `jjwt-impl`, `jjwt-jackson` runtime) — JWT issuance/validation; used in `it_backend/src/main/java/com/kdb/it/common/system/security/JwtUtil.java`
- `com.oracle.database.jdbc:ojdbc11` (runtime) — Oracle JDBC driver
- `com.querydsl:querydsl-jpa:5.1.0:jakarta` + `querydsl-apt` annotation processor — Type-safe queries; upgraded to 5.1.0 for Snyk SQL-injection mitigation (`SNYK-JAVA-COMQUERYDSL-8400287`)
- `org.jsoup:jsoup:1.18.3` — Server-side HTML sanitization; wrapped by `it_backend/src/main/java/com/kdb/it/common/util/HtmlSanitizer.java`
- `org.apache.tomcat.embed:tomcat-embed-jasper` — Required for direct JSP execution of SSO entry pages
- `ch.qos.logback:logback-*` — Pinned to 1.5.32 via `resolutionStrategy` (Snyk `SNYK-JAVA-CHQOSLOGBACK-15062482`)
- `org.springframework:spring-web/webmvc` — Forced to 7.0.6 via `resolutionStrategy` (Snyk High/Low CVEs)

**Frontend Critical:**
- `primevue` ^4.5.4 + `primeicons` ^7.0.0 — Primary UI component library
- `@tiptap/*` 3.20.x–3.22.x — Rich-text editing across review/guide/board flows
- `isomorphic-dompurify` ^3.0.0 — XSS sanitization for `v-html`; mandatory per `it_frontend/CLAUDE.md` §4.5
- `exceljs` ^4.2.0, `pdfmake` ^0.3.3, `jszip` ^3.10.1, `html2canvas` ^1.4.1 — Excel/PDF/HWPX export pipelines under `it_frontend/app/utils/`
- `chart.js` ^4.5.1 — Dashboard visualization
- `@excalidraw/excalidraw` ^0.17.6 (+ peer `react`, `react-dom` ^18.3.1) — Drawing board attachments; client-only via `it_frontend/app/plugins/excalidraw-css.client.ts`
- `mathlive` ^0.109.0 — Math formula web component (`<math-field>` registered as custom element in `it_frontend/nuxt.config.ts`)
- `quill` ^2.0.2 — Legacy editor pre-bundled via Vite `optimizeDeps.include`
- `better-sqlite3` ^12.8.0 — Present but no current server-side usage detected (SPA mode disables Nitro persistence)
- `lz-string` ^1.5.0 — String compression utility

**Infrastructure:**
- Oracle Database 21c Express Edition (`Version 21.3.0.0.0` per `it_database/README.MD`) — Local dev at `127.0.0.1:1521/XEPDB1`, schema `ITPAPP`
- Oracle Data Pump (`expdp`/`impdp`) — Dump exchange via `it_database/export.par`, `it_database/import.par`, `it_database/EXPDAT.DMP`

## Configuration

**Environment Variables:**
- Backend (`it_backend/src/main/resources/application.properties`):
  - `DB_PASSWORD` — Oracle password (default `kdb1234!!` in dev; must be overridden in prod)
  - `JWT_SECRET` — JWT signing key (default placeholder in dev; must be overridden in prod)
  - `GEMINI_API_KEY` — Google Gemini API key (no default)
  - `EnvironmentValidator` (`it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java`) verifies `spring.datasource.password` and `jwt.secret` at `@PostConstruct`
- Frontend (`it_frontend/.env`, file exists; contents not read):
  - `NUXT_PUBLIC_API_BASE` — Backend base URL; default `http://localhost:8080` (`it_frontend/nuxt.config.ts` `runtimeConfig.public.apiBase`)
  - `NUXT_SSR=false` injected by Playwright webServer (`it_frontend/playwright.config.ts`)

**Key Backend Configs (`it_backend/src/main/resources/application.properties`):**
- `spring.datasource.url=jdbc:oracle:thin:@127.0.0.1:1521/XEPDB1`
- `spring.datasource.username=ITPAPP`
- `spring.jpa.hibernate.ddl-auto=update` (dev convenience; review for prod)
- `spring.jpa.database-platform=org.hibernate.dialect.OracleDialect`
- `jwt.access-token-validity=900000` (15 min)
- `jwt.refresh-token-validity=604800000` (7 days)
- `app.cookie.secure=false` (must be `true` in prod with HTTPS)
- `cors.allowed-origins=http://localhost,http://localhost:3000,http://localhost:3002`
- `app.frontend-url=` (SSO redirect target)
- `app.sso.allow-direct-eno=false`
- `app.dev.user-switch.enabled=true` (must be `false` or removed before prod)
- `app.server.instance-id=SVR1`
- `app.file.base-path=C:/data/files`
- `spring.servlet.multipart.max-file-size=50MB`, `max-request-size=200MB`
- `gemini.api.model=gemini-2.5-flash`, `gemini.api.base-url=https://generativelanguage.googleapis.com`

**Dev profile (`application-dev.properties`):** Toggles `spring.jpa.show-sql=true` and Hibernate SQL TRACE logging. Activated via `--spring.profiles.active=dev`.

**Frontend Configs:**
- `it_frontend/nuxt.config.ts` — SPA (`ssr: false`), Nuxt 4 compat (`future.compatibilityVersion: 4`), PrimeVue Aura+Indigo theme, Korean locale, security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Permissions-Policy`)
- `it_frontend/tsconfig.json` — Extends `.nuxt/tsconfig.json`
- `it_frontend/eslint.config.mjs` — Flat config, type-aware strict, enforces `import type` (`@typescript-eslint/consistent-type-imports`)
- `it_frontend/tailwind.config.js` — `darkMode: 'class'`, content globs scoped to `app/**`, custom `primary` palette (Indigo)
- `it_frontend/vitest.config.ts` — `environment: 'happy-dom'`, coverage thresholds `lines: 70`, custom plugin replaces `import.meta.client/server`
- `it_frontend/playwright.config.ts` — `baseURL: http://localhost:3002`, dedicated `setup`/`chromium`/`auth-tests` projects, auto-starts dev server

**Build Configuration:**
- `it_backend/build.gradle` — Gradle Groovy DSL; key tweaks: forced versions for Logback/Spring (Snyk), JaCoCo with custom excludes (`Q*.class`, configs, DTOs, entities), `-parameters` javac flag, UTF-8 source/Javadoc
- `it_frontend/package.json` scripts — `build` and `generate` raise heap via `NODE_OPTIONS=--max-old-space-size=4096`; `postinstall` runs `nuxt prepare`

**Database Migrations:**
- `it_database/migrations/V{YYYYMMDD_NNN}__{Description}.sql` — Naming convention per root `CLAUDE.md` §4.4; intended for Flyway. **Note:** Flyway is referenced in docs but no Flyway Gradle dependency or `spring.flyway.*` properties are present in `it_backend/build.gradle` or `application.properties`; current 10 scripts in `it_database/migrations/` are applied manually. Tracked as drift in CONCERNS analysis.

## Platform Requirements

**Development:**
- Windows-friendly (paths use `C:/data/files`, PowerShell/Batch DB scripts, `cross-env` for npm scripts)
- Java 25 toolchain available locally (Gradle auto-provisions if missing)
- Node.js (Nuxt 4 supports Node 18+; recommend 20 LTS)
- Oracle DB 21c XE running locally on `127.0.0.1:1521`, PDB `XEPDB1`, user `ITPAPP`
- File upload directory `C:/data/files` must exist and be writable

**Production:**
- WAS: Embedded Tomcat (current packaging is WAR via `id 'war'` plugin — deployable to external Tomcat if needed)
- Web frontend: Static assets generated via `npm run generate` and served by WebToB at `https://it.kdb.co.kr:20443`
- HTTPS mandatory (`app.cookie.secure=true` required; HSTS enabled)
- CORS origins must be overridden away from `localhost` defaults
- Secrets injected via env vars or non-public profile (`DB_PASSWORD`, `JWT_SECRET`, `GEMINI_API_KEY`)
- Shared file storage path (e.g., NAS) recommended for `app.file.base-path`

---

*Stack analysis: 2026-05-19*
