# 공통코드 변경(마이그레이션) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `code.csv`(31그룹) 기준으로 공통코드(CCODEM) 그룹ID/값ID/명칭을 신규 체계로 전환하고, 업무데이터의 잔존 구값을 백필하며, 백엔드/프론트의 구 그룹ID 리터럴을 신규명으로 교체한다.

**Architecture:** Hybrid A+B 빅뱅 배포. ① CCODEM 영향 그룹을 백업 후 신규 목표 상태로 재적재(Flyway). ② 값ID가 바뀐 컬럼만 멱등 백필(이미 목표값 행은 미변경). ③ BE는 그룹ID를 `CommonCodeGroups` 상수 1곳으로 집약 후 교체, FE는 `useCodeOptions`/`$apiFetch` 인자를 신규명으로 교체. DB·WAR·프론트 generate를 단일 조정 배포.

**Tech Stack:** Oracle 21c XE + Flyway(`it_database/migrations`), Spring Boot(`it_backend`, Java/JPA/QueryDSL), Nuxt 4(`it_frontend`, TS/Vue).

**SoT:** 설계서 `docs/superpowers/specs/2026-06-06-common-code-migration-design.md`. 입력 `C:\it\code.csv`(값ID 정렬 정합 완료).

---

## 매핑 부록 (Authoritative Mapping) — 모든 단계의 기준

### A. 그룹ID 리네임 (값ID 불변, 31그룹 중 변경분)

| old CO_C_ID | new CO_C_ID | 비고 |
|---|---|---|
| TMN_MAGR | IT_PTL_TMN_KD_TC | 리네임 |
| TMN_KD | IT_PTL_TMN_SVC_TC | 병합(001~008 유지) |
| TCHN_TP | IT_PTL_TCHN_TP_TC | |
| SD | SD_TC | |
| RPR_STS | IT_PTL_RPR_STS_TC | |
| PRJ_PUL_PTT | EXE_PTT_YN | |
| MN_USR | CST_TP_TC | |
| IOE | IOE_C | 서브 cTp(IOE_LEAFE 등)는 불변 |
| INFM_SVC | INFM_SVC_TC | |
| CUR | CUR_C | 값ID=통화코드 유지 |

> 명칭만 변경(그룹ID 불변): SYS_RQC, SYS_PVC, PRJ_TP, PRIT_C, NAC_TP, KPN_TC, DUP_IOE, DUP_AMT, DCD_STS, CKG_ITM_C, BZ_DTT, BLB_TC, BG_RQS.
> 대상 제외(현재 CSV 미존재): VLR_TC, ASCT_STS_C, DBR_TC.

### B. 그룹ID + 값ID 동시 변경 (병합/리맵)

| old → new 그룹 | 값ID 매핑 |
|---|---|
| TMN_USG → IT_PTL_TMN_SVC_TC | `001→009`(트레이딩), `002→010`(리서치), `003→011`(리스크관리), `999→999`(기타) |
| EDRT_MNGC → IT_PTL_EDRT_TC | `001→10`, `002→11`, `003→12`, `004→13` |
| EDRT_CPIT → IT_PTL_EDRT_TC | `001→20`, `002→21`, `003→22`, `004→23` |
| PUL_DTT → ABUS_TC | `001→01`, `002→02` |
| IT_MNGC_TP → TMN_YN | `001→0`, `002→1` |
| DFR_CLE → DFR_CLE_C | `001→1`, `002→2`, `003→3`, `004→4`, `999→9` |
| APF_STS → APF_PRG_STS_C | `01→1`, `02→2`, `03→3`, `04→4` |
| ABUS_C → BG_UNT_ABUS_C | `01→501`, `502→502` |

### C. 업무데이터 백필 규칙 (실측 기반, 멱등)

| 테이블.컬럼 | 변환 | WHERE (대상 한정) |
|---|---|---|
| `TPRMPP_BPROJM.ABUS_TC` | 변경 없음 | — (이미 `01`) |
| `TPRMPP_BCOSTM.BG_UNT_ABUS_C` | 변경 없음 | — (이미 `501/502`) |
| `TPRMPP_BCOSTM.DFR_CLE_C` | `0→1`, `001→1,002→2,003→3,004→4,999→9` | `IN ('0','001','002','003','004','999')` |
| `TPRMPP_BTERMM.DFR_CLE_C` | `0→1`, `001~999→1~4/9` | `IN ('0','001','002','003','004','999')` |
| `TPRMPP_BCOSTM.TMN_YN` | `001→0, 002→1` | `IN ('001','002')` (NULL 유지) |
| `TPRMPP_CAPPLM.APF_PRG_STS_C` | `01→1,02→2,03→3,04→4` | `IN ('01','02','03','04')` |
| `TPRMPP_BTERMM.IT_PTL_TMN_SVC_TC` | `001~003` 랜덤 | `IS NULL` (더티 데이터) |
| `TPRMPP_BTERMM.IT_PTL_TMN_KD_TC` | `001~003` 랜덤 | 코드값(`'001','002','003'`)이 아닌 모든 행 |

> EDRT(`IT_PTL_EDRT_TC`)는 전결권 임계값 **조회 전용** — 업무 컬럼 저장 여부를 Phase 0에서 확인 후 필요시에만 백필.
> TMN_USG 재번호(009~011) 저장 컬럼은 Phase 0에서 실재 여부 확인(현재 BE/FE 미참조).

---

## File Structure

**DB (신규 생성):**
- `it_database/migrations/_data/code-mapping.reviewed.csv` — 검증된 old→new 매핑(SoT, Phase 0)
- `it_database/migrations/V20260606_001__MigrateCommonCodes.sql` — CCODEM 재적재
- `it_database/migrations/V20260606_002__BackfillBusinessCodeValues.sql` — 업무데이터 백필
- `it_database/migrations/_verify/code-migration-verify.sql` — 고아/분포 검증 쿼리(커밋용, Flyway 비대상)

