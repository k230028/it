# Clean Code 리뷰 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `clean-code-review-2026-07-07.md`의 즉시 개선 범위를 실제 버그 수정, 입력 검증 보강, 권한·환율 정합화, 타입 우회 축소 순서로 구현한다.

**Architecture:** P0는 프론트 표시 버그와 백엔드 컨트롤러 규약을 작게 고친다. P1은 중복 권한 검증과 환율 계산 기준을 공통 경로로 묶는다. P2는 `odnYn` 관련 경로에서 `any` 우회를 제거해 같은 필드명 버그가 타입 검사에서 드러나게 한다.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Vitest, Spring Boot 4.1.0, Java 25, Spring MVC, Jakarta Bean Validation, JUnit 5, Mockito, Gradle.

## Global Constraints

- 모든 신규 JavaDoc/TSDoc/인라인 주석은 한글로 작성한다.
- JWT는 httpOnly 쿠키로만 전달하고 프론트는 토큰을 직접 저장하거나 읽지 않는다.
- mutating 컨트롤러 엔드포인트의 요청 본문에는 `@Valid`를 적용한다.
- 프론트 API 변경 호출은 기존 `$apiFetch`, 조회 호출은 기존 `useApiFetch<T>` 패턴을 따른다.
- DB 스키마 변경, Flyway 마이그레이션 추가, 엔티티 컬럼 변경은 이번 계획 범위가 아니다.
- `it_backend`와 `it_frontend`는 각각 별도 Git 저장소이므로 변경과 커밋은 해당 하위 저장소에서 수행한다.
- 루트 문서 변경이 필요하면 `C:\it` 저장소에서 별도 커밋한다.

---

## File Structure

### Frontend

- Modify: `it_frontend/app/pages/info/projects/[id].vue`  
  프로젝트 상세 화면의 경상사업 판정을 서버 응답 필드 `odnYn`으로 변경한다.
- Modify: `it_frontend/app/composables/usePdfReport.ts`  
  PDF 제목 구분 판정을 `Project.odnYn`으로 변경하고 `as any`를 제거한다.
- Modify: `it_frontend/app/pages/info/projects/index.vue`  
  목록 DataTable 컬럼 field와 Tag 표시 판정을 `odnYn`으로 변경한다.
- Read: `it_frontend/app/composables/useProjects.ts`  
  `Project`/`ProjectDetail` 타입에 이미 있는 `odnYn?: 'Y' | 'N'`를 기준으로 삼는다.

### Backend

- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java`  
  `createCost`에 `@Valid`, `201 Created`, Location 헤더를 적용한다.
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/controller/AdminBoardMetaController.java`  
  `create` 요청 본문에 `@Valid`를 적용한다.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/GuideDocController.java`  
  `createDocument` 요청 본문에 `@Valid`를 적용한다.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ServiceRequestDocController.java`  
  `createDocument` 요청 본문에 `@Valid`를 적용한다.
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/controller/BoardCommentController.java`  
  `create` 요청 본문에 `@Valid`를 적용한다.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/controller/AdminMenuController.java`  
  `move` 요청 본문에 `@Valid`를 적용한다.
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/controller/CostControllerTest.java`  
  생성 응답이 201 + Location인지 검증한다.
- Test: existing controller tests under `it_backend/src/test/java/com/kdb/it/**/controller/*Test.java`  
  각 `@Valid` 대상의 잘못된 요청이 400인지 검증한다.
- Modify or Create: `it_backend/src/main/java/com/kdb/it/common/system/security/OwnershipVerifier.java`  
  이미 존재하면 재사용하고, 없거나 역할이 다르면 공통 수정 권한 검증 메서드를 추가한다.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`  
  중복 `validateModifyPermission`을 공통 검증 호출로 교체한다.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`  
  중복 `validateModifyPermission`을 공통 검증 호출로 교체한다.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`  
  환율 환산 기준을 프로젝트 요약과 일치시킨다.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java`  
  환율 환산 기준을 작업 예산과 일치시킨다.

---

### Task 0: Baseline Guard

**Files:**
- Read: `C:\it\docs\clean-code-review-2026-07-07.md`
- Read: `C:\it\docs\superpowers\specs\2026-07-08-clean-code-review-remediation-design.md`
- Read: `C:\it\it_backend\CLAUDE.md`
- Read: `C:\it\it_frontend\CLAUDE.md`

**Interfaces:**
- Consumes: approved design scope.
- Produces: clean starting point and command baseline.

- [ ] **Step 1: Confirm clean worktrees**

Run:

```powershell
git -C C:\it status --short
git -C C:\it\it_backend status --short
git -C C:\it\it_frontend status --short
```

Expected: no unrelated user changes in files listed by this plan. If unrelated changes exist, leave them untouched.

- [ ] **Step 2: Confirm target references still exist**

Run:

```powershell
rg -n "ornYn|odnYn|createCost|validateModifyPermission|ProjectBudgetSummaryService|BudgetWorkService" C:\it\it_frontend\app C:\it\it_backend\src\main\java
```

Expected: output includes:

```text
it_frontend/app/pages/info/projects/[id].vue
it_frontend/app/composables/usePdfReport.ts
it_frontend/app/pages/info/projects/index.vue
it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java
it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java
it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java
```

- [ ] **Step 3: Record baseline verification**

Run:

```powershell
cd C:\it\it_frontend
npm run typecheck
npm run lint
cd C:\it\it_backend
.\gradlew test --warning-mode all
```

Expected: commands pass before implementation. If a pre-existing failure appears, capture the failing command and continue only with focused tests for touched files.

---

### Task 1: Fix `odnYn` Frontend Bug

**Files:**
- Modify: `it_frontend/app/pages/info/projects/[id].vue`
- Modify: `it_frontend/app/composables/usePdfReport.ts`
- Modify: `it_frontend/app/pages/info/projects/index.vue`
- Read: `it_frontend/app/composables/useProjects.ts`

**Interfaces:**
- Consumes: `Project.odnYn?: 'Y' | 'N'` and `ProjectDetail.odnYn?: 'Y' | 'N'`.
- Produces: all project display logic uses `odnYn`; no production reference to nonexistent `ornYn` remains in the three reviewed paths.

- [ ] **Step 1: Verify current type check does not catch the bug**

Run:

```powershell
cd C:\it\it_frontend
npm run typecheck
```

Expected: command passes even though reviewed paths still reference `ornYn`. This confirms `any` is hiding the bug.

- [ ] **Step 2: Replace detail page computed field**

In `it_frontend/app/pages/info/projects/[id].vue`, replace:

```ts
/** 경상사업 여부 (ornYn='Y') */
const isOrdinary = computed(() => (project.value as any)?.ornYn === 'Y');
```

with:

```ts
/** 경상사업 여부 (서버 응답 필드 odnYn 기준) */
const isOrdinary = computed(() => project.value?.odnYn === 'Y');
```

- [ ] **Step 3: Replace PDF report field**

In `it_frontend/app/composables/usePdfReport.ts`, replace the title decision inside `generateReport`:

```ts
const isOrdinary = (project as any).ornYn === 'Y';
```

with:

```ts
const isOrdinary = project.odnYn === 'Y';
```

If TypeScript reports that `project` is not typed as `Project`, import or reuse the local project type that already includes `odnYn`. Do not introduce a new `any`.

- [ ] **Step 4: Replace project list DataTable field and slot expressions**

In `it_frontend/app/pages/info/projects/index.vue`, replace:

```vue
<Column
    field="ornYn"
```

with:

```vue
<Column
    field="odnYn"
