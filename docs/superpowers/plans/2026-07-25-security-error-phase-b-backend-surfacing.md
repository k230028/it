# Phase B — 백엔드 오류 표면화 (ERR-08 +BE-13, ERR-09) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 계획 스냅샷 파싱 실패를 "정상 빈 결과"와 구분해 문맥 경고 + 응답 불완전 플래그로 표면화하고(ERR-08), 네이티브 DATE 변환 실패를 실제 NULL과 구분해 중앙 진단 로그로 관측 가능하게 한다(ERR-09) — DB·권한 예외는 계속 전파한다.

**Architecture:** ERR-08은 `PlanEvaluationService`의 3개 스냅샷 파싱 지점(사업 목록·전산업무비 건수·사업명)을 단일 `parseSnapshot` 헬퍼로 통합해 Jackson 예외만 좁게 잡아 `log.warn` + `snapshotIncomplete` 플래그를 세우고 부분 데이터로 계속 진행하도록 바꾼다. ERR-09는 `NativeRowMapper.toLd`에 static SLF4J 로거를 추가해 형식 불량 문자열·미지원 타입만 `log.warn`(원본값+타입)하고 실제 null/blank는 무경고로 유지한다. BE-13(기준 계획 단일 결정적 조인 조회)은 이미 `CouncilRepository.findBaselineReqDocNos` JPQL과 `CouncilBaselineLookupIt`로 구현·검증되어 있으므로, 본 계획에서는 통합 파싱 리팩터가 그 경로를 깨지 않는지 회귀 검증만 수행한다.

**Tech Stack:** Spring Boot, QueryDSL/JPQL/Native Oracle, Jackson, JUnit5 + Mockito + @Tag("it") 로컬 Oracle 통합 테스트

---

## 현재 상태 델타 (실제 소스 기준, 실행 전 반드시 숙지)

이 계획은 스펙 §4가 가정한 코드 상태보다 **앞서 있는 실제 소스**를 기준으로 작성되었다. 실제로 이미 반영된 것과 남은 델타를 구분한다.

**이미 반영됨 (수정 금지, 회귀만 확인):**

- `PlanEvaluationService`에 `@Slf4j` 존재 (`PlanEvaluationService.java:40`).
- BE-13 기준 계획 단일 결정적 조인 조회 — `CouncilRepository.findBaselineReqDocNos`(JPQL 조인, `ORDER BY c.fstEnrDtm DESC, c.itPtlAsctId DESC` + `Pageable`, `CouncilRepository.java:62-82`)로 구현됨. `findBaselinePlan`(`PlanEvaluationService.java:219-235`)이 이 메서드에 위임하며 **순회·catch-all-skip 없음**. 단위 테스트(`getPlanTargets_adjustmentUsesLatestMatchingBaseline` `PlanEvaluationServiceTest.java:190-244`, `getPlanTargets_baselineLookupFailurePropagates` `:246-269`)와 통합 테스트(`CouncilBaselineLookupIt.java` 동률 타이브레이크·현재계획/미완료 제외)로 검증됨.
- `DataCorruptionException` + `GlobalExceptionHandler`(`:98-102`, 500 매핑)는 `ProjectService`도 사용하므로 **클래스·핸들러는 유지**.

**남은 델타 (본 계획이 실제로 바꾸는 것):**

