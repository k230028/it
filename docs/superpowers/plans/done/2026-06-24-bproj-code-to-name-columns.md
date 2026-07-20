# TPRMPP_BPROJM/BPROJL 코드값→코드값명 컬럼 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TPRMPP_BPROJM/BPROJL의 사업유형·기술분야·고객유형·업무구분 컬럼을 공통코드 "코드값"이 아닌 "코드값명"을 저장하도록 전환하고, 컬럼명/타입 변경과 공통코드 그룹ID 통일을 백엔드·프론트·DB 마이그레이션에 일괄 반영한다.

**Architecture:** Flyway 마이그레이션으로 (1) 기존 코드값 데이터를 CCODEM 기준 코드값명으로 변환, (2) 컬럼 rename/타입 확장, (3) 공통코드 그룹ID(PRJ_TP→ABUS_PPO, IT_PTL_TCHN_TP_TC→SKL_FLD) rename을 수행한다. 백엔드는 엔티티 `@Column` 매핑·길이와 `CommonCodeGroups` 상수를 갱신하고, 4개 필드의 코드→명 해석 로직을 제거(컬럼값을 그대로 *Nm에 사용)한다. 프론트는 드롭다운은 유지하되 저장/로드 경계에서 코드↔명을 변환하여 컬럼에 "명"이 저장되도록 한다.

**Tech Stack:** Oracle + Flyway, Spring Boot 4 / JPA / QueryDSL, Nuxt 4 / PrimeVue.

---

## 결정 사항 (Decisions, 사용자 확인 완료)

1. **IT_PTL_TCHN_TP_TC → SKL_FLD_NM**: 순수 rename(기존 컬럼 DROP, 타입 VARCHAR2(500)). 최종 스키마의 IT_PTL_TCHN_TP_TC 잔존 행은 누락으로 간주.
2. **저장 방식**: 4개 필드 모두 "코드값명" 저장 + 프론트 드롭다운 유지.
3. **기존 데이터**: 코드값 → 코드값명으로 변환 마이그레이션(운영 데이터 보존).
4. **식별자 유지(설계 결정)**: Java/DTO/JSON 식별자(`bzTpC`/`sklTpTc`/`cstTpTc`/`bzDttNm`)는 API 계약 안정성을 위해 **유지**하고, 물리 컬럼 매핑·타입·동작만 변경한다. 컬럼-필드 불일치는 주석으로 명시.

## 컬럼 변경 매핑표

| 의미 | Java 필드 | 구 컬럼(타입) | 신 컬럼(타입) | 공통코드 그룹ID(구→신) |
|---|---|---|---|---|
| 업무구분 | `bzDttNm` | BZ_DTT_NM(100) | BZ_DTT_NM(100, 불변) | BZ_DTT (불변) |
| 사업유형 | `bzTpC` | BZ_TP_C(6) | **ABUS_PPO_CONE(300)** | PRJ_TP → **ABUS_PPO** |
| 기술분야 | `sklTpTc` | IT_PTL_TCHN_TP_TC(2) | **SKL_FLD_NM(500)** | IT_PTL_TCHN_TP_TC → **SKL_FLD** |
| 고객유형 | `cstTpTc` | CST_TP_TC(3) | **CST_TP_TC_NM(1000)** | CST_TP_TC (불변) |

> BPROJL(로그)도 동일 4컬럼을 동일 신규명/타입으로 변경(로그 테이블 폭 확장 포함).

## File Structure

- **DB**: `it_database/migrations/V20260624_001__BprojCodeToNameColumns.sql` (신규) — 데이터 변환 + 컬럼 rename/확장 + 공통코드 그룹ID rename.
- **Backend**:
  - `Bprojm.java` — `@Column` name/length/comment 갱신(3컬럼 rename, 1컬럼 의미 주석).
  - `BprojmL.java` — 동일 4컬럼 name/length 갱신.
  - `CommonCodeGroups.java` — `PRJ_TYPE="ABUS_PPO"`, `TECH_TYPE="SKL_FLD"`.
  - `ProjectService.java` — 4개 필드 코드→명 해석 제거, `*Nm = 원본 컬럼값`.
  - `ProjectDto.java` — 주석 현행화(코드값→코드값명).
