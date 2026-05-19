# Codebase Concerns

**Analysis Date:** 2026-05-19

> Primary source: `TASK.md` (project-tracked backlog of tech debt / known issues).
> This document re-organizes those items plus additional findings from in-code TODO/FIXME comments,
> recent commits, and direct inspection of `application.properties`, auth flow, and large files.

## Tech Debt

**Secret defaults in `application.properties`:**
- Issue: `${DB_PASSWORD:kdb1234!!}` and `${JWT_SECRET:kdb-it-secret-key-...}` still ship with hardcoded fallback values. `EnvironmentValidator.validate()` only checks that the resolved property is non-blank — so an unset env var still resolves to the dev default and starts in production silently.
- Files: `it_backend/src/main/resources/application.properties` (lines 6, 20), `it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java`
- Impact: Critical secret leak risk. Anyone with source access knows the production fallback.
- Fix approach: Strip `:default` from `application.properties` so unset env vars resolve to empty string → `EnvironmentValidator` fails fast on startup.

**`DevAuthController` exposes password-less login in default config:**
- Issue: `@ConditionalOnProperty(name = "app.dev.user-switch.enabled", havingValue = "true", matchIfMissing = true)` — defaults to ENABLED. `application.properties` ships `app.dev.user-switch.enabled=true`. Endpoint `POST /api/auth/dev/switch-user` re-issues JWT cookies for any `eno` without password verification.
- Files: `it_backend/src/main/java/com/kdb/it/common/system/controller/DevAuthController.java`, `it_backend/src/main/resources/application.properties:36`
- Impact: Critical. If deployed with default config, attackers can impersonate any employee including admins.
- Fix approach: Change default to `matchIfMissing = false`, set `app.dev.user-switch.enabled=false` in `application.properties`, and rely on a `dev`-only profile override to enable. Delete file before production cutover.

**`CustomPasswordEncoder` uses SHA-256 + Base64 with no salt:**
- Issue: Sole hash is `MessageDigest.getInstance("SHA-256")` over UTF-8 bytes, then Base64. `msg.update("".getBytes(...))` is a no-op (empty salt). Documented as KDB SSO compatibility requirement with `@SuppressWarnings({"java:S2070","java:S4790","java:S2053","java:S5547"})`.
- Files: `it_backend/src/main/java/com/kdb/it/common/util/CustomPasswordEncoder.java`
- Impact: High. Rainbow-table feasible; weak against credential-dump replay. Acknowledged as governance constraint — flagged here for visibility.
- Fix approach: Track migration to BCrypt/Argon2 via separate governance track (already noted in `it_backend/CLAUDE.md` §5.6).

**`CodeController` POST/PUT missing `@Valid`:**
- Issue: `createCcodem()` and `updateCcodem()` accept request bodies without `@Valid`, breaking the project's "all mutating endpoints require `@Valid`" rule in `it_backend/CLAUDE.md` §5.5.2.
- Files: `it_backend/src/main/java/com/kdb/it/common/code/controller/CodeController.java` (lines 68, 81 per TASK.md; TODO comments at 71, 88)
- Impact: Validation runs only in service layer. Bean Validation rules on DTOs are silently bypassed.
- Fix approach: Add `@Valid` to both mutating endpoint signatures.

**`GeminiService` RestClient lacks timeouts:**
- Issue: `RestClient` instantiated without `connectTimeout`/`readTimeout`. FIXME `[B-H-04]` at line 103.
- Files: `it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java:98-103`
- Impact: High. Gemini API hang → blocked thread → thread pool exhaustion → service-wide DOS.
- Fix approach: Configure `RestClient.builder().requestFactory(...)` with explicit connect/read timeouts (e.g. 5s / 60s).

