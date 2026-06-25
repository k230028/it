# 정보화사업관계(BPROJA) 신설 + 상태 정규화 (1차) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로젝트 상태(`IT_PTL_STS_TC`)를 `TPRMPP_BPROJM`/`BPROJL` 단일 컬럼에서 제거하고, 프로젝트↔단계문서 관계 테이블 `TPRMPP_BPROJA`로 정규화하여 읽기 경로(목록/상세/필터)가 대표상태(MAX)를 BPROJA에서 도출하도록 전환한다(1차: 기반+읽기, write 통합은 2차).

**Architecture:** Flyway로 `TPRMPP_BPROJA`(PK `ABUS_MNG_NO`+`CNCD_RFR_NO`, `IT_PTL_STS_TC`+BaseEntity 감사컬럼)를 생성하고 BPROJM/BPROJL의 `IT_PTL_STS_TC`를 DROP한다. 백엔드는 `Bproja` 엔티티(`@LogTarget` 미부착)+`BprojaRepository`를 추가하고, `Bprojm`/`BprojmL`에서 `stsTc` 매핑을 제거한다. `ProjectService`는 조회 시 프로젝트별 BPROJA 행 중 `IT_PTL_STS_TC` 최댓값(대표상태)을 합성해 응답 `stsTc`에 주입하고, 생성/수정 경로에서는 상태를 더 이상 기록하지 않는다. `ProjectRepositoryImpl`의 상태 필터는 BPROJA 대표상태 EXISTS 서브쿼리로 교체한다. 프론트는 응답 계약(`stsTc`)이 유지되므로 표시·필터는 그대로 두고, `form.vue`의 상태 입력만 읽기전용으로 전환한다.

**Tech Stack:** Oracle + Flyway, Spring Boot 4 / JPA / QueryDSL 5.1, Nuxt 4 / PrimeVue.

---

## 결정 사항 (Decisions, 사용자 확인 완료)

1. `CNCD_RFR_NO`는 sentinel이 아니라 각 단계 원본테이블의 key(사전협의 `DOC_MNG_NO`, 예산편성 `BG_NO`, 정보기술부문계획 `REQ_DOC_NO`, 타당성검토 `IT_PTL_ASCT_ID`, 소요예산 `RQM_BG_REQ_DOC_NO`, 과업심의/입찰계약/대금지급 `DOC_MNG_NO`).
2. 카디널리티: 프로젝트당 단계별 다건.
3. 적재: 각 단계 서비스가 upsert — **2차 범위**(이번 계획 제외).
4. 프로젝트 대표상태 = 그 프로젝트의 BPROJA 행 중 `IT_PTL_STS_TC` 코드값 **MAX 1건**(2자리 zero-pad → 사전식 MAX=숫자 MAX). `DEL_YN='N'`만. 없으면 `null`.
5. 기존 상태 데이터 이관 없음.
6. BPROJA는 `@LogTarget` 미부착(BPROJAL 없음). `BaseEntity`의 `ChangeLogEntityListener`는 `@LogTarget` 부재 시 no-op.
7. 범위: 1차=기반+읽기, 2차=write 통합.

## 사전 사실 (코드 확인 완료)

- 응답 상태명(`stsTcNm`)은 **백엔드에 없음**. 프론트가 `useCodeOptions('IT_PTL_STS_TC')`로 코드→명 변환(`index.vue:67`, `form.vue:228`). 따라서 백엔드는 `stsTc`(코드)만 주입하면 된다.
- `BaseEntity`는 `DEL_YN/GUID/GUID_PRG_SNO/FST_ENR_DTM/FST_ENR_USID/LST_CHG_DTM/LST_CHG_USID`를 제공 → `Bproja`는 `abusMngNo/cncdRfrNo/stsTc`만 선언.
- 검증: 프로젝트 메모리상 `./gradlew test`는 test worker JVM 기동 단계에서 실패하므로, 백엔드 검증은 `./gradlew compileJava`(QueryDSL Q타입 생성 포함)로 한다. 직전 BPROJ 전환 계획과 동일 기준.

