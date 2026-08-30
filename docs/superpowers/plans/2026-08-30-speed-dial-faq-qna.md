# 스피드다이얼 FAQ·Q&A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 화면을 제외한 인증 화면의 우측 하단에서 Tiptap 기반 문의 등록과 FAQ 조회를 제공하고, FAQ 등록 시 활성 시스템관리자 전원에게 GWE 메일을 발송한다.

**Architecture:** 기존 `AppShell`에 전역 `SpeedDial`을 한 번 탑재하고, 프론트는 게시판 ID를 알지 못한 채 전용 speed-dial API만 호출한다. 백엔드는 `IT_PTL_BLB_TC='004'`(FAQ), `IT_PTL_BLB_TC='005'`(Q&A)의 활성 게시판을 resolver로 단일 조회해 범용 게시판 서비스를 재사용한다. FAQ 이벤트는 게시판 유형으로 판정하고 AFTER_COMMIT 알림 아웃박스 경로를 통해 시스템관리자별 GWE 메일로 전달한다.

**Tech Stack:** Spring Boot 4, Java 25, Spring Data JPA, Flyway, Nuxt 4, Vue 3, TypeScript, PrimeVue, Tiptap, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-30-speed-dial-faq-qna-design.md`

## Global Constraints

- FAQ와 Q&A는 각각 `IT_PTL_BLB_TC='004'`와 `IT_PTL_BLB_TC='005'`로 지정한다.
- 런타임 애플리케이션 코드는 `BLBM-0426`와 `BLBM-0427`을 참조하지 않는다. 해당 ID는 초기 데이터 보정 마이그레이션에서만 사용한다.
- FAQ/Q&A 유형별 `USE_YN='Y' AND DEL_YN='N'` 게시판은 정확히 하나여야 하며, 0개 또는 2개 이상이면 임의 선택하지 않고 오류 처리한다.
- 게시글 본문은 서버 `HtmlSanitizer`와 FAQ 표시 전 프론트 `isomorphic-dompurify`를 통과한다.
- 문의 입력과 FAQ 본문 표시에는 `app/components/editor/TiptapEditor.vue`를 사용하고 SSR에서는 `ClientOnly`를 사용한다.
- 알림은 `NotificationOutboxService`와 `NotificationDispatcherRouter`의 GWE 채널 `04`를 재사용하고 FAQ 저장 트랜잭션을 롤백하지 않는다.
- 관리자 화면 판정은 서버 권한 검증과 별개로 프론트 라우트 `/admin` 접두사를 사용한다.
- 모든 구현은 테스트를 먼저 작성하고 실패를 확인한 뒤 최소 코드를 작성한다.

---

### Task 1: FAQ/Q&A 게시판 유형 및 단일 resolver 기반 마련

**Files:**
- Create: `it_database/migrations/V20260830_002__SeedSpeedDialBoardTypes.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardMetaRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardMetaService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/dto/BoardMetaDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/entity/Cblbmm.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardMetaServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/board/repository/BoardMetaListProjectionIt.java` or a focused repository integration test beside it

**Interfaces:**
- Produces `BoardMetaRepository.findAllByItPtlBlbTcAndUseYnAndDelYn(String typeCode, String useYn, String delYn): List<Cblbmm>`.
- Produces a package-visible or `common.board`-usable helper that validates exactly one active special board and throws the project’s common configuration/general exception for duplicate active rows.
- Keeps the generated board management number opaque to all callers after the resolver returns the selected `Cblbmm`.

- [ ] **Step 1: Write the failing tests**

Add service tests that construct two active `Cblbmm` rows and assert the special-board validation rejects them, then construct one row and assert its management number is returned. Add a create-board test that rejects a second active `004` or `005` board before `save`.

```java
@Test
void activeSpecialBoardMustBeUnique() {
    given(repository.findAllByItPtlBlbTcAndUseYnAndDelYn("004", "Y", "N"))
            .willReturn(List.of(board("BLBM-0426"), board("BLBM-9001")));

    assertThatThrownBy(() -> service.requireUniqueActiveBoard("004"))
            .isInstanceOf(CustomGeneralException.class)
            .hasMessageContaining("고유 게시판");
}

