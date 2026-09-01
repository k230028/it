# 결재선 지정·수정 다이얼로그 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 예산 보고서와 결재 대기 목록에서 조직도 기반 공통 다이얼로그로 결재선을 안전하게 편집한다.

**Architecture:** `ApprovalLineEditorDialog`는 기존 `EmployeeSearchDialog`의 조직도·직원 검색 기능을 보존한 채 오른쪽 결재선 편집 패널을 추가한다. 예산 보고서는 적용된 로컬 결재선을 PDF에 반영하고, 결재 대기 건은 MFA가 적용된 원자적 일괄 변경 API로 미결재 결재자만 교체한다.

**Tech Stack:** Vue 3 Composition API, Nuxt 4, TypeScript, PrimeVue, Vitest, Playwright, Spring Boot 4, Java 25, Spring Data JPA, MockMvc.

**Spec:** [결재선 지정·수정 다이얼로그 설계](../specs/2026-09-01-approval-line-editor-design.md)

## Global Constraints

- 기존 `EmployeeSearchDialog`의 조직도·부서원 조회·통합 검색·정렬·로딩·오류 처리 및 스타일을 재사용한다.
- 처리된 결재자는 변경하지 않고 미결재 결재자만 편집한다.
- 결재선 변경 명령은 `MfaPurpose.APPROVAL` MFA를 요구한다.
- 서버는 권한·직원 존재·중복·처리 상태를 하나의 트랜잭션에서 검증하고 실패 시 전체를 롤백한다.
- 결재자 표시 정보는 배치 조회로 보강하며 결재자별 사용자 조회 N+1을 만들지 않는다.
- 신규 사용자 노출 문구는 한국어·영어 번역을 함께 추가한다.
- API 계약 변경 후 프론트 생성 타입을 재생성하고 `npm run codegen:check`를 통과시킨다.

---

## 파일 구조

| 경로 | 책임 |
| --- | --- |
| `it_backend/.../ApplicationDto.java` | 일괄 변경 요청과 결재자 표시 필드 OpenAPI 계약 |
| `it_backend/.../ApprovalLineManagementService.java` | 미결재 결재선을 원자적으로 교체하고 신청서 상세 결재선을 동기화 |
| `it_backend/.../ApplicationController.java` | MFA 보호 일괄 변경 엔드포인트 |
| `it_backend/.../ApplicationBulkReadSupport.java` | 목록 응답에 결재자 표시 정보를 배치 결합 |
| `it_backend/.../ApplicationService.java` | 단건 신청서 응답에 결재자 표시 정보를 결합 |
| `it_frontend/app/components/common/EmployeeSearchDialog.vue` | 기존 검색 화면에 선택 유지 및 편집 패널 슬롯 경계 제공 |
| `it_frontend/app/components/approval/ApprovalLineEditorDialog.vue` | 결재선 임시 편집, 중복 차단, 드래그 정렬, 적용 이벤트 |
| `it_frontend/app/components/approval/ApprovalTimeline.vue` | 결재 대기 건의 단일 편집 진입점과 서버 적용 연결 |
| `it_frontend/app/pages/budget/report.vue` | 단일 편집 버튼과 적용 후 PDF 재생성 |
| `it_frontend/app/composables/useApprovals.ts` | 일괄 변경 API 클라이언트 |
| `it_frontend/i18n/messages/{approval,budget}.ts` | 버튼·패널·중복·적용 실패 문구 |
| `it_frontend/tests/unit/...` | 순수 편집 규칙과 컴포넌트 계약 |
| `it_frontend/tests/e2e/...` | 두 화면의 조직도 검색·정렬·적용 흐름 |

### Task 1: 원자적 미결재 결재선 변경 API

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApprovalLineManagementService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/controller/ApplicationControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApprovalLineManagementServiceTest.java`

**Interfaces:**
- Consumes: `PUT /api/applications/{apfMngNo}/approvers` with `{ "approverEnos": ["E20001", "E20002"] }`.
- Produces: `replacePendingApprovers(String apfMngNo, List<String> approverEnos, String currentEno, boolean isAdmin)` and HTTP 204 on success.

- [ ] **Step 1: Write the failing MVC and service tests**

```java
@Test
@DisplayName("PUT /api/applications/{apfMngNo}/approvers - MFA 일괄 변경 요청을 서비스로 전달한다")
void replacePendingApprovers_인증_204() throws Exception {
    mockMvc.perform(put("/api/applications/APF_202600000001/approvers")
                    .with(authentication(authentication("10001", "ROLE_USER")))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"approverEnos\":[\"20001\",\"20002\"]}"))
            .andExpect(status().isNoContent());
    verify(approvalLineManagementService)
            .replacePendingApprovers("APF_202600000001", List.of("20001", "20002"), "10001", false);
}

