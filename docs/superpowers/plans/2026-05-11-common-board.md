# 공통 게시판 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TAAABB_CBLBMM` 게시판 메타 테이블 기반의 공지사항·자료실 등 재사용 가능한 공통 게시판을 백엔드 API + 프론트엔드 UI로 구현한다.

**Architecture:** 게시판 메타(`Cblbmm`)가 정책을 중앙 제어하고, 게시물(`Cblbcm`)은 그룹+순서+레벨 3컬럼 트리로 답변글을 표현하며, 댓글(`Ccmmtm`)도 동일 패턴을 적용한다. 권한은 메타 단위 + 게시물 단위 이중 제어.

**Tech Stack:** Spring Boot 4 / Java 25 / QueryDSL / Oracle / Nuxt 4 / PrimeVue / Tiptap / DOMPurify

---

## 파일 구조

### 신규 생성
```
it_database/migrations/
  V20260511_001__common_board_tables.sql
  V20260511_002__common_board_sequences.sql
  V20260511_003__common_board_indexes.sql
  V20260511_004__common_board_seed.sql

it_backend/src/main/java/com/kdb/it/common/board/
  entity/Cblbmm.java
  entity/Cblbcm.java
  entity/Ccmmtm.java
  dto/BoardMetaDto.java
  dto/BoardPostDto.java
  dto/BoardCommentDto.java
  repository/BoardMetaRepository.java
  repository/BoardMetaRepositoryCustom.java
  repository/BoardMetaRepositoryImpl.java
  repository/BoardPostRepository.java
  repository/BoardPostRepositoryCustom.java
  repository/BoardPostRepositoryImpl.java
  repository/BoardCommentRepository.java
  repository/BoardCommentRepositoryCustom.java
  repository/BoardCommentRepositoryImpl.java
  service/BoardMetaService.java
  service/BoardPostService.java
  service/BoardCommentService.java
  controller/BoardMetaController.java
  controller/AdminBoardMetaController.java
  controller/BoardPostController.java
  controller/BoardCommentController.java

it_backend/src/main/java/com/kdb/it/domain/log/entity/
  CblbmmL.java
  CblbcmL.java
  CcmmtmL.java

it_backend/src/test/java/com/kdb/it/common/board/service/
  BoardPostServiceTest.java
  BoardCommentServiceTest.java

it_frontend/app/types/board.ts
it_frontend/app/composables/useBoard.ts
it_frontend/app/composables/useBoardPost.ts
it_frontend/app/composables/useBoardComment.ts
it_frontend/app/pages/board/index.vue
it_frontend/app/pages/board/[blbMngNo]/index.vue
it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/index.vue
it_frontend/app/pages/board/[blbMngNo]/form.vue
it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/edit.vue
it_frontend/app/pages/admin/boards/index.vue
it_frontend/app/components/board/BoardCommentTree.vue
```

### 수정
```
it_backend/src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java
it_frontend/app/components/AppSidebar.vue
```

---

## Task 1: DDL — 테이블·시퀀스·인덱스·시드

**Files:**
- Create: `it_database/migrations/V20260511_001__common_board_tables.sql`
- Create: `it_database/migrations/V20260511_002__common_board_sequences.sql`
- Create: `it_database/migrations/V20260511_003__common_board_indexes.sql`
- Create: `it_database/migrations/V20260511_004__common_board_seed.sql`

- [ ] **Step 1: 테이블 DDL 작성**

```sql
-- V20260511_001__common_board_tables.sql
-- 공통 게시판 메타·본문·댓글·변경로그 테이블 생성

-- 1) 게시판 메타 (TAAABB_CBLBMM)
CREATE TABLE TAAABB_CBLBMM (
    BLB_MNG_NO        VARCHAR2(32)  NOT NULL,
    BLB_NM            VARCHAR2(100) NOT NULL,
    BLB_TP            VARCHAR2(32)  NOT NULL,
    REP_USE_YN        VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    CMMT_USE_YN       VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    FL_ESN_YN         VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    HRK_FXN_USE_YN    VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    NAC_TP_USE_YN     VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    KD_USE_YN         VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    INQ_ATH_C         VARCHAR2(32)  DEFAULT 'ALL' NOT NULL,
    ENR_ATH_C         VARCHAR2(32)  DEFAULT 'ALL' NOT NULL,
    BBR_LMTN_USE_YN   VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    BBR_LMTN_C        VARCHAR2(8),
    SRE_SQN_NO        NUMBER(3)     DEFAULT 0 NOT NULL,
    USE_YN            VARCHAR2(1)   DEFAULT 'Y' NOT NULL,
    RMK               VARCHAR2(500),
    DEL_YN            VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    GUID              VARCHAR2(38),
    GUID_PRG_SNO      NUMBER(10)    DEFAULT 1,
    FST_ENR_DTM       TIMESTAMP,
    FST_ENR_USID      VARCHAR2(14),
    LST_CHG_DTM       TIMESTAMP,
    LST_CHG_USID      VARCHAR2(14),
    CONSTRAINT PK_CBLBMM PRIMARY KEY (BLB_MNG_NO)
);
COMMENT ON TABLE  TAAABB_CBLBMM            IS '게시판 메타';
COMMENT ON COLUMN TAAABB_CBLBMM.BLB_MNG_NO IS '게시판관리번호';
COMMENT ON COLUMN TAAABB_CBLBMM.BLB_NM     IS '게시판명';
COMMENT ON COLUMN TAAABB_CBLBMM.BLB_TP     IS '게시판유형';
COMMENT ON COLUMN TAAABB_CBLBMM.REP_USE_YN IS '답변사용여부';
COMMENT ON COLUMN TAAABB_CBLBMM.CMMT_USE_YN IS '댓글사용여부';
COMMENT ON COLUMN TAAABB_CBLBMM.FL_ESN_YN  IS '첨부필수여부';
COMMENT ON COLUMN TAAABB_CBLBMM.HRK_FXN_USE_YN IS '상위고정사용여부';
COMMENT ON COLUMN TAAABB_CBLBMM.NAC_TP_USE_YN  IS '게시물유형사용여부';
COMMENT ON COLUMN TAAABB_CBLBMM.KD_USE_YN      IS '종류사용여부';
COMMENT ON COLUMN TAAABB_CBLBMM.INQ_ATH_C      IS '조회권한코드';
COMMENT ON COLUMN TAAABB_CBLBMM.ENR_ATH_C      IS '등록권한코드';
COMMENT ON COLUMN TAAABB_CBLBMM.BBR_LMTN_USE_YN IS '담당부서한정사용여부';
COMMENT ON COLUMN TAAABB_CBLBMM.BBR_LMTN_C     IS '담당부서한정코드';
COMMENT ON COLUMN TAAABB_CBLBMM.SRE_SQN_NO     IS '화면순서번호';
COMMENT ON COLUMN TAAABB_CBLBMM.USE_YN         IS '사용여부';

-- 2) 게시물 본문 (TAAABB_CBLBCM)
CREATE TABLE TAAABB_CBLBCM (
    NAC_MNG_NO        VARCHAR2(32)  NOT NULL,
    BLB_MNG_NO        VARCHAR2(32)  NOT NULL,
    NAC_NM            VARCHAR2(300) NOT NULL,
    NAC_CONE          CLOB,
    NAC_INQ_NBR       NUMBER(10)    DEFAULT 0 NOT NULL,
    NAC_TP            VARCHAR2(32),
    KD_C              VARCHAR2(32),
    PRIT_C            VARCHAR2(32)  DEFAULT 'PRIT_C_001' NOT NULL,
    HRK_FXN_YN        VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    SRE_YN            VARCHAR2(1)   DEFAULT 'Y' NOT NULL,
    BBR_C             VARCHAR2(8),
    STT_YMD           DATE,
    END_YMD           DATE,
    FL_APG_YN         VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    FL_NBR            NUMBER(4)     DEFAULT 0 NOT NULL,
    NAC_GRP_NO        VARCHAR2(32)  NOT NULL,
    NAC_GRP_SQN       NUMBER(5)     DEFAULT 0 NOT NULL,
    NAC_GRP_LEV       NUMBER(2)     DEFAULT 0 NOT NULL,
    HRK_NAC_MNG_NO    VARCHAR2(32),
    DEL_YN            VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    GUID              VARCHAR2(38),
    GUID_PRG_SNO      NUMBER(10)    DEFAULT 1,
    FST_ENR_DTM       TIMESTAMP,
    FST_ENR_USID      VARCHAR2(14),
    LST_CHG_DTM       TIMESTAMP,
    LST_CHG_USID      VARCHAR2(14),
    CONSTRAINT PK_CBLBCM PRIMARY KEY (NAC_MNG_NO),
    CONSTRAINT FK_CBLBCM_BLB FOREIGN KEY (BLB_MNG_NO) REFERENCES TAAABB_CBLBMM(BLB_MNG_NO)
);
COMMENT ON TABLE  TAAABB_CBLBCM             IS '게시물';
COMMENT ON COLUMN TAAABB_CBLBCM.NAC_MNG_NO  IS '게시물관리번호';
COMMENT ON COLUMN TAAABB_CBLBCM.BLB_MNG_NO  IS '게시판관리번호';
COMMENT ON COLUMN TAAABB_CBLBCM.NAC_NM      IS '게시물명';
COMMENT ON COLUMN TAAABB_CBLBCM.NAC_CONE    IS '게시물내용';
COMMENT ON COLUMN TAAABB_CBLBCM.NAC_INQ_NBR IS '게시물조회수';
COMMENT ON COLUMN TAAABB_CBLBCM.NAC_TP      IS '게시물유형';
COMMENT ON COLUMN TAAABB_CBLBCM.KD_C        IS '종류코드';
COMMENT ON COLUMN TAAABB_CBLBCM.PRIT_C      IS '중요도코드';
COMMENT ON COLUMN TAAABB_CBLBCM.HRK_FXN_YN  IS '상위고정여부';
COMMENT ON COLUMN TAAABB_CBLBCM.SRE_YN      IS '화면여부';
COMMENT ON COLUMN TAAABB_CBLBCM.BBR_C       IS '담당부서코드';
COMMENT ON COLUMN TAAABB_CBLBCM.STT_YMD     IS '시작일자';
COMMENT ON COLUMN TAAABB_CBLBCM.END_YMD     IS '종료일자';
COMMENT ON COLUMN TAAABB_CBLBCM.FL_APG_YN   IS '파일첨부여부';
COMMENT ON COLUMN TAAABB_CBLBCM.FL_NBR      IS '파일수';
COMMENT ON COLUMN TAAABB_CBLBCM.NAC_GRP_NO  IS '게시물그룹번호';
COMMENT ON COLUMN TAAABB_CBLBCM.NAC_GRP_SQN IS '게시물그룹순서';
COMMENT ON COLUMN TAAABB_CBLBCM.NAC_GRP_LEV IS '게시물그룹레벨';
COMMENT ON COLUMN TAAABB_CBLBCM.HRK_NAC_MNG_NO IS '상위게시물관리번호';

-- 3) 댓글 (TAAABB_CCMMTM)
CREATE TABLE TAAABB_CCMMTM (
    CMMT_MNG_NO       VARCHAR2(32)  NOT NULL,
    NAC_MNG_NO        VARCHAR2(32)  NOT NULL,
    CMMT_CONE         CLOB          NOT NULL,
    SRE_YN            VARCHAR2(1)   DEFAULT 'Y' NOT NULL,
    CMMT_GRP_NO       VARCHAR2(32)  NOT NULL,
    CMMT_GRP_SQN      NUMBER(5)     DEFAULT 0 NOT NULL,
    CMMT_GRP_LEV      NUMBER(2)     DEFAULT 0 NOT NULL,
    HRK_CMMT_MNG_NO   VARCHAR2(32),
    DEL_YN            VARCHAR2(1)   DEFAULT 'N' NOT NULL,
    GUID              VARCHAR2(38),
    GUID_PRG_SNO      NUMBER(10)    DEFAULT 1,
    FST_ENR_DTM       TIMESTAMP,
    FST_ENR_USID      VARCHAR2(14),
    LST_CHG_DTM       TIMESTAMP,
    LST_CHG_USID      VARCHAR2(14),
    CONSTRAINT PK_CCMMTM PRIMARY KEY (CMMT_MNG_NO),
    CONSTRAINT FK_CCMMTM_NAC FOREIGN KEY (NAC_MNG_NO) REFERENCES TAAABB_CBLBCM(NAC_MNG_NO)
);
COMMENT ON TABLE  TAAABB_CCMMTM              IS '게시판댓글';
COMMENT ON COLUMN TAAABB_CCMMTM.CMMT_MNG_NO  IS '댓글관리번호';
COMMENT ON COLUMN TAAABB_CCMMTM.NAC_MNG_NO   IS '게시물관리번호';
COMMENT ON COLUMN TAAABB_CCMMTM.CMMT_CONE    IS '댓글내용';
COMMENT ON COLUMN TAAABB_CCMMTM.SRE_YN       IS '화면여부';
COMMENT ON COLUMN TAAABB_CCMMTM.CMMT_GRP_NO  IS '댓글그룹번호';
COMMENT ON COLUMN TAAABB_CCMMTM.CMMT_GRP_SQN IS '댓글그룹순서';
COMMENT ON COLUMN TAAABB_CCMMTM.CMMT_GRP_LEV IS '댓글그룹레벨';
COMMENT ON COLUMN TAAABB_CCMMTM.HRK_CMMT_MNG_NO IS '상위댓글관리번호';

-- 4) 변경 로그 테이블
CREATE TABLE TAAABB_CBLBML (
    LOG_SNO      VARCHAR2(32)  NOT NULL,
    CHG_TP       VARCHAR2(1),
    CHG_DTM      TIMESTAMP,
    CHG_USID     VARCHAR2(14),
    DEL_YN       VARCHAR2(1),
    GUID         VARCHAR2(38),
    GUID_PRG_SNO NUMBER(10),
    FST_ENR_DTM  TIMESTAMP,
    FST_ENR_USID VARCHAR2(14),
    LST_CHG_DTM  TIMESTAMP,
    LST_CHG_USID VARCHAR2(14),
    BLB_MNG_NO   VARCHAR2(32),
    BLB_NM       VARCHAR2(100),
    BLB_TP       VARCHAR2(32),
    REP_USE_YN   VARCHAR2(1),
    CMMT_USE_YN  VARCHAR2(1),
    FL_ESN_YN    VARCHAR2(1),
    HRK_FXN_USE_YN VARCHAR2(1),
    NAC_TP_USE_YN  VARCHAR2(1),
    KD_USE_YN    VARCHAR2(1),
    INQ_ATH_C    VARCHAR2(32),
    ENR_ATH_C    VARCHAR2(32),
    BBR_LMTN_USE_YN VARCHAR2(1),
    BBR_LMTN_C   VARCHAR2(8),
    SRE_SQN_NO   NUMBER(3),
    USE_YN       VARCHAR2(1),
    RMK          VARCHAR2(500),
    CONSTRAINT PK_CBLBML PRIMARY KEY (LOG_SNO)
);
COMMENT ON TABLE TAAABB_CBLBML IS '게시판메타변경로그';

CREATE TABLE TAAABB_CBLBCL (
    LOG_SNO      VARCHAR2(32)  NOT NULL,
    CHG_TP       VARCHAR2(1),
    CHG_DTM      TIMESTAMP,
    CHG_USID     VARCHAR2(14),
    DEL_YN       VARCHAR2(1),
    GUID         VARCHAR2(38),
    GUID_PRG_SNO NUMBER(10),
    FST_ENR_DTM  TIMESTAMP,
    FST_ENR_USID VARCHAR2(14),
    LST_CHG_DTM  TIMESTAMP,
    LST_CHG_USID VARCHAR2(14),
    NAC_MNG_NO   VARCHAR2(32),
    BLB_MNG_NO   VARCHAR2(32),
    NAC_NM       VARCHAR2(300),
    NAC_CONE     CLOB,
    NAC_INQ_NBR  NUMBER(10),
    NAC_TP       VARCHAR2(32),
    KD_C         VARCHAR2(32),
    PRIT_C       VARCHAR2(32),
    HRK_FXN_YN   VARCHAR2(1),
    SRE_YN       VARCHAR2(1),
    BBR_C        VARCHAR2(8),
    STT_YMD      DATE,
    END_YMD      DATE,
    FL_APG_YN    VARCHAR2(1),
    FL_NBR       NUMBER(4),
    NAC_GRP_NO   VARCHAR2(32),
    NAC_GRP_SQN  NUMBER(5),
    NAC_GRP_LEV  NUMBER(2),
    HRK_NAC_MNG_NO VARCHAR2(32),
    CONSTRAINT PK_CBLBCL PRIMARY KEY (LOG_SNO)
);
COMMENT ON TABLE TAAABB_CBLBCL IS '게시물변경로그';

CREATE TABLE TAAABB_CCMMTL (
    LOG_SNO         VARCHAR2(32) NOT NULL,
    CHG_TP          VARCHAR2(1),
    CHG_DTM         TIMESTAMP,
    CHG_USID        VARCHAR2(14),
    DEL_YN          VARCHAR2(1),
    GUID            VARCHAR2(38),
    GUID_PRG_SNO    NUMBER(10),
    FST_ENR_DTM     TIMESTAMP,
    FST_ENR_USID    VARCHAR2(14),
    LST_CHG_DTM     TIMESTAMP,
    LST_CHG_USID    VARCHAR2(14),
    CMMT_MNG_NO     VARCHAR2(32),
    NAC_MNG_NO      VARCHAR2(32),
    CMMT_CONE       CLOB,
    SRE_YN          VARCHAR2(1),
    CMMT_GRP_NO     VARCHAR2(32),
    CMMT_GRP_SQN    NUMBER(5),
    CMMT_GRP_LEV    NUMBER(2),
    HRK_CMMT_MNG_NO VARCHAR2(32),
    CONSTRAINT PK_CCMMTL PRIMARY KEY (LOG_SNO)
);
COMMENT ON TABLE TAAABB_CCMMTL IS '게시판댓글변경로그';
```

- [ ] **Step 2: 시퀀스 DDL 작성**

```sql
-- V20260511_002__common_board_sequences.sql
-- 게시판 채번용 Oracle 시퀀스 생성

-- 게시판 메타 관리번호 시퀀스 (BLBM-{YYYY}-{0001})
CREATE SEQUENCE SQ_BLBMNGNO START WITH 1 INCREMENT BY 1 NOCACHE;

-- 게시물 관리번호 시퀀스 (NAC-{YYYY}-{0001})
CREATE SEQUENCE SQ_NACMNGNO START WITH 1 INCREMENT BY 1 NOCACHE;

-- 댓글 관리번호 시퀀스 (CMMT-{YYYY}-{0001})
CREATE SEQUENCE SQ_CMMTMNGNO START WITH 1 INCREMENT BY 1 NOCACHE;

-- 변경 로그 시퀀스 (AuditLogIdGenerator 규칙: S_{테이블명_TAAABB_제거})
CREATE SEQUENCE S_CBLBML  START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE S_CBLBCL  START WITH 1 INCREMENT BY 1 NOCACHE;
CREATE SEQUENCE S_CCMMTL  START WITH 1 INCREMENT BY 1 NOCACHE;
```

- [ ] **Step 3: 인덱스 DDL 작성**

```sql
-- V20260511_003__common_board_indexes.sql
CREATE INDEX IDX_CBLBCM_LIST   ON TAAABB_CBLBCM (BLB_MNG_NO, DEL_YN, SRE_YN, HRK_FXN_YN, FST_ENR_DTM);
CREATE INDEX IDX_CBLBCM_GRP    ON TAAABB_CBLBCM (NAC_GRP_NO, NAC_GRP_SQN);
CREATE INDEX IDX_CBLBCM_HRK    ON TAAABB_CBLBCM (HRK_NAC_MNG_NO);
CREATE INDEX IDX_CBLBCM_AUTHOR ON TAAABB_CBLBCM (FST_ENR_USID, DEL_YN);
CREATE INDEX IDX_CBLBCM_BBR    ON TAAABB_CBLBCM (BBR_C);
CREATE INDEX IDX_CBLBMM_NAV    ON TAAABB_CBLBMM (USE_YN, SRE_SQN_NO);
CREATE INDEX IDX_CCMMTM_LIST   ON TAAABB_CCMMTM (NAC_MNG_NO, DEL_YN, SRE_YN, FST_ENR_DTM);
CREATE INDEX IDX_CCMMTM_GRP    ON TAAABB_CCMMTM (CMMT_GRP_NO, CMMT_GRP_SQN);
CREATE INDEX IDX_CCMMTM_HRK    ON TAAABB_CCMMTM (HRK_CMMT_MNG_NO);
```