**Backend (신규 1 + 수정):**
- Create: `it_backend/src/main/java/com/kdb/it/common/code/CommonCodeGroups.java` — 그룹ID 상수 집약
- Modify: `ProjectService.java`, `CostService.java`, `BudgetWorkService.java`, `PlanService.java`, `BudgetStatusQueryRepositoryImpl.java`, `ItBudgetQueryRepositoryImpl.java`, `XcrLookupService.java`, `CodeService.java`, `ApplicationRepository.java` (+ 각 테스트)

**Frontend (수정):**
- Create: `it_frontend/app/constants/codeGroups.ts` — 그룹ID 상수
- Modify: `useCostListPage.ts`, `useBudgetStatusCostTab.ts`, `useBudgetAllocationSummary.ts`, `info/projects/form.vue`, `info/cost/form.vue`, `budget/list.vue`, `budget/status.vue`, `budget/approval.vue`, `info/plan/*.vue`, `cost/*.vue`, `pages/info/cost/form.vue` (값ID `PUL_DTT_002`) 외

---

## Phase 0 — 매핑 확정 & 데이터 감사

### Task 0.1: 검증된 매핑 CSV 생성

**Files:**
- Create: `it_database/migrations/_data/code-mapping.reviewed.csv`

- [ ] **Step 1: code.csv를 값ID join 규칙으로 파싱하여 매핑 CSV 작성**

`C:\it\code.csv`의 각 행에서 기존(좌 13컬럼)·변경(우 13컬럼)을 값ID로 짝지어 아래 헤더로 산출. TMN_USG는 부록 B대로 009/010/011 재번호 적용(code.csv의 naive 001/002/003을 덮어씀).

```
old_cid,old_cdva,new_cid,new_cdva,new_cdva_nm,new_c_nm,new_seq,new_hrk,new_stt,new_end,value_changed
TMN_USG,001,IT_PTL_TMN_SVC_TC,009,트레이딩,단말기용도,,,2026-03-31,9999-12-31,Y
TMN_KD,001,IT_PTL_TMN_SVC_TC,001,코스콤체크,단말기종류,,,2026-03-31,9999-12-31,N
TCHN_TP,004,IT_PTL_TCHN_TP_TC,004,블록체인,기술유형,,,2026-03-31,9999-12-31,N
...
```

- [ ] **Step 2: 행수 검증**

Run: `(Get-Content it_database\migrations\_data\code-mapping.reviewed.csv | Measure-Object -Line).Lines`
Expected: 157 (헤더 1 + 156 데이터 행)

- [ ] **Step 3: TMN 충돌 0건 확인**

`new_cid='IT_PTL_TMN_SVC_TC'`의 `new_cdva`가 {001~008, 009, 010, 011, 999}로 **중복 없이 12개**인지 확인.

- [ ] **Step 4: Commit**

```bash
git add it_database/migrations/_data/code-mapping.reviewed.csv
git commit -m "chore(db): 공통코드 검증 매핑 CSV(SoT) 추가"
```

### Task 0.2: 백필 전 분포 스냅샷 + 시퀀스/컬럼 실재 확인

**Files:**
- Create: `it_database/migrations/_verify/code-migration-verify.sql`

- [ ] **Step 1: 분포/고아 검증 쿼리 작성**

```sql
-- 백필 대상 컬럼 현재 분포
SELECT 'BCOSTM.DFR_CLE_C' col, DFR_CLE_C v, COUNT(*) c FROM ITPAPP.TPRMPP_BCOSTM WHERE DEL_YN='N' GROUP BY DFR_CLE_C
UNION ALL SELECT 'BTERMM.DFR_CLE_C', DFR_CLE_C, COUNT(*) FROM ITPAPP.TPRMPP_BTERMM GROUP BY DFR_CLE_C
UNION ALL SELECT 'BCOSTM.TMN_YN', TMN_YN, COUNT(*) FROM ITPAPP.TPRMPP_BCOSTM WHERE DEL_YN='N' GROUP BY TMN_YN
UNION ALL SELECT 'CAPPLM.APF_PRG_STS_C', APF_PRG_STS_C, COUNT(*) FROM ITPAPP.TPRMPP_CAPPLM WHERE DEL_YN='N' GROUP BY APF_PRG_STS_C
UNION ALL SELECT 'BTERMM.IT_PTL_TMN_SVC_TC', IT_PTL_TMN_SVC_TC, COUNT(*) FROM ITPAPP.TPRMPP_BTERMM GROUP BY IT_PTL_TMN_SVC_TC
UNION ALL SELECT 'BTERMM.IT_PTL_TMN_KD_TC', IT_PTL_TMN_KD_TC, COUNT(*) FROM ITPAPP.TPRMPP_BTERMM GROUP BY IT_PTL_TMN_KD_TC
ORDER BY 1,2;

-- 고아 검출: 업무 컬럼 값이 CCODEM(신규 그룹)에 없는 행
SELECT 'BCOSTM.DFR_CLE_C' src, c.DFR_CLE_C v, COUNT(*) n
FROM ITPAPP.TPRMPP_BCOSTM c
WHERE c.DEL_YN='N' AND c.DFR_CLE_C IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ITPAPP.TPRMPP_CCODEM m WHERE m.CO_C_ID='DFR_CLE_C' AND m.CDVA_ID=c.DFR_CLE_C AND m.DEL_YN='N')
GROUP BY c.DFR_CLE_C;

-- CCODEL 시퀀스 실재 확인
SELECT SEQUENCE_NAME FROM USER_SEQUENCES WHERE SEQUENCE_NAME LIKE '%CCODEL%';
-- EDRT 업무 저장 컬럼 실재 확인(전결권이 업무테이블에 저장되는지)
SELECT TABLE_NAME, COLUMN_NAME FROM USER_TAB_COLS WHERE COLUMN_NAME LIKE '%EDRT%';
```

