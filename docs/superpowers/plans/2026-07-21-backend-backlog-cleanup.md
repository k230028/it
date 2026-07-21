# TASK.md 백엔드 섹션 전면 정리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TASK.md [백엔드] 잔여 9건(+ERR-08)을 구현·규칙화·결정·재분류로 전부 종결한다.

**Architecture:** 위험 오름차순 4개 Wave. Wave 1(BE-15·14·16 저위험 정합), Wave 2(BE-13+ERR-08·BE-12 성능), Wave 3(BE-02·06 규칙화 종결), Wave 4(BE-17 결정 세션·BE-03/18 External 재분류). 스펙: `docs/superpowers/specs/2026-07-21-backend-backlog-cleanup-design.md`.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, QueryDSL, Oracle(로컬 ITPAPP@127.0.0.1:11521/XEPDB1), Flyway, JUnit5+Mockito+AssertJ.

## Global Constraints

- 저장소 3개가 분리되어 있다: 코드=`it_backend`(중첩 git repo), DDL=`it_database`(중첩 git repo), 문서=루트 `C:\it`. 커밋은 각각 `git -C <repo>`로 수행한다.
- `it_backend` 작업은 브랜치 `chore/backend-backlog-cleanup`에서 수행하고 마지막 태스크에서 main에 merge한다. `it_database`·루트는 main에 직접 커밋한다.
- 모든 신규 주석·JavaDoc은 한글. public/service 메서드 JavaDoc은 입력값·반환값·실패 조건 기록 (`it_backend/CLAUDE.md` §9).
- 모든 코드 작업은 TDD: 실패 테스트 작성 → 실패 확인 → 최소 구현 → 통과 확인 → 커밋.
- Gradle 명령은 `it_backend` 디렉토리에서 실행: 단위 `./gradlew test`, Oracle IT `./gradlew integrationTest`. Oracle IT는 로컬 Oracle 기동 시에만 실행된다(미기동이면 skip — 반드시 기동 상태에서 실행할 것).
- 적용된 Flyway 스크립트는 수정 금지. 신규는 `V{YYYYMMDD_NNN}__{CamelCase}.sql`.
- 엔티티 파생 조회에서 `Ccodem.cId`는 JavaBeans 규칙 문제로 파생 쿼리 불가 → 명시적 JPQL 필수 (`CodeRepository` 클래스 JavaDoc 참조).
- 커밋 메시지는 기존 관례(`perf:`/`fix:`/`test:`/`docs:`/`chore:` + 한글 요약 + `(BE-XX)` 태그)를 따르고 다음 트레일러로 끝낸다:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: BE-15 — `Bplana` 복합키 길이 32→30 정합화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/entity/Bplana.java:38,43`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/plan/entity/BplanaColumnContractTest.java` (신규)

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `Bplana.prjMngNo`/`reqDocNo`의 `@Column(length = 30)` 계약. 물리 DDL(`it_database/ITPOWN_DDL_live.sql:1008-1009`의 `VARCHAR2(30 CHAR)`)·형제 엔티티 `Bplanm.reqDocNo`(length=30)와 일치.

- [ ] **Step 0: 작업 브랜치 생성**

```bash
git -C C:/it/it_backend checkout -b chore/backend-backlog-cleanup
```

- [ ] **Step 1: 실패 테스트 작성**

`BplanaColumnContractTest.java` 신규 작성:

```java
package com.kdb.it.domain.budget.plan.entity;

import jakarta.persistence.Column;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bplana ORM 매핑이 물리 DDL(TPRMPP_BPLANA, VARCHAR2(30 CHAR))과 일치하는지 고정하는 계약 테스트.
 */
class BplanaColumnContractTest {

    @Test
    @DisplayName("복합키 컬럼 길이가 물리 DDL(30)과 일치한다")
    void 복합키_컬럼길이_물리DDL_일치() throws Exception {
        Column abus = Bplana.class.getDeclaredField("prjMngNo").getAnnotation(Column.class);
        Column req = Bplana.class.getDeclaredField("reqDocNo").getAnnotation(Column.class);
        assertThat(abus.length()).isEqualTo(30);
        assertThat(req.length()).isEqualTo(30);
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd C:/it/it_backend && ./gradlew test --tests "*BplanaColumnContractTest*"`
Expected: FAIL — `expected: 30 but was: 32`

- [ ] **Step 3: 매핑 수정**

`Bplana.java` 38행·43행의 `length = 32`를 `length = 30`으로 변경 (두 곳 모두):

```java
    /** 프로젝트관리번호 (복합 PK의 첫 번째 키) */
    @Id
    @Column(name = "ABUS_MNG_NO", length = 30, comment = "프로젝트관리번호")
    private String prjMngNo;

    /** 요청문서번호 (복합 PK의 두 번째 키, BPLANM의 PLN_MNG_NO에 대응) */
    @Id
    @Column(name = "REQ_DOC_NO", length = 30, comment = "요청문서번호")
    private String reqDocNo;
```

- [ ] **Step 4: 통과 확인 + 전체 회귀**

Run: `./gradlew test --tests "*BplanaColumnContractTest*"` → PASS
Run: `./gradlew test` → BUILD SUCCESSFUL (전체 회귀)

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it/domain/budget/plan/entity/Bplana.java src/test/java/com/kdb/it/domain/budget/plan/entity/BplanaColumnContractTest.java
git -C C:/it/it_backend commit -m "fix: Bplana 복합키 길이를 물리 DDL(30)과 정합화 (BE-15)"
```

---

### Task 2: BE-14 — `TPRMPP_BPLANA` 역방향 조회 인덱스 + Oracle IT

**Files:**
- Create: `it_database/migrations/V20260721_001__AddBplanaReqDocNoIndex.sql`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/plan/repository/BplanaReqDocNoLookupIt.java` (신규)

**Interfaces:**
- Consumes: `BplanaRepository.findAllByReqDocNoAndDelYn(String, String)`, `findAllByReqDocNoInAndDelYn(Collection<String>, String)` (기존)
- Produces: 인덱스 `IX_TPRMPP_BPLANA_01 (REQ_DOC_NO, DEL_YN, ABUS_MNG_NO)`; BE-02 보충 IT 1건

- [ ] **Step 1: Oracle IT 작성 (조회 계약 고정 — 인덱스와 무관하게 결과 동등성 검증)**

`BplanaReqDocNoLookupIt.java` 신규 작성 (`PlanListProjectionIt` 픽스처 스타일 준수 — 고유 suffix, persist→flush→clear):

```java
package com.kdb.it.domain.budget.plan.repository;

import com.kdb.it.domain.budget.plan.entity.Bplana;
import com.kdb.it.support.AbstractOracleRepositoryTest;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * BPLANA 요청문서번호 역방향 조회(단건·IN)의 결과 계약을 실제 Oracle에서 검증한다 (BE-14/BE-02).
 */
class BplanaReqDocNoLookupIt extends AbstractOracleRepositoryTest {

    @Autowired BplanaRepository repository;
    @Autowired EntityManager entityManager;

    @Test
    @DisplayName("요청문서번호 단건·IN 조회가 활성 행만 반환하고 삭제 행을 제외한다")
    void 요청문서번호_역방향조회_계약() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String docA = "BE14-DOC-A-" + suffix;
        String docB = "BE14-DOC-B-" + suffix;
        entityManager.persist(link("BE14-PRJ-1-" + suffix, docA, "N"));
        entityManager.persist(link("BE14-PRJ-2-" + suffix, docA, "N"));
        entityManager.persist(link("BE14-PRJ-3-" + suffix, docA, "Y")); // 삭제 행 제외 대상
        entityManager.persist(link("BE14-PRJ-4-" + suffix, docB, "N"));
        entityManager.flush();
        entityManager.clear();

        List<Bplana> single = repository.findAllByReqDocNoAndDelYn(docA, "N");
        assertThat(single).hasSize(2)
                .allSatisfy(row -> assertThat(row.getDelYn()).isEqualTo("N"));

        List<Bplana> batch = repository.findAllByReqDocNoInAndDelYn(List.of(docA, docB), "N");
        assertThat(batch).hasSize(3);
        assertThat(batch).extracting(Bplana::getReqDocNo).containsOnly(docA, docB);
    }

    /** 감사 필드를 채운 BPLANA 픽스처 (BaseEntity NOT NULL 계약 충족). */
    private Bplana link(String prjMngNo, String reqDocNo, String delYn) {
        LocalDateTime now = LocalDateTime.of(2026, 7, 21, 9, 0);
        return Bplana.builder()
                .prjMngNo(prjMngNo).reqDocNo(reqDocNo)
                .delYn(delYn)
                .fstEnrDtm(now).fstEnrUsid("BE14-TEST")
                .lstChgDtm(now).lstChgUsid("BE14-TEST")
                .build();
    }
}
```

주의: `Bplana.builder()`의 감사 필드명이 다르면 `PlanListProjectionIt.java:57-72`의 실제 빌더 사용 예를 그대로 따른다.

- [ ] **Step 2: IT 실행 (인덱스 추가 전 — 결과 계약이 먼저 성립해야 함)**

Run: `cd C:/it/it_backend && ./gradlew integrationTest --tests "*BplanaReqDocNoLookupIt*"`
Expected: PASS (기존 파생 조회의 계약 검증이므로 인덱스 없이 통과. 실패하면 픽스처 필드부터 수정)

- [ ] **Step 3: 적용 전 실행계획 기록**

sqlplus 접속(`sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1` — 비밀번호는 환경변수/대화식 입력, 스크립트에 저장 금지) 후:

```sql
EXPLAIN PLAN FOR SELECT * FROM TPRMPP_BPLANA WHERE REQ_DOC_NO = 'X' AND DEL_YN = 'N';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC +ROWS +COST +PREDICATE'));
ROLLBACK;
```

Expected: `TABLE ACCESS FULL TPRMPP_BPLANA` (보조 인덱스 부재). 출력을 작업 로그에 기록.

- [ ] **Step 4: Flyway 스크립트 작성**

`V20260721_001__AddBplanaReqDocNoIndex.sql` 신규 (같은 날짜 선행 스크립트가 이미 있으면 `_002` 등으로 조정). `V20260629_002`의 멱등 패턴 재사용:

