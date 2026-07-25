# 운영 DB 기준 스키마 정렬 및 백엔드/프론트 로직 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/db-schema-gap-2026-07-24.md`가 식별한 운영·로컬 DB Gap 26건을 운영 기준으로 해소하고, 그 과정에서 드러난 엔티티/DB 불일치와 NOT NULL 전환으로 깨지는 저장 경로를 함께 고친다.

**Architecture:** Flyway 스크립트 2개로 물리 스키마를 운영에 맞춘 뒤, JPA 엔티티 매핑을 새 물리 구조에 정렬하고, NOT NULL이 된 코드 컬럼에 빈 문자열이 들어오지 않도록 백엔드 저장 경계에서 `'0'`(해당없음)으로 정규화한다. 프론트는 드롭다운 초기값을 `''`에서 `'0'`으로 바꿔 사용자에게 "해당없음"이 보이도록 한다.

**Tech Stack:** Oracle 21c XE, Flyway, Spring Boot 4.1 / Java 25 / JPA / QueryDSL, Nuxt 4 / Vue 3 / TypeScript

## Global Constraints

- 제외 테이블: `FLYWAY_SCHEMA_HISTORY` (비교·변경 대상 아님).
- 신규 마이그레이션 파일명은 `V{YYYYMMDD_NNN}__{CamelCase설명}.sql`. 직전 적용 버전은 `20260721.004`이므로 신규는 `V20260724_001`, `V20260724_002`.
- **이미 적용된 마이그레이션 스크립트는 절대 수정하지 않는다.** 변경은 항상 새 버전 파일로 추가한다.
- 마이그레이션 본문에서 스키마는 `ITPOWN.`으로 명시한다(기존 `V20260720_010` 패턴과 동일). 단, **엔티티와 애플리케이션 쿼리에는 스키마 접두어를 쓰지 않는다.**
- 마이그레이션은 재실행 안전(idempotent)하게 작성한다. `ALL_TAB_COLUMNS` / `ALL_CONSTRAINTS` 존재 확인 후 DDL을 실행한다.
- 모든 신규 `@Column`에는 한글 `comment`를 지정한다.
- 신규/수정 주석은 한글. 단순 대입·게터에는 주석을 달지 않는다.
- 코드값 상수: `DFR_CLE_C` / `ABUS_TC`의 `'0'` = 해당없음 (`TPRMPP_CCODEM` 확인 완료). `DCD_TP_C`의 `'10'` = 요청.
- 백엔드 검증 명령: `cd it_backend && ./gradlew test`
- 프론트 검증 명령: `cd it_frontend && npm run check && npm test`

## 검증된 현재 상태 (2026-07-24 로컬 DB 실측)

계획의 모든 backfill 값은 아래 실측에 근거한다. 실행자는 이 값을 신뢰하되 Task 1/2 실행 직전 재확인한다.

| 대상 | 실측 |
| --- | --- |
| `TPRMPP_BESTTM` / `TPRMPP_BESTTL` | **0행** (데이터 마이그레이션 불필요) |
| `PK_BESTTM` 현재 구성 | `(RQM_BG_REQ_DOC_NO, DOC_VRS_SNO)` — 2컬럼 |
| `Besttm` 엔티티 `@Id` | `(rqmBgReqDocNo, docVrsSno, svnTemC, ioeC)` — 4컬럼 (**DB와 불일치**) |
| `BITEMM.DFR_CLE_C` NULL | 31 / 48행 (활성 30행) |
| `BITEML.DFR_CLE_C` NULL | 183행 |
| `BCOSTL.ABUS_TC` / `DFR_CLE_C` NULL | 각 2행 |
| `CDECIM.DCD_TP_C` NULL | 4 / 4행 (전부) |
| `BBIZCM`, `BPROJM`, `BCOSTM`, `BTERMM`, `BDELIM`, `CINFMM` 대상 컬럼 | NULL 0건 — backfill 불필요 |
| `CBLBCM` / `CBLBCL.XPO_YN` NULL | 0건 — NOT NULL 해제는 무조건 안전 |

## 알려진 부수 발견 (이 계획으로 함께 해소)

1. **`Besttm` 엔티티가 DB PK와 불일치** — 엔티티는 4컬럼 복합키인데 DB PK는 2컬럼. 현재 로컬에서 `saveLines`로 2행 이상을 저장하면 `ORA-00001`이 난다. BESTTM이 0행이라 아직 드러나지 않은 잠복 버그다. 운영 PK `(문서번호, 버전, 개선의견일련번호)`로 정렬하면 함께 해소된다.
2. **엔티티 length가 DB와 불일치** — `Besttm.OPNN_CONE`/`BesttmL.OPNN_CONE` = 1000 (DB 6000), `BitemmL.DFR_CLE_C`/`BtermmL.DFR_CLE_C` = 3 (DB 1), `BprojmL.ABUS_TC` = 32 (DB 2).
3. **빈 문자열 저장 경로** — 프론트가 `dfrCleC: ''`, `abusTc: ''`로 신규 행을 만든다. Oracle은 `''`를 NULL로 저장하므로 NOT NULL 전환 후 `ORA-01400`이 난다.

## File Structure

**생성**

| 파일 | 책임 |
| --- | --- |
| `it_database/migrations/V20260724_001__AddBesttImprovementOpinionSno.sql` | BESTTM/BESTTL에 `IPM_OPNN_SNO` 추가, PK 재구성, 컬럼 순서 정렬, 코멘트 |
| `it_database/migrations/V20260724_002__AlignConstraintsWithProduction.sql` | NOT NULL 22건 정렬(backfill 포함), 기본값 2건, 테이블 코멘트 1건 |
| `it_backend/src/main/java/com/kdb/it/common/code/CodeDefaults.java` | 코드 컬럼 빈값 → `'0'`(해당없음) 정규화 단일 지점 |
| `it_backend/src/test/java/com/kdb/it/common/code/CodeDefaultsTest.java` | 위 정규화 단위 테스트 |

**수정**

| 파일 | 변경 |
| --- | --- |
| `it_backend/.../domain/estimate/entity/Besttm.java` | `@Id` 재구성, `ipmOpnnSno` 추가, `OPNN_CONE` 6000 |
| `it_backend/.../domain/estimate/entity/BesttmId.java` | 복합키 필드 교체 |
| `it_backend/.../domain/log/entity/BesttmL.java` | `ipmOpnnSno` 추가, `OPNN_CONE` 6000 |
| `it_backend/.../domain/estimate/service/EstimateService.java` | `saveLines`에서 `ipmOpnnSno` 채번 |
| `it_backend/.../domain/estimate/dto/EstimateDto.java` | `opnnCone` 길이 6000 |
| `it_backend/.../domain/budget/project/entity/Bitemm.java` 외 8개 엔티티 | `nullable` 정렬 |
| `it_backend/.../domain/log/entity/*L.java` (5개) | `nullable`/`length` 정렬 |
| `it_backend/.../domain/budget/cost/dto/CostDto.java:195,211,762` | 빌더 경로 코드 정규화 |
| `it_backend/.../domain/budget/project/service/ProjectService.java:328,565` | 품목 빌더 경로 코드 정규화 |
| `it_backend/.../domain/budget/cost/entity/Bcostm.java:205,217`, `Btermm.java:187` | 변경 메서드 코드 정규화 |
| `it_backend/.../domain/budget/project/entity/Bitemm.java:157`, `Bprojm.java:436,538` | 변경 메서드 코드 정규화 |
| `it_backend/.../common/approval/entity/Cdecim.java:55` | 결재유형 기본값 상수 + JavaDoc 정정 |
| `it_backend/.../common/approval/service/ApplicationService.java:182` | 결재선 생성 시 결재유형코드 `'10'` 부여 |
| `it_frontend/app/composables/costList/useCostRowEditing.ts` | `abusTc` 초기값 `'0'` |
| `it_frontend/app/components/cost/TerminalTableSection.vue` | `dfrCleC` 초기값 `'0'` |
| `it_frontend/app/components/cost/TerminalFormDialog.vue` | `dfrCleC` / `abusTc` 폴백 `'0'` |
| `docs/db-schema-gap-2026-07-24.md` | 정렬 후 재검증 결과 추가 |

