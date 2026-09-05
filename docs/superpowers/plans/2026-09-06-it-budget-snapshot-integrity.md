# IT Budget Snapshot Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전산예산 신청서의 본문과 원장 연결 정보를 서버가 생성·검증하고, 미리보기 이후 원장이 바뀐 경우 사용자가 변경 내역을 확인한 뒤 다시 상신하도록 한다.

**Architecture:** `/budget/report`와 `/info/projects/report`는 공통 전산예산 미리보기 API에서 서버 생성 v2 스냅샷과 서명 토큰을 받고, 전용 상신 API는 같은 입력·다이제스트를 검증한 뒤 원장을 고정 순서로 잠가 CAPPLM/CAPPLA/CDECIM을 한 트랜잭션에 저장한다. 기존 v1 JSON은 읽기 호환을 유지하고, v2는 공통 판독기에서 깊은 구조 검증과 `payloadDigest` 검증을 통과해야 PDF·결재 상태 변경에 사용된다.

**Tech Stack:** Java 25, Spring Boot 4, Spring Data JPA/Oracle, Jackson, Jakarta Validation, Micrometer, JUnit 5/Mockito; Nuxt 4, Vue 3, TypeScript, PrimeVue, Vitest, Playwright, OpenAPI TypeScript codegen.

**Spec:** [2026-09-06-it-budget-snapshot-integrity-design.md](../specs/2026-09-06-it-budget-snapshot-integrity-design.md)

## Global Constraints

- 기존 범용 `POST /api/applications`와 v1 저장 문서는 다른 양식을 위해 유지한다. 새 전산예산 화면만 `/api/applications/it-budget/*`를 사용한다.
- 양식 식별자는 기존 레지스트리와 같은 `it-budget`, 버전은 `2`, 정규화 규칙명은 `IT_BUDGET_V2`다.
- 클라이언트는 `apfDtlCone`, 신청자 사번·이름·직급, CAPPLA/CDECIM 원문을 전송하지 않는다. 서버가 인증 주체, 원장, IAM/코드 조회값으로 생성한다.
- 미리보기는 최대 문서 100건, 전체 원장 참조 500건이다. `/budget/report`는 문서 1건, `/info/projects/report`는 선택 사업별 문서 N건이다.
- 금액은 소수 3자리, 환율은 4자리, 수량은 0자리로 정규화하며 반올림하지 않는다. 초과 소수 자릿수는 400으로 거절한다.
- 상신 잠금 순서는 `PROJECT → COST`, 같은 종류에서는 `id → revision` 오름차순이다. 부모 잠금 제한은 5초다.
- 프론트엔드 저장소에는 현재 사용자 작업이 많다. 각 프론트 작업 시작 전 `git status --short`를 확인하고, 이 계획에 적힌 파일의 기존 변경을 보존하며 겹치는 부분만 최소 편집한다.
- 각 커밋은 해당 저장소에서 명시 경로만 스테이징한다. `git add .`와 `git add -A`를 사용하지 않는다.

## File Structure and Responsibilities

### Backend (`C:\it\it_backend`)

- `common/approval/itbudget/controller/ItBudgetApplicationController.java`: 미리보기·상신 HTTP 경계, 인증/MFA, OpenAPI 응답.
- `common/approval/itbudget/dto/ItBudgetApprovalDto.java`: 요청/응답, 소스 참조, 변경행, 오류 상세 계약.
- `common/approval/itbudget/model/ItBudgetSnapshot.java`: v2 영구 JSON 모델. 편집 화면 DTO와 분리한다.
- `common/approval/itbudget/service/ItBudgetCanonicalJson.java`: 결정적 JSON과 SHA-256 다이제스트.
- `common/approval/itbudget/service/ItBudgetPreviewTokenService.java`: HMAC 토큰 발급·검증·키 순환.
- `common/approval/itbudget/service/ItBudgetSourceLoader.java`: 부모/자식 원장 일괄 조회와 상신 시 비관적 잠금.
- `common/approval/itbudget/service/ItBudgetSnapshotBuilder.java`: 원장·IAM·코드값을 불변 스냅샷으로 조립.
- `common/approval/itbudget/service/ItBudgetApprovalFacade.java`: 미리보기와 원자적 상신 유스케이스.
- `common/approval/itbudget/service/ItBudgetSnapshotReader.java`: v1 호환 판독, v2 깊은 검증·다이제스트 검증.
- `common/approval/service/ApplicationPersistenceService.java`: 범용/전산예산이 공유하는 CAPPLM/CAPPLA/CDECIM 저장 원시 연산.
- 기존 원장 repository/service: 동일 부모 잠금 프로토콜과 안정적 정렬을 모든 수정·삭제·이관 경로에 적용.

### Frontend (`C:\it\it_frontend`)

- `app/types/api.d.ts`: 백엔드 OpenAPI로 재생성하며 직접 수정하지 않는다.
- `app/types/approvalForm.ts`: v1 렌더 모델과 v2 영구 스냅샷 타입을 분리한다.
- `app/features/approval/forms/itBudget/schema.ts`: v1/v2 깊은 파싱과 PDF 렌더 모델 어댑터.
- `app/composables/approval/useItBudgetApproval.ts`: 미리보기·상신·만료/변경 오류 상태를 공유한다.
- `app/components/approval/ItBudgetSourceChangedDialog.vue`: 변경 원장 표와 재미리보기 행동.
- 두 report 페이지: 선택 참조와 결재자 역할만 만들고 공통 composable을 호출한다.

---

## Task 1: Freeze the Backend HTTP Contract and Error Shape

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/dto/ItBudgetApprovalDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/exception/ItBudgetApprovalException.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/exception/GlobalExceptionHandler.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/dto/ItBudgetApprovalDtoTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java`

**Interfaces:**
- Consumes: 인증 주체와 클라이언트가 고른 원장 키·revision·순서, 역할이 붙은 결재자 사번.
- Produces: 타입이 고정된 preview/submission 요청·응답과 `code`, `message`, `changedSources` 오류 본문.

- [ ] **Step 1: Write failing validation and serialization tests.**

```java
var request = new PreviewRequest(
        List.of(new ApproverRef(ApproverRole.TEAM_LEAD, "E20001")),
        List.of(new DocumentRequest("doc-1", List.of(
                new SourceRef(SourceKind.PROJECT, "P-001", 1, 1)))));
assertThat(validator.validate(request)).isEmpty();
assertThat(new PreviewRequest(List.of(), List.of())).satisfies(invalid(
        "approvers", "documents"));
assertThat(new PreviewRequest(request.approvers(), nCopies(101, request.documents().getFirst())))
        .satisfies(invalid("documents"));
```

- [ ] **Step 2: Run the focused test and confirm it fails because the DTO does not exist.**

Run: `./gradlew test --tests '*ItBudgetApprovalDtoTest'`

- [ ] **Step 3: Add the explicit request/response records.**

```java
public final class ItBudgetApprovalDto {
    private ItBudgetApprovalDto() {}

    public enum SourceKind { PROJECT, COST }
    public enum ApproverRole { TEAM_LEAD, DEPT_HEAD, ADDITIONAL }

