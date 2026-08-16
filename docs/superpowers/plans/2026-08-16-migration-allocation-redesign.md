# 데이터 일괄 반입의 편성 전용 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/migration`(데이터 일괄 반입)을 원장 생성에서 편성금액 계산 전용으로 전환해, 편성요청서 반입(1단계) 이후에도 실행 가능하게 만든다.

**Architecture:** 요청 원장(`BPROJM`·`BITEMM`·`BCOSTM`)은 `/admin/migration/requests` 전용으로 두고, `/admin/migration`은 종합본·조정본의 각 행을 기존 원장에 매칭한 뒤 **실효 편성률**(소수)을 계산해 `BBUGTM`에만 쓴다. 실효 편성률 = 비목그룹 목표액 ÷ 요청 품목 합계 × 100이며, 이 한 식이 (a) 조정비율 그대로, (b) 종합본 취합 조정, (c) 하반기 확정금액 세 경우를 모두 표현한다.

**Tech Stack:** Java 25 / Spring Boot 4.1 / JPA·QueryDSL / Oracle, Nuxt 4 + Vue 3 Composition API + TypeScript + PrimeVue

**설계 문서:** `docs/superpowers/specs/2026-08-16-migration-allocation-redesign-design.md`

## Global Constraints

- 모든 신규 주석(JavaDoc/TSDoc/인라인)은 한글. public API·service 메서드에는 입력값과 실패 조건을 함께 기록한다.
- 응답 DTO의 모든 속성에 `@Schema(requiredMode = REQUIRED)`를 지정하고, null이 올 수 있는 속성만 `nullable = true`를 추가한다. `allowableValues`가 있는 속성은 값 집합을 갱신한다.
- 백엔드 시그니처가 바뀌면 프론트 `app/types/api.d.ts`를 `npm run codegen`으로 재생성하고 `npm run codegen:check`를 통과시킨다.
- 사용자에게 보이는 고정 문구는 `it_frontend/app/i18n/messages/{도메인}.ts`에 두고, `scripts/user-facing-copy-baselines.mjs` 기준선을 **현재 건수로 낮춘다**(올리거나 새 경로를 추가하지 않는다).
- 운영 `.ts`·`.vue` 파일은 800줄(`MAX_NEW_FILE_LINES`)을 넘지 않는다.
- DDL 변경 없음. Flyway 스크립트를 추가하지 않는다. `TPRMPP_BBUGTM.ASG_RT`와 `TPRMPP_BBUGTL.ASG_RT`는 이미 물리적으로 `NUMBER(8,5)`다(실측 확인).
- `git add`는 **경로를 명시**한다. `git add -A`·`git add .`·`git commit -a`를 쓰지 않는다. 커밋 직전 `git diff --cached --stat`으로 목록을 확인한다.
- 백엔드 테스트는 `cd it_backend`를 항상 앞에 붙인다(백그라운드 셸이 cwd를 상속하지 않음). 파일 락이 나면 `--no-daemon`을 붙인다.
- `it_backend`·`it_frontend`는 각각 독립 git 저장소다. 커밋은 각 저장소 안에서 한다.

## 용어

| 용어 | 뜻 |
| --- | --- |
| 요청 원장 | `BPROJM`(사업)·`BITEMM`(품목)·`BCOSTM`(전산업무비). 부서가 제출한 요청 |
| 편성행 | `BBUGTM`. 품목·전산업무비 단위의 편성금액(`BG_DUP_AMT`)과 편성률(`ASG_RT`) |
| 종합본 | 편성요구서 종합. `전체취합(국내외)`·`1-1. 26년정보화사업(전산예산반영)`·`2. 위임예산(경상)` 시트 |
| 조정본 | 정보기술부문계획 조정. `26년정보화사업(자본예산)` 시트 |
| 비목그룹 | 종합본의 금액 열 하나에 대응하는 `IOE_C` 집합 (개발비=`103`·`104`, 기계장치=`101`·`102`, 기타무형=`105`·`106`·`107`) |
| 실효 편성률 | 비목그룹 목표액 ÷ 그 그룹 요청 품목 합계 × 100. 소수 5자리 |

---

## Task 1: `ASG_RT`를 `BigDecimal`로 전환

편성률이 정수라 하반기 조정의 `416/1406 = 29.58748%`를 담지 못한다. 물리 컬럼은 이미 `NUMBER(8,5)`이므로 Java 매핑만 바꾼다. `BbugtL`의 `precision=3, scale=0` 매핑은 물리와 어긋난 오류라 함께 정정한다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/entity/Bbugtm.java:85-106`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BbugtL.java:46-47`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BudgetReadView.java:19`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/dto/BudgetWorkDto.java:96,146,210`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetSummaryService.java:65-69,226`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetProjectSummaryService.java:77-81`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetRateApplicationService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetRateApplicationServiceTest.java`

**Interfaces:**
- Produces:
  - `Bbugtm.getAsgRt(): BigDecimal`, `Bbugtm.update(BigDecimal bgDupAmt, BigDecimal asgRt): void`
  - `BudgetReadView.getAsgRt(): BigDecimal`
  - `BudgetWorkDto.IoeCategoryResponse.dupRt: BigDecimal`, `SummaryItem.dupRt: BigDecimal`, `ProjectSummaryCategory.dupRt: BigDecimal`
  - `BudgetWorkDto.ItemRate.assetDupRt: Integer`, `costDupRt: Integer` — **변경 없음**(`/budget/work`가 정수를 보낸다)

- [ ] **Step 1: 소수 편성률이 왕복하는 실패 테스트를 쓴다**

`BudgetRateApplicationServiceTest.java` 끝에 추가한다. 기존 테스트의 목(mock) 준비 방식을 그대로 따른다.

```java
@Test
@DisplayName("applyItemRates_소수편성률_저장값이_소수로_보존된다")
void applyItemRates_소수편성률_저장값이_소수로_보존된다() {
    // 이 테스트는 Task 2에서 ioeRates 경로로 옮겨간다. 여기서는 엔티티 계약만 고정한다.
    Bbugtm budget =
            Bbugtm.builder()
                    .bgNo("BG-2026-0001")
                    .sno(1)
                    .bseYy("2026")
                    .fntTbNm("BITEMM")
                    .pkColNm("GCL-2026-0001")
                    .fntTbCrySno(1)
                    .ioeC("106")
                    .bgDupAmt(new BigDecimal("416000000.000"))
                    .asgRt(new BigDecimal("29.58748"))
                    .build();

    assertThat(budget.getAsgRt()).isEqualByComparingTo("29.58748");

    budget.update(new BigDecimal("984000000.000"), new BigDecimal("70.00000"));
    assertThat(budget.getAsgRt()).isEqualByComparingTo("70.00000");
    assertThat(budget.getBgDupAmt()).isEqualByComparingTo("984000000.000");
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetRateApplicationServiceTest"
```

Expected: 컴파일 실패 — `asgRt(BigDecimal)` 빌더 인자 타입 불일치, `update(BigDecimal, BigDecimal)` 없음

- [ ] **Step 3: `Bbugtm`의 편성률 타입을 바꾼다**

`Bbugtm.java:85-106`을 교체한다.

```java
    /**
     * 편성률: 0~100 범위의 소수 5자리.
     *
     * <p>물리컬럼 ASG_RT(메타표준=배정률)은 NUMBER(8,5)다. 종전에는 Integer로 매핑했으나, 하반기 계획 조정의 확정 편성금액
     * (예: 요청 1,406에 대한 편성 416)은 29.58748%처럼 정수로 담기지 않는다. 물리 스케일을 그대로 쓰면
     * `요청금액 × 편성률 = 편성금액` 불변식이 확정금액 조정에서도 성립한다.
     */
    @Column(name = "ASG_RT", precision = 8, scale = 5, comment = "편성률 (물리컬럼 ASG_RT=배정률)")
    private BigDecimal asgRt;

    /**
     * 편성 정보 업데이트 메서드
     *
     * <p>JPA Dirty Checking을 활용하여 트랜잭션 내에서 편성예산과 편성률을 변경합니다. Upsert 시 기존 레코드가 존재하면 이 메서드로 UPDATE
     * 처리합니다.
     *
     * @param bgDupAmt 편성예산 (요청금액 × 편성률/100)
     * @param asgRt 편성률 (0~100, 소수 5자리)
     */
    public void update(BigDecimal bgDupAmt, BigDecimal asgRt) {
        this.bgDupAmt = bgDupAmt;
        this.asgRt = asgRt;
    }
```

- [ ] **Step 4: `BbugtL`의 매핑을 물리에 맞춘다**

`BbugtL.java:46-47`을 교체한다.

```java
    @Column(name = "ASG_RT", precision = 8, scale = 5, comment = "편성률")
    private BigDecimal asgRt;
```

`java.math.BigDecimal` import가 이미 있는지 확인하고 없으면 추가한다(같은 파일의 `bgDupAmt`가 쓰고 있으므로 있다).

- [ ] **Step 5: 읽기 프로젝션과 응답 DTO의 타입을 바꾼다**

`BudgetReadView.java:19`:

```java
    BigDecimal getAsgRt();
```

`BudgetWorkDto.java`의 세 곳을 바꾼다.

```java
            // IoeCategoryResponse
            @Schema(description = "기존 편성률 (0~100, 소수 5자리)", nullable = true) BigDecimal dupRt,

            // SummaryItem
            @Schema(description = "편성률 (0~100, 소수 5자리)", nullable = true) BigDecimal dupRt) {}

            // ProjectSummaryCategory
            @Schema(description = "편성률 (0~100, 소수 5자리)", nullable = true) BigDecimal dupRt) {}
```

`SummaryItem`·`ProjectSummaryCategory`의 `dupRt`는 종전에 `nullable`이 없었으나 실제로 null이 올 수 있으므로(대표 편성행이 없는 비목) 함께 명시한다.

- [ ] **Step 6: 두 요약 서비스의 지역변수 타입을 바꾼다**

`BudgetSummaryService.java:65`:

```java
                            BigDecimal rate =
                                    candidates.isEmpty()
                                            ? null
                                            : BudgetRepresentativeSelector.pickView(candidates)
                                                    .getAsgRt();
```

`BudgetProjectSummaryService.java:77`:

```java
        Map<String, BigDecimal> rateByPrefix = new LinkedHashMap<>();
```

컴파일러가 짚는 나머지 지역변수·맵 타입도 같은 방식으로 `BigDecimal`로 바꾼다.

- [ ] **Step 7: `BudgetRateApplicationService`의 계산부를 바꾼다**

`calculateDupBg`와 호출부, `DEFAULT_DUP_RT`를 교체한다.

```java
    private static final BigDecimal DEFAULT_DUP_RT = BigDecimal.valueOf(100);
    private static final BigDecimal PERCENT_BASE = BigDecimal.valueOf(100);

    /**
     * 요청금액에 편성률을 적용해 편성금액을 계산합니다.
     *
     * @param requestAmount 요청금액. null이면 0원
     * @param rate 편성률(0~100, 소수 허용). null이면 0원
     * @return 편성금액. 물리 컬럼 스케일(3)로 반올림합니다
     */
    private BigDecimal calculateDupBg(BigDecimal requestAmount, BigDecimal rate) {
        if (requestAmount == null || rate == null) return BigDecimal.ZERO;
        return requestAmount.multiply(rate).divide(PERCENT_BASE, 3, RoundingMode.HALF_UP);
    }
```

`applyRates`의 `Integer dupRt = rate.dupRt();`는 `BigDecimal dupRt = rate.dupRt() == null ? null : BigDecimal.valueOf(rate.dupRt());`로 바꾼다(`RateItem.dupRt`는 `Integer`를 유지한다).

`applyItemRates`의 `int assetRate`·`int costRate`는 다음으로 바꾼다.

```java
            BigDecimal assetRate =
                    item.assetDupRt() != null
                            ? BigDecimal.valueOf(item.assetDupRt())
                            : DEFAULT_DUP_RT;
            BigDecimal costRate =
                    item.costDupRt() != null
                            ? BigDecimal.valueOf(item.costDupRt())
                            : DEFAULT_DUP_RT;
```

`newBudget`의 `Integer rate` 파라미터도 `BigDecimal rate`로 바꾼다.

- [ ] **Step 8: 테스트를 돌려 통과를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.*"
```

Expected: PASS. 기존 테스트가 `asgRt(100)`·`dupRt(80)` 같은 정수 리터럴을 쓰면 `new BigDecimal("100")`으로 바꾸고, 단정은 `isEqualByComparingTo`를 쓴다(`equals`는 `100` != `100.00000`이라 실패한다).

- [ ] **Step 9: 프론트 타입과 표시를 맞춘다**

`it_frontend/app/types/budget-work.ts`에서 `dupRt` 계열 필드를 `number | null`로 유지하되(JSON 숫자로 내려온다) 주석에 소수 가능성을 남긴다.

`it_frontend/app/composables/budget/useBudgetSummaryRows.ts`와 `app/features/plan/usePlanExcelExport.ts`에서 `dupRt`를 표시하는 지점에 소수 처리를 넣는다. 정수면 그대로, 소수면 둘째 자리까지 보인다.

```ts
/** 편성률 표시. 소수 편성률(확정금액 조정)은 둘째 자리까지 보이고 정수는 그대로 보인다. */
export function formatDupRate(rate: number | null | undefined): string {
    if (rate == null) return '-';
    return Number.isInteger(rate) ? `${rate}` : rate.toFixed(2);
}
```

이 헬퍼는 `it_frontend/app/utils/common.ts`에 두고 두 파일이 import한다.

- [ ] **Step 10: 프론트 검사를 돌린다**

```bash
cd it_frontend && npm run check && npm test
```

Expected: PASS

- [ ] **Step 11: 커밋**

백엔드:

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/work/entity/Bbugtm.java src/main/java/com/kdb/it/domain/log/entity/BbugtL.java src/main/java/com/kdb/it/domain/budget/work/repository/BudgetReadView.java src/main/java/com/kdb/it/domain/budget/work/dto/BudgetWorkDto.java src/main/java/com/kdb/it/domain/budget/work/service/BudgetSummaryService.java src/main/java/com/kdb/it/domain/budget/work/service/BudgetProjectSummaryService.java src/main/java/com/kdb/it/domain/budget/work/service/BudgetRateApplicationService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetRateApplicationServiceTest.java && git diff --cached --stat && git commit -m "refactor: 편성률 ASG_RT를 BigDecimal로 전환"
```

프론트:

```bash
cd it_frontend && git add app/utils/common.ts app/types/budget-work.ts app/composables/budget/useBudgetSummaryRows.ts app/features/plan/usePlanExcelExport.ts && git diff --cached --stat && git commit -m "refactor: 소수 편성률 표시 대응"
```

---

## Task 2: 비목별 편성률(`ioeRates`)을 `applyItemRates`에 추가

종합본은 사업 하나에 개발비·기계장치·기타무형 세 그룹의 서로 다른 실효 편성률을 준다. 현행 `ItemRate`는 자본·일반 2버킷뿐이라 담을 수 없다. `/budget/work` 화면은 계속 2버킷을 쓰므로 선택 필드로 더한다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/dto/BudgetWorkDto.java:70-75`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetRateApplicationService.java:123-210`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetRateApplicationServiceTest.java`

**Interfaces:**
- Consumes: Task 1의 `Bbugtm.update(BigDecimal, BigDecimal)`, `calculateDupBg(BigDecimal, BigDecimal)`
- Produces:
  - `BudgetWorkDto.ItemRate(String orcTb, String orcPkVl, Integer assetDupRt, Integer costDupRt, Map<String, BigDecimal> ioeRates)`
  - `ioeRates`가 null이거나 비어 있으면 종전 2버킷 동작. 값이 있으면 품목의 `IOE_C`로 조회해 적용하고, 맵에 없는 비목은 2버킷으로 떨어진다

- [ ] **Step 1: 비목별 편성률이 적용되는 실패 테스트를 쓴다**

```java
@Test
@DisplayName("applyItemRates_비목별편성률_비목마다_다른_편성률이_적용된다")
void applyItemRates_비목별편성률_비목마다_다른_편성률이_적용된다() {
    Bitemm dev = itemOf("GCL-2026-0001", 1, "103", new BigDecimal("1000"));
    Bitemm hw = itemOf("GCL-2026-0002", 1, "101", new BigDecimal("2000"));
    given(projectItemRepository.findByAbusMngNoAndDelYnAndLstYn("PRJ-2026-0001", "N", "Y"))
            .willReturn(List.of(dev, hw));
    given(bbugtmRepository.nextBgMngNoSeq()).willReturn(1L);

    BudgetWorkDto.ItemRate rate =
            new BudgetWorkDto.ItemRate(
                    "BPROJM",
                    "PRJ-2026-0001",
                    100,
                    100,
                    Map.of(
                            "103", new BigDecimal("70.00000"),
                            "101", new BigDecimal("29.58748")));

    service.applyItemRates(new BudgetWorkDto.ItemApplyRequest("2026", List.of(rate)));

    ArgumentCaptor<Bbugtm> captor = ArgumentCaptor.forClass(Bbugtm.class);
    verify(bbugtmRepository, times(2)).save(captor.capture());
    Map<String, Bbugtm> saved =
            captor.getAllValues().stream()
                    .collect(Collectors.toMap(Bbugtm::getIoeC, Function.identity()));

    assertThat(saved.get("103").getAsgRt()).isEqualByComparingTo("70.00000");
    assertThat(saved.get("103").getBgDupAmt()).isEqualByComparingTo("700.000");
    assertThat(saved.get("101").getAsgRt()).isEqualByComparingTo("29.58748");
    assertThat(saved.get("101").getBgDupAmt()).isEqualByComparingTo("591.750");
}

@Test
@DisplayName("applyItemRates_ioeRates가_비어있으면_종전_2버킷이_적용된다")
void applyItemRates_ioeRates가_비어있으면_종전_2버킷이_적용된다() {
    Bitemm dev = itemOf("GCL-2026-0001", 1, "103", new BigDecimal("1000"));
    given(projectItemRepository.findByAbusMngNoAndDelYnAndLstYn("PRJ-2026-0001", "N", "Y"))
            .willReturn(List.of(dev));
    given(bbugtmRepository.nextBgMngNoSeq()).willReturn(1L);

    service.applyItemRates(
            new BudgetWorkDto.ItemApplyRequest(
                    "2026",
                    List.of(new BudgetWorkDto.ItemRate("BPROJM", "PRJ-2026-0001", 70, 100, null))));

    ArgumentCaptor<Bbugtm> captor = ArgumentCaptor.forClass(Bbugtm.class);
    verify(bbugtmRepository).save(captor.capture());
    assertThat(captor.getValue().getAsgRt()).isEqualByComparingTo("70");
    assertThat(captor.getValue().getBgDupAmt()).isEqualByComparingTo("700.000");
}
```

`itemOf`는 이 테스트 클래스에 이미 있는 헬퍼를 재사용하고, 없으면 다음을 추가한다.

```java
private Bitemm itemOf(String gclMngNo, int sno, String ioeC, BigDecimal amt) {
    return Bitemm.builder()
            .gclMngNo(gclMngNo)
            .sno(sno)
            .abusMngNo("PRJ-2026-0001")
            .ioeC(ioeC)
            .amt(amt)
            .build();
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetRateApplicationServiceTest"
```

Expected: 컴파일 실패 — `ItemRate` 생성자 인자 5개 없음

- [ ] **Step 3: `ItemRate`에 `ioeRates`를 더한다**

`BudgetWorkDto.java:62-75`를 교체한다.

```java
    /**
     * 개별 사업 편성률 DTO (자본예산/일반관리비 분리)
     *
     * @param orcTb 원본 테이블 — 접두어 없는 {@code BPROJM} 또는 {@code BCOSTM}
     * @param orcPkVl 원본 PK (prjMngNo / itMngcNo)
     * @param assetDupRt 자본예산 편성률 (0~100, null=해당없음)
     * @param costDupRt 일반관리비 편성률 (0~100)
     * @param ioeRates 비목코드별 편성률 (0~100, 소수 허용). null·빈 맵이면 위 2버킷을 쓰고, 값이 있는 비목만
     *     그 편성률로 덮습니다. 종합본 반입처럼 한 사업 안에서 비목그룹마다 편성률이 다른 경우에만 채웁니다
     */
    @Schema(name = "BudgetWorkItemRate", description = "개별 사업 편성률 (자본예산/일반관리비 분리)")
    public record ItemRate(
            @Schema(description = "원본 테이블", example = "BPROJM") String orcTb,
            @Schema(description = "원본 PK", example = "PRJ-2026-0001") String orcPkVl,
            @Schema(description = "자본예산 편성률 (0~100, null=해당없음)", nullable = true)
                    Integer assetDupRt,
            @Schema(description = "일반관리비 편성률 (0~100)", nullable = true) Integer costDupRt,
            @Schema(
                            description = "비목코드별 편성률 (0~100, 소수 허용). 비면 2버킷을 사용",
                            nullable = true)
                    Map<String, BigDecimal> ioeRates) {}
```

- [ ] **Step 4: `applyItemRates`가 비목별 편성률을 먼저 보게 한다**

`BudgetRateApplicationService.java`의 `applyItemRates` 루프 안에서 편성률을 정하는 두 지점을 헬퍼 호출로 바꾼다.

```java
            Map<String, BigDecimal> ioeRates =
                    item.ioeRates() == null ? Map.of() : item.ioeRates();
            // ... BPROJM 분기
                    BigDecimal rate = rateOf(source.getIoeC(), ioeRates, assetRate, costRate, capitalPrefixes);
            // ... BCOSTM 분기
                    BigDecimal rate = rateOf(source.getIoeC(), ioeRates, assetRate, costRate, capitalPrefixes);
```

헬퍼를 클래스 하단에 추가한다.

```java
    /**
     * 이 비목에 적용할 편성률을 정합니다.
     *
     * <p>비목별 편성률이 지정돼 있으면 그것이 이깁니다. 지정되지 않은 비목만 자본·일반 2버킷으로 떨어지므로,
     * 종합본이 일부 비목만 채워 보내도 나머지가 조용히 0이 되지 않습니다.
     *
     * @param ioeC 품목·전산업무비의 비목코드 (null 허용)
     * @param ioeRates 비목별 편성률. 비어 있으면 2버킷만 씁니다
     * @param assetRate 자본예산 계열 기본 편성률
     * @param costRate 그 밖의 기본 편성률
     * @param capitalPrefixes 자본예산 계열 판정용 접두어 집합
     * @return 적용할 편성률
     */
    private BigDecimal rateOf(
            String ioeC,
            Map<String, BigDecimal> ioeRates,
            BigDecimal assetRate,
            BigDecimal costRate,
            Set<String> capitalPrefixes) {
        if (ioeC != null) {
            BigDecimal explicit = ioeRates.get(ioeC.trim());
            if (explicit != null) {
                return explicit;
            }
        }
        return isCapitalIoeCode(ioeC, capitalPrefixes) ? assetRate : costRate;
    }
```

- [ ] **Step 5: 기존 호출부의 생성자 인자를 채운다**

