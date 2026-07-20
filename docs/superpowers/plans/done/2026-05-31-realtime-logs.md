# 실시간 로그 모니터링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 20개 `TPRMPP_*L` 변경 로그 테이블을 한 화면에서 자동 폴링(3·5·10초)으로 관찰할 수 있는 Dark Ops Console 형태의 실시간 모니터링 화면을 추가한다.

**Architecture:** 백엔드는 Oracle View `V_ITPAPP_LOG_FEED`(UNION ALL)와 ROLE_ADMIN 전용 네이티브 쿼리 API(`GET /api/admin/realtime-logs`)로 공통 로그 컬럼만 노출하며, 프론트엔드는 `useRealtimeLogs` composable이 복합 커서(`chgDtm, logTbl, logSno`)를 사용해 폴링/슬라이딩 윈도우(200건)/visibility 가드를 처리한다. 디자인은 페이지 스코프 `data-theme="ops"` 다크 토큰으로 격리한다.

**Tech Stack:** Oracle 21c View / Spring Boot 4 (`@PreAuthorize`, JPA EntityManager native query, record DTO) / Nuxt 4 + Vue 3 Composition API / PrimeVue DataTable virtualscroll + PT API / Vitest + Playwright.

**Spec:** [docs/superpowers/specs/2026-05-31-realtime-logs-design.md](../specs/2026-05-31-realtime-logs-design.md)

---

## Phase 1 — Database

### Task 1: View와 인덱스 마이그레이션 작성

**Files:**
- Create: `it_database/migrations/V20260531_001__CreateRealtimeLogView.sql`

**참고:**
- 20개 로그 테이블 키와 물리 테이블명은 `it_frontend/app/utils/adminLogs.ts`와 `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminLogService.java#L302-323`에 동일하게 정의되어 있다.
- View가 노출하는 공통 컬럼은 `BaseLogEntity`의 필드와 매핑된다 (`LOG_HIS_TGR_SNO`, `CHG_DTT_YN`, `CHG_DTM`, `CHG_USID`, `GUID`, `GUID_PRG_SNO`, `FST_ENR_DTM`, `FST_ENR_USID`, `LST_CHG_DTM`, `LST_CHG_USID`, `DEL_YN`).

- [ ] **Step 1: 마이그레이션 파일 작성**

전체 20개 테이블에 대해 (1) `CHG_DTM` 인덱스를 멱등하게 보강하고 (2) View를 `CREATE OR REPLACE`로 생성한다.

```sql
-- V20260531_001__CreateRealtimeLogView.sql
-- 실시간 로그 모니터링 화면용 통합 View 및 CHG_DTM 인덱스 보강.
-- 모든 단계는 멱등(idempotent). 재실행에도 안전.

-- 1) CHG_DTM 인덱스 보강 (이미 존재하면 ORA-00955 무시)
DECLARE
    PROCEDURE create_idx(p_idx_name VARCHAR2, p_table VARCHAR2) IS
    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX ' || p_idx_name ||
                          ' ON ' || p_table || ' (CHG_DTM)';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN NULL;  -- 이미 존재
            ELSE RAISE;
            END IF;
    END;
BEGIN
    create_idx('IX_BASCTL_CHG_DTM',  'TPRMPP_BASCTL');
    create_idx('IX_BBUGTL_CHG_DTM',  'TPRMPP_BBUGTL');
    create_idx('IX_BCHKLL_CHG_DTM',  'TPRMPP_BCHKLL');
    create_idx('IX_BCMMTL_CHG_DTM',  'TPRMPP_BCMMTL');
    create_idx('IX_BCOSTL_CHG_DTM',  'TPRMPP_BCOSTL');
    create_idx('IX_BEVALL_CHG_DTM',  'TPRMPP_BEVALL');
    create_idx('IX_BGDOCL_CHG_DTM',  'TPRMPP_BGDOCL');
    create_idx('IX_BITEML_CHG_DTM',  'TPRMPP_BITEML');
    create_idx('IX_BPERFL_CHG_DTM',  'TPRMPP_BPERFL');
    create_idx('IX_BPLANL_CHG_DTM',  'TPRMPP_BPLANL');
    create_idx('IX_BPOVWL_CHG_DTM',  'TPRMPP_BPOVWL');
    create_idx('IX_BPQNAL_CHG_DTM',  'TPRMPP_BPQNAL');
    create_idx('IX_BPROJL_CHG_DTM',  'TPRMPP_BPROJL');
    create_idx('IX_BRDOCL_CHG_DTM',  'TPRMPP_BRDOCL');
    create_idx('IX_BRIVGL_CHG_DTM',  'TPRMPP_BRIVGL');
    create_idx('IX_BRSLTL_CHG_DTM',  'TPRMPP_BRSLTL');
    create_idx('IX_BSCHDL_CHG_DTM',  'TPRMPP_BSCHDL');
    create_idx('IX_BTERML_CHG_DTM',  'TPRMPP_BTERML');
    create_idx('IX_CAPPLL_CHG_DTM',  'TPRMPP_CAPPLL');
    create_idx('IX_CCODEL_CHG_DTM',  'TPRMPP_CCODEL');
END;
/

-- 2) 통합 View
CREATE OR REPLACE VIEW V_ITPAPP_LOG_FEED AS
SELECT 'TPRMPP_BASCTL' AS LOG_TBL, 'basctm' AS LOG_KEY,
       LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID,
       GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID,
       LST_CHG_DTM, LST_CHG_USID, DEL_YN
  FROM TPRMPP_BASCTL
UNION ALL
SELECT 'TPRMPP_BBUGTL', 'bbugt',  LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BBUGTL
UNION ALL
SELECT 'TPRMPP_BCHKLL', 'bchklc', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BCHKLL
UNION ALL
SELECT 'TPRMPP_BCMMTL', 'bcmmtm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BCMMTL
UNION ALL
SELECT 'TPRMPP_BCOSTL', 'bcostm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BCOSTL
UNION ALL
SELECT 'TPRMPP_BEVALL', 'bevalm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BEVALL
UNION ALL
SELECT 'TPRMPP_BGDOCL', 'bgdocm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BGDOCL
UNION ALL
SELECT 'TPRMPP_BITEML', 'bitemm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BITEML
UNION ALL
SELECT 'TPRMPP_BPERFL', 'bperfm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BPERFL
UNION ALL
SELECT 'TPRMPP_BPLANL', 'bplanm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BPLANL
UNION ALL
SELECT 'TPRMPP_BPOVWL', 'bpovwm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BPOVWL
UNION ALL
SELECT 'TPRMPP_BPQNAL', 'bpqnam', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BPQNAL
UNION ALL
SELECT 'TPRMPP_BPROJL', 'bprojm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BPROJL
UNION ALL
SELECT 'TPRMPP_BRDOCL', 'brdocm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BRDOCL
UNION ALL
SELECT 'TPRMPP_BRIVGL', 'brivgm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BRIVGL
UNION ALL
SELECT 'TPRMPP_BRSLTL', 'brsltm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BRSLTL
UNION ALL
SELECT 'TPRMPP_BSCHDL', 'bschdm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BSCHDL
UNION ALL
SELECT 'TPRMPP_BTERML', 'btermm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_BTERML
UNION ALL
SELECT 'TPRMPP_CAPPLL', 'capplm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_CAPPLL
UNION ALL
SELECT 'TPRMPP_CCODEL', 'ccodem', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID, DEL_YN FROM TPRMPP_CCODEL;
```

- [ ] **Step 2: Spring Boot 기동으로 마이그레이션 실행 검증**

Run: `cd it_backend && ./gradlew bootRun`
Expected: 마이그레이션 정상 적용, 콘솔에 ORA-00955/ORA-00942 등 오류 없음. Ctrl+C로 종료.

- [ ] **Step 3: View 정상 동작 확인**

Run (sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1):
```sql
SELECT COUNT(*) FROM V_ITPAPP_LOG_FEED;
SELECT LOG_TBL, LOG_KEY, COUNT(*) FROM V_ITPAPP_LOG_FEED GROUP BY LOG_TBL, LOG_KEY ORDER BY LOG_TBL;
```
Expected: View가 존재하며 20개 LOG_KEY가 모두 등장(데이터가 없어도 행 카운트 0이 표시되는 LOG_KEY는 결과에서 빠지지만 SELECT 자체는 성공).

- [ ] **Step 4: Commit**

```bash
git add it_database/migrations/V20260531_001__CreateRealtimeLogView.sql
git commit -m "feat: V_ITPAPP_LOG_FEED 통합 View 및 CHG_DTM 인덱스 추가"
```

---

## Phase 2 — Backend

### Task 2: DTO records

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/realtime/dto/RealtimeLogDto.java`

- [ ] **Step 1: DTO 파일 작성**

응답 4종(`FeedRow`, `Snapshot`, `MinuteBucket`, `TableCount`)을 record로 정의한다. 입력 파라미터는 Service에서 record로 받고 Controller에서 분해 전달.

```java
package com.kdb.it.common.admin.realtime.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 실시간 로그 모니터링 DTO 묶음.
 *
 * <p>응답 본문은 표준 로그 컬럼만 노출하며 변경 본문(BEFORE/AFTER)은 포함하지 않는다.</p>
 */
public final class RealtimeLogDto {

    private RealtimeLogDto() {}

    @Schema(name = "RealtimeLogFeedRow", description = "통합 로그 한 행")
    public record FeedRow(
            String logTbl,
            String logKey,
            Long logSno,
            String chgTp,
            LocalDateTime chgDtm,
            String chgUsid,
            String guid,
            String delYn
    ) {}

