# 대금지급 (Stage ④) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보화사업(`TPRMPP_BPROJM`) 또는 전산업무비(`TPRMPP_BCOSTM`)에 대한 대금지급 신청/작업 화면(MVP)을 풀스택으로 구현한다 — 신청자가 대금지급을 의뢰하고, 작업자(관리자/담당)가 계약 정보와 **회차별 지급 명세(여러 번)**를 입력·완료한다.

**Architecture:** 설계서 A안 마지막 수직 슬라이스. **마스터(`Bpaymm`) + 회차별 지급 명세(`Bpaymt`)** — Stage ①(소요예산)의 마스터+명세+동기화 패턴과 Stage ②/③의 대상 2종 패턴을 결합한다. 상태 3단(작성중 71 → 진행중 72 → 완료 79, 공통코드 `IT_PTL_STS_TC`). 대상은 사업/전산업무비 둘 다(`BG_PRN_TC` 100/200 + `CNCD_RFR_NO`). "하나의 계약이라도 여러 번 대금지급" → `Bpaymt` 행을 회차(`DFR_TOD`)별로 여러 개 추가.

**Tech Stack:** Spring Boot 4 / Java 25 / Spring Data JPA + QueryDSL / Oracle (ddl-auto=**validate** → 마이그레이션 선행 필수) / JUnit5 + Mockito + AssertJ / Nuxt 4 + PrimeVue + Vitest.

**설계서(SoT):** `docs/superpowers/specs/2026-06-07-project-execution-stages-design.md` (§3.3 ④, §4, §5, §6)
**선행 참조 플랜:** `docs/superpowers/plans/2026-06-07-project-estimate-stage1.md` (마스터+명세+동기화/revive), `docs/superpowers/plans/2026-06-07-project-contract-stage3.md` (대상 2종)

---

## 핵심 규약 (작업 전 필독 — Stage ①~③과 동일)

- **마이그레이션 선행**: `ddl-auto=validate`. `it_database/migrations/V{YYYYMMDD_NNN}__*.sql` (적용 전 `ls`로 최신 번호 확인 — Stage ③가 008/009/010 사용, 본 플랜은 `011`(테이블)/`012`(메뉴) 가정, 충돌 시 다음 번호로).
- **로그 테이블/시퀀스**: `AuditLogIdGenerator`가 로그 엔티티 `@Table` 명의 `_` 뒤로 `SEQ_<X>` 호출.
  - 마스터 `TPRMPP_BPAYMM` → 로그 `TPRMPP_BPAYML` → 시퀀스 `SEQ_BPAYML`. 문서번호 채번 `SEQ_BPAYMM`.
  - 명세 `TPRMPP_BPAYTM` → 로그 `TPRMPP_BPAYTL` → 시퀀스 `SEQ_BPAYTL`. (명세 도메인 `PAYT` — 설계서 §3.1 명명규칙: 명세도 자체 4자리 도메인 + 용도 `M`.)
- **감사 컬럼 타입**(기존 마이그레이션과 동일): `FST_ENR_DTM`/`LST_CHG_DTM`=`DATE`, `GUID_PRG_SNO`=`NUMBER(4,0)`, 로그 PK `LOG_HIS_TGR_SNO`=`NUMBER(18,0)`, 로그 `CHG_DTM`=`TIMESTAMP(9)`.
- **메타 용어 고정**(설계서 부록 A, 전부 메타 실재): `DOC_MNG_NO`, `DOC_VRS_SNO`, `LST_YN`, `BG_PRN_TC`(100/200), `CNCD_RFR_NO`, `IT_PTL_STS_TC`, `REQ_CONE`, `CTT_NM`(계약명), `CTT_AMT`(계약금액), `DFR_TOD`(지급회차), `DFR_AMT`(지급금액), `DFR_DT`(지급일자), `DFR_MPL_DT`(지급예정일자), `OPNN_CONE`(적요/의견).
- **상태**: 71(작성중) → 72(진행중) → 79(완료). 인접 전이만 허용.
- **신규 공통코드: 없음** (CTT_*, DFR_* 용어 + IT_PTL_STS_TC 71/72/79 모두 기존).
- **DB 접속**: `it_database/apply-ddl-live.ps1` creds (ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1, sqlplus; `export NLS_LANG=KOREAN_KOREA.AL32UTF8`).
- **GIT 위생(동시 작업 주의)**: 서브에이전트는 **`infra/eai/**` 등 타 작업 파일 금지, `git add -A`/`git stash`/`git checkout <branch>`/`git reset` 금지**, payment 경로만 명시적으로 `git add`. 작업 브랜치 `feat/project-payment-stage4`(it_database는 main).

---

## 파일 구조

**DB 마이그레이션 (`it_database/migrations/`)**
- Create: `V20260607_011__CreatePaymentTables.sql` (BPAYMM + BPAYTM + 로그 BPAYML/BPAYTL + 시퀀스)
- Create: `V20260607_012__SeedPaymentMenu.sql` (메뉴)

**백엔드 (`it_backend/src/main/java/com/kdb/it/domain/payment/`)**
- Create: `entity/Bpaymm.java`, `entity/BpaymmId.java`, `entity/Bpaymt.java`, `entity/BpaymtId.java`
- Create: `domain/log/entity/BpaymmL.java`, `domain/log/entity/BpaymtL.java`
- Create: `dto/PaymentDto.java`
- Create: `repository/PaymentRepository.java`, `repository/PaymentRepositoryCustom.java`, `repository/PaymentRepositoryImpl.java`, `repository/PaymentLineRepository.java`
- Create: `service/PaymentService.java`
- Create: `controller/PaymentController.java`
- (대상 검증/명칭 finder는 Stage ①~③의 `ProjectRepository`/`CostRepository` 재사용 — 신규 추가 불필요)
- Test: `service/PaymentServiceTest.java`, `controller/PaymentControllerTest.java`

**프론트엔드 (`it_frontend/`)**
- Create: `app/types/payment.ts`, `app/composables/usePayments.ts`
- Create: `app/pages/project/payment/index.vue`, `app/pages/project/payment/[docNo].vue`
- Test: `tests/unit/composables/usePayments.test.ts`

---

## Stage ④ 백엔드

### Task 1: 테이블/로그/시퀀스 마이그레이션

