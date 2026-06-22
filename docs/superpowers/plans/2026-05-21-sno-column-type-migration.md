# _SNO 컬럼 타입 표준화 마이그레이션 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `_SNO` 접미사 컬럼 33개를 표준(NUMBER)으로 일괄 정규화하고 백엔드 채번 로직을 동기화한다.

**Architecture:** 4개 Phase로 분리 — ① NUMBER 크기 확장(비파괴), ② 숫자문자열→NUMBER, ③ 복합문자열→NUMBER(22), ④ UUID→NUMBER(22). 각 Phase는 독립 Flyway 스크립트 + Java 변경으로 구성되며 순서대로 배포한다.

**Tech Stack:** Oracle DB (ALTER TABLE MODIFY / ADD·RENAME 패턴), Flyway, Spring Boot 4 / JPA / Hibernate 6, Java 25

---

## 위반 현황 요약

| 컬럼 | 현재 타입 | 표준 | 변환 방식 | Phase |
|------|----------|------|---------|-------|
| TOK_SNO | NUMBER(19,0) | NUMBER(22) | MODIFY | 1 |
| LGN_SNO | NUMBER(19,0) | NUMBER(22) | MODIFY | 1 |
| TMN_SNO | VARCHAR2(32/255) | NUMBER(10) | 숫자문자열 추출 | 2 |
| DTP_SNO | VARCHAR2(32) | NUMBER(10) | 데이터 없음, DROP/ADD | 2 |
| ITM_SQN_SNO | VARCHAR2(9) | NUMBER(9) | 숫자문자열 추출 | 2 |
| LOG_SNO × 23개 테이블 | VARCHAR2(32) | NUMBER(22) | 복합문자열 숫자 추출 | 3 |
| APF_REL_SNO | VARCHAR2(36) | NUMBER(22) | 복합문자열 숫자 추출 | 3 |
| IVG_SNO | VARCHAR2(32) | NUMBER(22) | UUID→ROWNUM 재번호 | 4 |

---

## 파일 목록

### 신규 생성 (Flyway)
- `it_database/migrations/V20260521_001__fix_sno_number22_phase1.sql`
- `it_database/migrations/V20260521_002__fix_sno_number_phase2.sql`
- `it_database/migrations/V20260521_003__fix_sno_number22_phase3_log.sql`
- `it_database/migrations/V20260521_004__fix_sno_number22_phase3_apf.sql`
- `it_database/migrations/V20260521_005__fix_sno_number22_phase4_ivg.sql`

### 수정 (백엔드 Java)
- `it_backend/src/main/java/com/kdb/it/domain/log/id/AuditLogIdGenerator.java`
- `it_backend/src/main/java/com/kdb/it/domain/log/entity/BaseLogEntity.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/Brivgm.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/BrivgmL.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Btermm.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/BtermmL.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java`
- `it_backend/src/main/java/com/kdb/it/domain/council/entity/Bperfm.java`
- `it_backend/src/main/java/com/kdb/it/domain/council/entity/BperfmL.java`
- `it_backend/src/main/java/com/kdb/it/common/iam/entity/CorgnI.java`
- `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java`
- `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`

### 수정 (DDL 현행화)
- `it_database/ddl/ddl.sql`

---

## Phase 1: NUMBER 크기 확장 (TOK_SNO, LGN_SNO)

**영향**: NUMBER(19,0) → NUMBER(22). 하위 호환. Java(Long) 변경 없음.  
**근거**: Long은 최대 9.2×10^18 → NUMBER(22) 범위 안에 포함.

### Task 1: Flyway 스크립트 — NUMBER(19) 확장

**Files:**
- Create: `it_database/migrations/V20260521_001__fix_sno_number22_phase1.sql`

- [ ] **Step 1: 마이그레이션 스크립트 작성**

```sql
-- V20260521_001__fix_sno_number22_phase1.sql
-- TOK_SNO, LGN_SNO: NUMBER(19,0) → NUMBER(22)
-- Long(Java)은 최대 9.2×10^18로 NUMBER(22) 내에 포함됨; 기존 데이터 그대로 유지.

ALTER TABLE ITPAPP.TPRMPP_CRTOKM MODIFY (TOK_SNO NUMBER(22));
ALTER TABLE ITPAPP.TPRMPP_CLOGNH MODIFY (LGN_SNO NUMBER(22));
```

- [ ] **Step 2: DB 직접 적용 및 검증**

```powershell
sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1
```
```sql
SELECT COLUMN_NAME, DATA_TYPE, DATA_PRECISION
FROM ALL_TAB_COLUMNS
WHERE OWNER='ITPAPP'
  AND TABLE_NAME IN ('TPRMPP_CRTOKM','TPRMPP_CLOGNH')
  AND COLUMN_NAME IN ('TOK_SNO','LGN_SNO');
-- 기대: DATA_TYPE=NUMBER, DATA_PRECISION=22
```

- [ ] **Step 3: 백엔드 빌드 확인 (Java 변경 없음)**

```powershell
cd it_backend; .\gradlew clean compileJava
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add it_database/migrations/V20260521_001__fix_sno_number22_phase1.sql
git commit -m "fix: TOK_SNO·LGN_SNO NUMBER(19) → NUMBER(22) 표준 정규화"
```

---

## Phase 2: 숫자 문자열 VARCHAR2 → NUMBER

### Task 2: TMN_SNO — VARCHAR2 → NUMBER(10)

**영향**: TPRMPP_BTERMM(PK), TPRMPP_BTERML(스냅샷)  
**기존 데이터**: `'1'`, `'2'` 등 순수 숫자 문자열 → TO_NUMBER 직접 변환 가능  
**주의**: BTERMM의 TMN_SNO가 VARCHAR2(255)로 정의되어 있는 이상한 케이스

**Files:**
- Create: `it_database/migrations/V20260521_002__fix_sno_number_phase2.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Btermm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/BtermmL.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java`

- [ ] **Step 1: BTERMM PK 구조 사전 확인**

