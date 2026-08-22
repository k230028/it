# 변경 로그(Audit Log) 시스템 — 상세 설계 문서

- **작성일**: 2026-04-28
- **버전**: v2.0 (22자리 순환 시퀀스 + BGDOCM/BRDOCM/BRIVGM 추가)
- **대상 프로젝트**: IT Portal (com.kdb.it)
- **참조 계획서**: `docs/superpowers/plans/2026-04-28-change-log.md`

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 19+3=22개 업무 테이블의 CUD 이력을 감사 목적으로 자동 보관 |
| **WHO** | 시스템 관리자·감사팀 (3,000명 임직원의 데이터 변경 추적) |
| **RISK** | 로그 INSERT 실패 시 업무 트랜잭션 롤백 → 데이터 정합성 보장이 최우선 |
| **SUCCESS** | 22개 대상 테이블 CUD 이벤트 발생 시 동일 트랜잭션 내 로그 INSERT 100% 보장 |
| **SCOPE** | 백엔드(Spring Boot 4) 전용. 로그 조회 UI / 비동기 전환은 제외 |

---

## 1. 목표

사용자의 CUD(Create / Update / Delete) 요청을 받는 **22개** 업무 테이블에 대해 변경 이력을 로그 테이블(`_L` 접미사)에 자동으로 기록한다.

- Read(조회)는 기록하지 않는다.
- `LOG_SNO`는 `{로그테이블명_Postfix}_{22자리_0패딩_시퀀스}` 형식의 **VARCHAR2(32)** 복합 문자열 PK를 사용한다.
- 시퀀스는 **CYCLE**(순환) 설정으로 22자리 최대값 도달 후 자동 재시작한다.

---

## 2. 범위

### 2.1 로그 대상 테이블 (22개)

#### 기존 19개

| 원본 테이블 | 로그 테이블 | LOG_SNO Prefix | 도메인 |
|------------|------------|----------------|--------|
| TPRMPP_BPROJM  | TPRMPP_BPROJML  | `BPROJML_` | 정보화사업 |
| TPRMPP_BITEMM  | TPRMPP_BITEMML  | `BITEMML_` | 프로젝트 품목 |
| TPRMPP_BCOSTM  | TPRMPP_BCOSTML  | `BCOSTML_` | 전산관리비 |
| TPRMPP_BTERMM  | TPRMPP_BTERML   | `BTERML_`  | 단말기 |
| TPRMPP_BPLANM  | TPRMPP_BPLANML  | `BPLANML_` | IT부문계획 |
| TPRMPP_BPROJA  | TPRMPP_BPROJAL  | `BPROJAL_` | 계획-사업 연결 |
| TPRMPP_BBUGTM  | TPRMPP_BBUGTML  | `BBUGTML_` | 예산편성률 |
| TPRMPP_BASCTM  | TPRMPP_BASCTL   | `BASCTL_`  | 협의회 심의과제 |
| TPRMPP_BCHKLC  | TPRMPP_BCHKLCL  | `BCHKLCL_` | 타당성 검토항목 |
| TPRMPP_BCMMTM  | TPRMPP_BCMMTML  | `BCMMTML_` | 평가위원 |
| TPRMPP_BEVALM  | TPRMPP_BEVALML  | `BEVALML_` | 평가의견 |
| TPRMPP_BPERFM  | TPRMPP_BPERFML  | `BPERFML_` | 성과지표 |
| TPRMPP_BPOVWM  | TPRMPP_BPOVWML  | `BPOVWML_` | 사업개요 |
| TPRMPP_BPQNAM  | TPRMPP_BPQNAML  | `BPQNAML_` | 사전질의응답 |
| TPRMPP_BRSLTM  | TPRMPP_BRSTML   | `BRSTML_`  | 결과서 |
| TPRMPP_BSCHDM  | TPRMPP_BSCHDML  | `BSCHDML_` | 일정 |
| TPRMPP_CUSERI  | TPRMPP_CUSERIL  | `CUSERIL_` | 사용자 정보 |
| TPRMPP_CCODEM  | TPRMPP_CCODEML  | `CCODEML_` | 공통코드 |
| TPRMPP_CAPPLM  | TPRMPP_CAPPLML  | `CAPPLML_` | 신청서 마스터 |

