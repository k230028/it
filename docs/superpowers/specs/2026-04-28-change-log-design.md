# 변경 로그(Audit Log) 시스템 설계

- **작성일**: 2026-04-28
- **대상 프로젝트**: IT Portal (com.kdb.it)
- **작성자**: 설계 세션 기반 자동 생성

---

## 1. 목표

사용자의 CUD(Create / Update / Delete) 요청을 받는 업무 테이블에 대해 변경 이력을 로그 테이블(`_L` 접미사)에 자동으로 기록한다. Read(조회)는 기록하지 않는다.

---

## 2. 범위

### 로그 대상 테이블

| 원본 테이블 | 로그 테이블 | 도메인 |
|------------|------------|--------|
| TAAABB_BPROJM  | TAAABB_BPROJML  | 정보화사업 |
| TAAABB_BITEMM  | TAAABB_BITEMML  | 프로젝트 품목 |
| TAAABB_BCOSTM  | TAAABB_BCOSTML  | 전산관리비 |
| TAAABB_BTERMM  | TAAABB_BTERML   | 단말기 |
| TAAABB_BPLANM  | TAAABB_BPLANML  | IT부문계획 |
| TAAABB_BPROJA  | TAAABB_BPROJAL  | 계획-사업 연결 |
| TAAABB_BBUGTM  | TAAABB_BBUGTML  | 예산편성률 |
| TAAABB_BASCTM  | TAAABB_BASCTL   | 협의회 심의과제 |
| TAAABB_BCHKLC  | TAAABB_BCHKLCL  | 타당성 검토항목 |
| TAAABB_BCMMTM  | TAAABB_BCMMTML  | 평가위원 |
| TAAABB_BEVALM  | TAAABB_BEVALML  | 평가의견 |
| TAAABB_BPERFM  | TAAABB_BPERFML  | 성과지표 |
| TAAABB_BPOVWM  | TAAABB_BPOVWML  | 사업개요 |
| TAAABB_BPQNAM  | TAAABB_BPQNAML  | 사전질의응답 |
| TAAABB_BRSLTM  | TAAABB_BRSTML   | 결과서 |
| TAAABB_BSCHDM  | TAAABB_BSCHDML  | 일정 |
| TAAABB_CUSERI  | TAAABB_CUSERIL  | 사용자 정보 |
| TAAABB_CCODEM  | TAAABB_CCODEML  | 공통코드 |
| TAAABB_CAPPLM  | TAAABB_CAPPLML  | 신청서 마스터 |

총 19개 원본 테이블 → 19개 로그 테이블

### 제외 테이블

- `TAAABB_CLOGNH` — 로그인 이력 (로그 테이블 자체를 로깅하지 않음)
- `TAAABB_CRTOKM` — 갱신토큰 (보안 토큰, 로그 불필요)
- `TAAABB_CAPPLA` — 신청서-원본 연결 (중간 테이블)
- `TAAABB_CDECIM` — 결재선 (결재 시스템 내부 관리)
- `TAAABB_CFILEM` — 첨부파일 (파일 스토리지 메타만 관리, 별도 이력 불필요)
- `TAAABB_CAUTHI` — 자격등급 (코드성 데이터, 변경 빈도 낮음)
- `TAAABB_CROLEI` — 역할 매핑 (RBAC 내부 관리)
- `TAAABB_CORGNI` — 조직 정보 (외부 HR 시스템 동기화 데이터)
- `TAAABB_BGDOCM`, `TAAABB_BRDOCM`, `TAAABB_BRIVGM` — 문서류 (필요 시 추후 추가)

---

## 3. 아키텍처

### 3.1 전체 흐름

```
사용자 API 요청 (POST / PUT / DELETE)
  → Controller → Service → Repository.save()
  → JPA Hibernate flush
  → @PostPersist 또는 @PostUpdate 이벤트
  → ChangeLogEntityListener 실행
       ├── @LogTarget 어노테이션 없음 → 스킵
       └── @LogTarget 있음
             ├── CHG_TP 결정
             │     신규 저장(@PostPersist) → 'C'
             │     DEL_YN = 'Y'(@PostUpdate) → 'D'
             │     그 외(@PostUpdate)         → 'U'
             ├── CHG_DTM = 현재 시각
             ├── CHG_USID = SecurityContext 사번
             └── 원본 엔티티 필드 복사 → 로그 엔티티 INSERT
  → 업무 트랜잭션 커밋 (로그 포함, 동일 트랜잭션)
```

> **트랜잭션 정책**: 로그 INSERT 실패 시 업무 트랜잭션도 함께 롤백한다.
> 데이터 정합성을 최우선으로 한다.

### 3.2 Soft Delete 처리

이 프로젝트는 물리 삭제 없이 `DEL_YN = 'Y'`로 논리 삭제한다.
삭제도 실제로는 UPDATE이므로 `@PostUpdate`에서 `DEL_YN` 값으로 C/U/D를 구분한다.
`@PostRemove`는 사용하지 않는다.

---

## 4. 컴포넌트 설계

### 4.1 @LogTarget 어노테이션

```java
package com.kdb.it.domain.audit.annotation;

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface LogTarget {
    /** 대응하는 로그 엔티티 클래스 */
    Class<? extends BaseLogEntity> entity();
}
```

