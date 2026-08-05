# BE-03 ~ BE-25 Backend Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md`의 BE-03~25 범위에서 이미 완료된 항목은 재작업하지 않고, 남은 백엔드 성능·검증·DB 무결성·운영·외부 의존 과제를 위험도와 선행 조건에 맞춰 종결한다.

**Architecture:** 즉시 적용 가능한 애플리케이션 수정, Oracle 제약·마이그레이션, 운영/외부 게이트, BE-03 성능 후속을 서로 독립된 변경 묶음으로 실행한다. DB 변경은 데이터 사전 점검 → 결정적 정리 → 제약 추가 → Oracle 통합 테스트 순서로 진행하고, API 계약 변경은 기존 경로를 유지한 추가형 목록 계약으로 도입한 뒤 소비자를 전환한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, QueryDSL, Oracle 21c, Flyway, JUnit 5, Mockito, AssertJ, Gradle

## Global Constraints

- 신규 JavaDoc·인라인 주석은 한글로 작성한다.
- Controller → Service → Repository 방향과 생성자 주입을 유지한다.
- 모든 쓰기 API 요청 본문은 `@Valid`를 유지한다.
- 적용된 Flyway 스크립트는 수정하지 않고 `it_database/migrations/V20260729_NNN__*.sql`을 새로 추가한다.
- DB 접속 계정은 `ITPAPP`, 객체 소유 스키마는 `ITPOWN`이며 애플리케이션 코드에는 `ITPOWN.` 접두사를 넣지 않는다.
- 업무 엔티티는 물리 삭제하지 않는다.
- 소프트 삭제(`DEL_YN`) 이력이 남는 테이블에 UNIQUE 제약을 추가할 때는 전 행 UNIQUE 대신 `CASE WHEN DEL_YN='N' THEN ... END` 함수 기반 부분 UNIQUE를 사용한다. 전 행 UNIQUE가 안전하다고 판단한 경우에는 그 근거(전역 채번 등)를 마이그레이션 주석과 엔티티 JavaDoc에 남긴다.
- 캐시 무효화는 트랜잭션 커밋 후 반영되는 `TransactionAwareCacheManagerProxy` 계약을 유지한다.
- 교차 저장소 변경은 DB 제약 → 백엔드 계약 → 프론트 소비자 순으로 검증하고, 호환 커밋 조합은 마지막에 `versions.lock`에 기록한다.
- 현재 다른 작업이 수정 중인 `TASK.md`와 프론트 작업 브랜치를 덮어쓰지 않는다.

---

## 범위 정합화

현재 `TASK.md`의 ID만 기계적으로 순회하면 완료 과제를 재작업하고 중복 ID를 잘못 닫게 된다. 실행 전에 아래 기준으로 범위를 고정한다.

| 원래 표기 | 판정 | 이 계획의 처리 |
| --- | --- | --- |
| BE-03 | 1차 구현과 BE-17 정책 구현은 `main` 병합 완료 | 운영 관측, BBUGTM/ProjectKeyView·알림 프로젝션, Project/Cost 목록 계약, `versions.lock`만 처리 |
| BE-04~17 | `TASK_DONE.md`에 완료 이관 | 재작업하지 않음 |
| BE-18~23 | 활성 | 각각 외부 게이트 또는 구현 작업으로 처리 |
| BE-24 High / DB | 활성 | 기존 ID 유지 |
| BE-25 Medium / DB | 활성 | 기존 ID 유지 |
| BE-25 Medium / 캐시 | 중복 ID | BE-28로 재번호화 |
| BE-24 Low / 성능 | 중복 ID | BE-29로 재번호화 |

## 변경 묶음과 권장 순서

1. **운영 차단 해소:** BE-22 DBA 인계 자료
2. **데이터 무결성:** BE-24, BE-25, BE-20
3. **즉시 적용 앱 수정:** BE-28, BE-19, BE-29
4. **성능 후속:** BE-03 BBUGTM/ProjectKeyView/알림 프로젝션
5. **관측 후 계약 분리:** BE-03 Project/Cost 목록
6. **조건부 정리:** BE-18, BE-21, BE-23
7. **릴리스 잠금·과제 이관:** `versions.lock`, `TASK.md`, `TASK_DONE.md`

DB와 백엔드는 독립 저장소이므로 변경 묶음별로 별도 커밋한다. BE-03 Project/Cost 목록 계약은 프론트 소비자 변경까지 별도 계획/PR로 실행한다.

**묶음 1↔2 간 역방향 의존이 하나 있다.** BE-22 인계 문서(Task 2)는 `INFM_SD_STS_C`의 최종 DEFAULT를 기재해야 하는데, 그 값은 Task 5 Step 1에서 확정된다. Task 2를 먼저 실행하되 **Task 5 Step 1의 결정을 먼저 내린 뒤** 인계 문서를 작성한다. Task 5 Step 1은 코드·DB를 건드리지 않는 결정 단계라 순서를 앞당겨도 안전하다.

세 DB Task(3·4·5)는 `it_database/tools/preflight-20260729.sql` 한 파일을 공유한다. Task 3이 파일을 만들고 Task 4·5가 각자 쿼리를 덧붙인다.

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `TASK.md`, `TASK_DONE.md` | 활성 과제 ID 정규화와 완료 근거 이관 |
| `versions.lock` | 검증된 4-repo 커밋 조합 고정 |
| `it_backend/docs/guides/operations/migration-20260724-handover.md` | BE-22 DBA 사전/적용/복구 체크리스트 |
| `it_database/tools/preflight-20260724.sql` | BE-22 읽기 전용 사전 점검 SQL |
| `it_database/tools/preflight-20260729.sql` | BE-24·25·20 적용 전 영향 건수 읽기 전용 리포트 |
| `it_database/migrations/V20260729_001__EnforceCurrentDocumentSingleton.sql` | BE-24 활성 최신 문서 1건 제약 |
| `it_database/migrations/V20260729_002__EnforceApplicationIdentityKeys.sql` | BE-25 JPA 후보키 UNIQUE 인덱스 |
| `it_database/migrations/V20260729_003__AlignNotificationDispatchDefault.sql` | BE-20 알림 발송 상태 기본값 정합화 |
| `it_backend/src/test/java/com/kdb/it/domain/document/repository/CurrentDocumentSingletonIt.java` | 집행 문서 3종 활성 최신행 단일성 Oracle 검증 |
| `it_backend/docs/guides/persistence/data-model.md` | 집행 문서 버전 전환의 잠금·원자 갱신 규칙 |
| `it_backend/src/test/java/com/kdb/it/domain/persistence/ApplicationIdentityKeyIt.java` | 부분 JPA 식별자의 DB 후보키 단일성 검증 |
| `it_backend/src/test/java/com/kdb/it/common/notification/repository/NotificationDispatchDefaultIt.java` | DB 기본값이 앱 코드셋 `01`을 생성하는지 검증 |
| `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java` | 공통코드 관리자 쓰기 캐시 무효화 |
| `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminServiceCacheEvictTest.java` | 실제 Spring 캐시 프록시 발화 검증 |
| `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java` | 생성 요청 `abusTc` 입력 검증 |
| `it_backend/src/test/java/com/kdb/it/domain/budget/project/controller/ProjectControllerTest.java` | 누락·공백 사업구분 400 계약 |
| `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java` | 표시명 그룹 대표행 결정론화와 읽기 프로젝션 소비 |
| `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BudgetReadView.java` | BBUGTM 요약 계산 최소 필드 계약 |
| `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepository.java` | 연도별 읽기 프로젝션 조회 |
| `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java` | 최신 사업 키·이름 배치 프로젝션 (**신규** `ProjectKeyView` 중첩 인터페이스 포함) |
| `it_backend/src/main/java/com/kdb/it/common/notification/repository/NotificationInboxRow.java` | 알림함 응답용 최소 필드 계약 |
| `it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryCustom.java` | 알림함 프로젝션 페이지 인터페이스 |
| `it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImpl.java` | QueryDSL 알림함 프로젝션 조회 |
| `it_backend/src/main/java/com/kdb/it/common/notification/dto/NotificationDto.java` | 프로젝션→응답 매핑 |
| `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationService.java` | 엔티티 대신 응답 DTO 페이지 반환 |

---

### Task 1: 활성 과제 ID와 완료 범위 정규화

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:**
- Consumes: 현재 `TASK.md` 백엔드 표와 `TASK_DONE.md`의 BE-03·04~17 완료 근거
- Produces: ID가 유일한 활성 백로그와 이 계획의 추적 기준

- [ ] **Step 1: 중복 ID 회귀 검사를 실행한다**

Run:

```powershell
$ids = Select-String -Path C:\it\TASK.md -Pattern '^\| (BE-\d+) ' |
    ForEach-Object { $_.Matches[0].Groups[1].Value }
$ids | Group-Object | Where-Object Count -gt 1
```

Expected: 현재는 `BE-24`, `BE-25`가 각각 2건으로 출력된다.

- [ ] **Step 2: 새로 발견된 두 항목만 재번호화한다**

`AdminService 공통코드 CRUD의 CacheEvict 공백`을 `BE-28`, `getSummary 표시명 병합 블록의 잔여 encounter-order 채택 2곳`을 `BE-29`로 바꾼다. High DB `BE-24`와 Medium DB `BE-25`, 이미 참조 중인 `BE-26`, `BE-27`은 유지한다.

- [ ] **Step 3: 완료 범위 안내 문장을 추가한다**

백엔드 표 아래에 다음 의미가 드러나는 한 문장을 추가한다.

```markdown
_BE-04~17의 완료 근거는 `TASK_DONE.md`의 2026-07-20~27 백엔드 조치 기록을 참조하며, BE-03은 1차 완료 후속만 활성 추적합니다._
```

- [ ] **Step 4: BE-19의 어긋난 라인 참조를 보정한다**

BE-19 설명이 가리키는 `ProjectDto.java:217`(검증 어노테이션 부재 지점)과 `ProjectDto.java:272`(`CodeDefaults.orNotApplicable` 호출 지점)는 현재 각각 `:220`, `:275`로 밀렸다. 두 참조를 실제 라인으로 바꾼다.