- **Frontend**:
  - `useProjects.ts` 없음(해당 없음) / `pages/info/projects/form.vue` — 드롭다운 그룹ID(2건) 갱신, 저장 시 코드→명 변환, 로드 시 명→코드 복원.
  - `pages/info/projects/[id].vue`, `index.vue` — 표시는 컬럼값(명) 그대로 사용(코드 의존 제거 확인).
- **Docs**: `it_backend/docs/guides/data-model.md`, `meta/table.csv` 해당 행 현행화(있으면).

---

### Task 1: Flyway 마이그레이션 작성 (데이터 변환 + 컬럼/그룹 rename)

**Files:**
- Create: `it_database/migrations/V20260624_001__BprojCodeToNameColumns.sql`

핵심 규칙:
- 데이터 변환은 **컬럼 rename/확장 후** 수행하되, `NVL(<lookup>, col)`로 미매칭(직접입력 자유텍스트/널)은 보존.
- CCODEM 다중 STT_DT 행 대비 최신 1건 선택 서브쿼리 사용.
- 공통코드 그룹ID rename은 CCODEM(필요 시 CCODEL)에 적용.

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- V20260624_001__BprojCodeToNameColumns.sql
-- TPRMPP_BPROJM/BPROJL: 사업유형/기술분야/고객유형/업무구분을 코드값→코드값명 저장으로 전환.
--  - 컬럼 rename/타입 확장 후, 기존 코드값을 CCODEM 코드값명으로 변환(NVL로 미매칭 보존).
--  - 공통코드 그룹ID 통일: PRJ_TP→ABUS_PPO, IT_PTL_TCHN_TP_TC→SKL_FLD.
-- 주의: 적용 후 수정 금지(Flyway 체크섬). 변경은 새 버전으로.

-- 1) 컬럼 rename + 타입 확장 (BPROJM)
ALTER TABLE ITPOWN.TPRMPP_BPROJM RENAME COLUMN BZ_TP_C TO ABUS_PPO_CONE;
ALTER TABLE ITPOWN.TPRMPP_BPROJM MODIFY ABUS_PPO_CONE VARCHAR2(300 CHAR);
ALTER TABLE ITPOWN.TPRMPP_BPROJM RENAME COLUMN IT_PTL_TCHN_TP_TC TO SKL_FLD_NM;
ALTER TABLE ITPOWN.TPRMPP_BPROJM MODIFY SKL_FLD_NM VARCHAR2(500 CHAR);
ALTER TABLE ITPOWN.TPRMPP_BPROJM RENAME COLUMN CST_TP_TC TO CST_TP_TC_NM;
ALTER TABLE ITPOWN.TPRMPP_BPROJM MODIFY CST_TP_TC_NM VARCHAR2(1000 CHAR);
ALTER TABLE ITPOWN.TPRMPP_BPROJM MODIFY BZ_DTT_NM VARCHAR2(100 CHAR);

-- 2) 컬럼 rename + 타입 확장 (BPROJL 로그)
ALTER TABLE ITPOWN.TPRMPP_BPROJL RENAME COLUMN BZ_TP_C TO ABUS_PPO_CONE;
ALTER TABLE ITPOWN.TPRMPP_BPROJL MODIFY ABUS_PPO_CONE VARCHAR2(300 CHAR);
ALTER TABLE ITPOWN.TPRMPP_BPROJL RENAME COLUMN IT_PTL_TCHN_TP_TC TO SKL_FLD_NM;
ALTER TABLE ITPOWN.TPRMPP_BPROJL MODIFY SKL_FLD_NM VARCHAR2(500 CHAR);
ALTER TABLE ITPOWN.TPRMPP_BPROJL RENAME COLUMN CST_TP_TC TO CST_TP_TC_NM;
ALTER TABLE ITPOWN.TPRMPP_BPROJL MODIFY CST_TP_TC_NM VARCHAR2(1000 CHAR);
ALTER TABLE ITPOWN.TPRMPP_BPROJL MODIFY BZ_DTT_NM VARCHAR2(100 CHAR);

