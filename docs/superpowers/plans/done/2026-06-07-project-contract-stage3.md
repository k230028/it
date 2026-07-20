# 입찰/계약 (Stage ③) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보화사업(`TPRMPP_BPROJM`) 또는 전산업무비(`TPRMPP_BCOSTM`)에 대한 입찰/계약 신청/작업 화면(MVP)을 풀스택으로 구현한다 — 신청자가 입찰/계약을 의뢰하고, 작업자(IT계약팀/관리자)가 계약방법(협상에의한계약·규격가격동시·수의계약 등)·계약명·계약금액·상대처·계약일자를 입력·완료한다.

**Architecture:** 설계서 A안 세 번째 수직 슬라이스. **마스터 단일 테이블**(`Bcontm`, 명세 없음), 상태 3단(작성중 61 → 진행중 62 → 완료 69, 공통코드 `IT_PTL_STS_TC`). 대상은 사업/전산업무비 **둘 다 가능**(`BG_PRN_TC` 100/200 + `CNCD_RFR_NO`). Stage ②(과업심의)와 **거의 동일한 구조**(마스터 only + 대상 2종 + 작업입력 PUT) — 차이는 업무 필드(계약 정보)와 상태/도메인뿐이다.

**Tech Stack:** Spring Boot 4 / Java 25 / Spring Data JPA + QueryDSL / Oracle (ddl-auto=**validate** → 마이그레이션 선행 필수) / JUnit5 + Mockito + AssertJ / Nuxt 4 + PrimeVue + Vitest.

**설계서(SoT):** `docs/superpowers/specs/2026-06-07-project-execution-stages-design.md` (§3.3 ③, §4, §5, §6)
**선행 참조 플랜(거의 동일 구조 — 복제 기준):** `docs/superpowers/plans/2026-06-07-project-deliberation-stage2.md` (Stage ② 과업심의), `docs/superpowers/plans/2026-06-07-project-estimate-stage1.md` (Stage ①)

---

## 핵심 규약 (작업 전 필독 — Stage ①/②와 동일)

- **마이그레이션 선행**: `ddl-auto=validate`. 엔티티보다 테이블 DDL을 먼저 적용. `it_database/migrations/V{YYYYMMDD_NNN}__*.sql` (적용 전 `ls`로 최신 번호 확인 — Stage ②가 005/006/007 사용, 본 플랜은 `008/009/010` 가정, 충돌 시 다음 번호로 일괄 조정).
- **로그 테이블/시퀀스**: `AuditLogIdGenerator`가 로그 엔티티 `@Table` 명의 `_` 뒤로 `SEQ_<X>` 호출. 마스터 `TPRMPP_BCONTM` → 로그 `TPRMPP_BCONTL` → 시퀀스 `SEQ_BCONTL`. 문서번호 채번 시퀀스 `SEQ_BCONTM`.
- **감사 컬럼 타입**(메뉴/estimate/deliberation 마이그레이션과 동일): `FST_ENR_DTM`/`LST_CHG_DTM`=`DATE`, `GUID_PRG_SNO`=`NUMBER(4,0)`, 로그 PK `LOG_HIS_TGR_SNO`=`NUMBER(18,0)`, 로그 `CHG_DTM`=`TIMESTAMP(9)`.
- **메타 용어 고정**(설계서 부록 A, 전부 메타 실재): `DOC_MNG_NO`(문서번호), `DOC_VRS_SNO`(버전), `LST_YN`, `BG_PRN_TC`(대상구분 100/200), `CNCD_RFR_NO`(대상관리번호=사업 `ABUS_MNG_NO` 또는 전산업무비 `BG_NO`), `IT_PTL_STS_TC`(상태), `REQ_CONE`(요청내용), `CTT_MANR_C`(계약방법코드), `CTT_MANR_RSN`(계약방법사유), `CTT_NM`(계약명), `CTT_AMT`(계약금액), `CTT_OPP_NM`(계약상대처명), `CTT_DT`(계약일자).
- **상태**: 61(작성중) → 62(진행중) → 69(완료). 인접 전이만 허용.
- **DB 접속**: `it_database/apply-ddl-live.ps1` creds (ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1, sqlplus; `export NLS_LANG=KOREAN_KOREA.AL32UTF8`).
- **테스트**: 백엔드 `cd it_backend && ./gradlew test`, 프론트 `cd it_frontend && npm test`/`npm run typecheck`.
- **GIT 위생(동시 작업 주의)**: it_backend에 다른 세션의 미커밋/stash 작업이 있을 수 있음. 서브에이전트는 **`infra/eai/**` 등 타 작업 파일 금지, `git add -A`/`git stash`/`git checkout <branch>`/`git reset` 금지**, contract 경로만 명시적으로 `git add`. 작업 브랜치는 각 서브리포 `feat/project-contract-stage3`(it_database는 기존 관례대로 main).

---

## 파일 구조

**DB 마이그레이션 (`it_database/migrations/`)**
- Create: `V20260607_008__CreateContractTables.sql` (BCONTM + 로그 BCONTL + 시퀀스)
- Create: `V20260607_009__SeedCttManrC.sql` (공통코드 CTT_MANR_C)
- Create: `V20260607_010__SeedContractMenu.sql` (메뉴)

**백엔드 (`it_backend/src/main/java/com/kdb/it/domain/contract/`)**
- Create: `entity/Bcontm.java`, `entity/BcontmId.java`, `domain/log/entity/BcontmL.java`
- Create: `dto/ContractDto.java`
- Create: `repository/ContractRepository.java`, `repository/ContractRepositoryCustom.java`, `repository/ContractRepositoryImpl.java`
- Create: `service/ContractService.java`
- Create: `controller/ContractController.java`
- (대상 검증 finder는 Stage ①/②에서 추가된 `ProjectRepository.existsByAbusMngNoAndLstYnAndDelYn`/`findByAbusMngNoAndLstYnAndDelYn`, `CostRepository.existsByCostBgNoAndLstYnAndDelYn`/`findByCostBgNoAndLstYnAndDelYn` 재사용 — 신규 추가 불필요)
- Test: `service/ContractServiceTest.java`, `controller/ContractControllerTest.java`

