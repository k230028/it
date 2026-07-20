# 백엔드 잔여과제(BE-02·03·06·09·10·11) 조치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TASK.md 백엔드 섹션의 진행 중 과제 6건(BE-02/03/06/09/10/11)을 위험도 순서(Phase A→B→C)로 해소한다.

**Architecture:** 비결정 첫 행 선택은 패키지 전용 정적 선택 헬퍼로 추출해 단위 테스트하고, 팀 조회 N+1은 `findByTemCInAndDelYn` 활성 사용자 배치 조회 + 공용 `UserRepresentativeSelector`로 통일한다. 검토자 후보는 문서와 무관한 전역 목록이므로 API를 `/api/reviews/reviewers`로 정규화하고 프론트 호출부를 함께 전환한다. DB 정합(BE-11)은 ORM 선언을 완화하되 파일 소비 경로에서 불완전 메타데이터를 명시적으로 처리한다. BE-03은 조사 리포트 기반으로 명백 후보만 프로젝션 분리하고, BE-06은 상위 오염원 주석 보강 + Lombok 기본 생성자 정책화로 마감한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, JUnit 5 + AssertJ + Mockito, 로컬 Oracle `@DataJpaTest` 하네스(`AbstractOracleRepositoryTest`, `@Tag("it")`), Nuxt 4 + Pinia + Vitest.

**Spec:** `docs/superpowers/specs/2026-07-20-backend-task-remediation-design.md`

---

## 사전 조건·주의

- `it_backend`와 `it_frontend`는 각각 **독립 git 저장소**다. 코드 커밋은 반드시 해당 저장소 안에서 수행한다. 외부 `C:\it` 저장소에는 문서(리포트, TASK.md 등)만 커밋한다.
- `integrationTest`(`@Tag("it")`)는 로컬 Oracle(ITPAPP@127.0.0.1:11521/XEPDB1)이 기동 중이어야 실행된다. 꺼져 있으면 `OracleAvailableCondition`이 스킵하므로 **실행 전 Oracle 기동을 확인**한다.
- Gradle 명령은 항상 `C:\it\it_backend`로 `cd`한 뒤 실행한다(백그라운드 셸은 cwd를 상속하지 않음). `binary/output.bin` 파일락이 발생하면 `--no-daemon`을 붙이고 락 파일을 정리한다.
- `./gradlew clean`은 Jacoco 리포트도 삭제하므로 이 계획에서는 사용하지 않는다.
- 커밋 메시지는 `<type>: <설명>` 한글 컨벤션(feat/fix/refactor/docs/test/chore)을 따른다.

## 파일 구조 (전체 변경 지도)

**it_backend 저장소 — main:**

| 파일 | 작업 | 책임 |
| ---- | ---- | ---- |
| `src/main/java/com/kdb/it/domain/budget/cost/service/CostRepresentativeSelector.java` | 생성 | 비용 대표 행 규칙의 공용 단일 구현 (Task 2) |
| `src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java` | 수정 | 공용 대표 행 선택기로 `get(0)` 3곳 교체 (Task 2) |
| `src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java` | 수정 | 비용 배치 결과의 무정렬 계약명 선택 제거 (Task 2) |
| `src/main/java/com/kdb/it/domain/bizplan/service/BizplanService.java` | 수정 | `selectLatestBgKey` 정적 헬퍼 추가, `resolveBgNo` 교체 (Task 3) |
| `src/main/java/com/kdb/it/common/iam/repository/UserRepository.java` | 수정 | `findByTemCInAndDelYn` 활성 사용자 파생 쿼리 추가 (Task 5) |
| `src/main/java/com/kdb/it/common/iam/service/UserRepresentativeSelector.java` | 생성 | 팀 대표자 결정적 선택 공용 유틸 (Task 6) |
| `src/main/java/com/kdb/it/domain/budget/document/service/ReviewerService.java` | 수정 | 배치 조회 + 순서 고정, 미사용 문서번호 제거 (Task 7) |
| `src/main/java/com/kdb/it/domain/budget/document/controller/ReviewerController.java` | 수정 | 전역 검토자 API 추가 + 구 경로 한시 호환 (Task 7) |
| `src/main/java/com/kdb/it/domain/council/service/CommitteeService.java` | 수정 | `resolveTeamLeads` 배치 전환 (Task 8) |
| `src/main/java/com/kdb/it/infra/file/entity/Cfilem.java` | 수정 | 3컬럼 `nullable=false` 제거 (Task 9) |
| `src/main/java/com/kdb/it/infra/file/service/FileService.java` | 수정 | 불완전 파일 메타데이터 다운로드 가드·파일명 폴백 (Task 9) |
| `src/main/java/com/kdb/it/infra/ai/service/GeminiService.java` | 수정 | 불완전 파일 메타데이터 첨부 skip·파일명 폴백 (Task 9) |
| `build.gradle` | 수정 | Javadoc `-Xmaxwarns` 상한 해제 (Task 14) |
| `Bprojm`·`ContractController`·`ApplicationDto`·`CouncilProjectRow`·`UmsPayload`·`Btermm` | 수정 | Javadoc 누락 주석 보강 (Task 15·16) |
| `CLAUDE.md` | 수정 | Lombok 기본 생성자 경고 정책 규칙 추가 (Task 16) |

**it_backend 저장소 — test:**

| 파일 | 작업 | 책임 |
| ---- | ---- | ---- |
| `src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java` | 수정 | 공용 비용 대표 행 선택기 @Nested 테스트 (Task 2) |
| `src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java` | 수정 | 비용 이력 입력 순서와 무관한 계약명 회귀 테스트 (Task 2) |
| `src/test/java/com/kdb/it/domain/bizplan/service/BizplanServiceTest.java` | 수정 | `selectLatestBgKey` @Nested 테스트 (Task 3) |
| `src/test/java/com/kdb/it/common/iam/repository/UserRepositoryTemCInIt.java` | 생성 | `findByTemCInAndDelYn` 활성 사용자 통합 테스트 (Task 5) |
| `src/test/java/com/kdb/it/common/iam/service/UserRepresentativeSelectorTest.java` | 생성 | 대표자 선택 규칙 단위 테스트 (Task 6) |
| `src/test/java/com/kdb/it/domain/budget/document/service/ReviewerServiceTest.java` | 수정 | 배치 스텁 기준 재작성 (Task 7) |
| `src/test/java/com/kdb/it/domain/budget/document/controller/ReviewerControllerTest.java` | 수정 | 전역 검토자 API 인증·응답 계약 검증 (Task 7) |
| `src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java` | 수정 | `findByTemCInAndDelYn` 스텁 전환 (Task 8) |
| `src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java` | 수정 | NULL 파일 메타데이터 다운로드 실패·폴백 테스트 (Task 9) |
| `src/test/java/com/kdb/it/infra/ai/service/GeminiServiceTest.java` | 수정 | NULL 파일 메타데이터 첨부 skip·폴백 테스트 (Task 9) |

**it_frontend 저장소:**

| 파일 | 작업 | 책임 |
| ---- | ---- | ---- |
| `app/stores/review.ts` | 수정 | 검토자 조회를 `/api/reviews/reviewers`로 전환 (Task 7) |
| `tests/unit/stores/review.direct.test.ts` | 수정 | 전역 검토자 API URL 계약 검증 (Task 7) |

**외부 C:\it 저장소:**

| 파일 | 작업 | 책임 |
| ---- | ---- | ---- |
| `docs/superpowers/reports/2026-07-be03-projection-survey.md` | 생성 | BE-03 조사 리포트 (Task 12) |
| `TASK.md`, `TASK_DONE.md`, `README.md` | 수정 | 완료 이관·변경 이력 (Task 17) |

## 핵심 데이터 흐름

```text
[비결정 행 목록] ──> [결정 규칙 헬퍼] ──> [대표 행/키]
                              └───────> [중복 정합성 WARN]

[GET /api/reviews/reviewers] ──────────────┐
[구 /{docMngNo}/reviewers] ── 한시 호환 ──┤
                                           ▼
 [ReviewerController]
            │
            ▼
 [ReviewerService] ── 1회 ──> [CUSERI: TEM_C IN (...) AND DEL_YN='N']
            │
            ▼
 [팀별 그룹화] ──> [UserRepresentativeSelector] ──> [고정 순서 DTO]
            ▲
            └──────────── CommitteeService도 같은 선택 규칙 재사용

[CFILEM 레거시 NULL]
       ├── 다운로드 ──> 필수 경로/물리명 가드 ──> 명시적 업무 오류
       └── Gemini ───> 필수 경로/물리명 가드 ──> 사유 있는 skip
```

구현 대상 흐름은 분기 수가 작고 각 메서드 Javadoc으로 충분히 설명되므로 소스 코드 안에 별도 ASCII 다이어그램을 추가하지 않는다. 향후 검토자 선정 단계나 파일 상태 전이가 늘어 3단계 이상 상태 머신이 되면 해당 Service에 인라인 다이어그램을 추가한다.

---

## Phase A — BE-09 비결정 첫 행 선택 제거 (🟠 High)

### Task 1: Phase A 브랜치 생성

- [ ] **Step 1: it_backend에서 브랜치 생성**

```bash
cd C:\it\it_backend
git checkout main
git pull
git checkout -b fix/be09-deterministic-row-selection
```

Expected: `Switched to a new branch 'fix/be09-deterministic-row-selection'`

### Task 2: 비용 도메인 공용 대표 행 결정적 선택

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostRepresentativeSelector.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

`CostServiceTest.java`에 아래 `@Nested` 클래스를 추가한다. 필요한 import: `org.junit.jupiter.api.Nested`, `com.kdb.it.domain.budget.cost.entity.Bcostm`, `java.util.List`, `static org.assertj.core.api.Assertions.assertThat`, `static org.assertj.core.api.Assertions.assertThatThrownBy` (기존에 있으면 생략).

```java
    @Nested
    @DisplayName("CostRepresentativeSelector — 대표 행 결정적 선택 (BE-09)")
    class PickTests {

        private Bcostm cost(int bgSno, String lstYn) {
            return Bcostm.builder()
                    .costBgNo("COST_2026_0001")
                    .bgSno(bgSno)
                    .lstYn(lstYn)
                    .build();
        }

        @Test
        @DisplayName("단건이면 그 행을 반환한다")
        void singleRow_returned() {
            Bcostm only = cost(1, "Y");
            assertThat(CostRepresentativeSelector.pick(List.of(only))).isSameAs(only);
        }

        @Test
        @DisplayName("LST_YN='Y' 행이 'N' 행보다 우선한다")
        void latestYn_preferred() {
            Bcostm oldRow = cost(2, "N");
            Bcostm latest = cost(1, "Y");
            assertThat(CostRepresentativeSelector.pick(List.of(oldRow, latest))).isSameAs(latest);
        }

        @Test
        @DisplayName("같은 LST_YN이면 BG_SNO 내림차순으로 최신 일련번호를 선택한다")
        void sameLstYn_highestBgSno() {
            Bcostm sno1 = cost(1, "N");
            Bcostm sno3 = cost(3, "N");
            Bcostm sno2 = cost(2, "N");
            assertThat(CostRepresentativeSelector.pick(List.of(sno1, sno3, sno2))).isSameAs(sno3);
        }

        @Test
        @DisplayName("LST_YN='Y' 다건이면 BG_SNO가 큰 행을 선택한다 (WARN 경로)")
        void duplicateLatest_deterministicTieBreak() {
            Bcostm dup1 = cost(1, "Y");
            Bcostm dup2 = cost(2, "Y");
            assertThat(CostRepresentativeSelector.pick(List.of(dup1, dup2))).isSameAs(dup2);
        }

        @Test
        @DisplayName("입력 순서와 무관하게 항상 같은 행을 선택한다")
        void orderIndependent() {
            Bcostm a = cost(1, "N");
            Bcostm b = cost(2, "Y");
            Bcostm c = cost(3, "N");
            assertThat(CostRepresentativeSelector.pick(List.of(a, b, c)).getBgSno())
                    .isEqualTo(CostRepresentativeSelector.pick(List.of(c, b, a)).getBgSno());
        }

        @Test
        @DisplayName("빈 목록이면 명시적인 업무 예외를 던진다")
        void emptyRows_throwsIllegalArgumentException() {
            assertThatThrownBy(() -> CostRepresentativeSelector.pick(List.of()))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("비용 이력 목록이 비어 있습니다");
        }
    }
```

`BudgetWorkServiceTest.java`의 기존 `getProjectSummary_BITEMM프로젝트통합과BCOSTM계약명표시` 픽스처를 따라 같은 `COST_BG_NO`의 비용 이력 2건을 무정렬·역순으로 반환하는 회귀 테스트를 추가한다. `LST_YN='N'`인 큰 `BG_SNO` 행이 먼저 와도 `LST_YN='Y'` 대표 행의 `CTT_NM`이 응답 이름으로 선택되고, 입력 순서를 뒤집어도 결과가 같음을 어서션한다.

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest"
./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest"
```

Expected: 컴파일 오류 — `CostRepresentativeSelector` 미정의, 이후에는 BudgetWorkService 계약명 회귀 어서션 실패

- [ ] **Step 3: 공용 선택기 구현**

`CostRepresentativeSelector.java`를 다음과 같이 생성한다.

```java
package com.kdb.it.domain.budget.cost.service;

import com.kdb.it.domain.budget.cost.entity.Bcostm;
import java.util.Comparator;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

/** 비용 이력 목록의 대표 행 선택 규칙을 공유하는 유틸리티. */
@Slf4j
public final class CostRepresentativeSelector {

    private CostRepresentativeSelector() {
    }

