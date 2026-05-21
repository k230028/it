# Phase 2 — _SNO 컬럼 타입 표준화 (`02-sno`)

> 마일스톤: M02-SNO-MIGRATION · 상태: Planned · 작성일: 2026-05-21  
> 원본 설계문서: `docs/superpowers/plans/2026-05-21-sno-column-type-migration.md`

---

## 1. 페이즈 목표

`_SNO` 접미사 컬럼 33개를 NUMBER 표준 타입으로 일괄 정규화하고,
백엔드 채번 로직을 동기화한다.

## 2. 설계문서 점검 결과

> 원본 설계문서는 구조가 정확하나, 아래 **4건의 누락/오류**가 발견되었다.
> 각 Task 실행 전 반드시 확인 후 보정해야 한다.

| # | 심각도 | 항목 | 내용 |
|---|--------|------|------|
| P-1 | **HIGH** | `BtermmId.java` 수정 누락 | Phase 2 Task 2에서 `Btermm.tmnSno: String → Integer` 변경 시, `@IdClass`로 사용되는 `BtermmId.tmnSno`도 `Integer`로 변경 필수. 빠지면 Hibernate 런타임 오류 발생 |
| P-2 | **HIGH** | `BperfmId.java` 수정 누락 | Phase 2 Task 3에서 `Bperfm.dtpSno: String → Integer` 변경 시, `BperfmId.dtpSno`도 `Integer`로 변경 필수. 동일 패턴 |
| P-3 | **HIGH** | `CorgnI.update()` 파라미터 누락 | Phase 2 Task 4에서 `CorgnI.itmSqnSno: String → Integer` 변경 시, `update(String itmSqnSno, ...)` 메서드 시그니처도 `Integer`로 변경 필요. 해당 서비스 호출부 동시 수정 필요 |
| P-4 | LOW | `BtermmL.java` 경로 오류 | 설계문서 파일 목록에 `domain/budget/cost/entity/BtermmL.java`로 표기됐으나 실제 경로는 `domain/log/entity/BtermmL.java` |
| P-5 | **HIGH** | Phase 3 SQL CDECIM → CBLBML | 설계문서의 23번째 테이블이 `TAAABB_CDECIM`으로 잘못 기재됨. 실제로는 `TAAABB_CBLBML`(게시판 메타 로그). 시퀀스명도 `SEQ_CDECIM` → `SEQ_CBLBML`로 수정 필요 |

## 3. 아키텍처 결정

| Phase | 대상 | 방식 | 위험도 |
|-------|------|------|--------|
| 1 | `TOK_SNO`, `LGN_SNO` | `ALTER TABLE MODIFY` (하위 호환, 비파괴) | 최소 |
| 2 | `TMN_SNO`, `DTP_SNO`, `ITM_SQN_SNO` | 임시컬럼 ADD → UPDATE → DROP+RENAME → PK 재생성 | 중간 (PK 교체 포함) |
| 3 | `LOG_SNO` (23개 로그 테이블), `APF_REL_SNO` | 동일 패턴 + REGEXP 숫자 추출 | 높음 (23개 테이블 전수) |
| 4 | `IVG_SNO` | UUID → 등록순 ROWNUM 재번호 (임시 매핑 테이블 활용) | 높음 |

---

## 4. 사전 전제 (실행 전 필수 확인)

Phase 1 착수 전 모든 사전 확인을 DB에서 실행하고 결과를 기록한다.

