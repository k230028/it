# Database and Migration Safety Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BE-90, BE-95~BE-99를 해결해 BGDOCM 네임스페이스와 인덱스 명명을 정상화하고, 위험한 Flyway 이력의 배포·복구 계약을 문서화한다.

**Architecture:** `BGDOCM` 특수 문서를 기술 제목으로 식별해 전용 접두사로 개번하고, `meta/index.txt` 규칙에 맞는 함수 기반 UNIQUE 인덱스를 새 버전에서 생성한다. 이미 적용된 마이그레이션은 수정하지 않으며, 소급 방지가 불가능한 BYTE 절단 문제는 신규 환경 사전 게이트와 기존 환경 감사 런북으로 분리한다.

**Tech Stack:** Oracle 19c/23ai 호환 SQL, Flyway, Spring Boot local-int, PowerShell.

**Spec:** `docs/superpowers/specs/2026-09-03-task-backlog-remediation-design.md`

## Global Constraints

- 인덱스명은 `IX_TPRMPP_{테이블약어}_{2자리 순번}`을 사용한다.
- 신규/변경 `VARCHAR2`는 `BYTE`를 명시한다.
- 적용된 Flyway 파일은 수정하지 않는다.
- 진단 출력에는 건수와 기술 키만 포함하고 제목, 본문, 개인정보는 출력하지 않는다.
- Oracle DDL의 implicit commit 때문에 데이터 보정과 인덱스 재생성을 원자적 롤백으로 설명하지 않는다.

---

### Task 1: BE-95 철회된 Flyway 버전 운영 인계

**Files:**
- Create: `it_database/docs/operations/2026-09-03-draft-uniqueness-withdrawal.md`
- Modify: `it_database/docs/operations/2026-09-01-flyway-002-checksum-recovery.md`
- Modify: `it_database/docs/verification/2026-09-01-budget-reapplication-indexes.sql`

**Interfaces:** 버전 `20260901.002`를 영구 미사용으로 봉인하고, 환경별 이력/잔존 인덱스 판정 절차를 제공한다.

- [ ] **Step 1: stale 참조가 현재 존재하는지 확인한다**

Run: `cd C:\it\it_database; rg -n 'V20260901_002|IX_TPRMPP_(BPROJM|BCOSTM)_03' docs migrations`

Expected: checksum recovery 문서와 verification SQL에서 철회 전제가 발견된다.

- [ ] **Step 2: 환경 분기와 점검 SQL을 운영 문서에 작성한다**

```sql
SELECT VERSION, DESCRIPTION, CHECKSUM, SUCCESS
  FROM flyway_schema_history
 WHERE VERSION = '20260901.002';

SELECT INDEX_NAME
  FROM ALL_INDEXES
 WHERE OWNER = 'ITPOWN'
   AND INDEX_NAME IN ('IX_TPRMPP_BPROJM_03', 'IX_TPRMPP_BCOSTM_03');
```

미적용 환경은 조치 없음, 이력만 남은 환경은 실제 인덱스 부재 확인 후 승인된 `flyway repair`, 인덱스가 남은 환경은 구 인덱스 제거 후 repair로 분기한다.

- [ ] **Step 3: 기존 문서와 검증 SQL의 예정 표현을 철회 기록으로 바꾼다**

- [ ] **Step 4: 문서 링크와 SQL 문법을 검토한다**

Run: `cd C:\it\it_database; rg -n '후속.*V20260901_002|생성 전제' docs`

Expected: 예정 산출물 표현이 0건.

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_database add docs/operations/2026-09-03-draft-uniqueness-withdrawal.md docs/operations/2026-09-01-flyway-002-checksum-recovery.md docs/verification/2026-09-01-budget-reapplication-indexes.sql
git -C C:\it\it_database commit -m "docs: 철회된 재상신 유일성 버전 봉인"
```

### Task 2: BE-96 BYTE 절단 영향 감사와 신규 환경 게이트

**Files:**
- Create: `it_database/docs/operations/2026-09-03-byte-semantics-truncation-audit.md`
- Modify: `it_database/migrations/_verify/byte-semantics-revert-precheck.sql`
- Modify: `it_database/README.MD`

**Interfaces:** 신규 환경은 `V20260831_003` 전에 precheck 결과 0건을 승인 증적으로 남겨야 하며, 기존 환경은 백업과 업무 대조 없이 자동 복구를 시도하지 않는다.

- [ ] **Step 1: precheck의 종료 상태가 차단 건수를 기계적으로 드러내는 테스트 가능한 계약인지 점검한다**

Run: `cd C:\it\it_database; rg -n '차단 컬럼|RAISE_APPLICATION_ERROR|적용 가능' migrations/_verify/byte-semantics-revert-precheck.sql`

Expected: 현재는 메시지만 출력하고 실패 exit를 만들지 않는다.

- [ ] **Step 2: 차단 또는 조회 실패 시 ORA-20050으로 종료하도록 스크립트를 강화한다**

```sql
IF v_blocked > 0 OR v_errored > 0 THEN
    RAISE_APPLICATION_ERROR(-20050,
        'BYTE 전환 사전 점검 실패: 차단=' || v_blocked || ', 조회실패=' || v_errored);