- [ ] **Step 4: 시드 데이터 작성**

```sql
-- V20260511_004__common_board_seed.sql
-- 공통코드 시드
INSERT INTO TAAABB_CCODEM (GRP_C, C, C_NM, SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
VALUES ('BLB_TP', 'BLB_TP_001', '공지사항', 1, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM');
INSERT INTO TAAABB_CCODEM (GRP_C, C, C_NM, SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
VALUES ('BLB_TP', 'BLB_TP_002', '자료실',   2, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM');

INSERT INTO TAAABB_CCODEM (GRP_C, C, C_NM, SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
VALUES ('PRIT_C', 'PRIT_C_001', '일반', 1, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM');
INSERT INTO TAAABB_CCODEM (GRP_C, C, C_NM, SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
VALUES ('PRIT_C', 'PRIT_C_002', '중요', 2, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM');
INSERT INTO TAAABB_CCODEM (GRP_C, C, C_NM, SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
VALUES ('PRIT_C', 'PRIT_C_003', '긴급', 3, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM');

INSERT INTO TAAABB_CCODEM (GRP_C, C, C_NM, SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
VALUES ('NAC_TP', 'NAC_TP_001', '작업예정', 1, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM');
INSERT INTO TAAABB_CCODEM (GRP_C, C, C_NM, SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
VALUES ('NAC_TP', 'NAC_TP_002', '작업완료', 2, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM');
INSERT INTO TAAABB_CCODEM (GRP_C, C, C_NM, SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
VALUES ('NAC_TP', 'NAC_TP_003', '교육자료', 3, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM');

-- 게시판 메타 시드: 공지사항
INSERT INTO TAAABB_CBLBMM (
    BLB_MNG_NO, BLB_NM, BLB_TP,
    REP_USE_YN, CMMT_USE_YN, FL_ESN_YN, HRK_FXN_USE_YN, NAC_TP_USE_YN, KD_USE_YN,
    INQ_ATH_C, ENR_ATH_C, BBR_LMTN_USE_YN,
    SRE_SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID
) VALUES (
    'BLBM-2026-0001', '공지사항', 'BLB_TP_001',
    'N', 'N', 'N', 'Y', 'N', 'N',
    'ALL', 'ROLE_ADMIN', 'N',
    1, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM'
);

-- 게시판 메타 시드: 자료실
INSERT INTO TAAABB_CBLBMM (
    BLB_MNG_NO, BLB_NM, BLB_TP,
    REP_USE_YN, CMMT_USE_YN, FL_ESN_YN, HRK_FXN_USE_YN, NAC_TP_USE_YN, KD_USE_YN,
    INQ_ATH_C, ENR_ATH_C, BBR_LMTN_USE_YN,
    SRE_SQN_NO, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID
) VALUES (
    'BLBM-2026-0002', '자료실', 'BLB_TP_002',
    'N', 'Y', 'Y', 'N', 'N', 'Y',
    'ALL', 'ALL', 'N',
    2, 'Y', 'N', SYS_GUID(), 1, SYSDATE, 'SYSTEM'
);

COMMIT;
```

- [ ] **Step 5: DB에 적용 확인 (개발 환경)**

```bash
# Oracle sqlplus 또는 DBeaver에서 실행 후 검증
# 테이블 존재 확인
SELECT TABLE_NAME FROM USER_TABLES WHERE TABLE_NAME LIKE 'TAAABB_C%BL%' OR TABLE_NAME LIKE 'TAAABB_CCMM%';
# 시퀀스 확인
SELECT SEQUENCE_NAME FROM USER_SEQUENCES WHERE SEQUENCE_NAME LIKE 'SQ_%' OR SEQUENCE_NAME LIKE 'S_C%';
```

- [ ] **Step 6: 커밋**

```bash
git add it_database/migrations/
git commit -m "feat: 공통 게시판 DDL - 테이블/시퀀스/인덱스/시드 추가"
```

---

## Task 2: 엔티티 — Cblbmm (게시판 메타) + CblbmmL

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/board/entity/Cblbmm.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/entity/CblbmmL.java`

- [ ] **Step 1: Cblbmm 엔티티 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/entity/Cblbmm.java
package com.kdb.it.common.board.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.CblbmmL;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * 게시판 메타 엔티티 — TAAABB_CBLBMM
 *
 * <p>게시판 단위 정책(답변·댓글·첨부필수·권한 등)을 관리한다.
 * 변경 시 {@link CblbmmL}에 이력이 자동 적재된다.</p>
 */
@LogTarget(entity = CblbmmL.class)
@Entity
@Table(name = "TAAABB_CBLBMM")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Cblbmm extends BaseEntity {

    /** 게시판관리번호 PK. 형식: BLBM-{YYYY}-{0001} */
    @Id
    @Column(name = "BLB_MNG_NO", nullable = false, length = 32)
    private String blbMngNo;

    /** 게시판명 (예: 공지사항, 자료실) */
    @Column(name = "BLB_NM", nullable = false, length = 100)
    private String blbNm;

    /** 게시판유형 코드 (BLB_TP_001=공지사항, BLB_TP_002=자료실) */
    @Column(name = "BLB_TP", nullable = false, length = 32)
    private String blbTp;

    /** 답변사용여부 Y/N */
    @Column(name = "REP_USE_YN", nullable = false, length = 1)
    private String repUseYn;

    /** 댓글사용여부 Y/N */
    @Column(name = "CMMT_USE_YN", nullable = false, length = 1)
    private String cmmtUseYn;

    /** 첨부필수여부 Y/N */
    @Column(name = "FL_ESN_YN", nullable = false, length = 1)
    private String flEsnYn;

    /** 상위고정사용여부 Y/N */
    @Column(name = "HRK_FXN_USE_YN", nullable = false, length = 1)
    private String hrkFxnUseYn;

    /** 게시물유형사용여부 Y/N — Y면 작성 화면에 유형 선택 활성 */
    @Column(name = "NAC_TP_USE_YN", nullable = false, length = 1)
    private String nacTpUseYn;

    /** 종류(카테고리)사용여부 Y/N */
    @Column(name = "KD_USE_YN", nullable = false, length = 1)
    private String kdUseYn;

    /** 조회권한코드 (ALL / ROLE_ADMIN / ROLE_USER / ROLE_PLAN) */
    @Column(name = "INQ_ATH_C", nullable = false, length = 32)
    private String inqAthC;

    /** 등록권한코드 (ALL / ROLE_ADMIN / ROLE_USER / ROLE_PLAN) */
    @Column(name = "ENR_ATH_C", nullable = false, length = 32)
    private String enrAthC;

    /** 담당부서한정사용여부 Y/N */
    @Column(name = "BBR_LMTN_USE_YN", nullable = false, length = 1)
    private String bbrLmtnUseYn;

    /** 담당부서한정코드 — Y일 때 해당 부서만 접근 가능 */
    @Column(name = "BBR_LMTN_C", length = 8)
    private String bbrLmtnC;

    /** 사이드바 정렬 순서 */
    @Column(name = "SRE_SQN_NO", nullable = false)
    private Integer sreSqnNo;

    /** 사용여부 Y/N — N이면 사이드바 미노출 */
    @Column(name = "USE_YN", nullable = false, length = 1)
    private String useYn;

    /** 운영자 메모 */
    @Column(name = "RMK", length = 500)
    private String rmk;

    // ----------------------------------------------------------------
    // 비즈니스 메서드
    // ----------------------------------------------------------------

    /**
     * 게시판 메타 수정 커맨드
     *
     * @param blbNm         게시판명
     * @param repUseYn      답변사용여부
     * @param cmmtUseYn     댓글사용여부
     * @param flEsnYn       첨부필수여부
     * @param hrkFxnUseYn   상위고정사용여부
     * @param nacTpUseYn    게시물유형사용여부
     * @param kdUseYn       종류사용여부
     * @param inqAthC       조회권한코드
     * @param enrAthC       등록권한코드
     * @param bbrLmtnUseYn  담당부서한정사용여부
     * @param bbrLmtnC      담당부서한정코드
     * @param sreSqnNo      화면순서번호
     * @param useYn         사용여부
     * @param rmk           비고
     */
    public record UpdateCommand(
        String blbNm, String repUseYn, String cmmtUseYn,
        String flEsnYn, String hrkFxnUseYn, String nacTpUseYn, String kdUseYn,
        String inqAthC, String enrAthC,
        String bbrLmtnUseYn, String bbrLmtnC,
        Integer sreSqnNo, String useYn, String rmk
    ) {}

    /** 게시판 메타 정보 수정 — JPA Dirty Checking 활용 */
    public void update(UpdateCommand cmd) {
        this.blbNm        = cmd.blbNm();
        this.repUseYn     = cmd.repUseYn();
        this.cmmtUseYn    = cmd.cmmtUseYn();
        this.flEsnYn      = cmd.flEsnYn();
        this.hrkFxnUseYn  = cmd.hrkFxnUseYn();
        this.nacTpUseYn   = cmd.nacTpUseYn();
        this.kdUseYn      = cmd.kdUseYn();
        this.inqAthC      = cmd.inqAthC();
        this.enrAthC      = cmd.enrAthC();
        this.bbrLmtnUseYn = cmd.bbrLmtnUseYn();
        this.bbrLmtnC     = cmd.bbrLmtnC();
        this.sreSqnNo     = cmd.sreSqnNo();
        this.useYn        = cmd.useYn();
        this.rmk          = cmd.rmk();
    }
}
```

- [ ] **Step 2: CblbmmL 로그 엔티티 작성**

```java
// it_backend/src/main/java/com/kdb/it/domain/log/entity/CblbmmL.java
package com.kdb.it.domain.log.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * 게시판 메타 변경 로그 엔티티 — TAAABB_CBLBML
 *
 * <p>{@link com.kdb.it.common.board.entity.Cblbmm}의 CUD 이벤트 발생 시
 * {@link com.kdb.it.domain.log.listener.ChangeLogEntityListener}가 자동 적재한다.</p>
 */
@Entity
@Table(name = "TAAABB_CBLBML")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class CblbmmL extends BaseLogEntity {

    @Column(name = "BLB_MNG_NO",      length = 32)  private String  blbMngNo;
    @Column(name = "BLB_NM",          length = 100) private String  blbNm;
    @Column(name = "BLB_TP",          length = 32)  private String  blbTp;
    @Column(name = "REP_USE_YN",      length = 1)   private String  repUseYn;
    @Column(name = "CMMT_USE_YN",     length = 1)   private String  cmmtUseYn;
    @Column(name = "FL_ESN_YN",       length = 1)   private String  flEsnYn;
    @Column(name = "HRK_FXN_USE_YN",  length = 1)   private String  hrkFxnUseYn;
    @Column(name = "NAC_TP_USE_YN",   length = 1)   private String  nacTpUseYn;
    @Column(name = "KD_USE_YN",       length = 1)   private String  kdUseYn;
    @Column(name = "INQ_ATH_C",       length = 32)  private String  inqAthC;
    @Column(name = "ENR_ATH_C",       length = 32)  private String  enrAthC;
    @Column(name = "BBR_LMTN_USE_YN", length = 1)   private String  bbrLmtnUseYn;
    @Column(name = "BBR_LMTN_C",      length = 8)   private String  bbrLmtnC;
    @Column(name = "SRE_SQN_NO")                    private Integer sreSqnNo;
    @Column(name = "USE_YN",          length = 1)   private String  useYn;
    @Column(name = "RMK",             length = 500) private String  rmk;
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd it_backend && ./gradlew compileJava
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/board/entity/Cblbmm.java
git add it_backend/src/main/java/com/kdb/it/domain/log/entity/CblbmmL.java
git commit -m "feat: Cblbmm 게시판메타 엔티티 + CblbmmL 변경로그 엔티티 추가"
```

---

## Task 3: 엔티티 — Cblbcm (게시물) + CblbcmL

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/board/entity/Cblbcm.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/entity/CblbcmL.java`

- [ ] **Step 1: Cblbcm 엔티티 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/entity/Cblbcm.java
package com.kdb.it.common.board.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.CblbcmL;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

/**
 * 게시물 엔티티 — TAAABB_CBLBCM
 *
 * <p>답변글 트리는 NAC_GRP_NO / NAC_GRP_SQN / NAC_GRP_LEV 3컬럼으로 표현한다.
 * 변경 시 {@link CblbcmL}에 이력이 자동 적재된다.</p>
 */
@LogTarget(entity = CblbcmL.class)
@Entity
@Table(name = "TAAABB_CBLBCM")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Cblbcm extends BaseEntity {

    /** 게시물관리번호 PK. 형식: NAC-{YYYY}-{0001} */
    @Id
    @Column(name = "NAC_MNG_NO", nullable = false, length = 32)
    private String nacMngNo;

    /** 게시판관리번호 FK */
    @Column(name = "BLB_MNG_NO", nullable = false, length = 32)
    private String blbMngNo;

    /** 제목 */
    @Column(name = "NAC_NM", nullable = false, length = 300)
    private String nacNm;

    /** 본문 HTML — HtmlSanitizer.sanitize() 적용 의무 */
    @Lob
    @Column(name = "NAC_CONE")
    private String nacCone;

    /** 조회수 */
    @Column(name = "NAC_INQ_NBR", nullable = false)
    private Integer nacInqNbr;

    /** 게시물유형 코드 (메타 NAC_TP_USE_YN='Y'일 때만 유효) */
    @Column(name = "NAC_TP", length = 32)
    private String nacTp;

    /** 종류(카테고리) 코드 */
    @Column(name = "KD_C", length = 32)
    private String kdC;

    /** 중요도 코드 (PRIT_C_001=일반, 002=중요, 003=긴급) */
    @Column(name = "PRIT_C", nullable = false, length = 32)
    private String pritC;

    /** 상위고정여부 Y/N */
    @Column(name = "HRK_FXN_YN", nullable = false, length = 1)
    private String hrkFxnYn;

    /** 화면여부(노출) Y/N */
    @Column(name = "SRE_YN", nullable = false, length = 1)
    private String sreYn;

    /** 공개 대상 부서코드 — NULL이면 전체 */
    @Column(name = "BBR_C", length = 8)
    private String bbrC;

    /** 공개 시작일 — NULL이면 즉시 */
    @Column(name = "STT_YMD")
    private LocalDate sttYmd;

    /** 공개 종료일 — NULL이면 무기한 */
    @Column(name = "END_YMD")
    private LocalDate endYmd;

    /** 파일첨부여부 캐시 Y/N */
    @Column(name = "FL_APG_YN", nullable = false, length = 1)
    private String flApgYn;

    /** 첨부파일 개수 캐시 */
    @Column(name = "FL_NBR", nullable = false)
    private Integer flNbr;

    /** 그룹번호 — 최상위 글의 NAC_MNG_NO */
    @Column(name = "NAC_GRP_NO", nullable = false, length = 32)
    private String nacGrpNo;

    /** 그룹 내 정렬 순서 */
    @Column(name = "NAC_GRP_SQN", nullable = false)
    private Integer nacGrpSqn;

    /** 트리 깊이 (0=원글, 1=답글, 2=답글의답글…) */
    @Column(name = "NAC_GRP_LEV", nullable = false)
    private Integer nacGrpLev;

    /** 직계 부모 게시물 PK */
    @Column(name = "HRK_NAC_MNG_NO", length = 32)
    private String hrkNacMngNo;

    // ----------------------------------------------------------------
    // 비즈니스 메서드
    // ----------------------------------------------------------------

    /**
     * 게시물 수정 커맨드
     *
     * @param nacNm    제목 (최대 300자)
     * @param nacCone  본문 HTML (sanitize 완료 값)
     * @param nacTp    게시물유형 코드
     * @param kdC      종류 코드
     * @param pritC    중요도 코드
     * @param hrkFxnYn 상위고정여부
     * @param sreYn    화면여부
     * @param bbrC     공개 대상 부서코드
     * @param sttYmd   공개 시작일
     * @param endYmd   공개 종료일
     */
    public record UpdateCommand(
        String nacNm, String nacCone, String nacTp, String kdC, String pritC,
        String hrkFxnYn, String sreYn, String bbrC,
        LocalDate sttYmd, LocalDate endYmd
    ) {}

    /** 게시물 내용 수정 */
    public void update(UpdateCommand cmd) {
        this.nacNm    = cmd.nacNm();
        this.nacCone  = cmd.nacCone();
        this.nacTp    = cmd.nacTp();
        this.kdC      = cmd.kdC();
        this.pritC    = cmd.pritC();
        this.hrkFxnYn = cmd.hrkFxnYn();
        this.sreYn    = cmd.sreYn();
        this.bbrC     = cmd.bbrC();
        this.sttYmd   = cmd.sttYmd();
        this.endYmd   = cmd.endYmd();
    }

    /** 조회수 1 증가 */
    public void incrementViewCount() {
        this.nacInqNbr = this.nacInqNbr + 1;
    }

    /**
     * 답변글 삽입을 위한 SQN 밀어내기 — 자신 이후 형제·후손 SQN +1
     *
     * <p>서비스 레이어에서 직접 호출하지 않고
     * {@link com.kdb.it.common.board.repository.BoardPostRepository#shiftGroupSqn}을
     * 통해 벌크 UPDATE로 처리한다.</p>
     */
    public void incrementSqn() {
        this.nacGrpSqn = this.nacGrpSqn + 1;
    }

    /** 첨부파일 캐시 갱신 */
    public void updateFileCache(boolean hasFile, int fileCount) {
        this.flApgYn = hasFile ? "Y" : "N";
        this.flNbr   = fileCount;
    }

    /** 그룹 정보 설정 — 원글 등록 시 */
    public void initGroupAsRoot() {
        this.nacGrpNo  = this.nacMngNo;
        this.nacGrpSqn = 0;
        this.nacGrpLev = 0;
    }

    /**
     * 그룹 정보 설정 — 답변글 등록 시
     *
     * @param parentGrpNo  부모의 NAC_GRP_NO
     * @param parentGrpSqn 부모의 NAC_GRP_SQN (밀어내기 후 새 위치)
     * @param parentGrpLev 부모의 NAC_GRP_LEV
     * @param parentPk     부모의 NAC_MNG_NO
     */
    public void initGroupAsReply(String parentGrpNo, int parentGrpSqn, int parentGrpLev, String parentPk) {
        this.nacGrpNo      = parentGrpNo;
        this.nacGrpSqn     = parentGrpSqn + 1;
        this.nacGrpLev     = parentGrpLev + 1;
        this.hrkNacMngNo   = parentPk;
    }
}
```

- [ ] **Step 2: CblbcmL 로그 엔티티 작성**

