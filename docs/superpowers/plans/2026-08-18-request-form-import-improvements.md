# 편성요청서 반입 기능 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 편성요청서 반입 결과 표에서 모든 진단이 어느 파일·어느 행의 것인지 드러나게 하고, 반입 대상이 아닌 파일·통화 미해석·전결권자 미매칭을 관리자가 그 자리에서 판단·해소할 수 있게 한다.

**Architecture:** 백엔드는 진단 코드·파일 상태·후보 목록만 손댄다(신규 테이블·컬럼 없음). 시트 ③ 어댑터는 "통화 해석 → 단위 판정 → 금액 반영" 3단계로 순서를 바꿔, 단위 판정이 확정된 통화를 근거로 삼게 한다. 프론트는 백엔드가 이미 주고 있는 `fileKey`를 진단 줄에 표기하고, 메모리에 든 `File`로 사본을 연다.

**Tech Stack:** Spring Boot / Apache POI / JUnit 5 + Mockito + AssertJ (백엔드), Nuxt 4 CSR / Vue 3 Composition API / PrimeVue / Vitest + happy-dom (프론트)

설계 문서: [docs/superpowers/specs/2026-08-18-request-form-import-improvements-design.md](../specs/2026-08-18-request-form-import-improvements-design.md)

## Global Constraints

- 신규 테이블·컬럼·Flyway 스크립트를 만들지 않는다. `meta/table.txt`도 손대지 않는다.
- 모든 신규 주석은 한글로 쓴다. public API·service 메서드에는 입력값과 실패 조건을 함께 적는다.
- 프론트의 사용자 노출 문구는 i18n 키로 넣는다. 고정 리터럴은 `npm run check:copy` ratchet이 막는다.
- i18n 문구는 `it_frontend/i18n/messages/migration.ts`의 **한국어 블록과 영어 블록 양쪽**에 넣는다. 한쪽만 넣으면 타입 검사가 깨진다.
- `git add`는 경로를 명시한다. `git add -A`, `git add .`, `git commit -a`를 쓰지 않는다. 이 워킹트리는 다른 작업과 공유되므로 커밋 직전 `git diff --cached --stat`으로 스테이징 목록이 의도한 경로와 정확히 일치하는지 확인한다.
- `it_backend`·`it_frontend`는 각각 독립 원격 저장소다. 커밋은 `git -C it_backend …`, `git -C it_frontend …`처럼 해당 저장소에서 한다.
- 커밋 메시지에 큰따옴표를 쓰지 않는다(Windows PowerShell에서 pathspec으로 재파싱된다). 여러 줄이 필요하면 `-m`을 두 번 쓴다.
- 백엔드 enum 값을 늘리면 `RequestFormOpenApiContractTest`가 `containsExactly`로 순서까지 고정한다. **새 값은 목록 끝에 추가**하고 테스트 목록도 같은 순서로 맞춘다.
- 백엔드 계약이 바뀌면 프론트 생성 타입(`it_frontend/app/types/api.d.ts`)을 반드시 재생성한다. Task 5가 그 자리다.
- 진단이 특정 엑셀 행을 가리킬 수 있으면 `excelRow`를 반드시 채운다. 가리킬 행이 없는 진단(파일·시트 단위)만 null로 둔다.

---

### Task 1: 시트 미인식 파일을 `SKIPPED`로 분리

깊은 폴더 구조(`[연도]/[부서명(코드)]/[팀]/[사업]/…`)에서는 편성요청서가 아닌 엑셀이 함께
올라온다. 지금은 그런 파일이 상태 `FAILED` + 심각도 `BLOCKER`로 붉게 뜨는데, 반입 대상이
아닌 것을 실패로 부르는 것은 사실과 다르고 관리자가 고칠 방법도 없다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormDto.java` (`FileStatus` enum)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormDiagnosticCode.java` (`SHEET_NOT_FOUND`)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormImportService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/support/RequestFormFixtures.java` (픽스처 추가)
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormImportServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/dto/RequestFormOpenApiContractTest.java`

**Interfaces:**
- Consumes: `WorkbookReader.classify(Workbook)` → `Map<FormSheetKind, Sheet>` (기존)
- Produces:
  - `RequestFormDto.FileStatus.SKIPPED` — enum 상수. 값 순서는 `APPLIED, BLOCKED, FAILED, SKIPPED`
  - `RequestFormDiagnosticCode.SHEET_NOT_FOUND.severity()` → `MigrationDto.Severity.WARNING`
  - JSON 응답 `files[].status`에 `"SKIPPED"` (Task 5가 소비)

- [ ] **Step 1: 시트 없는 워크북 픽스처를 더한다**

`RequestFormFixtures.java`의 `generalExpenseHeaderOnlyXls()` 메서드 **바로 뒤**에 넣는다:

```java
    /**
     * 편성요청서 시트가 하나도 없는 .xls.
     *
     * <p>깊은 폴더 구조(`[연도]/[부서명(코드)]/[팀]/[사업]/…`)에서 사업 폴더에 함께 들어 있는 참고 자료를 흉내 냅니다. 반입 대상이 아니므로
     * 실패가 아니라 건너뜀으로 남아야 합니다.
     */
    public static byte[] unrelatedSheetXls() {
        try (Workbook wb = new HSSFWorkbook()) {
            Sheet s = wb.createSheet("참고자료");
            put(s, 0, 0, "사업 추진 일정");
            return toBytes(wb);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`RequestFormImportServiceTest.java`의 import 목록에 다음 한 줄을 더한다(기존 `com.kdb.it.domain.migration.request.dto.AmountUnit` 바로 위):

```java
import com.kdb.it.domain.migration.dto.MigrationDto;
```

그리고 `keepsGoingWhenOneFileIsUnreadable` 테스트 **바로 뒤**에 넣는다:

```java
    @Test
    @DisplayName("인식할 시트가 없는 파일은 실패가 아니라 SKIPPED로 남긴다")
    void skipsFileWithoutRecognizableSheet() {
        RequestFormDto.ImportResponse response =
                service(50)
                        .importBatch(
                                List.of(
                                        file(
                                                "참고자료.xls",
                                                RequestFormFixtures.unrelatedSheetXls())),
                                manifest("자금운용실(420)/팀1/사업1/참고자료.xls"),
                                "12345678",
                                true);

        RequestFormDto.FileResult result = response.files().get(0);
        assertThat(result.status()).isEqualTo(RequestFormDto.FileStatus.SKIPPED);
        assertThat(result.diagnostics())
                .singleElement()
                .satisfies(
                        diagnostic -> {
                            assertThat(diagnostic.code())
                                    .isEqualTo(RequestFormDiagnosticCode.SHEET_NOT_FOUND);
                            assertThat(diagnostic.severity())
                                    .isEqualTo(MigrationDto.Severity.WARNING);
                        });
        // 건너뛴 파일은 차단도 반영도 아니다
        assertThat(response.summary().blockedFiles()).isZero();
        assertThat(response.summary().appliedFiles()).isZero();
    }
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

```bash
cd it_backend && ./gradlew test --tests '*RequestFormImportServiceTest*'
```

Expected: FAIL — `SKIPPED` 상수가 없어 컴파일 오류(`cannot find symbol: variable SKIPPED`).

- [ ] **Step 4: `FileStatus`에 `SKIPPED`를 더한다**

`RequestFormDto.java`의 `FileStatus` enum에서 `FAILED` 뒤에 넣는다. **끝에 붙여야** OpenAPI 값 순서를 고정한 계약 테스트가 한 줄 추가만으로 맞는다:

```java
    /** 파일 1건의 반영 결과 상태입니다. */
    @Schema(name = "RequestFormFileStatus", description = "파일 반영 상태")
    public enum FileStatus {
        /** 원장에 반영됨 */
        APPLIED,
        /** BLOCKER 진단이 남아 반영하지 않음 */
        BLOCKED,
        /** 예상하지 못한 오류로 실패 (해당 파일만 롤백) */
        FAILED,
        /**
         * 반입 대상 시트가 없어 건너뜀 — 실패가 아닙니다.
         *
         * <p>부점 폴더 아래에 팀·사업 폴더가 더 있는 구조에서는 편성요청서가 아닌 엑셀이 함께 올라옵니다. 그것을 실패로 부르면 관리자가 고칠 수 없는 붉은
         * 줄이 결과 표를 채웁니다. 차단 건수·반영 건수 어디에도 세지 않습니다.
         */
        SKIPPED
    }
```

- [ ] **Step 5: `SHEET_NOT_FOUND` 심각도를 낮춘다**

`RequestFormDiagnosticCode.java`에서 해당 상수만 바꾼다. **enum 순서는 그대로 둔다**:

```java
    /**
     * 인식 가능한 시트가 하나도 없음 — 반입 대상이 아님.
     *
     * <p>BLOCKER가 아닙니다. 부점 폴더 아래에 팀·사업 폴더가 더 있는 구조에서는 편성요청서가 아닌 엑셀이 함께 올라오는 것이 정상 케이스이고, 그것은
     * 관리자가 고칠 수 있는 결함이 아닙니다. 이 코드를 받은 파일은 {@code FileStatus.SKIPPED}로 남습니다.
     */
    SHEET_NOT_FOUND(MigrationDto.Severity.WARNING),
```

