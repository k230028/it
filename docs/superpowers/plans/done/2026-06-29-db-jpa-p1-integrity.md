# DB / JPA P1 — 정합·안정성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:test-driven-development`. Every task follows strict RED → GREEN → REFACTOR. Write the failing test first, run it to confirm it fails for the expected reason, implement the minimal code, run it to green, then commit. Do NOT batch steps. Do NOT write implementation before its test.

**Goal**: 설계 문서(`docs/superpowers/specs/2026-06-29-db-jpa-optimization-design.md` §4)의 P1 "정합·안정성" 2건을 동작 보존하며 구현한다.
- **#2 `FeasibilityService.replacePerformances()`** — JPQL `DELETE` 직후 신규 `persist()` 전 영속성 컨텍스트 동기화 순서가 보장되지 않아 PK 충돌/유령 행 위험이 있다. DELETE 직후 `entityManager.flush()`를 **명시**하여 DELETE→INSERT 순서를 강제한다.
- **#1 `BudgetWorkService.applyItemRates()`** — 해당 연도 `BBUGTM` 전체를 메모리 로드 후 루프 `prior.delete()`로 soft-delete하던 선정리 로직을 `@Modifying` **벌크 UPDATE** 1회로 전환한다. **결정(spec §4.2, 2026-06-29 확정)**: 벌크 UPDATE + 감사컬럼(`LST_CHG_USID`/`LST_CHG_DTM`) 수동 세팅을 채택하고, 이 과도적 선정리 구간의 행별 `BbugtL` 감사로그 손실은 수용한다. `@Modifying(clearAutomatically = true, flushAutomatically = true)`로 1차 캐시 stale을 방지한다.

**Architecture**: Spring Boot 4.1 + Spring Data JPA + QueryDSL의 레이어드 아키텍처(`Controller → Service → Repository → Oracle`). 두 변경 모두 **Service ↔ Repository** 계층에 국한되며 컨트롤러·DTO·엔티티 스키마는 불변이다. `BbugtmRepository`에 `@Modifying` 벌크 메서드 1개를 신규 추가하고, `BudgetWorkService.applyItemRates()`의 선정리 2줄을 이 메서드 호출로 교체한다. `FeasibilityService.replacePerformances()`는 이미 본문 마지막에 `flush()`가 있으나 DELETE→persist 사이가 아니라 **persist 이후**에 위치한다(아래 §주의 참조) — DELETE 직후 flush를 추가한다.

**Tech Stack**:
- Java 25, Spring Boot 4.1.0, Spring Data JPA, QueryDSL 5.1.0
- 테스트: JUnit 5 + AssertJ + Mockito (단위), `@DataJpaTest` + 실 로컬 Oracle(`AbstractOracleRepositoryTest`, `@Tag("it")`) (DB-backed)
- 빌드: Gradle. CI 게이트 `./gradlew test`(태그 `it` 제외), 로컬 통합 `./gradlew integrationTest`(태그 `it` 포함, 로컬 Oracle 가동 필요, 미가동 시 `OracleAvailableCondition`이 자동 스킵)
- DB: Oracle 21c XE, `ITPAPP@127.0.0.1:11521/XEPDB1`, `CURRENT_SCHEMA=ITPOWN`, `ddl-auto=none`(읽기 전용 스키마), `@DataJpaTest` 트랜잭션 롤백

> **주의 — `replacePerformances` 현재 코드 상태**: 소스 확인 결과(`FeasibilityService.java` L173-194) 현재 메서드는 ① JPQL DELETE → ② 루프 `persist()` → ③ 본문 끝에서 `entityManager.flush()` 1회 순서다. 즉 **DELETE와 persist 사이에 flush가 없다.** spec #2의 의도는 "DELETE 직후 flush로 순서 보장"이므로, **DELETE 실행 직후**(persist 루프 전)에 `entityManager.flush()`를 추가한다. 본문 끝의 기존 flush(제약 위반 조기 표면화용)는 그대로 유지한다. 결과적으로 flush는 2회가 된다(DELETE 후 1회 + INSERT 후 1회). 둘 다 의미가 다르므로 유지한다.

---

## File Structure

