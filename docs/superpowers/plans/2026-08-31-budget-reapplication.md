# 예산 재신청·상세 접근 제어·정보화사업 카드 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결재완료 예산의 재신청 버전 관리, 상세 서버 권한, 최종본 기준 조회 및 정보화사업 카드 기능을 제공한다.

**Architecture:** 정보화사업·경상예산·전산업무비는 부모 번호와 순번으로 이력을 관리한다. 결재 완료 이벤트가 같은 부모의 기존 최종본을 해제하고 승인 버전을 최종본으로 전환하며, 프론트는 생성된 API 계약으로 재신청·이력·카드 도구를 제공한다.

**Tech Stack:** Java 25, Spring Boot 4, Oracle/Flyway, Nuxt 4, Vue 3, TypeScript, PrimeVue, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-31-budget-reapplication-design.md`

## Global Constraints

- 새 Flyway 파일만 추가하며 기존 적용 마이그레이션은 수정하지 않는다.
- 업무 조회는 DB 단계에서 `LST_YN='Y'`만 사용한다.
- 상세·이력·재신청은 동일부서, IT 조직(`013,180,181,182,183,185`), 시스템관리자만 허용한다.
- 신규 주석은 한글로 작성하고 OpenAPI 변경 뒤 `npm run codegen`을 실행한다.

---

### Task 1: 버전 저장소와 최종본 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/{project,cost,plan}/{entity,repository,service}/*`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/{service,event}/*`
- Create: `it_database/migrations/V20260831_001__AddBudgetVersionLookupIndexes.sql`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/{project,cost,plan}/service/*VersionServiceTest.java`

**Interfaces:** Produces `createReapplication(parentId)`, `findHistory(parentId)`, `findVersion(parentId,sno)`, and `promoteApprovedVersion(parentId,sno)`.

- [ ] **Step 1: Write a failing reapplication test**

```java
@Test
void 결재완료_사업을_재신청하면_다음_순번의_비최종_초안이_생긴다() {
    var result = service.createReapplication("PRJ-2026-0001");
    assertThat(result.sno()).isEqualTo(2);
    assertThat(result.lstYn()).isEqualTo("N");
}
```

- [ ] **Step 2: Verify the test is red**

Run: `./gradlew test --tests '*VersionServiceTest'`

Expected: FAIL because the version service is absent.

- [ ] **Step 3: Implement minimal version creation and completion promotion**

```java
@Transactional
public void promoteApprovedVersion(String parentId, int sno) {
    repository.clearLatestByParentId(parentId);
    repository.setLatestByParentIdAndSno(parentId, sno);
}
```

Preserve parent number, allocate maximum `SNO + 1`, clone approved source details, keep the clone `LST_YN='N'`, and make completion idempotent. Add required parent/final-version indexes in the new Flyway migration.

- [ ] **Step 4: Verify the focused tests are green**

Run: `./gradlew test --tests '*VersionServiceTest' --tests '*Approval*Test'`

Expected: PASS for clone, rejected source, promotion, and repeated completion.

- [ ] **Step 5: Commit the task**

```powershell
git add it_backend/src/main/java/com/kdb/it/domain/budget it_backend/src/main/java/com/kdb/it/common/approval it_backend/src/test/java/com/kdb/it/domain/budget it_database/migrations/V20260831_001__AddBudgetVersionLookupIndexes.sql
git commit -m "feat: 예산 재신청 버전 전환"
```

### Task 2: API와 상세 데이터 범위 보안

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/{project,cost,plan}/{controller,dto,service}/*`
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/common/security/BudgetDetailAccessVerifier.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/{project,cost,plan}/controller/*ControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/common/security/BudgetDetailAccessVerifierTest.java`

**Interfaces:** Consumes Task 1. Produces reapplication POST, history GET, explicit-version GET endpoints and final-only legacy reads.

- [ ] **Step 1: Write failing MVC security tests**

```java
@Test
void 타부서_일반사용자는_프로젝트_상세를_조회할_수_없다() throws Exception {
    mockMvc.perform(get("/api/projects/PRJ-1").with(user(otherDepartmentUser)))
        .andExpect(status().isForbidden());
}
```

- [ ] **Step 2: Verify the tests are red**

Run: `./gradlew test --tests '*ProjectControllerTest' --tests '*CostControllerTest'`

Expected: FAIL because service data-scope verification and revision APIs are absent.

- [ ] **Step 3: Implement endpoints and service authorization**

```java
if (!sameDepartment && !isItOrganization && !actor.isSystemAdmin()) {
    throw new AccessDeniedException("예산 상세 조회 권한이 없습니다.");
}
```

Use the verifier for normal, history, revision, and reapplication reads. Make legacy list/detail/bulk queries add `LST_YN='Y'` at the query boundary.

- [ ] **Step 4: Verify the tests are green**

Run: `./gradlew test --tests '*ProjectControllerTest' --tests '*CostControllerTest' --tests '*PlanControllerTest' --tests '*BudgetDetailAccessVerifierTest'`

Expected: PASS for same department, all six IT codes, administrator, and forbidden paths.

- [ ] **Step 5: Commit the task**

```powershell
git add it_backend/src/main/java/com/kdb/it/domain/budget it_backend/src/test/java/com/kdb/it/domain/budget
git commit -m "feat: 예산 이력 API와 상세 접근 제어"
```

### Task 3: 프론트 이력·재신청 흐름

**Files:**
- Modify: `it_frontend/app/composables/{useProjects.ts,useCost.ts,useProjectDetailPage.ts}`
- Modify: `it_frontend/app/pages/info/{projects,cost,plan}/[id].vue`
- Create: `it_frontend/app/components/budget/BudgetHistoryDialog.vue`
- Modify: `it_frontend/i18n/messages/{project,cost,plan}.ts`
- Modify: `it_frontend/app/types/api.d.ts` (generated)
- Test: `it_frontend/tests/unit/{pages,components}/**/*History*.test.ts`

**Interfaces:** Consumes Task 2 generated API contracts. Produces completed-owner-only reapplication buttons and explicit-version read-only navigation.

- [ ] **Step 1: Write a failing UI visibility test**

```ts
it('결재완료 최종본의 작성부서 사용자에게만 재신청 버튼을 노출한다', () => {
  expect(canReapply(completedLatestOwnedProject)).toBe(true)
})
```

- [ ] **Step 2: Verify the test is red**

Run: `npm test -- BudgetHistoryDialog projectDetailPageBoundary`

Expected: FAIL because history state and the reapplication guard are absent.

- [ ] **Step 3: Generate types and implement the dialog flow**

```ts
const revision = await $apiFetch(`${apiBase}/projects/${id}/reapplications`, { method: 'POST' })
await navigateTo(`/info/projects/form?id=${revision.parentId}&sno=${revision.sno}`)
```

Render loading, error, and empty history states separately. Selecting a version opens a read-only explicit-version detail.

- [ ] **Step 4: Verify focused frontend tests are green**

Run: `npm run codegen && npm test -- BudgetHistoryDialog projectDetailPageBoundary`

Expected: PASS.

- [ ] **Step 5: Commit the task**

```powershell
git add it_frontend/app it_frontend/i18n it_frontend/tests
git commit -m "feat: 예산 이력과 수정 후 재신청 화면"
```

### Task 4: 정보화사업 카드 도구

**Files:**
- Modify: `it_frontend/app/pages/info/index.vue`
- Modify: `it_frontend/app/components/info/InfoBudgetTimingCard.vue`
- Create: `it_frontend/app/components/info/InfoProjectCardDialog.vue`
- Create: `it_frontend/app/composables/info/useInfoProjectCard.ts`
- Modify: `it_frontend/app/utils/excel.ts`
- Modify: `it_frontend/i18n/messages/info.ts`
- Test: `it_frontend/tests/unit/composables/info/useInfoProjectCard.test.ts`
- Test: `it_frontend/tests/e2e/info-home.spec.ts`

**Interfaces:** Consumes final-only project rows and user department. Produces IT organization scope, IT-department filter, full-screen table, and requested Excel projection.

- [ ] **Step 1: Write a failing IT-department filter test**

```ts
it('IT 담당부서 필터는 로그인 부서가 IT 담당부서인 최종본만 반환한다', () => {
  expect(filterItDepartmentProjects(rows, '180')).toEqual([rows[1]])
})
```

- [ ] **Step 2: Verify the test is red**

Run: `npm test -- useInfoProjectCard`

Expected: FAIL because card state and filter functions are absent.

- [ ] **Step 3: Implement controls, full-screen table, and export mapping**

```ts
exportProjectRows(rows.map((row) => ({ 사업명: row.abusNm, 시작일: row.sttDtm, 종료일: row.endDtm })))
```

Only the six IT codes get `부서 | 전체`. The dialog shows seven requested fields and Excel maps all requested personnel, amount, asset, expense, and authority fields.

- [ ] **Step 4: Verify unit and E2E tests are green**

Run: `npm test -- useInfoProjectCard && npm run test:e2e -- info-home.spec.ts`

Expected: PASS.

- [ ] **Step 5: Run full verification and commit**

```powershell
cd C:\it\it_backend; ./gradlew test; ./gradlew check; ./gradlew bootJar
cd C:\it\it_frontend; npm run format:check; npm run check; npm test; npm run codegen:check
git add it_frontend/app it_frontend/i18n it_frontend/tests docs/superpowers/plans/2026-08-31-budget-reapplication.md
git commit -m "feat: 정보화사업 카드 조회와 엑셀 내보내기 개선"
```
