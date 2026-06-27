# TASK High 잔여 항목 조치 (Batch 1~3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md` 잔여 🟠 High 7건 중 이번 사이클 실행 가능한 Batch 1~3(PII 로그 정리, 대시보드 인덱스, N+1 제거)을 조치한다.

**Architecture:** 세 배치는 서로 독립적이다. Batch 1은 로그 레벨 강등(로직 무변경), Batch 2는 가산형 Flyway 인덱스 마이그레이션(`local-ext`/`local-int`만 자동 적용), Batch 3은 행별 반복 쿼리를 IN 일괄 조회 + 메모리 그룹핑으로 치환한다. Batch 3은 Mockito 단위 테스트로 쿼리 호출 횟수 감소와 동작 동등성을 검증한다.

**Tech Stack:** Spring Boot 4.1.0 / Java 25 / Spring Data JPA + QueryDSL / Oracle / Flyway / JUnit 5 + Mockito + AssertJ. 빌드·테스트는 `it_backend`에서 `./gradlew` 사용.

**선행 검증 메모(2026-06-27):** 설계 spec(`docs/superpowers/specs/2026-06-27-task-high-remediation-design.md`) §2 Batch 2의 인덱스 컬럼명은 실제 코드 대조에서 부정확했다. 본 계획은 실제 쿼리 술어 기준으로 교정했다:
- `CDECIM`: spec `DCD_ENO,DCD_DT` → 실제 `DCR_ENO`(결재자사번), `DCD_STS_C`(결재상태). (`Cdecim.java:59,82`, `ApplicationRepository.java:50-58,109-121`)
- `CAPPLM`: spec `APF_STS,RQS_DT` → 실제 `APF_PRG_STS_C`, `DCD_REQ_USID`, `DCD_REQ_DTM`. (`ApplicationRepository.java:60-103`)
- `BRDOCM`: 대시보드 6개 쿼리 모두 `JOIN CUSERI ON FST_ENR_USID=ENO` + `DEL_YN='N'`. (`ServiceRequestDocRepository.java:120-207`)
- `BRIVGM`: `DOC_MNG_NO`, `DEL_YN`, `FSG_YN` 조합으로 JOIN/EXISTS. (`ServiceRequestDocRepository.java:131-159`)

