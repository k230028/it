# 결재요청 메일 서식 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결재요청 메일에 신청서 개요와 예산 총괄표를 담고, 서식을 포탈·PDF 신청서와 같은 계열로 맞춘다.

**Architecture:** 상신 시점 스냅샷 JSON(`Capplm.dcdReqInf`)으로 메일 HTML을 렌더링해 `NotificationEvent.sdPayload`에 싣는다. 기존 `SD_DOC_CONE` 배선이 이를 dispatcher까지 나르므로 마이그레이션·신규 컬럼이 없다. dispatcher는 페이로드가 있으면 쓰고 없으면 기존 두 줄짜리 본문으로 폴백한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Jackson, JUnit 5, AssertJ, Mockito, Gradle, Spotless(google-java-format AOSP)

설계 문서: `docs/superpowers/specs/2026-08-18-approval-request-mail-template-design.md`

## Global Constraints

- 작업 디렉터리는 `C:\it\it_backend`. 모든 경로는 이 디렉터리 기준이다.
- 신규 주석·Javadoc은 한글로 쓴다. public/service 메서드 Javadoc에는 입력값과 실패 조건을 적는다.
- 커밋 전 반드시 `./gradlew spotlessApply`를 실행한다. Spotless(google-java-format AOSP)가 `./gradlew check`의 게이트다.
- `git add`는 경로를 명시한다. `git add -A`, `git add .`, `git commit -a`를 쓰지 않는다.
- 커밋 메시지 본문 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`를 넣는다.
- 외부 JSON은 `JsonNode`가 아니라 전용 record로 받는다.
- 메일 본문 바이트 예산은 UTF-8 기준 **4000바이트** (GWE 전문 `CONTENTS` 필드 폭).
- PDF 신청서 테마 색을 그대로 쓴다 — 타이틀 `#1e3a8a`, 표 머리글 배경 `#f3f4f6`, 테두리 `#d1d5db`.
- 총괄표 필드 매핑은 설계 문서 §5.3이 계약이다. 임의로 다른 필드를 쓰지 않는다.

---

### Task 1: 스냅샷 JSON 파싱 모델

`Capplm.dcdReqInf`의 `{ form, projects, costs, approvalLine }` 중 총괄표에 필요한 두 배열만 받는 record를 만든다. 프론트가 필드를 추가해도 깨지지 않아야 한다.

