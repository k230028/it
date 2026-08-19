# 2026 편성요청서 반입 보강 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026 실측 제출본의 신양식 변형을 정확히 파싱하고, 요청서·증빙 파일을 사업 폴더 단위로만 묶어 분할 없이 반입한다.

**Architecture:** 백엔드는 자본예산 표 레이아웃과 확인된 옵션 어휘를 보강하고, `fileKey`를 해석하는 패키지 내부 순수 함수로 보관 그룹을 계산한다. 프론트는 같은 경로 규칙으로 그룹을 계산해 목표 20개 배치를 만들되 그룹을 나누지 않으며, 백엔드는 `(보관 그룹 키, 실제 부서코드)`로 APF와 원본을 연결한다. API DTO와 DB 스키마는 바꾸지 않는다.

**Tech Stack:** Java 25 / Spring Boot 4 / Apache POI / JUnit 5 + AssertJ + Mockito (백엔드), Nuxt 4 / Vue 3 Composition API / TypeScript / Vitest + happy-dom (프론트), Gradle Wrapper / npm

**Spec:** [docs/superpowers/specs/2026-08-19-request-form-2026-sample-hardening-design.md](../specs/2026-08-19-request-form-2026-sample-hardening-design.md)

## Global Constraints

- DB 스키마·공통코드·Flyway·`meta/table.txt`를 변경하지 않는다.
- `RequestFormDto.FileEntry`와 OpenAPI 계약을 변경하지 않는다. 프론트 `api.d.ts`는 재생성 대상이 아니다.
- 확인되지 않은 비목, 금액 단위, 빈 사업명·금액을 자동 추정하지 않는다. 기존 업무 판단용 `BLOCKED`는 유지한다.
- 백엔드 신규 JavaDoc·주석과 프론트 신규 TSDoc·주석은 한글로 작성한다.
- 프론트 사용자 노출 오류 문구는 `it_frontend/i18n/messages/admin.ts`의 한국어·영어 블록에 함께 추가한다.
- 프론트 목표 배치 크기는 `20`, 서버 파일 상한은 `50`이다. 그룹은 20을 넘을 수 있지만 50을 넘으면 전송 전에 중단한다.
- 루트, `it_backend`, `it_frontend`는 독립 Git 저장소다. 각 커밋에서 경로를 명시해 스테이징하고 `git add -A`, `git add .`, `git commit -a`를 사용하지 않는다.
- 공유 워킹트리의 `sample/2026` 변경은 수정·스테이징하지 않는다. 샘플은 읽기 전용 회귀 입력으로만 사용한다.
- 구현 시작 시 `superpowers:using-git-worktrees`로 현재 환경을 확인한다. 사용자가 현재 공유 워킹트리에서의 직접 실행을 선택하면 기존 변경을 보존한 채 진행한다.

---

### Task 1: 신·구 자본예산 레이아웃을 함께 읽기

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/ResourceTableReader.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReader.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/ResourceTableReaderTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalDeclaredAmountsTest.java`

**Interfaces:**
- Consumes: `SheetAnchorScanner.HeaderMap.column("item") -> int`
- Produces: `ResourceTableReader.readCapitalResource(...)`가 `item=C`이면 B열, `item>D`이면 기존 C열을 그룹으로 읽음
- Produces: `CapitalOverviewReader.declaredAmounts(...)`가 `총 계`, `총계`, `계`를 합계 행으로 인식

- [ ] **Step 1: 자원표 레이아웃 실패 테스트와 시트 빌더를 추가한다**

`ResourceTableReaderTest.java`에 POI import를 추가한다.

```java
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Workbook;
```

`takesCapitalResourceGroupFromColumnC` 바로 뒤에 두 테스트를 추가한다.

```java
    @Test
    @DisplayName("신양식은 항목 C열 바로 왼쪽 B열을 비목으로 읽는다")
    void takesCompactCapitalResourceGroupFromColumnB() {
        Sheet sheet = capitalSheet(1, 2, "기계장치(HW)", "서버(일체)");

        ResourceTableReader.Result result =
                reader.readCapitalResource(sheet, 0, false).orElseThrow();

        assertThat(result.rows()).extracting(ResourceRow::group).containsExactly("기계장치(HW)");
    }

    @Test
    @DisplayName("항목 앞에 보조 열이 있어도 기존 C열 비목을 유지한다")
    void keepsCapitalResourceGroupInColumnCWhenItemMovesRight() {
        Sheet sheet = capitalSheet(2, 4, "기타무형자산(SW)", "테스트 자동화 솔루션");

        ResourceTableReader.Result result =
                reader.readCapitalResource(sheet, 0, false).orElseThrow();

        assertThat(result.rows())
                .extracting(ResourceRow::group)
                .containsExactly("기타무형자산(SW)");
    }
```

테스트 클래스 아래쪽에 실제 헤더 검색 조건을 모두 만족하는 빌더를 추가한다.

```java
    /** 그룹·항목 열 위치가 다른 자본예산 1-2 표를 만듭니다. */
    private static Sheet capitalSheet(
            int groupColumn, int itemColumn, String group, String itemName) {
        Workbook workbook = new HSSFWorkbook();
        Sheet sheet = workbook.createSheet("① (정보화사업) 1-2. 소요자원 상세내용");
        Row header = sheet.createRow(0);
        cell(header, itemColumn).setCellValue("항목");
        cell(header, itemColumn + 1).setCellValue("수량");
        cell(header, itemColumn + 2).setCellValue("단가");
        cell(header, itemColumn + 3).setCellValue("통화");
        cell(header, itemColumn + 4).setCellValue("소요예산 (부가세포함)");
        cell(header, itemColumn + 5).setCellValue("산정근거");
        cell(header, itemColumn + 6).setCellValue("도입시기");
        cell(header, itemColumn + 7).setCellValue("정보보호여부");
        cell(header, itemColumn + 8).setCellValue("인프라 통합관리 여부");
        cell(header, itemColumn + 9).setCellValue("비고(적용 환율 등)");

        Row item = sheet.createRow(1);
        cell(item, groupColumn).setCellValue(group);
        cell(item, itemColumn).setCellValue(itemName);
        cell(item, itemColumn + 1).setCellValue(1);
        cell(item, itemColumn + 2).setCellValue(100);
        cell(item, itemColumn + 3).setCellValue("KRW");
        cell(item, itemColumn + 4).setCellValue(100);
        return sheet;
    }

    private static Cell cell(Row row, int column) {
        return row.createCell(column);
    }
