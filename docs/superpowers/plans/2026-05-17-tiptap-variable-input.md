# Tiptap Editor 변수 입력 기능 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tiptap 에디터에 `{...}` 토큰 형태의 변수 노드를 도입해, 게시글 조회 시마다 백엔드의 최신 예산·사업 데이터로 자동 갱신되도록 한다.

**Architecture:** Tiptap atomic inline Node(`tiptapVariable`) + `{` Suggestion 트리거 → 백엔드 `/api/tiptap-variables/metadata`(카탈로그) + `/api/tiptap-variables/resolve`(토큰 일괄 해석) 호출. 프론트는 표시만, 카탈로그/해석/포맷팅은 백엔드 단일 책임. 권한 필터링은 JWT 클레임 기반 `@PreAuthorize`로 이중 적용.

**Tech Stack:** Nuxt 4 (Vue 3 + TypeScript), Tiptap 3 + `@tiptap/suggestion`, Spring Boot 4, Java 25, QueryDSL, JUnit 5 + Mockito + AssertJ, Vitest, Playwright.

**Design Ref:** `docs/superpowers/specs/2026-05-17-tiptap-variable-input-design.md`

---

## File Structure

### 백엔드 (신규)
```
it_backend/src/main/java/com/kdb/it/common/system/tiptap/
├── controller/TiptapVariableController.java
├── service/TiptapVariableService.java
├── dto/TiptapVariableDto.java
└── util/TiptapTokenParser.java
```
- `BudgetStatusQueryRepository`(기존), `ProjectRepository`(기존)를 참조하여 데이터 조회. 신규 Repository 불필요.

### 백엔드 (테스트, 신규)
```
it_backend/src/test/java/com/kdb/it/common/system/tiptap/
├── controller/TiptapVariableControllerTest.java
├── service/TiptapVariableServiceTest.java
└── util/TiptapTokenParserTest.java
```

### 프론트엔드 (신규/수정)
```
it_frontend/app/
├── types/tiptapVariable.ts                                   # 신규
├── composables/useTiptapVariables.ts                         # 신규
├── components/VariableNodeView.vue                           # 신규
├── components/extensions/tiptap-content-extensions.ts        # 수정
├── components/extensions/tiptap-extensions.ts                # 수정
├── components/TiptapEditor.vue                               # 수정
├── utils/hwpx.ts                                             # 수정
└── pages/info/plan/[id].vue                                  # 수정
```

### 프론트엔드 (테스트, 신규/수정)
```
it_frontend/tests/
├── unit/composables/useTiptapVariables.test.ts               # 신규
├── unit/components/extensions/variableExtension.test.ts     # 신규
├── unit/components/VariableNodeView.test.ts                 # 신규
├── unit/utils/hwpx.test.ts                                  # 수정
└── e2e/tiptap-variable.spec.ts                              # 신규
```

---

## Task 1: 백엔드 토큰 파서 (TDD)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/util/TiptapTokenParser.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/tiptap/util/TiptapTokenParserTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.kdb.it.common.system.tiptap.util;