-- 3) 기존 코드값 → 코드값명 변환 (BPROJM). 미매칭은 NVL로 원본 보존.
UPDATE ITPOWN.TPRMPP_BPROJM m SET m.ABUS_PPO_CONE = NVL((
    SELECT CDVA_NM FROM (
        SELECT CDVA_NM FROM ITPOWN.TPRMPP_CCODEM
        WHERE CO_C_ID_NM = 'PRJ_TP' AND CDVA_ID = m.ABUS_PPO_CONE ORDER BY STT_DT DESC
    ) WHERE ROWNUM = 1), m.ABUS_PPO_CONE)
WHERE m.ABUS_PPO_CONE IS NOT NULL;

UPDATE ITPOWN.TPRMPP_BPROJM m SET m.SKL_FLD_NM = NVL((
    SELECT CDVA_NM FROM (
        SELECT CDVA_NM FROM ITPOWN.TPRMPP_CCODEM
        WHERE CO_C_ID_NM = 'IT_PTL_TCHN_TP_TC' AND CDVA_ID = m.SKL_FLD_NM ORDER BY STT_DT DESC
    ) WHERE ROWNUM = 1), m.SKL_FLD_NM)
WHERE m.SKL_FLD_NM IS NOT NULL;

UPDATE ITPOWN.TPRMPP_BPROJM m SET m.CST_TP_TC_NM = NVL((
    SELECT CDVA_NM FROM (
        SELECT CDVA_NM FROM ITPOWN.TPRMPP_CCODEM
        WHERE CO_C_ID_NM = 'CST_TP_TC' AND CDVA_ID = m.CST_TP_TC_NM ORDER BY STT_DT DESC
    ) WHERE ROWNUM = 1), m.CST_TP_TC_NM)
WHERE m.CST_TP_TC_NM IS NOT NULL;

UPDATE ITPOWN.TPRMPP_BPROJM m SET m.BZ_DTT_NM = NVL((
    SELECT CDVA_NM FROM (
        SELECT CDVA_NM FROM ITPOWN.TPRMPP_CCODEM
        WHERE CO_C_ID_NM = 'BZ_DTT' AND CDVA_ID = m.BZ_DTT_NM ORDER BY STT_DT DESC
    ) WHERE ROWNUM = 1), m.BZ_DTT_NM)
WHERE m.BZ_DTT_NM IS NOT NULL;

-- 4) 기존 코드값 → 코드값명 변환 (BPROJL 로그)
UPDATE ITPOWN.TPRMPP_BPROJL l SET l.ABUS_PPO_CONE = NVL((
    SELECT CDVA_NM FROM (
        SELECT CDVA_NM FROM ITPOWN.TPRMPP_CCODEM
        WHERE CO_C_ID_NM = 'PRJ_TP' AND CDVA_ID = l.ABUS_PPO_CONE ORDER BY STT_DT DESC
    ) WHERE ROWNUM = 1), l.ABUS_PPO_CONE)
WHERE l.ABUS_PPO_CONE IS NOT NULL;

UPDATE ITPOWN.TPRMPP_BPROJL l SET l.SKL_FLD_NM = NVL((
    SELECT CDVA_NM FROM (
        SELECT CDVA_NM FROM ITPOWN.TPRMPP_CCODEM
        WHERE CO_C_ID_NM = 'IT_PTL_TCHN_TP_TC' AND CDVA_ID = l.SKL_FLD_NM ORDER BY STT_DT DESC
    ) WHERE ROWNUM = 1), l.SKL_FLD_NM)
WHERE l.SKL_FLD_NM IS NOT NULL;

UPDATE ITPOWN.TPRMPP_BPROJL l SET l.CST_TP_TC_NM = NVL((
    SELECT CDVA_NM FROM (
        SELECT CDVA_NM FROM ITPOWN.TPRMPP_CCODEM
        WHERE CO_C_ID_NM = 'CST_TP_TC' AND CDVA_ID = l.CST_TP_TC_NM ORDER BY STT_DT DESC
    ) WHERE ROWNUM = 1), l.CST_TP_TC_NM)
WHERE l.CST_TP_TC_NM IS NOT NULL;

UPDATE ITPOWN.TPRMPP_BPROJL l SET l.BZ_DTT_NM = NVL((
    SELECT CDVA_NM FROM (
        SELECT CDVA_NM FROM ITPOWN.TPRMPP_CCODEM
        WHERE CO_C_ID_NM = 'BZ_DTT' AND CDVA_ID = l.BZ_DTT_NM ORDER BY STT_DT DESC
    ) WHERE ROWNUM = 1), l.BZ_DTT_NM)
