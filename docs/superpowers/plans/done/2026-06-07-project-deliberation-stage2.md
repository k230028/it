# 과업심의위원회 (Stage ②) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보화사업(`TPRMPP_BPROJM`) 또는 전산업무비(`TPRMPP_BCOSTM`)에 대한 과업심의위원회 신청/작업 화면(MVP)을 풀스택으로 구현한다 — 신청자가 심의를 신청하고, 작업자(관리자/담당)가 심의구분·회차·일자·결과(승인/반려/조건부)·의견을 입력·완료한다.

**Architecture:** 설계서 A안 두 번째 수직 슬라이스. **마스터 단일 테이블**(`Bdelim`, 명세 없음), 상태 3단(작성중 51 → 진행중 52 → 완료 59, 공통코드 `IT_PTL_STS_TC`). 대상은 사업/전산업무비 **둘 다 가능**(`BG_PRN_TC` 100/200 + `CNCD_RFR_NO`). Stage ①(소요예산)에서 검증된 패턴(레이어드 + `@LogTarget` + QueryDSL + `bbrC` 필터 + `TestSecurityConfig` WebMvc + `useApiFetch`/`$apiFetch`)을 그대로 복제한다.

**Tech Stack:** Spring Boot 4 / Java 25 / Spring Data JPA + QueryDSL / Oracle (ddl-auto=**validate** → 마이그레이션 선행 필수) / JUnit5 + Mockito + AssertJ / Nuxt 4 + PrimeVue + Vitest.

**설계서(SoT):** `docs/superpowers/specs/2026-06-07-project-execution-stages-design.md` (§3.3 ②, §4, §5, §6)
**선행 참조 플랜:** `docs/superpowers/plans/2026-06-07-project-estimate-stage1.md` (Stage ① — 동일 패턴의 구현 레퍼런스)

---

## 핵심 규약 (작업 전 필독 — Stage ①과 동일)

- **마이그레이션 선행**: `ddl-auto=validate`. 엔티티보다 테이블 DDL을 먼저 적용. `it_database/migrations/V{YYYYMMDD_NNN}__*.sql` (적용 전 최신 번호 확인 — 본 플랜은 `V20260607_005/006/007` 가정, 충돌 시 다음 번호로).
- **로그 테이블/시퀀스**: `AuditLogIdGenerator`가 로그 엔티티 `@Table` 명의 `_` 뒤로 `SEQ_<X>`를 호출. 마스터 `TPRMPP_BDELIM` → 로그 `TPRMPP_BDELIL` → 시퀀스 `SEQ_BDELIL`. 문서번호 채번 시퀀스 `SEQ_BDELIM`.
- **감사 컬럼 타입**(메뉴/estimate 마이그레이션과 동일): `FST_ENR_DTM`/`LST_CHG_DTM`=`DATE`, `GUID_PRG_SNO`=`NUMBER(4,0)`, 로그 PK `LOG_HIS_TGR_SNO`=`NUMBER(18,0)`, 로그 `CHG_DTM`=`TIMESTAMP(9)`.
- **메타 용어 고정**(설계서 부록 A, 전부 메타 실재): `DOC_MNG_NO`(문서번호), `DOC_VRS_SNO`(버전), `LST_YN`, `BG_PRN_TC`(대상구분 100/200), `CNCD_RFR_NO`(대상관리번호=사업 `ABUS_MNG_NO` 또는 전산업무비 `BG_NO`), `IT_PTL_STS_TC`(상태), `REQ_CONE`(요청내용), `TASK_DBR_TC`(심의구분), `TASK_DBR_RLT_TC`(심의결과), `TASK_DBR_DT`(심의일자), `TASK_DBR_TOD`(심의회차), `TASK_DBR_OMT_YN`(생략여부), `TASK_DBR_OMT_RSN`(생략사유), `OPNN_CONE`(의견), `APV_TRDN_RSN_CONE`(반려사유).
- **상태**: 51(작성중) → 52(진행중) → 59(완료). 인접 전이만 허용.
- **DB 접속**: `it_database/apply-ddl-live.ps1` 의 creds (ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1, sqlplus on PATH).
- **테스트**: 백엔드 `cd it_backend && ./gradlew test`, 프론트 `cd it_frontend && npm test`/`npm run typecheck`.
- **브랜치/커밋**: 각 서브리포(it_database/it_backend/it_frontend)의 작업 브랜치에 단계별 커밋. 외부 리포 문서는 `feat/project-deliberation-stage2`.

---

## 파일 구조

**DB 마이그레이션 (`it_database/migrations/`)**
- Create: `V20260607_005__CreateDeliberationTables.sql` (BDELIM + 로그 BDELIL + 시퀀스)
- Create: `V20260607_006__SeedTaskDbrRltTc.sql` (공통코드 TASK_DBR_RLT_TC 01/02/03)
- Create: `V20260607_007__SeedDeliberationMenu.sql` (메뉴)

**백엔드 (`it_backend/src/main/java/com/kdb/it/domain/deliberation/`)**
- Create: `entity/Bdelim.java`, `entity/BdelimId.java`, `domain/log/entity/BdelimL.java`
- Create: `dto/DeliberationDto.java`
- Create: `repository/DeliberationRepository.java`, `repository/DeliberationRepositoryCustom.java`, `repository/DeliberationRepositoryImpl.java`
- Create: `service/DeliberationService.java`
- Create: `controller/DeliberationController.java`
- Modify (if finder missing): `domain/budget/cost/repository/CostRepository.java` (전산업무비 존재 검증 finder)
- Test: `service/DeliberationServiceTest.java`, `controller/DeliberationControllerTest.java`

**프론트엔드 (`it_frontend/`)**
- Create: `app/types/deliberation.ts`, `app/composables/useDeliberations.ts`
- Create: `app/pages/project/deliberation/index.vue`, `app/pages/project/deliberation/[docNo].vue`
- Test: `tests/unit/composables/useDeliberations.test.ts`

---

## Stage ② 백엔드

### Task 1: 공통코드 `TASK_DBR_RLT_TC` 등록 (심의결과)

**Files:** Create `it_database/migrations/V20260607_006__SeedTaskDbrRltTc.sql`

> 적용 전 `ls it_database/migrations/`로 최신 번호 확인. 005가 테이블, 006이 코드, 007이 메뉴 — 충돌 시 다음 번호로 일괄 조정.

- [ ] **Step 1: 마이그레이션 작성** (`TPRMPP_CCODEM` 컬럼은 estimate 코드 시드 V20260607_001과 동일)