## File Structure

- **DB**: `it_database/migrations/V20260624_002__CreateBprojaDropStatus.sql` (신규) — CREATE TABLE + DROP COLUMN x2.
- **Backend (신규)**:
  - `domain/budget/project/entity/Bproja.java` — 관계+상태 엔티티(`BaseEntity` 상속, `@IdClass`, `@LogTarget` 미부착).
  - `domain/budget/project/entity/BprojaId.java` — 복합키(`abusMngNo`,`cncdRfrNo`).
  - `domain/budget/project/repository/BprojaRepository.java` — `JpaRepository`, 대표상태 조회용 파생 메서드.
- **Backend (변경)**:
  - `entity/Bprojm.java` — `stsTc` 필드/매핑·`UpdateCommand`·`update()` x2에서 제거.
  - `log/entity/BprojmL.java` — `stsTc` 필드/매핑 제거.
  - `dto/ProjectDto.java` — `toEntity()`의 `.stsTc(...)`, `Response.fromEntity()`의 `.stsTc(...)` 제거(필드는 유지).
  - `service/ProjectService.java` — 생성/수정 시 상태 미기록, 조회 시 BPROJA 대표상태 합성(단건+배치).
  - `repository/ProjectRepositoryImpl.java` — 상태 필터를 BPROJA 대표상태 EXISTS로 교체.
- **Frontend (변경)**:
  - `app/pages/info/projects/form.vue` — 저장 payload `stsTc` 제거, 상태 입력 읽기전용 표시.
- **Docs/메타**:
  - `meta/table.csv` — BPROJA 행 추가, BPROJM/BPROJL의 `IT_PTL_STS_TC` 행 제거.
  - `it_backend/docs/guides/data-model.md` — BPROJA 매핑/상태 정규화 설명 추가.

---

### Task 1: Flyway 마이그레이션 (BPROJA 생성 + 상태 컬럼 DROP)

**Files:**
- Create: `it_database/migrations/V20260624_002__CreateBprojaDropStatus.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- V20260624_002__CreateBprojaDropStatus.sql
-- 정보화사업관계(TPRMPP_BPROJA) 신설 + BPROJM/BPROJL의 IT_PTL_STS_TC 제거.
--  - BPROJA: 프로젝트(ABUS_MNG_NO)와 각 단계 원본문서(CNCD_RFR_NO=단계 자기 key)의 상태(IT_PTL_STS_TC) 정규화.
--  - 상태는 더 이상 BPROJM 단일 컬럼이 아니라 BPROJA 다건으로 관리(대표상태=MAX(IT_PTL_STS_TC)).
--  - 데이터 이관 없음(빈 테이블 시작). 적재(8개 단계 서비스 upsert)는 2차.
-- 주의: 적용 후 수정 금지(Flyway 체크섬). 변경은 새 버전으로.

-- 1) 정보화사업관계 테이블 생성
CREATE TABLE ITPOWN.TPRMPP_BPROJA (
    ABUS_MNG_NO   VARCHAR2(30 CHAR)  NOT NULL,
    CNCD_RFR_NO   VARCHAR2(30 CHAR)  NOT NULL,
    IT_PTL_STS_TC VARCHAR2(2 CHAR),
    FST_ENR_USID  VARCHAR2(14 CHAR)  DEFAULT '00000000000000' NOT NULL,
    FST_ENR_DTM   DATE               DEFAULT SYSDATE NOT NULL,
    DEL_YN        VARCHAR2(1 CHAR)   DEFAULT 'N' NOT NULL,
    GUID          VARCHAR2(38 CHAR)  DEFAULT '00000000000000000000000000000000000000' NOT NULL,
    GUID_PRG_SNO  NUMBER(4)          DEFAULT 0 NOT NULL,
    LST_CHG_USID  VARCHAR2(14 CHAR)  DEFAULT '00000000000000' NOT NULL,
    LST_CHG_DTM   DATE               DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_TPRMPP_BPROJA PRIMARY KEY (ABUS_MNG_NO, CNCD_RFR_NO)
);

COMMENT ON TABLE  ITPOWN.TPRMPP_BPROJA               IS '프로젝트관리_정보화사업관계';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.ABUS_MNG_NO   IS '사업관리번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.CNCD_RFR_NO   IS '관련참조번호(단계 원본문서 key)';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.IT_PTL_STS_TC IS 'IT포탈상태구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.FST_ENR_USID  IS '최초등록사용자ID';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.FST_ENR_DTM   IS '최초등록일시';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.DEL_YN        IS '삭제여부';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.GUID          IS 'GUID';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.GUID_PRG_SNO  IS 'GUID진행일련번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.LST_CHG_USID  IS '최종변경사용자ID';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJA.LST_CHG_DTM   IS '최종변경일시';

-- 2) 기존 단일 상태 컬럼 제거 (마스터 + 로그)
ALTER TABLE ITPOWN.TPRMPP_BPROJM DROP COLUMN IT_PTL_STS_TC;
ALTER TABLE ITPOWN.TPRMPP_BPROJL DROP COLUMN IT_PTL_STS_TC;
```

