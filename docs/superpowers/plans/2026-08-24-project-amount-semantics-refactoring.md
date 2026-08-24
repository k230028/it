# 정보화사업 금액 의미 리팩토링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보화사업 품목 `AMT`를 당해 요청금액으로 고정하고, 외화 예정금액을 원화로 환산하여 사업 총소요금액·예정금액·지급금액 스냅샷과 모든 소비 화면을 일관되게 리팩토링한다.

**Architecture:** 프로젝트 도메인에 순수 금액 계산기와 `ProjectAmountSummary` 값 객체를 추가한다. 품목 저장 후 활성 최신 품목을 재조회하여 사업 스냅샷을 갱신하고, 협의회·예산작업·API·프론트는 동일한 필드 의미를 소비한다. 기존 데이터 변환과 삭제 실행은 이 계획에 포함하지 않는다.

**Tech Stack:** Java 25, Spring Boot 4, JUnit 5, Mockito, Oracle, Nuxt 4, Vue 3, TypeScript, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-24-project-amount-semantics-refactoring-design.md`

## Global Constraints

- `TPRMPP_BITEMM.AMT`는 원화 기준 당해 요청금액이다.
- 외화 품목의 `FC_AMT`와 `MPL_AMT`는 외화 원금이며 동일한 `CUR_C`, `XCR`, `XCR_BSE_DT`를 사용한다.
- `TPRMPP_BPROJM.TOT_RQM_AMT`, `MPL_AMT`, `DFR_AMT`는 모두 원화다.
- `TOT_RQM_AMT = SUM(활성 최신 품목 AMT) + 원화 환산 예정금액 + NVL(DFR_AMT, 0)`이다.
- `MPL_AMT <= AMT` 제약과 예정금액 비율 차감은 허용하지 않는다.
- 외화 환산은 scale 3, `RoundingMode.HALF_UP`을 사용한다.
- 기존 업무 데이터 변환, 데이터 삭제 명령 실행, 변경로그 과거행 재작성은 범위에서 제외한다.
- 신규 JavaDoc·TSDoc·인라인 주석은 한글로 작성한다.
- 각 저장소의 기존 사용자 변경을 보존하고 스테이징 시 파일 경로를 명시한다.

---

## 파일 구조

### 새 파일

- `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectAmountCalculator.java`: 품목 통화별 예정금액 환산과 사업 금액 합산만 담당한다.
- `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectAmountSummary.java`: 당해·예정·지급·총소요금액을 전달하는 불변 값 객체다.
- `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectAmountCalculatorTest.java`: 통화·반올림·독립금액 불변식을 검증한다.
- `it_database/docs/verification/project-amount-semantics.sql`: 데이터 초기화 후 신규 계약의 불변식만 진단한다.

### 주요 수정 파일

- `it_backend/.../project/service/ProjectItemSynchronizer.java`: `clampMpl` 제거와 음수 검증을 담당한다.
- `it_backend/.../project/service/ProjectService.java`: 저장 후 중앙 계산기로 사업 스냅샷을 갱신한다.
- `it_backend/.../project/service/ProjectBudgetSummaryService.java`: 응답 필드 의미를 새 계약으로 매핑한다.
- `it_backend/.../budget/work/service/BudgetSummaryService.java`: 예정금액 차감 로직을 제거한다.
- `it_backend/.../budget/work/service/BudgetProjectSummaryService.java`: 사업별 예정금액 비율 차감을 제거한다.
- `it_backend/.../council/service/CouncilService.java`: 협의회 당해금액을 사업 스냅샷 의미로 통일한다.
- `it_frontend/app/features/project/useContinueProjectSearch.ts`: 계속사업의 금액 자동 복사를 제거한다.
- `it_frontend/app/pages/info/projects/{index.vue,[id].vue}` 및 관련 PDF·Excel 파일: 당해 요청금액과 총소요금액 표시를 구분한다.

---

### Task 1: 중앙 사업 금액 계산기

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectAmountSummary.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectAmountCalculator.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectAmountCalculatorTest.java`

**Interfaces:**
- Consumes: `Bitemm.getAmt()`, `getMplAmt()`, `getCurC()`, `getXcr()`
- Produces: `ProjectAmountSummary calculate(Collection<Bitemm> activeItems, BigDecimal paidAmt)`와 `BigDecimal toPlannedKrw(Bitemm item)`

- [ ] **Step 1: 원화·외화·독립 예정금액 실패 테스트 작성**