```sql
-- V20260607_006__SeedTaskDbrRltTc.sql
-- 과업심의결과구분코드(TASK_DBR_RLT_TC): 01 승인 / 02 반려 / 03 조건부.
-- 멱등: 그룹 DELETE 후 재INSERT.
DELETE FROM ITPAPP.TPRMPP_CCODEM WHERE CO_C_ID = 'TASK_DBR_RLT_TC';
INSERT INTO ITPAPP.TPRMPP_CCODEM (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN)
VALUES ('TASK_DBR_RLT_TC', '01', DATE '2026-01-01', DATE '9999-12-31', '과업심의결과', '승인', 1, 'MIGRATION', SYSDATE, 'N');
INSERT INTO ITPAPP.TPRMPP_CCODEM (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN)
VALUES ('TASK_DBR_RLT_TC', '02', DATE '2026-01-01', DATE '9999-12-31', '과업심의결과', '반려', 2, 'MIGRATION', SYSDATE, 'N');
INSERT INTO ITPAPP.TPRMPP_CCODEM (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN)
VALUES ('TASK_DBR_RLT_TC', '03', DATE '2026-01-01', DATE '9999-12-31', '과업심의결과', '조건부', 3, 'MIGRATION', SYSDATE, 'N');
COMMIT;
```
> `TASK_DBR_TC`(심의구분) 값 세트는 MVP 범위 외(설계서 §3.4 미포함). 본 단계에서는 등록하지 않으며, 프론트에서는 자유 입력/선택으로 두고 후속 확정. (필요 시 별도 시드)

- [ ] **Step 2: 실행 + 검증** — DB 접속 후 실행, `SELECT CDVA_ID, CDVA_NM FROM TPRMPP_CCODEM WHERE CO_C_ID='TASK_DBR_RLT_TC' ORDER BY C_SQN_SNO;` → 3행(승인/반려/조건부).

- [ ] **Step 3: 커밋** — `cd it_database && git add migrations/V20260607_006__SeedTaskDbrRltTc.sql && git commit -m "feat(db): 과업심의결과구분코드(TASK_DBR_RLT_TC) 등록(승인/반려/조건부)"`

---

### Task 2: 테이블/로그/시퀀스 마이그레이션

**Files:** Create `it_database/migrations/V20260607_005__CreateDeliberationTables.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- V20260607_005__CreateDeliberationTables.sql
-- 과업심의위원회 마스터(BDELIM, 명세 없음) + 변경로그(BDELIL) + 시퀀스.
-- ddl-auto=validate 이므로 엔티티 작성 전 본 스크립트를 먼저 실행.
-- 감사컬럼 타입은 V20260603_007/estimate 마이그레이션과 동일(DATE/NUMBER(4,0)/TIMESTAMP(9)).

CREATE TABLE TPRMPP_BDELIM (
  DOC_MNG_NO        VARCHAR2(20 CHAR)  NOT NULL,
  DOC_VRS_SNO       NUMBER(9,0)        NOT NULL,
  LST_YN            VARCHAR2(1 CHAR)   DEFAULT 'Y' NOT NULL,
  BG_PRN_TC         VARCHAR2(3 CHAR)   NOT NULL,
  CNCD_RFR_NO       VARCHAR2(30 CHAR)  NOT NULL,
  IT_PTL_STS_TC     VARCHAR2(2 CHAR)   NOT NULL,
  REQ_CONE          VARCHAR2(300 CHAR),
  TASK_DBR_TC       VARCHAR2(2 CHAR),
  TASK_DBR_RLT_TC   VARCHAR2(2 CHAR),
  TASK_DBR_DT       VARCHAR2(8 CHAR),
  TASK_DBR_TOD      VARCHAR2(2 CHAR),
  TASK_DBR_OMT_YN   VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
  TASK_DBR_OMT_RSN  VARCHAR2(200 CHAR),
  OPNN_CONE         VARCHAR2(1000 CHAR),
  APV_TRDN_RSN_CONE VARCHAR2(300 CHAR),
  DEL_YN            VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
  GUID              VARCHAR2(38 CHAR),
  GUID_PRG_SNO      NUMBER(4,0),
  FST_ENR_DTM       DATE,
  FST_ENR_USID      VARCHAR2(14 CHAR),
  LST_CHG_DTM       DATE,
  LST_CHG_USID      VARCHAR2(14 CHAR),
  CONSTRAINT PK_TPRMPP_BDELIM PRIMARY KEY (DOC_MNG_NO, DOC_VRS_SNO),
  CONSTRAINT CK_BDELIM_LST_YN CHECK (LST_YN IN ('Y','N')),
  CONSTRAINT CK_BDELIM_DEL_YN CHECK (DEL_YN IN ('Y','N')),
  CONSTRAINT CK_BDELIM_OMT_YN CHECK (TASK_DBR_OMT_YN IN ('Y','N'))
);
COMMENT ON TABLE  TPRMPP_BDELIM                   IS '과업심의 기본';
COMMENT ON COLUMN TPRMPP_BDELIM.DOC_MNG_NO        IS '문서관리번호';
COMMENT ON COLUMN TPRMPP_BDELIM.DOC_VRS_SNO       IS '문서버전일련번호';
COMMENT ON COLUMN TPRMPP_BDELIM.LST_YN            IS '최종여부';
COMMENT ON COLUMN TPRMPP_BDELIM.BG_PRN_TC         IS '예산성격구분코드(대상구분)';
COMMENT ON COLUMN TPRMPP_BDELIM.CNCD_RFR_NO       IS '관련참조번호(대상관리번호)';
COMMENT ON COLUMN TPRMPP_BDELIM.IT_PTL_STS_TC     IS 'IT포탈상태구분코드';
COMMENT ON COLUMN TPRMPP_BDELIM.REQ_CONE          IS '요청내용';
COMMENT ON COLUMN TPRMPP_BDELIM.TASK_DBR_TC       IS '과업심의구분코드';
COMMENT ON COLUMN TPRMPP_BDELIM.TASK_DBR_RLT_TC   IS '과업심의결과구분코드';
COMMENT ON COLUMN TPRMPP_BDELIM.TASK_DBR_DT       IS '과업심의일자';
COMMENT ON COLUMN TPRMPP_BDELIM.TASK_DBR_TOD      IS '과업심의회차';
COMMENT ON COLUMN TPRMPP_BDELIM.TASK_DBR_OMT_YN   IS '과업심의생략여부';
COMMENT ON COLUMN TPRMPP_BDELIM.TASK_DBR_OMT_RSN  IS '과업심의생략사유';
COMMENT ON COLUMN TPRMPP_BDELIM.OPNN_CONE         IS '의견내용';
COMMENT ON COLUMN TPRMPP_BDELIM.APV_TRDN_RSN_CONE IS '승인반려사유내용';
CREATE INDEX IDX_BDELIM_TGT ON TPRMPP_BDELIM (BG_PRN_TC, CNCD_RFR_NO);
CREATE INDEX IDX_BDELIM_STS ON TPRMPP_BDELIM (IT_PTL_STS_TC);

CREATE TABLE TPRMPP_BDELIL (
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
  DOC_MNG_NO        VARCHAR2(20 CHAR),
  DOC_VRS_SNO       NUMBER(9,0),
  LST_YN            VARCHAR2(1 CHAR),
  BG_PRN_TC         VARCHAR2(3 CHAR),
  CNCD_RFR_NO       VARCHAR2(30 CHAR),
  IT_PTL_STS_TC     VARCHAR2(2 CHAR),
  REQ_CONE          VARCHAR2(300 CHAR),
  TASK_DBR_TC       VARCHAR2(2 CHAR),
  TASK_DBR_RLT_TC   VARCHAR2(2 CHAR),
  TASK_DBR_DT       VARCHAR2(8 CHAR),
  TASK_DBR_TOD      VARCHAR2(2 CHAR),
  TASK_DBR_OMT_YN   VARCHAR2(1 CHAR),
  TASK_DBR_OMT_RSN  VARCHAR2(200 CHAR),
  OPNN_CONE         VARCHAR2(1000 CHAR),
  APV_TRDN_RSN_CONE VARCHAR2(300 CHAR),
  CONSTRAINT PK_TPRMPP_BDELIL PRIMARY KEY (LOG_HIS_TGR_SNO)
);
COMMENT ON TABLE TPRMPP_BDELIL IS '과업심의 기본 변경 로그';

CREATE SEQUENCE SEQ_BDELIM START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;  -- 문서번호 채번
CREATE SEQUENCE SEQ_BDELIL START WITH 1 INCREMENT BY 1 CACHE 20 NOCYCLE;  -- 로그 PK
```