```sql
SELECT c.CONSTRAINT_NAME, c.CONSTRAINT_TYPE, cc.COLUMN_NAME, cc.POSITION
FROM ALL_CONSTRAINTS c
JOIN ALL_CONS_COLUMNS cc ON c.OWNER=cc.OWNER AND c.CONSTRAINT_NAME=cc.CONSTRAINT_NAME
WHERE c.OWNER='ITPAPP' AND c.TABLE_NAME='TPRMPP_BTERMM'
  AND c.CONSTRAINT_TYPE IN ('P','U')
ORDER BY cc.POSITION;
-- 예상: (TMN_MNG_NO, TMN_SNO) 복합 PK
```

- [ ] **Step 2: TMN_SNO 마이그레이션 스크립트 작성**

파일: `it_database/migrations/V20260521_002__fix_sno_number_phase2.sql`

```sql
-- V20260521_002__fix_sno_number_phase2.sql
-- TMN_SNO, DTP_SNO, ITM_SQN_SNO: VARCHAR2 → NUMBER

-- ─────────────────────────────────────────
-- TMN_SNO: VARCHAR2 → NUMBER(10)
-- BTERMM(마스터, VARCHAR2(255) PK) + BTERML(로그, VARCHAR2(32) 스냅샷)
-- ─────────────────────────────────────────

-- [BTERMM 마스터] PK 교체
ALTER TABLE ITPAPP.TPRMPP_BTERMM ADD (TMN_SNO_NEW NUMBER(10));
UPDATE ITPAPP.TPRMPP_BTERMM SET TMN_SNO_NEW = TO_NUMBER(TMN_SNO);
ALTER TABLE ITPAPP.TPRMPP_BTERMM DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BTERMM DROP COLUMN TMN_SNO;
ALTER TABLE ITPAPP.TPRMPP_BTERMM RENAME COLUMN TMN_SNO_NEW TO TMN_SNO;
ALTER TABLE ITPAPP.TPRMPP_BTERMM MODIFY (TMN_SNO NUMBER(10) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BTERMM ADD CONSTRAINT PK_TPRMPP_BTERMM_TMN PRIMARY KEY (TMN_MNG_NO, TMN_SNO);

-- [BTERML 로그] 스냅샷 컬럼 (PK=LOG_SNO, 변경 없음)
ALTER TABLE ITPAPP.TPRMPP_BTERML ADD (TMN_SNO_NEW NUMBER(10));
UPDATE ITPAPP.TPRMPP_BTERML SET TMN_SNO_NEW = TO_NUMBER(TMN_SNO) WHERE TMN_SNO IS NOT NULL;
ALTER TABLE ITPAPP.TPRMPP_BTERML DROP COLUMN TMN_SNO;
ALTER TABLE ITPAPP.TPRMPP_BTERML RENAME COLUMN TMN_SNO_NEW TO TMN_SNO;
```

- [ ] **Step 3: DB 검증**

```sql
SELECT COLUMN_NAME, DATA_TYPE, DATA_PRECISION
FROM ALL_TAB_COLUMNS
WHERE OWNER='ITPAPP'
  AND TABLE_NAME IN ('TPRMPP_BTERMM','TPRMPP_BTERML')
  AND COLUMN_NAME = 'TMN_SNO';
-- 기대: DATA_TYPE=NUMBER, DATA_PRECISION=10

SELECT COUNT(*) FROM ITPAPP.TPRMPP_BTERMM WHERE TMN_SNO IS NULL;
-- 기대: 0
```

- [ ] **Step 4: Btermm.java 필드 타입 변경**

파일: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Btermm.java`

변경 전:
```java
@Id
@Column(name = "TMN_SNO", nullable = false, length = 32, comment = "단말기일련번호")
private String tmnSno;
```

변경 후:
```java
@Id
@Column(name = "TMN_SNO", nullable = false, comment = "단말기일련번호")
private Integer tmnSno;
```

- [ ] **Step 5: BtermmL.java 필드 타입 변경**

파일: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/BtermmL.java`

변경 전:
```java
@Column(name = "TMN_SNO", length = 32, comment = "단말기일련번호")
private String tmnSno;
```

변경 후:
```java
@Column(name = "TMN_SNO", comment = "단말기일련번호")
private Integer tmnSno;
```

- [ ] **Step 6: BtermmRepository 채번 쿼리 수정**

파일: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java`

변경 전:
```java
@Query(value = "SELECT NVL(MAX(TO_NUMBER(TMN_SNO)), 0) + 1 FROM TPRMPP_BTERMM WHERE TMN_MNG_NO = :tmnMngNo", nativeQuery = true)
Integer getNextSnoValue(@Param("tmnMngNo") String tmnMngNo);
```

변경 후:
```java
@Query(value = "SELECT NVL(MAX(TMN_SNO), 0) + 1 FROM TPRMPP_BTERMM WHERE TMN_MNG_NO = :tmnMngNo", nativeQuery = true)
Integer getNextSnoValue(@Param("tmnMngNo") String tmnMngNo);
```

- [ ] **Step 7: 빌드 확인**

```powershell
cd it_backend; .\gradlew clean compileJava
```

- [ ] **Step 8: 커밋**

```bash
git add it_database/migrations/V20260521_002__fix_sno_number_phase2.sql \
        it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Btermm.java \
        it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/BtermmL.java \
        it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java
git commit -m "fix: TMN_SNO VARCHAR2 → NUMBER(10) 표준 정규화"
```

---

### Task 3: DTP_SNO — VARCHAR2(32) → NUMBER(10)

**영향**: TPRMPP_BPERFM(PK), TPRMPP_BPERFL(스냅샷)  
**기존 데이터**: DML 비어있음 → UPDATE 생략, DROP+ADD 방식

**Files:**
- Modify: `it_database/migrations/V20260521_002__fix_sno_number_phase2.sql` (Task 2와 동일 파일 추가)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/entity/Bperfm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/entity/BperfmL.java`

- [ ] **Step 1: BPERFM PK 구조 사전 확인**

```sql
SELECT cc.COLUMN_NAME, cc.POSITION
FROM ALL_CONSTRAINTS c
JOIN ALL_CONS_COLUMNS cc ON c.OWNER=cc.OWNER AND c.CONSTRAINT_NAME=cc.CONSTRAINT_NAME
WHERE c.OWNER='ITPAPP' AND c.TABLE_NAME='TPRMPP_BPERFM' AND c.CONSTRAINT_TYPE='P'
ORDER BY cc.POSITION;
-- 예상: (ASCT_ID, DTP_SNO) 복합 PK
```