**범위 제외:** Batch 4(#2 bbrC 부서필터 스키마, #3 사전협의 서버 영속화)는 스키마/신규 API 설계가 필요해 별도 spec로 분리한다(설계 spec §3). 본 계획에 포함하지 않는다.

---

## File Structure

| 파일 | 책임 | 배치 |
| --- | --- | --- |
| `it_backend/.../common/board/service/BoardPostService.java` | 멘션 진단 로그 6곳 `info`→`debug` 강등 | 1 |
| `it_backend/.../common/approval/service/ApplicationService.java` | 결재자 사번 포함 진단 로그 `info`→`debug` 강등 | 1 |
| `it_database/migrations/V20260627_001__AddDashboardListIndexes.sql` | 결재/요구사항 대시보드 인덱스 4종(멱등 가드) | 2 |
| `it_backend/.../budget/cost/repository/BtermmRepository.java` | 단말기 IN 일괄 조회 finder 추가 | 3 |
| `it_backend/.../budget/cost/service/CostService.java` | `enrichCostListBatch`/`deleteCost` 단말기 일괄 조회로 N+1 제거 | 3 |
| `it_backend/.../budget/work/repository/BbugtmRepository.java` | 연도+테이블 BBUGTM 일괄 조회 finder 추가 | 3 |
| `it_backend/.../budget/work/service/BudgetWorkService.java` | `applyRates` 존재확인 SELECT 루프 제거(키 일괄 조회 + 메모리 분기) | 3 |
| `it_backend/.../budget/cost/service/CostServiceTest.java` | 단말기 일괄 조회·삭제 케이스 보강 | 3 |
| `it_backend/.../budget/work/service/BudgetWorkServiceTest.java` | 존재확인 일괄화 케이스 보강 | 3 |

---

## Batch 1 — 보안 Quick Win: 멘션/결재 알림 PII 로그 정리

대상 #1. 사번 목록·본문 snippet·결재자 사번이 `log.info`로 노출됨(CLAUDE.md §4.2 PII 정책 위반). 진단 로그는 `log.debug`로 강등한다. 로직 무변경.

### Task 1.1: BoardPostService 멘션 진단 로그 강등

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostService.java:254-287`

- [ ] **Step 1: 6개 `log.info("[멘션 진단]"...)` 를 `log.debug` 로 변경**

`publishMentionNotifications()` 안의 진단 로그 6곳(라인 254, 267, 269, 278, 284, 287)을 모두 `log.info` → `log.debug` 로 바꾼다. 메시지 문자열·인자는 그대로 둔다. 예:

```java
// 변경 전 (라인 254)
log.info("[멘션 진단] publishMentionNotifications 진입: nacMngNo={}, author={}, contentLen={}, explicitEnos={}",
    post.getNacMngNo(), authorEno, post.getNacCone() == null ? 0 : post.getNacCone().length(), explicitEnos);
// 변경 후
log.debug("[멘션 진단] publishMentionNotifications 진입: nacMngNo={}, author={}, contentLen={}, explicitEnos={}",
    post.getNacMngNo(), authorEno, post.getNacCone() == null ? 0 : post.getNacCone().length(), explicitEnos);
```

나머지 5곳(라인 267 `union 결과`, 269 `union 0건 → 종료 ... content snippet`, 278 `CUSERI 검증`, 284 `검증 후 수신자 0건`, 287 `최종 수신자`)도 동일하게 `log.info`→`log.debug`.

- [ ] **Step 2: 컴파일 검증**

Run: `cd it_backend; ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostService.java
git commit -m "fix: 게시판 멘션 진단 로그 PII를 INFO→DEBUG 강등"
```

### Task 1.2: ApplicationService 결재 알림 진단 로그 강등

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java:221`

- [ ] **Step 1: 결재자 사번 포함 `log.info` 를 `log.debug` 로 변경**

`publishApprovalRequestNotification()` 라인 221의 로그(결재자 사번 `next.getDcrEno()` 포함)를 `log.info`→`log.debug`로 변경:

```java
// 변경 전 (라인 221)
log.info("[알림 진단] APPROVAL_REQUEST publishEvent: apfMngNo={}, recipientEno={}, dcrSqnSno={}",
    capplm.getApfMngNo(), next.getDcrEno(), next.getDcrSqnSno());
// 변경 후
log.debug("[알림 진단] APPROVAL_REQUEST publishEvent: apfMngNo={}, recipientEno={}, dcrSqnSno={}",
    capplm.getApfMngNo(), next.getDcrEno(), next.getDcrSqnSno());
```

라인 214의 "건너뜀" 로그(사번 없이 count·boolean만 포함)는 `log.info` 유지.

- [ ] **Step 2: 컴파일 검증**

Run: `cd it_backend; ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java
git commit -m "fix: 결재요청 알림 진단 로그 결재자 사번을 INFO→DEBUG 강등"
```

---

## Batch 2 — 대시보드 인덱스 보강 (가산형 마이그레이션)

대상 #6, #7. 결재 대기/대시보드(CDECIM/CAPPLM), 요구사항 대시보드(BRDOCM/BRIVGM)에 후보 인덱스가 없다. 신규 Flyway 스크립트로 추가한다. 멱등 가드(인덱스 존재 시 skip)를 둔다. `local-ext`/`local-int` 기동 시 자동 적용, dev/prod는 DBA 적용(CLAUDE.md §4.4).

### Task 2.1: Flyway 인덱스 마이그레이션 작성

**Files:**
- Create: `it_database/migrations/V20260627_001__AddDashboardListIndexes.sql`

- [ ] **Step 1: 마이그레이션 스크립트 작성**

`V20260622_006__AddMplAmtToBitemm.sql` 의 멱등 가드 패턴(`ALL_TAB_COLS` 조회)을 인덱스용(`ALL_INDEXES`)으로 변형한다. 컬럼명은 위 "선행 검증 메모" 기준.

```sql
-- V20260627_001__AddDashboardListIndexes.sql
-- 결재 대기/대시보드(CDECIM/CAPPLM)·요구사항 대시보드(BRDOCM/BRIVGM) 목록·집계 쿼리용 인덱스.
-- 가산형(추가만) 변경이며 멱등성: 동일 인덱스명 존재 시 생성을 건너뛴다.
-- 컬럼은 실제 쿼리 술어 기준 (ApplicationRepository / ServiceRequestDocRepository 대조, 2026-06-27).
--   CDECIM : 결재대기 조인/필터 d.DCR_ENO=:eno AND d.DCD_STS_C='1' (+조인키 APF_DCM_NO)
--   CAPPLM : 기안자 기준 진행중/반려/월별 a.DCD_REQ_USID + a.APF_PRG_STS_C + a.DCD_REQ_DTM
--   BRDOCM : 대시보드 조인 b.FST_ENR_USID=u.ENO + b.DEL_YN='N'
--   BRIVGM : 미해결 검토의견 EXISTS r.DOC_MNG_NO + r.DEL_YN + r.FSG_YN
DECLARE
    FUNCTION idx_exists(p_idx VARCHAR2) RETURN BOOLEAN IS
        n NUMBER;
    BEGIN
        SELECT COUNT(*) INTO n FROM ALL_INDEXES
         WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
           AND INDEX_NAME = p_idx;
        RETURN n > 0;
    END;
BEGIN
    IF NOT idx_exists('IX_CDECIM_PENDING') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_CDECIM_PENDING ON TPRMPP_CDECIM (DCR_ENO, DCD_STS_C, APF_DCM_NO)';
    END IF;
    IF NOT idx_exists('IX_CAPPLM_USER_STS') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_CAPPLM_USER_STS ON TPRMPP_CAPPLM (DCD_REQ_USID, APF_PRG_STS_C, DCD_REQ_DTM)';
    END IF;
    IF NOT idx_exists('IX_BRDOCM_ENR_DEL') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_BRDOCM_ENR_DEL ON TPRMPP_BRDOCM (FST_ENR_USID, DEL_YN)';
    END IF;
    IF NOT idx_exists('IX_BRIVGM_DOC_DEL_FSG') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_BRIVGM_DOC_DEL_FSG ON TPRMPP_BRIVGM (DOC_MNG_NO, DEL_YN, FSG_YN)';
    END IF;
END;
/
```

- [ ] **Step 2: `local-ext` 기동으로 적용 확인**

Run: `cd it_backend; ./gradlew bootRun --args='--spring.profiles.active=local-ext'`
Expected: 기동 로그에 Flyway가 `V20260627_001` 마이그레이션을 적용했다는 줄이 보이고, 예외 없이 기동 완료. 확인 후 종료(Ctrl+C).

> 로컬 Oracle(127.0.0.1:11521/XEPDB1)이 떠 있어야 한다(CLAUDE.md §3.1). DB 미가동이면 이 스텝은 DBA/로컬 DB 준비 후 수행하고, 스크립트 문법만 우선 리뷰한다.

- [ ] **Step 3: 인덱스 생성 검증(SQL)**

Run:
```
sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1
```
접속 후:
```sql
SELECT index_name FROM all_indexes
 WHERE owner = 'ITPOWN'
   AND index_name IN ('IX_CDECIM_PENDING','IX_CAPPLM_USER_STS','IX_BRDOCM_ENR_DEL','IX_BRIVGM_DOC_DEL_FSG')
 ORDER BY index_name;
```
Expected: 4개 인덱스 모두 반환.

- [ ] **Step 4: 커밋**

```bash
git add it_database/migrations/V20260627_001__AddDashboardListIndexes.sql
git commit -m "perf: 결재/요구사항 대시보드 목록·집계 인덱스 추가 (Flyway)"
```

---

## Batch 3 — N+1 제거 (테스트 동반)

대상 #4, #5. `CostService`의 단말기 행별 조회와 `BudgetWorkService.applyRates`의 레코드별 존재확인 SELECT를 IN 일괄 조회 + 메모리 그룹핑/분기로 치환한다. 동작 동등성과 쿼리 호출 횟수 감소를 Mockito로 검증한다.

### Task 3.1: 단말기 IN 일괄 조회 finder 추가 (RED→GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java`

- [ ] **Step 1: finder 메서드 선언 추가**

`BtermmRepository` 인터페이스에 IN 일괄 조회 메서드를 추가한다(파생 쿼리, 구현 불필요):

```java
    /**
     * 여러 전산관리비에 연관된 단말기 일괄 조회 (N+1 방지용 배치 조회)
     *
     * @param termBgNos 전산관리비 관리번호 목록
     * @param delYn     삭제여부 ('N'=미삭제)
     * @return 연관 단말기 목록 (호출자가 termBgNo+termBgSno로 그룹핑)
     */
    List<Btermm> findByTermBgNoInAndDelYn(java.util.Collection<String> termBgNos, String delYn);
```

- [ ] **Step 2: 컴파일 검증**

Run: `cd it_backend; ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL` (파생 쿼리 메서드명이 규약에 맞아 부팅 시 검증되지만 컴파일은 통과)

### Task 3.2: enrichCostListBatch 단말기 일괄 조회 — 실패 테스트 먼저

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`

- [ ] **Step 1: 실패 테스트 작성**

`CostServiceTest`에 단말기 일괄 조회 검증 테스트를 추가한다. 단말 보유(`tmnYn='Y'`) 행이 2건일 때, 행별 `findByTermBgNoAndTermBgSnoAndDelYn`가 호출되지 않고 IN 일괄 조회 `findByTermBgNoInAndDelYn`가 1회만 호출되어야 한다. `enrichCostListBatch`는 private이므로 이를 호출하는 public 목록 메서드를 통해 검증한다(기존 테스트가 사용하는 목록 진입 메서드와 동일 패턴 사용).

> 구현 시 주의: 기존 테스트에서 목록 조회 public 메서드(예: `getCostList`/`searchCosts`)가 무엇인지 먼저 확인하고, 그 메서드를 호출하는 케이스로 작성한다. 아래는 검증 골격이다.

```java
    @Test
    @DisplayName("목록 조회 시 단말기는 행별이 아닌 IN 일괄 조회로 1회만 조회한다")
    void enrichCostList_batchLoadsTerminals_once() {
        // Arrange: tmnYn='Y' 인 Bcostm 2건 + 각 단말기
        // (기존 테스트의 목록 stub 패턴을 따라 costRepository 목록 조회 결과를 구성)
        given(btermmRepository.findByTermBgNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of(/* 단말기 2건 */));

        // Act: 목록 조회 public 메서드 호출

        // Assert: 일괄 조회 1회, 행별 조회 0회
        verify(btermmRepository).findByTermBgNoInAndDelYn(any(), eq("N"));
        verify(btermmRepository, never()).findByTermBgNoAndTermBgSnoAndDelYn(any(), any(), any());
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend; ./gradlew test --tests *CostServiceTest`
Expected: 신규 테스트 FAIL (현재는 `attachTerminals()`가 행별 `findByTermBgNoAndTermBgSnoAndDelYn`를 호출하므로 `never()` 검증 실패).

### Task 3.3: enrichCostListBatch 구현 변경 (GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:610-643,708-714`

- [ ] **Step 1: 단말기 일괄 조회 후 그룹 주입으로 변경**

`enrichCostListBatch` 의 최종 주입 루프(라인 611-643)에서 행별 `attachTerminals(response)` 호출(라인 640-642)을 제거하고, 루프 진입 전에 단말 보유 행의 관리번호를 모아 일괄 조회·그룹핑한다. 그룹 키는 `termBgNo + "_" + termBgSno`.

라인 610 `// --- 6. 응답 DTO에 일괄 주입 ---` 직전에 일괄 조회 블록 추가:

```java
        // --- 5.5 단말기 일괄 조회 (N+1 제거): tmnYn='Y' 행만 대상 ---
        List<String> terminalCostNos = costs.stream()
                .filter(c -> "Y".equals(c.getTmnYn()))
                .map(Bcostm::getCostBgNo)
                .distinct()
                .toList();
        Map<String, List<Btermm>> terminalsByKey = terminalCostNos.isEmpty() ? Map.of()
                : btermmRepository.findByTermBgNoInAndDelYn(terminalCostNos, "N").stream()
                    .collect(java.util.stream.Collectors.groupingBy(
                        t -> t.getTermBgNo() + "_" + t.getTermBgSno()));
```

그리고 최종 주입 루프 안의 라인 640-642를 다음으로 교체:

```java
            if ("Y".equals(cost.getTmnYn())) {
                List<Btermm> terminals = terminalsByKey.getOrDefault(
                        cost.getCostBgNo() + "_" + cost.getBgSno(), List.of());
                List<CostDto.TerminalDto> dtos = terminals.stream()
                        .map(CostDto.TerminalDto::fromEntity).toList();
                setTerminalCodeNames(dtos);
                response.setTerminals(dtos);
            }
```

> `attachTerminals(CostDto.Response)`(라인 708-714)는 단건 조회 경로(라인 144)에서 계속 사용되므로 삭제하지 않는다. 위 인라인 블록은 목록 경로 전용이다. `Btermm` import가 `CostService`에 없으면 추가한다(`import com.kdb.it.domain.budget.cost.entity.Btermm;`).

- [ ] **Step 2: 테스트 통과 확인**

Run: `cd it_backend; ./gradlew test --tests *CostServiceTest`
Expected: Task 3.2 테스트 PASS, 기존 테스트 전부 PASS.

### Task 3.4: deleteCost 단말기 일괄 조회 (RED→GREEN)

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:388-394`

- [ ] **Step 1: 실패 테스트 작성**

삭제 대상 cost가 여러 건일 때 단말기를 행별로 조회하지 않고 IN 일괄 조회 1회로 조회함을 검증한다.

```java
    @Test
    @DisplayName("deleteCost는 단말기를 IN 일괄 조회로 1회만 조회한다")
    void deleteCost_batchLoadsTerminals_once() {
        // Arrange: 동일 itMngcNo 의 Bcostm 2건 (findByCostBgNoAndDelYn)
        // 권한 검증 통과를 위해 기존 삭제 테스트의 SecurityContext/소유자 stub 패턴 재사용
        given(btermmRepository.findByTermBgNoInAndDelYn(any(), eq("N")))
            .willReturn(List.of(/* 단말기 */));

        // Act: costService.deleteCost(IT_MNGC_NO)

        // Assert
        verify(btermmRepository).findByTermBgNoInAndDelYn(any(), eq("N"));
        verify(btermmRepository, never()).findByTermBgNoAndTermBgSno(any(), any());
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend; ./gradlew test --tests *CostServiceTest`
Expected: 신규 테스트 FAIL (현재 `deleteCost`가 행별 `findByTermBgNoAndTermBgSno` 호출).

- [ ] **Step 3: deleteCost 구현 변경**

`deleteCost`의 삭제 루프(라인 388-394)를 단말기 일괄 조회 후 삭제로 변경:

```java
        List<String> costNos = costs.stream().map(Bcostm::getCostBgNo).distinct().toList();
        Map<String, List<Btermm>> terminalsByKey = btermmRepository
                .findByTermBgNoInAndDelYn(costNos, "N").stream()
                .collect(java.util.stream.Collectors.groupingBy(
                    t -> t.getTermBgNo() + "_" + t.getTermBgSno()));
        for (Bcostm cost : costs) {
            cost.delete();
            terminalsByKey.getOrDefault(cost.getCostBgNo() + "_" + cost.getBgSno(), List.of())
                .forEach(Btermm::delete);
        }
```

> 기존 라인 388-394 전체를 위 블록으로 교체한다. `findByTermBgNoAndTermBgSno`(미삭제 무관 조회) 대신 `findByTermBgNoInAndDelYn(..., "N")`을 쓰는데, 이미 삭제된 단말기는 다시 삭제할 필요가 없으므로 `DEL_YN='N'`만 대상으로 하는 것이 정합적이다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend; ./gradlew test --tests *CostServiceTest`
Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java
git commit -m "perf: 전산관리비 목록·삭제 단말기 조회 N+1 제거 (IN 일괄 조회)"
```

### Task 3.5: BBUGTM 연도+테이블 일괄 조회 finder 추가

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepository.java`

- [ ] **Step 1: finder 선언 추가**

`applyRates`의 레코드별 존재확인 SELECT를 대체할 일괄 조회 메서드를 추가한다. 연도(`bseYy`) + 원천테이블명(`fntTbNm`) + 미삭제 단위로 한 번에 조회한다:

```java
    /**
     * 연도·원천테이블 단위 편성예산 전체 조회 (편성률 적용 시 존재확인 N+1 제거용)
     *
     * @param bseYy    회계연도
     * @param fntTbNm  원천테이블명 ("BCOSTM" 또는 "BITEMM")
     * @param delYn    삭제여부 ('N'=미삭제)
     * @return 해당 연도·테이블의 미삭제 편성예산 목록 (호출자가 pkColNm+sno+ioeC로 그룹핑)
     */
    List<Bbugtm> findByBseYyAndFntTbNmAndDelYn(String bseYy, String fntTbNm, String delYn);
```

> `Bbugtm`/`List` import가 이미 있는지 확인하고 없으면 추가한다.

- [ ] **Step 2: 컴파일 검증**

Run: `cd it_backend; ./gradlew compileJava`
Expected: `BUILD SUCCESSFUL`

### Task 3.6: applyRates 존재확인 일괄화 — 실패 테스트 먼저

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java`

- [ ] **Step 1: 실패 테스트 작성**

`applyRates`가 레코드별 `findByBseYyAndFntTbNmAndPkColNmAndFntTbCrySnoAndIoeCAndDelYn`를 호출하지 않고, 테이블별 일괄 조회 `findByBseYyAndFntTbNmAndDelYn`로 BCOSTM/BITEMM 각 1회(총 rate 1건 기준 2회) 조회함을 검증한다.

```java
    @Test
    @DisplayName("applyRates는 존재확인을 레코드별이 아닌 테이블별 일괄 조회로 수행한다")
    void applyRates_batchExistenceCheck() {
        // Arrange: rate 1건, findApprovedCostsByIoeCValues / findApprovedItemsByIoeCValues stub
        given(bbugtmRepository.findByBseYyAndFntTbNmAndDelYn(any(), eq("BCOSTM"), eq("N")))
            .willReturn(List.of());
        given(bbugtmRepository.findByBseYyAndFntTbNmAndDelYn(any(), eq("BITEMM"), eq("N")))
            .willReturn(List.of());

        // Act: budgetWorkService.applyRates(request)

        // Assert: 일괄 조회만 사용, 레코드별 존재확인 0회
        verify(bbugtmRepository, never())
            .findByBseYyAndFntTbNmAndPkColNmAndFntTbCrySnoAndIoeCAndDelYn(any(), any(), any(), any(), any(), any());
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend; ./gradlew test --tests *BudgetWorkServiceTest`
Expected: FAIL (현재 `applyRates`가 레코드별 존재확인 호출).

### Task 3.7: applyRates 구현 변경 (GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java:151-237`

- [ ] **Step 1: 테이블별 키맵 사전 구성 + 메모리 분기로 변경**

`applyRates` 진입부에서 BCOSTM/BITEMM 기존 편성예산을 테이블별로 한 번에 조회해 키맵으로 만든 뒤, 루프 내부의 `existing` 조회를 맵 조회로 치환한다. 키는 `pkColNm + "|" + fntTbCrySno + "|" + ioeC`.

라인 159 `Map<String, Set<String>> prefixToIoeCValues = ...` 다음에 키맵 구성 추가:

```java
        // 존재확인 N+1 제거: 연도·테이블 단위로 기존 BBUGTM을 일괄 조회해 키맵 구성
        java.util.Map<String, Bbugtm> existingCostMap = bbugtmRepository
                .findByBseYyAndFntTbNmAndDelYn(bgYy, "BCOSTM", "N").stream()
                .collect(java.util.stream.Collectors.toMap(
                    b -> b.getPkColNm() + "|" + b.getFntTbCrySno() + "|" + b.getIoeC(),
                    b -> b, (a, b) -> a));
        java.util.Map<String, Bbugtm> existingItemMap = bbugtmRepository
                .findByBseYyAndFntTbNmAndDelYn(bgYy, "BITEMM", "N").stream()
                .collect(java.util.stream.Collectors.toMap(
                    b -> b.getPkColNm() + "|" + b.getFntTbCrySno() + "|" + b.getIoeC(),
                    b -> b, (a, b) -> a));
```

BCOSTM 처리 루프(라인 168-196)의 존재확인(라인 171-174)을 맵 조회로 교체:

```java
                String key = cost.getCostBgNo() + "|" + cost.getBgSno() + "|" + cost.getIoeC();
                Bbugtm existing = existingCostMap.get(key);
                if (existing != null) {
                    existing.update(dupBgAmt, dupRt);
                } else {
                    snoCounter++;
                    Bbugtm bbugtm = Bbugtm.builder()
                            .bgNo(bgMngNo).sno(snoCounter).bseYy(bgYy)
                            .fntTbNm("BCOSTM").pkColNm(cost.getCostBgNo())
                            .fntTbCrySno(cost.getBgSno()).ioeC(cost.getIoeC())
                            .bgDupAmt(dupBgAmt).asgRt(dupRt).build();
                    bbugtmRepository.save(bbugtm);
                    existingCostMap.put(key, bbugtm); // 동일 실행 내 중복 키 재삽입 방지
                }
                totalRecords++;
```

BITEMM 처리 루프(라인 203-232)의 존재확인(라인 209-212)도 동일하게 `existingItemMap` 기준으로 교체(키: `item.getGclMngNo() + "|" + item.getSno() + "|" + item.getIoeC()`, fntTbNm "BITEMM", pkColNm `item.getGclMngNo()`, fntTbCrySno `item.getSno()`).

> `Optional` 분기였던 부분이 null 분기로 바뀐다. 기존 `existing.get().update(...)`는 `existing.update(...)`로 변경. 동일 실행 내 같은 키가 두 번 등장하면 두 번째는 insert가 아닌 update가 되도록 `existingCostMap.put`/`existingItemMap.put`을 추가했다(기존 per-record SELECT는 같은 트랜잭션 영속성 컨텍스트로 일부 보였으나, 일괄 사전조회는 루프 중 신규 insert를 못 보므로 맵 갱신으로 동등성 유지).

- [ ] **Step 2: 테스트 통과 확인**

Run: `cd it_backend; ./gradlew test --tests *BudgetWorkServiceTest`
Expected: Task 3.6 테스트 PASS, 기존 테스트 전부 PASS.

- [ ] **Step 3: 커밋**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepository.java it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java it_backend/src/test/java/com/kdb/it/domain/budget/work/service/BudgetWorkServiceTest.java
git commit -m "perf: 편성률 적용 존재확인 SELECT N+1 제거 (테이블별 일괄 조회)"
```

### Task 3.8: 전체 백엔드 테스트 재검증

- [ ] **Step 1: 관련 테스트 통합 실행**

Run: `cd it_backend; ./gradlew test --tests *CostServiceTest --tests *BudgetWorkServiceTest`
Expected: `BUILD SUCCESSFUL`, 두 테스트 클래스 전부 PASS.

- [ ] **Step 2: 공통 영향 회귀 검증(권장)**

Run: `cd it_backend; ./gradlew clean test`
Expected: `BUILD SUCCESSFUL` (인증/결재/QueryDSL 집계/변경로그 등 회귀 없음, CLAUDE.md §5.9).

---

## 마무리 — TASK.md / TASK_DONE.md 갱신

- [ ] **Step 1: 완료 항목 이관**

각 배치 완료 후 `TASK.md`에서 해당 행(#1, #4, #5, #6, #7)을 제거하고 `TASK_DONE.md`로 이관한다(조치일 2026-06-27, 근거 커밋 해시 포함). Batch 2 인덱스는 `EXPLAIN PLAN` 결과 또는 인덱스 생성 확인 결과를 한 줄 기록.

- [ ] **Step 2: 커밋**

```bash
git add TASK.md TASK_DONE.md
git commit -m "docs: Batch 1~3 조치 완료 항목 TASK_DONE.md 이관"
```

---

## Self-Review (작성자 점검, 2026-06-27)

1. **Spec 커버리지:** 설계 spec §2 Batch 1(#1)→Task 1.1~1.2, Batch 2(#6,#7)→Task 2.1, Batch 3(#4,#5)→Task 3.1~3.8 매핑됨. Batch 4(#2,#3)는 spec §3 권고대로 별도 spec로 분리(범위 제외 명시).
2. **Placeholder 점검:** 모든 코드 스텝에 실제 코드 블록 포함. Task 3.2/3.4/3.6 테스트는 기존 테스트의 stub 패턴 재사용이 필요한 부분만 주석으로 위임(목록 public 메서드명·SecurityContext stub)했고 검증 골격(verify/given)은 구체화함 — 이는 기존 테스트 파일 의존이므로 실행자가 해당 파일에서 확인.
3. **타입/시그니처 일관성:** finder명 `findByTermBgNoInAndDelYn`(Task 3.1↔3.3↔3.4), `findByBseYyAndFntTbNmAndDelYn`(Task 3.5↔3.6↔3.7) 일치. 그룹 키 구분자 단말기 `"_"`, BBUGTM `"|"`로 각 배치 내 일관. 인덱스 컬럼명은 선행 검증 메모와 Task 2.1 DDL 일치(`DCR_ENO`,`DCD_STS_C`,`DCD_REQ_USID`,`APF_PRG_STS_C`,`DCD_REQ_DTM`,`FST_ENR_USID`,`DEL_YN`,`DOC_MNG_NO`,`FSG_YN`).