- [ ] **Step 2: 실행 + 검증** — `SELECT table_name FROM user_tables WHERE table_name IN ('TPRMPP_BDELIM','TPRMPP_BDELIL');` → 2행; `SELECT sequence_name FROM user_sequences WHERE sequence_name IN ('SEQ_BDELIM','SEQ_BDELIL');` → 2행.

- [ ] **Step 3: 커밋** — `cd it_database && git add migrations/V20260607_005__CreateDeliberationTables.sql && git commit -m "feat(db): 과업심의 테이블/로그/시퀀스 생성(BDELIM/BDELIL)"`

---

### Task 3: 엔티티 `Bdelim` + `BdelimId` + 로그 `BdelimL`

**Files:** Create `entity/Bdelim.java`, `entity/BdelimId.java`, `domain/log/entity/BdelimL.java`. (레퍼런스: estimate의 `Bestim`/`BestimId`/`BestimL` — 동일 구조)

- [ ] **Step 1: 복합키 `BdelimId.java`**
```java
package com.kdb.it.domain.deliberation.entity;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 과업심의 마스터(Bdelim) 복합 기본키. (문서관리번호 + 문서버전일련번호) */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BdelimId implements Serializable {
    private String docMngNo;
    private Integer docVrsSno;
}
```

- [ ] **Step 2: 엔티티 `Bdelim.java`**
```java
package com.kdb.it.domain.deliberation.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.BdelimL;
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
 * 과업심의 기본(마스터) 엔티티.
 *
 * <p>DB 테이블: {@code TPRMPP_BDELIM}. 정보화사업/전산업무비에 대한 과업심의위원회 신청을 관리한다.</p>
 * <p>대상구분 {@code BG_PRN_TC}: 100=정보화사업, 200=전산업무비. 상태 51→52→59.</p>
 */
@LogTarget(entity = BdelimL.class)
@Entity
@Table(name = "TPRMPP_BDELIM", comment = "과업심의 기본")
@IdClass(BdelimId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Bdelim extends BaseEntity {

    @Id
    @Column(name = "DOC_MNG_NO", length = 20, nullable = false, comment = "문서관리번호")
    private String docMngNo;

    @Id
    @Column(name = "DOC_VRS_SNO", nullable = false, comment = "문서버전일련번호")
    private Integer docVrsSno;

    @Column(name = "LST_YN", length = 1, comment = "최종여부")
    private String lstYn;

    @Column(name = "BG_PRN_TC", length = 3, nullable = false, comment = "예산성격구분코드(대상구분)")
    private String bgPrnTc;

    @Column(name = "CNCD_RFR_NO", length = 30, nullable = false, comment = "관련참조번호(대상관리번호)")
    private String cncdRfrNo;

    @Column(name = "IT_PTL_STS_TC", length = 2, nullable = false, comment = "IT포탈상태구분코드")
    private String stsTc;

    @Column(name = "REQ_CONE", length = 300, comment = "요청내용")
    private String reqCone;

    @Column(name = "TASK_DBR_TC", length = 2, comment = "과업심의구분코드")
    private String taskDbrTc;

    @Column(name = "TASK_DBR_RLT_TC", length = 2, comment = "과업심의결과구분코드")
    private String taskDbrRltTc;

    @Column(name = "TASK_DBR_DT", length = 8, comment = "과업심의일자")
    private String taskDbrDt;

    @Column(name = "TASK_DBR_TOD", length = 2, comment = "과업심의회차")
    private String taskDbrTod;

    @Column(name = "TASK_DBR_OMT_YN", length = 1, comment = "과업심의생략여부")
    private String taskDbrOmtYn;

    @Column(name = "TASK_DBR_OMT_RSN", length = 200, comment = "과업심의생략사유")
    private String taskDbrOmtRsn;

    @Column(name = "OPNN_CONE", length = 1000, comment = "의견내용")
    private String opnnCone;

    @Column(name = "APV_TRDN_RSN_CONE", length = 300, comment = "승인반려사유내용")
    private String apvTrdnRsnCone;

    /** 요청내용 수정 (작성중에서만 서비스가 호출) */
    public void updateRequest(String reqCone) {
        this.reqCone = reqCone;
    }

    /** 심의 결과 입력 (진행중에서만 서비스가 호출) */
    public void updateResult(String taskDbrTc, String taskDbrRltTc, String taskDbrDt, String taskDbrTod,
                             String taskDbrOmtYn, String taskDbrOmtRsn, String opnnCone, String apvTrdnRsnCone) {
        this.taskDbrTc = taskDbrTc;
        this.taskDbrRltTc = taskDbrRltTc;
        this.taskDbrDt = taskDbrDt;
        this.taskDbrTod = taskDbrTod;
        this.taskDbrOmtYn = taskDbrOmtYn;
        this.taskDbrOmtRsn = taskDbrOmtRsn;
        this.opnnCone = opnnCone;
        this.apvTrdnRsnCone = apvTrdnRsnCone;
    }

    /** 상태 전이 (서비스의 changeStatus에서만 호출) */
    public void changeStatus(String stsTc) {
        this.stsTc = stsTc;
    }
}
```