```sql
-- [사전-1] LOG_SNO 숫자 추출 중복 확인 (각 테이블별로 실행)
-- 0건이어야 Phase 3 진행 가능; 1건 이상이면 담당자 협의 후 결정
SELECT TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', '')) AS NUM_VAL, COUNT(*)
FROM ITPAPP.TAAABB_BPROJL
GROUP BY TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''))
HAVING COUNT(*) > 1;
-- (동일 쿼리를 23개 테이블에 반복)

-- [사전-2] APF_REL_SNO 접두사 실제 패턴 확인
SELECT DISTINCT SUBSTR(APF_REL_SNO, 1, 5), COUNT(*)
FROM ITPAPP.TAAABB_CAPPLA
GROUP BY SUBSTR(APF_REL_SNO, 1, 5);
-- 기대: 'APPL-' 단일 패턴 (현재 코드 String.format("APPL-%028d", seq))

-- [사전-3] ITM_SQN_SNO 비숫자 데이터 확인
SELECT DISTINCT ITM_SQN_SNO
FROM ITPAPP.TAAABB_CORGNI
WHERE ITM_SQN_SNO IS NOT NULL
  AND REGEXP_LIKE(ITM_SQN_SNO, '[^0-9]');
-- 기대: 0건. 있으면 Task 4 중단, 담당자 협의

-- [사전-4] IVG_SNO FK 참조 없음 확인
SELECT TABLE_NAME, COLUMN_NAME FROM ALL_TAB_COLUMNS
WHERE OWNER='ITPAPP' AND COLUMN_NAME = 'IVG_SNO'
  AND TABLE_NAME NOT IN ('TAAABB_BRIVGM','TAAABB_BRIVGL');
-- 기대: 0건
```

---

## 5. Phase 1: NUMBER 크기 확장 (비파괴)

**목표**: `TOK_SNO`, `LGN_SNO` NUMBER(19) → NUMBER(22). Java 변경 없음.

### Task 1-1: Flyway 스크립트 작성 + DB 적용

- [ ] `it_database/migrations/V20260521_001__fix_sno_number22_phase1.sql` 생성
- [ ] DB 적용: `.\it_database\connect-db.ps1`
- [ ] 검증: `TOK_SNO`, `LGN_SNO`가 NUMBER(22)인지 확인
- [ ] 백엔드 컴파일: `cd it_backend; .\gradlew clean compileJava` → BUILD SUCCESSFUL
- [ ] 커밋: `fix: TOK_SNO·LGN_SNO NUMBER(19) → NUMBER(22) 표준 정규화`

---

## 6. Phase 2: 숫자 문자열 VARCHAR2 → NUMBER

### Task 2-1: TMN_SNO — VARCHAR2 → NUMBER(10)

**영향 파일:**
- `it_database/migrations/V20260521_002__fix_sno_number_phase2.sql`
- `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Btermm.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/BtermmId.java` ← **P-1 보정 추가**
- `it_backend/src/main/java/com/kdb/it/domain/log/entity/BtermmL.java` ← **P-4 경로 수정**
- `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java`

**보정 내용 (P-1):**

`BtermmId.java` — `tmnSno: String → Integer`:
```java
// 변경 전
private String tmnSno;

// 변경 후
private Integer tmnSno;
```

**채번 쿼리 정리**: `BtermmRepository.getNextSnoValue()` 쿼리에서
`TO_NUMBER(TMN_SNO)` 래핑 제거 → `NVL(MAX(TMN_SNO), 0) + 1`

- [ ] 사전 확인: BTERMM PK 구조 확인 쿼리 실행
- [ ] SQL 스크립트 작성 (TMN_SNO 부분)
- [ ] DB 적용 및 검증 (NUMBER(10) + NOT NULL)
- [ ] `Btermm.java` — `tmnSno: String → Integer`, `@Column length` 제거
- [ ] `BtermmId.java` — `tmnSno: String → Integer` ← P-1 보정
- [ ] `BtermmL.java` (실제 경로: `domain/log/entity/`) — `tmnSno: String → Integer`
- [ ] `BtermmRepository.java` — `TO_NUMBER()` 래핑 제거
- [ ] 빌드 확인: `.\gradlew clean compileJava`
- [ ] 커밋: `fix: TMN_SNO VARCHAR2 → NUMBER(10) 표준 정규화`

---

### Task 2-2: DTP_SNO — VARCHAR2 → NUMBER(10)

**영향 파일:**
- `it_database/migrations/V20260521_002__fix_sno_number_phase2.sql` (Task 2-1에 추가)
- `it_backend/src/main/java/com/kdb/it/domain/council/entity/Bperfm.java`
- `it_backend/src/main/java/com/kdb/it/domain/council/entity/BperfmId.java` ← **P-2 보정 추가**
- `it_backend/src/main/java/com/kdb/it/domain/log/entity/BperfmL.java`

**보정 내용 (P-2):**

`BperfmId.java` — `dtpSno: String → Integer`:
```java
// 변경 전
private String dtpSno;

// 변경 후
private Integer dtpSno;
```

> 주의: BPERFM의 기존 데이터가 없으므로 UPDATE 없이 DROP+ADD 방식 사용.

