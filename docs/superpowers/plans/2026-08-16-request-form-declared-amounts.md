# 편성요청서 반입 — 정보화사업 금액 3종 선언값 산출 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 편성요청서 일괄 반입에서 정보화사업의 `TOT_RQM_AMT`·`MPL_AMT`·`DFR_AMT`를 1-2 품목 합계가 아니라 1-1 시트의 선언 금액(`총 사업금액(전체기간)`, `'26년도 이후`, `'26년도 합계`)에서 산출해 기록한다.

**Architecture:** `CapitalOverviewReader`가 1-1에서 세 값을 **단위 미확정 raw**로 읽고, `CapitalProjectFormAdapter`가 1-2 품목 합계와 대사해 얻은 배수로 원 단위로 환산한 뒤 산식을 적용한다. 결과는 `FormAdapterOutput`의 `projects`와 길이가 같은 병렬 리스트 `projectAmounts`로 실려 `RequestFormFileImporter`까지 가고, importer가 `createProject` 직후 이관 전용 `ProjectService.assignDeclaredAmounts`로 덮어쓴다. 환산 근거가 없으면 금액을 적재하지 않고 경고만 남긴다 — 파일 자체는 그대로 반영된다.

**Tech Stack:** Java 25 / Spring Boot 4.1 / JPA / Apache POI / JUnit 5 + Mockito + AssertJ

## Global Constraints

- 설계 SoT: [docs/superpowers/specs/2026-08-16-request-form-declared-amounts-design.md](../specs/2026-08-16-request-form-declared-amounts-design.md)
- **백엔드(`it_backend`)만 수정한다.** 프론트 변경 없음, DB 스키마 변경 없음, Flyway 스크립트 없음.
- **공개 API 계약을 바꾸지 않는다.** `ProjectDto.CreateRequest`/`Response`, `RequestFormDto`, `RequestFormDiagnosticCode`에 필드·enum 값을 추가하지 않는다. OpenAPI가 바뀌면 프론트 `codegen`까지 파급된다.
- 진단은 기존 `RequestFormDiagnosticCode.AMOUNT_MISMATCH`(WARNING)만 쓴다. 새 코드를 만들지 않는다.
- 대상은 **정보화사업(`CapitalProjectFormAdapter`)뿐이다.** 경상사업(`RecurringProjectFormAdapter`)·전산업무비(`GeneralExpenseFormAdapter`)는 건드리지 않는다.
- 신규 주석은 모두 한글. public 메서드 JavaDoc에 입력값·반환값·실패 조건을 기록한다(`it_backend/CLAUDE.md` §9).
- 명령: `cd it_backend && ./gradlew test --no-daemon`. Oracle 통합은 `./gradlew integrationTest --no-daemon`.
- 포맷 게이트는 Spotless다. 커밋 전 `./gradlew spotlessApply --no-daemon`을 돌린다.
- 커밋은 `it_backend` 저장소 안에서 한다(루트 `C:\it`는 문서만 추적).

### 픽스처 기준값 (여러 태스크가 참조)

`RequestFormFixtures.fullFormXls()`의 1-1 시트 값이다. 모든 태스크의 기대값은 이 숫자에서 나온다.

| 항목 | 시트 기재값 | 원 단위 환산 |
| --- | --- | --- |
| `총 사업금액(전체기간)` | `2,000백만원` (문자열) | `2000000000` |
| `'26년도 합계` (총 계 행) | `1265624700` | `1265624700` |
| `'26년도 이후` (총 계 행) | **빈칸** (데이터 행도 빈칸) | `0` |
| 1-2 품목 합계 | — | `1265624700` |

배수 판정: `inferUnit(1265624700, 1265624700)` → `AmountUnit.WON`.
산출: `TOT_RQM_AMT=2000000000`, `MPL_AMT=0`, `DFR_AMT=2000000000 − 0 − 1265624700 = 734375300`.

---