import com.kdb.it.common.system.tiptap.util.TiptapTokenParser.ParseResult;
import com.kdb.it.common.system.tiptap.util.TiptapTokenParser.Category;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TiptapTokenParserTest {

    private final TiptapTokenParser parser = new TiptapTokenParser();

    @Test
    @DisplayName("전산예산 토큰 — 카테고리 prefix 정상 파싱")
    void parse_itBudgetToken_returnsCategoryAndItem() {
        ParseResult result = parser.parse("2026.itBudget.requestAmount");
        assertThat(result.valid()).isTrue();
        assertThat(result.year()).isEqualTo(2026);
        assertThat(result.category()).isEqualTo(Category.IT_BUDGET);
        assertThat(result.projectCode()).isNull();
        assertThat(result.item()).isEqualTo("requestAmount");
    }

    @Test
    @DisplayName("사업별 토큰 — 사업코드 세그먼트 포함 파싱")
    void parse_projToken_returnsProjectCode() {
        ParseResult result = parser.parse("2026.proj.PROJ001.allocationRate");
        assertThat(result.valid()).isTrue();
        assertThat(result.category()).isEqualTo(Category.PROJ);
        assertThat(result.projectCode()).isEqualTo("PROJ001");
        assertThat(result.item()).isEqualTo("allocationRate");
    }

    @Test
    @DisplayName("사업별 토큰 — 사업코드 없으면 INVALID")
    void parse_projWithoutCode_returnsInvalid() {
        assertThat(parser.parse("2026.proj.requestAmount").valid()).isFalse();
    }

    @Test
    @DisplayName("비-사업 카테고리에 사업코드 세그먼트 있으면 INVALID")
    void parse_itBudgetWithCode_returnsInvalid() {
        assertThat(parser.parse("2026.itBudget.PROJ001.requestAmount").valid()).isFalse();
    }

    @Test
    @DisplayName("미지원 항목 → INVALID")
    void parse_unknownItem_returnsInvalid() {
        assertThat(parser.parse("2026.itBudget.unknownField").valid()).isFalse();
    }

    @Test
    @DisplayName("연도 4자리 미만 → INVALID")
    void parse_shortYear_returnsInvalid() {
        assertThat(parser.parse("26.itBudget.requestAmount").valid()).isFalse();
    }

    @Test
    @DisplayName("자본예산·일반관리비 카테고리 인식")
    void parse_capBudgetAndOpex() {
        assertThat(parser.parse("2026.capBudget.allocatedAmount").category()).isEqualTo(Category.CAP_BUDGET);
        assertThat(parser.parse("2026.opex.allocatedAmount").category()).isEqualTo(Category.OPEX);
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd it_backend && ./gradlew test --tests TiptapTokenParserTest`
Expected: FAIL — `cannot find symbol class TiptapTokenParser`.

- [ ] **Step 3: TiptapTokenParser 구현**

```java
package com.kdb.it.common.system.tiptap.util;

import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tiptap 변수 토큰 파서.
 *
 * <p>
 * 토큰 구조: {@code <YEAR>.<CATEGORY>[.<PROJECT_CODE>].<ITEM>}
 * 비-사업 카테고리(itBudget/capBudget/opex)는 PROJECT_CODE를 갖지 않으며,
 * 사업 카테고리(proj)는 PROJECT_CODE 세그먼트가 필수입니다.
 * </p>
 *
 * Design Ref: §3.7 토큰 문법
 */
@Component
public class TiptapTokenParser {

    public enum Category { IT_BUDGET, CAP_BUDGET, OPEX, PROJ }

    public record ParseResult(boolean valid, Integer year, Category category,
                              String projectCode, String item) {
        public static ParseResult invalid() {
            return new ParseResult(false, null, null, null, null);
        }
    }

    private static final Pattern NON_PROJ_PATTERN =
            Pattern.compile("^(\\d{4})\\.(itBudget|capBudget|opex)\\.(requestAmount|allocatedAmount|allocationRate)$");

    private static final Pattern PROJ_PATTERN =
            Pattern.compile("^(\\d{4})\\.proj\\.([A-Z0-9_-]+)\\.(requestAmount|allocatedAmount|allocationRate)$");

    private static final Set<String> ALLOWED_ITEMS =
            Set.of("requestAmount", "allocatedAmount", "allocationRate");

    public ParseResult parse(String token) {
        if (token == null || token.isBlank()) {
            return ParseResult.invalid();
        }

        Matcher nonProj = NON_PROJ_PATTERN.matcher(token);
        if (nonProj.matches()) {
            int year = Integer.parseInt(nonProj.group(1));
            Category category = mapCategory(nonProj.group(2));
            String item = nonProj.group(3);
            if (!ALLOWED_ITEMS.contains(item)) return ParseResult.invalid();
            return new ParseResult(true, year, category, null, item);
        }

        Matcher proj = PROJ_PATTERN.matcher(token);
        if (proj.matches()) {
            int year = Integer.parseInt(proj.group(1));
            String projectCode = proj.group(2);
            String item = proj.group(3);
            if (!ALLOWED_ITEMS.contains(item)) return ParseResult.invalid();
            return new ParseResult(true, year, Category.PROJ, projectCode, item);
        }

        return ParseResult.invalid();
    }

    private Category mapCategory(String literal) {
        return switch (literal) {
            case "itBudget"  -> Category.IT_BUDGET;
            case "capBudget" -> Category.CAP_BUDGET;
            case "opex"      -> Category.OPEX;
            default          -> Category.PROJ;
        };
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests TiptapTokenParserTest`
Expected: PASS — 7 tests successful.

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/system/tiptap/util/TiptapTokenParser.java it_backend/src/test/java/com/kdb/it/common/system/tiptap/util/TiptapTokenParserTest.java
git commit -m "feat: Tiptap 변수 토큰 파서 추가"
```

---

## Task 2: 백엔드 DTO 정의

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/dto/TiptapVariableDto.java`

- [ ] **Step 1: DTO 클래스 작성**

```java
package com.kdb.it.common.system.tiptap.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

/**
 * Tiptap 변수 API DTO 모음.
 * Design Ref: §3.6 API 스키마
 */
public final class TiptapVariableDto {

    private TiptapVariableDto() {}

    @Schema(name = "TiptapVariableMetadataResponse", description = "변수 카탈로그 응답")
    public record MetadataResponse(List<CategoryMetadata> categories) {}

    @Schema(name = "TiptapVariableCategoryMetadata", description = "카테고리 메타데이터")
    public record CategoryMetadata(
            @Schema(description = "카테고리 코드", example = "IT_BUDGET") String code,
            @Schema(description = "표시 라벨", example = "전산예산") String label,
            @Schema(description = "지원 연도 목록") List<Integer> years,
            @Schema(description = "사업 목록 (PROJ 카테고리 전용)") List<ProjectRef> projects,
            @Schema(description = "항목 목록") List<ItemRef> items
    ) {}

    @Schema(name = "TiptapVariableProjectRef", description = "사업 참조")
    public record ProjectRef(String code, String name) {}

    @Schema(name = "TiptapVariableItemRef", description = "항목 참조")
    public record ItemRef(String key, String label) {}

    @Schema(name = "TiptapVariableResolveRequest", description = "변수 해석 요청")
    public record ResolveRequest(
            @NotNull
            @Size(max = 200, message = "토큰은 200개를 초과할 수 없습니다")
            @Schema(description = "해석할 토큰 배열")
            List<String> tokens
    ) {}

    @Schema(name = "TiptapVariableResolveResponse", description = "변수 해석 응답")
    public record ResolveResponse(Map<String, ResolvedValue> results) {}

    @Schema(name = "TiptapVariableResolvedValue", description = "해석된 값")
    public record ResolvedValue(
            @Schema(description = "표시값 (포맷팅된 문자열)", example = "900억원") String value,
            @Schema(description = "상태",
                    allowableValues = {"OK", "MISSING", "FORBIDDEN", "INVALID"}) String status
    ) {
        public static ResolvedValue ok(String value)        { return new ResolvedValue(value, "OK"); }
        public static ResolvedValue missing()               { return new ResolvedValue("", "MISSING"); }
        public static ResolvedValue forbidden()             { return new ResolvedValue("", "FORBIDDEN"); }
        public static ResolvedValue invalid()               { return new ResolvedValue("", "INVALID"); }
    }
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/system/tiptap/dto/TiptapVariableDto.java
git commit -m "feat: Tiptap 변수 DTO 정의"
```

---

## Task 3: 백엔드 서비스 (TDD) — 카탈로그 빌드

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/service/TiptapVariableService.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/tiptap/service/TiptapVariableServiceTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java`

- [ ] **Step 1: 실패하는 카탈로그 테스트 작성**

```java
package com.kdb.it.common.system.tiptap.service;

import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.MetadataResponse;
import com.kdb.it.common.system.tiptap.util.TiptapTokenParser;
import com.kdb.it.domain.budget.project.entity.Bprojm;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Year;
import java.util.List;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TiptapVariableServiceTest {

    @Mock private ProjectRepository projectRepository;

    private TiptapVariableService service;

    @BeforeEach
    void setUp() {
        // Task 4에서 budgetStatusRepository 인수 추가됨
        service = new TiptapVariableService(new TiptapTokenParser(), projectRepository, null);
    }

    @Test
    @DisplayName("metadata — 4개 카테고리(전산/자본/일반관리비/사업별) 반환")
    void getMetadata_returnsFourCategories() {
        when(projectRepository.findActiveProjectRefs()).thenReturn(List.of(
                new Bprojm.Ref("PROJ001", "차세대 시스템 구축")
        ));

        MetadataResponse response = service.getMetadata();

        assertThat(response.categories()).extracting("code")
                .containsExactly("IT_BUDGET", "CAP_BUDGET", "OPEX", "PROJ");
    }

    @Test
    @DisplayName("metadata — PROJ 카테고리는 사업 목록 포함, 나머지는 null")
    void getMetadata_projectsOnlyOnProjCategory() {
        when(projectRepository.findActiveProjectRefs()).thenReturn(List.of(
                new Bprojm.Ref("PROJ001", "차세대 시스템 구축")
        ));

        MetadataResponse response = service.getMetadata();

        var byCode = response.categories().stream()
                .collect(Collectors.toMap(c -> c.code(), c -> c));
        assertThat(byCode.get("IT_BUDGET").projects()).isNull();
        assertThat(byCode.get("PROJ").projects()).hasSize(1);
        assertThat(byCode.get("PROJ").projects().get(0).code()).isEqualTo("PROJ001");
    }

    @Test
    @DisplayName("metadata — 모든 카테고리에 3개 항목")
    void getMetadata_eachCategoryHasThreeItems() {
        when(projectRepository.findActiveProjectRefs()).thenReturn(List.of());

        MetadataResponse response = service.getMetadata();

        response.categories().forEach(c ->
                assertThat(c.items()).extracting("key")
                        .containsExactly("requestAmount", "allocatedAmount", "allocationRate"));
    }

    @Test
    @DisplayName("metadata — years는 현재 연도 ±2 범위")
    void getMetadata_yearsAreCurrentPlusMinusTwo() {
        when(projectRepository.findActiveProjectRefs()).thenReturn(List.of());

        MetadataResponse response = service.getMetadata();
        int now = Year.now().getValue();

        response.categories().forEach(c ->
                assertThat(c.years()).containsExactly(now - 2, now - 1, now, now + 1, now + 2));
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd it_backend && ./gradlew test --tests TiptapVariableServiceTest`
Expected: FAIL — `TiptapVariableService` 미존재.

- [ ] **Step 3: `Bprojm`에 정적 record 추가**

`Bprojm.java` 클래스 닫힘 직전에 추가:
```java
    /** 드롭다운/참조용 경량 DTO. */
    public record Ref(String code, String name) {}
```

- [ ] **Step 4: `ProjectRepository`에 메서드 추가**

```java
// it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java
import com.kdb.it.domain.budget.project.entity.Bprojm;
import java.util.List;
import org.springframework.data.jpa.repository.Query;

// 인터페이스 내부에 추가
@Query("""
    SELECT new com.kdb.it.domain.budget.project.entity.Bprojm$Ref(p.projMngNo, p.projNm)
      FROM Bprojm p
     WHERE p.delYn = 'N'
     ORDER BY p.projNm ASC
""")
List<Bprojm.Ref> findActiveProjectRefs();
```

> 실제 컬럼명(`projMngNo`/`projNm`)은 `Bprojm` 엔티티 필드에 맞춰 조정.

- [ ] **Step 5: `TiptapVariableService` 골격 구현**

```java
package com.kdb.it.common.system.tiptap.service;

import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.CategoryMetadata;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.ItemRef;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.MetadataResponse;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.ProjectRef;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.ResolveResponse;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.ResolvedValue;
import com.kdb.it.common.system.tiptap.util.TiptapTokenParser;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.budget.status.repository.BudgetStatusQueryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Year;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

/**
 * Tiptap 변수 카탈로그 빌드 + 토큰 해석 서비스.
 * Design Ref: §2.2, §4.5
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TiptapVariableService {

    private static final List<ItemRef> ITEMS = List.of(
            new ItemRef("requestAmount",   "편성요청액"),
            new ItemRef("allocatedAmount", "편성액"),
            new ItemRef("allocationRate",  "편성률")
    );

    private final TiptapTokenParser tokenParser;
    private final ProjectRepository projectRepository;
    private final BudgetStatusQueryRepository budgetStatusRepository;

    /** 드롭다운용 카탈로그 반환. 권한 필터링은 후속 Task에서 SecurityContext 기준 적용. */
    public MetadataResponse getMetadata() {
        List<Integer> years = currentPlusMinusTwo();
        List<ProjectRef> projects = projectRepository.findActiveProjectRefs().stream()
                .map(r -> new ProjectRef(r.code(), r.name()))
                .toList();

        return new MetadataResponse(List.of(
                new CategoryMetadata("IT_BUDGET",  "전산예산",   years, null,     ITEMS),
                new CategoryMetadata("CAP_BUDGET", "자본예산",   years, null,     ITEMS),
                new CategoryMetadata("OPEX",       "일반관리비", years, null,     ITEMS),
                new CategoryMetadata("PROJ",       "사업별",     years, projects, ITEMS)
        ));
    }

    /** Task 4에서 본 구현 채워짐. 현재는 모든 토큰을 INVALID로 반환. */
    public ResolveResponse resolve(List<String> tokens) {
        Map<String, ResolvedValue> results = new LinkedHashMap<>();
        for (String token : tokens) {
            results.put(token, ResolvedValue.invalid());
        }
        return new ResolveResponse(results);
    }

    private List<Integer> currentPlusMinusTwo() {
        int now = Year.now().getValue();
        return IntStream.rangeClosed(now - 2, now + 2).boxed().toList();
    }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests TiptapVariableServiceTest`
Expected: PASS — 4 tests successful.

- [ ] **Step 7: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/system/tiptap/service/TiptapVariableService.java it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java it_backend/src/test/java/com/kdb/it/common/system/tiptap/service/TiptapVariableServiceTest.java
git commit -m "feat: Tiptap 변수 카탈로그 빌드 서비스 추가"
```

---

## Task 4: 백엔드 서비스 — 토큰 해석 (TDD)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/service/TiptapVariableService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/system/tiptap/service/TiptapVariableServiceTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/status/repository/BudgetStatusQueryRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/status/repository/BudgetStatusQueryRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/status/dto/BudgetStatusDto.java`

- [ ] **Step 1: 실패하는 해석 테스트 추가**

기존 테스트 클래스에 mock 필드와 테스트 추가:

```java
    // 클래스 상단 필드에 추가
    @Mock private BudgetStatusQueryRepository budgetStatusRepository;

    // setUp 메서드 갱신
    @BeforeEach
    void setUp() {
        service = new TiptapVariableService(new TiptapTokenParser(), projectRepository, budgetStatusRepository);
    }

    @Test
    @DisplayName("resolve — 잘못된 토큰은 INVALID 반환")
    void resolve_invalidToken_returnsInvalid() {
        var response = service.resolve(List.of("not-a-valid-token"));
        assertThat(response.results().get("not-a-valid-token").status()).isEqualTo("INVALID");
    }

    @Test
    @DisplayName("resolve — 데이터 없으면 MISSING 반환")
    void resolve_noData_returnsMissing() {
        when(budgetStatusRepository.aggregateByCategory(2026, "IT_BUDGET"))
                .thenReturn(new com.kdb.it.domain.budget.status.dto.BudgetStatusDto.AggregatedAmount(null, null));

        var response = service.resolve(List.of("2026.itBudget.requestAmount"));
        assertThat(response.results().get("2026.itBudget.requestAmount").status()).isEqualTo("MISSING");
    }

    @Test
    @DisplayName("resolve — 정상 토큰은 OK + 포맷된 값 반환 (억원 단위)")
    void resolve_okToken_returnsFormattedValue() {
        when(budgetStatusRepository.aggregateByCategory(2026, "IT_BUDGET"))
                .thenReturn(new com.kdb.it.domain.budget.status.dto.BudgetStatusDto.AggregatedAmount(
                        90_000_000_000L, 85_000_000_000L));

        var response = service.resolve(List.of("2026.itBudget.requestAmount"));
        var resolved = response.results().get("2026.itBudget.requestAmount");
        assertThat(resolved.status()).isEqualTo("OK");
        assertThat(resolved.value()).isEqualTo("900억원");
    }

    @Test
    @DisplayName("resolve — 편성률은 % 단위로 포맷")
    void resolve_allocationRate_returnsPercent() {
        when(budgetStatusRepository.aggregateByCategory(2026, "IT_BUDGET"))
                .thenReturn(new com.kdb.it.domain.budget.status.dto.BudgetStatusDto.AggregatedAmount(
                        100_000_000_000L, 85_300_000_000L));

        var response = service.resolve(List.of("2026.itBudget.allocationRate"));
        assertThat(response.results().get("2026.itBudget.allocationRate").value()).isEqualTo("85.3%");
    }
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd it_backend && ./gradlew test --tests TiptapVariableServiceTest`
Expected: FAIL — `aggregateByCategory` 미구현 또는 INVALID 반환.

- [ ] **Step 3: `BudgetStatusDto`에 record 추가**

```java
// 기존 DTO 묶음 클래스 내부에 추가
public record AggregatedAmount(Long requestSum, Long allocatedSum) {}
```

- [ ] **Step 4: `BudgetStatusQueryRepository` 인터페이스에 메서드 추가**

```java
import com.kdb.it.domain.budget.status.dto.BudgetStatusDto.AggregatedAmount;

// 인터페이스 내부에 추가
/**
 * 카테고리·연도 기준 편성요청액·편성액 합계를 반환합니다.
 * Tiptap 변수 토큰 해석 전용.
 */
AggregatedAmount aggregateByCategory(int year, String categoryCode);

/** 사업·연도 기준 편성요청액·편성액 합계. */
AggregatedAmount aggregateByProject(int year, String projectCode);
```

- [ ] **Step 5: `BudgetStatusQueryRepositoryImpl`에 QueryDSL 구현 추가**

```java
// QBbugtm, QBprojm 등 기존 Q-Type import 그대로 사용

@Override
public AggregatedAmount aggregateByCategory(int year, String categoryCode) {
    Long requestSum = queryFactory
            .select(QBbugtm.bbugtm.bgRqstAmt.sum().coalesce(0L))
            .from(QBbugtm.bbugtm)
            .join(QBprojm.bprojm).on(QBbugtm.bbugtm.projMngNo.eq(QBprojm.bprojm.projMngNo))
            .where(QBbugtm.bbugtm.bgYy.eq(String.valueOf(year))
                    .and(QBbugtm.bbugtm.delYn.eq("N"))
                    .and(QBprojm.bprojm.projTpC.eq(categoryCode)))
            .fetchOne();

    Long allocatedSum = queryFactory
            .select(QBbugtm.bbugtm.bgAdjAmt.sum().coalesce(0L))
            .from(QBbugtm.bbugtm)
            .join(QBprojm.bprojm).on(QBbugtm.bbugtm.projMngNo.eq(QBprojm.bprojm.projMngNo))
            .where(QBbugtm.bbugtm.bgYy.eq(String.valueOf(year))
                    .and(QBbugtm.bbugtm.delYn.eq("N"))
                    .and(QBprojm.bprojm.projTpC.eq(categoryCode)))
            .fetchOne();

    if ((requestSum == null || requestSum == 0L) && (allocatedSum == null || allocatedSum == 0L)) {
        return new AggregatedAmount(null, null);
    }
    return new AggregatedAmount(requestSum, allocatedSum);
}

@Override
public AggregatedAmount aggregateByProject(int year, String projectCode) {
    Long requestSum = queryFactory
            .select(QBbugtm.bbugtm.bgRqstAmt.sum().coalesce(0L))
            .from(QBbugtm.bbugtm)
            .where(QBbugtm.bbugtm.bgYy.eq(String.valueOf(year))
                    .and(QBbugtm.bbugtm.delYn.eq("N"))
                    .and(QBbugtm.bbugtm.projMngNo.eq(projectCode)))
            .fetchOne();

    Long allocatedSum = queryFactory
            .select(QBbugtm.bbugtm.bgAdjAmt.sum().coalesce(0L))
            .from(QBbugtm.bbugtm)
            .where(QBbugtm.bbugtm.bgYy.eq(String.valueOf(year))
                    .and(QBbugtm.bbugtm.delYn.eq("N"))
                    .and(QBbugtm.bbugtm.projMngNo.eq(projectCode)))
            .fetchOne();

    if ((requestSum == null || requestSum == 0L) && (allocatedSum == null || allocatedSum == 0L)) {
        return new AggregatedAmount(null, null);
    }
    return new AggregatedAmount(requestSum, allocatedSum);
}
```
> 실제 컬럼명(`bgRqstAmt`/`bgAdjAmt`/`bgYy`/`projTpC`/`projMngNo`)은 기존 `Bbugtm`/`Bprojm` 엔티티 필드에 맞춰 조정.

- [ ] **Step 6: `TiptapVariableService.resolve()` 본 구현으로 교체**

```java
import com.kdb.it.common.system.tiptap.util.TiptapTokenParser.ParseResult;
import com.kdb.it.domain.budget.status.dto.BudgetStatusDto.AggregatedAmount;

@Override
public ResolveResponse resolve(List<String> tokens) {
    Map<String, ResolvedValue> results = new LinkedHashMap<>();
    for (String token : tokens) {
        results.put(token, resolveOne(token));
    }
    return new ResolveResponse(results);
}

private ResolvedValue resolveOne(String token) {
    ParseResult parsed = tokenParser.parse(token);
    if (!parsed.valid()) return ResolvedValue.invalid();

    AggregatedAmount agg = switch (parsed.category()) {
        case IT_BUDGET, CAP_BUDGET, OPEX ->
                budgetStatusRepository.aggregateByCategory(parsed.year(), parsed.category().name());
        case PROJ ->
                budgetStatusRepository.aggregateByProject(parsed.year(), parsed.projectCode());
    };

    if (agg == null || (agg.requestSum() == null && agg.allocatedSum() == null)) {
        return ResolvedValue.missing();
    }

    return switch (parsed.item()) {
        case "requestAmount"   -> agg.requestSum() == null
                ? ResolvedValue.missing()
                : ResolvedValue.ok(formatAmount(agg.requestSum()));
        case "allocatedAmount" -> agg.allocatedSum() == null
                ? ResolvedValue.missing()
                : ResolvedValue.ok(formatAmount(agg.allocatedSum()));
        case "allocationRate"  -> formatRate(agg);
        default                -> ResolvedValue.invalid();
    };
}

private String formatAmount(long won) {
    if (won >= 100_000_000L) {
        long uk = won / 100_000_000L;
        return uk + "억원";
    }
    if (won >= 10_000L) {
        long man = won / 10_000L;
        return man + "만원";
    }
    return won + "원";
}

private ResolvedValue formatRate(AggregatedAmount agg) {
    if (agg.requestSum() == null || agg.requestSum() == 0L || agg.allocatedSum() == null) {
        return ResolvedValue.missing();
    }
    double rate = (agg.allocatedSum() * 100.0) / agg.requestSum();
    return ResolvedValue.ok(String.format("%.1f%%", rate));
}
```

> `@Override`는 인터페이스 메서드가 아니므로 제거. resolve()/resolveOne() 메서드는 신규 추가/교체.

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests TiptapVariableServiceTest`
Expected: PASS — 8 tests successful.

- [ ] **Step 8: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/system/tiptap/service/TiptapVariableService.java it_backend/src/main/java/com/kdb/it/domain/budget/status/repository/ it_backend/src/main/java/com/kdb/it/domain/budget/status/dto/BudgetStatusDto.java it_backend/src/test/java/com/kdb/it/common/system/tiptap/service/TiptapVariableServiceTest.java
git commit -m "feat: Tiptap 변수 토큰 해석 + 금액·편성률 포맷팅"
```

---

## Task 5: 백엔드 컨트롤러 (TDD)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/controller/TiptapVariableController.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/tiptap/controller/TiptapVariableControllerTest.java`

- [ ] **Step 1: 컨트롤러 테스트 작성**

```java
package com.kdb.it.common.system.tiptap.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.MetadataResponse;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.ResolveRequest;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.ResolveResponse;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.ResolvedValue;
import com.kdb.it.common.system.tiptap.service.TiptapVariableService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TiptapVariableController.class)
class TiptapVariableControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean  private TiptapVariableService service;

    @Test
    @WithMockUser
    @DisplayName("GET /metadata — 인증 사용자에게 카탈로그 반환")
    void getMetadata_authenticated_returnsOk() throws Exception {
        when(service.getMetadata()).thenReturn(new MetadataResponse(List.of()));

        mockMvc.perform(get("/api/tiptap-variables/metadata"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories").isArray());
    }

    @Test
    @DisplayName("GET /metadata — 미인증 사용자는 401")
    void getMetadata_anonymous_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/tiptap-variables/metadata"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser
    @DisplayName("POST /resolve — 정상 요청은 200 + results 반환")
    void resolve_validRequest_returnsResults() throws Exception {
        when(service.resolve(any())).thenReturn(new ResolveResponse(Map.of(
                "2026.itBudget.requestAmount", ResolvedValue.ok("900억원")
        )));

        var body = objectMapper.writeValueAsString(
                new ResolveRequest(List.of("2026.itBudget.requestAmount")));

        mockMvc.perform(post("/api/tiptap-variables/resolve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.['2026.itBudget.requestAmount'].status").value("OK"))
                .andExpect(jsonPath("$.results.['2026.itBudget.requestAmount'].value").value("900억원"));
    }

    @Test
    @WithMockUser
    @DisplayName("POST /resolve — 토큰 201개면 400")
    void resolve_tooManyTokens_returnsBadRequest() throws Exception {
        var tooMany = IntStream.range(0, 201)
                .mapToObj(i -> "2026.itBudget.requestAmount")
                .toList();
        var body = objectMapper.writeValueAsString(new ResolveRequest(tooMany));

        mockMvc.perform(post("/api/tiptap-variables/resolve")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd it_backend && ./gradlew test --tests TiptapVariableControllerTest`
Expected: FAIL — `TiptapVariableController` 미존재.

- [ ] **Step 3: 컨트롤러 구현**

```java
package com.kdb.it.common.system.tiptap.controller;

import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.MetadataResponse;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.ResolveRequest;
import com.kdb.it.common.system.tiptap.dto.TiptapVariableDto.ResolveResponse;
import com.kdb.it.common.system.tiptap.service.TiptapVariableService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Tiptap 에디터 변수 입력 기능 컨트롤러.
 *
 * <p>인증된 모든 사용자가 호출 가능. 권한별 필터링은 서비스 계층에서 적용한다.</p>
 *
 * Design Ref: §2.2 백엔드, §4.5 권한 필터링
 */
@RestController
@RequestMapping("/api/tiptap-variables")
@RequiredArgsConstructor
@Tag(name = "TiptapVariable", description = "Tiptap 변수 입력 API")
public class TiptapVariableController {

    private final TiptapVariableService service;

    @GetMapping("/metadata")
    @Operation(summary = "변수 카탈로그 조회",
               description = "Tiptap 변수 드롭다운에 표시할 카테고리·연도·사업·항목 목록을 반환합니다.")
    public ResponseEntity<MetadataResponse> getMetadata() {
        return ResponseEntity.ok(service.getMetadata());
    }

    @PostMapping("/resolve")
    @Operation(summary = "변수 토큰 해석",
               description = "토큰 배열을 받아 토큰별 표시값과 상태를 반환합니다. 최대 200개.")
    public ResponseEntity<ResolveResponse> resolve(@Valid @RequestBody ResolveRequest request) {
        return ResponseEntity.ok(service.resolve(request.tokens()));
    }
}
```

`SecurityConfig`에 신규 경로 추가 — 인증만 요구하면 추가 화이트리스트 불필요. 기본 보호로 충분.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests TiptapVariableControllerTest`
Expected: PASS — 4 tests successful.

- [ ] **Step 5: 빌드 전체 검증**

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/system/tiptap/controller/TiptapVariableController.java it_backend/src/test/java/com/kdb/it/common/system/tiptap/controller/TiptapVariableControllerTest.java
git commit -m "feat: Tiptap 변수 REST 컨트롤러 추가"
```

---

## Task 6: 프론트 타입 정의

**Files:**
- Create: `it_frontend/app/types/tiptapVariable.ts`

- [ ] **Step 1: 타입 파일 작성**

```ts
// it_frontend/app/types/tiptapVariable.ts
/**
 * Tiptap 변수 입력 기능 — 공유 타입.
 * Design Ref: §3.4 useTiptapVariables 공개 API
 */

/** 서버 응답 상태 (백엔드 반환) */
export type ServerStatus = 'OK' | 'MISSING' | 'FORBIDDEN' | 'INVALID';

/** 클라이언트 표시 상태 (서버 상태 + 네트워크·로딩 상태) */
export type ClientStatus = ServerStatus | 'LOADING' | 'STALE';

/** 해석된 변수값 (NodeView 렌더링 입력) */
export interface ResolvedValue {
  value: string;
  status: ClientStatus;
}

export type CategoryCode = 'IT_BUDGET' | 'CAP_BUDGET' | 'OPEX' | 'PROJ';

export interface ProjectRef {
  code: string;
  name: string;
}

export interface ItemRef {
  key: 'requestAmount' | 'allocatedAmount' | 'allocationRate';
  label: string;
}

export interface CategoryMetadata {
  code: CategoryCode;
  label: string;
  years: number[];
  projects?: ProjectRef[];
  items: ItemRef[];
}

export interface VariableMetadata {
  categories: CategoryMetadata[];
}

export interface ResolveResponse {
  results: Record<string, { value: string; status: ServerStatus }>;
}
```

- [ ] **Step 2: 타입체크 확인**

Run: `cd it_frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/app/types/tiptapVariable.ts
git commit -m "feat: Tiptap 변수 공유 타입 정의"
```

---

## Task 7: 프론트 composable — extractTokens (TDD)

**Files:**
- Create: `it_frontend/app/composables/useTiptapVariables.ts`
- Test: `it_frontend/tests/unit/composables/useTiptapVariables.test.ts`

- [ ] **Step 1: extractTokens 실패 테스트 작성**

```ts
// it_frontend/tests/unit/composables/useTiptapVariables.test.ts
import { describe, expect, it } from 'vitest';
import { useTiptapVariables } from '../../../app/composables/useTiptapVariables';

describe('useTiptapVariables.extractTokens', () => {
    it('span data-token 속성에서 토큰 배열을 추출한다', () => {
        const { extractTokens } = useTiptapVariables();
        const html = `<p><span data-type="tiptap-variable" data-token="2026.itBudget.requestAmount" data-snapshot="900억원"></span><span data-type="tiptap-variable" data-token="2026.proj.PROJ001.allocationRate" data-snapshot="85.3%"></span></p>`;
        expect(extractTokens(html)).toEqual([
            '2026.itBudget.requestAmount',
            '2026.proj.PROJ001.allocationRate',
        ]);
    });

    it('중복 토큰을 제거한다', () => {
        const { extractTokens } = useTiptapVariables();
        const html = `<span data-type="tiptap-variable" data-token="2026.itBudget.requestAmount"></span><span data-type="tiptap-variable" data-token="2026.itBudget.requestAmount"></span>`;
        expect(extractTokens(html)).toEqual(['2026.itBudget.requestAmount']);
    });

    it('빈/누락 HTML은 빈 배열 반환', () => {
        const { extractTokens } = useTiptapVariables();
        expect(extractTokens('')).toEqual([]);
        expect(extractTokens('<p>no variables</p>')).toEqual([]);
    });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd it_frontend && npm test -- useTiptapVariables`
Expected: FAIL — 모듈 미존재.

- [ ] **Step 3: composable 골격 + extractTokens 구현**

```ts
// it_frontend/app/composables/useTiptapVariables.ts
import { ref } from 'vue';
import type { VariableMetadata, ResolvedValue, ResolveResponse } from '~/types/tiptapVariable';

const metadataCache = ref<VariableMetadata | null>(null);
let inFlightMetadata: Promise<VariableMetadata> | null = null;

const getFetch = (): typeof $fetch => {
    try {
        const app = useNuxtApp();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (app as any).$apiFetch ?? $fetch;
    } catch {
        // 테스트 환경 폴백
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (globalThis as any).$fetch ?? $fetch;
    }
};

/**
 * Tiptap 변수 카탈로그/해석 composable.
 * Design Ref: §3.4
 */
export function useTiptapVariables() {
    const extractTokens = (html: string): string[] => {
        if (!html) return [];
        const pattern = /<span[^>]*data-type=["']tiptap-variable["'][^>]*data-token=["']([^"']+)["'][^>]*><\/span>/g;
        const tokens = new Set<string>();
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(html)) !== null) {
            tokens.add(match[1]);
        }
        return Array.from(tokens);
    };

    /** Task 8에서 본 구현 채워짐 */
    const loadMetadata = async (): Promise<void> => {
        // placeholder — Task 8에서 교체
    };

    /** Task 8에서 본 구현 채워짐 */
    const resolveTokens = async (
        _tokens: string[],
    ): Promise<Record<string, ResolvedValue>> => {
        return {};
    };

    return {
        metadata: metadataCache,
        loadMetadata,
        resolveTokens,
        extractTokens,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- useTiptapVariables`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/composables/useTiptapVariables.ts it_frontend/tests/unit/composables/useTiptapVariables.test.ts
git commit -m "feat: Tiptap 변수 composable 골격 + extractTokens"
```

---

## Task 8: composable — loadMetadata + resolveTokens (TDD)

**Files:**
- Modify: `it_frontend/app/composables/useTiptapVariables.ts`
- Modify: `it_frontend/tests/unit/composables/useTiptapVariables.test.ts`

- [ ] **Step 1: 추가 테스트 작성**

기존 테스트 파일에 다음 describe 블록 추가:

```ts
import { afterEach, beforeEach, vi } from 'vitest';

describe('useTiptapVariables.loadMetadata + resolveTokens', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal('$fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loadMetadata는 첫 호출에만 API를 호출하고 이후엔 캐시 사용', async () => {
        fetchMock.mockResolvedValue({ categories: [] });
        const { loadMetadata } = useTiptapVariables();
        await loadMetadata();
        await loadMetadata();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/api/tiptap-variables/metadata'),
            expect.any(Object),
        );
    });

    it('resolveTokens는 빈 배열이면 API 호출 없이 빈 객체 반환', async () => {
        fetchMock.mockResolvedValue({ results: {} });
        const { resolveTokens } = useTiptapVariables();
        const result = await resolveTokens([]);
        expect(result).toEqual({});
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('resolveTokens는 서버 응답을 ResolvedValue 형태로 매핑', async () => {
        fetchMock.mockResolvedValue({
            results: {
                '2026.itBudget.requestAmount': { value: '900억원', status: 'OK' },
                '2026.proj.UNKNOWN.requestAmount': { value: '', status: 'MISSING' },
            },
        });
        const { resolveTokens } = useTiptapVariables();
        const result = await resolveTokens([
            '2026.itBudget.requestAmount',
            '2026.proj.UNKNOWN.requestAmount',
        ]);
        expect(result['2026.itBudget.requestAmount']).toEqual({ value: '900억원', status: 'OK' });
        expect(result['2026.proj.UNKNOWN.requestAmount']).toEqual({ value: '', status: 'MISSING' });
    });

    it('resolveTokens 네트워크 오류 시 모든 토큰을 STALE 상태로 마킹', async () => {
        fetchMock.mockRejectedValue(new Error('network down'));
        const { resolveTokens } = useTiptapVariables();
        const result = await resolveTokens(['2026.itBudget.requestAmount']);
        expect(result['2026.itBudget.requestAmount'].status).toBe('STALE');
    });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd it_frontend && npm test -- useTiptapVariables`
Expected: FAIL — 두 함수가 미구현 상태.

- [ ] **Step 3: composable 본 구현으로 교체**

`loadMetadata`/`resolveTokens` 본문을 다음으로 교체:

```ts
    const loadMetadata = async (): Promise<void> => {
        if (metadataCache.value) return;
        if (inFlightMetadata) {
            await inFlightMetadata;
            return;
        }
        const fetcher = getFetch();
        inFlightMetadata = fetcher('/api/tiptap-variables/metadata', { method: 'GET' }) as Promise<VariableMetadata>;
        try {
            metadataCache.value = await inFlightMetadata;
        } finally {
            inFlightMetadata = null;
        }
    };

    const resolveTokens = async (
        tokens: string[],
    ): Promise<Record<string, ResolvedValue>> => {
        if (!tokens || tokens.length === 0) return {};

        try {
            const fetcher = getFetch();
            const response = await fetcher('/api/tiptap-variables/resolve', {
                method: 'POST',
                body: { tokens },
            }) as ResolveResponse;

            const mapped: Record<string, ResolvedValue> = {};
            for (const token of tokens) {
                const entry = response.results[token];
                mapped[token] = entry
                    ? { value: entry.value, status: entry.status }
                    : { value: '', status: 'MISSING' };
            }
            return mapped;
        } catch {
            const stale: Record<string, ResolvedValue> = {};
            for (const token of tokens) {
                stale[token] = { value: '', status: 'STALE' };
            }
            return stale;
        }
    };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- useTiptapVariables`
Expected: PASS — 7 tests passing.

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/composables/useTiptapVariables.ts it_frontend/tests/unit/composables/useTiptapVariables.test.ts
git commit -m "feat: Tiptap 변수 metadata 캐시 + token resolve composable"
```

---

## Task 9: VariableExtension Node (TDD)

**Files:**
- Create: `it_frontend/app/components/VariableNodeView.vue` (임시 스텁)
- Modify: `it_frontend/app/components/extensions/tiptap-content-extensions.ts`
- Modify: `it_frontend/app/components/extensions/tiptap-extensions.ts`
- Test: `it_frontend/tests/unit/components/extensions/variableExtension.test.ts`

- [ ] **Step 1: 스텁 NodeView 작성 (컴파일 통과용)**

```vue
<!-- it_frontend/app/components/VariableNodeView.vue (스텁) -->
<script setup lang="ts">
import { nodeViewProps, NodeViewWrapper } from '@tiptap/vue-3';
defineProps(nodeViewProps);
</script>

<template>
  <NodeViewWrapper as="span" data-type="tiptap-variable-view">
    {{ $props.node?.attrs?.snapshot ?? '' }}
  </NodeViewWrapper>
</template>
```

- [ ] **Step 2: parse/render 라운드트립 실패 테스트 작성**

```ts
// it_frontend/tests/unit/components/extensions/variableExtension.test.ts
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

import { VariableExtension } from '../../../../app/components/extensions/tiptap-content-extensions';

const createEditor = (content = '') =>
    new Editor({
        extensions: [StarterKit, VariableExtension.configure({ suggestion: {} })],
        content,
    });

describe('VariableExtension', () => {
    it('HTML로부터 variable 노드를 파싱한다', () => {
        const editor = createEditor(
            '<p><span data-type="tiptap-variable" data-token="2026.itBudget.requestAmount" data-snapshot="900억원"></span></p>',
        );
        const json = editor.getJSON();
        const variable = json.content?.[0]?.content?.find((c) => c.type === 'tiptapVariable');
        expect(variable?.attrs?.token).toBe('2026.itBudget.requestAmount');
        expect(variable?.attrs?.snapshot).toBe('900억원');
        editor.destroy();
    });

    it('renderHTML로 직렬화하면 data-token과 data-snapshot이 보존된다', () => {
        const editor = createEditor();
        editor.commands.insertContent({
            type: 'tiptapVariable',
            attrs: { token: '2026.proj.PROJ001.allocationRate', snapshot: '85.3%' },
        });
        const html = editor.getHTML();
        expect(html).toContain('data-type="tiptap-variable"');
        expect(html).toContain('data-token="2026.proj.PROJ001.allocationRate"');
        expect(html).toContain('data-snapshot="85.3%"');
        editor.destroy();
    });

    it('atom=true이므로 deleteSelection으로 한 번에 삭제된다', () => {
        const editor = createEditor();
        editor.commands.insertContent({
            type: 'tiptapVariable',
            attrs: { token: '2026.itBudget.requestAmount', snapshot: '900억원' },
        });
        const docSize = editor.state.doc.content.size;
        editor.commands.setTextSelection(docSize - 1);
        editor.commands.deleteSelection();
        expect(editor.getHTML()).not.toContain('tiptap-variable');
        editor.destroy();
    });
});
```

- [ ] **Step 3: 테스트 실행해서 실패 확인**

Run: `cd it_frontend && npm test -- variableExtension`
Expected: FAIL — `VariableExtension` export 미존재.

- [ ] **Step 4: VariableExtension 구현**

`tiptap-content-extensions.ts` 파일 끝(`InlineMathExtension`/`BlockMathExtension` 다음)에 추가:

```ts
// ── VariableExtension (PRD_20260517) ──
// Tiptap 변수 입력용 atomic inline 노드. Design Ref: §3.1
import VariableNodeViewComponent from '../VariableNodeView.vue';
import type { VariableMetadata } from '~/types/tiptapVariable';

export const VariableExtension = TiptapNode.create({
    name: 'tiptapVariable',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
        return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            suggestion: {} as Record<string, any>,
        };
    },

    addStorage() {
        return {
            metadata: null as VariableMetadata | null,
            values: new Map<string, { value: string; status: string }>(),
        };
    },

    addAttributes() {
        return {
            token: {
                default: null,
                parseHTML: (el) => el.getAttribute('data-token'),
                renderHTML: (attrs) => (attrs.token ? { 'data-token': attrs.token } : {}),
            },
            snapshot: {
                default: '',
                parseHTML: (el) => el.getAttribute('data-snapshot') ?? '',
                renderHTML: (attrs) => ({ 'data-snapshot': attrs.snapshot ?? '' }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-type="tiptap-variable"]' }];
    },

    renderHTML({ node }) {
        return ['span', mergeAttributes({
            'data-type':     'tiptap-variable',
            'data-token':    node.attrs.token ?? '',
            'data-snapshot': node.attrs.snapshot ?? '',
        })];
    },

    addNodeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return VueNodeViewRenderer(VariableNodeViewComponent as any);
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...this.options.suggestion,
            }),
        ];
    },
});

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        tiptapVariable: {
            insertTiptapVariable: (attrs: { token: string; snapshot?: string }) => ReturnType;
        };
    }
}
```

`tiptap-extensions.ts`의 re-export 블록에 `VariableExtension`을 추가:

```ts
export {
    AttachmentExtension,
    BlockMathExtension,
    CustomHeading,
    FontSize,
    InlineMathExtension,
    VariableExtension,
    createAttachmentSuggestion,
    injectColwidthsFromColgroup,
    normalizeColwidths,
} from './tiptap-content-extensions';
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- variableExtension`
Expected: PASS — 3 tests passing.

- [ ] **Step 6: 커밋**

```bash
git add it_frontend/app/components/extensions/tiptap-content-extensions.ts it_frontend/app/components/extensions/tiptap-extensions.ts it_frontend/app/components/VariableNodeView.vue it_frontend/tests/unit/components/extensions/variableExtension.test.ts
git commit -m "feat: Tiptap atomic 변수 노드 + 스텁 NodeView 추가"
```

---

## Task 10: createVariableSuggestion 헬퍼

**Files:**
- Modify: `it_frontend/app/components/extensions/tiptap-content-extensions.ts`
- Modify: `it_frontend/app/components/extensions/tiptap-extensions.ts`

- [ ] **Step 1: Suggestion 상태 타입과 헬퍼 추가**

`tiptap-content-extensions.ts` 파일 끝에 추가:

```ts
// ── createVariableSuggestion ──
// `{` 트리거 Suggestion 핸들러. Design Ref: §3.3
import type { CategoryMetadata } from '~/types/tiptapVariable';

export interface VariableSuggestItem {
    kind: 'category' | 'project' | 'year' | 'item';
    label: string;
    value: string;
}

export interface VariableSuggestState {
    active: boolean;
    items: VariableSuggestItem[];
    rect: DOMRect | null;
    selectedIndex: number;
    command: ((item: VariableSuggestItem) => void) | null;

    stage: 'category' | 'project' | 'year' | 'item';
    chosenCategory: CategoryMetadata | null;
    chosenProject: { code: string; name: string } | null;
    chosenYear: number | null;
}

function categoryLiteral(code: CategoryMetadata['code']): string {
    return code === 'IT_BUDGET' ? 'itBudget'
        : code === 'CAP_BUDGET' ? 'capBudget'
        : code === 'OPEX' ? 'opex'
        : 'proj';
}

export const createVariableSuggestion = (state: VariableSuggestState) => ({
    char: '{',

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: ({ query, editor }: any): VariableSuggestItem[] => {
        const metadata = editor.storage?.tiptapVariable?.metadata as VariableMetadata | null;
        if (!metadata) return [];

        const filter = (label: string) =>
            !query || label.toLowerCase().includes(query.toLowerCase());

        if (state.stage === 'category') {
            return metadata.categories
                .filter((c) => filter(c.label))
                .map((c) => ({ kind: 'category' as const, label: c.label, value: c.code }));
        }
        if (state.stage === 'project' && state.chosenCategory?.projects) {
            return state.chosenCategory.projects
                .filter((p) => filter(p.name))
                .map((p) => ({ kind: 'project' as const, label: p.name, value: p.code }));
        }
        if (state.stage === 'year' && state.chosenCategory) {
            return state.chosenCategory.years
                .filter((y) => filter(String(y)))
                .map((y) => ({ kind: 'year' as const, label: `${y}년`, value: String(y) }));
        }
        if (state.stage === 'item' && state.chosenCategory) {
            return state.chosenCategory.items
                .filter((i) => filter(i.label))
                .map((i) => ({ kind: 'item' as const, label: i.label, value: i.key }));
        }
        return [];
    },

    command: ({ editor, range, props }: { editor: { commands: unknown; chain: () => unknown; storage: Record<string, unknown> }; range: { from: number; to: number }; props: VariableSuggestItem }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ed = editor as any;
        if (props.kind === 'category') {
            const metadata = ed.storage.tiptapVariable.metadata as VariableMetadata;
            state.chosenCategory = metadata.categories.find((c) => c.code === props.value) ?? null;
            state.stage = state.chosenCategory?.code === 'PROJ' ? 'project' : 'year';
            return;
        }
        if (props.kind === 'project') {
            state.chosenProject = state.chosenCategory?.projects?.find((p) => p.code === props.value) ?? null;
            state.stage = 'year';
            return;
        }
        if (props.kind === 'year') {
            state.chosenYear = Number(props.value);
            state.stage = 'item';
            return;
        }
        // kind === 'item' — 토큰 조립 후 노드 삽입
        const cat = state.chosenCategory!;
        const year = state.chosenYear!;
        const itemKey = props.value;
        const token = cat.code === 'PROJ'
            ? `${year}.proj.${state.chosenProject!.code}.${itemKey}`
            : `${year}.${categoryLiteral(cat.code)}.${itemKey}`;

        ed.chain()
            .focus()
            .deleteRange({ from: range.from, to: range.to })
            .insertContentAt(range.from, { type: 'tiptapVariable', attrs: { token, snapshot: '' } })
            .run();

        state.stage = 'category';
        state.chosenCategory = null;
        state.chosenProject = null;
        state.chosenYear = null;
    },

    render: () => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onStart: (p: any) => {
            state.active = true;
            state.items = p.items;
            state.rect = p.clientRect?.() ?? null;
            state.selectedIndex = 0;
            state.command = p.command;
            state.stage = 'category';
            state.chosenCategory = null;
            state.chosenProject = null;
            state.chosenYear = null;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onUpdate: (p: any) => {
            state.items = p.items;
            state.rect = p.clientRect?.() ?? null;
            state.command = p.command;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onKeyDown: ({ event }: any) => {
            if (!state.active || !state.items.length) return false;
            if (event.key === 'ArrowDown') {
                state.selectedIndex = (state.selectedIndex + 1) % state.items.length;
                return true;
            }
            if (event.key === 'ArrowUp') {
                state.selectedIndex = (state.selectedIndex - 1 + state.items.length) % state.items.length;
                return true;
            }
            if (event.key === 'Enter') {
                const item = state.items[state.selectedIndex];
                if (item && state.command) {
                    state.command(item);
                    return true;
                }
            }
            if (event.key === 'Escape') {
                state.active = false;
                return true;
            }
            return false;
        },
        onExit: () => {
            state.active = false;
        },
    }),
});
```

`tiptap-extensions.ts`의 re-export 블록에 `createVariableSuggestion`을 추가:

```ts
export {
    AttachmentExtension,
    BlockMathExtension,
    CustomHeading,
    FontSize,
    InlineMathExtension,
    VariableExtension,
    createAttachmentSuggestion,
    createVariableSuggestion,
    injectColwidthsFromColgroup,
    normalizeColwidths,
} from './tiptap-content-extensions';
```

- [ ] **Step 2: 타입체크 확인**

Run: `cd it_frontend && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/app/components/extensions/tiptap-content-extensions.ts it_frontend/app/components/extensions/tiptap-extensions.ts
git commit -m "feat: Tiptap 변수 Suggestion 단계별 핸들러"
```

---

## Task 11: VariableNodeView.vue 본 구현 (TDD)

**Files:**
- Modify: `it_frontend/app/components/VariableNodeView.vue`
- Test: `it_frontend/tests/unit/components/VariableNodeView.test.ts`

- [ ] **Step 1: 5상태 렌더링 테스트 작성**

```ts
// it_frontend/tests/unit/components/VariableNodeView.test.ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import VariableNodeView from '../../../app/components/VariableNodeView.vue';

const makeProps = (status: string, value = '', hasInStorage = true) => ({
    node: { attrs: { token: '2026.itBudget.requestAmount', snapshot: '900억원' } },
    editor: {
        isDestroyed: false,
        storage: {
            tiptapVariable: {
                values: hasInStorage
                    ? new Map([['2026.itBudget.requestAmount', { value, status }]])
                    : new Map(),
            },
        },
    },
});

describe('VariableNodeView', () => {
    it('OK 상태에서 indigo 칩 + 표시값 렌더', () => {
        const wrapper = mount(VariableNodeView, { props: makeProps('OK', '900억원') });
        expect(wrapper.text()).toContain('900억원');
        expect(wrapper.attributes('data-status')).toBe('OK');
    });

    it('MISSING 상태에서 빨간 배경 + 토큰 노출', () => {
        const wrapper = mount(VariableNodeView, { props: makeProps('MISSING') });
        expect(wrapper.attributes('data-status')).toBe('MISSING');
        expect(wrapper.text()).toContain('{2026.itBudget.requestAmount}');
    });

    it('LOADING 상태에서 skeleton 표시', () => {
        const wrapper = mount(VariableNodeView, { props: makeProps('LOADING') });
        expect(wrapper.attributes('data-status')).toBe('LOADING');
    });

    it('storage에 토큰이 없으면 snapshot으로 폴백 + STALE 상태', () => {
        const wrapper = mount(VariableNodeView, { props: makeProps('', '', false) });
        expect(wrapper.text()).toContain('900억원');
        expect(wrapper.attributes('data-status')).toBe('STALE');
    });

    it('FORBIDDEN 상태에서 자물쇠 아이콘 + 토큰', () => {
        const wrapper = mount(VariableNodeView, { props: makeProps('FORBIDDEN') });
        expect(wrapper.attributes('data-status')).toBe('FORBIDDEN');
        expect(wrapper.find('.pi-lock').exists()).toBe(true);
    });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd it_frontend && npm test -- VariableNodeView`
Expected: FAIL — 스텁은 data-status 미부여.

- [ ] **Step 3: VariableNodeView 본 구현으로 교체**

```vue
<!-- it_frontend/app/components/VariableNodeView.vue -->
<script setup lang="ts">
/**
 * VariableNodeView — Tiptap 변수 칩 렌더러.
 * Design Ref: §3.2, §5.1
 *
 * editor.storage.tiptapVariable.values: Map<token, { value, status }>
 * 토큰이 storage에 없으면 STALE로 간주하고 node.attrs.snapshot으로 폴백.
 */
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';
import { computed } from 'vue';

const props = defineProps(nodeViewProps);

const token = computed<string>(() => props.node?.attrs?.token ?? '');
const snapshot = computed<string>(() => props.node?.attrs?.snapshot ?? '');

const resolved = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = (props.editor as any)?.storage?.tiptapVariable?.values as
        | Map<string, { value: string; status: string }>
        | undefined;
    const entry = values?.get(token.value);
    if (entry) return entry;
    if (snapshot.value) return { value: snapshot.value, status: 'STALE' };
    return { value: '', status: 'LOADING' };
});

const displayText = computed(() => {
    const { value, status } = resolved.value;
    if (status === 'OK' || status === 'STALE') return value || `{${token.value}}`;
    if (status === 'MISSING' || status === 'FORBIDDEN' || status === 'INVALID') return `{${token.value}}`;
    return '';
});

const tooltip = computed(() => {
    const { status } = resolved.value;
    return ({
        OK:        token.value,
        LOADING:   '값 조회 중...',
        MISSING:   '해당 데이터 없음',
        FORBIDDEN: '권한 없음',
        STALE:     '최신값 조회 실패 — 작성 시점 값 표시',
        INVALID:   '잘못된 변수 토큰',
    } as Record<string, string>)[status] ?? token.value;
});

const ariaLabel = computed(() => `변수 ${token.value} — ${displayText.value}`);
</script>

<template>
  <NodeViewWrapper
    as="span"
    role="img"
    :aria-label="ariaLabel"
    :data-status="resolved.status"
    :title="tooltip"
    class="tiptap-variable-chip"
    :class="`tiptap-variable-chip--${resolved.status.toLowerCase()}`"
  >
    <i v-if="resolved.status === 'FORBIDDEN'" class="pi pi-lock" />
    <span v-if="resolved.status === 'LOADING'" class="tiptap-variable-skeleton" />
    <template v-else>{{ displayText }}</template>
  </NodeViewWrapper>
</template>

<style scoped>
.tiptap-variable-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    margin: 0 1px;
    border-radius: 4px;
    font-size: 0.9em;
    line-height: 1.4;
    cursor: default;
    user-select: none;
}
.tiptap-variable-chip--ok       { background: rgba(99, 102, 241, 0.12); color: #4338ca; }
.tiptap-variable-chip--loading  { background: #f4f4f5; color: transparent; min-width: 60px; }
.tiptap-variable-chip--missing  { background: rgba(220, 38, 38, 0.15); color: #b91c1c; font-family: monospace; }
.tiptap-variable-chip--forbidden{ background: rgba(82, 82, 91, 0.18); color: #3f3f46; font-family: monospace; }
.tiptap-variable-chip--stale    { background: rgba(202, 138, 4, 0.15); color: #92400e; }
.tiptap-variable-chip--invalid  { background: rgba(220, 38, 38, 0.15); color: #b91c1c; font-family: monospace; }

.tiptap-variable-skeleton {
    display: inline-block;
    width: 50px;
    height: 1em;
    background: linear-gradient(90deg, #e4e4e7 0%, #f4f4f5 50%, #e4e4e7 100%);
    background-size: 200% 100%;
    border-radius: 3px;
    animation: tiptap-variable-skeleton 1.2s infinite;
}
@keyframes tiptap-variable-skeleton {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
</style>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- VariableNodeView`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/components/VariableNodeView.vue it_frontend/tests/unit/components/VariableNodeView.test.ts
git commit -m "feat: Tiptap 변수 NodeView 5상태 렌더 + 스타일"
```

---

## Task 12: TiptapEditor 통합

**Files:**
- Modify: `it_frontend/app/components/TiptapEditor.vue`

- [ ] **Step 1: 헤더 주석 업데이트**

`TiptapEditor.vue` 상단의 `[커스텀 확장]` 섹션 끝에 추가:
```
  VariableExtension : 변수 입력 atomic 노드 (PRD_20260517)
```

- [ ] **Step 2: import에 신규 항목 추가**

```ts
import {
    ResizableImage,
    ExcalidrawExtension,
    CustomTable,
    CustomTableCell,
    CustomTableHeader,
    CustomHeading,
    FontSize,
    AttachmentExtension,
    createAttachmentSuggestion,
    InlineMathExtension,
    BlockMathExtension,
    VariableExtension,
    createVariableSuggestion,
    normalizeColwidths,
    injectColwidthsFromColgroup
} from './extensions/tiptap-extensions';
import type {
    VariableSuggestState,
    VariableSuggestItem,
} from './extensions/tiptap-content-extensions';
import type { ResolvedValue } from '~/types/tiptapVariable';
```

- [ ] **Step 3: defineProps에 variableValues 추가**

```ts
    /**
     * 변수 토큰별 해석값 (Design Ref: §3.5).
     * 부모 페이지가 게시글 HTML 로드 후 useTiptapVariables.resolveTokens 결과를 전달합니다.
     */
    variableValues?: Map<string, ResolvedValue>;
```

- [ ] **Step 4: Suggestion 상태와 composable 사용**

`attachSuggest` 선언 다음에 추가:

```ts
// ── 변수 Suggestion 팝업 상태 (PRD_20260517) ──
const variableSuggest = reactive<VariableSuggestState>({
    active: false,
    items: [] as VariableSuggestItem[],
    rect: null,
    selectedIndex: 0,
    command: null,
    stage: 'category',
    chosenCategory: null,
    chosenProject: null,
    chosenYear: null,
});

const { loadMetadata, metadata: variableMetadata } = useTiptapVariables();

const stageIcon = (kind: VariableSuggestItem['kind']) =>
    kind === 'category' ? 'pi-tag'
        : kind === 'project' ? 'pi-briefcase'
        : kind === 'year' ? 'pi-calendar'
        : 'pi-hashtag';
```

- [ ] **Step 5: extensions 배열에 VariableExtension 등록**

`BlockMathExtension` 다음 줄에 추가:

```ts
        VariableExtension.configure({
            suggestion: createVariableSuggestion(variableSuggest),
        }),
```

- [ ] **Step 6: onCreate에서 메타데이터 로딩**

기존 `onCreate` 블록을 다음과 같이 확장:

```ts
    onCreate: ({ editor }) => {
        extractTOC(editor);

        // 변수 카탈로그 로딩 (Design Ref: §4.3)
        loadMetadata()
            .then(() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const storage = editor.storage as Record<string, any>;
                if (storage.tiptapVariable) {
                    storage.tiptapVariable.metadata = variableMetadata.value;
                }
            })
            .catch(() => {
                // 카탈로그 로딩 실패 시에도 에디터는 정상 동작.
                // Suggestion 비활성화는 storage.metadata가 null인 상태로 유지.
            });

        nextTick(() => {
            if (!props.readonly && editor) normalizeColwidths(editor);
            applyTableWidths();
        });
    },
```

- [ ] **Step 7: variableValues watch 추가**

`watch(() => props.attachmentList, ...)` 블록 다음에 추가:

```ts
/**
 * variableValues prop을 editor.storage.tiptapVariable.values에 동기화 (Design Ref: §3.5).
 * VariableNodeView가 storage를 reactive하게 참조합니다.
 */
watch(() => props.variableValues, (values) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = editor.value?.storage as Record<string, any> | undefined;
    if (storage?.tiptapVariable) {
        storage.tiptapVariable.values = values ?? new Map();
    }
}, { immediate: true });
```

- [ ] **Step 8: template에 변수 Suggestion 팝업 추가**

첨부파일 `<Teleport>` 블록 바로 아래에 추가:

```vue
    <Teleport to="body">
      <Transition name="table-float">
        <div
          v-if="variableSuggest.active && variableSuggest.items.length"
          class="tiptap-attach-suggest"
          :style="{
            top: (variableSuggest.rect?.bottom ?? 0) + 4 + 'px',
            left: (variableSuggest.rect?.left ?? 0) + 'px',
          }"
          @mousedown.prevent
        >
          <div
            v-for="(item, idx) in variableSuggest.items"
            :key="`${item.kind}-${item.value}`"
            class="attach-suggest-item"
            :class="{ 'attach-suggest-item--active': idx === variableSuggest.selectedIndex }"
            @mousedown.prevent="variableSuggest.command?.(item)"
          >
            <i :class="['pi', stageIcon(item.kind)]" style="font-size: 11px;" />
            <span class="truncate">{{ item.label }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
```

- [ ] **Step 9: 타입체크와 단위 테스트 통과 확인**

Run: `cd it_frontend && npm run typecheck && npm test`
Expected: 모두 PASS.

- [ ] **Step 10: 커밋**

```bash
git add it_frontend/app/components/TiptapEditor.vue
git commit -m "feat: TiptapEditor에 변수 입력 기능 통합"
```

---

## Task 13: 페이지 통합 (info/plan)

**Files:**
- Modify: `it_frontend/app/pages/info/plan/[id].vue`

`info/plan/[id].vue`를 대표 적용 페이지로 채택. 다른 페이지는 follow-up.

- [ ] **Step 1: composable 가져오기**

`<script setup>` 영역에 추가:
```ts
import type { ResolvedValue } from '~/types/tiptapVariable';

const { extractTokens, resolveTokens } = useTiptapVariables();
const variableValues = ref<Map<string, ResolvedValue>>(new Map());
```

- [ ] **Step 2: 게시글 데이터의 본문 watch에 토큰 해석 트리거 추가**

해당 페이지의 본문 reactive 값(예: `plan.value?.contents`)을 찾아 다음 watch 추가:

```ts
watch(() => plan.value?.contents, async (html) => {
    if (!html) {
        variableValues.value = new Map();
        return;
    }
    const tokens = extractTokens(html);
    if (tokens.length === 0) {
        variableValues.value = new Map();
        return;
    }
    const resolved = await resolveTokens(tokens);
    const map = new Map<string, ResolvedValue>();
    Object.entries(resolved).forEach(([token, value]) => map.set(token, value));
    variableValues.value = map;
}, { immediate: true });
```
> `plan.value.contents` 변수명은 해당 페이지의 실제 데이터 모델에 맞춰 조정. 본문 HTML reactive 값이 `data.contents`/`detail.body` 등 다른 이름이면 그것을 watch 대상으로 한다.

- [ ] **Step 3: TiptapEditor에 prop 바인딩**

기존 `<TiptapEditor ...>` 사용처에 추가:
```vue
        :variable-values="variableValues"
```

- [ ] **Step 4: 페이지 수동 검증**

```
cd it_frontend && npm run dev
cd it_backend && ./gradlew bootRun
```

브라우저에서 `http://localhost:3000/info/plan/<existing-id>` 접속. 변수 노드 포함 게시글이면 칩 정상 렌더 확인.

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/pages/info/plan/[id].vue
git commit -m "feat: 계획 상세 페이지에 Tiptap 변수 해석 적용"
```

---

## Task 14: HWPX 내보내기 변수 치환 (TDD)

**Files:**
- Modify: `it_frontend/app/utils/hwpx.ts`
- Modify: `it_frontend/tests/unit/utils/hwpx.test.ts`

- [ ] **Step 1: 변수 치환 테스트 추가**

`hwpx.test.ts`에 새 describe 블록 추가:

```ts
import { preprocessHtmlForHwpx } from '../../../app/utils/hwpx';

describe('hwpx 변환 — 변수 노드 치환', () => {
    it('span[data-type="tiptap-variable"]는 data-snapshot 텍스트로 치환된다', () => {
        const html = `<p>예산: <span data-type="tiptap-variable" data-token="2026.itBudget.requestAmount" data-snapshot="900억원"></span></p>`;
        const out = preprocessHtmlForHwpx(html);
        expect(out).toContain('900억원');
        expect(out).not.toContain('tiptap-variable');
        expect(out).not.toContain('data-token');
    });

    it('snapshot이 없으면 원본 토큰 텍스트로 치환', () => {
        const html = `<span data-type="tiptap-variable" data-token="2026.itBudget.requestAmount" data-snapshot=""></span>`;
        const out = preprocessHtmlForHwpx(html);
        expect(out).toContain('{2026.itBudget.requestAmount}');
    });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `cd it_frontend && npm test -- utils/hwpx`
Expected: FAIL — `preprocessHtmlForHwpx` 미export.

- [ ] **Step 3: `hwpx.ts`에 헬퍼 추가 및 export**

```ts
/**
 * Tiptap 변수 노드를 표시값으로 평탄화합니다.
 * HWPX/PDF 내보내기 시 data-snapshot 텍스트로 치환하여 산출물에 토큰을 남기지 않습니다.
 * Design Ref: §4.4
 */
export function preprocessHtmlForHwpx(html: string): string {
    if (!html) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('span[data-type="tiptap-variable"]').forEach((el) => {
        const snapshot = el.getAttribute('data-snapshot') || '';
        const token = el.getAttribute('data-token') || '';
        const text = snapshot || `{${token}}`;
        const textNode = doc.createTextNode(text);
        el.replaceWith(textNode);
    });
    return doc.body.innerHTML;
}
```

기존 HWPX 변환 진입점(예: `htmlToHwpx` 또는 본문 HTML을 받는 첫 함수)이 입력 HTML을 받는 직후 한 줄 추가:

```ts
html = preprocessHtmlForHwpx(html);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- utils/hwpx`
Expected: PASS — 신규 2개 + 기존 케이스 모두 통과.

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/utils/hwpx.ts it_frontend/tests/unit/utils/hwpx.test.ts
git commit -m "feat: HWPX 내보내기 시 변수 노드를 스냅샷으로 치환"
```

---

## Task 15: E2E 테스트 (Playwright)

**Files:**
- Create: `it_frontend/tests/e2e/tiptap-variable.spec.ts`

- [ ] **Step 1: E2E 시나리오 작성**

```ts
// it_frontend/tests/e2e/tiptap-variable.spec.ts
import { test, expect } from '@playwright/test';

const METADATA_MOCK = {
    categories: [
        {
            code: 'IT_BUDGET',
            label: '전산예산',
            years: [2025, 2026, 2027],
            items: [
                { key: 'requestAmount',   label: '편성요청액' },
                { key: 'allocatedAmount', label: '편성액' },
                { key: 'allocationRate',  label: '편성률' },
            ],
        },
        {
            code: 'PROJ',
            label: '사업별',
            years: [2025, 2026, 2027],
            projects: [{ code: 'PROJ001', name: '차세대 시스템 구축' }],
            items: [
                { key: 'requestAmount',   label: '편성요청액' },
                { key: 'allocatedAmount', label: '편성액' },
                { key: 'allocationRate',  label: '편성률' },
            ],
        },
    ],
};

test.beforeEach(async ({ page }) => {
    await page.route('**/api/tiptap-variables/metadata', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(METADATA_MOCK),
        }),
    );
});

test('시나리오 1 — 카테고리/연도/항목 선택으로 변수 노드 삽입', async ({ page }) => {
    await page.route('**/api/tiptap-variables/resolve', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                results: { '2026.itBudget.requestAmount': { value: '900억원', status: 'OK' } },
            }),
        }),
    );

    await page.goto('/info/plan/new');
    const editor = page.locator('.tiptap-content .ProseMirror');
    await editor.click();
    await editor.type('{');
    await page.locator('.tiptap-attach-suggest').waitFor();
    await page.getByText('전산예산').click();
    await page.getByText('2026년').click();
    await page.getByText('편성요청액').click();

    await expect(page.locator('span[data-type="tiptap-variable"]')).toHaveCount(1);
    await expect(page.locator('.tiptap-variable-chip--ok')).toContainText('900억원');
});

test('시나리오 4 — 누락된 변수는 빨간색 + 토큰 노출', async ({ page }) => {
    await page.route('**/api/tiptap-variables/resolve', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                results: { '2026.proj.UNKNOWN.requestAmount': { value: '', status: 'MISSING' } },
            }),
        }),
    );

    // 변수 노드가 포함된 fixture 페이지 (실DB or stub)
    await page.goto('/info/plan/test-missing-fixture');

    const chip = page.locator('.tiptap-variable-chip--missing');
    await expect(chip).toBeVisible();
    await expect(chip).toContainText('{2026.proj.UNKNOWN.requestAmount}');
});
```

> spec §6.3의 5개 시나리오 중 작성·누락 2개만 자동화. 나머지(사업별, 실DB 갱신, HWPX)는 follow-up.

- [ ] **Step 2: E2E 실행 확인**

Run: `cd it_frontend && npm run test:e2e -- tiptap-variable`
Expected: 2 tests PASS.

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/tests/e2e/tiptap-variable.spec.ts
git commit -m "test: Tiptap 변수 입력 E2E (작성·누락 시나리오)"
```