- [ ] 사전 확인: BPERFM PK 구조 확인 쿼리 실행
- [ ] SQL 스크립트에 DTP_SNO 섹션 추가
- [ ] DB 적용 및 검증
- [ ] `Bperfm.java` — `dtpSno: String → Integer`, `@Column length` 제거
- [ ] `BperfmId.java` — `dtpSno: String → Integer` ← P-2 보정
- [ ] `BperfmL.java` — `dtpSno: String → Integer`
- [ ] 빌드 확인
- [ ] 커밋: `fix: DTP_SNO VARCHAR2 → NUMBER(10) 표준 정규화`

---

### Task 2-3: ITM_SQN_SNO — VARCHAR2(9) → NUMBER(9)

**영향 파일:**
- `it_database/migrations/V20260521_002__fix_sno_number_phase2.sql` (추가)
- `it_backend/src/main/java/com/kdb/it/common/iam/entity/CorgnI.java`

**보정 내용 (P-3):**

`CorgnI.update()` 메서드 파라미터 및 호출부 수정 필요:
```java
// 변경 전
public void update(String bbrNm, String bbrWrenNm, String itmSqnSno, String prlmHrkOgzCCone)

// 변경 후
public void update(String bbrNm, String bbrWrenNm, Integer itmSqnSno, String prlmHrkOgzCCone)
```

호출 서비스 탐색 명령:
```powershell
Select-String -Path "it_backend/src/**/*.java" -Pattern "\.update\(.*itmSqnSno\|corgnI\.update" -Recurse
```

- [ ] 사전-3 쿼리로 비숫자 데이터 없음 확인
- [ ] SQL 스크립트에 ITM_SQN_SNO 섹션 추가 + COMMIT
- [ ] DB 적용 및 검증
- [ ] `CorgnI.java` — `itmSqnSno: String → Integer`, `update()` 파라미터 변경 ← P-3 보정
- [ ] 호출 서비스 수정 (P-3 보정)
- [ ] 빌드 확인
- [ ] 커밋: `fix: ITM_SQN_SNO VARCHAR2(9) → NUMBER(9) 표준 정규화`

---

## 7. Phase 3: 복합 문자열 → NUMBER(22)

### Task 3-1: LOG_SNO — 23개 로그 테이블

**핵심 주의**: 각 테이블의 숫자 추출 중복 여부를 사전-1 쿼리로 확인 후 진행.

**영향 파일:**
- `it_database/migrations/V20260521_003__fix_sno_number22_phase3_log.sql`
- `it_backend/src/main/java/com/kdb/it/domain/log/id/AuditLogIdGenerator.java`
- `it_backend/src/main/java/com/kdb/it/domain/log/entity/BaseLogEntity.java`

**변환식**: `TO_NUMBER(REGEXP_REPLACE(LOG_SNO, '[^0-9]', ''))`
(예: `BPROJL-0000000000000000000101` → `101`)

- [ ] 사전-1: 23개 테이블 전체 중복 숫자 추출 확인 (모두 0건이어야 함)
- [ ] SQL 스크립트 작성 (23개 테이블 × ADD/UPDATE/DROP/RENAME/PK 패턴)
- [ ] 시퀀스 현행화 DECLARE 블록 포함
- [ ] DB 적용 → 23개 테이블 NUMBER(22) 검증
- [ ] `AuditLogIdGenerator.java`:
  - `generate()`: 복합 문자열 조합 제거 → `fetchNextVal(session, "SEQ_" + postfix)` Long 반환
  - `SEQ_PAD_LENGTH` 상수 삭제
- [ ] `BaseLogEntity.java`: `logSno: String → Long`, `@Column(length=32)` 제거
- [ ] `logSno` String 처리 코드 전수 확인:
  ```powershell
  Select-String -Path "it_backend/src/**/*.java" -Pattern "logSno|LOG_SNO" -Recurse |
    Where-Object { $_ -match "String|format|replace|concat|startsWith|endsWith" }
  ```
- [ ] 빌드 확인
- [ ] 커밋: `fix: LOG_SNO VARCHAR2(32) → NUMBER(22), AuditLogIdGenerator 숫자 반환으로 단순화`

---

### Task 3-2: APF_REL_SNO — VARCHAR2(36) → NUMBER(22)