- [ ] **Step 2: DTP_SNO 마이그레이션 스크립트 추가 (V20260521_002에 이어서)**

```sql
-- ─────────────────────────────────────────
-- DTP_SNO: VARCHAR2(32) → NUMBER(10)
-- BPERFM(마스터, 데이터 없음) + BPERFL(로그, 스냅샷)
-- 데이터가 없으므로 DROP+ADD 방식 사용
-- ─────────────────────────────────────────

-- [BPERFM 마스터] PK 포함
ALTER TABLE ITPAPP.TPRMPP_BPERFM DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BPERFM DROP COLUMN DTP_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPERFM ADD (DTP_SNO NUMBER(10));
ALTER TABLE ITPAPP.TPRMPP_BPERFM MODIFY (DTP_SNO NUMBER(10) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BPERFM ADD CONSTRAINT PK_TPRMPP_BPERFM_DTP PRIMARY KEY (ASCT_ID, DTP_SNO);

-- [BPERFL 로그] 스냅샷 컬럼
ALTER TABLE ITPAPP.TPRMPP_BPERFL DROP COLUMN DTP_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPERFL ADD (DTP_SNO NUMBER(10));
```

- [ ] **Step 3: Bperfm.java 필드 타입 변경**

파일: `it_backend/src/main/java/com/kdb/it/domain/council/entity/Bperfm.java`

변경 전:
```java
@Id
@Column(name = "DTP_SNO", length = 32, nullable = false, comment = "지표순번")
private String dtpSno;
```

변경 후:
```java
@Id
@Column(name = "DTP_SNO", nullable = false, comment = "지표순번")
private Integer dtpSno;
```

- [ ] **Step 4: BperfmL.java 필드 타입 변경**

파일: `it_backend/src/main/java/com/kdb/it/domain/council/entity/BperfmL.java`

변경 전:
```java
@Column(name = "DTP_SNO", length = 32, comment = "지표순번")
private String dtpSno;
```

변경 후:
```java
@Column(name = "DTP_SNO", comment = "지표순번")
private Integer dtpSno;
```

> PerformanceRepository의 `getNextDtpSno()` 쿼리는 `NVL(MAX(DTP_SNO), 0) + 1` 형태로
> NUMBER 타입에서 그대로 동작함 — 변경 불필요.

- [ ] **Step 5: 빌드 확인 후 커밋**

```powershell
cd it_backend; .\gradlew clean compileJava
```

```bash
git add it_backend/src/main/java/com/kdb/it/domain/council/entity/Bperfm.java \
        it_backend/src/main/java/com/kdb/it/domain/council/entity/BperfmL.java
git commit -m "fix: DTP_SNO VARCHAR2 → NUMBER(10) 표준 정규화"
```

---

### Task 4: ITM_SQN_SNO — VARCHAR2(9) → NUMBER(9)

**영향**: TPRMPP_CORGNI (비-PK 정렬 컬럼)

**Files:**
- Modify: `it_database/migrations/V20260521_002__fix_sno_number_phase2.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/entity/CorgnI.java`

- [ ] **Step 1: 실제 데이터 형태 확인**

```sql
SELECT DISTINCT ITM_SQN_SNO, LENGTH(ITM_SQN_SNO)
FROM ITPAPP.TPRMPP_CORGNI
WHERE ITM_SQN_SNO IS NOT NULL
ORDER BY 1;
-- 기대: 순수 숫자 문자열. 알파벳/특수문자 포함 시 이 Task 중단, 담당자 협의 필요.
```

- [ ] **Step 2: 마이그레이션 스크립트 추가 (V20260521_002에 이어서)**

```sql
-- ─────────────────────────────────────────
-- ITM_SQN_SNO: VARCHAR2(9) → NUMBER(9) (정렬용 비-PK 컬럼)
-- ─────────────────────────────────────────
ALTER TABLE ITPAPP.TPRMPP_CORGNI ADD (ITM_SQN_SNO_NEW NUMBER(9));
UPDATE ITPAPP.TPRMPP_CORGNI
   SET ITM_SQN_SNO_NEW = TO_NUMBER(ITM_SQN_SNO)
 WHERE ITM_SQN_SNO IS NOT NULL;
ALTER TABLE ITPAPP.TPRMPP_CORGNI DROP COLUMN ITM_SQN_SNO;
ALTER TABLE ITPAPP.TPRMPP_CORGNI RENAME COLUMN ITM_SQN_SNO_NEW TO ITM_SQN_SNO;

COMMIT;
```

- [ ] **Step 3: CorgnI.java 필드 타입 변경**

파일: `it_backend/src/main/java/com/kdb/it/common/iam/entity/CorgnI.java`

변경 전:
```java
@Column(name = "ITM_SQN_SNO", length = 9, comment = "순서")
private String itmSqnSno;
```

변경 후:
```java
@Column(name = "ITM_SQN_SNO", comment = "순서")
private Integer itmSqnSno;
```

- [ ] **Step 4: 빌드 확인 + Phase 2 전체 커밋**

```powershell
cd it_backend; .\gradlew clean compileJava
```

```bash
git add it_database/migrations/V20260521_002__fix_sno_number_phase2.sql \
        it_backend/src/main/java/com/kdb/it/common/iam/entity/CorgnI.java
git commit -m "fix: ITM_SQN_SNO VARCHAR2(9) → NUMBER(9) 표준 정규화"
```

---

## Phase 3: 복합 문자열 식별자 → NUMBER(22)

### Task 5: LOG_SNO — 23개 *L 로그 테이블 (대규모)

**영향**: 23개 이력 테이블 전체, AuditLogIdGenerator, BaseLogEntity  
**기존 데이터**: `BPROJL-0000000000000000000101` → `101` (숫자 부분 추출)  
**변환 공식**: `TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''))`  
- `BPROJL-0000000000000000000101` → `101`
- 최대값 9,999,999,999,999,999,999,999 → NUMBER(22) 충분

