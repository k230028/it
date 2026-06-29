# P2 — N+1 일괄조회 (DB/JPA 최적화) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans — execute steps strictly in order, run each command, confirm RED before GREEN, commit only after the run-to-pass passes. Do NOT skip the failing-test step.

**Goal**: `2026-06-29-db-jpa-optimization-design.md` §5(P2)의 사용자명/카운트 N+1 두 건을 제거한다.
- **#3 사용자명 N+1** (`EvaluationService`, `CommitteeService.buildUserMap`): per-row `findByEno()` 루프 → eno 집합 수집 후 `findByEnoIn(enos)` 1회 → `Map<eno,name>`. **코드 분석 결과 이미 구현되어 있음**(아래 Architecture 참조). 본 플랜은 회귀 방지 테스트로 현 동작을 고정한다.
- **#4 `CouncilService.completeCouncil` per-evaluator COUNT 루프** (L298–301): 평가자 N명에 대해 `evaluationRepository.findByItPtlAsctIdAndEnoAndDelYn(...)`를 행별 호출(N+1) → 단일 JPQL GROUP BY COUNT가 반환하는 `Map<eno,count>`로 1회 조회로 수렴. 신규 배치 리포지토리 메서드 추가.

**Architecture**:
- **#3는 선완료 상태**다(2026-06-29 코드 확인). `UserRepository.findByEnoIn(Collection<String>)`(L74)가 이미 존재하고, 세 서비스가 모두 동일 패턴으로 호출한다:
  - `EvaluationService.buildUserMapFromEvaluations()` (L256–263)
  - `CommitteeService.buildUserMap()` (L244–251)
  - `ScheduleService.buildUserMap()` (L381–388) — **레퍼런스 패턴**(스펙 §5 "ScheduleService가 동일 패턴으로 선완료").
  - 따라서 #3에는 **새 코드가 없고**, per-row `findByEno()` 루프가 재유입되지 않도록 잠그는 Mockito 회귀 테스트만 추가한다(Task 1).
- **#4가 본 플랜의 실질 구현**이다. `CouncilService.completeCouncil()`의 평가자별 6항목 제출 검증 루프(L298–301)가 평가자마다 `findByItPtlAsctIdAndEnoAndDelYn`를 1회씩 호출한다. 이를 협의회ID당 1회 GROUP BY COUNT로 대체한다:
  - 신규 메서드 `EvaluationRepository.countByEnoForCouncil(itPtlAsctId, delYn)` — JPQL `GROUP BY e.eno`로 `List<Object[]>{eno, count}` 반환. 서비스에서 `Map<String,Long>`로 접어 평가자별 미완료(6 미만)를 메모리에서 판정.
  - JPQL을 택하는 근거: `council` 패키지에 QueryDSL `*RepositoryImpl`가 없고(`EvaluationRepository`는 순수 `JpaRepository`), 동일 리포지토리의 기존 집계 메서드 `findAverageScoreByItem`도 `@Query`(native)로 작성됨 → 동일 스타일 유지가 가장 저위험. JPQL은 Hibernate 자동 매핑이라 §5.5.4 native 타입 quirk 헬퍼가 불필요(COUNT는 `Long`, eno는 `String`).
- **검증 하네스(P0, 기구축)**: DB-backed 테스트는 `com.kdb.it.support.AbstractOracleRepositoryTest`(`@DataJpaTest`, `@Tag("it")`, 로컬 Oracle `ITPAPP@127.0.0.1:11521/XEPDB1` CURRENT_SCHEMA=ITPOWN, `ddl-auto=none`, 트랜잭션 롤백) 상속. 실행 `./gradlew integrationTest`. 서비스 레벨 N+1 제거는 Mockito 단위 테스트(`@ExtendWith(MockitoExtension.class)`)로 "배치 메서드 1회 호출 + 행별 finder는 루프에서 미호출"을 검증. 신규 배치 리포지토리 메서드는 하네스로 DB-backed 검증.