**영향 파일:**
- `it_database/migrations/V20260521_004__fix_sno_number22_phase3_apf.sql`
- `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java`
- `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`

**사전-2 확인 필수**: 실제 DB에서 `APPL-` 접두사 단일 패턴 확인 후 진행.

**ApplicationService.java 변경 포인트** (L147-L161):
```java
// 제거: L150-L151
Long seq = applicationMapRepository.getNextVal();
String apfRelSno = String.format("APPL-%028d", seq);
// 제거: L154
.apfRelSno(apfRelSno)

// @GeneratedValue 적용 후 apfRelSno는 save() 시 자동 채번
```

`ApplicationMapRepository.getNextVal()` 전용 여부 확인:
```powershell
Select-String -Path "it_backend/src/**/*.java" -Pattern "applicationMapRepository" -Recurse
```
전용이면 해당 메서드 삭제 (Repository 클래스는 `save()` 메서드 사용하므로 보존).

- [ ] 사전-2: `APF_REL_SNO` 접두사 패턴 확인
- [ ] SQL 스크립트 작성 (복합 인덱스 DROP → ADD/UPDATE/DROP/RENAME/PK → 인덱스 재생성 → 시퀀스 현행화)
- [ ] DB 적용 및 검증
- [ ] `Cappla.java`: `apfRelSno: String → Long`, `@GeneratedValue` + `@SequenceGenerator` 추가
- [ ] `ApplicationService.java`: L150-L151 수동 채번 코드 제거, `.apfRelSno(apfRelSno)` 빌더 항목 제거
- [ ] `applicationMapRepository.getNextVal()` 전용이면 해당 메서드 삭제
- [ ] 빌드 확인
- [ ] 커밋: `fix: APF_REL_SNO VARCHAR2 → NUMBER(22), @GeneratedValue 채번으로 전환`

---

## 8. Phase 4: UUID → NUMBER(22)

### Task 4-1: IVG_SNO — UUID → NUMBER(22)

**핵심**: UUID는 숫자 변환 불가 → GLOBAL TEMPORARY TABLE로 UUID-NUMBER 매핑 후 교체.

**영향 파일:**
- `it_database/migrations/V20260521_005__fix_sno_number22_phase4_ivg.sql`
- `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/Brivgm.java`
- `it_backend/src/main/java/com/kdb/it/domain/log/entity/BrivgmL.java`

> 새 시퀀스 `SEQ_BRIVGM`을 마이그레이션 스크립트에서 생성한다 (기존에 없음).

- [ ] 사전-4: FK 없음 확인, 다른 테이블의 IVG_SNO 참조 없음 확인
- [ ] SQL 스크립트 작성 (매핑 GTT 생성 → ROWNUM 채움 → 양쪽 교체 → SEQ_BRIVGM 생성 → GTT 삭제)
- [ ] DB 적용 → `BRIVGM`, `BRIVGL` 데이터 연속성 검증 (BRIVGL.IVG_SNO가 BRIVGM에 모두 존재)
- [ ] `Brivgm.java`: `ivgSno: String → Long`, `@GeneratedValue` + `@SequenceGenerator(SEQ_BRIVGM)` 추가, `@PrePersist` 전체 삭제, `UUID` import 삭제
- [ ] `BrivgmL.java`: `ivgSno: String → Long`
- [ ] `ivgSno` String 처리 코드 확인:
  ```powershell
  Select-String -Path "it_backend/src/**/*.java" -Pattern "ivgSno|IVG_SNO" -Recurse |
    Where-Object { $_ -notmatch "entity\\\\Brivgm" }
  ```
- [ ] 빌드 확인
- [ ] 커밋: `fix: IVG_SNO UUID VARCHAR2 → NUMBER(22), SEQ_BRIVGM 생성, @GeneratedValue 전환`

---

## 9. 최종 검증

- [ ] 전체 빌드 + 테스트: `cd it_backend; .\gradlew clean build`
- [ ] `_SNO` 전수 타입 확인: 아래 쿼리가 **0건**이어야 통과

