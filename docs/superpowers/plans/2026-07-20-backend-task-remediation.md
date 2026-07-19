# 백엔드 잔여과제(BE-02·03·06·09·10·11) 조치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TASK.md 백엔드 섹션의 진행 중 과제 6건(BE-02/03/06/09/10/11)을 위험도 순서(Phase A→B→C)로 해소한다.

**Architecture:** 비결정 첫 행 선택은 패키지 전용 정적 선택 헬퍼(순수 함수)로 추출해 단위 테스트하고, 팀 조회 N+1은 `findByTemCIn` 배치 + 공용 `UserRepresentativeSelector`로 통일한다. DB 정합(BE-11)은 ORM 선언 완화만 수행한다. BE-03은 조사 리포트 기반으로 명백 후보만 프로젝션 분리하고, BE-06은 상위 오염원 주석 보강 + Lombok 기본 생성자 정책화로 마감한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, JUnit 5 + AssertJ + Mockito, 로컬 Oracle `@DataJpaTest` 하네스(`AbstractOracleRepositoryTest`, `@Tag("it")`).

**Spec:** `docs/superpowers/specs/2026-07-20-backend-task-remediation-design.md`

---

## 사전 조건·주의

- `it_backend`는 **독립 git 저장소**다. 코드 커밋은 반드시 `C:\it\it_backend` 안에서 수행한다. 외부 `C:\it` 저장소에는 문서(리포트, TASK.md 등)만 커밋한다.
- `integrationTest`(`@Tag("it")`)는 로컬 Oracle(ITPAPP@127.0.0.1:11521/XEPDB1)이 기동 중이어야 실행된다. 꺼져 있으면 `OracleAvailableCondition`이 스킵하므로 **실행 전 Oracle 기동을 확인**한다.
- Gradle 명령은 항상 `C:\it\it_backend`로 `cd`한 뒤 실행한다(백그라운드 셸은 cwd를 상속하지 않음). `binary/output.bin` 파일락이 발생하면 `--no-daemon`을 붙이고 락 파일을 정리한다.
- `./gradlew clean`은 Jacoco 리포트도 삭제하므로 이 계획에서는 사용하지 않는다.
- 커밋 메시지는 `<type>: <설명>` 한글 컨벤션(feat/fix/refactor/docs/test/chore)을 따른다.

## 파일 구조 (전체 변경 지도)

**it_backend 저장소 — main:**

| 파일 | 작업 | 책임 |
| ---- | ---- | ---- |
| `src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java` | 수정 | `resolvePrimaryRow` 정적 헬퍼 추가, `get(0)` 3곳 교체 (Task 2) |
| `src/main/java/com/kdb/it/domain/bizplan/service/BizplanService.java` | 수정 | `selectLatestBgKey` 정적 헬퍼 추가, `resolveBgNo` 교체 (Task 3) |
| `src/main/java/com/kdb/it/common/iam/repository/UserRepository.java` | 수정 | `findByTemCIn` 파생 쿼리 추가 (Task 5) |
| `src/main/java/com/kdb/it/common/iam/service/UserRepresentativeSelector.java` | 생성 | 팀 대표자 결정적 선택 공용 유틸 (Task 6) |
| `src/main/java/com/kdb/it/domain/budget/document/service/ReviewerService.java` | 수정 | 배치 조회 + 순서 고정 (Task 7) |
| `src/main/java/com/kdb/it/domain/council/service/CommitteeService.java` | 수정 | `resolveTeamLeads` 배치 전환 (Task 8) |
| `src/main/java/com/kdb/it/infra/file/entity/Cfilem.java` | 수정 | 3컬럼 `nullable=false` 제거 (Task 9) |
| `build.gradle` | 수정 | Javadoc `-Xmaxwarns` 상한 해제 (Task 14) |
| `Bprojm`·`ContractController`·`ApplicationDto`·`CouncilProjectRow`·`UmsPayload`·`Btermm` | 수정 | Javadoc 누락 주석 보강 (Task 15·16) |
| `CLAUDE.md` | 수정 | Lombok 기본 생성자 경고 정책 규칙 추가 (Task 16) |

**it_backend 저장소 — test:**

