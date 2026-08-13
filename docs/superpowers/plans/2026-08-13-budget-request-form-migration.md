# 부점 전산예산 편성요청서 반입 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부점이 제출한 `전산예산 편성 요청서` 엑셀(`.xls`·`.xlsx`)을 폴더 단위로 올려 정보화사업·경상사업·전산업무비 원장으로 반입하는 관리자 화면을 만든다.

**Architecture:** 프론트가 `webkitdirectory`로 폴더를 통째로 올리면 백엔드 Apache POI가 4개 시트를 라벨 앵커로 스캔해 도메인 명령으로 바꾼다. 파일 1개가 `REQUIRES_NEW` 트랜잭션 1개라 검증에 걸린 파일만 건너뛰고 나머지는 반영된다. 원장 생성은 새 INSERT 경로를 만들지 않고 기존 `CostService.createCost`·`ProjectService.createProject`의 이관 전용 오버로드를 호출한다.

**Tech Stack:** Java 25 / Spring Boot 4.1 / Apache POI 5.4.1 / QueryDSL / Oracle · Nuxt 4 / Vue 3 / TypeScript / PrimeVue

**설계 문서:** `docs/superpowers/specs/2026-08-13-budget-request-form-migration-design.md`

## Global Constraints

- 새 자바 패키지는 `com.kdb.it.domain.migration.request` 아래에만 만든다. 기존 `domain.migration` 하위 클래스는 **읽기만 하고 수정하지 않는다**.
- 모든 신규 주석(JavaDoc/TSDoc/인라인)은 한글. public API와 service 메서드는 입력값·반환값·실패 조건을 기록한다.
- 모든 `@Column`에 한글 `comment`. 이 계획은 신규 테이블을 만들지 않으므로 엔티티 추가는 없다.
- 응답 DTO의 모든 속성에 `@Schema(requiredMode = Schema.RequiredMode.REQUIRED)`를 지정하고, null 가능 속성만 `nullable = true`를 붙인다.
- 모든 `@RequestParam`·`@PathVariable`·`@RequestPart`에 `name`을 명시한다.
- 컨트롤러는 클래스 수준 `@PreAuthorize("hasRole('ADMIN')")`.
- 변경 API에 `consumes`를 지정한다. 이 기능은 `MediaType.MULTIPART_FORM_DATA_VALUE`.
- 엔티티·컬럼명은 `C:\it\meta\meta.txt` 메타 용어를 따른다.
- 운영 `.ts`·`.vue` 파일은 800줄(`scripts/max-lines-baselines.mjs`의 `MAX_NEW_FILE_LINES`)을 넘지 않는다. 예외 목록에 추가하지 말고 책임을 분리한다.
- CSS 클래스명은 kebab-case 또는 BEM. **DB 컬럼명을 클래스명에 그대로 쓰지 않는다**(`cttNm` → `ctt-nm-cell`).
- 프론트 서버 요청은 `useApiFetch`(반응형 GET) 또는 `$apiFetch`(명령형·변경)만 쓴다. `FormData`는 반드시 `$apiFetch`로 보낸다 — 원시 `$fetch`는 `X-Requested-With`가 빠져 403이다.
- 예산연도는 화면에서 선택한 값을 쓴다. 서버가 `LocalDate.now().getYear()`로 추측하지 않는다.
- 금액 단위: 1-2 시트와 시트 ②는 원 단위 그대로. 1-1 요약표는 적재하지 않는다. 시트 ③은 요청 본문의 지정 배수를 적용한다.
- 외화 행은 `XCR`을 어댑터가 설정하지 않는다. 서버 `XcrLookupService`가 `Ccodem`에서 결정하고 `BudgetAmountCalculator`가 `FC_AMT × 환율`로 재계산한다. 어댑터는 `XCR_BSE_DT`만 채운다.
- `BBUGTM`(편성행)을 만들지 않는다. `BudgetRateApplicationService.applyItemRates`를 **호출하지 않는다**.
- 업로드 파일을 디스크에 영구 저장하지 않는다. 저장 경로 설정을 추가하지 않는다.
- 로그에 비밀값·토큰·사번·업로드 파일 본문을 남기지 않는다.
- 커밋 메시지 본문은 한글, 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## 선행 전제

Apache POI 폐쇄망 반입이 완료되어 있어야 Task 1부터 착수할 수 있다. 반입 대상은 `poi`, `poi-ooxml`, `poi-ooxml-lite`, `xmlbeans`, `commons-collections4`, `commons-math3`, `SparseBitSet`, `curvesapi`, `log4j-api`이며 `commons-compress-1.27.1`은 이미 `C:\maven-repo`에 있다. 반입 완료 확인 명령은 Task 1 Step 2에 있다.

## 파일 구조

### 백엔드 (신규)

| 파일 | 책임 |
| --- | --- |
| `domain/migration/request/controller/RequestFormController.java` | dry-run·commit 2개 엔드포인트. 권한·`consumes`만 담당 |
| `domain/migration/request/dto/RequestFormDto.java` | 요청·응답 계약 (중첩 record) |
| `domain/migration/request/dto/RequestFormDiagnosticCode.java` | 진단 코드 enum + 심각도 |
| `domain/migration/request/dto/FormSheetKind.java` | 4개 시트 종류 enum |
| `domain/migration/request/service/RequestFormImportService.java` | 배치 오케스트레이션. **트랜잭션 없음** |
| `domain/migration/request/service/RequestFormFileImporter.java` | `REQUIRES_NEW` 파일 1건 반영 |
| `domain/migration/request/service/WorkbookReader.java` | POI 열기·시트 판별·자원 한도 |
| `domain/migration/request/service/SheetAnchorScanner.java` | 라벨·헤더 앵커 스캔, 병합셀 해석 |
| `domain/migration/request/service/FormLexicon.java` | 국문·영문 대조표, Y/N 정규화, 비목 별칭 |
| `domain/migration/request/service/IoeHierarchyIndex.java` | `CO_CDVA_SPS` 계층 → 비목코드 2단계 매칭 |
| `domain/migration/request/service/AmountUnitResolver.java` | 1-1↔1-2 대사 배수 역추정 |
| `domain/migration/request/service/RequestFormValidator.java` | 진단 생성, 자연키 중복 판정 |
| `domain/migration/request/service/adapter/FormSheetAdapter.java` | 어댑터 인터페이스 |
| `domain/migration/request/service/adapter/FormAdapterContext.java` | 어댑터 입력 묶음 |
| `domain/migration/request/service/adapter/FormAdapterOutput.java` | 어댑터 출력 묶음 |
| `domain/migration/request/service/adapter/GeneralExpenseFormAdapter.java` | 시트 ③ → `BCOSTM` |
| `domain/migration/request/service/adapter/RecurringProjectFormAdapter.java` | 시트 ② → `BPROJM`(경상)+`BITEMM` |
| `domain/migration/request/service/adapter/CapitalProjectFormAdapter.java` | 시트 ① 1-1+1-2 → `BPROJM`+`BITEMM` |

### 백엔드 (수정)

| 파일 | 변경 |
| --- | --- |
| `it_backend/build.gradle` | POI 의존성 추가 |
| `it_backend/src/main/resources/application.properties` | 반입 전용 업로드 한도 프로퍼티 추가 |

### 프론트 (신규)

| 파일 | 책임 |
| --- | --- |
| `app/pages/admin/migration/requests.vue` | 라우팅·조합만 |
| `app/composables/migration/useRequestFormPage.ts` | 화면 상태 파사드 |
| `app/composables/migration/useRequestFormUpload.ts` | 폴더 수집·배치 분할·진행률·API 호출 |
| `app/components/migration/RequestFormFolderPicker.vue` | `webkitdirectory` 입력 + 폴더별 부서 확인 |
| `app/components/migration/RequestFormResultTable.vue` | 파일별 진단·보정 표 |

### 프론트 (수정)

| 파일 | 변경 |
| --- | --- |
| `tests/unit/architecture/component-boundaries.test.ts` | `components/migration/` 신규 2종 추가 |
| `tests/unit/pages/…PageBoundary.test.ts` | 신규 페이지 경계 추가 |
| `app/types/api.d.ts` | `npm run codegen` 재생성물 |

### DB

| 파일 | 내용 |
| --- | --- |
| `it_database/migrations/V20260813_001__SeedRequestFormMigrationMenu.sql` | `/admin/migration/requests` `PGE` 메뉴 시드 |

---

## Task 1: POI 의존성과 워크북 열기 방어

`.xls`·`.xlsx`를 모두 열되 손상·위장·자원 폭탄 파일을 입구에서 막는다. 이 태스크가 끝나면 두 형식의 워크북에서 시트 이름 목록을 안전하게 얻을 수 있다.

**Files:**
- Modify: `it_backend/build.gradle`
- Modify: `it_backend/src/main/resources/application.properties:125-127`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/dto/FormSheetKind.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/WorkbookReader.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/migration/request/support/RequestFormFixtures.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/WorkbookReaderTest.java`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `enum FormSheetKind { CAPITAL_OVERVIEW, CAPITAL_RESOURCE, RECURRING, GENERAL_EXPENSE }`
    - `static Optional<FormSheetKind> ofSheetName(String sheetName)`
  - `class WorkbookReader`
    - `Workbook open(byte[] bytes, String originalFilename) throws WorkbookOpenException`
    - `Map<FormSheetKind, Sheet> classify(Workbook workbook)`
    - `static class WorkbookOpenException extends RuntimeException { String reason(); }`
  - `class RequestFormFixtures` (테스트 전용)
    - `static byte[] capitalOnlyXlsx()` — 시트 ①만 채운 워크북 (VDI 샘플 레이아웃)
    - `static byte[] fullFormXls()` — 4시트 전부 있는 BIFF8 워크북 (자금운용실 샘플 레이아웃, 1-1이 41행)
    - `static byte[] englishFormXls()` — 영문 양식 (런던지점 레이아웃)

- [ ] **Step 1: POI 의존성 추가**

`it_backend/build.gradle`의 `dependencies` 블록에서 jsoup 선언 바로 아래에 넣는다.

```groovy
	// 부점 전산예산 편성요청서 반입 — .xls(HSSF)·.xlsx(XSSF) 파싱.
	// exceljs(프론트)는 .xlsx만 읽고 부점 제출본 상당수가 .xls(OLE 복합문서)라 서버 파싱이 필요하다.
	// ⚠️ 폐쇄망: poi, poi-ooxml, poi-ooxml-lite, xmlbeans, commons-collections4,
	//    commons-math3, SparseBitSet, curvesapi, log4j-api가 C:/maven-repo 또는 Nexus에
	//    반입되어 있어야 오프라인 해석된다(반입 신청 선행). commons-compress는 이미 있다.
	implementation 'org.apache.poi:poi:5.4.1'
	implementation 'org.apache.poi:poi-ooxml:5.4.1'
```

- [ ] **Step 2: 의존성이 실제로 해석되는지 확인**

Run: `cd it_backend && ./gradlew dependencies --configuration runtimeClasspath | grep -i poi`
Expected: `org.apache.poi:poi:5.4.1`과 `org.apache.poi:poi-ooxml:5.4.1`이 `FAILED` 표시 없이 출력.

`FAILED`가 보이면 반입이 아직 끝나지 않은 것이다. 여기서 멈추고 반입 완료를 기다린다. 다음 단계로 넘어가지 않는다.

- [ ] **Step 3: 업로드 한도 프로퍼티 추가**

`application.properties`의 기존 multipart 설정(125~127행)은 그대로 두고 바로 아래에 반입 전용 한도를 추가한다. 기존 값은 다른 첨부 업로드가 쓰므로 건드리지 않는다.

```properties
# 부점 편성요청서 반입 — 워크북 1건·배치 1회의 상한.
# 편성요청서는 서식 위주라 실측 최대가 160KB 수준이므로 파일당 10MB면 충분하다.
# 시트/행 상한은 서식만 남은 빈 행(실측 65,535행)과 자원 폭탄을 함께 막는다.
app.migration.request.max-file-bytes=10485760
app.migration.request.max-files-per-batch=50
app.migration.request.max-sheets=20
app.migration.request.max-rows-per-sheet=5000
app.migration.request.min-inflate-ratio=0.01
```

- [ ] **Step 4: `FormSheetKind` 작성**

```java
package com.kdb.it.domain.migration.request.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Optional;

/** 부점 편성요청서의 시트 종류입니다. 시트명은 영문 양식에서도 국문이라 국문 키워드로 판별합니다. */
@Schema(name = "RequestFormSheetKind", description = "편성요청서 시트 종류")
public enum FormSheetKind {
    /** `① (정보화사업) 1-1. 정보화사업 개요` → BPROJM */
    CAPITAL_OVERVIEW("1-1"),
    /** `① (정보화사업) 1-2. 소요자원 상세내용` → BITEMM */
    CAPITAL_RESOURCE("1-2"),
    /** `② (경상사업) 2. 경상적인 사업` → BPROJM(경상) + BITEMM */
    RECURRING("경상"),
    /** `③ (일반관리비) 전산 일반관리비 편성요청서` → BCOSTM */
    GENERAL_EXPENSE("일반관리비");

    private final String keyword;

    FormSheetKind(String keyword) {
        this.keyword = keyword;
    }

    /**
     * 시트명으로 종류를 판별합니다.
     *
     * <p>부점이 시트명 앞뒤에 부점명이나 공백을 덧붙이는 경우가 있어 정확 일치가 아니라 키워드 포함으로 봅니다. `1-1`과 `1-2`는 접두 번호가 겹치지
     * 않으므로 먼저 선언된 순서대로 검사해도 어긋나지 않습니다.
     *
     * @param sheetName 워크북이 준 시트명. null·공백이면 빈 Optional
     * @return 판별된 종류. 어느 키워드에도 걸리지 않으면 빈 Optional
     */
    public static Optional<FormSheetKind> ofSheetName(String sheetName) {
        if (sheetName == null || sheetName.isBlank()) return Optional.empty();
        String normalized = sheetName.replace(" ", "");
        for (FormSheetKind kind : values()) {
            if (normalized.contains(kind.keyword.replace(" ", ""))) return Optional.of(kind);
        }
        return Optional.empty();
    }
}
```

- [ ] **Step 5: 픽스처 생성기의 실패 테스트 먼저 작성**

`WorkbookReaderTest.java`:

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.support.RequestFormFixtures;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WorkbookReaderTest {

    private final WorkbookReader reader = new WorkbookReader(10_485_760L, 20, 5000, 0.01d);

    @Test
    @DisplayName("BIFF8(.xls) 워크북을 열고 4개 시트를 모두 판별한다")
    void opensBiff8AndClassifiesAllSheets() {
        Workbook workbook = reader.open(RequestFormFixtures.fullFormXls(), "요청서.xls");

        Map<FormSheetKind, Sheet> sheets = reader.classify(workbook);

        assertThat(sheets).containsOnlyKeys(
                FormSheetKind.CAPITAL_OVERVIEW,
                FormSheetKind.CAPITAL_RESOURCE,
                FormSheetKind.RECURRING,
                FormSheetKind.GENERAL_EXPENSE);
    }

    @Test
    @DisplayName("OOXML(.xlsx) 워크북에서 채워진 시트만 판별한다")
    void opensOoxmlAndClassifiesPresentSheets() {
        Workbook workbook = reader.open(RequestFormFixtures.capitalOnlyXlsx(), "자료1.xlsx");

        assertThat(reader.classify(workbook))
                .containsOnlyKeys(FormSheetKind.CAPITAL_OVERVIEW, FormSheetKind.CAPITAL_RESOURCE);
    }

    @Test
    @DisplayName("확장자가 xlsx인데 내용이 BIFF8이면 매직바이트로 걸러 연다")
    void opensByMagicBytesNotByExtension() {
        Workbook workbook = reader.open(RequestFormFixtures.fullFormXls(), "위장.xlsx");

        assertThat(workbook.getNumberOfSheets()).isGreaterThan(0);
    }

    @Test
    @DisplayName("엑셀이 아닌 바이트는 WorkbookOpenException으로 거부한다")
    void rejectsNonExcelBytes() {
        byte[] notExcel = "이것은 엑셀이 아닙니다".getBytes(StandardCharsets.UTF_8);

        assertThatThrownBy(() -> reader.open(notExcel, "가짜.xlsx"))
                .isInstanceOf(WorkbookReader.WorkbookOpenException.class)
                .hasMessageContaining("엑셀");
    }

    @Test
    @DisplayName("파일 크기 상한을 넘으면 열기 전에 거부한다")
    void rejectsOversizeBeforeParsing() {
        WorkbookReader tiny = new WorkbookReader(16L, 20, 5000, 0.01d);

        assertThatThrownBy(() -> tiny.open(RequestFormFixtures.fullFormXls(), "요청서.xls"))
                .isInstanceOf(WorkbookReader.WorkbookOpenException.class)
                .hasMessageContaining("크기");
    }

    @Test
    @DisplayName("시트 수 상한을 넘으면 거부한다")
    void rejectsTooManySheets() {
        WorkbookReader narrow = new WorkbookReader(10_485_760L, 2, 5000, 0.01d);

        assertThatThrownBy(() -> narrow.open(RequestFormFixtures.fullFormXls(), "요청서.xls"))
                .isInstanceOf(WorkbookReader.WorkbookOpenException.class)
                .hasMessageContaining("시트");
    }
}
```

- [ ] **Step 6: 테스트가 컴파일 실패로 떨어지는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*WorkbookReaderTest*"`
Expected: FAIL — `WorkbookReader`, `RequestFormFixtures`가 없어 컴파일 오류.

- [ ] **Step 7: 픽스처 생성기 작성**

실 제출본(`C:\it\sample`)은 실명 담당자·실제 예산액이 든 업무 데이터라 저장소에 커밋하지 않는다. 대신 **관측한 레이아웃을 POI로 재현**한다. 이 편이 익명화 사본을 커밋하는 것보다 낫다 — 행 위치·병합·영문 변형을 테스트가 명시적으로 선언하므로 무엇을 검증하는지가 코드에 드러나고, 바이너리를 리뷰할 수 없는 문제도 없다.

```java
package com.kdb.it.domain.migration.request.support;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/**
 * 편성요청서 테스트 픽스처.
 *
 * <p>실 제출본 3건에서 관측한 레이아웃을 재현합니다. 두 파일이 1-1 시트에서 각각 38행·41행이었고 1-2의 두 번째 헤더 위치도 22행·18행으로 달랐으므로,
 * 픽스처도 그 차이를 그대로 담아 앵커 스캔이 고정 좌표에 기대지 않는지 검증합니다.
 */
public final class RequestFormFixtures {

    private RequestFormFixtures() {}

    /** 시트 ①만 채운 .xlsx (스마트워크 인프라 샘플 레이아웃, 1-1이 38행·1-2 두 번째 헤더가 22행). */
    public static byte[] capitalOnlyXlsx() {
        try (Workbook wb = new XSSFWorkbook()) {
            writeCapitalOverview(wb, "① (정보화사업) 1-1. 정보화사업 개요", 0);
            writeCapitalResource(wb, "① (정보화사업) 1-2. 소요자원 상세내용", 22);
            return toBytes(wb);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** 4시트를 모두 담은 .xls (자금운용실 샘플 레이아웃, 1-1이 41행·1-2 두 번째 헤더가 18행). */
    public static byte[] fullFormXls() {
        try (Workbook wb = new HSSFWorkbook()) {
            writeCapitalOverview(wb, "① (정보화사업) 1-1. 정보화사업 개요", 3);
            writeCapitalResource(wb, "① (정보화사업) 1-2. 소요자원 상세내용", 18);
            writeRecurring(wb, "② (경상사업) 2. 경상적인 사업", true);
            writeGeneralExpense(wb, "③ (일반관리비) 전산 일반관리비 편성요청서", false);
            return toBytes(wb);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /** 영문 양식 .xls (런던지점 레이아웃). 시트명만 국문이고 내용은 영문입니다. */
    public static byte[] englishFormXls() {
        try (Workbook wb = new HSSFWorkbook()) {
            writeRecurring(wb, "② (경상사업) 2. 경상적인 사업", false);
            writeGeneralExpense(wb, "③ (일반관리비) 전산 일반관리비 편성요청서", true);
            return toBytes(wb);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * 1-1 개요 시트를 씁니다.
     *
     * @param extraScopeRows `사업 범위` 칸에 끼워 넣을 추가 행 수. 실 제출본이 이 칸의 행 수로 시트 전체 길이가 달라졌습니다
     */
    private static void writeCapitalOverview(Workbook wb, String name, int extraScopeRows) {
        Sheet s = wb.createSheet(name);
        put(s, 0, 0, "1-1. 정보화사업 개요");
        put(s, 1, 6, "(확인자)");
        put(s, 1, 7, "허인선 팀장");
        put(s, 1, 8, "(작성자)");
        put(s, 1, 9, "김준영 차장");
        put(s, 2, 0, "사업명");
        put(s, 2, 2, "국채전문유통시장 접속인프라 도입");
        put(s, 3, 0, "사업 개요");
        put(s, 3, 2, "(개요)");
        put(s, 3, 3, "접속방식 변경");
        put(s, 4, 2, "(현황)");
        put(s, 4, 3, "Exture3.0 운영 중");
        put(s, 5, 2, "(필요성)");
        put(s, 5, 3, "접속체계 전환 대응");
        put(s, 6, 2, "(기대효과)");
        put(s, 6, 3, "PD 자격 유지");
        put(s, 7, 2, "(미추진시 문제점)");
        put(s, 7, 3, "PD 업무 수행 불가");

        int row = 8;
        put(s, row, 0, "사업 범위 (전산 요구사항)");
        put(s, row, 2, "전용망 거래 기능");
        for (int i = 1; i <= extraScopeRows; i++) {
            put(s, row + i, 2, "추가 요구사항 " + i);
        }
        row += extraScopeRows + 1;

        put(s, row, 0, "진행 상황");
        put(s, row, 2, "추진경과");
        put(s, row, 3, "내부승인 완료");
        put(s, row, 6, "향후계획");
        put(s, row, 7, "계약 체결 예정");
        row++;

        put(s, row++, 2, "업무구분");
        put(s, row++, 2, "사업유형");
        put(s, row++, 2, "디지털 기술 유형");
        put(s, row++, 2, "주 사용자");
        put(s, row, 2, "중복 여부");
        put(s, row, 6, "법규상 완료시기");
        row++;
        put(s, row, 2, "주관부문/본부");
        put(s, row, 3, "글로벌사업부문");
        put(s, row, 5, "팀장");
        put(s, row, 6, "윤소정");
        put(s, row, 8, "IT팀장");
        put(s, row, 9, "공현순");
        row++;
        put(s, row, 2, "주관부서/팀");
        put(s, row, 3, "자금운용실/원화유가증권팀");
        put(s, row, 5, "실무자(정/부)");
        put(s, row, 6, "허진성/장준호");
        put(s, row, 8, "IT실무자(정/부)");
        put(s, row, 9, "최현식/이종현");
        row++;
        put(s, row, 2, "최종보고");
        put(s, row, 8, "전결권자");
        put(s, row, 9, "수석부행장");
        row++;
        put(s, row++, 2, "추진가능성");
        put(s, row, 2, "시작일자 (YY/MM)");
        put(s, row, 3, "25/06");
        put(s, row, 4, "종료일자 (YY/MM)");
        put(s, row, 5, "26/02");
        put(s, row, 7, "총 사업금액(전체기간)");
        put(s, row, 9, "2,000백만원");
    }

    /**
     * 1-2 소요자원 시트를 씁니다.
     *
     * @param secondHeaderRow 일반관리비 블록 헤더의 0-based 행 번호. 실 제출본이 22행·18행으로 달랐습니다
     */
    private static void writeCapitalResource(Workbook wb, String name, int secondHeaderRow) {
        Sheet s = wb.createSheet(name);
        put(s, 0, 0, "1-2. 정보화사업 소요자원 상세내용");
        put(s, 9, 1, "구분");
        put(s, 9, 3, "항목");
        put(s, 9, 4, "수량");
        put(s, 9, 5, "단가");
        put(s, 9, 6, "통화");
        put(s, 9, 7, "소요예산 (부가세포함)");
        put(s, 9, 8, "산정근거");
        put(s, 9, 9, "도입시기(월)");
        put(s, 9, 10, "정보보호여부");
        put(s, 9, 11, "인프라 통합관리 여부");

        writeResourceRow(s, 10, "자본예산", "기타무형자산(SW)", "솔루션 패키지", 1, 957_000_000,
                "KRW", 957_000_000, "계약금액 참조", "~26.2월", "Y", "Y");
        writeResourceRow(s, 11, "자본예산", "기계장치(HW)", "운영 서버", 2, 60_000_000,
                "KRW", 120_000_000, "업체견적", "2분기 중", "O", "X");

        put(s, secondHeaderRow, 1, "구분");
        put(s, secondHeaderRow, 3, "항목");
        put(s, secondHeaderRow, 4, "수량");
        put(s, secondHeaderRow, 5, "단가");
        put(s, secondHeaderRow, 6, "통화");
        put(s, secondHeaderRow, 7, "연간 소요예산 (부가세포함)");
        put(s, secondHeaderRow, 8, "산정근거");
        put(s, secondHeaderRow, 9, "대금지급주기 (월/분기/년)");
        put(s, secondHeaderRow, 10, "정보보호여부");
        put(s, secondHeaderRow, 11, "인프라 통합관리 여부");

        writeResourceRow(s, secondHeaderRow + 1, "일반관리비", "전산제비", "전용망 회선 이용료",
                1, 188_624_700, "KRW", 188_624_700, "품의문 참조", "년", "Y", "Y");
    }

    private static void writeResourceRow(
            Sheet s, int row, String division, String group, String item,
            int qty, long unitPrice, String currency, long amount,
            String basis, String timing, String infoSec, String infra) {
        put(s, row, 1, division);
        put(s, row, 2, group);
        put(s, row, 3, item);
        putNumber(s, row, 4, qty);
        putNumber(s, row, 5, unitPrice);
        put(s, row, 6, currency);
        putNumber(s, row, 7, amount);
        put(s, row, 8, basis);
        put(s, row, 9, timing);
        put(s, row, 10, infoSec);
        put(s, row, 11, infra);
    }

    /** 시트 ②를 씁니다. `withName=false`면 런던 샘플처럼 사업명이 공란입니다. */
    private static void writeRecurring(Workbook wb, String name, boolean withName) {
        Sheet s = wb.createSheet(name);
        put(s, 0, 0, withName ? "2. 경상적인 사업" : "2. Recurring business");
        put(s, 2, 0, withName ? "사업명" : "Business Name");
        if (withName) put(s, 2, 2, "2026년 IT기계장치 구입");
        put(s, 3, 0, withName ? "사업 개요" : "Business Overview");
        put(s, 3, 2, "(개요)");
        put(s, 3, 3, "PC, 모니터 구입");
        put(s, 4, 2, "(현황)");
        put(s, 4, 3, "내용연수 경과");
        put(s, 5, 2, "(추진내용)");
        put(s, 5, 3, "고장기기 교체");
        put(s, 6, 2, "(미추진시 문제점)");
        put(s, 6, 3, "업무효율 저하");

        put(s, 7, 0, "구분");
        put(s, 7, 2, withName ? "항목" : "Item");
        put(s, 7, 4, withName ? "수량" : "Qty");
        put(s, 7, 5, withName ? "단가" : "Unit Cost");
        put(s, 7, 6, withName ? "통화" : "Currency");
        put(s, 7, 7, withName ? "소요예산 (부가세포함)" : "Budget (Tax Included)");
        put(s, 7, 8, withName ? "도입시기" : "Timing");
        put(s, 7, 9, withName ? "비고(적용 환율 등)" : "Remarks");

        put(s, 8, 0, "소요 자원");
        put(s, 8, 1, "기계장치(HW)");
        put(s, 8, 2, "데스크탑(고사양)");
        putNumber(s, 8, 4, 12);
        putNumber(s, 8, 5, 1945.57);
        put(s, 8, 6, "GBP");
        putNumber(s, 8, 7, 23346.84);
        put(s, 8, 8, "26년 연중");

        put(s, 9, 1, "기타무형자산(SW)");
        put(s, 9, 2, "MS오피스");
        putNumber(s, 9, 4, 99);
        putNumber(s, 9, 5, 537.12);
        put(s, 9, 6, "GBP");
        putNumber(s, 9, 7, 53174.88);

        put(s, 10, 0, "계");
        s.addMergedRegion(new CellRangeAddress(10, 10, 0, 1));
    }

    /** 시트 ③을 씁니다. `english=true`면 런던 샘플처럼 라벨·비목명이 영문입니다. */
    private static void writeGeneralExpense(Workbook wb, String name, boolean english) {
        Sheet s = wb.createSheet(name);
        put(s, 0, 0, english
                ? "3. Request for allocation of general IT management expenses"
                : "3. 전산 일반관리비 편성 요청서");
        put(s, 3, 0, english ? "Expense" : "비 목 명");
        put(s, 3, 2, english ? "Name of the Contract / Item" : "계약명 / 건명");
        put(s, 3, 3, english ? "Currency" : "통화 구분");
        put(s, 3, 4, english ? "Budget" : "소요예산");
        put(s, 3, 6, english ? "Contract" : "계약");
        put(s, 3, 7, english ? "Contract Type" : "계약구분");
        put(s, 3, 9, english ? "InfoSec. Related" : "정보보호 관련여부");
        put(s, 3, 10, english ? "Remarks" : "비고(증감사유, 적용환율 등)");
        put(s, 4, 4, english ? "Monthly" : "월간");
        put(s, 4, 5, english ? "Annual" : "연간");
        put(s, 4, 6, english ? "Counterparty" : "상대처");
        put(s, 4, 7, english ? "Cont." : "계속");
        put(s, 4, 8, english ? "New" : "신규");

        if (english) {
            put(s, 5, 0, "IT Expenses");
            put(s, 5, 1, "Foreign branch line usage fees");
            put(s, 5, 2, "Main Internet");
            put(s, 5, 3, "GBP");
            putNumber(s, 5, 4, 431.44);
            putNumber(s, 5, 5, 5177.28);
            put(s, 5, 6, "Daisy Communications");
            put(s, 5, 7, "○");
            put(s, 5, 9, "Ⅹ");
            put(s, 5, 10, "물가상승율 반영");
            // A·B열이 병합된 다음 행 — forward-fill 대상
            put(s, 6, 2, "AML Screening");
            put(s, 6, 3, "GBP");
            putNumber(s, 6, 5, 16643);
            put(s, 6, 6, "Dow Jones");
            put(s, 6, 7, "○");
            put(s, 6, 9, "Ⅹ");
        } else {
            put(s, 5, 0, "전산 제비");
            put(s, 5, 1, "회선사용료");
            put(s, 5, 2, "블룸버그 회선사용료");
            put(s, 5, 3, "KRW");
            putNumber(s, 5, 4, 73_887_778d);
            putNumber(s, 5, 5, 841_854_085d);
            put(s, 5, 6, "Bloomberg");
            put(s, 5, 7, "√");
            put(s, 5, 10, "비용인상 및 환율 반영");
            put(s, 6, 1, "국외전산유지보수료");
            put(s, 6, 2, "KINS 서버 유지보수");
            put(s, 6, 3, "KRW");
            putNumber(s, 6, 5, 23_346_800d);
            put(s, 6, 6, "Support Warehouse");
            put(s, 6, 8, "√");
        }
    }

    private static void put(Sheet sheet, int rowIndex, int colIndex, String value) {
        cell(sheet, rowIndex, colIndex).setCellValue(value);
    }

    private static void putNumber(Sheet sheet, int rowIndex, int colIndex, double value) {
        cell(sheet, rowIndex, colIndex).setCellValue(value);
    }

    private static Cell cell(Sheet sheet, int rowIndex, int colIndex) {
        Row row = sheet.getRow(rowIndex);
        if (row == null) row = sheet.createRow(rowIndex);
        Cell cell = row.getCell(colIndex);
        return cell == null ? row.createCell(colIndex) : cell;
    }

    private static byte[] toBytes(Workbook workbook) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            workbook.write(out);
            return out.toByteArray();
        }
    }
}
```

- [ ] **Step 8: `WorkbookReader` 작성**

```java
package com.kdb.it.domain.migration.request.service;

import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.util.IOUtils;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 업로드된 편성요청서 워크북을 안전하게 엽니다.
 *
 * <p>파일은 인증된 관리자만 올릴 수 있지만, 엑셀 파서는 신뢰할 수 없는 바이너리를 다루는 지점이라 크기·시트 수·행 수·압축비 상한을 파싱 전후로 강제합니다. 특히
 * `.xlsx`는 zip이므로 압축 폭탄을, `.xls`는 레코드 길이 필드를 신뢰하는 구조라 거대 배열 할당을 각각 막아야 합니다.
 */
@Component
public class WorkbookReader {

    private static final byte[] OLE2_MAGIC = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0};
    private static final byte[] ZIP_MAGIC = {0x50, 0x4B, 0x03, 0x04};

    private final long maxFileBytes;
    private final int maxSheets;
    private final int maxRowsPerSheet;

    public WorkbookReader(
            @Value("${app.migration.request.max-file-bytes}") long maxFileBytes,
            @Value("${app.migration.request.max-sheets}") int maxSheets,
            @Value("${app.migration.request.max-rows-per-sheet}") int maxRowsPerSheet,
            @Value("${app.migration.request.min-inflate-ratio}") double minInflateRatio) {
        this.maxFileBytes = maxFileBytes;
        this.maxSheets = maxSheets;
        this.maxRowsPerSheet = maxRowsPerSheet;
        ZipSecureFile.setMinInflateRatio(minInflateRatio);
        IOUtils.setByteArrayMaxOverride((int) Math.min(maxFileBytes, Integer.MAX_VALUE));
    }

    /**
     * 바이트 배열을 워크북으로 엽니다.
     *
     * <p>확장자가 아니라 매직바이트로 형식을 정합니다 — 부점이 `.xls` 파일을 `.xlsx`로 바꿔 저장해 보내는 경우가 있어 확장자를 믿으면 파싱이 실패합니다.
     *
     * @param bytes 업로드 파일 전체 바이트
     * @param originalFilename 진단 메시지에만 쓰는 원본 파일명
     * @return 열린 워크북. 호출자가 닫아야 합니다
     * @throws WorkbookOpenException 크기·시트 수 상한 초과, 엑셀이 아닌 바이트, POI 파싱 실패
     */
    public Workbook open(byte[] bytes, String originalFilename) {
        if (bytes == null || bytes.length == 0) {
            throw new WorkbookOpenException("파일이 비어 있습니다: " + originalFilename);
        }
        if (bytes.length > maxFileBytes) {
            throw new WorkbookOpenException(
                    "파일 크기가 상한(%d바이트)을 넘습니다: %s".formatted(maxFileBytes, originalFilename));
        }
        Workbook workbook = openByMagic(bytes, originalFilename);
        if (workbook.getNumberOfSheets() > maxSheets) {
            closeQuietly(workbook);
            throw new WorkbookOpenException(
                    "시트 수가 상한(%d개)을 넘습니다: %s".formatted(maxSheets, originalFilename));
        }
        return workbook;
    }

    private Workbook openByMagic(byte[] bytes, String originalFilename) {
        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            if (startsWith(bytes, OLE2_MAGIC)) return new HSSFWorkbook(in);
            if (startsWith(bytes, ZIP_MAGIC)) return new XSSFWorkbook(in);
            throw new WorkbookOpenException("엑셀 파일이 아닙니다: " + originalFilename);
        } catch (WorkbookOpenException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw new WorkbookOpenException("엑셀 파일을 열지 못했습니다: " + originalFilename, e);
        }
    }

    /**
     * 워크북의 시트를 종류별로 분류합니다.
     *
     * <p>내용이 전혀 없는 시트(마지막 행 번호가 음수)는 부점이 쓰지 않은 시트이므로 제외합니다. 같은 종류가 둘 이상이면 먼저 나온 시트를 씁니다.
     *
     * @param workbook 열린 워크북
     * @return 종류 → 시트. 인식된 시트가 없으면 빈 맵
     * @throws WorkbookOpenException 어떤 시트의 행 수가 상한을 넘는 경우
     */
    public Map<FormSheetKind, Sheet> classify(Workbook workbook) {
        Map<FormSheetKind, Sheet> classified = new EnumMap<>(FormSheetKind.class);
        for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
            Sheet sheet = workbook.getSheetAt(i);
            Optional<FormSheetKind> kind = FormSheetKind.ofSheetName(sheet.getSheetName());
            if (kind.isEmpty() || sheet.getLastRowNum() < 0) continue;
            if (sheet.getLastRowNum() + 1 > maxRowsPerSheet) {
                throw new WorkbookOpenException(
                        "시트 `%s`의 행 수가 상한(%d행)을 넘습니다".formatted(sheet.getSheetName(), maxRowsPerSheet));
            }
            classified.putIfAbsent(kind.get(), sheet);
        }
        return classified;
    }

    private static boolean startsWith(byte[] bytes, byte[] prefix) {
        if (bytes.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (bytes[i] != prefix[i]) return false;
        }
        return true;
    }

    private static void closeQuietly(Workbook workbook) {
        try {
            workbook.close();
        } catch (IOException ignored) {
            // 상한 위반으로 이미 실패하는 경로라 닫기 실패를 덮어쓰지 않는다
        }
    }

    /** 워크북을 열지 못한 상태입니다. 파일 단위 `FILE_UNREADABLE` 진단으로 변환됩니다. */
    public static class WorkbookOpenException extends RuntimeException {
        public WorkbookOpenException(String message) {
            super(message);
        }

        public WorkbookOpenException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*WorkbookReaderTest*"`
Expected: PASS — 6개 테스트 모두 성공.

- [ ] **Step 10: 포맷 검사**

Run: `cd it_backend && ./gradlew spotlessApply spotlessCheck`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 11: 커밋**

```bash
git -C it_backend add build.gradle src/main/resources/application.properties src/main/java/com/kdb/it/domain/migration/request src/test/java/com/kdb/it/domain/migration/request
git -C it_backend commit -m "feat(migration): 편성요청서 워크북 열기와 시트 판별

Apache POI로 .xls(HSSF)·.xlsx(XSSF)를 모두 열고, 확장자가 아닌 매직바이트로
형식을 정한다. 크기·시트 수·행 수·압축비 상한을 파싱 전후로 강제해 신뢰할 수 없는
바이너리를 입구에서 막는다.

테스트 픽스처는 실 제출본을 커밋하지 않고 관측한 레이아웃을 POI로 재현한다.
1-1 시트 길이(38행/41행)와 1-2 두 번째 헤더 위치(22행/18행)의 실제 차이를
픽스처가 담아 이후 앵커 스캔이 고정 좌표에 기대지 않는지 검증한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: 라벨·헤더 앵커 스캐너

고정 셀 좌표를 쓰지 않고 라벨 텍스트로 값을 찾는다. 실 제출본의 행 위치가 파일마다 다르므로 이 태스크가 파싱 전체의 토대다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/SheetAnchorScanner.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/SheetAnchorScannerTest.java`

**Interfaces:**
- Consumes: `RequestFormFixtures`, `WorkbookReader`, `FormSheetKind` (Task 1)
- Produces:
  - `class SheetAnchorScanner`
    - `String text(Sheet sheet, int rowIndex, int colIndex)` — 병합셀이면 좌상단 값
    - `Optional<Integer> findLabelRow(Sheet sheet, int[] labelColumns, String... labelAliases)`
    - `Optional<String> valueRightOf(Sheet sheet, int rowIndex, int labelColIndex)`
    - `String joinedValueRightOf(Sheet sheet, int startRow, int endRowExclusive, int labelColIndex)`
    - `Optional<HeaderMap> findHeader(Sheet sheet, int fromRow, Map<String, List<String>> columnAliases, String... requiredColumns)`
    - `record HeaderMap(int rowIndex, Map<String, Integer> columnIndex)` with `Integer column(String id)`
    - `static String normalize(String raw)`

- [ ] **Step 1: 실패 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/migration/request/service/SheetAnchorScannerTest.java`:

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.support.RequestFormFixtures;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SheetAnchorScannerTest {

    private final SheetAnchorScanner scanner = new SheetAnchorScanner();
    private final WorkbookReader reader = new WorkbookReader(10_485_760L, 20, 5000, 0.01d);

    private Sheet sheetOf(byte[] bytes, FormSheetKind kind) {
        Workbook workbook = reader.open(bytes, "픽스처.xls");
        return reader.classify(workbook).get(kind);
    }

    @Test
    @DisplayName("라벨이 있는 행을 찾아 오른쪽 값을 읽는다")
    void readsValueRightOfLabel() {
        Sheet sheet = sheetOf(RequestFormFixtures.fullFormXls(), FormSheetKind.CAPITAL_OVERVIEW);

        int row = scanner.findLabelRow(sheet, new int[] {0, 2}, "사업명").orElseThrow();

        assertThat(scanner.valueRightOf(sheet, row, 0)).contains("국채전문유통시장 접속인프라 도입");
    }

    @Test
    @DisplayName("행이 밀린 파일에서도 같은 라벨을 찾는다")
    void findsLabelRegardlessOfRowShift() {
        Sheet shifted = sheetOf(RequestFormFixtures.fullFormXls(), FormSheetKind.CAPITAL_OVERVIEW);
        Sheet compact = sheetOf(RequestFormFixtures.capitalOnlyXlsx(), FormSheetKind.CAPITAL_OVERVIEW);

        int shiftedRow = scanner.findLabelRow(shifted, new int[] {0, 2}, "주관부서/팀").orElseThrow();
        int compactRow = scanner.findLabelRow(compact, new int[] {0, 2}, "주관부서/팀").orElseThrow();

        assertThat(shiftedRow).isNotEqualTo(compactRow);
        assertThat(scanner.valueRightOf(shifted, shiftedRow, 2)).contains("자금운용실/원화유가증권팀");
        assertThat(scanner.valueRightOf(compact, compactRow, 2)).contains("자금운용실/원화유가증권팀");
    }

    @Test
    @DisplayName("여러 행에 걸친 값을 줄바꿈으로 잇는다")
    void joinsMultiRowValue() {
        Sheet sheet = sheetOf(RequestFormFixtures.fullFormXls(), FormSheetKind.CAPITAL_OVERVIEW);
        int start = scanner.findLabelRow(sheet, new int[] {0}, "사업 범위 (전산 요구사항)").orElseThrow();

        String joined = scanner.joinedValueRightOf(sheet, start, start + 4, 0);

        assertThat(joined).contains("전용망 거래 기능").contains("추가 요구사항 1");
    }

    @Test
    @DisplayName("헤더를 찾아 컬럼 id 별 열 번호 맵을 만든다")
    void mapsHeaderColumns() {
        Sheet sheet = sheetOf(RequestFormFixtures.fullFormXls(), FormSheetKind.CAPITAL_RESOURCE);
        Map<String, List<String>> aliases =
                Map.of(
                        "item", List.of("항목", "Item"),
                        "qty", List.of("수량", "Qty"),
                        "currency", List.of("통화", "Currency"),
                        "amount", List.of("소요예산", "Budget"));

        SheetAnchorScanner.HeaderMap header =
                scanner.findHeader(sheet, 0, aliases, "item", "qty", "currency", "amount")
                        .orElseThrow();

        assertThat(header.rowIndex()).isEqualTo(9);
        assertThat(header.column("item")).isEqualTo(3);
        assertThat(header.column("qty")).isEqualTo(4);
        assertThat(header.column("amount")).isEqualTo(7);
    }

    @Test
    @DisplayName("두 번째 헤더 블록은 첫 헤더 다음 행부터 다시 찾는다")
    void findsSecondHeaderBlock() {
        Sheet sheet = sheetOf(RequestFormFixtures.fullFormXls(), FormSheetKind.CAPITAL_RESOURCE);
        Map<String, List<String>> aliases = Map.of("amount", List.of("연간 소요예산"));

        SheetAnchorScanner.HeaderMap second =
                scanner.findHeader(sheet, 10, aliases, "amount").orElseThrow();

        assertThat(second.rowIndex()).isEqualTo(18);
    }

    @Test
    @DisplayName("영문 헤더도 같은 별칭 목록으로 찾는다")
    void findsEnglishHeader() {
        Sheet sheet = sheetOf(RequestFormFixtures.englishFormXls(), FormSheetKind.GENERAL_EXPENSE);
        Map<String, List<String>> aliases =
                Map.of(
                        "annual", List.of("연간", "Annual"),
                        "counterparty", List.of("상대처", "Counterparty"));

        SheetAnchorScanner.HeaderMap header =
                scanner.findHeader(sheet, 0, aliases, "annual", "counterparty").orElseThrow();

        assertThat(header.column("annual")).isEqualTo(5);
        assertThat(header.column("counterparty")).isEqualTo(6);
    }

    @Test
    @DisplayName("필수 컬럼이 하나라도 없으면 헤더로 인정하지 않는다")
    void rejectsIncompleteHeader() {
        Sheet sheet = sheetOf(RequestFormFixtures.fullFormXls(), FormSheetKind.CAPITAL_RESOURCE);
        Map<String, List<String>> aliases = Map.of("nowhere", List.of("존재하지 않는 헤더"));

        assertThat(scanner.findHeader(sheet, 0, aliases, "nowhere")).isEmpty();
    }

    @Test
    @DisplayName("공백과 전각 공백을 제거해 비교한다")
    void normalizesWhitespaceAndFullWidth() {
        assertThat(SheetAnchorScanner.normalize(" 비 목 명 ")).isEqualTo("비목명");
        assertThat(SheetAnchorScanner.normalize("전산　임차료")).isEqualTo("전산임차료");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*SheetAnchorScannerTest*"`
Expected: FAIL — `SheetAnchorScanner` 클래스가 없어 컴파일 오류.

- [ ] **Step 3: `SheetAnchorScanner` 작성**

```java
package com.kdb.it.domain.migration.request.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FormulaError;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellRangeAddress;
import org.springframework.stereotype.Component;

/**
 * 편성요청서 시트에서 라벨·헤더를 찾아 값 위치를 정합니다.
 *
 * <p>실 제출본은 사업범위·추진경과 칸에 사용자가 행을 끼워 넣어 같은 항목이 파일마다 다른 행에 있습니다(실측 38행 대 41행). 그래서 고정 좌표 대신 라벨
 * 텍스트로 행을 찾고, 표는 헤더 텍스트 조합으로 열을 찾습니다. 비교는 항상 {@link #normalize(String)}를 거칩니다 — 양식에 `비 목 명`처럼 글자
 * 사이 공백이나 전각 공백이 섞여 있습니다.
 */
@Component
public class SheetAnchorScanner {

    /** 라벨 오른쪽에서 값을 찾을 때 훑는 최대 열 수. 양식의 가장 넓은 표가 12열이라 여유를 둡니다. */
    private static final int VALUE_SCAN_WIDTH = 16;

    private final DataFormatter formatter = new DataFormatter();

    /**
     * 셀 텍스트를 읽습니다. 병합 영역 안이면 좌상단 셀의 값을 돌려줍니다.
     *
     * <p>POI는 병합 영역의 좌상단이 아닌 셀을 빈 값으로 돌려주는데 양식이 병합을 많이 써서 그대로 두면 값이 사라집니다. 수식 셀은 캐시된 계산 결과를 쓰고
     * 오류값은 오류 코드 문자열(`#REF!` 등)을 그대로 남깁니다 — 빈 문자열로 접으면 "값 없음"과 구분되지 않아 깨진 수식을 아무도 알아채지 못합니다.
     *
     * @param sheet 대상 시트
     * @param rowIndex 0-based 행 번호. 음수면 빈 문자열
     * @param colIndex 0-based 열 번호. 음수면 빈 문자열
     * @return 셀 텍스트. 값이 없으면 빈 문자열
     */
    public String text(Sheet sheet, int rowIndex, int colIndex) {
        if (rowIndex < 0 || colIndex < 0) return "";
        Cell cell = cellAt(sheet, rowIndex, colIndex);
        if (cell == null || cell.getCellType() == CellType.BLANK) {
            Cell anchor = mergedAnchor(sheet, rowIndex, colIndex);
            if (anchor == null) return "";
            cell = anchor;
        }
        if (cell.getCellType() == CellType.ERROR
                || (cell.getCellType() == CellType.FORMULA
                        && cell.getCachedFormulaResultType() == CellType.ERROR)) {
            return FormulaError.forInt(cell.getErrorCellValue()).getString();
        }
        return formatter.formatCellValue(cell).trim();
    }

    /**
     * 라벨이 있는 행을 찾습니다.
     *
     * @param sheet 대상 시트
     * @param labelColumns 라벨이 있을 수 있는 0-based 열 번호들 (보통 `{0, 2}` — A열 대분류, C열 소분류)
     * @param labelAliases 같은 항목의 국문·영문 표기. 하나라도 일치하면 그 행
     * @return 0-based 행 번호. 없으면 빈 Optional
     */
    public Optional<Integer> findLabelRow(Sheet sheet, int[] labelColumns, String... labelAliases) {
        List<String> normalizedAliases = new ArrayList<>();
        for (String alias : labelAliases) normalizedAliases.add(normalize(alias));

        for (int rowIndex = 0; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
            for (int colIndex : labelColumns) {
                String candidate = normalize(text(sheet, rowIndex, colIndex));
                if (!candidate.isEmpty() && normalizedAliases.contains(candidate)) {
                    return Optional.of(rowIndex);
                }
            }
        }
        return Optional.empty();
    }

    /**
     * 라벨 셀 오른쪽에서 처음 만나는 값을 읽습니다.
     *
     * @param sheet 대상 시트
     * @param rowIndex 라벨이 있는 행
     * @param labelColIndex 라벨이 있는 열. 이 열의 바로 오른쪽부터 훑습니다
     * @return 첫 비어 있지 않은 값. 없으면 빈 Optional
     */
    public Optional<String> valueRightOf(Sheet sheet, int rowIndex, int labelColIndex) {
        for (int colIndex = labelColIndex + 1;
                colIndex <= labelColIndex + VALUE_SCAN_WIDTH;
                colIndex++) {
            String value = text(sheet, rowIndex, colIndex);
            if (!value.isEmpty() && !isSubheadingLabel(value)) return Optional.of(value);
        }
        return Optional.empty();
    }

    /**
     * 여러 행에 걸친 값을 줄바꿈으로 이어 붙입니다.
     *
     * <p>사업범위·추진경과처럼 한 항목이 여러 행에 나뉘어 적히는 칸에 씁니다. 병합 때문에 같은 값이 연속으로 반복되면 한 번만 담습니다.
     *
     * @param sheet 대상 시트
     * @param startRow 시작 행 (포함)
     * @param endRowExclusive 끝 행 (제외)
     * @param labelColIndex 라벨 열. 각 행에서 이 열의 오른쪽 값을 읽습니다
     * @return 줄바꿈으로 이은 값. 어느 행에도 값이 없으면 빈 문자열
     */
    public String joinedValueRightOf(
            Sheet sheet, int startRow, int endRowExclusive, int labelColIndex) {
        List<String> lines = new ArrayList<>();
        int last = Math.min(endRowExclusive - 1, sheet.getLastRowNum());
        for (int rowIndex = startRow; rowIndex <= last; rowIndex++) {
            Optional<String> value = valueRightOf(sheet, rowIndex, labelColIndex);
            if (value.isEmpty()) continue;
            String line = value.get();
            if (lines.isEmpty() || !lines.get(lines.size() - 1).equals(line)) lines.add(line);
        }
        return String.join("\n", lines);
    }

    /**
     * 표 헤더를 찾아 컬럼 id 별 열 번호 맵을 만듭니다.
     *
     * <p>양식은 헤더가 1~2행에 걸치고 병합이 섞여 있어, 헤더 후보 행과 그 다음 행을 함께 훑어 열별 표기를 모읍니다. `requiredColumns`가 모두 잡힌 첫
     * 행만 헤더로 인정합니다 — 부분 일치를 허용하면 데이터 행의 문구가 헤더로 오인됩니다.
     *
     * @param sheet 대상 시트
     * @param fromRow 이 행부터 아래로 찾습니다. 두 번째 헤더 블록을 찾을 때 첫 블록 다음 행을 넘깁니다
     * @param columnAliases 컬럼 id 별 국문·영문 표기 목록
     * @param requiredColumns 모두 잡혀야 헤더로 인정할 컬럼 id
     * @return 헤더 위치와 열 맵. 없으면 빈 Optional
     */
    public Optional<HeaderMap> findHeader(
            Sheet sheet,
            int fromRow,
            Map<String, List<String>> columnAliases,
            String... requiredColumns) {
        for (int rowIndex = Math.max(fromRow, 0); rowIndex <= sheet.getLastRowNum(); rowIndex++) {
            Map<String, Integer> columnIndex = matchHeaderRow(sheet, rowIndex, columnAliases);
            boolean complete = true;
            for (String required : requiredColumns) {
                if (!columnIndex.containsKey(required)) {
                    complete = false;
                    break;
                }
            }
            if (complete && !columnIndex.isEmpty()) {
                return Optional.of(new HeaderMap(rowIndex, columnIndex));
            }
        }
        return Optional.empty();
    }

    private Map<String, Integer> matchHeaderRow(
            Sheet sheet, int rowIndex, Map<String, List<String>> columnAliases) {
        Map<String, Integer> columnIndex = new LinkedHashMap<>();
        int lastColumn = Math.max(lastColumnOf(sheet, rowIndex), lastColumnOf(sheet, rowIndex + 1));
        for (int colIndex = 0; colIndex <= lastColumn; colIndex++) {
            String primary = normalize(text(sheet, rowIndex, colIndex));
            String secondary = normalize(text(sheet, rowIndex + 1, colIndex));
            for (Map.Entry<String, List<String>> entry : columnAliases.entrySet()) {
                if (columnIndex.containsKey(entry.getKey())) continue;
                for (String alias : entry.getValue()) {
                    String normalizedAlias = normalize(alias);
                    if (normalizedAlias.isEmpty()) continue;
                    if (primary.startsWith(normalizedAlias)
                            || secondary.startsWith(normalizedAlias)) {
                        columnIndex.put(entry.getKey(), colIndex);
                        break;
                    }
                }
            }
        }
        return columnIndex;
    }

    /**
     * 비교용 정규화입니다. 모든 공백(전각 포함)을 제거합니다.
     *
     * <p>공백을 하나로 줄이는 게 아니라 아예 제거합니다 — 양식에 `비 목 명`처럼 글자마다 공백을 넣은 라벨이 있어 압축만으로는 `비목명`과 맞지 않습니다.
     *
     * @param raw 원본 문자열. null이면 빈 문자열
     * @return 정규화된 문자열
     */
    public static String normalize(String raw) {
        if (raw == null) return "";
        return raw.replaceAll("[\\s\\u00A0\\u3000]+", "");
    }

    /**
     * 괄호로 감싼 소제목 표기인지 판정합니다.
     *
     * <p>`(개요)`·`(현황)`처럼 라벨 오른쪽에 또 다른 라벨이 오는 배치가 있어, 값을 찾을 때 이 표기는 건너뜁니다.
     */
    private boolean isSubheadingLabel(String value) {
        return value.startsWith("(") && value.endsWith(")");
    }

    private Cell cellAt(Sheet sheet, int rowIndex, int colIndex) {
        Row row = sheet.getRow(rowIndex);
        return row == null ? null : row.getCell(colIndex);
    }

    private Cell mergedAnchor(Sheet sheet, int rowIndex, int colIndex) {
        for (CellRangeAddress region : sheet.getMergedRegions()) {
            if (region.isInRange(rowIndex, colIndex)) {
                return cellAt(sheet, region.getFirstRow(), region.getFirstColumn());
            }
        }
        return null;
    }

    private int lastColumnOf(Sheet sheet, int rowIndex) {
        Row row = sheet.getRow(rowIndex);
        return row == null ? -1 : row.getLastCellNum();
    }

    /**
     * 찾은 헤더의 위치와 열 맵입니다.
     *
     * @param rowIndex 헤더 행의 0-based 번호. 데이터는 다음 행부터입니다
     * @param columnIndex 컬럼 id 별 0-based 열 번호
     */
    public record HeaderMap(int rowIndex, Map<String, Integer> columnIndex) {

        /**
         * 컬럼 id의 열 번호를 반환합니다.
         *
         * @param id 컬럼 id
         * @return 0-based 열 번호. 그 컬럼이 헤더에 없으면 null
         */
        public Integer column(String id) {
            return columnIndex.get(id);
        }
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*SheetAnchorScannerTest*"`
Expected: PASS — 8개 테스트 전부 성공.

- [ ] **Step 5: 포맷 검사와 커밋**

Run: `cd it_backend && ./gradlew spotlessApply spotlessCheck`
Expected: BUILD SUCCESSFUL.

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/SheetAnchorScanner.java src/test/java/com/kdb/it/domain/migration/request/service/SheetAnchorScannerTest.java
git -C it_backend commit -m "feat(migration): 편성요청서 라벨·헤더 앵커 스캐너

고정 셀 좌표 대신 라벨 텍스트로 행을, 헤더 텍스트 조합으로 열을 찾는다.
실 제출본이 사업범위 칸의 행 수 때문에 같은 항목을 다른 행에 두므로
좌표를 못박으면 파일마다 어긋난다.

비교 전 정규화는 공백을 압축하지 않고 제거한다. 양식에 글자 사이 공백을
넣은 라벨이 있어 압축만으로는 맞지 않는다. 병합 영역은 좌상단 셀 값을
돌려주고, 수식 오류는 빈 값으로 접지 않고 오류 코드를 남겨 깨진 수식이
조용히 사라지지 않게 한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: 국문·영문 대조표와 값 정규화

라벨 별칭, Y/N 표기 4종, 비목 별칭을 한곳에 모은다. 어휘 추가가 상수 한 줄이 되도록 만드는 것이 목적이다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/FormLexicon.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/FormLexiconTest.java`

**Interfaces:**
- Consumes: `SheetAnchorScanner.normalize` (Task 2)
- Produces:
  - `final class FormLexicon` (인스턴스화 금지, 전부 `static`)
    - `static List<String> labelAliases(String canonicalLabel)` — 국문 정본 → 국문·영문 표기 목록
    - `static Map<String, List<String>> columnAliases(Map<String, String> canonicalByColumnId)`
    - `static Optional<String> toYn(String raw)` — `Y`/`N`, 미식별이면 빈 Optional
    - `static String canonicalIoeName(String raw)` — 비목 별칭을 공통코드 표기로 되돌림
    - `static Optional<String> toAbusTc(String continued, String isNew)` — `10`/`20`, 판정 불가면 빈 Optional

- [ ] **Step 1: 실패 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/migration/request/service/FormLexiconTest.java`:

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FormLexiconTest {

    @Test
    @DisplayName("국문 정본으로 국문·영문 표기를 모두 얻는다")
    void resolvesLabelAliases() {
        assertThat(FormLexicon.labelAliases("연간")).contains("연간", "Annual");
        assertThat(FormLexicon.labelAliases("상대처")).contains("상대처", "Counterparty");
        assertThat(FormLexicon.labelAliases("정보보호 관련여부"))
                .contains("정보보호 관련여부", "InfoSec. Related");
    }

    @Test
    @DisplayName("대조표에 없는 라벨은 자기 자신만 별칭으로 돌려준다")
    void unknownLabelFallsBackToItself() {
        assertThat(FormLexicon.labelAliases("존재하지 않는 라벨"))
                .containsExactly("존재하지 않는 라벨");
    }

    @Test
    @DisplayName("컬럼 id별 정본을 별칭 목록으로 펼친다")
    void expandsColumnAliases() {
        Map<String, java.util.List<String>> aliases =
                FormLexicon.columnAliases(Map.of("annual", "연간", "currency", "통화 구분"));

        assertThat(aliases.get("annual")).contains("연간", "Annual");
        assertThat(aliases.get("currency")).contains("통화 구분", "Currency");
    }

    @Test
    @DisplayName("Y 표기 4종 이상을 모두 Y로 접는다")
    void normalizesAffirmativeMarks() {
        for (String raw : new String[] {"O", "○", "◯", "０", "√", "∨", "V", "Y", "y", "●"}) {
            assertThat(FormLexicon.toYn(raw)).as("raw=%s", raw).contains("Y");
        }
    }

    @Test
    @DisplayName("N 표기와 로마숫자 X를 모두 N으로 접는다")
    void normalizesNegativeMarks() {
        // 런던 제출본의 Ⅹ는 알파벳 X가 아니라 로마숫자 10(U+2169)이다
        for (String raw : new String[] {"X", "x", "Ⅹ", "✕", "ㄨ", "N", "n", "", "  "}) {
            assertThat(FormLexicon.toYn(raw)).as("raw=%s", raw).contains("N");
        }
    }

    @Test
    @DisplayName("정의되지 않은 표기는 빈 Optional로 남겨 진단에 넘긴다")
    void leavesUnknownMarkUnresolved() {
        assertThat(FormLexicon.toYn("해당없음")).isEmpty();
        assertThat(FormLexicon.toYn("?")).isEmpty();
    }

    @Test
    @DisplayName("비목 별칭을 공통코드 표기로 되돌린다")
    void canonicalizesIoeAliases() {
        // 양식은 `국외전산유지보수료`, 공통코드는 `국외유지보수료`(014)
        assertThat(FormLexicon.canonicalIoeName("국외전산유지보수료")).isEqualTo("국외유지보수료");
        assertThat(FormLexicon.canonicalIoeName("Foreign branch line usage fees"))
                .isEqualTo("국외회선사용료");
        assertThat(FormLexicon.canonicalIoeName("Foreign branch IT service"))
                .isEqualTo("국외전산용역비");
        assertThat(FormLexicon.canonicalIoeName("Foreign branch IT maintenance fees"))
                .isEqualTo("국외유지보수료");
    }

    @Test
    @DisplayName("대조표에 없는 비목명은 원문 그대로 넘겨 미해석 진단으로 이어지게 한다")
    void keepsUnknownIoeNameAsIs() {
        assertThat(FormLexicon.canonicalIoeName("국외전산기타제비")).isEqualTo("국외전산기타제비");
        assertThat(FormLexicon.canonicalIoeName("Machinery")).isEqualTo("Machinery");
    }

    @Test
    @DisplayName("계속·신규 표시를 사업구분 코드로 바꾼다")
    void mapsContinuedAndNewToAbusTc() {
        assertThat(FormLexicon.toAbusTc("○", "")).contains("20");
        assertThat(FormLexicon.toAbusTc("", "√")).contains("10");
        assertThat(FormLexicon.toAbusTc("", "")).isEmpty();
        assertThat(FormLexicon.toAbusTc("○", "○")).isEmpty();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*FormLexiconTest*"`
Expected: FAIL — `FormLexicon` 클래스 없음.

- [ ] **Step 3: `FormLexicon` 작성**

```java
package com.kdb.it.domain.migration.request.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * 편성요청서 어휘 대조표입니다.
 *
 * <p>해외점포는 같은 양식을 영문으로 번역해 제출합니다(런던지점 실측). 시트명은 국문 그대로라 시트 판별은 영향받지 않지만 라벨·비목명이 전부 영문이라 국문 기준
 * 매칭이 빗나갑니다. 어휘를 이 클래스 한곳에 모아 새 표기가 나타났을 때 상수 한 줄 추가로 끝나게 합니다.
 *
 * <p>대조표는 런던지점 제출본 1건에서 뽑았습니다. 다른 점포의 번역이 다를 수 있으므로 **미식별 어휘를 추측해 매핑하지 않습니다** — 원문을 그대로 넘겨
 * 미해석 진단이 나게 하고 미리보기에서 사람이 고르게 합니다.
 */
public final class FormLexicon {

    private FormLexicon() {
        throw new UnsupportedOperationException("상수 컨테이너 — 인스턴스화 금지");
    }

    /** 사업구분코드: 신규. 공통코드 ABUS_TC. */
    public static final String ABUS_TC_NEW = "10";

    /** 사업구분코드: 계속. 공통코드 ABUS_TC. */
    public static final String ABUS_TC_CONTINUED = "20";

    /** 국문 정본 라벨 → 영문 표기. 국문 자신은 조회 시 앞에 붙입니다. */
    private static final Map<String, List<String>> ENGLISH_BY_LABEL = englishByLabel();

    /** 양식 표기 → 공통코드(IOE_C) 코드값명. 정규화된 키로 비교합니다. */
    private static final Map<String, String> IOE_CANONICAL = ioeCanonical();

    /** 긍정 표기 집합. 양식마다 O·√·● 등이 섞여 있습니다. */
    private static final Set<String> AFFIRMATIVE =
            Set.of("O", "o", "○", "◯", "０", "0", "√", "∨", "V", "v", "Y", "y", "●", "◎");

    /** 부정 표기 집합. 런던 제출본의 `Ⅹ`는 알파벳 X가 아니라 로마숫자 10입니다. */
    private static final Set<String> NEGATIVE =
            Set.of("X", "x", "Ⅹ", "✕", "✖", "ㄨ", "ㄨ", "N", "n", "-");

    /**
     * 국문 정본 라벨의 표기 목록을 만듭니다.
     *
     * @param canonicalLabel 국문 정본 라벨
     * @return 국문 정본이 첫 원소인 표기 목록. 대조표에 없으면 정본 하나만
     */
    public static List<String> labelAliases(String canonicalLabel) {
        List<String> english = ENGLISH_BY_LABEL.get(SheetAnchorScanner.normalize(canonicalLabel));
        if (english == null || english.isEmpty()) return List.of(canonicalLabel);
        java.util.List<String> aliases = new java.util.ArrayList<>();
        aliases.add(canonicalLabel);
        aliases.addAll(english);
        return List.copyOf(aliases);
    }

    /**
     * 컬럼 id별 국문 정본을 별칭 목록으로 펼칩니다.
     *
     * <p>{@link SheetAnchorScanner#findHeader} 에 그대로 넘길 수 있는 형태입니다.
     *
     * @param canonicalByColumnId 컬럼 id 별 국문 정본 라벨
     * @return 컬럼 id 별 표기 목록
     */
    public static Map<String, List<String>> columnAliases(
            Map<String, String> canonicalByColumnId) {
        Map<String, List<String>> out = new LinkedHashMap<>();
        canonicalByColumnId.forEach((columnId, canonical) -> out.put(columnId, labelAliases(canonical)));
        return out;
    }

    /**
     * 양식의 O/X 표기를 Y/N으로 접습니다.
     *
     * <p>정의되지 않은 문자를 조용히 `N`으로 접지 않습니다 — 정보보호 항목이 통째로 뒤집혀도 아무도 알아채지 못합니다. 미식별은 빈 Optional로 남겨
     * 호출자가 미해석 진단을 내게 합니다.
     *
     * @param raw 셀 원문. null·공백은 미표기로 보아 `N`
     * @return `Y` 또는 `N`. 정의되지 않은 표기면 빈 Optional
     */
    public static Optional<String> toYn(String raw) {
        String normalized = SheetAnchorScanner.normalize(raw);
        if (normalized.isEmpty()) return Optional.of("N");
        if (AFFIRMATIVE.contains(normalized)) return Optional.of("Y");
        if (NEGATIVE.contains(normalized)) return Optional.of("N");
        return Optional.empty();
    }

    /**
     * 양식의 비목 표기를 공통코드 코드값명으로 되돌립니다.
     *
     * @param raw 양식의 비목명 (국문 또는 영문)
     * @return 공통코드 표기. 대조표에 없으면 원문 그대로 (미해석 진단으로 이어집니다)
     */
    public static String canonicalIoeName(String raw) {
        if (raw == null) return "";
        String canonical = IOE_CANONICAL.get(SheetAnchorScanner.normalize(raw));
        return canonical == null ? raw.trim() : canonical;
    }

    /**
     * 계약구분의 계속·신규 표시를 사업구분코드로 바꿉니다.
     *
     * @param continued `계속` 열의 셀 원문
     * @param isNew `신규` 열의 셀 원문
     * @return `20`(계속) 또는 `10`(신규). 둘 다 비었거나 둘 다 표시되면 빈 Optional
     */
    public static Optional<String> toAbusTc(String continued, String isNew) {
        boolean continuedMarked = toYn(continued).filter("Y"::equals).isPresent();
        boolean newMarked = toYn(isNew).filter("Y"::equals).isPresent();
        if (continuedMarked == newMarked) return Optional.empty();
        return Optional.of(continuedMarked ? ABUS_TC_CONTINUED : ABUS_TC_NEW);
    }

    private static Map<String, List<String>> englishByLabel() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        put(map, "사업명", "Business Name");
        put(map, "사업 개요", "Business Overview");
        put(map, "항목", "Item");
        put(map, "수량", "Qty", "Quantity");
        put(map, "단가", "Unit Cost");
        put(map, "통화", "Currency");
        put(map, "통화 구분", "Currency");
        put(map, "소요예산 (부가세포함)", "Budget (Tax Included)");
        put(map, "연간 소요예산 (부가세포함)", "Annual Budget (Tax Included)");
        put(map, "도입시기", "Timing");
        put(map, "비고(적용 환율 등)", "Remarks");
        put(map, "비 목 명", "Expense");
        put(map, "계약명 / 건명", "Name of the Contract / Item");
        put(map, "소요예산", "Budget");
        put(map, "월간", "Monthly");
        put(map, "연간", "Annual");
        put(map, "계약", "Contract");
        put(map, "계약구분", "Contract Type");
        put(map, "상대처", "Counterparty");
        put(map, "계속", "Cont.");
        put(map, "신규", "New");
        put(map, "정보보호 관련여부", "InfoSec. Related");
        put(map, "비고(증감사유, 적용환율 등)", "Remarks (Reasons for increase / decrease)");
        return Map.copyOf(map);
    }

    private static void put(Map<String, List<String>> map, String korean, String... english) {
        map.put(SheetAnchorScanner.normalize(korean), List.of(english));
    }

    private static Map<String, String> ioeCanonical() {
        Map<String, String> map = new LinkedHashMap<>();
        // 국문 양식 표기와 공통코드 표기가 어긋나는 것만 담는다.
        // 실측: 양식은 `국외전산유지보수료`, 공통코드(014)는 `국외유지보수료`.
        alias(map, "국외전산유지보수료", "국외유지보수료");
        // 영문 양식 (런던지점 실측)
        alias(map, "Foreign branch IT service", "국외전산용역비");
        alias(map, "Foreign branch line usage fees", "국외회선사용료");
        alias(map, "Foreign branch IT maintenance fees", "국외유지보수료");
        alias(map, "IT Service", "전산용역비");
        alias(map, "IT Expenses", "전산제비");
        alias(map, "IT Lease", "전산임차료");
        alias(map, "IT Travel", "전산여비");
        return Map.copyOf(map);
    }

    private static void alias(Map<String, String> map, String formName, String codeName) {
        map.put(SheetAnchorScanner.normalize(formName), codeName);
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*FormLexiconTest*"`
Expected: PASS — 9개 테스트 전부 성공.

`normalizesNegativeMarks`가 빈 문자열·공백에서 실패하면 `toYn`의 미표기 처리(`normalized.isEmpty()` → `N`)를 확인한다.

- [ ] **Step 5: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/FormLexicon.java src/test/java/com/kdb/it/domain/migration/request/service/FormLexiconTest.java
git -C it_backend commit -m "feat(migration): 편성요청서 국문·영문 대조표와 값 정규화

해외점포는 같은 양식을 영문으로 번역해 제출한다. 라벨·비목명 대조표를
한곳에 모아 새 표기가 나와도 상수 한 줄로 끝나게 한다.

Y/N 표기는 양식마다 O·√·●·X·Ⅹ가 섞여 있고 런던 제출본의 Ⅹ는 알파벳 X가
아니라 로마숫자 10(U+2169)이다. 정의되지 않은 문자는 조용히 N으로 접지 않고
빈 Optional로 남겨 미해석 진단이 나게 한다. 잘못 접으면 정보보호 항목이
통째로 뒤집혀도 드러나지 않는다.

비목 별칭에 양식의 '국외전산유지보수료'와 공통코드 014의 '국외유지보수료'
불일치를 담는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: 비목 계층 인덱스

`CO_CDVA_SPS`의 `일반관리비 - 전산임차료 - 국내전산임차료` 계층으로 비목코드를 2단계 매칭한다. 시트 ③은 (A열 중분류, B열 세부)로, 시트 1-2·②는 (중분류, 국내/국외)로 찾는다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/IoeHierarchyIndex.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/IoeHierarchyIndexTest.java`

**Interfaces:**
- Consumes: `FormLexicon.canonicalIoeName`, `SheetAnchorScanner.normalize` (Task 2·3), `com.kdb.it.common.code.entity.Ccodem`(`getCdva()`=`CDVA_ID`, `getCdvaNm()`=코드값명, `getCdvaDtl()`=`CO_CDVA_SPS`), `com.kdb.it.common.code.repository.CodeRepository.findByCIdAndDelYn(String, String)`, `com.kdb.it.common.code.CommonCodeGroups.IOE`, `com.kdb.it.domain.migration.dto.MigrationDto.Candidate`
- Produces:
  - `class IoeHierarchyIndex` (`@Component`)
    - `Snapshot snapshot()` — `CCODEM` 1회 조회로 인덱스 생성
  - `class IoeHierarchyIndex.Snapshot`
    - `Resolution resolveByDetail(String midCategory, String detailName)` — 시트 ③
    - `Resolution resolveByGroup(String groupLabel, boolean domestic)` — 시트 1-2·②
    - `boolean exists(String ioeCode)`
  - `record IoeHierarchyIndex.Resolution(String code, String label, List<MigrationDto.Candidate> candidates, boolean ambiguous)`
    - `boolean isUnresolved()` — `code == null && !ambiguous`
    - `boolean isAmbiguous()`

- [ ] **Step 1: 실패 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/migration/request/service/IoeHierarchyIndexTest.java`:

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.kdb.it.common.code.CommonCodeGroups;
import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CodeRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IoeHierarchyIndexTest {

    @Mock private CodeRepository codeRepository;

    private IoeHierarchyIndex.Snapshot snapshot;

    /** 로컬 Oracle 실측값 그대로. CDVA_ID·CDVA_NM·CO_CDVA_SPS 세 컬럼만 인덱스에 쓴다. */
    private static Ccodem code(String cdva, String name, String sps) {
        Ccodem entity = new Ccodem();
        entity.setCdva(cdva);
        entity.setCdvaNm(name);
        entity.setCdvaDtl(sps);
        return entity;
    }

    @BeforeEach
    void setUp() {
        when(codeRepository.findByCIdAndDelYn(CommonCodeGroups.IOE, "N"))
                .thenReturn(
                        List.of(
                                code("001", "국내전산임차료", "일반관리비 - 전산임차료 - 국내전산임차료"),
                                code("002", "국외전산임차료", "일반관리비 - 전산임차료 - 국외전산임차료"),
                                code("003", "국내출장", "일반관리비 - 전산여비 - 국내출장"),
                                code("004", "국외출장", "일반관리비 - 전산여비 - 국외출장"),
                                code("006", "원고강사심사료", "일반관리비 - 전산용역비 - 원고강사심사료"),
                                code("007", "국외전산용역비", "일반관리비 - 전산용역비 - 국외전산용역비"),
                                code("008", "외주용역(외주운영/관제 등)", "일반관리비 - 전산용역비 - 외주용역 - 외주운영/관제 등"),
                                code("009", "외주용역(자문/심사)", "일반관리비 - 전산용역비 - 외주용역 - 자문/심사"),
                                code("010", "회선사용료", "일반관리비 - 전산제비 - 회선사용료"),
                                code("011", "유지보수료", "일반관리비 - 전산제비 - 유지보수료"),
                                code("012", "전산소모품비", "일반관리비 - 전산제비 - 전산소모품비"),
                                code("013", "국외회선사용료", "일반관리비 - 전산제비 - 국외회선사용료"),
                                code("014", "국외유지보수료", "일반관리비 - 전산제비 - 국외유지보수료"),
                                code("015", "국외전산소모품비", "일반관리비 - 전산제비 - 국외전산소모품비"),
                                code("101", "국내기계장치", "자본예산 - 기계장치 - 국내"),
                                code("102", "국외기계장치", "자본예산 - 기계장치 - 국외"),
                                code("103", "개발비(일반)", "자본예산 - 개발비 - 일반"),
                                code("104", "개발비(감리/컨설팅)", "자본예산 - 개발비 - 감리/컨설팅"),
                                code("105", "국외기타무형자산", "자본예산 - 기타무형자산 - 국외"),
                                code("106", "국내기타무형자산(일반)", "자본예산 - 기타무형자산 - 국내 - 일반"),
                                code("107", "국내기타무형자산(SW라이선스)", "자본예산 - 기타무형자산 - 국내 - SW라이선스")));
        snapshot = new IoeHierarchyIndex(codeRepository).snapshot();
    }

    @Test
    @DisplayName("시트 3의 (중분류, 세부) 쌍으로 비목을 확정한다")
    void resolvesByDetailPair() {
        assertThat(snapshot.resolveByDetail("전산 임차료", "국내전산임차료").code()).isEqualTo("001");
        assertThat(snapshot.resolveByDetail("전산 여비", "국외출장").code()).isEqualTo("004");
        assertThat(snapshot.resolveByDetail("전산 제비", "회선사용료").code()).isEqualTo("010");
    }

    @Test
    @DisplayName("양식 표기가 공통코드와 달라도 대조표로 되돌려 확정한다")
    void resolvesThroughLexiconAlias() {
        // 양식은 `국외전산유지보수료`, 공통코드 014는 `국외유지보수료`
        assertThat(snapshot.resolveByDetail("전산 제비", "국외전산유지보수료").code()).isEqualTo("014");
        // 영문 양식
        assertThat(snapshot.resolveByDetail("IT Expenses", "Foreign branch line usage fees").code())
                .isEqualTo("013");
    }

    @Test
    @DisplayName("외주용역은 008·009 두 코드가 걸려 중의적으로 남는다")
    void marksOutsourcingAmbiguous() {
        IoeHierarchyIndex.Resolution resolution = snapshot.resolveByDetail("전산 용역비", "외주용역");

        assertThat(resolution.isAmbiguous()).isTrue();
        assertThat(resolution.code()).isNull();
        assertThat(resolution.candidates())
                .extracting(com.kdb.it.domain.migration.dto.MigrationDto.Candidate::code)
                .containsExactlyInAnyOrder("008", "009");
    }

    @Test
    @DisplayName("대응 코드가 없는 세부비목은 미해석으로 남는다")
    void marksUnknownDetailUnresolved() {
        IoeHierarchyIndex.Resolution resolution = snapshot.resolveByDetail("전산 제비", "국외전산기타제비");

        assertThat(resolution.isUnresolved()).isTrue();
        assertThat(resolution.isAmbiguous()).isFalse();
    }

    @Test
    @DisplayName("시트 1-2의 중분류와 통화로 자본예산 비목을 정한다")
    void resolvesCapitalByGroupAndCurrency() {
        assertThat(snapshot.resolveByGroup("기계장치(HW)", true).code()).isEqualTo("101");
        assertThat(snapshot.resolveByGroup("기계장치(HW)", false).code()).isEqualTo("102");
        assertThat(snapshot.resolveByGroup("기타무형자산(SW)", false).code()).isEqualTo("105");
        assertThat(snapshot.resolveByGroup("전산임차료", true).code()).isEqualTo("001");
        assertThat(snapshot.resolveByGroup("전산임차료", false).code()).isEqualTo("002");
    }

    @Test
    @DisplayName("기본값이 있는 중분류는 기본 코드와 대안 후보를 함께 준다")
    void offersDefaultWithAlternatives() {
        IoeHierarchyIndex.Resolution development = snapshot.resolveByGroup("개발비", true);
        assertThat(development.code()).isEqualTo("103");
        assertThat(development.candidates())
                .extracting(com.kdb.it.domain.migration.dto.MigrationDto.Candidate::code)
                .contains("104");

        IoeHierarchyIndex.Resolution software = snapshot.resolveByGroup("기타무형자산(SW)", true);
        assertThat(software.code()).isEqualTo("106");
        assertThat(software.candidates())
                .extracting(com.kdb.it.domain.migration.dto.MigrationDto.Candidate::code)
                .contains("107");
    }

    @Test
    @DisplayName("전산제비는 세부가 양식에 없어 항상 중의적이다")
    void marksGeneralExpenseGroupAmbiguous() {
        IoeHierarchyIndex.Resolution resolution = snapshot.resolveByGroup("전산제비", true);

        assertThat(resolution.isAmbiguous()).isTrue();
        assertThat(resolution.candidates()).hasSizeGreaterThan(1);
    }

    @Test
    @DisplayName("보정값으로 들어온 비목코드의 실재 여부를 확인한다")
    void checksCodeExistence() {
        assertThat(snapshot.exists("101")).isTrue();
        assertThat(snapshot.exists("999")).isFalse();
        assertThat(snapshot.exists(null)).isFalse();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*IoeHierarchyIndexTest*"`
Expected: FAIL — `IoeHierarchyIndex` 클래스 없음.

- [ ] **Step 3: `IoeHierarchyIndex` 작성**

```java
package com.kdb.it.domain.migration.request.service;

import com.kdb.it.common.code.CommonCodeGroups;
import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CodeRepository;
import com.kdb.it.domain.migration.dto.MigrationDto;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 비목(IOE_C) 공통코드의 계층 인덱스입니다.
 *
 * <p>`CO_CDVA_SPS`가 `일반관리비 - 전산임차료 - 국내전산임차료` 형태의 계층 문자열이라, 편성요청서 시트 ③의 (A열 비목명, B열 세부비목) 쌍과 그대로
 * 대응합니다. 코드값명 하나로 맞추는 것보다 견고합니다 — 양식 표기와 코드값명이 어긋나는 경우(`국외전산유지보수료` 대 `국외유지보수료`)에도 중분류가 함께
 * 걸려 오매칭이 줄어듭니다.
 *
 * <p>시트 1-2·②는 세부 없이 중분류(`기계장치(HW)` 등)만 적혀 있어 통화의 국내·국외 구분을 두 번째 열쇠로 씁니다.
 */
@Component
@RequiredArgsConstructor
public class IoeHierarchyIndex {

    /** 중분류·국내여부로 유일하게 좁혀지지 않을 때 쓸 기본 코드와 그 대안. 설계 §4.3 추정표. */
    private static final Map<String, String> DEFAULT_CODE_BY_GROUP =
            Map.of("개발비", "103", "기타무형자산", "106");

    private final CodeRepository codeRepository;

    /**
     * 비목 공통코드를 전량 읽어 인덱스를 만듭니다.
     *
     * <p>dry-run·commit 각 배치의 시작에서 한 번만 만들고 그 배치 안에서 재사용합니다. 파일마다 조회하면 수백 회 조회가 됩니다.
     *
     * @return 계층 인덱스 스냅샷
     */
    public Snapshot snapshot() {
        return new Snapshot(codeRepository.findByCIdAndDelYn(CommonCodeGroups.IOE, "N"));
    }

    /** 비목 계층 인덱스입니다. 한 배치 처리 동안만 살아 있습니다. */
    public static final class Snapshot {

        /** (중분류, 세부) 정규화 키 → 코드 목록. 둘 이상이면 중의적입니다. */
        private final Map<String, List<Ccodem>> byDetail = new LinkedHashMap<>();

        /** 중분류 정규화 키 → 코드 목록. */
        private final Map<String, List<Ccodem>> byGroup = new LinkedHashMap<>();

        private final Set<String> codes = new LinkedHashSet<>();

        private Snapshot(List<Ccodem> allCodes) {
            for (Ccodem code : allCodes) {
                if (code.getCdva() == null) continue;
                codes.add(code.getCdva().trim());
                String[] parts = splitHierarchy(code.getCdvaDtl());
                if (parts.length < 3) continue;
                String group = SheetAnchorScanner.normalize(parts[1]);
                String detail = SheetAnchorScanner.normalize(parts[2]);
                byGroup.computeIfAbsent(group, key -> new ArrayList<>()).add(code);
                byDetail.computeIfAbsent(group + " " + detail, key -> new ArrayList<>()).add(code);
            }
        }

        /**
         * 시트 ③의 (중분류, 세부) 쌍으로 비목을 찾습니다.
         *
         * @param midCategory A열 비목명 (`전산 임차료`, `IT Expenses` 등)
         * @param detailName B열 세부비목 (`국내전산임차료`, `Foreign branch line usage fees` 등)
         * @return 해석 결과. 후보가 둘 이상이면 중의적, 없으면 미해석
         */
        public Resolution resolveByDetail(String midCategory, String detailName) {
            String group = SheetAnchorScanner.normalize(FormLexicon.canonicalIoeName(midCategory));
            String detail = SheetAnchorScanner.normalize(FormLexicon.canonicalIoeName(detailName));
            List<Ccodem> matches = byDetail.get(group + " " + detail);
            if (matches == null || matches.isEmpty()) {
                return Resolution.unresolved(detailName);
            }
            if (matches.size() == 1) {
                return Resolution.of(matches.get(0));
            }
            return Resolution.ambiguous(detailName, matches);
        }

        /**
         * 시트 1-2·②의 중분류와 통화로 비목을 찾습니다.
         *
         * <p>중분류의 괄호 표기(`기계장치(HW)`)를 떼고 계층의 중분류(`기계장치`)와 맞춥니다. 국내·국외는 세부가 `국외`로 시작하는지로 가릅니다 —
         * 세부에 국내·국외 구분이 없는 중분류(개발비)에서는 이 필터가 아무것도 걸러내지 않아 기본값 규칙으로 넘어갑니다.
         *
         * @param groupLabel 시트의 중분류 표기
         * @param domestic 원화 행이면 true, 외화 행이면 false
         * @return 해석 결과. 기본값이 있으면 그 코드와 대안 후보를 함께 담습니다
         */
        public Resolution resolveByGroup(String groupLabel, boolean domestic) {
            String group = SheetAnchorScanner.normalize(stripParenthetical(FormLexicon.canonicalIoeName(groupLabel)));
            List<Ccodem> matches = byGroup.get(group);
            if (matches == null || matches.isEmpty()) return Resolution.unresolved(groupLabel);

            List<Ccodem> narrowed = new ArrayList<>();
            for (Ccodem code : matches) {
                String[] parts = splitHierarchy(code.getCdvaDtl());
                boolean foreign = parts.length >= 3 && SheetAnchorScanner.normalize(parts[2]).startsWith("국외");
                if (foreign != domestic) narrowed.add(code);
            }
            if (narrowed.isEmpty()) narrowed = matches;
            if (narrowed.size() == 1) return Resolution.of(narrowed.get(0));

            String defaultCode = DEFAULT_CODE_BY_GROUP.get(group);
            if (defaultCode != null) {
                for (Ccodem code : narrowed) {
                    if (defaultCode.equals(code.getCdva().trim())) {
                        return Resolution.withDefault(code, narrowed);
                    }
                }
            }
            return Resolution.ambiguous(groupLabel, narrowed);
        }

        /**
         * 비목코드가 실재하는지 확인합니다. 미리보기 보정값을 신뢰하기 전에 씁니다.
         *
         * @param ioeCode 비목코드
         * @return 등록되어 있으면 true. null이면 false
         */
        public boolean exists(String ioeCode) {
            return ioeCode != null && codes.contains(ioeCode.trim());
        }

        private static String[] splitHierarchy(String sps) {
            return sps == null ? new String[0] : sps.split("\\s*-\\s*");
        }

        private static String stripParenthetical(String label) {
            if (label == null) return "";
            int open = label.indexOf('(');
            return open > 0 ? label.substring(0, open) : label;
        }
    }

    /**
     * 비목 해석 결과입니다.
     *
     * @param code 확정된 비목코드. 미해석·중의적이면 null
     * @param label 사용자에게 보여줄 이름. 미해석이면 입력 원문
     * @param candidates 보정 후보. 확정이고 대안도 없으면 빈 목록
     * @param ambiguous 후보들이 동등하게 성립하는 중의적 상태인지 여부
     */
    public record Resolution(
            String code, String label, List<MigrationDto.Candidate> candidates, boolean ambiguous) {

        private static Resolution of(Ccodem code) {
            return new Resolution(code.getCdva().trim(), code.getCdvaNm(), List.of(), false);
        }

        private static Resolution withDefault(Ccodem chosen, List<Ccodem> all) {
            return new Resolution(
                    chosen.getCdva().trim(), chosen.getCdvaNm(), toCandidates(all), false);
        }

        private static Resolution unresolved(String input) {
            return new Resolution(null, input == null ? "" : input, List.of(), false);
        }

        private static Resolution ambiguous(String input, List<Ccodem> all) {
            return new Resolution(null, input == null ? "" : input, toCandidates(all), true);
        }

        private static List<MigrationDto.Candidate> toCandidates(List<Ccodem> all) {
            List<MigrationDto.Candidate> candidates = new ArrayList<>();
            for (Ccodem code : all) {
                candidates.add(new MigrationDto.Candidate(code.getCdva().trim(), code.getCdvaNm()));
            }
            return List.copyOf(candidates);
        }

        /** 확정되지 않았고 중의적이지도 않은 상태인지 판정합니다. */
        public boolean isUnresolved() {
            return code == null && !ambiguous;
        }

        /** 후보들이 동등하게 성립하는 중의적 상태인지 판정합니다. */
        public boolean isAmbiguous() {
            return ambiguous;
        }
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*IoeHierarchyIndexTest*"`
Expected: PASS — 8개 테스트 전부 성공.

`Ccodem`에 `setCdva`·`setCdvaNm`·`setCdvaDtl` 세터가 없으면 테스트에서 Lombok `@Builder`를 쓰거나 리플렉션 대신 생성자를 확인한다. 엔티티를 수정하지 않는다.

- [ ] **Step 5: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/IoeHierarchyIndex.java src/test/java/com/kdb/it/domain/migration/request/service/IoeHierarchyIndexTest.java
git -C it_backend commit -m "feat(migration): 편성요청서 비목 계층 인덱스

CO_CDVA_SPS의 '일반관리비 - 전산임차료 - 국내전산임차료' 계층이 편성요청서
시트 3의 (비목명, 세부비목) 쌍과 그대로 대응한다. 코드값명 하나로 맞추는
것보다 오매칭이 적다.

시트 1-2와 2는 세부 없이 중분류만 적혀 있어 통화의 국내·국외 구분을 두 번째
열쇠로 쓴다. 개발비·국내기타무형자산은 기본 코드와 대안 후보를 함께 돌려주고,
전산제비와 외주용역은 후보가 둘 이상이라 중의적으로 남겨 미리보기에서 고르게
한다. 대응 코드가 없는 국외전산기타제비는 새 공통코드를 만들지 않고 미해석으로
둔다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: 금액 단위 판정

1-1 요약표와 1-2 품목 합계를 대사해 배수를 역추정하고, 시트 ③은 휴리스틱 기본값을 제안한다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/AmountUnitResolver.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/AmountUnitResolverTest.java`

**Interfaces:**
- Consumes: 없음 (순수 계산)
- Produces:
  - `final class AmountUnitResolver` (전부 `static`)
    - `static Optional<Long> inferMultiplier(BigDecimal declared, BigDecimal actual)`
    - `static long suggestGeneralExpenseMultiplier(List<BigDecimal> krwAnnualAmounts)`
    - `static BigDecimal applyMultiplier(BigDecimal raw, long multiplier)`
    - `static final long UNIT_WON = 1L`, `UNIT_THOUSAND = 1_000L`, `UNIT_MILLION = 1_000_000L`

- [ ] **Step 1: 실패 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/migration/request/service/AmountUnitResolverTest.java`:

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AmountUnitResolverTest {

    @Test
    @DisplayName("1-1이 백만원으로 적힌 파일의 배수를 10의 6승으로 역추정한다")
    void infersMillionMultiplier() {
        // 스마트워크 인프라 실측: 1-1 '26년도 합계 2699(백만원), 1-2 품목 합계 2,698,850,000원
        assertThat(
                        AmountUnitResolver.inferMultiplier(
                                new BigDecimal("2699"), new BigDecimal("2698850000")))
                .contains(AmountUnitResolver.UNIT_MILLION);
    }

    @Test
    @DisplayName("1-1이 원으로 적힌 파일의 배수를 1로 역추정한다")
    void infersWonMultiplier() {
        // 자금운용실 실측: 1-1 '26년도 합계와 1-2 품목 합계가 모두 1,211,418,360원
        assertThat(
                        AmountUnitResolver.inferMultiplier(
                                new BigDecimal("1211418360"), new BigDecimal("1211418360")))
                .contains(AmountUnitResolver.UNIT_WON);
    }

    @Test
    @DisplayName("천원 단위로 적힌 경우도 판정한다")
    void infersThousandMultiplier() {
        assertThat(
                        AmountUnitResolver.inferMultiplier(
                                new BigDecimal("1211418"), new BigDecimal("1211418360")))
                .contains(AmountUnitResolver.UNIT_THOUSAND);
    }

    @Test
    @DisplayName("어느 배수로도 맞지 않으면 빈 Optional로 남겨 불일치 경고를 내게 한다")
    void leavesUnmatchedAmountUnresolved() {
        assertThat(AmountUnitResolver.inferMultiplier(new BigDecimal("500"), new BigDecimal("2698850000")))
                .isEmpty();
    }

    @Test
    @DisplayName("어느 한쪽이 0이거나 null이면 판정하지 않는다")
    void skipsWhenEitherSideIsAbsent() {
        assertThat(AmountUnitResolver.inferMultiplier(null, new BigDecimal("100"))).isEmpty();
        assertThat(AmountUnitResolver.inferMultiplier(BigDecimal.ZERO, new BigDecimal("100"))).isEmpty();
        assertThat(AmountUnitResolver.inferMultiplier(new BigDecimal("100"), BigDecimal.ZERO)).isEmpty();
    }

    @Test
    @DisplayName("시트 3의 원화 금액이 백만 이상이면 원 단위로 제안한다")
    void suggestsWonForLargeKrwAmounts() {
        // 자금운용실 실측: 연간 841,854,085원
        assertThat(
                        AmountUnitResolver.suggestGeneralExpenseMultiplier(
                                List.of(new BigDecimal("841854085"), new BigDecimal("35838000"))))
                .isEqualTo(AmountUnitResolver.UNIT_WON);
    }

    @Test
    @DisplayName("시트 3의 원화 금액이 모두 작으면 헤더 표기대로 천원 단위로 제안한다")
    void suggestsThousandForSmallKrwAmounts() {
        assertThat(
                        AmountUnitResolver.suggestGeneralExpenseMultiplier(
                                List.of(new BigDecimal("841854"), new BigDecimal("35838"))))
                .isEqualTo(AmountUnitResolver.UNIT_THOUSAND);
    }

    @Test
    @DisplayName("원화 행이 하나도 없으면 원 단위로 제안한다")
    void suggestsWonWhenNoKrwRow() {
        assertThat(AmountUnitResolver.suggestGeneralExpenseMultiplier(List.of()))
                .isEqualTo(AmountUnitResolver.UNIT_WON);
    }

    @Test
    @DisplayName("배수를 적용해 원 단위 금액을 만든다")
    void appliesMultiplier() {
        assertThat(AmountUnitResolver.applyMultiplier(new BigDecimal("2699"), 1_000_000L))
                .isEqualByComparingTo(new BigDecimal("2699000000"));
        assertThat(AmountUnitResolver.applyMultiplier(null, 1_000L)).isNull();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*AmountUnitResolverTest*"`
Expected: FAIL — `AmountUnitResolver` 클래스 없음.

- [ ] **Step 3: `AmountUnitResolver` 작성**

```java
package com.kdb.it.domain.migration.request.service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.util.List;
import java.util.Optional;

/**
 * 편성요청서의 금액 단위를 판정합니다.
 *
 * <p>1-1 요약표의 헤더는 `백만원`이라고 적혀 있지만 실제 기재 단위가 부점마다 다릅니다(실측: 한 파일은 `2637`, 다른 파일은 `1014981660`).
 * 반면 1-2 소요자원은 `수량 × 단가`라 항상 원 단위입니다. 그래서 **1-2를 금액 원본으로 삼고** 1-1은 배수를 역추정해 대사하는 데만 씁니다.
 *
 * <p>시트 ③은 대사할 상대 시트가 없어 자동 판정이 불가능합니다. 여기서는 기본값만 제안하고 최종 단위는 미리보기에서 사람이 확정합니다.
 */
public final class AmountUnitResolver {

    private AmountUnitResolver() {
        throw new UnsupportedOperationException("계산 유틸 — 인스턴스화 금지");
    }

    /** 원 단위. 배수 1. */
    public static final long UNIT_WON = 1L;

    /** 천원 단위. 배수 1,000. */
    public static final long UNIT_THOUSAND = 1_000L;

    /** 백만원 단위. 배수 1,000,000. */
    public static final long UNIT_MILLION = 1_000_000L;

    /** 판정에 시도할 배수. 큰 단위부터 보면 반올림 오차가 큰 쪽이 먼저 걸리므로 작은 단위부터 봅니다. */
    private static final long[] CANDIDATE_MULTIPLIERS = {UNIT_WON, UNIT_THOUSAND, UNIT_MILLION};

    /**
     * 허용 상대 오차.
     *
     * <p>백만원 단위로 적으면 100만원 미만이 반올림으로 사라집니다. 실측 사례(`2699`백만원 대 2,698,850,000원)의 오차가 0.0056%이고,
     * 품목이 많을수록 반올림이 누적되므로 0.5%를 둡니다. 이보다 크게 어긋나면 단위 문제가 아니라 기재 오류로 보아 판정하지 않습니다.
     */
    private static final BigDecimal TOLERANCE_RATIO = new BigDecimal("0.005");

    /**
     * 시트 ③의 원화 금액이 이 값 이상이면 원 단위로 봅니다.
     *
     * <p>천원 단위로 적은 연간 계약금액이 100만(=10억원)을 넘는 경우는 실무상 없고, 원 단위로 적은 금액이 100만원 미만인 경우는 흔치 않습니다.
     */
    private static final BigDecimal WON_THRESHOLD = new BigDecimal("1000000");

    /**
     * 1-1 요약표 기재값과 1-2 품목 합계를 대사해 요약표의 단위 배수를 역추정합니다.
     *
     * @param declared 1-1 `'26년도 합계` 기재값
     * @param actual 1-2 품목 합계 (원 단위)
     * @return 배수. 어느 후보로도 허용 오차 안에 들지 않거나 어느 한쪽이 없으면 빈 Optional
     */
    public static Optional<Long> inferMultiplier(BigDecimal declared, BigDecimal actual) {
        if (declared == null || actual == null) return Optional.empty();
        if (declared.signum() == 0 || actual.signum() == 0) return Optional.empty();

        BigDecimal allowed = actual.abs().multiply(TOLERANCE_RATIO);
        for (long multiplier : CANDIDATE_MULTIPLIERS) {
            BigDecimal scaled = declared.multiply(BigDecimal.valueOf(multiplier));
            if (scaled.subtract(actual).abs().compareTo(allowed) <= 0) {
                return Optional.of(multiplier);
            }
        }
        return Optional.empty();
    }

    /**
     * 시트 ③의 단위 기본값을 제안합니다.
     *
     * <p>헤더는 `천원`이라고 적혀 있지만 원 단위로 적어 내는 부점이 있습니다(실측). 원화 행의 최댓값으로 갈라 제안하고, 최종 확정은 미리보기에서 사람이
     * 합니다 — 이 판정은 제안일 뿐이라 항상 `UNIT_UNCERTAIN` 경고를 함께 냅니다.
     *
     * @param krwAnnualAmounts 시트 ③ 원화 행의 연간 금액 목록. 외화 행은 넣지 않습니다
     * @return 제안 배수. 원화 행이 없으면 원 단위
     */
    public static long suggestGeneralExpenseMultiplier(List<BigDecimal> krwAnnualAmounts) {
        BigDecimal max = BigDecimal.ZERO;
        for (BigDecimal amount : krwAnnualAmounts) {
            if (amount != null && amount.abs().compareTo(max) > 0) max = amount.abs();
        }
        if (max.signum() == 0) return UNIT_WON;
        return max.compareTo(WON_THRESHOLD) >= 0 ? UNIT_WON : UNIT_THOUSAND;
    }

    /**
     * 배수를 적용해 원 단위 금액을 만듭니다.
     *
     * @param raw 시트 기재값
     * @param multiplier 배수
     * @return 원 단위 금액. `raw`가 null이면 null
     */
    public static BigDecimal applyMultiplier(BigDecimal raw, long multiplier) {
        if (raw == null) return null;
        return raw.multiply(BigDecimal.valueOf(multiplier), MathContext.DECIMAL64);
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*AmountUnitResolverTest*"`
Expected: PASS — 9개 테스트 전부 성공.

- [ ] **Step 5: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/AmountUnitResolver.java src/test/java/com/kdb/it/domain/migration/request/service/AmountUnitResolverTest.java
git -C it_backend commit -m "feat(migration): 편성요청서 금액 단위 판정

1-1 요약표 헤더는 백만원인데 실제 기재 단위가 부점마다 다르다(실측 2637 대
1014981660). 1-2 소요자원은 수량×단가라 항상 원 단위이므로 1-2를 원본으로
삼고 1-1은 배수를 역추정해 대사에만 쓴다.

허용 오차 0.5퍼센트는 백만원 반올림 손실을 흡수하되 기재 오류는 걸러내는
폭이다. 시트 3은 대사할 상대가 없어 자동 판정이 불가능하므로 원화 최댓값으로
기본값만 제안하고 확정은 미리보기에서 사람이 한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: 요청·응답 계약과 진단 코드

프론트와 주고받을 형태를 먼저 못박는다. 이후 어댑터·검증기·컨트롤러가 모두 이 계약을 향해 작성된다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormDiagnosticCode.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormDto.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/dto/RequestFormOpenApiContractTest.java`

**Interfaces:**
- Consumes: `FormSheetKind` (Task 1), `MigrationDto.Candidate`, `MigrationDto.Severity`
- Produces:
  - `enum RequestFormDiagnosticCode` — 16개 코드, 각각 `MigrationDto.Severity severity()`
  - `enum RequestFormDto.FileStatus { APPLIED, BLOCKED, FAILED }`
  - `record RequestFormDto.FileEntry(String fileKey, String deptName, String deptCodeOverride, Long generalExpenseMultiplier, String bgUntAbusC)`
  - `record RequestFormDto.CellOverride(String fileKey, FormSheetKind sheet, Integer excelRow, String field, String value)`
  - `record RequestFormDto.ImportManifest(String bseYy, List<FileEntry> entries, List<CellOverride> overrides)`
  - `record RequestFormDto.FormDiagnostic(FormSheetKind sheet, Integer excelRow, String field, RequestFormDiagnosticCode code, MigrationDto.Severity severity, String message, List<MigrationDto.Candidate> candidates)`
  - `record RequestFormDto.CreatedRecord(String table, String key, String label)`
  - `record RequestFormDto.FileResult(String fileKey, String deptName, FileStatus status, List<FormDiagnostic> diagnostics, List<CreatedRecord> created, Long suggestedGeneralExpenseMultiplier)`
  - `record RequestFormDto.ImportSummary(int totalFiles, int appliedFiles, int blockedFiles, int createdProjects, int createdItems, int createdCosts)`
  - `record RequestFormDto.ImportResponse(boolean dryRun, ImportSummary summary, List<FileResult> files)`

- [ ] **Step 1: 진단 코드 enum 작성**

```java
package com.kdb.it.domain.migration.request.dto;

import com.kdb.it.domain.migration.dto.MigrationDto;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 편성요청서 반입 진단 코드입니다.
 *
 * <p>심각도를 코드에 붙여 두어 검증기가 코드만 고르면 심각도가 따라오게 합니다. BLOCKER가 하나라도 남은 파일은 반영하지 않고, WARNING만 있는 파일은
 * 반영합니다. 심각도를 호출부에서 정하게 하면 같은 코드가 파일마다 다른 심각도로 나가 사용자가 기준을 잡을 수 없습니다.
 */
@Schema(name = "RequestFormDiagnosticCode", description = "편성요청서 반입 진단 코드")
public enum RequestFormDiagnosticCode {
    /** POI가 워크북을 열지 못함 (손상·암호·엑셀 아님) */
    FILE_UNREADABLE(MigrationDto.Severity.BLOCKER),
    /** 인식 가능한 시트가 하나도 없음 */
    SHEET_NOT_FOUND(MigrationDto.Severity.BLOCKER),
    /** 라벨·헤더 앵커 실패 (양식이 과도하게 개조됨) */
    ANCHOR_NOT_FOUND(MigrationDto.Severity.BLOCKER),
    /** 폴더명·주관부서/팀이 조직에 없음 */
    ORG_UNRESOLVED(MigrationDto.Severity.BLOCKER),
    /** 조직 후보가 둘 이상 */
    ORG_AMBIGUOUS(MigrationDto.Severity.BLOCKER),
    /** 값이 있는데 사용자 해석 실패 (공란은 진단 대상이 아님) */
    USER_UNRESOLVED(MigrationDto.Severity.BLOCKER),
    /** 동명이인 */
    USER_AMBIGUOUS(MigrationDto.Severity.BLOCKER),
    /** 비목·통화·전결권·추진가능성 미매칭 */
    CODE_UNRESOLVED(MigrationDto.Severity.BLOCKER),
    /** 코드 후보가 둘 이상 (전산제비, 외주용역 등) */
    CODE_AMBIGUOUS(MigrationDto.Severity.BLOCKER),
    /** 사업명·품목 금액 등 필수값 공백 */
    REQUIRED_MISSING(MigrationDto.Severity.BLOCKER),
    /** 자연키로 기존 행이 이미 존재 (재업로드 거부) */
    DUPLICATE_EXISTS(MigrationDto.Severity.BLOCKER),
    /** 물리 컬럼 길이 초과 */
    LENGTH_EXCEEDED(MigrationDto.Severity.BLOCKER),
    /** 시트 ③ 단위를 휴리스틱으로 추정함 — 확인 요청 */
    UNIT_UNCERTAIN(MigrationDto.Severity.WARNING),
    /** 1-1 요약 대 1-2 합계, 월간×주기 대 연간, 소계·총계 불일치 */
    AMOUNT_MISMATCH(MigrationDto.Severity.WARNING),
    /** 사업구분·편성기준·보고상태 항목이 공란 */
    OPTIONAL_MISSING(MigrationDto.Severity.WARNING),
    /** 실무자(부)처럼 담을 컬럼이 없어 미적재한 값 */
    SUBSTITUTE_DROPPED(MigrationDto.Severity.WARNING),
    /** `25/06` 같은 날짜 표기 파싱 실패 → null */
    DATE_UNPARSEABLE(MigrationDto.Severity.WARNING);

    private final MigrationDto.Severity severity;

    RequestFormDiagnosticCode(MigrationDto.Severity severity) {
        this.severity = severity;
    }

    /**
     * 이 코드의 심각도를 반환합니다.
     *
     * @return BLOCKER 또는 WARNING
     */
    public MigrationDto.Severity severity() {
        return severity;
    }

    /**
     * 반영을 막는 코드인지 판정합니다.
     *
     * @return BLOCKER이면 true
     */
    public boolean blocks() {
        return severity == MigrationDto.Severity.BLOCKER;
    }
}
```

- [ ] **Step 2: 계약 DTO 작성**

```java
package com.kdb.it.domain.migration.request.dto;

import com.kdb.it.domain.migration.dto.MigrationDto;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;

/** 부점 편성요청서 반입 요청·응답 계약입니다. */
public final class RequestFormDto {

    private RequestFormDto() {
        throw new UnsupportedOperationException("계약 컨테이너 — 인스턴스화 금지");
    }

    /** 파일 1건의 반영 결과 상태입니다. */
    @Schema(name = "RequestFormFileStatus", description = "파일 반영 상태")
    public enum FileStatus {
        /** 원장에 반영됨 */
        APPLIED,
        /** BLOCKER 진단이 남아 반영하지 않음 */
        BLOCKED,
        /** 예상하지 못한 오류로 실패 (해당 파일만 롤백) */
        FAILED
    }

    /**
     * 업로드한 파일 1건의 부가 정보입니다.
     *
     * @param fileKey 브라우저 `webkitRelativePath`. 파일 파트와 결과를 잇는 키
     * @param deptName 최상위 폴더명에서 뽑은 부서명
     * @param deptCodeOverride 미리보기에서 사용자가 고른 부서코드. 없으면 null
     * @param generalExpenseMultiplier 시트 ③ 금액 배수(1·1000·1000000). 없으면 서버가 제안값을 씁니다
     * @param bgUntAbusC 시트 ③ 사업코드. 양식에 없어 사용자가 지정합니다. 없으면 null
     */
    @Schema(name = "RequestFormFileEntry", description = "업로드 파일 부가 정보")
    public record FileEntry(
            @Schema(description = "파일 상대경로", requiredMode = Schema.RequiredMode.REQUIRED)
                    @NotBlank
                    String fileKey,
            @Schema(description = "폴더에서 뽑은 부서명", requiredMode = Schema.RequiredMode.REQUIRED)
                    @NotBlank
                    String deptName,
            @Schema(
                            description = "사용자가 고른 부서코드",
                            requiredMode = Schema.RequiredMode.REQUIRED,
                            nullable = true)
                    String deptCodeOverride,
            @Schema(
                            description = "시트 ③ 금액 배수",
                            allowableValues = {"1", "1000", "1000000"},
                            requiredMode = Schema.RequiredMode.REQUIRED,
                            nullable = true)
                    Long generalExpenseMultiplier,
            @Schema(
                            description = "시트 ③ 사업코드",
                            requiredMode = Schema.RequiredMode.REQUIRED,
                            nullable = true)
                    String bgUntAbusC) {}

    /**
     * 미리보기에서 사용자가 고친 셀 값입니다.
     *
     * @param fileKey 대상 파일
     * @param sheet 대상 시트. 파일 전체에 걸린 보정은 null
     * @param excelRow 엑셀 사용자 관점 행 번호(1-based). 행에 매이지 않는 보정은 null
     * @param field 보정 대상 필드 id (`ioeC`, `svnDpmC`, `abusNm` 등)
     * @param value 사용자가 고른 값
     */
    @Schema(name = "RequestFormCellOverride", description = "미리보기 보정값")
    public record CellOverride(
            @Schema(description = "파일 상대경로", requiredMode = Schema.RequiredMode.REQUIRED)
                    @NotBlank
                    String fileKey,
            @Schema(
                            description = "시트 종류",
                            requiredMode = Schema.RequiredMode.REQUIRED,
                            nullable = true)
                    FormSheetKind sheet,
            @Schema(
                            description = "엑셀 행 번호",
                            requiredMode = Schema.RequiredMode.REQUIRED,
                            nullable = true)
                    Integer excelRow,
            @Schema(description = "필드 id", requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank
                    String field,
            @Schema(description = "보정값", requiredMode = Schema.RequiredMode.REQUIRED) @NotNull
                    String value) {}

    /**
     * 배치 1회의 메타데이터입니다. multipart의 `manifest` 파트로 보냅니다.
     *
     * @param bseYy 예산연도 4자리. 화면에서 사용자가 고른 값
     * @param entries 파일별 부가 정보
     * @param overrides 보정값. 최초 dry-run은 빈 목록
     */
    @Schema(name = "RequestFormImportManifest", description = "반입 배치 메타데이터")
    public record ImportManifest(
            @Schema(description = "예산연도", example = "2026", requiredMode = Schema.RequiredMode.REQUIRED)
                    @NotNull(message = "예산연도는 필수입니다.")
                    @Pattern(regexp = "\\d{4}", message = "예산연도는 4자리 숫자입니다.")
                    String bseYy,
            @Schema(description = "파일별 부가 정보", requiredMode = Schema.RequiredMode.REQUIRED)
                    @NotEmpty
                    @Valid
                    List<FileEntry> entries,
            @Schema(description = "보정값 목록", requiredMode = Schema.RequiredMode.REQUIRED)
                    @NotNull
                    @Valid
                    List<CellOverride> overrides) {}

    /**
     * 진단 1건입니다.
     *
     * @param sheet 대상 시트. 파일 단위 진단은 null
     * @param excelRow 엑셀 행 번호(1-based). 행에 매이지 않으면 null
     * @param field 대상 필드 id. 필드에 매이지 않으면 null
     * @param code 진단 코드
     * @param severity 심각도. `code.severity()`와 항상 같습니다
     * @param message 사용자 문구
     * @param candidates 보정 후보. 없으면 빈 목록
     */
    @Schema(name = "RequestFormDiagnostic", description = "편성요청서 반입 진단")
    public record FormDiagnostic(
            @Schema(
                            description = "시트 종류",
                            requiredMode = Schema.RequiredMode.REQUIRED,
                            nullable = true)
                    FormSheetKind sheet,
            @Schema(
                            description = "엑셀 행 번호",
                            requiredMode = Schema.RequiredMode.REQUIRED,
                            nullable = true)
                    Integer excelRow,
            @Schema(
                            description = "필드 id",
                            requiredMode = Schema.RequiredMode.REQUIRED,
                            nullable = true)
                    String field,
            @Schema(description = "진단 코드", requiredMode = Schema.RequiredMode.REQUIRED)
                    RequestFormDiagnosticCode code,
            @Schema(description = "심각도", requiredMode = Schema.RequiredMode.REQUIRED)
                    MigrationDto.Severity severity,
            @Schema(description = "사용자 문구", requiredMode = Schema.RequiredMode.REQUIRED)
                    String message,
            @Schema(description = "보정 후보", requiredMode = Schema.RequiredMode.REQUIRED)
                    List<MigrationDto.Candidate> candidates) {

        /**
         * 코드의 심각도를 따라 진단을 만듭니다.
         *
         * @param sheet 대상 시트 (null 허용)
         * @param excelRow 엑셀 행 번호 (null 허용)
         * @param field 필드 id (null 허용)
         * @param code 진단 코드
         * @param message 사용자 문구
         * @param candidates 보정 후보. null이면 빈 목록으로 접습니다
         * @return 진단
         */
        public static FormDiagnostic of(
                FormSheetKind sheet,
                Integer excelRow,
                String field,
                RequestFormDiagnosticCode code,
                String message,
                List<MigrationDto.Candidate> candidates) {
            return new FormDiagnostic(
                    sheet,
                    excelRow,
                    field,
                    code,
                    code.severity(),
                    message,
                    candidates == null ? List.of() : List.copyOf(candidates));
        }
    }

    /**
     * 생성된 원장 1건입니다.
     *
     * @param table 원천테이블명 (`BPROJM`·`BITEMM`·`BCOSTM`)
     * @param key 생성된 관리번호
     * @param label 화면 표시명 (사업명·계약명)
     */
    @Schema(name = "RequestFormCreatedRecord", description = "생성된 원장")
    public record CreatedRecord(
            @Schema(description = "원천테이블명", requiredMode = Schema.RequiredMode.REQUIRED) String table,
            @Schema(description = "관리번호", requiredMode = Schema.RequiredMode.REQUIRED) String key,
            @Schema(description = "표시명", requiredMode = Schema.RequiredMode.REQUIRED) String label) {}

    /**
     * 파일 1건의 처리 결과입니다.
     *
     * @param fileKey 파일 상대경로
     * @param deptName 부서명
     * @param status 반영 상태
     * @param diagnostics 진단 목록. 없으면 빈 목록
     * @param created 생성된 원장. dry-run이거나 반영하지 않았으면 빈 목록
     * @param suggestedGeneralExpenseMultiplier 시트 ③ 단위 제안값. 시트 ③이 없으면 null
     */
    @Schema(name = "RequestFormFileResult", description = "파일 처리 결과")
    public record FileResult(
            @Schema(description = "파일 상대경로", requiredMode = Schema.RequiredMode.REQUIRED) String fileKey,
            @Schema(description = "부서명", requiredMode = Schema.RequiredMode.REQUIRED) String deptName,
            @Schema(description = "반영 상태", requiredMode = Schema.RequiredMode.REQUIRED) FileStatus status,
            @Schema(description = "진단 목록", requiredMode = Schema.RequiredMode.REQUIRED)
                    List<FormDiagnostic> diagnostics,
            @Schema(description = "생성된 원장", requiredMode = Schema.RequiredMode.REQUIRED)
                    List<CreatedRecord> created,
            @Schema(
                            description = "시트 ③ 단위 제안값",
                            allowableValues = {"1", "1000", "1000000"},
                            requiredMode = Schema.RequiredMode.REQUIRED,
                            nullable = true)
                    Long suggestedGeneralExpenseMultiplier) {}

    /**
     * 배치 요약입니다.
     *
     * @param totalFiles 보낸 파일 수
     * @param appliedFiles 반영된 파일 수. dry-run이면 반영 가능한 파일 수
     * @param blockedFiles BLOCKER가 남은 파일 수
     * @param createdProjects 생성된 사업 수
     * @param createdItems 생성된 품목 수
     * @param createdCosts 생성된 전산업무비 수
     */
    @Schema(name = "RequestFormImportSummary", description = "반입 배치 요약")
    public record ImportSummary(
            @Schema(description = "보낸 파일 수", requiredMode = Schema.RequiredMode.REQUIRED) int totalFiles,
            @Schema(description = "반영된 파일 수", requiredMode = Schema.RequiredMode.REQUIRED)
                    int appliedFiles,
            @Schema(description = "차단된 파일 수", requiredMode = Schema.RequiredMode.REQUIRED)
                    int blockedFiles,
            @Schema(description = "생성된 사업 수", requiredMode = Schema.RequiredMode.REQUIRED)
                    int createdProjects,
            @Schema(description = "생성된 품목 수", requiredMode = Schema.RequiredMode.REQUIRED)
                    int createdItems,
            @Schema(description = "생성된 전산업무비 수", requiredMode = Schema.RequiredMode.REQUIRED)
                    int createdCosts) {}

    /**
     * 반입 응답입니다. dry-run과 commit이 같은 형태를 씁니다.
     *
     * @param dryRun 사전검증이면 true
     * @param summary 배치 요약
     * @param files 파일별 결과
     */
    @Schema(name = "RequestFormImportResponse", description = "편성요청서 반입 응답")
    public record ImportResponse(
            @Schema(description = "사전검증 여부", requiredMode = Schema.RequiredMode.REQUIRED) boolean dryRun,
            @Schema(description = "배치 요약", requiredMode = Schema.RequiredMode.REQUIRED)
                    ImportSummary summary,
            @Schema(description = "파일별 결과", requiredMode = Schema.RequiredMode.REQUIRED)
                    List<FileResult> files) {}
}
```

- [ ] **Step 3: OpenAPI 계약 테스트 작성**

기존 `MigrationOpenApiContractTest`와 같은 방식으로 응답 DTO의 `requiredMode`·`nullable`·`allowableValues`를 고정한다. 먼저 그 파일을 읽어 이 저장소의 계약 테스트 작성 방식을 확인한다.

Run: `cd it_backend && cat src/test/java/com/kdb/it/domain/migration/MigrationOpenApiContractTest.java`

읽은 구조를 그대로 따라 `RequestFormOpenApiContractTest`를 만들고, 최소한 아래를 고정한다.

```java
package com.kdb.it.domain.migration.request.dto;

import static org.assertj.core.api.Assertions.assertThat;

import io.swagger.v3.oas.annotations.media.Schema;
import java.lang.reflect.RecordComponent;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RequestFormOpenApiContractTest {

    /** 응답 계약에 쓰이는 record 전부. 새 record를 추가하면 이 목록도 갱신한다. */
    private static final List<Class<?>> RESPONSE_RECORDS =
            List.of(
                    RequestFormDto.FormDiagnostic.class,
                    RequestFormDto.CreatedRecord.class,
                    RequestFormDto.FileResult.class,
                    RequestFormDto.ImportSummary.class,
                    RequestFormDto.ImportResponse.class);

    @Test
    @DisplayName("응답 record의 모든 속성에 requiredMode=REQUIRED가 붙어 있다")
    void everyResponsePropertyIsRequired() {
        for (Class<?> type : RESPONSE_RECORDS) {
            for (RecordComponent component : type.getRecordComponents()) {
                Schema schema = component.getAnnotation(Schema.class);
                assertThat(schema)
                        .as("%s.%s 에 @Schema 가 없습니다", type.getSimpleName(), component.getName())
                        .isNotNull();
                assertThat(schema.requiredMode())
                        .as("%s.%s", type.getSimpleName(), component.getName())
                        .isEqualTo(Schema.RequiredMode.REQUIRED);
            }
        }
    }

    @Test
    @DisplayName("null이 올 수 있는 속성만 nullable=true로 표시되어 있다")
    void nullablePropertiesAreMarked() {
        assertThat(nullableNames(RequestFormDto.FormDiagnostic.class))
                .containsExactlyInAnyOrder("sheet", "excelRow", "field");
        assertThat(nullableNames(RequestFormDto.FileResult.class))
                .containsExactly("suggestedGeneralExpenseMultiplier");
        assertThat(nullableNames(RequestFormDto.ImportSummary.class)).isEmpty();
    }

    @Test
    @DisplayName("단위 배수 속성에 허용값이 명시되어 있다")
    void multiplierDeclaresAllowableValues() {
        Schema schema = componentSchema(RequestFormDto.FileResult.class, "suggestedGeneralExpenseMultiplier");

        assertThat(schema.allowableValues()).containsExactly("1", "1000", "1000000");
    }

    @Test
    @DisplayName("모든 진단 코드가 심각도를 선언한다")
    void everyDiagnosticCodeDeclaresSeverity() {
        for (RequestFormDiagnosticCode code : RequestFormDiagnosticCode.values()) {
            assertThat(code.severity()).as("%s", code).isNotNull();
        }
    }

    private static List<String> nullableNames(Class<?> type) {
        return java.util.Arrays.stream(type.getRecordComponents())
                .filter(component -> component.getAnnotation(Schema.class).nullable())
                .map(RecordComponent::getName)
                .toList();
    }

    private static Schema componentSchema(Class<?> type, String name) {
        for (RecordComponent component : type.getRecordComponents()) {
            if (component.getName().equals(name)) return component.getAnnotation(Schema.class);
        }
        throw new IllegalArgumentException("속성을 찾지 못했습니다: " + name);
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormOpenApiContractTest*"`
Expected: PASS — 4개 테스트 전부 성공.

실패하면 `@Schema` 누락 속성을 채운다. 계약을 느슨하게 바꿔 테스트를 통과시키지 않는다.

- [ ] **Step 5: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/dto src/test/java/com/kdb/it/domain/migration/request/dto
git -C it_backend commit -m "feat(migration): 편성요청서 반입 요청·응답 계약

프론트 생성 타입의 SoT이므로 응답 속성 전부에 requiredMode=REQUIRED를 붙이고
null 가능 속성만 nullable=true를, 값 집합이 정해진 단위 배수에는
allowableValues를 명시한다. 계약 테스트가 이를 고정한다.

진단 심각도는 코드 enum에 붙인다. 호출부에서 정하게 하면 같은 코드가 파일마다
다른 심각도로 나가 사용자가 기준을 잡을 수 없다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: 어댑터 계약과 시트 ③ 어댑터

어댑터 3종이 공유할 입출력 계약을 정하고, 가장 단순한 표인 시트 ③(전산 일반관리비)부터 구현한다.

**책임 분담**: 어댑터는 셀 좌표를 아는 유일한 지점이므로 **해석 실패 진단**(`CODE_*`·`ORG_*`·`USER_*`·`DATE_*`·`OPTIONAL_*`·`UNIT_UNCERTAIN`)을 직접 낸다. 조립된 명령을 놓고 보는 **횡단 진단**(`REQUIRED_MISSING`·`LENGTH_EXCEEDED`·`DUPLICATE_EXISTS`·`AMOUNT_MISMATCH`)은 Task 10의 `RequestFormValidator`가 낸다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/FormAdapterContext.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/FormAdapterOutput.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/FormSheetAdapter.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapterTest.java`

**Interfaces:**
- Consumes: `SheetAnchorScanner`, `FormLexicon`, `IoeHierarchyIndex.Snapshot`, `AmountUnitResolver` (Task 2–5), `RequestFormDto`, `RequestFormDiagnosticCode`, `FormSheetKind` (Task 1·6), `OrgIdentityResolver.Index`, `CostDto.CreateRequest`, `ProjectDto.CreateRequest`, `CodeDefaults.NOT_APPLICABLE`
- Produces:
  - `record FormAdapterContext(Map<FormSheetKind, Sheet> sheets, String bseYy, RequestFormDto.FileEntry entry, String resolvedDeptCode, String resolvedDeptName, OrgIdentityResolver.Index orgIndex, IoeHierarchyIndex.Snapshot ioeIndex, Map<String, String> overrides, String actorEno)`
    - `Optional<String> override(FormSheetKind sheet, Integer excelRow, String field)`
    - `static String overrideKey(FormSheetKind sheet, Integer excelRow, String field)`
  - `record FormAdapterOutput(List<ProjectDto.CreateRequest> projects, List<CostDto.CreateRequest> costs, List<RequestFormDto.FormDiagnostic> diagnostics, Long suggestedGeneralExpenseMultiplier)`
    - `static FormAdapterOutput empty()`
    - `FormAdapterOutput merge(FormAdapterOutput other)`
  - `interface FormSheetAdapter { FormSheetKind trigger(); FormAdapterOutput adapt(FormAdapterContext context); }`
  - `class GeneralExpenseFormAdapter implements FormSheetAdapter` (`@Component`)

- [ ] **Step 1: 어댑터 계약 3종 작성**

`FormAdapterContext.java`:

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.IoeHierarchyIndex;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.util.Map;
import java.util.Optional;
import org.apache.poi.ss.usermodel.Sheet;

/**
 * 어댑터 1회 실행에 필요한 입력을 묶습니다.
 *
 * <p>시트를 하나가 아니라 맵으로 넘깁니다 — 1-1과 1-2는 같은 사업의 머리와 몸통이라 한 어댑터가 둘을 함께 읽어야 하고, 시트마다 어댑터를 두면 사업관리번호를
 * 어댑터 사이로 넘겨야 해서 경계가 흐려집니다.
 *
 * @param sheets 이 워크북에서 인식된 시트들
 * @param bseYy 예산연도 4자리. 화면에서 사용자가 고른 값
 * @param entry 파일별 부가 정보 (부서명·단위 배수·사업코드)
 * @param resolvedDeptCode 폴더명 또는 보정값에서 확정한 부서코드. 미해석이면 null
 * @param resolvedDeptName 확정한 부서명. 미해석이면 폴더명 원문
 * @param orgIndex 조직·사용자 해석 인덱스 (배치 전체에서 공유)
 * @param ioeIndex 비목 계층 인덱스 (배치 전체에서 공유)
 * @param overrides {@link #overrideKey} 로 만든 키별 보정값
 * @param actorEno 업로드 사용자 사번
 */
public record FormAdapterContext(
        Map<FormSheetKind, Sheet> sheets,
        String bseYy,
        RequestFormDto.FileEntry entry,
        String resolvedDeptCode,
        String resolvedDeptName,
        OrgIdentityResolver.Index orgIndex,
        IoeHierarchyIndex.Snapshot ioeIndex,
        Map<String, String> overrides,
        String actorEno) {

    /**
     * 보정값을 찾습니다.
     *
     * @param sheet 대상 시트. 파일 전체 보정이면 null
     * @param excelRow 엑셀 행 번호(1-based). 행에 매이지 않으면 null
     * @param field 필드 id
     * @return 사용자가 고른 값. 없으면 빈 Optional
     */
    public Optional<String> override(FormSheetKind sheet, Integer excelRow, String field) {
        String value = overrides.get(overrideKey(sheet, excelRow, field));
        return value == null || value.isBlank() ? Optional.empty() : Optional.of(value);
    }

    /**
     * 보정값 맵의 키를 만듭니다. 서버와 프론트가 같은 규칙을 써야 보정이 붙습니다.
     *
     * @param sheet 대상 시트 (null 허용)
     * @param excelRow 엑셀 행 번호 (null 허용)
     * @param field 필드 id
     * @return `시트|행|필드` 형태의 키
     */
    public static String overrideKey(FormSheetKind sheet, Integer excelRow, String field) {
        return (sheet == null ? "" : sheet.name())
                + "|"
                + (excelRow == null ? "" : excelRow)
                + "|"
                + field;
    }
}
```

`FormAdapterOutput.java`:

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import java.util.ArrayList;
import java.util.List;

/**
 * 어댑터 1회 실행의 산출물입니다.
 *
 * <p>원장을 직접 만들지 않고 **기존 서비스에 넘길 생성 요청**만 조립합니다. 새 INSERT 경로를 만들면 채번·조직명 스냅샷·감사로그를 전부 다시 구현해야
 * 합니다.
 *
 * @param projects 생성할 사업 요청 (품목 포함)
 * @param costs 생성할 전산업무비 요청
 * @param diagnostics 어댑터가 낸 해석 진단
 * @param suggestedGeneralExpenseMultiplier 시트 ③ 단위 제안값. 시트 ③이 없으면 null
 */
public record FormAdapterOutput(
        List<ProjectDto.CreateRequest> projects,
        List<CostDto.CreateRequest> costs,
        List<RequestFormDto.FormDiagnostic> diagnostics,
        Long suggestedGeneralExpenseMultiplier) {

    /** 산출물이 없는 결과를 만듭니다. */
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
        return new FormAdapterOutput(
                List.copyOf(mergedProjects),
                List.copyOf(mergedCosts),
                List.copyOf(mergedDiagnostics),
                suggestedGeneralExpenseMultiplier != null
                        ? suggestedGeneralExpenseMultiplier
                        : other.suggestedGeneralExpenseMultiplier());
    }
}
```

`FormSheetAdapter.java`:

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.domain.migration.request.dto.FormSheetKind;

/** 편성요청서 시트를 도메인 생성 요청으로 바꿉니다. */
public interface FormSheetAdapter {

    /**
     * 이 어댑터를 발동시키는 시트입니다. 워크북에 이 시트가 있으면 실행됩니다.
     *
     * @return 발동 시트 종류
     */
    FormSheetKind trigger();

    /**
     * 시트를 읽어 생성 요청과 진단을 만듭니다.
     *
     * @param context 시트·연도·해석 인덱스·보정값 묶음
     * @return 생성 요청과 진단. 읽을 데이터가 없으면 {@link FormAdapterOutput#empty()}
     */
    FormAdapterOutput adapt(FormAdapterContext context);
}
```

- [ ] **Step 2: 시트 ③ 어댑터의 실패 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/GeneralExpenseFormAdapterTest.java`:

```java
package com.kdb.it.domain.migration.request.service.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.AmountUnitResolver;
import com.kdb.it.domain.migration.request.service.IoeHierarchyIndex;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import com.kdb.it.domain.migration.request.service.WorkbookReader;
import com.kdb.it.domain.migration.request.support.RequestFormFixtures;
import com.kdb.it.domain.migration.request.support.TestIoeIndex;
import java.math.BigDecimal;
import java.util.Map;
import org.apache.poi.ss.usermodel.Sheet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GeneralExpenseFormAdapterTest {

    private final WorkbookReader reader = new WorkbookReader(10_485_760L, 20, 5000, 0.01d);
    private final GeneralExpenseFormAdapter adapter =
            new GeneralExpenseFormAdapter(new SheetAnchorScanner());

    private FormAdapterContext contextOf(byte[] workbookBytes, Long multiplier) {
        Map<FormSheetKind, Sheet> sheets = reader.classify(reader.open(workbookBytes, "픽스처.xls"));
        RequestFormDto.FileEntry entry =
                new RequestFormDto.FileEntry("자금운용실/요청서.xls", "자금운용실", null, multiplier, "571");
        return new FormAdapterContext(
                sheets,
                "2026",
                entry,
                "0210",
                "자금운용실",
                null,
                TestIoeIndex.snapshot(),
                Map.of(),
                "12345678");
    }

    @Test
    @DisplayName("비목명과 세부비목 쌍으로 비목코드를 확정해 전산업무비를 만든다")
    void buildsCostFromDetailPair() {
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), 1L));

        assertThat(output.costs()).hasSize(2);
        CostDto.CreateRequest first = output.costs().get(0);
        assertThat(first.getIoeC()).isEqualTo("010");
        assertThat(first.getCttNm()).isEqualTo("블룸버그 회선사용료");
        assertThat(first.getCttOppNm()).isEqualTo("Bloomberg");
        assertThat(first.getCurC()).isEqualTo("KRW");
        assertThat(first.getCostTotXpAmt()).isEqualByComparingTo(new BigDecimal("841854085"));
        assertThat(first.getFcAmt()).isNull();
        assertThat(first.getBseYy()).isEqualTo("2026");
        assertThat(first.getCostSvnDpmC()).isEqualTo("0210");
        assertThat(first.getBgUntAbusC()).isEqualTo("571");
        assertThat(first.getCgprId()).isEqualTo("12345678");
        assertThat(first.getXcrBseDt()).isEqualTo("20260101");
        assertThat(first.getTmnYn()).isEqualTo("N");
    }

    @Test
    @DisplayName("A·B열 병합으로 빈 행은 위 값을 이어받는다")
    void forwardFillsMergedCategoryColumns() {
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.englishFormXls(), 1L));

        // 두 번째 행은 A·B열이 비어 있고 첫 행의 `IT Expenses / Foreign branch line usage fees`를 이어받는다
        assertThat(output.costs()).hasSize(2);
        assertThat(output.costs().get(1).getIoeC()).isEqualTo("013");
        assertThat(output.costs().get(1).getCttNm()).isEqualTo("AML Screening");
    }

    @Test
    @DisplayName("계속·신규 표시를 사업구분코드로 바꾼다")
    void mapsContinuedAndNew() {
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), 1L));

        assertThat(output.costs().get(0).getAbusTc()).isEqualTo("20");
        assertThat(output.costs().get(1).getAbusTc()).isEqualTo("10");
    }

    @Test
    @DisplayName("월간 값이 있으면 지급주기를 월로, 없으면 년으로 정한다")
    void derivesPaymentCycleFromMonthlyColumn() {
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), 1L));

        assertThat(output.costs().get(0).getDfrCleC()).isEqualTo("M");
        assertThat(output.costs().get(1).getDfrCleC()).isEqualTo("Y");
    }

    @Test
    @DisplayName("외화 행은 FC_AMT만 채우고 원화금액은 서버 재계산에 맡긴다")
    void leavesForeignKrwAmountToServer() {
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.englishFormXls(), 1L));

        CostDto.CreateRequest gbpRow = output.costs().get(0);
        assertThat(gbpRow.getCurC()).isEqualTo("GBP");
        assertThat(gbpRow.getFcAmt()).isEqualByComparingTo(new BigDecimal("5177.28"));
        assertThat(gbpRow.getCostTotXpAmt()).isNull();
        assertThat(gbpRow.getXcr()).isNull();
    }

    @Test
    @DisplayName("지정 배수를 원화 행에만 적용한다")
    void appliesMultiplierToKrwRowsOnly() {
        FormAdapterOutput thousand =
                adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), AmountUnitResolver.UNIT_THOUSAND));

        assertThat(thousand.costs().get(0).getCostTotXpAmt())
                .isEqualByComparingTo(new BigDecimal("841854085000"));
    }

    @Test
    @DisplayName("배수를 지정하지 않으면 제안값을 내고 확인 경고를 남긴다")
    void suggestsMultiplierWhenAbsent() {
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), null));

        assertThat(output.suggestedGeneralExpenseMultiplier()).isEqualTo(AmountUnitResolver.UNIT_WON);
        assertThat(output.diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(RequestFormDiagnosticCode.UNIT_UNCERTAIN);
    }

    @Test
    @DisplayName("정보보호 표기의 로마숫자 X를 N으로 접는다")
    void normalizesRomanNumeralX() {
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.englishFormXls(), 1L));

        assertThat(output.costs().get(0).getSectSysUtzYn()).isEqualTo("N");
    }

    @Test
    @DisplayName("보정값이 있으면 자동 해석보다 우선한다")
    void overrideWinsOverResolution() {
        Map<FormSheetKind, Sheet> sheets =
                reader.classify(reader.open(RequestFormFixtures.fullFormXls(), "픽스처.xls"));
        Map<String, String> overrides =
                Map.of(FormAdapterContext.overrideKey(FormSheetKind.GENERAL_EXPENSE, 6, "ioeC"), "011");
        FormAdapterContext context =
                new FormAdapterContext(
                        sheets,
                        "2026",
                        new RequestFormDto.FileEntry("자금운용실/요청서.xls", "자금운용실", null, 1L, "571"),
                        "0210",
                        "자금운용실",
                        null,
                        TestIoeIndex.snapshot(),
                        overrides,
                        "12345678");

        FormAdapterOutput output = adapter.adapt(context);

        assertThat(output.costs().get(0).getIoeC()).isEqualTo("011");
    }

    @Test
    @DisplayName("시트 ③이 없으면 빈 결과를 돌려준다")
    void returnsEmptyWhenSheetAbsent() {
        Map<FormSheetKind, Sheet> sheets =
                reader.classify(reader.open(RequestFormFixtures.capitalOnlyXlsx(), "자료1.xlsx"));
        FormAdapterContext context =
                new FormAdapterContext(
                        sheets,
                        "2026",
                        new RequestFormDto.FileEntry("a/b.xlsx", "IT기획부", null, 1L, null),
                        "0100",
                        "IT기획부",
                        null,
                        TestIoeIndex.snapshot(),
                        Map.of(),
                        "12345678");

        assertThat(adapter.adapt(context).costs()).isEmpty();
    }
}
```

- [ ] **Step 3: 테스트용 비목 인덱스 헬퍼 작성**

Task 4 테스트의 코드 목록을 어댑터 테스트 3종이 함께 쓰므로 헬퍼로 뺀다.

`it_backend/src/test/java/com/kdb/it/domain/migration/request/support/TestIoeIndex.java`:

```java
package com.kdb.it.domain.migration.request.support;

import com.kdb.it.common.code.CommonCodeGroups;
import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CodeRepository;
import com.kdb.it.domain.migration.request.service.IoeHierarchyIndex;
import java.util.List;
import org.mockito.Mockito;

/** 로컬 Oracle 실측 비목 코드로 만든 테스트용 계층 인덱스입니다. */
public final class TestIoeIndex {

    private TestIoeIndex() {}

    /**
     * 실측 21건을 담은 인덱스를 만듭니다.
     *
     * @return 계층 인덱스 스냅샷
     */
    public static IoeHierarchyIndex.Snapshot snapshot() {
        CodeRepository repository = Mockito.mock(CodeRepository.class);
        Mockito.when(repository.findByCIdAndDelYn(CommonCodeGroups.IOE, "N")).thenReturn(codes());
        return new IoeHierarchyIndex(repository).snapshot();
    }

    private static List<Ccodem> codes() {
        return List.of(
                code("001", "국내전산임차료", "일반관리비 - 전산임차료 - 국내전산임차료"),
                code("002", "국외전산임차료", "일반관리비 - 전산임차료 - 국외전산임차료"),
                code("003", "국내출장", "일반관리비 - 전산여비 - 국내출장"),
                code("004", "국외출장", "일반관리비 - 전산여비 - 국외출장"),
                code("005", "국외점포전산여비", "일반관리비 - 전산여비 - 국외점포전산여비"),
                code("006", "원고강사심사료", "일반관리비 - 전산용역비 - 원고강사심사료"),
                code("007", "국외전산용역비", "일반관리비 - 전산용역비 - 국외전산용역비"),
                code("008", "외주용역(외주운영/관제 등)", "일반관리비 - 전산용역비 - 외주용역 - 외주운영/관제 등"),
                code("009", "외주용역(자문/심사)", "일반관리비 - 전산용역비 - 외주용역 - 자문/심사"),
                code("010", "회선사용료", "일반관리비 - 전산제비 - 회선사용료"),
                code("011", "유지보수료", "일반관리비 - 전산제비 - 유지보수료"),
                code("012", "전산소모품비", "일반관리비 - 전산제비 - 전산소모품비"),
                code("013", "국외회선사용료", "일반관리비 - 전산제비 - 국외회선사용료"),
                code("014", "국외유지보수료", "일반관리비 - 전산제비 - 국외유지보수료"),
                code("015", "국외전산소모품비", "일반관리비 - 전산제비 - 국외전산소모품비"),
                code("101", "국내기계장치", "자본예산 - 기계장치 - 국내"),
                code("102", "국외기계장치", "자본예산 - 기계장치 - 국외"),
                code("103", "개발비(일반)", "자본예산 - 개발비 - 일반"),
                code("104", "개발비(감리/컨설팅)", "자본예산 - 개발비 - 감리/컨설팅"),
                code("105", "국외기타무형자산", "자본예산 - 기타무형자산 - 국외"),
                code("106", "국내기타무형자산(일반)", "자본예산 - 기타무형자산 - 국내 - 일반"),
                code("107", "국내기타무형자산(SW라이선스)", "자본예산 - 기타무형자산 - 국내 - SW라이선스"));
    }

    private static Ccodem code(String cdva, String name, String sps) {
        Ccodem entity = new Ccodem();
        entity.setCdva(cdva);
        entity.setCdvaNm(name);
        entity.setCdvaDtl(sps);
        return entity;
    }
}
```

Task 4의 `IoeHierarchyIndexTest`도 이 헬퍼를 쓰도록 고쳐 목록 중복을 없앤다.

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*GeneralExpenseFormAdapterTest*"`
Expected: FAIL — `GeneralExpenseFormAdapter` 클래스 없음.

- [ ] **Step 5: `GeneralExpenseFormAdapter` 작성**

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.common.code.CodeDefaults;
import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.AmountUnitResolver;
import com.kdb.it.domain.migration.request.service.FormLexicon;
import com.kdb.it.domain.migration.request.service.IoeHierarchyIndex;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Sheet;
import org.springframework.stereotype.Component;

/**
 * 시트 ③ `전산 일반관리비 편성요청서`를 전산업무비 생성 요청으로 바꿉니다.
 *
 * <p>A열(비목명)·B열(세부비목)은 병합이라 빈 행이 위 값을 이어받습니다(forward-fill). 비목은 두 값을 쌍으로 묶어 {@code CO_CDVA_SPS}
 * 계층과 맞춥니다.
 *
 * <p>금액 단위는 자동 판정이 불가능합니다 — 헤더는 `천원`인데 원 단위로 적어 내는 부점이 있고 대사할 상대 시트가 없습니다. 배수가 지정되지 않으면 제안값을
 * 계산해 돌려주고 `UNIT_UNCERTAIN` 경고를 남깁니다.
 */
@Component
@RequiredArgsConstructor
public class GeneralExpenseFormAdapter implements FormSheetAdapter {

    /** 계약명 최대 길이 (물리 컬럼 `CTT_NM`). */
    private static final int CONTRACT_NAME_LIMIT = 100;

    /** 지급주기: 월. 월간 금액이 적혀 있으면 월납으로 봅니다. */
    private static final String CYCLE_MONTHLY = "M";

    /** 지급주기: 년. 월간이 비어 있으면 연납으로 봅니다. */
    private static final String CYCLE_YEARLY = "Y";

    private final SheetAnchorScanner scanner;

    @Override
    public FormSheetKind trigger() {
        return FormSheetKind.GENERAL_EXPENSE;
    }

    @Override
    public FormAdapterOutput adapt(FormAdapterContext context) {
        Sheet sheet = context.sheets().get(FormSheetKind.GENERAL_EXPENSE);
        if (sheet == null) return FormAdapterOutput.empty();

        Optional<SheetAnchorScanner.HeaderMap> header =
                scanner.findHeader(sheet, 0, columnAliases(), "expense", "contractName", "currency", "annual");
        if (header.isEmpty()) {
            return new FormAdapterOutput(
                    List.of(),
                    List.of(),
                    List.of(
                            RequestFormDto.FormDiagnostic.of(
                                    FormSheetKind.GENERAL_EXPENSE,
                                    null,
                                    null,
                                    RequestFormDiagnosticCode.ANCHOR_NOT_FOUND,
                                    "전산 일반관리비 시트에서 표 헤더를 찾지 못했습니다. 양식이 변형되었는지 확인해 주세요.",
                                    List.of())),
                    null);
        }

        RowReader rows = new RowReader(sheet, header.get(), scanner);
        List<RawRow> rawRows = rows.readAll();

        long multiplier =
                context.entry().generalExpenseMultiplier() != null
                        ? context.entry().generalExpenseMultiplier()
                        : AmountUnitResolver.suggestGeneralExpenseMultiplier(krwAnnualAmounts(rawRows));

        List<CostDto.CreateRequest> costs = new ArrayList<>();
        List<RequestFormDto.FormDiagnostic> diagnostics = new ArrayList<>();
        if (context.entry().generalExpenseMultiplier() == null) {
            diagnostics.add(
                    RequestFormDto.FormDiagnostic.of(
                            FormSheetKind.GENERAL_EXPENSE,
                            null,
                            "generalExpenseMultiplier",
                            RequestFormDiagnosticCode.UNIT_UNCERTAIN,
                            "금액 단위를 %s 단위로 추정했습니다. 확인해 주세요.".formatted(unitLabel(multiplier)),
                            List.of()));
        }

        for (RawRow row : rawRows) {
            costs.add(toCreateRequest(row, context, multiplier, diagnostics));
        }
        return new FormAdapterOutput(List.of(), List.copyOf(costs), List.copyOf(diagnostics), multiplier);
    }

    private CostDto.CreateRequest toCreateRequest(
            RawRow row,
            FormAdapterContext context,
            long multiplier,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        CostDto.CreateRequest request = new CostDto.CreateRequest();
        request.setBseYy(context.bseYy());
        request.setCttNm(truncateWithDiagnostic(row, "cttNm", row.contractName(), CONTRACT_NAME_LIMIT, diagnostics));
        request.setCttOppNm(row.counterparty());
        request.setIndRsn(row.remarks());
        request.setCgprId(context.actorEno());
        request.setCostSvnDpmC(context.resolvedDeptCode());
        request.setBgUntAbusC(context.entry().bgUntAbusC());
        request.setTmnYn("N");
        request.setXcrBseDt(context.bseYy() + "0101");
        request.setDfrCleC(row.monthly() != null ? CYCLE_MONTHLY : CYCLE_YEARLY);

        applyIoe(row, context, request, diagnostics);
        applyCurrencyAndAmount(row, request, multiplier, diagnostics);
        applyFlags(row, request, diagnostics);
        return request;
    }

    private void applyIoe(
            RawRow row,
            FormAdapterContext context,
            CostDto.CreateRequest request,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        Optional<String> override =
                context.override(FormSheetKind.GENERAL_EXPENSE, row.excelRow(), "ioeC");
        if (override.isPresent()) {
            if (context.ioeIndex().exists(override.get())) {
                request.setIoeC(override.get());
                return;
            }
            diagnostics.add(
                    diagnostic(row, "ioeC", RequestFormDiagnosticCode.CODE_UNRESOLVED,
                            "보정한 비목코드 `%s`가 존재하지 않습니다.".formatted(override.get()), List.of()));
            return;
        }

        IoeHierarchyIndex.Resolution resolution =
                context.ioeIndex().resolveByDetail(row.midCategory(), row.detailName());
        if (resolution.code() != null) {
            request.setIoeC(resolution.code());
            return;
        }
        RequestFormDiagnosticCode code =
                resolution.isAmbiguous()
                        ? RequestFormDiagnosticCode.CODE_AMBIGUOUS
                        : RequestFormDiagnosticCode.CODE_UNRESOLVED;
        String message =
                resolution.isAmbiguous()
                        ? "비목 `%s`에 해당하는 코드가 여럿입니다. 하나를 골라 주세요.".formatted(row.detailName())
                        : "비목 `%s`를 찾지 못했습니다. 기존 비목 중에서 골라 주세요.".formatted(row.detailName());
        diagnostics.add(diagnostic(row, "ioeC", code, message, resolution.candidates()));
    }

    private void applyCurrencyAndAmount(
            RawRow row,
            CostDto.CreateRequest request,
            long multiplier,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        String currency = row.currency();
        request.setCurC(currency);
        if (row.annual() == null) {
            diagnostics.add(
                    diagnostic(row, "amt", RequestFormDiagnosticCode.REQUIRED_MISSING,
                            "연간 소요예산이 비어 있습니다.", List.of()));
            return;
        }
        if ("KRW".equalsIgnoreCase(currency)) {
            request.setCostTotXpAmt(AmountUnitResolver.applyMultiplier(row.annual(), multiplier));
            request.setFcAmt(null);
            return;
        }
        // 외화는 통화 기본 단위 그대로. JPY만 양식이 천엔이라 엔으로 편다.
        long foreignMultiplier = "JPY".equalsIgnoreCase(currency) ? 1_000L : 1L;
        request.setFcAmt(AmountUnitResolver.applyMultiplier(row.annual(), foreignMultiplier));
        // 원화금액과 환율은 서버가 Ccodem 환율로 재계산한다. 여기서 채우면 그 값이 버려진다.
        request.setCostTotXpAmt(null);
        request.setXcr(null);
    }

    private void applyFlags(
            RawRow row,
            CostDto.CreateRequest request,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        Optional<String> infoSec = FormLexicon.toYn(row.infoSec());
        if (infoSec.isPresent()) {
            request.setSectSysUtzYn(infoSec.get());
        } else {
            diagnostics.add(
                    diagnostic(row, "sectSysUtzYn", RequestFormDiagnosticCode.CODE_UNRESOLVED,
                            "정보보호 여부 표기 `%s`를 해석하지 못했습니다.".formatted(row.infoSec()), List.of()));
        }
        request.setAbusTc(
                FormLexicon.toAbusTc(row.continued(), row.isNew()).orElse(CodeDefaults.NOT_APPLICABLE));
    }

    private String truncateWithDiagnostic(
            RawRow row,
            String field,
            String value,
            int limit,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (value == null || value.length() <= limit) return value;
        diagnostics.add(
                diagnostic(row, field, RequestFormDiagnosticCode.LENGTH_EXCEEDED,
                        "`%s` 값이 %d자를 넘습니다(%d자).".formatted(field, limit, value.length()), List.of()));
        return value;
    }

    private RequestFormDto.FormDiagnostic diagnostic(
            RawRow row,
            String field,
            RequestFormDiagnosticCode code,
            String message,
            List<com.kdb.it.domain.migration.dto.MigrationDto.Candidate> candidates) {
        return RequestFormDto.FormDiagnostic.of(
                FormSheetKind.GENERAL_EXPENSE, row.excelRow(), field, code, message, candidates);
    }

    private static List<BigDecimal> krwAnnualAmounts(List<RawRow> rows) {
        List<BigDecimal> amounts = new ArrayList<>();
        for (RawRow row : rows) {
            if ("KRW".equalsIgnoreCase(row.currency()) && row.annual() != null) amounts.add(row.annual());
        }
        return amounts;
    }

    private static String unitLabel(long multiplier) {
        if (multiplier == AmountUnitResolver.UNIT_MILLION) return "백만원";
        if (multiplier == AmountUnitResolver.UNIT_THOUSAND) return "천원";
        return "원";
    }

    private static Map<String, List<String>> columnAliases() {
        return FormLexicon.columnAliases(
                Map.of(
                        "expense", "비 목 명",
                        "contractName", "계약명 / 건명",
                        "currency", "통화 구분",
                        "monthly", "월간",
                        "annual", "연간",
                        "counterparty", "상대처",
                        "continued", "계속",
                        "isNew", "신규",
                        "infoSec", "정보보호 관련여부",
                        "remarks", "비고(증감사유, 적용환율 등)"));
    }
}
```

- [ ] **Step 6: `RowReader`와 `RawRow` 작성**

같은 패키지에 둔다. 표를 읽어 forward-fill까지 끝낸 원시 행을 만든다.

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.apache.poi.ss.usermodel.Sheet;

/**
 * 시트 ③의 데이터 행 하나입니다.
 *
 * @param excelRow 엑셀 사용자 관점 행 번호(1-based). 진단 좌표로 씁니다
 * @param midCategory A열 비목명 (forward-fill 적용 후)
 * @param detailName B열 세부비목 (forward-fill 적용 후)
 * @param contractName C열 계약명 / 건명
 * @param currency D열 통화 구분
 * @param monthly E열 월간. 비어 있으면 null
 * @param annual F열 연간. 비어 있으면 null
 * @param counterparty G열 상대처
 * @param continued H열 계속 표시 원문
 * @param isNew I열 신규 표시 원문
 * @param infoSec J열 정보보호 관련여부 원문
 * @param remarks K열 비고
 */
record RawRow(
        int excelRow,
        String midCategory,
        String detailName,
        String contractName,
        String currency,
        BigDecimal monthly,
        BigDecimal annual,
        String counterparty,
        String continued,
        String isNew,
        String infoSec,
        String remarks) {}

/**
 * 시트 ③의 표를 읽습니다.
 *
 * <p>A·B열은 병합이라 빈 행이 위 값을 이어받습니다. 계약명과 연간 금액이 모두 빈 행은 서식만 남은 잔재로 보아 버립니다 — 실측 시트가 6만 5천 행까지
 * 서식을 달고 있었습니다.
 */
final class RowReader {

    private final Sheet sheet;
    private final SheetAnchorScanner.HeaderMap header;
    private final SheetAnchorScanner scanner;

    RowReader(Sheet sheet, SheetAnchorScanner.HeaderMap header, SheetAnchorScanner scanner) {
        this.sheet = sheet;
        this.header = header;
        this.scanner = scanner;
    }

    /**
     * 데이터 행을 전부 읽습니다.
     *
     * @return forward-fill을 마친 원시 행 목록. 데이터가 없으면 빈 목록
     */
    List<RawRow> readAll() {
        int expenseCol = header.column("expense");
        int detailCol = expenseCol + 1;
        int firstDataRow = header.rowIndex() + (hasSubHeaderRow() ? 2 : 1);

        List<RawRow> rows = new ArrayList<>();
        String lastMid = "";
        String lastDetail = "";
        for (int rowIndex = firstDataRow; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
            String contractName = cell(rowIndex, "contractName");
            BigDecimal annual = number(rowIndex, "annual");
            if (contractName.isEmpty() && annual == null) continue;

            String mid = scanner.text(sheet, rowIndex, expenseCol);
            String detail = scanner.text(sheet, rowIndex, detailCol);
            if (!mid.isEmpty()) lastMid = mid;
            if (!detail.isEmpty()) lastDetail = detail;

            rows.add(
                    new RawRow(
                            rowIndex + 1,
                            lastMid,
                            lastDetail,
                            contractName,
                            cell(rowIndex, "currency"),
                            number(rowIndex, "monthly"),
                            annual,
                            cell(rowIndex, "counterparty"),
                            cell(rowIndex, "continued"),
                            cell(rowIndex, "isNew"),
                            cell(rowIndex, "infoSec"),
                            cell(rowIndex, "remarks")));
        }
        return rows;
    }

    /** 헤더 다음 행이 `월간`·`연간` 같은 하위 라벨 행인지 판정합니다. */
    private boolean hasSubHeaderRow() {
        Integer annualCol = header.column("annual");
        if (annualCol == null) return false;
        String below = SheetAnchorScanner.normalize(scanner.text(sheet, header.rowIndex() + 1, annualCol));
        return below.equals("연간") || below.equalsIgnoreCase("Annual");
    }

    private String cell(int rowIndex, String columnId) {
        Integer col = header.column(columnId);
        return col == null ? "" : scanner.text(sheet, rowIndex, col);
    }

    private BigDecimal number(int rowIndex, String columnId) {
        String raw = cell(rowIndex, columnId).replace(",", "").trim();
        if (raw.isEmpty()) return null;
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*GeneralExpenseFormAdapterTest*"`
Expected: PASS — 10개 테스트 전부 성공.

`buildsCostFromDetailPair`가 실패하면 `RowReader.hasSubHeaderRow()`가 데이터 시작 행을 한 칸 어긋나게 잡았는지 먼저 확인한다.

- [ ] **Step 8: 포맷 검사와 커밋**

Run: `cd it_backend && ./gradlew spotlessApply spotlessCheck test --tests "*request*"`
Expected: BUILD SUCCESSFUL.

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/adapter src/test/java/com/kdb/it/domain/migration/request
git -C it_backend commit -m "feat(migration): 어댑터 계약과 전산 일반관리비 시트 어댑터

어댑터는 시트를 하나가 아니라 맵으로 받는다. 1-1과 1-2는 같은 사업의 머리와
몸통이라 한 어댑터가 둘을 함께 읽어야 한다.

원장을 직접 만들지 않고 기존 서비스에 넘길 생성 요청만 조립한다. 새 INSERT
경로를 만들면 채번·조직명 스냅샷·감사로그를 전부 다시 구현해야 한다.

시트 3은 A·B열이 병합이라 forward-fill로 비목 쌍을 복원한다. 외화 행은
FC_AMT만 채우고 원화금액과 환율은 서버 재계산에 맡긴다. 여기서 채우면
BudgetAmountCalculator가 그 값을 버린다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: 시트 ② 경상사업 어댑터

폼 5개 항목과 소요자원 표를 읽어 경상사업 1건과 품목 N건을 만든다. 부서는 시트에 없어 폴더명에서 온다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/ResourceTableReader.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/RecurringProjectFormAdapter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/RecurringProjectFormAdapterTest.java`

**Interfaces:**
- Consumes: Task 7의 `FormAdapterContext`·`FormAdapterOutput`·`FormSheetAdapter`, `SheetAnchorScanner`, `FormLexicon`, `IoeHierarchyIndex.Snapshot`
- Produces:
  - `record ResourceRow(int excelRow, String group, String itemName, BigDecimal qty, BigDecimal unitPrice, String currency, BigDecimal amount, String basis, String timing, String infoSec, String infra, String remarks)`
  - `class ResourceTableReader`
    - `ResourceTableReader(SheetAnchorScanner scanner)`
    - `Optional<Result> read(Sheet sheet, int fromRow, boolean annualHeader)`
    - `record Result(int headerRow, List<ResourceRow> rows)`
  - `class RecurringProjectFormAdapter implements FormSheetAdapter` (`@Component`)
  - `static ProjectDto.BitemmDto toItem(ResourceRow row, String ioeCode, int sno, String bseYy)` — Task 9와 공유하도록 `ResourceTableReader`에 둔다

- [ ] **Step 1: 실패 테스트 작성**

```java
package com.kdb.it.domain.migration.request.service.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.IoeHierarchyIndex;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import com.kdb.it.domain.migration.request.service.WorkbookReader;
import com.kdb.it.domain.migration.request.support.RequestFormFixtures;
import com.kdb.it.domain.migration.request.support.TestIoeIndex;
import java.math.BigDecimal;
import java.util.Map;
import org.apache.poi.ss.usermodel.Sheet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RecurringProjectFormAdapterTest {

    private final WorkbookReader reader = new WorkbookReader(10_485_760L, 20, 5000, 0.01d);
    private final SheetAnchorScanner scanner = new SheetAnchorScanner();
    private final RecurringProjectFormAdapter adapter =
            new RecurringProjectFormAdapter(scanner, new ResourceTableReader(scanner));

    private FormAdapterContext contextOf(byte[] bytes, Map<String, String> overrides) {
        Map<FormSheetKind, Sheet> sheets = reader.classify(reader.open(bytes, "픽스처.xls"));
        return new FormAdapterContext(
                sheets,
                "2026",
                new RequestFormDto.FileEntry("런던지점/붙임.xls", "런던지점", null, null, null),
                "0930",
                "런던지점",
                null,
                TestIoeIndex.snapshot(),
                overrides,
                "12345678");
    }

    @Test
    @DisplayName("경상사업 1건과 품목 2건을 만든다")
    void buildsRecurringProjectWithItems() {
        FormAdapterOutput output = adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), Map.of()));

        assertThat(output.projects()).hasSize(1);
        ProjectDto.CreateRequest project = output.projects().get(0);
        assertThat(project.getAbusNm()).isEqualTo("2026년 IT기계장치 구입");
        assertThat(project.getOdnYn()).isEqualTo("Y");
        assertThat(project.getBseYy()).isEqualTo("2026");
        assertThat(project.getSvnDpmC()).isEqualTo("0930");
        assertThat(project.getSttDtm()).isEqualTo(java.time.LocalDate.of(2026, 1, 1));
        assertThat(project.getEndDtm()).isEqualTo(java.time.LocalDate.of(2026, 12, 31));
        assertThat(project.getItems()).hasSize(2);
    }

    @Test
    @DisplayName("폼 5개 항목을 사업 설명 컬럼으로 옮긴다")
    void mapsOverviewFields() {
        ProjectDto.CreateRequest project =
                adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), Map.of())).projects().get(0);

        assertThat(project.getAbusCone()).isEqualTo("PC, 모니터 구입");
        assertThat(project.getCpnSafCone()).isEqualTo("내용연수 경과");
        assertThat(project.getAbusRngCone()).isEqualTo("고장기기 교체");
        assertThat(project.getPlmDes()).isEqualTo("업무효율 저하");
    }

    @Test
    @DisplayName("HW·SW 구분과 통화로 품목 비목을 정한다")
    void resolvesItemIoeByGroupAndCurrency() {
        ProjectDto.CreateRequest project =
                adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), Map.of())).projects().get(0);

        // GBP 행이므로 국외 계열
        assertThat(project.getItems().get(0).getIoeC()).isEqualTo("102");
        assertThat(project.getItems().get(1).getIoeC()).isEqualTo("105");
    }

    @Test
    @DisplayName("품목 금액은 외화 행이면 FC_AMT에만 담고 수량·순번을 채운다")
    void fillsItemAmountsAndSequence() {
        ProjectDto.CreateRequest project =
                adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), Map.of())).projects().get(0);

        ProjectDto.BitemmDto first = project.getItems().get(0);
        assertThat(first.getSno()).isEqualTo(1);
        assertThat(first.getGclNm()).isEqualTo("데스크탑(고사양)");
        assertThat(first.getQty()).isEqualByComparingTo(new BigDecimal("12"));
        assertThat(first.getCurC()).isEqualTo("GBP");
        assertThat(first.getFcAmt()).isEqualByComparingTo(new BigDecimal("23346.84"));
        assertThat(first.getAmt()).isNull();
        assertThat(first.getXcr()).isNull();
        assertThat(first.getXcrBseDt()).isEqualTo("20260101");
        assertThat(first.getDfrCleC()).isEqualTo("0");
        assertThat(first.getLstYn()).isEqualTo("Y");
        assertThat(project.getItems().get(1).getSno()).isEqualTo(2);
    }

    @Test
    @DisplayName("계 행은 품목으로 만들지 않는다")
    void skipsTotalRow() {
        ProjectDto.CreateRequest project =
                adapter.adapt(contextOf(RequestFormFixtures.fullFormXls(), Map.of())).projects().get(0);

        assertThat(project.getItems())
                .extracting(ProjectDto.BitemmDto::getGclNm)
                .doesNotContain("계", "");
    }

    @Test
    @DisplayName("사업명이 비면 필수값 누락 진단을 내고 사업을 만들지 않는다")
    void blocksWhenProjectNameMissing() {
        // 런던 제출본 실측: 사업명 공란인데 소요자원은 채워져 있다
        FormAdapterOutput output =
                adapter.adapt(contextOf(RequestFormFixtures.englishFormXls(), Map.of()));

        assertThat(output.projects()).isEmpty();
        assertThat(output.diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(RequestFormDiagnosticCode.REQUIRED_MISSING);
    }

    @Test
    @DisplayName("보정으로 사업명을 채우면 사업을 만든다")
    void buildsProjectWhenNameSuppliedByOverride() {
        Map<String, String> overrides =
                Map.of(
                        FormAdapterContext.overrideKey(FormSheetKind.RECURRING, null, "abusNm"),
                        "2026년 런던지점 IT기기 구입");

        FormAdapterOutput output =
                adapter.adapt(contextOf(RequestFormFixtures.englishFormXls(), overrides));

        assertThat(output.projects()).hasSize(1);
        assertThat(output.projects().get(0).getAbusNm()).isEqualTo("2026년 런던지점 IT기기 구입");
    }

    @Test
    @DisplayName("시트 ②가 없으면 빈 결과를 돌려준다")
    void returnsEmptyWhenSheetAbsent() {
        Map<FormSheetKind, Sheet> sheets =
                reader.classify(reader.open(RequestFormFixtures.capitalOnlyXlsx(), "자료1.xlsx"));
        FormAdapterContext context =
                new FormAdapterContext(
                        sheets, "2026",
                        new RequestFormDto.FileEntry("a/b.xlsx", "IT기획부", null, null, null),
                        "0100", "IT기획부", null, TestIoeIndex.snapshot(), Map.of(), "12345678");

        assertThat(adapter.adapt(context).projects()).isEmpty();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*RecurringProjectFormAdapterTest*"`
Expected: FAIL — `ResourceTableReader`·`RecurringProjectFormAdapter` 없음.

- [ ] **Step 3: `ResourceTableReader` 작성**

시트 ②와 1-2가 같은 모양의 소요자원 표를 쓰므로 Task 9와 공유한다.

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.request.service.FormLexicon;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Sheet;
import org.springframework.stereotype.Component;

/**
 * 소요자원 표 하나를 읽습니다.
 *
 * <p>시트 ②와 시트 1-2가 같은 모양의 표(`구분 | 항목 | 수량 | 단가 | 통화 | 소요예산 | …`)를 쓰므로 두 어댑터가 공유합니다. 1-2는 자본예산·일반관리비
 * 블록 두 개가 위아래로 놓여 있어 `fromRow`를 옮겨 가며 두 번 호출합니다.
 */
@Component
@RequiredArgsConstructor
public class ResourceTableReader {

    /** 품목명 최대 길이 (물리 컬럼 `GCL_NM`). */
    public static final int ITEM_NAME_LIMIT = 100;

    /** 예산근거 최대 길이 (물리 컬럼 `CNCD_FDTN_CONE`). */
    public static final int BASIS_LIMIT = 600;

    /** 지급주기: 해당없음. 자본예산 품목은 양식에 주기 열이 없어 이 값을 씁니다. */
    public static final String CYCLE_NOT_APPLICABLE = "0";

    private final SheetAnchorScanner scanner;

    /**
     * 표를 찾아 데이터 행을 읽습니다.
     *
     * @param sheet 대상 시트
     * @param fromRow 이 행부터 헤더를 찾습니다
     * @param annualHeader true면 `연간 소요예산` 헤더(일반관리비 블록), false면 `소요예산` 헤더(자본예산 블록)
     * @return 헤더 위치와 행 목록. 표를 못 찾으면 빈 Optional
     */
    public Optional<Result> read(Sheet sheet, int fromRow, boolean annualHeader) {
        Map<String, List<String>> aliases =
                FormLexicon.columnAliases(
                        Map.of(
                                "item", "항목",
                                "qty", "수량",
                                "unitPrice", "단가",
                                "currency", "통화",
                                "amount", annualHeader ? "연간 소요예산 (부가세포함)" : "소요예산 (부가세포함)",
                                "basis", "산정근거",
                                "timing", annualHeader ? "대금지급주기 (월/분기/년)" : "도입시기(월)",
                                "infoSec", "정보보호여부",
                                "infra", "인프라 통합관리 여부",
                                "remarks", "비고(적용 환율 등)"));

        Optional<SheetAnchorScanner.HeaderMap> header =
                scanner.findHeader(sheet, fromRow, aliases, "item", "qty", "currency", "amount");
        if (header.isEmpty()) return Optional.empty();

        SheetAnchorScanner.HeaderMap map = header.get();
        int itemCol = map.column("item");
        // 구분(대분류)·중분류는 헤더 라벨이 `구분` 하나로 병합돼 있어 항목 열의 왼쪽 두 칸으로 잡는다.
        int groupCol = Math.max(itemCol - 1, 0);

        List<ResourceRow> rows = new ArrayList<>();
        String lastGroup = "";
        for (int rowIndex = map.rowIndex() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
            String itemName = text(sheet, map, rowIndex, "item");
            // 다음 블록의 헤더를 만나면 이 블록은 끝이다. 이 판정이 없으면 1-2의 자본예산
            // 블록이 아래 일반관리비 블록의 행까지 삼킨다(두 블록의 열 구성이 거의 같아
            // 헤더 아래 행이 그대로 데이터로 읽힌다).
            if (isHeaderRow(itemName)) break;
            BigDecimal amount = number(sheet, map, rowIndex, "amount");
            if (itemName.isEmpty() || amount == null || amount.signum() == 0) continue;
            if (isTotalRow(sheet, rowIndex)) break;

            String group = scanner.text(sheet, rowIndex, groupCol);
            if (!group.isEmpty()) lastGroup = group;

            rows.add(
                    new ResourceRow(
                            rowIndex + 1,
                            lastGroup,
                            itemName,
                            number(sheet, map, rowIndex, "qty"),
                            number(sheet, map, rowIndex, "unitPrice"),
                            text(sheet, map, rowIndex, "currency"),
                            amount,
                            text(sheet, map, rowIndex, "basis"),
                            text(sheet, map, rowIndex, "timing"),
                            text(sheet, map, rowIndex, "infoSec"),
                            text(sheet, map, rowIndex, "infra"),
                            text(sheet, map, rowIndex, "remarks")));
        }
        return Optional.of(new Result(map.rowIndex(), List.copyOf(rows)));
    }

    /**
     * 소요자원 행을 품목 DTO로 바꿉니다.
     *
     * <p>원화 행은 `AMT`에, 외화 행은 `FC_AMT`에만 담습니다. 외화의 원화금액과 환율은 서버 {@code BudgetAmountCalculator}가
     * `FC_AMT × Ccodem 환율`로 재계산하므로 여기서 채우면 그 값이 버려집니다. JPY만 양식이 천엔이라 엔으로 폅니다.
     *
     * @param row 소요자원 행
     * @param ioeCode 확정된 비목코드. 미해석이면 null
     * @param sno 품목 순번 (1부터)
     * @param bseYy 예산연도. 환율기준일자를 `{연도}0101`로 만듭니다
     * @return 품목 DTO
     */
    public static ProjectDto.BitemmDto toItem(ResourceRow row, String ioeCode, int sno, String bseYy) {
        ProjectDto.BitemmDto item = new ProjectDto.BitemmDto();
        item.setSno(sno);
        item.setIoeC(ioeCode);
        item.setGclNm(row.itemName());
        item.setQty(row.qty());
        item.setCurC(row.currency());
        item.setCncdFdtnCone(row.basis());
        item.setBseYm(toBseYm(row.timing(), bseYy));
        item.setDfrCleC(toPaymentCycle(row.timing()));
        item.setSectSysUtzYn(FormLexicon.toYn(row.infoSec()).orElse(null));
        item.setItrInfrYn(FormLexicon.toYn(row.infra()).orElse(null));
        item.setLstYn("Y");
        item.setXcrBseDt(bseYy + "0101");

        if ("KRW".equalsIgnoreCase(row.currency())) {
            item.setAmt(row.amount());
            item.setFcAmt(null);
        } else {
            long multiplier = "JPY".equalsIgnoreCase(row.currency()) ? 1_000L : 1L;
            item.setFcAmt(row.amount().multiply(BigDecimal.valueOf(multiplier)));
            item.setAmt(null);
            item.setXcr(null);
        }
        return item;
    }

    /**
     * 지급주기 표기를 코드로 바꿉니다.
     *
     * <p>자본예산 블록은 `도입시기(월)`만 있고 주기 열이 없어 대부분 해당없음(`0`)이 됩니다. 물리 컬럼이 NOT NULL이라 기본값이 반드시 필요합니다.
     */
    private static String toPaymentCycle(String timing) {
        String normalized = SheetAnchorScanner.normalize(timing);
        if (normalized.contains("월")) return "M";
        if (normalized.contains("분기")) return "Q";
        if (normalized.contains("반기")) return "H";
        if (normalized.contains("년")) return "Y";
        return CYCLE_NOT_APPLICABLE;
    }

    /** `~26.2월`·`2분기 중` 같은 표기에서 추진년월(`YYYYMM`)을 뽑습니다. 못 뽑으면 null. */
    private static String toBseYm(String timing, String bseYy) {
        java.util.regex.Matcher matcher =
                java.util.regex.Pattern.compile("(\\d{1,2})\\s*월").matcher(timing == null ? "" : timing);
        if (!matcher.find()) return null;
        int month = Integer.parseInt(matcher.group(1));
        if (month < 1 || month > 12) return null;
        return bseYy + String.format("%02d", month);
    }

    private String text(Sheet sheet, SheetAnchorScanner.HeaderMap map, int rowIndex, String columnId) {
        Integer col = map.column(columnId);
        return col == null ? "" : scanner.text(sheet, rowIndex, col);
    }

    private BigDecimal number(
            Sheet sheet, SheetAnchorScanner.HeaderMap map, int rowIndex, String columnId) {
        String raw = text(sheet, map, rowIndex, columnId).replace(",", "").trim();
        if (raw.isEmpty()) return null;
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isTotalRow(Sheet sheet, int rowIndex) {
        String label = SheetAnchorScanner.normalize(scanner.text(sheet, rowIndex, 0));
        return label.equals("계") || label.equals("소계") || label.equals("총계") || label.equals("Total");
    }

    /** 항목 열에 헤더 라벨이 그대로 들어 있으면 다음 블록의 헤더 행입니다. */
    private boolean isHeaderRow(String itemCellText) {
        String normalized = SheetAnchorScanner.normalize(itemCellText);
        return normalized.equals("항목") || normalized.equalsIgnoreCase("Item");
    }

    /**
     * 표를 읽은 결과입니다.
     *
     * @param headerRow 헤더의 0-based 행 번호. 다음 블록을 찾을 시작점으로 씁니다
     * @param rows 데이터 행 목록
     */
    public record Result(int headerRow, List<ResourceRow> rows) {}
}
```

`ResourceRow.java`(같은 패키지):

```java
package com.kdb.it.domain.migration.request.service.adapter;

import java.math.BigDecimal;

/**
 * 소요자원 표의 데이터 행 하나입니다.
 *
 * @param excelRow 엑셀 사용자 관점 행 번호(1-based). 진단 좌표로 씁니다
 * @param group 구분·중분류 (`기계장치(HW)`, `전산제비` 등). 병합이면 위 행에서 이어받은 값
 * @param itemName 항목명
 * @param qty 수량. 비어 있으면 null
 * @param unitPrice 단가. 적재하지 않고 `수량 × 단가 = 소요예산` 대사에만 씁니다
 * @param currency 통화
 * @param amount 소요예산 (원 단위 또는 통화 기본 단위)
 * @param basis 산정근거
 * @param timing 도입시기 또는 대금지급주기
 * @param infoSec 정보보호여부 원문
 * @param infra 인프라 통합관리 여부 원문
 * @param remarks 비고
 */
public record ResourceRow(
        int excelRow,
        String group,
        String itemName,
        BigDecimal qty,
        BigDecimal unitPrice,
        String currency,
        BigDecimal amount,
        String basis,
        String timing,
        String infoSec,
        String infra,
        String remarks) {}
```

- [ ] **Step 4: `RecurringProjectFormAdapter` 작성**

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.common.code.CodeDefaults;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.IoeHierarchyIndex;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Sheet;
import org.springframework.stereotype.Component;

/**
 * 시트 ② `2. 경상적인 사업`을 경상사업 생성 요청으로 바꿉니다.
 *
 * <p>부서 열이 시트에 없어 폴더명에서 온 부서코드를 씁니다. 기간은 예산연도 전체(`1월 1일 ~ 12월 31일`)로 둡니다 — 경상사업은 연중 상시 집행이라 양식에
 * 시작·종료일 칸이 없습니다.
 *
 * <p>런던 제출본처럼 사업명이 공란인 파일이 실제로 있습니다. 이때는 사업을 만들지 않고 `REQUIRED_MISSING`을 내 미리보기에서 채우게 합니다.
 */
@Component
@RequiredArgsConstructor
public class RecurringProjectFormAdapter implements FormSheetAdapter {

    /** 사업명 최대 길이 (물리 컬럼 `ABUS_NM`). */
    private static final int PROJECT_NAME_LIMIT = 100;

    /** 라벨이 놓이는 열. A열은 대분류, C열은 소분류입니다. */
    private static final int[] LABEL_COLUMNS = {0, 2};

    private final SheetAnchorScanner scanner;
    private final ResourceTableReader resourceTableReader;

    @Override
    public FormSheetKind trigger() {
        return FormSheetKind.RECURRING;
    }

    @Override
    public FormAdapterOutput adapt(FormAdapterContext context) {
        Sheet sheet = context.sheets().get(FormSheetKind.RECURRING);
        if (sheet == null) return FormAdapterOutput.empty();

        List<RequestFormDto.FormDiagnostic> diagnostics = new ArrayList<>();
        String projectName = resolveProjectName(sheet, context, diagnostics);

        Optional<ResourceTableReader.Result> table = resourceTableReader.read(sheet, 0, false);
        if (table.isEmpty() || table.get().rows().isEmpty()) {
            // 사업명도 없고 소요자원도 없으면 부점이 이 시트를 쓰지 않은 것이다. 진단 없이 건너뛴다.
            if (projectName == null) return FormAdapterOutput.empty();
        }

        if (projectName == null) {
            diagnostics.add(
                    RequestFormDto.FormDiagnostic.of(
                            FormSheetKind.RECURRING,
                            null,
                            "abusNm",
                            RequestFormDiagnosticCode.REQUIRED_MISSING,
                            "경상사업의 사업명이 비어 있습니다. 미리보기에서 입력해 주세요.",
                            List.of()));
            return new FormAdapterOutput(List.of(), List.of(), List.copyOf(diagnostics), null);
        }

        ProjectDto.CreateRequest project = new ProjectDto.CreateRequest();
        project.setAbusNm(projectName);
        project.setBseYy(context.bseYy());
        project.setOdnYn("Y");
        project.setLstYn("Y");
        project.setAbusTc(CodeDefaults.NOT_APPLICABLE);
        project.setSvnDpmC(context.resolvedDeptCode());
        project.setSvnDpmNm(context.resolvedDeptName());
        project.setSttDtm(LocalDate.of(Integer.parseInt(context.bseYy()), 1, 1));
        project.setEndDtm(LocalDate.of(Integer.parseInt(context.bseYy()), 12, 31));
        project.setAbusCone(labelValue(sheet, "(개요)"));
        project.setCpnSafCone(labelValue(sheet, "(현황)"));
        project.setAbusRngCone(labelValue(sheet, "(추진내용)"));
        project.setPlmDes(labelValue(sheet, "(미추진시 문제점)"));

        List<ProjectDto.BitemmDto> items = new ArrayList<>();
        if (table.isPresent()) {
            int sno = 1;
            for (ResourceRow row : table.get().rows()) {
                items.add(toItem(row, context, sno++, diagnostics));
            }
        }
        project.setItems(items);

        return new FormAdapterOutput(List.of(project), List.of(), List.copyOf(diagnostics), null);
    }

    private ProjectDto.BitemmDto toItem(
            ResourceRow row,
            FormAdapterContext context,
            int sno,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        String ioeCode = resolveIoe(row, context, diagnostics);
        return ResourceTableReader.toItem(row, ioeCode, sno, context.bseYy());
    }

    private String resolveIoe(
            ResourceRow row,
            FormAdapterContext context,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        Optional<String> override = context.override(FormSheetKind.RECURRING, row.excelRow(), "ioeC");
        if (override.isPresent() && context.ioeIndex().exists(override.get())) return override.get();

        boolean domestic = "KRW".equalsIgnoreCase(row.currency());
        IoeHierarchyIndex.Resolution resolution =
                context.ioeIndex().resolveByGroup(row.group(), domestic);
        if (resolution.code() != null) return resolution.code();

        diagnostics.add(
                RequestFormDto.FormDiagnostic.of(
                        FormSheetKind.RECURRING,
                        row.excelRow(),
                        "ioeC",
                        resolution.isAmbiguous()
                                ? RequestFormDiagnosticCode.CODE_AMBIGUOUS
                                : RequestFormDiagnosticCode.CODE_UNRESOLVED,
                        "품목 구분 `%s`의 비목을 정하지 못했습니다.".formatted(row.group()),
                        resolution.candidates()));
        return null;
    }

    private String resolveProjectName(
            Sheet sheet, FormAdapterContext context, List<RequestFormDto.FormDiagnostic> diagnostics) {
        Optional<String> override = context.override(FormSheetKind.RECURRING, null, "abusNm");
        if (override.isPresent()) return truncate(override.get(), PROJECT_NAME_LIMIT, diagnostics);

        String fromSheet = labelValue(sheet, "사업명");
        if (fromSheet == null || fromSheet.isBlank()) return null;
        return truncate(fromSheet, PROJECT_NAME_LIMIT, diagnostics);
    }

    private String truncate(
            String value, int limit, List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (value.length() <= limit) return value;
        diagnostics.add(
                RequestFormDto.FormDiagnostic.of(
                        FormSheetKind.RECURRING,
                        null,
                        "abusNm",
                        RequestFormDiagnosticCode.LENGTH_EXCEEDED,
                        "사업명이 %d자를 넘습니다(%d자).".formatted(limit, value.length()),
                        List.of()));
        return value;
    }

    /** 라벨(국문 정본)로 값을 읽습니다. 대조표의 영문 표기도 함께 시도합니다. */
    private String labelValue(Sheet sheet, String canonicalLabel) {
        List<String> aliases = com.kdb.it.domain.migration.request.service.FormLexicon.labelAliases(canonicalLabel);
        Optional<Integer> row =
                scanner.findLabelRow(sheet, LABEL_COLUMNS, aliases.toArray(String[]::new));
        if (row.isEmpty()) return null;
        int labelColumn = labelColumnOf(sheet, row.get(), aliases);
        return scanner.valueRightOf(sheet, row.get(), labelColumn).orElse(null);
    }

    private int labelColumnOf(Sheet sheet, int rowIndex, List<String> aliases) {
        for (int colIndex : LABEL_COLUMNS) {
            String text = SheetAnchorScanner.normalize(scanner.text(sheet, rowIndex, colIndex));
            for (String alias : aliases) {
                if (text.equals(SheetAnchorScanner.normalize(alias))) return colIndex;
            }
        }
        return LABEL_COLUMNS[0];
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*RecurringProjectFormAdapterTest*"`
Expected: PASS — 8개 테스트 전부 성공.

`ProjectDto.CreateRequest`에 `setSvnDpmNm`·`setLstYn`이 없으면 그 두 줄을 지운다. 엔티티 변환에서 채워지는 값이면 DTO에 없을 수 있다. DTO를 수정하지 않는다.

- [ ] **Step 6: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/adapter src/test/java/com/kdb/it/domain/migration/request/service/adapter
git -C it_backend commit -m "feat(migration): 경상사업 시트 어댑터와 소요자원 표 리더

시트 2와 시트 1-2가 같은 모양의 소요자원 표를 쓰므로 리더를 공유한다.
1-2는 자본예산·일반관리비 블록이 위아래로 놓여 fromRow를 옮겨 두 번 부른다.

경상사업은 부서 열이 시트에 없어 폴더명에서 온 부서코드를 쓰고, 기간은
예산연도 전체로 둔다. 런던 제출본처럼 사업명이 공란인 파일이 실제로 있어
그 경우 사업을 만들지 않고 필수값 누락 진단을 내 미리보기에서 채우게 한다.

자본예산 품목은 양식에 지급주기 열이 없어 해당없음(0)을 기본값으로 넣는다.
DFR_CLE_C가 물리 NOT NULL이라 기본값이 반드시 필요하다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: 시트 ① 정보화사업 어댑터

1-1(개요 폼)과 1-2(소요자원 표 2블록)를 함께 읽어 정보화사업 1건과 품목 N건을 만든다. 폼 항목이 많아 1-1 읽기를 별도 클래스로 분리한다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReader.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/adapter/CapitalProjectFormAdapter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalOverviewReaderTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/adapter/CapitalProjectFormAdapterTest.java`

**Interfaces:**
- Consumes: Task 7·8의 어댑터 계약과 `ResourceTableReader`, `MigrationIoeCatalogReader.exePttCodeByName()`·`edrtCapitalCodeByName()`, `OrgIdentityResolver.Index.resolveOrg(String)`·`resolveUser(String, String)`
- Produces:
  - `class CapitalOverviewReader` (`@Component`)
    - `Result read(Sheet sheet, FormAdapterContext context, Map<String,String> exePttCodes, Map<String,String> edrtCodes)`
    - `record Result(ProjectDto.CreateRequest project, List<RequestFormDto.FormDiagnostic> diagnostics, BigDecimal declaredYearTotal)`
  - `class CapitalProjectFormAdapter implements FormSheetAdapter` (`@Component`)

- [ ] **Step 1: 1-1 읽기의 실패 테스트 작성**

```java
package com.kdb.it.domain.migration.request.service.adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import com.kdb.it.domain.migration.request.service.WorkbookReader;
import com.kdb.it.domain.migration.request.support.RequestFormFixtures;
import com.kdb.it.domain.migration.request.support.TestIoeIndex;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.Sheet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CapitalOverviewReaderTest {

    @Mock private OrgIdentityResolver.Index orgIndex;

    private final WorkbookReader reader = new WorkbookReader(10_485_760L, 20, 5000, 0.01d);
    private final CapitalOverviewReader overviewReader =
            new CapitalOverviewReader(new SheetAnchorScanner());

    private Sheet sheet;
    private FormAdapterContext context;

    @BeforeEach
    void setUp() {
        Map<FormSheetKind, Sheet> sheets =
                reader.classify(reader.open(RequestFormFixtures.fullFormXls(), "픽스처.xls"));
        sheet = sheets.get(FormSheetKind.CAPITAL_OVERVIEW);
        context =
                new FormAdapterContext(
                        sheets,
                        "2026",
                        new RequestFormDto.FileEntry("자금운용실/요청서.xls", "자금운용실", null, null, null),
                        "0210",
                        "자금운용실",
                        orgIndex,
                        TestIoeIndex.snapshot(),
                        Map.of(),
                        "12345678");

        when(orgIndex.resolveOrg("자금운용실"))
                .thenReturn(new OrgIdentityResolver.Resolution("0210", "자금운용실", List.of(), false));
        when(orgIndex.resolveOrg("원화유가증권팀"))
                .thenReturn(new OrgIdentityResolver.Resolution("02101", "원화유가증권팀", List.of(), false));
        when(orgIndex.resolveUser(eq("윤소정"), any()))
                .thenReturn(new OrgIdentityResolver.Resolution("11111111", "윤소정", List.of(), false));
        when(orgIndex.resolveUser(eq("허진성"), any()))
                .thenReturn(new OrgIdentityResolver.Resolution("22222222", "허진성", List.of(), false));
        when(orgIndex.resolveUser(eq("공현순"), any()))
                .thenReturn(new OrgIdentityResolver.Resolution("33333333", "공현순", List.of(), false));
        when(orgIndex.resolveUser(eq("최현식"), any()))
                .thenReturn(new OrgIdentityResolver.Resolution("44444444", "최현식", List.of(), false));
    }

    @Test
    @DisplayName("사업 설명 6개 항목을 각 컬럼으로 옮긴다")
    void mapsNarrativeFields() {
        ProjectDto.CreateRequest project = overviewReader.read(sheet, context, Map.of(), Map.of()).project();

        assertThat(project.getAbusNm()).isEqualTo("국채전문유통시장 접속인프라 도입");
        assertThat(project.getAbusCone()).isEqualTo("접속방식 변경");
        assertThat(project.getCpnSafCone()).isEqualTo("Exture3.0 운영 중");
        assertThat(project.getAbusNcsCone()).isEqualTo("접속체계 전환 대응");
        assertThat(project.getDgogPpoCone()).isEqualTo("PD 자격 유지");
        assertThat(project.getPlmDes()).isEqualTo("PD 업무 수행 불가");
    }

    @Test
    @DisplayName("여러 행에 걸친 사업범위를 줄바꿈으로 잇는다")
    void joinsMultiRowScope() {
        ProjectDto.CreateRequest project = overviewReader.read(sheet, context, Map.of(), Map.of()).project();

        assertThat(project.getAbusRngCone()).contains("전용망 거래 기능").contains("추가 요구사항 3");
    }

    @Test
    @DisplayName("주관부서/팀을 슬래시로 갈라 각각 해석한다")
    void splitsDepartmentAndTeam() {
        ProjectDto.CreateRequest project = overviewReader.read(sheet, context, Map.of(), Map.of()).project();

        assertThat(project.getSvnDpmC()).isEqualTo("0210");
        assertThat(project.getSvnTemC()).isEqualTo("02101");
    }

    @Test
    @DisplayName("실무자(정/부)에서 정만 담고 부는 미적재 경고를 낸다")
    void keepsPrimaryStaffOnly() {
        CapitalOverviewReader.Result result = overviewReader.read(sheet, context, Map.of(), Map.of());

        assertThat(result.project().getUsid()).isEqualTo("22222222");
        assertThat(result.diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(RequestFormDiagnosticCode.SUBSTITUTE_DROPPED);
    }

    @Test
    @DisplayName("팀장과 IT팀장·IT실무자를 각 컬럼으로 옮긴다")
    void mapsManagers() {
        ProjectDto.CreateRequest project = overviewReader.read(sheet, context, Map.of(), Map.of()).project();

        assertThat(project.getTlrUsid()).isEqualTo("11111111");
        assertThat(project.getDvmTlrUsid()).isEqualTo("33333333");
        assertThat(project.getDvmUsid()).isEqualTo("44444444");
    }

    @Test
    @DisplayName("YY/MM 표기를 시작 1일·종료 말일로 바꾼다")
    void parsesPeriod() {
        ProjectDto.CreateRequest project = overviewReader.read(sheet, context, Map.of(), Map.of()).project();

        assertThat(project.getSttDtm()).isEqualTo(LocalDate.of(2025, 6, 1));
        assertThat(project.getEndDtm()).isEqualTo(LocalDate.of(2026, 2, 28));
    }

    @Test
    @DisplayName("전결권자 이름을 자본예산 계열 코드로 바꾼다")
    void mapsDelegationCode() {
        ProjectDto.CreateRequest project =
                overviewReader.read(sheet, context, Map.of(), Map.of("수석부행장", "21")).project();

        assertThat(project.getEdrtTc()).isEqualTo("21");
    }

    @Test
    @DisplayName("공란인 사업구분·편성기준 8항목마다 선택항목 누락 경고를 낸다")
    void warnsOnEmptyOptionalFields() {
        CapitalOverviewReader.Result result = overviewReader.read(sheet, context, Map.of(), Map.of());

        assertThat(result.diagnostics())
                .filteredOn(d -> d.code() == RequestFormDiagnosticCode.OPTIONAL_MISSING)
                .extracting(RequestFormDto.FormDiagnostic::field)
                .containsExactlyInAnyOrder(
                        "bzDttNm", "bzTpC", "sklTpTc", "cstTpTc",
                        "dplYn", "flfFsgDt", "rprStsTc", "exePttYn");
    }

    @Test
    @DisplayName("확인자·작성자는 쓰지 않고 관련 조직의 팀장·실무자만 정본으로 삼는다")
    void ignoresConfirmerAndAuthorRows() {
        ProjectDto.CreateRequest project = overviewReader.read(sheet, context, Map.of(), Map.of()).project();

        // 픽스처의 확인자는 `허인선 팀장`, 관련 조직의 팀장은 `윤소정`
        assertThat(project.getTlrUsid()).isNotEqualTo("허인선");
        assertThat(project.getTlrUsid()).isEqualTo("11111111");
    }

    @Test
    @DisplayName("사람 이름이 있는데 해석되지 않으면 차단 진단을 낸다")
    void blocksWhenNamedUserUnresolved() {
        when(orgIndex.resolveUser(eq("윤소정"), any()))
                .thenReturn(new OrgIdentityResolver.Resolution(null, "윤소정", List.of(), false));

        CapitalOverviewReader.Result result = overviewReader.read(sheet, context, Map.of(), Map.of());

        assertThat(result.diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(RequestFormDiagnosticCode.USER_UNRESOLVED);
    }

    @Test
    @DisplayName("동명이인이면 후보를 담아 중의 진단을 낸다")
    void reportsAmbiguousUserWithCandidates() {
        when(orgIndex.resolveUser(eq("허진성"), any()))
                .thenReturn(
                        new OrgIdentityResolver.Resolution(
                                null,
                                "허진성",
                                List.of(
                                        new MigrationDto.Candidate("22222222", "허진성 과장"),
                                        new MigrationDto.Candidate("55555555", "허진성 대리")),
                                true));

        CapitalOverviewReader.Result result = overviewReader.read(sheet, context, Map.of(), Map.of());

        assertThat(result.diagnostics())
                .filteredOn(d -> d.code() == RequestFormDiagnosticCode.USER_AMBIGUOUS)
                .singleElement()
                .satisfies(d -> assertThat(d.candidates()).hasSize(2));
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*CapitalOverviewReaderTest*"`
Expected: FAIL — `CapitalOverviewReader` 클래스 없음.

- [ ] **Step 3: `CapitalOverviewReader` 작성**

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.common.code.CodeDefaults;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.FormLexicon;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Sheet;
import org.springframework.stereotype.Component;

/**
 * 시트 ① 1-1 `정보화사업 개요` 폼을 읽습니다.
 *
 * <p>항목이 20개가 넘어 어댑터에서 분리했습니다. 라벨 앵커로 각 항목을 찾고, 사람 이름은 조직 인덱스로 사번을 해석합니다.
 *
 * <p>상단의 `(확인자)`·`(작성자)`는 **쓰지 않습니다.** 담당자·팀장은 `관련 조직` 블록의 `팀장`·`실무자(정/부)`·`IT팀장`·`IT실무자(정/부)`가
 * 정본입니다. 실측 파일에서 두 곳이 어긋났습니다(확인자 `허인선 팀장` 대 관련 조직 팀장 `윤소정`) — 제출 담당자와 사업 주관자가 다른 경우입니다.
 */
@Component
@RequiredArgsConstructor
public class CapitalOverviewReader {

    /** 라벨이 놓이는 열. A열은 대분류, C열은 소분류입니다. */
    private static final int[] LABEL_COLUMNS = {0, 2};

    /** 사업범위·추진경과처럼 여러 행에 걸치는 칸을 이어 붙일 최대 행 수. */
    private static final int MULTI_ROW_SPAN = 8;

    /** 사업명 최대 길이 (물리 컬럼 `ABUS_NM`). */
    private static final int PROJECT_NAME_LIMIT = 100;

    /** 공란이면 경고만 내고 null로 반입하는 선택 항목. 필드 id 별 폼 라벨. */
    private static final Map<String, String> OPTIONAL_FIELDS = optionalFields();

    private final SheetAnchorScanner scanner;

    /**
     * 1-1 시트를 읽어 사업 생성 요청을 만듭니다.
     *
     * @param sheet 1-1 시트
     * @param context 어댑터 실행 맥락
     * @param exePttCodes 추진가능성 코드값명 별 코드
     * @param edrtCodes 전결권 자본예산 계열 코드값명 별 코드
     * @return 사업 요청, 진단, 1-1 요약표의 `'26년도 합계` 기재값
     */
    public Result read(
            Sheet sheet,
            FormAdapterContext context,
            Map<String, String> exePttCodes,
            Map<String, String> edrtCodes) {
        List<RequestFormDto.FormDiagnostic> diagnostics = new ArrayList<>();
        ProjectDto.CreateRequest project = new ProjectDto.CreateRequest();

        project.setBseYy(context.bseYy());
        project.setOdnYn("N");
        project.setAbusTc(CodeDefaults.NOT_APPLICABLE);
        project.setAbusNm(
                truncate(labelValue(sheet, "사업명"), PROJECT_NAME_LIMIT, "abusNm", diagnostics));
        project.setAbusCone(labelValue(sheet, "(개요)"));
        project.setCpnSafCone(labelValue(sheet, "(현황)"));
        project.setAbusNcsCone(labelValue(sheet, "(필요성)"));
        project.setDgogPpoCone(labelValue(sheet, "(기대효과)"));
        project.setPlmDes(labelValue(sheet, "(미추진시 문제점)"));
        project.setAbusRngCone(multiRowValue(sheet, "사업 범위 (전산 요구사항)"));
        project.setMnPrgCone(multiRowValue(sheet, "추진경과"));
        project.setHrfPlnCone(multiRowValue(sheet, "향후계획"));
        project.setPrlmHrkOgzCCone(labelValue(sheet, "주관부문/본부"));

        applyOptionalFields(sheet, project, exePttCodes, diagnostics);
        applyOrganization(sheet, context, project, diagnostics);
        applyPeople(sheet, context, project, diagnostics);
        applyPeriod(sheet, project, diagnostics);
        applyDelegation(sheet, project, edrtCodes, diagnostics);

        return new Result(project, List.copyOf(diagnostics), declaredYearTotal(sheet));
    }

    private void applyOptionalFields(
            Sheet sheet,
            ProjectDto.CreateRequest project,
            Map<String, String> exePttCodes,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        Map<String, String> values = new LinkedHashMap<>();
        OPTIONAL_FIELDS.forEach((field, label) -> values.put(field, labelValue(sheet, label)));
        values.forEach(
                (field, value) -> {
                    if (value == null || value.isBlank()) {
                        diagnostics.add(
                                RequestFormDto.FormDiagnostic.of(
                                        FormSheetKind.CAPITAL_OVERVIEW,
                                        null,
                                        field,
                                        RequestFormDiagnosticCode.OPTIONAL_MISSING,
                                        "`%s` 항목이 비어 있습니다. 반입 후 사업 상세 화면에서 채울 수 있습니다."
                                                .formatted(OPTIONAL_FIELDS.get(field)),
                                        List.of()));
                    }
                });

        // 공통코드 코드값명을 그대로 저장하는 항목들 (Bprojm 필드 주석 참고)
        project.setBzDttNm(values.get("bzDttNm"));
        project.setBzTpC(values.get("bzTpC"));
        project.setSklTpTc(values.get("sklTpTc"));
        project.setCstTpTc(values.get("cstTpTc"));
        project.setDplYn(FormLexicon.toYn(values.get("dplYn")).filter(v -> hasText(values.get("dplYn"))).orElse(null));
        project.setFlfFsgDt(toYyyyMmDd(values.get("flfFsgDt")));
        project.setRprStsTc(values.get("rprStsTc"));
        project.setExePttYn(exePttCodes.get(values.get("exePttYn")));
    }

    private void applyOrganization(
            Sheet sheet,
            FormAdapterContext context,
            ProjectDto.CreateRequest project,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        String raw = labelValue(sheet, "주관부서/팀");
        if (!hasText(raw)) {
            // 폼에 없으면 폴더명으로 확정한 부서를 쓴다
            project.setSvnDpmC(context.resolvedDeptCode());
            return;
        }
        String[] parts = raw.split("/", 2);
        project.setSvnDpmC(
                resolveOrg(context, parts[0].trim(), "svnDpmC", diagnostics)
                        .orElse(context.resolvedDeptCode()));
        if (parts.length == 2) {
            resolveOrg(context, parts[1].trim(), "svnTemC", diagnostics).ifPresent(project::setSvnTemC);
        }
    }

    private Optional<String> resolveOrg(
            FormAdapterContext context,
            String name,
            String field,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        Optional<String> override = context.override(FormSheetKind.CAPITAL_OVERVIEW, null, field);
        if (override.isPresent()) return override;

        OrgIdentityResolver.Resolution resolution = context.orgIndex().resolveOrg(name);
        if (resolution.code() != null) return Optional.of(resolution.code());

        diagnostics.add(
                RequestFormDto.FormDiagnostic.of(
                        FormSheetKind.CAPITAL_OVERVIEW,
                        null,
                        field,
                        resolution.isAmbiguous()
                                ? RequestFormDiagnosticCode.ORG_AMBIGUOUS
                                : RequestFormDiagnosticCode.ORG_UNRESOLVED,
                        "조직 `%s`를 확정하지 못했습니다.".formatted(name),
                        resolution.candidates()));
        return Optional.empty();
    }

    private void applyPeople(
            Sheet sheet,
            FormAdapterContext context,
            ProjectDto.CreateRequest project,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        String deptHint = project.getSvnDpmC();
        resolveUser(sheet, context, "팀장", "tlrUsid", deptHint, diagnostics).ifPresent(project::setTlrUsid);
        resolveUser(sheet, context, "실무자(정/부)", "usid", deptHint, diagnostics).ifPresent(project::setUsid);
        resolveUser(sheet, context, "IT팀장", "dvmTlrUsid", null, diagnostics).ifPresent(project::setDvmTlrUsid);
        resolveUser(sheet, context, "IT실무자(정/부)", "dvmUsid", null, diagnostics).ifPresent(project::setDvmUsid);
    }

    /**
     * 담당자 칸을 읽어 사번을 해석합니다.
     *
     * <p>`실무자(정/부)`는 `허진성/장준호`처럼 두 사람이 적힙니다. `BPROJM`에 부(뒤) 담당자를 담을 컬럼이 없어 정(앞)만 저장하고 미적재 경고를
     * 남깁니다. 조용히 버리면 나중에 담당자가 왜 한 명뿐인지 아무도 설명하지 못합니다.
     */
    private Optional<String> resolveUser(
            Sheet sheet,
            FormAdapterContext context,
            String label,
            String field,
            String deptHint,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        Optional<String> override = context.override(FormSheetKind.CAPITAL_OVERVIEW, null, field);
        if (override.isPresent()) return override;

        String raw = labelValue(sheet, label);
        if (!hasText(raw)) return Optional.empty();

        String[] parts = raw.split("/");
        if (parts.length > 1) {
            diagnostics.add(
                    RequestFormDto.FormDiagnostic.of(
                            FormSheetKind.CAPITAL_OVERVIEW,
                            null,
                            field,
                            RequestFormDiagnosticCode.SUBSTITUTE_DROPPED,
                            "`%s`의 부담당자 `%s`는 담을 컬럼이 없어 반입하지 않습니다."
                                    .formatted(label, parts[1].trim()),
                            List.of()));
        }
        String primary = parts[0].trim();
        OrgIdentityResolver.Resolution resolution = context.orgIndex().resolveUser(primary, deptHint);
        if (resolution.code() != null) return Optional.of(resolution.code());

        diagnostics.add(
                RequestFormDto.FormDiagnostic.of(
                        FormSheetKind.CAPITAL_OVERVIEW,
                        null,
                        field,
                        resolution.isAmbiguous()
                                ? RequestFormDiagnosticCode.USER_AMBIGUOUS
                                : RequestFormDiagnosticCode.USER_UNRESOLVED,
                        "`%s`의 담당자 `%s`를 확정하지 못했습니다.".formatted(label, primary),
                        resolution.candidates()));
        return Optional.empty();
    }

    private void applyPeriod(
            Sheet sheet,
            ProjectDto.CreateRequest project,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        parseYearMonth(labelValue(sheet, "시작일자 (YY/MM)"), "sttDtm", diagnostics)
                .ifPresent(ym -> project.setSttDtm(ym.atDay(1)));
        parseYearMonth(labelValue(sheet, "종료일자 (YY/MM)"), "endDtm", diagnostics)
                .ifPresent(ym -> project.setEndDtm(ym.atEndOfMonth()));
    }

    private void applyDelegation(
            Sheet sheet,
            ProjectDto.CreateRequest project,
            Map<String, String> edrtCodes,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        String name = labelValue(sheet, "전결권자");
        if (!hasText(name)) return;
        String code = edrtCodes.get(name.trim());
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
                        "전결권자 `%s`에 해당하는 코드를 찾지 못했습니다.".formatted(name),
                        List.of()));
    }

    /** 1-1 요약표의 `'26년도 합계` 기재값을 읽습니다. 대사에만 쓰고 적재하지 않습니다. */
    private BigDecimal declaredYearTotal(Sheet sheet) {
        Optional<Integer> totalRow = scanner.findLabelRow(sheet, LABEL_COLUMNS, "총 계", "총계");
        Optional<Integer> headerRow =
                scanner.findLabelRow(sheet, new int[] {0, 1, 2, 3, 4, 5, 6}, "'26년도 합계", "26년도 합계");
        if (totalRow.isEmpty() || headerRow.isEmpty()) return null;

        for (int colIndex = 0; colIndex <= 15; colIndex++) {
            String header = SheetAnchorScanner.normalize(scanner.text(sheet, headerRow.get(), colIndex));
            if (!header.endsWith("년도합계")) continue;
            String raw = scanner.text(sheet, totalRow.get(), colIndex).replace(",", "").trim();
            if (raw.isEmpty()) return null;
            try {
                return new BigDecimal(raw);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private Optional<YearMonth> parseYearMonth(
            String raw, String field, List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (!hasText(raw)) return Optional.empty();
        java.util.regex.Matcher matcher =
                java.util.regex.Pattern.compile("(\\d{2})\\s*/\\s*(\\d{1,2})").matcher(raw.trim());
        if (!matcher.find()) {
            diagnostics.add(
                    RequestFormDto.FormDiagnostic.of(
                            FormSheetKind.CAPITAL_OVERVIEW,
                            null,
                            field,
                            RequestFormDiagnosticCode.DATE_UNPARSEABLE,
                            "`%s` 표기를 날짜로 해석하지 못했습니다.".formatted(raw),
                            List.of()));
            return Optional.empty();
        }
        int year = 2000 + Integer.parseInt(matcher.group(1));
        int month = Integer.parseInt(matcher.group(2));
        if (month < 1 || month > 12) return Optional.empty();
        return Optional.of(YearMonth.of(year, month));
    }

    /** `26/02`·`2026.02` 같은 표기를 `YYYYMMDD`로 폅니다. 해석 못 하면 null. */
    private String toYyyyMmDd(String raw) {
        if (!hasText(raw)) return null;
        java.util.regex.Matcher matcher =
                java.util.regex.Pattern.compile("(\\d{4})\\D?(\\d{1,2})\\D?(\\d{1,2})?").matcher(raw.trim());
        if (!matcher.find()) return null;
        int year = Integer.parseInt(matcher.group(1));
        int month = Integer.parseInt(matcher.group(2));
        int day = matcher.group(3) == null ? YearMonth.of(year, month).lengthOfMonth() : Integer.parseInt(matcher.group(3));
        return LocalDate.of(year, month, day).format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
    }

    private String labelValue(Sheet sheet, String canonicalLabel) {
        List<String> aliases = FormLexicon.labelAliases(canonicalLabel);
        Optional<Integer> row = scanner.findLabelRow(sheet, LABEL_COLUMNS, aliases.toArray(String[]::new));
        if (row.isEmpty()) return null;
        return scanner.valueRightOf(sheet, row.get(), labelColumnOf(sheet, row.get(), aliases)).orElse(null);
    }

    private String multiRowValue(Sheet sheet, String canonicalLabel) {
        List<String> aliases = FormLexicon.labelAliases(canonicalLabel);
        Optional<Integer> row = scanner.findLabelRow(sheet, LABEL_COLUMNS, aliases.toArray(String[]::new));
        if (row.isEmpty()) return null;
        int labelColumn = labelColumnOf(sheet, row.get(), aliases);
        String joined = scanner.joinedValueRightOf(sheet, row.get(), row.get() + MULTI_ROW_SPAN, labelColumn);
        return joined.isEmpty() ? null : joined;
    }

    private int labelColumnOf(Sheet sheet, int rowIndex, List<String> aliases) {
        for (int colIndex : LABEL_COLUMNS) {
            String text = SheetAnchorScanner.normalize(scanner.text(sheet, rowIndex, colIndex));
            for (String alias : aliases) {
                if (text.equals(SheetAnchorScanner.normalize(alias))) return colIndex;
            }
        }
        return LABEL_COLUMNS[0];
    }

    private String truncate(
            String value, int limit, String field, List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (value == null || value.length() <= limit) return value;
        diagnostics.add(
                RequestFormDto.FormDiagnostic.of(
                        FormSheetKind.CAPITAL_OVERVIEW,
                        null,
                        field,
                        RequestFormDiagnosticCode.LENGTH_EXCEEDED,
                        "`%s` 값이 %d자를 넘습니다(%d자).".formatted(field, limit, value.length()),
                        List.of()));
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static Map<String, String> optionalFields() {
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("bzDttNm", "업무구분");
        fields.put("bzTpC", "사업유형");
        fields.put("sklTpTc", "디지털 기술 유형");
        fields.put("cstTpTc", "주 사용자");
        fields.put("dplYn", "중복 여부");
        fields.put("flfFsgDt", "법규상 완료시기");
        fields.put("rprStsTc", "최종보고");
        fields.put("exePttYn", "추진가능성");
        return Map.copyOf(fields);
    }

    /**
     * 1-1 읽기 결과입니다.
     *
     * @param project 사업 생성 요청 (품목 미포함 — 어댑터가 1-2에서 채웁니다)
     * @param diagnostics 해석 진단
     * @param declaredYearTotal 1-1 요약표의 `'26년도 합계` 기재값. 없으면 null
     */
    public record Result(
            ProjectDto.CreateRequest project,
            List<RequestFormDto.FormDiagnostic> diagnostics,
            BigDecimal declaredYearTotal) {}
}
```

- [ ] **Step 4: 1-1 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*CapitalOverviewReaderTest*"`
Expected: PASS — 11개 테스트 전부 성공.

- [ ] **Step 5: 어댑터 결합 테스트 작성**

```java
package com.kdb.it.domain.migration.request.service.adapter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import com.kdb.it.domain.migration.request.service.WorkbookReader;
import com.kdb.it.domain.migration.request.support.RequestFormFixtures;
import com.kdb.it.domain.migration.request.support.TestIoeIndex;
import com.kdb.it.domain.migration.service.MigrationIoeCatalogReader;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.Sheet;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CapitalProjectFormAdapterTest {

    @Mock private OrgIdentityResolver.Index orgIndex;
    @Mock private MigrationIoeCatalogReader catalogReader;

    private final WorkbookReader reader = new WorkbookReader(10_485_760L, 20, 5000, 0.01d);
    private final SheetAnchorScanner scanner = new SheetAnchorScanner();

    private CapitalProjectFormAdapter adapter() {
        return new CapitalProjectFormAdapter(
                scanner, new CapitalOverviewReader(scanner), new ResourceTableReader(scanner), catalogReader);
    }

    private FormAdapterContext contextOf(byte[] bytes) {
        when(catalogReader.exePttCodeByName()).thenReturn(Map.of());
        when(catalogReader.edrtCapitalCodeByName()).thenReturn(Map.of("수석부행장", "21"));
        when(orgIndex.resolveOrg(any()))
                .thenReturn(new OrgIdentityResolver.Resolution("0210", "자금운용실", List.of(), false));
        when(orgIndex.resolveUser(any(), any()))
                .thenReturn(new OrgIdentityResolver.Resolution("11111111", "담당자", List.of(), false));

        Map<FormSheetKind, Sheet> sheets = reader.classify(reader.open(bytes, "픽스처.xls"));
        return new FormAdapterContext(
                sheets,
                "2026",
                new RequestFormDto.FileEntry("자금운용실/요청서.xls", "자금운용실", null, null, null),
                "0210",
                "자금운용실",
                orgIndex,
                TestIoeIndex.snapshot(),
                Map.of(),
                "12345678");
    }

    @Test
    @DisplayName("1-1과 1-2를 합쳐 사업 1건과 품목 3건을 만든다")
    void combinesOverviewAndResourceSheets() {
        FormAdapterOutput output = adapter().adapt(contextOf(RequestFormFixtures.fullFormXls()));

        assertThat(output.projects()).hasSize(1);
        ProjectDto.CreateRequest project = output.projects().get(0);
        assertThat(project.getAbusNm()).isEqualTo("국채전문유통시장 접속인프라 도입");
        // 자본예산 블록 2건 + 일반관리비 블록 1건
        assertThat(project.getItems()).hasSize(3);
        assertThat(project.getItems())
                .extracting(ProjectDto.BitemmDto::getSno)
                .containsExactly(1, 2, 3);
    }

    @Test
    @DisplayName("일반관리비 블록의 품목도 같은 사업의 BITEMM으로 담는다")
    void putsGeneralExpenseItemsIntoSameProject() {
        ProjectDto.CreateRequest project =
                adapter().adapt(contextOf(RequestFormFixtures.fullFormXls())).projects().get(0);

        assertThat(project.getItems())
                .extracting(ProjectDto.BitemmDto::getGclNm)
                .contains("전용망 회선 이용료");
    }

    @Test
    @DisplayName("자본예산 품목은 국내 원화 기준으로 비목을 정한다")
    void resolvesCapitalItemIoe() {
        ProjectDto.CreateRequest project =
                adapter().adapt(contextOf(RequestFormFixtures.fullFormXls())).projects().get(0);

        assertThat(project.getItems().get(0).getIoeC()).isEqualTo("106");
        assertThat(project.getItems().get(1).getIoeC()).isEqualTo("101");
    }

    @Test
    @DisplayName("1-1 요약표와 1-2 합계가 배수로 맞으면 불일치 경고를 내지 않는다")
    void staysQuietWhenTotalsReconcile() {
        FormAdapterOutput output = adapter().adapt(contextOf(RequestFormFixtures.capitalOnlyXlsx()));

        assertThat(output.diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .doesNotContain(RequestFormDiagnosticCode.AMOUNT_MISMATCH);
    }

    @Test
    @DisplayName("시트 1-1이 없으면 빈 결과를 돌려준다")
    void returnsEmptyWhenOverviewAbsent() {
        Map<FormSheetKind, Sheet> sheets =
                reader.classify(reader.open(RequestFormFixtures.englishFormXls(), "런던.xls"));
        FormAdapterContext context =
                new FormAdapterContext(
                        sheets, "2026",
                        new RequestFormDto.FileEntry("런던지점/붙임.xls", "런던지점", null, null, null),
                        "0930", "런던지점", orgIndex, TestIoeIndex.snapshot(), Map.of(), "12345678");

        assertThat(adapter().adapt(context).projects()).isEmpty();
    }
}
```

- [ ] **Step 6: `CapitalProjectFormAdapter` 작성**

```java
package com.kdb.it.domain.migration.request.service.adapter;

import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.AmountUnitResolver;
import com.kdb.it.domain.migration.request.service.IoeHierarchyIndex;
import com.kdb.it.domain.migration.request.service.SheetAnchorScanner;
import com.kdb.it.domain.migration.service.MigrationIoeCatalogReader;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Sheet;
import org.springframework.stereotype.Component;

/**
 * 시트 ① 1-1·1-2를 합쳐 정보화사업 생성 요청을 만듭니다.
 *
 * <p>두 시트가 같은 사업의 머리와 몸통이라 어댑터 하나가 둘을 함께 읽습니다. 1-2는 자본예산 블록과 일반관리비 블록이 위아래로 놓여 있어 소요자원 리더를 두 번
 * 호출하고, 두 블록의 품목을 **같은 사업의 `BITEMM`**으로 담습니다 — 양식 주석("정보화사업에 포함된 일반관리비는 1-1·1-2 시트에 작성")과 실측
 * `BITEMM`에 일반관리비 비목이 들어 있는 사실이 이를 뒷받침합니다.
 *
 * <p>금액은 1-2가 원본입니다. 1-1 요약표는 단위가 부점마다 달라 적재하지 않고, 배수를 역추정해 대사만 합니다.
 */
@Component
@RequiredArgsConstructor
public class CapitalProjectFormAdapter implements FormSheetAdapter {

    private final SheetAnchorScanner scanner;
    private final CapitalOverviewReader overviewReader;
    private final ResourceTableReader resourceTableReader;
    private final MigrationIoeCatalogReader catalogReader;

    @Override
    public FormSheetKind trigger() {
        return FormSheetKind.CAPITAL_OVERVIEW;
    }

    @Override
    public FormAdapterOutput adapt(FormAdapterContext context) {
        Sheet overview = context.sheets().get(FormSheetKind.CAPITAL_OVERVIEW);
        if (overview == null) return FormAdapterOutput.empty();

        CapitalOverviewReader.Result read =
                overviewReader.read(
                        overview,
                        context,
                        catalogReader.exePttCodeByName(),
                        catalogReader.edrtCapitalCodeByName());
        ProjectDto.CreateRequest project = read.project();
        if (project.getAbusNm() == null || project.getAbusNm().isBlank()) {
            // 1-1 시트가 빈 껍데기인 파일(경상사업·일반관리비만 낸 부점)이라 진단 없이 건너뛴다
            return FormAdapterOutput.empty();
        }

        List<RequestFormDto.FormDiagnostic> diagnostics = new ArrayList<>(read.diagnostics());
        List<ProjectDto.BitemmDto> items = readItems(context, diagnostics);
        project.setItems(items);

        reconcileTotals(read.declaredYearTotal(), items, diagnostics);

        return new FormAdapterOutput(List.of(project), List.of(), List.copyOf(diagnostics), null);
    }

    /** 1-2의 자본예산·일반관리비 두 블록을 순서대로 읽어 품목 목록을 만듭니다. */
    private List<ProjectDto.BitemmDto> readItems(
            FormAdapterContext context, List<RequestFormDto.FormDiagnostic> diagnostics) {
        Sheet resource = context.sheets().get(FormSheetKind.CAPITAL_RESOURCE);
        List<ProjectDto.BitemmDto> items = new ArrayList<>();
        if (resource == null) return items;

        int sno = 1;
        Optional<ResourceTableReader.Result> capital = resourceTableReader.read(resource, 0, false);
        if (capital.isPresent()) {
            for (ResourceRow row : capital.get().rows()) {
                items.add(toItem(row, context, sno++, diagnostics));
            }
        }
        int nextFrom = capital.map(result -> result.headerRow() + 1).orElse(0);
        Optional<ResourceTableReader.Result> general =
                resourceTableReader.read(resource, nextFrom, true);
        if (general.isPresent()) {
            for (ResourceRow row : general.get().rows()) {
                items.add(toItem(row, context, sno++, diagnostics));
            }
        }
        return items;
    }

    private ProjectDto.BitemmDto toItem(
            ResourceRow row,
            FormAdapterContext context,
            int sno,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        Optional<String> override =
                context.override(FormSheetKind.CAPITAL_RESOURCE, row.excelRow(), "ioeC");
        String ioeCode = null;
        if (override.isPresent() && context.ioeIndex().exists(override.get())) {
            ioeCode = override.get();
        } else {
            boolean domestic = "KRW".equalsIgnoreCase(row.currency());
            IoeHierarchyIndex.Resolution resolution =
                    context.ioeIndex().resolveByGroup(row.group(), domestic);
            ioeCode = resolution.code();
            if (ioeCode == null) {
                diagnostics.add(
                        RequestFormDto.FormDiagnostic.of(
                                FormSheetKind.CAPITAL_RESOURCE,
                                row.excelRow(),
                                "ioeC",
                                resolution.isAmbiguous()
                                        ? RequestFormDiagnosticCode.CODE_AMBIGUOUS
                                        : RequestFormDiagnosticCode.CODE_UNRESOLVED,
                                "품목 구분 `%s`의 비목을 정하지 못했습니다.".formatted(row.group()),
                                resolution.candidates()));
            } else if (!resolution.candidates().isEmpty()) {
                diagnostics.add(
                        RequestFormDto.FormDiagnostic.of(
                                FormSheetKind.CAPITAL_RESOURCE,
                                row.excelRow(),
                                "ioeC",
                                RequestFormDiagnosticCode.CODE_AMBIGUOUS,
                                "품목 구분 `%s`는 `%s`로 기본 설정했습니다. 다른 비목이면 골라 주세요."
                                        .formatted(row.group(), ioeCode),
                                resolution.candidates()));
            }
        }
        return ResourceTableReader.toItem(row, ioeCode, sno, context.bseYy());
    }

    /**
     * 1-1 요약표와 1-2 품목 합계를 대사합니다.
     *
     * <p>어느 배수로도 맞지 않으면 단위 문제가 아니라 기재 오류이므로 경고를 냅니다. 요약표를 읽지 못했으면 대사할 수 없어 조용히 넘어갑니다 — 요약표는
     * 적재 대상이 아니라 검증 근거일 뿐입니다.
     */
    private void reconcileTotals(
            BigDecimal declaredYearTotal,
            List<ProjectDto.BitemmDto> items,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (declaredYearTotal == null || items.isEmpty()) return;

        BigDecimal actual = BigDecimal.ZERO;
        for (ProjectDto.BitemmDto item : items) {
            if (item.getAmt() != null) actual = actual.add(item.getAmt());
        }
        if (actual.signum() == 0) return;

        if (AmountUnitResolver.inferMultiplier(declaredYearTotal, actual).isEmpty()) {
            diagnostics.add(
                    RequestFormDto.FormDiagnostic.of(
                            FormSheetKind.CAPITAL_OVERVIEW,
                            null,
                            "declaredYearTotal",
                            RequestFormDiagnosticCode.AMOUNT_MISMATCH,
                            "1-1 요약표의 합계(%s)와 1-2 품목 합계(%s)가 어느 단위로도 맞지 않습니다."
                                    .formatted(declaredYearTotal.toPlainString(), actual.toPlainString()),
                            List.of()));
        }
    }
}
```

- [ ] **Step 7: 어댑터 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*CapitalProjectFormAdapterTest*"`
Expected: PASS — 5개 테스트 전부 성공.

`combinesOverviewAndResourceSheets`에서 품목 수가 2건으로 나오면 두 번째 블록 탐색 시작 행(`nextFrom`)이 첫 블록의 데이터 행을 건너뛰지 못한 것이다. `ResourceTableReader.Result.headerRow()`를 쓰고 있는지 확인한다.

- [ ] **Step 8: 포맷 검사와 커밋**

Run: `cd it_backend && ./gradlew spotlessApply spotlessCheck test --tests "*request*"`
Expected: BUILD SUCCESSFUL.

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/adapter src/test/java/com/kdb/it/domain/migration/request/service/adapter
git -C it_backend commit -m "feat(migration): 정보화사업 시트 어댑터

1-1과 1-2는 같은 사업의 머리와 몸통이라 어댑터 하나가 둘을 함께 읽는다.
1-2의 자본예산·일반관리비 두 블록 품목을 모두 같은 사업의 BITEMM으로 담는다.
양식 주석과 실측 BITEMM에 일반관리비 비목이 들어 있는 사실이 근거다.

상단의 확인자·작성자는 쓰지 않는다. 실측 파일에서 확인자(허인선 팀장)와
관련 조직의 팀장(윤소정)이 달랐다. 제출 담당자와 사업 주관자가 다른 경우라
관련 조직 블록만 정본으로 삼는다.

실무자(정/부)는 BPROJM에 부담당자를 담을 컬럼이 없어 정만 저장하고 미적재
경고를 남긴다. 조용히 버리면 담당자가 왜 한 명인지 나중에 설명할 수 없다.

1-1 요약표는 단위가 부점마다 달라 적재하지 않고 1-2 합계와 배수 대사만 한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: 횡단 검증기

조립된 생성 요청을 놓고 필수값·길이·자연키 중복을 본다. 어댑터가 못 보는 것들(DB 상태, 요청 전체)만 여기서 본다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormValidator.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormValidatorTest.java`

**Interfaces:**
- Consumes: `FormAdapterOutput` (Task 7), `RequestFormDto`, `RequestFormDiagnosticCode`, `CostRepository`, `ProjectRepository`
- Produces:
  - `class RequestFormValidator` (`@Component`)
    - `List<RequestFormDto.FormDiagnostic> validate(FormAdapterOutput output, String bseYy)`
    - `static boolean hasBlocker(List<RequestFormDto.FormDiagnostic> diagnostics)`
    - `static String normalizeProjectName(String name)` — 공백 전부 제거, 자연키 비교용

- [ ] **Step 1: 중복 판정용 리포지토리 메서드 확인**

Run: `cd it_backend && grep -nE "boolean exists|List<Bcostm> findBy|Optional<Bcostm>" src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java`

`BPROJM`은 `existsByAbusMngNoAndDelYn`만 있고 사업명 기준 조회가 없다. `BCOSTM`도 자연키 조회가 없을 가능성이 높다. 없으면 두 리포지토리에 **조회 메서드만** 추가한다(기존 메서드는 건드리지 않는다).

`ProjectRepository`:

```java
    /**
     * 예산연도 안에서 사업명이 같은 활성 사업이 있는지 확인합니다.
     *
     * <p>편성요청서 반입의 재업로드 거부에 씁니다. 사업명은 공백을 제거해 비교하므로 호출자가 정규화한 값을 넘깁니다.
     *
     * @param bseYy 예산연도 4자리
     * @return 그 연도의 활성 사업명 목록 (정규화 전 원문)
     */
    @Query(
            "select p.abusNm from Bprojm p"
                    + " where p.bseYy = :bseYy and p.lstYn = 'Y' and p.delYn = 'N'")
    List<String> findActiveProjectNames(@Param("bseYy") String bseYy);
```

`CostRepository`:

```java
    /**
     * 예산연도 안의 활성 전산업무비 자연키를 모아 옵니다.
     *
     * <p>편성요청서 반입의 재업로드 거부에 씁니다. 부점별 제출이라 같은 계약명이 여러 부점에 나올 수 있어 부서코드가 키에 들어갑니다.
     *
     * @param bseYy 예산연도 4자리
     * @return `부서코드|비목코드|상대처|계약명` 형태의 키 목록
     */
    @Query(
            "select concat(coalesce(c.svnDpmC, ''), '|', coalesce(c.ioeC, ''), '|',"
                    + " coalesce(c.cttOppNm, ''), '|', coalesce(c.cttNm, '')) from Bcostm c"
                    + " where c.bseYy = :bseYy and c.lstYn = 'Y' and c.delYn = 'N'")
    List<String> findActiveNaturalKeys(@Param("bseYy") String bseYy);
```

- [ ] **Step 2: 실패 테스트 작성**

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.cost.repository.CostRepository;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RequestFormValidatorTest {

    @Mock private CostRepository costRepository;
    @Mock private ProjectRepository projectRepository;

    private RequestFormValidator validator() {
        return new RequestFormValidator(costRepository, projectRepository);
    }

    private static CostDto.CreateRequest cost(String ioeC, String cttNm, BigDecimal amount) {
        CostDto.CreateRequest request = new CostDto.CreateRequest();
        request.setIoeC(ioeC);
        request.setCttNm(cttNm);
        request.setCttOppNm("Bloomberg");
        request.setCostSvnDpmC("0210");
        request.setCurC("KRW");
        request.setCostTotXpAmt(amount);
        return request;
    }

    private static ProjectDto.CreateRequest project(String name) {
        ProjectDto.CreateRequest request = new ProjectDto.CreateRequest();
        request.setAbusNm(name);
        request.setItems(List.of());
        return request;
    }

    @Test
    @DisplayName("비목코드가 비면 필수값 누락으로 막는다")
    void blocksMissingIoeCode() {
        FormAdapterOutput output =
                new FormAdapterOutput(
                        List.of(), List.of(cost(null, "회선사용료", new BigDecimal("1000"))), List.of(), null);

        assertThat(validator().validate(output, "2026"))
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(RequestFormDiagnosticCode.REQUIRED_MISSING);
    }

    @Test
    @DisplayName("계약명이 100자를 넘으면 길이 초과로 막는다")
    void blocksOverlongContractName() {
        FormAdapterOutput output =
                new FormAdapterOutput(
                        List.of(),
                        List.of(cost("010", "가".repeat(101), new BigDecimal("1000"))),
                        List.of(),
                        null);

        assertThat(validator().validate(output, "2026"))
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(RequestFormDiagnosticCode.LENGTH_EXCEEDED);
    }

    @Test
    @DisplayName("이미 있는 전산업무비 자연키면 재업로드로 보아 막는다")
    void blocksDuplicateCost() {
        when(costRepository.findActiveNaturalKeys("2026"))
                .thenReturn(List.of("0210|010|Bloomberg|블룸버그 회선사용료"));
        FormAdapterOutput output =
                new FormAdapterOutput(
                        List.of(),
                        List.of(cost("010", "블룸버그 회선사용료", new BigDecimal("1000"))),
                        List.of(),
                        null);

        assertThat(validator().validate(output, "2026"))
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(RequestFormDiagnosticCode.DUPLICATE_EXISTS);
    }

    @Test
    @DisplayName("사업명은 공백을 무시하고 중복을 판정한다")
    void blocksDuplicateProjectIgnoringWhitespace() {
        when(projectRepository.findActiveProjectNames("2026"))
                .thenReturn(List.of("국채전문유통시장  접속인프라 도입"));
        FormAdapterOutput output =
                new FormAdapterOutput(
                        List.of(project("국채전문유통시장 접속인프라 도입")), List.of(), List.of(), null);

        assertThat(validator().validate(output, "2026"))
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(RequestFormDiagnosticCode.DUPLICATE_EXISTS);
    }

    @Test
    @DisplayName("같은 배치 안에서 사업명이 겹쳐도 막는다")
    void blocksDuplicateWithinSameBatch() {
        FormAdapterOutput output =
                new FormAdapterOutput(
                        List.of(project("같은 사업"), project("같은 사업")), List.of(), List.of(), null);

        assertThat(validator().validate(output, "2026"))
                .filteredOn(d -> d.code() == RequestFormDiagnosticCode.DUPLICATE_EXISTS)
                .hasSize(1);
    }

    @Test
    @DisplayName("문제가 없으면 진단을 내지 않는다")
    void staysQuietWhenValid() {
        assertThat(
                        validator()
                                .validate(
                                        new FormAdapterOutput(
                                                List.of(project("새 사업")),
                                                List.of(cost("010", "새 계약", new BigDecimal("1000"))),
                                                List.of(),
                                                null),
                                        "2026"))
                .isEmpty();
    }

    @Test
    @DisplayName("BLOCKER 판정은 심각도로만 한다")
    void detectsBlockerBySeverity() {
        List<RequestFormDto.FormDiagnostic> onlyWarnings =
                List.of(
                        RequestFormDto.FormDiagnostic.of(
                                null, null, "x", RequestFormDiagnosticCode.OPTIONAL_MISSING, "경고", List.of()));
        List<RequestFormDto.FormDiagnostic> withBlocker =
                List.of(
                        RequestFormDto.FormDiagnostic.of(
                                null, null, "x", RequestFormDiagnosticCode.CODE_UNRESOLVED, "차단", List.of()));

        assertThat(RequestFormValidator.hasBlocker(onlyWarnings)).isFalse();
        assertThat(RequestFormValidator.hasBlocker(withBlocker)).isTrue();
    }
}
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormValidatorTest*"`
Expected: FAIL — `RequestFormValidator` 없음.

- [ ] **Step 4: `RequestFormValidator` 작성**

```java
package com.kdb.it.domain.migration.request.service;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.cost.repository.CostRepository;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 조립된 생성 요청을 놓고 횡단 검증을 합니다.
 *
 * <p>어댑터는 셀 좌표를 아는 대신 DB 상태나 배치 전체를 보지 못합니다. 그래서 해석 실패 진단은 어댑터가 내고, 필수값·물리 길이·자연키 중복처럼 조립 결과를
 * 놓고 봐야 하는 것만 여기서 봅니다.
 *
 * <p>dry-run과 commit이 같은 검증기를 씁니다. 서버가 dry-run 결과를 보관하지 않으므로 commit이 클라이언트가 보낸 값을 신뢰하지 않고 전부 다시
 * 검증합니다.
 */
@Component
@RequiredArgsConstructor
public class RequestFormValidator {

    /** 물리 컬럼 길이 상한. 엔티티 `@Column(length=…)`과 같은 값입니다. */
    private static final int CONTRACT_NAME_LIMIT = 100;

    private static final int COUNTERPARTY_LIMIT = 100;
    private static final int INCREASE_REASON_LIMIT = 200;
    private static final int PROJECT_NAME_LIMIT = 100;
    private static final int ITEM_NAME_LIMIT = 100;

    private final CostRepository costRepository;
    private final ProjectRepository projectRepository;

    /**
     * 생성 요청 전체를 검증합니다.
     *
     * @param output 어댑터가 조립한 생성 요청
     * @param bseYy 예산연도 4자리
     * @return 추가 진단 목록. 문제가 없으면 빈 목록
     */
    @Transactional(readOnly = true)
    public List<RequestFormDto.FormDiagnostic> validate(FormAdapterOutput output, String bseYy) {
        List<RequestFormDto.FormDiagnostic> diagnostics = new ArrayList<>();
        validateCosts(output.costs(), bseYy, diagnostics);
        validateProjects(output.projects(), bseYy, diagnostics);
        return List.copyOf(diagnostics);
    }

    private void validateCosts(
            List<CostDto.CreateRequest> costs,
            String bseYy,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (costs.isEmpty()) return;
        Set<String> existing = new HashSet<>(costRepository.findActiveNaturalKeys(bseYy));
        Set<String> withinBatch = new HashSet<>();

        for (CostDto.CreateRequest cost : costs) {
            requireText(cost.getIoeC(), FormSheetKind.GENERAL_EXPENSE, "ioeC", "비목코드", diagnostics);
            requireText(cost.getCttNm(), FormSheetKind.GENERAL_EXPENSE, "cttNm", "계약명", diagnostics);
            requireText(cost.getCurC(), FormSheetKind.GENERAL_EXPENSE, "curC", "통화", diagnostics);
            if (cost.getCostTotXpAmt() == null && cost.getFcAmt() == null) {
                diagnostics.add(
                        blocker(
                                FormSheetKind.GENERAL_EXPENSE,
                                "amt",
                                RequestFormDiagnosticCode.REQUIRED_MISSING,
                                "`%s`의 금액이 비어 있습니다.".formatted(nullSafe(cost.getCttNm()))));
            }
            limit(cost.getCttNm(), CONTRACT_NAME_LIMIT, FormSheetKind.GENERAL_EXPENSE, "cttNm", diagnostics);
            limit(cost.getCttOppNm(), COUNTERPARTY_LIMIT, FormSheetKind.GENERAL_EXPENSE, "cttOppNm", diagnostics);
            limit(cost.getIndRsn(), INCREASE_REASON_LIMIT, FormSheetKind.GENERAL_EXPENSE, "indRsn", diagnostics);

            String key = costNaturalKey(cost);
            if (existing.contains(key) || !withinBatch.add(key)) {
                diagnostics.add(
                        blocker(
                                FormSheetKind.GENERAL_EXPENSE,
                                "cttNm",
                                RequestFormDiagnosticCode.DUPLICATE_EXISTS,
                                "`%s`는 이미 반입된 전산업무비입니다. 덮어쓰지 않고 건너뜁니다."
                                        .formatted(nullSafe(cost.getCttNm()))));
            }
        }
    }

    private void validateProjects(
            List<ProjectDto.CreateRequest> projects,
            String bseYy,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (projects.isEmpty()) return;
        Set<String> existing = new HashSet<>();
        for (String name : projectRepository.findActiveProjectNames(bseYy)) {
            existing.add(normalizeProjectName(name));
        }
        Set<String> withinBatch = new HashSet<>();

        for (ProjectDto.CreateRequest project : projects) {
            FormSheetKind sheet =
                    "Y".equals(project.getOdnYn()) ? FormSheetKind.RECURRING : FormSheetKind.CAPITAL_OVERVIEW;
            requireText(project.getAbusNm(), sheet, "abusNm", "사업명", diagnostics);
            limit(project.getAbusNm(), PROJECT_NAME_LIMIT, sheet, "abusNm", diagnostics);

            if (project.getItems() != null) {
                for (ProjectDto.BitemmDto item : project.getItems()) {
                    requireText(item.getIoeC(), sheet, "ioeC", "품목 비목코드", diagnostics);
                    limit(item.getGclNm(), ITEM_NAME_LIMIT, sheet, "gclNm", diagnostics);
                    if (item.getAmt() == null && item.getFcAmt() == null) {
                        diagnostics.add(
                                blocker(
                                        sheet,
                                        "amt",
                                        RequestFormDiagnosticCode.REQUIRED_MISSING,
                                        "품목 `%s`의 금액이 비어 있습니다.".formatted(nullSafe(item.getGclNm()))));
                    }
                }
            }

            String key = normalizeProjectName(project.getAbusNm());
            if (key.isEmpty()) continue;
            if (existing.contains(key) || !withinBatch.add(key)) {
                diagnostics.add(
                        blocker(
                                sheet,
                                "abusNm",
                                RequestFormDiagnosticCode.DUPLICATE_EXISTS,
                                "`%s`는 이미 반입된 사업입니다. 덮어쓰지 않고 건너뜁니다."
                                        .formatted(nullSafe(project.getAbusNm()))));
            }
        }
    }

    /**
     * BLOCKER가 하나라도 있는지 판정합니다.
     *
     * @param diagnostics 진단 목록
     * @return BLOCKER가 있으면 true
     */
    public static boolean hasBlocker(List<RequestFormDto.FormDiagnostic> diagnostics) {
        return diagnostics.stream().anyMatch(d -> d.severity() == MigrationDto.Severity.BLOCKER);
    }

    /**
     * 사업명을 자연키 비교용으로 정규화합니다. 공백을 전부 제거합니다.
     *
     * @param name 사업명. null이면 빈 문자열
     * @return 정규화된 사업명
     */
    public static String normalizeProjectName(String name) {
        return name == null ? "" : name.replaceAll("[\\s\\u00A0\\u3000]+", "");
    }

    private static String costNaturalKey(CostDto.CreateRequest cost) {
        return String.join(
                "|",
                nullSafe(cost.getCostSvnDpmC()),
                nullSafe(cost.getIoeC()),
                nullSafe(cost.getCttOppNm()),
                nullSafe(cost.getCttNm()));
    }

    private void requireText(
            String value,
            FormSheetKind sheet,
            String field,
            String label,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (value != null && !value.isBlank()) return;
        diagnostics.add(
                blocker(sheet, field, RequestFormDiagnosticCode.REQUIRED_MISSING, "`%s`이(가) 비어 있습니다.".formatted(label)));
    }

    private void limit(
            String value,
            int max,
            FormSheetKind sheet,
            String field,
            List<RequestFormDto.FormDiagnostic> diagnostics) {
        if (value == null || value.length() <= max) return;
        diagnostics.add(
                blocker(
                        sheet,
                        field,
                        RequestFormDiagnosticCode.LENGTH_EXCEEDED,
                        "`%s` 값이 %d자를 넘습니다(%d자).".formatted(field, max, value.length())));
    }

    private RequestFormDto.FormDiagnostic blocker(
            FormSheetKind sheet, String field, RequestFormDiagnosticCode code, String message) {
        return RequestFormDto.FormDiagnostic.of(sheet, null, field, code, message, List.of());
    }

    private static String nullSafe(String value) {
        return value == null ? "" : value;
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormValidatorTest*"`
Expected: PASS — 7개 테스트 전부 성공.

- [ ] **Step 6: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/RequestFormValidator.java src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormValidatorTest.java
git -C it_backend commit -m "feat(migration): 편성요청서 횡단 검증기

어댑터는 셀 좌표를 알지만 DB 상태와 배치 전체를 보지 못한다. 필수값·물리 길이·
자연키 중복처럼 조립 결과를 놓고 봐야 하는 것만 검증기가 본다.

전산업무비 자연키에 부서코드를 넣는다. 부점별 제출이라 같은 계약명이 여러
부점에 나올 수 있고, 이 양식에는 기존 이관이 쓰던 사업코드 열이 없다.
사업명은 공백을 제거해 비교한다. 같은 배치 안의 중복도 함께 막는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: 파일 단위 반영

파일 1건을 `REQUIRES_NEW` 트랜잭션에서 반영한다. 이 태스크가 "정상 파일만 반영"의 실제 구현이다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporterTest.java`

**Interfaces:**
- Consumes: `RequestFormValidator` (Task 10), `FormAdapterOutput` (Task 7), `CostService.createCost(request, true)`, `ProjectService.createProject(request, true)`, `MigrationApprovalStamper.stamp(fntTbNm, pkColNm, fntTbCrySno, title, actorEno, bseYy)`
- Produces:
  - `class RequestFormFileImporter` (`@Component`)
    - `RequestFormDto.FileResult apply(FormAdapterOutput output, RequestFormDto.FileEntry entry, String bseYy, String actorEno)` — `@Transactional(propagation = REQUIRES_NEW)`
    - `RequestFormDto.FileResult preview(FormAdapterOutput output, RequestFormDto.FileEntry entry, String bseYy)` — 쓰기 없음

- [ ] **Step 1: 실패 테스트 작성**

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.cost.service.CostService;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.budget.project.service.ProjectService;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput;
import com.kdb.it.domain.migration.service.MigrationApprovalStamper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RequestFormFileImporterTest {

    @Mock private CostService costService;
    @Mock private ProjectService projectService;
    @Mock private MigrationApprovalStamper stamper;
    @Mock private RequestFormValidator validator;

    private RequestFormFileImporter importer() {
        return new RequestFormFileImporter(costService, projectService, stamper, validator);
    }

    private static final RequestFormDto.FileEntry ENTRY =
            new RequestFormDto.FileEntry("자금운용실/요청서.xls", "자금운용실", null, 1L, "571");

    private static FormAdapterOutput outputWithOneOfEach() {
        CostDto.CreateRequest cost = new CostDto.CreateRequest();
        cost.setCttNm("블룸버그 회선사용료");
        cost.setCostTotXpAmt(new BigDecimal("1000"));
        ProjectDto.CreateRequest project = new ProjectDto.CreateRequest();
        project.setAbusNm("국채전문유통시장 접속인프라 도입");
        project.setItems(List.of());
        return new FormAdapterOutput(List.of(project), List.of(cost), List.of(), null);
    }

    @Test
    @DisplayName("기간 검증을 생략하는 오버로드로 원장을 만든다")
    void createsLedgerWithPeriodValidationSkipped() {
        when(validator.validate(any(), anyString())).thenReturn(List.of());
        when(projectService.createProject(any(), anyBoolean())).thenReturn("PRJ-2026-0001");
        when(costService.createCost(any(), anyBoolean())).thenReturn("COST-2026-0001");

        RequestFormDto.FileResult result =
                importer().apply(outputWithOneOfEach(), ENTRY, "2026", "12345678");

        verify(projectService).createProject(any(), eq(true));
        verify(costService).createCost(any(), eq(true));
        assertThat(result.status()).isEqualTo(RequestFormDto.FileStatus.APPLIED);
        assertThat(result.created())
                .extracting(RequestFormDto.CreatedRecord::key)
                .containsExactlyInAnyOrder("PRJ-2026-0001", "COST-2026-0001");
    }

    @Test
    @DisplayName("생성한 원장마다 이관용 결재완료 받이를 만든다")
    void stampsApprovalForEachLedger() {
        when(validator.validate(any(), anyString())).thenReturn(List.of());
        when(projectService.createProject(any(), anyBoolean())).thenReturn("PRJ-2026-0001");
        when(costService.createCost(any(), anyBoolean())).thenReturn("COST-2026-0001");

        importer().apply(outputWithOneOfEach(), ENTRY, "2026", "12345678");

        verify(stamper).stamp(eq("BPROJM"), eq("PRJ-2026-0001"), anyInt(), anyString(), eq("12345678"), eq("2026"));
        verify(stamper).stamp(eq("BCOSTM"), eq("COST-2026-0001"), anyInt(), anyString(), eq("12345678"), eq("2026"));
    }

    @Test
    @DisplayName("BLOCKER가 남으면 아무것도 쓰지 않고 차단 상태로 돌려준다")
    void writesNothingWhenBlockerRemains() {
        when(validator.validate(any(), anyString()))
                .thenReturn(
                        List.of(
                                RequestFormDto.FormDiagnostic.of(
                                        null, null, "ioeC", RequestFormDiagnosticCode.CODE_UNRESOLVED, "비목 미해석", List.of())));

        RequestFormDto.FileResult result =
                importer().apply(outputWithOneOfEach(), ENTRY, "2026", "12345678");

        assertThat(result.status()).isEqualTo(RequestFormDto.FileStatus.BLOCKED);
        assertThat(result.created()).isEmpty();
        verify(projectService, never()).createProject(any(), anyBoolean());
        verify(costService, never()).createCost(any(), anyBoolean());
        verify(stamper, never()).stamp(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("어댑터 진단과 검증기 진단을 합쳐 돌려준다")
    void mergesAdapterAndValidatorDiagnostics() {
        FormAdapterOutput output =
                new FormAdapterOutput(
                        List.of(),
                        List.of(),
                        List.of(
                                RequestFormDto.FormDiagnostic.of(
                                        null, null, "bzDttNm", RequestFormDiagnosticCode.OPTIONAL_MISSING, "공란", List.of())),
                        1L);
        when(validator.validate(any(), anyString()))
                .thenReturn(
                        List.of(
                                RequestFormDto.FormDiagnostic.of(
                                        null, null, "abusNm", RequestFormDiagnosticCode.REQUIRED_MISSING, "필수", List.of())));

        RequestFormDto.FileResult result = importer().preview(output, ENTRY, "2026");

        assertThat(result.diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .containsExactlyInAnyOrder(
                        RequestFormDiagnosticCode.OPTIONAL_MISSING, RequestFormDiagnosticCode.REQUIRED_MISSING);
        assertThat(result.suggestedGeneralExpenseMultiplier()).isEqualTo(1L);
    }

    @Test
    @DisplayName("사전검증은 원장을 만들지 않는다")
    void previewWritesNothing() {
        when(validator.validate(any(), anyString())).thenReturn(List.of());

        RequestFormDto.FileResult result = importer().preview(outputWithOneOfEach(), ENTRY, "2026");

        assertThat(result.status()).isEqualTo(RequestFormDto.FileStatus.APPLIED);
        assertThat(result.created()).isEmpty();
        verify(projectService, never()).createProject(any(), anyBoolean());
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormFileImporterTest*"`
Expected: FAIL — `RequestFormFileImporter` 없음.

- [ ] **Step 3: `RequestFormFileImporter` 작성**

```java
package com.kdb.it.domain.migration.request.service;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.cost.service.CostService;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.budget.project.service.ProjectService;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput;
import com.kdb.it.domain.migration.service.MigrationApprovalStamper;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 편성요청서 파일 1건을 반영합니다.
 *
 * <p>이 클래스가 **반영의 원자 단위**입니다. `REQUIRES_NEW`로 파일마다 독립 트랜잭션을 열어, 한 파일이 실패해도 같은 배치의 다른 파일은 커밋되게
 * 합니다. 오케스트레이터에 트랜잭션을 걸면 이 경계가 무의미해지므로 {@code RequestFormImportService}는 트랜잭션을 열지 않습니다.
 *
 * <p>원장은 기존 서비스의 이관 전용 오버로드로 만듭니다. 이관은 편성 시즌 밖에서도 실행되어야 해 기간 검증을 건너뛰지만, 채번·조직명 스냅샷·감사로그는 그대로
 * 타야 하므로 새 INSERT 경로를 만들지 않습니다.
 *
 * <p>편성행({@code BBUGTM})은 만들지 않습니다. {@code BudgetRateApplicationService.applyItemRates}가 연도 전량을
 * 논리삭제한 뒤 재삽입하는 구조라, 파일마다 부르면 앞서 반입한 편성행이 전부 사라집니다. 편성은 반입을 마친 뒤 예산작업 화면에서 한 번에 적용합니다.
 */
@Component
@RequiredArgsConstructor
public class RequestFormFileImporter {

    /** 이관 결재 받이의 제목 접두어. 정상 결재와 구분되도록 제목에 이관임을 남깁니다. */
    private static final String APPROVAL_TITLE_PREFIX = "[편성요청서 반입]";

    private final CostService costService;
    private final ProjectService projectService;
    private final MigrationApprovalStamper approvalStamper;
    private final RequestFormValidator validator;

    /**
     * 파일 1건을 원장에 반영합니다.
     *
     * <p>독립 트랜잭션에서 실행됩니다. BLOCKER가 남으면 아무것도 쓰지 않고 차단 상태로 돌려줍니다 — 예외를 던지지 않는 이유는 배치의 나머지 파일을 계속
     * 처리해야 하고, 예외로 알리면 호출자가 정상 흐름과 오류 흐름을 뒤섞어 다뤄야 하기 때문입니다.
     *
     * @param output 어댑터가 조립한 생성 요청
     * @param entry 파일별 부가 정보
     * @param bseYy 예산연도 4자리
     * @param actorEno 업로드 사용자 사번
     * @return 파일 처리 결과
     * @throws org.springframework.dao.DataAccessException 원장 저장이 DB 수준에서 실패한 경우. 이 트랜잭션만 롤백됩니다
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public RequestFormDto.FileResult apply(
            FormAdapterOutput output,
            RequestFormDto.FileEntry entry,
            String bseYy,
            String actorEno) {
        List<RequestFormDto.FormDiagnostic> diagnostics = allDiagnostics(output, bseYy);
        if (RequestFormValidator.hasBlocker(diagnostics)) {
            return blocked(entry, diagnostics, output);
        }

        List<RequestFormDto.CreatedRecord> created = new ArrayList<>();
        for (ProjectDto.CreateRequest project : output.projects()) {
            String abusMngNo = projectService.createProject(project, true);
            approvalStamper.stamp(
                    "BPROJM",
                    abusMngNo,
                    1,
                    "%s %s".formatted(APPROVAL_TITLE_PREFIX, project.getAbusNm()),
                    actorEno,
                    bseYy);
            created.add(new RequestFormDto.CreatedRecord("BPROJM", abusMngNo, project.getAbusNm()));
        }
        for (CostDto.CreateRequest cost : output.costs()) {
            cost.setBseYy(bseYy);
            String costBgNo = costService.createCost(cost, true);
            approvalStamper.stamp(
                    "BCOSTM",
                    costBgNo,
                    1,
                    "%s %s".formatted(APPROVAL_TITLE_PREFIX, cost.getCttNm()),
                    actorEno,
                    bseYy);
            created.add(new RequestFormDto.CreatedRecord("BCOSTM", costBgNo, cost.getCttNm()));
        }

        return new RequestFormDto.FileResult(
                entry.fileKey(),
                entry.deptName(),
                RequestFormDto.FileStatus.APPLIED,
                diagnostics,
                List.copyOf(created),
                output.suggestedGeneralExpenseMultiplier());
    }

    /**
     * 파일 1건을 검증만 합니다. 원장을 만들지 않습니다.
     *
     * @param output 어댑터가 조립한 생성 요청
     * @param entry 파일별 부가 정보
     * @param bseYy 예산연도 4자리
     * @return 파일 처리 결과. `created`는 항상 빈 목록
     */
    public RequestFormDto.FileResult preview(
            FormAdapterOutput output, RequestFormDto.FileEntry entry, String bseYy) {
        List<RequestFormDto.FormDiagnostic> diagnostics = allDiagnostics(output, bseYy);
        return new RequestFormDto.FileResult(
                entry.fileKey(),
                entry.deptName(),
                RequestFormValidator.hasBlocker(diagnostics)
                        ? RequestFormDto.FileStatus.BLOCKED
                        : RequestFormDto.FileStatus.APPLIED,
                diagnostics,
                List.of(),
                output.suggestedGeneralExpenseMultiplier());
    }

    private List<RequestFormDto.FormDiagnostic> allDiagnostics(
            FormAdapterOutput output, String bseYy) {
        List<RequestFormDto.FormDiagnostic> diagnostics = new ArrayList<>(output.diagnostics());
        diagnostics.addAll(validator.validate(output, bseYy));
        return List.copyOf(diagnostics);
    }

    private RequestFormDto.FileResult blocked(
            RequestFormDto.FileEntry entry,
            List<RequestFormDto.FormDiagnostic> diagnostics,
            FormAdapterOutput output) {
        return new RequestFormDto.FileResult(
                entry.fileKey(),
                entry.deptName(),
                RequestFormDto.FileStatus.BLOCKED,
                diagnostics,
                List.of(),
                output.suggestedGeneralExpenseMultiplier());
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormFileImporterTest*"`
Expected: PASS — 5개 테스트 전부 성공.

- [ ] **Step 5: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporter.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporterTest.java
git -C it_backend commit -m "feat(migration): 편성요청서 파일 단위 반영

파일 1건이 REQUIRES_NEW 트랜잭션 1개다. 한 파일이 실패해도 같은 배치의 다른
파일은 커밋된다. BLOCKER가 남으면 예외를 던지지 않고 차단 상태로 돌려준다 —
배치의 나머지를 계속 처리해야 하고, 예외로 알리면 호출자가 정상 흐름과 오류
흐름을 뒤섞어 다뤄야 한다.

원장은 기존 서비스의 이관 전용 오버로드로 만든다. 채번·조직명 스냅샷·감사로그가
그 경로에 있어 우회하면 전부 다시 구현해야 한다. 생성한 원장마다 결재완료
받이를 만들어 나중에 편성했을 때 집계에 잡히게 한다.

BBUGTM은 만들지 않는다. applyItemRates가 연도 전량을 논리삭제한 뒤 재삽입하는
구조라 파일마다 부르면 앞서 반입한 편성행이 전부 사라진다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: 배치 오케스트레이션과 컨트롤러

파일 여러 개를 받아 어댑터를 태우고 파일별로 반영한다. 이 태스크가 끝나면 API가 실제로 동작한다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormImportService.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/controller/RequestFormController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormImportServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/controller/RequestFormControllerTest.java`

**Interfaces:**
- Consumes: `WorkbookReader` (Task 1), `IoeHierarchyIndex` (Task 4), `RequestFormFileImporter` (Task 11), `FormSheetAdapter` 3종 (Task 7–9), `OrgIdentityResolver.snapshot()`, `@AuthenticationPrincipal` 사번 추출 방식(기존 `MigrationController` 참고)
- Produces:
  - `class RequestFormImportService` (`@Service`, **클래스에 `@Transactional` 없음**)
    - `RequestFormDto.ImportResponse importBatch(List<MultipartFile> files, RequestFormDto.ImportManifest manifest, String actorEno, boolean dryRun)`
  - `class RequestFormController` (`@RestController`)
    - `POST /api/admin/migration/requests:dry-run`
    - `POST /api/admin/migration/requests`

사번은 기존 `MigrationController`와 같은 방식으로 얻는다 — `@AuthenticationPrincipal CustomUserDetails user`를 받아 `user.getEno()`를 쓴다(`MigrationController.java:64`). 새 방식을 만들지 않는다.

- [ ] **Step 1: 오케스트레이션 실패 테스트 작성**

```java
package com.kdb.it.domain.migration.request.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.adapter.CapitalProjectFormAdapter;
import com.kdb.it.domain.migration.request.service.adapter.GeneralExpenseFormAdapter;
import com.kdb.it.domain.migration.request.service.adapter.RecurringProjectFormAdapter;
import com.kdb.it.domain.migration.request.support.RequestFormFixtures;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RequestFormImportServiceTest {

    @Mock private OrgIdentityResolver orgIdentityResolver;
    @Mock private OrgIdentityResolver.Index orgIndex;
    @Mock private IoeHierarchyIndex ioeHierarchyIndex;
    @Mock private RequestFormFileImporter fileImporter;
    @Mock private CapitalProjectFormAdapter capitalAdapter;
    @Mock private RecurringProjectFormAdapter recurringAdapter;
    @Mock private GeneralExpenseFormAdapter generalAdapter;

    private RequestFormImportService service() {
        when(orgIdentityResolver.snapshot()).thenReturn(orgIndex);
        when(ioeHierarchyIndex.snapshot())
                .thenReturn(com.kdb.it.domain.migration.request.support.TestIoeIndex.snapshot());
        when(orgIndex.resolveOrg(anyString()))
                .thenReturn(new OrgIdentityResolver.Resolution("0210", "자금운용실", List.of(), false));
        return new RequestFormImportService(
                new WorkbookReader(10_485_760L, 20, 5000, 0.01d),
                orgIdentityResolver,
                ioeHierarchyIndex,
                fileImporter,
                List.of(capitalAdapter, recurringAdapter, generalAdapter),
                50);
    }

    private static MockMultipartFile file(String name, byte[] bytes) {
        return new MockMultipartFile("files", name, "application/vnd.ms-excel", bytes);
    }

    private static RequestFormDto.ImportManifest manifest(String... fileKeys) {
        List<RequestFormDto.FileEntry> entries =
                java.util.Arrays.stream(fileKeys)
                        .map(key -> new RequestFormDto.FileEntry(key, key.split("/")[0], null, 1L, "571"))
                        .toList();
        return new RequestFormDto.ImportManifest("2026", entries, List.of());
    }

    private static RequestFormDto.FileResult applied(String fileKey) {
        return new RequestFormDto.FileResult(
                fileKey, "자금운용실", RequestFormDto.FileStatus.APPLIED, List.of(),
                List.of(new RequestFormDto.CreatedRecord("BCOSTM", "COST-2026-0001", "계약")), 1L);
    }

    @Test
    @DisplayName("파일마다 어댑터를 태우고 결과를 모아 요약한다")
    void aggregatesPerFileResults() {
        when(capitalAdapter.trigger())
                .thenReturn(com.kdb.it.domain.migration.request.dto.FormSheetKind.CAPITAL_OVERVIEW);
        when(recurringAdapter.trigger())
                .thenReturn(com.kdb.it.domain.migration.request.dto.FormSheetKind.RECURRING);
        when(generalAdapter.trigger())
                .thenReturn(com.kdb.it.domain.migration.request.dto.FormSheetKind.GENERAL_EXPENSE);
        when(capitalAdapter.adapt(any()))
                .thenReturn(com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput.empty());
        when(recurringAdapter.adapt(any()))
                .thenReturn(com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput.empty());
        when(generalAdapter.adapt(any()))
                .thenReturn(com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput.empty());
        when(fileImporter.apply(any(), any(), anyString(), anyString()))
                .thenReturn(applied("자금운용실/요청서.xls"));

        RequestFormDto.ImportResponse response =
                service()
                        .importBatch(
                                List.of(file("요청서.xls", RequestFormFixtures.fullFormXls())),
                                manifest("자금운용실/요청서.xls"),
                                "12345678",
                                false);

        assertThat(response.dryRun()).isFalse();
        assertThat(response.summary().totalFiles()).isEqualTo(1);
        assertThat(response.summary().appliedFiles()).isEqualTo(1);
        assertThat(response.summary().createdCosts()).isEqualTo(1);
    }

    @Test
    @DisplayName("열지 못한 파일은 FAILED로 남기고 배치를 계속한다")
    void keepsGoingWhenOneFileIsUnreadable() {
        when(fileImporter.apply(any(), any(), anyString(), anyString()))
                .thenReturn(applied("자금운용실/요청서.xls"));
        when(capitalAdapter.trigger())
                .thenReturn(com.kdb.it.domain.migration.request.dto.FormSheetKind.CAPITAL_OVERVIEW);
        when(recurringAdapter.trigger())
                .thenReturn(com.kdb.it.domain.migration.request.dto.FormSheetKind.RECURRING);
        when(generalAdapter.trigger())
                .thenReturn(com.kdb.it.domain.migration.request.dto.FormSheetKind.GENERAL_EXPENSE);
        when(capitalAdapter.adapt(any()))
                .thenReturn(com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput.empty());
        when(recurringAdapter.adapt(any()))
                .thenReturn(com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput.empty());
        when(generalAdapter.adapt(any()))
                .thenReturn(com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput.empty());

        RequestFormDto.ImportResponse response =
                service()
                        .importBatch(
                                List.of(
                                        file("깨진.xlsx", "엑셀 아님".getBytes(java.nio.charset.StandardCharsets.UTF_8)),
                                        file("요청서.xls", RequestFormFixtures.fullFormXls())),
                                manifest("자금운용실/깨진.xlsx", "자금운용실/요청서.xls"),
                                "12345678",
                                false);

        assertThat(response.files()).hasSize(2);
        assertThat(response.files().get(0).status()).isEqualTo(RequestFormDto.FileStatus.FAILED);
        assertThat(response.files().get(0).diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode.FILE_UNREADABLE);
        assertThat(response.files().get(1).status()).isEqualTo(RequestFormDto.FileStatus.APPLIED);
    }

    @Test
    @DisplayName("배치 파일 수 상한을 넘으면 거부한다")
    void rejectsOversizeBatch() {
        RequestFormImportService narrow =
                new RequestFormImportService(
                        new WorkbookReader(10_485_760L, 20, 5000, 0.01d),
                        orgIdentityResolver,
                        ioeHierarchyIndex,
                        fileImporter,
                        List.of(),
                        1);

        assertThatIllegalArgumentExceptionIsThrown(
                () ->
                        narrow.importBatch(
                                List.of(
                                        file("a.xls", RequestFormFixtures.fullFormXls()),
                                        file("b.xls", RequestFormFixtures.fullFormXls())),
                                manifest("d/a.xls", "d/b.xls"),
                                "12345678",
                                true));
    }

    @Test
    @DisplayName("파일 수와 manifest 항목 수가 다르면 거부한다")
    void rejectsWhenManifestCountDiffers() {
        assertThatIllegalArgumentExceptionIsThrown(
                () ->
                        service()
                                .importBatch(
                                        List.of(file("요청서.xls", RequestFormFixtures.fullFormXls())),
                                        manifest("자금운용실/요청서.xls", "자금운용실/빠진파일.xls"),
                                        "12345678",
                                        true));
    }

    private static void assertThatIllegalArgumentExceptionIsThrown(Runnable runnable) {
        org.assertj.core.api.Assertions.assertThatThrownBy(runnable::run)
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormImportServiceTest*"`
Expected: FAIL — `RequestFormImportService` 없음.

- [ ] **Step 3: `RequestFormImportService` 작성**

```java
package com.kdb.it.domain.migration.request.service;

import com.kdb.it.domain.migration.request.dto.FormSheetKind;
import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.adapter.FormAdapterContext;
import com.kdb.it.domain.migration.request.service.adapter.FormAdapterOutput;
import com.kdb.it.domain.migration.request.service.adapter.FormSheetAdapter;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * 편성요청서 반입 배치를 진행합니다.
 *
 * <p><b>이 클래스에 트랜잭션을 걸지 않습니다.</b> 반영의 원자 단위는 {@link RequestFormFileImporter}의 `REQUIRES_NEW`
 * 트랜잭션이며, 여기에 트랜잭션을 걸면 바깥 롤백이 안쪽 커밋과 어긋나 "정상 파일만 반영"이 성립하지 않습니다.
 *
 * <p>조직·비목 인덱스는 배치 시작에 한 번만 만들어 모든 파일이 공유합니다. 파일마다 만들면 수백 회 전량 조회가 됩니다.
 */
@Service
@Slf4j
public class RequestFormImportService {

    private final WorkbookReader workbookReader;
    private final OrgIdentityResolver orgIdentityResolver;
    private final IoeHierarchyIndex ioeHierarchyIndex;
    private final RequestFormFileImporter fileImporter;
    private final List<FormSheetAdapter> adapters;
    private final int maxFilesPerBatch;

    public RequestFormImportService(
            WorkbookReader workbookReader,
            OrgIdentityResolver orgIdentityResolver,
            IoeHierarchyIndex ioeHierarchyIndex,
            RequestFormFileImporter fileImporter,
            List<FormSheetAdapter> adapters,
            @Value("${app.migration.request.max-files-per-batch}") int maxFilesPerBatch) {
        this.workbookReader = workbookReader;
        this.orgIdentityResolver = orgIdentityResolver;
        this.ioeHierarchyIndex = ioeHierarchyIndex;
        this.fileImporter = fileImporter;
        this.adapters = adapters;
        this.maxFilesPerBatch = maxFilesPerBatch;
    }

    /**
     * 배치 1회를 처리합니다.
     *
     * @param files 업로드 파일. `manifest.entries`의 `fileKey`와 순서로 짝지어집니다
     * @param manifest 예산연도·파일별 부가 정보·보정값
     * @param actorEno 업로드 사용자 사번
     * @param dryRun true면 검증만 하고 원장을 만들지 않습니다
     * @return 파일별 결과와 배치 요약
     * @throws IllegalArgumentException 파일 수가 상한을 넘거나 manifest와 파일 목록이 어긋난 경우
     */
    public RequestFormDto.ImportResponse importBatch(
            List<MultipartFile> files,
            RequestFormDto.ImportManifest manifest,
            String actorEno,
            boolean dryRun) {
        if (files.size() > maxFilesPerBatch) {
            throw new IllegalArgumentException(
                    "한 번에 보낼 수 있는 파일은 %d개까지입니다.".formatted(maxFilesPerBatch));
        }
        if (files.size() != manifest.entries().size()) {
            throw new IllegalArgumentException("파일 수와 manifest 항목 수가 다릅니다.");
        }

        OrgIdentityResolver.Index orgIndex = orgIdentityResolver.snapshot();
        IoeHierarchyIndex.Snapshot ioeIndex = ioeHierarchyIndex.snapshot();
        Map<String, Map<String, String>> overridesByFile = groupOverrides(manifest);

        List<RequestFormDto.FileResult> results = new ArrayList<>();
        for (int i = 0; i < files.size(); i++) {
            RequestFormDto.FileEntry entry = manifest.entries().get(i);
            results.add(
                    processFile(
                            files.get(i),
                            entry,
                            manifest.bseYy(),
                            orgIndex,
                            ioeIndex,
                            overridesByFile.getOrDefault(entry.fileKey(), Map.of()),
                            actorEno,
                            dryRun));
        }
        return new RequestFormDto.ImportResponse(dryRun, summarize(files.size(), results), List.copyOf(results));
    }

    private RequestFormDto.FileResult processFile(
            MultipartFile file,
            RequestFormDto.FileEntry entry,
            String bseYy,
            OrgIdentityResolver.Index orgIndex,
            IoeHierarchyIndex.Snapshot ioeIndex,
            Map<String, String> overrides,
            String actorEno,
            boolean dryRun) {
        Workbook workbook = null;
        try {
            workbook = workbookReader.open(readBytes(file), entry.fileKey());
            Map<FormSheetKind, Sheet> sheets = workbookReader.classify(workbook);
            if (sheets.isEmpty()) {
                return failed(entry, RequestFormDiagnosticCode.SHEET_NOT_FOUND,
                        "인식할 수 있는 편성요청서 시트가 없습니다.");
            }

            OrgIdentityResolver.Resolution deptResolution = orgIndex.resolveOrg(entry.deptName());
            String deptCode =
                    entry.deptCodeOverride() != null ? entry.deptCodeOverride() : deptResolution.code();
            if (deptCode == null) {
                return failedWithCandidates(entry, deptResolution);
            }

            FormAdapterContext context =
                    new FormAdapterContext(
                            sheets, bseYy, entry, deptCode,
                            deptResolution.label(), orgIndex, ioeIndex, overrides, actorEno);

            FormAdapterOutput output = FormAdapterOutput.empty();
            for (FormSheetAdapter adapter : adapters) {
                if (sheets.containsKey(adapter.trigger())) output = output.merge(adapter.adapt(context));
            }

            return dryRun
                    ? fileImporter.preview(output, entry, bseYy)
                    : fileImporter.apply(output, entry, bseYy, actorEno);
        } catch (WorkbookReader.WorkbookOpenException e) {
            return failed(entry, RequestFormDiagnosticCode.FILE_UNREADABLE, e.getMessage());
        } catch (RuntimeException e) {
            // 파일 하나의 예외가 배치를 무너뜨리지 않게 잡는다. 파일명만 남기고 내용은 로그에 남기지 않는다.
            log.warn("편성요청서 반입 실패: fileKey={}", entry.fileKey(), e);
            return failed(entry, RequestFormDiagnosticCode.FILE_UNREADABLE,
                    "파일을 처리하지 못했습니다. 양식을 확인해 주세요.");
        } finally {
            closeQuietly(workbook);
        }
    }

    private Map<String, Map<String, String>> groupOverrides(RequestFormDto.ImportManifest manifest) {
        Map<String, Map<String, String>> grouped = new HashMap<>();
        for (RequestFormDto.CellOverride override : manifest.overrides()) {
            grouped
                    .computeIfAbsent(override.fileKey(), key -> new LinkedHashMap<>())
                    .put(
                            FormAdapterContext.overrideKey(
                                    override.sheet(), override.excelRow(), override.field()),
                            override.value());
        }
        return grouped;
    }

    private RequestFormDto.ImportSummary summarize(
            int totalFiles, List<RequestFormDto.FileResult> results) {
        int applied = 0;
        int blocked = 0;
        int projects = 0;
        int items = 0;
        int costs = 0;
        for (RequestFormDto.FileResult result : results) {
            if (result.status() == RequestFormDto.FileStatus.APPLIED) applied++;
            if (result.status() == RequestFormDto.FileStatus.BLOCKED) blocked++;
            for (RequestFormDto.CreatedRecord created : result.created()) {
                switch (created.table()) {
                    case "BPROJM" -> projects++;
                    case "BITEMM" -> items++;
                    case "BCOSTM" -> costs++;
                    default -> { /* 알 수 없는 원천은 집계하지 않는다 */ }
                }
            }
        }
        return new RequestFormDto.ImportSummary(totalFiles, applied, blocked, projects, items, costs);
    }

    private RequestFormDto.FileResult failed(
            RequestFormDto.FileEntry entry, RequestFormDiagnosticCode code, String message) {
        return new RequestFormDto.FileResult(
                entry.fileKey(),
                entry.deptName(),
                RequestFormDto.FileStatus.FAILED,
                List.of(RequestFormDto.FormDiagnostic.of(null, null, null, code, message, List.of())),
                List.of(),
                null);
    }

    private RequestFormDto.FileResult failedWithCandidates(
            RequestFormDto.FileEntry entry, OrgIdentityResolver.Resolution resolution) {
        RequestFormDiagnosticCode code =
                resolution.isAmbiguous()
                        ? RequestFormDiagnosticCode.ORG_AMBIGUOUS
                        : RequestFormDiagnosticCode.ORG_UNRESOLVED;
        return new RequestFormDto.FileResult(
                entry.fileKey(),
                entry.deptName(),
                RequestFormDto.FileStatus.BLOCKED,
                List.of(
                        RequestFormDto.FormDiagnostic.of(
                                null,
                                null,
                                "deptCodeOverride",
                                code,
                                "폴더명 `%s`에 해당하는 부서를 확정하지 못했습니다.".formatted(entry.deptName()),
                                resolution.candidates())),
                List.of(),
                null);
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private void closeQuietly(Workbook workbook) {
        if (workbook == null) return;
        try {
            workbook.close();
        } catch (IOException e) {
            log.debug("워크북을 닫지 못했습니다", e);
        }
    }
}
```

- [ ] **Step 4: 컨트롤러 슬라이스 테스트 작성**

기존 `MigrationControllerTest`의 구조(`@WebMvcTest` 설정·보안 목킹)를 그대로 따른다.

Run: `cd it_backend && cat src/test/java/com/kdb/it/domain/migration/controller/MigrationControllerTest.java`

같은 방식으로 `RequestFormControllerTest`를 만들고 아래 4가지를 고정한다.

1. 비관리자 호출은 403.
2. `Content-Type`이 multipart가 아니면 415.
3. `manifest`의 `bseYy`가 4자리가 아니면 400.
4. 관리자 호출은 200이고 서비스에 `dryRun` 플래그가 각각 `true`·`false`로 전달된다.

- [ ] **Step 5: `RequestFormController` 작성**

```java
package com.kdb.it.domain.migration.request.controller;

import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.RequestFormImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 부점 편성요청서 반입 API입니다.
 *
 * <p>관리자 전용입니다. `multipart/form-data`로 파일과 manifest를 함께 받습니다 — multipart는 CORS 안전 목록이라
 * {@code SimpleRequestCsrfFilter}가 `X-Requested-With` 헤더를 요구하며, 프론트 `$apiFetch`가 이를 자동으로 붙입니다.
 */
@RestController
@RequestMapping("/api/admin/migration/requests")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Tag(name = "편성요청서 반입", description = "부점 제출 전산예산 편성요청서 일괄 반입")
public class RequestFormController {

    private final RequestFormImportService importService;

    /**
     * 반입 전 검증만 수행합니다. 원장을 만들지 않습니다.
     *
     * @param files 업로드 파일 목록
     * @param manifest 예산연도·파일별 부가 정보·보정값
     * @return 파일별 진단과 요약
     */
    @Operation(summary = "편성요청서 사전검증", description = "원장을 만들지 않고 진단만 돌려줍니다.")
    @PostMapping(path = ":dry-run", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public RequestFormDto.ImportResponse dryRun(
            @RequestPart(name = "files") List<MultipartFile> files,
            @Valid @RequestPart(name = "manifest") RequestFormDto.ImportManifest manifest,
            @AuthenticationPrincipal CustomUserDetails user) {
        return importService.importBatch(files, manifest, user.getEno(), true);
    }

    /**
     * 편성요청서를 원장에 반영합니다.
     *
     * <p>파일 1건이 트랜잭션 1개입니다. BLOCKER가 남은 파일은 건너뛰고 나머지는 반영합니다.
     *
     * @param files 업로드 파일 목록
     * @param manifest 예산연도·파일별 부가 정보·보정값
     * @return 파일별 결과와 생성된 관리번호
     */
    @Operation(summary = "편성요청서 반입", description = "정상 파일만 원장에 반영합니다.")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public RequestFormDto.ImportResponse commit(
            @RequestPart(name = "files") List<MultipartFile> files,
            @Valid @RequestPart(name = "manifest") RequestFormDto.ImportManifest manifest,
            @AuthenticationPrincipal CustomUserDetails user) {
        return importService.importBatch(files, manifest, user.getEno(), false);
    }
}
```

import에 `com.kdb.it.common.security.CustomUserDetails`(기존 `MigrationController`가 쓰는 것과 같은 클래스)와 `org.springframework.security.core.annotation.AuthenticationPrincipal`을 추가한다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*RequestFormImportServiceTest*" --tests "*RequestFormControllerTest*"`
Expected: PASS — 두 테스트 클래스 전부 성공.

- [ ] **Step 7: 전체 단위 테스트와 포맷 검사**

Run: `cd it_backend && ./gradlew spotlessApply check`
Expected: BUILD SUCCESSFUL. JaCoCo 커버리지 게이트까지 통과해야 한다.

- [ ] **Step 8: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/migration/request src/test/java/com/kdb/it/domain/migration/request
git -C it_backend commit -m "feat(migration): 편성요청서 반입 배치 오케스트레이션과 API

오케스트레이터에는 트랜잭션을 걸지 않는다. 반영의 원자 단위는 파일 임포터의
REQUIRES_NEW이고, 여기에 트랜잭션을 걸면 바깥 롤백이 안쪽 커밋과 어긋나
'정상 파일만 반영'이 성립하지 않는다.

조직·비목 인덱스는 배치 시작에 한 번만 만들어 모든 파일이 공유한다. 파일마다
만들면 수백 회 전량 조회가 된다. 파일 하나의 예외는 잡아 FAILED로 남기고
배치를 계속하며, 로그에 파일명만 남기고 내용은 남기지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: 메뉴 시드

관리자 메뉴에 반입 화면을 등록한다.

**Files:**
- Create: `it_database/migrations/V20260813_001__SeedRequestFormMigrationMenu.sql`

**Interfaces:**
- Consumes: 기존 `V20260811_002__SeedMigrationAdminMenu.sql`의 시드 형태
- Produces: `/admin/migration/requests` 화면경로를 가진 `PGE` 메뉴 1건

화면경로 컬럼은 `SCR_PTH`가 아니라 **`SRE_PTH`**다(`V20260811_002` 실측). 부모는 `MADM0004`(데이터 관리), 채번은 `'MNU' || LPAD(SQ_TPRMPP_CMENUM_1.NEXTVAL, 7, '0')`이다.

- [ ] **Step 1: 시드 스크립트 작성**

`it_database/migrations/V20260813_001__SeedRequestFormMigrationMenu.sql`:

```sql
-- ============================================================================
-- 부점 편성요청서 반입 관리자 메뉴 시드
-- ============================================================================
-- 부점이 제출한 `전산예산 편성 요청서`를 원장으로 반입하는 관리자 화면
-- (/admin/migration/requests)의 메뉴 행을 추가한다.
--
-- [기존 반입 화면과의 관계]
--   V20260811_002가 만든 /admin/migration(데이터 일괄 반입)과 형제로 둔다.
--   두 화면은 대상 엑셀이 서로 다르다 — 그쪽은 전사 취합본, 이쪽은 부점 제출 원본이라
--   시트 구조와 반영 정책(전량 원자 대 파일 단위 원자)이 달라 하나로 합치지 않는다.
--
-- [부모 메뉴·채번·아이콘]
--   V20260811_002와 같은 규칙을 그대로 쓴다. 부모는 MADM0004(데이터 관리),
--   MNU_ID는 'MNU' + SQ_TPRMPP_CMENUM_1을 7자리로 LPAD, IMK_NM은 CSS 클래스로
--   바인딩되므로 `^[a-z0-9 -]{1,100}$`를 만족하는 값만 쓴다.
--
-- [재실행 안전]
--   같은 화면경로의 활성(DEL_YN='N') 메뉴가 이미 있으면 건너뛴다.
--   부모(MADM0004)가 없는 스키마에서도 조용히 건너뛴다.
-- ============================================================================

DECLARE
    c_parent_id   CONSTANT VARCHAR2(10) := 'MADM0004';
    c_sre_pth     CONSTANT VARCHAR2(40) := '/admin/migration/requests';
    v_parent_path ITPOWN.TPRMPP_CMENUM.WHL_MNU_PTH%TYPE;
    v_parent_dep  ITPOWN.TPRMPP_CMENUM.MNU_DEP%TYPE;
    v_mnu_id      ITPOWN.TPRMPP_CMENUM.MNU_ID%TYPE;
    v_max_sort    NUMBER;
    v_exists      NUMBER;
BEGIN
    BEGIN
        SELECT WHL_MNU_PTH, MNU_DEP
          INTO v_parent_path, v_parent_dep
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE MNU_ID = c_parent_id
           AND DEL_YN = 'N';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN; -- 데이터 관리 그룹이 없는 스키마는 시드 대상이 아니다
    END;

    SELECT COUNT(*)
      INTO v_exists
      FROM ITPOWN.TPRMPP_CMENUM
     WHERE SRE_PTH = c_sre_pth
       AND DEL_YN = 'N';

    IF v_exists = 0 THEN
        SELECT 'MNU' || LPAD(ITPOWN.SQ_TPRMPP_CMENUM_1.NEXTVAL, 7, '0') INTO v_mnu_id FROM DUAL;

        SELECT NVL(MAX(MNU_SOT_SQN_SNO), 0)
          INTO v_max_sort
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE HRK_MNU_ID = c_parent_id
           AND DEL_YN = 'N';

        INSERT INTO ITPOWN.TPRMPP_CMENUM (
            MNU_ID, HRK_MNU_ID, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO,
            HID_YN, MNU_DEP, WHL_MNU_PTH, IMK_NM,
            DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM
        ) VALUES (
            v_mnu_id, c_parent_id, '편성요청서 반입', 'PGE', c_sre_pth, v_max_sort + 10,
            'N', v_parent_dep + 1, v_parent_path || '/' || v_mnu_id, 'pi pi-folder-open',
            'N',
            LOWER(REGEXP_REPLACE(RAWTOHEX(SYS_GUID()), '(.{8})(.{4})(.{4})(.{4})(.{12})', '\1-\2-\3-\4-\5')),
            1, 'MIGRATION', SYSDATE, 'MIGRATION', SYSDATE
        );
    END IF;
END;
/

COMMIT;
```

- [ ] **Step 2: 아이콘 선택지 추가**

`IMK_NM`으로 넣은 `pi pi-folder-open`을 `it_frontend/app/utils/menuPresentation.ts`의 `MENU_ICON_OPTIONS`에도 추가한다. 목록에 없으면 메뉴관리 화면에서 이 아이콘을 다시 고를 수 없다(`V20260811_002` 주석이 같은 이유로 `pi pi-upload`를 추가했다).

Run: `cd it_frontend && grep -n "pi pi-upload" app/utils/menuPresentation.ts`

그 줄 옆에 같은 형식으로 `pi pi-folder-open`을 추가한다.

- [ ] **Step 3: 로컬에 적용해 확인**

Run: `cd it_backend && ./gradlew bootRun`

기동 로그에 `Migrating schema "ITPOWN" to version 20260813.001` 이 보이는지 확인한다. IDE에서 기동하면 `processResources`가 돌지 않아 마이그레이션이 적용되지 않으므로 반드시 `gradlew bootRun`으로 확인한다.

메뉴가 실제로 들어갔는지 확인한다.

```bash
sqlplus ITPAPP@127.0.0.1:11521/XEPDB1
```

접속 후 `SELECT MNU_ID, MNU_NM, SRE_PTH FROM ITPOWN.TPRMPP_CMENUM WHERE SRE_PTH LIKE '/admin/migration%' AND DEL_YN = 'N';`

Expected: 2행 — 기존 `/admin/migration`과 신규 `/admin/migration/requests`.

- [ ] **Step 4: 커밋**

```bash
git -C it_frontend add app/utils/menuPresentation.ts
git -C it_frontend commit -m "feat(migration): 편성요청서 반입 메뉴 아이콘 선택지 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git -C it_database add migrations/V20260813_001__SeedRequestFormMigrationMenu.sql
git -C it_database commit -m "feat: 편성요청서 반입 화면 관리자 메뉴 시드

/admin/migration/requests를 기존 수기 엑셀 이관 메뉴의 형제로 둔다.
두 화면은 대상 엑셀이 서로 달라(전사 취합본 대 부점 제출본) 합치지 않는다.
재실행해도 중복되지 않도록 화면경로 기준 MERGE로 넣는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14: 프론트 업로드 로직

폴더 선택, 부서 추출, 배치 분할, 진행률, API 호출을 담당하는 composable을 만든다. 화면 없이 단위 테스트로 검증한다.

**Files:**
- Create: `it_frontend/app/composables/migration/useRequestFormUpload.ts`
- Test: `it_frontend/tests/unit/composables/migration/useRequestFormUpload.test.ts`

**Interfaces:**
- Consumes: `$apiFetch`(Nuxt 플러그인), `useRuntimeConfig().public.apiBase`, 백엔드 계약(Task 6)
- Produces:
  - `interface SelectedFile { file: File; fileKey: string; deptName: string }`
  - `function collectFiles(fileList: FileList | File[]): SelectedFile[]`
  - `function chunk<T>(items: T[], size: number): T[][]`
  - `function useRequestFormUpload()` — `{ files, batches, progress, results, summary, isRunning, selectFiles, runDryRun, runCommit, reset }`
  - `const BATCH_SIZE = 20`

- [ ] **Step 1: 실패 테스트 작성**

`it_frontend/tests/unit/composables/migration/useRequestFormUpload.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BATCH_SIZE, chunk, collectFiles } from '~/composables/migration/useRequestFormUpload';

/** webkitdirectory 입력이 주는 File을 흉내낸다. relativePath는 표준 File에 없는 속성이라 직접 붙인다. */
function fileWith(relativePath: string): File {
    const file = new File(['x'], relativePath.split('/').pop() ?? 'a.xlsx');
    Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
    return file;
}

describe('collectFiles', () => {
    it('최상위 폴더명을 부서명으로 뽑는다', () => {
        const selected = collectFiles([fileWith('자금운용실/요청서.xlsx')]);

        expect(selected).toHaveLength(1);
        expect(selected[0]!.deptName).toBe('자금운용실');
        expect(selected[0]!.fileKey).toBe('자금운용실/요청서.xlsx');
    });

    it('하위 폴더가 더 있어도 최상위만 부서로 본다', () => {
        const selected = collectFiles([fileWith('런던지점/2026/붙임.xls')]);

        expect(selected[0]!.deptName).toBe('런던지점');
        expect(selected[0]!.fileKey).toBe('런던지점/2026/붙임.xls');
    });

    it('엑셀이 아닌 파일은 거른다', () => {
        const selected = collectFiles([
            fileWith('자금운용실/요청서.xlsx'),
            fileWith('자금운용실/메모.txt'),
            fileWith('자금운용실/~$요청서.xlsx'),
        ]);

        expect(selected.map((s) => s.fileKey)).toEqual(['자금운용실/요청서.xlsx']);
    });

    it('폴더 없이 고른 파일은 부서명을 빈 문자열로 둔다', () => {
        const selected = collectFiles([fileWith('요청서.xlsx')]);

        expect(selected[0]!.deptName).toBe('');
    });
});

describe('chunk', () => {
    it('배치 크기로 나눈다', () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('빈 목록은 빈 배열을 돌려준다', () => {
        expect(chunk([], 20)).toEqual([]);
    });

    it('기본 배치 크기는 20이다', () => {
        expect(BATCH_SIZE).toBe(20);
    });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_frontend && npm test -- useRequestFormUpload`
Expected: FAIL — 모듈을 찾지 못함.

- [ ] **Step 3: composable 작성**

```ts
/**
 * ============================================================================
 * [migration/useRequestFormUpload.ts] 부점 편성요청서 폴더 업로드
 * ============================================================================
 * `webkitdirectory`로 고른 폴더를 배치로 나눠 서버에 올립니다. 파싱은 서버 Apache POI가
 * 하므로 여기서는 파일을 읽지 않고 그대로 전달만 합니다(부점 제출본에 .xls가 많아
 * exceljs로는 읽지 못합니다).
 * ============================================================================
 */
import type { components } from '~/types/api';

type ImportResponse = components['schemas']['RequestFormImportResponse'];
type FileResult = components['schemas']['RequestFormFileResult'];
type FileEntry = components['schemas']['RequestFormFileEntry'];
type CellOverride = components['schemas']['RequestFormCellOverride'];
type ImportSummary = components['schemas']['RequestFormImportSummary'];

/** 한 요청에 보낼 파일 수. 서버 `app.migration.request.max-files-per-batch`(50)보다 작게 둡니다. */
export const BATCH_SIZE = 20;

/** 반입 대상 확장자. 그 밖의 파일은 폴더에 섞여 있어도 보내지 않습니다. */
const EXCEL_EXTENSIONS = ['.xlsx', '.xls'];

/** 선택된 파일 하나. */
export interface SelectedFile {
    /** 원본 File. 서버로 그대로 보냅니다 */
    file: File;
    /** `webkitRelativePath`. 파일과 결과를 잇는 키 */
    fileKey: string;
    /** 최상위 폴더명. 부서 해석의 근거 */
    deptName: string;
}

/**
 * 폴더 선택 결과를 반입 대상 목록으로 정리합니다.
 *
 * 최상위 폴더명을 부서명으로 삼습니다. 엑셀이 아닌 파일과 엑셀 임시파일(`~$`로 시작)은
 * 걸러냅니다 — 열어 둔 채로 폴더를 통째 올리면 임시파일이 섞여 들어옵니다.
 *
 * @param fileList `<input type="file" webkitdirectory>` 의 files
 * @returns 반입 대상 목록. 대상이 없으면 빈 배열
 */
export function collectFiles(fileList: FileList | File[]): SelectedFile[] {
    const files = Array.from(fileList);
    const selected: SelectedFile[] = [];

    for (const file of files) {
        const fileKey = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const name = fileKey.split('/').pop() ?? fileKey;
        if (name.startsWith('~$')) continue;
        if (!EXCEL_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext))) continue;

        const segments = fileKey.split('/');
        selected.push({
            file,
            fileKey,
            deptName: segments.length > 1 ? (segments[0] ?? '') : '',
        });
    }
    return selected;
}

/**
 * 목록을 고정 크기로 나눕니다.
 *
 * @param items 나눌 목록
 * @param size 한 묶음의 크기
 * @returns 묶음 배열. 입력이 비면 빈 배열
 */
export function chunk<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        batches.push(items.slice(i, i + size));
    }
    return batches;
}

/**
 * 편성요청서 업로드 흐름 composable.
 *
 * @returns 선택 파일·진행률·결과와 dry-run/commit 실행 함수
 */
export function useRequestFormUpload() {
    const { $apiFetch } = useNuxtApp();
    const apiBase = useRuntimeConfig().public.apiBase;

    const files = ref<SelectedFile[]>([]);
    const results = ref<FileResult[]>([]);
    const summary = ref<ImportSummary | null>(null);
    const isRunning = ref(false);
    const completedBatches = ref(0);

    const batches = computed(() => chunk(files.value, BATCH_SIZE));
    const progress = computed(() =>
        batches.value.length === 0 ? 0 : Math.round((completedBatches.value / batches.value.length) * 100),
    );

    /**
     * 폴더 선택 결과를 반영합니다. 기존 선택과 결과를 모두 지웁니다.
     *
     * @param fileList 입력 요소의 files
     */
    function selectFiles(fileList: FileList | File[]): void {
        files.value = collectFiles(fileList);
        results.value = [];
        summary.value = null;
        completedBatches.value = 0;
    }

    /** 선택과 결과를 모두 지웁니다. */
    function reset(): void {
        files.value = [];
        results.value = [];
        summary.value = null;
        completedBatches.value = 0;
    }

    /**
     * 사전검증을 실행합니다.
     *
     * @param bseYy 예산연도 4자리
     * @param entries 파일별 부가 정보 (부서코드 보정·단위·사업코드)
     * @param overrides 미리보기 보정값
     * @throws Error 어느 배치든 요청이 실패하면 그대로 전파합니다. 호출 화면이 Toast·배너로 알립니다
     */
    async function runDryRun(
        bseYy: string,
        entries: FileEntry[],
        overrides: CellOverride[],
    ): Promise<void> {
        await run(bseYy, entries, overrides, `${apiBase}/api/admin/migration/requests:dry-run`);
    }

    /**
     * 반영을 실행합니다. 파일을 다시 전송합니다 — 서버가 사전검증 결과를 보관하지 않습니다.
     *
     * @param bseYy 예산연도 4자리
     * @param entries 파일별 부가 정보
     * @param overrides 미리보기 보정값
     * @throws Error 어느 배치든 요청이 실패하면 그대로 전파합니다
     */
    async function runCommit(
        bseYy: string,
        entries: FileEntry[],
        overrides: CellOverride[],
    ): Promise<void> {
        await run(bseYy, entries, overrides, `${apiBase}/api/admin/migration/requests`);
    }

    async function run(
        bseYy: string,
        entries: FileEntry[],
        overrides: CellOverride[],
        url: string,
    ): Promise<void> {
        isRunning.value = true;
        results.value = [];
        summary.value = null;
        completedBatches.value = 0;
        const totals: ImportSummary = {
            totalFiles: 0,
            appliedFiles: 0,
            blockedFiles: 0,
            createdProjects: 0,
            createdItems: 0,
            createdCosts: 0,
        };

        try {
            for (const batch of batches.value) {
                const keys = new Set(batch.map((item) => item.fileKey));
                const body = new FormData();
                for (const item of batch) body.append('files', item.file, item.file.name);
                body.append(
                    'manifest',
                    new Blob(
                        [
                            JSON.stringify({
                                bseYy,
                                entries: entries.filter((entry) => keys.has(entry.fileKey)),
                                overrides: overrides.filter((override) => keys.has(override.fileKey)),
                            }),
                        ],
                        { type: 'application/json' },
                    ),
                );

                // FormData는 반드시 $apiFetch로 보낸다. 원시 $fetch는 X-Requested-With가 빠져 403이다.
                const response = await $apiFetch<ImportResponse>(url, { method: 'POST', body });
                results.value = [...results.value, ...response.files];
                accumulate(totals, response.summary);
                completedBatches.value += 1;
            }
            summary.value = totals;
        } finally {
            isRunning.value = false;
        }
    }

    function accumulate(totals: ImportSummary, batchSummary: ImportSummary): void {
        totals.totalFiles += batchSummary.totalFiles;
        totals.appliedFiles += batchSummary.appliedFiles;
        totals.blockedFiles += batchSummary.blockedFiles;
        totals.createdProjects += batchSummary.createdProjects;
        totals.createdItems += batchSummary.createdItems;
        totals.createdCosts += batchSummary.createdCosts;
    }

    return {
        files,
        batches,
        progress,
        results,
        summary,
        isRunning,
        selectFiles,
        runDryRun,
        runCommit,
        reset,
    };
}
```

- [ ] **Step 4: 백엔드 타입 생성**

Run: `cd it_backend && ./gradlew bootRun` (별도 터미널에서 기동 유지)
Run: `cd it_frontend && npm run codegen && npm run codegen:check`
Expected: `app/types/api.d.ts`에 `RequestFormImportResponse` 등이 생기고 `codegen:check` 통과.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- useRequestFormUpload`
Expected: PASS — 7개 테스트 전부 성공.

- [ ] **Step 6: 커밋**

```bash
git -C it_frontend add app/composables/migration/useRequestFormUpload.ts app/types/api.d.ts tests/unit/composables/migration/useRequestFormUpload.test.ts
git -C it_frontend commit -m "feat(migration): 편성요청서 폴더 업로드 로직

webkitdirectory로 고른 폴더를 20개씩 나눠 보낸다. 파싱은 서버 POI가 하므로
프론트는 파일을 읽지 않고 그대로 전달만 한다. 부점 제출본에 .xls가 많아
exceljs로는 읽지 못한다.

최상위 폴더명을 부서명으로 삼고, 엑셀이 아닌 파일과 엑셀 임시파일(~$)은
거른다. 폴더를 통째 올리면 열어 둔 파일의 임시파일이 섞여 들어온다.

FormData는 $apiFetch로만 보낸다. 원시 $fetch는 X-Requested-With가 빠져
SimpleRequestCsrfFilter에 403으로 막힌다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15: 프론트 화면

폴더 선택기, 결과 표, 페이지를 만든다. 수백 건을 다룰 수 있게 진단 있는 파일만 펼친다.

**Files:**
- Create: `it_frontend/app/components/migration/RequestFormFolderPicker.vue`
- Create: `it_frontend/app/components/migration/RequestFormResultTable.vue`
- Create: `it_frontend/app/composables/migration/useRequestFormPage.ts`
- Create: `it_frontend/app/pages/admin/migration/requests.vue`
- Modify: `it_frontend/tests/unit/architecture/component-boundaries.test.ts`
- Test: `it_frontend/tests/unit/composables/migration/useRequestFormPage.test.ts`
- Test: `it_frontend/tests/unit/pages/requestFormMigrationPageBoundary.test.ts`

**Interfaces:**
- Consumes: `useRequestFormUpload` (Task 14), `StyledDataTable`, `formatApiError`, `TOAST_LIFE`
- Produces:
  - `function useRequestFormPage()` — `{ bseYy, upload, entries, overrides, deptGroups, canCommit, applyDeptOverride, applyUnitOverride, applyCellOverride, dryRun, commit, exportResults }`

- [ ] **Step 1: 화면 상태 파사드의 실패 테스트 작성**

`it_frontend/tests/unit/composables/migration/useRequestFormPage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/composables/migration/useRequestFormUpload', () => ({
    BATCH_SIZE: 20,
    collectFiles: vi.fn(),
    chunk: vi.fn(),
    useRequestFormUpload: () => ({
        files: ref([
            { file: new File([''], 'a.xlsx'), fileKey: '자금운용실/a.xlsx', deptName: '자금운용실' },
            { file: new File([''], 'b.xlsx'), fileKey: '자금운용실/b.xlsx', deptName: '자금운용실' },
            { file: new File([''], 'c.xls'), fileKey: '런던지점/c.xls', deptName: '런던지점' },
        ]),
        batches: ref([]),
        progress: ref(0),
        results: ref([]),
        summary: ref(null),
        isRunning: ref(false),
        selectFiles: vi.fn(),
        runDryRun: vi.fn(),
        runCommit: vi.fn(),
        reset: vi.fn(),
    }),
}));

const { useRequestFormPage } = await import('~/composables/migration/useRequestFormPage');

describe('useRequestFormPage', () => {
    it('부서 폴더별로 파일을 묶는다', () => {
        const page = useRequestFormPage();

        expect(page.deptGroups.value.map((g) => g.deptName)).toEqual(['자금운용실', '런던지점']);
        expect(page.deptGroups.value[0]!.fileKeys).toHaveLength(2);
    });

    it('부서 보정은 그 폴더의 모든 파일에 적용된다', () => {
        const page = useRequestFormPage();

        page.applyDeptOverride('자금운용실', '0210');

        const applied = page.entries.value.filter((e) => e.deptCodeOverride === '0210');
        expect(applied).toHaveLength(2);
    });

    it('단위 보정도 폴더 단위로 적용된다', () => {
        const page = useRequestFormPage();

        page.applyUnitOverride('런던지점', 1000);

        expect(page.entries.value.find((e) => e.fileKey === '런던지점/c.xls')?.generalExpenseMultiplier).toBe(1000);
    });

    it('셀 보정은 같은 키를 덮어쓴다', () => {
        const page = useRequestFormPage();

        page.applyCellOverride('자금운용실/a.xlsx', 'GENERAL_EXPENSE', 6, 'ioeC', '010');
        page.applyCellOverride('자금운용실/a.xlsx', 'GENERAL_EXPENSE', 6, 'ioeC', '011');

        expect(page.overrides.value).toHaveLength(1);
        expect(page.overrides.value[0]!.value).toBe('011');
    });

    it('BLOCKER가 남아 있으면 반영 버튼을 열지 않는다', () => {
        const page = useRequestFormPage();
        page.upload.results.value = [
            {
                fileKey: '자금운용실/a.xlsx',
                deptName: '자금운용실',
                status: 'BLOCKED',
                diagnostics: [],
                created: [],
                suggestedGeneralExpenseMultiplier: null,
            },
        ] as never;

        expect(page.canCommit.value).toBe(false);
    });

    it('사전검증을 마쳤고 BLOCKER가 없으면 반영 버튼을 연다', () => {
        const page = useRequestFormPage();
        page.upload.results.value = [
            {
                fileKey: '자금운용실/a.xlsx',
                deptName: '자금운용실',
                status: 'APPLIED',
                diagnostics: [],
                created: [],
                suggestedGeneralExpenseMultiplier: 1,
            },
        ] as never;

        expect(page.canCommit.value).toBe(true);
    });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd it_frontend && npm test -- useRequestFormPage`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 파사드 작성**

`it_frontend/app/composables/migration/useRequestFormPage.ts` — 800줄 상한을 지키도록 상태·보정만 담고 렌더링은 컴포넌트가 맡는다.

```ts
/**
 * ============================================================================
 * [migration/useRequestFormPage.ts] 편성요청서 반입 화면 상태
 * ============================================================================
 * 폴더 단위 보정(부서·단위·사업코드)과 셀 단위 보정을 관리하고, 사전검증·반영을
 * 순서대로 실행합니다. 수백 건을 다루므로 보정은 파일 하나씩이 아니라 폴더 단위로
 * 한 번에 적용합니다.
 * ============================================================================
 */
import type { components } from '~/types/api';
import { useRequestFormUpload } from '~/composables/migration/useRequestFormUpload';

type FileEntry = components['schemas']['RequestFormFileEntry'];
type CellOverride = components['schemas']['RequestFormCellOverride'];
type SheetKind = components['schemas']['RequestFormSheetKind'];

/** 같은 부서 폴더에 속한 파일 묶음. 보정 적용 단위입니다. */
export interface DeptGroup {
    deptName: string;
    fileKeys: string[];
}

/**
 * 편성요청서 반입 화면 상태 파사드.
 *
 * @returns 예산연도·업로드 상태·보정값과 실행 함수
 */
export function useRequestFormPage() {
    const upload = useRequestFormUpload();
    const bseYy = ref(String(new Date().getFullYear() + 1));
    const overrides = ref<CellOverride[]>([]);
    const entries = ref<FileEntry[]>([]);
    const hasDryRun = ref(false);

    watch(
        () => upload.files.value,
        (files) => {
            entries.value = files.map((file) => ({
                fileKey: file.fileKey,
                deptName: file.deptName,
                deptCodeOverride: null,
                generalExpenseMultiplier: null,
                bgUntAbusC: null,
            }));
            overrides.value = [];
            hasDryRun.value = false;
        },
        { immediate: true },
    );

    const deptGroups = computed<DeptGroup[]>(() => {
        const groups = new Map<string, string[]>();
        for (const file of upload.files.value) {
            const keys = groups.get(file.deptName) ?? [];
            keys.push(file.fileKey);
            groups.set(file.deptName, keys);
        }
        return Array.from(groups, ([deptName, fileKeys]) => ({ deptName, fileKeys }));
    });

    const canCommit = computed(
        () =>
            hasDryRun.value &&
            upload.results.value.length > 0 &&
            upload.results.value.every((result) => result.status === 'APPLIED'),
    );

    /**
     * 부서코드를 폴더의 모든 파일에 적용합니다.
     *
     * @param deptName 폴더명
     * @param deptCode 사용자가 고른 부서코드
     */
    function applyDeptOverride(deptName: string, deptCode: string): void {
        patchEntries(deptName, (entry) => ({ ...entry, deptCodeOverride: deptCode }));
    }

    /**
     * 시트 ③ 금액 배수를 폴더의 모든 파일에 적용합니다.
     *
     * @param deptName 폴더명
     * @param multiplier 1·1000·1000000 중 하나
     */
    function applyUnitOverride(deptName: string, multiplier: number): void {
        patchEntries(deptName, (entry) => ({ ...entry, generalExpenseMultiplier: multiplier }));
    }

    /**
     * 시트 ③ 사업코드를 폴더의 모든 파일에 적용합니다.
     *
     * @param deptName 폴더명
     * @param bgUntAbusC 사업코드
     */
    function applyBudgetUnitOverride(deptName: string, bgUntAbusC: string): void {
        patchEntries(deptName, (entry) => ({ ...entry, bgUntAbusC }));
    }

    /**
     * 셀 단위 보정을 기록합니다. 같은 (파일·시트·행·필드)는 덮어씁니다.
     *
     * @param fileKey 대상 파일
     * @param sheet 시트 종류. 파일 전체 보정이면 null
     * @param excelRow 엑셀 행 번호. 행에 매이지 않으면 null
     * @param field 필드 id
     * @param value 사용자가 고른 값
     */
    function applyCellOverride(
        fileKey: string,
        sheet: SheetKind | null,
        excelRow: number | null,
        field: string,
        value: string,
    ): void {
        const isSame = (o: CellOverride) =>
            o.fileKey === fileKey && o.sheet === sheet && o.excelRow === excelRow && o.field === field;
        overrides.value = [...overrides.value.filter((o) => !isSame(o)), { fileKey, sheet, excelRow, field, value }];
    }

    function patchEntries(deptName: string, patch: (entry: FileEntry) => FileEntry): void {
        entries.value = entries.value.map((entry) => (entry.deptName === deptName ? patch(entry) : entry));
    }

    /**
     * 사전검증을 실행합니다.
     *
     * @throws Error 요청 실패를 그대로 전파합니다. 화면이 Toast·배너로 알립니다
     */
    async function dryRun(): Promise<void> {
        await upload.runDryRun(bseYy.value, entries.value, overrides.value);
        hasDryRun.value = true;
    }

    /**
     * 반영을 실행합니다. 반영 후에는 다시 사전검증을 거치도록 상태를 되돌립니다.
     *
     * @throws Error 요청 실패를 그대로 전파합니다
     */
    async function commit(): Promise<void> {
        await upload.runCommit(bseYy.value, entries.value, overrides.value);
        hasDryRun.value = false;
    }

    return {
        bseYy,
        upload,
        entries,
        overrides,
        deptGroups,
        canCommit,
        applyDeptOverride,
        applyUnitOverride,
        applyBudgetUnitOverride,
        applyCellOverride,
        dryRun,
        commit,
    };
}
```

- [ ] **Step 4: 폴더 선택기 작성**

`it_frontend/app/components/migration/RequestFormFolderPicker.vue`:

```vue
<script setup lang="ts">
/**
 * 부점 편성요청서 폴더 선택기.
 *
 * `webkitdirectory`로 폴더를 통째로 받고, 최상위 폴더별로 부서·금액 단위·사업코드를
 * 한 번에 지정하게 합니다. 수백 건을 파일 하나씩 고치는 것은 현실적이지 않습니다.
 */
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import type { DeptGroup } from '~/composables/migration/useRequestFormPage';

const props = defineProps<{
    deptGroups: DeptGroup[];
    fileCount: number;
    bseYy: string;
    isRunning: boolean;
    progress: number;
}>();

const emit = defineEmits<{
    (event: 'select', files: FileList): void;
    (event: 'update:bseYy', value: string): void;
    (event: 'dept-override', deptName: string, deptCode: string): void;
    (event: 'unit-override', deptName: string, multiplier: number): void;
    (event: 'budget-unit-override', deptName: string, bgUntAbusC: string): void;
}>();

/** 시트 ③ 금액 단위 선택지. 서버 `allowableValues`와 같은 값 집합입니다. */
const unitOptions = [
    { label: '원', value: 1 },
    { label: '천원', value: 1000 },
    { label: '백만원', value: 1000000 },
];

const folderInput = ref<HTMLInputElement | null>(null);

function onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) emit('select', input.files);
}
</script>

<template>
    <section class="folder-picker">
        <div class="folder-picker__actions">
            <label class="folder-picker__year">
                예산연도
                <InputText
                    :model-value="props.bseYy"
                    maxlength="4"
                    class="folder-picker__year-input"
                    @update:model-value="emit('update:bseYy', $event ?? '')"
                />
            </label>

            <!-- webkitdirectory는 Vue prop으로 넘기면 문자열로 직렬화돼 무시되므로 속성으로 직접 쓴다 -->
            <input
                ref="folderInput"
                type="file"
                webkitdirectory
                multiple
                accept=".xlsx,.xls"
                class="folder-picker__input"
                @change="onPicked"
            />
            <Button
                label="부서 폴더 선택"
                icon="pi pi-folder-open"
                :disabled="props.isRunning"
                @click="folderInput?.click()"
            />
            <span class="folder-picker__count">선택된 파일 {{ props.fileCount }}건</span>
        </div>

        <div v-if="props.isRunning" class="folder-picker__progress">진행 {{ props.progress }}%</div>

        <table v-if="props.deptGroups.length" class="folder-picker__groups">
            <thead>
                <tr>
                    <th>폴더(부서)</th>
                    <th>파일 수</th>
                    <th>부서코드</th>
                    <th>일반관리비 단위</th>
                    <th>사업코드</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="group in props.deptGroups" :key="group.deptName">
                    <td>{{ group.deptName || '(폴더 없음)' }}</td>
                    <td>{{ group.fileKeys.length }}</td>
                    <td>
                        <InputText
                            class="folder-picker__cell-input"
                            placeholder="자동 해석"
                            @update:model-value="emit('dept-override', group.deptName, $event ?? '')"
                        />
                    </td>
                    <td>
                        <Dropdown
                            :options="unitOptions"
                            option-label="label"
                            option-value="value"
                            placeholder="자동 추정"
                            @update:model-value="emit('unit-override', group.deptName, $event)"
                        />
                    </td>
                    <td>
                        <InputText
                            class="folder-picker__cell-input"
                            placeholder="미지정"
                            @update:model-value="emit('budget-unit-override', group.deptName, $event ?? '')"
                        />
                    </td>
                </tr>
            </tbody>
        </table>
    </section>
</template>

<style scoped>
.folder-picker__input {
    display: none;
}

.folder-picker__actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
}

.folder-picker__groups {
    width: 100%;
    margin-top: var(--spacing-4);
}

.folder-picker__cell-input {
    width: 100%;
}
</style>
```

- [ ] **Step 5: 결과 표 작성**

`it_frontend/app/components/migration/RequestFormResultTable.vue` — `StyledDataTable`로 파일별 행을 그리고 **진단이 있는 파일만 확장 행을 연다**. 정상 파일은 접힌 요약 행으로 둔다.

```vue
<script setup lang="ts">
/**
 * 편성요청서 반입 결과 표.
 *
 * 수백 건을 한 화면에 다 펼치면 읽을 수 없어, 진단이 있는 파일만 확장 행을 열어
 * 보정 컨트롤을 보여 줍니다. 정상 파일은 상태 배지만 있는 한 줄로 둡니다.
 */
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import type { components } from '~/types/api';

type FileResult = components['schemas']['RequestFormFileResult'];
type FormDiagnostic = components['schemas']['RequestFormDiagnostic'];

const props = defineProps<{ results: FileResult[] }>();
const emit = defineEmits<{
    (
        event: 'cell-override',
        fileKey: string,
        sheet: FormDiagnostic['sheet'],
        excelRow: number | null,
        field: string,
        value: string,
    ): void;
}>();

/** 진단이 있는 파일만 펼친다. 정상 파일까지 열면 수백 행이 되어 읽을 수 없다. */
const expandedRows = computed(() =>
    Object.fromEntries(
        props.results.filter((result) => result.diagnostics.length > 0).map((result) => [result.fileKey, true]),
    ),
);

const statusLabel: Record<FileResult['status'], string> = {
    APPLIED: '반영',
    BLOCKED: '차단',
    FAILED: '실패',
};
</script>

<template>
    <StyledDataTable
        :value="props.results"
        data-key="fileKey"
        :expanded-rows="expandedRows"
        class="result-table"
    >
        <Column expander class="result-table__expander" />
        <Column field="fileKey" header="파일" />
        <Column field="deptName" header="부서" />
        <Column header="상태">
            <template #body="{ data }">
                <span :class="`result-table__status result-table__status--${data.status.toLowerCase()}`">
                    {{ statusLabel[data.status as FileResult['status']] }}
                </span>
            </template>
        </Column>
        <Column header="생성">
            <template #body="{ data }">{{ data.created.length }}건</template>
        </Column>

        <template #expansion="{ data }">
            <ul class="result-table__diagnostics">
                <li v-for="(diagnostic, index) in data.diagnostics" :key="index">
                    <span class="result-table__severity">{{ diagnostic.severity }}</span>
                    <span class="result-table__message">{{ diagnostic.message }}</span>
                    <Dropdown
                        v-if="diagnostic.candidates.length"
                        :options="diagnostic.candidates"
                        option-label="label"
                        option-value="code"
                        placeholder="후보 선택"
                        @update:model-value="
                            emit(
                                'cell-override',
                                data.fileKey,
                                diagnostic.sheet,
                                diagnostic.excelRow,
                                diagnostic.field ?? '',
                                $event,
                            )
                        "
                    />
                </li>
            </ul>
        </template>
    </StyledDataTable>
</template>

<style scoped>
.result-table__diagnostics {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
}

.result-table__status--blocked,
.result-table__status--failed {
    color: var(--color-danger);
}
</style>
```

- [ ] **Step 6: 페이지 작성**

`it_frontend/app/pages/admin/migration/requests.vue`:

```vue
<script setup lang="ts">
/**
 * 부점 편성요청서 반입 화면.
 *
 * 라우팅과 화면 조합만 담당합니다. 상태와 업무 흐름은 `useRequestFormPage`에 있습니다.
 */
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import RequestFormFolderPicker from '~/components/migration/RequestFormFolderPicker.vue';
import RequestFormResultTable from '~/components/migration/RequestFormResultTable.vue';
import { useRequestFormPage } from '~/composables/migration/useRequestFormPage';
import { formatApiError } from '~/utils/common';
import { TOAST_LIFE } from '~/utils/toast';

definePageMeta({ middleware: 'admin', tabTitle: '편성요청서 반입' });

const page = useRequestFormPage();
const toast = useToast();
const errorMessage = ref('');

async function runDryRun(): Promise<void> {
    errorMessage.value = '';
    try {
        await page.dryRun();
    } catch (error) {
        errorMessage.value = formatApiError(error, '사전검증에 실패했습니다.');
        toast.add({ severity: 'error', summary: '사전검증 실패', detail: errorMessage.value, life: TOAST_LIFE });
    }
}

async function runCommit(): Promise<void> {
    errorMessage.value = '';
    try {
        await page.commit();
        toast.add({ severity: 'success', summary: '반입 완료', life: TOAST_LIFE });
    } catch (error) {
        errorMessage.value = formatApiError(error, '반입에 실패했습니다.');
        toast.add({ severity: 'error', summary: '반입 실패', detail: errorMessage.value, life: TOAST_LIFE });
    }
}
</script>

<template>
    <div class="request-form-page">
        <h1 class="request-form-page__title">편성요청서 반입</h1>

        <RequestFormFolderPicker
            :dept-groups="page.deptGroups.value"
            :file-count="page.upload.files.value.length"
            :bse-yy="page.bseYy.value"
            :is-running="page.upload.isRunning.value"
            :progress="page.upload.progress.value"
            @update:bse-yy="page.bseYy.value = $event"
            @select="page.upload.selectFiles"
            @dept-override="page.applyDeptOverride"
            @unit-override="page.applyUnitOverride"
            @budget-unit-override="page.applyBudgetUnitOverride"
        />

        <Message v-if="errorMessage" severity="error" :closable="false">{{ errorMessage }}</Message>

        <div class="request-form-page__actions">
            <Button
                label="사전검증"
                :disabled="page.upload.isRunning.value || page.upload.files.value.length === 0"
                @click="runDryRun"
            />
            <Button
                label="반영"
                severity="success"
                :disabled="page.upload.isRunning.value || !page.canCommit.value"
                @click="runCommit"
            />
        </div>

        <p v-if="page.upload.summary.value" class="request-form-page__summary">
            전체 {{ page.upload.summary.value.totalFiles }}건 / 반영 {{ page.upload.summary.value.appliedFiles }}건 /
            차단 {{ page.upload.summary.value.blockedFiles }}건 — 사업
            {{ page.upload.summary.value.createdProjects }}건, 품목 {{ page.upload.summary.value.createdItems }}건,
            전산업무비 {{ page.upload.summary.value.createdCosts }}건
        </p>

        <RequestFormResultTable
            :results="page.upload.results.value"
            @cell-override="page.applyCellOverride"
        />
    </div>
</template>

<style scoped>
.request-form-page__actions {
    display: flex;
    gap: var(--spacing-3);
    margin: var(--spacing-4) 0;
}
</style>
```

CSS 클래스명은 kebab-case·BEM을 지켰고 DB 컬럼명을 그대로 쓰지 않았다. `components/common`의 `StyledDataTable`은 명시적으로 import 한다. 세 파일 모두 800줄을 넘지 않는다.

- [ ] **Step 7: 경계 테스트 갱신**

`tests/unit/architecture/component-boundaries.test.ts`의 `components/migration/` 목록에 `RequestFormFolderPicker.vue`·`RequestFormResultTable.vue`를 추가한다.

`tests/unit/pages/requestFormMigrationPageBoundary.test.ts`를 만들어 `app/pages/admin/migration/requests.vue`가 `useRequestFormPage`를 소비하는지 고정한다. 기존 `*PageBoundary.test.ts` 하나를 열어 같은 방식으로 작성한다.

Run: `cd it_frontend && ls tests/unit/pages/`

- [ ] **Step 8: 화면 품질 게이트**

Run: `cd it_frontend && npm run format:check && npm run check && npm run lint:css && npm test`
Expected: 전부 통과.

- [ ] **Step 9: 커밋**

```bash
git -C it_frontend add app/components/migration app/composables/migration app/pages/admin/migration tests/unit
git -C it_frontend commit -m "feat(migration): 편성요청서 반입 화면

수백 건을 한 표에 다 펼치면 쓸 수 없어 진단 있는 파일만 펼치고 정상 파일은
접힌 요약 행으로 둔다. 보정은 파일 하나씩이 아니라 부서 폴더 단위로 한 번에
적용한다.

반영 후에는 사전검증 상태를 되돌린다. 원장이 바뀌었으므로 이전 검증 결과를
그대로 두면 중복 판정이 낡은 상태로 남는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 16: 통합 검증

실제 Oracle에서 파일 단위 원자성을 확인하고 사용자 흐름을 E2E로 고정한다.

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/RequestFormImportIt.java`
- Test: `it_frontend/tests/e2e/request-form-migration.spec.ts`
- Modify: `TASK.md`

**Interfaces:**
- Consumes: Task 1–15 전부, `AbstractOracleRepositoryTest`
- Produces: 없음 (검증만)

- [ ] **Step 1: Oracle 통합 테스트 작성**

기존 `MigrationImportIt`의 스프링 컨텍스트 설정(어노테이션·프로파일·`@Tag`)을 먼저 읽어 그대로 따른다.

Run: `cd it_backend && sed -n '1,60p' src/test/java/com/kdb/it/domain/migration/MigrationImportIt.java`

그 설정을 클래스 어노테이션에 그대로 옮긴 뒤 아래 본문을 쓴다.

```java
package com.kdb.it.domain.migration.request;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.migration.request.dto.RequestFormDiagnosticCode;
import com.kdb.it.domain.migration.request.dto.RequestFormDto;
import com.kdb.it.domain.migration.request.service.RequestFormImportService;
import com.kdb.it.domain.migration.request.support.RequestFormFixtures;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

/**
 * 편성요청서 반입의 Oracle 통합 검증입니다.
 *
 * <p>단위 테스트로는 확인할 수 없는 두 가지를 봅니다 — 파일 단위 `REQUIRES_NEW` 경계가 실제 트랜잭션에서 동작하는지, 그리고 편성행을 만들지 않는다는
 * 결정이 코드에 남아 있는지입니다.
 */
@Tag("it")
class RequestFormImportIt /* MigrationImportIt과 같은 컨텍스트 어노테이션을 붙인다 */ {

    /** 이 테스트 전용 예산연도. 기존 데이터와 섞이지 않게 미래 연도를 쓴다. */
    private static final String TEST_YEAR = "2099";

    @Autowired private RequestFormImportService importService;
    @Autowired private JdbcTemplate jdbcTemplate;

    private static MultipartFile file(String name, byte[] bytes) {
        return new MockMultipartFile("files", name, "application/vnd.ms-excel", bytes);
    }

    private static RequestFormDto.ImportManifest manifest(String... fileKeys) {
        List<RequestFormDto.FileEntry> entries =
                java.util.Arrays.stream(fileKeys)
                        .map(key -> new RequestFormDto.FileEntry(key, key.split("/")[0], null, 1L, null))
                        .toList();
        return new RequestFormDto.ImportManifest(TEST_YEAR, entries, List.of());
    }

    private int countOf(String table) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM ITPOWN.TPRMPP_" + table + " WHERE BSE_YY = ? AND DEL_YN = 'N'",
                Integer.class,
                TEST_YEAR);
    }

    @Test
    @DisplayName("파일 1건을 반영하면 사업·품목·전산업무비가 결재완료 상태로 생긴다")
    void createsLedgerWithCompletedApproval() {
        RequestFormDto.ImportResponse response =
                importService.importBatch(
                        List.of(file("요청서.xls", RequestFormFixtures.fullFormXls())),
                        manifest("자금운용실/요청서.xls"),
                        "12345678",
                        false);

        assertThat(response.files().get(0).status()).isEqualTo(RequestFormDto.FileStatus.APPLIED);
        assertThat(countOf("BPROJM")).isGreaterThanOrEqualTo(1);
        assertThat(countOf("BCOSTM")).isGreaterThanOrEqualTo(1);

        Integer completedApprovals =
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM ITPOWN.TPRMPP_CAPPLM m"
                                + " JOIN ITPOWN.TPRMPP_CAPPLA a ON a.APF_DCM_NO = m.APF_MNG_NO"
                                + " WHERE m.IT_PTL_APF_PRG_STS_C = '2' AND m.DCD_REQ_TTL LIKE '[편성요청서 반입]%'",
                        Integer.class);
        assertThat(completedApprovals).isGreaterThanOrEqualTo(2);
    }

    @Test
    @DisplayName("깨진 파일이 섞여도 정상 파일은 반영된다")
    void appliesHealthyFileWhenAnotherFails() {
        int before = countOf("BCOSTM");

        RequestFormDto.ImportResponse response =
                importService.importBatch(
                        List.of(
                                file("깨진.xlsx", "엑셀 아님".getBytes(StandardCharsets.UTF_8)),
                                file("요청서.xls", RequestFormFixtures.fullFormXls())),
                        manifest("자금운용실/깨진.xlsx", "런던지점/요청서.xls"),
                        "12345678",
                        false);

        assertThat(response.files().get(0).status()).isEqualTo(RequestFormDto.FileStatus.FAILED);
        assertThat(response.files().get(1).status()).isEqualTo(RequestFormDto.FileStatus.APPLIED);
        assertThat(countOf("BCOSTM")).isGreaterThan(before);
    }

    @Test
    @DisplayName("같은 파일을 두 번 반영하면 두 번째는 중복으로 차단되고 원장이 늘지 않는다")
    void rejectsReupload() {
        importService.importBatch(
                List.of(file("요청서.xls", RequestFormFixtures.fullFormXls())),
                manifest("자금운용실/요청서.xls"),
                "12345678",
                false);
        int after1st = countOf("BCOSTM");

        RequestFormDto.ImportResponse second =
                importService.importBatch(
                        List.of(file("요청서.xls", RequestFormFixtures.fullFormXls())),
                        manifest("자금운용실/요청서.xls"),
                        "12345678",
                        false);

        assertThat(second.files().get(0).status()).isEqualTo(RequestFormDto.FileStatus.BLOCKED);
        assertThat(second.files().get(0).diagnostics())
                .extracting(RequestFormDto.FormDiagnostic::code)
                .contains(RequestFormDiagnosticCode.DUPLICATE_EXISTS);
        assertThat(countOf("BCOSTM")).isEqualTo(after1st);
    }

    @Test
    @DisplayName("반입은 편성행을 만들지 않는다")
    void neverCreatesBudgetRows() {
        importService.importBatch(
                List.of(file("요청서.xls", RequestFormFixtures.fullFormXls())),
                manifest("자금운용실/요청서.xls"),
                "12345678",
                false);

        // applyItemRates는 연도 전량을 논리삭제한 뒤 재삽입하므로 이 경로에서 절대 부르면 안 된다
        assertThat(countOf("BBUGTM")).isZero();
    }
}
```

부서 폴더명(`자금운용실`·`런던지점`)이 로컬 `CORGNI`에 없으면 파일이 `BLOCKED`로 떨어진다. 테스트 시작 전에 로컬 조직 데이터에 실재하는 부서명 두 개를 조회해 상수로 바꾼다.

Run: `sqlplus ITPAPP@127.0.0.1:11521/XEPDB1` 접속 후 `SELECT BBR_NM FROM ITPOWN.TPRMPP_CORGNI WHERE DEL_YN = 'N' AND ROWNUM <= 5;`

- [ ] **Step 2: 통합 테스트 실행**

Run: `cd it_backend && ./gradlew integrationTest --tests "*RequestFormImportIt*"`
Expected: PASS — 4개 테스트 전부 성공.

2번이 실패하면 `RequestFormImportService`에 `@Transactional`이 잘못 붙어 있는지 먼저 확인한다.

- [ ] **Step 3: E2E 시나리오 작성**

기존 `tests/e2e/migration.spec.ts`의 로그인 헬퍼와 기본 설정을 먼저 읽어 그대로 재사용한다.

Run: `cd it_frontend && sed -n '1,50p' tests/e2e/migration.spec.ts`

`it_frontend/tests/e2e/request-form-migration.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 부점 편성요청서 반입 흐름.
 *
 * webkitdirectory 입력은 Playwright `setInputFiles`로 채울 수 있지만 relativePath는
 * 채워지지 않으므로, 화면이 폴더명을 못 얻는 경우의 수동 부서 지정 경로까지 함께 확인한다.
 */
const FIXTURE = resolve(__dirname, 'fixtures/편성요청서-샘플.xlsx');

test.describe('편성요청서 반입', () => {
    test.beforeEach(async ({ page }) => {
        // migration.spec.ts와 같은 관리자 로그인 헬퍼를 재사용한다
        await page.goto('/admin/migration/requests');
    });

    test('폴더를 올려 사전검증하고 반영한다', async ({ page }) => {
        await expect(page.getByRole('heading', { name: '편성요청서 반입' })).toBeVisible();

        await page.locator('input[webkitdirectory]').setInputFiles({
            name: '편성요청서-샘플.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            buffer: readFileSync(FIXTURE),
        });
        await expect(page.getByText(/선택된 파일 1건/)).toBeVisible();

        // 폴더명이 없으므로 부서를 직접 지정한다
        await page.getByPlaceholder('자동 해석').first().fill('0210');

        await page.getByRole('button', { name: '사전검증' }).click();
        await expect(page.locator('.result-table')).toBeVisible();

        const commitButton = page.getByRole('button', { name: '반영' });
        if (await commitButton.isEnabled()) {
            await commitButton.click();
            await expect(page.getByText(/전체 1건/)).toBeVisible();
        } else {
            // BLOCKER가 남아 있으면 반영 버튼이 열리지 않는다는 계약을 확인한다
            await expect(page.locator('.result-table__status--blocked')).toBeVisible();
        }
    });
});
```

픽스처 `tests/e2e/fixtures/편성요청서-샘플.xlsx`는 실 제출본을 쓰지 않는다. 백엔드 `RequestFormFixtures.capitalOnlyXlsx()`가 만드는 것과 같은 내용을 한 번 생성해 저장한다.

Run: `cd it_backend && ./gradlew test --tests "*WorkbookReaderTest*"` 를 실행할 때 픽스처를 파일로 떨어뜨리는 임시 테스트를 추가해 뽑아낸 뒤, 그 임시 테스트는 지운다.

- [ ] **Step 4: E2E 실행**

Run: `cd it_frontend && npm run test:e2e -- request-form-migration`
Expected: PASS.

- [ ] **Step 5: 전체 품질 게이트**

Run: `cd it_backend && ./gradlew clean check`
Expected: BUILD SUCCESSFUL (Spotless·테스트·JaCoCo 전부 통과).

Run: `cd it_frontend && npm run format:check && npm run check && npm run lint:css && npm test && npm run codegen:check`
Expected: 전부 통과.

- [ ] **Step 6: 남은 과제 기록**

`TASK.md`에 아래 두 항목을 추가한다.

- 편성요청서 반입 후 편성행 생성은 예산작업 화면에서 별도로 수행해야 한다. 반입만으로는 예산 현황에 0으로 나온다는 운영 절차를 문서화할 것.
- `FormLexicon`의 국문·영문 대조표는 런던지점 제출본 1건에서 뽑았다. 다른 해외점포 제출본이 들어오면 미해석 어휘를 수집해 대조표를 보강할 것.

- [ ] **Step 7: 커밋**

```bash
git -C it_backend add src/test/java/com/kdb/it/domain/migration/request/RequestFormImportIt.java
git -C it_backend commit -m "test(migration): 편성요청서 반입 Oracle 통합 검증

BLOCKER 파일과 정상 파일을 함께 반영해 정상 파일만 커밋되는지 확인한다.
REQUIRES_NEW 경계가 실제로 동작하는지가 이 기능의 핵심 계약이다.

편성행을 만들지 않는다는 결정도 함께 고정한다. applyItemRates를 부르면
연도 전량이 논리삭제되므로 이 경로에서 절대 부르면 안 된다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git -C it_frontend add tests/e2e/request-form-migration.spec.ts
git -C it_frontend commit -m "test(migration): 편성요청서 반입 E2E 시나리오

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

git add TASK.md
git commit -m "docs: 편성요청서 반입 후속 과제 등록

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 8: versions.lock 갱신**

세 저장소에 커밋이 들어갔으므로 호환 조합을 기록한다.

Run: `pwsh -File scripts/update-versions-lock.ps1`

```bash
git add versions.lock
git commit -m "chore: 편성요청서 반입 반영 후 versions.lock 갱신

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

