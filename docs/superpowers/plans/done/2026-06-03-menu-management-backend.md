# Menu Management — Backend + Database Implementation Plan (Plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the DB schema, JPA entities, repositories, services, and REST API that move the sidebar menu tree out of hardcoded `AppSidebar.vue` and into Oracle, so a system admin can change order/label/role/hidden without a deploy.

**Architecture:** Four Oracle tables in the `MENU` domain — `TPRMPP_CMENUD` (route catalog), `TPRMPP_CMENUM` (menu master, audit-logged), `TPRMPP_CMENUA` (menu↔role mapping), `TPRMPP_CMENUL` (change-log snapshot). A read API (`/api/menus`) builds a role-filtered tree; an admin API (`/api/admin/menus`, `/api/admin/routes`) does CRUD + reorder + move with materialized-path recalculation. Backend is the single authority for permission filtering. Icon/badge/dynamic-source are NOT columns (handled by the frontend in Plan 2).

**Tech Stack:** Spring Boot 4.0.5, Java 25, Spring Data JPA + QueryDSL 5.1.0, Oracle (ITPAPP@XEPDB1), JUnit 5 + Mockito + AssertJ.

---

## Source spec

`docs/superpowers/specs/2026-05-30-menu-management-design.md` (read it first). This plan implements §3 (data model), §4 (backend API), §6 (migration/seed). Frontend (§5) is Plan 2.

## Critical environment facts (verified) — read before starting

1. **No Flyway. `spring.jpa.hibernate.ddl-auto=validate`.** Schema changes are applied by **manually running SQL** against Oracle via sqlplus. `validate` means **every `@Entity` must match its table exactly or the app fails to boot.** Therefore: write + run the DDL FIRST, then write entities, then boot to validate.
2. **Migration files live in `it_database/migrations/`** named `V{YYYYMMDD}_{NNN}__{PascalCaseDesc}.sql` (next number: `V20260603_007__...`). They are **not auto-applied** — you run them by hand.
3. **Audit-log PK sequence MUST be `SEQ_CMENUL`** (the `@AuditLogId` generator runs `SELECT SEQ_CMENUL.NEXTVAL`). Do **not** name it `S_CMENUL` (the existing `S_*` sequences are a known latent bug, tracked separately).
4. **`@SpringBootTest` does NOT connect to a DB** in this project (`application-test.properties` excludes DataSource/JPA auto-config). All automated backend tests in this plan are **Mockito service unit tests** runnable via `./gradlew test` with no DB. DB-dependent behavior (FK, validate, audit insert) is verified manually via `bootRun` + Swagger/curl.
5. **No `@ManyToOne`/`@JoinColumn` anywhere.** FK relationships are plain `@Column` String fields; referential integrity is enforced in the service layer. (DB-level FK/CHECK constraints in the DDL are allowed as additive safety — `validate` ignores them.)
6. **All masters extend `BaseEntity`** (which already wires `ChangeLogEntityListener`). To enable logging you add `@LogTarget(entity = XxxL.class)` to the master — you do NOT add `@EntityListeners` yourself.
7. **`BaseEntity` columns on every table:** `DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID`. **`BaseLogEntity` adds:** `LOG_HIS_TGR_SNO (PK), CHG_DTT_YN, CHG_DTM, CHG_USID` + the same 7 snapshot columns.
8. **DB connect for manual SQL:** `sqlplus ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1` (or SQLcl `sql`).

## File structure (what this plan creates)

```
it_database/migrations/
  V20260603_007__CreateMenuTables.sql        ★ DDL: 4 tables + indexes + sequences
  V20260603_008__SeedRouteCatalogAndMenuTree.sql  ★ DML seed (MERGE INTO)

it_backend/src/main/resources/sql/
  audit_log_sequences_ddl.sql                ◇ append SEQ_CMENUL

it_backend/src/main/java/com/kdb/it/domain/menu/
  entity/Cmenud.java                         ★ route catalog (PK SRE_PTH)
  entity/Cmenum.java                         ★ menu master (@LogTarget)
  entity/Cmenua.java   entity/CmenuaId.java  ★ menu↔role (@IdClass)
  repository/CmenudRepository.java
  repository/CmenumRepository.java  +Custom +Impl
  repository/CmenuaRepository.java
  dto/MenuDto.java                           ★ all nested request/response DTOs
  service/MenuQueryService.java              ★ tree build + role filter
  service/AdminMenuService.java              ★ CRUD + reorder + move + path recalc
  service/AdminRouteService.java
  controller/MenuQueryController.java
  controller/AdminMenuController.java
  controller/AdminRouteController.java
it_backend/src/main/java/com/kdb/it/domain/log/entity/
  CmenumL.java                               ★ log snapshot of Cmenum

it_backend/src/test/java/com/kdb/it/domain/menu/service/
  AdminMenuServiceTest.java                  ★ Mockito unit tests (path recalc, depth, cycle, delete)
  MenuQueryServiceTest.java                  ★ Mockito unit tests (tree build, role filter, prune)
  AdminRouteServiceTest.java                 ★ Mockito unit tests (path validation, duplicate)
```

> **Scope note — DYN board children:** The single `MNU_TP_C='DYN'` node (`MBRD0001`) returns empty children in Plan 1; the board-permission resolver is wired in Plan 2 (frontend cutover), where the sidebar actually switches to DB data and board integration is verified end-to-end. Until then the old hardcoded sidebar keeps rendering boards, so there is no regression. `MenuQueryService` exposes a `MenuChildrenResolver` SPI + empty `DYN_RESOLVERS` so Plan 2 only adds the adapter.

---

## Task 1: DDL migration — create the four tables + sequences

**Files:**
- Create: `it_database/migrations/V20260603_007__CreateMenuTables.sql`
- Reference (read for exact BaseEntity/BaseLogEntity column types): `it_database/migrations/ITPAPP_DDL_live.sql`

- [ ] **Step 1: Confirm BaseEntity/BaseLogEntity column types from the live schema**

Because `ddl-auto=validate` requires exact type matches, copy the audit-column types from an existing working pair rather than guessing. Run:

```bash
cd "C:/it"
grep -iE "FST_ENR_DTM|LST_CHG_DTM|GUID_PRG_SNO|GUID |DEL_YN|CHG_DTM|CHG_DTT_YN|CHG_USID|LOG_HIS_TGR_SNO" it_database/migrations/ITPAPP_DDL_live.sql | head -40
```

Expected: see how `TPRMPP_CAPPLM` (master) and `TPRMPP_CAPPLL` (log) declare these columns (DATE vs TIMESTAMP, NUMBER precision). Use those exact types in Step 2. If the dump shows `FST_ENR_DTM DATE` and the log's `CHG_DTM TIMESTAMP(6)`, mirror that.

- [ ] **Step 2: Write the DDL script**

Create `it_database/migrations/V20260603_007__CreateMenuTables.sql`. Adjust DATE/TIMESTAMP/NUMBER types in the BaseEntity/BaseLogEntity blocks to match what Step 1 showed (the values below assume `DATE` for audit datetimes and `TIMESTAMP(6)` for `CHG_DTM`):

