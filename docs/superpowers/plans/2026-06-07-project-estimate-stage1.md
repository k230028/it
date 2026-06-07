# 소요예산 산정 (Stage ①) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보화사업(`TPRMPP_BPROJM`)에 대한 소요예산 산정 신청/작업 화면(MVP)을 풀스택으로 구현한다 — 신청자가 산정을 신청하고, 작업자(담당팀/관리자)가 팀별·비목별 소요예산금액을 입력·완료한다.

**Architecture:** 설계서 A안(단계별 독립 도메인)의 첫 수직 슬라이스. 마스터(`Bestim`) + 팀별 산정 명세(`Bestid`), 상태 3단(작성중 41 → 진행중 42 → 완료 49, 공통코드 `IT_PTL_STS_TC`). 백엔드는 기존 `council` 도메인 패턴(레이어드 + `@LogTarget` 변경로그 + QueryDSL + `bbrC` 부서필터)을 미러링하고, 프론트는 `StyledDataTable` + `useApiFetch`/`$apiFetch` 컨벤션을 따른다.

**Tech Stack:** Spring Boot 4 / Java 25 / Spring Data JPA + QueryDSL / Oracle (ddl-auto=**validate** → 마이그레이션 선행 필수) / JUnit5 + Mockito + AssertJ / Nuxt 4 + PrimeVue + Vitest.

**설계서(SoT):** `docs/superpowers/specs/2026-06-07-project-execution-stages-design.md`

> **⚠️ 사후 정정 (2026-06-07, 명명규칙 정합):** 본 플랜의 아래 본문은 구현 당시 그대로의 기록입니다. 구현 직후 **상세 테이블/엔티티가 명명규칙(`TPRMPP_B{4도메인}{M/L/H}`, 용도문자 `D` 미사용)에 맞게 개명**되었습니다. 아래 본문의 다음 이름들은 현재 코드/DB에서 **개명된 이름**으로 존재합니다:
> - 테이블 `TPRMPP_BESTID` → **`TPRMPP_BESTTM`**, 로그 `TPRMPP_BESTIDL` → **`TPRMPP_BESTTL`**, 시퀀스 `SEQ_BESTIDL` → **`SEQ_BESTTL`**
> - 엔티티 `Bestid` → **`Besttm`**, `BestidId` → **`BesttmId`**, `BestidL` → **`BesttmL`** (도메인 `ESTT`)
> - 개명은 신규 마이그레이션 `V20260607_004__RenameEstimateDetailTables.sql`(이미 적용)로 수행. 마스터(`Bestim`/`TPRMPP_BESTIM`)는 불변. 현재 명명규칙은 설계서 §3.1 참조.

---

## 핵심 규약 (작업 전 필독)

- **마이그레이션 선행**: `ddl-auto=validate`이므로 엔티티보다 **테이블 DDL 마이그레이션을 먼저 실행**해야 부팅/테스트가 통과한다. 마이그레이션은 `it_database/migrations/V{YYYYMMDD_NNN}__*.sql`.
- **로그 테이블/시퀀스 명명**: `AuditLogIdGenerator`가 로그 엔티티 `@Table(name="TPRMPP_XXX")`의 `_` 뒤(`XXX`)로 `SEQ_XXX`를 호출한다. 본 플랜 명명:
  - 마스터 `TPRMPP_BESTIM` → 로그 `TPRMPP_BESTIL` → 시퀀스 `SEQ_BESTIL`
  - 명세 `TPRMPP_BESTID` → 로그 `TPRMPP_BESTIDL` → 시퀀스 `SEQ_BESTIDL` (명세는 끝자가 `D`라 마스터 로그와 충돌 → `L`을 덧붙여 고유화)
  - 문서번호 채번 시퀀스: `SEQ_BESTIM`
- **감사 컬럼 타입**: 최근 정상 부팅된 메뉴 마이그레이션(`V20260603_007`)을 그대로 미러링한다 — `FST_ENR_DTM`/`LST_CHG_DTM` = `DATE`, `GUID_PRG_SNO` = `NUMBER(4,0)`, 로그 PK `LOG_HIS_TGR_SNO` = `NUMBER(18,0)`, 로그 `CHG_DTM` = `TIMESTAMP(9)`.
- **메타 용어 고정**(설계서 부록 A): `RQM_BG_REQ_DOC_NO`(문서번호), `DOC_VRS_SNO`(버전), `LST_YN`, `BG_PRN_TC`(대상구분, 값 `100`=정보화사업), `CNCD_RFR_NO`(대상관리번호=사업 `ABUS_MNG_NO`), `IT_PTL_STS_TC`(상태), `REQ_CONE`(요청내용), `SVN_TEM_C`(담당팀), `IOE_C`(비목), `RQM_BG_AMT`(소요예산금액), `OPNN_CONE`(의견).
- **DB 접속 검증**: `.\it_database\connect-db.ps1` 로 SELECT 검증 가능.
- **테스트 명령**: 백엔드 `cd it_backend && ./gradlew test`, 프론트 `cd it_frontend && npm test` / `npm run typecheck`.
- **커밋**: 각 Task 끝에서 커밋(Conventional Commits). 단계별 PR.

---

## 파일 구조 (생성/수정 대상)

**DB 마이그레이션**
- Create: `it_database/migrations/V20260607_001__SeedItPtlBgPrnTc.sql` (공통코드 IT_PTL_BG_PRN_TC)
- Create: `it_database/migrations/V20260607_002__CreateEstimateTables.sql` (BESTIM/BESTID + 로그 + 시퀀스)
- Create: `it_database/migrations/V20260607_003__SeedEstimateMenu.sql` (메뉴 노출)

**백엔드 (`it_backend/src/main/java/com/kdb/it/domain/estimate/`)**
- Create: `entity/Bestim.java`, `entity/BestimId.java`, `entity/Bestid.java`, `entity/BestidId.java`
- Create: `domain/log/entity/BestimL.java`, `domain/log/entity/BestidL.java`
- Create: `repository/EstimateRepository.java`, `repository/EstimateRepositoryCustom.java`, `repository/EstimateRepositoryImpl.java`, `repository/EstimateLineRepository.java`
- Create: `dto/EstimateDto.java`
- Create: `service/EstimateService.java`
- Create: `controller/EstimateController.java`
- Test: `src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java`
- Test: `src/test/java/com/kdb/it/domain/estimate/controller/EstimateControllerTest.java`
- Test: `src/test/java/com/kdb/it/domain/estimate/repository/EstimateRepositoryTest.java`

**프론트엔드 (`it_frontend/`)**
- Create: `app/types/estimate.ts`
- Create: `app/composables/useEstimates.ts`
- Create: `app/pages/project/estimate/index.vue`
- Create: `app/pages/project/estimate/[docNo].vue`
- Test: `tests/unit/composables/useEstimates.test.ts`

---

## Phase 0 — 공통 선행

### Task 1: 공통코드 `IT_PTL_BG_PRN_TC` 등록 (대상구분: 정보화사업/전산업무비)

**Files:**
- Create: `it_database/migrations/V20260607_001__SeedItPtlBgPrnTc.sql`

- [ ] **Step 1: 마이그레이션 작성**

`TPRMPP_CCODEM` 컬럼은 `CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN` 사용. 멱등성: 해당 그룹 DELETE 후 INSERT.

```sql
-- V20260607_001__SeedItPtlBgPrnTc.sql
-- 대상구분 공통코드(IT_PTL_BG_PRN_TC): 소요예산/심의/계약/대금지급 단계의 대상(사업/전산업무비) 구분.
-- 멱등: 그룹 DELETE 후 재INSERT. 수동 실행:
--   sqlplus ITPAPP/****@127.0.0.1:1521/XEPDB1 @V20260607_001__SeedItPtlBgPrnTc.sql

DELETE FROM ITPAPP.TPRMPP_CCODEM WHERE CO_C_ID = 'IT_PTL_BG_PRN_TC';

INSERT INTO ITPAPP.TPRMPP_CCODEM
  (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN)
VALUES
  ('IT_PTL_BG_PRN_TC', '100', DATE '2026-01-01', DATE '9999-12-31', '대상구분', '정보화사업', 1, 'MIGRATION', SYSDATE, 'N');

INSERT INTO ITPAPP.TPRMPP_CCODEM
  (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN)
VALUES
  ('IT_PTL_BG_PRN_TC', '200', DATE '2026-01-01', DATE '9999-12-31', '대상구분', '전산업무비', 2, 'MIGRATION', SYSDATE, 'N');

COMMIT;
```

- [ ] **Step 2: 실행 및 검증**

`connect-db.ps1`로 접속 후 위 스크립트 실행, 이어서 SELECT 검증:
`SELECT CDVA_ID, CDVA_NM FROM TPRMPP_CCODEM WHERE CO_C_ID='IT_PTL_BG_PRN_TC' ORDER BY C_SQN_SNO;`
Expected: 2행 — `100 정보화사업`, `200 전산업무비`.

> 주의: 본 프로젝트는 Flyway 네이밍을 쓰되 수동 적용 이력이 있으므로, 기존 최신 마이그레이션과 동일한 절차로 1회 실행한다.

- [ ] **Step 3: 커밋**

```bash
git add it_database/migrations/V20260607_001__SeedItPtlBgPrnTc.sql
git commit -m "feat(db): IT_PTL_BG_PRN_TC 대상구분 공통코드 등록(100 정보화사업/200 전산업무비)"
```

---

## Stage ① 백엔드

### Task 2: 테이블/로그/시퀀스 마이그레이션 생성

**Files:**
- Create: `it_database/migrations/V20260607_002__CreateEstimateTables.sql`

- [ ] **Step 1: 마이그레이션 작성** (감사 컬럼 타입은 메뉴 마이그레이션 미러링)

