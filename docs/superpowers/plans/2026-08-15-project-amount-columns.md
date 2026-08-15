# 정보화사업 금액 컬럼 3종 추가 및 '기 지급예산' 입력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TPRMPP_BPROJM`·`TPRMPP_BPROJL`에 `TOT_RQM_AMT`(총소요금액)·`MPL_AMT`(예정금액)·`DFR_AMT`(지급금액)를 추가하고, 사업 등록·수정 폼의 예산 줄 네번째 칸을 사용자 입력 '기 지급예산'으로 재편한다.

**Architecture:** 두 합계 컬럼은 품목(`BITEMM`) 저장이 끝난 뒤 서비스가 다시 합산해 기록하는 **저장 시점 스냅샷**이고, 조회는 지금처럼 품목 합산 파생을 계속 쓴다. `DFR_AMT`만 사용자 입력값으로 컬럼이 유일한 출처다. 변경이력(`BPROJL`)은 `AuditLogPersister`가 `@Column` 필드를 이름으로 매칭 복사하므로 두 엔티티에 같은 필드명을 두는 것 외에 코드가 필요 없다.

**Tech Stack:** Java 25 / Spring Boot 4.1 / JPA / Flyway / Oracle, Nuxt 4 / Vue 3 Composition API / PrimeVue, JUnit 5 + Mockito / Vitest

## Global Constraints

- 설계 SoT: [docs/superpowers/specs/2026-08-15-project-amount-columns-design.md](../specs/2026-08-15-project-amount-columns-design.md)
- 컬럼·타입은 `meta/meta.txt` 용어를 그대로 따른다: `총소요금액,TOT_RQM_AMT,NUMBER,18,3` / `지급금액,DFR_AMT,NUMBER,18,3` / `예정금액,MPL_AMT,NUMBER,18,3`
- 신규 주석은 모두 한글. public API·service 메서드 JavaDoc에 입력값과 실패 조건을 기록한다.
- 스키마 변경은 `it_database/migrations/`의 새 Flyway 스크립트로만 한다. 적용된 스크립트는 수정하지 않는다.
- 응답 DTO 속성에는 `@Schema(requiredMode = REQUIRED)`를 지정하고, null이 올 수 있으면 `nullable = true`를 함께 명시한다.
- **`ProjectDto.Response.totRqmAmt`의 의미(당해예산 = `∑AMT − ∑MPL_AMT`)는 이번 범위에서 바꾸지 않는다.** 새 DB 컬럼 `TOT_RQM_AMT`는 총 예산(`∑AMT`)이고, 응답에는 `prjBgAmt`라는 **별도 필드**로 노출한다.
- 스냅샷 컬럼(`TOT_RQM_AMT`·`MPL_AMT`)은 조회에 쓰지 않는다. 응답 `prjBgAmt`·`mplAmt`도 품목 합산 파생값이다.
- 백엔드 명령: `cd it_backend && ./gradlew test --no-daemon`. 프론트 명령: `cd it_frontend && npx vitest run <경로>`, `npm run check`, `npm run format:check`
- 커밋은 각 저장소 내부에서 한다(`it_backend`, `it_frontend`, `it_database`는 각각 독립 git 저장소).

---

### Task 1: 스키마와 엔티티 (BPROJM / BPROJL)

**Files:**
- Create: `it_database/migrations/V20260815_003__AddBprojmAmountColumns.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java` (`endDtm` 필드 선언 직후)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BprojmL.java` (`endDtm` 필드 선언 직후)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/entity/BprojmAmountColumnMappingTest.java`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `Bprojm`의 `getTotRqmAmt()`, `getMplAmt()`, `getDfrAmt()` (모두 `BigDecimal`). 같은 이름의 필드가 `BprojmL`에도 존재.

- [ ] **Step 1: 실패하는 테스트 작성**

`BprojmL`에 대응 필드를 빠뜨리면 변경이력에서 값이 조용히 사라지므로, 두 엔티티의 컬럼 매핑이 일치하는지 리플렉션으로 고정한다.

```java
package com.kdb.it.domain.budget.project.entity;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.log.entity.BprojmL;
import jakarta.persistence.Column;
import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 정보화사업 금액 컬럼 3종이 마스터(BPROJM)와 변경로그(BPROJL) 양쪽에 같은 이름·같은 컬럼으로 매핑되는지 고정한다.
 *
 * <p>AuditLogPersister가 @Column 필드를 필드명으로 매칭해 복사하므로, 한쪽에만 필드를 추가하면 변경이력에서 값이 조용히 누락된다.
 */
class BprojmAmountColumnMappingTest {

    private static final List<String> AMOUNT_FIELDS = List.of("totRqmAmt", "mplAmt", "dfrAmt");

    @Test
    @DisplayName("금액 3종이 BPROJM에 NUMBER(18,3)으로 매핑된다")
    void bprojmHasAmountColumns() {
        assertThat(columnNameOf(Bprojm.class, "totRqmAmt")).isEqualTo("TOT_RQM_AMT");
        assertThat(columnNameOf(Bprojm.class, "mplAmt")).isEqualTo("MPL_AMT");
        assertThat(columnNameOf(Bprojm.class, "dfrAmt")).isEqualTo("DFR_AMT");
        for (String name : AMOUNT_FIELDS) {
            Column column = fieldOf(Bprojm.class, name).getAnnotation(Column.class);
            assertThat(fieldOf(Bprojm.class, name).getType()).isEqualTo(BigDecimal.class);
            assertThat(column.precision()).isEqualTo(18);
            assertThat(column.scale()).isEqualTo(3);
        }
    }

    @Test
    @DisplayName("변경로그(BPROJL)에 같은 이름·같은 컬럼으로 대응 필드가 있다")
    void bprojmLogMirrorsAmountColumns() {
        for (String name : AMOUNT_FIELDS) {
            assertThat(columnNameOf(BprojmL.class, name))
                    .as("BprojmL.%s 컬럼 매핑", name)
                    .isEqualTo(columnNameOf(Bprojm.class, name));
        }
    }

    private static Field fieldOf(Class<?> type, String name) {
        try {
            Field field = type.getDeclaredField(name);
            field.setAccessible(true);
            return field;
        } catch (NoSuchFieldException e) {
            throw new AssertionError(type.getSimpleName() + "." + name + " 필드가 없습니다", e);
        }
    }

    private static String columnNameOf(Class<?> type, String name) {
        return fieldOf(type, name).getAnnotation(Column.class).name();
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*BprojmAmountColumnMappingTest"
```