**Files:**
- Create: `it_database/migrations/V20260521_003__fix_sno_number22_phase3_log.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/id/AuditLogIdGenerator.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BaseLogEntity.java`

- [ ] **Step 1: 마이그레이션 스크립트 작성**

파일: `it_database/migrations/V20260521_003__fix_sno_number22_phase3_log.sql`

```sql
-- V20260521_003__fix_sno_number22_phase3_log.sql
-- LOG_SNO: VARCHAR2(32) '{Postfix}-{22자리패딩}' → NUMBER(22)
-- 변환식: TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''))
-- 패턴: 1) 임시컬럼 ADD  2) 숫자 추출 UPDATE  3) PK DROP  4) 원본 DROP  5) RENAME  6) PK ADD

-- TPRMPP_BASCTL
ALTER TABLE ITPAPP.TPRMPP_BASCTL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BASCTL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BASCTL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BASCTL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BASCTL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BASCTL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BASCTL ADD CONSTRAINT PK_TPRMPP_BASCTL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BBUGTL
ALTER TABLE ITPAPP.TPRMPP_BBUGTL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BBUGTL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BBUGTL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BBUGTL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BBUGTL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BBUGTL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BBUGTL ADD CONSTRAINT PK_TPRMPP_BBUGTL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BCHKLL
ALTER TABLE ITPAPP.TPRMPP_BCHKLL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BCHKLL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BCHKLL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BCHKLL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BCHKLL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BCHKLL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BCHKLL ADD CONSTRAINT PK_TPRMPP_BCHKLL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BCMMTL
ALTER TABLE ITPAPP.TPRMPP_BCMMTL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BCMMTL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BCMMTL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BCMMTL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BCMMTL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BCMMTL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BCMMTL ADD CONSTRAINT PK_TPRMPP_BCMMTL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BCOSTL
ALTER TABLE ITPAPP.TPRMPP_BCOSTL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BCOSTL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BCOSTL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BCOSTL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BCOSTL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BCOSTL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BCOSTL ADD CONSTRAINT PK_TPRMPP_BCOSTL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BEVALL
ALTER TABLE ITPAPP.TPRMPP_BEVALL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BEVALL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BEVALL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BEVALL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BEVALL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BEVALL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BEVALL ADD CONSTRAINT PK_TPRMPP_BEVALL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BGDOCL
ALTER TABLE ITPAPP.TPRMPP_BGDOCL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BGDOCL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BGDOCL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BGDOCL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BGDOCL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BGDOCL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BGDOCL ADD CONSTRAINT PK_TPRMPP_BGDOCL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BITEML
ALTER TABLE ITPAPP.TPRMPP_BITEML ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BITEML SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BITEML DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BITEML DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BITEML RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BITEML MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BITEML ADD CONSTRAINT PK_TPRMPP_BITEML_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BPERFL
ALTER TABLE ITPAPP.TPRMPP_BPERFL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BPERFL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BPERFL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BPERFL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPERFL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPERFL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BPERFL ADD CONSTRAINT PK_TPRMPP_BPERFL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BPLANL
ALTER TABLE ITPAPP.TPRMPP_BPLANL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BPLANL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BPLANL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BPLANL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPLANL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPLANL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BPLANL ADD CONSTRAINT PK_TPRMPP_BPLANL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BPOVWL
ALTER TABLE ITPAPP.TPRMPP_BPOVWL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BPOVWL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BPOVWL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BPOVWL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPOVWL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPOVWL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BPOVWL ADD CONSTRAINT PK_TPRMPP_BPOVWL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BPQNAL
ALTER TABLE ITPAPP.TPRMPP_BPQNAL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BPQNAL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BPQNAL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BPQNAL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPQNAL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPQNAL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BPQNAL ADD CONSTRAINT PK_TPRMPP_BPQNAL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BPROJL
ALTER TABLE ITPAPP.TPRMPP_BPROJL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BPROJL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BPROJL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BPROJL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPROJL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BPROJL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BPROJL ADD CONSTRAINT PK_TPRMPP_BPROJL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BRDOCL
ALTER TABLE ITPAPP.TPRMPP_BRDOCL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BRDOCL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BRDOCL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BRDOCL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BRDOCL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BRDOCL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BRDOCL ADD CONSTRAINT PK_TPRMPP_BRDOCL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BRIVGL
ALTER TABLE ITPAPP.TPRMPP_BRIVGL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BRIVGL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BRIVGL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BRIVGL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BRIVGL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BRIVGL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BRIVGL ADD CONSTRAINT PK_TPRMPP_BRIVGL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BRSLTL
ALTER TABLE ITPAPP.TPRMPP_BRSLTL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BRSLTL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BRSLTL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BRSLTL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BRSLTL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BRSLTL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BRSLTL ADD CONSTRAINT PK_TPRMPP_BRSLTL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BSCHDL
ALTER TABLE ITPAPP.TPRMPP_BSCHDL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BSCHDL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BSCHDL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BSCHDL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BSCHDL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BSCHDL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BSCHDL ADD CONSTRAINT PK_TPRMPP_BSCHDL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_BTERML
ALTER TABLE ITPAPP.TPRMPP_BTERML ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_BTERML SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_BTERML DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BTERML DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BTERML RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BTERML MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BTERML ADD CONSTRAINT PK_TPRMPP_BTERML_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_CAPPLL
ALTER TABLE ITPAPP.TPRMPP_CAPPLL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_CAPPLL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_CAPPLL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_CAPPLL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CAPPLL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CAPPLL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_CAPPLL ADD CONSTRAINT PK_TPRMPP_CAPPLL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_CBLBCL
ALTER TABLE ITPAPP.TPRMPP_CBLBCL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_CBLBCL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_CBLBCL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_CBLBCL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CBLBCL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CBLBCL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_CBLBCL ADD CONSTRAINT PK_TPRMPP_CBLBCL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_CCMMTL
ALTER TABLE ITPAPP.TPRMPP_CCMMTL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_CCMMTL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_CCMMTL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_CCMMTL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CCMMTL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CCMMTL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_CCMMTL ADD CONSTRAINT PK_TPRMPP_CCMMTL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_CCODEL
ALTER TABLE ITPAPP.TPRMPP_CCODEL ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_CCODEL SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_CCODEL DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_CCODEL DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CCODEL RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CCODEL MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_CCODEL ADD CONSTRAINT PK_TPRMPP_CCODEL_LOG_SNO PRIMARY KEY (LOG_SNO);

-- TPRMPP_CDECIM
ALTER TABLE ITPAPP.TPRMPP_CDECIM ADD (LOG_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_CDECIM SET LOG_SNO_NEW = TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''));
ALTER TABLE ITPAPP.TPRMPP_CDECIM DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_CDECIM DROP COLUMN LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CDECIM RENAME COLUMN LOG_SNO_NEW TO LOG_SNO;
ALTER TABLE ITPAPP.TPRMPP_CDECIM MODIFY (LOG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_CDECIM ADD CONSTRAINT PK_TPRMPP_CDECIM_LOG_SNO PRIMARY KEY (LOG_SNO);

COMMIT;

-- ─────────────────────────────────────────
-- 시퀀스 현행화: 각 SEQ_{Postfix}가 현재 최대 LOG_SNO 이상인지 확인
-- 이미 충분히 크면 그대로 유지, 작으면 INCREMENT BY 로 보정
-- ─────────────────────────────────────────
DECLARE
  v_max NUMBER;
  v_seq NUMBER;
BEGIN
  FOR r IN (
    SELECT 'BASCTL' AS sfx, 'TPRMPP_BASCTL' AS tbl FROM DUAL UNION ALL
    SELECT 'BBUGTL', 'TPRMPP_BBUGTL' FROM DUAL UNION ALL
    SELECT 'BCHKLL', 'TPRMPP_BCHKLL' FROM DUAL UNION ALL
    SELECT 'BCMMTL', 'TPRMPP_BCMMTL' FROM DUAL UNION ALL
    SELECT 'BCOSTL', 'TPRMPP_BCOSTL' FROM DUAL UNION ALL
    SELECT 'BEVALL', 'TPRMPP_BEVALL' FROM DUAL UNION ALL
    SELECT 'BGDOCL', 'TPRMPP_BGDOCL' FROM DUAL UNION ALL
    SELECT 'BITEML', 'TPRMPP_BITEML' FROM DUAL UNION ALL
    SELECT 'BPERFL', 'TPRMPP_BPERFL' FROM DUAL UNION ALL
    SELECT 'BPLANL', 'TPRMPP_BPLANL' FROM DUAL UNION ALL
    SELECT 'BPOVWL', 'TPRMPP_BPOVWL' FROM DUAL UNION ALL
    SELECT 'BPQNAL', 'TPRMPP_BPQNAL' FROM DUAL UNION ALL
    SELECT 'BPROJL', 'TPRMPP_BPROJL' FROM DUAL UNION ALL
    SELECT 'BRDOCL', 'TPRMPP_BRDOCL' FROM DUAL UNION ALL
    SELECT 'BRIVGL', 'TPRMPP_BRIVGL' FROM DUAL UNION ALL
    SELECT 'BRSLTL', 'TPRMPP_BRSLTL' FROM DUAL UNION ALL
    SELECT 'BSCHDL', 'TPRMPP_BSCHDL' FROM DUAL UNION ALL
    SELECT 'BTERML', 'TPRMPP_BTERML' FROM DUAL UNION ALL
    SELECT 'CAPPLL', 'TPRMPP_CAPPLL' FROM DUAL UNION ALL
    SELECT 'CBLBCL', 'TPRMPP_CBLBCL' FROM DUAL UNION ALL
    SELECT 'CCMMTL', 'TPRMPP_CCMMTL' FROM DUAL UNION ALL
    SELECT 'CCODEL', 'TPRMPP_CCODEL' FROM DUAL UNION ALL
    SELECT 'CDECIM', 'TPRMPP_CDECIM' FROM DUAL
  ) LOOP
    EXECUTE IMMEDIATE 'SELECT NVL(MAX(LOG_SNO),0) FROM ITPAPP.' || r.tbl INTO v_max;
    EXECUTE IMMEDIATE 'SELECT SEQ_' || r.sfx || '.NEXTVAL FROM DUAL' INTO v_seq;
    IF v_seq <= v_max THEN
      EXECUTE IMMEDIATE 'ALTER SEQUENCE ITPAPP.SEQ_' || r.sfx
        || ' INCREMENT BY ' || (v_max - v_seq + 1);
      EXECUTE IMMEDIATE 'SELECT SEQ_' || r.sfx || '.NEXTVAL FROM DUAL' INTO v_seq;
      EXECUTE IMMEDIATE 'ALTER SEQUENCE ITPAPP.SEQ_' || r.sfx || ' INCREMENT BY 1';
    END IF;
  END LOOP;
  DBMS_OUTPUT.PUT_LINE('시퀀스 현행화 완료');
END;
/
```