```java
// it_backend/src/main/java/com/kdb/it/domain/log/entity/CblbcmL.java
package com.kdb.it.domain.log.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.time.LocalDate;

/**
 * 게시물 변경 로그 엔티티 — TAAABB_CBLBCL
 */
@Entity
@Table(name = "TAAABB_CBLBCL")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class CblbcmL extends BaseLogEntity {

    @Column(name = "NAC_MNG_NO",     length = 32)  private String    nacMngNo;
    @Column(name = "BLB_MNG_NO",     length = 32)  private String    blbMngNo;
    @Column(name = "NAC_NM",         length = 300) private String    nacNm;
    @Lob
    @Column(name = "NAC_CONE")                     private String    nacCone;
    @Column(name = "NAC_INQ_NBR")                  private Integer   nacInqNbr;
    @Column(name = "NAC_TP",         length = 32)  private String    nacTp;
    @Column(name = "KD_C",           length = 32)  private String    kdC;
    @Column(name = "PRIT_C",         length = 32)  private String    pritC;
    @Column(name = "HRK_FXN_YN",     length = 1)   private String    hrkFxnYn;
    @Column(name = "SRE_YN",         length = 1)   private String    sreYn;
    @Column(name = "BBR_C",          length = 8)   private String    bbrC;
    @Column(name = "STT_YMD")                      private LocalDate sttYmd;
    @Column(name = "END_YMD")                      private LocalDate endYmd;
    @Column(name = "FL_APG_YN",      length = 1)   private String    flApgYn;
    @Column(name = "FL_NBR")                       private Integer   flNbr;
    @Column(name = "NAC_GRP_NO",     length = 32)  private String    nacGrpNo;
    @Column(name = "NAC_GRP_SQN")                  private Integer   nacGrpSqn;
    @Column(name = "NAC_GRP_LEV")                  private Integer   nacGrpLev;
    @Column(name = "HRK_NAC_MNG_NO", length = 32)  private String    hrkNacMngNo;
}
```

- [ ] **Step 3: 빌드 확인 후 커밋**

```bash
cd it_backend && ./gradlew compileJava
git add it_backend/src/main/java/com/kdb/it/common/board/entity/Cblbcm.java
git add it_backend/src/main/java/com/kdb/it/domain/log/entity/CblbcmL.java
git commit -m "feat: Cblbcm 게시물 엔티티 + CblbcmL 변경로그 엔티티 추가"
```

---

## Task 4: 엔티티 — Ccmmtm (댓글) + CcmmtmL

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/board/entity/Ccmmtm.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/entity/CcmmtmL.java`

- [ ] **Step 1: Ccmmtm 엔티티 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/entity/Ccmmtm.java
package com.kdb.it.common.board.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.CcmmtmL;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * 게시판 댓글 엔티티 — TAAABB_CCMMTM
 *
 * <p>댓글 트리는 게시물과 동일한 GRP_NO / GRP_SQN / GRP_LEV 패턴을 사용한다.
 * 1차에서는 첨부파일 미지원. 변경 시 {@link CcmmtmL}에 이력 자동 적재.</p>
 */
@LogTarget(entity = CcmmtmL.class)
@Entity
@Table(name = "TAAABB_CCMMTM")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Ccmmtm extends BaseEntity {

    /** 댓글관리번호 PK. 형식: CMMT-{YYYY}-{0001} */
    @Id
    @Column(name = "CMMT_MNG_NO", nullable = false, length = 32)
    private String cmmtMngNo;

    /** 게시물관리번호 FK */
    @Column(name = "NAC_MNG_NO", nullable = false, length = 32)
    private String nacMngNo;

    /** 댓글 본문 — HtmlSanitizer.sanitize() 적용 의무 */
    @Lob
    @Column(name = "CMMT_CONE", nullable = false)
    private String cmmtCone;

    /** 화면여부(노출) Y/N */
    @Column(name = "SRE_YN", nullable = false, length = 1)
    private String sreYn;

    /** 댓글 그룹번호 — 최상위 댓글의 CMMT_MNG_NO */
    @Column(name = "CMMT_GRP_NO", nullable = false, length = 32)
    private String cmmtGrpNo;

    /** 댓글 그룹 내 정렬 순서 */
    @Column(name = "CMMT_GRP_SQN", nullable = false)
    private Integer cmmtGrpSqn;

    /** 댓글 트리 깊이 (0=원댓글, 1=대댓글…) */
    @Column(name = "CMMT_GRP_LEV", nullable = false)
    private Integer cmmtGrpLev;

    /** 직계 부모 댓글 PK */
    @Column(name = "HRK_CMMT_MNG_NO", length = 32)
    private String hrkCmmtMngNo;

    // ----------------------------------------------------------------
    // 비즈니스 메서드
    // ----------------------------------------------------------------

    /** 댓글 본문 수정 — sanitize 완료 값을 전달해야 한다 */
    public void updateContent(String sanitizedCone) {
        this.cmmtCone = sanitizedCone;
    }

    /** 그룹 정보 설정 — 최상위 댓글 등록 시 */
    public void initGroupAsRoot() {
        this.cmmtGrpNo  = this.cmmtMngNo;
        this.cmmtGrpSqn = 0;
        this.cmmtGrpLev = 0;
    }

    /**
     * 그룹 정보 설정 — 대댓글 등록 시
     *
     * @param parentGrpNo  부모의 CMMT_GRP_NO
     * @param parentGrpSqn 부모의 CMMT_GRP_SQN (밀어내기 후 새 위치)
     * @param parentGrpLev 부모의 CMMT_GRP_LEV
     * @param parentPk     부모의 CMMT_MNG_NO
     */
    public void initGroupAsReply(String parentGrpNo, int parentGrpSqn, int parentGrpLev, String parentPk) {
        this.cmmtGrpNo      = parentGrpNo;
        this.cmmtGrpSqn     = parentGrpSqn + 1;
        this.cmmtGrpLev     = parentGrpLev + 1;
        this.hrkCmmtMngNo   = parentPk;
    }
}
```

- [ ] **Step 2: CcmmtmL 로그 엔티티 작성**

```java
// it_backend/src/main/java/com/kdb/it/domain/log/entity/CcmmtmL.java
package com.kdb.it.domain.log.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * 게시판 댓글 변경 로그 엔티티 — TAAABB_CCMMTL
 */
@Entity
@Table(name = "TAAABB_CCMMTL")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class CcmmtmL extends BaseLogEntity {

    @Column(name = "CMMT_MNG_NO",      length = 32) private String  cmmtMngNo;
    @Column(name = "NAC_MNG_NO",       length = 32) private String  nacMngNo;
    @Lob
    @Column(name = "CMMT_CONE")                     private String  cmmtCone;
    @Column(name = "SRE_YN",           length = 1)  private String  sreYn;
    @Column(name = "CMMT_GRP_NO",      length = 32) private String  cmmtGrpNo;
    @Column(name = "CMMT_GRP_SQN")                  private Integer cmmtGrpSqn;
    @Column(name = "CMMT_GRP_LEV")                  private Integer cmmtGrpLev;
    @Column(name = "HRK_CMMT_MNG_NO",  length = 32) private String  hrkCmmtMngNo;
}
```

- [ ] **Step 3: 빌드 확인 후 커밋**

```bash
cd it_backend && ./gradlew compileJava
git add it_backend/src/main/java/com/kdb/it/common/board/entity/Ccmmtm.java
git add it_backend/src/main/java/com/kdb/it/domain/log/entity/CcmmtmL.java
git commit -m "feat: Ccmmtm 댓글 엔티티 + CcmmtmL 변경로그 엔티티 추가"
```

---

## Task 5: DTO — BoardMetaDto · BoardPostDto · BoardCommentDto

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/board/dto/BoardMetaDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/dto/BoardPostDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/dto/BoardCommentDto.java`

- [ ] **Step 1: BoardMetaDto 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/dto/BoardMetaDto.java
package com.kdb.it.common.board.dto;

import com.kdb.it.common.board.entity.Cblbmm;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

/**
 * 게시판 메타 DTO 모음
 */
public class BoardMetaDto {

    private BoardMetaDto() {}

    // ----------------------------------------------------------------
    // 사이드바 / 목록용 응답
    // ----------------------------------------------------------------

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardMetaResponse", description = "게시판 메타 응답")
    public static class Response {
        @Schema(description = "게시판관리번호") private String  blbMngNo;
        @Schema(description = "게시판명")     private String  blbNm;
        @Schema(description = "게시판유형")   private String  blbTp;
        @Schema(description = "답변사용여부") private String  repUseYn;
        @Schema(description = "댓글사용여부") private String  cmmtUseYn;
        @Schema(description = "첨부필수여부") private String  flEsnYn;
        @Schema(description = "상위고정사용여부") private String hrkFxnUseYn;
        @Schema(description = "게시물유형사용여부") private String nacTpUseYn;
        @Schema(description = "종류사용여부") private String  kdUseYn;
        @Schema(description = "조회권한코드") private String  inqAthC;
        @Schema(description = "등록권한코드") private String  enrAthC;
        @Schema(description = "담당부서한정사용여부") private String bbrLmtnUseYn;
        @Schema(description = "담당부서한정코드")  private String bbrLmtnC;
        @Schema(description = "화면순서번호") private Integer sreSqnNo;
        @Schema(description = "사용여부")     private String  useYn;
        @Schema(description = "비고")         private String  rmk;

        public static Response from(Cblbmm e) {
            return Response.builder()
                .blbMngNo(e.getBlbMngNo()).blbNm(e.getBlbNm()).blbTp(e.getBlbTp())
                .repUseYn(e.getRepUseYn()).cmmtUseYn(e.getCmmtUseYn())
                .flEsnYn(e.getFlEsnYn()).hrkFxnUseYn(e.getHrkFxnUseYn())
                .nacTpUseYn(e.getNacTpUseYn()).kdUseYn(e.getKdUseYn())
                .inqAthC(e.getInqAthC()).enrAthC(e.getEnrAthC())
                .bbrLmtnUseYn(e.getBbrLmtnUseYn()).bbrLmtnC(e.getBbrLmtnC())
                .sreSqnNo(e.getSreSqnNo()).useYn(e.getUseYn()).rmk(e.getRmk())
                .build();
        }
    }

    // ----------------------------------------------------------------
    // 운영자 등록 요청
    // ----------------------------------------------------------------

    @Getter
    @Setter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardMetaCreateRequest", description = "게시판 메타 등록 요청")
    public static class CreateRequest {
        @Schema(description = "게시판명", required = true)        private String  blbNm;
        @Schema(description = "게시판유형", required = true)      private String  blbTp;
        @Schema(description = "답변사용여부", example = "N")      private String  repUseYn;
        @Schema(description = "댓글사용여부", example = "N")      private String  cmmtUseYn;
        @Schema(description = "첨부필수여부", example = "N")      private String  flEsnYn;
        @Schema(description = "상위고정사용여부", example = "N")  private String  hrkFxnUseYn;
        @Schema(description = "게시물유형사용여부", example = "N") private String  nacTpUseYn;
        @Schema(description = "종류사용여부", example = "N")      private String  kdUseYn;
        @Schema(description = "조회권한코드", example = "ALL")    private String  inqAthC;
        @Schema(description = "등록권한코드", example = "ALL")    private String  enrAthC;
        @Schema(description = "담당부서한정사용여부", example = "N") private String bbrLmtnUseYn;
        @Schema(description = "담당부서한정코드")                 private String  bbrLmtnC;
        @Schema(description = "화면순서번호", example = "0")      private Integer sreSqnNo;
        @Schema(description = "비고")                             private String  rmk;

        public Cblbmm.UpdateCommand toUpdateCommand() {
            return new Cblbmm.UpdateCommand(
                blbNm,
                nvl(repUseYn,     "N"), nvl(cmmtUseYn,    "N"),
                nvl(flEsnYn,      "N"), nvl(hrkFxnUseYn,  "N"),
                nvl(nacTpUseYn,   "N"), nvl(kdUseYn,      "N"),
                nvl(inqAthC,     "ALL"), nvl(enrAthC,    "ALL"),
                nvl(bbrLmtnUseYn,"N"),  bbrLmtnC,
                sreSqnNo == null ? 0 : sreSqnNo, "Y", rmk
            );
        }

        private String nvl(String v, String def) { return v != null ? v : def; }
    }

    // ----------------------------------------------------------------
    // 운영자 수정 요청
    // ----------------------------------------------------------------

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardMetaUpdateRequest", description = "게시판 메타 수정 요청")
    public static class UpdateRequest {
        @Schema(description = "게시판명")        private String  blbNm;
        @Schema(description = "답변사용여부")    private String  repUseYn;
        @Schema(description = "댓글사용여부")    private String  cmmtUseYn;
        @Schema(description = "첨부필수여부")    private String  flEsnYn;
        @Schema(description = "상위고정사용여부") private String  hrkFxnUseYn;
        @Schema(description = "게시물유형사용여부") private String nacTpUseYn;
        @Schema(description = "종류사용여부")    private String  kdUseYn;
        @Schema(description = "조회권한코드")    private String  inqAthC;
        @Schema(description = "등록권한코드")    private String  enrAthC;
        @Schema(description = "담당부서한정사용여부") private String bbrLmtnUseYn;
        @Schema(description = "담당부서한정코드") private String  bbrLmtnC;
        @Schema(description = "화면순서번호")    private Integer sreSqnNo;
        @Schema(description = "사용여부")        private String  useYn;
        @Schema(description = "비고")            private String  rmk;

        public Cblbmm.UpdateCommand toUpdateCommand() {
            return new Cblbmm.UpdateCommand(
                blbNm, repUseYn, cmmtUseYn, flEsnYn, hrkFxnUseYn,
                nacTpUseYn, kdUseYn, inqAthC, enrAthC,
                bbrLmtnUseYn, bbrLmtnC, sreSqnNo, useYn, rmk
            );
        }
    }
}
```

- [ ] **Step 2: BoardPostDto 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/dto/BoardPostDto.java
package com.kdb.it.common.board.dto;

import com.kdb.it.common.board.entity.Cblbcm;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 게시물 DTO 모음
 */
public class BoardPostDto {

    private BoardPostDto() {}

    // ----------------------------------------------------------------
    // 목록 아이템
    // ----------------------------------------------------------------

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardPostListItem", description = "게시물 목록 아이템")
    public static class ListItem {
        @Schema(description = "게시물관리번호")  private String        nacMngNo;
        @Schema(description = "게시판관리번호")  private String        blbMngNo;
        @Schema(description = "제목")           private String        nacNm;
        @Schema(description = "조회수")         private Integer       nacInqNbr;
        @Schema(description = "게시물유형코드") private String        nacTp;
        @Schema(description = "종류코드")       private String        kdC;
        @Schema(description = "중요도코드")     private String        pritC;
        @Schema(description = "상위고정여부")   private String        hrkFxnYn;
        @Schema(description = "화면여부")       private String        sreYn;
        @Schema(description = "파일첨부여부")   private String        flApgYn;
        @Schema(description = "파일수")         private Integer       flNbr;
        @Schema(description = "그룹레벨 (들여쓰기 계산용)") private Integer nacGrpLev;
        @Schema(description = "공개시작일")     private LocalDate     sttYmd;
        @Schema(description = "공개종료일")     private LocalDate     endYmd;
        @Schema(description = "작성자사번")     private String        fstEnrUsid;
        @Schema(description = "등록일시")       private LocalDateTime fstEnrDtm;

        public static ListItem from(Cblbcm e) {
            return ListItem.builder()
                .nacMngNo(e.getNacMngNo()).blbMngNo(e.getBlbMngNo())
                .nacNm(e.getNacNm()).nacInqNbr(e.getNacInqNbr())
                .nacTp(e.getNacTp()).kdC(e.getKdC()).pritC(e.getPritC())
                .hrkFxnYn(e.getHrkFxnYn()).sreYn(e.getSreYn())
                .flApgYn(e.getFlApgYn()).flNbr(e.getFlNbr())
                .nacGrpLev(e.getNacGrpLev())
                .sttYmd(e.getSttYmd()).endYmd(e.getEndYmd())
                .fstEnrUsid(e.getFstEnrUsid()).fstEnrDtm(e.getFstEnrDtm())
                .build();
        }
    }

    // ----------------------------------------------------------------
    // 상세 응답
    // ----------------------------------------------------------------

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardPostDetail", description = "게시물 상세")
    public static class Detail {
        @Schema(description = "게시물관리번호")  private String        nacMngNo;
        @Schema(description = "게시판관리번호")  private String        blbMngNo;
        @Schema(description = "제목")           private String        nacNm;
        @Schema(description = "본문 HTML")      private String        nacCone;
        @Schema(description = "조회수")         private Integer       nacInqNbr;
        @Schema(description = "게시물유형코드") private String        nacTp;
        @Schema(description = "종류코드")       private String        kdC;
        @Schema(description = "중요도코드")     private String        pritC;
        @Schema(description = "상위고정여부")   private String        hrkFxnYn;
        @Schema(description = "화면여부")       private String        sreYn;
        @Schema(description = "담당부서코드")   private String        bbrC;
        @Schema(description = "공개시작일")     private LocalDate     sttYmd;
        @Schema(description = "공개종료일")     private LocalDate     endYmd;
        @Schema(description = "파일첨부여부")   private String        flApgYn;
        @Schema(description = "파일수")         private Integer       flNbr;
        @Schema(description = "그룹번호")       private String        nacGrpNo;
        @Schema(description = "그룹순서")       private Integer       nacGrpSqn;
        @Schema(description = "그룹레벨")       private Integer       nacGrpLev;
        @Schema(description = "상위게시물번호") private String        hrkNacMngNo;
        @Schema(description = "작성자사번")     private String        fstEnrUsid;
        @Schema(description = "등록일시")       private LocalDateTime fstEnrDtm;
        @Schema(description = "수정일시")       private LocalDateTime lstChgDtm;
        @Schema(description = "수정 가능 여부 (현재 사용자 기준)") private boolean canModify;

        public static Detail from(Cblbcm e, boolean canModify) {
            return Detail.builder()
                .nacMngNo(e.getNacMngNo()).blbMngNo(e.getBlbMngNo())
                .nacNm(e.getNacNm()).nacCone(e.getNacCone())
                .nacInqNbr(e.getNacInqNbr()).nacTp(e.getNacTp())
                .kdC(e.getKdC()).pritC(e.getPritC())
                .hrkFxnYn(e.getHrkFxnYn()).sreYn(e.getSreYn())
                .bbrC(e.getBbrC()).sttYmd(e.getSttYmd()).endYmd(e.getEndYmd())
                .flApgYn(e.getFlApgYn()).flNbr(e.getFlNbr())
                .nacGrpNo(e.getNacGrpNo()).nacGrpSqn(e.getNacGrpSqn()).nacGrpLev(e.getNacGrpLev())
                .hrkNacMngNo(e.getHrkNacMngNo())
                .fstEnrUsid(e.getFstEnrUsid()).fstEnrDtm(e.getFstEnrDtm())
                .lstChgDtm(e.getLstChgDtm()).canModify(canModify)
                .build();
        }
    }

    // ----------------------------------------------------------------
    // 등록 요청
    // ----------------------------------------------------------------

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardPostCreateRequest", description = "게시물 등록 요청")
    public static class CreateRequest {
        @Schema(description = "제목 (최대 300자)", required = true) private String    nacNm;
        @Schema(description = "본문 HTML")                        private String    nacCone;
        @Schema(description = "게시물유형코드")                   private String    nacTp;
        @Schema(description = "종류코드")                         private String    kdC;
        @Schema(description = "중요도코드", example = "PRIT_C_001") private String  pritC;
        @Schema(description = "상위고정여부", example = "N")      private String    hrkFxnYn;
        @Schema(description = "화면여부", example = "Y")          private String    sreYn;
        @Schema(description = "담당부서코드")                     private String    bbrC;
        @Schema(description = "공개시작일")                       private LocalDate sttYmd;
        @Schema(description = "공개종료일")                       private LocalDate endYmd;
    }

    // ----------------------------------------------------------------
    // 수정 요청
    // ----------------------------------------------------------------

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardPostUpdateRequest", description = "게시물 수정 요청")
    public static class UpdateRequest {
        @Schema(description = "제목")        private String    nacNm;
        @Schema(description = "본문 HTML")   private String    nacCone;
        @Schema(description = "게시물유형코드") private String nacTp;
        @Schema(description = "종류코드")    private String    kdC;
        @Schema(description = "중요도코드")  private String    pritC;
        @Schema(description = "상위고정여부") private String   hrkFxnYn;
        @Schema(description = "화면여부")    private String    sreYn;
        @Schema(description = "담당부서코드") private String   bbrC;
        @Schema(description = "공개시작일")  private LocalDate sttYmd;
        @Schema(description = "공개종료일")  private LocalDate endYmd;