Expected: FAIL — `AssertionError: Bprojm.totRqmAmt 필드가 없습니다`

- [ ] **Step 3: Flyway 스크립트 작성**

`it_database/migrations/V20260815_003__AddBprojmAmountColumns.sql`:

```sql
-- V20260815_003__AddBprojmAmountColumns.sql
-- 정보화사업(TPRMPP_BPROJM) 및 로그(TPRMPP_BPROJL)에 금액 3종 추가.
--   TOT_RQM_AMT(총소요금액) / MPL_AMT(예정금액) / DFR_AMT(지급금액)
--
-- 배경: V20260622_007이 TOT_RQM_AMT/MPL_CPIT_AMT/MPL_MNGC_AMT를 드롭하고
--       품목(BITEMM) 합산 파생으로 대체했다. 이번 추가는 그 결정을 뒤집지 않는다.
--   - TOT_RQM_AMT(총 예산 = SUM(AMT)), MPL_AMT(익년 이후 = SUM(MPL_AMT))는
--     조회에 쓰지 않는 저장 시점 스냅샷이다. 조회 기준은 여전히 품목 합산이다.
--   - DFR_AMT(기 지급예산)만 사용자 입력값이며 이 컬럼이 유일한 출처다.
--
-- 주의: 되살린 TOT_RQM_AMT의 의미는 드롭 전과 다르다.
--       드롭 전 = 당해예산, 이번 = 총 예산. 응답 필드 totRqmAmt(당해예산)와 구분할 것.
--
-- 멱등성: 컬럼이 없을 때만 ADD.
DECLARE
    FUNCTION col_exists(p_table VARCHAR2, p_col VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n FROM ALL_TAB_COLS
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND TABLE_NAME = p_table AND COLUMN_NAME = p_col;
        RETURN n > 0;
    END;
    PROCEDURE add_amt_col(p_table VARCHAR2, p_col VARCHAR2, p_comment VARCHAR2) IS
    BEGIN
        IF NOT col_exists(p_table, p_col) THEN
            EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' ADD ' || p_col
                              || ' NUMBER(18,3) DEFAULT 0';
            EXECUTE IMMEDIATE 'COMMENT ON COLUMN ' || p_table || '.' || p_col
                              || ' IS ''' || p_comment || '''';
        END IF;
    END;
BEGIN
    add_amt_col('TPRMPP_BPROJM', 'TOT_RQM_AMT', '총소요금액 (총 예산 = 활성품목 AMT 합계 스냅샷)');
    add_amt_col('TPRMPP_BPROJM', 'MPL_AMT',     '예정금액 (예산연도+1 이후 = 활성품목 MPL_AMT 합계 스냅샷)');
    add_amt_col('TPRMPP_BPROJM', 'DFR_AMT',     '지급금액 (기 지급예산, 사용자 입력)');
    add_amt_col('TPRMPP_BPROJL', 'TOT_RQM_AMT', '총소요금액');
    add_amt_col('TPRMPP_BPROJL', 'MPL_AMT',     '예정금액');
    add_amt_col('TPRMPP_BPROJL', 'DFR_AMT',     '지급금액');
END;
/
```

- [ ] **Step 4: `Bprojm`에 필드 3개 추가**

`endDtm` 필드 선언 바로 아래에 넣는다(추진시기 다음에 소요예산이라는 화면 순서와 맞춘다).

```java
    /**
     * 총소요금액: 활성 품목 AMT 합계 스냅샷 (화면 [총 예산]).
     *
     * <p>조회는 품목 합산 파생값을 쓰므로 이 컬럼은 저장 시점 기록용이다. 드롭 전(V20260622_007) 같은 이름의 컬럼은 당해예산을 담았으나 지금은 총
     * 예산이다.
     */
    @Column(name = "TOT_RQM_AMT", precision = 18, scale = 3, comment = "총소요금액 (총 예산 스냅샷)")
    private BigDecimal totRqmAmt;

    /** 예정금액: 활성 품목 MPL_AMT 합계 스냅샷 (화면 [예산연도+1년 이후 예산]). */
    @Column(name = "MPL_AMT", precision = 18, scale = 3, comment = "예정금액 (익년 이후 예산 스냅샷)")
    private BigDecimal mplAmt;

    /** 지급금액: 사용자가 입력하는 기 지급예산. 이 컬럼이 유일한 출처다. */
    @Column(name = "DFR_AMT", precision = 18, scale = 3, comment = "지급금액 (기 지급예산)")
    private BigDecimal dfrAmt;
```

`java.math.BigDecimal` import가 없으면 추가한다.

- [ ] **Step 5: `BprojmL`에 대응 필드 3개 추가**

`endDtm` 필드 선언 바로 아래에 넣는다.

```java
    @Column(name = "TOT_RQM_AMT", precision = 18, scale = 3, comment = "총소요금액")
    private BigDecimal totRqmAmt;

    @Column(name = "MPL_AMT", precision = 18, scale = 3, comment = "예정금액")
    private BigDecimal mplAmt;

    @Column(name = "DFR_AMT", precision = 18, scale = 3, comment = "지급금액")
    private BigDecimal dfrAmt;
```

`java.math.BigDecimal` import를 추가한다.

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*BprojmAmountColumnMappingTest"
```

Expected: PASS (2 tests)

- [ ] **Step 7: 커밋 (저장소 2개)**

```bash
cd it_database && git add migrations/V20260815_003__AddBprojmAmountColumns.sql && git commit -m "feat: BPROJM/BPROJL 금액 컬럼 3종 추가"
```

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java src/main/java/com/kdb/it/domain/log/entity/BprojmL.java src/test/java/com/kdb/it/domain/budget/project/entity/BprojmAmountColumnMappingTest.java && git commit -m "feat: 정보화사업 엔티티에 총소요금액/예정금액/지급금액 매핑"
```

---