---

### Task 1: BESTTM/BESTTL 개선의견일련번호 추가 및 PK 재구성

**Files:**
- Create: `it_database/migrations/V20260724_001__AddBesttImprovementOpinionSno.sql`

**Interfaces:**
- Produces: `ITPOWN.TPRMPP_BESTTM.IPM_OPNN_SNO NUMBER(9) NOT NULL`, `PK_BESTTM = (RQM_BG_REQ_DOC_NO, DOC_VRS_SNO, IPM_OPNN_SNO)`, `ITPOWN.TPRMPP_BESTTL.IPM_OPNN_SNO NUMBER(9) NULL`. Task 3이 이 물리 구조에 엔티티를 매핑한다.

- [ ] **Step 1: 실행 전 현재 상태 재확인**

```bash
sqlplus -S "ITPAPP/kdb1234!!@127.0.0.1:11521/XEPDB1" @-
```

아래 SQL을 실행해 BESTTM/BESTTL이 여전히 0행이고 PK가 2컬럼인지 확인한다.

```sql
ALTER SESSION SET CURRENT_SCHEMA=ITPOWN;
SELECT 'BESTTM' t, COUNT(*) c FROM TPRMPP_BESTTM
UNION ALL SELECT 'BESTTL', COUNT(*) FROM TPRMPP_BESTTL;
SELECT cc.COLUMN_NAME, cc.POSITION FROM ALL_CONSTRAINTS c
  JOIN ALL_CONS_COLUMNS cc ON cc.OWNER=c.OWNER AND cc.CONSTRAINT_NAME=c.CONSTRAINT_NAME
 WHERE c.OWNER='ITPOWN' AND c.CONSTRAINT_TYPE='P' AND c.TABLE_NAME='TPRMPP_BESTTM'
 ORDER BY cc.POSITION;
```

기대: 두 테이블 모두 `0`, PK는 `RQM_BG_REQ_DOC_NO(1)`, `DOC_VRS_SNO(2)`.

**행이 0이 아니면 중단하고 보고한다.** 아래 스크립트의 backfill(`IPM_OPNN_SNO = 1`)은 문서·버전당 1행일 때만 안전하다.

- [ ] **Step 2: 마이그레이션 스크립트 작성**

`it_database/migrations/V20260724_001__AddBesttImprovementOpinionSno.sql`:

```sql
-- 운영(meta/table.txt) 기준으로 소요예산 산정 상세에 개선의견일련번호를 추가한다.
-- 운영 PK: TPRMPP_BESTTM (RQM_BG_REQ_DOC_NO, DOC_VRS_SNO, IPM_OPNN_SNO)
-- 운영 순서: BESTTM 3번째, BESTTL 4번째 컬럼.

DECLARE
    PROCEDURE add_number_column_if_missing(
        p_table_name  VARCHAR2,
        p_column_name VARCHAR2,
        p_definition  VARCHAR2
    ) IS
        v_count NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_count
          FROM ALL_TAB_COLUMNS
         WHERE OWNER = 'ITPOWN'
           AND TABLE_NAME = p_table_name
           AND COLUMN_NAME = p_column_name;
        IF v_count = 0 THEN
            EXECUTE IMMEDIATE 'ALTER TABLE ITPOWN.' || p_table_name
                || ' ADD (' || p_column_name || ' ' || p_definition || ')';
        END IF;
    END;
BEGIN
    -- 1) 컬럼 추가 (기존 행 보호를 위해 우선 NULL 허용으로 추가)
    add_number_column_if_missing('TPRMPP_BESTTM', 'IPM_OPNN_SNO', 'NUMBER(9)');
    add_number_column_if_missing('TPRMPP_BESTTL', 'IPM_OPNN_SNO', 'NUMBER(9)');
END;
/

-- 2) 기존 행 backfill. 현재 문서·버전당 1행이 최대이므로 1번을 부여한다.
UPDATE ITPOWN.TPRMPP_BESTTM SET IPM_OPNN_SNO = 1 WHERE IPM_OPNN_SNO IS NULL;
UPDATE ITPOWN.TPRMPP_BESTTL SET IPM_OPNN_SNO = 1 WHERE IPM_OPNN_SNO IS NULL;
COMMIT;

-- 3) PK 재구성 (운영은 BESTTM만 3컬럼 PK, BESTTL은 LOG_HIS_TGR_SNO 단일 PK 유지)
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count
      FROM ALL_TAB_COLUMNS
     WHERE OWNER='ITPOWN' AND TABLE_NAME='TPRMPP_BESTTM'
       AND COLUMN_NAME='IPM_OPNN_SNO' AND NULLABLE='Y';
    IF v_count > 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE ITPOWN.TPRMPP_BESTTM MODIFY (IPM_OPNN_SNO NOT NULL)';
    END IF;

    -- 기존 2컬럼 PK를 제거하고 운영과 동일한 3컬럼 PK로 재생성한다.
    SELECT COUNT(*) INTO v_count
      FROM ALL_CONSTRAINTS
     WHERE OWNER='ITPOWN' AND TABLE_NAME='TPRMPP_BESTTM' AND CONSTRAINT_NAME='PK_BESTTM';
    IF v_count > 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE ITPOWN.TPRMPP_BESTTM DROP CONSTRAINT PK_BESTTM DROP INDEX';
    END IF;
    EXECUTE IMMEDIATE 'ALTER TABLE ITPOWN.TPRMPP_BESTTM ADD CONSTRAINT PK_BESTTM'
        || ' PRIMARY KEY (RQM_BG_REQ_DOC_NO, DOC_VRS_SNO, IPM_OPNN_SNO)';
END;
/

-- 4) 운영 컬럼 순서로 재배치 (INVISIBLE → VISIBLE 재부여, 첫 컬럼은 그대로 두므로 2번째부터)
DECLARE
    PROCEDURE reorder_visible_columns(p_table_name VARCHAR2, p_columns VARCHAR2) IS
        v_column_name VARCHAR2(128);
        v_position    NUMBER := 2;
    BEGIN
        LOOP
            v_column_name := REGEXP_SUBSTR(p_columns, '[^,]+', 1, v_position);
            EXIT WHEN v_column_name IS NULL;
            EXECUTE IMMEDIATE 'ALTER TABLE ITPOWN.' || p_table_name
                || ' MODIFY (' || v_column_name || ' INVISIBLE)';
            v_position := v_position + 1;
        END LOOP;

        v_position := 2;
        LOOP
            v_column_name := REGEXP_SUBSTR(p_columns, '[^,]+', 1, v_position);
            EXIT WHEN v_column_name IS NULL;
            EXECUTE IMMEDIATE 'ALTER TABLE ITPOWN.' || p_table_name
                || ' MODIFY (' || v_column_name || ' VISIBLE)';
            v_position := v_position + 1;
        END LOOP;
    END;
BEGIN
    reorder_visible_columns('TPRMPP_BESTTM',
        'RQM_BG_REQ_DOC_NO,DOC_VRS_SNO,IPM_OPNN_SNO,SVN_TEM_C,IOE_C,RQM_BG_AMT,OPNN_CONE,'
        || 'FST_ENR_USID,FST_ENR_DTM,DEL_YN,GUID,GUID_PRG_SNO,LST_CHG_USID,LST_CHG_DTM');
    reorder_visible_columns('TPRMPP_BESTTL',
        'LOG_HIS_TGR_SNO,RQM_BG_REQ_DOC_NO,DOC_VRS_SNO,IPM_OPNN_SNO,SVN_TEM_C,IOE_C,RQM_BG_AMT,'
        || 'OPNN_CONE,CHG_DTT_YN,CHG_DTM,CHG_USID,FST_ENR_USID,FST_ENR_DTM,DEL_YN,GUID,'
        || 'GUID_PRG_SNO,LST_CHG_USID,LST_CHG_DTM');
END;
/

COMMENT ON COLUMN ITPOWN.TPRMPP_BESTTM.IPM_OPNN_SNO IS '개선의견일련번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_BESTTL.IPM_OPNN_SNO IS '개선의견일련번호';
```