| File | Create/Modify | Responsibility |
| --- | --- | --- |
| `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepository.java` | Modify | `@Modifying(clearAutomatically=true, flushAutomatically=true)` 벌크 soft-delete UPDATE 메서드 `softDeleteByBseYy(...)` 추가 |
| `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java` | Modify | `applyItemRates()`의 "전체 로드+루프 delete" 선정리(L283-284)를 `softDeleteByBseYy` 단일 벌크 UPDATE 호출로 교체. `import java.time.LocalDateTime` 추가, 변경자 사번 해석 |
| `it_backend/src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java` | Modify | `replacePerformances()`의 JPQL DELETE 직후 `entityManager.flush()` 명시 추가 |
| `it_backend/src/test/java/com/kdb/it/domain/budget/work/repository/BbugtmRepositoryIntegrationTest.java` | Create (Test) | DB-backed `@Tag("it")` 테스트 — 벌크 UPDATE가 해당 연도 미삭제 행을 `DEL_YN='Y'`로 전환하고 감사컬럼을 세팅하며 다른 연도/이미 삭제 행은 건드리지 않음을 검증 |
| `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java` | Modify (Test) | `applyItemRates()`가 선정리를 루프 delete가 아닌 `softDeleteByBseYy` 단일 호출로 수행함을 Mockito로 검증. 기존 `findByBseYyAndDelYn` 선정리 stub에 의존하던 테스트를 신규 시그니처로 갱신 |
| `it_backend/src/test/java/com/kdb/it/domain/council/service/FeasibilityServiceTest.java` | Modify (Test) | `replacePerformances` 경로 테스트에 DELETE 직후 flush 호출 검증(`InOrder`) 추가 |

---

## Task 1 — #1 `BbugtmRepository.softDeleteByBseYy` 벌크 UPDATE 메서드 (DB-backed)

**Files:**
- Create (Test): `it_backend/src/test/java/com/kdb/it/domain/budget/work/repository/BbugtmRepositoryIntegrationTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepository.java`

이 메서드는 벌크 UPDATE라 1차 캐시·DB 정합이 핵심이므로 **DB-backed 통합 테스트**(`@DataJpaTest` + 실 로컬 Oracle)로 검증한다. 픽스처는 롤백되는 트랜잭션 안에서 INSERT하므로 dev 데이터를 오염시키지 않는다.

- [ ] **Step 1: 실패하는 통합 테스트 작성 (RED)**

  신규 파일 `BbugtmRepositoryIntegrationTest.java`를 아래 전체 내용으로 생성한다. `AbstractOracleRepositoryTest`를 상속하면 `@DataJpaTest`(트랜잭션 롤백) + `@Tag("it")` + `OracleAvailableCondition`(미가동 시 스킵)이 자동 적용된다. `@DataJpaTest` 슬라이스는 `TestEntityManager`와 리포지토리 빈을 노출한다.

  픽스처 채번은 PK 충돌을 피하기 위해 테스트 전용 고정 연도(`"9999"`)와 고유 `bgNo`를 사용한다. 벌크 UPDATE는 `@Modifying`이므로 1차 캐시를 우회한다 — 검증은 `clearAutomatically=true`로 캐시를 비운 뒤 `TestEntityManager`로 재조회한다.

  ```java
  package com.kdb.it.domain.budget.work.repository;

  import static org.assertj.core.api.Assertions.assertThat;

  import com.kdb.it.domain.budget.work.entity.Bbugtm;
  import com.kdb.it.support.AbstractOracleRepositoryTest;
  import java.math.BigDecimal;
  import java.time.LocalDateTime;
  import java.util.List;
  import org.junit.jupiter.api.DisplayName;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;
  import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

  /**
   * BbugtmRepository 벌크 soft-delete UPDATE 통합 테스트 (P1 #1).
   *
   * <p>실 로컬 Oracle(ITPOWN)에 @DataJpaTest로 연결하며, 모든 픽스처 INSERT/UPDATE는
   * 테스트 종료 시 트랜잭션 롤백되어 dev 데이터에 영향을 주지 않는다. 벌크 UPDATE는
   * 1차 캐시를 우회하므로, clear 후 TestEntityManager로 재조회하여 DB 상태를 검증한다.</p>
   */
  @DisplayName("BbugtmRepository 벌크 soft-delete UPDATE (P1 #1)")
  class BbugtmRepositoryIntegrationTest extends AbstractOracleRepositoryTest {

      private static final String YEAR = "9999";
      private static final String OTHER_YEAR = "9998";

      @Autowired
      private BbugtmRepository bbugtmRepository;

      @Autowired
      private TestEntityManager em;

      /** 테스트 픽스처 행 생성 — 고유 bgNo/sno로 PK 충돌 방지. */
      private Bbugtm insertRow(String bgNo, int sno, String bseYy, String delYn) {
          Bbugtm row = Bbugtm.builder()
                  .bgNo(bgNo)
                  .sno(sno)
                  .bseYy(bseYy)
                  .fntTbNm("BITEMM")
                  .pkColNm("PK-" + bgNo)
                  .fntTbCrySno(sno)
                  .ioeC("001")
                  .bgDupAmt(BigDecimal.valueOf(1000))
                  .asgRt(100)
                  .delYn(delYn)
                  .build();
          return em.persist(row);
      }

      @Test
      @DisplayName("해당 연도의 미삭제 행만 DEL_YN='Y'로 전환하고 감사컬럼을 세팅한다")
      void softDeleteByBseYy_marksOnlyTargetYearActiveRows() {
          // Arrange: 대상연도 미삭제 2건 + 대상연도 이미삭제 1건 + 타연도 미삭제 1건
          Bbugtm active1 = insertRow("BG-T9999-001", 1, YEAR, "N");
          Bbugtm active2 = insertRow("BG-T9999-002", 2, YEAR, "N");
          Bbugtm alreadyDeleted = insertRow("BG-T9999-003", 3, YEAR, "Y");
          Bbugtm otherYear = insertRow("BG-T9998-001", 1, OTHER_YEAR, "N");
          em.flush();
          em.clear();

          LocalDateTime now = LocalDateTime.now();

          // Act
          int updated = bbugtmRepository.softDeleteByBseYy(YEAR, "TESTUSER", now);

          // Assert: 미삭제 2건만 영향
          assertThat(updated).isEqualTo(2);

          em.clear(); // 벌크 UPDATE 우회분 반영 — 1차 캐시 비우고 DB 재조회
          assertThat(em.find(Bbugtm.class, idOf(active1)).getDelYn()).isEqualTo("Y");
          assertThat(em.find(Bbugtm.class, idOf(active1)).getLstChgUsid()).isEqualTo("TESTUSER");
          assertThat(em.find(Bbugtm.class, idOf(active1)).getLstChgDtm()).isNotNull();
          assertThat(em.find(Bbugtm.class, idOf(active2)).getDelYn()).isEqualTo("Y");
          // 이미 삭제된 행과 타연도 행은 불변
          assertThat(em.find(Bbugtm.class, idOf(alreadyDeleted)).getLstChgUsid()).isNotEqualTo("TESTUSER");
          assertThat(em.find(Bbugtm.class, idOf(otherYear)).getDelYn()).isEqualTo("N");
      }

      @Test
      @DisplayName("대상 연도에 미삭제 행이 없으면 0을 반환한다")
      void softDeleteByBseYy_noActiveRows_returnsZero() {
          insertRow("BG-T9999-009", 9, YEAR, "Y");
          em.flush();
          em.clear();

          int updated = bbugtmRepository.softDeleteByBseYy(YEAR, "TESTUSER", LocalDateTime.now());

          assertThat(updated).isZero();
      }

      /** Bbugtm 복합키(BbugtmId) 생성 헬퍼. */
      private com.kdb.it.domain.budget.work.entity.BbugtmId idOf(Bbugtm row) {
          return new com.kdb.it.domain.budget.work.entity.BbugtmId(row.getBgNo(), row.getSno());
      }
  }
  ```