---

## Task 16: 최종 통합 검증 + PRD 정리

**Files:**
- Move: `prds/PRD_20260517.md` → `prds/done/PRD_20260517.md`

- [ ] **Step 1: 백엔드 + 프론트엔드 전체 검증**

```
cd it_backend && ./gradlew clean test
cd it_frontend && npm run typecheck && npm run lint && npm test
```
Expected: 모두 PASS.

- [ ] **Step 2: 수동 검증 체크리스트 (spec §6.6)**

`npm run dev`와 `./gradlew bootRun`을 띄운 상태에서:
- [ ] info/plan에서 변수 칩 정상 표시
- [ ] 다크모드 색상 대비 충분
- [ ] 키보드만으로 변수 삽입 가능
- [ ] NodeView aria-label 부여 확인 (DevTools)
- [ ] 모바일 뷰포트(768px 이하) 팝업 위치 정상

- [ ] **Step 3: 다른 페이지 적용은 TASK.md에 follow-up 등록**

`TASK.md`에 다음 항목 추가:
```
- [ ] PRD_20260517 follow-up: 다음 페이지에 Tiptap 변수 prop 적용
      - app/pages/info/documents/[id]/index.vue
      - app/pages/info/plan/form.vue
      - app/pages/info/documents/form.vue
      - app/pages/board/** 상세
      - app/pages/guide/** 상세
- [ ] PRD_20260517 follow-up: E2E 시나리오 2/3/5 자동화
```