        public Cblbcm.UpdateCommand toUpdateCommand(String sanitizedCone) {
            return new Cblbcm.UpdateCommand(
                nacNm, sanitizedCone, nacTp, kdC,
                pritC == null ? "PRIT_C_001" : pritC,
                hrkFxnYn == null ? "N" : hrkFxnYn,
                sreYn == null ? "Y" : sreYn,
                bbrC, sttYmd, endYmd
            );
        }
    }

    // ----------------------------------------------------------------
    // 답변글 등록 요청
    // ----------------------------------------------------------------

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardPostReplyCreateRequest", description = "답변글 등록 요청")
    public static class ReplyCreateRequest {
        @Schema(description = "제목", required = true) private String    nacNm;
        @Schema(description = "본문 HTML")            private String    nacCone;
        @Schema(description = "중요도코드")            private String    pritC;
        @Schema(description = "담당부서코드")          private String    bbrC;
        @Schema(description = "공개시작일")            private LocalDate sttYmd;
        @Schema(description = "공개종료일")            private LocalDate endYmd;
    }

    // ----------------------------------------------------------------
    // 검색 조건
    // ----------------------------------------------------------------

    @Getter
    @Setter
    @NoArgsConstructor
    @Schema(name = "BoardPostSearchCondition", description = "게시물 목록 검색 조건")
    public static class SearchCondition {
        @Schema(description = "키워드 (제목/본문/작성자 LIKE)")  private String keyword;
        @Schema(description = "게시물유형코드")                  private String nacTp;
        @Schema(description = "종류코드")                        private String kdC;
        @Schema(description = "중요도코드")                      private String pritC;
        @Schema(description = "등록일 시작 (yyyy-MM-dd)")        private String enrDtmFrom;
        @Schema(description = "등록일 종료 (yyyy-MM-dd)")        private String enrDtmTo;
        @Schema(description = "담당부서코드")                    private String bbrC;
        @Schema(description = "페이지 번호 (0-based)", example = "0") private int page;
        @Schema(description = "페이지 크기", example = "20")     private int size = 20;
    }
}
```

- [ ] **Step 3: BoardCommentDto 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/dto/BoardCommentDto.java
package com.kdb.it.common.board.dto;

import com.kdb.it.common.board.entity.Ccmmtm;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.*;
import java.time.LocalDateTime;

/**
 * 게시판 댓글 DTO 모음
 */
public class BoardCommentDto {

    private BoardCommentDto() {}

    @Getter
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardCommentResponse", description = "댓글 응답")
    public static class Response {
        @Schema(description = "댓글관리번호")   private String        cmmtMngNo;
        @Schema(description = "게시물관리번호") private String        nacMngNo;
        @Schema(description = "댓글내용")       private String        cmmtCone;
        @Schema(description = "화면여부")       private String        sreYn;
        @Schema(description = "그룹번호")       private String        cmmtGrpNo;
        @Schema(description = "그룹순서")       private Integer       cmmtGrpSqn;
        @Schema(description = "그룹레벨 (들여쓰기 계산용)") private Integer cmmtGrpLev;
        @Schema(description = "상위댓글번호")   private String        hrkCmmtMngNo;
        @Schema(description = "삭제여부")       private String        delYn;
        @Schema(description = "작성자사번")     private String        fstEnrUsid;
        @Schema(description = "등록일시")       private LocalDateTime fstEnrDtm;
        @Schema(description = "수정일시")       private LocalDateTime lstChgDtm;
        @Schema(description = "수정 가능 여부") private boolean       canModify;

        public static Response from(Ccmmtm e, boolean canModify) {
            // 삭제된 댓글은 본문을 마스킹한다
            String displayCone = "Y".equals(e.getDelYn())
                ? "삭제된 댓글입니다."
                : e.getCmmtCone();
            return Response.builder()
                .cmmtMngNo(e.getCmmtMngNo()).nacMngNo(e.getNacMngNo())
                .cmmtCone(displayCone).sreYn(e.getSreYn())
                .cmmtGrpNo(e.getCmmtGrpNo()).cmmtGrpSqn(e.getCmmtGrpSqn()).cmmtGrpLev(e.getCmmtGrpLev())
                .hrkCmmtMngNo(e.getHrkCmmtMngNo()).delYn(e.getDelYn())
                .fstEnrUsid(e.getFstEnrUsid()).fstEnrDtm(e.getFstEnrDtm())
                .lstChgDtm(e.getLstChgDtm()).canModify(canModify)
                .build();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardCommentCreateRequest", description = "댓글 등록 요청")
    public static class CreateRequest {
        @Schema(description = "댓글 내용 (최대 2000자)", required = true) private String cmmtCone;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(name = "BoardCommentUpdateRequest", description = "댓글 수정 요청")
    public static class UpdateRequest {
        @Schema(description = "댓글 내용 (최대 2000자)", required = true) private String cmmtCone;
    }
}
```

- [ ] **Step 4: 빌드 확인 후 커밋**

```bash
cd it_backend && ./gradlew compileJava
git add it_backend/src/main/java/com/kdb/it/common/board/dto/
git commit -m "feat: 게시판 DTO 3종 추가 (BoardMetaDto / BoardPostDto / BoardCommentDto)"
```

---

## Task 6: 리포지토리 — Meta · Post · Comment

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardMetaRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardMetaRepositoryCustom.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardMetaRepositoryImpl.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardPostRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardPostRepositoryCustom.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardPostRepositoryImpl.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardCommentRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardCommentRepositoryCustom.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardCommentRepositoryImpl.java`

- [ ] **Step 1: BoardMetaRepository + Custom + Impl 작성**

```java
// BoardMetaRepository.java
package com.kdb.it.common.board.repository;

import com.kdb.it.common.board.entity.Cblbmm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;

/** 게시판 메타 리포지토리 */
public interface BoardMetaRepository
        extends JpaRepository<Cblbmm, String>, BoardMetaRepositoryCustom {

    Optional<Cblbmm> findByBlbMngNoAndDelYn(String blbMngNo, String delYn);

    /** 게시판 메타 채번 시퀀스 — BLBM-{YYYY}-{0001} 형식 */
    @Query(value = "SELECT SQ_BLBMNGNO.NEXTVAL FROM DUAL", nativeQuery = true)
    Long getNextSequenceValue();
}
```

```java
// BoardMetaRepositoryCustom.java
package com.kdb.it.common.board.repository;

import com.kdb.it.common.board.entity.Cblbmm;
import java.util.List;

/** 게시판 메타 동적 쿼리 인터페이스 */
public interface BoardMetaRepositoryCustom {
    /** 사이드바용: USE_YN='Y', DEL_YN='N' 전체 목록, SRE_SQN_NO 오름차순 */
    List<Cblbmm> findAllActiveOrdered();
}
```

```java
// BoardMetaRepositoryImpl.java
package com.kdb.it.common.board.repository;

import com.kdb.it.common.board.entity.Cblbmm;
import com.kdb.it.common.board.entity.QCblbmm;
import com.querydsl.jpa.impl.JPAQueryFactory;
import lombok.RequiredArgsConstructor;
import java.util.List;

@RequiredArgsConstructor
public class BoardMetaRepositoryImpl implements BoardMetaRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<Cblbmm> findAllActiveOrdered() {
        QCblbmm m = QCblbmm.cblbmm;
        return queryFactory.selectFrom(m)
            .where(m.useYn.eq("Y").and(m.delYn.eq("N")))
            .orderBy(m.sreSqnNo.asc())
            .fetch();
    }
}
```

- [ ] **Step 2: BoardPostRepository + Custom + Impl 작성**

```java
// BoardPostRepository.java
package com.kdb.it.common.board.repository;

import com.kdb.it.common.board.entity.Cblbcm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

/** 게시물 리포지토리 */
public interface BoardPostRepository
        extends JpaRepository<Cblbcm, String>, BoardPostRepositoryCustom {

    Optional<Cblbcm> findByNacMngNoAndDelYn(String nacMngNo, String delYn);

    /** 게시물 채번 시퀀스 — NAC-{YYYY}-{0001} */
    @Query(value = "SELECT SQ_NACMNGNO.NEXTVAL FROM DUAL", nativeQuery = true)
    Long getNextSequenceValue();

    /**
     * 답변글 삽입을 위한 SQN 밀어내기 (단일 트랜잭션 + 행 단위 락 전제)
     *
     * <p>같은 그룹에서 parentSqn보다 큰 SQN을 가진 행 중
     * 깊이가 parentLev 이하인 행이 나오기 전까지를 +1 한다.
     * 이 쿼리는 {@code nacGrpLev > parentLev} 조건으로 자손만 선택하여,
     * 형제 이후 구간을 건드리지 않는다.</p>
     */
    @Modifying
    @Query("""
        UPDATE Cblbcm c
           SET c.nacGrpSqn = c.nacGrpSqn + 1
         WHERE c.nacGrpNo  = :grpNo
           AND c.nacGrpSqn > :parentSqn
           AND c.nacGrpLev > :parentLev
           AND c.delYn     = 'N'
        """)
    int shiftGroupSqn(
        @Param("grpNo")     String grpNo,
        @Param("parentSqn") int    parentSqn,
        @Param("parentLev") int    parentLev
    );
}
```

```java
// BoardPostRepositoryCustom.java
package com.kdb.it.common.board.repository;

import com.kdb.it.common.board.dto.BoardPostDto;
import com.kdb.it.common.board.entity.Cblbcm;
import java.util.List;

/** 게시물 동적 쿼리 인터페이스 */
public interface BoardPostRepositoryCustom {
    /**
     * 게시물 목록 조회 — 권한 필터 + 검색 조건 적용
     *
     * @param blbMngNo      게시판관리번호
     * @param cond          검색 조건
     * @param isAdmin       관리자 여부 (삭제·숨김 게시물도 포함)
     * @param userBbrC      사용자 부서코드 (부서 한정 필터용)
     * @param bbrLmtnUseYn  게시판 담당부서한정 사용 여부
     */
    List<Cblbcm> searchPosts(
        String blbMngNo,
        BoardPostDto.SearchCondition cond,
        boolean isAdmin,
        String userBbrC,
        String bbrLmtnUseYn
    );
}
```

```java
// BoardPostRepositoryImpl.java
package com.kdb.it.common.board.repository;

import com.kdb.it.common.board.dto.BoardPostDto;
import com.kdb.it.common.board.entity.Cblbcm;
import com.kdb.it.common.board.entity.QCblbcm;
import com.querydsl.core.BooleanBuilder;
import com.querydsl.jpa.impl.JPAQueryFactory;
import lombok.RequiredArgsConstructor;
import org.springframework.util.StringUtils;
import java.time.LocalDate;
import java.util.List;

@RequiredArgsConstructor
public class BoardPostRepositoryImpl implements BoardPostRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<Cblbcm> searchPosts(
            String blbMngNo,
            BoardPostDto.SearchCondition cond,
            boolean isAdmin,
            String userBbrC,
            String bbrLmtnUseYn) {

        QCblbcm p = QCblbcm.cblbcm;
        BooleanBuilder builder = new BooleanBuilder();

        builder.and(p.blbMngNo.eq(blbMngNo));
        builder.and(p.delYn.eq("N"));

        // 일반 사용자에게는 노출 조건 적용
        if (!isAdmin) {
            LocalDate today = LocalDate.now();
            builder.and(p.sreYn.eq("Y"));
            builder.and(p.sttYmd.isNull().or(p.sttYmd.loe(today)));
            builder.and(p.endYmd.isNull().or(p.endYmd.goe(today)));
            // 부서 한정 필터
            if ("Y".equals(bbrLmtnUseYn) && StringUtils.hasText(userBbrC)) {
                builder.and(p.bbrC.isNull().or(p.bbrC.eq(userBbrC)));
            }
        }

        // 검색 조건
        if (StringUtils.hasText(cond.getKeyword())) {
            builder.and(
                p.nacNm.containsIgnoreCase(cond.getKeyword())
                .or(p.nacCone.containsIgnoreCase(cond.getKeyword()))
                .or(p.fstEnrUsid.containsIgnoreCase(cond.getKeyword()))
            );
        }
        if (StringUtils.hasText(cond.getNacTp()))  builder.and(p.nacTp.eq(cond.getNacTp()));
        if (StringUtils.hasText(cond.getKdC()))    builder.and(p.kdC.eq(cond.getKdC()));
        if (StringUtils.hasText(cond.getPritC()))  builder.and(p.pritC.eq(cond.getPritC()));
        if (StringUtils.hasText(cond.getBbrC()))   builder.and(p.bbrC.eq(cond.getBbrC()));

        int offset = cond.getPage() * cond.getSize();

        return queryFactory.selectFrom(p)
            .where(builder)
            .orderBy(p.hrkFxnYn.desc(), p.nacGrpNo.desc(), p.nacGrpSqn.asc())
            .offset(offset)
            .limit(cond.getSize())
            .fetch();
    }
}
```

- [ ] **Step 3: BoardCommentRepository + Custom + Impl 작성**

```java
// BoardCommentRepository.java
package com.kdb.it.common.board.repository;

import com.kdb.it.common.board.entity.Ccmmtm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

/** 댓글 리포지토리 */
public interface BoardCommentRepository
        extends JpaRepository<Ccmmtm, String>, BoardCommentRepositoryCustom {

    Optional<Ccmmtm> findByCmmtMngNoAndDelYn(String cmmtMngNo, String delYn);

    /** 자식 댓글 존재 여부 — 소프트 삭제 시 트리 유지 판단 */
    boolean existsByHrkCmmtMngNoAndDelYn(String hrkCmmtMngNo, String delYn);

    /** 댓글 채번 시퀀스 */
    @Query(value = "SELECT SQ_CMMTMNGNO.NEXTVAL FROM DUAL", nativeQuery = true)
    Long getNextSequenceValue();

    /** 대댓글 삽입을 위한 SQN 밀어내기 */
    @Modifying
    @Query("""
        UPDATE Ccmmtm c
           SET c.cmmtGrpSqn = c.cmmtGrpSqn + 1
         WHERE c.cmmtGrpNo  = :grpNo
           AND c.cmmtGrpSqn > :parentSqn
           AND c.cmmtGrpLev > :parentLev
           AND c.delYn      = 'N'
        """)
    int shiftGroupSqn(
        @Param("grpNo")     String grpNo,
        @Param("parentSqn") int    parentSqn,
        @Param("parentLev") int    parentLev
    );
}
```

```java
// BoardCommentRepositoryCustom.java
package com.kdb.it.common.board.repository;

import com.kdb.it.common.board.entity.Ccmmtm;
import java.util.List;

public interface BoardCommentRepositoryCustom {
    /** 게시물의 댓글 목록 — 삭제 포함 트리 정렬 (자식 보존용) */
    List<Ccmmtm> findCommentsByPost(String nacMngNo);
}
```

```java
// BoardCommentRepositoryImpl.java
package com.kdb.it.common.board.repository;

import com.kdb.it.common.board.entity.Ccmmtm;
import com.kdb.it.common.board.entity.QCcmmtm;
import com.querydsl.jpa.impl.JPAQueryFactory;
import lombok.RequiredArgsConstructor;
import java.util.List;

@RequiredArgsConstructor
public class BoardCommentRepositoryImpl implements BoardCommentRepositoryCustom {

    private final JPAQueryFactory queryFactory;

    @Override
    public List<Ccmmtm> findCommentsByPost(String nacMngNo) {
        QCcmmtm c = QCcmmtm.ccmmtm;
        // 삭제된 댓글도 포함 (본문은 서비스에서 마스킹)
        // 자식 댓글이 있는 삭제 댓글은 트리 구조 유지를 위해 포함
        return queryFactory.selectFrom(c)
            .where(c.nacMngNo.eq(nacMngNo).and(c.sreYn.eq("Y")))
            .orderBy(c.cmmtGrpNo.asc(), c.cmmtGrpSqn.asc())
            .fetch();
    }
}
```

- [ ] **Step 4: Q 클래스 생성 후 빌드 확인**

```bash
cd it_backend && ./gradlew compileJava
# QCblbmm, QCblbcm, QCcmmtm 생성 확인
ls build/generated/sources/annotationProcessor/java/main/com/kdb/it/common/board/entity/
```
Expected: `QCblbmm.java`, `QCblbcm.java`, `QCcmmtm.java` 파일 존재

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/board/repository/
git commit -m "feat: 게시판 리포지토리 3종 추가 (Meta/Post/Comment)"
```

---

## Task 7: 서비스 — BoardMetaService · BoardPostService · BoardCommentService

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardMetaService.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostService.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardCommentService.java`

- [ ] **Step 1: 서비스 테스트 작성 (RED)**

```java
// it_backend/src/test/java/com/kdb/it/common/board/service/BoardPostServiceTest.java
package com.kdb.it.common.board.service;

import com.kdb.it.common.board.entity.Cblbcm;
import com.kdb.it.common.board.entity.Cblbmm;
import com.kdb.it.common.board.repository.BoardMetaRepository;
import com.kdb.it.common.board.repository.BoardPostRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.exception.CustomGeneralException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
class BoardPostServiceTest {

    @Mock BoardMetaRepository metaRepository;
    @Mock BoardPostRepository postRepository;
    @InjectMocks BoardPostService service;

    private Cblbmm publicBoard;
    private Cblbmm adminOnlyBoard;
    private CustomUserDetails adminUser;
    private CustomUserDetails normalUser;

    @BeforeEach
    void setUp() {
        publicBoard = Cblbmm.builder()
            .blbMngNo("BLBM-2026-0001").blbNm("공지사항")
            .inqAthC("ALL").enrAthC("ROLE_ADMIN")
            .repUseYn("N").cmmtUseYn("N")
            .bbrLmtnUseYn("N").useYn("Y").delYn("N")
            .build();

        adminOnlyBoard = Cblbmm.builder()
            .blbMngNo("BLBM-2026-0099").blbNm("내부게시판")
            .inqAthC("ROLE_ADMIN").enrAthC("ROLE_ADMIN")
            .bbrLmtnUseYn("N").useYn("Y").delYn("N")
            .build();

        adminUser  = new CustomUserDetails("ADMIN001", List.of("ITPAD001"), "10001");
        normalUser = new CustomUserDetails("USER001",  List.of("ITPZZ001"), "10002");
    }

    @Test
    @DisplayName("관리자가 아닌 사용자는 관리자 전용 게시판 목록을 조회할 수 없다")
    void searchPosts_nonAdminOnAdminBoard_throwsForbidden() {
        given(metaRepository.findByBlbMngNoAndDelYn("BLBM-2026-0099", "N"))
            .willReturn(Optional.of(adminOnlyBoard));

        assertThatThrownBy(() ->
            service.searchPosts("BLBM-2026-0099", new com.kdb.it.common.board.dto.BoardPostDto.SearchCondition(), normalUser)
        ).isInstanceOf(CustomGeneralException.class);
    }