    public record SourceRef(
            @NotNull SourceKind kind,
            @NotBlank @Size(max = 30) String id,
            @NotNull @Positive Integer revision,
            @NotNull @Positive Integer order) {}

    public record ApproverRef(
            @NotNull ApproverRole role,
            @NotBlank @Size(max = 14) String eno) {}

    public record DocumentRequest(
            @NotBlank @Size(max = 64) String clientDocumentKey,
            @NotEmpty @Size(max = 500) List<@Valid SourceRef> sources) {}

    public record PreviewRequest(
            @NotEmpty @Size(max = 102) List<@Valid ApproverRef> approvers,
            @NotEmpty @Size(max = 100) List<@Valid DocumentRequest> documents) {}

    public record SourceDigest(
            @NotNull SourceKind kind,
            @NotBlank @Size(max = 30) String id,
            @Positive int revision,
            @Positive int order,
            @NotBlank @Size(min = 64, max = 64) String digest) {}

    public record PreviewDocument(
            String clientDocumentKey,
            ItBudgetSnapshot snapshot,
            String payloadDigest,
            List<SourceDigest> sources) {}

    public record PreviewResponse(
            String previewDigest,
            String previewToken,
            Instant expiresAt,
            List<PreviewDocument> documents) {}

    public record SubmissionDocument(
            @NotBlank @Size(max = 64) String clientDocumentKey,
            @NotBlank @Size(min = 64, max = 64) String payloadDigest,
            @NotEmpty @Size(max = 500) List<@Valid SourceDigest> sources) {}

    public record SubmissionRequest(
            @NotBlank @Size(min = 64, max = 64) String previewDigest,
            @NotBlank @Size(max = 8192) String previewToken,
            @NotEmpty @Size(max = 102) List<@Valid ApproverRef> approvers,
            @NotEmpty @Size(max = 100) List<@Valid SubmissionDocument> documents) {}

    public record SubmissionResponse(List<String> applicationNumbers) {}

    public record ChangedSource(
            int no,
            SourceKind kind,
            String id,
            int revision,
            String businessName,
            String modifier,
            LocalDateTime modifiedAt) {}
}
```

- [ ] **Step 4: Add one typed business exception and one handler.**

```java
public final class ItBudgetApprovalException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final List<ChangedSource> changedSources;

    public ItBudgetApprovalException(HttpStatus status, String code, String message,
            List<ChangedSource> changedSources) {
        super(message);
        this.status = status;
        this.code = code;
        this.changedSources = List.copyOf(changedSources);
    }
    public HttpStatus status() { return status; }
    public String code() { return code; }
    public List<ChangedSource> changedSources() { return changedSources; }
}
```

```java
@ExceptionHandler(ItBudgetApprovalException.class)
public ResponseEntity<Map<String, Object>> handleItBudgetApproval(ItBudgetApprovalException ex) {
    var body = new LinkedHashMap<String, Object>();
    body.put("timestamp", LocalDateTime.now());
    body.put("status", ex.status().value());
    body.put("code", ex.code());
    body.put("message", ex.getMessage());
    if (!ex.changedSources().isEmpty()) body.put("changedSources", ex.changedSources());
    return ResponseEntity.status(ex.status()).body(body);
}
```

- [ ] **Step 5: Assert OpenAPI exposes `changedSources` and both endpoint schemas, then run tests.**

Run: `./gradlew test --tests '*ItBudgetApprovalDtoTest' --tests '*ApiResponseOpenApiContractTest'`

- [ ] **Step 6: Commit the contract.**

```powershell
git add src/main/java/com/kdb/it/common/approval/itbudget/dto/ItBudgetApprovalDto.java src/main/java/com/kdb/it/common/approval/itbudget/exception/ItBudgetApprovalException.java src/main/java/com/kdb/it/common/exception/GlobalExceptionHandler.java src/test/java/com/kdb/it/common/approval/itbudget/dto/ItBudgetApprovalDtoTest.java src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java
git commit -m "feat: define IT budget approval contract"
```

## Task 2: Define the Immutable v2 Snapshot and Canonical Digests

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/model/ItBudgetSnapshot.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetCanonicalJson.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetCanonicalJsonTest.java`

**Interfaces:**
- Consumes: 서버가 조립한 불변 snapshot record.
- Produces: 필드 순서와 무관한 canonical UTF-8 JSON, `sourceDigest`, `payloadDigest`, `previewDigest`용 64자리 소문자 SHA-256.

- [ ] **Step 1: Write failing tests for object-key ordering, list ordering, decimal scales, and excess precision.**

```java
assertThat(canonical.digest(Map.of("b", 2, "a", 1)))
        .isEqualTo(canonical.digest(new LinkedHashMap<>(Map.of("a", 1, "b", 2))));
assertThat(canonical.write(List.of("A", "B")))
        .isNotEqualTo(canonical.write(List.of("B", "A")));
assertThat(canonical.money(new BigDecimal("1"))).isEqualByComparingTo("1.000");
assertThatThrownBy(() -> canonical.exchangeRate(new BigDecimal("1.23456")))
        .isInstanceOf(IllegalArgumentException.class);
```

- [ ] **Step 2: Run the focused test and observe the missing classes.**

Run: `./gradlew test --tests '*ItBudgetCanonicalJsonTest'`

- [ ] **Step 3: Add the v2 model, keeping code values paired with labels and editor-only fields out.**

```java
public record ItBudgetSnapshot(
        Form form, Payload payload, ApprovalLine approvalLine, Integrity integrity) {
    public record Form(String id, int version) {}
    public record CodeLabel(String code, String label) {}
    public record Organization(String code, String name) {}
    public record Person(String eno, String name, String rank) {}
    public record ApprovalPerson(String eno, String name, String rank, String date) {}
    public record ApprovalLine(
            ApprovalPerson drafter,
            ApprovalPerson teamLead,
            ApprovalPerson deptHead,
            List<ApprovalPerson> additionalApprovers,
            List<String> order) {}
    public record ProjectItem(
            int revision, int sequence, CodeLabel budgetType, String goodsName,
            BigDecimal quantity, String currency, BigDecimal amount,
            String calculationBasis) {}
    public record Project(
            String id, int revision, String ordinaryYn, String name, String baseYear,
            BigDecimal projectBudget, CodeLabel editType, CodeLabel progressStatus,
            String startDate, String endDate, String feasibilityDate,
            String outline, String scope, String security, String purpose,
            String necessity, String expectedEffect, String mainProgress,
            String workforcePlan, Organization supervisingOrganization,
            Organization supervisingDepartment, Person manager, Person teamLeader,
            Organization developmentDepartment, Person developmentManager,
            Person developmentTeamLeader, CodeLabel businessType, CodeLabel businessDetail,
            CodeLabel costType, CodeLabel skillType, CodeLabel executionPattern,
            String deploymentYn, BigDecimal assetBudget, BigDecimal costBudget,
            List<ProjectItem> items) {}
    public record Terminal(
            int revision, int sequence, CodeLabel classification, CodeLabel kind,
            String usage, String specification, String currency,
            BigDecimal exchangeRate, BigDecimal foreignAmount, BigDecimal budgetAmount) {}
    public record Cost(
            String id, int revision, String name, String counterparty,
            CodeLabel business, CodeLabel budgetType, BigDecimal totalAmount,
            String currency, BigDecimal exchangeRate, String exchangeRateBaseDate,
            CodeLabel deferralType, String firstDeferralDate, String reason,
            Organization supervisingDepartment, Person manager,
            String securitySystemUseYn, BigDecimal assetBudget, BigDecimal costBudget,
            List<Terminal> terminals) {}
    public record Summary(
            BigDecimal projectBudget, BigDecimal assetBudget,
            BigDecimal costBudget, BigDecimal totalBudget) {}
    public record Payload(List<Project> projects, List<Cost> costs, Summary summary) {}
    public record Integrity(
            String algorithm, String canonicalization, String payloadDigest,
            Instant capturedAt, List<Source> sources) {}
    public record Source(
            String kind, String id, int revision, int order, String sourceDigest) {}
}
```