| 파일 | 작업 | 책임 |
| ---- | ---- | ---- |
| `src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java` | 수정 | `resolvePrimaryRow` @Nested 테스트 (Task 2) |
| `src/test/java/com/kdb/it/domain/bizplan/service/BizplanServiceTest.java` | 수정 | `selectLatestBgKey` @Nested 테스트 (Task 3) |
| `src/test/java/com/kdb/it/common/iam/repository/UserRepositoryTemCInIt.java` | 생성 | `findByTemCIn` 통합 테스트 (Task 5) |
| `src/test/java/com/kdb/it/common/iam/service/UserRepresentativeSelectorTest.java` | 생성 | 대표자 선택 규칙 단위 테스트 (Task 6) |
| `src/test/java/com/kdb/it/domain/budget/document/service/ReviewerServiceTest.java` | 수정 | 배치 스텁 기준 재작성 (Task 7) |
| `src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java` | 수정 | `findByTemCIn` 스텁 전환 (Task 8) |

**외부 C:\it 저장소:**

| 파일 | 작업 | 책임 |
| ---- | ---- | ---- |
| `docs/superpowers/reports/2026-07-be03-projection-survey.md` | 생성 | BE-03 조사 리포트 (Task 12) |
| `TASK.md`, `TASK_DONE.md`, `README.md` | 수정 | 완료 이관·변경 이력 (Task 17) |

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

### Task 2: CostService 대표 행 결정적 선택

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

`CostServiceTest.java`에 아래 `@Nested` 클래스를 추가한다. 필요한 import: `org.junit.jupiter.api.Nested`, `com.kdb.it.domain.budget.cost.entity.Bcostm`, `java.util.List`, `static org.assertj.core.api.Assertions.assertThat` (기존에 있으면 생략).

```java
    @Nested
    @DisplayName("resolvePrimaryRow — 대표 행 결정적 선택 (BE-09)")
    class ResolvePrimaryRowTests {

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
            assertThat(CostService.resolvePrimaryRow(List.of(only))).isSameAs(only);
        }

        @Test
        @DisplayName("LST_YN='Y' 행이 'N' 행보다 우선한다")
        void latestYn_preferred() {
            Bcostm oldRow = cost(2, "N");
            Bcostm latest = cost(1, "Y");
            assertThat(CostService.resolvePrimaryRow(List.of(oldRow, latest))).isSameAs(latest);
        }

        @Test
        @DisplayName("같은 LST_YN이면 BG_SNO 내림차순으로 최신 일련번호를 선택한다")
        void sameLstYn_highestBgSno() {
            Bcostm sno1 = cost(1, "N");
            Bcostm sno3 = cost(3, "N");
            Bcostm sno2 = cost(2, "N");
            assertThat(CostService.resolvePrimaryRow(List.of(sno1, sno3, sno2))).isSameAs(sno3);
        }

        @Test
        @DisplayName("LST_YN='Y' 다건이면 BG_SNO가 큰 행을 선택한다 (WARN 경로)")
        void duplicateLatest_deterministicTieBreak() {
            Bcostm dup1 = cost(1, "Y");
            Bcostm dup2 = cost(2, "Y");
            assertThat(CostService.resolvePrimaryRow(List.of(dup1, dup2))).isSameAs(dup2);
        }

        @Test
        @DisplayName("입력 순서와 무관하게 항상 같은 행을 선택한다")
        void orderIndependent() {
            Bcostm a = cost(1, "N");
            Bcostm b = cost(2, "Y");
            Bcostm c = cost(3, "N");
            assertThat(CostService.resolvePrimaryRow(List.of(a, b, c)).getBgSno())
                    .isEqualTo(CostService.resolvePrimaryRow(List.of(c, b, a)).getBgSno());
        }
    }
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest"
```

Expected: 컴파일 오류 — `resolvePrimaryRow` 미정의 (`cannot find symbol`)

- [ ] **Step 3: 선택 헬퍼 구현**

`CostService.java` import 블록에 `import java.util.Comparator;`를 추가하고, 클래스의 private 메서드 영역에 다음을 추가한다.