Run:

```powershell
rg -n 'abusTc' C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\project\dto\ProjectDto.java
```

Expected: `CreateRequest.abusTc` 선언과 `CodeDefaults.orNotApplicable(abusTc)` 호출의 현재 라인 번호가 확인된다.

- [ ] **Step 5: ID 유일성을 다시 검증한다**

Run: Step 1의 PowerShell 명령

Expected: 출력 없음.

- [ ] **Step 6: 루트 문서 커밋**

```powershell
git -C C:\it add TASK.md TASK_DONE.md
git -C C:\it commit -m "docs: 백엔드 활성 과제 ID와 완료 범위 정규화"
```

---

### Task 2: BE-22 DBA 인계 자료와 사전 점검 SQL

**Files:**
- Create: `it_database/tools/preflight-20260724.sql`
- Create: `it_backend/docs/guides/operations/migration-20260724-handover.md`
- Modify: `it_backend/docs/guides/operations/flyway.md`

**Interfaces:**
- Consumes: `V20260724_001__AddBesttImprovementOpinionSno.sql`, `V20260724_002__AlignConstraintsWithProduction.sql`
- Produces: DBA가 변경 없이 실행할 수 있는 읽기 전용 사전 점검과 명시적 적용/복구 절차

- [ ] **Step 1: 읽기 전용 사전 점검 SQL을 작성한다**

`preflight-20260724.sql`에 아래 검사를 넣는다. 첫 쿼리는 행이 하나라도 반환되면 중단하고, BBIZCM/BBIZCL 건수 쿼리는 `CNT=0`일 때만 통과한다.

```sql
-- BESTTM 백필 전제 위반
SELECT 'BESTTM_DUP_NULL_SNO' AS CHECK_NAME,
       RQM_BG_REQ_DOC_NO AS KEY1,
       TO_CHAR(DOC_VRS_SNO) AS KEY2,
       COUNT(*) AS CNT
  FROM ITPOWN.TPRMPP_BESTTM
 WHERE IPM_OPNN_SNO IS NULL
 GROUP BY RQM_BG_REQ_DOC_NO, DOC_VRS_SNO
HAVING COUNT(*) > 1;

-- 계약방법 NOT NULL 전환 차단 건수
SELECT 'BBIZCM_NULL_NOW_CTT_MANR_C' AS CHECK_NAME, COUNT(*) AS CNT
  FROM ITPOWN.TPRMPP_BBIZCM
 WHERE NOW_CTT_MANR_C IS NULL;

SELECT 'BBIZCL_NULL_NOW_CTT_MANR_C' AS CHECK_NAME, COUNT(*) AS CNT
  FROM ITPOWN.TPRMPP_BBIZCL
 WHERE NOW_CTT_MANR_C IS NULL;

-- PK 재생성 필요 여부와 현재 컬럼 순서
SELECT c.CONSTRAINT_NAME, cc.COLUMN_NAME, cc.POSITION
  FROM ALL_CONSTRAINTS c
  JOIN ALL_CONS_COLUMNS cc
    ON cc.OWNER = c.OWNER
   AND cc.CONSTRAINT_NAME = c.CONSTRAINT_NAME
 WHERE c.OWNER = 'ITPOWN'
   AND c.TABLE_NAME = 'TPRMPP_BESTTM'
   AND c.CONSTRAINT_TYPE = 'P'
 ORDER BY cc.POSITION;
```

- [ ] **Step 2: DBA 인계 문서를 작성한다**

문서에 다음 순서를 고정한다.

1. 사전 SQL 실행 결과 저장
2. `V20260724_001` 적용 유지보수 창 확보와 `PK_BESTTM` 재생성 예상 시간 확인
3. `V20260724_002` 적용 전 BBIZCM/BBIZCL NULL 실제 코드 보정
4. `*L` 로그 backfill의 감사 이력 의미를 업무/감사 담당자에게 사전 공지
5. 실패 시 `flyway_schema_history` 상태 확인
6. 실패 기록이 남은 경우에만 원인 제거 후 `flyway repair`
7. 재실행 후 `ALL_TAB_COLUMNS`, `ALL_CONSTRAINTS`, `ALL_INDEXES` 사후 검증

`flyway repair`를 무조건 실행하는 절차로 쓰지 않는다.

**`INFM_SD_STS_C` 기본값 왕복 방지(필수 기재):** `V20260724_002`는 `TPRMPP_CINFMM.INFM_SD_STS_C`의 DEFAULT를 운영과 같은 `'10'`으로 **의도적으로 정렬**한다(같은 파일 상단 주석이 근거를 설명하며, backfill 값만 앱 코드셋 `'01'`을 쓴다). 이 계획의 Task 5(`V20260729_003`)가 그 DEFAULT를 `'01'`로 다시 바꾸므로, 인계 문서에 다음을 명시해 DBA가 같은 유지보수 창에서 `'10'` → `'01'` 왕복을 하지 않도록 한다.

- `V20260724_002`와 `V20260729_003`은 **같은 창에서 연속 적용**한다.
- 두 스크립트 적용 후 `INFM_SD_STS_C`의 **최종 DEFAULT는 `'01'`(발송대기)** 이며, `'10'`은 어느 단계에서도 앱이 해석하는 값이 아니다.
- `V20260724_002`만 적용하고 창을 닫아야 하는 경우, 그 사이에 앱이 컬럼을 생략한 insert를 하지 않는지(현재 앱은 항상 명시적으로 상태를 쓴다) 확인하고 다음 창에서 `V20260729_003`을 반드시 적용한다.

- [ ] **Step 3: 기존 Flyway 가이드에서 인계 문서를 연결한다**

`flyway.md`의 dev/prod 수동 적용 절에 `migration-20260724-handover.md` 링크를 추가한다.

- [ ] **Step 4: 문서와 SQL의 금지 패턴을 검사한다**

Run:

```powershell
rg -n 'UPDATE|DELETE|INSERT|ALTER|DROP|TRUNCATE' C:\it\it_database\tools\preflight-20260724.sql
```

Expected: 주석을 제외하고 변경 SQL이 없어야 한다.

- [ ] **Step 5: 저장소별 커밋**

```powershell
git -C C:\it\it_database add tools/preflight-20260724.sql
git -C C:\it\it_database commit -m "docs(db): 20260724 마이그레이션 사전 점검 SQL 추가"

git -C C:\it\it_backend add docs/guides/operations/migration-20260724-handover.md docs/guides/operations/flyway.md
git -C C:\it\it_backend commit -m "docs: 20260724 DBA 마이그레이션 인계 절차 추가"
```

---

### Task 3: BE-24 집행 문서 활성 최신 버전 단일성

**Files:**
- Create: `it_database/tools/preflight-20260729.sql`
- Create: `it_database/migrations/V20260729_001__EnforceCurrentDocumentSingleton.sql`
- Create: `it_backend/src/test/java/com/kdb/it/domain/document/repository/CurrentDocumentSingletonIt.java`
- Modify: `it_backend/docs/guides/persistence/data-model.md`
- Test: `it_backend/src/test/java/com/kdb/it/domain/deliberation/repository/DeliberationDetailProjectionIt.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/contract/repository/ContractDetailProjectionIt.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/payment/repository/PaymentDetailProjectionIt.java`

**Interfaces:**
- Consumes: `(DOC_MNG_NO, DOC_VRS_SNO)` 물리 PK와 `LST_YN='Y' AND DEL_YN='N'` 현재행 조건
- Produces: 문서번호별 활성 최신행 최대 1건이라는 DB 불변식

- [ ] **Step 1: 현재 버전 전환 경로가 없음을 다시 확인한다**

Run:

```powershell
rg -n 'docVrsSno\(|setDocVrsSno|mark.*Latest|LST_YN.*N|lstYn\("N"\)' C:\it\it_backend\src\main\java\com\kdb\it\domain\deliberation C:\it\it_backend\src\main\java\com\kdb\it\domain\contract C:\it\it_backend\src\main\java\com\kdb\it\domain\payment
```

Expected: 세 도메인은 생성 시 버전 1을 만들고 이후 같은 행을 갱신할 뿐, 새 버전을 생성하는 운영 경로가 없다. 사용되지 않는 잠금/전환 코드를 미리 추가하지 않는다.

- [ ] **Step 2: 제약 부재를 증명하는 Oracle 통합 테스트를 작성한다**

테스트는 세 테이블 각각에 대해 서로 다른 버전의 활성 최신행 2건을 native insert하고, 두 번째 insert가 현재는 성공하는 RED 상태를 먼저 확인한다. 테스트 메서드 이름은 다음 세 개로 고정한다.

테스트 클래스는 `AbstractOracleRepositoryTest`를 상속하고 `@Autowired JdbcTemplate jdbc`를 선언한다.