@Test
void creatingSecondSpecialBoardIsRejected() {
    given(repository.findAllByItPtlBlbTcAndUseYnAndDelYn("005", "Y", "N"))
            .willReturn(List.of(board("BLBM-0427")));

    assertThatThrownBy(() -> service.createBoard(requestWithType("005")))
            .isInstanceOf(CustomGeneralException.class);
    then(repository).should(never()).save(any());
}
```

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run from `it_backend`: `./gradlew test --tests '*BoardMetaServiceTest'`.

Expected: FAIL because the type-code repository method and unique-board service behavior do not exist yet.

- [ ] **Step 3: Add the migration and minimal repository/service implementation**

The migration must insert common code rows for `004` FAQ and `005` Q&A using the project’s existing common-code table/sequence conventions, update `TPRMPP_CBLBMM.IT_PTL_BLB_TC` for `BLBM-0426` and `BLBM-0427` only when the rows exist, and finish with verification SQL that raises an error unless each code has exactly one active, non-deleted board. Do not add a new table or unique index that would affect unrelated board types.

Add the Spring Data derived query and a `requireUniqueActiveBoard` method that returns the only row, throws NotFound for zero rows, and throws `CustomGeneralException` for multiple rows. Call the same count check in `createBoard` only for `004` and `005`. Extend board type descriptions to include both new codes.

- [ ] **Step 4: Run focused tests and migration checks**

Run `./gradlew test --tests '*BoardMetaServiceTest'` and the focused repository test. Run the project database migration/verification command documented in `it_database/CLAUDE.md`; assert both type codes exist and the active-board count query returns one row per code without printing post contents.

- [ ] **Step 5: Commit the self-contained database/domain change**

```powershell
git add it_database/migrations/V20260830_002__SeedSpeedDialBoardTypes.sql it_backend/src/main/java/com/kdb/it/common/board it_backend/src/test/java/com/kdb/it/common/board
git commit -m "feat: 스피드다이얼 게시판 유형 기준 추가"
```

### Task 2: Type-based speed-dial API and FAQ notification behavior

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/speeddial/controller/SpeedDialController.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/speeddial/dto/SpeedDialDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/speeddial/service/SpeedDialService.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/speeddial/event/FaqRegisteredEvent.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/speeddial/event/FaqRegisteredEventListener.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardMetaRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardPostRepository.java` and its custom implementation if needed for FAQ projection
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/user/repository/RoleRepository.java` or the existing user repository extension for active `ITPAD001` recipients
- Test: `it_backend/src/test/java/com/kdb/it/common/speeddial/service/SpeedDialServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardPostServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/speeddial/event/FaqRegisteredEventListenerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/speeddial/controller/SpeedDialControllerTest.java`

**Interfaces:**
- `GET /api/speed-dial/faqs` returns `List<SpeedDialDto.FaqResponse>` with `postId`, `title`, `contentHtml`, `createdAt`.
- `POST /api/speed-dial/qna` accepts `SpeedDialDto.QnaCreateRequest(screenName, screenUrl, category, content)` and returns `SpeedDialDto.QnaCreateResponse(postId)`.
- `SpeedDialService.requireBoard(String typeCode)` resolves the active board only through `IT_PTL_BLB_TC` and the Task 1 exact-one rule.
- `FaqRegisteredEvent` contains the post management number, title, sanitized content, author employee number/name, and internal FAQ link.

- [ ] **Step 1: Write failing service and event tests**

Test that FAQ lookup calls the repository with `004` rather than any board ID, Q&A creation calls `BoardPostService.createPost` with the board ID returned from a `005` resolver, and invalid category/URL/empty Tiptap content is rejected. Test that a post on type `004` publishes `FaqRegisteredEvent`, while a post on type `002` does not. Test the listener deduplicates active `ITPAD001` employee numbers and enqueues channel `04` events per recipient.

```java
@Test
void qnaUsesResolvedTypeBoardAndNeverClientBoardId() {
    given(boardResolver.requireUniqueActiveBoard("005")).willReturn(qnaBoard("BLBM-CHANGED"));

    String postId = service.createQna(validRequest(), user);

    then(boardPostService).should().createPost(eq("BLBM-CHANGED"), any(), same(user));
    assertThat(postId).isEqualTo("NAC-2026-0001");
}