- [ ] **Step 2: 실행하여 "before" 분포 캡처**

Run: `.\it_database\connect-db.ps1` 또는 `sqlplus ITPAPP/<pw>@127.0.0.1:1521/XEPDB1 @it_database\migrations\_verify\code-migration-verify.sql`
Expected: `BCOSTM.DFR_CLE_C='0' 19`, `BTERMM.DFR_CLE_C='0' 115`, `BTERMM.IT_PTL_TMN_SVC_TC NULL 115` 등 설계서 §4.2와 일치. CCODEL 시퀀스명·EDRT 컬럼 유무 기록.

- [ ] **Step 3: Commit**

```bash
git add it_database/migrations/_verify/code-migration-verify.sql
git commit -m "chore(db): 공통코드 마이그레이션 검증 쿼리 추가"
```

---

## Phase 1 — CCODEM 재적재 (Flyway)

### Task 1.1: 백업 + 영향 그룹 정리 + 신규 적재 마이그레이션 작성

**Files:**
- Create: `it_database/migrations/V20260606_001__MigrateCommonCodes.sql`

- [ ] **Step 1: 백업 CTAS + 영향 그룹 DELETE 작성 (멱등 가드 포함)**

```sql
-- V20260606_001__MigrateCommonCodes.sql
-- 공통코드 그룹ID/값ID 신규 체계 재적재. 멱등: 신규 그룹 존재 시 재실행 영향 없음.

-- 1) 백업 (이미 있으면 건너뜀)
DECLARE v NUMBER;
BEGIN
  SELECT COUNT(*) INTO v FROM USER_TABLES WHERE TABLE_NAME='TPRMPP_CCODEM_BAK_20260606';
  IF v=0 THEN
    EXECUTE IMMEDIATE 'CREATE TABLE ITPAPP.TPRMPP_CCODEM_BAK_20260606 AS SELECT * FROM ITPAPP.TPRMPP_CCODEM';
  END IF;
END;
/

-- 2) 영향 old 그룹 + 신규 그룹 제거(재실행 대비 클린 슬레이트)
DELETE FROM ITPAPP.TPRMPP_CCODEM WHERE CO_C_ID IN (
  'TMN_USG','TMN_MAGR','TMN_KD','TCHN_TP','SD','RPR_STS','PRJ_PUL_PTT','MN_USR',
  'IT_MNGC_TP','IOE','INFM_SVC','EDRT_MNGC','EDRT_CPIT','DFR_CLE','CUR','APF_STS','ABUS_C','PUL_DTT',
  'IT_PTL_TMN_SVC_TC','IT_PTL_TMN_KD_TC','IT_PTL_TCHN_TP_TC','SD_TC','IT_PTL_RPR_STS_TC',
  'EXE_PTT_YN','CST_TP_TC','TMN_YN','IOE_C','INFM_SVC_TC','IT_PTL_EDRT_TC','DFR_CLE_C',
  'CUR_C','APF_PRG_STS_C','BG_UNT_ABUS_C','ABUS_TC'
);
```

> 명칭만 변경 그룹(SYS_RQC, PRJ_TP, KPN_TC, DUP_IOE, DUP_AMT, DCD_STS, CKG_ITM_C, BZ_DTT, BLB_TC, BG_RQS, PRIT_C, NAC_TP, SYS_PVC)도 DELETE+INSERT 대상에 포함하려면 위 IN 목록에 추가. 단, 명칭만 변경이면 별도 `UPDATE ... SET CDVA_NM=...`로 처리하는 편이 안전(값/PK 불변). Phase 0 매핑에서 그룹별 처리방식(재적재 vs UPDATE) 표기.

- [ ] **Step 2: 신규 목표 행 INSERT 작성 (매핑 CSV → INSERT)**

`_data/code-mapping.reviewed.csv`의 각 행을 아래 형식 INSERT로 변환. 대표 예시(전체는 156행, CSV에서 기계 변환):

```sql
INSERT INTO ITPAPP.TPRMPP_CCODEM
  (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CDVA_NM, CO_C_NM, C_SQN_SNO, HRK_CDVA_ID, DEL_YN, FST_ENR_USID, FST_ENR_DTM)
VALUES ('IT_PTL_TCHN_TP_TC','004', DATE '2026-03-31', DATE '9999-12-31', '블록체인','기술유형', NULL, NULL, 'N','MIGRATION', SYSDATE);
-- TMN 병합 예 (재번호):
INSERT INTO ITPAPP.TPRMPP_CCODEM (CO_C_ID,CDVA_ID,STT_DTM,END_DTM,CDVA_NM,CO_C_NM,C_SQN_SNO,HRK_CDVA_ID,DEL_YN,FST_ENR_USID,FST_ENR_DTM)
VALUES ('IT_PTL_TMN_SVC_TC','009', DATE '2026-03-31', DATE '9999-12-31', '트레이딩','단말기용도', NULL, NULL, 'N','MIGRATION', SYSDATE);
```

> 생성 방법: CSV를 PowerShell/스크립트로 INSERT 문자열로 변환하거나 수기 작성. 156행 전부 포함. `[NULL]` 표기는 SQL `NULL`. EDRT는 `C_SQN_SNO`(1~4)와 임계금액을 `CO_CDVA_SPS`에 보존.

- [ ] **Step 3: 변경로그 스냅샷 기록(감사)**

