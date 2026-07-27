# BE-17 대표행 정책 결정론화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BudgetWorkService`의 encounter order 의존(임의 첫 행 채택) 4곳을 2026-07-27 사용자 확정 정책대로 결정론적 대표행 선택으로 교체한다.

**Architecture:** 기존 `CostRepresentativeSelector` 패턴을 따라 도메인별 대표행 셀렉터 유틸리티 3개를 신설하고, `BudgetWorkService`의 `putIfAbsent`/`findFirst` 채택 지점을 "그룹핑 → 셀렉터 선택"으로 교체한다. `getProjectSummary`의 그룹 키는 문자열 단일 키에서 `(orcTb, pkVl)` record 복합키로 분리한다. 신규 쿼리는 추가하지 않으므로 Oracle IT 없이 단위 테스트로 검증한다.

**Tech Stack:** Java 25, Spring Boot 4.1, JUnit 5 + AssertJ + Mockito (기존 `BudgetWorkServiceTest` 관례 준수)

**확정 정책 (TASK.md BE-17, 2026-07-27):**

| 결정 | 정책 |
|------|------|
| #1 BITEMM GCL 대표행 | `LST_YN='Y'` 우선, 없으면 `SNO` 최대 폴백 |
| #2 BBUGTM 편성률 대표행 | 최신 편성 실행(`bgNo` 최대) 행, 동률 시 `sno` 최대 |
| #3 BPROJM 배치 사업명 | `LST_YN='Y'` 행 이름, 없으면 관리번호 폴백 (단건 조회와 통일) |
| #5 그룹 키 | `(orcTb, key)` 복합키 분리 |

**작업 저장소:** 모든 코드 변경·커밋은 `C:\it\it_backend` 저장소 안에서 수행한다(`C:\it` 루트와 별개 git 저장소). 테스트 실행은 반드시 `cd C:\it\it_backend` 후 실행한다(백그라운드 셸은 cwd를 상속하지 않음).

**참고 파일:**
- 대상 서비스: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
- 셀렉터 패턴 원형: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostRepresentativeSelector.java`
- 기존 테스트 관례: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java` (`@ExtendWith(MockitoExtension.class)` + `@MockitoSettings(strictness = Strictness.LENIENT)`, 한글 `@DisplayName`)
- 엔티티: `Bbugtm`(bgNo, sno, bseYy, fntTbNm, pkColNm, fntTbCrySno, ioeC, bgDupAmt, asgRt — `@SuperBuilder`), `Bitemm`(gclMngNo, sno, abusMngNo, ioeC, lstYn, amt, mplAmt — `@SuperBuilder`), `Bprojm`(abusMngNo, sno, abusNm, lstYn — `@SuperBuilder`)

---

### Task 1: BudgetRepresentativeSelector (결정 #2 셀렉터)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetRepresentativeSelector.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetRepresentativeSelectorTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.kdb.it.domain.budget.work.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kdb.it.domain.budget.work.entity.Bbugtm;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** BudgetRepresentativeSelector 단위 테스트 (BE-17 결정 #2: 최신 편성 실행 행 기준) */
class BudgetRepresentativeSelectorTest {

    @Test
    @DisplayName("pick - bgNo가 가장 큰(최신 편성 실행) 행을 선택한다")
    void pick_최신bgNo행선택() {
        Bbugtm older = Bbugtm.builder().bgNo("BG-2026-0001").sno(9).asgRt(80).build();
        Bbugtm newer = Bbugtm.builder().bgNo("BG-2026-0002").sno(1).asgRt(50).build();

        Bbugtm result = BudgetRepresentativeSelector.pick(List.of(older, newer));

        assertThat(result.getAsgRt()).isEqualTo(50);
    }

    @Test
    @DisplayName("pick - bgNo 동률이면 sno가 큰 행을 선택한다")
    void pick_bgNo동률_sno최대행선택() {
        Bbugtm first = Bbugtm.builder().bgNo("BG-2026-0001").sno(1).asgRt(80).build();
        Bbugtm second = Bbugtm.builder().bgNo("BG-2026-0001").sno(2).asgRt(50).build();

        Bbugtm result = BudgetRepresentativeSelector.pick(List.of(second, first));

        assertThat(result.getAsgRt()).isEqualTo(50);
    }

    @Test
    @DisplayName("pick - bgNo null 행은 후순위로 밀린다")
    void pick_bgNoNull_후순위() {
        Bbugtm nullBgNo = Bbugtm.builder().sno(1).asgRt(80).build();
        Bbugtm withBgNo = Bbugtm.builder().bgNo("BG-2026-0001").sno(1).asgRt(50).build();

        Bbugtm result = BudgetRepresentativeSelector.pick(List.of(nullBgNo, withBgNo));

        assertThat(result.getAsgRt()).isEqualTo(50);
    }

