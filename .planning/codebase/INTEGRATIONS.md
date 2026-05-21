# External Integrations

**Analysis Date:** 2026-05-19

## APIs & External Services

**AI / LLM:**
- Google Gemini API — Generative AI for document/file summarization
  - SDK/Client: Spring `RestClient` (no official SDK); direct HTTP calls in `it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java`
  - Base URL: `https://generativelanguage.googleapis.com` (configurable via `gemini.api.base-url`)
  - Model: `gemini-2.5-flash` (configurable via `gemini.api.model`)
  - Auth: API key via env var `GEMINI_API_KEY` → property `gemini.api.key`
  - Endpoint exposure: `GeminiController` under `it_backend/src/main/java/com/kdb/it/infra/ai/controller/GeminiController.java`, restricted by `@PreAuthorize("hasRole('ADMIN')")`
  - Supported MIME types (per `GeminiService.SUPPORTED_MIME_TYPES`): `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`, `text/csv`
  - Trust boundary: Service intentionally avoids wrapping the outbound call in a JPA transaction to keep DB connections free

**Internal SSO (KDB Corporate SSO):**
- Vendor SSO Agent — Single Sign-On for KDB employee directory
  - Entry JSPs: `it_backend/src/main/webapp/sso/business.jsp` (SSO entry), `it_backend/src/main/webapp/sso/agentProc.jsp` (callback)
  - Bridge controller: `it_backend/src/main/java/com/kdb/it/common/system/controller/SsoController.java` (`/sso/loginProc`, `/api/auth/sso/complete`)
  - SSO Agent JAR: Referenced but not currently linked (`// implementation files('libs/sso-agent.jar')` commented out in `it_backend/build.gradle`)
  - Flow: `business.jsp` → `agentProc.jsp` → `/sso/loginProc` (session validation) → `/api/auth/sso/complete` (JWT issuance and redirect to frontend)
  - Session keys used: `ssoVerifiedEno`, `resultCode`, `resultData`, `ssoNext`, `ssoOrigin`
  - Success code: `000000`
  - Direct ENO passthrough toggle: `app.sso.allow-direct-eno=false` (must remain false in prod)
  - Server-side frontend redirect target: `app.frontend-url` (empty in dev = relative path)

**Other External APIs:** None detected. No Stripe, AWS SDK, Sentry, Slack, Twilio, Mailgun, or analytics SDKs in `it_backend/build.gradle` or `it_frontend/package.json`.

## Data Storage

**Primary Database:**
- Oracle Database 21c Express Edition
  - Local dev URL: `jdbc:oracle:thin:@127.0.0.1:1521/XEPDB1`
  - Schema/user: `ITPAPP` (config via `spring.datasource.username` in `it_backend/src/main/resources/application.properties`)
  - Password: `${DB_PASSWORD:kdb1234!!}` — env var override with insecure default
  - JDBC driver: `com.oracle.database.jdbc:ojdbc11` (runtime)
  - Dialect: `org.hibernate.dialect.OracleDialect`
  - DDL strategy: `spring.jpa.hibernate.ddl-auto=update` (dev convenience; should be `validate` or `none` in prod)
  - Local connection helpers: `it_database/connect-db.ps1`, `it_database/connect-db.bat` (prefers `sqlplus`, falls back to SQLcl `sql`)

**Schema Migrations:**
- Directory: `it_database/migrations/` (10 files, naming `V{YYYYMMDD_NNN}__{Description}.sql`)
- Latest scripts (per `it_database/migrations/` listing):
  - `V20260513_003__standardize_sequence_names.sql`
  - `V20260513_004__standardize_indexes.sql`
  - `V20260518_001__RenameGclQttToGclQty.sql`
  - `V20260518_002__StandardizeIoeCDfrCleBgFdtn.sql`
  - `V20260519_001..006__Standardize*` / `Recreate*` (column rename + index rebuild batch)
- **Tooling gap:** Root `CLAUDE.md` §4.4 mandates Flyway, but `it_backend/build.gradle` declares no `flyway` plugin or dependency, and `application.properties` has no `spring.flyway.*` keys. Scripts are currently applied manually via `sqlplus`/SQLcl. Tracked as drift in CONCERNS analysis.

**Auxiliary SQL Scripts:**
- `it_backend/src/main/resources/sql/` — ad-hoc DDL/data fixes (e.g., `cfilem_ddl.sql`, `plan_ddl.sql`, `audit_log_sequences_ddl.sql`, `test_data_council.sql`, sequence fixes). Not Flyway-managed.

