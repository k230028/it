# 결재 상태 코드화 + 재상신 + 회수 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capplm/Cdecim의 한글 상태값을 공통코드(APF_STS/DCD_STS)로 전면 코드화하고, 반려/회수 신청서의 재상신을 허용하며, 신청자/중간결재자/관리자가 사용할 수 있는 회수 API를 추가한다. Cappla의 글로벌 시퀀스 채번을 신청서 단위 1~N 채번으로 변경한다.

**Architecture:** 단일 컷오버 — 공통코드 등록 + 컬럼 추가 + 데이터 백필 + 코드 전체 교체 + Legacy 컬럼 DROP을 한 릴리스로 처리. 회수는 `ApplicationService.recall()` 신규 메서드와 `POST /api/applications/{apfMngNo}/recall` 엔드포인트로 제공. 이벤트는 기존 `ApprovalCompletedEvent` 패턴과 동일하게 `ApprovalRecalledEvent`로 발행하고 알림 리스너가 처리.

**Tech Stack:** Spring Boot 4.0.5 / Java 25 / Oracle / Flyway / JPA + QueryDSL / JUnit5 + Mockito + AssertJ / Nuxt 4 / TypeScript

**Spec:** [docs/superpowers/specs/2026-05-25-approval-status-recall-design.md](../specs/2026-05-25-approval-status-recall-design.md)

---

## File Structure

**Backend — 신규**
- `it_database/migrations/V20260525_001__AddApprovalStatusCodes.sql` — Ccodem INSERT
- `it_database/migrations/V20260525_002__AddCapplmApfStsC.sql` — APF_STS_C 컬럼 + 백필
- `it_database/migrations/V20260525_003__AddCdecimDcdStsC.sql` — DCD_STS_C 컬럼 + 백필
- `it_database/migrations/V20260525_004__RefactorCapplaRelSno.sql` — Cappla 채번 리넘버링
- `it_database/migrations/V20260525_005__DropLegacyApprovalColumns.sql` — Legacy 컬럼 DROP
- `it_backend/src/main/java/com/kdb/it/common/approval/domain/ApprovalStatus.java`
- `it_backend/src/main/java/com/kdb/it/common/approval/domain/DecisionStatus.java`
- `it_backend/src/main/java/com/kdb/it/common/approval/event/ApprovalRecalledEvent.java`
- `it_backend/src/main/java/com/kdb/it/common/approval/entity/CapplaId.java`

**Backend — 수정**
- `entity/Capplm.java` — apfStsC 추가, apfSts 제거, updateStatus 시그니처 변경
- `entity/Cdecim.java` — dcdStsC 추가, dcdTp/dcdSts 제거, approve() 시그니처 변경
- `entity/Cappla.java` — @GeneratedValue 제거, 복합키 도입
- `dto/ApplicationDto.java` — Response.apfStsC 추가, RecallRequest 신규
- `repository/ApplicationRepository.java` — native query WHERE 한글→코드
- `repository/ApplicationMapRepository.java` — findMaxRelSnoByApfMngNo 추가
- `service/ApplicationService.java` — submit/approve 코드값화 + recall 신규
- `service/ApprovalLineDelegate.java` — applyRecallInfo 추가
- `controller/ApplicationController.java` — recall 엔드포인트 추가
- `notification/listener/NotificationEventListener.java` — onApprovalRecalled 추가
- `domain/budget/project/repository/ProjectRepositoryImpl.java` — apfSts='none' 분기 확장
- `domain/budget/cost/repository/CostRepositoryImpl.java` — 동일

**Frontend**
- `it_frontend/composables/useApprovalStatus.ts` (신규) — 코드↔라벨 매핑
- `it_frontend/pages/approval/[apfMngNo].vue` — 회수 버튼 추가
- `it_frontend/pages/approval/list.vue` — apfStsC 컬럼 매핑

**Tests**
- `test/.../ApplicationServiceTest.java` — submit 케이스 확장
- `test/.../ApplicationServiceRecallTest.java` (신규)

---

## Wave 1 — 공통코드 등록

### Task 1: Flyway V001 — Ccodem APF_STS/DCD_STS/INF_TP 등록

**Files:**
- Create: `it_database/migrations/V20260525_001__AddApprovalStatusCodes.sql`

- [ ] **Step 1: TPRMPP_CCODEM 컬럼명 확인**

```
Glob: it_database/migrations/V*Ccodem*.sql
Read: 최초 Ccodem 생성 스크립트 헤더부 (CREATE TABLE 컬럼 목록)
```
SORT_NO 컬럼명/USE_YN 기본값 확인 후 Step 2 SQL 보정.

- [ ] **Step 2: SQL 작성**

```sql
MERGE INTO TPRMPP_CCODEM tgt
USING (
    SELECT 'APF_STS' AS C_ID, '001' AS C_VL, '결재중'   AS C_NM, 1 AS SORT_NO FROM DUAL UNION ALL
    SELECT 'APF_STS',         '002',         '결재완료',       2          FROM DUAL UNION ALL
    SELECT 'APF_STS',         '003',         '반려',           3          FROM DUAL UNION ALL
    SELECT 'APF_STS',         '004',         '회수',           4          FROM DUAL
) src
ON (tgt.C_ID = src.C_ID AND tgt.C_VL = src.C_VL)
WHEN NOT MATCHED THEN INSERT (C_ID, C_VL, C_NM, SORT_NO, USE_YN, DEL_YN, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID)
VALUES (src.C_ID, src.C_VL, src.C_NM, src.SORT_NO, 'Y', 'N', SYSTIMESTAMP, 'SYSTEM', SYSTIMESTAMP, 'SYSTEM');

MERGE INTO TPRMPP_CCODEM tgt
USING (
    SELECT 'DCD_STS' AS C_ID, '001' AS C_VL, '미결재'   AS C_NM, 1 AS SORT_NO FROM DUAL UNION ALL
    SELECT 'DCD_STS',         '002',         '승인',           2          FROM DUAL UNION ALL
    SELECT 'DCD_STS',         '003',         '반려',           3          FROM DUAL UNION ALL
    SELECT 'DCD_STS',         '004',         '회수무효',       4          FROM DUAL
) src
ON (tgt.C_ID = src.C_ID AND tgt.C_VL = src.C_VL)
WHEN NOT MATCHED THEN INSERT (C_ID, C_VL, C_NM, SORT_NO, USE_YN, DEL_YN, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID)
VALUES (src.C_ID, src.C_VL, src.C_NM, src.SORT_NO, 'Y', 'N', SYSTIMESTAMP, 'SYSTEM', SYSTIMESTAMP, 'SYSTEM');

MERGE INTO TPRMPP_CCODEM tgt
USING (SELECT 'INF_TP' AS C_ID, '006' AS C_VL, '결재회수' AS C_NM, 6 AS SORT_NO FROM DUAL) src
ON (tgt.C_ID = src.C_ID AND tgt.C_VL = src.C_VL)
WHEN NOT MATCHED THEN INSERT (C_ID, C_VL, C_NM, SORT_NO, USE_YN, DEL_YN, FST_ENR_DTM, FST_ENR_USID, LST_CHG_DTM, LST_CHG_USID)
VALUES (src.C_ID, src.C_VL, src.C_NM, src.SORT_NO, 'Y', 'N', SYSTIMESTAMP, 'SYSTEM', SYSTIMESTAMP, 'SYSTEM');
```

- [ ] **Step 3: 로컬 DB 적용 + 검증**

```powershell
cd it_backend
./gradlew flywayMigrate
```
Then via `.\it_database\connect-db.ps1`:
`SELECT C_ID, C_VL, C_NM FROM TPRMPP_CCODEM WHERE C_ID IN ('APF_STS','DCD_STS') OR (C_ID='INF_TP' AND C_VL='006') ORDER BY C_ID, C_VL;`
Expected: 9건.