### 4.2 BaseLogEntity

```java
package com.kdb.it.domain.audit.entity;

@MappedSuperclass
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public abstract class BaseLogEntity {

    // LOG_SNO는 각 하위 클래스에서 @SequenceGenerator와 함께 선언

    /** 변경유형: 'C'=생성, 'U'=수정, 'D'=삭제 */
    @Column(name = "CHG_TP", length = 1, nullable = false)
    private String chgTp;

    /** 변경일시 */
    @Column(name = "CHG_DTM", nullable = false)
    private LocalDateTime chgDtm;

    /** 변경자 사번 */
    @Column(name = "CHG_USID", length = 14)
    private String chgUsid;
}
```

### 4.3 ChangeLogEntityListener

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

### 4.4 BaseEntity 변경

```java
// 기존
@EntityListeners(AuditingEntityListener.class)

// 변경
@EntityListeners({AuditingEntityListener.class, ChangeLogEntityListener.class})
```

### 4.5 업무 엔티티 변경 예시

```java
@LogTarget(entity = BprojmL.class)   // 추가
@Entity
@Table(name = "TAAABB_BPROJM")
public class Bprojm extends BaseEntity { ... }
```

### 4.6 로그 엔티티 예시 (BprojmL)

```java
@Entity
@Table(name = "TAAABB_BPROJML")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BprojmL extends BaseLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "GEN_BPROJML")
    @SequenceGenerator(name = "GEN_BPROJML", sequenceName = "S_BPROJML", allocationSize = 1)
    @Column(name = "LOG_SNO")
    private Long logSno;

    // 원본 TAAABB_BPROJM 컬럼 전체 (nullable, PK/FK 제약 없음)
    @Column(name = "PRJ_MNG_NO", length = 32) private String prjMngNo;
    @Column(name = "PRJ_SNO") private Integer prjSno;
    // ... 나머지 컬럼
}
```

---

## 5. DDL

### 5.1 시퀀스 명명 규칙

```
S_{로그테이블명}  (TAAABB_ prefix 제외)

예: TAAABB_BPROJML → S_BPROJML
    TAAABB_CUSERIL → S_CUSERIL
```

### 5.2 DDL 패턴

```sql
-- 시퀀스 (테이블당 1개)
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

-- 로그 테이블 예시 (BPROJML)
CREATE TABLE TAAABB_BPROJML (
  LOG_SNO      NUMBER         NOT NULL,
  CHG_TP       VARCHAR2(1)    NOT NULL,
  CHG_DTM      TIMESTAMP      NOT NULL,
  CHG_USID     VARCHAR2(14),
  -- BaseEntity 공통 컬럼
  DEL_YN       VARCHAR2(4),
  GUID         VARCHAR2(152),
  GUID_PRG_SNO NUMBER,
  FST_ENR_DTM  TIMESTAMP,
  FST_ENR_USID VARCHAR2(56),
  LST_CHG_DTM  TIMESTAMP,
  LST_CHG_USID VARCHAR2(56),
  -- 업무 컬럼 (모두 nullable)
  PRJ_MNG_NO   VARCHAR2(32),
  PRJ_SNO      NUMBER,
  PRJ_NM       VARCHAR2(200),
  -- ... 원본 테이블 컬럼 전체
  CONSTRAINT PK_BPROJML PRIMARY KEY (LOG_SNO)
);
```

---

## 6. 디렉토리 구조

```
src/main/java/com/kdb/it/domain/audit/
├── annotation/
│   └── LogTarget.java
├── listener/
│   └── ChangeLogEntityListener.java
├── entity/
│   ├── BaseLogEntity.java
│   ├── BprojmL.java
│   ├── BitemmL.java
│   ├── BcostmL.java
│   ├── BtermmL.java
│   ├── BplanmL.java
│   ├── BprojaL.java
│   ├── BbugtmL.java
│   ├── BasctmL.java
│   ├── BchklcL.java
│   ├── BcmmtmL.java
│   ├── BevalmL.java
│   ├── BperfmL.java
│   ├── BpovwmL.java
│   ├── BpqnamL.java
│   ├── BrsltmL.java
│   ├── BschdmL.java
│   ├── CuserIL.java
│   ├── CcodemL.java
│   └── CapplmL.java
└── repository/                ← 로그 조회 API 필요 시 추가 (선택)
```

---

## 7. 기존 파일 변경 목록

| 파일 | 변경 내용 |
|------|---------|
| `BaseEntity.java` | `@EntityListeners`에 `ChangeLogEntityListener.class` 추가 (1줄) |
| 대상 엔티티 19개 | `@LogTarget(entity = XxxL.class)` 어노테이션 추가 (각 1줄) |

---

## 8. 미결 사항 / 제외 범위

- 로그 조회 API (관리자 화면): 설계 범위 제외, 필요 시 별도 설계
- `BGDOCM`, `BRDOCM`, `BRIVGM` 문서 테이블: 현재 제외, 필요 시 추가
- 비동기 처리 전환: 현재 동기(동일 트랜잭션), 성능 이슈 발생 시 AFTER_COMMIT 이벤트 방식으로 전환 검토