### Task 2: 합계 스냅샷 계산 거점

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java`

**Interfaces:**
- Consumes: Task 1의 `Bprojm` 필드
- Produces: `ProjectBudgetSummaryService.AmountSnapshot`(public record, 필드 `BigDecimal totRqmAmt`, `BigDecimal mplAmt`)와 `public AmountSnapshot calculateAmountSnapshot(List<Bitemm> bitemms)`

**설계 메모 — 왜 비목 분류를 쓰지 않는가:** 기존 `applyBudgetSummaryValues`는 자본/관리비 비목 집합으로 나눠 합산하므로 어느 집합에도 없는 비목의 품목이 빠진다. 스냅샷은 화면 [총 예산](= 모든 품목 소계 합)과 값이 같아야 하므로 비목 분류 없이 전체를 더한다. 계산이 흩어지지 않도록 위치만 같은 서비스에 둔다.

- [ ] **Step 1: 실패하는 테스트 작성**

`ProjectBudgetSummaryServiceTest`에 추가한다.

```java
    @Test
    @DisplayName("스냅샷 합계는 비목 분류와 무관하게 활성 품목 전체를 더한다")
    void calculateAmountSnapshot_sumsAllItems() {
        List<Bitemm> items =
                List.of(
                        Bitemm.builder()
                                .ioeC("A01")
                                .amt(new BigDecimal("1000"))
                                .mplAmt(new BigDecimal("300"))
                                .build(),
                        Bitemm.builder()
                                .ioeC("ZZ9") // 자본·관리비 어느 집합에도 없는 비목
                                .amt(new BigDecimal("500"))
                                .mplAmt(new BigDecimal("200"))
                                .build());

        ProjectBudgetSummaryService.AmountSnapshot snapshot =
                service.calculateAmountSnapshot(items);

        assertThat(snapshot.totRqmAmt()).isEqualByComparingTo("1500");
        assertThat(snapshot.mplAmt()).isEqualByComparingTo("500");
    }

    @Test
    @DisplayName("금액이 null이거나 품목이 없으면 0을 반환한다")
    void calculateAmountSnapshot_nullSafe() {
        ProjectBudgetSummaryService.AmountSnapshot empty =
                service.calculateAmountSnapshot(List.of());
        assertThat(empty.totRqmAmt()).isEqualByComparingTo("0");
        assertThat(empty.mplAmt()).isEqualByComparingTo("0");

        ProjectBudgetSummaryService.AmountSnapshot nulls =
                service.calculateAmountSnapshot(
                        List.of(Bitemm.builder().ioeC("A01").build()));
        assertThat(nulls.totRqmAmt()).isEqualByComparingTo("0");
        assertThat(nulls.mplAmt()).isEqualByComparingTo("0");
    }
```

기존 테스트가 서비스 인스턴스를 어떤 이름으로 두는지 확인해 `service` 변수명을 맞춘다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*ProjectBudgetSummaryServiceTest"
```

Expected: FAIL — `cannot find symbol: method calculateAmountSnapshot`

- [ ] **Step 3: 계산 메서드 추가**

`ProjectBudgetSummaryService`에 추가한다.

```java
    /**
     * 사업 단위 금액 스냅샷.
     *
     * @param totRqmAmt 총 예산 (활성 품목 AMT 합계)
     * @param mplAmt 예산연도+1 이후 예산 (활성 품목 MPL_AMT 합계)
     */
    public record AmountSnapshot(BigDecimal totRqmAmt, BigDecimal mplAmt) {}

    /**
     * 활성 품목으로 사업 단위 금액 스냅샷을 계산합니다.
     *
     * <p>화면 [총 예산]은 모든 품목 소계의 합이므로 비목 분류를 적용하지 않고 전체를 더합니다. 자본/관리비로 나누는 {@code
     * applyBudgetSummary}와 달리, 어느 비목 집합에도 없는 품목도 합계에 포함됩니다.
     *
     * @param bitemms 활성 품목 목록 (null 금액은 0으로 취급, 빈 목록 허용)
     * @return 총 예산과 익년 이후 예산 합계 (항상 non-null, 최소 0)
     * @throws NullPointerException 품목 목록이 null인 경우
     */
    public AmountSnapshot calculateAmountSnapshot(List<Bitemm> bitemms) {
        BigDecimal totRqmAmt = BigDecimal.ZERO;
        BigDecimal mplAmt = BigDecimal.ZERO;
        for (Bitemm item : bitemms) {
            totRqmAmt = totRqmAmt.add(nvl(item.getAmt()));
            mplAmt = mplAmt.add(nvl(item.getMplAmt()));
        }
        return new AmountSnapshot(totRqmAmt, mplAmt);
    }

    private static BigDecimal nvl(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*ProjectBudgetSummaryServiceTest"
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java && git commit -m "feat: 사업 단위 금액 스냅샷 계산 추가"
```

---

### Task 3: 저장 시 스냅샷 기록과 `dfrAmt` 검증

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java` (`assignSvnOrgNames` 아래에 mutator 추가)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java` (`CreateRequest`, `UpdateRequest`)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java` (`createProject` 품목 저장 직후, `updateProject` 품목 동기화 직후)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`

**Interfaces:**
- Consumes: Task 2의 `ProjectBudgetSummaryService.calculateAmountSnapshot(List<Bitemm>)` → `AmountSnapshot(totRqmAmt, mplAmt)`
- Produces: `Bprojm.assignAmountSnapshot(BigDecimal totRqmAmt, BigDecimal mplAmt, BigDecimal dfrAmt)`, `CreateRequest.getDfrAmt()`, `UpdateRequest.getDfrAmt()`

- [ ] **Step 1: 실패하는 테스트 작성**

`ProjectServiceTest`에 추가한다. 기존 테스트가 쓰는 mock 필드명(`projectRepository`, `bitemmRepository`, `budgetSummaryService` 등)과 픽스처 헬퍼를 그대로 재사용한다.