- [ ] **Step 4: Implement deterministic JSON and exact scales.**

```java
@Component
public final class ItBudgetCanonicalJson {
    private final ObjectMapper mapper;

    public ItBudgetCanonicalJson(ObjectMapper source) {
        this.mapper = source.copy()
                .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true)
                .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
                .configure(SerializationFeature.WRITE_BIGDECIMAL_AS_PLAIN, true);
    }

    public BigDecimal money(BigDecimal value) { return exact(value, 3, "금액"); }
    public BigDecimal exchangeRate(BigDecimal value) { return exact(value, 4, "환율"); }
    public BigDecimal quantity(BigDecimal value) { return exact(value, 0, "수량"); }
    private BigDecimal exact(BigDecimal value, int scale, String label) {
        if (value == null) return BigDecimal.ZERO.setScale(scale);
        try { return value.setScale(scale, RoundingMode.UNNECESSARY); }
        catch (ArithmeticException ex) { throw new IllegalArgumentException(label + " 소수 자릿수가 올바르지 않습니다.", ex); }
    }
    public String write(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("스냅샷 정규화에 실패했습니다.", ex); }
    }
    public String digest(Object value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(write(value).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", ex);
        }
    }
}
```

- [ ] **Step 5: Run the test, then commit.**

Run: `./gradlew test --tests '*ItBudgetCanonicalJsonTest'`

```powershell
git add src/main/java/com/kdb/it/common/approval/itbudget/model/ItBudgetSnapshot.java src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetCanonicalJson.java src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetCanonicalJsonTest.java
git commit -m "feat: add canonical IT budget snapshot"
```

## Task 3: Sign and Validate 30-minute Preview Tokens

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/config/ItBudgetPreviewProperties.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetPreviewTokenService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/EnvironmentValidator.java`
- Modify: `it_backend/src/main/resources/application.properties`
- Modify: `it_backend/src/main/resources/application-prod.properties`
- Modify: `it_backend/src/test/resources/application-test.properties`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetPreviewTokenServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java`

**Interfaces:**
- Consumes: requester ENO, normalized request digest, source set digest, payload set digest, preview digest.
- Produces: `kid.base64url(claims).base64url(HMAC-SHA-256)` and verified claims; active/previous key rotation.

- [ ] **Step 1: Write failing tests for valid, altered, expired, wrong-requester, and previous-key tokens.**

```java
var claims = new Claims("E10001", hex('a'), hex('b'), hex('c'), hex('d'), now, now.plusSeconds(1800));
var token = service.issue(claims);
assertThat(service.verify(token, "E10001")).isEqualTo(claims);
assertThatThrownBy(() -> service.verify(token + "x", "E10001")).isInstanceOf(ItBudgetApprovalException.class);
clock.advance(Duration.ofMinutes(31));
assertThatThrownBy(() -> service.verify(token, "E10001"))
        .extracting("code").isEqualTo("IT_BUDGET_PREVIEW_EXPIRED");
```

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `./gradlew test --tests '*ItBudgetPreviewTokenServiceTest' --tests '*EnvironmentValidatorTest'`

- [ ] **Step 3: Add typed properties and exact claims.**

```java
@ConfigurationProperties("app.approval.it-budget.preview")
public record ItBudgetPreviewProperties(
        String activeKeyId,
        String activeSigningKey,
        String previousKeyId,
        String previousSigningKey,
        Duration ttl) {}
```

```java
public record Claims(
        String requesterEno,
        String requestDigest,
        String sourceSetDigest,
        String payloadSetDigest,
        String previewDigest,
        Instant issuedAt,
        Instant expiresAt) {}
```

- [ ] **Step 4: Implement constant-time verification and bind every submitted digest set.**

```java
private byte[] sign(String key, String signingInput) {
    try {
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return mac.doFinal(signingInput.getBytes(StandardCharsets.US_ASCII));
    } catch (GeneralSecurityException ex) {
        throw new IllegalStateException("미리보기 서명 생성에 실패했습니다.", ex);
    }
}

private void verifySignature(byte[] expected, byte[] actual) {
    if (!MessageDigest.isEqual(expected, actual)) {
        throw invalid("IT_BUDGET_PREVIEW_INVALID", "미리보기 정보가 올바르지 않습니다.");
    }
}
```

- [ ] **Step 5: Configure production fail-fast and test-only fixed keys.**

```properties
app.approval.it-budget.preview.active-key-id=${IT_BUDGET_PREVIEW_ACTIVE_KEY_ID:local-v1}
app.approval.it-budget.preview.active-signing-key=${IT_BUDGET_PREVIEW_SIGNING_KEY:local-it-budget-preview-signing-key-at-least-32-bytes}
app.approval.it-budget.preview.previous-key-id=${IT_BUDGET_PREVIEW_PREVIOUS_KEY_ID:}
app.approval.it-budget.preview.previous-signing-key=${IT_BUDGET_PREVIEW_PREVIOUS_SIGNING_KEY:}
app.approval.it-budget.preview.ttl=PT30M
```

In `application-prod.properties`, redeclare `active-key-id` and `active-signing-key` without defaults. Extend `EnvironmentValidator` to require both and at least 32 UTF-8 bytes for the signing key; require previous ID/key as a pair.

- [ ] **Step 6: Run tests and commit.**

Run: `./gradlew test --tests '*ItBudgetPreviewTokenServiceTest' --tests '*EnvironmentValidatorTest' --tests '*EnvironmentValidatorStartupTest'`

```powershell
git add src/main/java/com/kdb/it/common/approval/itbudget/config/ItBudgetPreviewProperties.java src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetPreviewTokenService.java src/main/java/com/kdb/it/common/system/EnvironmentValidator.java src/main/resources/application.properties src/main/resources/application-prod.properties src/test/resources/application-test.properties src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetPreviewTokenServiceTest.java src/test/java/com/kdb/it/common/system/EnvironmentValidatorTest.java
git commit -m "feat: sign IT budget preview tokens"
```

## Task 4: Load Source Aggregates and Build Server-owned Snapshots

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectItemRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSourceLoader.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotBuilder.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSourceLoaderTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotBuilderTest.java`

**Interfaces:**
- Consumes: 정규화·중복검사를 마친 `SourceRef` 목록.
- Produces: 정확한 `(id, revision)` 부모와 자식 행, 원시 업무 필드용 source digest, 표시용 payload snapshot, 부모 단위 감사정보.

- [ ] **Step 1: Write failing tests for exact pair filtering, child aggregation, ordering, deleted rows, and the 500-ref cap.**

```java
assertThat(loader.load(List.of(project("P2", 2, 2), project("P1", 1, 1))))
        .extracting(SourceAggregate::key)
        .containsExactly(new SourceKey(PROJECT, "P1", 1), new SourceKey(PROJECT, "P2", 2));