END IF;
```

- [ ] **Step 3: 기존/신규 환경 런북을 작성한다**

런북은 백업 식별자, 절단 건수 확인 근거, 원본 시스템 대조, 복구 승인자, 재실행 순서를 필수 기록으로 정한다. 후속 Flyway가 과거 절단을 되돌릴 수 있다는 표현은 쓰지 않는다.

- [ ] **Step 4: README 적용 순서에 precheck 게이트를 연결한다**

- [ ] **Step 5: SQL*Plus 또는 SQLcl에서 precheck를 실행한다**

Run: `@migrations/_verify/byte-semantics-revert-precheck.sql`

Expected: 차단 0/조회실패 0이면 정상 종료, 그 외에는 ORA-20050.

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git -C C:\it\it_database add docs/operations/2026-09-03-byte-semantics-truncation-audit.md migrations/_verify/byte-semantics-revert-precheck.sql README.MD
git -C C:\it\it_database commit -m "docs: BYTE 전환 사전 게이트와 영향 감사 기록"
```

### Task 3: BE-90 BGDOCM 문서번호 데이터 보정

**Files:**
- Create: `it_database/migrations/V20260903_004__NormalizeBgdocNamespaces.sql`
- Create: `it_database/docs/verification/V20260903_004__NormalizeBgdocNamespaces.verify.sql`
- Create: `it_database/docs/operations/2026-09-03-bgdoc-namespace-index-handover.md`

**Interfaces:** 담당자 정보는 `CDOC-{yyyy}-{seq:04d}`, 공통 팝업은 `PDOC-{yyyy}-{seq:04d}`를 사용한다.

- [ ] **Step 1: 연속된 마이그레이션 번호 두 개가 비어 있는지 확인한다**

Run: `cd C:\it\it_database; rg --files migrations | rg 'V20260903_00[12]__'`

Expected: 출력 없음. 출력이 있으면 같은 날짜의 실제 다음 연속 번호 두 개를 데이터 보정과 DDL에 배정하고 SQL·검증 파일과 계획 참조를 함께 갱신한다.

- [ ] **Step 2: 대상·충돌·연계 파일을 세는 검증 SQL을 작성한다**

```sql
SELECT DOC_TTL_CONE, COUNT(*) AS CNT
  FROM ITPOWN.TPRMPP_BGDOCM
 WHERE DEL_YN='N'
   AND DOC_TTL_CONE IN ('SPEED_DIAL_CONTACT_INFO', 'common.popup')
 GROUP BY DOC_TTL_CONE;
```

새 PK 충돌과 `CFILEM.APG_FL_LNK_CTZ_NM` 연계 건수도 제목·본문 없이 출력한다.

- [ ] **Step 3: 새 번호 충돌을 차단하고 안정된 매핑으로 보정한다**

기존 연도·순번은 유지하고 접두사만 바꾼다. 새 PK가 이미 있거나 활성 기술 제목이 둘 이상이면 DML 전에 중단한다. `CFILEM` 연결값을 먼저 바꾸고 `BGDOCM` PK를 갱신한 뒤 COMMIT한다.

- [ ] **Step 4: local-int에서 데이터 보정과 검증 SQL을 실행한다**

Run: `cd C:\it\it_backend; ./gradlew bootRun --args='--spring.profiles.active=local-int'`

Expected: 특수 문서가 전용 접두사를 사용하고 기존 `GDOC-*` 특수 문서, 새 PK 충돌, 끊어진 CFILEM 연결이 모두 0건.