- [ ] **Step 2: DB 적용 및 검증**

```sql
-- 23개 테이블 모두 NUMBER(22) 확인
SELECT TABLE_NAME, DATA_TYPE, DATA_PRECISION
FROM ALL_TAB_COLUMNS
WHERE OWNER='ITPAPP'
  AND COLUMN_NAME = 'LOG_SNO'
  AND TABLE_NAME LIKE 'TPRMPP_%'
ORDER BY TABLE_NAME;
-- 기대: 23행, DATA_TYPE=NUMBER, DATA_PRECISION=22
```

- [ ] **Step 3: AuditLogIdGenerator.java — Long 반환으로 변경**

파일: `it_backend/src/main/java/com/kdb/it/domain/log/id/AuditLogIdGenerator.java`

변경 전:
```java
private static final int SEQ_PAD_LENGTH = 22;

@Override
public Object generate(SharedSessionContractImplementor session, Object object) {
    String postfix = resolvePostfix(object);
    long nextVal = fetchNextVal(session, "SEQ_" + postfix);
    return postfix + "-" + String.format("%0" + SEQ_PAD_LENGTH + "d", nextVal);
}
```

변경 후:
```java
@Override
public Object generate(SharedSessionContractImplementor session, Object object) {
    String postfix = resolvePostfix(object);
    return fetchNextVal(session, "SEQ_" + postfix);
}
```