- [ ] **Step 3: 마이그레이션 적용**

```bash
cd it_backend && ./gradlew bootRun --args='--spring.profiles.active=local-int'
```

기동 로그에 `Migrating schema "ITPOWN" to version "20260724.001 - AddBesttImprovementOpinionSno"`가 보이면 성공. 확인 후 서버를 종료한다.

> Eclipse/IDE의 bootRun은 `processResources`를 거치지 않아 마이그레이션이 적용되지 않는다. 반드시 `./gradlew bootRun`을 사용한다.

- [ ] **Step 4: 적용 결과 검증**

```sql
ALTER SESSION SET CURRENT_SCHEMA=ITPOWN;
SELECT COLUMN_ID, COLUMN_NAME, DATA_TYPE, DATA_PRECISION, NULLABLE
  FROM ALL_TAB_COLUMNS WHERE OWNER='ITPOWN' AND TABLE_NAME='TPRMPP_BESTTM' ORDER BY COLUMN_ID;
SELECT cc.COLUMN_NAME, cc.POSITION FROM ALL_CONSTRAINTS c
  JOIN ALL_CONS_COLUMNS cc ON cc.OWNER=c.OWNER AND cc.CONSTRAINT_NAME=c.CONSTRAINT_NAME
 WHERE c.OWNER='ITPOWN' AND c.CONSTRAINT_TYPE='P' AND c.TABLE_NAME='TPRMPP_BESTTM'
 ORDER BY cc.POSITION;
```

기대:
- `COLUMN_ID 3 = IPM_OPNN_SNO, NUMBER, 9, N`
- PK 3컬럼: `RQM_BG_REQ_DOC_NO(1), DOC_VRS_SNO(2), IPM_OPNN_SNO(3)`

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_database add migrations/V20260724_001__AddBesttImprovementOpinionSno.sql && git -C C:/it/it_database commit -m "feat: BESTTM/BESTTL 개선의견일련번호 추가 및 운영 PK 정렬"
```

---

### Task 2: NULL 제약·기본값·테이블 코멘트 운영 정렬

**Files:**
- Create: `it_database/migrations/V20260724_002__AlignConstraintsWithProduction.sql`

**Interfaces:**
- Consumes: 없음 (Task 1과 독립).
- Produces: 20개 컬럼 `NOT NULL`, `CBLBCM/CBLBCL.XPO_YN` NULL 허용, `CDECIM.DCD_TP_C`·`CINFMM.INFM_SD_STS_C` `DEFAULT '10' NOT NULL`. Task 5가 이 상태에 엔티티 `nullable`을 맞춘다.

- [ ] **Step 1: backfill 대상 재확인**

```sql
ALTER SESSION SET CURRENT_SCHEMA=ITPOWN;
SELECT 'BITEMM.DFR_CLE_C' c, COUNT(*) nulls FROM TPRMPP_BITEMM WHERE DFR_CLE_C IS NULL
UNION ALL SELECT 'BITEML.DFR_CLE_C', COUNT(*) FROM TPRMPP_BITEML WHERE DFR_CLE_C IS NULL
UNION ALL SELECT 'BCOSTL.ABUS_TC',   COUNT(*) FROM TPRMPP_BCOSTL WHERE ABUS_TC IS NULL
UNION ALL SELECT 'BCOSTL.DFR_CLE_C', COUNT(*) FROM TPRMPP_BCOSTL WHERE DFR_CLE_C IS NULL
UNION ALL SELECT 'CDECIM.DCD_TP_C',  COUNT(*) FROM TPRMPP_CDECIM WHERE DCD_TP_C IS NULL;
```

기대(2026-07-24 실측): 31 / 183 / 2 / 2 / 4. 다른 컬럼에서 NULL이 새로 발견되면 스크립트에 같은 방식의 backfill을 추가한다.

- [ ] **Step 2: 마이그레이션 스크립트 작성**

`it_database/migrations/V20260724_002__AlignConstraintsWithProduction.sql`:

```sql
-- 운영(meta/table.txt) 기준으로 NULL 제약·기본값·테이블 코멘트를 정렬한다.
-- NOT NULL 전환 전, 코드값이 비어 있는 기존 행은 공통코드의 '해당없음'으로 채운다.
--   DFR_CLE_C '0' = 해당없음, ABUS_TC '0' = 해당없음, DCD_TP_C '10' = 요청(운영 기본값)

UPDATE ITPOWN.TPRMPP_BITEMM SET DFR_CLE_C = '0' WHERE DFR_CLE_C IS NULL;
UPDATE ITPOWN.TPRMPP_BITEML SET DFR_CLE_C = '0' WHERE DFR_CLE_C IS NULL;
UPDATE ITPOWN.TPRMPP_BCOSTL SET ABUS_TC   = '0' WHERE ABUS_TC   IS NULL;
UPDATE ITPOWN.TPRMPP_BCOSTL SET DFR_CLE_C = '0' WHERE DFR_CLE_C IS NULL;
UPDATE ITPOWN.TPRMPP_CDECIM SET DCD_TP_C  = '10' WHERE DCD_TP_C IS NULL;
COMMIT;

-- 운영 기본값 부여 (기존 행은 위 backfill로 이미 채워져 있다)
ALTER TABLE ITPOWN.TPRMPP_CDECIM MODIFY (DCD_TP_C DEFAULT '10');
ALTER TABLE ITPOWN.TPRMPP_CINFMM MODIFY (INFM_SD_STS_C DEFAULT '10');

-- NULL 제약 정렬
DECLARE
    PROCEDURE align_nullable(
        p_table_name  VARCHAR2,
        p_column_name VARCHAR2,
        p_nullable    VARCHAR2
    ) IS
        v_nullable ALL_TAB_COLUMNS.NULLABLE%TYPE;
    BEGIN
        SELECT NULLABLE INTO v_nullable
          FROM ALL_TAB_COLUMNS
         WHERE OWNER = 'ITPOWN'
           AND TABLE_NAME = p_table_name
           AND COLUMN_NAME = p_column_name;
        IF v_nullable <> p_nullable THEN
            EXECUTE IMMEDIATE 'ALTER TABLE ITPOWN.' || p_table_name
                || ' MODIFY (' || p_column_name
                || CASE WHEN p_nullable = 'Y' THEN ' NULL)' ELSE ' NOT NULL)' END;
        END IF;
    END;
BEGIN
    -- 운영 NOT NULL / 로컬 NULL — 20건
    align_nullable('TPRMPP_BBIZCM', 'NOW_CTT_MANR_C',  'N');
    align_nullable('TPRMPP_BBIZCL', 'NOW_CTT_MANR_C',  'N');
    align_nullable('TPRMPP_BCOSTM', 'ABUS_TC',         'N');
    align_nullable('TPRMPP_BCOSTM', 'DFR_CLE_C',       'N');
    align_nullable('TPRMPP_BCOSTL', 'ABUS_TC',         'N');
    align_nullable('TPRMPP_BCOSTL', 'DFR_CLE_C',       'N');
    align_nullable('TPRMPP_BDELIM', 'TASK_DBR_TC',     'N');
    align_nullable('TPRMPP_BDELIM', 'TASK_DBR_RLT_TC', 'N');
    align_nullable('TPRMPP_BDELIM', 'TASK_DBR_TOD',    'N');
    align_nullable('TPRMPP_BDELIL', 'TASK_DBR_TC',     'N');
    align_nullable('TPRMPP_BDELIL', 'TASK_DBR_RLT_TC', 'N');
    align_nullable('TPRMPP_BDELIL', 'TASK_DBR_TOD',    'N');
    align_nullable('TPRMPP_BITEMM', 'DFR_CLE_C',       'N');
    align_nullable('TPRMPP_BITEML', 'DFR_CLE_C',       'N');
    align_nullable('TPRMPP_BPROJM', 'ABUS_TC',         'N');
    align_nullable('TPRMPP_BPROJL', 'ABUS_TC',         'N');
    align_nullable('TPRMPP_BTERMM', 'DFR_CLE_C',       'N');
    align_nullable('TPRMPP_BTERML', 'DFR_CLE_C',       'N');
    align_nullable('TPRMPP_CDECIM', 'DCD_TP_C',        'N');
    align_nullable('TPRMPP_CINFMM', 'INFM_SD_STS_C',   'N');

    -- 운영 NULL / 로컬 NOT NULL — 2건 (로컬이 과도하게 엄격했던 항목)
    align_nullable('TPRMPP_CBLBCM', 'XPO_YN', 'Y');
    align_nullable('TPRMPP_CBLBCL', 'XPO_YN', 'Y');