```

Replace both slot expressions:

```vue
:value="slotProps.data.ornYn === 'Y' ? '경상' : '정보화'"
```

and:

```vue
slotProps.data.ornYn === 'Y'
```

with:

```vue
:value="slotProps.data.odnYn === 'Y' ? '경상' : '정보화'"
```

and:

```vue
slotProps.data.odnYn === 'Y'
```

- [ ] **Step 5: Search for remaining reviewed bug references**

Run:

```powershell
cd C:\it\it_frontend
rg -n "ornYn" app/pages/info/projects/[id].vue app/composables/usePdfReport.ts app/pages/info/projects/index.vue
```

Expected: no results in those three files. `projects/form.vue`, `usePlan.ts`, and other local form models may still use `ornYn` intentionally and are not part of this task.

- [ ] **Step 6: Verify frontend**

Run:

```powershell
cd C:\it\it_frontend
npm run typecheck
npm run lint
```

Expected: both commands pass.

- [ ] **Step 7: Commit frontend bug fix**

Run:

```powershell
cd C:\it\it_frontend
git add -- app/pages/info/projects/[id].vue app/composables/usePdfReport.ts app/pages/info/projects/index.vue
git commit -m "fix: 경상사업 표시 필드명 정정"
```

Expected: commit succeeds in the `it_frontend` repository.

---

### Task 2: Add `@Valid` and Fix `createCost` Created Response

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/controller/AdminBoardMetaController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/GuideDocController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ServiceRequestDocController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/controller/BoardCommentController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/controller/AdminMenuController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/controller/CostControllerTest.java`
- Test: add or extend corresponding controller tests for the five remaining validation targets.

**Interfaces:**
- Consumes: Spring MVC validation via `jakarta.validation.Valid`.
- Produces: invalid mutating request bodies return 400; `POST /api/cost` returns 201 and `Location: /api/cost/{itMngcNo}`.

- [ ] **Step 1: Write failing CostController response test**

In `CostControllerTest`, change the existing create test to:

```java
@Test
@DisplayName("POST /api/cost - 인증된 사용자 → 201 Created + Location")
@WithMockUser(username = "10001")
void createCost_인증_201() throws Exception {
    given(costService.createCost(any())).willReturn("COST_2026_0001");

    mockMvc.perform(post("/api/cost")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(new CostDto.CreateRequest())))
            .andExpect(status().isCreated())
            .andExpect(header().string("Location", "/api/cost/COST_2026_0001"));
}
```

Add this import:

```java
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
```

- [ ] **Step 2: Run focused test and confirm failure**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.domain.budget.cost.controller.CostControllerTest --warning-mode all
```

Expected: `createCost_인증_201` fails because the controller still returns 200.

- [ ] **Step 3: Update CostController**

In `CostController.java`, add imports:

```java
import jakarta.validation.Valid;
import java.net.URI;
```

Replace `createCost` with:

```java
@PostMapping
public ResponseEntity<String> createCost(@Valid @RequestBody CostDto.CreateRequest request) {
    String itMngcNo = costService.createCost(request);
    return ResponseEntity.created(URI.create("/api/cost/" + itMngcNo)).body(itMngcNo);
}
```

Update the Swagger response description from `200` to `201` in the same method block.

- [ ] **Step 4: Add `@Valid` imports and annotations to the five remaining controllers**

Apply these exact method parameter changes:

```java
// AdminBoardMetaController
public ResponseEntity<String> create(@Valid @RequestBody BoardMetaDto.CreateRequest request)
```

```java
// GuideDocController
public ResponseEntity<String> createDocument(@Valid @RequestBody GuideDocDto.CreateRequest request)
```

```java
// ServiceRequestDocController
public ResponseEntity<String> createDocument(@Valid @RequestBody ServiceRequestDocDto.CreateRequest request)
```

```java
// BoardCommentController
public ResponseEntity<Long> create(
        @PathVariable("blbMngNo") String blbMngNo,
        @PathVariable("nacMngNo") String nacMngNo,
        @Valid @RequestBody BoardCommentDto.CreateRequest request,
        @AuthenticationPrincipal CustomUserDetails user)
```

```java
// AdminMenuController
public ResponseEntity<Void> move(@PathVariable(name = "mnuId") String mnuId,
                                 @Valid @RequestBody MenuDto.MoveRequest req)