`SEQ_PAD_LENGTH` 상수 삭제. `resolvePostfix`는 시퀀스명 도출에 계속 사용하므로 유지.

- [ ] **Step 4: BaseLogEntity.java — String → Long**

파일: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BaseLogEntity.java`

변경 전:
```java
/** 로그일련번호: PK. {Postfix}_{22자리_0패딩_시퀀스} 형식 */
@Id
@AuditLogId
@Column(name = "LOG_SNO", length = 32, nullable = false, updatable = false, comment = "로그일련번호")
private String logSno;
```

변경 후:
```java
/** 로그일련번호: PK. DB 시퀀스 SEQ_{Postfix}.NEXTVAL */
@Id
@AuditLogId
@Column(name = "LOG_SNO", nullable = false, updatable = false, comment = "로그일련번호")
private Long logSno;
```

- [ ] **Step 5: logSno를 String으로 다루는 코드 전수 검색**

```powershell
Select-String -Path "it_backend/src/**/*.java" -Pattern "logSno|LOG_SNO" -Recurse |
  Where-Object { $_ -match "String|format|replace|concat|startsWith|endsWith" }
```

String 처리 코드 발견 시 Long 비교/변환으로 수정.

- [ ] **Step 6: 빌드 확인**

```powershell
cd it_backend; .\gradlew clean compileJava
```

- [ ] **Step 7: 커밋**

```bash
git add it_database/migrations/V20260521_003__fix_sno_number22_phase3_log.sql \
        it_backend/src/main/java/com/kdb/it/domain/log/id/AuditLogIdGenerator.java \
        it_backend/src/main/java/com/kdb/it/domain/log/entity/BaseLogEntity.java
git commit -m "fix: LOG_SNO 복합문자열 VARCHAR2(32) → NUMBER(22), AuditLogIdGenerator 숫자 반환으로 단순화"
```

---

### Task 6: APF_REL_SNO — VARCHAR2(36) → NUMBER(22)

**영향**: TPRMPP_CAPPLA (PK만, CAPPLL에는 없음)  
**기존 데이터**: `APPL-0000000000000000000000000455` → `455`  
**변환**: `TO_NUMBER(SUBSTR(APF_REL_SNO, 6))` (6번째 자리부터 숫자 부분)

**Files:**
- Create: `it_database/migrations/V20260521_004__fix_sno_number22_phase3_apf.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`

- [ ] **Step 1: 마이그레이션 스크립트 작성**

파일: `it_database/migrations/V20260521_004__fix_sno_number22_phase3_apf.sql`

```sql
-- V20260521_004__fix_sno_number22_phase3_apf.sql
-- APF_REL_SNO: VARCHAR2(36) 'APPL-{28자리패딩}' → NUMBER(22)
-- 변환: TO_NUMBER(SUBSTR(APF_REL_SNO, 6)) → 선행 0 자동 제거

-- APF_REL_SNO가 포함된 복합 인덱스 사전 삭제 (타입 변경 시 자동 무효화됨)
DROP INDEX ITPAPP.IDX_TPRMPP_CAPPLA_ORC_TB_CD_ORC_PK_VL_ORC_SNO_VL_APF_REL_SNO;

ALTER TABLE ITPAPP.TPRMPP_CAPPLA ADD (APF_REL_SNO_NEW NUMBER(22));
UPDATE ITPAPP.TPRMPP_CAPPLA
   SET APF_REL_SNO_NEW = TO_NUMBER(SUBSTR(APF_REL_SNO, 6));