```java
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
    static Bcostm resolvePrimaryRow(List<Bcostm> costs) {
        Bcostm primary = costs.stream()
                .min(Comparator.comparing((Bcostm c) -> "Y".equals(c.getLstYn()) ? 0 : 1)
                        .thenComparing(Bcostm::getBgSno,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .orElseThrow(() -> new IllegalArgumentException("비용 이력 목록이 비어 있습니다."));
        long latestCount = costs.stream().filter(c -> "Y".equals(c.getLstYn())).count();
        if (latestCount > 1) {
            log.warn("전산관리비 LST_YN='Y' 행이 {}건입니다 (itMngcNo={}, 선택 bgSno={})",
                    latestCount, primary.getCostBgNo(), primary.getBgSno());
        }
        return primary;
    }
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest"
```

Expected: BUILD SUCCESSFUL, ResolvePrimaryRowTests 5건 PASS

- [ ] **Step 5: 호출부 3곳 교체 — getCost**

`getCost`의 본문(139~145행 부근)에서:

```java
        CostDto.Response response = CostDto.Response.fromEntity(costs.get(0));
        enrichResponse(response, costs.get(0));
```

를 다음으로 교체:

```java
        Bcostm primary = resolvePrimaryRow(costs);
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
     * 동일 관리번호에 여러 이력(SNO)이 있으면 {@link #resolvePrimaryRow(List)}가
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
        Bcostm target = resolvePrimaryRow(costs);
```

- [ ] **Step 7: 호출부 교체 — deleteCost**

`deleteCost`의:

```java
        OwnershipVerifier.verifyModifiable(costs.get(0).getFstEnrUsid(), costs.get(0).getCostSvnDpmC());
```

를 다음으로 교체:

```java
        Bcostm primary = resolvePrimaryRow(costs);
        OwnershipVerifier.verifyModifiable(primary.getFstEnrUsid(), primary.getCostSvnDpmC());
```

(전 행 soft delete 루프는 그대로 유지한다.)

- [ ] **Step 8: 잔여 `get(0)` 확인**

`CostService.java`에서 `costs.get(0)` 검색 결과가 0건인지 확인한다. `setApplicationInfo`의 `capplas.get(0)`은 `OrderByApfDcmNoDesc` 정렬 결과의 첫 행이므로 **결정적 — 변경하지 않는다.**

