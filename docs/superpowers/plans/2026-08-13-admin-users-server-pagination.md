# Admin Users Server Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/users`의 목록·검색·정렬·페이징을 서버 기준으로 변경해 초기 응답과 렌더링을 50건으로 제한한다.

**Architecture:** QueryDSL 커스텀 repository가 사용자·조직을 LEFT JOIN해 `Page<AdminUserView>`와 export 목록을 제공한다. 관리자 서비스가 페이지 크기·정렬 화이트리스트를 보정하고, Nuxt 화면은 PrimeVue lazy DataTable 상태를 반응형 API query와 연결한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, QueryDSL 5.1, JUnit 5/Mockito/MockMvc, Vue 3, Nuxt 4, PrimeVue 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-admin-users-server-pagination-design.md`

## Global Constraints

- 기본 페이지 크기는 50, 화면 선택지는 20·50·100·200, 서버 최댓값은 200으로 한다.
- 검색은 사번·이름·직위·부점코드/명·팀코드/명·이메일·내선·휴대전화에 대소문자 구분 없는 부분 일치를 적용한다.
- 편집 중에는 페이지·페이지 크기·정렬·검색 변경을 차단한다.
- 엑셀은 현재 검색·정렬의 전체 결과를 사용자가 요청할 때만 조회한다.
- DB 스키마, Flyway, 공통 `StyledDataTable`, 기존 POST/PUT/DELETE 계약은 변경하지 않는다.
- 주석·JavaDoc은 한국어로 작성한다.
- 현재 dirty worktree의 관련 없는 변경을 수정·스테이징·커밋하지 않는다.

---

### Task 1: QueryDSL 사용자 페이징 조회

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepository.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/iam/repository/AdminUserPagingRepositoryIt.java`

**Interfaces:**
- Consumes: `CuserI`, `CorgnI`, `UserRepository.AdminUserView`
- Produces: `Page<AdminUserView> findAdminUserPage(String search, Pageable pageable)` and `List<AdminUserView> findAdminUsersForExport(String search, Sort sort)`

- [ ] **Step 1: Write the failing Oracle repository integration tests**

Create fixtures with multiple users and organizations, then assert literal outcomes:

```java
@Test
void 사용자와_조직명을_검색하고_지정한_페이지만_반환한다() {
    Page<UserRepository.AdminUserView> page =
            userRepository.findAdminUserPage("디지털", PageRequest.of(0, 1, Sort.by("eno")));
    assertThat(page.getTotalElements()).isEqualTo(2);
    assertThat(page.getContent()).extracting(UserRepository.AdminUserView::getEno)
            .containsExactly("100001");
    assertThat(page.getContent().getFirst().getBbrNm()).isEqualTo("디지털기획부");
}

@Test
void export_조회는_검색_결과_전체를_정렬해_반환한다() {
    List<UserRepository.AdminUserView> rows =
            userRepository.findAdminUsersForExport("홍", Sort.by(Sort.Direction.DESC, "eno"));
    assertThat(rows).extracting(UserRepository.AdminUserView::getEno)
            .containsExactly("100003", "100001");
}
```

- [ ] **Step 2: Run the repository test and verify RED**

Run: `cd it_backend && ./gradlew integrationTest --tests "*AdminUserPagingRepositoryIt"`

Expected: compilation failure because the two custom repository methods and `getBbrNm()` projection member do not exist.

- [ ] **Step 3: Implement the QueryDSL projection, predicate, count, and sort mapping**

Add `getBbrNm()` to `AdminUserView`. In `UserRepositoryImpl`, build one shared case-insensitive predicate:

```java
BooleanExpression active = cuserI.delYn.eq("N");
BooleanExpression matches = normalizedSearch == null
        ? null
        : cuserI.eno.containsIgnoreCase(normalizedSearch)
                .or(cuserI.usrNm.containsIgnoreCase(normalizedSearch))
                .or(cuserI.ptCNm.containsIgnoreCase(normalizedSearch))
                .or(cuserI.bbrC.containsIgnoreCase(normalizedSearch))
                .or(corgnI.bbrNm.containsIgnoreCase(normalizedSearch))
                .or(cuserI.temC.containsIgnoreCase(normalizedSearch))
                .or(cuserI.temNm.containsIgnoreCase(normalizedSearch))
                .or(cuserI.etrMilAddrNm.containsIgnoreCase(normalizedSearch))
                .or(cuserI.inleNo.containsIgnoreCase(normalizedSearch))
                .or(cuserI.cpnTpn.containsIgnoreCase(normalizedSearch));
```