- [ ] **Step 5: 데이터 보정과 운영 인계를 커밋한다**

```powershell
git -C C:\it\it_database add migrations/V20260903_004__NormalizeBgdocNamespaces.sql docs/verification/V20260903_004__NormalizeBgdocNamespaces.verify.sql docs/operations/2026-09-03-bgdoc-namespace-index-handover.md
git -C C:\it\it_database commit -m "fix: BGDOC 문서번호 네임스페이스 분리"
```

### Task 4: BE-97 BGDOCM 인덱스 정규화

**Files:**
- Create: `it_database/migrations/V20260903_005__NormalizeBgdocIndexes.sql`
- Create: `it_database/docs/verification/V20260903_005__NormalizeBgdocIndexes.verify.sql`
- Modify: `it_database/docs/operations/2026-09-03-bgdoc-namespace-index-handover.md`
- Modify: `docs/superpowers/plans/2026-09-01-guide-content-migration.md`

**Interfaces:** `_02`는 담당자, `_03`은 공통 팝업, `_04`는 활성 GDOC 제목 유일성을 보장한다.

- [ ] **Step 1: 구·신 인덱스와 활성 GDOC 제목 중복 검증 SQL을 작성한다**

`ALL_INDEXES`, `ALL_IND_EXPRESSIONS`에서 `_01`, 구 UX 두 개, `_02`~`_04`를 조회하고 활성 GDOC 제목 중복 그룹 수를 출력한다.

- [ ] **Step 2: 비표준 인덱스를 제거하고 정규명 인덱스를 생성한다**

```sql
CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BGDOCM_02 ON ITPOWN.TPRMPP_BGDOCM
    (CASE WHEN DEL_YN='N' AND DOC_MNG_NO LIKE 'CDOC-%'
                AND DOC_TTL_CONE='SPEED_DIAL_CONTACT_INFO' THEN 1 END);
CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BGDOCM_03 ON ITPOWN.TPRMPP_BGDOCM
    (CASE WHEN DEL_YN='N' AND DOC_MNG_NO LIKE 'PDOC-%'
                AND DOC_TTL_CONE='common.popup' THEN 1 END);
CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BGDOCM_04 ON ITPOWN.TPRMPP_BGDOCM
    (CASE WHEN DEL_YN='N' AND DOC_MNG_NO LIKE 'GDOC-%' THEN DOC_TTL_CONE END);
```

기존 정규명이 있으면 UNIQUE·표현식을 검증하고 다르면 중단한다. 구 UX 이름은 존재할 때만 제거한다.

- [ ] **Step 3: 운영 인계와 기존 가이드 이관 계획을 현행화한다**

기존 계획 Task 1을 이 마이그레이션 선행 완료 참조로 바꿔 중복 인덱스 생성을 제거한다.

- [ ] **Step 4: local-int Flyway와 검증 SQL을 실행한다**

Expected: 구 UX 0개, `_02`~`_04` 각각 1개, 표현식 일치, GDOC 중복 그룹 0개.

- [ ] **Step 5: DB와 루트 계획 변경을 저장소별로 커밋한다**

```powershell
git -C C:\it\it_database add migrations/V20260903_005__NormalizeBgdocIndexes.sql docs/verification/V20260903_005__NormalizeBgdocIndexes.verify.sql docs/operations/2026-09-03-bgdoc-namespace-index-handover.md
git -C C:\it\it_database commit -m "feat: BGDOC 인덱스 명명과 유일성 정규화"
git -C C:\it add docs/superpowers/plans/2026-09-01-guide-content-migration.md
git -C C:\it commit -m "docs: 가이드 이관 DB 선행 작업 현행화"
```

### Task 5: BE-98 파괴적 DDL 소급 인계

**Files:**
- Create: `it_database/docs/operations/2026-09-03-destructive-ddl-retrospective.md`
- Modify: `it_database/docs/guides/migrations.md`

**Interfaces:** `V20260829_001`, `V20260831_003`, `V20260831_005`별 사전 백업, 적용 후 검증, 재실행/복구 가능 범위를 제공한다.

- [ ] **Step 1: 세 마이그레이션의 DROP/ALTER와 가드를 목록화한다**

Run: `cd C:\it\it_database; rg -n 'DROP TABLE|DROP COLUMN|ALTER TABLE|RAISE_APPLICATION_ERROR' migrations/V20260829_001__*.sql migrations/V20260831_003__*.sql migrations/V20260831_005__*.sql`

