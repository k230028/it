# 전산예산 원장 스냅샷 v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신규 전산예산 신청서를 전체 원장 컬럼을 보존하는 v3로 생성하고, 정보화사업·경상사업의 외화 품목 당해 요청금액을 외화 원금으로 표시한다.

**Architecture:** 기존 v2 모델과 canonical digest 경로는 동결하고 별도 v3 DTO·내부 모델·reader 분기를 추가한다. v3 payload는 현재 표시 projection과 물리 컬럼명 기반 ledger를 함께 담으며, 생성 시점 계약 테스트가 네 원장 엔티티와 `BaseEntity`의 모든 `@Column` 캡처를 강제한다. 프론트는 v2 parser를 유지하고 v3만 `foreignAmount`와 ledger를 해석해 공통 PDF render model로 변환한다.

**Tech Stack:** Java 25, Spring Boot 4, Jackson, Bean Validation, JUnit 5, AssertJ, Nuxt 4, Vue 3, TypeScript, Vitest, pdfmake, OpenAPI codegen

**Spec:** `docs/superpowers/specs/2026-09-15-it-budget-ledger-snapshot-v3-design.md`

## Global Constraints

- 신규 상신만 `form.version = 3`, `canonicalization = IT_BUDGET_V3`를 사용한다.
- 기존 v1·v2 JSON과 v2 canonical digest 입력 구조는 수정하지 않는다.
- v3 ledger는 `BPROJM`, `BITEMM`, `BCOSTM`, `BTERMM` 및 `BaseEntity`의 모든 `@Column` 스칼라 값을 포함한다.
- ledger 키는 실제 대문자 물리 컬럼명이며 JPA 연관 객체는 포함하지 않는다.
- v3 표시 projection과 ledger는 같은 트랜잭션에서 읽은 같은 aggregate로 생성한다.
- PDF 총괄 합계와 정렬은 원화 환산액을 유지하고, 상세 품목 셀만 외화 원금을 사용한다.
- API 타입은 백엔드 OpenAPI에서 생성하며 `app/types/api.d.ts`를 수기로 편집하지 않는다.
- DB 스키마는 변경하지 않는다.
- 공유 워킹트리의 무관한 변경을 되돌리거나 함께 스테이징하지 않는다.

---

### Task 1: v3 ledger 모델과 전체 원장 컬럼 캡처

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/model/ItBudgetLedgerSnapshot.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetLedgerCapture.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetLedgerCaptureTest.java`
- Read-only reference: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSourceData.java`

**Interfaces:**
- Consumes: `ItBudgetSourceLoader.SourceAggregate`, `ItBudgetCanonicalJson`, 네 원장 엔티티와 `BaseEntity` getter
- Produces: `ItBudgetLedgerSnapshot capture(List<SourceAggregate> aggregates)`
- Produces: `Set<String> declaredColumns(Class<? extends BaseEntity> entityType)` for contract tests only

- [ ] **Step 1: 캡처 누락을 재현하는 실패 테스트 작성**

`ItBudgetLedgerCaptureTest`에 다음 계약을 작성한다.

```java
@Test
@DisplayName("ledger 캡처 키는 네 원장과 BaseEntity의 모든 @Column 물리명과 일치한다")
void capturedColumnsMatchJpaColumns() {
    assertThat(capture.columnNames(Bprojm.class)).containsExactlyInAnyOrderElementsOf(
            persistentColumnNames(Bprojm.class));
    assertThat(capture.columnNames(Bitemm.class)).containsExactlyInAnyOrderElementsOf(
            persistentColumnNames(Bitemm.class));
    assertThat(capture.columnNames(Bcostm.class)).containsExactlyInAnyOrderElementsOf(
            persistentColumnNames(Bcostm.class));
    assertThat(capture.columnNames(Btermm.class)).containsExactlyInAnyOrderElementsOf(
            persistentColumnNames(Btermm.class));
}
```

픽스처 aggregate를 캡처한 뒤 `BITEMM` row에서 아래 값도 직접 검증한다.