```java
@Test
@DisplayName("원화와 외화 예정금액을 원화로 합산하고 지급금액을 총소요금액에 더한다")
void calculate_mixedCurrencies() {
    Bitemm krw = item("KRW", new BigDecimal("100.000"), null, new BigDecimal("500.000"), null);
    Bitemm usd = item("USD", new BigDecimal("140000.000"), new BigDecimal("100.000"),
            new BigDecimal("50.000"), new BigDecimal("1400.0000"));

    ProjectAmountSummary result = calculator.calculate(List.of(krw, usd), new BigDecimal("20.000"));

    assertThat(result.currentRequestAmt()).isEqualByComparingTo("140100.000");
    assertThat(result.plannedAmt()).isEqualByComparingTo("70500.000");
    assertThat(result.paidAmt()).isEqualByComparingTo("20.000");
    assertThat(result.totalRequiredAmt()).isEqualByComparingTo("210620.000");
}

@Test
@DisplayName("예정금액은 당해 요청금액보다 커도 손실 없이 계산한다")
void calculate_plannedAmountMayExceedCurrentAmount() {
    Bitemm item = item("KRW", new BigDecimal("100"), null, new BigDecimal("500"), null);

    ProjectAmountSummary result = calculator.calculate(List.of(item), null);

    assertThat(result.currentRequestAmt()).isEqualByComparingTo("100.000");
    assertThat(result.plannedAmt()).isEqualByComparingTo("500.000");
    assertThat(result.totalRequiredAmt()).isEqualByComparingTo("600.000");
}
```

- [ ] **Step 2: 계산기 테스트가 구현 부재로 실패하는지 확인**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests 'com.kdb.it.domain.budget.project.service.ProjectAmountCalculatorTest'
```

Expected: `ProjectAmountCalculator` 또는 `ProjectAmountSummary`를 찾지 못해 FAIL.

- [ ] **Step 3: 값 객체와 최소 계산기 구현**

```java
public record ProjectAmountSummary(
        BigDecimal currentRequestAmt,
        BigDecimal plannedAmt,
        BigDecimal paidAmt,
        BigDecimal totalRequiredAmt) {}
```

```java
@Component
public class ProjectAmountCalculator {
    private static final int SCALE = 3;

    public ProjectAmountSummary calculate(Collection<Bitemm> activeItems, BigDecimal paidAmt) {
        BigDecimal current = BigDecimal.ZERO;
        BigDecimal planned = BigDecimal.ZERO;
        for (Bitemm item : activeItems) {
            current = current.add(nvl(item.getAmt()));
            planned = planned.add(toPlannedKrw(item));
        }
        BigDecimal paid = nvl(paidAmt).setScale(SCALE, RoundingMode.HALF_UP);
        current = current.setScale(SCALE, RoundingMode.HALF_UP);
        planned = planned.setScale(SCALE, RoundingMode.HALF_UP);
        return new ProjectAmountSummary(current, planned, paid, current.add(planned).add(paid));
    }

    BigDecimal toPlannedKrw(Bitemm item) {
        BigDecimal rawPlanned = nvl(item.getMplAmt());
        return isForeign(item.getCurC())
                ? rawPlanned.multiply(requirePositiveXcr(item)).setScale(SCALE, RoundingMode.HALF_UP)
                : rawPlanned.setScale(SCALE, RoundingMode.HALF_UP);
    }
}
```

`isForeign`은 `curC != null && !"KRW".equalsIgnoreCase(curC)`로 판정한다. 외화 품목의 `XCR`이 null 또는 0 이하이면 `IllegalArgumentException("외화 품목의 유효한 환율이 필요합니다.")`을 던진다.

- [ ] **Step 4: 단위 테스트 통과 확인**

Run: `./gradlew test --tests 'com.kdb.it.domain.budget.project.service.ProjectAmountCalculatorTest'`

Expected: PASS.

- [ ] **Step 5: 백엔드 계산기 작업 커밋**

```powershell
git add -- src/main/java/com/kdb/it/domain/budget/project/service/ProjectAmountCalculator.java src/main/java/com/kdb/it/domain/budget/project/service/ProjectAmountSummary.java src/test/java/com/kdb/it/domain/budget/project/service/ProjectAmountCalculatorTest.java
git commit -m "refactor(project): 사업 금액 계산 계약 통합"
```

---

### Task 2: 품목 입력과 저장 의미 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectItemSynchronizer.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bitemm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BitemmL.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceCoverageTest.java`

**Interfaces:**
- Consumes: 품목 요청 `amt`, `fcAmt`, `mplAmt`, `curC`와 서버 조회 환율
- Produces: `AMT`는 당해 원화, `FC_AMT`는 외화 당해 원금, `MPL_AMT`는 입력 통화 예정 원금인 `Bitemm`

- [ ] **Step 1: `MPL_AMT > AMT` 보존 및 음수 거부 테스트로 기존 clamp 계약 교체**

