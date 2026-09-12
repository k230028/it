# IT Budget Drafter Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전산예산 신청서 PDF 결재선의 기안자 결재일자 아래에 실제 상신 시각을 `HH:mm:ss`로 표시한다.

**Architecture:** 백엔드가 상신 시 이미 계산하는 `requestAt`을 v2 스냅샷의 기안자 `date`에 저장한다. 프론트엔드는 선택적인 기안자 시각을 검증·변환해 기존 `buildDateCell` 렌더링 경로로 전달하며, 날짜만 가진 과거 문서는 그대로 호환한다.

**Tech Stack:** Java 25, Spring Boot 4, Jackson, Jakarta Validation, Nuxt 4, Vue 3, TypeScript, Vitest, pdfmake

**Spec:** `docs/superpowers/specs/done/2026-09-06-it-budget-drafter-time.md`

## Global Constraints

- 출력 시각은 24시간제 `HH:mm:ss`이며 날짜 아래 두 번째 줄에 표시한다.
- 상단 메타 정보의 `신청일자`는 날짜만 표시한다.
- 과거 v2 스냅샷에서 기안자 `date`가 누락되어도 파싱할 수 있어야 한다.
- 기존 사용자 및 다른 작업의 워킹트리 변경을 되돌리지 않는다.
- 생성 API 타입은 수기로 편집하지 않고 백엔드 OpenAPI에서 재생성한다.

---

### Task 1: 백엔드 기안자 상신 시각 스냅샷 계약

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/model/ItBudgetSnapshot.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/dto/ItBudgetApprovalDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSubmissionTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/dto/ItBudgetApprovalDtoTest.java`

**Interfaces:**
- Consumes: 상신 시 생성되는 `LocalDateTime requestAt`.
- Produces: `ItBudgetSnapshot.Requester(String eno, String name, String rank, LocalDateTime date)` 및 동일한 공개 DTO 필드.

- [x] **Step 1: 저장 스냅샷의 기안자 시각을 요구하는 실패 테스트 작성**

```java
assertThat(snapshot.at("/approvalLine/requester/date").asText())
        .isEqualTo("2030-01-02T23:59:59");
```

- [x] **Step 2: 백엔드 대상 테스트를 실행해 `requester.date`가 없어서 실패하는지 확인**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.itbudget.service.ItBudgetSubmissionTest'`

Expected: `approvalLine.requester.date`가 빈 값이어서 FAIL.

- [x] **Step 3: 기안자 모델·DTO에 선택적인 초 단위 결재일시 추가**

```java
public record Requester(String eno, String name, String rank, LocalDateTime date) {}
```

공개 DTO의 `date`에는 결재자와 동일한 엄격한 Jackson 역직렬화와 `date-time` OpenAPI 계약을 적용하되, 과거 JSON 누락을 허용하도록 required 속성에서는 제외한다.

- [x] **Step 4: 상신 시 `requestAt`을 기안자에게 기록하고 공개 스냅샷까지 전달**

```java
new ItBudgetSnapshot.Requester(
        requester.eno(), requester.name(), requester.rank(), requestAt)
```

미리보기 생성 경로에서는 `date`를 `null`로 둔다.

- [x] **Step 5: 백엔드 대상 테스트를 다시 실행해 통과 확인**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.itbudget.service.ItBudgetSubmissionTest' --tests 'com.kdb.it.common.approval.itbudget.dto.ItBudgetApprovalDtoTest'`

Expected: PASS.

### Task 2: 프론트 기안자 시각 파싱과 PDF 표시

**Files:**
- Modify: `it_frontend/app/features/approval/forms/itBudget/snapshotValidation.ts`
- Modify: `it_frontend/app/features/approval/forms/itBudget/schema.ts`
- Generated: `it_frontend/app/types/api.d.ts`
- Test: `it_frontend/tests/unit/utils/itBudgetSnapshot.test.ts`
- Test: `it_frontend/tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`

**Interfaces:**
- Consumes: `ItBudgetSnapshotRequester.date?: string | null`.
- Produces: `RenderApprovalLine.drafter.date`에 실제 상신 시각 또는 `null` 전달.

- [x] **Step 1: 기안자 시각 표시와 과거 문서 호환 실패 테스트 작성**

```ts
expect(approvalTable.table.body[2][0].text.map((line: { text: string }) => line.text)).toEqual([
    '2030-01-02',
    '\n23:59:59',
]);
```

과거 fixture에서 `requester.date`를 제거한 뒤에도 `readItBudgetSnapshot`이 성공하는 테스트를 함께 둔다.

- [x] **Step 2: 프론트 대상 테스트를 실행해 기안자 시각이 전달되지 않아 실패하는지 확인**

Run: `npm test -- tests/unit/utils/itBudgetSnapshot.test.ts tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`

Expected: 기안자 셀에 시각 줄이 없어서 FAIL.

- [x] **Step 3: OpenAPI 타입 재생성 후 선택 필드 검증과 렌더 변환 구현**

```ts
drafter: {
    id: requester.eno,
    name: requester.name,
    rank: requester.rank,
    date: requester.date ?? null,
}
```

엄격 객체 검증은 `requester.date`만 선택적으로 허용하고, 값이 있으면 `YYYY-MM-DDTHH:mm:ss` 또는 과거 날짜 형식을 검증한다.

- [x] **Step 4: 프론트 대상 테스트를 다시 실행해 통과 확인**

Run: `npm test -- tests/unit/utils/itBudgetSnapshot.test.ts tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`

Expected: PASS.

### Task 3: 계약 및 품질 게이트

**Files:**
- Verify only: 위 변경 파일 전체

**Interfaces:**
- Consumes: Task 1의 OpenAPI 계약과 Task 2의 생성 타입 및 렌더링 경로.
- Produces: 백엔드·프론트엔드 간 일치가 검증된 변경 묶음.

- [x] **Step 1: 백엔드 관련 회귀 테스트 실행**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.itbudget.*' --tests 'com.kdb.it.common.approval.service.ApprovalStoredSnapshotTest'`

- [x] **Step 2: 프론트 생성 타입 계약 확인**

Run: `npm run codegen:check`

- [x] **Step 3: 프론트 정적 검사와 관련 테스트 실행**

Run: `npm run check`

Run: `npm test -- tests/unit/utils/itBudgetSnapshot.test.ts tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`

- [x] **Step 4: 변경 diff를 검토해 상단 신청일자와 과거 문서 호환성이 유지되는지 확인**

Run: `git diff --check`

Expected: 공백 오류 없음. 상단 신청일자의 `toDateOnly` 호출은 변경되지 않음.
