# Test Coverage Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the currently measured backend and frontend coverage gaps to the TEST.md thresholds, repair test-only contract drift, and regenerate the E2E/coverage report without changing business logic.

**Architecture:** Retain production code as the test subject. Extend existing JUnit 5/Mockito and Vitest suites around the real modules, updating only stale assertions, fixture setup, and architecture baselines when verified source behavior has intentionally changed. Validate the full suites, coverage reports, static checks, E2E suite, and HTML report from fresh artifacts.

**Tech Stack:** Java 25, JUnit 5, Mockito, JaCoCo, Nuxt 4, Vue 3, TypeScript, Vitest, Playwright.

**Spec:** `C:\it\TEST.md`

## Global Constraints

- Do not modify production or business-logic source files.
- New test comments are Korean and tests use Arrange-Act-Assert structure.
- Cover success, failure, and boundary cases; do not change coverage exclusions or quality-gate thresholds.
- Use `vi.stubGlobal('$fetch', mockFetch)` for Nuxt global fetch, explicit imports where Vitest lacks Nuxt auto-imports, and `page.route()` only for mocked browser flows.
- Use Mockito/JUnit 5 for services and MockMvc only for controller behavior; Oracle integration remains `./gradlew integrationTest`.

---

### Task 1: Repair stale frontend test contracts

**Files:**
- Modify: `it_frontend/tests/unit/architecture/*.test.ts`
- Modify: `it_frontend/tests/unit/components/**/*.test.ts`
- Modify: `it_frontend/tests/unit/pages/*.test.ts`
- Modify: `it_frontend/tests/unit/composables/cost/useCostFormData.test.ts`

- [ ] Update static architecture baselines to match verified intentional source additions, including editor extension barrel exports, component-location census, maximum-line baseline, refresh-binding allowlist, form-guide catalogue, and user-facing copy expectations.
- [ ] Add a fresh Pinia instance to `EmployeeLink.test.ts` before each mount so nested `EmployeeInfoDialog` can resolve `useAuthStore`.
- [ ] Change stale assertions to test rendered/i18n behavior rather than obsolete literal source text, including project resubmission affordance and resource byte-limit labels.
- [ ] Update `useCostFormData` mock expectations for the verified revision-aware optional argument without losing the single-record date conversion assertion.
- [ ] Run the twelve formerly failing test files and confirm zero failures.

### Task 2: Close frontend composable coverage gaps

**Files:**
- Create: `it_frontend/tests/unit/composables/review/useReviewSessionRequests.test.ts`
- Modify: `it_frontend/tests/unit/composables/useSpeedDial.test.ts`
- Modify: `it_frontend/tests/unit/composables/useTiptapMention.test.ts`
- Modify: `it_frontend/tests/unit/composables/useProjects.direct.test.ts`
- Modify: `it_frontend/tests/unit/composables/useCost.direct.test.ts`
- Modify: `it_frontend/tests/unit/utils/projectExcel.test.ts`
- Modify: `it_frontend/tests/unit/composables/council-access-context.test.ts`

- [ ] Write and run tests for request reuse, key isolation, sync throws, rejection eviction, and retry in `useReviewSessionRequests`.
- [ ] Add validation, success/failure, retry, fallback, stale-response, and cleanup cases for Speed Dial and Tiptap mention behavior.
- [ ] Add revision-aware URLs, empty response/header behavior, history, bulk-version, and reapplication cases to the real project and cost composable tests.
- [ ] Add display-code/null/Y-N fallback table cases for project Excel and direct null/member/admin access-context cases.
- [ ] Run the focused tests, then `npm run test:coverage`; confirm every measured file has all four metrics at least 70%.

### Task 3: Close backend JaCoCo gaps with unit and MVC tests

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/**/*Test.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/speeddial/**/*Test.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/project/**/*Test.java`

- [ ] Add AAA tests for Cost version lookup/history/promotion error branches and controller revision/history/terminal-service request variants.
- [ ] Add listener/service tests for ignored approval events, existing contact-document update, null/blank Q&A notification inputs, and isolated dispatch failures.
- [ ] Add project version/batch null, empty, permission, and revision-boundary cases plus Cost service count/revision/identity fallbacks.
- [ ] Run each changed test class during red-green cycles and then `./gradlew test jacocoTestReport`; confirm all measured class counters meet the six 70% goals.

### Task 4: E2E, reporting, and static verification

**Files:**
- Verify: `it_frontend/tests/e2e/*.spec.ts`
- Generate: `docs/test/test-report-2026-09-03.html`

- [ ] Run the existing Playwright suite and only repair test selectors/mocks when an assertion is demonstrated stale; do not edit application code.
- [ ] Run `npm run generate-report` after fresh coverage and E2E JSON artifacts; inspect that the generated report has four summary cards and sorted threshold failures.
- [ ] Run FE `npm run check`, `npm run lint:css`, `npm run format:check`; run BE `./gradlew clean compileJava --warning-mode all`, `./gradlew javadoc`, and `./gradlew spotlessCheck`.
- [ ] Record fresh command outcomes and unresolved environmental blockers in the final handoff.