**프론트엔드 (`it_frontend/`)**
- Create: `app/types/contract.ts`, `app/composables/useContracts.ts`
- Create: `app/pages/project/contract/index.vue`, `app/pages/project/contract/[docNo].vue`
- Test: `tests/unit/composables/useContracts.test.ts`

---

## Stage ③ 백엔드

### Task 1: 공통코드 `CTT_MANR_C` 등록 (계약방법)

**Files:** Create `it_database/migrations/V20260607_009__SeedCttManrC.sql` (적용 전 번호 확인)

- [ ] **Step 1: 마이그레이션 작성** (`TPRMPP_CCODEM` 컬럼은 Stage ①/② 코드 시드와 동일)

```sql
-- V20260607_009__SeedCttManrC.sql
-- 계약방법코드(CTT_MANR_C): 01 협상에의한계약 / 02 규격가격동시 / 03 수의계약 / 04 일반경쟁.
-- 멱등: 그룹 DELETE 후 재INSERT. (국가계약법 기준 — 값은 운영 확정 시 보강)
DELETE FROM ITPAPP.TPRMPP_CCODEM WHERE CO_C_ID = 'CTT_MANR_C';
INSERT INTO ITPAPP.TPRMPP_CCODEM (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN)
VALUES ('CTT_MANR_C', '01', DATE '2026-01-01', DATE '9999-12-31', '계약방법', '협상에의한계약', 1, 'MIGRATION', SYSDATE, 'N');
INSERT INTO ITPAPP.TPRMPP_CCODEM (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN)
VALUES ('CTT_MANR_C', '02', DATE '2026-01-01', DATE '9999-12-31', '계약방법', '규격가격동시', 2, 'MIGRATION', SYSDATE, 'N');
INSERT INTO ITPAPP.TPRMPP_CCODEM (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN)
VALUES ('CTT_MANR_C', '03', DATE '2026-01-01', DATE '9999-12-31', '계약방법', '수의계약', 3, 'MIGRATION', SYSDATE, 'N');
INSERT INTO ITPAPP.TPRMPP_CCODEM (CO_C_ID, CDVA_ID, STT_DTM, END_DTM, CO_C_NM, CDVA_NM, C_SQN_SNO, FST_ENR_USID, FST_ENR_DTM, DEL_YN)
VALUES ('CTT_MANR_C', '04', DATE '2026-01-01', DATE '9999-12-31', '계약방법', '일반경쟁', 4, 'MIGRATION', SYSDATE, 'N');
COMMIT;
```

- [ ] **Step 2: 실행 + 검증** — `SELECT CDVA_ID, CDVA_NM FROM TPRMPP_CCODEM WHERE CO_C_ID='CTT_MANR_C' ORDER BY C_SQN_SNO;` → 4행.
- [ ] **Step 3: 커밋** — `cd it_database && git add migrations/V20260607_009__SeedCttManrC.sql && git commit -m "feat(db): 계약방법코드(CTT_MANR_C) 등록(협상/규격가격동시/수의/일반경쟁)"`

---

### Task 2: 테이블/로그/시퀀스 마이그레이션

**Files:** Create `it_database/migrations/V20260607_008__CreateContractTables.sql`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- V20260607_008__CreateContractTables.sql
-- 입찰/계약 마스터(BCONTM, 명세 없음) + 변경로그(BCONTL) + 시퀀스.
-- ddl-auto=validate 이므로 엔티티 작성 전 본 스크립트를 먼저 실행.

CREATE TABLE TPRMPP_BCONTM (
  DOC_MNG_NO     VARCHAR2(20 CHAR)  NOT NULL,
  DOC_VRS_SNO    NUMBER(9,0)        NOT NULL,
  LST_YN         VARCHAR2(1 CHAR)   DEFAULT 'Y' NOT NULL,
  BG_PRN_TC      VARCHAR2(3 CHAR)   NOT NULL,
  CNCD_RFR_NO    VARCHAR2(30 CHAR)  NOT NULL,
  IT_PTL_STS_TC  VARCHAR2(2 CHAR)   NOT NULL,
  REQ_CONE       VARCHAR2(300 CHAR),
  CTT_MANR_C     VARCHAR2(2 CHAR),
  CTT_MANR_RSN   VARCHAR2(1000 CHAR),
  CTT_NM         VARCHAR2(100 CHAR),
  CTT_AMT        NUMBER(18,3),
  CTT_OPP_NM     VARCHAR2(100 CHAR),
  CTT_DT         VARCHAR2(8 CHAR),
  DEL_YN         VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
  GUID           VARCHAR2(38 CHAR),
  GUID_PRG_SNO   NUMBER(4,0),
  FST_ENR_DTM    DATE,
  FST_ENR_USID   VARCHAR2(14 CHAR),
  LST_CHG_DTM    DATE,
  LST_CHG_USID   VARCHAR2(14 CHAR),
  CONSTRAINT PK_TPRMPP_BCONTM PRIMARY KEY (DOC_MNG_NO, DOC_VRS_SNO),
  CONSTRAINT CK_BCONTM_LST_YN CHECK (LST_YN IN ('Y','N')),
  CONSTRAINT CK_BCONTM_DEL_YN CHECK (DEL_YN IN ('Y','N'))
);
COMMENT ON TABLE  TPRMPP_BCONTM                IS '입찰계약 기본';
COMMENT ON COLUMN TPRMPP_BCONTM.DOC_MNG_NO     IS '문서관리번호';
COMMENT ON COLUMN TPRMPP_BCONTM.DOC_VRS_SNO    IS '문서버전일련번호';
COMMENT ON COLUMN TPRMPP_BCONTM.LST_YN         IS '최종여부';
COMMENT ON COLUMN TPRMPP_BCONTM.BG_PRN_TC      IS '예산성격구분코드(대상구분)';
COMMENT ON COLUMN TPRMPP_BCONTM.CNCD_RFR_NO    IS '관련참조번호(대상관리번호)';
COMMENT ON COLUMN TPRMPP_BCONTM.IT_PTL_STS_TC  IS 'IT포탈상태구분코드';
COMMENT ON COLUMN TPRMPP_BCONTM.REQ_CONE       IS '요청내용';
COMMENT ON COLUMN TPRMPP_BCONTM.CTT_MANR_C     IS '계약방법코드';
COMMENT ON COLUMN TPRMPP_BCONTM.CTT_MANR_RSN   IS '계약방법사유';
COMMENT ON COLUMN TPRMPP_BCONTM.CTT_NM         IS '계약명';
COMMENT ON COLUMN TPRMPP_BCONTM.CTT_AMT        IS '계약금액';
COMMENT ON COLUMN TPRMPP_BCONTM.CTT_OPP_NM     IS '계약상대처명';
COMMENT ON COLUMN TPRMPP_BCONTM.CTT_DT         IS '계약일자';
CREATE INDEX IDX_BCONTM_TGT ON TPRMPP_BCONTM (BG_PRN_TC, CNCD_RFR_NO);
CREATE INDEX IDX_BCONTM_STS ON TPRMPP_BCONTM (IT_PTL_STS_TC);