assertThat(loader.load(List.of(project("P1", 2, 1))))
        .allSatisfy(a -> assertThat(a.children()).extracting("parentRevision").containsOnly(2));
```

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `./gradlew test --tests '*ItBudgetSourceLoaderTest' --tests '*ItBudgetSnapshotBuilderTest'`

- [ ] **Step 3: Add stable batch reads and batch locks.**

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "5000"))
@Query("""
    select p from Bprojm p
    where p.id.abusMngNo in :ids and p.id.sno in :revisions
    order by p.id.abusMngNo, p.id.sno
    """)
List<Bprojm> findVersionsForUpdate(Collection<String> ids, Collection<Integer> revisions);
```

Add the same ordered method for `Bcostm`. Add unordered no-delete-filter batch reads for `Bitemm` and `Btermm`; filter exact parent pairs in Java after the one bulk query. Do not add one query per source.

- [ ] **Step 4: Define a source aggregate that separates digest data from display data.**

```java
record SourceKey(SourceKind kind, String id, int revision) {}
record Audit(String modifierUserId, LocalDateTime modifiedAt) {}
record SourceAggregate(
        SourceRef ref,
        Object parent,
        List<?> children,
        Audit latestAudit) {}
```

`latestAudit` is the maximum of parent and child `lstChgDtm`; a child wins ties by sequence. Source digest input includes stored business columns, IDs, child order, and `delYn`, but excludes `lstChgUsid`, `lstChgDtm`, fetched names, fetched labels, and approval data.

- [ ] **Step 5: Build v2 payloads and summaries without reusing editor DTOs.**

```java
var payload = new Payload(
        aggregates.stream().filter(a -> a.ref().kind() == PROJECT).map(this::project).toList(),
        aggregates.stream().filter(a -> a.ref().kind() == COST).map(this::cost).toList(),
        summary(aggregates));
var payloadDigest = canonical.digest(payload);
var sources = aggregates.stream().map(a -> new Source(
        a.ref().kind().name(), a.ref().id(), a.ref().revision(), a.ref().order(),
        canonical.digest(sourceDigestInput(a)))).toList();
return new BuiltDocument(payload, payloadDigest, sources);
```

Resolve IAM and code labels in bulk across all documents. Missing optional label becomes an empty label; missing parent, revision mismatch, deleted target, duplicate source, missing required user, and illegal cross-document reuse return `IT_BUDGET_PREVIEW_INVALID`.

- [ ] **Step 6: Run tests and commit.**

Run: `./gradlew test --tests '*ItBudgetSourceLoaderTest' --tests '*ItBudgetSnapshotBuilderTest'`

```powershell
git add src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java src/main/java/com/kdb/it/domain/budget/project/repository/ProjectItemRepository.java src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSourceLoader.java src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotBuilder.java src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSourceLoaderTest.java src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotBuilderTest.java
git commit -m "feat: build IT budget snapshots from ledgers"
```