`ItemRate`를 만드는 모든 지점에 다섯 번째 인자 `null`을 더한다. 컴파일러가 위치를 알려 준다 — `MigrationImportService.java:169,178,284`가 대상이고, Task 9에서 이 코드는 다시 바뀐다.

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.*" --tests "com.kdb.it.domain.migration.*"
```

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/work/dto/BudgetWorkDto.java src/main/java/com/kdb/it/domain/budget/work/service/BudgetRateApplicationService.java src/main/java/com/kdb/it/domain/migration/service/MigrationImportService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetRateApplicationServiceTest.java && git diff --cached --stat && git commit -m "feat: 편성률 적용에 비목별 편성률 경로 추가"
```

---

## Task 3: `MigrationYearSnapshot`을 매칭·배분이 쓸 수 있게 확장

매처는 부서 기준 전산업무비 자연키와 경상사업 목록이, 플래너는 사업별 품목 목록(비목·금액)이 필요하다. 지금 스냅샷은 사업코드 기준 자연키와 자본·일반 2버킷 편성률만 들고 있다. 2버킷으로 접으면서 `Math.min`으로 뭉개던 손실도 여기서 사라진다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationYearSnapshot.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationYearSnapshotTest.java`

**Interfaces:**
- Produces (`MigrationYearSnapshot.Data`의 신규 접근자):
  - `record RequestItem(String gclMngNo, Integer sno, String ioeC, BigDecimal amount)`
  - `record CostRef(String costBgNo, Integer bgSno, String ioeC, BigDecimal amount, String label)`
  - `List<RequestItem> itemsOfProject(String abusMngNo)` — 활성·최신 품목. 없으면 빈 목록
  - `CostRef costOf(String costBgNo)` — 없으면 null
  - `String costNoByDeptKey(String key)` — `costDeptKey(...)`로 만든 키. 없으면 null
  - `List<String> costNosByDeptAndIoe(String deptCode, String ioeC)` — 완화 매칭 3단계용
  - `List<String> ordinaryProjectNosOfDept(String deptCode)` — `ODN_YN='Y'` 사업
  - `String projectNameOf(String abusMngNo)` — 후보 라벨용. 없으면 null
  - `Map<String, BigDecimal> existingItemRateByItemNo()` — 품목관리번호 → 기존 `ASG_RT`(원본 보존)
  - `String bgUntAbusCOf(String costBgNo)` — 원장의 사업코드. 없거나 공백이면 null
  - `static String costDeptKey(String bseYy, String deptCode, String ioeC, String vendorName, String contractName)`
  - `static String normalizeText(String value)` — 공백 압축 + 소문자. 상대처·계약명 비교에 쓴다
- 기존 `existingRateByProjectNo`·`existingProjectRateOf`·`ProjectRate`는 **삭제**한다. Task 9가 품목별 원본으로 갈아탄다

- [ ] **Step 1: 확장된 스냅샷의 실패 테스트를 쓴다**

`MigrationYearSnapshotTest.java`에 추가한다. 기존 테스트의 리포지토리 목 준비를 그대로 따른다.

```java
@Test
@DisplayName("load_부서기준_전산업무비_자연키로_조회된다")
void load_부서기준_전산업무비_자연키로_조회된다() {
    Bcostm cost =
            Bcostm.builder()
                    .costBgNo("COST-26-0001")
                    .bgSno(1)
                    .bseYy("2026")
                    .costSvnDpmC("0210")
                    .bgUntAbusC(null)
                    .ioeC("001")
                    .cttOppNm("커브")
                    .cttNm("올인원워크스페이스")
                    .costTotXpAmt(new BigDecimal("15401000"))
                    .build();
    given(costRepository.findByBseYyAndLstYnAndDelYn("2026", "Y", "N")).willReturn(List.of(cost));
    given(projectRepository.findByBseYyAndLstYnAndDelYn("2026", "Y", "N")).willReturn(List.of());
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N")).willReturn(List.of());

    MigrationYearSnapshot.Data data = snapshot.load("2026");

    String key =
            MigrationYearSnapshot.costDeptKey("2026", "0210", "001", "커브", "올인원워크스페이스");
    assertThat(data.costNoByDeptKey(key)).isEqualTo("COST-26-0001");
    assertThat(data.costNosByDeptAndIoe("0210", "001")).containsExactly("COST-26-0001");
    assertThat(data.costOf("COST-26-0001").amount()).isEqualByComparingTo("15401000");
    assertThat(data.bgUntAbusCOf("COST-26-0001")).isNull();
}

@Test
@DisplayName("load_경상사업은_부서코드로_모인다")
void load_경상사업은_부서코드로_모인다() {
    Bprojm ordinary = projectOf("PRJ-2026-0002", "2026년 런던지점 위임예산(경상)", "920", "Y");
    Bprojm capital = projectOf("PRJ-2026-0001", "웹한글 기안기 도입", "0210", "N");
    given(projectRepository.findByBseYyAndLstYnAndDelYn("2026", "Y", "N"))
            .willReturn(List.of(ordinary, capital));
    given(costRepository.findByBseYyAndLstYnAndDelYn("2026", "Y", "N")).willReturn(List.of());
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N")).willReturn(List.of());
    given(projectItemRepository.findByAbusMngNoInAndDelYn(anyList(), eq("N"))).willReturn(List.of());

    MigrationYearSnapshot.Data data = snapshot.load("2026");

    assertThat(data.ordinaryProjectNosOfDept("920")).containsExactly("PRJ-2026-0002");
    assertThat(data.ordinaryProjectNosOfDept("0210")).isEmpty();
    assertThat(data.projectNameOf("PRJ-2026-0001")).isEqualTo("웹한글 기안기 도입");
}

@Test
@DisplayName("load_품목은_사업별로_비목과_금액을_함께_들고온다")
void load_품목은_사업별로_비목과_금액을_함께_들고온다() {
    Bprojm project = projectOf("PRJ-2026-0001", "웹한글 기안기 도입", "0210", "N");
    Bitemm item =
            Bitemm.builder()
                    .gclMngNo("GCL-2026-0001")
                    .sno(1)
                    .abusMngNo("PRJ-2026-0001")
                    .ioeC("106")
                    .amt(new BigDecimal("1406000000"))
                    .lstYn("Y")
                    .build();
    given(projectRepository.findByBseYyAndLstYnAndDelYn("2026", "Y", "N"))
            .willReturn(List.of(project));
    given(costRepository.findByBseYyAndLstYnAndDelYn("2026", "Y", "N")).willReturn(List.of());
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N")).willReturn(List.of());
    given(projectItemRepository.findByAbusMngNoInAndDelYn(anyList(), eq("N")))
            .willReturn(List.of(item));

    MigrationYearSnapshot.Data data = snapshot.load("2026");

    assertThat(data.itemsOfProject("PRJ-2026-0001"))
            .containsExactly(
                    new MigrationYearSnapshot.RequestItem(
                            "GCL-2026-0001", 1, "106", new BigDecimal("1406000000")));
}

@Test
@DisplayName("load_기존_편성률은_품목별_원본으로_보존된다")
void load_기존_편성률은_품목별_원본으로_보존된다() {
    given(projectRepository.findByBseYyAndLstYnAndDelYn("2026", "Y", "N")).willReturn(List.of());
    given(costRepository.findByBseYyAndLstYnAndDelYn("2026", "Y", "N")).willReturn(List.of());
    given(bbugtmRepository.findByBseYyAndDelYn("2026", "N"))
            .willReturn(
                    List.of(
                            budgetOf("BITEMM", "GCL-2026-0001", "103", new BigDecimal("70")),
                            budgetOf("BITEMM", "GCL-2026-0002", "101", new BigDecimal("29.58748"))));

    MigrationYearSnapshot.Data data = snapshot.load("2026");

    assertThat(data.existingItemRateByItemNo())
            .containsEntry("GCL-2026-0001", new BigDecimal("70"))
            .containsEntry("GCL-2026-0002", new BigDecimal("29.58748"));
}

private Bprojm projectOf(String no, String name, String deptCode, String odnYn) {
    return Bprojm.builder()
            .abusMngNo(no)
            .sno(1)
            .abusNm(name)
            .svnDpmC(deptCode)
            .odnYn(odnYn)
            .bseYy("2026")
            .lstYn("Y")
            .build();
}