**`Authorization: Bearer` header fallback enabled in production:**
- Issue: `JwtAuthenticationFilter.getJwtFromRequest()` falls back to `Authorization: Bearer` header after cookie miss (line 166-169). Documented as Swagger/Postman convenience but still active in production.
- Files: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtAuthenticationFilter.java`
- Impact: Medium. Defeats httpOnly cookie XSS protection — a token stolen via JS injection can be replayed via header.
- Fix approach: Gate the header fallback behind a `dev`/`swagger` profile or property, off by default.

**Large service classes exceed style limits:**
- Issue: `ProjectService.java` 1,095 lines, `BudgetWorkService.java` 839, `CostService.java` 761, `AdminService.java` 717. Project rule says <800 lines.
- Files: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`, `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`, `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`, `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java`
- Impact: Medium. High cognitive load, merge conflicts, hard to unit test.
- Fix approach: Extract per-concern delegates (e.g. `ProjectQueryService`, `ProjectMutationService`, `ProjectEnrichmentService`). Follow the existing `ApprovalLineDelegate` extraction pattern.

**Large Vue page components:**
- Issue: `pages/info/plan/[id].vue` 80KB, `pages/info/projects/form.vue` 68KB, `pages/info/projects/[id].vue` 54KB, `pages/budget/list.vue` 50KB, `pages/info/documents/[id]/index.vue` 49KB.
- Files: `it_frontend/app/pages/info/plan/[id].vue`, `it_frontend/app/pages/info/projects/form.vue`, `it_frontend/app/pages/info/projects/[id].vue`, `it_frontend/app/pages/budget/list.vue`, `it_frontend/app/pages/info/documents/[id]/index.vue`
- Impact: Medium. Same as above plus poor reusability and slow IDE response.
- Fix approach: Extract sub-sections into `components/` and domain logic into composables (`useProjectForm`, `usePlanDetail`).

**`stream().collect(Collectors.toList())` legacy usage:**
- Issue: Java 25 environment; `.toList()` (Java 16+) is unmodifiable and clearer.
- Files: many across `common/board` and elsewhere (per TASK.md backend refactoring section)
- Impact: Low. Style/immutability.
- Fix approach: Sweep replace with `.toList()`.

## Known Bugs

**Frontend typecheck failures (2026-05-19 baseline):**
- Symptoms: `npm run typecheck` fails in three places.
- Files:
  - `it_frontend/app/composables/useCouncilCodes.ts` — `statusMap`/`hearingMap`/`memberTypeMap` read non-existent `cNm` field; SoT is `cdvaNm` on `CodeItem`.
  - `it_frontend/app/components/cost/TerminalTableSection.vue`, `it_frontend/app/components/cost/CostFormTableSection.vue`, `it_frontend/app/components/cost/TerminalFormDialog.vue`, `it_frontend/app/pages/info/cost/form.vue` — `dfrCleCOptions` vs `dfr-cle-options` prop name mismatch.
  - `it_frontend/app/pages/info/plan/[id].vue` — ExcelJS `ws.columns` typing and `TiptapEditor` `model-value` receiving `string | undefined`.
- Trigger: `cd it_frontend && npm run typecheck`
- Workaround: None — these compile-time failures block CI/CD.

**Frontend ESLint backlog (2026-05-14 baseline):**
- Symptoms: 62 errors, 137 warnings.
- Files: `it_frontend/app/components/cost/*.vue`, `it_frontend/app/pages/info/council-request/result/[id].vue` (`vue/no-multiple-template-root`), `it_frontend/app/components/EvalSummaryPanel.vue` (`vue/no-parsing-error`, `x-invalid-end-tag`)
- Trigger: `cd it_frontend && npm run lint`
- Workaround: None.

**Backend test suite mass failure (2026-05-17 baseline):**
- Symptoms: Of 194 tests, 155 fail with `NoClassDefFoundError`/`ClassNotFoundException` during Spring context / Mockito init. `compileJava` passes.
- Files: needs root-cause investigation in `it_backend/build.gradle` dependency graph + test classpath
- Trigger: `cd it_backend && ./gradlew test`
- Workaround: None — masks regressions in any code under test.

**`Object[]` native-query mapping in `CouncilRepository.findWithDetails()`:**
- Symptoms: 16-column tuple positionally consumed in service layer.
- Files: `it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java`
- Trigger: Add/remove/reorder a column in the native SQL.
- Workaround: Maintain SELECT column order in lockstep with service casting. Document the contract until DTO projection is added.