```

- [ ] **Step 2: 신양식 그룹 열 테스트가 실패하는지 확인한다**

Run from `C:\it\it_backend`:

```powershell
./gradlew test --tests '*ResourceTableReaderTest*'
```

Expected: FAIL — `takesCompactCapitalResourceGroupFromColumnB`의 실제 그룹이 `서버(일체)`로 나온다.

- [ ] **Step 3: 자본예산 그룹 열을 헤더 위치에 맞춰 결정한다**

`ResourceTableReader.read(...)`의 `groupCol` 계산을 다음 코드로 바꾸고 클래스·메서드 JavaDoc의 “C열 고정” 설명을 동일 규칙으로 갱신한다.

```java
        int itemCol = map.column("item");
        // 구양식은 중간 보조 열 때문에 C열을 유지해야 하고, 신양식은 항목 자체가 C열이라
        // 그 바로 왼쪽 B열을 써야 합니다.
        int groupCol =
                groupColumn == null || groupColumn >= itemCol
                        ? Math.max(itemCol - 1, 0)
                        : groupColumn;
```

- [ ] **Step 4: 그룹 열 테스트를 통과시킨다**

```powershell
./gradlew spotlessApply
./gradlew test --tests '*ResourceTableReaderTest*'
```

Expected: PASS — 기존 C열, 신양식 B열, 항목 E열 변형이 모두 통과한다.

- [ ] **Step 5: `계` 합계 라벨 실패 테스트를 추가한다**

`CapitalDeclaredAmountsTest.java`에 다음 테스트를 `skipsAmountsWhenUnitUnresolved` 뒤에 추가한다.

```java
    @Test
    @DisplayName("신양식의 계 행도 선언 금액 요약표로 읽는다")
    void readsSummaryRowLabeledSimpleTotal() {
        FormAdapterOutput output =
                adapt(overviewOnly("2,000백만원", 1_265_624_700d, 0d, "계"));

        assertThat(amountWarning(output))
                .contains("기재 단위를 1-2 품목 합계로 확정하지 못했습니다")
                .doesNotContain("요약표를 찾지 못했습니다");
    }
```

기존 helper를 보존하면서 라벨을 받을 수 있도록 overload를 추가한다.

```java
    private static Sheet overviewOnly(
            String wholePeriod, Double yearTotal, Double laterTotal, String totalLabel) {
        Workbook wb =
                workbookOf(
                        w -> {
                            Sheet sheet = w.createSheet(OVERVIEW_SHEET_NAME);
                            writeOverview(sheet, wholePeriod, yearTotal, laterTotal, totalLabel);
                        });
        return wb.getSheetAt(0);
    }

    private static void writeOverview(
            Sheet sheet,
            String wholePeriod,
            Double yearTotal,
            Double laterTotal,
            String totalLabel) {
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
            cell(totalRow, 0).setCellValue(totalLabel);
            if (yearTotal != null) cell(totalRow, 6).setCellValue(yearTotal);
            if (laterTotal != null) cell(totalRow, 7).setCellValue(laterTotal);
        }
    }
```

기존 3인자 `writeOverview`와 `overviewOnly`는 각각 위 overload에 `"총 계"`를 전달하도록 바꾼다.

```java
    private static Sheet overviewOnly(String wholePeriod, Double yearTotal, Double laterTotal) {
        return overviewOnly(wholePeriod, yearTotal, laterTotal, "총 계");
    }

    private static void writeOverview(
            Sheet sheet, String wholePeriod, Double yearTotal, Double laterTotal) {
        writeOverview(sheet, wholePeriod, yearTotal, laterTotal, "총 계");
    }
```

- [ ] **Step 6: `계` 테스트가 실패하는지 확인한다**

```powershell
./gradlew test --tests '*CapitalDeclaredAmountsTest.readsSummaryRowLabeledSimpleTotal*'
```

Expected: FAIL — 경고에 `요약표를 찾지 못했습니다`가 포함된다.

- [ ] **Step 7: 합계 라벨 후보에 정확 일치 `계`를 추가한다**

`CapitalOverviewReader.declaredAmounts()`의 검색 한 줄을 바꾼다.

```java
        Optional<Integer> totalRow =
                scanner.findLabelRow(sheet, new int[] {0, 2}, "총 계", "총계", "계");
```

- [ ] **Step 8: 자본예산 관련 테스트와 포맷을 통과시킨다**

```powershell
./gradlew spotlessApply
./gradlew test --tests '*ResourceTableReaderTest*' --tests '*CapitalDeclaredAmountsTest*'
```

Expected: PASS.

- [ ] **Step 9: Task 1을 백엔드 저장소에 커밋한다**

```powershell
git add -- src/main/java/com/kdb/it/domain/migration/request/service/adapter/ResourceTableReader.java src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReader.java src/test/java/com/kdb/it/domain/migration/request/service/adapter/ResourceTableReaderTest.java src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalDeclaredAmountsTest.java
git diff --cached --stat
git commit -m 'fix: 신양식 자본예산 레이아웃 인식 보강'
```

Expected staged files: 위 네 파일만 표시된다.

---

### Task 2: 확인된 옵션 표기를 충돌 없이 정규화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/FormLexicon.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/FormLexiconTest.java`

**Interfaces:**
- Consumes: `SheetAnchorScanner.normalize(String) -> String`
- Produces: `FormLexicon.canonicalOptionName(String) -> String`
- Rule: 정확 일치 우선, 포함 별칭의 표준값 집합이 정확히 1개일 때만 자동 결정

- [ ] **Step 1: 별칭·복합 문구·충돌 테스트를 먼저 추가한다**

`FormLexiconTest.canonicalizesOptionNames()`에 다음 assertion을 추가한다.

```java
        assertThat(FormLexicon.canonicalOptionName("IDT본부장")).isEqualTo("부문(본부)장");
        assertThat(
                        FormLexicon.canonicalOptionName(
                                "추진계획 검토중 (유관부서검토 여부 : ) (변동가능성 有), N"))
                .isEqualTo("미정(검토중)");
        assertThat(FormLexicon.canonicalOptionName("부서장 보고 / 추진계획 검토중"))
                .isEqualTo("부서장 보고 / 추진계획 검토중");
```

- [ ] **Step 2: 실패를 확인한다**

