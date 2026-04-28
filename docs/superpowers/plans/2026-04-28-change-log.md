# Change Log (Audit Log) 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 19개 업무 테이블에 대한 CUD 변경 이력을 JPA EntityListener 기반으로 동일 트랜잭션 내 로그 테이블에 자동 기록한다.

**Architecture:** `@LogTarget` 어노테이션이 붙은 엔티티에서 `@PostPersist`/`@PostUpdate` 이벤트 발생 시 `ChangeLogEntityListener`가 `ApplicationContextHolder`(정적 ApplicationContext 래퍼)를 경유해 Spring Bean인 `AuditLogPersister`를 획득하고, 리플렉션 기반 `@Column(name)` 매칭으로 원본 엔티티 필드를 로그 엔티티에 복사하여 INSERT한다.

**Tech Stack:** Spring Boot 4.0.1, Java 25, JPA/Hibernate, Oracle 21c XE (ITPAPP@XEPDB1), Lombok, Mockito 5

---

## 파일 목록

| 작업 | 파일 | 유형 |
|------|------|------|
| 신규 | `it_backend/src/main/resources/sql/audit_log_ddl.sql` | DDL |
| 신규 | `...domain/audit/annotation/LogTarget.java` | 어노테이션 |
| 신규 | `...domain/audit/entity/BaseLogEntity.java` | 추상 엔티티 |
| 신규 | `...domain/audit/listener/ApplicationContextHolder.java` | Spring Bean |
| 신규 | `...domain/audit/listener/AuditLogPersister.java` | Spring Bean |
| 신규 | `...domain/audit/listener/ChangeLogEntityListener.java` | JPA 리스너 |
| 신규 | `...domain/audit/entity/BprojmL.java` ~ `CapplmL.java` | 로그 엔티티 19개 |
| 수정 | `...domain/entity/BaseEntity.java` | EntityListeners 추가 |
| 수정 | 업무 엔티티 19개 | @LogTarget 추가 |
| 신규 | `...domain/audit/listener/ChangeLogEntityListenerTest.java` | 단위 테스트 |

패키지 루트: `com.kdb.it`

---

## Task 1: DDL — 시퀀스 및 로그 테이블 생성

**Files:**
- Create: `it_backend/src/main/resources/sql/audit_log_ddl.sql`

- [ ] **Step 1: DDL 파일 생성**

```sql
-- ============================================================
-- 변경 로그(Audit Log) DDL
-- 실행 대상: Oracle 21c XE (ITPAPP@XEPDB1)
-- ============================================================

-- [1] 시퀀스 (테이블당 1개, 명명 규칙: S_{로그테이블명 without TAAABB_})
CREATE SEQUENCE S_BPROJML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BITEMML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BCOSTML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BTERML   START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BPLANML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BPROJAL  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BBUGTML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BASCTL   START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BCHKLCL  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BCMMTML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BEVALML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BPERFML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BPOVWML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BPQNAML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BRSTML   START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_BSCHDML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_CUSERIL  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_CCODEML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;
CREATE SEQUENCE S_CAPPLML  START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;

-- [2] 로그 테이블 (CTAS 방식 — 원본 테이블 컬럼 타입 자동 복사)
-- 패턴: 감사 컬럼 4개를 앞에 추가하고 원본 컬럼 전체를 복사
-- 실행 후 [3] ALTER로 NOT NULL 및 PK를 설정한다

-- BPROJML
CREATE TABLE TAAABB_BPROJML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BPROJM t WHERE 1 = 0;

-- BITEMML
CREATE TABLE TAAABB_BITEMML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BITEMM t WHERE 1 = 0;

-- BCOSTML
CREATE TABLE TAAABB_BCOSTML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BCOSTM t WHERE 1 = 0;

-- BTERML
CREATE TABLE TAAABB_BTERML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BTERMM t WHERE 1 = 0;

-- BPLANML
CREATE TABLE TAAABB_BPLANML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BPLANM t WHERE 1 = 0;

-- BPROJAL
CREATE TABLE TAAABB_BPROJAL AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BPROJA t WHERE 1 = 0;

-- BBUGTML
CREATE TABLE TAAABB_BBUGTML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BBUGTM t WHERE 1 = 0;

-- BASCTL
CREATE TABLE TAAABB_BASCTL AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BASCTM t WHERE 1 = 0;

-- BCHKLCL
CREATE TABLE TAAABB_BCHKLCL AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BCHKLC t WHERE 1 = 0;

-- BCMMTML
CREATE TABLE TAAABB_BCMMTML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BCMMTM t WHERE 1 = 0;

-- BEVALML
CREATE TABLE TAAABB_BEVALML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BEVALM t WHERE 1 = 0;

-- BPERFML
CREATE TABLE TAAABB_BPERFML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BPERFM t WHERE 1 = 0;

-- BPOVWML
CREATE TABLE TAAABB_BPOVWML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BPOVWM t WHERE 1 = 0;

-- BPQNAML
CREATE TABLE TAAABB_BPQNAML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BPQNAM t WHERE 1 = 0;

-- BRSTML
CREATE TABLE TAAABB_BRSTML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BRSLTM t WHERE 1 = 0;

-- BSCHDML
CREATE TABLE TAAABB_BSCHDML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_BSCHDM t WHERE 1 = 0;

-- CUSERIL
CREATE TABLE TAAABB_CUSERIL AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_CUSERI t WHERE 1 = 0;

-- CCODEML
CREATE TABLE TAAABB_CCODEML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_CCODEM t WHERE 1 = 0;

-- CAPPLML
CREATE TABLE TAAABB_CAPPLML AS
  SELECT CAST(NULL AS NUMBER)       AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))  AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6)) AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14)) AS CHG_USID,
         t.*
  FROM TAAABB_CAPPLM t WHERE 1 = 0;

-- [3] NOT NULL 설정 및 원본 PK 컬럼 nullable 처리 후 PK 추가
-- (CTAS는 원본 NOT NULL 제약을 복사하므로 원본 PK 컬럼을 NULL 허용으로 변경)

ALTER TABLE TAAABB_BPROJML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BPROJML MODIFY (PRJ_MNG_NO NULL, PRJ_SNO NULL);
ALTER TABLE TAAABB_BPROJML ADD CONSTRAINT PK_BPROJML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BITEMML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BITEMML MODIFY (GCL_MNG_NO NULL, GCL_SNO NULL);
ALTER TABLE TAAABB_BITEMML ADD CONSTRAINT PK_BITEMML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BCOSTML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BCOSTML MODIFY (IT_MNGC_NO NULL, IT_MNGC_SNO NULL);
ALTER TABLE TAAABB_BCOSTML ADD CONSTRAINT PK_BCOSTML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BTERML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BTERML MODIFY (TMN_MNG_NO NULL, TMN_SNO NULL);
ALTER TABLE TAAABB_BTERML ADD CONSTRAINT PK_BTERML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BPLANML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BPLANML MODIFY (PLN_MNG_NO NULL);
ALTER TABLE TAAABB_BPLANML ADD CONSTRAINT PK_BPLANML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BPROJAL MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BPROJAL MODIFY (PRJ_MNG_NO NULL, BZ_MNG_NO NULL);
ALTER TABLE TAAABB_BPROJAL ADD CONSTRAINT PK_BPROJAL PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BBUGTML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BBUGTML MODIFY (BG_MNG_NO NULL, BG_SNO NULL);
ALTER TABLE TAAABB_BBUGTML ADD CONSTRAINT PK_BBUGTML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BASCTL MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BASCTL MODIFY (ASCT_ID NULL, ASCT_STS NULL);
ALTER TABLE TAAABB_BASCTL ADD CONSTRAINT PK_BASCTL PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BCHKLCL MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BCHKLCL MODIFY (ASCT_ID NULL, CKG_ITM_C NULL);
ALTER TABLE TAAABB_BCHKLCL ADD CONSTRAINT PK_BCHKLCL PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BCMMTML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BCMMTML MODIFY (ASCT_ID NULL, ENO NULL, VLR_TP NULL);
ALTER TABLE TAAABB_BCMMTML ADD CONSTRAINT PK_BCMMTML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BEVALML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BEVALML MODIFY (ASCT_ID NULL, ENO NULL, CKG_ITM_C NULL);
ALTER TABLE TAAABB_BEVALML ADD CONSTRAINT PK_BEVALML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BPERFML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BPERFML MODIFY (ASCT_ID NULL, DTP_SNO NULL);
ALTER TABLE TAAABB_BPERFML ADD CONSTRAINT PK_BPERFML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BPOVWML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BPOVWML MODIFY (ASCT_ID NULL);
ALTER TABLE TAAABB_BPOVWML ADD CONSTRAINT PK_BPOVWML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BPQNAML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BPQNAML MODIFY (QTN_ID NULL);
ALTER TABLE TAAABB_BPQNAML ADD CONSTRAINT PK_BPQNAML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BRSTML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BRSTML MODIFY (ASCT_ID NULL);
ALTER TABLE TAAABB_BRSTML ADD CONSTRAINT PK_BRSTML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_BSCHDML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_BSCHDML MODIFY (ASCT_ID NULL, ENO NULL, DSD_DT NULL, DSD_TM NULL);
ALTER TABLE TAAABB_BSCHDML ADD CONSTRAINT PK_BSCHDML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_CUSERIL MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_CUSERIL MODIFY (ENO NULL);
ALTER TABLE TAAABB_CUSERIL ADD CONSTRAINT PK_CUSERIL PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_CCODEML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_CCODEML MODIFY (C_ID NULL, STT_DT NULL);
ALTER TABLE TAAABB_CCODEML ADD CONSTRAINT PK_CCODEML PRIMARY KEY (LOG_SNO);

ALTER TABLE TAAABB_CAPPLML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TAAABB_CAPPLML MODIFY (APF_MNG_NO NULL);
ALTER TABLE TAAABB_CAPPLML ADD CONSTRAINT PK_CAPPLML PRIMARY KEY (LOG_SNO);
```