```sql
-- 메뉴 관리 4개 테이블 (공통화면상세/메뉴기본/메뉴권한연결/메뉴로그)
-- 수동 실행: sqlplus ITPAPP/****@127.0.0.1:1521/XEPDB1 @V20260603_007__CreateMenuTables.sql
-- ddl-auto=validate 이므로 엔티티 작성 전 본 스크립트를 먼저 실행해야 부팅 검증을 통과한다.

-- 1) 공통화면상세 — 라우트 카탈로그
CREATE TABLE TPRMPP_CMENUD (
  SRE_PTH       VARCHAR2(300 CHAR) NOT NULL,
  SRE_MNU_NM    VARCHAR2(100 CHAR) NOT NULL,
  SRE_TC        VARCHAR2(2 CHAR),
  USE_YN        VARCHAR2(1 CHAR)   DEFAULT 'Y' NOT NULL,
  RMK           VARCHAR2(300 CHAR),
  DEL_YN        VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
  GUID          VARCHAR2(38 CHAR),
  GUID_PRG_SNO  NUMBER(4,0),
  FST_ENR_DTM   DATE,
  FST_ENR_USID  VARCHAR2(14 CHAR),
  LST_CHG_DTM   DATE,
  LST_CHG_USID  VARCHAR2(14 CHAR),
  CONSTRAINT PK_TPRMPP_CMENUD PRIMARY KEY (SRE_PTH),
  CONSTRAINT CK_CMENUD_USE_YN CHECK (USE_YN IN ('Y','N'))
);
COMMENT ON TABLE  TPRMPP_CMENUD            IS '공통화면상세 — 라우트 카탈로그';
COMMENT ON COLUMN TPRMPP_CMENUD.SRE_PTH    IS '화면경로';
COMMENT ON COLUMN TPRMPP_CMENUD.SRE_MNU_NM IS '화면메뉴명';
COMMENT ON COLUMN TPRMPP_CMENUD.SRE_TC     IS '화면구분코드';
COMMENT ON COLUMN TPRMPP_CMENUD.USE_YN     IS '사용여부';

-- 2) 공통메뉴기본 — 메뉴 마스터
CREATE TABLE TPRMPP_CMENUM (
  MNU_ID          VARCHAR2(10 CHAR)  NOT NULL,
  HRK_MNU_ID      VARCHAR2(10 CHAR),
  SRE_TC          VARCHAR2(2 CHAR)   NOT NULL,
  MNU_NM          VARCHAR2(100 CHAR) NOT NULL,
  MNU_TP_C        VARCHAR2(3 CHAR)   NOT NULL,
  SRE_PTH         VARCHAR2(300 CHAR),
  MNU_SOT_SQN_SNO NUMBER(9,0)        NOT NULL,
  HID_YN          VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
  MNU_DEP         NUMBER(3,0)        NOT NULL,
  WHL_MNU_PTH     VARCHAR2(500 CHAR) NOT NULL,
  DEL_YN          VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
  GUID            VARCHAR2(38 CHAR),
  GUID_PRG_SNO    NUMBER(4,0),
  FST_ENR_DTM     DATE,
  FST_ENR_USID    VARCHAR2(14 CHAR),
  LST_CHG_DTM     DATE,
  LST_CHG_USID    VARCHAR2(14 CHAR),
  CONSTRAINT PK_TPRMPP_CMENUM PRIMARY KEY (MNU_ID),
  CONSTRAINT CK_CMENUM_TP   CHECK (MNU_TP_C IN ('LNK','GRP','DYN')),
  CONSTRAINT CK_CMENUM_HID  CHECK (HID_YN IN ('Y','N')),
  CONSTRAINT CK_CMENUM_DEP  CHECK (MNU_DEP BETWEEN 1 AND 3),
  CONSTRAINT FK_CMENUM_SRE  FOREIGN KEY (SRE_PTH) REFERENCES TPRMPP_CMENUD (SRE_PTH)
);
COMMENT ON TABLE  TPRMPP_CMENUM             IS '공통메뉴기본 — 메뉴 마스터';
COMMENT ON COLUMN TPRMPP_CMENUM.MNU_ID      IS '메뉴ID';
COMMENT ON COLUMN TPRMPP_CMENUM.HRK_MNU_ID  IS '상위메뉴ID';
COMMENT ON COLUMN TPRMPP_CMENUM.SRE_TC      IS '화면구분코드';
COMMENT ON COLUMN TPRMPP_CMENUM.MNU_NM      IS '메뉴명';
COMMENT ON COLUMN TPRMPP_CMENUM.MNU_TP_C    IS '메뉴유형코드';
COMMENT ON COLUMN TPRMPP_CMENUM.SRE_PTH     IS '화면경로';
COMMENT ON COLUMN TPRMPP_CMENUM.MNU_SOT_SQN_SNO IS '메뉴정렬순서일련번호';
COMMENT ON COLUMN TPRMPP_CMENUM.HID_YN      IS '숨김여부';
COMMENT ON COLUMN TPRMPP_CMENUM.MNU_DEP     IS '메뉴깊이';
COMMENT ON COLUMN TPRMPP_CMENUM.WHL_MNU_PTH IS '전체메뉴경로';

CREATE INDEX IDX_CMENUM_TREE ON TPRMPP_CMENUM (SRE_TC, HRK_MNU_ID, MNU_SOT_SQN_SNO);
CREATE INDEX IDX_CMENUM_PTH  ON TPRMPP_CMENUM (SRE_PTH);
CREATE INDEX IDX_CMENUM_WHL  ON TPRMPP_CMENUM (WHL_MNU_PTH);

-- 3) 공통메뉴권한연결 — 메뉴↔권한
CREATE TABLE TPRMPP_CMENUA (
  MNU_ID        VARCHAR2(10 CHAR) NOT NULL,
  ATH_ID        VARCHAR2(32 CHAR) NOT NULL,
  DEL_YN        VARCHAR2(1 CHAR)  DEFAULT 'N' NOT NULL,
  GUID          VARCHAR2(38 CHAR),
  GUID_PRG_SNO  NUMBER(4,0),
  FST_ENR_DTM   DATE,
  FST_ENR_USID  VARCHAR2(14 CHAR),
  LST_CHG_DTM   DATE,
  LST_CHG_USID  VARCHAR2(14 CHAR),
  CONSTRAINT PK_TPRMPP_CMENUA PRIMARY KEY (MNU_ID, ATH_ID)
);
COMMENT ON TABLE  TPRMPP_CMENUA        IS '공통메뉴권한연결 — 메뉴↔권한';
COMMENT ON COLUMN TPRMPP_CMENUA.MNU_ID IS '메뉴ID';
COMMENT ON COLUMN TPRMPP_CMENUA.ATH_ID IS '권한ID';

-- 4) 공통메뉴로그 — 변경 스냅샷 (BaseLogEntity)
CREATE TABLE TPRMPP_CMENUL (
  LOG_HIS_TGR_SNO NUMBER(18,0)       NOT NULL,
  CHG_DTT_YN      VARCHAR2(1 CHAR),
  CHG_DTM         TIMESTAMP(6),
  CHG_USID        VARCHAR2(14 CHAR),
  DEL_YN          VARCHAR2(1 CHAR),
  GUID            VARCHAR2(38 CHAR),
  GUID_PRG_SNO    NUMBER(4,0),
  FST_ENR_DTM     DATE,
  FST_ENR_USID    VARCHAR2(14 CHAR),
  LST_CHG_DTM     DATE,
  LST_CHG_USID    VARCHAR2(14 CHAR),
  MNU_ID          VARCHAR2(10 CHAR),
  HRK_MNU_ID      VARCHAR2(10 CHAR),
  SRE_TC          VARCHAR2(2 CHAR),
  MNU_NM          VARCHAR2(100 CHAR),
  MNU_TP_C        VARCHAR2(3 CHAR),
  SRE_PTH         VARCHAR2(300 CHAR),
  MNU_SOT_SQN_SNO NUMBER(9,0),
  HID_YN          VARCHAR2(1 CHAR),
  MNU_DEP         NUMBER(3,0),
  WHL_MNU_PTH     VARCHAR2(500 CHAR),
  CONSTRAINT PK_TPRMPP_CMENUL PRIMARY KEY (LOG_HIS_TGR_SNO)
);
COMMENT ON TABLE TPRMPP_CMENUL IS '공통메뉴로그 — 변경 스냅샷';

-- 5) 시퀀스
--   메뉴ID 채번용 (마스터 컨벤션 SEQ_*)
CREATE SEQUENCE SEQ_CMENUM START WITH 1000 INCREMENT BY 1 NOCACHE NOCYCLE;
--   로그 PK 채번용 — AuditLogIdGenerator가 SEQ_CMENUL.NEXTVAL을 호출하므로 반드시 이 이름
CREATE SEQUENCE SEQ_CMENUL START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
```

- [ ] **Step 3: Append the log sequence to the canonical sequence DDL too**

Edit `it_backend/src/main/resources/sql/audit_log_sequences_ddl.sql`, add at the end:

```sql
-- 메뉴 변경 로그 (TPRMPP_CMENUL) — AuditLogIdGenerator는 SEQ_ 접두사를 호출함(기존 S_* 불일치는 별도 추적)
CREATE SEQUENCE SEQ_CMENUL
    START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
```

- [ ] **Step 4: Commit**

```bash
git add it_database/migrations/V20260603_007__CreateMenuTables.sql it_backend/src/main/resources/sql/audit_log_sequences_ddl.sql
git commit -m "feat(menu): add DDL for menu management tables and sequences"
```

---

## Task 2: Apply the DDL to the local Oracle DB

**Files:** none (DB operation)

- [ ] **Step 1: Run the DDL**

```bash
sqlplus ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1 @C:/it/it_database/migrations/V20260603_007__CreateMenuTables.sql
```
Expected: `Table created.` ×4, `Sequence created.` ×2 (no ORA errors).

- [ ] **Step 2: Verify the tables exist**

```bash
echo "SELECT table_name FROM user_tables WHERE table_name LIKE 'TPRMPP_CMENU%' ORDER BY 1;" | sqlplus -S ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1
```
Expected rows: `TPRMPP_CMENUA`, `TPRMPP_CMENUD`, `TPRMPP_CMENUL`, `TPRMPP_CMENUM`.

> No commit — this is a DB state change, not a file change.

---

## Task 3: `Cmenud` entity + repository (route catalog)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/entity/Cmenud.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenudRepository.java`

- [ ] **Step 1: Write the entity**

```java
package com.kdb.it.domain.menu.entity;

import com.kdb.it.domain.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/** 공통화면상세(라우트 카탈로그). PK는 화면경로(SRE_PTH). */
@Entity
@Table(name = "TPRMPP_CMENUD", comment = "공통화면상세 — 라우트 카탈로그")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Cmenud extends BaseEntity {

    @Id
    @Column(name = "SRE_PTH", length = 300, nullable = false, comment = "화면경로")
    private String srePth;

    @Column(name = "SRE_MNU_NM", length = 100, nullable = false, comment = "화면메뉴명")
    private String sreMnuNm;

    @Column(name = "SRE_TC", length = 2, comment = "화면구분코드")
    private String sreTc;

    @Column(name = "USE_YN", length = 1, nullable = false, comment = "사용여부")
    private String useYn;

    @Column(name = "RMK", length = 300, comment = "비고")
    private String rmk;
}
```

- [ ] **Step 2: Write the repository**