```powershell
./gradlew test --tests '*FormLexiconTest.canonicalizesOptionNames*'
```

Expected: FAIL — `IDT본부장`과 복합 추진가능성 문구가 원문으로 반환된다.

- [ ] **Step 3: 단일 표준값으로 수렴하는 포함 별칭만 허용한다**

`FormLexicon.java`에 import를 추가한다.

```java
import java.util.LinkedHashSet;
```

`canonicalOptionName()`을 다음처럼 바꾼다.

```java
    public static String canonicalOptionName(String raw) {
        if (raw == null) return "";
        String normalized = SheetAnchorScanner.normalize(raw);
        String exact = OPTION_CANONICAL.get(normalized);
        if (exact != null) return exact;

        Set<String> contained = new LinkedHashSet<>();
        for (Map.Entry<String, String> alias : OPTION_CANONICAL.entrySet()) {
            if (normalized.contains(alias.getKey())) contained.add(alias.getValue());
        }
        return contained.size() == 1 ? contained.iterator().next() : raw.trim();
    }
```

`optionCanonical()`의 전결권자 별칭에 다음 줄을 추가한다.

```java
        alias(map, "IDT본부장", "부문(본부)장");
```

JavaDoc에는 “포함 별칭이 모두 같은 코드값명으로 수렴할 때만 접고, 충돌하면 원문을 유지한다”는 실패 조건을 적는다.

- [ ] **Step 4: 옵션 어휘 테스트를 통과시킨다**

```powershell
./gradlew spotlessApply
./gradlew test --tests '*FormLexiconTest*'
```

Expected: PASS.

- [ ] **Step 5: Task 2를 백엔드 저장소에 커밋한다**

```powershell
git add -- src/main/java/com/kdb/it/domain/migration/request/service/FormLexicon.java src/test/java/com/kdb/it/domain/migration/request/service/FormLexiconTest.java
git diff --cached --stat
git commit -m 'fix: 편성요청서 옵션 어휘 정규화 보강'
```

---

### Task 3: 백엔드 보관 그룹 키를 순수 함수로 분리

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormArchiveGroup.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormArchiveGroupTest.java`

**Interfaces:**
- Produces: package-private `RequestFormArchiveGroup.keyOf(String fileKey) -> String`
- Result: 선택 루트부터 번호 사업 폴더, 첫 하위 폴더 또는 부서 폴더까지의 `/` 경로
- Failure boundary: 파일명뿐이거나 빈 값이면 `""`; 파일 시스템에는 접근하지 않음

- [ ] **Step 1: 실제 샘플 구조를 고정하는 실패 테스트를 만든다**

`RequestFormArchiveGroupTest.java`를 다음 내용으로 만든다.

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RequestFormArchiveGroupTest {

    @Test
    @DisplayName("번호 사업 폴더 아래의 요청서와 견적서를 같은 그룹으로 묶는다")
    void groupsNumberedBusinessFolderAndDescendants() {
        assertThat(
                        RequestFormArchiveGroup.keyOf(
                                "2026/IT기획부(180)/_IT인프라팀/붙임2/01. VDI/요청서.xlsx"))
                .isEqualTo("2026/IT기획부(180)/_IT인프라팀/붙임2/01. VDI");
        assertThat(
                        RequestFormArchiveGroup.keyOf(
                                "2026/IT기획부(180)/_IT인프라팀/붙임2/01. VDI/(견적서)/견적.pdf"))
                .isEqualTo("2026/IT기획부(180)/_IT인프라팀/붙임2/01. VDI");
    }

    @Test
    @DisplayName("번호 사업 폴더가 없으면 부서의 첫 하위 폴더를 그룹으로 쓴다")
    void groupsFirstFolderBelowDepartment() {
        assertThat(
                        RequestFormArchiveGroup.keyOf(
                                "2026/IT기획부(180)/_품질관리팀/근거.pdf"))
                .isEqualTo("2026/IT기획부(180)/_품질관리팀");
    }

    @Test
    @DisplayName("부서 직속 파일과 Windows 구분자를 정규화한다")
    void groupsDepartmentRootAndNormalizesSeparators() {
        assertThat(RequestFormArchiveGroup.keyOf("2026\\PF2실(127)\\요청서.xls"))
                .isEqualTo("2026/PF2실(127)");
    }

    @Test
    @DisplayName("코드 부서가 없으면 첫 폴더를 부서로 사용한다")
    void fallsBackToFirstFolder() {
        assertThat(RequestFormArchiveGroup.keyOf("런던지점/2026/붙임.xls"))
                .isEqualTo("런던지점/2026");
    }

    @Test
    @DisplayName("폴더가 없는 파일은 보관 그룹을 만들지 않는다")
    void returnsEmptyWithoutFolder() {
        assertThat(RequestFormArchiveGroup.keyOf("요청서.xlsx")).isEmpty();
        assertThat(RequestFormArchiveGroup.keyOf(null)).isEmpty();
    }
}
```

- [ ] **Step 2: 새 타입이 없어 컴파일 실패하는지 확인한다**

```powershell
./gradlew test --tests '*RequestFormArchiveGroupTest*'
```

Expected: FAIL — `RequestFormArchiveGroup`을 찾을 수 없다.

- [ ] **Step 3: 경로만 해석하는 package-private 유틸리티를 구현한다**

`RequestFormArchiveGroup.java`를 다음 내용으로 만든다.

```java
package com.kdb.it.domain.migration.request.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** 편성요청서 상대경로에서 원본 보관 그룹 키를 계산합니다. */
final class RequestFormArchiveGroup {

    private static final Pattern DEPARTMENT_FOLDER =
            Pattern.compile(".*[(（]\\s*[0-9A-Za-z]{1,100}\\s*[)）]$");
    private static final Pattern NUMBERED_FOLDER = Pattern.compile("^\\s*\\d{1,3}\\..*");

    private RequestFormArchiveGroup() {
        throw new UnsupportedOperationException("경로 유틸리티 — 인스턴스화 금지");
    }

    /**
     * 파일 상대경로를 사업 보관 그룹으로 접습니다.
     *
     * @param fileKey 브라우저가 보낸 상대경로
     * @return `/` 구분 그룹 키. 폴더가 없으면 빈 문자열
     */
    static String keyOf(String fileKey) {
        if (fileKey == null || fileKey.isBlank()) return "";

        List<String> segments = new ArrayList<>();
        for (String segment : fileKey.replace('\\', '/').split("/")) {
            if (!segment.isBlank()) segments.add(segment);
        }
        if (segments.size() < 2) return "";

        List<String> folders = segments.subList(0, segments.size() - 1);
        int departmentIndex = 0;
        for (int i = folders.size() - 1; i >= 0; i--) {
            if (DEPARTMENT_FOLDER.matcher(folders.get(i)).matches()) {
                departmentIndex = i;
                break;
            }
        }

        int groupEnd = departmentIndex;
        boolean numbered = false;
        for (int i = departmentIndex + 1; i < folders.size(); i++) {
            if (!NUMBERED_FOLDER.matcher(folders.get(i)).matches()) continue;
            groupEnd = i;
            numbered = true;
            break;
        }
        if (!numbered && departmentIndex + 1 < folders.size()) groupEnd = departmentIndex + 1;
        return String.join("/", folders.subList(0, groupEnd + 1));
    }
}
```