- [ ] **Step 2: 실제 위험과 복구 입력을 버전별 표로 기록한다**

각 행에 영향 객체, implicit commit 지점, 필요한 백업, 재실행 결과, 검증 SQL, 복구 한계를 적는다.

- [ ] **Step 3: 가이드에 destructive DDL 체크리스트를 연결한다**

- [ ] **Step 4: 문서 자체 검증을 실행한다**

Run: `cd C:\it\it_database; rg -n 'V20260829_001|V20260831_003|V20260831_005|백업|복구|재실행' docs/operations/2026-09-03-destructive-ddl-retrospective.md`

Expected: 세 버전과 네 필수 항목이 모두 검색된다.

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_database add docs/operations/2026-09-03-destructive-ddl-retrospective.md docs/guides/migrations.md
git -C C:\it\it_database commit -m "docs: 파괴적 DDL 소급 운영 인계"
```

### Task 6: BE-99 CREATE TABLE BYTE 검증 규약 정리

**Files:**
- Modify: `it_database/docs/guides/migrations.md`
- Modify: `it_database/docs/operations/2026-08-29-terminal-org-name-byte-semantics.md`

**Interfaces:** 신규 CREATE TABLE 마이그레이션은 `VARCHAR2(n BYTE)`와 데이터 사전 검증 블록을 함께 제공한다.

- [ ] **Step 1: 가이드에 복사 가능한 검증 블록을 추가한다**

```sql
SELECT COUNT(*) INTO v_bad
  FROM ALL_TAB_COLUMNS
 WHERE OWNER='ITPOWN' AND TABLE_NAME=c_table
   AND COLUMN_NAME=c_column
   AND (CHAR_USED <> 'B' OR DATA_LENGTH <> c_expected_bytes);
IF v_bad > 0 THEN
    RAISE_APPLICATION_ERROR(-20099, 'BYTE 컬럼 계약 불일치');
END IF;
```

- [ ] **Step 2: 단말기 운영 문서가 마이그레이션 검증 계약을 참조하도록 바꾼다**

현재 우연히 맞는 `DATA_LENGTH=100`만 정상 근거로 삼지 않고, 선언과 자체 검증 블록 및 적용 후 데이터 사전 확인을 함께 근거로 둔다.

- [ ] **Step 3: bare VARCHAR2 신규 DDL을 점검한다**

Run: `cd C:\it\it_database; rg -n 'VARCHAR2\([0-9]+\)(?! BYTE| CHAR)' migrations -g '*.sql'`

Expected: PCRE2가 필요한 환경에서는 `rg --pcre2`로 실행하며, 신규 작성분에 bare 선언이 없어야 한다.

- [ ] **Step 4: 변경을 커밋한다**

```powershell
git -C C:\it\it_database add docs/guides/migrations.md docs/operations/2026-08-29-terminal-org-name-byte-semantics.md
git -C C:\it\it_database commit -m "docs: 신규 테이블 BYTE 검증 계약 강화"
```

### Task 7: DB 완료 검증과 메타 현행화

**Files:**
- Modify: `meta/index.txt`
- Modify: `meta/backlog.md`
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`
- Modify: `versions.lock`

**Interfaces:** 실제 운영 반영 전에는 backlog 상태를 계획/적용중으로 유지하고, 검증된 환경 반영 후에만 완료로 바꾼다.

- [ ] **Step 1: Flyway 이력과 인덱스 검증 SQL을 실행한다**

Expected: 새 버전 success, `_02`~`_04` 계약 일치, 구 UX 인덱스 부재.

- [ ] **Step 2: 검증 환경의 인덱스 현황을 `meta/index.txt` 형식으로 재추출한다**

- [ ] **Step 3: backlog 상태와 완료 과제를 갱신한다**

DBA 미반영 환경이 남으면 해당 행은 삭제하지 않고 환경과 선행 조건을 명시한다.

- [ ] **Step 4: 호환 버전을 갱신한다**

Run: `cd C:\it; ./scripts/update-versions-lock.ps1`

- [ ] **Step 5: 루트 변경을 커밋한다**

```powershell
git -C C:\it add meta/index.txt meta/backlog.md TASK.md TASK_DONE.md versions.lock
git -C C:\it commit -m "docs: DB 안전성 과제 완료 기록"
```