```java
@Test
@DisplayName("createProject: 예정금액이 당해 요청금액보다 커도 그대로 저장한다")
void createProject_preservesPlannedAmountAboveCurrentAmount() {
    ProjectDto.BitemmDto item = itemDto("101", new BigDecimal("100"), new BigDecimal("500"));
    ProjectDto.CreateRequest request = createRequestWithItems(List.of(item));

    service.createProject(request, userDetails);

    Bitemm saved = savedItem();
    assertThat(saved.getAmt()).isEqualByComparingTo("100");
    assertThat(saved.getMplAmt()).isEqualByComparingTo("500");
}

@Test
@DisplayName("createProject: 음수 예정금액은 자동 보정하지 않고 거부한다")
void createProject_rejectsNegativePlannedAmount() {
    ProjectDto.BitemmDto item = itemDto("101", new BigDecimal("100"), new BigDecimal("-1"));

    assertThatThrownBy(() -> service.createProject(createRequestWithItems(List.of(item)), userDetails))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("예정금액은 0 이상");
}
```

기존 `createProject: 품목 mplAmt가 amt를 초과하면 amt로 클램프된다` 및 `clampMpl` 테스트는 삭제하지 말고 위 새 의미 테스트로 교체하여 의미 변경을 diff에서 분명히 남긴다.

- [ ] **Step 2: 관련 테스트가 기존 clamp 동작 때문에 실패하는지 확인**

Run:

```powershell
./gradlew test --tests 'com.kdb.it.domain.budget.project.service.ProjectServiceTest' --tests 'com.kdb.it.domain.budget.project.service.ProjectServiceCoverageTest'
```

Expected: `MPL_AMT`가 `AMT`로 축소되어 FAIL.

- [ ] **Step 3: clamp 제거와 명시적 검증 구현**

`ProjectItemSynchronizer`에 다음 정규화 함수를 두고 신규·수정 경로에서 공통 사용한다.

```java
private static BigDecimal normalizePlannedAmount(BigDecimal mplAmt) {
    if (mplAmt == null) return BigDecimal.ZERO;
    if (mplAmt.signum() < 0) {
        throw new IllegalArgumentException("예정금액은 0 이상이어야 합니다.");
    }
    return mplAmt;
}
```

`clampMpl(mplAmt, amt)` 호출 두 곳을 `normalizePlannedAmount(mplAmt)`로 교체하고 `MPL_AMT <= AMT` JavaDoc·Schema 설명을 제거한다. `Bitemm`, `ProjectDto.BitemmDto`, `BitemmL`에는 원화·외화 저장 의미를 동일하게 기록한다.

- [ ] **Step 4: 품목 저장 회귀 테스트 통과 확인**

Run: `./gradlew test --tests 'com.kdb.it.domain.budget.project.service.ProjectService*Test'`

Expected: PASS.

- [ ] **Step 5: 품목 의미 전환 커밋**

```powershell
git add -- src/main/java/com/kdb/it/domain/budget/project/service/ProjectItemSynchronizer.java src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java src/main/java/com/kdb/it/domain/budget/project/entity/Bitemm.java src/main/java/com/kdb/it/domain/log/entity/BitemmL.java src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceCoverageTest.java
git commit -m "refactor(project): 품목 예정금액을 독립 금액으로 저장"
```

---

### Task 3: 사업 스냅샷과 API 응답 계약 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BprojmL.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java`

**Interfaces:**
- Consumes: Task 1의 `ProjectAmountCalculator.calculate(Collection<Bitemm>, BigDecimal)`
- Produces: `tyyBgAmt=currentRequestAmt`, `mplAmt=plannedAmt`, `dfrAmt=paidAmt/null`, `prjBgAmt=totalRequiredAmt`

- [ ] **Step 1: 스냅샷 합계와 응답 불변식 실패 테스트 작성**

```java
@Test
@DisplayName("사업 스냅샷은 당해·원화환산 예정·지급금액의 합으로 총소요금액을 저장한다")
void applyAmountSnapshot_includesPlannedAndPaidAmounts() {
    givenActiveItems(krwItem("100", "500"), usdItem("140000", "50", "1400"));
    Bprojm project = existingProjectWithDfrAmt(new BigDecimal("20"));

    invokeApplyAmountSnapshot(project, new BigDecimal("20"));

    assertThat(project.getTotRqmAmt()).isEqualByComparingTo("210620.000");
    assertThat(project.getMplAmt()).isEqualByComparingTo("70500.000");
    assertThat(project.getDfrAmt()).isEqualByComparingTo("20.000");
}

@Test
@DisplayName("응답의 당해 요청금액은 예정금액을 차감하지 않는다")
void applyBudgetSummary_currentAmountIsSumOfAmt() {
    ProjectDto.Response response = ProjectDto.Response.builder().build();

    service.applyBudgetSummary(response, List.of(krwItem("100", "500")));

    assertThat(response.getTyyBgAmt()).isEqualByComparingTo("100");
}
```

- [ ] **Step 2: 테스트가 기존 `SUM(AMT)` 총액과 `AMT-MPL` 당해식 때문에 실패하는지 확인**

Run:

```powershell
./gradlew test --tests 'com.kdb.it.domain.budget.project.service.ProjectBudgetSummaryServiceTest' --tests 'com.kdb.it.domain.budget.project.service.ProjectServiceTest'
```