- [ ] **Step 4: 그룹 키 테스트와 포맷을 통과시킨다**

```powershell
./gradlew spotlessApply
./gradlew test --tests '*RequestFormArchiveGroupTest*'
```

Expected: PASS.

- [ ] **Step 5: Task 3을 백엔드 저장소에 커밋한다**

```powershell
git add -- src/main/java/com/kdb/it/domain/migration/request/service/RequestFormArchiveGroup.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormArchiveGroupTest.java
git diff --cached --stat
git commit -m 'feat: 편성요청서 원본 보관 그룹 계산 추가'
```

---

### Task 4: 보관 계획을 사업 그룹과 실제 부서코드로 제한

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiver.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormImportService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiverTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormImportServiceTest.java`

**Interfaces:**
- Consumes: `RequestFormArchiveGroup.keyOf(String fileKey)` from Task 3
- Produces: `ArchivePlanItem(MultipartFile file, String archiveGroupKey, String effectiveDeptCode, FileResult result)`
- Produces: archiver group key `(archiveGroupKey, effectiveDeptCode)`
- Produces: `SKIPPED` Excel도 유효 부서코드를 가진 보관 계획 항목
- Produces: `ImportSummary.totalFiles == files.size()`

- [ ] **Step 1: 서로 다른 사업 그룹이 섞이지 않는 실패 테스트를 추가한다**

`RequestFormSourceFileArchiverTest.java`에 다음 테스트를 추가한다.

```java
    @Test
    @DisplayName("같은 부서의 서로 다른 번호 사업 폴더는 원본을 공유하지 않는다")
    void archive_doesNotCrossArchiveGroupsInSameDepartment() {
        RequestFormDto.FileResult first =
                result(
                        "2026/IT부(D01)/01. 사업A/요청서.xlsx",
                        "IT부(D01)",
                        RequestFormDto.FileStatus.APPLIED,
                        List.of("APF-A"));
        RequestFormDto.FileResult second =
                result(
                        "2026/IT부(D01)/02. 사업B/요청서.xlsx",
                        "IT부(D01)",
                        RequestFormDto.FileStatus.APPLIED,
                        List.of("APF-B"));
        List<RequestFormSourceFileArchiver.ArchivePlanItem> plan =
                List.of(
                        new RequestFormSourceFileArchiver.ArchivePlanItem(
                                file("a.xlsx"), "2026/IT부(D01)/01. 사업A", "D01", first),
                        new RequestFormSourceFileArchiver.ArchivePlanItem(
                                file("b.xlsx"), "2026/IT부(D01)/02. 사업B", "D01", second));
        assertThat(plan)
                .extracting(RequestFormSourceFileArchiver.ArchivePlanItem::archiveGroupKey)
                .containsExactly("2026/IT부(D01)/01. 사업A", "2026/IT부(D01)/02. 사업B");
        given(fileService.uploadFile(any(), any())).willReturn("FL-A", "FL-B");

        archiver.archive(plan);

        ArgumentCaptor<FileDto.UploadRequest> requestCaptor =
                ArgumentCaptor.forClass(FileDto.UploadRequest.class);
        then(fileService).should(times(2)).uploadFile(any(), requestCaptor.capture());
        then(fileService).should(never()).linkExistingFile(any(), any());
        assertThat(requestCaptor.getAllValues())
                .extracting(FileDto.UploadRequest::getPkCone)
                .containsExactlyInAnyOrder("APF-A", "APF-B");
    }
```

- [ ] **Step 2: 같은 그룹의 요청서·증빙 Excel·PDF 연결 테스트를 추가한다**

같은 테스트 클래스에 다음 테스트를 추가한다.

```java
    @Test
    @DisplayName("같은 사업 그룹의 SKIPPED 엑셀과 PDF도 정상 반입 APF에 붙인다")
    void archive_linksSkippedExcelAndPdfInAppliedArchiveGroup() {
        String group = "2026/IT부(D01)/01. 사업A";
        RequestFormDto.FileResult applied =
                result(
                        group + "/요청서.xlsx",
                        "IT부(D01)",
                        RequestFormDto.FileStatus.APPLIED,
                        List.of("APF-A"));
        RequestFormDto.FileResult skipped =
                result(
                        group + "/산출근거.xlsx",
                        "IT부(D01)",
                        RequestFormDto.FileStatus.SKIPPED,
                        List.of());
        List<RequestFormSourceFileArchiver.ArchivePlanItem> plan =
                List.of(
                        new RequestFormSourceFileArchiver.ArchivePlanItem(
                                file("요청서.xlsx"), group, "D01", applied),
                        new RequestFormSourceFileArchiver.ArchivePlanItem(
                                file("산출근거.xlsx"), group, "D01", skipped),
                        new RequestFormSourceFileArchiver.ArchivePlanItem(
                                file("견적.pdf"), group, "D01", null));
        given(fileService.uploadFile(any(), any())).willReturn("FL-1", "FL-2", "FL-3");

        archiver.archive(plan);

        ArgumentCaptor<MultipartFile> fileCaptor = ArgumentCaptor.forClass(MultipartFile.class);
        then(fileService).should(times(3)).uploadFile(fileCaptor.capture(), any());
        assertThat(fileCaptor.getAllValues())
                .extracting(MultipartFile::getOriginalFilename)
                .containsExactly("요청서.xlsx", "산출근거.xlsx", "견적.pdf");
    }