- [ ] **Step 4: Commit**

```powershell
git add it_database/migrations/V20260525_001__AddApprovalStatusCodes.sql
git commit -m "feat(db): 결재상태/결재선상태/회수알림 공통코드 추가"
```

---

## Wave 2 — Capplm 코드화

### Task 2: Flyway V002 — APF_STS_C 컬럼 추가 + 백필

**Files:**
- Create: `it_database/migrations/V20260525_002__AddCapplmApfStsC.sql`

- [ ] **Step 1: SQL 작성**

```sql
ALTER TABLE TPRMPP_CAPPLM ADD APF_STS_C VARCHAR2(3);
COMMENT ON COLUMN TPRMPP_CAPPLM.APF_STS_C IS '신청서상태코드 (Ccodem APF_STS)';

UPDATE TPRMPP_CAPPLM
SET APF_STS_C = DECODE(APF_STS, '결재중', '001', '결재완료', '002', '반려', '003', '001');

COMMIT;

ALTER TABLE TPRMPP_CAPPLM MODIFY APF_STS_C VARCHAR2(3) NOT NULL;
```

- [ ] **Step 2: 적용 및 검증**

```powershell
cd it_backend
./gradlew flywayMigrate
```
SQL: `SELECT APF_STS, APF_STS_C, COUNT(*) FROM TPRMPP_CAPPLM GROUP BY APF_STS, APF_STS_C;`
Expected: 모든 행 APF_STS_C NOT NULL.

- [ ] **Step 3: Commit**

```powershell
git add it_database/migrations/V20260525_002__AddCapplmApfStsC.sql
git commit -m "feat(db): TPRMPP_CAPPLM에 APF_STS_C 컬럼 추가 및 백필"
```

---

### Task 3: ApprovalStatus enum 생성

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/domain/ApprovalStatus.java`

- [ ] **Step 1: enum 작성**

```java
package com.kdb.it.common.approval.domain;

/**
 * 신청서 결재상태 (Ccodem cId='APF_STS').
 */
public enum ApprovalStatus {
    IN_PROGRESS("001", "결재중"),
    COMPLETED  ("002", "결재완료"),
    REJECTED   ("003", "반려"),
    RECALLED   ("004", "회수");

    private final String code;
    private final String label;