**Silent JSON parse failure in `PlanService.applyExistingPlanSnapshot()`:**
- Symptoms: Empty `catch (JsonProcessingException) {}` causes count-zero fallback. Budget reports may show wrong numbers without any log.
- Files: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java:108-117` (FIXME `[B-H-05]`)
- Trigger: Corrupted snapshot JSON in `BPLANM` row.
- Workaround: None — failure is invisible.

**Frontend `BoardCommentTree.vue` swallows errors:**
- Symptoms: 4 separate `catch {}` blocks without error binding (lines 44, 61, 86, 101). Comment register/edit/delete failures silently no-op.
- Files: `it_frontend/app/components/board/BoardCommentTree.vue` (FIXME `[F-H-04]`)
- Trigger: Any 4xx/5xx from board comment APIs.
- Workaround: None.

**Tiptap blob URL leak on image insertion:**
- Symptoms: `URL.createObjectURL(...)` blob not revoked on success or failure paths. Memory grows per upload attempt.
- Files: `it_frontend/app/composables/useTiptapImageInsertion.ts:60, 111, 135` (FIXME `[F-H-10]`)
- Trigger: Repeated image insertion in long editor sessions.
- Workaround: Refresh page periodically.

**`it-portal-user` cookie / `localStorage` parse silent failure:**
- Symptoms: Empty `catch {}` on `JSON.parse` of cookie and legacy localStorage. Corrupted cookie leaves user authenticated-but-empty.
- Files: `it_frontend/app/stores/auth.ts:225-227, 237-239`
- Trigger: Manual cookie tamper / migration leftover.
- Workaround: Clear cookies.

**`approval/list.vue` uses `alert()` instead of toast:**
- Symptoms: UX inconsistency — modal alert breaks SPA flow.
- Files: `it_frontend/app/pages/approval/list.vue:204-206`
- Trigger: Approval action error path.
- Workaround: User dismisses alert.

## Security Considerations

**`app.cookie.secure=false` default + no startup gate:**
- Risk: Cookies sent over plain HTTP in production if env var not overridden.
- Files: `it_backend/src/main/resources/application.properties:26`
- Current mitigation: Documented requirement in CLAUDE.md. No runtime check.
- Recommendations: Add `EnvironmentValidator` rule that fails startup when active profile is `prod` and `app.cookie.secure!=true`. Also check `cors.allowed-origins` for `localhost`.

**`X-Forwarded-For` blindly trusted:**
- Risk: IP spoofing for audit logs and brute-force counters.
- Files: `it_backend/src/main/java/com/kdb/it/common/system/controller/AuthController.java` (`getClientIp()`)
- Current mitigation: None at app level — relies on perimeter Nginx to overwrite.
- Recommendations: Validate request hop against a trusted-proxy allowlist. Document in deployment runbook.

**File access endpoints missing ownership checks:**
- Risk: Any authenticated user can `GET /api/files/{flMngNo}` download, preview, retrieve metadata; can `PUT` metadata for arbitrary `flMngNo`; can bulk `DELETE` by `orcDtt+orcPkVl`.
- Files: `it_backend/src/main/java/com/kdb/it/infra/file/controller/FileController.java` (download/preview/get/updateMeta/deleteByOrc paths), `it_backend/src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java`
- Current mitigation: Only single-file `DELETE` calls `FileOwnershipChecker.checkOwnership()`. Other paths require authentication only.
- Recommendations: Wire `FileOwnershipChecker.checkReadAccess()` into download/preview/get/list; add write-access check on updateMeta/deleteByOrc.

**Gemini request DTO lacks size/count caps:**
- Risk: Prompt-injection, large-file abuse, runaway cost.
- Files: `it_backend/src/main/java/com/kdb/it/infra/ai/dto/GeminiDto.java`, `it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java`
- Current mitigation: `@PreAuthorize("hasRole('ADMIN')")` on controller. No `@NotBlank`/`@Size` on request. No per-file size check before `Files.readAllBytes(filePath)`.
- Recommendations: Add `@Size` on prompt, max-attachment count, and reject files larger than 20MB before read.

**`SecurityConfig` admin URL pattern mismatch:**
- Risk: `/api/plan/**` in `SecurityConfig` does not match the actual controller path `/api/plans/**`. Today saved by class-level `@PreAuthorize` on `PlanController`, but the double-gate is missing.
- Files: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`, `it_backend/src/main/java/com/kdb/it/domain/budget/plan/controller/PlanController.java`
- Current mitigation: Class-level annotation.
- Recommendations: Correct the URL pattern.

**`SecurityConfig` CORS `allowedHeaders=List.of("*")`:**
- Risk: Wildcard accepts any custom header from cross-origin requests.
- Files: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java:200`
- Current mitigation: Origin allowlist still enforced.
- Recommendations: Explicit allowlist (`Content-Type`, `Authorization`, `X-Requested-With`).

**`UserDto.DetailResponse` PII exposure:**
- Risk: `GET /api/users/{eno}` may return mobile, extension, email to any authenticated user.
- Files: `it_backend/src/main/java/com/kdb/it/common/iam/dto/UserDto.java`, `it_backend/src/main/java/com/kdb/it/common/iam/controller/UserController.java:72`
- Current mitigation: Authenticated-only.
- Recommendations: Restrict to self or ADMIN at controller/service.

**Logged employee numbers (`eno`) classified as PII:**
- Risk: `INFO` logs leak employee IDs.
- Files: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java:94`, plus login history print sites
- Current mitigation: None.
- Recommendations: Downgrade to `DEBUG` or mask (e.g. middle 4 digits).

**Refresh-Token rotation missing:**
- Risk: Stolen refresh token grants 7-day access window.
- Files: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java:206-236`
- Current mitigation: None — only access token re-issued on refresh.
- Recommendations: Rotate refresh token on every `/api/auth/refresh`, persist new hash, invalidate prior.

## Performance Bottlenecks

**`BudgetWorkService.getProjectSummary()` N+1:**
- Problem: BBUGTM loop issues individual `gclMngNo→prjMngNo` SELECT and per-project `resolveProjectName()` SELECT.
- Files: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java:600, 683`
- Cause: Per-row entity lookup inside loop.
- Improvement path: Batch IN-clause query.

**`BudgetWorkService.applyRates()` per-row upsert:**
- Problem: SELECT-then-UPDATE per row.
- Files: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java:150-213`
- Cause: ORM dirty-checking per record.
- Improvement path: Oracle `MERGE INTO` or `@Modifying` bulk update.

**`CostService.enrichCostListBatch()` terminal attachment N+1:**
- Problem: Per-terminal `attachTerminals()` SELECT inside loop.
- Files: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:508, 531, 598`
- Cause: Row-by-row enrichment.
- Improvement path: Single IN-clause batch fetch.

**`ProjectService.enrichProjectListBatch()` BITEMM summary N+1:**
- Problem: Per-project BITEMM summary SELECT.
- Files: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:662, 684, 783`
- Cause: Same pattern.
- Improvement path: Batch by project-key set.

**`ApplicationService.getPendingCount()` full-entity load then `.size()`:**
- Problem: Loads full entities to count them.
- Files: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java:535`, `ProjectRepositoryImpl.java:140`, `CostRepositoryImpl.java:163`
- Cause: Missing count query.
- Improvement path: `count()` projection.

**`ProjectRepositoryImpl`/`CostRepositoryImpl` `selectFrom` over full entity:**
- Problem: All columns including 1000-char text columns fetched for list endpoints.
- Files: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepositoryImpl.java:140`, `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepositoryImpl.java:163`
- Cause: No DTO projection.
- Improvement path: QueryDSL `Projections.bean()` excluding heavy columns.

**Approval/dashboard query indexes:**
- Problem: `ApplicationRepository` filters `CDECIM.DCD_ENO/DCD_DT`, `CAPPLM.APF_STS/RQS_DT` without verified indexes.
- Files: `it_backend/src/main/java/com/kdb/it/common/approval/repository/ApplicationRepository.java`
- Cause: Index coverage gap.
- Improvement path: Add `CDECIM(DCD_ENO, DCD_DT, DCD_MNG_NO)` and `CAPPLM(APF_STS, RQS_DT DESC)`. Track as Flyway migration.

**Review comment author name N+1:**
- Problem: Per-comment `userRepository.findById()` inside list query.
- Files: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ReviewCommentService.java`
- Cause: Lazy author resolution.
- Improvement path: Batch fetch by eno set or join projection.

**Frontend client-side pagination (`size=1000`):**
- Problem: Board posts list loads all rows client-side.
- Files: `it_frontend/app/pages/board/**`
- Cause: Server-side pagination not wired.
- Improvement path: Backend `Page<T>` + UI lazy-load.

## Fragile Areas

**`ChangeLogEntityListener.beforeAnyOperation()` audit-log resilience:**
- Files: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java:75-93`
- Why fragile: `catch (Exception)` only `log.warn` without stack trace. `delYn` reflection fallback to `'U'` on failure (FIXME `[B-C-02]`). Audit gaps go unnoticed.
- Safe modification: Log full stack trace; alert on repeated failures.
- Test coverage: Listed in JaCoCo exclusions, integration tests weak (TASK.md item).

**`ApplicationService.getApplicationsByIds()` / `ProjectService.findByIds()` / `CostService.findByIds()`:**
- Files: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java:440`, `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:564`, `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:351`
- Why fragile: `IllegalArgumentException` caught → `null` returned → caller `.filter(Objects::nonNull)` hides failed lookups. Failure count invisible to caller. (FIXME `[B-C-03/04/05]`)
- Safe modification: Aggregate failed IDs and throw or return a result wrapper.
- Test coverage: Not exercised in current backend test runs.

**HWPX/PDF/Excel export pipeline:**
- Files: `it_frontend/app/utils/hwpx.ts`, `it_frontend/app/utils/hwpx-images.ts`, `it_frontend/app/utils/hwpx-package-xml.ts`, `it_frontend/app/composables/useHwpxExport.ts`, `it_frontend/app/composables/usePdfReport.ts`
- Why fragile: HTML parsing, image packaging, and XML generation are intertwined. Korean font fallback to Roboto without warning. Image-fetch failures return `null` silently.
- Safe modification: Always run `tests/unit/utils/hwpx.test.ts` after any change. Surface missing-image list to user.
- Test coverage: Partial unit tests only; TASK.md notes export regression-test coverage as Medium priority.

**`CouncilRepository.findWithDetails()` positional `Object[]`:**
- Files: `it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java`
- Why fragile: 16-column positional tuple consumed by service casts. Column reorder = silent mismapping.
- Safe modification: Migrate to DTO projection / `@SqlResultSetMapping`.
- Test coverage: Sparse.

**`stores/review.ts` in-memory session state:**
- Files: `it_frontend/app/stores/review.ts`
- Why fragile: Session/comment state lives only in memory; refresh wipes review session. Multiple `console.warn`/toast omissions hide API failures.
- Safe modification: Move session to server (HIGH backlog item). Until then, treat as best-effort UI.
- Test coverage: Limited.

**`pages/info/projects/form.vue` (68KB):**
- Files: `it_frontend/app/pages/info/projects/form.vue`
- Why fragile: Single SFC mixes load/save/sync logic; multiple silent catches (lines 376, 432, 503, 567, 874, 934).
- Safe modification: Avoid touching unless splitting into sub-components and composables.
- Test coverage: Page-level E2E exists; unit coverage poor.

## Scaling Limits

**Single-server file storage:**
- Current capacity: Local disk at `app.file.base-path=C:/data/files`.
- Limit: Single-server bound. `app.server.instance-id=SVR1` prefix prevents collisions but does not share storage.
- Scaling path: Mount NAS share (per inline comment) or move to object storage (S3/MinIO).

**Stateless logout window:**
- Current capacity: JWT verified per-request, no revocation list.
- Limit: After logout, stolen access token usable up to 15 minutes.
- Scaling path: Optional Redis-backed access-token blocklist for high-security flows.

**Login Brute-force counter DB-backed:**
- Current capacity: `LoginAttemptService` queries `TAAABB_CLOGNH` via `countByEnoAndLgnTpAndLgnDtmAfter()`. Survives restart.
- Limit: No per-IP or per-device limit. Heavy login traffic hits DB on every attempt.
- Scaling path: Add Redis sliding-window for IP plus existing DB layer for `eno`.

**View-count single-instance race:**
- Current capacity: Board post view-count updated in DB on each read.
- Limit: Multi-instance deployment will race-condition the counter.
- Scaling path: Redis INCR (listed as backlog item).

## Dependencies at Risk

**`Bgdocm.docCone` BLOB → CLOB migration outstanding:**
- Risk: Inconsistency with board content type.
- Impact: Type-checking edge cases, casting friction.
- Migration plan: Flyway migration in `it_database/migrations/` to alter column.

**Oracle Text indexes for body search:**
- Risk: Per-board search ≥10k rows hits 1s+ latency without `CONTAINS()`.
- Impact: Search UX degrades as board grows.
- Migration plan: Create Oracle Text index when traffic crosses threshold.

## Missing Critical Features

**Refresh Token Rotation:** No rotation on `/api/auth/refresh` (only access token re-issued). Blocks: high-security audit posture, regulatory requirements.

**`NotFoundException` distinct from 400:** All `IllegalArgumentException` mapped to 400. Blocks: HTTP-correct API contract (404 cases at `UserController.java:72`, `GuideDocService.java:65, 129, 154` currently surface as 400).

**`ResponseStatusException` dedicated handler:** Service-thrown 404/500 status downgraded to 400 by the broad `RuntimeException` handler. Blocks: REST status fidelity from `PlanService.java`.

**Common `useDeptFilter` composable:** Documented as a rule in `it_frontend/CLAUDE.md` but no implementation. Blocks: consistent `bbrC` filter behavior across list pages.

**Board attachments UI/API:** Post type has `flApgYn`/`flNbr` only; upload flow not wired. Blocks: file sharing on community boards.

**Server-side board pagination:** Frontend pages with `size=1000`. Blocks: scaling beyond a few thousand posts.

**`Alrm` notification table & feature:** Untracked PRD in `prds/ing/PRD_20260519.md` outlines a notification system (approval requests, mentions, badge) — not yet designed or implemented.

## Test Coverage Gaps

**Backend audit-log listener integration tests:**
- What's not tested: `ChangeLogEntityListener` ↔ `AuditLogPersister` flow.
- Files: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java`, `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java`
- Risk: Audit log failures invisible (currently `log.warn` only).
- Priority: Medium (TASK.md).

**HWPX/PDF/Excel export end-to-end:**
- What's not tested: Image packaging, XML generation, Excalidraw SVG embedding.
- Files: `it_frontend/app/utils/hwpx.ts`, `it_frontend/app/composables/useHwpxExport.ts`, `it_frontend/app/composables/usePdfReport.ts`
- Risk: Silent missing-image / font-fallback outputs.
- Priority: Medium.

**Backend overall — Spring context init failing:**
- What's not tested: 155 of 194 tests fail; effectively no Spring-integrated tests run.
- Files: project-wide via `it_backend/build.gradle` and `it_backend/src/test/`
- Risk: Regressions ship silently.
- Priority: High.

**Board service unit coverage:**
- What's not tested: `BoardMetaService`, `BoardPostService` below 80% target.
- Files: `it_backend/src/main/java/com/kdb/it/common/board/service/`
- Risk: Permission/sanitization regressions.
- Priority: Medium.

**`/admin/boards` layout/auth E2E:**
- What's not tested: Admin board page declares only `middleware: 'admin'` without `layout: 'admin'`; behavior under role tampering.
- Files: `it_frontend/app/pages/admin/boards.vue` (and related)
- Risk: UX/role-visibility regression.
- Priority: Medium.

**Token-refresh original-request retry:**
- What's not tested: `$apiFetch` 401 → refresh → retry path E2E.
- Files: `it_frontend/app/plugins/auth.ts`
- Risk: Refresh succeeds but caller never receives the retried response.
- Priority: Medium.

**Frontend admin tamper E2E:**
- What's not tested: `it-portal-user` cookie manipulation should not transiently expose admin views even if backend rejects API.
- Files: `it_frontend/app/middleware/admin.ts`
- Risk: UX leak of admin pages.
- Priority: Medium.

---

*Concerns audit: 2026-05-19*