```

- [ ] **Step 3: 현재 부서명 그룹 구현에서 첫 테스트가 실패하는지 확인한다**

```powershell
./gradlew test --tests '*RequestFormSourceFileArchiverTest*'
```

Expected: FAIL — `ArchivePlanItem.archiveGroupKey()` 접근자가 아직 없어 테스트가 컴파일되지 않는다.

- [ ] **Step 4: 보관 계획과 그룹 키를 `archiveGroupKey` 중심으로 바꾼다**

`RequestFormSourceFileArchiver.ArchivePlanItem`과 내부 키를 다음 형태로 바꾼다.

```java
    /** 파일별 처리 결과와 원본 보관 그룹·실제 검증 부서코드를 묶습니다. */
    record ArchivePlanItem(
            MultipartFile file,
            String archiveGroupKey,
            String effectiveDeptCode,
            RequestFormDto.FileResult result) {

        ArchivePlanItem(
                MultipartFile file, String effectiveDeptCode, RequestFormDto.FileResult result) {
            this(
                    file,
                    result == null ? "" : RequestFormArchiveGroup.keyOf(result.fileKey()),
                    effectiveDeptCode,
                    result);
        }
    }

    /** 사업 폴더와 검증된 부서코드를 모두 보존하는 보관 그룹 키입니다. */
    private record ArchiveGroupKey(String archiveGroupKey, String effectiveDeptCode) {}
```

`archive(...)`의 필터·키 생성과 오류 로그를 다음 기준으로 바꾼다.

```java
            if (!StringUtils.hasText(item.archiveGroupKey()) || !StringUtils.hasText(deptCode)) {
                continue;
            }
            ArchiveGroupKey groupKey =
                    new ArchiveGroupKey(item.archiveGroupKey(), deptCode);
```

```java
            log.error(
                    "편성요청서 반입 원본 보관 실패: archiveGroup={}, deptCode={}, apfMngNo={}, fileName={}",
                    groupKey.archiveGroupKey(),
                    groupKey.effectiveDeptCode(),
                    firstApfMngNo,
                    file.getOriginalFilename(),
                    e);
```

`linkExistingFile` 실패 로그도 같은 필드 순서로 바꾼다. 클래스 JavaDoc의 보관 단위를 “원본 최상위 폴더”에서 “사업 보관 그룹”으로 고친다. 파일 수집은 상태와 무관하게 유지하고 APF 번호는 `APPLIED` 결과에서만 수집한다.

- [ ] **Step 5: archiver 테스트를 통과시킨다**

기존 4인자 `ArchivePlanItem` 테스트 데이터의 두 번째 인자는 의미가 `deptName`에서 `archiveGroupKey`로 바뀐다. 부서 루트 테스트는 기존 문자열을 그대로 그룹 키로 사용하고, 다른 폴더 테스트는 서로 다른 경로를 유지한다.

```powershell
./gradlew spotlessApply
./gradlew test --tests '*RequestFormSourceFileArchiverTest*'
```

Expected: PASS — 같은 그룹의 3개 파일은 업로드 3회, 다른 번호 그룹은 링크 0회다.

- [ ] **Step 6: 실제 전송 수와 `SKIPPED` 보관 계획 실패 테스트를 추가한다**

`RequestFormImportServiceTest.commit_keepsArchiveOnlyFileOutOfImportResults()`에서 다음 기대값과 그룹 assertion을 사용한다.

```java
        assertThat(response.files()).singleElement();
        assertThat(response.summary().totalFiles()).isEqualTo(2);
```

```java
        assertThat(planCaptor.getValue())
                .extracting(RequestFormSourceFileArchiver.ArchivePlanItem::archiveGroupKey)
                .containsExactly("자금운용실", "자금운용실");
```

같은 테스트 클래스에 commit 경로의 `SKIPPED` 검증을 추가한다.

```java
    @Test
    @DisplayName("SKIPPED 엑셀도 그룹 키와 해석된 부서코드로 보관 계획에 남긴다")
    void commit_keepsSkippedExcelInArchivePlan() {
        RequestFormDto.FileEntry entry =
                new RequestFormDto.FileEntry(
                        "2026/자금운용실(420)/팀1/사업1/참고자료.xls",
                        "자금운용실(420)",
                        null,
                        AmountUnit.WON,
                        "571");

        RequestFormDto.ImportResponse response =
                service(50)
                        .importBatch(
                                List.of(
                                        file(
                                                "참고자료.xls",
                                                RequestFormFixtures.unrelatedSheetXls())),
                                new RequestFormDto.ImportManifest(
                                        "2026", List.of(entry), List.of()),
                                "12345678",
                                false);

        assertThat(response.files())
                .singleElement()
                .extracting(RequestFormDto.FileResult::status)
                .isEqualTo(RequestFormDto.FileStatus.SKIPPED);
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<RequestFormSourceFileArchiver.ArchivePlanItem>> planCaptor =
                ArgumentCaptor.forClass(List.class);
        org.mockito.Mockito.verify(sourceFileArchiver).archive(planCaptor.capture());
        assertThat(planCaptor.getValue())
                .singleElement()
                .satisfies(
                        item -> {
                            assertThat(item.archiveGroupKey())
                                    .isEqualTo("2026/자금운용실(420)/팀1");
                            assertThat(item.effectiveDeptCode()).isEqualTo("0210");
                        });
    }
```

- [ ] **Step 7: import service 테스트가 실패하는지 확인한다**

```powershell
./gradlew test --tests '*RequestFormImportServiceTest*'
```

Expected: FAIL — archive-only 포함 `totalFiles`가 1이고, `SKIPPED` 계획의 부서코드가 null이다.

- [ ] **Step 8: 모든 파일의 보관 그룹과 `SKIPPED` 부서코드를 보존한다**

`RequestFormImportService.importBatch(...)` 반복문에서 `ArchivePlanItem`을 만들 때 다음 값을 전달한다.

```java
            String archiveGroupKey = RequestFormArchiveGroup.keyOf(entry.fileKey());
```

archive-only 분기:

```java
                archivePlan.add(
                        new RequestFormSourceFileArchiver.ArchivePlanItem(
                                file, archiveGroupKey, deptCode, null));
```

파싱 대상 분기:

```java
            archivePlan.add(
                    new RequestFormSourceFileArchiver.ArchivePlanItem(
                            file,
                            archiveGroupKey,
                            processed.effectiveDeptCode(),
                            processed.result()));