@Test
void faqCreationPublishesOnlyForFaqType() {
    // Arrange one type-004 board and one normal type-002 board, then create each through BoardPostService.
    // Assert one FaqRegisteredEvent for type 004 and no event for type 002.
}
```

- [ ] **Step 2: Run focused backend tests and verify RED**

Run `./gradlew test --tests '*SpeedDialServiceTest' --tests '*BoardPostServiceTest' --tests '*FaqRegisteredEventListenerTest' --tests '*SpeedDialControllerTest'`.

Expected: FAIL because the speed-dial package, DTOs, type-based resolver, event, and listener do not exist.

- [ ] **Step 3: Implement minimal DTO validation, service, controller, and projection**

Use Bean Validation for enum category `IMPROVEMENT|BUG|OTHER`, internal paths beginning with one `/` and not a protocol/external URL, bounded screen name/URL, and non-empty Tiptap HTML. Build the title/body template from the design spec, call the existing board post service with the resolved Q&A management number, and let that service sanitize the HTML before persistence. FAQ projection must filter deleted posts, enforce the board’s visibility rules, sort deterministically by registration timestamp and management number descending, and cap the response.

Add a type check in `BoardPostService.createPost`: type `004` requires `user.isAdmin()`, and after the post is saved publish the FAQ event only for that type. Keep mention notification behavior unchanged.

- [ ] **Step 4: Implement post-commit GWE notification**

Register an `@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)` listener. Query active, non-deleted users joined to active, non-deleted `CROLEI` rows with `ATH_ID='ITPAD001'`, deduplicate employee numbers, serialize `MailPayload(subject, html)` in `NotificationEvent.sdPayload`, set `itPtlInfmSvcTc='04'`, and enqueue one event per recipient through `NotificationOutboxService`. A zero-recipient result must return normally; enqueue or dispatch failure must be logged under the existing notification policy and never throw into the already-committed FAQ request.

- [ ] **Step 5: Run focused tests and API contract checks**

Run the focused tests again, then the backend OpenAPI/contract test command from `it_backend/CLAUDE.md`. Verify requests contain no board ID field and that a duplicate active special board returns the common conflict/configuration response.

- [ ] **Step 6: Commit the backend feature**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/speeddial it_backend/src/main/java/com/kdb/it/common/board it_backend/src/main/java/com/kdb/it/common/user it_backend/src/test/java/com/kdb/it/common/speeddial it_backend/src/test/java/com/kdb/it/common/board
git commit -m "feat: 스피드다이얼 FAQ Q&A API 추가"
```

### Task 3: Global frontend speed dial and Tiptap dialogs

**Files:**
- Create: `it_frontend/app/types/speed-dial.ts`
- Create: `it_frontend/app/composables/useSpeedDial.ts`
- Create: `it_frontend/app/components/layout/SpeedDial.vue`
- Create: `it_frontend/app/components/layout/SpeedDialQnaDialog.vue`
- Create: `it_frontend/app/components/layout/SpeedDialFaqDialog.vue`
- Modify: `it_frontend/app/components/layout/AppShell.vue`
- Modify: `it_frontend/i18n/messages/layout.ts` and/or the project’s dedicated message module
- Test: `it_frontend/tests/unit/composables/useSpeedDial.test.ts`
- Test: `it_frontend/tests/unit/components/layout/SpeedDial.test.ts`
- Test: `it_frontend/tests/unit/components/layout/SpeedDialQnaDialog.test.ts`
- Test: `it_frontend/tests/unit/components/layout/SpeedDialFaqDialog.test.ts`

**Interfaces:**
- `useSpeedDial()` exposes `isOpen`, `dialogMode`, `qnaForm`, `faqItems`, `faqState`, `openQna()`, `openFaq()`, `closeDialog()`, `submitQna()`, and `retryFaq()`.
- `SpeedDial` receives no board ID or admin state prop; it reads the current route and `useAuth()`/`useMenu()` through the composable or component.
- `SpeedDialQnaDialog` submits only `screenName`, `screenUrl`, `category`, and Tiptap HTML `content`.
- `SpeedDialFaqDialog` renders sanitized FAQ HTML through `TiptapEditor` in `readonly` mode.

- [ ] **Step 1: Write failing composable/component tests**

Cover normal route visibility, `/admin` absence, current screen name from `useMenu().nodeByPath` with route fallback, URL from `route.fullPath`, one selected category, rejection of Tiptap empty HTML, preserving fields after an API failure, clearing after success, FAQ loading/empty/error/retry, and a FAQ HTML script being absent from the rendered output.

```ts
it('prefills the current screen and URL when opening Q&A', () => {
  const { qnaForm, openQna } = useSpeedDial()
  openQna()
  expect(qnaForm.screenName).toBe('정보화사업')
  expect(qnaForm.screenUrl).toBe('/info/projects?tab=active')
})

it('does not render on admin routes', () => {
  const wrapper = mount(SpeedDial, { route: '/admin/boards' })
  expect(wrapper.find('[data-testid="speed-dial"]').exists()).toBe(false)
})
```

- [ ] **Step 2: Run the focused frontend tests and verify RED**

Run from `it_frontend`: `npm test -- tests/unit/composables/useSpeedDial.test.ts tests/unit/components/layout/SpeedDial.test.ts tests/unit/components/layout/SpeedDialQnaDialog.test.ts tests/unit/components/layout/SpeedDialFaqDialog.test.ts`.

Expected: FAIL because the composable and components are not present.

- [ ] **Step 3: Implement composable and dialogs with the common Tiptap editor**

Use `useApiFetch` for the FAQ reactive request and `$apiFetch` for Q&A submission. Snapshot screen metadata when opening the Q&A dialog. Use PrimeVue Checkbox controls with a single category value, `ClientOnly` around `TiptapEditor`, and no attachments. On success show the existing toast mechanism and reset; on failure keep all form values. FAQ dialog must not reuse stale data on a failed refresh and must offer an explicit retry action.

