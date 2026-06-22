# 품목 예정금액(MPL_AMT) 기반 예산 계산 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 품목(`Bitemm`)에 예정금액 `MPL_AMT`를 추가하고, 프로젝트(`Bprojm`)의 `TOT_RQM_AMT`/`MPL_CPIT_AMT`/`MPL_MNGC_AMT`를 삭제하여 해당 금액들을 매번 품목 `MPL_AMT` 합산으로 파생 계산하도록 전환한다.

**Architecture:** 단일 파생 계산 거점은 백엔드 `ProjectBudgetSummaryService`. 품목 비목(IOE_C)으로 자본/관리비를 분류하여 `mplCpitAmt`=∑MPL_AMT(자본), `mplMngcAmt`=∑MPL_AMT(관리비), `totRqmAmt`(당해예산)=max(0, ∑AMT−∑MPL_AMT)을 계산해 `Response`에 주입한다. DB 컬럼은 삭제하되 API 응답 필드 3종은 파생값으로 유지해 프론트 영향을 최소화한다. 프론트는 [소요자원 상세내용] 테이블에 품목별 "익년 이후 예산" 입력 컬럼을 추가하고 예산 구성 표시를 품목 합산 파생값으로 전환한다.

**Tech Stack:** Spring Boot 4.1 / Java 25 / JPA + QueryDSL / Oracle(Flyway), Nuxt 4 / Vue 3 / PrimeVue / TypeScript, JUnit5+Mockito, Vitest+Playwright.

**참조 스펙:** `docs/superpowers/specs/2026-06-22-item-planned-amount-design.md`

---

## 설계 핵심 규칙 (모든 태스크 공통)

- **MPL_AMT 의미**: `AMT`(품목 총액)의 일부(익년 이후분). `0 ≤ MPL_AMT ≤ AMT`.
- **파생식** (활성 품목 `DEL_YN='N'` 기준):
  - `mplCpitAmt` = ∑ `MPL_AMT` (item.ioeC ∈ 자본 비목)
  - `mplMngcAmt` = ∑ `MPL_AMT` (item.ioeC ∈ 관리비 비목)
  - `totRqmAmt`(당해예산) = max(0, ∑ `AMT` − ∑ `MPL_AMT`)
- **환율 처리**: 각 계산 지점에서 `MPL_AMT`는 `AMT`와 **동일한 환산 함수**를 사용한다(대칭). `ProjectBudgetSummaryService`는 `amt × xcr` 방식이므로 `mplAmt × xcr`도 동일 적용.
- 비목 분류 집합: 자본 cTp ∈ {`IOE_DVC`,`IOE_HW`,`IOE_SW`}(+구데이터 `IOE_CPIT`), 관리비 cTp ∈ {`IOE_IDR`,`IOE_SEVS`,`IOE_XPN`,`IOE_LEAFE`}.

---

## Phase A — 데이터 모델 & 마이그레이션

### Task 1: `Bitemm` / `BitemmL` 엔티티에 `mplAmt` 추가

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bitemm.java:128-129`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BitemmL.java:74-79`

- [ ] **Step 1: `Bitemm`에 `mplAmt` 필드 추가**

`Bitemm.java`의 `amt` 필드(라인 117-118) 바로 뒤, `fcAmt` 필드(라인 128-129) 앞에 추가:

```java
    /** 예정금액: 이 품목 금액 중 익년(예산연도+1) 이후로 예정된 금액 (AMT의 일부, 0 ≤ MPL_AMT ≤ AMT) */
    @Column(name = "MPL_AMT", precision = 18, scale = 3, comment = "예정금액")
    private BigDecimal mplAmt;
```

- [ ] **Step 2: `BitemmL`에 미러 필드 추가**

`BitemmL.java`의 `amt` 필드(라인 74-75) 바로 뒤, `fcAmt` 앞에 추가:

```java
    @Column(name = "MPL_AMT", precision = 18, scale = 3, comment = "예정금액")
    private BigDecimal mplAmt;
```

- [ ] **Step 3: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL (QueryDSL `QBitemm`/`QBitemmL`에 `mplAmt` 생성됨)

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bitemm.java it_backend/src/main/java/com/kdb/it/domain/log/entity/BitemmL.java
git commit -m "feat: add MPL_AMT(예정금액) to Bitemm/BitemmL entities"
```

---

### Task 2: `Bprojm` / `BprojmL`에서 3개 금액 필드 제거

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BprojmL.java:44-51`

- [ ] **Step 1: `Bprojm` 필드 3개 제거**

`Bprojm.java` 라인 78-88의 세 필드 블록 전체 삭제:

```java
    /** 프로젝트예산: 사업 총 예산 금액 (최대 18자리, 소수점 2자리) */
    @Column(name = "TOT_RQM_AMT", precision = 18, scale = 3, comment = "프로젝트예산 (물리컬럼 TOT_RQM_AMT=총소요금액)")
    private BigDecimal totRqmAmt;

    /** 예정자본금액: 익년(다음 해) 이후 자본예산 요청액 (최대 18자리, 소수점 3자리) */
    @Column(name = "MPL_CPIT_AMT", precision = 18, scale = 3, comment = "예정자본금액 (물리컬럼 MPL_CPIT_AMT=예정자본금액)")
    private BigDecimal mplCpitAmt;

    /** 예정관리비금액: 익년(다음 해) 이후 일반관리비예산 요청액 (최대 18자리, 소수점 3자리) */
    @Column(name = "MPL_MNGC_AMT", precision = 18, scale = 3, comment = "예정관리비금액 (물리컬럼 MPL_MNGC_AMT=예정관리비금액)")
    private BigDecimal mplMngcAmt;
```

- [ ] **Step 2: `UpdateCommand` record에서 3개 파라미터 제거**

`Bprojm.java` 라인 212-223의 record 선언에서 `BigDecimal totRqmAmt, BigDecimal mplCpitAmt, BigDecimal mplMngcAmt,` 줄(라인 215)을 삭제하여 다음 형태로 변경:

```java
    public record UpdateCommand(
            String abusNm, String bzTpC, String svnDpmC, String dvmDpmC,
            LocalDate sttDtm, LocalDate endDtm,
            String usid, String dvmUsid, String tlrUsid, String dvmTlrUsid,
            String edrtTc, String abusCone, String cpnSafCone, String abusNcsCone,
            String dgogPpoCone, String plmDes, String abusRngCone, String mnPrgCone, String hrfPlnCone,
            String bzDttNm, String sklTpTc, String cstTpTc, String dplYn,
            String flfFsgDt, String rprStsTc, String exePttYn, String stsTc,
            String bseYy, String prlmHrkOgzCCone,
            String odnYn, String abusTc, String cncdRfrNo
    ) {}
```

- [ ] **Step 3: `update(UpdateCommand cmd)` 위임 호출 수정**

라인 230-239의 메서드 본문에서 `cmd.totRqmAmt(), cmd.mplCpitAmt(), cmd.mplMngcAmt(),`를 제거:

```java
    public void update(UpdateCommand cmd) {
        update(cmd.abusNm(), cmd.bzTpC(), cmd.svnDpmC(), cmd.dvmDpmC(),
                cmd.sttDtm(), cmd.endDtm(),
                cmd.usid(), cmd.dvmUsid(), cmd.tlrUsid(), cmd.dvmTlrUsid(),
                cmd.edrtTc(), cmd.abusCone(), cmd.cpnSafCone(), cmd.abusNcsCone(),
                cmd.dgogPpoCone(), cmd.plmDes(), cmd.abusRngCone(), cmd.mnPrgCone(), cmd.hrfPlnCone(),
                cmd.bzDttNm(), cmd.sklTpTc(), cmd.cstTpTc(), cmd.dplYn(),
                cmd.flfFsgDt(), cmd.rprStsTc(), cmd.exePttYn(), cmd.stsTc(),
                cmd.bseYy(), cmd.prlmHrkOgzCCone(), cmd.odnYn(), cmd.abusTc(), cmd.cncdRfrNo());
    }
```

- [ ] **Step 4: `update(...)` (sno 포함) 오버로드 수정**

라인 246-289의 메서드에서 파라미터 `BigDecimal totRqmAmt, BigDecimal mplCpitAmt, BigDecimal mplMngcAmt,`와 본문 대입 `this.totRqmAmt = totRqmAmt;` `this.mplCpitAmt = mplCpitAmt;` `this.mplMngcAmt = mplMngcAmt;` 3줄(라인 258-260)을 제거. 시그니처 변경 후:

```java
    public void update(String abusNm, String bzTpC, String svnDpmC, String dvmDpmC, LocalDate sttDtm, LocalDate endDtm, String usid, String dvmUsid,
            String tlrUsid, String dvmTlrUsid, String edrtTc, String abusCone,
            String cpnSafCone, String abusNcsCone, String dgogPpoCone, String plmDes, String abusRngCone, String mnPrgCone,
            String hrfPlnCone, String bzDttNm, String sklTpTc, String cstTpTc, String dplYn,
            String flfFsgDt, String rprStsTc, String exePttYn, String stsTc, String bseYy, String prlmHrkOgzCCone,
            Integer sno, String odnYn, String abusTc, String cncdRfrNo) {
        this.sno = sno;
        this.abusNm = abusNm;
        // ... (totRqmAmt/mplCpitAmt/mplMngcAmt 대입 3줄 삭제, 나머지 대입은 그대로 유지)
```

- [ ] **Step 5: `update(...)` (sno 제외) 오버로드 수정**

라인 296-338의 메서드에서 동일하게 파라미터 3개와 본문 대입 3줄(라인 307-309) 제거.

- [ ] **Step 6: `BprojmL` 필드 3개 제거**

`BprojmL.java` 라인 44-51의 세 `@Column` 블록(`totRqmAmt`, `mplCpitAmt`, `mplMngcAmt`)을 삭제.

- [ ] **Step 7: 컴파일 확인 (호출부 미수정으로 실패 예상)**

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: FAIL — `ProjectDto.java`, `ProjectService.java` 등에서 `totRqmAmt(...)`/`.getTotRqmAmt()` 미해결. (Task 5/6에서 해소). 이 실패는 정상 진행 신호.