CREATE TABLE TPRMPP_BCONTL (
  LOG_HIS_TGR_SNO NUMBER(18,0) NOT NULL,
  CHG_DTT_YN      VARCHAR2(1 CHAR),
  CHG_DTM         TIMESTAMP(9),
  CHG_USID        VARCHAR2(14 CHAR),
  DEL_YN          VARCHAR2(1 CHAR),
  GUID            VARCHAR2(38 CHAR),
  GUID_PRG_SNO    NUMBER(4,0),
  FST_ENR_DTM     DATE,
  FST_ENR_USID    VARCHAR2(14 CHAR),
  LST_CHG_DTM     DATE,
  LST_CHG_USID    VARCHAR2(14 CHAR),
  DOC_MNG_NO      VARCHAR2(20 CHAR),
  DOC_VRS_SNO     NUMBER(9,0),
  LST_YN          VARCHAR2(1 CHAR),
  BG_PRN_TC       VARCHAR2(3 CHAR),
  CNCD_RFR_NO     VARCHAR2(30 CHAR),
  IT_PTL_STS_TC   VARCHAR2(2 CHAR),
  REQ_CONE        VARCHAR2(300 CHAR),
  CTT_MANR_C      VARCHAR2(2 CHAR),
  CTT_MANR_RSN    VARCHAR2(1000 CHAR),
  CTT_NM          VARCHAR2(100 CHAR),
  CTT_AMT         NUMBER(18,3),
  CTT_OPP_NM      VARCHAR2(100 CHAR),
  CTT_DT          VARCHAR2(8 CHAR),
  CONSTRAINT PK_TPRMPP_BCONTL PRIMARY KEY (LOG_HIS_TGR_SNO)
);
COMMENT ON TABLE TPRMPP_BCONTL IS '입찰계약 기본 변경 로그';

CREATE SEQUENCE SEQ_BCONTM START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;  -- 문서번호 채번
CREATE SEQUENCE SEQ_BCONTL START WITH 1 INCREMENT BY 1 CACHE 20 NOCYCLE;  -- 로그 PK
```

- [ ] **Step 2: 실행 + 검증** — `user_tables` IN ('TPRMPP_BCONTM','TPRMPP_BCONTL') → 2행; `user_sequences` IN ('SEQ_BCONTM','SEQ_BCONTL') → 2행.
- [ ] **Step 3: 커밋** — `cd it_database && git add migrations/V20260607_008__CreateContractTables.sql && git commit -m "feat(db): 입찰계약 테이블/로그/시퀀스 생성(BCONTM/BCONTL)"`

---

### Task 3: 엔티티 `Bcontm` + `BcontmId` + 로그 `BcontmL`

**Files:** Create `entity/Bcontm.java`, `entity/BcontmId.java`, `domain/log/entity/BcontmL.java`. (레퍼런스: deliberation `Bdelim`/`BdelimId`/`BdelimL` — 동일 구조, IdClass에 @Column 없음)

- [ ] **Step 1: 복합키 `BcontmId.java`**
```java
package com.kdb.it.domain.contract.entity;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 입찰계약 마스터(Bcontm) 복합 기본키. (문서관리번호 + 문서버전일련번호) */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BcontmId implements Serializable {
    private String docMngNo;
    private Integer docVrsSno;
}
```

- [ ] **Step 2: 엔티티 `Bcontm.java`**
```java
package com.kdb.it.domain.contract.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.BcontmL;
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
 * 입찰계약 기본(마스터) 엔티티.
 *
 * <p>DB 테이블: {@code TPRMPP_BCONTM}. 정보화사업/전산업무비에 대한 입찰/계약을 관리한다.</p>
 * <p>대상구분 {@code BG_PRN_TC}: 100=정보화사업, 200=전산업무비. 상태 61→62→69.</p>
 */