```

`processFile(...)`의 빈 시트 분기는 부서코드를 함께 반환하도록 바꾼다.

```java
            if (sheets.isEmpty()) {
                return new ProcessedFile(skipped(entry), resolveDepartmentCode(entry, orgIndex));
            }
```

응답 요약은 실제 multipart 파일 수를 전달한다.

```java
        return new RequestFormDto.ImportResponse(
                dryRun, summarize(files.size(), results), List.copyOf(results));
```

- [ ] **Step 9: import·archiver 서비스 테스트를 통과시킨다**

```powershell
./gradlew spotlessApply
./gradlew test --tests '*RequestFormImportServiceTest*' --tests '*RequestFormSourceFileArchiverTest*'
```

Expected: PASS.

- [ ] **Step 10: Task 4를 백엔드 저장소에 커밋한다**

```powershell
git add -- src/main/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiver.java src/main/java/com/kdb/it/domain/migration/request/service/RequestFormImportService.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiverTest.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormImportServiceTest.java
git diff --cached --stat
git commit -m 'fix: 편성요청서 원본을 사업 그룹별로 보관'
```

---

### Task 5: 프론트에서 보관 그룹을 나누지 않는 배치 만들기

**Files:**
- Modify: `it_frontend/app/composables/migration/useRequestFormUpload.ts`
- Modify: `it_frontend/i18n/messages/admin.ts`
- Test: `it_frontend/tests/unit/composables/migration/useRequestFormUpload.test.ts`

**Interfaces:**
- Produces: `archiveGroupKeyOf(fileKey: string): string`
- Produces: `batchByArchiveGroup(items: SelectedFile[], targetSize: number): SelectedFile[][]`
- Extends: `SelectedFile.archiveGroupKey: string` (프론트 내부 타입, API DTO 아님)
- Constant: `MAX_FILES_PER_BATCH = 50`
- Error: 단일 그룹 51개 이상이면 번역된 `Error`를 API 호출 전에 throw

- [ ] **Step 1: 경로 그룹의 백엔드 계약 예시를 프론트 테스트에 복제한다**

`useRequestFormUpload.test.ts` import를 다음처럼 갱신한다.

```ts
import {
    BATCH_SIZE,
    MAX_FILES_PER_BATCH,
    archiveGroupKeyOf,
    batchByArchiveGroup,
    collectFiles,
    openSelectedFile,
    useRequestFormUpload,
} from '~/composables/migration/useRequestFormUpload';
```

기존 `describe('chunk')` 블록을 다음 테스트로 교체한다.

```ts
describe('archiveGroupKeyOf', () => {
    it('번호 사업 폴더와 그 아래 견적서를 같은 그룹으로 묶는다', () => {
        expect(
            archiveGroupKeyOf(
                '2026/IT기획부(180)/_IT인프라팀/붙임2/01. VDI/요청서.xlsx',
            ),
        ).toBe('2026/IT기획부(180)/_IT인프라팀/붙임2/01. VDI');
        expect(
            archiveGroupKeyOf(
                '2026/IT기획부(180)/_IT인프라팀/붙임2/01. VDI/(견적서)/견적.pdf',
            ),
        ).toBe('2026/IT기획부(180)/_IT인프라팀/붙임2/01. VDI');
    });

    it('팀 폴더·부서 직속 파일·Windows 구분자를 처리한다', () => {
        expect(archiveGroupKeyOf('2026/IT기획부(180)/_품질관리팀/근거.pdf')).toBe(
            '2026/IT기획부(180)/_품질관리팀',
        );
        expect(archiveGroupKeyOf('2026\\PF2실(127)\\요청서.xls')).toBe('2026/PF2실(127)');
        expect(archiveGroupKeyOf('요청서.xlsx')).toBe('');
    });
});
```

- [ ] **Step 2: 그룹 보존 배치 실패 테스트를 추가한다**

```ts
describe('batchByArchiveGroup', () => {
    it('20개 경계에서 같은 그룹을 둘로 나누지 않는다', () => {
        const singles = Array.from({ length: 19 }, (_, index) =>
            fileWith(`2026/IT기획부(180)/${index + 1}. 단건/요청서.xlsx`),
        );
        const grouped = [
            fileWith('2026/IT기획부(180)/20. 묶음/요청서.xlsx'),
            fileWith('2026/IT기획부(180)/20. 묶음/견적.xlsx'),
            fileWith('2026/IT기획부(180)/20. 묶음/근거.pdf'),
        ];
        const selected = collectFiles([...singles, ...grouped]);

        expect(batchByArchiveGroup(selected, BATCH_SIZE).map((batch) => batch.length)).toEqual([
            19, 3,
        ]);
    });

    it('단일 21개 그룹은 하나의 배치로 유지한다', () => {
        const selected = collectFiles(
            Array.from({ length: 21 }, (_, index) =>
                fileWith(`2026/IT기획부(180)/01. 대형사업/근거${index}.pdf`),
            ),
        );

        expect(batchByArchiveGroup(selected, BATCH_SIZE).map((batch) => batch.length)).toEqual([
            21,
        ]);
        expect(MAX_FILES_PER_BATCH).toBe(50);
    });
});
```

기존 `manyFiles()`는 파일마다 다른 번호 그룹을 만들도록 바꿔 종전 25개 테스트의 20+5 의미를 유지한다.

```ts
    function manyFiles(count: number): File[] {
        return Array.from({ length: count }, (_, index) =>
            fileWith(
                `2026/IT기획부(180)/${index + 1}. 단건사업/요청서${index + 1}.xlsx`,
            ),
        );
    }
```

- [ ] **Step 3: 새 함수가 없어 테스트가 실패하는지 확인한다**

Run from `C:\it\it_frontend`:

```powershell
npm test -- tests/unit/composables/migration/useRequestFormUpload.test.ts
```

Expected: FAIL — 새 export를 찾을 수 없다.

- [ ] **Step 4: 백엔드와 같은 경로 규칙과 그룹 배치를 구현한다**

`useRequestFormUpload.ts` 상단에 상수와 패턴을 추가한다.

```ts
/** 서버가 한 요청에서 허용하는 최대 파일 수. */
export const MAX_FILES_PER_BATCH = 50;