Expected: 총소요금액 또는 당해 요청금액 assertion FAIL.

- [ ] **Step 3: `ProjectService`가 중앙 계산기로 스냅샷을 저장하도록 변경**

`ProjectAmountCalculator`를 생성자 주입하고 기존 `AmountSnapshot` 계산을 다음 흐름으로 교체한다.

```java
List<Bitemm> activeItems = itemRepository.findByAbusMngNoAndDelYn(project.getAbusMngNo(), "N");
ProjectAmountSummary amounts = projectAmountCalculator.calculate(activeItems, dfrAmt);
project.assignAmountSnapshot(
        amounts.totalRequiredAmt(),
        amounts.plannedAmt(),
        dfrAmt);
```

`DFR_AMT <= snapshot.totRqmAmt()` 상한 검증과 반입 데이터 예외 분기를 제거한다. 음수 `DFR_AMT` 검증은 유지한다. `assignDeclaredAmounts` 이관 전용 경로가 남아 있으면 신규 계약의 원화 선언값만 받는다는 JavaDoc을 추가하되 기존 데이터 변환 로직은 만들지 않는다.

- [ ] **Step 4: 응답 요약식을 중앙 계약으로 변경**

`ProjectBudgetSummaryService`에서 다음을 적용한다.

```java
response.setTyyBgAmt(totalAmt);
response.setMplCpitAmt(mplCpitKrw);
response.setMplMngcAmt(mplMngcKrw);
response.setMplAmt(mplCpitKrw.add(mplMngcKrw));
response.setPrjBgAmt(totalAmt.add(response.getMplAmt()).add(nvl(response.getDfrAmt())));
```

외화 예정금액의 비목별 합산도 Task 1의 package-private `ProjectAmountCalculator.toPlannedKrw(Bitemm)`를 재사용한다. 계산식을 서비스에 복제하지 않는다. 저장 스냅샷이 있으면 `prjBgAmt/mplAmt/dfrAmt`에 사용하고 `tyyBgAmt`는 `totRqmAmt-mplAmt-dfrAmt`로 복원하되 결과가 음수면 데이터 불변식 위반으로 기록하고 0으로 숨기지 않는다.

- [ ] **Step 5: OpenAPI 계약 설명과 테스트 갱신**

`ProjectDto.Response`의 네 필드 설명을 다음 의미로 바꾸고 계약 테스트에서 required/nullable뿐 아니라 Schema description 키워드를 검증한다.

```java
assertThat(property(schema, "tyyBgAmt").getDescription()).contains("당해 요청금액");
assertThat(property(schema, "mplAmt").getDescription()).contains("원화 환산");
assertThat(property(schema, "prjBgAmt").getDescription()).contains("총소요금액");
```

- [ ] **Step 6: 프로젝트 도메인 테스트 통과 확인**

Run:

```powershell
./gradlew test --tests 'com.kdb.it.domain.budget.project.*' --tests 'com.kdb.it.architecture.ApiResponseOpenApiContractTest'
```

Expected: PASS.

- [ ] **Step 7: 스냅샷·API 계약 커밋**

```powershell
git add -- src/main/java/com/kdb/it/domain/budget/project src/main/java/com/kdb/it/domain/log/entity/BprojmL.java src/test/java/com/kdb/it/domain/budget/project src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java
git commit -m "refactor(project): 사업 금액 스냅샷 의미 정렬"
```

---

### Task 4: 협의회와 예산작업의 예정금액 이중 차감 제거

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetSummaryService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetProjectSummaryService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetSummaryServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetProjectSummaryServiceTest.java`

**Interfaces:**
- Consumes: Task 3의 `tyyBgAmt=SUM(AMT)` 계약과 `BPROJM.TOT_RQM_AMT` 스냅샷
- Produces: 협의회·비목별·사업별 편성 결과에서 예정금액을 차감하지 않은 당해 금액

- [ ] **Step 1: 기존 MPL 차감 테스트를 음성 회귀 테스트로 교체**

```java
@Test
@DisplayName("예산작업 - 품목 예정금액이 있어도 당해 편성요청액에서 차감하지 않는다")
void summary_doesNotSubtractPlannedAmount() {
    givenApprovedItem("101", new BigDecimal("2000"), new BigDecimal("800"));

    BudgetWorkDto.SummaryResponse response = service.getSummary("2026");

    assertThat(findItem(response, "101").requestAmount()).isEqualByComparingTo("2000");
}