Use `Projections.fields` aliases matching every `AdminUserView` getter, `fetch()` for content/export, and a separate `select(cuserI.count())` query for total count. Convert only the service-approved sort properties to QueryDSL order specifiers.

- [ ] **Step 4: Run repository tests and verify GREEN**

Run: `cd it_backend && ./gradlew integrationTest --tests "*AdminUserPagingRepositoryIt"`

Expected: all new repository integration tests pass.

- [ ] **Step 5: Commit the repository slice**

```powershell
git add -- it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepositoryCustom.java it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepositoryImpl.java it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepository.java it_backend/src/test/java/com/kdb/it/common/iam/repository/AdminUserPagingRepositoryIt.java
git commit -m "feat: add paged admin user query"
```

### Task 2: Admin service paging and export policy

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminServiceTest.java`

**Interfaces:**
- Consumes: Task 1 repository methods
- Produces: `Page<AdminDto.UserResponse> getUsers(String search, Pageable pageable)` and `List<AdminDto.UserResponse> getUsersForExport(String search, Sort sort)`

- [ ] **Step 1: Replace the existing full-list service tests with failing paging policy tests**

```java
@Test
void getUsers_페이지크기를_200으로_제한하고_알수없는정렬은_사번순으로_보정한다() {
    given(userRepository.findAdminUserPage(eq("hong"), any(Pageable.class)))
            .willReturn(Page.empty());

    adminService.getUsers(" hong ", PageRequest.of(0, 999, Sort.by("unknown")));

    ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
    then(userRepository).should().findAdminUserPage(eq("hong"), captor.capture());
    assertThat(captor.getValue().getPageSize()).isEqualTo(200);
    assertThat(captor.getValue().getSort()).isEqualTo(Sort.by("eno").ascending());
}

@Test
void getUsersForExport_검색어와_허용된정렬을_재사용한다() {
    given(userRepository.findAdminUsersForExport("kim", Sort.by(DESC, "usrNm")))
            .willReturn(List.of(new AdminUserView("100001", "김사원")));
    assertThat(adminService.getUsersForExport(" kim ", Sort.by(DESC, "usrNm")))
            .extracting(AdminDto.UserResponse::eno).containsExactly("100001");
}
```

- [ ] **Step 2: Run service tests and verify RED**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.service.AdminServiceTest"`

Expected: compilation failure because the paged/export service signatures do not exist.

- [ ] **Step 3: Implement normalization, size cap, sort whitelist, and DTO mapping**

Allowed properties: `eno`, `usrNm`, `ptCNm`, `bbrNm`, `temNm`, `temC`, `inleNo`, `cpnTpn`, `etrMilAddrNm`, `fstEnrDtm`, `lstChgDtm`. Preserve direction for allowed fields; default to `eno ASC`. Return `Page.map(this::toUserResponse)` and map export rows with the same converter.

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.service.AdminServiceTest"`

Expected: all `AdminServiceTest` tests pass.

- [ ] **Step 5: Commit the service slice**

```powershell
git add -- it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java it_backend/src/test/java/com/kdb/it/common/admin/service/AdminServiceTest.java
git commit -m "feat: paginate admin user service"
```

### Task 3: Admin user paging HTTP contract

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/controller/AdminController.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/admin/controller/AdminControllerTest.java`

**Interfaces:**
- Consumes: Task 2 service methods
- Produces: `GET /api/admin/users` Page response and `GET /api/admin/users/export` array response

- [ ] **Step 1: Write failing MockMvc contract tests**

```java
@Test
void getUsers_페이지와_검색조건을_전달하고_Page를_반환한다() throws Exception {
    given(adminService.getUsers(eq("홍"), any(Pageable.class)))
            .willReturn(new PageImpl<>(List.of(userResponse), PageRequest.of(1, 20), 41));
    mvc.perform(get("/api/admin/users").param("page", "1").param("size", "20")
                    .param("search", "홍").param("sort", "usrNm,desc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].eno").value("100001"))
            .andExpect(jsonPath("$.totalElements").value(41))
            .andExpect(jsonPath("$.number").value(1));
}