```java
assertThat(item.columns())
        .containsEntry("CUR_C", "USD")
        .containsEntry("AMT", "1350000.000")
        .containsEntry("FC_AMT", "1000.000")
        .containsEntry("XCR", "1350.0000");
```

- [ ] **Step 2: 실패 확인**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.common.approval.itbudget.service.ItBudgetLedgerCaptureTest"
```

Expected: `ItBudgetLedgerCapture` 또는 전체 컬럼 선언이 없어 컴파일/계약 실패.

- [ ] **Step 3: immutable ledger 모델 작성**

`ItBudgetLedgerSnapshot.java`에 다음 경계를 만든다.

```java
public record ItBudgetLedgerSnapshot(String format, List<Aggregate> aggregates) {
    public ItBudgetLedgerSnapshot {
        if (!"IT_BUDGET_LEDGER_V1".equals(format)) throw new IllegalArgumentException("ledger 형식이 올바르지 않습니다.");
        aggregates = List.copyOf(aggregates);
    }

    public record Aggregate(String kind, String id, int revision, Row parent, List<Row> children) {
        public Aggregate { children = List.copyOf(children); }
    }

    public record Row(String table, Map<String, Object> columns) {
        public Row { columns = Collections.unmodifiableMap(new TreeMap<>(columns)); }
    }
}
```

- [ ] **Step 4: 명시적 원장 캡처 구현**

`ItBudgetLedgerCapture`는 `PROJECT → BPROJM/BITEMM`, `COST → BCOSTM/BTERMM`으로 변환한다. 각 테이블의 `columnNames` 상수에는 해당 엔티티와 `BaseEntity`의 `@Column(name)`을 모두 선언한다. 값은 다음 규칙으로 넣는다.

```java
values.put("AMT", canonical.money(item.getAmt()));
values.put("FC_AMT", canonical.money(item.getFcAmt()));
values.put("XCR", canonical.exchangeRate(item.getXcr()));
values.put("FST_ENR_DTM", item.getFstEnrDtm());
values.put("LST_CHG_DTM", item.getLstChgDtm());
```

공통 감사 컬럼은 전용 `putBaseColumns(Map<String, Object>, BaseEntity)`로 한 번만 정의한다. 캡처 row map과 선언 키 집합이 다르면 생성 시 `IllegalStateException`으로 실패하게 한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: Task 1 Step 2와 동일.

Expected: PASS; 네 테이블의 키 집합과 외화·감사 값 검증 통과.

- [ ] **Step 6: 백엔드 Task 1 커밋**

```powershell
git add -- src/main/java/com/kdb/it/common/approval/itbudget/model/ItBudgetLedgerSnapshot.java src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetLedgerCapture.java src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetLedgerCaptureTest.java
git diff --cached --check
git commit -m "feat: 전산예산 v3 원장 전체 컬럼 캡처 추가"
```

---

### Task 2: v3 내부 모델·공개 DTO·builder 생성 경로

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/model/ItBudgetSnapshotV3.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/dto/ItBudgetSnapshotV3Dto.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotV3Codec.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotBuilder.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotBuilderTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacadeTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/dto/ItBudgetApprovalDtoTest.java`

**Interfaces:**
- Consumes: Task 1 `ItBudgetLedgerCapture.capture(...)`
- Produces: `ItBudgetSnapshotV3.Payload(projects, costs, summary, ledger)`
- Produces: `ItBudgetSnapshotV3Dto` with `ProjectItem.foreignAmount`
- Produces: 신규 preview/submission snapshot `form.version = 3`

- [ ] **Step 1: builder v3 실패 테스트 작성**

기존 외화 `Bitemm` 픽스처의 `fcAmt`를 `1000.000`으로 만들고 아래를 추가한다.

```java
var built = builder.buildDocuments(documents, aggregates).getFirst();
var item = built.payload().projects().getFirst().items().getFirst();
assertThat(item.foreignAmount()).isEqualByComparingTo("1000.000");
assertThat(built.payload().ledger().format()).isEqualTo("IT_BUDGET_LEDGER_V1");
assertThat(built.payloadDigest()).isEqualTo(canonical.digest(built.payload()));
```