- [ ] **Step 3: 로그 `BdelimL.java`** (`@Table(name="TPRMPP_BDELIL")` → 시퀀스 `SEQ_BDELIL`)
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

/** 과업심의 기본(TPRMPP_BDELIM) 변경 로그. */
@Entity
@Table(name = "TPRMPP_BDELIL", comment = "과업심의 기본 변경 로그")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class BdelimL extends BaseLogEntity {
    @Column(name = "DOC_MNG_NO", length = 20, comment = "문서관리번호") private String docMngNo;
    @Column(name = "DOC_VRS_SNO", comment = "문서버전일련번호") private Integer docVrsSno;
    @Column(name = "LST_YN", length = 1, comment = "최종여부") private String lstYn;
    @Column(name = "BG_PRN_TC", length = 3, comment = "예산성격구분코드(대상구분)") private String bgPrnTc;
    @Column(name = "CNCD_RFR_NO", length = 30, comment = "관련참조번호(대상관리번호)") private String cncdRfrNo;
    @Column(name = "IT_PTL_STS_TC", length = 2, comment = "IT포탈상태구분코드") private String stsTc;
    @Column(name = "REQ_CONE", length = 300, comment = "요청내용") private String reqCone;
    @Column(name = "TASK_DBR_TC", length = 2, comment = "과업심의구분코드") private String taskDbrTc;
    @Column(name = "TASK_DBR_RLT_TC", length = 2, comment = "과업심의결과구분코드") private String taskDbrRltTc;
    @Column(name = "TASK_DBR_DT", length = 8, comment = "과업심의일자") private String taskDbrDt;
    @Column(name = "TASK_DBR_TOD", length = 2, comment = "과업심의회차") private String taskDbrTod;
    @Column(name = "TASK_DBR_OMT_YN", length = 1, comment = "과업심의생략여부") private String taskDbrOmtYn;
    @Column(name = "TASK_DBR_OMT_RSN", length = 200, comment = "과업심의생략사유") private String taskDbrOmtRsn;
    @Column(name = "OPNN_CONE", length = 1000, comment = "의견내용") private String opnnCone;
    @Column(name = "APV_TRDN_RSN_CONE", length = 300, comment = "승인반려사유내용") private String apvTrdnRsnCone;
}
```

- [ ] **Step 4: 부팅 validate** — `cd it_backend && ./gradlew compileJava test --tests "*ApplicationTests*"` (또는 짧은 bootRun). 엔티티↔BDELIM/BDELIL 컬럼 정합 확인. 불일치 시 타입 조정(estimate와 동일 규약).

- [ ] **Step 5: 커밋** — `cd it_backend && git add src/main/java/com/kdb/it/domain/deliberation/entity/ src/main/java/com/kdb/it/domain/log/entity/BdelimL.java && git commit -m "feat(deliberation): 과업심의 마스터 엔티티/복합키/변경로그 추가"`

---

### Task 4: DTO `DeliberationDto`

**Files:** Create `dto/DeliberationDto.java`

- [ ] **Step 1: 작성** (정적 중첩 record + `@Schema`)
```java
package com.kdb.it.domain.deliberation.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 과업심의 API 요청/응답 DTO 모음. */
public final class DeliberationDto {
    private DeliberationDto() {}

    @Schema(name = "DeliberationCreateRequest", description = "과업심의 신규 신청 요청")
    public record CreateRequest(
            @NotBlank @Size(max = 3) String bgPrnTc,     // 100 사업 / 200 전산업무비
            @NotBlank @Size(max = 30) String cncdRfrNo,  // 대상 관리번호
            @Size(max = 300) String reqCone
    ) {}

    @Schema(name = "DeliberationUpdateRequest", description = "과업심의 마스터 수정(작성중)")
    public record UpdateRequest(@Size(max = 300) String reqCone) {}

    @Schema(name = "DeliberationStatusRequest", description = "과업심의 상태 전이")
    public record StatusRequest(@NotBlank @Size(max = 2) String stsTc) {}

    @Schema(name = "DeliberationResultRequest", description = "과업심의 결과 입력(진행중)")
    public record ResultRequest(
            @Size(max = 2) String taskDbrTc,
            @Size(max = 2) String taskDbrRltTc,
            @Size(max = 8) String taskDbrDt,
            @Size(max = 2) String taskDbrTod,
            @Size(max = 1) String taskDbrOmtYn,
            @Size(max = 200) String taskDbrOmtRsn,
            @Size(max = 1000) String opnnCone,
            @Size(max = 300) String apvTrdnRsnCone
    ) {}

    @Schema(name = "DeliberationListItem", description = "과업심의 목록 항목")
    public record ListItem(
            String docMngNo, Integer docVrsSno, String bgPrnTc, String cncdRfrNo,
            String stsTc, String taskDbrRltTc, String reqUsid, java.time.LocalDateTime reqDtm
    ) {}