- [ ] **Step 2: SQL Developer 또는 sqlplus로 DDL 실행**

```bash
# sqlplus 사용 시 (it_backend 디렉토리에서)
sqlplus ITPAPP/[비밀번호]@localhost:1521/XEPDB1 @src/main/resources/sql/audit_log_ddl.sql
```

예상 결과: `Sequence created.` 19회, `Table created.` 19회, `Table altered.` 각 테이블당 3회

- [ ] **Step 3: 테이블 생성 확인**

```sql
SELECT table_name FROM user_tables
WHERE table_name LIKE 'TAAABB_%L%'
ORDER BY table_name;
-- 19개 로그 테이블 조회됨 확인
```

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/resources/sql/audit_log_ddl.sql
git commit -m "feat: add audit log DDL (19 sequences + 19 log tables)"
```

---

## Task 2: @LogTarget 어노테이션 + BaseLogEntity

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/audit/annotation/LogTarget.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/audit/entity/BaseLogEntity.java`

- [ ] **Step 1: LogTarget.java 작성**

```java
package com.kdb.it.domain.audit.annotation;

import com.kdb.it.domain.audit.entity.BaseLogEntity;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface LogTarget {
    /** 대응하는 로그 엔티티 클래스 */
    Class<? extends BaseLogEntity> entity();
}
```

- [ ] **Step 2: BaseLogEntity.java 작성**

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * 변경 로그 엔티티 공통 기반 클래스
 *
 * <p>LOG_SNO(@Id)는 각 하위 클래스에서 선언한다.
 * 감사 컬럼 3개(CHG_TP/CHG_DTM/CHG_USID)와 BaseEntity 공통 컬럼을 포함한다.
 * @MappedSuperclass이므로 별도 테이블이 생성되지 않는다.</p>
 */
@MappedSuperclass
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public abstract class BaseLogEntity {

    /** 변경유형: 'C'=생성, 'U'=수정, 'D'=삭제 */
    @Column(name = "CHG_TP", length = 1, nullable = false)
    private String chgTp;

    /** 변경일시 */
    @Column(name = "CHG_DTM", nullable = false)
    private LocalDateTime chgDtm;

    /** 변경자 사번 */
    @Column(name = "CHG_USID", length = 14)
    private String chgUsid;

    // BaseEntity 공통 컬럼 (로그 시점의 값을 스냅샷으로 보관)
    @Column(name = "DEL_YN",       length = 1)   private String      delYn;
    @Column(name = "GUID",         length = 38)  private String      guid;
    @Column(name = "GUID_PRG_SNO")               private Integer     guidPrgSno;
    @Column(name = "FST_ENR_DTM")               private LocalDateTime fstEnrDtm;
    @Column(name = "FST_ENR_USID", length = 14) private String      fstEnrUsid;
    @Column(name = "LST_CHG_DTM")               private LocalDateTime lstChgDtm;
    @Column(name = "LST_CHG_USID", length = 14) private String      lstChgUsid;
}
```

- [ ] **Step 3: 빌드 확인**

```bash
cd it_backend && ./gradlew compileJava
```

예상 결과: `BUILD SUCCESSFUL`

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/audit/
git commit -m "feat: add @LogTarget annotation and BaseLogEntity"
```

---

## Task 3: ApplicationContextHolder + AuditLogPersister + ChangeLogEntityListener

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/audit/listener/ApplicationContextHolder.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/audit/listener/AuditLogPersister.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/audit/listener/ChangeLogEntityListener.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/audit/listener/ChangeLogEntityListenerTest.java`

- [ ] **Step 1: 테스트 먼저 작성 (RED)**

```java
// it_backend/src/test/java/com/kdb/it/domain/audit/listener/ChangeLogEntityListenerTest.java
package com.kdb.it.domain.audit.listener;