- [ ] **Step 2: 테스트 실행 → 컴파일 실패 확인 (RED)**

  ```bash
  cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.budget.work.repository.BbugtmRepositoryIntegrationTest"
  ```

  **예상 출력**: 컴파일 실패. `BbugtmRepository`에 `softDeleteByBseYy` 메서드가 없어 다음과 유사한 에러가 난다:
  ```
  > Task :compileTestJava FAILED
  ...BbugtmRepositoryIntegrationTest.java:NN: error: cannot find symbol
            int updated = bbugtmRepository.softDeleteByBseYy(YEAR, "TESTUSER", now);
                                          ^
    symbol:   method softDeleteByBseYy(String,String,LocalDateTime)
  BUILD FAILED
  ```

- [ ] **Step 3: `BbugtmRepository`에 벌크 UPDATE 메서드 구현 (GREEN)**

  `BbugtmRepository.java`의 import 블록에 `@Modifying`을 추가하고, `findByBseYyAndDelYn` 선언 바로 뒤(L45 이후)에 메서드를 추가한다.

  import 추가 — 기존:
  ```java
  import org.springframework.data.jpa.repository.JpaRepository;
  import org.springframework.data.jpa.repository.Query;
  import org.springframework.data.repository.query.Param;
  ```
  변경 후:
  ```java
  import org.springframework.data.jpa.repository.JpaRepository;
  import org.springframework.data.jpa.repository.Modifying;
  import org.springframework.data.jpa.repository.Query;
  import org.springframework.data.repository.query.Param;

  import java.time.LocalDateTime;
  ```
  (기존 `import java.util.List;`, `import java.util.Optional;`는 그대로 둔다.)

  `findByBseYyAndDelYn` 메서드 선언 직후에 추가:
  ```java
      /**
       * 해당 예산년도의 미삭제(DEL_YN='N') 편성예산 전체를 벌크 Soft Delete 한다.
       *
       * <p>사업별 편성률 재적용(applyItemRates)의 "선 정리 → 후 재삽입" 패턴에서,
       * 기존 "전체 메모리 로드 + 루프 delete()"를 단일 벌크 UPDATE로 대체합니다(P1 #1).
       * 변경자 사번(LST_CHG_USID)과 변경일시(LST_CHG_DTM)를 UPDATE 문에서 직접 세팅합니다.</p>
       *
       * <p><b>감사로그 트레이드오프</b>: 벌크 UPDATE는 JPA @PreUpdate→ChangeLogEntityListener를
       * 우회하므로 이 선정리 구간의 행별 BbugtL 변경로그는 생성되지 않습니다. 본 구간은 직후
       * 전량 재삽입되는 과도적 선정리라 행별 로그 가치가 낮다고 보고 손실을 수용합니다
       * (설계 §4.2 DECISION, 2026-06-29 확정).</p>
       *
       * <p>{@code clearAutomatically=true}: 벌크 후 영속성 컨텍스트 1차 캐시를 비워, 직후
       * 재삽입 로직이 stale 엔티티를 보지 않도록 합니다. {@code flushAutomatically=true}:
       * 선행 변경을 DB에 반영한 뒤 UPDATE를 실행합니다.</p>
       *
       * @param bgYy 예산년도 (BSE_YY)
       * @param usid 변경자 사번 (LST_CHG_USID에 기록)
       * @param now  변경일시 (LST_CHG_DTM에 기록)
       * @return 영향받은(soft-delete된) 행 수
       */
      @Modifying(clearAutomatically = true, flushAutomatically = true)
      @Query("UPDATE Bbugtm b SET b.delYn = 'Y', b.lstChgUsid = :usid, b.lstChgDtm = :now "
              + "WHERE b.bseYy = :bgYy AND b.delYn = 'N'")
      int softDeleteByBseYy(@Param("bgYy") String bgYy,
                            @Param("usid") String usid,
                            @Param("now") LocalDateTime now);
  ```