**Tech Stack**: Spring Boot 4.1 / Java 25 / Spring Data JPA + QueryDSL 5.1 / JUnit5 + AssertJ + Mockito / Oracle (ITPOWN). 컨벤션(`it_backend/CLAUDE.md`): 한글 주석, 생성자 주입, 조회 `@Transactional(readOnly=true)`, AAA 테스트.

**Repo / Branch**: `it_backend`는 자체 git 레포다. `it_backend` `main`에서 `feature/db-jpa-p2-nplus1` 브랜치를 끊고 그 위에 커밋한다. 커밋은 모두 `--no-gpg-sign`.

---

## File Structure

| 파일 | 변경 | 설명 |
| --- | --- | --- |
| `src/main/java/com/kdb/it/domain/council/repository/EvaluationRepository.java` | 수정 | #4 배치 COUNT 메서드 `countByEnoForCouncil` 추가 (JPQL GROUP BY) |
| `src/main/java/com/kdb/it/domain/council/service/CouncilService.java` | 수정 | #4 `completeCouncil` per-evaluator 루프 → 배치 Map 기반 판정 |
| `src/test/java/com/kdb/it/domain/council/repository/EvaluationRepositoryBatchCountIT.java` | 신규 | #4 배치 COUNT DB-backed 통합 테스트 (`AbstractOracleRepositoryTest` 상속) |
| `src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java` | 수정 | #4 배치 COUNT 호출 검증 + per-row finder 미호출 회귀 테스트 추가 |
| `src/test/java/com/kdb/it/domain/council/service/EvaluationServiceTest.java` | 수정 | #3 `findByEnoIn` 1회 호출 + `findByEno` 루프 미호출 회귀 테스트 추가 |
| `src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java` | 수정 | #3 `buildUserMap` `findByEnoIn` 1회 호출 회귀 테스트 추가 |