ALTER TABLE ITPAPP.TPRMPP_CAPPLA DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_CAPPLA DROP COLUMN APF_REL_SNO;
ALTER TABLE ITPAPP.TPRMPP_CAPPLA RENAME COLUMN APF_REL_SNO_NEW TO APF_REL_SNO;
ALTER TABLE ITPAPP.TPRMPP_CAPPLA MODIFY (APF_REL_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_CAPPLA ADD CONSTRAINT PK_TPRMPP_CAPPLA_APF_REL_SNO PRIMARY KEY (APF_REL_SNO);

-- 인덱스 재생성
CREATE INDEX ITPAPP.IDX_TPRMPP_CAPPLA_ORC_VL
  ON ITPAPP.TPRMPP_CAPPLA (ORC_TB_CD, ORC_PK_VL, ORC_SNO_VL, APF_REL_SNO)
  TABLESPACE USERS;

-- 시퀀스 현행화
DECLARE
  v_max NUMBER;
  v_seq NUMBER;
BEGIN
  SELECT NVL(MAX(APF_REL_SNO), 0) INTO v_max FROM ITPAPP.TPRMPP_CAPPLA;
  SELECT SEQ_CAPPLA.NEXTVAL INTO v_seq FROM DUAL;
  IF v_seq <= v_max THEN
    EXECUTE IMMEDIATE 'ALTER SEQUENCE ITPAPP.SEQ_CAPPLA INCREMENT BY ' || (v_max - v_seq + 1);
    SELECT SEQ_CAPPLA.NEXTVAL INTO v_seq FROM DUAL;
    EXECUTE IMMEDIATE 'ALTER SEQUENCE ITPAPP.SEQ_CAPPLA INCREMENT BY 1';
  END IF;
END;
/

COMMIT;
```

- [ ] **Step 2: Cappla.java — String → Long + @GeneratedValue**

파일: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java`

변경 전:
```java
@Id
@Column(name = "APF_REL_SNO", nullable = false, length = 36, comment = "신청서관계일련번호")
private String apfRelSno;
```

변경 후:
```java
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "SEQ_CAPPLA")
@SequenceGenerator(name = "SEQ_CAPPLA", sequenceName = "SEQ_CAPPLA", allocationSize = 1)
@Column(name = "APF_REL_SNO", nullable = false, comment = "신청서관계일련번호")
private Long apfRelSno;
```

- [ ] **Step 3: ApplicationService.java — 수동 채번 코드 제거**

파일: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`

제거 대상 (Line 151 전후):
```java
// 제거할 코드
Long seq = applicationMapRepository.getNextVal();
String apfRelSno = String.format("APPL-%028d", seq);
cappla.setApfRelSno(apfRelSno);  // 또는 빌더의 .apfRelSno(apfRelSno)
```

`@GeneratedValue` 적용 후 `apfRelSno`는 `save()` 시 자동 채번되므로 수동 세팅 불필요.

> ⚠️ `applicationMapRepository.getNextVal()`이 APF_REL_SNO 채번 전용인지 확인:
> ```powershell
> Select-String -Path "it_backend/src/**/*.java" -Pattern "applicationMapRepository" -Recurse
> ```
> 전용이면 해당 Repository 메서드 및 Repository 클래스도 함께 삭제.

- [ ] **Step 4: 빌드 확인 후 커밋**

```powershell
cd it_backend; .\gradlew clean compileJava
```

```bash
git add it_database/migrations/V20260521_004__fix_sno_number22_phase3_apf.sql \
        it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java \
        it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java
git commit -m "fix: APF_REL_SNO 복합문자열 VARCHAR2 → NUMBER(22), @GeneratedValue 채번으로 전환"
```

---

## Phase 4: UUID → NUMBER(22)

### Task 7: IVG_SNO — UUID → NUMBER(22)

**영향**: TPRMPP_BRIVGM(PK), TPRMPP_BRIVGL(스냅샷, FK 제약 없음)  
**기존 데이터**: UUID `a1b2c3d4...` → TO_NUMBER 불가 → 등록순 ROWNUM 재번호  
**핵심**: BRIVGM↔BRIVGL 간 UUID 매핑을 보존한 채로 재번호 부여

**Files:**
- Create: `it_database/migrations/V20260521_005__fix_sno_number22_phase4_ivg.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/Brivgm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/BrivgmL.java`

- [ ] **Step 1: FK 제약 및 IVG_SNO 참조 여부 최종 확인**

```sql
-- FK 없음 확인
SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE, R_CONSTRAINT_NAME
FROM ALL_CONSTRAINTS
WHERE OWNER='ITPAPP'
  AND TABLE_NAME IN ('TPRMPP_BRIVGL','TPRMPP_BRIVGM')
  AND CONSTRAINT_TYPE IN ('P','R');
-- R 타입이 없어야 함. 있으면 먼저 DROP 필요.

-- 다른 테이블에서 IVG_SNO 참조 여부
SELECT TABLE_NAME, COLUMN_NAME FROM ALL_TAB_COLUMNS
WHERE OWNER='ITPAPP' AND COLUMN_NAME = 'IVG_SNO'
  AND TABLE_NAME NOT IN ('TPRMPP_BRIVGM','TPRMPP_BRIVGL');
-- 기대: 0건
```

- [ ] **Step 2: 마이그레이션 스크립트 작성**

파일: `it_database/migrations/V20260521_005__fix_sno_number22_phase4_ivg.sql`

```sql
-- V20260521_005__fix_sno_number22_phase4_ivg.sql
-- IVG_SNO: UUID VARCHAR2(32) → NUMBER(22)
-- UUID는 숫자 변환 불가 → 임시 매핑 테이블로 UUID-NUMBER 대응 후 양쪽 테이블 동시 교체

-- 1단계: UUID → NUMBER 매핑 (등록일시 순 번호 부여)
CREATE GLOBAL TEMPORARY TABLE IVG_SNO_MAP (
    OLD_SNO VARCHAR2(32),
    NEW_SNO NUMBER(22)
) ON COMMIT PRESERVE ROWS;

INSERT INTO IVG_SNO_MAP (OLD_SNO, NEW_SNO)
SELECT IVG_SNO, ROWNUM
FROM ITPAPP.TPRMPP_BRIVGM
ORDER BY FST_ENR_DTM, IVG_SNO;

-- 2단계: 신규 컬럼 추가
ALTER TABLE ITPAPP.TPRMPP_BRIVGM ADD (IVG_SNO_NEW NUMBER(22));
ALTER TABLE ITPAPP.TPRMPP_BRIVGL ADD (IVG_SNO_NEW NUMBER(22));

-- 3단계: 매핑으로 채움
UPDATE ITPAPP.TPRMPP_BRIVGM m
   SET IVG_SNO_NEW = (SELECT MAP.NEW_SNO FROM IVG_SNO_MAP MAP WHERE MAP.OLD_SNO = m.IVG_SNO);
UPDATE ITPAPP.TPRMPP_BRIVGL l
   SET IVG_SNO_NEW = (SELECT MAP.NEW_SNO FROM IVG_SNO_MAP MAP WHERE MAP.OLD_SNO = l.IVG_SNO);

-- 4단계: BRIVGM PK 교체
ALTER TABLE ITPAPP.TPRMPP_BRIVGM DROP PRIMARY KEY;
ALTER TABLE ITPAPP.TPRMPP_BRIVGM DROP COLUMN IVG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BRIVGM RENAME COLUMN IVG_SNO_NEW TO IVG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BRIVGM MODIFY (IVG_SNO NUMBER(22) NOT NULL);
ALTER TABLE ITPAPP.TPRMPP_BRIVGM ADD CONSTRAINT PK_TPRMPP_BRIVGM_IVG_SNO PRIMARY KEY (IVG_SNO);

-- 5단계: BRIVGL 스냅샷 컬럼 교체
ALTER TABLE ITPAPP.TPRMPP_BRIVGL DROP COLUMN IVG_SNO;
ALTER TABLE ITPAPP.TPRMPP_BRIVGL RENAME COLUMN IVG_SNO_NEW TO IVG_SNO;

-- 6단계: BRIVGM 전용 시퀀스 생성 (현재 최대값 + 1부터 시작)
DECLARE
  v_max NUMBER;
BEGIN
  SELECT NVL(MAX(IVG_SNO), 0) INTO v_max FROM ITPAPP.TPRMPP_BRIVGM;
  EXECUTE IMMEDIATE
    'CREATE SEQUENCE ITPAPP.SEQ_BRIVGM '
    || 'INCREMENT BY 1 MINVALUE 1 '
    || 'MAXVALUE 9999999999999999999999 '
    || 'START WITH ' || (v_max + 1)
    || ' CYCLE NOCACHE NOORDER';
END;
/

-- 7단계: 임시 매핑 테이블 정리
DROP TABLE IVG_SNO_MAP;

COMMIT;
```

- [ ] **Step 3: 데이터 연속성 검증**

```sql
-- BRIVGL의 IVG_SNO가 BRIVGM에 모두 존재하는지
SELECT COUNT(*) FROM ITPAPP.TPRMPP_BRIVGL l
WHERE l.IVG_SNO IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ITPAPP.TPRMPP_BRIVGM m WHERE m.IVG_SNO = l.IVG_SNO);
-- 기대: 0