```sql
-- V20260721_001__AddBplanaReqDocNoIndex.sql
-- BPLANA 요청문서번호 역방향 조회 인덱스 (BE-14).
--   BplanaRepository.findAllByReqDocNoAndDelYn / findAllByReqDocNoInAndDelYn:
--   WHERE REQ_DOC_NO = :doc AND DEL_YN = 'N' — PK 선두가 ABUS_MNG_NO라 기존 PK로 커버 불가.
-- EXPLAIN 검증(2026-07-21): FULL SCAN → INDEX RANGE SCAN 전환 확인.
-- 가산형(추가만)·멱등: 동일 인덱스명 존재 시 생성을 건너뛴다.
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
    IF NOT idx_exists('IX_TPRMPP_BPLANA_01') THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IX_TPRMPP_BPLANA_01 ON TPRMPP_BPLANA (REQ_DOC_NO, DEL_YN, ABUS_MNG_NO)';
    END IF;
END;
/
```

- [ ] **Step 5: 로컬 적용 + 적용 후 실행계획 확인**

로컬 적용: `local-ext`/`local-int` 프로파일 bootRun 1회 기동 또는 sqlplus에서 스크립트 직접 실행(`@C:\it\it_database\migrations\V20260721_001__AddBplanaReqDocNoIndex.sql`). 이후 Step 3과 같은 EXPLAIN 재실행.
Expected: `INDEX RANGE SCAN IX_TPRMPP_BPLANA_01`. 전/후 계획을 스크립트 상단 주석의 "EXPLAIN 검증" 줄에 실측값으로 갱신.

- [ ] **Step 6: IT 재실행 (인덱스 후 결과 불변 확인)**

Run: `./gradlew integrationTest --tests "*BplanaReqDocNoLookupIt*"` → PASS

- [ ] **Step 7: 커밋 (repo 2곳)**

```bash
git -C C:/it/it_database add migrations/V20260721_001__AddBplanaReqDocNoIndex.sql
git -C C:/it/it_database commit -m "perf: BPLANA 요청문서번호 역방향 조회 인덱스 추가 (BE-14)"
git -C C:/it/it_backend add src/test/java/com/kdb/it/domain/budget/plan/repository/BplanaReqDocNoLookupIt.java
git -C C:/it/it_backend commit -m "test: BPLANA 역방향 조회 Oracle IT 추가 (BE-14/BE-02)"
```

---

### Task 3: BE-16 — 공통코드 일괄 업로드 배치화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/repository/CodeRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java:219-252` (`bulkUpsertCodes`)
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminServiceTest.java` (기존 209-229행 케이스 갱신 + 신규 케이스)

**Interfaces:**
- Consumes: `AdminDto.CodeRequest(cId, cdva, cNm, cdvaNm, cdvaDes, cdvaDtl, cdvaDtlC, cTp, cTpDes, hrkC, sttDt, endDt, cSqn)`, `Ccodem.update(cNm, cdvaDes, cdvaDtl, cdvaNm, cTp, cTpDes, hrkC, cSqn, endDt, cdvaDtlC)` (10-arg 오버로드)
- Produces: `CodeRepository.findAllByCIdInAndDelYn(Collection<String>, String) : List<Ccodem>` (신규 JPQL). `bulkUpsertCodes` 응답 계약(`Map.of("created", n, "updated", m)`) 불변.

- [ ] **Step 1: 실패 테스트 작성 — 배치 계약**

`AdminServiceTest.java`에 신규 테스트 추가 (기존 `bulkUpsertCodes_신규수정건수반환`은 Step 3에서 배치 스텁으로 갱신):

```java
    @Test
    @DisplayName("bulkUpsertCodes - 행 수와 무관하게 선조회 1회 + saveAll 1회만 수행한다")
    void bulkUpsertCodes_배치조회_행별SELECT제거() {
        String sttDt = "20260101";
        // 3행: CODE001/001 기존, CODE001/002 신규, CODE002/001 신규
        AdminDto.CodeRequest r1 = new AdminDto.CodeRequest("CODE001", "001", "코드1", null, null, null, null, null, null, null, sttDt, null, 1);
        AdminDto.CodeRequest r2 = new AdminDto.CodeRequest("CODE001", "002", "코드2", null, null, null, null, null, null, null, sttDt, null, 2);
        AdminDto.CodeRequest r3 = new AdminDto.CodeRequest("CODE002", "001", "코드3", null, null, null, null, null, null, null, sttDt, null, 3);
        Ccodem existing = Ccodem.builder().cId("CODE001").cdva("001").sttDt(sttDt).build();
        given(codeRepository.findAllByCIdInAndDelYn(anyCollection(), eq("N"))).willReturn(List.of(existing));

        var result = adminService.bulkUpsertCodes(new AdminDto.BulkCodeRequest(List.of(r1, r2, r3)));

        assertThat(result.get("updated")).isEqualTo(1);
        assertThat(result.get("created")).isEqualTo(2);
        verify(codeRepository, times(1)).findAllByCIdInAndDelYn(anyCollection(), eq("N"));
        verify(codeRepository, times(1)).saveAll(anyList());
        verify(codeRepository, never()).findByCIdAndCdvaAndSttDtAndDelYn(any(), any(), any(), any());
        verify(codeRepository, never()).save(any(Ccodem.class));
    }

    @Test
    @DisplayName("bulkUpsertCodes - 같은 요청 안의 중복 키는 신규 1건 + 수정 1건으로 처리한다")
    void bulkUpsertCodes_요청내중복키_후행행수정() {
        String sttDt = "20260101";
        AdminDto.CodeRequest first = new AdminDto.CodeRequest("CODE003", "001", "최초", null, null, null, null, null, null, null, sttDt, null, 1);
        AdminDto.CodeRequest dup = new AdminDto.CodeRequest("CODE003", "001", "후행", null, null, null, null, null, null, null, sttDt, null, 2);
        given(codeRepository.findAllByCIdInAndDelYn(anyCollection(), eq("N"))).willReturn(List.of());

        var result = adminService.bulkUpsertCodes(new AdminDto.BulkCodeRequest(List.of(first, dup)));

        // 현행 의미 보존: 1행째 신규 생성 → 2행째는 같은 키를 발견해 수정 (created 1, updated 1)
        assertThat(result.get("created")).isEqualTo(1);
        assertThat(result.get("updated")).isEqualTo(1);
    }
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests "*AdminServiceTest*"`
Expected: FAIL — `findAllByCIdInAndDelYn` 컴파일 오류(메서드 미존재). 리포지토리 메서드 추가 후 재실행하면 `never()` 검증 실패로 이어짐.

- [ ] **Step 3: 구현**

3-1. `CodeRepository.java`에 명시적 JPQL 배치 조회 추가 (`cId`는 파생 쿼리 불가 — 클래스 JavaDoc 참조):

```java
    /**
     * 코드ID 집합의 활성 코드 전체를 일괄 조회한다 (일괄 업로드 선조회용).
     *
     * @param cIds  코드ID 집합
     * @param delYn 삭제여부 ('N'=미삭제)
     * @return 해당 코드ID들의 활성 코드 목록
     */
    @Query("SELECT c FROM Ccodem c WHERE c.cId IN :cIds AND c.delYn = :delYn")
    java.util.List<Ccodem> findAllByCIdInAndDelYn(@Param("cIds") java.util.Collection<String> cIds,
                                                  @Param("delYn") String delYn);
```

3-2. `AdminService.bulkUpsertCodes` 재작성 (행별 SELECT·개별 save 제거, 카운터·검증·응답 계약 보존):

```java
        /**
         * 공통코드를 일괄 업로드(Upsert) 처리합니다.
         *
         * <p>요청에 포함된 코드ID 집합의 활성 코드를 1회 선조회한 뒤 메모리에서 존재 여부를
         * 판정합니다. 기존 코드는 Dirty Checking으로 수정하고 신규 코드만 {@code saveAll}로
         * 일괄 저장합니다. 같은 요청 안의 중복 키는 첫 행 생성 후 후행 행이 수정합니다.</p>
         *
         * @param req 일괄 업로드 요청 DTO (코드 목록)
         * @return 처리 결과 (created: 신규 건수, updated: 수정 건수)
         * @throws IllegalArgumentException 복합키 필수값(cId/cdva/sttDt)이 비어 있는 경우
         */
        @Transactional
        public Map<String, Integer> bulkUpsertCodes(AdminDto.BulkCodeRequest req) {
                for (AdminDto.CodeRequest item : req.codes()) {
                        validateCodeKey(item.cId(), item.cdva(), item.sttDt());
                }
                // 복합키(cId, cdva, sttDt) → 활성 코드 선조회 1회 (행별 SELECT 제거)
                Set<String> cIds = req.codes().stream().map(AdminDto.CodeRequest::cId)
                                .collect(java.util.stream.Collectors.toSet());
                Map<List<String>, Ccodem> byKey = new java.util.HashMap<>();
                if (!cIds.isEmpty()) {
                        for (Ccodem code : codeRepository.findAllByCIdInAndDelYn(cIds, "N")) {
                                byKey.put(List.of(code.getCId(), code.getCdva(), code.getSttDt()), code);
                        }
                }
                int created = 0;
                int updated = 0;
                List<Ccodem> newCodes = new ArrayList<>();
                for (AdminDto.CodeRequest item : req.codes()) {
                        List<String> key = List.of(item.cId(), item.cdva(), item.sttDt());
                        Ccodem existing = byKey.get(key);
                        if (existing != null) {
                                existing.update(item.cNm(), item.cdvaDes(), item.cdvaDtl(), item.cdvaNm(), item.cTp(),
                                                item.cTpDes(), item.hrkC(), item.cSqn(), item.endDt(), item.cdvaDtlC());
                                updated++;
                        } else {
                                Ccodem code = Ccodem.builder()
                                                .cId(item.cId())
                                                .cNm(item.cNm())
                                                .cdvaNm(item.cdvaNm())
                                                .cdva(item.cdva())
                                                .cdvaDes(item.cdvaDes())
                                                .cdvaDtl(item.cdvaDtl())
                                                .cdvaDtlC(item.cdvaDtlC())
                                                .cTp(item.cTp())
                                                .cTpDes(item.cTpDes())
                                                .hrkC(item.hrkC())
                                                .sttDt(item.sttDt())
                                                .endDt(item.endDt())
                                                .cSqn(item.cSqn())
                                                .build();
                                newCodes.add(code);
                                byKey.put(key, code); // 요청 내 중복 키의 후행 행은 수정 경로로 처리
                                created++;
                        }
                }
                codeRepository.saveAll(newCodes);
                return Map.of("created", created, "updated", updated);
        }