- [ ] **Step 4: 테스트 실행 → 통과 확인 (GREEN)**

  ```bash
  cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.budget.work.repository.BbugtmRepositoryIntegrationTest"
  ```

  **예상 출력** (로컬 Oracle 가동 시):
  ```
  BUILD SUCCESSFUL
  2 tests completed, 0 failed
  ```
  로컬 Oracle 미가동 시 `OracleAvailableCondition`이 두 테스트를 스킵하고 `BUILD SUCCESSFUL`(0 executed, skipped). 그 경우 로컬 Oracle을 기동(`127.0.0.1:11521` 응답)한 뒤 재실행하여 실제 GREEN을 확인한다.

- [ ] **Step 5: 커밋**

  ```bash
  cd it_backend && git add src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepository.java src/test/java/com/kdb/it/domain/budget/work/repository/BbugtmRepositoryIntegrationTest.java && git commit --no-gpg-sign -m "feat: BBUGTM 연도별 벌크 soft-delete UPDATE 메서드 추가 (P1 #1)

JPQL @Modifying(clearAutomatically/flushAutomatically) 벌크 UPDATE로
applyItemRates 선정리의 전체 로드+루프 delete를 대체할 softDeleteByBseYy 추가.
변경자/변경일시 감사컬럼을 UPDATE에서 직접 세팅. DB-backed 통합 테스트(@Tag it) 추가.
설계 §4.2 DECISION: 선정리 구간 행별 *L 로그 손실 수용."
  ```

---

## Task 2 — #1 `BudgetWorkService.applyItemRates()` 선정리를 벌크 UPDATE로 교체

**Files:**
- Modify (Test): `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`

서비스 로직 교체는 mocked-repo 단위 테스트로 검증한다(벌크 메서드 자체의 DB 동작은 Task 1에서 검증 완료). 핵심 검증: 선정리가 `findByBseYyAndDelYn(bgYy,"N")` + 루프 `delete()`가 아니라 `softDeleteByBseYy(...)` **단일 호출**로 수행된다.

현재 `applyItemRates()`는 변경자 사번 컨텍스트를 직접 사용하지 않는다. 벌크 UPDATE의 `LST_CHG_USID`는 JPA Auditing(`@LastModifiedBy`)이 자동 채우지 못하므로(벌크는 Auditing 우회) 서비스가 현재 인증 사용자 사번을 명시 전달해야 한다. 프로젝트 표준은 `JpaAuditConfig`의 `AuditorAware`다. 이를 주입해 현재 사번을 얻고, 없으면 `"SYSTEM"`으로 폴백한다.