END;
/

-- 테이블 코멘트 정렬 (운영 표기는 공백 없음)
COMMENT ON TABLE ITPOWN.TPRMPP_BBIZCL IS '프로젝트관리_사업계약기본변경로그';
```

- [ ] **Step 3: 마이그레이션 적용**

```bash
cd it_backend && ./gradlew bootRun --args='--spring.profiles.active=local-int'
```

기동 로그에 `20260724.002 - AlignConstraintsWithProduction`이 보이면 성공. 서버를 종료한다.

- [ ] **Step 4: 적용 결과 검증**

```sql
ALTER SESSION SET CURRENT_SCHEMA=ITPOWN;
SELECT TABLE_NAME, COLUMN_NAME, NULLABLE, DATA_DEFAULT FROM ALL_TAB_COLUMNS
 WHERE OWNER='ITPOWN' AND (
   (TABLE_NAME IN ('TPRMPP_BITEMM','TPRMPP_BITEML','TPRMPP_BTERMM','TPRMPP_BTERML') AND COLUMN_NAME='DFR_CLE_C')
OR (TABLE_NAME IN ('TPRMPP_BCOSTM','TPRMPP_BCOSTL','TPRMPP_BPROJM','TPRMPP_BPROJL') AND COLUMN_NAME='ABUS_TC')
OR (TABLE_NAME IN ('TPRMPP_CBLBCM','TPRMPP_CBLBCL') AND COLUMN_NAME='XPO_YN')
OR (TABLE_NAME='TPRMPP_CDECIM' AND COLUMN_NAME='DCD_TP_C')
OR (TABLE_NAME='TPRMPP_CINFMM' AND COLUMN_NAME='INFM_SD_STS_C'))
 ORDER BY TABLE_NAME, COLUMN_NAME;
SELECT COMMENTS FROM ALL_TAB_COMMENTS WHERE OWNER='ITPOWN' AND TABLE_NAME='TPRMPP_BBIZCL';
```

기대: `XPO_YN` 2건만 `NULLABLE='Y'`, 나머지 전부 `'N'`. `DCD_TP_C`/`INFM_SD_STS_C`의 `DATA_DEFAULT`는 `'10'`. 코멘트는 `프로젝트관리_사업계약기본변경로그`.

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_database add migrations/V20260724_002__AlignConstraintsWithProduction.sql && git -C C:/it/it_database commit -m "feat: NULL 제약·기본값·테이블 코멘트 운영 기준 정렬"
```

---

### Task 3: 소요예산 산정 엔티티를 새 물리 구조에 매핑

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/entity/Besttm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/entity/BesttmId.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BesttmL.java`

**Interfaces:**
- Consumes: Task 1이 만든 `IPM_OPNN_SNO` 컬럼과 3컬럼 PK.
- Produces: `Besttm.getIpmOpnnSno() : Integer`, `Besttm.builder().ipmOpnnSno(Integer)`, `new BesttmId(String rqmBgReqDocNo, Integer docVrsSno, Integer ipmOpnnSno)`. Task 4가 이 시그니처를 사용한다.

- [ ] **Step 1: `BesttmId` 복합키 교체**

`BesttmId.java`의 클래스 본문 전체를 아래로 교체한다.

```java
/** 소요예산 산정 명세(Besttm) 복합 기본키. (문서번호 + 버전 + 개선의견일련번호) */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BesttmId implements Serializable {

    private String rqmBgReqDocNo;

    private Integer docVrsSno;

    private Integer ipmOpnnSno;
}
```

- [ ] **Step 2: `Besttm` 엔티티 매핑 교체**

`Besttm.java`에서 `@Id`가 붙은 4개 필드와 `opnnCone` 선언을 아래로 교체한다. `svnTemC`/`ioeC`는 `@Id`를 떼고 `nullable = false` 일반 컬럼으로 남긴다.

```java
    @Id
    @Column(name = "RQM_BG_REQ_DOC_NO", length = 30, nullable = false, comment = "소요예산요청문서번호")
    private String rqmBgReqDocNo;

    @Id
    @Column(name = "DOC_VRS_SNO", nullable = false, comment = "문서버전일련번호")
    private Integer docVrsSno;

    /** 문서·버전 안에서 1부터 부여하는 명세 행 번호. 운영 PK 3번째 컬럼. */
    @Id
    @Column(name = "IPM_OPNN_SNO", precision = 9, nullable = false, comment = "개선의견일련번호")
    private Integer ipmOpnnSno;

    @Column(name = "SVN_TEM_C", length = 5, nullable = false, comment = "담당팀코드")
    private String svnTemC;

    @Column(name = "IOE_C", length = 7, nullable = false, comment = "비목코드")
    private String ioeC;

    @Column(name = "RQM_BG_AMT", precision = 18, comment = "소요예산금액")
    private BigDecimal rqmBgAmt;

    @Column(name = "OPNN_CONE", length = 6000, comment = "의견내용")
    private String opnnCone;
```

또한 클래스 JavaDoc의 키 설명을 실제 구조에 맞춘다.

```java
/**
 * 소요예산 산정 상세(명세) 엔티티 — 팀별·비목별 소요예산금액.
 *
 * <p>DB 테이블: {@code TPRMPP_BESTTM}. 마스터(Bestim) 1건에 (담당팀 × 비목) N행.
 *
 * <p>물리 PK는 (문서번호 + 버전 + 개선의견일련번호)이며, (담당팀 + 비목)의 유일성은 DB 제약이 아니라
 * {@code EstimateService.saveLines}가 보장하는 업무 규칙이다.
 */
```

- [ ] **Step 3: `BesttmL` 로그 엔티티에 컬럼 추가**

`BesttmL.java`의 `docVrsSno` 선언 바로 뒤에 아래를 추가하고, `opnnCone`의 length를 6000으로 고친다.

```java
    @Column(name = "IPM_OPNN_SNO", precision = 9, comment = "개선의견일련번호")
    private Integer ipmOpnnSno;
```

```java
    @Column(name = "OPNN_CONE", length = 6000, comment = "의견내용")
    private String opnnCone;
```

- [ ] **Step 4: 컴파일과 매핑 정합성 확인**

```bash
cd it_backend && ./gradlew compileJava
```

기대: BUILD SUCCESSFUL. `@IdClass(BesttmId.class)`의 필드 3개가 `@Id` 3개와 이름·타입까지 일치해야 Hibernate 기동 시 매핑 검증을 통과한다. 이 시점의 `EstimateService.saveLines`는 `ipmOpnnSno`를 채우지 않으므로 **컴파일은 되지만 실제 저장은 NOT NULL 위반으로 실패한다.** Task 4에서 채번을 넣어 해소하므로 여기서 서버를 기동해 저장을 시도하지 않는다.

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it/domain/estimate/entity src/main/java/com/kdb/it/domain/log/entity/BesttmL.java && git -C C:/it/it_backend commit -m "refactor: Besttm 복합키를 운영 PK(개선의견일련번호) 기준으로 정렬"
```

---

### Task 4: 명세 저장 시 개선의견일련번호 채번

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java:209-257`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/dto/EstimateDto.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java`

**Interfaces:**
- Consumes: Task 3의 `Besttm.builder().ipmOpnnSno(Integer)`, `Besttm.getIpmOpnnSno()`.
- Produces: 동작 계약 — `saveLines`는 신규 행에 `max(기존 ipmOpnnSno) + 1`을 부여하고, 기존 행은 `(svnTemC, ioeC)`로 매칭해 갱신한다. 프론트 API 계약(`svnTemC`, `ioeC`, `rqmBgAmt`, `opnnCone`)은 바뀌지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`EstimateServiceTest.java`에 아래 `@Nested` 클래스를 추가한다.