```java
    @Test
    @DisplayName("생성 시 품목 합계를 금액 스냅샷으로 기록한다")
    void createProject_recordsAmountSnapshot() {
        ProjectDto.CreateRequest request = validCreateRequest();
        request.setDfrAmt(new BigDecimal("400"));
        request.setItems(
                List.of(
                        itemDto("A01", new BigDecimal("1000"), new BigDecimal("300")),
                        itemDto("B01", new BigDecimal("500"), new BigDecimal("200"))));

        projectService.createProject(request);

        ArgumentCaptor<Bprojm> captor = ArgumentCaptor.forClass(Bprojm.class);
        verify(projectRepository, atLeastOnce()).save(captor.capture());
        Bprojm saved = captor.getValue();
        assertThat(saved.getTotRqmAmt()).isEqualByComparingTo("1500");
        assertThat(saved.getMplAmt()).isEqualByComparingTo("500");
        assertThat(saved.getDfrAmt()).isEqualByComparingTo("400");
    }

    @Test
    @DisplayName("기 지급예산이 음수면 400으로 거부한다")
    void createProject_rejectsNegativeDfrAmt() {
        ProjectDto.CreateRequest request = validCreateRequest();
        request.setDfrAmt(new BigDecimal("-1"));
        request.setItems(List.of(itemDto("A01", new BigDecimal("1000"), BigDecimal.ZERO)));

        assertThatThrownBy(() -> projectService.createProject(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("기 지급예산");
    }

    @Test
    @DisplayName("기 지급예산이 총 예산을 넘으면 400으로 거부한다")
    void createProject_rejectsDfrAmtOverTotal() {
        ProjectDto.CreateRequest request = validCreateRequest();
        request.setDfrAmt(new BigDecimal("1001"));
        request.setItems(List.of(itemDto("A01", new BigDecimal("1000"), BigDecimal.ZERO)));

        assertThatThrownBy(() -> projectService.createProject(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("기 지급예산");
    }

    @Test
    @DisplayName("기 지급예산이 총 예산과 같으면 통과한다")
    void createProject_allowsDfrAmtEqualToTotal() {
        ProjectDto.CreateRequest request = validCreateRequest();
        request.setDfrAmt(new BigDecimal("1000"));
        request.setItems(List.of(itemDto("A01", new BigDecimal("1000"), BigDecimal.ZERO)));

        assertThatCode(() -> projectService.createProject(request)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("기 지급예산 미전송(null)은 0으로 저장한다")
    void createProject_nullDfrAmtBecomesZero() {
        ProjectDto.CreateRequest request = validCreateRequest();
        request.setDfrAmt(null);
        request.setItems(List.of(itemDto("A01", new BigDecimal("1000"), BigDecimal.ZERO)));

        projectService.createProject(request);

        ArgumentCaptor<Bprojm> captor = ArgumentCaptor.forClass(Bprojm.class);
        verify(projectRepository, atLeastOnce()).save(captor.capture());
        assertThat(captor.getValue().getDfrAmt()).isEqualByComparingTo("0");
    }
```

`validCreateRequest()`와 `itemDto(...)` 헬퍼가 이 테스트 클래스에 없으면 아래를 같은 클래스 하단에 추가한다.

```java
    /** 필수 필드만 채운 생성 요청. 개별 테스트가 필요한 필드만 덮어쓴다. */
    private ProjectDto.CreateRequest validCreateRequest() {
        ProjectDto.CreateRequest request = new ProjectDto.CreateRequest();
        request.setAbusNm("테스트 사업");
        request.setBseYy("2026");
        request.setSvnDpmC("D001");
        request.setDvmDpmC("D002");
        request.setAbusTc("10");
        return request;
    }

    /** 합계 검증용 최소 품목 DTO. */
    private ProjectDto.BitemmDto itemDto(String ioeC, BigDecimal amt, BigDecimal mplAmt) {
        ProjectDto.BitemmDto item = new ProjectDto.BitemmDto();
        item.setIoeC(ioeC);
        item.setGclNm("품목-" + ioeC);
        item.setCurC("KRW");
        item.setAmt(amt);
        item.setMplAmt(mplAmt);
        return item;
    }
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*ProjectServiceTest"
```

Expected: FAIL — `cannot find symbol: method setDfrAmt`

- [ ] **Step 3: `Bprojm`에 mutator 추가**

`assignSvnOrgNames` 아래에 넣는다.

```java
    /**
     * 사업 단위 금액 스냅샷 설정.
     *
     * <p>총 예산·익년 이후 예산은 품목 저장이 끝난 뒤의 합계이고, 기 지급예산은 사용자 입력값이다. 세 값이 항상 같은 시점을 가리키도록 한 번에 설정한다.
     *
     * @param totRqmAmt 총 예산 (활성 품목 AMT 합계)
     * @param mplAmt 예산연도+1 이후 예산 (활성 품목 MPL_AMT 합계)
     * @param dfrAmt 기 지급예산 (검증을 통과한 값)
     */
    public void assignAmountSnapshot(BigDecimal totRqmAmt, BigDecimal mplAmt, BigDecimal dfrAmt) {
        this.totRqmAmt = totRqmAmt;
        this.mplAmt = mplAmt;
        this.dfrAmt = dfrAmt;
    }
```

- [ ] **Step 4: 요청 DTO에 `dfrAmt` 추가**

`CreateRequest`와 `UpdateRequest` 양쪽에 같은 필드를 추가한다.

```java
        /** 기 지급예산: 이미 지급한 예산 금액. 미전송이면 0으로 저장한다. */
        @Schema(description = "기 지급예산", nullable = true)
        private BigDecimal dfrAmt;
```

- [ ] **Step 5: `ProjectService`에 스냅샷 기록 추가**

먼저 private 헬퍼를 `isItemChanged` 위에 추가한다.

```java
    /**
     * 품목 저장이 끝난 뒤 사업 단위 금액 스냅샷을 기록합니다.
     *
     * <p>활성 품목을 다시 조회해 합산합니다. 영속성 컨텍스트가 조회 전에 flush 되므로 방금 저장·수정·논리삭제한 품목이 모두 반영됩니다. 반환값을 쓰지 않고
     * 엔티티에 바로 반영하며, Dirty Checking으로 UPDATE가 실행됩니다.
     *
     * @param project 대상 사업 엔티티 (영속 상태)
     * @param requestedDfrAmt 요청이 보낸 기 지급예산 (null이면 0)
     * @throws IllegalArgumentException 기 지급예산이 음수이거나 총 예산을 초과하는 경우
     */
    private void applyAmountSnapshot(Bprojm project, BigDecimal requestedDfrAmt) {
        List<Bitemm> activeItems =
                bitemmRepository.findByAbusMngNoAndFntTbCrySnoAndDelYn(
                        project.getAbusMngNo(), project.getSno(), "N");
        ProjectBudgetSummaryService.AmountSnapshot snapshot =
                budgetSummaryService.calculateAmountSnapshot(activeItems);
        BigDecimal dfrAmt = requestedDfrAmt == null ? BigDecimal.ZERO : requestedDfrAmt;
        if (dfrAmt.signum() < 0) {
            throw new IllegalArgumentException("기 지급예산은 0 이상이어야 합니다.");
        }
        if (dfrAmt.compareTo(snapshot.totRqmAmt()) > 0) {
            throw new IllegalArgumentException("기 지급예산은 총 예산을 초과할 수 없습니다.");
        }
        project.assignAmountSnapshot(snapshot.totRqmAmt(), snapshot.mplAmt(), dfrAmt);
    }
```