- [ ] **Step 1: 실패하는 단위 테스트 작성 (RED)**

  먼저 기존 테스트가 신규 시그니처와 충돌하는 지점을 갱신한다. 기존 `applyItemRates_기존삭제와자본경상구분적용` 테스트(L712-756)는 `prior.delete()` 루프 동작(`assertThat(prior.getDelYn()).isEqualTo("Y")`)에 의존하므로, 벌크 메서드 호출 검증으로 대체한다. 아래 두 가지를 적용한다.

  (a) 클래스 상단 `@Mock` 목록에 `AuditorAware`를 추가한다. 기존:
  ```java
      @Mock private BudgetWorkQueryRepository budgetWorkQueryRepository;

      @InjectMocks
      private BudgetWorkService budgetWorkService;
  ```
  변경 후:
  ```java
      @Mock private BudgetWorkQueryRepository budgetWorkQueryRepository;
      @Mock private org.springframework.data.domain.AuditorAware<String> auditorAware;

      @InjectMocks
      private BudgetWorkService budgetWorkService;
  ```

  (b) 기존 `applyItemRates_기존삭제와자본경상구분적용` 테스트의 선정리 stub/검증을 갱신한다. 기존 본문에서:
  ```java
          Bbugtm prior = Bbugtm.builder().bgNo("BG-OLD").sno(1).delYn("N").build();
  ```
  줄을 삭제하고, 기존:
  ```java
          given(bbugtmRepository.findByBseYyAndDelYn("2026", "N")).willReturn(List.of(prior), List.of());
  ```
  를 다음으로 교체:
  ```java
          given(bbugtmRepository.softDeleteByBseYy(org.mockito.ArgumentMatchers.eq("2026"),
                  org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any())).willReturn(1);
          // getSummary 내부에서만 조회 (선정리는 더 이상 findByBseYyAndDelYn 사용 안 함)
          given(bbugtmRepository.findByBseYyAndDelYn("2026", "N")).willReturn(List.of());
  ```
  그리고 기존 검증:
  ```java
          assertThat(prior.getDelYn()).isEqualTo("Y");
  ```
  를 다음으로 교체:
  ```java
          verify(bbugtmRepository).softDeleteByBseYy(org.mockito.ArgumentMatchers.eq("2026"),
                  org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  ```

  다음으로, 선정리가 루프 delete가 아닌 단일 벌크 호출임을 명시 검증하는 **신규 테스트**를 클래스 끝(마지막 `}` 직전)에 추가한다:
  ```java
      @Test
      @DisplayName("applyItemRates: 선정리를 루프 delete가 아닌 벌크 UPDATE 1회로 수행한다 (P1 #1)")
      void applyItemRates_선정리_벌크UPDATE단일호출() {
          BudgetWorkDto.ItemApplyRequest request =
                  new BudgetWorkDto.ItemApplyRequest("2026", List.of());
          given(bbugtmRepository.generateBgMngNo("2026")).willReturn("BG-2026-0001");
          given(bbugtmRepository.softDeleteByBseYy(eq("2026"), any(), any())).willReturn(3);
          // getSummary 내부 호출용 mock
          given(bbugtmRepository.findByBseYyAndDelYn("2026", "N")).willReturn(List.of());
          given(codeRepository.findByCIdWithValidDate("DUP_IOE", null)).willReturn(List.of());
          mockEmptyDetailCodes();

          budgetWorkService.applyItemRates(request);

          // 선정리는 벌크 UPDATE 1회 — 루프 delete용 선정리 조회는 발생하지 않는다.
          verify(bbugtmRepository).softDeleteByBseYy(eq("2026"), any(), any());
          // getSummary가 부르는 findByBseYyAndDelYn는 정확히 1회 (선정리용 추가 호출 없음)
          Mockito.verify(bbugtmRepository, Mockito.times(1)).findByBseYyAndDelYn("2026", "N");
      }
  ```
  (`eq`/`any`는 파일 상단에 이미 static import 되어 있다: `org.mockito.ArgumentMatchers.eq`, `.any`. `verify`, `Mockito`, `given`도 import 되어 있다.)

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED)**

  ```bash
  cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest"
  ```

  **예상 출력**: 컴파일 실패 — `BudgetWorkService`/`BbugtmRepository`에 `softDeleteByBseYy` 호출 경로가 아직 없고 `auditorAware` 생성자 인자도 없어 `@InjectMocks`가 주입할 대상이 없다:
  ```
  > Task :compileTestJava FAILED
  ...error: cannot find symbol  method softDeleteByBseYy(...)   // 또는
  ...BudgetWorkServiceTest 의 신규 검증이 미정의 메서드 참조
  BUILD FAILED
  ```
  (만약 Task 1 머지 후 `softDeleteByBseYy`는 이미 존재하므로, 이 단계 실패는 `AuditorAware` 미주입 + 서비스가 여전히 루프 delete를 호출해 `softDeleteByBseYy` verify가 실패하는 형태가 된다. 어느 쪽이든 RED.)