```

주의: 기존 코드는 검증을 행 처리 직전에 수행했으나 위 코드는 선두에서 전량 검증한다. 이로써 "일부 저장 후 검증 실패" 대신 "전량 검증 후 처리"가 되며 `@Transactional` 롤백 하에서 최종 관측 결과는 동일하다. `Ccodem`에 `getCId()`/`getCdva()`/`getSttDt()` getter가 있는지 확인하고(없으면 Lombok `@Getter` 확인) import(`java.util.Set`, `java.util.ArrayList`)를 정리한다.

3-3. 기존 테스트 `bulkUpsertCodes_신규수정건수반환`(209-229행)의 스텁을 배치 방식으로 갱신:

```java
        Ccodem existingCode = Ccodem.builder().cId("CODE001").cdva("001").sttDt(sttDt).build();
        given(codeRepository.findAllByCIdInAndDelYn(anyCollection(), eq("N"))).willReturn(List.of(existingCode));
        // when / then 의 건수 검증은 유지, verify(save)는 verify(saveAll)로 교체
```

- [ ] **Step 4: 통과 확인 + 전체 회귀**

Run: `./gradlew test --tests "*AdminServiceTest*"` → PASS
Run: `./gradlew test` → BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it/common/code/repository/CodeRepository.java src/main/java/com/kdb/it/common/admin/service/AdminService.java src/test/java/com/kdb/it/common/admin/service/AdminServiceTest.java
git -C C:/it/it_backend commit -m "perf: 공통코드 일괄 업로드 행별 SELECT·save 제거 (BE-16)"
```

---

### Task 4: BE-13(1/2) — 기준 계획 탐색 조인 단건 조회 + tie-break Oracle IT

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/repository/CouncilBaselineLookupIt.java` (신규)

**Interfaces:**
- Consumes: `Basctm`(itPtlAsctId, abusMngNo, itPtlAsctDbrTc, itPtlAsctPrgStsTc, fstEnrDtm, delYn), `Bplanm`(reqDocNo, bseYy, itPtlPlnTpC, delYn)
- Produces: `CouncilRepository.findBaselineReqDocNos(String dbrTc, String stsTc, String bseYy, String plnTp, String currentReqDocNo, Pageable) : List<String>` — Task 5가 사용

- [ ] **Step 1: Oracle IT 작성 (동률 tie-break 픽스처 포함)**

`CouncilBaselineLookupIt.java` 신규:

```java
package com.kdb.it.domain.council.repository;

import com.kdb.it.domain.budget.plan.entity.Bplanm;
import com.kdb.it.domain.council.entity.Basctm;
import com.kdb.it.support.AbstractOracleRepositoryTest;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 조정 계획의 기준(직전 승인 수립) 계획 탐색 조인 조회 계약을 실제 Oracle에서 검증한다 (BE-13/BE-02).
 *
 * <p>조건: 완료(13)된 계획협의회(dbrTc='02') × 활성 계획, 같은 대상년도, 계획구분 '신규',
 * 현재 계획 제외. 정렬: FST_ENR_DTM DESC, IT_PTL_ASCT_ID DESC (동률 tie-break).</p>
 */
class CouncilBaselineLookupIt extends AbstractOracleRepositoryTest {

    @Autowired CouncilRepository repository;
    @Autowired EntityManager entityManager;

    @Test
    @DisplayName("동률 등록시각에서는 협의회ID 내림차순으로 결정적으로 선택한다")
    void 기준계획탐색_조건필터_동률타이브레이크() {
        String sfx = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        LocalDateTime t = LocalDateTime.of(2026, 7, 21, 10, 0);
        String bseYy = "2126"; // 실데이터와 충돌하지 않는 픽스처 전용 연도

        // 계획 4건: 신규A, 신규B(동률), 조정C(구분 불일치), 신규D(타년도)
        entityManager.persist(plan("BE13-PLN-A-" + sfx, bseYy, "신규", "N", t));
        entityManager.persist(plan("BE13-PLN-B-" + sfx, bseYy, "신규", "N", t));
        entityManager.persist(plan("BE13-PLN-C-" + sfx, bseYy, "조정", "N", t));
        entityManager.persist(plan("BE13-PLN-D-" + sfx, "2127", "신규", "N", t));
        // 완료 협의회: A/B는 같은 등록시각(동률), ID는 B가 큼 → B가 선택되어야 함
        entityManager.persist(council("BE13-ASCT-1-" + sfx, "BE13-PLN-A-" + sfx, "02", "13", "N", t));
        entityManager.persist(council("BE13-ASCT-2-" + sfx, "BE13-PLN-B-" + sfx, "02", "13", "N", t));
        entityManager.persist(council("BE13-ASCT-3-" + sfx, "BE13-PLN-C-" + sfx, "02", "13", "N", t));
        entityManager.persist(council("BE13-ASCT-4-" + sfx, "BE13-PLN-D-" + sfx, "02", "13", "N", t));
        // 미완료(07)·삭제 협의회는 제외 대상
        entityManager.persist(council("BE13-ASCT-5-" + sfx, "BE13-PLN-A-" + sfx, "02", "07", "N", t.plusHours(1)));
        entityManager.persist(council("BE13-ASCT-6-" + sfx, "BE13-PLN-A-" + sfx, "02", "13", "Y", t.plusHours(2)));
        entityManager.flush();
        entityManager.clear();

        List<String> result = repository.findBaselineReqDocNos(
                "02", "13", bseYy, "신규", "BE13-CURRENT-" + sfx, PageRequest.of(0, 1));

        assertThat(result).containsExactly("BE13-PLN-B-" + sfx);
    }

    @Test
    @DisplayName("현재 계획 자신은 기준 계획 후보에서 제외한다")
    void 기준계획탐색_현재계획제외() {
        String sfx = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        LocalDateTime t = LocalDateTime.of(2026, 7, 21, 11, 0);
        String bseYy = "2126";
        String current = "BE13-PLN-CUR-" + sfx;
        entityManager.persist(plan(current, bseYy, "신규", "N", t));
        entityManager.persist(council("BE13-ASCT-7-" + sfx, current, "02", "13", "N", t));
        entityManager.flush();
        entityManager.clear();

        assertThat(repository.findBaselineReqDocNos(
                "02", "13", bseYy, "신규", current, PageRequest.of(0, 1))).isEmpty();
    }

    /** BPLANM 픽스처 — 실제 빌더 필수 필드는 PlanListProjectionIt.plan() 참조. */
    private Bplanm plan(String reqDocNo, String bseYy, String plnTp, String delYn, LocalDateTime t) {
        return Bplanm.builder()
                .reqDocNo(reqDocNo).bseYy(bseYy).itPtlPlnTpC(plnTp)
                .redtConeInf("{}")
                .delYn(delYn)
                .fstEnrDtm(t).fstEnrUsid("BE13-TEST").lstChgDtm(t).lstChgUsid("BE13-TEST")
                .build();
    }

    /** BASCTM 픽스처 — 빌더 필수 필드는 Basctm 엔티티 정의에 맞춰 보강한다. */
    private Basctm council(String asctId, String reqDocNo, String dbrTc, String stsTc,
            String delYn, LocalDateTime t) {
        return Basctm.builder()
                .itPtlAsctId(asctId).abusMngNo(reqDocNo)
                .itPtlAsctDbrTc(dbrTc).itPtlAsctPrgStsTc(stsTc)
                .delYn(delYn)
                .fstEnrDtm(t).fstEnrUsid("BE13-TEST").lstChgDtm(t).lstChgUsid("BE13-TEST")
                .build();
    }
}
```

주의: `Basctm`/`Bplanm` 빌더의 NOT NULL 필수 필드가 더 있으면(persist 시 제약 위반) 엔티티 정의를 열어 최소값을 보강한다. `Basctm`에 빌더가 없으면 엔티티의 생성자/팩토리를 사용한다. 픽스처 의미(구분/상태/년도/동률)는 바꾸지 않는다.

- [ ] **Step 2: 실패 확인**

Run: `./gradlew integrationTest --tests "*CouncilBaselineLookupIt*"`
Expected: FAIL — `findBaselineReqDocNos` 컴파일 오류(메서드 미존재)

- [ ] **Step 3: 리포지토리 조회 추가**

`CouncilRepository.java`에 추가 (기존 57-58행 파생 메서드는 Task 5에서 제거):

```java
    /**
     * 조정 계획의 기준(직전 승인 수립) 계획관리번호를 조인 단건 조회로 찾는다 (BE-13).
     *
     * <p>완료된 계획협의회와 활성 계획(BPLANM)을 조인해, 대상년도·계획구분이 일치하고
     * 현재 계획이 아닌 계획관리번호를 최근 등록순으로 반환한다. 동률 등록시각은
     * 협의회ID 내림차순으로 결정한다. 호출부는 {@code PageRequest.of(0, 1)}로 첫 건만 사용한다.</p>
     *
     * @param dbrTc            협의회 심의유형 ('02'=정보기술부문계획)
     * @param stsTc            협의회 진행상태 ('13'=완료)
     * @param bseYy            대상년도
     * @param plnTp            계획구분 ('신규'=수립)
     * @param currentReqDocNo  제외할 현재 계획관리번호
     * @param pageable         결과 제한 (첫 1건)
     * @return 조건에 맞는 계획관리번호 목록 (최근 등록·협의회ID 내림차순)
     */
    @Query("""
            SELECT c.abusMngNo FROM Basctm c, Bplanm p
            WHERE c.itPtlAsctDbrTc = :dbrTc
              AND c.itPtlAsctPrgStsTc = :stsTc
              AND c.delYn = 'N'
              AND p.reqDocNo = c.abusMngNo
              AND p.delYn = 'N'
              AND p.bseYy = :bseYy
              AND p.itPtlPlnTpC = :plnTp
              AND c.abusMngNo <> :currentReqDocNo
            ORDER BY c.fstEnrDtm DESC, c.itPtlAsctId DESC
            """)
    List<String> findBaselineReqDocNos(@Param("dbrTc") String dbrTc, @Param("stsTc") String stsTc,
            @Param("bseYy") String bseYy, @Param("plnTp") String plnTp,
            @Param("currentReqDocNo") String currentReqDocNo, org.springframework.data.domain.Pageable pageable);