1. **ERR-08 표면화 전환**: 현재 파싱 실패는 광역 `catch (Exception)` 후 `DataCorruptionException`을 **던진다(500)**. 스펙 §4.1은 파싱 실패를 던지지 말고 `log.warn` + 응답 불완전 플래그 + 부분 데이터로 **degrade**하라고 요구한다. 따라서 3개 파싱 지점을 `catch (JsonProcessingException)` 좁은 catch + `snapshotIncomplete` 플래그로 바꾸고, 중복 파싱을 단일 헬퍼로 통합한다. RED 테스트는 "예외를 던진다"에서 "불완전 플래그를 세운다"로 뒤집힌다.
2. **ERR-08 DTO 플래그**: `PlanTargetsResponse`·`PlanResultSummaryResponse`에 `boolean snapshotIncomplete` record 컴포넌트 추가(미결항목 #3 확정: `List<String> warnings`가 아니라 단순 `boolean snapshotIncomplete`).
3. **ERR-09 toLd 중앙 진단**: `NativeRowMapper.toLd`는 여전히 침묵 null(파싱 실패 `NativeRowMapper.java:46-49`, 미지원 타입 `:52-53`, TODO 주석 잔존). 로거 추가 + 형식 불량/미지원만 `log.warn`, 실제 null/blank는 무경고. 형제 `toLdt`/`toLong`/`toInt`의 throw 계약은 그대로 둔다.
4. **프론트 최소 배너**: 백엔드 `snapshotIncomplete`를 소비하지 않으면 죽은 플래그이므로, `PlanCouncilTargets.vue`에 최소 배너를 붙인다. 광범위한 ERR-10 프론트 오류 상태 작업(ResultReviewProgress 오류 분류 등)은 **Phase C 계획**으로 명시적으로 이관한다.

**미결항목 확정 (스펙 §7):**

- #2 조인 컬럼: `Basctm.abusMngNo`(ABUS_MNG_NO, dbrTc='02'에서 계획관리번호를 저장) = `Bplanm.reqDocNo`(REQ_DOC_NO). 완료 계획협의회 = `itPtlAsctDbrTc='02' AND itPtlAsctPrgStsTc='13' AND delYn='N'`. 계획 필터 = `bseYy` + `itPtlPlnTpC='신규'` + `delYn='N'`, 현재 계획 제외. **이미 구현됨.**
- #3 불완전 신호 형태: `boolean snapshotIncomplete`로 확정.
- #4 조인 인덱스: EXPLAIN 확인 후 **조건부** Flyway만(Task 3), 기본 경로 아님.

**리포지토리 경계 (커밋 위치):** `it_backend`·`it_frontend`는 각각 **독립 중첩 git 저장소**(외부 `C:\it` 저장소가 추적하지 않음). 백엔드 커밋은 `cd C:/it/it_backend`에서, 프론트 커밋은 `cd C:/it/it_frontend`에서 수행한다.

**Gradle 실행 주의(메모리 함정):** 백그라운드 셸은 cwd를 상속하지 않으므로 **항상 `cd C:/it/it_backend &&`** 를 앞에 붙인다. `integrationTest`에서 `binary/output.bin` 파일락이 나면 `--no-daemon`으로 재시도한다. `clean`은 Jacoco 리포트도 지운다.

---

## File Structure

```
it_backend/
  src/main/java/com/kdb/it/
    common/util/NativeRowMapper.java            ← [Task 1] toLd 중앙 진단 로그 + static 로거
    domain/council/dto/CouncilDto.java          ← [Task 2] PlanTargetsResponse/PlanResultSummaryResponse에 snapshotIncomplete 추가
    domain/council/service/PlanEvaluationService.java
                                                ← [Task 2] parseSnapshot 통합, 파싱실패 degrade+플래그, DataCorruptionException 제거
    domain/council/repository/CouncilRepository.java  ← [Task 3] findBaselineReqDocNos (이미 존재, 회귀 확인만)
  src/test/java/com/kdb/it/
    common/util/NativeRowMapperTest.java        ← [Task 1] toLd 침묵 4건 → ListAppender warn 검증 + blank 무경고 추가
    domain/council/service/PlanEvaluationServiceTest.java
                                                ← [Task 2] invalidSnapshot 예외→플래그 재작성 + 플래그 단언 보강
    domain/council/repository/CouncilBaselineLookupIt.java  ← [Task 3] 기준계획 조인 IT (이미 존재, 회귀 확인만)
    domain/council/repository/CouncilProjectRowMappingIt.java          ← [Task 1] toLd 호출부 회귀
    domain/budget/document/repository/ServiceRequestDocDashboardMappingIt.java  ← [Task 1] toLd 호출부 회귀

it_frontend/
  app/types/council.ts                          ← [Task 4] PlanTargets/PlanResultSummary에 snapshotIncomplete 추가
  app/components/council/plan/PlanCouncilTargets.vue  ← [Task 4] 불완전 배너
```

---

## Task 1 — ERR-09: `NativeRowMapper.toLd` 중앙 진단 로그

DATE 변환의 형식 불량 문자열·미지원 타입만 `log.warn`(원본값+타입)하고, 실제 null/blank는 무경고 null로 유지한다. 형제 메서드(`toLdt`/`toLong`/`toInt`)의 throw 계약은 건드리지 않는다. 반환값은 여전히 null이므로 리스트/대시보드 read 복원력은 보존된다.

**Files:**

- `it_backend/src/test/java/com/kdb/it/common/util/NativeRowMapperTest.java` (기존 침묵 테스트 `:186-190`, `:193-197`, `:200-204`, `:213-217`; 무경고 기준 `:207-210`)
- `it_backend/src/main/java/com/kdb/it/common/util/NativeRowMapper.java` (`toLd` `:32-54`)

**Steps:**

- [ ] **(RED 테스트 작성)** `NativeRowMapperTest.java`에 Logback `ListAppender` 인프라를 추가하고, 침묵 4건을 warn 검증으로 바꾸고, blank 무경고 테스트를 추가한다. 아래 편집을 적용한다.

  파일 상단 import 블록에 추가:

  ```java
  import ch.qos.logback.classic.Level;
  import ch.qos.logback.classic.Logger;
  import ch.qos.logback.classic.spi.ILoggingEvent;
  import ch.qos.logback.core.read.ListAppender;
  import org.junit.jupiter.api.AfterEach;
  import org.junit.jupiter.api.BeforeEach;
  import org.slf4j.LoggerFactory;
  ```

  클래스 본문 최상단(`class NativeRowMapperTest {` 직후)에 appender 인프라 추가:

  ```java
      // NativeRowMapper 로거에 부착해 warn 이벤트를 포착하는 테스트용 appender.
      private ListAppender<ILoggingEvent> logAppender;
      private Logger mapperLogger;

      @BeforeEach
      void attachLogAppender() {
          mapperLogger = (Logger) LoggerFactory.getLogger(NativeRowMapper.class);
          logAppender = new ListAppender<>();
          logAppender.start();
          mapperLogger.addAppender(logAppender);
      }

      @AfterEach
      void detachLogAppender() {
          mapperLogger.detachAppender(logAppender);
      }
  ```

  `ToLdTests` 안의 침묵 4건을 아래로 교체한다(원본값·타입 포함 warn 단언):

  ```java
      @Test
      @DisplayName("경고: 8자리 미만 숫자 문자열이면 null 반환 + 형식 불량 warn")
      void toLd_String_7자리이하_null반환_경고() {
          assertThat(NativeRowMapper.toLd("2026070")).isNull();
          assertThat(logAppender.list)
                  .anySatisfy(
                          e -> {
                              assertThat(e.getLevel()).isEqualTo(Level.WARN);
                              assertThat(e.getFormattedMessage()).contains("2026070");
                          });
      }

      @Test
      @DisplayName("경고: 숫자가 전혀 없는 String이면 null 반환 + 형식 불량 warn")
      void toLd_String_숫자없음_null반환_경고() {
          assertThat(NativeRowMapper.toLd("abcdefgh")).isNull();
          assertThat(logAppender.list)
                  .anySatisfy(
                          e -> {
                              assertThat(e.getLevel()).isEqualTo(Level.WARN);
                              assertThat(e.getFormattedMessage()).contains("abcdefgh");
                          });
      }

      @Test
      @DisplayName("경고: 잘못된 날짜 숫자(99월)이면 null 반환 + 파싱 실패 warn")
      void toLd_String_잘못된날짜_null반환_경고() {
          assertThat(NativeRowMapper.toLd("20269901")).isNull();
          assertThat(logAppender.list)
                  .anySatisfy(
                          e -> {
                              assertThat(e.getLevel()).isEqualTo(Level.WARN);
                              assertThat(e.getFormattedMessage()).contains("20269901");
                          });
      }

      @Test
      @DisplayName("경고: 미지원 타입(Long)이면 null 반환 + 원본값·타입 warn")
      void toLd_지원없는타입_Long_null반환_경고() {
          assertThat(NativeRowMapper.toLd(20260701L)).isNull();
          assertThat(logAppender.list)
                  .anySatisfy(
                          e -> {
                              assertThat(e.getLevel()).isEqualTo(Level.WARN);
                              assertThat(e.getFormattedMessage()).contains("20260701");
                              assertThat(e.getFormattedMessage()).contains("Long");
                          });
      }
  ```

  `toLd_null_null반환`(`:207-210`)을 무경고 단언으로 보강하고, blank 무경고 테스트를 추가한다:

  ```java
      @Test
      @DisplayName("경계: null이면 null 반환 + 무경고")
      void toLd_null_null반환_무경고() {
          assertThat(NativeRowMapper.toLd(null)).isNull();
          assertThat(logAppender.list).isEmpty();
      }

      @Test
      @DisplayName("경계: 공백 문자열이면 실제 NULL로 간주해 null 반환 + 무경고")
      void toLd_blank_null반환_무경고() {
          assertThat(NativeRowMapper.toLd("   ")).isNull();
          assertThat(logAppender.list).isEmpty();
      }
  ```

- [ ] **(RED 실행)** `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.util.NativeRowMapperTest"` → **FAIL 예상** (아직 `toLd`가 로그를 남기지 않아 warn appender 이벤트가 비어 있음).

- [ ] **(GREEN 구현)** `NativeRowMapper.java`에 static 로거를 추가하고 `toLd`를 아래로 교체한다(형제 메서드·다른 메서드는 그대로).

  import 블록(현재 `java.time.LocalDateTime` 아래)에 추가:

  ```java
  import org.slf4j.Logger;
  import org.slf4j.LoggerFactory;
  ```

  클래스 본문(`private NativeRowMapper() {}` 위 또는 아래)에 로거 필드 추가:

  ```java
      /** DATE 변환 실패를 실제 NULL과 구분해 중앙에서 관측하기 위한 진단 로거(§5.5.4, ERR-09). */
      private static final Logger log = LoggerFactory.getLogger(NativeRowMapper.class);
  ```

  `toLd`(`:32-54`) 전체를 교체:

  ```java
      /**
       * DATE 컬럼 → LocalDate (java.sql.Date/LocalDate/LocalDateTime/String(yyyyMMdd) 혼용 대응).
       *
       * <p>실제 NULL·공백은 무경고로 {@code null}을 반환한다. 형식 불량 문자열·미지원 타입은 원본 값과 실제 클래스를 포함한 {@code
       * log.warn}으로 중앙 진단한 뒤 {@code null}을 반환한다(리스트·대시보드 read라 한 건 불량이 전체를 500 처리하지 않도록 예외를 던지지 않음).
       */
      public static LocalDate toLd(Object v) {
          if (v == null) return null;
          if (v instanceof LocalDate ld) return ld;
          if (v instanceof LocalDateTime ldt) return ldt.toLocalDate();
          if (v instanceof java.sql.Date d) return d.toLocalDate();
          if (v instanceof Timestamp ts) return ts.toLocalDateTime().toLocalDate();
          if (v instanceof String s) {
              if (s.isBlank()) return null; // 실제 NULL(공백) — 무경고
              String digits = s.replaceAll("[^0-9]", "");
              if (digits.length() >= 8) {
                  try {
                      return LocalDate.of(
                              Integer.parseInt(digits.substring(0, 4)),
                              Integer.parseInt(digits.substring(4, 6)),
                              Integer.parseInt(digits.substring(6, 8)));
                  } catch (NumberFormatException | java.time.DateTimeException e) {
                      log.warn(
                              "DATE 문자열 파싱 실패 — 원본='{}', 타입={}",
                              s,
                              v.getClass().getName(),
                              e);
                      return null;
                  }
              }
              log.warn(
                      "DATE 문자열 형식이 올바르지 않습니다 — 원본='{}', 타입={}", s, v.getClass().getName());
              return null;
          }
          log.warn("지원하지 않는 DATE 타입입니다 — 원본='{}', 타입={}", v, v.getClass().getName());
          return null;
      }
  ```

  > 참고: 기존 `:47`·`:52`의 TODO 주석 2개는 이 교체로 제거된다.

- [ ] **(GREEN 실행)** `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.util.NativeRowMapperTest"` → **PASS 예상**.

- [ ] **(호출부 회귀)** `cd C:/it/it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.council.repository.CouncilProjectRowMappingIt" --tests "com.kdb.it.domain.budget.document.repository.ServiceRequestDocDashboardMappingIt"` → **PASS 예상** (`toLd`는 반환값을 바꾸지 않으므로 `CouncilProjectRow`·`RecentReviewingRow` 매핑 동등성 회귀 없음; 로컬 Oracle 부재 시 `OracleAvailableCondition`으로 skip될 수 있으며 그 경우 Task 5 최종 게이트에서 재확인).

- [ ] **(커밋)** `cd C:/it/it_backend && git add src/main/java/com/kdb/it/common/util/NativeRowMapper.java src/test/java/com/kdb/it/common/util/NativeRowMapperTest.java && git commit -m "fix(ERR-09): NativeRowMapper.toLd 변환 실패를 실제 NULL과 구분하는 중앙 진단 로그"`

---

## Task 2 — ERR-08: 스냅샷 파싱 실패 vs 정상 빈 결과 구분 + 불완전 플래그 + 파싱 통합

파싱 실패(Jackson 예외)만 좁게 잡아 `log.warn` + `snapshotIncomplete` 플래그로 표면화하고 부분 데이터로 계속 진행한다. 빈/null 스냅샷은 무경고 정상 빈 결과. DB·권한 예외는 (파싱 try 밖에서 발생하므로) 계속 전파. 중복 스냅샷 파싱을 단일 `parseSnapshot` 헬퍼로 통합한다.

**Files:**

- `it_backend/src/test/java/com/kdb/it/domain/council/service/PlanEvaluationServiceTest.java` (`getPlanTargets_invalidSnapshotThrowsDataCorruption` `:271-290`, `getPlanTargets_emptySnapshotReturnsEmptyTargets` `:292-310`, `getPlanTargets_mergesProjectDetailsAndExcludesOperatingBusiness` `:143-188`, `buildResultSummary_escapesHtmlAndFallsBackToBusinessId` `:532-554`, import `:25`)
- `it_backend/src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java` (`PlanTargetsResponse` `:714-724`, `PlanResultSummaryResponse` `:707-711`)
- `it_backend/src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java` (imports `:16`, `getPlanTargets` `:83-141`, `parseSnapshotBusinesses` `:151-174`, `countCostDetails` `:184-195`, `findBaselinePlan` `:219-235`, `baselineBudgetByBusiness` `:238-251`, `SNAPSHOT_MAPPER` `:391`, `buildResultSummary` `:366-388`, `resolveBusinessNames` `:398-423`)

**Steps:**

- [ ] **(RED 테스트 작성)** `PlanEvaluationServiceTest.java`를 아래처럼 수정한다.

  `import com.kdb.it.exception.DataCorruptionException;`(`:25`)를 **제거**한다(더 이상 사용하지 않음).

  `getPlanTargets_invalidSnapshotThrowsDataCorruption`(`:271-290`)을 아래로 교체(예외 대신 불완전 플래그 + 부분 데이터):

  ```java
      @Test
      @DisplayName("getPlanTargets: 손상된 스냅샷은 예외 대신 불완전 플래그와 빈 대상을 반환한다")
      void getPlanTargets_invalidSnapshotFlagsIncomplete() {
          Basctm council = mock(Basctm.class);
          given(council.getAbusMngNo()).willReturn("PLN-BROKEN");
          given(councilService.findActiveCouncil(ASCT_ID)).willReturn(council);
          given(planService.getPlan("PLN-BROKEN"))
                  .willReturn(
                          PlanDto.DetailResponse.builder()
                                  .itPtlPlnTpC("조정")
                                  .redtConeInf("{broken")
                                  .build());

          CouncilDto.PlanTargetsResponse result = planEvaluationService.getPlanTargets(ASCT_ID);

          assertThat(result.snapshotIncomplete()).isTrue();
          assertThat(result.businesses()).isEmpty();
          assertThat(result.costCount()).isZero();
          // 사업 목록이 비어 상세 조회는 생략되고, DB·권한 예외는 던지지 않는다.
          verify(projectService, never()).getProjectsByIds(any());
      }
  ```

  `getPlanTargets_emptySnapshotReturnsEmptyTargets`(`:292-310`)의 단언에 무플래그 확인을 추가한다(`assertThat(result.costCount()).isZero();` 다음 줄):

  ```java
          assertThat(result.snapshotIncomplete()).isFalse();
  ```

  `getPlanTargets_mergesProjectDetailsAndExcludesOperatingBusiness`(`:143-188`)의 `assertThat(result.businesses())` 호출 직전에 무플래그 확인을 추가한다:

  ```java
          assertThat(result.snapshotIncomplete()).isFalse();
  ```

  `buildResultSummary_escapesHtmlAndFallsBackToBusinessId`(`:532-554`)의 마지막 단언 체인 뒤(`.contains("<td>-</td>");` 다음)에 불완전 플래그 확인을 추가한다:

  ```java
          assertThat(result.snapshotIncomplete()).isTrue();
  ```

  > 나머지 테스트(`getPlanTargets_adjustmentUsesLatestMatchingBaseline`, `getPlanTargets_baselineLookupFailurePropagates`, `buildResultSummary_rendersTable`)는 수정하지 않는다. 기준 계획 조회 예외 전파는 `findBaselinePlan` → `planService.getPlan`가 파싱 try 밖에서 호출되므로 통합 리팩터 후에도 유지된다.

- [ ] **(RED 실행)** `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.PlanEvaluationServiceTest"` → **FAIL 예상** (컴파일 실패: `result.snapshotIncomplete()` 미존재 + 손상 스냅샷이 아직 `DataCorruptionException`을 던짐).

- [ ] **(GREEN 구현 1/2 — DTO 플래그)** `CouncilDto.java`의 두 record에 `snapshotIncomplete`를 마지막 컴포넌트로 추가한다.

  `PlanResultSummaryResponse`(`:707-711`)를 교체:

  ```java
      /** 계획협의회 결과서 프리필 요약: 사업별 판정 표(HTML) + 구조화 판정 */
      public record PlanResultSummaryResponse(
              /** 사업별 판정 요약 표 (HTML, 결과서 본문 프리필용) */
              String summaryHtml,
              /** 사업별 최종 판정 */
              List<PlanBusinessVerdict> verdicts,
              /** 스냅샷 파싱 실패로 사업명 등 일부 해석이 누락되었는지 여부 (true면 프론트 배너 표면화) */
              boolean snapshotIncomplete) {}
  ```

  `PlanTargetsResponse`(`:714-724`)를 교체:

  ```java
      /** 계획협의회 심의 대상: 계획 요약 + 사업별 기본정보(스냅샷 예산 + 사업상세 개요/기간 병합) */
      public record PlanTargetsResponse(
              /** 계획관리번호 */
              String reqDocNo,
              /** 대상년도 */
              String bseYy,
              /** 계획구분 (신규/조정) */
              String itPtlPlnTpC,
              /** 심의 대상 정보화사업 목록 */
              List<PlanTargetBusiness> businesses,
              /** 전산업무비 참고 건수 (평가 대상 아님) */
              int costCount,
              /** 스냅샷 파싱 실패로 일부 심의 대상이 누락되었는지 여부 (true면 프론트 배너 표면화) */
              boolean snapshotIncomplete) {}
  ```

- [ ] **(GREEN 구현 2/2 — 서비스 통합)** `PlanEvaluationService.java`를 아래처럼 리팩터한다.

  import 교체 — `import com.kdb.it.exception.DataCorruptionException;`(`:16`)를 **삭제**하고, 대신 아래를 추가한다:

  ```java
  import com.fasterxml.jackson.core.JsonProcessingException;
  ```

  `getPlanTargets`(`:83-141`) 전체를 교체(통합 파싱 + 불완전 플래그 집계):

  ```java
      public CouncilDto.PlanTargetsResponse getPlanTargets(String asctId) {
          Basctm council = councilService.findActiveCouncil(asctId);
          String reqDocNo = council.getAbusMngNo();
          if (reqDocNo == null || reqDocNo.isBlank()) {
              throw new IllegalStateException("계획이 연결되지 않은 협의회입니다: " + asctId);
          }
          PlanDto.DetailResponse plan = planService.getPlan(reqDocNo);

          // 계획 스냅샷 1회 파싱(사업 목록·전산업무비 건수·손상 여부)
          ParsedSnapshot snapshot = parseSnapshot(plan.getRedtConeInf(), reqDocNo);
          boolean incomplete = snapshot.incomplete();
          List<JsonNode> snapBusinesses = snapshot.businesses();

          // 사업개요·시작/종료일자는 스냅샷에 없어 BPROJM 상세에서 보강
          List<String> prjMngNos =
                  snapBusinesses.stream()
                          .map(n -> textOf(n, "prjMngNo"))
                          .filter(s -> s != null && !s.isBlank())
                          .toList();
          Map<String, ProjectDto.Response> detailMap =
                  fetchProjectDetails(prjMngNos, plan.getBseYy());

          // 조정 협의회는 '직전 승인(수립) 계획'의 사업별 예산을 최초값으로 병합(예산 최초/조정 비교)
          Map<String, JsonNode> baselineByBiz = Map.of();
          if ("조정".equals(plan.getItPtlPlnTpC())) {
              PlanDto.DetailResponse baseline = findBaselinePlan(plan.getBseYy(), reqDocNo);
              if (baseline != null) {
                  ParsedSnapshot baseSnapshot =
                          parseSnapshot(baseline.getRedtConeInf(), baseline.getReqDocNo());
                  incomplete = incomplete || baseSnapshot.incomplete();
                  baselineByBiz = budgetByBusiness(baseSnapshot.businesses());
              }
          }

          List<CouncilDto.PlanTargetBusiness> businesses = new ArrayList<>();
          for (JsonNode n : snapBusinesses) {
              String id = textOf(n, "prjMngNo");
              if (id == null || id.isBlank()) {
                  continue;
              }
              ProjectDto.Response d = detailMap.get(id);
              JsonNode base = baselineByBiz.get(id);
              businesses.add(
                      new CouncilDto.PlanTargetBusiness(
                              id,
                              textOf(n, "abusNm"),
                              textOf(n, "pulDtt"),
                              textOf(n, "svnHdq"),
                              textOf(n, "svnDpmNm"),
                              d != null ? d.getAbusCone() : null,
                              d != null ? d.getSttDtm() : null,
                              d != null ? d.getEndDtm() : null,
                              decimalOf(n, "prjBg"),
                              decimalOf(n, "assetBg"),
                              decimalOf(n, "costBg"),
                              base != null ? decimalOf(base, "prjBg") : null,
                              base != null ? decimalOf(base, "assetBg") : null,
                              base != null ? decimalOf(base, "costBg") : null));
          }

          return new CouncilDto.PlanTargetsResponse(
                  reqDocNo,
                  plan.getBseYy(),
                  plan.getItPtlPlnTpC(),
                  businesses,
                  snapshot.costCount(),
                  incomplete);
      }
  ```

  기존 `parseSnapshotBusinesses`(`:151-174`)와 `countCostDetails`(`:184-195`) **두 메서드를 삭제**하고, 그 자리에 통합 파싱 결과 record + 단일 파서를 추가한다:

  ```java
      /**
       * 계획 스냅샷 1회 파싱 결과.
       *
       * @param businesses 경상(ornYn='Y') 제외 정보화사업 노드
       * @param costCount 전산업무비(costDetails) 건수
       * @param namesById prjSnapshots의 사업관리번호(prjMngNo) → 사업명(abusNm) 매핑
       * @param incomplete JSON 파싱 실패로 결과가 불완전한지 여부
       */
      private record ParsedSnapshot(
              List<JsonNode> businesses,
              int costCount,
              Map<String, String> namesById,
              boolean incomplete) {}

      /**
       * 계획 스냅샷(redtConeInf JSON)을 파싱해 사업 노드·전산업무비 건수·사업명 매핑을 한 번에 추출한다.
       *
       * <p>빈/null 스냅샷은 정상 빈 결과(incomplete=false, 무경고)로 처리한다. Jackson 파싱 실패만 좁게 잡아 문맥 경고를 남기고
       * incomplete=true인 빈 결과를 반환한다(부분 데이터로 계속 진행). DB·권한 등 다른 예외는 이 메서드 밖에서 발생하므로 그대로 전파된다.
       *
       * @param json 계획 스냅샷 JSON(redtConeInf)
       * @param reqDocNo 진단용 계획관리번호
       * @return 파싱 결과(불완전 여부 포함)
       */
      private ParsedSnapshot parseSnapshot(String json, String reqDocNo) {
          if (json == null || json.isBlank()) {
              return new ParsedSnapshot(List.of(), 0, Map.of(), false);
          }
          try {
              JsonNode root = SNAPSHOT_MAPPER.readTree(json);
              List<JsonNode> businesses = new ArrayList<>();
              Map<String, String> namesById = new LinkedHashMap<>();
              JsonNode arr =
                      root.has("prjSnapshots") ? root.get("prjSnapshots") : root.get("projects");
              if (arr != null && arr.isArray()) {
                  for (JsonNode n : arr) {
                      String id = textOf(n, "prjMngNo");
                      String nm = textOf(n, "abusNm");
                      if (id != null && nm != null) {
                          namesById.put(id, nm);
                      }
                      JsonNode orn = n.get("ornYn");
                      if (orn != null && "Y".equals(orn.asText())) {
                          continue; // 경상사업 제외 → 정보화사업만
                      }
                      businesses.add(n);
                  }
              }
              JsonNode costs = root.get("costDetails");
              int costCount = (costs != null && costs.isArray()) ? costs.size() : 0;
              return new ParsedSnapshot(businesses, costCount, namesById, false);
          } catch (JsonProcessingException e) {
              log.warn("계획 스냅샷 파싱 실패 — 부분 결과로 진행: reqDocNo={}", reqDocNo, e);
              return new ParsedSnapshot(List.of(), 0, Map.of(), true);
          }
      }
  ```

  기존 `baselineBudgetByBusiness`(`:238-251`)를 아래 `budgetByBusiness`로 교체(이미 파싱된 사업 노드를 받도록 변경, `PlanDto.DetailResponse` 재파싱 제거):

  ```java
      /** 사업 노드 목록을 사업관리번호(prjMngNo) → 예산 노드 맵으로 만든다(prjBg/assetBg/costBg 조회용). */
      private static Map<String, JsonNode> budgetByBusiness(List<JsonNode> businesses) {
          Map<String, JsonNode> map = new LinkedHashMap<>();
          for (JsonNode n : businesses) {
              String id = textOf(n, "prjMngNo");
              if (id != null && !id.isBlank()) {
                  map.put(id, n);
              }
          }
          return map;
      }
  ```

  > `findBaselinePlan`(`:219-235`)은 **변경하지 않는다**(BE-13 단일 조인 조회 유지). 호출부에서 `parseSnapshot(baseline...)`으로 파싱하도록 위에서 바꿨다.

  `buildResultSummary`(`:366-388`) 전체를 교체(사업명 해석을 통합 파서로, 불완전 플래그 전달):

  ```java
      public CouncilDto.PlanResultSummaryResponse buildResultSummary(String asctId) {
          Basctm council = councilService.findActiveCouncil(asctId);

          List<Bplevm> all = planEvaluationRepository.findByItPtlAsctIdAndDelYn(asctId, "N");
          List<CouncilDto.PlanBusinessVerdict> verdicts = aggregateVerdicts(all);

          // 사업명 매핑 (계획 스냅샷) — 파싱 실패는 불완전 플래그로 표면화하고 관리번호로 폴백
          ParsedSnapshot snapshot = resolveSnapshot(council.getAbusMngNo());
          Map<String, String> nameById = snapshot.namesById();

          // 사업별 유보 사유 수집 (유보 위원의 사유)
          Map<String, List<String>> reserveOpinions =
                  all.stream()
                          .filter(e -> "N".equals(e.getPprtYn()))
                          .filter(e -> e.getEvalOpnn() != null && !e.getEvalOpnn().isBlank())
                          .collect(
                                  Collectors.groupingBy(
                                          e -> e.getAbusMngNo(),
                                          Collectors.mapping(
                                                  e -> e.getEvalOpnn(), Collectors.toList())));

          return new CouncilDto.PlanResultSummaryResponse(
                  renderSummaryHtml(verdicts, nameById, reserveOpinions),
                  verdicts,
                  snapshot.incomplete());
      }
  ```

  기존 `resolveBusinessNames`(`:398-423`)를 아래 `resolveSnapshot`으로 교체(대상 계획을 조회·파싱; 광역 catch 제거, 통합 파서 재사용):

  ```java
      /**
       * 협의회의 대상 계획 스냅샷을 조회·파싱한다. 계획관리번호가 없으면 빈 결과(무경고). 계획 조회(getPlan) 예외는 전파, 스냅샷 파싱 실패는 {@link
       * #parseSnapshot}에서 불완전 플래그로 표면화한다.
       */
      private ParsedSnapshot resolveSnapshot(String reqDocNo) {
          if (reqDocNo == null || reqDocNo.isBlank()) {
              return new ParsedSnapshot(List.of(), 0, Map.of(), false);
          }
          PlanDto.DetailResponse plan = planService.getPlan(reqDocNo);
          return parseSnapshot(plan.getRedtConeInf(), reqDocNo);
      }
  ```

  > `SNAPSHOT_MAPPER`(`:391`), `textOf`(`:254`), `decimalOf`(`:260`), `renderSummaryHtml`, `escapeHtml`는 그대로 둔다. 위 교체로 `parseSnapshotBusinesses`·`countCostDetails`·`baselineBudgetByBusiness`·`resolveBusinessNames`는 모두 사라지고, `DataCorruptionException` 참조도 서비스에서 사라진다(클래스·핸들러 자체는 ProjectService가 계속 사용하므로 유지).

- [ ] **(GREEN 실행)** `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.PlanEvaluationServiceTest"` → **PASS 예상** (손상 스냅샷→플래그, 빈→무플래그, 조정 기준계획 결정적 조회·예외 전파 유지).

- [ ] **(커밋)** `cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java src/test/java/com/kdb/it/domain/council/service/PlanEvaluationServiceTest.java && git commit -m "fix(ERR-08): 스냅샷 파싱 실패를 정상 빈 결과와 구분해 불완전 플래그로 표면화하고 파싱 통합"`

---

## Task 3 — ERR-08/BE-13: 기준 계획 단일 결정적 조인 조회 회귀 검증 + EXPLAIN

BE-13(순회+`getPlan` N+1 및 동률 비결정성 제거)은 **이미 구현·검증되어 있다**. 이 태스크는 Task 2의 통합 파싱 리팩터가 기준 계획 경로(`findBaselinePlan` → `parseSnapshot(baseline)` → `budgetByBusiness`)를 깨지 않았는지 회귀 검증하고, 조인 쿼리 실행계획을 확인한다. 코드 변경은 (인덱스가 필요하다고 판명되지 않는 한) 없다.

**Files:**

- `it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java` (`findBaselineReqDocNos` `:62-82` — 이미 존재, 확인만)
- `it_backend/src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java` (`findBaselinePlan` `:219-235` — 순회·catch-all 없음 확인만)
- `it_backend/src/test/java/com/kdb/it/domain/council/repository/CouncilBaselineLookupIt.java` (동률 타이브레이크·제외 IT — 이미 존재)

**Steps:**

- [ ] **(구조 확인)** `findBaselinePlan`(`:219-235`)이 여전히 `councilRepository.findBaselineReqDocNos("02","13",bseYy,"신규",currentReqDocNo,PageRequest.of(0,1))` 단일 호출이며 순회/`catch`가 없음을 확인한다. `findBaselineReqDocNos`(`CouncilRepository.java:62-82`)의 `ORDER BY c.fstEnrDtm DESC, c.itPtlAsctId DESC` 결정적 tie-break를 확인한다.

- [ ] **(IT 실행 — 동률/제외)** `cd C:/it/it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.council.repository.CouncilBaselineLookupIt"` → **PASS 예상** (동률 등록시각에서 협의회ID 내림차순 단일 선택, 현재계획·미완료 제외). 파일락 시 `--no-daemon` 재시도.

- [ ] **(단위 회귀 — 조정 경로/예외 전파)** `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.PlanEvaluationServiceTest"` → **PASS 예상** (`getPlanTargets_adjustmentUsesLatestMatchingBaseline`가 조인 단건 조회로 최초예산 병합, `getPlanTargets_baselineLookupFailurePropagates`가 기준계획 DB 예외를 삼키지 않고 전파). Task 2에서 이미 통과했으나 기준계획 경로 회귀를 명시적으로 재확인한다.

- [ ] **(EXPLAIN 확인 — 조건부 인덱스 판단)** 로컬 Oracle에서 조인 술어의 실행계획을 확인한다. `sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1` 접속 후:

  ```sql
  EXPLAIN PLAN FOR
  SELECT c.ABUS_MNG_NO
    FROM TPRMPP_BASCTM c, TPRMPP_BPLANM p
   WHERE c.IT_PTL_ASCT_DBR_TC = '02'
     AND c.IT_PTL_ASCT_PRG_STS_TC = '13'
     AND c.DEL_YN = 'N'
     AND p.REQ_DOC_NO = c.ABUS_MNG_NO
     AND p.DEL_YN = 'N'
     AND p.BSE_YY = '2026'
     AND p.IT_PTL_PLN_TP_C = '신규'
     AND c.ABUS_MNG_NO <> 'PLN-DUMMY'
   ORDER BY c.FST_ENR_DTM DESC, c.IT_PTL_ASCT_ID DESC;
  SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
  ```

  - 계획협의회(dbrTc='02') 행 수가 작아 FULL SCAN이 저렴하면 **인덱스 생략**(YAGNI). CLAUDE.md 스펙 §1.2 비목표대로 기본 경로가 아니다.
  - `TPRMPP_BASCTM(IT_PTL_ASCT_DBR_TC, IT_PTL_ASCT_PRG_STS_TC, DEL_YN)` 조합 필터가 큰 테이블 FULL SCAN을 유발한다고 판명되면 **그때만** 새 Flyway 스크립트를 `../it_database/migrations`에 추가한다. 파일명 규칙 `V{YYYYMMDD_NNN}__AddCouncilBaselineLookupIndex.sql`, 인덱스명 규칙 `IX_TPRMPP_BASCTM_##`:

    ```sql
    -- 조건부: EXPLAIN이 큰 FULL SCAN을 보일 때만 추가한다.
    CREATE INDEX IX_TPRMPP_BASCTM_09
        ON TPRMPP_BASCTM (IT_PTL_ASCT_DBR_TC, IT_PTL_ASCT_PRG_STS_TC, DEL_YN, ABUS_MNG_NO);
    ```

    (`##` 번호는 기존 `IX_TPRMPP_BASCTM_*` 최대값+1로 확정한다. 적용 프로파일은 로컬만 자동, dev/prod는 DBA 수동.)

- [ ] **(커밋 — 조건부)** 인덱스 Flyway를 추가한 경우에만 커밋한다: `cd C:/it/it_backend && git add ../it_database/migrations/V*__AddCouncilBaselineLookupIndex.sql && git commit -m "perf(BE-13): 기준 계획 조인 조회 보조 인덱스 (EXPLAIN 근거)"`. 인덱스가 불필요하면 이 태스크는 검증만으로 종료(커밋 없음).

---

## Task 4 — 프론트 최소 표면화: `snapshotIncomplete` 배너

백엔드 `snapshotIncomplete` 플래그를 소비하는 최소 배너를 추가해 죽은 플래그를 방지한다. 심의 대상 화면(`PlanCouncilTargets.vue`)에 "일부 스냅샷을 해석하지 못했습니다" 배너를 노출한다. **광범위한 ERR-10 프론트 오류 상태 작업(ResultReviewProgress 오류 분류, 통화 컴포저블 통합, Tiptap 상태 등)은 Phase C 계획으로 이관한다** — 본 태스크는 Phase B 백엔드 플래그의 기능적 완결성만 담보한다.

**Files:**

- `it_frontend/app/types/council.ts` (`PlanTargets` `:430-438`, `PlanResultSummary` `:389-392`)
- `it_frontend/app/components/council/plan/PlanCouncilTargets.vue` (스크립트 `:24-28`, 템플릿 `:51-55`)

**Steps:**

- [ ] **(타입 추가)** `types/council.ts`의 `PlanTargets` 인터페이스(`:430-438`)에 필드를 추가한다(`costCount: number;` 다음 줄):

  ```ts
      /** 스냅샷 파싱 실패로 일부 심의 대상이 누락되었는지 여부 */
      snapshotIncomplete: boolean;
  ```

  같은 파일 `PlanResultSummary`(`:389-392`)에도 필드를 추가한다(`verdicts: PlanBusinessVerdict[];` 다음 줄):

  ```ts
      /** 스냅샷 파싱 실패로 사업명 등 일부 해석이 누락되었는지 여부 */
      snapshotIncomplete: boolean;
  ```

- [ ] **(배너 추가)** `PlanCouncilTargets.vue` 스크립트(`:28` `costCount` computed 아래)에 계산 속성을 추가한다:

  ```ts
  /** 스냅샷 일부 해석 실패 여부 (백엔드 표면화 플래그) */
  const snapshotIncomplete = computed(() => targets.value?.snapshotIncomplete ?? false);
  ```

  템플릿의 `<template v-else>`(`:51`) 바로 다음, `businesses.length === 0` 안내문(`:52-54`) **앞**에 배너를 추가한다(PrimeVue `Message` 자동 등록):

  ```vue
              <Message v-if="snapshotIncomplete" severity="warn" :closable="false" class="text-sm">
                  일부 스냅샷을 해석하지 못했습니다. 아래 목록·예산이 불완전할 수 있습니다.
              </Message>
  ```

- [ ] **(정적 분석·타입 검사)** `cd C:/it/it_frontend && npm run check` → **PASS 예상** (타입 검사 + ESLint). CSS 변경이 없으므로 `lint:css`는 생략. 컴포넌트 단위 테스트가 없으므로 로직 회귀는 백엔드 계약으로 담보한다.

- [ ] **(커밋)** `cd C:/it/it_frontend && git add app/types/council.ts app/components/council/plan/PlanCouncilTargets.vue && git commit -m "feat(ERR-08): 계획 협의회 스냅샷 불완전 플래그 배너 표면화"`

---

## Task 5 — 최종 게이트

QueryDSL/네이티브·공통 유틸 변경이 포함되므로 전체 clean 게이트를 실행한다(it_backend/CLAUDE.md §9).

**Steps:**

- [ ] **(백엔드 전체 게이트)** `cd C:/it/it_backend && ./gradlew clean test integrationTest` → **PASS 예상** (단위 전체 + `@Tag("it")` 로컬 Oracle 통합). 파일락 시 `--no-daemon`으로 재시도하고, 로컬 Oracle 부재로 IT가 skip되면 그 사실을 기록한다.
- [ ] **(프론트 게이트)** `cd C:/it/it_frontend && npm run check && npm test` → **PASS 예상**.
- [ ] **(검증 종료)** superpowers:verification-before-completion로 아래를 증거와 함께 확인한다:
  - 파싱 실패 주입 → `snapshotIncomplete=true` + 경고 로그 + 부분 데이터(예외 없음).
  - 미존재/빈 스냅샷 → 정상 빈 결과(무플래그, 무경고).
  - DB·권한 예외(기준계획 getPlan 등) → 전파(폴백 안 함).
  - 기준계획 동률 입력 → 결정적 단일 선택(협의회ID 내림차순).
  - `toLd` 형식 불량/미지원 타입 → null + warn(원본값·타입), 실제 null/blank → null 무경고, 형제 메서드 throw 계약 불변.
- [ ] **(TASK 이관 메모)** 완료 후 `TASK.md`의 ERR-08(+BE-13)·ERR-09 항목을 `TASK_DONE.md` 이관 대상으로 표시하고, 실측 테스트 수치는 CLAUDE.md가 아닌 `README.md` 변경 이력/`TASK.md` 메모에만 기록한다. ERR-10 프론트 잔여는 Phase C로 남긴다.

---

## Notes / 하드 요건 준수 요약

- **좁은 Jackson catch**: 파싱 3지점을 단일 `parseSnapshot`으로 통합하고 `catch (com.fasterxml.jackson.core.JsonProcessingException e)`만 사용(`SNAPSHOT_MAPPER.readTree(String)`의 선언 예외). `catch (Exception)` 광역 금지. `planService.getPlan`(DB·404)·권한 예외는 파싱 try 밖에서 발생하므로 전파.
- **DTO 플래그 명칭 고정**: `snapshotIncomplete`(backend record 컴포넌트 = frontend 인터페이스 필드). 리포지토리 메서드 명칭 `findBaselineReqDocNos` 유지(이미 존재).
- **불변식 보존**: `findBaselinePlan`·`findBaselineReqDocNos`·`SNAPSHOT_MAPPER`·`textOf`/`decimalOf`/`renderSummaryHtml`/`escapeHtml`는 변경하지 않는다. `DataCorruptionException` 클래스·`GlobalExceptionHandler` 매핑은 ProjectService가 계속 사용하므로 삭제하지 않는다.
- **한글 주석 규약**: 신규 주석·JavaDoc은 한글, public/service 메서드는 실패 조건 포함.
- **테스트 계약**: `NativeRowMapperTest`는 Logback `ListAppender` 기반 warn 단언(형제 throw 테스트와 대비되는 진단 계약), `PlanEvaluationServiceTest`는 예외→불완전 플래그로 뒤집힌 RED→GREEN.