WHERE l.BZ_DTT_NM IS NOT NULL;

-- 5) 공통코드 그룹ID 통일 (변환 완료 후 rename)
UPDATE ITPOWN.TPRMPP_CCODEM SET CO_C_ID_NM = 'ABUS_PPO' WHERE CO_C_ID_NM = 'PRJ_TP';
UPDATE ITPOWN.TPRMPP_CCODEM SET CO_C_ID_NM = 'SKL_FLD'  WHERE CO_C_ID_NM = 'IT_PTL_TCHN_TP_TC';

-- 6) 컬럼 코멘트 갱신
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJM.ABUS_PPO_CONE IS '사업목적내용';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJM.SKL_FLD_NM    IS '기술분야명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJM.CST_TP_TC_NM  IS '고객유형구분코드명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJM.BZ_DTT_NM     IS '업무구분명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJL.ABUS_PPO_CONE IS '사업목적내용';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJL.SKL_FLD_NM    IS '기술분야명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJL.CST_TP_TC_NM  IS '고객유형구분코드명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJL.BZ_DTT_NM     IS '업무구분명';
```

- [ ] **Step 2: 커밋**

```bash
git add it_database/migrations/V20260624_001__BprojCodeToNameColumns.sql
git commit -m "feat(db): BPROJM/BPROJL 코드값→코드값명 컬럼 전환 마이그레이션"
```

---

### Task 2: 백엔드 엔티티 `@Column` 매핑 갱신

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BprojmL.java`

- [ ] **Step 1: Bprojm.java — 3컬럼 rename + 1컬럼 의미 주석** (필드명 유지)

```java
    // 사업유형 → 사업목적내용(코드값명 저장). 물리컬럼 ABUS_PPO_CONE.
    @Column(name = "ABUS_PPO_CONE", length = 300, comment = "사업유형명 (물리컬럼 ABUS_PPO_CONE=사업목적내용, 공통코드 ABUS_PPO 코드값명 저장)")
    private String bzTpC;

    // 업무구분: 코드값이 아닌 코드값명(BZ_DTT) 저장
    @Column(name = "BZ_DTT_NM", length = 100, comment = "업무구분명 (공통코드 BZ_DTT 코드값명 저장)")
    private String bzDttNm;

    // 기술분야: 코드값명(SKL_FLD) 저장
    @Column(name = "SKL_FLD_NM", length = 500, comment = "기술분야명 (물리컬럼 SKL_FLD_NM, 공통코드 SKL_FLD 코드값명 저장)")
    private String sklTpTc;

    // 고객유형/주요사용자: 코드값명(CST_TP_TC) 저장
    @Column(name = "CST_TP_TC_NM", length = 1000, comment = "고객유형구분코드명 (물리컬럼 CST_TP_TC_NM, 공통코드 CST_TP_TC 코드값명 저장)")
    private String cstTpTc;
```

- [ ] **Step 2: BprojmL.java — 동일 4컬럼 갱신**

```java
    @Column(name = "ABUS_PPO_CONE", length = 300, comment = "사업유형명 (물리컬럼 ABUS_PPO_CONE=사업목적내용)")
    private String bzTpC;

    @Column(name = "BZ_DTT_NM", length = 100, comment = "업무구분명")
    private String bzDttNm;

    @Column(name = "SKL_FLD_NM", length = 500, comment = "기술분야명 (물리컬럼 SKL_FLD_NM)")
    private String sklTpTc;

    @Column(name = "CST_TP_TC_NM", length = 1000, comment = "고객유형구분코드명 (물리컬럼 CST_TP_TC_NM)")
    private String cstTpTc;
```

- [ ] **Step 3: 컴파일 검증**

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java it_backend/src/main/java/com/kdb/it/domain/log/entity/BprojmL.java
git commit -m "refactor(backend): BPROJM/BPROJL 엔티티 컬럼 매핑 코드값명 전환"
```

---

### Task 3: `CommonCodeGroups` 상수 갱신

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/CommonCodeGroups.java`

- [ ] **Step 1: 상수 값 변경**

```java
    /** 기술분야 (구 IT_PTL_TCHN_TP_TC) — 공통코드 그룹ID 통일 */
    public static final String TECH_TYPE = "SKL_FLD";
    ...
    /** 사업유형 (구 PRJ_TP) — 공통코드 그룹ID 통일 */
    public static final String PRJ_TYPE = "ABUS_PPO";
```