```

- [ ] **Step 4: 통과 확인 + 인덱스 필요성 판정**

Run: `./gradlew integrationTest --tests "*CouncilBaselineLookupIt*"` → PASS

인덱스 판정(스펙 §Wave 2): sqlplus에서 BASCTM 행 수와 실행계획 확인:

```sql
SELECT COUNT(*) FROM TPRMPP_BASCTM;
EXPLAIN PLAN FOR
SELECT c.ABUS_MNG_NO FROM TPRMPP_BASCTM c, TPRMPP_BPLANM p
 WHERE c.IT_PTL_ASCT_DBR_TC='02' AND c.IT_PTL_ASCT_PRG_STS_TC='13' AND c.DEL_YN='N'
   AND p.REQ_DOC_NO=c.ABUS_MNG_NO AND p.DEL_YN='N' AND p.BSE_YY='2026' AND p.IT_PTL_PLN_TP_C='신규';
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY(NULL, NULL, 'BASIC +ROWS +COST'));
ROLLBACK;
```

판정 규칙: BASCTM이 수백 행 이하(협의회 마스터)면 FULL SCAN Cost가 낮아 인덱스를 추가하지 않고 판정 근거를 Task 12의 TASK_DONE 기록에 남긴다. Cost가 유의미하게 크면 Task 2와 같은 멱등 패턴으로 `IX_TPRMPP_BASCTM_02 (IT_PTL_ASCT_DBR_TC, IT_PTL_ASCT_PRG_STS_TC, DEL_YN, FST_ENR_DTM)` Flyway를 추가한다.

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java src/test/java/com/kdb/it/domain/council/repository/CouncilBaselineLookupIt.java
git -C C:/it/it_backend commit -m "perf: 기준 계획 탐색 조인 단건 조회·tie-break 추가 (BE-13)"
```

---