facade 테스트는 최종 JSON의 `/form/version = 3`, `/integrity/canonicalization = IT_BUDGET_V3`, `/payload/ledger/aggregates` 존재를 검증한다.

- [ ] **Step 2: 실패 확인**

```powershell
./gradlew test --tests "com.kdb.it.common.approval.itbudget.service.ItBudgetSnapshotBuilderTest" --tests "com.kdb.it.common.approval.itbudget.service.ItBudgetApprovalFacadeTest" --tests "com.kdb.it.common.approval.itbudget.dto.ItBudgetApprovalDtoTest"
```

Expected: v3 타입, `foreignAmount`, ledger, version 3이 없어 FAIL.

- [ ] **Step 3: v2와 분리된 v3 모델 구현**

기존 `ItBudgetSnapshot`은 수정하지 않는다. `ItBudgetSnapshotV3`에 v2와 같은 값 객체를 독립 선언하고 다음 차이만 둔다.

```java
public record ProjectItem(
        String id, int revision, int sequence, CodeLabel budgetType,
        String goodsName, BigDecimal quantity, String currency,
        BigDecimal amount, BigDecimal foreignAmount, String calculationBasis) {}

public record Payload(
        List<Project> projects, List<Cost> costs, Summary summary,
        ItBudgetLedgerSnapshot ledger) {}
```

`ItBudgetSnapshotV3Dto.ProjectItem.foreignAmount`는 `MONEY_PATTERN`, nullable JSON 필드로 선언한다. v3 ledger DTO는 `format`, aggregate identity, table, `Map<String, Object> columns`를 노출한다.

- [ ] **Step 4: builder를 v3로 전환**

`BuiltDocument.payload`을 `ItBudgetSnapshotV3.Payload`로 바꾸고 `project(...)`에서 다음 값을 사용한다.

```java
canonical.money(item.getAmt()),
canonical.money(item.getFcAmt()),
item.getCncdFdtnCone()
```

`buildDocuments`가 입력 aggregate 순서에 맞춰 `ledgerCapture.capture(aggregates)`를 payload에 포함한다. 표시 projection과 ledger의 aggregate id/revision/child key가 일치하지 않으면 `IT_BUDGET_PREVIEW_INVALID` 경로로 실패한다.

- [ ] **Step 5: facade와 codec을 v3 생성으로 전환**

최종 공개 문서는 다음 상수를 사용한다.

```java
new Form("it-budget", 3)
new Integrity("SHA-256", "IT_BUDGET_V3", payloadDigest, capturedAt, sources)
```

`ItBudgetSnapshotV3Codec`은 내부 `BigDecimal`을 기존 money/exchange scale 문자열로 바꾸고 ledger map 값은 canonical capture 값을 그대로 보존한다.

- [ ] **Step 6: Task 2 테스트 통과 확인**

Run: Task 2 Step 2와 동일.

Expected: PASS; 신규 문서 v3, 외화 원금과 ledger 포함.

- [ ] **Step 7: 백엔드 Task 2 커밋**

대상 파일만 명시적으로 stage하고 다음 메시지로 커밋한다.

```powershell
git commit -m "feat: 전산예산 신청서 v3 생성 계약 추가"
```

---

### Task 3: v1·v2·v3 reader와 무결성 호환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotReader.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotCodec.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotV3Codec.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotReaderTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/StoredSnapshotFixture.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotObservationTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshot.java` only if the unified read payload type requires it

**Interfaces:**
- Consumes: frozen v2 `ItBudgetApprovalDto.ItBudgetSnapshot` and new `ItBudgetSnapshotV3Dto`
- Produces: `ParsedSnapshot.version()` returning 1, 2, or 3
- Produces: 기존 `ParsedSnapshot.payload(): ItBudgetSnapshot.Payload`을 v2 표시 projection으로 유지
- Produces: `ParsedSnapshot.v3Payload(): ItBudgetSnapshotV3.Payload` for version 3 only