```java
@Test
void deliberation_두번째활성최신행은거부된다() {
    String docNo = "BE24-D-" + UUID.randomUUID().toString().substring(0, 8);
    jdbc.update(
            "INSERT INTO TPRMPP_BDELIM "
                    + "(DOC_MNG_NO,DOC_VRS_SNO,LST_YN,CNCD_RFR_NO,IT_PTL_STS_TC,"
                    + "TASK_DBR_TC,TASK_DBR_RLT_TC,TASK_DBR_TOD) "
                    + "VALUES (?,1,'Y','REF','81','1','1','1')",
            docNo);

    assertThatThrownBy(
                    () ->
                            jdbc.update(
                                    "INSERT INTO TPRMPP_BDELIM "
                                            + "(DOC_MNG_NO,DOC_VRS_SNO,LST_YN,CNCD_RFR_NO,"
                                            + "IT_PTL_STS_TC,TASK_DBR_TC,TASK_DBR_RLT_TC,TASK_DBR_TOD) "
                                            + "VALUES (?,2,'Y','REF','81','1','1','1')",
                                    docNo))
            .isInstanceOf(DataAccessException.class);
}

@Test
void contract_두번째활성최신행은거부된다() {
    String docNo = "BE24-C-" + UUID.randomUUID().toString().substring(0, 8);
    jdbc.update(
            "INSERT INTO TPRMPP_BCONTM "
                    + "(DOC_MNG_NO,DOC_VRS_SNO,LST_YN,CNCD_RFR_NO,IT_PTL_STS_TC) "
                    + "VALUES (?,1,'Y','REF','81')",
            docNo);

    assertThatThrownBy(
                    () ->
                            jdbc.update(
                                    "INSERT INTO TPRMPP_BCONTM "
                                            + "(DOC_MNG_NO,DOC_VRS_SNO,LST_YN,CNCD_RFR_NO,IT_PTL_STS_TC) "
                                            + "VALUES (?,2,'Y','REF','81')",
                                    docNo))
            .isInstanceOf(DataAccessException.class);
}

@Test
void payment_두번째활성최신행은거부된다() {
    String docNo = "BE24-P-" + UUID.randomUUID().toString().substring(0, 8);
    jdbc.update(
            "INSERT INTO TPRMPP_BPAYMM "
                    + "(DOC_MNG_NO,DOC_VRS_SNO,LST_YN,CNCD_RFR_NO,IT_PTL_STS_TC) "
                    + "VALUES (?,1,'Y','REF','81')",
            docNo);

    assertThatThrownBy(
                    () ->
                            jdbc.update(
                                    "INSERT INTO TPRMPP_BPAYMM "
                                            + "(DOC_MNG_NO,DOC_VRS_SNO,LST_YN,CNCD_RFR_NO,IT_PTL_STS_TC) "
                                            + "VALUES (?,2,'Y','REF','81')",
                                    docNo))
            .isInstanceOf(DataAccessException.class);
}
```

- [ ] **Step 3: RED를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew integrationTest --tests "*CurrentDocumentSingletonIt"
```

Expected: 두 번째 활성행 insert가 예외를 내지 않아 3개 테스트가 FAIL.

- [ ] **Step 4: 영향 건수를 먼저 읽기 전용으로 리포트한다**

Task 4는 후보키 중복을 자동 병합하지 않고 중단하는데, 이 Task는 활성 최신행을 자동 강등한다. 두 원칙의 차이는 **자동 처리의 결과가 결정적인지**에 있다 — 집행 문서는 `DOC_VRS_SNO` 최대값이 곧 최신 버전이라는 물리 규칙이 있어 강등 결과가 유일하지만, BCMMTM 중복은 위원유형이라는 업무 의미 차이라 자동 선택 근거가 없다. 다만 자동 강등도 **적용 전에 건수를 눈으로 확인한 뒤** 실행한다.

`preflight-20260729.sql`에 아래 리포트를 넣고(이 Task와 Task 4·5가 같은 파일을 공유한다), 세 테이블의 강등 대상 건수를 기록한 뒤 마이그레이션을 적용한다.

```sql
-- BE-24: 활성 최신행이 2건 이상인 문서번호와 강등 예정 건수
SELECT 'BDELIM' AS TB, DOC_MNG_NO, COUNT(*) AS ACTIVE_CNT, MAX(DOC_VRS_SNO) AS KEEP_VRS
  FROM ITPOWN.TPRMPP_BDELIM
 WHERE LST_YN = 'Y' AND DEL_YN = 'N'
 GROUP BY DOC_MNG_NO HAVING COUNT(*) > 1
UNION ALL
SELECT 'BCONTM', DOC_MNG_NO, COUNT(*), MAX(DOC_VRS_SNO)
  FROM ITPOWN.TPRMPP_BCONTM
 WHERE LST_YN = 'Y' AND DEL_YN = 'N'
 GROUP BY DOC_MNG_NO HAVING COUNT(*) > 1
UNION ALL
SELECT 'BPAYMM', DOC_MNG_NO, COUNT(*), MAX(DOC_VRS_SNO)
  FROM ITPOWN.TPRMPP_BPAYMM
 WHERE LST_YN = 'Y' AND DEL_YN = 'N'
 GROUP BY DOC_MNG_NO HAVING COUNT(*) > 1;
```

리포트가 비어 있지 않으면 강등 대상 문서번호 목록을 결과 파일로 남기고, dev/prod 적용 시 같은 목록을 DBA 인계 자료에 첨부한다.

- [ ] **Step 5: 기존 중복을 결정적으로 정리하는 마이그레이션을 작성한다**

각 테이블에서 활성 최신행이 2건 이상이면 `DOC_VRS_SNO` 최대 행만 `LST_YN='Y'`로 유지하고 나머지를 `N`으로 낮춘다. 자동 삭제는 하지 않는다.

```sql
UPDATE ITPOWN.TPRMPP_BDELIM d
   SET d.LST_YN = 'N'
 WHERE d.LST_YN = 'Y'
   AND d.DEL_YN = 'N'
   AND d.DOC_VRS_SNO < (
       SELECT MAX(x.DOC_VRS_SNO)
         FROM ITPOWN.TPRMPP_BDELIM x
        WHERE x.DOC_MNG_NO = d.DOC_MNG_NO
          AND x.LST_YN = 'Y'
          AND x.DEL_YN = 'N'
   );

UPDATE ITPOWN.TPRMPP_BCONTM d
   SET d.LST_YN = 'N'
 WHERE d.LST_YN = 'Y'
   AND d.DEL_YN = 'N'
   AND d.DOC_VRS_SNO < (
       SELECT MAX(x.DOC_VRS_SNO)
         FROM ITPOWN.TPRMPP_BCONTM x
        WHERE x.DOC_MNG_NO = d.DOC_MNG_NO
          AND x.LST_YN = 'Y'
          AND x.DEL_YN = 'N'
   );

UPDATE ITPOWN.TPRMPP_BPAYMM d
   SET d.LST_YN = 'N'
 WHERE d.LST_YN = 'Y'
   AND d.DEL_YN = 'N'
   AND d.DOC_VRS_SNO < (
       SELECT MAX(x.DOC_VRS_SNO)
         FROM ITPOWN.TPRMPP_BPAYMM x
        WHERE x.DOC_MNG_NO = d.DOC_MNG_NO
          AND x.LST_YN = 'Y'
          AND x.DEL_YN = 'N'
   );
```

- [ ] **Step 6: 함수 기반 UNIQUE 인덱스를 추가한다**

인덱스 존재 여부는 `ALL_INDEXES`로 검사한 뒤 아래 정의를 동적 실행한다.

```sql
CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BDELIM_03
    ON ITPOWN.TPRMPP_BDELIM
       (CASE WHEN LST_YN = 'Y' AND DEL_YN = 'N' THEN DOC_MNG_NO END);

CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BCONTM_03
    ON ITPOWN.TPRMPP_BCONTM
       (CASE WHEN LST_YN = 'Y' AND DEL_YN = 'N' THEN DOC_MNG_NO END);

CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BPAYMM_03
    ON ITPOWN.TPRMPP_BPAYMM
       (CASE WHEN LST_YN = 'Y' AND DEL_YN = 'N' THEN DOC_MNG_NO END);
```

비활성/삭제 행의 CASE 결과는 NULL이므로 여러 과거 버전을 허용하고 활성 최신행만 단일화한다.

- [ ] **Step 7: 로컬 Oracle에 신규 마이그레이션을 적용한다**

```powershell
cd C:\it\it_backend
$env:SPRING_PROFILES_ACTIVE = 'local-ext'
.\gradlew bootRun
```

Expected: 로그에 `V20260729.001` 적용 성공과 애플리케이션 기동 완료가 보인다. 확인 후 `Ctrl+C`로 종료한다.

- [ ] **Step 8: GREEN과 기존 상세 계약을 검증한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew integrationTest --tests "*CurrentDocumentSingletonIt" --tests "*DeliberationDetailProjectionIt" --tests "*ContractDetailProjectionIt" --tests "*PaymentDetailProjectionIt"
```

Expected: 두 번째 활성 최신행은 `DataIntegrityViolationException` 또는 원인 체인의 `ConstraintViolationException`으로 거부되고 기존 상세 조회는 PASS.

- [ ] **Step 9: 버전 전환 규칙을 데이터 모델 가이드에 기록한다**

현재는 버전 전환 경로가 없음을 기록하고, 향후 추가 시 아래 순서를 하나의 `@Transactional` 안에서 실행하도록 고정한다.

1. 문서번호의 현재 활성행을 `PESSIMISTIC_WRITE`로 잠근다.
2. 현재행을 `LST_YN='N'`으로 낮춘다.
3. `DOC_VRS_SNO = 현재 최대값 + 1`, `LST_YN='Y'`인 새 행을 insert한다.
4. 함수 기반 UNIQUE 인덱스 위반은 동시 전환 충돌로 표면화하고 재시도하지 않는다.

- [ ] **Step 10: DB와 백엔드 커밋**

```powershell
git -C C:\it\it_database add migrations/V20260729_001__EnforceCurrentDocumentSingleton.sql tools/preflight-20260729.sql
git -C C:\it\it_database commit -m "fix(db): 집행 문서 활성 최신 버전 단일성 보장"

git -C C:\it\it_backend add src/test/java/com/kdb/it/domain/document/repository/CurrentDocumentSingletonIt.java docs/guides/persistence/data-model.md
git -C C:\it\it_backend commit -m "test: 집행 문서 활성 최신행 단일성 검증"
```

---

### Task 4: BE-25 JPA 식별자 후보키와 DB 정합화

**Files:**
- Create: `it_database/migrations/V20260729_002__EnforceApplicationIdentityKeys.sql`
- Modify: `it_database/tools/preflight-20260729.sql` (Task 3에서 생성)
- Create: `it_backend/src/test/java/com/kdb/it/domain/persistence/ApplicationIdentityKeyIt.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cappla.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/entity/Bcmmtm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/entity/Bmqnam.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/entity/Bpqnam.java`

**Interfaces:**
- Consumes: 현재 JPA ID `Cappla.apfSno`, `Bcmmtm(itPtlAsctId, eno)`, `Bmqnam.qtnId`, `Bpqnam.qtnId`
- Produces: JPA가 식별자로 쓰는 컬럼 조합이 DB에서도 유일하다는 후보키 계약

- [ ] **Step 1: 물리 PK를 바꾸지 않는 후보키 방식을 고정한다**