    @Schema(name = "DeliberationDetail", description = "과업심의 상세")
    public record Detail(
            String docMngNo, Integer docVrsSno, String bgPrnTc, String cncdRfrNo, String tgtNm,
            String stsTc, String reqCone, String taskDbrTc, String taskDbrRltTc, String taskDbrDt,
            String taskDbrTod, String taskDbrOmtYn, String taskDbrOmtRsn, String opnnCone, String apvTrdnRsnCone,
            String reqUsid, java.time.LocalDateTime reqDtm
    ) {}
}
```

- [ ] **Step 2: compile + 커밋** — `./gradlew compileJava`; `git add ...dto/DeliberationDto.java && git commit -m "feat(deliberation): 과업심의 DTO(record) 추가"`

---

### Task 5: Repository + 전산업무비 존재 finder

**Files:** Create `repository/DeliberationRepository.java`, `DeliberationRepositoryCustom.java`, `DeliberationRepositoryImpl.java`; Modify `domain/budget/cost/repository/CostRepository.java`

- [ ] **Step 1: 사전 확인** — `domain/budget/cost/entity/Bcostm.java`를 읽어 전산업무비 PK 컬럼(`BG_NO`?), 현재버전 플래그(`LST_YN`), 명칭 필드를 확인. `CostRepository`에 현재버전 단건 finder가 없으면 추가(실제 PK 필드명에 맞춰): `boolean existsByBgNoAndLstYnAndDelYn(String, String, String);` 와 `Optional<Bcostm> findByBgNoAndLstYnAndDelYn(String, String, String);`. (Bcostm PK가 BG_NO+BG_SNO 복합이면 LST_YN='Y'로 단건 보장.) `ProjectRepository.existsByAbusMngNoAndLstYnAndDelYn`/`findByAbusMngNoAndLstYnAndDelYn`는 Stage ①에서 추가됨.

- [ ] **Step 2: Repository 작성**
```java
// DeliberationRepository.java
package com.kdb.it.domain.deliberation.repository;

import com.kdb.it.domain.deliberation.entity.Bdelim;
import com.kdb.it.domain.deliberation.entity.BdelimId;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DeliberationRepository extends JpaRepository<Bdelim, BdelimId>, DeliberationRepositoryCustom {
    Optional<Bdelim> findByDocMngNoAndLstYnAndDelYn(String docMngNo, String lstYn, String delYn);

    @Query(nativeQuery = true, value = "SELECT SEQ_BDELIM.NEXTVAL FROM DUAL")
    Long nextDocSeq();

    boolean existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(
            String bgPrnTc, String cncdRfrNo, java.util.Collection<String> stsTc, String delYn);
}
```
```java
// DeliberationRepositoryCustom.java
package com.kdb.it.domain.deliberation.repository;

import com.kdb.it.domain.deliberation.dto.DeliberationDto;
import java.util.List;

public interface DeliberationRepositoryCustom {
    /** 목록 조회. bbrC는 MVP 미적용(대상 2종 join 복잡) — 시그니처만 유지. */
    List<DeliberationDto.ListItem> search(String stsTc, String bgPrnTc, String cncdRfrNo, String bbrC);
}
```
```java
// DeliberationRepositoryImpl.java
package com.kdb.it.domain.deliberation.repository;

import com.kdb.it.domain.deliberation.dto.DeliberationDto;
import com.kdb.it.domain.deliberation.entity.QBdelim;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;

@RequiredArgsConstructor
public class DeliberationRepositoryImpl implements DeliberationRepositoryCustom {
    private final JPAQueryFactory queryFactory;

    @Override
    public List<DeliberationDto.ListItem> search(String stsTc, String bgPrnTc, String cncdRfrNo, String bbrC) {
        QBdelim d = QBdelim.bdelim;
        BooleanBuilder where = new BooleanBuilder();
        where.and(d.delYn.eq("N"));
        where.and(d.lstYn.eq("Y"));
        if (StringUtils.hasText(stsTc))     where.and(d.stsTc.eq(stsTc));
        if (StringUtils.hasText(bgPrnTc))   where.and(d.bgPrnTc.eq(bgPrnTc));
        if (StringUtils.hasText(cncdRfrNo)) where.and(d.cncdRfrNo.eq(cncdRfrNo));
        // 부서 필터(bbrC): 대상이 사업/전산업무비 2종이라 단일 join 곤란 → MVP 미적용(후속 고도화, TASK 등록).
        return queryFactory.select(Projections.constructor(DeliberationDto.ListItem.class,
                        d.docMngNo, d.docVrsSno, d.bgPrnTc, d.cncdRfrNo, d.stsTc, d.taskDbrRltTc, d.fstEnrUsid, d.fstEnrDtm))
                .from(d).where(where).orderBy(d.fstEnrDtm.desc()).fetch();
    }
}
```
> **부서 필터 주의**: estimate처럼 단일 join `bbrC` 필터가 어려움(대상 2종). MVP는 미적용하고 `TASK.md`에 백로그 등록(Task 9 Step2).

- [ ] **Step 3: compile (Q클래스 생성) + 커밋** — `./gradlew compileJava`; `git add ...repository/ ...cost/repository/CostRepository.java && git commit -m "feat(deliberation): Repository(목록/현재버전/채번) + 전산업무비 존재/조회 finder"`

---

### Task 6: Service (TDD) — 생성/전이/수정/결과입력/조회

**Files:** Create `service/DeliberationService.java`, Test `service/DeliberationServiceTest.java`. (레퍼런스: `EstimateService` + `EstimateServiceTest`)

상태 상수: `STS_DRAFT="51"`, `STS_IN_PROGRESS="52"`, `STS_DONE="59"`. 대상구분: `TGT_PROJECT="100"`, `TGT_COST="200"`. 문서번호 `DLB-{YYYY}-{4자리}`.

- [ ] **Step 1: 실패 테스트 작성** (Mockito; `EstimateServiceTest` 패턴) — 케이스:
  1. `create` 사업 대상 정상 → 문서번호 `DLB-\\d{4}-0001` 형식 (mock projectRepository.existsByAbusMngNoAndLstYnAndDelYn=true, dupCheck=false, nextDocSeq=1, save echo).
  2. `create` 전산업무비 대상 정상 → costRepository.existsByBgNoAndLstYnAndDelYn=true 경로.
  3. `create` 대상 미존재 → IllegalArgumentException("대상").
  4. `create` 중복 진행 문서 존재 → IllegalStateException("진행 중").
  5. `changeStatus` 51→52 허용(엔티티 stsTc=52 검증); 6. 59→52 거부(IllegalStateException).
  7. `update`(reqCone) 작성중 아님(52) → IllegalStateException.
  8. `saveResult` 진행중 아님(51) → IllegalStateException; 9. `saveResult` 진행중(52) 정상 → taskDbrRltTc 등 반영.
  `requester()`=`new CustomUserDetails("E0001", List.of("ITPZZ001"), "18001")`. mocks: DeliberationRepository, ProjectRepository, CostRepository.

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests "*DeliberationServiceTest*"` → 컴파일 실패.