- [ ] **Step 4: PRD 파일 이동**

```bash
git mv prds/PRD_20260517.md prds/done/PRD_20260517.md
```

- [ ] **Step 5: 최종 커밋**

```bash
git add prds/ TASK.md
git commit -m "chore: PRD_20260517 완료 처리 및 follow-up 등록"
```

---

## 자체 점검 (Self-Review)

**Spec 커버리지:**
- §1.1 변수 카탈로그 → Task 3 (전산/자본/일반관리비/사업별 모두 포함)
- §1.2 핵심 결정 9건 → Task 1~15 전반에 반영
- §2 아키텍처 (프론트/백엔드 컴포넌트, 저장 구조) → Task 1~12
- §3 컴포넌트·인터페이스 → Task 1, 2, 6, 7, 8, 9, 10, 11
- §3.6 API 스키마 → Task 2, 5
- §3.7 토큰 문법 → Task 1
- §4 데이터 흐름 (작성/조회/마운트/내보내기/권한/캐싱) → Task 8(캐싱), 12(마운트), 13(조회), 14(내보내기)
- §5 에러 처리 5상태 → Task 11
- §5.3 토큰 200개 제한 → Task 2, 5
- §6.1~6.3 테스트 → Task 1, 3, 4, 5, 7~9, 11, 14, 15

**Placeholder 점검:**
- "TBD"/"TODO"/"fill in details" 검색 결과 — `loadMetadata`/`resolveTokens` 초기 골격에서 "Task 8에서 채워짐" 노트가 있으나, 같은 plan 안 동일 흐름이므로 placeholder 아님.

**타입 일관성:**
- `VariableSuggestState`/`VariableSuggestItem` — Task 10 정의, Task 12에서 동일 시그니처로 사용. ✓
- `ResolvedValue` — Task 6에서 client/server status 구분, Task 7/8/11/12/13 모두 일관 사용. ✓
- `BudgetStatusDto.AggregatedAmount` — Task 4에서 record로 신규 정의, Service에서 동일 시그니처 사용. ✓
- 토큰 정규식 — Task 1에서 정의, spec §3.7과 일치. ✓