@Test
@DisplayName("replacePendingApprovers: 중복 사번은 저장 전에 거부하고 기존 결재선을 변경하지 않는다")
void replacePendingApprovers_중복사번_롤백() {
    assertThatThrownBy(() -> service.replacePendingApprovers(APF_MNG_NO, List.of("20001", "20001"), "10001", false))
            .isInstanceOf(IllegalArgumentException.class);
    verify(approverRepository, never()).saveAll(anyCollection());
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.common.approval.controller.ApplicationControllerTest' --tests 'com.kdb.it.common.approval.service.ApprovalLineManagementServiceTest'`

Expected: FAIL because the `PUT` mapping and `replacePendingApprovers` method do not exist.

- [ ] **Step 3: Add the request DTO, controller mapping, and transactional replacement**

```java
@Getter
@Setter
@Schema(name = "ApplicationReplacePendingApproversRequest", description = "미결재 결재선 일괄 변경 요청")
public static class ReplacePendingApproversRequest {
    @NotEmpty
    @Schema(description = "변경 후 미결재 결재자 사번 목록 (결재 순서)")
    private List<@NotBlank String> approverEnos;
}

@PutMapping("/{apfMngNo}/approvers")
@MfaRequired(purpose = MfaPurpose.APPROVAL)
public ResponseEntity<Void> replacePendingApprovers(
        @PathVariable String apfMngNo,
        @Valid @RequestBody ApplicationDto.ReplacePendingApproversRequest request,
        Authentication auth) {
    boolean isAdmin = auth.getAuthorities().stream().anyMatch(g -> "ROLE_ADMIN".equals(g.getAuthority()));
    approvalLineManagementService.replacePendingApprovers(apfMngNo, request.getApproverEnos(), auth.getName(), isAdmin);
    return ResponseEntity.noContent().build();
}
```

Implement the service by loading the in-progress application and its ordered approvers once, calling `assertCanManage`, rejecting blank or duplicate ids, resolving all requested users with `findByEnoIn`, and rejecting a missing id. Keep the completed prefix unchanged; delete only pending entities, create new pending `Cdecim` entities in the requested order after the completed prefix, update every `lstDcdYn`, and call `approvalLineDelegate.updateApprovalOrder` with the final ordered entities. Keep the whole method under `@Transactional`.

- [ ] **Step 4: Run the focused backend tests to verify they pass**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.common.approval.controller.ApplicationControllerTest' --tests 'com.kdb.it.common.approval.service.ApprovalLineManagementServiceTest'`

Expected: PASS; tests prove MFA-protected routing, authorization propagation, duplicate rejection, processed-entry preservation, and rollback.

- [ ] **Step 5: Commit the backend API task**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java src/main/java/com/kdb/it/common/approval/service/ApprovalLineManagementService.java src/test/java/com/kdb/it/common/approval/controller/ApplicationControllerTest.java src/test/java/com/kdb/it/common/approval/service/ApprovalLineManagementServiceTest.java
git commit -m "feat: replace pending approval line atomically"
```

### Task 2: 결재자 표시 정보를 배치 응답에 포함

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationBulkReadSupport.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java`

**Interfaces:**
- Consumes: ordered `ApproverReadView` rows and `UserRepository.findByEnoIn`.
- Produces: `ApplicationApproverResponse` fields `usrNm`, `ptCNm`, and `bbrNm` with null permitted for historical or missing user records.

- [ ] **Step 1: Write failing response-assembly and OpenAPI tests**

```java
assertThat(response.getApprovers()).extracting(ApplicationDto.ApproverResponse::getUsrNm)
        .containsExactly("김기획부장", "김기획팀장");
assertEnum(ApplicationDto.ApproverResponse.class, "lstDcdYn", "Y", "N");
assertSchemaNullable(ApplicationDto.ApproverResponse.class, "usrNm", "ptCNm", "bbrNm");
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.common.approval.service.ApplicationServiceTest' --tests 'com.kdb.it.architecture.ApiResponseOpenApiContractTest'`

Expected: FAIL because `ApproverResponse` has no display fields and the response assembler does not batch-resolve approver users.

- [ ] **Step 3: Add display fields and one batch resolver**

```java
@Schema(description = "결재자 성명", nullable = true)
private String usrNm;
@Schema(description = "결재자 직위명", nullable = true)
private String ptCNm;
@Schema(description = "결재자 부서명", nullable = true)
private String bbrNm;
```

Collect every nonblank `dcrEno` in the list once, load them with `UserRepository.findByEnoIn`, build an eno-keyed display map, and pass that map into an overload of `ApplicationDto.Response.fromReadViews`. Use the same helper for `ApplicationBulkReadSupport.read`, `assembleList`, and `ApplicationService.getApplication` so list and detail response shapes stay identical.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.common.approval.service.ApplicationServiceTest' --tests 'com.kdb.it.architecture.ApiResponseOpenApiContractTest'`

Expected: PASS; a list and a detail response both contain correctly matched display data without per-approver lookups.

- [ ] **Step 5: Commit the response enrichment task**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java src/main/java/com/kdb/it/common/approval/service/ApplicationBulkReadSupport.java src/main/java/com/kdb/it/common/approval/service/ApplicationService.java src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java
git commit -m "feat: expose approval line display details"
```

### Task 3: 공통 직원 검색 기반 결재선 편집 다이얼로그

**Files:**
- Modify: `it_frontend/app/components/common/EmployeeSearchDialog.vue`
- Modify: `it_frontend/app/components/common/styles/employee-search-dialog.css`
- Create: `it_frontend/app/components/approval/ApprovalLineEditorDialog.vue`
- Create: `it_frontend/app/utils/approvalLineEditor.ts`
- Test: `it_frontend/tests/unit/utils/approvalLineEditor.test.ts`
- Test: `it_frontend/tests/unit/components/approval/ApprovalLineEditorDialog.test.ts`

**Interfaces:**
- Consumes: `OrgUser` from `EmployeeSearchDialog` and `ApprovalLineEditorEntry[]`.
- Produces: `apply: [entries: ApprovalLineEditorEntry[]]`; entry fields are `id`, `name`, `rank`, `department`, `locked`, and optional `dcdSqn`.

- [ ] **Step 1: Write failing pure-rule and component tests**

```ts
it('같은 사번은 한 번만 결재선에 추가한다', () => {
    expect(addApprovalLineEntry([entry('E001')], employee('E001'))).toEqual([entry('E001')]);
});

it('잠긴 처리 완료 결재자는 삭제와 드래그 대상에서 제외한다', () => {
    const entries = [entry('E001', { locked: true }), entry('E002')];
    expect(removeApprovalLineEntry(entries, 'E001')).toEqual(entries);
    expect(reorderApprovalLineEntries(entries, 0, 1)).toEqual(entries);
});

it('추가를 선택해도 직원 검색 다이얼로그를 닫지 않고 적용까지 부모 상태를 변경하지 않는다', async () => {
    await wrapper.find('[data-testid="employee-add-E002"]').trigger('click');
    expect(wrapper.emitted('apply')).toBeUndefined();
    expect(wrapper.emitted('update:visible')).toBeUndefined();
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `cd C:\it\it_frontend; npm test -- tests/unit/utils/approvalLineEditor.test.ts tests/unit/components/approval/ApprovalLineEditorDialog.test.ts`

Expected: FAIL because the editor utility and dialog do not exist.

- [ ] **Step 3: Implement staged editing and reuse the employee-search surface**

```ts
export interface ApprovalLineEditorEntry {
    id: string;
    name: string;
    rank: string;
    department: string;
    locked: boolean;
    dcdSqn?: number;
}

const emit = defineEmits<{
    'update:visible': [value: boolean];
    apply: [entries: ApprovalLineEditorEntry[]];
}>();
```

Add optional `keep-open-on-select` and `aside` slot support to `EmployeeSearchDialog`; its default callers retain the existing auto-close behavior. `ApprovalLineEditorDialog` supplies the right-side `aside` slot, copies entries when opened, sends selected employees to `addApprovalLineEntry`, and emits only a copied staged array on `apply`. Use the existing `AppDialogHeader`, `AppDialogFooter`, `TableSearchInput`, CSS tokens, employee-search loading states, global search, organization tree, and error reporting. Provide `data-testid` values for employee add, editor entry, remove, and apply controls.

- [ ] **Step 4: Run the dialog and utility tests to verify they pass**

Run: `cd C:\it\it_frontend; npm test -- tests/unit/utils/approvalLineEditor.test.ts tests/unit/components/approval/ApprovalLineEditorDialog.test.ts`

Expected: PASS; the original employee search stays open while staging edits, and cancel leaves the source entries unchanged.

- [ ] **Step 5: Commit the shared dialog task**

```powershell
cd C:\it\it_frontend
git add app/components/common/EmployeeSearchDialog.vue app/components/common/styles/employee-search-dialog.css app/components/approval/ApprovalLineEditorDialog.vue app/utils/approvalLineEditor.ts tests/unit/utils/approvalLineEditor.test.ts tests/unit/components/approval/ApprovalLineEditorDialog.test.ts
git commit -m "feat: add approval line editor dialog"
```

### Task 4: 예산 보고서의 단일 결재선 편집 흐름

**Files:**
- Modify: `it_frontend/app/components/approval/ApprovalLineSelector.vue`
- Modify: `it_frontend/app/pages/budget/report.vue`
- Modify: `it_frontend/i18n/messages/budget.ts`
- Test: `it_frontend/tests/unit/components/approval/ApprovalLineSelector.test.ts`
- Test: `it_frontend/tests/e2e/report-pdf-latest.spec.ts`

**Interfaces:**
- Consumes: `ApprovalLineEditorDialog` `apply(entries)`.
- Produces: one replacement `ApprovalLine`, then one `generatePdf()` invocation.

- [ ] **Step 1: Write failing selector and report E2E tests**

```ts
it('결재선 지정/수정 버튼 하나만 emit한다', async () => {
    await wrapper.find('[data-testid="open-approval-line-editor"]').trigger('click');
    expect(wrapper.emitted('edit')).toHaveLength(1);
    expect(wrapper.find('[data-testid="select-team-lead"]').exists()).toBe(false);
});
```

```ts
await page.getByTestId('open-approval-line-editor').click();
await page.getByTestId('employee-add-E900').click();
await page.getByTestId('approval-line-editor-apply').click();
await expect(page.getByTestId('report-preview')).toHaveAttribute('src', /blob:/);
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd C:\it\it_frontend; npm test -- tests/unit/components/approval/ApprovalLineSelector.test.ts; npm run test:e2e -- report-pdf-latest.spec.ts`

Expected: FAIL because the report still exposes per-slot selection and no common dialog trigger exists.

- [ ] **Step 3: Replace per-slot controls with the editor adapter**

```vue
<ApprovalLineSelector
    :approval-line="approvalLine"
    :disabled="loading || isSubmitting"
    @edit="showApprovalLineEditor = true"
/>
<ApprovalLineEditorDialog
    v-model:visible="showApprovalLineEditor"
    :entries="toDraftApprovalLineEntries(approvalLine)"
    @apply="applyApprovalLineEntries"
/>
```

Implement `applyApprovalLineEntries(entries)` so it maps the staged entries to the existing `ApprovalLine` shape and `order`, replaces `approvalLine.value` once, closes the dialog, and calls `void generatePdf()` once. Delete the report-local employee search target state and individual add/remove handlers. Add Korean and English labels for the button, panel title, duplicate warning, apply, and retry error.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `cd C:\it\it_frontend; npm test -- tests/unit/components/approval/ApprovalLineSelector.test.ts; npm run test:e2e -- report-pdf-latest.spec.ts`

Expected: PASS; the final PDF submission still sends ids in the staged drag order.

- [ ] **Step 5: Commit the budget report task**

```powershell
cd C:\it\it_frontend
git add app/components/approval/ApprovalLineSelector.vue app/pages/budget/report.vue i18n/messages/budget.ts tests/unit/components/approval/ApprovalLineSelector.test.ts tests/e2e/report-pdf-latest.spec.ts
git commit -m "feat: edit budget approval line in dialog"
```

### Task 5: 결재 대기 타임라인의 단일 편집·적용 흐름

**Files:**
- Modify: `it_frontend/app/composables/useApprovals.ts`
- Modify: `it_frontend/app/components/approval/ApprovalTimeline.vue`
- Modify: `it_frontend/i18n/messages/approval.ts`
- Test: `it_frontend/tests/unit/composables/approval-mfa-coverage.test.ts`
- Test: `it_frontend/tests/unit/components/ApprovalTimelineApproverChange.test.ts`
- Test: `it_frontend/tests/e2e/approval.spec.ts`

**Interfaces:**
- Consumes: `replacePendingApprovers(apfMngNo: string, approverEnos: string[]): Promise<void>`.
- Produces: a refreshed timeline after an editor `apply` succeeds.

- [ ] **Step 1: Write failing API, MFA coverage, component, and E2E tests**

```ts
it('결재선 일괄 변경 요청을 MFA로 감싸 PUT으로 전송한다', async () => {
    await useApprovals().replacePendingApprovers('APF-1', ['E200', 'E300']);
    expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:28080/api/applications/APF-1/approvers',
        expect.objectContaining({ method: 'PUT', body: { approverEnos: ['E200', 'E300'] } }),
    );
});
```

```ts
expect(wrapper.find('[data-testid="open-approval-line-editor"]').exists()).toBe(true);
expect(wrapper.find('[data-testid^="change-approver-"]').exists()).toBe(false);
expect(wrapper.find('[data-testid^="remove-timeline-approver-"]').exists()).toBe(false);
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `cd C:\it\it_frontend; npm test -- tests/unit/composables/approval-mfa-coverage.test.ts tests/unit/components/ApprovalTimelineApproverChange.test.ts; npm run test:e2e -- approval.spec.ts`

Expected: FAIL because no batch client exists and the timeline still exposes individual mutation controls.

- [ ] **Step 3: Add the MFA client and timeline adapter**

```ts
const replacePendingApprovers = async (apfMngNo: string, approverEnos: string[]) =>
    runWithApprovalMfa(() =>
        $apiFetch<void>(`${API_BASE_URL}/${apfMngNo}/approvers`, {
            method: 'PUT',
            body: { approverEnos },
        }),
    );
```

Map `approvalData.approvers` to editor entries, setting `locked` from `dcdDt` or `dcdSts`. Replace the card-level change, add, remove, and drag controls with a single `결재선 지정/수정` button visible only when the existing `canManageLine` condition is true. On apply, reject an empty mutable section in the dialog, call `replacePendingApprovers`, then call `refreshTimeline`; retain the dialog state and show the common mapped error when the request fails.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `cd C:\it\it_frontend; npm test -- tests/unit/composables/approval-mfa-coverage.test.ts tests/unit/components/ApprovalTimelineApproverChange.test.ts; npm run test:e2e -- approval.spec.ts`

Expected: PASS; processed approvers remain visible and immovable, while the submitted ids match the editable staged sequence.

- [ ] **Step 5: Commit the pending approval task**

```powershell
cd C:\it\it_frontend
git add app/composables/useApprovals.ts app/components/approval/ApprovalTimeline.vue i18n/messages/approval.ts tests/unit/composables/approval-mfa-coverage.test.ts tests/unit/components/ApprovalTimelineApproverChange.test.ts tests/e2e/approval.spec.ts
git commit -m "feat: edit pending approval line atomically"
```

### Task 6: 계약 생성과 전체 검증

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (generated only)
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/controller/ApplicationControllerTest.java`
- Test: `it_frontend/tests/e2e/report-pdf-latest.spec.ts`
- Test: `it_frontend/tests/e2e/approval.spec.ts`

**Interfaces:**
- Consumes: running backend OpenAPI endpoint after Tasks 1 and 2.
- Produces: generated frontend types that include `ApplicationReplacePendingApproversRequest` and the new approver display fields.

- [ ] **Step 1: Add a failing contract assertion for the generated request name and response fields**

```ts
expect(apiTypes).toContain('ApplicationReplacePendingApproversRequest');
expect(apiTypes).toContain('usrNm?: string');
expect(apiTypes).toContain('ptCNm?: string');
expect(apiTypes).toContain('bbrNm?: string');
```

- [ ] **Step 2: Run the contract check to verify it fails before regeneration**

Run: `cd C:\it\it_frontend; npm run codegen:check`

Expected: FAIL because generated API types do not yet include the new server contract.

- [ ] **Step 3: Regenerate types and run static checks**

```powershell
cd C:\it\it_frontend
npm run codegen
npm run codegen:check
npm run format:check
npm run check
npm run lint:css
```

Confirm the generated diff contains only the server contract changes; do not hand-edit `app/types/api.d.ts`.

- [ ] **Step 4: Run complete backend and frontend verification**

Run:

```powershell
cd C:\it\it_backend
./gradlew test
./gradlew check
cd C:\it\it_frontend
npm test
npm run test:e2e -- report-pdf-latest.spec.ts approval.spec.ts
```

Expected: PASS; the full unit suites, backend contract suite, and two changed end-to-end flows are green.

- [ ] **Step 5: Commit generated contract and final test updates**

```powershell
cd C:\it\it_frontend
git add app/types/api.d.ts
git commit -m "chore: regenerate approval API types"
```

## Plan Self-Review

- Spec coverage: Tasks 3–5 implement the shared dialog, organization tree reuse, staged apply/cancel, the budget PDF update, and pending-approval editing. Tasks 1–2 implement atomic server persistence, MFA, processed-entry protection, and batch display data. Task 6 verifies generated contracts and end-to-end behavior.
- Placeholder scan: the plan contains concrete files, interfaces, test cases, commands, and implementation boundaries for every task.
- Type consistency: `ApprovalLineEditorEntry`, `replacePendingApprovers`, `approverEnos`, and `dcdSqn` use the same names in all tasks.