- [ ] **Step 3: `BudgetWorkService` 구현 교체 (GREEN)**

  (a) import 블록에 `LocalDateTime`과 `AuditorAware`를 추가한다. 기존:
  ```java
  import java.math.BigDecimal;
  import java.math.RoundingMode;
  ```
  변경 후:
  ```java
  import java.math.BigDecimal;
  import java.math.RoundingMode;
  import java.time.LocalDateTime;
  ```
  그리고 Spring import 블록(기존 `import org.springframework.stereotype.Service;` 인접)에 추가:
  ```java
  import org.springframework.data.domain.AuditorAware;
  ```

  (b) 의존성 필드 추가 — 기존 생성자 주입 필드 마지막(`costRepository` 선언 뒤, L74 이후)에 추가:
  ```java
      /** 현재 인증 사용자 사번 제공 (벌크 UPDATE 감사컬럼 LST_CHG_USID 세팅용) */
      private final AuditorAware<String> auditorAware;
  ```
  (`@RequiredArgsConstructor`가 생성자에 자동 포함하므로 별도 생성자 수정 불필요. `JpaAuditConfig`가 `AuditorAware<String>` 빈을 제공한다.)

  (c) `applyItemRates()` 본문의 선정리 블록을 교체한다. 기존 (L283-284):
  ```java
          List<Bbugtm> priorBudgets = bbugtmRepository.findByBseYyAndDelYn(bgYy, "N");
          for (Bbugtm prior : priorBudgets) prior.delete();
  ```
  변경 후:
  ```java
          // 선정리: 전체 로드+루프 delete 대신 단일 벌크 UPDATE로 soft-delete (P1 #1).
          // 변경자 사번은 현재 인증 사용자(없으면 SYSTEM)를 UPDATE문에 직접 세팅한다.
          // 벌크는 @PreUpdate→ChangeLogEntityListener를 우회하므로 이 과도적 선정리 구간의
          // 행별 BbugtL 로그는 생성되지 않는다(설계 §4.2 DECISION, 손실 수용).
          String changerUsid = auditorAware.getCurrentAuditor().orElse("SYSTEM");
          bbugtmRepository.softDeleteByBseYy(bgYy, changerUsid, LocalDateTime.now());
  ```
  (이 블록 위의 기존 주석 `/* 해당 예산년도 BBUGTM 전체 Soft Delete ... */`은 그대로 유지한다.)

- [ ] **Step 4: 테스트 실행 → 통과 확인 (GREEN)**

  ```bash
  cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.service.BudgetWorkServiceTest"
  ```

  **예상 출력**:
  ```
  BUILD SUCCESSFUL
  ... tests completed, 0 failed
  ```
  (기존 다른 `applyItemRates_*` 테스트도 `softDeleteByBseYy` stub 부재로 깨질 수 있다. `applyItemRates_BCOSTM항목_save호출`/`applyItemRates_BPROJM사업_save호출`는 선정리 대상 0건 시나리오이므로, 두 테스트에 `given(bbugtmRepository.softDeleteByBseYy(eq("2026"), any(), any())).willReturn(0);`를 추가한다. 이들은 `@MockitoSettings(strictness = Strictness.LENIENT)`라 미사용 stub 경고는 없으나, 서비스가 호출하므로 stub이 필요하다. 갱신 후 재실행하여 GREEN 확인.)

- [ ] **Step 5: 컴파일 전체 확인 (GREEN)**

  ```bash
  cd it_backend && ./gradlew compileJava
  ```
  **예상 출력**: `BUILD SUCCESSFUL` (서비스 시그니처/주입 정합 확인).

- [ ] **Step 6: 커밋**

  ```bash
  cd it_backend && git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java && git commit --no-gpg-sign -m "refactor: applyItemRates 선정리를 벌크 soft-delete UPDATE로 전환 (P1 #1)

해당 연도 BBUGTM 전체 메모리 로드+루프 delete를 softDeleteByBseYy 단일 벌크 UPDATE로
교체. AuditorAware로 현재 사번을 LST_CHG_USID에 세팅(없으면 SYSTEM). 단위 테스트로
선정리 단일 호출 검증. 설계 §4.2 DECISION: 선정리 구간 행별 *L 로그 손실 수용."
  ```

---

## Task 3 — #2 `FeasibilityService.replacePerformances()` DELETE 직후 flush 명시

**Files:**
- Modify (Test): `it_backend/src/test/java/com/kdb/it/domain/council/service/FeasibilityServiceTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java`

순수 영속성 컨텍스트 순서 보장이라 mocked `EntityManager` 단위 테스트로 검증한다. 핵심: DELETE 실행(`executeUpdate`) 직후, 첫 `persist()` **이전**에 `flush()`가 호출되어야 한다 — `InOrder`로 순서를 강제한다.