```sql
-- V20260607_002__CreateEstimateTables.sql
-- 소요예산 산정 마스터(BESTIM) + 팀별 산정 명세(BESTID) + 변경로그(BESTIL/BESTIDL) + 시퀀스.
-- ddl-auto=validate 이므로 엔티티 작성 전 본 스크립트를 먼저 실행한다.
-- 감사컬럼 타입은 V20260603_007__CreateMenuTables.sql 과 동일 규약(DATE/NUMBER(4,0)/TIMESTAMP(9)).

-- 1) 마스터: 소요예산 산정 요청
CREATE TABLE TPRMPP_BESTIM (
  RQM_BG_REQ_DOC_NO VARCHAR2(30 CHAR) NOT NULL,
  DOC_VRS_SNO       NUMBER(9,0)       NOT NULL,
  LST_YN            VARCHAR2(1 CHAR)  DEFAULT 'Y' NOT NULL,
  BG_PRN_TC         VARCHAR2(3 CHAR)  NOT NULL,
  CNCD_RFR_NO       VARCHAR2(30 CHAR) NOT NULL,
  IT_PTL_STS_TC     VARCHAR2(2 CHAR)  NOT NULL,
  REQ_CONE          VARCHAR2(300 CHAR),
  DEL_YN            VARCHAR2(1 CHAR)  DEFAULT 'N' NOT NULL,
  GUID              VARCHAR2(38 CHAR),
  GUID_PRG_SNO      NUMBER(4,0),
  FST_ENR_DTM       DATE,
  FST_ENR_USID      VARCHAR2(14 CHAR),
  LST_CHG_DTM       DATE,
  LST_CHG_USID      VARCHAR2(14 CHAR),
  CONSTRAINT PK_TPRMPP_BESTIM PRIMARY KEY (RQM_BG_REQ_DOC_NO, DOC_VRS_SNO),
  CONSTRAINT CK_BESTIM_LST_YN CHECK (LST_YN IN ('Y','N')),
  CONSTRAINT CK_BESTIM_DEL_YN CHECK (DEL_YN IN ('Y','N'))
);
COMMENT ON TABLE  TPRMPP_BESTIM                   IS '소요예산 산정 기본';
COMMENT ON COLUMN TPRMPP_BESTIM.RQM_BG_REQ_DOC_NO IS '소요예산요청문서번호';
COMMENT ON COLUMN TPRMPP_BESTIM.DOC_VRS_SNO       IS '문서버전일련번호';
COMMENT ON COLUMN TPRMPP_BESTIM.LST_YN            IS '최종여부';
COMMENT ON COLUMN TPRMPP_BESTIM.BG_PRN_TC         IS '예산성격구분코드(대상구분)';
COMMENT ON COLUMN TPRMPP_BESTIM.CNCD_RFR_NO       IS '관련참조번호(대상관리번호)';
COMMENT ON COLUMN TPRMPP_BESTIM.IT_PTL_STS_TC     IS 'IT포탈상태구분코드';
COMMENT ON COLUMN TPRMPP_BESTIM.REQ_CONE          IS '요청내용';
CREATE INDEX IDX_BESTIM_TGT ON TPRMPP_BESTIM (BG_PRN_TC, CNCD_RFR_NO);
CREATE INDEX IDX_BESTIM_STS ON TPRMPP_BESTIM (IT_PTL_STS_TC);

-- 2) 명세: 팀별·비목별 소요예산금액
CREATE TABLE TPRMPP_BESTID (
  RQM_BG_REQ_DOC_NO VARCHAR2(30 CHAR) NOT NULL,
  DOC_VRS_SNO       NUMBER(9,0)       NOT NULL,
  SVN_TEM_C         VARCHAR2(5 CHAR)  NOT NULL,
  IOE_C             VARCHAR2(7 CHAR)  NOT NULL,
  RQM_BG_AMT        NUMBER(18,0),
  OPNN_CONE         VARCHAR2(1000 CHAR),
  DEL_YN            VARCHAR2(1 CHAR)  DEFAULT 'N' NOT NULL,
  GUID              VARCHAR2(38 CHAR),
  GUID_PRG_SNO      NUMBER(4,0),
  FST_ENR_DTM       DATE,
  FST_ENR_USID      VARCHAR2(14 CHAR),
  LST_CHG_DTM       DATE,
  LST_CHG_USID      VARCHAR2(14 CHAR),
  CONSTRAINT PK_TPRMPP_BESTID PRIMARY KEY (RQM_BG_REQ_DOC_NO, DOC_VRS_SNO, SVN_TEM_C, IOE_C),
  CONSTRAINT CK_BESTID_DEL_YN CHECK (DEL_YN IN ('Y','N'))
);
COMMENT ON TABLE  TPRMPP_BESTID                   IS '소요예산 산정 상세(팀별 산정)';
COMMENT ON COLUMN TPRMPP_BESTID.RQM_BG_REQ_DOC_NO IS '소요예산요청문서번호';
COMMENT ON COLUMN TPRMPP_BESTID.DOC_VRS_SNO       IS '문서버전일련번호';
COMMENT ON COLUMN TPRMPP_BESTID.SVN_TEM_C         IS '담당팀코드';
COMMENT ON COLUMN TPRMPP_BESTID.IOE_C             IS '비목코드';
COMMENT ON COLUMN TPRMPP_BESTID.RQM_BG_AMT        IS '소요예산금액';
COMMENT ON COLUMN TPRMPP_BESTID.OPNN_CONE         IS '의견내용';

-- 3) 변경로그 (BaseLogEntity 스냅샷)
CREATE TABLE TPRMPP_BESTIL (
  LOG_HIS_TGR_SNO   NUMBER(18,0) NOT NULL,
  CHG_DTT_YN        VARCHAR2(1 CHAR),
  CHG_DTM           TIMESTAMP(9),
  CHG_USID          VARCHAR2(14 CHAR),
  DEL_YN            VARCHAR2(1 CHAR),
  GUID              VARCHAR2(38 CHAR),
  GUID_PRG_SNO      NUMBER(4,0),
  FST_ENR_DTM       DATE,
  FST_ENR_USID      VARCHAR2(14 CHAR),
  LST_CHG_DTM       DATE,
  LST_CHG_USID      VARCHAR2(14 CHAR),
  RQM_BG_REQ_DOC_NO VARCHAR2(30 CHAR),
  DOC_VRS_SNO       NUMBER(9,0),
  LST_YN            VARCHAR2(1 CHAR),
  BG_PRN_TC         VARCHAR2(3 CHAR),
  CNCD_RFR_NO       VARCHAR2(30 CHAR),
  IT_PTL_STS_TC     VARCHAR2(2 CHAR),
  REQ_CONE          VARCHAR2(300 CHAR),
  CONSTRAINT PK_TPRMPP_BESTIL PRIMARY KEY (LOG_HIS_TGR_SNO)
);
COMMENT ON TABLE TPRMPP_BESTIL IS '소요예산 산정 기본 변경 로그';

CREATE TABLE TPRMPP_BESTIDL (
  LOG_HIS_TGR_SNO   NUMBER(18,0) NOT NULL,
  CHG_DTT_YN        VARCHAR2(1 CHAR),
  CHG_DTM           TIMESTAMP(9),
  CHG_USID          VARCHAR2(14 CHAR),
  DEL_YN            VARCHAR2(1 CHAR),
  GUID              VARCHAR2(38 CHAR),
  GUID_PRG_SNO      NUMBER(4,0),
  FST_ENR_DTM       DATE,
  FST_ENR_USID      VARCHAR2(14 CHAR),
  LST_CHG_DTM       DATE,
  LST_CHG_USID      VARCHAR2(14 CHAR),
  RQM_BG_REQ_DOC_NO VARCHAR2(30 CHAR),
  DOC_VRS_SNO       NUMBER(9,0),
  SVN_TEM_C         VARCHAR2(5 CHAR),
  IOE_C             VARCHAR2(7 CHAR),
  RQM_BG_AMT        NUMBER(18,0),
  OPNN_CONE         VARCHAR2(1000 CHAR),
  CONSTRAINT PK_TPRMPP_BESTIDL PRIMARY KEY (LOG_HIS_TGR_SNO)
);
COMMENT ON TABLE TPRMPP_BESTIDL IS '소요예산 산정 상세 변경 로그';

-- 4) 시퀀스 (문서번호 채번 + 로그 PK)
CREATE SEQUENCE SEQ_BESTIM  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;  -- 문서번호 4자리 채번
CREATE SEQUENCE SEQ_BESTIL  START WITH 1 INCREMENT BY 1 CACHE 20 NOCYCLE;  -- 마스터 로그 PK
CREATE SEQUENCE SEQ_BESTIDL START WITH 1 INCREMENT BY 1 CACHE 20 NOCYCLE;  -- 명세 로그 PK
```

- [ ] **Step 2: 실행**

`connect-db.ps1`로 접속 후 위 스크립트 실행. 또는 기존 마이그레이션과 동일 절차.

- [ ] **Step 3: 검증**

DB 접속 후: `SELECT table_name FROM user_tables WHERE table_name IN ('TPRMPP_BESTIM','TPRMPP_BESTID','TPRMPP_BESTIL','TPRMPP_BESTIDL');`
Expected: 4행. 그리고 `SELECT sequence_name FROM user_sequences WHERE sequence_name IN ('SEQ_BESTIM','SEQ_BESTIL','SEQ_BESTIDL');` → 3행.

- [ ] **Step 4: 커밋**

```bash
git add it_database/migrations/V20260607_002__CreateEstimateTables.sql
git commit -m "feat(db): 소요예산 산정 테이블/로그/시퀀스 생성(BESTIM/BESTID/BESTIL/BESTIDL)"
```

---

### Task 3: 마스터 엔티티 `Bestim` + `BestimId` + 로그 `BestimL`

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/entity/BestimId.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/entity/Bestim.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BestimL.java`

- [ ] **Step 1: 복합키 클래스 작성**

```java
package com.kdb.it.domain.estimate.entity;

import jakarta.persistence.Column;
import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 소요예산 산정 마스터(Bestim) 복합 기본키. (문서번호 + 문서버전일련번호) */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BestimId implements Serializable {

    /** 소요예산요청문서번호: Bestim.rqmBgReqDocNo와 이름/타입 일치 필수 */
    @Column(name = "RQM_BG_REQ_DOC_NO", comment = "소요예산요청문서번호")
    private String rqmBgReqDocNo;

    /** 문서버전일련번호: Bestim.docVrsSno와 이름/타입 일치 필수 */
    @Column(name = "DOC_VRS_SNO", comment = "문서버전일련번호")
    private Integer docVrsSno;
}
```

- [ ] **Step 2: 마스터 엔티티 작성**

```java
package com.kdb.it.domain.estimate.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.BestimL;
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

/**
 * 소요예산 산정 기본(마스터) 엔티티.
 *
 * <p>DB 테이블: {@code TPRMPP_BESTIM}. 정보화사업(BPROJM)에 대한 소요예산 산정 요청을 관리한다.</p>
 * <p>대상은 사업 고정: {@code BG_PRN_TC='100'}, {@code CNCD_RFR_NO}=사업 관리번호(ABUS_MNG_NO).</p>
 * <p>상태(IT_PTL_STS_TC): 41(작성중) → 42(진행중) → 49(완료).</p>
 */