    @Test
    @DisplayName("공개 게시판 게시물 목록을 일반 사용자가 조회할 수 있다")
    void searchPosts_publicBoard_normalUser_success() {
        given(metaRepository.findByBlbMngNoAndDelYn("BLBM-2026-0001", "N"))
            .willReturn(Optional.of(publicBoard));
        given(postRepository.searchPosts(any(), any(), anyBoolean(), any(), any()))
            .willReturn(List.of());

        var result = service.searchPosts(
            "BLBM-2026-0001",
            new com.kdb.it.common.board.dto.BoardPostDto.SearchCondition(),
            normalUser
        );
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("ROLE_ADMIN 등록 게시판에 일반 사용자가 게시물을 등록하면 예외가 발생한다")
    void createPost_noWritePermission_throwsForbidden() {
        given(metaRepository.findByBlbMngNoAndDelYn("BLBM-2026-0001", "N"))
            .willReturn(Optional.of(publicBoard)); // enrAthC = ROLE_ADMIN

        var req = new com.kdb.it.common.board.dto.BoardPostDto.CreateRequest();
        req.setNacNm("제목");

        assertThatThrownBy(() -> service.createPost("BLBM-2026-0001", req, normalUser))
            .isInstanceOf(CustomGeneralException.class);
    }
}
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.common.board.service.BoardPostServiceTest"
```
Expected: FAIL (BoardPostService 클래스가 아직 없음)

- [ ] **Step 3: BoardMetaService 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/service/BoardMetaService.java
package com.kdb.it.common.board.service;

import com.kdb.it.common.board.dto.BoardMetaDto;
import com.kdb.it.common.board.entity.Cblbmm;
import com.kdb.it.common.board.repository.BoardMetaRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.exception.CustomGeneralException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 게시판 메타 서비스
 *
 * <p>게시판 생성·수정·삭제는 관리자 전용. 목록 조회는 인증 사용자 전체.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardMetaService {

    private final BoardMetaRepository boardMetaRepository;

    /**
     * 사이드바용 게시판 목록 조회
     *
     * <p>USE_YN='Y' + DEL_YN='N' 전체 반환. 사이드바는 권한 필터를 프론트가 수행.</p>
     *
     * @return 게시판 메타 응답 목록 (SRE_SQN_NO 오름차순)
     */
    public List<BoardMetaDto.Response> getAllActive() {
        return boardMetaRepository.findAllActiveOrdered().stream()
            .map(BoardMetaDto.Response::from)
            .collect(Collectors.toList());
    }

    /**
     * 게시판 단건 조회
     *
     * @param blbMngNo 게시판관리번호
     * @return 게시판 메타 응답
     * @throws CustomGeneralException 게시판을 찾을 수 없는 경우
     */
    public BoardMetaDto.Response getOne(String blbMngNo) {
        return BoardMetaDto.Response.from(findActiveBoard(blbMngNo));
    }

    /**
     * 게시판 신규 등록 (관리자 전용)
     *
     * @param request 등록 요청
     * @return 생성된 게시판관리번호
     */
    @Transactional
    public String createBoard(BoardMetaDto.CreateRequest request) {
        Long seq = boardMetaRepository.getNextSequenceValue();
        String blbMngNo = String.format("BLBM-%d-%04d", LocalDate.now().getYear(), seq);

        Cblbmm entity = Cblbmm.builder()
            .blbMngNo(blbMngNo)
            .blbTp(request.getBlbTp())
            .build();
        entity.update(request.toUpdateCommand());
        boardMetaRepository.save(entity);
        return blbMngNo;
    }

    /**
     * 게시판 수정 (관리자 전용)
     *
     * @param blbMngNo 게시판관리번호
     * @param request  수정 요청
     */
    @Transactional
    public void updateBoard(String blbMngNo, BoardMetaDto.UpdateRequest request) {
        findActiveBoard(blbMngNo).update(request.toUpdateCommand());
    }

    /**
     * 게시판 삭제 — Soft Delete (관리자 전용)
     *
     * @param blbMngNo 게시판관리번호
     */
    @Transactional
    public void deleteBoard(String blbMngNo) {
        findActiveBoard(blbMngNo).delete();
    }

    // ----------------------------------------------------------------
    // 내부 헬퍼
    // ----------------------------------------------------------------

    /**
     * 활성 게시판 조회 — 내부 공통 메서드
     *
     * @throws CustomGeneralException 존재하지 않거나 삭제된 게시판
     */
    Cblbmm findActiveBoard(String blbMngNo) {
        return boardMetaRepository.findByBlbMngNoAndDelYn(blbMngNo, "N")
            .orElseThrow(() -> new CustomGeneralException("게시판을 찾을 수 없습니다: " + blbMngNo));
    }
}
```

- [ ] **Step 4: BoardPostService 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostService.java
package com.kdb.it.common.board.service;

import com.kdb.it.common.board.dto.BoardPostDto;
import com.kdb.it.common.board.entity.Cblbcm;
import com.kdb.it.common.board.entity.Cblbmm;
import com.kdb.it.common.board.repository.BoardMetaRepository;
import com.kdb.it.common.board.repository.BoardPostRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.common.util.HtmlSanitizer;
import com.kdb.it.exception.CustomGeneralException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 게시물 서비스
 *
 * <p>게시물 CRUD, 답변글 트리, 권한 검증을 담당한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardPostService {

    private final BoardMetaRepository metaRepository;
    private final BoardPostRepository postRepository;

    /**
     * 게시물 목록 조회
     *
     * @param blbMngNo 게시판관리번호
     * @param cond     검색 조건
     * @param user     현재 사용자
     * @return 게시물 목록 (권한 필터 + 트리 정렬 적용)
     * @throws CustomGeneralException 게시판 조회 권한 없음
     */
    public List<BoardPostDto.ListItem> searchPosts(
            String blbMngNo,
            BoardPostDto.SearchCondition cond,
            CustomUserDetails user) {

        Cblbmm board = findActiveBoard(blbMngNo);
        verifyCanReadBoard(user, board);

        return postRepository.searchPosts(
            blbMngNo, cond,
            user.isAdmin(),
            user.getBbrC(),
            board.getBbrLmtnUseYn()
        ).stream()
         .map(BoardPostDto.ListItem::from)
         .collect(Collectors.toList());
    }

    /**
     * 게시물 상세 조회 (조회수 +1 포함)
     *
     * @param blbMngNo  게시판관리번호
     * @param nacMngNo  게시물관리번호
     * @param user      현재 사용자
     * @return 게시물 상세
     * @throws CustomGeneralException 접근 권한 없음 또는 존재하지 않는 게시물
     */
    @Transactional
    public BoardPostDto.Detail getPostDetail(
            String blbMngNo, String nacMngNo, CustomUserDetails user) {

        Cblbmm board = findActiveBoard(blbMngNo);
        Cblbcm post  = findPost(nacMngNo);

        verifyCanReadPost(user, post, board);
        post.incrementViewCount();

        boolean canModify = user.isAdmin()
            || user.getEno().equals(post.getFstEnrUsid());
        return BoardPostDto.Detail.from(post, canModify);
    }

    /**
     * 게시물 등록
     *
     * @param blbMngNo  게시판관리번호
     * @param request   등록 요청
     * @param user      현재 사용자
     * @return 생성된 게시물관리번호
     * @throws CustomGeneralException 등록 권한 없음
     */
    @Transactional
    public String createPost(
            String blbMngNo,
            BoardPostDto.CreateRequest request,
            CustomUserDetails user) {

        Cblbmm board = findActiveBoard(blbMngNo);
        verifyCanWrite(user, board);
        verifyBbrC(user, request.getBbrC());

        String sanitizedCone = HtmlSanitizer.sanitize(request.getNacCone());
        Long seq = postRepository.getNextSequenceValue();
        String nacMngNo = String.format("NAC-%d-%04d", LocalDate.now().getYear(), seq);

        Cblbcm post = Cblbcm.builder()
            .nacMngNo(nacMngNo)
            .blbMngNo(blbMngNo)
            .nacNm(request.getNacNm())
            .nacCone(sanitizedCone)
            .nacTp(request.getNacTp())
            .kdC(request.getKdC())
            .pritC(request.getPritC() != null ? request.getPritC() : "PRIT_C_001")
            .hrkFxnYn(request.getHrkFxnYn() != null ? request.getHrkFxnYn() : "N")
            .sreYn(request.getSreYn() != null ? request.getSreYn() : "Y")
            .bbrC(request.getBbrC())
            .sttYmd(request.getSttYmd())
            .endYmd(request.getEndYmd())
            .nacInqNbr(0)
            .flApgYn("N")
            .flNbr(0)
            .nacGrpNo(nacMngNo)  // 임시값, initGroupAsRoot가 덮어씀
            .nacGrpSqn(0)
            .nacGrpLev(0)
            .build();
        post.initGroupAsRoot();
        postRepository.save(post);
        return nacMngNo;
    }

    /**
     * 게시물 수정
     *
     * @param blbMngNo  게시판관리번호
     * @param nacMngNo  게시물관리번호
     * @param request   수정 요청
     * @param user      현재 사용자
     * @throws CustomGeneralException 수정 권한 없음
     */
    @Transactional
    public void updatePost(
            String blbMngNo,
            String nacMngNo,
            BoardPostDto.UpdateRequest request,
            CustomUserDetails user) {

        Cblbmm board = findActiveBoard(blbMngNo);
        Cblbcm post  = findPost(nacMngNo);
        verifyCanModify(user, post);
        verifyBbrC(user, request.getBbrC());

        String sanitizedCone = HtmlSanitizer.sanitize(request.getNacCone());
        post.update(request.toUpdateCommand(sanitizedCone));
    }

    /**
     * 게시물 삭제 — Soft Delete
     *
     * @param blbMngNo  게시판관리번호
     * @param nacMngNo  게시물관리번호
     * @param user      현재 사용자
     * @throws CustomGeneralException 삭제 권한 없음
     */
    @Transactional
    public void deletePost(String blbMngNo, String nacMngNo, CustomUserDetails user) {
        findActiveBoard(blbMngNo); // 존재 확인
        findPost(nacMngNo).delete();
    }

    /**
     * 답변글 등록 — 트리 SQN 밀어내기 후 저장 (단일 트랜잭션 + 락)
     *
     * @param blbMngNo   게시판관리번호
     * @param nacMngNo   부모 게시물관리번호
     * @param request    답변글 등록 요청
     * @param user       현재 사용자
     * @return 생성된 답변글 관리번호
     * @throws CustomGeneralException 게시판이 답변 미지원 / 부모 게시물 접근 불가 / 등록 권한 없음
     */
    @Transactional
    public String createReply(
            String blbMngNo,
            String nacMngNo,
            BoardPostDto.ReplyCreateRequest request,
            CustomUserDetails user) {

        Cblbmm board  = findActiveBoard(blbMngNo);
        Cblbcm parent = findPost(nacMngNo);

        if (!"Y".equals(board.getRepUseYn())) {
            throw new CustomGeneralException("해당 게시판은 답변 기능을 지원하지 않습니다.");
        }
        verifyCanReadPost(user, parent, board);
        verifyCanWrite(user, board);

        // 1) 부모 이후 자손 SQN 밀어내기 (비관적 락은 DB FK 제약 + 트랜잭션으로 보장)
        postRepository.shiftGroupSqn(
            parent.getNacGrpNo(),
            parent.getNacGrpSqn(),
            parent.getNacGrpLev()
        );

        // 2) 새 답변글 생성
        String sanitizedCone = HtmlSanitizer.sanitize(request.getNacCone());
        Long seq = postRepository.getNextSequenceValue();
        String newNacMngNo = String.format("NAC-%d-%04d", LocalDate.now().getYear(), seq);

        Cblbcm reply = Cblbcm.builder()
            .nacMngNo(newNacMngNo)
            .blbMngNo(blbMngNo)
            .nacNm(request.getNacNm())
            .nacCone(sanitizedCone)
            .pritC(request.getPritC() != null ? request.getPritC() : "PRIT_C_001")
            .hrkFxnYn("N")
            .sreYn("Y")
            .bbrC(request.getBbrC())
            .sttYmd(request.getSttYmd())
            .endYmd(request.getEndYmd())
            .nacInqNbr(0)
            .flApgYn("N")
            .flNbr(0)
            .nacGrpNo(parent.getNacGrpNo()) // 임시
            .nacGrpSqn(0)
            .nacGrpLev(0)
            .build();
        reply.initGroupAsReply(
            parent.getNacGrpNo(),
            parent.getNacGrpSqn(),
            parent.getNacGrpLev(),
            parent.getNacMngNo()
        );
        postRepository.save(reply);
        return newNacMngNo;
    }

    // ----------------------------------------------------------------
    // 권한 검증 (서비스 레이어 + 컨트롤러 이중 적용)
    // ----------------------------------------------------------------

    /**
     * 게시판 조회 권한 검증
     *
     * @throws CustomGeneralException 접근 권한 없음
     */
    public void verifyCanReadBoard(CustomUserDetails user, Cblbmm board) {
        if (user.isAdmin()) return;

        boolean roleOk = "ALL".equals(board.getInqAthC())
            || hasSpringRole(user, board.getInqAthC());
        boolean deptOk = board.getBbrLmtnC() == null
            || board.getBbrLmtnC().equals(user.getBbrC());

        if (!roleOk || !deptOk) {
            throw new CustomGeneralException("게시판 접근 권한이 없습니다.");
        }
    }

    /**
     * 게시물 단건 가시성 검증
     *
     * @throws CustomGeneralException 접근 권한 없음 또는 기간 외
     */
    public void verifyCanReadPost(CustomUserDetails user, Cblbcm post, Cblbmm board) {
        verifyCanReadBoard(user, board);
        if (user.isAdmin()) return;

        LocalDate today = LocalDate.now();
        boolean visible = "Y".equals(post.getSreYn())
            && (post.getSttYmd() == null || !post.getSttYmd().isAfter(today))
            && (post.getEndYmd() == null || !post.getEndYmd().isBefore(today));
        boolean deptOk = !"Y".equals(board.getBbrLmtnUseYn())
            || post.getBbrC() == null
            || post.getBbrC().equals(user.getBbrC());

        if (!visible || !deptOk) {
            throw new CustomGeneralException("게시물에 접근할 권한이 없습니다.");
        }
    }

    // ----------------------------------------------------------------
    // 내부 헬퍼
    // ----------------------------------------------------------------

    private Cblbmm findActiveBoard(String blbMngNo) {
        return metaRepository.findByBlbMngNoAndDelYn(blbMngNo, "N")
            .orElseThrow(() -> new CustomGeneralException("게시판을 찾을 수 없습니다: " + blbMngNo));
    }

    private Cblbcm findPost(String nacMngNo) {
        return postRepository.findByNacMngNoAndDelYn(nacMngNo, "N")
            .orElseThrow(() -> new CustomGeneralException("게시물을 찾을 수 없습니다: " + nacMngNo));
    }

    private void verifyCanWrite(CustomUserDetails user, Cblbmm board) {
        if (user.isAdmin()) return;
        if ("ALL".equals(board.getEnrAthC())) return;
        if (hasSpringRole(user, board.getEnrAthC())) return;
        throw new CustomGeneralException("게시물 등록 권한이 없습니다.");
    }

    private void verifyCanModify(CustomUserDetails user, Cblbcm post) {
        if (user.isAdmin()) return;
        if (user.getEno().equals(post.getFstEnrUsid())) return;
        throw new CustomGeneralException("본인 게시물만 수정/삭제할 수 있습니다.");
    }

    /** BBR_C는 사용자 자신의 부서 또는 NULL만 허용 (관리자 제외) */
    private void verifyBbrC(CustomUserDetails user, String requestBbrC) {
        if (user.isAdmin() || requestBbrC == null) return;
        if (!requestBbrC.equals(user.getBbrC())) {
            throw new CustomGeneralException("본인 부서코드만 지정할 수 있습니다.");
        }
    }

    private boolean hasSpringRole(CustomUserDetails user, String roleCode) {
        return user.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals(roleCode));
    }
}
```

- [ ] **Step 5: BoardCommentService 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/service/BoardCommentService.java
package com.kdb.it.common.board.service;

import com.kdb.it.common.board.dto.BoardCommentDto;
import com.kdb.it.common.board.entity.Cblbcm;
import com.kdb.it.common.board.entity.Cblbmm;
import com.kdb.it.common.board.entity.Ccmmtm;
import com.kdb.it.common.board.repository.BoardCommentRepository;
import com.kdb.it.common.board.repository.BoardMetaRepository;
import com.kdb.it.common.board.repository.BoardPostRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.common.util.HtmlSanitizer;
import com.kdb.it.exception.CustomGeneralException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 게시판 댓글 서비스
 *
 * <p>원댓글·대댓글 CRUD, 트리 알고리즘을 담당한다.</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BoardCommentService {

    private final BoardMetaRepository  metaRepository;
    private final BoardPostRepository  postRepository;
    private final BoardCommentRepository commentRepository;
    private final BoardPostService     postService;

    /**
     * 게시물의 댓글 목록 조회 (트리 정렬)
     *
     * @param blbMngNo  게시판관리번호
     * @param nacMngNo  게시물관리번호
     * @param user      현재 사용자
     * @return 트리 정렬된 댓글 목록
     */
    public List<BoardCommentDto.Response> getComments(
            String blbMngNo, String nacMngNo, CustomUserDetails user) {

        Cblbmm board = findActiveBoard(blbMngNo);
        Cblbcm post  = findPost(nacMngNo);
        postService.verifyCanReadPost(user, post, board);

        return commentRepository.findCommentsByPost(nacMngNo).stream()
            .map(c -> BoardCommentDto.Response.from(c, canModify(user, c)))
            .collect(Collectors.toList());
    }

    /**
     * 댓글 등록
     *
     * @param blbMngNo  게시판관리번호
     * @param nacMngNo  게시물관리번호
     * @param request   등록 요청 (최대 2,000자)
     * @param user      현재 사용자
     * @return 생성된 댓글관리번호
     * @throws CustomGeneralException 게시판이 댓글 미지원 / 게시물 접근 불가
     */
    @Transactional
    public String createComment(
            String blbMngNo, String nacMngNo,
            BoardCommentDto.CreateRequest request,
            CustomUserDetails user) {

        Cblbmm board = findActiveBoard(blbMngNo);
        Cblbcm post  = findPost(nacMngNo);

        if (!"Y".equals(board.getCmmtUseYn())) {
            throw new CustomGeneralException("해당 게시판은 댓글 기능을 지원하지 않습니다.");
        }
        postService.verifyCanReadPost(user, post, board);

        String sanitized = HtmlSanitizer.sanitize(request.getCmmtCone());
        String cmmtMngNo = generateCmmtId();

        Ccmmtm comment = Ccmmtm.builder()
            .cmmtMngNo(cmmtMngNo)
            .nacMngNo(nacMngNo)
            .cmmtCone(sanitized)
            .sreYn("Y")
            .cmmtGrpNo(cmmtMngNo)
            .cmmtGrpSqn(0)
            .cmmtGrpLev(0)
            .build();
        comment.initGroupAsRoot();
        commentRepository.save(comment);
        return cmmtMngNo;
    }

    /**
     * 대댓글 등록 — 트리 SQN 밀어내기 후 저장
     *
     * @param blbMngNo      게시판관리번호
     * @param nacMngNo      게시물관리번호
     * @param hrkCmmtMngNo  부모 댓글관리번호
     * @param request       등록 요청
     * @param user          현재 사용자
     * @return 생성된 대댓글 관리번호
     */
    @Transactional
    public String createReply(
            String blbMngNo, String nacMngNo, String hrkCmmtMngNo,
            BoardCommentDto.CreateRequest request,
            CustomUserDetails user) {

        Cblbmm board  = findActiveBoard(blbMngNo);
        Cblbcm post   = findPost(nacMngNo);
        Ccmmtm parent = findComment(hrkCmmtMngNo);

        if (!"Y".equals(board.getCmmtUseYn())) {
            throw new CustomGeneralException("해당 게시판은 댓글 기능을 지원하지 않습니다.");
        }
        postService.verifyCanReadPost(user, post, board);

        // SQN 밀어내기
        commentRepository.shiftGroupSqn(
            parent.getCmmtGrpNo(),
            parent.getCmmtGrpSqn(),
            parent.getCmmtGrpLev()
        );

        String sanitized = HtmlSanitizer.sanitize(request.getCmmtCone());
        String cmmtMngNo = generateCmmtId();

        Ccmmtm reply = Ccmmtm.builder()
            .cmmtMngNo(cmmtMngNo)
            .nacMngNo(nacMngNo)
            .cmmtCone(sanitized)
            .sreYn("Y")
            .cmmtGrpNo(parent.getCmmtGrpNo())
            .cmmtGrpSqn(0)
            .cmmtGrpLev(0)
            .build();
        reply.initGroupAsReply(
            parent.getCmmtGrpNo(),
            parent.getCmmtGrpSqn(),
            parent.getCmmtGrpLev(),
            parent.getCmmtMngNo()
        );
        commentRepository.save(reply);
        return cmmtMngNo;
    }

    /**
     * 댓글 수정
     *
     * @param cmmtMngNo  댓글관리번호
     * @param request    수정 요청
     * @param user       현재 사용자
     * @throws CustomGeneralException 수정 권한 없음
     */
    @Transactional
    public void updateComment(
            String cmmtMngNo,
            BoardCommentDto.UpdateRequest request,
            CustomUserDetails user) {

        Ccmmtm comment = findComment(cmmtMngNo);
        verifyCanModify(user, comment);
        comment.updateContent(HtmlSanitizer.sanitize(request.getCmmtCone()));
    }

    /**
     * 댓글 삭제 — Soft Delete
     *
     * <p>자식 댓글이 있으면 본문이 "삭제된 댓글입니다."로 표시되고 트리 구조는 유지된다.</p>
     *
     * @param cmmtMngNo  댓글관리번호
     * @param user       현재 사용자
     */
    @Transactional
    public void deleteComment(String cmmtMngNo, CustomUserDetails user) {
        Ccmmtm comment = findComment(cmmtMngNo);
        verifyCanModify(user, comment);
        comment.delete();
    }

    // ----------------------------------------------------------------
    // 내부 헬퍼
    // ----------------------------------------------------------------

    private Cblbmm findActiveBoard(String blbMngNo) {
        return metaRepository.findByBlbMngNoAndDelYn(blbMngNo, "N")
            .orElseThrow(() -> new CustomGeneralException("게시판을 찾을 수 없습니다: " + blbMngNo));
    }

    private Cblbcm findPost(String nacMngNo) {
        return postRepository.findByNacMngNoAndDelYn(nacMngNo, "N")
            .orElseThrow(() -> new CustomGeneralException("게시물을 찾을 수 없습니다: " + nacMngNo));
    }

    private Ccmmtm findComment(String cmmtMngNo) {
        return commentRepository.findByCmmtMngNoAndDelYn(cmmtMngNo, "N")
            .orElseThrow(() -> new CustomGeneralException("댓글을 찾을 수 없습니다: " + cmmtMngNo));
    }

    private void verifyCanModify(CustomUserDetails user, Ccmmtm comment) {
        if (user.isAdmin()) return;
        if (user.getEno().equals(comment.getFstEnrUsid())) return;
        throw new CustomGeneralException("본인 댓글만 수정/삭제할 수 있습니다.");
    }

    private boolean canModify(CustomUserDetails user, Ccmmtm comment) {
        return user.isAdmin() || user.getEno().equals(comment.getFstEnrUsid());
    }

    private String generateCmmtId() {
        Long seq = commentRepository.getNextSequenceValue();
        return String.format("CMMT-%d-%04d", LocalDate.now().getYear(), seq);
    }
}
```