/** 사업 폴더 표기 `01. 사업명`의 시작 패턴. */
const NUMBERED_FOLDER_PATTERN = /^\s*\d{1,3}\..*/;
```

`SelectedFile`에 내부 그룹 키를 추가한다.

```ts
    /** 요청서와 증빙을 함께 보관할 사업 폴더 상대경로 */
    archiveGroupKey: string;
```

`collectFiles()`보다 위에 다음 함수를 추가한다.

```ts
/** 파일 상대경로를 백엔드와 동일한 원본 보관 그룹 키로 접습니다. */
export function archiveGroupKeyOf(fileKey: string): string {
    const segments = fileKey
        .replaceAll('\\', '/')
        .split('/')
        .filter((segment) => segment.trim().length > 0);
    if (segments.length < 2) return '';

    const folders = segments.slice(0, -1);
    let departmentIndex = 0;
    for (let i = folders.length - 1; i >= 0; i--) {
        if (DEPT_FOLDER_PATTERN.test(folders[i] ?? '')) {
            departmentIndex = i;
            break;
        }
    }

    let groupEnd = departmentIndex;
    const numberedIndex = folders.findIndex(
        (folder, index) => index > departmentIndex && NUMBERED_FOLDER_PATTERN.test(folder),
    );
    if (numberedIndex >= 0) groupEnd = numberedIndex;
    else if (departmentIndex + 1 < folders.length) groupEnd = departmentIndex + 1;
    return folders.slice(0, groupEnd + 1).join('/');
}
```

`collectFiles()`가 선택 항목에 키를 저장하도록 한다.

```ts
        selected.push({
            file,
            fileKey,
            deptName: deptFolderOf(fileKey.replaceAll('\\', '/').split('/')),
            archiveGroupKey: archiveGroupKeyOf(fileKey),
            archiveOnly,
        });
```

기존 `chunk<T>()`를 다음 전용 함수와 내부 그룹 함수로 교체한다.

```ts
function filesByArchiveGroup(items: SelectedFile[]): SelectedFile[][] {
    const grouped = new Map<string, SelectedFile[]>();
    for (const item of items) {
        const group = grouped.get(item.archiveGroupKey) ?? [];
        group.push(item);
        grouped.set(item.archiveGroupKey, group);
    }
    return [...grouped.values()];
}

/** 목표 크기를 넘더라도 같은 사업 그룹을 나누지 않고 배치를 만듭니다. */
export function batchByArchiveGroup(
    items: SelectedFile[],
    targetSize: number,
): SelectedFile[][] {
    const batches: SelectedFile[][] = [];
    let current: SelectedFile[] = [];
    for (const group of filesByArchiveGroup(items)) {
        if (current.length > 0 && current.length + group.length > targetSize) {
            batches.push(current);
            current = [];
        }
        current.push(...group);
        if (current.length >= targetSize) {
            batches.push(current);
            current = [];
        }
    }
    if (current.length > 0) batches.push(current);
    return batches;
}
```

- [ ] **Step 5: 경로·배치 단위 테스트를 통과시킨다**

```powershell
npm exec prettier -- --write app/composables/migration/useRequestFormUpload.ts tests/unit/composables/migration/useRequestFormUpload.test.ts
npm test -- tests/unit/composables/migration/useRequestFormUpload.test.ts
```

Expected: 기존 composable 테스트를 포함해 PASS.

- [ ] **Step 6: 51개 단일 그룹의 실행 차단 테스트를 추가한다**

`useRequestFormUpload` describe의 `beforeEach`에 번역 stub을 추가한다.

```ts
        vi.stubGlobal('useI18n', () => ({
            t: (key: string, params?: Record<string, unknown>) =>
                `${key}:${params?.group}:${params?.count}:${params?.max}`,
        }));
```

다음 테스트를 추가한다.

```ts
    it('단일 그룹이 50개를 넘으면 API 호출 전에 중단한다', async () => {
        const upload = useRequestFormUpload();
        upload.selectFiles(
            Array.from({ length: 51 }, (_, index) =>
                fileWith(`2026/IT기획부(180)/01. 대형사업/근거${index}.pdf`),
            ),
        );

        await expect(upload.runDryRun('2026', [], [])).rejects.toThrow(
            'admin.requestForm.archiveGroupTooLarge:2026/IT기획부(180)/01. 대형사업:51:50',
        );
        expect(apiFetch).not.toHaveBeenCalled();
        expect(upload.isRunning.value).toBe(false);
    });
```

- [ ] **Step 7: 번역 문구와 실행 전 그룹 상한 검사를 구현한다**

`i18n/messages/admin.ts`의 한국어·영어 `admin.requestForm`에 각각 추가한다.

```ts
                archiveGroupTooLarge:
                    '사업 폴더 {group}의 파일이 {count}개라 한 번에 반입할 수 없습니다. 최대 {max}개로 정리해 주세요.',
```

```ts
                archiveGroupTooLarge:
                    'The business folder {group} contains {count} files. Reduce it to {max} files or fewer.',
```

`useRequestFormUpload()` 시작부에서 번역 함수를 얻고 계산 배치를 교체한다.

```ts
    const { t } = useI18n();
```

```ts
    const batches = computed(() => batchByArchiveGroup(files.value, BATCH_SIZE));
```

`run(...)`의 `isRunning.value = true`보다 앞에 다음 검사를 둔다.

```ts
        const oversized = filesByArchiveGroup(files.value).find(
            (group) => group.length > MAX_FILES_PER_BATCH,
        );
        if (oversized) {
            throw new Error(
                t('admin.requestForm.archiveGroupTooLarge', {
                    group: oversized[0]?.archiveGroupKey ?? '',
                    count: oversized.length,
                    max: MAX_FILES_PER_BATCH,
                }),
            );
        }
```

함수 JavaDoc의 `@throws`에 “단일 보관 그룹이 50개를 넘는 경우”를 추가한다.

- [ ] **Step 8: 프론트 단위·정적 검사를 통과시킨다**

```powershell
npm exec prettier -- --write app/composables/migration/useRequestFormUpload.ts i18n/messages/admin.ts tests/unit/composables/migration/useRequestFormUpload.test.ts
npm test -- tests/unit/composables/migration/useRequestFormUpload.test.ts
npm run check
```

Expected: PASS — 고정 사용자 문구 ratchet도 증가하지 않는다.

- [ ] **Step 9: Task 5를 프론트 저장소에 커밋한다**

```powershell
git add -- app/composables/migration/useRequestFormUpload.ts i18n/messages/admin.ts tests/unit/composables/migration/useRequestFormUpload.test.ts
git diff --cached --stat
git commit -m 'fix: 편성요청서 보관 그룹 단위로 배치'
```

---

### Task 6: 2026 샘플 회귀와 전체 품질 게이트 고정

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestForm2026SampleSmokeTest.java`
- Modify: `versions.lock`

