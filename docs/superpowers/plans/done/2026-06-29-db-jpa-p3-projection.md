# DB/JPA P3 — 프로젝션(오매핑 위험 우선) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:executing-plans`. Execute steps in order, one commit per step. Do not skip the run-to-fail step — it proves the test exercises the new path.

**Goal**: 협의회 18컬럼 native `Object[]`(#5, 최우선)와 기타 native `Object[]` 쿼리(#6)를 record DTO + 단일 `fromRow(Object[])` 팩토리로 중앙집중 매핑하고, `ProjectRepositoryImpl`/`CostRepositoryImpl` 목록 쿼리(#7)를 QueryDSL `Projections.constructor`로 경량화한다. 모든 변경은 **기존 경로와 값 동등성**을 로컬 Oracle 통합 테스트로 보장한다.

**Architecture**: 레이어드(Controller→Service→Repository→Oracle). native 결과 매핑은 §5.5.4 타입 헬퍼(`toStr`/`toLdt`/`toLd`/`Number` 변환)로 직접 캐스트를 금지하고, DTO 내부 `static fromRow(Object[])` 팩토리에 컬럼 매핑을 1곳으로 모은다. SQL 컬럼 순서 변경 시 SQL과 `fromRow`만 동기화하면 된다.

**Tech Stack**: Spring Boot 4.1.0 / Java 25 / Spring Data JPA + QueryDSL 5.1.0 / Oracle 21c XE(`ITPAPP@127.0.0.1:11521/XEPDB1`, CURRENT_SCHEMA=ITPOWN) / JUnit5 + AssertJ. 통합 테스트는 `@DataJpaTest` 기반 `com.kdb.it.support.AbstractOracleRepositoryTest`를 상속(`@Tag("it")`, `./gradlew integrationTest`).

**규약**: 한글 주석(루트 §4.1), DTO는 `record`(§5.3), native 타입 매핑은 §5.5.4 헬퍼 필수, QueryDSL은 §5.4. `it_backend`는 **독립 git repo**. 작업 브랜치 `feature/db-jpa-p3-projection`를 it_backend `main`에서 분기. 커밋은 `--no-gpg-sign`. 순서: **#5 → #6 → #7**.

---

## File Structure

| 파일 | 변경 | 비고 |
| --- | --- | --- |
| `src/main/java/com/kdb/it/domain/council/dto/CouncilProjectRow.java` | 신규 | #5 18컬럼 record DTO + `fromRow(Object[])` |
| `src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java` | 수정 | `findProjectsForCouncilAll`/`ByDepartment` 반환형 `List<Object[]>`→`List<CouncilProjectRow>` (단, native @Query는 `Object[]`만 가능 → §아래 결정) |
| `src/main/java/com/kdb/it/domain/council/service/CouncilService.java` | 수정 | `toListResponseFromRow(Object[])`→`toListResponseFromRow(CouncilProjectRow)` |
| `src/test/java/com/kdb/it/domain/council/repository/CouncilProjectRowMappingIt.java` | 신규 | #5 동등성 테스트 |
| `src/main/java/com/kdb/it/common/approval/dto/PendingApprovalRow.java` 등 #6 DTO 5종 | 신규 | #6 record DTO + `fromRow` (대상별) |
| `src/test/java/.../*MappingIt.java` (#6 대상별) | 신규 | #6 동등성 테스트 |
| `src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java` | 수정 | `ProjectListRow`(경량 목록 record) 추가 |
| `src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository*` | 수정 | `searchListByCondition` Projection 메서드 추가 |
| `src/main/java/com/kdb/it/domain/budget/cost/...` | 수정 | Cost 동일 패턴 |
| `src/test/java/.../ProjectListProjectionIt.java`·`CostListProjectionIt.java` | 신규 | #7 동등성 + 대용량 컬럼 미선택 검증 |

---

## ⚠️ 사전 결정 사항 (읽고 시작)

### 결정 A — native `@Query`는 record를 직접 반환 못 한다
Spring Data JPA native `@Query`는 인터페이스 프로젝션 또는 `Object[]`만 매핑 가능하며, **임의 record 생성자 매핑은 지원하지 않는다**(`@SqlResultSetMapping` 없이는). §6.2 spec도 `@SqlResultSetMapping`은 Oracle 타입 quirk로 제어가 약하니 **수동 팩토리를 표준**으로 한다고 명시. 따라서 #5/#6의 표준 패턴은:

- 리포지토리의 `@Query`는 **`List<Object[]>` 그대로 유지**(SQL 불변).
- **서비스(또는 호출부)에서 `rows.stream().map(DTO::fromRow).toList()`로 즉시 DTO 변환**.
- 즉 "Object[]를 서비스 전역에 흘리지 않고, 리포지토리 경계 직후 단일 `fromRow` 팩토리로 봉인"하는 것이 목표. **인덱스 캐스팅이 서비스 곳곳에 흩어지는 것**(현재 #5의 위험)을 1곳으로 모으는 것이 핵심 가치.

> 더 강한 봉인을 원하면 `CouncilRepository`에 default 메서드 `findProjectRowsForCouncilAll(...)`를 추가해 native `Object[]` 메서드를 `private`/`package` 위임 호출 후 `fromRow` 매핑까지 리포지토리 안에서 끝낼 수 있다. **본 계획은 후자(리포지토리 default 메서드 래핑)를 채택** — Object[]가 서비스로 새지 않는다.

### 결정 B — #7 목록 API는 현재 대용량 텍스트를 반환 중 (스코프 제약)
`ProjectService.searchProjectList` → `ProjectDto.Response.fromEntity`는 **현재 `abusCone`/`cpnSafCone`/`dgogPpoCone`(4000)/`plmDes`(4000)/`mnPrgCone`(2000)/`cstTpTc`(1000) 등 대용량 텍스트를 모두 응답에 포함**한다(`ProjectDto.java` L752-793 확인). 따라서 기존 `searchByCondition`(목록)을 그대로 프로젝션으로 바꾸면 **API 응답 필드가 줄어드는 breaking change**가 된다.

**결정**: 기존 `searchByCondition`(엔티티 반환)과 그 응답 계약은 **건드리지 않고**, **신규 경량 경로** `searchListByCondition(condition)` → `List<ProjectDto.ProjectListRow>`를 추가한다. 이 경량 DTO는 목록 화면에 실제 필요한 식별/요약 컬럼만 select하고 1000자+ 텍스트(`abusCone`/`cpnSafCone`/`dgogPpoCone`/`plmDes`/`mnPrgCone`/`cstTpTc`/`abusRngCone`/`sklTpTc`)를 **제외**한다. 신규 경량 목록 API로의 전환(프론트 연동)은 본 P3 범위 밖(별도 과제)으로 두고, 본 계획은 **경량 프로젝션 경로 제공 + 동등성/미선택 검증**까지를 "코드측 완료"로 한다.
> 근거: spec §6.3 "상세 API는 기존 전체 엔티티 조회 유지", "목록 API only". 기존 목록 API가 텍스트를 반환하므로, 안전하게 신규 경로를 병행 제공하는 것이 무파괴.

### 타입 헬퍼 (모든 신규 `fromRow`에서 재사용 — `RealtimeLogRepository` L93-106 원본)
각 DTO의 동반 `static` 헬퍼 또는 공통 유틸 `com.kdb.it.common.util.NativeRowMapper`로 둔다. **본 계획은 공통 유틸 1개를 신설**해 DRY를 지킨다(§coding-style DRY).

```java
package com.kdb.it.common.util;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 네이티브 쿼리 {@code Object[]} 결과의 환경별 타입 차이를 안전하게 변환한다(§5.5.4).
 *
 * <p>Oracle JDBC + Hibernate 6 조합에서 VARCHAR2(1)은 Character/String, TIMESTAMP는
 * Timestamp/LocalDateTime, DATE는 java.sql.Date/LocalDate/LocalDateTime/String(yyyyMMdd)으로
 * 혼용 반환된다. 직접 캐스트(예: {@code (String) r[i]})는 금지하고 본 헬퍼만 사용한다.</p>
 */
public final class NativeRowMapper {

    private NativeRowMapper() {
    }

    /** VARCHAR2(1) 포함 모든 문자열 컬럼 안전 변환(Character/String 혼용 대응). */
    public static String toStr(Object v) {
        return v == null ? null : v.toString();
    }

    /** TIMESTAMP 컬럼 → LocalDateTime (Timestamp/LocalDateTime 혼용 대응). */
    public static LocalDateTime toLdt(Object v) {
        if (v == null) return null;
        if (v instanceof LocalDateTime ldt) return ldt;
        if (v instanceof Timestamp ts) return ts.toLocalDateTime();
        throw new IllegalStateException("지원하지 않는 시각 타입: " + v.getClass());
    }

    /** DATE 컬럼 → LocalDate (java.sql.Date/LocalDate/LocalDateTime/String(yyyyMMdd) 혼용 대응). */
    public static LocalDate toLd(Object v) {
        if (v == null) return null;
        if (v instanceof LocalDate ld) return ld;
        if (v instanceof LocalDateTime ldt) return ldt.toLocalDate();
        if (v instanceof java.sql.Date d) return d.toLocalDate();
        if (v instanceof Timestamp ts) return ts.toLocalDateTime().toLocalDate();
        if (v instanceof String s) {
            String digits = s.replaceAll("[^0-9]", "");
            if (digits.length() >= 8) {
                try {
                    return LocalDate.of(
                            Integer.parseInt(digits.substring(0, 4)),
                            Integer.parseInt(digits.substring(4, 6)),
                            Integer.parseInt(digits.substring(6, 8)));
                } catch (NumberFormatException | java.time.DateTimeException e) {
                    return null; // 호출부가 필요 시 원본 로깅
                }
            }
        }
        return null;
    }

    /** NUMBER 컬럼 → Long (BigDecimal/Long/Integer 혼용 대응). null 허용. */
    public static Long toLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }

    /** NUMBER 컬럼 → int (null이면 기본값). */
    public static int toInt(Object v, int defaultValue) {
        return v == null ? defaultValue : ((Number) v).intValue();
    }
}
```

---

## Task 0 — 브랜치 분기 + 공통 헬퍼 유틸

**Files:** `src/main/java/com/kdb/it/common/util/NativeRowMapper.java` (신규)

- [ ] **Step 0.1** it_backend `main`에서 작업 브랜치 분기.
  ```bash
  cd c:/it/it_backend
  git fetch origin
  git switch main && git pull --ff-only
  git switch -c feature/db-jpa-p3-projection
  ```
- [ ] **Step 0.2** 위 §타입 헬퍼 코드 그대로 `NativeRowMapper.java`로 생성.
- [ ] **Step 0.3** 컴파일 확인.
  ```bash
  ./gradlew compileJava -q
  ```
  - 기대: BUILD SUCCESSFUL, 신규 클래스 컴파일.
- [ ] **Step 0.4** 커밋.
  ```bash
  git add -A && git commit --no-gpg-sign -m "feat(db-jpa): native Object[] 매핑 공통 헬퍼 NativeRowMapper 추가 (P3 #5/#6 토대)"
  ```

---

## Task 1 — #5 협의회 18컬럼 native Object[] → CouncilProjectRow (최우선)

SQL 컬럼 순서(`CouncilRepository.findProjectsForCouncilAll`, L151-183, `findProjectsForCouncilByDepartment` L203-236 — **둘이 SELECT 절 동일**):

| idx | SELECT alias | 원본 | 타입 | 현재 서비스 캐스트(L591-626) |
| :-: | --- | --- | --- | --- |
| 0 | abusMngNo | p.ABUS_MNG_NO | VARCHAR2 | `(String) row[0]` |
| 1 | sno | p.SNO | NUMBER | `((Number) row[1]).intValue()` |
| 2 | abusNm | p.ABUS_NM | VARCHAR2 | `(String) row[2]` |
| 3 | itPtlAsctId | a.IT_PTL_ASCT_ID | VARCHAR2 | `(String) row[3]` |
| 4 | itPtlAsctPrgStsTc | a.IT_PTL_ASCT_PRG_STS_TC | VARCHAR2 | `(String) row[4]` |
| 5 | itPtlAsctDbrTc | a.IT_PTL_ASCT_DBR_TC | VARCHAR2 | `(String) row[5]` |
| 6 | cnrcDt | a.CNRC_DT | DATE/String | `toLocalDate(row[6])` |
| 7 | cnrcSttTm | a.CNRC_STT_TM | VARCHAR2 | `(String) row[7]` |
| 8 | applied | CASE…END | NUMBER(1) | `((Number) row[8]).intValue()==1` |
| 9 | prjYy | p.BSE_YY | VARCHAR2 | `(String) row[9]` |
| 10 | prjTp | p.BZ_TP_C(=ABUS_PPO_CONE alias) | VARCHAR2 | `(String) row[10]` |
| 11 | svnDpm | p.SVN_DPM_C | VARCHAR2 | `(String) row[11]` |
| 12 | rqmBgAmt | NULL | (null) | row[12] 미사용(NULL) |
| 13 | sttDt | p.STT_DTM | DATE | `toLocalDate(row[13])` |
| 14 | endDt | p.END_DTM | DATE | `toLocalDate(row[14])` |
| 15 | itDpm | p.DVM_DPM_C | VARCHAR2 | `(String) row[15]` |
| 16 | abusCone | p.ABUS_CONE | VARCHAR2(1000) | `(String) row[16]` |
| 17 | csfHeldYn | a.CSF_HELD_YN | VARCHAR2(1) | `(String) row[17]` |

> 주의: 현재 서비스는 `(String) row[7]`, `(String) row[17]` 등 **직접 캐스트**를 쓰고 있어 §5.5.4 위반(VARCHAR2(1) Character 반환 시 CCE). `fromRow`에서 `toStr`로 교체하는 것이 본 작업의 부수 안전 개선이다. `applied`는 `toInt(row[8],0)==1`.

**Files:** `src/test/java/com/kdb/it/domain/council/repository/CouncilProjectRowMappingIt.java` (신규)

- [ ] **Step 1.1 (동등성 실패 테스트)** native `Object[]` 경로와 `CouncilProjectRow.fromRow` 경로가 **18컬럼 모두 동일**함을 검증하는 테스트 작성. `CouncilProjectRow`는 아직 없으므로 컴파일 실패해야 한다.
  ```java
  package com.kdb.it.domain.council.repository;

  import com.kdb.it.common.util.NativeRowMapper;
  import com.kdb.it.domain.council.dto.CouncilProjectRow;
  import com.kdb.it.support.AbstractOracleRepositoryTest;
  import org.junit.jupiter.api.DisplayName;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;

  import java.util.List;

  import static org.assertj.core.api.Assertions.assertThat;

  @DisplayName("#5 협의회 신청대상 18컬럼 native → CouncilProjectRow 매핑 동등성")
  class CouncilProjectRowMappingIt extends AbstractOracleRepositoryTest {

      // 협의회 상태코드: CouncilService PRJ_STS_COUNCIL_IN_PROGRESS('21' 진행) / TARGET('19' 대상)
      private static final String IN_PROGRESS = "21";
      private static final String PENDING = "19";

      @Autowired
      CouncilRepository councilRepository;

      @Test
      @DisplayName("findProjectsForCouncilAll: Object[] 경로와 DTO 경로 값이 컬럼별로 동일하다")
      void all_objectArray_equals_dto() {
          List<Object[]> rows = councilRepository.findProjectsForCouncilAll(IN_PROGRESS, PENDING);
          List<CouncilProjectRow> dtos = councilRepository.findProjectRowsForCouncilAll(IN_PROGRESS, PENDING);

          assertThat(dtos).hasSameSizeAs(rows);
          for (int i = 0; i < rows.size(); i++) {
              Object[] r = rows.get(i);
              CouncilProjectRow d = dtos.get(i);
              assertThat(d.abusMngNo()).isEqualTo(NativeRowMapper.toStr(r[0]));
              assertThat(d.sno()).isEqualTo(r[1] == null ? null : ((Number) r[1]).intValue());
              assertThat(d.abusNm()).isEqualTo(NativeRowMapper.toStr(r[2]));
              assertThat(d.itPtlAsctId()).isEqualTo(NativeRowMapper.toStr(r[3]));
              assertThat(d.itPtlAsctPrgStsTc()).isEqualTo(NativeRowMapper.toStr(r[4]));
              assertThat(d.itPtlAsctDbrTc()).isEqualTo(NativeRowMapper.toStr(r[5]));
              assertThat(d.cnrcDt()).isEqualTo(NativeRowMapper.toLd(r[6]));
              assertThat(d.cnrcSttTm()).isEqualTo(NativeRowMapper.toStr(r[7]));
              assertThat(d.applied()).isEqualTo(NativeRowMapper.toInt(r[8], 0) == 1);
              assertThat(d.prjYy()).isEqualTo(NativeRowMapper.toStr(r[9]));
              assertThat(d.prjTp()).isEqualTo(NativeRowMapper.toStr(r[10]));
              assertThat(d.svnDpm()).isEqualTo(NativeRowMapper.toStr(r[11]));
              assertThat(d.sttDt()).isEqualTo(NativeRowMapper.toLd(r[13]));
              assertThat(d.endDt()).isEqualTo(NativeRowMapper.toLd(r[14]));
              assertThat(d.itDpm()).isEqualTo(NativeRowMapper.toStr(r[15]));
              assertThat(d.abusCone()).isEqualTo(NativeRowMapper.toStr(r[16]));
              assertThat(d.csfHeldYn()).isEqualTo(NativeRowMapper.toStr(r[17]));
          }
      }
  }
  ```
- [ ] **Step 1.2 (run-to-fail)**
  ```bash
  ./gradlew integrationTest --tests "com.kdb.it.domain.council.repository.CouncilProjectRowMappingIt" -q
  ```
  - 기대: **컴파일 실패** (`CouncilProjectRow` / `findProjectRowsForCouncilAll` 미존재). 이것이 테스트가 새 경로를 강제함을 증명한다.
- [ ] **Step 1.3 (DTO + fromRow 구현)** `src/main/java/com/kdb/it/domain/council/dto/CouncilProjectRow.java` 생성. **18컬럼 전부**를 `fromRow` 한 곳에서 매핑.
  ```java
  package com.kdb.it.domain.council.dto;

  import com.kdb.it.common.util.NativeRowMapper;

  import java.time.LocalDate;

  /**
   * 협의회 신청대상 목록 native 쿼리(18컬럼) 결과를 봉인하는 DTO.
   *
   * <p>{@code CouncilRepository.findProjectsForCouncilAll/ByDepartment}의 {@code Object[]}를
   * {@link #fromRow(Object[])} 단일 팩토리로 매핑한다. SQL SELECT 컬럼 순서가 바뀌면
   * 본 팩토리의 인덱스만 함께 고치면 되며, 캐스팅이 서비스 곳곳에 흩어지지 않는다(§5.5.4).</p>
   *
   * <p>컬럼 순서(0-based): abusMngNo, sno, abusNm, itPtlAsctId, itPtlAsctPrgStsTc,
   * itPtlAsctDbrTc, cnrcDt, cnrcSttTm, applied(NUMBER 0/1), prjYy, prjTp, svnDpm,
   * rqmBgAmt(NULL·미사용), sttDt, endDt, itDpm, abusCone, csfHeldYn.</p>
   */
  public record CouncilProjectRow(
          String abusMngNo,
          Integer sno,
          String abusNm,
          String itPtlAsctId,
          String itPtlAsctPrgStsTc,
          String itPtlAsctDbrTc,
          LocalDate cnrcDt,
          String cnrcSttTm,
          boolean applied,
          String prjYy,
          String prjTp,
          String svnDpm,
          LocalDate sttDt,
          LocalDate endDt,
          String itDpm,
          String abusCone,
          String csfHeldYn
  ) {
      /** 컬럼 수 가드: SELECT 절 길이가 바뀌면 즉시 드러나도록 한다. */
      private static final int EXPECTED_COLUMNS = 18;

      /**
       * native {@code Object[]} 1행을 DTO로 매핑한다.
       *
       * @param r 18컬럼 native 결과 행(위 컬럼 순서 고정)
       * @return 매핑된 DTO
       * @throws IllegalStateException 컬럼 수가 18이 아니면(SQL/팩토리 불일치 조기 검출)
       */
      public static CouncilProjectRow fromRow(Object[] r) {
          if (r == null || r.length != EXPECTED_COLUMNS) {
              throw new IllegalStateException(
                      "협의회 신청대상 행 컬럼 수 불일치: 기대=" + EXPECTED_COLUMNS
                              + ", 실제=" + (r == null ? "null" : r.length));
          }
          return new CouncilProjectRow(
                  NativeRowMapper.toStr(r[0]),         // abusMngNo
                  r[1] == null ? null : ((Number) r[1]).intValue(), // sno
                  NativeRowMapper.toStr(r[2]),         // abusNm
                  NativeRowMapper.toStr(r[3]),         // itPtlAsctId
                  NativeRowMapper.toStr(r[4]),         // itPtlAsctPrgStsTc
                  NativeRowMapper.toStr(r[5]),         // itPtlAsctDbrTc
                  NativeRowMapper.toLd(r[6]),          // cnrcDt (DATE/String yyyyMMdd 혼용)
                  NativeRowMapper.toStr(r[7]),         // cnrcSttTm (VARCHAR2(1) 가능)
                  NativeRowMapper.toInt(r[8], 0) == 1, // applied (NUMBER 0/1)
                  NativeRowMapper.toStr(r[9]),         // prjYy
                  NativeRowMapper.toStr(r[10]),        // prjTp
                  NativeRowMapper.toStr(r[11]),        // svnDpm
                  // r[12] = rqmBgAmt(NULL) — 당해예산은 서비스가 품목 배치로 파생 산출하므로 미수용
                  NativeRowMapper.toLd(r[13]),         // sttDt
                  NativeRowMapper.toLd(r[14]),         // endDt
                  NativeRowMapper.toStr(r[15]),        // itDpm
                  NativeRowMapper.toStr(r[16]),        // abusCone
                  NativeRowMapper.toStr(r[17])         // csfHeldYn (VARCHAR2(1))
          );
      }
  }
  ```
- [ ] **Step 1.4 (리포지토리 래핑 — Object[] 봉인)** `CouncilRepository`에 default 메서드 추가(기존 native `Object[]` 메서드는 그대로 유지하되 서비스는 default를 사용). import에 `com.kdb.it.domain.council.dto.CouncilProjectRow`, `java.util.stream.Collectors` 불필요(`.toList()` 사용).
  ```java
  // CouncilRepository 인터페이스 내부 (기존 findProjectsForCouncilAll/ByDepartment 아래에 추가)

  /**
   * 관리자용 협의회 신청대상 목록을 DTO로 봉인 반환한다(#5).
   *
   * <p>native {@link #findProjectsForCouncilAll(String, String)}의 {@code Object[]}를
   * {@link CouncilProjectRow#fromRow(Object[])} 단일 팩토리로 매핑해, 인덱스 캐스팅이
   * 서비스로 새지 않게 한다.</p>
   */
  default List<CouncilProjectRow> findProjectRowsForCouncilAll(String stsInProgress, String stsPending) {
      return findProjectsForCouncilAll(stsInProgress, stsPending).stream()
              .map(CouncilProjectRow::fromRow)
              .toList();
  }

  /**
   * 일반사용자(부서)용 협의회 신청대상 목록을 DTO로 봉인 반환한다(#5).
   */
  default List<CouncilProjectRow> findProjectRowsForCouncilByDepartment(
          String svnDpm, String stsInProgress, String stsPending) {
      return findProjectsForCouncilByDepartment(svnDpm, stsInProgress, stsPending).stream()
              .map(CouncilProjectRow::fromRow)
              .toList();
  }
  ```
- [ ] **Step 1.5 (run-to-pass)**
  ```bash
  ./gradlew integrationTest --tests "com.kdb.it.domain.council.repository.CouncilProjectRowMappingIt" -q
  ```
  - 기대: BUILD SUCCESSFUL, 1 test passed. (로컬 Oracle 미가동이면 `OracleAvailableCondition`으로 skip — 이 경우 로컬 Oracle을 먼저 기동하고 재실행.)
- [ ] **Step 1.6 (서비스 전환)** `CouncilService.getCouncilList`에서 `findProjectsForCouncil*` → `findProjectRowsForCouncil*`로 교체하고, `toListResponseFromRow(Object[])` → `toListResponseFromRow(CouncilProjectRow)`로 시그니처 변경. 기존 `toLocalDate` 인라인 캐스트는 DTO가 이미 `LocalDate`이므로 제거. budgetMap 키 추출도 `row -> row.abusMngNo()`로 변경.
  ```java
  // getCouncilList() 관리자 분기
  List<CouncilProjectRow> rows = councilRepository.findProjectRowsForCouncilAll(
          PRJ_STS_COUNCIL_IN_PROGRESS, PRJ_STS_COUNCIL_TARGET);
  Map<String, BigDecimal> budgetMap = deriveCurrentYearBudgets(
          rows.stream().map(CouncilProjectRow::abusMngNo).toList());
  return rows.stream().map(row -> toListResponseFromRow(row, budgetMap)).toList();

  // getCouncilList() 일반사용자 분기
  List<CouncilProjectRow> rows = councilRepository.findProjectRowsForCouncilByDepartment(
          userDetails.getBbrC(), PRJ_STS_COUNCIL_IN_PROGRESS, PRJ_STS_COUNCIL_TARGET);
  Map<String, BigDecimal> budgetMap = deriveCurrentYearBudgets(
          rows.stream().map(CouncilProjectRow::abusMngNo).toList());
  return rows.stream().map(row -> toListResponseFromRow(row, budgetMap)).toList();
  ```
  ```java
  /**
   * 협의회 신청대상 DTO 행 → ListResponse 변환(관리자/일반사용자용).
   *
   * <p>당해예산({@code prjBg})은 native 컬럼이 NULL이므로 품목 배치 조회 결과({@code budgetMap})로 파생 산출한다.</p>
   */
  private CouncilDto.ListResponse toListResponseFromRow(CouncilProjectRow row,
          Map<String, BigDecimal> budgetMap) {
      return new CouncilDto.ListResponse(
              row.itPtlAsctId(),
              row.abusMngNo(),
              row.sno(),
              row.abusNm(),
              row.itPtlAsctPrgStsTc(),
              row.itPtlAsctDbrTc(),
              row.cnrcDt(),
              row.cnrcSttTm(),
              row.applied(),
              row.prjYy(),
              row.prjTp(),
              row.svnDpm(),
              budgetMap.get(row.abusMngNo()),
              row.sttDt(),
              row.endDt(),
              row.itDpm(),
              row.abusCone(),
              row.csfHeldYn());
  }
  ```
  > `toLocalDate` 헬퍼가 `getCouncilList` 외에서 더 이상 안 쓰이면 제거(미사용 경고 방지). 다른 곳에서 사용 중이면 유지. (제거 전 `grep -n "toLocalDate" CouncilService.java`로 확인.)
- [ ] **Step 1.7 (회귀 — 기존 단위 테스트 + 컴파일)** `CouncilServiceTest`(`findProjectsForCouncil` mock 사용)가 변경 시그니처에 맞게 깨지면 mock 대상을 `findProjectRowsForCouncil*`로 갱신.
  ```bash
  ./gradlew compileTestJava -q
  ./gradlew test --tests "com.kdb.it.domain.council.service.CouncilServiceTest" -q
  ```
  - 기대: 통과. (mock 반환을 `List<CouncilProjectRow>`로 바꿔야 할 수 있음 — 깨지면 fixture를 `CouncilProjectRow` 인스턴스로 교체.)
- [ ] **Step 1.8 (커밋)**
  ```bash
  git add -A && git commit --no-gpg-sign -m "feat(db-jpa): #5 협의회 18컬럼 native Object[] → CouncilProjectRow.fromRow 봉인 + 동등성 IT"
  ```

---

## Task 2 — #6 기타 native Object[] → DTO + fromRow

대상 native `List<Object[]>` 쿼리(읽은 코드 기준 실재 목록):

| 리포지토리 | 메서드 | 컬럼 | 비고 |
| --- | --- | --- | --- |
| `ApplicationRepository` | `findMonthlyTrendByBbrC` | [0]=MONTH(VARCHAR), [1]=CNT(NUMBER) | 월별 추이 |
| `ApplicationRepository` | `findPendingListByEno` | [0]=APF_DCM_NO, [1]=DCD_REQ_TTL, [2]=USR_NM, [3]=RQS_DT(String) | 대기 3건 |
| `ServiceRequestDocRepository` | `findMonthlyTrendByBbrC` | [0]=MONTH, [1]=CNT | 월별 추이 |
| `ServiceRequestDocRepository` | `findRecentReviewingByBbrC` | [0]=DOC_MNG_NO,[1]=REQ_TTL,[2]=USR_NM,[3]=CREATED_AT(String),[4]=RVW_FSG_TLM_DT(DATE) | 검토중 3건 |
| `LoginHistoryRepository` | `findDailyLoginStats` | [0]=LGN_DATE(String),[1]=CNT(NUMBER) | 일별 통계 |
| `EvaluationRepository` | `findAverageScoreByItem` | [0]=IT_PTL_CKG_ITM_TC,[1]=AVG(QUEL_RCRD)(NUMBER) | 항목평균 |

각 대상별로 (a) record DTO + `fromRow`, (b) 리포지토리 default 래핑 메서드, (c) 동등성 IT, (d) 호출 서비스 전환. **메서드별 1커밋** 권장(6커밋). 패턴은 #5와 동일하므로 아래는 대표 1건(`EvaluationRepository.findAverageScoreByItem`)을 풀 코드로 보이고, 나머지는 동일 절차를 반복한다.

> **호출부 확인 필수**: 각 메서드 전환 전 `grep -rn "findMonthlyTrendByBbrC\|findPendingListByEno\|findRecentReviewingByBbrC\|findDailyLoginStats\|findAverageScoreByItem" src/main/java`로 현재 `Object[]` 인덱스 캐스팅 호출부를 찾아 DTO 접근자로 바꾼다. (동등성 IT는 캐스팅 의미를 그대로 옮긴다.)

**Files (대표):** `src/main/java/com/kdb/it/domain/council/dto/EvaluationItemAvgRow.java`, `src/test/java/com/kdb/it/domain/council/repository/EvaluationItemAvgMappingIt.java`

- [ ] **Step 2.1 (대표 실패 테스트)** `findAverageScoreByItem` Object[]↔DTO 동등성.
  ```java
  package com.kdb.it.domain.council.repository;

  import com.kdb.it.domain.council.dto.EvaluationItemAvgRow;
  import com.kdb.it.support.AbstractOracleRepositoryTest;
  import org.junit.jupiter.api.DisplayName;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;

  import java.math.BigDecimal;
  import java.util.List;

  import static org.assertj.core.api.Assertions.assertThat;

  @DisplayName("#6 평가 항목평균 native → EvaluationItemAvgRow 매핑 동등성")
  class EvaluationItemAvgMappingIt extends AbstractOracleRepositoryTest {

      @Autowired
      EvaluationRepository evaluationRepository;

      @Test
      @DisplayName("존재하는 협의회ID에 대해 Object[]와 DTO 결과가 일치한다(데이터 없으면 둘 다 빈 목록)")
      void avg_objectArray_equals_dto() {
          // 결정적: 존재하지 않는 ID는 항상 빈 목록 → 두 경로 모두 empty로 동등
          String asctId = "ASCT-0000-0000";
          List<Object[]> rows = evaluationRepository.findAverageScoreByItem(asctId, "N");
          List<EvaluationItemAvgRow> dtos = evaluationRepository.findAvgRowsByItem(asctId, "N");
          assertThat(dtos).hasSameSizeAs(rows);
          for (int i = 0; i < rows.size(); i++) {
              Object[] r = rows.get(i);
              EvaluationItemAvgRow d = dtos.get(i);
              assertThat(d.itPtlCkgItmTc()).isEqualTo(r[0] == null ? null : r[0].toString());
              assertThat(d.avgScore()).isEqualByComparingTo(
                      r[1] == null ? null : new BigDecimal(r[1].toString()));
          }
      }
  }
  ```
- [ ] **Step 2.2 (run-to-fail)**
  ```bash
  ./gradlew integrationTest --tests "com.kdb.it.domain.council.repository.EvaluationItemAvgMappingIt" -q
  ```
  - 기대: 컴파일 실패(`EvaluationItemAvgRow`/`findAvgRowsByItem` 미존재).
- [ ] **Step 2.3 (DTO + fromRow)** `EvaluationItemAvgRow.java`.
  ```java
  package com.kdb.it.domain.council.dto;

  import com.kdb.it.common.util.NativeRowMapper;

  import java.math.BigDecimal;

  /**
   * 평가 항목별 평균점수 native 결과(2컬럼) DTO.
   *
   * <p>컬럼: [0]=IT_PTL_CKG_ITM_TC(점검항목코드), [1]=AVG(QUEL_RCRD)(평균점수).</p>
   */
  public record EvaluationItemAvgRow(String itPtlCkgItmTc, BigDecimal avgScore) {
      public static EvaluationItemAvgRow fromRow(Object[] r) {
          return new EvaluationItemAvgRow(
                  NativeRowMapper.toStr(r[0]),
                  r[1] == null ? null : new BigDecimal(r[1].toString())); // NUMBER AVG → BigDecimal 정밀 보존
      }
  }
  ```
- [ ] **Step 2.4 (리포지토리 래핑)** `EvaluationRepository`에 default 추가.
  ```java
  /** 항목별 평균점수를 DTO로 봉인 반환한다(#6). */
  default List<EvaluationItemAvgRow> findAvgRowsByItem(String itPtlAsctId, String delYn) {
      return findAverageScoreByItem(itPtlAsctId, delYn).stream()
              .map(EvaluationItemAvgRow::fromRow)
              .toList();
  }
  ```
  (import: `com.kdb.it.domain.council.dto.EvaluationItemAvgRow`)
- [ ] **Step 2.5 (run-to-pass)**
  ```bash
  ./gradlew integrationTest --tests "com.kdb.it.domain.council.repository.EvaluationItemAvgMappingIt" -q
  ```
  - 기대: 통과.
- [ ] **Step 2.6 (호출부 전환)** `findAverageScoreByItem` 호출 서비스를 `findAvgRowsByItem`로 교체하고 `Object[]` 인덱스 접근을 `row.itPtlCkgItmTc()`/`row.avgScore()`로 바꾼다. 호출부 단위 테스트 통과 확인 후 커밋.
  ```bash
  ./gradlew compileJava -q
  git add -A && git commit --no-gpg-sign -m "feat(db-jpa): #6 평가 항목평균 native Object[] → EvaluationItemAvgRow.fromRow 봉인 + IT"
  ```
- [ ] **Step 2.7~2.12 (나머지 5개 반복)** 동일 절차로 아래 DTO를 각각 신규 생성·전환·커밋. 컬럼/타입은 위 표 기준, 모든 캐스트는 `NativeRowMapper` 사용. DTO 위치는 해당 도메인 `dto` 패키지.
  - `ApplicationRepository.findMonthlyTrendByBbrC` → `MonthlyCountRow(String month, long cnt)` (`common/approval/dto`). `cnt`는 `NativeRowMapper.toLong`.
  - `ApplicationRepository.findPendingListByEno` → `PendingApprovalRow(String apfDcmNo, String title, String usrNm, String rqsDt)` — 전부 `toStr`.
  - `ServiceRequestDocRepository.findMonthlyTrendByBbrC` → `MonthlyCountRow` 재사용 또는 도메인별 `DocMonthlyCountRow`(중복 회피 위해 `common/util` 공용 record 1개 권장).
  - `ServiceRequestDocRepository.findRecentReviewingByBbrC` → `RecentReviewingRow(String docMngNo, String reqTtl, String usrNm, String createdAt, LocalDate fsgTlm)` — `fsgTlm`은 `toLd`.
  - `LoginHistoryRepository.findDailyLoginStats` → `DailyCountRow(String date, long cnt)` (또는 공용 `LabeledCountRow`). `cnt`는 `toLong`.
  - 각 동등성 IT는 위 대표와 동일 구조(존재하지 않는 키/실데이터 비교).
  > **DRY 결정**: 2컬럼 `(라벨, COUNT)` 형태가 3건(월별추이 2 + 일별통계 1)이므로 `com.kdb.it.common.util.LabeledCountRow(String label, long count)` 공용 record 1개 + `fromRow`로 통합하고, 의미는 호출부 메서드명/주석으로 구분한다.

---

## Task 3 — #7 ProjectRepositoryImpl / CostRepositoryImpl 목록 프로젝션

**결정 B 적용**: 기존 `searchByCondition`(엔티티)·기존 목록 API 응답은 불변. **신규 경량 경로** `searchListByCondition` 추가. 제외할 대용량 텍스트(Bprojm): `ABUS_CONE`(1000), `CPN_SAF_CONE`(1000), `DGOG_PPO_CONE`(4000), `PLM_DES`(4000), `MN_PRG_CONE`(2000), `CST_TP_TC_NM`(1000), `ABUS_RNG_CONE`(600), `SKL_FLD_NM`(500), `ABUS_NCS_CONE`(300), `HRF_PLN_CONE`(300), `ABUS_PPO_CONE`(=bzTpC, 300, 유형명이라 목록에 필요 → **포함**), `PRLM_HRK_OGZ_C_CONE`(100, 포함 가능). 목록에 실제 필요한 식별/요약 컬럼만 select.

목록 경량 DTO 필드(식별·요약): `abusMngNo, sno, abusNm, bzTpC, svnDpmC, dvmDpmC, sttDtm, endDtm, bseYy, odnYn, abusTc, rprStsTc, delYn` (1000자+ 본문 전부 제외).

**Files:** `ProjectDto.java`(record 추가), `ProjectRepositoryCustom.java`/`ProjectRepositoryImpl.java`(메서드 추가), `src/test/java/com/kdb/it/domain/budget/project/repository/ProjectListProjectionIt.java`(신규). Cost 동일.

- [ ] **Step 3.1 (실패 테스트 — 동등성 + 대용량 미선택)** Project 목록 경량 경로가 (a) 식별 필드값이 엔티티 경로와 동일, (b) 대용량 텍스트가 select되지 않음을 검증. (b)는 Hibernate SQL 로그로 컬럼 부재를 단정하기 까다로우므로 **DTO에 대용량 필드 자체가 없음(컴파일 계약) + select 절에 미포함(코드 리뷰)**을 1차 보증으로 삼고, 런타임은 동등성으로 보강한다. `ddl-auto=none`·`@DataJpaTest`라 안전.
  ```java
  package com.kdb.it.domain.budget.project.repository;

  import com.kdb.it.domain.budget.project.dto.ProjectDto;
  import com.kdb.it.domain.budget.project.entity.Bprojm;
  import com.kdb.it.support.AbstractOracleRepositoryTest;
  import org.junit.jupiter.api.DisplayName;
  import org.junit.jupiter.api.Test;
  import org.springframework.beans.factory.annotation.Autowired;

  import java.util.List;
  import java.util.Map;
  import java.util.function.Function;

  import static org.assertj.core.api.Assertions.assertThat;

  @DisplayName("#7 정보화사업 목록 경량 프로젝션 동등성 + 대용량 텍스트 제외")
  class ProjectListProjectionIt extends AbstractOracleRepositoryTest {

      @Autowired
      ProjectRepository projectRepository;

      @Test
      @DisplayName("경량 목록 행의 식별/요약 필드가 엔티티 경로와 일치한다")
      void lightList_matches_entityPath_onListedFields() {
          // 전체 조건(필터 없음) — 동일 WHERE(DEL_YN='N')에서 두 경로 비교
          ProjectDto.SearchCondition cond = new ProjectDto.SearchCondition();
          List<Bprojm> entities = projectRepository.searchByCondition(cond);
          List<ProjectDto.ProjectListRow> rows = projectRepository.searchListByCondition(cond);

          assertThat(rows).hasSameSizeAs(entities);

          Map<String, Bprojm> byKey = entities.stream()
                  .collect(java.util.stream.Collectors.toMap(
                          e -> e.getAbusMngNo() + "#" + e.getSno(), Function.identity(), (a, b) -> a));
          for (ProjectDto.ProjectListRow row : rows) {
              Bprojm e = byKey.get(row.abusMngNo() + "#" + row.sno());
              assertThat(e).as("동일 키 엔티티 존재").isNotNull();
              assertThat(row.abusNm()).isEqualTo(e.getAbusNm());
              assertThat(row.bzTpC()).isEqualTo(e.getBzTpC());
              assertThat(row.svnDpmC()).isEqualTo(e.getSvnDpmC());
              assertThat(row.dvmDpmC()).isEqualTo(e.getDvmDpmC());
              assertThat(row.sttDtm()).isEqualTo(e.getSttDtm());
              assertThat(row.endDtm()).isEqualTo(e.getEndDtm());
              assertThat(row.bseYy()).isEqualTo(e.getBseYy());
              assertThat(row.odnYn()).isEqualTo(e.getOdnYn());
              assertThat(row.abusTc()).isEqualTo(e.getAbusTc());
              assertThat(row.delYn()).isEqualTo(e.getDelYn());
          }
      }
  }
  ```
- [ ] **Step 3.2 (run-to-fail)**
  ```bash
  ./gradlew integrationTest --tests "com.kdb.it.domain.budget.project.repository.ProjectListProjectionIt" -q
  ```
  - 기대: 컴파일 실패(`ProjectDto.ProjectListRow`/`searchListByCondition` 미존재).
- [ ] **Step 3.3 (DTO 추가)** `ProjectDto`에 중첩 record 추가(§5.3 중첩 DTO).
  ```java
  /**
   * 정보화사업 목록 경량 프로젝션 DTO(#7).
   *
   * <p>목록 화면에 필요한 식별/요약 컬럼만 담으며, 1000자+ 대용량 텍스트
   * (사업설명/현황/기대효과/문제/추진경과/고객유형 등)는 select하지 않는다.
   * 상세는 기존 엔티티 조회 경로를 유지한다.</p>
   */
  @Schema(name = "ProjectListRow")
  public record ProjectListRow(
          String abusMngNo,
          Integer sno,
          String abusNm,
          String bzTpC,
          String svnDpmC,
          String dvmDpmC,
          LocalDate sttDtm,
          LocalDate endDtm,
          String bseYy,
          String odnYn,
          String abusTc,
          String rprStsTc,
          String delYn
  ) {}
  ```
- [ ] **Step 3.4 (Custom 인터페이스 + Impl 구현)** `ProjectRepositoryCustom`에 시그니처 추가, `ProjectRepositoryImpl`에 `Projections.constructor` 구현. **WHERE는 기존 `buildConditionPredicate` 재사용**(동등성 보장 핵심).
  ```java
  // ProjectRepositoryCustom
  /**
   * 목록 경량 프로젝션 조회(#7) — {@link #searchByCondition}와 동일 WHERE,
   * select만 대용량 텍스트 제외 컬럼으로 축소.
   */
  List<ProjectDto.ProjectListRow> searchListByCondition(ProjectDto.SearchCondition condition);
  ```
  ```java
  // ProjectRepositoryImpl (import: com.querydsl.core.types.Projections, com.kdb.it.domain.budget.project.dto.ProjectDto)
  @Override
  public List<ProjectDto.ProjectListRow> searchListByCondition(ProjectDto.SearchCondition condition) {
      QBprojm bprojm = QBprojm.bprojm;
      // 동일 WHERE 재사용 — searchByCondition과 결과 행 집합 동일, select만 경량화
      return queryFactory
              .select(Projections.constructor(ProjectDto.ProjectListRow.class,
                      bprojm.abusMngNo,
                      bprojm.sno,
                      bprojm.abusNm,
                      bprojm.bzTpC,
                      bprojm.svnDpmC,
                      bprojm.dvmDpmC,
                      bprojm.sttDtm,
                      bprojm.endDtm,
                      bprojm.bseYy,
                      bprojm.odnYn,
                      bprojm.abusTc,
                      bprojm.rprStsTc,
                      bprojm.delYn))
              .from(bprojm)
              .where(buildConditionPredicate(condition))
              .fetch();
  }
  ```
- [ ] **Step 3.5 (run-to-pass)**
  ```bash
  ./gradlew integrationTest --tests "com.kdb.it.domain.budget.project.repository.ProjectListProjectionIt" -q
  ```
  - 기대: 통과. (실패 시 `Projections.constructor` 인자 순서/타입을 record 컴포넌트 순서와 일치시킬 것 — QueryDSL은 위치 기반.)
- [ ] **Step 3.6 (커밋)**
  ```bash
  git add -A && git commit --no-gpg-sign -m "feat(db-jpa): #7 정보화사업 목록 경량 QueryDSL 프로젝션(searchListByCondition) + 대용량 텍스트 제외 IT"
  ```
- [ ] **Step 3.7~3.12 (Cost 동일 패턴)** `CostDto.CostListRow` 추가 → `CostRepositoryCustom.searchListByCondition` → `CostRepositoryImpl` `Projections.constructor` 구현 → `CostListProjectionIt` → run-to-pass → 커밋. Cost 경량 목록 필드(식별/요약, `indRsn`(200) 정도는 포함 가능하나 본문 대용량은 없음 — Bcostm은 1000자+ 컬럼이 없어 제외 대상이 적다): `costBgNo, bgSno, lstYn, ioeC, cttNm, cttOppNm, costTotXpAmt, curC, sectSysUtzYn, costSvnDpmC, svnTemC, bseYy, abusTc, delYn`. (Bcostm 최대 텍스트는 `IND_RSN`(200)·`CTT_NM/CTT_OPP_NM`(100)로 모두 소형 → Cost의 이득은 "전체 컬럼 회피" 자체. 제외 컬럼이 없다면 목록에 불필요한 `fcAmt`/`xcr`/`xcrBseDt`/`fstDfrDt`/`cgprId`/`bgUntAbusC`/`tmnYn`/`cncdRfrNo`/`dfrCleC` 등 미표시 컬럼을 select에서 빼 폭을 줄인다.)
  - Cost 동등성 IT는 `costBgNo+"#"+bgSno` 키로 매핑 비교.
  - 커밋: `feat(db-jpa): #7 전산관리비 목록 경량 QueryDSL 프로젝션 + IT`.

---

## Task 4 — 전체 검증 & 마무리

- [ ] **Step 4.1 (전체 IT 실행)** P3 신규 통합 테스트 일괄.
  ```bash
  ./gradlew integrationTest -q
  ```
  - 기대: 신규 *MappingIt/*ProjectionIt 전부 통과(로컬 Oracle 가동 시). 미가동이면 skip.
- [ ] **Step 4.2 (CI 게이트 회귀)** 기본 test(태그 it 제외) 통과 — 시그니처 변경 회귀 없음 확인.
  ```bash
  ./gradlew test -q
  ```
  - 기대: BUILD SUCCESSFUL.
- [ ] **Step 4.3 (잔여 Object[] 점검)** 의도치 않게 남은 native `Object[]` 직접 캐스트가 없는지 확인.
  ```bash
  grep -rn "List<Object\[\]>" src/main/java | grep -iE "council|application|servicerequest|loginhistory|evaluation"
  grep -rn "(String) r\[\|(Timestamp) r\[\|(String) row\[" src/main/java
  ```
  - 기대: #5/#6 전환 대상에서 서비스단 직접 캐스트 0건(리포지토리 native `@Query`의 `List<Object[]>` 메서드는 default 래퍼 내부 용도로만 잔존).
- [ ] **Step 4.4 (TASK 이관 메모)** 본 커밋들은 it_backend repo. 루트 `C:\it\TASK.md`의 #5/#6/#7 행 이관은 컨트롤러(상위 세션)가 수행 — 이 계획에서는 **git commit 하지 않는다**(plan 파일 자체).

---

## Self-Review

- **No placeholders**: `NativeRowMapper`, `CouncilProjectRow`(18컬럼 전부), `EvaluationItemAvgRow`, `ProjectDto.ProjectListRow`, `searchListByCondition` 구현, 6개 동등성 IT 코드를 실제 컬럼·인덱스·타입으로 전부 기술. 명령은 실제 `./gradlew integrationTest --tests "FQN"` 형태.
- **순서**: #5(최우선, 18컬럼 오매핑) → #6(나머지 5개) → #7(QueryDSL 목록 프로젝션). spec §6 순서와 일치.
- **§5.5.4 준수**: 모든 native 매핑이 `toStr/toLdt/toLd/toLong/toInt`만 사용, 직접 캐스트 제거. `RealtimeLogRepository` 원본 헬퍼를 공통 유틸로 재사용(DRY).
- **검증 전략**: P0 `AbstractOracleRepositoryTest`(`@Tag("it")`, `ddl-auto=none`, 롤백) 상속, 기존(`Object[]`/엔티티) vs 신규(DTO/프로젝션) **필드별 동등성**. #7은 record 계약으로 대용량 텍스트 부재를 강제 + 동등성으로 보강.
- **무파괴 결정**: native `@Query`는 record 직접 매핑 불가 → 리포지토리 default 래퍼로 `Object[]` 봉인(결정 A). #7 기존 목록 API가 대용량 텍스트를 반환 중 → 신규 `searchListByCondition` 병행 제공으로 breaking change 회피(결정 B). 두 결정 모두 근거(읽은 코드 라인)와 함께 기록.
- **리스크**: (1) `CouncilServiceTest`가 mock 시그니처 변경으로 깨질 수 있음 → Step 1.7에서 명시 대응. (2) `Projections.constructor`는 위치 기반 → record 컴포넌트 순서와 select 인자 순서 일치 필수(Step 3.4/3.5 주석). (3) 로컬 Oracle 미가동 시 IT skip — run-to-pass 전 DB 기동 필요.
- **컨벤션**: 한글 주석, record DTO, AssertJ/JUnit5, QueryDSL §5.4, `--no-gpg-sign` 커밋, it_backend 독립 repo `feature/db-jpa-p3-projection`(main 분기).