    @Test
    @DisplayName("pick - 빈 목록이면 IllegalArgumentException")
    void pick_빈목록_예외() {
        assertThatThrownBy(() -> BudgetRepresentativeSelector.pick(List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetRepresentativeSelectorTest"`
Expected: 컴파일 실패 — `BudgetRepresentativeSelector` 심볼 없음

- [ ] **Step 3: 최소 구현 작성**

```java
package com.kdb.it.domain.budget.work.service;

import com.kdb.it.domain.budget.work.entity.Bbugtm;
import java.util.Comparator;
import java.util.List;

/** 같은 그룹(비목/품목)의 편성(BBUGTM) 행에서 대표 행 선택 규칙을 공유하는 유틸리티. (BE-17 결정 #2) */
public final class BudgetRepresentativeSelector {

    private BudgetRepresentativeSelector() {}

    /**
     * 같은 그룹에 속한 편성 행에서 대표 행을 결정적으로 선택합니다.
     *
     * <p>선택 규칙: 최신 편성 실행(BG_NO 내림차순) 우선 → 동일 BG_NO는 SNO 내림차순. null BG_NO/SNO는 후순위.
     *
     * @param budgets 같은 그룹의 편성 행 목록
     * @return 대표 행
     * @throws IllegalArgumentException 목록이 비어 있는 경우
     */
    public static Bbugtm pick(List<Bbugtm> budgets) {
        return budgets.stream()
                .max(
                        Comparator.comparing(
                                        (Bbugtm budget) -> budget.getBgNo(),
                                        Comparator.nullsFirst(Comparator.naturalOrder()))
                                .thenComparing(
                                        budget -> budget.getSno(),
                                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElseThrow(() -> new IllegalArgumentException("편성 행 목록이 비어 있습니다."));
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetRepresentativeSelectorTest"`
Expected: 4건 PASS

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetRepresentativeSelector.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetRepresentativeSelectorTest.java
git commit -m "feat: BBUGTM 대표행 셀렉터 추가 (BE-17 결정 #2: bgNo 최대·sno 최대)"
```

---

### Task 2: ItemRepresentativeSelector (결정 #1 셀렉터)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ItemRepresentativeSelector.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ItemRepresentativeSelectorTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.kdb.it.domain.budget.project.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kdb.it.domain.budget.project.entity.Bitemm;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** ItemRepresentativeSelector 단위 테스트 (BE-17 결정 #1: LST_YN='Y' 우선, 없으면 SNO 최대) */
class ItemRepresentativeSelectorTest {

    @Test
    @DisplayName("pick - LST_YN='Y' 행이 리스트 뒤에 있어도 우선 선택된다")
    void pick_lstYnY행_우선선택() {
        Bitemm oldVersion =
                Bitemm.builder().gclMngNo("GCL-1").sno(1).lstYn("N").abusMngNo("PRJ-OLD").build();
        Bitemm latest =
                Bitemm.builder().gclMngNo("GCL-1").sno(2).lstYn("Y").abusMngNo("PRJ-NEW").build();

        Bitemm result = ItemRepresentativeSelector.pick(List.of(oldVersion, latest));

        assertThat(result.getAbusMngNo()).isEqualTo("PRJ-NEW");
    }

    @Test
    @DisplayName("pick - LST_YN='Y' 행이 없으면 SNO 최대 행으로 폴백한다")
    void pick_lstYnY없음_sno최대폴백() {
        Bitemm sno1 = Bitemm.builder().gclMngNo("GCL-1").sno(1).lstYn("N").abusMngNo("PRJ-1").build();
        Bitemm sno3 = Bitemm.builder().gclMngNo("GCL-1").sno(3).lstYn("N").abusMngNo("PRJ-3").build();
        Bitemm sno2 = Bitemm.builder().gclMngNo("GCL-1").sno(2).lstYn("N").abusMngNo("PRJ-2").build();

        Bitemm result = ItemRepresentativeSelector.pick(List.of(sno1, sno3, sno2));

        assertThat(result.getAbusMngNo()).isEqualTo("PRJ-3");
    }

    @Test
    @DisplayName("pick - LST_YN='Y' 행이 2건이면 SNO 최대 행을 채택한다 (WARN 로그, 장애 없음)")
    void pick_lstYnY중복_sno최대채택() {
        Bitemm y1 = Bitemm.builder().gclMngNo("GCL-1").sno(1).lstYn("Y").abusMngNo("PRJ-1").build();
        Bitemm y2 = Bitemm.builder().gclMngNo("GCL-1").sno(2).lstYn("Y").abusMngNo("PRJ-2").build();

        Bitemm result = ItemRepresentativeSelector.pick(List.of(y1, y2));

        assertThat(result.getAbusMngNo()).isEqualTo("PRJ-2");
    }

    @Test
    @DisplayName("pick - 빈 목록이면 IllegalArgumentException")
    void pick_빈목록_예외() {
        assertThatThrownBy(() -> ItemRepresentativeSelector.pick(List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.project.service.ItemRepresentativeSelectorTest"`
Expected: 컴파일 실패 — `ItemRepresentativeSelector` 심볼 없음

- [ ] **Step 3: 최소 구현 작성**

```java
package com.kdb.it.domain.budget.project.service;

import com.kdb.it.domain.budget.project.entity.Bitemm;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

/** 같은 품목(GCL_MNG_NO)의 BITEMM 버전 행에서 대표 행 선택 규칙을 공유하는 유틸리티. (BE-17 결정 #1) */
@Slf4j
public final class ItemRepresentativeSelector {

    private ItemRepresentativeSelector() {}

    /**
     * 같은 품목관리번호의 버전 행 목록에서 대표 행을 결정적으로 선택합니다.
     *
     * <p>선택 규칙: ① {@code LST_YN='Y'} 행 우선 → ② {@code SNO} 내림차순 폴백. {@code LST_YN='Y'} 행이 2건
     * 이상이면 데이터 정합성 이상이므로 WARN 로그를 남기고 tie-break 결과를 사용합니다(장애 없이 동작).
     *
     * @param items 같은 {@code gclMngNo}의 미삭제 버전 행 목록
     * @return 대표 행
     * @throws IllegalArgumentException 목록이 비어 있는 경우
     */
    public static Bitemm pick(List<Bitemm> items) {
        Bitemm primary =
                items.stream()
                        .min(
                                Comparator.comparing(
                                                (Bitemm item) ->
                                                        "Y".equals(item.getLstYn()) ? 0 : 1)
                                        .thenComparing(
                                                item -> item.getSno(),
                                                Comparator.nullsLast(Comparator.reverseOrder())))
                        .orElseThrow(() -> new IllegalArgumentException("품목 버전 목록이 비어 있습니다."));
        long latestCount = items.stream().filter(item -> "Y".equals(item.getLstYn())).count();
        if (latestCount > 1) {
            log.warn(
                    "BITEMM LST_YN='Y' 행이 {}건입니다 (gclMngNo={}, 선택 sno={})",
                    latestCount,
                    primary.getGclMngNo(),
                    primary.getSno());
        }
        return primary;
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.project.service.ItemRepresentativeSelectorTest"`
Expected: 4건 PASS

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/project/service/ItemRepresentativeSelector.java src/test/java/com/kdb/it/domain/budget/project/service/ItemRepresentativeSelectorTest.java
git commit -m "feat: BITEMM 품목 대표행 셀렉터 추가 (BE-17 결정 #1: LST_YN='Y' 우선·SNO 폴백)"
```

---

### Task 3: ProjectRepresentativeSelector (결정 #3 셀렉터)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectRepresentativeSelector.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectRepresentativeSelectorTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.kdb.it.domain.budget.project.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.budget.project.entity.Bprojm;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** ProjectRepresentativeSelector 단위 테스트 (BE-17 결정 #3: LST_YN='Y' 행만 대표, 없으면 empty) */
class ProjectRepresentativeSelectorTest {

    @Test
    @DisplayName("pickLatest - LST_YN='Y' 행이 리스트 뒤에 있어도 선택된다")
    void pickLatest_lstYnY행선택() {
        Bprojm oldVersion =
                Bprojm.builder().abusMngNo("PRJ-1").sno(1).lstYn("N").abusNm("구버전명").build();
        Bprojm latest =
                Bprojm.builder().abusMngNo("PRJ-1").sno(2).lstYn("Y").abusNm("최신명").build();

        Optional<Bprojm> result =
                ProjectRepresentativeSelector.pickLatest(List.of(oldVersion, latest));

        assertThat(result).isPresent();
        assertThat(result.get().getAbusNm()).isEqualTo("최신명");
    }

    @Test
    @DisplayName("pickLatest - LST_YN='Y' 행이 없으면 empty (호출부에서 관리번호 폴백)")
    void pickLatest_lstYnY없음_empty() {
        Bprojm oldVersion =
                Bprojm.builder().abusMngNo("PRJ-1").sno(1).lstYn("N").abusNm("구버전명").build();

        Optional<Bprojm> result = ProjectRepresentativeSelector.pickLatest(List.of(oldVersion));

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("pickLatest - LST_YN='Y' 행이 2건이면 SNO 최대 행을 채택한다 (WARN 로그, 장애 없음)")
    void pickLatest_lstYnY중복_sno최대채택() {
        Bprojm y1 = Bprojm.builder().abusMngNo("PRJ-1").sno(1).lstYn("Y").abusNm("이름1").build();
        Bprojm y2 = Bprojm.builder().abusMngNo("PRJ-1").sno(2).lstYn("Y").abusNm("이름2").build();

        Optional<Bprojm> result = ProjectRepresentativeSelector.pickLatest(List.of(y1, y2));

        assertThat(result).isPresent();
        assertThat(result.get().getAbusNm()).isEqualTo("이름2");
    }

    @Test
    @DisplayName("pickLatest - 빈 목록이면 empty")
    void pickLatest_빈목록_empty() {
        assertThat(ProjectRepresentativeSelector.pickLatest(List.of())).isEmpty();
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.project.service.ProjectRepresentativeSelectorTest"`
Expected: 컴파일 실패 — `ProjectRepresentativeSelector` 심볼 없음

- [ ] **Step 3: 최소 구현 작성**

```java
package com.kdb.it.domain.budget.project.service;

import com.kdb.it.domain.budget.project.entity.Bprojm;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;

/** 같은 사업관리번호의 BPROJM 버전 행에서 대표 행 선택 규칙을 공유하는 유틸리티. (BE-17 결정 #3) */
@Slf4j
public final class ProjectRepresentativeSelector {

    private ProjectRepresentativeSelector() {}

    /**
     * 같은 사업관리번호의 버전 행 목록에서 최신 대표 행을 결정적으로 선택합니다.
     *
     * <p>선택 규칙: {@code LST_YN='Y'} 행만 대표로 인정합니다(단건 조회
     * {@code findByAbusMngNoAndLstYnAndDelYn}과 동일 의미). 해당 행이 없으면 empty를 반환하며 호출부는
     * 관리번호 폴백을 적용합니다. {@code LST_YN='Y'} 행이 2건 이상이면 데이터 정합성 이상이므로 WARN 로그를 남기고
     * {@code SNO} 내림차순 tie-break 결과를 사용합니다(장애 없이 동작).
     *
     * @param projects 같은 {@code abusMngNo}의 미삭제 버전 행 목록
     * @return {@code LST_YN='Y'} 대표 행, 없으면 empty
     */
    public static Optional<Bprojm> pickLatest(List<Bprojm> projects) {
        List<Bprojm> latestRows =
                projects.stream().filter(project -> "Y".equals(project.getLstYn())).toList();
        if (latestRows.isEmpty()) {
            return Optional.empty();
        }
        Optional<Bprojm> primary =
                latestRows.stream()
                        .max(
                                Comparator.comparing(
                                        (Bprojm project) -> project.getSno(),
                                        Comparator.nullsFirst(Comparator.naturalOrder())));
        if (latestRows.size() > 1) {
            log.warn(
                    "BPROJM LST_YN='Y' 행이 {}건입니다 (abusMngNo={}, 선택 sno={})",
                    latestRows.size(),
                    primary.get().getAbusMngNo(),
                    primary.get().getSno());
        }
        return primary;
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.project.service.ProjectRepresentativeSelectorTest"`
Expected: 4건 PASS

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/project/service/ProjectRepresentativeSelector.java src/test/java/com/kdb/it/domain/budget/project/service/ProjectRepresentativeSelectorTest.java
git commit -m "feat: BPROJM 사업 대표행 셀렉터 추가 (BE-17 결정 #3: LST_YN='Y' 행만 대표)"
```

---

### Task 4: getIoeCategories 편성률 대표행 적용 (결정 #2-a)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java:114-124` (getIoeCategories 내부)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 작성** — `BudgetWorkServiceTest`의 getIoeCategories 섹션에 추가

```java
@Test
@DisplayName("getIoeCategories - 혼합 편성률이면 최신 편성 실행(bgNo 최대) 행의 편성률을 반환한다")
void getIoeCategories_혼합편성률_최신bgNo행기준() {
    // given: 같은 비목 집합에 편성률이 다른 두 행 — 리스트 앞에 구 실행(80), 뒤에 신 실행(50)
    Ccodem code = Ccodem.builder().cNm("자산비").cdva("237").build();
    Ccodem ioeCode = Ccodem.builder().cdva("001").cNm("237-0700").cdvaDtlC("237-0700").build();
    Bbugtm olderRun = Bbugtm.builder().bgNo("BG-2026-0001").sno(1).ioeC("001").asgRt(80).build();
    Bbugtm newerRun = Bbugtm.builder().bgNo("BG-2026-0002").sno(1).ioeC("001").asgRt(50).build();

    given(codeRepository.findByCIdWithValidDate("DUP_IOE", null)).willReturn(List.of(code));
    given(codeRepository.findByCIdWithValidDate("IOE_C", null)).willReturn(List.of(ioeCode));
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N"))
            .willReturn(List.of(olderRun, newerRun));
    given(bbugtmRepository.sumApprovedAmountByIoeCValues(any(), eq("2026")))
            .willReturn(BigDecimal.TEN);

    // when
    List<BudgetWorkDto.IoeCategoryResponse> result = budgetWorkService.getIoeCategories("2026");

    // then: encounter order(80)가 아니라 최신 편성 실행(50) 기준
    assertThat(result.get(0).dupRt()).isEqualTo(50);
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest.getIoeCategories_혼합편성률_최신bgNo행기준"`
Expected: FAIL — 현행 `findFirst`는 리스트 첫 행(80) 반환

- [ ] **Step 3: 구현** — `getIoeCategories`의 기존 편성률 조회 블록 교체

변경 전 (`BudgetWorkService.java:114-124`):

```java
                            // 3. 기존 편성률 조회 (ioeC IN ioeCValues 기반)
                            Integer dupRt =
                                    existingBudgets.stream()
                                            .filter(
                                                    b ->
                                                            b.getIoeC() != null
                                                                    && ioeCValues.contains(
                                                                            b.getIoeC()))
                                            .map(value -> value.getAsgRt())
                                            .findFirst()
                                            .orElse(null);
```

변경 후:

```java
                            // 3. 기존 편성률 조회: 최신 편성 실행(bgNo 최대) 행 기준 (BE-17 결정 #2)
                            List<Bbugtm> matchedBudgets =
                                    existingBudgets.stream()
                                            .filter(
                                                    b ->
                                                            b.getIoeC() != null
                                                                    && ioeCValues.contains(
                                                                            b.getIoeC()))
                                            .toList();
                            Integer dupRt =
                                    matchedBudgets.isEmpty()
                                            ? null
                                            : BudgetRepresentativeSelector.pick(matchedBudgets)
                                                    .getAsgRt();
```

`BudgetRepresentativeSelector`는 같은 패키지(`com.kdb.it.domain.budget.work.service`)이므로 import 불필요.

- [ ] **Step 4: 테스트 통과 확인** — 신규 + 기존 getIoeCategories 회귀 포함

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest"`
Expected: 전체 PASS (기존 `기존편성률있음_편성률반환` 등은 단일 행 fixture이므로 결과 불변)

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java
git commit -m "fix: getIoeCategories 편성률을 최신 편성 실행 행 기준으로 결정론화 (BE-17 결정 #2)"
```

---

### Task 5: getProjectSummary 헤더 편성률·품목 편성행 대표행 적용 (결정 #2-b, #2-c)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java` (getProjectSummary의 `rateByPrefix` 블록과 `firstBudgetByGcl` 블록)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 작성** — `BudgetWorkServiceTest`에 getProjectSummary 섹션 추가

```java
// =========================================================================
// getProjectSummary — 대표행 결정론화 (BE-17)
// =========================================================================

@Test
@DisplayName("getProjectSummary - 헤더 편성률은 최신 편성 실행(bgNo 최대) 행 기준")
void getProjectSummary_헤더편성률_최신bgNo행기준() {
    // given: 같은 비목 접두어에 편성률이 다른 두 실행 행 — 앞에 구 실행(80), 뒤에 신 실행(50)
    Ccodem dupCode = Ccodem.builder().cNm("자산비").cdva("237").build();
    Ccodem ioeCode = Ccodem.builder().cdva("001").cNm("237-0700").cdvaDtlC("237-0700").build();
    Bbugtm olderRun =
            Bbugtm.builder()
                    .bgNo("BG-2026-0001")
                    .sno(1)
                    .fntTbNm("BCOSTM")
                    .pkColNm("COST-2026-0001")
                    .fntTbCrySno(1)
                    .ioeC("001")
                    .asgRt(80)
                    .bgDupAmt(new BigDecimal("800"))
                    .build();
    Bbugtm newerRun =
            Bbugtm.builder()
                    .bgNo("BG-2026-0002")
                    .sno(1)
                    .fntTbNm("BCOSTM")
                    .pkColNm("COST-2026-0002")
                    .fntTbCrySno(1)
                    .ioeC("001")
                    .asgRt(50)
                    .bgDupAmt(new BigDecimal("500"))
                    .build();

    given(codeRepository.findByCIdWithValidDate("DUP_IOE", null)).willReturn(List.of(dupCode));
    given(codeRepository.findByCIdWithValidDate("IOE_C", null)).willReturn(List.of(ioeCode));
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N"))
            .willReturn(List.of(olderRun, newerRun));
    given(budgetWorkQueryRepository.findApprovedSourcePks("2026"))
            .willReturn(java.util.Set.of());
    given(costRepository.findRepresentativeViewsByCostBgNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of());

    // when
    BudgetWorkDto.ProjectSummaryResponse result = budgetWorkService.getProjectSummary("2026");

    // then: encounter order(80)가 아니라 최신 편성 실행(50) 기준
    assertThat(result.categories().get(0).dupRt()).isEqualTo(50);
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest.getProjectSummary_헤더편성률_최신bgNo행기준"`
Expected: FAIL — 현행 `putIfAbsent`는 리스트 첫 행(80) 채택

- [ ] **Step 3: 구현 (#2-b)** — `rateByPrefix` 빌드 블록 교체

변경 전 (`BudgetWorkService.java:840-855`):

```java
        // 비목별 편성률 맵 (prefix → dupRt)
        // ioeC("101") → cNm("304-1100") → startsWith("304") 방식으로 DUP_IOE 접두어 매칭
        Map<String, Integer> rateByPrefix = new LinkedHashMap<>();
        for (Bbugtm b : budgets) {
            if (b.getIoeC() != null && b.getAsgRt() != null) {
                String ioeHierarchyCode = ioeCdvaToHierarchyCode.get(b.getIoeC());
                if (ioeHierarchyCode == null) continue;
                for (Ccodem code : ioeCodes) {
                    String prefix = extractPrefix(code.getCdva());
                    if (ioeHierarchyCode.startsWith(prefix)) {
                        rateByPrefix.putIfAbsent(prefix, b.getAsgRt());
                        break;
                    }
                }
            }
        }
```

변경 후:

```java
        // 비목별 편성률 맵 (prefix → dupRt): 접두어별로 그룹핑한 뒤
        // 최신 편성 실행(bgNo 최대) 행의 편성률을 대표값으로 사용 (BE-17 결정 #2)
        // ioeC("101") → cNm("304-1100") → startsWith("304") 방식으로 DUP_IOE 접두어 매칭
        Map<String, List<Bbugtm>> budgetsByPrefix = new LinkedHashMap<>();
        for (Bbugtm b : budgets) {
            if (b.getIoeC() != null && b.getAsgRt() != null) {
                String ioeHierarchyCode = ioeCdvaToHierarchyCode.get(b.getIoeC());
                if (ioeHierarchyCode == null) continue;
                for (Ccodem code : ioeCodes) {
                    String prefix = extractPrefix(code.getCdva());
                    if (ioeHierarchyCode.startsWith(prefix)) {
                        budgetsByPrefix.computeIfAbsent(prefix, k -> new ArrayList<>()).add(b);
                        break;
                    }
                }
            }
        }
        Map<String, Integer> rateByPrefix = new LinkedHashMap<>();
        for (Map.Entry<String, List<Bbugtm>> prefixEntry : budgetsByPrefix.entrySet()) {
            rateByPrefix.put(
                    prefixEntry.getKey(),
                    BudgetRepresentativeSelector.pick(prefixEntry.getValue()).getAsgRt());
        }
```

- [ ] **Step 4: 구현 (#2-c)** — `firstBudgetByGcl` 블록 교체 (같은 메서드 내)

변경 전 (`BudgetWorkService.java:893-900`):

```java
        // 사업별 결과에서도 예정금액은 예산년도분 요청/편성에서 제외한다.
        // 품목 예정금액은 사업+자본구분 그룹 내 품목금액 합계 대비 비율로 배분한다.
        Map<String, Bbugtm> firstBudgetByGcl = new LinkedHashMap<>();
        for (Bbugtm b : budgets) {
            if ("BITEMM".equals(b.getFntTbNm()) && b.getPkColNm() != null && b.getIoeC() != null) {
                firstBudgetByGcl.putIfAbsent(b.getPkColNm(), b);
            }
        }
```

변경 후:

```java
        // 사업별 결과에서도 예정금액은 예산년도분 요청/편성에서 제외한다.
        // 품목 예정금액은 사업+자본구분 그룹 내 품목금액 합계 대비 비율로 배분한다.
        // 품목별 대표 편성행은 최신 편성 실행(bgNo 최대) 행 기준 (BE-17 결정 #2)
        Map<String, List<Bbugtm>> budgetsByGcl = new LinkedHashMap<>();
        for (Bbugtm b : budgets) {
            if ("BITEMM".equals(b.getFntTbNm()) && b.getPkColNm() != null && b.getIoeC() != null) {
                budgetsByGcl.computeIfAbsent(b.getPkColNm(), k -> new ArrayList<>()).add(b);
            }
        }
        Map<String, Bbugtm> representativeBudgetByGcl = new LinkedHashMap<>();
        for (Map.Entry<String, List<Bbugtm>> gclEntry : budgetsByGcl.entrySet()) {
            representativeBudgetByGcl.put(
                    gclEntry.getKey(), BudgetRepresentativeSelector.pick(gclEntry.getValue()));
        }
```

그리고 바로 아래의 소비 지점 변경 (`BudgetWorkService.java:903`):

```java
        for (Map.Entry<String, Bbugtm> e : firstBudgetByGcl.entrySet()) {
```

→

```java
        for (Map.Entry<String, Bbugtm> e : representativeBudgetByGcl.entrySet()) {
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest" --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceBatchTest"`
Expected: 전체 PASS (기존 테스트는 그룹당 단일 행 fixture이므로 결과 불변)

- [ ] **Step 6: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java
git commit -m "fix: getProjectSummary 편성률·품목 편성행 대표 선택을 최신 편성 실행 기준으로 결정론화 (BE-17 결정 #2)"
```

---

### Task 6: BITEMM 대표행 적용 — computeMplAdjustment·getProjectSummary (결정 #1)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java` (computeMplAdjustment의 `bitemmByGcl`, getProjectSummary의 `bitemmByGcl`/`gclToPrj`)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("getProjectSummary - BITEMM 구버전 행이 앞에 와도 LST_YN='Y' 행의 사업번호로 그룹핑한다")
void getProjectSummary_BITEMM대표행_lstYnY기준() {
    // given: 같은 gclMngNo의 구버전(N, PRJ-OLD)이 리스트 앞, 최신(Y, PRJ-NEW)이 뒤
    Ccodem dupCode = Ccodem.builder().cNm("자산비").cdva("237").build();
    Ccodem ioeCode = Ccodem.builder().cdva("001").cNm("237-0700").cdvaDtlC("237-0700").build();
    Bbugtm budget =
            Bbugtm.builder()
                    .bgNo("BG-2026-0001")
                    .sno(1)
                    .fntTbNm("BITEMM")
                    .pkColNm("GCL-1")
                    .fntTbCrySno(1)
                    .ioeC("001")
                    .asgRt(80)
                    .bgDupAmt(new BigDecimal("800"))
                    .build();
    Bitemm oldVersion =
            Bitemm.builder().gclMngNo("GCL-1").sno(1).lstYn("N").abusMngNo("PRJ-OLD").build();
    Bitemm latest =
            Bitemm.builder().gclMngNo("GCL-1").sno(2).lstYn("Y").abusMngNo("PRJ-NEW").build();

    given(codeRepository.findByCIdWithValidDate("DUP_IOE", null)).willReturn(List.of(dupCode));
    given(codeRepository.findByCIdWithValidDate("IOE_C", null)).willReturn(List.of(ioeCode));
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N")).willReturn(List.of(budget));
    given(budgetWorkQueryRepository.findApprovedSourcePks("2026"))
            .willReturn(java.util.Set.of());
    given(projectItemRepository.findByGclMngNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of(oldVersion, latest));
    given(projectRepository.findByAbusMngNoInAndDelYn(any(), eq("N"))).willReturn(List.of());

    // when
    BudgetWorkDto.ProjectSummaryResponse result = budgetWorkService.getProjectSummary("2026");

    // then: encounter order(PRJ-OLD)가 아니라 LST_YN='Y' 행(PRJ-NEW)의 사업번호로 그룹핑
    assertThat(result.data()).hasSize(1);
    assertThat(result.data().get(0).orcPkVl()).isEqualTo("PRJ-NEW");
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest.getProjectSummary_BITEMM대표행_lstYnY기준"`
Expected: FAIL — 현행 `putIfAbsent`는 첫 행(PRJ-OLD) 채택 → orcPkVl "PRJ-OLD"

- [ ] **Step 3: 구현 (getProjectSummary 쪽)** — `bitemmByGcl`/`gclToPrj` 블록 교체

변경 전 (`BudgetWorkService.java:874-891`):

```java
        // BITEMM gclMngNo → prjMngNo 선조회 Map (N+1 제거): BITEMM 원본의 품목 PK 집합을
        // 1회 배치 조회한 뒤 gclMngNo→abusMngNo 매핑을 미리 구성한다. 원본 단건 로직과 동일하게
        // gclMngNo별 첫 행만 채택(putIfAbsent)하고, 매핑이 없으면 gclMngNo 자체를 키로 사용한다.
        java.util.Set<String> gclPks =
                budgets.stream()
                        .filter(b -> "BITEMM".equals(b.getFntTbNm()) && b.getPkColNm() != null)
                        .map(value -> value.getPkColNm())
                        .collect(
                                java.util.stream.Collectors.toCollection(
                                        java.util.LinkedHashSet::new));
        Map<String, Bitemm> bitemmByGcl = new LinkedHashMap<>();
        Map<String, String> gclToPrj = new LinkedHashMap<>();
        if (!gclPks.isEmpty()) {
            for (Bitemm it : projectItemRepository.findByGclMngNoInAndDelYn(gclPks, "N")) {
                bitemmByGcl.putIfAbsent(it.getGclMngNo(), it);
                gclToPrj.putIfAbsent(it.getGclMngNo(), it.getAbusMngNo());
            }
        }
```

변경 후:

```java
        // BITEMM gclMngNo → prjMngNo 선조회 Map (N+1 제거): BITEMM 원본의 품목 PK 집합을
        // 1회 배치 조회한 뒤 gclMngNo→abusMngNo 매핑을 미리 구성한다. 품목별 대표 행은
        // LST_YN='Y' 우선, 없으면 SNO 최대 폴백(BE-17 결정 #1)이며, 매핑이 없으면
        // gclMngNo 자체를 키로 사용한다.
        java.util.Set<String> gclPks =
                budgets.stream()
                        .filter(b -> "BITEMM".equals(b.getFntTbNm()) && b.getPkColNm() != null)
                        .map(value -> value.getPkColNm())
                        .collect(
                                java.util.stream.Collectors.toCollection(
                                        java.util.LinkedHashSet::new));
        Map<String, Bitemm> bitemmByGcl = new LinkedHashMap<>();
        Map<String, String> gclToPrj = new LinkedHashMap<>();
        if (!gclPks.isEmpty()) {
            Map<String, List<Bitemm>> itemsByGcl = new LinkedHashMap<>();
            for (Bitemm it : projectItemRepository.findByGclMngNoInAndDelYn(gclPks, "N")) {
                itemsByGcl.computeIfAbsent(it.getGclMngNo(), k -> new ArrayList<>()).add(it);
            }
            for (Map.Entry<String, List<Bitemm>> itemEntry : itemsByGcl.entrySet()) {
                Bitemm representative = ItemRepresentativeSelector.pick(itemEntry.getValue());
                bitemmByGcl.put(itemEntry.getKey(), representative);
                gclToPrj.put(itemEntry.getKey(), representative.getAbusMngNo());
            }
        }
```

- [ ] **Step 4: 구현 (computeMplAdjustment 쪽)** — 같은 정책 적용

변경 전 (`BudgetWorkService.java:705-710`):

```java
        // gclMngNo → Bitemm(품목금액/환율/사업관리번호) — 품목 PK 집합 1회 배치 조회 (N+1 제거)
        // 원본 단건 로직과 동일하게 gclMngNo별 첫 행만 채택(putIfAbsent).
        Map<String, Bitemm> bitemmByGcl = new LinkedHashMap<>();
        for (Bitemm it : projectItemRepository.findByGclMngNoInAndDelYn(byGcl.keySet(), "N")) {
            bitemmByGcl.putIfAbsent(it.getGclMngNo(), it);
        }
```

변경 후:

```java
        // gclMngNo → Bitemm(품목금액/환율/사업관리번호) — 품목 PK 집합 1회 배치 조회 (N+1 제거)
        // 품목별 대표 행은 LST_YN='Y' 우선, 없으면 SNO 최대 폴백 (BE-17 결정 #1).
        Map<String, List<Bitemm>> itemsByGcl = new LinkedHashMap<>();
        for (Bitemm it : projectItemRepository.findByGclMngNoInAndDelYn(byGcl.keySet(), "N")) {
            itemsByGcl.computeIfAbsent(it.getGclMngNo(), k -> new ArrayList<>()).add(it);
        }
        Map<String, Bitemm> bitemmByGcl = new LinkedHashMap<>();
        for (Map.Entry<String, List<Bitemm>> itemEntry : itemsByGcl.entrySet()) {
            bitemmByGcl.put(
                    itemEntry.getKey(), ItemRepresentativeSelector.pick(itemEntry.getValue()));
        }
```

import 추가 (`BudgetWorkService.java` 상단 import 절):

```java
import com.kdb.it.domain.budget.project.service.ItemRepresentativeSelector;
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.*"`
Expected: 전체 PASS

- [ ] **Step 6: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java
git commit -m "fix: BITEMM 품목 대표행을 LST_YN='Y' 우선으로 결정론화 (BE-17 결정 #1)"
```

---

### Task 7: BPROJM 배치 사업명 LST_YN='Y' 통일 (결정 #3)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java` (getProjectSummary의 `prjNameByNo` 블록)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`

**참고:** `computeMplAdjustment`의 `prjByNo`는 `containsKey` 존재확인에만 쓰이므로 대표행 정책과 무관 — 의도적으로 변경하지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("getProjectSummary - 사업명은 LST_YN='Y' 행 이름, 구버전 행이 앞에 와도 최신명 표시")
void getProjectSummary_사업명_lstYnY행이름() {
    Ccodem dupCode = Ccodem.builder().cNm("자산비").cdva("237").build();
    Ccodem ioeCode = Ccodem.builder().cdva("001").cNm("237-0700").cdvaDtlC("237-0700").build();
    Bbugtm budget =
            Bbugtm.builder()
                    .bgNo("BG-2026-0001")
                    .sno(1)
                    .fntTbNm("BITEMM")
                    .pkColNm("GCL-1")
                    .fntTbCrySno(1)
                    .ioeC("001")
                    .asgRt(80)
                    .bgDupAmt(new BigDecimal("800"))
                    .build();
    Bitemm item =
            Bitemm.builder().gclMngNo("GCL-1").sno(1).lstYn("Y").abusMngNo("PRJ-1").build();
    Bprojm oldVersion =
            Bprojm.builder().abusMngNo("PRJ-1").sno(1).lstYn("N").abusNm("구버전명").build();
    Bprojm latest =
            Bprojm.builder().abusMngNo("PRJ-1").sno(2).lstYn("Y").abusNm("최신명").build();

    given(codeRepository.findByCIdWithValidDate("DUP_IOE", null)).willReturn(List.of(dupCode));
    given(codeRepository.findByCIdWithValidDate("IOE_C", null)).willReturn(List.of(ioeCode));
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N")).willReturn(List.of(budget));
    given(budgetWorkQueryRepository.findApprovedSourcePks("2026"))
            .willReturn(java.util.Set.of());
    given(projectItemRepository.findByGclMngNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of(item));
    given(projectRepository.findByAbusMngNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of(oldVersion, latest));

    BudgetWorkDto.ProjectSummaryResponse result = budgetWorkService.getProjectSummary("2026");

    assertThat(result.data()).hasSize(1);
    assertThat(result.data().get(0).name()).isEqualTo("최신명");
}

@Test
@DisplayName("getProjectSummary - LST_YN='Y' 행이 없으면 사업명 대신 관리번호로 폴백한다")
void getProjectSummary_사업명_lstYnY없음_관리번호폴백() {
    Ccodem dupCode = Ccodem.builder().cNm("자산비").cdva("237").build();
    Ccodem ioeCode = Ccodem.builder().cdva("001").cNm("237-0700").cdvaDtlC("237-0700").build();
    Bbugtm budget =
            Bbugtm.builder()
                    .bgNo("BG-2026-0001")
                    .sno(1)
                    .fntTbNm("BITEMM")
                    .pkColNm("GCL-1")
                    .fntTbCrySno(1)
                    .ioeC("001")
                    .asgRt(80)
                    .bgDupAmt(new BigDecimal("800"))
                    .build();
    Bitemm item =
            Bitemm.builder().gclMngNo("GCL-1").sno(1).lstYn("Y").abusMngNo("PRJ-1").build();
    Bprojm oldOnly =
            Bprojm.builder().abusMngNo("PRJ-1").sno(1).lstYn("N").abusNm("구버전명").build();

    given(codeRepository.findByCIdWithValidDate("DUP_IOE", null)).willReturn(List.of(dupCode));
    given(codeRepository.findByCIdWithValidDate("IOE_C", null)).willReturn(List.of(ioeCode));
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N")).willReturn(List.of(budget));
    given(budgetWorkQueryRepository.findApprovedSourcePks("2026"))
            .willReturn(java.util.Set.of());
    given(projectItemRepository.findByGclMngNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of(item));
    given(projectRepository.findByAbusMngNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of(oldOnly));

    BudgetWorkDto.ProjectSummaryResponse result = budgetWorkService.getProjectSummary("2026");

    assertThat(result.data()).hasSize(1);
    assertThat(result.data().get(0).name()).isEqualTo("PRJ-1");
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest"`
Expected: 두 신규 테스트 모두 FAIL — 현행은 첫 행 이름("구버전명") 채택

- [ ] **Step 3: 구현** — `prjNameByNo` 블록 교체

변경 전 (`BudgetWorkService.java:999-1007`):

```java
        Map<String, String> prjNameByNo = new LinkedHashMap<>();
        if (!prjGroupNos.isEmpty()) {
            for (Bprojm p : projectRepository.findByAbusMngNoInAndDelYn(prjGroupNos, "N")) {
                // 첫 행 채택 + 사업명이 null/blank가 아닐 때만 등록 (없으면 orcPkVl 폴백)
                if (p.getAbusNm() != null) {
                    prjNameByNo.putIfAbsent(p.getAbusMngNo(), p.getAbusNm());
                }
            }
        }
```

변경 후:

```java
        // 사업명 대표 행: LST_YN='Y' 행만 인정(단건 조회와 통일), 없으면 관리번호 폴백 (BE-17 결정 #3)
        Map<String, String> prjNameByNo = new LinkedHashMap<>();
        if (!prjGroupNos.isEmpty()) {
            Map<String, List<Bprojm>> projectsByNo = new LinkedHashMap<>();
            for (Bprojm p : projectRepository.findByAbusMngNoInAndDelYn(prjGroupNos, "N")) {
                projectsByNo.computeIfAbsent(p.getAbusMngNo(), k -> new ArrayList<>()).add(p);
            }
            for (Map.Entry<String, List<Bprojm>> projectEntry : projectsByNo.entrySet()) {
                ProjectRepresentativeSelector.pickLatest(projectEntry.getValue())
                        .map(p -> p.getAbusNm())
                        .filter(nm -> nm != null)
                        .ifPresent(nm -> prjNameByNo.put(projectEntry.getKey(), nm));
            }
        }
```

import 추가 (`BudgetWorkService.java` 상단 import 절):

```java
import com.kdb.it.domain.budget.project.service.ProjectRepresentativeSelector;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.*"`
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java
git commit -m "fix: 배치 사업명 대표행을 LST_YN='Y' 기준으로 단건 조회와 통일 (BE-17 결정 #3)"
```

---

### Task 8: getProjectSummary 그룹 키 (orcTb, key) 복합키 분리 (결정 #5)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java` (getProjectSummary의 `projectCategoryMap`/`orcTbMap` 및 응답 구성 루프)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
@Test
@DisplayName("getProjectSummary - 사업번호와 비용번호가 같은 문자열이어도 별도 행으로 분리 집계한다")
void getProjectSummary_동일키충돌_orcTb별분리() {
    // given: BCOSTM 원본 pk "X-1"과, BITEMM→사업 변환 결과가 같은 "X-1"인 두 편성행
    Ccodem dupCode = Ccodem.builder().cNm("자산비").cdva("237").build();
    Ccodem ioeCode = Ccodem.builder().cdva("001").cNm("237-0700").cdvaDtlC("237-0700").build();
    Bbugtm costBudget =
            Bbugtm.builder()
                    .bgNo("BG-2026-0001")
                    .sno(1)
                    .fntTbNm("BCOSTM")
                    .pkColNm("X-1")
                    .fntTbCrySno(1)
                    .ioeC("001")
                    .asgRt(80)
                    .bgDupAmt(new BigDecimal("800"))
                    .build();
    Bbugtm itemBudget =
            Bbugtm.builder()
                    .bgNo("BG-2026-0001")
                    .sno(2)
                    .fntTbNm("BITEMM")
                    .pkColNm("GCL-1")
                    .fntTbCrySno(1)
                    .ioeC("001")
                    .asgRt(80)
                    .bgDupAmt(new BigDecimal("400"))
                    .build();
    Bitemm item =
            Bitemm.builder().gclMngNo("GCL-1").sno(1).lstYn("Y").abusMngNo("X-1").build();

    given(codeRepository.findByCIdWithValidDate("DUP_IOE", null)).willReturn(List.of(dupCode));
    given(codeRepository.findByCIdWithValidDate("IOE_C", null)).willReturn(List.of(ioeCode));
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N"))
            .willReturn(List.of(costBudget, itemBudget));
    given(budgetWorkQueryRepository.findApprovedSourcePks("2026"))
            .willReturn(java.util.Set.of());
    given(projectItemRepository.findByGclMngNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of(item));
    given(projectRepository.findByAbusMngNoInAndDelYn(any(), eq("N"))).willReturn(List.of());
    given(costRepository.findRepresentativeViewsByCostBgNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of());

    // when
    BudgetWorkDto.ProjectSummaryResponse result = budgetWorkService.getProjectSummary("2026");

    // then: 단일 문자열 키였다면 1행으로 병합되지만, 복합키 분리 후 BCOSTM/BPROJM 2행
    assertThat(result.data()).hasSize(2);
    assertThat(result.data())
            .extracting(summaryItem -> summaryItem.orcTb())
            .containsExactlyInAnyOrder("BCOSTM", "BPROJM");
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest.getProjectSummary_동일키충돌_orcTb별분리"`
Expected: FAIL — 현행은 `orcTbMap.putIfAbsent`로 1행 병합 (`data()` size 1)

- [ ] **Step 3: 구현 — SourceKey record 도입 및 orcTbMap 제거**

3-1. `BudgetWorkService` 클래스 하단(마지막 메서드 뒤, 클래스 닫는 중괄호 앞)에 record 추가:

```java
    /** getProjectSummary 그룹 키: 원본 테이블 네임스페이스 + 원본 PK 복합키 (BE-17 결정 #5) */
    private record SourceKey(String orcTb, String pkVl) {}
```

3-2. 이중 그룹핑 맵 선언 교체.

변경 전 (`BudgetWorkService.java:868-872` 부근):

```java
        // 2. 사업별 + 비목별 이중 그룹핑
        // BITEMM → prjMngNo로 변환하여 프로젝트 단위로 그룹핑
        // key: 프로젝트관리번호 또는 전산업무비관리번호, value: { prefix → [요청금액, 편성금액] }
        Map<String, Map<String, BigDecimal[]>> projectCategoryMap = new LinkedHashMap<>();
        Map<String, String> orcTbMap = new LinkedHashMap<>();
```

변경 후:

```java
        // 2. 사업별 + 비목별 이중 그룹핑
        // BITEMM → prjMngNo로 변환하여 프로젝트 단위로 그룹핑
        // key: (원본테이블, 프로젝트관리번호|전산업무비관리번호) 복합키 — 사업번호와 비용번호가
        // 같은 문자열이어도 병합되지 않도록 네임스페이스를 분리한다 (BE-17 결정 #5)
        // value: { prefix → [요청금액, 편성금액] }
        Map<SourceKey, Map<String, BigDecimal[]>> projectCategoryMap = new LinkedHashMap<>();
```

3-3. 그룹 키 결정 루프 교체.

변경 전 (`BudgetWorkService.java:925-943` 부근):

```java
        for (Bbugtm b : budgets) {
            if (b.getPkColNm() == null) continue;

            // 그룹핑 키 결정: BITEMM은 프로젝트 단위로 통합
            String groupKey;
            String groupOrcTb;
            Bitemm sourceItem = null;
            if ("BITEMM".equals(b.getFntTbNm())) {
                // gclMngNo → prjMngNo 변환 (선조회 Map, 매핑 없으면 gclMngNo 자체)
                sourceItem = bitemmByGcl.get(b.getPkColNm());
                groupKey = gclToPrj.getOrDefault(b.getPkColNm(), b.getPkColNm());
                groupOrcTb = "BPROJM";
            } else {
                groupKey = b.getPkColNm();
                groupOrcTb = b.getFntTbNm();
            }

            orcTbMap.putIfAbsent(groupKey, groupOrcTb);
            projectCategoryMap.computeIfAbsent(groupKey, k -> new LinkedHashMap<>());
```

변경 후:

```java
        for (Bbugtm b : budgets) {
            if (b.getPkColNm() == null) continue;

            // 그룹핑 키 결정: BITEMM은 프로젝트 단위로 통합
            SourceKey groupKey;
            Bitemm sourceItem = null;
            if ("BITEMM".equals(b.getFntTbNm())) {
                // gclMngNo → prjMngNo 변환 (선조회 Map, 매핑 없으면 gclMngNo 자체)
                sourceItem = bitemmByGcl.get(b.getPkColNm());
                groupKey =
                        new SourceKey(
                                "BPROJM", gclToPrj.getOrDefault(b.getPkColNm(), b.getPkColNm()));
            } else {
                groupKey = new SourceKey(b.getFntTbNm(), b.getPkColNm());
            }

            projectCategoryMap.computeIfAbsent(groupKey, k -> new LinkedHashMap<>());
```

이어지는 `Map<String, BigDecimal[]> catMap = projectCategoryMap.get(groupKey);`는 타입 변경 없이 그대로 동작한다.

3-4. 이름 선조회 대상 분류 교체.

변경 전 (`BudgetWorkService.java:993-998` 부근):

```java
        java.util.Set<String> prjGroupNos = new java.util.LinkedHashSet<>();
        java.util.Set<String> costGroupNos = new java.util.LinkedHashSet<>();
        for (Map.Entry<String, String> e : orcTbMap.entrySet()) {
            if ("BPROJM".equals(e.getValue())) prjGroupNos.add(e.getKey());
            else if ("BCOSTM".equals(e.getValue())) costGroupNos.add(e.getKey());
        }
```

변경 후:

```java
        java.util.Set<String> prjGroupNos = new java.util.LinkedHashSet<>();
        java.util.Set<String> costGroupNos = new java.util.LinkedHashSet<>();
        for (SourceKey key : projectCategoryMap.keySet()) {
            if ("BPROJM".equals(key.orcTb())) prjGroupNos.add(key.pkVl());
            else if ("BCOSTM".equals(key.orcTb())) costGroupNos.add(key.pkVl());
        }
```

3-5. 응답 구성 루프 교체.

변경 전 (`BudgetWorkService.java:1029-1041` 부근):

```java
        for (Map.Entry<String, Map<String, BigDecimal[]>> entry : projectCategoryMap.entrySet()) {
            String orcPkVl = entry.getKey();
            Map<String, BigDecimal[]> catMap = entry.getValue();
            String orcTb = orcTbMap.get(orcPkVl);
```

변경 후:

```java
        for (Map.Entry<SourceKey, Map<String, BigDecimal[]>> entry :
                projectCategoryMap.entrySet()) {
            String orcPkVl = entry.getKey().pkVl();
            Map<String, BigDecimal[]> catMap = entry.getValue();
            String orcTb = entry.getKey().orcTb();
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.*" --tests "com.kdb.it.domain.budget.work.controller.BudgetWorkControllerTest"`
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java
git commit -m "fix: getProjectSummary 그룹 키를 (orcTb, pkVl) 복합키로 분리 (BE-17 결정 #5)"
```

---

### Task 9: 전체 검증 및 문서 마감

**Files:**
- Modify: `C:\it\TASK.md` (BE-17 행 제거), `C:\it\TASK_DONE.md` (완료 기록 추가)

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd C:\it\it_backend && ./gradlew test`
Expected: BUILD SUCCESSFUL, 실패 0건 (Gradle 파일락 발생 시 `--no-daemon` 재시도)

- [ ] **Step 2: 백엔드 커밋 로그 확인**

Run: `cd C:\it\it_backend && git log --oneline -8`
Expected: Task 1~8의 커밋 8건 확인

- [ ] **Step 3: TASK.md BE-17 행을 TASK_DONE.md로 이관**

`TASK.md`에서 BE-17 행을 제거하고, `TASK_DONE.md`의 2026-07-27 절에 다음 요지로 기록:

> BE-17 프로젝션 보류 정책 4건 확정·구현 완료 (2026-07-27): ① BITEMM GCL 대표행 `LST_YN='Y'` 우선(`ItemRepresentativeSelector`) ② BBUGTM 편성률 대표행 최신 편성 실행 기준(`BudgetRepresentativeSelector`) ③ BPROJM 배치 사업명 `LST_YN='Y'` 통일(`ProjectRepresentativeSelector`) ④ `getProjectSummary` `(orcTb, pkVl)` 복합키 분리. 차단 해제된 BBUGTM·`ProjectKeyView` 프로젝션은 BE-03 후속 재계획 시 포함. 구현 계획: `docs/superpowers/plans/2026-07-27-be17-representative-row-policies.md`, 백엔드 커밋은 it_backend 저장소 로그 참조.

- [ ] **Step 4: 루트 저장소 커밋**

```bash
cd C:\it
git add TASK.md TASK_DONE.md docs/superpowers/plans/2026-07-27-be17-representative-row-policies.md
git commit -m "docs: BE-17 대표행 정책 확정·구현 완료 이관"
```

---

## 완료 기준

- [ ] 신규 셀렉터 3개 + 단위 테스트 3개 파일 존재
- [ ] `BudgetWorkService`에 `putIfAbsent`/`findFirst` 기반 임의 대표행 채택이 남아 있지 않음 (`computeMplAdjustment`의 `prjByNo`는 존재확인 전용으로 예외)
- [ ] `./gradlew test` 전체 통과
- [ ] TASK.md에서 BE-17 제거, TASK_DONE.md 기록 완료

## 명시적 비범위 (YAGNI)

- BBUGTM·`ProjectKeyView`의 projection(view) 전환 — 이번 작업은 대표행 의미 확정·결정론화까지이며, projection 전환은 BE-03 보수적 프로젝션 계획에서 재계획한다.
- `computeMplAdjustment`의 `prjByNo`(존재확인 전용) 변경 — 대표행 정책과 무관.
- 신규 DB 쿼리·마이그레이션 없음 — Oracle IT 불필요.