```java
package com.kdb.it.domain.menu.repository;

import com.kdb.it.domain.menu.entity.Cmenud;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CmenudRepository extends JpaRepository<Cmenud, String> {

    @Query("SELECT c FROM Cmenud c WHERE c.delYn = 'N' ORDER BY c.srePth")
    List<Cmenud> findAllActive();

    @Query("SELECT c FROM Cmenud c WHERE c.delYn = 'N' AND c.useYn = 'Y' ORDER BY c.srePth")
    List<Cmenud> findAllUsable();

    Optional<Cmenud> findBySrePthAndDelYn(String srePth, String delYn);
}
```

- [ ] **Step 3: Compile**

```bash
cd "C:/it/it_backend" && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL (generates `QCmenud`).

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/menu/entity/Cmenud.java it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenudRepository.java
git commit -m "feat(menu): add Cmenud route catalog entity and repository"
```

---

## Task 4: `Cmenum` master + `CmenumL` log entity + repository

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/entity/Cmenum.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/entity/CmenumL.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenumRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenumRepositoryCustom.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenumRepositoryImpl.java`

- [ ] **Step 1: Write the log entity** (mirror master business columns by `@Column` name; no `@Id` — PK inherited)

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

/** 공통메뉴기본(Cmenum) 변경 스냅샷 로그. */
@Entity
@Table(name = "TPRMPP_CMENUL", comment = "공통메뉴로그 — 변경 스냅샷")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class CmenumL extends BaseLogEntity {

    @Column(name = "MNU_ID", length = 10, comment = "메뉴ID")
    private String mnuId;

    @Column(name = "HRK_MNU_ID", length = 10, comment = "상위메뉴ID")
    private String hrkMnuId;

    @Column(name = "SRE_TC", length = 2, comment = "화면구분코드")
    private String sreTc;

    @Column(name = "MNU_NM", length = 100, comment = "메뉴명")
    private String mnuNm;

    @Column(name = "MNU_TP_C", length = 3, comment = "메뉴유형코드")
    private String mnuTpC;

    @Column(name = "SRE_PTH", length = 300, comment = "화면경로")
    private String srePth;

    @Column(name = "MNU_SOT_SQN_SNO", comment = "메뉴정렬순서일련번호")
    private Integer mnuSotSqnSno;

    @Column(name = "HID_YN", length = 1, comment = "숨김여부")
    private String hidYn;

    @Column(name = "MNU_DEP", comment = "메뉴깊이")
    private Integer mnuDep;

    @Column(name = "WHL_MNU_PTH", length = 500, comment = "전체메뉴경로")
    private String whlMnuPth;
}
```

- [ ] **Step 2: Write the master entity** (note `@LogTarget` — that is what enables logging; do NOT add `@EntityListeners`)

```java
package com.kdb.it.domain.menu.entity;

import com.kdb.it.domain.entity.BaseEntity;
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.CmenumL;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

/** 공통메뉴기본(메뉴 마스터). 변경 시 CmenumL로 자동 스냅샷 로깅(@LogTarget). */
@LogTarget(entity = CmenumL.class)
@Entity
@Table(name = "TPRMPP_CMENUM", comment = "공통메뉴기본 — 메뉴 마스터")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Cmenum extends BaseEntity {

    @Id
    @Column(name = "MNU_ID", length = 10, nullable = false, comment = "메뉴ID")
    private String mnuId;

    @Column(name = "HRK_MNU_ID", length = 10, comment = "상위메뉴ID")
    private String hrkMnuId;

    @Column(name = "SRE_TC", length = 2, nullable = false, comment = "화면구분코드")
    private String sreTc;

    @Column(name = "MNU_NM", length = 100, nullable = false, comment = "메뉴명")
    private String mnuNm;

    @Column(name = "MNU_TP_C", length = 3, nullable = false, comment = "메뉴유형코드")
    private String mnuTpC;

    @Column(name = "SRE_PTH", length = 300, comment = "화면경로")
    private String srePth;

    @Column(name = "MNU_SOT_SQN_SNO", nullable = false, comment = "메뉴정렬순서일련번호")
    private Integer mnuSotSqnSno;

    @Column(name = "HID_YN", length = 1, nullable = false, comment = "숨김여부")
    private String hidYn;

    @Column(name = "MNU_DEP", nullable = false, comment = "메뉴깊이")
    private Integer mnuDep;

    @Column(name = "WHL_MNU_PTH", length = 500, nullable = false, comment = "전체메뉴경로")
    private String whlMnuPth;
}
```

> `@Setter` is added here (unlike other masters) because `AdminMenuService.move()`/`reorder()`/`update()` mutate fields on loaded entities and rely on JPA dirty checking.

- [ ] **Step 3: Write the repository trio**

`CmenumRepository.java`:
```java
package com.kdb.it.domain.menu.repository;

import com.kdb.it.domain.menu.entity.Cmenum;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CmenumRepository extends JpaRepository<Cmenum, String>, CmenumRepositoryCustom {

    @Query("SELECT m FROM Cmenum m WHERE m.delYn = 'N'")
    List<Cmenum> findAllActive();

    Optional<Cmenum> findByMnuIdAndDelYn(String mnuId, String delYn);

    @Query("SELECT COUNT(m) FROM Cmenum m WHERE m.hrkMnuId = :mnuId AND m.delYn = 'N'")
    long countActiveChildren(String mnuId);
}
```

`CmenumRepositoryCustom.java`:
```java
package com.kdb.it.domain.menu.repository;

import com.kdb.it.domain.menu.entity.Cmenum;
import java.util.List;

public interface CmenumRepositoryCustom {
    /** WHL_MNU_PTH 접두사로 본인 + 모든 후손 조회 (move 재계산용). */
    List<Cmenum> findSubtreeByPathPrefix(String pathPrefix);

    /** 다음 MNU_ID 채번: 'MNU' + LPAD(SEQ_CMENUM.NEXTVAL, 7, '0'). */
    String nextMnuId();
}
```

`CmenumRepositoryImpl.java`:
```java
package com.kdb.it.domain.menu.repository;

import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.menu.entity.QCmenum;
import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
@RequiredArgsConstructor
public class CmenumRepositoryImpl implements CmenumRepositoryCustom {

    private final JPAQueryFactory queryFactory;
    private final EntityManager entityManager;

    @Override
    public List<Cmenum> findSubtreeByPathPrefix(String pathPrefix) {
        QCmenum m = QCmenum.cmenum;
        return queryFactory.selectFrom(m)
                .where(m.delYn.eq("N"), m.whlMnuPth.startsWith(pathPrefix))
                .fetch();
    }

    @Override
    public String nextMnuId() {
        Object val = entityManager
                .createNativeQuery("SELECT SEQ_CMENUM.NEXTVAL FROM DUAL")
                .getSingleResult();
        long n = ((Number) val).longValue();
        return "MNU" + String.format("%07d", n);
    }
}
```

- [ ] **Step 4: Compile**

```bash
cd "C:/it/it_backend" && ./gradlew compileJava -q
```
Expected: BUILD SUCCESSFUL (generates `QCmenum`).

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/menu/entity/Cmenum.java it_backend/src/main/java/com/kdb/it/domain/log/entity/CmenumL.java it_backend/src/main/java/com/kdb/it/domain/menu/repository/Cmenum*.java
git commit -m "feat(menu): add Cmenum master, CmenumL log entity, and repository"
```

---

## Task 5: `Cmenua` mapping entity (@IdClass) + repository

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/entity/CmenuaId.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/entity/Cmenua.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenuaRepository.java`

- [ ] **Step 1: Write the IdClass** (field names must match the `@Id` fields exactly; `Serializable` + `@EqualsAndHashCode`; no `@Column`)

```java
package com.kdb.it.domain.menu.entity;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class CmenuaId implements Serializable {
    private String mnuId;
    private String athId;
}
```

- [ ] **Step 2: Write the entity**

```java
package com.kdb.it.domain.menu.entity;

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

/** 공통메뉴권한연결(메뉴↔권한). 매핑 0건=전체 공개, 1건 이상=해당 권한만 노출. */
@Entity
@Table(name = "TPRMPP_CMENUA", comment = "공통메뉴권한연결 — 메뉴↔권한")
@IdClass(CmenuaId.class)
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Cmenua extends BaseEntity {

    @Id
    @Column(name = "MNU_ID", length = 10, nullable = false, comment = "메뉴ID")
    private String mnuId;

    @Id
    @Column(name = "ATH_ID", length = 32, nullable = false, comment = "권한ID")
    private String athId;
}
```

- [ ] **Step 3: Write the repository**

```java
package com.kdb.it.domain.menu.repository;

import com.kdb.it.domain.menu.entity.Cmenua;
import com.kdb.it.domain.menu.entity.CmenuaId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CmenuaRepository extends JpaRepository<Cmenua, CmenuaId> {

    @Query("SELECT a FROM Cmenua a WHERE a.delYn = 'N'")
    List<Cmenua> findAllActive();

    @Query("SELECT a FROM Cmenua a WHERE a.mnuId = :mnuId AND a.delYn = 'N'")
    List<Cmenua> findActiveByMnuId(String mnuId);
}
```

- [ ] **Step 4: Compile, then commit**