### Task 5: BE-13(2/2) — `findBaselinePlan` 전환 + 순회 제거

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java:195-217`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java:51-58` (구 파생 메서드 제거)
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/PlanEvaluationServiceTest.java`

**Interfaces:**
- Consumes: Task 4의 `findBaselineReqDocNos(...)`, `PlanService.getPlan(String) : PlanDto.DetailResponse`(404 시 `ResponseStatusException`)
- Produces: `findBaselinePlan`의 새 의미 — 후보 없음이면 null, 조회 예외는 전파(스킵 금지)

- [ ] **Step 1: 실패 테스트 작성**

`PlanEvaluationServiceTest.java`에 추가. 기존에 `findByItPtlAsctDbrTcAndItPtlAsctPrgStsTcAndDelYnOrderByFstEnrDtmDesc`를 스텁하는 케이스가 있으면 새 메서드 스텁으로 교체한다.

```java
    @Test
    @DisplayName("조정 협의회 기준 계획 탐색이 조인 단건 조회 1회 + getPlan 1회로 수행된다")
    void 기준계획탐색_조인단건조회_전환() {
        // given: getPlanTargets의 조정 계획 경로를 구성하는 기존 스텁에 더해
        given(councilRepository.findBaselineReqDocNos(eq("02"), eq("13"), eq("2026"), eq("신규"),
                eq("PLN-2026-0002"), any(Pageable.class))).willReturn(List.of("PLN-2026-0001"));
        // baseline getPlan 스텁: 기존 테스트의 DetailResponse 빌더 헬퍼 재사용
        given(planService.getPlan("PLN-2026-0001")).willReturn(baselinePlanResponse());

        // when: 조정 계획의 getPlanTargets 호출 (기존 조정 시나리오 헬퍼 재사용)
        service.getPlanTargets(ADJUST_ASCT_ID);

        // then: 완료 협의회 전체 순회 메서드는 더 이상 호출되지 않는다
        verify(councilRepository, times(1)).findBaselineReqDocNos(any(), any(), any(), any(), any(), any());
        verify(planService, times(1)).getPlan("PLN-2026-0001");
    }

    @Test
    @DisplayName("기준 계획 조회 중 발생한 예외는 삼키지 않고 전파한다")
    void 기준계획조회_예외전파() {
        given(councilRepository.findBaselineReqDocNos(any(), any(), any(), any(), any(), any()))
                .willReturn(List.of("PLN-2026-0001"));
        given(planService.getPlan("PLN-2026-0001")).willThrow(new IllegalStateException("DB 오류"));

        assertThatThrownBy(() -> service.getPlanTargets(ADJUST_ASCT_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DB 오류");
    }
```

주의: `ADJUST_ASCT_ID`·`baselinePlanResponse()`는 기존 테스트 파일의 조정 협의회 시나리오 픽스처를 재사용하라는 의미다. 파일에 조정 시나리오가 없으면 `getPlanTargets`가 "조정" 계획을 타도록 협의회·계획 스텁을 함께 구성한다(현재 계획 `itPtlPlnTpC="조정"`, `bseYy="2026"`, `reqDocNo="PLN-2026-0002"`).

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests "*PlanEvaluationServiceTest*"`
Expected: FAIL — 새 메서드 스텁 미사용(기존 순회 로직이 구 메서드 호출) 또는 예외가 스킵되어 전파 검증 실패

- [ ] **Step 3: 서비스 전환**

`PlanEvaluationService.findBaselinePlan`(195-217행)을 다음으로 교체:

```java
    /**
     * 조정 협의회 기준: 같은 대상년도의 '직전 승인(완료 13) 수립(신규) 계획'을 찾는다.
     *
     * <p>완료 협의회×활성 계획 조인 단건 조회로 후보를 결정한다(FST_ENR_DTM DESC,
     * IT_PTL_ASCT_ID DESC — 동률 결정적). 후보가 없으면 null을 반환하고,
     * 후보 계획 조회 실패는 데이터 정합성 문제이므로 삼키지 않고 전파한다(ERR-08).</p>
     *
     * @param bseYy           대상년도 (null이면 탐색하지 않음)
     * @param currentReqDocNo 현재 계획관리번호 (자기 자신 제외)
     * @return 기준 계획 상세 (없으면 null)
     */
    private PlanDto.DetailResponse findBaselinePlan(String bseYy, String currentReqDocNo) {
        if (bseYy == null) {
            return null;
        }
        List<String> reqDocNos = councilRepository.findBaselineReqDocNos(
                "02", "13", bseYy, "신규", currentReqDocNo,
                org.springframework.data.domain.PageRequest.of(0, 1));
        if (reqDocNos.isEmpty()) {
            return null;
        }
        return planService.getPlan(reqDocNos.getFirst());
    }
```

`CouncilRepository`의 구 파생 메서드 `findByItPtlAsctDbrTcAndItPtlAsctPrgStsTcAndDelYnOrderByFstEnrDtmDesc`(51-58행)는 다른 호출부가 없음을 확인(`grep -r` 검색) 후 제거한다. 다른 호출부가 있으면 제거하지 않고 유지한다.

- [ ] **Step 4: 통과 확인 + 전체 회귀**

Run: `./gradlew test --tests "*PlanEvaluationServiceTest*"` → PASS
Run: `./gradlew test` → BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java src/test/java/com/kdb/it/domain/council/service/PlanEvaluationServiceTest.java
git -C C:/it/it_backend commit -m "perf: 기준 계획 탐색 N+1·동률 비결정 제거 (BE-13)"
```

---

### Task 6: ERR-08 — 스냅샷 손상과 빈 결과 구분

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java` (`parseSnapshotBusinesses`, `countCostDetails`, `resolveBusinessNames`, 클래스에 `@Slf4j` 추가)
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/PlanEvaluationServiceTest.java`

**Interfaces:**
- Consumes: Task 5까지의 `PlanEvaluationService`
- Produces: 파싱 실패 정책 — `getPlanTargets` 경로(심의 대상·전산업무비 건수)는 `IllegalStateException`(문서번호 포함) 전파, `buildResultSummary` 경로(사업명 해석)는 WARN 로그 + 관리번호 폴백 유지

- [ ] **Step 1: 실패 테스트 작성**

```java
    @Test
    @DisplayName("계획 스냅샷 JSON이 손상되면 빈 목록 폴백 대신 문서번호를 포함한 예외를 던진다")
    void 스냅샷손상_명시적실패() {
        // given: getPlanTargets 대상 계획의 redtConeInf가 손상 JSON
        given(planService.getPlan("PLN-2026-0002")).willReturn(
                planResponse("PLN-2026-0002", "2026", "신규", "{손상된JSON"));

        assertThatThrownBy(() -> service.getPlanTargets(PLAN_ASCT_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PLN-2026-0002");
    }

    @Test
    @DisplayName("스냅샷이 비어 있으면(파싱 성공) 기존처럼 빈 심의 대상을 반환한다")
    void 빈스냅샷_정상폴백유지() {
        given(planService.getPlan("PLN-2026-0002")).willReturn(
                planResponse("PLN-2026-0002", "2026", "신규", "{\"prjSnapshots\":[]}"));

        CouncilDto.PlanTargetsResponse res = service.getPlanTargets(PLAN_ASCT_ID);
        assertThat(res.businesses()).isEmpty();
    }

    @Test
    @DisplayName("결과서 사업명 스냅샷 손상은 예외 없이 관리번호 폴백을 유지한다")
    void 결과서사업명_손상시_관리번호폴백() {
        // given: buildResultSummary 경로 — 평가 1건 + 손상 스냅샷
        given(planService.getPlan("PLN-2026-0002")).willReturn(
                planResponse("PLN-2026-0002", "2026", "신규", "{손상된JSON"));
        // 평가 행 스텁은 기존 buildResultSummary 테스트 픽스처 재사용

        CouncilDto.PlanResultSummaryResponse res = service.buildResultSummary(PLAN_ASCT_ID);
        assertThat(res.summaryHtml()).contains("PRJ-2026-0001"); // 사업명 대신 관리번호
    }
```

주의: `PLAN_ASCT_ID`·`planResponse(...)` 헬퍼는 기존 테스트 파일의 계획협의회 픽스처 형식에 맞춰 정의/재사용한다. DTO 접근자 이름(`businesses()`/`summaryHtml()`)이 다르면 `CouncilDto` 실제 정의를 따른다.

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests "*PlanEvaluationServiceTest*"`
Expected: FAIL — 손상 JSON에서 예외 없이 빈 목록 반환

- [ ] **Step 3: 구현**

3-1. 클래스에 `@lombok.extern.slf4j.Slf4j` 추가.

3-2. `parseSnapshotBusinesses`에 문서번호 문맥을 추가하고 파싱 실패를 전파 (호출부 2곳 — `getPlanTargets`의 `plan.getRedtConeInf()`, `baselineBudgetByBusiness`의 `baseline.getRedtConeInf()` — 모두 reqDocNo 인자 전달로 변경):

```java
    /**
     * 계획 스냅샷(redtConeInf)에서 정보화사업(경상 제외) 노드 목록을 추출한다.
     *
     * @param json     계획 스냅샷 JSON (null/blank면 빈 목록)
     * @param reqDocNo 진단 문맥용 계획관리번호
     * @return 정보화사업 노드 목록
     * @throws IllegalStateException 스냅샷 JSON 파싱에 실패한 경우 (손상 데이터 — 빈 계획과 구분)
     */
    private List<JsonNode> parseSnapshotBusinesses(String json, String reqDocNo) {
        List<JsonNode> result = new ArrayList<>();
        if (json == null || json.isBlank()) {
            return result;
        }
        try {
            JsonNode root = SNAPSHOT_MAPPER.readTree(json);
            JsonNode arr = root.has("prjSnapshots") ? root.get("prjSnapshots") : root.get("projects");
            if (arr != null && arr.isArray()) {
                for (JsonNode n : arr) {
                    JsonNode orn = n.get("ornYn");
                    if (orn != null && "Y".equals(orn.asText())) {
                        continue; // 경상사업 제외 → 정보화사업만
                    }
                    result.add(n);
                }
            }
        } catch (Exception e) {
            // 손상 스냅샷을 유효한 빈 계획과 구분해 명시적으로 실패시킨다 (ERR-08)
            log.error("계획 스냅샷 파싱 실패: reqDocNo={}", reqDocNo, e);
            throw new IllegalStateException("계획 스냅샷(JSON)이 손상되었습니다: reqDocNo=" + reqDocNo, e);
        }
        return result;
    }
```

3-3. `countCostDetails`도 동일하게 `reqDocNo` 인자 추가 + catch에서 `log.error` 후 `IllegalStateException` 전파 (호출부 `getPlanTargets` 마지막 줄 갱신).

3-4. `resolveBusinessNames`의 catch는 폴백을 유지하되 WARN 로그 추가:

```java
        } catch (Exception e) {
            // 결과서 사업명 해석 실패 — 관리번호 폴백을 유지하되 손상 사실을 경고로 남긴다 (ERR-08)
            log.warn("결과서 사업명 스냅샷 파싱 실패 — 관리번호로 폴백: reqDocNo={}", reqDocNo, e);
        }
```

3-5. 세 메서드의 기존 `// TODO:` 주석(158, 172, 213, 383행 부근)을 제거한다 (213행은 Task 5에서 이미 제거됨).

3-6. 예외 응답 계약 확인: `getPlanTargets`는 이미 89행에서 `IllegalStateException`을 던지고 있으므로 새 예외도 같은 전역 핸들러 매핑을 탄다. `GlobalExceptionHandler`(또는 `@RestControllerAdvice`)에서 `IllegalStateException`의 HTTP 매핑을 확인하고, 매핑이 없어 500으로 노출되면 그대로 두되(서버 데이터 손상이므로 5xx가 적절) 응답 본문에 문서번호 문맥이 포함되는지만 확인한다.

- [ ] **Step 4: 통과 확인 + 전체 회귀**

Run: `./gradlew test --tests "*PlanEvaluationServiceTest*"` → PASS
Run: `./gradlew test` → BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java src/test/java/com/kdb/it/domain/council/service/PlanEvaluationServiceTest.java
git -C C:/it/it_backend commit -m "fix: 평가 스냅샷 손상과 빈 결과 구분 (ERR-08)"
```

---

### Task 7: BE-12(1/2) — `getProjectsByIds` 특성화 테스트

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceBulkParityTest.java` (신규)

**Interfaces:**
- Consumes: `ProjectService.getProjectsByIds(ProjectDto.BulkGetRequest) : ProjectDto.BulkResponse(items, failedIds)`, `getProject(String) : ProjectDto.Response`
- Produces: 전환 전후 불변이어야 하는 계약의 테스트 고정 — Task 8의 안전망

- [ ] **Step 1: 특성화 테스트 작성 (현행 코드에서 즉시 PASS해야 함)**

새 파일 `ProjectServiceBulkParityTest.java`. 기존 `ProjectServiceTest`의 `@ExtendWith(MockitoExtension.class)` + 리포지토리 목 구성 방식을 그대로 복사해 세팅하고, 다음 계약을 고정한다:

완전한 예시 — 미존재 ID 케이스 (다른 케이스는 요청 ID 배열만 달리해 같은 구조로 작성):

```java
    /** 일괄 조회 요청 헬퍼 (bseYy 미지정 — DUP_BG 블록 비활성). */
    private ProjectDto.BulkGetRequest bulkRequest(String... ids) {
        ProjectDto.BulkGetRequest req = new ProjectDto.BulkGetRequest();
        req.setPrjMngNos(List.of(ids));
        return req;
    }

    /** 사업 픽스처 스텁: 단건 경로와 배치 경로 finder를 같은 데이터로 모두 등록한다. */
    private Bprojm stubProject(String id) {
        Bprojm project = Bprojm.builder().abusMngNo(id).sno(1).delYn("N").build(); // 실제 빌더 필수 필드에 맞춰 보강
        lenient().when(projectRepository.findByAbusMngNoAndDelYn(id, "N")).thenReturn(Optional.of(project));
        lenient().when(capplaRepository.findViewsByFntTbNmAndPkColNmAndFntTbCrySnoOrderByApfDcmNoDesc("BPROJM", id, 1))
                .thenReturn(List.of());
        lenient().when(bprojaRepository.findByAbusMngNoAndDelYn(id, "N")).thenReturn(List.of());
        lenient().when(bitemmRepository.findByAbusMngNoAndFntTbCrySnoAndDelYn(id, 1, "N")).thenReturn(List.of());
        return project;
    }

    @Test
    @DisplayName("미존재 ID는 items에서 제외되고 failedIds로 수집된다")
    void 미존재ID_failedIds_수집() {
        Bprojm a = stubProject("PRJ-A");
        lenient().when(projectRepository.findByAbusMngNoAndDelYn("PRJ-NONE", "N")).thenReturn(Optional.empty());
        // 배치 경로 스텁 (전환 후 사용): 존재하는 A만 반환
        lenient().when(projectRepository.findByAbusMngNoInAndDelYn(anyCollection(), eq("N"))).thenReturn(List.of(a));
        lenient().when(capplaRepository.findViewsByFntTbNmAndPkColNmInOrderByApfDcmNoDesc(eq("BPROJM"), anyList()))
                .thenReturn(List.of());
        lenient().when(bprojaRepository.findByAbusMngNoInAndDelYn(anyCollection(), eq("N"))).thenReturn(List.of());
        lenient().when(bitemmRepository.findByAbusMngNoInAndDelYn(anyCollection(), eq("N"))).thenReturn(List.of());
        lenient().when(corgnIRepository.findNameViewsByPrlmOgzCConeIn(anyCollection())).thenReturn(List.of());
        lenient().when(cuserIRepository.findNameViewsByEnoIn(anyCollection())).thenReturn(List.of());

        ProjectDto.BulkResponse res = service.getProjectsByIds(bulkRequest("PRJ-A", "PRJ-NONE"));

        assertThat(res.items()).hasSize(1);
        assertThat(res.items().getFirst().getAbusMngNo()).isEqualTo("PRJ-A");
        assertThat(res.failedIds()).containsExactly("PRJ-NONE");
    }

    @Test
    @DisplayName("요청 순서가 응답 순서에 보존된다")
    void 요청순서_보존() {
        // stubProject("PRJ-B"), stubProject("PRJ-A") + 배치 스텁 후 [PRJ-B, PRJ-A] 요청
        // assertThat(res.items()).extracting(ProjectDto.Response::getAbusMngNo).containsExactly("PRJ-B", "PRJ-A");
        // 위 미존재 케이스와 동일 구조 — 배치 스텁 반환 목록은 [b, a] 대신 [a, b]여도 순서가 보존되어야 한다
    }

    @Test
    @DisplayName("중복 ID는 중복 응답으로 반환된다")
    void 중복ID_중복응답() {
        // stubProject("PRJ-A") + 배치 스텁 후 [PRJ-A, PRJ-A] 요청
        // assertThat(res.items()).hasSize(2); 두 항목 모두 getAbusMngNo()=="PRJ-A"
    }

    @Test
    @DisplayName("단건 getProject와 일괄 getProjectsByIds의 항목 필드가 일치한다 (parity)")
    void 단건_일괄_동등성() {
        // stubProject("PRJ-A") + 배치 스텁 구성 후:
        // ProjectDto.Response single = service.getProject("PRJA-...");
        // ProjectDto.Response bulk = service.getProjectsByIds(bulkRequest("PRJ-A")).items().getFirst();
        // assertThat(bulk).usingRecursiveComparison()
        //         .ignoringFields("dupBgAmt", "assetDupBg", "costDupBg") // bseYy 지정 시 일괄 경로만 채우는 필드
        //         .isEqualTo(single);
    }
```

주의: `BulkResponse`의 접근자 이름(`items()`/`failedIds()`)과 `Bprojm` 빌더 필수 필드는 실제 DTO·엔티티 정의를 열어 맞춘다. 나머지 3개 테스트의 주석 처리된 본문은 첫 번째 완전한 예시와 같은 스텁 구조로 작성한다 — 구조가 동일하므로 stubProject/bulkRequest 헬퍼를 재사용하면 각 10줄 내외다.

각 케이스의 스텁은 현행 코드가 사용하는 단건 경로 finder(`projectRepository.findByAbusMngNoAndDelYn`, `capplaRepository.findViewsByFntTbNmAndPkColNmAndFntTbCrySnoOrderByApfDcmNoDesc`, `bprojaRepository.findByAbusMngNoAndDelYn`, `bitemmRepository.findByAbusMngNoAndFntTbCrySnoAndDelYn` 등)와 Task 8 이후 사용할 배치 finder(`findByAbusMngNoInAndDelYn`, `findViewsByFntTbNmAndPkColNmInOrderByApfDcmNoDesc`, `findNameViewsByPrlmOgzCConeIn`, `findNameViewsByEnoIn` 등)를 **같은 픽스처 데이터로 모두** 스텁한다(`lenient()` 사용 — 전환 전에는 배치 스텁이, 전환 후에는 단건 스텁 일부가 미사용이 되므로). 이렇게 하면 이 테스트는 전환 전후 모두 의미 있게 통과해야 하는 안전망이 된다.

- [ ] **Step 2: 현행 코드에서 통과 확인**

Run: `./gradlew test --tests "*ProjectServiceBulkParityTest*"`
Expected: PASS (특성화 — 현행 동작의 고정)

- [ ] **Step 3: 커밋**

```bash
git -C C:/it/it_backend add src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceBulkParityTest.java
git -C C:/it/it_backend commit -m "test: 사업 일괄 조회 특성화 테스트 고정 (BE-12)"
```

---

### Task 8: BE-12(2/2) — `getProjectsByIds` 영역별 IN 배치 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:740-786` + 신규 private `enrichProjectBulkDetail`
- Test: `ProjectServiceBulkParityTest.java`(쿼리 횟수 케이스 추가), 기존 `ProjectServiceTest`·`ProjectServiceCoverageTest`·`PlanServiceTest`·`PlanEvaluationServiceTest`·`ProjectControllerTest` 스텁 정비

**Interfaces:**
- Consumes: `projectRepository.findByAbusMngNoInAndDelYn(Collection,String)`, `capplaRepository.findViewsByFntTbNmAndPkColNmInOrderByApfDcmNoDesc(String,List)`(view에 `getFntTbCrySno()` 존재), `capplmRepository.findSummaryViewsByApfMngNoIn(List)`, `cdecimRepository.findReadViewsByDcdMngNoInOrderByDcrSqnSnoAsc(List)`, `bprojaRepository.findByAbusMngNoInAndDelYn(Collection,String)`, `bitemmRepository.findByAbusMngNoInAndDelYn(Collection,String)`, `corgnIRepository.findNameViewsByPrlmOgzCConeIn(Collection)`, `cuserIRepository.findNameViewsByEnoIn(Collection)`, `representativeStatus(List<Bproja>)`, `enrichItemIoeCNames(List)`, `projectBudgetSummaryService.applyBudgetSummary(Response, List<Bitemm>)`
- Produces: `getProjectsByIds` 시그니처·응답 계약 불변, 내부만 배치화. 호출 3곳(`PlanEvaluationService:185`, `PlanService:229`, `ProjectController:209`) 무변경.

- [ ] **Step 1: 실패 테스트 작성 — 쿼리 횟수(호출 횟수) 회귀**

`ProjectServiceBulkParityTest.java`에 추가:

```java
    @Test
    @DisplayName("N건 일괄 조회 시 영역별 배치 조회가 각 1회만 수행된다 (ID별 반복 조회 금지)")
    void 일괄조회_영역별배치_1회() {
        // given: 사업 3건 픽스처를 배치 finder 스텁으로 구성 (Task 7 픽스처 재사용)

        service.getProjectsByIds(bulkRequest("A", "B", "C"));

        verify(projectRepository, times(1)).findByAbusMngNoInAndDelYn(anyCollection(), eq("N"));
        verify(capplaRepository, times(1)).findViewsByFntTbNmAndPkColNmInOrderByApfDcmNoDesc(eq("BPROJM"), anyList());
        verify(bprojaRepository, times(1)).findByAbusMngNoInAndDelYn(anyCollection(), eq("N"));
        verify(bitemmRepository, times(1)).findByAbusMngNoInAndDelYn(anyCollection(), eq("N"));
        verify(corgnIRepository, times(1)).findNameViewsByPrlmOgzCConeIn(anyCollection());
        verify(cuserIRepository, times(1)).findNameViewsByEnoIn(anyCollection());
        // ID별 단건 경로가 더 이상 호출되지 않음
        verify(projectRepository, never()).findByAbusMngNoAndDelYn(any(), any());
        verify(bitemmRepository, never()).findByAbusMngNoAndFntTbCrySnoAndDelYn(any(), any(), any());
    }
```

- [ ] **Step 2: 실패 확인**

Run: `./gradlew test --tests "*ProjectServiceBulkParityTest*"`
Expected: FAIL — 현행 구현은 ID별 `findByAbusMngNoAndDelYn` 3회 호출

- [ ] **Step 3: 구현**

3-1. `getProjectsByIds` 본문 교체 (기존 DUP_BG 블록 754-784행은 그대로 유지):

```java
    public ProjectDto.BulkResponse getProjectsByIds(ProjectDto.BulkGetRequest request) {
        // BPROJM 일괄 조회 후 요청 순서·중복 의미를 보존해 조립 (ID별 getProject 반복 제거 — BE-12)
        Map<String, Bprojm> projectById = projectRepository
                .findByAbusMngNoInAndDelYn(request.getPrjMngNos(), "N").stream()
                .collect(Collectors.toMap(p -> p.getAbusMngNo(), p -> p, (a, b) -> a));

        List<Bprojm> projects = new ArrayList<>();
        List<ProjectDto.Response> responses = new ArrayList<>();
        List<String> failedIds = new ArrayList<>();
        for (String prjMngNo : request.getPrjMngNos()) {
            Bprojm project = projectById.get(prjMngNo);
            if (project == null) {
                failedIds.add(prjMngNo); // 미존재 항목은 failedIds로 수집
                continue;
            }
            projects.add(project);
            responses.add(ProjectDto.Response.fromEntity(project));
        }
        if (!failedIds.isEmpty()) {
            log.warn("bulk-get 누락: type=project, failedIds={}", failedIds);
        }

        enrichProjectBulkDetail(projects, responses);

        // (이하 기존 TPRMPP_BBUGTM 편성예산(DUP_BG) 일괄 조회 블록 그대로 유지)
        ...
        return new ProjectDto.BulkResponse(responses, failedIds);
    }
```

3-2. 신규 private `enrichProjectBulkDetail` 추가 — `getProject()` 단건 조립(197-241행)과 **필드·순서·폴백 의미가 동일**하도록, `enrichProjectListBatch`(796행~)의 배치 패턴을 상세 조립에 맞춰 재구성:

```java
    /**
     * 일괄 상세 응답에 신청서·코드명·상태·품목·예산합계를 배치로 주입한다 (BE-12).
     *
     * <p>단건 {@link #getProject(String)}의 조립 순서·폴백 의미를 그대로 따르되,
     * ID별 반복 조회 대신 영역별 IN 배치 조회(CAPPLA/CAPPLM/CDECIM/BPROJA/BITEMM/CORGNI/CUSERI
     * 각 1회)로 수행한다. 신청서·품목은 프로젝트 SNO 일치 행만 사용한다.</p>
     *
     * @param projects  조회된 사업 엔티티 (responses와 같은 인덱스)
     * @param responses 주입 대상 응답 DTO
     */
    private void enrichProjectBulkDetail(List<Bprojm> projects, List<ProjectDto.Response> responses) {
        if (projects.isEmpty()) {
            return;
        }
        List<String> prjMngNos = projects.stream().map(p -> p.getAbusMngNo()).distinct().toList();

        // 1. CAPPLA 배치: (관리번호, SNO)별 최신 1건 — 단건 setApplicationInfo와 같은 SNO 일치 기준
        Map<String, com.kdb.it.common.approval.repository.ApplicationMapRepository.ApplicationMapView> latestCappla =
                new java.util.LinkedHashMap<>();
        for (var c : capplaRepository.findViewsByFntTbNmAndPkColNmInOrderByApfDcmNoDesc("BPROJM", prjMngNos)) {
            latestCappla.putIfAbsent(c.getPkColNm() + "|" + c.getFntTbCrySno(), c); // DESC 정렬 → 첫 행이 최신
        }

        // 2. CAPPLM + CDECIM 배치
        List<String> apfMngNos = latestCappla.values().stream().map(v -> v.getApfDcmNo()).distinct().toList();
        Map<String, com.kdb.it.common.approval.repository.ApplicationRepository.ApplicationSummaryView> capplmMap =
                capplmRepository.findSummaryViewsByApfMngNoIn(apfMngNos).stream()
                        .collect(Collectors.toMap(v -> v.getApfMngNo(), v -> v));
        Map<String, List<com.kdb.it.common.approval.repository.ApproverRepository.ApproverReadView>> decisionMap =
                cdecimRepository.findReadViewsByDcdMngNoInOrderByDcrSqnSnoAsc(apfMngNos).stream()
                        .collect(Collectors.groupingBy(v -> v.getDcdMngNo()));

        // 3. BPROJA 배치 (대표상태 + 단계별 상태코드)
        Map<String, List<com.kdb.it.domain.budget.project.entity.Bproja>> bprojaByPrj =
                bprojaRepository.findByAbusMngNoInAndDelYn(prjMngNos, "N").stream()
                        .collect(Collectors.groupingBy(v -> v.getAbusMngNo()));

        // 4. BITEMM 배치 (SNO 일치 필터는 조립 단계에서)
        Map<String, List<com.kdb.it.domain.budget.project.entity.Bitemm>> itemsByPrj =
                bitemmRepository.findByAbusMngNoInAndDelYn(prjMngNos, "N").stream()
                        .collect(Collectors.groupingBy(v -> v.getAbusMngNo()));

        // 5. 부서명·사용자명 배치 (단건 setCodeNames가 참조하는 필드 전체를 수집)
        Set<String> orgCodes = new java.util.HashSet<>();
        Set<String> userEnos = new java.util.HashSet<>();
        for (ProjectDto.Response r : responses) {
            if (r.getDvmDpmC() != null && !r.getDvmDpmC().isEmpty()) orgCodes.add(r.getDvmDpmC());
            if (r.getSvnDpmC() != null && !r.getSvnDpmC().isEmpty()) orgCodes.add(r.getSvnDpmC());
            if (r.getDvmUsid() != null && !r.getDvmUsid().isEmpty()) userEnos.add(r.getDvmUsid());
            if (r.getTlrUsid() != null && !r.getTlrUsid().isEmpty()) userEnos.add(r.getTlrUsid());
            if (r.getUsid() != null && !r.getUsid().isEmpty()) userEnos.add(r.getUsid());
            if (r.getDvmTlrUsid() != null && !r.getDvmTlrUsid().isEmpty()) userEnos.add(r.getDvmTlrUsid());
        }
        Map<String, String> orgNameMap = corgnIRepository.findNameViewsByPrlmOgzCConeIn(orgCodes).stream()
                .collect(Collectors.toMap(v -> v.getPrlmOgzCCone(), v -> v.getBbrNm()));
        Map<String, String> userNameMap = cuserIRepository.findNameViewsByEnoIn(userEnos).stream()
                .collect(Collectors.toMap(v -> v.getEno(), v -> v.getUsrNm()));

        // 6. 조립 — 단건 getProject와 동일 순서·의미
        for (int i = 0; i < projects.size(); i++) {
            Bprojm project = projects.get(i);
            ProjectDto.Response response = responses.get(i);

            // 6-1. 신청서 정보 (SNO 일치 최신 1건 — setApplicationInfo와 동일)
            var cappla = latestCappla.get(project.getAbusMngNo() + "|" + project.getSno());
            if (cappla != null) {
                response.setApfMngNo(cappla.getApfDcmNo());
                var capplm = capplmMap.get(cappla.getApfDcmNo());
                if (capplm != null) {
                    response.setApfSts(capplm.getItPtlApfPrgStsC() == null ? null
                            : com.kdb.it.common.approval.domain.ApprovalStatus
                                    .ofCode(capplm.getItPtlApfPrgStsC()).label());
                    response.setApplicationInfo(ApplicationInfoDto.fromReadViews(
                            capplm, decisionMap.getOrDefault(cappla.getApfDcmNo(), List.of())));
                }
            }

            // 6-2. 주관부서명 스냅샷 우선 → 6-3의 조회는 null일 때만 폴백 (단건과 동일)
            if (project.getSvnDpmNm() != null) {
                response.setSvnDpmCNm(project.getSvnDpmNm());
            }

            // 6-3. 부서명·사용자명 주입 (setCodeNames와 동일 필드·존재 시에만 설정)
            if (response.getDvmDpmC() != null && orgNameMap.containsKey(response.getDvmDpmC()))
                response.setDvmDpmCNm(orgNameMap.get(response.getDvmDpmC()));
            if (response.getSvnDpmCNm() == null
                    && response.getSvnDpmC() != null && orgNameMap.containsKey(response.getSvnDpmC()))
                response.setSvnDpmCNm(orgNameMap.get(response.getSvnDpmC()));
            if (response.getDvmUsid() != null && userNameMap.containsKey(response.getDvmUsid()))
                response.setDvmUsidNm(userNameMap.get(response.getDvmUsid()));
            if (response.getTlrUsid() != null && userNameMap.containsKey(response.getTlrUsid()))
                response.setTlrUsidNm(userNameMap.get(response.getTlrUsid()));
            if (response.getUsid() != null && userNameMap.containsKey(response.getUsid()))
                response.setUsidNm(userNameMap.get(response.getUsid()));
            if (response.getDvmTlrUsid() != null && userNameMap.containsKey(response.getDvmTlrUsid()))
                response.setDvmTlrUsidNm(userNameMap.get(response.getDvmTlrUsid()));

            // 6-4. BPROJA 대표상태·단계별 상태코드 (단건과 동일)
            List<com.kdb.it.domain.budget.project.entity.Bproja> bprojaRows =
                    bprojaByPrj.getOrDefault(project.getAbusMngNo(), List.of());
            response.setStsTc(representativeStatus(bprojaRows));
            response.setBprojaStsCodes(bprojaRows.stream()
                    .map(v -> v.getStsTc()).filter(java.util.Objects::nonNull).toList());

            // 6-5. 품목 (SNO 일치) + 품목구분명 + 예산합계 (단건과 동일)
            List<com.kdb.it.domain.budget.project.entity.Bitemm> bitemms =
                    itemsByPrj.getOrDefault(project.getAbusMngNo(), List.of()).stream()
                            .filter(b -> java.util.Objects.equals(b.getFntTbCrySno(), project.getSno()))
                            .toList();
            List<ProjectDto.BitemmDto> itemDtos = bitemms.stream()
                    .map(ProjectDto.BitemmDto::fromEntity).toList();
            enrichItemIoeCNames(itemDtos);
            response.setItems(itemDtos);
            projectBudgetSummaryService.applyBudgetSummary(response, bitemms);
        }
    }
```

구현 시 확인 사항:
- 단건 `setCodeNames`(1021행~)가 위 6-3에 나열한 필드 외의 것을 더 설정하면(파일에서 1021~1094행 전체 확인) 그 필드도 같은 방식으로 배치 맵에 추가한다. parity 테스트가 안전망이다.
- `enrichProjectListBatch`는 목록 경로 전용으로 그대로 두고 수정하지 않는다.
- `getProject()` 단건 경로도 수정하지 않는다.

3-3. 기존 테스트 정비: `ProjectServiceTest`의 getProjectsByIds 7케이스, `ProjectServiceCoverageTest:1056`, `PlanServiceTest`(5 스텁), `PlanEvaluationServiceTest`(2 스텁 + 1 verify), `ProjectControllerTest:170`을 실행해 실패하는 스텁을 배치 finder 스텁으로 교체한다. **검증 대상(응답 계약)은 바꾸지 않고 스텁만 교체**한다.

- [ ] **Step 4: 통과 확인 + 전체 회귀**

Run: `./gradlew test --tests "*ProjectServiceBulkParityTest*"` → PASS (특성화 4건 + 횟수 1건 모두)
Run: `./gradlew test` → BUILD SUCCESSFUL
Run: `./gradlew integrationTest` → BUILD SUCCESSFUL (로컬 Oracle 기동 상태)

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_backend add -A src/main/java/com/kdb/it/domain/budget/project src/test/java
git -C C:/it/it_backend commit -m "perf: 사업 일괄 상세 조회 영역별 IN 배치 전환 (BE-12)"
```

---

### Task 9: BE-02 보충 — `PlanEvaluationRepository` finder Oracle IT

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/repository/PlanEvaluationFinderIt.java` (신규)

**Interfaces:**
- Consumes: `PlanEvaluationRepository.findByItPtlAsctIdAndDelYn(String, String)`, `findByItPtlAsctIdAndEnoAndDelYn(String, String, String)` (기존 파생 finder), `Bplevm` 엔티티
- Produces: BE-02 보충 완료 — IT 미보유 조회 3건 중 마지막 1건 (BplanaRepository는 Task 2, Council baseline은 Task 4에서 완료)

- [ ] **Step 1: Oracle IT 작성**

```java
package com.kdb.it.domain.council.repository;

import com.kdb.it.domain.council.entity.Bplevm;
import com.kdb.it.support.AbstractOracleRepositoryTest;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 사업별 평가의견(BPLEVM) 파생 finder의 필터·null 계약을 실제 Oracle에서 검증한다 (BE-02).
 */
class PlanEvaluationFinderIt extends AbstractOracleRepositoryTest {

    @Autowired PlanEvaluationRepository repository;
    @Autowired EntityManager entityManager;

    @Test
    @DisplayName("협의회별·협의회+사번별 조회가 활성 행만 반환한다")
    void 평가finder_활성행_필터계약() {
        String sfx = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String asct = "BE02-ASCT-" + sfx;
        entityManager.persist(eval(asct, "BE02-E1-" + sfx, "PRJ-1", "Y", "적정 사유", "N"));
        entityManager.persist(eval(asct, "BE02-E1-" + sfx, "PRJ-2", "N", "유보 사유", "N"));
        entityManager.persist(eval(asct, "BE02-E2-" + sfx, "PRJ-1", "Y", "적정 사유", "N"));
        entityManager.persist(eval(asct, "BE02-E2-" + sfx, "PRJ-2", "Y", "삭제 행", "Y"));
        entityManager.flush();
        entityManager.clear();

        List<Bplevm> all = repository.findByItPtlAsctIdAndDelYn(asct, "N");
        assertThat(all).hasSize(3);

        List<Bplevm> mine = repository.findByItPtlAsctIdAndEnoAndDelYn(asct, "BE02-E2-" + sfx, "N");
        assertThat(mine).hasSize(1);
        assertThat(mine.getFirst().getPprtYn()).isEqualTo("Y");
    }

    /** BPLEVM 픽스처 — 빌더 필수 필드는 Bplevm 엔티티 정의에 맞춰 보강한다. */
    private Bplevm eval(String asctId, String eno, String abusMngNo, String pprtYn,
            String opnn, String delYn) {
        LocalDateTime t = LocalDateTime.of(2026, 7, 21, 9, 0);
        return Bplevm.builder()
                .itPtlAsctId(asctId).eno(eno).abusMngNo(abusMngNo)
                .pprtYn(pprtYn).evalOpnn(opnn)
                .delYn(delYn)
                .fstEnrDtm(t).fstEnrUsid("BE02-TEST").lstChgDtm(t).lstChgUsid("BE02-TEST")
                .build();
    }
}
```

주의: `PlanEvaluationRepository`의 실제 finder 이름·`Bplevm` 빌더 필드는 파일을 열어 확인 후 맞춘다. `Bplevm`의 PK가 시퀀스 채번이면 persist 흐름이 다를 수 있으므로 `PlanEvaluationService.saveEvaluation`(§5.12.1.1 persist 패턴)을 참고한다.

- [ ] **Step 2: 실행 확인**

Run: `./gradlew integrationTest --tests "*PlanEvaluationFinderIt*"`
Expected: PASS (기존 finder의 계약 검증)

- [ ] **Step 3: 커밋**

```bash
git -C C:/it/it_backend add src/test/java/com/kdb/it/domain/council/repository/PlanEvaluationFinderIt.java
git -C C:/it/it_backend commit -m "test: 사업별 평가의견 finder Oracle IT 추가 (BE-02)"
```

---

### Task 10: BE-02·BE-06 상시 규칙화 — `it_backend/CLAUDE.md` 명문화

**Files:**
- Modify: `it_backend/CLAUDE.md` §9 (테스트·주석·운영)

**Interfaces:**
- Consumes: Task 2·4·9의 IT 보충 완료
- Produces: BE-02·BE-06을 백로그에서 종결할 근거 규칙 (Task 12가 참조)

- [ ] **Step 1: §9에 규칙 2줄 추가**

`it_backend/CLAUDE.md` §9의 "로컬 Oracle 통합 테스트는 `@Tag("it")`와 `integrationTest` 태스크를 사용합니다." 줄 다음에 추가:

```markdown
- 신규 QueryDSL·JPQL·네이티브 조회를 추가할 때는 `AbstractOracleRepositoryTest` 기반 Oracle 통합 테스트로 결과 동등성, 정렬, null 계약을 함께 검증합니다.
```

같은 §9의 Javadoc 문단("Javadoc 기본 생성자 경고는 …") 끝에 한 문장 추가:

```markdown
  신규 코드에서 미분류 Javadoc 경고를 늘리지 않으며, 기존 허용 잔여는 기능 변경 시 의미 있는 공개 계약부터 점진 정리합니다.
```

- [ ] **Step 2: 커밋**

```bash
git -C C:/it/it_backend add CLAUDE.md
git -C C:/it/it_backend commit -m "docs: 신규 조회 IT 필수·Javadoc 경고 불허 규칙 명문화 (BE-02/BE-06)"
```

---

### Task 11: `it_backend` 브랜치 병합 + 최종 검증 게이트

**Files:**
- 없음 (검증·병합만)

**Interfaces:**
- Consumes: Task 1~10의 모든 커밋
- Produces: main에 병합된 구현 — Task 12의 문서 이관 전제

- [ ] **Step 1: 최종 검증 3종 실행**

```bash
cd C:/it/it_backend
./gradlew test --rerun-tasks
./gradlew integrationTest
./gradlew jacocoTestCoverageVerification
```

Expected: 모두 BUILD SUCCESSFUL. 실패 시 병합하지 않고 해당 태스크로 돌아가 수정한다. 결과 수치(테스트 건수·skip)를 기록해 Task 12의 TASK_DONE 메모에 사용한다.

- [ ] **Step 2: main 병합**

```bash
git -C C:/it/it_backend checkout main
git -C C:/it/it_backend merge --no-ff chore/backend-backlog-cleanup -m "merge: 백엔드 잔여과제 정리 Wave 1~3 (BE-12~16, ERR-08, BE-02/06)"
```

---

### Task 12: TASK.md·TASK_DONE.md 반영 (완료 이관 + External 재분류)

**Files:**
- Modify: `C:\it\TASK.md` (⚙️ 백엔드 섹션, ⚠️ 에러 처리 섹션)
- Modify: `C:\it\TASK_DONE.md` (완료 이관 기록 추가)

**Interfaces:**
- Consumes: Task 11 병합 완료, Task 2·4의 EXPLAIN 실측 기록
- Produces: 백엔드 섹션에 BE-03·BE-17·BE-18 3건만 잔존 (BE-17은 Task 13에서 처리)

- [ ] **Step 1: TASK.md 백엔드 섹션 정리**

BE-02, BE-06, BE-12, BE-13, BE-14, BE-15, BE-16 행 7개를 삭제하고, BE-18 행을 다음으로 교체:

```markdown
| BE-18 | 🏛️ External | 정리   | P2 구 검토자 API 경로 제거                                                | 재개 조건: 전역 `/api/reviews/reviewers` 경로가 운영에 1릴리스 배포된 후 14일간 구 경로 WARN 호출 0건. 조건 충족 시 제거 대상: `ReviewerController.getReviewersLegacy`(`/{docMngNo}/reviewers` 라우트 포함)와 `ReviewerControllerTest.getReviewers_구경로호환_200`. 충족 전에는 호환 경로와 WARN 관측 유지. |
```

BE-03 행을 다음으로 교체:

```markdown
| BE-03 | 🏛️ External | 성능   | 경계선 프로젝션 후보 9개 운영 근거 재평가                                | 대상: Estimate/Application 마스터, 공통코드, 가이드, 게시판 메타·댓글, 조직 전체 목록, Project/Cost wide 검색, 알림함. 재개 조건(운영 데이터 확보): ① 대상 경로별 AWR/SQL 실행 통계 ② API 호출량 ③ Project/Cost 목록·알림함 응답 계약 분리 결정. 확보 전 구현 착수 금지. 근거: `docs/superpowers/reports/2026-07-be03-projection-survey.md` §경계선과 제외 근거. |
```

에러 처리 섹션에서 ERR-08 행을 삭제한다 (ERR-09·ERR-10은 유지).

- [ ] **Step 2: TASK_DONE.md 이관 기록 추가**

문서 상단(최근 기록 위치)에 기존 2026-07-20 백엔드 조치 기록과 같은 형식으로 추가:

```markdown
### ✅ 2026-07-21 백엔드 잔여과제 전면 정리 (Wave 1~3)

> `TASK.md` [백엔드] 잔여 중 즉시 구현 가능 5건과 ERR-08을 해소하고, BE-02·BE-06을 상시 규칙으로 `it_backend/CLAUDE.md`에 이관했습니다. 설계: `docs/superpowers/specs/2026-07-21-backend-backlog-cleanup-design.md`, 계획: `docs/superpowers/plans/2026-07-21-backend-backlog-cleanup.md`.

| 상태 | Wave | 과제 | 조치 |
| ---- | ---- | ---- | ---- |
| ✅ Done | 1 | BE-15 Bplana 복합키 길이 정합화 | ORM length 32→30 (물리 DDL·Bplanm과 일치), `BplanaColumnContractTest`로 계약 고정. |
| ✅ Done | 1 | BE-14 BPLANA 역방향 조회 인덱스 | `V20260721_001__AddBplanaReqDocNoIndex.sql` `(REQ_DOC_NO, DEL_YN, ABUS_MNG_NO)`. EXPLAIN: FULL→INDEX RANGE 확인. IT `BplanaReqDocNoLookupIt`. |
| ✅ Done | 1 | BE-16 공통코드 업로드 배치화 | 선조회 1회(`findAllByCIdInAndDelYn`) + 메모리 upsert + `saveAll`. 요청 내 중복 키 의미 보존. |
| ✅ Done | 2 | BE-13 기준 계획 탐색 N+1·동률 제거 | `findBaselineReqDocNos` 조인 단건 조회 + `IT_PTL_ASCT_ID DESC` tie-break. 인덱스 판정: (Task 4 Step 4 실측 결과 기입). IT `CouncilBaselineLookupIt`. |
| ✅ Done | 2 | ERR-08 스냅샷 손상·빈 결과 구분 | 심의 대상 경로 파싱 실패는 문서번호 포함 예외 전파, 결과서 사업명은 WARN+관리번호 폴백, 기준 계획 조회 예외 스킵 제거. |
| ✅ Done | 2 | BE-12 사업 일괄 상세 N+1 제거 | `enrichProjectBulkDetail` 영역별 IN 배치(ID당 6~8쿼리 → 영역별 각 1회). 특성화·parity·호출 횟수 테스트 `ProjectServiceBulkParityTest`. |
| ✅ Done | 3 | BE-02 통합 테스트 하네스 규칙화 | 미보유 IT 3건 보충(BPLANA·기준계획·BPLEVM) 후 "신규 조회 IT 필수" 규칙을 `it_backend/CLAUDE.md` §9로 이관·종결. |
| ✅ Done | 3 | BE-06 Javadoc 정책 이관 | "신규 미분류 경고 불허 + 기능 변경 시 점진 정리" 정책을 `it_backend/CLAUDE.md` §9로 이관·종결. 잔여 수치는 항목 종결로 추적 종료. |

- 재분류: BE-03·BE-18은 🏛️ External로 전환(재개 조건 명시). BE-17은 결정 세션 후 별도 기록.
- 최종 검증: (Task 11 Step 1 실측 결과 기입 — test/integrationTest/jacoco)
```

주의: "(… 실측 결과 기입)" 두 곳은 이관 시점의 실제 실행 결과로 채운다. 채우지 않은 채 커밋하지 않는다.

- [ ] **Step 3: 커밋 (루트 repo)**

```bash
git -C C:/it add TASK.md TASK_DONE.md
git -C C:/it commit -m "docs: 백엔드 잔여과제 Wave 1~3 완료 이관 및 BE-03·18 External 재분류"
```

---

### Task 13: BE-17 — 프로젝션 보류 정책 5건 결정 세션

**Files:**
- Modify: `C:\it\TASK.md` (BE-17 행 — 결정 결과에 따라 삭제 또는 구체 과제로 교체)
- Modify: `C:\it\TASK_DONE.md` (결정 기록)
- Modify: `C:\it\docs\superpowers\reports\2026-07-be03-projection-survey.md` (§결론과 승인 게이트에 결정 결과 추기)

**Interfaces:**
- Consumes: 조사 리포트의 결정 #1~#5 정의(§결론과 승인 게이트)와 차단 계약
- Produces: 결정 5건의 확정 상태. 승인분은 TASK.md 신규 구체 과제, 현행 유지 확정분은 TASK_DONE.md 종결 기록.

**주의: 이 태스크는 사용자 대화가 필요하므로 서브에이전트에 위임하지 않고 메인 세션에서 수행한다.**

- [ ] **Step 1: 결정별 추천안 준비**

조사 리포트 §결론과 승인 게이트(122-126행)의 결정 #1~#5 각각에 대해 "현행 유지 vs 정책 확정" 추천안과 근거를 2~3문장으로 정리한다. 준비 기준:
- #1 BITEMM GCL 대표행: 대표행 선택 정책(최신/최소 SNO 등)을 정할 실익이 있는지 — 현행 encounter order 유지 시 영향 범위.
- #2 BBUGTM 대표행: `findFirst`/`rateByPrefix`/`firstBudgetByGcl`의 대표 정책. 승인 전 entity 1조회 유지 계약.
- #3 BPROJM 배치 사업명 대표행: 배치 이름 조회 분리(`ProjectKeyView`)의 전제.
- #4 BESTTM PK 정합: 물리 2컬럼 PK를 JPA 4컬럼 Id에 맞출지(마이그레이션 필요) 또는 JPA를 물리에 맞출지.
- #5 namespace 분리: `(sourceNamespace,key)` 복합키 전환 여부 — 비충돌 불변식 부재가 근거.

- [ ] **Step 2: 사용자 결정 세션 진행**

AskUserQuestion으로 결정 #1~#5를 제시(추천안 우선 표기)하고 답변을 받는다. 한 번에 최대 4문항이므로 2회로 나눠 진행한다.

- [ ] **Step 3: 결정 결과 기록**

- 조사 리포트 §결론과 승인 게이트 끝에 "**결정 확정 (2026-MM-DD)**: #1=…, #2=…, #3=…, #4=…, #5=…" 형식으로 추기.
- 승인된 결정: TASK.md 백엔드 섹션에 구체 과제로 신규 등록(예: "BE-19 | 🟡 Medium | 성능 | BBUGTM 대표행 정책 구현 | 결정 #2 승인(정책: …). 재계획 후 구현").
- 현행 유지로 확정된 결정: BE-17 행을 삭제하고 TASK_DONE.md에 "결정 세션 결과 현행 유지 확정" 기록.

- [ ] **Step 4: 커밋 (루트 repo)**

```bash
git -C C:/it add TASK.md TASK_DONE.md docs/superpowers/reports/2026-07-be03-projection-survey.md
git -C C:/it commit -m "docs: BE-17 프로젝션 보류 정책 5건 결정 확정 반영"
```

---

## 완료 기준 (스펙 §검증 게이트)

1. `./gradlew test --rerun-tasks` + `./gradlew integrationTest` + `./gradlew jacocoTestCoverageVerification` 전부 통과 (Task 11).
2. TASK.md 백엔드 섹션 잔존 항목: 🏛️ External 2건(BE-03·BE-18) + BE-17 결정 결과에 따른 재등록분만.
3. ERR-08 행 제거, 완료분 TASK_DONE.md 이관 완료.
4. `it_backend` main에 Wave 1~3 병합, `it_database`에 인덱스 마이그레이션 커밋, 루트에 문서 커밋.