다음 이유로 `@IdClass` 확장 대신 DB UNIQUE 후보키를 사용한다.

- `Cappla.apfSno`는 전역 Oracle 시퀀스로 생성된다.
- `Bcmmtm.changeType()`은 위원유형을 식별자가 아닌 변경 가능한 속성으로 취급한다.
- `Bmqnam.qtnId`, `Bpqnam.qtnId`는 협의회 ID를 포함하는 전역 형식이다.
- Repository ID 타입과 기존 호출 계약을 바꾸지 않아 회귀 범위를 줄인다.

**후보키의 적용 범위는 테이블마다 다르다.** 전 행 UNIQUE로 충분한 테이블과, 소프트 삭제 행을 제외해야만 하는 테이블을 구분한다.

| 테이블 | 후보키 | 범위 | 근거 |
| --- | --- | --- | --- |
| `TPRMPP_CAPPLA` | `APF_SNO` | 전 행 | 전역 시퀀스 `SQ_TPRMPP_CAPPLA_1` 채번이라 삭제 행과도 값이 겹치지 않는다 |
| `TPRMPP_BMQNAM` | `QTN_ID` | 전 행 | `MainQnaRepository.getNextQtnSeq`가 `COUNT(*)+1`을 **삭제 행 포함**으로 계산해 ID를 재사용하지 않는다 |
| `TPRMPP_BPQNAM` | `QTN_ID` | 전 행 | `QnaRepository.getNextQtnSeq`가 같은 이유로 재사용하지 않는다 |
| `TPRMPP_BCMMTM` | `(IT_PTL_ASCT_ID, ENO)` | **`DEL_YN='N'` 행만** | 아래 참조 |

`TPRMPP_BCMMTM`에 전 행 UNIQUE를 걸면 **정상 업무 흐름이 깨진다.** 물리 PK는 `(IT_PTL_ASCT_ID, IT_PTL_ASCT_MEB_TC, ENO)`이고 `CommitteeService.saveCommittee`는 요청에서 빠진 위원을 소프트 삭제해 행을 남긴다. 재등록 시 기존 위원 인덱싱은 `findByItPtlAsctIdAndDelYn(asctId, "N")` 결과만 사용하므로 삭제 행은 보이지 않고, **다른 위원유형으로 재등록하면** 새 PK 행이 insert되어 삭제 행과 함께 `(ASCT_ID, ENO)`가 중복된다. 즉 전 행 UNIQUE는 (a) 기존 데이터에서 Step 2 가드를 발동시켜 마이그레이션 전체를 중단시키고, (b) 인덱스가 만들어져도 위 흐름을 런타임 `ORA-00001`로 실패시킨다. 같은 메서드가 활성 행 인덱싱에서 `(a, b) -> a` 병합을 쓰는 것도 활성 행 eno 중복 가능성을 이미 전제한 것이다.

따라서 BCMMTM만 Task 3과 동일한 함수 기반 부분 UNIQUE로 처리하고, 가드 쿼리에도 같은 `DEL_YN='N'` 조건을 적용한다.

`BMQNAM`/`BPQNAM`의 전 행 UNIQUE는 **채번이 삭제 행을 포함해 세는 현재 구현에 의존한다.** 채번을 활성 행 기준으로 바꾸면 ID가 재사용되어 이 인덱스가 깨지므로, Step 4의 JavaDoc에 이 의존 관계를 함께 기록한다.

- [ ] **Step 2: 중복 후보키 사전 가드를 마이그레이션에 작성한다**

아래 네 쿼리 중 하나라도 행을 반환하면 `RAISE_APPLICATION_ERROR`로 중단한다.

```sql
SELECT APF_SNO FROM ITPOWN.TPRMPP_CAPPLA GROUP BY APF_SNO HAVING COUNT(*) > 1;
SELECT IT_PTL_ASCT_ID, ENO FROM ITPOWN.TPRMPP_BCMMTM
 WHERE DEL_YN = 'N'
 GROUP BY IT_PTL_ASCT_ID, ENO HAVING COUNT(*) > 1;
SELECT QTN_ID FROM ITPOWN.TPRMPP_BMQNAM GROUP BY QTN_ID HAVING COUNT(*) > 1;
SELECT QTN_ID FROM ITPOWN.TPRMPP_BPQNAM GROUP BY QTN_ID HAVING COUNT(*) > 1;
```

BCMMTM 가드에 `DEL_YN='N'`이 반드시 들어가야 한다. 이 조건이 없으면 소프트 삭제 이력과 활성 행이 함께 잡혀, 실제로는 부분 UNIQUE를 위반하지 않는 정상 데이터에서 마이그레이션이 중단된다.

이 작업에서는 후보키 중복을 자동 병합하지 않는다. 활성 BCMMTM 중복은 같은 사람이 서로 다른 위원유형으로 동시에 등록된 상태라는 업무 의미가 있어 소유자 확인 없이 삭제/변경할 수 없다.

- [ ] **Step 2-1: 영향 건수를 사전 리포트에 추가한다**

Task 3에서 만든 `it_database/tools/preflight-20260729.sql`에 위 네 쿼리를 그대로 추가한다(BCMMTM은 `DEL_YN='N'` 조건 포함). dev/prod 적용 전 DBA가 이 리포트로 중단 여부를 미리 판정할 수 있어야 하며, 결과가 비어 있지 않으면 Task 14의 완료 이관 대상에서 BE-25를 제외한다.

- [ ] **Step 3: UNIQUE 인덱스를 추가한다**

`ALL_INDEXES` 존재 가드 후 아래 인덱스를 생성한다.

```sql
CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_CAPPLA_02
    ON ITPOWN.TPRMPP_CAPPLA (APF_SNO);

-- 소프트 삭제 이력을 제외한 활성 위원만 단일화한다(Step 1 근거 참조).
CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BCMMTM_02
    ON ITPOWN.TPRMPP_BCMMTM
       (CASE WHEN DEL_YN = 'N' THEN IT_PTL_ASCT_ID END,
        CASE WHEN DEL_YN = 'N' THEN ENO END);

CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BMQNAM_01
    ON ITPOWN.TPRMPP_BMQNAM (QTN_ID);
CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BPQNAM_01
    ON ITPOWN.TPRMPP_BPQNAM (QTN_ID);
```

BCMMTM 인덱스는 두 CASE 식을 함께 써야 한다. 삭제 행은 두 키 컬럼이 모두 NULL이 되어 Oracle B-tree에 저장되지 않으므로 여러 이력 행이 공존하고, 활성 행만 `(ASCT_ID, ENO)`로 단일화된다.

- [ ] **Step 4: 엔티티 JavaDoc을 후보키 계약으로 현행화한다**

`물리 PK 일부만 @Id`라는 설명을 숨기지 말고, 각 엔티티에 물리 PK와 앱 후보키를 함께 기록한다. 예:

```java
/**
 * 앱 식별자: {@code APF_SNO}. 물리 PK는 ({@code APF_DCM_NO}, {@code APF_SNO})이며,
 * DB UNIQUE 인덱스가 APF_SNO 단독 후보키를 보장한다.
 */
```

`Bcmmtm`에는 후보키가 **활성 행 한정**이라는 사실과 그 이유를 함께 남긴다.

```java
/**
 * 앱 식별자: ({@code IT_PTL_ASCT_ID}, {@code ENO}). 물리 PK는
 * ({@code IT_PTL_ASCT_ID}, {@code IT_PTL_ASCT_MEB_TC}, {@code ENO})이며,
 * DB 함수 기반 UNIQUE 인덱스가 {@code DEL_YN='N'}인 행에 한해 후보키 단일성을 보장한다.
 * 소프트 삭제 이력은 같은 (협의회, 사번)으로 여러 건 남을 수 있으므로 전 행 UNIQUE가 아니다.
 */
```

`Bmqnam`/`Bpqnam`에는 전 행 UNIQUE가 채번 구현에 의존한다는 점을 남긴다.

```java
/**
 * 앱 식별자: {@code QTN_ID}. 물리 PK는 ({@code IT_PTL_ASCT_ID}, {@code QTN_ID})이며,
 * DB UNIQUE 인덱스가 QTN_ID 단독 후보키를 보장한다.
 * 이 전 행 UNIQUE는 순번 채번이 삭제 행을 포함해 세어 ID를 재사용하지 않는다는 전제에 의존한다.
 * 채번을 활성 행 기준으로 바꾸면 이 제약이 깨진다.
 */
```

- [ ] **Step 5: Oracle 통합 테스트를 작성하고 RED를 확인한다**

Task 3·5와 같은 순서로, **마이그레이션 적용 전에** 제약 부재를 먼저 증명한다. 테스트 클래스는 `AbstractOracleRepositoryTest`를 상속하고 `@Autowired JdbcTemplate jdbc`를 선언한다.

검증 케이스는 다음 여섯 개다.

1. `CAPPLA`: 같은 `APF_SNO`를 `APF_DCM_NO`만 다르게 두 번 insert → 거부
2. `BCMMTM`: 같은 `(ASCT_ID, ENO)`를 `IT_PTL_ASCT_MEB_TC`만 다르게 **둘 다 `DEL_YN='N'`으로** insert → 거부
3. `BMQNAM`: 같은 `QTN_ID`를 `IT_PTL_ASCT_ID`만 다르게 두 번 insert → 거부
4. `BPQNAM`: 위와 동일 → 거부
5. **BCMMTM 소프트 삭제 회귀**: 같은 `(ASCT_ID, ENO)`로 `DEL_YN='Y'` 행과 `DEL_YN='N'` 행을 insert → **허용**되어야 한다. 이 케이스가 부분 UNIQUE를 전 행 UNIQUE로 잘못 만드는 회귀를 잡는다.
6. 정상 후보키 두 건의 `findById`·수정·삭제가 서로 격리됨

Run:

```powershell
cd C:\it\it_backend
.\gradlew integrationTest --tests "*ApplicationIdentityKeyIt"
```

Expected: 1~4번이 두 번째 insert 성공으로 FAIL. 5·6번은 제약이 없으므로 이미 PASS.