-- 타입 확인
SELECT TABLE_NAME, DATA_TYPE, DATA_PRECISION
FROM ALL_TAB_COLUMNS
WHERE OWNER='ITPAPP'
  AND TABLE_NAME IN ('TPRMPP_BRIVGM','TPRMPP_BRIVGL')
  AND COLUMN_NAME = 'IVG_SNO';
-- 기대: NUMBER, 22
```

- [ ] **Step 4: Brivgm.java — UUID 채번 제거, @GeneratedValue 추가**

파일: `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/Brivgm.java`

변경 전:
```java
@Id
@Column(name = "IVG_SNO", length = 32, nullable = false, comment = "의견일련번호")
private String ivgSno;

@PrePersist
private void prePersistBrivgm() {
    if (this.ivgSno == null) {
        this.ivgSno = UUID.randomUUID().toString().replace("-", "");
    }
}
```

변경 후:
```java
@Id
@GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "SEQ_BRIVGM")
@SequenceGenerator(name = "SEQ_BRIVGM", sequenceName = "SEQ_BRIVGM", allocationSize = 1)
@Column(name = "IVG_SNO", nullable = false, comment = "의견일련번호")
private Long ivgSno;
```

`@PrePersist` 메서드 전체 삭제. 파일 상단 `UUID` import도 제거.

- [ ] **Step 5: BrivgmL.java — String → Long**

파일: `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/BrivgmL.java`

변경 전:
```java
@Column(name = "IVG_SNO", length = 32, comment = "의견일련번호")
private String ivgSno;
```

변경 후:
```java
@Column(name = "IVG_SNO", comment = "의견일련번호")
private Long ivgSno;
```

- [ ] **Step 6: ivgSno String 처리 코드 확인**

```powershell
Select-String -Path "it_backend/src/**/*.java" -Pattern "ivgSno|IVG_SNO" -Recurse |
  Where-Object { $_ -notmatch "entity\\Brivgm" }
```

String 비교 또는 포맷팅 코드 발견 시 Long 처리로 수정.

- [ ] **Step 7: 빌드 확인 후 커밋**

```powershell
cd it_backend; .\gradlew clean compileJava
```

```bash
git add it_database/migrations/V20260521_005__fix_sno_number22_phase4_ivg.sql \
        it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/Brivgm.java \
        it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/BrivgmL.java
git commit -m "fix: IVG_SNO UUID VARCHAR2 → NUMBER(22), SEQ_BRIVGM 생성, @GeneratedValue 채번 전환"
```

---

## 최종 검증 — 전체 Phase 완료 후

- [ ] **전체 빌드 + 테스트**

```powershell
cd it_backend; .\gradlew clean build
```

- [ ] **_SNO 컬럼 전수 타입 확인**

```sql
-- 이 쿼리가 0건이면 모든 위반 해소
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION
FROM ALL_TAB_COLUMNS
WHERE OWNER = 'ITPAPP'
  AND COLUMN_NAME LIKE '%\_SNO' ESCAPE '\'
  AND DATA_TYPE != 'NUMBER'
ORDER BY TABLE_NAME, COLUMN_NAME;
-- 기대: 0건

-- NUMBER지만 표준 크기 아닌 것 (4,7,9,10,18,22 외)
SELECT TABLE_NAME, COLUMN_NAME, DATA_PRECISION
FROM ALL_TAB_COLUMNS
WHERE OWNER = 'ITPAPP'
  AND COLUMN_NAME LIKE '%\_SNO' ESCAPE '\'
  AND DATA_TYPE = 'NUMBER'
  AND DATA_PRECISION NOT IN (4, 7, 9, 10, 18, 22)
ORDER BY TABLE_NAME;
-- 기대: 0건
```

- [ ] **DDL 현행화**

Oracle DBMS_METADATA로 최신 스키마 추출 후 `it_database/ddl/ddl.sql` 갱신:

```powershell
sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1
```
```sql
SELECT DBMS_METADATA.GET_DDL('TABLE', TABLE_NAME, 'ITPAPP')
  FROM ALL_TABLES WHERE OWNER='ITPAPP' ORDER BY TABLE_NAME;
```

- [ ] **최종 커밋**

```bash
git add it_database/ddl/ddl.sql
git commit -m "docs: _SNO 컬럼 표준화 완료 후 DDL 현행화"
```

---

## 리스크 및 주의 사항

| 리스크 | 대상 | 대응 |
|--------|------|------|
| LOG_SNO 패딩 숫자 중복 가능성 | 같은 테이블 내 동일 숫자 추출 시 PK 충돌 | Step 1 REGEXP 적용 전 `SELECT COUNT(*), TO_NUMBER(REGEXP_REPLACE(LOG_SNO,'[^0-9]','')) FROM ... GROUP BY 2 HAVING COUNT(*)>1` 로 사전 확인 |
| IVG_SNO UUID 재번호 후 외부 참조 | API 응답으로 IVG_SNO가 클라이언트에 캐시된 경우 | 프론트엔드에서 저장된 IVG_SNO 값이 있으면 무효화 처리 필요 |
| BTERMM PK가 단일 컬럼인 경우 | PK 재생성 스크립트 오류 | Step 1 사전 확인으로 분기 |
| APF_REL_SNO SUBSTR(6) 포맷 가정 | 값이 `APPL-` 아닌 다른 접두사를 가질 경우 | `SELECT DISTINCT SUBSTR(APF_REL_SNO,1,5) FROM TPRMPP_CAPPLA` 로 사전 확인 |