#### 신규 추가 3개

| 원본 테이블 | 로그 테이블 | LOG_SNO Prefix | 도메인 |
|------------|------------|----------------|--------|
| TPRMPP_BGDOCM  | TPRMPP_BGDOCML  | `BGDOCML_` | 예산 문서 마스터 |
| TPRMPP_BRDOCM  | TPRMPP_BRDOCML  | `BRDOCML_` | 심의 문서 마스터 |
| TPRMPP_BRIVGM  | TPRMPP_BRIVGML  | `BRIVGML_` | 심의 조사 마스터 |

### 2.2 제외 테이블

- `TPRMPP_CLOGNH` — 로그인 이력 (로그 테이블 자체를 로깅하지 않음)
- `TPRMPP_CRTOKM` — 갱신토큰 (보안 토큰)
- `TPRMPP_CAPPLA` — 신청서-원본 연결 (중간 테이블)
- `TPRMPP_CDECIM` — 결재선 (결재 시스템 내부)
- `TPRMPP_CFILEM` — 첨부파일 메타
- `TPRMPP_CAUTHI` — 자격등급
- `TPRMPP_CROLEI` — 역할 매핑 (RBAC)
- `TPRMPP_CORGNI` — 조직 정보 (외부 HR 동기화)

---

---

## 3. LOG_SNO 설계 — 22자리 순환 복합 문자열 PK

### 3.1 형식

```
{로그테이블명_Postfix}_{22자리_0패딩_시퀀스값}
```

| 로그 테이블 | 예시 LOG_SNO |
|------------|-------------|
| TPRMPP_BPROJML | `BPROJML_0000000000000000000001` |
| TPRMPP_BGDOCML | `BGDOCML_0000000000000000000001` |
| TPRMPP_BRIVGML | `BRIVGML_0000000000000000000001` |

- **컬럼 타입**: `VARCHAR2(32)` (최장 Postfix 7자리 + `_` + 22자리 = 30자 이내 충분)
- **Postfix**: `TPRMPP_` prefix를 제외한 로그 테이블명 (예: `TPRMPP_BPROJML` → `BPROJML`)

### 3.2 Oracle 시퀀스 정의

```sql
CREATE SEQUENCE S_{Postfix}
  MINVALUE 1
  MAXVALUE 9999999999999999999999   -- 22자리 최대값
  START WITH 1
  INCREMENT BY 1
  NOCACHE                            -- 순환 경계 gap 방지
  CYCLE;                             -- 최대값 도달 후 MINVALUE(1)부터 재시작
```

> **CYCLE 주의**: 동일한 숫자가 재사용되므로 LOG_SNO는 FK 참조 대상으로 사용하지 않는다.

### 3.3 JPA — Custom IdentifierGenerator

`LOG_SNO`가 VARCHAR2 복합 문자열이므로 Hibernate 기본 `@SequenceGenerator`는 사용 불가. 커스텀 `IdentifierGenerator`를 구현한다.

#### AuditLogIdGenerator.java