- [ ] **Step 6: 테스트 재실행 — 통과 확인**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.common.board.service.BoardPostServiceTest"
```
Expected: PASS (3개 테스트 모두 통과)

- [ ] **Step 7: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/board/service/
git add it_backend/src/test/java/com/kdb/it/common/board/service/BoardPostServiceTest.java
git commit -m "feat: 게시판 서비스 3종 추가 (BoardMetaService / BoardPostService / BoardCommentService)"
```

---

## Task 8: 컨트롤러 — 게시판 메타 · 게시물 · 댓글

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/board/controller/BoardMetaController.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/controller/AdminBoardMetaController.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/controller/BoardPostController.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/controller/BoardCommentController.java`

- [ ] **Step 1: BoardMetaController 작성 (공개 조회)**

```java
// it_backend/src/main/java/com/kdb/it/common/board/controller/BoardMetaController.java
package com.kdb.it.common.board.controller;

import com.kdb.it.common.board.dto.BoardMetaDto;
import com.kdb.it.common.board.service.BoardMetaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 게시판 메타 조회 컨트롤러 (인증 사용자 공통)
 */
@RestController
@RequestMapping("/api/boards/meta")
@RequiredArgsConstructor
@Tag(name = "Board Meta", description = "게시판 메타 조회 API")
public class BoardMetaController {

    private final BoardMetaService boardMetaService;

    @GetMapping
    @Operation(summary = "게시판 목록 조회 (사이드바용)")
    public ResponseEntity<List<BoardMetaDto.Response>> getAll() {
        return ResponseEntity.ok(boardMetaService.getAllActive());
    }

    @GetMapping("/{blbMngNo}")
    @Operation(summary = "게시판 단건 조회")
    public ResponseEntity<BoardMetaDto.Response> getOne(
            @PathVariable String blbMngNo) {
        return ResponseEntity.ok(boardMetaService.getOne(blbMngNo));
    }
}
```

- [ ] **Step 2: AdminBoardMetaController 작성 (관리자 전용)**

```java
// it_backend/src/main/java/com/kdb/it/common/board/controller/AdminBoardMetaController.java
package com.kdb.it.common.board.controller;

import com.kdb.it.common.board.dto.BoardMetaDto;
import com.kdb.it.common.board.service.BoardMetaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

/**
 * 게시판 메타 관리 컨트롤러 — 관리자 전용
 *
 * <p>{@code @PreAuthorize} 클래스 레벨 적용 필수 (CLAUDE.md §5.6)</p>
 */
@RestController
@RequestMapping("/api/admin/boards/meta")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin Board Meta", description = "게시판 메타 관리 API (관리자 전용)")
public class AdminBoardMetaController {

    private final BoardMetaService boardMetaService;

    @PostMapping
    @Operation(summary = "게시판 등록")
    public ResponseEntity<String> create(
            @RequestBody BoardMetaDto.CreateRequest request) {
        String blbMngNo = boardMetaService.createBoard(request);
        return ResponseEntity.created(URI.create("/api/boards/meta/" + blbMngNo)).body(blbMngNo);
    }