```java
    @Nested
    @DisplayName("명세 저장 — 개선의견일련번호 채번")
    class SaveLinesSnoTests {

        private Bestim inProgress() {
            return Bestim.builder()
                    .rqmBgReqDocNo("REQ-2026-0001")
                    .docVrsSno(1)
                    .lstYn("Y")
                    .cncdRfrNo("PRJ-001")
                    .stsTc("55")
                    .build();
        }

        @Test
        @DisplayName("빈 문서에 2행을 저장하면 일련번호 1, 2가 부여된다")
        void assignsSequentialSnoForNewRows() {
            Bestim master = inProgress();
            when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(master));
            when(lineRepository.findByRqmBgReqDocNoAndDocVrsSno("REQ-2026-0001", 1))
                    .thenReturn(new ArrayList<>());

            List<Besttm> saved = new ArrayList<>();
            when(lineRepository.save(any(Besttm.class)))
                    .thenAnswer(
                            invocation -> {
                                Besttm row = invocation.getArgument(0);
                                saved.add(row);
                                return row;
                            });

            service.saveLines(
                    "REQ-2026-0001",
                    new EstimateDto.LinesRequest(
                            List.of(
                                    new EstimateDto.LineRequest(
                                            "T001", "1010", new BigDecimal("100"), "의견1"),
                                    new EstimateDto.LineRequest(
                                            "T002", "1020", new BigDecimal("200"), "의견2"))),
                    admin());

            assertThat(saved).hasSize(2);
            assertThat(saved).extracting(Besttm::getIpmOpnnSno).containsExactly(1, 2);
        }

        @Test
        @DisplayName("기존 행이 있으면 최대 일련번호 다음 번호를 이어서 부여한다")
        void continuesFromExistingMaxSno() {
            Bestim master = inProgress();
            when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                    .thenReturn(Optional.of(master));

            Besttm existing =
                    Besttm.builder()
                            .rqmBgReqDocNo("REQ-2026-0001")
                            .docVrsSno(1)
                            .ipmOpnnSno(7)
                            .svnTemC("T001")
                            .ioeC("1010")
                            .rqmBgAmt(new BigDecimal("100"))
                            .build();
            when(lineRepository.findByRqmBgReqDocNoAndDocVrsSno("REQ-2026-0001", 1))
                    .thenReturn(new ArrayList<>(List.of(existing)));

            List<Besttm> saved = new ArrayList<>();
            when(lineRepository.save(any(Besttm.class)))
                    .thenAnswer(
                            invocation -> {
                                Besttm row = invocation.getArgument(0);
                                saved.add(row);
                                return row;
                            });

            service.saveLines(
                    "REQ-2026-0001",
                    new EstimateDto.LinesRequest(
                            List.of(
                                    new EstimateDto.LineRequest(
                                            "T001", "1010", new BigDecimal("150"), "수정"),
                                    new EstimateDto.LineRequest(
                                            "T003", "1030", new BigDecimal("300"), "신규"))),
                    admin());

            // 기존 (T001,1010)은 갱신되므로 save 호출 없음. 신규 1건만 8번으로 채번된다.
            assertThat(saved).hasSize(1);
            assertThat(saved.get(0).getIpmOpnnSno()).isEqualTo(8);
            assertThat(saved.get(0).getSvnTemC()).isEqualTo("T003");
            assertThat(existing.getRqmBgAmt()).isEqualByComparingTo(new BigDecimal("150"));
        }
    }
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd it_backend && ./gradlew test --tests "*EstimateServiceTest*"
```

기대: FAIL — `EstimateService.saveLines`가 `ipmOpnnSno`를 설정하지 않아 컴파일 오류 또는 `containsExactly(1, 2)` 단언 실패.

- [ ] **Step 3: `saveLines` 채번 로직 구현**

`EstimateService.java:209-257`의 `saveLines` 메서드 본문에서, JavaDoc과 신규 INSERT 부분을 아래로 교체한다.

```java
    /**
     * 팀별 산정 명세 일괄 저장 — 진행중(55) 상태에서만 가능.
     *
     * <p>요청에 포함된 (팀코드+비목코드) 행은 추가/수정하고, 요청에 없는 기존 행은 Soft Delete 처리합니다 (Bitemm 동기화 패턴).
     *
     * <p>물리 PK는 (문서번호 + 버전 + 개선의견일련번호)이므로 신규 행에는 문서·버전 안에서 가장 큰 일련번호 다음 값을 부여합니다.
     * 삭제된 행의 번호는 재사용하지 않아 로그 이력과 번호가 어긋나지 않도록 합니다.
     *
     * @param docNo 소요예산요청문서번호
     * @param req 명세 일괄 저장 요청
     * @param user 요청자 인증 정보
     * @throws IllegalStateException 진행중이 아닌 경우
     */
    @Transactional
    public void saveLines(String docNo, EstimateDto.LinesRequest req, CustomUserDetails user) {
        Bestim e = loadCurrent(docNo);
        OwnershipVerifier.verifyOwnerOrAdmin(e.getFstEnrUsid(), user);
        if (!STS_IN_PROGRESS.equals(e.getStsTc())) {
            throw new IllegalStateException("진행중 상태에서만 산정 명세를 저장할 수 있습니다.");
        }
        Integer vrs = e.getDocVrsSno();
        // 삭제여부와 무관하게 모든 행을 조회 — soft-delete된 행도 (팀+비목) 중복 저장 방지를 위해 포함한다.
        List<Besttm> existing = lineRepository.findByRqmBgReqDocNoAndDocVrsSno(docNo, vrs);

        // 기존 행을 (팀코드|비목코드) 업무 키로 색인 (deleted 행 포함)
        Map<String, Besttm> byKey =
                existing.stream()
                        .collect(Collectors.toMap(b -> b.getSvnTemC() + "|" + b.getIoeC(), b -> b));

        // 신규 행 채번 시작값 — 삭제 행을 포함한 최대 일련번호 + 1
        int nextSno =
                existing.stream()
                                .map(Besttm::getIpmOpnnSno)
                                .filter(java.util.Objects::nonNull)
                                .mapToInt(Integer::intValue)
                                .max()
                                .orElse(0)
                        + 1;

        // 요청 행 처리: 기존 행이 있으면 (필요 시 복원 후) 갱신, 없으면 신규 INSERT
        Set<String> incomingKeys = new HashSet<>();
        for (EstimateDto.LineRequest line : req.lines()) {
            String key = line.svnTemC() + "|" + line.ioeC();
            incomingKeys.add(key);
            Besttm row = byKey.get(key);
            if (row != null) {
                // soft-delete된 행을 재추가하는 경우: 새 INSERT 대신 복원 후 갱신 (PK 충돌 방지)
                if ("Y".equals(row.getDelYn())) {
                    row.restore();
                }
                row.updateEstimate(line.rqmBgAmt(), line.opnnCone());
            } else {
                lineRepository.save(
                        Besttm.builder()
                                .rqmBgReqDocNo(docNo)
                                .docVrsSno(vrs)
                                .ipmOpnnSno(nextSno++)
                                .svnTemC(line.svnTemC())
                                .ioeC(line.ioeC())
                                .rqmBgAmt(line.rqmBgAmt())
                                .opnnCone(line.opnnCone())
                                .build());
            }
        }

        // 요청에 없는 활성(delYn='N') 행만 Soft Delete — 이미 삭제된 행은 그대로 둔다.
        for (Besttm row : existing) {
            boolean active = !"Y".equals(row.getDelYn());
            if (active && !incomingKeys.contains(row.getSvnTemC() + "|" + row.getIoeC())) {
                row.delete();
            }
        }
    }
```

- [ ] **Step 4: DTO 의견내용 길이를 물리 컬럼에 맞춤**

`EstimateDto.java`의 `LineRequest`에서 `opnnCone` 제한을 6000으로 고친다.

```java
    @Schema(name = "EstimateLineRequest", description = "팀별 산정 명세 1행")
    public record LineRequest(
            @NotBlank @Size(max = 5) String svnTemC,
            @NotBlank @Size(max = 7) String ioeC,
            @NotNull @DecimalMin(value = "0", message = "산정 예산액은 0 이상이어야 합니다.") BigDecimal rqmBgAmt,
            @Size(max = 6000) String opnnCone) {}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --tests "*EstimateServiceTest*"
```