import com.kdb.it.domain.audit.annotation.LogTarget;
import com.kdb.it.domain.audit.entity.BaseLogEntity;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChangeLogEntityListenerTest {

    // 테스트용 로그 엔티티
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @SuperBuilder
    static class SampleLogEntity extends BaseLogEntity {
        @Column(name = "SAMPLE_ID") private String sampleId;
    }

    // 테스트용 소스 엔티티 (@LogTarget 있음)
    @LogTarget(entity = SampleLogEntity.class)
    @Entity
    @Table(name = "TAAABB_SAMPLE")
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @SuperBuilder
    static class SampleEntity extends BaseEntity {
        @Id
        @Column(name = "SAMPLE_ID") private String sampleId;
    }

    // @LogTarget 없는 엔티티
    @Entity
    @Table(name = "TAAABB_NO_LOG")
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @SuperBuilder
    static class NoLogEntity extends BaseEntity {
        @Id
        @Column(name = "ID") private String id;
    }

    private ChangeLogEntityListener listener;

    @BeforeEach
    void setUp() {
        listener = new ChangeLogEntityListener();
    }

    @Test
    @DisplayName("@PostPersist → persist('C') 호출")
    void onPostPersist_callsPersistWithC() {
        try (MockedStatic<ApplicationContextHolder> mocked = mockStatic(ApplicationContextHolder.class)) {
            AuditLogPersister mockPersister = mock(AuditLogPersister.class);
            mocked.when(() -> ApplicationContextHolder.getBean(AuditLogPersister.class))
                  .thenReturn(mockPersister);

            SampleEntity entity = SampleEntity.builder().sampleId("S001").build();
            listener.onPostPersist(entity);

            verify(mockPersister).persist(eq(entity), eq(SampleLogEntity.class), eq("C"));
        }
    }

    @Test
    @DisplayName("@PostUpdate DEL_YN=null → persist('U') 호출")
    void onPostUpdate_notDeleted_callsPersistWithU() {
        try (MockedStatic<ApplicationContextHolder> mocked = mockStatic(ApplicationContextHolder.class)) {
            AuditLogPersister mockPersister = mock(AuditLogPersister.class);
            mocked.when(() -> ApplicationContextHolder.getBean(AuditLogPersister.class))
                  .thenReturn(mockPersister);

            SampleEntity entity = SampleEntity.builder().sampleId("S001").build();
            listener.onPostUpdate(entity);

            verify(mockPersister).persist(eq(entity), eq(SampleLogEntity.class), eq("U"));
        }
    }

    @Test
    @DisplayName("@PostUpdate DEL_YN='Y' → persist('D') 호출")
    void onPostUpdate_deleted_callsPersistWithD() throws Exception {
        try (MockedStatic<ApplicationContextHolder> mocked = mockStatic(ApplicationContextHolder.class)) {
            AuditLogPersister mockPersister = mock(AuditLogPersister.class);
            mocked.when(() -> ApplicationContextHolder.getBean(AuditLogPersister.class))
                  .thenReturn(mockPersister);

            SampleEntity entity = SampleEntity.builder().sampleId("S001").build();
            // BaseEntity.delYn 필드를 리플렉션으로 'Y'로 설정
            var delYnField = BaseEntity.class.getDeclaredField("delYn");
            delYnField.setAccessible(true);
            delYnField.set(entity, "Y");

            listener.onPostUpdate(entity);

            verify(mockPersister).persist(eq(entity), eq(SampleLogEntity.class), eq("D"));
        }
    }

    @Test
    @DisplayName("@LogTarget 없는 엔티티 → AuditLogPersister 호출 안 함")
    void onPostPersist_noLogTarget_doesNotCallPersister() {
        try (MockedStatic<ApplicationContextHolder> mocked = mockStatic(ApplicationContextHolder.class)) {
            NoLogEntity entity = NoLogEntity.builder().build();
            listener.onPostPersist(entity);

            mocked.verify(() -> ApplicationContextHolder.getBean(any()), never());
        }
    }
}
```

- [ ] **Step 2: 테스트 실행 — 컴파일 오류 확인 (RED)**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.audit.listener.ChangeLogEntityListenerTest"
```

예상 결과: 컴파일 오류 (`ApplicationContextHolder`, `AuditLogPersister`, `ChangeLogEntityListener` 미존재)

- [ ] **Step 3: ApplicationContextHolder.java 작성**

```java
package com.kdb.it.domain.audit.listener;

import org.springframework.context.ApplicationContext;
import org.springframework.context.ApplicationContextAware;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;

/**
 * JPA EntityListener에서 Spring Bean에 접근하기 위한 정적 ApplicationContext 래퍼.
 *
 * <p>EntityListener 인스턴스는 Spring DI 대상이 아니므로 ApplicationContext를
 * 정적 필드로 보관하여 {@link AuditLogPersister}를 조회한다.</p>
 */
@Component
public class ApplicationContextHolder implements ApplicationContextAware {

    private static ApplicationContext context;

    @Override
    public void setApplicationContext(@NonNull ApplicationContext applicationContext) {
        context = applicationContext;
    }

    public static <T> T getBean(Class<T> beanClass) {
        return context.getBean(beanClass);
    }
}
```

- [ ] **Step 4: AuditLogPersister.java 작성**