- [ ] **Step 1: 실패하는 단위 테스트 작성 (RED)**

  기존 `FeasibilityServiceTest`의 `saveFeasibility_성과지표있음_교체저장` 테스트(L162-181)를 순서 검증으로 강화한다. 기존 본문 마지막 두 검증:
  ```java
          verify(deleteQuery).executeUpdate();
          verify(entityManager).persist(any(com.kdb.it.domain.council.entity.Bperfm.class));
  ```
  를 다음으로 교체한다 (DELETE→flush→persist 순서를 `InOrder`로 강제):
  ```java
          // P1 #2: DELETE 실행(executeUpdate) 직후, 신규 persist 이전에 flush가 호출되어야
          // DELETE→INSERT 순서가 보장된다(PK 충돌/유령 행 방지).
          org.mockito.InOrder inOrder = org.mockito.Mockito.inOrder(deleteQuery, entityManager);
          inOrder.verify(deleteQuery).executeUpdate();
          inOrder.verify(entityManager).flush();
          inOrder.verify(entityManager).persist(any(com.kdb.it.domain.council.entity.Bperfm.class));
  ```

- [ ] **Step 2: 테스트 실행 → 실패 확인 (RED)**

  ```bash
  cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.FeasibilityServiceTest"
  ```

  **예상 출력**: `saveFeasibility_성과지표있음_교체저장` 실패. 현재 코드는 DELETE→persist→(끝에서)flush 순서라, persist **이전** flush가 없어 `InOrder` 검증이 실패한다:
  ```
  FeasibilityServiceTest > saveFeasibility_성과지표있음_교체저장 FAILED
    org.mockito.exceptions.verification.VerificationInOrderFailure:
    Verification in order failure
    Wanted ... entityManager.flush(); ... but was not invoked in order
  ... tests completed, 1 failed
  BUILD FAILED
  ```

- [ ] **Step 3: `replacePerformances`에 DELETE 직후 flush 추가 (GREEN)**

  `FeasibilityService.java`의 `replacePerformances()`에서 JPQL DELETE 블록 직후, persist 루프 직전에 `flush()`를 추가한다. 기존 (L174-180):
  ```java
          // 기존 성과지표 전체 하드 삭제 (JPQL — persistence context 및 DB 동시 반영)
          entityManager.createQuery("DELETE FROM Bperfm b WHERE b.itPtlAsctId = :asctId")
                  .setParameter("asctId", asctId)
                  .executeUpdate();

          // 새 성과지표 INSERT (persist — @PrePersist 확실히 실행됨)
          for (CouncilDto.PerformanceRequest req : requests) {
  ```
  변경 후:
  ```java
          // 기존 성과지표 전체 하드 삭제 (JPQL — persistence context 및 DB 동시 반영)
          entityManager.createQuery("DELETE FROM Bperfm b WHERE b.itPtlAsctId = :asctId")
                  .setParameter("asctId", asctId)
                  .executeUpdate();

          // P1 #2: DELETE를 INSERT 이전에 DB로 flush — 영속성 컨텍스트 동기화 순서를 명시 강제하여
          // 동일 복합 PK 재삽입 시 DELETE가 INSERT 뒤로 밀려 발생하는 PK 충돌/유령 행을 방지한다.
          entityManager.flush();

          // 새 성과지표 INSERT (persist — @PrePersist 확실히 실행됨)
          for (CouncilDto.PerformanceRequest req : requests) {
  ```
  (메서드 끝의 기존 `entityManager.flush();`(제약 위반 조기 표면화용, L193)는 그대로 유지한다. 이로써 flush는 DELETE 후 1회 + INSERT 후 1회 = 총 2회 호출된다.)

- [ ] **Step 4: 테스트 실행 → 통과 확인 (GREEN)**

  ```bash
  cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.FeasibilityServiceTest"
  ```

  **예상 출력**:
  ```
  BUILD SUCCESSFUL
  ... tests completed, 0 failed
  ```

- [ ] **Step 5: 커밋**

  ```bash
  cd it_backend && git add src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java src/test/java/com/kdb/it/domain/council/service/FeasibilityServiceTest.java && git commit --no-gpg-sign -m "fix: replacePerformances DELETE 직후 flush 명시로 순서 보장 (P1 #2)

JPQL DELETE와 신규 persist 사이에 entityManager.flush()를 추가하여 DELETE→INSERT
동기화 순서를 강제. 동일 복합 PK 재삽입 시 PK 충돌/유령 행 방지. InOrder 단위 테스트 추가."
  ```

---