@LogTarget(entity = BcontmL.class)
@Entity
@Table(name = "TPRMPP_BCONTM", comment = "입찰계약 기본")
@IdClass(BcontmId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Bcontm extends BaseEntity {

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

    @Column(name = "CTT_MANR_C", length = 2, comment = "계약방법코드")
    private String cttManrC;

    @Column(name = "CTT_MANR_RSN", length = 1000, comment = "계약방법사유")
    private String cttManrRsn;

    @Column(name = "CTT_NM", length = 100, comment = "계약명")
    private String cttNm;

    @Column(name = "CTT_AMT", precision = 18, scale = 3, comment = "계약금액")
    private BigDecimal cttAmt;

    @Column(name = "CTT_OPP_NM", length = 100, comment = "계약상대처명")
    private String cttOppNm;

    @Column(name = "CTT_DT", length = 8, comment = "계약일자")
    private String cttDt;

    /** 요청내용 수정 (작성중에서만 서비스가 호출) */
    public void updateRequest(String reqCone) {
        this.reqCone = reqCone;
    }

    /** 계약 정보 입력 (진행중에서만 서비스가 호출) */
    public void updateContract(String cttManrC, String cttManrRsn, String cttNm,
                               BigDecimal cttAmt, String cttOppNm, String cttDt) {
        this.cttManrC = cttManrC;
        this.cttManrRsn = cttManrRsn;
        this.cttNm = cttNm;
        this.cttAmt = cttAmt;
        this.cttOppNm = cttOppNm;
        this.cttDt = cttDt;
    }

    /** 상태 전이 (서비스의 changeStatus에서만 호출) */
    public void changeStatus(String stsTc) {
        this.stsTc = stsTc;
    }
}
```

- [ ] **Step 3: 로그 `BcontmL.java`** (`@Table(name="TPRMPP_BCONTL")` → 시퀀스 `SEQ_BCONTL`)
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

/** 입찰계약 기본(TPRMPP_BCONTM) 변경 로그. */
@Entity
@Table(name = "TPRMPP_BCONTL", comment = "입찰계약 기본 변경 로그")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class BcontmL extends BaseLogEntity {
    @Column(name = "DOC_MNG_NO", length = 20, comment = "문서관리번호") private String docMngNo;
    @Column(name = "DOC_VRS_SNO", comment = "문서버전일련번호") private Integer docVrsSno;
    @Column(name = "LST_YN", length = 1, comment = "최종여부") private String lstYn;
    @Column(name = "BG_PRN_TC", length = 3, comment = "예산성격구분코드(대상구분)") private String bgPrnTc;
    @Column(name = "CNCD_RFR_NO", length = 30, comment = "관련참조번호(대상관리번호)") private String cncdRfrNo;
    @Column(name = "IT_PTL_STS_TC", length = 2, comment = "IT포탈상태구분코드") private String stsTc;
    @Column(name = "REQ_CONE", length = 300, comment = "요청내용") private String reqCone;
    @Column(name = "CTT_MANR_C", length = 2, comment = "계약방법코드") private String cttManrC;
    @Column(name = "CTT_MANR_RSN", length = 1000, comment = "계약방법사유") private String cttManrRsn;
    @Column(name = "CTT_NM", length = 100, comment = "계약명") private String cttNm;
    @Column(name = "CTT_AMT", precision = 18, scale = 3, comment = "계약금액") private BigDecimal cttAmt;
    @Column(name = "CTT_OPP_NM", length = 100, comment = "계약상대처명") private String cttOppNm;
    @Column(name = "CTT_DT", length = 8, comment = "계약일자") private String cttDt;
}
```

- [ ] **Step 4: 부팅 validate** — `cd it_backend && ./gradlew compileJava test --tests "*ApplicationTests*"`. 엔티티↔BCONTM/BCONTL 정합 확인. (CTT_AMT는 NUMBER(18,3)↔BigDecimal precision/scale 일치 필수.)
- [ ] **Step 5: 커밋** — `cd it_backend && git add src/main/java/com/kdb/it/domain/contract/entity/ src/main/java/com/kdb/it/domain/log/entity/BcontmL.java && git commit -m "feat(contract): 입찰계약 마스터 엔티티/복합키/변경로그 추가"`

---

### Task 4: DTO `ContractDto`

**Files:** Create `dto/ContractDto.java`

- [ ] **Step 1: 작성** (정적 중첩 record + `@Schema`)
```java
package com.kdb.it.domain.contract.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** 입찰계약 API 요청/응답 DTO 모음. */
public final class ContractDto {
    private ContractDto() {}

    @Schema(name = "ContractCreateRequest", description = "입찰계약 신규 의뢰 요청")
    public record CreateRequest(
            @NotBlank @Size(max = 3) String bgPrnTc,     // 100 사업 / 200 전산업무비
            @NotBlank @Size(max = 30) String cncdRfrNo,  // 대상 관리번호
            @Size(max = 300) String reqCone
    ) {}

    @Schema(name = "ContractUpdateRequest", description = "입찰계약 마스터 수정(작성중)")
    public record UpdateRequest(@Size(max = 300) String reqCone) {}

    @Schema(name = "ContractStatusRequest", description = "입찰계약 상태 전이")
    public record StatusRequest(@NotBlank @Size(max = 2) String stsTc) {}

    @Schema(name = "ContractWorkRequest", description = "계약 정보 입력(진행중)")
    public record WorkRequest(
            @Size(max = 2) String cttManrC,
            @Size(max = 1000) String cttManrRsn,
            @Size(max = 100) String cttNm,
            BigDecimal cttAmt,
            @Size(max = 100) String cttOppNm,
            @Size(max = 8) String cttDt
    ) {}

    @Schema(name = "ContractListItem", description = "입찰계약 목록 항목")
    public record ListItem(
            String docMngNo, Integer docVrsSno, String bgPrnTc, String cncdRfrNo,
            String stsTc, String cttNm, BigDecimal cttAmt, String reqUsid, java.time.LocalDateTime reqDtm
    ) {}

    @Schema(name = "ContractDetail", description = "입찰계약 상세")
    public record Detail(
            String docMngNo, Integer docVrsSno, String bgPrnTc, String cncdRfrNo, String tgtNm,
            String stsTc, String reqCone, String cttManrC, String cttManrRsn, String cttNm,
            BigDecimal cttAmt, String cttOppNm, String cttDt,
            String reqUsid, java.time.LocalDateTime reqDtm
    ) {}
}
```

- [ ] **Step 2: compile + 커밋** — `./gradlew compileJava`; `git add ...dto/ContractDto.java && git commit -m "feat(contract): 입찰계약 DTO(record) 추가"`

---

### Task 5: Repository

**Files:** Create `repository/ContractRepository.java`, `ContractRepositoryCustom.java`, `ContractRepositoryImpl.java`. (레퍼런스: deliberation Repository — 거의 동일)

- [ ] **Step 1: 작성**
```java
// ContractRepository.java
package com.kdb.it.domain.contract.repository;

import com.kdb.it.domain.contract.entity.Bcontm;
import com.kdb.it.domain.contract.entity.BcontmId;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ContractRepository extends JpaRepository<Bcontm, BcontmId>, ContractRepositoryCustom {
    Optional<Bcontm> findByDocMngNoAndLstYnAndDelYn(String docMngNo, String lstYn, String delYn);

    @Query(nativeQuery = true, value = "SELECT SEQ_BCONTM.NEXTVAL FROM DUAL")
    Long nextDocSeq();

    boolean existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(
            String bgPrnTc, String cncdRfrNo, java.util.Collection<String> stsTc, String delYn);
}
```
```java
// ContractRepositoryCustom.java
package com.kdb.it.domain.contract.repository;

import com.kdb.it.domain.contract.dto.ContractDto;
import java.util.List;

public interface ContractRepositoryCustom {
    List<ContractDto.ListItem> search(String stsTc, String bgPrnTc, String cncdRfrNo, String bbrC);
}
```
```java
// ContractRepositoryImpl.java  (bbrC는 대상 2종이라 MVP 미적용 — deliberation과 동일)
package com.kdb.it.domain.contract.repository;

import com.kdb.it.domain.contract.dto.ContractDto;
import com.kdb.it.domain.contract.entity.QBcontm;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;

@RequiredArgsConstructor
public class ContractRepositoryImpl implements ContractRepositoryCustom {
    private final JPAQueryFactory queryFactory;

    @Override
    public List<ContractDto.ListItem> search(String stsTc, String bgPrnTc, String cncdRfrNo, String bbrC) {
        QBcontm c = QBcontm.bcontm;
        BooleanBuilder where = new BooleanBuilder();
        where.and(c.delYn.eq("N"));
        where.and(c.lstYn.eq("Y"));
        if (StringUtils.hasText(stsTc))     where.and(c.stsTc.eq(stsTc));
        if (StringUtils.hasText(bgPrnTc))   where.and(c.bgPrnTc.eq(bgPrnTc));
        if (StringUtils.hasText(cncdRfrNo)) where.and(c.cncdRfrNo.eq(cncdRfrNo));
        // bbrC: 대상 2종이라 단일 join 곤란 → MVP 미적용(후속 고도화).
        return queryFactory.select(Projections.constructor(ContractDto.ListItem.class,
                        c.docMngNo, c.docVrsSno, c.bgPrnTc, c.cncdRfrNo, c.stsTc, c.cttNm, c.cttAmt, c.fstEnrUsid, c.fstEnrDtm))
                .from(c).where(where).orderBy(c.fstEnrDtm.desc()).fetch();
    }
}
```
> Projections.constructor 컬럼 순서/타입이 `ListItem` 생성자(docMngNo,docVrsSno,bgPrnTc,cncdRfrNo,stsTc,cttNm,cttAmt(BigDecimal),reqUsid,reqDtm)와 정확히 일치해야 함.

- [ ] **Step 2: compile + 커밋** — `./gradlew compileJava` (QBcontm 생성); `git add ...repository/ && git commit -m "feat(contract): Repository(목록/현재버전/채번)"`

---

### Task 6: Service (TDD)

**Files:** Create `service/ContractService.java`, Test `service/ContractServiceTest.java`. (레퍼런스: `DeliberationService(Test)` — dual-target 검증/전이/조회 동일, 작업입력만 계약 필드)

상태 상수: `STS_DRAFT="61"`, `STS_IN_PROGRESS="62"`, `STS_DONE="69"`. 대상구분: `TGT_PROJECT="100"`, `TGT_COST="200"`. 문서번호 `CTR-{YYYY}-{4자리}`.

- [ ] **Step 1: 실패 테스트 작성** (Mockito; `DeliberationServiceTest` 패턴) — 케이스:
  1. create 사업 정상 → `matches("CTR-\\d{4}-0001")`.
  2. create 전산업무비 정상 → costRepository.existsByCostBgNoAndLstYnAndDelYn=true 경로.
  3. create 대상 미존재 → IllegalArgumentException("대상").
  4. create 중복(진행중 문서 존재) → IllegalStateException("진행 중").
  5. changeStatus 61→62 허용; 6. 69→62 거부.
  7. update(reqCone) 작성중 아님(62) → IllegalStateException.
  8. saveContract 진행중 아님(61) → IllegalStateException.
  9. saveContract 진행중(62) 정상 → 엔티티 cttNm/cttAmt 등 반영.
  mocks: ContractRepository, ProjectRepository, CostRepository. requester()=`new CustomUserDetails("E0001", List.of("ITPZZ001"), "18001")`.

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests "*ContractServiceTest*"`.

- [ ] **Step 3: 서비스 작성**
```java
package com.kdb.it.domain.contract.service;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.cost.repository.CostRepository;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.contract.dto.ContractDto;
import com.kdb.it.domain.contract.entity.Bcontm;
import com.kdb.it.domain.contract.repository.ContractRepository;
import java.time.Year;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 입찰계약 서비스. 상태 61→62→69. 대상구분 100=사업/200=전산업무비.
 * 쓰기 주체: 작성중=신청자/부서, 진행중 계약입력=작업자(IT계약팀). 상태 전이는 인접만 허용.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ContractService {

    static final String STS_DRAFT = "61";
    static final String STS_IN_PROGRESS = "62";
    static final String STS_DONE = "69";
    static final String TGT_PROJECT = "100";
    static final String TGT_COST = "200";

    private final ContractRepository contractRepository;
    private final ProjectRepository projectRepository;
    private final CostRepository costRepository;

    @Transactional
    public String create(ContractDto.CreateRequest req, CustomUserDetails user) {
        validateTarget(req.bgPrnTc(), req.cncdRfrNo());
        if (contractRepository.existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(
                req.bgPrnTc(), req.cncdRfrNo(), List.of(STS_DRAFT, STS_IN_PROGRESS), "N")) {
            throw new IllegalStateException("해당 대상에 진행 중인 입찰/계약이 이미 있습니다.");
        }
        String docNo = String.format("CTR-%d-%04d", Year.now().getValue(), contractRepository.nextDocSeq());
        contractRepository.save(Bcontm.builder()
                .docMngNo(docNo).docVrsSno(1).lstYn("Y")
                .bgPrnTc(req.bgPrnTc()).cncdRfrNo(req.cncdRfrNo())
                .stsTc(STS_DRAFT).reqCone(req.reqCone()).build());
        return docNo;
    }

    private void validateTarget(String bgPrnTc, String cncdRfrNo) {
        boolean ok;
        if (TGT_PROJECT.equals(bgPrnTc)) {
            ok = projectRepository.existsByAbusMngNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N");
        } else if (TGT_COST.equals(bgPrnTc)) {
            ok = costRepository.existsByCostBgNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N");
        } else {
            throw new IllegalArgumentException("알 수 없는 대상구분: " + bgPrnTc);
        }
        if (!ok) throw new IllegalArgumentException("대상을 찾을 수 없습니다: " + bgPrnTc + "/" + cncdRfrNo);
    }

    @Transactional
    public void update(String docNo, ContractDto.UpdateRequest req, CustomUserDetails user) {
        Bcontm e = loadCurrent(docNo);
        if (!STS_DRAFT.equals(e.getStsTc())) throw new IllegalStateException("작성중 상태에서만 수정할 수 있습니다.");
        e.updateRequest(req.reqCone());
    }

    @Transactional
    public void delete(String docNo, CustomUserDetails user) {
        Bcontm e = loadCurrent(docNo);
        if (!STS_DRAFT.equals(e.getStsTc())) throw new IllegalStateException("작성중 상태에서만 삭제할 수 있습니다.");
        e.delete();
    }

    @Transactional
    public void changeStatus(String docNo, ContractDto.StatusRequest req, CustomUserDetails user) {
        Bcontm e = loadCurrent(docNo);
        String from = e.getStsTc(), to = req.stsTc();
        boolean ok = (STS_DRAFT.equals(from) && STS_IN_PROGRESS.equals(to))
                || (STS_IN_PROGRESS.equals(from) && STS_DONE.equals(to));
        if (!ok) throw new IllegalStateException("허용되지 않은 상태 전이입니다: " + from + " → " + to);
        e.changeStatus(to);
    }

    @Transactional
    public void saveContract(String docNo, ContractDto.WorkRequest req, CustomUserDetails user) {
        Bcontm e = loadCurrent(docNo);
        if (!STS_IN_PROGRESS.equals(e.getStsTc())) throw new IllegalStateException("진행중 상태에서만 계약 정보를 입력할 수 있습니다.");
        e.updateContract(req.cttManrC(), req.cttManrRsn(), req.cttNm(), req.cttAmt(), req.cttOppNm(), req.cttDt());
    }

    public ContractDto.Detail get(String docNo) {
        Bcontm e = loadCurrent(docNo);
        String tgtNm = resolveTargetName(e.getBgPrnTc(), e.getCncdRfrNo());
        return new ContractDto.Detail(
                e.getDocMngNo(), e.getDocVrsSno(), e.getBgPrnTc(), e.getCncdRfrNo(), tgtNm,
                e.getStsTc(), e.getReqCone(), e.getCttManrC(), e.getCttManrRsn(), e.getCttNm(),
                e.getCttAmt(), e.getCttOppNm(), e.getCttDt(), e.getFstEnrUsid(), e.getFstEnrDtm());
    }

    /** 대상명 해석: 사업 ABUS_NM / 전산업무비 CTT_NM(계약명). 없으면 null. */
    private String resolveTargetName(String bgPrnTc, String cncdRfrNo) {
        if (TGT_PROJECT.equals(bgPrnTc)) {
            return projectRepository.findByAbusMngNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N").map(p -> p.getAbusNm()).orElse(null);
        }
        if (TGT_COST.equals(bgPrnTc)) {
            return costRepository.findByCostBgNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N").map(c -> c.getCttNm()).orElse(null);
        }
        return null;
    }

    public List<ContractDto.ListItem> list(String stsTc, String bgPrnTc, String cncdRfrNo, CustomUserDetails user) {
        String bbrC = user.isAdmin() ? null : user.getBbrC();
        return contractRepository.search(stsTc, bgPrnTc, cncdRfrNo, bbrC);
    }

    Bcontm loadCurrent(String docNo) {
        return contractRepository.findByDocMngNoAndLstYnAndDelYn(docNo, "Y", "N")
                .orElseThrow(() -> new IllegalArgumentException("입찰계약 문서를 찾을 수 없습니다: " + docNo));
    }
}
```

- [ ] **Step 4: 통과 확인** — `./gradlew test --tests "*ContractServiceTest*"` → PASS (9 tests).
- [ ] **Step 5: 커밋** — `git add ...service/ContractService.java ...ContractServiceTest.java && git commit -m "feat(contract): 서비스(의뢰/전이/수정·삭제/계약입력/조회) + 테스트"`

---

### Task 7: Controller + WebMvc 테스트

**Files:** Create `controller/ContractController.java`, Test `controller/ContractControllerTest.java`. (레퍼런스: `DeliberationControllerTest` — 동일 `TestSecurityConfig`+`@WithMockUser`+`@MockitoBean` 패턴)

- [ ] **Step 1: 실패 테스트** — 비인증 401, `POST /api/project/contracts` → 201 + 문서번호, `POST /{docNo}/status` → 200.
- [ ] **Step 2: 실패 확인** — `./gradlew test --tests "*ContractControllerTest*"`.
- [ ] **Step 3: 컨트롤러 작성** (기준경로 `/api/project/contracts`; 모든 param에 `name=`; mutation `@Valid`; 클래스 ADMIN 전용 아님)
```java
package com.kdb.it.domain.contract.controller;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.contract.dto.ContractDto;
import com.kdb.it.domain.contract.service.ContractService;
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
@RequestMapping("/api/project/contracts")
@RequiredArgsConstructor
@Tag(name = "Contract", description = "입찰/계약 API")
public class ContractController {

    private final ContractService contractService;

    @Operation(summary = "입찰계약 목록")
    @GetMapping
    public ResponseEntity<List<ContractDto.ListItem>> list(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "prnTc", required = false) String prnTc,
            @RequestParam(name = "cncdRfrNo", required = false) String cncdRfrNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(contractService.list(status, prnTc, cncdRfrNo, user));
    }

    @Operation(summary = "입찰계약 상세")
    @GetMapping("/{docNo}")
    public ResponseEntity<ContractDto.Detail> get(@PathVariable(name = "docNo") String docNo) {
        return ResponseEntity.ok(contractService.get(docNo));
    }

    @Operation(summary = "입찰계약 신규 의뢰")
    @PostMapping
    public ResponseEntity<String> create(@RequestBody @Valid ContractDto.CreateRequest req,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(contractService.create(req, user));
    }

    @Operation(summary = "입찰계약 마스터 수정(작성중)")
    @PutMapping("/{docNo}")
    public ResponseEntity<Void> update(@PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid ContractDto.UpdateRequest req, @AuthenticationPrincipal CustomUserDetails user) {
        contractService.update(docNo, req, user); return ResponseEntity.ok().build();
    }

    @Operation(summary = "입찰계약 삭제(작성중)")
    @DeleteMapping("/{docNo}")
    public ResponseEntity<Void> delete(@PathVariable(name = "docNo") String docNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        contractService.delete(docNo, user); return ResponseEntity.noContent().build();
    }

    @Operation(summary = "입찰계약 상태 전이(제출/완료)")
    @PostMapping("/{docNo}/status")
    public ResponseEntity<Void> changeStatus(@PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid ContractDto.StatusRequest req, @AuthenticationPrincipal CustomUserDetails user) {
        contractService.changeStatus(docNo, req, user); return ResponseEntity.ok().build();
    }

    @Operation(summary = "계약 정보 입력(진행중)")
    @PutMapping("/{docNo}/contract")
    public ResponseEntity<Void> saveContract(@PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid ContractDto.WorkRequest req, @AuthenticationPrincipal CustomUserDetails user) {
        contractService.saveContract(docNo, req, user); return ResponseEntity.ok().build();
    }
}
```

- [ ] **Step 4: 통과 + 전체 회귀** — `./gradlew test --tests "*ContractControllerTest*"` PASS, 이어서 `./gradlew test` 전체 GREEN(개수 보고).
- [ ] **Step 5: 커밋** — `git add ...controller/ ...ContractControllerTest.java && git commit -m "feat(contract): 컨트롤러(CRUD/상태/계약) + WebMvc 테스트"`

---

## Stage ③ 프론트엔드

### Task 8: 타입 + 컴포저블 + 화면

레퍼런스: deliberation의 `types/deliberation.ts`, `composables/useDeliberations.ts`, `pages/project/deliberation/*` 를 복제·치환. 차이점만 명시.

- [ ] **Step 1: `app/types/contract.ts`** — `ContractListItem`/`ContractDetail`/`ContractCreateRequest`/`ContractWorkRequest` (백엔드 DTO 미러) + 상수:
```typescript
export const CONTRACT_STATUS = { DRAFT: '61', IN_PROGRESS: '62', DONE: '69' } as const;
export const CONTRACT_STATUS_LABEL: Record<string,string> = { '61':'작성중','62':'진행중','69':'완료' };
export const TGT_LABEL: Record<string,string> = { '100':'정보화사업','200':'전산업무비' };
export const CTT_MANR_LABEL: Record<string,string> = { '01':'협상에의한계약','02':'규격가격동시','03':'수의계약','04':'일반경쟁' };
```

- [ ] **Step 2: `app/composables/useContracts.ts`** — `useDeliberations` 구조 복제, 기준경로 `${apiBase}/api/project/contracts`. 메서드: `fetchContracts(query?)`, `fetchContract(docNo)`(useApiFetch); `createContract(body)`→string, `updateContract(docNo,{reqCone})`, `deleteContract(docNo)`, `changeStatus(docNo,stsTc)`(POST `/status`), `saveContract(docNo, workBody)`(PUT `/contract`). void는 `$apiFetch<undefined>`. + 유닛테스트(`useContracts.test.ts`).

- [ ] **Step 3: `app/pages/project/contract/index.vue`** (목록 + 신규 의뢰 모달) — deliberation `index.vue` 복제. 컬럼: 대상구분(TGT_LABEL), 대상번호(cncdRfrNo, 상세 링크), 상태(CONTRACT_STATUS_LABEL), 계약명(cttNm), 계약금액(cttAmt, `formatBudget`), 요청자, 요청일시(formatDateTime). 신규 의뢰 모달은 deliberation과 동일(대상구분 사업/전산업무비 선택 → 대상 목록 useProjects/useCost → 요청내용 → `createContract`).

- [ ] **Step 4: `app/pages/project/contract/[docNo].vue`** (상태분기 상세) — deliberation `[docNo].vue` 복제하되 **심의결과 폼 대신 계약 정보 폼**:
  - 헤더: 대상명(`detail.tgtNm ?? detail.cncdRfrNo`) + 대상구분 배지 + 상태 Tag. 정보바: 문서번호/대상구분/요청자/요청일시.
  - 요청내용: 작성중(61)에서만 편집 → [저장][의뢰 제출(→62)][삭제]. `watch(detail, ...)` 동기화.
  - 계약 정보 영역(진행중 62 편집, 완료 69 읽기전용): 계약방법(cttManrC Select: CTT_MANR_LABEL), 계약방법사유(cttManrRsn Textarea max 1000), 계약명(cttNm InputText max 100), 계약금액(cttAmt InputNumber, 표시 `formatBudget`), 계약상대처(cttOppNm InputText max 100), 계약일자(cttDt InputText 8자리/date). 진행중 버튼 [계약 저장(saveContract)][완료 확정(→69)].
  - 완료(69): 전체 읽기전용.
  - maxlength는 DTO와 일치(요청내용 300, 사유 1000, 계약명 100, 상대처 100).

- [ ] **Step 5: 검증** — `cd it_frontend && npm run typecheck && npm run lint && npm test -- useContracts` 통과.
- [ ] **Step 6: 커밋** (it_frontend, 논리 단위 분할) — types / composable+test / index / detail.

---

### Task 9: 메뉴 시드 + 통합 E2E

- [ ] **Step 1: 메뉴 시드** `it_database/migrations/V20260607_010__SeedContractMenu.sql` — Stage ②/① 메뉴와 동일 절차(라이브 메뉴 스키마 확인: HED/GRP/LNK, 부모 `MINF0015` 정보화사업). 라우트 카탈로그(`/project/contract`) + 메뉴 LNK(다음 free MNU_ID 예 `MINF0025`, 부모 `MINF0015`, depth 3) + 권한(CMENUA 행 없음=전체 인증). 실행 후 사이드바 노출 확인. 커밋(it_database).
- [ ] **Step 2: 통합 E2E (수동/Playwright)** — 두 서버 기동 → 사이드바 "입찰/계약" 진입 → 신규 의뢰(대상구분 사업/전산업무비) → 작성중 저장/제출 → 진행중 계약정보 입력(계약방법/명/금액/상대처/일자) → 계약 저장 → 완료 확정(읽기전용) → 목록 표시(계약명/금액). 콘솔 에러 0 확인. (검증 데이터 soft-delete 정리.)
- [ ] **Step 3: 전체 회귀** — `cd it_backend && ./gradlew test`; `cd it_frontend && npm test && npm run typecheck`.

---

## Self-Review (작성자 체크)

- **Spec 커버리지**: §3.3 ③(BCONTM 마스터+로그) → Task 2-3, 상태전이 §4(61/62/69) → Task 6, 화면 §5(목록/상세/계약 정보 폼) → Task 8, API §6(목록/상세/생성/수정/삭제/상태/contract) → Task 7, 검증 §7(대상/중복/전이) → Task 6, 공통코드 §3.4(CTT_MANR_C) → Task 1, 메뉴 → Task 9. **Stage ②와 동일 구조**, 차이는 업무 필드(계약 정보)·상태(61/62/69)·도메인(CONT)·작업입력 PUT(`/contract`).
- **재사용**: 대상 검증/명칭 finder(Project/Cost)는 Stage ①/② 추가분 그대로 사용 — 신규 추가 없음. 프론트는 deliberation 화면 복제.
- **플레이스홀더**: 코드 단계는 실제 코드. 프론트 화면(Task 8)·`BcontmL`는 deliberation 레퍼런스 복제 지시.
- **타입 일관성**: 상태 61/62/69, 대상 100/200, 계약방법 01~04를 백엔드 상수·프론트 상수·공통코드에서 동일 사용. 문서번호 `CTR-{YYYY}-{4}`. `CTT_AMT` NUMBER(18,3)↔BigDecimal(precision18,scale3) 정합.
- **실행 리스크**: (1) 마이그레이션 번호 충돌 시 다음 번호로. (2) 로그 시퀀스 `SEQ_BCONTL` = `AuditLogIdGenerator` 규칙. (3) git 위생(동시 EAI 작업 보호). (4) bbrC 미적용은 의도된 MVP 결정.

---

## Execution Handoff

Stage ③ 완료 후 마지막 Stage ④(대금지급, `Bpaymm`+`Bpaymt` 회차 명세, `DFR_*`)도 동일 패턴으로 별도 플랜 작성. 대금지급은 estimate(Stage ①)처럼 **마스터+명세(회차)** 구조라 Stage ①의 명세 동기화(saveLines/회차 추가) 패턴을 참조.
