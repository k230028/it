# 공통코드 체계 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TPRMPP_CCODEM`의 PK 구조를 `(C_ID, CDVA, STT_DT)`로 재정의하고, 카테고리/값을 분리해 다운스트림 FK가 CDVA만 저장하도록 변환. Dash/Underbar를 `_`로 통일. 단일 PR · 단일 점검창에서 빅뱅 전환.

**Architecture:** 신규 테이블 `_V2`에 변환 INSERT 후 swap 방식의 Flyway 마이그레이션. 백엔드는 엔티티 PK 확장 + 필드 rename + Repository/Service/Controller 시그니처 변경. 프론트는 `useCodeOptions`의 응답 키를 `cdId` → `cId/cdva`로 분리하고 모든 호출부 일괄 교체.

**Tech Stack:**
- Backend: Java 25, Spring Boot 4, Spring Data JPA + QueryDSL 5.1.0, Lombok, JUnit 5 + AssertJ + Mockito
- Frontend: Nuxt 4, Vue 3, TypeScript, PrimeVue, Vitest, Playwright
- DB: Oracle 21c XE (ITPAPP @ XEPDB1)
- 마이그레이션: Flyway-style SQL (수동 적용)

**Spec:** `docs/superpowers/specs/2026-05-11-common-code-redesign-design.md`

---

## Phase A — 마이그레이션 SQL

### Task 1: 신규 테이블 스키마 SQL 작성

**Files:**
- Create: `it_database/migrations/V20260512_001__ccodem_v2_schema.sql`
- Create: `it_database/migrations/V20260512_002__ccodel_v2_schema.sql`

- [ ] **Step 1: V001 - CCODEM_V2 DDL 작성**

```sql
-- V20260512_001__ccodem_v2_schema.sql
-- 신규 공통코드마스터 테이블 (PK 확장 + 신규 컬럼)
CREATE TABLE TPRMPP_CCODEM_V2 (
    C_ID         VARCHAR2(32)   NOT NULL,
    CDVA         VARCHAR2(32)   NOT NULL,
    STT_DT       DATE           NOT NULL,
    END_DT       DATE,
    C_NM         VARCHAR2(100),
    C_DES        VARCHAR2(500),
    CDVA_DTL     VARCHAR2(100),
    C_TP         VARCHAR2(100),
    C_TP_DES     VARCHAR2(500),
    HRK_C        VARCHAR2(65),
    C_SQN        NUMBER,
    DEL_YN       VARCHAR2(1)    DEFAULT 'N' NOT NULL,
    GUID         VARCHAR2(36),
    FST_ENR_DTM  TIMESTAMP,
    FST_ENR_USID VARCHAR2(32),
    LST_CHG_DTM  TIMESTAMP,
    LST_CHG_USID VARCHAR2(32),
    CONSTRAINT PK_CCODEM_V2 PRIMARY KEY (C_ID, CDVA, STT_DT)
);

COMMENT ON TABLE TPRMPP_CCODEM_V2 IS '공통코드마스터(V2)';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.C_ID     IS '코드ID(컬럼/엔티티명)';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.CDVA     IS '코드값';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.STT_DT   IS '시작일자';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.END_DT   IS '종료일자';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.C_NM     IS '코드명';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.C_DES    IS '코드설명';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.CDVA_DTL IS '코드값상세';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.C_TP     IS '코드타입';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.C_TP_DES IS '코드타입설명';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.HRK_C    IS '상위코드({C_ID}_{CDVA})';
COMMENT ON COLUMN TPRMPP_CCODEM_V2.C_SQN    IS '코드순서';

CREATE INDEX IDX_CCODEM_V2_CID_VALID
    ON TPRMPP_CCODEM_V2 (C_ID, DEL_YN, STT_DT, END_DT);
CREATE INDEX IDX_CCODEM_V2_HRK_C
    ON TPRMPP_CCODEM_V2 (HRK_C);
```

- [ ] **Step 2: V002 - CCODEL_V2 DDL 작성**

```sql
-- V20260512_002__ccodel_v2_schema.sql
-- 신규 공통코드 변경 로그 테이블 (마스터와 동일한 컬럼 셋 + BaseLogEntity 컬럼)
CREATE TABLE TPRMPP_CCODEL_V2 (
    LOG_SEQ      NUMBER         NOT NULL,
    LOG_TYPE     VARCHAR2(10),
    LOG_DTM      TIMESTAMP,
    LOG_USID     VARCHAR2(32),
    LOG_RSN      VARCHAR2(200),
    C_ID         VARCHAR2(32),
    CDVA         VARCHAR2(32),
    STT_DT       DATE,
    END_DT       DATE,
    C_NM         VARCHAR2(100),
    C_DES        VARCHAR2(500),
    CDVA_DTL     VARCHAR2(100),
    C_TP         VARCHAR2(100),
    C_TP_DES     VARCHAR2(500),
    HRK_C        VARCHAR2(65),
    C_SQN        NUMBER,
    DEL_YN       VARCHAR2(1)    DEFAULT 'N' NOT NULL,
    GUID         VARCHAR2(36),
    FST_ENR_DTM  TIMESTAMP,
    FST_ENR_USID VARCHAR2(32),
    LST_CHG_DTM  TIMESTAMP,
    LST_CHG_USID VARCHAR2(32),
    CONSTRAINT PK_CCODEL_V2 PRIMARY KEY (LOG_SEQ)
);

COMMENT ON TABLE TPRMPP_CCODEL_V2 IS '공통코드 변경 로그(V2)';
```

> 컬럼 셋(LOG_SEQ/LOG_TYPE/LOG_DTM/LOG_USID/LOG_RSN)은 프로젝트의 `BaseLogEntity`가 기록하는 실제 컬럼명과 일치시켜야 한다. 본 작업 시작 시 `it_backend/src/main/java/com/kdb/it/domain/log/entity/BaseLogEntity.java`를 열어 컬럼명·타입을 1:1로 맞춰 조정한다.

- [ ] **Step 3: Dev DB에서 syntax 검증**

Run: `sqlplus ITPAPP/<pwd>@//localhost:1521/XEPDB1 @V20260512_001__ccodem_v2_schema.sql`
Expected: `Table created.` + `Comment created.` (반복) + `Index created.` x2

- [ ] **Step 4: Commit**

```bash
git add it_database/migrations/V20260512_001__ccodem_v2_schema.sql \
        it_database/migrations/V20260512_002__ccodel_v2_schema.sql
git commit -m "feat(db): CCODEM_V2/CCODEL_V2 신규 스키마 추가"
```

---

### Task 2: 데이터 변환 INSERT + 사전 검증 SQL

**Files:**
- Create: `it_database/migrations/V20260512_003__ccodem_v2_data_load.sql`
- Create: `it_database/migrations/V20260512_004__ccodem_v2_data_verify.sql`

- [ ] **Step 1: V004 - 검증 쿼리(PK 중복 후보 탐지)**

```sql
-- V20260512_004__ccodem_v2_data_verify.sql
DECLARE
    v_dup_cnt NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_dup_cnt FROM (
        SELECT prefix, postfix, stt_dt
          FROM (SELECT REGEXP_REPLACE(REPLACE(C_ID,'-','_'), '_[A-Z0-9]+$', '') prefix,
                       REGEXP_SUBSTR(REPLACE(C_ID,'-','_'), '[A-Z0-9]+$')        postfix,
                       STT_DT
                  FROM TPRMPP_CCODEM
                 WHERE DEL_YN = 'N')
         GROUP BY prefix, postfix, stt_dt
        HAVING COUNT(*) > 1
    );
    IF v_dup_cnt > 0 THEN
        RAISE_APPLICATION_ERROR(-20001,
            'CCODEM 변환 후 PK 중복 후보 ' || v_dup_cnt || '건 발견. 마이그레이션 중단.');
    END IF;
END;
/
```

- [ ] **Step 2: V003 - 변환 INSERT (마스터 + 로그)**

```sql
-- V20260512_003__ccodem_v2_data_load.sql
INSERT INTO TPRMPP_CCODEM_V2
    (C_ID, CDVA, STT_DT, END_DT,
     C_NM, C_DES, CDVA_DTL, C_TP, C_TP_DES, HRK_C, C_SQN,
     DEL_YN, GUID, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID)
SELECT
    REGEXP_REPLACE(REPLACE(C_ID,'-','_'), '_[A-Z0-9]+$', '')   AS C_ID,
    REGEXP_SUBSTR(REPLACE(C_ID,'-','_'), '[A-Z0-9]+$')         AS CDVA,
    STT_DT,
    END_DT,
    CDVA          AS C_NM,
    CTT_TP_DES    AS C_DES,
    C_NM          AS CDVA_DTL,
    CTT_TP        AS C_TP,
    CTT_TP_DES    AS C_TP_DES,
    NULL          AS HRK_C,
    C_SQN,
    DEL_YN,
    GUID,
    FST_ENR_DTM,
    FST_ENR_USID,
    LST_CHG_DTM,
    LST_CHG_USID
  FROM TPRMPP_CCODEM;

INSERT INTO TPRMPP_CCODEL_V2
    (LOG_SEQ, LOG_TYPE, LOG_DTM, LOG_USID, LOG_RSN,
     C_ID, CDVA, STT_DT, END_DT,
     C_NM, C_DES, CDVA_DTL, C_TP, C_TP_DES, HRK_C, C_SQN,
     DEL_YN, GUID, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID)
SELECT
    ROWNUM, 'I', SYSTIMESTAMP, 'SYSTEM', 'SCHEMA_MIGRATION_20260512',
    C_ID, CDVA, STT_DT, END_DT,
    C_NM, C_DES, CDVA_DTL, C_TP, C_TP_DES, HRK_C, C_SQN,
    DEL_YN, GUID, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID
  FROM TPRMPP_CCODEM_V2;

COMMIT;
```

> `LOG_SEQ`가 시퀀스 기반이면 ROWNUM 대신 `LOG_SEQ.NEXTVAL` 사용. BaseLogEntity 매핑 확인 후 조정.

- [ ] **Step 3: V004 dangling 검출 블록 추가 (대표 컬럼별 반복)**