## Task 4 — 회귀 검증 및 마무리

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: 단위 테스트 전체 실행 (CI 게이트)**

  ```bash
  cd it_backend && ./gradlew test
  ```
  **예상 출력**: `BUILD SUCCESSFUL`, 0 failed. (`@Tag("it")` 통합 테스트는 제외됨.)

- [ ] **Step 2: 로컬 통합 테스트 실행 (로컬 Oracle 가동 시)**

  ```bash
  cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.budget.work.repository.BbugtmRepositoryIntegrationTest"
  ```
  **예상 출력**: `BUILD SUCCESSFUL`, 2 tests passed (Oracle 가동 시) 또는 skipped (미가동 시).

- [ ] **Step 3: 클린 빌드 확인**

  ```bash
  cd it_backend && ./gradlew clean build -x integrationTest
  ```
  **예상 출력**: `BUILD SUCCESSFUL`. (`build`는 `test`를 포함하나 통합 테스트는 별도 태스크라 자동 포함되지 않는다.)

> **브랜치 주의**: 모든 작업은 `it_backend` 자체 git 저장소에서 수행한다(루트 `C:\it`가 아님). 시작 전 `it_backend` 디렉토리에서 `git checkout main && git pull && git checkout -b feature/db-jpa-p1-integrity`로 신규 브랜치를 만든 뒤 Task 1~3을 순서대로 커밋한다. 푸시/PR은 사용자 요청 시에만 수행한다.

---

## Self-Review

**Spec 커버리지 (§4 P1 2건):**
- ✅ **#2 `FeasibilityService.replacePerformances()` flush 명시** — Task 3. DELETE 직후 `entityManager.flush()` 추가, `InOrder`로 DELETE→flush→persist 순서 검증. 메서드 끝의 기존 flush(제약 조기 표면화)는 유지.
- ✅ **#1 `BudgetWorkService.applyItemRates()` 벌크 UPDATE** — Task 1(리포지토리 메서드 + DB-backed 테스트) + Task 2(서비스 교체 + 단위 테스트). spec §4.2 DECISION 준수: `@Modifying(clearAutomatically=true, flushAutomatically=true)`, 감사컬럼(`lstChgUsid`/`lstChgDtm`) UPDATE문 수동 세팅, 행별 `BbugtL` 로그 손실 수용을 코드 주석·커밋 메시지에 명시.

**Placeholder 스캔:** 모든 코드 스텝이 실제 코드를 포함한다. TODO/FIXME/`...`/`<채워넣기>` 없음. 모든 `./gradlew` 명령에 예상 출력 명시. 모든 커밋은 `--no-gpg-sign` 포함.

**타입 정합성 검증:**
- `softDeleteByBseYy(String bgYy, String usid, LocalDateTime now) → int` — `@Modifying` 반환은 영향 행 수 `int`. 시그니처가 테스트 호출(Task 1 Step 1, Task 2 신규 테스트)·서비스 호출(Task 2 Step 3c)과 일치.
- `Bbugtm` 필드: `delYn`(String, BaseEntity), `bseYy`(String), `lstChgUsid`(String, BaseEntity), `lstChgDtm`(LocalDateTime, BaseEntity) — JPQL 프로퍼티명이 엔티티 실제 필드명과 일치(소스 확인 완료). `BbugtmId(String bgNo, Integer sno)`는 `@AllArgsConstructor` 보유 → `idOf` 헬퍼 정합.
- `auditorAware.getCurrentAuditor()` 반환 `Optional<String>` → `.orElse("SYSTEM")`은 `String`. `softDeleteByBseYy`의 `usid` 파라미터 타입과 일치.
- `@RequiredArgsConstructor` + `private final AuditorAware<String> auditorAware` → 생성자에 자동 포함. 테스트는 `@Mock AuditorAware<String>` + `@InjectMocks`로 주입(필드 추가 위치가 마지막이라 생성자 인자 순서 영향은 `@InjectMocks` 타입 매칭으로 흡수).
- `EntityManager.flush()` → `void`. `InOrder.verify(entityManager).flush()`와 정합. `Query.executeUpdate() → int`(기존 stub `willReturn(1)` 유지).

**리스크 점검:**
- 벌크 UPDATE의 감사로그 우회는 spec이 명시 수용한 사항(§4.2, §9 리스크 표) — 본 계획은 결정을 코드·주석·커밋에 반영만 한다.
- DB-backed 테스트는 `@DataJpaTest` 트랜잭션 롤백 + `ddl-auto=none`이라 dev 스키마/데이터 불변(spec §1.1 안전성). 테스트 전용 연도(`"9999"`/`"9998"`)로 실데이터 키 충돌도 회피.
- `find()` 재조회 전 `em.clear()`로 벌크 UPDATE의 1차 캐시 우회분을 정확히 검증(벌크 후 stale 캐시 함정 방지).