```java
package com.kdb.it.domain.audit.listener;

import com.kdb.it.domain.audit.entity.BaseLogEntity;
import jakarta.persistence.Column;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 변경 로그 엔티티를 현재 트랜잭션에 INSERT하는 Spring Bean.
 *
 * <p>원본 엔티티와 로그 엔티티의 @Column(name) 값이 일치하는 필드를 리플렉션으로 복사한다.
 * EntityListener에서 ApplicationContextHolder를 통해 획득한다.</p>
 */
@Component
public class AuditLogPersister {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * 로그 엔티티를 현재 JPA 트랜잭션에 persist한다.
     *
     * @param source   원본 엔티티 (@LogTarget이 붙은 엔티티 인스턴스)
     * @param logClass 로그 엔티티 클래스 (@LogTarget.entity() 값)
     * @param chgTp    변경유형 ('C'=생성, 'U'=수정, 'D'=삭제)
     */
    public void persist(Object source, Class<? extends BaseLogEntity> logClass, String chgTp) {
        try {
            Constructor<? extends BaseLogEntity> ctor = logClass.getDeclaredConstructor();
            ctor.setAccessible(true);
            BaseLogEntity logEntity = ctor.newInstance();

            setField(logEntity, "chgTp",   chgTp);
            setField(logEntity, "chgDtm",  LocalDateTime.now());
            setField(logEntity, "chgUsid", currentUserId());

            copyColumnFields(source, logEntity);

            entityManager.persist(logEntity);
        } catch (Exception e) {
            throw new RuntimeException("감사 로그 persist 실패: " + logClass.getSimpleName(), e);
        }
    }

    /** @Column(name) 기준으로 source → target 필드 값을 복사한다. */
    private void copyColumnFields(Object source, Object target) {
        Map<String, Object> colValueMap = buildColumnValueMap(source);
        applyColumnValues(target, colValueMap);
    }

    private Map<String, Object> buildColumnValueMap(Object obj) {
        Map<String, Object> map = new HashMap<>();
        Class<?> clazz = obj.getClass();
        while (clazz != null && clazz != Object.class) {
            for (Field f : clazz.getDeclaredFields()) {
                Column col = f.getAnnotation(Column.class);
                if (col != null) {
                    f.setAccessible(true);
                    try {
                        Object val = f.get(obj);
                        if (val != null) {
                            map.put(col.name().toUpperCase(), val);
                        }
                    } catch (IllegalAccessException ignored) {}
                }
            }
            clazz = clazz.getSuperclass();
        }
        return map;
    }

    private void applyColumnValues(Object obj, Map<String, Object> colValueMap) {
        Class<?> clazz = obj.getClass();
        while (clazz != null && clazz != Object.class) {
            for (Field f : clazz.getDeclaredFields()) {
                Column col = f.getAnnotation(Column.class);
                if (col != null) {
                    Object val = colValueMap.get(col.name().toUpperCase());
                    if (val != null) {
                        f.setAccessible(true);
                        try {
                            f.set(obj, val);
                        } catch (IllegalAccessException ignored) {}
                    }
                }
            }
            clazz = clazz.getSuperclass();
        }
    }

    private void setField(Object obj, String fieldName, Object value) {
        Class<?> clazz = obj.getClass();
        while (clazz != null && clazz != Object.class) {
            try {
                Field f = clazz.getDeclaredField(fieldName);
                f.setAccessible(true);
                f.set(obj, value);
                return;
            } catch (NoSuchFieldException e) {
                clazz = clazz.getSuperclass();
            } catch (IllegalAccessException e) {
                throw new RuntimeException("필드 접근 오류: " + fieldName, e);
            }
        }
    }

    private String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return null;
    }
}
```

- [ ] **Step 5: ChangeLogEntityListener.java 작성**

```java
package com.kdb.it.domain.audit.listener;

import com.kdb.it.domain.audit.annotation.LogTarget;
import com.kdb.it.domain.audit.entity.BaseLogEntity;
import com.kdb.it.domain.entity.BaseEntity;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostUpdate;

/**
 * JPA EntityListener — CUD 이벤트를 감지하여 변경 로그를 기록한다.
 *
 * <p>@LogTarget이 없는 엔티티는 무시한다.
 * Soft Delete(@PostUpdate DEL_YN='Y')는 'D'로 기록한다.
 * @PostRemove는 사용하지 않는다(물리 삭제 없음).</p>
 */
public class ChangeLogEntityListener {

    @PostPersist
    public void onPostPersist(Object entity) {
        record(entity, "C");
    }

    @PostUpdate
    public void onPostUpdate(Object entity) {
        String chgTp = isDeleted(entity) ? "D" : "U";
        record(entity, chgTp);
    }

    private void record(Object entity, String chgTp) {
        LogTarget annotation = entity.getClass().getAnnotation(LogTarget.class);
        if (annotation == null) {
            return;
        }
        Class<? extends BaseLogEntity> logClass = annotation.entity();
        AuditLogPersister persister = ApplicationContextHolder.getBean(AuditLogPersister.class);
        persister.persist(entity, logClass, chgTp);
    }

    private boolean isDeleted(Object entity) {
        if (entity instanceof BaseEntity baseEntity) {
            return "Y".equals(baseEntity.getDelYn());
        }
        return false;
    }
}
```

- [ ] **Step 6: 테스트 재실행 — 통과 확인 (GREEN)**

```bash
cd it_backend && ./gradlew test --tests "com.kdb.it.domain.audit.listener.ChangeLogEntityListenerTest"
```

예상 결과: 4개 테스트 모두 PASS

- [ ] **Step 7: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/audit/listener/
git add it_backend/src/test/java/com/kdb/it/domain/audit/listener/
git commit -m "feat: add ChangeLogEntityListener, AuditLogPersister, ApplicationContextHolder"
```

---

## Task 4: 로그 엔티티 — 예산 도메인 (8개)

**Files:**
- Create: `...domain/audit/entity/BprojmL.java`
- Create: `...domain/audit/entity/BitemmL.java`
- Create: `...domain/audit/entity/BcostmL.java`
- Create: `...domain/audit/entity/BtermmL.java`
- Create: `...domain/audit/entity/BplanmL.java`
- Create: `...domain/audit/entity/BprojaL.java`
- Create: `...domain/audit/entity/BbugtmL.java`
- Create: `...domain/audit/entity/BasctmL.java`

- [ ] **Step 1: BprojmL.java 작성** (TAAABB_BPROJML — 정보화사업)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "TAAABB_BPROJML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BprojmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BPROJML")
    @SequenceGenerator(name = "GEN_BPROJML", sequenceName = "S_BPROJML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "PRJ_MNG_NO",    length = 32)  private String     prjMngNo;
    @Column(name = "PRJ_SNO")                     private Integer    prjSno;
    @Column(name = "PRJ_NM",        length = 200) private String     prjNm;
    @Column(name = "PRJ_TP",        length = 100) private String     prjTp;
    @Column(name = "SVN_DPM",       length = 100) private String     svnDpm;
    @Column(name = "IT_DPM",        length = 100) private String     itDpm;
    @Column(name = "PRJ_BG",        precision = 15, scale = 2) private BigDecimal prjBg;
    @Column(name = "NYY_PRJ_BG",    precision = 15, scale = 2) private BigDecimal nyyPrjBg;
    @Column(name = "STT_DT")                      private LocalDate  sttDt;
    @Column(name = "END_DT")                      private LocalDate  endDt;
    @Column(name = "SVN_DPM_CGPR",  length = 32)  private String     svnDpmCgpr;
    @Column(name = "IT_DPM_CGPR",   length = 32)  private String     itDpmCgpr;
    @Column(name = "SVN_DPM_TLR",   length = 32)  private String     svnDpmTlr;
    @Column(name = "IT_DPM_TLR",    length = 32)  private String     itDpmTlr;
    @Column(name = "EDRT",          length = 32)  private String     edrt;
    @Column(name = "PRJ_DES",       length = 1000) private String    prjDes;
    @Column(name = "SAF",           length = 1000) private String    saf;
    @Column(name = "NCS",           length = 1000) private String    ncs;
    @Column(name = "XPT_EFF",       length = 1000) private String    xptEff;
    @Column(name = "PLM",           length = 1000) private String    plm;
    @Column(name = "PRJ_RNG",       length = 1000) private String    prjRng;
    @Column(name = "PUL_PSG",       length = 1000) private String    pulPsg;
    @Column(name = "HRF_PLN",       length = 1000) private String    hrfPln;
    @Column(name = "BZ_DTT",        length = 32)  private String     bzDtt;
    @Column(name = "TCHN_TP",       length = 32)  private String     tchnTp;
    @Column(name = "MN_USR",        length = 32)  private String     mnUsr;
    @Column(name = "DPL_YN",        length = 1)   private String     dplYn;
    @Column(name = "LBL_FSG_TLM")                 private LocalDate  lblFsgTlm;
    @Column(name = "RPR_STS",       length = 32)  private String     rprSts;
    @Column(name = "LST_YN",        length = 1)   private String     lstYn;
    @Column(name = "PRJ_PUL_PTT",   precision = 3) private Integer   prjPulPtt;
    @Column(name = "PRJ_STS",       length = 32)  private String     prjSts;
    @Column(name = "BG_YY",         length = 4)   private String     bgYy;
    @Column(name = "SVN_HDQ",       length = 32)  private String     svnHdq;
    @Column(name = "ORN_YN",        length = 1)   private String     ornYn;
    @Column(name = "PUL_DTT",       length = 32)  private String     pulDtt;
}
```