`V20260512_004__ccodem_v2_data_verify.sql`에 다음 블록을 컬럼별로 복제 append (PRJ_TP, BZ_DTT, PUL_DTT, CUR, TCHN_TP, MN_USR, RPR_STS, PRJ_PUL_PTT, DFR_CLE, IOE_CAT 등):

```sql
DECLARE
    v_dangling NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_dangling
      FROM TPRMPP_BPROJM p
     WHERE p.PRJ_TP IS NOT NULL
       AND p.PRJ_TP NOT IN (
         SELECT REGEXP_SUBSTR(REPLACE(c.C_ID,'-','_'), '[A-Z0-9]+$')
           FROM TPRMPP_CCODEM c
          WHERE REGEXP_REPLACE(REPLACE(c.C_ID,'-','_'), '_[A-Z0-9]+$', '') = 'PRJ_TP'
            AND c.DEL_YN = 'N');
    IF v_dangling > 0 THEN
        RAISE_APPLICATION_ERROR(-20002,
            'BPROJM.PRJ_TP에 신규 CCODEM_V2에서 매칭 안 되는 값 ' || v_dangling || '건. 마이그레이션 중단.');
    END IF;
END;
/
```

- [ ] **Step 4: Dev DB에서 V003 → V004 실행 검증**

Run:
```
sqlplus ITPAPP/<pwd>@//localhost:1521/XEPDB1
@V20260512_003__ccodem_v2_data_load.sql
@V20260512_004__ccodem_v2_data_verify.sql
```
Expected: `XXX rows created.` + `PL/SQL procedure successfully completed.`

- [ ] **Step 5: Commit**

```bash
git add it_database/migrations/V20260512_003__ccodem_v2_data_load.sql \
        it_database/migrations/V20260512_004__ccodem_v2_data_verify.sql
git commit -m "feat(db): CCODEM_V2 데이터 변환 INSERT + 사전 검증"
```

---

### Task 3: 다운스트림 FK 데이터 일괄 UPDATE SQL

**Files:**
- Create: `it_database/migrations/V20260512_005__downstream_fk_data.sql`
- Create: `it_database/migrations/_audit/V20260512_005_rowcount.txt`

- [ ] **Step 1: 다운스트림 컬럼 인벤토리 확정**

작업 직전 백엔드 엔티티(`Bprojm`, `Brdocm`, `Bcostm`, `Bitemm` 등)를 열어 코드형 컬럼을 한 번 더 확인. 기본 인벤토리:

```
TPRMPP_BPROJM:  PRJ_TP, BZ_DTT, PUL_DTT, CUR, TCHN_TP, MN_USR, RPR_STS, PRJ_PUL_PTT
TPRMPP_BPROJML: 동일
TPRMPP_BRDOCM:  BZ_DTT
TPRMPP_BRDOCML: BZ_DTT
TPRMPP_BCOSTM:  DFR_CLE, IOE_CAT
TPRMPP_BCOSTML: 동일
TPRMPP_BITEMM:  IOE_CAT, DFR_CLE (사용 시)
```

- [ ] **Step 2: UPDATE SQL 작성**

```sql
-- V20260512_005__downstream_fk_data.sql
-- 'PRJ_TP_001' → '001', 'PRJ-TP-001' → '001', 'PRJ-TP-NEW' → 'NEW'

UPDATE TPRMPP_BPROJM SET PRJ_TP      = REGEXP_SUBSTR(REPLACE(PRJ_TP,     '-','_'), '[A-Z0-9]+$') WHERE PRJ_TP      IS NOT NULL;
UPDATE TPRMPP_BPROJM SET BZ_DTT      = REGEXP_SUBSTR(REPLACE(BZ_DTT,     '-','_'), '[A-Z0-9]+$') WHERE BZ_DTT      IS NOT NULL;
UPDATE TPRMPP_BPROJM SET PUL_DTT     = REGEXP_SUBSTR(REPLACE(PUL_DTT,    '-','_'), '[A-Z0-9]+$') WHERE PUL_DTT     IS NOT NULL;
UPDATE TPRMPP_BPROJM SET CUR         = REGEXP_SUBSTR(REPLACE(CUR,        '-','_'), '[A-Z0-9]+$') WHERE CUR         IS NOT NULL;
UPDATE TPRMPP_BPROJM SET TCHN_TP     = REGEXP_SUBSTR(REPLACE(TCHN_TP,    '-','_'), '[A-Z0-9]+$') WHERE TCHN_TP     IS NOT NULL;
UPDATE TPRMPP_BPROJM SET MN_USR      = REGEXP_SUBSTR(REPLACE(MN_USR,     '-','_'), '[A-Z0-9]+$') WHERE MN_USR      IS NOT NULL;
UPDATE TPRMPP_BPROJM SET RPR_STS     = REGEXP_SUBSTR(REPLACE(RPR_STS,    '-','_'), '[A-Z0-9]+$') WHERE RPR_STS     IS NOT NULL;
UPDATE TPRMPP_BPROJM SET PRJ_PUL_PTT = REGEXP_SUBSTR(REPLACE(PRJ_PUL_PTT,'-','_'), '[A-Z0-9]+$') WHERE PRJ_PUL_PTT IS NOT NULL;

UPDATE TPRMPP_BPROJML SET PRJ_TP      = REGEXP_SUBSTR(REPLACE(PRJ_TP,     '-','_'), '[A-Z0-9]+$') WHERE PRJ_TP      IS NOT NULL;
UPDATE TPRMPP_BPROJML SET BZ_DTT      = REGEXP_SUBSTR(REPLACE(BZ_DTT,     '-','_'), '[A-Z0-9]+$') WHERE BZ_DTT      IS NOT NULL;
UPDATE TPRMPP_BPROJML SET PUL_DTT     = REGEXP_SUBSTR(REPLACE(PUL_DTT,    '-','_'), '[A-Z0-9]+$') WHERE PUL_DTT     IS NOT NULL;
UPDATE TPRMPP_BPROJML SET CUR         = REGEXP_SUBSTR(REPLACE(CUR,        '-','_'), '[A-Z0-9]+$') WHERE CUR         IS NOT NULL;
UPDATE TPRMPP_BPROJML SET TCHN_TP     = REGEXP_SUBSTR(REPLACE(TCHN_TP,    '-','_'), '[A-Z0-9]+$') WHERE TCHN_TP     IS NOT NULL;
UPDATE TPRMPP_BPROJML SET MN_USR      = REGEXP_SUBSTR(REPLACE(MN_USR,     '-','_'), '[A-Z0-9]+$') WHERE MN_USR      IS NOT NULL;
UPDATE TPRMPP_BPROJML SET RPR_STS     = REGEXP_SUBSTR(REPLACE(RPR_STS,    '-','_'), '[A-Z0-9]+$') WHERE RPR_STS     IS NOT NULL;
UPDATE TPRMPP_BPROJML SET PRJ_PUL_PTT = REGEXP_SUBSTR(REPLACE(PRJ_PUL_PTT,'-','_'), '[A-Z0-9]+$') WHERE PRJ_PUL_PTT IS NOT NULL;

UPDATE TPRMPP_BRDOCM  SET BZ_DTT = REGEXP_SUBSTR(REPLACE(BZ_DTT,'-','_'), '[A-Z0-9]+$') WHERE BZ_DTT IS NOT NULL;
UPDATE TPRMPP_BRDOCML SET BZ_DTT = REGEXP_SUBSTR(REPLACE(BZ_DTT,'-','_'), '[A-Z0-9]+$') WHERE BZ_DTT IS NOT NULL;

UPDATE TPRMPP_BCOSTM  SET DFR_CLE = REGEXP_SUBSTR(REPLACE(DFR_CLE,'-','_'), '[A-Z0-9]+$') WHERE DFR_CLE IS NOT NULL;
UPDATE TPRMPP_BCOSTM  SET IOE_CAT = REGEXP_SUBSTR(REPLACE(IOE_CAT,'-','_'), '[A-Z0-9]+$') WHERE IOE_CAT IS NOT NULL;
UPDATE TPRMPP_BCOSTML SET DFR_CLE = REGEXP_SUBSTR(REPLACE(DFR_CLE,'-','_'), '[A-Z0-9]+$') WHERE DFR_CLE IS NOT NULL;
UPDATE TPRMPP_BCOSTML SET IOE_CAT = REGEXP_SUBSTR(REPLACE(IOE_CAT,'-','_'), '[A-Z0-9]+$') WHERE IOE_CAT IS NOT NULL;

COMMIT;
```

- [ ] **Step 3: 영향 행수 사전 카운트 저장**

`_audit/V20260512_005_rowcount.txt`에 다음 쿼리 결과를 저장:

```sql
SELECT 'BPROJM.PRJ_TP'  col, COUNT(*) cnt FROM TPRMPP_BPROJM WHERE PRJ_TP IS NOT NULL UNION ALL
SELECT 'BPROJM.BZ_DTT'  col, COUNT(*)     FROM TPRMPP_BPROJM WHERE BZ_DTT IS NOT NULL UNION ALL
SELECT 'BPROJM.PUL_DTT' col, COUNT(*)     FROM TPRMPP_BPROJM WHERE PUL_DTT IS NOT NULL UNION ALL
SELECT 'BPROJM.CUR'     col, COUNT(*)     FROM TPRMPP_BPROJM WHERE CUR     IS NOT NULL UNION ALL
SELECT 'BCOSTM.DFR_CLE' col, COUNT(*)     FROM TPRMPP_BCOSTM WHERE DFR_CLE IS NOT NULL UNION ALL
SELECT 'BCOSTM.IOE_CAT' col, COUNT(*)     FROM TPRMPP_BCOSTM WHERE IOE_CAT IS NOT NULL;
-- (필요한 컬럼 추가)
```

- [ ] **Step 4: Dev DB 실행 검증**

Run: `sqlplus … @V20260512_005__downstream_fk_data.sql`
Expected: 각 UPDATE의 영향 행수가 사전 카운트와 동일

- [ ] **Step 5: Commit**

```bash
git add it_database/migrations/V20260512_005__downstream_fk_data.sql \
        it_database/migrations/_audit/
git commit -m "feat(db): 다운스트림 FK 코드값을 CDVA 형식으로 일괄 정제"
```