@Test
@DisplayName("사업별 편성 결과는 예정금액 비율을 적용하지 않는다")
void projectSummary_doesNotApplyPlannedFactor() {
    givenBudgetItem("PRJ-001", "101", new BigDecimal("2000"), new BigDecimal("800"));

    BudgetWorkDto.ProjectSummaryResponse response = service.getProjectSummary("2026");

    assertThat(response.items().getFirst().requestAmount()).isEqualByComparingTo("2000");
}
```

- [ ] **Step 2: 테스트가 기존 차감 로직 때문에 실패하는지 확인**

Run:

```powershell
./gradlew test --tests 'com.kdb.it.domain.budget.work.service.BudgetSummaryServiceTest' --tests 'com.kdb.it.domain.budget.work.service.BudgetProjectSummaryServiceTest'
```

Expected: 실제값 1200 등으로 FAIL.

- [ ] **Step 3: 예산작업 비목별 MPL 조정 제거**

`BudgetSummaryService`에서 `mplRequestAdjustment`, `mplBudgetAdjustment`, `computeMplAdjustment`와 두 subtract를 제거한다. 요청금액은 승인된 원본 당해금액 합계, 편성액은 저장된 당해 편성액 합계만 사용한다. 차감 때문에 존재한 0 하한 보정은 제거하되 다른 독립적인 음수 방어는 유지한다.

- [ ] **Step 4: 사업별 MPL factor 제거**

`BudgetProjectSummaryService`에서 `computeMplFactors`, `mplFactorByGroup`과 factor 적용 블록을 제거한다. 사업별 요청·편성 금액에는 `reverseRequestAmount(budget)`와 `bgDupAmt`를 그대로 합산한다.

- [ ] **Step 5: 협의회 당해금액을 새 계약으로 전환**

`CouncilService`의 `deriveCurrentYearBudget(s)`에서 `ProjectBudgetSummaryService`를 계속 사용할 경우 반환값이 `SUM(AMT)`인지 테스트한다. 목록 프로젝션이 `BPROJM` 스냅샷을 이미 가져올 수 있다면 배치 품목 조회 대신 `totRqmAmt-mplAmt-NVL(dfrAmt,0)`을 repository projection에서 반환하도록 최적화하되, 두 계산 경로를 함께 유지하지 않는다.

```java
assertThat(response.prjBg()).isEqualByComparingTo("2000");
```

- [ ] **Step 6: 연계 서비스 테스트 통과 확인**

Run:

```powershell
./gradlew test --tests 'com.kdb.it.domain.budget.work.*' --tests 'com.kdb.it.domain.council.service.CouncilServiceTest'
```

Expected: PASS.

- [ ] **Step 7: 연계 집계 커밋**

```powershell
git add -- src/main/java/com/kdb/it/domain/budget/work/service/BudgetSummaryService.java src/main/java/com/kdb/it/domain/budget/work/service/BudgetProjectSummaryService.java src/main/java/com/kdb/it/domain/council/service/CouncilService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetSummaryServiceTest.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetProjectSummaryServiceTest.java src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java
git commit -m "fix(budget): 품목 예정금액 이중 차감 제거"
```

---

### Task 5: 계속사업 생성 시 금액 자동 이월 제거

**Files:**
- Modify: `it_frontend/app/features/project/useContinueProjectSearch.ts`
- Test: `it_frontend/tests/unit/features/project/useContinueProjectSearch.test.ts`

**Interfaces:**
- Consumes: 전년도 사업 상세의 품목 정보
- Produces: 비금액 정보만 복사하고 `gclAmt=0`, `fcAmt=null`, `laterAmt=0`, `gclMngNo=null`인 신규 품목 draft

- [ ] **Step 1: 금액 미복사 실패 테스트 작성**

```ts
it('계속사업 선택 시 전년도 금액은 복사하지 않고 비금액 정보만 유지한다', async () => {
    mockDetail.items = [{
        gclMngNo: 'GCL-OLD', gclNm: '서버', curC: 'USD', amt: 1_400_000,
        fcAmt: 1_000, mplAmt: 500, ioeC: '101', xcr: 1_400,
    }];

    await selectContinueProject(mockDetail.abusMngNo);

    expect(draft.value.resources[0]).toMatchObject({
        itemName: '서버', currency: 'USD', gclAmt: 0, fcAmt: null,
        laterAmt: 0, gclMngNo: null,
    });
});
```

- [ ] **Step 2: 기존 금액 복사로 테스트가 실패하는지 확인**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/features/project/useContinueProjectSearch.test.ts
```

Expected: `gclAmt`, `laterAmt`가 전년도 값이어서 FAIL.

- [ ] **Step 3: 계속사업 draft 금액 초기화 구현**

```ts
gclAmt: 0,
fcAmt: null,
laterAmt: 0,
xcr: item.xcr,
gclMngNo: null,
```

통화와 환율 표시는 입력 편의를 위해 유지하되 저장 시 서버가 환율을 재조회한다는 기존 계약을 유지한다. 수량·단가가 금액을 자동 복원한다면 해당 값도 0으로 초기화하여 `gclAmt`가 재계산되지 않게 한다.

- [ ] **Step 4: 계속사업 테스트 통과 확인**

Run: `npm test -- tests/unit/features/project/useContinueProjectSearch.test.ts`