- [ ] **Step 6: 마이그레이션을 적용하고 GREEN을 확인한다**

```powershell
cd C:\it\it_backend
$env:SPRING_PROFILES_ACTIVE = 'local-ext'
.\gradlew bootRun
```

Expected: 로그에 `V20260729.002` 적용 성공이 보인다. 기동 완료 후 `Ctrl+C`로 종료한다. 가드가 발동해 기동이 실패하면 Step 2-1의 리포트로 중복 데이터를 확인하고, 소유자 판단 전까지 이 Task를 진행하지 않는다.

Run:

```powershell
cd C:\it\it_backend
.\gradlew integrationTest --tests "*ApplicationIdentityKeyIt" --tests "*CommitteeServiceTest" --tests "*QnaServiceTest" --tests "*MainQnaServiceTest"
```

Expected: 6개 케이스 전부 PASS. 특히 5번이 PASS해야 위원 소프트 삭제 후 다른 위원유형 재등록 흐름이 살아 있다.

- [ ] **Step 7: 저장소별 커밋**

```powershell
git -C C:\it\it_database add migrations/V20260729_002__EnforceApplicationIdentityKeys.sql tools/preflight-20260729.sql
git -C C:\it\it_database commit -m "fix(db): JPA 식별자 후보키 유일성 보장"

git -C C:\it\it_backend add src/main/java/com/kdb/it/common/approval/entity/Cappla.java src/main/java/com/kdb/it/domain/council/entity/Bcmmtm.java src/main/java/com/kdb/it/domain/council/entity/Bmqnam.java src/main/java/com/kdb/it/domain/council/entity/Bpqnam.java src/test/java/com/kdb/it/domain/persistence/ApplicationIdentityKeyIt.java
git -C C:\it\it_backend commit -m "test: 앱 식별자와 DB 후보키 계약 검증"
```

---

### Task 5: BE-20 알림 발송 상태 DB 기본값 정합화

**Files:**
- Create: `it_database/migrations/V20260729_003__AlignNotificationDispatchDefault.sql`
- Modify: `it_database/tools/preflight-20260729.sql` (Task 3에서 생성)
- Create: `it_backend/src/test/java/com/kdb/it/common/notification/repository/NotificationDispatchDefaultIt.java`

**Interfaces:**
- Consumes: 앱 코드셋 `01=PENDING`, `02=SENT`, `03=FAILED`
- Produces: DB 생략 insert도 앱 코드셋 안의 `01`을 생성하는 계약

- [ ] **Step 1: 운영 결정 기준을 고정한다**

`10`은 `Cinfmm`과 재시도 쿼리 어느 곳에서도 해석되지 않으므로 유지하지 않는다. DB 기본값을 `01`로 맞추고, 기존 `10` 행은 발송 완료로 간주하지 않고 `01`로 바꾼다. 적용 전 DBA가 `10` 행 수와 `SD_DTM` 값을 확인해 이미 발송된 흔적이 있는 행은 별도 목록으로 보존한다.

**이 변경은 앞선 두 결정을 덮어쓴다는 사실을 결정 근거에 명시한다.**

| 스크립트 | `INFM_SD_STS_C` DEFAULT | 의도 |
| --- | --- | --- |
| `V20260719_002` | `'02'` | 컬럼 신설 시 기존 행을 발송 완료로 간주 |
| `V20260724_002` | `'10'` | 운영 스키마와의 DEFAULT 정렬(backfill 값만 앱 코드셋 `'01'` 사용) |
| `V20260729_003` (이 Task) | `'01'` | 앱 코드셋 안의 도달 가능한 값으로 확정 |

`V20260724_002`의 `'10'`은 실수가 아니라 운영 정렬을 위한 의도적 선택이었으므로, 이 Task는 "운영 정렬보다 앱 코드셋 정합을 우선한다"는 판단 변경임을 마이그레이션 주석과 `TASK_DONE.md` 근거에 남긴다. Task 2의 DBA 인계 문서에는 두 스크립트를 같은 창에서 연속 적용하고 최종 DEFAULT가 `'01'`임을 기재한다.

부수 효과도 함께 기록한다. `Cinfmm.canRetry()`는 `DISPATCH_SENT`가 아닌 모든 상태를 재시도 대상으로 보므로, DEFAULT가 `'01'`이면 앱 밖에서 상태를 생략하고 삽입된 행이 재발송 대상이 된다. 현재 DEFAULT `'10'`도 동일하게 재시도 대상이라 새로 생기는 위험은 아니지만, `V20260719_002`의 `'02'`와 비교하면 동작이 다르다.

- [ ] **Step 1-1: 영향 건수를 사전 리포트에 추가한다**

`it_database/tools/preflight-20260729.sql`에 아래 쿼리를 추가한다. `SENT_LIKE_CNT`가 0이 아니면 Step 2의 가드가 마이그레이션을 중단시키므로, dev/prod 적용 전에 DBA가 미리 판정할 수 있어야 한다.

```sql
-- BE-20: 앱 코드셋 밖 상태값 분포와 발송 흔적 유무
SELECT INFM_SD_STS_C,
       COUNT(*)                                        AS CNT,
       COUNT(CASE WHEN SD_DTM IS NOT NULL THEN 1 END)  AS SENT_LIKE_CNT
  FROM ITPOWN.TPRMPP_CINFMM
 GROUP BY INFM_SD_STS_C
 ORDER BY INFM_SD_STS_C;
```

- [ ] **Step 2: 마이그레이션을 작성한다**

마이그레이션 첫 줄 주석에 Step 1의 결정 표(`'02'` → `'10'` → `'01'`)와 "운영 정렬보다 앱 코드셋 정합을 우선한다"는 판단을 요약해 남긴다.

```sql
DECLARE
    v_sent_like_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_sent_like_count
      FROM ITPOWN.TPRMPP_CINFMM
     WHERE INFM_SD_STS_C = '10'
       AND SD_DTM IS NOT NULL;

    IF v_sent_like_count > 0 THEN
        RAISE_APPLICATION_ERROR(
            -20031,
            'INFM_SD_STS_C=10 이면서 SD_DTM이 있는 행이 존재합니다. 발송 여부를 확인한 뒤 02 또는 01로 보정하세요.'
        );
    END IF;
END;
/

UPDATE ITPOWN.TPRMPP_CINFMM
   SET INFM_SD_STS_C = '01'
 WHERE INFM_SD_STS_C = '10';

ALTER TABLE ITPOWN.TPRMPP_CINFMM
    MODIFY (INFM_SD_STS_C DEFAULT '01');

COMMIT;
```

- [ ] **Step 3: DB 기본값 통합 테스트를 작성한다**

필수 컬럼만 native insert하면서 `INFM_SD_STS_C`를 생략하고 조회 결과가 `Cinfmm.DISPATCH_PENDING`인지 검증한다.

```java
@Test
void 상태생략insert는발송대기기본값을사용한다() {
    String id = "BE20-" + UUID.randomUUID().toString().substring(0, 8);
    jdbc.update(
            "INSERT INTO TPRMPP_CINFMM "
                    + "(INFM_MSG_NO,IT_PTL_INFM_SVC_TC,TTL,RMS_ENO,INQ_YN) "
                    + "VALUES (?,'02','BE20 기본값 검증','BE20-USER','N')",
            id);

    String status =
            jdbc.queryForObject(
                    "SELECT INFM_SD_STS_C FROM TPRMPP_CINFMM WHERE INFM_MSG_NO = ?",
                    String.class,
                    id);

    assertThat(status).isEqualTo(Cinfmm.DISPATCH_PENDING);
}
```

마이그레이션 적용 전 이 테스트를 실행해 실제 값 `10`으로 FAIL하는 것을 확인한다.

Run:

```powershell
cd C:\it\it_backend
.\gradlew integrationTest --tests "*NotificationDispatchDefaultIt"
```

Expected before migration: 조회값이 `10`이므로 FAIL.

- [ ] **Step 4: 로컬 Oracle에 신규 마이그레이션을 적용하고 GREEN을 재실행한다**

```powershell
cd C:\it\it_backend
$env:SPRING_PROFILES_ACTIVE = 'local-ext'
.\gradlew bootRun
```

Expected: 로그에 `V20260729.003` 적용 성공이 보인다. 기동 완료 후 `Ctrl+C`로 종료한 다음 Step 3의 통합 테스트를 다시 실행해 PASS를 확인한다.

- [ ] **Step 5: 저장소별 커밋**

```powershell
git -C C:\it\it_database add migrations/V20260729_003__AlignNotificationDispatchDefault.sql tools/preflight-20260729.sql
git -C C:\it\it_database commit -m "fix(db): 알림 발송 상태 기본값을 대기 코드로 정렬"

git -C C:\it\it_backend add src/test/java/com/kdb/it/common/notification/repository/NotificationDispatchDefaultIt.java
git -C C:\it\it_backend commit -m "test: 알림 발송 상태 DB 기본값 검증"
```

---

### Task 6: BE-28 AdminService 공통코드 캐시 무효화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminServiceCacheEvictTest.java`

**Interfaces:**
- Consumes: `codesByCid`, `budgetPeriod` Caffeine 캐시
- Produces: 관리자 공통코드 쓰기 성공 커밋 후 두 캐시 전체 무효화

- [ ] **Step 1: 실제 캐시 프록시 RED 테스트를 작성한다**

`ProjectServiceCacheEvictTest` 패턴을 따라 `CacheConfig`, `AdminService`만 띄우고 저장소는 `@MockitoBean`으로 대체한다. `createCode`, 동일키 `updateCode`, 키변경 `updateCode`, `deleteCode`, `bulkUpsertCodes` 각각 두 캐시의 임의 키가 제거되는지 검증한다.

- [ ] **Step 2: RED를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*AdminServiceCacheEvictTest"
```

Expected: 현재는 캐시 엔트리가 남아 FAIL.

- [ ] **Step 3: 네 쓰기 메서드에 동일 무효화 계약을 적용한다**

```java
@Caching(
        evict = {
            @CacheEvict(value = "budgetPeriod", allEntries = true),
            @CacheEvict(value = "codesByCid", allEntries = true)
        })