- [ ] **Step 1: 저장된 v2 fixture 고정 테스트와 v3 실패 테스트 작성**

v2 fixture의 기존 JSON과 digest를 상수로 유지하고 다음을 검증한다.

```java
var v2Parsed = reader.read(StoredSnapshotFixture.v2Json());
assertThat(v2Parsed.version()).isEqualTo(2);
assertThat(v2Parsed.payload()).isNotNull();
```

v3 fixture에는 ledger와 project item `foreignAmount`를 포함하고 다음을 검증한다.

```java
var v3Parsed = reader.read(StoredSnapshotFixture.v3Json());
assertThat(v3Parsed.version()).isEqualTo(3);
assertThat(v3Parsed.v3Payload().projects().getFirst().items().getFirst().foreignAmount())
        .isEqualByComparingTo("1000.000");
```

ledger `FC_AMT` 변조 시 digest 실패, identity 누락 시 구조 실패, 임의의 추가 scalar column은 성공, object/array column value는 실패하는 테스트를 각각 추가한다.

- [ ] **Step 2: 실패 확인**

```powershell
./gradlew test --tests "com.kdb.it.common.approval.itbudget.service.ItBudgetSnapshotReaderTest" --tests "com.kdb.it.common.approval.itbudget.service.ItBudgetSnapshotObservationTest"
```

Expected: version 3이 지원되지 않아 FAIL.

- [ ] **Step 3: reader 버전 분기 구현**

버전 판별은 envelope 존재 여부를 먼저 확인하고 다음 분기를 사용한다.

```java
return switch (version.intValue()) {
    case 2 -> readV2(root); // 기존 DTO, codec, IT_BUDGET_V2를 그대로 사용
    case 3 -> readV3(root); // v3 DTO, codec, IT_BUDGET_V3 사용
    default -> throw corrupt("unknown", "지원하지 않는 전산예산 스냅샷 버전입니다.");
};
```

`readV3`는 ledger row columns가 null 또는 JSON string/number/boolean인지 확인한다. aggregate kind별 부모/자식 테이블 조합과 id/revision/복합키 일치도 검증한다. 알 수 없는 scalar column key는 허용한다.

- [ ] **Step 4: 공통 소비 projection 정리**

`ParsedSnapshot`은 기존 v2 소비자를 깨지 않도록 아래 두 payload를 분리해 보관한다.

```java
private final ItBudgetSnapshot.Payload payload;
private final ItBudgetSnapshotV3.Payload v3Payload;

public ItBudgetSnapshot.Payload payload() { return payload; }
public ItBudgetSnapshotV3.Payload v3Payload() {
    if (version != 3) throw new IllegalStateException("v3 문서에만 v3 payload를 사용할 수 있습니다.");
    return v3Payload;
}
```

v3 읽기에서는 먼저 원본 `ItBudgetSnapshotV3.Payload`로 `IT_BUDGET_V3` digest를 검증한 뒤 `ItBudgetSnapshotV3Codec.toV2View(v3Payload)`로 메일·기존 서버 소비자용 표시 projection을 만든다. `toV2View`는 `foreignAmount`와 ledger만 버리고 이름·구분·원화 합계를 그대로 옮긴다. 이 projection은 소비 편의를 위한 것이며 digest 계산에는 절대 사용하지 않는다.

- [ ] **Step 5: reader·관측 테스트 통과 확인**

Run: Task 3 Step 2와 동일.

Expected: v1/v2/v3 정상, v2 고정 fixture 해시 유지, v3 손상 차단.

- [ ] **Step 6: 백엔드 Task 3 커밋**

```powershell
git commit -m "feat: 전산예산 v3 무결성 읽기 지원"
```

---