**Files:** Create `it_database/migrations/V20260607_011__CreatePaymentTables.sql` (적용 전 번호 확인)

- [ ] **Step 1: 마이그레이션 작성** (마스터 BPAYMM + 명세 BPAYTM + 로그 2개 + 시퀀스 3개)

```sql
-- V20260607_011__CreatePaymentTables.sql
-- 대금지급 마스터(BPAYMM) + 회차별 지급 명세(BPAYTM) + 변경로그(BPAYML/BPAYTL) + 시퀀스.
-- ddl-auto=validate 이므로 엔티티 작성 전 본 스크립트를 먼저 실행.

-- 1) 마스터: 대금지급 (대상 + 계약 정보 직접 입력)
CREATE TABLE TPRMPP_BPAYMM (
  DOC_MNG_NO     VARCHAR2(20 CHAR)  NOT NULL,
  DOC_VRS_SNO    NUMBER(9,0)        NOT NULL,
  LST_YN         VARCHAR2(1 CHAR)   DEFAULT 'Y' NOT NULL,
  BG_PRN_TC      VARCHAR2(3 CHAR)   NOT NULL,
  CNCD_RFR_NO    VARCHAR2(30 CHAR)  NOT NULL,
  IT_PTL_STS_TC  VARCHAR2(2 CHAR)   NOT NULL,
  REQ_CONE       VARCHAR2(300 CHAR),
  CTT_NM         VARCHAR2(100 CHAR),
  CTT_AMT        NUMBER(18,3),
  DEL_YN         VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
  GUID           VARCHAR2(38 CHAR),
  GUID_PRG_SNO   NUMBER(4,0),
  FST_ENR_DTM    DATE,
  FST_ENR_USID   VARCHAR2(14 CHAR),
  LST_CHG_DTM    DATE,
  LST_CHG_USID   VARCHAR2(14 CHAR),
  CONSTRAINT PK_TPRMPP_BPAYMM PRIMARY KEY (DOC_MNG_NO, DOC_VRS_SNO),
  CONSTRAINT CK_BPAYMM_LST_YN CHECK (LST_YN IN ('Y','N')),
  CONSTRAINT CK_BPAYMM_DEL_YN CHECK (DEL_YN IN ('Y','N'))
);
COMMENT ON TABLE  TPRMPP_BPAYMM                IS '대금지급 기본';
COMMENT ON COLUMN TPRMPP_BPAYMM.DOC_MNG_NO     IS '문서관리번호';
COMMENT ON COLUMN TPRMPP_BPAYMM.DOC_VRS_SNO    IS '문서버전일련번호';
COMMENT ON COLUMN TPRMPP_BPAYMM.LST_YN         IS '최종여부';
COMMENT ON COLUMN TPRMPP_BPAYMM.BG_PRN_TC      IS '예산성격구분코드(대상구분)';
COMMENT ON COLUMN TPRMPP_BPAYMM.CNCD_RFR_NO    IS '관련참조번호(대상관리번호)';
COMMENT ON COLUMN TPRMPP_BPAYMM.IT_PTL_STS_TC  IS 'IT포탈상태구분코드';
COMMENT ON COLUMN TPRMPP_BPAYMM.REQ_CONE       IS '요청내용';
COMMENT ON COLUMN TPRMPP_BPAYMM.CTT_NM         IS '계약명';
COMMENT ON COLUMN TPRMPP_BPAYMM.CTT_AMT        IS '계약금액';
CREATE INDEX IDX_BPAYMM_TGT ON TPRMPP_BPAYMM (BG_PRN_TC, CNCD_RFR_NO);
CREATE INDEX IDX_BPAYMM_STS ON TPRMPP_BPAYMM (IT_PTL_STS_TC);

-- 2) 명세: 회차별 지급 (자연키 = 문서 + 버전 + 지급회차)
CREATE TABLE TPRMPP_BPAYTM (
  DOC_MNG_NO     VARCHAR2(20 CHAR)  NOT NULL,
  DOC_VRS_SNO    NUMBER(9,0)        NOT NULL,
  DFR_TOD        NUMBER(5,0)        NOT NULL,
  DFR_AMT        NUMBER(18,3),
  DFR_DT         VARCHAR2(8 CHAR),
  DFR_MPL_DT     VARCHAR2(8 CHAR),
  OPNN_CONE      VARCHAR2(1000 CHAR),
  DEL_YN         VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
  GUID           VARCHAR2(38 CHAR),
  GUID_PRG_SNO   NUMBER(4,0),
  FST_ENR_DTM    DATE,
  FST_ENR_USID   VARCHAR2(14 CHAR),
  LST_CHG_DTM    DATE,
  LST_CHG_USID   VARCHAR2(14 CHAR),
  CONSTRAINT PK_TPRMPP_BPAYTM PRIMARY KEY (DOC_MNG_NO, DOC_VRS_SNO, DFR_TOD),
  CONSTRAINT CK_BPAYTM_DEL_YN CHECK (DEL_YN IN ('Y','N'))
);
COMMENT ON TABLE  TPRMPP_BPAYTM             IS '대금지급 상세(회차별 지급)';
COMMENT ON COLUMN TPRMPP_BPAYTM.DOC_MNG_NO  IS '문서관리번호';
COMMENT ON COLUMN TPRMPP_BPAYTM.DOC_VRS_SNO IS '문서버전일련번호';
COMMENT ON COLUMN TPRMPP_BPAYTM.DFR_TOD     IS '지급회차';
COMMENT ON COLUMN TPRMPP_BPAYTM.DFR_AMT     IS '지급금액';
COMMENT ON COLUMN TPRMPP_BPAYTM.DFR_DT      IS '지급일자';
COMMENT ON COLUMN TPRMPP_BPAYTM.DFR_MPL_DT  IS '지급예정일자';
COMMENT ON COLUMN TPRMPP_BPAYTM.OPNN_CONE   IS '의견내용';

-- 3) 변경로그
CREATE TABLE TPRMPP_BPAYML (
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
  CTT_NM          VARCHAR2(100 CHAR),
  CTT_AMT         NUMBER(18,3),
  CONSTRAINT PK_TPRMPP_BPAYML PRIMARY KEY (LOG_HIS_TGR_SNO)
);
COMMENT ON TABLE TPRMPP_BPAYML IS '대금지급 기본 변경 로그';

CREATE TABLE TPRMPP_BPAYTL (
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
  DFR_TOD         NUMBER(5,0),
  DFR_AMT         NUMBER(18,3),
  DFR_DT          VARCHAR2(8 CHAR),
  DFR_MPL_DT      VARCHAR2(8 CHAR),
  OPNN_CONE       VARCHAR2(1000 CHAR),
  CONSTRAINT PK_TPRMPP_BPAYTL PRIMARY KEY (LOG_HIS_TGR_SNO)
);
COMMENT ON TABLE TPRMPP_BPAYTL IS '대금지급 상세 변경 로그';

-- 4) 시퀀스
CREATE SEQUENCE SEQ_BPAYMM START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;  -- 문서번호 채번
CREATE SEQUENCE SEQ_BPAYML START WITH 1 INCREMENT BY 1 CACHE 20 NOCYCLE;  -- 마스터 로그 PK
CREATE SEQUENCE SEQ_BPAYTL START WITH 1 INCREMENT BY 1 CACHE 20 NOCYCLE;  -- 명세 로그 PK
```

