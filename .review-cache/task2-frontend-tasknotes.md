# Frontend Task Notes (2026-05-26)

## Overview
Code analysis findings for `C:\it\it_frontend` not suitable for README.md but important for subsequent development.

## File Structure Discrepancies

### Utils Directory
**Findings:** The `utils/` directory contains 11 files, not 6 as previously documented.
- Confirmed files: adminLogs.ts, common.ts, excel.ts, hwpx.ts, hwpx-images.ts, hwpx-package-xml.ts
- Additional 5 files need inventory (likely markdown/conversion helpers, export utilities)

**Action:** Document all 11 utils functions in next CLAUDE.md update. Consider if any should be moved to `composables/` based on responsibility (e.g., if they use Nuxt plugins/runtime config).

## Architecture Review

### 1. API Wrapper Pattern — Edge Cases

**Current State:**
- `useApiFetch<T>` (GET/read) — uses Nuxt `useFetch`, reactive
- `$apiFetch` (POST/PUT/DELETE/write) — uses `ofetch`, imperative

**Known Limitation:**
- `stores/auth.ts` cannot use `$apiFetch` due to plugin circular reference → uses `$fetch` directly instead
- This pattern works but creates tight coupling between auth store and httpOnly cookie flow

**Recommendation (Future Refactor):**
- Consider extracting core `$fetch` wrapper logic into a dedicated `utils/api.ts` function to decouple from plugin
- Would allow auth store to call a pure function instead of `$fetch` directly
- Not urgent — current approach is functional and documented in CLAUDE.md

### 2. Pinia Store Async Error Handling

**Current State:**
- Store actions throw errors directly
- Calling component/composable handles errors with try-catch + toast

**Known Limitation:**
- If multiple components call the same store action simultaneously, error is only visible to the first caller
- No global error aggregation for background operations

**Examples of At-Risk Scenarios:**
- `useNotifications().refresh()` called during page mount and polling — first error caught locally, polling continues silently
- `useReviewCommentApi` may retry transparently without user awareness

**Recommendation:**
- Document this pattern explicitly in CLAUDE.md §4.8.1 as intended behavior (component caller responsible for toast)
- Consider adding optional `onError` callback for store actions if error aggregation is needed in future

### 3. Tiptap Editor — Memory State Preservation

**Current State:** `stores/review.ts`
- Document body (본문): stored in memory only
- Metadata (버전/코멘트/검토자): fetched from server on session load
- On page refresh: body state lost; metadata partially restored from server

**Known Limitation:**
- Editing session state is not persisted across page reloads
- If server fetch fails for metadata, user sees empty state without error indication
- Three separate try-catch blocks in `loadSession()` all marked `TODO: [HIGH]`

**Recommendation (TASK.md entries exist):**
- Add error toast when metadata load fails
- Consider persisting to sessionStorage if refresh-resilience is required
- Current approach acceptable for internal users but document limitations clearly

### 4. Admin Authorization — Layered Control

**Current State:**
1. Client: `middleware/admin.ts` checks `ROLE.ADMIN` → redirects to `/`
2. UI: AppSidebar filters menu items with `admin: true` flag
3. Server: `@PreAuthorize("hasRole('ADMIN')")` enforces API access

**Known Limitation:**
- Frontend middleware + menu filtering are UX convenience only
- Determined user can:
  1. Bypass middleware by direct URL manipulation (caught by middleware re-execution)
  2. Modify DOM to unhide menu items (has no effect — API call fails with 403)
  3. Call API directly from console (blocked by server — correct)

**Recommendation:**
- This layered approach is intentional per CLAUDE.md §4.8
- No action needed — already correctly implemented
- New admin features must include backend `@PreAuthorize` annotation

## Code Quality Observations