```

Add `import jakarta.validation.Valid;` to controllers that do not already import it.

- [ ] **Step 5: Write validation tests for invalid request bodies**

Add one focused test per controller. Use each DTO's existing validation field. If the DTO already has a required text field, set it to `null` or blank. The test shape must match this pattern:

```java
@Test
@DisplayName("POST ... - 필수 필드 누락 → 400")
@WithMockUser(username = "10001", roles = "ADMIN")
void create_invalidBody_400() throws Exception {
    var body = new XxxDto.CreateRequest();
    body.setRequiredField(null);

    mockMvc.perform(post("/actual/path")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isBadRequest());
}
```

For `AdminMenuController.move`, add:

```java
@Test
@DisplayName("PATCH /api/admin/menus/{mnuId}/move - 본문 검증 실패 → 400")
@WithMockUser(username = "10001", roles = "ADMIN")
void move_본문검증실패_400() throws Exception {
    var body = new MenuDto.MoveRequest();

    mockMvc.perform(patch("/api/admin/menus/MNU-1/move")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isBadRequest());
}
```

If `MoveRequest` currently has no validation constraint, add a validation constraint to the field that service logic requires. For nullable root movement, use a DTO-level rule only if the domain requires non-null; otherwise record `move` as an exception in `TASK.md` instead of inventing a false validation rule.

- [ ] **Step 6: Run focused controller tests**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.domain.budget.cost.controller.CostControllerTest --warning-mode all
.\gradlew test --tests com.kdb.it.common.board.controller.* --warning-mode all
.\gradlew test --tests com.kdb.it.domain.budget.document.controller.* --warning-mode all
.\gradlew test --tests com.kdb.it.domain.menu.controller.* --warning-mode all
```

Expected: all focused controller tests pass.

- [ ] **Step 7: Run backend tests**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --warning-mode all
```

Expected: all tests pass.

- [ ] **Step 8: Commit backend controller changes**

Run:

```powershell
cd C:\it\it_backend
git add -- src/main/java src/test/java
git commit -m "fix: 생성 API 검증과 응답 규약 보강"
```

Expected: commit succeeds in the `it_backend` repository.

---

### Task 3: Consolidate Modify Permission Check

**Files:**
- Read or Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/OwnershipVerifier.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`

**Interfaces:**
- Consumes: current authenticated principal from `SecurityContextHolder`.
- Produces: one shared method with semantics: creator, same department manager, or admin can modify; all others are denied.

- [ ] **Step 1: Capture duplicated methods**

Run:

```powershell
cd C:\it\it_backend
rg -n "private void validateModifyPermission|AccessDeniedException|SecurityContextHolder" src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java src/main/java/com/kdb/it/common/system/security
```

Expected: duplicated private methods exist in `ProjectService` and `CostService`.

- [ ] **Step 2: Write shared verifier tests**

If `OwnershipVerifierTest` does not exist, create `it_backend/src/test/java/com/kdb/it/common/system/security/OwnershipVerifierTest.java`:

```java
package com.kdb.it.common.system.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class OwnershipVerifierTest {

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("생성자는 수정할 수 있다")
    void verifyModifiable_생성자_허용() {
        setUser("10001", "D001", false);

        assertThatCode(() -> OwnershipVerifier.verifyModifiable("10001", "D999"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("관리자는 수정할 수 있다")
    void verifyModifiable_관리자_허용() {
        setUser("90000", "D999", true);

        assertThatCode(() -> OwnershipVerifier.verifyModifiable("10001", "D001"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("같은 부서 사용자는 수정할 수 있다")
    void verifyModifiable_같은부서_허용() {
        setUser("10002", "D001", false);

        assertThatCode(() -> OwnershipVerifier.verifyModifiable("10001", "D001"))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("생성자도 관리자도 같은 부서도 아니면 거부한다")
    void verifyModifiable_권한없음_거부() {
        setUser("10002", "D002", false);

        assertThatThrownBy(() -> OwnershipVerifier.verifyModifiable("10001", "D001"))
                .isInstanceOf(AccessDeniedException.class);
    }

    private void setUser(String eno, String bbrC, boolean admin) {
        CustomUserDetails principal = mock(CustomUserDetails.class);
        given(principal.getEno()).willReturn(eno);
        given(principal.getBbrC()).willReturn(bbrC);
        given(principal.isAdmin()).willReturn(admin);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
}
```