Expected: PASS.

- [ ] **Step 5: 프론트 계속사업 작업 커밋**

```powershell
git add -- app/features/project/useContinueProjectSearch.ts tests/unit/features/project/useContinueProjectSearch.test.ts
git commit -m "fix(project): 계속사업 금액 자동 이월 제거"
```

---

### Task 6: 프론트 금액 표시·입력·보고서 의미 정렬

**Files:**
- Modify: `it_frontend/app/composables/useProjects.ts`
- Modify: `it_frontend/app/features/project/useProjectFormSave.ts`
- Modify: `it_frontend/app/features/project/useProjectFormLoad.ts`
- Modify: `it_frontend/app/components/projects/ProjectResourceTable.vue`
- Modify: `it_frontend/app/pages/info/projects/index.vue`
- Modify: `it_frontend/app/pages/info/projects/[id].vue`
- Modify: `it_frontend/app/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts`
- Modify: `it_frontend/app/features/approval/forms/itBudget/pdf/projectSection.ts`
- Modify: `it_frontend/i18n/messages/project.ts`
- Modify: `it_frontend/app/types/api.d.ts` via codegen
- Test: `it_frontend/tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts`
- Test: `it_frontend/tests/e2e/projects.spec.ts`

**Interfaces:**
- Consumes: Task 3의 사업·품목 API 계약
- Produces: 당해 요청금액에는 `tyyBgAmt`, 총소요금액에는 `prjBgAmt`를 쓰는 UI·Excel·PDF

- [ ] **Step 1: 타입 주석과 보고서 기대값 실패 테스트 작성**

```ts
it('승인 보고서의 소요예산은 총소요금액을 사용한다', async () => {
    const project = baseProject({ tyyBgAmt: 100, mplAmt: 500, dfrAmt: 20, prjBgAmt: 620 });

    const document = await generateReport([project], approvalLine, []);

    expect(extractText(document)).toContain('620');
    expect(extractText(document)).toContain('100');
});
```

E2E fixture에는 서로 다른 값 `tyyBgAmt=100`, `mplAmt=500`, `dfrAmt=20`, `prjBgAmt=620`을 사용해 필드 혼용을 탐지한다.

- [ ] **Step 2: 프론트 관련 테스트가 기존 `tyyBgAmt=총 예산` 사용 때문에 실패하는지 확인**

Run:

```powershell
npm test -- tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts
```

Expected: 총소요금액 위치에 100이 표시되어 FAIL.

- [ ] **Step 3: 품목 폼의 독립 금액 의미 정리**

`useProjectFormSave.ts`는 다음 payload 의미를 유지하되 주석과 화면 검증을 새 계약으로 바꾼다.

```ts
amt: item.gclAmt,       // 당해 요청금액 원화(외화는 서버가 fcAmt*xcr로 덮어씀)
fcAmt: item.curC === 'KRW' ? null : item.foreignCurrentAmt,
mplAmt: item.laterAmt,  // 원화 행은 원화, 외화 행은 외화 원금
```

현재 resource draft에 외화 당해금액 전용 필드가 없다면 기존 `getCurrencyAmount`와 실제 타입을 따라 `gclAmt/fcAmt` 매핑을 유지한다. 새 중복 상태를 추가하지 않는다. `laterAmt <= gclAmt` 검증이 있으면 제거하고 음수만 금지한다.

- [ ] **Step 4: 목록·상세·PDF 의미와 번역 라벨 변경**

```text
tyyBgAmt → 당해 요청금액
mplAmt   → 내년 이후 예정금액
dfrAmt   → 기 지급금액
prjBgAmt → 총소요금액
```

`projects/index.vue`의 표와 Excel에서 현재 “총 예산”으로 노출하는 컬럼은 라벨을 “총소요금액”으로 바꾸고 값 필드를 `prjBgAmt`로 변경한다. 별도 “당해 요청금액” 컬럼을 유지하거나 추가하는 경우에만 `tyyBgAmt`를 사용한다. 상세 카드의 총액은 `prjBgAmt`, 분해 항목은 `tyyBgAmt/mplAmt/dfrAmt`를 사용한다. 승인 PDF의 “소요예산”은 전체 사업 규모이므로 `prjBgAmt`를 사용하고 당해 편성표는 `tyyBgAmt`를 유지한다.

- [ ] **Step 5: OpenAPI 타입 재생성**

백엔드를 로컬 프로파일로 기동한 상태에서 실행한다.

Run: `npm run codegen`

Expected: `app/types/api.d.ts`의 필드 타입은 유지되고 description만 새 의미로 갱신됨.

- [ ] **Step 6: 프론트 단위·E2E 대상 테스트 통과 확인**

Run:

```powershell
npm test -- tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts tests/unit/composables/useBudgetListPage.test.ts tests/unit/composables/useBudgetApprovalPage.test.ts
npx playwright test tests/e2e/projects.spec.ts
```