> `MAIN_USER="CST_TP_TC"`, `BZ_DTT="BZ_DTT"`는 그룹ID 불변이므로 유지.

- [ ] **Step 2: 커밋** (Task 4와 함께 검증 후 커밋 가능)

---

### Task 4: `ProjectService` 코드→명 해석 제거 (4개 필드)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`

배치 조회(약 720~791행)와 단건 `setCodeNames`(약 909~924행)에서 `bzTpC/bzDttNm/sklTpTc/cstTpTc`는 컬럼값이 곧 명이므로 CCODEM 해석을 제거하고 `*Nm = 원본값`으로 설정.

- [ ] **Step 1: 배치 경로 — 4개 필드 수집/네임맵 제거 후 직접 대입**

배치 수집 루프(약 734~737행)의 `prjTpCdvas/bzDttCdvas/tchnTpCdvas/mnUsrCdvas` 수집 4줄 삭제, 네임맵 빌드(748~751행) 4줄 삭제, 주입부(785~788행)를 아래로 교체:

```java
            // 사업유형/업무구분/기술분야/고객유형은 컬럼에 코드값명을 직접 저장 → 원본값 그대로 사용
            response.setBzTpCNm(response.getBzTpC());
            response.setBzDttNmNm(response.getBzDttNm());
            response.setSklTpTcNm(response.getSklTpTc());
            response.setCstTpTcNm(response.getCstTpTc());
```

- [ ] **Step 2: 단건 `setCodeNames` — 4개 블록 교체**

909~924행의 `bzTpC/bzDttNm/sklTpTc/cstTpTc` CCODEM 조회 4블록을 아래로 교체:

```java
        // 사업유형/업무구분/기술분야/고객유형: 컬럼값이 곧 코드값명
        response.setBzTpCNm(response.getBzTpC());
        response.setBzDttNmNm(response.getBzDttNm());
        response.setSklTpTcNm(response.getSklTpTc());
        response.setCstTpTcNm(response.getCstTpTc());
```

> `rprStsTc/exePttYn/abusTc` 해석은 유지(여전히 코드 저장).

- [ ] **Step 3: 컴파일 검증**

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL (미사용 import/변수 경고 없도록 정리)

- [ ] **Step 4: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/code/CommonCodeGroups.java it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java
git commit -m "refactor(backend): 프로젝트 4개 필드 코드→명 해석 제거(컬럼값=명)"
```

---

### Task 5: 프론트 폼 — 드롭다운 그룹ID 갱신 + 저장/로드 코드↔명 변환

**Files:**
- Modify: `it_frontend/app/pages/info/projects/form.vue`

- [ ] **Step 1: 드롭다운 그룹ID 갱신 (231~232행)**

```ts
const { options: prjTpOptions, getCodeName: getPrjTpName } = useCodeOptions('ABUS_PPO');
const { options: tchnTpOptions, getCodeName: getTchnTpName } = useCodeOptions('SKL_FLD');
```

추가로 업무구분/주요사용자도 변환용 getCodeName 확보(230,233행):

```ts
const { options: bzDttOptions, getCodeName: getBzDttName } = useCodeOptions('BZ_DTT');
const { options: mnUsrOptions, getCodeName: getMnUsrName } = useCodeOptions('CST_TP_TC');
```

- [ ] **Step 2: 명↔코드 변환 헬퍼 추가** (restoreCodeField 인근)

```ts
/** 코드값명 → 코드값. 옵션에 매칭되는 명이 있으면 코드 반환, 없으면 원본(자유입력) 반환. */
const codeOfName = (name: string, options: CodeOption[]) =>
    options.find((o) => o.cdvaNm === name)?.cdva ?? name;
```

- [ ] **Step 3: 저장 payload — 4개 필드 코드→명 변환 (874~876, 854행)**

```ts
        bzTpC: getPrjTpName(f.prjTp), // 사업유형: 코드→코드값명 저장 (자유입력은 원본)
        bzDttNm: getBzDttName(f.bzDtt), // 업무구분: 코드값명 저장
        sklTpTc: getTchnTpName(f.tchnTp), // 기술분야: 코드값명 저장
        cstTpTc: getMnUsrName(f.mnUsr), // 주요사용자: 코드값명 저장