If `CustomUserDetails` method names differ, use the actual methods already used by the duplicated private methods.

- [ ] **Step 3: Run verifier test and confirm failure or missing method**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.common.system.security.OwnershipVerifierTest --warning-mode all
```

Expected: fails because `OwnershipVerifier.verifyModifiable` does not exist or lacks the required behavior.

- [ ] **Step 4: Implement shared verifier**

Add this method to `OwnershipVerifier`:

```java
public static void verifyModifiable(String creatorEno, String resourceBbrC) {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails user)) {
        throw new AccessDeniedException("인증 정보가 없어 수정할 수 없습니다.");
    }

    boolean createdByUser = Objects.equals(creatorEno, user.getEno());
    boolean sameDepartment = StringUtils.hasText(resourceBbrC) && Objects.equals(resourceBbrC, user.getBbrC());
    if (user.isAdmin() || createdByUser || sameDepartment) {
        return;
    }

    throw new AccessDeniedException("수정 권한이 없습니다.");
}
```

Required imports:

```java
import java.util.Objects;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
```

- [ ] **Step 5: Replace duplicated private calls**

In `ProjectService`, replace:

```java
validateModifyPermission(project.getFstEnrUsid(), project.getSvnDpmC());
```

with:

```java
OwnershipVerifier.verifyModifiable(project.getFstEnrUsid(), project.getSvnDpmC());
```

In `CostService`, replace:

```java
validateModifyPermission(target.getFstEnrUsid(), target.getCostSvnDpmC());
validateModifyPermission(costs.get(0).getFstEnrUsid(), costs.get(0).getCostSvnDpmC());
```

with:

```java
OwnershipVerifier.verifyModifiable(target.getFstEnrUsid(), target.getCostSvnDpmC());
OwnershipVerifier.verifyModifiable(costs.get(0).getFstEnrUsid(), costs.get(0).getCostSvnDpmC());
```

Remove the duplicated private `validateModifyPermission` methods from both services.

- [ ] **Step 6: Run focused service tests**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.common.system.security.OwnershipVerifierTest --warning-mode all
.\gradlew test --tests com.kdb.it.domain.budget.project.service.ProjectServiceTest --warning-mode all
.\gradlew test --tests com.kdb.it.domain.budget.cost.service.CostServiceTest --warning-mode all
```

Expected: focused tests pass.

- [ ] **Step 7: Commit permission consolidation**

Run:

```powershell
cd C:\it\it_backend
git add -- src/main/java src/test/java
git commit -m "refactor: 수정 권한 검증 공통화"
```

Expected: commit succeeds.

---

### Task 4: Unify Currency Conversion Rule

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceXcrLookupTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java`

**Interfaces:**
- Consumes: `Bitemm.amt` as KRW amount and `Bitemm.fcAmt` as foreign currency original amount.
- Produces: both work budget and project summary aggregate `amt` without applying `amt * xcr` a second time.

- [ ] **Step 1: Locate current calculation paths**

Run:

```powershell
cd C:\it\it_backend
rg -n "fcAmt|xcr|amt\\(|getAmt|multiply|CAPITAL_CTPS|applyBudgetSummary" src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java src/test/java/com/kdb/it/domain/budget
```

Expected: find every place where item amounts are aggregated or multiplied by exchange rate.

- [ ] **Step 2: Write project summary regression test**

In `ProjectBudgetSummaryServiceTest`, add a test named:

```java
@Test
@DisplayName("외화 품목은 이미 환산된 amt를 다시 환율 곱하지 않는다")
void summarize_foreignCurrency_usesKrwAmtWithoutDoubleConversion() {
    // Given: fcAmt=100, xcr=1300, amt=130000 인 품목
    // When: 프로젝트 요약을 계산
    // Then: 합산 금액은 169000000 이 아니라 130000 이다
}
```

Use existing fixture builders in the test file. If there is no builder, create a `Bitemm` with the same factory method already used in current tests. Expected assertion must compare KRW amount to `130000`.

- [ ] **Step 3: Write BudgetWork regression test**

In `BudgetWorkServiceXcrLookupTest`, add a test named:

```java
@Test
@DisplayName("편성 재집계는 외화 품목의 amt를 원화 기준으로 합산한다")
void aggregate_foreignCurrency_usesStoredKrwAmt() {
    // Given: fcAmt=100, xcr=1300, amt=130000 인 품목
    // When: 편성 재집계를 수행
    // Then: 합산 금액은 130000 이다
}
```

Use existing helper methods from the test file. Expected assertion must compare the final aggregated amount to `130000`.

- [ ] **Step 4: Run focused tests and confirm failure**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.domain.budget.project.service.ProjectBudgetSummaryServiceTest --warning-mode all
.\gradlew test --tests com.kdb.it.domain.budget.work.service.BudgetWorkServiceXcrLookupTest --warning-mode all
```