### Task 4: 백엔드 OpenAPI 계약 확정과 프론트 타입 생성

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/controller/ItBudgetApplicationControllerTest.java`
- Generated: `it_frontend/app/types/api.d.ts`

**Interfaces:**
- Consumes: Task 2 `ItBudgetSnapshotV3Dto`
- Produces: OpenAPI `ItBudgetSnapshotV3`, `ItBudgetSnapshotProjectItemV3.foreignAmount`, ledger schemas
- Produces: regenerated frontend `Schemas[...]` types

- [ ] **Step 1: OpenAPI 실패 테스트 작성**

응답 snapshot version 기대값을 3으로 바꾸고 schema required/nullable 계약을 검증한다.

```java
assertThat(projectItemV3.required()).contains("foreignAmount");
assertThat(projectItemV3.property("foreignAmount").nullable()).isTrue();
assertThat(snapshotV3.required()).contains("payload", "approvalLine", "integrity");
```

- [ ] **Step 2: 실패 확인**

```powershell
./gradlew test --tests "com.kdb.it.architecture.ApiResponseOpenApiContractTest" --tests "com.kdb.it.common.approval.itbudget.controller.ItBudgetApplicationControllerTest"
```

Expected: v3 schema/version 기대와 현재 문서가 달라 FAIL.

- [ ] **Step 3: DTO annotation과 controller 응답 타입 보완**

`foreignAmount`는 JSON에서 항상 존재하지만 값은 nullable로, ledger aggregate/row/columns는 required로 고정한다. map value는 JSON scalar/null 계약을 설명하는 schema description을 둔다.

- [ ] **Step 4: 백엔드 계약 테스트 통과 확인**

Run: Task 4 Step 2와 동일.

- [ ] **Step 5: 백엔드 기동 후 프론트 타입 생성**

기존 README의 로컬 백엔드 기동 명령으로 OpenAPI endpoint를 연 뒤:

```powershell
cd C:\it\it_frontend
npm run codegen
npm run codegen:check
```

Expected: `app/types/api.d.ts`에 v3 item `foreignAmount`와 ledger schema가 생성되고 drift 없음.

- [ ] **Step 6: 저장소별 커밋**

백엔드 계약 테스트를 먼저 커밋한 다음 생성된 프론트 타입만 별도 커밋한다.

```powershell
git commit -m "test: 전산예산 v3 OpenAPI 계약 고정"
git commit -m "chore: 전산예산 v3 API 타입 생성"
```

---

### Task 5: 프론트 v3 검증과 render adapter

**Files:**
- Modify: `it_frontend/app/features/approval/forms/itBudget/definition.ts`
- Modify: `it_frontend/app/features/approval/forms/itBudget/schema.ts`
- Modify: `it_frontend/app/features/approval/forms/itBudget/snapshotValidation.ts`
- Modify: `it_frontend/app/features/approval/forms/itBudget/snapshotAdapter.ts`
- Modify: `it_frontend/app/types/approvalForm.ts`
- Modify: `it_frontend/tests/unit/utils/itBudgetSnapshot.test.ts`
- Modify: `it_frontend/tests/unit/utils/itBudgetSnapshotHardening.test.ts`
- Modify: `it_frontend/tests/unit/utils/itBudgetSnapshotFixture.ts`

**Interfaces:**
- Consumes: generated v3 OpenAPI schemas
- Produces: `readItBudgetSnapshotV3(value)` with additive scalar ledger columns
- Produces: render project item `{ amt, fcAmt, curC }`
- Produces: `RenderApprovalLine.snapshotVersion: 2 | 3`

- [ ] **Step 1: v3 parser 실패 테스트 작성**

fixture를 version 3/`IT_BUDGET_V3`로 확장하고 사업 품목에 `foreignAmount: '1000.500'`, payload에 ledger를 넣는다.

```ts
const detail = parseApprovalFormDetail(JSON.stringify(createV3Snapshot()));
expect(detail.form.version).toBe(3);
expect(detail.approvalLine.snapshotVersion).toBe(3);
expect(detail.projects[0]?.items?.[0]).toMatchObject({
    curC: 'USD',
    amt: 1_350_675,
    fcAmt: 1_000.5,
});
```

추가 ledger scalar key는 성공하고 `columns.EXTRA = { nested: true }`는 손상 오류가 되는 테스트도 작성한다. 기존 v2 fixture parse 성공 테스트는 그대로 둔다.

- [ ] **Step 2: 실패 확인**

```powershell
npx vitest run tests/unit/utils/itBudgetSnapshot.test.ts tests/unit/utils/itBudgetSnapshotHardening.test.ts
```

Expected: v3 미지원 또는 `foreignAmount` 미매핑으로 FAIL.

- [ ] **Step 3: version별 validator 구현**

기존 v2 validator 객체는 변경하지 않는다. v3 item에는 `foreignAmount: nullableMoney`, payload에는 ledger validator를 추가한다. ledger columns validator는 다음 계약을 사용한다.

```ts
const ledgerScalar = (value: unknown) =>
    value === null || ['string', 'number', 'boolean'].includes(typeof value);