    ApprovalStatus(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String code()  { return code; }
    public String label() { return label; }

    public static ApprovalStatus ofCode(String code) {
        for (ApprovalStatus s : values()) if (s.code.equals(code)) return s;
        throw new IllegalArgumentException("Unknown APF_STS code: " + code);
    }

    public boolean isTerminated() {
        return this == COMPLETED || this == REJECTED || this == RECALLED;
    }
}
```

- [ ] **Step 2: 컴파일 확인**

```powershell
cd it_backend
./gradlew compileJava
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/domain/ApprovalStatus.java
git commit -m "feat(approval): ApprovalStatus enum 추가"
```

---

### Task 4: Capplm 엔티티 — apfStsC 필드 + 메서드 교체

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Capplm.java`

- [ ] **Step 1: import + 필드 추가**

import 추가:
```java
import com.kdb.it.common.approval.domain.ApprovalStatus;
```

`apfSts` 필드 정의 바로 아래에 추가:
```java
/** 신청서상태코드: Ccodem APF_STS 참조 (001:결재중, 002:결재완료, 003:반려, 004:회수) */
@Column(name = "APF_STS_C", length = 3, nullable = false, comment = "신청서상태코드")
private String apfStsC;
```

- [ ] **Step 2: updateStatus 메서드 교체**

기존:
```java
public void updateStatus(String status) {
    this.apfSts = status;
}
```
교체 (legacy 컬럼은 Wave 9에서 DROP 예정, 그 전까지 동기화):
```java
public void updateStatus(ApprovalStatus status) {
    this.apfStsC = status.code();
    this.apfSts  = status.label();
}
```

- [ ] **Step 3: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/entity/Capplm.java
git commit -m "feat(approval): Capplm.apfStsC 필드 + updateStatus(ApprovalStatus)"
```

(컴파일은 Task 10에서 호출처 정리될 때 통과)

---

## Wave 3 — Cdecim 코드화

### Task 5: Flyway V003 — DCD_STS_C 컬럼 추가 + 백필

**Files:**
- Create: `it_database/migrations/V20260525_003__AddCdecimDcdStsC.sql`

- [ ] **Step 1: SQL 작성**

```sql
ALTER TABLE TPRMPP_CDECIM ADD DCD_STS_C VARCHAR2(3);
COMMENT ON COLUMN TPRMPP_CDECIM.DCD_STS_C IS '결재선상태코드 (Ccodem DCD_STS)';

UPDATE TPRMPP_CDECIM
SET DCD_STS_C = CASE
    WHEN DCD_TP IS NULL    THEN '001'
    WHEN DCD_STS = '승인'  THEN '002'
    WHEN DCD_STS = '반려'  THEN '003'
    ELSE '001'
END;

COMMIT;

ALTER TABLE TPRMPP_CDECIM MODIFY DCD_STS_C VARCHAR2(3) NOT NULL;
```

- [ ] **Step 2: 적용 및 검증**

```powershell
cd it_backend
./gradlew flywayMigrate
```
SQL: `SELECT DCD_TP, DCD_STS, DCD_STS_C, COUNT(*) FROM TPRMPP_CDECIM GROUP BY DCD_TP, DCD_STS, DCD_STS_C;`

- [ ] **Step 3: Commit**

```powershell
git add it_database/migrations/V20260525_003__AddCdecimDcdStsC.sql
git commit -m "feat(db): TPRMPP_CDECIM에 DCD_STS_C 컬럼 추가 및 백필"
```

---

### Task 6: DecisionStatus enum 생성

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/domain/DecisionStatus.java`

- [ ] **Step 1: enum 작성**

```java
package com.kdb.it.common.approval.domain;

/**
 * 결재선 결재상태 (Ccodem cId='DCD_STS').
 */
public enum DecisionStatus {
    PENDING    ("001", "미결재"),
    APPROVED   ("002", "승인"),
    REJECTED   ("003", "반려"),
    INVALIDATED("004", "회수무효");

    private final String code;
    private final String label;

    DecisionStatus(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String code()  { return code; }
    public String label() { return label; }

    public static DecisionStatus ofCode(String code) {
        for (DecisionStatus s : values()) if (s.code.equals(code)) return s;
        throw new IllegalArgumentException("Unknown DCD_STS code: " + code);
    }
}
```

- [ ] **Step 2: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/domain/DecisionStatus.java
git commit -m "feat(approval): DecisionStatus enum 추가"
```

---

### Task 7: Cdecim 엔티티 — dcdStsC 필드 + approve 시그니처 추가

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cdecim.java`

- [ ] **Step 1: import + 필드 추가**

```java
import com.kdb.it.common.approval.domain.DecisionStatus;
```

`dcdSts` 필드 정의 아래에 추가:
```java
/** 결재선상태코드: Ccodem DCD_STS 참조 (001:미결재, 002:승인, 003:반려, 004:회수무효) */
@Column(name = "DCD_STS_C", length = 3, nullable = false, comment = "결재선상태코드")
private String dcdStsC;
```

- [ ] **Step 2: 신규 메서드 추가 (legacy approve(String,String)는 유지)**

```java
/**
 * 결재 처리 (코드 기반 API).
 * 회수 정책 도입 후 신규 코드는 이 시그니처를 사용한다.
 */
public void approve(String opinion, DecisionStatus status) {
    this.dcdTp   = "결재";
    this.dcdSts  = status.label();
    this.dcdStsC = status.code();
    this.dcdDt   = java.time.LocalDate.now();
    this.dcdOpnn = opinion;
}

/** 회수로 인한 미결재 항목 무효화 */
public void invalidateByRecall() {
    this.dcdStsC = DecisionStatus.INVALIDATED.code();
    this.dcdSts  = DecisionStatus.INVALIDATED.label();
}
```

- [ ] **Step 3: 컴파일 확인**

```powershell
./gradlew compileJava
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/entity/Cdecim.java
git commit -m "feat(approval): Cdecim.dcdStsC + DecisionStatus 기반 approve/invalidateByRecall"
```

---

## Wave 4 — Cappla 채번 변경 (엔티티)

### Task 8: ApplicationMapRepository — findMaxRelSnoByApfMngNo 추가

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/repository/ApplicationMapRepository.java`

- [ ] **Step 1: 메서드 추가**

import 추가 (없을 경우):
```java
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
```

인터페이스 내부에 추가:
```java
@Query(value = "SELECT COALESCE(MAX(APF_REL_SNO), 0) FROM TPRMPP_CAPPLA WHERE APF_MNG_NO = :apfMngNo",
       nativeQuery = true)
Long findMaxRelSnoByApfMngNo(@Param("apfMngNo") String apfMngNo);
```

- [ ] **Step 2: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/repository/ApplicationMapRepository.java
git commit -m "feat(approval): ApplicationMapRepository.findMaxRelSnoByApfMngNo"
```

---

### Task 9: Cappla 엔티티 — @GeneratedValue 제거 (PK 변경은 V004 적용 후 Task 20에서)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java`

- [ ] **Step 1: 어노테이션 축소 + import 정리**

기존:
```java
@Id
@GeneratedValue(strategy = SEQUENCE, generator = "cappla_seq")
@SequenceGenerator(name = "cappla_seq", sequenceName = "SEQ_CAPPLA", allocationSize = 1)
@Column(name = "APF_REL_SNO", nullable = false, comment = "신청서관계일련번호")
private Long apfRelSno;
```
교체:
```java
@Id
@Column(name = "APF_REL_SNO", nullable = false, comment = "신청서관계일련번호 (신청서 단위 1~N)")
private Long apfRelSno;
```

미사용 import 제거: `static jakarta.persistence.GenerationType.SEQUENCE`, `GeneratedValue`, `SequenceGenerator`.

- [ ] **Step 2: 컴파일 확인**

```powershell
./gradlew compileJava
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java
git commit -m "refactor(approval): Cappla.apfRelSno 자동채번 제거 (서비스에서 명시 채번)"
```

---

## Wave 5 — ApplicationService 코드화

### Task 10: ApplicationService.submit() — 코드값 + Cappla 채번 변경

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`

- [ ] **Step 1: import 추가**

```java
import com.kdb.it.common.approval.domain.ApprovalStatus;
import com.kdb.it.common.approval.domain.DecisionStatus;
```

- [ ] **Step 2: Capplm builder에서 상태 설정 교체**

기존 라인:
```java
.apfSts("결재중") // 초기 결재상태
```
교체:
```java
.apfSts(ApprovalStatus.IN_PROGRESS.label())   // legacy 동기화 (V005에서 DROP 예정)
.apfStsC(ApprovalStatus.IN_PROGRESS.code())
```

- [ ] **Step 3: Cappla orcItems 루프 — 1~N 채번**

기존 루프(라인 148~158):
```java
if (request.getOrcItems() != null && !request.getOrcItems().isEmpty()) {
    for (ApplicationDto.OrcItem item : request.getOrcItems()) {
        Cappla cappla = Cappla.builder()
                .apfMngNo(apfMngNo)
                .orcTbCd(item.getOrcTbCd())
                .orcPkVl(item.getOrcPkVl())
                .orcSnoVl(item.getOrcSnoVl() != null ? Integer.parseInt(item.getOrcSnoVl()) : null)
                .build();
        applicationMapRepository.save(cappla);
    }
}
```
교체:
```java
if (request.getOrcItems() != null && !request.getOrcItems().isEmpty()) {
    long sno = 1L;
    for (ApplicationDto.OrcItem item : request.getOrcItems()) {
        Cappla cappla = Cappla.builder()
                .apfRelSno(sno++)
                .apfMngNo(apfMngNo)
                .orcTbCd(item.getOrcTbCd())
                .orcPkVl(item.getOrcPkVl())
                .orcSnoVl(item.getOrcSnoVl() != null ? Integer.parseInt(item.getOrcSnoVl()) : null)
                .build();
        applicationMapRepository.save(cappla);
    }
}
```

- [ ] **Step 4: 기안자 자동 승인 분기 — enum 시그니처 사용**

기존:
```java
firstApprover.approve("기안자 자동 승인", "승인");
```
교체:
```java
firstApprover.approve("기안자 자동 승인", DecisionStatus.APPROVED);
```

- [ ] **Step 5: 신규 단위 테스트 추가**

`it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java` 에 추가:

```java
@Test
@DisplayName("submit: APF_STS_C='001'로 저장된다")
void submit_setsApfStsCToInProgressCode() {
    ApplicationDto.CreateRequest req = buildMinimalCreateRequest();
    when(applicationRepository.getNextVal()).thenReturn(1L);

    applicationService.submit(req);

    ArgumentCaptor<Capplm> captor = ArgumentCaptor.forClass(Capplm.class);
    verify(applicationRepository).save(captor.capture());
    assertThat(captor.getValue().getApfStsC()).isEqualTo("001");
}

@Test
@DisplayName("submit: orcItems N건이면 APF_REL_SNO 1~N으로 부여")
void submit_assignsApfRelSnoSequentiallyFromOne() {
    ApplicationDto.CreateRequest req = buildCreateRequestWithOrcItems(3);
    when(applicationRepository.getNextVal()).thenReturn(1L);

    applicationService.submit(req);

    ArgumentCaptor<Cappla> captor = ArgumentCaptor.forClass(Cappla.class);
    verify(applicationMapRepository, times(3)).save(captor.capture());
    assertThat(captor.getAllValues())
        .extracting(Cappla::getApfRelSno)
        .containsExactly(1L, 2L, 3L);
}
```

기존 테스트의 fixture(`buildMinimalCreateRequest`, `buildCreateRequestWithOrcItems`) 패턴 확장. 없으면 다음을 추가:

```java
private ApplicationDto.CreateRequest buildMinimalCreateRequest() {
    ApplicationDto.CreateRequest r = new ApplicationDto.CreateRequest();
    r.setApfNm("테스트 신청서");
    r.setApfDtlCone("{}");
    r.setRqsEno("E001");
    r.setApproverEnos(java.util.List.of("E002"));
    return r;
}

private ApplicationDto.CreateRequest buildCreateRequestWithOrcItems(int n) {
    ApplicationDto.CreateRequest r = buildMinimalCreateRequest();
    java.util.List<ApplicationDto.OrcItem> items = new java.util.ArrayList<>();
    for (int i = 1; i <= n; i++) {
        ApplicationDto.OrcItem item = new ApplicationDto.OrcItem();
        item.setOrcTbCd("BPROJM");
        item.setOrcPkVl("PRJ-2026-000" + i);
        items.add(item);
    }
    r.setOrcItems(items);
    return r;
}
```

- [ ] **Step 6: 테스트 실행**

```powershell
cd it_backend
./gradlew test --tests "ApplicationServiceTest"
```
Expected: 신규 2건 + 기존 PASS.

- [ ] **Step 7: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java
git commit -m "feat(approval): submit 코드값(APF_STS_C) + Cappla 1~N 채번"
```

---

### Task 11: ApplicationService.approve() — 코드값 기반 판정/전이

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`

- [ ] **Step 1: 현재 차례 탐색 로직 교체 (라인 278~292 부근)**

기존:
```java
for (Cdecim approver : approvers) {
    String dcdTp = approver.getDcdTp();
    String dcdSts = approver.getDcdSts();
    if (dcdTp == null) {
        if (isPreviousApproved) currentApprover = approver;
        break;
    } else if ("결재".equals(dcdTp) && !"승인".equals(dcdSts)) {
        isPreviousApproved = false;
        break;
    }
}
```
교체:
```java
for (Cdecim approver : approvers) {
    String stsC = approver.getDcdStsC();
    if (DecisionStatus.PENDING.code().equals(stsC)) {
        if (isPreviousApproved) currentApprover = approver;
        break;
    } else if (!DecisionStatus.APPROVED.code().equals(stsC)) {
        isPreviousApproved = false;
        break;
    }
}
```

- [ ] **Step 2: 승인/반려 매핑 + 호출 교체**

`status` 값 검증 부분(`if (status == null || status.isEmpty())`) 직후에 추가:
```java
DecisionStatus decision;
if ("승인".equals(status) || DecisionStatus.APPROVED.code().equals(status)) {
    decision = DecisionStatus.APPROVED;
} else if ("반려".equals(status) || DecisionStatus.REJECTED.code().equals(status)) {
    decision = DecisionStatus.REJECTED;
} else {
    throw new IllegalArgumentException("결재 상태(승인/반려)는 필수입니다.");
}
```

기존 호출:
```java
currentApprover.approve(request.getDcdOpnn(), status);
```
교체:
```java
currentApprover.approve(request.getDcdOpnn(), decision);
```

연속 결재자 루프 내 호출도 동일 교체:
```java
nextApprover.approve(request.getDcdOpnn(), decision);
```

- [ ] **Step 3: 신청서 상태 전이 — enum 기반**

기존:
```java
String newApfSts = null;
if ("반려".equals(status)) {
    capplm.updateStatus("반려");
    newApfSts = "반려";
} else if ("승인".equals(status)) {
    if ("Y".equals(lastApproved.getLstDcdYn())) {
        capplm.updateStatus("결재완료");
        newApfSts = "결재완료";
    }
}
```
교체:
```java
String newApfSts = null;
if (decision == DecisionStatus.REJECTED) {
    capplm.updateStatus(ApprovalStatus.REJECTED);
    newApfSts = ApprovalStatus.REJECTED.label();
} else if (decision == DecisionStatus.APPROVED && "Y".equals(lastApproved.getLstDcdYn())) {
    capplm.updateStatus(ApprovalStatus.COMPLETED);
    newApfSts = ApprovalStatus.COMPLETED.label();
}
```

- [ ] **Step 4: 기존 ApplicationServiceTest 회귀**

```powershell
./gradlew test --tests "ApplicationServiceTest"
```
Expected: PASS. Mock에서 Cdecim에 `dcdStsC` 미설정으로 깨지면, fixture 헬퍼에 `dcdStsC("001")` 기본값 추가.

- [ ] **Step 5: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java
git commit -m "feat(approval): approve를 DCD_STS_C/ApprovalStatus 기반으로 전이"
```

---

## Wave 6 — 회수 기능

### Task 12: ApplicationDto.RecallRequest 추가

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java`

- [ ] **Step 1: import 확인**

```java
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.media.Schema;
```

- [ ] **Step 2: RecallRequest 정적 중첩 클래스 추가**

```java
@Getter @Setter
@Schema(name = "RecallRequest", description = "신청서 회수 요청")
public static class RecallRequest {
    @NotBlank
    @Size(max = 1000)
    @Schema(description = "회수 사유 (필수)", example = "결재선 오기재로 인한 회수")
    private String recallOpnn;
}
```

- [ ] **Step 3: Response DTO에 apfStsC 필드 추가**

`Response` 정적 클래스에 `private String apfStsC;` 추가, `fromEntity()` 빌더에 `.apfStsC(capplm.getApfStsC())` 라인 추가.

- [ ] **Step 4: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java
git commit -m "feat(approval): RecallRequest DTO + Response.apfStsC 노출"
```

---

### Task 13: ApprovalRecalledEvent 생성

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/event/ApprovalRecalledEvent.java`

- [ ] **Step 1: record 작성**

```java
package com.kdb.it.common.approval.event;

import java.util.List;

/**
 * 신청서 회수 이벤트.
 *
 * @param apfMngNo                   회수된 신청서 관리번호
 * @param recallerEno                회수자 사번
 * @param approvedMiddleApproverEnos 회수 시점 기준 이미 승인한 중간결재자 사번 목록 (알림 대상)
 */
public record ApprovalRecalledEvent(
    String apfMngNo,
    String recallerEno,
    List<String> approvedMiddleApproverEnos
) {}
```

- [ ] **Step 2: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/event/ApprovalRecalledEvent.java
git commit -m "feat(approval): ApprovalRecalledEvent record 추가"
```

---

### Task 14: ApplicationService.recall() 신규 메서드

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`

- [ ] **Step 1: import 추가**

```java
import com.kdb.it.common.approval.event.ApprovalRecalledEvent;
import org.springframework.security.access.AccessDeniedException;
```

- [ ] **Step 2: recall() 메서드 추가**

클래스 끝부분에 추가:

```java
/**
 * 신청서 회수.
 *
 * @param apfMngNo   회수할 신청서 관리번호
 * @param request    회수 요청 (사유)
 * @param currentEno 회수 요청자 사번
 * @param isAdmin    관리자(ROLE_ADMIN) 여부
 * @throws IllegalArgumentException 신청서 없음
 * @throws IllegalStateException    회수 가능 상태 아님 / 최종승인 후
 * @throws AccessDeniedException    회수 권한 없음
 */
@Transactional
public void recall(String apfMngNo, ApplicationDto.RecallRequest request,
                   String currentEno, boolean isAdmin) {
    Capplm capplm = applicationRepository.findById(apfMngNo)
        .orElseThrow(() -> new IllegalArgumentException("신청서를 찾을 수 없습니다: " + apfMngNo));

    if (!ApprovalStatus.IN_PROGRESS.code().equals(capplm.getApfStsC())) {
        throw new IllegalStateException("회수 가능한 상태가 아닙니다. 현재 상태: " + capplm.getApfStsC());
    }

    List<Cdecim> approvers = approverRepository.findByDcdMngNoOrderByDcdSqnAsc(apfMngNo);
    boolean lastApproved = approvers.stream()
        .anyMatch(a -> "Y".equals(a.getLstDcdYn())
                    && DecisionStatus.APPROVED.code().equals(a.getDcdStsC()));
    if (lastApproved) {
        throw new IllegalStateException("최종 결재자 승인 후에는 회수할 수 없습니다.");
    }

    if (!canRecall(capplm, approvers, currentEno, isAdmin)) {
        throw new AccessDeniedException("회수 권한이 없습니다.");
    }

    capplm.updateStatus(ApprovalStatus.RECALLED);
    approvalLineDelegate.applyRecallInfo(capplm, currentEno, request.getRecallOpnn());

    for (Cdecim a : approvers) {
        if (DecisionStatus.PENDING.code().equals(a.getDcdStsC())) {
            a.invalidateByRecall();
            approverRepository.save(a);
        }
    }

    List<String> approvedMiddle = approvers.stream()
        .filter(a -> "N".equals(a.getLstDcdYn())
                  && DecisionStatus.APPROVED.code().equals(a.getDcdStsC()))
        .map(Cdecim::getDcdEno)
        .distinct()
        .toList();

    eventPublisher.publishEvent(new ApprovalRecalledEvent(apfMngNo, currentEno, approvedMiddle));
}

/** 회수 권한 검증 헬퍼 */
private boolean canRecall(Capplm capplm, List<Cdecim> approvers, String currentEno, boolean isAdmin) {
    if (!ApprovalStatus.IN_PROGRESS.code().equals(capplm.getApfStsC())) return false;
    if (isAdmin) return true;
    if (currentEno.equals(capplm.getRqsEno())) return true;
    return approvers.stream()
        .filter(a -> !"Y".equals(a.getLstDcdYn()))
        .anyMatch(a -> currentEno.equals(a.getDcdEno()));
}
```

- [ ] **Step 3: ApprovalLineDelegate.applyRecallInfo() 메서드 추가**

`ApprovalLineDelegate.java` 에 추가:

```java
@Transactional
public void applyRecallInfo(Capplm capplm, String recallerEno, String recallOpnn) {
    String json = capplm.getApfDtlCone();
    com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
    try {
        com.fasterxml.jackson.databind.node.ObjectNode root = (json == null || json.isBlank())
            ? om.createObjectNode()
            : (com.fasterxml.jackson.databind.node.ObjectNode) om.readTree(json);
        com.fasterxml.jackson.databind.node.ObjectNode recallNode = om.createObjectNode();
        recallNode.put("recallerEno", recallerEno);
        recallNode.put("recallDtm", java.time.LocalDateTime.now().toString());
        recallNode.put("recallOpnn", recallOpnn);
        root.set("recallInfo", recallNode);
        capplm.updateDetailContent(om.writeValueAsString(root));
    } catch (Exception e) {
        throw new IllegalStateException("회수 정보 JSON 갱신 실패", e);
    }
}
```

- [ ] **Step 4: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java it_backend/src/main/java/com/kdb/it/common/approval/service/ApprovalLineDelegate.java
git commit -m "feat(approval): ApplicationService.recall() + ApprovalLineDelegate.applyRecallInfo"
```

---

### Task 15: ApplicationServiceRecallTest — 회수 단위 테스트

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceRecallTest.java`

- [ ] **Step 1: 테스트 클래스 작성**

```java
package com.kdb.it.common.approval.service;

import com.kdb.it.common.approval.dto.ApplicationDto;
import com.kdb.it.common.approval.entity.Capplm;
import com.kdb.it.common.approval.entity.Cdecim;
import com.kdb.it.common.approval.event.ApprovalRecalledEvent;
import com.kdb.it.common.approval.repository.*;
import org.junit.jupiter.api.*;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ApplicationServiceRecallTest {

    @Mock ApplicationRepository applicationRepository;
    @Mock ApproverRepository approverRepository;
    @Mock ApplicationMapRepository applicationMapRepository;
    @Mock com.kdb.it.domain.budget.project.repository.ProjectRepository projectRepository;
    @Mock com.kdb.it.domain.budget.cost.repository.CostRepository costRepository;
    @Mock ApplicationEventPublisher eventPublisher;
    @Mock ApprovalLineDelegate approvalLineDelegate;

    @InjectMocks ApplicationService service;

    private static final String APF = "APF-2026-00000001";

    private Capplm capplm(String stsC) {
        return Capplm.builder().apfMngNo(APF).apfStsC(stsC).rqsEno("E001").build();
    }
    private Cdecim approver(int sqn, String eno, String stsC, String last) {
        return Cdecim.builder().dcdMngNo(APF).dcdSqn(sqn).dcdEno(eno).dcdStsC(stsC).lstDcdYn(last).build();
    }
    private ApplicationDto.RecallRequest req() {
        ApplicationDto.RecallRequest r = new ApplicationDto.RecallRequest();
        r.setRecallOpnn("사유");
        return r;
    }

    @Test
    @DisplayName("신청자 본인이 결재중 신청서를 회수하면 RECALLED로 전환되고 이벤트 발행")
    void recall_byRequester_setsStatusToRecalled() {
        when(applicationRepository.findById(APF)).thenReturn(Optional.of(capplm("001")));
        when(approverRepository.findByDcdMngNoOrderByDcdSqnAsc(APF))
            .thenReturn(List.of(approver(1, "E001", "002", "N"), approver(2, "E002", "001", "Y")));

        service.recall(APF, req(), "E001", false);

        verify(approvalLineDelegate).applyRecallInfo(any(), eq("E001"), eq("사유"));
        verify(eventPublisher).publishEvent(any(ApprovalRecalledEvent.class));
    }

    @Test
    @DisplayName("최종결재자가 이미 승인했으면 IllegalStateException")
    void recall_whenLastApproverApproved_throws() {
        when(applicationRepository.findById(APF)).thenReturn(Optional.of(capplm("001")));
        when(approverRepository.findByDcdMngNoOrderByDcdSqnAsc(APF))
            .thenReturn(List.of(approver(1, "E002", "002", "Y")));

        assertThatThrownBy(() -> service.recall(APF, req(), "E001", false))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("최종 결재자");
    }

    @Test
    @DisplayName("종결 상태(반려) 신청서 회수 시 IllegalStateException")
    void recall_terminatedApplication_throws() {
        when(applicationRepository.findById(APF)).thenReturn(Optional.of(capplm("003")));

        assertThatThrownBy(() -> service.recall(APF, req(), "E001", false))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("무관계 사용자 회수 시 AccessDeniedException")
    void recall_byUnrelatedUser_throwsAccessDenied() {
        when(applicationRepository.findById(APF)).thenReturn(Optional.of(capplm("001")));
        when(approverRepository.findByDcdMngNoOrderByDcdSqnAsc(APF))
            .thenReturn(List.of(approver(1, "E002", "001", "Y")));

        assertThatThrownBy(() -> service.recall(APF, req(), "E999", false))
            .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("관리자는 무관계자라도 회수 가능")
    void recall_byAdmin_succeeds() {
        when(applicationRepository.findById(APF)).thenReturn(Optional.of(capplm("001")));
        when(approverRepository.findByDcdMngNoOrderByDcdSqnAsc(APF))
            .thenReturn(List.of(approver(1, "E002", "001", "Y")));

        service.recall(APF, req(), "E999", true);
        verify(eventPublisher).publishEvent(any(ApprovalRecalledEvent.class));
    }

    @Test
    @DisplayName("중간결재자 회수 — 기승인 이력 보존, 미결재만 회수무효")
    void recall_byMiddleApprover_preservesApprovedHistory() {
        when(applicationRepository.findById(APF)).thenReturn(Optional.of(capplm("001")));
        Cdecim a1 = approver(1, "E001", "002", "N");
        Cdecim a2 = approver(2, "E002", "001", "N");
        Cdecim a3 = approver(3, "E003", "001", "Y");
        when(approverRepository.findByDcdMngNoOrderByDcdSqnAsc(APF))
            .thenReturn(List.of(a1, a2, a3));

        service.recall(APF, req(), "E002", false);

        assertThat(a1.getDcdStsC()).isEqualTo("002");
        assertThat(a2.getDcdStsC()).isEqualTo("004");
        assertThat(a3.getDcdStsC()).isEqualTo("004");
    }
}
```

- [ ] **Step 2: 테스트 실행**

```powershell
cd it_backend
./gradlew test --tests "ApplicationServiceRecallTest"
```
Expected: 6/6 PASS.

- [ ] **Step 3: Commit**

```powershell
git add it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceRecallTest.java
git commit -m "test(approval): ApplicationServiceRecallTest — 회수 6개 시나리오"
```

---

### Task 16: ApplicationController — POST /recall 엔드포인트

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java`

- [ ] **Step 1: import 추가**

```java
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
```

- [ ] **Step 2: 메서드 추가 (bulkApprove 아래)**

```java
@PostMapping("/{apfMngNo}/recall")
@Operation(summary = "신청서 회수",
           description = "결재중 신청서를 회수합니다. 신청자/중간결재자/관리자만 가능, 최종 결재자 승인 전까지.")
public ResponseEntity<Void> recall(@PathVariable("apfMngNo") String apfMngNo,
                                   @Valid @RequestBody ApplicationDto.RecallRequest request) {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    String currentEno = auth.getName();
    boolean isAdmin = auth.getAuthorities().stream()
        .anyMatch(g -> "ROLE_ADMIN".equals(g.getAuthority()));
    applicationService.recall(apfMngNo, request, currentEno, isAdmin);
    return ResponseEntity.noContent().build();
}
```

- [ ] **Step 3: 전체 테스트**

```powershell
cd it_backend
./gradlew clean test
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java
git commit -m "feat(approval): POST /api/applications/{apfMngNo}/recall 엔드포인트"
```

---

## Wave 7 — 재상신 (미상신 쿼리 확장)

### Task 17: ProjectRepositoryImpl/CostRepositoryImpl — 'none' 분기 확장

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepositoryImpl.java`

- [ ] **Step 1: 분기 위치 확인**

```
Grep pattern: "apfSts.*none|\"none\"" path: "it_backend/src/main/java/com/kdb/it/domain/budget"
```
파일별 라인 식별.

- [ ] **Step 2: ProjectRepositoryImpl 확장**

기존(개념적, BooleanBuilder 안의 notExists):
```java
if ("none".equals(condition.getApfSts())) {
    builder.and(JPAExpressions.selectOne()
        .from(cappla)
        .where(cappla.orcTbCd.eq("BPROJM").and(cappla.orcPkVl.eq(bprojm.prjMngNo)))
        .notExists());
}
```
교체:
```java
if ("none".equals(condition.getApfSts())) {
    // 미상신: CAPPLA 연결 없음 OR 최신 CAPPLM이 반려/회수
    BooleanExpression notLinked = JPAExpressions.selectOne()
        .from(cappla)
        .where(cappla.orcTbCd.eq("BPROJM").and(cappla.orcPkVl.eq(bprojm.prjMngNo)))
        .notExists();

    // 최신 CAPPLM의 APF_STS_C 가 003/004
    BooleanExpression latestTerminatedNonComplete = Expressions.numberTemplate(Integer.class,
        "(SELECT CASE WHEN c.APF_STS_C IN ('003','004') THEN 1 ELSE 0 END " +
        "  FROM TPRMPP_CAPPLM c JOIN TPRMPP_CAPPLA m ON c.APF_MNG_NO = m.APF_MNG_NO " +
        "  WHERE m.ORC_TB_CD = 'BPROJM' AND m.ORC_PK_VL = {0} " +
        "  ORDER BY c.RQS_DT DESC FETCH FIRST 1 ROWS ONLY)",
        bprojm.prjMngNo).eq(1);

    builder.and(notLinked.or(latestTerminatedNonComplete));
}
```

import 추가 (없을 경우):
```java
import com.querydsl.core.types.dsl.BooleanExpression;
import com.querydsl.core.types.dsl.Expressions;
```

- [ ] **Step 3: CostRepositoryImpl 동일 패턴 적용**

`BPROJM` → `BCOSTM`, `bprojm.prjMngNo` → cost PK 컬럼명으로 교체. 정확한 PK명은 `Bcostm` 엔티티에서 확인.

- [ ] **Step 4: 회귀 테스트 + 신규 케이스 추가**

기존 `ProjectServiceXcrLookupTest`/`CostServiceXcrLookupTest`에 케이스 추가:
- 반려된 최신 신청서가 있는 BPROJM → apfSts='none' 검색 시 포함
- 회수된 최신 신청서가 있는 BPROJM → 포함
- 결재중 신청서가 있는 BPROJM → 제외

```powershell
./gradlew test --tests "ProjectService*Test" --tests "CostService*Test"
```

- [ ] **Step 5: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepositoryImpl.java it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepositoryImpl.java
git commit -m "feat(budget): 미상신 목록에 반려/회수된 신청서 원본 포함"
```

---

## Wave 8 — Repository / 알림

### Task 18: ApplicationRepository native query — 코드값 교체

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/repository/ApplicationRepository.java`

- [ ] **Step 1: WHERE 절 교체**

- `a.APF_STS = '결재중'`   → `a.APF_STS_C = '001'`
- `a.APF_STS = '결재완료'` → `a.APF_STS_C = '002'`
- `a.APF_STS = '반려'`     → `a.APF_STS_C = '003'`
- `d.DCD_DT IS NULL`       → `d.DCD_STS_C = '001'`

대상 메서드: `countPendingByEno`, `countInProgressByEno`, `countMonthlyCompletedByBbrC`, `countRejectedByEno`, `findMonthlyTrendByBbrC` (필요시), `findPendingListByEno`.

- [ ] **Step 2: 회귀 테스트**

```powershell
./gradlew test --tests "ApplicationServiceTest" --tests "ApplicationServiceRecallTest"
```

- [ ] **Step 3: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/approval/repository/ApplicationRepository.java
git commit -m "refactor(approval): ApplicationRepository native query를 코드값 기반으로 변경"
```

---

### Task 19: NotificationEventListener — onApprovalRecalled 추가

**Files:**
- Modify: 위치는 grep으로 식별:

```
Grep pattern: "ApprovalCompletedEvent" path: "it_backend/src/main/java/com/kdb/it/common/notification"
```

대상 파일(예상: `notification/listener/NotificationEventListener.java`)에 메서드 추가.

- [ ] **Step 1: NotificationEvent에 상수 추가**

`NotificationEvent.java` (또는 정의 파일):
```java
public static final String TYPE_APPROVAL_RECALLED = "006";
```

- [ ] **Step 2: 리스너 메서드 추가**

```java
import com.kdb.it.common.approval.event.ApprovalRecalledEvent;

@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
public void onApprovalRecalled(ApprovalRecalledEvent event) {
    Capplm capplm = applicationRepository.findById(event.apfMngNo()).orElse(null);
    if (capplm == null) return;

    // 신청자 (회수자가 신청자 본인이 아닌 경우만)
    if (!event.recallerEno().equals(capplm.getRqsEno())) {
        eventPublisher.publishEvent(NotificationEvent.builder()
            .recipientEno(capplm.getRqsEno())
            .infTpC(NotificationEvent.TYPE_APPROVAL_RECALLED)
            .infTtl("결재회수: " + safeText(capplm.getApfNm()))
            .infCone(safeText(capplm.getApfNm()))
            .infLnkUrl("/approval/" + event.apfMngNo())
            .build());
    }

    // 기승인 중간결재자
    for (String eno : event.approvedMiddleApproverEnos()) {
        eventPublisher.publishEvent(NotificationEvent.builder()
            .recipientEno(eno)
            .infTpC(NotificationEvent.TYPE_APPROVAL_RECALLED)
            .infTtl("결재회수: " + safeText(capplm.getApfNm()))
            .infCone("귀하가 결재한 신청서가 회수되었습니다.")
            .infLnkUrl("/approval/" + event.apfMngNo())
            .build());
    }
}

private static String safeText(String s) { return s == null ? "" : s; }
```

- [ ] **Step 3: Commit**

```powershell
git add it_backend/src/main/java/com/kdb/it/common/notification/
git commit -m "feat(notification): 결재회수 알림 핸들러 추가 (INF_TP_C=006)"
```

---

## Wave 9 — Cappla 채번 마이그레이션 + Legacy 컬럼 DROP

### Task 20: Flyway V004 — Cappla 채번 리넘버링 + 복합키 도입

**Files:**
- Create: `it_database/migrations/V20260525_004__RefactorCapplaRelSno.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/approval/entity/CapplaId.java`

- [ ] **Step 1: PK 제약명 확인**

```sql
SELECT CONSTRAINT_NAME FROM USER_CONSTRAINTS
WHERE TABLE_NAME = 'TPRMPP_CAPPLA' AND CONSTRAINT_TYPE = 'P';
```
실제 이름(예: `SYS_C00XXX` 또는 `PK_TPRMPP_CAPPLA`)을 Step 2 스크립트에 반영.

- [ ] **Step 2: SQL 작성**

```sql
-- 1단계: 임시 컬럼 + 신청서 단위 채번
ALTER TABLE TPRMPP_CAPPLA ADD APF_REL_SNO_NEW NUMBER;

MERGE INTO TPRMPP_CAPPLA tgt
USING (
    SELECT APF_REL_SNO,
           ROW_NUMBER() OVER (PARTITION BY APF_MNG_NO ORDER BY APF_REL_SNO) AS NEW_SNO
    FROM TPRMPP_CAPPLA
) src
ON (tgt.APF_REL_SNO = src.APF_REL_SNO)
WHEN MATCHED THEN UPDATE SET tgt.APF_REL_SNO_NEW = src.NEW_SNO;

COMMIT;

-- 2단계: PK 제약 해제 + 컬럼 교체
ALTER TABLE TPRMPP_CAPPLA DROP CONSTRAINT <실제_PK_제약명>;

UPDATE TPRMPP_CAPPLA SET APF_REL_SNO = APF_REL_SNO_NEW;
COMMIT;

ALTER TABLE TPRMPP_CAPPLA DROP COLUMN APF_REL_SNO_NEW;

-- 3단계: 복합 PK 재생성
ALTER TABLE TPRMPP_CAPPLA ADD CONSTRAINT PK_TPRMPP_CAPPLA PRIMARY KEY (APF_MNG_NO, APF_REL_SNO);

-- 4단계: 시퀀스 DROP
DROP SEQUENCE SEQ_CAPPLA;
```

- [ ] **Step 3: dev DB 적용 + 검증**

```powershell
cd it_backend
./gradlew flywayMigrate
```
검증 SQL:
```sql
SELECT APF_MNG_NO, MIN(APF_REL_SNO), MAX(APF_REL_SNO), COUNT(*)
FROM TPRMPP_CAPPLA
GROUP BY APF_MNG_NO
HAVING MAX(APF_REL_SNO) <> COUNT(*);
```
Expected: 0건 (모든 신청서가 1~N 연속).

- [ ] **Step 4: Cappla 엔티티 복합키 도입**

`CapplaId.java` 신규:
```java
package com.kdb.it.common.approval.entity;

import java.io.Serializable;
import java.util.Objects;

public class CapplaId implements Serializable {
    private String apfMngNo;
    private Long apfRelSno;

    public CapplaId() {}
    public CapplaId(String apfMngNo, Long apfRelSno) {
        this.apfMngNo = apfMngNo;
        this.apfRelSno = apfRelSno;
    }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CapplaId that)) return false;
        return Objects.equals(apfMngNo, that.apfMngNo) && Objects.equals(apfRelSno, that.apfRelSno);
    }
    @Override public int hashCode() { return Objects.hash(apfMngNo, apfRelSno); }
}
```

`Cappla.java` 수정 — 클래스 어노테이션에 `@IdClass(CapplaId.class)` 추가, `apfMngNo` 필드에도 `@Id` 추가:

```java
@Entity
@IdClass(CapplaId.class)
@Table(name = "TPRMPP_CAPPLA", comment = "신청서-원본 데이터 관계")
@Getter @SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Cappla extends BaseEntity {

    @Id
    @Column(name = "APF_MNG_NO", length = 32, nullable = false, comment = "신청서관리번호")
    private String apfMngNo;

    @Id
    @Column(name = "APF_REL_SNO", nullable = false, comment = "신청서관계일련번호 (신청서 단위 1~N)")
    private Long apfRelSno;

    // ... 기존 orcTbCd / orcPkVl / orcSnoVl 필드 유지
}
```

- [ ] **Step 5: 컴파일 + 테스트**

```powershell
./gradlew clean test
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```powershell
git add it_database/migrations/V20260525_004__RefactorCapplaRelSno.sql it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java it_backend/src/main/java/com/kdb/it/common/approval/entity/CapplaId.java
git commit -m "feat(approval): Cappla 채번 리넘버링 + 복합키 (APF_MNG_NO, APF_REL_SNO)"
```

---

### Task 21: Flyway V005 — Legacy 컬럼 DROP

**Files:**
- Create: `it_database/migrations/V20260525_005__DropLegacyApprovalColumns.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Capplm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cdecim.java`

- [ ] **Step 1: legacy 사용처 잔존 여부 grep**

```
Grep pattern: "DCD_TP|getDcdTp|setDcdTp|\\.dcdTp|getApfSts\\(\\)|\\.apfSts" path: "it_backend/src/main/java"
```
회수 알림이나 다른 도메인에서 여전히 참조 중인 곳이 있다면 먼저 정리.

- [ ] **Step 2: SQL 작성**

```sql
ALTER TABLE TPRMPP_CAPPLM DROP COLUMN APF_STS;
ALTER TABLE TPRMPP_CDECIM DROP COLUMN DCD_TP;
ALTER TABLE TPRMPP_CDECIM DROP COLUMN DCD_STS;
```

- [ ] **Step 3: Capplm 엔티티 정리**

`apfSts` 필드 제거. `updateStatus()`에서 `this.apfSts = status.label();` 라인 제거:
```java
public void updateStatus(ApprovalStatus status) {
    this.apfStsC = status.code();
}
```

- [ ] **Step 4: Cdecim 엔티티 정리**

`dcdTp`, `dcdSts` 필드 제거. 기존 `approve(String, String)` 시그니처 삭제. 신규 `approve(String, DecisionStatus)`에서 legacy 동기화 라인 제거:
```java
public void approve(String opinion, DecisionStatus status) {
    this.dcdStsC = status.code();
    this.dcdDt   = java.time.LocalDate.now();
    this.dcdOpnn = opinion;
}

public void invalidateByRecall() {
    this.dcdStsC = DecisionStatus.INVALIDATED.code();
}
```

- [ ] **Step 5: 전체 빌드 + 테스트**

```powershell
cd it_backend
./gradlew clean test
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 6: Commit**

```powershell
git add it_database/migrations/V20260525_005__DropLegacyApprovalColumns.sql it_backend/src/main/java/com/kdb/it/common/approval/entity/Capplm.java it_backend/src/main/java/com/kdb/it/common/approval/entity/Cdecim.java
git commit -m "refactor(approval): legacy APF_STS/DCD_TP/DCD_STS 컬럼/필드 제거"
```

---

## Wave 10 — Frontend

### Task 22: useApprovalStatus composable

**Files:**
- Create: `it_frontend/composables/useApprovalStatus.ts`

- [ ] **Step 1: composable 작성**

```typescript
export const APF_STS_LABEL: Record<string, string> = {
  '001': '결재중',
  '002': '결재완료',
  '003': '반려',
  '004': '회수',
}

export const useApprovalStatus = () => {
  const labelOf = (code?: string | null) => (code && APF_STS_LABEL[code]) ?? '-'
  const isInProgress = (code?: string | null) => code === '001'
  const isTerminated = (code?: string | null) =>
    code != null && ['002', '003', '004'].includes(code)
  return { labelOf, isInProgress, isTerminated, APF_STS_LABEL }
}
```

- [ ] **Step 2: 타입체크**

```powershell
cd it_frontend
npm run typecheck
```

- [ ] **Step 3: Commit**

```powershell
git add it_frontend/composables/useApprovalStatus.ts
git commit -m "feat(frontend): useApprovalStatus composable"
```

---

### Task 23: 회수 버튼 + 모달 + API 호출

**Files:**
- Modify: 신청서 상세 페이지 (위치 식별 필요)

- [ ] **Step 1: 신청서 상세 페이지 위치 확인**

```
Grep pattern: "apfMngNo|approval/\\[" path: "it_frontend/pages"
```

- [ ] **Step 2: 회수 버튼/모달 추가**

```vue
<script setup lang="ts">
const { isInProgress } = useApprovalStatus()
const showRecallModal = ref(false)
const recallOpnn = ref('')

const canRecall = computed(() => {
  if (!isInProgress(application.value?.apfStsC)) return false
  const me = currentUser.value?.eno
  const isRequester = me === application.value?.rqsEno
  const isMiddleApprover = application.value?.approvers
    ?.some((a: any) => a.dcdEno === me && a.lstDcdYn !== 'Y')
  const isAdmin = currentUser.value?.roles?.includes('ROLE_ADMIN')
  return isRequester || isMiddleApprover || isAdmin
})

async function submitRecall() {
  if (!recallOpnn.value.trim()) {
    alert('회수 사유를 입력하세요.')
    return
  }
  await $fetch(`/api/applications/${apfMngNo.value}/recall`, {
    method: 'POST',
    credentials: 'include',
    body: { recallOpnn: recallOpnn.value },
  })
  showRecallModal.value = false
  await refreshApplication()
}
</script>

<template>
  <button v-if="canRecall" class="btn-danger" @click="showRecallModal = true">회수</button>

  <Modal v-model="showRecallModal" title="신청서 회수">
    <textarea v-model="recallOpnn" placeholder="회수 사유 (필수)" maxlength="1000" />
    <template #footer>
      <button @click="submitRecall">확인</button>
      <button @click="showRecallModal = false">취소</button>
    </template>
  </Modal>
</template>
```

(Modal 컴포넌트는 프로젝트의 기존 모달 컴포넌트 사용)

- [ ] **Step 3: typecheck + lint**

```powershell
cd it_frontend
npm run typecheck
npm run lint
```

- [ ] **Step 4: Commit**

```powershell
git add it_frontend/pages/
git commit -m "feat(frontend): 신청서 상세 회수 버튼/모달 추가"
```

---

### Task 24: 신청서 목록 — apfStsC 라벨 매핑

**Files:**
- Modify: 신청서 목록 페이지 (`approval/list.vue` 또는 유사)

- [ ] **Step 1: 컬럼 매핑**

```vue
<script setup lang="ts">
const { labelOf } = useApprovalStatus()
</script>

<template>
  <td>{{ labelOf(row.apfStsC) }}</td>
</template>
```

기존 `row.apfSts` 표시를 모두 `labelOf(row.apfStsC)`로 교체.

- [ ] **Step 2: 미상신 안내 문구 (해당 페이지에)**

```vue
<p class="text-sm text-gray-600">
  ※ 반려 또는 회수된 신청서가 있는 항목도 포함됩니다.
</p>
```

- [ ] **Step 3: Commit**

```powershell
git add it_frontend/pages/approval/
git commit -m "feat(frontend): 신청서 목록 apfStsC 라벨 매핑 + 재상신 안내"
```

---

## Wave 11 — PDF 워터마크

### Task 25: 회수 신청서 PDF에 "회수" 워터마크

**Files:**
- 위치는 식별 후 결정.

- [ ] **Step 1: PDF 생성 코드 위치 식별**

```
Grep pattern: "PDF|pdfmake|jsPDF|html2canvas|watermark" path: "it_backend/src/main/java"
Grep pattern: "pdfmake|jspdf|html2canvas|html2pdf" path: "it_frontend"
```

- [ ] **Step 2: 워터마크 분기 추가**

`apfStsC === '004'` 인 경우 PDF 본문 중앙에 반투명 회색 텍스트 "회수" 오버레이.

프론트에서 html2canvas/jsPDF 사용 중인 경우 예시:
```typescript
if (application.apfStsC === '004') {
  doc.setTextColor(200, 50, 50)
  doc.setFontSize(96)
  doc.setGState(new doc.GState({ opacity: 0.25 }))
  doc.text('회수', pageWidth / 2, pageHeight / 2, { align: 'center', angle: -30 })
  doc.setGState(new doc.GState({ opacity: 1 }))
  doc.setTextColor(0, 0, 0)
}
```

(실제 라이브러리 API에 맞춰 조정. 식별 후 정확한 코드로 교체)

- [ ] **Step 3: 수동 검증**

회수된 신청서 한 건 생성 → PDF 다운로드/미리보기 → 워터마크 확인.

- [ ] **Step 4: Commit**

```powershell
git commit -m "feat(approval): 회수 신청서 PDF 워터마크 표시"
```

---

## Wave 12 — 통합 검증 + 배포

### Task 26: 전체 회귀 + 마이그레이션 dry-run + QA

- [ ] **Step 1: 백엔드 clean test**

```powershell
cd it_backend
./gradlew clean test
```
Expected: 모든 테스트 PASS.

- [ ] **Step 2: 프론트 검증**

```powershell
cd it_frontend
npm run typecheck
npm run lint
npm test
```

- [ ] **Step 3: 운영 DB 클론에서 V001~V005 dry-run**

운영 DB 데이터를 staging에 복제 → Flyway 일괄 적용 → PK 충돌/NOT NULL 위반 없는지 확인.

- [ ] **Step 4: QA 수동 시나리오**

8개 시나리오 수행:
1. 신규 신청서 등록 → APF_STS_C='001' 확인
2. 결재 진행 → 중간 승인 → 마지막 승인 → '002'
3. 중간 반려 → '003' → 동일 BPROJM 신규 신청서 작성 가능 확인
4. 결재중 신청서 회수 (신청자) → '004' → 회수 알림 발송 확인
5. 회수된 BPROJM 재상신 → 신규 APF_MNG_NO로 생성
6. 회수 신청서 PDF 워터마크 시각 확인
7. 권한 없는 사용자가 회수 API 호출 → 403
8. 마지막 결재자 승인 후 회수 시도 → 400 (IllegalStateException)

- [ ] **Step 5: 운영 배포 + 스모크 테스트**

배포 직전 결재 진행 중 신청서 목록 캡처. 배포 직후 위 시나리오 1, 2, 4 스모크.

- [ ] **Step 6: 릴리스 태그**

```powershell
git tag -a v-approval-recall-2026-05-25 -m "결재상태 코드화 + 재상신 + 회수 기능 릴리스"
```

---

## Self-Review

**Spec coverage:**
- §1.2 목표 4개 → Wave 1~9에 모두 매핑.
- §2 공통코드 → Task 1
- §3.1 Capplm → Task 4, 21
- §3.2 Cdecim → Task 7, 21
- §3.3 Cappla 채번 → Task 8~10, 20
- §4 상태 전이 → Task 11, 14
- §5 회수 API → Task 12~16
- §6 재상신 → Task 17
- §7 ApplicationService → Task 10, 11, 14
- §8 Repository → Task 17, 18
- §9 마이그레이션 → Task 1, 2, 5, 20, 21
- §10 Frontend → Task 22~24
- §11 PDF → Task 25
- §12 테스트 → Task 10/15/17/26
- §13 리스크 완화 → Task 20 Step1(PK명 확인), Task 21 Step1(grep), Task 26 검증
- §14 작업 순서 → Wave 순서 일치

**Placeholder 점검:** "TBD"/"TODO"/"appropriate" 없음. Task 17/19/25는 grep 명령과 변환 패턴을 구체적으로 명시. Task 20 SQL의 `<실제_PK_제약명>` 만은 Step1 확인 후 치환되도록 의도적 표시.

**Type consistency:** `ApprovalStatus`/`DecisionStatus` enum 사용 일관, `apfStsC`/`dcdStsC` 필드명 일관, `canRecall()` 시그니처 일관.

---

## 실행 옵션

Plan complete and saved to [`docs/superpowers/plans/2026-05-25-approval-status-recall.md`](2026-05-25-approval-status-recall.md). 두 가지 옵션:

**1. Subagent-Driven (recommended)** — Task별 fresh subagent 디스패치, Task 간 리뷰, 빠른 반복

**2. Inline Execution** — 현재 세션에서 executing-plans로 진행, 체크포인트마다 검토

어느 방식으로 진행할까요?