## Task 5: Expose the Preview Endpoint

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/controller/ItBudgetApplicationController.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacadeTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/controller/ItBudgetApplicationControllerTest.java`

**Interfaces:**
- Consumes: `POST /api/applications/it-budget/previews`, authenticated requester, `PreviewRequest`.
- Produces: ordered v2 documents, source/payload/preview digests, opaque token, `expiresAt`; no database writes and no MFA.

- [ ] **Step 1: Write controller and facade tests.**

```java
mockMvc.perform(post("/api/applications/it-budget/previews")
        .with(user("E10001"))
        .contentType(APPLICATION_JSON)
        .content(json(request)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.documents[0].snapshot.form.id").value("it-budget"))
        .andExpect(jsonPath("$.documents[0].snapshot.form.version").value(2))
        .andExpect(jsonPath("$.previewToken").isNotEmpty());
```

- [ ] **Step 2: Run focused tests and observe 404.**

Run: `./gradlew test --tests '*ItBudgetApplicationControllerTest' --tests '*ItBudgetApprovalFacadeTest'`

- [ ] **Step 3: Implement request normalization and preview claim creation.**

```java
@Transactional(readOnly = true)
public PreviewResponse preview(String requesterEno, PreviewRequest request) {
    var normalized = normalizer.normalize(request);
    var approvalLine = snapshotBuilder.approvalLine(requesterEno, normalized.approvers());
    var built = snapshotBuilder.build(sourceLoader.load(normalized.sources()), approvalLine);
    var requestDigest = canonical.digest(normalized);
    var sourceSetDigest = canonical.digest(built.stream().map(BuiltDocument::sources).toList());
    var payloadSetDigest = canonical.digest(built.stream().map(BuiltDocument::payloadDigest).toList());
    var previewDigest = canonical.digest(new PreviewClaim(
            requesterEno, normalized, approvalLine, sourceSetDigest, payloadSetDigest));
    var issuedAt = clock.instant();
    var expiresAt = issuedAt.plus(properties.ttl());
    var token = tokens.issue(new Claims(requesterEno, requestDigest, sourceSetDigest,
            payloadSetDigest, previewDigest, issuedAt, expiresAt));
    return response(previewDigest, token, expiresAt, approvalLine, built);
}
```

- [ ] **Step 4: Add the controller with security boundary.**

```java
@RestController
@RequestMapping("/api/applications/it-budget")
@RequiredArgsConstructor
public class ItBudgetApplicationController {
    private final ItBudgetApprovalFacade facade;

    @PostMapping("/previews")
    public PreviewResponse preview(@AuthenticationPrincipal CustomUserDetails user,
            @Valid @RequestBody PreviewRequest request) {
        return facade.preview(user.getEno(), request);
    }
}
```

- [ ] **Step 5: Run tests and commit.**

Run: `./gradlew test --tests '*ItBudgetApplicationControllerTest' --tests '*ItBudgetApprovalFacadeTest'`

```powershell
git add src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java src/main/java/com/kdb/it/common/approval/itbudget/controller/ItBudgetApplicationController.java src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacadeTest.java src/test/java/com/kdb/it/common/approval/itbudget/controller/ItBudgetApplicationControllerTest.java
git commit -m "feat: add IT budget preview endpoint"
```

## Task 6: Apply One Parent-lock Protocol to Every Ledger Write

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/terminal/TerminalBulkImportService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/migration/terminal/TerminalBulkImportCostServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetLedgerLockingIT.java`

**Interfaces:**
- Consumes: 사업/비용의 수정·삭제·자식 변경·단말 이관 명령.
- Produces: 모든 경로가 기존 상태검사와 자식 쓰기 전에 정확한 부모 revision을 `PESSIMISTIC_WRITE`로 잠그는 동일 규칙.

- [ ] **Step 1: Add failing service tests that verify lock-before-guard and no ordinary parent read.**

```java
var inOrder = inOrder(projectRepository, approvalWriteGuard, projectItemRepository);
service.updateProject("P-001", 3, request);
inOrder.verify(projectRepository).findVersionForUpdate("P-001", 3);
inOrder.verify(approvalWriteGuard).assertWritable("BPROJM", "P-001", 3);
inOrder.verify(projectItemRepository).deleteAllByParent("P-001", 3);
verify(projectRepository, never()).findById(any());
```

- [ ] **Step 2: Run focused unit tests and confirm ordering assertions fail.**

Run: `./gradlew test --tests '*ProjectServiceTest' --tests '*CostServiceTest' --tests '*TerminalBulkImportCostServiceTest'`

- [ ] **Step 3: Replace ordinary reads in update/delete/migration paths with exact locks.**

```java
var project = projectRepository.findVersionForUpdate(abusMngNo, sno)
        .orElseThrow(() -> new EntityNotFoundException("정보화사업을 찾을 수 없습니다."));
approvalWriteGuard.assertWritable("BPROJM", abusMngNo, sno);
```

Apply the same ordering to cost update/delete and terminal import create/update. Creation that has no parent row yet locks the logical current parent/version lookup before assigning the next revision; retain the existing sequence/unique-key protection.

- [ ] **Step 4: Add an Oracle-tagged concurrency test.**

Thread A locks `(PROJECT, P-001, 3)` for submission. Thread B tries to update a child item and must block until A commits; after A saves CAPPLA, B must fail the existing approval write guard. Reverse the roles once to prove a completed edit is visible to submission. Assert no partial CAPPLM/CAPPLA/CDECIM rows.

- [ ] **Step 5: Run unit tests; run integration test when Oracle test profile is available.**

Run: `./gradlew test --tests '*ProjectServiceTest' --tests '*CostServiceTest' --tests '*TerminalBulkImportCostServiceTest'`

Run: `./gradlew integrationTest --tests '*ItBudgetLedgerLockingIT'`

- [ ] **Step 6: Commit lock protocol changes.**

```powershell
git add src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java src/main/java/com/kdb/it/domain/migration/terminal/TerminalBulkImportService.java src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java src/test/java/com/kdb/it/domain/migration/terminal/TerminalBulkImportCostServiceTest.java src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetLedgerLockingIT.java
git commit -m "fix: serialize IT budget ledger writes"
```

## Task 7: Persist All Previewed Documents Atomically

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationPersistenceService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/controller/ItBudgetApplicationController.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSubmissionTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/controller/ItBudgetApplicationControllerTest.java`

**Interfaces:**
- Consumes: `POST /api/applications/it-budget/submissions`, signed preview token and its bound document/source digests.
- Produces: N application numbers in request order; all CAPPLM/CAPPLA/CDECIM rows commit or all roll back.

- [ ] **Step 1: Write failing tests for success, tampering, source change, stale display, expiry, lock timeout, and second-document rollback.**

```java
assertThatThrownBy(() -> facade.submit("E10001", changedSourceRequest))
        .isInstanceOfSatisfying(ItBudgetApprovalException.class, ex -> {
            assertThat(ex.code()).isEqualTo("IT_BUDGET_SOURCE_CHANGED");
            assertThat(ex.changedSources()).extracting(ChangedSource::businessName)
                    .containsExactly("차세대 정보계 구축");
        });
verify(applicationPersistenceService, never()).persist(any());
```

- [ ] **Step 2: Run focused tests and confirm missing submission behavior.**

Run: `./gradlew test --tests '*ItBudgetSubmissionTest' --tests '*ApplicationServiceTest' --tests '*ItBudgetApplicationControllerTest'`

- [ ] **Step 3: Extract the existing CAPPLM/CAPPLA/CDECIM write into one reusable primitive.**

```java
public record ApplicationDraft(
        String applicationName,
        String detailJson,
        String requesterEno,
        String requesterOpinion,
        List<SourceLink> sources,
        List<String> approverEnos) {}

public ApplicationResponse persist(ApplicationDraft draft) {
    var application = capplm(draft, applicationRepository.getNextVal());
    applicationRepository.save(application);
    applicationMapRepository.saveAll(cappla(application, draft.sources()));
    approvalRepository.saveAll(cdecim(application, draft.approverEnos()));
    return response(application);
}
```

Keep `ApplicationService.submit(CreateRequest)` behavior unchanged by adapting the old request to `ApplicationDraft` and calling this service.

- [ ] **Step 4: Implement locked comparison and atomic N-document persistence.**

```java
@Transactional
public SubmissionResponse submit(String requesterEno, SubmissionRequest request) {
    var claims = tokens.verify(request.previewToken(), requesterEno);
    submissionVerifier.verifyBoundRequest(claims, request);
    var refs = normalizer.refs(request.documents());
    var locked = sourceLoader.lockAndLoad(refs);
    var current = snapshotBuilder.build(locked,
            snapshotBuilder.approvalLine(requesterEno, request.approvers()));
    var changed = submissionVerifier.changedSources(request.documents(), current);
    if (!changed.isEmpty()) throw sourceChanged(changed);
    submissionVerifier.verifyCurrentPreview(claims, request, current);
    var numbers = current.stream().map(document -> applicationPersistence.persist(
            draft(requesterEno, request.approvers(), document))).map(ApplicationResponse::apfMngNo).toList();
    return new SubmissionResponse(numbers);
}
```

Map lock timeout to `IT_BUDGET_CONCURRENT_UPDATE`; mismatched target/order/approval line/display digest to `IT_BUDGET_PREVIEW_STALE`; altered token/body binding to `IT_BUDGET_PREVIEW_INVALID`. Build changed rows in document/source order, numbering from 1. For BITEMM/BTERMM-only changes, show the parent project/contract once using the latest modifier/time.

- [ ] **Step 5: Add the MFA-protected endpoint.**

```java
@PostMapping("/submissions")
@MfaRequired(purpose = MfaPurpose.APPROVAL)
public SubmissionResponse submit(@AuthenticationPrincipal CustomUserDetails user,
        @Valid @RequestBody SubmissionRequest request) {
    return facade.submit(user.getEno(), request);
}
```

- [ ] **Step 6: Run tests and commit.**

Run: `./gradlew test --tests '*ItBudgetSubmissionTest' --tests '*ApplicationServiceTest' --tests '*ItBudgetApplicationControllerTest' --tests '*MfaGuardAspectTest'`

```powershell
git add src/main/java/com/kdb/it/common/approval/service/ApplicationPersistenceService.java src/main/java/com/kdb/it/common/approval/service/ApplicationService.java src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java src/main/java/com/kdb/it/common/approval/itbudget/controller/ItBudgetApplicationController.java src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSubmissionTest.java src/test/java/com/kdb/it/common/approval/itbudget/controller/ItBudgetApplicationControllerTest.java
git commit -m "feat: submit IT budget approvals atomically"
```

## Task 8: Verify Stored v2 Snapshots Everywhere They Are Consumed

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotReader.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApprovalLineDelegate.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshot.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/mail/ApprovalMailRenderer.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/mail/ApprovalMailPayloadProvider.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApprovalLineDelegateTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshotTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/mail/ApprovalMailRendererTest.java`

**Interfaces:**
- Consumes: CAPPLM `apfDtlCone` v1 legacy or v2 snapshot.
- Produces: validated mutable approval-line tree for state changes and normalized mail summary; corrupted v2 is fail-closed for PDF/state changes, mail alone degrades to summary omission.

- [ ] **Step 1: Write failing tests for v1 compatibility and v2 corruption.**

```java
assertThat(reader.read(validV1Json()).version()).isEqualTo(1);
assertThat(reader.read(validV2Json()).version()).isEqualTo(2);
assertThatThrownBy(() -> reader.read(v2WithAlteredPayload()))
        .isInstanceOf(DataCorruptionException.class)
        .hasMessageContaining("payloadDigest");
assertThatThrownBy(() -> delegate.updateApprovalLine(v2WithAlteredPayload(), command))
        .isInstanceOf(DataCorruptionException.class);
```

- [ ] **Step 2: Run focused tests and confirm current shallow parsing does not fail closed.**

Run: `./gradlew test --tests '*ApprovalLineDelegateTest' --tests '*ApprovalMailSnapshotTest' --tests '*ApprovalMailRendererTest'`

- [ ] **Step 3: Implement one shared reader.**

```java
public ParsedSnapshot read(String raw) {
    try {
        var root = mapper.readTree(raw);
        var version = root.path("form").path("version").asInt(1);
        if (version == 1) return legacyAdapter.read(root);
        if (version != 2 || !"it-budget".equals(root.path("form").path("id").asText()))
            throw corrupt("지원하지 않는 전산예산 스냅샷입니다.");
        var snapshot = mapper.treeToValue(root, ItBudgetSnapshot.class);
        validator.validateDeep(snapshot);
        var actual = canonical.digest(snapshot.payload());
        if (!MessageDigest.isEqual(actual.getBytes(UTF_8),
                snapshot.integrity().payloadDigest().getBytes(UTF_8)))
            throw corrupt("전산예산 스냅샷 payloadDigest가 일치하지 않습니다.");
        return ParsedSnapshot.v2(snapshot);
    } catch (JsonProcessingException ex) {
        throw new DataCorruptionException("신청서 상세 JSON이 손상되었습니다.", ex);
    }
}
```

- [ ] **Step 4: Route approval-line mutation and mail parsing through the reader.**

Approval-line mutations must reject missing/malformed lines for in-progress v1 and every invalid v2. Mail catches `DataCorruptionException` at `ApprovalMailPayloadProvider`, records a warning and `approval.snapshot.mail.degraded` counter tagged `version`, and returns mail without a business summary.

```java
try { return Optional.of(renderer.render(reader.read(raw))); }
catch (DataCorruptionException ex) {
    meterRegistry.counter("approval.snapshot.mail.degraded", "version", versionOf(raw)).increment();
    log.warn("신청서 스냅샷 요약을 생략합니다. apfMngNo={}", apfMngNo, ex);
    return Optional.empty();
}
```

- [ ] **Step 5: Run tests and commit.**

Run: `./gradlew test --tests '*ApprovalLineDelegateTest' --tests '*ApprovalMailSnapshotTest' --tests '*ApprovalMailRendererTest' --tests '*ApprovalMailPayloadProviderTest'`

```powershell
git add src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSnapshotReader.java src/main/java/com/kdb/it/common/approval/service/ApprovalLineDelegate.java src/main/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshot.java src/main/java/com/kdb/it/common/approval/mail/ApprovalMailRenderer.java src/main/java/com/kdb/it/common/approval/mail/ApprovalMailPayloadProvider.java src/test/java/com/kdb/it/common/approval/service/ApprovalLineDelegateTest.java src/test/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshotTest.java src/test/java/com/kdb/it/common/approval/mail/ApprovalMailRendererTest.java
git commit -m "fix: verify stored IT budget snapshots"
```

## Task 9: Finish Backend Metrics, OpenAPI, and Full Verification

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java`
- Modify: `it_backend/src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSubmissionTest.java`
- Modify: `it_backend/README.md`

**Interfaces:**
- Consumes: preview/submission results and error codes.
- Produces: low-cardinality counters/timers and checked-in operational configuration documentation.

- [ ] **Step 1: Add failing meter assertions.**

```java
assertThat(registry.get("approval.it_budget.preview").timer().count()).isEqualTo(1);
assertThat(registry.get("approval.it_budget.submission")
        .tag("outcome", "source_changed").counter().count()).isEqualTo(1);
```

- [ ] **Step 2: Add timers and outcome counters without source IDs as tags.**

```java
Timer.Sample sample = Timer.start(meterRegistry);
try { return doSubmit(requesterEno, request); }
catch (ItBudgetApprovalException ex) {
    meterRegistry.counter("approval.it_budget.submission", "outcome", outcome(ex.code())).increment();
    throw ex;
} finally {
    sample.stop(meterRegistry.timer("approval.it_budget.submission.duration"));
}
```

- [ ] **Step 3: Document the active/previous preview keys and rotation order in README.**

Document: deploy new key as active and old key as previous; wait longer than 30 minutes; remove previous key. State that production startup fails if the active key ID/key is absent or the key is shorter than 32 UTF-8 bytes.

- [ ] **Step 4: Run backend gates.**

Run: `./gradlew spotlessCheck test`

Run when Oracle is available: `./gradlew integrationTest --tests '*ItBudgetLedgerLockingIT'`

- [ ] **Step 5: Inspect staged paths and commit.**

```powershell
git add src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java src/test/java/com/kdb/it/common/approval/itbudget/service/ItBudgetSubmissionTest.java README.md
git diff --cached --stat
git commit -m "test: verify IT budget snapshot submission"
```

## Task 10: Regenerate the Frontend API and Add a v1/v2 Parser

**Files:**
- Modify (generated): `it_frontend/app/types/api.d.ts`
- Modify: `it_frontend/app/types/approvalForm.ts`
- Modify: `it_frontend/app/features/approval/forms/itBudget/definition.ts`
- Modify: `it_frontend/app/features/approval/forms/itBudget/schema.ts`
- Modify: `it_frontend/app/composables/useApprovalFormRenderer.ts`
- Modify: `it_frontend/tests/unit/utils/approvalFormRegistry.test.ts`
- Modify: `it_frontend/tests/unit/composables/useApprovalFormRenderer.test.ts`

**Interfaces:**
- Consumes: generated `ItBudgetApproval*` schemas and stored v1/v2 JSON.
- Produces: one stable `ItBudgetApprovalRenderDetail` for the existing PDF renderer; v2 structural errors are visible failures.

- [ ] **Step 1: Confirm the backend OpenAPI endpoint is running, then regenerate types.**

Run: `npm run codegen`

Run: `npm run codegen:check`

- [ ] **Step 2: Write failing parser tests for legacy v1, valid v2, missing nested fields, and future version.**

```ts
expect(parseApprovalFormDetail(validV1, '전산예산 작성').form.version).toBe(1);
expect(parseApprovalFormDetail(validV2).form).toEqual({ id: 'it-budget', version: 2 });
expect(() => parseApprovalFormDetail(v2WithoutIntegrity)).toThrow(
    '전산예산 신청서 무결성 정보가 없습니다.',
);
```

- [ ] **Step 3: Separate stored v2 types from the renderer shape.**

```ts
export type ItBudgetPreviewResponse = components['schemas']['ItBudgetApprovalPreviewResponse'];
export type ItBudgetSubmissionRequest = components['schemas']['ItBudgetApprovalSubmissionRequest'];

export interface ItBudgetApprovalFormDetailV2 extends ApprovalFormDetailBase {
    form: { id: 'it-budget'; version: 2 };
    payload: ItBudgetPayloadSnapshot;
    integrity: ItBudgetIntegritySnapshot;
}

export interface ItBudgetApprovalRenderDetail extends ApprovalFormDetailBase {
    projects: ProjectDetail[];
    costs: ItCost[];
}
```

- [ ] **Step 4: Deep-parse v2 and adapt named value objects to existing PDF field names.**

```ts
const toCodeFields = (value: CodeLabel | undefined, codeKey: string, nameKey: string) => ({
    [codeKey]: value?.code ?? '',
    [nameKey]: value?.label ?? '',
});

export const parseItBudgetApprovalFormDetail = (
    parsed: Record<string, unknown>,
    approvalLine: ApprovalLine,
): ItBudgetApprovalRenderDetail => {
    const version = readFormVersion(parsed);
    if (version === 1) return parseLegacyV1(parsed, approvalLine);
    const snapshot = parseV2Snapshot(parsed);
    return {
        form: snapshot.form,
        approvalLine: snapshot.approvalLine,
        projects: snapshot.payload.projects.map(toProjectDetail),
        costs: snapshot.payload.costs.map(toCostDetail),
    };
};
```

Set `itBudgetApprovalFormDefinition.version` to `2`. Keep the registry ID `it-budget`; keep v1 acceptance. The browser does not recompute the cryptographic digest because the backend reader is authoritative, but it must reject missing `payload`, `integrity`, nested source keys, or approval line.

- [ ] **Step 5: Run focused tests and commit.**

Run: `npm test -- --run tests/unit/utils/approvalFormRegistry.test.ts tests/unit/composables/useApprovalFormRenderer.test.ts`

```powershell
git add app/types/api.d.ts app/types/approvalForm.ts app/features/approval/forms/itBudget/definition.ts app/features/approval/forms/itBudget/schema.ts app/composables/useApprovalFormRenderer.ts tests/unit/utils/approvalFormRegistry.test.ts tests/unit/composables/useApprovalFormRenderer.test.ts
git diff --cached --stat
git commit -m "feat: read IT budget snapshot v2"
```

## Task 11: Add the Shared Preview/Submit Composable and Conflict Dialog

**Files:**
- Create: `it_frontend/app/composables/approval/useItBudgetApproval.ts`
- Create: `it_frontend/app/components/approval/ItBudgetSourceChangedDialog.vue`
- Modify: `it_frontend/app/i18n/locales/ko/approval.ts`
- Modify: `it_frontend/app/i18n/locales/en/approval.ts`
- Create: `it_frontend/tests/unit/composables/useItBudgetApproval.test.ts`
- Create: `it_frontend/tests/unit/components/approval/ItBudgetSourceChangedDialog.test.ts`
- Modify: `it_frontend/tests/unit/composables/approval-mfa-coverage.test.ts`

**Interfaces:**
- Consumes: document source refs and `{role, eno}` approvers.
- Produces: preview documents, expiry/stale state, MFA-protected atomic submit, typed source-change rows, refresh action.

- [ ] **Step 1: Write failing composable tests.**

```ts
await approval.preview(request);
expect(mockApiFetch).toHaveBeenCalledWith(
    'http://localhost:28080/api/applications/it-budget/previews',
    { method: 'POST', body: request },
);
await approval.submit();
expect(runWithApprovalMfa).toHaveBeenCalledTimes(1);
expect(approval.changedSources.value).toEqual(sourceChangedError.data.changedSources);
expect(approval.previewState.value).toBe('stale');
```

- [ ] **Step 2: Run focused tests and confirm missing composable/component.**

Run: `npm test -- --run tests/unit/composables/useItBudgetApproval.test.ts tests/unit/components/approval/ItBudgetSourceChangedDialog.test.ts`

- [ ] **Step 3: Implement one request state machine and error decoder.**

```ts
type PreviewState = 'empty' | 'loading' | 'ready' | 'expired' | 'stale';

const apiErrorBody = (error: unknown): ItBudgetErrorBody | undefined => {
    const candidate = error as {
        data?: ItBudgetErrorBody;
        response?: { _data?: ItBudgetErrorBody };
    };
    return candidate.data ?? candidate.response?._data;
};

const submit = async () => {
    const current = requireReadyPreview();
    try {
        return await runWithApprovalMfa(() => $apiFetch<SubmissionResponse>(submissionUrl, {
            method: 'POST',
            body: toSubmissionRequest(current),
        }));
    } catch (error) {
        const body = apiErrorBody(error);
        if (body?.code === 'IT_BUDGET_SOURCE_CHANGED') {
            changedSources.value = body.changedSources ?? [];
            previewState.value = 'stale';
        } else if (body?.code === 'IT_BUDGET_PREVIEW_EXPIRED') {
            previewState.value = 'expired';
        } else if (body?.code === 'IT_BUDGET_PREVIEW_STALE') {
            previewState.value = 'stale';
        }
        throw error;
    }
};
```

Any selected source/order/approver change calls `invalidatePreview()` before another submit. A local `expiresAt` timer disables submit but the server remains authoritative.

- [ ] **Step 4: Implement the exact conflict dialog copy and columns.**

```vue
<Message severity="warn" :closable="false">
    {{ t('approval.itBudget.sourceChanged.message') }}
</Message>
<StyledDataTable :value="changedSources" data-key="no">
    <Column field="no" :header="t('approval.itBudget.sourceChanged.no')" />
    <Column field="businessName" :header="t('approval.itBudget.sourceChanged.businessName')" />
    <Column field="modifier" :header="t('approval.itBudget.sourceChanged.modifier')" />
    <Column field="modifiedAt" :header="t('approval.itBudget.sourceChanged.modifiedAt')" />
</StyledDataTable>
```

Korean message: `신청 대상이 중간에 변경되었습니다. 변경 내역을 확인한 후 다시 결재를 상신해 주시기 바랍니다.` Columns: `NO | 사업명/계약명 | 수정자 | 수정일시`. The primary dialog action emits `refresh` and is labeled `변경 내용 다시 불러오기`.

- [ ] **Step 5: Add MFA coverage for submission only.**

Preview must assert zero MFA calls; submit must assert exactly one MFA call.

- [ ] **Step 6: Run tests and commit.**

Run: `npm test -- --run tests/unit/composables/useItBudgetApproval.test.ts tests/unit/components/approval/ItBudgetSourceChangedDialog.test.ts tests/unit/composables/approval-mfa-coverage.test.ts`

```powershell
git add app/composables/approval/useItBudgetApproval.ts app/components/approval/ItBudgetSourceChangedDialog.vue app/i18n/locales/ko/approval.ts app/i18n/locales/en/approval.ts tests/unit/composables/useItBudgetApproval.test.ts tests/unit/components/approval/ItBudgetSourceChangedDialog.test.ts tests/unit/composables/approval-mfa-coverage.test.ts
git diff --cached --stat
git commit -m "feat: add IT budget preview submission flow"
```

## Task 12: Switch `/budget/report` to One Server-owned Document

**Files:**
- Modify: `it_frontend/app/pages/budget/report.vue`
- Create: `it_frontend/tests/unit/pages/budgetReportSubmission.test.ts`
- Modify: `it_frontend/tests/e2e/budget-report-session.spec.ts`

**Interfaces:**
- Consumes: selected projects/costs and current approval-line IDs.
- Produces: one preview request/document and one atomic submission; PDF renders the returned snapshot only.

- [ ] **Step 1: Add failing page tests that prohibit client-owned JSON.**

```ts
expect(source).not.toContain('serializeApprovalFormDetail(');
expect(source).not.toContain('createApplication(');
expect(previewMock).toHaveBeenCalledWith({
    approvers: roleApprovers,
    documents: [{ clientDocumentKey: 'budget-report', sources: expectedSources }],
});
```

- [ ] **Step 2: Run the focused page test and confirm current generic submission fails it.**

Run: `npm test -- --run tests/unit/pages/budgetReportSubmission.test.ts`

- [ ] **Step 3: Replace client snapshot construction with source-ref construction.**

```ts
const documents = computed(() => [{
    clientDocumentKey: 'budget-report',
    sources: [
        ...selectedProjects.value.map((p, index) => ({
            kind: 'PROJECT' as const, id: p.abusMngNo, revision: p.sno, order: index + 1,
        })),
        ...selectedCosts.value.map((c, index) => ({
            kind: 'COST' as const, id: c.costBgNo, revision: c.bgSno,
            order: selectedProjects.value.length + index + 1,
        })),
    ],
}]);
```

Map `teamLead`, `deptHead`, then `additionalApprovers` to explicit roles. On selection or approval-line change call `invalidatePreview()`. `generatePdf` calls preview first and renders `documents[0].snapshot`; submit uses the same ready preview and never serializes local `projects`/`costs`.

- [ ] **Step 4: Mount the conflict dialog and refresh from authoritative source selection.**

```vue
<ItBudgetSourceChangedDialog
    v-model:visible="showSourceChanged"
    :changed-sources="changedSources"
    @refresh="refreshPreview"
/>
```

- [ ] **Step 5: Run unit and browser contract tests, then commit.**

Run: `npm test -- --run tests/unit/pages/budgetReportSubmission.test.ts`

Run: `npm run test:e2e -- tests/e2e/budget-report-session.spec.ts`

```powershell
git add app/pages/budget/report.vue tests/unit/pages/budgetReportSubmission.test.ts tests/e2e/budget-report-session.spec.ts
git diff --cached --stat
git commit -m "feat: submit budget report from server preview"
```

## Task 13: Switch `/info/projects/report` to Atomic Multi-document Submission

**Files:**
- Modify: `it_frontend/app/pages/info/projects/report.vue`
- Modify: `it_frontend/tests/unit/pages/infoProjectsReport.test.ts`
- Modify: `it_frontend/tests/e2e/report-pdf-latest.spec.ts`

**Interfaces:**
- Consumes: selected projects in UI order and one approval line.
- Produces: N preview documents and one submission request returning N application numbers; no `Promise.all(createApplication)` partial success.

- [ ] **Step 1: Add failing tests for N documents, one submit call, and no generic API.**

```ts
expect(previewMock).toHaveBeenCalledWith(expect.objectContaining({
    documents: [
        { clientDocumentKey: 'project:P-001:3', sources: [projectSource('P-001', 3, 1)] },
        { clientDocumentKey: 'project:P-002:4', sources: [projectSource('P-002', 4, 1)] },
    ],
}));
expect(submitMock).toHaveBeenCalledTimes(1);
expect(createApplicationMock).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run the focused test and confirm it exposes the current `Promise.all` behavior.**

Run: `npm test -- --run tests/unit/pages/infoProjectsReport.test.ts`

- [ ] **Step 3: Build one document per project and render the matching returned snapshot.**

```ts
const documents = computed(() => selectedProjects.value.map((project) => ({
    clientDocumentKey: `project:${project.abusMngNo}:${project.sno}`,
    sources: [{
        kind: 'PROJECT' as const,
        id: project.abusMngNo,
        revision: project.sno,
        order: 1,
    }],
})));
```

Preserve the existing `reportPdfState` latest-request guard. Replace locally fetched full ProjectDetail input with each preview document’s snapshot. One successful response marks all selected rows submitted; any failure marks none submitted and keeps the selection.

- [ ] **Step 4: Update the E2E request contract.**

Intercept `/api/applications/it-budget/previews` and `/submissions`. Assert one submission request, stable document order, and N returned application numbers. Remove assertions that inspect client-built `apfDtlCone`; assert instead that the preview response’s `payloadDigest` is copied into submission.

- [ ] **Step 5: Run tests and commit.**

Run: `npm test -- --run tests/unit/pages/infoProjectsReport.test.ts`

Run: `npm run test:e2e -- tests/e2e/report-pdf-latest.spec.ts`

```powershell
git add app/pages/info/projects/report.vue tests/unit/pages/infoProjectsReport.test.ts tests/e2e/report-pdf-latest.spec.ts
git diff --cached --stat
git commit -m "feat: submit project reports atomically"
```

## Task 14: Run Cross-repository Verification and Record the Operational Contract

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-06-it-budget-snapshot-integrity-design.md` only if verified implementation details differ from the approved contract.

**Interfaces:**
- Consumes: completed backend and frontend changes.
- Produces: reproducible verification evidence and synchronized root documentation.

- [ ] **Step 1: Verify backend formatting, unit tests, and contract generation.**

Run in `C:\it\it_backend`: `./gradlew spotlessCheck test`

- [ ] **Step 2: Verify frontend generated types, targeted tests, typecheck, lint, and CSS lint.**

Run in `C:\it\it_frontend`: `npm run codegen:check`

Run: `npm test -- --run tests/unit/utils/approvalFormRegistry.test.ts tests/unit/composables/useItBudgetApproval.test.ts tests/unit/pages/budgetReportSubmission.test.ts tests/unit/pages/infoProjectsReport.test.ts`

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm run lint:css`

- [ ] **Step 3: Run the two browser flows against backend-generated previews.**

Run: `npm run test:e2e -- tests/e2e/budget-report-session.spec.ts tests/e2e/report-pdf-latest.spec.ts`

Exercise one deliberate source edit between preview and submit and assert the dialog text and columns exactly match the approved copy.

- [ ] **Step 4: Inspect all three repositories for accidental files and unrelated changes.**

```powershell
git -C C:\it status --short
git -C C:\it\it_backend status --short
git -C C:\it\it_frontend status --short
git -C C:\it\it_backend diff --check
git -C C:\it\it_frontend diff --check
```

- [ ] **Step 5: Update root README with endpoint ownership and failure behavior, then commit only root docs.**

```powershell
git add README.md docs/superpowers/specs/2026-09-06-it-budget-snapshot-integrity-design.md
git diff --cached --stat
git commit -m "docs: document IT budget snapshot integrity"
```

The final verification note must list executed commands, pass/fail counts, whether Oracle-tagged concurrency tests ran, and any pre-existing dirty frontend paths that were deliberately left untouched.