```java
package com.kdb.it.domain.audit.id;

import jakarta.persistence.Table;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.id.IdentifierGenerator;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * 로그 테이블 PK 생성기.
 * Oracle S_{Postfix}.NEXTVAL을 조회하여 "{Postfix}_{22자리_0패딩}" VARCHAR2 값을 반환한다.
 */
public class AuditLogIdGenerator implements IdentifierGenerator {

    private static final int SEQ_PAD_LENGTH = 22;

    @Override
    public Object generate(SharedSessionContractImplementor session, Object object) {
        String postfix = resolvePostfix(object);
        long nextVal = fetchNextVal(session, "S_" + postfix);
        return postfix + "_" + String.format("%0" + SEQ_PAD_LENGTH + "d", nextVal);
    }

    private String resolvePostfix(Object object) {
        Table ann = object.getClass().getAnnotation(Table.class);
        if (ann == null) throw new IllegalStateException("@Table 누락: " + object.getClass().getName());
        String tbl = ann.name().toUpperCase();
        int idx = tbl.indexOf('_');
        return idx >= 0 ? tbl.substring(idx + 1) : tbl;
    }

    private long fetchNextVal(SharedSessionContractImplementor session, String seqName) {
        try {
            Connection conn = session.getJdbcConnectionAccess().obtainConnection();
            try (Statement st = conn.createStatement();
                 ResultSet rs = st.executeQuery("SELECT " + seqName + ".NEXTVAL FROM DUAL")) {
                if (rs.next()) return rs.getLong(1);
                throw new IllegalStateException("NEXTVAL 조회 실패: " + seqName);
            } finally {
                session.getJdbcConnectionAccess().releaseConnection(conn);
            }
        } catch (Exception e) {
            throw new RuntimeException("시퀀스 조회 오류: " + seqName, e);
        }
    }
}
```

#### BaseLogEntity — @Id를 공통 클래스로 이동

```java
@MappedSuperclass
public abstract class BaseLogEntity {

    /** 복합 문자열 PK: {Postfix}_{22자리_시퀀스} */
    @Id
    @GeneratedValue(generator = "auditLogIdGenerator")
    @GenericGenerator(name = "auditLogIdGenerator", type = AuditLogIdGenerator.class)
    @Column(name = "LOG_SNO", length = 32, nullable = false, updatable = false)
    private String logSno;

    @Column(name = "CHG_TP",   length = 1,  nullable = false) private String        chgTp;
    @Column(name = "CHG_DTM",               nullable = false) private LocalDateTime  chgDtm;
    @Column(name = "CHG_USID", length = 14)                   private String        chgUsid;
    // BaseEntity 공통 컬럼 스냅샷 (DEL_YN, GUID, FST_ENR_DTM, LST_CHG_DTM 등)
}
```

각 로그 엔티티에서 `@Id` / `@GeneratedValue` / `@SequenceGenerator` 블록을 **제거**하고 `BaseLogEntity.logSno`를 상속한다.

---

## 4. 아키텍처

### 4.1 전체 흐름

```
사용자 API 요청 (POST / PUT / DELETE)
  → Controller → Service → Repository.save()
  → JPA Hibernate flush
  → @PostPersist 또는 @PostUpdate 이벤트
  → ChangeLogEntityListener 실행
       ├── @LogTarget 없음 → 스킵
       └── @LogTarget 있음
             ├── CHG_TP 결정
             │     @PostPersist             → 'C'
             │     @PostUpdate, DEL_YN='Y'  → 'D'
             │     @PostUpdate, 그 외       → 'U'
             ├── AuditLogPersister.persist() 호출
             │     ├── AuditLogIdGenerator → S_{Postfix}.NEXTVAL → LOG_SNO 생성
             │     ├── CHG_DTM = LocalDateTime.now()
             │     ├── CHG_USID = SecurityContext 사번
             │     └── 원본 엔티티 @Column(name) 리플렉션 복사 → 로그 엔티티 INSERT
             └── entityManager.persist(logEntity)
  → 업무 트랜잭션 커밋 (로그 포함, 동일 트랜잭션)
```

> **트랜잭션 정책**: 로그 INSERT 실패 → 업무 트랜잭션 함께 롤백 (데이터 정합성 최우선)

### 4.2 Soft Delete 처리

물리 삭제 없이 `DEL_YN = 'Y'`로 논리 삭제. `@PostUpdate`에서 `DEL_YN` 값으로 C/U/D를 구분한다. `@PostRemove`는 사용하지 않는다.

| 이벤트 | DEL_YN | CHG_TP |
|--------|--------|--------|
| @PostPersist | — | `C` |
| @PostUpdate | `null` or `N` | `U` |
| @PostUpdate | `Y` | `D` |

---