> 모든 경로는 `it_backend/` 기준. 절대경로 prefix: `C:\it\it_backend\`.

---

## Task 0 — 브랜치 생성

**Files:** (git only)

- [ ] **Step 0.1** — `it_backend` main에서 작업 브랜치 생성.
  ```bash
  cd C:/it/it_backend && git checkout main && git pull --ff-only && git checkout -b feature/db-jpa-p2-nplus1
  ```
  기대: `Switched to a new branch 'feature/db-jpa-p2-nplus1'`. (`git pull`이 원격 미설정으로 실패하면 무시하고 `git checkout -b`만 수행.)

---

## Task 1 — #3 사용자명 N+1 회귀 잠금 (코드 변경 없음, 테스트만 추가)

> `findByEnoIn` 패턴은 이미 적용되어 있다(Architecture 참조). per-row `findByEno()` 루프가 재유입되지 않도록 Mockito로 잠근다. 프로덕션 코드는 손대지 않는다.

**Files:**
- `C:\it\it_backend\src\test\java\com\kdb\it\domain\council\service\EvaluationServiceTest.java`
- `C:\it\it_backend\src\test\java\com\kdb\it\domain\council\service\CommitteeServiceTest.java`

- [ ] **Step 1.1 (RED)** — `EvaluationServiceTest`에 회귀 테스트 추가. `getAllEvaluations`가 위원 N명이어도 `userRepository.findByEnoIn`을 정확히 1회 호출하고 `findByEno(String)`은 한 번도 호출하지 않음을 검증.

  먼저 `EvaluationServiceTest.java`를 읽어 기존 import/필드/`@InjectMocks` 구성을 확인한 뒤, 클래스 본문에 아래 테스트를 추가한다(필요 import는 기존 블록에 보강). `getAllEvaluations`는 `councilService.findActiveCouncil`, `evaluationRepository.findByItPtlAsctIdAndDelYn`, `evaluationRepository.findAverageScoreByItem`, `userRepository.findByEnoIn`을 사용하므로 모두 스텁한다.

  ```java
  @Test
  @DisplayName("getAllEvaluations: 위원이 여러 명이어도 findByEnoIn을 1회만 호출하고 findByEno 루프는 없다 (#3 N+1 회귀 잠금)")
  void getAllEvaluations_사용자명_배치조회_N플러스1없음() {
      // Arrange
      String asctId = "ASCT-2026-0001";
      Basctm council = mock(Basctm.class);
      given(councilService.findActiveCouncil(asctId)).willReturn(council);

      // 서로 다른 사번 2명 × 1항목씩 평가의견 — buildUserMapFromEvaluations가 사번 2개를 수집
      Bevalm e1 = Bevalm.builder().itPtlAsctId(asctId).eno("10001").itPtlCkgItmTc("01").quelRcrd(5).build();
      Bevalm e2 = Bevalm.builder().itPtlAsctId(asctId).eno("10002").itPtlCkgItmTc("01").quelRcrd(4).build();
      given(evaluationRepository.findByItPtlAsctIdAndDelYn(asctId, "N")).willReturn(List.of(e1, e2));
      given(evaluationRepository.findAverageScoreByItem(asctId, "N")).willReturn(List.of());
      given(userRepository.findByEnoIn(anyCollection())).willReturn(List.of(
              CuserI.builder().eno("10001").usrNm("홍길동").build(),
              CuserI.builder().eno("10002").usrNm("김철수").build()));

      // Act
      councilService.... // (이름 충돌 없음 — 아래 호출로 교체)
      CouncilDto.EvaluationSummaryResponse resp = evaluationService.getAllEvaluations(asctId);

      // Assert
      assertThat(resp.evaluations()).hasSize(2);
      verify(userRepository, times(1)).findByEnoIn(anyCollection());
      verify(userRepository, never()).findByEno(anyString());
  }
  ```

  > 주의: 위 스니펫의 `councilService....` 줄은 붙여넣기 사고 방지용 표식이다 — 실제 추가 시 그 줄은 삭제하고 `CouncilDto.EvaluationSummaryResponse resp = ...` 줄만 남긴다. `resp.evaluations()`의 정확한 접근자명은 `EvaluationSummaryResponse` 레코드 정의를 확인해 맞춘다(불확실하면 `assertThat(resp).isNotNull();`로 대체).

  필요 import(없으면 추가): `static org.mockito.ArgumentMatchers.anyCollection`, `anyString`, `static org.mockito.Mockito.never`, `times`, `verify`, `static org.mockito.Mockito.mock`, `com.kdb.it.common.iam.entity.CuserI`, `com.kdb.it.domain.council.entity.Bevalm`, `com.kdb.it.domain.council.entity.Basctm`, `com.kdb.it.domain.council.dto.CouncilDto`, `java.util.List`.

- [ ] **Step 1.2 (run RED — 실제로는 GREEN 예상)** — `findByEnoIn`은 이미 적용돼 있어 이 테스트는 바로 통과한다(회귀 잠금 테스트의 특성). 그래도 컴파일/통과를 확인한다.
  ```bash
  cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.EvaluationServiceTest"
  ```
  기대: `BUILD SUCCESSFUL`, 추가한 테스트 GREEN. 만약 `resp.evaluations()` 접근자명 불일치로 **컴파일 에러**가 나면 그것이 이 단계의 RED다 — 레코드 정의에 맞춰 접근자명 수정 후 재실행해 GREEN으로 만든다.

- [ ] **Step 1.3 (RED)** — `CommitteeServiceTest`에 `getCommittee`의 `buildUserMap` 배치 조회 회귀 테스트 추가. 먼저 `CommitteeServiceTest.java`를 읽어 mock 구성 확인 후 추가:
  ```java
  @Test
  @DisplayName("getCommittee: 위원이 여러 명이어도 findByEnoIn을 1회만 호출하고 findByEno 루프는 없다 (#3 N+1 회귀 잠금)")
  void getCommittee_사용자명_배치조회_N플러스1없음() {
      // Arrange
      String asctId = "ASCT-2026-0001";
      given(councilService.findActiveCouncil(asctId)).willReturn(mock(Basctm.class));
      Bcmmtm m1 = Bcmmtm.builder().itPtlAsctId(asctId).eno("10001").itPtlAsctMebTc("01").build();
      Bcmmtm m2 = Bcmmtm.builder().itPtlAsctId(asctId).eno("10002").itPtlAsctMebTc("02").build();
      given(committeeRepository.findByItPtlAsctIdAndDelYn(asctId, "N")).willReturn(List.of(m1, m2));
      given(userRepository.findByEnoIn(anyCollection())).willReturn(List.of(
              CuserI.builder().eno("10001").usrNm("홍길동").build(),
              CuserI.builder().eno("10002").usrNm("김철수").build()));

      // Act
      CouncilDto.CommitteeListResponse resp = committeeService.getCommittee(asctId);

      // Assert
      assertThat(resp).isNotNull();
      verify(userRepository, times(1)).findByEnoIn(anyCollection());
      verify(userRepository, never()).findByEno(anyString());
  }
  ```
  필요 import: 위 Step 1.1과 동일 계열 + `com.kdb.it.domain.council.entity.Bcmmtm`, `com.kdb.it.domain.council.dto.CouncilDto`. `committeeService.getCommittee`는 `councilService.findActiveCouncil`도 호출하므로 mock의 `CouncilService`에 스텁을 둔다. `Bcmmtm.builder()`가 `@SuperBuilder`로 노출되는지 확인(아니면 `mock(Bcmmtm.class)`로 `getEno`/`getItPtlAsctMebTc` 스텁).

- [ ] **Step 1.4 (run → GREEN)** —
  ```bash
  cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.CommitteeServiceTest"
  ```
  기대: `BUILD SUCCESSFUL`. 빌더 미노출 등 컴파일 에러가 RED면 `mock()` 방식으로 교체 후 GREEN.

- [ ] **Step 1.5 (commit)** —
  ```bash
  cd C:/it/it_backend && git add src/test/java/com/kdb/it/domain/council/service/EvaluationServiceTest.java src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java && git commit --no-gpg-sign -m "test: #3 사용자명 N+1 회귀 잠금 (findByEnoIn 1회·findByEno 루프 없음 검증)"
  ```

---

## Task 2 — #4 배치 COUNT 리포지토리 메서드 (DB-backed TDD)

**Files:**
- `C:\it\it_backend\src\main\java\com\kdb\it\domain\council\repository\EvaluationRepository.java`
- `C:\it\it_backend\src\test\java\com\kdb\it\domain\council\repository\EvaluationRepositoryBatchCountIT.java` (신규)

- [ ] **Step 2.1 (RED)** — 배치 COUNT DB-backed 통합 테스트 신규 작성. `AbstractOracleRepositoryTest` 상속(`@Tag("it")`, 로컬 Oracle, 트랜잭션 롤백). `EntityManager`로 동일 협의회ID에 두 평가자(eno A는 6항목, eno B는 4항목)를 INSERT한 뒤, 신규 `countByEnoForCouncil`이 `[A,6],[B,4]`를 반환하는지 검증. `Bevalm`은 복합키(itPtlAsctId, eno, itPtlCkgItmTc)이며 `@SuperBuilder`로 생성, `quelRcrd`만 채우면 충분(`ckgOpnn` nullable).

  ```java
  package com.kdb.it.domain.council.repository;

  import static org.assertj.core.api.Assertions.assertThat;

  import com.kdb.it.domain.council.entity.Bevalm;
  import com.kdb.it.support.AbstractOracleRepositoryTest;
  import jakarta.persistence.EntityManager;
  import java.util.List;
  import java.util.Map;
  import java.util.stream.Collectors;
  import org.junit.jupiter.api.DisplayName;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;

  /**
   * #4 평가자별 제출항목 수 배치 COUNT 통합 테스트.
   *
   * <p>per-evaluator COUNT 루프(N+1)를 대체하는 {@code countByEnoForCouncil}이
   * 협의회ID당 1회 GROUP BY로 평가자별 제출 항목 수를 정확히 집계함을 로컬 Oracle로 검증한다.
   * {@code @DataJpaTest} 트랜잭션 롤백으로 픽스처는 테스트 종료 시 사라진다.</p>
   */
  class EvaluationRepositoryBatchCountIT extends AbstractOracleRepositoryTest {

      @Autowired
      private EvaluationRepository evaluationRepository;

      @Autowired
      private EntityManager entityManager;

      private static final String ASCT_ID = "ASCT-TEST-NPLUS1";

      @Test
      @DisplayName("countByEnoForCouncil: 협의회ID당 1회 GROUP BY로 평가자별 제출 항목 수를 반환한다")
      void countByEnoForCouncil_평가자별_제출항목수_집계() {
          // Arrange — eno A는 6항목(완료), eno B는 4항목(미완료) 제출
          for (String itm : List.of("01", "02", "03", "04", "05", "06")) {
              entityManager.persist(Bevalm.builder()
                      .itPtlAsctId(ASCT_ID).eno("ENOA").itPtlCkgItmTc(itm).quelRcrd(5).build());
          }
          for (String itm : List.of("01", "02", "03", "04")) {
              entityManager.persist(Bevalm.builder()
                      .itPtlAsctId(ASCT_ID).eno("ENOB").itPtlCkgItmTc(itm).quelRcrd(4).build());
          }
          entityManager.flush();
          entityManager.clear();

          // Act
          Map<String, Long> countByEno = evaluationRepository.countByEnoForCouncil(ASCT_ID, "N").stream()
                  .collect(Collectors.toMap(r -> (String) r[0], r -> ((Number) r[1]).longValue()));

          // Assert
          assertThat(countByEno).containsEntry("ENOA", 6L).containsEntry("ENOB", 4L);
      }
  }
  ```

- [ ] **Step 2.2 (run RED)** — 메서드가 아직 없으므로 컴파일 실패가 RED다.
  ```bash
  cd C:/it/it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.council.repository.EvaluationRepositoryBatchCountIT"
  ```
  기대: 컴파일 에러 `cannot find symbol: method countByEnoForCouncil(...)`. (로컬 Oracle이 꺼져 있으면 컴파일은 되되 스킵될 수 있음 — 그 경우엔 Step 2.4에서 DB를 켠 뒤 실행.)

- [ ] **Step 2.3 (GREEN — 구현)** — `EvaluationRepository`에 배치 COUNT 메서드 추가. 기존 `findAverageScoreByItem`(native) 바로 아래에 JPQL `@Query`로 삽입. import는 이미 `org.springframework.data.jpa.repository.Query`, `Param`, `java.util.List`가 존재.

  ```java
      /**
       * 협의회별 평가자(ENO)별 제출 항목 수 집계 (#4 N+1 제거 — per-evaluator COUNT 루프 대체).
       *
       * <p>{@code completeCouncil}의 평가자별 6항목 제출 검증을 협의회ID당 1회 GROUP BY로 수렴시킨다.
       * 반환은 {@code Object[]{eno, count}} 목록이며, 서비스에서 {@code Map<eno, Long>}으로 접어 사용한다.
       * JPQL이므로 Hibernate가 {@code count(e)}를 {@code Long}, {@code e.eno}를 {@code String}으로
       * 자동 매핑한다(네이티브 타입 quirk 헬퍼 불필요).</p>
       *
       * @param itPtlAsctId 협의회ID
       * @param delYn       삭제여부 ('N')
       * @return {@code Object[]{eno, count}} 목록 (제출 이력이 있는 평가자만 포함)
       */
      @Query("SELECT e.eno, COUNT(e) FROM Bevalm e "
              + "WHERE e.itPtlAsctId = :itPtlAsctId AND e.delYn = :delYn "
              + "GROUP BY e.eno")
      List<Object[]> countByEnoForCouncil(@Param("itPtlAsctId") String itPtlAsctId, @Param("delYn") String delYn);
  ```

  > `delYn`은 `BaseEntity`의 필드명(`delYn`)으로 JPQL 경로 접근 가능. `Bevalm`의 사번 필드는 `eno`, 협의회ID는 `itPtlAsctId`(확인됨).

- [ ] **Step 2.4 (run GREEN)** — 로컬 Oracle 가동 상태에서 실행.
  ```bash
  cd C:/it/it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.council.repository.EvaluationRepositoryBatchCountIT"
  ```
  기대: `BUILD SUCCESSFUL`, 테스트 GREEN. (로컬 Oracle 미가동이면 `OracleAvailableCondition`이 스킵 — 그 경우 DB를 켠 뒤 재실행해 반드시 GREEN 확인. 스킵 상태로 다음 단계 진행 금지.)

- [ ] **Step 2.5 (commit)** —
  ```bash
  cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/council/repository/EvaluationRepository.java src/test/java/com/kdb/it/domain/council/repository/EvaluationRepositoryBatchCountIT.java && git commit --no-gpg-sign -m "feat: #4 평가자별 제출항목 수 배치 COUNT 메서드 추가 (GROUP BY, per-evaluator 루프 대체)"
  ```

---

## Task 3 — #4 `CouncilService.completeCouncil` 배치 적용 (서비스 N+1 제거)

**Files:**
- `C:\it\it_backend\src\main\java\com\kdb\it\domain\council\service\CouncilService.java`
- `C:\it\it_backend\src\test\java\com\kdb\it\domain\council\service\CouncilServiceTest.java`

- [ ] **Step 3.1 (RED)** — `CouncilServiceTest`에 "평가자 N명이어도 `countByEnoForCouncil`을 1회만 호출하고 per-evaluator `findByItPtlAsctIdAndEnoAndDelYn`은 루프에서 호출하지 않음"을 검증하는 테스트 추가. 기존 `completeCouncil_정상완료_RESULT_WRITING전이`를 참고하되 배치 메서드 스텁으로 교체. 클래스에 이미 `times`, `never`, `verify`, `then` import 존재.

  ```java
  @Test
  @DisplayName("completeCouncil: 평가자 N명이어도 배치 COUNT를 1회만 호출하고 평가자별 단건 조회 루프가 없다 (#4 N+1 제거)")
  void completeCouncil_평가완료검증_배치COUNT_N플러스1없음() {
      // Arrange
      Basctm council = mock(Basctm.class);
      given(council.getItPtlAsctPrgStsTc()).willReturn("07");
      given(councilRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(Optional.of(council));

      // 평가 의무 위원 2명(MAND 01, CALL 02) — 둘 다 6항목 제출 완료
      Bcmmtm e1 = mock(Bcmmtm.class);
      given(e1.getItPtlAsctMebTc()).willReturn("01");
      given(e1.getEno()).willReturn("10001");
      Bcmmtm e2 = mock(Bcmmtm.class);
      given(e2.getItPtlAsctMebTc()).willReturn("02");
      given(e2.getEno()).willReturn("10002");
      given(committeeRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(List.of(e1, e2));

      // 배치 COUNT 결과: 두 평가자 모두 6건 제출
      given(evaluationRepository.countByEnoForCouncil(ASCT_ID, "N")).willReturn(List.of(
              new Object[]{"10001", 6L},
              new Object[]{"10002", 6L}));

      // Act
      councilService.completeCouncil(ASCT_ID);

      // Assert
      verify(council).changeStatus("09");
      then(evaluationRepository).should(times(1)).countByEnoForCouncil(ASCT_ID, "N");
      then(evaluationRepository).should(never())
              .findByItPtlAsctIdAndEnoAndDelYn(anyString(), anyString(), anyString());
  }
  ```
  필요 import 확인: `anyString`은 이미 import됨(`ArgumentMatchers.anyString`). `Object[]` 카운트 타입은 `Long`으로 둔다(서비스가 `((Number) r[1]).longValue()`로 접으므로 `Long`/`BigDecimal` 무관하지만 Long으로 통일).

- [ ] **Step 3.2 (run RED)** — 서비스가 아직 `countByEnoForCouncil`을 호출하지 않으므로 `never().findByItPtlAsctIdAndEnoAndDelYn(...)` 검증이 실패(루프가 여전히 호출)하거나 `countByEnoForCouncil` 미사용으로 unnecessary-stubbing이 발생. 또한 기존 `completeCouncil_*` 테스트 일부가 per-evaluator finder 스텁을 쓰므로 함께 깨질 수 있다.
  ```bash
  cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.CouncilServiceTest"
  ```
  기대: 신규 테스트 RED(`findByItPtlAsctIdAndEnoAndDelYn`가 1회 이상 호출되어 `never()` 위반).

- [ ] **Step 3.3 (GREEN — 구현)** — `CouncilService.completeCouncil()`의 per-evaluator 루프(L297–306 구간)를 배치 Map 기반 판정으로 교체. `import java.util.Map;`는 이미 존재.

  교체 전(현재):
  ```java
          // 각 위원별 6개 항목 제출 완료 여부 확인
          long incompleteCount = evaluators.stream()
                  .filter(m -> evaluationRepository
                          .findByItPtlAsctIdAndEnoAndDelYn(asctId, m.getEno(), "N").size() < 6)
                  .count();

          if (incompleteCount > 0) {
              throw new IllegalStateException(
                      "아직 평가의견이 입력되지 않은 평가위원이 있습니다. (" + incompleteCount + "명 미완료)");
          }
  ```

  교체 후:
  ```java
          // 평가자별 제출 항목 수를 협의회ID당 1회 GROUP BY로 일괄 집계 (#4 N+1 제거).
          // 행별 findByItPtlAsctIdAndEnoAndDelYn 루프를 단일 배치 COUNT로 대체한다.
          Map<String, Long> submitCountByEno = evaluationRepository.countByEnoForCouncil(asctId, "N").stream()
                  .collect(Collectors.toMap(row -> (String) row[0], row -> ((Number) row[1]).longValue()));

          // 6개 항목 미만(미제출 포함=Map 누락 시 0)인 평가자 수 집계
          long incompleteCount = evaluators.stream()
                  .filter(m -> submitCountByEno.getOrDefault(m.getEno(), 0L) < 6)
                  .count();

          if (incompleteCount > 0) {
              throw new IllegalStateException(
                      "아직 평가의견이 입력되지 않은 평가위원이 있습니다. (" + incompleteCount + "명 미완료)");
          }
  ```
  `import java.util.stream.Collectors;`는 `CouncilService`에 이미 존재(확인됨). 동작 보존: 미제출 평가자는 Map에 키가 없어 `getOrDefault(...,0L)`로 0 처리되어 기존 `findBy...().size() < 6`과 동일한 미완료 판정.

- [ ] **Step 3.4 (기존 테스트 정합)** — 기존 `completeCouncil_*` 테스트들이 per-evaluator `findByItPtlAsctIdAndEnoAndDelYn` 스텁을 사용하므로 배치 스텁으로 전환한다. 대상 3건과 변경:
  - `completeCouncil_평가미완료위원있음_IllegalStateException발생`:
    `given(evaluationRepository.findByItPtlAsctIdAndEnoAndDelYn(ASCT_ID, "10002", "N")).willReturn(List.of());`
    → `given(evaluationRepository.countByEnoForCouncil(ASCT_ID, "N")).willReturn(List.of());` (또는 `List.of(new Object[]{"10002", 0L})`).
  - `completeCouncil_정상완료_RESULT_WRITING전이`:
    `findByItPtlAsctIdAndEnoAndDelYn(... "10002" ...).willReturn(6건)` → `given(evaluationRepository.countByEnoForCouncil(ASCT_ID, "N")).willReturn(List.of(new Object[]{"10002", 6L}));`.
  - `completeCouncil_EVALUATING상태_간사제외하고완료`:
    동일하게 `findByItPtlAsctIdAndEnoAndDelYn(... "10002" ...).willReturn(6건)` → `countByEnoForCouncil(ASCT_ID, "N").willReturn(List.of(new Object[]{"10002", 6L}));`. (간사 "10001"은 평가 의무 제외라 Map에 없어도 무방.)

  > `@MockitoSettings(strictness = Strictness.LENIENT)`가 클래스에 적용돼 있어 미사용 스텁이 즉시 실패하진 않지만, 정확성을 위해 위처럼 교체한다.

- [ ] **Step 3.5 (run GREEN)** —
  ```bash
  cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.CouncilServiceTest"
  ```
  기대: `BUILD SUCCESSFUL`, 신규 + 기존 `completeCouncil_*` 모두 GREEN.

- [ ] **Step 3.6 (commit)** —
  ```bash
  cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/council/service/CouncilService.java src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java && git commit --no-gpg-sign -m "refactor: #4 completeCouncil 평가완료 검증을 배치 COUNT Map으로 전환 (per-evaluator N+1 제거)"
  ```

---

## Task 4 — 전체 검증 & 마무리

**Files:** (verification only)

- [ ] **Step 4.1** — 컴파일 + 단위 테스트 전체(CI 게이트, `@Tag("it")` 제외) 재검증.
  ```bash
  cd C:/it/it_backend && ./gradlew clean test
  ```
  기대: `BUILD SUCCESSFUL`. council 패키지 단위 테스트 전부 GREEN.

- [ ] **Step 4.2** — 통합 테스트(로컬 Oracle, `@Tag("it")`) 실행. 로컬 Oracle 가동 필수.
  ```bash
  cd C:/it/it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.council.repository.EvaluationRepositoryBatchCountIT"
  ```
  기대: `BUILD SUCCESSFUL`, GREEN(스킵 아님). 스킵이면 DB 가동 후 재실행.

- [ ] **Step 4.3 (diff 리뷰)** — 변경 요약 확인.
  ```bash
  cd C:/it/it_backend && git diff main...HEAD --stat
  ```
  기대: 6개 파일(프로덕션 2: `EvaluationRepository.java`, `CouncilService.java` / 테스트 4) 변경.

---

## Self-Review

- [ ] **스펙 일치(#3)**: `EvaluationService`/`CommitteeService.buildUserMap`이 `findByEnoIn(enos)` 1회로 `Map<eno,name>`를 구성하는지 — 이미 적용 상태를 회귀 테스트로 잠금(Task 1). `ScheduleService` 패턴과 동일.
- [ ] **스펙 일치(#4)**: `CouncilService.completeCouncil`의 per-evaluator COUNT 루프가 단일 GROUP BY COUNT(`countByEnoForCouncil`)로 수렴, 결과를 `Map<eno,count>`로 선구성(Task 2·3).
- [ ] **동작 보존(#4)**: 미제출 평가자(Map 키 누락)는 `getOrDefault(...,0L)`로 0 처리 → 기존 `findBy...().size() < 6`과 동일한 미완료 판정. 간사(03) 제외 로직(`evaluators` 필터) 불변.
- [ ] **N+1 제거 증명**: 서비스 Mockito 테스트가 배치 메서드 `times(1)` + 행별 finder `never()`를 검증(Task 1·3). 평가자 수 증가와 무관하게 쿼리 1회로 수렴.
- [ ] **하네스 사용**: 신규 배치 리포지토리 메서드는 `AbstractOracleRepositoryTest` 상속 DB-backed 테스트로 GROUP BY 집계 정확성 검증(Task 2), `./gradlew integrationTest`로 실행.
- [ ] **컨벤션**: 한글 JavaDoc, 생성자 주입(기존), 조회 `@Transactional(readOnly=true)`(기존 클래스 레벨), AssertJ/JUnit5/Mockito AAA. native 타입 quirk 헬퍼 불필요(JPQL 자동 매핑).
- [ ] **저위험 선택 근거**: `council` 패키지에 QueryDSL `*RepositoryImpl` 없음 + 동일 리포지토리 기존 집계가 `@Query`라 JPQL `@Query` 채택. 신규 의존성/설정 없음.
- [ ] **git**: `it_backend` 자체 레포, `feature/db-jpa-p2-nplus1` 브랜치, 모든 커밋 `--no-gpg-sign`. 이 플랜 문서(`docs/superpowers/plans/...`)는 커밋하지 않음(루트 `C:\it` 레포 소관, 컨트롤러가 커밋).
- [ ] **완료 추적**: P2 완료 시 `TASK.md` #3·#4 행을 근거(`파일:라인`)와 함께 `TASK_DONE.md`로 이관(스펙 §10) — 별도 후속.