- [ ] **Step 8: 커밋 (WIP — 컴파일 미통과, 다음 태스크에서 해소)**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java it_backend/src/main/java/com/kdb/it/domain/log/entity/BprojmL.java
git commit -m "refactor: remove TOT_RQM_AMT/MPL_CPIT_AMT/MPL_MNGC_AMT from Bprojm/BprojmL (WIP)"
```

---

### Task 3: Flyway 마이그레이션 작성

**Files:**
- Create: `it_database/migrations/V20260622_006__AddMplAmtToBitemm.sql`
- Create: `it_database/migrations/V20260622_007__DropBprojmPlannedAmtColumns.sql`

> 네이밍은 기존 `V20260622_001..005`에 이어 `_006`, `_007`을 사용한다. 스키마 객체 소유자는 `ITPOWN`이며 존재 판정은 `ALL_TAB_COLS`(CURRENT_SCHEMA)로 한다(기존 마이그레이션 패턴).

- [ ] **Step 1: MPL_AMT 추가 마이그레이션 작성**

`V20260622_006__AddMplAmtToBitemm.sql`:

```sql
-- V20260622_006__AddMplAmtToBitemm.sql
-- 정보화사업 품목(TPRMPP_BITEMM) 및 로그(TPRMPP_BITEML)에 예정금액 컬럼 추가.
--   MPL_AMT NUMBER(18,3) DEFAULT 0 NOT NULL — 품목금액(AMT) 중 익년 이후 예정분.
-- 기존 행은 DEFAULT 0 으로 백필되므로 별도 DML 불필요. (it_backend/CLAUDE.md §5.2.1)
-- 멱등성: 컬럼 존재 시 ADD 를 건너뛴다.
DECLARE
    FUNCTION col_exists(p_table VARCHAR2, p_col VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n FROM ALL_TAB_COLS
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND TABLE_NAME = p_table AND COLUMN_NAME = p_col;
        RETURN n > 0;
    END;
BEGIN
    IF NOT col_exists('TPRMPP_BITEMM', 'MPL_AMT') THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_BITEMM ADD (MPL_AMT NUMBER(18,3) DEFAULT 0 NOT NULL)';
    END IF;
    IF NOT col_exists('TPRMPP_BITEML', 'MPL_AMT') THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_BITEML ADD (MPL_AMT NUMBER(18,3) DEFAULT 0 NOT NULL)';
    END IF;
END;
/
```

- [ ] **Step 2: 3개 컬럼 DROP 마이그레이션 작성**

`V20260622_007__DropBprojmPlannedAmtColumns.sql`:

```sql
-- V20260622_007__DropBprojmPlannedAmtColumns.sql
-- 정보화사업(TPRMPP_BPROJM) 및 로그(TPRMPP_BPROJL)에서 합계성 금액 3종 삭제.
--   TOT_RQM_AMT / MPL_CPIT_AMT / MPL_MNGC_AMT
-- 사유: 프로젝트 단위 저장값을 품목(BITEMM.MPL_AMT) 합산 파생값으로 대체.
-- 멱등성: 컬럼 존재 시에만 DROP.
DECLARE
    FUNCTION col_exists(p_table VARCHAR2, p_col VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n FROM ALL_TAB_COLS
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND TABLE_NAME = p_table AND COLUMN_NAME = p_col;
        RETURN n > 0;
    END;
    PROCEDURE drop_col(p_table VARCHAR2, p_col VARCHAR2) IS
    BEGIN
        IF col_exists(p_table, p_col) THEN
            EXECUTE IMMEDIATE 'ALTER TABLE ' || p_table || ' DROP COLUMN ' || p_col;
        END IF;
    END;
BEGIN
    drop_col('TPRMPP_BPROJM', 'TOT_RQM_AMT');
    drop_col('TPRMPP_BPROJM', 'MPL_CPIT_AMT');
    drop_col('TPRMPP_BPROJM', 'MPL_MNGC_AMT');
    drop_col('TPRMPP_BPROJL', 'TOT_RQM_AMT');
    drop_col('TPRMPP_BPROJL', 'MPL_CPIT_AMT');
    drop_col('TPRMPP_BPROJL', 'MPL_MNGC_AMT');
END;
/
```

- [ ] **Step 3: 커밋**

```bash
git add it_database/migrations/V20260622_006__AddMplAmtToBitemm.sql it_database/migrations/V20260622_007__DropBprojmPlannedAmtColumns.sql
git commit -m "feat: flyway migrations for MPL_AMT add and Bprojm column drop"
```

---

## Phase B — 백엔드 로직 (TDD)

### Task 4: `ProjectBudgetSummaryService` 파생 계산 확장

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java`

> `applyBudgetSummary(response, bitemms)`가 기존 자본/관리비 분류를 이미 수행하므로, 동일 분류로 `MPL_AMT` 파생 3종을 계산해 `response`에 설정하도록 확장한다. `Response`에는 setter(`@Setter`)가 이미 존재(`totRqmAmt`/`mplCpitAmt`/`mplMngcAmt`).

- [ ] **Step 1: 실패 테스트 작성**

`ProjectBudgetSummaryServiceTest.java` 생성:

```java
package com.kdb.it.domain.budget.project.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.kdb.it.common.code.CommonCodeGroups;
import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.service.CodeService;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.budget.project.entity.Bitemm;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectBudgetSummaryServiceTest {

    @Mock CodeService codeService;
    @InjectMocks ProjectBudgetSummaryService service;

    /** cdva→cTp 매핑용 Ccodem 목 생성 (KRW 환율 1 가정) */
    private Ccodem code(String cdva, String cTp) {
        return Ccodem.builder().cdva(cdva).cTp(cTp).build();
    }

    private Bitemm item(String ioeC, long amt, long mplAmt) {
        return Bitemm.builder()
                .gclMngNo("GCL-2026-0001").sno(1).abusMngNo("PRJ-2026-0001").fntTbCrySno(1)
                .ioeC(ioeC).gclNm("품목").curC("KRW")
                .amt(BigDecimal.valueOf(amt)).mplAmt(BigDecimal.valueOf(mplAmt))
                .lstYn("Y").build();
    }

    @Test
    @DisplayName("품목 MPL_AMT를 비목별로 합산하고 당해예산을 파생한다")
    void appliesDerivedPlannedAmounts() {
        // 자본 비목 'C1'(IOE_DVC), 관리비 비목 'M1'(IOE_SEVS)
        when(codeService.findCodeEntitiesByCId(CommonCodeGroups.IOE))
                .thenReturn(List.of(code("C1", "IOE_DVC"), code("M1", "IOE_SEVS")));
        ProjectDto.Response res = ProjectDto.Response.builder().build();
        List<Bitemm> items = List.of(
                item("C1", 1000, 300), // 자본: amt 1000, 예정 300
                item("M1", 500, 200)); // 관리비: amt 500, 예정 200

        service.applyBudgetSummary(res, items);

        assertThat(res.getMplCpitAmt()).isEqualByComparingTo("300");
        assertThat(res.getMplMngcAmt()).isEqualByComparingTo("200");
        // 당해예산 = (1000+500) - (300+200) = 1000
        assertThat(res.getTotRqmAmt()).isEqualByComparingTo("1000");
    }

    @Test
    @DisplayName("당해예산이 음수면 0으로 보정한다")
    void clampsNegativeCurrentYearToZero() {
        when(codeService.findCodeEntitiesByCId(CommonCodeGroups.IOE))
                .thenReturn(List.of(code("C1", "IOE_DVC")));
        ProjectDto.Response res = ProjectDto.Response.builder().build();

        service.applyBudgetSummary(res, List.of(item("C1", 100, 250)));

        assertThat(res.getTotRqmAmt()).isEqualByComparingTo("0");
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*ProjectBudgetSummaryServiceTest" -q`
Expected: FAIL/컴파일 에러 — 파생 계산 미구현(`getMplCpitAmt()` 등 null).

- [ ] **Step 3: 파생 계산 구현**

`ProjectBudgetSummaryService.java`의 `applyBudgetSummary(...)` 끝부분, `response.setBudgetAmounts(...)` (라인 99) 다음에 추가. `assetTypes`/`costTypes`/`sumByIoe`는 이미 메서드 내에 존재하므로 재사용한다:

```java
        // === 예정금액(MPL_AMT) 파생 합산 (Bprojm 3개 컬럼 대체) ===
        // MPL_AMT 는 AMT 와 동일 환산 규칙(× xcr)을 적용해 대칭 계산한다.
        java.util.function.Function<Bitemm, BigDecimal> calcMpl = i -> {
            if (i.getMplAmt() == null) return BigDecimal.ZERO;
            BigDecimal xcr = (i.getXcr() != null && i.getXcr().compareTo(BigDecimal.ZERO) != 0)
                    ? i.getXcr() : BigDecimal.ONE;
            return i.getMplAmt().multiply(xcr);
        };
        List<Bitemm> mplItems = bitemms.stream()
                .filter(i -> i.getIoeC() != null)
                .toList();
        BigDecimal mplCpit = sumByIoe(mplItems, assetTypes, calcMpl);
        BigDecimal mplMngc = sumByIoe(mplItems, costTypes, calcMpl);
        BigDecimal totalAmt = assetBg.add(costBg); // assetBg/costBg = 자본+관리비 비목 합 (동일 분류 기준)
        BigDecimal totalMpl = mplCpit.add(mplMngc);
        BigDecimal currentYear = totalAmt.subtract(totalMpl);
        if (currentYear.signum() < 0) currentYear = BigDecimal.ZERO;

        response.setMplCpitAmt(mplCpit);
        response.setMplMngcAmt(mplMngc);
        response.setTotRqmAmt(currentYear);
```

> 주의: `totalAmt`는 자본+관리비 비목 합이다(기존 summary와 동일 범위). 비목 미분류 품목까지 포함한 정확한 ∑AMT가 필요하면 `validItems`에 `calcAmt`를 적용한 별도 합계를 사용한다. 본 구현은 분류 합 기준으로 통일한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*ProjectBudgetSummaryServiceTest" -q`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java
git commit -m "feat: derive planned amounts from item MPL_AMT in ProjectBudgetSummaryService"
```

---

### Task 5: `ProjectDto` 변경 (BitemmDto mplAmt, 요청 3필드 제거, 응답 파생 유지)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java`

- [ ] **Step 1: `BitemmDto`에 `mplAmt` 필드 추가**

`amt` 필드(라인 925-927) 바로 뒤에 추가:

```java
        /** 예정금액 (품목금액 중 익년 이후 예정분, 0 ≤ mplAmt ≤ amt, 기본 0) */
        @Schema(description = "예정금액 (익년 이후 예정분)")
        private BigDecimal mplAmt;
```

- [ ] **Step 2: `BitemmDto.fromEntity`에 매핑 추가**

라인 951 `.amt(bitemm.getAmt())` 다음에:

```java
                    .mplAmt(bitemm.getMplAmt()) // 예정금액
```

- [ ] **Step 3: `CreateRequest`에서 3개 필드 제거**

라인 87-97의 `totRqmAmt`/`mplCpitAmt`/`mplMngcAmt` 3개 `@Schema`+필드 블록 삭제.

- [ ] **Step 4: `CreateRequest.toEntity()`에서 빌더 호출 제거**

라인 238-240의 `.totRqmAmt(totRqmAmt)` `.mplCpitAmt(mplCpitAmt)` `.mplMngcAmt(mplMngcAmt)` 3줄 삭제.

- [ ] **Step 5: `UpdateRequest`에서 3개 필드 제거**

라인 310-320의 동일 3개 필드 블록 삭제. (`UpdateRequest`에는 `toEntity()`가 없으므로 추가 작업 없음 — 매핑은 `ProjectService`에서 수행)

- [ ] **Step 6: `Response`에서 필드는 유지하되 주석 갱신**

라인 493-503의 3개 필드는 **삭제하지 않는다**(파생값 보관). 주석만 다음으로 변경:

```java
        /** 당해예산 (파생: ∑AMT − ∑MPL_AMT, ProjectBudgetSummaryService에서 설정) */
        @Schema(description = "당해예산 (파생값)")
        private BigDecimal totRqmAmt;

        /** 예정자본금액 (파생: 자본 비목 품목의 ∑MPL_AMT) */
        @Schema(description = "예정자본금액 (파생값)")
        private BigDecimal mplCpitAmt;

        /** 예정관리비금액 (파생: 관리비 비목 품목의 ∑MPL_AMT) */
        @Schema(description = "예정관리비금액 (파생값)")
        private BigDecimal mplMngcAmt;
```

- [ ] **Step 7: `Response.fromEntity`에서 엔티티 매핑 3줄 제거**

라인 784-786의 `.totRqmAmt(project.getTotRqmAmt())` `.mplCpitAmt(...)` `.mplMngcAmt(...)` 3줄 삭제. (값은 서비스가 summary로 주입)

- [ ] **Step 8: 컴파일 확인 (ProjectService 미수정으로 실패 예상)**

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: FAIL — `ProjectService`의 `recalcCurrentYearBudget`/`getTotRqmAmt`/`UpdateCommand` 인자 등 미해결. (Task 6에서 해소)

- [ ] **Step 9: 커밋 (WIP)**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java
git commit -m "refactor: ProjectDto - add BitemmDto.mplAmt, drop 3 request fields, keep response derived (WIP)"
```

---

### Task 6: `ProjectService` 쓰기 경로 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`

- [ ] **Step 1: `createProject`에서 recalc 호출 제거**

라인 274-277의 블록 삭제:

```java
        // 당해예산(TOT_RQM_AMT) 항상 재계산: 품목 합계 − 예정금액(MPL_CPIT + MPL_MNGC)
        // 예정금액(익년 이후분)은 사용자가 직접 입력하며, 당해예산만 품목 기준으로 산출한다.
        request.setTotRqmAmt(recalcCurrentYearBudget(
                request.getItems(), request.getMplCpitAmt(), request.getMplMngcAmt()));
```

- [ ] **Step 2: `createProject` 품목 빌더에 `mplAmt` 추가**

라인 315 `.amt(reconciled[0])` 다음에 추가:

```java
                        .mplAmt(clampMpl(itemDto.getMplAmt(), reconciled[0])) // 예정금액 (0 ≤ mplAmt ≤ amt)
```

- [ ] **Step 3: `updateProject` recalc 제거 + `Bprojm.update` 인자 정리**

라인 383-387(recalcTotRqmAmt 산출) 블록 삭제하고, 라인 390-399의 `project.update(new Bprojm.UpdateCommand(...))` 호출에서 `recalcTotRqmAmt, request.getMplCpitAmt(), request.getMplMngcAmt(),` 인자를 제거:

```java
        // 프로젝트 기본 정보 수정 (JPA Dirty Checking으로 자동 반영)
        project.update(new Bprojm.UpdateCommand(
                request.getAbusNm(), request.getBzTpC(), request.getSvnDpmC(), request.getDvmDpmC(),
                request.getSttDtm(), request.getEndDtm(),
                request.getUsid(), request.getDvmUsid(), request.getTlrUsid(), request.getDvmTlrUsid(),
                request.getEdrtTc(), request.getAbusCone(), request.getCpnSafCone(), request.getAbusNcsCone(),
                request.getDgogPpoCone(), request.getPlmDes(), request.getAbusRngCone(), request.getMnPrgCone(), request.getHrfPlnCone(),
                request.getBzDttNm(), request.getSklTpTc(), request.getCstTpTc(), request.getDplYn(),
                DateFormatUtil.toYmd8(request.getFlfFsgDt()), request.getRprStsTc(), request.getExePttYn(), request.getStsTc(),
                request.getBseYy(), request.getPrlmHrkOgzCCone(),
                request.getOdnYn(), request.getAbusTc(), request.getCncdRfrNo()));
```

- [ ] **Step 4: `updateProject` 기존 품목 수정 빌더에 `mplAmt` 추가**

라인 453 `.amt(reconciled[0])` 다음에 추가:

```java
                                    .mplAmt(clampMpl(itemDto.getMplAmt(), reconciled[0])) // 예정금액
```

- [ ] **Step 5: `updateProject` 신규 품목 빌더에 `mplAmt` 추가**

라인 491 `.amt(reconciled[0])` 다음에 추가:

```java
                            .mplAmt(clampMpl(itemDto.getMplAmt(), reconciled[0])) // 예정금액
```

- [ ] **Step 6: `isItemChanged`에 `mplAmt` 비교 추가**

라인 533 `|| bigDecimalChanged(existing.getAmt(), dto.getAmt())` 다음 줄에 추가:

```java
                || bigDecimalChanged(existing.getMplAmt(), dto.getMplAmt())
```

- [ ] **Step 7: `recalcCurrentYearBudget` 제거 + `clampMpl` 헬퍼 추가**

라인 563-593의 `recalcCurrentYearBudget(...)` private 메서드 전체를 삭제하고, 그 자리에 클램프 헬퍼를 추가:

```java
    /**
     * 예정금액을 유효 범위 [0, amt]로 보정한다.
     *
     * @param mplAmt 입력 예정금액(null이면 0)
     * @param amt    품목금액(서버 재계산값, null이면 상한 미적용)
     * @return 0 이상, amt 이하로 클램프된 예정금액
     */
    private static BigDecimal clampMpl(BigDecimal mplAmt, BigDecimal amt) {
        BigDecimal v = (mplAmt == null) ? BigDecimal.ZERO : mplAmt;
        if (v.signum() < 0) v = BigDecimal.ZERO;
        if (amt != null && v.compareTo(amt) > 0) v = amt;
        return v;
    }
```

- [ ] **Step 8: 실패 테스트 작성/수정**

`ProjectServiceTest.java`에서 `Bprojm` 빌더의 `.totRqmAmt(...)` 사용처(라인 544 부근)를 제거하고, mplAmt 클램프 동작 검증 테스트를 추가한다. 추가 테스트(클래스 내 적절한 위치):

```java
    @Test
    @org.junit.jupiter.api.DisplayName("createProject는 품목 mplAmt를 amt 범위로 클램프해 저장한다")
    void createClampsItemMplAmt() {
        // Arrange: 품목 1건, amt=1000, mplAmt=1500(초과) → 1000으로 클램프 기대
        ProjectDto.CreateRequest req = new ProjectDto.CreateRequest();
        req.setBseYy("2026");
        ProjectDto.BitemmDto item = ProjectDto.BitemmDto.builder()
                .ioeC("C1").gclNm("품목").qty(java.math.BigDecimal.ONE).curC("KRW")
                .amt(java.math.BigDecimal.valueOf(1000))
                .mplAmt(java.math.BigDecimal.valueOf(1500))
                .build();
        req.setItems(java.util.List.of(item));
        // (기존 테스트의 목 셋업 패턴을 따라 projectRepository/bitemmRepository/codeService/xcrLookupService 목 구성)
        // ...
        // Act
        projectService.createProject(req);
        // Assert: 저장된 Bitemm의 mplAmt == 1000 (ArgumentCaptor로 검증)
        org.mockito.ArgumentCaptor<com.kdb.it.domain.budget.project.entity.Bitemm> captor =
                org.mockito.ArgumentCaptor.forClass(com.kdb.it.domain.budget.project.entity.Bitemm.class);
        org.mockito.Mockito.verify(bitemmRepository).save(captor.capture());
        assertThat(captor.getValue().getMplAmt()).isEqualByComparingTo("1000");
    }
```

> 주: 기존 `ProjectServiceTest`의 목 셋업(`@Mock` 필드, `xcrLookupService.resolveXcr`, `bitemmRepository.getNextSequenceValue` 등)을 참고해 Arrange를 채운다. 신규 품목 단건이므로 `verify(bitemmRepository).save(...)` 1회.

- [ ] **Step 9: 테스트 실행**

Run: `cd it_backend && ./gradlew test --tests "*ProjectServiceTest" -q`
Expected: PASS (컴파일 통과 + 클램프 검증 통과)

- [ ] **Step 10: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java
git commit -m "feat: ProjectService writes item MPL_AMT, removes project-level recalc"
```

---

### Task 7: `ProjectService` 목록 파생 주입 + 배치 조회

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectItemRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`

> 목록(`getProjectList`/`searchProjectList`)은 품목을 로드하지 않아 파생 3종이 null이 된다. 대상 프로젝트들의 활성 품목을 1회 배치 조회 후 프로젝트별로 `ProjectBudgetSummaryService`를 재사용해 주입한다.

- [ ] **Step 1: 배치 조회 메서드 추가**

`ProjectItemRepository.java`에 추가(기존 `findByAbusMngNoAndDelYn` 아래, 라인 87 부근):

```java
    /**
     * 프로젝트 관리번호 집합과 삭제여부로 품목 일괄 조회 (목록 파생 합산용, N+1 제거)
     *
     * @param prjMngNos 프로젝트 관리번호 집합
     * @param delYn     삭제 여부 ('N'=미삭제)
     * @return 해당 프로젝트들의 유효 품목 목록
     */
    List<Bitemm> findByAbusMngNoInAndDelYn(java.util.Collection<String> prjMngNos, String delYn);
```

- [ ] **Step 2: `enrichProjectListBatch`에 파생 주입 추가**

`ProjectService.java`의 `enrichProjectListBatch(...)` for 루프 시작 전(라인 776 `for (int i = 0; ...` 앞)에 배치 조회/그룹핑 추가:

```java
        // 목록 파생 합산: 대상 프로젝트들의 활성 품목 1회 배치 조회 후 프로젝트별 그룹핑
        Map<String, List<com.kdb.it.domain.budget.project.entity.Bitemm>> itemsByPrj =
                bitemmRepository.findByAbusMngNoInAndDelYn(prjMngNos, "N").stream()
                        .collect(Collectors.groupingBy(
                                com.kdb.it.domain.budget.project.entity.Bitemm::getAbusMngNo));
```

루프 내부, `setBudgetSummary(response, ...)` (라인 806) 다음 줄에 추가:

```java
            // 파생 예산 3종(totRqmAmt/mplCpitAmt/mplMngcAmt) 주입
            projectBudgetSummaryService.applyBudgetSummary(
                    response,
                    itemsByPrj.getOrDefault(project.getAbusMngNo(), java.util.List.of()));
```

> `applyBudgetSummary`는 자본/관리비 합계(`setBudgetAmounts`)와 파생 3종을 함께 설정한다. 기존 `setBudgetSummary`(BBUGTM 편성예산)와 역할이 달라 충돌하지 않는다.

- [ ] **Step 3: 컴파일 + 관련 테스트 실행**

Run: `cd it_backend && ./gradlew test --tests "*ProjectServiceTest" -q`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectItemRepository.java it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java
git commit -m "feat: inject derived budget amounts into project list via batch item query"
```

---

### Task 8: `council`/`plan` 테스트 빌더 정리

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java:329,402`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/plan/service/PlanServiceTest.java:245,311`

- [ ] **Step 1: `Bprojm` 빌더의 `.totRqmAmt(...)` 호출 제거**

위 4개 위치에서 `Bprojm.builder()...` 체인의 `.totRqmAmt(BigDecimal.valueOf(...))` / `.totRqmAmt(null)` 줄을 삭제.

- [ ] **Step 2: 해당 테스트 실행**

Run: `cd it_backend && ./gradlew test --tests "*CouncilServiceTest" --tests "*PlanServiceTest" -q`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java it_backend/src/test/java/com/kdb/it/domain/budget/plan/service/PlanServiceTest.java
git commit -m "test: remove totRqmAmt from Bprojm test builders"
```

---

## Phase C — 프론트엔드

### Task 9: `ResourceTableSection`에 "익년 이후 예산" 컬럼 추가

**Files:**
- Modify: `it_frontend/app/components/projects/ResourceTableSection.vue`

- [ ] **Step 1: `ResourceItem` 인터페이스에 `laterAmt` 추가**

라인 40 `gclAmt: number;` 다음에 추가:

```ts
    laterAmt: number; // 익년 이후 예산 (MPL_AMT, gclAmt의 일부, 0 ≤ laterAmt ≤ gclAmt)
```

- [ ] **Step 2: `addRow` 기본값에 `laterAmt: 0` 추가**

라인 252-266 `addRow`의 `items.value.push({...})` 객체에 `gclAmt: 0,` 다음 줄로 추가:

```ts
        laterAmt: 0,
```

- [ ] **Step 3: 소계(gclAmt) 컬럼 다음에 "익년 이후 예산" 컬럼 추가**

라인 398-413의 소계 `<Column>` 블록 다음에 신규 컬럼 추가:

```vue
                <!-- 익년 이후 예산: 소계(gclAmt) 중 익년 이후 예정분 (0 ~ 소계) -->
                <Column
                    header="익년 이후 예산"
                    header-class="text-center justify-center [&>div]:justify-center"
                    body-class="col-subtotal"
                    :style="{ minWidth: 'var(--col-sm)' }"
                >
                    <template #body="{ data }">
                        <InputNumber
                            v-model="data.laterAmt"
                            mode="currency"
                            :currency="data.currency || 'KRW'"
                            locale="ko-KR"
                            :min="0"
                            :max="data.gclAmt || 0"
                            class="w-full"
                        />
                    </template>
                </Column>
```

- [ ] **Step 4: 타입체크**

Run: `cd it_frontend && npm run typecheck`
Expected: PASS (단독). form.vue 매핑 미반영으로 다른 파일 오류가 나면 Task 10/11에서 해소.

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/components/projects/ResourceTableSection.vue
git commit -m "feat: add 익년 이후 예산(laterAmt) column to ResourceTableSection"
```

---

### Task 10: `form.vue` 로드/저장/계속복사 매핑 전환

**Files:**
- Modify: `it_frontend/app/pages/info/projects/form.vue`

- [ ] **Step 1: 로드 매핑에 `laterAmt` 복원 추가**

라인 622 `gclAmt: item.amt || 0,` 다음에 추가:

```ts
                        laterAmt: item.mplAmt || 0, // 익년 이후 예산 복원 (MPL_AMT)
```

- [ ] **Step 2: 저장 items 매핑에 `mplAmt` 추가**

라인 814 `amt: item.gclAmt,` 다음에 추가:

```ts
        mplAmt: item.laterAmt || 0, // 예정금액 (익년 이후분)
```

- [ ] **Step 3: 저장 payload에서 3개 필드 제거**

라인 834-836의 세 줄(`totRqmAmt`, `mplCpitAmt`, `mplMngcAmt`)을 삭제한다. (서버가 품목 합산으로 파생)

- [ ] **Step 4: 계속사업 복사 — 품목 `laterAmt` 복사 + 프로젝트 필드 제거**

계속복사 품목 매핑(라인 1120-1143 영역의 `prevItems.map` 결과 객체)에서 `gclAmt`/`xcr` 설정 부근에 추가:

```ts
                laterAmt: item.mplAmt || 0, // 전년도 품목 예정금액 복사
```

그리고 라인 1156-1157의 `mplCpitAmt`/`mplMngcAmt` 복사 2줄을 삭제. 라인 1155 `prjBg: Number(detail.totRqmAmt) || 0,`는 watch가 resourceItems 기반으로 재계산하므로 그대로 두어도 무방(즉시 덮어써짐).

- [ ] **Step 5: 타입체크 (createInitialForm/computed 미반영으로 실패 예상)**

Run: `cd it_frontend && npm run typecheck`
Expected: FAIL — `form.mplCpitAmt`/`mplMngcAmt` 참조가 Task 11 이전이라 잔존. (Task 11에서 해소)

- [ ] **Step 6: 커밋 (WIP)**

```bash
git add it_frontend/app/pages/info/projects/form.vue
git commit -m "refactor: form.vue maps item laterAmt, drops project planned-amount payload (WIP)"
```

---

### Task 11: `form.vue` 파생 computed/watch/템플릿 전환

**Files:**
- Modify: `it_frontend/app/pages/info/projects/form.vue`

- [ ] **Step 1: `createInitialForm`에서 프로젝트 예정금액 필드 제거**

라인 110-111의 `mplCpitAmt: 0,`, `mplMngcAmt: 0,` 두 줄 삭제.

- [ ] **Step 2: 파생 computed 추가 + `budgetYearAmount` 재정의**

라인 154-159의 `budgetYearAmount` computed를 다음으로 교체(파생 자본/관리비 예정금액 computed 신설):

```ts
/**
 * 품목 비목별 익년 이후 예정금액 합계 (KRW 환산).
 * 자본/관리비 분류는 ResourceTableSection이 노출한 cTp 판정을 재사용한다.
 */
const laterCapitalAmt = computed(() => sumLaterByCapital(true));
const laterMngcAmt = computed(() => sumLaterByCapital(false));

/** capital=true면 자본 비목, false면 관리비 비목의 laterAmt 합계(KRW 환산) */
function sumLaterByCapital(capital: boolean): number {
    let sum = 0;
    for (const item of form.value.resourceItems) {
        const cTp = resourceTableRef.value?.getCTpByCdva(item.category) || '';
        if (!cTp) continue;
        const isCap = resourceTableRef.value?.isCapitalBudgetCTp(cTp) ?? false;
        if (isCap !== capital) continue;
        const rate = Number(previewRates.value[item.currency]);
        const krw = Number(item.laterAmt ?? 0) * (Number.isFinite(rate) && rate > 0 ? rate : 1);
        sum += krw;
    }
    return sum;
}

/**
 * 예산년도(YYYY) 예산 = 총 예산(prjBg) − 익년 이후 예정금액 합계(자본+관리비). 0 하한.
 */
const budgetYearAmount = computed(() =>
    Math.max(0, (form.value.prjBg || 0) - (laterCapitalAmt.value + laterMngcAmt.value)),
);
```

- [ ] **Step 3: watch에서 예정금액 클램프 블록 제거**

라인 1290-1297의 클램프 블록(아래)을 삭제한다(품목별 입력 max로 대체됨):

```ts
        // 예정자본금액은 자본예산 한도 ... 제거 대상
        if ((form.value.mplCpitAmt || 0) > capitalBudget) {
            form.value.mplCpitAmt = capitalBudget;
        }
        if ((form.value.mplMngcAmt || 0) > operatingExpense) {
            form.value.mplMngcAmt = operatingExpense;
        }
```

`capitalBudgetAmt`/`operatingExpenseAmt` ref 설정(라인 1287-1288)과 전결권 계산(라인 1300)은 유지한다.

- [ ] **Step 4: 템플릿 — 예정금액 입력 2칸을 파생 표시(readonly)로 교체**

라인 1882-1925의 두 `<div class="flex flex-col gap-2 flex-1">`(예정자본금액/예정관리비금액 입력) 블록을 다음으로 교체:

```vue
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                            >{{ form.bgYy + 1 }}년 이후 예정자본금액 (원)</label
                        >
                        <InputNumber
                            :model-value="laterCapitalAmt"
                            mode="currency"
                            currency="KRW"
                            locale="ko-KR"
                            placeholder="품목 합산"
                            fluid
                            readonly
                            input-class="bg-zinc-100 dark:bg-zinc-800"
                        />
                    </div>
                    <div class="flex flex-col gap-2 flex-1">
                        <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                            >{{ form.bgYy + 1 }}년 이후 예정관리비금액 (원)</label
                        >
                        <InputNumber
                            :model-value="laterMngcAmt"
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

- [ ] **Step 5: 타입체크 + 린트**

Run: `cd it_frontend && npm run check`
Expected: PASS (0 오류, 0 경고). `form.mplCpitAmt`/`mplMngcAmt` 참조가 모두 제거되었는지 확인.

- [ ] **Step 6: 커밋**

```bash
git add it_frontend/app/pages/info/projects/form.vue
git commit -m "feat: form.vue derives planned amounts from item laterAmt"
```

---

### Task 12: 프론트 타입 + 단위 테스트

**Files:**
- Modify: `it_frontend/app/composables/useProjects.ts:83`
- Verify: `it_frontend/tests/unit/composables/useGlobalSearch.test.ts`

- [ ] **Step 1: `ProjectItem`에 `mplAmt` 추가**

`useProjects.ts` 라인 83 `amt?: number; ...` 다음에 추가:

```ts
    mplAmt?: number; // 예정금액 (익년 이후 예정분, NUMBER(18,3))
```

> `Project` 인터페이스의 `totRqmAmt`/`mplCpitAmt`/`mplMngcAmt`(라인 39-41)는 서버 파생값으로 계속 제공되므로 **유지**한다.

- [ ] **Step 2: 영향 단위 테스트 실행**

Run: `cd it_frontend && npm test -- useGlobalSearch`
Expected: PASS (서버 파생값 유지로 `totRqmAmt` 인터페이스 불변 → 픽스처 수정 불필요 예상. 실패 시 픽스처를 인터페이스에 맞춰 보정)

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/app/composables/useProjects.ts
git commit -m "feat: add mplAmt to ProjectItem type"
```

---

### Task 13: E2E 픽스처 점검

**Files:**
- Modify: `it_frontend/tests/e2e/projects.spec.ts`
- Modify: `it_frontend/tests/e2e/budget.spec.ts`

- [ ] **Step 1: 저장 payload mock 점검**

두 스펙에서 프로젝트 생성/수정 mock이 **요청 본문**의 `totRqmAmt`/`mplCpitAmt`/`mplMngcAmt`를 단언하는 부분이 있으면 제거하고, 품목에 `mplAmt`가 포함되는지로 대체한다. 응답 mock은 파생 3종을 그대로 포함해도 무방(서버 호환).

- [ ] **Step 2: E2E 실행 (가능 시)**

Run: `cd it_frontend && npm run test:e2e -- projects budget`
Expected: PASS (로컬 백엔드 미기동 시 mock 기반 통과)

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/tests/e2e/projects.spec.ts it_frontend/tests/e2e/budget.spec.ts
git commit -m "test: update e2e fixtures for item MPL_AMT"
```

---

## Phase D — 문서 & 최종 검증

### Task 14: 문서 동기화

**Files:**
- Modify: `it_backend/docs/guides/data-model.md`
- Modify: `it_backend/docs/guides/colname-collision-map.md`
- Modify: `it_backend/src/main/resources/sql/plan_ddl.sql`

- [ ] **Step 1: data-model.md 갱신**

`Bitemm`(TPRMPP_BITEMM) 컬럼 목록에 `MPL_AMT`(예정금액) 추가. `Bprojm`(TPRMPP_BPROJM)에서 `TOT_RQM_AMT`/`MPL_CPIT_AMT`/`MPL_MNGC_AMT` 항목 제거 및 "품목 MPL_AMT 합산 파생" 주석 추가.

- [ ] **Step 2: colname-collision-map.md 갱신**

`TOT_RQM_AMT`/`totRqmAmt` 항목(라인 22 부근)을 "삭제됨(2026-06-22, 품목 MPL_AMT 파생으로 대체)"로 갱신.

- [ ] **Step 3: plan_ddl.sql 동기화**

`plan_ddl.sql`에 `TPRMPP_BITEMM`/`TPRMPP_BITEML` DDL이 있으면 `MPL_AMT NUMBER(18,3) DEFAULT 0` 추가, `TPRMPP_BPROJM`/`TPRMPP_BPROJL` DDL이 있으면 3개 컬럼 제거.

- [ ] **Step 4: 커밋**

```bash
git add it_backend/docs/guides/data-model.md it_backend/docs/guides/colname-collision-map.md it_backend/src/main/resources/sql/plan_ddl.sql
git commit -m "docs: sync data-model/colname-map/plan_ddl for MPL_AMT change"
```

---

### Task 15: 전체 검증 + TASK.md 기록

**Files:**
- Modify: `TASK.md`

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL (전체 통과)

- [ ] **Step 2: 프론트 정적분석 + 단위 테스트**

Run: `cd it_frontend && npm run check && npm test`
Expected: 0 오류 / 0 경고, 단위 테스트 통과

- [ ] **Step 3: AMT 환산 불일치 정리 과제 등록**

`TASK.md`에 항목 추가:

```markdown
- [ ] (기술부채) 품목 금액 환율 환산 규칙 통일: `ProjectBudgetSummaryService`(amt × xcr)와 과거 `recalcCurrentYearBudget`(× 미적용)의 비대칭을 단일 규칙으로 정리. MPL_AMT는 현재 AMT 규칙을 지점별로 미러링 중. (2026-06-22 품목 예정금액 전환에서 분리)
```

- [ ] **Step 4: 커밋**

```bash
git add TASK.md
git commit -m "docs: register xcr normalization cleanup task"
```

---

## Self-Review 체크리스트 (작성자 확인 완료)

- **스펙 커버리지**: BITEMM/BITEML MPL_AMT 추가(Task 1,3) / BPROJM·BPROJL 3컬럼 삭제(Task 2,3) / 참조 로직 품목 기반 전환(Task 4–7,9–11) / API 응답 파생 유지(Task 5,7) / 데이터 백필 0(Task 3) / 프론트 입력 컬럼·예산구성(Task 9–11) / 테스트·문서(Task 8,12–15) — 전 항목 매핑됨.
- **플레이스홀더 스캔**: 코드 단계는 실제 코드 포함. (Task 6 Step 8, Task 13 Step 1은 기존 테스트 목 셋업/스펙 구조에 의존하는 부분을 명시적으로 안내)
- **타입 일관성**: 백엔드 필드 `mplAmt`, DTO `mplAmt`, 프론트 `laterAmt`(UI 모델)↔`mplAmt`(API) 매핑이 Task 9–12 전반에서 일관. 파생식(∑AMT−∑MPL_AMT, 비목 분류)이 Task 4와 Task 11에서 동일.