기대: PASS (신규 2건 포함 전체 통과)

- [ ] **Step 6: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it/domain/estimate src/test/java/com/kdb/it/domain/estimate && git -C C:/it/it_backend commit -m "feat: 소요예산 산정 명세에 개선의견일련번호 채번 적용"
```

---

### Task 5: 엔티티 NULL 제약·길이를 물리 컬럼에 정렬

**Files:**
- Modify: `it_backend/.../domain/budget/project/entity/Bitemm.java:90`
- Modify: `it_backend/.../domain/budget/project/entity/Bprojm.java:218`
- Modify: `it_backend/.../domain/budget/cost/entity/Bcostm.java:71,138`
- Modify: `it_backend/.../domain/budget/cost/entity/Btermm.java:112`
- Modify: `it_backend/.../domain/bizplan/entity/Bbizcm.java:39`
- Modify: `it_backend/.../domain/deliberation/entity/Bdelim.java:57,60,66`
- Modify: `it_backend/.../common/approval/entity/Cdecim.java:55`
- Modify: `it_backend/.../common/notification/entity/Cinfmm.java:91`
- Modify: `it_backend/.../common/board/entity/Cblbcm.java:50`
- Modify: `it_backend/.../domain/log/entity/BitemmL.java:58`, `BtermmL.java:58`, `BprojmL.java:130`, `BcostmL.java:43,91`, `BbizcmL.java:30`, `BdelimL.java:41,44,50`, `CblbcmL.java:38`

**Interfaces:**
- Consumes: Task 2가 적용한 물리 NULL 제약.
- Produces: 없음 (매핑 정합성만 개선). Task 6이 이 제약을 코드로 보장한다.

- [ ] **Step 1: 업무 엔티티에 `nullable = false` 추가**

각 파일의 해당 `@Column`에 `nullable = false`를 추가한다. 컬럼명·길이·comment는 그대로 둔다.

```java
// Bitemm.java:90
    @Column(name = "DFR_CLE_C", length = 1, nullable = false, comment = "지급주기코드")

// Bprojm.java:218
    @Column(name = "ABUS_TC", length = 2, nullable = false, comment = "사업구분 (물리컬럼 ABUS_TC=사업구분코드)")

// Bcostm.java:71
    @Column(name = "DFR_CLE_C", length = 1, nullable = false, comment = "지급주기코드")

// Bcostm.java:138
    @Column(name = "ABUS_TC", length = 2, nullable = false, comment = "전산업무비구분 (물리컬럼 ABUS_TC=사업구분코드)")

// Btermm.java:112
    @Column(name = "DFR_CLE_C", length = 1, nullable = false, comment = "지급주기코드")

// Bbizcm.java:39
    @Column(name = "NOW_CTT_MANR_C", length = 2, nullable = false, comment = "현재계약방법코드")

// Bdelim.java:57
    @Column(name = "TASK_DBR_TC", length = 2, nullable = false, comment = "과업심의구분코드")

// Bdelim.java:60
    @Column(name = "TASK_DBR_RLT_TC", length = 2, nullable = false, comment = "과업심의결과구분코드")

// Bdelim.java:66
    @Column(name = "TASK_DBR_TOD", length = 2, nullable = false, comment = "과업심의회차")

// Cdecim.java:55
    @Column(name = "DCD_TP_C", length = 2, nullable = false, comment = "결재유형코드")

// Cinfmm.java:91
    @Column(name = "INFM_SD_STS_C", length = 2, nullable = false, comment = "알림발송상태코드")
```

- [ ] **Step 2: `Cblbcm.XPO_YN`의 과도한 NOT NULL 해제**

운영은 이 컬럼을 NULL 허용으로 둔다. `nullable = false`를 제거한다.

```java
// Cblbcm.java:50
    @Column(name = "XPO_YN", length = 1, comment = "노출여부")
```

- [ ] **Step 3: 로그 엔티티의 NULL 제약과 잘못된 length 정렬**

로그 테이블도 운영에서 NOT NULL이므로 동일하게 맞추고, 물리 길이와 다른 선언을 바로잡는다.

```java
// BitemmL.java:58 — 물리 컬럼은 VARCHAR2(1)인데 3으로 선언되어 있었다
    @Column(name = "DFR_CLE_C", length = 1, nullable = false, comment = "지급주기코드")

// BtermmL.java:58 — 물리 컬럼은 VARCHAR2(1)인데 3으로 선언되어 있었다
    @Column(name = "DFR_CLE_C", length = 1, nullable = false, comment = "지급주기코드")

// BprojmL.java:130 — 물리 컬럼은 VARCHAR2(2)인데 32로 선언되어 있었다
    @Column(name = "ABUS_TC", length = 2, nullable = false, comment = "사업구분")

// BcostmL.java:43
    @Column(name = "DFR_CLE_C", length = 1, nullable = false, comment = "지급주기코드")

// BcostmL.java:91
    @Column(name = "ABUS_TC", length = 2, nullable = false, comment = "전산업무비구분")

// BbizcmL.java:30
    @Column(name = "NOW_CTT_MANR_C", length = 2, nullable = false, comment = "현재계약방법코드")

// BdelimL.java:41
    @Column(name = "TASK_DBR_TC", length = 2, nullable = false, comment = "과업심의구분코드")

// BdelimL.java:44
    @Column(name = "TASK_DBR_RLT_TC", length = 2, nullable = false, comment = "과업심의결과구분코드")

// BdelimL.java:50
    @Column(name = "TASK_DBR_TOD", length = 2, nullable = false, comment = "과업심의회차")
```

`CblbcmL.java:38`은 이미 `nullable` 지정이 없으므로 변경하지 않는다.

- [ ] **Step 4: 전체 테스트로 회귀 확인**

```bash
cd it_backend && ./gradlew test
```

기대: BUILD SUCCESSFUL. 실패하면 해당 테스트가 NOT NULL 컬럼을 비운 채 엔티티를 만들고 있다는 뜻이므로, 테스트 픽스처에 `'0'`(해당없음)을 넣어 고친다.

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it && git -C C:/it/it_backend commit -m "fix: 엔티티 NULL 제약과 컬럼 길이를 운영 물리 구조에 정렬"
```

---

### Task 6: 코드 컬럼 빈값 정규화

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/code/CodeDefaults.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/code/CodeDefaultsTest.java`
- Modify: `it_backend/.../domain/budget/project/service/ProjectService.java:328,565`
- Modify: `it_backend/.../domain/budget/cost/service/CostService.java`

**Interfaces:**
- Consumes: Task 2의 NOT NULL 제약.
- Produces: `CodeDefaults.orNotApplicable(String) : String` — null/공백을 `"0"`으로, 그 외는 원본을 반환. Task 7의 프론트 기본값과 짝을 이룬다.

**왜 필요한가:** Oracle은 빈 문자열을 NULL로 저장한다. 프론트가 신규 행을 `dfrCleC: ''`, `abusTc: ''`로 만들기 때문에 Task 2 적용 후 저장이 `ORA-01400`으로 실패한다. Excel 붙여넣기 경로처럼 UI 기본값을 우회하는 입력도 있으므로 서버 저장 경계에서 막는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`it_backend/src/test/java/com/kdb/it/common/code/CodeDefaultsTest.java`:

```java
package com.kdb.it.common.code;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("CodeDefaults — NOT NULL 코드 컬럼 빈값 정규화")
class CodeDefaultsTest {

    @Test
    @DisplayName("null과 공백은 해당없음('0')으로 정규화된다")
    void normalizesBlankToNotApplicable() {
        assertThat(CodeDefaults.orNotApplicable(null)).isEqualTo("0");
        assertThat(CodeDefaults.orNotApplicable("")).isEqualTo("0");
        assertThat(CodeDefaults.orNotApplicable("   ")).isEqualTo("0");
    }