## 5. 컴포넌트 설계

### 5.1 @LogTarget 어노테이션

```java
package com.kdb.it.domain.audit.annotation;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface LogTarget {
    /** 대응하는 로그 엔티티 클래스 */
    Class<? extends BaseLogEntity> entity();
}
```

### 5.2 BaseLogEntity

```java
package com.kdb.it.domain.audit.entity;

@MappedSuperclass
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public abstract class BaseLogEntity {

    /** 복합 문자열 PK: {Postfix}_{22자리_0패딩_시퀀스} — AuditLogIdGenerator가 생성 */
    @Id
    @GeneratedValue(generator = "auditLogIdGenerator")
    @GenericGenerator(name = "auditLogIdGenerator", type = AuditLogIdGenerator.class)
    @Column(name = "LOG_SNO", length = 32, nullable = false, updatable = false)
    private String logSno;

    @Column(name = "CHG_TP",   length = 1,  nullable = false) private String        chgTp;
    @Column(name = "CHG_DTM",               nullable = false) private LocalDateTime  chgDtm;
    @Column(name = "CHG_USID", length = 14)                   private String        chgUsid;

    // BaseEntity 공통 컬럼 스냅샷
    @Column(name = "DEL_YN",       length = 1)    private String        delYn;
    @Column(name = "GUID",         length = 38)   private String        guid;
    @Column(name = "GUID_PRG_SNO")                private Integer       guidPrgSno;
    @Column(name = "FST_ENR_DTM")                 private LocalDateTime fstEnrDtm;
    @Column(name = "FST_ENR_USID", length = 14)   private String        fstEnrUsid;
    @Column(name = "LST_CHG_DTM")                 private LocalDateTime lstChgDtm;
    @Column(name = "LST_CHG_USID", length = 14)   private String        lstChgUsid;
}
```

> 각 로그 엔티티에서 `@Id` / `@GeneratedValue` / `@SequenceGenerator` 블록 제거 — `BaseLogEntity.logSno` 상속.

### 5.3 ChangeLogEntityListener

```java
package com.kdb.it.domain.audit.listener;

public class ChangeLogEntityListener {

    @PostPersist
    public void onPostPersist(Object entity) {
        record(entity, "C");
    }

    @PostUpdate
    public void onPostUpdate(Object entity) {
        // DEL_YN = 'Y'이면 논리 삭제 → 'D', 아니면 수정 → 'U'
        String chgTp = isDeleted(entity) ? "D" : "U";
        record(entity, chgTp);
    }

    private void record(Object entity, String chgTp) {
        LogTarget annotation = entity.getClass().getAnnotation(LogTarget.class);
        if (annotation == null) return;

        // 1. 로그 엔티티 인스턴스 생성
        // 2. CHG_TP, CHG_DTM, CHG_USID 설정
        // 3. 원본 엔티티 → 로그 엔티티 동일명 필드 리플렉션 복사
        // 4. ApplicationContextHolder(정적 유틸 빈)로 EntityManager 획득 후 persist
        //    (EntityListener는 Spring DI 대상이 아니므로 정적 ApplicationContext 경유)
    }
}
```

> **리플렉션 복사**: 원본 엔티티와 로그 엔티티의 `@Column(name=...)` 값이 일치하는 필드를 매핑한다.

### 5.4 BaseEntity 변경

```java
// 기존
@EntityListeners(AuditingEntityListener.class)

// 변경
@EntityListeners({AuditingEntityListener.class, ChangeLogEntityListener.class})
```

### 5.5 업무 엔티티 변경 예시

```java
@LogTarget(entity = BprojmL.class)   // 추가
@Entity
@Table(name = "TPRMPP_BPROJM")
public class Bprojm extends BaseEntity { ... }
```

### 5.6 로그 엔티티 예시 (BprojmL)