- [ ] **Step 2: BitemmL.java 작성** (TAAABB_BITEMML — 프로젝트 품목)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "TAAABB_BITEMML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BitemmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BITEMML")
    @SequenceGenerator(name = "GEN_BITEMML", sequenceName = "S_BITEMML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "GCL_MNG_NO",  length = 32) private String     gclMngNo;
    @Column(name = "GCL_SNO")                  private Integer    gclSno;
    @Column(name = "PRJ_MNG_NO",  length = 32) private String     prjMngNo;
    @Column(name = "PRJ_SNO")                  private Integer    prjSno;
    @Column(name = "GCL_DTT",     length = 32) private String     gclDtt;
    @Column(name = "GCL_NM",      length = 100) private String    gclNm;
    @Column(name = "GCL_QTT",     precision = 9) private BigDecimal gclQtt;
    @Column(name = "CUR",         length = 10) private String     cur;
    @Column(name = "XCR",         precision = 15, scale = 4) private BigDecimal xcr;
    @Column(name = "XCR_BSE_DT")              private LocalDate  xcrBseDt;
    @Column(name = "BG_FDTN",     length = 100) private String    bgFdtn;
    @Column(name = "ITD_DT",      length = 32) private String     itdDt;
    @Column(name = "DFR_CLE",     length = 10) private String     dfrCle;
    @Column(name = "INF_PRT_YN",  length = 1)  private String     infPrtYn;
    @Column(name = "ITR_INFR_YN", length = 1)  private String     itrInfrYn;
    @Column(name = "LST_YN",      length = 1)  private String     lstYn;
    @Column(name = "GCL_AMT",     precision = 15) private BigDecimal gclAmt;
}
```

- [ ] **Step 3: BcostmL.java 작성** (TAAABB_BCOSTML — 전산관리비)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "TAAABB_BCOSTML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BcostmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BCOSTML")
    @SequenceGenerator(name = "GEN_BCOSTML", sequenceName = "S_BCOSTML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "IT_MNGC_NO",  length = 128) private String     itMngcNo;
    @Column(name = "IT_MNGC_SNO")               private Integer    itMngcSno;
    @Column(name = "LST_YN",      length = 4)   private String     lstYn;
    @Column(name = "IOE_C",       length = 400)  private String    ioeC;
    @Column(name = "CTT_NM",      length = 800)  private String    cttNm;
    @Column(name = "CTT_OPP",     length = 400)  private String    cttOpp;
    @Column(name = "IT_MNGC_BG",  precision = 15, scale = 2) private BigDecimal itMngcBg;
    @Column(name = "DFR_CLE",     length = 40)  private String     dfrCle;
    @Column(name = "FST_DFR_DT")               private LocalDate  fstDfrDt;
    @Column(name = "CUR",         length = 40)  private String     cur;
    @Column(name = "XCR",         precision = 9) private BigDecimal xcr;
    @Column(name = "XCR_BSE_DT")               private LocalDate  xcrBseDt;
    @Column(name = "INF_PRT_YN",  length = 4)  private String     infPrtYn;
    @Column(name = "IND_RSN",     length = 4000) private String   indRsn;
    @Column(name = "CGPR",        length = 128) private String     cgpr;
    @Column(name = "BICE_DPM",    length = 100) private String     biceDpm;
    @Column(name = "BICE_TEM",    length = 100) private String     biceTem;
    @Column(name = "BG_YY",       length = 4)   private String     bgYy;
    @Column(name = "ABUS_C",      length = 100) private String     abusC;
    @Column(name = "IT_MNGC_TP",  length = 100) private String     itMngcTp;
    @Column(name = "PUL_DTT",     length = 100) private String     pulDtt;
}
```

- [ ] **Step 4: BtermmL.java 작성** (TAAABB_BTERML — 단말기)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "TAAABB_BTERML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BtermmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BTERML")
    @SequenceGenerator(name = "GEN_BTERML", sequenceName = "S_BTERML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "TMN_MNG_NO",   length = 32)   private String     tmnMngNo;
    @Column(name = "TMN_SNO",      length = 32)   private String     tmnSno;
    @Column(name = "IT_MNGC_NO",   length = 32)   private String     itMngcNo;
    @Column(name = "IT_MNGC_SNO")                 private Integer    itMngcSno;
    @Column(name = "TMN_NM",       length = 100)  private String     tmnNm;
    @Column(name = "TMN_TUZ_MANR", length = 100)  private String     tmnTuzManr;
    @Column(name = "TMN_USG",      length = 100)  private String     tmnUsg;
    @Column(name = "TMN_SVC",      length = 100)  private String     tmnSvc;
    @Column(name = "TML_AMT",      precision = 15) private BigDecimal tmlAmt;
    @Column(name = "CUR",          length = 10)  private String     cur;
    @Column(name = "XCR",          precision = 9) private BigDecimal xcr;
    @Column(name = "XCR_BSE_DT")                 private LocalDate  xcrBseDt;
    @Column(name = "DFR_CLE",      length = 100) private String     dfrCle;
    @Column(name = "IND_RSN",      length = 1000) private String    indRsn;
    @Column(name = "CGPR",         length = 32)  private String     cgpr;
    @Column(name = "BICE_TEM",     length = 100) private String     biceTem;
    @Column(name = "BICE_DPM",     length = 100) private String     biceDpm;
    @Column(name = "RMK",          length = 1000) private String    rmk;
}
```

- [ ] **Step 5: BplanmL.java 작성** (TAAABB_BPLANML — IT부문계획)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal;

@Entity
@Table(name = "TAAABB_BPLANML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BplanmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BPLANML")
    @SequenceGenerator(name = "GEN_BPLANML", sequenceName = "S_BPLANML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "PLN_MNG_NO", length = 32) private String     plnMngNo;
    @Column(name = "PLN_TP",     length = 16) private String     plnTp;
    @Column(name = "PLN_YY",     length = 4)  private String     plnYy;
    @Lob
    @Column(name = "PLN_DTL_CONE")            private String     plnDtlCone;
    @Column(name = "TTL_BG",     precision = 15, scale = 2) private BigDecimal ttlBg;
    @Column(name = "CPT_BG",     precision = 15, scale = 2) private BigDecimal cptBg;
    @Column(name = "MNGC",       precision = 15, scale = 2) private BigDecimal mngc;
}
```