- [ ] **Step 4: Mount the global control and translations**

Mount `SpeedDial` once in `AppShell` near the main content/footer so it stays available across route changes. Use a fixed right/bottom layout with a high stacking context that respects the existing shell and mobile safe area. Hide only `/admin` routes in the UI; login remains excluded because it uses the login layout. Add Korean and English labels/messages for speed dial, form fields, validation, loading, empty, error, retry, and success states.

- [ ] **Step 5: Run focused tests and type/lint checks**

Run the focused Vitest command, `npm run check`, and `npm run format:check`. Fix only feature-related failures and preserve unrelated worktree changes.

- [ ] **Step 6: Commit the frontend feature**

```powershell
git add it_frontend/app/components/layout/AppShell.vue it_frontend/app/components/layout/SpeedDial.vue it_frontend/app/components/layout/SpeedDialQnaDialog.vue it_frontend/app/components/layout/SpeedDialFaqDialog.vue it_frontend/app/composables/useSpeedDial.ts it_frontend/app/types/speed-dial.ts it_frontend/i18n/messages/layout.ts it_frontend/tests/unit/composables/useSpeedDial.test.ts it_frontend/tests/unit/components/layout
git commit -m "feat: 전역 스피드다이얼 UI 추가"
```

### Task 4: OpenAPI-generated types, end-to-end flows, and regression verification

**Files:**
- Modify: generated API files only through the repository’s `npm run codegen` command
- Modify: `it_frontend/tests/e2e/helpers/mockApi.ts`
- Modify: `it_frontend/tests/e2e/board.spec.ts` or create `it_frontend/tests/e2e/speed-dial.spec.ts`
- Modify: `it_backend/docs/guides/integrations/notifications.md` only if the new event contract needs documentation
- Create or modify: the project’s database verification SQL/documentation location required by `it_database/CLAUDE.md`

**Interfaces:**
- E2E mocks expose `GET /api/speed-dial/faqs` and `POST /api/speed-dial/qna` with the exact API schemas from Task 2.
- Generated frontend types are the sole source for API request/response types; do not hand-maintain duplicate OpenAPI models.

- [ ] **Step 1: Write failing E2E scenarios**

Add Playwright scenarios that open a normal authenticated screen, expand the speed dial, open Q&A, confirm screen name/URL defaults, choose a category, enter content through Tiptap, submit, and assert the Q&A request body. Add FAQ open/accordion rendering and `/admin` absence checks.

- [ ] **Step 2: Run E2E tests and verify RED**

Run `npm run test:e2e -- speed-dial.spec.ts` after starting the project test server as documented. Expected: FAIL because the API mocks and UI flow are not implemented or wired.

- [ ] **Step 3: Update mocks, regenerate types, and implement the E2E flow**

Add exact mock responses, run `npm run codegen`, then `npm run codegen:check`. Do not edit generated files manually. Ensure the Q&A mock assertion contains no board management number and the FAQ response uses the projection shape.

- [ ] **Step 4: Run the complete Health Stack**

Backend: `./gradlew test` and the documented migration verification. Frontend: `npm run format:check`, `npm run check`, `npm test`, `npm run lint:css`, and `npm run test:e2e` for the changed user flow. Review failures against the feature diff rather than modifying unrelated dirty files.

- [ ] **Step 5: Inspect the final diff and commit verification assets**

Run `git diff --check` and `git status --short`. Confirm runtime source contains no `BLBM-0426` or `BLBM-0427` reference, the migration is the only place using those initial IDs, admin routes have no speed-dial markup, and notification recipients are deduplicated. Commit only the explicit feature and verification files.

```powershell
git add it_frontend it_backend/docs it_database
git commit -m "test: 스피드다이얼 FAQ Q&A 검증 추가"
```

## Self-Review Checklist

- Spec coverage: global UI, admin exclusion, Tiptap input, current screen metadata, type-based board resolution, Q&A persistence, FAQ display, FAQ permissions, GWE notification, post-commit isolation, sanitization, URL validation, translations, API/OpenAPI, unit tests, and E2E tests are covered by Tasks 1–4.
- Placeholder scan: no `TODO`, `TBD`, or unspecified implementation step is required; all commands, paths, type codes, and test behaviors are concrete.
- Type consistency: Task 1’s `requireUniqueActiveBoard(typeCode)` feeds Task 2’s `SpeedDialService`; Task 2’s request/response DTOs feed Task 3’s composable and Task 4’s generated types/mocks.
- Initial board IDs appear only in the migration task and final verification assertion; all runtime behavior is type-code based.