```bash
cd "C:/it/it_backend" && ./gradlew compileJava -q
git add it_backend/src/main/java/com/kdb/it/domain/menu/entity/Cmenua.java it_backend/src/main/java/com/kdb/it/domain/menu/entity/CmenuaId.java it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenuaRepository.java
git commit -m "feat(menu): add Cmenua menu-role mapping entity and repository"
```

---

## Task 6: Boot-validate the entities against the DB

**Files:** none (validation run)

- [ ] **Step 1: Boot the app to trigger Hibernate `validate`**

```bash
cd "C:/it/it_backend" && ./gradlew bootRun
```
Expected: app starts with no `SchemaManagementException` / "missing column" / "wrong column type". If validate fails, the error names the table+column mismatch — fix the DDL (Task 1) or the entity `@Column` to agree, re-run the DDL if needed, retry. Stop the app (Ctrl+C) once it boots cleanly.

> No commit — verification only. Do not proceed until the app boots clean; every later task assumes the schema/entity match holds.

---

## Task 7: DTOs

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java`

- [ ] **Step 1: Write all nested DTOs** (static nested classes, each with `@Schema(name=...)`)

```java
package com.kdb.it.domain.menu.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/** 메뉴 관리 API의 요청/응답 DTO 모음 (네임스페이스 클래스). */
public class MenuDto {

    /** 사이드바·Breadcrumb 공용 트리 노드. 아이콘/배지는 프론트 규약 맵 소관이라 미포함. */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @Schema(name = "MenuNode")
    public static class Node {
        private String mnuId;
        private String hrkMnuId;
        private String sreTc;
        private String mnuNm;
        private String mnuTpC;       // LNK / GRP / DYN
        private String srePth;
        private Integer mnuSotSqnSno;
        private String hidYn;
        private Integer mnuDep;
        private String whlMnuPth;
        private List<Node> children;
    }

    /** 단건 생성/수정 요청. mnuId는 서버가 채번하므로 받지 않는다. */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @Schema(name = "MenuUpsertRequest")
    public static class UpsertRequest {
        @NotBlank @Schema(description = "메뉴명") private String mnuNm;
        @NotBlank @Schema(description = "화면구분코드(01~06)") private String sreTc;
        @NotBlank @Schema(description = "메뉴유형코드 LNK/GRP/DYN") private String mnuTpC;
        @Schema(description = "상위메뉴ID(루트면 null)") private String hrkMnuId;
        @Schema(description = "화면경로(LNK 필수)") private String srePth;
        @Schema(description = "숨김여부 Y/N") private String hidYn;
        @Schema(description = "노출 권한ID 목록(비우면 전체 공개)") private List<String> athIds;
    }

    /** 같은 부모 내 순서 일괄 변경. mnuId 순서대로 10,20,30... 부여. */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @Schema(name = "MenuReorderRequest")
    public static class ReorderRequest {
        @NotNull @Schema(description = "정렬된 mnuId 목록") private List<String> orderedMnuIds;
    }

    /** 부모 이동. */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @Schema(name = "MenuMoveRequest")
    public static class MoveRequest {
        @Schema(description = "새 상위메뉴ID(루트로 이동하면 null)") private String newHrkMnuId;
    }

    /** 라우트 카탈로그 행. */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @Schema(name = "RouteCatalogItem")
    public static class Route {
        @NotBlank private String srePth;
        @NotBlank private String sreMnuNm;
        private String sreTc;
        private String useYn;
        private String rmk;
    }
}
```

- [ ] **Step 2: Compile, then commit**

```bash
cd "C:/it/it_backend" && ./gradlew compileJava -q
git add it_backend/src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java
git commit -m "feat(menu): add menu management DTOs"
```

---

## Task 8: `MenuQueryService` — role-filtered tree (TDD)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuChildrenResolver.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`

- [ ] **Step 1: Write the resolver SPI** (no implementations in Plan 1; Plan 2 adds the board adapter)

```java
package com.kdb.it.domain.menu.service;

import com.kdb.it.domain.menu.dto.MenuDto;
import java.util.List;

/** DYN 메뉴의 children을 MNU_ID 기준으로 생성하는 SPI. Plan 2에서 게시판 어댑터 등록. */
public interface MenuChildrenResolver {
    /** 이 resolver가 담당하는 DYN 노드의 MNU_ID. */
    String mnuId();
    /** 현재 사용자(athIds) 기준으로 권한 필터링된 children 노드. */
    List<MenuDto.Node> resolveChildren(List<String> athIds);
}
```

- [ ] **Step 2: Write the failing test**

```java
package com.kdb.it.domain.menu.service;

import com.kdb.it.domain.menu.dto.MenuDto;
import com.kdb.it.domain.menu.entity.Cmenua;
import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class MenuQueryServiceTest {

    @Mock CmenumRepository cmenumRepository;
    @Mock CmenuaRepository cmenuaRepository;
    @InjectMocks MenuQueryService service;

    private Cmenum node(String id, String parent, String type, int dep, String path) {
        return Cmenum.builder().mnuId(id).hrkMnuId(parent).sreTc("01").mnuNm(id)
                .mnuTpC(type).mnuSotSqnSno(10).hidYn("N").mnuDep(dep).whlMnuPth(path).delYn("N").build();
    }

    @Test
    void buildsTree_andFiltersByRole_pruningEmptyGroups() {
        // GRP 'G' (admin-only) with one LNK child 'C'; and public LNK 'P'
        given(cmenumRepository.findAllActive()).willReturn(List.of(
                node("G", null, "GRP", 1, "/G"),
                node("C", "G", "LNK", 2, "/G/C"),
                node("P", null, "LNK", 1, "/P")
        ));
        given(cmenuaRepository.findAllActive()).willReturn(List.of(
                Cmenua.builder().mnuId("G").athId("ITPAD001").delYn("N").build()
        ));

        // non-admin user: only 'P' visible (G+C pruned because G requires ITPAD001)
        List<MenuDto.Node> userTree = service.getMenuTree(List.of("ITPZZ001"));
        assertThat(userTree).extracting(MenuDto.Node::getMnuId).containsExactly("P");

        // admin: G (with child C) + P
        List<MenuDto.Node> adminTree = service.getMenuTree(List.of("ITPAD001"));
        assertThat(adminTree).extracting(MenuDto.Node::getMnuId).containsExactlyInAnyOrder("G", "P");
        MenuDto.Node g = adminTree.stream().filter(n -> n.getMnuId().equals("G")).findFirst().orElseThrow();
        assertThat(g.getChildren()).extracting(MenuDto.Node::getMnuId).containsExactly("C");
    }

    @Test
    void adminTree_returnsEverything_withoutPruning() {
        given(cmenumRepository.findAllActive()).willReturn(List.of(
                node("H", null, "LNK", 1, "/H")
        ));
        // getAdminMenuTree does not consult permissions
        List<MenuDto.Node> all = service.getAdminMenuTree();
        assertThat(all).extracting(MenuDto.Node::getMnuId).containsExactly("H");
    }
}
```

- [ ] **Step 3: Run the test — verify it fails**

```bash
cd "C:/it/it_backend" && ./gradlew test --tests "com.kdb.it.domain.menu.service.MenuQueryServiceTest" -q
```
Expected: FAIL — `MenuQueryService` does not yet have `getMenuTree` / `getAdminMenuTree`.

- [ ] **Step 4: Implement `MenuQueryService`**