- [ ] **Step 9: 전체 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.cost.service.*"
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 10: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java
git commit -m "fix: 전산관리비 대표 행 선택을 결정적 규칙으로 교체 (BE-09)"
```

### Task 3: BizplanService BG- 키 결정적 선택

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/bizplan/service/BizplanService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/bizplan/service/BizplanServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

`BizplanServiceTest.java`에 아래 `@Nested` 클래스를 추가한다(`PRJ` 상수·`Bproja` import는 기존 파일에 이미 존재).

```java
    @Nested
    @DisplayName("selectLatestBgKey — BG- 키 결정적 선택 (BE-09)")
    class SelectLatestBgKeyTests {

        private Bproja app(String cncdRfrNo) {
            return Bproja.builder().abusMngNo(PRJ).cncdRfrNo(cncdRfrNo).stsTc("09").build();
        }

        @Test
        @DisplayName("BG- 키가 없으면 null을 반환한다")
        void noBgKey_returnsNull() {
            assertThat(BizplanService.selectLatestBgKey(PRJ, List.of(app("BIZ-" + PRJ)))).isNull();
        }

        @Test
        @DisplayName("BG- 키 1건이면 그 키를 반환한다")
        void singleBgKey_returned() {
            assertThat(BizplanService.selectLatestBgKey(PRJ,
                    List.of(app("BG-2026-0001"), app("BIZ-" + PRJ)))).isEqualTo("BG-2026-0001");
        }

        @Test
        @DisplayName("BG- 키 다건이면 사전순 내림차순으로 최신 키를 선택한다 (WARN 경로)")
        void multipleBgKeys_latestSelected() {
            assertThat(BizplanService.selectLatestBgKey(PRJ,
                    List.of(app("BG-2025-0009"), app("BG-2026-0002"), app("BG-2026-0001"))))
                    .isEqualTo("BG-2026-0002");
        }

        @Test
        @DisplayName("cncdRfrNo가 null인 행은 무시한다")
        void nullKey_ignored() {
            assertThat(BizplanService.selectLatestBgKey(PRJ,
                    List.of(app(null), app("BG-2026-0001")))).isEqualTo("BG-2026-0001");
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
     * <p>선택 규칙: {@code CNCD_RFR_NO} 사전순 내림차순(연도·일련번호 채번 체계상 최신 우선).
     * 서로 다른 BG- 키가 2건 이상이면 WARN 로그를 남긴다.</p>
     *
     * @param abusMngNo    사업관리번호 (로그 문맥용)
     * @param applications 미삭제 BPROJA 행 목록
     * @return 최신 BG- 키 (후보가 없으면 null)
     */
    static String selectLatestBgKey(String abusMngNo, List<Bproja> applications) {
        List<String> bgKeys = applications.stream()
                .map(Bproja::getCncdRfrNo)
                .filter(key -> key != null && key.startsWith(BG_KEY_PREFIX))
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
        if (bgKeys.size() > 1) {
            log.warn("BPROJA 예산편성 BG- 키가 {}건입니다 (abusMngNo={}, 선택 키={})",
                    bgKeys.size(), abusMngNo, bgKeys.get(0));
        }
        return bgKeys.isEmpty() ? null : bgKeys.get(0);
    }
```

(`java.util.Comparator`는 기존에 import되어 있다.)

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.bizplan.service.BizplanServiceTest"
```

Expected: BUILD SUCCESSFUL — 신규 4건 포함 전체 PASS (기존 `createsPlanWithStatus21AndBgNo` 테스트가 회귀 검증 역할)

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

### Task 5: UserRepository.findByTemCIn + 통합 테스트

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepository.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/iam/repository/UserRepositoryTemCInIt.java`

- [ ] **Step 0: Phase B 브랜치 생성**

```bash
cd C:\it\it_backend
git checkout main
git checkout -b feat/be10-be11-team-batch-and-cfilem
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
 * UserRepository.findByTemCIn 배치 조회 통합 테스트 (BE-10)
 *
 * <p>실 로컬 Oracle(ITPOWN)에 @DataJpaTest로 연결하며, 픽스처는 트랜잭션 롤백으로
 * 정리된다. 존재하지 않는 팀코드 대역(T999x)을 사용해 실 데이터와 격리한다.</p>
 */
@DisplayName("UserRepository.findByTemCIn 배치 조회 (BE-10)")
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
        em.flush();
        em.clear();

        List<CuserI> result = userRepository.findByTemCIn(List.of(TEAM_A, TEAM_B, TEAM_EMPTY));

        assertThat(result).extracting(CuserI::getEno)
                .contains("TENO9001", "TENO9002", "TENO9003");
        assertThat(result).allSatisfy(u -> assertThat(u.getTemC()).isIn(TEAM_A, TEAM_B));
    }

    @Test
    @DisplayName("해당 팀 사용자가 없으면 빈 목록을 반환한다")
    void findByTemCIn_noUsers_returnsEmpty() {
        assertThat(userRepository.findByTemCIn(List.of(TEAM_EMPTY))).isEmpty();
    }
}
```

- [ ] **Step 2: 컴파일 실패 확인**

```bash
cd C:\it\it_backend
./gradlew integrationTest --tests "com.kdb.it.common.iam.repository.UserRepositoryTemCInIt" 2>&1 | tail -5
```

Expected: `cannot find symbol ... findByTemCIn` 컴파일 오류

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
     * @return 해당 팀들의 사용자 목록
     */
    java.util.List<CuserI> findByTemCIn(Collection<String> temCs);
```

- [ ] **Step 4: 통합 테스트 통과 확인 (로컬 Oracle 기동 상태)**

```bash
cd C:\it\it_backend
./gradlew integrationTest --tests "com.kdb.it.common.iam.repository.UserRepositoryTemCInIt"
```

Expected: BUILD SUCCESSFUL, 2건 PASS (Oracle 미기동이면 SKIP — 반드시 기동 후 PASS 확인)

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/iam/repository/UserRepository.java src/test/java/com/kdb/it/common/iam/repository/UserRepositoryTemCInIt.java
git commit -m "feat: 팀코드 배치 조회 findByTemCIn 추가 (BE-10)"
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

### Task 7: ReviewerService 배치 전환 + 순서 고정

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ReviewerService.java` (전체 교체)
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ReviewerServiceTest.java` (전체 교체)

- [ ] **Step 1: 테스트 전체 재작성 (배치 스텁 기준)**

`ReviewerServiceTest.java` 전체를 다음으로 교체한다:

```java
package com.kdb.it.domain.budget.document.service;

import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.UserRepository;
import com.kdb.it.domain.budget.document.dto.ReviewerDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * ReviewerService 단위 테스트 — BE-10
 *
 * <p>검토자 목록: findByTemCIn 1회 배치 조회, 대표자 결정 규칙(팀장 우선→사번 오름차순),
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

    @Test
    @DisplayName("getReviewers: 팀코드 전체를 findByTemCIn 1회로 배치 조회한다")
    void getReviewers_배치조회_1회() {
        given(userRepository.findByTemCIn(anyCollection())).willReturn(List.of());

        reviewerService.getReviewers("DOC-2026-0001");

        verify(userRepository, times(1)).findByTemCIn(anyCollection());
    }

    @Test
    @DisplayName("getReviewers: 팀장이 있으면 팀장을 검토자로 선택한다")
    void getReviewers_팀장우선() {
        given(userRepository.findByTemCIn(anyCollection())).willReturn(List.of(
                makeUser("E002", "김과장", "18010", "과장"),
                makeUser("E009", "박팀장", "18010", "팀장")));

        List<ReviewerDto.Response> result = reviewerService.getReviewers("DOC-2026-0001");

        assertThat(result)
                .filteredOn(r -> "PMO팀".equals(r.getTeamName()))
                .extracting(ReviewerDto.Response::getEno)
                .containsExactly("E009");
    }

    @Test
    @DisplayName("getReviewers: 팀장이 없으면 사번 오름차순 첫 번째를 선택한다")
    void getReviewers_사번오름차순() {
        given(userRepository.findByTemCIn(anyCollection())).willReturn(List.of(
                makeUser("E005", "이차장", "18010", "차장"),
                makeUser("E001", "정과장", "18010", "과장")));

        List<ReviewerDto.Response> result = reviewerService.getReviewers("DOC-2026-0001");

        assertThat(result)
                .filteredOn(r -> "PMO팀".equals(r.getTeamName()))
                .extracting(ReviewerDto.Response::getEno)
                .containsExactly("E001");
    }

    @Test
    @DisplayName("getReviewers: 사용자가 없는 팀은 결과에서 제외된다")
    void getReviewers_사용자없는팀_제외() {
        given(userRepository.findByTemCIn(anyCollection())).willReturn(List.of());

        assertThat(reviewerService.getReviewers("DOC-2026-0001")).isEmpty();
    }

    @Test
    @DisplayName("getReviewers: 결과는 계약팀→기획팀→PMO팀→개발/운영팀 순서로 고정된다")
    void getReviewers_팀순서고정() {
        given(userRepository.findByTemCIn(anyCollection())).willReturn(List.of(
                makeUser("E301", "개발A", "18501", "과장"),
                makeUser("E101", "기획A", "18001", "과장"),
                makeUser("E201", "PMOA", "18010", "과장"),
                makeUser("E001", "계약A", "12004", "과장")));

        List<ReviewerDto.Response> result = reviewerService.getReviewers("DOC-2026-0001");

        assertThat(result).extracting(ReviewerDto.Response::getTeamName)
                .containsExactly("계약팀", "기획팀", "PMO팀", "개발/운영팀");
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.document.service.ReviewerServiceTest"
```