---

### Task 4: Swap 마이그레이션 + Rollback SQL

**Files:**
- Create: `it_database/migrations/V20260512_006__rename_swap.sql`
- Create: `it_database/migrations/V20260512_007__rename_swap_log.sql`
- Create: `it_database/migrations/Vundo_20260512__rollback.sql`

- [ ] **Step 1: V006 - 마스터 스왑**

```sql
-- V20260512_006__rename_swap.sql
ALTER TABLE TPRMPP_CCODEM    RENAME TO TPRMPP_CCODEM_OLD;
ALTER TABLE TPRMPP_CCODEM_V2 RENAME TO TPRMPP_CCODEM;
ALTER INDEX IDX_CCODEM_V2_CID_VALID RENAME TO IDX_CCODEM_CID_VALID;
ALTER INDEX IDX_CCODEM_V2_HRK_C     RENAME TO IDX_CCODEM_HRK_C;
```

- [ ] **Step 2: V007 - 로그 스왑**

```sql
-- V20260512_007__rename_swap_log.sql
ALTER TABLE TPRMPP_CCODEL    RENAME TO TPRMPP_CCODEL_OLD;
ALTER TABLE TPRMPP_CCODEL_V2 RENAME TO TPRMPP_CCODEL;
```

- [ ] **Step 3: Rollback SQL**

```sql
-- Vundo_20260512__rollback.sql (수동 실행)
ALTER TABLE TPRMPP_CCODEM     RENAME TO TPRMPP_CCODEM_FAILED;
ALTER TABLE TPRMPP_CCODEM_OLD RENAME TO TPRMPP_CCODEM;
ALTER TABLE TPRMPP_CCODEL     RENAME TO TPRMPP_CCODEL_FAILED;
ALTER TABLE TPRMPP_CCODEL_OLD RENAME TO TPRMPP_CCODEL;
-- 다운스트림 FK 데이터(V005 적용분)는 expdp 백업 복원으로 별도 복구.

-- D+30 정상 종료 후 정리:
-- DROP TABLE TPRMPP_CCODEM_OLD;
-- DROP TABLE TPRMPP_CCODEL_OLD;
-- DROP TABLE TPRMPP_CCODEM_FAILED;
-- DROP TABLE TPRMPP_CCODEL_FAILED;
```

- [ ] **Step 4: Dev DB 일괄 적용 리허설**

Run:
```
@V20260512_001__ccodem_v2_schema.sql
@V20260512_002__ccodel_v2_schema.sql
@V20260512_003__ccodem_v2_data_load.sql
@V20260512_004__ccodem_v2_data_verify.sql
@V20260512_005__downstream_fk_data.sql
@V20260512_006__rename_swap.sql
@V20260512_007__rename_swap_log.sql
SELECT C_ID, CDVA, STT_DT, C_NM, C_DES FROM TPRMPP_CCODEM WHERE ROWNUM <= 5;
```
Expected: 변환된 행 5건이 매핑대로 표시 (예: `CUR/001/.../1400/환율`)

- [ ] **Step 5: Commit**

```bash
git add it_database/migrations/V20260512_006__rename_swap.sql \
        it_database/migrations/V20260512_007__rename_swap_log.sql \
        it_database/migrations/Vundo_20260512__rollback.sql
git commit -m "feat(db): CCODEM/CCODEL 신규 정식 테이블로 swap + 롤백 SQL"
```

---

## Phase B — 백엔드 엔티티/리포지토리

### Task 5: `CcodemId` 복합키 3개로 확장

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/entity/CcodemId.java`

- [ ] **Step 1: 신규 필드 추가**

```java
package com.kdb.it.common.code.entity;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDate;

/**
 * 공통코드마스터(Ccodem) 엔티티의 복합 기본키 클래스.
 * PK: (C_ID, CDVA, STT_DT)
 */
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class CcodemId implements Serializable {
    /** 코드ID */
    private String cId;
    /** 코드값 */
    private String cdva;
    /** 시작일자 */
    private LocalDate sttDt;
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava`
Expected: 빌드 실패 — 다음 태스크에서 해소. 본 태스크 단독 커밋 보류 (Task 9 끝에서 일괄).

---

### Task 6: `Ccodem` 엔티티 신규 필드/Rename 적용

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/entity/Ccodem.java`

- [ ] **Step 1: 전체 파일 교체**

```java
package com.kdb.it.common.code.entity;

import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.CcodemL;
import com.kdb.it.domain.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

/**
 * 공통코드마스터.
 * 테이블: TPRMPP_CCODEM, PK: (C_ID, CDVA, STT_DT)
 */
@LogTarget(entity = CcodemL.class)
@Entity
@Table(name = "TPRMPP_CCODEM", comment = "공통코드마스터")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
@IdClass(CcodemId.class)
public class Ccodem extends BaseEntity {

    @Id
    @Column(name = "C_ID", nullable = false, length = 32, comment = "코드ID")
    private String cId;

    @Id
    @Column(name = "CDVA", nullable = false, length = 32, comment = "코드값")
    private String cdva;

    @Id
    @Column(name = "STT_DT", nullable = false, comment = "시작일자")
    private LocalDate sttDt;

    @Column(name = "END_DT", comment = "종료일자")
    private LocalDate endDt;

    @Column(name = "C_NM", length = 100, comment = "코드명")
    private String cNm;

    @Column(name = "C_DES", length = 500, comment = "코드설명")
    private String cDes;

    @Column(name = "CDVA_DTL", length = 100, comment = "코드값상세")
    private String cdvaDtl;

    @Column(name = "C_TP", length = 100, comment = "코드타입")
    private String cTp;

    @Column(name = "C_TP_DES", length = 500, comment = "코드타입설명")
    private String cTpDes;

    @Column(name = "HRK_C", length = 65, comment = "상위코드({C_ID}_{CDVA})")
    private String hrkC;

    @Column(name = "C_SQN", comment = "코드순서")
    private Integer cSqn;

    /**
     * 공통코드 정보 업데이트.
     *
     * @param cNm     코드명
     * @param cDes    코드설명
     * @param cdvaDtl 코드값상세
     * @param cTp     코드타입
     * @param cTpDes  코드타입설명
     * @param hrkC    상위코드
     * @param cSqn    코드순서
     * @param endDt   종료일자
     */
    public void update(String cNm, String cDes, String cdvaDtl,
                       String cTp, String cTpDes, String hrkC,
                       Integer cSqn, LocalDate endDt) {
        this.cNm = cNm;
        this.cDes = cDes;
        this.cdvaDtl = cdvaDtl;
        this.cTp = cTp;
        this.cTpDes = cTpDes;
        this.hrkC = hrkC;
        this.cSqn = cSqn;
        this.endDt = endDt;
    }
}
```

- [ ] **Step 2: 컴파일 확인 (의도적 부분 실패)**

Run: `cd it_backend && ./gradlew compileJava`
Expected: 본 엔티티는 통과, Repository/Service/Test는 실패 (다음 태스크에서 해소)

---

### Task 7: `CcodemL` 로그 엔티티 동일 반영

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/CcodemL.java`

- [ ] **Step 1: 전체 파일 교체**

```java
package com.kdb.it.domain.log.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

/**
 * 공통코드마스터(TPRMPP_CCODEM) 변경 로그 엔티티.
 */
@Entity
@Table(name = "TPRMPP_CCODEL", comment = "공통코드 변경 로그")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class CcodemL extends BaseLogEntity {

    @Column(name = "C_ID", length = 32, comment = "코드ID")
    private String cId;

    @Column(name = "CDVA", length = 32, comment = "코드값")
    private String cdva;

    @Column(name = "STT_DT", comment = "시작일자")
    private LocalDate sttDt;

    @Column(name = "END_DT", comment = "종료일자")
    private LocalDate endDt;

    @Column(name = "C_NM", length = 100, comment = "코드명")
    private String cNm;

    @Column(name = "C_DES", length = 500, comment = "코드설명")
    private String cDes;

    @Column(name = "CDVA_DTL", length = 100, comment = "코드값상세")
    private String cdvaDtl;

    @Column(name = "C_TP", length = 100, comment = "코드타입")
    private String cTp;

    @Column(name = "C_TP_DES", length = 500, comment = "코드타입설명")
    private String cTpDes;

    @Column(name = "HRK_C", length = 65, comment = "상위코드")
    private String hrkC;

    @Column(name = "C_SQN", comment = "코드순서")
    private Integer cSqn;
}
```

---

### Task 8: `CodeRepository` 메서드 시그니처 갱신

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/repository/CodeRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/repository/CodeRepositoryCustom.java`

- [ ] **Step 1: `CodeRepository` 갱신**

```java
package com.kdb.it.common.code.repository;

import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.entity.CcodemId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;

@Repository
public interface CodeRepository extends JpaRepository<Ccodem, CcodemId>, CodeRepositoryCustom {

    Optional<Ccodem> findByCIdAndCdvaAndSttDtAndDelYn(
            String cId, String cdva, LocalDate sttDt, String delYn);

    boolean existsByCIdAndCdvaAndSttDt(String cId, String cdva, LocalDate sttDt);
}
```

- [ ] **Step 2: `CodeRepositoryCustom` 갱신**

```java
package com.kdb.it.common.code.repository;

import com.kdb.it.common.code.entity.Ccodem;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CodeRepositoryCustom {
    /** (C_ID, CDVA) 단건. 기준일자 유효 + DEL_YN='N'. 동일키 다중 STT_DT면 최신 sttDt 반환. */
    Optional<Ccodem> findByCIdAndCdvaWithValidDate(String cId, String cdva, LocalDate targetDate);

    /** C_ID(카테고리) 다건. 기준일자 유효 + DEL_YN='N'. cSqn asc nullsLast, cdva asc. */
    List<Ccodem> findByCIdWithValidDate(String cId, LocalDate targetDate);

    /** HRK_C 일치 자식 코드 다건. */
    List<Ccodem> findChildrenOfHrkC(String hrkC);

    /** 관리자 화면용 — DEL_YN='N' 전체. */
    List<Ccodem> findAllActive();
}
```

---

### Task 9: `CodeRepositoryImpl` QueryDSL 구현 갱신

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/repository/CodeRepositoryImpl.java`

- [ ] **Step 1: 전체 파일 교체**

```java
package com.kdb.it.common.code.repository;

import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.entity.QCcodem;
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.jpa.impl.JPAQueryFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class CodeRepositoryImpl implements CodeRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public Optional<Ccodem> findByCIdAndCdvaWithValidDate(String cId, String cdva, LocalDate targetDate) {
        QCcodem q = QCcodem.ccodem;
        LocalDate eff = (targetDate != null) ? targetDate : LocalDate.now();
        Ccodem result = queryFactory.selectFrom(q)
                .where(q.cId.eq(cId), q.cdva.eq(cdva), q.delYn.eq("N"), isValidDate(q, eff))
                .orderBy(q.sttDt.desc())
                .fetchFirst();
        return Optional.ofNullable(result);
    }

    @Override
    public List<Ccodem> findByCIdWithValidDate(String cId, LocalDate targetDate) {
        QCcodem q = QCcodem.ccodem;
        LocalDate eff = (targetDate != null) ? targetDate : LocalDate.now();
        return queryFactory.selectFrom(q)
                .where(q.cId.eq(cId), q.delYn.eq("N"), isValidDate(q, eff))
                .orderBy(q.cSqn.asc().nullsLast(), q.cdva.asc())
                .fetch();
    }

    @Override
    public List<Ccodem> findChildrenOfHrkC(String hrkC) {
        QCcodem q = QCcodem.ccodem;
        return queryFactory.selectFrom(q)
                .where(q.hrkC.eq(hrkC), q.delYn.eq("N"))
                .orderBy(q.cSqn.asc().nullsLast(), q.cId.asc(), q.cdva.asc())
                .fetch();
    }

    @Override
    public List<Ccodem> findAllActive() {
        QCcodem q = QCcodem.ccodem;
        return queryFactory.selectFrom(q)
                .where(q.delYn.eq("N"))
                .orderBy(q.cSqn.asc().nullsLast(), q.cId.asc(), q.cdva.asc())
                .fetch();
    }

    private BooleanExpression isValidDate(QCcodem q, LocalDate eff) {
        BooleanExpression afterStart = q.sttDt.isNull().or(q.sttDt.loe(eff));
        BooleanExpression beforeEnd  = q.endDt.isNull().or(q.endDt.goe(eff));
        return afterStart.and(beforeEnd);
    }
}
```

- [ ] **Step 2: 백엔드 부분 빌드**

Run: `cd it_backend && ./gradlew compileJava`
Expected: 엔티티/리포지토리 컴파일 통과. Service/Test는 여전히 실패 (Phase C에서 해소).

- [ ] **Step 3: Phase B 통합 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/code/entity/CcodemId.java \
        it_backend/src/main/java/com/kdb/it/common/code/entity/Ccodem.java \
        it_backend/src/main/java/com/kdb/it/domain/log/entity/CcodemL.java \
        it_backend/src/main/java/com/kdb/it/common/code/repository/
git commit -m "feat(backend): CCODEM 엔티티/리포지토리를 신규 PK(C_ID,CDVA,STT_DT) 체계로 전환"
```