    @Test
    @DisplayName("값이 있으면 원본을 그대로 반환한다")
    void keepsExistingCode() {
        assertThat(CodeDefaults.orNotApplicable("M")).isEqualTo("M");
        assertThat(CodeDefaults.orNotApplicable("20")).isEqualTo("20");
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd it_backend && ./gradlew test --tests "*CodeDefaultsTest*"
```

기대: FAIL — `CodeDefaults` 클래스가 없어 컴파일 오류.

- [ ] **Step 3: `CodeDefaults` 구현**

`it_backend/src/main/java/com/kdb/it/common/code/CodeDefaults.java`:

```java
package com.kdb.it.common.code;

/**
 * NOT NULL 코드 컬럼의 빈값 정규화 유틸.
 *
 * <p>Oracle은 빈 문자열을 NULL로 저장하므로, 화면에서 코드를 고르지 않은 채 넘어온 값을 그대로 저장하면 NOT NULL 제약에
 * 걸린다. 운영 스키마에서 NOT NULL인 코드 컬럼(지급주기코드, 사업구분코드 등)은 저장 직전 이 유틸로 '해당없음'
 * 코드값으로 정규화한다.
 */
public final class CodeDefaults {

    /** 공통코드 '해당없음' 코드값. DFR_CLE_C, ABUS_TC 등이 공유한다. */
    public static final String NOT_APPLICABLE = "0";

    private CodeDefaults() {}

    /**
     * 코드값이 비어 있으면 '해당없음'으로 대체합니다.
     *
     * @param code 화면에서 전달된 코드값 (null 또는 공백 허용)
     * @return 값이 있으면 원본, 비어 있으면 {@link #NOT_APPLICABLE}
     */
    public static String orNotApplicable(String code) {
        return (code == null || code.isBlank()) ? NOT_APPLICABLE : code;
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --tests "*CodeDefaultsTest*"
```

기대: PASS

- [ ] **Step 5: 엔티티 변경 메서드에 적용**

`@PrePersist`에만 의존하지 않고 생성자·팩토리·변경 메서드에서 값을 확정한다(`it_backend/CLAUDE.md` §2). 아래 5개 대입문을 정규화로 감싸고, 각 파일 상단에 `import com.kdb.it.common.code.CodeDefaults;`를 추가한다.

```java
// Bcostm.java:205 (update 메서드)
        this.dfrCleC = CodeDefaults.orNotApplicable(dfrCleC);

// Bcostm.java:217 (update 메서드)
        this.abusTc = CodeDefaults.orNotApplicable(abusTc);

// Btermm.java:187 (update 메서드)
        this.dfrCleC = CodeDefaults.orNotApplicable(dfrCleC);

// Bitemm.java:157 (update 메서드)
        this.dfrCleC = CodeDefaults.orNotApplicable(dfrCleC);

// Bprojm.java:436 (생성 팩토리)
        this.abusTc = CodeDefaults.orNotApplicable(abusTc);

// Bprojm.java:538 (update 메서드)
        this.abusTc = CodeDefaults.orNotApplicable(abusTc);
```

- [ ] **Step 6: 빌더 기반 신규 생성 경로에 적용**

`@SuperBuilder`로 만드는 신규 행은 위 변경 메서드를 거치지 않으므로 빌더 호출부에서 정규화한다. 아래 5곳을 고치고 각 파일 상단에 `import com.kdb.it.common.code.CodeDefaults;`를 추가한다.

```java
// CostDto.java:195 — Bcostm toEntity(Integer nextSno)
                    .dfrCleC(CodeDefaults.orNotApplicable(this.dfrCleC)) // 지급주기

// CostDto.java:211 — Bcostm toEntity(Integer nextSno)
                    .abusTc(CodeDefaults.orNotApplicable(this.abusTc)) // 전산업무비구분

// CostDto.java:762 — Btermm toEntity()
                    .dfrCleC(CodeDefaults.orNotApplicable(this.dfrCleC))

// ProjectService.java:328 — 품목 신규 생성
                                .dfrCleC(CodeDefaults.orNotApplicable(itemDto.getDfrCleC())) // 지급주기

// ProjectService.java:565 — 품목 병합 저장
                                    .dfrCleC(CodeDefaults.orNotApplicable(itemDto.getDfrCleC())) // 지급주기
```

**읽기(조회) 경로에는 적용하지 않는다.** `CostDto.java:537`, `:549`, `:786`은 엔티티 → 응답 DTO 변환(`fromEntity`)이므로 건드리지 않는다. 저장된 `'0'`은 화면에서 공통코드명 "해당없음"으로 해석된다.

- [ ] **Step 7: 결재선 생성 시 결재유형코드 부여**

`TPRMPP_CDECIM.DCD_TP_C`는 운영에서 `DEFAULT '10' NOT NULL`이지만 현재 앱은 이 컬럼에 아무 값도 넣지 않는다(전체 4행이 NULL). 그대로 두면 Task 2 적용 후 신청서 생성이 `ORA-01400`으로 실패한다. 운영 기본값 `'10'`(요청)을 생성 시점에 부여한다.

먼저 `Cdecim.java:55`의 필드 JavaDoc이 실제와 어긋나므로 함께 고친다.

```java
    /** 결재유형코드: Ccodem DCD_TP_C 참조. 운영 스키마가 NOT NULL이므로 결재선 생성 시 '10'(요청)으로 시작한다. */
    @Column(name = "DCD_TP_C", length = 2, nullable = false, comment = "결재유형코드")
    private String dcdTpC;
```

상수를 엔티티에 선언한다. `DecisionStatus`가 아닌 `Cdecim`에 두는 이유는 이 값이 결재 진행 상태가 아니라 결재선 유형이기 때문이다. `itPtlDcdStsC` 관련 상수 선언부 근처에 추가한다.

```java
    /** 결재유형 기본값 — 요청. 운영 스키마의 DCD_TP_C DEFAULT와 같은 값이다. */
    public static final String DECISION_TYPE_REQUEST = "10";
```

`ApplicationService.java:182`의 `Cdecim.builder()` 체인에 아래 한 줄을 추가한다.

```java
                            .dcdTpC(Cdecim.DECISION_TYPE_REQUEST)
```

- [ ] **Step 8: 결재선 생성 회귀 테스트**

`ApplicationServiceTest`에 결재선 생성이 결재유형코드를 채우는지 확인하는 테스트를 추가한다. 기존 테스트가 신청서 생성 시 저장되는 `Cdecim` 목록을 캡처하고 있으면 그 단언에 아래를 덧붙이고, 없으면 캡처를 추가한다.

```java
        assertThat(savedDecisions)
                .isNotEmpty()
                .allSatisfy(d -> assertThat(d.getDcdTpC()).isEqualTo(Cdecim.DECISION_TYPE_REQUEST));
```

```bash
cd it_backend && ./gradlew test --tests "*ApplicationServiceTest*"
```

기대: PASS

- [ ] **Step 9: 전체 테스트 확인**

```bash
cd it_backend && ./gradlew test
```

기대: BUILD SUCCESSFUL

- [ ] **Step 10: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it src/test/java/com/kdb/it && git -C C:/it/it_backend commit -m "fix: NOT NULL 코드 컬럼의 빈값 정규화 및 결재유형코드 기본값 부여"
```

---

### Task 7: 프론트 코드 드롭다운 기본값 정렬

**Files:**
- Modify: `it_frontend/app/composables/costList/useCostRowEditing.ts:266`
- Modify: `it_frontend/app/components/cost/TerminalTableSection.vue:218`
- Modify: `it_frontend/app/components/cost/TerminalFormDialog.vue:203,206`

**Interfaces:**
- Consumes: Task 6의 서버측 정규화 (이 Task는 UX 정합성 담당 — 서버가 최종 방어선이다).
- Produces: 없음.

**왜 필요한가:** 서버가 `''`를 `'0'`으로 바꿔 저장하면, 저장 직후 화면의 빈 셀과 DB 값이 어긋난다. 신규 행 기본값을 `'0'`으로 두면 사용자가 저장 전에 "해당없음"을 보고 필요하면 바꿀 수 있다.

- [ ] **Step 1: 신규 전산업무비 행 기본값 변경**

`useCostRowEditing.ts:266`의 `abusTc: '',`를 아래로 바꾸고, 신규 행 객체 위에 이유를 남긴다.

```typescript
            // 사업구분코드는 물리 컬럼이 NOT NULL이므로 미선택 상태를 '0'(해당없음)으로 시작한다.
            abusTc: '0',
```

- [ ] **Step 2: 신규 단말기 행 기본값 변경**

`TerminalTableSection.vue:218`의 `dfrCleC: '',`를 바꾼다.

```typescript
            // 지급주기코드는 물리 컬럼이 NOT NULL이므로 미선택 상태를 '0'(해당없음)으로 시작한다.
            dfrCleC: '0',
```

- [ ] **Step 3: 단말기 폼 다이얼로그 폴백 변경**

`TerminalFormDialog.vue`의 두 폴백을 바꾼다.

```typescript
        abusTc: parentData.abusTc ?? '0',
```

```typescript
        dfrCleC: parentData.dfrCleC ?? '0',
```

- [ ] **Step 4: 타입 검사·단위 테스트 실행**

```bash
cd it_frontend && npm run check && npm test
```

기대: 두 명령 모두 통과. `useCostRowEditing` 관련 테스트가 `abusTc: ''`를 기대하고 있으면 `'0'`으로 함께 고친다.

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_frontend add app/composables/costList/useCostRowEditing.ts app/components/cost && git -C C:/it/it_frontend commit -m "fix: NOT NULL 코드 항목의 신규 행 기본값을 해당없음으로 설정"
```

---

### Task 8: 정렬 결과 재검증 및 문서 갱신

**Files:**
- Modify: `it_database/ITPOWN_DDL_live.sql` (재추출)
- Modify: `docs/db-schema-gap-2026-07-24.md`

**Interfaces:**
- Consumes: Task 1~7 전부.
- Produces: Gap 0건임을 보이는 재검증 기록.

- [ ] **Step 1: 로컬 DDL 스냅샷 재추출**

리포지토리에 있는 추출 스크립트를 그대로 사용한다. 기본 파라미터가 로컬 접속 정보와 동일하므로 인자 없이 실행하면 된다.

```bash
pwsh -File C:/it/it_database/export-ddl-live.ps1
```

`it_database/ITPOWN_DDL_live.sql`이 갱신되고 상단 `-- Generated at:` 시각이 현재로 바뀌는지 확인한다.

- [ ] **Step 2: Gap 재분석 실행**

`docs/db-schema-gap-2026-07-24.md`를 만들 때 사용한 비교를 다시 수행한다. 운영 기준 파일은 `C:\it\meta\table.txt`, 로컬 기준은 Step 1에서 갱신한 `it_database/ITPOWN_DDL_live.sql`이다. 비교 항목은 테이블명 / 테이블 코멘트 / 컬럼명 / 타입·길이·소수점 / 컬럼 순서 / 컬럼 코멘트 / PK / NULL 제약 / 기본값이며, `FLYWAY_SCHEMA_HISTORY`는 제외한다.

판정 규칙 두 가지를 원래 분석과 동일하게 유지한다.
- PK 컬럼은 Oracle에서 암묵적 `NOT NULL`이므로 NULL 제약 비교에서 제외한다.
- 로컬의 `DEFAULT NULL`은 기본값 미지정과 동작이 같으므로 Gap으로 세지 않는다.

기대 결과:

| 항목 | 기대 |
| --- | ---: |
| 업무 테이블 | 로컬 88 / 운영 88 |
| 업무 컬럼 | 로컬 1,606 / 운영 1,606 |
| 운영 전용 / 로컬 전용 컬럼 | 0 / 0 |
| 타입·길이·소수점 Gap | 0 |
| 컬럼 순서 Gap (절대 `COLUMN_ID`) | 0 |
| PK Gap | 0 |
| NULL 제약 Gap | 0 |
| 기본값 Gap (유효 기본값 기준) | 0 |
| 테이블·컬럼 코멘트 Gap | 0 |

`DEFAULT NULL` 표기 차이(32건)는 동작이 동일하므로 Gap으로 세지 않는다.

- [ ] **Step 3: 잔여 Gap이 있으면 원인별로 처리**

0건이 아니면 각 항목을 아래 기준으로 분류해 보고한다.
- Task 1/2 스크립트 누락 → 새 마이그레이션 `V20260724_003`으로 추가 (**적용된 스크립트는 수정 금지**)
- 운영 추출본 자체의 표기 문제 → `docs/db-schema-gap-2026-07-24.md`에 판정 근거를 기록하고 Gap에서 제외

- [ ] **Step 4: Gap 리포트에 재검증 절 추가**

`docs/db-schema-gap-2026-07-24.md` 끝에 아래 절을 추가한다. 표의 숫자는 Step 2의 실제 결과로 채운다.

```markdown
## 6. 정렬 후 재검증 (YYYY-MM-DD)

적용 스크립트: `it_database/migrations/V20260724_001__AddBesttImprovementOpinionSno.sql`,
`it_database/migrations/V20260724_002__AlignConstraintsWithProduction.sql`

| 항목 | 결과 |
| --- | ---: |
| 업무 테이블 | 로컬 88 / 운영 88 |
| 업무 컬럼 | 로컬 1,606 / 운영 1,606 |
| 테이블·컬럼 구성, 순서, 타입·길이, PK, NULL, 유효 기본값 Gap | 0건 |
| 테이블·컬럼 코멘트 Gap | 0건 |

함께 해소한 애플리케이션 측 불일치:
- `Besttm` 엔티티 복합키를 운영 PK(문서번호+버전+개선의견일련번호)로 정렬. 기존 4컬럼 `@Id`는 물리 PK와
  달라 명세 2행 이상 저장 시 `ORA-00001`이 발생하는 잠복 버그였다.
- `OPNN_CONE`(1000→6000), `BitemmL`/`BtermmL.DFR_CLE_C`(3→1), `BprojmL.ABUS_TC`(32→2) 매핑 길이 정정.
- NOT NULL 전환 대상 코드 컬럼의 빈 문자열 저장 경로를 `CodeDefaults.orNotApplicable`로 차단.
```

- [ ] **Step 5: 전체 검증 스택 실행**

```bash
cd it_backend && ./gradlew test
```

```bash
cd it_frontend && npm run check && npm test
```

기대: 모두 통과. 통과 결과를 확인한 뒤에만 완료를 선언한다.

- [ ] **Step 6: 커밋**

```bash
git -C C:/it add docs/db-schema-gap-2026-07-24.md && git -C C:/it commit -m "docs: 운영 기준 스키마 정렬 재검증 결과 기록"
```

```bash
git -C C:/it/it_database add ITPOWN_DDL_live.sql && git -C C:/it/it_database commit -m "chore: 정렬 후 ITPOWN DDL 스냅샷 재추출"
```

---

## 실행 순서와 의존성

```
Task 1 (BESTT 물리) ─┬─> Task 3 (BESTT 엔티티) ──> Task 4 (채번 로직)
                     │
Task 2 (제약 물리) ──┴─> Task 5 (엔티티 제약) ──> Task 6 (빈값 정규화) ──> Task 7 (프론트 기본값)
                                                                              │
                                                          Task 1~7 ──────────┴──> Task 8 (재검증)
```

Task 1과 Task 2는 서로 독립이므로 순서를 바꿔도 된다. Task 3은 Task 1 적용 후에만 통과한다(엔티티가 없는 컬럼을 참조하게 되므로). Task 5는 Task 2 적용 후에만 통과한다.

## 롤백

Flyway는 되돌리기 스크립트를 자동 생성하지 않는다. 문제가 생기면:
1. `FLYWAY_SCHEMA_HISTORY`에서 해당 버전 행을 삭제하지 말고,
2. 되돌릴 변경을 담은 새 버전(`V20260724_9NN__RevertXxx.sql`)을 작성해 적용한다.

Task 1은 `TPRMPP_BESTTM`/`TPRMPP_BESTTL`이 0행일 때만 실행하므로 데이터 손실 위험이 없다. Task 2의 backfill은 NULL을 코드값으로 채우는 단방향 변경이며, 되돌리려면 backfill 대상 행을 다시 NULL로 만들기 전에 NOT NULL 제약부터 해제해야 한다.