`createProject`의 품목 저장 블록 직후, `bprojaSyncService.upsert(...)` 호출 **앞**에 한 줄 넣는다.

```java
        applyAmountSnapshot(project, request.getDfrAmt());
```

`updateProject`의 품목 동기화 블록(`if (request.getItems() != null) { ... }`) 직후, `return project.getAbusMngNo();` **앞**에 한 줄 넣는다.

```java
        applyAmountSnapshot(project, request.getDfrAmt());
```

`ProjectService`에 `budgetSummaryService` 의존성이 없으면 생성자 주입 필드로 추가한다. `Bitemm`·`BigDecimal`·`List` import를 확인한다.

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*ProjectServiceTest" --tests "*ProjectServiceCoverageTest"
```

Expected: PASS. 기존 테스트가 `bitemmRepository.findByAbusMngNoAndFntTbCrySnoAndDelYn`를 stub 하지 않아 NPE가 나면, 해당 테스트의 mock에 `given(...).willReturn(List.of())`를 추가한다.

- [ ] **Step 7: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/project src/test/java/com/kdb/it/domain/budget/project && git commit -m "feat: 사업 저장 시 금액 스냅샷 기록과 기 지급예산 검증"
```

---

### Task 4: 응답 DTO 3필드와 OpenAPI 계약

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java` (`Response`)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java` (`applyBudgetSummaryValues`)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java`

**Interfaces:**
- Consumes: Task 2의 합산 규칙, Task 3의 `Bprojm.getDfrAmt()`
- Produces: `ProjectDto.Response`의 `prjBgAmt`(총 예산, 파생), `mplAmt`(익년 이후 예산, 파생), `dfrAmt`(기 지급예산, 컬럼)

- [ ] **Step 1: 실패하는 테스트 작성**

`ProjectBudgetSummaryServiceTest`에 추가한다.

```java
    @Test
    @DisplayName("응답에 총 예산(prjBgAmt)과 익년 이후 예산(mplAmt) 파생값을 설정한다")
    void applyBudgetSummary_setsDerivedTotals() {
        ProjectDto.Response response = new ProjectDto.Response();
        List<Bitemm> items =
                List.of(
                        Bitemm.builder()
                                .ioeC("A01")
                                .amt(new BigDecimal("1000"))
                                .mplAmt(new BigDecimal("300"))
                                .build());

        service.applyBudgetSummary(response, items);

        assertThat(response.getPrjBgAmt()).isEqualByComparingTo("1000");
        assertThat(response.getMplAmt()).isEqualByComparingTo("300");
        // 기존 의미 유지: 당해예산 = 총 AMT − 총 MPL_AMT
        assertThat(response.getTotRqmAmt()).isEqualByComparingTo("700");
    }
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*ProjectBudgetSummaryServiceTest"
```

Expected: FAIL — `cannot find symbol: method getPrjBgAmt`

- [ ] **Step 3: `Response`에 필드 3개 추가**

기존 `mplMngcAmt` 선언 아래에 넣는다.

```java
        /** 총 예산 (파생값: 활성 품목 AMT 합계). DB TOT_RQM_AMT와 같은 의미이며 totRqmAmt(당해예산)와 다르다. */
        @Schema(description = "총 예산 (파생값)", requiredMode = Schema.RequiredMode.REQUIRED)
        private BigDecimal prjBgAmt;

        /** 예산연도+1 이후 예산 (파생값: 활성 품목 MPL_AMT 합계) */
        @Schema(description = "익년 이후 예산 (파생값)", requiredMode = Schema.RequiredMode.REQUIRED)
        private BigDecimal mplAmt;

        /** 기 지급예산 (BPROJM.DFR_AMT 컬럼값) */
        @Schema(
                description = "기 지급예산",
                requiredMode = Schema.RequiredMode.REQUIRED,
                nullable = true)
        private BigDecimal dfrAmt;
```

`Response.fromEntity(...)`에 `dfrAmt` 매핑을 추가한다(엔티티에서 직접 읽는 유일한 필드).

```java
        response.setDfrAmt(entity.getDfrAmt());
```

- [ ] **Step 4: 파생값 주입**

`ProjectBudgetSummaryService.applyBudgetSummaryValues`의 마지막 세 줄 근처, 기존 `response.setTotRqmAmt(currentYear);` 아래에 추가한다.

```java
        // 총 예산·익년 이후 예산 파생값 (DB 스냅샷 컬럼과 같은 의미, 조회는 파생값을 쓴다)
        response.setPrjBgAmt(totalAmt);
        response.setMplAmt(totalMpl);
```

`totalAmt`·`totalMpl`은 같은 메서드에 이미 선언되어 있다. `totalAmt`는 `assetBg + costBg`(비목 분류 기준)이므로, 미분류 비목 품목이 있으면 Task 2 스냅샷과 값이 갈릴 수 있다. 이 차이는 알려진 한계로 두고, `applyBudgetSummaryValues` 위 주석에 한 줄로 남긴다.

```java
        // 주의: 이 파생 합계는 비목 분류에 걸린 품목만 더한다. 저장 스냅샷(calculateAmountSnapshot)은
        // 미분류 비목도 포함하므로, 미분류 비목이 있는 사업은 두 값이 다를 수 있다.