@Test
void exportUsers_검색결과_전체를_반환한다() throws Exception {
    given(adminService.getUsersForExport(eq("홍"), any(Sort.class)))
            .willReturn(List.of(userResponse));
    mvc.perform(get("/api/admin/users/export").param("search", "홍")
                    .param("sort", "eno,asc"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].eno").value("100001"));
}
```

- [ ] **Step 2: Run controller tests and verify RED**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.controller.AdminControllerTest"`

Expected: compilation or assertion failure because GET users still returns a list and export is unmapped.

- [ ] **Step 3: Implement controller endpoints**

Use explicit names on request parameters and `@PageableDefault(size = 50, sort = "eno")`:

```java
public ResponseEntity<Page<AdminDto.UserResponse>> getUsers(
        @RequestParam(name = "search", required = false) String search,
        @ParameterObject @PageableDefault(size = 50, sort = "eno") Pageable pageable)
```

Map export before `/{eno}`-style endpoints and accept `search` plus Spring `Sort` with default `eno ASC`.

- [ ] **Step 4: Run controller tests and backend format check**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.controller.AdminControllerTest" spotlessCheck`

Expected: controller tests and Spotless pass.

- [ ] **Step 5: Commit the HTTP contract slice**

```powershell
git add -- it_backend/src/main/java/com/kdb/it/common/admin/controller/AdminController.java it_backend/src/test/java/com/kdb/it/common/admin/controller/AdminControllerTest.java
git commit -m "feat: expose paged admin user API"
```

### Task 4: Frontend API and lazy table state

**Files:**
- Modify: `it_frontend/app/composables/useAdminApi.ts`
- Create: `it_frontend/app/composables/useAdminUsersPage.ts`
- Create: `it_frontend/tests/unit/composables/useAdminUsersPage.test.ts`
- Modify: `it_frontend/tests/unit/pages/admin-users-performance.test.ts`

**Interfaces:**
- Consumes: Task 3 Page/export API
- Produces: `useAdminUsersPage()` returning `users`, `totalRecords`, `currentPage`, `pageSize`, `search`, `sortField`, `sortOrder`, `onPage`, `onSort`, edit actions, refresh guard state, and `downloadExcel`

- [ ] **Step 1: Write failing composable tests for query and page state**

Mock only the network boundary and use real Vue refs/computed:

```ts
it('초기 50건과 사번 오름차순을 서버에 요청한다', async () => {
    const page = await effectScope().run(() => useAdminUsersPage())!;
    expect(fetchUsers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 0, size: 50, search: '', sortField: 'eno', sortOrder: 1 }),
    );
    expect(page.users.value).toEqual(response.content);
    expect(page.totalRecords.value).toBe(241);
});

it('페이지와 정렬 변경을 서버 query에 반영한다', async () => {
    const page = await createPage();
    page.onPage({ page: 2, rows: 20 });
    page.onSort({ sortField: 'usrNm', sortOrder: -1 });
    expect(page.currentPage.value).toBe(0);
    expect(page.pageSize.value).toBe(20);
    expect(page.sortField.value).toBe('usrNm');
    expect(page.sortOrder.value).toBe(-1);
});

it('편집 중에는 페이지·정렬·검색 변경을 무시한다', async () => {
    const page = await createPage();
    page.enterEditMode();
    page.onPage({ page: 1, rows: 20 });
    page.onSort({ sortField: 'usrNm', sortOrder: -1 });
    page.setSearch('홍');
    expect(page.currentPage.value).toBe(0);
    expect(page.search.value).toBe('');
});
```

- [ ] **Step 2: Run frontend composable tests and verify RED**

Run: `cd it_frontend && npm test -- tests/unit/composables/useAdminUsersPage.test.ts`

Expected: import failure because `useAdminUsersPage` does not exist.

- [ ] **Step 3: Implement typed paged API and page composable**

Add:

```ts
export interface AdminUserQuery {
    page: MaybeRef<number>;
    size: MaybeRef<number>;
    search: MaybeRef<string>;
    sortField: MaybeRef<string>;
    sortOrder: MaybeRef<number>;
}

const fetchUsers = (query: AdminUserQuery) =>
    useApiFetch<AdminPageResponse<AdminUserResponse>>(`${BASE}/users`, {
        query: {
            page: query.page,
            size: query.size,
            search: query.search,
            sort: computed(() => `${unref(query.sortField)},${unref(query.sortOrder) === -1 ? 'desc' : 'asc'}`),
        },
        watch: [toRef(query.page), toRef(query.size), toRef(query.search), toRef(query.sortField), toRef(query.sortOrder)],
    });
```

Expose an explicit `$apiFetch<AdminUserResponse[]>(`${BASE}/users/export`, { query })` for Excel. Create `useAdminUsersPage` by moving user page state and actions out of `users.vue`; create `useRefreshGuard` before awaiting the fetch object. Use a 300ms debounced internal search query and clear its timer on scope disposal.

- [ ] **Step 4: Run composable tests and verify GREEN**

Run: `cd it_frontend && npm test -- tests/unit/composables/useAdminUsersPage.test.ts tests/unit/pages/admin-users-performance.test.ts`

Expected: all user paging and effect-scope tests pass.

- [ ] **Step 5: Commit the frontend state slice**

```powershell
git add -- it_frontend/app/composables/useAdminApi.ts it_frontend/app/composables/useAdminUsersPage.ts it_frontend/tests/unit/composables/useAdminUsersPage.test.ts it_frontend/tests/unit/pages/admin-users-performance.test.ts
git commit -m "feat: add admin user paging state"
```

### Task 5: Wire `/admin/users` to server paging

**Files:**
- Modify: `it_frontend/app/pages/admin/users.vue`
- Modify: `it_frontend/tests/unit/pages/admin-users-performance.test.ts`

**Interfaces:**
- Consumes: Task 4 `useAdminUsersPage()` facade
- Produces: PrimeVue lazy table behavior and edit-mode control locking

- [ ] **Step 1: Extend the page integration test with failing lazy-table assertions**

Mount the real page with a DataTable boundary stub and assert consumer-visible props/events:

```ts
expect(table.props()).toMatchObject({
    lazy: true,
    rows: 50,
    first: 0,
    totalRecords: 241,
});
await table.vm.$emit('page', { page: 1, rows: 50 });
expect(fetchUsers).toHaveLastBeenCalledWith(expect.objectContaining({ page: 1, size: 50 }));
```

Enter edit mode and assert the search input and paginator interaction are disabled or ignored; save and assert the current server page is refreshed.

- [ ] **Step 2: Run page tests and verify RED**

Run: `cd it_frontend && npm test -- tests/unit/pages/admin-users-performance.test.ts`

Expected: lazy/total-records props and server page event assertions fail.

- [ ] **Step 3: Replace inline page state with the facade and wire lazy events**

Bind:

```vue
<StyledDataTable
    :value="displayUsers"
    lazy
    paginator
    :first="currentPage * pageSize"
    :rows="pageSize"
    :total-records="totalRecords"
    :sort-field="sortField"
    :sort-order="sortOrder"
    :rows-per-page-options="[20, 50, 100, 200]"
    @page="onPage"
    @sort="onSort"
/>
```

Set `TableCard` count to `totalRecords`; bind the search input to the facade and disable it in edit mode. Ensure the Excel action awaits `fetchUsersForExport` and exports the returned complete result.

- [ ] **Step 4: Run page tests and frontend checks**

Run:

```powershell
cd it_frontend
npm test -- tests/unit/pages/admin-users-performance.test.ts tests/unit/composables/useAdminUsersPage.test.ts
npm run check
npx prettier --check app/pages/admin/users.vue app/composables/useAdminApi.ts app/composables/useAdminUsersPage.ts tests/unit/pages/admin-users-performance.test.ts tests/unit/composables/useAdminUsersPage.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit the page integration slice**

```powershell
git add -- it_frontend/app/pages/admin/users.vue it_frontend/tests/unit/pages/admin-users-performance.test.ts
git commit -m "feat: use server paging on admin users"
```

### Task 6: Generated contract and full verification

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` via the repository codegen command if the generated contract changes
- Test: all files changed in Tasks 1-5

**Interfaces:**
- Consumes: completed backend OpenAPI contract and frontend implementation
- Produces: verified repository state ready for review

- [ ] **Step 1: Regenerate/check the OpenAPI client contract**

Run the project-prescribed backend/OpenAPI setup, then:

```powershell
cd it_frontend
npm run codegen
npm run codegen:check
```

If generation changes `app/types/api.d.ts`, verify `/api/admin/users` returns the generated Page schema and `/api/admin/users/export` returns `AdminDto.UserResponse[]`.

- [ ] **Step 2: Run complete backend verification**

Run: `cd it_backend && ./gradlew test spotlessCheck`

Expected: exit 0 with no failed tests or formatting violations.

- [ ] **Step 3: Run complete frontend verification**

Run:

```powershell
cd it_frontend
npm test
npm run check
npm run format:check
```

Expected: every command exits 0.

- [ ] **Step 4: Inspect the final scoped diff**

Run:

```powershell
git status --short
git diff --check
git diff --stat HEAD~5..HEAD
```

Confirm no pre-existing MFA, environment, logging, common-code, or unrelated user files were included in pagination commits.

- [ ] **Step 5: Commit generated contract only if changed**

```powershell
git add -- it_frontend/app/types/api.d.ts
git diff --cached --quiet || git commit -m "chore: update admin user API contract"
```