```

`createCode`, `updateCode`, `deleteCode`, `bulkUpsertCodes`의 기존 `@Transactional`과 함께 사용한다. 정상 반환한 쓰기만 두 캐시를 비우고, 예외로 끝난 쓰기는 기존 캐시를 유지해야 한다.

캐시 테스트 컨텍스트에 트랜잭션 매니저를 추가하지 않는 경우에는 “협력 저장소가 예외를 던져 메서드가 정상 반환하지 않으면 `@CacheEvict`가 발화하지 않는다”로 실패 경로를 검증한다. 커밋 후 지연 자체는 기존 `CacheConfigTest`의 책임으로 둔다.

- [ ] **Step 4: GREEN과 회귀 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*AdminServiceCacheEvictTest" --tests "*AdminServiceTest" --tests "*CodeServiceTest"
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/common/admin/service/AdminService.java src/test/java/com/kdb/it/common/admin/service/AdminServiceCacheEvictTest.java
git -C C:\it\it_backend commit -m "fix: 관리자 공통코드 쓰기 캐시 무효화"
```

---

### Task 7: BE-19 생성 요청 사업구분 검증

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/project/controller/ProjectControllerTest.java`

**Interfaces:**
- Consumes: `POST /api/projects` JSON의 `abusTc`
- Produces: 누락/null/공백은 400, 명시적 `"0"`은 허용

- [ ] **Step 1: Controller RED 테스트를 작성한다**

성공 요청에는 `.abusTc("0")`을 추가하고 아래 두 테스트를 작성한다.

```java
@Test
@WithMockUser(username = "10001")
void createProject_사업구분누락_400() throws Exception {
    var request = ProjectDto.CreateRequest.builder().abusNm("신규 사업").build();

    mockMvc.perform(post("/api/projects")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());

    verifyNoInteractions(projectService);
}

@Test
@WithMockUser(username = "10001")
void createProject_사업구분공백_400() throws Exception {
    var request = ProjectDto.CreateRequest.builder().abusNm("신규 사업").abusTc(" ").build();

    mockMvc.perform(post("/api/projects")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());

    verifyNoInteractions(projectService);
}
```

- [ ] **Step 2: RED를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*ProjectControllerTest"
```

Expected: 누락/공백 요청이 현재 201이어서 FAIL.

- [ ] **Step 3: DTO 검증을 적용한다**

```java
/** 사업구분 ('신규', '계속', '0'=해당없음) */
@NotBlank(message = "사업구분은 필수입니다.")
@Schema(description = "사업구분", requiredMode = Schema.RequiredMode.REQUIRED)
private String abusTc;
```

`toEntity()`의 `CodeDefaults.orNotApplicable(abusTc)`는 명시적 `"0"`과 내부 호출 호환을 위해 유지한다. Controller 입력 누락만 `@Valid`가 차단한다.

- [ ] **Step 4: GREEN을 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*ProjectControllerTest" --tests "*ProjectServiceTest" --tests "*ProjectServiceCoverageTest"
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java src/test/java/com/kdb/it/domain/budget/project/controller/ProjectControllerTest.java
git -C C:\it\it_backend commit -m "fix: 정보화사업 생성 시 사업구분 필수 검증"
```

---

### Task 8: BE-29 getSummary 대표행 결정론화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`

**Interfaces:**
- Consumes: `BudgetRepresentativeSelector.pick(List<Bbugtm>)`
- Produces: 같은 표시명 그룹의 대표 `ioeC`와 편성률이 최신 `bgNo`, 동률 시 최대 `sno` 행에서 함께 선택됨

- [ ] **Step 1: 입력 순서 반전 RED 테스트를 작성한다**

같은 표시명에 속하는 `ioeC=101` 구 실행(`BG-2026-0001`, `asgRt=80`)과 `ioeC=102` 신 실행(`BG-2026-0002`, `asgRt=50`)을 만든다. 리스트 순서를 두 번 뒤집어 호출해도 응답의 `ioeC=102`, `dupRt=50`이 같아야 한다.

**대표 코드는 파생 필드 두 개의 조회 키이기도 하다.** `representativeIoeC`는 `cdvaToCapital.get(...)`(자본예산 여부)과 `cdvaToGroupName.get(...)`(품목그룹명)의 키로 재사용되므로, 대표 선정 방식이 바뀌면 `capital`과 `itemGroupName`도 함께 바뀔 수 있다. 이 변경은 결정론화를 넘어선 동작 변경이므로 테스트가 네 필드를 모두 단언한다.

- `ioeC` — 대표 편성행의 비목코드
- `dupRt` — 같은 대표 편성행의 편성률
- `capital` — 대표 코드 기준 자본예산 여부
- `itemGroupName` — 대표 코드 기준 품목그룹명

`101`과 `102`에 서로 다른 자본예산 구분과 그룹명을 주어, 두 필드가 대표 편성행(`102`) 기준으로 결정되고 입력 순서에 무관함을 확인한다.

- [ ] **Step 2: RED를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*BudgetWorkServiceTest*대표표시명*"
```

Expected: 현재 `ioeCodes.get(0)`과 `findFirst()` 때문에 한 순서에서 FAIL.

- [ ] **Step 3: 대표 예산행을 한 번만 선택해 두 필드에 사용한다**

```java
Bbugtm representativeBudget =
        allRecords.isEmpty() ? null : BudgetRepresentativeSelector.pick(allRecords);
String representativeIoeC =
        representativeBudget != null
                ? representativeBudget.getIoeC()
                : ioeCodes.stream().min(String::compareTo).orElseThrow();
Integer dupRt = representativeBudget != null ? representativeBudget.getAsgRt() : null;
```

예산행이 없는 공통코드 전용 그룹은 문자열 최소 코드로 결정적 폴백한다.

`capital`·`itemGroupName` 산출 코드는 그대로 두고 `representativeIoeC` 하나만 바꾼다. 두 필드가 새 대표 코드를 따라가는 것이 의도된 동작이며, Step 1의 네 필드 단언이 그 결과를 고정한다.

- [ ] **Step 4: GREEN과 예산작업 회귀 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*BudgetWorkServiceTest" --tests "*BudgetRepresentativeSelectorTest"
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java
git -C C:\it\it_backend commit -m "fix: 예산 요약 표시명 그룹 대표행 결정론화"
```

---

### Task 9: BE-03 BBUGTM·ProjectKeyView·알림함 읽기 프로젝션

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BudgetReadView.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetRepresentativeSelector.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/repository/NotificationInboxRow.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/dto/NotificationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/controller/NotificationController.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/work/repository/BudgetReadProjectionIt.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/notification/repository/NotificationInboxProjectionIt.java`

**Interfaces:**
- Consumes: BE-17 대표행 정책과 Task 8의 표시명 대표행 정책
- Produces: 쓰기/Dirty Checking 경로는 엔티티를 유지하고 조회 응답 경로만 최소 필드 사용

- [ ] **Step 1: 최소 필드 인터페이스를 정의한다**

```java
public interface BudgetReadView {
    String getBgNo();
    Integer getSno();
    String getPkColNm();
    String getFntTbNm();
    String getIoeC();
    BigDecimal getBgDupAmt();
    Integer getAsgRt();
}
```

`ProjectKeyView`는 **저장소에 아직 존재하지 않는 신규 타입**이다(TASK.md BE-03 잔여 ③이 "재계획" 대상으로 남겨 둔 항목). `ProjectRepository` 안의 중첩 인터페이스로 새로 정의하고, 조회 메서드도 함께 추가한다.

```java
/** 사업명 배치 조회용 최소 필드. */
interface ProjectKeyView {
    String getAbusMngNo();
    String getAbusNm();
}

List<ProjectKeyView> findKeyViewsByAbusMngNoInAndLstYnAndDelYn(
        Collection<String> abusMngNos, String lstYn, String delYn);
```

`BudgetReadView`는 `BbugtmRepository`와 같은 패키지의 별도 파일로 만든다. 기존 `findByBseYyAndDelYn(String, String)`이 이미 있으므로, 파생 메서드 이름 규칙상 `findReadViewsBy...` 변형이 그대로 성립한다.

- [ ] **Step 2: 프로젝션 동등성 RED 테스트를 작성한다**

`BudgetReadProjectionIt`는 7개 필드에 서로 구별되는 값을 넣고 엔티티 조회와 프로젝션 결과를 비교한다. `NotificationInboxProjectionIt`는 `NotificationDto.Item`의 8개 필드와 페이지 total/순서를 기존 조회와 비교한다.

- [ ] **Step 3: RED를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew integrationTest --tests "*BudgetReadProjectionIt" --tests "*NotificationInboxProjectionIt"
```

Expected: 신규 메서드/타입 부재로 컴파일 FAIL.

- [ ] **Step 4: BBUGTM 읽기 메서드와 대표행 선택기를 추가한다**

`BbugtmRepository`에 다음 메서드를 추가한다.

```java
List<BudgetReadView> findReadViewsByBseYyAndDelYn(String bseYy, String delYn);
```

`BudgetRepresentativeSelector.pickView(List<BudgetReadView>)`는 기존 `pick(List<Bbugtm>)`과 같은 `bgNo DESC, sno DESC` 규칙을 사용한다. Java erasure 충돌을 피하기 위해 이름을 `pickView`로 고정한다.

- [ ] **Step 5: BudgetWorkService의 세 조회 경로만 프로젝션으로 바꾼다**

`getIoeCategories`, `getSummary`, `getProjectSummary`는 같은 `List<BudgetReadView>` snapshot에서 집계와 대표행을 모두 계산한다. 읽기 헬퍼인 `filterByApprovedSource`, `computeMplAdjustment`와 내부의 `Map<String,List<...>>`도 `BudgetReadView`로 바꾸고 대표 선택에는 `pickView`를 사용한다. 실제 엔티티를 생성·갱신하는 `applyRates`, `applyItemRates` 및 그 내부 조회는 `Bbugtm` 경로를 유지한다.

사업명 배치는 `findKeyViewsByAbusMngNoInAndLstYnAndDelYn(prjGroupNos, "Y", "N")` 결과로 `Map<String,String>`을 만들고, 누락 시 기존 관리번호 폴백을 유지한다.