    /**
     * 동일 관리번호 이력 목록에서 대표 행을 결정적으로 선택합니다. (BE-09)
     *
     * <p>선택 규칙: ① {@code LST_YN='Y'} 행 우선 → ② {@code BG_SNO} 내림차순(최신 일련번호).
     * {@code LST_YN='Y'} 행이 2건 이상이면 데이터 정합성 이상이므로 WARN 로그를 남기고
     * tie-break 결과를 사용합니다(장애 없이 동작).</p>
     *
     * @param costs 동일 {@code IT_MNGC_NO}의 미삭제 이력 목록
     * @return 대표 행
     * @throws IllegalArgumentException 목록이 비어 있는 경우
     */
    public static Bcostm pick(List<Bcostm> costs) {
        Bcostm primary = costs.stream()
                .min(Comparator.comparing((Bcostm c) -> "Y".equals(c.getLstYn()) ? 0 : 1)
                        .thenComparing(Bcostm::getBgSno,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .orElseThrow(() -> new IllegalArgumentException("비용 이력 목록이 비어 있습니다."));
        long latestCount = costs.stream().filter(c -> "Y".equals(c.getLstYn())).count();
        if (latestCount > 1) {
            log.warn("전산관리비 LST_YN='Y' 행이 {}건입니다 (costBgNo={}, 선택 bgSno={})",
                    latestCount, primary.getCostBgNo(), primary.getBgSno());
        }
        return primary;
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest"
```

Expected: BUILD SUCCESSFUL, PickTests 6건 PASS

- [ ] **Step 5: 호출부 3곳 교체 — getCost**

`getCost`의 본문(139~145행 부근)에서:

```java
        CostDto.Response response = CostDto.Response.fromEntity(costs.get(0));
        enrichResponse(response, costs.get(0));
```

를 다음으로 교체:

```java
        Bcostm primary = CostRepresentativeSelector.pick(costs);
        CostDto.Response response = CostDto.Response.fromEntity(primary);
        enrichResponse(response, primary);
```

같은 메서드의 Javadoc에서 아래 두 단락:

```java
     * {@code IT_MNGC_NO}로 삭제되지 않은({@code DEL_YN='N'}) 항목을 조회합니다.
     * 동일 관리번호에 여러 이력(SNO)이 있을 수 있으므로, 첫 번째 항목을 반환합니다.
     * </p>
     *
     * <p>
     * 비즈니스 규칙상 {@code IT_MNGC_NO}가 유니크하게 관리된다면 목록 크기는 1입니다.
     * </p>
```

를 다음으로 교체:

```java
     * {@code IT_MNGC_NO}로 삭제되지 않은({@code DEL_YN='N'}) 항목을 조회합니다.
     * 동일 관리번호에 여러 이력(SNO)이 있으면 {@link CostRepresentativeSelector#pick(List)}이
     * 최신·활성 조건(LST_YN='Y' 우선, BG_SNO 내림차순)으로 대표 행을 결정적으로 선택합니다.
     * </p>
```

- [ ] **Step 6: 호출부 교체 — updateCost**

`updateCost`의:

```java
        Bcostm target = costs.stream()
                .filter(c -> "Y".equals(c.getLstYn()))
                .findFirst()
                .orElse(costs.get(0));
```

를 다음으로 교체:

```java
        Bcostm target = CostRepresentativeSelector.pick(costs);
```

- [ ] **Step 7: 호출부 교체 — deleteCost**

`deleteCost`의:

```java
        OwnershipVerifier.verifyModifiable(costs.get(0).getFstEnrUsid(), costs.get(0).getCostSvnDpmC());
```

를 다음으로 교체:

```java
        Bcostm primary = CostRepresentativeSelector.pick(costs);
        OwnershipVerifier.verifyModifiable(primary.getFstEnrUsid(), primary.getCostSvnDpmC());
```

(전 행 soft delete 루프는 그대로 유지한다.)

- [ ] **Step 8: BudgetWorkService 비용 계약명 배치 결과에 공용 선택기 적용**

`BudgetWorkService.java`에 `CostRepresentativeSelector` import를 추가하고 `getProjectSummary`의 `costNameByNo` 구성부를 비용번호별 이력 그룹화 후 대표 행 선택으로 바꾼다.

```java
        Map<String, String> costNameByNo = new LinkedHashMap<>();
        if (!costGroupNos.isEmpty()) {
            costRepository.findByCostBgNoInAndDelYn(costGroupNos, "N").stream()
                    .collect(Collectors.groupingBy(
                            Bcostm::getCostBgNo,
                            LinkedHashMap::new,
                            Collectors.toList()))
                    .forEach((costBgNo, histories) -> costNameByNo.put(
                            costBgNo,
                            CostRepresentativeSelector.pick(histories).getCttNm()));
        }
```

계약명이 null인 대표 행도 Map 키를 유지해 기존 폴백 판정 의미를 보존한다.

- [ ] **Step 9: 잔여 비결정 선택 확인**

`CostService.java`에서 `costs.get(0)` 검색 결과가 0건인지 확인하고, `BudgetWorkService.java`의 `findByCostBgNoInAndDelYn` 결과가 `putIfAbsent`/첫 행으로 직접 선택되지 않는지 확인한다. `setApplicationInfo`의 `capplas.get(0)`은 `OrderByApfDcmNoDesc` 정렬 결과의 첫 행이므로 **결정적 — 변경하지 않는다.**

- [ ] **Step 10: 전체 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.cost.service.*"
./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest"
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 11: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/cost/service/CostRepresentativeSelector.java src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java
git commit -m "fix: 비용 도메인 대표 행 선택 규칙을 공용화 (BE-09)"
```

### Task 3: BizplanService BG- 키 결정적 선택

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/bizplan/service/BizplanService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/bizplan/service/BizplanServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

`BizplanServiceTest.java`에 아래 `@Nested` 클래스를 추가한다(`PRJ` 상수·`Bproja` import는 기존 파일에 이미 존재한다).

```java
    @Nested
    @DisplayName("selectLatestBgKey — BG- 키 결정적 선택 (BE-09)")
    class SelectLatestBgKeyTests {

        private Bproja app(String cncdRfrNo) {
            return Bproja.builder()
                    .abusMngNo(PRJ)
                    .cncdRfrNo(cncdRfrNo)
                    .stsTc("09")
                    .build();
        }

        @Test
        @DisplayName("BG- 키가 없으면 null을 반환한다")
        void noBgKey_returnsNull() {
            assertThat(BizplanService.selectLatestBgKey(PRJ,
                    List.of(app("BIZ-" + PRJ))))
                    .isNull();
        }

        @Test
        @DisplayName("BG- 키 1건이면 그 키를 반환한다")
        void singleBgKey_returned() {
            assertThat(BizplanService.selectLatestBgKey(PRJ,
                    List.of(
                            app("BG-2026-0001"),
                            app("BIZ-" + PRJ))))
                    .isEqualTo("BG-2026-0001");
        }

        @Test
        @DisplayName("BG- 키 다건이면 채번 키 내림차순으로 최신 키를 선택한다 (WARN 경로)")
        void multipleBgKeys_latestSelected() {
            assertThat(BizplanService.selectLatestBgKey(PRJ,
                    List.of(
                            app("BG-2026-0001"),
                            app("BG-2026-0002"))))
                    .isEqualTo("BG-2026-0002");
        }

        @Test
        @DisplayName("입력 순서를 뒤집어도 같은 최신 채번 키를 선택한다")
        void inputOrder_independent() {
            assertThat(BizplanService.selectLatestBgKey(PRJ,
                    List.of(app("BG-2026-0010"), app("BG-2026-0009"))))
                    .isEqualTo(BizplanService.selectLatestBgKey(PRJ,
                            List.of(app("BG-2026-0009"), app("BG-2026-0010"))));
        }

        @Test
        @DisplayName("cncdRfrNo가 null인 행은 무시한다")
        void nullKey_ignored() {
            assertThat(BizplanService.selectLatestBgKey(PRJ,
                    List.of(
                            app(null),
                            app("BG-2026-0001"))))
                    .isEqualTo("BG-2026-0001");
        }
    }
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.bizplan.service.BizplanServiceTest"
```

Expected: 컴파일 오류 — `selectLatestBgKey` 미정의

- [ ] **Step 3: 구현**

`BizplanService.java`에 slf4j import와 로거 필드를 추가한다:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
```

```java
    private static final Logger log = LoggerFactory.getLogger(BizplanService.class);
```

기존 `resolveBgNo` 전체(Javadoc 포함):

```java
    /**
     * BPROJA 예산편성 행(BG-%)에서 예산번호 자동 연계 (없으면 null).
     *
     * <p>한 사업의 예산편성 단계 BPROJA 행은 1건이라는 전제로 첫 BG- 키를 사용한다.
     * 다건이 존재할 경우 어느 행이 선택될지는 보장되지 않는다.</p>
     */
    private String resolveBgNo(String abusMngNo) {
        return bprojaRepository.findByAbusMngNoAndDelYn(abusMngNo, "N").stream()
                .map(application -> application.getCncdRfrNo())
                .filter(key -> key != null && key.startsWith(BG_KEY_PREFIX))
                .findFirst()
                .orElse(null);
    }
```

를 다음으로 교체:

```java
    /**
     * BPROJA 예산편성 행(BG-%)에서 예산번호 자동 연계 (없으면 null).
     *
     * <p>원칙적으로 사업당 예산편성 BPROJA 행은 1건이나, 다건이 존재하면
     * {@link #selectLatestBgKey(String, List)}가 최신 키를 결정적으로 선택하고 WARN을 남긴다.</p>
     */
    private String resolveBgNo(String abusMngNo) {
        return selectLatestBgKey(abusMngNo, bprojaRepository.findByAbusMngNoAndDelYn(abusMngNo, "N"));
    }

    /**
     * BG- 접두 후보 키 중 최신 키를 결정적으로 선택한다. (BE-09)
     *
     * <p>선택 규칙: {@code CNCD_RFR_NO} 사전순 내림차순. BG 키는
     * {@code BG-{예산년도}-{SEQ_BBUGTM 4자리}}로 생성되므로 같은 형식 안에서 키 내림차순이
     * 최신 채번 순서와 일치한다. 서로 다른 BG- 키가 2건 이상이면 WARN 로그를 남긴다.</p>
     *
     * @param abusMngNo    사업관리번호 (로그 문맥용)
     * @param applications 미삭제 BPROJA 행 목록
     * @return 최신 BG- 키 (후보가 없으면 null)
     */
    static String selectLatestBgKey(String abusMngNo, List<Bproja> applications) {
        List<Bproja> candidates = applications.stream()
                .filter(application -> application.getCncdRfrNo() != null
                        && application.getCncdRfrNo().startsWith(BG_KEY_PREFIX))
                .sorted(Comparator.comparing(Bproja::getCncdRfrNo).reversed())
                .toList();
        if (candidates.size() > 1) {
            log.warn("BPROJA 예산편성 BG- 키가 {}건입니다 (abusMngNo={}, 선택 키={})",
                    candidates.size(), abusMngNo, candidates.get(0).getCncdRfrNo());
        }
        return candidates.isEmpty() ? null : candidates.get(0).getCncdRfrNo();
    }
```

(`java.util.Comparator`는 기존에 import되어 있다.)

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.bizplan.service.BizplanServiceTest"
```

Expected: BUILD SUCCESSFUL — 신규 5건 포함 전체 PASS (기존 `createsPlanWithStatus21AndBgNo` 테스트가 회귀 검증 역할)

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/bizplan/service/BizplanService.java src/test/java/com/kdb/it/domain/bizplan/service/BizplanServiceTest.java
git commit -m "fix: 사업계획 BG_NO 연계 키 선택을 결정적 규칙으로 교체 (BE-09)"
```

### Task 4: Phase A 검증·병합

- [ ] **Step 1: 전체 단위 테스트**

```bash
cd C:\it\it_backend
./gradlew test
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 2: main 병합**

```bash
cd C:\it\it_backend
git checkout main
git merge --no-ff fix/be09-deterministic-row-selection -m "merge: BE-09 비결정 첫 행 선택 제거"
```

---

## Phase B — BE-10 팀 조회 배치화 + BE-11 Cfilem NULL 정책 (🟡 Medium)

### Task 5: UserRepository.findByTemCInAndDelYn + 통합 테스트

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepository.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/iam/repository/UserRepositoryTemCInIt.java`

- [ ] **Step 0: Phase B 브랜치 생성**

```bash
cd C:\it\it_backend
git checkout main
git checkout -b feat/be10-be11-team-batch-and-cfilem

cd C:\it\it_frontend
git checkout main
git checkout -b feat/be10-global-reviewers-api
```

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`UserRepositoryTemCInIt.java` 생성 (기존 `BbugtmRepositoryIntegrationTest` 픽스처 관례를 따름):

```java
package com.kdb.it.common.iam.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.support.AbstractOracleRepositoryTest;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;

/**
 * UserRepository.findByTemCInAndDelYn 활성 사용자 배치 조회 통합 테스트 (BE-10)
 *
 * <p>실 로컬 Oracle(ITPOWN)에 @DataJpaTest로 연결하며, 픽스처는 트랜잭션 롤백으로
 * 정리된다. 존재하지 않는 팀코드 대역(T999x)을 사용해 실 데이터와 격리한다.</p>
 */
@DisplayName("UserRepository.findByTemCInAndDelYn 활성 사용자 배치 조회 (BE-10)")
class UserRepositoryTemCInIt extends AbstractOracleRepositoryTest {

    private static final String TEAM_A = "T9991";
    private static final String TEAM_B = "T9992";
    private static final String TEAM_EMPTY = "T9993";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TestEntityManager em;

    /**
     * 테스트 픽스처 사용자 생성.
     *
     * <p>{@code @DataJpaTest} 슬라이스에는 SecurityContext가 없어 감사컬럼을 직접 세팅한다.
     * (실행 시 다른 NOT NULL 컬럼으로 ORA-01400이 발생하면 해당 필드에 픽스처 값을 보강한다.)</p>
     */
    private CuserI insertUser(String eno, String temC, String ptCNm) {
        CuserI user = CuserI.builder()
                .eno(eno)
                .usrNm("테스트" + eno)
                .temC(temC)
                .ptCNm(ptCNm)
                .delYn("N")
                .fstEnrUsid("FIXTURE")
                .fstEnrDtm(LocalDateTime.now())
                .lstChgUsid("FIXTURE")
                .lstChgDtm(LocalDateTime.now())
                .build();
        return em.persist(user);
    }

    @Test
    @DisplayName("여러 팀코드의 사용자를 1회 조회로 모두 반환한다")
    void findByTemCIn_returnsUsersOfAllTeams() {
        insertUser("TENO9001", TEAM_A, "팀장");
        insertUser("TENO9002", TEAM_A, "과장");
        insertUser("TENO9003", TEAM_B, "차장");
        CuserI deleted = insertUser("TENO9004", TEAM_A, "팀장");
        deleted.delete();
        em.flush();
        em.clear();

        List<CuserI> result = userRepository.findByTemCInAndDelYn(
                List.of(TEAM_A, TEAM_B, TEAM_EMPTY), "N");

        assertThat(result).extracting(CuserI::getEno)
                .containsExactlyInAnyOrder("TENO9001", "TENO9002", "TENO9003");
        assertThat(result).allSatisfy(u -> assertThat(u.getTemC()).isIn(TEAM_A, TEAM_B));
    }

    @Test
    @DisplayName("해당 팀 사용자가 없으면 빈 목록을 반환한다")
    void findByTemCIn_noUsers_returnsEmpty() {
        assertThat(userRepository.findByTemCInAndDelYn(List.of(TEAM_EMPTY), "N")).isEmpty();
    }
}
```

- [ ] **Step 2: 컴파일 실패 확인**

```bash
cd C:\it\it_backend
./gradlew integrationTest --tests "com.kdb.it.common.iam.repository.UserRepositoryTemCInIt" 2>&1 | tail -5
```

Expected: `cannot find symbol ... findByTemCInAndDelYn` 컴파일 오류

- [ ] **Step 3: 파생 쿼리 추가**

`UserRepository.java`의 `findByTemC` 선언 바로 아래에 추가:

```java
    /**
     * 팀코드(TEM_C) 목록으로 사용자 다건 조회 — 팀 대표자 선정용(배치 조회)
     *
     * <p>
     * 팀별 반복 조회로 인한 N+1 쿼리를 방지하기 위해 사용합니다.
     * 조직 정보는 불필요하므로 EntityGraph 없이 기본 조회합니다.
     * </p>
     *
     * @param temCs 조회할 팀코드 컬렉션
     * @param delYn 삭제여부 ({@code N}=활성 사용자)
     * @return 해당 팀들의 활성 사용자 목록
     */
    java.util.List<CuserI> findByTemCInAndDelYn(Collection<String> temCs, String delYn);
```

- [ ] **Step 4: 통합 테스트 통과 확인 (로컬 Oracle 기동 상태)**

```bash
cd C:\it\it_backend
./gradlew integrationTest --tests "com.kdb.it.common.iam.repository.UserRepositoryTemCInIt"
```

Expected: BUILD SUCCESSFUL, 2건 PASS (Oracle 미기동이면 SKIP — 반드시 기동 후 PASS 확인)

- [ ] **Step 5: Oracle 실행계획과 인덱스 근거 기록**

로컬 Oracle에서 다음 항목을 읽기 전용으로 확인해 Phase B 작업 기록에 남긴다.

1. `TPRMPP_CUSERI` 전체·활성 사용자 행 수
2. `ALL_INDEXES`·`ALL_IND_COLUMNS` 기준 기존 인덱스와 선두 컬럼
3. 대표 쿼리 `WHERE TEM_C IN ('12004','18001','18010','18501') AND DEL_YN='N'`의 `EXPLAIN PLAN` 및 `DBMS_XPLAN.DISPLAY` 결과
4. 기존 반복 조회 대비 SQL 호출 수 `4~5회 → 1회`

사용자 약 3,000명 수준에서 작은 테이블 전체 스캔이 선택되더라도 비용과 응답시간이 충분하면 인덱스를 추가하지 않고 그 근거를 기록한다. 실행계획 비용이나 실측 응답시간이 허용하기 어렵거나 명확한 성장 근거가 있으면 임의로 인덱스를 만들지 말고, `(TEM_C, DEL_YN)` 등 후보의 컬럼 순서·예상 선택도·쓰기 비용·정확한 Flyway 파일명을 제시한 뒤 사용자 승인을 받아 별도 마이그레이션으로 진행한다.

- [ ] **Step 6: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/iam/repository/UserRepository.java src/test/java/com/kdb/it/common/iam/repository/UserRepositoryTemCInIt.java
git commit -m "feat: 팀코드별 활성 사용자 배치 조회 추가 (BE-10)"
```

### Task 6: UserRepresentativeSelector 공용 유틸

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/iam/service/UserRepresentativeSelector.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/iam/service/UserRepresentativeSelectorTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.kdb.it.common.iam.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.iam.entity.CuserI;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** UserRepresentativeSelector 단위 테스트 — 팀 대표자 결정적 선택 규칙 (BE-10) */
class UserRepresentativeSelectorTest {

    private CuserI user(String eno, String ptCNm) {
        return CuserI.builder().eno(eno).ptCNm(ptCNm).build();
    }

    @Test
    @DisplayName("팀장이 있으면 입력 순서와 무관하게 팀장을 선택한다")
    void teamLead_preferred() {
        CuserI staff = user("E0001", "과장");
        CuserI lead = user("E0009", "팀장");
        assertThat(UserRepresentativeSelector.pick(List.of(staff, lead))).contains(lead);
    }

    @Test
    @DisplayName("팀장이 없으면 사번 오름차순 첫 번째를 선택한다")
    void noLead_lowestEno() {
        CuserI second = user("E0002", "과장");
        CuserI first = user("E0001", "차장");
        assertThat(UserRepresentativeSelector.pick(List.of(second, first))).contains(first);
    }

    @Test
    @DisplayName("팀장이 여러 명이면 팀장 중 사번 오름차순 첫 번째를 선택한다")
    void multipleLeads_lowestEnoAmongLeads() {
        CuserI leadB = user("E0005", "팀장");
        CuserI leadA = user("E0003", "팀장");
        CuserI staff = user("E0001", "과장");
        assertThat(UserRepresentativeSelector.pick(List.of(leadB, staff, leadA))).contains(leadA);
    }

    @Test
    @DisplayName("빈 목록이면 empty를 반환한다")
    void emptyList_returnsEmpty() {
        assertThat(UserRepresentativeSelector.pick(List.of())).isEmpty();
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.common.iam.service.UserRepresentativeSelectorTest"
```

Expected: 컴파일 오류 — `UserRepresentativeSelector` 미정의

- [ ] **Step 3: 구현**

```java
package com.kdb.it.common.iam.service;

import com.kdb.it.common.iam.entity.CuserI;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * 팀 사용자 목록에서 대표자를 결정적으로 선택하는 공용 유틸. (BE-10)
 *
 * <p>선택 규칙: ① 직위명({@code PT_C_NM}) '팀장' 우선 → ② 사번({@code ENO}) 오름차순.
 * 사전협의 검토자 선정({@code ReviewerService})과 협의회 당연위원 후보 선정
 * ({@code CommitteeService})이 공유합니다.</p>
 */
public final class UserRepresentativeSelector {

    /** 대표자로 우선 선택하는 직위명 */
    private static final String TEAM_LEAD_TITLE = "팀장";

    private UserRepresentativeSelector() {
    }

    /**
     * 대표자 1명을 결정적으로 선택합니다.
     *
     * @param users 같은 팀의 사용자 목록 (null 불가, 빈 목록 허용)
     * @return 대표자 (빈 목록이면 {@link Optional#empty()})
     */
    public static Optional<CuserI> pick(List<CuserI> users) {
        return users.stream()
                .min(Comparator.comparing((CuserI u) -> TEAM_LEAD_TITLE.equals(u.getPtCNm()) ? 0 : 1)
                        .thenComparing(CuserI::getEno,
                                Comparator.nullsLast(Comparator.naturalOrder())));
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.common.iam.service.UserRepresentativeSelectorTest"
```

Expected: BUILD SUCCESSFUL, 4건 PASS

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/iam/service/UserRepresentativeSelector.java src/test/java/com/kdb/it/common/iam/service/UserRepresentativeSelectorTest.java
git commit -m "feat: 팀 대표자 결정적 선택 공용 유틸 추가 (BE-10)"
```

### Task 7: 검토자 배치 조회 + 전역 API 계약 정규화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ReviewerService.java` (전체 교체)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ReviewerController.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ReviewerServiceTest.java` (전체 교체)
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/document/controller/ReviewerControllerTest.java`
- Modify: `it_frontend/app/stores/review.ts`
- Modify: `it_frontend/tests/unit/stores/review.direct.test.ts`

- [ ] **Step 1: 테스트 전체 재작성 (배치 스텁 기준)**

`ReviewerServiceTest.java` 전체를 다음으로 교체한다:

```java
package com.kdb.it.domain.budget.document.service;

import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.UserRepository;
import com.kdb.it.domain.budget.document.dto.ReviewerDto;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * ReviewerService 단위 테스트 — BE-10
 *
 * <p>검토자 목록: findByTemCInAndDelYn 1회 활성 사용자 배치 조회, 대표자 결정 규칙(팀장 우선→사번 오름차순),
 * 팀 표시 순서 고정을 검증한다.</p>
 */
@ExtendWith(MockitoExtension.class)
class ReviewerServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private ReviewerService reviewerService;

    private CuserI makeUser(String eno, String usrNm, String temC, String ptCNm) {
        return CuserI.builder()
                .eno(eno)
                .usrNm(usrNm)
                .temC(temC)
                .ptCNm(ptCNm)
                .build();
    }

    /** 실제 요청된 팀코드에 속한 활성 사용자만 반환하는 배치 조회 스텁. */
    private void stubUsersByRequestedTeam(CuserI... users) {
        given(userRepository.findByTemCInAndDelYn(anyCollection(), eq("N"))).willAnswer(inv -> {
            Collection<String> requestedTeamCodes = inv.getArgument(0);
            return Arrays.stream(users)
                    .filter(user -> requestedTeamCodes.contains(user.getTemC()))
                    .toList();
        });
    }

    @Test
    @DisplayName("getReviewers: 팀코드 전체의 활성 사용자를 1회로 배치 조회한다")
    void getReviewers_배치조회_1회() {
        stubUsersByRequestedTeam();

        reviewerService.getReviewers();

        verify(userRepository, times(1)).findByTemCInAndDelYn(
                eq(Set.of("12004", "18001", "18010", "18501")), eq("N"));
    }

    @Test
    @DisplayName("getReviewers: 팀장이 있으면 팀장을 검토자로 선택한다")
    void getReviewers_팀장우선() {
        stubUsersByRequestedTeam(
                makeUser("E002", "김과장", "18010", "과장"),
                makeUser("E009", "박팀장", "18010", "팀장"));

        List<ReviewerDto.Response> result = reviewerService.getReviewers();

        assertThat(result)
                .filteredOn(r -> "PMO팀".equals(r.getTeamName()))
                .extracting(ReviewerDto.Response::getEno)
                .containsExactly("E009");
    }

    @Test
    @DisplayName("getReviewers: 팀장이 없으면 사번 오름차순 첫 번째를 선택한다")
    void getReviewers_사번오름차순() {
        stubUsersByRequestedTeam(
                makeUser("E005", "이차장", "18010", "차장"),
                makeUser("E001", "정과장", "18010", "과장"));

        List<ReviewerDto.Response> result = reviewerService.getReviewers();

        assertThat(result)
                .filteredOn(r -> "PMO팀".equals(r.getTeamName()))
                .extracting(ReviewerDto.Response::getEno)
                .containsExactly("E001");
    }

    @Test
    @DisplayName("getReviewers: 사용자가 없는 팀은 결과에서 제외된다")
    void getReviewers_사용자없는팀_제외() {
        stubUsersByRequestedTeam();

        assertThat(reviewerService.getReviewers()).isEmpty();
    }

    @Test
    @DisplayName("getReviewers: 결과는 계약팀→기획팀→PMO팀→개발/운영팀 순서로 고정된다")
    void getReviewers_팀순서고정() {
        stubUsersByRequestedTeam(
                makeUser("E301", "개발A", "18501", "과장"),
                makeUser("E101", "기획A", "18001", "과장"),
                makeUser("E201", "PMOA", "18010", "과장"),
                makeUser("E001", "계약A", "12004", "과장"));

        List<ReviewerDto.Response> result = reviewerService.getReviewers();

        assertThat(result).extracting(ReviewerDto.Response::getTeamName)
                .containsExactly("계약팀", "기획팀", "PMO팀", "개발/운영팀");
    }
}
```

`ReviewerControllerTest.java`는 기존 인증·빈 배열·응답 구조 테스트의 주 요청 경로를 `/api/reviews/reviewers`로 바꾸고 `verify(reviewerService).getReviewers()`를 검증한다. 인증된 사용자가 구 경로 `/api/reviews/DOC-2026-0001/reviewers`를 호출해도 같은 응답과 `200`을 받는 한시 호환 계약 테스트를 추가한다.

`review.direct.test.ts`에는 `loadSession('DOC-001', ...)` 실행 후 다음을 검증하는 테스트를 추가한다.

```ts
expect(mockApiFetch).toHaveBeenCalledWith(
    'http://localhost:28080/api/reviews/reviewers',
);
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.document.service.ReviewerServiceTest" --tests "com.kdb.it.domain.budget.document.controller.ReviewerControllerTest"

cd C:\it\it_frontend
npm test -- tests/unit/stores/review.direct.test.ts
```

Expected: FAIL — 서비스는 아직 `findByTemC` 반복 조회·문서번호 인자를 사용하고, 신규 전역 경로가 없다.

- [ ] **Step 3: ReviewerService 전체 교체**

```java
package com.kdb.it.domain.budget.document.service;

import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.UserRepository;
import com.kdb.it.common.iam.service.UserRepresentativeSelector;
import com.kdb.it.domain.budget.document.dto.ReviewerDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 사전협의 검토자 서비스
 *
 * <p>검토 팀코드 전체를 1회 배치 조회한 뒤, 팀별 대표자(팀장 우선→사번 오름차순)를
 * 결정적으로 선택해 반환합니다. (BE-10)</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReviewerService {

    private final UserRepository userRepository;

    /** 검토 대상 팀코드 → 팀명 매핑 (응답 순서 고정을 위해 삽입 순서 보존) */
    private static final Map<String, String> REVIEW_TEAM_MAP;

    static {
        Map<String, String> teams = new LinkedHashMap<>();
        teams.put("12004", "계약팀");
        teams.put("18001", "기획팀");
        teams.put("18010", "PMO팀");
        teams.put("18501", "개발/운영팀");
        REVIEW_TEAM_MAP = Collections.unmodifiableMap(teams);
    }

    /**
     * 사전협의 공통 검토자 후보 목록을 반환합니다.
     *
     * <p>팀코드 전체의 활성 사용자를 {@code findByTemCInAndDelYn} 1회로 배치 조회(N+1 제거)하고,
     * 각 팀의 대표자는 {@link UserRepresentativeSelector}가 결정적으로 선택합니다.
     * 사용자가 없는 팀은 결과에서 제외합니다.</p>
     *
     * @return 팀별 검토자 DTO 목록 (계약팀→기획팀→PMO팀→개발/운영팀 순서)
     */
    public List<ReviewerDto.Response> getReviewers() {
        Map<String, List<CuserI>> usersByTeam = userRepository
                .findByTemCInAndDelYn(REVIEW_TEAM_MAP.keySet(), "N").stream()
                .collect(Collectors.groupingBy(CuserI::getTemC));

        List<ReviewerDto.Response> reviewers = new ArrayList<>();
        REVIEW_TEAM_MAP.forEach((temC, teamName) ->
                UserRepresentativeSelector.pick(usersByTeam.getOrDefault(temC, List.of()))
                        .map(user -> ReviewerDto.Response.from(user, teamName))
                        .ifPresent(reviewers::add));
        return reviewers;
    }
}
```

- [ ] **Step 4: 백엔드·프론트 API 계약 전환**

`ReviewerController.java`에 전역 경로를 주 계약으로 추가하고, 구 문서별 경로는 한 릴리스 동안 호환 별칭으로 유지한다. 클래스에 `@Slf4j`를 추가해 구 경로 호출을 제거 판단용 WARN 로그로 남긴다.

```java
    @Operation(summary = "검토자 목록 조회", description = "사전협의 공통 검토자 후보를 팀별로 반환합니다.")
    @GetMapping("/reviewers")
    public ResponseEntity<List<ReviewerDto.Response>> getReviewers() {
        return ResponseEntity.ok(reviewerService.getReviewers());
    }

    /**
     * 구 문서별 검토자 경로 호환용 엔드포인트.
     *
     * @param docMngNo 사용하지 않는 구 사전협의 관리번호
     * @return 전역 검토자 후보 목록
     * @deprecated 프론트 전환 확인 후 다음 릴리스에서 제거
     */
    @Deprecated(forRemoval = true)
    @GetMapping("/{docMngNo}/reviewers")
    public ResponseEntity<List<ReviewerDto.Response>> getReviewersLegacy(
            @PathVariable(name = "docMngNo") String docMngNo) {
        log.warn("폐기 예정 검토자 경로가 호출되었습니다 (docMngNo={})", docMngNo);
        return ResponseEntity.ok(reviewerService.getReviewers());
    }
```

`review.ts`의 검토자 요청 URL에서 문서번호 경로 세그먼트를 제거한다.

```ts
`${config.public.apiBase}/api/reviews/reviewers`
```

- [ ] **Step 5: 백엔드·프론트 대상 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.document.service.ReviewerServiceTest" --tests "com.kdb.it.domain.budget.document.controller.ReviewerControllerTest"

cd C:\it\it_frontend
npm test -- tests/unit/stores/review.direct.test.ts
```

Expected: 양쪽 PASS. 신규 전역 경로와 구 호환 경로는 인증 시 같은 `200` 응답을 반환하고, 프론트는 문서번호 없이 전역 경로를 호출한다.

- [ ] **Step 6: 저장소별 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/document/service/ReviewerService.java src/main/java/com/kdb/it/domain/budget/document/controller/ReviewerController.java src/test/java/com/kdb/it/domain/budget/document/service/ReviewerServiceTest.java src/test/java/com/kdb/it/domain/budget/document/controller/ReviewerControllerTest.java
git commit -m "refactor: 검토자 배치 조회와 전역 API 계약 정규화 (BE-10)"

cd C:\it\it_frontend
git add app/stores/review.ts tests/unit/stores/review.direct.test.ts
git commit -m "refactor: 전역 검토자 API 경로로 전환 (BE-10)"
```

### Task 8: CommitteeService.resolveTeamLeads 배치 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CommitteeService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java`

- [ ] **Step 1: 테스트 스텁 전환**

`CommitteeServiceTest.java`에 배치 스텁 헬퍼를 추가한다 (import: `static org.mockito.ArgumentMatchers.anyCollection`, `static org.mockito.ArgumentMatchers.eq`, `java.util.Arrays`, `java.util.Collection`):

```java
    /** findByTemCInAndDelYn 배치 스텁 — 요청된 팀코드에 속한 활성 사용자만 반환한다. */
    private void stubUsersByTeam(CuserI... users) {
        given(userRepository.findByTemCInAndDelYn(anyCollection(), eq("N"))).willAnswer(inv -> {
            Collection<String> temCs = inv.getArgument(0);
            return Arrays.stream(users)
                    .filter(u -> temCs.contains(u.getTemC()))
                    .toList();
        });
    }
```

그리고 `given(userRepository.findByTemC("..."))...` 스텁 블록을 사용하는 각 테스트에서 해당 블록 전체를 `stubUsersByTeam(...)` 한 줄로 교체한다. 예 — `getDefaultCommittee` INFO_SEC 테스트의:

```java
        given(userRepository.findByTemC("12004")).willReturn(List.of(u12004));
        given(userRepository.findByTemC("18010")).willReturn(List.of(u18010));
        given(userRepository.findByTemC("18501")).willReturn(List.of(u18501));
        given(userRepository.findByTemC("18301")).willReturn(List.of(u18301));
        given(userRepository.findByTemC("18001")).willReturn(List.of(u18001));
```

는 다음으로 교체:

```java
        stubUsersByTeam(u12004, u18010, u18501, u18301, u18001);
```

빈 팀을 표현하던 `willReturn(List.of())` 스텁은 해당 사용자를 `stubUsersByTeam` 인자에서 빼는 것으로 대체된다. `mockUser` 헬퍼가 `getTemC()`를 스텁하는지 확인하고, 없으면 `given(user.getTemC()).willReturn(temC);`를 헬퍼에 추가한다. 파일 내 `findByTemC(` 잔여 참조가 0건이 될 때까지 반복한다.

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.council.service.CommitteeServiceTest"
```

Expected: FAIL — 서비스가 아직 `findByTemC`를 호출하므로 활성 사용자 배치 스텁이 매칭되지 않아 위원 목록이 비어 어서션 실패

- [ ] **Step 3: resolveTeamLeads 교체**

`CommitteeService.java`에 import 추가: `com.kdb.it.common.iam.service.UserRepresentativeSelector`.

기존 `resolveTeamLeads` 전체(Javadoc 포함):

```java
    /**
     * 팀코드 목록별 대표 후보(팀장 우선, 없으면 첫 사용자)를 해석합니다.
     *
     * <p>팀원이 없는 팀은 결과에서 제외합니다. 반환 Map은 입력 팀코드 순서를 보존합니다(LinkedHashMap).</p>
     *
     * @param temCodes 후보를 뽑을 팀코드 목록
     * @return 팀코드 → 대표 후보(CuserI) 매핑 (순서 보존)
     */
    private Map<String, CuserI> resolveTeamLeads(List<String> temCodes) {
        Map<String, CuserI> leads = new LinkedHashMap<>();
        for (String temC : temCodes) {
            List<CuserI> users = userRepository.findByTemC(temC);
            if (users.isEmpty()) continue;
            CuserI candidate = users.stream()
                    .filter(u -> "팀장".equals(u.getPtCNm()))
                    .findFirst()
                    .orElse(users.get(0));
            leads.put(temC, candidate);
        }
        return leads;
    }
```

를 다음으로 교체:

```java
    /**
     * 팀코드 목록별 대표 후보(팀장 우선→사번 오름차순)를 해석합니다. (BE-10)
     *
     * <p>팀코드 전체의 활성 사용자를 {@code findByTemCInAndDelYn} 1회로 배치 조회(N+1 제거)하고, 팀별 대표자는
     * {@link UserRepresentativeSelector}가 결정적으로 선택합니다. 팀원이 없는 팀은
     * 결과에서 제외하며, 반환 Map은 입력 팀코드 순서를 보존합니다(LinkedHashMap).</p>
     *
     * @param temCodes 후보를 뽑을 팀코드 목록
     * @return 팀코드 → 대표 후보(CuserI) 매핑 (순서 보존)
     */
    private Map<String, CuserI> resolveTeamLeads(List<String> temCodes) {
        if (temCodes.isEmpty()) {
            return Map.of();
        }
        Map<String, List<CuserI>> usersByTeam = userRepository
                .findByTemCInAndDelYn(temCodes, "N").stream()
                .collect(Collectors.groupingBy(CuserI::getTemC));
        Map<String, CuserI> leads = new LinkedHashMap<>();
        for (String temC : temCodes) {
            UserRepresentativeSelector.pick(usersByTeam.getOrDefault(temC, List.of()))
                    .ifPresent(user -> leads.put(temC, user));
        }
        return leads;
    }
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.council.service.CommitteeServiceTest"
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/council/service/CommitteeService.java src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java
git commit -m "refactor: 협의회 위원 후보 조회를 배치+결정적 대표자 선택으로 전환 (BE-10)"
```

### Task 9: Cfilem NULL 허용 정책 통일

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/entity/Cfilem.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/ai/service/GeminiServiceTest.java`

- [ ] **Step 1: 3컬럼 nullable 완화 + Javadoc 정책 명시**

`Cfilem.java`에서 아래 세 곳을 각각 교체한다.

①:

```java
    /** 파일명: 사용자가 업로드한 실제 파일명 (예: 요구사항정의서_v1.0.pdf) */
    @Column(name = "FL_NM", nullable = false, length = 100, comment = "파일명")
```

→

```java
    /** 파일명: 사용자가 업로드한 실제 파일명 (예: 요구사항정의서_v1.0.pdf). DB는 NULL 허용(레거시)이며 업로드 플로우가 항상 값을 채운다. */
    @Column(name = "FL_NM", length = 100, comment = "파일명")
```

②:

```java
     */
    @Column(name = "FL_PYS_NM", nullable = false, length = 120, comment = "파일물리명")
```

→

```java
     * <p>DB는 NULL 허용(레거시)이며 업로드 플로우가 항상 값을 채운다.</p>
     */
    @Column(name = "FL_PYS_NM", length = 120, comment = "파일물리명")
```

③:

```java
    /** 파일저장경로: 서버 내 실제 저장 디렉토리 경로 (예: /data/files/요구사항정의서/2026/03) */
    @Column(name = "FL_KPN_PTH", nullable = false, length = 255, comment = "파일저장경로")
```

→

```java
    /** 파일저장경로: 서버 내 실제 저장 디렉토리 경로 (예: /data/files/요구사항정의서/2026/03). DB는 NULL 허용(레거시)이며 업로드 플로우가 항상 값을 채운다. */
    @Column(name = "FL_KPN_PTH", length = 255, comment = "파일저장경로")
```

- [ ] **Step 2: 실패하는 NULL 메타데이터 테스트 작성**

`FileServiceTest`에 다음 경로를 추가한다.

- `FL_KPN_PTH=null`이면 `downloadFile`이 `CustomGeneralException`을 던지고 메시지에 파일매핑ID와 `파일 메타데이터가 불완전`을 포함한다.
- `FL_PYS_NM=null` 또는 공백이어도 같은 업무 예외를 반환한다.
- `FL_NM=null`이고 물리파일명이 유효하면 물리파일명을 다운로드 파일명과 MIME 판정 폴백으로 사용한다. 기존 `downloadFile_원본파일명없음_서버파일명확장자사용` 테스트에 `originalFilename()`이 `server.png`인지 어서션한다.

`GeminiServiceTest`에 다음 경로를 추가한다.

- 저장경로 또는 물리파일명이 null/공백이면 예외 없이 `skippedFiles`에 포함되고, 사유에 파일매핑ID와 `파일 메타데이터 불완전`을 포함하며 `attachedFileCount=0`이다.
- 원본 파일명이 null이고 물리파일명에 지원 확장자가 있으면 물리파일명을 MIME 판정 폴백으로 사용해 정상 첨부한다.

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.infra.file.service.FileServiceTest" --tests "com.kdb.it.infra.ai.service.GeminiServiceTest"
```

Expected: FAIL — 다운로드는 `Paths.get(null)` 예외 또는 null 파일명 반환, Gemini 경로는 불완전 메타데이터 사유 없는 skip/예외

- [ ] **Step 3: FileService 다운로드 가드·파일명 폴백 구현**

`downloadFile`에서 경로를 조합하기 전에 저장경로와 물리파일명을 `StringUtils.hasText`로 검증한다. 둘 중 하나라도 비어 있으면 다음 업무 예외를 던진다.

```java
throw new CustomGeneralException(
        "파일 메타데이터가 불완전합니다. 파일매핑ID: " + flMpnId);
```

원본 파일명이 비어 있으면 물리파일명을 `originalFilename`으로 사용하고, MIME 판정과 `FileDownloadResult`에 같은 폴백 값을 전달한다.

- [ ] **Step 4: GeminiService 첨부 가드·파일명 폴백 구현**

`buildFilePartFromFlMngNo`에서 저장경로와 물리파일명을 경로 조합 전에 검증한다. 둘 중 하나라도 비어 있으면 `FilePartResult.skip("파일 메타데이터 불완전: " + flMpnId)`을 반환한다. 원본 파일명이 비어 있으면 물리파일명을 MIME 판정 입력으로 사용한다.

- [ ] **Step 5: 대상·전체 테스트 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.infra.file.service.FileServiceTest" --tests "com.kdb.it.infra.ai.service.GeminiServiceTest"
./gradlew test
```

Expected: BUILD SUCCESSFUL, NULL 메타데이터 실패·폴백 경로 PASS

- [ ] **Step 6: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/infra/file/entity/Cfilem.java src/main/java/com/kdb/it/infra/file/service/FileService.java src/main/java/com/kdb/it/infra/ai/service/GeminiService.java src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java src/test/java/com/kdb/it/infra/ai/service/GeminiServiceTest.java
git commit -m "fix: 파일 메타데이터 NULL 정책과 소비 경로를 일치 (BE-11)"
```

### Task 10: Phase B 검증·저장소별 병합

- [ ] **Step 1: 전체 테스트 (로컬 Oracle 기동 상태)**

```bash
cd C:\it\it_backend
./gradlew test integrationTest

cd C:\it\it_frontend
npm run check
npm test
```

Expected: 백엔드 BUILD SUCCESSFUL(integrationTest SKIP이 아닌 PASS인지 확인), 프론트 정적 검사·Vitest 전체 PASS.

추가 확인: Task 5에서 활성 사용자 배치 쿼리의 Oracle 실행계획, 기존 인덱스, 호출 수 감소 근거가 기록되어 있어야 한다. 인덱스 필요 판정이 나왔다면 승인된 마이그레이션 적용·재측정 전에는 Phase B를 완료 처리하지 않는다.

- [ ] **Step 2: 저장소별 main 병합**

```bash
cd C:\it\it_backend
git checkout main
git merge --no-ff feat/be10-be11-team-batch-and-cfilem -m "merge: BE-10 팀 조회 배치화 + BE-11 Cfilem NULL 정책 통일"

cd C:\it\it_frontend
git checkout main
git merge --no-ff feat/be10-global-reviewers-api -m "merge: BE-10 전역 검토자 API 경로 전환"
```

- [ ] **Step 3: 2단계 호환 배포 메모·스모크 기준 기록**

1차 릴리스는 백엔드를 먼저 배포해 구·신 경로가 모두 동작하는지 확인한 뒤 프론트를 신규 경로로 배포한다. 열린 구 CSR 번들과 부분 롤백도 계속 동작해야 한다. 다음 릴리스에서만 구 경로를 제거하며, 최소 한 릴리스 기간과 14일 동안 구 경로 WARN 로그가 0건인 것을 제거 조건으로 한다.

1. 인증 상태에서 `GET /api/reviews/reviewers`가 `200`과 검토자 배열을 반환한다.
2. 사전협의 검토 화면 진입 시 `REVIEWERS` 로드 경고가 발생하지 않는다.
3. 구 경로 `GET /api/reviews/{docMngNo}/reviewers`도 1차 릴리스에서는 같은 `200` 응답을 반환한다.
4. 프론트 전환 뒤 구 경로 WARN 로그를 14일 관찰하고, 0건이면 다음 릴리스 제거 과제를 실행한다.

---

## Phase C — BE-03 프로젝션 조사·구현 + BE-06 Javadoc 정리 (🟡/🟢)

### Task 11: Phase C 브랜치 생성

- [ ] **Step 1:**

```bash
cd C:\it\it_backend
git checkout main
git checkout -b chore/be03-be06-projection-javadoc
```

### Task 12: BE-03 전체 엔티티 로딩 후보 전수 조사 리포트

**Files:**
- Create: `C:\it\docs\superpowers\reports\2026-07-be03-projection-survey.md` (외부 저장소)

- [ ] **Step 1: 조회 방식별 후보 전수 수집**

it_backend에서 native query·JPQL·fetch join·EntityGraph·QueryDSL 엔티티 select·Spring Data 파생 엔티티 조회를 모두 수집한다:

```powershell
cd C:\it\it_backend
rg -n "nativeQuery\s*=\s*true|@Query|JOIN FETCH|join fetch|@EntityGraph|selectFrom\(" src/main/java -g "*.java"
rg -n "find(All|Top|First)?By|findBy|findAllBy" src/main/java -g "*Repository.java"
```

검색 결과는 Repository 메서드에서 끝내지 말고 `Repository 조회 → Service → 응답 DTO` 호출 경로를 따라 실제 읽기 전용 엔티티 로딩인지 확인한다. 다음 집행 4단계 서비스와 대응 Repository는 검색 결과와 무관하게 필수 점검한다.

- `ContractService` / 계약 조회
- `EstimateService` / 소요예산·발주 전 단계 조회
- `DeliberationService` / 과업심의·검수 전 단계 조회
- `PaymentService` / 정산·지급 조회

각 후보마다 반환 건수(단건/다건), 조회 방식, 엔티티 전체 컬럼 수, DTO 사용 컬럼 수, LOB·대형 문자열 포함 여부, 조인 폭, 예상 호출 빈도를 기록한다. Dirty Checking이 필요한 쓰기 경로는 제외하되 읽기 전용 상세 조회는 단건이라는 이유만으로 제외하지 않는다.

- [ ] **Step 2: 후보별 실행계획 실측**

각 후보 쿼리를 로컬 Oracle에서 실측한다:

```bash
sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1
```

```sql
EXPLAIN PLAN FOR <후보 SQL>;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY());
```

- [ ] **Step 3: 조사 리포트 작성**

`C:\it\docs\superpowers\reports\2026-07-be03-projection-survey.md`를 아래 구조로 작성한다 (표의 "(조사 결과 기입)" 행은 조사에서 발견한 실제 후보로 채우고, 후보가 없으면 "명백 후보 없음"을 명시한다):

```markdown
# BE-03 잔여 전체 엔티티 로딩 후보 조사 (2026-07)

## 판정 기준
- **명백(이번 구현)**: 읽기 전용 전체 엔티티 로딩이며 다음 중 하나 이상 — DTO 사용 컬럼이 절반 미만, 미사용 LOB·대형 컬럼 포함, 넓은 조인/행 폭이 실행계획 비용을 키움, 호출 빈도가 높은 상세 경로
- **경계선(후속 등록)**: 사용 컬럼 비율이 높고 LOB·넓은 조인이 없으며 호출 빈도·실행계획 비용도 낮은 경우 — 측정 근거와 함께 TASK.md 등록
- **제외**: 이미 프로젝션 적용됨 또는 Dirty Checking에 엔티티 로딩이 필요한 쓰기 경로

## 후보 목록
| # | 위치(클래스.메서드) | 조회 방식 | 반환 형태 | 사용/전체 컬럼 | LOB·조인 폭 | 호출 빈도 | 실행계획 요약 | 판정 |
| - | ------------------- | --------- | --------- | -------------- | ----------- | --------- | ------------- | ---- |
| 1 | (조사 결과 기입)    |           |           |                |             |           |               |      |

## 상세 근거
(후보별 EXPLAIN PLAN 출력 요약과 판정 사유)
```

- [ ] **Step 4: 외부 저장소에 리포트 커밋**

```bash
cd C:\it
git add docs/superpowers/reports/2026-07-be03-projection-survey.md
git commit -m "docs: BE-03 전체 엔티티 로딩 후보 조사 리포트"
```

- [x] **Step 5: Task 13 구체화·승인 체크포인트**

조사 리포트 커밋 후에는 프로젝션 구현을 시작하지 말고 실행을 멈춘다. 명백 후보마다 다음 내용을 실제 파일과 메서드 기준으로 이 계획의 Task 13에 반영한다.

- 수정·생성할 정확한 파일 목록과 각 파일의 책임
- 기존 엔티티 조회와 신규 프로젝션 조회의 쿼리·필터·정렬 동등성
- 적용할 구현 방식(Spring Data 인터페이스 프로젝션 또는 기존 QueryDSL DTO 프로젝션)과 선택 근거
- 실패하는 테스트의 파일명, 픽스처, 입력값, 기대 결과
- Oracle 실행계획 기준선과 구현 후 비교할 비용·카디널리티·접근 경로
- 서비스·DTO 호출부 변경 및 회귀 영향 범위

구체화한 Task 13을 사용자에게 제시해 승인을 받은 뒤에만 구현을 재개한다. 명백 후보가 0건이면 리포트에 근거를 기록하고 승인 체크포인트에서 Task 13 건너뛰기를 확정한다.

- [x] **Step 6: 승인된 Task 13 실행 계약 버전 관리**

사용자 승인 직후, 실제 파일·쿼리·테스트로 구체화된 이 계획 파일을 구현보다 먼저 외부 저장소에 커밋한다. 명백 후보가 0건이어도 건너뛰기 결정과 근거가 반영된 계획을 커밋한다.

```bash
cd C:\it
git add docs/superpowers/plans/2026-07-20-backend-task-remediation.md
git commit -m "docs: BE-03 프로젝션 실행 계약 승인 반영"
```

커밋 해시를 `2026-07-be03-projection-survey.md`의 승인 기록에 남긴 뒤 Task 13을 시작한다. 승인된 계획 커밋이 없으면 구현을 재개하지 않는다.

### Task 13: BE-03 승인된 안전 후보 프로젝션 분리

> **승인 상태:** 2026-07-21 사용자가 안전 범위 구현을 승인했다. 이 Task는 Task 12 Step 6의 계획 커밋 해시가 조사 리포트에 기록된 뒤에만 실행한다.
>
> **고정된 보류 결정:** #1 BITEMM GCL 대표행, #2 BBUGTM 대표행, #3 BPROJM 배치 이름, #4 BESTTM 물리 PK, #5 `orcTbMap/projectCategoryMap` namespace는 모두 기존 엔티티 동작을 유지한다. 보류 경로에만 필요한 `ProjectKeyView`도 이번에는 만들지 않는다.

#### 공통 구현 규칙

- 신규 조회는 읽기 응답 조립 전용이다. 인증, 존재 검증, 작성자·조직 snapshot, 생성·수정·삭제·상태 전이, 결재 mutation/sync, `BudgetWorkService.applyRates`는 기존 엔티티 조회를 유지한다.
- 단순 파생 조회는 Repository 내부 interface projection, 동적 predicate·JOIN·CASE·DISTINCT는 `*RepositoryCustom` + `*RepositoryImpl`의 scalar DTO/row projection을 사용한다.
- 기존 WHERE, null predicate, IN 범위, 정렬, page clamp, 대표 선택 순서를 그대로 보존한다. 성능을 이유로 임의 `ORDER BY`, `DISTINCT`, 추가 DB 조회를 넣지 않는다.
- 기존 엔티티 메서드는 쓰기·호환 호출부 때문에 삭제하지 않는다. generic만 다른 overload는 만들지 않고 `applyBudgetSummaryViews`, `pickView`처럼 별도 이름을 쓴다.
- 모든 신규 JavaDoc/주석은 한글로 쓰고 public/service 메서드는 입력값과 실패 조건을 기록한다.
- 각 묶음은 RED 테스트가 신규 API 부재 또는 기존 entity 호출 검증 때문에 실패함을 확인한 후 구현한다. Oracle IT fixture는 `AbstractOracleRepositoryTest`, `@Tag("it")`, 트랜잭션 rollback을 사용한다.

#### Step 1: 게시글 목록 #1

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/dto/BoardPostDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardPostRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardPostRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostService.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/board/repository/BoardPostListProjectionIt.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardPostServiceTest.java`

- [ ] **1.1 RED:** `BoardPostDto.ListRow` exact 14필드 `nacMngNo,blbMngNo,nacNm,nacInqNbr,nacUnqId,ancYn,sreYn,flApgYn,flNbr,nacGrpLev,sttYmd,endYmd,fstEnrUsid,fstEnrDtm`와 `Page<BoardPostDto.ListRow> searchPostRows(String blbMngNo, BoardPostDto.SearchCondition cond, boolean isAdmin)` 호출을 테스트에 먼저 작성한다.
- [ ] **1.2 fixture:** `today=LocalDate.now()`를 한 번 캡처한다. A=`alpha 공지/writer-a,ANC=Y,UNQ=300,GRP=2,SRE=Y`, B=`alpha 본문/writer-b,N,200,2,Y`, C=`alpha-author,N,200,1,Y`; D=`DEL=Y`, E=`SRE=N`, F=`STT_YMD=today.plusDays(1)`, G=`END_YMD=today.minusDays(1)`. `BLB-BE03, keyword=alpha, page=0, size=20, isAdmin=false` 결과는 A→C→B, total 3이고 D/E/F/G는 제외한다.
- [ ] **1.3 GREEN:** 기존 게시판/삭제/공개/시작·종료일/title·body·author/bbr predicate와 `ANC_YN DESC,NAC_UNQ_ID DESC,NAC_GRP_SQN ASC`, page≥0/size1~100, count query를 복사하고 select만 scalar row로 바꾼다. 기존 `searchPosts`는 유지하고 `BoardPostService.searchPosts`만 신규 메서드를 사용한다.
- [ ] **1.4 verify/commit:** `./gradlew test --tests '*BoardPostServiceTest' integrationTest --tests '*BoardPostListProjectionIt'`; commit `perf: 게시글 목록 조회 프로젝션 분리 (BE-03)`.

#### Step 2: 사용자·조직·팀 대표 #2~#9

**Core files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/dto/UserDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/OrganizationRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/service/UserRepresentativeSelector.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/service/UserService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/dto/ReviewerDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ReviewerService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CommitteeService.java`

**Read-response consumer files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminLogService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ReviewCommentService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/EvaluationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/ScheduleService.java`

**Tests:**
- Create: `it_backend/src/test/java/com/kdb/it/common/iam/repository/UserReadProjectionIt.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/iam/repository/OrganizationNameProjectionIt.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/iam/repository/CommitteeUserProjectionIt.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/iam/service/UserServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/iam/service/UserRepresentativeSelectorTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminLogServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardPostServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ReviewerServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ReviewCommentServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/plan/service/PlanServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/EvaluationServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/PlanEvaluationServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/ScheduleServiceTest.java`

- [ ] **2.1 RED row contracts:** `UserDto.ListRow` exact7 `eno,bbrC,bbrNm,temC,temNm,usrNm,ptCNm`; `DetailRow`은 그 7개와 `etrMilAddrNm,inleNo,cpnTpn,dtsDtlCone,prlmHrkOgzCCone,prlmHrkOgzCNm`이다. 상위코드는 조직 alias `o.prlmHrkOgzCCone`, 상위명은 `p.bbrNm`이다.
- [ ] **2.2 RED view contracts:** `UserNameView(eno,usrNm)`, `UserOrgCodeView(eno,temC,bbrC)`, `AdminUserView(eno,usrNm,ptCNm,temC,temNm,bbrC,etrMilAddrNm,inleNo,cpnTpn,fstEnrDtm,lstChgDtm)`와 `findNameViewsByEnoIn(Collection<String>)`, `findNameViewByEno(String)`, `findOrgCodeViewsByEnoIn(Collection<String>)`, `findAdminUserViewsByDelYn(String)`를 추가한다. Custom signature는 `findListRowsByBbrC`, `searchListRowsByName`, `findDetailRowByEno`로 고정한다.
- [ ] **2.3 RED team contract:** `CommitteeUserRow` exact5 getter `temC,eno,usrNm,bbrNm,ptCNm`; `UserRepository.java`에 다음 명시 JPQL과 signature를 테스트한다.

```java
@Query("SELECT u.temC AS temC, u.eno AS eno, u.usrNm AS usrNm, o.bbrNm AS bbrNm, u.ptCNm AS ptCNm "
        + "FROM CuserI u LEFT JOIN CorgnI o ON o.prlmOgzCCone = u.bbrC "
        + "WHERE u.temC IN :temCs AND u.delYn = :delYn")
List<CommitteeUserRow> findCommitteeUserRowsByTemCInAndDelYn(
        @Param("temCs") Collection<String> temCs, @Param("delYn") String delYn);
```

- [ ] **2.4 RED organization/selector:** `OrganizationNameView(prlmOgzCCone,bbrNm)`, `findNameViewsByPrlmOgzCConeIn`, `findNameViewByPrlmOgzCCone`; `public static Optional<UserRepository.CommitteeUserRow> pickView(List<UserRepository.CommitteeUserRow> users)`. 선택은 팀장 우선→ENO ASC이며 기존 `pick(List<CuserI>)`는 유지한다.
- [ ] **2.5 fixture:** 조직 `120/디지털부`; 사용자 `BE03001/홍길동/팀장/BBR=120/TEM=12004/N`, `BE03002/김길동/사원/120/12004/Y`, `BE03003/null조직`; team 18010은 `BE03010/팀원`, `BE03011/팀장`. 부서·이름 검색은 현행대로 DEL filter/order가 없어 deleted BE03002도 포함한다. team bind `(12004,18001,18010,18501),DEL=N`에서 12004 `bbrNm=디지털부`, 대표 BE03001, 18010 대표 BE03011을 검증한다.
- [ ] **2.6 GREEN consumers:** `ReviewerService.getReviewers`와 `CommitteeService.resolveTeamLeads`는 `CommitteeUserRow::getTemC` grouping + `pickView`; `ReviewerDto.Response.fromView(CommitteeUserRow,String)` 및 Committee row factory를 사용한다. 나머지는 이름/조직 read-response map만 view로 바꾼다. `AuthorOrgResolver`, `AuthService`, `CustomUserDetailsService`, Board 멘션 존재검증과 생성·수정 snapshot은 바꾸지 않는다.
- [ ] **2.7 verify/commit:** `./gradlew test --tests '*UserServiceTest' --tests '*UserRepresentativeSelectorTest' --tests '*ReviewerServiceTest' --tests '*CommitteeServiceTest' integrationTest --tests '*UserReadProjectionIt' --tests '*OrganizationNameProjectionIt' --tests '*CommitteeUserProjectionIt'`; 이어 영향받은 consumer 테스트를 실행한다. commit `perf: 사용자 조직 응답 조회 프로젝션 분리 (BE-03)`.

#### Step 3: 계획·BITEMM ABUS·사업 단건 이름·BCOSTM #10,#12~#14

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/repository/BplanmRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/dto/PlanDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectItemRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostRepresentativeSelector.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/plan/repository/PlanListProjectionIt.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/project/repository/ProjectItemBudgetProjectionIt.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/project/repository/ProjectReferenceProjectionIt.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostRepresentativeSelectorViewTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/plan/service/PlanServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceBatchTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java`

- [ ] **3.1 RED Plan:** `PlanListView` exact9 `reqDocNo,itPtlPlnTpC,bseYy,aduTotAmt,cpitBgApvAmt,totXpAmt,fstEnrDtm,fstEnrUsid,redtConeInf`; `findListViewsByDelYnOrderByFstEnrDtmDesc(String)`. JSON은 `{"prjSnapshots":[{"id":1,"pulDtt":"001"},{"id":2,"pulDtt":"002"},{"id":3,"pulDtt":"001"}]}`이고 normalize 001→10/002→20 뒤 `CodeService.findCodeEntitiesByCId(ABUS)` mock `10→신규,20→계속`; `itPrjCnt=3,newPrjCnt=2,contPrjCnt=1`을 검증한다.
- [ ] **3.2 RED BITEMM:** `ProjectItemBudgetView` exact5 `gclMngNo,abusMngNo,ioeC,amt,mplAmt`; 신규 메서드는 `findBudgetViewsByAbusMngNoInAndDelYn(Collection<String>,String)` 하나다. `ProjectBudgetSummaryService.applyBudgetSummaryViews(ProjectDto.Response,List<ProjectItemBudgetView>)`를 추가하고 기존 entity 메서드는 유지한다. Project/Council의 ABUS 전체행 sum/grouping만 전환한다.
- [ ] **3.3 RED Project/Cost:** `ProjectNameView(abusMngNo,abusNm)`와 `findNameViewByAbusMngNoAndLstYnAndDelYn`은 `EstimateService.get`의 사업명 단건에만 쓴다. `CostRepresentativeView(costBgNo,bgSno,lstYn,cttNm)`, `findRepresentativeViewsByCostBgNoInAndDelYn`, `CostRepresentativeSelector.pickView(List<CostRepresentativeView>)`를 추가한다. Cost fixture `BG-DUP:SNO1/LST=N/구버전,SNO2/LST=Y/최신` 결과는 최신이다. `BudgetWorkService.getProjectSummary`에서는 BCOSTM 조회·selector만 view로 전환하고 기존 문자열 namespace map과 put-if-absent 동작은 그대로 둔다.
- [ ] **3.4 blocked assertions:** `BbugtmRepository`에는 view를 만들지 않는다. `getIoeCategories/getSummary/getProjectSummary` 각각 `findByBseYyAndDelYn` entity exactly1/view0이다. GCL BITEMM, BPROJM batch name, `ProjectKeyView`, namespace map은 신규 조회·정렬 없이 기존 동작을 유지한다. `BudgetWorkServiceTest`/`BudgetWorkServiceBatchTest`는 BCOST view 전환만 허용하고 BBUG/BITEM GCL/BPROJM entity repository 호출 횟수와 결과를 보존하는 회귀 어서션을 추가한다.
- [ ] **3.5 verify/commit:** `./gradlew test --tests '*PlanServiceTest' --tests '*ProjectBudgetSummaryServiceTest' --tests '*BudgetWorkServiceTest' --tests '*BudgetWorkServiceBatchTest' --tests '*CouncilServiceTest' --tests '*EstimateServiceTest' --tests '*CostRepresentativeSelectorViewTest' integrationTest --tests '*PlanListProjectionIt' --tests '*ProjectItemBudgetProjectionIt' --tests '*ProjectReferenceProjectionIt'`; commit `perf: 계획과 안전 예산 응답 조회 프로젝션 분리 (BE-03)`.

#### Step 4: 집행 상세 Contract·Deliberation·Payment와 Payment line #16,#22,#23,#25

**Contract files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/contract/repository/ContractDetailRow.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/repository/ContractRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/repository/ContractRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/dto/ContractDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/service/ContractService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/contract/service/ContractServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/contract/repository/ContractDetailProjectionIt.java`

**Deliberation files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/deliberation/repository/DeliberationDetailRow.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/repository/DeliberationRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/repository/DeliberationRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/dto/DeliberationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/service/DeliberationService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/deliberation/service/DeliberationServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/deliberation/repository/DeliberationDetailProjectionIt.java`

**Payment files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/payment/repository/PaymentDetailRow.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/repository/PaymentRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/repository/PaymentRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/repository/PaymentLineRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/dto/PaymentDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/service/PaymentService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/payment/service/PaymentServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/payment/repository/PaymentDetailProjectionIt.java`

- [ ] **4.1 RED Contract:** `ContractDetailRow` exact15 `docMngNo,docVrsSno,ioeC,cncdRfrNo,tgtNm,stsTc,reqCone,itPtlCttManrC,cttManrRsn,cttNm,cttAmt,cttOppNm,cttDt,reqUsid,reqDtm`; `Optional<ContractDetailRow> findCurrentDetail(String docNo)`; `ContractDto.Detail.fromProjection(ContractDetailRow)`.
- [ ] **4.2 RED Deliberation:** `DeliberationDetailRow` exact17 `docMngNo,docVrsSno,ioeC,cncdRfrNo,tgtNm,stsTc,reqCone,taskDbrTc,taskDbrRltTc,taskDbrDt,taskDbrTod,taskDbrOmtYn,taskDbrOmtRsn,opnnCone,apvTrdnRsnCone,reqUsid,reqDtm`; 같은 `findCurrentDetail`; `DeliberationDto.Detail.fromProjection`.
- [ ] **4.3 RED Payment:** `PaymentDetailRow` exact11 `docMngNo,docVrsSno,ioeC,cncdRfrNo,tgtNm,stsTc,reqCone,cttNm,cttAmt,reqUsid,reqDtm`; 같은 `findCurrentDetail`; `PaymentDto.Detail.fromProjection(PaymentDetailRow,List<PaymentDto.Line>)`. `PaymentLineView(dfrTod,dfrAmt,dfrDt,dfrMplDt,opnnCone)`와 `findLineViewsByDocMngNoAndDocVrsSnoAndDelYn`을 추가한다.
- [ ] **4.4 fixture/equivalence:** 각 master에 `V100 LST=N DEL=N`, `V101 LST=Y DEL=N`, `V200 LST=Y DEL=Y`; 결과는 최대버전이 아니라 플래그 일치 V101이다. 기존 `DOC_MNG_NO`, 최신·미삭제 BPROJM/BCOSTM LEFT JOIN, IOE CASE, DISTINCT, 무정렬을 보존한다. Contract 요청300/사유1000, Deliberation `opnnCone`1000, Payment master 요청300/line 의견1000을 검증한다.
- [ ] **4.5 GREEN:** 각 Impl은 QueryDSL scalar constructor를 사용하며 기존 `findCurrentWithTargetName`을 유지한다. 각 Service `get`만 row factory로 전환한다. `EstimateLineRepository`와 `EstimateDto`는 물리 PK 결정 전 수정하지 않는다.
- [ ] **4.6 verify/commit:** `./gradlew test --tests '*ContractServiceTest' --tests '*DeliberationServiceTest' --tests '*PaymentServiceTest' integrationTest --tests '*ContractDetailProjectionIt' --tests '*DeliberationDetailProjectionIt' --tests '*PaymentDetailProjectionIt'`; commit `perf: 집행 상세 조회 프로젝션 분리 (BE-03)`.

#### Step 5: 결재 응답 조립 #17~#19

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationInfoDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/repository/ApplicationMapRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/repository/ApplicationRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/repository/ApproverRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/repository/ApplicationReadProjectionIt.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`

- [ ] **5.1 RED contracts:** `ApplicationMapView(apfDcmNo,pkColNm,fntTbCrySno)`; `findViewsByFntTbNmAndPkColNmAndFntTbCrySnoOrderByApfDcmNoDesc(String,String,Integer)`와 `findViewsByFntTbNmAndPkColNmInOrderByApfDcmNoDesc(String,List<String>)`. `ApplicationSummaryView(apfMngNo,itPtlApfPrgStsC,dcdReqTtl,dcdReqUsid,dcdReqDtm,rgprDcdReqCone)`와 `findSummaryViewsByApfMngNoIn(Collection<String>)`. `ApproverReadView(dcdMngNo,dcrSqnSno,dcrEno,itPtlDcdStsC,dcdDtm,dcrOpnnCone,lstDcdYn)`와 single/IN `findReadViews...OrderByDcrSqnSnoAsc`; DEL filter는 추가하지 않는다. `ApplicationDto.Response`와 `ApplicationInfoDto`에는 view 전용 factory를 별도 이름으로 추가해 기존 `fromEntities`를 유지한다.
- [ ] **5.2 CAPPLA fixture:** Project A `(APF-2026-00000001,A,SNO1),(00000003,A,SNO2)`, B `(00000002,B,SNO7)`; detail A/SNO2→00000003, batch A→00000003/B→00000002. Cost BG-A `(00000004,SNO1),(00000006,SNO1),(00000005,SNO2)`; PK+SNO 결과 SNO1→00000006,SNO2→00000005. `CAPPLA.apfDcmNo=CAPPLM.apfMngNo` literal을 보장한다.
- [ ] **5.3 GREEN four consumers:** Project/Cost detail은 table+PK+SNO 공통 SQL shape, Project batch는 table+PK IN 후 PK별 최신, Cost batch는 같은 SQL 후 PK+SNO별 최신이다. `ProjectService.setApplicationInfo`, `ProjectService.enrichProjectListBatch`, `CostService.setApplicationInfo`, `CostService.enrichCostListBatch` 네 곳을 모두 바꾼다. response assembly만 바꾸고 결재 생성·수정·회수·동기화는 entity를 유지한다.
- [ ] **5.4 verify/commit:** `./gradlew test --tests '*ApplicationServiceTest' --tests '*ProjectServiceTest' --tests '*CostServiceTest' integrationTest --tests '*ApplicationReadProjectionIt'`; commit `perf: 결재 응답 조회 프로젝션 분리 (BE-03)`.

#### Step 6: 관리자 파일·토큰·로그인 이력 #20,#21,#30

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/repository/FileRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/repository/RefreshTokenRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/repository/LoginHistoryRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/admin/repository/AdminListProjectionIt.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/admin/repository/LoginHistoryProjectionIt.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminServiceTest.java`

- [ ] **6.1 RED contracts:** `AdminFileView(flMpnId,flNm,flTpCone,pkColNm,fstEnrDtm,fstEnrUsid)` + `findAdminFileViewsByDelYn(String)`; `AdminTokenView(eno,endDtm,ecyRnwPubTokCone,fstEnrDtm)` + 유효한 Spring Data `findAllProjectedBy()`; `LoginHistoryView(eno,lgnDtm,itPtlLgnTc,ipAddr,lgnErrRsn,agtVrsCone,fstEnrDtm)` + `Page<LoginHistoryView> findPageViewsByOrderByLgnDtmDesc(Pageable)`. 기존 filter/order를 늘리지 않는다.
- [ ] **6.2 token fixture:** ECY `null→null`, 20자 `12345678901234567890→동일`, 21자 `123456789012345678901→12345678901234567890...`, 64자 `abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789→abcdef0123456789abcd...`; 미사용 API token sentinel `API-TOKEN-SENTINEL-BE03`는 view getter에 없어야 한다.
- [ ] **6.3 login fixture:** page rows `(KNOWN,UNKNOWN,null)` 결과는 `(사용자명,ENO 원문,null)`이고 `findNameViewsByEnoIn` exactly1, `findNameViewByEno` 0회다. page 정렬은 `LGN_DTM DESC` 그대로 둔다.
- [ ] **6.4 verify/commit:** `./gradlew test --tests '*AdminServiceTest' integrationTest --tests '*AdminListProjectionIt' --tests '*LoginHistoryProjectionIt'`; commit `perf: 관리자 목록 조회 프로젝션 분리 (BE-03)`.

#### Step 7: 요구사항 문서 버전 이력 #35

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/repository/ServiceRequestDocRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/dto/ServiceRequestDocDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocService.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/document/repository/ServiceRequestDocVersionProjectionIt.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ServiceRequestDocServiceTest.java`

- [ ] **7.1 RED:** `VersionHistoryView(docMngNo,docVrsSno,fstEnrDtm,lstChgDtm,delYn)`와 `findAllProjectedByDocMngNoAndDelYnOrderByDocVrsSnoDesc`; `ServiceRequestDocDto.VersionResponse.fromValues(...)`를 먼저 사용한다.
- [ ] **7.2 fixture:** `DOC-BE03-0001`의 stored 100=`2026-07-21T09:00/09:05`, 101=`10:00/10:05`, 200=`11:00/11:05`는 DEL=N, 300=`12:00/12:05`는 DEL=Y, 미사용 CLOB 12K. 결과는 `(2.00,11:00,11:05),(1.01,10:00,10:05),(1.00,09:00,09:05)`이고 `DocVersionCodec.toDisplay`를 재사용한다.
- [ ] **7.3 verify/commit:** `./gradlew test --tests '*ServiceRequestDocServiceTest' integrationTest --tests '*ServiceRequestDocVersionProjectionIt'`; commit `perf: 요구사항 버전 이력 조회 프로젝션 분리 (BE-03)`.

#### Step 8: Oracle 전후 행렬 검증

비밀번호는 환경변수/로컬 비공개 설정에서만 읽고 명령·로그·문서에 출력하지 않는다. 같은 literal, `CURRENT_SCHEMA=ITPOWN`, `DBMS_XPLAN.DISPLAY(...,'BASIC +ROWS +BYTES +COST +PREDICATE')`로 기존 SQL과 projection SQL을 연속 측정한다. 통계가 비어 있으므로 Rows/Bytes는 추정치이며 hash·cardinality·access·sort/distinct 동등성을 우선 검증한다.

| 신규 method | bind | 기대 전→후 `(hash; Rows/Bytes/Cost; access; sort/distinct)` |
| ----------- | ---- | ---------------------------------------------------------- |
| Board `searchPostRows` | BLB-BE03,DEL=N,page0/20 | `3214418861`; 20/58,020/5→20/15,800/5; FULL+WINDOW; 기존 3-key/no distinct |
| User 부서 row | BBR=120,no DEL/order | `1479025259`; 3/5,601/3→3/1,005/3; `IX_TPRMPP_CUSERI_01` RANGE+HASH OUTER+`PK_CORGNI` UNIQUE; none/none |
| User 이름 row | contains 길,no DEL/order | `2075770119` 1/1,570/4 FULL→`862519252` 1/335/5 HASH OUTER; none/none |
| User 상세 row | ENO=BE03001 | `710862926`; 1/2,164/3→1/1,649/3; PK UNIQUE+NL OUTER2; none/none |
| User name IN / org-code IN / name single | ENO 001,002 / 001 | `4258768852` 1/1,570/3→70 또는25/3 PK IN; `1767995418` 1/1,570/1→70/1 PK UNIQUE |
| Admin users / team rows | DEL=N / TEM 4개,DEL=N | `2075770119` 25/39,250/4→10,175/4 FULL; team `2075770119` 13/20,410/4→`3422623319` 13/3,705/7 HASH OUTER |
| Org name IN / single | code 12004,P000 / 12004 | `3974003270` 1/297/2→104/2 PK IN; `2808597226` 1/297/1→104/1 PK UNIQUE |
| Plan list | DEL=N,FST DESC | `2291581576`; 3/17,103/4→3/6,417/4; FULL; ORDER BY/none |
| BITEM ABUS all rows | ABUS A,B,DEL=N | `646722203`; 1/1,576/1→1/140/1; `IX_TPRMPP_BITEMM_01` RANGE IN/ROWID; none/none |
| ProjectName single | ABUS=A,LST=Y,DEL=N | `537617361`; 1/31,545/1→1/270/1; PK RANGE; none/none |
| Cost representative | BG A,B,DEL=N | `2009769883`; 1/1,758/3→1/255/3; PK RANGE IN/ROWID; none/none |
| Payment line | DOC=PAY-BE03,V=101,DEL=N | `2244852779`; 1/12,292/1→1/12,123/1; PK RANGE/ROWID; none/none |
| Contract / Deliberation / Payment detail | 각 DOC,LST=Y,DEL=N | `492949432` 1/3,873→3,743/10; `2727222238` 1/14,476→14,346/10; `3295666622` 1/1,645→1,515/10; NL OUTER2+HASH UNIQUE; distinct/no sort |
| CAPPLA detail / Project batch / Cost batch | BPROJM·BCOSTM literals | 모두 `2583179400`; 1/8,196/1→1/8,111/1; `IX_TPRMPP_CAPPLA_01` FULL DESC; APF DESC/no distinct |
| CAPPLM summary IN | APF ...03,...02 | `230381884`; 1/2,866/1→1/789/1; PK IN; none/none |
| CDECIM read IN / single | DCD IN / APF ...03 | `3468833582` 1/1,157/3→1,082/3 PK IN+SORT; `568951246` 1/1,157/1→1,082/1 PK RANGE; DCR ASC/no distinct |
| Admin file / token | DEL=N / all | `1178941135` 61/267,851/4→57/122,322/4 FULL; `867877563` 14/85,708/4→25,732/4 FULL |
| Login page | page0/20,LGN DESC | `190441828`; root20/15,840/294→12,300/232, table1,701/1.294M→1.000M; FULL+WINDOW; LGN DESC/none |
| Brdocm version | DOC-BE03-0001,DEL=N,VRS DESC | `2391463171`; 1/3,815/0→1/75/0; `IX_TPRMPP_BRDOCM_01` RANGE DESC; VRS DESC/none |

- [ ] **8.1 blocked matrix:** BBUG exact5는 측정 근거 `1120597652,35/294,910/6→290,430/6`만 유지하고 신규 method가 없어야 한다. BITEM GCL `1982961735`, BPROJM batch `2947393899`, BESTTM `2054273392`, ProjectKey/namespace는 after SQL·추가 sort·추가 조회가 없어야 한다.
- [ ] **8.2 residue:** 모든 `BE03_%`/`T12_%` statement_id를 rollback/delete 후 `SELECT COUNT(*) FROM PLAN_TABLE WHERE STATEMENT_ID LIKE 'BE03%' OR STATEMENT_ID LIKE 'T12_%'`가 0인지 확인한다. DDL/DML/index 변경은 금지한다.

#### Step 9: 전체 회귀·완료 게이트

- [ ] **9.1 unit:** `cd C:\it\it_backend && ./gradlew clean test`.
- [ ] **9.2 Oracle IT:** `./gradlew integrationTest`.
- [ ] **9.3 source audit:** 신규 view/row가 exact 필드만 노출하는지, 차단된 다섯 정책 경로와 쓰기/인증 경로에 신규 projection 호출이 없는지 `rg`와 mock verify로 확인한다.
- [ ] **9.4 worktree:** 백엔드 변경 파일만 후보별 커밋에 포함하고 외부 저장소 문서나 무관한 사용자 변경을 stage하지 않는다.
- [ ] **9.5 경계선:** Task 12의 경계선 9개(#24,#26~#29,#31~#34)는 구현하지 않고 Task 17의 `TASK.md` 등록 대상으로 유지한다.

### Task 14: BE-06 Javadoc 경고 전수 측정 설정

**Files:**
- Modify: `it_backend/build.gradle`

- [ ] **Step 1: 경고 출력 상한 해제**

`build.gradle`의:

```groovy
tasks.withType(Javadoc) {
	options.encoding = 'UTF-8'
}
```

를 다음으로 교체:

```groovy
tasks.withType(Javadoc) {
	options.encoding = 'UTF-8'
	// BE-06: javadoc 기본 경고 출력 상한(100건)을 해제해 전수 측정을 가능하게 한다.
	options.addStringOption('Xmaxwarns', '10000')
}
```

- [ ] **Step 2: 기준선 측정**

```powershell
cd C:\it\it_backend
New-Item -ItemType Directory -Force build/reports | Out-Null
./gradlew javadoc --rerun-tasks 2>&1 | Tee-Object -FilePath build/reports/javadoc-warnings-baseline.log
(Select-String -Path build/reports/javadoc-warnings-baseline.log -Pattern ': warning').Count
```

Expected: Gradle 출력에 `UP-TO-DATE`가 아닌 실제 Javadoc 실행이 보이고 기준선 총량이 출력된다(직전 측정 985건은 참고값). 원본 로그는 ignored `build/reports/javadoc-warnings-baseline.log`에 보존하고 수치를 기록한다.

- [ ] **Step 3: 커밋**

```bash
cd C:\it\it_backend
git add build.gradle
git commit -m "chore: javadoc 경고 전수 측정을 위한 출력 상한 해제 (BE-06)"
```

### Task 15: BE-06 상위 오염원 주석 보강

**Files:**
- Modify: `src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java` (63건)
- Modify: `src/main/java/com/kdb/it/domain/contract/controller/ContractController.java` (18건)
- Modify: `src/main/java/com/kdb/it/domain/council/dto/CouncilProjectRow.java` (17건)
- Modify: `src/main/java/com/kdb/it/infra/eai/dto/UmsPayload.java` (16건)
- Modify: `src/main/java/com/kdb/it/domain/budget/cost/entity/Btermm.java` (16건)

(`ApplicationDto`의 default constructor 경고 18건은 Task 16에서 처리)

- [ ] **Step 1: 파일별 경고 목록 추출**

```powershell
cd C:\it\it_backend
./gradlew javadoc --rerun-tasks 2>&1 | Tee-Object -FilePath build/reports/javadoc-warnings-current.log
Select-String -Path build/reports/javadoc-warnings-current.log -Pattern 'Bprojm.java'
```

(파일명을 바꿔가며 5개 파일 각각 실행)

- [ ] **Step 2: 파일별 누락 주석 보강**

한글 주석 원칙(`CLAUDE.md` §9, `docs/guides/conventions/comment-style.md`)을 따라 보강한다.

- 엔티티 필드 누락: 메타용어사전(`C:\it\meta\meta.txt`)의 용어로 한 줄 주석 — 예: `/** 사업시작일자 */`
- 컨트롤러 메서드 누락: `@param`(입력값)·`@return`(반환값)·실패 조건 포함 — 예:

```java
    /**
     * 계약 상세 조회
     *
     * @param ctrMngNo 계약관리번호
     * @return 계약 상세 응답
     * @throws IllegalArgumentException 해당 계약이 없는 경우
     */
```

- getter/setter 등 트리비얼 멤버가 경고 대상이면 소속 클래스·필드 주석으로 해소되는지 먼저 확인하고, 설명 가치가 없는 단순 대입 메서드에는 주석을 강제로 만들지 않는다(경고가 남으면 잔여 허용분으로 분류).
- Task 14에서 측정한 최신 기준선을 바탕으로 파일별 `기준 건수 / 해소 건수 / 허용 잔여 건수 / 허용 사유` 표를 작성한다. 분류되지 않은 잔여 경고는 허용하지 않는다.

- [ ] **Step 3: 파일별 경고 확인 후 개별 커밋**

```powershell
cd C:\it\it_backend
./gradlew javadoc --rerun-tasks 2>&1 | Tee-Object -FilePath build/reports/javadoc-warnings-current.log
(Select-String -Path build/reports/javadoc-warnings-current.log -Pattern 'Bprojm.java.*: warning').Count
```

Expected: 해당 파일에서 새로 발생한 미분류 경고 0건. 남는 경고는 모두 기준선 표에 허용 사유가 기록되어 있고, 수정 대상 경고는 해소되었음을 확인한다. 과거 조사 시점의 절대 건수나 파일별 0건을 완료 조건으로 사용하지 않는다.

```bash
git add src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java
git commit -m "docs: Bprojm Javadoc 누락 주석 보강 (BE-06)"
```

(나머지 4개 파일도 같은 방식으로 개별 커밋: `ContractController`, `CouncilProjectRow`, `UmsPayload`, `Btermm`)

### Task 16: BE-06 Lombok 기본 생성자 경고 정책 적용

**Files:**
- Modify: `src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java`
- Modify: `it_backend/CLAUDE.md`

- [ ] **Step 1: ApplicationDto 경고 클래스를 역할별로 분류**

`./gradlew javadoc --rerun-tasks 2>&1 | Tee-Object -FilePath build/reports/javadoc-warnings-current.log`를 실행한 뒤 `Select-String -Path build/reports/javadoc-warnings-current.log -Pattern 'ApplicationDto.java'`로 default constructor 경고가 발생하는 중첩 클래스를 확인하고 다음 기준으로 표를 만든다.

| 역할 | 판정 기준 | 처리 |
| ---- | --------- | ---- |
| 요청·입력 DTO | Controller 요청 본문 등 Jackson 역직렬화 대상 | `@NoArgsConstructor`를 제거하고 Javadoc을 단 명시적 public no-arg 생성자로 전환 |
| builder 전용 응답 DTO | 서비스가 `builder()`로 만들고 JSON 직렬화만 수행 | 생성자 변경 없음. `@Builder`가 기대하는 전체 필드 생성자를 보존 |
| 양방향 DTO | 역직렬화와 builder 생성이 모두 실제 호출됨 | 이번 기계적 전환에서 제외하고 호출 근거와 후속 생성자 설계를 기록 |

`@Builder`가 붙은 클래스에 명시적 no-arg 생성자만 추가하면 Lombok이 builder용 전체 필드 생성자를 더 이상 만들지 않아 컴파일이 깨질 수 있으므로 금지한다.

- [ ] **Step 2: 요청·입력 DTO만 명시적 생성자로 전환**

분류 결과 요청·입력 DTO에 해당하는 클래스만 다음과 같이 전환한다.

```java
        /** 기본 생성자 — Jackson 역직렬화용. */
        public CreateRequest() {
        }
```

`@NoArgsConstructor`가 이미 붙어 있으면 해당 애너테이션을 제거한다. builder 전용 응답 DTO에는 명시적 no-arg 생성자를 추가하지 않는다.

- [ ] **Step 3: 생성 경로·Javadoc 검증**

```powershell
cd C:\it\it_backend
./gradlew test --tests "*Application*Test"
./gradlew test
./gradlew javadoc --rerun-tasks 2>&1 | Tee-Object -FilePath build/reports/javadoc-warnings-current.log
(Select-String -Path build/reports/javadoc-warnings-current.log -Pattern 'ApplicationDto.java.*: warning').Count
```

Expected: test BUILD SUCCESSFUL. 요청·입력 DTO의 default constructor 경고는 0건이며, builder 전용 응답 DTO의 기존 `builder()` 생성 경로가 유지된다. 남는 경고는 역할·잔류 사유와 함께 허용 기준선에 기록한다.

- [ ] **Step 4: CLAUDE.md 정책 규칙 추가**

`it_backend/CLAUDE.md` §9(테스트·주석·운영) 목록에 다음 항목을 추가한다:

```markdown
- Javadoc 기본 생성자 경고는 Jackson 역직렬화가 확인된 요청·입력 DTO에 한해 Javadoc을 단 명시적 no-arg 생성자 선언으로 해소합니다. 클래스 레벨 `@Builder`가 붙은 응답 DTO에는 builder용 전체 필드 생성자를 보존하기 위해 no-arg 생성자를 기계적으로 추가하지 않습니다. 전환하지 않은 대량 DTO의 기본 생성자 경고는 허용 잔여로 관리하며, 총량 기준선 수치는 CLAUDE.md가 아닌 `../TASK.md` 항목 메모 또는 `../README.md` 변경 이력에 기록합니다.
```

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java CLAUDE.md
git commit -m "docs: ApplicationDto 명시적 생성자 전환 및 Javadoc 생성자 경고 정책 수립 (BE-06)"
```

### Task 17: Phase C 검증·병합 + 문서 현행화

- [ ] **Step 1: 최종 재측정·전체 테스트**

```powershell
cd C:\it\it_backend
./gradlew test
./gradlew javadoc --rerun-tasks 2>&1 | Tee-Object -FilePath build/reports/javadoc-warnings-current.log
(Select-String -Path build/reports/javadoc-warnings-current.log -Pattern ': warning').Count
```

Expected: test BUILD SUCCESSFUL. Task 14의 최신 기준선과 비교한 파일별 `기준 / 해소 / 허용 잔여 / 신규` 표를 기록한다. 신규 미분류 경고는 0건이어야 하며, 모든 잔여 경고에는 허용 사유가 있어야 한다. 과거 조사 수치인 `148건+`는 참고값으로만 취급하고 완료 조건으로 사용하지 않는다.

- [ ] **Step 2: it_backend main 병합**

```bash
cd C:\it\it_backend
git checkout main
git merge --no-ff chore/be03-be06-projection-javadoc -m "merge: BE-03 프로젝션 조사·구현 + BE-06 Javadoc 정리"
```

- [ ] **Step 3: TASK.md / TASK_DONE.md 현행화 (외부 저장소)**

주의: 두 파일에 기존 미커밋 수정이 있을 수 있다 — 현재 내용을 읽고 그 위에 편집한다.

- `TASK.md` ⚙️ 백엔드 섹션: BE-09·BE-10·BE-11 행 제거, ✅ Done인 BE-07·BE-08 행 제거. BE-02는 이번 사이클 추가 테스트(`UserRepositoryTemCInIt` 등)를 근거 메모로 갱신하고 항목 유지. BE-03은 조사 결과에 따라 완료 제거 또는 경계선 후보를 새 항목으로 등록. BE-06은 잔여 경고 총량(재측정 수치)을 메모로 갱신하거나 완주 시 제거. 또한 "구 검토자 API 경로 제거" P2 항목을 추가하고 제거 조건(신규 프론트 배포 후 최소 한 릴리스 + 14일 WARN 호출 0건), 대상 `ReviewerController.getReviewersLegacy`, 선행 조건을 구체적으로 기록한다.
- `TASK_DONE.md`: "2026-07-20 백엔드 잔여과제 조치(Phase A~C)" 섹션을 추가하고 각 항목의 완료 근거(커밋·테스트·리포트 경로)를 기록.
- `README.md` 변경 이력에 이번 사이클 요약과 Javadoc 경고 기준선/재측정 수치를 1줄 기록.

- [ ] **Step 4: 외부 저장소 커밋**

```bash
cd C:\it
git add TASK.md TASK_DONE.md README.md
git commit -m "docs: 백엔드 잔여과제 조치 완료 반영 (BE-09·10·11 이관, BE-03·06 결과 기록)"
```

---

## 완료 기준 요약

| Phase | 완료 기준 |
| ----- | --------- |
| A | `get(0)`/무정렬 첫 행 선택 5곳 제거, 신규 단위 테스트 12건 PASS, `./gradlew test` 녹색 |
| B | `findByTemC` 반복 조회 0건, `findByTemCInAndDelYn` 활성 사용자 IT·실행계획 확인, 전역 검토자 API와 프론트 URL 계약 PASS, Cfilem 3컬럼 완화, 백엔드 `test integrationTest`·프론트 `check`·`test` 녹색 |
| C | 조사 리포트 산출, 명백 후보 프로젝션 적용(0건이면 리포트 기록), 상위 오염원 5파일 + ApplicationDto 경고를 최신 기준선 대비 분류·해소하고 신규 미분류 경고 0건 확인, CLAUDE.md 정책 추가, TASK.md/TASK_DONE.md/README 현행화 |

## 이미 존재해 재사용하는 기반

| 기존 기반 | 이번 계획의 사용 방식 |
| --------- | --------------------- |
| `UserRepository.findByEnoIn` 배치 조회 패턴 | 새 `findByTemCInAndDelYn`의 컬렉션 파생 쿼리 관례로 재사용 |
| `AbstractOracleRepositoryTest` + `OracleAvailableCondition` | 새 활성 사용자 통합 테스트가 같은 Oracle 슬라이스 하네스를 사용 |
| Cost/Project 계열 프로젝션 통합 테스트 | Phase C 후보의 SQL·DTO 동등성 테스트 형식으로 재사용 |
| `CommitteeService`의 팀장 우선 규칙 | 별도 규칙을 다시 만들지 않고 `UserRepresentativeSelector`로 추출·공유 |
| `review` Pinia store의 `loadWarnings`/`REVIEWERS` 경고 표시 | 전역 API 절단 배포 실패가 화면에서 조용히 사라지지 않도록 기존 진단 흐름을 유지 |
| `FileOwnershipChecker` authorizer 레지스트리 | 다운로드 메타데이터 가드는 컨트롤러의 기존 읽기 권한 검증 이후에만 실행되도록 순서를 유지 |
| 기존 Gradle `Javadoc` 태스크 | 새 문서 생성 파이프라인 없이 경고 기준선과 분류 결과만 확장 |

## NOT in scope

- `TPRMPP_CUSERI` 인덱스의 추측성 추가 — 실행계획과 선택도 근거가 나올 때만 별도 승인한다.
- 구 `/api/reviews/{docMngNo}/reviewers`의 최종 제거 — 이번 릴리스에서는 호환 별칭으로 유지하고 14일 무호출 근거를 확보한 다음 릴리스에서 제거한다.
- 검토자 후보의 문서별 권한·구성 규칙 — 이번 결정은 인증 사용자 공통의 4개 팀 후보 목록이다.
- CFILEM 물리 컬럼의 `NOT NULL` 전환·레거시 백필 — 현재 DB의 NULL 허용 현실을 보존하고 소비 경로만 안전하게 만든다.
- 전체 Javadoc 경고 0건 — 지정 오염원과 요청 DTO 정책만 처리하고 사유 있는 잔여 경고는 기준선으로 관리한다.
- Phase C 조사에서 경계선으로 판정된 프로젝션 후보 — 근거와 함께 `TASK.md` 후속 항목으로 남긴다.
- 운영 배포 실행·롤백 자동화 — 이번 계획은 동시 배포와 스모크 기준까지만 정의한다.

## 실패 모드 점검

| 코드 경로 | 현실적인 운영 실패 | 테스트 | 처리 | 사용자 관측 |
| --------- | ------------------ | ------ | ---- | ----------- |
| Cost 대표 행 선택 | `LST_YN='Y'` 중복 또는 빈 이력 | 중복·빈 목록 단위 테스트 | 결정적 tie-break + WARN, 빈 목록 명시 예외 | 중복은 정상 응답, 빈 목록은 명시 오류 |
| BG 키 선택 | 다건·무정렬 입력·NULL 키 | 각 분기 단위 테스트 | `BG-{연도}-{4자리 시퀀스}` 키 내림차순, 다건 WARN | 정상 응답(정합성 이상은 로그) |
| 활성 사용자 배치 조회 | 삭제 사용자가 대표자로 선정 | Oracle IT | `DEL_YN='N'` 리포지토리 경계 필터 | 삭제 사용자는 결과에서 제외 |
| 팀 대표자 선정 | 팀장 중복·팀원 없음 | selector·service 테스트 | 사번 tie-break, 빈 팀 생략 | 결정적 결과 또는 의도된 미표시 |
| Oracle 접근 | DB 중단 또는 비효율적 전체 스캔 | integrationTest 실제 PASS + 실행계획 기록 | 빌드 게이트, 필요 시 인덱스 승인 중단점 | 배포 전 차단; 런타임은 표준 API 오류 |
| 파일 다운로드 | 저장경로·물리파일명 NULL/공백 | `FileServiceTest` | 권한 검증 후 `CustomGeneralException` | 불완전 메타데이터 오류 표시 |
| Gemini 첨부 | 레거시 NULL 메타데이터 | `GeminiServiceTest` | 사유 있는 skip + 첨부 수 집계 | 응답의 skippedFiles로 부분 실패 확인 |
| 전역 검토자 API | 구 CSR·부분 롤백이 구 경로를 호출 | 신·구 양쪽 URL 계약 테스트, 배포 스모크 | 백엔드 선배포 호환 별칭 + 14일 호출 로그 관찰 | 양쪽 버전 모두 정상 응답 |
| Phase C 프로젝션 | 컬럼·필터·정렬 의미 변화 | 후보별 실패 선행 IT와 전체 IT | Task 12 승인 게이트, 동등성 실패 시 구현 금지 | 배포 전 차단 |
| ApplicationDto 생성자 | `@Builder` 전체 필드 생성자 소실 | Application 대상 + 전체 테스트 | 역할별 분류, builder 응답 생성자 무변경 | 컴파일·테스트 단계에서 차단 |

**Critical gap:** 없음. 테스트와 처리 없이 조용히 실패하는 신규 경로는 남기지 않는다.

## 병렬화·실행 순서

| Workstream | 모듈 | 선행 조건 |
| ---------- | ---- | --------- |
| A. 결정적 행 선택 | backend `budget/cost`, `bizplan` | 없음 |
| B. 사용자 배치·전역 검토자 API | backend `common/iam`, `budget/document`, `council`; frontend `stores` | B 내부에서 Repository → Selector → Service/API 순서 |
| C. 파일 NULL 소비 경로 | backend `infra/file`, `infra/ai` | 없음 |
| D. 프로젝션 조사·조건부 구현 | backend `repository/service/dto`, 외부 reports | Task 12 조사·사용자 승인 |
| E. Javadoc 정책·오염원 정리 | backend `build`, `entity/controller/dto`, docs | 기능 변경 병합 후 최신 기준선 측정 |

- Lane A: Workstream A
- Lane B: Workstream B 내부 순차
- Lane C: Workstream C
- Lane D: Workstream D 승인 게이트 후 순차
- Lane E: Workstream E

기술적으로 A·B·C는 독립 worktree에서 병렬화할 수 있지만, 리뷰 결정 D3에서 현재 체크아웃 기반 절차를 유지하기로 했으므로 실제 실행은 `A → B → C → D → E` 순차로 고정한다. B는 백엔드와 프론트가 같은 API 계약을 공유하므로 두 커밋을 함께 검증하고 같은 배포 창으로 넘긴다. D와 E는 같은 backend 브랜치를 사용하고 DTO·엔티티가 겹칠 수 있어 병렬 수정하지 않는다.

## 리뷰 완료 요약

| 점검 영역 | 결과 |
| --------- | ---- |
| 범위 | 기존 6개 과제를 모두 유지하고 범위 축소 없이 완결성 기준으로 보강 |
| 아키텍처 | 10개 쟁점 해소: 공통 대표 행 selector, BG 키 정렬 기준, 활성 사용자 경계 필터, API 호환 전환, Oracle 실행계획 게이트 등 |
| 코드 품질 | 3개 쟁점 해소: Lombok builder 보존, Cfilem 명시 오류/skip, Javadoc 재실행·잔여 분류 |
| 테스트 | 핵심 데이터 흐름을 작성하고 3개 공백 해소: BudgetWorkService 회귀, 신·구 API 계약, Oracle 실제 통합 검증 |
| 성능 | 2개 쟁점 해소: BE-03 후보 탐색 범위 확대, 인덱스 변경 전 실행계획·선택도 측정 |
| 기존 기반 | 재사용 대상 7개를 확인하고 새 추상화가 기존 권한·경고·테스트 관례를 보존하도록 지정 |
| TODO | `docMngNo` 무사용 문제는 전역 API로 이번 계획에서 해결하고, 구 경로 제거만 조건이 명확한 P2 후속 과제로 분리 |
| 실패 모드 | 신규 Critical gap 0건; 모든 핵심 실패에 테스트·처리·사용자 관측 경로 지정 |
| 외부 관점 | 독립 검토의 6개 지적을 모두 반영: 공통 selector, BG 기준, Javadoc 캐시, BE-03 탐색, API 호환, 승인 계획 버전화 |
| 실행 구조 | 독립 workstream 5개 식별; D3 결정에 따라 실제 병렬 0개, 순차 5개로 고정 |
| 완결성 점수 | 19/20. 단축안 대신 완결안 선택; 1점은 사용자가 명시적으로 유지한 현재 체크아웃 기반 실행 위험 |
| 미해결 결정 | 0건 |

## 회고 근거

- 최근 파일 권한 경계 강화 흐름을 보존하기 위해 다운로드 메타데이터 검증은 `FileOwnershipChecker`의 기존 읽기 권한 검증 뒤에 둔다.
- 기존 프론트 `review` store가 API 실패를 `loadWarnings`로 노출하므로 전역 검토자 API 전환도 동일 진단 경로를 유지하고, 백엔드 호환 경로 선배포로 부분 배포를 견딘다.
- BG 번호 생성이 `BG-{연도}-{4자리 시퀀스}` 형식이므로 업무상 최신 판단은 수정 감사시각이 아니라 NULL을 제외한 번호 내림차순으로 고정한다.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | 이번 백엔드 기술부채 조치에는 추가 제품 전략 검토 불필요 |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | 정식 Codex 리뷰는 미실행; 독립 fallback 검토는 별도 수행 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 18 issues, 0 critical gaps, unresolved 0 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | 화면 디자인 변경 없음; store API 경로와 경고 계약만 변경 |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | 개발자 도구·설치 흐름 변경 없음 |

- **OUTSIDE VOICE:** 독립 fallback 검토 1회 CLEAR — 6개 지적 중 6개를 계획에 반영했다.
- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED + OUTSIDE VOICE 반영 완료 — 구현 준비 완료.