- [ ] **Step 3: 서비스 작성**
```java
package com.kdb.it.domain.deliberation.service;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.cost.repository.CostRepository;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.deliberation.dto.DeliberationDto;
import com.kdb.it.domain.deliberation.entity.Bdelim;
import com.kdb.it.domain.deliberation.repository.DeliberationRepository;
import java.time.Year;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 과업심의 서비스. 상태 51→52→59. 대상구분 100=사업/200=전산업무비.
 * 쓰기 주체: 작성중=신청자/부서, 진행중 결과입력=작업자. 상태 전이는 인접만 허용.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DeliberationService {

    static final String STS_DRAFT = "51";
    static final String STS_IN_PROGRESS = "52";
    static final String STS_DONE = "59";
    static final String TGT_PROJECT = "100";
    static final String TGT_COST = "200";

    private final DeliberationRepository deliberationRepository;
    private final ProjectRepository projectRepository;
    private final CostRepository costRepository;

    @Transactional
    public String create(DeliberationDto.CreateRequest req, CustomUserDetails user) {
        validateTarget(req.bgPrnTc(), req.cncdRfrNo());
        if (deliberationRepository.existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(
                req.bgPrnTc(), req.cncdRfrNo(), List.of(STS_DRAFT, STS_IN_PROGRESS), "N")) {
            throw new IllegalStateException("해당 대상에 진행 중인 과업심의가 이미 있습니다.");
        }
        String docNo = String.format("DLB-%d-%04d", Year.now().getValue(), deliberationRepository.nextDocSeq());
        deliberationRepository.save(Bdelim.builder()
                .docMngNo(docNo).docVrsSno(1).lstYn("Y")
                .bgPrnTc(req.bgPrnTc()).cncdRfrNo(req.cncdRfrNo())
                .stsTc(STS_DRAFT).reqCone(req.reqCone()).taskDbrOmtYn("N").build());
        return docNo;
    }

    private void validateTarget(String bgPrnTc, String cncdRfrNo) {
        boolean ok;
        if (TGT_PROJECT.equals(bgPrnTc)) {
            ok = projectRepository.existsByAbusMngNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N");
        } else if (TGT_COST.equals(bgPrnTc)) {
            ok = costRepository.existsByBgNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N"); // 실제 finder명에 맞춤
        } else {
            throw new IllegalArgumentException("알 수 없는 대상구분: " + bgPrnTc);
        }
        if (!ok) throw new IllegalArgumentException("대상을 찾을 수 없습니다: " + bgPrnTc + "/" + cncdRfrNo);
    }

    @Transactional
    public void update(String docNo, DeliberationDto.UpdateRequest req, CustomUserDetails user) {
        Bdelim e = loadCurrent(docNo);
        if (!STS_DRAFT.equals(e.getStsTc())) throw new IllegalStateException("작성중 상태에서만 수정할 수 있습니다.");
        e.updateRequest(req.reqCone());
    }

    @Transactional
    public void delete(String docNo, CustomUserDetails user) {
        Bdelim e = loadCurrent(docNo);
        if (!STS_DRAFT.equals(e.getStsTc())) throw new IllegalStateException("작성중 상태에서만 삭제할 수 있습니다.");
        e.delete();
    }

    @Transactional
    public void changeStatus(String docNo, DeliberationDto.StatusRequest req, CustomUserDetails user) {
        Bdelim e = loadCurrent(docNo);
        String from = e.getStsTc(), to = req.stsTc();
        boolean ok = (STS_DRAFT.equals(from) && STS_IN_PROGRESS.equals(to))
                || (STS_IN_PROGRESS.equals(from) && STS_DONE.equals(to));
        if (!ok) throw new IllegalStateException("허용되지 않은 상태 전이입니다: " + from + " → " + to);
        e.changeStatus(to);
    }

    @Transactional
    public void saveResult(String docNo, DeliberationDto.ResultRequest req, CustomUserDetails user) {
        Bdelim e = loadCurrent(docNo);
        if (!STS_IN_PROGRESS.equals(e.getStsTc())) throw new IllegalStateException("진행중 상태에서만 심의 결과를 입력할 수 있습니다.");
        String omt = req.taskDbrOmtYn() == null ? "N" : req.taskDbrOmtYn();
        e.updateResult(req.taskDbrTc(), req.taskDbrRltTc(), req.taskDbrDt(), req.taskDbrTod(),
                omt, req.taskDbrOmtRsn(), req.opnnCone(), req.apvTrdnRsnCone());
    }

    public DeliberationDto.Detail get(String docNo) {
        Bdelim e = loadCurrent(docNo);
        String tgtNm = resolveTargetName(e.getBgPrnTc(), e.getCncdRfrNo());
        return new DeliberationDto.Detail(
                e.getDocMngNo(), e.getDocVrsSno(), e.getBgPrnTc(), e.getCncdRfrNo(), tgtNm,
                e.getStsTc(), e.getReqCone(), e.getTaskDbrTc(), e.getTaskDbrRltTc(), e.getTaskDbrDt(),
                e.getTaskDbrTod(), e.getTaskDbrOmtYn(), e.getTaskDbrOmtRsn(), e.getOpnnCone(), e.getApvTrdnRsnCone(),
                e.getFstEnrUsid(), e.getFstEnrDtm());
    }

    /** 대상명 해석: 사업이면 ABUS_NM, 전산업무비면 해당 명칭. 없으면 null. */
    private String resolveTargetName(String bgPrnTc, String cncdRfrNo) {
        if (TGT_PROJECT.equals(bgPrnTc)) {
            return projectRepository.findByAbusMngNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N")
                    .map(p -> p.getAbusNm()).orElse(null);
        }
        if (TGT_COST.equals(bgPrnTc)) {
            return costRepository.findByBgNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N")
                    .map(c -> c.getXxxNm()).orElse(null); // 실제 전산업무비 명칭 getter로 교체
        }
        return null;
    }

    public List<DeliberationDto.ListItem> list(String stsTc, String bgPrnTc, String cncdRfrNo, CustomUserDetails user) {
        String bbrC = user.isAdmin() ? null : user.getBbrC();
        return deliberationRepository.search(stsTc, bgPrnTc, cncdRfrNo, bbrC);
    }

    Bdelim loadCurrent(String docNo) {
        return deliberationRepository.findByDocMngNoAndLstYnAndDelYn(docNo, "Y", "N")
                .orElseThrow(() -> new IllegalArgumentException("과업심의 문서를 찾을 수 없습니다: " + docNo));
    }
}
```
> `costRepository.existsByBgNoAndLstYnAndDelYn` / `findByBgNoAndLstYnAndDelYn`, `c.getXxxNm()`(전산업무비 명칭)는 실제 `Bcostm`/`CostRepository`로 교체. `p.getAbusNm()`/`findByAbusMngNoAndLstYnAndDelYn`는 Stage ① 기준 존재.