```sql
INSERT INTO ITPAPP.TPRMPP_CCODEL
  (LOG_HIS_TGR_SNO, CO_C_ID, CDVA_ID, STT_DTM, CDVA_NM, CHG_DTT_YN, CHG_DTM, CHG_USID, DEL_YN)
SELECT <SEQ_OR_MAXPLUS>, CO_C_ID, CDVA_ID, STT_DTM, CDVA_NM, 'Y', SYSDATE, 'MIGRATION', 'N'
FROM ITPAPP.TPRMPP_CCODEM WHERE FST_ENR_USID='MIGRATION';
```

> `<SEQ_OR_MAXPLUS>`: Phase 0 Step 2에서 확인한 시퀀스(`<SEQ>.NEXTVAL`). 시퀀스 없으면 `(SELECT NVL(MAX(LOG_HIS_TGR_SNO),0) FROM ...) + ROWNUM`.

- [ ] **Step 4: 백엔드 기동으로 Flyway 적용**

Run: `cd it_backend && ./gradlew bootRun` (또는 `flyway migrate`)
Expected: `V20260606_001` 성공. 로그에 오류 없음.

- [ ] **Step 5: CCODEM 신규 상태 검증**

Run: `sqlplus ... @it_database\migrations\_verify\code-migration-verify.sql`
Expected: `IT_PTL_TMN_SVC_TC` 12개 값(001~008,009,010,011,999), 구 그룹(TCHN_TP 등) 0건.

- [ ] **Step 6: 보상(롤백) 스크립트 작성**

```sql
-- _verify/rollback_V20260606_001.sql (Flyway 비대상, 수동 복구용)
DELETE FROM ITPAPP.TPRMPP_CCODEM WHERE FST_ENR_USID='MIGRATION';
INSERT INTO ITPAPP.TPRMPP_CCODEM SELECT * FROM ITPAPP.TPRMPP_CCODEM_BAK_20260606;
```

- [ ] **Step 7: Commit**

```bash
git add it_database/migrations/V20260606_001__MigrateCommonCodes.sql it_database/migrations/_verify/rollback_V20260606_001.sql
git commit -m "feat(db): 공통코드 그룹ID/값ID 신규 체계 재적재 마이그레이션"
```

---

## Phase 2 — 업무데이터 백필 (Flyway)

### Task 2.1: 값ID 백필 마이그레이션 작성

**Files:**
- Create: `it_database/migrations/V20260606_002__BackfillBusinessCodeValues.sql`

- [ ] **Step 1: 백필 SQL 작성 (부록 C 규칙, 멱등 WHERE)**

```sql
-- V20260606_002__BackfillBusinessCodeValues.sql
-- 잔존 구값 → 신규 값ID. 이미 목표값인 행은 WHERE로 제외(멱등).

-- DFR_CLE_C: '0'→'1', 3자리→1자리
UPDATE ITPAPP.TPRMPP_BCOSTM SET DFR_CLE_C = CASE TRIM(DFR_CLE_C)
  WHEN '0' THEN '1' WHEN '001' THEN '1' WHEN '002' THEN '2'
  WHEN '003' THEN '3' WHEN '004' THEN '4' WHEN '999' THEN '9' ELSE DFR_CLE_C END
WHERE TRIM(DFR_CLE_C) IN ('0','001','002','003','004','999');

UPDATE ITPAPP.TPRMPP_BTERMM SET DFR_CLE_C = CASE TRIM(DFR_CLE_C)
  WHEN '0' THEN '1' WHEN '001' THEN '1' WHEN '002' THEN '2'
  WHEN '003' THEN '3' WHEN '004' THEN '4' WHEN '999' THEN '9' ELSE DFR_CLE_C END
WHERE TRIM(DFR_CLE_C) IN ('0','001','002','003','004','999');

-- TMN_YN: 001→0, 002→1 (NULL 유지)
UPDATE ITPAPP.TPRMPP_BCOSTM SET TMN_YN = CASE TRIM(TMN_YN)
  WHEN '001' THEN '0' WHEN '002' THEN '1' ELSE TMN_YN END
WHERE TRIM(TMN_YN) IN ('001','002');

-- APF_PRG_STS_C: 2자리→1자리
UPDATE ITPAPP.TPRMPP_CAPPLM SET APF_PRG_STS_C = CASE TRIM(APF_PRG_STS_C)
  WHEN '01' THEN '1' WHEN '02' THEN '2' WHEN '03' THEN '3' WHEN '04' THEN '4' ELSE APF_PRG_STS_C END
WHERE TRIM(APF_PRG_STS_C) IN ('01','02','03','04');

-- Btermm 더티 데이터: IT_PTL_TMN_SVC_TC NULL → 001~003 랜덤
UPDATE ITPAPP.TPRMPP_BTERMM
SET IT_PTL_TMN_SVC_TC = TO_CHAR(TRUNC(DBMS_RANDOM.VALUE(1,4)), 'FM000')
WHERE IT_PTL_TMN_SVC_TC IS NULL;

-- IT_PTL_TMN_KD_TC: 코드값 아닌 행(한글 등) → 001~003 랜덤
UPDATE ITPAPP.TPRMPP_BTERMM
SET IT_PTL_TMN_KD_TC = TO_CHAR(TRUNC(DBMS_RANDOM.VALUE(1,4)), 'FM000')
WHERE IT_PTL_TMN_KD_TC IS NULL OR IT_PTL_TMN_KD_TC NOT IN ('001','002','003');
```

> ⚠ `DBMS_RANDOM`은 비결정적이라 재실행 시 값이 달라질 수 있으나, WHERE가 "코드값 아닌 행"만 잡으므로 1회 적용 후에는 대상 0건(멱등). Flyway는 1회만 적용.

- [ ] **Step 2: Flyway 적용**

Run: `cd it_backend && ./gradlew bootRun`
Expected: `V20260606_002` 성공.

- [ ] **Step 3: "after" 분포 + 고아 0건 검증**