- [ ] **Step 6: BprojaL.java 작성** (TAAABB_BPROJAL — 계획-사업 연결)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "TAAABB_BPROJAL")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BprojaL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BPROJAL")
    @SequenceGenerator(name = "GEN_BPROJAL", sequenceName = "S_BPROJAL", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "PRJ_MNG_NO", length = 32) private String prjMngNo;
    @Column(name = "BZ_MNG_NO",  length = 32) private String bzMngNo;
}
```

- [ ] **Step 7: BbugtmL.java 작성** (TAAABB_BBUGTML — 예산편성률)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.math.BigDecimal;

@Entity
@Table(name = "TAAABB_BBUGTML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BbugtmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BBUGTML")
    @SequenceGenerator(name = "GEN_BBUGTML", sequenceName = "S_BBUGTML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "BG_MNG_NO",  length = 32)  private String     bgMngNo;
    @Column(name = "BG_SNO")                   private Integer    bgSno;
    @Column(name = "BG_YY",      length = 4)   private String     bgYy;
    @Column(name = "ORC_TB",     length = 10)  private String     orcTb;
    @Column(name = "ORC_PK_VL",  length = 32)  private String     orcPkVl;
    @Column(name = "ORC_SNO_VL")               private Integer    orcSnoVl;
    @Column(name = "IOE_C",      length = 100) private String     ioeC;
    @Column(name = "DUP_BG",     precision = 15, scale = 2) private BigDecimal dupBg;
    @Column(name = "DUP_RT",     precision = 3) private Integer   dupRt;
}
```

- [ ] **Step 8: BasctmL.java 작성** (TAAABB_BASCTL — 협의회 심의과제)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.time.LocalDate;

@Entity
@Table(name = "TAAABB_BASCTL")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BasctmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BASCTL")
    @SequenceGenerator(name = "GEN_BASCTL", sequenceName = "S_BASCTL", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "ASCT_ID",   length = 32)  private String    asctId;
    @Column(name = "PRJ_MNG_NO", length = 32) private String    prjMngNo;
    @Column(name = "PRJ_SNO")                 private Integer   prjSno;
    @Column(name = "ASCT_STS",  length = 20)  private String    asctSts;
    @Column(name = "DBR_TP",    length = 20)  private String    dbrTp;
    @Column(name = "CNRC_DT")                 private LocalDate cnrcDt;
    @Column(name = "CNRC_TM",   length = 10)  private String    cnrcTm;
    @Column(name = "CNRC_PLC",  length = 200) private String    cnrcPlc;
}
```

- [ ] **Step 9: 빌드 확인**

```bash
cd it_backend && ./gradlew compileJava
```

예상 결과: `BUILD SUCCESSFUL`

- [ ] **Step 10: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/audit/entity/
git commit -m "feat: add audit log entities for budget domain (BprojmL~BasctmL)"
```

---

## Task 5: 로그 엔티티 — 협의회 도메인 (8개)

**Files:**
- Create: `...domain/audit/entity/BchklcL.java`
- Create: `...domain/audit/entity/BcmmtmL.java`
- Create: `...domain/audit/entity/BevalmL.java`
- Create: `...domain/audit/entity/BperfmL.java`
- Create: `...domain/audit/entity/BpovwmL.java`
- Create: `...domain/audit/entity/BpqnamL.java`
- Create: `...domain/audit/entity/BrsltmL.java`
- Create: `...domain/audit/entity/BschdmL.java`

- [ ] **Step 1: BchklcL.java 작성** (TAAABB_BCHKLCL — 타당성 검토항목)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "TAAABB_BCHKLCL")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BchklcL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BCHKLCL")
    @SequenceGenerator(name = "GEN_BCHKLCL", sequenceName = "S_BCHKLCL", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "ASCT_ID",    length = 32)   private String  asctId;
    @Column(name = "CKG_ITM_C",  length = 20)   private String  ckgItmC;
    @Column(name = "CKG_CONE",   length = 2000) private String  ckgCone;
    @Column(name = "CKG_RCRD")                  private Integer ckgRcrd;
}
```

- [ ] **Step 2: BcmmtmL.java 작성** (TAAABB_BCMMTML — 평가위원)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "TAAABB_BCMMTML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BcmmtmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BCMMTML")
    @SequenceGenerator(name = "GEN_BCMMTML", sequenceName = "S_BCMMTML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "ASCT_ID", length = 32) private String asctId;
    @Column(name = "ENO",     length = 32) private String eno;
    @Column(name = "VLR_TP",  length = 32) private String vlrTp;
}
```

- [ ] **Step 3: BevalmL.java 작성** (TAAABB_BEVALML — 평가의견)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "TAAABB_BEVALML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BevalmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BEVALML")
    @SequenceGenerator(name = "GEN_BEVALML", sequenceName = "S_BEVALML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "ASCT_ID",    length = 32)   private String  asctId;
    @Column(name = "ENO",        length = 32)   private String  eno;
    @Column(name = "CKG_ITM_C",  length = 20)   private String  ckgItmC;
    @Column(name = "CKG_RCRD")                  private Integer ckgRcrd;
    @Column(name = "CKG_OPNN",   length = 2000) private String  ckgOpnn;
}
```

- [ ] **Step 4: BperfmL.java 작성** (TAAABB_BPERFML — 성과지표)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.time.LocalDate;

@Entity
@Table(name = "TAAABB_BPERFML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BperfmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BPERFML")
    @SequenceGenerator(name = "GEN_BPERFML", sequenceName = "S_BPERFML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "ASCT_ID",   length = 32)   private String    asctId;
    @Column(name = "DTP_SNO")                  private Integer   dtpSno;
    @Column(name = "DTP_NM",    length = 200)  private String    dtpNm;
    @Column(name = "DTP_CONE",  length = 1000) private String    dtpCone;
    @Column(name = "MSM_MANR",  length = 1000) private String    msmManr;
    @Column(name = "CLF",       length = 1000) private String    clf;
    @Column(name = "GL_NV",     length = 200)  private String    glNv;
    @Column(name = "MSM_STT_DT")              private LocalDate  msmSttDt;
    @Column(name = "MSM_END_DT")              private LocalDate  msmEndDt;
    @Column(name = "MSM_TPM",   length = 100)  private String    msmTpm;
    @Column(name = "MSM_CLE",   length = 100)  private String    msmCle;
}
```