```java
package com.kdb.it.domain.menu.service;

import com.kdb.it.domain.menu.dto.MenuDto;
import com.kdb.it.domain.menu.entity.Cmenua;
import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** 메뉴 트리 조회 + 서버 단 권한 필터링. 권한 판단은 전적으로 여기서 수행한다. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MenuQueryService {

    private final CmenumRepository cmenumRepository;
    private final CmenuaRepository cmenuaRepository;
    /** Plan 2에서 게시판 resolver 주입. Plan 1에서는 빈 리스트(하드코딩). */
    private final List<MenuChildrenResolver> resolvers = List.of();

    /** 사용자용: ROLE 필터 + HID_YN='N' + 빈 GRP/DYN 가지치기. */
    public List<MenuDto.Node> getMenuTree(List<String> athIds) {
        List<Cmenum> all = cmenumRepository.findAllActive();
        Map<String, Set<String>> athByMenu = athByMenu();
        Set<String> userAths = new HashSet<>(athIds == null ? List.of() : athIds);

        List<Cmenum> visible = all.stream()
                .filter(m -> !"Y".equals(m.getHidYn()))
                .filter(m -> isAllowed(m.getMnuId(), athByMenu, userAths))
                .collect(Collectors.toList());

        return prune(buildTree(visible, athIds), true);
    }

    /** 관리화면용: 숨김/권한/빈 그룹 무관하게 전체 트리. */
    public List<MenuDto.Node> getAdminMenuTree() {
        return buildTree(cmenumRepository.findAllActive(), null);
    }

    // ---- helpers ----

    private Map<String, Set<String>> athByMenu() {
        Map<String, Set<String>> map = new HashMap<>();
        for (Cmenua a : cmenuaRepository.findAllActive()) {
            map.computeIfAbsent(a.getMnuId(), k -> new HashSet<>()).add(a.getAthId());
        }
        return map;
    }

    /** 매핑 0건이면 전체 공개, 1건 이상이면 교집합 필요. */
    private boolean isAllowed(String mnuId, Map<String, Set<String>> athByMenu, Set<String> userAths) {
        Set<String> required = athByMenu.get(mnuId);
        if (required == null || required.isEmpty()) return true;
        return required.stream().anyMatch(userAths::contains);
    }

    private List<MenuDto.Node> buildTree(List<Cmenum> rows, List<String> athIds) {
        Map<String, MenuDto.Node> byId = new HashMap<>();
        for (Cmenum m : rows) byId.put(m.getMnuId(), toNode(m));
        List<MenuDto.Node> roots = new ArrayList<>();
        for (Cmenum m : rows) {
            MenuDto.Node nodeDto = byId.get(m.getMnuId());
            if ("DYN".equals(m.getMnuTpC()) && athIds != null) {
                nodeDto.setChildren(resolveDyn(m.getMnuId(), athIds));
            }
            MenuDto.Node parent = m.getHrkMnuId() == null ? null : byId.get(m.getHrkMnuId());
            if (parent == null) {
                roots.add(nodeDto);
            } else {
                if (parent.getChildren() == null) parent.setChildren(new ArrayList<>());
                parent.getChildren().add(nodeDto);
            }
        }
        sortRecursive(roots);
        return roots;
    }

    private List<MenuDto.Node> resolveDyn(String mnuId, List<String> athIds) {
        return resolvers.stream()
                .filter(r -> r.mnuId().equals(mnuId))
                .findFirst()
                .map(r -> r.resolveChildren(athIds))
                .orElseGet(ArrayList::new);
    }

    private void sortRecursive(List<MenuDto.Node> nodes) {
        if (nodes == null) return;
        nodes.sort(Comparator.comparingInt(n -> n.getMnuSotSqnSno() == null ? 0 : n.getMnuSotSqnSno()));
        for (MenuDto.Node n : nodes) sortRecursive(n.getChildren());
    }

    /** 사용자 트리에서 children 0개가 된 GRP/DYN 노드 제거. */
    private List<MenuDto.Node> prune(List<MenuDto.Node> nodes, boolean isUserTree) {
        if (!isUserTree || nodes == null) return nodes;
        List<MenuDto.Node> kept = new ArrayList<>();
        for (MenuDto.Node n : nodes) {
            n.setChildren(prune(n.getChildren(), true));
            boolean container = "GRP".equals(n.getMnuTpC()) || "DYN".equals(n.getMnuTpC());
            boolean empty = n.getChildren() == null || n.getChildren().isEmpty();
            if (container && empty) continue;
            kept.add(n);
        }
        return kept;
    }

    private MenuDto.Node toNode(Cmenum m) {
        return MenuDto.Node.builder()
                .mnuId(m.getMnuId()).hrkMnuId(m.getHrkMnuId()).sreTc(m.getSreTc())
                .mnuNm(m.getMnuNm()).mnuTpC(m.getMnuTpC()).srePth(m.getSrePth())
                .mnuSotSqnSno(m.getMnuSotSqnSno()).hidYn(m.getHidYn())
                .mnuDep(m.getMnuDep()).whlMnuPth(m.getWhlMnuPth())
                .children(new ArrayList<>())
                .build();
    }
}
```

> The `private final List<MenuChildrenResolver> resolvers = List.of();` is a hardcoded empty list in Plan 1 so the Mockito test (no Spring context) constructs cleanly. In Plan 2 this becomes a constructor-injected `List<MenuChildrenResolver>` populated by Spring.

- [ ] **Step 5: Run the test — verify it passes**

```bash
cd "C:/it/it_backend" && ./gradlew test --tests "com.kdb.it.domain.menu.service.MenuQueryServiceTest" -q
```
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuChildrenResolver.java it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java
git commit -m "feat(menu): add MenuQueryService with role-filtered tree (TDD)"
```

---

## Task 9: `AdminMenuService` — CRUD + reorder + move + path recalc (TDD)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java`

- [ ] **Step 1: Write the failing tests** (move recalculation, depth limit, cycle prevention, delete-with-children, reorder)

```java
package com.kdb.it.domain.menu.service;

import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import com.kdb.it.domain.menu.repository.CmenudRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class AdminMenuServiceTest {

    @Mock CmenumRepository cmenumRepository;
    @Mock CmenuaRepository cmenuaRepository;
    @Mock CmenudRepository cmenudRepository;
    @InjectMocks AdminMenuService service;

    private Cmenum node(String id, String parent, int dep, String path) {
        return Cmenum.builder().mnuId(id).hrkMnuId(parent).sreTc("01").mnuNm(id)
                .mnuTpC("GRP").mnuSotSqnSno(10).hidYn("N").mnuDep(dep).whlMnuPth(path).delYn("N").build();
    }

    @Test
    void move_recalculatesPathAndDepthForNodeAndDescendants() {
        Cmenum target = node("B", "A", 2, "/A/B");
        Cmenum child  = node("C", "B", 3, "/A/B/C");
        Cmenum newParent = node("X", null, 1, "/X");
        given(cmenumRepository.findByMnuIdAndDelYn("B", "N")).willReturn(Optional.of(target));
        given(cmenumRepository.findByMnuIdAndDelYn("X", "N")).willReturn(Optional.of(newParent));
        given(cmenumRepository.findSubtreeByPathPrefix("/A/B")).willReturn(List.of(target, child));

        service.move("B", "X");

        assertThat(target.getHrkMnuId()).isEqualTo("X");
        assertThat(target.getMnuDep()).isEqualTo(2);          // /X (1) + B = 2
        assertThat(target.getWhlMnuPth()).isEqualTo("/X/B");
        assertThat(child.getMnuDep()).isEqualTo(3);
        assertThat(child.getWhlMnuPth()).isEqualTo("/X/B/C");
    }

    @Test
    void move_rejectsCycle_whenNewParentIsDescendant() {
        Cmenum target = node("B", "A", 2, "/A/B");
        Cmenum desc   = node("C", "B", 3, "/A/B/C");
        given(cmenumRepository.findByMnuIdAndDelYn("B", "N")).willReturn(Optional.of(target));
        given(cmenumRepository.findByMnuIdAndDelYn("C", "N")).willReturn(Optional.of(desc));

        assertThatThrownBy(() -> service.move("B", "C"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("순환");
    }

    @Test
    void move_rejectsWhenResultingDepthExceedsThree() {
        Cmenum target = node("B", "A", 2, "/A/B");
        Cmenum child  = node("C", "B", 3, "/A/B/C");        // moving B under depth-2 parent -> C becomes depth 4
        Cmenum newParent = node("P", "Q", 2, "/Q/P");
        given(cmenumRepository.findByMnuIdAndDelYn("B", "N")).willReturn(Optional.of(target));
        given(cmenumRepository.findByMnuIdAndDelYn("P", "N")).willReturn(Optional.of(newParent));
        given(cmenumRepository.findSubtreeByPathPrefix("/A/B")).willReturn(List.of(target, child));

        assertThatThrownBy(() -> service.move("B", "P"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("깊이");
    }

    @Test
    void delete_rejectsWhenChildrenExist() {
        given(cmenumRepository.findByMnuIdAndDelYn("A", "N")).willReturn(Optional.of(node("A", null, 1, "/A")));
        given(cmenumRepository.countActiveChildren("A")).willReturn(2L);

        assertThatThrownBy(() -> service.delete("A"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("하위");
    }

    @Test
    void reorder_assignsIncrementingSortNumbers() {
        Cmenum a = node("A", "P", 2, "/P/A");
        Cmenum b = node("B", "P", 2, "/P/B");
        given(cmenumRepository.findByMnuIdAndDelYn("B", "N")).willReturn(Optional.of(b));
        given(cmenumRepository.findByMnuIdAndDelYn("A", "N")).willReturn(Optional.of(a));

        service.reorder(List.of("B", "A"));

        assertThat(b.getMnuSotSqnSno()).isEqualTo(10);
        assertThat(a.getMnuSotSqnSno()).isEqualTo(20);
    }
}
```

- [ ] **Step 2: Run the tests — verify they fail**

```bash
cd "C:/it/it_backend" && ./gradlew test --tests "com.kdb.it.domain.menu.service.AdminMenuServiceTest" -q
```
Expected: FAIL — `AdminMenuService` not defined.

- [ ] **Step 3: Implement `AdminMenuService`**