```java
@Entity
@Table(name = "TPRMPP_BPROJML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BprojmL extends BaseLogEntity {
    // logSno: BaseLogEntity에서 상속 — 여기 @Id 선언 없음

    @Column(name = "PRJ_MNG_NO", length = 32) private String  prjMngNo;
    @Column(name = "PRJ_SNO")                 private Integer prjSno;
    // ... 원본 TPRMPP_BPROJM 컬럼 전체 (nullable, PK/FK 제약 없음)
}
```

### 5.7 신규 로그 엔티티 (BgdocmL / BrdocmL / BrivgmL)

#### BgdocmL.java — TPRMPP_BGDOCML (가이드 문서 로그)

```java
@Entity
@Table(name = "TPRMPP_BGDOCML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BgdocmL extends BaseLogEntity {

    @Column(name = "DOC_MNG_NO", length = 32)  private String docMngNo;
    @Column(name = "DOC_NM",     length = 200)  private String docNm;
    @Lob
    @Column(name = "DOC_CONE")                  private byte[] docCone;
}
```

#### BrdocmL.java — TPRMPP_BRDOCML (요구사항 정의서 로그, 원본 복합 PK)

```java
@Entity
@Table(name = "TPRMPP_BRDOCML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BrdocmL extends BaseLogEntity {

    @Column(name = "DOC_MNG_NO", length = 32)              private String     docMngNo;
    @Column(name = "DOC_VRS",    precision = 4, scale = 2) private BigDecimal docVrs;
    @Column(name = "REQ_NM",     length = 200)             private String     reqNm;
    @Lob
    @Column(name = "REQ_CONE")                             private byte[]     reqCone;
    @Column(name = "REQ_DTT",    length = 32)              private String     reqDtt;
    @Column(name = "BZ_DTT",     length = 32)              private String     bzDtt;
    @Column(name = "FSG_TLM")                              private LocalDate  fsgTlm;
}
```

> 원본 `TPRMPP_BRDOCM`의 복합 PK(`DOC_MNG_NO` + `DOC_VRS`)는 로그 테이블에서 일반 컬럼으로 취급. 로그 PK는 `LOG_SNO`만 사용.

#### BrivgmL.java — TPRMPP_BRIVGML (문서 검토의견 로그, 원본 UUID PK)

```java
@Entity
@Table(name = "TPRMPP_BRIVGML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class BrivgmL extends BaseLogEntity {

    @Column(name = "IVG_SNO",    length = 32)              private String     ivgSno;
    @Column(name = "DOC_MNG_NO", length = 32)              private String     docMngNo;
    @Column(name = "DOC_VRS",    precision = 5, scale = 2) private BigDecimal docVrs;
    @Column(name = "IVG_TP",     length = 1)               private String     ivgTp;
    @Lob
    @Column(name = "IVG_CONE")                             private String     ivgCone;
    @Column(name = "MARK_ID",    length = 64)              private String     markId;
    @Column(name = "QTD_CONE",   length = 4000)            private String     qtdCone;
    @Column(name = "RSLV_YN",    length = 1)               private String     rslvYn;
}
```

> 원본 `TPRMPP_BRIVGM`의 `IVG_SNO`는 `@PrePersist` UUID PK이지만, 로그 테이블에서는 일반 컬럼으로 저장.

---

## 6. DDL

### 6.1 시퀀스 명명 규칙

```
S_{로그테이블명_Postfix}   (TPRMPP_ prefix 제외)

예: TPRMPP_BPROJML → S_BPROJML
    TPRMPP_BGDOCML → S_BGDOCML
    TPRMPP_CUSERIL → S_CUSERIL
```

### 6.2 시퀀스 DDL (22개 — 22자리 CYCLE)