- [ ] **Step 2: 커밋**

```bash
git add it_database/migrations/V20260624_002__CreateBprojaDropStatus.sql
git commit -m "feat(db): 정보화사업관계(BPROJA) 생성 + BPROJM/BPROJL 상태컬럼 제거 마이그레이션"
```

---

### Task 2: 백엔드 엔티티 `Bproja` + `BprojaId` 신설

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bproja.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/BprojaId.java`

- [ ] **Step 1: `BprojaId` 작성** (`BprojmId` 패턴 동일)

```java
package com.kdb.it.domain.budget.project.entity;

import jakarta.persistence.Column;
import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 정보화사업관계(BPROJA) 엔티티의 복합 기본키 클래스.
 *
 * <p>{@link Bproja}의 {@code @Id} 필드({@code abusMngNo}, {@code cncdRfrNo})와
 * 동일한 이름·타입을 가져야 합니다. {@link Serializable} 구현 + 기본 생성자 + equals/hashCode 필수.</p>
 */
@Getter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class BprojaId implements Serializable {

    /** 사업관리번호: Bproja.abusMngNo와 이름/타입 일치 필수 */
    @Column(name = "ABUS_MNG_NO", comment = "사업관리번호")
    private String abusMngNo;

    /** 관련참조번호(단계 원본문서 key): Bproja.cncdRfrNo와 이름/타입 일치 필수 */
    @Column(name = "CNCD_RFR_NO", comment = "관련참조번호")
    private String cncdRfrNo;
}
```

- [ ] **Step 2: `Bproja` 작성** (`BaseEntity` 상속, `@LogTarget` 미부착)

```java
package com.kdb.it.domain.budget.project.entity;

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

/**
 * 정보화사업관계(BPROJA) 엔티티.
 *
 * <p>DB 테이블: {@code TPRMPP_BPROJA}. 프로젝트({@code ABUS_MNG_NO})와 각 단계 원본문서
 * ({@code CNCD_RFR_NO}=단계 자기 key)의 IT포탈 상태({@code IT_PTL_STS_TC})를 정규화해 관리합니다.
 * 한 프로젝트당 단계별 다건이 존재하며, 프로젝트 대표상태는 그 중 {@code IT_PTL_STS_TC} 최댓값입니다.</p>
 *
 * <p>감사 로그 미적용({@code @LogTarget} 부착하지 않음). 적재(단계 서비스 upsert)는 2차 범위.</p>
 */