```sql
-- VARCHAR2 잔존 확인
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, DATA_LENGTH, DATA_PRECISION
FROM ALL_TAB_COLUMNS
WHERE OWNER = 'ITPAPP'
  AND COLUMN_NAME LIKE '%\_SNO' ESCAPE '\'
  AND DATA_TYPE != 'NUMBER'
ORDER BY TABLE_NAME, COLUMN_NAME;
-- 기대: 0건

-- NUMBER지만 비표준 크기 확인 (허용 크기: 4,7,9,10,18,22)
SELECT TABLE_NAME, COLUMN_NAME, DATA_PRECISION
FROM ALL_TAB_COLUMNS
WHERE OWNER = 'ITPAPP'
  AND COLUMN_NAME LIKE '%\_SNO' ESCAPE '\'
  AND DATA_TYPE = 'NUMBER'
  AND DATA_PRECISION NOT IN (4, 7, 9, 10, 18, 22)
ORDER BY TABLE_NAME;
-- 기대: 0건
```

- [ ] DDL 현행화: `DBMS_METADATA.GET_DDL`로 최신 스키마 추출 → `it_database/ddl/ddl.sql` 갱신
- [ ] 커밋: `docs: _SNO 컬럼 표준화 완료 후 DDL 현행화`

---

## 10. 리스크 및 주의사항

| 리스크 | 대상 | 대응 |
|--------|------|------|
| LOG_SNO 숫자 추출 중복 | 23개 로그 테이블 | 사전-1 쿼리로 전 테이블 확인. 1건이라도 중복이면 STOP |
| APF_REL_SNO 접두사 패턴 불일치 | CAPPLA | 사전-2 쿼리 확인 필수. `APPL-` 외 패턴 발견 시 STOP |
| ITM_SQN_SNO 비숫자 데이터 | CORGNI | 사전-3 쿼리 확인 필수. 비숫자 존재 시 Task 2-3 STOP |
| IVG_SNO 외부 캐시 | 프론트 세션 | UUID → 숫자 재번호 후 클라이언트 캐시 무효화 필요 |
| BtermmId/BperfmId 타입 불일치 | JPA @IdClass | **P-1/P-2 보정 적용 필수** — 빌드 성공해도 런타임 오류 가능 |
| CorgnI.update() 호출부 | 서비스 레이어 | **P-3 보정 적용 필수** — 컴파일 오류로 즉시 발견됨 |
| Phase 순서 역전 금지 | 전체 | Phase 1 → 2 → 3 → 4 순서 엄수. 이전 Phase 검증 완료 전 다음 Phase 착수 금지 |

---

## 11. 산출물 목록

| 파일 | 유형 | Phase |
|------|------|-------|
| `it_database/migrations/V20260521_001__fix_sno_number22_phase1.sql` | 신규 | 1 |
| `it_database/migrations/V20260521_002__fix_sno_number_phase2.sql` | 신규 | 2 |
| `it_database/migrations/V20260521_003__fix_sno_number22_phase3_log.sql` | 신규 | 3 |
| `it_database/migrations/V20260521_004__fix_sno_number22_phase3_apf.sql` | 신규 | 3 |
| `it_database/migrations/V20260521_005__fix_sno_number22_phase4_ivg.sql` | 신규 | 4 |
| `it_database/ddl/ddl.sql` | 수정 | 최종 |
| `domain/log/id/AuditLogIdGenerator.java` | 수정 | 3 |
| `domain/log/entity/BaseLogEntity.java` | 수정 | 3 |
| `domain/budget/document/entity/Brivgm.java` | 수정 | 4 |
| `domain/log/entity/BrivgmL.java` | 수정 | 4 |
| `domain/budget/cost/entity/Btermm.java` | 수정 | 2 |
| `domain/budget/cost/entity/BtermmId.java` | 수정 | 2 (**P-1 추가**) |
| `domain/log/entity/BtermmL.java` | 수정 | 2 |
| `domain/budget/cost/repository/BtermmRepository.java` | 수정 | 2 |
| `domain/council/entity/Bperfm.java` | 수정 | 2 |
| `domain/council/entity/BperfmId.java` | 수정 | 2 (**P-2 추가**) |
| `domain/log/entity/BperfmL.java` | 수정 | 2 |
| `common/iam/entity/CorgnI.java` | 수정 | 2 (**P-3 추가**) |
| `common/approval/entity/Cappla.java` | 수정 | 3 |
| `common/approval/service/ApplicationService.java` | 수정 | 3 |