**Interfaces:**
- Consumes: 로컬 형제 경로 `../sample/2026` (없으면 JUnit assumption으로 skip)
- Verifies: Excel 44건 모두 open, 요청서 32건 classify, 증빙 Excel 12건 skip
- Produces: 호환되는 backend/frontend HEAD를 루트 `versions.lock`에 기록

- [ ] **Step 1: 로컬 샘플이 있을 때만 실행되는 smoke test를 만든다**

`RequestForm2026SampleSmokeTest.java`를 다음 내용으로 만든다.

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import org.apache.poi.ss.usermodel.Workbook;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RequestForm2026SampleSmokeTest {

    private final WorkbookReader reader = new WorkbookReader(10_485_760L, 20, 5000);

    @Test
    @DisplayName("2026 샘플 Excel을 모두 열고 요청서와 증빙을 기존 개수로 분류한다")
    void opensAndClassifiesSample2026() throws IOException {
        Path sampleRoot = Path.of("..", "sample", "2026").toAbsolutePath().normalize();
        Assumptions.assumeTrue(Files.isDirectory(sampleRoot), "로컬 2026 샘플이 없어 건너뜁니다");

        List<Path> excelFiles;
        try (var paths = Files.walk(sampleRoot)) {
            excelFiles =
                    paths.filter(Files::isRegularFile)
                            .filter(RequestForm2026SampleSmokeTest::isExcel)
                            .sorted()
                            .toList();
        }

        int requestForms = 0;
        for (Path path : excelFiles) {
            String fileKey = sampleRoot.relativize(path).toString().replace('\\', '/');
            try (Workbook workbook = reader.open(Files.readAllBytes(path), fileKey)) {
                if (!reader.classify(workbook).isEmpty()) requestForms++;
            }
        }

        assertThat(excelFiles).hasSize(44);
        assertThat(requestForms).isEqualTo(32);
        assertThat(excelFiles.size() - requestForms).isEqualTo(12);
    }

    private static boolean isExcel(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        return name.endsWith(".xls") || name.endsWith(".xlsx");
    }
}
```

- [ ] **Step 2: 샘플 smoke test를 실행한다**

Run from `C:\it\it_backend`:

```powershell
./gradlew spotlessApply
./gradlew test --tests '*RequestForm2026SampleSmokeTest*'
```

Expected on `C:\it`: PASS — Excel 44, 요청서 32, 증빙 Excel 12. 형제 `sample/2026`이 없는 독립 CI에서는 SKIPPED.

- [ ] **Step 3: 샘플 smoke test를 백엔드 저장소에 커밋한다**

```powershell
git add -- src/test/java/com/kdb/it/domain/migration/request/service/RequestForm2026SampleSmokeTest.java
git diff --cached --stat
git commit -m 'test: 2026 편성요청서 샘플 회귀 고정'
```

- [ ] **Step 4: 백엔드 전체 게이트를 실행한다**

Run from `C:\it\it_backend`:

```powershell
./gradlew check
./gradlew bootJar
```

Expected: 두 명령 모두 exit code 0. 실패하면 해당 Task의 마지막 백엔드 커밋 이후 수정 파일만 경로 지정해 별도 fix 커밋한다.

- [ ] **Step 5: 프론트 전체 게이트와 API 무변경을 확인한다**

Run from `C:\it\it_frontend`:

```powershell
npm run format:check
npm run check
npm test
npm run codegen:check
```

Expected: 모두 exit code 0, `app/types/api.d.ts` diff 없음.

- [ ] **Step 6: 실제 2026 폴더를 dry-run으로 회귀 확인한다**

로컬 백엔드와 프론트를 프로젝트 표준 명령으로 실행한 뒤 `/admin/migration/requests`에서
`C:\it\sample\2026`을 선택한다. commit 버튼은 누르지 않고 dry-run 결과만 확인한다.

Expected:

```text
전체 선택 파일: 61
Excel open 실패: 0
요청서 시트 인식: 32
증빙 Excel SKIPPED: 12
품질관리 신양식 1-2 그룹 CODE_UNRESOLVED 4건: 0
품질관리 신양식 `계` 합계 누락: 0
업무 판단 대상 BLOCKED: 자동 APPLIED로 전환되지 않음
```

배치 개발자 도구의 multipart 요청도 확인한다.

```text
같은 archiveGroupKey의 fileKey는 한 요청에만 존재
요청당 files 파트 수 <= 50
응답 summary.totalFiles == 해당 요청의 files 파트 수
```

- [ ] **Step 7: 세 저장소의 예상 파일만 변경됐는지 확인한다**

Run from `C:\it`:

```powershell
git status --short
git -C it_backend status --short
git -C it_frontend status --short
git -C it_database status --short
```

Expected: 루트에는 사용자의 `sample/2026` 변경만 남고, backend/frontend/database는 clean. 예상 밖 파일이 있으면 소유자를 확인하고 되돌리지 않은 채 원인을 분리한다.

- [ ] **Step 8: 호환 커밋 조합을 `versions.lock`에 기록한다**

Run from `C:\it`:

```powershell
./scripts/update-versions-lock.ps1
git diff -- versions.lock
git add -- versions.lock
git diff --cached --stat
git commit -m 'chore: 편성요청서 반입 보강 버전 고정'
```

Expected: `versions.lock`의 `it_backend`와 `it_frontend` SHA가 방금 검증한 HEAD로 바뀌고, `it_database` SHA는 현재 HEAD를 유지한다. 루트 커밋에는 `versions.lock`만 포함한다.

- [ ] **Step 9: 최종 증거를 다시 확인한다**

```powershell
git log -1 --oneline
git -C it_backend log -5 --oneline
git -C it_frontend log -2 --oneline
git diff --check
git -C it_backend diff --check
git -C it_frontend diff --check
```

Expected: whitespace 오류가 없고 Task 1~6 커밋과 루트 버전 잠금 커밋이 확인된다. 사용자 `sample/2026` 변경은 여전히 커밋되지 않은 상태로 보존된다.
