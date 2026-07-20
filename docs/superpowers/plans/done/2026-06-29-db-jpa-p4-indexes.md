# DB / JPA 최적화 P4 — 인덱스 검증(운영 의존) Implementation Plan

> **For agentic workers:** This is SQL / EXPLAIN + migration-script work, **not** TDD code. Do **not** write JUnit tests, do **not** modify Java source. Execute steps top-to-bottom. Record every EXPLAIN output verbatim into the notes file specified below. Author the `V*.sql` scripts exactly as written here (no placeholders). **Never apply to `dev`/`prod` — those are DBA-owned.** Do not git-commit unless the step says so; the human controller commits.

**Goal**: For the four P4 index items (#8 협의회 역방향 조회, #9 `findLatestVersionsAll`, #10 `Brivgm` 검토의견 목록, #11 실시간 로그 피드 `V_ITPAPP_LOG_FEED`), capture a baseline Oracle `EXPLAIN PLAN`, author a candidate composite index, re-measure, and — if improved — commit a new Flyway `V*.sql` migration to the `it_database` repo. dev/prod application is a DBA handoff and out of scope to apply.

**Architecture**: Local Oracle 21c XE holds the real schema (`ITPOWN`, owned objects, view `V_ITPAPP_LOG_FEED`). Indexes are added via additive, idempotent Flyway scripts under `it_database/migrations/`, auto-applied **only** on the `local-ext`/`local-int` profiles at Spring Boot startup (there is **no** Flyway Gradle plugin — `./gradlew flywayInfo` does not exist). Each item is verified by EXPLAIN before/after on the local DB.

**Tech Stack**: Oracle Database 21c XE; `sqlplus` (or SQLcl `sql`); `DBMS_XPLAN.DISPLAY`; Flyway (runtime, Spring Boot 4 `spring-boot-starter-flyway`); Spring Boot 4.1 / Java 25 backend.

---

## File Structure

| File | Repo / location | Action | Purpose |
| --- | --- | --- | --- |
| `docs/superpowers/notes/2026-06-29-p4-explain-results.md` | **root** repo (`C:/it`) | CREATE | Record baseline + post-index EXPLAIN output for all 4 items |
| `it_database/migrations/V20260629_002__AddCouncilReverseLookupIndexes.sql` | **`it_database`** repo | CREATE (if #8 improves) | Indexes for `BASCTM`/`BCMMTM` reverse lookup |
| `it_database/migrations/V20260629_003__AddBrdocmLatestVersionIndex.sql` | **`it_database`** repo | CREATE (if #9 improves) | Composite index for `findLatestVersionsAll()` |
| `it_database/migrations/V20260629_004__AddBrivgmCommentListIndex.sql` | **`it_database`** repo | CREATE (if #10 improves) | Composite index for `Brivgm` comment-list sort |
| `it_database/migrations/V20260629_005__AddRealtimeLogFeedIndex.sql` | **`it_database`** repo | CREATE (if #11 improves) | Cursor/aggregate covering index on the log base table |

> **Migration repo target (verified 2026-06-29):** `git -C C:/it/it_database rev-parse --show-toplevel` → `C:/it/it_database`; the existing `migrations/V20260627_001__AddDashboardListIndexes.sql` is tracked there (`git -C C:/it/it_database ls-files` confirms). New `V*.sql` scripts are committed in the **`it_database`** repo, NOT root and NOT `it_backend`. The root repo `.gitignore` excludes `it_database/`, so they will never appear in a `C:/it` commit.
>
> **Next version number (verified 2026-06-29):** the highest existing for date `20260629` is `V20260629_001__AddRefreshTokenFamily.sql`. New scripts therefore start at `_002` and increment per item.
>
> **Column-name verification (done while authoring this plan):** the spec's candidate column lists for #8 use the meta/logical names `PRJ_MNG_NO`/`PRJ_SNO`/`ASCT_ID`. The **physical** columns differ — confirmed against the entities:
> - `Basctm` (`TPRMPP_BASCTM`): `ABUS_MNG_NO`, `SNO`, `DEL_YN` (NOT `PRJ_MNG_NO`/`PRJ_SNO`).
> - `Bcmmtm` (`TPRMPP_BCMMTM`): `IT_PTL_ASCT_ID`, `ENO`, `DEL_YN` (the join/PK key is `IT_PTL_ASCT_ID`, NOT `ASCT_ID`).
> - `Brdocm`/`Brivgm`: version column is `DOC_VRS_SNO` (NOT `DOC_VRS`); `Brivgm.DOC_VRS_SNO` is `NUMBER(9,0)`.
> All `CREATE INDEX` statements below use the **physical** names.

---

## Phase 0 — Setup & guardrails

### Step 0.1 — Open sqlplus session against local Oracle
Run (Git Bash / PowerShell):
```
sqlplus ITPAPP/kdb1234!!@127.0.0.1:11521/XEPDB1
```
If `sqlplus` is unavailable, use SQLcl with identical args: `sql ITPAPP/kdb1234!!@127.0.0.1:11521/XEPDB1`.

At the SQL prompt, set the schema and formatting once per session:
```sql
ALTER SESSION SET CURRENT_SCHEMA = ITPOWN;
SET LINESIZE 200
SET PAGESIZE 1000
SET LONG 100000
```

### Step 0.2 — Verify exact table & view names
The physical names use the `TPRMPP_` prefix, but confirm before any EXPLAIN:
```sql
SELECT table_name FROM all_tables
 WHERE owner = 'ITPOWN'
   AND table_name IN ('TPRMPP_BASCTM','TPRMPP_BCMMTM','TPRMPP_BPROJM','TPRMPP_BRDOCM','TPRMPP_BRIVGM');

SELECT view_name FROM all_views
 WHERE owner = 'ITPOWN' AND view_name = 'V_ITPAPP_LOG_FEED';

-- Underlying object(s) the view reads (needed for #11):
SELECT text FROM all_views WHERE owner = 'ITPOWN' AND view_name = 'V_ITPAPP_LOG_FEED';
```
Record the confirmed names and the view definition in the notes file (Step 0.3). If any name differs from the assumption, **stop and reconcile** before continuing.

### Step 0.3 — Create the EXPLAIN results notes file
Create `C:/it/docs/superpowers/notes/2026-06-29-p4-explain-results.md` (root repo) with this skeleton, then fill each section as you go:
```markdown
# P4 인덱스 EXPLAIN 결과 (2026-06-29)

> 로컬 Oracle 21c XE (ITPAPP@127.0.0.1:11521/XEPDB1, CURRENT_SCHEMA=ITPOWN).
> 각 항목: (1) 베이스라인 PLAN, (2) 후보 인덱스, (3) 인덱스 적용 후 PLAN, (4) 판정(개선/무효).

## 0. 환경 확인
- 테이블/뷰 존재 확인 결과:
- V_ITPAPP_LOG_FEED 정의(하위 테이블 식별):

## #8 BASCTM / BCMMTM 역방향 조회
### 베이스라인 PLAN
### 후보 인덱스
### 적용 후 PLAN
### 판정

## #9 BRDOCM findLatestVersionsAll()
### 베이스라인 PLAN
### 후보 인덱스
### 적용 후 PLAN
### 판정

## #10 BRIVGM 검토의견 목록
### 기존 IX_BRIVGM_DOC_DEL_FSG 커버 여부
### 베이스라인 PLAN
### 후보 인덱스
### 적용 후 PLAN
### 판정

## #11 V_ITPAPP_LOG_FEED 실시간 로그 피드
### 뷰 EXPLAIN (피드 + 5분 + 30분 집계)
### 후보 인덱스
### 적용 후 PLAN
### 판정

## 요약
| # | 베이스라인 비용 | 적용 후 비용 | 인덱스 채택 | V*.sql |
| - | - | - | - | - |
```

> **Index-cleanup discipline:** every candidate `CREATE INDEX` you run manually during measurement (Steps b) must be dropped with `DROP INDEX <name>;` once the EXPLAIN is recorded, **unless** you immediately keep it via the Flyway script path. The local DB is shared with `@DataJpaTest` integration tests; leftover ad-hoc indexes pollute later runs. The Flyway scripts are the only sanctioned persistent change, and they are idempotent.

---

## Phase 1 — Item #8: 협의회 역방향 조회 (BASCTM / BCMMTM)

The two reverse-lookup queries are `CouncilRepository.findByDepartment` (BPROJM→BASCTM join filtered by `p.BBR_C`) and `CouncilRepository.findByCommitteeMember` (BCMMTM→BASCTM join filtered by `c.ENO`). The candidates target the BASCTM join keys and the BCMMTM evaluator lookup.

### Step 1a — Baseline EXPLAIN
At the sqlplus prompt (bind values are illustrative real-shaped literals; substitute any present `BBR_C`/`ENO` from data if needed):
```sql
EXPLAIN PLAN FOR
SELECT a.* FROM TPRMPP_BASCTM a
JOIN TPRMPP_BPROJM p ON a.ABUS_MNG_NO = p.ABUS_MNG_NO AND a.SNO = p.SNO
WHERE p.BBR_C = '18001' AND a.DEL_YN = 'N'
ORDER BY a.FST_ENR_DTM DESC;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

EXPLAIN PLAN FOR
SELECT a.* FROM TPRMPP_BASCTM a
JOIN TPRMPP_BCMMTM c ON a.IT_PTL_ASCT_ID = c.IT_PTL_ASCT_ID
WHERE c.ENO = '0000001' AND a.DEL_YN = 'N' AND c.DEL_YN = 'N'
ORDER BY a.FST_ENR_DTM DESC;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```
Record both plans (note FULL TABLE SCAN vs INDEX, and the `Cost` column) under `## #8 … 베이스라인 PLAN` in the notes file.

### Step 1b — Create candidate indexes locally + re-EXPLAIN
```sql
CREATE INDEX IX_BASCTM_PRJ_DEL ON TPRMPP_BASCTM (ABUS_MNG_NO, SNO, DEL_YN);
CREATE INDEX IX_BCMMTM_ENO_DEL_ASCT ON TPRMPP_BCMMTM (ENO, DEL_YN, IT_PTL_ASCT_ID);
```
Re-run **both** `EXPLAIN PLAN FOR … ; SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);` blocks from Step 1a. Record the post-index plans under `## #8 … 적용 후 PLAN`.

> Note: `BASCTM(ABUS_MNG_NO, SNO)` supports the join in `findByDepartment`; with low BASCTM row counts Oracle may still prefer a full scan — record the verdict honestly. `BCMMTM(ENO, DEL_YN, IT_PTL_ASCT_ID)` is a covering index for `findByCommitteeMember`'s `WHERE c.ENO=? AND c.DEL_YN=?` plus the `IT_PTL_ASCT_ID` join key.

### Step 1c — Decide & (if improved) keep via Flyway, else drop
If neither plan improves materially, drop both and mark #8 as "감내(인덱스 불필요)" in the notes, then skip to Phase 2:
```sql
DROP INDEX IX_BASCTM_PRJ_DEL;
DROP INDEX IX_BCMMTM_ENO_DEL_ASCT;
```
If improved, **drop the ad-hoc indexes** (the Flyway script re-creates them idempotently — do not leave duplicates), then write the migration:
```sql
DROP INDEX IX_BASCTM_PRJ_DEL;
DROP INDEX IX_BCMMTM_ENO_DEL_ASCT;
```
Create `it_database/migrations/V20260629_002__AddCouncilReverseLookupIndexes.sql` with this full content:
```sql
-- V20260629_002__AddCouncilReverseLookupIndexes.sql
-- 협의회 목록 역방향 조회(BASCTM/BCMMTM) 인덱스 (DB/JPA 최적화 P4 #8).
--   findByDepartment    : BPROJM→BASCTM 조인 a.ABUS_MNG_NO=p.ABUS_MNG_NO AND a.SNO=p.SNO, a.DEL_YN='N'
--   findByCommitteeMember: BCMMTM→BASCTM 조인 c.IT_PTL_ASCT_ID, 필터 c.ENO=:eno AND c.DEL_YN='N'
-- 물리 컬럼 검증: BASCTM(ABUS_MNG_NO, SNO, DEL_YN), BCMMTM(ENO, DEL_YN, IT_PTL_ASCT_ID).
-- 가산형(추가만)·멱등: 동일 인덱스명 존재 시 생성을 건너뛴다.
DECLARE
    FUNCTION idx_exists(p_idx VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n FROM ALL_INDEXES
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND INDEX_NAME = p_idx;
        RETURN n > 0;
    END;
BEGIN
    IF NOT idx_exists('IX_BASCTM_PRJ_DEL') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_BASCTM_PRJ_DEL ON TPRMPP_BASCTM (ABUS_MNG_NO, SNO, DEL_YN)';
    END IF;
    IF NOT idx_exists('IX_BCMMTM_ENO_DEL_ASCT') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_BCMMTM_ENO_DEL_ASCT ON TPRMPP_BCMMTM (ENO, DEL_YN, IT_PTL_ASCT_ID)';
    END IF;
END;
/
```

---

## Phase 2 — Item #9: BRDOCM `findLatestVersionsAll()`

Exact query is `ServiceRequestDocRepository.findLatestVersionsAll()` (verified, lines 96–105): `DEL_YN='N'` + correlated `MAX(DOC_VRS_SNO)` subquery per `DOC_MNG_NO` + `ORDER BY FST_ENR_DTM DESC`.

### Step 2a — Baseline EXPLAIN
```sql
EXPLAIN PLAN FOR
SELECT * FROM TPRMPP_BRDOCM d
WHERE d.DEL_YN = 'N'
  AND d.DOC_VRS_SNO = (
      SELECT MAX(d2.DOC_VRS_SNO) FROM TPRMPP_BRDOCM d2
      WHERE d2.DOC_MNG_NO = d.DOC_MNG_NO AND d2.DEL_YN = 'N'
  )
ORDER BY d.FST_ENR_DTM DESC;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```
Record under `## #9 … 베이스라인 PLAN`. Expect two BRDOCM scans (outer + correlated subquery) and a SORT ORDER BY.

### Step 2b — Create candidate index locally + re-EXPLAIN
```sql
CREATE INDEX IX_BRDOCM_DEL_DOC_VRS_FED ON TPRMPP_BRDOCM (DEL_YN, DOC_MNG_NO, DOC_VRS_SNO, FST_ENR_DTM);
```
Re-run the Step 2a EXPLAIN block. Record under `## #9 … 적용 후 PLAN`. The candidate lets the correlated `MAX(DOC_VRS_SNO)` per `(DEL_YN, DOC_MNG_NO)` resolve from the index and supplies `FST_ENR_DTM` for the sort.

### Step 2c — Decide & keep/drop
If not improved, `DROP INDEX IX_BRDOCM_DEL_DOC_VRS_FED;`, mark verdict, skip to Phase 3.
If improved, drop the ad-hoc index (`DROP INDEX IX_BRDOCM_DEL_DOC_VRS_FED;`) and create `it_database/migrations/V20260629_003__AddBrdocmLatestVersionIndex.sql`:
```sql
-- V20260629_003__AddBrdocmLatestVersionIndex.sql
-- 요구사항정의서 목록 최신버전 조회(findLatestVersionsAll) 인덱스 (DB/JPA 최적화 P4 #9).
-- 쿼리: DEL_YN='N' + 상관서브쿼리 MAX(DOC_VRS_SNO) per DOC_MNG_NO + ORDER BY FST_ENR_DTM DESC.
-- 물리 컬럼 검증: 버전 컬럼은 DOC_VRS_SNO(NUMBER(9,0)).
-- 가산형(추가만)·멱등.
DECLARE
    FUNCTION idx_exists(p_idx VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n FROM ALL_INDEXES
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND INDEX_NAME = p_idx;
        RETURN n > 0;
    END;
BEGIN
    IF NOT idx_exists('IX_BRDOCM_DEL_DOC_VRS_FED') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_BRDOCM_DEL_DOC_VRS_FED ON TPRMPP_BRDOCM (DEL_YN, DOC_MNG_NO, DOC_VRS_SNO, FST_ENR_DTM)';
    END IF;
END;
/
```

---

## Phase 3 — Item #10: BRIVGM 검토의견 목록

Exact query is `BrivgmRepository.findByDocMngNoAndDocVrsSnoAndDelYnOrderByFstEnrDtmAsc` (verified): filter `(DOC_MNG_NO, DOC_VRS_SNO, DEL_YN)` + `ORDER BY FST_ENR_DTM ASC`.

### Step 3a — Confirm the existing index does NOT cover this sort
The existing `IX_BRIVGM_DOC_DEL_FSG` is `(DOC_MNG_NO, DEL_YN, FSG_YN)` — created in `V20260627_001__AddDashboardListIndexes.sql` for the **dashboard EXISTS** predicate (미해결 검토의견), NOT for this comment-list query. It lacks `DOC_VRS_SNO` and `FST_ENR_DTM`, so it cannot satisfy the `DOC_VRS_SNO` equality nor avoid a sort. Confirm the definition on the live DB and record it:
```sql
SELECT index_name, column_name, column_position
  FROM all_ind_columns
 WHERE index_owner = 'ITPOWN' AND table_name = 'TPRMPP_BRIVGM'
 ORDER BY index_name, column_position;
```
Record the columns of `IX_BRIVGM_DOC_DEL_FSG` under `## #10 … 기존 IX_BRIVGM_DOC_DEL_FSG 커버 여부` and state explicitly that it does not cover this query.

### Step 3b — Baseline EXPLAIN
```sql
EXPLAIN PLAN FOR
SELECT * FROM TPRMPP_BRIVGM
 WHERE DOC_MNG_NO = 'DOC-2026-0001' AND DOC_VRS_SNO = 100 AND DEL_YN = 'N'
 ORDER BY FST_ENR_DTM ASC;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```
Record under `## #10 … 베이스라인 PLAN`. Expect either a full scan or use of `IX_BRIVGM_DOC_DEL_FSG` followed by a SORT ORDER BY.

### Step 3c — Create candidate index locally + re-EXPLAIN
```sql
CREATE INDEX IX_BRIVGM_DOC_VRS_DEL_FED ON TPRMPP_BRIVGM (DOC_MNG_NO, DOC_VRS_SNO, DEL_YN, FST_ENR_DTM);
```
Re-run Step 3b. Record under `## #10 … 적용 후 PLAN`. The candidate satisfies all three equality predicates and returns rows in `FST_ENR_DTM` order, eliminating the sort.

### Step 3d — Decide & keep/drop
If not improved, `DROP INDEX IX_BRIVGM_DOC_VRS_DEL_FED;`, mark verdict, skip to Phase 4.
If improved, drop the ad-hoc index (`DROP INDEX IX_BRIVGM_DOC_VRS_DEL_FED;`) and create `it_database/migrations/V20260629_004__AddBrivgmCommentListIndex.sql`:
```sql
-- V20260629_004__AddBrivgmCommentListIndex.sql
-- 문서 검토의견 목록 조회(findByDocMngNoAndDocVrsSnoAndDelYnOrderByFstEnrDtmAsc) 인덱스 (DB/JPA 최적화 P4 #10).
-- 필터: (DOC_MNG_NO, DOC_VRS_SNO, DEL_YN) 등치 + ORDER BY FST_ENR_DTM ASC.
-- 기존 IX_BRIVGM_DOC_DEL_FSG(DOC_MNG_NO, DEL_YN, FSG_YN)는 대시보드 EXISTS용 별개 인덱스로
-- DOC_VRS_SNO/FST_ENR_DTM 미포함 → 본 정렬을 커버하지 못함(검증 2026-06-29).
-- 가산형(추가만)·멱등.
DECLARE
    FUNCTION idx_exists(p_idx VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n FROM ALL_INDEXES
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND INDEX_NAME = p_idx;
        RETURN n > 0;
    END;
BEGIN
    IF NOT idx_exists('IX_BRIVGM_DOC_VRS_DEL_FED') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_BRIVGM_DOC_VRS_DEL_FED ON TPRMPP_BRIVGM (DOC_MNG_NO, DOC_VRS_SNO, DEL_YN, FST_ENR_DTM)';
    END IF;
END;
/
```

---

## Phase 4 — Item #11: 실시간 로그 피드 (`V_ITPAPP_LOG_FEED`)

Exact queries are in `RealtimeLogRepository`: the cursor feed (`findFeed`), the 5-minute count (`countByTableSince`), and the 30-minute per-minute bucket (`perMinuteSince`). The feed orders by `CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC` with optional `LOG_KEY IN (…)` / `CHG_DTT_YN IN (…)` filters and `FETCH FIRST :limit ROWS ONLY`.

### Step 4a — EXPLAIN the view (feed + both aggregates)
The view is a projection over one or more underlying log tables (identify them from `all_views.text` captured in Step 0.2). EXPLAIN through the view so the optimizer expands it:
```sql
-- Feed (initial snapshot path: no cursor, ordered, limited)
EXPLAIN PLAN FOR
SELECT LOG_TBL, LOG_KEY, LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, DEL_YN
  FROM V_ITPAPP_LOG_FEED
 WHERE 1=1
 ORDER BY CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC
 FETCH FIRST 200 ROWS ONLY;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- Feed (incremental cursor path)
EXPLAIN PLAN FOR
SELECT LOG_TBL, LOG_KEY, LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM, CHG_USID, GUID, DEL_YN
  FROM V_ITPAPP_LOG_FEED
 WHERE ( CHG_DTM > TIMESTAMP '2026-06-29 00:00:00'
         OR (CHG_DTM = TIMESTAMP '2026-06-29 00:00:00' AND LOG_TBL > ' ')
         OR (CHG_DTM = TIMESTAMP '2026-06-29 00:00:00' AND LOG_TBL = ' ' AND LOG_HIS_TGR_SNO > 0) )
 ORDER BY CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC
 FETCH FIRST 200 ROWS ONLY;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- 5-minute aggregate
EXPLAIN PLAN FOR
SELECT LOG_KEY, COUNT(*) FROM V_ITPAPP_LOG_FEED
 WHERE CHG_DTM > TIMESTAMP '2026-06-29 00:00:00'
 GROUP BY LOG_KEY;
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);

-- 30-minute per-minute aggregate
EXPLAIN PLAN FOR
SELECT TRUNC(CHG_DTM, 'MI') AS BUCKET, COUNT(*) FROM V_ITPAPP_LOG_FEED
 WHERE CHG_DTM > TIMESTAMP '2026-06-29 00:00:00'
 GROUP BY TRUNC(CHG_DTM, 'MI');
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```
Record all four plans under `## #11 … 뷰 EXPLAIN`. Note which **underlying log table(s)** appear in the expanded plan and whether they full-scan.

### Step 4b — Create candidate covering index on the underlying log table + re-EXPLAIN
The view sorts/filters on `CHG_DTM`, `LOG_TBL`, `LOG_HIS_TGR_SNO`, `LOG_KEY`, `CHG_DTT_YN`. The driving predicate/sort key for both the cursor and the aggregates is `CHG_DTM`. Create a candidate on the **actual base table** identified in Step 4a (the view likely exposes a `LOG_TBL`/`LOG_KEY`-discriminated union or a single history table — use the real owning table/column names from the view text; the example below assumes a single base table `TPRMPP_<LOGBASE>` with these columns — substitute the verified name):
```sql
-- Substitute TPRMPP_<LOGBASE> with the base table from Step 4a's view definition.
CREATE INDEX IX_LOGFEED_CHGDTM_CURSOR
    ON TPRMPP_<LOGBASE> (CHG_DTM, LOG_TBL, LOG_HIS_TGR_SNO, LOG_KEY, CHG_DTT_YN);
```
Re-run all four EXPLAIN blocks from Step 4a. Record under `## #11 … 적용 후 PLAN`.

> If the view is a `UNION ALL` over multiple per-domain `*L` log tables, a single covering index is not possible; instead record that finding and propose a per-table `(CHG_DTM, …)` index pattern in the notes, and scope the actual `CREATE INDEX` to the highest-volume base table(s) only. Do **not** invent table names — use exactly what the view text shows.

### Step 4c — Decide & keep/drop
If not improved (e.g., the view materializes/sorts regardless, or row counts are tiny), `DROP INDEX IX_LOGFEED_CHGDTM_CURSOR;`, mark verdict, skip to Phase 5.
If improved, drop the ad-hoc index (`DROP INDEX IX_LOGFEED_CHGDTM_CURSOR;`) and create `it_database/migrations/V20260629_005__AddRealtimeLogFeedIndex.sql` (replace `TPRMPP_<LOGBASE>` with the verified base table name):
```sql
-- V20260629_005__AddRealtimeLogFeedIndex.sql
-- 실시간 로그 피드(V_ITPAPP_LOG_FEED) 커서/집계 커버 인덱스 (DB/JPA 최적화 P4 #11).
-- 피드 정렬: CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC + LOG_KEY/CHG_DTT_YN 필터.
-- 5/30분 집계: WHERE CHG_DTM > :since GROUP BY LOG_KEY / TRUNC(CHG_DTM,'MI').
-- 대상 테이블은 V_ITPAPP_LOG_FEED 하위 로그 테이블(EXPLAIN으로 확정, 2026-06-29).
-- 가산형(추가만)·멱등.
DECLARE
    FUNCTION idx_exists(p_idx VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n FROM ALL_INDEXES
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND INDEX_NAME = p_idx;
        RETURN n > 0;
    END;
BEGIN
    IF NOT idx_exists('IX_LOGFEED_CHGDTM_CURSOR') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_LOGFEED_CHGDTM_CURSOR ON TPRMPP_<LOGBASE> (CHG_DTM, LOG_TBL, LOG_HIS_TGR_SNO, LOG_KEY, CHG_DTT_YN)';
    END IF;
END;
/
```

---

## Phase 5 — Flyway local verification

> There is **no Flyway Gradle plugin** in `it_backend/build.gradle` (verified 2026-06-29 — no `id 'org.flywaydb...'`, no `flyway {}` block). `./gradlew flywayInfo` does **not** exist. Flyway runs at Spring Boot startup, gated by `spring.flyway.enabled` which is `true` only on `local-ext`/`local-int`. The `local-ext` profile reads scripts directly from `filesystem:../it_database/migrations` (verified in `application-local-ext.properties`).

### Step 5.1 — Apply via local-ext startup
From `it_backend`, with the local Oracle running, start the backend on the `local-ext` profile (the FLYWAY_USER/PASSWORD must have DDL rights on `ITPOWN`; locally `ITPAPP` has DBA):
```
cd it_backend
SPRING_PROFILES_ACTIVE=local-ext ./gradlew bootRun
```
On startup Flyway scans `../it_database/migrations`, sees the new `V20260629_002..005` scripts as newer than the baseline (`baseline-version=20260620.001`), and applies the ones you created. Watch the log for `Migrating schema "ITPOWN" to version 20260629.00x …`. Stop the server (Ctrl+C) once migration log lines appear.

### Step 5.2 — Confirm applied + indexes present
In sqlplus:
```sql
ALTER SESSION SET CURRENT_SCHEMA = ITPOWN;
SELECT version, description, success, installed_on
  FROM "flyway_schema_history"
 WHERE version LIKE '20260629%'
 ORDER BY installed_rank;

SELECT index_name, table_name FROM all_indexes
 WHERE owner = 'ITPOWN'
   AND index_name IN ('IX_BASCTM_PRJ_DEL','IX_BCMMTM_ENO_DEL_ASCT',
                      'IX_BRDOCM_DEL_DOC_VRS_FED','IX_BRIVGM_DOC_VRS_DEL_FED',
                      'IX_LOGFEED_CHGDTM_CURSOR');
```
Only the indexes for items that improved should be present (others were dropped and have no script). Record the `flyway_schema_history` rows and the index list in the notes file `## 요약` table. If a migration shows `success = 0`, investigate the script (idempotency guard, table/column name) and fix in a **new** version — never edit an applied script (checksum is immutable).

---

## Phase 6 — Commit (it_database repo)

> Commit only the scripts that were actually authored (improved items). The controller performs the commit; this step documents the exact target and message.

### Step 6.1 — Stage & commit in the it_database repo
```
cd C:/it/it_database
git add migrations/V20260629_002__AddCouncilReverseLookupIndexes.sql \
        migrations/V20260629_003__AddBrdocmLatestVersionIndex.sql \
        migrations/V20260629_004__AddBrivgmCommentListIndex.sql \
        migrations/V20260629_005__AddRealtimeLogFeedIndex.sql
git commit -m "perf: P4 인덱스 후보 마이그레이션 (협의회 역방향/BRDOCM 최신버전/BRIVGM 검토의견/실시간 로그 피드)"
```
(Drop from the `git add` any script that was not created because the item showed no improvement.)

### Step 6.2 — Commit the EXPLAIN notes in the root repo
The notes file lives in the root repo and is committed separately:
```
cd C:/it
git add docs/superpowers/notes/2026-06-29-p4-explain-results.md
git commit -m "docs: P4 인덱스 EXPLAIN 검증 결과 기록"
```

> **DBA handoff (out of scope to apply):** `dev`/`prod` have `spring.flyway.enabled=false` and are DBA-applied. Do **not** run these scripts against dev/prod. Hand off the four `V*.sql` scripts plus the EXPLAIN before/after evidence (notes file) to the DBA as the W4 operational checklist item. The "code-side complete" gate is: scripts authored + local EXPLAIN improvement recorded + local Flyway apply confirmed.

---

## Self-Review

Before declaring P4 complete, verify each:

- [ ] **Notes file created** at `C:/it/docs/superpowers/notes/2026-06-29-p4-explain-results.md` with baseline + post-index plans for all four items (or an explicit "no improvement / 감내" verdict where an index was rejected).
- [ ] **Table/view names verified** on the live DB (Step 0.2) before any EXPLAIN — no assumed names left unconfirmed.
- [ ] **Physical column names used** in every `CREATE INDEX`: `BASCTM(ABUS_MNG_NO, SNO, DEL_YN)`, `BCMMTM(ENO, DEL_YN, IT_PTL_ASCT_ID)`, `BRDOCM(DEL_YN, DOC_MNG_NO, DOC_VRS_SNO, FST_ENR_DTM)`, `BRIVGM(DOC_MNG_NO, DOC_VRS_SNO, DEL_YN, FST_ENR_DTM)` — NOT the spec's meta names `PRJ_MNG_NO`/`PRJ_SNO`/`ASCT_ID`/`DOC_VRS`.
- [ ] **#11 base table resolved** from the view definition (not assumed); `TPRMPP_<LOGBASE>` placeholder replaced with the real name in both the ad-hoc index and the `V20260629_005` script; if the view is a UNION ALL, the multi-table finding is recorded and the script scoped accordingly.
- [ ] **Ad-hoc indexes dropped** after measurement; only the Flyway-managed indexes persist (verified via `all_indexes` in Step 5.2). No duplicate index names.
- [ ] **Existing `IX_BRIVGM_DOC_DEL_FSG` confirmed** as a separate dashboard index that does not cover the #10 sort (Step 3a recorded).
- [ ] **New script versions** are `V20260629_002..005` (next available after the existing `_001`); no existing applied script was edited.
- [ ] **Idempotent guard** (`idx_exists`) present in every new script, mirroring `V20260627_001`.
- [ ] **Flyway local apply confirmed** via `local-ext` startup + `flyway_schema_history` rows with `success = 1` (Step 5.2) — `./gradlew flywayInfo` was NOT used (it does not exist).
- [ ] **Commit targets correct**: `V*.sql` committed in the **`it_database`** repo, notes file committed in the **root** repo.
- [ ] **dev/prod NOT touched** — scripts handed to DBA as W4 checklist; this plan only authored + locally verified.