```

> `getCodeName`은 매칭 없으면 원본 반환하므로 자유입력(직접입력) 텍스트는 그대로 저장됨.

- [ ] **Step 4: 로드 매핑 — 명→코드 복원 (654/664/672/685, 1172/1181/1189/1202행)**

신규/상세 로드 시 컬럼값(명)을 `codeOfName`으로 코드 변환하여 form draft에 주입(이후 기존 restoreCodeField가 코드로 동작):

```ts
                    prjTp: codeOfName(project.bzTpC ?? '', prjTpOptions.value),
                    bzDtt: codeOfName(project.bzDttNm ?? '', bzDttOptions.value),
                    mnUsr: codeOfName(project.cstTpTc ?? '', mnUsrOptions.value),
                    tchnTp: codeOfName(project.sklTpTc ?? '', tchnTpOptions.value),
```

상세 로드(1172~1202행)도 동일 패턴(`detail.bzTpC` 등)으로 적용.

- [ ] **Step 5: 타입체크/린트**

Run: `cd it_frontend && npm run check`
Expected: 오류 0, 경고 0

- [ ] **Step 6: 커밋**

```bash
git add it_frontend/app/pages/info/projects/form.vue
git commit -m "feat(frontend): 프로젝트 폼 드롭다운 코드값명 저장 전환"
```

---

### Task 6: 표시 페이지·문서 현행화

**Files:**
- Modify: `it_frontend/app/pages/info/projects/index.vue` (322행 — `bzTpCNm ?? bzTpC` 그대로 동작, 주석만 현행화 필요 시)
- Modify: `it_frontend/app/pages/info/projects/[id].vue` (코드→명 표시 의존 제거 확인)
- Modify: `it_backend/docs/guides/data-model.md`, `meta/table.csv` (BPROJM/BPROJL 4컬럼 행 현행화)

- [ ] **Step 1: [id].vue에서 4개 필드 표시가 getCodeName 등 코드 의존이면 컬럼값 직접 표시로 변경, 아니면 변경 없음 확인**

Run: `cd it_frontend; npx grep` 대신 에디터에서 `sklTpTc|cstTpTc|bzTpC|bzDttNm` 표시부 확인.

- [ ] **Step 2: 데이터 모델/메타 문서 4컬럼 행 현행화**

`meta/table.csv`의 TPRMPP_BPROJM/BPROJL 해당 행을 신 컬럼명/타입/한글명으로 수정.

- [ ] **Step 3: 커밋**

```bash
git add -A
git commit -m "docs: BPROJM/BPROJL 코드값명 전환 문서/메타 현행화"
```

---

### Task 7: 검증

- [ ] **Step 1: 백엔드 컴파일** — `cd it_backend && ./gradlew compileJava -q` → BUILD SUCCESSFUL
- [ ] **Step 2: 프론트 정적 점검** — `cd it_frontend && npm run check` → 오류 0/경고 0
- [ ] **Step 3: 마이그레이션 적용 확인(로컬, 선택)** — `local-ext`/`local-int` 프로파일 `gradlew bootRun` 기동 시 V20260624_001 적용 로그 확인. (운영/dev는 DBA 수동 적용)

---

## Self-Review

- **Spec 커버리지**: 4컬럼 rename/타입(BZ_DTT_NM 불변, ABUS_PPO_CONE 300, SKL_FLD_NM 500, CST_TP_TC_NM 1000) ✓, 그룹ID PRJ_TP→ABUS_PPO·IT_PTL_TCHN_TP_TC→SKL_FLD ✓, 코드값명 저장 ✓, 데이터 변환 ✓, IT_PTL_TCHN_TP_TC DROP(rename) ✓.
- **타입 일관성**: `codeOfName`/`getXxxName` 시그니처 일관, 백엔드 `*Nm` setter 명칭(setBzTpCNm/setBzDttNmNm/setSklTpTcNm/setCstTpTcNm) 기존 DTO와 일치.
- **위험**: 마이그레이션 데이터 변환(NVL 보존, 최신 STT_DT 1건) — 적용 전 백업 권장. 식별자 유지로 인한 컬럼-필드 명칭 불일치는 주석으로 명시.