**Data Export/Import:**
- Oracle Data Pump — Dump file `it_database/EXPDAT.DMP`; parameter files `it_database/export.par`, `it_database/import.par`

**File Storage:**
- Local filesystem (configurable) — `app.file.base-path=C:/data/files`
  - Implementation: `it_backend/src/main/java/com/kdb/it/infra/file/service/` (`FileService.uploadFileInternal()`)
  - Validation: `it_backend/src/main/java/com/kdb/it/infra/file/FileValidator.java` (extension allow-list)
  - Authorization: `it_backend/src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java`
  - Multi-server safety: filename prefix `app.server.instance-id` (e.g., `SVR1`) prevents collisions on shared NAS
  - Upload limits: `spring.servlet.multipart.max-file-size=50MB`, `max-request-size=200MB`
  - Prod recommendation in `application.properties` comment: shared NAS path

**Caching:**
- In-memory only — Spring Cache abstraction with `ConcurrentMapCacheManager` in `it_backend/src/main/java/com/kdb/it/config/JpaAuditConfig.java`
- Cache regions: `codesByType`, `codesByCid`, `budgetPeriod`
- Eviction: explicit `@CacheEvict(allEntries=true)` on mutating `CodeService` methods
- No Redis, Memcached, or distributed cache configured

**Client-side Storage (Frontend):**
- `useCookie('it-portal-user')` — UX-only auth flag (real auth is the httpOnly JWT cookie)
- `theme-dark` cookie — Dark mode preference (read by inline script in `it_frontend/nuxt.config.ts` `app.head`)
- `localStorage` — Permitted only for UI preferences (e.g., column visibility) per `it_frontend/CLAUDE.md` §4.7.1
- `better-sqlite3` listed as dependency but no current usage detected (SPA mode disables Nitro server features)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based stateless auth — Implementation in `it_backend/src/main/java/com/kdb/it/common/system/security/`
  - `JwtUtil.java` — Token issuance/validation (JJWT 0.13.0)
  - `JwtAuthenticationFilter.java` — Per-request filter, registered before `UsernamePasswordAuthenticationFilter` in `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`
  - `CustomUserDetails.java` — Principal model
- Token transport: httpOnly cookies (`accessToken`, `refreshToken`) issued by `CookieUtil` (`it_backend/src/main/java/com/kdb/it/common/util/CookieUtil.java`)
  - Fallback: `Authorization: Bearer {token}` header for Swagger/Postman
- Token TTL: Access 15 min (`jwt.access-token-validity=900000`), Refresh 7 days (`jwt.refresh-token-validity=604800000`)
- Signing key: `jwt.secret=${JWT_SECRET:...}` (env-overridable; default placeholder must not ship to prod)
- Password hashing: KDB-standard SHA-256 + Base64 with fixed salt (`it_backend/src/main/java/com/kdb/it/common/util/CustomPasswordEncoder.java`) — chosen for legacy SSO compatibility per `it_backend/CLAUDE.md` §5.6
- Brute-force protection: `it_backend/src/main/java/com/kdb/it/common/iam/service/LoginAttemptService.java` — 5 failures / 10-minute lockout, sourced from `TPRMPP_CLOGNH` history (DB-backed, survives restart)
- RBAC model: `CauthI` (qualification grades) × `CroleI` (role mapping)
  - `ITPAD001` = system admin (`ROLE_ADMIN`)
  - `ITPZZ001` = general user
  - `ITPZZ002` = planning manager
  - Frontend constants in `it_frontend/app/types/auth.ts` (`ROLE.ADMIN/USER/DEPT_MANAGER`)
- Authorization gates: `SecurityConfig.filterChain` URL patterns + `@PreAuthorize("hasRole('ADMIN')")` on selected controllers (`PlanController`, `BudgetStatusController`, `BudgetWorkController`, `AdminBoardMetaController`, `GeminiController`)

**Public Endpoints (no auth):**
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `/swagger-ui/**`, `/v3/api-docs/**`, `/swagger-resources/**`, `/webjars/**`, `/swagger-ui.html`, `/error`
- `/sso/**` (JSP SSO assets)
- `/api/auth/sso/complete` (SSO bridge)

**Admin-only Endpoints:**
- `/api/admin/**` (URL pattern)
- `/api/auth/signup` (admin-only by policy)
- `/api/plan/**`
- Domain controllers: `PlanController`, `BudgetStatusController`, `BudgetWorkController`, `AdminBoardMetaController`, `GeminiController`