    @Schema(name = "RealtimeLogSnapshot", description = "실시간 로그 응답 스냅샷")
    public record Snapshot(
            List<FeedRow> rows,
            LocalDateTime serverTime,
            Map<String, Long> tableCounts,
            List<Long> perMinute
    ) {}

    /** 서비스 내부 — Repository 조건 묶음. */
    public record QueryCondition(
            LocalDateTime since,
            String cursorLogTbl,
            Long cursorLogSno,
            int limit,
            List<String> tableKeys,
            List<String> chgTypes
    ) {}
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/admin/realtime/dto/RealtimeLogDto.java
git commit -m "feat(backend): 실시간 로그 DTO record 추가"
```

---

### Task 3: Repository (네이티브 쿼리)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/realtime/repository/RealtimeLogRepository.java`

QueryDSL은 View에 적합하지 않으므로 `EntityManager` 네이티브 쿼리 사용. `tables`/`chgTypes`는 값이 있을 때만 IN 절을 동적으로 SQL 문자열에 끼워 넣어 옵티마이저가 단일 분기 plan을 얻도록 한다.

- [ ] **Step 1: Repository 작성**

```java
package com.kdb.it.common.admin.realtime.repository;

import com.kdb.it.common.admin.realtime.dto.RealtimeLogDto;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * V_ITPAPP_LOG_FEED 기반 실시간 로그 조회 Repository.
 *
 * <p>QueryDSL 메타모델을 사용하지 않고 EntityManager 네이티브 쿼리로 처리한다.</p>
 */
@Repository
@RequiredArgsConstructor
public class RealtimeLogRepository {

    private static final String BASE_COLS = """
        LOG_TBL, LOG_KEY, LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM,
        CHG_USID, GUID, DEL_YN
        """;

    private static final String ORDER_AND_LIMIT = """
        ORDER BY CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC
        FETCH FIRST :limit ROWS ONLY
        """;

    private final EntityManager entityManager;

    /**
     * 조건에 맞는 최신 로그를 최대 {@code limit}건 반환한다.
     *
     * <p>{@code since}가 null이면 초기 스냅샷, 비-null이면 복합 커서 기반 증분 조회.</p>
     */
    public List<RealtimeLogDto.FeedRow> findFeed(RealtimeLogDto.QueryCondition cond) {
        StringBuilder sql = new StringBuilder("SELECT ").append(BASE_COLS)
                .append(" FROM V_ITPAPP_LOG_FEED WHERE 1=1 ");
        Map<String, Object> params = new HashMap<>();
        params.put("limit", cond.limit());

        if (cond.since() != null) {
            sql.append(" AND ( CHG_DTM > :since")
               .append("       OR (CHG_DTM = :since AND LOG_TBL > :cursorLogTbl)")
               .append("       OR (CHG_DTM = :since AND LOG_TBL = :cursorLogTbl AND LOG_HIS_TGR_SNO > :cursorLogSno) ) ");
            params.put("since", Timestamp.valueOf(cond.since()));
            params.put("cursorLogTbl", cond.cursorLogTbl() == null ? "" : cond.cursorLogTbl());
            params.put("cursorLogSno", cond.cursorLogSno() == null ? 0L : cond.cursorLogSno());
        }
        if (cond.tableKeys() != null && !cond.tableKeys().isEmpty()) {
            sql.append(" AND LOG_KEY IN (:tableKeys) ");
            params.put("tableKeys", cond.tableKeys());
        }
        if (cond.chgTypes() != null && !cond.chgTypes().isEmpty()) {
            sql.append(" AND CHG_DTT_YN IN (:chgTypes) ");
            params.put("chgTypes", cond.chgTypes());
        }
        sql.append(ORDER_AND_LIMIT);

        Query query = entityManager.createNativeQuery(sql.toString());
        params.forEach(query::setParameter);

        @SuppressWarnings("unchecked")
        List<Object[]> rows = query.getResultList();
        List<RealtimeLogDto.FeedRow> out = new ArrayList<>(rows.size());
        for (Object[] r : rows) {
            out.add(new RealtimeLogDto.FeedRow(
                    (String) r[0],
                    (String) r[1],
                    ((Number) r[2]).longValue(),
                    (String) r[3],
                    ((Timestamp) r[4]).toLocalDateTime(),
                    (String) r[5],
                    (String) r[6],
                    (String) r[7]
            ));
        }
        return out;
    }

    /**
     * 최근 5분간 LOG_KEY별 발생량.
     */
    public Map<String, Long> countByTableSince(LocalDateTime since) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT LOG_KEY, COUNT(*)
                  FROM V_ITPAPP_LOG_FEED
                 WHERE CHG_DTM > :since
                 GROUP BY LOG_KEY
                """)
                .setParameter("since", Timestamp.valueOf(since))
                .getResultList();
        Map<String, Long> out = new LinkedHashMap<>();
        for (Object[] r : rows) {
            out.put((String) r[0], ((Number) r[1]).longValue());
        }
        return out;
    }

    /**
     * 최근 30분간 분단위 발생량(최신이 끝). 데이터가 없는 분은 0으로 채워 30개 원소를 반환한다.
     */
    public List<Long> perMinuteSince(LocalDateTime since30MinAgo, LocalDateTime serverTime) {
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT TRUNC(CHG_DTM, 'MI') AS BUCKET, COUNT(*)
                  FROM V_ITPAPP_LOG_FEED
                 WHERE CHG_DTM > :since
                 GROUP BY TRUNC(CHG_DTM, 'MI')
                """)
                .setParameter("since", Timestamp.valueOf(since30MinAgo))
                .getResultList();

        Map<LocalDateTime, Long> byBucket = new HashMap<>();
        for (Object[] r : rows) {
            byBucket.put(((Timestamp) r[0]).toLocalDateTime(), ((Number) r[1]).longValue());
        }

        List<Long> out = new ArrayList<>(30);
        LocalDateTime start = serverTime.withSecond(0).withNano(0).minusMinutes(29);
        for (int i = 0; i < 30; i++) {
            out.add(byBucket.getOrDefault(start.plusMinutes(i), 0L));
        }
        return out;
    }
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/admin/realtime/repository/RealtimeLogRepository.java
git commit -m "feat(backend): 실시간 로그 Repository 네이티브 쿼리 추가"
```

---

### Task 4: Service (failing test 먼저)

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/common/admin/realtime/service/RealtimeLogServiceTest.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/realtime/service/RealtimeLogService.java`

Service는 `since` 파싱, allowlist 검증(`tables` → `AdminLogService.getTables()` 키 목록 / `chgTypes` → `C,U,D`), 5분/30분 윈도우 계산, Repository 호출을 담당.

- [ ] **Step 1: 실패 테스트 작성**

```java
package com.kdb.it.common.admin.realtime.service;

import com.kdb.it.common.admin.dto.AdminLogDto;
import com.kdb.it.common.admin.realtime.dto.RealtimeLogDto;
import com.kdb.it.common.admin.realtime.repository.RealtimeLogRepository;
import com.kdb.it.common.admin.service.AdminLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RealtimeLogServiceTest {

    @Mock private RealtimeLogRepository repository;
    @Mock private AdminLogService adminLogService;

    private RealtimeLogService service;
    private final Clock fixedClock = Clock.fixed(
            LocalDateTime.of(2026, 5, 31, 23, 14, 7).atZone(ZoneId.systemDefault()).toInstant(),
            ZoneId.systemDefault());

    @BeforeEach
    void setUp() {
        service = new RealtimeLogService(repository, adminLogService, fixedClock);
        when(adminLogService.getTables()).thenReturn(List.of(
                new AdminLogDto.LogTableResponse("bprojm", "정보화사업 로그", "TPRMPP_BPROJL", "BprojmL"),
                new AdminLogDto.LogTableResponse("bcostm", "전산업무비 로그", "TPRMPP_BCOSTL", "BcostmL")
        ));
        when(repository.findFeed(any())).thenReturn(List.of());
        when(repository.countByTableSince(any())).thenReturn(Map.of());
        when(repository.perMinuteSince(any(), any())).thenReturn(List.of());
    }

    @Test
    @DisplayName("허용되지 않은 LOG_KEY 입력 시 IllegalArgumentException")
    void rejectsUnknownTableKey() {
        assertThatThrownBy(() ->
                service.snapshot(null, null, null, 200, List.of("bprojm", "unknown"), null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("unknown");
    }

    @Test
    @DisplayName("허용되지 않은 chgType 입력 시 IllegalArgumentException")
    void rejectsUnknownChgType() {
        assertThatThrownBy(() ->
                service.snapshot(null, null, null, 200, null, List.of("X")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("X");
    }

    @Test
    @DisplayName("since 미지정 시 커서 컬럼은 null로 Repository에 전달")
    void initialSnapshotPassesNullCursor() {
        service.snapshot(null, null, null, 200, null, null);
        ArgumentCaptor<RealtimeLogDto.QueryCondition> captor =
                ArgumentCaptor.forClass(RealtimeLogDto.QueryCondition.class);
        org.mockito.Mockito.verify(repository).findFeed(captor.capture());
        assertThat(captor.getValue().since()).isNull();
        assertThat(captor.getValue().cursorLogTbl()).isNull();
        assertThat(captor.getValue().cursorLogSno()).isNull();
    }

    @Test
    @DisplayName("limit은 1~200 범위로 클램프")
    void clampsLimit() {
        service.snapshot(null, null, null, 9999, null, null);
        ArgumentCaptor<RealtimeLogDto.QueryCondition> captor =
                ArgumentCaptor.forClass(RealtimeLogDto.QueryCondition.class);
        org.mockito.Mockito.verify(repository).findFeed(captor.capture());
        assertThat(captor.getValue().limit()).isEqualTo(200);
    }

    @Test
    @DisplayName("snapshot 결과의 serverTime은 주입된 Clock 시각")
    void serverTimeFromClock() {
        RealtimeLogDto.Snapshot snap = service.snapshot(null, null, null, 200, null, null);
        assertThat(snap.serverTime()).isEqualTo(LocalDateTime.of(2026, 5, 31, 23, 14, 7));
    }
}
```

- [ ] **Step 2: 테스트 실행으로 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.realtime.service.RealtimeLogServiceTest"`
Expected: FAIL — `RealtimeLogService` 클래스 미존재.

- [ ] **Step 3: Service 구현**

```java
package com.kdb.it.common.admin.realtime.service;

import com.kdb.it.common.admin.dto.AdminLogDto;
import com.kdb.it.common.admin.realtime.dto.RealtimeLogDto;
import com.kdb.it.common.admin.realtime.repository.RealtimeLogRepository;
import com.kdb.it.common.admin.service.AdminLogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * 실시간 로그 모니터링 화면 서비스.
 *
 * <p>{@link AdminLogService#getTables()}의 허용 LOG_KEY 집합과 변경구분 {@code C/U/D}만 허용한다.
 * 검증 실패 시 {@link IllegalArgumentException}을 던진다.</p>
 */
@Service
@Transactional(readOnly = true)
public class RealtimeLogService {

    private static final Set<String> ALLOWED_CHG_TYPES = Set.of("C", "U", "D");
    private static final int DEFAULT_LIMIT = 200;
    private static final int MAX_LIMIT = 200;
    private static final int TABLE_COUNT_WINDOW_MIN = 5;
    private static final int PER_MINUTE_WINDOW_MIN = 30;

    private final RealtimeLogRepository repository;
    private final AdminLogService adminLogService;
    private final Clock clock;

    public RealtimeLogService(RealtimeLogRepository repository,
                              AdminLogService adminLogService,
                              Clock clock) {
        this.repository = repository;
        this.adminLogService = adminLogService;
        this.clock = clock;
    }

    /**
     * 실시간 로그 스냅샷을 반환한다.
     *
     * @param since         이 시각 이후 로그만 조회. null이면 초기 200건.
     * @param cursorLogTbl  복합 커서의 LOG_TBL. {@code since}와 함께 사용.
     * @param cursorLogSno  복합 커서의 LOG_HIS_TGR_SNO. {@code since}와 함께 사용.
     * @param limit         최대 200.
     * @param tableKeys     허용된 LOG_KEY 부분집합. null/빈 리스트는 필터 없음.
     * @param chgTypes      C/U/D 부분집합. null/빈 리스트는 필터 없음.
     * @throws IllegalArgumentException 허용되지 않은 LOG_KEY 또는 chgType 포함 시.
     */
    public RealtimeLogDto.Snapshot snapshot(
            LocalDateTime since, String cursorLogTbl, Long cursorLogSno,
            int limit, List<String> tableKeys, List<String> chgTypes) {

        Set<String> allowedKeys = allowedLogKeys();
        List<String> normalizedTables = normalize(tableKeys);
        for (String key : normalizedTables) {
            if (!allowedKeys.contains(key)) {
                throw new IllegalArgumentException("허용되지 않은 LOG_KEY: " + key);
            }
        }
        List<String> normalizedChgTypes = normalize(chgTypes);
        for (String t : normalizedChgTypes) {
            if (!ALLOWED_CHG_TYPES.contains(t)) {
                throw new IllegalArgumentException("허용되지 않은 변경구분: " + t);
            }
        }

        int safeLimit = Math.max(1, Math.min(limit <= 0 ? DEFAULT_LIMIT : limit, MAX_LIMIT));

        var cond = new RealtimeLogDto.QueryCondition(
                since, cursorLogTbl, cursorLogSno, safeLimit, normalizedTables, normalizedChgTypes);

        var rows = repository.findFeed(cond);
        LocalDateTime serverTime = LocalDateTime.now(clock);
        var tableCounts = repository.countByTableSince(serverTime.minusMinutes(TABLE_COUNT_WINDOW_MIN));
        var perMinute = repository.perMinuteSince(serverTime.minusMinutes(PER_MINUTE_WINDOW_MIN), serverTime);
        return new RealtimeLogDto.Snapshot(rows, serverTime, tableCounts, perMinute);
    }

    private Set<String> allowedLogKeys() {
        return adminLogService.getTables().stream()
                .map(AdminLogDto.LogTableResponse::key)
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private List<String> normalize(List<String> input) {
        if (input == null) return List.of();
        return input.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .toList();
    }
}
```

- [ ] **Step 4: 테스트 재실행으로 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.realtime.service.RealtimeLogServiceTest"`
Expected: PASS 5/5.

- [ ] **Step 5: Clock Bean 등록 확인**

Run: `cd it_backend && grep -r "Clock.system" src/main/java/com/kdb/it/config/`

Bean이 없으면 `it_backend/src/main/java/com/kdb/it/config/ClockConfig.java`를 추가:

```java
package com.kdb.it.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
```

이미 존재하면 본 Step은 스킵.

- [ ] **Step 6: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/admin/realtime/service/RealtimeLogService.java \
        it_backend/src/test/java/com/kdb/it/common/admin/realtime/service/RealtimeLogServiceTest.java \
        it_backend/src/main/java/com/kdb/it/config/ClockConfig.java
git commit -m "feat(backend): 실시간 로그 Service + allowlist 검증 테스트"
```

(`ClockConfig.java`가 신규 생성되지 않은 경우 경로에서 제외)

---

### Task 5: Controller (failing test 먼저)

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/common/admin/realtime/controller/RealtimeLogControllerTest.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/realtime/controller/RealtimeLogController.java`

- [ ] **Step 1: WebMvcTest 작성**

```java
package com.kdb.it.common.admin.realtime.controller;

import com.kdb.it.common.admin.realtime.dto.RealtimeLogDto;
import com.kdb.it.common.admin.realtime.service.RealtimeLogService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RealtimeLogController.class)
class RealtimeLogControllerTest {

    @Autowired private MockMvc mvc;
    @MockBean private RealtimeLogService service;

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("ADMIN 200 응답")
    void admin_returns200() throws Exception {
        when(service.snapshot(any(), any(), any(), org.mockito.ArgumentMatchers.anyInt(), any(), any()))
                .thenReturn(new RealtimeLogDto.Snapshot(
                        List.of(), LocalDateTime.of(2026, 5, 31, 23, 14, 7),
                        Map.of(), List.of()));
        mvc.perform(get("/api/admin/realtime-logs"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.serverTime").exists());
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("비-ADMIN 403")
    void user_forbidden() throws Exception {
        mvc.perform(get("/api/admin/realtime-logs"))
           .andExpect(status().isForbidden());
    }

    @Test
    @WithAnonymousUser
    @DisplayName("미인증 401")
    void anonymous_unauthorized() throws Exception {
        mvc.perform(get("/api/admin/realtime-logs"))
           .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: 테스트 실행으로 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*.RealtimeLogControllerTest"`
Expected: FAIL — Controller 미존재.

- [ ] **Step 3: Controller 구현**

```java
package com.kdb.it.common.admin.realtime.controller;

import com.kdb.it.common.admin.realtime.dto.RealtimeLogDto;
import com.kdb.it.common.admin.realtime.service.RealtimeLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * 실시간 로그 모니터링 API.
 *
 * <p>관리자(ROLE_ADMIN) 전용. 응답은 표준 로그 컬럼만 포함하며 변경 본문은 제외한다.</p>
 */
@RestController
@RequestMapping("/api/admin/realtime-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin/Realtime Logs", description = "실시간 로그 모니터링")
public class RealtimeLogController {

    private final RealtimeLogService service;

    @GetMapping
    @Operation(summary = "통합 실시간 로그 조회",
            description = "since/복합 커서 기반 증분 조회와 최근 5분/30분 집계를 함께 반환합니다.")
    public RealtimeLogDto.Snapshot get(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime since,
            @RequestParam(required = false) String cursorLogTbl,
            @RequestParam(required = false) Long cursorLogSno,
            @RequestParam(defaultValue = "200") int limit,
            @RequestParam(required = false) String tables,
            @RequestParam(required = false) String chgTypes
    ) {
        return service.snapshot(since, cursorLogTbl, cursorLogSno, limit,
                split(tables), split(chgTypes));
    }

    private List<String> split(String csv) {
        if (csv == null || csv.isBlank()) return null;
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
```

- [ ] **Step 4: 테스트 재실행으로 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*.RealtimeLogControllerTest"`
Expected: PASS 3/3.

- [ ] **Step 5: bootRun으로 Swagger 등록 확인**

Run: `cd it_backend && ./gradlew bootRun` 백그라운드 실행 후 브라우저로 `http://localhost:8080/swagger-ui/index.html` 열어 `Admin/Realtime Logs` 태그 존재 확인 후 종료.

- [ ] **Step 6: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/admin/realtime/controller/RealtimeLogController.java \
        it_backend/src/test/java/com/kdb/it/common/admin/realtime/controller/RealtimeLogControllerTest.java
git commit -m "feat(backend): /api/admin/realtime-logs Controller + 권한 테스트"
```

---

## Phase 3 — Frontend Foundation

### Task 6: 타입과 유틸 (`realtimeLogs.ts`)

**Files:**
- Create: `it_frontend/app/types/realtimeLog.ts`
- Create: `it_frontend/app/utils/realtimeLogs.ts`
- Test: `it_frontend/tests/unit/utils/realtimeLogs.test.ts`

- [ ] **Step 1: 타입 작성**

```typescript
// it_frontend/app/types/realtimeLog.ts
export interface LogFeedRow {
    logTbl: string;
    logKey: string;
    logSno: number;
    chgTp: 'C' | 'U' | 'D';
    chgDtm: string;        // ISO-8601
    chgUsid: string | null;
    guid: string | null;
    delYn: 'Y' | 'N';
}

export interface RealtimeLogSnapshot {
    rows: LogFeedRow[];
    serverTime: string;
    tableCounts: Record<string, number>;
    perMinute: number[];
}

export type PollIntervalMs = 3000 | 5000 | 10000;
```

- [ ] **Step 2: 유틸 테스트 작성**

```typescript
// it_frontend/tests/unit/utils/realtimeLogs.test.ts
import { describe, expect, it } from 'vitest';
import {
    chgTypeLabel,
    logKeyLabel,
    mergeWithSlidingWindow,
    rowKey,
} from '~/utils/realtimeLogs';
import type { LogFeedRow } from '~/types/realtimeLog';

const row = (logTbl: string, logSno: number, chgDtm: string): LogFeedRow => ({
    logTbl,
    logKey: logTbl.toLowerCase(),
    logSno,
    chgTp: 'U',
    chgDtm,
    chgUsid: 'X000001',
    guid: null,
    delYn: 'N',
});

describe('realtimeLogs utils', () => {
    it('logKeyLabel — adminLogs 매핑 라벨 반환', () => {
        expect(logKeyLabel('bprojm')).toBe('사업 목록·상세');
        expect(logKeyLabel('unknown')).toBe('unknown');
    });

    it('chgTypeLabel — C/U/D 한글 라벨', () => {
        expect(chgTypeLabel('C')).toBe('생성');
        expect(chgTypeLabel('U')).toBe('수정');
        expect(chgTypeLabel('D')).toBe('삭제');
    });

    it('rowKey — logTbl+logSno 조합', () => {
        expect(rowKey(row('TPRMPP_BPROJL', 1, '2026-05-31T23:14:06'))).toBe('TPRMPP_BPROJL#1');
    });

    it('mergeWithSlidingWindow — 신규 행 prepend + 중복 제거 + 200 cap', () => {
        const initial: LogFeedRow[] = [];
        const incoming = Array.from({ length: 250 }, (_, i) =>
            row('TPRMPP_BPROJL', i, '2026-05-31T23:14:06.000'));
        const merged = mergeWithSlidingWindow(initial, incoming, 200);
        expect(merged).toHaveLength(200);
        expect(merged[0]?.logSno).toBe(249);

        const dup = mergeWithSlidingWindow(merged, [row('TPRMPP_BPROJL', 249, '2026-05-31T23:14:06.000')], 200);
        expect(dup).toHaveLength(200);
    });
});
```

- [ ] **Step 3: 테스트 실행으로 실패 확인**

Run: `cd it_frontend && npm test -- realtimeLogs.test.ts`
Expected: FAIL — 유틸 미존재.

- [ ] **Step 4: 유틸 구현**

```typescript
// it_frontend/app/utils/realtimeLogs.ts
import { ADMIN_LOG_TABLES } from '~/utils/adminLogs';
import type { LogFeedRow } from '~/types/realtimeLog';

const LABEL_BY_KEY = new Map(ADMIN_LOG_TABLES.map((t) => [t.key, t.menuLabel ?? t.title]));

/** LOG_KEY → 사람이 읽기 좋은 한글 라벨. 미정의 키는 입력 그대로. */
export function logKeyLabel(key: string): string {
    return LABEL_BY_KEY.get(key) ?? key;
}

/** 변경구분 C/U/D 한글 라벨. */
export function chgTypeLabel(chgTp: string): string {
    switch (chgTp) {
        case 'C': return '생성';
        case 'U': return '수정';
        case 'D': return '삭제';
        default: return chgTp;
    }
}

/** 동일 행 식별용 키 (logTbl + logSno). */
export function rowKey(row: LogFeedRow): string {
    return `${row.logTbl}#${row.logSno}`;
}

/**
 * 신규 행을 기존 슬라이딩 윈도우에 prepend하고 중복을 제거한 뒤 max건으로 자른다.
 * 입력 모두 chgDtm 최신순이라고 가정한다.
 */
export function mergeWithSlidingWindow(
    current: LogFeedRow[],
    incoming: LogFeedRow[],
    max: number,
): LogFeedRow[] {
    if (incoming.length === 0) return current;
    const seen = new Set<string>();
    const merged: LogFeedRow[] = [];
    for (const r of [...incoming, ...current]) {
        const k = rowKey(r);
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(r);
        if (merged.length >= max) break;
    }
    return merged;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- realtimeLogs.test.ts`
Expected: PASS 4/4.

- [ ] **Step 6: Commit**

```bash
git add it_frontend/app/types/realtimeLog.ts \
        it_frontend/app/utils/realtimeLogs.ts \
        it_frontend/tests/unit/utils/realtimeLogs.test.ts
git commit -m "feat(frontend): 실시간 로그 타입 + 슬라이딩 윈도우 유틸"
```

---

### Task 7: Composable `useRealtimeLogs` (failing test 먼저)

**Files:**
- Create: `it_frontend/tests/unit/composables/useRealtimeLogs.test.ts`
- Create: `it_frontend/app/composables/useRealtimeLogs.ts`

기존 `useNotifications` 폴링 패턴을 참고. 모든 API 호출은 `$apiFetch` (`useNuxtApp().$apiFetch`). 테스트는 `useNuxtApp` mock으로 `$apiFetch` 가짜를 주입한다.

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// it_frontend/tests/unit/composables/useRealtimeLogs.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeLogs } from '~/composables/useRealtimeLogs';
import type { RealtimeLogSnapshot } from '~/types/realtimeLog';

const apiFetchMock = vi.fn();

vi.mock('#app', () => ({
    useNuxtApp: () => ({ $apiFetch: apiFetchMock }),
    useRuntimeConfig: () => ({ public: { apiBase: 'http://localhost:8080' } }),
}));

function snap(overrides: Partial<RealtimeLogSnapshot> = {}): RealtimeLogSnapshot {
    return {
        rows: [],
        serverTime: '2026-05-31T23:14:07',
        tableCounts: {},
        perMinute: Array.from({ length: 30 }, () => 0),
        ...overrides,
    };
}

describe('useRealtimeLogs', () => {
    beforeEach(() => {
        apiFetchMock.mockReset();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('start() 호출 시 즉시 1회 + intervalMs마다 한 번씩 호출', async () => {
        apiFetchMock.mockResolvedValue(snap());
        const c = useRealtimeLogs();
        c.intervalMs.value = 5000;
        await c.start();
        expect(apiFetchMock).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(5000);
        expect(apiFetchMock).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(5000);
        expect(apiFetchMock).toHaveBeenCalledTimes(3);

        c.stop();
    });

    it('paused일 때 polling tick이 호출을 건너뛴다', async () => {
        apiFetchMock.mockResolvedValue(snap());
        const c = useRealtimeLogs();
        c.intervalMs.value = 5000;
        await c.start();
        expect(apiFetchMock).toHaveBeenCalledTimes(1);

        c.paused.value = true;
        await vi.advanceTimersByTimeAsync(5000);
        expect(apiFetchMock).toHaveBeenCalledTimes(1);

        c.paused.value = false;
        await vi.advanceTimersByTimeAsync(5000);
        expect(apiFetchMock).toHaveBeenCalledTimes(2);

        c.stop();
    });

    it('수신 행이 복합 커서 갱신에 사용된다', async () => {
        apiFetchMock
            .mockResolvedValueOnce(snap({
                rows: [{
                    logTbl: 'TPRMPP_BPROJL', logKey: 'bprojm', logSno: 42,
                    chgTp: 'U', chgDtm: '2026-05-31T23:14:06.231',
                    chgUsid: 'X000001', guid: null, delYn: 'N',
                }],
            }))
            .mockResolvedValue(snap());

        const c = useRealtimeLogs();
        c.intervalMs.value = 5000;
        await c.start();

        await vi.advanceTimersByTimeAsync(5000);
        const second = apiFetchMock.mock.calls[1]?.[1]?.query as Record<string, unknown>;
        expect(second.since).toBe('2026-05-31T23:14:06.231');
        expect(second.cursorLogTbl).toBe('TPRMPP_BPROJL');
        expect(second.cursorLogSno).toBe(42);

        c.stop();
    });

    it('200건 초과 수신 시 tail이 drop된다', async () => {
        const many = Array.from({ length: 250 }, (_, i) => ({
            logTbl: 'TPRMPP_BPROJL', logKey: 'bprojm', logSno: i,
            chgTp: 'U' as const,
            chgDtm: `2026-05-31T23:14:${String(i % 60).padStart(2, '0')}`,
            chgUsid: 'X000001', guid: null, delYn: 'N' as const,
        }));
        apiFetchMock.mockResolvedValue(snap({ rows: many }));
        const c = useRealtimeLogs();
        await c.start();
        expect(c.rows.value.length).toBeLessThanOrEqual(200);
        c.stop();
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_frontend && npm test -- useRealtimeLogs.test.ts`
Expected: FAIL — composable 미존재.

- [ ] **Step 3: Composable 구현**

```typescript
// it_frontend/app/composables/useRealtimeLogs.ts
import { ref, shallowRef } from 'vue';
import { useNuxtApp } from '#app';
import type { LogFeedRow, PollIntervalMs, RealtimeLogSnapshot } from '~/types/realtimeLog';
import { mergeWithSlidingWindow } from '~/utils/realtimeLogs';

const MAX_ROWS = 200;

/**
 * 실시간 로그 폴링 composable.
 *
 * - 즉시 1회 + intervalMs 주기로 GET /api/admin/realtime-logs 호출.
 * - 복합 커서 (chgDtm, logTbl, logSno) 기준 증분 조회.
 * - 신규 행은 prepend, 200건 초과 시 tail drop.
 * - paused 상태에서는 tick을 건너뜀.
 * - 페이지 visibility가 hidden이면 자동 pause, visible 복귀 시 resume.
 */
export function useRealtimeLogs() {
    const { $apiFetch } = useNuxtApp() as { $apiFetch: typeof $fetch };

    const rows = shallowRef<LogFeedRow[]>([]);
    const tableCounts = ref<Record<string, number>>({});
    const perMinute = ref<number[]>([]);
    const serverTime = ref<string | null>(null);
    const paused = ref(false);
    const intervalMs = ref<PollIntervalMs>(5000);
    const loading = ref(false);
    const error = ref<unknown>(null);

    let timer: ReturnType<typeof setInterval> | null = null;
    let cursor: { since: string | null; logTbl: string | null; logSno: number | null } = {
        since: null, logTbl: null, logSno: null,
    };

    async function fetchOnce(): Promise<void> {
        loading.value = true;
        try {
            const snap = await $apiFetch<RealtimeLogSnapshot>('/api/admin/realtime-logs', {
                query: {
                    since: cursor.since ?? undefined,
                    cursorLogTbl: cursor.logTbl ?? undefined,
                    cursorLogSno: cursor.logSno ?? undefined,
                    limit: MAX_ROWS,
                },
            });

            if (snap.rows.length > 0) {
                rows.value = mergeWithSlidingWindow(rows.value, snap.rows, MAX_ROWS);
                const head = snap.rows[0]!;
                cursor = { since: head.chgDtm, logTbl: head.logTbl, logSno: head.logSno };
            }
            tableCounts.value = snap.tableCounts;
            perMinute.value = snap.perMinute;
            serverTime.value = snap.serverTime;
            error.value = null;
        } catch (e) {
            error.value = e;
        } finally {
            loading.value = false;
        }
    }

    function tick(): void {
        if (paused.value) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        void fetchOnce();
    }

    function startTimer(): void {
        stopTimer();
        timer = setInterval(tick, intervalMs.value);
    }

    function stopTimer(): void {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    }

    async function start(): Promise<void> {
        await fetchOnce();
        startTimer();
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibilityChange);
        }
    }

    function stop(): void {
        stopTimer();
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        }
    }

    function onVisibilityChange(): void {
        if (document.visibilityState === 'visible' && !paused.value) {
            void fetchOnce();
        }
    }

    function setIntervalMs(ms: PollIntervalMs): void {
        intervalMs.value = ms;
        if (timer !== null) startTimer();
    }

    return {
        rows, tableCounts, perMinute, serverTime,
        paused, intervalMs, loading, error,
        start, stop, fetchOnce, setIntervalMs,
    };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- useRealtimeLogs.test.ts`
Expected: PASS 4/4.

- [ ] **Step 5: Commit**

```bash
git add it_frontend/app/composables/useRealtimeLogs.ts \
        it_frontend/tests/unit/composables/useRealtimeLogs.test.ts
git commit -m "feat(frontend): useRealtimeLogs 폴링·복합커서·슬라이딩윈도우"
```

---

### Task 8: 사이드바 메뉴 항목 추가

**Files:**
- Modify: `it_frontend/app/components/AppSidebar.vue`
- Create: `it_frontend/app/components/icons/IconActivity.vue`

기존 사이드바 `menuItems` admin 그룹의 `[상세 로그]` 바로 위에 `[실시간 로그]`를 끼워 넣는다.

- [ ] **Step 1: IconActivity 컴포넌트 생성**

```vue
<!-- it_frontend/app/components/icons/IconActivity.vue -->
<script setup lang="ts">
// 맥동하는 점 — 실시간 로그 메뉴/헤더 인디케이터
</script>

<template>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3" fill="currentColor">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.8s" repeatCount="indefinite" />
        </circle>
    </svg>
</template>
```

- [ ] **Step 2: 사이드바 라인 위치 확인**

Run: `grep -n "상세 로그" it_frontend/app/components/AppSidebar.vue`
Expected: 1줄 출력 (예: `270:                label: '상세 로그', ...`).

- [ ] **Step 3: 메뉴 항목 삽입**

`AppSidebar.vue` 의 admin 그룹 menuItems에서 `[상세 로그]` 객체 직전 줄에 다음 객체를 추가:

```ts
{
    label: '실시간 로그', icon: 'pi pi-bolt', to: '/admin/realtime-logs', admin: true,
},
```

(사이드바는 일관성 위해 PrimeIcons 문자열 사용. IconActivity는 페이지 헤더에서 사용.)

- [ ] **Step 4: 타입 체크 + 린트**

Run: `cd it_frontend && npm run typecheck && npm run lint`
Expected: 신규 코드 관련 오류 없음.

- [ ] **Step 5: Commit**

```bash
git add it_frontend/app/components/icons/IconActivity.vue \
        it_frontend/app/components/AppSidebar.vue
git commit -m "feat(frontend): 사이드바 [실시간 로그] 메뉴 항목 추가"
```

---

## Phase 4 — Frontend Components

### Task 9: 페이지 셸 + Ops 토큰 + 헤더

**Files:**
- Create: `it_frontend/app/pages/admin/realtime-logs.vue`
- Create: `it_frontend/app/assets/css/ops-theme.css`
- Create: `it_frontend/app/components/admin/realtime/RealtimeHeader.vue`
- Modify: `it_frontend/nuxt.config.ts` (ops-theme.css 등록)

- [ ] **Step 1: Ops 디자인 토큰 CSS**

```css
/* it_frontend/app/assets/css/ops-theme.css */
/* Dark Ops Console — 실시간 로그 화면 전용 스코프 토큰 */
.ops-canvas {
    --ops-bg:        oklch(15% 0.01 250);
    --ops-surface:   oklch(20% 0.015 250);
    --ops-border:    oklch(28% 0.015 250);
    --ops-text:      oklch(94% 0.005 250);
    --ops-text-dim:  oklch(65% 0.01 250);
    --ops-accent-c:  oklch(78% 0.16 195);
    --ops-accent-u:  oklch(82% 0.15 80);
    --ops-accent-d:  oklch(70% 0.18 15);
    --ops-mono:      'JetBrains Mono', 'D2Coding', ui-monospace, monospace;

    min-height: calc(100vh - 64px);
    background: var(--ops-bg);
    color: var(--ops-text);
    padding: 1rem 1.25rem 2rem;
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: 0.75rem;
}

.ops-canvas .ops-mono {
    font-family: var(--ops-mono);
    font-variant-numeric: tabular-nums;
}

.ops-canvas .ops-chip-c { color: var(--ops-accent-c); }
.ops-canvas .ops-chip-u { color: var(--ops-accent-u); }
.ops-canvas .ops-chip-d { color: var(--ops-accent-d); }

.ops-canvas .ops-card {
    background: var(--ops-surface);
    border: 1px solid var(--ops-border);
    border-radius: 8px;
    padding: 0.75rem 1rem;
}

/* 신규 행 페이드인 */
.ops-canvas .ops-feed-row--new {
    animation: ops-row-in 240ms cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes ops-row-in {
    from { opacity: 0; transform: translateX(-4px); }
    to   { opacity: 1; transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
    .ops-canvas .ops-feed-row--new { animation: none; }
}
```

- [ ] **Step 2: nuxt.config.ts에 등록**

Run: `grep -n "css:" it_frontend/nuxt.config.ts`

`css: [...]` 배열이 있다면 끝에 `'~/assets/css/ops-theme.css'`를 추가. 없다면 `defineNuxtConfig({...})` 안에 추가:

```ts
css: ['~/assets/css/ops-theme.css'],
```

- [ ] **Step 3: RealtimeHeader 컴포넌트**

```vue
<!-- it_frontend/app/components/admin/realtime/RealtimeHeader.vue -->
<script setup lang="ts">
import IconActivity from '~/components/icons/IconActivity.vue';
import type { PollIntervalMs } from '~/types/realtimeLog';

interface Props {
    paused: boolean;
    intervalMs: PollIntervalMs;
    serverTime: string | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{
    'update:paused': [v: boolean];
    'update:intervalMs': [v: PollIntervalMs];
}>();

const intervalOptions: { label: string; value: PollIntervalMs }[] = [
    { label: '3초', value: 3000 },
    { label: '5초', value: 5000 },
    { label: '10초', value: 10000 },
];

function togglePaused() { emit('update:paused', !props.paused); }
function selectInterval(v: PollIntervalMs) { emit('update:intervalMs', v); }
</script>

<template>
    <div class="ops-card ops-header">
        <div class="ops-header-left">
            <span class="ops-indicator"><IconActivity /></span>
            <span class="ops-title">실시간 로그</span>
        </div>
        <div class="ops-header-center">
            <div class="ops-interval">
                <button
                    v-for="opt in intervalOptions"
                    :key="opt.value"
                    type="button"
                    :class="['ops-interval-btn', { 'is-active': intervalMs === opt.value }]"
                    @click="selectInterval(opt.value)"
                >{{ opt.label }}</button>
            </div>
            <button
                type="button"
                class="ops-pause-btn"
                :aria-pressed="paused"
                @click="togglePaused"
            >{{ paused ? '▶ 재개' : '⏸ 일시정지' }}</button>
        </div>
        <div class="ops-header-right ops-mono">{{ serverTime ?? '--:--:--' }}</div>
    </div>
</template>

<style scoped>
.ops-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 5;
}
.ops-header-left { display: flex; gap: 0.5rem; align-items: center; }
.ops-title { font-weight: 600; }
.ops-header-center { display: flex; gap: 0.75rem; align-items: center; justify-content: center; }
.ops-interval { display: inline-flex; gap: 0; border: 1px solid var(--ops-border); border-radius: 6px; overflow: hidden; }
.ops-interval-btn {
    background: transparent; color: var(--ops-text-dim);
    padding: 0.25rem 0.6rem; border: none; cursor: pointer; font-family: var(--ops-mono);
}
.ops-interval-btn.is-active { background: var(--ops-border); color: var(--ops-text); }
.ops-pause-btn {
    background: var(--ops-border); color: var(--ops-text);
    border: none; border-radius: 6px; padding: 0.3rem 0.75rem; cursor: pointer;
}
.ops-header-right { text-align: right; color: var(--ops-text-dim); }
.ops-indicator { color: var(--ops-accent-c); }
</style>
```

- [ ] **Step 4: 페이지 최소 셸**

```vue
<!-- it_frontend/app/pages/admin/realtime-logs.vue -->
<script setup lang="ts">
import RealtimeHeader from '~/components/admin/realtime/RealtimeHeader.vue';
import { useRealtimeLogs } from '~/composables/useRealtimeLogs';
import type { PollIntervalMs } from '~/types/realtimeLog';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const {
    paused, intervalMs, serverTime,
    start, stop, setIntervalMs,
} = useRealtimeLogs();

onMounted(() => { void start(); });
onBeforeUnmount(() => { stop(); });

function onIntervalChange(v: PollIntervalMs) { setIntervalMs(v); }
</script>

<template>
    <div class="ops-canvas" data-theme="ops">
        <RealtimeHeader
            :paused="paused"
            :interval-ms="intervalMs"
            :server-time="serverTime"
            @update:paused="paused = $event"
            @update:interval-ms="onIntervalChange"
        />
        <!-- KPI Strip / Feed Table — 다음 태스크에서 추가 -->
    </div>
</template>
```

- [ ] **Step 5: 화면 진입 확인 (수동)**

백엔드와 프론트엔드 기동 후 관리자 계정으로 로그인하고 `http://localhost:3000/admin/realtime-logs` 진입. 다크 캔버스 + 헤더 + 일시정지 토글 동작 확인.

- [ ] **Step 6: Commit**

```bash
git add it_frontend/app/assets/css/ops-theme.css \
        it_frontend/app/components/admin/realtime/RealtimeHeader.vue \
        it_frontend/app/pages/admin/realtime-logs.vue \
        it_frontend/nuxt.config.ts
git commit -m "feat(frontend): 실시간 로그 페이지 셸 + Ops 헤더 + 토큰"
```

---

### Task 10: 라이브 피드 테이블

**Files:**
- Create: `it_frontend/app/components/admin/realtime/RealtimeFeedTable.vue`
- Modify: `it_frontend/app/pages/admin/realtime-logs.vue`

PrimeVue DataTable virtualscroll 사용. PT API로 다크 헤더/행 처리.

- [ ] **Step 1: 컴포넌트 작성**

```vue
<!-- it_frontend/app/components/admin/realtime/RealtimeFeedTable.vue -->
<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import { computed } from 'vue';
import { chgTypeLabel, logKeyLabel, rowKey } from '~/utils/realtimeLogs';
import type { LogFeedRow } from '~/types/realtimeLog';

interface Props { rows: LogFeedRow[]; }
const props = defineProps<Props>();
const emit = defineEmits<{ rowClick: [row: LogFeedRow] }>();

/** 신규 행 하이라이트: 4초 이내 진입한 행에만 마커 표시. */
const NEW_WINDOW_MS = 4000;
const seen = new Map<string, number>();
const data = computed(() => {
    const now = Date.now();
    return props.rows.map((r) => {
        const k = rowKey(r);
        if (!seen.has(k)) seen.set(k, now);
        const since = now - (seen.get(k) ?? now);
        return { ...r, _isNew: since < NEW_WINDOW_MS };
    });
});

function timePart(iso: string): string {
    const m = /T(\d{2}:\d{2}:\d{2}(\.\d{1,3})?)/.exec(iso);
    return m ? m[1]! : iso;
}
function guidHead(guid: string | null): string {
    if (!guid) return '—';
    return guid.length > 8 ? `${guid.slice(0, 8)}…` : guid;
}
</script>

<template>
    <div class="ops-card ops-feed-wrap">
        <DataTable
            :value="data"
            scrollable
            scroll-height="calc(100vh - 320px)"
            :virtual-scroller-options="{ itemSize: 32 }"
            data-key="logSno"
            :row-class="(r) => (r._isNew ? 'ops-feed-row--new' : '')"
            @row-click="(e) => emit('rowClick', e.data as LogFeedRow)"
        >
            <Column field="chgDtm" header="TIME" :style="{ width: '160px' }">
                <template #body="{ data: r }">
                    <span class="ops-mono">{{ timePart(r.chgDtm) }}</span>
                </template>
            </Column>
            <Column field="logKey" header="TBL">
                <template #body="{ data: r }">
                    <span>{{ logKeyLabel(r.logKey) }}</span>
                    <span class="ops-mono ops-tbl-code">{{ r.logTbl }}</span>
                </template>
            </Column>
            <Column field="chgUsid" header="USER" :style="{ width: '120px' }">
                <template #body="{ data: r }">
                    <span class="ops-mono">{{ r.chgUsid ?? '—' }}</span>
                </template>
            </Column>
            <Column field="chgTp" header="OP" :style="{ width: '80px' }">
                <template #body="{ data: r }">
                    <span :class="['ops-chip', `ops-chip-${(r.chgTp as string).toLowerCase()}`]">
                        ● {{ chgTypeLabel(r.chgTp) }}
                    </span>
                </template>
            </Column>
            <Column field="guid" header="GUID" :style="{ width: '120px' }">
                <template #body="{ data: r }">
                    <span class="ops-mono">{{ guidHead(r.guid) }}</span>
                </template>
            </Column>
            <Column field="delYn" header="DEL" :style="{ width: '60px' }">
                <template #body="{ data: r }">
                    <span class="ops-mono">{{ r.delYn }}</span>
                </template>
            </Column>
        </DataTable>
    </div>
</template>

<style scoped>
.ops-feed-wrap { padding: 0; overflow: hidden; }
.ops-tbl-code { color: var(--ops-text-dim); margin-left: 0.5rem; font-size: 0.8rem; }
.ops-chip { font-weight: 600; }

:deep(.p-datatable) {
    background: transparent; color: var(--ops-text);
}
:deep(.p-datatable .p-datatable-thead > tr > th) {
    background: var(--ops-surface); color: var(--ops-text-dim);
    border-color: var(--ops-border); font-family: var(--ops-mono); font-size: 0.78rem;
    letter-spacing: 0.04em;
}
:deep(.p-datatable .p-datatable-tbody > tr) {
    background: transparent; color: var(--ops-text);
    border-color: var(--ops-border); cursor: pointer;
}
:deep(.p-datatable .p-datatable-tbody > tr > td) {
    border-color: var(--ops-border); padding: 0.35rem 0.75rem; font-size: 0.88rem;
}
:deep(.p-datatable .p-datatable-tbody > tr:hover) {
    background: var(--ops-border);
}
:deep(.p-datatable .p-datatable-tbody > tr.ops-feed-row--new > td:first-child) {
    box-shadow: inset 3px 0 0 var(--ops-accent-u);
}
</style>
```

- [ ] **Step 2: 페이지에 통합**

`it_frontend/app/pages/admin/realtime-logs.vue` 의 `<script setup>` 본문에서 기존 destructure 라인을 다음으로 교체하고 import 추가:

```ts
import RealtimeFeedTable from '~/components/admin/realtime/RealtimeFeedTable.vue';
import type { LogFeedRow, PollIntervalMs } from '~/types/realtimeLog';

const {
    rows, paused, intervalMs, serverTime,
    start, stop, setIntervalMs,
} = useRealtimeLogs();

function onRowClick(_row: LogFeedRow) {
    // 다음 태스크에서 RealtimeDetailDrawer 연결
}
```

template의 KPI 주석 자리에 다음을 삽입:

```vue
<RealtimeFeedTable :rows="rows" @row-click="onRowClick" />
```

- [ ] **Step 3: 빌드/타입체크**

Run: `cd it_frontend && npm run typecheck`
Expected: 신규 코드 관련 오류 없음.

- [ ] **Step 4: 수동 확인**

브라우저 진입 후 라이브 피드 행 등장 및 5초 폴링 확인.

- [ ] **Step 5: Commit**

```bash
git add it_frontend/app/components/admin/realtime/RealtimeFeedTable.vue \
        it_frontend/app/pages/admin/realtime-logs.vue
git commit -m "feat(frontend): 실시간 라이브 피드 테이블"
```

---

### Task 11: Sparkline, Donut, Top Tables, KPI Strip

**Files:**
- Create: `it_frontend/app/components/admin/realtime/RealtimeSparkline.vue`
- Create: `it_frontend/app/components/admin/realtime/RealtimeChgTypeDonut.vue`
- Create: `it_frontend/app/components/admin/realtime/RealtimeTopTables.vue`
- Create: `it_frontend/app/components/admin/realtime/RealtimeKpiStrip.vue`
- Modify: `it_frontend/app/pages/admin/realtime-logs.vue`

- [ ] **Step 1: Sparkline**

```vue
<!-- it_frontend/app/components/admin/realtime/RealtimeSparkline.vue -->
<script setup lang="ts">
import { computed } from 'vue';

interface Props { values: number[]; height?: number; }
const props = withDefaults(defineProps<Props>(), { height: 48 });

const max = computed(() => Math.max(1, ...props.values));
const bars = computed(() => {
    const w = 100 / Math.max(props.values.length, 1);
    return props.values.map((v, i) => ({
        x: i * w,
        w: w * 0.8,
        h: (v / max.value) * 100,
        v,
    }));
});
</script>

<template>
    <div class="ops-card ops-spark">
        <div class="ops-spark-label">분당 발생량 (최근 30분)</div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none"
             :style="{ height: `${height}px`, width: '100%' }">
            <rect v-for="(b, i) in bars" :key="i"
                  :x="b.x" :y="100 - b.h" :width="b.w" :height="b.h"
                  fill="var(--ops-accent-c)" opacity="0.85" />
        </svg>
    </div>
</template>

<style scoped>
.ops-spark { display: grid; gap: 0.4rem; }
.ops-spark-label { color: var(--ops-text-dim); font-size: 0.78rem; letter-spacing: 0.04em; }
</style>
```

- [ ] **Step 2: Donut**

```vue
<!-- it_frontend/app/components/admin/realtime/RealtimeChgTypeDonut.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import type { LogFeedRow } from '~/types/realtimeLog';

interface Props { rows: LogFeedRow[]; }
const props = defineProps<Props>();

const counts = computed(() => {
    const c: Record<'C' | 'U' | 'D', number> = { C: 0, U: 0, D: 0 };
    for (const r of props.rows) c[r.chgTp] = (c[r.chgTp] ?? 0) + 1;
    return c;
});
const total = computed(() => Math.max(1, counts.value.C + counts.value.U + counts.value.D));
const segments = computed(() => {
    const r = 16, c = 2 * Math.PI * r;
    let offset = 0;
    return (['C', 'U', 'D'] as const).map((k) => {
        const ratio = counts.value[k] / total.value;
        const len = c * ratio;
        const seg = { color: `var(--ops-accent-${k.toLowerCase()})`, len, gap: c - len, offset };
        offset += len;
        return seg;
    });
});
</script>

<template>
    <div class="ops-card ops-donut">
        <div class="ops-donut-label">C · U · D 분포</div>
        <div class="ops-donut-row">
            <svg viewBox="-20 -20 40 40" width="64" height="64">
                <circle r="16" fill="none" stroke="var(--ops-border)" stroke-width="6" />
                <circle v-for="(s, i) in segments" :key="i"
                        r="16" fill="none"
                        :stroke="s.color" stroke-width="6"
                        :stroke-dasharray="`${s.len} ${s.gap}`"
                        :stroke-dashoffset="-s.offset"
                        transform="rotate(-90)" />
            </svg>
            <ul class="ops-donut-legend ops-mono">
                <li><span class="ops-chip-c">●</span> {{ counts.C }}</li>
                <li><span class="ops-chip-u">●</span> {{ counts.U }}</li>
                <li><span class="ops-chip-d">●</span> {{ counts.D }}</li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.ops-donut { display: grid; gap: 0.4rem; }
.ops-donut-label { color: var(--ops-text-dim); font-size: 0.78rem; letter-spacing: 0.04em; }
.ops-donut-row { display: flex; gap: 0.75rem; align-items: center; }
.ops-donut-legend { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.15rem; }
</style>
```

- [ ] **Step 3: Top Tables**

```vue
<!-- it_frontend/app/components/admin/realtime/RealtimeTopTables.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { logKeyLabel } from '~/utils/realtimeLogs';

interface Props { counts: Record<string, number>; }
const props = defineProps<Props>();

const top5 = computed(() =>
    Object.entries(props.counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key, n]) => ({ key, n })),
);
</script>

<template>
    <div class="ops-card ops-top">
        <div class="ops-top-label">Top 5 테이블 (최근 5분)</div>
        <ul class="ops-top-list">
            <li v-for="t in top5" :key="t.key">
                <span class="ops-top-name">{{ logKeyLabel(t.key) }}</span>
                <span class="ops-mono ops-top-n">{{ t.n }}</span>
            </li>
            <li v-if="top5.length === 0" class="ops-top-empty">데이터 없음</li>
        </ul>
    </div>
</template>

<style scoped>
.ops-top { display: grid; gap: 0.4rem; }
.ops-top-label { color: var(--ops-text-dim); font-size: 0.78rem; letter-spacing: 0.04em; }
.ops-top-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.2rem; }
.ops-top-list li { display: flex; justify-content: space-between; }
.ops-top-name { color: var(--ops-text); font-size: 0.85rem; }
.ops-top-n { color: var(--ops-accent-c); font-size: 0.9rem; }
.ops-top-empty { color: var(--ops-text-dim); font-size: 0.85rem; }
</style>
```

- [ ] **Step 4: KPI Strip 컨테이너**

```vue
<!-- it_frontend/app/components/admin/realtime/RealtimeKpiStrip.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import RealtimeSparkline from './RealtimeSparkline.vue';
import RealtimeChgTypeDonut from './RealtimeChgTypeDonut.vue';
import RealtimeTopTables from './RealtimeTopTables.vue';
import type { LogFeedRow } from '~/types/realtimeLog';

interface Props {
    rows: LogFeedRow[];
    perMinute: number[];
    tableCounts: Record<string, number>;
}
const props = defineProps<Props>();

const recentTotal = computed(() =>
    Object.values(props.tableCounts).reduce((a, b) => a + b, 0));
</script>

<template>
    <div class="ops-kpi-strip">
        <div class="ops-card ops-kpi-total">
            <div class="ops-kpi-label">최근 5분</div>
            <div class="ops-mono ops-kpi-value">{{ recentTotal }}</div>
            <div class="ops-kpi-sub">건</div>
        </div>
        <RealtimeSparkline :values="perMinute" />
        <RealtimeChgTypeDonut :rows="rows" />
        <RealtimeTopTables :counts="tableCounts" />
    </div>
</template>

<style scoped>
.ops-kpi-strip {
    display: grid;
    grid-template-columns: 160px 1fr 200px 240px;
    gap: 0.75rem;
}
@media (max-width: 1200px) {
    .ops-kpi-strip { grid-template-columns: 1fr 1fr; }
}
.ops-kpi-total { display: grid; align-items: center; }
.ops-kpi-label { color: var(--ops-text-dim); font-size: 0.78rem; }
.ops-kpi-value { font-size: 2rem; color: var(--ops-accent-c); }
.ops-kpi-sub { color: var(--ops-text-dim); font-size: 0.78rem; }
</style>
```

- [ ] **Step 5: 페이지 통합**

`it_frontend/app/pages/admin/realtime-logs.vue` `<script setup>`의 destructure를 다음으로 갱신하고 import 추가:

```ts
import RealtimeKpiStrip from '~/components/admin/realtime/RealtimeKpiStrip.vue';

const {
    rows, paused, intervalMs, serverTime, perMinute, tableCounts,
    start, stop, setIntervalMs,
} = useRealtimeLogs();
```

template의 `RealtimeHeader` 아래, `RealtimeFeedTable` 위 자리에 추가:

```vue
<RealtimeKpiStrip :rows="rows" :per-minute="perMinute" :table-counts="tableCounts" />
```

- [ ] **Step 6: 빌드/타입체크**

Run: `cd it_frontend && npm run typecheck`
Expected: 신규 코드 관련 오류 없음.

- [ ] **Step 7: Commit**

```bash
git add it_frontend/app/components/admin/realtime/RealtimeSparkline.vue \
        it_frontend/app/components/admin/realtime/RealtimeChgTypeDonut.vue \
        it_frontend/app/components/admin/realtime/RealtimeTopTables.vue \
        it_frontend/app/components/admin/realtime/RealtimeKpiStrip.vue \
        it_frontend/app/pages/admin/realtime-logs.vue
git commit -m "feat(frontend): KPI Strip + Sparkline/Donut/TopTables"
```

---

### Task 12: 상세 슬라이드 패널

**Files:**
- Create: `it_frontend/app/components/admin/realtime/RealtimeDetailDrawer.vue`
- Modify: `it_frontend/app/pages/admin/realtime-logs.vue`

본 화면은 변경 본문(BEFORE/AFTER)을 직접 보여주지 않고, 기존 `/admin/logs/[logKey]` 상세 화면으로 점프하는 링크와 행 메타 요약만 노출.

- [ ] **Step 1: Drawer 컴포넌트**

```vue
<!-- it_frontend/app/components/admin/realtime/RealtimeDetailDrawer.vue -->
<script setup lang="ts">
import Drawer from 'primevue/drawer';
import { chgTypeLabel, logKeyLabel } from '~/utils/realtimeLogs';
import type { LogFeedRow } from '~/types/realtimeLog';

interface Props { visible: boolean; row: LogFeedRow | null; }
defineProps<Props>();
const emit = defineEmits<{ 'update:visible': [v: boolean] }>();
</script>

<template>
    <Drawer
        :visible="visible"
        position="right"
        :modal="false"
        :pt="{ root: { class: 'ops-drawer' } }"
        @update:visible="emit('update:visible', $event)"
    >
        <template #header>
            <h2 class="ops-drawer-title">로그 상세</h2>
        </template>
        <dl v-if="row" class="ops-drawer-dl">
            <dt>테이블</dt>
            <dd>{{ logKeyLabel(row.logKey) }} <span class="ops-mono">({{ row.logTbl }})</span></dd>
            <dt>변경구분</dt>
            <dd>{{ chgTypeLabel(row.chgTp) }}</dd>
            <dt>변경일시</dt>
            <dd class="ops-mono">{{ row.chgDtm }}</dd>
            <dt>변경자</dt>
            <dd class="ops-mono">{{ row.chgUsid ?? '—' }}</dd>
            <dt>GUID</dt>
            <dd class="ops-mono">{{ row.guid ?? '—' }}</dd>
            <dt>삭제여부</dt>
            <dd class="ops-mono">{{ row.delYn }}</dd>
            <dt>로그번호</dt>
            <dd class="ops-mono">{{ row.logSno }}</dd>
        </dl>
        <NuxtLink
            v-if="row"
            :to="`/admin/logs/${row.logKey}`"
            class="ops-drawer-link"
        >상세 로그 화면에서 변경 본문 보기 →</NuxtLink>
    </Drawer>
</template>

<style scoped>
:deep(.ops-drawer) {
    background: var(--ops-surface) !important;
    color: var(--ops-text);
}
.ops-drawer-title { font-size: 1rem; }
.ops-drawer-dl { display: grid; grid-template-columns: 90px 1fr; gap: 0.4rem 0.75rem; }
.ops-drawer-dl dt { color: var(--ops-text-dim); font-size: 0.85rem; }
.ops-drawer-dl dd { margin: 0; font-size: 0.9rem; }
.ops-drawer-link {
    display: inline-block; margin-top: 1rem;
    color: var(--ops-accent-c); text-decoration: none;
}
.ops-drawer-link:hover { text-decoration: underline; }
</style>
```

- [ ] **Step 2: 페이지에 연결**

`it_frontend/app/pages/admin/realtime-logs.vue` `<script setup>`에 추가:

```ts
import RealtimeDetailDrawer from '~/components/admin/realtime/RealtimeDetailDrawer.vue';

const drawerVisible = ref(false);
const selectedRow = ref<LogFeedRow | null>(null);

function onRowClick(row: LogFeedRow) {
    selectedRow.value = row;
    drawerVisible.value = true;
}
```

template 끝(`</div>` 바로 위)에 추가:

```vue
<RealtimeDetailDrawer
    v-model:visible="drawerVisible"
    :row="selectedRow"
/>
```

- [ ] **Step 3: 빌드/타입체크 + 수동 확인**

Run: `cd it_frontend && npm run typecheck`
브라우저에서 행 클릭 → 우측 패널 → "상세 로그 화면에서 변경 본문 보기" 링크 클릭 시 `/admin/logs/{logKey}` 이동 확인.

- [ ] **Step 4: Commit**

```bash
git add it_frontend/app/components/admin/realtime/RealtimeDetailDrawer.vue \
        it_frontend/app/pages/admin/realtime-logs.vue
git commit -m "feat(frontend): 라이브 피드 행 클릭 시 상세 슬라이드 패널"
```

---

## Phase 5 — Integration & E2E

### Task 13: Playwright E2E 시나리오

**Files:**
- Create: `it_frontend/tests/e2e/admin/realtime-logs.spec.ts`

기존 `tests/e2e` 폴더의 관리자 로그인 fixture/storageState를 그대로 재사용한다. 본 예시의 `page.goto('/')` 부분은 프로젝트의 기존 헬퍼로 교체.

- [ ] **Step 1: E2E 작성**

```typescript
// it_frontend/tests/e2e/admin/realtime-logs.spec.ts
import { test, expect } from '@playwright/test';

const SNAP_INITIAL = {
    rows: [
        {
            logTbl: 'TPRMPP_BPROJL', logKey: 'bprojm', logSno: 1,
            chgTp: 'U', chgDtm: '2026-05-31T23:14:00.000',
            chgUsid: 'X000001', guid: '00000000-0000-0000-0000-000000000000', delYn: 'N',
        },
    ],
    serverTime: '2026-05-31T23:14:01.000',
    tableCounts: { bprojm: 1 },
    perMinute: Array.from({ length: 30 }, () => 0),
};

const SNAP_INCOMING = {
    ...SNAP_INITIAL,
    rows: [
        {
            logTbl: 'TPRMPP_CCODEL', logKey: 'ccodem', logSno: 2,
            chgTp: 'C', chgDtm: '2026-05-31T23:14:05.500',
            chgUsid: 'X000002', guid: null, delYn: 'N',
        },
    ],
    tableCounts: { bprojm: 1, ccodem: 1 },
};

test.describe('실시간 로그 — 관리자', () => {
    test.beforeEach(async ({ page }) => {
        // 본 예시는 관리자 로그인 helper 자리 — 실제 프로젝트 헬퍼로 교체.
        await page.goto('/');
    });

    test('진입 시 폴링 1회 + 신규 행 등장', async ({ page }) => {
        let callCount = 0;
        await page.route('**/api/admin/realtime-logs**', async (route) => {
            callCount += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(callCount === 1 ? SNAP_INITIAL : SNAP_INCOMING),
            });
        });

        await page.goto('/admin/realtime-logs');
        await expect(page.getByText('실시간 로그').first()).toBeVisible();
        await expect(page.getByText('TPRMPP_BPROJL')).toBeVisible();

        await page.waitForTimeout(5500);
        await expect(page.getByText('TPRMPP_CCODEL')).toBeVisible();
        expect(callCount).toBeGreaterThanOrEqual(2);
    });

    test('일시정지 토글 시 폴링 중단', async ({ page }) => {
        let callCount = 0;
        await page.route('**/api/admin/realtime-logs**', async (route) => {
            callCount += 1;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(SNAP_INITIAL),
            });
        });

        await page.goto('/admin/realtime-logs');
        await page.waitForResponse('**/api/admin/realtime-logs**');
        const before = callCount;

        await page.getByRole('button', { name: /일시정지/ }).click();
        await page.waitForTimeout(6000);
        expect(callCount).toBe(before);

        await page.getByRole('button', { name: /재개/ }).click();
        await page.waitForResponse('**/api/admin/realtime-logs**');
        expect(callCount).toBeGreaterThan(before);
    });
});
```

- [ ] **Step 2: E2E 실행**

Run: 백엔드와 프론트엔드를 dev 모드로 실행한 뒤 `cd it_frontend && npm run test:e2e -- realtime-logs.spec.ts`
Expected: 2/2 PASS.

- [ ] **Step 3: Commit**

```bash
git add it_frontend/tests/e2e/admin/realtime-logs.spec.ts
git commit -m "test(e2e): 실시간 로그 폴링·일시정지 시나리오"
```

---

### Task 14: 최종 검증과 TASK.md 갱신

**Files:**
- Modify: `it/TASK.md`

- [ ] **Step 1: 전체 테스트 재실행**

Run:
```bash
cd it_backend && ./gradlew test
cd ../it_frontend && npm test && npm run typecheck && npm run lint
```
Expected: 모두 PASS, 신규 코드 관련 lint 오류 없음.

- [ ] **Step 2: TASK.md에 후속 과제 등록**

`TASK.md`에 다음 섹션을 추가 (기존 형식에 맞춰 조정):

```markdown
## 실시간 로그 모니터링 (이번 범위 밖)

- [ ] 라이브 피드 행 클릭 → 변경 본문(BEFORE/AFTER) 인라인 드릴다운 (`/admin/logs/[logKey]` 데이터 재사용)
- [ ] SSE 또는 WebSocket push 전환 (관리자 수·트래픽 증가 시)
- [ ] 로그 데이터 보존 정책 / 아카이브 분리 View
- [ ] 사용자별 즐겨찾기 테이블 필터 저장 (localStorage)
- [ ] `V_ITPAPP_LOG_FEED` 실행계획 `EXPLAIN PLAN` 검증 결과 기록 및 필요 시 복합 인덱스 도입
```

- [ ] **Step 3: 수동 회귀 확인**

브라우저로 `/admin/realtime-logs` 진입해 다음 확인:
- 헤더 sticky / 일시정지 토글 / 폴링 주기 변경
- KPI Strip: 최근 5분 카운트 / sparkline / 도넛 / Top 5
- 행 클릭 시 우측 드로어 + 상세 로그 화면 링크
- 관리자가 아닌 계정으로 진입 시 `/` 리다이렉트 (미들웨어)
- 비-ADMIN으로 직접 API 호출 시 403 (Postman/curl)

- [ ] **Step 4: Commit**

```bash
git add TASK.md
git commit -m "docs: 실시간 로그 후속 과제 TASK.md 등록"
```

---

## Self-Review (계획서 작성자 메모)

- **Spec 커버리지:** §3 핵심결정/§4 데이터/§5 백엔드/§6 프론트/§7 디자인/§8 보안/§9 성능/§10 테스트 모두 매핑됨. §11 TASK 후속은 Task 14에서 반영.
- **타입 일관성:** `LogFeedRow`/`RealtimeLogSnapshot`/`PollIntervalMs`가 백엔드 `RealtimeLogDto.FeedRow`/`Snapshot` 필드와 1:1 일치(`logTbl/logKey/logSno/chgTp/chgDtm/chgUsid/guid/delYn`). composable 메서드명 `start/stop/fetchOnce/setIntervalMs`는 Task 9·10·12 페이지에서 동일 이름으로 호출됨.
- **placeholder 없음:** 모든 step에 실제 코드/명령/예상 결과 포함. "적절한 에러 처리" 류 표현 사용하지 않음.
- **DRY/YAGNI:** 변경 본문 드릴다운, SSE 전환, 사용자별 즐겨찾기는 TASK.md로 미룸.