@LogTarget(entity = BestimL.class)
@Entity
@Table(name = "TPRMPP_BESTIM", comment = "소요예산 산정 기본")
@IdClass(BestimId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Bestim extends BaseEntity {

    /** 소요예산요청문서번호: PK1 (예: REQ-2026-0001) */
    @Id
    @Column(name = "RQM_BG_REQ_DOC_NO", length = 30, nullable = false, comment = "소요예산요청문서번호")
    private String rqmBgReqDocNo;

    /** 문서버전일련번호: PK2 (1부터) */
    @Id
    @Column(name = "DOC_VRS_SNO", nullable = false, comment = "문서버전일련번호")
    private Integer docVrsSno;

    /** 최종여부: 'Y'=현재버전 */
    @Column(name = "LST_YN", length = 1, comment = "최종여부")
    private String lstYn;

    /** 예산성격구분코드(대상구분): 소요예산은 '100'(정보화사업) 고정 */
    @Column(name = "BG_PRN_TC", length = 3, nullable = false, comment = "예산성격구분코드(대상구분)")
    private String bgPrnTc;

    /** 관련참조번호(대상관리번호): 사업 ABUS_MNG_NO 값 */
    @Column(name = "CNCD_RFR_NO", length = 30, nullable = false, comment = "관련참조번호(대상관리번호)")
    private String cncdRfrNo;

    /** IT포탈상태구분코드: 41/42/49 */
    @Column(name = "IT_PTL_STS_TC", length = 2, nullable = false, comment = "IT포탈상태구분코드")
    private String stsTc;

    /** 요청내용 */
    @Column(name = "REQ_CONE", length = 300, comment = "요청내용")
    private String reqCone;

    /** 요청내용 수정 (작성중 상태에서만 서비스가 호출) */
    public void updateRequest(String reqCone) {
        this.reqCone = reqCone;
    }

    /** 상태 전이 (서비스의 changeStatus에서만 호출) */
    public void changeStatus(String stsTc) {
        this.stsTc = stsTc;
    }
}
```

- [ ] **Step 3: 로그 엔티티 작성** (테이블 `TPRMPP_BESTIL` → 시퀀스 `SEQ_BESTIL`)

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

/** 소요예산 산정 기본(TPRMPP_BESTIM) 변경 로그. */
@Entity
@Table(name = "TPRMPP_BESTIL", comment = "소요예산 산정 기본 변경 로그")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class BestimL extends BaseLogEntity {

    @Column(name = "RQM_BG_REQ_DOC_NO", length = 30, comment = "소요예산요청문서번호")
    private String rqmBgReqDocNo;

    @Column(name = "DOC_VRS_SNO", comment = "문서버전일련번호")
    private Integer docVrsSno;

    @Column(name = "LST_YN", length = 1, comment = "최종여부")
    private String lstYn;

    @Column(name = "BG_PRN_TC", length = 3, comment = "예산성격구분코드(대상구분)")
    private String bgPrnTc;

    @Column(name = "CNCD_RFR_NO", length = 30, comment = "관련참조번호(대상관리번호)")
    private String cncdRfrNo;

    @Column(name = "IT_PTL_STS_TC", length = 2, comment = "IT포탈상태구분코드")
    private String stsTc;

    @Column(name = "REQ_CONE", length = 300, comment = "요청내용")
    private String reqCone;
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/estimate/entity/Bestim.java it_backend/src/main/java/com/kdb/it/domain/estimate/entity/BestimId.java it_backend/src/main/java/com/kdb/it/domain/log/entity/BestimL.java
git commit -m "feat(estimate): 소요예산 산정 마스터 엔티티/복합키/변경로그 추가"
```

---

### Task 4: 명세 엔티티 `Bestid` + `BestidId` + 로그 `BestidL`

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/entity/BestidId.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/entity/Bestid.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BestidL.java`

- [ ] **Step 1: 복합키 클래스 작성**

```java
package com.kdb.it.domain.estimate.entity;

import jakarta.persistence.Column;
import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 소요예산 산정 명세(Bestid) 복합 기본키. (문서번호 + 버전 + 팀 + 비목) */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BestidId implements Serializable {

    @Column(name = "RQM_BG_REQ_DOC_NO", comment = "소요예산요청문서번호")
    private String rqmBgReqDocNo;

    @Column(name = "DOC_VRS_SNO", comment = "문서버전일련번호")
    private Integer docVrsSno;

    @Column(name = "SVN_TEM_C", comment = "담당팀코드")
    private String svnTemC;

    @Column(name = "IOE_C", comment = "비목코드")
    private String ioeC;
}
```

- [ ] **Step 2: 명세 엔티티 작성**

```java
package com.kdb.it.domain.estimate.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.BestidL;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * 소요예산 산정 상세(명세) 엔티티 — 팀별·비목별 소요예산금액.
 *
 * <p>DB 테이블: {@code TPRMPP_BESTID}. 마스터(Bestim) 1건에 (담당팀 × 비목) N행.</p>
 */
@LogTarget(entity = BestidL.class)
@Entity
@Table(name = "TPRMPP_BESTID", comment = "소요예산 산정 상세(팀별 산정)")
@IdClass(BestidId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Bestid extends BaseEntity {

    @Id
    @Column(name = "RQM_BG_REQ_DOC_NO", length = 30, nullable = false, comment = "소요예산요청문서번호")
    private String rqmBgReqDocNo;

    @Id
    @Column(name = "DOC_VRS_SNO", nullable = false, comment = "문서버전일련번호")
    private Integer docVrsSno;

    @Id
    @Column(name = "SVN_TEM_C", length = 5, nullable = false, comment = "담당팀코드")
    private String svnTemC;

    @Id
    @Column(name = "IOE_C", length = 7, nullable = false, comment = "비목코드")
    private String ioeC;

    /** 소요예산금액 */
    @Column(name = "RQM_BG_AMT", precision = 18, comment = "소요예산금액")
    private BigDecimal rqmBgAmt;

    /** 의견내용 */
    @Column(name = "OPNN_CONE", length = 1000, comment = "의견내용")
    private String opnnCone;

    /** 산정 금액/의견 수정 (작업자가 진행중 상태에서 호출) */
    public void updateEstimate(BigDecimal rqmBgAmt, String opnnCone) {
        this.rqmBgAmt = rqmBgAmt;
        this.opnnCone = opnnCone;
    }
}
```

- [ ] **Step 3: 로그 엔티티 작성** (테이블 `TPRMPP_BESTIDL` → 시퀀스 `SEQ_BESTIDL`)

```java
package com.kdb.it.domain.log.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/** 소요예산 산정 상세(TPRMPP_BESTID) 변경 로그. */
@Entity
@Table(name = "TPRMPP_BESTIDL", comment = "소요예산 산정 상세 변경 로그")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class BestidL extends BaseLogEntity {

    @Column(name = "RQM_BG_REQ_DOC_NO", length = 30, comment = "소요예산요청문서번호")
    private String rqmBgReqDocNo;

    @Column(name = "DOC_VRS_SNO", comment = "문서버전일련번호")
    private Integer docVrsSno;

    @Column(name = "SVN_TEM_C", length = 5, comment = "담당팀코드")
    private String svnTemC;

    @Column(name = "IOE_C", length = 7, comment = "비목코드")
    private String ioeC;

    @Column(name = "RQM_BG_AMT", precision = 18, comment = "소요예산금액")
    private BigDecimal rqmBgAmt;

    @Column(name = "OPNN_CONE", length = 1000, comment = "의견내용")
    private String opnnCone;
}
```

- [ ] **Step 4: 부팅 검증 (validate 스키마 일치)**

Run: `cd it_backend && ./gradlew compileJava test --tests "*ApplicationTests*"` (컨텍스트 로드 테스트가 없으면 `./gradlew bootRun` 짧게 기동 후 종료)
Expected: 스키마 validate 통과(엔티티↔테이블 컬럼 일치). 실패 시 Hibernate가 불일치 컬럼/타입을 명시 → 해당 DDL 또는 엔티티 타입을 일치하도록 수정(특히 `DATE`↔`LocalDateTime`, `TIMESTAMP(9)`↔`CHG_DTM` 정합).

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/estimate/entity/Bestid.java it_backend/src/main/java/com/kdb/it/domain/estimate/entity/BestidId.java it_backend/src/main/java/com/kdb/it/domain/log/entity/BestidL.java
git commit -m "feat(estimate): 소요예산 산정 명세 엔티티/복합키/변경로그 추가"
```

---

### Task 5: DTO `EstimateDto`

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/dto/EstimateDto.java`

- [ ] **Step 1: DTO 작성** (정적 중첩 record + `@Schema`)

```java
package com.kdb.it.domain.estimate.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/** 소요예산 산정 API 요청/응답 DTO 모음. */
public final class EstimateDto {

    private EstimateDto() {}

    @Schema(name = "EstimateCreateRequest", description = "소요예산 산정 신규 신청 요청")
    public record CreateRequest(
            @NotBlank @Size(max = 30) String cncdRfrNo,   // 대상 사업 관리번호(ABUS_MNG_NO)
            @Size(max = 300) String reqCone
    ) {}

    @Schema(name = "EstimateUpdateRequest", description = "소요예산 산정 마스터 수정 요청(작성중)")
    public record UpdateRequest(
            @Size(max = 300) String reqCone
    ) {}

    @Schema(name = "EstimateStatusRequest", description = "소요예산 산정 상태 전이 요청")
    public record StatusRequest(
            @NotBlank @Size(max = 2) String stsTc   // 42(제출) 또는 49(완료)
    ) {}

    @Schema(name = "EstimateLineRequest", description = "팀별 산정 명세 1행")
    public record LineRequest(
            @NotBlank @Size(max = 5) String svnTemC,
            @NotBlank @Size(max = 7) String ioeC,
            @NotNull BigDecimal rqmBgAmt,
            @Size(max = 1000) String opnnCone
    ) {}

    @Schema(name = "EstimateLinesRequest", description = "팀별 산정 명세 일괄 저장 요청(진행중)")
    public record LinesRequest(
            @NotNull List<LineRequest> lines
    ) {}

    @Schema(name = "EstimateListItem", description = "소요예산 산정 목록 항목")
    public record ListItem(
            String rqmBgReqDocNo,
            Integer docVrsSno,
            String bgPrnTc,
            String cncdRfrNo,
            String abusNm,        // 대상 사업명(조인)
            String stsTc,
            String reqUsid,       // 요청자(FST_ENR_USID)
            java.time.LocalDateTime reqDtm   // 요청일시(FST_ENR_DTM)
    ) {}

    @Schema(name = "EstimateLine", description = "팀별 산정 명세 응답")
    public record Line(
            String svnTemC,
            String ioeC,
            BigDecimal rqmBgAmt,
            String opnnCone
    ) {}

    @Schema(name = "EstimateDetail", description = "소요예산 산정 상세")
    public record Detail(
            String rqmBgReqDocNo,
            Integer docVrsSno,
            String bgPrnTc,
            String cncdRfrNo,
            String abusNm,
            String stsTc,
            String reqCone,
            String reqUsid,
            java.time.LocalDateTime reqDtm,
            List<Line> lines
    ) {}
}
```

- [ ] **Step 2: 컴파일 + 커밋**

Run: `cd it_backend && ./gradlew compileJava` → SUCCESSFUL.

```bash
git add it_backend/src/main/java/com/kdb/it/domain/estimate/dto/EstimateDto.java
git commit -m "feat(estimate): 소요예산 산정 DTO(record) 추가"
```

---

### Task 6: Repository (`EstimateRepository` + Custom + Impl + LineRepository) + 테스트

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/repository/EstimateRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/repository/EstimateRepositoryCustom.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/repository/EstimateRepositoryImpl.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/repository/EstimateLineRepository.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/estimate/repository/EstimateRepositoryTest.java`

- [ ] **Step 1: 실패하는 테스트 작성** (`@DataJpaTest`로 저장/현재버전 조회)

```java
package com.kdb.it.domain.estimate.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.estimate.entity.Bestim;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

@DataJpaTest
@Import(com.kdb.it.config.QueryDslConfig.class)
class EstimateRepositoryTest {

    @Autowired EstimateRepository repository;

    @Test
    @DisplayName("현재버전(LST_YN=Y, DEL_YN=N) 마스터를 문서번호로 조회한다")
    void findCurrentByDocNo_returnsActive() {
        Bestim saved = repository.save(Bestim.builder()
                .rqmBgReqDocNo("REQ-2026-0001").docVrsSno(1)
                .lstYn("Y").bgPrnTc("100").cncdRfrNo("PRJ-2026-0001")
                .stsTc("41").reqCone("산정 요청합니다").build());

        var found = repository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N");

        assertThat(found).isPresent();
        assertThat(found.get().getStsTc()).isEqualTo("41");
        assertThat(saved.getDocVrsSno()).isEqualTo(1);
    }
}
```

> `@Import` 대상(`QueryDslConfig`)은 기존 QueryDSL 설정 클래스명에 맞춘다. 기존 `*RepositoryTest`가 사용하는 동일 설정 import 방식을 따른다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateRepositoryTest*"`
Expected: 컴파일 실패 (`EstimateRepository` 미존재).

- [ ] **Step 3: Repository 인터페이스/구현 작성**

`EstimateRepository.java`:
```java
package com.kdb.it.domain.estimate.repository;

import com.kdb.it.domain.estimate.entity.Bestim;
import com.kdb.it.domain.estimate.entity.BestimId;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EstimateRepository extends JpaRepository<Bestim, BestimId>, EstimateRepositoryCustom {

    Optional<Bestim> findByRqmBgReqDocNoAndLstYnAndDelYn(String rqmBgReqDocNo, String lstYn, String delYn);

    /** 문서번호 채번용 시퀀스 next value */
    @Query(nativeQuery = true, value = "SELECT SEQ_BESTIM.NEXTVAL FROM DUAL")
    Long nextDocSeq();

    /** 동일 대상에 진행중(작성중/진행중) 문서 존재 여부 (중복 신청 방지) */
    boolean existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(
            String bgPrnTc, String cncdRfrNo, java.util.Collection<String> stsTc, String delYn);
}
```

`EstimateRepositoryCustom.java`:
```java
package com.kdb.it.domain.estimate.repository;

import com.kdb.it.domain.estimate.dto.EstimateDto;
import java.util.List;

public interface EstimateRepositoryCustom {
    /**
     * 소요예산 산정 목록 조회.
     * @param stsTc 상태 필터(null이면 전체)
     * @param cncdRfrNo 대상 사업 관리번호 필터(null이면 전체)
     * @param bbrC 부서 필터(null/빈값이면 전체 — 관리자·미동기화 계정)
     */
    List<EstimateDto.ListItem> search(String stsTc, String cncdRfrNo, String bbrC);
}
```

`EstimateRepositoryImpl.java` (QueryDSL + 사업명 조인. `Bprojm` 현재버전 사업명/주관부서 조인):
```java
package com.kdb.it.domain.estimate.repository;

import com.kdb.it.domain.budget.project.entity.QBprojm;
import com.kdb.it.domain.estimate.dto.EstimateDto;
import com.kdb.it.domain.estimate.entity.QBestim;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;

@RequiredArgsConstructor
public class EstimateRepositoryImpl implements EstimateRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<EstimateDto.ListItem> search(String stsTc, String cncdRfrNo, String bbrC) {
        QBestim e = QBestim.bestim;
        QBprojm p = QBprojm.bprojm;

        BooleanBuilder where = new BooleanBuilder();
        where.and(e.delYn.eq("N"));
        where.and(e.lstYn.eq("Y"));
        if (StringUtils.hasText(stsTc))     where.and(e.stsTc.eq(stsTc));
        if (StringUtils.hasText(cncdRfrNo)) where.and(e.cncdRfrNo.eq(cncdRfrNo));
        // 부서 필터: 대상 사업의 주관부서(SVN_DPM_C) 기준
        if (StringUtils.hasText(bbrC))      where.and(p.svnDpmC.eq(bbrC));

        return queryFactory
                .select(Projections.constructor(EstimateDto.ListItem.class,
                        e.rqmBgReqDocNo, e.docVrsSno, e.bgPrnTc, e.cncdRfrNo,
                        p.abusNm, e.stsTc, e.fstEnrUsid, e.fstEnrDtm))
                .from(e)
                .leftJoin(p).on(p.abusMngNo.eq(e.cncdRfrNo).and(p.lstYn.eq("Y")))
                .where(where)
                .orderBy(e.fstEnrDtm.desc())
                .fetch();
    }
}
```

`EstimateLineRepository.java`:
```java
package com.kdb.it.domain.estimate.repository;

import com.kdb.it.domain.estimate.entity.Bestid;
import com.kdb.it.domain.estimate.entity.BestidId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EstimateLineRepository extends JpaRepository<Bestid, BestidId> {

    List<Bestid> findByRqmBgReqDocNoAndDocVrsSnoAndDelYn(String rqmBgReqDocNo, Integer docVrsSno, String delYn);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateRepositoryTest*"`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/estimate/repository/ it_backend/src/test/java/com/kdb/it/domain/estimate/repository/EstimateRepositoryTest.java
git commit -m "feat(estimate): 소요예산 산정 Repository(QueryDSL 목록/현재버전/채번) + 테스트"
```

> 참고: `QBestim`/`QBprojm`는 QueryDSL APT가 컴파일 시 자동 생성한다. `Bprojm`에 `svnDpmC`/`abusNm`/`abusMngNo`/`lstYn` 필드가 존재함은 `Bprojm.java`에서 확인됨.

---

### Task 7: Service — 신규 신청 생성 (TDD)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java` (대상 검증 메서드 추가)
- Test: `it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java`

상태 상수: 작성중=`41`, 진행중=`42`, 완료=`49`. 대상구분 사업=`100`.

- [ ] **Step 1: 실패하는 테스트 작성** (Mockito 단위)

```java
package com.kdb.it.domain.estimate.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.estimate.dto.EstimateDto;
import com.kdb.it.domain.estimate.entity.Bestim;
import com.kdb.it.domain.estimate.repository.EstimateLineRepository;
import com.kdb.it.domain.estimate.repository.EstimateRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EstimateServiceTest {

    @Mock EstimateRepository estimateRepository;
    @Mock EstimateLineRepository lineRepository;
    @Mock ProjectRepository projectRepository;

    EstimateService service;

    CustomUserDetails requester() { return new CustomUserDetails("E0001", List.of("ITPZZ001"), "18001"); }

    @BeforeEach
    void setUp() {
        service = new EstimateService(estimateRepository, lineRepository, projectRepository);
    }

    @Test
    @DisplayName("신규 신청 생성 시 문서번호를 채번하고 상태 41, 대상구분 100으로 저장한다")
    void create_assignsDocNoAndStatus41() {
        when(projectRepository.existsByAbusMngNoAndLstYnAndDelYn("PRJ-2026-0001", "Y", "N")).thenReturn(true);
        when(estimateRepository.existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(anyString(), anyString(), any(), anyString())).thenReturn(false);
        when(estimateRepository.nextDocSeq()).thenReturn(1L);
        when(estimateRepository.save(any(Bestim.class))).thenAnswer(inv -> inv.getArgument(0));

        String docNo = service.create(new EstimateDto.CreateRequest("PRJ-2026-0001", "요청합니다"), requester());

        assertThat(docNo).isEqualTo("REQ-2026-0001");
    }

    @Test
    @DisplayName("대상 사업이 없으면 신규 신청을 거부한다")
    void create_rejectsWhenTargetMissing() {
        when(projectRepository.existsByAbusMngNoAndLstYnAndDelYn("PRJ-X", "Y", "N")).thenReturn(false);

        assertThatThrownBy(() -> service.create(new EstimateDto.CreateRequest("PRJ-X", null), requester()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("대상");
    }

    @Test
    @DisplayName("동일 대상에 진행중 문서가 있으면 신규 신청을 거부한다")
    void create_rejectsDuplicate() {
        when(projectRepository.existsByAbusMngNoAndLstYnAndDelYn("PRJ-2026-0001", "Y", "N")).thenReturn(true);
        when(estimateRepository.existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(anyString(), anyString(), any(), anyString())).thenReturn(true);

        assertThatThrownBy(() -> service.create(new EstimateDto.CreateRequest("PRJ-2026-0001", null), requester()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("진행 중");
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateServiceTest*"`
Expected: 컴파일 실패(`EstimateService`/`ProjectRepository.existsBy...` 미존재).

- [ ] **Step 3: 의존 메서드 보강 + 서비스 작성**

`ProjectRepository.java`에 대상 검증 메서드가 없으면 추가:
```java
boolean existsByAbusMngNoAndLstYnAndDelYn(String abusMngNo, String lstYn, String delYn);
```

`EstimateService.java`:
```java
package com.kdb.it.domain.estimate.service;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.estimate.dto.EstimateDto;
import com.kdb.it.domain.estimate.entity.Bestid;
import com.kdb.it.domain.estimate.entity.Bestim;
import com.kdb.it.domain.estimate.repository.EstimateLineRepository;
import com.kdb.it.domain.estimate.repository.EstimateRepository;
import java.time.Year;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소요예산 산정 서비스.
 *
 * <p>상태: 41(작성중) → 42(진행중) → 49(완료). 대상구분 100=정보화사업.</p>
 * <p>쓰기 주체: 작성중=신청자/부서, 진행중 작업=작업자(부서담당자/관리자). 상태 전이는 인접만 허용.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EstimateService {

    static final String STS_DRAFT = "41";
    static final String STS_IN_PROGRESS = "42";
    static final String STS_DONE = "49";
    static final String TGT_PROJECT = "100";

    private final EstimateRepository estimateRepository;
    private final EstimateLineRepository lineRepository;
    private final ProjectRepository projectRepository;

    /**
     * 소요예산 산정 신규 신청 생성.
     * @return 채번된 문서번호 (REQ-{YYYY}-{4자리})
     * @throws IllegalArgumentException 대상 사업 미존재
     * @throws IllegalStateException 동일 대상에 진행 중(41/42) 문서 존재
     */
    @Transactional
    public String create(EstimateDto.CreateRequest req, CustomUserDetails user) {
        if (!projectRepository.existsByAbusMngNoAndLstYnAndDelYn(req.cncdRfrNo(), "Y", "N")) {
            throw new IllegalArgumentException("대상 사업을 찾을 수 없습니다: " + req.cncdRfrNo());
        }
        if (estimateRepository.existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(
                TGT_PROJECT, req.cncdRfrNo(), List.of(STS_DRAFT, STS_IN_PROGRESS), "N")) {
            throw new IllegalStateException("해당 사업에 진행 중인 소요예산 산정이 이미 있습니다.");
        }
        String docNo = generateDocNo();
        Bestim entity = Bestim.builder()
                .rqmBgReqDocNo(docNo).docVrsSno(1).lstYn("Y")
                .bgPrnTc(TGT_PROJECT).cncdRfrNo(req.cncdRfrNo())
                .stsTc(STS_DRAFT).reqCone(req.reqCone())
                .build();
        estimateRepository.save(entity);
        return docNo;
    }

    private String generateDocNo() {
        long seq = estimateRepository.nextDocSeq();
        return String.format("REQ-%d-%04d", Year.now().getValue(), seq);
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateServiceTest*"`
Expected: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java
git commit -m "feat(estimate): 신규 신청 생성(채번/대상검증/중복방지) + 테스트"
```

---

### Task 8: Service — 상태 전이 / 마스터 수정 / 삭제 (TDD)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 추가**

```java
    @Test
    @DisplayName("작성중(41)→진행중(42) 제출 전이를 허용한다")
    void changeStatus_submitAllowed() {
        Bestim e = Bestim.builder().rqmBgReqDocNo("REQ-2026-0001").docVrsSno(1)
                .lstYn("Y").bgPrnTc("100").cncdRfrNo("PRJ-2026-0001").stsTc("41").build();
        when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                .thenReturn(Optional.of(e));

        service.changeStatus("REQ-2026-0001", new EstimateDto.StatusRequest("42"), requester());

        assertThat(e.getStsTc()).isEqualTo("42");
    }

    @Test
    @DisplayName("완료(49)에서 다른 상태로의 역행 전이를 거부한다")
    void changeStatus_rejectsBackward() {
        Bestim e = Bestim.builder().rqmBgReqDocNo("REQ-2026-0001").docVrsSno(1)
                .lstYn("Y").bgPrnTc("100").cncdRfrNo("PRJ-2026-0001").stsTc("49").build();
        when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                .thenReturn(Optional.of(e));

        assertThatThrownBy(() -> service.changeStatus("REQ-2026-0001", new EstimateDto.StatusRequest("42"), requester()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("작성중이 아닐 때 마스터 수정을 거부한다")
    void update_rejectsWhenNotDraft() {
        Bestim e = Bestim.builder().rqmBgReqDocNo("REQ-2026-0001").docVrsSno(1)
                .lstYn("Y").bgPrnTc("100").cncdRfrNo("PRJ-2026-0001").stsTc("42").build();
        when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                .thenReturn(Optional.of(e));

        assertThatThrownBy(() -> service.update("REQ-2026-0001", new EstimateDto.UpdateRequest("x"), requester()))
                .isInstanceOf(IllegalStateException.class);
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateServiceTest*"`
Expected: 컴파일 실패 (`changeStatus`/`update` 미존재).

- [ ] **Step 3: 서비스 메서드 추가**

`EstimateService.java`에 추가:
```java
    /** 마스터 수정 (작성중에서만). */
    @Transactional
    public void update(String docNo, EstimateDto.UpdateRequest req, CustomUserDetails user) {
        Bestim e = loadCurrent(docNo);
        if (!STS_DRAFT.equals(e.getStsTc())) {
            throw new IllegalStateException("작성중 상태에서만 수정할 수 있습니다.");
        }
        e.updateRequest(req.reqCone());
    }

    /** soft delete (작성중에서만). */
    @Transactional
    public void delete(String docNo, CustomUserDetails user) {
        Bestim e = loadCurrent(docNo);
        if (!STS_DRAFT.equals(e.getStsTc())) {
            throw new IllegalStateException("작성중 상태에서만 삭제할 수 있습니다.");
        }
        e.delete();
    }

    /** 상태 전이 (인접 전이만 허용: 41→42, 42→49). */
    @Transactional
    public void changeStatus(String docNo, EstimateDto.StatusRequest req, CustomUserDetails user) {
        Bestim e = loadCurrent(docNo);
        String from = e.getStsTc();
        String to = req.stsTc();
        boolean ok = (STS_DRAFT.equals(from) && STS_IN_PROGRESS.equals(to))
                || (STS_IN_PROGRESS.equals(from) && STS_DONE.equals(to));
        if (!ok) {
            throw new IllegalStateException("허용되지 않은 상태 전이입니다: " + from + " → " + to);
        }
        e.changeStatus(to);
    }

    Bestim loadCurrent(String docNo) {
        return estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn(docNo, "Y", "N")
                .orElseThrow(() -> new IllegalArgumentException("소요예산 산정 문서를 찾을 수 없습니다: " + docNo));
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateServiceTest*"`
Expected: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java
git commit -m "feat(estimate): 상태 전이/마스터 수정/삭제(작성중 한정) + 테스트"
```

---

### Task 9: Service — 조회(상세/목록) + 팀별 산정 명세 저장 (TDD)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java`

- [ ] **Step 1: 실패하는 테스트 추가** (명세 저장: 진행중에서만, upsert + 누락행 soft delete)

```java
    @Test
    @DisplayName("진행중(42)에서 팀별 산정행을 저장한다 — 신규행 추가, 요청에 없는 기존행 soft delete")
    void saveLines_upsertAndSoftDeleteMissing() {
        Bestim e = Bestim.builder().rqmBgReqDocNo("REQ-2026-0001").docVrsSno(1)
                .lstYn("Y").bgPrnTc("100").cncdRfrNo("PRJ-2026-0001").stsTc("42").build();
        when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                .thenReturn(Optional.of(e));
        Bestid existing = Bestid.builder().rqmBgReqDocNo("REQ-2026-0001").docVrsSno(1)
                .svnTemC("12004").ioeC("DEV").rqmBgAmt(new java.math.BigDecimal("100")).build();
        when(lineRepository.findByRqmBgReqDocNoAndDocVrsSnoAndDelYn("REQ-2026-0001", 1, "N"))
                .thenReturn(new java.util.ArrayList<>(List.of(existing)));

        var lines = List.of(new EstimateDto.LineRequest("18010", "HW", new java.math.BigDecimal("200"), "HW 산정"));
        service.saveLines("REQ-2026-0001", new EstimateDto.LinesRequest(lines), requester());

        // 기존행(12004/DEV)은 요청에 없으므로 soft delete
        assertThat(existing.getDelYn()).isEqualTo("Y");
    }

    @Test
    @DisplayName("진행중이 아닐 때 명세 저장을 거부한다")
    void saveLines_rejectsWhenNotInProgress() {
        Bestim e = Bestim.builder().rqmBgReqDocNo("REQ-2026-0001").docVrsSno(1)
                .lstYn("Y").bgPrnTc("100").cncdRfrNo("PRJ-2026-0001").stsTc("41").build();
        when(estimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn("REQ-2026-0001", "Y", "N"))
                .thenReturn(Optional.of(e));

        assertThatThrownBy(() -> service.saveLines("REQ-2026-0001",
                new EstimateDto.LinesRequest(List.of()), requester()))
                .isInstanceOf(IllegalStateException.class);
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateServiceTest*"`
Expected: 컴파일 실패 (`saveLines` 미존재).

- [ ] **Step 3: 서비스 메서드 추가** (상세/목록/명세 저장; import: `java.util.Map`, `java.util.stream.Collectors`)

`EstimateService.java`에 추가:
```java
    /** 상세 조회 (현재버전 + 명세 목록). */
    public EstimateDto.Detail get(String docNo) {
        Bestim e = loadCurrent(docNo);
        List<EstimateDto.Line> lines = lineRepository
                .findByRqmBgReqDocNoAndDocVrsSnoAndDelYn(docNo, e.getDocVrsSno(), "N")
                .stream()
                .map(l -> new EstimateDto.Line(l.getSvnTemC(), l.getIoeC(), l.getRqmBgAmt(), l.getOpnnCone()))
                .toList();
        return new EstimateDto.Detail(
                e.getRqmBgReqDocNo(), e.getDocVrsSno(), e.getBgPrnTc(), e.getCncdRfrNo(),
                null, e.getStsTc(), e.getReqCone(), e.getFstEnrUsid(), e.getFstEnrDtm(), lines);
    }

    /** 목록 조회 (부서 필터: 관리자는 전체, 그 외 소속 부서). */
    public List<EstimateDto.ListItem> list(String stsTc, String cncdRfrNo, CustomUserDetails user) {
        String bbrC = user.isAdmin() ? null : user.getBbrC();
        return estimateRepository.search(stsTc, cncdRfrNo, bbrC);
    }

    /**
     * 팀별 산정 명세 일괄 저장 (작업자, 진행중 한정).
     * 요청에 포함된 (팀+비목)은 추가/수정, 누락된 기존행은 soft delete. (Bitemm 동기화 패턴)
     */
    @Transactional
    public void saveLines(String docNo, EstimateDto.LinesRequest req, CustomUserDetails user) {
        Bestim e = loadCurrent(docNo);
        if (!STS_IN_PROGRESS.equals(e.getStsTc())) {
            throw new IllegalStateException("진행중 상태에서만 산정 명세를 저장할 수 있습니다.");
        }
        Integer vrs = e.getDocVrsSno();
        List<Bestid> existing = lineRepository.findByRqmBgReqDocNoAndDocVrsSnoAndDelYn(docNo, vrs, "N");
        java.util.Map<String, Bestid> byKey = existing.stream()
                .collect(java.util.stream.Collectors.toMap(b -> b.getSvnTemC() + "|" + b.getIoeC(), b -> b));

        java.util.Set<String> incoming = new java.util.HashSet<>();
        for (EstimateDto.LineRequest line : req.lines()) {
            String key = line.svnTemC() + "|" + line.ioeC();
            incoming.add(key);
            Bestid row = byKey.get(key);
            if (row != null) {
                row.updateEstimate(line.rqmBgAmt(), line.opnnCone());
            } else {
                lineRepository.save(Bestid.builder()
                        .rqmBgReqDocNo(docNo).docVrsSno(vrs)
                        .svnTemC(line.svnTemC()).ioeC(line.ioeC())
                        .rqmBgAmt(line.rqmBgAmt()).opnnCone(line.opnnCone())
                        .build());
            }
        }
        for (Bestid row : existing) {
            if (!incoming.contains(row.getSvnTemC() + "|" + row.getIoeC())) {
                row.delete();
            }
        }
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateServiceTest*"`
Expected: PASS (8 tests).

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java it_backend/src/test/java/com/kdb/it/domain/estimate/service/EstimateServiceTest.java
git commit -m "feat(estimate): 상세/목록 조회 + 팀별 산정 명세 저장(동기화) + 테스트"
```

---

### Task 10: Controller + WebMvc 테스트

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/estimate/controller/EstimateController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/estimate/controller/EstimateControllerTest.java`

- [ ] **Step 1: 실패하는 테스트 작성** (`@WebMvcTest`)

```java
package com.kdb.it.domain.estimate.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kdb.it.domain.estimate.dto.EstimateDto;
import com.kdb.it.domain.estimate.service.EstimateService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(EstimateController.class)
class EstimateControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper om;
    @MockBean EstimateService service;

    @Test
    @WithMockUser
    @DisplayName("POST /api/project/estimates → 201 + 문서번호 반환")
    void create_returns201() throws Exception {
        when(service.create(any(EstimateDto.CreateRequest.class), any())).thenReturn("REQ-2026-0001");

        mvc.perform(post("/api/project/estimates").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(new EstimateDto.CreateRequest("PRJ-2026-0001", "요청"))))
                .andExpect(status().isCreated())
                .andExpect(content().string("REQ-2026-0001"));
    }

    @Test
    @WithMockUser
    @DisplayName("POST .../status → 200, 서비스 위임")
    void changeStatus_returns200() throws Exception {
        mvc.perform(post("/api/project/estimates/REQ-2026-0001/status").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(new EstimateDto.StatusRequest("42"))))
                .andExpect(status().isOk());
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateControllerTest*"`
Expected: 컴파일 실패 (`EstimateController` 미존재).

- [ ] **Step 3: 컨트롤러 작성**

```java
package com.kdb.it.domain.estimate.controller;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.estimate.dto.EstimateDto;
import com.kdb.it.domain.estimate.service.EstimateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 소요예산 산정 API. 인증 필요(클래스 ADMIN 전용 아님), 쓰기 주체/상태전이는 서비스에서 검증. */
@RestController
@RequestMapping("/api/project/estimates")
@RequiredArgsConstructor
@Tag(name = "Estimate", description = "소요예산 산정 API")
public class EstimateController {

    private final EstimateService estimateService;

    @Operation(summary = "소요예산 산정 목록")
    @GetMapping
    public ResponseEntity<List<EstimateDto.ListItem>> list(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "cncdRfrNo", required = false) String cncdRfrNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(estimateService.list(status, cncdRfrNo, user));
    }

    @Operation(summary = "소요예산 산정 상세")
    @GetMapping("/{docNo}")
    public ResponseEntity<EstimateDto.Detail> get(@PathVariable(name = "docNo") String docNo) {
        return ResponseEntity.ok(estimateService.get(docNo));
    }

    @Operation(summary = "소요예산 산정 신규 신청")
    @PostMapping
    public ResponseEntity<String> create(
            @RequestBody @Valid EstimateDto.CreateRequest req,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(estimateService.create(req, user));
    }

    @Operation(summary = "소요예산 산정 마스터 수정(작성중)")
    @PutMapping("/{docNo}")
    public ResponseEntity<Void> update(
            @PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid EstimateDto.UpdateRequest req,
            @AuthenticationPrincipal CustomUserDetails user) {
        estimateService.update(docNo, req, user);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "소요예산 산정 삭제(작성중)")
    @DeleteMapping("/{docNo}")
    public ResponseEntity<Void> delete(
            @PathVariable(name = "docNo") String docNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        estimateService.delete(docNo, user);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "소요예산 산정 상태 전이(제출/완료)")
    @PostMapping("/{docNo}/status")
    public ResponseEntity<Void> changeStatus(
            @PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid EstimateDto.StatusRequest req,
            @AuthenticationPrincipal CustomUserDetails user) {
        estimateService.changeStatus(docNo, req, user);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "팀별 산정 명세 일괄 저장(진행중)")
    @PutMapping("/{docNo}/lines")
    public ResponseEntity<Void> saveLines(
            @PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid EstimateDto.LinesRequest req,
            @AuthenticationPrincipal CustomUserDetails user) {
        estimateService.saveLines(docNo, req, user);
        return ResponseEntity.ok().build();
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "*EstimateControllerTest*"`
Expected: PASS. (`@WebMvcTest` 보안/필터 설정상 `csrf()`/`@WithMockUser` 적용 방식은 기존 `*ControllerTest`와 동일하게 맞춘다.)

- [ ] **Step 5: 전체 백엔드 테스트 + 커밋**

Run: `cd it_backend && ./gradlew test`
Expected: 전체 PASS.

```bash
git add it_backend/src/main/java/com/kdb/it/domain/estimate/controller/EstimateController.java it_backend/src/test/java/com/kdb/it/domain/estimate/controller/EstimateControllerTest.java
git commit -m "feat(estimate): 소요예산 산정 컨트롤러(CRUD/상태/명세) + WebMvc 테스트"
```

---

## Stage ① 프론트엔드

### Task 11: 타입 정의 `types/estimate.ts`

**Files:**
- Create: `it_frontend/app/types/estimate.ts`

- [ ] **Step 1: 타입 작성** (백엔드 DTO 미러)

```typescript
// 소요예산 산정 도메인 타입 — 백엔드 EstimateDto 미러
export interface EstimateListItem {
  rqmBgReqDocNo: string;
  docVrsSno: number;
  bgPrnTc: string;
  cncdRfrNo: string;
  abusNm: string | null;
  stsTc: string;
  reqUsid: string | null;
  reqDtm: string | null;
}

export interface EstimateLine {
  svnTemC: string;
  ioeC: string;
  rqmBgAmt: number | null;
  opnnCone: string | null;
}

export interface EstimateDetail {
  rqmBgReqDocNo: string;
  docVrsSno: number;
  bgPrnTc: string;
  cncdRfrNo: string;
  abusNm: string | null;
  stsTc: string;
  reqCone: string | null;
  reqUsid: string | null;
  reqDtm: string | null;
  lines: EstimateLine[];
}

export interface EstimateCreateRequest {
  cncdRfrNo: string;
  reqCone?: string;
}

export interface EstimateLineRequest {
  svnTemC: string;
  ioeC: string;
  rqmBgAmt: number;
  opnnCone?: string;
}

// 상태 코드 상수
export const ESTIMATE_STATUS = {
  DRAFT: '41',
  IN_PROGRESS: '42',
  DONE: '49',
} as const;

export const ESTIMATE_STATUS_LABEL: Record<string, string> = {
  '41': '작성중',
  '42': '진행중',
  '49': '완료',
};
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd it_frontend && npm run typecheck`
Expected: 통과.

```bash
git add it_frontend/app/types/estimate.ts
git commit -m "feat(estimate): 소요예산 산정 프론트 타입 정의"
```

---

### Task 12: 컴포저블 `composables/useEstimates.ts` + 유닛 테스트

**Files:**
- Create: `it_frontend/app/composables/useEstimates.ts`
- Test: `it_frontend/tests/unit/composables/useEstimates.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성** (URL/메서드 구성 검증)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiFetch = vi.fn();
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://x' } }));
vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: apiFetch }));
vi.stubGlobal('useApiFetch', (url: string) => ({ __url: url }));

import { useEstimates } from '~/composables/useEstimates';

describe('useEstimates', () => {
  beforeEach(() => apiFetch.mockReset());

  it('createEstimate는 /api/project/estimates로 POST한다', async () => {
    apiFetch.mockResolvedValue('REQ-2026-0001');
    const { createEstimate } = useEstimates();
    const docNo = await createEstimate({ cncdRfrNo: 'PRJ-2026-0001', reqCone: 'x' });
    expect(docNo).toBe('REQ-2026-0001');
    expect(apiFetch).toHaveBeenCalledWith(
      'http://x/api/project/estimates',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

> 목킹 방식(`vi.stubGlobal`)은 `tests/unit/composables/` 기존 파일의 스텁 방식과 다르면 그쪽에 맞춘다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_frontend && npm test -- useEstimates`
Expected: FAIL (`useEstimates` 미존재).

- [ ] **Step 3: 컴포저블 작성** (`useProjects` 패턴)

```typescript
import type {
  EstimateListItem, EstimateDetail, EstimateCreateRequest, EstimateLineRequest,
} from '~/types/estimate';

export const useEstimates = () => {
  const config = useRuntimeConfig();
  const API_BASE_URL = `${config.public.apiBase}/api/project/estimates`;
  const { $apiFetch } = useNuxtApp();

  const fetchEstimates = (query?: Record<string, string>) =>
    useApiFetch<EstimateListItem[]>(API_BASE_URL, query ? { query } : {});

  const fetchEstimate = (docNo: string) =>
    useApiFetch<EstimateDetail>(`${API_BASE_URL}/${docNo}`);

  const createEstimate = (body: EstimateCreateRequest) =>
    $apiFetch<string>(API_BASE_URL, { method: 'POST', body });

  const updateEstimate = (docNo: string, body: { reqCone?: string }) =>
    $apiFetch<void>(`${API_BASE_URL}/${docNo}`, { method: 'PUT', body });

  const deleteEstimate = (docNo: string) =>
    $apiFetch<void>(`${API_BASE_URL}/${docNo}`, { method: 'DELETE' });

  const changeStatus = (docNo: string, stsTc: string) =>
    $apiFetch<void>(`${API_BASE_URL}/${docNo}/status`, { method: 'POST', body: { stsTc } });

  const saveLines = (docNo: string, lines: EstimateLineRequest[]) =>
    $apiFetch<void>(`${API_BASE_URL}/${docNo}/lines`, { method: 'PUT', body: { lines } });

  return { fetchEstimates, fetchEstimate, createEstimate, updateEstimate, deleteEstimate, changeStatus, saveLines };
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_frontend && npm test -- useEstimates`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/composables/useEstimates.ts it_frontend/tests/unit/composables/useEstimates.test.ts
git commit -m "feat(estimate): useEstimates 컴포저블 + 유닛 테스트"
```

---

### Task 13: 목록 화면 `pages/project/estimate/index.vue`

**Files:**
- Create: `it_frontend/app/pages/project/estimate/index.vue`

- [ ] **Step 1: 목록 페이지 작성** (`StyledDataTable` + 신규 신청 모달)

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import { useEstimates } from '~/composables/useEstimates';
import { useProjects, type Project } from '~/composables/useProjects';
import { ESTIMATE_STATUS_LABEL } from '~/types/estimate';

definePageMeta({ middleware: 'auth' });

const { fetchEstimates, createEstimate } = useEstimates();
const { data: estimates } = await fetchEstimates();

const showCreate = ref(false);
const { fetchProjects } = useProjects();
const { data: projects } = await fetchProjects({ odnYn: 'N' });
const selectedProject = ref<Project | null>(null);
const reqCone = ref('');
const creating = ref(false);
const toast = useToast();

const statusLabel = (sts: string) => ESTIMATE_STATUS_LABEL[sts] ?? sts;
const rows = computed(() => estimates.value ?? []);

const submitCreate = async () => {
  if (!selectedProject.value) {
    toast.add({ severity: 'warn', summary: '대상 사업을 선택하세요', life: 2000 });
    return;
  }
  creating.value = true;
  try {
    const docNo = await createEstimate({
      cncdRfrNo: selectedProject.value.abusMngNo,
      reqCone: reqCone.value,
    });
    showCreate.value = false;
    await navigateTo(`/project/estimate/${docNo}`);
  } catch (e) {
    toast.add({ severity: 'error', summary: '신청 생성 실패', detail: String(e), life: 3000 });
  } finally {
    creating.value = false;
  }
};
</script>

<template>
  <div class="page">
    <PageHeader title="소요예산 산정">
      <template #actions>
        <Button label="신규 신청" icon="pi pi-plus" @click="showCreate = true" />
      </template>
    </PageHeader>

    <StyledDataTable :value="rows" paginator :rows="20" data-key="rqmBgReqDocNo"
                     sort-field="reqDtm" :sort-order="-1" scrollable scroll-height="flex">
      <Column field="abusNm" header="사업명" sortable>
        <template #body="{ data }">
          <NuxtLink :to="`/project/estimate/${data.rqmBgReqDocNo}`">{{ data.abusNm ?? data.cncdRfrNo }}</NuxtLink>
        </template>
      </Column>
      <Column field="rqmBgReqDocNo" header="문서번호" sortable />
      <Column field="stsTc" header="상태" sortable>
        <template #body="{ data }">{{ statusLabel(data.stsTc) }}</template>
      </Column>
      <Column field="reqUsid" header="요청자" sortable />
      <Column field="reqDtm" header="요청일시" sortable />
    </StyledDataTable>

    <Dialog v-model:visible="showCreate" modal header="소요예산 산정 신규 신청" :style="{ width: '480px' }">
      <div class="form">
        <label>대상 사업</label>
        <Select v-model="selectedProject" :options="projects ?? []" option-label="abusNm"
                placeholder="사업 선택" filter />
        <label>요청내용</label>
        <Textarea v-model="reqCone" rows="3" maxlength="300" />
      </div>
      <template #footer>
        <Button label="취소" text @click="showCreate = false" />
        <Button label="신청" :loading="creating" @click="submitCreate" />
      </template>
    </Dialog>
  </div>
</template>
```

- [ ] **Step 2: 타입체크/린트**

Run: `cd it_frontend && npm run typecheck && npm run lint`
Expected: 통과. (`PageHeader`/`Button`/`Dialog`/`Select`/`Textarea`/`Column`/`useToast`/`navigateTo`는 Nuxt/PrimeVue 자동 import.)

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/app/pages/project/estimate/index.vue
git commit -m "feat(estimate): 소요예산 산정 목록 화면 + 신규 신청 모달"
```

---

### Task 14: 상세 화면 `pages/project/estimate/[docNo].vue` (상태 분기 + 팀 그리드)

**Files:**
- Create: `it_frontend/app/pages/project/estimate/[docNo].vue`

- [ ] **Step 1: 상세 페이지 작성** (작성중=신청 폼, 진행중=팀별 산정 그리드, 완료=읽기전용)

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import { useEstimates } from '~/composables/useEstimates';
import { ESTIMATE_STATUS, ESTIMATE_STATUS_LABEL, type EstimateLine } from '~/types/estimate';

definePageMeta({ middleware: 'auth' });

const route = useRoute();
const toast = useToast();
const docNo = computed(() => String(route.params.docNo ?? ''));
const { fetchEstimate, updateEstimate, deleteEstimate, changeStatus, saveLines } = useEstimates();

const { data: detail, refresh } = await fetchEstimate(docNo.value);

const isDraft = computed(() => detail.value?.stsTc === ESTIMATE_STATUS.DRAFT);
const isInProgress = computed(() => detail.value?.stsTc === ESTIMATE_STATUS.IN_PROGRESS);
const isDone = computed(() => detail.value?.stsTc === ESTIMATE_STATUS.DONE);
const statusLabel = computed(() => ESTIMATE_STATUS_LABEL[detail.value?.stsTc ?? ''] ?? '');

// 작성중: 요청내용 편집
const reqCone = ref(detail.value?.reqCone ?? '');
const busy = ref(false);

const saveDraft = async () => {
  busy.value = true;
  try { await updateEstimate(docNo.value, { reqCone: reqCone.value }); await refresh(); toast.add({ severity: 'success', summary: '저장됨', life: 1500 }); }
  catch (e) { toast.add({ severity: 'error', summary: '저장 실패', detail: String(e), life: 3000 }); }
  finally { busy.value = false; }
};
const submit = async () => {
  busy.value = true;
  try { await changeStatus(docNo.value, ESTIMATE_STATUS.IN_PROGRESS); await refresh(); }
  catch (e) { toast.add({ severity: 'error', summary: '제출 실패', detail: String(e), life: 3000 }); }
  finally { busy.value = false; }
};
const removeDoc = async () => {
  busy.value = true;
  try { await deleteEstimate(docNo.value); await navigateTo('/project/estimate'); }
  catch (e) { toast.add({ severity: 'error', summary: '삭제 실패', detail: String(e), life: 3000 }); }
  finally { busy.value = false; }
};

// 진행중: 팀별 산정 그리드 (편집 가능한 로컬 복사본)
const lines = ref<EstimateLine[]>((detail.value?.lines ?? []).map(l => ({ ...l })));
const addLine = () => lines.value.push({ svnTemC: '', ioeC: '', rqmBgAmt: 0, opnnCone: '' });
const removeLine = (i: number) => lines.value.splice(i, 1);
const totalAmt = computed(() => lines.value.reduce((s, l) => s + (Number(l.rqmBgAmt) || 0), 0));

const saveWork = async () => {
  busy.value = true;
  try {
    await saveLines(docNo.value, lines.value.map(l => ({
      svnTemC: l.svnTemC, ioeC: l.ioeC, rqmBgAmt: Number(l.rqmBgAmt) || 0, opnnCone: l.opnnCone ?? '',
    })));
    await refresh();
    toast.add({ severity: 'success', summary: '산정 저장됨', life: 1500 });
  } catch (e) { toast.add({ severity: 'error', summary: '저장 실패', detail: String(e), life: 3000 }); }
  finally { busy.value = false; }
};
const complete = async () => {
  busy.value = true;
  try { await changeStatus(docNo.value, ESTIMATE_STATUS.DONE); await refresh(); }
  catch (e) { toast.add({ severity: 'error', summary: '완료 실패', detail: String(e), life: 3000 }); }
  finally { busy.value = false; }
};
</script>

<template>
  <div class="page" v-if="detail">
    <PageHeader :title="`소요예산 산정 — ${detail.abusNm ?? detail.cncdRfrNo}`">
      <template #actions>
        <Tag :value="statusLabel" />
      </template>
    </PageHeader>

    <section class="card">
      <div><b>문서번호</b> {{ detail.rqmBgReqDocNo }}</div>
      <div><b>대상 사업</b> {{ detail.abusNm ?? detail.cncdRfrNo }}</div>
    </section>

    <section class="card">
      <h3>요청내용</h3>
      <Textarea v-model="reqCone" rows="3" maxlength="300" :disabled="!isDraft" class="w-full" />
      <div class="actions" v-if="isDraft">
        <Button label="저장" :loading="busy" @click="saveDraft" />
        <Button label="신청 제출" severity="success" :loading="busy" @click="submit" />
        <Button label="삭제" severity="danger" text :loading="busy" @click="removeDoc" />
      </div>
    </section>

    <section class="card" v-if="isInProgress || isDone">
      <h3>팀별 소요예산 산정 <small>합계: {{ totalAmt.toLocaleString() }}</small></h3>
      <StyledDataTable :value="lines" data-key="svnTemC" :cell-selectable="false">
        <Column header="담당팀">
          <template #body="{ data }"><InputText v-model="data.svnTemC" :disabled="isDone" /></template>
        </Column>
        <Column header="비목">
          <template #body="{ data }"><InputText v-model="data.ioeC" :disabled="isDone" /></template>
        </Column>
        <Column header="소요예산금액">
          <template #body="{ data }"><InputNumber v-model="data.rqmBgAmt" :disabled="isDone" :min="0" /></template>
        </Column>
        <Column header="의견">
          <template #body="{ data }"><InputText v-model="data.opnnCone" :disabled="isDone" /></template>
        </Column>
        <Column header="" v-if="isInProgress">
          <template #body="{ index }"><Button icon="pi pi-trash" text severity="danger" @click="removeLine(index)" /></template>
        </Column>
      </StyledDataTable>
      <div class="actions" v-if="isInProgress">
        <Button label="행 추가" icon="pi pi-plus" text @click="addLine" />
        <Button label="산정 저장" :loading="busy" @click="saveWork" />
        <Button label="완료 확정" severity="success" :loading="busy" @click="complete" />
      </div>
    </section>
  </div>
</template>
```

- [ ] **Step 2: 타입체크/린트**

Run: `cd it_frontend && npm run typecheck && npm run lint`
Expected: 통과. (`Tag`/`InputText`/`InputNumber`는 PrimeVue 자동 import.)

- [ ] **Step 3: 커밋**

```bash
git add "it_frontend/app/pages/project/estimate/[docNo].vue"
git commit -m "feat(estimate): 소요예산 산정 상세 화면(상태분기 + 팀별 산정 그리드)"
```

---

### Task 15: 메뉴 노출 (사이드바 시드)

**Files:**
- Create: `it_database/migrations/V20260607_003__SeedEstimateMenu.sql`

- [ ] **Step 1: 기존 메뉴/권한 시드 확인** (값 의존 — 부모 그룹·SRE_TC·권한ID 파악)

Run (DB 접속 후):
```sql
SELECT MNU_ID, HRK_MNU_ID, SRE_TC, MNU_NM, MNU_TP_C, MNU_DEP, WHL_MNU_PTH
FROM TPRMPP_CMENUM WHERE DEL_YN='N' ORDER BY SRE_TC, MNU_SOT_SQN_SNO;
SELECT DISTINCT ATH_ID FROM TPRMPP_CMENUA;
```
결과에서 (a) 새 링크의 부모 그룹 `MNU_ID`(없으면 신규 그룹 생성), (b) `SRE_TC`, (c) 권한 `ATH_ID`(예: `ITPAD001`,`ITPZZ001`,`ITPZZ002`)를 확정한다.

- [ ] **Step 2: 시드 마이그레이션 작성** (라우트 → 메뉴 → 권한). `SRE_TC`는 Step 1 값으로 치환(예시 `'01'`).

```sql
-- V20260607_003__SeedEstimateMenu.sql
-- 소요예산 산정 화면 라우트/메뉴/권한 시드. 멱등: 동일 키 DELETE 후 INSERT.
-- SRE_TC, ATH_ID는 Step1 SELECT 결과로 치환. 부모그룹이 이미 있으면 그룹 신설 대신 그 MNU_ID를 HRK_MNU_ID로 사용.

-- 1) 라우트 카탈로그
DELETE FROM ITPAPP.TPRMPP_CMENUD WHERE SRE_PTH = '/project/estimate';
INSERT INTO ITPAPP.TPRMPP_CMENUD (SRE_PTH, SRE_MNU_NM, SRE_TC, USE_YN, DEL_YN, FST_ENR_USID, FST_ENR_DTM)
VALUES ('/project/estimate', '소요예산 산정', '01', 'Y', 'N', 'MIGRATION', SYSDATE);

-- 2) 메뉴 (그룹 + 링크)
DELETE FROM ITPAPP.TPRMPP_CMENUM WHERE MNU_ID IN ('M_PRJMGT','M_PRJEST');
INSERT INTO ITPAPP.TPRMPP_CMENUM
  (MNU_ID, HRK_MNU_ID, SRE_TC, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO, HID_YN, MNU_DEP, WHL_MNU_PTH, DEL_YN, FST_ENR_USID, FST_ENR_DTM)
VALUES ('M_PRJMGT', NULL, '01', '사업 관리', 'GRP', NULL, 900, 'N', 1, 'M_PRJMGT', 'N', 'MIGRATION', SYSDATE);
INSERT INTO ITPAPP.TPRMPP_CMENUM
  (MNU_ID, HRK_MNU_ID, SRE_TC, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO, HID_YN, MNU_DEP, WHL_MNU_PTH, DEL_YN, FST_ENR_USID, FST_ENR_DTM)
VALUES ('M_PRJEST', 'M_PRJMGT', '01', '소요예산 산정', 'LNK', '/project/estimate', 910, 'N', 2, 'M_PRJMGT>M_PRJEST', 'N', 'MIGRATION', SYSDATE);

-- 3) 권한 매핑
DELETE FROM ITPAPP.TPRMPP_CMENUA WHERE MNU_ID IN ('M_PRJMGT','M_PRJEST');
INSERT INTO ITPAPP.TPRMPP_CMENUA (MNU_ID, ATH_ID, DEL_YN, FST_ENR_USID, FST_ENR_DTM) VALUES ('M_PRJMGT','ITPAD001','N','MIGRATION',SYSDATE);
INSERT INTO ITPAPP.TPRMPP_CMENUA (MNU_ID, ATH_ID, DEL_YN, FST_ENR_USID, FST_ENR_DTM) VALUES ('M_PRJMGT','ITPZZ001','N','MIGRATION',SYSDATE);
INSERT INTO ITPAPP.TPRMPP_CMENUA (MNU_ID, ATH_ID, DEL_YN, FST_ENR_USID, FST_ENR_DTM) VALUES ('M_PRJMGT','ITPZZ002','N','MIGRATION',SYSDATE);
INSERT INTO ITPAPP.TPRMPP_CMENUA (MNU_ID, ATH_ID, DEL_YN, FST_ENR_USID, FST_ENR_DTM) VALUES ('M_PRJEST','ITPAD001','N','MIGRATION',SYSDATE);
INSERT INTO ITPAPP.TPRMPP_CMENUA (MNU_ID, ATH_ID, DEL_YN, FST_ENR_USID, FST_ENR_DTM) VALUES ('M_PRJEST','ITPZZ001','N','MIGRATION',SYSDATE);
INSERT INTO ITPAPP.TPRMPP_CMENUA (MNU_ID, ATH_ID, DEL_YN, FST_ENR_USID, FST_ENR_DTM) VALUES ('M_PRJEST','ITPZZ002','N','MIGRATION',SYSDATE);

COMMIT;
```

> `WHL_MNU_PTH`/`MNU_DEP`/`MNU_SOT_SQN_SNO` 규칙은 `it_backend` §5.5.5 및 기존 시드(`V20260603_008`, `V20260606_007`)를 따른다.

- [ ] **Step 3: 실행 + 검증**

DB 접속 후 스크립트 실행 → 앱 재기동 → 로그인 → 사이드바에 "사업 관리 > 소요예산 산정" 노출, 클릭 시 `/project/estimate` 진입 확인.

- [ ] **Step 4: 커밋**

```bash
git add it_database/migrations/V20260607_003__SeedEstimateMenu.sql
git commit -m "feat(db): 소요예산 산정 메뉴/라우트/권한 시드"
```

---

### Task 16: 통합 동작 검증 (수동 E2E)

**Files:** 없음(검증만)

- [ ] **Step 1: 두 서버 기동**

Run: `cd it_backend && ./gradlew bootRun` (별도 터미널) / `cd it_frontend && npm run dev`

- [ ] **Step 2: 플로우 검증** (http://localhost:3000)

1. 로그인 → 사이드바 "사업 관리 > 소요예산 산정" 진입.
2. "신규 신청" → 사업 선택 + 요청내용 입력 → 신청 → 상세(작성중) 진입, 문서번호 `REQ-YYYY-0001` 확인.
3. 작성중에서 요청내용 저장 → "신청 제출"(→ 진행중).
4. 진행중에서 팀별 행 추가(담당팀/비목/금액/의견) → "산정 저장" → 새로고침 후 유지/합계 확인.
5. "완료 확정"(→ 완료) → 전체 읽기전용 확인.
6. 목록 화면에서 상태/요청자/요청일시 표시 확인.

- [ ] **Step 3: 회귀 확인**

Run: `cd it_backend && ./gradlew test` / `cd it_frontend && npm test && npm run typecheck`
Expected: 전체 PASS.

- [ ] **Step 4: 변경 로그 적재 확인** (DB)

Run (DB 접속): `SELECT CHG_DTT_YN, IT_PTL_STS_TC FROM TPRMPP_BESTIL ORDER BY LOG_HIS_TGR_SNO DESC FETCH FIRST 5 ROWS ONLY;`
Expected: 생성/수정/상태전이에 대응하는 C/U 로그 행 존재.

---

## Self-Review (작성자 체크 결과)

- **Spec 커버리지**: 데이터모델 §3(BESTIM/BESTID/로그) → Task 2-4 ✅, 상태전이 §4 → Task 8 ✅, 화면 §5(목록/상세/팀그리드) → Task 13-14 ✅, API §6(목록/상세/생성/수정/삭제/상태/lines) → Task 10 ✅, 검증 §7(대상/중복/전이/작성중) → Task 7-9 ✅, 테스트 §8 → 각 Task TDD + Task 16 ✅, 공통코드 §3.4(IT_PTL_BG_PRN_TC) → Task 1 ✅, 메뉴 §2.2/§9 → Task 15 ✅. **범위 외(별도 플랜)**: 과업심의/입찰계약/대금지급, 통합 `/api/project/targets`(Stage 1은 기존 `/api/projects` 재사용), `TASK_DBR_RLT_TC`·`CTT_MANR_C` 공통코드.
- **플레이스홀더**: 코드 단계는 전부 실제 코드. Task 15 메뉴 시드의 `SRE_TC`/`ATH_ID`/부모그룹은 본질적으로 DB 데이터 의존 → Step 1 SELECT로 확정 후 치환하도록 절차화(예시값 명시).
- **타입 일관성**: 백엔드 필드(`rqmBgReqDocNo`,`docVrsSno`,`bgPrnTc`,`cncdRfrNo`,`stsTc`,`reqCone`,`svnTemC`,`ioeC`,`rqmBgAmt`,`opnnCone`)와 DTO·프론트 타입·QueryDSL Projection 컬럼 순서 일치. 상태 상수 `41/42/49` 백엔드(`STS_*`)·프론트(`ESTIMATE_STATUS`) 동일.
- **실행 리스크 노트**: (1) `validate` 스키마 정합은 Task 4 Step 4에서 선검증 — 감사컬럼 타입 불일치 시 메뉴 마이그레이션 기준으로 조정. (2) 로그 시퀀스명은 `SEQ_BESTIL`/`SEQ_BESTIDL`로 `AuditLogIdGenerator` 규칙과 일치. (3) `@WebMvcTest`/`@DataJpaTest` 보안·설정 스텁은 기존 동종 테스트 패턴을 따른다.

---

## Execution Handoff

본 플랜은 소요예산 산정(Stage ①)의 풀스택 슬라이스다. 이후 과업심의/입찰계약/대금지급은 이 패턴을 복제하여 각각 별도 플랜으로 작성한다.