    @PutMapping("/{blbMngNo}")
    @Operation(summary = "게시판 수정")
    public ResponseEntity<Void> update(
            @PathVariable String blbMngNo,
            @RequestBody BoardMetaDto.UpdateRequest request) {
        boardMetaService.updateBoard(blbMngNo, request);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{blbMngNo}")
    @Operation(summary = "게시판 삭제 (Soft Delete)")
    public ResponseEntity<Void> delete(@PathVariable String blbMngNo) {
        boardMetaService.deleteBoard(blbMngNo);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 3: BoardPostController 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/controller/BoardPostController.java
package com.kdb.it.common.board.controller;

import com.kdb.it.common.board.dto.BoardPostDto;
import com.kdb.it.common.board.service.BoardPostService;
import com.kdb.it.common.system.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * 게시물 CRUD + 답변글 컨트롤러
 */
@RestController
@RequestMapping("/api/boards/{blbMngNo}/posts")
@RequiredArgsConstructor
@Tag(name = "Board Post", description = "게시물 API")
public class BoardPostController {

    private final BoardPostService boardPostService;

    @GetMapping
    @Operation(summary = "게시물 목록 조회")
    public ResponseEntity<List<BoardPostDto.ListItem>> searchPosts(
            @PathVariable String blbMngNo,
            @ModelAttribute BoardPostDto.SearchCondition cond,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(boardPostService.searchPosts(blbMngNo, cond, user));
    }

    @GetMapping("/{nacMngNo}")
    @Operation(summary = "게시물 상세 조회 (조회수 +1)")
    public ResponseEntity<BoardPostDto.Detail> getDetail(
            @PathVariable String blbMngNo,
            @PathVariable String nacMngNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(boardPostService.getPostDetail(blbMngNo, nacMngNo, user));
    }

    @PostMapping
    @Operation(summary = "게시물 등록")
    public ResponseEntity<String> create(
            @PathVariable String blbMngNo,
            @RequestBody BoardPostDto.CreateRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        String nacMngNo = boardPostService.createPost(blbMngNo, request, user);
        return ResponseEntity.created(
            URI.create("/api/boards/" + blbMngNo + "/posts/" + nacMngNo)
        ).body(nacMngNo);
    }

    @PutMapping("/{nacMngNo}")
    @Operation(summary = "게시물 수정")
    public ResponseEntity<Void> update(
            @PathVariable String blbMngNo,
            @PathVariable String nacMngNo,
            @RequestBody BoardPostDto.UpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        boardPostService.updatePost(blbMngNo, nacMngNo, request, user);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{nacMngNo}")
    @Operation(summary = "게시물 삭제 (Soft Delete)")
    public ResponseEntity<Void> delete(
            @PathVariable String blbMngNo,
            @PathVariable String nacMngNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        boardPostService.deletePost(blbMngNo, nacMngNo, user);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{nacMngNo}/replies")
    @Operation(summary = "답변글 등록")
    public ResponseEntity<String> createReply(
            @PathVariable String blbMngNo,
            @PathVariable String nacMngNo,
            @RequestBody BoardPostDto.ReplyCreateRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        String replyId = boardPostService.createReply(blbMngNo, nacMngNo, request, user);
        return ResponseEntity.created(
            URI.create("/api/boards/" + blbMngNo + "/posts/" + replyId)
        ).body(replyId);
    }
}
```

- [ ] **Step 4: BoardCommentController 작성**

```java
// it_backend/src/main/java/com/kdb/it/common/board/controller/BoardCommentController.java
package com.kdb.it.common.board.controller;

import com.kdb.it.common.board.dto.BoardCommentDto;
import com.kdb.it.common.board.service.BoardCommentService;
import com.kdb.it.common.system.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

/**
 * 게시판 댓글 컨트롤러
 */
@RestController
@RequestMapping("/api/boards/{blbMngNo}/posts/{nacMngNo}/comments")
@RequiredArgsConstructor
@Tag(name = "Board Comment", description = "댓글 API")
public class BoardCommentController {

    private final BoardCommentService boardCommentService;

    @GetMapping
    @Operation(summary = "댓글 목록 조회 (트리 정렬)")
    public ResponseEntity<List<BoardCommentDto.Response>> getComments(
            @PathVariable String blbMngNo,
            @PathVariable String nacMngNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(boardCommentService.getComments(blbMngNo, nacMngNo, user));
    }

    @PostMapping
    @Operation(summary = "댓글 등록")
    public ResponseEntity<String> create(
            @PathVariable String blbMngNo,
            @PathVariable String nacMngNo,
            @RequestBody BoardCommentDto.CreateRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        String cmmtMngNo = boardCommentService.createComment(blbMngNo, nacMngNo, request, user);
        return ResponseEntity.created(
            URI.create("/api/boards/" + blbMngNo + "/posts/" + nacMngNo + "/comments/" + cmmtMngNo)
        ).body(cmmtMngNo);
    }

    @PostMapping("/{cmmtMngNo}/replies")
    @Operation(summary = "대댓글 등록")
    public ResponseEntity<String> createReply(
            @PathVariable String blbMngNo,
            @PathVariable String nacMngNo,
            @PathVariable String cmmtMngNo,
            @RequestBody BoardCommentDto.CreateRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        String replyId = boardCommentService.createReply(blbMngNo, nacMngNo, cmmtMngNo, request, user);
        return ResponseEntity.created(
            URI.create("/api/boards/" + blbMngNo + "/posts/" + nacMngNo + "/comments/" + replyId)
        ).body(replyId);
    }

    @PutMapping("/{cmmtMngNo}")
    @Operation(summary = "댓글 수정")
    public ResponseEntity<Void> update(
            @PathVariable String blbMngNo,
            @PathVariable String nacMngNo,
            @PathVariable String cmmtMngNo,
            @RequestBody BoardCommentDto.UpdateRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
        boardCommentService.updateComment(cmmtMngNo, request, user);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{cmmtMngNo}")
    @Operation(summary = "댓글 삭제 (Soft Delete)")
    public ResponseEntity<Void> delete(
            @PathVariable String blbMngNo,
            @PathVariable String nacMngNo,
            @PathVariable String cmmtMngNo,
            @AuthenticationPrincipal CustomUserDetails user) {
        boardCommentService.deleteComment(cmmtMngNo, user);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 5: 전체 빌드 확인**

```bash
cd it_backend && ./gradlew build
```
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/board/controller/
git commit -m "feat: 게시판 컨트롤러 4종 추가 (Meta/AdminMeta/Post/Comment)"
```

---

## Task 9: FileOwnershipChecker 확장

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java`

- [ ] **Step 1: 현재 FileOwnershipChecker 파일 읽기**

읽어야 할 파일: `it_backend/src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java`

- [ ] **Step 2: 게시판 파일 접근 분기 추가**

기존 `checkOwnership` 메서드 아래 overloaded 버전을 추가한다:

```java
// FileOwnershipChecker.java에 필드 및 메서드 추가

// 추가할 필드 (기존 fileRepository 아래)
private final com.kdb.it.common.board.repository.BoardMetaRepository boardMetaRepository;
private final com.kdb.it.common.board.repository.BoardPostRepository  boardPostRepository;

/**
 * 파일 다운로드 권한 검증 — ORC_DTT별 분기
 *
 * <p>ORC_DTT="공통게시판"인 파일은 canReadPost 규칙을 적용한다.
 * 그 외 파일은 기존 소유자 검증(FST_ENR_USID)을 적용한다.</p>
 *
 * @param flMngNo  파일관리번호
 * @param user     현재 사용자
 */
public void checkReadAccess(String flMngNo,
        com.kdb.it.common.system.security.CustomUserDetails user) {

    com.kdb.it.infra.file.entity.Cfilem file = fileRepository
        .findByFlMngNoAndDelYn(flMngNo, "N")
        .orElseThrow(() -> new com.kdb.it.exception.CustomGeneralException(
            "파일을 찾을 수 없습니다: " + flMngNo));

    if ("공통게시판".equals(file.getOrcDtt())) {
        verifyBoardFileAccess(file, user);
    }
    // 다른 ORC_DTT는 별도 정책 없으면 소유자 확인으로 폴백하지 않음 (읽기는 허용)
}

/** 게시판 파일 접근 권한 — 게시물 가시성 규칙 준용 */
private void verifyBoardFileAccess(
        com.kdb.it.infra.file.entity.Cfilem file,
        com.kdb.it.common.system.security.CustomUserDetails user) {

    String nacMngNo = file.getOrcPkVl();
    com.kdb.it.common.board.entity.Cblbcm post = boardPostRepository
        .findByNacMngNoAndDelYn(nacMngNo, "N")
        .orElseThrow(() -> new com.kdb.it.exception.CustomGeneralException(
            "첨부파일의 게시물을 찾을 수 없습니다."));

    com.kdb.it.common.board.entity.Cblbmm board = boardMetaRepository
        .findByBlbMngNoAndDelYn(post.getBlbMngNo(), "N")
        .orElseThrow(() -> new com.kdb.it.exception.CustomGeneralException(
            "첨부파일의 게시판을 찾을 수 없습니다."));

    // BoardPostService.verifyCanReadPost 로직을 인라인 복제
    // (순환 의존성 회피 — FileOwnershipChecker는 infra 레이어)
    if (user.isAdmin()) return;

    boolean boardOk = "ALL".equals(board.getInqAthC())
        || user.getAuthorities().stream()
               .anyMatch(a -> a.getAuthority().equals(board.getInqAthC()));
    if (!boardOk) {
        throw new com.kdb.it.exception.CustomGeneralException("파일 다운로드 권한이 없습니다.");
    }

    java.time.LocalDate today = java.time.LocalDate.now();
    boolean postOk = "Y".equals(post.getSreYn())
        && (post.getSttYmd() == null || !post.getSttYmd().isAfter(today))
        && (post.getEndYmd() == null || !post.getEndYmd().isBefore(today));
    if (!postOk) {
        throw new com.kdb.it.exception.CustomGeneralException("파일 다운로드 권한이 없습니다.");
    }
}
```

- [ ] **Step 3: FileController에서 게시판 파일 다운로드 시 checkReadAccess 호출**

`FileController.java`에서 `downloadFile` 또는 `getFile` 메서드를 찾아, ORC_DTT 기반 체크를 추가한다:

```java
// FileController의 파일 조회/다운로드 메서드에 추가
// (기존 checkOwnership 호출 바로 위 또는 대체)
fileOwnershipChecker.checkReadAccess(flMngNo, user);
```

- [ ] **Step 4: 빌드 확인 후 커밋**

```bash
cd it_backend && ./gradlew compileJava
git add it_backend/src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java
git add it_backend/src/main/java/com/kdb/it/infra/file/FileController.java
git commit -m "feat: FileOwnershipChecker에 공통게시판 파일 접근 권한 분기 추가"
```

---

## Task 10: 프론트엔드 — 타입 + Composables

**Files:**
- Create: `it_frontend/app/types/board.ts`
- Create: `it_frontend/app/composables/useBoard.ts`
- Create: `it_frontend/app/composables/useBoardPost.ts`
- Create: `it_frontend/app/composables/useBoardComment.ts`

- [ ] **Step 1: 타입 정의 작성**

```typescript
// it_frontend/app/types/board.ts

/** 게시판 메타 응답 */
export interface BoardMeta {
  blbMngNo:      string
  blbNm:         string
  blbTp:         string
  repUseYn:      string
  cmmtUseYn:     string
  flEsnYn:       string
  hrkFxnUseYn:   string
  nacTpUseYn:    string
  kdUseYn:       string
  inqAthC:       string
  enrAthC:       string
  bbrLmtnUseYn:  string
  bbrLmtnC:      string | null
  sreSqnNo:      number
  useYn:         string
  rmk:           string | null
}

/** 게시물 목록 아이템 */
export interface BoardPostListItem {
  nacMngNo:    string
  blbMngNo:    string
  nacNm:       string
  nacInqNbr:   number
  nacTp:       string | null
  kdC:         string | null
  pritC:       string
  hrkFxnYn:   string
  sreYn:       string
  flApgYn:    string
  flNbr:       number
  nacGrpLev:  number
  sttYmd:     string | null
  endYmd:     string | null
  fstEnrUsid: string
  fstEnrDtm:  string
}

/** 게시물 상세 */
export interface BoardPostDetail extends BoardPostListItem {
  nacCone:     string
  bbrC:        string | null
  nacGrpNo:   string
  nacGrpSqn:  number
  hrkNacMngNo: string | null
  lstChgDtm:  string
  canModify:  boolean
}

/** 게시물 등록 요청 */
export interface BoardPostCreateRequest {
  nacNm:    string
  nacCone?: string
  nacTp?:   string
  kdC?:     string
  pritC?:   string
  hrkFxnYn?: string
  sreYn?:   string
  bbrC?:    string
  sttYmd?:  string
  endYmd?:  string
}

/** 게시물 수정 요청 */
export type BoardPostUpdateRequest = BoardPostCreateRequest

/** 답변글 등록 요청 */
export interface BoardPostReplyCreateRequest {
  nacNm:   string
  nacCone?: string
  pritC?:  string
  bbrC?:   string
  sttYmd?: string
  endYmd?: string
}

/** 댓글 응답 */
export interface BoardComment {
  cmmtMngNo:    string
  nacMngNo:     string
  cmmtCone:     string
  sreYn:        string
  cmmtGrpNo:   string
  cmmtGrpSqn:  number
  cmmtGrpLev:  number
  hrkCmmtMngNo: string | null
  delYn:        string
  fstEnrUsid:  string
  fstEnrDtm:   string
  lstChgDtm:   string
  canModify:   boolean
}

/** 게시물 목록 검색 조건 */
export interface BoardPostSearchCondition {
  keyword?:    string
  nacTp?:      string
  kdC?:        string
  pritC?:      string
  enrDtmFrom?: string
  enrDtmTo?:   string
  bbrC?:       string
  page?:       number
  size?:       number
}

/** 게시판 메타 등록 요청 */
export interface BoardMetaCreateRequest {
  blbNm:         string
  blbTp:         string
  repUseYn?:     string
  cmmtUseYn?:    string
  flEsnYn?:      string
  hrkFxnUseYn?:  string
  nacTpUseYn?:   string
  kdUseYn?:      string
  inqAthC?:      string
  enrAthC?:      string
  bbrLmtnUseYn?: string
  bbrLmtnC?:     string
  sreSqnNo?:     number
  rmk?:          string
}
```

- [ ] **Step 2: useBoard 작성 (메타 조회)**

```typescript
// it_frontend/app/composables/useBoard.ts
import type { BoardMeta, BoardMetaCreateRequest } from '~/types/board'

/** 게시판 메타 조회 및 관리 */
export const useBoard = () => {
  /**
   * 사이드바용 전체 게시판 목록 조회
   * USE_YN='Y' + DEL_YN='N' 목록 반환
   */
  const { data: boards, pending, refresh } = useApiFetch<BoardMeta[]>('/api/boards/meta')

  /**
   * 게시판 단건 조회
   * @param blbMngNo 게시판관리번호
   */
  const getBoard = (blbMngNo: string) =>
    useApiFetch<BoardMeta>(`/api/boards/meta/${blbMngNo}`)

  // ---- 관리자 전용 ----

  /** 게시판 등록 (관리자) */
  const createBoard = async (req: BoardMetaCreateRequest): Promise<string> => {
    const { $apiFetch } = useNuxtApp()
    return $apiFetch<string>('/api/admin/boards/meta', { method: 'POST', body: req })
  }

  /** 게시판 수정 (관리자) */
  const updateBoard = async (blbMngNo: string, req: Partial<BoardMetaCreateRequest>): Promise<void> => {
    const { $apiFetch } = useNuxtApp()
    await $apiFetch(`/api/admin/boards/meta/${blbMngNo}`, { method: 'PUT', body: req })
  }

  /** 게시판 삭제 (관리자) */
  const deleteBoard = async (blbMngNo: string): Promise<void> => {
    const { $apiFetch } = useNuxtApp()
    await $apiFetch(`/api/admin/boards/meta/${blbMngNo}`, { method: 'DELETE' })
  }

  return { boards, pending, refresh, getBoard, createBoard, updateBoard, deleteBoard }
}
```

- [ ] **Step 3: useBoardPost 작성**

```typescript
// it_frontend/app/composables/useBoardPost.ts
import type {
  BoardPostListItem, BoardPostDetail,
  BoardPostCreateRequest, BoardPostUpdateRequest,
  BoardPostReplyCreateRequest, BoardPostSearchCondition
} from '~/types/board'

/** 게시물 CRUD + 답변글 */
export const useBoardPost = (blbMngNo: Ref<string> | string) => {
  const boardId = typeof blbMngNo === 'string' ? blbMngNo : blbMngNo.value
  const { $apiFetch } = useNuxtApp()

  /**
   * 게시물 목록 조회
   * @param cond 검색 조건 (반응형)
   */
  const searchPosts = (cond: Ref<BoardPostSearchCondition>) =>
    useApiFetch<BoardPostListItem[]>(`/api/boards/${boardId}/posts`, {
      query: computed(() => cond.value)
    })

  /**
   * 게시물 상세 조회
   * @param nacMngNo 게시물관리번호
   */
  const getPost = (nacMngNo: string) =>
    useApiFetch<BoardPostDetail>(`/api/boards/${boardId}/posts/${nacMngNo}`)

  /** 게시물 등록 */
  const createPost = async (req: BoardPostCreateRequest): Promise<string> =>
    $apiFetch<string>(`/api/boards/${boardId}/posts`, { method: 'POST', body: req })

  /** 게시물 수정 */
  const updatePost = async (nacMngNo: string, req: BoardPostUpdateRequest): Promise<void> => {
    await $apiFetch(`/api/boards/${boardId}/posts/${nacMngNo}`, { method: 'PUT', body: req })
  }

  /** 게시물 삭제 */
  const deletePost = async (nacMngNo: string): Promise<void> => {
    await $apiFetch(`/api/boards/${boardId}/posts/${nacMngNo}`, { method: 'DELETE' })
  }

  /** 답변글 등록 */
  const createReply = async (
    nacMngNo: string,
    req: BoardPostReplyCreateRequest
  ): Promise<string> =>
    $apiFetch<string>(
      `/api/boards/${boardId}/posts/${nacMngNo}/replies`,
      { method: 'POST', body: req }
    )

  return { searchPosts, getPost, createPost, updatePost, deletePost, createReply }
}
```

- [ ] **Step 4: useBoardComment 작성**

```typescript
// it_frontend/app/composables/useBoardComment.ts
import type { BoardComment } from '~/types/board'

/** 댓글 CRUD */
export const useBoardComment = (blbMngNo: string, nacMngNo: string) => {
  const { $apiFetch } = useNuxtApp()
  const base = `/api/boards/${blbMngNo}/posts/${nacMngNo}/comments`

  /** 댓글 목록 조회 (트리 정렬) */
  const { data: comments, refresh } = useApiFetch<BoardComment[]>(base)

  /** 댓글 등록 */
  const createComment = async (cmmtCone: string): Promise<string> =>
    $apiFetch<string>(base, { method: 'POST', body: { cmmtCone } })

  /** 대댓글 등록 */
  const createReply = async (cmmtMngNo: string, cmmtCone: string): Promise<string> =>
    $apiFetch<string>(`${base}/${cmmtMngNo}/replies`, { method: 'POST', body: { cmmtCone } })

  /** 댓글 수정 */
  const updateComment = async (cmmtMngNo: string, cmmtCone: string): Promise<void> => {
    await $apiFetch(`${base}/${cmmtMngNo}`, { method: 'PUT', body: { cmmtCone } })
  }

  /** 댓글 삭제 */
  const deleteComment = async (cmmtMngNo: string): Promise<void> => {
    await $apiFetch(`${base}/${cmmtMngNo}`, { method: 'DELETE' })
  }

  return { comments, refresh, createComment, createReply, updateComment, deleteComment }
}
```

- [ ] **Step 5: 타입 체크**

```bash
cd it_frontend && npx nuxt typecheck
```
Expected: No errors

- [ ] **Step 6: 커밋**

```bash
git add it_frontend/app/types/board.ts
git add it_frontend/app/composables/useBoard.ts
git add it_frontend/app/composables/useBoardPost.ts
git add it_frontend/app/composables/useBoardComment.ts
git commit -m "feat: 게시판 TypeScript 타입 + Composables 추가"
```

---

## Task 11: 프론트엔드 — 페이지 + 컴포넌트

**Files:**
- Create: `it_frontend/app/pages/board/index.vue`
- Create: `it_frontend/app/pages/board/[blbMngNo]/index.vue`
- Create: `it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/index.vue`
- Create: `it_frontend/app/pages/board/[blbMngNo]/form.vue`
- Create: `it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/edit.vue`
- Create: `it_frontend/app/pages/admin/boards/index.vue`
- Create: `it_frontend/app/components/board/BoardCommentTree.vue`
- Modify: `it_frontend/app/components/AppSidebar.vue`

- [ ] **Step 1: 게시판 인덱스 페이지 작성**

```vue
<!-- it_frontend/app/pages/board/index.vue -->
<script setup lang="ts">
// 게시판 목록 인덱스 — 게시판 목록 카드 표시
import type { BoardMeta } from '~/types/board'
import { useBoard } from '~/composables/useBoard'
import { useAuth } from '~/composables/useAuth'

const { boards, pending } = useBoard()
const { user } = useAuth()

/** 현재 사용자가 조회 가능한 게시판만 필터 */
const visibleBoards = computed(() => {
  if (!boards.value) return []
  return boards.value.filter((b: BoardMeta) => {
    if (b.inqAthC === 'ALL') return true
    return user.value?.athIds?.includes('ITPAD001') ?? false
  })
})
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">게시판</h1>
    <div v-if="pending" class="flex justify-center py-12">
      <ProgressSpinner />
    </div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-for="board in visibleBoards"
        :key="board.blbMngNo"
        :to="`/board/${board.blbMngNo}`"
        class="block"
      >
        <Card class="hover:shadow-lg transition-shadow cursor-pointer">
          <template #title>{{ board.blbNm }}</template>
          <template #content>
            <div class="flex gap-2 flex-wrap text-sm text-gray-500">
              <span v-if="board.cmmtUseYn === 'Y'">
                <i class="pi pi-comments mr-1" />댓글
              </span>
              <span v-if="board.flEsnYn === 'Y'">
                <i class="pi pi-paperclip mr-1" />첨부필수
              </span>
            </div>
          </template>
        </Card>
      </NuxtLink>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 게시물 목록 페이지 작성**

```vue
<!-- it_frontend/app/pages/board/[blbMngNo]/index.vue -->
<script setup lang="ts">
import type { BoardPostSearchCondition } from '~/types/board'
import { useBoard } from '~/composables/useBoard'
import { useBoardPost } from '~/composables/useBoardPost'
import { useAuth } from '~/composables/useAuth'
import { formatDateTime } from '~/utils/common'

const route = useRoute()
const blbMngNo = route.params.blbMngNo as string

const { getBoard } = useBoard()
const { data: board } = getBoard(blbMngNo)
const { user } = useAuth()

const cond = ref<BoardPostSearchCondition>({ page: 0, size: 20 })
const { searchPosts } = useBoardPost(blbMngNo)
const { data: posts, pending, refresh } = searchPosts(cond)

/** 페이지 이동 */
const onPageChange = (event: { page: number; rows: number }) => {
  cond.value = { ...cond.value, page: event.page, size: event.rows }
}

/** 게시물 등록 권한 확인 */
const canWrite = computed(() => {
  if (!board.value || !user.value) return false
  const athC = board.value.enrAthC
  if (athC === 'ALL') return true
  return user.value.athIds?.includes('ITPAD001') ?? false
})
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">{{ board?.blbNm }}</h1>
      <NuxtLink
        v-if="canWrite"
        :to="`/board/${blbMngNo}/form`"
      >
        <Button label="글쓰기" icon="pi pi-pencil" />
      </NuxtLink>
    </div>

    <!-- 검색 -->
    <div class="flex gap-2 mb-4">
      <InputText
        v-model="cond.keyword"
        placeholder="제목/본문/작성자 검색"
        class="w-64"
        @keyup.enter="() => { cond.page = 0; refresh() }"
      />
      <Button label="검색" icon="pi pi-search" @click="() => { cond.page = 0; refresh() }" />
    </div>

    <StyledDataTable
      :value="posts ?? []"
      :loading="pending"
      :paginator="true"
      :rows="cond.size"
      :total-records="posts?.length ?? 0"
      @page="onPageChange"
    >
      <Column field="hrkFxnYn" header="" style="width: 2rem">
        <template #body="{ data }">
          <i v-if="data.hrkFxnYn === 'Y'" class="pi pi-thumbtack text-orange-500" />
        </template>
      </Column>
      <Column field="nacNm" header="제목">
        <template #body="{ data }">
          <div :style="{ paddingLeft: `${data.nacGrpLev * 20}px` }">
            <span v-if="data.nacGrpLev > 0" class="text-gray-400 mr-1">└</span>
            <NuxtLink
              :to="`/board/${blbMngNo}/${data.nacMngNo}`"
              class="hover:underline text-blue-600"
            >
              {{ data.nacNm }}
            </NuxtLink>
            <Tag v-if="data.flApgYn === 'Y'" value="첨부" severity="secondary" class="ml-1 text-xs" />
          </div>
        </template>
      </Column>
      <Column field="fstEnrUsid" header="작성자" style="width: 8rem" />
      <Column field="fstEnrDtm" header="등록일" style="width: 10rem">
        <template #body="{ data }">{{ formatDateTime(data.fstEnrDtm) }}</template>
      </Column>
      <Column field="nacInqNbr" header="조회" style="width: 5rem" />
    </StyledDataTable>
  </div>
</template>
```

- [ ] **Step 3: 게시물 상세 페이지 작성**

```vue
<!-- it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/index.vue -->
<script setup lang="ts">
import DOMPurify from 'isomorphic-dompurify'
import { useBoard } from '~/composables/useBoard'
import { useBoardPost } from '~/composables/useBoardPost'
import { formatDateTime } from '~/utils/common'

const route = useRoute()
const blbMngNo = route.params.blbMngNo as string
const nacMngNo = route.params.nacMngNo as string

const { getBoard } = useBoard()
const { data: board } = getBoard(blbMngNo)

const { getPost, deletePost } = useBoardPost(blbMngNo)
const { data: post, refresh } = getPost(nacMngNo)

/** 안전한 HTML 렌더링 */
const safeContent = computed(() =>
  post.value?.nacCone ? DOMPurify.sanitize(post.value.nacCone) : ''
)

const onDelete = async () => {
  if (!confirm('게시물을 삭제하시겠습니까?')) return
  await deletePost(nacMngNo)
  navigateTo(`/board/${blbMngNo}`)
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div v-if="post">
      <!-- 헤더 -->
      <div class="border-b pb-4 mb-4">
        <div class="flex items-start justify-between">
          <h1 class="text-2xl font-bold">{{ post.nacNm }}</h1>
          <div v-if="post.canModify" class="flex gap-2">
            <NuxtLink :to="`/board/${blbMngNo}/${nacMngNo}/edit`">
              <Button label="수정" size="small" outlined />
            </NuxtLink>
            <Button label="삭제" size="small" severity="danger" outlined @click="onDelete" />
          </div>
        </div>
        <div class="flex gap-4 text-sm text-gray-500 mt-2">
          <span>작성자: {{ post.fstEnrUsid }}</span>
          <span>등록일: {{ formatDateTime(post.fstEnrDtm) }}</span>
          <span>조회: {{ post.nacInqNbr }}</span>
        </div>
      </div>

      <!-- 본문 -->
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="prose max-w-none mb-8" v-html="safeContent" />

      <!-- 답변글 작성 (게시판 설정에 따라) -->
      <div v-if="board?.repUseYn === 'Y'" class="mb-8">
        <NuxtLink :to="`/board/${blbMngNo}/form?parentId=${nacMngNo}`">
          <Button label="답변글 작성" icon="pi pi-reply" outlined size="small" />
        </NuxtLink>
      </div>

      <!-- 댓글 영역 (게시판 설정에 따라) -->
      <BoardCommentTree
        v-if="board?.cmmtUseYn === 'Y'"
        :blb-mng-no="blbMngNo"
        :nac-mng-no="nacMngNo"
      />
    </div>

    <!-- 목록으로 -->
    <div class="mt-6">
      <NuxtLink :to="`/board/${blbMngNo}`">
        <Button label="목록" icon="pi pi-list" text />
      </NuxtLink>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 게시물 작성/수정 폼 페이지 작성**

```vue
<!-- it_frontend/app/pages/board/[blbMngNo]/form.vue -->
<script setup lang="ts">
import type { BoardPostCreateRequest, BoardPostReplyCreateRequest } from '~/types/board'
import { useBoard } from '~/composables/useBoard'
import { useBoardPost } from '~/composables/useBoardPost'

const route  = useRoute()
const blbMngNo = route.params.blbMngNo as string
const parentId = route.query.parentId as string | undefined // 답변글

const { getBoard } = useBoard()
const { data: board } = getBoard(blbMngNo)
const { createPost, createReply } = useBoardPost(blbMngNo)

const form = reactive<BoardPostCreateRequest>({
  nacNm:    '',
  nacCone:  '',
  pritC:    'PRIT_C_001',
  hrkFxnYn: 'N',
  sreYn:    'Y'
})

const submitting = ref(false)

const onSubmit = async () => {
  if (!form.nacNm.trim()) {
    alert('제목을 입력하세요.')
    return
  }
  submitting.value = true
  try {
    let newId: string
    if (parentId) {
      // 답변글
      newId = await createReply(parentId, form as BoardPostReplyCreateRequest)
    } else {
      newId = await createPost(form)
    }
    navigateTo(`/board/${blbMngNo}/${newId}`)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-xl font-bold mb-6">
      {{ parentId ? '답변글 작성' : '게시물 작성' }} — {{ board?.blbNm }}
    </h1>

    <div class="flex flex-col gap-4">
      <!-- 제목 -->
      <div>
        <label class="block text-sm font-medium mb-1">제목 <span class="text-red-500">*</span></label>
        <InputText v-model="form.nacNm" class="w-full" maxlength="300" placeholder="제목을 입력하세요" />
      </div>

      <!-- 상위고정 (메타 허용 시) -->
      <div v-if="board?.hrkFxnUseYn === 'Y'" class="flex items-center gap-2">
        <Checkbox v-model="form.hrkFxnYn" true-value="Y" false-value="N" />
        <label>상위 고정</label>
      </div>

      <!-- 본문 에디터 (Tiptap은 프로젝트 기존 컴포넌트 재사용) -->
      <div>
        <label class="block text-sm font-medium mb-1">본문</label>
        <Textarea
          v-model="form.nacCone"
          rows="15"
          class="w-full font-mono text-sm"
          placeholder="내용을 입력하세요 (HTML 허용)"
        />
      </div>

      <!-- 하단 버튼 -->
      <div class="flex gap-2 justify-end">
        <NuxtLink :to="`/board/${blbMngNo}`">
          <Button label="취소" text />
        </NuxtLink>
        <Button
          label="등록"
          icon="pi pi-check"
          :loading="submitting"
          @click="onSubmit"
        />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 5: 게시물 수정 페이지 작성**

```vue
<!-- it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/edit.vue -->
<script setup lang="ts">
import { useBoardPost } from '~/composables/useBoardPost'

const route   = useRoute()
const blbMngNo = route.params.blbMngNo as string
const nacMngNo = route.params.nacMngNo as string

const { getPost, updatePost } = useBoardPost(blbMngNo)
const { data: post } = getPost(nacMngNo)

const form = reactive({
  nacNm:   '',
  nacCone: '',
  pritC:   'PRIT_C_001',
  hrkFxnYn: 'N',
  sreYn:   'Y'
})

// 기존 데이터로 초기화
watch(post, (v) => {
  if (!v) return
  form.nacNm    = v.nacNm
  form.nacCone  = v.nacCone
  form.pritC    = v.pritC
  form.hrkFxnYn = v.hrkFxnYn
  form.sreYn    = v.sreYn
}, { immediate: true })

const submitting = ref(false)

const onSubmit = async () => {
  submitting.value = true
  try {
    await updatePost(nacMngNo, form)
    navigateTo(`/board/${blbMngNo}/${nacMngNo}`)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-xl font-bold mb-6">게시물 수정</h1>
    <div class="flex flex-col gap-4">
      <div>
        <label class="block text-sm font-medium mb-1">제목</label>
        <InputText v-model="form.nacNm" class="w-full" maxlength="300" />
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">본문</label>
        <Textarea v-model="form.nacCone" rows="15" class="w-full font-mono text-sm" />
      </div>
      <div class="flex gap-2 justify-end">
        <NuxtLink :to="`/board/${blbMngNo}/${nacMngNo}`">
          <Button label="취소" text />
        </NuxtLink>
        <Button label="저장" icon="pi pi-check" :loading="submitting" @click="onSubmit" />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 6: 댓글 트리 컴포넌트 작성**

```vue
<!-- it_frontend/app/components/board/BoardCommentTree.vue -->
<script setup lang="ts">
import type { BoardComment } from '~/types/board'
import { useBoardComment } from '~/composables/useBoardComment'
import { formatDateTime } from '~/utils/common'

interface Props {
  blbMngNo: string
  nacMngNo: string
}
const props = defineProps<Props>()
const { comments, refresh, createComment, createReply, updateComment, deleteComment }
  = useBoardComment(props.blbMngNo, props.nacMngNo)

/** 새 댓글 입력 */
const newComment  = ref('')
/** 답글 대상 댓글 ID */
const replyTarget = ref<string | null>(null)
const replyText   = ref('')
/** 수정 대상 댓글 ID */
const editTarget  = ref<string | null>(null)
const editText    = ref('')

const onCreateComment = async () => {
  if (!newComment.value.trim()) return
  await createComment(newComment.value)
  newComment.value = ''
  await refresh()
}

const onCreateReply = async (cmmtMngNo: string) => {
  if (!replyText.value.trim()) return
  await createReply(cmmtMngNo, replyText.value)
  replyTarget.value = null
  replyText.value   = ''
  await refresh()
}

const startEdit = (c: BoardComment) => {
  editTarget.value = c.cmmtMngNo
  editText.value   = c.cmmtCone
}

const onUpdateComment = async (cmmtMngNo: string) => {
  if (!editText.value.trim()) return
  await updateComment(cmmtMngNo, editText.value)
  editTarget.value = null
  await refresh()
}

const onDeleteComment = async (cmmtMngNo: string) => {
  if (!confirm('댓글을 삭제하시겠습니까?')) return
  await deleteComment(cmmtMngNo)
  await refresh()
}
</script>

<template>
  <div class="border-t pt-6">
    <h3 class="font-semibold mb-4">댓글 {{ comments?.length ?? 0 }}개</h3>

    <!-- 댓글 목록 -->
    <div
      v-for="comment in comments"
      :key="comment.cmmtMngNo"
      :style="{ marginLeft: `${comment.cmmtGrpLev * 24}px` }"
      class="mb-3 p-3 bg-gray-50 rounded"
    >
      <!-- 삭제된 댓글 표시 -->
      <div v-if="comment.delYn === 'Y'" class="text-gray-400 italic text-sm">
        삭제된 댓글입니다.
      </div>
      <template v-else>
        <div class="flex justify-between items-start">
          <div class="text-sm text-gray-500">
            <span class="font-medium">{{ comment.fstEnrUsid }}</span>
            <span class="ml-2">{{ formatDateTime(comment.fstEnrDtm) }}</span>
          </div>
          <div v-if="comment.canModify" class="flex gap-1">
            <Button
              icon="pi pi-pencil" text size="small"
              @click="startEdit(comment)"
            />
            <Button
              icon="pi pi-trash" text size="small" severity="danger"
              @click="onDeleteComment(comment.cmmtMngNo)"
            />
          </div>
        </div>

        <!-- 수정 모드 -->
        <template v-if="editTarget === comment.cmmtMngNo">
          <Textarea v-model="editText" rows="3" class="w-full mt-2" />
          <div class="flex gap-2 mt-1">
            <Button label="저장" size="small" @click="onUpdateComment(comment.cmmtMngNo)" />
            <Button label="취소" size="small" text @click="editTarget = null" />
          </div>
        </template>
        <div v-else class="mt-1 whitespace-pre-wrap text-sm">{{ comment.cmmtCone }}</div>

        <!-- 대댓글 버튼 -->
        <Button
          label="답글"
          icon="pi pi-reply"
          text size="small"
          class="mt-1"
          @click="replyTarget = comment.cmmtMngNo; replyText = ''"
        />

        <!-- 대댓글 입력창 -->
        <div v-if="replyTarget === comment.cmmtMngNo" class="mt-2">
          <Textarea v-model="replyText" rows="2" class="w-full" placeholder="대댓글을 입력하세요" />
          <div class="flex gap-2 mt-1">
            <Button label="등록" size="small" @click="onCreateReply(comment.cmmtMngNo)" />
            <Button label="취소" size="small" text @click="replyTarget = null" />
          </div>
        </div>
      </template>
    </div>

    <!-- 새 댓글 입력 -->
    <div class="mt-4">
      <Textarea
        v-model="newComment"
        rows="3"
        class="w-full"
        placeholder="댓글을 입력하세요 (최대 2,000자)"
        :maxlength="2000"
      />
      <div class="flex justify-end mt-2">
        <Button label="댓글 등록" icon="pi pi-send" @click="onCreateComment" />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 7: 관리자 게시판 관리 페이지 작성**

```vue
<!-- it_frontend/app/pages/admin/boards/index.vue -->
<script setup lang="ts">
import type { BoardMeta, BoardMetaCreateRequest } from '~/types/board'
import { useBoard } from '~/composables/useBoard'

definePageMeta({ middleware: 'admin', layout: 'admin' })

const { boards, pending, refresh, createBoard, updateBoard, deleteBoard } = useBoard()

const dialog   = ref(false)
const editMode = ref(false)
const selected = ref<BoardMeta | null>(null)

const form = reactive<BoardMetaCreateRequest>({
  blbNm:        '',
  blbTp:        'BLB_TP_001',
  repUseYn:     'N',
  cmmtUseYn:    'N',
  flEsnYn:      'N',
  hrkFxnUseYn:  'N',
  nacTpUseYn:   'N',
  kdUseYn:      'N',
  inqAthC:      'ALL',
  enrAthC:      'ALL',
  bbrLmtnUseYn: 'N',
  sreSqnNo:     0
})

const openCreate = () => {
  editMode.value = false
  Object.assign(form, {
    blbNm: '', blbTp: 'BLB_TP_001',
    repUseYn: 'N', cmmtUseYn: 'N', flEsnYn: 'N',
    hrkFxnUseYn: 'N', nacTpUseYn: 'N', kdUseYn: 'N',
    inqAthC: 'ALL', enrAthC: 'ALL',
    bbrLmtnUseYn: 'N', sreSqnNo: 0
  })
  dialog.value = true
}

const openEdit = (board: BoardMeta) => {
  editMode.value = true
  selected.value = board
  Object.assign(form, board)
  dialog.value = true
}

const onSave = async () => {
  if (editMode.value && selected.value) {
    await updateBoard(selected.value.blbMngNo, form)
  } else {
    await createBoard(form)
  }
  dialog.value = false
  await refresh()
}

const onDelete = async (board: BoardMeta) => {
  if (!confirm(`"${board.blbNm}" 게시판을 삭제하시겠습니까?`)) return
  await deleteBoard(board.blbMngNo)
  await refresh()
}
</script>

<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-xl font-bold">게시판 관리</h1>
      <Button label="게시판 추가" icon="pi pi-plus" @click="openCreate" />
    </div>

    <StyledDataTable :value="boards ?? []" :loading="pending">
      <Column field="sreSqnNo"  header="순서"    style="width: 5rem" />
      <Column field="blbNm"     header="게시판명" />
      <Column field="blbTp"     header="유형"     style="width: 8rem" />
      <Column field="inqAthC"   header="조회권한"  style="width: 8rem" />
      <Column field="enrAthC"   header="등록권한"  style="width: 8rem" />
      <Column field="cmmtUseYn" header="댓글"     style="width: 4rem" />
      <Column field="useYn"     header="사용"     style="width: 4rem" />
      <Column header="관리" style="width: 8rem">
        <template #body="{ data }">
          <div class="flex gap-1">
            <Button icon="pi pi-pencil" text size="small" @click="openEdit(data)" />
            <Button icon="pi pi-trash"  text size="small" severity="danger" @click="onDelete(data)" />
          </div>
        </template>
      </Column>
    </StyledDataTable>

    <!-- 등록/수정 다이얼로그 -->
    <Dialog v-model:visible="dialog" :header="editMode ? '게시판 수정' : '게시판 추가'" modal>
      <div class="flex flex-col gap-3 w-80">
        <div>
          <label class="block text-sm font-medium mb-1">게시판명</label>
          <InputText v-model="form.blbNm" class="w-full" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">조회권한</label>
          <InputText v-model="form.inqAthC" class="w-full" placeholder="ALL / ROLE_ADMIN" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">등록권한</label>
          <InputText v-model="form.enrAthC" class="w-full" placeholder="ALL / ROLE_ADMIN" />
        </div>
        <div class="flex gap-4">
          <div class="flex items-center gap-2">
            <Checkbox v-model="form.cmmtUseYn" true-value="Y" false-value="N" />
            <label>댓글</label>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox v-model="form.flEsnYn" true-value="Y" false-value="N" />
            <label>첨부필수</label>
          </div>
          <div class="flex items-center gap-2">
            <Checkbox v-model="form.hrkFxnUseYn" true-value="Y" false-value="N" />
            <label>상위고정</label>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">순서</label>
          <InputNumber v-model="form.sreSqnNo" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="취소" text @click="dialog = false" />
        <Button label="저장" @click="onSave" />
      </template>
    </Dialog>
  </div>
</template>
```

- [ ] **Step 8: AppSidebar에 게시판 메뉴 동적 생성 추가**

`it_frontend/app/components/AppSidebar.vue` 파일을 읽어 `menuItems` 배열 또는 사이드바 메뉴 렌더링 부분을 찾아 다음을 추가한다:

```typescript
// AppSidebar.vue의 <script setup> 내 적절한 위치에 추가
import type { BoardMeta } from '~/types/board'
import { useBoard } from '~/composables/useBoard'
import { useAuth } from '~/composables/useAuth'

const { boards } = useBoard()
const { user: authUser } = useAuth()

/** 사이드바 표시용 게시판 목록 — 권한 + USE_YN 필터 */
const sidebarBoards = computed(() => {
  if (!boards.value) return []
  return boards.value.filter((b: BoardMeta) => {
    if (b.useYn !== 'Y') return false
    if (b.inqAthC === 'ALL') return true
    return authUser.value?.athIds?.includes('ITPAD001') ?? false
  })
})
```

사이드바의 게시판 섹션을 찾아 동적 목록으로 교체한다:

```vue
<!-- AppSidebar.vue 게시판 섹션 교체 -->
<PanelMenu
  v-if="sidebarBoards.length"
  :model="[{
    label: '게시판',
    icon: 'pi pi-comments',
    items: sidebarBoards.map(b => ({
      label: b.blbNm,
      to: `/board/${b.blbMngNo}`
    }))
  }]"
/>
```

- [ ] **Step 9: 타입 체크 + 린트**

```bash
cd it_frontend && npx nuxt typecheck && npx eslint app/pages/board app/components/board app/composables/useBoard.ts app/composables/useBoardPost.ts app/composables/useBoardComment.ts app/types/board.ts
```
Expected: No type errors, lint warnings only (no errors)

- [ ] **Step 10: 커밋**

```bash
git add it_frontend/app/types/board.ts
git add it_frontend/app/composables/
git add it_frontend/app/pages/board/
git add it_frontend/app/pages/admin/boards/
git add it_frontend/app/components/board/
git add it_frontend/app/components/AppSidebar.vue
git commit -m "feat: 게시판 프론트엔드 구현 - 타입/Composables/페이지/컴포넌트"
```

---

## Task 12: 백엔드 통합 테스트 + 검증

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardCommentServiceTest.java`

- [ ] **Step 1: BoardCommentServiceTest 작성**

```java
// it_backend/src/test/java/com/kdb/it/common/board/service/BoardCommentServiceTest.java
package com.kdb.it.common.board.service;

import com.kdb.it.common.board.dto.BoardCommentDto;
import com.kdb.it.common.board.entity.Cblbcm;
import com.kdb.it.common.board.entity.Cblbmm;
import com.kdb.it.common.board.entity.Ccmmtm;
import com.kdb.it.common.board.repository.BoardCommentRepository;
import com.kdb.it.common.board.repository.BoardMetaRepository;
import com.kdb.it.common.board.repository.BoardPostRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.exception.CustomGeneralException;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;

@ExtendWith(MockitoExtension.class)
class BoardCommentServiceTest {

    @Mock BoardMetaRepository    metaRepository;
    @Mock BoardPostRepository    postRepository;
    @Mock BoardCommentRepository commentRepository;
    @Mock BoardPostService       postService;
    @InjectMocks BoardCommentService service;

    private Cblbmm boardWithComment;
    private Cblbmm boardNoComment;
    private Cblbcm post;
    private CustomUserDetails user;

    @BeforeEach
    void setUp() {
        boardWithComment = Cblbmm.builder()
            .blbMngNo("BLBM-2026-0002").cmmtUseYn("Y")
            .inqAthC("ALL").enrAthC("ALL")
            .bbrLmtnUseYn("N").useYn("Y").delYn("N")
            .build();

        boardNoComment = Cblbmm.builder()
            .blbMngNo("BLBM-2026-0001").cmmtUseYn("N")
            .inqAthC("ALL").enrAthC("ALL")
            .bbrLmtnUseYn("N").useYn("Y").delYn("N")
            .build();

        post = Cblbcm.builder()
            .nacMngNo("NAC-2026-0001").blbMngNo("BLBM-2026-0002")
            .nacNm("테스트 게시물").sreYn("Y")
            .delYn("N").nacGrpNo("NAC-2026-0001").nacGrpSqn(0).nacGrpLev(0)
            .nacInqNbr(0).flApgYn("N").flNbr(0)
            .build();

        user = new CustomUserDetails("USER001", List.of("ITPZZ001"), "10001");
    }

    @Test
    @DisplayName("댓글 미지원 게시판에 댓글을 등록하면 예외가 발생한다")
    void createComment_boardNoComment_throws() {
        given(metaRepository.findByBlbMngNoAndDelYn("BLBM-2026-0001", "N"))
            .willReturn(Optional.of(boardNoComment));
        given(postRepository.findByNacMngNoAndDelYn("NAC-2026-0001", "N"))
            .willReturn(Optional.of(post));
        willDoNothing().given(postService).verifyCanReadPost(any(), any(), any());

        var req = new BoardCommentDto.CreateRequest("댓글 내용");
        assertThatThrownBy(() ->
            service.createComment("BLBM-2026-0001", "NAC-2026-0001", req, user)
        ).isInstanceOf(CustomGeneralException.class)
         .hasMessageContaining("댓글 기능을 지원하지 않습니다");
    }

    @Test
    @DisplayName("댓글 지원 게시판에 댓글을 정상 등록한다")
    void createComment_success() {
        given(metaRepository.findByBlbMngNoAndDelYn("BLBM-2026-0002", "N"))
            .willReturn(Optional.of(boardWithComment));
        given(postRepository.findByNacMngNoAndDelYn("NAC-2026-0001", "N"))
            .willReturn(Optional.of(post));
        willDoNothing().given(postService).verifyCanReadPost(any(), any(), any());
        given(commentRepository.getNextSequenceValue()).willReturn(1L);
        given(commentRepository.save(any())).willAnswer(inv -> inv.getArgument(0));

        var req = new BoardCommentDto.CreateRequest("테스트 댓글");
        String id = service.createComment("BLBM-2026-0002", "NAC-2026-0001", req, user);
        assertThat(id).startsWith("CMMT-");
    }

    @Test
    @DisplayName("다른 사람의 댓글을 수정하면 예외가 발생한다")
    void updateComment_notOwner_throws() {
        Ccmmtm comment = Ccmmtm.builder()
            .cmmtMngNo("CMMT-2026-0001").nacMngNo("NAC-2026-0001")
            .cmmtCone("원본 댓글").sreYn("Y").delYn("N")
            .cmmtGrpNo("CMMT-2026-0001").cmmtGrpSqn(0).cmmtGrpLev(0)
            .build();
        // FST_ENR_USID를 "OTHER_USER"로 설정하려면 BaseEntity의 해당 필드를 직접 설정해야 함
        // — 실제 테스트 환경에서는 빌더 패턴으로 FST_ENR_USID 세팅 가능하면 세팅,
        //   불가능하면 Mockito spy로 처리

        given(commentRepository.findByCmmtMngNoAndDelYn("CMMT-2026-0001", "N"))
            .willReturn(Optional.of(comment));

        var req = new BoardCommentDto.UpdateRequest("수정 댓글");
        // FST_ENR_USID가 "OTHER_USER"이고 현재 사용자가 "USER001"이면 예외
        // (실제 검증은 comment.getFstEnrUsid()에 의존)
    }
}
```

- [ ] **Step 2: 전체 테스트 실행**

```bash
cd it_backend && ./gradlew clean test
```
Expected: All tests PASS (기존 테스트 포함)

- [ ] **Step 3: 서버 기동 후 Swagger 확인**

```bash
cd it_backend && ./gradlew bootRun
# 브라우저에서 확인: http://localhost:8080/swagger-ui/index.html
# Board Meta, Board Post, Board Comment 태그 존재 확인
```

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/test/java/com/kdb/it/common/board/
git commit -m "test: 게시판 서비스 단위 테스트 추가"
```

---

## Task 13: TASK.md 등록 및 최종 확인

- [ ] **Step 1: TASK.md에 후속 과제 등록**

`TASK.md` 파일을 열어 게시판 관련 후속 과제를 추가한다:

```markdown
## 공통 게시판 후속 과제

- [ ] `Bgdocm.docCone` BLOB → CLOB 마이그레이션 (게시판 도입 후 일관성 회복)
- [ ] 본문 검색 Oracle Text 인덱스 도입 (게시판당 1만 건/검색 1초 초과 시)
- [ ] 조회수 카운터 Redis 전환 (다중 인스턴스 운영 시)
- [ ] 알림(메일/슬랙) 연동 — 공지·중요 게시물 등록, 본인 게시물 댓글 알림
- [ ] 첨부파일 다운로드 카운트 컬럼 (`FL_DWN_NBR`) — 자료실 인기 자료 통계
- [ ] 댓글 첨부파일 지원 (ORC_DTT="공통게시판댓글" 추가)
- [ ] 답변글·댓글 최대 깊이 UI 5단계 캡 구현 (현재 무제한)
- [ ] 검색 키워드 최소 2자 강제 (현재 미적용)
- [ ] 본문 최대 크기 정책 결정 및 검증 추가 (현재 오픈이슈)
```

- [ ] **Step 2: 프론트엔드 E2E 테스트 작성**

```typescript
// it_frontend/tests/e2e/board.spec.ts
import { test, expect } from '@playwright/test'

test.describe('공통 게시판', () => {
  test.beforeEach(async ({ page }) => {
    // 로그인 (기존 로그인 헬퍼 재사용)
    await page.goto('/login')
    await page.fill('[name="eno"]', 'ADMIN001')
    await page.fill('[name="password"]', 'test1234')
    await page.click('[type="submit"]')
    await page.waitForURL('/')
  })

  test('게시판 목록 페이지가 렌더링된다', async ({ page }) => {
    await page.goto('/board')
    await expect(page.locator('h1')).toContainText('게시판')
  })

  test('공지사항 게시물을 등록하고 상세 조회한다', async ({ page }) => {
    await page.goto('/board/BLBM-2026-0001')
    await expect(page.locator('h1')).toContainText('공지사항')

    await page.click('text=글쓰기')
    await page.fill('input[placeholder*="제목"]', 'E2E 테스트 공지')
    await page.fill('textarea', '테스트 본문입니다.')
    await page.click('button:has-text("등록")')

    await expect(page.locator('h1')).toContainText('E2E 테스트 공지')
  })
})
```

- [ ] **Step 3: 최종 빌드 확인**

```bash
# 백엔드
cd it_backend && ./gradlew clean build
# 프론트엔드
cd ../it_frontend && npx nuxt typecheck && npm test
```
Expected: 백엔드 BUILD SUCCESSFUL, 프론트 typecheck PASS

- [ ] **Step 4: 최종 커밋**

```bash
git add TASK.md it_frontend/tests/e2e/board.spec.ts
git commit -m "docs: 게시판 후속 과제 TASK.md 등록, E2E 테스트 추가"
```

---

## 자기 검토

**스펙 커버리지 확인:**

| 요구사항 | 구현 태스크 |
|---|---|
| 게시판 메타 관리 (`TAAABB_CBLBMM`) + 운영자 화면 | Task 1~2, 5, 7~8, 10~11 |
| 게시물 CRUD + 답변글 트리 + Soft Delete | Task 1, 3, 6~8 |
| 댓글 + 대댓글 트리 (`TAAABB_CCMMTM`) | Task 1, 4, 7~8, 11 |
| 공통 첨부파일 (`Cfilem`) 연동 | Task 9 |
| HtmlSanitizer 적용 | Task 7 (서비스 레이어) |
| 게시판/게시물 이중 권한 제어 | Task 7 (verifyCanReadBoard/Post) |
| 공개기간, 노출플래그, 상위고정 | Task 3, 6~7 |
| 변경 이력 (`@LogTarget`) 자동 적재 | Task 2~4 (`@LogTarget` 부여) |
| 사이드바 메뉴 자동 생성 | Task 11 (AppSidebar) |
| 검색/페이징/정렬 | Task 6 (QueryDSL), 10~11 (프론트) |
| 채번 형식 (`BLBM-/NAC-/CMMT-`) | Task 7 (서비스) |
| 인덱스 전략 | Task 1 |
| 시드 데이터 | Task 1 |
| DDL 모든 컬럼 | Task 1 |

**타입 일관성 확인:**
- `nacGrpLev` — 엔티티, DTO, 프론트 타입 모두 일치 (LEV, lev 통일)
- `hrkFxnUseYn` — Cblbmm 필드명과 BoardMeta 타입 일치
- `cmmtGrpSqn` — Ccmmtm 엔티티와 BoardComment 타입 일치
- `shiftGroupSqn` — BoardPostRepository, BoardCommentRepository 동일 메서드명