- [ ] **Step 2: 실행 + 검증** — `user_tables` IN ('TPRMPP_BPAYMM','TPRMPP_BPAYTM','TPRMPP_BPAYML','TPRMPP_BPAYTL') → 4행; `user_sequences` IN ('SEQ_BPAYMM','SEQ_BPAYML','SEQ_BPAYTL') → 3행.
- [ ] **Step 3: 커밋** — `cd it_database && git add migrations/V20260607_011__CreatePaymentTables.sql && git commit -m "feat(db): 대금지급 테이블/로그/시퀀스 생성(BPAYMM/BPAYTM/BPAYML/BPAYTL)"`

---

### Task 2: 마스터 엔티티 `Bpaymm` + `BpaymmId` + 로그 `BpaymmL`

**Files:** Create `entity/Bpaymm.java`, `entity/BpaymmId.java`, `domain/log/entity/BpaymmL.java`. (레퍼런스: contract `Bcontm` 구조 + estimate `Bestim`)

- [ ] **Step 1: 복합키 `BpaymmId.java`**
```java
package com.kdb.it.domain.payment.entity;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 대금지급 마스터(Bpaymm) 복합 기본키. (문서관리번호 + 문서버전일련번호) */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BpaymmId implements Serializable {
    private String docMngNo;
    private Integer docVrsSno;
}
```

- [ ] **Step 2: 마스터 엔티티 `Bpaymm.java`**
```java
package com.kdb.it.domain.payment.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.BpaymmL;
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
 * 대금지급 기본(마스터) 엔티티.
 *
 * <p>DB 테이블: {@code TPRMPP_BPAYMM}. 정보화사업/전산업무비에 대한 대금지급을 관리한다.</p>
 * <p>대상구분 {@code BG_PRN_TC}: 100=정보화사업, 200=전산업무비. 상태 71→72→79.</p>
 * <p>계약명/계약금액은 직접 입력(단계 독립). 회차별 지급은 {@code Bpaymt}(명세) 여러 행.</p>
 */
@LogTarget(entity = BpaymmL.class)
@Entity
@Table(name = "TPRMPP_BPAYMM", comment = "대금지급 기본")
@IdClass(BpaymmId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Bpaymm extends BaseEntity {

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

    @Column(name = "CTT_NM", length = 100, comment = "계약명")
    private String cttNm;

    @Column(name = "CTT_AMT", precision = 18, scale = 3, comment = "계약금액")
    private BigDecimal cttAmt;

    /** 마스터 수정 (작성중에서만): 요청내용 + 계약 정보 */
    public void updateMaster(String reqCone, String cttNm, BigDecimal cttAmt) {
        this.reqCone = reqCone;
        this.cttNm = cttNm;
        this.cttAmt = cttAmt;
    }

    /** 상태 전이 (서비스의 changeStatus에서만 호출) */
    public void changeStatus(String stsTc) {
        this.stsTc = stsTc;
    }
}
```
> 주의: estimate에서는 요청내용만 작성중 수정이었으나, 대금지급은 계약명/계약금액도 작성중에 입력하므로 `updateMaster(reqCone, cttNm, cttAmt)`로 묶는다.

- [ ] **Step 3: 로그 `BpaymmL.java`** (`@Table(name="TPRMPP_BPAYML")` → 시퀀스 `SEQ_BPAYML`)
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

/** 대금지급 기본(TPRMPP_BPAYMM) 변경 로그. */
@Entity
@Table(name = "TPRMPP_BPAYML", comment = "대금지급 기본 변경 로그")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class BpaymmL extends BaseLogEntity {
    @Column(name = "DOC_MNG_NO", length = 20, comment = "문서관리번호") private String docMngNo;
    @Column(name = "DOC_VRS_SNO", comment = "문서버전일련번호") private Integer docVrsSno;
    @Column(name = "LST_YN", length = 1, comment = "최종여부") private String lstYn;
    @Column(name = "BG_PRN_TC", length = 3, comment = "예산성격구분코드(대상구분)") private String bgPrnTc;
    @Column(name = "CNCD_RFR_NO", length = 30, comment = "관련참조번호(대상관리번호)") private String cncdRfrNo;
    @Column(name = "IT_PTL_STS_TC", length = 2, comment = "IT포탈상태구분코드") private String stsTc;
    @Column(name = "REQ_CONE", length = 300, comment = "요청내용") private String reqCone;
    @Column(name = "CTT_NM", length = 100, comment = "계약명") private String cttNm;
    @Column(name = "CTT_AMT", precision = 18, scale = 3, comment = "계약금액") private BigDecimal cttAmt;
}
```

- [ ] **Step 4: 커밋** — `cd it_backend && ./gradlew compileJava`; `git add src/main/java/com/kdb/it/domain/payment/entity/Bpaymm.java src/main/java/com/kdb/it/domain/payment/entity/BpaymmId.java src/main/java/com/kdb/it/domain/log/entity/BpaymmL.java && git commit -m "feat(payment): 대금지급 마스터 엔티티/복합키/변경로그 추가"`

---

### Task 3: 명세 엔티티 `Bpaymt` + `BpaymtId` + 로그 `BpaymtL`

**Files:** Create `entity/Bpaymt.java`, `entity/BpaymtId.java`, `domain/log/entity/BpaymtL.java`. (레퍼런스: estimate 명세 `Bestid`/`BestidId`/`BestidL` — 자연키 명세 + 동일 로그 구조)

- [ ] **Step 1: 복합키 `BpaymtId.java`** (문서 + 버전 + 지급회차)
```java
package com.kdb.it.domain.payment.entity;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 대금지급 명세(Bpaymt) 복합 기본키. (문서번호 + 버전 + 지급회차) */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BpaymtId implements Serializable {
    private String docMngNo;
    private Integer docVrsSno;
    private Integer dfrTod;
}
```

- [ ] **Step 2: 명세 엔티티 `Bpaymt.java`**
```java
package com.kdb.it.domain.payment.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.BpaymtL;
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
 * 대금지급 상세(명세) 엔티티 — 회차별 지급.
 *
 * <p>DB 테이블: {@code TPRMPP_BPAYTM}. 마스터(Bpaymm) 1건에 회차(DFR_TOD)별 N행.</p>
 */