**Files:**
- Create: `src/main/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshot.java`
- Test: `src/test/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshotTest.java`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `ApprovalMailSnapshot(List<ProjectItem> projects, List<CostItem> costs)`
  - `ApprovalMailSnapshot.ProjectItem(String abusNm, String odnYn, BigDecimal totRqmAmt, BigDecimal assetBg, BigDecimal costBg)`
  - `ApprovalMailSnapshot.CostItem(String cttNm, BigDecimal costTotXpAmt, BigDecimal assetBg)`
  - `static ApprovalMailSnapshot empty()`
  - `ProjectItem.ordinary()` → `boolean`; `ProjectItem.total()/asset()/cost()` → `BigDecimal` (null이면 `BigDecimal.ZERO`)
  - `CostItem.total()/asset()/cost()` → `BigDecimal` (`cost()`는 `total() - asset()`)

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/test/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshotTest.java`

```java
package com.kdb.it.common.approval.mail;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 신청서 스냅샷 JSON 파싱과 금액 파생값을 검증한다. */
class ApprovalMailSnapshotTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("신청서 스냅샷의 사업·전산업무비 배열을 읽는다")
    void parse_readsProjectsAndCosts() throws Exception {
        String json =
                """
                {
                  "form": {"id": "IT_BUDGET", "version": 1},
                  "projects": [
                    {"abusNm": "차세대 시스템", "odnYn": "N", "totRqmAmt": 1000,
                     "assetBg": 600, "costBg": 400}
                  ],
                  "costs": [
                    {"cttNm": "유지보수 계약", "costTotXpAmt": 500, "assetBg": 200}
                  ],
                  "approvalLine": {"approvers": []}
                }
                """;

        ApprovalMailSnapshot snapshot = objectMapper.readValue(json, ApprovalMailSnapshot.class);

        assertThat(snapshot.projects()).hasSize(1);
        assertThat(snapshot.projects().get(0).abusNm()).isEqualTo("차세대 시스템");
        assertThat(snapshot.costs()).hasSize(1);
        assertThat(snapshot.costs().get(0).cttNm()).isEqualTo("유지보수 계약");
    }

    @Test
    @DisplayName("모르는 필드가 있어도 파싱이 깨지지 않는다")
    void parse_ignoresUnknownFields() throws Exception {
        String json =
                "{\"projects\": [{\"abusNm\": \"사업\", \"future\": \"값\"}], \"costs\": [],"
                        + " \"extra\": 1}";

        ApprovalMailSnapshot snapshot = objectMapper.readValue(json, ApprovalMailSnapshot.class);

        assertThat(snapshot.projects()).hasSize(1);
    }

    @Test
    @DisplayName("배열이 없으면 빈 목록으로 접는다")
    void parse_missingArrays_returnsEmptyLists() throws Exception {
        ApprovalMailSnapshot snapshot = objectMapper.readValue("{}", ApprovalMailSnapshot.class);

        assertThat(snapshot.projects()).isEmpty();
        assertThat(snapshot.costs()).isEmpty();
        assertThat(ApprovalMailSnapshot.empty().projects()).isEmpty();
    }

    @Test
    @DisplayName("경상여부는 odnYn이 Y일 때만 참이다")
    void projectItem_ordinaryFlag() {
        assertThat(new ApprovalMailSnapshot.ProjectItem("a", "Y", null, null, null).ordinary())
                .isTrue();
        assertThat(new ApprovalMailSnapshot.ProjectItem("a", "N", null, null, null).ordinary())
                .isFalse();
        assertThat(new ApprovalMailSnapshot.ProjectItem("a", null, null, null, null).ordinary())
                .isFalse();
    }

    @Test
    @DisplayName("null 금액은 0으로 취급한다")
    void nullAmounts_treatedAsZero() {
        ApprovalMailSnapshot.ProjectItem project =
                new ApprovalMailSnapshot.ProjectItem("a", "N", null, null, null);

        assertThat(project.total()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(project.asset()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(project.cost()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("전산업무비 일반관리비는 총 예산에서 자본예산을 뺀 값이다")
    void costItem_costIsTotalMinusAsset() {
        ApprovalMailSnapshot.CostItem cost =
                new ApprovalMailSnapshot.CostItem(
                        "계약", new BigDecimal("500"), new BigDecimal("200"));

        assertThat(cost.total()).isEqualByComparingTo(new BigDecimal("500"));
        assertThat(cost.asset()).isEqualByComparingTo(new BigDecimal("200"));
        assertThat(cost.cost()).isEqualByComparingTo(new BigDecimal("300"));
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.mail.*'`
Expected: 컴파일 실패 — `ApprovalMailSnapshot` 심볼을 찾을 수 없음

- [ ] **Step 3: 최소 구현을 작성한다**

`src/main/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshot.java`

```java
package com.kdb.it.common.approval.mail;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.math.BigDecimal;
import java.util.List;

/**
 * 결재요청 메일이 읽는 신청서 상세 스냅샷.
 *
 * <p>{@code Capplm.dcdReqInf}에 저장된 신청서 JSON({@code form}/{@code projects}/{@code costs}/{@code
 * approvalLine}) 중 총괄표에 필요한 두 배열만 받는다. 프론트가 필드를 추가해도 메일 발송이 깨지지 않도록 모르는 필드는 무시한다.
 *
 * @param projects 정보화사업·경상사업 목록 (경상 구분은 {@code odnYn})
 * @param costs 전산업무비 목록
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ApprovalMailSnapshot(List<ProjectItem> projects, List<CostItem> costs) {

    /** 누락 배열 보정 — 스냅샷 일부가 비어도 렌더링이 계속되도록 빈 목록으로 접는다. */
    public ApprovalMailSnapshot {
        projects = projects == null ? List.of() : List.copyOf(projects);
        costs = costs == null ? List.of() : List.copyOf(costs);
    }

    /** 스냅샷이 없거나 읽지 못했을 때 쓰는 빈 값. */
    public static ApprovalMailSnapshot empty() {
        return new ApprovalMailSnapshot(List.of(), List.of());
    }

    /** null 금액을 0으로 접는다. 스냅샷은 미입력 금액을 null로 남긴다. */
    private static BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    /**
     * 사업 한 건.
     *
     * @param abusNm 사업명
     * @param odnYn 경상사업여부 ("Y"면 경상사업)
     * @param totRqmAmt 총 예산
     * @param assetBg 자본예산
     * @param costBg 일반관리비
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ProjectItem(
            String abusNm,
            String odnYn,
            BigDecimal totRqmAmt,
            BigDecimal assetBg,
            BigDecimal costBg) {

        /** 경상사업 여부. */
        public boolean ordinary() {
            return "Y".equals(odnYn);
        }

        /** 총 예산. */
        public BigDecimal total() {
            return zeroIfNull(totRqmAmt);
        }

        /** 자본예산. */
        public BigDecimal asset() {
            return zeroIfNull(assetBg);
        }

        /** 일반관리비. */
        public BigDecimal cost() {
            return zeroIfNull(costBg);
        }
    }

    /**
     * 전산업무비 한 건.
     *
     * @param cttNm 계약명
     * @param costTotXpAmt 전산업무비예산금액(총 예산)
     * @param assetBg 자본예산
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CostItem(String cttNm, BigDecimal costTotXpAmt, BigDecimal assetBg) {

        /** 총 예산. */
        public BigDecimal total() {
            return zeroIfNull(costTotXpAmt);
        }

        /** 자본예산. */
        public BigDecimal asset() {
            return zeroIfNull(assetBg);
        }

        /** 일반관리비 — 전산업무비는 별도 컬럼이 없어 총 예산에서 자본예산을 뺀다(PDF 총괄표와 동일). */
        public BigDecimal cost() {
            return total().subtract(asset());
        }
    }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.mail.*'`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋한다**

```bash
./gradlew spotlessApply
git add src/main/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshot.java src/test/java/com/kdb/it/common/approval/mail/ApprovalMailSnapshotTest.java
git commit -m "feat(approval): 결재요청 메일용 신청서 스냅샷 파싱 모델 추가"
```

---

### Task 2: 메일 HTML 조립 헬퍼

인라인 CSS 상수, HTML 이스케이프, 금액 표기, UTF-8 바이트 계수를 한곳에 모은다. 렌더러가 이 위에서 표를 짠다.

**Files:**
- Create: `src/main/java/com/kdb/it/common/approval/mail/MailHtml.java`
- Test: `src/test/java/com/kdb/it/common/approval/mail/MailHtmlTest.java`

**Interfaces:**
- Consumes: 없음
- Produces (모두 `static`, 클래스는 package-private final):
  - `String escape(String value)` / `String amount(BigDecimal value)` / `int utf8Length(String html)`
  - `String labelCell(String text)` / `String textCell(String text)` / `String amountCell(String text)`
  - `String row(String... cells)` / `String table(String bodyRows)` / `String sectionTitle(String text)`
  - 색 상수 `PRIMARY`, `HEADER_BG`, `BORDER`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/test/java/com/kdb/it/common/approval/mail/MailHtmlTest.java`

```java
package com.kdb.it.common.approval.mail;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 메일 HTML 조립 헬퍼를 검증한다. */
class MailHtmlTest {

    @Test
    @DisplayName("HTML 특수문자를 이스케이프한다")
    void escape_specialCharacters() {
        assertThat(MailHtml.escape("<b>A&B</b>"))
                .isEqualTo("&lt;b&gt;A&amp;B&lt;/b&gt;")
                .doesNotContain("<b>");
        assertThat(MailHtml.escape("\"인용\"")).contains("&quot;");
        assertThat(MailHtml.escape(null)).isEmpty();
    }

    @Test
    @DisplayName("금액은 천 단위 구분자와 원 단위로 표기한다")
    void amount_formatsWithSeparator() {
        assertThat(MailHtml.amount(new BigDecimal("1234567"))).isEqualTo("1,234,567 원");
        assertThat(MailHtml.amount(BigDecimal.ZERO)).isEqualTo("0 원");
        assertThat(MailHtml.amount(null)).isEqualTo("0 원");
    }

    @Test
    @DisplayName("바이트 길이는 UTF-8 기준이다")
    void utf8Length_countsBytes() {
        assertThat(MailHtml.utf8Length("가")).isEqualTo(3);
        assertThat(MailHtml.utf8Length("ab")).isEqualTo(2);
        assertThat(MailHtml.utf8Length(null)).isZero();
    }

    @Test
    @DisplayName("셀과 행은 인라인 스타일을 붙여 만든다")
    void cellsAndRow_carryInlineStyle() {
        String row = MailHtml.row(MailHtml.labelCell("구분"), MailHtml.textCell("정보화사업"));

        assertThat(row).startsWith("<tr>").endsWith("</tr>");
        assertThat(row).contains("style=").contains(MailHtml.HEADER_BG);
        assertThat(row).contains("구분").contains("정보화사업");
    }

    @Test
    @DisplayName("표는 인라인 스타일을 가진 table 요소로 감싼다")
    void table_wrapsRows() {
        String table = MailHtml.table(MailHtml.row(MailHtml.textCell("값")));

        assertThat(table).startsWith("<table").endsWith("</table>");
        assertThat(table).contains(MailHtml.BORDER).contains("값");
    }

    @Test
    @DisplayName("셀 내용도 이스케이프된다")
    void cells_escapeContent() {
        assertThat(MailHtml.textCell("<script>"))
                .doesNotContain("<script>")
                .contains("&lt;script&gt;");
    }

    @Test
    @DisplayName("테두리·여백은 표가 주고 셀은 반복하지 않는다")
    void cells_doNotRepeatBorderStyle() {
        // 셀마다 인라인 테두리를 반복하면 필수 항목만으로 4000바이트 예산을 넘는다(실측 5007바이트).
        assertThat(MailHtml.textCell("값")).doesNotContain("border").doesNotContain("padding");
        assertThat(MailHtml.amountCell("1 원")).doesNotContain("border").doesNotContain("padding");
        assertThat(MailHtml.labelCell("구분")).doesNotContain("border").doesNotContain("padding");

        String table = MailHtml.table(MailHtml.row(MailHtml.textCell("값")));
        assertThat(table).contains("cellpadding=").contains("border=");
    }

    @Test
    @DisplayName("5열 표 한 행이 200바이트를 넘지 않는다")
    void row_staysCheap() {
        String row =
                MailHtml.row(
                        MailHtml.textCell("정보화사업"),
                        MailHtml.textCell("차세대 통합 시스템 구축 사업"),
                        MailHtml.amountCell("3,000 원"));

        assertThat(MailHtml.utf8Length(row)).isLessThanOrEqualTo(200);
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.mail.MailHtmlTest'`
Expected: 컴파일 실패 — `MailHtml` 심볼을 찾을 수 없음

- [ ] **Step 3: 최소 구현을 작성한다**

`src/main/java/com/kdb/it/common/approval/mail/MailHtml.java`

```java
package com.kdb.it.common.approval.mail;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.NumberFormat;
import java.util.Locale;
import org.springframework.web.util.HtmlUtils;

/**
 * 결재요청 메일 HTML 조립 헬퍼.
 *
 * <p>메일 클라이언트가 {@code <style>} 블록을 자주 제거하므로 모든 서식을 인라인 {@code style} 속성으로 넣는다. 색은 PDF 신청서
 * 테마({@code approvalFormPdfTheme.ts})와 같은 값을 쓴다.
 *
 * <p>본문은 GWE 전문 {@code CONTENTS} 필드(4000바이트) 안에 들어가야 하므로 조립 중 바이트를 세야 한다. 길이 계산은 전문 문자셋과 같은 UTF-8
 * 기준이다.
 */
final class MailHtml {

    /** 타이틀 바·제목 색 (PDF 신청서와 동일). */
    static final String PRIMARY = "#1e3a8a";

    /** 표 머리글 배경색. */
    static final String HEADER_BG = "#f3f4f6";

    /** 표 테두리색. */
    static final String BORDER = "#d1d5db";

    /**
     * 표 여는 태그 — 테두리와 여백을 <b>표 수준 표현 속성</b>({@code border}/{@code cellpadding})으로 준다.
     *
     * <p>셀마다 인라인 스타일을 반복하면 필수 항목(개요+총괄표)만으로 4000바이트 예산을 넘는다(실측 5007바이트).
     * 표현 속성은 메일 클라이언트 호환성도 인라인 스타일보다 넓다.
     */
    private static final String TABLE_OPEN =
            "<table border=\"1\" cellpadding=\"6\" cellspacing=\"0\" style=\"border-collapse:collapse;"
                    + "width:100%;margin:0 0 12px;border-color:"
                    + BORDER
                    + ";font-size:13px;\">";

    private MailHtml() {}

    /** HTML 특수문자 이스케이프. null은 빈 문자열로 접는다. */
    static String escape(String value) {
        return value == null ? "" : HtmlUtils.htmlEscape(value);
    }

    /** 금액 표기 — 천 단위 구분자와 원 단위 (PDF 총괄표와 동일). null은 0으로 본다. */
    static String amount(BigDecimal value) {
        BigDecimal safe = value == null ? BigDecimal.ZERO : value;
        return NumberFormat.getNumberInstance(Locale.KOREA).format(safe) + " 원";
    }

    /** UTF-8 바이트 길이. 전문 문자셋과 같은 기준으로 예산을 센다. */
    static int utf8Length(String html) {
        return html == null ? 0 : html.getBytes(StandardCharsets.UTF_8).length;
    }

    /** 머리글 셀 — 테두리·여백은 표가 주므로 배경색만 남긴다. */
    static String labelCell(String text) {
        return "<th style=\"background:" + HEADER_BG + ";\">" + escape(text) + "</th>";
    }

    /** 좌측 정렬 본문 셀. */
    static String textCell(String text) {
        return "<td>" + escape(text) + "</td>";
    }

    /** 우측 정렬 금액 셀. */
    static String amountCell(String text) {
        return "<td align=\"right\">" + escape(text) + "</td>";
    }

    /** 행 조립. 인자는 이미 셀 HTML이어야 한다. */
    static String row(String... cells) {
        return "<tr>" + String.join("", cells) + "</tr>";
    }

    /** 표 조립. 인자는 이미 행 HTML이어야 한다. */
    static String table(String bodyRows) {
        return TABLE_OPEN + bodyRows + "</table>";
    }

    /** 구분 제목. */
    static String sectionTitle(String text) {
        return "<div style=\"font-size:14px;font-weight:700;color:"
                + PRIMARY
                + ";margin:0 0 6px;\">"
                + escape(text)
                + "</div>";
    }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.mail.MailHtmlTest'`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋한다**

```bash
./gradlew spotlessApply
git add src/main/java/com/kdb/it/common/approval/mail/MailHtml.java src/test/java/com/kdb/it/common/approval/mail/MailHtmlTest.java
git commit -m "feat(approval): 결재요청 메일 HTML 조립 헬퍼 추가"
```

---

### Task 3: 메일 페이로드 계약

dispatcher가 읽을 `{subject, html}` 계약을 알림 패키지에 둔다. 결재 패키지가 만들고 알림 패키지가 소비하므로, 계약이 소비자 쪽에 있어야 알림 계층이 결재 패키지를 참조하지 않는다.

**Files:**
- Create: `src/main/java/com/kdb/it/common/notification/dispatcher/MailPayload.java`
- Test: `src/test/java/com/kdb/it/common/notification/dispatcher/MailPayloadTest.java`

**Interfaces:**
- Consumes: 없음
- Produces: `MailPayload(String subject, String html)` — Jackson 직렬화·역직렬화 가능, 모르는 필드 무시

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/test/java/com/kdb/it/common/notification/dispatcher/MailPayloadTest.java`

```java
package com.kdb.it.common.notification.dispatcher;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 외부 발송 페이로드 계약을 검증한다. */
class MailPayloadTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("제목과 본문을 JSON으로 왕복한다")
    void roundTrip() throws Exception {
        MailPayload original = new MailPayload("[IT정보화포탈] 결재 요청", "<p>본문</p>");

        String json = objectMapper.writeValueAsString(original);
        MailPayload parsed = objectMapper.readValue(json, MailPayload.class);

        assertThat(parsed).isEqualTo(original);
        assertThat(json).contains("subject").contains("html");
    }

    @Test
    @DisplayName("모르는 필드가 있어도 역직렬화된다")
    void deserialize_ignoresUnknownFields() throws Exception {
        MailPayload parsed =
                objectMapper.readValue(
                        "{\"subject\":\"제목\",\"html\":\"<p>a</p>\",\"extra\":1}",
                        MailPayload.class);

        assertThat(parsed.subject()).isEqualTo("제목");
        assertThat(parsed.html()).isEqualTo("<p>a</p>");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.notification.dispatcher.MailPayloadTest'`
Expected: 컴파일 실패 — `MailPayload` 심볼을 찾을 수 없음

- [ ] **Step 3: 최소 구현을 작성한다**

`src/main/java/com/kdb/it/common/notification/dispatcher/MailPayload.java`

```java
package com.kdb.it.common.notification.dispatcher;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * 외부 메일 발송 페이로드 — {@code Cinfmm.SD_DOC_CONE}에 JSON으로 저장된다.
 *
 * <p>업무 도메인이 제목과 본문을 완성해 실어 보내고 발송 계층은 그대로 전달만 한다. 업무 문구가 발송 계층에 하드코딩되지 않게 하려는 계약이므로, 계약 자체는 소비자인
 * 알림 패키지에 둔다.
 *
 * @param subject 메일 제목
 * @param html 메일 본문 HTML (인라인 스타일)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MailPayload(String subject, String html) {}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.notification.dispatcher.MailPayloadTest'`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋한다**

```bash
./gradlew spotlessApply
git add src/main/java/com/kdb/it/common/notification/dispatcher/MailPayload.java src/test/java/com/kdb/it/common/notification/dispatcher/MailPayloadTest.java
git commit -m "feat(notification): 외부 메일 발송 페이로드 계약 추가"
```

---
### Task 4: 메일 렌더러

신청서 개요 + 총괄표 합계 + 구분별 목록을 4000바이트 예산 안에서 조립한다. 리포지토리를 주입받지 않으므로 DB 없이 테스트한다.

**Files:**
- Create: `src/main/java/com/kdb/it/common/approval/mail/ApprovalMailContext.java`
- Create: `src/main/java/com/kdb/it/common/approval/mail/ApprovalMailRenderer.java`
- Test: `src/test/java/com/kdb/it/common/approval/mail/ApprovalMailRendererTest.java`

**Interfaces:**
- Consumes: Task 1 `ApprovalMailSnapshot`, Task 2 `MailHtml`, Task 3 `MailPayload`
- Produces:
  - `ApprovalMailContext(String apfMngNo, String title, LocalDate requestedDate, String requesterName, String deptName, String detailUrl, String detailJson)`
  - `ApprovalMailRenderer` — `@Component`, 생성자 인자 `ObjectMapper`
  - `String renderPayloadJson(ApprovalMailContext context)` — 실패 시 `null`
  - `public static final int CONTENTS_BUDGET_BYTES = 4000`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/test/java/com/kdb/it/common/approval/mail/ApprovalMailRendererTest.java`

```java
package com.kdb.it.common.approval.mail;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kdb.it.common.notification.dispatcher.MailPayload;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 결재요청 메일 렌더링을 검증한다. DB 없이 도는 순수 단위 테스트다. */
class ApprovalMailRendererTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ApprovalMailRenderer renderer = new ApprovalMailRenderer(objectMapper);

    private static final String SNAPSHOT =
            """
            {
              "projects": [
                {"abusNm": "차세대 시스템", "odnYn": "N", "totRqmAmt": 3000,
                 "assetBg": 2000, "costBg": 1000},
                {"abusNm": "소규모 개선", "odnYn": "N", "totRqmAmt": 1000,
                 "assetBg": 400, "costBg": 600},
                {"abusNm": "2026년 경상사업", "odnYn": "Y", "totRqmAmt": 500,
                 "assetBg": 100, "costBg": 400}
              ],
              "costs": [
                {"cttNm": "유지보수 계약", "costTotXpAmt": 800, "assetBg": 300}
              ]
            }
            """;

    private static ApprovalMailContext context(String detailJson) {
        return new ApprovalMailContext(
                "APF-2026-0001",
                "전산예산 신청서",
                LocalDate.of(2026, 8, 18),
                "홍길동",
                "IT기획부",
                "https://it.kdb.co.kr/approval/APF-2026-0001",
                detailJson);
    }

    private MailPayload render(String detailJson) throws Exception {
        String json = renderer.renderPayloadJson(context(detailJson));
        assertThat(json).isNotNull();
        return objectMapper.readValue(json, MailPayload.class);
    }

    @Test
    @DisplayName("제목은 포탈 접두어와 결재 요청 문구를 붙인다")
    void subject_hasPortalPrefix() throws Exception {
        assertThat(render(SNAPSHOT).subject()).isEqualTo("[IT정보화포탈] 전산예산 신청서 결재 요청");
    }

    @Test
    @DisplayName("신청서 개요 6개 항목이 모두 본문에 나타난다")
    void html_containsOverview() throws Exception {
        String html = render(SNAPSHOT).html();

        assertThat(html)
                .contains("전산예산 신청서")
                .contains("APF-2026-0001")
                .contains("2026-08-18")
                .contains("홍길동")
                .contains("IT기획부")
                .contains("https://it.kdb.co.kr/approval/APF-2026-0001");
    }

    @Test
    @DisplayName("구분별 합계와 총합계가 스냅샷 값과 일치한다")
    void html_containsTotals() throws Exception {
        String html = render(SNAPSHOT).html();

        // 정보화사업 4,000 / 전산업무비 800 / 경상사업 500 / 합계 5,300
        assertThat(html)
                .contains("4,000 원")
                .contains("800 원")
                .contains("500 원")
                .contains("5,300 원");
        assertThat(html).contains("정보화사업").contains("전산업무비").contains("경상사업").contains("합계");
    }

    @Test
    @DisplayName("목록은 구분 안에서 총 예산 내림차순으로 정렬한다")
    void html_listSortedByTotalDesc() throws Exception {
        String html = render(SNAPSHOT).html();

        assertThat(html.indexOf("차세대 시스템")).isLessThan(html.indexOf("소규모 개선"));
    }

    @Test
    @DisplayName("목록은 구분 열을 가진 표 하나로 합친다")
    void html_listIsSingleTableWithCategoryColumn() throws Exception {
        String html = render(SNAPSHOT).html();

        assertThat(html).contains("신청 사업 목록").contains("사업명/계약명");
        // 구분별로 표를 나누면 머리글이 반복된다. 합친 표는 목록 머리글이 한 번만 나온다.
        assertThat(html.split("사업명/계약명", -1).length - 1).isEqualTo(1);
        assertThat(html).contains("유지보수 계약");
    }

    @Test
    @DisplayName("항목이 없는 구분은 합계 행과 목록을 생략한다")
    void html_omitsEmptyCategory() throws Exception {
        String html = render("{\"projects\": [], \"costs\": []}").html();

        assertThat(html).doesNotContain("정보화사업").doesNotContain("전산업무비").doesNotContain("경상사업");
        assertThat(html).contains("APF-2026-0001");
    }

    @Test
    @DisplayName("본문은 UTF-8 4000바이트를 넘지 않고 잘리면 남은 건수를 알린다")
    void html_staysWithinBudget() throws Exception {
        String manyProjects =
                IntStream.range(0, 300)
                        .mapToObj(
                                i ->
                                        ("{\"abusNm\": \"매우 긴 이름을 가진 정보화사업 항목 %d\","
                                                        + " \"odnYn\": \"N\", \"totRqmAmt\": %d,"
                                                        + " \"assetBg\": 1, \"costBg\": 1}")
                                                .formatted(i, 1000 - i))
                        .collect(Collectors.joining(","));
        String html = render("{\"projects\": [" + manyProjects + "], \"costs\": []}").html();

        assertThat(html.getBytes(StandardCharsets.UTF_8).length)
                .isLessThanOrEqualTo(ApprovalMailRenderer.CONTENTS_BUDGET_BYTES);
        assertThat(html).contains("외 ").contains("건");
        // 예산이 실제로 쓰이는지 확인 — 머리글만 넣고 행을 못 싣는 회귀를 잡는다.
        assertThat(html).contains("매우 긴 이름을 가진 정보화사업 항목 0");
    }

    @Test
    @DisplayName("사업명의 HTML 특수문자가 이스케이프된다")
    void html_escapesItemNames() throws Exception {
        String html =
                render(
                                "{\"projects\": [{\"abusNm\": \"<script>alert(1)</script>\","
                                        + " \"odnYn\": \"N\", \"totRqmAmt\": 1, \"assetBg\": 1,"
                                        + " \"costBg\": 0}], \"costs\": []}")
                        .html();

        assertThat(html).doesNotContain("<script>").contains("&lt;script&gt;");
    }

    @Test
    @DisplayName("스냅샷이 없거나 깨졌으면 개요만 렌더링한다")
    void html_missingOrBrokenSnapshot_rendersOverviewOnly() throws Exception {
        for (String broken : new String[] {null, "", "  ", "{broken JSON"}) {
            String html = render(broken).html();

            assertThat(html).contains("APF-2026-0001").contains("전산예산 신청서");
            assertThat(html).doesNotContain("정보화사업");
        }
    }

    @Test
    @DisplayName("이름·부서가 비어도 렌더링이 계속된다")
    void html_nullOptionalFields() throws Exception {
        ApprovalMailContext context =
                new ApprovalMailContext(
                        "APF-1", "제목", null, null, null, "https://x/approval/APF-1", SNAPSHOT);

        String json = renderer.renderPayloadJson(context);

        assertThat(json).isNotNull();
        assertThat(objectMapper.readValue(json, MailPayload.class).html()).contains("APF-1");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.mail.ApprovalMailRendererTest'`
Expected: 컴파일 실패 — `ApprovalMailContext`, `ApprovalMailRenderer` 심볼을 찾을 수 없음

- [ ] **Step 3: 컨텍스트 record를 작성한다**

`src/main/java/com/kdb/it/common/approval/mail/ApprovalMailContext.java`

```java
package com.kdb.it.common.approval.mail;

import java.time.LocalDate;

/**
 * 결재요청 메일 렌더링 입력.
 *
 * <p>렌더러가 리포지토리를 모르도록 필요한 값을 모두 호출자가 채워 넘긴다. 선택 항목이 null이어도 렌더링은 계속되며 해당 칸만 빈 값으로 남는다.
 *
 * @param apfMngNo 문서번호(신청서식별번호)
 * @param title 신청서 제목
 * @param requestedDate 신청일자. null 허용
 * @param requesterName 기안자 성명. null 허용
 * @param deptName 작성부서명. null 허용
 * @param detailUrl 신청서 상세 화면 절대 URL
 * @param detailJson 신청서 상세 스냅샷 JSON. null·공백·파싱 실패 시 총괄표를 생략한다
 */
public record ApprovalMailContext(
        String apfMngNo,
        String title,
        LocalDate requestedDate,
        String requesterName,
        String deptName,
        String detailUrl,
        String detailJson) {}
```

- [ ] **Step 4: 렌더러를 작성한다**

`src/main/java/com/kdb/it/common/approval/mail/ApprovalMailRenderer.java`

```java
package com.kdb.it.common.approval.mail;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kdb.it.common.approval.mail.ApprovalMailSnapshot.CostItem;
import com.kdb.it.common.approval.mail.ApprovalMailSnapshot.ProjectItem;
import com.kdb.it.common.notification.dispatcher.MailPayload;
import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 결재요청 메일의 제목과 본문 HTML을 만든다.
 *
 * <p>신청서 개요와 총괄표 합계는 반드시 넣고, 구분별 목록은 남는 바이트 예산 안에서만 싣는다. 예산은 GWE 전문 {@code CONTENTS} 필드 폭과 같은
 * UTF-8 4000바이트다.
 *
 * <p>리포지토리를 주입받지 않는다. 필요한 값은 {@link ApprovalMailContext}로 모두 받으므로 DB 없이 단위 테스트할 수 있다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ApprovalMailRenderer {

    /** 본문 바이트 예산 — GWE 전문 CONTENTS 필드 폭과 같다. */
    public static final int CONTENTS_BUDGET_BYTES = 4000;

    /** 잘림 안내와 닫는 태그를 넣을 여유. 예산을 꽉 채우고 나서 안내를 못 붙이는 일을 막는다. */
    private static final int TAIL_RESERVE_BYTES = 320;

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final ObjectMapper objectMapper;

    /**
     * 메일 페이로드 JSON을 만듭니다.
     *
     * @param context 렌더링 입력
     * @return {@code {"subject":...,"html":...}} JSON. 실패하면 {@code null}(호출자는 기존 기본 본문으로 폴백)
     */
    public String renderPayloadJson(ApprovalMailContext context) {
        try {
            MailPayload payload = new MailPayload(subject(context), html(context));
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException | RuntimeException e) {
            log.warn("결재요청 메일 렌더링 실패: apfMngNo={}, 사유={}", context.apfMngNo(), e.toString());
            return null;
        }
    }

    /** 메일 제목 — 포탈 접두어와 결재 요청 문구를 붙인다. */
    private String subject(ApprovalMailContext context) {
        return "[IT정보화포탈] %s 결재 요청".formatted(text(context.title()));
    }

    /** 본문 HTML — 개요와 합계는 필수, 목록은 남는 예산만큼. */
    private String html(ApprovalMailContext context) {
        ApprovalMailSnapshot snapshot = parseSnapshot(context);
        List<ProjectItem> regular =
                sortedProjects(snapshot.projects().stream().filter(p -> !p.ordinary()).toList());
        List<ProjectItem> ordinary =
                sortedProjects(snapshot.projects().stream().filter(ProjectItem::ordinary).toList());
        List<CostItem> costs =
                snapshot.costs().stream()
                        .sorted(Comparator.comparing(CostItem::total).reversed())
                        .toList();

        StringBuilder body = new StringBuilder();
        body.append(titleBar());
        body.append(overview(context));
        body.append(summary(regular, ordinary, costs));

        List<ListEntry> entries = new ArrayList<>();
        regular.forEach(p -> entries.add(new ListEntry("정보화사업", p.abusNm(), p.total())));
        costs.forEach(c -> entries.add(new ListEntry("전산업무비", c.cttNm(), c.total())));
        ordinary.forEach(p -> entries.add(new ListEntry("경상사업", p.abusNm(), p.total())));
        body.append(itemList(context, entries, MailHtml.utf8Length(wrap(body.toString()))));

        return wrap(body.toString());
    }

    /** 스냅샷 파싱 — 없거나 깨졌으면 빈 스냅샷으로 접고 총괄표를 생략한다. */
    private ApprovalMailSnapshot parseSnapshot(ApprovalMailContext context) {
        if (!StringUtils.hasText(context.detailJson())) {
            return ApprovalMailSnapshot.empty();
        }
        try {
            return objectMapper.readValue(context.detailJson(), ApprovalMailSnapshot.class);
        } catch (JsonProcessingException e) {
            log.warn(
                    "신청서 스냅샷 파싱 실패 — 총괄표를 생략합니다: apfMngNo={}, 사유={}",
                    context.apfMngNo(),
                    e.getOriginalMessage());
            return ApprovalMailSnapshot.empty();
        }
    }

    /** 총 예산 내림차순 정렬. PDF 총괄표와 같은 순서다. */
    private static List<ProjectItem> sortedProjects(List<ProjectItem> items) {
        return items.stream().sorted(Comparator.comparing(ProjectItem::total).reversed()).toList();
    }

    private String wrap(String body) {
        return "<div style=\"font-family:'Malgun Gothic',sans-serif;color:#111827;"
                + "max-width:720px;\">"
                + body
                + "</div>";
    }

    private String titleBar() {
        return "<div style=\"background:"
                + MailHtml.PRIMARY
                + ";color:#fff;font-size:16px;font-weight:700;padding:10px 12px;"
                + "margin:0 0 14px;\">결재 요청</div>";
    }

    /** 신청서 개요 — 라벨-값 2열 표와 상세 바로가기. */
    private String overview(ApprovalMailContext context) {
        String rows =
                MailHtml.row(MailHtml.labelCell("신청서 제목"), MailHtml.textCell(text(context.title())))
                        + MailHtml.row(
                                MailHtml.labelCell("문서번호"),
                                MailHtml.textCell(text(context.apfMngNo())))
                        + MailHtml.row(
                                MailHtml.labelCell("신청일자"),
                                MailHtml.textCell(
                                        context.requestedDate() == null
                                                ? ""
                                                : context.requestedDate().format(DATE)))
                        + MailHtml.row(
                                MailHtml.labelCell("기안자"),
                                MailHtml.textCell(text(context.requesterName())))
                        + MailHtml.row(
                                MailHtml.labelCell("작성부서"),
                                MailHtml.textCell(text(context.deptName())));
        return MailHtml.sectionTitle("신청서 개요") + MailHtml.table(rows) + linkButton(context);
    }

    private String linkButton(ApprovalMailContext context) {
        return "<div style=\"margin:0 0 18px;\"><a href=\""
                + MailHtml.escape(context.detailUrl())
                + "\" style=\"display:inline-block;background:"
                + MailHtml.PRIMARY
                + ";color:#fff;text-decoration:none;font-size:13px;font-weight:600;"
                + "padding:8px 14px;border-radius:4px;\">신청서 상세 보기</a></div>";
    }

    /** 총괄표 합계 — 항목이 없는 구분은 행을 생략한다. */
    private String summary(
            List<ProjectItem> regular, List<ProjectItem> ordinary, List<CostItem> costs) {
        if (regular.isEmpty() && ordinary.isEmpty() && costs.isEmpty()) {
            return "";
        }
        StringBuilder rows = new StringBuilder();
        rows.append(
                MailHtml.row(
                        MailHtml.labelCell("구분"),
                        MailHtml.labelCell("건수"),
                        MailHtml.labelCell("총 예산"),
                        MailHtml.labelCell("자본예산"),
                        MailHtml.labelCell("일반관리비")));

        BigDecimal[] grand = {BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO};
        if (!regular.isEmpty()) {
            rows.append(projectSummaryRow("정보화사업", regular, grand));
        }
        if (!costs.isEmpty()) {
            rows.append(costSummaryRow(costs, grand));
        }
        if (!ordinary.isEmpty()) {
            rows.append(projectSummaryRow("경상사업", ordinary, grand));
        }
        int count = regular.size() + ordinary.size() + costs.size();
        rows.append(
                MailHtml.row(
                        MailHtml.labelCell("합계"),
                        MailHtml.amountCell(count + "건"),
                        MailHtml.amountCell(MailHtml.amount(grand[0])),
                        MailHtml.amountCell(MailHtml.amount(grand[1])),
                        MailHtml.amountCell(MailHtml.amount(grand[2]))));
        return MailHtml.sectionTitle("신청내용") + MailHtml.table(rows.toString());
    }

    private String projectSummaryRow(String label, List<ProjectItem> items, BigDecimal[] grand) {
        BigDecimal total = sum(items.stream().map(ProjectItem::total).toList());
        BigDecimal asset = sum(items.stream().map(ProjectItem::asset).toList());
        BigDecimal cost = sum(items.stream().map(ProjectItem::cost).toList());
        accumulate(grand, total, asset, cost);
        return summaryRow(label, items.size(), total, asset, cost);
    }

    private String costSummaryRow(List<CostItem> items, BigDecimal[] grand) {
        BigDecimal total = sum(items.stream().map(CostItem::total).toList());
        BigDecimal asset = sum(items.stream().map(CostItem::asset).toList());
        BigDecimal cost = sum(items.stream().map(CostItem::cost).toList());
        accumulate(grand, total, asset, cost);
        return summaryRow("전산업무비", items.size(), total, asset, cost);
    }

    private static String summaryRow(
            String label, int count, BigDecimal total, BigDecimal asset, BigDecimal cost) {
        return MailHtml.row(
                MailHtml.textCell(label),
                MailHtml.amountCell(count + "건"),
                MailHtml.amountCell(MailHtml.amount(total)),
                MailHtml.amountCell(MailHtml.amount(asset)),
                MailHtml.amountCell(MailHtml.amount(cost)));
    }

    private static void accumulate(
            BigDecimal[] grand, BigDecimal total, BigDecimal asset, BigDecimal cost) {
        grand[0] = grand[0].add(total);
        grand[1] = grand[1].add(asset);
        grand[2] = grand[2].add(cost);
    }

    private static BigDecimal sum(List<BigDecimal> values) {
        return values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * 목록 한 줄. 자본예산·일반관리비는 바로 위 합계 총괄표가 구분별로 이미 보여주므로 목록에서는 생략하고, 그만큼 더 많은 사업을 싣는다.
     *
     * @param category 구분명 (정보화사업/전산업무비/경상사업)
     * @param name 사업명 또는 계약명. null 허용
     * @param total 총 예산
     */
    private record ListEntry(String category, String name, BigDecimal total) {}

    /** 목록 표 머리글 행. */
    private static String listHeaderRow() {
        return MailHtml.row(
                MailHtml.labelCell("구분"),
                MailHtml.labelCell("사업명/계약명"),
                MailHtml.labelCell("총 예산"));
    }

    private static String listRow(ListEntry entry) {
        return MailHtml.row(
                MailHtml.textCell(entry.category()),
                MailHtml.textCell(entry.name() == null ? "" : entry.name()),
                MailHtml.amountCell(MailHtml.amount(entry.total())));
    }

    /**
     * 신청 사업 목록을 남는 예산만큼 싣는다.
     *
     * <p>구분별로 표를 따로 두면 머리글이 세 번 반복되어 예산 대부분을 머리글이 먹는다. 구분 열을 가진 표 하나로 합치고 구분 순서(정보화사업 → 전산업무비 →
     * 경상사업), 구분 안에서는 총 예산 내림차순으로 싣는다.
     *
     * @param context 렌더링 입력 (전체 보기 링크용)
     * @param entries 구분 순서로 이미 정렬된 목록
     * @param usedBytes 지금까지 조립한 본문의 UTF-8 바이트
     * @return 목록 섹션 HTML. 머리글조차 못 넣을 예산이면 빈 문자열
     */
    private String itemList(
            ApprovalMailContext context, List<ListEntry> entries, int usedBytes) {
        if (entries.isEmpty()) {
            return "";
        }
        int budget = CONTENTS_BUDGET_BYTES - TAIL_RESERVE_BYTES - usedBytes;
        String shell = MailHtml.sectionTitle("신청 사업 목록") + MailHtml.table(listHeaderRow());
        int consumed = MailHtml.utf8Length(shell);
        if (consumed > budget) {
            return "";
        }

        StringBuilder included = new StringBuilder();
        int taken = 0;
        for (ListEntry entry : entries) {
            String row = listRow(entry);
            int next = MailHtml.utf8Length(row);
            if (consumed + next > budget) {
                break;
            }
            included.append(row);
            consumed += next;
            taken++;
        }
        if (taken == 0) {
            return "";
        }
        String section =
                MailHtml.sectionTitle("신청 사업 목록")
                        + MailHtml.table(listHeaderRow() + included);
        if (taken < entries.size()) {
            section += moreLink(entries.size() - taken, context);
        }
        return section;
    }

    private static String moreLink(int remaining, ApprovalMailContext context) {
        return "<div style=\"font-size:12px;color:#6b7280;margin:-8px 0 14px;\">외 "
                + remaining
                + "건 · <a href=\""
                + MailHtml.escape(context.detailUrl())
                + "\" style=\"color:"
                + MailHtml.PRIMARY
                + ";\">전체 보기</a></div>";
    }

    private static String text(String value) {
        return value == null ? "" : value;
    }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.mail.ApprovalMailRendererTest'`
Expected: PASS (10 tests)

예산 테스트가 실패하면 `TAIL_RESERVE_BYTES`를 키우지 말고, 먼저 개요+총괄표만의 바이트를 재어 본다. 이 계획의 초판은 셀마다 인라인 테두리 스타일을 반복해 **필수 항목만으로 5007바이트**(예산 4000)를 써서 목록이 한 줄도 못 들어갔다. Task 2가 표 수준 표현 속성으로 바뀐 뒤 필수 항목은 약 2263바이트이고 목록에 약 1737바이트가 남는다. 필수 항목이 2500바이트를 넘으면 `MailHtml` 쪽이 되돌아간 것이다.

- [ ] **Step 6: 커밋한다**

```bash
./gradlew spotlessApply
git add src/main/java/com/kdb/it/common/approval/mail/ApprovalMailContext.java src/main/java/com/kdb/it/common/approval/mail/ApprovalMailRenderer.java src/test/java/com/kdb/it/common/approval/mail/ApprovalMailRendererTest.java
git commit -m "feat(approval): 결재요청 메일 본문 렌더러 추가"
```

---
### Task 5: dispatcher가 페이로드를 소비

`sdPayload`가 있으면 그 제목·본문을 GWE 전문에 싣고, 없거나 깨졌으면 지금의 두 줄짜리 본문으로 폴백한다.

**Files:**
- Modify: `src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouter.java`
- Test: `src/test/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouterMailPayloadTest.java`

**Interfaces:**
- Consumes: Task 3 `MailPayload`
- Produces: `dispatchGwe(Cinfmm, String sdPayload)` 동작 변경. 외부 시그니처 `dispatch(Cinfmm, String)`는 그대로다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

먼저 기존 테스트의 EAI 모킹 방식을 확인한다: `ls src/test/java/com/kdb/it/common/notification/dispatcher/`

`src/test/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouterMailPayloadTest.java`

```java
package com.kdb.it.common.notification.dispatcher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kdb.it.common.notification.entity.Cinfmm;
import com.kdb.it.infra.eai.config.GweProperties;
import com.kdb.it.infra.eai.dto.EaiRequest;
import com.kdb.it.infra.eai.dto.EaiResult;
import com.kdb.it.infra.eai.dto.GwePayload;
import com.kdb.it.infra.eai.service.EaiService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** sdPayload 유무에 따른 GWE 전문 구성 분기를 검증한다. */
class NotificationDispatcherRouterMailPayloadTest {

    private final EaiService eaiService = mock(EaiService.class);
    private final NotificationDispatcherRouter router =
            new NotificationDispatcherRouter(
                    eaiService,
                    new GweProperties("ITPO00051630"),
                    "https://it.kdb.co.kr",
                    new ObjectMapper());

    private GwePayload dispatchAndCapture(String sdPayload) {
        when(eaiService.sendEai(any())).thenReturn(EaiResult.success(""));
        Cinfmm notification =
                Cinfmm.builder()
                        .infmMsgNo("INF-1")
                        .rmsEno("k140024")
                        .ttl("결재요청: 전산예산 신청서")
                        .infmMsgCone("본문")
                        .itPtlSdTc(NotificationDispatcherRouter.CHANNEL_EAI_GWE)
                        .build();

        router.dispatch(notification, sdPayload);

        ArgumentCaptor<EaiRequest> captor = ArgumentCaptor.forClass(EaiRequest.class);
        verify(eaiService).sendEai(captor.capture());
        return (GwePayload) captor.getValue().payload();
    }

    @Test
    @DisplayName("페이로드가 있으면 그 제목과 본문을 전문에 싣는다")
    void withPayload_usesSubjectAndHtml() {
        GwePayload payload =
                dispatchAndCapture(
                        "{\"subject\":\"[IT정보화포탈] 전산예산 신청서 결재 요청\","
                                + "\"html\":\"<p>총괄표</p>\"}");

        assertThat(payload.subject()).isEqualTo("[IT정보화포탈] 전산예산 신청서 결재 요청");
        assertThat(payload.contents()).isEqualTo("<p>총괄표</p>");
    }

    @Test
    @DisplayName("페이로드가 없으면 기존 알림 제목·본문으로 폴백한다")
    void withoutPayload_fallsBack() {
        GwePayload payload = dispatchAndCapture(null);

        assertThat(payload.subject()).isEqualTo("결재요청: 전산예산 신청서");
        assertThat(payload.contents()).contains("본문").contains("결재 화면으로 이동");
    }

    @Test
    @DisplayName("페이로드가 깨져 있으면 폴백하고 발송은 계속한다")
    void brokenPayload_fallsBack() {
        GwePayload payload = dispatchAndCapture("{broken JSON");

        assertThat(payload.subject()).isEqualTo("결재요청: 전산예산 신청서");
        assertThat(payload.contents()).contains("결재 화면으로 이동");
    }
}
```

`Cinfmm.builder()`가 위 필드를 지원하지 않으면 엔티티의 실제 빌더 필드명을 확인해 맞춘다. `GwePayload`의 접근자 이름(`subject()`/`contents()`)도 실제 record 정의로 확인한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.notification.dispatcher.NotificationDispatcherRouterMailPayloadTest'`
Expected: 첫 테스트 FAIL — subject가 `"결재요청: 전산예산 신청서"`로 나옴(페이로드 무시)

생성자 인자가 3개뿐이라 컴파일이 먼저 실패하면 Step 3의 생성자 변경을 반영한 뒤 다시 돌린다.
테스트 전용 편의 생성자는 두지 않는다 — 프로덕션 코드에 테스트 전용 진입점을 남기지 않기 위해
테스트가 `new ObjectMapper()`를 직접 넘긴다.

- [ ] **Step 3: dispatcher를 수정한다**

`NotificationDispatcherRouter.java`에서 네 곳을 바꾼다.

첫째, import를 더한다.

```java
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
```

둘째, 필드를 더한다.

```java
    private final EaiService eaiService;
    private final GweProperties gweProperties;
    private final String frontendUrl;
    private final ObjectMapper objectMapper;
```

셋째, 생성자를 바꾸고 테스트 편의 생성자를 둔다.

```java
    public NotificationDispatcherRouter(
            EaiService eaiService,
            GweProperties gweProperties,
            @Value("${app.frontend-url}") String frontendUrl,
            ObjectMapper objectMapper) {
        this.eaiService = eaiService;
        this.gweProperties = gweProperties;
        this.frontendUrl = frontendUrl;
        this.objectMapper = objectMapper;
    }
```

넷째, GWE 분기가 페이로드를 넘기게 하고 `dispatchGwe`가 이를 쓴다.

```java
        if (CHANNEL_EAI_GWE.equals(channel)) {
            return dispatchGwe(notification, sdPayload);
        }
```

```java
    private NotificationDispatchResult dispatchGwe(Cinfmm notification, String sdPayload) {
        MailPayload mail = parseMailPayload(notification, sdPayload);
        String subject =
                mail != null && StringUtils.hasText(mail.subject())
                        ? mail.subject()
                        : defaultText(notification.getTtl(), "IT Portal 알림");
        String contents =
                mail != null && StringUtils.hasText(mail.html())
                        ? mail.html()
                        : mailContents(
                                defaultText(notification.getInfmMsgCone(), "새 알림이 도착했습니다."));
        try {
            EaiResult result =
                    eaiService.sendEai(
                            EaiRequest.gwe(
                                    gweProperties.ifId(),
                                    GwePayload.builder()
                                            .msgGubun("3")
                                            .recvIds(normalizeRecipient(notification.getRmsEno()))
                                            .subject(subject)
                                            .contents(contents)
                                            .url("")
                                            .attFlag("0")
                                            .sendId("systemalert")
                                            .sendName("IT Portal")
                                            .build()));
            if (result.success() || result.skipped()) {
                return NotificationDispatchResult.sent();
            }
            return NotificationDispatchResult.failure(result.errorMessage());
        } catch (RuntimeException ex) {
            log.warn("EAI 알림 발송 예외: infmMsgNo={}", notification.getInfmMsgNo(), ex);
            return NotificationDispatchResult.failure(ex.getMessage());
        }
    }

    /** 발송 페이로드 해석 — 없거나 깨졌으면 null을 돌려 기본 본문으로 폴백하게 한다. */
    private MailPayload parseMailPayload(Cinfmm notification, String sdPayload) {
        if (!StringUtils.hasText(sdPayload)) {
            return null;
        }
        try {
            return objectMapper.readValue(sdPayload, MailPayload.class);
        } catch (JsonProcessingException e) {
            log.warn(
                    "발송 페이로드 해석 실패 — 기본 본문으로 발송합니다: infmMsgNo={}, 사유={}",
                    notification.getInfmMsgNo(),
                    e.getOriginalMessage());
            return null;
        }
    }
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.notification.dispatcher.*'`
Expected: PASS (신규 3건 + 기존 테스트 전부)

- [ ] **Step 5: 커밋한다**

```bash
./gradlew spotlessApply
git add src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouter.java src/test/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouterMailPayloadTest.java
git commit -m "feat(notification): GWE 발송이 메일 페이로드를 사용하도록 변경"
```

---

### Task 6: 상신 시점 배선

`ApplicationService`가 렌더러를 호출해 `NotificationEvent.sdPayload`를 채운다. 렌더링 실패가 상신이나 알림 발행을 막지 않아야 한다.

컨텍스트 조립을 별도 클래스로 빼는 이유는 URL 정규화와 필드 매핑을 `ApplicationService`(이미 700줄이 넘는다)에 더 얹지 않기 위해서다.

**Files:**
- Create: `src/main/java/com/kdb/it/common/approval/mail/ApprovalMailContextFactory.java`
- Test: `src/test/java/com/kdb/it/common/approval/mail/ApprovalMailContextFactoryTest.java`
- Modify: `src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`

**Interfaces:**
- Consumes: Task 4 `ApprovalMailContext`, `ApprovalMailRenderer`
- Produces: `ApprovalMailContextFactory.create(Capplm application, String requesterName, String deptName, String frontendUrl)` → `ApprovalMailContext`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`src/test/java/com/kdb/it/common/approval/mail/ApprovalMailContextFactoryTest.java`

```java
package com.kdb.it.common.approval.mail;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.approval.entity.Capplm;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 신청서에서 메일 렌더링 입력을 만드는 규칙을 검증한다. */
class ApprovalMailContextFactoryTest {

    private static Capplm application() {
        return Capplm.builder()
                .apfMngNo("APF-2026-0001")
                .dcdReqTtl("전산예산 신청서")
                .dcdReqDtm(LocalDate.of(2026, 8, 18))
                .dcdReqInf("{\"projects\":[],\"costs\":[]}")
                .build();
    }

    @Test
    @DisplayName("상세 URL은 프론트 URL과 신청관리번호로 만든다")
    void create_buildsDetailUrl() {
        ApprovalMailContext context =
                ApprovalMailContextFactory.create(
                        application(), "홍길동", "IT기획부", "https://it.kdb.co.kr");

        assertThat(context.detailUrl()).isEqualTo("https://it.kdb.co.kr/approval/APF-2026-0001");
    }

    @Test
    @DisplayName("프론트 URL 끝의 슬래시는 중복되지 않는다")
    void create_normalizesTrailingSlash() {
        ApprovalMailContext context =
                ApprovalMailContextFactory.create(
                        application(), "홍길동", "IT기획부", "https://it.kdb.co.kr///");

        assertThat(context.detailUrl()).isEqualTo("https://it.kdb.co.kr/approval/APF-2026-0001");
    }

    @Test
    @DisplayName("신청서 값이 그대로 옮겨진다")
    void create_copiesApplicationFields() {
        ApprovalMailContext context =
                ApprovalMailContextFactory.create(
                        application(), "홍길동", "IT기획부", "https://it.kdb.co.kr");

        assertThat(context.apfMngNo()).isEqualTo("APF-2026-0001");
        assertThat(context.title()).isEqualTo("전산예산 신청서");
        assertThat(context.requestedDate()).isEqualTo(LocalDate.of(2026, 8, 18));
        assertThat(context.requesterName()).isEqualTo("홍길동");
        assertThat(context.deptName()).isEqualTo("IT기획부");
        assertThat(context.detailJson()).isEqualTo("{\"projects\":[],\"costs\":[]}");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.mail.ApprovalMailContextFactoryTest'`
Expected: 컴파일 실패 — `ApprovalMailContextFactory` 심볼을 찾을 수 없음

`Capplm.builder()`가 위 필드를 지원하지 않으면 엔티티의 실제 빌더 필드명을 확인해 테스트를 맞춘다.

- [ ] **Step 3: 팩토리를 작성한다**

`src/main/java/com/kdb/it/common/approval/mail/ApprovalMailContextFactory.java`

```java
package com.kdb.it.common.approval.mail;

import com.kdb.it.common.approval.entity.Capplm;

/** 신청서 엔티티에서 메일 렌더링 입력을 만든다. */
public final class ApprovalMailContextFactory {

    private ApprovalMailContextFactory() {}

    /**
     * 메일 렌더링 입력을 만듭니다.
     *
     * @param application 신청서 마스터
     * @param requesterName 기안자 성명. 조회 실패 시 null 허용
     * @param deptName 작성부서명. 조회 실패 시 null 허용
     * @param frontendUrl 프론트 기준 URL (끝 슬래시 유무 무관)
     * @return 렌더링 입력
     */
    public static ApprovalMailContext create(
            Capplm application, String requesterName, String deptName, String frontendUrl) {
        String base = frontendUrl == null ? "" : frontendUrl.replaceAll("/+$", "");
        return new ApprovalMailContext(
                application.getApfMngNo(),
                application.getDcdReqTtl(),
                application.getDcdReqDtm(),
                requesterName,
                deptName,
                base + "/approval/" + application.getApfMngNo(),
                application.getDcdReqInf());
    }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.common.approval.mail.ApprovalMailContextFactoryTest'`
Expected: PASS (3 tests)

- [ ] **Step 5: ApplicationService를 배선한다**

`ApplicationService`는 `@RequiredArgsConstructor`를 쓰므로 `private final` 선언 추가만으로 주입된다. 기존 `private final` 필드 묶음 끝에 더한다.

```java
    /** 결재요청 메일 본문 렌더러 */
    private final com.kdb.it.common.approval.mail.ApprovalMailRenderer approvalMailRenderer;

    /** 조직코드→조직명 해석기: 메일 개요의 작성부서명 표시용 */
    private final com.kdb.it.common.iam.service.OrgNameResolver orgNameResolver;
```

`frontendUrl`은 `final`이 아니어야 `@Value` 필드 주입이 된다. 필드 묶음 아래에 따로 둔다.

```java
    /** 프론트 기준 URL: 메일의 신청서 상세 링크 조립용 */
    @org.springframework.beans.factory.annotation.Value("${app.frontend-url}")
    private String frontendUrl;
```

`publishApprovalRequestNotification`의 `eventPublisher.publishEvent(...)` 빌더에서 `.itPtlSdTc(...)` 다음 줄에 페이로드를 더한다.

```java
                        .itPtlSdTc(NotificationDispatcherRouter.CHANNEL_EAI_GWE)
                        .sdPayload(renderApprovalMail(capplm))
                        .build());
```

같은 클래스에 헬퍼를 더한다.

```java
    /**
     * 결재요청 메일 페이로드를 만듭니다.
     *
     * <p>렌더링이나 이름·부서 조회가 실패해도 알림 발행을 막지 않습니다. null을 반환하면 발송 계층이 기존 기본 본문으로 폴백합니다.
     *
     * @param capplm 신청서 마스터
     * @return 메일 페이로드 JSON. 실패 시 null
     */
    private String renderApprovalMail(Capplm capplm) {
        try {
            String requesterName =
                    userRepository
                            .findNameViewByEno(safeText(capplm.getDcdReqUsid()))
                            .map(user -> user.getUsrNm())
                            .orElse(null);
            String deptName = orgNameResolver.resolveName(capplm.getDcdReqBbrC());
            return approvalMailRenderer.renderPayloadJson(
                    com.kdb.it.common.approval.mail.ApprovalMailContextFactory.create(
                            capplm, requesterName, deptName, frontendUrl));
        } catch (RuntimeException e) {
            log.warn(
                    "결재요청 메일 페이로드 생성 실패 — 기본 본문으로 발송합니다: apfMngNo={}, 사유={}",
                    capplm.getApfMngNo(),
                    e.toString());
            return null;
        }
    }
```

- [ ] **Step 6: 전체 테스트를 돌린다**

Run: `./gradlew test`
Expected: PASS

`ApplicationService` 생성자 인자가 늘었으므로 기존 테스트가 컴파일 실패하면 새 인자(`ApprovalMailRenderer`, `OrgNameResolver`)를 mock으로 채운다. `@Value` 필드는 단위 테스트에서 null이므로, 링크가 필요한 테스트만 `ReflectionTestUtils.setField(service, "frontendUrl", "https://it.kdb.co.kr")`로 채운다.

- [ ] **Step 7: 커밋한다**

```bash
./gradlew spotlessApply
git add src/main/java/com/kdb/it/common/approval/mail/ApprovalMailContextFactory.java src/test/java/com/kdb/it/common/approval/mail/ApprovalMailContextFactoryTest.java src/main/java/com/kdb/it/common/approval/service/ApplicationService.java
git commit -m "feat(approval): 상신 시 결재요청 메일 페이로드 생성"
```

---

### Task 7: 문서 갱신과 최종 검증

**Files:**
- Modify: `docs/guides/integrations/notifications.md`
- Modify: `CLAUDE.md` (§7 이벤트·알림·외부 연동)

- [ ] **Step 1: 알림 가이드에 메일 페이로드 절을 더한다**

`docs/guides/integrations/notifications.md` 끝에 붙인다.

```markdown
## 외부 메일 본문 (SD_DOC_CONE)

업무 도메인이 완성한 메일 제목·본문을 `NotificationEvent.sdPayload`에 실으면
`Cinfmm.SD_DOC_CONE`에 저장되어 발송 계층까지 전달됩니다. 계약은
`MailPayload(subject, html)` JSON입니다.

- 페이로드가 없거나 해석에 실패하면 발송 계층이 알림의 `ttl`·`infmMsgCone`으로 기본 본문을
  만듭니다. 메일 서식 문제로 알림이 유실되지 않습니다.
- 본문 HTML은 GWE 전문 `CONTENTS` 폭(UTF-8 4000바이트) 안에 들어가야 합니다.
  `ApprovalMailRenderer`가 개요·합계를 먼저 넣고 목록은 남는 예산만큼만 싣습니다.
- 메일 클라이언트가 `<style>` 블록을 제거하므로 서식은 인라인 `style` 속성으로 넣습니다.
- `ttl`·`infmMsgCone`은 인앱 알림 표시에 그대로 쓰이므로 HTML을 넣지 않습니다.
```

- [ ] **Step 2: CLAUDE.md §7에 규칙을 더한다**

`- EAI 실패는 EaiResult로 표현하고 ...`로 시작하는 줄 다음에 두 줄을 넣는다.

```markdown
- 외부 채널 메일 본문은 업무 도메인이 완성해 `NotificationEvent.sdPayload`(→ `SD_DOC_CONE`)에 `MailPayload(subject, html)` JSON으로 싣습니다. 발송 계층에 업무 문구를 하드코딩하지 않고, 페이로드가 없으면 알림의 `ttl`·`infmMsgCone`으로 폴백합니다.
- 인앱 알림 조회는 채널을 가리지 않으므로 `ttl`·`infmMsgCone`에 HTML을 저장하지 않습니다.
```

- [ ] **Step 3: 품질 게이트를 돌린다**

Run: `./gradlew check`
Expected: BUILD SUCCESSFUL (테스트 + Spotless + JaCoCo)

- [ ] **Step 4: 커밋한다**

```bash
./gradlew spotlessApply
git add docs/guides/integrations/notifications.md CLAUDE.md
git commit -m "docs: 외부 메일 본문 페이로드 규약 반영"
```

- [ ] **Step 5: 수동 확인 항목을 사용자에게 보고한다**

자동 검증으로 덮이지 않으므로 사용자에게 확인을 요청한다.

1. 백엔드·프론트 기동 후 전산예산 신청서를 상신한다.
2. `EAI_WIRE_LOG_LEVEL=DEBUG`로 요청 덤프의 개별부 줄에서 `물음표(0x3F)=0개`와 비ASCII 바이트가 잡히는지 확인한다.
3. 수신 메일에서 제목 형식, 개요 6개 항목, 총괄표 합계, 상세 링크 동작을 확인한다.
4. 포탈 인앱 알림 목록에 HTML 태그가 노출되지 않는지 확인한다.