@Entity
@Table(name = "TPRMPP_BPROJA", comment = "정보화사업관계")
@IdClass(BprojaId.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@SuperBuilder
public class Bproja extends BaseEntity {

    /** 사업관리번호: 복합키 1 (프로젝트 관리번호) */
    @Id
    @Column(name = "ABUS_MNG_NO", nullable = false, length = 30, comment = "사업관리번호")
    private String abusMngNo;

    /** 관련참조번호: 복합키 2 (해당 단계 원본문서의 key) */
    @Id
    @Column(name = "CNCD_RFR_NO", nullable = false, length = 30, comment = "관련참조번호(단계 원본문서 key)")
    private String cncdRfrNo;

    /** IT포탈상태구분코드: 해당 단계의 상태 (2자리 코드) */
    @Column(name = "IT_PTL_STS_TC", length = 2, comment = "IT포탈상태구분코드")
    private String stsTc;

    /**
     * 상태 변경 (2차 단계 서비스 upsert에서 사용).
     *
     * @param stsTc 새 상태 코드
     */
    public void changeStatus(String stsTc) {
        this.stsTc = stsTc;
    }
}
```

- [ ] **Step 3: 커밋** (Task 3와 함께 컴파일 검증 후 커밋 가능)

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bproja.java it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/BprojaId.java
git commit -m "feat(backend): 정보화사업관계(Bproja) 엔티티 + 복합키 신설"
```

---

### Task 3: `BprojaRepository` 신설 (대표상태 조회)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/BprojaRepository.java`

QueryDSL HQL `MAX(string)` 검증 불확실성을 피하기 위해, 대표상태는 행을 가져와 Java에서 최댓값을 계산한다(단건/배치 모두 한 쿼리). 1차에서 BPROJA는 비어 있어 항상 빈 결과 → null 처리.

- [ ] **Step 1: 리포지토리 작성**

```java
package com.kdb.it.domain.budget.project.repository;

import com.kdb.it.domain.budget.project.entity.Bproja;
import com.kdb.it.domain.budget.project.entity.BprojaId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

/**
 * 정보화사업관계(Bproja) 리포지토리.
 *
 * <p>프로젝트 대표상태는 {@code findByAbusMngNo...} 결과의 {@code IT_PTL_STS_TC} 최댓값으로 계산합니다
 * (서비스 계층에서 Java max). 1차에서는 BPROJA가 비어 있어 결과가 비며, 대표상태는 null입니다.</p>
 */
public interface BprojaRepository extends JpaRepository<Bproja, BprojaId> {

    /** 단일 프로젝트의 미삭제 관계 행 전체 (대표상태 계산용) */
    List<Bproja> findByAbusMngNoAndDelYn(String abusMngNo, String delYn);

    /** 다수 프로젝트의 미삭제 관계 행 전체 (목록 배치 대표상태 계산용) */
    List<Bproja> findByAbusMngNoInAndDelYn(Collection<String> abusMngNos, String delYn);
}
```

- [ ] **Step 2: 컴파일 검증** (Task 2 엔티티 포함)

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL (QBproja Q타입 생성됨)

- [ ] **Step 3: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/BprojaRepository.java
git commit -m "feat(backend): BprojaRepository(대표상태 조회) 신설"
```

---

### Task 4: `Bprojm`/`BprojmL`에서 `stsTc` 제거 + DTO 빌더 정리

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BprojmL.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java`

- [ ] **Step 1: `Bprojm.java` — 필드/매핑 제거**

다음 필드 선언(약 178~180행)을 **삭제**:

```java
    /** 프로젝트상태: 사업의 현재 진행 상태 코드 (공통코드 IT_PTL_STS_TC, 예: 09=예산편성 작업 완료, 11=정보기술부문계획 정실협 진행중) */
    @Column(name = "IT_PTL_STS_TC", length = 2, comment = "프로젝트상태 (공통코드 IT_PTL_STS_TC, 2자리 코드)")
    private String stsTc;
```

- [ ] **Step 2: `Bprojm.java` — `UpdateCommand` 레코드에서 `stsTc` 제거**

`UpdateCommand` 컴포넌트 목록(약 215행)에서 `String ... exePttYn, String stsTc,` 중 `stsTc`만 제거:

```java
            String flfFsgDt, String rprStsTc, String exePttYn,
            String bseYy, String prlmHrkOgzCCone,
```

`update(UpdateCommand cmd)` 위임 호출(약 232행)에서 `cmd.stsTc()` 인자 제거:

```java
                cmd.flfFsgDt(), cmd.rprStsTc(), cmd.exePttYn(),
                cmd.bseYy(), cmd.prlmHrkOgzCCone(), cmd.odnYn(), cmd.abusTc(), cmd.cncdRfrNo());
```

- [ ] **Step 3: `Bprojm.java` — `update()` 오버로드 2종에서 `stsTc` 파라미터/할당 제거**

(a) sno 포함 오버로드(약 246행) 시그니처에서 `String exePttYn, String stsTc, String bseYy` → `String exePttYn, String bseYy`로, 본문(약 275행)의 `this.stsTc = stsTc;` 삭제.

(b) sno 제외 오버로드(약 293행) 동일하게 시그니처에서 `String exePttYn, String stsTc, String bseYy` → `String exePttYn, String bseYy`로, 본문(약 321행)의 `this.stsTc = stsTc;` 삭제.

> 두 오버로드 모두 `exePttYn` 다음의 `stsTc` 한 개 파라미터와 대응 `this.stsTc = stsTc;` 한 줄만 제거. 다른 파라미터 순서는 불변.

- [ ] **Step 4: `BprojmL.java` — 필드/매핑 제거**

다음(약 112~113행) **삭제**:

```java
    @Column(name = "IT_PTL_STS_TC", length = 2, comment = "프로젝트상태")
    private String stsTc;
```

- [ ] **Step 5: `ProjectDto.java` — `toEntity()`/`fromEntity()` 빌더에서 `.stsTc(...)` 제거**

`toEntity()`(약 250행)에서 삭제:

```java
                    .stsTc(stsTc) // 프로젝트상태
```

`Response.fromEntity()`(약 780행)에서 삭제:

```java
                    .stsTc(project.getStsTc()) // 프로젝트상태
```

> `ProjectDto`의 `stsTc` **필드**(Create/Update Request 약 181/389, Response 약 572, SearchCondition 약 971)와 `isEmpty()`의 `stsTc` 참조(약 1001)는 **유지**한다. 응답 `stsTc`는 Task 5에서 BPROJA 대표상태로 주입한다.

- [ ] **Step 6: 컴파일 검증** (이 시점엔 ProjectService가 아직 `getStsTc()`/`request.getStsTc()`를 참조해 실패할 수 있음 → Task 5와 함께 검증)

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: `ProjectService.java`의 `stsTc` 관련 미해결 참조로 FAIL 가능(정상). Task 5 적용 후 통과.

---

### Task 5: `ProjectService` — 상태 쓰기 제거 + BPROJA 대표상태 읽기 합성

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`

- [ ] **Step 1: `BprojaRepository` 의존성 주입**

클래스 상단의 `private final ...Repository` 주입 필드 그룹에 다음 한 줄 추가(기존 `projectRepository` 선언 인접):

```java
    private final com.kdb.it.domain.budget.project.repository.BprojaRepository bprojaRepository;
```

- [ ] **Step 2: 대표상태 계산 헬퍼 추가**

`setCodeNames(...)` 메서드 아래(약 916행 직후, 클래스 내부)에 추가:

```java
    /**
     * BPROJA 관계 행 목록에서 대표상태(IT_PTL_STS_TC 최댓값)를 계산한다.
     *
     * <p>2자리 zero-pad 코드이므로 문자열 사전식 비교 = 숫자 비교. null 상태는 무시.
     * 행이 없거나 모두 null이면 null 반환.</p>
     *
     * @param rows 단일 프로젝트의 미삭제 BPROJA 행 목록
     * @return 대표상태 코드 또는 null
     */
    private String representativeStatus(java.util.List<com.kdb.it.domain.budget.project.entity.Bproja> rows) {
        return rows.stream()
                .map(com.kdb.it.domain.budget.project.entity.Bproja::getStsTc)
                .filter(s -> s != null && !s.isEmpty())
                .max(java.util.Comparator.naturalOrder())
                .orElse(null);
    }
```

- [ ] **Step 3: 단건 조회 경로에 대표상태 주입**

`getProject(...)`의 `setCodeNames(response);`(약 198행) 바로 다음에 추가:

```java
        // 프로젝트 대표상태(BPROJA 중 IT_PTL_STS_TC 최댓값) 주입. 1차에서는 BPROJA 미적재라 null일 수 있음.
        response.setStsTc(representativeStatus(
                bprojaRepository.findByAbusMngNoAndDelYn(prjMngNo, "N")));
```

- [ ] **Step 4: 배치 목록 경로에 대표상태 주입**

배치 enrich 메서드의 응답 주입 루프 진입 직전(약 751행 `// --- 6. 응답 DTO에 일괄 주입 ---` 위)에 배치 조회를 추가:

```java
        // 대표상태 배치 조회: 대상 프로젝트들의 BPROJA를 1회 조회 후 프로젝트별 MAX(IT_PTL_STS_TC) 계산.
        Map<String, String> repStatusByPrj = bprojaRepository
                .findByAbusMngNoInAndDelYn(prjMngNos, "N").stream()
                .collect(Collectors.groupingBy(
                        com.kdb.it.domain.budget.project.entity.Bproja::getAbusMngNo,
                        Collectors.collectingAndThen(Collectors.toList(), this::representativeStatus)));
```

그리고 루프 내부(약 781행 `if (response.getAbusTc() != null) ...` 다음 줄)에서 응답에 주입:

```java
            // 프로젝트 대표상태 주입(없으면 null)
            response.setStsTc(repStatusByPrj.get(project.getAbusMngNo()));
```

> `prjMngNos`는 이 메서드에서 이미 BItemm 배치 조회에 사용 중인 프로젝트관리번호 목록 변수다(약 747행 `findByAbusMngNoInAndDelYn(prjMngNos, "N")` 참고). 동일 변수를 재사용한다.

- [ ] **Step 5: 수정 경로에서 상태 인자 제거**

`update(...)`의 `project.update(new Bprojm.UpdateCommand(...))` 호출(약 385~394행)에서 `request.getStsTc()` 인자 제거. 변경 후 해당 줄(약 392행)은:

```java
                DateFormatUtil.toYmd8(request.getFlfFsgDt()), request.getRprStsTc(), request.getExePttYn(),
                request.getBseYy(), request.getPrlmHrkOgzCCone(),
                request.getOdnYn(), request.getAbusTc(), request.getCncdRfrNo()));
```

> 생성 경로는 `request.toEntity()`를 사용하며, Task 4 Step 5에서 `.stsTc(...)`를 이미 제거했으므로 추가 변경 없음. `request.getStsTc()` 호출처는 이 한 곳뿐(상태는 더 이상 BPROJM에 기록하지 않음).

- [ ] **Step 6: 컴파일 검증**

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 7: 커밋** (Task 4 변경 포함)

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java it_backend/src/main/java/com/kdb/it/domain/log/entity/BprojmL.java it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java
git commit -m "refactor(backend): 프로젝트 상태를 BPROJM 컬럼에서 BPROJA 대표상태(MAX)로 전환"
```

---

### Task 6: `ProjectRepositoryImpl` 상태 필터를 BPROJA 대표상태로 교체

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepositoryImpl.java`

- [ ] **Step 1: import 추가**

상단 import 그룹에 추가:

```java
import com.kdb.it.domain.budget.project.entity.QBproja;
```

- [ ] **Step 2: 상태 필터 교체**

`buildConditionPredicate(...)`의 프로젝트상태 필터 블록(약 156~159행)을 아래로 교체. 기존:

```java
        // 프로젝트상태 필터
        if (condition.getStsTc() != null && !condition.getStsTc().isBlank()) {
            builder.and(bprojm.stsTc.eq(condition.getStsTc()));
        }
```

변경 후:

```java
        // 프로젝트상태 필터: 대표상태(해당 프로젝트 BPROJA 중 MAX IT_PTL_STS_TC)가 조건과 일치하는 프로젝트만.
        if (condition.getStsTc() != null && !condition.getStsTc().isBlank()) {
            QBproja bproja = new QBproja("bproja");
            QBproja bprojaMax = new QBproja("bprojaMax");
            builder.and(
                    JPAExpressions.selectOne()
                            .from(bproja)
                            .where(
                                    bproja.abusMngNo.eq(bprojm.abusMngNo),
                                    bproja.delYn.eq("N"),
                                    bproja.stsTc.eq(condition.getStsTc()),
                                    // 이 행의 상태가 해당 프로젝트의 최대 상태인지
                                    bproja.stsTc.eq(
                                            JPAExpressions.select(bprojaMax.stsTc.max())
                                                    .from(bprojaMax)
                                                    .where(
                                                            bprojaMax.abusMngNo.eq(bprojm.abusMngNo),
                                                            bprojaMax.delYn.eq("N"))))
                            .exists());
        }
```

> `StringPath.max()`는 QueryDSL이 SQL `MAX()`로 변환하며 Oracle VARCHAR2에서 정상 동작한다(HQL 함수 검증 경로가 아님). 상태 필터 미지정 시에는 BPROJA 조인이 없어 BPROJA 미존재 프로젝트도 정상 노출된다.

- [ ] **Step 3: 컴파일 검증**

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepositoryImpl.java
git commit -m "refactor(backend): 프로젝트 목록 상태필터를 BPROJA 대표상태 EXISTS로 교체"
```

---

### Task 7: 프론트 `form.vue` — 저장 payload 상태 제거 + 상태 입력 읽기전용

**Files:**
- Modify: `it_frontend/app/pages/info/projects/form.vue`

- [ ] **Step 1: 저장 payload에서 `stsTc` 제거**

`stsTc: f.prjSts,` 줄(약 916행)을 삭제. 변경 후 인접부:

```js
        exePttYn: f.prjPulPtt, // 추진가능성 (구 prjPulPtt)
        bseYy: String(f.bgYy), // 사업연도 (구 bgYy, 백엔드 String)
```

> 상태는 더 이상 프로젝트가 소유/저장하지 않는다(2차에서 단계별 발생). `prjSts`는 표시용으로만 폼 상태에 남긴다(로드 매핑 약 695행·기본값 약 110/1241행은 그대로 둠).

- [ ] **Step 2: 상태 코드명 변환기 확보**

`const { options: statusOptions } = useCodeOptions('IT_PTL_STS_TC');`(약 228행)을 아래로 변경:

```ts
const { options: statusOptions, getCodeName: getStatusName } = useCodeOptions('IT_PTL_STS_TC');
```

- [ ] **Step 3: 헤더 상태 입력을 읽기전용 표시로 교체**

수정 모드 헤더의 `<Select>` 블록(약 1377~1385행)을 아래 읽기전용 표시로 교체:

```vue
                    <span class="text-zinc-700 dark:text-zinc-200 text-sm font-medium">
                        {{ getStatusName(form.prjSts) || '-' }}
                    </span>
```

> 결과: 상태는 파생 표시(읽기전용)이며 편집 불가. 1차에서는 BPROJA 미적재라 응답 `stsTc`가 비어 `-`로 표시될 수 있다(의도된 중간 상태). `statusOptions`는 다른 참조가 없으면 미사용 경고가 날 수 있으므로, Step 4 점검에서 경고가 보이면 `options:` 구조분해를 제거하고 `getCodeName`만 남긴다.

- [ ] **Step 4: 정적 점검**

Run: `cd it_frontend && npm run check`
Expected: 오류 0, 경고 0 (미사용 `statusOptions` 경고 시 Step 3 주석대로 정리)

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/pages/info/projects/form.vue
git commit -m "feat(frontend): 프로젝트 상태 입력을 읽기전용 파생표시로 전환(BPROJA 정규화)"
```

---

### Task 8: 문서/메타 현행화

**Files:**
- Modify: `meta/table.csv`
- Modify: `it_backend/docs/guides/data-model.md`

- [ ] **Step 1: `meta/table.csv` 갱신**

`TPRMPP_BPROJA` 10개 컬럼 행을 스펙(Task 1 DDL)대로 추가하고, `TPRMPP_BPROJM`/`TPRMPP_BPROJL`의 `IT_PTL_STS_TC` 행을 삭제한다. 기존 CSV 헤더/형식을 그대로 따른다(편집 전 파일 상단 헤더 행 확인 후 동일 컬럼 순서로 작성).

- [ ] **Step 2: `data-model.md` 갱신**

BPROJM 매핑 표에서 `IT_PTL_STS_TC`(프로젝트상태) 행을 제거하고, 신규 `TPRMPP_BPROJA`(정보화사업관계) 항목과 "프로젝트 대표상태 = BPROJA MAX(IT_PTL_STS_TC)" 설명, 단계↔key 매핑 표를 추가한다(설계 spec `docs/superpowers/specs/2026-06-24-bproja-status-relation-design.md` §2 참조).

- [ ] **Step 3: 커밋**

```bash
git add meta/table.csv it_backend/docs/guides/data-model.md
git commit -m "docs: BPROJA 신설/상태 정규화 메타·데이터모델 현행화"
```

---

### Task 9: 최종 검증

- [ ] **Step 1: 백엔드 컴파일** — `cd it_backend && ./gradlew compileJava -q` → BUILD SUCCESSFUL
- [ ] **Step 2: 프론트 정적 점검** — `cd it_frontend && npm run check` → 오류 0/경고 0
- [ ] **Step 3: 로컬 마이그레이션 적용 확인(선택)** — `local-ext`/`local-int` 프로파일 `gradlew bootRun` 기동 시 V20260624_002 적용 로그 + `TPRMPP_BPROJA` 생성 확인. 프로젝트 목록/상세 200 응답, 상태 컬럼 공란(BPROJA 미적재) 정상.

---

## Self-Review

- **Spec 커버리지**: BPROJA 생성(§4.1)·BPROJM/L 상태 DROP(§4.1)=Task 1 ✓; Bproja/BprojaId(§4.2)=Task 2 ✓; BprojaRepository 대표상태(§4.2)=Task 3 ✓; Bprojm/BprojmL/DTO 빌더 stsTc 제거(§4.3)=Task 4 ✓; ProjectService 쓰기제거+읽기합성(§4.3)=Task 5 ✓; ProjectRepositoryImpl 필터 교체(§4.3)=Task 6 ✓; form.vue 읽기전용(§4.4)=Task 7 ✓; 메타/데이터모델(§4.5)=Task 8 ✓; 대표상태 MAX(결정 4)=Task 3 헬퍼+Task 6 서브쿼리 ✓; 로그 미적용(결정 6)=Task 2 `@LogTarget` 미부착 ✓; 이관 없음(결정 5)=Task 1 DML 없음 ✓.
- **Placeholder 스캔**: 모든 코드 스텝에 실제 코드 포함. "적절한 처리/추후" 류 없음. (메타 CSV는 기존 파일 헤더 형식을 따르도록 명시 — 파일 의존이라 컬럼 값까지는 현장 헤더 확인 후 작성.)
- **타입 일관성**: `representativeStatus(List<Bproja>)`는 Task 5 Step 2 정의 → Step 3/4에서 동일 시그니처 사용 ✓. `findByAbusMngNoAndDelYn`/`findByAbusMngNoInAndDelYn`는 Task 3 정의 → Task 5에서 동일 사용 ✓. `getStatusName`은 Task 7 Step 2 정의 → Step 3 사용 ✓. `QBproja` alias(`bproja`/`bprojaMax`)는 Task 6 내부 일관 ✓.
- **위험**: (1) `StringPath.max()` Oracle SQL MAX 변환 — QueryDSL 레벨이라 HQL 함수검증 회피. (2) 1차 BPROJA 공란 → 상태 표시 공란(의도된 트레이드오프, 사용자 확인). (3) test worker 이슈로 JUnit 대신 compileJava 검증(메모리 근거).