```sql
-- ============================================================
-- 변경 로그(Audit Log) 시퀀스 DDL
-- MAXVALUE: 9999999999999999999999 (22자리)
-- CYCLE: 최대값 도달 후 MINVALUE(1)부터 재시작
-- NOCACHE: 순환 경계 gap 방지
-- ============================================================

-- 기존 19개
CREATE SEQUENCE S_BPROJML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BITEMML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BCOSTML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BTERML  MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BPLANML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BPROJAL MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BBUGTML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BASCTL  MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BCHKLCL MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BCMMTML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BEVALML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BPERFML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BPOVWML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BPQNAML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BRSTML  MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BSCHDML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_CUSERIL MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_CCODEML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_CAPPLML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;

-- 신규 3개
CREATE SEQUENCE S_BGDOCML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BRDOCML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
CREATE SEQUENCE S_BRIVGML MINVALUE 1 MAXVALUE 9999999999999999999999 START WITH 1 INCREMENT BY 1 NOCACHE CYCLE;
```

### 6.3 로그 테이블 DDL 패턴 (LOG_SNO: VARCHAR2(32))

```sql
-- CTAS 패턴 (기존 19개 동일 방식 적용)
-- LOG_SNO를 VARCHAR2(32)로 선언 (기존 NUMBER에서 변경)
CREATE TABLE TPRMPP_BPROJML AS
  SELECT CAST(NULL AS VARCHAR2(32))  AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))   AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6))  AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14))  AS CHG_USID,
         t.*
  FROM TPRMPP_BPROJM t WHERE 1 = 0;

ALTER TABLE TPRMPP_BPROJML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TPRMPP_BPROJML MODIFY (PRJ_MNG_NO NULL, PRJ_SNO NULL);
ALTER TABLE TPRMPP_BPROJML ADD CONSTRAINT PK_BPROJML PRIMARY KEY (LOG_SNO);

-- 신규 테이블 예시 (BGDOCML)
CREATE TABLE TPRMPP_BGDOCML AS
  SELECT CAST(NULL AS VARCHAR2(32))  AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))   AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6))  AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14))  AS CHG_USID,
         t.*
  FROM TPRMPP_BGDOCM t WHERE 1 = 0;

ALTER TABLE TPRMPP_BGDOCML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TPRMPP_BGDOCML MODIFY (DOC_MNG_NO NULL);
ALTER TABLE TPRMPP_BGDOCML ADD CONSTRAINT PK_BGDOCML PRIMARY KEY (LOG_SNO);

-- BRDOCML (원본 복합 PK: DOC_MNG_NO + DOC_VRS)
CREATE TABLE TPRMPP_BRDOCML AS
  SELECT CAST(NULL AS VARCHAR2(32))  AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))   AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6))  AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14))  AS CHG_USID,
         t.*
  FROM TPRMPP_BRDOCM t WHERE 1 = 0;

ALTER TABLE TPRMPP_BRDOCML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TPRMPP_BRDOCML MODIFY (DOC_MNG_NO NULL, DOC_VRS NULL);
ALTER TABLE TPRMPP_BRDOCML ADD CONSTRAINT PK_BRDOCML PRIMARY KEY (LOG_SNO);

-- BRIVGML (원본 UUID PK: IVG_SNO)
CREATE TABLE TPRMPP_BRIVGML AS
  SELECT CAST(NULL AS VARCHAR2(32))  AS LOG_SNO,
         CAST(NULL AS VARCHAR2(1))   AS CHG_TP,
         CAST(NULL AS TIMESTAMP(6))  AS CHG_DTM,
         CAST(NULL AS VARCHAR2(14))  AS CHG_USID,
         t.*
  FROM TPRMPP_BRIVGM t WHERE 1 = 0;

ALTER TABLE TPRMPP_BRIVGML MODIFY (LOG_SNO NOT NULL, CHG_TP NOT NULL, CHG_DTM NOT NULL);
ALTER TABLE TPRMPP_BRIVGML MODIFY (IVG_SNO NULL);
ALTER TABLE TPRMPP_BRIVGML ADD CONSTRAINT PK_BRIVGML PRIMARY KEY (LOG_SNO);
```

> **PK 컬럼 확인 완료** (백엔드 엔티티 파일 기준):
> - BGDOCM: `DOC_MNG_NO` VARCHAR2(32) 단일 PK
> - BRDOCM: `DOC_MNG_NO` VARCHAR2(32) + `DOC_VRS` NUMBER(4,2) 복합 PK
> - BRIVGM: `IVG_SNO` VARCHAR2(32) 단일 PK (UUID @PrePersist 생성)