- [ ] **Step 6: 알림함은 이미 분리된 응답 계약을 프로젝션에 연결한다**

`NotificationInboxRow`를 다음 record로 정의한다.

```java
public record NotificationInboxRow(
        String infmMsgNo,
        String itPtlInfmSvcTc,
        String ttl,
        String infmMsgCone,
        String infmRcdUrl,
        String inqYn,
        LocalDateTime inqDtm,
        LocalDateTime fstEnrDtm) {}
```

`findInboxRows`는 기존 WHERE, `fstEnrDtm DESC`, offset/limit, count 쿼리를 그대로 유지한다. `NotificationDto.Item.fromProjection(NotificationInboxRow)`를 추가하고 Service가 `Page<NotificationDto.Item>`을 반환하게 하며 Controller의 `.map(Item::fromEntity)`를 제거한다. JSON 필드명과 페이지 envelope는 바꾸지 않는다.

- [ ] **Step 7: GREEN과 회귀 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*BudgetWorkServiceTest" --tests "*NotificationServiceTest" --tests "*NotificationControllerTest"
.\gradlew integrationTest --tests "*BudgetReadProjectionIt" --tests "*NotificationInboxProjectionIt"
```

Expected: 단위·Oracle 통합 테스트 PASS, 기존 응답 JSON 동등.

- [ ] **Step 8: 커밋을 도메인별로 분리한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/work src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java src/test/java/com/kdb/it/domain/budget/work
git -C C:\it\it_backend commit -m "perf: 예산 요약과 사업명 배치 조회 프로젝션 적용"

git -C C:\it\it_backend add src/main/java/com/kdb/it/common/notification src/test/java/com/kdb/it/common/notification
git -C C:\it\it_backend commit -m "perf: 알림함 응답 조회 프로젝션 적용"
```

---

### Task 10: BE-03 Project/Cost 목록 계약 관측과 추가형 API

**Files:**
- Create: `docs/superpowers/reports/2026-08-be03-production-observation.md`
- Modify after gate: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java`
- Modify after gate: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Modify after gate: `it_backend/src/main/java/com/kdb/it/domain/budget/project/controller/ProjectController.java`
- Modify after gate: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/dto/CostDto.java`
- Modify after gate: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- Modify after gate: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java`
- Test after gate: corresponding Controller/Service/Repository tests

**Interfaces:**
- Consumes: 기존 `searchListByCondition` 경량 행과 운영 AWR/호출량
- Produces: 기존 wide API를 깨지 않는 `/api/projects/list`, `/api/costs/list` 추가형 계약

- [ ] **Step 1: 배포 후 14일 관측 자료를 수집한다**

보고서에 다음 값을 날짜별로 기록한다.

- `/api/projects`, `/api/costs`, `/api/notifications` 호출 수와 p50/p95
- 연관 SQL의 executions, elapsed time, buffer gets, rows processed
- 응답 크기 p50/p95
- 오류율과 타임아웃 수

관측 기간은 BE-03 1차가 배포된 다음 날 00:00부터 연속 14일이다.

- [ ] **Step 2: 계약 분리 착수 기준을 적용한다**

Project/Cost 각각 아래 중 하나를 만족하면 추가형 목록 API를 구현한다.

- 일평균 호출 100회 이상
- p95 300ms 초과
- 평균 응답 100KB 초과
- 연관 SQL이 AWR DB time 상위 20개에 포함

아무 기준도 만족하지 않으면 보고서에 `DEFER`와 재관측 트리거(호출량 2배 또는 p95 300ms 초과)를 기록하고 BE-03의 해당 하위 항목만 조건부 과제로 남긴다.

- [ ] **Step 3: 착수 시 기존 경량 행을 응답 계약으로 승격한다**

기존 `GET /api/projects`, `GET /api/costs`는 유지한다. 신규 경로만 각각 `ProjectDto.ListResponse`, `CostDto.ListResponse`를 반환하고 내부에서 이미 존재하는 `searchListByCondition`을 사용한다. 상세는 기존 `/{id}` API를 사용한다.

- [ ] **Step 4: 프론트 소비자 전환용 별도 계획을 작성한다**

다음 소비자를 전수 검색해 새 목록 타입에 필요한 필드를 확정한다.

```powershell
rg -n '/api/projects|/api/costs' C:\it\it_frontend\app C:\it\it_frontend\tests
```

프론트 전환 완료 전 기존 wide 경로를 제거하거나 반환 타입을 바꾸지 않는다.

- [ ] **Step 5: 백엔드 추가형 계약을 검증한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*ProjectControllerTest" --tests "*ProjectServiceTest" --tests "*ProjectRepositoryImplTest" --tests "*CostControllerTest" --tests "*CostServiceTest" --tests "*CostRepositoryImplTest"
```

Expected: 기존 wide 경로와 신규 list 경로 모두 PASS.

- [ ] **Step 6: 관측 보고서와 조건 충족 시 구현을 커밋한다**

```powershell
git -C C:\it add docs/superpowers/reports/2026-08-be03-production-observation.md
git -C C:\it commit -m "docs: BE-03 운영 성능 관측 결과 기록"

git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/project src/test/java/com/kdb/it/domain/budget/project src/main/java/com/kdb/it/domain/budget/cost src/test/java/com/kdb/it/domain/budget/cost
git -C C:\it\it_backend commit -m "feat: 정보화사업과 전산업무비 경량 목록 API 추가"
```

관측 결과가 `DEFER`이면 두 번째 백엔드 커밋은 만들지 않는다.

---

### Task 11: BE-18 구 검토자 경로 조건부 제거

**Files:**
- Modify after gate: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ReviewerController.java`
- Modify after gate: `it_backend/src/test/java/com/kdb/it/domain/budget/document/controller/ReviewerControllerTest.java`

**Interfaces:**
- Consumes: 전역 `/api/reviews/reviewers` 운영 1릴리스 배포와 14일 WARN 0건 증거
- Produces: 구 `/{docMngNo}/reviewers` 경로 제거

- [ ] **Step 1: 제거 게이트를 증빙한다**

릴리스 번호, 배포 시각, 조회한 로그 기간, WARN 검색식, 결과 0건을 `TASK.md` BE-18 근거에 기록한다. 기간이 14일 미만이거나 한 건이라도 호출되면 코드 변경을 중단한다.

- [ ] **Step 2: 게이트 충족 후 호환 테스트를 먼저 제거한다**

`ReviewerControllerTest.getReviewers_구경로호환_200`을 삭제하고 새 테스트를 추가한다.

```java
@Test
@WithMockUser(username = "10001")
void getReviewers_구경로제거_404() throws Exception {
    mockMvc.perform(get("/api/reviews/" + DOC_ID + "/reviewers"))
            .andExpect(status().isNotFound());
}
```

- [ ] **Step 3: legacy 메서드와 불필요 import를 제거한다**

`getReviewersLegacy`, `@Slf4j`, `PathVariable`을 제거하고 전역 경로만 유지한다.

- [ ] **Step 4: 테스트와 커밋**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*ReviewerControllerTest" --tests "*ReviewerServiceTest"
git add src/main/java/com/kdb/it/domain/budget/document/controller/ReviewerController.java src/test/java/com/kdb/it/domain/budget/document/controller/ReviewerControllerTest.java
git commit -m "refactor: 구 검토자 API 호환 경로 제거"
```

---

### Task 12: BE-21 결재유형 정책 결정 게이트

**Files:**
- Modify after decision: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cdecim.java`
- Modify after decision: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`
- Modify after decision: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java`
- Create: `docs/decisions/2026-08-cdecim-decision-type.md`

**Interfaces:**
- Consumes: 공통코드 `10=요청`, `20=검토`, `50=결재`와 실제 결재선 업무 의미
- Produces: `DCD_TP_C`가 단순 기본값인지 결재선 역할인지 명시된 정책

- [ ] **Step 1: 업무 소유자에게 한 가지 질문으로 정책을 확정한다**

질문: “CDECIM의 각 행은 모두 ‘요청(10)’인가, 중간 결재자는 ‘검토(20)’이고 최종 결재자는 ‘결재(50)’인가?”

- [ ] **Step 2: 결정 문서를 작성한다**

현재 읽기 소비자가 없다는 사실, 기존 데이터 분포, 선택한 의미, 신규 행 적용 시점, 과거 행 backfill 여부를 기록한다.

- [ ] **Step 3A: ‘모두 요청’ 결정이면 현재 동작을 계약으로 고정한다**

기존 `DECISION_TYPE_REQUEST`와 테스트를 유지하고, JavaDoc에 “결재선 역할이 아니라 신청 건의 유형”임을 명시한다. BE-21을 정책 확정 완료로 이관한다.

- [ ] **Step 3B: ‘중간 검토/최종 결재’ 결정이면 생성 규칙을 변경한다**

```java
public static final String DECISION_TYPE_REQUEST = "10";
public static final String DECISION_TYPE_REVIEW = "20";
public static final String DECISION_TYPE_APPROVAL = "50";
```

`ApplicationService.submit`에서 마지막 행은 `50`, 나머지는 `20`으로 저장한다. 기안자는 CDECIM 행이 아니므로 `10`을 자동 생성하지 않는다. 과거 행은 업무 소유자가 소급 의미를 승인한 경우에만 새 Flyway 마이그레이션으로 보정한다.

- [ ] **Step 4: 선택한 경로만 테스트하고 커밋한다**

Run:

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*ApplicationServiceTest" --tests "*ApplicationServiceRecallTest"
```

Expected: 선택한 정책의 순번별 `dcdTpC` 단언 PASS.

```powershell
git -C C:\it add docs/decisions/2026-08-cdecim-decision-type.md
git -C C:\it commit -m "docs: 결재유형코드 업무 의미 결정"

git -C C:\it\it_backend add src/main/java/com/kdb/it/common/approval/entity/Cdecim.java src/main/java/com/kdb/it/common/approval/service/ApplicationService.java src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java
git -C C:\it\it_backend commit -m "fix: 결재선 결재유형 정책 적용"
```