---

## Phase C — 백엔드 서비스/DTO/컨트롤러

### Task 10: `CodeDto` 신규 필드 셋으로 재정의

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/dto/CodeDto.java`

- [ ] **Step 1: 전체 파일 교체**

```java
package com.kdb.it.common.code.dto;

import com.kdb.it.common.code.entity.Ccodem;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class CodeDto {

    @Getter @Setter @NoArgsConstructor
    @Schema(name = "CodeDto.CreateRequest", description = "공통코드 생성 요청")
    public static class CreateRequest {
        @Schema(description = "코드ID",  example = "PRJ_TP") private String cId;
        @Schema(description = "코드값",  example = "001")    private String cdva;
        @Schema(description = "코드명",  example = "신규개발") private String cNm;
        @Schema(description = "코드설명", example = "사업유형") private String cDes;
        @Schema(description = "코드값상세", example = "USD")   private String cdvaDtl;
        @Schema(description = "코드타입")                     private String cTp;
        @Schema(description = "코드타입설명")                 private String cTpDes;
        @Schema(description = "상위코드", example = "TRVL_001") private String hrkC;
        @Schema(description = "코드순서", example = "1")      private Integer cSqn;
        @Schema(description = "시작일자", example = "2026-01-01") private LocalDate sttDt;
        @Schema(description = "종료일자", example = "2099-12-31") private LocalDate endDt;

        public Ccodem toEntity() {
            return Ccodem.builder()
                    .cId(cId).cdva(cdva).sttDt(sttDt).endDt(endDt)
                    .cNm(cNm).cDes(cDes).cdvaDtl(cdvaDtl)
                    .cTp(cTp).cTpDes(cTpDes).hrkC(hrkC).cSqn(cSqn)
                    .build();
        }
    }

    @Getter @Setter @NoArgsConstructor
    @Schema(name = "CodeDto.UpdateRequest", description = "공통코드 수정 요청")
    public static class UpdateRequest {
        @Schema(description = "코드명")     private String cNm;
        @Schema(description = "코드설명")   private String cDes;
        @Schema(description = "코드값상세") private String cdvaDtl;
        @Schema(description = "코드타입")   private String cTp;
        @Schema(description = "코드타입설명") private String cTpDes;
        @Schema(description = "상위코드")   private String hrkC;
        @Schema(description = "코드순서")   private Integer cSqn;
        @Schema(description = "종료일자")   private LocalDate endDt;
    }

    @Getter @Setter @Builder
    @Schema(name = "CodeDto.Response", description = "공통코드 조회 응답")
    public static class Response {
        @Schema(description = "코드ID")     private String cId;
        @Schema(description = "코드값")     private String cdva;
        @Schema(description = "코드명")     private String cNm;
        @Schema(description = "코드설명")   private String cDes;
        @Schema(description = "코드값상세") private String cdvaDtl;
        @Schema(description = "코드타입")   private String cTp;
        @Schema(description = "코드타입설명") private String cTpDes;
        @Schema(description = "상위코드")   private String hrkC;
        @Schema(description = "코드순서")   private Integer cSqn;
        @Schema(description = "시작일자")   private LocalDate sttDt;
        @Schema(description = "종료일자")   private LocalDate endDt;
        @Schema(description = "삭제여부")   private String delYn;
        @Schema(description = "최초생성시간") private LocalDateTime fstEnrDtm;
        @Schema(description = "최초생성자")   private String fstEnrUsid;
        @Schema(description = "마지막수정시간") private LocalDateTime lstChgDtm;
        @Schema(description = "마지막수정자")   private String lstChgUsid;

        public static Response fromEntity(Ccodem c) {
            if (c == null) return null;
            return Response.builder()
                    .cId(c.getCId()).cdva(c.getCdva()).sttDt(c.getSttDt()).endDt(c.getEndDt())
                    .cNm(c.getCNm()).cDes(c.getCDes()).cdvaDtl(c.getCdvaDtl())
                    .cTp(c.getCTp()).cTpDes(c.getCTpDes()).hrkC(c.getHrkC())
                    .cSqn(c.getCSqn())
                    .delYn(c.getDelYn())
                    .fstEnrDtm(c.getFstEnrDtm()).fstEnrUsid(c.getFstEnrUsid())
                    .lstChgDtm(c.getLstChgDtm()).lstChgUsid(c.getLstChgUsid())
                    .build();
        }
    }

    @Getter @Builder
    @Schema(name = "CodeDto.BudgetPeriodResponse", description = "예산 신청 기간 응답")
    public static class BudgetPeriodResponse {
        @Schema(description = "예산 신청기간 시작일자", example = "2026-04-15") private String startDate;
        @Schema(description = "예산 신청기간 종료일자", example = "2026-12-31") private String endDate;
    }
}
```

---

### Task 11: `CodeService` 갱신 (캐시 키 변경 포함)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/service/CodeService.java`

- [ ] **Step 1: 전체 파일 교체**