```java
package com.kdb.it.domain.menu.service;

import com.kdb.it.domain.menu.dto.MenuDto;
import com.kdb.it.domain.menu.entity.Cmenua;
import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import com.kdb.it.domain.menu.repository.CmenudRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** 메뉴 마스터 관리(CRUD) + 정렬/이동 + WHL_MNU_PTH·MNU_DEP 재계산 책임. */
@Service
@RequiredArgsConstructor
@Transactional
public class AdminMenuService {

    private static final int MAX_DEPTH = 3;
    private static final int SORT_STEP = 10;

    private final CmenumRepository cmenumRepository;
    private final CmenuaRepository cmenuaRepository;
    private final CmenudRepository cmenudRepository;

    public String create(MenuDto.UpsertRequest req) {
        validateTypePath(req.getMnuTpC(), req.getSrePth());
        String mnuId = cmenumRepository.nextMnuId();

        int depth = 1;
        String whlPth = "/" + mnuId;
        if (req.getHrkMnuId() != null) {
            Cmenum parent = load(req.getHrkMnuId());
            depth = parent.getMnuDep() + 1;
            if (depth > MAX_DEPTH) throw badRequest("메뉴 깊이는 최대 " + MAX_DEPTH + "단입니다.");
            whlPth = parent.getWhlMnuPth() + "/" + mnuId;
        }

        Cmenum menu = Cmenum.builder()
                .mnuId(mnuId).hrkMnuId(req.getHrkMnuId()).sreTc(req.getSreTc())
                .mnuNm(req.getMnuNm()).mnuTpC(req.getMnuTpC()).srePth(req.getSrePth())
                .mnuSotSqnSno(SORT_STEP).hidYn(req.getHidYn() == null ? "N" : req.getHidYn())
                .mnuDep(depth).whlMnuPth(whlPth).delYn("N")
                .build();
        cmenumRepository.save(menu);
        replaceRoles(mnuId, req.getAthIds());
        return mnuId;
    }

    public void update(String mnuId, MenuDto.UpsertRequest req) {
        validateTypePath(req.getMnuTpC(), req.getSrePth());
        Cmenum menu = load(mnuId);
        menu.setMnuNm(req.getMnuNm());
        menu.setSreTc(req.getSreTc());
        menu.setMnuTpC(req.getMnuTpC());
        menu.setSrePth(req.getSrePth());
        menu.setHidYn(req.getHidYn() == null ? "N" : req.getHidYn());
        // dirty checking flushes; @LogTarget snapshots automatically on @PreUpdate
        replaceRoles(mnuId, req.getAthIds());
    }

    public void delete(String mnuId) {
        Cmenum menu = load(mnuId);
        if (cmenumRepository.countActiveChildren(mnuId) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "하위 메뉴가 있어 삭제할 수 없습니다.");
        }
        menu.delete(); // DEL_YN='Y'
        for (Cmenua a : cmenuaRepository.findActiveByMnuId(mnuId)) a.delete();
    }

    public void reorder(List<String> orderedMnuIds) {
        int sort = SORT_STEP;
        for (String id : orderedMnuIds) {
            load(id).setMnuSotSqnSno(sort);
            sort += SORT_STEP;
        }
    }

    public void move(String mnuId, String newHrkMnuId) {
        Cmenum target = load(mnuId);
        String oldPrefix = target.getWhlMnuPth();

        int baseDepth = 0;
        String newParentPath = "";
        if (newHrkMnuId != null) {
            Cmenum newParent = load(newHrkMnuId);
            if (newParent.getWhlMnuPth().startsWith(oldPrefix)) {
                throw badRequest("순환 참조: 자기 자신 또는 후손을 부모로 지정할 수 없습니다.");
            }
            baseDepth = newParent.getMnuDep();
            newParentPath = newParent.getWhlMnuPth();
        }
        String newPrefix = newParentPath + "/" + mnuId;
        int depthDelta = (baseDepth + 1) - target.getMnuDep();

        List<Cmenum> subtree = cmenumRepository.findSubtreeByPathPrefix(oldPrefix);
        for (Cmenum n : subtree) {
            if (n.getMnuDep() + depthDelta > MAX_DEPTH) {
                throw badRequest("이동 시 메뉴 깊이가 " + MAX_DEPTH + "단을 초과합니다.");
            }
        }
        for (Cmenum n : subtree) {
            n.setWhlMnuPth(newPrefix + n.getWhlMnuPth().substring(oldPrefix.length()));
            n.setMnuDep(n.getMnuDep() + depthDelta);
        }
        target.setHrkMnuId(newHrkMnuId);
    }

    // ---- helpers ----

    private Cmenum load(String mnuId) {
        return cmenumRepository.findByMnuIdAndDelYn(mnuId, "N")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "존재하지 않는 메뉴: " + mnuId));
    }

    private void validateTypePath(String mnuTpC, String srePth) {
        if (!List.of("LNK", "GRP", "DYN").contains(mnuTpC)) throw badRequest("잘못된 메뉴유형코드: " + mnuTpC);
        if ("LNK".equals(mnuTpC)) {
            if (srePth == null || srePth.isBlank()) throw badRequest("LNK 메뉴는 화면경로가 필수입니다.");
            cmenudRepository.findBySrePthAndDelYn(srePth, "N")
                    .orElseThrow(() -> badRequest("라우트 카탈로그에 없는 경로: " + srePth));
        } else if (srePth != null) {
            throw badRequest(mnuTpC + " 메뉴는 화면경로를 가질 수 없습니다.");
        }
    }

    /** 권한 매핑 전체 교체: 기존 활성 매핑 soft-delete 후 새 목록 저장. */
    private void replaceRoles(String mnuId, List<String> athIds) {
        for (Cmenua a : cmenuaRepository.findActiveByMnuId(mnuId)) a.delete();
        if (athIds == null) return;
        for (String athId : athIds) {
            cmenuaRepository.save(Cmenua.builder().mnuId(mnuId).athId(athId).delYn("N").build());
        }
    }

    private ResponseStatusException badRequest(String msg) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }
}
```

- [ ] **Step 4: Run the tests — verify they pass**

```bash
cd "C:/it/it_backend" && ./gradlew test --tests "com.kdb.it.domain.menu.service.AdminMenuServiceTest" -q
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java
git commit -m "feat(menu): add AdminMenuService with path recalc, depth/cycle guards (TDD)"
```

---

## Task 10: `AdminRouteService` (route catalog CRUD)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminRouteService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminRouteServiceTest.java`

- [ ] **Step 1: Write the failing test**

```java
package com.kdb.it.domain.menu.service;

import com.kdb.it.domain.menu.dto.MenuDto;
import com.kdb.it.domain.menu.entity.Cmenud;
import com.kdb.it.domain.menu.repository.CmenudRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
class AdminRouteServiceTest {

    @Mock CmenudRepository cmenudRepository;
    @Mock CmenumRepository cmenumRepository;
    @InjectMocks AdminRouteService service;

    @Test
    void create_rejectsNonRootedPath() {
        MenuDto.Route r = MenuDto.Route.builder().srePth("budget/list").sreMnuNm("예산").build();
        assertThatThrownBy(() -> service.create(r))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("/");
    }

    @Test
    void create_rejectsDuplicate() {
        MenuDto.Route r = MenuDto.Route.builder().srePth("/budget/list").sreMnuNm("예산").build();
        given(cmenudRepository.findBySrePthAndDelYn("/budget/list", "N"))
                .willReturn(Optional.of(Cmenud.builder().srePth("/budget/list").build()));
        assertThatThrownBy(() -> service.create(r))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("중복");
    }
}
```

- [ ] **Step 2: Run — verify fail**

```bash
cd "C:/it/it_backend" && ./gradlew test --tests "com.kdb.it.domain.menu.service.AdminRouteServiceTest" -q
```
Expected: FAIL — `AdminRouteService` not defined.

- [ ] **Step 3: Implement `AdminRouteService`**

```java
package com.kdb.it.domain.menu.service;

import com.kdb.it.domain.menu.dto.MenuDto;
import com.kdb.it.domain.menu.entity.Cmenud;
import com.kdb.it.domain.menu.repository.CmenudRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/** 라우트 카탈로그(Cmenud) 관리. dead link 방지를 위해 저장 시 경로 형식·중복 검증. */
@Service
@RequiredArgsConstructor
@Transactional
public class AdminRouteService {

    private final CmenudRepository cmenudRepository;
    private final CmenumRepository cmenumRepository;

    @Transactional(readOnly = true)
    public List<Cmenud> listUsable() { return cmenudRepository.findAllUsable(); }

    @Transactional(readOnly = true)
    public List<Cmenud> listAll() { return cmenudRepository.findAllActive(); }

    public void create(MenuDto.Route req) {
        validatePath(req.getSrePth());
        cmenudRepository.findBySrePthAndDelYn(req.getSrePth(), "N").ifPresent(x -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "중복된 화면경로: " + req.getSrePth());
        });
        cmenudRepository.save(Cmenud.builder()
                .srePth(req.getSrePth()).sreMnuNm(req.getSreMnuNm()).sreTc(req.getSreTc())
                .useYn(req.getUseYn() == null ? "Y" : req.getUseYn()).rmk(req.getRmk()).delYn("N")
                .build());
    }

    public void update(MenuDto.Route req) {
        Cmenud c = cmenudRepository.findBySrePthAndDelYn(req.getSrePth(), "N")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "없는 경로: " + req.getSrePth()));
        // Cmenud has no @Setter; rebuild + save (PK srePth unchanged → JPA merge)
        cmenudRepository.save(Cmenud.builder()
                .srePth(c.getSrePth()).sreMnuNm(req.getSreMnuNm()).sreTc(req.getSreTc())
                .useYn(req.getUseYn()).rmk(req.getRmk()).delYn("N").build());
    }

    public void delete(String srePth) {
        Cmenud c = cmenudRepository.findBySrePthAndDelYn(srePth, "N")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "없는 경로: " + srePth));
        if (cmenumRepository.findAllActive().stream().anyMatch(m -> srePth.equals(m.getSrePth()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "메뉴에서 참조 중인 경로는 삭제할 수 없습니다.");
        }
        c.delete();
    }

    private void validatePath(String srePth) {
        if (srePth == null || !srePth.startsWith("/") || srePth.contains(" ")
                || srePth.startsWith("http")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "화면경로는 '/'로 시작하고 공백/외부 URL을 포함할 수 없습니다: " + srePth);
        }
    }
}
```