```

- [ ] **Step 5: OpenAPI 계약 테스트 갱신**

`ApiResponseOpenApiContractTest`에서 `ProjectDto.Response`를 검증하는 속성 목록에 `prjBgAmt`, `mplAmt`, `dfrAmt`를 추가한다. `ProjectDto.Response`를 다루는 단언이 없으면 다음 테스트를 추가한다.

```java
    @Test
    void projectResponseExposesAmountContracts() {
        assertAllPropertiesRequired(
                ProjectDto.Response.class, "prjBgAmt", "mplAmt", "dfrAmt", "totRqmAmt");
    }
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --no-daemon --tests "*ProjectBudgetSummaryServiceTest" --tests "*ApiResponseOpenApiContractTest"
```

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/project src/test/java/com/kdb/it && git commit -m "feat: 사업 응답에 총 예산/익년 이후 예산/기 지급예산 노출"
```

---

### Task 5: 프론트 타입 재생성과 폼 데이터 배선

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (생성물 — `npm run codegen`으로만 갱신)
- Modify: `it_frontend/app/composables/useProjects.ts` (`Project` 인터페이스)
- Modify: `it_frontend/app/features/project/projectFormModel.ts`
- Modify: `it_frontend/app/features/project/useProjectFormSave.ts`
- Modify: `it_frontend/app/features/project/useProjectFormLoad.ts`
- Modify: `it_frontend/app/features/project/useContinueProjectSearch.ts`
- Test: `it_frontend/tests/unit/features/project/projectFormAmounts.test.ts`

**Interfaces:**
- Consumes: Task 4의 응답 필드 `prjBgAmt`·`mplAmt`·`dfrAmt`, 요청 필드 `dfrAmt`
- Produces: 폼 draft의 `dfrAmt: number` (`createInitialForm()` 반환 타입에 포함), 저장 payload의 `dfrAmt`

- [ ] **Step 1: 실패하는 테스트 작성**

`it_frontend/tests/unit/features/project/projectFormAmounts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createInitialForm } from '~/features/project/projectFormModel';

describe('사업 폼 금액 필드', () => {
    it('기 지급예산 초기값은 0이다', () => {
        expect(createInitialForm().dfrAmt).toBe(0);
    });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_frontend && npx vitest run tests/unit/features/project/projectFormAmounts.test.ts
```

Expected: FAIL — `expected undefined to be 0`

- [ ] **Step 3: 폼 모델에 필드 추가**

`projectFormModel.ts`의 `createInitialForm()`에서 `prjBg: 0,` 아래에 추가한다.

```ts
    dfrAmt: 0, // 기 지급예산 (BPROJM.DFR_AMT, 사용자 입력)
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd it_frontend && npx vitest run tests/unit/features/project/projectFormAmounts.test.ts
```

Expected: PASS

- [ ] **Step 5: 백엔드 기동 후 타입 재생성**

백엔드를 기동한 상태에서 실행한다.

```bash
cd it_frontend && npm run codegen && npm run codegen:check
```

Expected: `app/types/api.d.ts`에 `prjBgAmt`·`mplAmt`·`dfrAmt`가 추가되고 `codegen:check` 통과. `api.d.ts`를 손으로 고치지 않는다.

- [ ] **Step 6: `Project` 인터페이스에 필드 추가**

`useProjects.ts`의 `totRqmAmt` 선언 근처에 추가한다.

```ts
    prjBgAmt?: number; // 총 예산 (파생값, ∑품목 AMT). totRqmAmt(당해예산)와 다름
    mplAmt?: number; // 익년 이후 예산 (파생값, ∑품목 MPL_AMT)
    dfrAmt?: number; // 기 지급예산 (BPROJM.DFR_AMT)
```

- [ ] **Step 7: 저장 payload 배선**

`useProjectFormSave.ts`의 payload에서 `totRqmAmt` 줄을 아래로 교체한다. 백엔드 `CreateRequest`·`UpdateRequest`에는 `totRqmAmt` 필드가 없어 지금 보내는 값은 서버가 버리므로 함께 제거한다.

```ts
            dfrAmt: f.dfrAmt || 0, // 기 지급예산 (0 ≤ dfrAmt ≤ 총 예산, 서버 검증)
```

- [ ] **Step 8: 불러오기 배선**

`useProjectFormLoad.ts`에서 `prjBg: Number(project.totRqmAmt) || 0,`를 교체하고 `dfrAmt`를 추가한다. `totRqmAmt`는 당해예산이므로 총 예산 칸에 넣으면 안 된다.

```ts
                        prjBg: Number(project.prjBgAmt) || 0,
                        dfrAmt: Number(project.dfrAmt) || 0,
```

`useContinueProjectSearch.ts`의 `prjBg: Number(detail.totRqmAmt) || 0,`도 같은 이유로 `detail.prjBgAmt`로 바꾼다. 계속사업은 전년도 지급 이력을 승계하지 않으므로 `dfrAmt`는 복사하지 않는다.

- [ ] **Step 9: 배선 테스트 추가**

`projectFormAmounts.test.ts`에 추가한다. payload 조립부는 Nuxt 컨텍스트를 요구하므로 소스 검증으로 고정한다(`tests/unit/pages/*PageBoundary.test.ts`와 같은 패턴).

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const saveSource = readFileSync(
    resolve(process.cwd(), 'app/features/project/useProjectFormSave.ts'),
    'utf8',
);
const loadSource = readFileSync(
    resolve(process.cwd(), 'app/features/project/useProjectFormLoad.ts'),
    'utf8',
);