- [ ] **Step 6: `skipped()` 헬퍼를 만들고 분기를 바꾼다**

`RequestFormImportService.java`의 `processFile` 안에서 `sheets.isEmpty()` 분기를 바꾼다:

```java
            Map<FormSheetKind, Sheet> sheets = workbookReader.classify(workbook);
            if (sheets.isEmpty()) {
                return new ProcessedFile(skipped(entry), null);
            }
```

그리고 기존 `failed(...)` 메서드 **바로 뒤**에 헬퍼를 더한다:

```java
    /**
     * 반입 대상이 아닌 파일의 결과를 만듭니다.
     *
     * <p>{@link #failed}와 달리 실패가 아닙니다 — 열리기는 했고 편성요청서가 아니었을 뿐입니다. 요약의 반영·차단 건수 어디에도 세지 않으므로
     * {@code summarize()}는 손대지 않습니다.
     *
     * @param entry 파일별 부가 정보
     * @return 상태 {@code SKIPPED}, 진단 1건, 생성 목록·건수는 빈 값
     */
    private RequestFormDto.FileResult skipped(RequestFormDto.FileEntry entry) {
        return new RequestFormDto.FileResult(
                entry.fileKey(),
                entry.deptName(),
                RequestFormDto.FileStatus.SKIPPED,
                List.of(
                        RequestFormDto.FormDiagnostic.of(
                                null,
                                null,
                                null,
                                RequestFormDiagnosticCode.SHEET_NOT_FOUND,
                                "인식할 수 있는 편성요청서 시트가 없습니다. 반입 대상이 아닌 파일로 보고 건너뜁니다.",
                                List.of())),
                List.of(),
                RequestFormDto.RecordCounts.zero(),
                null);
    }
```

- [ ] **Step 7: 계약 테스트의 값 집합을 갱신한다**

`RequestFormOpenApiContractTest.java`의 `fileStatusEnumIsFixed`:

```java
    @Test
    @DisplayName("파일 상태 enum 값 집합이 고정되어 있다")
    void fileStatusEnumIsFixed() {
        assertEnum(
                RequestFormDto.FileResult.class,
                "status",
                "APPLIED",
                "BLOCKED",
                "FAILED",
                "SKIPPED");
    }
```

- [ ] **Step 8: 테스트가 통과하는지 확인한다**

```bash
cd it_backend && ./gradlew test --tests '*RequestFormImportServiceTest*' --tests '*RequestFormOpenApiContractTest*'
```

Expected: PASS (BUILD SUCCESSFUL).