Expected: PASS.

- [ ] **Step 7: 프론트 의미 정렬 커밋**

```powershell
git add -- app/composables/useProjects.ts app/features/project/useProjectFormSave.ts app/features/project/useProjectFormLoad.ts app/components/projects/ProjectResourceTable.vue app/pages/info/projects/index.vue 'app/pages/info/projects/[id].vue' app/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts app/features/approval/forms/itBudget/pdf/projectSection.ts i18n/messages/project.ts app/types/api.d.ts tests/unit/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.test.ts tests/e2e/projects.spec.ts
git commit -m "refactor(project): 당해금액과 총소요금액 표시 구분"
```

---

### Task 7: DB 검증과 영속성 문서 계약 갱신

**Files:**
- Create: `it_database/docs/verification/project-amount-semantics.sql`
- Modify: `it_backend/docs/guides/persistence/data-model.md`
- Modify: `it_backend/docs/guides/domains/project-execution.md`
- Modify: `meta/table.txt`

**Interfaces:**
- Consumes: Task 1~4의 최종 계산 계약
- Produces: 신규 데이터의 불변식 위반 건수만 출력하는 Oracle 검증 SQL과 문서 SoT

- [ ] **Step 1: 검증 SQL 작성**

`project-amount-semantics.sql`은 업무 본문을 출력하지 않고 아래 네 건수만 출력한다.

```sql
SELECT 'NEGATIVE_AMOUNT' AS CHECK_NAME, COUNT(*) AS ERROR_COUNT
  FROM TPRMPP_BITEMM
 WHERE DEL_YN = 'N'
   AND (NVL(AMT, 0) < 0 OR NVL(MPL_AMT, 0) < 0 OR NVL(FC_AMT, 0) < 0)
UNION ALL
SELECT 'FOREIGN_REQUIRED_FIELD', COUNT(*)
  FROM TPRMPP_BITEMM
 WHERE DEL_YN = 'N'
   AND CUR_C <> 'KRW'
   AND (FC_AMT IS NULL OR XCR IS NULL OR XCR <= 0)
UNION ALL
SELECT 'KRW_FC_AMOUNT', COUNT(*)
  FROM TPRMPP_BITEMM
 WHERE DEL_YN = 'N' AND CUR_C = 'KRW' AND FC_AMT IS NOT NULL;
```

사업 스냅샷 검증은 활성 최신 품목을 사업별로 집계한 CTE를 사용한다.

```sql
WITH item_sum AS (
    SELECT ABUS_MNG_NO,
           SUM(NVL(AMT, 0)) AS CURRENT_AMT,
           SUM(CASE WHEN CUR_C IS NULL OR CUR_C = 'KRW'
                    THEN NVL(MPL_AMT, 0)
                    ELSE ROUND(NVL(MPL_AMT, 0) * XCR, 3) END) AS PLANNED_AMT
      FROM TPRMPP_BITEMM
     WHERE DEL_YN = 'N' AND LST_YN = 'Y'
     GROUP BY ABUS_MNG_NO
)
SELECT 'PROJECT_SNAPSHOT', COUNT(*) AS ERROR_COUNT
  FROM TPRMPP_BPROJM p
  LEFT JOIN item_sum i ON i.ABUS_MNG_NO = p.ABUS_MNG_NO
 WHERE p.DEL_YN = 'N' AND p.LST_YN = 'Y'
   AND (NVL(p.MPL_AMT, 0) <> NVL(i.PLANNED_AMT, 0)
        OR NVL(p.TOT_RQM_AMT, 0) <>
           NVL(i.CURRENT_AMT, 0) + NVL(i.PLANNED_AMT, 0) + NVL(p.DFR_AMT, 0));
```

- [ ] **Step 2: 문서와 메타데이터 의미 갱신**

`meta/table.txt`의 물리명·논리명은 유지하고 별도 설명 열이 없다면 파일 형식을 변경하지 않는다. 대신 데이터 모델 가이드에 다음 표를 추가한다.

```text
BITEMM.AMT: 당해 요청금액 원화
BITEMM.FC_AMT: 외화 품목의 당해 요청금액 외화 원금
BITEMM.MPL_AMT: 원화 행은 원화, 외화 행은 외화 원금
BPROJM.MPL_AMT/DFR_AMT/TOT_RQM_AMT: 원화
```

적용된 과거 Flyway 파일은 수정하지 않는다. 컬럼 타입·nullability 변경이 없으므로 신규 DDL 마이그레이션도 만들지 않는다.

- [ ] **Step 3: SQL 정적 검토와 문서 diff 확인**

Run:

```powershell
cd C:\it
git diff --check -- meta/table.txt it_backend/docs/guides/persistence/data-model.md it_backend/docs/guides/domains/project-execution.md it_database/docs/verification/project-amount-semantics.sql
rg -n -S "AMT.*당해|MPL_AMT|TOT_RQM_AMT" it_backend/docs/guides meta/table.txt it_database/docs/verification/project-amount-semantics.sql
```