@LogTarget(entity = BpaymtL.class)
@Entity
@Table(name = "TPRMPP_BPAYTM", comment = "대금지급 상세(회차별 지급)")
@IdClass(BpaymtId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Bpaymt extends BaseEntity {

    @Id
    @Column(name = "DOC_MNG_NO", length = 20, nullable = false, comment = "문서관리번호")
    private String docMngNo;

    @Id
    @Column(name = "DOC_VRS_SNO", nullable = false, comment = "문서버전일련번호")
    private Integer docVrsSno;

    @Id
    @Column(name = "DFR_TOD", nullable = false, comment = "지급회차")
    private Integer dfrTod;

    @Column(name = "DFR_AMT", precision = 18, scale = 3, comment = "지급금액")
    private BigDecimal dfrAmt;

    @Column(name = "DFR_DT", length = 8, comment = "지급일자")
    private String dfrDt;

    @Column(name = "DFR_MPL_DT", length = 8, comment = "지급예정일자")
    private String dfrMplDt;

    @Column(name = "OPNN_CONE", length = 1000, comment = "의견내용")
    private String opnnCone;

    /** 회차 지급 정보 수정 (작업자가 진행중 상태에서 호출) */
    public void updatePayment(BigDecimal dfrAmt, String dfrDt, String dfrMplDt, String opnnCone) {
        this.dfrAmt = dfrAmt;
        this.dfrDt = dfrDt;
        this.dfrMplDt = dfrMplDt;
        this.opnnCone = opnnCone;
    }
}
```

- [ ] **Step 3: 로그 `BpaymtL.java`** (`@Table(name="TPRMPP_BPAYTL")` → 시퀀스 `SEQ_BPAYTL`)
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

/** 대금지급 상세(TPRMPP_BPAYTM) 변경 로그. */
@Entity
@Table(name = "TPRMPP_BPAYTL", comment = "대금지급 상세 변경 로그")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class BpaymtL extends BaseLogEntity {
    @Column(name = "DOC_MNG_NO", length = 20, comment = "문서관리번호") private String docMngNo;
    @Column(name = "DOC_VRS_SNO", comment = "문서버전일련번호") private Integer docVrsSno;
    @Column(name = "DFR_TOD", comment = "지급회차") private Integer dfrTod;
    @Column(name = "DFR_AMT", precision = 18, scale = 3, comment = "지급금액") private BigDecimal dfrAmt;
    @Column(name = "DFR_DT", length = 8, comment = "지급일자") private String dfrDt;
    @Column(name = "DFR_MPL_DT", length = 8, comment = "지급예정일자") private String dfrMplDt;
    @Column(name = "OPNN_CONE", length = 1000, comment = "의견내용") private String opnnCone;
}
```

- [ ] **Step 4: 부팅 validate** — `cd it_backend && ./gradlew compileJava test --tests "*ApplicationTests*"`. 엔티티↔BPAYMM/BPAYTM/BPAYML/BPAYTL 정합 확인(특히 DFR_AMT/CTT_AMT NUMBER(18,3)↔BigDecimal precision/scale).
- [ ] **Step 5: 커밋** — `git add src/main/java/com/kdb/it/domain/payment/entity/Bpaymt.java src/main/java/com/kdb/it/domain/payment/entity/BpaymtId.java src/main/java/com/kdb/it/domain/log/entity/BpaymtL.java && git commit -m "feat(payment): 대금지급 명세 엔티티/복합키/변경로그 추가"`

---

### Task 4: DTO `PaymentDto`

**Files:** Create `dto/PaymentDto.java`

- [ ] **Step 1: 작성** (정적 중첩 record + `@Schema`)
```java
package com.kdb.it.domain.payment.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/** 대금지급 API 요청/응답 DTO 모음. */
public final class PaymentDto {
    private PaymentDto() {}

    @Schema(name = "PaymentCreateRequest", description = "대금지급 신규 의뢰 요청")
    public record CreateRequest(
            @NotBlank @Size(max = 3) String bgPrnTc,
            @NotBlank @Size(max = 30) String cncdRfrNo,
            @Size(max = 300) String reqCone,
            @Size(max = 100) String cttNm,
            BigDecimal cttAmt
    ) {}

    @Schema(name = "PaymentUpdateRequest", description = "대금지급 마스터 수정(작성중)")
    public record UpdateRequest(
            @Size(max = 300) String reqCone,
            @Size(max = 100) String cttNm,
            BigDecimal cttAmt
    ) {}

    @Schema(name = "PaymentStatusRequest", description = "대금지급 상태 전이")
    public record StatusRequest(@NotBlank @Size(max = 2) String stsTc) {}

    @Schema(name = "PaymentLineRequest", description = "회차별 지급 1행")
    public record LineRequest(
            @NotNull Integer dfrTod,
            BigDecimal dfrAmt,
            @Size(max = 8) String dfrDt,
            @Size(max = 8) String dfrMplDt,
            @Size(max = 1000) String opnnCone
    ) {}

    @Schema(name = "PaymentLinesRequest", description = "회차별 지급 일괄 저장(진행중)")
    public record LinesRequest(@NotNull List<LineRequest> lines) {}

    @Schema(name = "PaymentListItem", description = "대금지급 목록 항목")
    public record ListItem(
            String docMngNo, Integer docVrsSno, String bgPrnTc, String cncdRfrNo,
            String stsTc, String cttNm, BigDecimal cttAmt, String reqUsid, java.time.LocalDateTime reqDtm
    ) {}

    @Schema(name = "PaymentLine", description = "회차별 지급 응답")
    public record Line(Integer dfrTod, BigDecimal dfrAmt, String dfrDt, String dfrMplDt, String opnnCone) {}

    @Schema(name = "PaymentDetail", description = "대금지급 상세")
    public record Detail(
            String docMngNo, Integer docVrsSno, String bgPrnTc, String cncdRfrNo, String tgtNm,
            String stsTc, String reqCone, String cttNm, BigDecimal cttAmt,
            String reqUsid, java.time.LocalDateTime reqDtm, List<Line> lines
    ) {}
}
```

- [ ] **Step 2: compile + 커밋** — `./gradlew compileJava`; `git add ...dto/PaymentDto.java && git commit -m "feat(payment): 대금지급 DTO(record) 추가"`

---

### Task 5: Repository (master + line)

**Files:** Create `repository/PaymentRepository.java`, `PaymentRepositoryCustom.java`, `PaymentRepositoryImpl.java`, `PaymentLineRepository.java`. (레퍼런스: estimate Repository + EstimateLineRepository)

- [ ] **Step 1: 작성**
```java
// PaymentRepository.java
package com.kdb.it.domain.payment.repository;

import com.kdb.it.domain.payment.entity.Bpaymm;
import com.kdb.it.domain.payment.entity.BpaymmId;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PaymentRepository extends JpaRepository<Bpaymm, BpaymmId>, PaymentRepositoryCustom {
    Optional<Bpaymm> findByDocMngNoAndLstYnAndDelYn(String docMngNo, String lstYn, String delYn);

    @Query(nativeQuery = true, value = "SELECT SEQ_BPAYMM.NEXTVAL FROM DUAL")
    Long nextDocSeq();

    boolean existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(
            String bgPrnTc, String cncdRfrNo, java.util.Collection<String> stsTc, String delYn);
}
```
```java
// PaymentRepositoryCustom.java
package com.kdb.it.domain.payment.repository;

import com.kdb.it.domain.payment.dto.PaymentDto;
import java.util.List;

public interface PaymentRepositoryCustom {
    List<PaymentDto.ListItem> search(String stsTc, String bgPrnTc, String cncdRfrNo, String bbrC);
}
```
```java
// PaymentRepositoryImpl.java  (bbrC MVP 미적용 — 대상 2종)
package com.kdb.it.domain.payment.repository;

import com.kdb.it.domain.payment.dto.PaymentDto;
import com.kdb.it.domain.payment.entity.QBpaymm;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.core.types.Projections;
import com.querydsl.jpa.impl.JPAQueryFactory;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;

@RequiredArgsConstructor
public class PaymentRepositoryImpl implements PaymentRepositoryCustom {
    private final JPAQueryFactory queryFactory;

    @Override
    public List<PaymentDto.ListItem> search(String stsTc, String bgPrnTc, String cncdRfrNo, String bbrC) {
        QBpaymm p = QBpaymm.bpaymm;
        BooleanBuilder where = new BooleanBuilder();
        where.and(p.delYn.eq("N"));
        where.and(p.lstYn.eq("Y"));
        if (StringUtils.hasText(stsTc))     where.and(p.stsTc.eq(stsTc));
        if (StringUtils.hasText(bgPrnTc))   where.and(p.bgPrnTc.eq(bgPrnTc));
        if (StringUtils.hasText(cncdRfrNo)) where.and(p.cncdRfrNo.eq(cncdRfrNo));
        // bbrC: 대상 2종이라 단일 join 곤란 → MVP 미적용(후속 고도화).
        return queryFactory.select(Projections.constructor(PaymentDto.ListItem.class,
                        p.docMngNo, p.docVrsSno, p.bgPrnTc, p.cncdRfrNo, p.stsTc, p.cttNm, p.cttAmt, p.fstEnrUsid, p.fstEnrDtm))
                .from(p).where(where).orderBy(p.fstEnrDtm.desc()).fetch();
    }
}
```
```java
// PaymentLineRepository.java
package com.kdb.it.domain.payment.repository;

import com.kdb.it.domain.payment.entity.Bpaymt;
import com.kdb.it.domain.payment.entity.BpaymtId;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentLineRepository extends JpaRepository<Bpaymt, BpaymtId> {
    /** 명세 전체(삭제 포함) — saveLines 재추가 시 soft-deleted 복원 위해 delYn 필터 없음 (estimate 수정 패턴). */
    List<Bpaymt> findByDocMngNoAndDocVrsSno(String docMngNo, Integer docVrsSno);

    /** 현재버전 활성 명세 — 조회용. */
    List<Bpaymt> findByDocMngNoAndDocVrsSnoAndDelYn(String docMngNo, Integer docVrsSno, String delYn);
}
```

- [ ] **Step 2: compile + 커밋** — `./gradlew compileJava` (QBpaymm 생성); `git add ...repository/ && git commit -m "feat(payment): Repository(목록/현재버전/채번 + 명세)"`

---

### Task 6: Service (TDD)

**Files:** Create `service/PaymentService.java`, Test `service/PaymentServiceTest.java`. (레퍼런스: contract `ContractService`(대상 2종) + estimate `EstimateService.saveLines`(명세 동기화 + soft-deleted 복원))

상태 상수: `STS_DRAFT="71"`, `STS_IN_PROGRESS="72"`, `STS_DONE="79"`. 대상구분: `TGT_PROJECT="100"`, `TGT_COST="200"`. 문서번호 `PAY-{YYYY}-{4자리}`.

- [ ] **Step 1: 실패 테스트 작성** (Mockito) — 케이스:
  1. create 사업 정상 → `matches("PAY-\\d{4}-0001")`.
  2. create 전산업무비 정상 → costRepository.existsByCostBgNoAndLstYnAndDelYn=true.
  3. create 대상 미존재 → IllegalArgumentException("대상").
  4. create 중복 → IllegalStateException("진행 중").
  5. changeStatus 71→72 허용; 6. 79→72 거부.
  7. update 작성중 아님(72) → IllegalStateException.
  8. savePayments 진행중 아님(71) → IllegalStateException.
  9. savePayments 진행중(72): 기존 회차 행(dfrTod=1, delYn='N') + 요청에 dfrTod=2만 → 기존 1회차 soft delete(delYn='Y'), 2회차 insert. (mock lineRepository.findByDocMngNoAndDocVrsSno 반환).
  10. savePayments 재추가 복원: 기존 soft-deleted 행(dfrTod=1, delYn='Y') + 요청 dfrTod=1 → restore()+updatePayment, `verify(lineRepository, never()).save(any())`.
  mocks: PaymentRepository, PaymentLineRepository, ProjectRepository, CostRepository.

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests "*PaymentServiceTest*"`.

- [ ] **Step 3: 서비스 작성**
```java
package com.kdb.it.domain.payment.service;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.cost.repository.CostRepository;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.payment.dto.PaymentDto;
import com.kdb.it.domain.payment.entity.Bpaymm;
import com.kdb.it.domain.payment.entity.Bpaymt;
import com.kdb.it.domain.payment.repository.PaymentLineRepository;
import com.kdb.it.domain.payment.repository.PaymentRepository;
import java.time.Year;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 대금지급 서비스. 상태 71→72→79. 대상구분 100=사업/200=전산업무비.
 * 마스터(계약 정보) + 회차별 지급 명세(Bpaymt). 명세 저장은 회차(DFR_TOD) 기준 upsert + soft-deleted 복원.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PaymentService {

    static final String STS_DRAFT = "71";
    static final String STS_IN_PROGRESS = "72";
    static final String STS_DONE = "79";
    static final String TGT_PROJECT = "100";
    static final String TGT_COST = "200";

    private final PaymentRepository paymentRepository;
    private final PaymentLineRepository lineRepository;
    private final ProjectRepository projectRepository;
    private final CostRepository costRepository;

    @Transactional
    public String create(PaymentDto.CreateRequest req, CustomUserDetails user) {
        validateTarget(req.bgPrnTc(), req.cncdRfrNo());
        if (paymentRepository.existsByBgPrnTcAndCncdRfrNoAndStsTcInAndDelYn(
                req.bgPrnTc(), req.cncdRfrNo(), List.of(STS_DRAFT, STS_IN_PROGRESS), "N")) {
            throw new IllegalStateException("해당 대상에 진행 중인 대금지급이 이미 있습니다.");
        }
        String docNo = String.format("PAY-%d-%04d", Year.now().getValue(), paymentRepository.nextDocSeq());
        paymentRepository.save(Bpaymm.builder()
                .docMngNo(docNo).docVrsSno(1).lstYn("Y")
                .bgPrnTc(req.bgPrnTc()).cncdRfrNo(req.cncdRfrNo())
                .stsTc(STS_DRAFT).reqCone(req.reqCone()).cttNm(req.cttNm()).cttAmt(req.cttAmt()).build());
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
    public void update(String docNo, PaymentDto.UpdateRequest req, CustomUserDetails user) {
        Bpaymm e = loadCurrent(docNo);
        if (!STS_DRAFT.equals(e.getStsTc())) throw new IllegalStateException("작성중 상태에서만 수정할 수 있습니다.");
        e.updateMaster(req.reqCone(), req.cttNm(), req.cttAmt());
    }

    @Transactional
    public void delete(String docNo, CustomUserDetails user) {
        Bpaymm e = loadCurrent(docNo);
        if (!STS_DRAFT.equals(e.getStsTc())) throw new IllegalStateException("작성중 상태에서만 삭제할 수 있습니다.");
        e.delete();
    }

    @Transactional
    public void changeStatus(String docNo, PaymentDto.StatusRequest req, CustomUserDetails user) {
        Bpaymm e = loadCurrent(docNo);
        String from = e.getStsTc(), to = req.stsTc();
        boolean ok = (STS_DRAFT.equals(from) && STS_IN_PROGRESS.equals(to))
                || (STS_IN_PROGRESS.equals(from) && STS_DONE.equals(to));
        if (!ok) throw new IllegalStateException("허용되지 않은 상태 전이입니다: " + from + " → " + to);
        e.changeStatus(to);
    }

    /**
     * 회차별 지급 명세 일괄 저장 (작업자, 진행중 한정).
     * 회차(DFR_TOD) 기준 upsert: 요청 포함 회차는 추가/수정(soft-deleted면 복원), 누락 회차는 soft delete.
     */
    @Transactional
    public void savePayments(String docNo, PaymentDto.LinesRequest req, CustomUserDetails user) {
        Bpaymm e = loadCurrent(docNo);
        if (!STS_IN_PROGRESS.equals(e.getStsTc())) throw new IllegalStateException("진행중 상태에서만 지급 명세를 저장할 수 있습니다.");
        Integer vrs = e.getDocVrsSno();
        List<Bpaymt> all = lineRepository.findByDocMngNoAndDocVrsSno(docNo, vrs); // 삭제 포함
        Map<Integer, Bpaymt> byTod = all.stream().collect(Collectors.toMap(Bpaymt::getDfrTod, b -> b));

        Set<Integer> incoming = new HashSet<>();
        for (PaymentDto.LineRequest line : req.lines()) {
            incoming.add(line.dfrTod());
            Bpaymt row = byTod.get(line.dfrTod());
            if (row != null) {
                if ("Y".equals(row.getDelYn())) row.restore(); // soft-deleted 복원 (PK 충돌 방지)
                row.updatePayment(line.dfrAmt(), line.dfrDt(), line.dfrMplDt(), line.opnnCone());
            } else {
                lineRepository.save(Bpaymt.builder()
                        .docMngNo(docNo).docVrsSno(vrs).dfrTod(line.dfrTod())
                        .dfrAmt(line.dfrAmt()).dfrDt(line.dfrDt()).dfrMplDt(line.dfrMplDt()).opnnCone(line.opnnCone())
                        .build());
            }
        }
        for (Bpaymt row : all) {
            if (!"Y".equals(row.getDelYn()) && !incoming.contains(row.getDfrTod())) row.delete();
        }
    }

    public PaymentDto.Detail get(String docNo) {
        Bpaymm e = loadCurrent(docNo);
        List<PaymentDto.Line> lines = lineRepository.findByDocMngNoAndDocVrsSnoAndDelYn(docNo, e.getDocVrsSno(), "N")
                .stream().map(l -> new PaymentDto.Line(l.getDfrTod(), l.getDfrAmt(), l.getDfrDt(), l.getDfrMplDt(), l.getOpnnCone()))
                .toList();
        String tgtNm = resolveTargetName(e.getBgPrnTc(), e.getCncdRfrNo());
        return new PaymentDto.Detail(
                e.getDocMngNo(), e.getDocVrsSno(), e.getBgPrnTc(), e.getCncdRfrNo(), tgtNm,
                e.getStsTc(), e.getReqCone(), e.getCttNm(), e.getCttAmt(), e.getFstEnrUsid(), e.getFstEnrDtm(), lines);
    }

    private String resolveTargetName(String bgPrnTc, String cncdRfrNo) {
        if (TGT_PROJECT.equals(bgPrnTc)) {
            return projectRepository.findByAbusMngNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N").map(p -> p.getAbusNm()).orElse(null);
        }
        if (TGT_COST.equals(bgPrnTc)) {
            return costRepository.findByCostBgNoAndLstYnAndDelYn(cncdRfrNo, "Y", "N").map(c -> c.getCttNm()).orElse(null);
        }
        return null;
    }

    public List<PaymentDto.ListItem> list(String stsTc, String bgPrnTc, String cncdRfrNo, CustomUserDetails user) {
        String bbrC = user.isAdmin() ? null : user.getBbrC();
        return paymentRepository.search(stsTc, bgPrnTc, cncdRfrNo, bbrC);
    }

    Bpaymm loadCurrent(String docNo) {
        return paymentRepository.findByDocMngNoAndLstYnAndDelYn(docNo, "Y", "N")
                .orElseThrow(() -> new IllegalArgumentException("대금지급 문서를 찾을 수 없습니다: " + docNo));
    }
}
```
> `Bpaymt.restore()`는 `BaseEntity.restore()`(Stage ① 수정에서 추가됨, delYn='N')를 상속. 확인 후 사용. 없으면 BaseEntity에 추가.

- [ ] **Step 4: 통과 확인** — `./gradlew test --tests "*PaymentServiceTest*"` → PASS (10 tests).
- [ ] **Step 5: 커밋** — `git add ...service/PaymentService.java ...PaymentServiceTest.java && git commit -m "feat(payment): 서비스(의뢰/전이/수정·삭제/회차명세 저장/조회) + 테스트"`

---

### Task 7: Controller + WebMvc 테스트

**Files:** Create `controller/PaymentController.java`, Test `controller/PaymentControllerTest.java`. (레퍼런스: `ContractControllerTest` 보안 와이어링 + estimate의 lines 엔드포인트)

- [ ] **Step 1: 실패 테스트** — 비인증 401, `POST /api/project/payments` → 201 + 문서번호, `POST /{docNo}/status` → 200.
- [ ] **Step 2: 실패 확인** — `./gradlew test --tests "*PaymentControllerTest*"`.
- [ ] **Step 3: 컨트롤러 작성** (기준경로 `/api/project/payments`; 모든 param `name=`; mutation `@Valid`; 회차 저장은 `PUT /{docNo}/payments`)
```java
package com.kdb.it.domain.payment.controller;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.payment.dto.PaymentDto;
import com.kdb.it.domain.payment.service.PaymentService;
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
@RequestMapping("/api/project/payments")
@RequiredArgsConstructor
@Tag(name = "Payment", description = "대금지급 API")
public class PaymentController {

    private final PaymentService paymentService;

    @Operation(summary = "대금지급 목록")
    @GetMapping
    public ResponseEntity<List<PaymentDto.ListItem>> list(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "prnTc", required = false) String prnTc,
            @RequestParam(name = "cncdRfrNo", required = false) String cncdRfrNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(paymentService.list(status, prnTc, cncdRfrNo, user));
    }

    @Operation(summary = "대금지급 상세")
    @GetMapping("/{docNo}")
    public ResponseEntity<PaymentDto.Detail> get(@PathVariable(name = "docNo") String docNo) {
        return ResponseEntity.ok(paymentService.get(docNo));
    }

    @Operation(summary = "대금지급 신규 의뢰")
    @PostMapping
    public ResponseEntity<String> create(@RequestBody @Valid PaymentDto.CreateRequest req,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(paymentService.create(req, user));
    }

    @Operation(summary = "대금지급 마스터 수정(작성중)")
    @PutMapping("/{docNo}")
    public ResponseEntity<Void> update(@PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid PaymentDto.UpdateRequest req, @AuthenticationPrincipal CustomUserDetails user) {
        paymentService.update(docNo, req, user); return ResponseEntity.ok().build();
    }

    @Operation(summary = "대금지급 삭제(작성중)")
    @DeleteMapping("/{docNo}")
    public ResponseEntity<Void> delete(@PathVariable(name = "docNo") String docNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        paymentService.delete(docNo, user); return ResponseEntity.noContent().build();
    }

    @Operation(summary = "대금지급 상태 전이(제출/완료)")
    @PostMapping("/{docNo}/status")
    public ResponseEntity<Void> changeStatus(@PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid PaymentDto.StatusRequest req, @AuthenticationPrincipal CustomUserDetails user) {
        paymentService.changeStatus(docNo, req, user); return ResponseEntity.ok().build();
    }

    @Operation(summary = "회차별 지급 명세 일괄 저장(진행중)")
    @PutMapping("/{docNo}/payments")
    public ResponseEntity<Void> savePayments(@PathVariable(name = "docNo") String docNo,
            @RequestBody @Valid PaymentDto.LinesRequest req, @AuthenticationPrincipal CustomUserDetails user) {
        paymentService.savePayments(docNo, req, user); return ResponseEntity.ok().build();
    }
}
```

- [ ] **Step 4: 통과 + 전체 회귀** — `./gradlew test --tests "*PaymentControllerTest*"` PASS, 이어서 `./gradlew test` 전체 GREEN(개수 보고).
- [ ] **Step 5: 커밋** — `git add ...controller/ ...PaymentControllerTest.java && git commit -m "feat(payment): 컨트롤러(CRUD/상태/회차명세) + WebMvc 테스트"`

---

## Stage ④ 프론트엔드

### Task 8: 타입 + 컴포저블 + 화면

레퍼런스: contract(대상 2종 모달)·estimate(팀 그리드 → 회차 그리드)의 화면을 결합 복제.

- [ ] **Step 1: `app/types/payment.ts`** — `PaymentListItem`/`PaymentDetail(+lines)`/`PaymentLine`/`PaymentCreateRequest`/`PaymentLineRequest` + 상수:
```typescript
export const PAYMENT_STATUS = { DRAFT: '71', IN_PROGRESS: '72', DONE: '79' } as const;
export const PAYMENT_STATUS_LABEL: Record<string,string> = { '71':'작성중','72':'진행중','79':'완료' };
export const TGT_LABEL: Record<string,string> = { '100':'정보화사업','200':'전산업무비' };
```

- [ ] **Step 2: `app/composables/usePayments.ts`** — 기준경로 `${apiBase}/api/project/payments`. 메서드: `fetchPayments(query?)`, `fetchPayment(docNo)`(useApiFetch); `createPayment(body)`→string, `updatePayment(docNo,{reqCone,cttNm,cttAmt})`, `deletePayment(docNo)`, `changeStatus(docNo,stsTc)`(POST `/status`), `savePayments(docNo, lines)`(PUT `/payments`, body {lines}). void는 `$apiFetch<undefined>`. + 유닛테스트.

- [ ] **Step 3: `app/pages/project/payment/index.vue`** (목록 + 신규 의뢰 모달) — contract index.vue 복제. 컬럼: 대상구분(TGT_LABEL), 대상번호(링크), 상태(PAYMENT_STATUS_LABEL), 계약명(cttNm), 계약금액(cttAmt `formatBudget`), 요청자, 요청일시. 신규 의뢰 모달: 대상구분 분기(사업/전산업무비) + 요청내용 + (선택)계약명/계약금액 → `createPayment`.

- [ ] **Step 4: `app/pages/project/payment/[docNo].vue`** (상태분기 상세) — **마스터(계약 정보) + 회차별 지급 그리드**:
  - 헤더: 대상명 + 대상구분 배지 + 상태 Tag. 정보바: 문서번호/대상구분/요청자/요청일시.
  - 마스터 영역: 작성중(71)에서 요청내용/계약명/계약금액(InputNumber) 편집 → [저장(updatePayment)][의뢰 제출(→72)][삭제]. 그 외 읽기전용. `watch(detail,...)` 동기화.
  - 회차별 지급 그리드(진행중 72 편집, 완료 79 읽기전용): 행=회차(dfrTod)·지급금액(dfrAmt InputNumber)·지급일자(dfrDt)·지급예정일자(dfrMplDt)·적요(opnnCone). [행 추가][지급 저장(savePayments)][완료 확정(→79)]. 합계(지급금액 Σ) `formatBudget` 표시. estimate의 팀 그리드 패턴(로컬 복사본 ref, watch sync) 그대로.
  - 신규 회차 추가 시 dfrTod는 기존 최대 +1 자동 부여(또는 입력). 완료(79): 전체 읽기전용.

- [ ] **Step 5: 검증** — `cd it_frontend && npm run typecheck && npm run lint && npm test -- usePayments` 통과.
- [ ] **Step 6: 커밋** (it_frontend, 논리 단위 분할).

---

### Task 9: 메뉴 시드 + 통합 E2E

- [ ] **Step 1: 메뉴 시드** `it_database/migrations/V20260607_012__SeedPaymentMenu.sql` — Stage ①~③ 메뉴와 동일 절차(라이브 확인: 부모 `MINF0015`). 라우트(`/project/payment`) + LNK(다음 free MNU_ID 예 `MINF0026`, 부모 `MINF0015`, depth 3) + 권한(CMENUA 없음=전체 인증). 실행 후 노출 확인. 커밋(it_database).
- [ ] **Step 2: 통합 E2E (수동/Playwright)** — 사이드바 "대금지급" 진입 → 신규 의뢰(대상 사업/전산업무비, 계약명/금액) → 작성중 저장/제출 → 진행중 **회차 2건 추가**(1회차/2회차 금액·일자) → 지급 저장 → (회차 추가/삭제/재추가로 복원 동작 확인) → 완료 확정(읽기전용) → 목록 표시. 콘솔 에러 0. (검증 데이터 soft-delete 정리.)
- [ ] **Step 3: 전체 회귀** — `cd it_backend && ./gradlew test`; `cd it_frontend && npm test && npm run typecheck`.

---

## Self-Review (작성자 체크)

- **Spec 커버리지**: §3.3 ④(BPAYMM+BPAYTM+로그) → Task 1-3, 상태전이 §4(71/72/79) → Task 6, 화면 §5(목록/상세/회차 그리드) → Task 8, API §6(목록/상세/생성/수정/삭제/상태/payments) → Task 7, 검증 §7(대상/중복/전이/회차 동기화) → Task 6, 메뉴 → Task 9. **신규 공통코드 없음**(CTT_*/DFR_*/상태 모두 기존).
- **결합 패턴**: 대상 2종(contract/deliberation) + 마스터+명세 동기화·soft-deleted 복원(estimate 수정본). 명세 자연키 = (문서,버전,DFR_TOD 지급회차).
- **재사용**: Project/Cost finder, `BaseEntity.restore()`(estimate 수정에서 추가) 그대로 사용.
- **플레이스홀더**: 코드 단계 실제 코드. 프론트(Task 8)는 contract+estimate 레퍼런스 복제 지시.
- **타입 일관성**: 상태 71/72/79, 대상 100/200. 문서번호 `PAY-{YYYY}-{4}`. CTT_AMT/DFR_AMT NUMBER(18,3)↔BigDecimal. 명세 로그 시퀀스 `SEQ_BPAYTL`, 마스터 로그 `SEQ_BPAYML` (AuditLogIdGenerator 규칙).
- **실행 리스크**: (1) 마이그레이션 번호 충돌 시 다음. (2) `BaseEntity.restore()` 존재 확인(없으면 추가). (3) git 위생. (4) bbrC 미적용 MVP. (5) 명세 saveLines는 estimate의 **복원 포함** 최종본 패턴을 따를 것(삭제 포함 전체 로드 → 재추가 시 restore).

---

## Execution Handoff

Stage ④ 완료 시 **정보화사업 집행 4단계(소요예산 산정·과업심의위원회·입찰/계약·대금지급) 전체 MVP 완성**. 이후 성과평가(81/89) 등 잔여 단계는 별도 논의.