---

## 7. 디렉토리 구조

```
src/main/java/com/kdb/it/domain/audit/
├── annotation/
│   └── LogTarget.java
├── id/
│   └── AuditLogIdGenerator.java     ← 신규 (22자리 순환 PK 생성)
├── listener/
│   ├── ApplicationContextHolder.java
│   ├── AuditLogPersister.java
│   └── ChangeLogEntityListener.java
└── entity/
    ├── BaseLogEntity.java            ← logSno(VARCHAR2) 포함, @Id 공통화
    ├── BprojmL.java ~ CapplmL.java  (기존 19개, @Id 블록 제거)
    ├── BgdocmL.java                  ← 신규
    ├── BrdocmL.java                  ← 신규
    └── BrivgmL.java                  ← 신규

../it_database/migrations/
└── V{YYYYMMDD_NNN}__{Description}.sql (22개 시퀀스 + 22개 로그 테이블의 Flyway 이력)
```

---

## 8. 기존 파일 변경 목록

| 파일 | 변경 내용 |
|------|---------|
| `BaseEntity.java` | `@EntityListeners`에 `ChangeLogEntityListener.class` 추가 |
| `BaseLogEntity.java` | `logSno`를 `Long` → `String(VARCHAR2)` 로 변경, `@GenericGenerator` 적용 |
| 기존 로그 엔티티 19개 | `@Id` / `@GeneratedValue` / `@SequenceGenerator` 블록 제거 |
| 기존 업무 엔티티 19개 | `@LogTarget(entity = XxxL.class)` 추가 |
| BGDOCM 업무 엔티티 | `@LogTarget(entity = BgdocmL.class)` 추가 (신규) |
| BRDOCM 업무 엔티티 | `@LogTarget(entity = BrdocmL.class)` 추가 (신규) |
| BRIVGM 업무 엔티티 | `@LogTarget(entity = BrivgmL.class)` 추가 (신규) |

---

## 9. 기존 v1 대비 변경 요약

| 항목 | v1 (최초 설계) | v2 (이 문서) |
|------|--------------|-------------|
| LOG_SNO 타입 | `NUMBER` | `VARCHAR2(32)` |
| LOG_SNO 형식 | 단순 숫자 | `{Postfix}_{22자리_0패딩}` |
| 시퀀스 CYCLE | `NOCYCLE` | `CYCLE` |
| 시퀀스 MAXVALUE | 기본(무제한) | `9999999999999999999999` (22자리) |
| JPA ID 생성 방식 | `@SequenceGenerator` | `AuditLogIdGenerator` (커스텀) |
| @Id 위치 | 각 로그 엔티티 | `BaseLogEntity` (공통) |
| 로그 대상 수 | 19개 | **22개** |
| 신규 시퀀스 | — | S_BGDOCML, S_BRDOCML, S_BRIVGML |
| 신규 로그 엔티티 | — | BgdocmL, BrdocmL, BrivgmL |

---

## 10. 미결 사항

| 항목 | 내용 | 우선순위 |
|------|------|---------|
| BgdocmL 엔티티 정의 | DOC_MNG_NO·DOC_NM·DOC_CONE(@Lob byte[]) — §5.7 완료 | ✅ 완료 |
| BrdocmL 엔티티 정의 | DOC_MNG_NO·DOC_VRS·REQ_NM·REQ_CONE 등 — §5.7 완료 (복합 PK → 일반 컬럼) | ✅ 완료 |
| BrivgmL 엔티티 정의 | IVG_SNO·DOC_MNG_NO·IVG_CONE(@Lob String) 등 — §5.7 완료 (UUID PK → 일반 컬럼) | ✅ 완료 |
| 로그 조회 API | 관리자 감사 화면, 별도 설계 | 선택 |
| 비동기 전환 | 성능 이슈 시 AFTER_COMMIT 이벤트 방식 검토 | 선택 |