Expected: at least one new assertion fails if double conversion or missing conversion still exists.

- [ ] **Step 5: Replace double conversion with stored KRW amount**

In both services, use this rule wherever item amounts are aggregated:

```java
BigDecimal krwAmount = item.getAmt() == null ? BigDecimal.ZERO : item.getAmt();
```

Do not calculate:

```java
item.getAmt().multiply(item.getXcr())
```

when `amt` already stores KRW. Use `fcAmt` only for display, audit, or recalculating `amt` at write time.

- [ ] **Step 6: Run focused tests and backend tests**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests com.kdb.it.domain.budget.project.service.ProjectBudgetSummaryServiceTest --warning-mode all
.\gradlew test --tests com.kdb.it.domain.budget.work.service.BudgetWorkServiceXcrLookupTest --warning-mode all
.\gradlew test --warning-mode all
```

Expected: all tests pass.

- [ ] **Step 7: Commit currency rule**

Run:

```powershell
cd C:\it\it_backend
git add -- src/main/java src/test/java
git commit -m "fix: 예산 환율 합산 기준 단일화"
```

Expected: commit succeeds.

---

### Task 5: Final Verification and Documentation Sync

**Files:**
- Read: `C:\it\TASK.md`
- Read: `C:\it\docs\clean-code-review-2026-07-07.md`
- Modify only if needed: `C:\it\TASK_DONE.md`

**Interfaces:**
- Consumes: commits from Tasks 1-4.
- Produces: verified implementation and clear residual task state.

- [ ] **Step 1: Verify no reviewed `ornYn` bug remains**

Run:

```powershell
cd C:\it\it_frontend
rg -n "ornYn" app/pages/info/projects/[id].vue app/composables/usePdfReport.ts app/pages/info/projects/index.vue
```

Expected: no results.

- [ ] **Step 2: Verify no duplicated permission method remains**

Run:

```powershell
cd C:\it\it_backend
rg -n "private void validateModifyPermission" src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java
```

Expected: no results.

- [ ] **Step 3: Run full frontend verification**

Run:

```powershell
cd C:\it\it_frontend
npm run typecheck
npm run lint
npm test
```

Expected: all commands pass.

- [ ] **Step 4: Run full backend verification**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --warning-mode all
```

Expected: all tests pass.

- [ ] **Step 5: Check task tracking**

Run:

```powershell
cd C:\it
Select-String -Path TASK.md -Pattern "CQ-01|CQ-02|CQ-03|CQ-04|CQ-05|CQ-06|CQ-07"
```

Expected: long-running Clean Code debt remains tracked in `TASK.md`. Do not remove CQ items in this implementation because they are explicitly outside the current scope.

- [ ] **Step 6: Commit root docs only if changed during execution**

Run:

```powershell
cd C:\it
git status --short
```

If `TASK_DONE.md` or other root docs changed, commit only those docs:

```powershell
cd C:\it
git add -- TASK_DONE.md TASK.md docs
git commit -m "docs: Clean Code 개선 결과 정리"
```

Expected: root commit is created only when root docs changed after implementation.

- [ ] **Step 7: Final status summary**

Run:

```powershell
git -C C:\it status --short
git -C C:\it\it_backend status --short
git -C C:\it\it_frontend status --short
```

Expected: all three worktrees are clean except intentional untracked local artifacts.