- [ ] **Step 4: Run — verify pass, then commit**

```bash
cd "C:/it/it_backend" && ./gradlew test --tests "com.kdb.it.domain.menu.service.AdminRouteServiceTest" -q
git add it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminRouteService.java it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminRouteServiceTest.java
git commit -m "feat(menu): add AdminRouteService with path validation (TDD)"
```

---

## Task 11: Controllers (read + admin menu + admin route)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/controller/MenuQueryController.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/controller/AdminMenuController.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/controller/AdminRouteController.java`

> All `@PathVariable`/`@RequestParam` MUST include the `name` attribute (Java 25 / Spring Boot 4 gotcha, §5.5.3). Mutations use `@Valid`. Admin controllers carry class-level `@PreAuthorize`.

- [ ] **Step 1: Confirm the principal's roles accessor**

```bash
grep -rn "class CustomUserDetails" "C:/it/it_backend/src/main/java"
grep -n "athId\|AthId\|getAthIds\|List<String>" "C:/it/it_backend/src/main/java/com/kdb/it/common/system/security/CustomUserDetails.java"
```
Expected: find the package of `CustomUserDetails` and the getter returning the user's `athIds` (`List<String>`). Use that exact import + method in Step 2.

- [ ] **Step 2: `MenuQueryController`** (authenticated users; reads roles from the principal — adjust the import + getter to match Step 1)

```java
package com.kdb.it.domain.menu.controller;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.menu.dto.MenuDto;
import com.kdb.it.domain.menu.service.MenuQueryService;
import io.swagger.v3.oas.annotations.tag.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/menus")
@RequiredArgsConstructor
@Tag(name = "메뉴 조회", description = "사이드바·Breadcrumb 공용 메뉴 트리")
public class MenuQueryController {

    private final MenuQueryService menuQueryService;

    @GetMapping
    public ResponseEntity<List<MenuDto.Node>> getMenus(
            @AuthenticationPrincipal CustomUserDetails user) {
        List<String> athIds = user == null ? List.of() : user.getAthIds();
        return ResponseEntity.ok(menuQueryService.getMenuTree(athIds));
    }
}
```

- [ ] **Step 3: `AdminMenuController`**

```java
package com.kdb.it.domain.menu.controller;

import com.kdb.it.domain.menu.dto.MenuDto;
import com.kdb.it.domain.menu.service.AdminMenuService;
import com.kdb.it.domain.menu.service.MenuQueryService;
import io.swagger.v3.oas.annotations.tag.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/admin/menus")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "메뉴 관리(관리자)", description = "메뉴 CRUD·정렬·이동")
public class AdminMenuController {

    private final AdminMenuService adminMenuService;
    private final MenuQueryService menuQueryService;

    @GetMapping
    public ResponseEntity<List<MenuDto.Node>> getAll() {
        return ResponseEntity.ok(menuQueryService.getAdminMenuTree());
    }

    @PostMapping
    public ResponseEntity<String> create(@Valid @RequestBody MenuDto.UpsertRequest req,
                                         UriComponentsBuilder uri) {
        String mnuId = adminMenuService.create(req);
        URI loc = uri.path("/api/admin/menus/{id}").buildAndExpand(mnuId).toUri();
        return ResponseEntity.created(loc).body(mnuId);
    }

    @PutMapping("/{mnuId}")
    public ResponseEntity<Void> update(@PathVariable(name = "mnuId") String mnuId,
                                       @Valid @RequestBody MenuDto.UpsertRequest req) {
        adminMenuService.update(mnuId, req);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{mnuId}")
    public ResponseEntity<Void> delete(@PathVariable(name = "mnuId") String mnuId) {
        adminMenuService.delete(mnuId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/reorder")
    public ResponseEntity<Void> reorder(@Valid @RequestBody MenuDto.ReorderRequest req) {
        adminMenuService.reorder(req.getOrderedMnuIds());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{mnuId}/move")
    public ResponseEntity<Void> move(@PathVariable(name = "mnuId") String mnuId,
                                     @RequestBody MenuDto.MoveRequest req) {
        adminMenuService.move(mnuId, req.getNewHrkMnuId());
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 4: `AdminRouteController`**

```java
package com.kdb.it.domain.menu.controller;

import com.kdb.it.domain.menu.dto.MenuDto;
import com.kdb.it.domain.menu.entity.Cmenud;
import com.kdb.it.domain.menu.service.AdminRouteService;
import io.swagger.v3.oas.annotations.tag.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/routes")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "라우트 카탈로그(관리자)", description = "화면경로 CRUD")
public class AdminRouteController {

    private final AdminRouteService adminRouteService;

    @GetMapping
    public ResponseEntity<List<Cmenud>> usable() {
        return ResponseEntity.ok(adminRouteService.listUsable());
    }

    @GetMapping("/all")
    public ResponseEntity<List<Cmenud>> all() {
        return ResponseEntity.ok(adminRouteService.listAll());
    }

    @PostMapping
    public ResponseEntity<Void> create(@Valid @RequestBody MenuDto.Route req) {
        adminRouteService.create(req);
        return ResponseEntity.noContent().build();
    }

    @PutMapping
    public ResponseEntity<Void> update(@Valid @RequestBody MenuDto.Route req) {
        adminRouteService.update(req);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@RequestParam(name = "srePth") String srePth) {
        adminRouteService.delete(srePth);
        return ResponseEntity.noContent().build();
    }
}
```

- [ ] **Step 5: Compile + run full unit-test suite**

```bash
cd "C:/it/it_backend" && ./gradlew compileJava test -q
```
Expected: BUILD SUCCESSFUL; menu service tests green.

- [ ] **Step 6: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/menu/controller/
git commit -m "feat(menu): add menu query + admin menu/route controllers"
```

---

## Task 12: Seed migration (route catalog + menu tree + role mapping)

**Files:**
- Create: `it_database/migrations/V20260603_008__SeedRouteCatalogAndMenuTree.sql`
- Reference: `it_frontend/app/components/AppSidebar.vue` (source of truth for labels/paths/order/admin flags)

- [ ] **Step 1: Extract the current sidebar tree**

Read `AppSidebar.vue`'s `menuItems` computed. For every node record: context (→ `SRE_TC` 01 info / 02 audit / 03 admin / 04 board / 05 documents / 06 approval), label (`MNU_NM`), `to` path (`SRE_PTH`, LNK only), type (LNK leaf / GRP group / DYN for the board-list node), parent, order, and `admin: true` (→ role mapping to `ITPAD001`). Assign stable `MNU_ID`s grouped by context, e.g. `MINF0001`, `MAUD0001`, `MADM0001`, `MBRD0001` (DYN board node). Include the menu-admin pages themselves (`MADM0001` 메뉴관리, `MADM0002` 라우트관리).

- [ ] **Step 2: Write the seed using idempotent MERGE** (re-runnable; GUID via `RAWTOHEX(SYS_GUID())`). The 3 blocks below are the exact structure; fill every real node from Step 1 into the `USING (... UNION ALL ...)` lists:

```sql
-- 메뉴 시드 (멱등: MERGE). 수동 실행.
-- 1) 라우트 카탈로그 (AppSidebar.vue의 모든 to 경로)
MERGE INTO TPRMPP_CMENUD t
USING (
  SELECT '/info' AS SRE_PTH, '정보화 개요' AS SRE_MNU_NM, '01' AS SRE_TC FROM DUAL UNION ALL
  SELECT '/info/budget', '정보화 예산', '01' FROM DUAL UNION ALL
  SELECT '/audit', 'IT감사', '02' FROM DUAL
  -- … 모든 경로(약 60건)
) s ON (t.SRE_PTH = s.SRE_PTH)
WHEN NOT MATCHED THEN
  INSERT (SRE_PTH, SRE_MNU_NM, SRE_TC, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
  VALUES (s.SRE_PTH, s.SRE_MNU_NM, s.SRE_TC, 'Y', 'N', RAWTOHEX(SYS_GUID()), 1, SYSDATE, 'SYSTEM');

-- 2) 메뉴 트리 (WHL_MNU_PTH·MNU_DEP 명시 계산)
MERGE INTO TPRMPP_CMENUM t
USING (
  SELECT 'MINF0001' AS MNU_ID, CAST(NULL AS VARCHAR2(10)) AS HRK_MNU_ID, '01' AS SRE_TC,
         '정보화 개요' AS MNU_NM, 'GRP' AS MNU_TP_C, CAST(NULL AS VARCHAR2(300)) AS SRE_PTH,
         10 AS MNU_SOT_SQN_SNO, 'N' AS HID_YN, 1 AS MNU_DEP, '/MINF0001' AS WHL_MNU_PTH FROM DUAL
  UNION ALL
  SELECT 'MINF0002', 'MINF0001', '01', '정보화 예산', 'LNK', '/info/budget',
         10, 'N', 2, '/MINF0001/MINF0002' FROM DUAL
  UNION ALL
  SELECT 'MBRD0001', NULL, '04', '게시판', 'DYN', NULL,
         10, 'N', 1, '/MBRD0001' FROM DUAL
  -- … 관리 메뉴 자체 노드(MADM0001 메뉴관리, MADM0002 라우트관리) 포함, 모든 노드
) s ON (t.MNU_ID = s.MNU_ID)
WHEN NOT MATCHED THEN
  INSERT (MNU_ID, HRK_MNU_ID, SRE_TC, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO, HID_YN, MNU_DEP, WHL_MNU_PTH,
          DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
  VALUES (s.MNU_ID, s.HRK_MNU_ID, s.SRE_TC, s.MNU_NM, s.MNU_TP_C, s.SRE_PTH, s.MNU_SOT_SQN_SNO, s.HID_YN, s.MNU_DEP, s.WHL_MNU_PTH,
          'N', RAWTOHEX(SYS_GUID()), 1, SYSDATE, 'SYSTEM');

-- 3) 권한 매핑 (admin:true 노드 → ITPAD001; 그 외는 매핑 없음=전체 공개)
MERGE INTO TPRMPP_CMENUA t
USING (
  SELECT 'MADM0001' AS MNU_ID, 'ITPAD001' AS ATH_ID FROM DUAL UNION ALL
  SELECT 'MADM0002', 'ITPAD001' FROM DUAL
  -- … admin 컨텍스트 노드 전부
) s ON (t.MNU_ID = s.MNU_ID AND t.ATH_ID = s.ATH_ID)
WHEN NOT MATCHED THEN
  INSERT (MNU_ID, ATH_ID, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
  VALUES (s.MNU_ID, s.ATH_ID, 'N', RAWTOHEX(SYS_GUID()), 1, SYSDATE, 'SYSTEM');

COMMIT;
```