Run: `sqlplus ... @it_database\migrations\_verify\code-migration-verify.sql`
Expected: `DFR_CLE_C` 값이 모두 `1~4/9`, `'0'` 0건. 고아 검출 쿼리 결과 0행. `IT_PTL_TMN_SVC_TC` NULL 0건.

- [ ] **Step 4: 보상 스크립트 작성** (`_verify/rollback_V20260606_002.sql` — 백업 테이블에서 컬럼 역복원; 랜덤 채움분은 복원 불가 명시 주석)

- [ ] **Step 5: Commit**

```bash
git add it_database/migrations/V20260606_002__BackfillBusinessCodeValues.sql it_database/migrations/_verify/rollback_V20260606_002.sql
git commit -m "feat(db): 업무데이터 공통코드 값ID 백필"
```

---

## Phase 3 — 백엔드 그룹ID 리터럴 교체

### Task 3.1: 그룹ID 상수 클래스 신설

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/code/CommonCodeGroups.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/code/CommonCodeGroupsTest.java`

- [ ] **Step 1: 실패 테스트 작성**

```java
package com.kdb.it.common.code;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class CommonCodeGroupsTest {
    @Test
    void 신규_그룹ID_상수가_정의되어_있다() {
        assertThat(CommonCodeGroups.TECH_TYPE).isEqualTo("IT_PTL_TCHN_TP_TC");
        assertThat(CommonCodeGroups.CURRENCY).isEqualTo("CUR_C");
        assertThat(CommonCodeGroups.IOE).isEqualTo("IOE_C");
        assertThat(CommonCodeGroups.ABUS).isEqualTo("ABUS_TC");
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*CommonCodeGroupsTest"`
Expected: 컴파일 실패 (CommonCodeGroups 미존재)

- [ ] **Step 3: 상수 클래스 구현**

```java
package com.kdb.it.common.code;

/** 공통코드 그룹ID 상수. CCODEM CO_C_ID와 1:1. 인라인 문자열 리터럴 금지. */
public final class CommonCodeGroups {
    private CommonCodeGroups() {}
    public static final String TERM_SERVICE = "IT_PTL_TMN_SVC_TC"; // (구 TMN_USG/TMN_KD)
    public static final String TERM_KIND    = "IT_PTL_TMN_KD_TC";  // (구 TMN_MAGR)
    public static final String TECH_TYPE    = "IT_PTL_TCHN_TP_TC"; // (구 TCHN_TP)
    public static final String SEND_DTT     = "SD_TC";             // (구 SD)
    public static final String REPORT_STS   = "IT_PTL_RPR_STS_TC"; // (구 RPR_STS)
    public static final String EXE_POSSIBLE = "EXE_PTT_YN";        // (구 PRJ_PUL_PTT)
    public static final String MAIN_USER    = "CST_TP_TC";         // (구 MN_USR)
    public static final String TMN_YN       = "TMN_YN";            // (구 IT_MNGC_TP)
    public static final String IOE          = "IOE_C";             // (구 IOE)
    public static final String INFM_SVC     = "INFM_SVC_TC";       // (구 INFM_SVC)
    public static final String EDRT         = "IT_PTL_EDRT_TC";    // (구 EDRT_MNGC/CPIT)
    public static final String DFR_CLE      = "DFR_CLE_C";         // (구 DFR_CLE)
    public static final String CURRENCY     = "CUR_C";             // (구 CUR)
    public static final String APF_STS      = "APF_PRG_STS_C";     // (구 APF_STS)
    public static final String ABUS_UNIT    = "BG_UNT_ABUS_C";     // (구 ABUS_C)
    public static final String ABUS         = "ABUS_TC";           // (구 PUL_DTT)
    // 불변(명칭만): 참조 편의용
    public static final String PRJ_TYPE     = "PRJ_TP";
    public static final String BZ_DTT       = "BZ_DTT";
    public static final String BUDGET_RQS   = "BG_RQS";
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*CommonCodeGroupsTest"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/code/CommonCodeGroups.java it_backend/src/test/java/com/kdb/it/common/code/CommonCodeGroupsTest.java
git commit -m "feat(backend): 공통코드 그룹ID 상수 클래스 신설"
```

### Task 3.2: ProjectService 리터럴 교체

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:717-890`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java:1711-1720`

- [ ] **Step 1: 테스트의 기대 그룹ID를 신규명으로 수정**

```java
given(ccodemRepository.findByCIdAndCdvaWithValidDate("IT_PTL_TCHN_TP_TC", "TC01", null))
    .willReturn(Optional.of(Ccodem.builder().cId("IT_PTL_TCHN_TP_TC").cdva("TC01").build()));
given(ccodemRepository.findByCIdAndCdvaWithValidDate("IT_PTL_RPR_STS_TC", "RS01", null))
    .willReturn(Optional.of(Ccodem.builder().cId("IT_PTL_RPR_STS_TC").cdva("RS01").build()));
given(ccodemRepository.findByCIdAndCdvaWithValidDate("CST_TP_TC", "MN01", null))
    .willReturn(Optional.of(Ccodem.builder().cId("CST_TP_TC").cdva("MN01").build()));
given(ccodemRepository.findByCIdAndCdvaWithValidDate("EXE_PTT_YN", "PP01", null))
    .willReturn(Optional.of(Ccodem.builder().cId("EXE_PTT_YN").cdva("PP01").build()));
given(ccodemRepository.findByCIdAndCdvaWithValidDate("ABUS_TC", "PD01", null))
    .willReturn(Optional.of(Ccodem.builder().cId("ABUS_TC").cdva("PD01").build()));
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*ProjectServiceTest"`
Expected: FAIL (서비스가 아직 구 그룹ID 사용)

- [ ] **Step 3: ProjectService 리터럴을 상수로 교체**

```java
// L718-721
buildCodeNameMap(CommonCodeGroups.MAIN_USER, mnUsrCdvas);        // 구 "MN_USR"
buildCodeNameMap(CommonCodeGroups.REPORT_STS, rprStsCdvas);      // 구 "RPR_STS"
buildCodeNameMap(CommonCodeGroups.EXE_POSSIBLE, prjPulPttCdvas); // 구 "PRJ_PUL_PTT"
buildCodeNameMap(CommonCodeGroups.ABUS, pulDttCdvas);            // 구 "PUL_DTT"
buildCodeNameMap(CommonCodeGroups.TECH_TYPE, tchnTpCdvas);       // 구 "TCHN_TP"
// L631,939,1049 (IOE)
codeService.findCodeEntitiesByCId(CommonCodeGroups.IOE);         // 구 "IOE"
// L878-890 단건 조회도 동일 상수 치환
ccodemRepository.findByCIdAndCdvaWithValidDate(CommonCodeGroups.TECH_TYPE, ...);
```

> 동일 파일의 `PRJ_TP`,`BZ_DTT`는 그룹ID 불변이나 상수(`PRJ_TYPE`,`BZ_DTT`)로 정리.

- [ ] **Step 4: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*ProjectServiceTest"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java
git commit -m "refactor(backend): ProjectService 공통코드 그룹ID 신규명 교체"
```

### Task 3.3: CostService 리터럴 교체 (IT_MNGC_TP 값변환 주의)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:569-739`, `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java:130`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java:844-1024`

- [ ] **Step 1: 테스트 그룹ID + IT_MNGC_TP 값변환 기대치 수정**

```java
given(ccodemRepository.findByCIdAndCdvaWithValidDate("BG_UNT_ABUS_C", "ABUS01", null)).willReturn(...);
given(ccodemRepository.findByCIdAndCdvaWithValidDate("DFR_CLE_C", "DFR01", null)).willReturn(...);
given(ccodemRepository.findByCIdAndCdvaWithValidDate("ABUS_TC", "PD01", null)).willReturn(...); // 구 PUL_DTT
given(ccodemRepository.findByCIdAndCdvaWithValidDate("TMN_YN", "1", null)).willReturn(...);     // 구 IT_MNGC_TP "002"
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*CostServiceTest"`
Expected: FAIL

- [ ] **Step 3: CostService 교체**

```java
// L591-597
buildCodeNameMap(CommonCodeGroups.ABUS_UNIT, bgUntAbusCdvas);   // 구 "ABUS_C"
buildCodeNameMap(CommonCodeGroups.DFR_CLE, dfrCleCCdvas);       // 구 "DFR_CLE"
buildCodeNameMap(CommonCodeGroups.TMN_YN, tmnYnMngcCodes);      // 구 "IT_MNGC_TP"
buildCodeNameMap(CommonCodeGroups.ABUS, abusTcCdvas);           // 구 "PUL_DTT"
// L569-580, 730-734: IT_MNGC_TP "Y"→"002"/"N"→"001" 변환을 TMN_YN 신값으로
String mngcTpCode = isTmn ? "1" : "0";  // 구 "002"/"001"
ccodemRepository.findByCIdAndCdvaWithValidDate(CommonCodeGroups.TMN_YN, mngcTpCode, null);
// L500,776 IOE
ccodemRepository.findByCIdWithValidDate(CommonCodeGroups.IOE, null);
```

> `Bcostm.java:130` 주석 `구 IT_MNGC_TP 002→Y/001→N` → `TMN_YN 1→Y/0→N`로 갱신.

- [ ] **Step 4: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*CostServiceTest"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java
git commit -m "refactor(backend): CostService 그룹ID/IT_MNGC_TP 값변환 신규 체계 교체"
```

### Task 3.4: IOE 상수·BudgetWork·기타 레포지토리 교체

**Files:**
- Modify: `BudgetWorkService.java:105,162,274,403,647`, `ItBudgetQueryRepositoryImpl.java:43`, `BudgetStatusQueryRepositoryImpl.java:44,118`, `PlanService.java:78`
- Test: 각 대응 테스트(`BudgetWorkServiceTest`, `PlanServiceTest`, `BudgetWorkServiceXcrLookupTest`)

- [ ] **Step 1: 테스트 기대 그룹ID 수정** (`"IOE"`→`"IOE_C"`, `"RPR_STS"`→`"IT_PTL_RPR_STS_TC"`, `"PUL_DTT"`→`"ABUS_TC"`)

```java
given(ccodemRepository.findByCIdWithValidDate("IOE_C", null)).willReturn(...);
given(codeService.findCodeEntitiesByCId("ABUS_TC")).willReturn(...); // 구 PUL_DTT
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*BudgetWorkServiceTest" --tests "*PlanServiceTest"`
Expected: FAIL

- [ ] **Step 3: 구현 교체**

```java
// ItBudgetQueryRepositoryImpl.java:43, BudgetStatusQueryRepositoryImpl.java:44
private static final String C_ID_IOE = CommonCodeGroups.IOE; // 값 "IOE_C"
// BudgetWorkService.java: findCodes("IOE") → findCodes(CommonCodeGroups.IOE) (5개소)
// BudgetStatusQueryRepositoryImpl.java:118: rprStsCode.cId.eq(CommonCodeGroups.REPORT_STS)
// PlanService.java:78: codeService.findCodeEntitiesByCId(CommonCodeGroups.ABUS) // 구 PUL_DTT
```

> IOE 서브 cTp 상수(`IOE_LEAFE`,`IOE_DVC`,`IOE_HW`,`IOE_SW`,`IOE_XPN`,`IOE_SEVS`,`IOE_IDR`)는 **불변** — 변경 금지.

- [ ] **Step 4: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*BudgetWorkServiceTest" --tests "*PlanServiceTest" --tests "*BudgetStatus*"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A it_backend/src
git commit -m "refactor(backend): IOE/RPR_STS/PUL_DTT 그룹ID 상수 교체"
```

### Task 3.5: XcrLookupService(CUR)·CodeService(BG_RQS)·ApplicationRepository(APF_STS) 교체

**Files:**
- Modify: `XcrLookupService.java:42`, `CodeService.java:171,173`, `ApplicationRepository.java:54,64,74,84,115`
- Test: `XcrLookupServiceTest.java:45,51,59,66`

- [ ] **Step 1: XcrLookupServiceTest 그룹ID 수정**

```java
Ccodem.builder().cId("CUR_C")...;
verify(codeRepository).findByCIdAndCdvaWithValidDate("CUR_C", "USD", BASE_DATE);
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*XcrLookupServiceTest"`
Expected: FAIL

- [ ] **Step 3: 구현 교체**

```java
// XcrLookupService.java:42
private static final String CUR_C_ID = CommonCodeGroups.CURRENCY; // 값 "CUR_C"
// CodeService.java:171,173: "BG_RQS" → CommonCodeGroups.BUDGET_RQS (그룹ID 불변, 상수화만)
// ApplicationRepository.java: APF_PRG_STS_C 네이티브 쿼리 값(컬럼 저장값)을
//   Phase 2 백필(2자리→1자리)에 맞춰 동기 수정:
//   L54,64,115: = '01' → = '1' ; L74: = '02' → = '2' ; L84: = '03' → = '3'
```

> ⚠ `ApplicationRepository`의 `'01'~'03'`은 그룹ID가 아니라 **APF_PRG_STS_C 컬럼 저장값**. Phase 2와 **동일 배포**로 1자리화. `DCD_STS_C='001'`(L56,117)은 불변.

- [ ] **Step 4: 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*XcrLookupServiceTest" --tests "*ApplicationRepository*"`
Expected: PASS

- [ ] **Step 5: 전체 백엔드 테스트 + 잔존 리터럴 grep**

Run: `cd it_backend && ./gradlew test`
Expected: BUILD SUCCESSFUL
Run: `grep -rEn '"(TCHN_TP|RPR_STS|PUL_DTT|PRJ_PUL_PTT|MN_USR|IT_MNGC_TP|INFM_SVC|EDRT_MNGC|EDRT_CPIT|DFR_CLE|CUR|APF_STS|ABUS_C)"' it_backend/src/main`
Expected: 0건 (서브코드 `IOE_*`·컬럼명·주석 제외)

- [ ] **Step 6: Commit**

```bash
git add -A it_backend/src
git commit -m "refactor(backend): CUR/BG_RQS/APF_STS 그룹ID·값 신규 체계 교체"
```

---

## Phase 4 — 프론트엔드 그룹ID/값ID 교체

### Task 4.1: 프론트 그룹ID 상수 신설

**Files:**
- Create: `it_frontend/app/constants/codeGroups.ts`

- [ ] **Step 1: 상수 정의**

```ts
// 공통코드 그룹ID 상수. /api/ccodem/{cId} 및 useCodeOptions 인자.
export const CODE_GROUPS = {
  TECH_TYPE: 'IT_PTL_TCHN_TP_TC',    // 구 TCHN_TP
  REPORT_STS: 'IT_PTL_RPR_STS_TC',   // 구 RPR_STS
  MAIN_USER: 'CST_TP_TC',            // 구 MN_USR
  EXE_POSSIBLE: 'EXE_PTT_YN',        // 구 PRJ_PUL_PTT
  ABUS: 'ABUS_TC',                   // 구 PUL_DTT
  TMN_YN: 'TMN_YN',                  // 구 IT_MNGC_TP
  DFR_CLE: 'DFR_CLE_C',              // 구 DFR_CLE
  CURRENCY: 'CUR_C',                 // 구 CUR
  ABUS_UNIT: 'BG_UNT_ABUS_C',        // 구 ABUS_C
  TERM_SERVICE: 'IT_PTL_TMN_SVC_TC', // 구 TMN_SVC 별칭
} as const
```

- [ ] **Step 2: 타입체크**

Run: `cd it_frontend && npm run typecheck`
Expected: 통과

- [ ] **Step 3: Commit**

```bash
git add it_frontend/app/constants/codeGroups.ts
git commit -m "feat(frontend): 공통코드 그룹ID 상수 추가"
```

### Task 4.2: useCodeOptions / $apiFetch 인자 교체

**Files (수집 결과 기준):**
- Modify: `app/pages/info/projects/form.vue:220,222,224`, `app/pages/budget/status.vue:69`, `app/pages/budget/list.vue:66`, `app/pages/budget/approval.vue:41`, `app/pages/info/plan/form.vue:92,93`, `app/pages/info/plan/[id].vue:50`, `app/components/plan/PlanCapitalBudgetCard.vue:31`, `app/composables/useBudgetStatusCostTab.ts:29,30`, `app/composables/useCostListPage.ts:354-357`, `app/components/cost/TerminalFormDialog.vue:134-136`, `app/components/cost/CostFormTableSection.vue:88`, `app/components/cost/TerminalTableSection.vue:90`, `app/pages/info/cost/form.vue:110,176-180`, `app/pages/info/projects/form.vue:91`

- [ ] **Step 1: useCodeOptions 인자 교체**

```ts
// info/projects/form.vue
useCodeOptions(CODE_GROUPS.TECH_TYPE)    // 구 'TCHN_TP'
useCodeOptions(CODE_GROUPS.REPORT_STS)   // 구 'RPR_STS'
useCodeOptions(CODE_GROUPS.MAIN_USER)    // 구 'MN_USR'
useCodeOptions(CODE_GROUPS.EXE_POSSIBLE) // 구 'PRJ_PUL_PTT'
useCodeOptions(CODE_GROUPS.ABUS)         // 구 'PUL_DTT'
// useBudgetStatusCostTab.ts:29,30
useCodeOptions(CODE_GROUPS.ABUS_UNIT)    // 구 'ABUS_C'
useCodeOptions(CODE_GROUPS.TMN_YN)       // 구 'IT_MNGC_TP'
```

> `PUL_DTT`는 표시명 변환 8개소 전부 `CODE_GROUPS.ABUS`로. `PRJ_TP`,`BZ_DTT`,`IOE`,`IOE_*`,`LGN_TC`는 불변(교체 금지).

- [ ] **Step 2: $apiFetch 직접 경로 교체**

```ts
// useCostListPage.ts:354-357
$apiFetch(`/api/ccodem/${CODE_GROUPS.ABUS}`)      // 구 /api/ccodem/PUL_DTT
$apiFetch(`/api/ccodem/${CODE_GROUPS.DFR_CLE}`)   // 구 /DFR_CLE
$apiFetch(`/api/ccodem/${CODE_GROUPS.ABUS_UNIT}`) // 구 /ABUS_C
$apiFetch(`/api/ccodem/${CODE_GROUPS.TMN_YN}`)    // 구 /IT_MNGC_TP
// cost 컴포넌트: /api/ccodem/CUR → /api/ccodem/CUR_C, /api/ccodem/CUR/{curC} → /CUR_C/{curC}
// /api/ccodem/TMN_SVC → /api/ccodem/IT_PTL_TMN_SVC_TC (TerminalFormDialog.vue:135, info/cost/form.vue:179)
```

> `ASCT_STS_C/DBR_TC/VLR_TC`(useCouncilCodes.ts), `budget-period`, `DUP_AMT/DUP_IOE`, `IOE*`는 불변.

- [ ] **Step 3: 타입체크 + 린트**

Run: `cd it_frontend && npm run typecheck && npm run lint`
Expected: 통과

- [ ] **Step 4: Commit**

```bash
git add -A it_frontend/app
git commit -m "refactor(frontend): 공통코드 그룹ID 신규명 교체"
```

### Task 4.3: 값ID 하드코딩 교체

**Files:**
- Modify: `app/pages/info/cost/form.vue:368-369` (`'PUL_DTT_002'`), `app/composables/useApprovalStatus.ts:16-21` (APF_STS 01~04)

- [ ] **Step 1: PUL_DTT_002 비교 수정**

```ts
// info/cost/form.vue:368-369 — abusTc 컬럼은 신규값 '02'(계속) 저장
const isContinueCost = computed(() => costs.value?.[0]?.abusTc === '02') // 구 'PUL_DTT_002'
```

- [ ] **Step 2: APF_STS 라벨맵 1자리로 수정**

```ts
// useApprovalStatus.ts:16-21 — Phase 2 백필로 1자리(1~4)
export const APF_STS_LABEL: Record<string, string> = {
  '1': '결재중', '2': '결재완료', '3': '반려', '4': '회수',
}
```

> notification.ts(INFM_SVC 01~06), council.ts(CKG_ITM_C 등)는 값ID 불변 — 변경 금지. `BLB_TC==='001'`도 불변. `info/cost/[id].vue:387`·`form.vue:22`의 `IT_MNGC_TP_001/002`는 주석이므로 설명만 갱신.

- [ ] **Step 3: 타입체크 + 단위테스트**

Run: `cd it_frontend && npm run typecheck && npm test`
Expected: 통과

- [ ] **Step 4: 잔존 그룹ID grep**

Run: `grep -rEn "useCodeOptions\('(TCHN_TP|RPR_STS|MN_USR|PRJ_PUL_PTT|PUL_DTT|IT_MNGC_TP|ABUS_C)'\)|/api/ccodem/(TCHN_TP|RPR_STS|PUL_DTT|CUR|DFR_CLE|ABUS_C|IT_MNGC_TP|TMN_SVC)\b" it_frontend/app`
Expected: 0건

- [ ] **Step 5: Commit**

```bash
git add -A it_frontend/app
git commit -m "refactor(frontend): 공통코드 값ID 하드코딩 신규값 교체"
```

---

## Phase 5 — 통합 검증 & QA

### Task 5.1: 전수 검증

- [ ] **Step 1: DB 정합 — CCODEM이 매핑 SoT와 일치, 고아 0건**

Run: `sqlplus ... @it_database\migrations\_verify\code-migration-verify.sql`
Expected: 고아 검출 0행, 분포가 신규 값ID로 이동.

- [ ] **Step 2: 백엔드 그린 + 잔존 리터럴 0**

Run: `cd it_backend && ./gradlew test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: 프론트 그린**

Run: `cd it_frontend && npm run typecheck && npm run lint && npm test`
Expected: 통과

- [ ] **Step 4: E2E/QA (두 서버 기동 후)**

Run: `cd it_backend && ./gradlew bootRun` + `cd it_frontend && npm run dev`, 이후 `/qa`
시나리오: 로그인 → 사업 조회/생성(기술유형·주요사용자·보고상태·추진가능성 셀렉트) → 예산/비용 폼(통화·지급주기·사업코드·단말여부) → 단말기 폼 → 결재 처리(상태 라벨) → 게시판.
Expected: 셀렉트 옵션 정상 표출, 코드명 빈칸/깨짐 없음, 결재 상태 라벨 정상.

- [ ] **Step 5: 최종 커밋(있으면) / 정리**

```bash
git add -A && git commit -m "test: 공통코드 마이그레이션 통합 검증 통과" --allow-empty
```

---

## 롤백 요약
- DB: `_verify/rollback_V20260606_001.sql`, `rollback_V20260606_002.sql` 수동 실행(백업 테이블 복원). Flyway 적용분은 수정 금지, 보상 마이그레이션으로만.
- 코드: Phase 3/4는 git revert.
- 캐시: 배포 시 `@Cacheable` 코드 캐시 무효화/재기동.