### Task 1: `ProjectAmounts`와 `FormAdapterOutput` 전달 통로

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/ProjectAmounts.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/FormAdapterOutput.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/FormAdapterOutputTest.java`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `ProjectAmounts(BigDecimal totRqmAmt, BigDecimal mplAmt, BigDecimal dfrAmt)` — record
  - `ProjectAmounts.none()` → 3필드 null인 공유 인스턴스
  - `ProjectAmounts.isPresent()` → `boolean` (`totRqmAmt != null`)
  - `FormAdapterOutput`의 5번째 컴포넌트 `List<ProjectAmounts> projectAmounts()`
  - 기존 4-인자 생성자는 편의 생성자로 유지 (`none()`으로 채워 위임)

- [ ] **Step 1: 실패하는 테스트 작성**

`FormAdapterOutputTest`에 추가한다. 기존 헬퍼 `project(String)`이 이 클래스에 이미 있다(`FormAdapterOutputTest.java:91`에서 사용 중).

```java
    @Test
    @DisplayName("4-인자 생성자는 사업마다 선언 금액 없음을 채운다")
    void fourArgConstructorFillsNoneForEachProject() {
        FormAdapterOutput output =
                new FormAdapterOutput(
                        List.of(project("사업1"), project("사업2")), List.of(), List.of(), null);

        assertThat(output.projectAmounts()).hasSize(2);
        assertThat(output.projectAmounts()).allMatch(amounts -> !amounts.isPresent());
    }

    @Test
    @DisplayName("선언 금액 목록의 길이가 사업 목록과 다르면 생성 자체를 거부한다")
    void rejectsMismatchedAmountsSize() {
        assertThatThrownBy(
                        () ->
                                new FormAdapterOutput(
                                        List.of(project("사업1")),
                                        List.of(),
                                        List.of(),
                                        null,
                                        List.of()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("길이가 같아야");
    }

    @Test
    @DisplayName("합칠 때 선언 금액도 사업과 같은 순서로 이어 붙인다")
    void mergeKeepsAmountsAlignedWithProjects() {
        FormAdapterOutput left =
                new FormAdapterOutput(
                        List.of(project("사업1")),
                        List.of(),
                        List.of(),
                        null,
                        List.of(
                                new ProjectAmounts(
                                        new BigDecimal("100"),
                                        new BigDecimal("20"),
                                        new BigDecimal("30"))));
        FormAdapterOutput right =
                new FormAdapterOutput(List.of(project("사업2")), List.of(), List.of(), null);

        FormAdapterOutput merged = left.merge(right);

        assertThat(merged.projects()).hasSize(2);
        assertThat(merged.projectAmounts()).hasSize(2);
        assertThat(merged.projectAmounts().get(0).dfrAmt()).isEqualByComparingTo("30");
        assertThat(merged.projectAmounts().get(1).isPresent()).isFalse();
    }

    @Test
    @DisplayName("빈 산출물의 선언 금액도 비어 있다")
    void emptyHasNoAmounts() {
        assertThat(FormAdapterOutput.empty().projectAmounts()).isEmpty();
    }
```

import를 추가한다: `static org.assertj.core.api.Assertions.assertThatThrownBy`, `java.math.BigDecimal`.

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*FormAdapterOutputTest"
```

Expected: FAIL — `cannot find symbol: class ProjectAmounts`

- [ ] **Step 3: `ProjectAmounts` 작성**

`it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/ProjectAmounts.java`:

```java
package com.kdb.it.domain.migration.request.service.adapter;

import java.math.BigDecimal;

/**
 * 편성요청서 1-1이 선언한 사업 단위 금액입니다.
 *
 * <p>품목 합계에서 파생하지 않고 <b>시트에 적힌 값</b>에서 산출합니다. 총 예산은 전체기간 기준이라 예산연도 품목 합계보다 크고, 기 지급예산은 그 차액에서
 * 예산연도 이후 계획분을 뺀 값입니다. 두 성질 모두 품목 합산으로는 얻을 수 없어 별도 통로로 나릅니다.
 *
 * <p>환산 근거를 확보하지 못한 파일은 {@link #none()}을 실어 보내고, 반입은 기존 동작(품목 합계 스냅샷)을 그대로 씁니다.
 *
 * @param totRqmAmt 총소요금액 — 1-1 `총 사업금액(전체기간)` (원 단위)
 * @param mplAmt 예정금액 — 1-1 요약표 `'26년도 이후` 합계 (원 단위)
 * @param dfrAmt 지급금액 — `총 사업금액 − '26년도 이후 − '26년도 합계` (원 단위)
 */
public record ProjectAmounts(BigDecimal totRqmAmt, BigDecimal mplAmt, BigDecimal dfrAmt) {

    /** 선언 금액을 산출하지 못한 상태. 3필드 모두 null이라 공유 인스턴스로 둡니다. */
    private static final ProjectAmounts NONE = new ProjectAmounts(null, null, null);

    /**
     * 선언 금액이 없는 자리표시자를 반환합니다.
     *
     * @return 3필드가 모두 null인 불변 인스턴스
     */
    public static ProjectAmounts none() {
        return NONE;
    }

    /**
     * 기록할 선언 금액이 있는지 판정합니다.
     *
     * <p>세 값은 항상 함께 정해지거나 함께 비므로 대표값 하나만 봅니다.
     *
     * @return 산출에 성공했으면 true
     */
    public boolean isPresent() {
        return totRqmAmt != null;
    }
}
```

- [ ] **Step 4: `FormAdapterOutput`에 컴포넌트와 편의 생성자 추가**

파일 전체를 아래로 교체한다.

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.request.dto.AmountUnit;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import java.util.ArrayList;
import java.util.List;

/**
 * 어댑터 1회 실행의 산출물입니다.
 *
 * <p>원장을 직접 만들지 않고 <b>기존 서비스에 넘길 생성 요청</b>만 조립합니다. 새 INSERT 경로를 만들면 채번·조직명 스냅샷·감사로그를 전부 다시 구현해야
 * 합니다.
 *
 * <p>{@code projectAmounts}는 {@code projects}와 <b>인덱스가 대응하는 병렬 목록</b>입니다. 생성자가 길이 일치를 강제하고
 * {@link #merge}가 두 목록을 같은 순서로 이어 붙여 대응을 유지합니다. 요청 DTO에 금액 필드를 얹지 않는 이유는 그러면 공개 API로 스냅샷을 주입할 수 있게
 * 되기 때문입니다.
 *
 * @param projects 생성할 사업 요청 (품목 포함)
 * @param costs 생성할 전산업무비 요청
 * @param diagnostics 어댑터가 낸 해석 진단
 * @param suggestedGeneralExpenseUnit 시트 ③ 단위 제안값. 시트 ③이 없으면 null
 * @param projectAmounts 사업별 1-1 선언 금액. {@code projects}와 길이·순서가 같습니다
 */
public record FormAdapterOutput(
        List<ProjectDto.CreateRequest> projects,
        List<CostDto.CreateRequest> costs,
        List<RequestFormDto.FormDiagnostic> diagnostics,
        AmountUnit suggestedGeneralExpenseUnit,
        List<ProjectAmounts> projectAmounts) {

    public FormAdapterOutput {
        if (projectAmounts.size() != projects.size()) {
            throw new IllegalArgumentException(
                    "선언 금액 목록은 사업 목록과 길이가 같아야 합니다: projects=%d, projectAmounts=%d"
                            .formatted(projects.size(), projectAmounts.size()));
        }
    }

    /**
     * 선언 금액을 내지 않는 어댑터용 생성자입니다.
     *
     * <p>사업마다 {@link ProjectAmounts#none()}을 채웁니다. 1-1 선언 금액은 정보화사업 어댑터만 산출하므로, 나머지 어댑터가 빈 목록을 손으로
     * 만들지 않게 합니다.
     *
     * @param projects 생성할 사업 요청
     * @param costs 생성할 전산업무비 요청
     * @param diagnostics 어댑터가 낸 해석 진단
     * @param suggestedGeneralExpenseUnit 시트 ③ 단위 제안값. 없으면 null
     */
    public FormAdapterOutput(
            List<ProjectDto.CreateRequest> projects,
            List<CostDto.CreateRequest> costs,
            List<RequestFormDto.FormDiagnostic> diagnostics,
            AmountUnit suggestedGeneralExpenseUnit) {
        this(
                projects,
                costs,
                diagnostics,
                suggestedGeneralExpenseUnit,
                projects.stream().map(project -> ProjectAmounts.none()).toList());
    }

    /**
     * 산출물이 없는 결과를 만듭니다.
     *
     * @return 빈 산출물
     */
    public static FormAdapterOutput empty() {
        return new FormAdapterOutput(List.of(), List.of(), List.of(), null);
    }

    /**
     * 다른 어댑터의 산출물과 합칩니다.
     *
     * @param other 합칠 산출물
     * @return 합쳐진 산출물. 단위 제안값은 null이 아닌 쪽을 남깁니다
     */
    public FormAdapterOutput merge(FormAdapterOutput other) {
        List<ProjectDto.CreateRequest> mergedProjects = new ArrayList<>(projects);
        mergedProjects.addAll(other.projects());
        List<CostDto.CreateRequest> mergedCosts = new ArrayList<>(costs);
        mergedCosts.addAll(other.costs());
        List<RequestFormDto.FormDiagnostic> mergedDiagnostics = new ArrayList<>(diagnostics);
        mergedDiagnostics.addAll(other.diagnostics());
        List<ProjectAmounts> mergedAmounts = new ArrayList<>(projectAmounts);
        mergedAmounts.addAll(other.projectAmounts());
        return new FormAdapterOutput(
                List.copyOf(mergedProjects),
                List.copyOf(mergedCosts),
                List.copyOf(mergedDiagnostics),
                suggestedGeneralExpenseUnit != null
                        ? suggestedGeneralExpenseUnit
                        : other.suggestedGeneralExpenseUnit(),
                List.copyOf(mergedAmounts));
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

기존 4-인자 호출부(운영 6곳 + 테스트 12곳)가 편의 생성자로 그대로 컴파일되는지 함께 본다.

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*FormAdapterOutputTest" --tests "*FormAdapter*Test" --tests "*RequestFormValidatorTest"
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd it_backend && ./gradlew spotlessApply --no-daemon && git add src/main/java/com/kdb/it/domain/migration/request/service/adapter src/test/java/com/kdb/it/domain/migration/request/service/adapter/FormAdapterOutputTest.java && git commit -m "feat: 편성요청서 어댑터 산출물에 사업별 선언 금액 통로 추가"
```

---

### Task 2: 1-1 선언 금액 읽기 (`CapitalOverviewReader`)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReader.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReaderTest.java`

**Interfaces:**
- Consumes: 없음 (Task 1과 독립)
- Produces:
  - `CapitalOverviewReader.DeclaredAmounts(BigDecimal wholePeriodWon, BigDecimal wholePeriodRaw, boolean wholePeriodUnknownUnit, BigDecimal yearTotalRaw, BigDecimal laterTotalRaw)` — record
  - `CapitalOverviewReader.Result`의 3번째 컴포넌트가 `BigDecimal declaredYearTotal` → `DeclaredAmounts amounts`로 바뀜

**의미 규약 (Task 3이 이 규약대로 분기한다):**

| 상태 | 필드 | 뜻 |
| --- | --- | --- |
| `wholePeriodWon != null` | 접미사로 원 단위 확정 | 요약표 배수를 적용하지 **않는다** |
| `wholePeriodWon == null && wholePeriodRaw != null` | 접미사 없는 숫자 | 요약표 배수를 적용한다 |
| `wholePeriodUnknownUnit == true` | 값은 있는데 해석 실패(`20억원`, `미정`) | 산출 불가 — 배수 폴백 금지 |
| 셋 다 비고 `unknownUnit == false` | 라벨·값이 없음 | 산출 불가 |

- [ ] **Step 1: 실패하는 테스트 작성**

`CapitalOverviewReaderTest`에 추가한다. 이 클래스의 `overviewSheet(Map)` 헬퍼는 **라벨 C열(2)·값 D열(3)**만 놓으므로, 요약표를 만드는 별도 헬퍼가 필요하다. 아래 헬퍼를 클래스 하단(`deadlineOf` 위)에 추가한다.

```java
    /**
     * 요약표가 있는 1-1 시트를 만듭니다.
     *
     * <p>레이아웃은 실 제출본과 같습니다 — 헤더 행에 `'26년도 합계`(6열)·`'26년도 이후`(7열)를 놓고 데이터 행 2개 아래에 `총 계` 행을 둡니다.
     *
     * @param wholePeriod `총 사업금액(전체기간)` 칸에 적을 문자열. null이면 칸을 만들지 않습니다
     * @param totalRowValues 총 계 행의 {열 번호 → 값}. 비워 두면 그 칸이 빈칸이 됩니다
     * @param dataRowValues 데이터 행 2개의 {열 번호 → 값 2개}. 비워 두면 그 칸이 빈칸이 됩니다
     */
    private static Sheet summarySheet(
            String wholePeriod,
            Map<Integer, Double> totalRowValues,
            Map<Integer, double[]> dataRowValues) {
        try (Workbook wb = new HSSFWorkbook()) {
            Sheet sheet = wb.createSheet("① (정보화사업) 1-1. 정보화사업 개요");
            Row labelRow = sheet.createRow(0);
            cell(labelRow, 2).setCellValue("사업명");
            cell(labelRow, 3).setCellValue("사업");
            if (wholePeriod != null) {
                Row amountRow = sheet.createRow(1);
                cell(amountRow, 7).setCellValue("총 사업금액(전체기간)");
                cell(amountRow, 9).setCellValue(wholePeriod);
            }
            Row header = sheet.createRow(2);
            cell(header, 6).setCellValue("'26년도 합계");
            cell(header, 7).setCellValue("'26년도 이후");
            cell(header, 8).setCellValue("전체 합계");
            for (int offset = 0; offset < 2; offset++) {
                Row dataRow = sheet.createRow(3 + offset);
                cell(dataRow, 0).setCellValue(offset == 0 ? "자본예산" : "일반관리비");
                for (Map.Entry<Integer, double[]> entry : dataRowValues.entrySet()) {
                    cell(dataRow, entry.getKey()).setCellValue(entry.getValue()[offset]);
                }
            }
            Row totalRow = sheet.createRow(5);
            cell(totalRow, 0).setCellValue("총 계");
            for (Map.Entry<Integer, Double> entry : totalRowValues.entrySet()) {
                cell(totalRow, entry.getKey()).setCellValue(entry.getValue());
            }
            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                wb.write(out);
                return new HSSFWorkbook(new java.io.ByteArrayInputStream(out.toByteArray()))
                        .getSheetAt(0);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private CapitalOverviewReader.DeclaredAmounts amountsOf(Sheet sheet) {
        return reader.read(sheet, context(Map.of()), FormCatalogs.empty()).amounts();
    }
```

그리고 테스트 메서드를 추가한다.

```java
    @Test
    @DisplayName("요약표의 두 컬럼을 총 계 행에서 읽는다")
    void readsSummaryColumnsFromTotalRow() {
        Sheet sheet =
                summarySheet(
                        "2,000백만원",
                        Map.of(6, 1_265_624_700d, 7, 500_000_000d),
                        Map.of());

        CapitalOverviewReader.DeclaredAmounts amounts = amountsOf(sheet);

        assertThat(amounts.yearTotalRaw()).isEqualByComparingTo("1265624700");
        assertThat(amounts.laterTotalRaw()).isEqualByComparingTo("500000000");
    }

    @Test
    @DisplayName("총 계 행의 칸이 비면 데이터 행을 더해 채운다")
    void sumsDataRowsWhenTotalCellBlank() {
        // 실측 제출본에 `'26년도 이후`만 총 계 행이 비어 있는 파일이 있다
        Sheet sheet =
                summarySheet(
                        "2,000백만원",
                        Map.of(6, 1_265_624_700d),
                        Map.of(7, new double[] {300_000_000d, 200_000_000d}));

        assertThat(amountsOf(sheet).laterTotalRaw()).isEqualByComparingTo("500000000");
    }

    @Test
    @DisplayName("총 계 행과 데이터 행이 모두 비면 그 컬럼은 null이다")
    void leavesColumnNullWhenNothingWritten() {
        Sheet sheet = summarySheet("2,000백만원", Map.of(6, 1_265_624_700d), Map.of());

        assertThat(amountsOf(sheet).laterTotalRaw()).isNull();
    }

    @Test
    @DisplayName("요약표가 없으면 두 컬럼 모두 null이다")
    void leavesSummaryNullWhenAbsent() {
        CapitalOverviewReader.DeclaredAmounts amounts =
                amountsOf(overviewSheet(Map.of("사업명", "사업")));

        assertThat(amounts.yearTotalRaw()).isNull();
        assertThat(amounts.laterTotalRaw()).isNull();
    }

    @Test
    @DisplayName("총 사업금액의 단위 접미사를 원 단위로 편다")
    void parsesWholePeriodUnitSuffix() {
        assertThat(amountsOf(summarySheet("2,000백만원", Map.of(), Map.of())).wholePeriodWon())
                .isEqualByComparingTo("2000000000");
        assertThat(amountsOf(summarySheet("1,500천원", Map.of(), Map.of())).wholePeriodWon())
                .isEqualByComparingTo("1500000");
        assertThat(amountsOf(summarySheet("1,265,624,700원", Map.of(), Map.of())).wholePeriodWon())
                .isEqualByComparingTo("1265624700");
    }

    @Test
    @DisplayName("접미사가 없으면 원 단위로 확정하지 않고 기재값만 남긴다")
    void keepsRawWhenNoSuffix() {
        CapitalOverviewReader.DeclaredAmounts amounts =
                amountsOf(summarySheet("2000", Map.of(), Map.of()));

        assertThat(amounts.wholePeriodWon()).isNull();
        assertThat(amounts.wholePeriodRaw()).isEqualByComparingTo("2000");
        assertThat(amounts.wholePeriodUnknownUnit()).isFalse();
    }

    @Test
    @DisplayName("모르는 접미사는 배수 폴백을 막기 위해 해석 실패로 표시한다")
    void flagsUnknownSuffix() {
        // `20억원`을 요약표 배수로 환산하면 100배 틀린 값이 조용히 들어간다
        CapitalOverviewReader.DeclaredAmounts unknown =
                amountsOf(summarySheet("20억원", Map.of(), Map.of()));
        assertThat(unknown.wholePeriodWon()).isNull();
        assertThat(unknown.wholePeriodRaw()).isNull();
        assertThat(unknown.wholePeriodUnknownUnit()).isTrue();

        CapitalOverviewReader.DeclaredAmounts text =
                amountsOf(summarySheet("미정", Map.of(), Map.of()));
        assertThat(text.wholePeriodUnknownUnit()).isTrue();
    }

    @Test
    @DisplayName("총 사업금액 칸이 없으면 해석 실패가 아니라 미기재로 둔다")
    void leavesWholePeriodEmptyWhenLabelAbsent() {
        CapitalOverviewReader.DeclaredAmounts amounts =
                amountsOf(summarySheet(null, Map.of(6, 100d), Map.of()));

        assertThat(amounts.wholePeriodWon()).isNull();
        assertThat(amounts.wholePeriodRaw()).isNull();
        assertThat(amounts.wholePeriodUnknownUnit()).isFalse();
    }
```

기존 테스트 `leavesDeclaredTotalNullWhenSummaryAbsent`가 `declaredYearTotal()`을 호출하므로 아래로 교체한다.

```java
    @Test
    @DisplayName("요약표가 없으면 대사 기준값을 비워 둔다")
    void leavesDeclaredTotalNullWhenSummaryAbsent() {
        Sheet sheet = overviewSheet(Map.of("사업명", "사업"));

        assertThat(reader.read(sheet, context(Map.of()), FormCatalogs.empty()).amounts().yearTotalRaw())
                .isNull();
    }
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*CapitalOverviewReaderTest"
```

Expected: FAIL — `cannot find symbol: method amounts()`

- [ ] **Step 3: `DeclaredAmounts` record와 `Result` 교체**

`CapitalOverviewReader` 하단의 `Result` record를 아래로 교체한다.

```java
    /**
     * 1-1 읽기 결과입니다.
     *
     * @param project 사업 생성 요청 (품목 미포함 — 어댑터가 1-2에서 채웁니다)
     * @param diagnostics 해석 진단
     * @param amounts 1-1이 선언한 금액. 단위가 확정되지 않은 값이 섞여 있습니다
     */
    public record Result(
            ProjectDto.CreateRequest project,
            List<RequestFormDto.FormDiagnostic> diagnostics,
            DeclaredAmounts amounts) {}

    /**
     * 1-1이 선언한 금액입니다. <b>요약표 두 값은 단위가 확정되지 않은 기재값 그대로</b>입니다.
     *
     * <p>요약표는 헤더에 `백만원`이라 적혀 있어도 실제 기재 단위가 부점마다 다릅니다(실측: 한 파일 `2637`, 다른 파일 `1014981660`). 배수는 1-2
     * 품목 합계와 대사해야 정해지고 그 합계는 어댑터만 알고 있으므로, 리더는 판단하지 않고 raw로 넘깁니다.
     *
     * <p>반면 `총 사업금액(전체기간)`은 표 헤더에 딸린 칸이 아니라 제출자가 숫자와 단위를 함께 적는 자유 텍스트라, 적힌 접미사가 그 칸의 유일한 근거입니다.
     * 그래서 여기서 원 단위로 확정합니다.
     *
     * @param wholePeriodWon 접미사로 원 단위가 확정된 총 사업금액. 접미사가 없거나 해석에 실패하면 null
     * @param wholePeriodRaw 접미사가 없을 때의 기재 숫자. 호출자가 요약표 배수를 곱해 씁니다
     * @param wholePeriodUnknownUnit 값은 있으나 숫자·단위로 해석하지 못했으면 true. <b>배수 폴백을 금지하는 신호</b>입니다
     * @param yearTotalRaw 요약표 `'26년도 합계` 기재값 (단위 미확정). 요약표를 못 찾으면 null
     * @param laterTotalRaw 요약표 `'26년도 이후` 기재값 (단위 미확정). 기재가 없으면 null
     */
    public record DeclaredAmounts(
            BigDecimal wholePeriodWon,
            BigDecimal wholePeriodRaw,
            boolean wholePeriodUnknownUnit,
            BigDecimal yearTotalRaw,
            BigDecimal laterTotalRaw) {}
```

- [ ] **Step 4: 상수와 읽기 메서드 교체**

`TOTAL_SCAN_WIDTH` 선언 아래에 상수 2개를 추가한다.

```java
    /** 요약표 `'26년도 합계` 헤더의 정규화 접미사. 연도가 바뀌어도 맞도록 뒤 4글자만 봅니다. */
    private static final String YEAR_TOTAL_SUFFIX = "년도합계";

    /** 요약표 `'26년도 이후` 헤더의 정규화 접미사. */
    private static final String LATER_TOTAL_SUFFIX = "년도이후";

    /**
     * `총 사업금액(전체기간)` 칸의 단위 접미사. <b>긴 접미사를 먼저 본다</b> — `백만원`이 `원`으로 먼저 잡히면 100만배 틀린다.
     *
     * <p>여기 없는 접미사(`억원` 등)는 요약표 배수로 폴백하지 않고 해석 실패로 처리합니다. 폴백이 틀리면 조용히 자릿수가 어긋난 금액이 원장에 남습니다.
     */
    private static final List<Map.Entry<String, AmountUnit>> WHOLE_PERIOD_SUFFIXES =
            List.of(
                    Map.entry("백만원", AmountUnit.MILLION),
                    Map.entry("천원", AmountUnit.THOUSAND),
                    Map.entry("원", AmountUnit.WON));
```

import 2개를 추가한다: `com.kdb.it.domain.migration.request.dto.AmountUnit`.

`read(...)`의 마지막 `return`을 바꾼다.

```java
        return new Result(
                project, stampProjectSubject(diagnostics, project.getAbusNm()), declaredAmounts(sheet));
```

기존 `declaredYearTotal(Sheet)` 메서드를 통째로 아래 4개 메서드로 교체한다.

```java
    /**
     * 1-1이 선언한 금액 3종을 읽습니다.
     *
     * <p>요약표를 못 찾으면 두 컬럼이 null이 되고, 호출자가 그것을 "산출 불가" 신호로 씁니다.
     *
     * @param sheet 1-1 시트
     * @return 선언 금액. 어느 값도 못 읽으면 필드가 모두 비어 있습니다
     */
    private DeclaredAmounts declaredAmounts(Sheet sheet) {
        Optional<Integer> totalRow = scanner.findLabelRow(sheet, new int[] {0, 2}, "총 계", "총계");
        BigDecimal yearTotal =
                totalRow.map(row -> summaryColumn(sheet, row, YEAR_TOTAL_SUFFIX)).orElse(null);
        BigDecimal laterTotal =
                totalRow.map(row -> summaryColumn(sheet, row, LATER_TOTAL_SUFFIX)).orElse(null);
        return wholePeriod(sheet, yearTotal, laterTotal);
    }

    /**
     * 요약표 컬럼 하나를 읽습니다.
     *
     * <p>`총 계` 행이 제출자가 확정한 값이므로 먼저 봅니다. 그 칸이 비어 있으면 헤더 아래 데이터 행을 더해 보완합니다 — 실측 제출본에 `'26년도 이후`만
     * 총 계 행이 빈 파일이 있어, 총 계 행만 보면 그 값을 통째로 놓칩니다.
     *
     * @param sheet 1-1 시트
     * @param totalRow `총 계` 행의 0-based 행 번호
     * @param headerSuffix 찾을 헤더의 정규화 접미사
     * @return 기재값. 헤더를 못 찾거나 총 계 행·데이터 행에 숫자가 하나도 없으면 null
     */
    private BigDecimal summaryColumn(Sheet sheet, int totalRow, String headerSuffix) {
        for (int rowIndex = 0; rowIndex < totalRow; rowIndex++) {
            for (int colIndex = 0; colIndex <= TOTAL_SCAN_WIDTH; colIndex++) {
                String header =
                        SheetAnchorScanner.normalize(scanner.text(sheet, rowIndex, colIndex));
                if (!header.endsWith(headerSuffix)) continue;
                BigDecimal declared = parseAmount(scanner.text(sheet, totalRow, colIndex));
                return declared != null ? declared : sumDataRows(sheet, rowIndex, totalRow, colIndex);
            }
        }
        return null;
    }

    /**
     * 헤더 다음 행부터 총 계 행 직전까지 같은 열을 더합니다.
     *
     * @param sheet 1-1 시트
     * @param headerRow 헤더 행 번호
     * @param totalRow `총 계` 행 번호
     * @param colIndex 더할 열 번호
     * @return 합계. 숫자가 하나도 없으면 null (0과 구분해야 "기재 없음"을 판정할 수 있습니다)
     */
    private BigDecimal sumDataRows(Sheet sheet, int headerRow, int totalRow, int colIndex) {
        BigDecimal sum = null;
        for (int rowIndex = headerRow + 1; rowIndex < totalRow; rowIndex++) {
            BigDecimal value = parseAmount(scanner.text(sheet, rowIndex, colIndex));
            if (value == null) continue;
            sum = sum == null ? value : sum.add(value);
        }
        return sum;
    }

    /**
     * `총 사업금액(전체기간)` 칸을 읽어 선언 금액을 완성합니다.
     *
     * <p>숫자 뒤에 붙은 단위 접미사를 인식하면 그 자리에서 원 단위로 폅니다. 접미사가 없으면 숫자만 남겨 호출자가 요약표 배수를 적용하게 하고, 모르는 접미사거나
     * 숫자가 아니면 폴백을 금지하는 신호를 세웁니다.
     *
     * @param sheet 1-1 시트
     * @param yearTotal 요약표 `'26년도 합계` 기재값
     * @param laterTotal 요약표 `'26년도 이후` 기재값
     * @return 선언 금액
     */
    private DeclaredAmounts wholePeriod(Sheet sheet, BigDecimal yearTotal, BigDecimal laterTotal) {
        String raw = labelReader.value(sheet, "총 사업금액(전체기간)");
        if (!hasText(raw)) {
            return new DeclaredAmounts(null, null, false, yearTotal, laterTotal);
        }
        String trimmed = raw.trim();
        for (Map.Entry<String, AmountUnit> suffix : WHOLE_PERIOD_SUFFIXES) {
            if (!trimmed.endsWith(suffix.getKey())) continue;
            BigDecimal number =
                    parseAmount(trimmed.substring(0, trimmed.length() - suffix.getKey().length()));
            return number == null
                    ? new DeclaredAmounts(null, null, true, yearTotal, laterTotal)
                    : new DeclaredAmounts(
                            suffix.getValue().toWon(number), null, false, yearTotal, laterTotal);
        }
        BigDecimal number = parseAmount(trimmed);
        return number == null
                ? new DeclaredAmounts(null, null, true, yearTotal, laterTotal)
                : new DeclaredAmounts(null, number, false, yearTotal, laterTotal);
    }
```

- [ ] **Step 5: `CapitalProjectFormAdapter`의 호출부를 컴파일 가능하게 임시 조정**

`Result.declaredYearTotal()`이 사라졌으므로 `CapitalProjectFormAdapter.adapt`의 한 줄을 바꾼다. 이 줄은 Task 3에서 다시 손댄다.

```java
        reconcileTotals(read.amounts().yearTotalRaw(), items, project.getAbusNm(), diagnostics);
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*CapitalOverviewReaderTest" --tests "*CapitalProjectFormAdapterTest" --tests "*FormAdapter*Test"
```

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
cd it_backend && ./gradlew spotlessApply --no-daemon && git add src/main/java/com/kdb/it/domain/migration/request/service/adapter src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReaderTest.java && git commit -m "feat: 1-1 요약표 두 컬럼과 총 사업금액 단위 접미사 읽기"
```

---

### Task 3: 환산과 산출 (`CapitalProjectFormAdapter`)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalProjectFormAdapter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalProjectFormAdapterTest.java`

**Interfaces:**
- Consumes: Task 1의 `ProjectAmounts`·`FormAdapterOutput` 5-인자 생성자, Task 2의 `CapitalOverviewReader.DeclaredAmounts`
- Produces: `adapt(...)`가 돌려주는 `FormAdapterOutput.projectAmounts()`에 사업 1건분 `ProjectAmounts` 1개

- [ ] **Step 1: 실패하는 테스트 작성**

`CapitalProjectFormAdapterTest`에 추가한다. `RequestFormFixtures.fullFormXls()`의 기준값은 이 계획 상단 표를 참고한다.

```java
    @Test
    @DisplayName("1-1 선언 금액에서 금액 3종을 산출한다")
    void derivesDeclaredAmountsFromOverview() {
        // 총 사업금액 2,000백만원, '26년도 합계 1,265,624,700원, '26년도 이후 없음(0)
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.fullFormXls()));

        assertThat(output.projectAmounts()).hasSize(1);
        ProjectAmounts amounts = output.projectAmounts().get(0);
        assertThat(amounts.isPresent()).isTrue();
        assertThat(amounts.totRqmAmt()).isEqualByComparingTo("2000000000");
        assertThat(amounts.mplAmt()).isEqualByComparingTo("0");
        assertThat(amounts.dfrAmt()).isEqualByComparingTo("734375300");
    }

    @Test
    @DisplayName("금액을 산출하면 별도 경고를 내지 않는다")
    void staysQuietWhenAmountsResolve() {
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.fullFormXls()));

        assertThat(output.diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .doesNotContain(RequestFormDiagnosticCode.AMOUNT_MISMATCH);
    }
```

배수 판정 실패·음수 검산은 픽스처를 고칠 수 없으므로 시트를 직접 만드는 새 테스트 클래스로 검증한다. `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalDeclaredAmountsTest.java`:

```java
package com.kdb.it.domain.migration.request.service.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import com.kdb.it.domain.migration.request.support.TestIoeIndex;
import com.kdb.it.domain.migration.service.MigrationIoeCatalogReader;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.EnumMap;
import java.util.Map;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * 1-1 선언 금액 산출의 실패 분기를 시트를 직접 만들어 확인합니다.
 *
 * <p>공용 픽스처는 정상 파일 하나를 재현한 것이라 "단위를 못 정하는 파일", "총액이 요약표 합계보다 작은 파일" 같은 변형을 담지 못합니다. 여기서는 1-1만 담은
 * 시트를 만들어 각 분기를 직접 밟습니다 — 1-2가 없으므로 품목 합계가 0이 되어 배수 판정이 실패하는 경로가 기본값입니다.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CapitalDeclaredAmountsTest {

    @Mock private OrgIdentityResolver.Index orgIndex;
    @Mock private MigrationIoeCatalogReader catalogReader;

    private final SheetAnchorScanner scanner = new SheetAnchorScanner();
    private final CapitalProjectFormAdapter adapter =
            new CapitalProjectFormAdapter(
                    new CapitalOverviewReader(
                            scanner, new FormLabelReader(scanner), new FormCheckboxReader()),
                    new ResourceTableReader(scanner),
                    catalogReader);

    @Test
    @DisplayName("품목이 없어 배수를 못 정하면 금액을 적재하지 않고 경고만 낸다")
    void skipsAmountsWhenUnitUnresolved() {
        FormAdapterOutput output = adapt(overviewOnly("2,000백만원", 1_265_624_700d, 0d));

        assertThat(output.projectAmounts().get(0).isPresent()).isFalse();
        assertThat(amountWarning(output)).contains("기 지급예산을 산출하지 못했습니다");
    }

    @Test
    @DisplayName("요약표가 없어도 금액을 적재하지 않고 경고만 낸다")
    void skipsAmountsWhenSummaryAbsent() {
        FormAdapterOutput output = adapt(overviewOnly("2,000백만원", null, null));

        assertThat(output.projectAmounts().get(0).isPresent()).isFalse();
        assertThat(amountWarning(output)).contains("기 지급예산을 산출하지 못했습니다");
    }

    @Test
    @DisplayName("사업은 그대로 만들어 파일을 막지 않는다")
    void stillProducesProject() {
        FormAdapterOutput output = adapt(overviewOnly("2,000백만원", 1_265_624_700d, 0d));

        assertThat(output.projects()).hasSize(1);
        assertThat(output.diagnostics())
                .noneMatch(diagnostic -> diagnostic.code().blocks());
    }

    private FormAdapterOutput adapt(Sheet overview) {
        Map<FormSheetKind, Sheet> sheets = new EnumMap<>(FormSheetKind.class);
        sheets.put(FormSheetKind.CAPITAL_OVERVIEW, overview);
        return adapter.adapt(
                new FormAdapterContext(
                        sheets,
                        "2026",
                        new RequestFormDto.FileEntry("부서/파일.xls", "폴더부서", null, null, null),
                        "0999",
                        "폴더부서",
                        orgIndex,
                        TestIoeIndex.snapshot(),
                        Map.of(),
                        "12345678"));
    }

    private static String amountWarning(FormAdapterOutput output) {
        return output.diagnostics().stream()
                .filter(d -> d.code() == RequestFormDiagnosticCode.AMOUNT_MISMATCH)
                .map(RequestFormDto.FormDiagnostic::message)
                .findFirst()
                .orElse("");
    }

    /** 1-1만 담은 시트를 만듭니다. 요약표 값이 null이면 그 칸을 비웁니다. */
    private static Sheet overviewOnly(String wholePeriod, Double yearTotal, Double laterTotal) {
        try (Workbook wb = new HSSFWorkbook()) {
            Sheet sheet = wb.createSheet("① (정보화사업) 1-1. 정보화사업 개요");
            Row nameRow = sheet.createRow(0);
            cell(nameRow, 2).setCellValue("사업명");
            cell(nameRow, 3).setCellValue("사업");
            Row amountRow = sheet.createRow(1);
            cell(amountRow, 7).setCellValue("총 사업금액(전체기간)");
            cell(amountRow, 9).setCellValue(wholePeriod);
            if (yearTotal != null || laterTotal != null) {
                Row header = sheet.createRow(2);
                cell(header, 6).setCellValue("'26년도 합계");
                cell(header, 7).setCellValue("'26년도 이후");
                Row totalRow = sheet.createRow(4);
                cell(totalRow, 0).setCellValue("총 계");
                if (yearTotal != null) cell(totalRow, 6).setCellValue(yearTotal);
                if (laterTotal != null) cell(totalRow, 7).setCellValue(laterTotal);
            }
            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                wb.write(out);
                return new HSSFWorkbook(new ByteArrayInputStream(out.toByteArray())).getSheetAt(0);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static Cell cell(Row row, int colIndex) {
        Cell existing = row.getCell(colIndex);
        return existing == null ? row.createCell(colIndex) : existing;
    }
}
```

`CapitalProjectFormAdapterTest`에 import를 추가한다: 같은 패키지라 `ProjectAmounts`는 import가 필요 없다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*CapitalProjectFormAdapterTest" --tests "*CapitalDeclaredAmountsTest"
```

Expected: FAIL — `CapitalDeclaredAmountsTest`는 `projectAmounts()`가 `none()`이라 `amountWarning`이 빈 문자열이고, `CapitalProjectFormAdapterTest`는 `totRqmAmt`가 null이다.

- [ ] **Step 3: `adapt`에 산출 단계 추가**

`CapitalProjectFormAdapter.adapt`의 본문 후반을 아래로 교체한다.

```java
        List<RequestFormDto.FormDiagnostic> diagnostics = new ArrayList<>(read.diagnostics());
        List<ProjectDto.BitemmDto> items = readItems(context, diagnostics);
        project.setItems(items);

        BigDecimal itemTotal = sumItemAmounts(items);
        Optional<AmountUnit> unit =
                AmountUnitResolver.inferUnit(read.amounts().yearTotalRaw(), itemTotal);
        reconcileTotals(read.amounts().yearTotalRaw(), itemTotal, unit, project.getAbusNm(), diagnostics);
        ProjectAmounts amounts =
                declaredAmounts(read.amounts(), unit, project.getAbusNm(), diagnostics);

        return new FormAdapterOutput(
                List.of(project), List.of(), List.copyOf(diagnostics), null, List.of(amounts));
```

import를 추가한다: `com.kdb.it.domain.migration.request.dto.AmountUnit`.

- [ ] **Step 4: `reconcileTotals` 교체와 산출 메서드 추가**

기존 `reconcileTotals(BigDecimal, List, String, List)`를 아래로 교체하고, 그 아래에 세 메서드를 추가한다.

```java
    /** 활성 품목의 소요예산 합계를 원 단위로 더합니다. 1-2는 `수량 × 단가`라 항상 원 단위입니다. */
    private static BigDecimal sumItemAmounts(List<ProjectDto.BitemmDto> items) {
        BigDecimal total = BigDecimal.ZERO;
        for (ProjectDto.BitemmDto item : items) {
            if (item.getAmt() != null) total = total.add(item.getAmt());
        }
        return total;
    }

    /**
     * 1-1 요약표와 1-2 품목 합계를 대사합니다.
     *
     * <p>어느 배수로도 맞지 않으면 단위 문제가 아니라 기재 오류이므로 경고를 냅니다. 요약표를 읽지 못했거나 품목이 없으면 대사할 수 없어 조용히 넘어갑니다 —
     * 그 경우의 안내는 {@link #declaredAmounts}가 냅니다.
     */
    private void reconcileTotals(
            BigDecimal declaredYearTotal,
            BigDecimal itemTotal,
            Optional<AmountUnit> unit,
            String projectName,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (declaredYearTotal == null || itemTotal.signum() == 0) return;
        if (unit.isPresent()) return;

        diagnostics.add(
                RequestFormDto.FormDiagnostic.about(
                        FormSheetKind.CAPITAL_OVERVIEW,
                        null,
                        "declaredYearTotal",
                        projectName,
                        RequestFormDiagnosticCode.AMOUNT_MISMATCH,
                        "1-1 요약표의 합계(%s)와 1-2 품목 합계(%s)가 어느 단위로도 맞지 않습니다."
                                .formatted(
                                        declaredYearTotal.toPlainString(),
                                        itemTotal.toPlainString()),
                        List.of()));
    }

    /**
     * 1-1 선언 금액에서 사업 단위 금액 3종을 산출합니다.
     *
     * <p>산식은 {@code 총소요금액 = 총 사업금액(전체기간)}, {@code 예정금액 = '26년도 이후}, {@code 지급금액 = 총 사업금액 − '26년도
     * 이후 − '26년도 합계}입니다. 요약표는 단위가 파일마다 다르므로 1-2 품목 합계로 역추정한 배수를 곱해 원 단위로 폅니다.
     *
     * <p>환산 근거가 없거나 지급금액이 음수면 <b>적재하지 않고 경고만</b> 냅니다. 파일은 그대로 반영되고 세 컬럼은 품목 합계 스냅샷으로 남습니다 — 여기서
     * 막으면 1-2가 정상인 파일까지 통째로 반입되지 못합니다.
     *
     * @param declared 1-1이 읽어 온 선언 금액
     * @param unit 요약표 기재 단위. 판정에 실패했으면 빈 Optional
     * @param projectName 진단에 붙일 사업명
     * @param diagnostics 진단 수집 목록 (실패 시 경고가 추가됩니다)
     * @return 산출한 금액. 실패하면 {@link ProjectAmounts#none()}
     */
    private ProjectAmounts declaredAmounts(
            CapitalOverviewReader.DeclaredAmounts declared,
            Optional<AmountUnit> unit,
            String projectName,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (declared.yearTotalRaw() == null) {
            return skipAmounts(projectName, "1-1 요약표를 찾지 못했습니다.", diagnostics);
        }
        if (unit.isEmpty()) {
            return skipAmounts(
                    projectName, "1-1 요약표의 기재 단위를 1-2 품목 합계로 확정하지 못했습니다.", diagnostics);
        }

        AmountUnit resolved = unit.get();
        BigDecimal whole =
                declared.wholePeriodWon() != null
                        ? declared.wholePeriodWon()
                        : resolved.toWon(declared.wholePeriodRaw());
        if (whole == null) {
            return skipAmounts(
                    projectName,
                    declared.wholePeriodUnknownUnit()
                            ? "`총 사업금액(전체기간)`의 표기를 금액으로 해석하지 못했습니다."
                            : "`총 사업금액(전체기간)` 칸이 비어 있습니다.",
                    diagnostics);
        }

        BigDecimal year = resolved.toWon(declared.yearTotalRaw());
        BigDecimal later =
                declared.laterTotalRaw() == null
                        ? BigDecimal.ZERO
                        : resolved.toWon(declared.laterTotalRaw());
        BigDecimal paid = whole.subtract(later).subtract(year);
        if (paid.signum() < 0) {
            return skipAmounts(
                    projectName,
                    "`총 사업금액(전체기간)`(%s)이 요약표 합계(%s)보다 작습니다."
                            .formatted(whole.toPlainString(), year.add(later).toPlainString()),
                    diagnostics);
        }
        return new ProjectAmounts(whole, later, paid);
    }

    /** 산출 실패를 경고로 남기고 빈 금액을 돌려줍니다. 문구에 후속 조치를 함께 적습니다. */
    private ProjectAmounts skipAmounts(
            String projectName, String reason, List<RequestFormDto.FormDiagnostic> diagnostics) {
        diagnostics.add(
                RequestFormDto.FormDiagnostic.about(
                        FormSheetKind.CAPITAL_OVERVIEW,
                        null,
                        "declaredAmounts",
                        projectName,
                        RequestFormDiagnosticCode.AMOUNT_MISMATCH,
                        "%s 기 지급예산을 산출하지 못했습니다. 반입 후 사업 수정 화면에서 입력해 주세요.".formatted(reason),
                        List.of()));
        return ProjectAmounts.none();
    }
```

`AmountUnitResolver` import가 이미 있는지 확인한다(기존 `reconcileTotals`가 쓰고 있었다).

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*CapitalProjectFormAdapterTest" --tests "*CapitalDeclaredAmountsTest" --tests "*FormAdapterEdgeCaseTest" --tests "*FormAdapterResolutionPathTest"
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd it_backend && ./gradlew spotlessApply --no-daemon && git add src/main/java/com/kdb/it/domain/migration/request/service/adapter src/test/java/com/kdb/it/domain/migration/request/service/adapter && git commit -m "feat: 1-1 선언 금액에서 정보화사업 금액 3종 산출"
```

---

### Task 4: 이관 전용 기록과 수정 상한 완화 (`ProjectService`)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`

**Interfaces:**
- Consumes: 없음 (Task 1~3과 독립)
- Produces: `ProjectService.assignDeclaredAmounts(String abusMngNo, BigDecimal totRqmAmt, BigDecimal mplAmt, BigDecimal dfrAmt)` — 반환값 `void`

- [ ] **Step 1: 실패하는 테스트 작성**

`ProjectServiceTest`에 추가한다. 기존 mock 필드명(`projectRepository`, `projectService`)과 픽스처 헬퍼를 그대로 쓴다. `Bprojm` 인스턴스를 만드는 방식은 이 클래스의 기존 테스트를 따른다(빌더 또는 헬퍼).

```java
    @Test
    @DisplayName("이관 경로는 선언 금액을 검증 없이 그대로 기록한다")
    void assignDeclaredAmounts_writesWithoutValidation() {
        Bprojm project = Bprojm.builder().abusMngNo("PRJ-2026-0001").build();
        given(projectRepository.findByAbusMngNoAndDelYn("PRJ-2026-0001", "N"))
                .willReturn(Optional.of(project));

        // 기 지급예산이 총 예산보다 큰 조합도 그대로 기록한다 — 선언값이 원본이다
        projectService.assignDeclaredAmounts(
                "PRJ-2026-0001",
                new BigDecimal("2000000000"),
                new BigDecimal("0"),
                new BigDecimal("734375300"));

        assertThat(project.getTotRqmAmt()).isEqualByComparingTo("2000000000");
        assertThat(project.getMplAmt()).isEqualByComparingTo("0");
        assertThat(project.getDfrAmt()).isEqualByComparingTo("734375300");
    }

    @Test
    @DisplayName("이관 경로가 사업을 못 찾으면 실패한다")
    void assignDeclaredAmounts_failsWhenProjectMissing() {
        given(projectRepository.findByAbusMngNoAndDelYn("PRJ-2026-9999", "N"))
                .willReturn(Optional.empty());

        assertThatThrownBy(
                        () ->
                                projectService.assignDeclaredAmounts(
                                        "PRJ-2026-9999",
                                        BigDecimal.ONE,
                                        BigDecimal.ZERO,
                                        BigDecimal.ZERO))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("PRJ-2026-9999");
    }
```

상한 완화의 회귀 테스트도 추가한다. 기존 `updateProject` 테스트가 쓰는 픽스처 헬퍼(`existingProject()` 등)를 그대로 재사용하고, 이름이 다르면 그 클래스의 것에 맞춘다.

```java
    @Test
    @DisplayName("반입으로 들어온 기 지급예산은 같은 값으로 다시 저장할 수 있다")
    void updateProject_allowsResavingImportedDfrAmt() {
        // 반입 사업은 DFR_AMT가 1-1 전체기간 총액 기준이라 품목 합계(1,000)보다 크다.
        // 수정 화면이 그 값을 그대로 되돌려 보내므로, 상한이 품목 합계면 저장이 막힌다.
        Bprojm project = existingProjectWithDfrAmt(new BigDecimal("734375300"));
        ProjectDto.UpdateRequest request = validUpdateRequest();
        request.setDfrAmt(new BigDecimal("734375300"));
        request.setItems(List.of(itemDto("A01", new BigDecimal("1000"), BigDecimal.ZERO)));

        assertThatCode(() -> projectService.updateProject(project.getAbusMngNo(), request))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("기존 기 지급예산보다 늘리는 수정은 여전히 거부한다")
    void updateProject_stillRejectsIncreaseBeyondCeiling() {
        Bprojm project = existingProjectWithDfrAmt(new BigDecimal("734375300"));
        ProjectDto.UpdateRequest request = validUpdateRequest();
        request.setDfrAmt(new BigDecimal("734375301"));
        request.setItems(List.of(itemDto("A01", new BigDecimal("1000"), BigDecimal.ZERO)));

        assertThatThrownBy(() -> projectService.updateProject(project.getAbusMngNo(), request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("기 지급예산");
    }
```

`existingProjectWithDfrAmt`가 없으면 클래스 하단에 추가한다. 기존 `updateProject` 테스트가 사업 조회를 어떤 리포지토리 메서드로 stub 하는지 확인해 같은 메서드를 stub 한다.

```java
    /** 이미 기 지급예산이 기록된 기존 사업. 반입으로 들어온 사업을 재현한다. */
    private Bprojm existingProjectWithDfrAmt(BigDecimal dfrAmt) {
        Bprojm project = Bprojm.builder().abusMngNo("PRJ-2026-0001").build();
        project.assignAmountSnapshot(new BigDecimal("2000000000"), BigDecimal.ZERO, dfrAmt);
        return project;
    }
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*ProjectServiceTest"
```

Expected: FAIL — `cannot find symbol: method assignDeclaredAmounts`

- [ ] **Step 3: `assignDeclaredAmounts` 추가**

`sumActiveItems` 아래에 넣는다.

```java
    /**
     * 이관 전용 — 편성요청서가 선언한 사업 단위 금액을 그대로 기록합니다.
     *
     * <p>{@link #createProject}가 남긴 품목 합계 스냅샷을 1-1 선언값으로 덮어씁니다. 반입 경로에서 {@code createProject} 직후에만
     * 부르며, 일반 등록·수정 흐름은 이 메서드를 타지 않습니다.
     *
     * <p><b>검증하지 않습니다.</b> 총 예산은 사업 전체기간 기준이고 기 지급예산은 그 총액에서 예산연도 이후 계획분을 뺀 값이라, 예산연도 품목만 담은 합계보다
     * 큰 것이 정상입니다. {@code applyAmountSnapshot}의 "기 지급예산 ≤ 총 예산" 상한을 여기에 걸면 정상 파일이 전부 예외로 롤백됩니다.
     *
     * @param abusMngNo 사업관리번호
     * @param totRqmAmt 총소요금액 (1-1 총 사업금액, 원 단위)
     * @param mplAmt 예정금액 (1-1 예산연도 이후 합계, 원 단위)
     * @param dfrAmt 지급금액 (기 지급예산, 원 단위)
     * @throws IllegalArgumentException 사업관리번호에 해당하는 활성 사업이 없는 경우
     */
    @Transactional
    public void assignDeclaredAmounts(
            String abusMngNo, BigDecimal totRqmAmt, BigDecimal mplAmt, BigDecimal dfrAmt) {
        Bprojm project =
                projectRepository
                        .findByAbusMngNoAndDelYn(abusMngNo, "N")
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "사업을 찾을 수 없습니다: " + abusMngNo));
        project.assignAmountSnapshot(totRqmAmt, mplAmt, dfrAmt);
    }
```

`java.util.Optional` import가 없으면 추가한다.

- [ ] **Step 4: `applyAmountSnapshot` 상한 완화**

`applyAmountSnapshot`의 상한 검사 블록을 아래로 교체하고, JavaDoc의 `@throws` 문구도 함께 고친다.

```java
        // 반입된 사업은 DFR_AMT가 1-1 전체기간 총액 기준이라 품목 합계보다 크다. 기존 저장값까지
        // 상한으로 허용해, 반입 사업을 수정 화면에서 그대로 저장할 때 400으로 막히지 않게 한다.
        // 신규 등록은 DFR_AMT가 null이라 상한이 품목 합계 그대로다.
        BigDecimal existing =
                project.getDfrAmt() == null ? BigDecimal.ZERO : project.getDfrAmt();
        BigDecimal ceiling = snapshot.totRqmAmt().max(existing);
        if (dfrAmt.compareTo(ceiling) > 0) {
            throw new IllegalArgumentException("기 지급예산은 총 예산을 초과할 수 없습니다.");
        }
```

JavaDoc의 실패 조건을 고친다.

```java
     * @throws IllegalArgumentException 기 지급예산이 음수이거나, 총 예산과 기존 저장값 중 큰 값을 초과하는 경우
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*ProjectServiceTest" --tests "*ProjectServiceCoverageTest" --tests "*ProjectBudgetSummaryServiceTest"
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd it_backend && ./gradlew spotlessApply --no-daemon && git add src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java && git commit -m "feat: 이관 선언 금액 기록 메서드와 기 지급예산 상한 완화"
```

---

### Task 5: 반입 배선 (`RequestFormFileImporter`)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporterTest.java`

**Interfaces:**
- Consumes: Task 1의 `FormAdapterOutput.projectAmounts()`·`ProjectAmounts.isPresent()`, Task 4의 `ProjectService.assignDeclaredAmounts(...)`
- Produces: 없음 (마지막 배선 태스크)

- [ ] **Step 1: 실패하는 테스트 작성**

`RequestFormFileImporterTest`에 추가한다.

```java
    @Test
    @DisplayName("선언 금액이 있으면 원장 생성 직후 그 값으로 덮어쓴다")
    void assignsDeclaredAmountsAfterCreate() {
        when(validator.validate(any(), anyString())).thenReturn(List.of());
        when(projectService.createProject(any(), anyBoolean())).thenReturn("PRJ-2026-0001");
        ProjectDto.CreateRequest project = new ProjectDto.CreateRequest();
        project.setAbusNm("국채전문유통시장 접속인프라 도입");
        project.setItems(List.of());
        FormAdapterOutput output =
                new FormAdapterOutput(
                        List.of(project),
                        List.of(),
                        List.of(),
                        null,
                        List.of(
                                new ProjectAmounts(
                                        new BigDecimal("2000000000"),
                                        BigDecimal.ZERO,
                                        new BigDecimal("734375300"))));

        importer().apply(output, ENTRY, "2026", "12345678");

        verify(projectService)
                .assignDeclaredAmounts(
                        eq("PRJ-2026-0001"),
                        eq(new BigDecimal("2000000000")),
                        eq(BigDecimal.ZERO),
                        eq(new BigDecimal("734375300")));
    }

    @Test
    @DisplayName("선언 금액이 없으면 덮어쓰지 않고 품목 합계 스냅샷을 남긴다")
    void keepsItemSnapshotWhenNoDeclaredAmounts() {
        when(validator.validate(any(), anyString())).thenReturn(List.of());
        when(projectService.createProject(any(), anyBoolean())).thenReturn("PRJ-2026-0001");
        when(costService.createCost(any(), anyBoolean())).thenReturn("COST-2026-0001");

        importer().apply(outputWithOneOfEach(), ENTRY, "2026", "12345678");

        verify(projectService, never()).assignDeclaredAmounts(any(), any(), any(), any());
    }

    @Test
    @DisplayName("사전검증은 선언 금액을 기록하지 않는다")
    void previewNeverAssignsDeclaredAmounts() {
        when(validator.validate(any(), anyString())).thenReturn(List.of());

        importer().preview(outputWithOneOfEach(), ENTRY, "2026");

        verify(projectService, never()).assignDeclaredAmounts(any(), any(), any(), any());
    }
```

import를 추가한다: `com.kdb.it.domain.migration.request.service.adapter.ProjectAmounts`.

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*RequestFormFileImporterTest"
```

Expected: FAIL — `cannot find symbol: method assignDeclaredAmounts`

- [ ] **Step 3: 사업 반영 루프 교체**

`RequestFormFileImporter.apply`의 사업 루프를 아래로 교체한다. 인덱스 루프로 바꾸는 이유는 `projectAmounts`가 `projects`와 인덱스로 대응하기 때문이다.

```java
        List<RequestFormDto.CreatedRecord> created = new ArrayList<>();
        List<ProjectDto.CreateRequest> projects = output.projects();
        for (int index = 0; index < projects.size(); index++) {
            ProjectDto.CreateRequest project = projects.get(index);
            project.setBseYy(bseYy);
            String abusMngNo = projectService.createProject(project, true);
            // 1-1이 금액을 선언했으면 품목 합계 스냅샷을 그 값으로 덮어쓴다. 선언이 없으면
            // createProject가 남긴 품목 합계를 그대로 둔다
            ProjectAmounts amounts = output.projectAmounts().get(index);
            if (amounts.isPresent()) {
                projectService.assignDeclaredAmounts(
                        abusMngNo, amounts.totRqmAmt(), amounts.mplAmt(), amounts.dfrAmt());
            }
            stamp(TABLE_PROJECT, abusMngNo, project.getAbusNm(), actorEno, bseYy);
            created.add(
                    new RequestFormDto.CreatedRecord(
                            TABLE_PROJECT, abusMngNo, project.getAbusNm()));
        }
```

import를 추가한다: `com.kdb.it.domain.migration.request.service.adapter.ProjectAmounts`.

클래스 JavaDoc 끝에 한 문단을 덧붙인다.

```java
 * <p>정보화사업의 사업 단위 금액은 {@code createProject}가 품목 합계로 한 번 기록한 뒤, 1-1이 금액을 선언한 파일에 한해
 * {@code assignDeclaredAmounts}로 덮어씁니다. 순서를 뒤집을 수 없습니다 — 채번이 끝나야 사업관리번호가 정해지고, 품목 저장이 끝나야
 * {@code createProject}의 스냅샷 기록이 끝나기 때문입니다.
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*RequestFormFileImporterTest" --tests "*RequestForm*Test"
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd it_backend && ./gradlew spotlessApply --no-daemon && git add src/main/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporter.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporterTest.java && git commit -m "feat: 반입 시 1-1 선언 금액을 사업 원장에 기록"
```

---

### Task 6: Oracle 통합 검증과 전체 게이트

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/migration/request/RequestFormImportIt.java`
- Modify: `C:\it\versions.lock` (`scripts/update-versions-lock.ps1`로 갱신)

**Interfaces:**
- Consumes: Task 1~5의 모든 변경
- Produces: 없음

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`RequestFormImportIt`에 추가한다. `countOf`와 같은 자리(클래스 하단 헬퍼 구역)에 조회 헬퍼를 함께 넣는다.

```java
    @Test
    @DisplayName("반입한 사업의 금액 3종이 1-1 선언값과 일치한다")
    void recordsDeclaredAmounts() {
        service.importForms(List.of(fullFormFile()), BSE_YY, ACTOR_ENO, false, overridesFor(...));

        assertThat(amountOf("TOT_RQM_AMT")).isEqualByComparingTo("2000000000");
        assertThat(amountOf("MPL_AMT")).isEqualByComparingTo("0");
        assertThat(amountOf("DFR_AMT")).isEqualByComparingTo("734375300");
    }

    /** 테스트 연도 사업 1건의 금액 컬럼을 읽습니다. 이 테스트는 사업을 1건만 만듭니다. */
    private BigDecimal amountOf(String column) {
        Number amount =
                (Number)
                        entityManager
                                .createNativeQuery(
                                        "SELECT "
                                                + column
                                                + " FROM TPRMPP_BPROJM"
                                                + " WHERE BSE_YY = :yy AND DEL_YN = 'N'")
                                .setParameter("yy", BSE_YY)
                                .getSingleResult();
        return new BigDecimal(amount.toString());
    }
```

`service.importForms(...)` 호출부와 오버라이드 인자는 **이 클래스의 기존 테스트 `createsLedgerWithCompletedApproval`이 쓰는 형태를 그대로 복사한다.** 위 예시의 `fullFormFile()`·`overridesFor(...)`는 그 테스트에 있는 실제 헬퍼 이름으로 바꾼다. `java.math.BigDecimal` import를 추가한다.

- [ ] **Step 2: 통합 테스트를 돌려 실패를 확인**

로컬 Oracle이 기동된 상태에서 실행한다.

```bash
cd it_backend && ./gradlew integrationTest --no-daemon --tests "*RequestFormImportIt"
```

Expected: FAIL — 세 컬럼이 품목 합계(`1265624700`/`0`/`0`)로 남아 있으면 Task 1~5의 배선이 끊긴 것이다. 이때는 배선을 고치고 다시 돌린다. 이미 통과하면 다음 단계로 간다.

- [ ] **Step 3: 백엔드 전체 테스트**

```bash
cd it_backend && ./gradlew clean test --no-daemon
```

Expected: 실패 0, 오류 0

- [ ] **Step 4: 품질 게이트**

```bash
cd it_backend && ./gradlew check --no-daemon
```

Expected: Spotless·JaCoCo 검증 통과

- [ ] **Step 5: 통합 테스트 전체**

```bash
cd it_backend && ./gradlew integrationTest --no-daemon
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd it_backend && ./gradlew spotlessApply --no-daemon && git add src/test/java/com/kdb/it/domain/migration/request/RequestFormImportIt.java && git commit -m "test: 반입 금액 3종 Oracle 통합 검증"
```

- [ ] **Step 7: 저장소 버전 조합 고정**

```bash
pwsh scripts/update-versions-lock.ps1
```

```bash
git add versions.lock && git commit -m "chore: 편성요청서 선언 금액 반영 버전 고정"
```

---

## Self-Review

**Spec coverage**

| 스펙 절 | 담당 태스크 |
| --- | --- |
| §3 읽기 (요약표 컬럼 일반화, 총계행→데이터행 폴백, 두 컬럼 동일 규칙) | Task 2 |
| §3.2 접미사 파싱 (`원`·`천원`·`백만원`, 미인식 접미사 처리) | Task 2 |
| §3.3 `DeclaredAmounts` 반환 타입, `declaredYearTotal` 소비처 이관 | Task 2 |
| §4 환산·산식 | Task 3 |
| §4.1 미적재 조건 4종 | Task 3 (조건 1·2·3은 `CapitalDeclaredAmountsTest`, 조건 4는 산식 분기) |
| §4.2 진단 코드 재사용과 문구 | Task 3 |
| §4.3 정보화사업 한정 | Task 1 편의 생성자로 나머지 어댑터 무변경 |
| §5 전달 (`ProjectAmounts`, 병렬 리스트, 길이 불변식, merge, 편의 생성자) | Task 1 |
| §6 저장 (`assignDeclaredAmounts`, 검증 없음) | Task 4 |
| §7 수정 시 상한 완화 | Task 4 |
| §8 알려진 한계 | 태스크 없음 (의도적 — 감수 사항) |
| §9 사용자 동선 | 태스크 없음 (Task 3 진단 문구가 "사업 수정 화면에서 입력"을 안내) |
| §10 테스트 | Task 1~6 각 태스크 |
| §11 범위 밖 | 태스크 없음 (의도적) |

**Placeholder scan** — "적절히", "TBD", "위와 유사하게" 없음. 모든 코드 스텝에 실제 코드 블록이 있다. Task 6 Step 1의 `fullFormFile()`·`overridesFor(...)`만 기존 클래스의 실제 헬퍼 이름으로 치환하라고 지시했는데, 그 클래스를 읽지 않고는 이름을 확정할 수 없어 남긴 유일한 치환 지점이다. 같은 파일 안 `createsLedgerWithCompletedApproval`을 복사하면 되므로 판단이 필요하지 않다.

**Type consistency**

- `ProjectAmounts(BigDecimal, BigDecimal, BigDecimal)` — Task 1 정의, Task 3에서 `new ProjectAmounts(whole, later, paid)`, Task 5에서 `amounts.totRqmAmt()`/`mplAmt()`/`dfrAmt()`. 일치.
- `ProjectAmounts.none()` / `isPresent()` — Task 1 정의, Task 3·5에서 사용. 일치.
- `FormAdapterOutput` 5-인자 — Task 1 정의, Task 3에서 `List.of(project), List.of(), List.copyOf(diagnostics), null, List.of(amounts)` 순서로 호출. 일치.
- `CapitalOverviewReader.DeclaredAmounts(wholePeriodWon, wholePeriodRaw, wholePeriodUnknownUnit, yearTotalRaw, laterTotalRaw)` — Task 2 정의, Task 3에서 5개 접근자 모두 사용. 일치.
- `Result.amounts()` — Task 2에서 `declaredYearTotal` → `amounts`로 교체, Task 2 Step 5에서 어댑터 호출부를 `read.amounts().yearTotalRaw()`로 임시 조정하고 Task 3 Step 3에서 최종형으로 교체. 일치.
- `ProjectService.assignDeclaredAmounts(String, BigDecimal, BigDecimal, BigDecimal)` → `void` — Task 4 정의, Task 5에서 호출. 일치.
- `Bprojm.assignAmountSnapshot(BigDecimal, BigDecimal, BigDecimal)` — 기존 메서드. Task 4에서 재사용. 일치.
- `AmountUnit.toWon(BigDecimal)` → `BigDecimal` (raw가 null이면 null) — 기존 메서드. Task 2·3에서 사용. Task 3의 `resolved.toWon(declared.wholePeriodRaw())`가 raw null일 때 null을 돌려주는 성질에 의존하며, 바로 다음 줄에서 `whole == null`로 걸러낸다. 일치.