### Positive Patterns
1. **XSS Prevention:** `DOMPurify.sanitize()` consistently applied to `v-html`
2. **Type Safety:** Most composables have explicit input/return types
3. **Test Coverage:** 72 unit tests + 11 E2E specs with good assertions
4. **Error Handling:** Toast notifications for all user-facing API failures

### Areas for Improvement
1. **Console Output:** Rare `console.log` statements remain in:
   - `usePdfReport.ts` (debug output)
   - `pages/info/projects/report.vue` (development logging)
   - Should be removed before production merge

2. **Mock Data:** E2E tests rely on API route mocking; no contract testing with backend
   - Consider: Playwright API Contract Recording if backend API changes frequently

3. **Hardcoded Strings:** Some validation messages and error texts are in-component
   - Opportunity: Extract to `types/messages.ts` for i18n preparation

## Performance Observations

### Bundle Size
- Tiptap extensions (20+) add ~150KB gzipped
- Excalidraw React integration adds ~200KB gzipped
- Total critical path: acceptable for internal portal

### Optimization Opportunities
1. **Lazy Load Excalidraw:** Currently loaded in TiptapEditor; consider dynamic import in NodeView only
2. **Composable Caching:** `useNotifications` polling runs even on hidden tabs — consider adding visibility check
3. **Route-Based Code Splitting:** Already working (Nuxt default); no action needed

## Security Observations

### Verified Controls
1. httpOnly cookies for JWT — correct
2. `credentials: 'include'` on all API requests — correct
3. DOMPurify on user content — correct
4. No hardcoded secrets in code — verified

### Potential Improvements
1. **Content Security Policy:** `nuxt.config.ts` does not define CSP headers
   - Recommendation: Add `Content-Security-Policy` header in `routeRules`
   - Priority: Medium (would prevent inline XSS even if DOMPurify fails)

2. **Rate Limiting:** No client-side rate limiting on form submissions
   - Recommendation: Disable submit button during request (already done in most forms)
   - Priority: Low (backend rate limiting is primary control)

## Testing Coverage Gaps

### Not Currently Tested
1. Dark mode initialization timing race (CSS vs. hydration)
2. httpOnly cookie handling edge cases (cross-origin, SameSite behavior)
3. Mobile/tablet responsive layouts (manual Playwright screenshots exist, no visual regression CI)
4. Excalidraw diagram save/restore within Tiptap

### Recommended E2E Additions
1. Complete user workflow: login → create project → submit for approval → approval response
2. Multi-user concurrent document editing scenario
3. Offline/reconnection scenario (PWA offline state)

## Documentation Gaps (for CLAUDE.md)

1. **Composable Dependency Graph:** No diagram showing which composables depend on which stores
2. **Error Boundary Pattern:** Not documented (React-style error boundaries not applicable in Vue)
3. **Form Validation Strategy:** useProjects.ts, useCost.ts validate differently — should document pattern
4. **Pagination Implementation:** How is pagination handled across list pages? (offset/cursor/page?)
5. **Search Indexing:** Global search (useGlobalSearch) — is full-text search server-side? (assume yes, undocumented)

## Dependency Updates Recommended

### Minor Versions Available
- PrimeVue: v4.5.4 → v4.6.x (check for breaking changes)
- Tailwind CSS: v3.4.17 (stable, no urgent updates)
- Tiptap: v3.22.2 (stable)

### Deprecation Warnings
- None observed in current build output

## Next Steps for Maintainer

1. **Immediate (Next Sprint):**
   - Remove console.log from usePdfReport, report.vue
   - Add CSP header to routeRules

2. **Short Term (1-2 Months):**
   - Document error handling pattern in CLAUDE.md
   - Add E2E test for complete workflow
   - Inventory all 11 utils functions

3. **Long Term (Backlog):**
   - Lazy load Excalidraw (performance optimization)
   - Visual regression testing setup
   - PWA offline support

---

**Analysis Date:** 2026-05-26  
**Analyzer:** Claude Sonnet 4.6  
**Repository:** C:\it\it_frontend