```java
package com.kdb.it.common.code.service;

import com.kdb.it.common.code.dto.CodeDto;
import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CodeRepository;
import com.kdb.it.exception.CustomGeneralException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 공통코드(Ccodem) 서비스. 신규 PK: (C_ID, CDVA, STT_DT)
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CodeService {

    private final CodeRepository codeRepository;

    public CodeDto.Response getCcodem(String cId, String cdva, LocalDate targetDate) {
        Ccodem c = codeRepository.findByCIdAndCdvaWithValidDate(cId, cdva, targetDate)
                .orElseThrow(() -> new IllegalArgumentException(
                        "유효하지 않거나 존재하지 않는 코드: " + cId + "/" + cdva));
        return CodeDto.Response.fromEntity(c);
    }

    public List<CodeDto.Response> getCcodemsByCId(String cId, LocalDate targetDate) {
        return codeRepository.findByCIdWithValidDate(cId, targetDate).stream()
                .map(CodeDto.Response::fromEntity)
                .collect(Collectors.toList());
    }

    @Cacheable(value = "codesByCid", key = "#p0")
    public List<Ccodem> findCodeEntitiesByCId(String cId) {
        return codeRepository.findByCIdWithValidDate(cId, null);
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "budgetPeriod", allEntries = true),
            @CacheEvict(value = "codesByCid",   allEntries = true)
    })
    public String createCcodem(CodeDto.CreateRequest req) {
        if (req.getSttDt() == null) {
            throw new IllegalArgumentException("시작일자는 필수입니다.");
        }
        if (codeRepository.existsByCIdAndCdvaAndSttDt(req.getCId(), req.getCdva(), req.getSttDt())) {
            throw new IllegalArgumentException(
                    "이미 존재하는 (코드ID,코드값,시작일자): "
                            + req.getCId() + "/" + req.getCdva() + "/" + req.getSttDt());
        }
        Ccodem c = req.toEntity();
        codeRepository.save(c);
        return c.getCId() + "/" + c.getCdva();
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "budgetPeriod", allEntries = true),
            @CacheEvict(value = "codesByCid",   allEntries = true)
    })
    public String updateCcodem(String cId, String cdva, LocalDate sttDt, CodeDto.UpdateRequest req) {
        Ccodem c = codeRepository.findByCIdAndCdvaAndSttDtAndDelYn(cId, cdva, sttDt, "N")
                .orElseThrow(() -> new IllegalArgumentException(
                        "수정할 공통코드를 찾을 수 없습니다: " + cId + "/" + cdva + "/" + sttDt));
        c.update(req.getCNm(), req.getCDes(), req.getCdvaDtl(),
                 req.getCTp(), req.getCTpDes(), req.getHrkC(),
                 req.getCSqn(), req.getEndDt());
        return cId + "/" + cdva;
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "budgetPeriod", allEntries = true),
            @CacheEvict(value = "codesByCid",   allEntries = true)
    })
    public void deleteCcodem(String cId, String cdva, LocalDate sttDt) {
        Ccodem c = codeRepository.findByCIdAndCdvaAndSttDtAndDelYn(cId, cdva, sttDt, "N")
                .orElseThrow(() -> new IllegalArgumentException(
                        "삭제할 공통코드를 찾을 수 없거나 이미 삭제되었습니다: "
                                + cId + "/" + cdva + "/" + sttDt));
        c.delete();
    }

    @Cacheable("budgetPeriod")
    public CodeDto.BudgetPeriodResponse getBudgetPeriod() {
        Ccodem sta = codeRepository.findByCIdAndCdvaWithValidDate("BG_RQS", "STA", null)
                .orElseThrow(() -> new IllegalArgumentException("예산 신청기간 시작 코드 없음: BG_RQS/STA"));
        Ccodem end = codeRepository.findByCIdAndCdvaWithValidDate("BG_RQS", "END", null)
                .orElseThrow(() -> new IllegalArgumentException("예산 신청기간 종료 코드 없음: BG_RQS/END"));
        return CodeDto.BudgetPeriodResponse.builder()
                .startDate(sta.getCNm())
                .endDate(end.getCNm())
                .build();
    }

    public void validateBudgetPeriod() {
        CodeDto.BudgetPeriodResponse p = getBudgetPeriod();
        String today = LocalDate.now().toString();
        if (today.compareTo(p.getStartDate()) < 0 || today.compareTo(p.getEndDate()) > 0) {
            throw new CustomGeneralException(
                    "예산 신청 기간이 아닙니다. (" + p.getStartDate() + " ~ " + p.getEndDate() + ")");
        }
    }
}
```

---

### Task 12: `CodeController` 엔드포인트 갱신

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/controller/CodeController.java`

- [ ] **Step 1: 전체 파일 교체**

```java
package com.kdb.it.common.code.controller;

import com.kdb.it.common.code.dto.CodeDto;
import com.kdb.it.common.code.service.CodeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/ccodem")
@RequiredArgsConstructor
@Tag(name = "Code", description = "공통코드(Ccodem) API")
public class CodeController {

    private final CodeService codeService;

    @GetMapping("/budget-period")
    @Operation(summary = "예산 신청 기간 조회")
    public ResponseEntity<CodeDto.BudgetPeriodResponse> getBudgetPeriod() {
        return ResponseEntity.ok(codeService.getBudgetPeriod());
    }