```

row의 `table`, aggregate의 `kind/id/revision`, PROJECT/COST별 테이블 조합과 복합키는 별도 consistency 검사에서 검증한다.

- [ ] **Step 4: schema와 adapter 분기 구현**

```ts
if (parsed.form.version === 2 || parsed.form.version === 3) {
    const snapshot = parsed.form.version === 3
        ? readItBudgetSnapshotV3(parsed)
        : readItBudgetSnapshotV2(parsed);
    // version을 render line과 form에 그대로 보존
}
```

v3 adapter의 사업 품목은 `foreignAmount`를 `fcAmt`로 옮긴다. v2 adapter의 shape은 변경하지 않는다.

- [ ] **Step 5: parser 테스트 통과 확인**

Run: Task 5 Step 2와 동일.

- [ ] **Step 6: 프론트 Task 5 커밋**

현재 워킹트리에 존재하는 이전 PDF 기준일 제거 변경과 hunk가 겹치면 `git add -p`로 이번 task hunk만 검토한다. 생성 타입 커밋 이후 대상 파일만 stage한다.

```powershell
git commit -m "feat: 전산예산 v3 스냅샷 파싱 지원"
```

---

### Task 6: 사업 품목 외화금액 PDF 표시

**Files:**
- Modify: `it_frontend/app/features/approval/forms/itBudget/pdf/projectSection.ts`
- Modify: `it_frontend/app/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts`
- Modify: `it_frontend/tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`
- Modify: `it_frontend/tests/unit/features/approval/forms/itBudget/__snapshots__/useItBudgetApprovalFormPdf.test.ts.snap`

**Interfaces:**
- Consumes: Task 5 render item `amt`, `fcAmt`, `curC` and `snapshotVersion`
- Produces: v3 foreign item amount `formatSnapshotCurrency(fcAmt, curC)`
- Preserves: v1/v2 output, KRW output, summary/list sorting in KRW

- [ ] **Step 1: 정보화사업·경상사업 PDF 실패 테스트 작성**

v3 fixture에 USD 정보화사업과 EUR 경상사업을 넣고 각 상세 품목 표의 `당해 요청금액` 셀을 직접 찾는다.

```ts
expect(projectItemRows[0][5].text).toBe('US$1,000.50');
expect(ordinaryItemRows[0][5].text).toBe('€2,000.25');
```

같은 테스트 묶음에서 KRW는 `₩1,500,000`, v3 외화 `fcAmt == null`은 `-`, v2 외화 fixture는 기존 원화 표시를 검증한다. 전체 문자열 검색이 아니라 해당 품목 행과 셀을 직접 검사한다.

- [ ] **Step 2: RED 확인**

```powershell
npx vitest run tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts -t "사업 품목 외화"
```

Expected: 실제 값이 원화 `amount`로 출력돼 FAIL.

- [ ] **Step 3: 최소 렌더링 변경 구현**

`appendProjectDetailSections`에 `snapshotVersion`을 전달하고 금액 선택을 전용 함수로 둔다.

```ts
const formatProjectItemAmount = (
    item: ItBudgetRenderProject['items'][number],
    snapshotVersion: number,
): string => {
    if (snapshotVersion >= 3 && item.curC && item.curC !== 'KRW') {
        return item.fcAmt == null ? '-' : formatSnapshotCurrency(item.fcAmt, item.curC);
    }
    return typeof item.amt === 'number' ? formatKrwAmount(item.amt) : '';
};
```

목록과 summary의 `tyyBgAmt`, `assetBg`, `costBg` 계산 및 정렬 함수는 수정하지 않는다.

- [ ] **Step 4: GREEN 확인과 스냅샷 갱신**

```powershell
npx vitest run tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts -t "사업 품목 외화"
npx vitest run tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts -u
```

Expected: 대상 테스트와 전체 PDF 테스트 PASS; 스냅샷은 v3 관련 금액 셀만 변경.

- [ ] **Step 5: 실제 PDF 렌더 검증**

PDF 스킬의 marker를 한 번 실행한 뒤 v3 fixture로 샘플 PDF를 `it_frontend/tmp/pdfs/`에 생성한다.

```powershell
pdftoppm -png tmp/pdfs/it-budget-v3-sample.pdf tmp/pdfs/it-budget-v3-sample
```

PNG에서 정보화사업 USD, 경상사업 EUR, KRW 품목의 통화기호, 소수점, 셀 잘림·겹침을 확인한다. 샘플과 PNG는 검증 후 삭제한다.

- [ ] **Step 6: 프론트 Task 6 커밋**

```powershell
git commit -m "feat: 사업 외화 품목을 원통화 금액으로 표시"
```

---

### Task 7: 전체 호환 검증과 버전 조합 기록

**Files:**
- Modify: `versions.lock` through `scripts/update-versions-lock.ps1`
- Modify: `docs/superpowers/plans/2026-09-15-it-budget-ledger-snapshot-v3.md` only to check completed steps
- Move after completion: `docs/superpowers/specs/2026-09-15-it-budget-ledger-snapshot-v3-design.md` to `docs/superpowers/specs/done/`
- Move after completion: this plan to `docs/superpowers/plans/done/`

**Interfaces:**
- Consumes: completed backend and frontend commits
- Produces: verified compatible commit pair and completed documentation

- [ ] **Step 1: 백엔드 전체 품질 게이트 실행**

```powershell
cd C:\it\it_backend
./gradlew test
```

Expected: BUILD SUCCESSFUL, 실패 0.

- [ ] **Step 2: 프론트 전체 품질 게이트 실행**

```powershell
cd C:\it\it_frontend
npm run codegen:check
npm run format:check
npm run check
npm test
```

Expected: 각 명령 exit 0. 기존 무관한 기준선 실패가 있으면 변경 전 재현 여부와 대상 파일을 기록하고 이번 변경의 관련 테스트 결과와 분리해 보고한다.

- [ ] **Step 3: 호환 요구사항 최종 점검**

다음 항목을 실제 test output과 diff로 확인한다.

```text
[ ] 신규 snapshot은 v3
[ ] v2 fixture digest 불변
[ ] 네 원장 + BaseEntity @Column 캡처 완전성
[ ] 정보화사업 외화 셀은 fcAmt
[ ] 경상사업 외화 셀은 fcAmt
[ ] KRW·총괄·정렬 불변
[ ] 현재 원장 재조회 없는 저장 JSON 렌더
```

- [ ] **Step 4: 버전 조합 갱신**

```powershell
cd C:\it
./scripts/update-versions-lock.ps1
git diff -- versions.lock
```

Expected: 방금 검증한 backend/frontend HEAD 조합만 반영.

- [ ] **Step 5: 완료 문서 이동과 루트 커밋**

PowerShell `Move-Item -LiteralPath`로 승인된 spec과 plan을 각각 `done` 하위로 이동하고 경로를 명시해 stage한다.

```powershell
git commit -m "docs: 전산예산 v3 구현 기록 완료"
```

- [ ] **Step 6: 최종 코드 리뷰**

`superpowers:requesting-code-review`로 백엔드·프론트 diff와 요구사항을 전달한다. Critical/Important 지적을 수정한 뒤 관련 테스트와 전체 게이트를 다시 실행한다.