describe('사업 폼 금액 배선', () => {
    it('저장 payload는 dfrAmt를 싣고 서버가 무시하는 totRqmAmt는 보내지 않는다', () => {
        expect(saveSource).toContain('dfrAmt: f.dfrAmt || 0');
        expect(saveSource).not.toContain('totRqmAmt:');
    });

    it('불러오기는 총 예산을 prjBgAmt에서 채운다', () => {
        expect(loadSource).toContain('prjBg: Number(project.prjBgAmt) || 0');
        expect(loadSource).toContain('dfrAmt: Number(project.dfrAmt) || 0');
        expect(loadSource).not.toContain('Number(project.totRqmAmt)');
    });
});
```

- [ ] **Step 10: 검증**

```bash
cd it_frontend && npx vitest run tests/unit/features/project/projectFormAmounts.test.ts && npm run check && npm run format:check
```

Expected: 모두 통과

- [ ] **Step 11: 커밋**

```bash
cd it_frontend && git add app/types/api.d.ts app/composables/useProjects.ts app/features/project tests/unit/features/project/projectFormAmounts.test.ts && git commit -m "feat: 사업 폼에 기 지급예산 데이터 배선"
```

---

### Task 6: 등록·수정 폼 예산 줄 4칸 재편

**Files:**
- Modify: `it_frontend/app/pages/info/projects/form.vue` (예산 구성 `<div class="flex gap-6">` 블록, 3·4번째 칸)
- Modify: `it_frontend/app/composables/useProjectFormPage.ts` (합계 computed 노출)
- Test: `it_frontend/tests/unit/pages/projectFormBudgetRow.test.ts`

**Interfaces:**
- Consumes: Task 5의 폼 draft `dfrAmt`
- Produces: `useProjectFormPage()`가 반환하는 `laterTotalAmt: ComputedRef<number>` (= `laterCapitalAmt + laterMngcAmt`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/pages/*PageBoundary.test.ts`의 소스 검증 패턴을 따른다. 폼 화면의 예산 줄 구성은 렌더링 없이 소스로 고정할 수 있고, 4칸 배치와 경상 제외가 조용히 되돌아가는 것을 막는다.

`it_frontend/tests/unit/pages/projectFormBudgetRow.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(process.cwd(), 'app/pages/info/projects/form.vue'),
    'utf8',
);
const composableSource = readFileSync(
    resolve(process.cwd(), 'app/composables/useProjectFormPage.ts'),
    'utf8',
);

describe('사업 폼 예산 줄', () => {
    it('예정자본/예정관리비 두 칸이 이후 예산 한 칸으로 합쳐진다', () => {
        expect(pageSource).toContain('년 이후 예산 (원)');
        expect(pageSource).not.toContain('예정자본금액');
        expect(pageSource).not.toContain('예정관리비금액');
        expect(pageSource).toContain(':model-value="laterTotalAmt"');
    });

    it('기 지급예산은 입력 가능하고 경상사업에서 숨는다', () => {
        expect(pageSource).toContain('기 지급예산 (원)');
        expect(pageSource).toContain('v-model="form.dfrAmt"');
        expect(pageSource).toMatch(/v-if="!isOrdinary"[\s\S]{0,400}기 지급예산 \(원\)/);
    });

    it('이후 예산 합계는 자본과 관리비의 합이다', () => {
        expect(composableSource).toContain(
            'const laterTotalAmt = computed(() => laterCapitalAmt.value + laterMngcAmt.value)',
        );
    });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_frontend && npx vitest run tests/unit/pages/projectFormBudgetRow.test.ts
```

Expected: FAIL — 3건 모두 실패 (`expected ... to contain '년 이후 예산 (원)'`)

- [ ] **Step 3: `useProjectFormPage`에 합계 computed 추가**

`laterMngcAmt` 선언 아래에 추가하고 반환 객체에도 포함한다.

```ts
    /** 예산연도+1년 이후 예산 = 예정자본 + 예정관리비. 화면은 한 칸으로 합쳐 보여준다. */
    const laterTotalAmt = computed(() => laterCapitalAmt.value + laterMngcAmt.value);
```

반환 객체(`laterCapitalAmt, laterMngcAmt, budgetYearAmount,` 줄)에 `laterTotalAmt,`를 추가한다. `laterCapitalAmt`·`laterMngcAmt`는 `budgetYearAmount` 계산이 계속 쓰므로 제거하지 않는다.

- [ ] **Step 4: `form.vue` 3번째 칸 교체**

`{{ form.bgYy + 1 }}년 이후 예정자본금액 (원)` 칸을 아래로 바꾼다.

```html
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                            >{{ form.bgYy + 1 }}년 이후 예산 (원)</label
                        >
                        <InputNumber
                            :model-value="laterTotalAmt"
                            mode="currency"
                            currency="KRW"
                            locale="ko-KR"
                            placeholder="품목 합산"
                            fluid
                            readonly
                            input-class="bg-zinc-100 dark:bg-zinc-800"
                        />
                    </div>
```

- [ ] **Step 5: `form.vue` 4번째 칸 교체**

`{{ form.bgYy + 1 }}년 이후 예정관리비금액 (원)` 칸을 아래로 바꾼다. 경상사업에서는 숨긴다.

```html
                    <div v-if="!isOrdinary" class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                            >기 지급예산 (원)</label
                        >
                        <InputNumber
                            v-model="form.dfrAmt"
                            mode="currency"
                            currency="KRW"
                            locale="ko-KR"
                            :min="0"
                            :max="form.prjBg || 0"
                            placeholder="0"
                            fluid
                        />
                    </div>
```

`<script setup>`의 구조분해에 `laterTotalAmt`를 추가하고, 더 이상 템플릿에서 쓰지 않는 `laterCapitalAmt`·`laterMngcAmt`가 있으면 구조분해에서 뺀다. `isOrdinary`가 이미 노출되어 있는지 확인한다.

- [ ] **Step 6: 검증**

```bash
cd it_frontend && npx vitest run tests/unit/pages/projectFormBudgetRow.test.ts && npm run check && npm run format:check
```

Expected: 모두 통과

- [ ] **Step 7: 화면 확인**

프론트·백엔드를 기동하고 `http://localhost:3000/info/projects/form`에서 예산 줄이 `총 예산 | 2026년 예산 | 2027년 이후 예산 | 기 지급예산` 4칸으로 보이는지, 네번째 칸에 금액을 입력할 수 있는지, `?ordinary=true`에서는 네번째 칸이 사라지는지 확인한다.

- [ ] **Step 8: 커밋**

```bash
cd it_frontend && git add app/pages/info/projects/form.vue app/composables/useProjectFormPage.ts tests/unit/pages/projectFormBudgetRow.test.ts && git commit -m "feat: 사업 폼 예산 줄에 기 지급예산 입력 추가"
```

---

### Task 7: 상세 화면 기 지급예산 표시

**Files:**
- Modify: `it_frontend/app/pages/info/projects/[id].vue` (`sub-budget-total` 카드의 우측 분할 블록)
- Test: `it_frontend/tests/unit/pages/projectDetailBudgetCard.test.ts`

**Interfaces:**
- Consumes: Task 4의 응답 필드 `dfrAmt`
- Produces: 없음 (표시 전용)