Expected: FAIL — 서비스가 아직 `findByTemC` 반복 조회를 사용하므로 배치·순서 테스트 실패

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
     * 사전협의 문서에 대한 검토자 목록을 반환합니다.
     *
     * <p>팀코드 전체를 {@code findByTemCIn} 1회로 배치 조회(N+1 제거)하고,
     * 각 팀의 대표자는 {@link UserRepresentativeSelector}가 결정적으로 선택합니다.
     * 사용자가 없는 팀은 결과에서 제외합니다.</p>
     *
     * @param docMngNo 사전협의 관리번호
     * @return 팀별 검토자 DTO 목록 (계약팀→기획팀→PMO팀→개발/운영팀 순서)
     */
    public List<ReviewerDto.Response> getReviewers(String docMngNo) {
        Map<String, List<CuserI>> usersByTeam = userRepository
                .findByTemCIn(REVIEW_TEAM_MAP.keySet()).stream()
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

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd C:\it\it_backend
./gradlew test --tests "com.kdb.it.domain.budget.document.service.ReviewerServiceTest"
```

Expected: BUILD SUCCESSFUL, 5건 PASS

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/document/service/ReviewerService.java src/test/java/com/kdb/it/domain/budget/document/service/ReviewerServiceTest.java
git commit -m "refactor: 검토자 조회를 배치+결정적 대표자 선택으로 전환 (BE-10)"
```

### Task 8: CommitteeService.resolveTeamLeads 배치 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CommitteeService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java`

- [ ] **Step 1: 테스트 스텁 전환**

`CommitteeServiceTest.java`에 배치 스텁 헬퍼를 추가한다 (import: `static org.mockito.ArgumentMatchers.anyCollection`, `java.util.Arrays`, `java.util.Collection`):

```java
    /** findByTemCIn 배치 스텁 — 요청된 팀코드에 속한 사용자만 반환한다. */
    private void stubUsersByTeam(CuserI... users) {
        given(userRepository.findByTemCIn(anyCollection())).willAnswer(inv -> {
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

Expected: FAIL — 서비스가 아직 `findByTemC`를 호출하므로 배치 스텁이 매칭되지 않아 위원 목록이 비어 어서션 실패

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
     * <p>팀코드 전체를 {@code findByTemCIn} 1회로 배치 조회(N+1 제거)하고, 팀별 대표자는
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
        Map<String, List<CuserI>> usersByTeam = userRepository.findByTemCIn(temCodes).stream()
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

- [ ] **Step 2: 테스트 확인**

```bash
cd C:\it\it_backend
./gradlew test
```

Expected: BUILD SUCCESSFUL (선언 완화만이므로 회귀 없음)

- [ ] **Step 3: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/infra/file/entity/Cfilem.java
git commit -m "fix: Cfilem 파일명·물리명·경로 컬럼을 실제 DB NULL 정책과 일치 (BE-11)"
```

### Task 10: Phase B 검증·병합

- [ ] **Step 1: 전체 테스트 (로컬 Oracle 기동 상태)**

```bash
cd C:\it\it_backend
./gradlew test integrationTest
```

Expected: BUILD SUCCESSFUL (integrationTest SKIP이 아닌 PASS인지 확인)

- [ ] **Step 2: main 병합**

```bash
cd C:\it\it_backend
git checkout main
git merge --no-ff feat/be10-be11-team-batch-and-cfilem -m "merge: BE-10 팀 조회 배치화 + BE-11 Cfilem NULL 정책 통일"
```

---

## Phase C — BE-03 프로젝션 조사·구현 + BE-06 Javadoc 정리 (🟡/🟢)

### Task 11: Phase C 브랜치 생성

- [ ] **Step 1:**

```bash
cd C:\it\it_backend
git checkout main
git checkout -b chore/be03-be06-projection-javadoc
```

### Task 12: BE-03 전체 엔티티 로딩 후보 조사 리포트

**Files:**
- Create: `C:\it\docs\superpowers\reports\2026-07-be03-projection-survey.md` (외부 저장소)

- [ ] **Step 1: 후보 수집 (grep)**

it_backend에서 다음을 수집한다:

```bash
cd C:\it\it_backend
grep -rn "nativeQuery = true" src/main/java --include="*.java"
grep -rn "JOIN FETCH\|join fetch" src/main/java --include="*.java"
grep -rn "@EntityGraph" src/main/java --include="*.java"
```

특히 집행 4단계(계약·발주·검수·정산 — `domain/contract` 등, `docs/guides/domains/project-execution.md` 참조) 상세 조회 서비스에서 **엔티티 전체를 로딩한 뒤 응답 DTO가 일부 컬럼만 사용하는 메서드**를 식별한다. 서비스별로 조회 메서드 → 응답 DTO 매핑을 추적해 사용 컬럼 비율을 기록한다.

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
- **명백(이번 구현)**: 목록성 조회(다건 반환)이면서 엔티티 전체 로딩, 응답 DTO 사용 컬럼이 절반 미만이거나 LOB/대형 컬럼 포함
- **경계선(후속 등록)**: 단건 상세 조회, 사용 컬럼 비율이 높은 경우 — 측정 근거와 함께 TASK.md 등록
- **제외**: 이미 프로젝션 적용됨 또는 Dirty Checking에 엔티티 로딩이 필요한 쓰기 경로

## 후보 목록
| # | 위치(클래스.메서드) | 반환 형태 | 사용 컬럼/전체 컬럼 | 실행계획 요약 | 판정 |
| - | ------------------- | --------- | ------------------- | ------------- | ---- |
| 1 | (조사 결과 기입)    |           |                     |               |      |

## 상세 근거
(후보별 EXPLAIN PLAN 출력 요약과 판정 사유)
```

- [ ] **Step 4: 외부 저장소에 리포트 커밋**

```bash
cd C:\it
git add docs/superpowers/reports/2026-07-be03-projection-survey.md
git commit -m "docs: BE-03 전체 엔티티 로딩 후보 조사 리포트"
```

### Task 13: BE-03 명백 후보 프로젝션 분리 (조건부)

**Files:** 조사 결과에 따라 결정 (명백 후보 0건이면 이 Task 전체를 건너뛰고 리포트에 "명백 후보 없음"을 기록)

- [ ] **Step 1: 후보별 실패하는 통합 테스트 작성**

명백 판정 후보마다 `AbstractOracleRepositoryTest` 기반 IT를 먼저 작성한다. 기존 선례(`CostListProjectionIt`, `ProjectListProjectionIt`)의 구조를 따르되, **프로젝션 결과가 기존 엔티티 로딩 결과와 동일한 값을 반환하는지**를 어서션한다. 골격:

```java
@DisplayName("<대상> 목록 프로젝션 (BE-03)")
class <대상>ProjectionIt extends AbstractOracleRepositoryTest {

    @Autowired
    private <대상>Repository repository;

    @Autowired
    private TestEntityManager em;

    @Test
    @DisplayName("프로젝션 조회가 엔티티 조회와 동일한 값을 반환한다")
    void projection_matchesEntityLoad() {
        // Arrange: 픽스처 행 삽입 (감사컬럼 직접 세팅, 트랜잭션 롤백으로 정리)
        // Act: 신규 프로젝션 메서드 조회
        // Assert: 기존 엔티티 조회 결과의 대응 필드와 값 일치
    }
}
```

- [ ] **Step 2: 프로젝션 구현**

Spring Data 인터페이스 프로젝션(사용 컬럼만 getter 선언) 또는 기존 `*RepositoryImpl` QueryDSL DTO 프로젝션 선례를 따른다. 인터페이스 프로젝션 형태:

```java
/** <대상> 목록 조회 전용 프로젝션 — 사용 컬럼만 적재 (BE-03) */
public interface <대상>SummaryView {
    String get<식별자>();
    String get<표시명>();
    // 응답 DTO가 실제 사용하는 컬럼만 선언
}
```

```java
    /** 목록 화면용 경량 조회 — 전체 엔티티 로딩 대체 (BE-03) */
    List<<대상>SummaryView> findAllProjectedByDelYn(String delYn);
```

서비스 호출부를 프로젝션 메서드로 교체하고, 응답 DTO 매핑을 뷰 getter 기준으로 바꾼다.

- [ ] **Step 3: 테스트 통과 확인 후 후보별 커밋**

```bash
cd C:\it\it_backend
./gradlew test integrationTest
git add <변경 파일들>
git commit -m "perf: <대상> 목록 조회 프로젝션 분리 (BE-03)"
```

- [ ] **Step 4: 경계선 후보 확정**

경계선 판정 후보를 Task 17에서 TASK.md에 등록할 수 있도록 리포트의 판정 표를 확정한다.

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

```bash
cd C:\it\it_backend
./gradlew javadoc 2>&1 | grep -c ": warning"
```

Expected: 기준선 총량 출력 (직전 측정 기준 985건 부근). 수치를 기록해 둔다.

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

```bash
cd C:\it\it_backend
./gradlew javadoc 2>&1 | grep "Bprojm.java"
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

- [ ] **Step 3: 파일별 경고 확인 후 개별 커밋**

```bash
cd C:\it\it_backend
./gradlew javadoc 2>&1 | grep "Bprojm.java" | grep -c ": warning"
```

Expected: 0 (Lombok 생성자 경고만 남으면 해당 건수)

```bash
git add src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java
git commit -m "docs: Bprojm Javadoc 누락 주석 보강 (BE-06)"
```

(나머지 4개 파일도 같은 방식으로 개별 커밋: `ContractController`, `CouncilProjectRow`, `UmsPayload`, `Btermm`)

### Task 16: BE-06 Lombok 기본 생성자 경고 정책 적용

**Files:**
- Modify: `src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java`
- Modify: `it_backend/CLAUDE.md`

- [ ] **Step 1: ApplicationDto 명시적 생성자 전환**

`./gradlew javadoc 2>&1 | grep "ApplicationDto.java"`로 default constructor 경고가 발생하는 중첩 클래스를 확인하고, 각 클래스에 Javadoc을 단 명시적 no-arg 생성자를 추가한다:

```java
        /** 기본 생성자 — Jackson 역직렬화용. */
        public Response() {
        }
```

(클래스에 `@Builder`/`@AllArgsConstructor`가 있으면 명시적 no-arg 생성자 추가로 기존 생성 경로가 깨지지 않는지 컴파일로 확인한다. `@NoArgsConstructor`가 이미 붙어 있으면 그 애너테이션을 제거하고 명시적 생성자로 대체한다.)

- [ ] **Step 2: 검증**

```bash
cd C:\it\it_backend
./gradlew test
./gradlew javadoc 2>&1 | grep "ApplicationDto.java" | grep -c ": warning"
```

Expected: test BUILD SUCCESSFUL, ApplicationDto 경고 0건

- [ ] **Step 3: CLAUDE.md 정책 규칙 추가**

`it_backend/CLAUDE.md` §9(테스트·주석·운영) 목록에 다음 항목을 추가한다:

```markdown
- Javadoc 기본 생성자 경고는 역직렬화용 DTO에 한해 Javadoc을 단 명시적 no-arg 생성자 선언으로 해소합니다. 전환하지 않은 대량 DTO의 기본 생성자 경고는 허용 잔여로 관리하며, 총량 기준선 수치는 CLAUDE.md가 아닌 `../TASK.md` 항목 메모 또는 `../README.md` 변경 이력에 기록합니다.
```

- [ ] **Step 4: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java CLAUDE.md
git commit -m "docs: ApplicationDto 명시적 생성자 전환 및 Javadoc 생성자 경고 정책 수립 (BE-06)"
```

### Task 17: Phase C 검증·병합 + 문서 현행화

- [ ] **Step 1: 최종 재측정·전체 테스트**

```bash
cd C:\it\it_backend
./gradlew test
./gradlew javadoc 2>&1 | grep -c ": warning"
```

Expected: test BUILD SUCCESSFUL. 경고 총량이 기준선 대비 감소(상위 오염원 148건+ 해소 반영). 수치를 기록한다.

- [ ] **Step 2: it_backend main 병합**

```bash
cd C:\it\it_backend
git checkout main
git merge --no-ff chore/be03-be06-projection-javadoc -m "merge: BE-03 프로젝션 조사·구현 + BE-06 Javadoc 정리"
```

- [ ] **Step 3: TASK.md / TASK_DONE.md 현행화 (외부 저장소)**

주의: 두 파일에 기존 미커밋 수정이 있을 수 있다 — 현재 내용을 읽고 그 위에 편집한다.

- `TASK.md` ⚙️ 백엔드 섹션: BE-09·BE-10·BE-11 행 제거, ✅ Done인 BE-07·BE-08 행 제거. BE-02는 이번 사이클 추가 테스트(`UserRepositoryTemCInIt` 등)를 근거 메모로 갱신하고 항목 유지. BE-03은 조사 결과에 따라 완료 제거 또는 경계선 후보를 새 항목으로 등록. BE-06은 잔여 경고 총량(재측정 수치)을 메모로 갱신하거나 완주 시 제거.
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
| A | `get(0)`/무정렬 첫 행 선택 4곳 제거, 신규 단위 테스트 9건 PASS, `./gradlew test` 녹색 |
| B | `findByTemC` 반복 조회 0건, `findByTemCIn` IT PASS, Cfilem 3컬럼 완화, `./gradlew test integrationTest` 녹색 |
| C | 조사 리포트 산출, 명백 후보 프로젝션 적용(0건이면 리포트 기록), 상위 오염원 5파일 + ApplicationDto 경고 해소, CLAUDE.md 정책 추가, TASK.md/TASK_DONE.md/README 현행화 |