    @GetMapping("/{cId}")
    @Operation(summary = "C_ID(카테고리) 다건 조회")
    public ResponseEntity<List<CodeDto.Response>> getByCId(
            @PathVariable("cId") String cId,
            @Parameter(description = "기준일자")
            @RequestParam(value = "targetDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate targetDate) {
        return ResponseEntity.ok(codeService.getCcodemsByCId(cId, targetDate));
    }

    @GetMapping("/{cId}/{cdva}")
    @Operation(summary = "(C_ID, CDVA) 단건 조회")
    public ResponseEntity<CodeDto.Response> getOne(
            @PathVariable("cId") String cId,
            @PathVariable("cdva") String cdva,
            @RequestParam(value = "targetDate", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate targetDate) {
        return ResponseEntity.ok(codeService.getCcodem(cId, cdva, targetDate));
    }

    @PostMapping
    @Operation(summary = "공통코드 신규 생성")
    public ResponseEntity<String> create(@RequestBody CodeDto.CreateRequest request) {
        String created = codeService.createCcodem(request);
        return ResponseEntity.created(URI.create("/api/ccodem/" + created)).body(created);
    }

    @PutMapping("/{cId}/{cdva}")
    @Operation(summary = "공통코드 수정")
    public ResponseEntity<String> update(
            @PathVariable("cId") String cId,
            @PathVariable("cdva") String cdva,
            @RequestParam("sttDt") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate sttDt,
            @RequestBody CodeDto.UpdateRequest request) {
        return ResponseEntity.ok(codeService.updateCcodem(cId, cdva, sttDt, request));
    }

    @DeleteMapping("/{cId}/{cdva}")
    @Operation(summary = "공통코드 삭제(Soft)")
    public ResponseEntity<Void> delete(
            @PathVariable("cId") String cId,
            @PathVariable("cdva") String cdva,
            @RequestParam("sttDt") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate sttDt) {
        codeService.deleteCcodem(cId, cdva, sttDt);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 2: 컴파일**

Run: `cd it_backend && ./gradlew compileJava`
Expected: `CodeServiceTest`만 남은 컴파일 실패. 본체 모두 통과.

---

### Task 13: `CodeServiceTest` 갱신

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/common/code/service/CodeServiceTest.java`

- [ ] **Step 1: 헬퍼 + 단건 조회 테스트 교체**

```java
private Ccodem mockCcodem(String cId, String cdva) {
    Ccodem c = mock(Ccodem.class);
    given(c.getCId()).willReturn(cId);
    given(c.getCdva()).willReturn(cdva);
    given(c.getCNm()).willReturn(cdva + "_NM");
    given(c.getSttDt()).willReturn(LocalDate.of(2026, 1, 1));
    return c;
}

@Test
void getCcodem_유효키_Response반환() {
    Ccodem c = mockCcodem("PRJ_TP", "001");
    given(codeRepository.findByCIdAndCdvaWithValidDate(eq("PRJ_TP"), eq("001"), any()))
            .willReturn(Optional.of(c));

    CodeDto.Response r = codeService.getCcodem("PRJ_TP", "001", null);

    assertThat(r.getCId()).isEqualTo("PRJ_TP");
    assertThat(r.getCdva()).isEqualTo("001");
}
```

- [ ] **Step 2: 카테고리 다건 테스트 교체**

```java
@Test
void getCcodemsByCId_카테고리_DTO목록반환() {
    Ccodem c1 = mockCcodem("PRJ_TP", "001");
    Ccodem c2 = mockCcodem("PRJ_TP", "002");
    given(codeRepository.findByCIdWithValidDate(eq("PRJ_TP"), any()))
            .willReturn(List.of(c1, c2));

    List<CodeDto.Response> r = codeService.getCcodemsByCId("PRJ_TP", null);

    assertThat(r).hasSize(2);
    assertThat(r).extracting(CodeDto.Response::getCdva).containsExactly("001", "002");
}
```

- [ ] **Step 3: create / update / delete / budgetPeriod 테스트 교체**

```java
@Test
void getBudgetPeriod_BG_RQS_조회_시작종료반환() {
    Ccodem sta = mock(Ccodem.class); given(sta.getCNm()).willReturn("2026-04-15");
    Ccodem end = mock(Ccodem.class); given(end.getCNm()).willReturn("2026-12-31");
    given(codeRepository.findByCIdAndCdvaWithValidDate("BG_RQS","STA",null)).willReturn(Optional.of(sta));
    given(codeRepository.findByCIdAndCdvaWithValidDate("BG_RQS","END",null)).willReturn(Optional.of(end));

    CodeDto.BudgetPeriodResponse r = codeService.getBudgetPeriod();

    assertThat(r.getStartDate()).isEqualTo("2026-04-15");
    assertThat(r.getEndDate()).isEqualTo("2026-12-31");
}

@Test
void createCcodem_중복키_IllegalArgumentException() {
    CodeDto.CreateRequest req = new CodeDto.CreateRequest();
    req.setCId("PRJ_TP"); req.setCdva("001"); req.setSttDt(LocalDate.of(2026,1,1));
    given(codeRepository.existsByCIdAndCdvaAndSttDt("PRJ_TP","001",LocalDate.of(2026,1,1)))
            .willReturn(true);

    assertThatThrownBy(() -> codeService.createCcodem(req))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("이미 존재");
}

@Test
void updateCcodem_존재하는키_update호출() {
    LocalDate sttDt = LocalDate.of(2026, 1, 1);
    Ccodem c = mockCcodem("PRJ_TP", "001");
    given(codeRepository.findByCIdAndCdvaAndSttDtAndDelYn("PRJ_TP","001",sttDt,"N"))
            .willReturn(Optional.of(c));
    CodeDto.UpdateRequest req = new CodeDto.UpdateRequest();
    req.setCNm("수정명");

    String r = codeService.updateCcodem("PRJ_TP","001", sttDt, req);

    assertThat(r).isEqualTo("PRJ_TP/001");
    verify(c).update(eq("수정명"), any(), any(), any(), any(), any(), any(), any());
}

@Test
void deleteCcodem_존재하는키_delete호출() {
    LocalDate sttDt = LocalDate.of(2026, 1, 1);
    Ccodem c = mockCcodem("PRJ_TP", "001");
    given(codeRepository.findByCIdAndCdvaAndSttDtAndDelYn("PRJ_TP","001",sttDt,"N"))
            .willReturn(Optional.of(c));

    codeService.deleteCcodem("PRJ_TP","001", sttDt);

    verify(c).delete();
}
```

- [ ] **Step 4: 테스트 실행**

Run: `cd it_backend && ./gradlew test --tests CodeServiceTest`
Expected: 모든 테스트 PASS

- [ ] **Step 5: Phase C 통합 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/code/dto/CodeDto.java \
        it_backend/src/main/java/com/kdb/it/common/code/service/CodeService.java \
        it_backend/src/main/java/com/kdb/it/common/code/controller/CodeController.java \
        it_backend/src/test/java/com/kdb/it/common/code/service/CodeServiceTest.java
git commit -m "feat(backend): CodeService/Controller/DTO를 (cId,cdva) 복합 식별 체계로 전환"
```

---

### Task 14: 관리자 코드 CRUD(`AdminService`/`AdminController`) 갱신

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/controller/AdminController.java`
- Modify: 해당 테스트(있다면)

- [ ] **Step 1: 현행 시그니처 확인**

Run: `grep -nE "createCode|updateCode|deleteCode|bulkUpsert" it_backend/src/main/java/com/kdb/it/common/admin/`
Expected: 옛 `(String cdId, ...)` 시그니처가 노출됨

- [ ] **Step 2: 시그니처를 (cId, cdva, sttDt)로 교체**

`AdminService` 메서드:
```java
public String updateCode(String cId, String cdva, LocalDate sttDt, CodeDto.UpdateRequest req) {
    return codeService.updateCcodem(cId, cdva, sttDt, req);
}

public void deleteCode(String cId, String cdva, LocalDate sttDt) {
    codeService.deleteCcodem(cId, cdva, sttDt);
}
```

`AdminController` 라우트:
```java
@PutMapping("/codes/{cId}/{cdva}")
public ResponseEntity<String> updateCode(
        @PathVariable String cId,
        @PathVariable String cdva,
        @RequestParam("sttDt") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate sttDt,
        @RequestBody CodeDto.UpdateRequest req) {
    return ResponseEntity.ok(adminService.updateCode(cId, cdva, sttDt, req));
}

@DeleteMapping("/codes/{cId}/{cdva}")
public ResponseEntity<Void> deleteCode(
        @PathVariable String cId,
        @PathVariable String cdva,
        @RequestParam("sttDt") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate sttDt) {
    adminService.deleteCode(cId, cdva, sttDt);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 3: bulkUpsert 처리**

```java
public void bulkUpsertCodes(List<CodeDto.CreateRequest> rows) {
    for (CodeDto.CreateRequest r : rows) {
        boolean exists = codeRepository.existsByCIdAndCdvaAndSttDt(r.getCId(), r.getCdva(), r.getSttDt());
        if (exists) {
            CodeDto.UpdateRequest upd = new CodeDto.UpdateRequest();
            upd.setCNm(r.getCNm()); upd.setCDes(r.getCDes());
            upd.setCdvaDtl(r.getCdvaDtl()); upd.setCTp(r.getCTp());
            upd.setCTpDes(r.getCTpDes()); upd.setHrkC(r.getHrkC());
            upd.setCSqn(r.getCSqn()); upd.setEndDt(r.getEndDt());
            codeService.updateCcodem(r.getCId(), r.getCdva(), r.getSttDt(), upd);
        } else {
            codeService.createCcodem(r);
        }
    }
}
```

- [ ] **Step 4: 백엔드 전체 빌드/테스트**

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/admin/
git commit -m "feat(backend): 관리자 공통코드 CRUD를 (cId,cdva,sttDt) 식별로 전환"
```

---

## Phase D — 프론트엔드 공통 코드

### Task 15: `useCodeOptions` 시그니처/반환 키 재정의

**Files:**
- Modify: `it_frontend/app/composables/useCodeOptions.ts`

- [ ] **Step 1: 파일 교체**

```ts
/**
 * 공통코드(CCODEM) API에서 카테고리(C_ID) 단위로 코드 옵션을 조회.
 * 사용 예:
 *   const { options, getCodeName } = useCodeOptions('PRJ_TP');
 *   options.value[0]  // { cId:'PRJ_TP', cdva:'001', cNm:'신규개발', ... }
 *   getCodeName('001') // '신규개발'
 */
export interface CodeOption {
    cId: string;
    cdva: string;
    cNm: string;
    cDes?: string | null;
    cdvaDtl?: string | null;
    cTp?: string | null;
    cTpDes?: string | null;
    hrkC?: string | null;
    cSqn?: number | null;
}

export const useCodeOptions = (cId: string) => {
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/ccodem/${cId}`;
    const { data } = useApiFetch<CodeOption[]>(url);

    const options = computed(() =>
        [...(data.value || [])]
            .sort((a, b) => (a.cSqn ?? Infinity) - (b.cSqn ?? Infinity))
            .map(c => ({
                cId: c.cId,
                cdva: c.cdva,
                cNm: c.cNm,
                cDes: c.cDes ?? null,
                cdvaDtl: c.cdvaDtl ?? null,
                cTp: c.cTp ?? null,
                cTpDes: c.cTpDes ?? null,
                hrkC: c.hrkC ?? null,
                cSqn: c.cSqn ?? null,
            }))
    );

    /** 코드값(CDVA) → 코드명(C_NM) 변환. 미매칭 시 원본 반환. */
    const getCodeName = (cdva: string | null | undefined): string => {
        if (!cdva) return '-';
        const found = options.value.find(o => o.cdva === cdva);
        return found ? found.cNm : cdva;
    };

    return { options, getCodeName };
};
```

- [ ] **Step 2: 타입 체크 (의도적 부분 실패)**

Run: `cd it_frontend && npx nuxt typecheck`
Expected: 호출부 다수에서 옛 `cdId` 참조 오류 (Phase E에서 해소)

---

### Task 16: `useCodeOptions` 테스트 갱신

**Files:**
- Modify: `it_frontend/tests/unit/composables/useCodeOptions.test.ts`

- [ ] **Step 1: mock 데이터/단언 교체**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useCodeOptions } from '~/composables/useCodeOptions';

vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:8080' }
}));
vi.stubGlobal('computed', computed);

const mockCodeData = ref<{ cId: string; cdva: string; cNm: string; cSqn?: number | null }[] | null>(null);
const mockUseApiFetch = vi.fn().mockImplementation(() => ({ data: mockCodeData }));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

describe('useCodeOptions', () => {
    beforeEach(() => {
        mockCodeData.value = null;
        vi.clearAllMocks();
        mockUseApiFetch.mockImplementation(() => ({ data: mockCodeData }));
    });

    describe('options', () => {
        it('데이터가 없으면 빈 배열', () => {
            mockCodeData.value = null;
            expect(useCodeOptions('PRJ_TP').options.value).toEqual([]);
        });

        it('cSqn 오름차순 정렬', () => {
            mockCodeData.value = [
                { cId:'PRJ_TP', cdva:'003', cNm:'기타',    cSqn:3 },
                { cId:'PRJ_TP', cdva:'001', cNm:'신규개발', cSqn:1 },
                { cId:'PRJ_TP', cdva:'002', cNm:'유지보수', cSqn:2 },
            ];
            const { options } = useCodeOptions('PRJ_TP');
            expect(options.value.map(o => o.cNm)).toEqual(['신규개발','유지보수','기타']);
        });

        it('cSqn null은 마지막', () => {
            mockCodeData.value = [
                { cId:'PRJ_TP', cdva:'NIL', cNm:'순서없음', cSqn:null },
                { cId:'PRJ_TP', cdva:'001', cNm:'신규개발', cSqn:1 },
            ];
            const { options } = useCodeOptions('PRJ_TP');
            expect(options.value.map(o => o.cNm)).toEqual(['신규개발','순서없음']);
        });
    });

    describe('getCodeName', () => {
        beforeEach(() => {
            mockCodeData.value = [
                { cId:'PRJ_TP', cdva:'001', cNm:'신규개발', cSqn:1 },
                { cId:'PRJ_TP', cdva:'002', cNm:'유지보수', cSqn:2 },
            ];
        });

        it('매칭되는 cdva → cNm', () => {
            expect(useCodeOptions('PRJ_TP').getCodeName('001')).toBe('신규개발');
        });
        it('미매칭 → 원본', () => {
            expect(useCodeOptions('PRJ_TP').getCodeName('UNKNOWN')).toBe('UNKNOWN');
        });
        it('null → "-"',      () => { expect(useCodeOptions('PRJ_TP').getCodeName(null)).toBe('-'); });
        it('undefined → "-"', () => { expect(useCodeOptions('PRJ_TP').getCodeName(undefined)).toBe('-'); });
        it('빈 문자열 → "-"', () => { expect(useCodeOptions('PRJ_TP').getCodeName('')).toBe('-'); });
    });

    it('URL은 /api/ccodem/{cId} 형식', () => {
        useCodeOptions('PRJ_TP');
        expect(mockUseApiFetch).toHaveBeenCalledWith('http://localhost:8080/api/ccodem/PRJ_TP');
    });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `cd it_frontend && npx vitest run tests/unit/composables/useCodeOptions.test.ts`
Expected: 모든 테스트 PASS

- [ ] **Step 3: Phase D 부분 커밋**

```bash
git add it_frontend/app/composables/useCodeOptions.ts \
        it_frontend/tests/unit/composables/useCodeOptions.test.ts
git commit -m "feat(frontend): useCodeOptions를 cId/cdva 분리 응답으로 전환"
```

---

### Task 17: `useAdminApi` 코드 CRUD 타입/엔드포인트 갱신

**Files:**
- Modify: `it_frontend/app/composables/useAdminApi.ts`
- Modify: `it_frontend/tests/unit/composables/useAdminApi.test.ts`

- [ ] **Step 1: 타입 정의 교체**

```ts
export interface AdminCodeResponse {
    cId: string;
    cdva: string;
    cNm?: string | null;
    cDes?: string | null;
    cdvaDtl?: string | null;
    cTp?: string | null;
    cTpDes?: string | null;
    hrkC?: string | null;
    cSqn?: number | null;
    sttDt?: string | null;
    endDt?: string | null;
    delYn?: string | null;
    fstEnrDtm?: string | null;
    fstEnrUsid?: string | null;
    lstChgDtm?: string | null;
    lstChgUsid?: string | null;
}

export interface AdminCodeRequest {
    cId: string;
    cdva: string;
    cNm?: string;
    cDes?: string;
    cdvaDtl?: string;
    cTp?: string;
    cTpDes?: string;
    hrkC?: string;
    cSqn?: number;
    sttDt?: string;
    endDt?: string;
}
```

- [ ] **Step 2: 메서드 시그니처 교체**

```ts
async function updateCode(cId: string, cdva: string, sttDt: string, payload: AdminCodeRequest) {
    return $apiFetch(`/api/admin/codes/${cId}/${cdva}?sttDt=${sttDt}`, {
        method: 'PUT',
        body: payload,
    });
}

async function deleteCode(cId: string, cdva: string, sttDt: string) {
    return $apiFetch(`/api/admin/codes/${cId}/${cdva}?sttDt=${sttDt}`, { method: 'DELETE' });
}

async function createCode(payload: AdminCodeRequest) {
    return $apiFetch('/api/admin/codes', { method: 'POST', body: payload });
}

async function bulkUpsertCodes(rows: AdminCodeRequest[]) {
    return $apiFetch('/api/admin/codes/bulk', { method: 'POST', body: rows });
}
```

- [ ] **Step 3: 테스트 갱신**

`tests/unit/composables/useAdminApi.test.ts`에서 옛 `updateCode('CD001', …)` / `deleteCode('CD001', '2026-01-01')` 호출을 새 시그니처 `(cId, cdva, sttDt, …)`로 교체.

- [ ] **Step 4: 테스트 실행**

Run: `cd it_frontend && npx vitest run tests/unit/composables/useAdminApi.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add it_frontend/app/composables/useAdminApi.ts \
        it_frontend/tests/unit/composables/useAdminApi.test.ts
git commit -m "feat(frontend): useAdminApi 코드 CRUD를 (cId,cdva,sttDt) 식별로 전환"
```

---

## Phase E — 프론트엔드 호출부 일괄 교체

> 공통 규칙:
> 1. 옵션을 폼/배열에 박을 때 `opts[i].cdId` → `opts[i].cdva`
> 2. 옵션 비교 `o.cdId === val` → `o.cdva === val`
> 3. `getCodeName(...)` 인자는 그대로 (DB 컬럼 값이 `'001'`로 정제됐기 때문에 동일하게 동작)

### Task 18: 사업 등록/상세 화면

**Files:**
- Modify: `it_frontend/app/pages/info/projects/form.vue`
- Modify: `it_frontend/app/pages/info/projects/[id].vue`

- [ ] **Step 1: `form.vue` 옵션 사용처 교체**

옛 코드:
```ts
form.value.pulDtt = opts[0]!.cdId;
restoreCodeField(form.value.bzDtt, bzDttOptions.value, selectedBzDtt, customBzDtt);
```
신규:
```ts
form.value.pulDtt = opts[0]!.cdva;
// restoreCodeField 내부의 opt.cdId === val 비교를 opt.cdva === val로 교체
```

`restoreCodeField` 헬퍼가 별도 함수면 그 함수 내부도 동일 패치 필요. 동일 파일에 인라인이면 본 step에서 같이 교체.

- [ ] **Step 2: `[id].vue` 옵션 참조 점검**

`getXxxName(project.xxx)` 호출은 그대로. `opt.cdId` 직접 참조가 있으면 `cdva`로 교체.

- [ ] **Step 3: 수동 동작 확인**

Run: `cd it_frontend && npm run dev`
브라우저에서 `/info/projects/form`, `/info/projects/<id>` 진입 → 드롭다운 선택 + 저장 정상.

- [ ] **Step 4: Commit**

```bash
git add it_frontend/app/pages/info/projects/form.vue \
        it_frontend/app/pages/info/projects/\[id\].vue
git commit -m "refactor(frontend): 사업 폼/상세의 코드 옵션 참조를 cdva 기준으로 전환"
```

---

### Task 19: 전산업무비/품목 화면

**Files:**
- Modify: `it_frontend/app/pages/info/cost/form.vue`
- Modify: `it_frontend/app/pages/info/cost/index.vue`
- Modify: `it_frontend/app/components/cost/TerminalTableSection.vue`
- Modify: `it_frontend/app/components/cost/TerminalFormDialog.vue`
- Modify: `it_frontend/app/components/cost/CostFormTableSection.vue`
- Modify: `it_frontend/app/composables/useCostListPage.ts`
- Modify: `it_frontend/app/composables/useBudgetStatusCostTab.ts`
- Modify: `it_frontend/tests/unit/composables/useCostListPage.test.ts`
- Modify: `it_frontend/tests/unit/composables/useBudgetStatusCostTab.test.ts`

- [ ] **Step 1: 각 파일에서 `cdId` → `cdva` 치환**

각 파일을 열어 다음 패턴 일괄 치환:
- `opt.cdId` → `opt.cdva`
- `option.cdId` → `option.cdva`
- `o.cdId` → `o.cdva`
- `opts[0].cdId` → `opts[0].cdva`

- [ ] **Step 2: 테스트 mock을 신규 키로 갱신**

`useCostListPage.test.ts`, `useBudgetStatusCostTab.test.ts`의 mock 응답을 `{ cdId, cdNm }` 형식에서 `{ cId, cdva, cNm }` 형식으로 갱신.

- [ ] **Step 3: 단위 테스트 실행**

Run: `cd it_frontend && npx vitest run tests/unit/composables/useCostListPage.test.ts tests/unit/composables/useBudgetStatusCostTab.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add it_frontend/app/pages/info/cost/ \
        it_frontend/app/components/cost/ \
        it_frontend/app/composables/useCostListPage.ts \
        it_frontend/app/composables/useBudgetStatusCostTab.ts \
        it_frontend/tests/unit/composables/useCostListPage.test.ts \
        it_frontend/tests/unit/composables/useBudgetStatusCostTab.test.ts
git commit -m "refactor(frontend): 전산업무비/품목 화면을 cdva 기준으로 전환"
```

---

### Task 20: 협의회/환율/계획

**Files:**
- Modify: `it_frontend/app/composables/useCouncilCodes.ts`
- Modify: `it_frontend/app/composables/useCurrencyRates.ts`
- Modify: `it_frontend/tests/unit/composables/useCouncilCodes.test.ts`
- Modify: `it_frontend/tests/unit/composables/useCurrencyRates.test.ts`
- Modify: `it_frontend/app/components/plan/PlanExpenseCostCard.vue`

- [ ] **Step 1: composable 본체 `cdId` → `cdva` 치환**

각 파일에서 `option.cdId`, `o.cdId === val` 패턴 일괄 치환.

- [ ] **Step 2: 환율(`useCurrencyRates`) 매핑 보정**

옛 데이터의 환율(1400)은 신규에서 `cNm`, 통화 약어(USD)는 `cdvaDtl`. composable이 환율을 구성할 때 다음 패턴으로 변경:

```ts
const rates = computed(() =>
    options.value.reduce<Record<string, number>>((acc, o) => {
        const code = o.cdvaDtl ?? o.cdva;     // 'USD' 우선, 없으면 '001'
        const rate = Number(o.cNm);            // 숫자 환율
        if (code && !Number.isNaN(rate)) acc[code] = rate;
        return acc;
    }, {})
);
```

- [ ] **Step 3: 환율 테스트 갱신**

```ts
mockCodeData.value = [
    { cId:'CUR', cdva:'001', cNm:'1400', cdvaDtl:'USD' },
    { cId:'CUR', cdva:'002', cNm:'1200', cdvaDtl:'JPY' },
];
// 단언:
expect(rates.value['USD']).toBe(1400);
expect(rates.value['JPY']).toBe(1200);
```

- [ ] **Step 4: 단위 테스트 실행**

Run: `cd it_frontend && npx vitest run tests/unit/composables/useCouncilCodes.test.ts tests/unit/composables/useCurrencyRates.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add it_frontend/app/composables/useCouncilCodes.ts \
        it_frontend/app/composables/useCurrencyRates.ts \
        it_frontend/tests/unit/composables/useCouncilCodes.test.ts \
        it_frontend/tests/unit/composables/useCurrencyRates.test.ts \
        it_frontend/app/components/plan/PlanExpenseCostCard.vue
git commit -m "refactor(frontend): 협의회/환율 코드 매핑을 cdva+cdvaDtl 기준으로 전환"
```

---

### Task 21: 예산 작업/현황/요약 화면

**Files:**
- Modify: `it_frontend/app/pages/budget/work.vue`
- Modify: `it_frontend/app/components/budget/BudgetSummaryCards.vue`
- Modify: `it_frontend/app/types/budget-work.ts`

- [ ] **Step 1: 옵션 참조 `cdId` → `cdva` 치환**

`budget/work.vue`의 폼 초기화/비교 로직, `BudgetSummaryCards.vue`의 코드명 변환부, `types/budget-work.ts`의 옛 키 정의를 신규 셋으로 교체.

- [ ] **Step 2: 타입 체크**

Run: `cd it_frontend && npx nuxt typecheck`
Expected: 본 태스크 범위 파일에서 타입 오류 없음

- [ ] **Step 3: Commit**

```bash
git add it_frontend/app/pages/budget/work.vue \
        it_frontend/app/components/budget/BudgetSummaryCards.vue \
        it_frontend/app/types/budget-work.ts
git commit -m "refactor(frontend): 예산 작업/현황 화면을 cdva 기준으로 전환"
```

---

### Task 22: 잔여 호출부 일제 스캔 + 마무리

- [ ] **Step 1: 옛 키 잔존 검출**

Run: `grep -rn "\.cdId\b" C:/it/it_frontend/app C:/it/it_frontend/tests`
Expected: 0건 (있으면 모두 패치)

- [ ] **Step 2: 검출된 위치 일괄 패치**

남은 컴포넌트(예: `SearchSelect`, `Drawer`, `tests` mock 등)에서 `cdId` 참조를 모두 `cdva`로 또는 적합한 신규 키로 교체.

- [ ] **Step 3: 빌드/타입체크/단위테스트 전체 실행**

Run: `cd it_frontend && npx nuxt typecheck && npx eslint . && npx vitest run`
Expected: 모두 PASS

- [ ] **Step 4: Commit (있다면)**

```bash
git add -A
git commit -m "refactor(frontend): 잔존 cdId 참조 정리"
```

---

## Phase F — 관리자 화면 + E2E

### Task 23: `pages/admin/codes.vue` 관리자 화면 개편

**Files:**
- Modify: `it_frontend/app/pages/admin/codes.vue`

- [ ] **Step 1: 그리드 컬럼 분할/추가**

기존 단일 `cdId` 컬럼을 `cId`, `cdva` 두 컬럼으로 분할. 추가 컬럼: `cdvaDtl`, `cTp`, `cTpDes`, `hrkC`.

```vue
<Column field="cId"      header="코드ID"     :resizableColumn="true" />
<Column field="cdva"     header="코드값"     :resizableColumn="true" />
<Column field="cNm"      header="코드명"     :resizableColumn="true" />
<Column field="cDes"     header="코드설명"   :resizableColumn="true" />
<Column field="cdvaDtl"  header="코드값상세" :resizableColumn="true" />
<Column field="cTp"      header="코드타입"   :resizableColumn="true" />
<Column field="cTpDes"   header="코드타입설명" :resizableColumn="true" />
<Column field="hrkC"     header="상위코드"   :resizableColumn="true" />
<Column field="cSqn"     header="순서"       :resizableColumn="true" />
<Column field="sttDt"    header="시작일자"   :resizableColumn="true" />
<Column field="endDt"    header="종료일자"   :resizableColumn="true" />
```

- [ ] **Step 2: 저장/삭제 핸들러 갱신**

```ts
onBatchSave: async ({ modifiedRows, deletedRows }) => {
    await Promise.all([
        ...modifiedRows.map(r => updateCode(r.cId, r.cdva, r.sttDt ?? '', {
            cId: r.cId, cdva: r.cdva,
            cNm: r.cNm, cDes: r.cDes, cdvaDtl: r.cdvaDtl,
            cTp: r.cTp, cTpDes: r.cTpDes, hrkC: r.hrkC,
            cSqn: r.cSqn, sttDt: r.sttDt, endDt: r.endDt,
        })),
        ...deletedRows.map(r => deleteCode(r.cId, r.cdva, r.sttDt ?? '')),
    ]);
    await refresh();
    toast.add({ severity: 'success', summary: '저장 완료', life: 3000 });
},
```

- [ ] **Step 3: 행 추가 다이얼로그 필드 추가**

다이얼로그 폼에 `cId`, `cdva`, `cNm`, `cDes`, `cdvaDtl`, `cTp`, `cTpDes`, `hrkC`, `cSqn`, `sttDt`, `endDt` 모두 입력 필드 추가.

- [ ] **Step 4: 엑셀 헤더 갱신**

```ts
const HEADERS = ['cId','cdva','cNm','cDes','cdvaDtl','cTp','cTpDes','hrkC','cSqn','sttDt','endDt'];
```

- [ ] **Step 5: 수동 동작 확인**

Run: `cd it_frontend && npm run dev`
브라우저에서 `/admin/codes` 진입 → 행 수정/추가/삭제/엑셀 업로드 정상.

- [ ] **Step 6: Commit**

```bash
git add it_frontend/app/pages/admin/codes.vue
git commit -m "feat(frontend): 공통코드 관리 화면 컬럼/입력 필드를 신규 체계로 개편"
```

---

### Task 24: E2E 스모크 시나리오

**Files:**
- Create: `it_frontend/tests/e2e/common-code.spec.ts`

- [ ] **Step 1: 테스트 작성**

```ts
import { test, expect } from '@playwright/test';

test.describe('공통코드 체계 개선 — 스모크', () => {
    test.beforeEach(async ({ page }) => {
        // 관리자 계정으로 로그인 (프로젝트 표준 fixture 활용)
        await page.goto('/login');
        // ... 로그인 입력 (e2e fixture 호출)
    });

    test('관리자 공통코드 화면이 cId/cdva 컬럼으로 표시된다', async ({ page }) => {
        await page.goto('/admin/codes');
        await expect(page.getByRole('columnheader', { name: '코드ID' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: '코드값' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: '코드값상세' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: '상위코드' })).toBeVisible();
    });

    test('사업등록 폼의 PRJ_TP 드롭다운이 정상 로드된다', async ({ page }) => {
        await page.goto('/info/projects/form');
        const dropdown = page.getByLabel(/사업유형/);
        await dropdown.click();
        await expect(page.locator('.p-dropdown-items li').first()).toBeVisible();
    });

    test('예산현황 화면이 정상 진입한다', async ({ page }) => {
        await page.goto('/budget/status');
        await expect(page).toHaveURL(/budget\/status/);
    });
});
```

- [ ] **Step 2: 실행 (백엔드 + 마이그레이션된 dev DB 필요)**

Run: `cd it_frontend && npm run test:e2e -- common-code.spec.ts`
Expected: 모두 PASS

- [ ] **Step 3: Commit**

```bash
git add it_frontend/tests/e2e/common-code.spec.ts
git commit -m "test(frontend): 공통코드 신규 체계 E2E 스모크 추가"
```

---

## Phase G — 통합 검증 + 후속

### Task 25: 전 영역 통합 검증

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL

- [ ] **Step 2: 프론트 타입체크/린트/단위/E2E**

Run:
```
cd it_frontend
npx nuxt typecheck
npx eslint .
npx vitest run
npm run test:e2e
```
Expected: 전부 PASS

- [ ] **Step 3: 양 서버 기동 후 수동 스모크 (스펙 §7.3 6개 시나리오)**

```
터미널 1: cd it_backend && ./gradlew bootRun
터미널 2: cd it_frontend && npm run dev
```
브라우저에서 §7.3 표의 6개 시나리오를 모두 수행하고 결과를 `docs/04-report/common-code-redesign.report.md` 초안에 기록.

- [ ] **Step 4: 후속 과제 등록**

`TASK.md`에 다음 3건 추가:
- HRK_C 데이터 확정 (도메인 워크숍 후 별도 UPDATE 마이그레이션)
- C_TP/C_TP_DES 정리 (사용처 0건 시 컬럼 제거)
- `_OLD` 테이블 DROP (D+30)

```bash
git add TASK.md docs/04-report/common-code-redesign.report.md
git commit -m "docs: 공통코드 체계 개선 후속 과제 등록 + 스모크 결과 기록"
```

---

### Task 26: 운영 적용 패키지 준비

**Files:**
- Create: `it_database/migrations/_runbook/20260512_common_code_redesign.md`

- [ ] **Step 1: 런북 작성**

```md
# 공통코드 체계 개선 운영 적용 런북

## 사전 준비
- D-1 백업: `expdp parfile=export.par`
- D-1 사전 검증: `sqlplus … @V20260512_004__ccodem_v2_data_verify.sql` (정확히는 V003 적용 후 수행이지만, dangling 검출 부분만 미리 수동 실행해 0건 확인 가능)

## 점검창
1. 점검 모드 진입 (사용자 차단)
2. SQL 순서대로 적용:
   - V20260512_001 / 002 (스키마)
   - V20260512_003 (데이터 INSERT)
   - V20260512_004 (검증)
   - V20260512_005 (다운스트림 FK 정제)
   - V20260512_006 / 007 (스왑)
3. 백엔드 신규 jar 배포 (./gradlew clean build → bootRun 또는 java -jar)
4. 프론트 신규 dist 배포 (npm run generate)
5. 스모크 §7.3 6개 시나리오 수행
6. 점검 해제

## 모니터링
- T+24h: 백엔드 WARN 이상 로그 0건 확인
- T+24h: 사용자 문의 0건 확인

## D+30 정리
- DROP TABLE TPRMPP_CCODEM_OLD;
- DROP TABLE TPRMPP_CCODEL_OLD;

## 롤백
- Vundo_20260512__rollback.sql 실행 + 직전 jar/dist swap
- 다운스트림 FK 복구는 expdp 백업에서 import 필요
```

- [ ] **Step 2: PR 본문 템플릿 작성 (메모 파일)**

`docs/superpowers/plans/_pr-body-20260512.md` (선택):

```md
## Summary
- TPRMPP_CCODEM PK를 (C_ID, CDVA, STT_DT)로 확장
- 신규 컬럼: CDVA_DTL, C_TP_DES rename, HRK_C
- 다운스트림 FK 값 정제 (PRJ_TP_001 → 001 등)
- API: /api/ccodem/{cId}, /api/ccodem/{cId}/{cdva}
- 프론트: useCodeOptions 응답을 cId/cdva 분리로 전환

## Test plan
- [ ] ./gradlew clean test
- [ ] npx vitest run
- [ ] npm run test:e2e -- common-code.spec.ts
- [ ] dev DB V001~V007 적용 후 /admin/codes, /info/projects/form, /budget/status 수동 스모크
- [ ] 환율 USD 표시 검증

## Rollback
- Vundo_20260512__rollback.sql + 직전 jar/dist swap
```

- [ ] **Step 3: Commit**

```bash
git add it_database/migrations/_runbook/ \
        docs/superpowers/plans/_pr-body-20260512.md
git commit -m "docs(db): 공통코드 체계 개선 운영 적용 런북 + PR 본문 템플릿"
```

---

## 자체 검토 (작성자)

**스펙 커버리지**
- 스펙 §3 데이터 모델 → Task 1 (DDL), Task 6 (엔티티) ✓
- 스펙 §4 마이그레이션 SQL → Task 1~4 ✓
- 스펙 §5 백엔드 변경 → Task 5~14 ✓
- 스펙 §6 프론트엔드 변경 → Task 15~23 ✓
- 스펙 §7 롤아웃/QA/롤백 → Task 24~26 ✓
- 스펙 §8 후속 과제 → Task 25 Step 4 ✓

**플레이스홀더 스캔**: `TBD`/`TODO`/`implement later` 없음. 모든 코드 step에 코드 블록 포함.

**타입 정합**:
- `Ccodem.update(cNm, cDes, cdvaDtl, cTp, cTpDes, hrkC, cSqn, endDt)` — Task 6, Task 11에서 동일 시그니처.
- Repository 메서드명: `findByCIdAndCdvaWithValidDate`, `findByCIdWithValidDate`, `findChildrenOfHrkC`, `findAllActive` — Task 8/9/11/13/14에서 일관.
- 프론트 `CodeOption { cId, cdva, cNm, cDes?, cdvaDtl?, cTp?, cTpDes?, hrkC?, cSqn? }` — Task 15/16/17/19/20에서 일관.