‘모두 요청’ 결정으로 JavaDoc만 바뀌면 두 번째 커밋 메시지는 `docs: 결재유형코드 계약 명시`를 사용한다.

---

### Task 13: BE-23 SSO 벤더 배포물 사내 아티팩트 이전

**Files:**
- Modify after external action: `it_backend/sso/README.md`

**Interfaces:**
- Consumes: `it_backend/sso/`의 vendor JSP/Java/class/config 참고자료
- Produces: 접근 통제된 사내 원본 보관 위치, 버전, SHA-256 manifest, 복구 절차

- [ ] **Step 1: 보관소와 소유자를 확정한다**

권장안은 사내 범용 raw artifact 저장소의 `vendor/pentasecurity/sa-web/received-2026-07-26/` 경로다. Maven dependency로 소비하지 않으므로 제품 dependency 저장소와 분리한다. 소유자는 백엔드 SSO 운영 담당자, 읽기 권한은 장애 대응 담당자로 제한한다.

- [ ] **Step 2: manifest를 생성한다**

```powershell
Get-ChildItem -Recurse -File C:\it\it_backend\sso |
    Where-Object Name -ne 'README.md' |
    Get-FileHash -Algorithm SHA256 |
    Sort-Object Path
```

출력에는 상대 경로, 바이트 크기, SHA-256을 포함해 아티팩트와 함께 업로드한다. `config.properties`에 실제 비밀값이 있으면 업로드 전 보안 담당자 승인과 별도 암호화 보관을 적용하고 manifest에는 비밀 내용을 기록하지 않는다.

- [ ] **Step 3: 업로드와 복구 검증을 수행한다**

새 임시 디렉터리에 아티팩트를 다시 내려받아 manifest 해시가 전부 일치하는지 확인한다. 업로드 성공만으로 완료 처리하지 않는다.

- [ ] **Step 4: README에 좌표와 복구 절차를 기록한다**

사내 URL 자체가 민감하면 저장소 별칭과 artifact coordinate만 기록한다. 계약/장애 대응 보존기간과 삭제 승인자를 함께 기록한다.

- [ ] **Step 5: 로컬 vendor 파일 삭제는 별도 승인으로 남긴다**

BE-23 완료는 사내 저장소 이전과 복구 검증까지다. 로컬 사본 삭제는 공급 계약·보존기간·운영 담당자 승인이 모두 확인된 별도 작업에서 수행한다.

- [ ] **Step 6: 보관 좌표와 검증 결과를 커밋한다**

```powershell
git -C C:\it\it_backend add sso/README.md
git -C C:\it\it_backend commit -m "docs: SSO 벤더 자료 사내 보관 좌표 기록"
```

---

### Task 14: 전체 검증, versions.lock 갱신, 완료 이관

**Files:**
- Modify: `versions.lock`
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:**
- Consumes: 각 Task의 저장소별 검증 커밋과 외부 게이트 증거
- Produces: 재현 가능한 최종 커밋 조합과 활성 백로그 정리

- [ ] **Step 1: 백엔드 전체 품질 게이트를 실행한다**

```powershell
cd C:\it\it_backend
.\gradlew check
.\gradlew integrationTest
```

Expected: `BUILD SUCCESSFUL`. Oracle이 꺼져 있어 IT가 skip되면 완료로 판정하지 않고 Oracle 기동 후 다시 실행한다.

- [ ] **Step 2: DB 마이그레이션 패키징을 검증한다**

```powershell
cd C:\it\it_backend
.\gradlew clean processResources
Get-ChildItem .\build\resources\main\db\migration\V20260729_*.sql
```

Expected: `001`, `002`, `003` 세 스크립트가 모두 존재한다.

- [ ] **Step 3: 하위 저장소가 main과 clean인지 확인한다**

```powershell
git -C C:\it\it_frontend status --short --branch
git -C C:\it\it_backend status --short --branch
git -C C:\it\it_database status --short --branch
```

Expected: 세 저장소 모두 `main...origin/main`, 변경 없음. 하나라도 feature 브랜치이거나 dirty면 `versions.lock`을 갱신하지 않는다.

- [ ] **Step 4: versions.lock을 갱신한다**

```powershell
cd C:\it
.\scripts\update-versions-lock.ps1
git diff -- versions.lock
```

Expected: frontend/backend/database의 현재 `main` SHA와 갱신 시각이 반영된다.

- [ ] **Step 5: 완료된 과제만 이관한다**

완료 판정은 **이 계획의 산출물이 끝났는지**로 하며, 외부 주체의 후속 실행이 남은 과제는 완료로 옮기지 않는다. 마이그레이션에 `RAISE_APPLICATION_ERROR` 가드가 있는 과제는 가드가 발동하지 않았을 때만 완료다.

| 과제 | 완료 정의 | 조건 |
| --- | --- | --- |
| BE-19, BE-28, BE-29 | 구현 + 테스트 PASS | 무조건 완료 가능 |
| BE-03 BBUGTM/ProjectKeyView/알림 프로젝션 | 구현 + 단위·Oracle IT PASS | Task 9 완료 시 |
| BE-20 | `V20260729_003` 로컬 적용 + IT PASS | Step 2 가드(`10` + `SD_DTM` 존재)가 발동하지 않은 경우만. 발동 시 발송 여부 확정까지 `TASK.md` 유지 |
| BE-24 | `V20260729_001` 로컬 적용 + IT PASS | 강등 대상 문서번호 목록을 근거에 첨부. dev/prod 미적용은 완료를 막지 않되 근거에 명시 |
| BE-25 | `V20260729_002` 로컬 적용 + IT PASS | Step 2 가드(활성 BCMMTM 후보키 중복 등)가 발동하지 않은 경우만. 발동 시 업무 소유자 판단까지 `TASK.md` 유지 |
| BE-22 | **DBA 인계 자료 전달까지** | dev/prod 실제 적용은 DBA 소관이므로 완료 조건에 넣지 않는다. `TASK.md`에는 적용 결과 확인 항목을 별도로 남긴다 |
| BE-03 Project/Cost 목록 | 관측 보고서 작성 | 착수 기준 충족 시 구현까지, `DEFER`면 조건부 과제로 유지 |
| BE-18, BE-21, BE-23 | 외부 증거·결정 충족 시에만 | 미충족이면 게이트와 다음 확인일만 갱신 |

`TASK_DONE.md`에는 커밋 SHA, 테스트 명령, 결과, DB 마이그레이션 버전, 그리고 사전 리포트(`preflight-20260729.sql`) 실행 결과 요약을 기록한다. 조건 미충족 과제는 `TASK.md`에 게이트와 다음 확인일을 남긴다.

- [ ] **Step 6: 루트 문서 커밋**

```powershell
git -C C:\it add versions.lock TASK.md TASK_DONE.md
git -C C:\it commit -m "docs: BE-03~25 백엔드 조치 결과와 버전 잠금 갱신"
```

## 자체 점검 결과

- **범위:** BE-04~17 완료 이력을 제외했고, 활성 BE-03·18~25와 중복 ID 두 건을 모두 작업 또는 외부 게이트에 연결했다.
- **DB 안전:** 적용된 V20260724 스크립트는 수정하지 않고 후속 V20260729 스크립트만 추가한다.
- **계약 안전:** 알림은 이미 DTO 계약이 있어 JSON 불변 프로젝션으로 전환하고, Project/Cost는 기존 경로를 유지한 추가형 API만 계획했다.
- **외부 의존:** BE-18·21·23은 증거/결정 없이 코드나 외부 저장소 상태를 임의 변경하지 않는다.
- **릴리스 안전:** 현재 프론트가 feature 브랜치이므로 모든 하위 저장소가 main/clean이 되기 전 `versions.lock`을 갱신하지 않는다.

## 크로스체크 반영 이력 (2026-07-29)

코드베이스 대조 결과 다음을 수정했다.

| 항목 | 내용 |
| --- | --- |
| Task 4 — 후보키 범위 | BCMMTM 전 행 `UNIQUE (ASCT_ID, ENO)`는 소프트 삭제 이력과 충돌해 마이그레이션 중단·런타임 `ORA-00001`을 유발한다. `DEL_YN='N'` 부분 UNIQUE로 교체하고 가드 쿼리에도 같은 조건을 추가했다. CAPPLA·BMQNAM·BPQNAM은 전역 채번이라 전 행 UNIQUE 유지 근거를 명시했다 |
| Task 4 — RED 누락 | 마이그레이션 적용 전 제약 부재를 증명하는 단계를 분리하고, 소프트 삭제 행 공존 허용 케이스를 회귀 테스트로 추가했다 |
| Task 2 ↔ Task 5 상충 | `V20260724_002`가 `INFM_SD_STS_C` DEFAULT를 의도적으로 `'10'`으로 정렬한 사실을 반영해, 인계 문서에 두 스크립트 연속 적용과 최종값 `'01'`을 명시하도록 했다 |
| Task 8 — 동작 변경 범위 | 대표 코드가 `capital`·`itemGroupName` 조회 키로도 쓰이는 사실을 반영해 단언 필드를 2개에서 4개로 늘렸다 |
| Task 9 — `ProjectKeyView` | 저장소에 존재하지 않는 신규 타입임을 명시하고 정의·조회 메서드 시그니처를 계획에 포함했다 |
| Task 14 — 완료 판정 | 가드 발동 가능성이 있는 BE-20·24·25와 외부 실행이 남은 BE-22를 무조건 완료로 분류하던 표를 조건부 판정 표로 교체했다 |
| Task 3 — 자동 강등 근거 | Task 4의 "자동 병합 금지"와 원칙이 달라 보이는 이유(결과의 결정성)를 명시하고, 강등 전 건수 리포트 단계를 추가했다 |
| Task 1 — 라인 참조 | BE-19가 가리키는 `ProjectDto.java:217/:272`가 현재 `:220/:275`로 밀린 것을 보정하는 단계를 추가했다 |
| Task 3 Step 1 — 검색식 | `lstYn\\("N"\\)`의 이중 백슬래시가 매칭을 막아 `lstYn\("N"\)`으로 수정했다 |