- [ ] **Step 5: BpovwmL.java 작성** (TAAABB_BPOVWML — 사업개요)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "TAAABB_BPOVWML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BpovwmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BPOVWML")
    @SequenceGenerator(name = "GEN_BPOVWML", sequenceName = "S_BPOVWML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "ASCT_ID",    length = 32)   private String  asctId;
    @Column(name = "PRJ_NM",     length = 200)  private String  prjNm;
    @Column(name = "PRJ_TRM",    length = 100)  private String  prjTrm;
    @Column(name = "NCS",        length = 1000) private String  ncs;
    @Column(name = "PRJ_BG")                    private Long    prjBg;
    @Column(name = "EDRT",       length = 32)   private String  edrt;
    @Column(name = "PRJ_DES",    length = 1000) private String  prjDes;
    @Column(name = "LGL_RGL_YN", length = 1)    private String  lglRglYn;
    @Column(name = "LGL_RGL_NM", length = 500)  private String  lglRglNm;
    @Column(name = "XPT_EFF",    length = 1000) private String  xptEff;
    @Column(name = "KPN_TP",     length = 10)   private String  kpnTp;
    @Column(name = "FL_MNG_NO",  length = 32)   private String  flMngNo;
}
```

- [ ] **Step 6: BpqnamL.java 작성** (TAAABB_BPQNAML — 사전질의응답)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "TAAABB_BPQNAML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BpqnamL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BPQNAML")
    @SequenceGenerator(name = "GEN_BPQNAML", sequenceName = "S_BPQNAML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "QTN_ID",    length = 32)   private String qtnId;
    @Column(name = "ASCT_ID",   length = 32)   private String asctId;
    @Column(name = "QTN_ENO",   length = 32)   private String qtnEno;
    @Column(name = "QTN_CONE",  length = 4000) private String qtnCone;
    @Column(name = "REP_ENO",   length = 32)   private String repEno;
    @Column(name = "REP_CONE",  length = 4000) private String repCone;
    @Column(name = "REP_YN",    length = 1)    private String repYn;
}
```

- [ ] **Step 7: BrsltmL.java 작성** (TAAABB_BRSTML — 결과서)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "TAAABB_BRSTML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BrsltmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BRSTML")
    @SequenceGenerator(name = "GEN_BRSTML", sequenceName = "S_BRSTML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "ASCT_ID",   length = 32)   private String asctId;
    @Column(name = "SYN_OPNN",  length = 4000) private String synOpnn;
    @Column(name = "CKG_OPNN",  length = 4000) private String ckgOpnn;
    @Column(name = "FL_MNG_NO", length = 32)   private String flMngNo;
}
```

- [ ] **Step 8: BschdmL.java 작성** (TAAABB_BSCHDML — 일정)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.time.LocalDate;

@Entity
@Table(name = "TAAABB_BSCHDML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BschdmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BSCHDML")
    @SequenceGenerator(name = "GEN_BSCHDML", sequenceName = "S_BSCHDML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "ASCT_ID", length = 32) private String    asctId;
    @Column(name = "ENO",     length = 32) private String    eno;
    @Column(name = "DSD_DT")              private LocalDate  dsdDt;
    @Column(name = "DSD_TM",  length = 10) private String   dsdTm;
    @Column(name = "PSB_YN",  length = 1)  private String   psbYn;
}
```

- [ ] **Step 9: 빌드 확인**

```bash
cd it_backend && ./gradlew compileJava
```

- [ ] **Step 10: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/audit/entity/
git commit -m "feat: add audit log entities for council domain (BchklcL~BschdmL)"
```

---

## Task 6: 로그 엔티티 — 공통 도메인 (3개)

**Files:**
- Create: `...domain/audit/entity/CuserIL.java`
- Create: `...domain/audit/entity/CcodemL.java`
- Create: `...domain/audit/entity/CapplmL.java`

- [ ] **Step 1: CuserIL.java 작성** (TAAABB_CUSERIL — 사용자 정보)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "TAAABB_CUSERIL")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class CuserIL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_CUSERIL")
    @SequenceGenerator(name = "GEN_CUSERIL", sequenceName = "S_CUSERIL", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "ENO",              length = 32)  private String eno;
    @Column(name = "USR_ECY_PWD",      length = 64)  private String usrEcyPwd;
    @Column(name = "BBR_C",            length = 3)   private String bbrC;
    @Column(name = "CADR_TPN",         length = 20)  private String cadrTpn;
    @Column(name = "DTC_BBR_C",        length = 3)   private String dtcBbrC;
    @Column(name = "DTS_DTL_CONE",     length = 2000) private String dtsDtlCone;
    @Column(name = "ETR_MIL_ADDR_NM",  length = 200) private String etrMilAddrNm;
    @Column(name = "INLE_NO",          length = 20)  private String inleNo;
    @Column(name = "PT_C",             length = 5)   private String ptC;
    @Column(name = "PT_C_NM",          length = 200) private String ptCNm;
    @Column(name = "TEM_C",            length = 5)   private String temC;
    @Column(name = "TEM_NM",           length = 100) private String temNm;
    @Column(name = "USR_NM",           length = 100) private String usrNm;
    @Column(name = "USR_WREN_NM",      length = 100) private String usrWrenNm;
    @Column(name = "CPN_TPN",          length = 100) private String cpnTpn;
}
```

- [ ] **Step 2: CcodemL.java 작성** (TAAABB_CCODEML — 공통코드)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.time.LocalDate;

@Entity
@Table(name = "TAAABB_CCODEML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class CcodemL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_CCODEML")
    @SequenceGenerator(name = "GEN_CCODEML", sequenceName = "S_CCODEML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "C_ID",       length = 32)  private String    cdId;
    @Column(name = "C_NM",       length = 100) private String    cdNm;
    @Column(name = "CDVA",       length = 100) private String    cdva;
    @Column(name = "C_DES",      length = 500) private String    cdDes;
    @Column(name = "CTT_TP",     length = 100) private String    cttTp;
    @Column(name = "CTT_TP_DES", length = 500) private String    cttTpDes;
    @Column(name = "C_SQN")                   private Integer   cdSqn;
    @Column(name = "STT_DT")                  private LocalDate sttDt;
    @Column(name = "END_DT")                  private LocalDate endDt;
}
```

- [ ] **Step 3: CapplmL.java 작성** (TAAABB_CAPPLML — 신청서 마스터)

```java
package com.kdb.it.domain.audit.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import java.time.LocalDate;

@Entity
@Table(name = "TAAABB_CAPPLML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class CapplmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_CAPPLML")
    @SequenceGenerator(name = "GEN_CAPPLML", sequenceName = "S_CAPPLML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    @Column(name = "APF_MNG_NO", length = 32)   private String    apfMngNo;
    @Column(name = "APF_STS",    length = 32)   private String    apfSts;
    @Column(name = "APF_NM",     length = 800)  private String    apfNm;
    @Lob
    @Column(name = "APF_DTL_CONE")              private String    apfDtlCone;
    @Column(name = "RQS_ENO",    length = 32)   private String    rqsEno;
    @Column(name = "RQS_DT")                    private LocalDate rqsDt;
    @Column(name = "RQS_OPNN",   length = 1000) private String    rqsOpnn;
}
```

- [ ] **Step 4: 빌드 확인**

```bash
cd it_backend && ./gradlew compileJava
```

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/audit/entity/
git commit -m "feat: add audit log entities for common domain (CuserIL, CcodemL, CapplmL)"
```