> Order matters: insert into `TPRMPP_CMENUD` (routes) before `TPRMPP_CMENUM` so the `FK_CMENUM_SRE` foreign key on LNK nodes' `SRE_PTH` is satisfied. Every LNK node's `SRE_PTH` must exist as a route row.

- [ ] **Step 3: Apply the seed**

```bash
sqlplus ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1 @C:/it/it_database/migrations/V20260603_008__SeedRouteCatalogAndMenuTree.sql
```
Expected: `... rows merged.` per block, `Commit complete.` (no ORA-02291 FK errors — if any, a LNK node references a route not in block 1; add it).

- [ ] **Step 4: Verify counts**

```bash
echo "SELECT (SELECT COUNT(*) FROM TPRMPP_CMENUD) routes, (SELECT COUNT(*) FROM TPRMPP_CMENUM) menus, (SELECT COUNT(*) FROM TPRMPP_CMENUA) roles FROM DUAL;" | sqlplus -S ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1
```
Expected: routes ≈ 60, menus ≈ 70, roles = number of admin nodes.

- [ ] **Step 5: Commit**

```bash
git add it_database/migrations/V20260603_008__SeedRouteCatalogAndMenuTree.sql
git commit -m "feat(menu): seed route catalog, menu tree, and role mappings"
```

---

## Task 13: End-to-end DB smoke verification (manual)

**Files:** none

- [ ] **Step 1: Boot the app**

```bash
cd "C:/it/it_backend" && ./gradlew bootRun
```
Expected: starts clean (validate passes against the 4 new tables).

- [ ] **Step 2: Log in as admin + call the read API** (second terminal; confirm the login payload against `AuthController`/`DevAuthController`)

```bash
curl -s -c cookies.txt -X POST "http://localhost:8080/api/auth/login" -H "Content-Type: application/json" -d '{"eno":"<ADMIN_ENO>","password":"<PW>"}'
curl -s -b cookies.txt "http://localhost:8080/api/menus" | head -c 800
```
Expected: JSON tree of nodes with `mnuId`, `mnuNm`, `children`. Admin sees admin-context nodes.

- [ ] **Step 3: Verify admin endpoints + audit log (the key sequence-name check)**

```bash
curl -s -b cookies.txt -X POST "http://localhost:8080/api/admin/routes" -H "Content-Type: application/json" -d '{"srePth":"/zz/test","sreMnuNm":"테스트","sreTc":"03","useYn":"Y"}' -w " [%{http_code}]\n"
curl -s -b cookies.txt -X POST "http://localhost:8080/api/admin/menus" -H "Content-Type: application/json" -d '{"mnuNm":"테스트메뉴","sreTc":"03","mnuTpC":"LNK","srePth":"/zz/test"}' -w " [%{http_code}]\n"
echo "SELECT COUNT(*) FROM TPRMPP_CMENUL WHERE CHG_DTT_YN='C';" | sqlplus -S ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1
```
Expected: 201/204, and the log count ≥ 1 — this proves `@LogTarget` + `SEQ_CMENUL` audit logging works. If it is 0, the app console shows a warn "시퀀스 조회 오류: SEQ_CMENUL"; the sequence is missing/misnamed — fix Task 1.

- [ ] **Step 4: Verify non-admin is blocked**

```bash
curl -s -c u.txt -X POST "http://localhost:8080/api/auth/login" -H "Content-Type: application/json" -d '{"eno":"<USER_ENO>","password":"<PW>"}'
curl -s -b u.txt "http://localhost:8080/api/admin/menus" -w " [%{http_code}]\n" -o /dev/null
```
Expected: `[403]`. And `/api/menus` for this user omits admin-only nodes.

- [ ] **Step 5: Clean up the throwaway rows, stop the app**

```bash
echo "DELETE FROM TPRMPP_CMENUM WHERE SRE_PTH='/zz/test'; DELETE FROM TPRMPP_CMENUD WHERE SRE_PTH='/zz/test'; COMMIT;" | sqlplus -S ITPAPP/kdb1234!!@127.0.0.1:1521/XEPDB1
```
Stop `bootRun` (Ctrl+C).

> No commit — verification only. If everything passed, the backend is ready for the frontend (Plan 2).

---

## Task 14: Update backend docs

**Files:**
- Modify: `it_backend/CLAUDE.md` (§5.2 table list, §5.12.1 audit entity count)
- Modify: `it_backend/docs/guides/data-model.md` (add menu domain mapping)
- Modify: `TASK.md`

- [ ] **Step 1: Edit `it_backend/CLAUDE.md`**

In §5.2 add the menu domain table mappings (`TPRMPP_CMENUD/CMENUM/CMENUA/CMENUL`) and note용도 codes `D`(상세)·`A`(연결). In §5.12.1 bump the audit-logged entity count by one (`CmenumL` added). Add a one-line note that menu entities carry no `VERSION`/`@Version` column (spec §3.0).

- [ ] **Step 2: Edit `it_backend/docs/guides/data-model.md`**

Add a "메뉴 도메인" section mapping the 4 entities → tables, PK, and the `@LogTarget` relationship.

- [ ] **Step 3: Edit `TASK.md`**

Add backlog items: (a) `/api/menus` p95 measurement → cache decision (spec §4.4); (b) DYN board resolver permission filtering (Plan 2 / spec §4.3); (c) optional `CmenuaL` permission-change log (spec §3.4).

- [ ] **Step 4: Commit**

```bash
git add it_backend/CLAUDE.md it_backend/docs/guides/data-model.md TASK.md
git commit -m "docs(menu): document menu domain tables, audit entity, and backlog"
```

---

## Self-review checklist (run before handing off)

- [ ] **Spec coverage:** §3.1 Cmenud ✓ (T3), §3.2 Cmenum ✓ (T4), §3.3 Cmenua ✓ (T5), §3.4 CmenumL ✓ (T4), §3.5 path recalc ✓ (T9), §3.6 resolver SPI ✓ (T8), §4.2 endpoints ✓ (T11), §4.3 server-side role filter ✓ (T8), §4.5 move ✓ (T9), §6 migration+seed ✓ (T1/T12). DYN board children = deferred to Plan 2 (noted). Caching §4.4 = not implemented by design (TASK note).
- [ ] **No placeholders:** the only template-with-ellipsis is the seed-data body (T12), which is inherently data entry from the live sidebar and has a concrete extraction step (T12.S1) + full INSERT column lists.
- [ ] **Type consistency:** `MenuDto.Node`/`UpsertRequest`/`ReorderRequest`/`MoveRequest`/`Route` used identically across services, controllers, tests. `nextMnuId()`, `findSubtreeByPathPrefix()`, `countActiveChildren()`, `findBySrePthAndDelYn()`, `findActiveByMnuId()` signatures match between Custom interface, Impl, repository, and call sites.
- [ ] **Verify before claiming done:** `./gradlew test` green (service unit tests) AND Task 13 manual smoke (boot validate + audit-log row written + 403 for non-admin) all pass.

---

## Execution handoff

After Plan 1 lands and Task 13 passes, **Plan 2 — Frontend cutover** covers: `app/types/menu.ts`, `app/utils/menuPresentation.ts` (MENU_ICON/MENU_BADGE), `useMenu`/`useAdminMenu`, `AppSidebar.vue` refactor (remove hardcoded tree), `AppBreadcrumb.vue`, `/admin/menus` (PrimeVue Tree DnD), `/admin/routes` (StyledDataTable), the board DYN resolver wiring on the backend, `adminLogs.ts` entry, middleware, and Vitest tests — plus the §6.4 seed-vs-code parity verification.