- [ ] **Step 4: 통과 확인** — `./gradlew test --tests "*DeliberationServiceTest*"` → PASS (9 tests).
- [ ] **Step 5: 커밋** — `git add ...service/DeliberationService.java ...DeliberationServiceTest.java ...cost/repository/CostRepository.java && git commit -m "feat(deliberation): 서비스(생성/전이/수정·삭제/결과입력/조회) + 테스트"`

---

### Task 7: Controller + WebMvc 테스트

**Files:** Create `controller/DeliberationController.java`, Test `controller/DeliberationControllerTest.java`. (레퍼런스: `EstimateController(Test)` — `TestSecurityConfig`+`@WithMockUser`+`@MockitoBean JwtUtil/CustomUserDetailsService` 패턴 그대로)

- [ ] **Step 1: 실패 테스트** — `EstimateControllerTest`와 동일 보안 와이어링. 최소: 비인증 401, `POST /api/project/deliberations` → 201 + 문서번호, `POST /{docNo}/status` → 200.

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests "*DeliberationControllerTest*"`.

- [ ] **Step 3: 컨트롤러 작성** (기준경로 `/api/project/deliberations`; 모든 `@RequestParam`/`@PathVariable`에 `name=` 명시; mutation `@Valid`; 클래스 ADMIN 전용 아님)
```java
package com.kdb.it.domain.deliberation.controller;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.deliberation.dto.DeliberationDto;
import com.kdb.it.domain.deliberation.service.DeliberationService;
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

@RestController
@RequestMapping("/api/project/deliberations")
@RequiredArgsConstructor
@Tag(name = "Deliberation", description = "과업심의위원회 API")
public class DeliberationController {

    private final DeliberationService deliberationService;