private Bbugtm budgetOf(String table, String pk, String ioeC, BigDecimal rate) {
    return Bbugtm.builder()
            .bgNo("BG-2026-0001")
            .sno(1)
            .bseYy("2026")
            .fntTbNm(table)
            .pkColNm(pk)
            .fntTbCrySno(1)
            .ioeC(ioeC)
            .asgRt(rate)
            .build();
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.MigrationYearSnapshotTest"
```

Expected: 컴파일 실패 — `costDeptKey`·`RequestItem`·`itemsOfProject` 등이 없음

- [ ] **Step 3: `Data` 레코드를 확장한다**

`MigrationYearSnapshot.java`의 `ProjectRate` 레코드를 지우고 다음 두 레코드를 더한다.

```java
    /**
     * 매칭된 사업의 요청 품목 하나입니다. 실효 편성률의 분모와 편성행 키가 여기서 나옵니다.
     *
     * @param gclMngNo 품목관리번호 ({@code BBUGTM.PK_COL_NM})
     * @param sno 품목 일련번호 ({@code BBUGTM.FNT_TB_CRY_SNO})
     * @param ioeC 비목코드
     * @param amount 요청금액. null이면 0원으로 접습니다
     */
    public record RequestItem(String gclMngNo, Integer sno, String ioeC, BigDecimal amount) {}

    /**
     * 매칭 대상 전산업무비 한 건입니다.
     *
     * @param costBgNo 전산업무비관리번호 ({@code BBUGTM.PK_COL_NM})
     * @param bgSno 예산일련번호 ({@code BBUGTM.FNT_TB_CRY_SNO})
     * @param ioeC 비목코드
     * @param amount 요청금액 ({@code COST_TOT_XP_AMT})
     * @param label 후보 표시용 문구 (계약명 + 상대처)
     */
    public record CostRef(
            String costBgNo, Integer bgSno, String ioeC, BigDecimal amount, String label) {}
```

`Data` 레코드의 컴포넌트를 다음으로 바꾼다.

```java
    public record Data(
            String bseYy,
            Map<String, String> projectNoByNormalizedName,
            Map<String, String> projectNameByNo,
            Map<String, List<String>> ordinaryProjectNosByDept,
            Map<String, List<RequestItem>> itemsByProjectNo,
            Map<String, CostRef> costByNo,
            Map<String, String> costNoByDeptKey,
            Map<String, List<String>> costNosByDeptIoe,
            Map<String, String> bgUntAbusCByCostNo,
            Set<String> existingPlanTypes,
            Map<String, BigDecimal> existingCostRateByCostNo,
            Map<String, BigDecimal> existingItemRateByItemNo,
            List<String> allProjectNos,
            List<String> allCostNos) {

        /** 정규화 사업명에 대응하는 기존 사업관리번호를 반환합니다. 없으면 null. */
        public String projectNoByName(String normalizedName) {
            return projectNoByNormalizedName.get(normalizedName);
        }

        /** 사업관리번호의 사업명입니다. 후보 라벨에 씁니다. 없으면 null. */
        public String projectNameOf(String abusMngNo) {
            return projectNameByNo.get(abusMngNo);
        }

        /** 그 연도에 해당 계획구분의 계획이 이미 있는지 판정합니다. */
        public boolean planExists(String plnTp) {
            return existingPlanTypes.contains(plnTp);
        }

        /** 부서의 경상사업({@code ODN_YN='Y'}) 관리번호 목록입니다. 없으면 빈 목록. */
        public List<String> ordinaryProjectNosOfDept(String deptCode) {
            return ordinaryProjectNosByDept.getOrDefault(deptCode, List.of());
        }

        /** 사업의 활성·최신 요청 품목 목록입니다. 없으면 빈 목록. */
        public List<RequestItem> itemsOfProject(String abusMngNo) {
            return itemsByProjectNo.getOrDefault(abusMngNo, List.of());
        }

        /** 전산업무비관리번호로 대상을 조회합니다. 없으면 null. */
        public CostRef costOf(String costBgNo) {
            return costByNo.get(costBgNo);
        }

        /** 부서 기준 자연키({@link #costDeptKey})로 전산업무비관리번호를 조회합니다. 없으면 null. */
        public String costNoByDeptKey(String key) {
            return costNoByDeptKey.get(key);
        }

        /** 부서+비목만으로 좁힌 전산업무비 후보입니다. 완화 매칭 3단계에서 씁니다. */
        public List<String> costNosByDeptAndIoe(String deptCode, String ioeC) {
            return costNosByDeptIoe.getOrDefault(nz(deptCode) + "|" + nz(ioeC), List.of());
        }

        /** 원장에 이미 있는 사업코드입니다. 공백이면 null — 종합본 값으로 채울 대상이라는 뜻입니다. */
        public String bgUntAbusCOf(String costBgNo) {
            String value = bgUntAbusCByCostNo.get(costBgNo);
            return value == null || value.isBlank() ? null : value;
        }

        /** 전산업무비의 기존 편성률입니다. 편성행이 없으면 null. */
        public BigDecimal existingCostRateOf(String costBgNo) {
            return existingCostRateByCostNo.get(costBgNo);
        }
    }
```

- [ ] **Step 4: `load`를 새 구조로 다시 쓴다**

```java
    /** 기존 편성행이 없을 때 적용하는 기본 편성률. */
    public static final BigDecimal DEFAULT_RATE = BigDecimal.valueOf(100);

    /**
     * 예산연도의 기존 상태를 읽습니다.
     *
     * <p>매칭(§4)과 배분(§3)이 같은 데이터를 필요로 하므로 각 요청에서 한 번만 읽습니다. 품목 편성률은 자본·일반으로 접지 않고 품목관리번호별 원본을
     * 그대로 보존합니다 — 종합본이 한 사업 안에서 비목그룹마다 다른 편성률을 주기 때문입니다.
     *
     * @param bseYy 예산연도 (4자리)
     * @return 스냅샷 데이터
     */
    public Data load(String bseYy) {
        Map<String, CostRef> costByNo = new LinkedHashMap<>();
        Map<String, String> costNoByDeptKey = new LinkedHashMap<>();
        Map<String, List<String>> costNosByDeptIoe = new LinkedHashMap<>();
        Map<String, String> bgUntAbusCByCostNo = new LinkedHashMap<>();
        List<String> costNos = new ArrayList<>();
        for (Bcostm cost : costRepository.findByBseYyAndLstYnAndDelYn(bseYy, "Y", "N")) {
            String costNo = cost.getCostBgNo();
            costByNo.putIfAbsent(
                    costNo,
                    new CostRef(
                            costNo,
                            cost.getBgSno(),
                            cost.getIoeC(),
                            cost.getCostTotXpAmt() == null
                                    ? BigDecimal.ZERO
                                    : cost.getCostTotXpAmt(),
                            nz(cost.getCttNm()) + " / " + nz(cost.getCttOppNm())));
            costNoByDeptKey.putIfAbsent(
                    costDeptKey(
                            bseYy,
                            cost.getCostSvnDpmC(),
                            cost.getIoeC(),
                            cost.getCttOppNm(),
                            cost.getCttNm()),
                    costNo);
            costNosByDeptIoe
                    .computeIfAbsent(
                            nz(cost.getCostSvnDpmC()) + "|" + nz(cost.getIoeC()),
                            ignored -> new ArrayList<>())
                    .add(costNo);
            bgUntAbusCByCostNo.put(costNo, cost.getBgUntAbusC());
            costNos.add(costNo);
        }

        Map<String, String> projectByName = new LinkedHashMap<>();
        Map<String, String> projectNameByNo = new LinkedHashMap<>();
        Map<String, List<String>> ordinaryByDept = new LinkedHashMap<>();
        List<String> projectNos = new ArrayList<>();
        for (Bprojm project : projectRepository.findByBseYyAndLstYnAndDelYn(bseYy, "Y", "N")) {
            String projectNo = project.getAbusMngNo();
            projectByName.putIfAbsent(normalizeName(project.getAbusNm()), projectNo);
            projectNameByNo.putIfAbsent(projectNo, project.getAbusNm());
            if ("Y".equals(project.getOdnYn())) {
                ordinaryByDept
                        .computeIfAbsent(nz(project.getSvnDpmC()), ignored -> new ArrayList<>())
                        .add(projectNo);
            }
            projectNos.add(projectNo);
        }

        Map<String, List<RequestItem>> itemsByProject = new LinkedHashMap<>();
        if (!projectNos.isEmpty()) {
            for (Bitemm item : projectItemRepository.findByAbusMngNoInAndDelYn(projectNos, "N")) {
                if (!"Y".equals(item.getLstYn())) {
                    continue;
                }
                itemsByProject
                        .computeIfAbsent(item.getAbusMngNo(), ignored -> new ArrayList<>())
                        .add(
                                new RequestItem(
                                        item.getGclMngNo(),
                                        item.getSno(),
                                        item.getIoeC(),
                                        item.getAmt() == null ? BigDecimal.ZERO : item.getAmt()));
            }
        }

        Set<String> planTypes = new LinkedHashSet<>();
        for (String plnTp : List.of("신규", "조정")) {
            if (planRepository.existsByBseYyAndItPtlPlnTpCAndDelYn(bseYy, plnTp, "N")) {
                planTypes.add(plnTp);
            }
        }

        Map<String, BigDecimal> costRates = new LinkedHashMap<>();
        Map<String, BigDecimal> itemRates = new LinkedHashMap<>();
        for (Bbugtm budget : bbugtmRepository.findByBseYyAndDelYn(bseYy, "N")) {
            if ("BCOSTM".equals(budget.getFntTbNm())) {
                costRates.putIfAbsent(budget.getPkColNm(), budget.getAsgRt());
            } else if ("BITEMM".equals(budget.getFntTbNm())) {
                itemRates.putIfAbsent(budget.getPkColNm(), budget.getAsgRt());
            }
        }

        return new Data(
                bseYy,
                projectByName,
                projectNameByNo,
                ordinaryByDept,
                itemsByProject,
                costByNo,
                costNoByDeptKey,
                costNosByDeptIoe,
                bgUntAbusCByCostNo,
                planTypes,
                costRates,
                itemRates,
                List.copyOf(projectNos),
                costNos);
    }
```

`projectRates(...)` private 메서드와 `ProjectRate` import는 삭제한다.

- [ ] **Step 5: 자연키 헬퍼를 더한다**

기존 `costNaturalKey` 두 개는 지우고(사업코드 기준이라 §1.2 ②의 원인이었다) 다음으로 대체한다.

```java
    /**
     * 부서 기준 전산업무비 자연키를 만듭니다.
     *
     * <p>사업코드({@code BG_UNT_ABUS_C})를 키에서 뺐습니다. 편성요청서 양식에 그 열이 없어 1단계가 만든 행은 대부분 null이므로,
     * 사업코드를 키에 두면 같은 계약이 매칭되지 않고 새 행으로 다시 생깁니다.
     *
     * @param bseYy 예산연도
     * @param deptCode 주관부서코드 ({@code COST_SVN_DPM_C})
     * @param ioeC 비목코드
     * @param vendorName 계약상대처명. 공백 압축·소문자로 정규화됩니다
     * @param contractName 계약명. 같은 규칙으로 정규화됩니다
     * @return 파이프로 이은 자연키
     */
    public static String costDeptKey(
            String bseYy, String deptCode, String ioeC, String vendorName, String contractName) {
        return String.join(
                "|",
                nz(bseYy),
                nz(deptCode),
                nz(ioeC),
                normalizeText(vendorName),
                normalizeText(contractName));
    }

    /** 사업명을 공백 압축해 동일성 판정 키로 만듭니다. */
    public static String normalizeName(String name) {
        return name == null ? "" : name.replaceAll("\\s+", "");
    }

    /** 상대처·계약명 비교용 정규화입니다. 공백을 모두 없애고 소문자로 접습니다. */
    public static String normalizeText(String value) {
        return value == null ? "" : value.replaceAll("\\s+", "").toLowerCase(java.util.Locale.ROOT);
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

`MigrationImportService`·`MigrationValidator`·어댑터의 컴파일 오류는 Task 7~9에서 정리한다. 이 단계에서는 삭제한 API를 쓰는 지점을 임시로 컴파일만 되게 두지 말고, **Task 3을 Task 7~9와 한 브랜치에서 이어서 진행**한다. 스냅샷 테스트만 먼저 통과시킨다.

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.MigrationYearSnapshotTest"
```

Expected: PASS (다른 모듈의 컴파일 오류가 나면 Task 7~9까지 진행한 뒤 전체를 돌린다)

- [ ] **Step 7: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/migration/service/MigrationYearSnapshot.java src/test/java/com/kdb/it/domain/migration/service/MigrationYearSnapshotTest.java && git diff --cached --stat && git commit -m "feat: 연도 스냅샷에 부서 기준 자연키와 품목 인덱스 추가"
```

---

## Task 4: `MigrationLedgerMatcher` — 종합본 행을 기존 원장에 매칭

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationLedgerMatcher.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationLedgerMatcherTest.java`

**Interfaces:**
- Consumes: Task 3의 `MigrationYearSnapshot.Data`(`projectNoByName`·`ordinaryProjectNosOfDept`·`costNoByDeptKey`·`costNosByDeptAndIoe`·`costOf`·`projectNameOf`), `MigrationYearSnapshot.costDeptKey`, `MigrationYearSnapshot.normalizeText`
- Produces:
  - `enum MigrationLedgerMatcher.Outcome { MATCHED, NOT_FOUND, AMBIGUOUS }`
  - `record MigrationLedgerMatcher.Match(Outcome outcome, String pk, List<MigrationDto.Candidate> candidates)`
    - `Match.matched(String pk)`, `Match.notFound(List<Candidate>)`, `Match.ambiguous(List<Candidate>)` 정적 팩토리
  - `Match matchProject(String normalizedName, Data snapshot)`
  - `Match matchOrdinaryProject(String deptCode, Data snapshot)`
  - `Match matchCost(String bseYy, String deptCode, String ioeC, String vendorName, String contractName, Data snapshot)`
  - 후보의 `code`는 항상 **원장 PK**(`PRJ-2026-0001`·`COST-26-0001`), `label`은 사람이 읽는 이름이다. 결정 값 조립은 Task 6이 맡는다

- [ ] **Step 1: 매처의 실패 테스트를 쓴다**

```java
package com.kdb.it.domain.migration.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.migration.dto.MigrationDto;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MigrationLedgerMatcherTest {

    private final MigrationLedgerMatcher matcher = new MigrationLedgerMatcher();

    @Test
    @DisplayName("matchProject_정규화_사업명이_같으면_매칭된다")
    void matchProject_정규화_사업명이_같으면_매칭된다() {
        MigrationYearSnapshot.Data snapshot =
                snapshotWithProject("웹한글기안기도입", "PRJ-2026-0001", "웹한글 기안기 도입");

        MigrationLedgerMatcher.Match match = matcher.matchProject("웹한글기안기도입", snapshot);

        assertThat(match.outcome()).isEqualTo(MigrationLedgerMatcher.Outcome.MATCHED);
        assertThat(match.pk()).isEqualTo("PRJ-2026-0001");
    }

    @Test
    @DisplayName("matchProject_없으면_전체_사업을_후보로_낸다")
    void matchProject_없으면_전체_사업을_후보로_낸다() {
        MigrationYearSnapshot.Data snapshot =
                snapshotWithProject("웹한글기안기도입", "PRJ-2026-0001", "웹한글 기안기 도입");

        MigrationLedgerMatcher.Match match = matcher.matchProject("문자메시지안심마크도입", snapshot);

        assertThat(match.outcome()).isEqualTo(MigrationLedgerMatcher.Outcome.NOT_FOUND);
        assertThat(match.pk()).isNull();
        assertThat(match.candidates())
                .containsExactly(new MigrationDto.Candidate("PRJ-2026-0001", "웹한글 기안기 도입"));
    }

    @Test
    @DisplayName("matchOrdinaryProject_부서에_경상사업이_하나면_매칭된다")
    void matchOrdinaryProject_부서에_경상사업이_하나면_매칭된다() {
        MigrationYearSnapshot.Data snapshot =
                snapshot(
                        Map.of(),
                        Map.of("PRJ-2026-0002", "2026년 런던지점 위임예산(경상)"),
                        Map.of("920", List.of("PRJ-2026-0002")),
                        Map.of(),
                        Map.of(),
                        Map.of());

        MigrationLedgerMatcher.Match match = matcher.matchOrdinaryProject("920", snapshot);

        assertThat(match.outcome()).isEqualTo(MigrationLedgerMatcher.Outcome.MATCHED);
        assertThat(match.pk()).isEqualTo("PRJ-2026-0002");
    }

    @Test
    @DisplayName("matchOrdinaryProject_부서에_경상사업이_둘이면_중의적이다")
    void matchOrdinaryProject_부서에_경상사업이_둘이면_중의적이다() {
        MigrationYearSnapshot.Data snapshot =
                snapshot(
                        Map.of(),
                        Map.of("PRJ-2026-0002", "런던 위임예산", "PRJ-2026-0003", "런던 PF 위임예산"),
                        Map.of("920", List.of("PRJ-2026-0002", "PRJ-2026-0003")),
                        Map.of(),
                        Map.of(),
                        Map.of());

        MigrationLedgerMatcher.Match match = matcher.matchOrdinaryProject("920", snapshot);

        assertThat(match.outcome()).isEqualTo(MigrationLedgerMatcher.Outcome.AMBIGUOUS);
        assertThat(match.candidates()).hasSize(2);
    }

    @Test
    @DisplayName("matchCost_5요소가_같으면_매칭된다")
    void matchCost_5요소가_같으면_매칭된다() {
        String key = MigrationYearSnapshot.costDeptKey("2026", "0210", "001", "커브", "올인원워크스페이스");
        MigrationYearSnapshot.Data snapshot =
                snapshot(
                        Map.of(),
                        Map.of(),
                        Map.of(),
                        Map.of(
                                "COST-26-0001",
                                new MigrationYearSnapshot.CostRef(
                                        "COST-26-0001",
                                        1,
                                        "001",
                                        new BigDecimal("15401000"),
                                        "올인원워크스페이스 / 커브")),
                        Map.of(key, "COST-26-0001"),
                        Map.of("0210|001", List.of("COST-26-0001")));

        MigrationLedgerMatcher.Match match =
                matcher.matchCost("2026", "0210", "001", "커브", "올인원워크스페이스", snapshot);

        assertThat(match.outcome()).isEqualTo(MigrationLedgerMatcher.Outcome.MATCHED);
        assertThat(match.pk()).isEqualTo("COST-26-0001");
    }

    @Test
    @DisplayName("matchCost_상대처가_공란이면_상대처를_빼고_다시_찾는다")
    void matchCost_상대처가_공란이면_상대처를_빼고_다시_찾는다() {
        String key = MigrationYearSnapshot.costDeptKey("2026", "0210", "001", "커브", "올인원워크스페이스");
        MigrationYearSnapshot.Data snapshot =
                snapshot(
                        Map.of(),
                        Map.of(),
                        Map.of(),
                        Map.of(
                                "COST-26-0001",
                                new MigrationYearSnapshot.CostRef(
                                        "COST-26-0001",
                                        1,
                                        "001",
                                        new BigDecimal("15401000"),
                                        "올인원워크스페이스 / 커브")),
                        Map.of(key, "COST-26-0001"),
                        Map.of("0210|001", List.of("COST-26-0001")));

        // 종합본에 상대처가 비어 있어도 부서+비목+계약명이 유일하면 매칭한다
        MigrationLedgerMatcher.Match match =
                matcher.matchCost("2026", "0210", "001", "", "올인원워크스페이스", snapshot);

        assertThat(match.outcome()).isEqualTo(MigrationLedgerMatcher.Outcome.MATCHED);
        assertThat(match.pk()).isEqualTo("COST-26-0001");
    }

    @Test
    @DisplayName("matchCost_계약명이_달라도_부서와_비목이_같으면_후보를_낸다")
    void matchCost_계약명이_달라도_부서와_비목이_같으면_후보를_낸다() {
        MigrationYearSnapshot.Data snapshot =
                snapshot(
                        Map.of(),
                        Map.of(),
                        Map.of(),
                        Map.of(
                                "COST-26-0001",
                                new MigrationYearSnapshot.CostRef(
                                        "COST-26-0001",
                                        1,
                                        "001",
                                        new BigDecimal("15401000"),
                                        "올인원워크스페이스 / 커브")),
                        Map.of(),
                        Map.of("0210|001", List.of("COST-26-0001")));

        MigrationLedgerMatcher.Match match =
                matcher.matchCost("2026", "0210", "001", "커브", "전혀 다른 계약명", snapshot);

        assertThat(match.outcome()).isEqualTo(MigrationLedgerMatcher.Outcome.NOT_FOUND);
        assertThat(match.candidates())
                .containsExactly(
                        new MigrationDto.Candidate("COST-26-0001", "올인원워크스페이스 / 커브"));
    }

    private MigrationYearSnapshot.Data snapshotWithProject(
            String normalizedName, String projectNo, String projectName) {
        return snapshot(
                Map.of(normalizedName, projectNo),
                Map.of(projectNo, projectName),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of());
    }

    private MigrationYearSnapshot.Data snapshot(
            Map<String, String> projectNoByName,
            Map<String, String> projectNameByNo,
            Map<String, List<String>> ordinaryByDept,
            Map<String, MigrationYearSnapshot.CostRef> costByNo,
            Map<String, String> costNoByDeptKey,
            Map<String, List<String>> costNosByDeptIoe) {
        return new MigrationYearSnapshot.Data(
                "2026",
                projectNoByName,
                projectNameByNo,
                ordinaryByDept,
                Map.of(),
                costByNo,
                costNoByDeptKey,
                costNosByDeptIoe,
                Map.of(),
                Set.of(),
                Map.of(),
                Map.of(),
                List.copyOf(projectNameByNo.keySet()),
                List.copyOf(costByNo.keySet()));
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.MigrationLedgerMatcherTest"
```

Expected: 컴파일 실패 — `MigrationLedgerMatcher` 클래스 없음

- [ ] **Step 3: 매처를 만든다**

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.domain.migration.dto.MigrationDto;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 종합본·조정본의 행을 이미 반입된 요청 원장에 매칭합니다.
 *
 * <p>이 화면은 원장을 만들지 않고 편성금액만 계산하므로(설계 §2.1), 각 행이 어느 원장을 가리키는지 정하는 것이 반영의 출발점입니다. 매칭에 실패한 행은
 * 조용히 새 원장을 만들지 않고 {@link Outcome#NOT_FOUND}·{@link Outcome#AMBIGUOUS}로 돌려보내 관리자가 결정하게 합니다.
 *
 * <p>전산업무비 자연키에서 사업코드를 뺀 이유는 {@link MigrationYearSnapshot#costDeptKey} Javadoc에 있습니다.
 */
@Component
public class MigrationLedgerMatcher {

    /** 매칭 결과 종류입니다. */
    public enum Outcome {
        /** 대상 원장을 하나로 특정했습니다. */
        MATCHED,
        /** 대상이 없습니다. 후보는 참고용입니다. */
        NOT_FOUND,
        /** 후보가 둘 이상이라 특정하지 못했습니다. */
        AMBIGUOUS
    }

    /**
     * 매칭 결과입니다.
     *
     * @param outcome 결과 종류
     * @param pk 매칭된 원장 PK. {@code MATCHED}가 아니면 null
     * @param candidates 관리자에게 보여줄 후보. 없으면 빈 목록
     */
    public record Match(Outcome outcome, String pk, List<MigrationDto.Candidate> candidates) {

        /** 대상을 특정한 결과입니다. */
        public static Match matched(String pk) {
            return new Match(Outcome.MATCHED, pk, List.of());
        }

        /** 대상이 없는 결과입니다. */
        public static Match notFound(List<MigrationDto.Candidate> candidates) {
            return new Match(Outcome.NOT_FOUND, null, candidates);
        }

        /** 후보가 둘 이상인 결과입니다. */
        public static Match ambiguous(List<MigrationDto.Candidate> candidates) {
            return new Match(Outcome.AMBIGUOUS, null, candidates);
        }
    }

    /**
     * 정규화 사업명으로 정보화사업을 찾습니다.
     *
     * @param normalizedName {@link MigrationYearSnapshot#normalizeName}으로 정규화한 사업명
     * @param snapshot 연도 스냅샷
     * @return 매칭 결과. 못 찾으면 그 연도 사업 전체가 후보다
     */
    public Match matchProject(String normalizedName, MigrationYearSnapshot.Data snapshot) {
        String projectNo = snapshot.projectNoByName(normalizedName);
        if (projectNo != null) {
            return Match.matched(projectNo);
        }
        return Match.notFound(allProjectCandidates(snapshot));
    }

    /**
     * 부서코드로 경상사업({@code ODN_YN='Y'})을 찾습니다.
     *
     * <p>사업명으로 찾지 않습니다 — 종합본 위임예산 시트는 부점명만 갖고 있고, 1단계가 만든 경상사업의 사업명은 부점이 시트 ②에 적은 임의 문자열이라
     * 두 값이 일치할 근거가 없습니다.
     *
     * @param deptCode 부점명을 해석한 부서코드. null·공백이면 대상 없음
     * @param snapshot 연도 스냅샷
     * @return 매칭 결과. 그 부서에 경상사업이 둘 이상이면 {@code AMBIGUOUS}
     */
    public Match matchOrdinaryProject(String deptCode, MigrationYearSnapshot.Data snapshot) {
        if (deptCode == null || deptCode.isBlank()) {
            return Match.notFound(allProjectCandidates(snapshot));
        }
        List<String> candidates = snapshot.ordinaryProjectNosOfDept(deptCode);
        if (candidates.size() == 1) {
            return Match.matched(candidates.get(0));
        }
        if (candidates.isEmpty()) {
            return Match.notFound(allProjectCandidates(snapshot));
        }
        return Match.ambiguous(projectCandidates(candidates, snapshot));
    }

    /**
     * 부서 기준 자연키로 전산업무비를 찾습니다. 완화 매칭 3단계입니다.
     *
     * <ol>
     *   <li>부서·비목·상대처·계약명 5요소 정확 일치
     *   <li>상대처를 뺀 4요소 일치 — 계약업체명 공란 표기가 두 문서에서 흔들립니다
     *   <li>부서+비목만으로 좁힌 후보 제시
     * </ol>
     *
     * @param bseYy 예산연도
     * @param deptCode 요구부서를 해석한 부서코드
     * @param ioeC 비목코드
     * @param vendorName 계약업체명 (공란 허용)
     * @param contractName 요구내역 = 계약명
     * @param snapshot 연도 스냅샷
     * @return 매칭 결과
     */
    public Match matchCost(
            String bseYy,
            String deptCode,
            String ioeC,
            String vendorName,
            String contractName,
            MigrationYearSnapshot.Data snapshot) {
        String exact =
                snapshot.costNoByDeptKey(
                        MigrationYearSnapshot.costDeptKey(
                                bseYy, deptCode, ioeC, vendorName, contractName));
        if (exact != null) {
            return Match.matched(exact);
        }

        String normalizedContract = MigrationYearSnapshot.normalizeText(contractName);
        List<String> sameDeptIoe = snapshot.costNosByDeptAndIoe(deptCode, ioeC);
        List<String> byContract = new ArrayList<>();
        for (String costNo : sameDeptIoe) {
            MigrationYearSnapshot.CostRef ref = snapshot.costOf(costNo);
            if (ref == null) {
                continue;
            }
            // label은 "계약명 / 상대처" 형식이라 계약명만 떼어 비교한다
            String label = ref.label();
            int separator = label.lastIndexOf(" / ");
            String ledgerContract = separator < 0 ? label : label.substring(0, separator);
            if (MigrationYearSnapshot.normalizeText(ledgerContract).equals(normalizedContract)) {
                byContract.add(costNo);
            }
        }
        if (byContract.size() == 1) {
            return Match.matched(byContract.get(0));
        }
        if (byContract.size() > 1) {
            return Match.ambiguous(costCandidates(byContract, snapshot));
        }
        return Match.notFound(costCandidates(sameDeptIoe, snapshot));
    }

    /** 그 연도 사업 전체를 후보로 냅니다. 후보를 비워 두면 화면에 드롭다운이 그려지지 않습니다. */
    private List<MigrationDto.Candidate> allProjectCandidates(
            MigrationYearSnapshot.Data snapshot) {
        return projectCandidates(snapshot.allProjectNos(), snapshot);
    }

    private List<MigrationDto.Candidate> projectCandidates(
            List<String> projectNos, MigrationYearSnapshot.Data snapshot) {
        List<MigrationDto.Candidate> out = new ArrayList<>();
        for (String projectNo : projectNos) {
            String name = snapshot.projectNameOf(projectNo);
            out.add(new MigrationDto.Candidate(projectNo, name == null ? projectNo : name));
        }
        return out;
    }

    private List<MigrationDto.Candidate> costCandidates(
            List<String> costNos, MigrationYearSnapshot.Data snapshot) {
        List<MigrationDto.Candidate> out = new ArrayList<>();
        for (String costNo : costNos) {
            MigrationYearSnapshot.CostRef ref = snapshot.costOf(costNo);
            out.add(new MigrationDto.Candidate(costNo, ref == null ? costNo : ref.label()));
        }
        return out;
    }
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.MigrationLedgerMatcherTest"
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/migration/service/MigrationLedgerMatcher.java src/test/java/com/kdb/it/domain/migration/service/MigrationLedgerMatcherTest.java && git diff --cached --stat && git commit -m "feat: 종합본 행을 기존 요청 원장에 매칭하는 MigrationLedgerMatcher 추가"
```

---

## Task 5: `MigrationAllocationPlanner` — 실효 편성률 배분

설계 §3의 핵심 계산이다. 비목그룹 목표액을 요청 품목 합계로 나눠 실효 편성률을 구하고, 품목별 편성금액을 만든다. 그룹 합계는 목표액과 정확히 일치시키고 반올림 잔차는 최대 품목이 흡수한다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationAllocationPlanner.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationAllocationPlannerTest.java`

**Interfaces:**
- Consumes: Task 3의 `MigrationYearSnapshot.RequestItem`
- Produces:
  - `record ItemAllocation(String gclMngNo, Integer sno, String ioeC, BigDecimal amount, BigDecimal rate)`
  - `sealed interface Allocation` — `Allocation.Allocated(List<ItemAllocation> items, BigDecimal effectiveRate)`, `Allocation.BaseZero(BigDecimal targetAmount)`
  - `Allocation allocate(List<RequestItem> items, BigDecimal targetAmount)`
  - `static final Set<String> GROUP_DEV = Set.of("103","104")`, `GROUP_HW = Set.of("101","102")`, `GROUP_SW = Set.of("105","106","107")`
  - `static Set<String> groupOf(String amountColumn)` — `"devAmount"`→`GROUP_DEV`, `"hwAmount"`→`GROUP_HW`, `"swAmount"`→`GROUP_SW`, 그 외 빈 집합
  - `static List<RequestItem> itemsInGroup(List<RequestItem> all, Set<String> group)`
  - `static List<RequestItem> itemsOutsideCapitalGroups(List<RequestItem> all)` — 세 그룹 어디에도 안 드는 품목(1단계가 `BITEMM`에 함께 담은 일반관리비 계열)

- [ ] **Step 1: 배분의 실패 테스트를 쓴다**

```java
package com.kdb.it.domain.migration.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.migration.service.MigrationYearSnapshot.RequestItem;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MigrationAllocationPlannerTest {

    private final MigrationAllocationPlanner planner = new MigrationAllocationPlanner();

    @Test
    @DisplayName("allocate_종합본금액이_요청합계와_같으면_조정비율이_그대로_실효율이다")
    void allocate_종합본금액이_요청합계와_같으면_조정비율이_그대로_실효율이다() {
        List<RequestItem> items =
                List.of(new RequestItem("GCL-1", 1, "106", new BigDecimal("1406000000")));

        MigrationAllocationPlanner.Allocation result =
                planner.allocate(items, new BigDecimal("984200000"));

        MigrationAllocationPlanner.Allocation.Allocated allocated =
                (MigrationAllocationPlanner.Allocation.Allocated) result;
        assertThat(allocated.effectiveRate()).isEqualByComparingTo("70.00000");
        assertThat(allocated.items().get(0).amount()).isEqualByComparingTo("984200000.000");
    }

    @Test
    @DisplayName("allocate_하반기_확정금액은_소수_실효율로_표현된다")
    void allocate_하반기_확정금액은_소수_실효율로_표현된다() {
        List<RequestItem> items =
                List.of(new RequestItem("GCL-1", 1, "106", new BigDecimal("1406000000")));

        MigrationAllocationPlanner.Allocation result =
                planner.allocate(items, new BigDecimal("416000000"));

        MigrationAllocationPlanner.Allocation.Allocated allocated =
                (MigrationAllocationPlanner.Allocation.Allocated) result;
        assertThat(allocated.effectiveRate()).isEqualByComparingTo("29.58748");
        // 잔차를 흡수해 합계가 목표액과 정확히 일치한다
        assertThat(allocated.items().get(0).amount()).isEqualByComparingTo("416000000.000");
    }

    @Test
    @DisplayName("allocate_여러_품목이면_금액이_비례_배분되고_합계가_목표액과_같다")
    void allocate_여러_품목이면_금액이_비례_배분되고_합계가_목표액과_같다() {
        List<RequestItem> items =
                List.of(
                        new RequestItem("GCL-1", 1, "103", new BigDecimal("1000")),
                        new RequestItem("GCL-2", 2, "104", new BigDecimal("2000")));

        MigrationAllocationPlanner.Allocation result = planner.allocate(items, new BigDecimal("777"));

        MigrationAllocationPlanner.Allocation.Allocated allocated =
                (MigrationAllocationPlanner.Allocation.Allocated) result;
        BigDecimal sum =
                allocated.items().stream()
                        .map(MigrationAllocationPlanner.ItemAllocation::amount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
        assertThat(sum).isEqualByComparingTo("777");
        // 잔차는 요청금액이 가장 큰 품목이 흡수한다
        assertThat(allocated.items().get(1).amount()).isEqualByComparingTo("518.000");
        assertThat(allocated.items().get(0).amount()).isEqualByComparingTo("259.000");
    }

    @Test
    @DisplayName("allocate_목표액이_0이면_편성률과_금액이_모두_0이다")
    void allocate_목표액이_0이면_편성률과_금액이_모두_0이다() {
        List<RequestItem> items =
                List.of(new RequestItem("GCL-1", 1, "106", new BigDecimal("1406000000")));

        MigrationAllocationPlanner.Allocation result = planner.allocate(items, BigDecimal.ZERO);

        MigrationAllocationPlanner.Allocation.Allocated allocated =
                (MigrationAllocationPlanner.Allocation.Allocated) result;
        assertThat(allocated.effectiveRate()).isEqualByComparingTo("0");
        assertThat(allocated.items().get(0).amount()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("allocate_요청합계가_0인데_목표액이_있으면_배분할_수_없다")
    void allocate_요청합계가_0인데_목표액이_있으면_배분할_수_없다() {
        List<RequestItem> items = List.of(new RequestItem("GCL-1", 1, "106", BigDecimal.ZERO));

        MigrationAllocationPlanner.Allocation result =
                planner.allocate(items, new BigDecimal("416000000"));

        assertThat(result).isInstanceOf(MigrationAllocationPlanner.Allocation.BaseZero.class);
    }

    @Test
    @DisplayName("allocate_품목이_없고_목표액도_0이면_빈_배분이다")
    void allocate_품목이_없고_목표액도_0이면_빈_배분이다() {
        MigrationAllocationPlanner.Allocation result =
                planner.allocate(List.of(), BigDecimal.ZERO);

        MigrationAllocationPlanner.Allocation.Allocated allocated =
                (MigrationAllocationPlanner.Allocation.Allocated) result;
        assertThat(allocated.items()).isEmpty();
        assertThat(allocated.effectiveRate()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("groupOf_금액컬럼마다_비목그룹이_다르다")
    void groupOf_금액컬럼마다_비목그룹이_다르다() {
        assertThat(MigrationAllocationPlanner.groupOf("devAmount")).containsExactly("103", "104");
        assertThat(MigrationAllocationPlanner.groupOf("hwAmount")).containsExactly("101", "102");
        assertThat(MigrationAllocationPlanner.groupOf("swAmount"))
                .containsExactly("105", "106", "107");
        assertThat(MigrationAllocationPlanner.groupOf("generalAmount")).isEmpty();
    }

    @Test
    @DisplayName("itemsOutsideCapitalGroups_자본계열이_아닌_품목만_남는다")
    void itemsOutsideCapitalGroups_자본계열이_아닌_품목만_남는다() {
        List<RequestItem> items =
                List.of(
                        new RequestItem("GCL-1", 1, "103", new BigDecimal("100")),
                        new RequestItem("GCL-2", 2, "001", new BigDecimal("200")),
                        new RequestItem("GCL-3", 3, "013", new BigDecimal("300")));

        assertThat(MigrationAllocationPlanner.itemsOutsideCapitalGroups(items))
                .extracting(RequestItem::gclMngNo)
                .containsExactly("GCL-2", "GCL-3");
    }

    @Test
    @DisplayName("itemsInGroup_그룹에_드는_품목만_남는다")
    void itemsInGroup_그룹에_드는_품목만_남는다() {
        List<RequestItem> items =
                List.of(
                        new RequestItem("GCL-1", 1, "103", new BigDecimal("100")),
                        new RequestItem("GCL-2", 2, "104", new BigDecimal("200")),
                        new RequestItem("GCL-3", 3, "101", new BigDecimal("300")));

        assertThat(
                        MigrationAllocationPlanner.itemsInGroup(
                                items, MigrationAllocationPlanner.GROUP_DEV))
                .extracting(RequestItem::gclMngNo)
                .containsExactly("GCL-1", "GCL-2");
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.MigrationAllocationPlannerTest"
```

Expected: 컴파일 실패 — `MigrationAllocationPlanner` 클래스 없음

- [ ] **Step 3: 플래너를 만든다**

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.domain.migration.service.MigrationYearSnapshot.RequestItem;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 비목그룹 목표 편성액을 요청 품목에 배분해 실효 편성률을 만듭니다 (설계 §3).
 *
 * <p>종합본은 사업 단위로 비목그룹 총액을 주고 {@code BBUGTM}은 품목 단위입니다. 이 간극을 실효 편성률 하나로 메우면 (a) 조정비율을 그대로 쓰는
 * 경우, (b) 예산담당자가 취합하며 금액을 조정한 경우, (c) 하반기 조정의 확정금액까지 같은 식으로 표현되고 {@code 요청금액 × 편성률 = 편성금액} 불변식이
 * 세 경우 모두 성립합니다.
 *
 * <p>그룹 합계는 목표액과 정확히 일치시키고 반올림 잔차는 요청금액이 가장 큰 품목이 흡수합니다. 그 품목 하나만 개별 곱과 0.001원 어긋나지만, 예산 집계는
 * 그룹 합계로 이뤄지므로 합계 정확성을 택합니다.
 */
@Component
public class MigrationAllocationPlanner {

    /** 편성금액 스케일. {@code BG_DUP_AMT}의 물리 스케일과 같습니다. */
    private static final int AMOUNT_SCALE = 3;

    /** 편성률 스케일. {@code ASG_RT}의 물리 스케일과 같습니다. */
    private static final int RATE_SCALE = 5;

    private static final BigDecimal PERCENT_BASE = BigDecimal.valueOf(100);

    /** 개발비 그룹 — 개발비(일반) + 감리/컨설팅. */
    public static final Set<String> GROUP_DEV = new LinkedHashSet<>(List.of("103", "104"));

    /** 기계장치 그룹 — 국내 + 국외. */
    public static final Set<String> GROUP_HW = new LinkedHashSet<>(List.of("101", "102"));

    /** 기타무형자산 그룹 — 국외 + 국내(일반) + SW라이선스. */
    public static final Set<String> GROUP_SW = new LinkedHashSet<>(List.of("105", "106", "107"));

    /**
     * 품목별 편성 배분 하나입니다.
     *
     * @param gclMngNo 품목관리번호 ({@code BBUGTM.PK_COL_NM})
     * @param sno 품목 일련번호 ({@code BBUGTM.FNT_TB_CRY_SNO})
     * @param ioeC 비목코드
     * @param amount 편성금액 ({@code BG_DUP_AMT}, 스케일 3)
     * @param rate 편성률 ({@code ASG_RT}, 스케일 5)
     */
    public record ItemAllocation(
            String gclMngNo, Integer sno, String ioeC, BigDecimal amount, BigDecimal rate) {}

    /** 배분 결과입니다. 실패를 예외가 아니라 값으로 돌려 검증기가 진단으로 바꿉니다. */
    public sealed interface Allocation {

        /**
         * 배분에 성공한 결과입니다.
         *
         * @param items 품목별 배분
         * @param effectiveRate 그룹 공통 실효 편성률
         */
        record Allocated(List<ItemAllocation> items, BigDecimal effectiveRate)
                implements Allocation {}

        /**
         * 요청 품목 합계가 0인데 목표 편성액이 0보다 커서 배분할 대상이 없는 결과입니다.
         *
         * @param targetAmount 배분하려던 목표 편성액
         */
        record BaseZero(BigDecimal targetAmount) implements Allocation {}
    }

    /**
     * 목표 편성액을 요청 품목에 비례 배분합니다.
     *
     * @param items 그 비목그룹의 요청 품목. 빈 목록 허용
     * @param targetAmount 목표 편성액. null이면 0원으로 봅니다
     * @return 배분 결과. 요청 합계가 0인데 목표액이 0보다 크면 {@link Allocation.BaseZero}
     */
    public Allocation allocate(List<RequestItem> items, BigDecimal targetAmount) {
        BigDecimal target = targetAmount == null ? BigDecimal.ZERO : targetAmount;
        BigDecimal base = BigDecimal.ZERO;
        for (RequestItem item : items) {
            base = base.add(item.amount() == null ? BigDecimal.ZERO : item.amount());
        }

        if (base.compareTo(BigDecimal.ZERO) == 0) {
            if (target.compareTo(BigDecimal.ZERO) != 0) {
                return new Allocation.BaseZero(target);
            }
            List<ItemAllocation> zeros = new ArrayList<>();
            for (RequestItem item : items) {
                zeros.add(
                        new ItemAllocation(
                                item.gclMngNo(),
                                item.sno(),
                                item.ioeC(),
                                BigDecimal.ZERO.setScale(AMOUNT_SCALE),
                                BigDecimal.ZERO.setScale(RATE_SCALE)));
            }
            return new Allocation.Allocated(zeros, BigDecimal.ZERO.setScale(RATE_SCALE));
        }

        BigDecimal rate =
                target.multiply(PERCENT_BASE).divide(base, RATE_SCALE, RoundingMode.HALF_UP);

        List<ItemAllocation> allocations = new ArrayList<>();
        BigDecimal allocated = BigDecimal.ZERO;
        for (RequestItem item : items) {
            BigDecimal requested = item.amount() == null ? BigDecimal.ZERO : item.amount();
            BigDecimal amount =
                    requested
                            .multiply(rate)
                            .divide(PERCENT_BASE, AMOUNT_SCALE, RoundingMode.HALF_UP);
            allocations.add(
                    new ItemAllocation(item.gclMngNo(), item.sno(), item.ioeC(), amount, rate));
            allocated = allocated.add(amount);
        }

        BigDecimal residual = target.subtract(allocated);
        if (residual.compareTo(BigDecimal.ZERO) != 0) {
            int largest = indexOfLargest(items);
            ItemAllocation target Allocation = allocations.get(largest);
            allocations.set(
                    largest,
                    new ItemAllocation(
                            targetAllocation.gclMngNo(),
                            targetAllocation.sno(),
                            targetAllocation.ioeC(),
                            targetAllocation
                                    .amount()
                                    .add(residual)
                                    .setScale(AMOUNT_SCALE, RoundingMode.HALF_UP),
                            targetAllocation.rate()));
        }
        return new Allocation.Allocated(allocations, rate);
    }

    /** 반올림 잔차를 흡수할 품목의 인덱스입니다. 요청금액이 가장 큰 품목을 고릅니다. */
    private int indexOfLargest(List<RequestItem> items) {
        int best = 0;
        BigDecimal bestAmount = null;
        for (int i = 0; i < items.size(); i++) {
            BigDecimal amount =
                    items.get(i).amount() == null ? BigDecimal.ZERO : items.get(i).amount();
            if (bestAmount == null || amount.compareTo(bestAmount) > 0) {
                bestAmount = amount;
                best = i;
            }
        }
        return best;
    }

    /**
     * 종합본 금액 컬럼에 대응하는 비목그룹을 반환합니다.
     *
     * @param amountColumn 정규 컬럼 id (`devAmount`·`hwAmount`·`swAmount`)
     * @return 그 그룹의 비목코드 집합. 대응하는 그룹이 없으면 빈 집합
     */
    public static Set<String> groupOf(String amountColumn) {
        return switch (amountColumn == null ? "" : amountColumn) {
            case "devAmount" -> GROUP_DEV;
            case "hwAmount" -> GROUP_HW;
            case "swAmount" -> GROUP_SW;
            default -> Set.of();
        };
    }

    /**
     * 그 그룹에 드는 품목만 골라냅니다.
     *
     * @param all 사업의 활성 요청 품목 전체
     * @param group 비목그룹
     * @return 그룹에 드는 품목. 순서는 입력 순서를 유지합니다
     */
    public static List<RequestItem> itemsInGroup(List<RequestItem> all, Set<String> group) {
        List<RequestItem> out = new ArrayList<>();
        for (RequestItem item : all) {
            if (item.ioeC() != null && group.contains(item.ioeC().trim())) {
                out.add(item);
            }
        }
        return out;
    }

    /**
     * 자본예산 세 그룹 어디에도 들지 않는 품목을 골라냅니다.
     *
     * <p>편성요청서 반입이 1-2 시트의 일반관리비 품목도 {@code BITEMM}으로 보내므로, 정보화사업 하나에 자본 계열이 아닌 품목이 섞여 있습니다.
     * 이들은 종합본의 `일반관리비` 열을 목표액으로 하는 네 번째 그룹이 됩니다.
     *
     * @param all 사업의 활성 요청 품목 전체
     * @return 자본 계열이 아닌 품목
     */
    public static List<RequestItem> itemsOutsideCapitalGroups(List<RequestItem> all) {
        List<RequestItem> out = new ArrayList<>();
        for (RequestItem item : all) {
            String ioeC = item.ioeC() == null ? "" : item.ioeC().trim();
            if (!GROUP_DEV.contains(ioeC) && !GROUP_HW.contains(ioeC) && !GROUP_SW.contains(ioeC)) {
                out.add(item);
            }
        }
        return out;
    }
}
```

**주의:** 위 코드의 `ItemAllocation target Allocation`은 오타다. `ItemAllocation targetAllocation`으로 쓴다. 컴파일러가 바로 잡아 준다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.MigrationAllocationPlannerTest"
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/migration/service/MigrationAllocationPlanner.java src/test/java/com/kdb/it/domain/migration/service/MigrationAllocationPlannerTest.java && git diff --cached --stat && git commit -m "feat: 실효 편성률 배분 MigrationAllocationPlanner 추가"
```

---

## Task 6: 행 결정 계약 — 예약 컬럼 `__decision`

미매칭 행을 관리자가 `MATCH`·`CREATE_NEW`·`SKIP` 중 하나로 정한다. 기존 `CellOverride` 전송 경로와 `Candidate` 드롭다운을 그대로 재사용하고, 예약 컬럼 id 하나만 추가한다. DTO 구조 변경이 없어 프론트 계약이 흔들리지 않는다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/dto/RowDecision.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/dto/MigrationDto.java:130-135`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/dto/RowDecisionTest.java`

**Interfaces:**
- Produces:
  - `RowDecision.COLUMN = "__decision"` — 예약 컬럼 id. 어떤 시트의 정규 컬럼과도 겹치지 않는다
  - `enum RowDecision.Kind { MATCH, CREATE_NEW, SKIP }`
  - `record RowDecision(Kind kind, String pk)` — `MATCH`만 `pk`가 있다
  - `static RowDecision parse(String value)` — `"MATCH:PRJ-2026-0001"`·`"CREATE_NEW"`·`"SKIP"`. null·공백·미인식은 null 반환
  - `static String matchValue(String pk)` — `"MATCH:" + pk`
  - `static List<MigrationDto.Candidate> decisionCandidates(List<MigrationDto.Candidate> ledgerCandidates)` — 원장 후보의 `code`를 `MATCH:{pk}`로 감싸고 뒤에 `CREATE_NEW`·`SKIP` 두 항목을 붙인다
- `MigrationDto.CellDiagnostic.code`의 `allowableValues`에 `LEDGER_NOT_MATCHED`, `LEDGER_AMBIGUOUS`, `ITEM_BASE_ZERO`, `AMOUNT_ADJUSTED`, `RATE_RECONCILE_MISMATCH`를 더하고 `DUPLICATE_EXISTS`는 남긴다(조정 계획 중복에 계속 쓴다)

- [ ] **Step 1: 결정 파싱의 실패 테스트를 쓴다**

```java
package com.kdb.it.domain.migration.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RowDecisionTest {

    @Test
    @DisplayName("parse_MATCH는_원장_PK를_담는다")
    void parse_MATCH는_원장_PK를_담는다() {
        RowDecision decision = RowDecision.parse("MATCH:PRJ-2026-0001");

        assertThat(decision.kind()).isEqualTo(RowDecision.Kind.MATCH);
        assertThat(decision.pk()).isEqualTo("PRJ-2026-0001");
    }

    @Test
    @DisplayName("parse_CREATE_NEW와_SKIP은_PK가_없다")
    void parse_CREATE_NEW와_SKIP은_PK가_없다() {
        assertThat(RowDecision.parse("CREATE_NEW").kind()).isEqualTo(RowDecision.Kind.CREATE_NEW);
        assertThat(RowDecision.parse("CREATE_NEW").pk()).isNull();
        assertThat(RowDecision.parse("SKIP").kind()).isEqualTo(RowDecision.Kind.SKIP);
    }

    @Test
    @DisplayName("parse_미인식_값은_null이다")
    void parse_미인식_값은_null이다() {
        assertThat(RowDecision.parse(null)).isNull();
        assertThat(RowDecision.parse("")).isNull();
        assertThat(RowDecision.parse("MATCH:")).isNull();
        assertThat(RowDecision.parse("무엇인가")).isNull();
    }

    @Test
    @DisplayName("decisionCandidates_원장후보_뒤에_생성과_제외가_붙는다")
    void decisionCandidates_원장후보_뒤에_생성과_제외가_붙는다() {
        List<MigrationDto.Candidate> candidates =
                RowDecision.decisionCandidates(
                        List.of(new MigrationDto.Candidate("PRJ-2026-0001", "웹한글 기안기 도입")));

        assertThat(candidates)
                .extracting(MigrationDto.Candidate::code)
                .containsExactly("MATCH:PRJ-2026-0001", "CREATE_NEW", "SKIP");
        assertThat(candidates.get(0).label()).isEqualTo("기존 사업에 편성: 웹한글 기안기 도입");
    }

    @Test
    @DisplayName("COLUMN은_어떤_시트의_정규컬럼과도_겹치지_않는다")
    void COLUMN은_어떤_시트의_정규컬럼과도_겹치지_않는다() {
        for (SheetKind kind : SheetKind.values()) {
            assertThat(MigrationColumns.of(kind)).doesNotContain(RowDecision.COLUMN);
        }
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.dto.RowDecisionTest"
```

Expected: 컴파일 실패 — `RowDecision` 클래스 없음

- [ ] **Step 3: `RowDecision`을 만든다**

```java
package com.kdb.it.domain.migration.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * 종합본 한 행을 어떻게 처리할지에 대한 관리자의 결정입니다.
 *
 * <p>전송은 기존 {@link MigrationDto.CellOverride} 경로를 그대로 씁니다 — 예약 컬럼 {@link #COLUMN}에 이 클래스가 정의한 문자열을
 * 담습니다. 결정 전용 DTO를 새로 두면 dry-run·commit 요청 계약이 갈라지고 프론트의 보정값 병합 코드가 두 벌이 되므로, 컬럼 id 하나만 늘립니다.
 *
 * <p>후보 드롭다운도 {@link MigrationDto.Candidate}를 그대로 쓰므로 화면은 다른 진단과 같은 위젯으로 결정을 받습니다.
 *
 * @param kind 결정 종류
 * @param pk 매칭 대상 원장 PK. {@link Kind#MATCH}가 아니면 null
 */
public record RowDecision(Kind kind, String pk) {

    /** 결정을 담는 예약 컬럼 id입니다. 어떤 시트의 정규 컬럼과도 겹치지 않습니다. */
    public static final String COLUMN = "__decision";

    private static final String MATCH_PREFIX = "MATCH:";

    /** 결정 종류입니다. */
    public enum Kind {
        /** 후보로 제시된 기존 원장에 편성합니다. */
        MATCH,
        /** 원장을 새로 만들고 편성합니다. 요청서 없이 종합본만 있는 최초 이관용입니다. */
        CREATE_NEW,
        /** 이 행을 편성 대상에서 제외합니다. */
        SKIP
    }

    /**
     * 보정값 문자열을 결정으로 해석합니다.
     *
     * @param value 보정값. {@code MATCH:{PK}}·{@code CREATE_NEW}·{@code SKIP}
     * @return 해석된 결정. null·공백·미인식 형식이면 null (결정하지 않은 것으로 봅니다)
     */
    public static RowDecision parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.startsWith(MATCH_PREFIX)) {
            String pk = trimmed.substring(MATCH_PREFIX.length()).trim();
            return pk.isEmpty() ? null : new RowDecision(Kind.MATCH, pk);
        }
        if (Kind.CREATE_NEW.name().equals(trimmed)) {
            return new RowDecision(Kind.CREATE_NEW, null);
        }
        if (Kind.SKIP.name().equals(trimmed)) {
            return new RowDecision(Kind.SKIP, null);
        }
        return null;
    }

    /**
     * 원장 PK를 매칭 결정 값으로 감쌉니다.
     *
     * @param pk 원장 PK
     * @return 보정값 문자열
     */
    public static String matchValue(String pk) {
        return MATCH_PREFIX + pk;
    }

    /**
     * 원장 후보를 결정 드롭다운 선택지로 바꿉니다.
     *
     * <p>후보를 비워 두면 화면에 드롭다운이 그려지지 않아 손댈 방법이 없으므로, 원장 후보가 없어도 {@code CREATE_NEW}·{@code SKIP} 두
     * 항목은 항상 붙입니다.
     *
     * @param ledgerCandidates 매처가 낸 원장 후보 (code=PK, label=이름)
     * @return 결정 선택지
     */
    public static List<MigrationDto.Candidate> decisionCandidates(
            List<MigrationDto.Candidate> ledgerCandidates) {
        List<MigrationDto.Candidate> out = new ArrayList<>();
        for (MigrationDto.Candidate candidate : ledgerCandidates) {
            out.add(
                    new MigrationDto.Candidate(
                            matchValue(candidate.code()), "기존 사업에 편성: " + candidate.label()));
        }
        out.add(new MigrationDto.Candidate(Kind.CREATE_NEW.name(), "원장을 새로 만들고 편성"));
        out.add(new MigrationDto.Candidate(Kind.SKIP.name(), "이 행은 편성하지 않음"));
        return out;
    }
}
```

- [ ] **Step 4: 진단 코드 목록을 갱신한다**

`MigrationDto.java:130-135`의 `allowableValues`를 교체한다.

```java
                            allowableValues = {
                                "ORG_UNRESOLVED", "ORG_AMBIGUOUS", "USER_UNRESOLVED",
                                "USER_AMBIGUOUS", "CODE_UNRESOLVED", "REQUIRED_MISSING",
                                "DUPLICATE_EXISTS", "LENGTH_EXCEEDED", "PROJECT_NOT_FOUND",
                                "AMOUNT_MISMATCH", "RATE_OUT_OF_RANGE", "DATE_UNPARSEABLE",
                                "LEDGER_NOT_MATCHED", "LEDGER_AMBIGUOUS", "ITEM_BASE_ZERO",
                                "AMOUNT_ADJUSTED", "RATE_RECONCILE_MISMATCH"
                            })
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.dto.*"
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/migration/dto/RowDecision.java src/main/java/com/kdb/it/domain/migration/dto/MigrationDto.java src/test/java/com/kdb/it/domain/migration/dto/RowDecisionTest.java && git diff --cached --stat && git commit -m "feat: 행 결정 계약(RowDecision)과 신규 진단 코드 추가"
```

---

## Task 7: 어댑터를 `AllocationIntent`로 전환

어댑터가 내던 `RateIntent`(사업 하나에 편성률 하나)로는 비목그룹마다 다른 목표액을 담지 못한다. `AllocationIntent`로 바꾸고, 원장 생성요청(`costs`·`projects`)은 남기되 `CREATE_NEW` 결정이 난 행에만 채워지도록 오케스트레이터가 골라 쓴다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/AllocationIntent.java`
- Delete: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/RateIntent.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/AdapterOutput.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/CapitalProjectSheetAdapter.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/CostSheetAdapter.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/DelegatedBudgetSheetAdapter.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/PlanAdjustmentSheetAdapter.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationLookupIndex.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationIoeCatalogReader.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/dto/MigrationColumns.java:35-55`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/adapter/CapitalProjectSheetAdapterTest.java`, `CostSheetAdapterTest.java`, `PlanAdjustmentSheetAdapterTest.java`, `DelegatedBudgetSheetAdapterTest.java`

**Interfaces:**
- Consumes: Task 3의 `MigrationYearSnapshot.costDeptKey`
- Produces:
  - `record AllocationIntent(SheetKind sheet, int excelRow, String orcTb, MatchKey matchKey, Map<String, BigDecimal> targetByColumn, BigDecimal declaredBase)`
  - `record AllocationIntent.MatchKey(Type type, String normalizedName, String deptCode, String ioeC, String vendorName, String contractName)`
  - `enum AllocationIntent.MatchKey.Type { PROJECT_NAME, ORDINARY_DEPT, COST_DEPT_KEY }`
  - `AdapterOutput(List<CostDto.CreateRequest> costs, List<ProjectDto.CreateRequest> projects, List<PlanIntent> plans, List<AllocationIntent> allocations)`
  - `MigrationLookupIndex.generalExpenseRate(): BigDecimal` — `DUP_IOE_MNGC` 공통코드의 편성률. 없으면 `100`
  - `targetByColumn`의 키는 `devAmount`·`hwAmount`·`swAmount`·`generalAmount`(정보화사업) 또는 `costAmount`(전산업무비·위임예산)
  - `MigrationColumns.CAPITAL_PROJECT`에 `devAdjustAmount`·`hwAdjustAmount`·`swAdjustAmount` 3열 추가
- `costs`·`projects` 목록의 원소 순서는 `sheet.rows()` 순서와 **1:1로 같다**. Task 9가 인덱스로 행과 짝지어 `CREATE_NEW` 행만 고른다

- [ ] **Step 1: 자본예산 어댑터의 실패 테스트를 쓴다**

`CapitalProjectSheetAdapterTest.java`에 추가한다.

```java
@Test
@DisplayName("adapt_조정비율을_곱한_비목그룹별_목표액을_낸다")
void adapt_조정비율을_곱한_비목그룹별_목표액을_낸다() {
    MigrationDto.SheetPayload sheet =
            sheetOf(
                    Map.of(
                            "projectName", "웹한글 기안기 도입",
                            "devAmount", "",
                            "hwAmount", "",
                            "swAmount", "1406",
                            "adjustRate", "0.7",
                            "swAdjustAmount", "984"));

    AdapterOutput output = adapter.adapt(sheet, context());

    AllocationIntent intent = output.allocations().get(0);
    assertThat(intent.orcTb()).isEqualTo("BPROJM");
    assertThat(intent.matchKey().type())
            .isEqualTo(AllocationIntent.MatchKey.Type.PROJECT_NAME);
    assertThat(intent.matchKey().normalizedName()).isEqualTo("웹한글기안기도입");
    // 백만원 단위 × 조정비율 0.7
    assertThat(intent.targetByColumn().get("swAmount")).isEqualByComparingTo("984200000");
    assertThat(intent.targetByColumn().get("devAmount")).isEqualByComparingTo("0");
    assertThat(intent.declaredBase()).isEqualByComparingTo("1406000000");
}

@Test
@DisplayName("adapt_원장_생성요청은_행_순서를_그대로_유지한다")
void adapt_원장_생성요청은_행_순서를_그대로_유지한다() {
    MigrationDto.SheetPayload sheet =
            sheetOf(
                    Map.of("projectName", "사업 가", "swAmount", "100", "adjustRate", "1"),
                    Map.of("projectName", "사업 나", "swAmount", "200", "adjustRate", "1"));

    AdapterOutput output = adapter.adapt(sheet, context());

    assertThat(output.projects()).hasSize(2);
    assertThat(output.projects().get(0).getAbusNm()).isEqualTo("사업 가");
    assertThat(output.allocations()).hasSize(2);
    assertThat(output.allocations().get(1).matchKey().normalizedName()).isEqualTo("사업나");
}
```

`sheetOf(Map...)`은 이 테스트 클래스의 기존 헬퍼를 재사용한다. 없으면 다음을 추가한다.

```java
private MigrationDto.SheetPayload sheetOf(Map<String, String>... rows) {
    List<MigrationDto.NormalizedRow> normalized = new ArrayList<>();
    int excelRow = 2;
    for (Map<String, String> row : rows) {
        Map<String, String> cells = new LinkedHashMap<>();
        for (String column : MigrationColumns.of(SheetKind.CAPITAL_PROJECT)) {
            cells.put(column, row.getOrDefault(column, ""));
        }
        normalized.add(new MigrationDto.NormalizedRow(excelRow++, cells));
    }
    return new MigrationDto.SheetPayload(SheetKind.CAPITAL_PROJECT, "2026", normalized);
}
```

- [ ] **Step 2: 전산업무비·부문계획 어댑터의 실패 테스트를 쓴다**

`CostSheetAdapterTest.java`:

```java
@Test
@DisplayName("adapt_전산업무비는_부서기준_매칭키와_DUP_IOE_MNGC_편성률을_쓴다")
void adapt_전산업무비는_부서기준_매칭키와_DUP_IOE_MNGC_편성률을_쓴다() {
    MigrationDto.SheetPayload sheet =
            sheetOf(
                    Map.of(
                            "abusCode", "571",
                            "ioeName", "유지보수료",
                            "deptName", "IT기획부",
                            "vendorName", "커브",
                            "requestDetail", "올인원워크스페이스",
                            "currency", "KRW",
                            "krwAmount", "15401"));

    AdapterOutput output = adapter.adapt(sheet, context());

    AllocationIntent intent = output.allocations().get(0);
    assertThat(intent.orcTb()).isEqualTo("BCOSTM");
    assertThat(intent.matchKey().type())
            .isEqualTo(AllocationIntent.MatchKey.Type.COST_DEPT_KEY);
    assertThat(intent.matchKey().deptCode()).isEqualTo("0210");
    assertThat(intent.matchKey().ioeC()).isEqualTo("011");
    assertThat(intent.matchKey().contractName()).isEqualTo("올인원워크스페이스");
    // 천원 단위 × DUP_IOE_MNGC(100%)
    assertThat(intent.targetByColumn().get("costAmount")).isEqualByComparingTo("15401000");
}
```

`PlanAdjustmentSheetAdapterTest.java`:

```java
@Test
@DisplayName("adapt_하반기_조정은_확정금액을_그대로_목표액으로_낸다")
void adapt_하반기_조정은_확정금액을_그대로_목표액으로_낸다() {
    MigrationDto.SheetPayload sheet =
            sheetOf(
                    Map.of(
                            "projectName", "웹한글 기안기 도입",
                            "devAmount", "0",
                            "hwAmount", "0",
                            "swAmount", "416"));

    AdapterOutput output = adapter.adapt(sheet, context());

    AllocationIntent intent = output.allocations().get(0);
    assertThat(intent.targetByColumn().get("swAmount")).isEqualByComparingTo("416000000");
    assertThat(intent.targetByColumn().get("devAmount")).isEqualByComparingTo("0");
    assertThat(intent.declaredBase()).isNull();
    // 품목을 만들지 않는다 — BITEMM 버전 교체를 폐지했다
    assertThat(output.projects()).isEmpty();
}
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.adapter.*"
```

Expected: 컴파일 실패 — `AllocationIntent` 없음, `output.allocations()` 없음

- [ ] **Step 4: `AllocationIntent`를 만들고 `RateIntent`를 지운다**

```java
package com.kdb.it.domain.migration.service.adapter;

import com.kdb.it.domain.migration.dto.SheetKind;
import java.math.BigDecimal;
import java.util.Map;

/**
 * 편성 배분 의도입니다. 어댑터가 "어느 원장에 얼마를 편성할지"만 말하고, 실제 매칭과 배분은
 * {@code MigrationLedgerMatcher}·{@code MigrationAllocationPlanner}가 맡습니다.
 *
 * <p>종전 {@code RateIntent}는 사업 하나에 편성률 하나였습니다. 종합본은 개발비·기계장치·기타무형 세 그룹에 각각 다른 금액을 주고, 하반기 조정은
 * 비율이 아니라 확정 금액을 주므로 편성률 하나로는 담기지 않습니다.
 *
 * @param sheet 시트 종류 (진단 좌표)
 * @param excelRow 엑셀 행 번호 (진단 좌표)
 * @param orcTb 대상 원본 테이블 — 접두어 없는 {@code BPROJM} 또는 {@code BCOSTM}
 * @param matchKey 기존 원장을 찾을 키
 * @param targetByColumn 정규 금액 컬럼 id → 목표 편성액(원 단위). 정보화사업은 {@code devAmount}·{@code
 *     hwAmount}·{@code swAmount}·{@code generalAmount}, 전산업무비·위임예산은 {@code costAmount}
 * @param declaredBase 종합본이 말한 요청 기준액 합계(원 단위). 요청 원장과 대사해 {@code AMOUNT_ADJUSTED}를 판정합니다.
 *     대사할 값이 없으면 null (하반기 조정은 확정금액만 있고 기준액이 없습니다)
 */
public record AllocationIntent(
        SheetKind sheet,
        int excelRow,
        String orcTb,
        MatchKey matchKey,
        Map<String, BigDecimal> targetByColumn,
        BigDecimal declaredBase) {

    /**
     * 기존 원장을 찾는 키입니다. 시트마다 찾는 방식이 다릅니다(설계 §4.1).
     *
     * @param type 매칭 방식
     * @param normalizedName 정규화 사업명. {@code PROJECT_NAME}에서만 씁니다
     * @param deptCode 부서코드. {@code ORDINARY_DEPT}·{@code COST_DEPT_KEY}에서 씁니다
     * @param ioeC 비목코드. {@code COST_DEPT_KEY}에서만 씁니다
     * @param vendorName 계약상대처명. {@code COST_DEPT_KEY}에서만 씁니다
     * @param contractName 계약명. {@code COST_DEPT_KEY}에서만 씁니다
     */
    public record MatchKey(
            Type type,
            String normalizedName,
            String deptCode,
            String ioeC,
            String vendorName,
            String contractName) {

        /** 매칭 방식입니다. */
        public enum Type {
            /** 정규화 사업명으로 정보화사업을 찾습니다. */
            PROJECT_NAME,
            /** 부서코드로 경상사업({@code ODN_YN='Y'})을 찾습니다. */
            ORDINARY_DEPT,
            /** 부서 기준 자연키로 전산업무비를 찾습니다. */
            COST_DEPT_KEY
        }

        /** 정규화 사업명 매칭 키입니다. */
        public static MatchKey ofProjectName(String normalizedName) {
            return new MatchKey(Type.PROJECT_NAME, normalizedName, null, null, null, null);
        }

        /** 부서코드 기준 경상사업 매칭 키입니다. */
        public static MatchKey ofOrdinaryDept(String deptCode) {
            return new MatchKey(Type.ORDINARY_DEPT, null, deptCode, null, null, null);
        }

        /** 부서 기준 전산업무비 매칭 키입니다. */
        public static MatchKey ofCost(
                String deptCode, String ioeC, String vendorName, String contractName) {
            return new MatchKey(
                    Type.COST_DEPT_KEY, null, deptCode, ioeC, vendorName, contractName);
        }
    }
}
```

`RateIntent.java`를 삭제한다.

- [ ] **Step 5: `AdapterOutput`을 바꾼다**

```java
/**
 * 어댑터 변환 결과입니다. 비어 있는 목록은 그 어댑터가 그 종류를 만들지 않는다는 뜻입니다.
 *
 * <p>{@code costs}·{@code projects}의 원소 순서는 {@code sheet.rows()} 순서와 1:1로 같습니다.
 * 오케스트레이터가 인덱스로 행과 짝지어 {@code CREATE_NEW} 결정이 난 행만 골라 쓰기 때문에, 어댑터는 행을 건너뛰지 않고
 * **모든 행에 대해** 생성요청을 만듭니다.
 *
 * @param costs 전산업무비 생성요청 (행 순서 유지)
 * @param projects 사업 생성요청 (품목 포함, 행 순서 유지)
 * @param plans 부문계획 조정 의도
 * @param allocations 편성 배분 의도 — 매칭·배분 단계에 넘깁니다
 */
public record AdapterOutput(
        List<CostDto.CreateRequest> costs,
        List<ProjectDto.CreateRequest> projects,
        List<PlanIntent> plans,
        List<AllocationIntent> allocations) {

    /** 아무것도 만들지 않은 결과입니다. */
    public static AdapterOutput empty() {
        return new AdapterOutput(List.of(), List.of(), List.of(), List.of());
    }
}
```

- [ ] **Step 6: `MigrationLookupIndex`에 일반관리비 편성률을 더한다**

`MigrationLookupIndex`에 컴포넌트 `BigDecimal generalExpenseRate`를 추가하고, `MigrationIoeCatalogReader`에 다음 메서드를 더한다.

```java
    /**
     * 일반관리비 기본 편성률을 읽습니다.
     *
     * <p>{@code /budget/work} 화면이 쓰는 값과 같은 출처입니다({@code DUP_IOE} 그룹의 코드인스턴스명 {@code
     * DUP_IOE_MNGC}, 값은 {@code CO_CDVA_NM}). 종합본 `전체취합(국내외)` 시트에는 조정률 열이 없으므로 이 값이 전산업무비 편성률이
     * 됩니다. 리터럴 100을 박지 않는 이유는 이 기준이 해마다 바뀔 수 있기 때문입니다.
     *
     * @return 편성률(0~100). 코드가 없거나 숫자가 아니면 100
     */
    public BigDecimal generalExpenseRate() {
        for (Ccodem code : ioeCatalog.findCodes("DUP_IOE")) {
            if (!"DUP_IOE_MNGC".equals(code.getCTp())) {
                continue;
            }
            try {
                return new BigDecimal(code.getCoCdvaNm().trim());
            } catch (NullPointerException | NumberFormatException ignored) {
                break;
            }
        }
        return BigDecimal.valueOf(100);
    }
```

`MigrationImportService.lookupIndex()`가 이 값을 인덱스에 실어 준다. `ioeCatalog`·`Ccodem`·`getCoCdvaNm()`의 실제 이름은 `MigrationIoeCatalogReader`의 기존 코드에 맞춘다.

- [ ] **Step 7: 자본예산 어댑터를 바꾼다**

`CapitalProjectSheetAdapter.adapt`의 `rates` 조립부를 다음으로 바꾼다. `projects.add(request);`는 그대로 두고(모든 행에 대해 만든다), 그 뒤에 붙인다.

```java
            BigDecimal rate =
                    AdapterSupport.rateFraction(
                            AdapterSupport.cellOf(sheet, row, "adjustRate", ctx));
            BigDecimal dev = amountOf(sheet, row, ctx, "devAmount");
            BigDecimal hw = amountOf(sheet, row, ctx, "hwAmount");
            BigDecimal sw = amountOf(sheet, row, ctx, "swAmount");

            Map<String, BigDecimal> targets = new LinkedHashMap<>();
            targets.put("devAmount", dev.multiply(rate));
            targets.put("hwAmount", hw.multiply(rate));
            targets.put("swAmount", sw.multiply(rate));

            allocations.add(
                    new AllocationIntent(
                            sheet.kind(),
                            row.excelRow(),
                            "BPROJM",
                            AllocationIntent.MatchKey.ofProjectName(
                                    MigrationYearSnapshot.normalizeName(projectName)),
                            targets,
                            dev.add(hw).add(sw)));
```

헬퍼를 클래스 하단에 추가한다.

```java
    /** 금액 셀을 원 단위로 읽습니다. 비었거나 음수면 0원입니다. */
    private BigDecimal amountOf(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            AdapterContext ctx,
            String column) {
        BigDecimal amount =
                AdapterSupport.amount(AdapterSupport.cellOf(sheet, row, column, ctx), sheet.kind());
        return (amount == null || amount.compareTo(BigDecimal.ZERO) < 0)
                ? BigDecimal.ZERO
                : amount;
    }
```

`AdapterSupport`에 다음을 추가한다. 기존 `ratePercent(String)`(정수 %)는 남겨 두고 새 메서드를 더한다 — 배분은 소수 비율이 필요하다.

```java
    /**
     * 조정비율 셀을 소수 배수로 읽습니다.
     *
     * <p>엑셀 `조정구분` 시트가 `1`·`0.7`처럼 배수로 적기 때문에 값을 그대로 씁니다. 비었거나 숫자가 아니면 조정하지 않은 것으로 보고 1을
     * 돌려줍니다 — 0을 돌려주면 조정비율 칸이 빈 사업의 편성액이 통째로 0이 됩니다.
     *
     * @param raw 조정비율 셀 원문
     * @return 배수 (0.7·1 등). 파싱 실패는 1
     */
    public static BigDecimal rateFraction(String raw) {
        if (raw == null || raw.isBlank()) {
            return BigDecimal.ONE;
        }
        try {
            return new BigDecimal(raw.trim().replace(",", ""));
        } catch (NumberFormatException ignored) {
            return BigDecimal.ONE;
        }
    }
```

`return new AdapterOutput(List.of(), projects, List.of(), rates);`를 `return new AdapterOutput(List.of(), projects, List.of(), allocations);`로 바꾸고 `List<RateIntent> rates`를 `List<AllocationIntent> allocations`로 선언한다.

- [ ] **Step 8: 전산업무비 어댑터를 바꾼다**

`CostSheetAdapter.adapt`의 `rates.add(...)`를 교체한다.

```java
            BigDecimal requestAmount = request.getCostTotXpAmt();
            BigDecimal base = requestAmount == null ? BigDecimal.ZERO : requestAmount;
            BigDecimal rate = ctx.index().generalExpenseRate();

            allocations.add(
                    new AllocationIntent(
                            sheet.kind(),
                            row.excelRow(),
                            "BCOSTM",
                            AllocationIntent.MatchKey.ofCost(deptCode, ioeC, vendor, contractName),
                            Map.of(
                                    "costAmount",
                                    base.multiply(rate)
                                            .divide(
                                                    BigDecimal.valueOf(100),
                                                    3,
                                                    java.math.RoundingMode.HALF_UP)),
                            base));
```

- [ ] **Step 9: 위임예산 어댑터를 바꾼다**

`DelegatedBudgetSheetAdapter`는 부점명으로 forward-fill 그룹을 만든다. 그룹마다 `AllocationIntent` 하나를 낸다.

```java
            // 위임예산 시트에는 조정비율 열이 없고 금액이 이미 원 단위 확정값이다. 편성률 100%가
            // 곧 "적어 낸 금액 그대로"이므로 목표액을 금액 합계로 둔다(종전 RateIntent(…, 100)과 같다).
            allocations.add(
                    new AllocationIntent(
                            sheet.kind(),
                            firstExcelRowOfGroup,
                            "BPROJM",
                            AllocationIntent.MatchKey.ofOrdinaryDept(branchDeptCode),
                            Map.of("costAmount", groupTotalKrw),
                            groupTotalKrw));
```

`firstExcelRowOfGroup`은 그 부점 그룹의 첫 행 번호이고 `groupTotalKrw`는 HW·SW 원화 합계다. 기존 그룹핑 코드가 이미 두 값을 들고 있으므로 변수만 잇는다.

- [ ] **Step 10: 부문계획 어댑터를 바꾼다**

`PlanAdjustmentSheetAdapter.adapt`에서 `rates.add(new RateIntent("BPROJM", normalizedName, 100));`를 교체한다.

```java
            Map<String, BigDecimal> targets = new LinkedHashMap<>();
            targets.put("devAmount", orZero(positiveAmount(sheet, row, ctx, "devAmount")));
            targets.put("hwAmount", orZero(positiveAmount(sheet, row, ctx, "hwAmount")));
            targets.put("swAmount", orZero(positiveAmount(sheet, row, ctx, "swAmount")));

            allocations.add(
                    new AllocationIntent(
                            sheet.kind(),
                            row.excelRow(),
                            "BPROJM",
                            AllocationIntent.MatchKey.ofProjectName(normalizedName),
                            targets,
                            // 조정본은 확정금액만 주고 요청 기준액이 없어 대사할 상대가 없다
                            null));
```

`orZero` 헬퍼를 추가한다.

```java
    /** null 금액을 0원으로 접습니다. 목표액 0은 "그 비목그룹을 0원으로 편성"이라는 뜻이라 생략하지 않습니다. */
    private static BigDecimal orZero(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount;
    }
```

클래스 Javadoc의 "`BITEMM`을 이 금액으로 버전 교체하고 편성률 100을 적용합니다" 문장을 다음으로 고친다.

```
 * <p>조정액은 편성요청액에 비율을 곱한 값이 아니라 확정 금액입니다(품의·계약 반영). 요청 원장({@code BITEMM})은 건드리지 않고 이 금액을 목표
 * 편성액으로 넘겨, {@code MigrationAllocationPlanner}가 실효 편성률로 환산합니다. 부서가 제출한 요청 품목이 활성 원장에 그대로 남아야
 * 요청 대비 편성 비교가 성립하기 때문입니다.
```

- [ ] **Step 11: 조정 3열을 정규 컬럼에 더한다**

`MigrationColumns.java`의 `CAPITAL_PROJECT` 목록에서 `"adjustRate"` 다음에 세 항목을 넣는다.

```java
                    "adjustRate",
                    "devAdjustAmount",
                    "hwAdjustAmount",
                    "swAdjustAmount",
                    "delegationLabel");
```

Javadoc도 고친다: `편성요청 3열과 조정비율·조정 3열까지 받습니다.`

- [ ] **Step 12: 테스트를 돌려 통과를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.adapter.*" --tests "com.kdb.it.domain.migration.dto.*"
```

Expected: PASS. `MigrationValidator`·`MigrationImportService`의 컴파일 오류는 Task 8·9에서 해소되므로 이 시점에는 전체 빌드가 깨져 있을 수 있다.

- [ ] **Step 13: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/migration/service/adapter/ src/main/java/com/kdb/it/domain/migration/service/MigrationLookupIndex.java src/main/java/com/kdb/it/domain/migration/service/MigrationIoeCatalogReader.java src/main/java/com/kdb/it/domain/migration/dto/MigrationColumns.java src/test/java/com/kdb/it/domain/migration/service/adapter/ && git diff --cached --stat && git commit -m "feat: 어댑터가 편성률 대신 비목그룹 목표액(AllocationIntent)을 낸다"
```

---

## Task 8: 진단 개편 — 매칭 진단 신설, 중복 진단 제거, 원장 검증 범위 축소

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationMatchDiagnostics.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationValidator.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationMatchDiagnosticsTest.java`, `MigrationValidatorTest.java`

**Interfaces:**
- Consumes: Task 4의 `MigrationLedgerMatcher.Match`, Task 5의 `MigrationAllocationPlanner.Allocation`, Task 6의 `RowDecision`
- Produces:
  - `record MigrationMatchDiagnostics.Resolved(String pk, RowDecision.Kind action, List<MigrationDto.CellDiagnostic> diagnostics)`
    - `action`이 `MATCH`면 `pk`가 채워지고, `CREATE_NEW`·`SKIP`이면 `pk`는 null
    - `action`이 null이면 결정되지 않은 것 — `diagnostics`에 BLOCKER가 들어 있다
  - `Resolved resolve(SheetPayload sheet, AllocationIntent intent, Data snapshot, Map<String,String> overrides)`
  - `List<CellDiagnostic> checkAllocation(SheetPayload sheet, AllocationIntent intent, String pk, Data snapshot, MigrationAllocationPlanner planner)` — `ITEM_BASE_ZERO`·`AMOUNT_ADJUSTED`
  - `List<CellDiagnostic> checkRateReconcile(SheetPayload sheet, NormalizedRow row, Map<String,String> overrides)` — `RATE_RECONCILE_MISMATCH`
- `MigrationValidator`는 시그니처에 `Set<Integer> createNewRowsBySheet`를 받아 원장 검증을 그 행에만 건다:
  - `List<CellDiagnostic> validate(List<SheetPayload> sheets, MigrationLookupIndex index, Data snapshot, Map<String,String> overrides, Map<SheetKind, Set<Integer>> createNewRows)`

- [ ] **Step 1: 매칭 진단의 실패 테스트를 쓴다**

```java
@Test
@DisplayName("resolve_매칭되면_결정없이_PK를_돌려준다")
void resolve_매칭되면_결정없이_PK를_돌려준다() {
    // snapshot에 '웹한글기안기도입' → PRJ-2026-0001 이 있는 상태
    MigrationMatchDiagnostics.Resolved resolved =
            diagnostics.resolve(sheet, intentOfProject("웹한글기안기도입"), snapshot, Map.of());

    assertThat(resolved.action()).isEqualTo(RowDecision.Kind.MATCH);
    assertThat(resolved.pk()).isEqualTo("PRJ-2026-0001");
    assertThat(resolved.diagnostics()).isEmpty();
}

@Test
@DisplayName("resolve_미매칭이면_결정을_요구하는_BLOCKER를_낸다")
void resolve_미매칭이면_결정을_요구하는_BLOCKER를_낸다() {
    MigrationMatchDiagnostics.Resolved resolved =
            diagnostics.resolve(sheet, intentOfProject("없는사업"), snapshot, Map.of());

    assertThat(resolved.action()).isNull();
    MigrationDto.CellDiagnostic diagnostic = resolved.diagnostics().get(0);
    assertThat(diagnostic.code()).isEqualTo("LEDGER_NOT_MATCHED");
    assertThat(diagnostic.severity()).isEqualTo(MigrationDto.Severity.BLOCKER);
    assertThat(diagnostic.column()).isEqualTo(RowDecision.COLUMN);
    assertThat(diagnostic.candidates())
            .extracting(MigrationDto.Candidate::code)
            .contains("MATCH:PRJ-2026-0001", "CREATE_NEW", "SKIP");
}

@Test
@DisplayName("resolve_관리자가_고른_결정이_있으면_그대로_따른다")
void resolve_관리자가_고른_결정이_있으면_그대로_따른다() {
    Map<String, String> overrides =
            Map.of(
                    MigrationValidator.overrideKey(SheetKind.CAPITAL_PROJECT, 2, RowDecision.COLUMN),
                    "CREATE_NEW");

    MigrationMatchDiagnostics.Resolved resolved =
            diagnostics.resolve(sheet, intentOfProject("없는사업"), snapshot, overrides);

    assertThat(resolved.action()).isEqualTo(RowDecision.Kind.CREATE_NEW);
    assertThat(resolved.pk()).isNull();
    assertThat(resolved.diagnostics()).isEmpty();
}

@Test
@DisplayName("checkAllocation_요청합계가_0인데_목표액이_있으면_BLOCKER다")
void checkAllocation_요청합계가_0인데_목표액이_있으면_BLOCKER다() {
    // snapshot의 PRJ-2026-0001 품목 금액이 전부 0인 상태
    List<MigrationDto.CellDiagnostic> out =
            diagnostics.checkAllocation(
                    sheet, intentWithTarget("swAmount", "416000000"), "PRJ-2026-0001", snapshot,
                    planner);

    assertThat(out).extracting(MigrationDto.CellDiagnostic::code).contains("ITEM_BASE_ZERO");
}

@Test
@DisplayName("checkAllocation_종합본_기준액이_요청_원장과_다르면_WARNING이다")
void checkAllocation_종합본_기준액이_요청_원장과_다르면_WARNING이다() {
    // 원장 품목 합계 1,406,000,000 / 종합본 declaredBase 1,200,000,000
    List<MigrationDto.CellDiagnostic> out =
            diagnostics.checkAllocation(
                    sheet, intentWithDeclaredBase("1200000000"), "PRJ-2026-0001", snapshot, planner);

    MigrationDto.CellDiagnostic diagnostic =
            out.stream().filter(d -> "AMOUNT_ADJUSTED".equals(d.code())).findFirst().orElseThrow();
    assertThat(diagnostic.severity()).isEqualTo(MigrationDto.Severity.WARNING);
}

@Test
@DisplayName("checkRateReconcile_조정열과_기준액곱이_어긋나면_WARNING이다")
void checkRateReconcile_조정열과_기준액곱이_어긋나면_WARNING이다() {
    MigrationDto.NormalizedRow row =
            rowOf(Map.of("swAmount", "1406", "adjustRate", "0.7", "swAdjustAmount", "500"));

    List<MigrationDto.CellDiagnostic> out =
            diagnostics.checkRateReconcile(sheet, row, Map.of());

    assertThat(out)
            .extracting(MigrationDto.CellDiagnostic::code)
            .containsExactly("RATE_RECONCILE_MISMATCH");
}

@Test
@DisplayName("checkRateReconcile_반올림_차이는_통과한다")
void checkRateReconcile_반올림_차이는_통과한다() {
    // 1406 × 0.7 = 984.2 인데 엑셀은 984로 적었다 — 1 미만 차이는 반올림으로 본다
    MigrationDto.NormalizedRow row =
            rowOf(Map.of("swAmount", "1406", "adjustRate", "0.7", "swAdjustAmount", "984"));

    assertThat(diagnostics.checkRateReconcile(sheet, row, Map.of())).isEmpty();
}
```

- [ ] **Step 2: 원장 검증 범위 축소의 실패 테스트를 쓴다**

`MigrationValidatorTest.java`에 추가한다.

```java
@Test
@DisplayName("validate_매칭된_행에는_길이초과_검증을_걸지_않는다")
void validate_매칭된_행에는_길이초과_검증을_걸지_않는다() {
    MigrationDto.SheetPayload sheet =
            capitalSheet(Map.of("projectName", "가".repeat(150), "swAmount", "100"));

    // createNewRows가 비어 있다 = 이 행은 매칭됐다
    List<MigrationDto.CellDiagnostic> out =
            validator.validate(List.of(sheet), index, snapshot, Map.of(), Map.of());

    assertThat(out).extracting(MigrationDto.CellDiagnostic::code).doesNotContain("LENGTH_EXCEEDED");
}

@Test
@DisplayName("validate_CREATE_NEW_행에는_길이초과_검증을_건다")
void validate_CREATE_NEW_행에는_길이초과_검증을_건다() {
    MigrationDto.SheetPayload sheet =
            capitalSheet(Map.of("projectName", "가".repeat(150), "swAmount", "100"));

    List<MigrationDto.CellDiagnostic> out =
            validator.validate(
                    List.of(sheet),
                    index,
                    snapshot,
                    Map.of(),
                    Map.of(SheetKind.CAPITAL_PROJECT, Set.of(2)));

    assertThat(out).extracting(MigrationDto.CellDiagnostic::code).contains("LENGTH_EXCEEDED");
}

@Test
@DisplayName("validate_기존_사업명이_있어도_DUPLICATE_EXISTS를_내지_않는다")
void validate_기존_사업명이_있어도_DUPLICATE_EXISTS를_내지_않는다() {
    // snapshot에 '웹한글기안기도입'이 이미 있는 상태 — 이제는 매칭 성공 조건이다
    MigrationDto.SheetPayload sheet =
            capitalSheet(Map.of("projectName", "웹한글 기안기 도입", "swAmount", "100"));

    List<MigrationDto.CellDiagnostic> out =
            validator.validate(List.of(sheet), index, snapshot, Map.of(), Map.of());

    assertThat(out).extracting(MigrationDto.CellDiagnostic::code).doesNotContain("DUPLICATE_EXISTS");
}
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.MigrationValidatorTest" --tests "com.kdb.it.domain.migration.service.MigrationMatchDiagnosticsTest"
```

Expected: 컴파일 실패 — `MigrationMatchDiagnostics` 없음, `validate` 인자 5개 없음

- [ ] **Step 4: `MigrationMatchDiagnostics`를 만든다**

핵심 로직만 적는다. `MigrationDiagnostics`는 패키지 전용(`final class`, 접근제어자 없음)이라 같은 패키지인 이 클래스가 그대로 쓸 수 있다.

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.RowDecision;
import com.kdb.it.domain.migration.service.adapter.AllocationIntent;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 매칭·배분 계열 진단을 만듭니다.
 *
 * <p>{@link MigrationValidator}에 넣지 않은 이유는 그쪽이 이미 700줄을 넘고 시트 종류별 분기가 크기 때문입니다. 검증 규칙(값이 올바른가)과
 * 매칭 판정(어느 원장을 가리키는가)은 판단의 종류가 다릅니다.
 */
@Component
@RequiredArgsConstructor
public class MigrationMatchDiagnostics {

    /** 종합본 기준액과 원장 요청 합계의 허용 오차(원). 단위 환산 반올림을 흡수합니다. */
    private static final BigDecimal AMOUNT_TOLERANCE = BigDecimal.ONE;

    /** 조정열 대사 허용 오차(원 단위 환산 전 기준으로 1단위). */
    private static final BigDecimal RECONCILE_TOLERANCE = new BigDecimal("1000000");

    private final MigrationLedgerMatcher matcher;

    /**
     * 행의 처리 방식을 정합니다.
     *
     * @param pk 매칭·선택된 원장 PK. {@code MATCH}가 아니면 null
     * @param action 처리 방식. 결정되지 않았으면 null
     * @param diagnostics 결정을 요구하는 진단. 결정됐으면 빈 목록
     */
    public record Resolved(
            String pk, RowDecision.Kind action, List<MigrationDto.CellDiagnostic> diagnostics) {}

    /**
     * 배분 의도를 기존 원장에 붙입니다.
     *
     * <p>관리자가 이미 결정한 행은 그 결정을 그대로 따르고, 그렇지 않으면 매처에게 묻습니다. 매칭에 실패하면 결정을 요구하는 BLOCKER를 내며,
     * 후보에는 항상 {@code CREATE_NEW}·{@code SKIP}이 붙습니다 — 후보가 비면 화면에 드롭다운이 그려지지 않아 손댈 방법이 없습니다.
     *
     * @param sheet 시트 페이로드 (진단 좌표)
     * @param intent 배분 의도
     * @param snapshot 연도 스냅샷
     * @param overrides 보정값 (결정 포함)
     * @return 처리 방식과 진단
     */
    public Resolved resolve(
            MigrationDto.SheetPayload sheet,
            AllocationIntent intent,
            MigrationYearSnapshot.Data snapshot,
            Map<String, String> overrides) {
        RowDecision decided =
                RowDecision.parse(
                        overrides.get(
                                MigrationValidator.overrideKey(
                                        sheet.kind(), intent.excelRow(), RowDecision.COLUMN)));
        if (decided != null) {
            return new Resolved(decided.pk(), decided.kind(), List.of());
        }

        MigrationLedgerMatcher.Match match = match(intent, snapshot);
        if (match.outcome() == MigrationLedgerMatcher.Outcome.MATCHED) {
            return new Resolved(match.pk(), RowDecision.Kind.MATCH, List.of());
        }

        boolean ambiguous = match.outcome() == MigrationLedgerMatcher.Outcome.AMBIGUOUS;
        String code = ambiguous ? "LEDGER_AMBIGUOUS" : "LEDGER_NOT_MATCHED";
        String message =
                ambiguous
                        ? "이 행에 해당하는 원장 후보가 둘 이상입니다. 편성할 대상을 골라 주세요."
                        : "이 행에 해당하는 원장을 찾지 못했습니다. 편성요청서를 먼저 반입했는지 확인하고, 대상을 고르거나 원장을 새로 만들지 정해 주세요.";
        return new Resolved(
                null,
                null,
                List.of(
                        MigrationDiagnostics.blocker(
                                sheet,
                                rowAt(sheet, intent.excelRow()),
                                RowDecision.COLUMN,
                                code,
                                message,
                                RowDecision.decisionCandidates(match.candidates()))));
    }

    /**
     * 배분 가능성과 금액 대사를 확인합니다.
     *
     * @param sheet 시트 페이로드
     * @param intent 배분 의도
     * @param pk 매칭된 원장 PK
     * @param snapshot 연도 스냅샷
     * @param planner 배분기
     * @return 진단 목록. 문제가 없으면 빈 목록
     */
    public List<MigrationDto.CellDiagnostic> checkAllocation(
            MigrationDto.SheetPayload sheet,
            AllocationIntent intent,
            String pk,
            MigrationYearSnapshot.Data snapshot,
            MigrationAllocationPlanner planner) {
        List<MigrationDto.CellDiagnostic> out = new ArrayList<>();
        MigrationDto.NormalizedRow row = rowAt(sheet, intent.excelRow());

        if ("BCOSTM".equals(intent.orcTb())) {
            MigrationYearSnapshot.CostRef ref = snapshot.costOf(pk);
            BigDecimal base = ref == null ? BigDecimal.ZERO : ref.amount();
            BigDecimal target = intent.targetByColumn().getOrDefault("costAmount", BigDecimal.ZERO);
            if (base.compareTo(BigDecimal.ZERO) == 0 && target.compareTo(BigDecimal.ZERO) != 0) {
                out.add(baseZero(sheet, row, "costAmount"));
            }
            addAmountAdjusted(out, sheet, row, intent.declaredBase(), base);
            return out;
        }

        List<MigrationYearSnapshot.RequestItem> all = snapshot.itemsOfProject(pk);
        BigDecimal ledgerBase = BigDecimal.ZERO;
        for (Map.Entry<String, BigDecimal> entry : intent.targetByColumn().entrySet()) {
            List<MigrationYearSnapshot.RequestItem> items = itemsFor(entry.getKey(), all);
            for (MigrationYearSnapshot.RequestItem item : items) {
                ledgerBase = ledgerBase.add(item.amount());
            }
            if (planner.allocate(items, entry.getValue())
                    instanceof MigrationAllocationPlanner.Allocation.BaseZero) {
                out.add(baseZero(sheet, row, entry.getKey()));
            }
        }
        addAmountAdjusted(out, sheet, row, intent.declaredBase(), ledgerBase);
        return out;
    }

    /**
     * 종합본의 조정 3열이 `기준액 × 조정비율`과 맞는지 대사합니다.
     *
     * <p>어긋나면 우리가 계산한 편성액과 예산담당자가 문서에 적어 둔 값이 다르다는 뜻이므로 반영 전에 알립니다. 반영을 막지는 않습니다 — 기준은
     * `기준액 × 조정비율`이고(설계 §2.2) 조정열은 참고값입니다.
     *
     * @param sheet 시트 페이로드
     * @param row 정규화 행
     * @param overrides 보정값
     * @return 진단 목록. 자본예산 시트가 아니거나 조정열이 비면 빈 목록
     */
    public List<MigrationDto.CellDiagnostic> checkRateReconcile(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            Map<String, String> overrides) {
        List<MigrationDto.CellDiagnostic> out = new ArrayList<>();
        if (sheet.kind() != com.kdb.it.domain.migration.dto.SheetKind.CAPITAL_PROJECT) {
            return out;
        }
        BigDecimal rate =
                com.kdb.it.domain.migration.service.adapter.AdapterSupport.rateFraction(
                        MigrationDiagnostics.cell(row, "adjustRate", overrides, sheet));
        for (Map.Entry<String, String> pair :
                Map.of(
                                "devAmount", "devAdjustAmount",
                                "hwAmount", "hwAdjustAmount",
                                "swAmount", "swAdjustAmount")
                        .entrySet()) {
            String declared = MigrationDiagnostics.cell(row, pair.getValue(), overrides, sheet);
            if (declared.isBlank()) {
                continue;
            }
            BigDecimal base =
                    com.kdb.it.domain.migration.service.adapter.AdapterSupport.amount(
                            MigrationDiagnostics.cell(row, pair.getKey(), overrides, sheet),
                            sheet.kind());
            BigDecimal declaredAmount =
                    com.kdb.it.domain.migration.service.adapter.AdapterSupport.amount(
                            declared, sheet.kind());
            if (base == null || declaredAmount == null) {
                continue;
            }
            BigDecimal expected = base.multiply(rate);
            if (expected.subtract(declaredAmount).abs().compareTo(RECONCILE_TOLERANCE) > 0) {
                out.add(
                        MigrationDiagnostics.warning(
                                sheet,
                                row,
                                pair.getValue(),
                                "RATE_RECONCILE_MISMATCH",
                                "엑셀의 조정 금액이 기준액 × 조정비율과 다릅니다. 편성은 기준액 × 조정비율로 계산합니다."));
            }
        }
        return out;
    }

    private MigrationLedgerMatcher.Match match(
            AllocationIntent intent, MigrationYearSnapshot.Data snapshot) {
        AllocationIntent.MatchKey key = intent.matchKey();
        return switch (key.type()) {
            case PROJECT_NAME -> matcher.matchProject(key.normalizedName(), snapshot);
            case ORDINARY_DEPT -> matcher.matchOrdinaryProject(key.deptCode(), snapshot);
            case COST_DEPT_KEY ->
                    matcher.matchCost(
                            snapshot.bseYy(),
                            key.deptCode(),
                            key.ioeC(),
                            key.vendorName(),
                            key.contractName(),
                            snapshot);
        };
    }

    private List<MigrationYearSnapshot.RequestItem> itemsFor(
            String column, List<MigrationYearSnapshot.RequestItem> all) {
        Set<String> group = MigrationAllocationPlanner.groupOf(column);
        return group.isEmpty()
                ? MigrationAllocationPlanner.itemsOutsideCapitalGroups(all)
                : MigrationAllocationPlanner.itemsInGroup(all, group);
    }

    private MigrationDto.CellDiagnostic baseZero(
            MigrationDto.SheetPayload sheet, MigrationDto.NormalizedRow row, String column) {
        return MigrationDiagnostics.blocker(
                sheet,
                row,
                column,
                "ITEM_BASE_ZERO",
                "편성할 금액이 있는데 대상 원장의 요청금액이 0원이라 배분할 수 없습니다. 요청 원장을 확인하거나 이 행을 제외해 주세요.",
                List.of());
    }

    private void addAmountAdjusted(
            List<MigrationDto.CellDiagnostic> out,
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            BigDecimal declaredBase,
            BigDecimal ledgerBase) {
        if (declaredBase == null) {
            return;
        }
        if (declaredBase.subtract(ledgerBase).abs().compareTo(AMOUNT_TOLERANCE) > 0) {
            out.add(
                    MigrationDiagnostics.warning(
                            sheet,
                            row,
                            null,
                            "AMOUNT_ADJUSTED",
                            "종합본 금액이 부서가 제출한 요청 금액과 다릅니다. 편성은 종합본 금액을 기준으로 계산합니다."));
        }
    }

    /** 행 번호로 정규화 행을 찾습니다. 배분 의도는 항상 이 시트의 행에서 나오므로 없을 수 없습니다. */
    private MigrationDto.NormalizedRow rowAt(MigrationDto.SheetPayload sheet, int excelRow) {
        for (MigrationDto.NormalizedRow row : sheet.rows()) {
            if (row.excelRow() == excelRow) {
                return row;
            }
        }
        throw new IllegalStateException("배분 의도의 행을 시트에서 찾지 못했습니다: " + excelRow);
    }
}
```

- [ ] **Step 5: `MigrationValidator`에서 중복 진단을 지우고 검증 범위를 좁힌다**

세 곳을 고친다.

1. `validateProjectRow`의 `DUPLICATE_EXISTS` 블록(현재 `MigrationValidator.java:256-268`)을 통째로 삭제한다.
2. `validateCostRow`의 `DUPLICATE_EXISTS` 블록(현재 `MigrationValidator.java:195-213`)을 통째로 삭제한다. `snapshot.costNaturalKeys()`가 Task 3에서 사라졌으므로 컴파일이 강제한다.
3. `validate` 시그니처에 `Map<SheetKind, Set<Integer>> createNewRows`를 더하고, 행 단위 검증 진입점에서 다음처럼 나눈다.

```java
            boolean createNew =
                    createNewRows.getOrDefault(sheet.kind(), Set.of()).contains(row.excelRow());
            // 매칭된 행은 원장을 만들지 않으므로 물리 길이·필수값·코드 해석을 검사하지 않는다.
            // 전 행에 걸면 종합본의 긴 사업개요 하나 때문에 편성이 통째로 막힌다.
            if (createNew) {
                validateForCreate(sheet, row, index, overrides, out);
            }
            validateAlways(sheet, row, index, overrides, out);
```

`validateForCreate`에는 `requireText`·`limitLength`·`limitBytes`·`resolveCodeCell`·`resolveOrgCell`·`resolveUserCell`을 옮기고, `validateAlways`에는 `checkAmount`·`checkCurrency`·`checkYm`·`checkRate`·`checkCapitalIoeOverrides`와 부문계획의 `PROJECT_NOT_FOUND`·조정 계획 `DUPLICATE_EXISTS`를 남긴다.

**단, 매칭에 필요한 값은 항상 해석해야 한다.** 전산업무비의 `deptName`·`ioeName`, 자본예산의 `projectName`, 위임예산의 `branchName`은 매칭 키의 재료이므로 `validateAlways`에 남긴다 — 해석되지 않으면 매칭이 성립하지 않아 어차피 `LEDGER_NOT_MATCHED`가 난다.

`checkIntraPayloadDuplicate`(같은 반영 안에서 사업명 중복)는 그대로 둔다. 한 시트에 같은 사업이 두 번 나오면 두 배분이 같은 원장을 덮어써 뒤엣것만 남으므로 여전히 BLOCKER다.

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.MigrationValidatorTest" --tests "com.kdb.it.domain.migration.service.MigrationMatchDiagnosticsTest"
```

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/migration/service/MigrationMatchDiagnostics.java src/main/java/com/kdb/it/domain/migration/service/MigrationValidator.java src/test/java/com/kdb/it/domain/migration/service/MigrationMatchDiagnosticsTest.java src/test/java/com/kdb/it/domain/migration/service/MigrationValidatorTest.java && git diff --cached --stat && git commit -m "feat: 매칭 진단 신설, 중복 진단 제거, 원장 검증을 CREATE_NEW 행으로 한정"
```

---

## Task 9: `MigrationImportService`를 매칭 → 배분 → 편성 흐름으로 재구성

전체가 여기서 이어진다. 이 태스크가 끝나야 백엔드 빌드가 다시 통과한다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationImportService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationImportServiceTest.java`

**Interfaces:**
- Consumes: Task 3~8 전부
- Produces: `MigrationDto.CommitResponse` — 필드는 그대로다. `budgetRowCount`가 `applyItemRates` 결과라는 의미도 그대로다. `itemCount`는 이제 `CREATE_NEW` 행이 만든 품목 수만 센다(하반기 조정이 품목을 만들지 않으므로)

- [ ] **Step 1: 반영 흐름의 실패 테스트를 쓴다**

```java
@Test
@DisplayName("commit_매칭된_사업은_원장을_만들지_않고_편성만_한다")
void commit_매칭된_사업은_원장을_만들지_않고_편성만_한다() {
    // snapshot에 '웹한글기안기도입' → PRJ-2026-0001, 품목 GCL-1(106, 1,406,000,000)
    MigrationDto.CommitResponse response = service.commit(commitRequestOfCapitalSheet(), "12345");

    verify(projectService, never()).createProject(any(), anyBoolean());
    assertThat(response.projectCount()).isZero();

    ArgumentCaptor<BudgetWorkDto.ItemApplyRequest> captor =
            ArgumentCaptor.forClass(BudgetWorkDto.ItemApplyRequest.class);
    verify(budgetRateApplicationService).applyItemRates(captor.capture());
    BudgetWorkDto.ItemRate applied =
            captor.getValue().items().stream()
                    .filter(item -> "PRJ-2026-0001".equals(item.orcPkVl()))
                    .findFirst()
                    .orElseThrow();
    assertThat(applied.ioeRates()).containsEntry("106", new BigDecimal("70.00000"));
}

@Test
@DisplayName("commit_CREATE_NEW로_결정한_행만_원장을_만든다")
void commit_CREATE_NEW로_결정한_행만_원장을_만든다() {
    MigrationDto.CommitRequest request =
            commitRequestWithDecision(SheetKind.CAPITAL_PROJECT, 2, "CREATE_NEW");

    MigrationDto.CommitResponse response = service.commit(request, "12345");

    verify(projectService).createProject(any(), eq(true));
    assertThat(response.projectCount()).isEqualTo(1);
}

@Test
@DisplayName("commit_SKIP으로_결정한_행은_편성_대상에서_빠진다")
void commit_SKIP으로_결정한_행은_편성_대상에서_빠진다() {
    MigrationDto.CommitRequest request =
            commitRequestWithDecision(SheetKind.CAPITAL_PROJECT, 2, "SKIP");

    service.commit(request, "12345");

    verify(projectService, never()).createProject(any(), anyBoolean());
    ArgumentCaptor<BudgetWorkDto.ItemApplyRequest> captor =
            ArgumentCaptor.forClass(BudgetWorkDto.ItemApplyRequest.class);
    verify(budgetRateApplicationService).applyItemRates(captor.capture());
    // 기존 편성률 유지 항목으로만 남고 ioeRates는 채워지지 않는다
    assertThat(captor.getValue().items())
            .filteredOn(item -> "PRJ-2026-0001".equals(item.orcPkVl()))
            .allSatisfy(item -> assertThat(item.ioeRates()).isNullOrEmpty());
}

@Test
@DisplayName("commit_하반기_조정은_요청_품목을_삭제하지_않는다")
void commit_하반기_조정은_요청_품목을_삭제하지_않는다() {
    service.commit(commitRequestOfPlanSheet(), "12345");

    verify(projectService, never()).replaceItemsForMigration(any(), any());
    verify(projectItemRepository, never()).findByAbusMngNoAndDelYnAndLstYn(any(), any(), any());
}

@Test
@DisplayName("commit_종합본에_없는_기존_사업의_편성률이_유지된다")
void commit_종합본에_없는_기존_사업의_편성률이_유지된다() {
    // snapshot에 PRJ-2026-0009(품목 GCL-9, 기존 ASG_RT 55)가 있고 종합본에는 없다
    service.commit(commitRequestOfCapitalSheet(), "12345");

    ArgumentCaptor<BudgetWorkDto.ItemApplyRequest> captor =
            ArgumentCaptor.forClass(BudgetWorkDto.ItemApplyRequest.class);
    verify(budgetRateApplicationService).applyItemRates(captor.capture());
    BudgetWorkDto.ItemRate kept =
            captor.getValue().items().stream()
                    .filter(item -> "PRJ-2026-0009".equals(item.orcPkVl()))
                    .findFirst()
                    .orElseThrow();
    assertThat(kept.ioeRates()).containsEntry("103", new BigDecimal("55"));
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.migration.service.MigrationImportServiceTest"
```

Expected: 컴파일 실패

- [ ] **Step 3: `dryRun`을 매칭 단계까지 돌게 고친다**

```java
    @Transactional(readOnly = true)
    public MigrationDto.DryRunResponse dryRun(MigrationDto.DryRunRequest request) {
        requireSupported(request.sheets());
        String bseYy = request.sheets().get(0).bseYy();
        Map<String, String> overrides = foldOverrides(request.overrides());
        MigrationYearSnapshot.Data snapshot = yearSnapshot.load(bseYy);
        MigrationLookupIndex index = lookupIndex();

        Plan plan = buildPlan(request.sheets(), index, snapshot, overrides);

        int totalRows = request.sheets().stream().mapToInt(s -> s.rows().size()).sum();
        int blockers =
                (int)
                        plan.diagnostics().stream()
                                .filter(d -> d.severity() == MigrationDto.Severity.BLOCKER)
                                .count();
        return new MigrationDto.DryRunResponse(
                plan.diagnostics(),
                new MigrationDto.Summary(
                        totalRows, blockers, plan.diagnostics().size() - blockers));
    }
```

- [ ] **Step 4: `buildPlan`을 만든다 — 매칭·배분·진단을 한 번에 계산한다**

`dryRun`과 `commit`이 같은 계산을 쓰게 해서 두 경로가 어긋나지 않게 한다.

```java
    /**
     * 반영 계획입니다. dry-run과 commit이 같은 계산을 공유합니다.
     *
     * @param diagnostics 진단 전체
     * @param createNewRows 시트별 {@code CREATE_NEW} 결정 행 번호
     * @param allocationsByPk 원장 PK → 비목코드별 편성률
     * @param intentsToCreate 원장을 새로 만들어야 하는 (시트, 행) 좌표
     */
    private record Plan(
            List<MigrationDto.CellDiagnostic> diagnostics,
            Map<SheetKind, Set<Integer>> createNewRows,
            Map<String, Map<String, BigDecimal>> allocationsByPk,
            Map<SheetKind, Set<Integer>> intentsToCreate) {}

    /**
     * 시트를 어댑터에 태워 매칭·배분·검증을 계산합니다. 원장을 쓰지 않으므로 dry-run과 commit이 그대로 공유합니다.
     *
     * <p>배분 결과는 원장 PK 단위로 합칩니다 — 한 사업이 자본예산 시트와 부문계획 시트 양쪽에 나오면 **나중에 처리한 시트가 이깁니다**.
     * 어댑터 순서(§7)가 부문계획을 마지막에 두므로, 하반기 조정의 확정금액이 종합본의 조정비율 결과를 덮습니다. 6월 조정이 더 최신 판단이라
     * 이 방향이 맞습니다.
     */
    private Plan buildPlan(
            List<MigrationDto.SheetPayload> sheets,
            MigrationLookupIndex index,
            MigrationYearSnapshot.Data snapshot,
            Map<String, String> overrides) {
        List<MigrationDto.CellDiagnostic> diagnostics = new ArrayList<>();
        Map<SheetKind, Set<Integer>> createNewRows = new EnumMap<>(SheetKind.class);
        Map<String, Map<String, BigDecimal>> allocationsByPk = new LinkedHashMap<>();
        AdapterContext ctx =
                new AdapterContext(snapshot.bseYy(), index, snapshot, overrides, "PREVIEW");

        for (SheetKind kind : ADAPTER_ORDER) {
            for (MigrationDto.SheetPayload sheet : sheets) {
                if (sheet.kind() != kind) {
                    continue;
                }
                AdapterOutput output = adapters.get(kind).adapt(sheet, ctx);
                for (AllocationIntent intent : output.allocations()) {
                    MigrationMatchDiagnostics.Resolved resolved =
                            matchDiagnostics.resolve(sheet, intent, snapshot, overrides);
                    diagnostics.addAll(resolved.diagnostics());
                    if (resolved.action() == RowDecision.Kind.CREATE_NEW) {
                        createNewRows
                                .computeIfAbsent(kind, ignored -> new LinkedHashSet<>())
                                .add(intent.excelRow());
                        continue;
                    }
                    if (resolved.action() != RowDecision.Kind.MATCH) {
                        continue; // SKIP 또는 미결정
                    }
                    diagnostics.addAll(
                            matchDiagnostics.checkAllocation(
                                    sheet, intent, resolved.pk(), snapshot, allocationPlanner));
                    allocationsByPk
                            .computeIfAbsent(resolved.pk(), ignored -> new LinkedHashMap<>())
                            .putAll(ratesOf(intent, resolved.pk(), snapshot));
                }
                for (MigrationDto.NormalizedRow row : sheet.rows()) {
                    diagnostics.addAll(
                            matchDiagnostics.checkRateReconcile(sheet, row, overrides));
                }
            }
        }

        diagnostics.addAll(validator.validate(sheets, index, snapshot, overrides, createNewRows));
        return new Plan(diagnostics, createNewRows, allocationsByPk, createNewRows);
    }

    /**
     * 배분 의도를 비목코드별 편성률로 환산합니다.
     *
     * @return 비목코드 → 실효 편성률. 배분에 실패한 그룹은 키가 없습니다(진단이 이미 막았습니다)
     */
    private Map<String, BigDecimal> ratesOf(
            AllocationIntent intent, String pk, MigrationYearSnapshot.Data snapshot) {
        Map<String, BigDecimal> out = new LinkedHashMap<>();
        if ("BCOSTM".equals(intent.orcTb())) {
            MigrationYearSnapshot.CostRef ref = snapshot.costOf(pk);
            if (ref == null) {
                return out;
            }
            MigrationAllocationPlanner.Allocation allocation =
                    allocationPlanner.allocate(
                            List.of(
                                    new MigrationYearSnapshot.RequestItem(
                                            ref.costBgNo(), ref.bgSno(), ref.ioeC(), ref.amount())),
                            intent.targetByColumn().get("costAmount"));
            if (allocation
                    instanceof MigrationAllocationPlanner.Allocation.Allocated allocated) {
                out.put(ref.ioeC(), allocated.effectiveRate());
            }
            return out;
        }

        List<MigrationYearSnapshot.RequestItem> all = snapshot.itemsOfProject(pk);
        for (Map.Entry<String, BigDecimal> entry : intent.targetByColumn().entrySet()) {
            Set<String> group = MigrationAllocationPlanner.groupOf(entry.getKey());
            List<MigrationYearSnapshot.RequestItem> items =
                    group.isEmpty()
                            ? MigrationAllocationPlanner.itemsOutsideCapitalGroups(all)
                            : MigrationAllocationPlanner.itemsInGroup(all, group);
            if (items.isEmpty()) {
                continue;
            }
            if (allocationPlanner.allocate(items, entry.getValue())
                    instanceof MigrationAllocationPlanner.Allocation.Allocated allocated) {
                for (MigrationAllocationPlanner.ItemAllocation item : allocated.items()) {
                    out.put(item.ioeC(), item.rate());
                }
            }
        }
        return out;
    }
```

`ADAPTER_ORDER` 상수를 클래스 상단에 둔다.

```java
    /** 어댑터 처리 순서. 부문계획이 마지막이라 하반기 조정이 종합본 편성률을 덮습니다. */
    private static final List<SheetKind> ADAPTER_ORDER =
            List.of(
                    SheetKind.COST,
                    SheetKind.CAPITAL_PROJECT,
                    SheetKind.DELEGATED_BUDGET,
                    SheetKind.PLAN_ADJUSTMENT);
```

- [ ] **Step 5: `commit`을 다시 쓴다**

```java
    @Transactional
    public MigrationDto.CommitResponse commit(MigrationDto.CommitRequest request, String actorEno) {
        requireSupported(request.sheets());
        String bseYy = request.sheets().get(0).bseYy();
        Map<String, String> overrides = foldOverrides(request.overrides());
        MigrationYearSnapshot.Data snapshot = yearSnapshot.load(bseYy);
        MigrationLookupIndex index = lookupIndex();

        // 1단계: 매칭·배분·검증을 dry-run과 같은 계산으로 다시 돌린다.
        // BLOCKER가 남으면 원장에 손대기 전에 예외를 던진다.
        Plan plan = buildPlan(request.sheets(), index, snapshot, overrides);
        long blockers =
                plan.diagnostics().stream()
                        .filter(d -> d.severity() == MigrationDto.Severity.BLOCKER)
                        .count();
        if (blockers > 0) {
            throw new CustomGeneralException(
                    "해결되지 않은 오류가 " + blockers + "건 있어 반영할 수 없습니다. 미리보기에서 보정해 주세요.");
        }

        AdapterContext ctx = new AdapterContext(bseYy, index, snapshot, overrides, actorEno);

        // 2단계: CREATE_NEW 결정 행만 원장을 만든다. 만든 뒤 편성 대상에 넣어야 하므로
        //        생성된 PK를 그 행의 배분 결과에 이어 붙인다.
        List<String> createdIds = new ArrayList<>();
        List<PlanIntent> planIntents = new ArrayList<>();
        Map<String, Map<String, BigDecimal>> allocationsByPk =
                new LinkedHashMap<>(plan.allocationsByPk());
        int costCount = 0;
        int projectCount = 0;
        int itemCount = 0;

        for (SheetKind kind : ADAPTER_ORDER) {
            for (MigrationDto.SheetPayload sheet : request.sheets()) {
                if (sheet.kind() != kind) {
                    continue;
                }
                AdapterOutput output = adapters.get(kind).adapt(sheet, ctx);
                planIntents.addAll(output.plans());
                Set<Integer> createRows = plan.createNewRows().getOrDefault(kind, Set.of());
                List<AllocationIntent> intents = output.allocations();

                for (int i = 0; i < intents.size(); i++) {
                    AllocationIntent intent = intents.get(i);
                    if (!createRows.contains(intent.excelRow())) {
                        continue;
                    }
                    if ("BCOSTM".equals(intent.orcTb())) {
                        String costNo = costService.createCost(output.costs().get(i), true);
                        Bcostm created =
                                CostRepresentativeSelector.pick(
                                        costRepository.findByCostBgNoAndDelYn(costNo, "N"));
                        approvalStamper.stamp(
                                "BCOSTM",
                                costNo,
                                created.getBgSno(),
                                bseYy + "년 전산일반관리비 이관",
                                actorEno,
                                bseYy);
                        createdIds.add(costNo);
                        costCount++;
                    } else {
                        ProjectDto.CreateRequest projectRequest = output.projects().get(i);
                        String projectNo = projectService.createProject(projectRequest, true);
                        Bprojm created =
                                projectRepository
                                        .findByAbusMngNoAndDelYn(projectNo, "N")
                                        .orElseThrow(
                                                () ->
                                                        new CustomGeneralException(
                                                                "이관 직후 생성된 사업을 다시 찾지 못했습니다: "
                                                                        + projectNo));
                        approvalStamper.stamp(
                                "BPROJM",
                                projectNo,
                                created.getSno(),
                                bseYy + "년 정보화사업 이관",
                                actorEno,
                                bseYy);
                        createdIds.add(projectNo);
                        projectCount++;
                        itemCount +=
                                projectRequest.getItems() == null
                                        ? 0
                                        : projectRequest.getItems().size();
                    }
                }
            }
        }

        // 3단계: 새로 만든 원장까지 포함해 스냅샷을 다시 읽고 배분을 완성한다.
        //        방금 만든 품목은 아직 스냅샷에 없어 실효 편성률을 계산할 수 없었다.
        if (!createdIds.isEmpty()) {
            MigrationYearSnapshot.Data refreshed = yearSnapshot.load(bseYy);
            Plan replanned = buildPlan(request.sheets(), index, refreshed, overrides);
            allocationsByPk = new LinkedHashMap<>(replanned.allocationsByPk());
            snapshot = refreshed;
        }

        // 4단계: 하반기 조정 계획 문서. 요청 품목(BITEMM)은 건드리지 않는다.
        String planReqDocNo =
                planIntents.isEmpty()
                        ? null
                        : createAdjustmentPlan(planIntents, snapshot, bseYy);

        // 5단계: 편성률 단일 적용. items에는 그 연도의 모든 사업 + 모든 전산업무비를 담는다.
        //        applyItemRates가 연도 전체를 재작성하므로 빠진 것은 되살아나지 않는다(§5.3).
        BudgetWorkDto.ApplyResponse applied =
                budgetRateApplicationService.applyItemRates(
                        new BudgetWorkDto.ItemApplyRequest(
                                bseYy, itemRates(snapshot, allocationsByPk)));

        return new MigrationDto.CommitResponse(
                costCount,
                projectCount,
                itemCount,
                applied.totalRecords(),
                planReqDocNo,
                createdIds);
    }

    /**
     * 편성률 적용 목록을 만듭니다.
     *
     * <p>그 연도의 **모든** 사업·전산업무비를 담습니다. 이번 반영이 건드리지 않은 항목은 기존 편성률을 그대로 실어 유지하고, 건드린 항목만
     * 새 비목별 편성률로 덮습니다. 빠진 항목은 {@code applyItemRates}의 연도 전량 재작성에서 되살아나지 않고, 벌크 논리삭제라
     * {@code BBUGT_L}에도 흔적이 남지 않습니다.
     */
    private List<BudgetWorkDto.ItemRate> itemRates(
            MigrationYearSnapshot.Data snapshot,
            Map<String, Map<String, BigDecimal>> allocationsByPk) {
        List<BudgetWorkDto.ItemRate> out = new ArrayList<>();
        for (String projectNo : snapshot.allProjectNos()) {
            Map<String, BigDecimal> rates = new LinkedHashMap<>();
            for (MigrationYearSnapshot.RequestItem item : snapshot.itemsOfProject(projectNo)) {
                BigDecimal existing = snapshot.existingItemRateByItemNo().get(item.gclMngNo());
                if (existing != null && item.ioeC() != null) {
                    rates.put(item.ioeC(), existing);
                }
            }
            rates.putAll(allocationsByPk.getOrDefault(projectNo, Map.of()));
            out.add(new BudgetWorkDto.ItemRate("BPROJM", projectNo, null, null, rates));
        }
        for (String costNo : snapshot.allCostNos()) {
            Map<String, BigDecimal> rates = new LinkedHashMap<>();
            MigrationYearSnapshot.CostRef ref = snapshot.costOf(costNo);
            BigDecimal existing = snapshot.existingCostRateOf(costNo);
            if (existing != null && ref != null && ref.ioeC() != null) {
                rates.put(ref.ioeC(), existing);
            }
            rates.putAll(allocationsByPk.getOrDefault(costNo, Map.of()));
            out.add(new BudgetWorkDto.ItemRate("BCOSTM", costNo, null, null, rates));
        }
        return out;
    }
```

`assetDupRt`·`costDupRt`에 `null`을 넣으면 `applyItemRates`가 `DEFAULT_DUP_RT`(100)로 떨어지지만, `ioeRates`가 그 원장의 모든 비목을 덮으므로 실제로 100이 쓰이는 경우는 **편성행도 없고 배분도 없는 새 비목**뿐이다. 그것은 편성률 100이 맞다.

- [ ] **Step 6: 삭제할 코드를 지운다**

- `replaceItems`, `buildAdjustedItems`, `addAdjustedItem` 3개 메서드 삭제
- `projectItemRepository` 의존성 삭제(더는 쓰지 않는다)
- `orDefault(Integer)` 삭제
- `createAdjustmentPlan`의 시그니처를 `(List<PlanIntent> intents, MigrationYearSnapshot.Data snapshot, String bseYy)`로 바꾸고, 내부의 `projectNoByName.get(...)`를 `snapshot.projectNoByName(...)`으로 바꾼다
- 생성자에서 `MigrationMatchDiagnostics matchDiagnostics`, `MigrationAllocationPlanner allocationPlanner`를 주입받고 `projectItemRepository`를 뺀다
- 클래스 Javadoc을 편성 전용 흐름으로 다시 쓴다

- [ ] **Step 7: 전체 백엔드 테스트를 돌린다**

```bash
cd it_backend && ./gradlew clean test
```

Expected: PASS

- [ ] **Step 8: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/migration/service/MigrationImportService.java src/test/java/com/kdb/it/domain/migration/service/MigrationImportServiceTest.java && git diff --cached --stat && git commit -m "feat: 데이터 일괄 반입을 매칭-배분-편성 흐름으로 재구성"
```

---

## Task 10: Oracle 통합 테스트 — 두 화면을 이어서 돌린다

이 태스크의 핵심은 **회귀 고정**이다. 지금은 요청서를 반입한 뒤 종합본을 올리면 전량 차단된다. 그 순서가 정상 동작함을 실제 Oracle에서 증명한다.

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/migration/MigrationImportIt.java`

**Interfaces:**
- Consumes: Task 9의 완성된 `MigrationImportService.commit`

- [ ] **Step 1: 회귀 고정 테스트를 쓴다**

```java
@Test
@Tag("it")
@DisplayName("요청서_반입_후_종합본을_올리면_차단되지_않고_편성된다")
void 요청서_반입_후_종합본을_올리면_차단되지_않고_편성된다() {
    // 1단계: 편성요청서 반입이 만든 상태를 직접 조립한다(RequestFormImportService를 부르지 않고
    //        같은 결과만 만든다 — 두 기능의 결합을 테스트에 끌어들이지 않는다)
    String projectNo = 요청사업을_만든다("웹한글 기안기 도입", "106", new BigDecimal("1406000000"));

    // 2단계: 종합본 자본예산 시트 — 같은 사업명, 조정비율 0.7
    MigrationDto.CommitResponse response =
            service.commit(
                    자본예산_커밋요청("웹한글 기안기 도입", "1406", "0.7"), TEST_ENO);

    // 원장을 새로 만들지 않는다
    assertThat(response.projectCount()).isZero();
    assertThat(projectRepository.findByBseYyAndLstYnAndDelYn(BSE_YY, "Y", "N")).hasSize(1);

    // 편성행이 실효 편성률 70%로 생긴다
    List<Bbugtm> budgets = bbugtmRepository.findByBseYyAndDelYn(BSE_YY, "N");
    assertThat(budgets).hasSize(1);
    assertThat(budgets.get(0).getAsgRt()).isEqualByComparingTo("70.00000");
    assertThat(budgets.get(0).getBgDupAmt()).isEqualByComparingTo("984200000.000");
}

@Test
@Tag("it")
@DisplayName("하반기_조정_후에도_요청_품목이_활성으로_남는다")
void 하반기_조정_후에도_요청_품목이_활성으로_남는다() {
    String projectNo = 요청사업을_만든다("웹한글 기안기 도입", "106", new BigDecimal("1406000000"));

    service.commit(부문계획_커밋요청("웹한글 기안기 도입", "416"), TEST_ENO);

    // 요청 원장이 그대로 살아 있다 — BITEMM 버전 교체를 폐지했다
    assertThat(projectItemRepository.findByAbusMngNoAndDelYnAndLstYn(projectNo, "N", "Y"))
            .hasSize(1)
            .allSatisfy(item -> assertThat(item.getAmt()).isEqualByComparingTo("1406000000"));

    // 확정금액이 소수 편성률로 표현된다
    List<Bbugtm> budgets = bbugtmRepository.findByBseYyAndDelYn(BSE_YY, "N");
    assertThat(budgets.get(0).getAsgRt()).isEqualByComparingTo("29.58748");
    assertThat(budgets.get(0).getBgDupAmt()).isEqualByComparingTo("416000000.000");
}

@Test
@Tag("it")
@DisplayName("소수_편성률이_Oracle에서_왕복한다")
void 소수_편성률이_Oracle에서_왕복한다() {
    Bbugtm saved =
            bbugtmRepository.saveAndFlush(
                    Bbugtm.builder()
                            .bgNo("BG-" + BSE_YY + "-9999")
                            .sno(1)
                            .bseYy(BSE_YY)
                            .fntTbNm("BITEMM")
                            .pkColNm("GCL-TEST-0001")
                            .fntTbCrySno(1)
                            .ioeC("106")
                            .bgDupAmt(new BigDecimal("416000000.000"))
                            .asgRt(new BigDecimal("29.58748"))
                            .build());
    entityManager.clear();

    Bbugtm reloaded =
            bbugtmRepository.findById(new BbugtmId(saved.getBgNo(), saved.getSno())).orElseThrow();
    assertThat(reloaded.getAsgRt()).isEqualByComparingTo("29.58748");
}

@Test
@Tag("it")
@DisplayName("종합본에_없는_기존_사업의_편성률이_유지된다")
void 종합본에_없는_기존_사업의_편성률이_유지된다() {
    String targetNo = 요청사업을_만든다("웹한글 기안기 도입", "106", new BigDecimal("1406000000"));
    String otherNo = 요청사업을_만든다("건드리지 않을 사업", "103", new BigDecimal("500000000"));
    기존_편성률을_넣는다(otherNo, "103", new BigDecimal("55"));

    service.commit(자본예산_커밋요청("웹한글 기안기 도입", "1406", "0.7"), TEST_ENO);

    Bbugtm kept =
            bbugtmRepository.findByBseYyAndDelYn(BSE_YY, "N").stream()
                    .filter(b -> "103".equals(b.getIoeC()))
                    .findFirst()
                    .orElseThrow();
    assertThat(kept.getAsgRt()).isEqualByComparingTo("55");
}
```

헬퍼 `요청사업을_만든다`·`기존_편성률을_넣는다`·`자본예산_커밋요청`·`부문계획_커밋요청`은 이 클래스의 기존 픽스처 조립 방식을 그대로 따라 만든다. 실 업무 데이터(`C:\it\sample`)는 저장소에 커밋하지 않는다.

- [ ] **Step 2: 통합 테스트를 돌린다**

```bash
cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.migration.MigrationImportIt"
```

Expected: PASS. 힙 부족이 나면 `TASK.md` MIG-13 메모의 설정을 따른다.

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/test/java/com/kdb/it/domain/migration/MigrationImportIt.java && git diff --cached --stat && git commit -m "test: 요청서 반입 후 종합본 편성이 통과하는 회귀 테스트 추가"
```

---

## Task 11: 프론트 — 조정 3열 파싱

**Files:**
- Modify: `it_frontend/app/composables/migration/columns.ts:33-52,91-143,188-207`
- Test: `it_frontend/tests/unit/composables/migration/useMigrationParser.test.ts`

**Interfaces:**
- Consumes: Task 7의 `MigrationColumns.CAPITAL_PROJECT`
- Produces: `SHEET_COLUMNS.CAPITAL_PROJECT`에 `devAdjustAmount`·`hwAdjustAmount`·`swAdjustAmount`가 백엔드와 **같은 순서**로 들어간다

- [ ] **Step 1: 파싱 실패 테스트를 쓴다**

```ts
it('자본예산 시트의 조정 3열을 정규화한다', () => {
    const rows = parseSheet(
        'CAPITAL_PROJECT',
        [
            ['사 업 명', '조정비율', '개발비 조정', '기계장치 조정', '무형자산 조정'],
            ['웹한글 기안기 도입', '0.7', '0', '0', '984'],
        ],
    );

    expect(rows[0]!.cells.devAdjustAmount).toBe('0');
    expect(rows[0]!.cells.swAdjustAmount).toBe('984');
});
```

`parseSheet`는 이 테스트 파일의 기존 헬퍼를 재사용한다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
cd it_frontend && npm test -- tests/unit/composables/migration/useMigrationParser.test.ts
```

Expected: FAIL — `devAdjustAmount`가 `undefined`

- [ ] **Step 3: 컬럼·라벨·헤더 패턴을 더한다**

`SHEET_COLUMNS.CAPITAL_PROJECT`의 `'adjustRate'` 다음에 넣는다.

```ts
        'adjustRate',
        'devAdjustAmount',
        'hwAdjustAmount',
        'swAdjustAmount',
        'delegationLabel',
```

`COLUMN_LABELS`에 더한다.

```ts
    devAdjustAmount: '개발비 조정',
    hwAdjustAmount: '기계장치 조정',
    swAdjustAmount: '무형자산 조정',
```

`HEADER_PATTERNS.CAPITAL_PROJECT`에 더한다.

```ts
        devAdjustAmount: /^개발비\s*조정$/,
        hwAdjustAmount: /^기계장치\s*조정$/,
        swAdjustAmount: /^무형자산\s*조정$/,
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

```bash
cd it_frontend && npm test -- tests/unit/composables/migration/useMigrationParser.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd it_frontend && git add app/composables/migration/columns.ts tests/unit/composables/migration/useMigrationParser.test.ts && git diff --cached --stat && git commit -m "feat: 자본예산 시트 조정 3열 파싱 추가"
```

---

## Task 12: 프론트 — 결정 컬럼과 미리보기 표

**Files:**
- Modify: `it_frontend/app/composables/migration/useMigrationPreview.ts`
- Modify: `it_frontend/app/components/migration/MigrationPreviewTable.vue`
- Modify: `it_frontend/app/i18n/messages/migration.ts` (없으면 생성하고 `i18n/messages/index.ts`에 등록)
- Modify: `it_frontend/scripts/user-facing-copy-baselines.mjs`
- Test: `it_frontend/tests/unit/composables/migration/useMigrationPreview.test.ts`

**Interfaces:**
- Consumes: Task 6의 `RowDecision.COLUMN = "__decision"`, `decisionCandidates`
- Produces:
  - `useMigrationPreview()`에 `DECISION_COLUMN` export, `decisionOf(sheet, excelRow): string | null`, `setDecision(sheet, excelRow, value)`, `applyDecisionToAll(sheet, value)` 추가
  - `setDecision`은 `setOverride(sheet, excelRow, DECISION_COLUMN, value)`에 위임한다 — 기존 보정값 경로를 그대로 쓴다

- [ ] **Step 1: 결정 상태의 실패 테스트를 쓴다**

```ts
it('결정은 예약 컬럼 보정값으로 전송된다', async () => {
    const preview = useMigrationPreview();
    preview.sheets.value = [{ kind: 'CAPITAL_PROJECT', bseYy: '2026', rows: [row(2), row(3)] }];

    await preview.setDecision('CAPITAL_PROJECT', 2, 'CREATE_NEW');

    expect(preview.overrides.value['CAPITAL_PROJECT|2|__decision']).toBe('CREATE_NEW');
    expect(preview.decisionOf('CAPITAL_PROJECT', 2)).toBe('CREATE_NEW');
    expect(preview.decisionOf('CAPITAL_PROJECT', 3)).toBeNull();
});

it('일괄 지정은 그 시트의 모든 행에 같은 결정을 넣고 dry-run을 한 번만 돌린다', async () => {
    const preview = useMigrationPreview();
    preview.sheets.value = [{ kind: 'CAPITAL_PROJECT', bseYy: '2026', rows: [row(2), row(3)] }];

    await preview.applyDecisionToAll('CAPITAL_PROJECT', 'CREATE_NEW');

    expect(preview.decisionOf('CAPITAL_PROJECT', 2)).toBe('CREATE_NEW');
    expect(preview.decisionOf('CAPITAL_PROJECT', 3)).toBe('CREATE_NEW');
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

```bash
cd it_frontend && npm test -- tests/unit/composables/migration/useMigrationPreview.test.ts
```

Expected: FAIL — `setDecision`이 없음

- [ ] **Step 3: `useMigrationPreview`에 결정 API를 더한다**

```ts
/** 행 결정을 담는 예약 컬럼 id. 백엔드 `RowDecision.COLUMN`과 같은 값입니다. */
export const DECISION_COLUMN = '__decision';

    /**
     * 행 결정을 조회합니다.
     *
     * @param sheet 시트 종류
     * @param excelRow 엑셀 행 번호
     * @returns 결정 값(`MATCH:{PK}`·`CREATE_NEW`·`SKIP`). 아직 정하지 않았으면 null
     */
    function decisionOf(sheet: SheetKind, excelRow: number): string | null {
        return overrides.value[overrideKey(sheet, excelRow, DECISION_COLUMN)] ?? null;
    }

    /**
     * 행 결정을 설정하고 사전검증을 다시 돌립니다.
     *
     * @param sheet 시트 종류
     * @param excelRow 엑셀 행 번호
     * @param value 결정 값
     */
    async function setDecision(
        sheet: SheetKind,
        excelRow: number,
        value: string,
    ): Promise<void> {
        await setOverride(sheet, excelRow, DECISION_COLUMN, value);
    }

    /**
     * 시트의 모든 행에 같은 결정을 넣고 사전검증을 **한 번만** 돌립니다.
     *
     * 요청서 없이 종합본만 있는 최초 이관에서 전 행을 `CREATE_NEW`로 지정하는 경로입니다.
     * `setDecision`을 행마다 부르면 dry-run이 행 수만큼 돌아 화면이 멈춥니다.
     *
     * @param sheet 시트 종류
     * @param value 결정 값
     */
    async function applyDecisionToAll(sheet: SheetKind, value: string): Promise<void> {
        const next = { ...overrides.value };
        for (const payload of sheets.value) {
            if (payload.kind !== sheet) continue;
            for (const row of payload.rows) {
                next[overrideKey(sheet, row.excelRow, DECISION_COLUMN)] = value;
            }
        }
        overrides.value = next;
        await runDryRun();
    }
```

반환 객체에 `decisionOf`·`setDecision`·`applyDecisionToAll`을 더한다.

- [ ] **Step 4: 미리보기 표에 결정 열을 붙인다**

`MigrationPreviewTable.vue`에 `SHEET_COLUMNS` 열들보다 **앞에** 고정 열 하나를 둔다. 이 열의 드롭다운 선택지는 `diagnosticsOf(sheet, excelRow, DECISION_COLUMN)`의 `candidates`에서 나오고, 진단이 없으면(=매칭 성공) 매칭된 상태 표시만 남긴다.

```vue
<Column :header="t('migration.preview.decisionHeader')" style="width: 16rem">
    <template #body="{ data }">
        <Select
            v-if="decisionCandidatesOf(data.excelRow).length"
            :model-value="decisionOf(sheet.kind, data.excelRow)"
            :options="decisionCandidatesOf(data.excelRow)"
            option-label="label"
            option-value="code"
            :placeholder="t('migration.preview.decisionPlaceholder')"
            @update:model-value="(value: string) => emit('decision', sheet.kind, data.excelRow, value)"
        />
        <span v-else class="migration-preview__matched">
            {{ t('migration.preview.matched') }}
        </span>
    </template>
</Column>
```

`decisionCandidatesOf`는 `props.diagnosticsOf(props.sheet.kind, excelRow, DECISION_COLUMN).flatMap((d) => d.candidates)`다.

시트 헤더에 일괄 지정 버튼을 둔다.

```vue
<Button
    :label="t('migration.preview.applyCreateNewToAll')"
    severity="secondary"
    size="small"
    @click="emit('decision-all', sheet.kind, 'CREATE_NEW')"
/>
```

`index.vue`가 두 이벤트를 `preview.setDecision`·`preview.applyDecisionToAll`로 잇는다.

- [ ] **Step 5: 문구를 i18n으로 옮긴다**

`app/i18n/messages/migration.ts`에 키를 넣는다. 한국어 트리를 기준으로 영어 트리 구조가 강제되므로 두 언어를 함께 채운다.

```ts
export default defineDomainMessages(
    {
        preview: {
            decisionHeader: '결정',
            decisionPlaceholder: '편성 대상을 골라 주세요',
            matched: '기존 원장에 편성',
            applyCreateNewToAll: '전 행을 새 원장으로',
        },
    },
    {
        preview: {
            decisionHeader: 'Decision',
            decisionPlaceholder: 'Choose an allocation target',
            matched: 'Allocated to existing record',
            applyCreateNewToAll: 'Create new records for all rows',
        },
    },
);
```

용어는 `docs/guides/i18n/glossary.md`를 따른다. 없는 용어는 그 문서에 추가한다.

- [ ] **Step 6: 고정 리터럴 기준선을 낮춘다**

```bash
cd it_frontend && node scripts/check-user-facing-copy.mjs --scope app/components/migration && npm run check:copy
```

`scripts/user-facing-copy-baselines.mjs`에서 옮긴 만큼 숫자를 **낮추고**, 0이 되면 항목을 지운다. 값을 올리거나 새 경로를 추가하지 않는다.

- [ ] **Step 7: 프론트 검사를 돌린다**

```bash
cd it_frontend && npm run check && npm test
```

Expected: PASS

- [ ] **Step 8: 커밋**

```bash
cd it_frontend && git add app/composables/migration/useMigrationPreview.ts app/components/migration/MigrationPreviewTable.vue app/pages/admin/migration/index.vue app/i18n/messages/migration.ts app/i18n/messages/index.ts scripts/user-facing-copy-baselines.mjs tests/unit/composables/migration/useMigrationPreview.test.ts && git diff --cached --stat && git commit -m "feat: 미리보기에 행 결정 열과 일괄 지정 추가"
```

---

## Task 13: 프론트 — 화면 성격 반영, 타입 재생성, E2E

**Files:**
- Modify: `it_frontend/app/pages/admin/migration/index.vue`
- Modify: `it_frontend/app/types/api.d.ts` (생성물)
- Modify: `it_frontend/tests/unit/pages/MigrationPageBoundary.test.ts`
- Modify: `it_frontend/tests/e2e/` 의 이관 시나리오
- Modify: `it_database/migrations/` — **변경 없음**. 메뉴명은 `TPRMPP_CMENUM`에 있으므로 DB 값을 바꾸려면 별도 스크립트가 필요하다. 이번 범위에서는 **화면 제목만** 바꾸고 메뉴명은 그대로 둔다

**Interfaces:**
- Consumes: Task 9의 `CommitResponse`, Task 12의 결정 API

- [ ] **Step 1: 반영 결과에 편성 결과를 드러낸다**

`index.vue`의 결과 섹션을 고친다. `costCount`·`projectCount`는 이제 "새로 만든" 수이므로 문구를 바꾼다.

```vue
<section v-if="preview.commitResult.value" class="migration-page__result">
    <h3>{{ t('migration.result.title') }}</h3>
    <ul>
        <li>{{ t('migration.result.budgetRows', { count: preview.commitResult.value.budgetRowCount }) }}</li>
        <li v-if="preview.commitResult.value.projectCount">
            {{ t('migration.result.createdProjects', { count: preview.commitResult.value.projectCount }) }}
        </li>
        <li v-if="preview.commitResult.value.costCount">
            {{ t('migration.result.createdCosts', { count: preview.commitResult.value.costCount }) }}
        </li>
        <li v-if="preview.commitResult.value.planReqDocNo">
            {{ t('migration.result.plan', { no: preview.commitResult.value.planReqDocNo }) }}
        </li>
    </ul>
</section>
```

`migration.ts` 메시지에 `result` 트리를 더한다. 한국어: `편성행 {count}건을 만들었습니다` / `사업 {count}건을 새로 만들었습니다` / `전산업무비 {count}건을 새로 만들었습니다` / `조정 계획 {no}`.

화면 제목도 `definePageMeta({ middleware: 'admin', tabTitle: t('migration.pageTitle') })` 대신 상수 키로 두고, 한국어 값을 `편성률 반영`으로 한다. 메뉴명(`TPRMPP_CMENUM`)은 이번에 바꾸지 않으므로 탭 제목이 메뉴명과 달라지는 것이 의도다 — `it_frontend/CLAUDE.md` §4의 `tabTitle` 우선순위가 이 경우를 위해 있다.

- [ ] **Step 2: 백엔드를 띄우고 타입을 재생성한다**

```bash
cd it_backend && ./gradlew bootRun
```

다른 터미널에서:

```bash
cd it_frontend && npm run codegen && npm run codegen:check
```

Expected: `codegen:check` PASS

- [ ] **Step 3: 경계 테스트를 갱신한다**

`tests/unit/pages/MigrationPageBoundary.test.ts`가 `useMigrationPage` 소비를 고정한다. 결정 API가 파사드를 거치는지 확인하고, 페이지가 `useMigrationPreview`를 직접 부르지 않는지 단정을 유지한다.

- [ ] **Step 4: E2E 시나리오를 갱신한다**

이관 E2E가 있으면 다음 흐름으로 바꾼다: 관리자 로그인 → 종합본 업로드 → `결정` 열에 `LEDGER_NOT_MATCHED` 드롭다운이 뜨는지 확인 → `전 행을 새 원장으로` 클릭 → BLOCKER 0 → 반영 → 편성행 건수 표시 확인.

```bash
cd it_frontend && npm run test:e2e
```

Expected: PASS

- [ ] **Step 5: 전체 품질 게이트를 돌린다**

```bash
cd it_frontend && npm run format:check && npm run check && npm run lint:css && npm test
```

```bash
cd it_backend && ./gradlew check
```

Expected: 모두 PASS

- [ ] **Step 6: 커밋**

```bash
cd it_frontend && git add app/pages/admin/migration/index.vue app/i18n/messages/migration.ts app/types/api.d.ts tests/unit/pages/MigrationPageBoundary.test.ts tests/e2e/ scripts/user-facing-copy-baselines.mjs && git diff --cached --stat && git commit -m "feat: 데이터 일괄 반입 화면을 편성률 반영으로 정리"
```

- [ ] **Step 7: 문서와 버전 고정**

`C:\it`에서:

```bash
cd C:\it && pwsh scripts/update-versions-lock.ps1 && git add versions.lock TASK.md && git diff --cached --stat && git commit -m "chore: 편성 전용 전환 반영 버전 고정"
```

`TASK.md`에 남은 후속 과제를 적는다.

- `/budget/work` 화면의 편성률 입력이 여전히 정수 스테퍼다. 소수 편성률이 걸린 사업을 그 화면에서 저장하면 정수로 덮인다 — 경고 표시 또는 소수 입력 지원이 필요하다
- `TPRMPP_CMENUM`의 `/admin/migration` 메뉴명이 `데이터 일괄 반입`으로 남아 있다. 화면 성격이 바뀌었으므로 메뉴명 변경 스크립트가 필요하다
- 위임예산 시트에는 조정률 열이 없어 편성률 100%(금액 그대로)를 쓴다. 예산담당자가 위임예산에도 조정을 걸기 시작하면 열 추가와 함께 재검토한다

---

## 자체 검토 결과

**스펙 커버리지**

| 스펙 절 | 태스크 |
| --- | --- |
| §2.1 역할 분리 | Task 9 (원장 생성이 `CREATE_NEW`에만) |
| §2.2 금액 기준 | Task 7 (`declaredBase`), Task 8 (`AMOUNT_ADJUSTED`) |
| §3.2 물리 컬럼 실측 | Task 1 |
| §3.3 계산식 | Task 5 |
| §3.4 비목그룹 정의 | Task 5 (`GROUP_DEV`·`GROUP_HW`·`GROUP_SW`·`itemsOutsideCapitalGroups`) |
| §3.5 반올림·`ITEM_BASE_ZERO`·목표액 0 | Task 5 |
| §3.6 계약 변경 | Task 1, Task 2 |
| §4.1 매칭 키 3종 + 완화 매칭 | Task 4 |
| §4.1 `BG_UNT_ABUS_C` 빈칸 채우기 | **미할당** → 아래 참조 |
| §4.2 결정 3종 + 일괄 지정 | Task 6, Task 9, Task 12 |
| §4.3 `DUP_IOE_MNGC` | Task 7 |
| §5.1 진단 카탈로그 | Task 6 (코드 목록), Task 8 (생성) |
| §5.2 `CREATE_NEW` 한정 검증 | Task 8 |
| §5.3 연도 전체 보존 | Task 3, Task 9 (`itemRates`) |
| §6.1 모듈 구성 | Task 4·5·7·8·9 |
| §6.2 반영 흐름 | Task 9 |
| §6.3 프론트 | Task 11·12·13 |
| §7 검증 | Task 10 및 각 태스크의 테스트 단계 |

**보완: §4.1의 `BG_UNT_ABUS_C` 빈칸 채우기가 어느 태스크에도 없었다.** Task 9의 5단계 앞에 다음 단계를 추가한다.

- [ ] **Task 9 Step 5b: 매칭된 전산업무비의 빈 사업코드를 채운다**

`commit`의 3단계와 4단계 사이에 넣는다.

```java
        // 3.5단계: 매칭된 전산업무비 원장의 사업코드가 비어 있으면 종합본 값으로 채운다.
        //          편성요청서 양식에 그 열이 없어 1단계가 만든 행은 대부분 null인데,
        //          예산 집계가 사업코드로 묶이므로 비워 두면 집계에서 빠진다.
        //          null → 값만 채우고 이미 값이 있으면 건드리지 않는다(요청 내용을 덮지 않는다).
        for (SheetKind kind : ADAPTER_ORDER) {
            for (MigrationDto.SheetPayload sheet : request.sheets()) {
                if (sheet.kind() != SheetKind.COST || sheet.kind() != kind) {
                    continue;
                }
                for (AllocationIntent intent : adapters.get(kind).adapt(sheet, ctx).allocations()) {
                    MigrationMatchDiagnostics.Resolved resolved =
                            matchDiagnostics.resolve(sheet, intent, snapshot, overrides);
                    if (resolved.action() != RowDecision.Kind.MATCH
                            || snapshot.bgUntAbusCOf(resolved.pk()) != null) {
                        continue;
                    }
                    String abusCode =
                            MigrationDiagnostics.cell(
                                    rowAt(sheet, intent.excelRow()), "abusCode", overrides, sheet);
                    if (!abusCode.isBlank()) {
                        costRepository
                                .findByCostBgNoAndDelYn(resolved.pk(), "N")
                                .forEach(cost -> cost.updateBudgetUnitCode(abusCode));
                    }
                }
            }
        }
```

`Bcostm`에 다음 메서드를 추가한다(`it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java`).

```java
    /**
     * 사업코드를 채웁니다. 편성요구서 종합에만 있는 값이라 편성요청서 반입 경로에서는 비어 있습니다.
     *
     * <p>이미 값이 있으면 덮지 않습니다 — 부서가 적어 낸 값을 종합본이 조용히 바꾸지 않게 합니다.
     *
     * @param bgUntAbusC 사업코드 (3자리)
     */
    public void fillBudgetUnitCodeIfAbsent(String bgUntAbusC) {
        if (this.bgUntAbusC == null || this.bgUntAbusC.isBlank()) {
            this.bgUntAbusC = bgUntAbusC;
        }
    }
```

위 스니펫의 `updateBudgetUnitCode`는 `fillBudgetUnitCodeIfAbsent`로 쓴다. 또한 `MigrationDiagnostics`가 패키지 전용이므로 `MigrationImportService`(같은 패키지)에서 그대로 호출할 수 있다. `rowAt` 헬퍼는 `MigrationMatchDiagnostics`의 것과 같은 로직을 `MigrationImportService`에도 private으로 둔다.

이 단계를 검증하는 테스트를 Task 10에 더한다.

```java
@Test
@Tag("it")
@DisplayName("매칭된_전산업무비의_빈_사업코드가_종합본_값으로_채워진다")
void 매칭된_전산업무비의_빈_사업코드가_종합본_값으로_채워진다() {
    String costNo = 요청전산업무비를_만든다("011", "커브", "올인원워크스페이스", null);

    service.commit(전산업무비_커밋요청("571", "유지보수료", "커브", "올인원워크스페이스", "15401"), TEST_ENO);

    Bcostm reloaded =
            CostRepresentativeSelector.pick(costRepository.findByCostBgNoAndDelYn(costNo, "N"));
    assertThat(reloaded.getBgUntAbusC()).isEqualTo("571");
}
```

**타입 일관성 확인**

- `MigrationYearSnapshot.RequestItem`이 Task 3에서 정의되고 Task 5·8·9가 같은 이름·필드로 쓴다 ✓
- `MigrationLedgerMatcher.Match`가 Task 4에서 정의되고 Task 8이 `outcome()`·`pk()`·`candidates()`로 읽는다 ✓
- `RowDecision.Kind`가 Task 6에서 정의되고 Task 8·9가 `MATCH`·`CREATE_NEW`·`SKIP`으로 쓴다 ✓
- `AllocationIntent.targetByColumn`의 키가 Task 7(생성)과 Task 5·8·9(소비)에서 `devAmount`·`hwAmount`·`swAmount`·`generalAmount`·`costAmount`로 같다 ✓
- `MigrationAllocationPlanner.groupOf`가 `generalAmount`·`costAmount`에 빈 집합을 돌려주고, Task 8·9가 그때 `itemsOutsideCapitalGroups`로 떨어진다 ✓
- `BudgetWorkDto.ItemRate`의 5번째 인자 `ioeRates`가 Task 2에서 추가되고 Task 9가 채운다 ✓
- `MigrationValidator.validate`의 5번째 인자 `createNewRows`가 Task 8에서 추가되고 Task 9가 넘긴다 ✓
- `MigrationValidator.overrideKey`는 기존 public static이며 Task 8의 `MigrationMatchDiagnostics`가 그대로 쓴다 ✓