- [ ] **Step 1: 실패하는 테스트 작성**

`it_frontend/tests/unit/pages/projectDetailBudgetCard.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
    resolve(process.cwd(), 'app/pages/info/projects/[id].vue'),
    'utf8',
);

describe('사업 상세 총 예산 카드', () => {
    it('기 지급예산을 dfrAmt로 표시한다', () => {
        expect(pageSource).toContain('기 지급예산');
        expect(pageSource).toContain('formatCurrencyAmount(project.dfrAmt ?? 0)');
    });

    it('경상사업에서는 기 지급예산을 숨긴다', () => {
        expect(pageSource).toMatch(/v-if="!isOrdinary"[\s\S]{0,300}기 지급예산/);
    });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인**

```bash
cd it_frontend && npx vitest run tests/unit/pages/projectDetailBudgetCard.test.ts
```

Expected: FAIL — 2건 모두 실패 (`expected ... to contain '기 지급예산'`)

- [ ] **Step 3: 카드에 한 줄 추가**

`{{ Number(project.bseYy) + 1 }}년 이후` 블록 바로 아래에 같은 스타일로 넣는다.

```html
                                        <div v-if="!isOrdinary" class="leading-tight">
                                            <div class="text-xs text-zinc-500">기 지급예산</div>
                                            <div
                                                class="text-sm font-semibold text-zinc-800 dark:text-zinc-200"
                                            >
                                                {{ formatCurrencyAmount(project.dfrAmt ?? 0) }}
                                            </div>
                                        </div>
```

`isOrdinary`는 이 페이지에서 이미 구조분해되어 있다.

- [ ] **Step 4: 검증**

```bash
cd it_frontend && npx vitest run tests/unit/pages/projectDetailBudgetCard.test.ts && npm run check && npm run format:check
```

Expected: 모두 통과

- [ ] **Step 5: 화면 확인**

`http://localhost:3000/info/projects/{사업관리번호}`에서 총 예산 카드 우측에 `기 지급예산` 줄이 보이는지, 경상사업에서는 숨는지 확인한다.

- [ ] **Step 6: 커밋**

```bash
cd it_frontend && git add app/pages/info/projects/[id].vue tests/unit/pages/projectDetailBudgetCard.test.ts && git commit -m "feat: 사업 상세 총 예산 카드에 기 지급예산 표시"
```

---

### Task 8: 전체 검증과 버전 고정

**Files:**
- Modify: `C:\it\versions.lock` (`scripts/update-versions-lock.ps1`로 갱신)

**Interfaces:**
- Consumes: Task 1~7의 모든 커밋
- Produces: 없음

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd it_backend && ./gradlew test --no-daemon
```

Expected: 실패 0, 오류 0

- [ ] **Step 2: 백엔드 Oracle 통합 테스트**

로컬 Oracle이 기동된 상태에서 실행해 새 컬럼이 실제 매핑되는지 확인한다.

```bash
cd it_backend && ./gradlew integrationTest --no-daemon
```

Expected: PASS. 실패하면 Flyway가 `V20260815_003`을 적용했는지 확인한다(`local-ext`/`local-int` 프로파일에서만 자동 적용).

- [ ] **Step 3: 프론트 전체 검증**

```bash
cd it_frontend && npm run check && npm test && npm run format:check
```

Expected: 모두 통과

- [ ] **Step 4: 저장소 버전 조합 고정**

```bash
pwsh scripts/update-versions-lock.ps1
```

- [ ] **Step 5: 커밋**

```bash
git add versions.lock && git commit -m "chore: 금액 컬럼 추가 반영 버전 고정"
```

---

## Self-Review

**Spec coverage**

| 스펙 절 | 담당 태스크 |
| --- | --- |
| §3 데이터 모델 (Flyway, 3컬럼, 멱등, DEFAULT 0) | Task 1 |
| §4 엔티티·변경이력 (Bprojm, BprojmL, 자동 적재) | Task 1 |
| §5 저장 규칙 (품목 저장 후 스냅샷, 산식 재사용) | Task 2, 3 |
| §5.1 `dfrAmt` 검증 (0 이상, 총 예산 이하, null→0) | Task 3 |
| §6 API 계약 (`prjBgAmt`·`mplAmt`·`dfrAmt`, 계약 테스트, codegen) | Task 4, 5 |
| §7.1 폼 4칸 재편 + 경상 제외 | Task 6 |
| §7.2 상세 카드 한 줄 추가 | Task 7 |
| §8 테스트 | Task 1~7 각 태스크 + Task 8 |
| §9 범위 밖 (예산현황·목록, 백필, `totRqmAmt` 개명) | 태스크 없음 (의도적) |

**Placeholder scan** — "적절히 처리", "TBD", "위와 유사하게" 없음. 모든 코드 스텝에 실제 코드 블록이 있다.

**Type consistency**

- `AmountSnapshot(BigDecimal totRqmAmt, BigDecimal mplAmt)` — Task 2에서 정의, Task 3에서 `snapshot.totRqmAmt()`·`snapshot.mplAmt()`로 사용. 일치.
- `Bprojm.assignAmountSnapshot(BigDecimal, BigDecimal, BigDecimal)` — Task 3 Step 3에서 정의, Step 5에서 호출. 일치.
- `laterTotalAmt` — Task 6 Step 3에서 정의, Step 4에서 사용. 일치.
- 응답 필드 `prjBgAmt`·`mplAmt`·`dfrAmt` — Task 4에서 정의, Task 5·7에서 사용. 일치.
- 폼 draft `dfrAmt` — Task 5에서 정의, Task 6에서 `v-model="form.dfrAmt"`로 사용. 일치.

**알려진 한계 (구현자가 알아야 할 것)**

Task 4의 응답 파생값 `prjBgAmt`(비목 분류 기준 `assetBg + costBg`)와 Task 2의 저장 스냅샷 `TOT_RQM_AMT`(전체 합계)는 **미분류 비목 품목이 있으면 값이 다르다**. 조회는 파생값을 쓰므로 화면에는 영향이 없고, 스냅샷은 화면 [총 예산]과 맞추는 쪽을 택했다. 두 값을 일치시키려면 비목 분류 자체를 손봐야 하며 이번 범위 밖이다.