- [ ] **Step 9: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormDto.java src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormDiagnosticCode.java src/main/java/com/kdb/it/domain/migration/request/service/RequestFormImportService.java src/test/java/com/kdb/it/domain/migration/request/support/RequestFormFixtures.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormImportServiceTest.java src/test/java/com/kdb/it/domain/migration/request/dto/RequestFormOpenApiContractTest.java
git -C it_backend diff --cached --stat
git -C it_backend commit -m 'feat: 편성요청서 반입 대상 아닌 파일을 SKIPPED로 분리'
```

---

### Task 2: 시트 ③ 통화를 공통코드로 확정한다

지금은 `"KRW".equalsIgnoreCase(row.currency())` 정확 일치만 원화로 본다. 통화 칸이 비었거나
다른 표기면 전부 외화로 흘러 원화 금액이 `FC_AMT`에 들어가고 서버가 환율을 곱한다. 통화를
공통코드 `CUR_C` 기준으로 확정하고, 확정하지 못한 행은 차단하고 후보를 준다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/support/RequestFormFixtures.java` (픽스처 추가)
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapterTest.java`

**Interfaces:**
- Consumes:
  - `MigrationIoeCatalogReader.candidates(String cId, boolean storeName)` → `List<MigrationDto.Candidate>` (기존)
  - `CommonCodeGroups.CURRENCY` = `"CUR_C"` (기존 상수)
  - `FormAdapterContext.override(FormSheetKind, Integer, String)` → `Optional<String>` (기존)
- Produces:
  - `GeneralExpenseFormAdapter(SheetAnchorScanner, FormApproverReader, MigrationIoeCatalogReader)` — **생성자 인자 3개**로 늘어난다. 테스트가 직접 생성한다
  - 진단: `code=CODE_UNRESOLVED`, `field="curC"`, `sheet=GENERAL_EXPENSE`, `excelRow=행번호`, `subject=계약명`, `candidates=CUR_C 전체`, `decision=SELECT`
  - 내부 `Map<Integer,String> resolveCurrencies(...)` — 엑셀 행 번호 → 확정 통화. 미해석 행은 키가 없다 (Task 3이 소비)

- [ ] **Step 1: 통화가 어긋난 픽스처를 더한다**

`RequestFormFixtures.java`의 `unrelatedSheetXls()` **바로 뒤**에 넣는다:

```java
    /**
     * 시트 ③의 통화 칸이 어긋난 .xls.
     *
     * <p>행 구성(0-based 시트 행 → 엑셀 행): 5→6 통화 칸이 빈 행, 6→7 통화코드가 아닌 표기(`원화`), 7→8 정상 `USD` 행.
     */
    public static byte[] generalExpenseBadCurrencyXls() {
        try (Workbook wb = new HSSFWorkbook()) {
            Sheet s = writeGeneralExpenseHeader(wb, "③ (일반관리비) 전산 일반관리비 편성요청서", false);
            put(s, 5, 0, "전산 제비");
            put(s, 5, 1, "회선사용료");
            put(s, 5, 2, "통화 없는 계약");
            putNumber(s, 5, 5, 5_000_000d);
            put(s, 5, 6, "미지정");
            put(s, 5, 7, "√");
            put(s, 5, 9, "○");

            put(s, 6, 0, "전산 제비");
            put(s, 6, 1, "회선사용료");
            put(s, 6, 2, "통화 표기가 다른 계약");
            put(s, 6, 3, "원화");
            putNumber(s, 6, 5, 7_000_000d);
            put(s, 6, 6, "미지정");
            put(s, 6, 7, "√");
            put(s, 6, 9, "○");

            put(s, 7, 0, "전산 제비");
            put(s, 7, 1, "회선사용료");
            put(s, 7, 2, "정상 외화 계약");
            put(s, 7, 3, "usd");
            putNumber(s, 7, 5, 12_000d);
            put(s, 7, 6, "Reuters");
            put(s, 7, 7, "√");
            put(s, 7, 9, "○");
            return toBytes(wb);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`GeneralExpenseFormAdapterTest.java`를 고친다. 먼저 import에 두 줄을 더한다:

```java
import com.kdb.it.domain.migration.service.MigrationIoeCatalogReader;
```

(`com.kdb.it.domain.migration.request.support.TestIoeIndex` 다음 줄에 넣는다. `CommonCodeGroups`·`MigrationDto`·`Mockito`·`List`는 이미 import되어 있다.)

그리고 어댑터 생성 부분을 바꾼다:

```java
    private final WorkbookReader reader = new WorkbookReader(10_485_760L, 20, 5000);
    private final SheetAnchorScanner scanner = new SheetAnchorScanner();
    private final MigrationIoeCatalogReader catalogReader = currencyCatalogReader();
    private final GeneralExpenseFormAdapter adapter =
            new GeneralExpenseFormAdapter(scanner, new FormApproverReader(scanner), catalogReader);

    /** 통화 공통코드(`CUR_C`)만 답하는 카탈로그 리더. 실 DB의 통화 목록을 흉내 냅니다. */
    private static MigrationIoeCatalogReader currencyCatalogReader() {
        MigrationIoeCatalogReader mock = Mockito.mock(MigrationIoeCatalogReader.class);
        Mockito.when(mock.candidates(CommonCodeGroups.CURRENCY, false))
                .thenReturn(
                        List.of(
                                new MigrationDto.Candidate("KRW", "원화"),
                                new MigrationDto.Candidate("USD", "미국 달러"),
                                new MigrationDto.Candidate("GBP", "영국 파운드"),
                                new MigrationDto.Candidate("JPY", "일본 엔")));
        return mock;
    }
```

그리고 파일 끝의 마지막 `}` 앞에 테스트 셋을 더한다:

```java
    @Test
    @DisplayName("통화 칸이 비면 행 단위로 차단하고 통화 후보를 준다")
    void blocksRowWithBlankCurrency() {
        FormAdapterOutput output =
                adapter.adapt(
                        contextOf(RequestFormFixtures.generalExpenseBadCurrencyXls(), AmountUnit.WON));

        assertThat(output.diagnostics())
                .filteredOn(d -> "curC".equals(d.field()))
                .anySatisfy(
                        d -> {
                            assertThat(d.excelRow()).isEqualTo(6);
                            assertThat(d.subject()).isEqualTo("통화 없는 계약");
                            assertThat(d.code())
                                    .isEqualTo(RequestFormDiagnosticCode.CODE_UNRESOLVED);
                            assertThat(d.severity()).isEqualTo(MigrationDto.Severity.BLOCKER);
                            assertThat(d.decision())
                                    .isEqualTo(RequestFormDecisionKind.SELECT);
                            assertThat(d.candidates())
                                    .extracting(MigrationDto.Candidate::code)
                                    .contains("KRW", "USD");
                        });
    }

    @Test
    @DisplayName("통화코드가 아닌 표기도 행 단위로 차단한다")
    void blocksRowWithUnknownCurrencyLabel() {
        FormAdapterOutput output =
                adapter.adapt(
                        contextOf(RequestFormFixtures.generalExpenseBadCurrencyXls(), AmountUnit.WON));

        assertThat(output.diagnostics())
                .filteredOn(d -> "curC".equals(d.field()))
                .anySatisfy(
                        d -> {
                            assertThat(d.excelRow()).isEqualTo(7);
                            assertThat(d.message()).contains("원화");
                        });
    }

    @Test
    @DisplayName("통화코드는 대소문자를 가리지 않고 확정한다")
    void resolvesCurrencyCaseInsensitively() {
        FormAdapterOutput output =
                adapter.adapt(
                        contextOf(RequestFormFixtures.generalExpenseBadCurrencyXls(), AmountUnit.WON));

        assertThat(output.costs())
                .filteredOn(cost -> "정상 외화 계약".equals(cost.getCttNm()))
                .singleElement()
                .satisfies(
                        cost -> {
                            assertThat(cost.getCurC()).isEqualTo("USD");
                            assertThat(cost.getFcAmt()).isEqualByComparingTo(new BigDecimal("12000"));
                            assertThat(cost.getCostTotXpAmt()).isNull();
                        });
    }

    @Test
    @DisplayName("통화 보정값이 있으면 시트값보다 우선하고 진단을 내지 않는다")
    void currencyOverrideWinsOverSheetValue() {
        Map<String, String> overrides =
                Map.of(
                        FormAdapterContext.overrideKey(FormSheetKind.GENERAL_EXPENSE, 6, "curC"),
                        "KRW");

        FormAdapterOutput output =
                adapter.adapt(
                        contextOf(
                                RequestFormFixtures.generalExpenseBadCurrencyXls(),
                                AmountUnit.WON,
                                overrides));

        assertThat(output.diagnostics())
                .filteredOn(d -> "curC".equals(d.field()))
                .extracting(RequestFormDto.FormDiagnostic::excelRow)
                .doesNotContain(6);
        assertThat(output.costs())
                .filteredOn(cost -> "통화 없는 계약".equals(cost.getCttNm()))
                .singleElement()
                .satisfies(
                        cost -> {
                            assertThat(cost.getCurC()).isEqualTo("KRW");
                            assertThat(cost.getCostTotXpAmt())
                                    .isEqualByComparingTo(new BigDecimal("5000000"));
                        });
    }
```

`RequestFormDecisionKind` import가 없으면 더한다:

```java
import com.kdb.it.domain.migration.request.dto.RequestFormDecisionKind;
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

```bash
cd it_backend && ./gradlew test --tests '*GeneralExpenseFormAdapterTest*'
```

Expected: FAIL — 생성자 인자 개수 불일치로 컴파일 오류(`constructor GeneralExpenseFormAdapter … cannot be applied to given types`).

- [ ] **Step 4: 어댑터에 카탈로그 리더를 주입하고 통화 해석을 넣는다**

`GeneralExpenseFormAdapter.java`. import에 다음을 더한다:

```java
import com.kdb.it.common.code.CommonCodeGroups;
import com.kdb.it.domain.migration.service.MigrationIoeCatalogReader;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
```

필드에 리더를 더한다(`@RequiredArgsConstructor`가 생성자를 만든다):

```java
    private final SheetAnchorScanner scanner;
    private final FormApproverReader approverReader;
    private final MigrationIoeCatalogReader catalogReader;
```

`adapt`의 본문에서 행을 읽은 뒤 부분을 바꾼다:

```java
        List<GeneralExpenseRow> rows =
                new GeneralExpenseRowReader(sheet, header.get(), scanner).readAll();
        if (rows.isEmpty()) return FormAdapterOutput.empty();

        List<RequestFormDto.FormDiagnostic> diagnostics = new ArrayList<>();
        // 통화를 먼저 확정한다. 단위 판정이 "원화 행이 있는가"를 근거로 삼으므로 순서를 뒤집을 수 없다
        List<MigrationDto.Candidate> currencyCandidates =
                catalogReader.candidates(CommonCodeGroups.CURRENCY, false);
        Map<Integer, String> currencies =
                resolveCurrencies(rows, context, currencyCandidates, diagnostics);
        AmountUnit unit = resolveUnit(context, rows, currencies, diagnostics);
        // 상단 머리말의 작성자가 이 시트의 담당자다. 없으면 비워 둔다
        String author =
                FormPersonNames.fit(
                        approverReader.author(sheet),
                        "작성자",
                        FormSheetKind.GENERAL_EXPENSE,
                        diagnostics);

        List<CostDto.CreateRequest> costs = new ArrayList<>();
        for (GeneralExpenseRow row : rows) {
            costs.add(
                    toCreateRequest(
                            row,
                            context,
                            currencies.get(row.excelRow()),
                            unit,
                            author,
                            diagnostics));
        }
        return new FormAdapterOutput(List.of(), List.copyOf(costs), List.copyOf(diagnostics), unit);
```

`resolveUnit` 바로 위에 통화 해석을 더한다:

```java
    /**
     * 행마다 통화를 확정합니다.
     *
     * <p>보정값 → 시트값 순으로 보고, 공통코드 {@code CUR_C}의 코드값 집합에 없으면(빈칸 포함) 확정하지 않고 BLOCKER 진단을 냅니다. 빈칸을
     * 원화로 추정하지 않는 이유는 그 추정이 틀리면 금액이 들어가는 컬럼과 단위 경고 여부가 함께 틀리기 때문입니다. 양식에 `통화 구분` 칸이 있으므로 빈칸은
     * 정상 기재가 아니라 누락입니다.
     *
     * @param rows 시트 ③ 데이터 행
     * @param context 어댑터 실행 맥락 (보정값을 읽습니다)
     * @param candidates 통화 공통코드 후보. 진단에 그대로 실어 화면에서 고르게 합니다
     * @param diagnostics 진단 누적 목록. 미해석 행마다 1건씩 더합니다
     * @return 엑셀 행 번호 → 확정 통화. 확정하지 못한 행은 키가 없습니다
     */
    private Map<Integer, String> resolveCurrencies(
            List<GeneralExpenseRow> rows,
            FormAdapterContext context,
            List<MigrationDto.Candidate> candidates,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        Set<String> codes = new LinkedHashSet<>();
        for (MigrationDto.Candidate candidate : candidates) codes.add(candidate.code());

        Map<Integer, String> resolved = new LinkedHashMap<>();
        for (GeneralExpenseRow row : rows) {
            String raw =
                    context.override(FormSheetKind.GENERAL_EXPENSE, row.excelRow(), "curC")
                            .orElseGet(row::currency);
            String normalized = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
            if (codes.contains(normalized)) {
                resolved.put(row.excelRow(), normalized);
                continue;
            }
            diagnostics.add(
                    diagnostic(
                            row,
                            "curC",
                            RequestFormDiagnosticCode.CODE_UNRESOLVED,
                            normalized.isEmpty()
                                    ? "통화 구분이 비어 있습니다. 통화를 골라 주세요."
                                    : "통화 구분 `%s`를 통화코드로 해석하지 못했습니다. 골라 주세요."
                                            .formatted(raw.trim()),
                            candidates));
        }
        return resolved;
    }
```

`toCreateRequest`가 확정 통화를 받도록 고친다:

```java
    private CostDto.CreateRequest toCreateRequest(
            GeneralExpenseRow row,
            FormAdapterContext context,
            String currency,
            AmountUnit unit,
            String author,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
```

(본문에서 `applyCurrencyAndAmount(row, request, unit);` 호출을 `applyCurrencyAndAmount(row, currency, request, unit);`으로 바꾼다. 그 밖의 본문은 그대로 둔다.)

`applyCurrencyAndAmount`를 고친다:

```java
    /**
     * 통화와 금액을 채웁니다.
     *
     * <p>외화 행은 `FC_AMT`만 채우고 원화금액과 환율은 비워 둡니다. 서버 {@code BudgetAmountCalculator}가 `FC_AMT × Ccodem
     * 환율`로 재계산하므로 여기서 채우면 그 값이 그대로 버려집니다.
     *
     * @param currency 확정 통화. null이면 미해석 행이므로 아무것도 채우지 않습니다 (이미 BLOCKER 진단이 나가 파일이 차단됩니다)
     */
    private void applyCurrencyAndAmount(
            GeneralExpenseRow row,
            String currency,
            CostDto.CreateRequest request,
            AmountUnit unit) {
        if (currency == null) return;
        request.setCurC(currency);
        if (row.annual() == null) return;

        if ("KRW".equals(currency)) {
            request.setCostTotXpAmt(unit.toWon(row.annual()));
            request.setFcAmt(null);
            return;
        }
        BigDecimal foreignAmount =
                "JPY".equals(currency)
                        ? row.annual().multiply(BigDecimal.valueOf(JPY_MULTIPLIER))
                        : row.annual();
        request.setFcAmt(foreignAmount);
        request.setCostTotXpAmt(null);
        request.setXcr(null);
    }
```

`resolveUnit`과 `krwAnnualAmounts`가 확정 통화를 쓰도록 바꾼다. **`UNIT_UNCERTAIN`을 내는 조건은 Task 3에서 손댄다** — 여기서는 표본만 바꾼다:

```java
    /** 사용자가 지정한 배수를 우선하고, 없으면 제안값을 계산해 확인 경고를 남깁니다. */
    private AmountUnit resolveUnit(
            FormAdapterContext context,
            List<GeneralExpenseRow> rows,
            Map<Integer, String> currencies,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        AmountUnit specified = context.entry().generalExpenseUnit();
        if (specified != null) return specified;

        AmountUnit suggested =
                AmountUnitResolver.suggestGeneralExpenseUnit(krwAnnualAmounts(rows, currencies));
        diagnostics.add(
                RequestFormDto.FormDiagnostic.decide(
                        FormSheetKind.GENERAL_EXPENSE,
                        null,
                        "generalExpenseUnit",
                        null,
                        RequestFormDiagnosticCode.UNIT_UNCERTAIN,
                        "금액 단위를 %s 단위로 추정했습니다. 확인해 주세요.".formatted(suggested.label()),
                        List.of(),
                        RequestFormDecisionKind.AMOUNT_UNIT));
        return suggested;
    }
```

```java
    private static List<BigDecimal> krwAnnualAmounts(
            List<GeneralExpenseRow> rows, Map<Integer, String> currencies) {
        List<BigDecimal> amounts = new ArrayList<>();
        for (GeneralExpenseRow row : rows) {
            if ("KRW".equals(currencies.get(row.excelRow())) && row.annual() != null) {
                amounts.add(row.annual());
            }
        }
        return amounts;
    }
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd it_backend && ./gradlew test --tests '*GeneralExpenseFormAdapterTest*' --tests '*FormAdapter*'
```

Expected: PASS. 실패한다면 다른 어댑터 테스트가 `new GeneralExpenseFormAdapter(...)`를 두 인자로 부르고 있는 것이므로, 같은 방식으로 `currencyCatalogReader()` 목을 넘기도록 고친다.

- [ ] **Step 6: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapter.java src/test/java/com/kdb/it/domain/migration/request/support/RequestFormFixtures.java src/test/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapterTest.java
git -C it_backend diff --cached --stat
git -C it_backend commit -m 'fix: 일반관리비 통화를 공통코드로 확정하고 미해석 행을 차단'
```

---

### Task 3: 원화 행이 없으면 금액 단위 경고를 내지 않는다

금액 배수는 원화 행에만 걸린다(외화 행은 `FC_AMT`로 통화 기본 단위 그대로 간다). 국외 점포
제출본처럼 원화 행이 하나도 없는 시트에서는 어떤 배수를 골라도 결과가 같으므로, 확인을 묻는
것 자체가 의미 없는 노이즈다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapter.java` (`resolveUnit`)
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapterTest.java`

**Interfaces:**
- Consumes: Task 2가 만든 `Map<Integer,String> currencies`와 `krwAnnualAmounts(rows, currencies)`
- Produces: 없음 (기존 진단의 발생 조건만 좁힌다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`GeneralExpenseFormAdapterTest.java` 끝(마지막 `}` 앞)에 더한다. `englishFormXls()`의 시트 ③은
전 행이 `GBP`다:

```java
    @Test
    @DisplayName("원화 행이 하나도 없으면 금액 단위 확인을 묻지 않는다")
    void skipsUnitWarningWhenNoKrwRow() {
        FormAdapterOutput output =
                adapter.adapt(contextOf(RequestFormFixtures.englishFormXls(), null));

        assertThat(output.costs()).isNotEmpty();
        assertThat(output.costs())
                .extracting(CostDto.CreateRequest::getCurC)
                .containsOnly("GBP");
        assertThat(output.diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .doesNotContain(RequestFormDiagnosticCode.UNIT_UNCERTAIN);
    }
```

반대쪽(원화 행이 있으면 경고를 낸다)은 **새로 쓰지 않는다.** 같은 파일의 기존
`suggestsMultiplierWhenAbsent`가 이미 `fullFormXls` + 배수 미지정으로 `UNIT_UNCERTAIN`이
나오는 것을 단언한다. 같은 픽스처·같은 인자로 한 줄만 다른 테스트를 더하면 중복이다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd it_backend && ./gradlew test --tests '*GeneralExpenseFormAdapterTest*'
```

Expected: FAIL — `skipsUnitWarningWhenNoKrwRow`가 `UNIT_UNCERTAIN`을 찾아내며 실패한다.

- [ ] **Step 3: `resolveUnit`에 조건을 넣는다**

`GeneralExpenseFormAdapter.java`의 `resolveUnit`을 바꾼다:

```java
    /**
     * 사용자가 지정한 배수를 우선하고, 없으면 제안값을 계산해 확인 경고를 남깁니다.
     *
     * <p>원화로 확정된 행이 하나도 없으면 <b>경고를 내지 않습니다.</b> 이 배수는 원화 행에만 걸리고 외화 행은 통화 기본 단위 그대로 {@code FC_AMT}로
     * 가므로, 원화 행이 없는 시트(국외 점포 실측)에서는 어떤 값을 골라도 결과가 같습니다. 고를 이유가 없는 확인을 묻지 않습니다.
     *
     * @param currencies {@link #resolveCurrencies} 결과. 엑셀 행 번호 → 확정 통화
     * @return 적용할 배수. 원화 행이 없으면 {@code WON}(어느 값이든 결과가 같습니다)
     */
    private AmountUnit resolveUnit(
            FormAdapterContext context,
            List<GeneralExpenseRow> rows,
            Map<Integer, String> currencies,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        AmountUnit specified = context.entry().generalExpenseUnit();
        if (specified != null) return specified;

        List<BigDecimal> krwAmounts = krwAnnualAmounts(rows, currencies);
        if (krwAmounts.isEmpty()) return AmountUnit.WON;

        AmountUnit suggested = AmountUnitResolver.suggestGeneralExpenseUnit(krwAmounts);
        diagnostics.add(
                RequestFormDto.FormDiagnostic.decide(
                        FormSheetKind.GENERAL_EXPENSE,
                        null,
                        "generalExpenseUnit",
                        null,
                        RequestFormDiagnosticCode.UNIT_UNCERTAIN,
                        "금액 단위를 %s 단위로 추정했습니다. 확인해 주세요.".formatted(suggested.label()),
                        List.of(),
                        RequestFormDecisionKind.AMOUNT_UNIT));
        return suggested;
    }
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd it_backend && ./gradlew test --tests '*GeneralExpenseFormAdapterTest*'
```

Expected: PASS. 반대쪽 경로는 기존 테스트가 지킨다 —
`suggestsMultiplierWhenAbsent`(`fullFormXls`, KRW 행 있음)와
`excludesBlankAmountRowFromUnitSuggestion`(`generalExpenseIoeBranchesXls`, KRW 행 있음)은
모두 원화 행이 있으므로 그대로 통과한다.

- [ ] **Step 5: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapter.java src/test/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapterTest.java
git -C it_backend diff --cached --stat
git -C it_backend commit -m 'fix: 원화 행 없는 일반관리비 시트에 금액 단위 경고를 내지 않음'
```

---

### Task 4: 전결권자 미매칭에 선택 후보를 붙인다

전결권자 이름이 공통코드에 없으면 지금은 후보 없이 `BLOCKER`만 남아 `decision`이 `NONE`이
된다. 화면에 고를 상자가 생기지 않아 그 파일은 원본 엑셀을 고치기 전까지 영구히 차단된다.
차단은 유지하되(이름을 적어 냈다는 것은 특정 전결권자를 지정했다는 뜻이다) 고를 수단을 준다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationIoeCatalogReader.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalProjectFormAdapter.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReader.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReaderTest.java`

**Interfaces:**
- Consumes:
  - `CommonCodeGroups.EDRT` = `"IT_PTL_EDRT_TC"` (기존)
  - `MigrationIoeCatalogReader.EDRT_CAPITAL_CTP` = `"EDRT_CPIT"` (기존 private 상수)
  - `FormCatalogs.optionCandidates(String field)` → `List<MigrationDto.Candidate>` (기존)
- Produces:
  - `MigrationIoeCatalogReader.edrtCapitalCandidates()` → `List<MigrationDto.Candidate>`. 후보값은 **코드값**(`"22"`), 라벨은 코드값명(`"부문장"`)
  - `FormCatalogs.optionCandidatesByField`에 키 `"edrtTc"`
  - 전결권자 미매칭 진단의 `decision`이 `SELECT`로 바뀐다 (프론트 `fieldLabel.edrtTc`가 이미 있으므로 화면 변경 불필요)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`CapitalOverviewReaderTest.java`의 기존 `delegationCanBeCorrectedByOverride` 테스트 **바로 뒤**에
더한다. 이 파일의 헬퍼는 `overviewSheet(Map<String,String>)`와 `context(Map<String,String>)`다:

```java
    @Test
    @DisplayName("전결권자 코드를 못 찾으면 공통코드 후보를 붙여 고르게 한다")
    void offersDelegationCandidatesWhenUnresolved() {
        Sheet sheet =
                overviewSheet(new java.util.LinkedHashMap<>(Map.of("사업명", "사업", "전결권자", "없는직위")));
        FormCatalogs catalogs =
                new FormCatalogs(
                        Map.of(),
                        Map.of("전무이사", "21"),
                        Map.of(),
                        Map.of(
                                "edrtTc",
                                List.of(
                                        new MigrationDto.Candidate("21", "전무이사"),
                                        new MigrationDto.Candidate("22", "부문장"))));

        CapitalOverviewReader.Result read = reader.read(sheet, context(Map.of()), catalogs);

        assertThat(read.diagnostics())
                .filteredOn(diagnostic -> "edrtTc".equals(diagnostic.field()))
                .singleElement()
                .satisfies(
                        diagnostic -> {
                            assertThat(diagnostic.code())
                                    .isEqualTo(RequestFormDiagnosticCode.CODE_UNRESOLVED);
                            assertThat(diagnostic.severity())
                                    .isEqualTo(MigrationDto.Severity.BLOCKER);
                            assertThat(diagnostic.decision())
                                    .isEqualTo(RequestFormDecisionKind.SELECT);
                            assertThat(diagnostic.candidates())
                                    .extracting(MigrationDto.Candidate::code)
                                    .containsExactly("21", "22");
                        });
    }
```

import에 없으면 다음을 더한다:

```java
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.request.dto.RequestFormDecisionKind;
import java.util.List;
```

기존 `delegationCanBeCorrectedByOverride`는 `FormCatalogs.empty()`를 쓰므로 후보가 빈 목록이
되어 그대로 통과한다 — 그 테스트는 코드만 확인하고 `decision`을 보지 않는다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd it_backend && ./gradlew test --tests '*CapitalOverviewReaderTest*'
```

Expected: FAIL — `candidates`가 비어 있고 `decision`이 `NONE`이라 assertion 실패.

- [ ] **Step 3: 카탈로그 리더에 후보 메서드를 더한다**

`MigrationIoeCatalogReader.java`. 기존 `candidates(String cId, boolean storeName)` 아래에
C_TP 필터를 받는 오버로드와 공개 메서드를 더한다:

```java
    /**
     * 전결권(`IT_PTL_EDRT_TC`) 자본예산 계열의 선택 후보를 만듭니다.
     *
     * <p>물리 컬럼 `IT_PTL_EDRT_TC`가 2자리 코드이므로 후보값은 <b>코드값</b>입니다({@code storeName=false}). 계열을 자본으로
     * 좁히는 이유는 {@link #edrtCapitalCodeByName()}과 같습니다 — `부문장`처럼 경상 계열에도 있는 이름이 섞이면 화면에서 고른 값이 어느 계열의
     * 코드인지 알 수 없어집니다.
     *
     * @return 예: `[{code:"22", label:"부문장"}, {code:"25", label:"이사회"}]`
     */
    public List<MigrationDto.Candidate> edrtCapitalCandidates() {
        return candidates(CommonCodeGroups.EDRT, EDRT_CAPITAL_CTP, false);
    }

    /**
     * 코드타입으로 좁힌 선택 후보를 만듭니다.
     *
     * @param cId 공통코드 그룹 id
     * @param cTp 코드타입. null이면 좁히지 않습니다
     * @param storeName true면 후보값으로 코드값명을, false면 코드값을 씁니다
     * @return 후보 목록. 코드값명이 없는 행은 건너뜁니다
     */
    private List<MigrationDto.Candidate> candidates(String cId, String cTp, boolean storeName) {
        List<MigrationDto.Candidate> out = new ArrayList<>();
        for (Ccodem code : codeRepository.findByCIdAndDelYn(cId, "N")) {
            if (code.getCdvaNm() == null || (cTp != null && !cTp.equals(code.getCTp()))) continue;
            String name = code.getCdvaNm().trim();
            out.add(new MigrationDto.Candidate(storeName ? name : code.getCdva().trim(), name));
        }
        return List.copyOf(out);
    }
```

기존 공개 `candidates(String cId, boolean storeName)`의 본문을 위임으로 바꾼다:

```java
    public List<MigrationDto.Candidate> candidates(String cId, boolean storeName) {
        return candidates(cId, null, storeName);
    }
```

- [ ] **Step 4: 후보를 카탈로그에 등록한다**

`CapitalProjectFormAdapter.java`의 `catalogs()`에서 `dplYn` 등록 **뒤**, `return` 앞에 넣는다:

```java
        // 전결권자는 이름이 코드표에 없을 때 사람이 고를 수 있어야 한다. 후보가 없으면 그 파일은 영구히 차단된다
        options.put("edrtTc", catalogReader.edrtCapitalCandidates());
```

- [ ] **Step 5: 진단에 후보를 싣는다**

`CapitalOverviewReader.java`의 `read(...)`에서 호출을 바꾼다:

```java
        applyDelegation(sheet, context, project, catalogs, diagnostics);
```

`applyDelegation` 시그니처와 진단을 바꾼다:

```java
    /**
     * 전결권자 이름을 자본예산 계열 코드로 바꿉니다.
     *
     * <p>보정값을 먼저 봅니다 — 이름이 코드표에 없을 때 사람이 고를 길이 없으면 그 파일은 영구히 차단됩니다.
     *
     * <p>미매칭이면 후보를 실어 화면의 결정 열에서 바로 고르게 합니다. 차단(`BLOCKER`)은 유지합니다 — 전결권자를 아예 적지 않은 파일은 진단 없이
     * 통과하지만, <b>적어 냈는데</b> 코드표에 없는 것은 제출자가 특정 전결권자를 지정했다는 뜻이라 빈 값으로 넘기면 원장에 제출 의사와 다른 값이 남습니다.
     *
     * @param catalogs 코드 맵과 선택 후보를 담은 공통코드 묶음
     */
    private void applyDelegation(
            Sheet sheet,
            FormAdapterContext context,
            ProjectDto.CreateRequest project,
            FormCatalogs catalogs,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        Optional<String> override =
                context.override(FormSheetKind.CAPITAL_OVERVIEW, null, "edrtTc");
        if (override.isPresent()) {
            project.setEdrtTc(override.get());
            return;
        }

        String name = labelReader.value(sheet, "전결권자");
        if (!hasText(name)) return;
        // 부점은 `수석부행장` 같은 통칭을 쓰고 코드표는 직명(`전무이사`)을 쓴다
        String code =
                lookup(catalogs.edrtCapitalCodeByName(), FormLexicon.canonicalOptionName(name));
        if (code != null) {
            project.setEdrtTc(code);
            return;
        }
        diagnostics.add(
                RequestFormDto.FormDiagnostic.of(
                        FormSheetKind.CAPITAL_OVERVIEW,
                        null,
                        "edrtTc",
                        RequestFormDiagnosticCode.CODE_UNRESOLVED,
                        "전결권자 `%s`에 해당하는 코드를 찾지 못했습니다. 공통코드에서 골라 주세요.".formatted(name),
                        catalogs.optionCandidates("edrtTc")));
    }
```

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

```bash
cd it_backend && ./gradlew test --tests '*CapitalOverviewReaderTest*' --tests '*CapitalProjectFormAdapterTest*'
```

Expected: PASS.

- [ ] **Step 7: 백엔드 품질 게이트를 돌린다**

```bash
cd it_backend && ./gradlew check
```

Expected: BUILD SUCCESSFUL. 포맷 위반이 나면 `./gradlew spotlessApply`(또는 프로젝트가 쓰는 포맷 태스크)를 돌린 뒤 다시 실행한다.

- [ ] **Step 8: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/service/MigrationIoeCatalogReader.java src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalProjectFormAdapter.java src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReader.java src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReaderTest.java
git -C it_backend diff --cached --stat
git -C it_backend commit -m 'feat: 전결권자 미매칭 진단에 공통코드 후보를 붙여 선택 가능하게 함'
```

---

### Task 5: 생성 타입 재생성과 새 상태·필드 표기

백엔드 계약이 바뀌었으므로 프론트 생성 타입을 다시 만들고, 새로 생긴 `SKIPPED` 상태와
`curC` 필드를 화면 표기에 반영한다.

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (**생성물 — 직접 수정 금지, 스크립트로 재생성**)
- Modify: `it_frontend/app/components/migration/RequestFormResultTable.vue`
- Test: `it_frontend/tests/unit/components/migration/RequestFormResultTable.test.ts`

**Interfaces:**
- Consumes: Task 1의 `FileStatus.SKIPPED`, Task 2의 `field="curC"` 진단
- Produces:
  - `statusLabel.SKIPPED` = `'대상 아님'`
  - CSS 클래스 `result-table__status--skipped`
  - `fieldLabel.curC` = `'통화'`

- [ ] **Step 1: 백엔드를 띄우고 타입을 재생성한다**

터미널 하나에서:

```bash
cd it_backend && ./gradlew bootRun
```

기동이 끝나면(로그에 `Started ItApplication`) 다른 터미널에서:

```bash
cd it_frontend && npm run codegen
```

Expected: `app/types/api.d.ts`가 갱신되고 `RequestFormFileResult.status`에 `"SKIPPED"`가 들어간다. 확인:

```bash
cd it_frontend && npm run codegen:check
```

Expected: 드리프트 없음으로 성공 종료.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`RequestFormResultTable.test.ts`의 `describe` 블록 안, 마지막 `});` 앞에 더한다:

```javascript
    it('대상 아닌 파일은 실패와 구분해 표기한다', () => {
        const wrapper = mountTable([
            result({ fileKey: '2026/IT기획부(180)/팀1/참고자료.xls', status: 'SKIPPED' }),
        ]);

        expect(wrapper.find('.result-table__status--skipped').text()).toBe('대상 아님');
    });

    it('통화 결정 위젯에 항목 이름을 붙인다', () => {
        const wrapper = mountTable([
            result({
                status: 'BLOCKED',
                diagnostics: [
                    diagnostic({
                        sheet: 'GENERAL_EXPENSE',
                        excelRow: 6,
                        field: 'curC',
                        subject: '통화 없는 계약',
                        code: 'CODE_UNRESOLVED',
                        severity: 'BLOCKER',
                        message: '통화 구분이 비어 있습니다. 통화를 골라 주세요.',
                        candidates: [{ code: 'KRW', label: '원화' }],
                        decision: 'SELECT',
                    }),
                ],
            }),
        ]);

        expect(wrapper.find('.result-table__decision-label').text()).toBe('통화');
        expect(wrapper.find('.result-table__locator').text()).toContain('6행');
    });
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

```bash
cd it_frontend && npm test -- RequestFormResultTable
```

Expected: FAIL — `.result-table__status--skipped` 요소가 없고, 결정 라벨이 `'통화'`가 아니라 `'curC'`로 나온다.

- [ ] **Step 4: 표기를 더한다**

`RequestFormResultTable.vue`의 `statusLabel`:

```javascript
const statusLabel: Record<FileResult['status'], string> = {
    APPLIED: '반영',
    BLOCKED: '차단',
    FAILED: '실패',
    SKIPPED: '대상 아님',
};
```

`fieldLabel`에 통화를 더한다(`ioeC` 바로 뒤):

```javascript
    curC: '통화',
```

`<style scoped>`에 중립색 수식어를 더한다. 기존 `.result-table__severity--blocker, …` 규칙
바로 앞에 넣는다:

```css
/* 대상 아님은 결함이 아니다. 실패(붉은색)와 반영(기본색) 어느 쪽과도 구분되게 중립색을 쓴다 */
.result-table__status--skipped {
    color: var(--p-surface-500);
}
```

`statusModifier`·`statusText`는 그대로 둔다 — `isReady`가 `SKIPPED`에 대해 false를 돌려주므로
(`readyToApply` 기본 구현이 `status === 'APPLIED'`) 수식어는 `--skipped`가 되고 문구는
`대상 아님`이 된다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd it_frontend && npm test -- RequestFormResultTable
```

Expected: PASS.

- [ ] **Step 6: `api.d.ts`에서 내 hunk만 스테이징한다**

이 파일에는 **다른 작업의 미커밋 변경**(결재자 변경 API 타입, 49줄)이 이미 얹혀 있다.
재생성하면 그 변경과 이번 `SKIPPED` 추가가 한 파일에 섞인다. 통째로 `git add`하면 남의 계약이
내 커밋에 딸려 들어간다.

컨트롤러가 작업 시작 전에 남의 hunk만 담은 패치를 떠 두었다
(`.superpowers/sdd/2026-08-18-request-form-import/api-dts-others.patch`, 역적용 가능 확인 완료).
그것을 워킹 파일에서 되돌린 상태로 스테이징한 뒤 워킹 파일을 원상복구한다:

```bash
cd it_frontend
cp app/types/api.d.ts ../.superpowers/sdd/2026-08-18-request-form-import/api-dts-both.bak
git apply -R ../.superpowers/sdd/2026-08-18-request-form-import/api-dts-others.patch
git add app/types/api.d.ts
cp ../.superpowers/sdd/2026-08-18-request-form-import/api-dts-both.bak app/types/api.d.ts
```

스테이징된 내용이 `SKIPPED` 한 줄만인지 반드시 확인한다:

```bash
git -C it_frontend diff --cached -- app/types/api.d.ts
```

Expected: `RequestFormFileStatus` enum 유니언에 `"SKIPPED"`가 더해지는 hunk **하나만** 보인다.
`approvers/{dcdSqn}`·`changePendingApprover`가 보이면 중단하고 컨트롤러에게 보고한다.

- [ ] **Step 7: 커밋**

`api.d.ts`는 Step 6에서 이미 스테이징했으므로 여기서 다시 `add`하지 않는다:

```bash
git -C it_frontend add app/components/migration/RequestFormResultTable.vue tests/unit/components/migration/RequestFormResultTable.test.ts
git -C it_frontend diff --cached --stat
git -C it_frontend commit -m 'feat: 반입 결과 표에 대상 아님 상태와 통화 결정 표기 추가'
```

Expected: `--stat`에 세 파일만(`api.d.ts`, `RequestFormResultTable.vue`, 그 테스트) 나온다.

---

### Task 6: 진단 줄에 파일 경로를 표기한다

부서 폴더 아래에 팀·사업 폴더가 더 있으면 한 부서 그룹에 파일이 여러 개 쌓인다. 진단 줄이
어느 파일의 것인지 알 수 없으므로 부서 폴더 이후 경로를 작은 글씨로 붙인다.

**Files:**
- Modify: `it_frontend/app/components/migration/RequestFormResultTable.vue`
- Test: `it_frontend/tests/unit/components/migration/RequestFormResultTable.test.ts`

**Interfaces:**
- Consumes: `FileResult.fileKey`, `DeptGroup.deptName` (기존)
- Produces:
  - 컴포넌트 내부 `subPathOf(fileKey: string): string` — 부서 폴더 다음 조각부터 이은 경로
  - CSS 클래스 `result-table__path` (Task 7이 클릭 대상으로 바꾼다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`RequestFormResultTable.test.ts`에 더한다:

```javascript
    it('진단 줄에 부서 폴더 이후 경로를 붙인다', () => {
        const wrapper = mountGroup({
            group: {
                deptName: 'IT기획부(180)',
                results: [
                    result({
                        fileKey: '2026/IT기획부(180)/팀1/사업1/요청서.xlsx',
                        diagnostics: [diagnostic()],
                    }),
                ],
            },
        });

        const path = wrapper.find('tbody tr .result-table__path');
        expect(path.text()).toBe('팀1/사업1/요청서.xlsx');
        expect(path.attributes('title')).toContain('2026/IT기획부(180)/팀1/사업1/요청서.xlsx');
    });

    it('같은 부서의 파일이 여럿이면 머리말에서도 경로로 구분한다', () => {
        const wrapper = mountGroup({
            group: {
                deptName: 'IT기획부(180)',
                results: [
                    result({ fileKey: '2026/IT기획부(180)/팀1/사업1/요청서.xlsx' }),
                    result({ fileKey: '2026/IT기획부(180)/팀1/사업2/요청서.xlsx' }),
                ],
            },
        });
        const header = wrapper.find('.result-table__files').text();

        expect(header).toContain('팀1/사업1/요청서.xlsx');
        expect(header).toContain('팀1/사업2/요청서.xlsx');
    });

    it('부서 폴더를 경로에서 찾지 못하면 전체 경로를 그대로 쓴다', () => {
        const wrapper = mountGroup({
            group: {
                deptName: '',
                results: [result({ fileKey: '요청서.xlsx', diagnostics: [diagnostic()] })],
            },
        });

        expect(wrapper.find('tbody tr .result-table__path').text()).toBe('요청서.xlsx');
    });
```

같은 파일의 기존 테스트 `'표에는 No·진단·결정 세 열만 둔다'`를 고친다. 경로가 이제 표 안에
들어가므로 그 단언이 뒤집힌다:

```javascript
    it('표에는 No·진단·결정 세 열만 둔다', () => {
        const wrapper = mountTable([result({ diagnostics: [diagnostic()] })]);

        expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual(['No', '진단', '결정']);
        // 파일 상태·건수는 표가 아니라 머리말에 있다. 경로만 진단 줄이 함께 짚어 준다
        expect(wrapper.find('tbody tr').text()).not.toContain('정보화사업 1건');
        expect(wrapper.find('tbody tr').text()).not.toContain('반영');
    });
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd it_frontend && npm test -- RequestFormResultTable
```

Expected: FAIL — `.result-table__path` 요소가 없다.

- [ ] **Step 3: 경로 계산과 표기를 넣는다**

`RequestFormResultTable.vue`의 `<script setup>`에서 `fileNameOf`를 대체한다:

```javascript
/**
 * 부서 폴더 다음 조각부터 이은 경로를 만든다.
 *
 * 부서명은 표 머리말에 이미 있고, 연도 폴더는 모든 파일이 공유해 구분에 쓸모가 없다. 남는 것은
 * 팀·사업 폴더와 파일명이고 그것이 곧 같은 부서 안에서 파일을 가르는 정보다.
 *
 * 부서 폴더를 경로에서 찾지 못하면(부서명이 비었거나 폴더 없이 파일만 고른 경우) 전체 경로를
 * 그대로 쓴다 — 아무것도 보여 주지 않는 것보다 낫다.
 */
function subPathOf(fileKey: string): string {
    const segments = fileKey.split('/');
    const deptIndex = segments.indexOf(props.group.deptName);
    if (deptIndex < 0) return fileKey;
    return segments.slice(deptIndex + 1).join('/');
}
```

`rows` computed에 경로를 담는다. `DiagnosticRow` 인터페이스에 필드를 더한다:

```javascript
interface DiagnosticRow {
    /** DataTable dataKey */
    rowKey: string;
    /** 부서 안 통 번호 */
    no: number;
    fileKey: string;
    /** 부서 폴더 이후 경로. 같은 부서에 파일이 여럿일 때 진단을 짚어 준다 */
    subPath: string;
    diagnostic: FormDiagnostic;
    /** 이 진단에 대해 사용자가 고른 값. 아직 고르지 않았으면 null */
    decidedValue: string | null;
    /** 파일이 바뀌는 첫 줄이면 true. 구분선을 넣습니다 */
    firstOfFile: boolean;
}
```

```javascript
const rows = computed<DiagnosticRow[]>(() => {
    let no = 0;
    return props.group.results.flatMap((result) =>
        result.diagnostics.map((diagnostic, index) => ({
            rowKey: `${result.fileKey}#${index}`,
            no: ++no,
            fileKey: result.fileKey,
            subPath: subPathOf(result.fileKey),
            diagnostic,
            decidedValue: props.decisions?.get(decisionKey(result.fileKey, diagnostic)) ?? null,
            firstOfFile: index === 0,
        })),
    );
});
```

템플릿에서 머리말의 `fileNameOf`를 바꾼다:

```html
                <span class="result-table__file-name">{{ subPathOf(result.fileKey) }}</span>
```

진단 열의 `result-table__message` **뒤**에 경로를 넣는다:

```html
                        <span class="result-table__message">{{ data.diagnostic.message }}</span>
                        <span class="result-table__path" :title="data.fileKey">
                            {{ data.subPath }}
                        </span>
```

스타일을 더한다(`.result-table__locator` 규칙 뒤):

```css
/* 경로는 진단 문구를 밀지 않도록 가장 작고 흐리게 둔다. 어느 파일인지 짚어 주는 보조 정보다 */
.result-table__path {
    flex: none;
    color: var(--p-surface-500);
    font-size: 0.75rem;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd it_frontend && npm test -- RequestFormResultTable
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git -C it_frontend add app/components/migration/RequestFormResultTable.vue tests/unit/components/migration/RequestFormResultTable.test.ts
git -C it_frontend diff --cached --stat
git -C it_frontend commit -m 'feat: 반입 진단 줄에 부서 폴더 이후 파일 경로 표기'
```

---

### Task 7: 경로를 클릭하면 원본 파일 사본을 연다

브라우저는 `http(s)` 문서에서 `file:///C:/…`를 열 수 없고, 고른 폴더의 실제 경로도 페이지에
노출되지 않는다. 대신 업로드 대상 `File` 객체가 메모리에 있으므로 그것으로 사본을 연다.

**Files:**
- Modify: `it_frontend/app/composables/migration/useRequestFormUpload.ts`
- Modify: `it_frontend/app/components/migration/RequestFormResultTable.vue`
- Modify: `it_frontend/app/pages/admin/migration/requests.vue`
- Modify: `it_frontend/i18n/messages/migration.ts`
- Test: `it_frontend/tests/unit/composables/migration/useRequestFormUpload.test.ts`
- Test: `it_frontend/tests/unit/components/migration/RequestFormResultTable.test.ts`

**Interfaces:**
- Consumes: `SelectedFile[]` (기존 `collectFiles` 결과)
- Produces:
  - `export function openSelectedFile(files: SelectedFile[], fileKey: string): boolean` — 모듈 수준 순수 함수. 테스트가 직접 부른다
  - `useRequestFormUpload()` 반환에 `openSourceFile: (fileKey: string) => boolean`
  - `RequestFormResultTable` prop `openSourceFile?: (fileKey: string) => boolean`
  - i18n 키 `migration.bulkImport.result.openSourceFile`

- [ ] **Step 1: 실패하는 테스트를 쓴다 (composable)**

`useRequestFormUpload.test.ts`의 import를 고치고 describe 블록을 더한다:

```javascript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    BATCH_SIZE,
    chunk,
    collectFiles,
    openSelectedFile,
} from '~/composables/migration/useRequestFormUpload';
```

파일 끝에 더한다:

```javascript
describe('openSelectedFile', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('상대경로가 같은 파일의 사본을 열고 true를 돌려준다', () => {
        const selected = collectFiles([fileWith('2026/IT기획부(180)/팀1/요청서.xlsx')]);
        const createObjectURL = vi
            .spyOn(URL, 'createObjectURL')
            .mockReturnValue('blob:mock-url');
        const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        const opened = openSelectedFile(selected, '2026/IT기획부(180)/팀1/요청서.xlsx');

        expect(opened).toBe(true);
        expect(createObjectURL).toHaveBeenCalledWith(selected[0]!.file);
        expect(click).toHaveBeenCalledOnce();
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('목록에 없는 경로면 아무것도 열지 않고 false를 돌려준다', () => {
        const selected = collectFiles([fileWith('2026/IT기획부(180)/요청서.xlsx')]);
        const createObjectURL = vi.spyOn(URL, 'createObjectURL');

        expect(openSelectedFile(selected, '없는/경로.xlsx')).toBe(false);
        expect(createObjectURL).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: 실패하는 테스트를 쓴다 (컴포넌트)**

`RequestFormResultTable.test.ts`에 더한다. 파일 상단 import에 `vi`를 더한다
(`import { describe, expect, it, vi } from 'vitest';`), 그리고 `mountGroup`의 props 타입에
`openSourceFile`을 더한다:

```javascript
function mountGroup(props: {
    group: DeptGroup;
    decisions?: Map<string, string>;
    readyToApply?: (result: FileResult) => boolean;
    openSourceFile?: (fileKey: string) => boolean;
}) {
```

테스트를 더한다:

```javascript
    it('경로를 클릭하면 그 파일 키로 원본 열기를 요청한다', async () => {
        const openSourceFile = vi.fn(() => true);
        const wrapper = mountGroup({
            group: {
                deptName: 'IT기획부(180)',
                results: [
                    result({
                        fileKey: '2026/IT기획부(180)/팀1/요청서.xlsx',
                        diagnostics: [diagnostic()],
                    }),
                ],
            },
            openSourceFile,
        });

        await wrapper.find('tbody tr .result-table__path').trigger('click');

        expect(openSourceFile).toHaveBeenCalledWith('2026/IT기획부(180)/팀1/요청서.xlsx');
    });

    it('원본 열기 수단이 없으면 경로를 클릭 대상으로 만들지 않는다', () => {
        const wrapper = mountGroup({
            group: {
                deptName: 'IT기획부(180)',
                results: [
                    result({
                        fileKey: '2026/IT기획부(180)/팀1/요청서.xlsx',
                        diagnostics: [diagnostic()],
                    }),
                ],
            },
        });

        expect(wrapper.find('tbody tr button.result-table__path').exists()).toBe(false);
        expect(wrapper.find('tbody tr .result-table__path').exists()).toBe(true);
    });
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

```bash
cd it_frontend && npm test -- useRequestFormUpload RequestFormResultTable
```

Expected: FAIL — `openSelectedFile`가 export되지 않아 import 오류, 컴포넌트 클릭 테스트도 실패.

- [ ] **Step 4: `openSelectedFile`을 만든다**

`useRequestFormUpload.ts`의 `chunk` 함수 **뒤**에 더한다:

```javascript
/**
 * 고른 파일의 사본을 새 탭으로 엽니다.
 *
 * 원본 경로(`C:\…`)를 그대로 여는 것은 불가능합니다 — 브라우저는 `http(s)` 문서에서 `file://`
 * 링크를 따라가지 않고, 고른 폴더의 실제 경로도 페이지에 노출되지 않습니다(`webkitRelativePath`는
 * 고른 폴더 기준의 상대경로뿐입니다). 대신 업로드 대상 `File`이 메모리에 있으므로 그것으로
 * blob URL을 만들어 사본을 엽니다.
 *
 * @param files 선택 목록
 * @param fileKey 열려는 파일의 상대경로
 * @returns 열었으면 true. 목록에 없으면 아무것도 하지 않고 false
 */
export function openSelectedFile(files: SelectedFile[], fileKey: string): boolean {
    const selected = files.find((item) => item.fileKey === fileKey);
    if (!selected) return false;

    const url = URL.createObjectURL(selected.file);
    const anchor = document.createElement('a');
    anchor.href = url;
    // 엑셀은 브라우저가 표시할 수 없으므로 저장으로 넘긴다. 원본 파일명을 유지해 어느 파일인지 남긴다
    anchor.download = selected.file.name;
    anchor.rel = 'noopener';
    anchor.click();
    // 즉시 해제하면 브라우저가 읽기 전에 사라지는 환경이 있어 다음 태스크로 미룬다
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
}
```

`useRequestFormUpload()` 안, `reset` 정의 뒤에 래퍼를 더한다:

```javascript
    /**
     * 결과 표에서 진단이 가리키는 파일의 사본을 엽니다.
     *
     * @param fileKey 파일 상대경로
     * @returns 열었으면 true. 선택이 초기화되어 파일이 없으면 false
     */
    function openSourceFile(fileKey: string): boolean {
        return openSelectedFile(files.value, fileKey);
    }
```

반환 객체에 `openSourceFile`을 더한다(`reset` 뒤):

```javascript
        reset,
        openSourceFile,
    };
```

- [ ] **Step 5: i18n 문구를 더한다**

`i18n/messages/migration.ts`의 **한국어** `bulkImport.result` 블록에서 `seeGuide` 뒤에 넣는다:

```javascript
                    openSourceFile: '원본 파일 사본 열기',
```

**영어** 블록(`seeGuide: 'See the guide',` 다음 줄, `units:` 앞)에 넣는다:

```javascript
                    openSourceFile: 'Open a copy of the source file',
```

두 블록의 키 집합이 같아야 타입 검사가 통과한다.

- [ ] **Step 6: 컴포넌트를 클릭 가능하게 만든다**

`RequestFormResultTable.vue`의 `defineProps`에 더한다:

```javascript
const props = defineProps<{
    /** 이 표가 담당할 부서와 그 부서의 파일별 결과 */
    group: DeptGroup;
    /** 결정 키 → 사용자가 고른 값. 고른 값을 그 자리에 되비추고 해소된 진단을 가려냅니다 */
    decisions?: Map<string, string>;
    /** 반영 대상 판정. 결정으로 차단이 모두 풀린 파일도 대상입니다 */
    readyToApply?: (result: FileResult) => boolean;
    /**
     * 원본 파일 사본 열기. 없으면 경로를 표기만 하고 클릭 대상으로 만들지 않습니다 —
     * 동작하지 않는 링크를 두지 않기 위해서입니다
     */
    openSourceFile?: (fileKey: string) => boolean;
}>();
```

진단 열의 경로 표기를 갈래로 나눈다:

```html
                        <span class="result-table__message">{{ data.diagnostic.message }}</span>
                        <button
                            v-if="props.openSourceFile"
                            type="button"
                            class="result-table__path result-table__path--link"
                            :title="`${data.fileKey}\n${t('migration.bulkImport.result.openSourceFile')}`"
                            @click="props.openSourceFile(data.fileKey)"
                        >
                            {{ data.subPath }}
                        </button>
                        <span v-else class="result-table__path" :title="data.fileKey">
                            {{ data.subPath }}
                        </span>
```

스타일을 더한다(`.result-table__path` 규칙 뒤):

```css
.result-table__path--link {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
}
```

- [ ] **Step 7: 화면에 배선한다**

`app/pages/admin/migration/requests.vue`의 `<RequestFormResultTable …>`에 한 줄을 더한다:

```html
        <RequestFormResultTable
            v-for="group in page.deptGroups.value"
            :key="group.deptName"
            :group="group"
            :decisions="page.decisions.value"
            :ready-to-apply="page.isReadyToApply"
            :open-source-file="page.upload.openSourceFile"
            @cell-override="page.applyCellOverride"
            @unit-decision="page.applyUnitDecision"
        />
```

- [ ] **Step 8: 테스트가 통과하는지 확인한다**

```bash
cd it_frontend && npm test -- useRequestFormUpload RequestFormResultTable
```

Expected: PASS.

- [ ] **Step 9: 커밋**

```bash
git -C it_frontend add app/composables/migration/useRequestFormUpload.ts app/components/migration/RequestFormResultTable.vue app/pages/admin/migration/requests.vue i18n/messages/migration.ts tests/unit/composables/migration/useRequestFormUpload.test.ts tests/unit/components/migration/RequestFormResultTable.test.ts
git -C it_frontend diff --cached --stat
git -C it_frontend commit -m 'feat: 반입 진단의 파일 경로를 눌러 원본 사본을 열 수 있게 함'
```

---

### Task 8: 전체 게이트 통과와 버전 잠금 갱신

네 저장소가 함께 움직이는 프로젝트이므로 마지막에 게이트를 전량 돌리고 호환 커밋 조합을
기록한다.

**Files:**
- Modify: `versions.lock` (스크립트가 갱신)

**Interfaces:**
- Consumes: Task 1~7의 커밋
- Produces: 없음

- [ ] **Step 1: 백엔드 게이트**

```bash
cd it_backend && ./gradlew check
```

Expected: **내 변경으로 인한 신규 실패 0건.** BUILD SUCCESSFUL이 아닐 수 있다 —
이 워킹트리에는 동시 진행 중인 다른 작업의 미커밋 코드가 있고, 그것이 아키텍처 게이트 2건을
이미 깨 놓았다(Task 4 시점 실측):

- `MaxLinesRatchetTest` — `ApplicationService.java`가 ratchet 기준 804줄인데 워킹트리는 837줄
  (HEAD는 804줄. 즉 미커밋 변경이 33줄을 늘렸다)
- `RequestParameterNamingTest` — `ApplicationController.java`가 264줄 → 281줄
  (신규 `changePendingApprover` 엔드포인트)

이 두 건 **말고** 다른 실패가 나오면 그것은 내 변경 탓이므로 고친다. 두 건만 나오면 통과로 본다.
판정 근거를 남기려면 실패한 테스트 이름과 위 줄 수 대조를 보고서에 적는다:

```bash
cd it_backend && wc -l src/main/java/com/kdb/it/common/approval/service/ApplicationService.java && git show HEAD:src/main/java/com/kdb/it/common/approval/service/ApplicationService.java | wc -l
```

내 변경분만 좁혀 확인하려면:

```bash
cd it_backend && ./gradlew test --tests '*RequestForm*' --tests '*FormAdapter*' --tests '*CapitalOverview*' --tests '*MigrationIoeCatalog*'
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 2: 프론트 게이트**

```bash
cd it_frontend && npm run format:check && npm run check && npm test
```

Expected: 세 명령 모두 성공. `npm run check`는 타입 검사·ESLint·고정 문구 ratchet을 함께 돈다. ratchet이 새 리터럴을 잡으면 그 문구를 i18n 키로 옮긴다.

- [ ] **Step 3: 계약 드리프트 확인**

백엔드를 띄운 상태에서:

```bash
cd it_frontend && npm run codegen:check
```

Expected: 드리프트 없음. 실패하면 `npm run codegen`으로 재생성하고 `app/types/api.d.ts`를 커밋한다.

- [ ] **Step 4: 버전 잠금 갱신과 커밋**

```bash
pwsh -File scripts/update-versions-lock.ps1
git add versions.lock
git diff --cached --stat
git commit -m 'chore: 편성요청서 반입 개선 호환 버전 갱신'
```

(`pwsh`가 없으면 `powershell -File scripts/update-versions-lock.ps1`을 쓴다.)

---

## 부록: 수동 확인 시나리오

게이트를 통과한 뒤 실제 화면에서 확인한다. 두 서버를 모두 띄우고
`http://localhost:3000/admin/migration/requests`로 간다.

1. `2026/부서명(코드)/팀1/사업1/요청서.xlsx` 구조로 폴더를 만들어 끌어다 놓는다.
   진단 줄마다 `팀1/사업1/요청서.xlsx`가 붙는지, 클릭하면 그 파일이 내려받아지는지 본다.
2. 같은 폴더에 편성요청서가 아닌 엑셀을 하나 넣는다. 결과 목록에 회색 `대상 아님`으로
   뜨고 붉은 `실패`가 아닌지, 요약의 차단 건수가 늘지 않는지 본다.
3. 시트 ③의 통화 칸을 하나 비운다. 그 행에 `N행` 좌표와 함께 통화 선택 상자가 뜨고,
   고르면 진단이 취소선으로 바뀌며 [반영] 버튼이 열리는지 본다.
4. 시트 ③이 전부 외화인 파일을 올린다. `금액 단위를 … 추정했습니다` 경고가 뜨지 않는지 본다.
5. 1-1의 전결권자에 코드표에 없는 이름을 적는다. 결정 열에 전결권자 선택 상자가 뜨는지 본다.