---

## Task 7: 기존 파일 변경 — BaseEntity + 19개 업무 엔티티 @LogTarget 추가

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/entity/BaseEntity.java`
- Modify: 19개 업무 엔티티 파일 (각 1줄 추가)

- [ ] **Step 1: BaseEntity.java @EntityListeners 수정**

`BaseEntity.java:55` 라인을 수정:
```java
// 변경 전
@EntityListeners(AuditingEntityListener.class)

// 변경 후
@EntityListeners({AuditingEntityListener.class, ChangeLogEntityListener.class})
```

import 추가:
```java
import com.kdb.it.domain.audit.listener.ChangeLogEntityListener;
```

- [ ] **Step 2: 예산 도메인 엔티티에 @LogTarget 추가**

각 파일 상단 `@Entity` 위에 어노테이션 추가. import 추가 필요:
```java
import com.kdb.it.domain.audit.annotation.LogTarget;
import com.kdb.it.domain.audit.entity.XxxL;  // 대응 로그 엔티티
```

```java
// Bprojm.java (@Entity 위에 추가)
@LogTarget(entity = BprojmL.class)

// Bitemm.java
@LogTarget(entity = BitemmL.class)

// Bcostm.java
@LogTarget(entity = BcostmL.class)

// Btermm.java
@LogTarget(entity = BtermmL.class)

// Bplanm.java
@LogTarget(entity = BplanmL.class)

// Bproja.java
@LogTarget(entity = BprojaL.class)

// Bbugtm.java
@LogTarget(entity = BbugtmL.class)
```

- [ ] **Step 3: 협의회 도메인 엔티티에 @LogTarget 추가**

```java
// Basctm.java
@LogTarget(entity = BasctmL.class)

// Bchklc.java
@LogTarget(entity = BchklcL.class)

// Bcmmtm.java
@LogTarget(entity = BcmmtmL.class)

// Bevalm.java
@LogTarget(entity = BevalmL.class)

// Bperfm.java
@LogTarget(entity = BperfmL.class)

// Bpovwm.java
@LogTarget(entity = BpovwmL.class)

// Bpqnam.java
@LogTarget(entity = BpqnamL.class)

// Brsltm.java
@LogTarget(entity = BrsltmL.class)

// Bschdm.java
@LogTarget(entity = BschdmL.class)
```

- [ ] **Step 4: 공통 도메인 엔티티에 @LogTarget 추가**

```java
// CuserI.java
@LogTarget(entity = CuserIL.class)

// Ccodem.java
@LogTarget(entity = CcodemL.class)

// Capplm.java
@LogTarget(entity = CapplmL.class)
```

- [ ] **Step 5: 전체 빌드 확인**

```bash
cd it_backend && ./gradlew build
```

예상 결과: `BUILD SUCCESSFUL` (테스트 포함)

- [ ] **Step 6: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/entity/BaseEntity.java
git add it_backend/src/main/java/com/kdb/it/domain/budget/
git add it_backend/src/main/java/com/kdb/it/domain/council/
git add it_backend/src/main/java/com/kdb/it/common/
git commit -m "feat: wire up @LogTarget on 19 entities and add ChangeLogEntityListener to BaseEntity"
```

---

## Task 8: 통합 검증

- [ ] **Step 1: 서버 기동**

```bash
cd it_backend && ./gradlew bootRun
```

예상 결과: 서버 정상 기동 (`Started ItApplication`)
Hibernate DDL 검증 오류 없음 확인 (application.properties의 `spring.jpa.hibernate.ddl-auto` 값이 `validate` 또는 `none`인지 확인)

- [ ] **Step 2: 프로젝트 생성 API 호출 — 로그 INSERT 확인**

```bash
curl -s -X POST http://localhost:8080/api/projects \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"prjNm":"테스트사업","prjTp":"신규","bgYy":"2026",...}'
```

- [ ] **Step 3: DB에서 로그 확인**

```sql
-- BPROJML에 CHG_TP='C' 로그 1건 생성 확인
SELECT LOG_SNO, CHG_TP, CHG_DTM, CHG_USID, PRJ_MNG_NO
FROM TAAABB_BPROJML
ORDER BY LOG_SNO DESC
FETCH FIRST 3 ROWS ONLY;
```

예상 결과: CHG_TP='C' 레코드 1건 확인

- [ ] **Step 4: 프로젝트 수정 API 호출**

```bash
curl -s -X PUT http://localhost:8080/api/projects/{prjMngNo} \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{"prjNm":"테스트사업 수정",...}'
```

DB 확인: CHG_TP='U' 레코드 1건 추가 확인

- [ ] **Step 5: 프로젝트 삭제(Soft Delete) API 호출**

```bash
curl -s -X DELETE http://localhost:8080/api/projects/{prjMngNo} \
  -H "Authorization: Bearer {accessToken}"
```

DB 확인: CHG_TP='D' 레코드 1건 추가 확인 (DEL_YN='Y'인 레코드의 스냅샷)

- [ ] **Step 6: 전체 테스트 실행**

```bash
cd it_backend && ./gradlew test
```

예상 결과: `ChangeLogEntityListenerTest` 포함 모든 테스트 PASS

- [ ] **Step 7: 최종 커밋**

```bash
git add .
git commit -m "feat: complete change log system implementation and integration verification"
```

---

## 참고: 트러블슈팅

**`LazyInitializationException` 발생 시**
- EntityListener는 트랜잭션 컨텍스트 내에서 실행되므로 일반적으로 발생하지 않음
- 발생 시 `@Transactional(propagation = MANDATORY)` 확인

**`NullPointerException: context is null` 발생 시**
- `ApplicationContextHolder.setApplicationContext()`가 호출되기 전에 EntityListener가 실행된 케이스
- Spring Boot 앱 기동 시 ApplicationContext 초기화 순서 확인
- `@Component`가 누락된 경우 확인

**로그 엔티티 필드 복사 안 됨**
- `AuditLogPersister.buildColumnValueMap()` 에서 클래스 계층 순회 확인
- 원본 엔티티의 `@Column(name)` 값과 로그 엔티티의 `@Column(name)` 값이 일치하는지 확인 (대소문자 무관 — `.toUpperCase()` 처리)

**`spring.jpa.hibernate.ddl-auto=validate` 오류**
- DDL을 먼저 실행했는지 확인 (Task 1)
- 로그 테이블 컬럼 수/타입이 JPA 엔티티 정의와 일치하는지 확인