Expected: whitespace 오류 없음, 새 의미가 문서와 검증 SQL에 존재함.

- [ ] **Step 4: 각 저장소별 문서 커밋**

백엔드:

```powershell
cd C:\it\it_backend
git add -- docs/guides/persistence/data-model.md docs/guides/domains/project-execution.md
git commit -m "docs(project): 정보화사업 금액 계약 명시"
```

DB:

```powershell
cd C:\it\it_database
git add -- docs/verification/project-amount-semantics.sql
git commit -m "test(db): 정보화사업 금액 불변식 검증 추가"
```

루트 `meta/table.txt`는 현재 사용자 변경과 겹칠 수 있다. 설명을 실제로 변경한 경우에만 자기 hunk를 `git add -p meta/table.txt`로 스테이징하고, 변경할 설명 필드가 없다면 커밋 대상에서 제외한다.

---

### Task 8: 전체 회귀 검증과 호환 버전 기록

**Files:**
- Modify: `versions.lock` via `scripts/update-versions-lock.ps1`
- Modify: `TASK.md` 또는 `TASK_DONE.md` only if an existing tracked task explicitly corresponds to this refactor

**Interfaces:**
- Consumes: Task 1~7의 모든 결과
- Produces: 세 저장소 Health Stack 통과와 호환 커밋 조합 기록

- [ ] **Step 1: 잔존 구 의미 검색**

Run:

```powershell
cd C:\it
rg -n -S "∑AMT − ∑MPL_AMT|AMT의 일부|0 ≤ MPL_AMT ≤ AMT|MPL 차감|clampMpl|mplFactorByGroup|mplRequestAdjustment" it_backend it_frontend it_database meta -g '!**/build/**' -g '!**/node_modules/**'
```

Expected: 과거 마이그레이션 설명을 제외한 운영 코드·현재 문서·활성 테스트에서 결과 0건. 과거 마이그레이션은 적용 이력 보존을 위해 수정하지 않는다.

- [ ] **Step 2: 백엔드 전체 검증**

Run:

```powershell
cd C:\it\it_backend
./gradlew test
./gradlew check
./gradlew bootJar
```

Expected: 세 명령 모두 exit code 0.

- [ ] **Step 3: 프론트엔드 전체 검증**

Run:

```powershell
cd C:\it\it_frontend
npm run format:check
npm run check
npm test
npm run codegen:check
npm run test:e2e
```

Expected: 모든 명령 exit code 0.

- [ ] **Step 4: 신규 데이터 환경에서 DB 검증 실행**

Oracle 비밀번호를 명령행에 넣지 않고 승인된 콘솔 프롬프트 또는 Wallet 별칭으로 `it_database/docs/verification/project-amount-semantics.sql`을 실행한다.

Expected: `NEGATIVE_AMOUNT`, `FOREIGN_REQUIRED_FIELD`, `KRW_FC_AMOUNT`, `PROJECT_SNAPSHOT`의 `ERROR_COUNT`가 모두 0.

기존 데이터 삭제는 이 단계에서 실행하지 않는다. 사용자가 별도로 대상·백업·실행 시점을 승인한 초기화 절차가 완료된 환경만 검증한다.

- [ ] **Step 5: 호환 버전 기록 갱신**

Run:

```powershell
cd C:\it
./scripts/update-versions-lock.ps1
git diff -- versions.lock
```

Expected: 백엔드·프론트엔드·DB의 이번 작업 커밋 조합이 기록됨.

- [ ] **Step 6: 루트 문서 커밋**

```powershell
git add -- versions.lock
git diff --cached --stat
git diff --cached --check
git commit -m "chore: 금액 의미 리팩토링 호환 버전 기록"
```

`TASK.md`, `TASK_DONE.md`, `meta/table.txt`에 기존 사용자 변경이 있으면 이번 작업 hunk만 `git add -p`로 분리하고 무관한 변경은 커밋하지 않는다.

---

## 실행 완료 체크

- [ ] `MPL_AMT > AMT`가 백엔드와 프론트에서 정상 저장된다.
- [ ] 외화 예정금액은 동일 품목 `XCR`로 원화 환산된다.
- [ ] `BPROJM.TOT_RQM_AMT = tyyBgAmt + mplAmt + NVL(dfrAmt,0)`이다.
- [ ] 협의회·예산작업에서 예정금액을 당해금액에서 차감하지 않는다.
- [ ] 계속사업 생성 시 금액이 복사되지 않는다.
- [ ] 목록·상세·Excel·PDF가 당해 요청금액과 총소요금액을 구분한다.
- [ ] 데이터 삭제를 실행하지 않고 신규 계약 검증 SQL만 제공한다.
- [ ] 백엔드·프론트엔드 Health Stack과 DB 불변식 검증이 모두 통과한다.