**Dev-only Endpoints (must be disabled in prod):**
- `DevAuthController` (`/api/auth/dev/users`, `/api/auth/dev/switch-user`) — Gated by `app.dev.user-switch.enabled=true`; default `true` must be flipped before deployment

## Monitoring & Observability

**Error Tracking:** None (no Sentry, Rollbar, Datadog, New Relic SDK in dependencies)

**Health/Metrics:**
- Spring Boot Actuator (`spring-boot-starter-actuator`) — Endpoints auto-registered; explicit exposure configuration not detected in `application.properties` (defaults apply)

**Logging:**
- SLF4J + Logback (Spring Boot default; Logback pinned to 1.5.32 in `it_backend/build.gradle` via `resolutionStrategy`)
- Log levels in `application.properties`:
  - `logging.level.org.hibernate.orm.jdbc.bind=WARN`
  - `logging.level.org.hibernate.type.descriptor.sql.BasicBinder=WARN`
- Dev profile (`application-dev.properties`) elevates Hibernate SQL binding to `TRACE`
- Audit logging: `it_backend/src/main/java/com/kdb/it/domain/log/` + `ChangeLogEntityListener` → `AuditLogPersister` writes to `*L` (log) tables on JPA `@PrePersist`/`@PreUpdate`
- Login history: `TPRMPP_CLOGNH` via `LoginHistoryRepository`; controller `LoginHistoryController`

**Frontend Logging:**
- No frontend error tracker (no Sentry/Bugsnag in `it_frontend/package.json`)
- Console errors are explicitly discouraged per `it_frontend/CLAUDE.md` §4.2.1 — toast notifications via `useToast()` are the user-facing channel

## CI/CD & Deployment

**Hosting:**
- Production WAS: TmaxSoft WebToB serving at `https://it.kdb.co.kr:20443` (frontend) + locally hosted Spring Boot at port 8080 (backend, packaged as WAR)
- No cloud provider SDKs (AWS, GCP, Azure) in dependency manifests — on-prem deployment

**CI Pipeline:**
- Not detected in repo (`.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `azure-pipelines.yml` absent at root)
- JaCoCo XML reports are configured for "CI/CD pipeline integration" (`xml.required = true` in `it_backend/build.gradle`) but no actual pipeline is committed

**Build Artifacts:**
- Backend: WAR file via `./gradlew build` (Spring Boot WAR with embedded Tomcat fallback for external WAS)
- Frontend: Static site via `npm run generate` (Nuxt SPA output under `it_frontend/dist/`)

**Deployment scripts:**
- `it_frontend/run-pw.bat` — Local Playwright runner (also seen at repo root)
- No deployment automation scripts in `it_backend/`

## Environment Configuration

**Required env vars (production):**
- `DB_PASSWORD` — Oracle password for `ITPAPP` (default in code must be removed for prod)
- `JWT_SECRET` — JWT signing key (default in code must be removed for prod)
- `GEMINI_API_KEY` — Google Gemini API key (no default; empty → Gemini disabled)
- Should also override: `cors.allowed-origins` (default lists `localhost`), `app.cookie.secure=true`, `app.dev.user-switch.enabled=false`, `app.frontend-url`
- Frontend: `NUXT_PUBLIC_API_BASE` (default `http://localhost:8080`)

**Secrets location:**
- Dev: Inline defaults in `it_backend/src/main/resources/application.properties` (insecure — prod must inject via env or non-public profile)
- Prod: Environment variables or private Spring profile (per `it_backend/CLAUDE.md` §5.6 / §5.10)
- Validation at startup: `it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java` `@PostConstruct` checks that `spring.datasource.password` and `jwt.secret` resolve to non-blank (but default placeholders still pass — needs `:default` removal)

## Webhooks & Callbacks

**Incoming:**
- `GET /sso/loginProc` — SSO Agent callback (`SsoController`), reads JSP session attributes set by `agentProc.jsp`
- `GET /api/auth/sso/complete` — Frontend-bound redirect after JWT issuance
- No other external webhooks (no payment gateway, no Slack/Discord callbacks)

**Outgoing:**
- Google Gemini API (`https://generativelanguage.googleapis.com`) — POST requests from `GeminiService.generate()` via `RestClient`
- No other outbound integrations (no email SMTP, no SMS, no third-party REST calls beyond Gemini)

---

*Integration audit: 2026-05-19*