    @Operation(summary = "과업심의 목록")
    @GetMapping
    public ResponseEntity<List<DeliberationDto.ListItem>> list(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "prnTc", required = false) String prnTc,
            @RequestParam(name = "cncdRfrNo", required = false) String cncdRfrNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(deliberationService.list(status, prnTc, cncdRfrNo, user));
    }

    @Operation(summary = "과업심의 상세")
    @GetMapping("/{docNo}")
    public ResponseEntity<DeliberationDto.Detail> get(@PathVariable(name = "docNo") String docNo) {
        return ResponseEntity.ok(deliberationService.get(docNo));
    }

    @Operation(summary = "과업심의 신규 신청")
    @PostMapping
    public ResponseEntity<String> create(@RequestBody @Valid DeliberationDto.CreateRequest req,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(deliberationService.create(req, user));
    }

    @Operation(summary = "과업심의 마스터 수정(작성중)")
    @PutMapping("/{docNo}")
    public ResponseEntity<Void> update(@PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid DeliberationDto.UpdateRequest req, @AuthenticationPrincipal CustomUserDetails user) {
        deliberationService.update(docNo, req, user); return ResponseEntity.ok().build();
    }

    @Operation(summary = "과업심의 삭제(작성중)")
    @DeleteMapping("/{docNo}")
    public ResponseEntity<Void> delete(@PathVariable(name = "docNo") String docNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        deliberationService.delete(docNo, user); return ResponseEntity.noContent().build();
    }

    @Operation(summary = "과업심의 상태 전이(제출/완료)")
    @PostMapping("/{docNo}/status")
    public ResponseEntity<Void> changeStatus(@PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid DeliberationDto.StatusRequest req, @AuthenticationPrincipal CustomUserDetails user) {
        deliberationService.changeStatus(docNo, req, user); return ResponseEntity.ok().build();
    }

    @Operation(summary = "과업심의 결과 입력(진행중)")
    @PutMapping("/{docNo}/result")
    public ResponseEntity<Void> saveResult(@PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid DeliberationDto.ResultRequest req, @AuthenticationPrincipal CustomUserDetails user) {
        deliberationService.saveResult(docNo, req, user); return ResponseEntity.ok().build();
    }
}
```

- [ ] **Step 4: 통과 + 전체 회귀** — `./gradlew test --tests "*DeliberationControllerTest*"` PASS, 이어서 `./gradlew test` 전체 GREEN(개수 보고).
- [ ] **Step 5: 커밋** — `git add ...controller/ ...DeliberationControllerTest.java && git commit -m "feat(deliberation): 컨트롤러(CRUD/상태/결과) + WebMvc 테스트"`

---

## Stage ② 프론트엔드

### Task 8: 타입 + 컴포저블 + 화면

레퍼런스: estimate의 `types/estimate.ts`, `composables/useEstimates.ts`, `pages/project/estimate/*` 를 그대로 복제·치환. 차이점만 명시.

- [ ] **Step 1: `app/types/deliberation.ts`** — `DeliberationListItem`/`DeliberationDetail`/`DeliberationCreateRequest`/`DeliberationResultRequest` (백엔드 DTO 미러) + 상수:
```typescript
export const DELIB_STATUS = { DRAFT: '51', IN_PROGRESS: '52', DONE: '59' } as const;
export const DELIB_STATUS_LABEL: Record<string,string> = { '51':'작성중','52':'진행중','59':'완료' };
export const TGT_LABEL: Record<string,string> = { '100':'정보화사업','200':'전산업무비' };
export const DELIB_RESULT_LABEL: Record<string,string> = { '01':'승인','02':'반려','03':'조건부' };
```

- [ ] **Step 2: `app/composables/useDeliberations.ts`** — `useEstimates` 구조 복제, 기준경로 `${apiBase}/api/project/deliberations`. 메서드: `fetchDeliberations(query?)`, `fetchDeliberation(docNo)`(useApiFetch); `createDeliberation(body)`→string, `updateDeliberation(docNo,{reqCone})`, `deleteDeliberation(docNo)`, `changeStatus(docNo,stsTc)`(POST `/status`), `saveResult(docNo, resultBody)`(PUT `/result`) (모두 `$apiFetch`, void는 `$apiFetch<undefined>`). + 유닛테스트(`useDeliberations.test.ts`, `useEstimates.test.ts` 패턴) — `createDeliberation`가 올바른 URL+POST.

- [ ] **Step 3: `app/pages/project/deliberation/index.vue`** (목록 + 신규 신청 모달) — estimate `index.vue` 복제. 컬럼: 대상구분(TGT_LABEL), 대상번호(cncdRfrNo, 상세 링크), 상태(DELIB_STATUS_LABEL), 심의결과(DELIB_RESULT_LABEL), 요청자, 요청일시(formatDateTime). **신규 신청 모달 차이점**: 먼저 `대상구분`(Select: 정보화사업/전산업무비) 선택 → 그에 따라 대상 목록 로드(`100`이면 `useProjects().fetchProjects()` + `abusMngNo`, `200`이면 전산업무비 목록 composable/엔드포인트 + `BG_NO`) → 대상 선택 + 요청내용 → `createDeliberation({ bgPrnTc, cncdRfrNo, reqCone })`.

- [ ] **Step 4: `app/pages/project/deliberation/[docNo].vue`** (상태분기 상세) — estimate `[docNo].vue` 복제하되 **팀 그리드 대신 심의결과 폼**:
  - 헤더: 대상명(`detail.tgtNm ?? detail.cncdRfrNo`) + 대상구분 배지(TGT_LABEL) + 상태 Tag. 정보바: 문서번호/대상구분/요청자/요청일시.
  - 요청내용: 작성중(51)에서만 편집 → [저장][신청 제출(→52)][삭제]. `watch(detail, d=>reqCone=d?.reqCone??'')`로 동기화.
  - 심의 결과 영역(진행중 52에서 편집, 완료 59 읽기전용): 심의구분(taskDbrTc), 심의회차(taskDbrTod), 심의일자(taskDbrDt), 심의결과(taskDbrRltTc Select: 승인/반려/조건부), 생략여부(taskDbrOmtYn 토글)+생략사유(taskDbrOmtRsn), 의견(opnnCone Textarea max 1000), 반려사유(apvTrdnRsnCone Textarea max 300, 결과=반려일 때 노출 권장). 진행중 버튼 [결과 저장(saveResult)][완료 확정(→59)].
  - 완료(59): 전체 읽기전용.
  - 날짜 표시는 공통 유틸(`formatDateTime`) 사용. maxlength는 DTO와 일치(요청내용 300, 의견 1000, 생략사유 200, 반려사유 300).

- [ ] **Step 5: 검증** — `cd it_frontend && npm run typecheck && npm run lint && npm test -- useDeliberations` 통과.
- [ ] **Step 6: 커밋** (it_frontend, 논리 단위로 분할) — types / composable+test / index / detail.

---

### Task 9: 메뉴 시드 + 부서필터 백로그 + 통합 E2E

- [ ] **Step 1: 메뉴 시드** `it_database/migrations/V20260607_007__SeedDeliberationMenu.sql` — Stage ① 메뉴(`V20260607_003`)와 동일 절차: 라이브 메뉴 스키마 확인(HED/GRP/LNK, 부모 그룹 `MINF0015`/`사업/예산` 헤더) → 라우트 카탈로그(`/project/deliberation`) + 메뉴 LNK(신규 MNU_ID 예 `MINF0024`, 부모 `MINF0015`, depth 3) + 권한(estimate `MINF0023`와 동일 정책 — CMENUA 행 없음=전체 인증 사용자). 실행 후 사이드바 노출 확인. 커밋(it_database).
- [ ] **Step 2: 부서필터 백로그** — `C:\it\TASK.md`에 "과업심의 목록 부서(bbrC) 필터 미적용(대상 2종 join 복잡) — 후속 고도화" 등록. 커밋(외부 리포).
- [ ] **Step 3: 통합 E2E (수동/Playwright)** — 두 서버 기동 → 사이드바 "과업심의위원회" 진입 → 신규 신청(대상구분 사업/전산업무비 각 1건) → 작성중 저장/제출 → 진행중 심의결과 입력(승인/반려/조건부, 생략여부) → 결과 저장 → 완료 확정(읽기전용) → 목록 표시. 콘솔 에러 0 확인. (검증용 데이터는 종료 후 soft-delete 정리.)
- [ ] **Step 4: 전체 회귀** — `cd it_backend && ./gradlew test`; `cd it_frontend && npm test && npm run typecheck`.

---

## Self-Review (작성자 체크)

- **Spec 커버리지**: §3.3 ②(BDELIM 마스터+로그) → Task 2-3, 상태전이 §4(51/52/59) → Task 6, 화면 §5(목록/상세/심의결과 폼) → Task 8, API §6(목록/상세/생성/수정/삭제/상태/result) → Task 7, 검증 §7(대상/중복/전이/작성중·진행중) → Task 6, 공통코드 §3.4(TASK_DBR_RLT_TC) → Task 1, 메뉴 §2.2 → Task 9. **Stage ①과 차이**: 마스터 only(명세/그리드 없음), 대상 2종(사업+전산업무비)·검증 분기, 작업입력=결과 PUT(`/result`), 부서필터 MVP 미적용(백로그).
- **플레이스홀더**: 코드 단계는 실제 코드. 프론트 화면(Task 8)·`BdelimL`는 estimate 레퍼런스를 명시해 치환 지시 — 실행 시 해당 레퍼런스 복제·치환. `CostRepository` finder명/전산업무비 명칭 getter는 실제 `Bcostm` 확인 후 확정(Task 5 Step1).
- **타입 일관성**: 상태 51/52/59, 대상 100/200, 결과 01/02/03을 백엔드 상수·프론트 상수·공통코드에서 동일 사용. 문서번호 `DLB-{YYYY}-{4}`.
- **실행 리스크**: (1) 마이그레이션 번호 충돌 시 다음 번호로. (2) 로그 시퀀스 `SEQ_BDELIL` 명 = `AuditLogIdGenerator` 규칙. (3) 전산업무비 대상 검증/명칭은 `Bcostm` 실제 스키마 확인 필요(Task 5/6 교체 지점 명시). (4) 부서필터 미적용은 의도된 MVP 결정(백로그 등록).

---

## Execution Handoff

Stage ② 완료 후 Stage ③(입찰/계약, `Bcontm` 마스터 only, `CTT_*` + `CTT_MANR_C` 코드), Stage ④(대금지급, `Bpaymm`+`Bpaymt` 명세, `DFR_*`)도 동일 패턴으로 각각 별도 플랜 작성.
