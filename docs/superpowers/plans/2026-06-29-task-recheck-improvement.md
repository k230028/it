# TASK.md 재점검 개선 (2차 안전 묶음 + 백로그 정비) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재검증으로 확정된 안전 코드부채 항목(N+1 잔여·flush·테스트·문서)을 묶음 처리하고, stale/재범위 항목을 정리해 `TASK.md` 정확도를 회복한다.

**Architecture:** Phase 0(백로그 정비, parent repo) 선행 후 PR-1(N+1 잔여, 동작보존 TDD)·PR-2(백엔드 정리: flush·테스트·문서)·PR-3(프론트 hwpx 회귀 테스트)를 위험도로 분리. 모두 동작보존/테스트/문서 수준. 검증은 통합테스트 인프라 부재(T18)로 Mockito `verify` 단위 레벨.

**Tech Stack:** Spring Boot 4.1 / Java 25 / QueryDSL (백엔드), JUnit5 + Mockito + BDDMockito, Nuxt 4 / Vue 3 / Vitest (프론트).

**설계 문서:** [`2026-06-29-task-recheck-improvement-design.md`](../specs/2026-06-29-task-recheck-improvement-design.md)

**범위 외(별도 트랙):** item d(VariableNodeView resolve-on-insert — 확장 plumbing 필요, 별도 미니 design), DECISION 항목(환율·changeStatus role·본문크기·T18·Blocklist·T10·Bearer), STILL_OPEN 기능(Mock→API·게시판 기능·사전협의 영속화·Tiptap prop 확대 등), EXTERNAL(EAI 발급·인덱스/EXPLAIN·메타 PK).

**저장소:** parent `C:\it`(docs), `C:\it\it_backend`, `C:\it\it_frontend` — 각각 별도 git repo.

---

## 진행 순서
Phase 0(parent) → PR-1(it_backend) → PR-2(it_backend) → PR-3(it_frontend). PR-1·2(backend)와 PR-3(frontend) 병행 가능.

---

# Phase 0 — 백로그 정비 (parent repo `C:\it`)

## Task 0: TASK.md / TASK_DONE.md 재검증 반영

**Files:**
- Modify: `C:\it\TASK.md`
- Modify: `C:\it\TASK_DONE.md`

> 재검증(설계 §3) 결과를 백로그에 반영. 코드 변경 없음.

- [ ] **Step 1: 종료 5건 → TASK_DONE.md 이관**

`TASK.md`에서 아래 5개 항목 행을 제거하고, `TASK_DONE.md`에 기존 포맷(날짜 소제목 + ✅ 표)으로 "🧹 2026-06-29 재검증 종료(5건)" 섹션 추가. 각 근거 포함:
1. `$apiFetch` 401 갱신 재시도 결과 반환 E2E 검증 — DONE (`plugins/auth.ts:113-115`, `tests/unit/plugins/auth.test.ts:136-146`, `tests/e2e/session.spec.ts:75-125`)
2. `AdminDto` 잔여 DTO JavaDoc — DONE (`AdminDto.java` 전 중첩 DTO 문서화)
3. 메타 `BPAYTM/BPAYTL.DFR_DT` NULL여부 N→Y — DONE (`table.csv` 이미 Y)
4. 메타 `BPOVWM PRJ_BG_AMR→RQM_BG_AMT` — DONE(메타); 런타임 데이터 이관만 EXTERNAL로 별도 유지
5. 실시간로그 `V20260531_001` 마이그레이션 적용 검증 — STALE(미존재, View는 비버전 로컬 DDL `ITPOWN_DDL_live.sql:3609`)

- [ ] **Step 2: 실행불가 2건 종료**

`TASK.md` 게시판 섹션에서 제거(코드에 `inqAthC`/`enrAthC` 부재 — 문서 prose만):
- `board/index.vue` + `AppSidebar.vue` 공통 권한 필터 추출 (inqAthC 중복)
- 게시판 `inqAthC/enrAthC` 역할 매핑 통합테스트

TASK_DONE.md 종료 섹션에 "재검증 결과 코드 부재로 종료(실행불가)"로 1줄씩 기록.

- [ ] **Step 3: 재범위/문구 정정 (TASK.md 본문 수정)**

- 협의회 N+1 항목(DB/JPA): "협의회 일정/평가 사용자명 N+1" → **"`EvaluationService`·`CommitteeService` 사용자명 N+1 (ScheduleService는 2026-06-29 완료)"** 로 문구 갱신 (PR-1에서 처리 예정 명시)
- 협의회 위원/상태 배치(DB/JPA): "CommitteeService·CouncilService 반복 조회" → CommitteeService.buildUserMap은 PR-1 처리, CouncilService L298 per-evaluator count는 별도 배치메서드 필요로 STILL_OPEN 유지로 분리 명기
- Java 헤더주석: "다수 파일 package 시작" → **"클래스 JavaDoc 누락 컨트롤러 소수 잔여 (전수 86% 완료)"**, PR-2에서 처리 명시
- budget summary/comparison(프론트): "Mock 데이터 API 연동" → **"백엔드 `ItBudgetController`·`useItBudget` 준비됨, 페이지 wiring만 잔여(W3)"** 로 정정
- 게시판 "Bgdocm.docCone BLOB→CLOB" → **"본문 최대 크기 정책 결정(DECISION) — 실제는 `Cblbcm.nacCone VARCHAR2(4000)`"** 로 정정
- DB/JPA `CouncilRepository.findWithDetails()(16컬럼)` → **"`findProjectsForCouncilAll`/`ByDepartment`(18컬럼) native Object[]"** 로 메서드명/컬럼수 정정
- 백엔드 환율 항목: "`recalcCurrentYearBudget`(× 미적용)" → **"`BudgetWorkService`(no-xcr, `:224,322`) vs `ProjectBudgetSummaryService`(×xcr, `:86`) 활성 충돌"** 로 정정

- [ ] **Step 4: 로드맵·업데이트 노트 갱신**

상단 실행 로드맵의 W3/Backlog 행에 위 정정 반영. "🕒 최종 업데이트: 2026-06-29 (재검증 — 종료 7건, 재범위/정정 7건, 2차 안전 묶음 W2b 착수)" 노트를 기존 노트 위에 추가(이전 노트는 보존).

- [ ] **Step 5: Commit**

```bash
cd /c/it && git add TASK.md TASK_DONE.md
git commit -m "docs: TASK.md 재검증 반영 — 종료 7건·재범위/정정 7건 (W2b 착수)"
```

---

# PR-1 — N+1 잔여 청산 (it_backend)

> 동작보존. 패턴: `UserRepository.findByEnoIn(Collection<String>)`(이미 존재, `:74`) — W2 Task 10 `ScheduleService` 선례 복제. 검증: `verify(times(1)).findByEnoIn` + `never().findByEno`.

## Task 1: EvaluationService 사용자명 N+1 → findByEnoIn

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/EvaluationService.java:251-262`
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/EvaluationServiceTest.java`

- [ ] **Step 1: 실패 테스트 추가**

`EvaluationServiceTest`에 추가 (기존 `@Mock userRepository`, `getAllEvaluations` 패턴 재사용):
```java
    @Test
    @DisplayName("getAllEvaluations: 사용자명은 findByEnoIn 1회 배치 — findByEno 미호출")
    void getAllEvaluations_findByEnoIn_1회() {
        Basctm council = mock(Basctm.class);
        given(councilService.findActiveCouncil(ASCT_ID)).willReturn(council);
        Bevalm eval = mock(Bevalm.class);
        given(eval.getEno()).willReturn(ENO);
        given(eval.getItPtlCkgItmTc()).willReturn("01");
        given(eval.getQuelRcrd()).willReturn(4);
        given(eval.getCkgOpnn()).willReturn("좋음");
        given(evaluationRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(List.of(eval));
        given(userRepository.findByEnoIn(anyCollection())).willReturn(List.of());
        given(evaluationRepository.findAverageScoreByItem(ASCT_ID, "N")).willReturn(List.of());

        evaluationService.getAllEvaluations(ASCT_ID);

        then(userRepository).should(times(1)).findByEnoIn(anyCollection());
        then(userRepository).should(never()).findByEno(anyString());
    }
```
필요 static import 추가: `import static org.mockito.ArgumentMatchers.anyCollection;`, `anyString`, `import static org.mockito.BDDMockito.then;`, `import static org.mockito.Mockito.times;`, `never`.

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.EvaluationServiceTest.getAllEvaluations_findByEnoIn_1회"`
Expected: FAIL (현재 findByEno 반복)

- [ ] **Step 3: buildUserMapFromEvaluations 배치화**

현재 (L251-262):
```java
    /**
     * 평가의견 목록에서 사번 중복 없이 사용자 정보 Map 생성 (N+1 방지)
     */
    private Map<String, CuserI> buildUserMapFromEvaluations(List<Bevalm> evaluations) {
        return evaluations.stream()
                .map(value -> value.getEno())
                .distinct()
                .map(eno -> userRepository.findByEno(eno))
                .filter(value -> value.isPresent())
                .map(value -> value.get())
                .collect(Collectors.toMap(value -> value.getEno(), u -> u, (a, b) -> a));
    }
```
변경:
```java
    /**
     * 평가의견 목록에서 사번 중복 없이 사용자 정보 Map 생성.
     *
     * <p>사번 집합을 모아 {@code findByEnoIn}으로 일괄 조회(N+1 제거).</p>
     */
    private Map<String, CuserI> buildUserMapFromEvaluations(List<Bevalm> evaluations) {
        List<String> enos = evaluations.stream().map(Bevalm::getEno).distinct().toList();
        if (enos.isEmpty()) {
            return Map.of();
        }
        return userRepository.findByEnoIn(enos).stream()
                .collect(Collectors.toMap(CuserI::getEno, u -> u, (a, b) -> a));
    }
```

- [ ] **Step 4: 통과 + 클래스 전체 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.EvaluationServiceTest"`
Expected: PASS. 기존 `getAllEvaluations` 테스트가 `findByEno`를 stub하던 부분(예: L232 `given(userRepository.findByEno(ENO)).willReturn(...)`, L302 부근 user 존재 케이스)은 `findByEnoIn(anyCollection())` stub으로 갱신. 갱신 내역 보고.

- [ ] **Step 5: Commit**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/council/service/EvaluationService.java src/test/java/com/kdb/it/domain/council/service/EvaluationServiceTest.java
git commit -m "perf: EvaluationService 사용자명 N+1 → findByEnoIn 일괄 조회 (TASK)"
```

## Task 2: CommitteeService 사용자명 N+1 → findByEnoIn

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CommitteeService.java:239-250`
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java`

- [ ] **Step 1: 실패 테스트 추가**

`CommitteeServiceTest`의 기존 `getCommittee_유형별위원분류반환`(L140-165)은 3개의 `findByEno` stub을 사용. 신규 배치 검증 테스트 추가:
```java
    @Test
    @DisplayName("getCommittee: 사용자명은 findByEnoIn 1회 배치 — findByEno 미호출")
    void getCommittee_findByEnoIn_1회() {
        Basctm council = mock(Basctm.class);
        given(councilService.findActiveCouncil(ASCT_ID)).willReturn(council);
        Bcmmtm mand = mockMember("E10001", "01");
        Bcmmtm call = mockMember("E10002", "02");
        given(committeeRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(List.of(mand, call));
        given(userRepository.findByEnoIn(anyCollection())).willReturn(List.of(
                mockUser("E10001", "18001", "팀장"), mockUser("E10002", "18010", "대리")));

        committeeService.getCommittee(ASCT_ID);

        then(userRepository).should(times(1)).findByEnoIn(anyCollection());
        then(userRepository).should(never()).findByEno(anyString());
    }
```
(static import: `anyCollection`, `anyString`, `then`, `times`, `never`.)

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.CommitteeServiceTest.getCommittee_findByEnoIn_1회"`
Expected: FAIL

- [ ] **Step 3: buildUserMap 배치화 + 허위 주석 정정**

현재 (L239-250):
```java
    /**
     * 위원 목록의 사번으로 사용자 정보 Map 생성
     *
     * <p>N+1 방지를 위해 사번 목록으로 사용자 정보를 일괄 조회합니다.</p>
     */
    private Map<String, CuserI> buildUserMap(List<Bcmmtm> members) {
        return members.stream()
                .map(m -> userRepository.findByEno(m.getEno()))
                .filter(value -> value.isPresent())
                .map(value -> value.get())
                .collect(Collectors.toMap(value -> value.getEno(), u -> u, (a, b) -> a));
    }
```
변경 (주석이 실제 일괄 조회와 일치하도록):
```java
    /**
     * 위원 목록의 사번으로 사용자 정보 Map 생성.
     *
     * <p>사번 집합을 모아 {@code findByEnoIn}으로 일괄 조회(N+1 제거).</p>
     */
    private Map<String, CuserI> buildUserMap(List<Bcmmtm> members) {
        List<String> enos = members.stream().map(Bcmmtm::getEno).distinct().toList();
        if (enos.isEmpty()) {
            return Map.of();
        }
        return userRepository.findByEnoIn(enos).stream()
                .collect(Collectors.toMap(CuserI::getEno, u -> u, (a, b) -> a));
    }
```

- [ ] **Step 4: 통과 + 클래스 전체**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.CommitteeServiceTest"`
Expected: PASS. 기존 `getCommittee_유형별위원분류반환`의 3개 `findByEno` stub을 단일 `findByEnoIn(anyCollection())` → 3 user 리스트 반환으로 갱신. 보고.

- [ ] **Step 5: Commit**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/council/service/CommitteeService.java src/test/java/com/kdb/it/domain/council/service/CommitteeServiceTest.java
git commit -m "perf: CommitteeService 사용자명 N+1 → findByEnoIn 일괄 조회 (TASK)"
```

---

# PR-2 — 백엔드 정리 (it_backend)

## Task 3: FeasibilityService.replacePerformances() flush() 명시

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java:173-192`

> 신규 성과지표 persist를 즉시 flush해 제약 위반을 본 트랜잭션에서 조기 표면화. 최종 상태 동일(동작보존).

- [ ] **Step 1: persist 루프 직후 flush() 추가**

현재 (L180-191 영역):
```java
        // 새 성과지표 INSERT (persist — @PrePersist 확실히 실행됨)
        for (CouncilDto.PerformanceRequest req : requests) {
            Bperfm perf = Bperfm.builder()
                    .itPtlAsctId(asctId)
                    .evlDtpSno(req.dtpSno())
                    .evlDtpNm(req.dtpNm())
                    .evlDtpDfntCone(req.dtpCone())
                    .evlDtpClfCone(req.clf())
                    .evlDtpMsmPtmCone(req.msmTpm())
                    .evlDtpMsmCleCone(req.msmCle())
                    .build();
            entityManager.persist(perf);
        }
    }
```
변경 (루프 종료 후 flush 추가):
```java
        // 새 성과지표 INSERT (persist — @PrePersist 확실히 실행됨)
        for (CouncilDto.PerformanceRequest req : requests) {
            Bperfm perf = Bperfm.builder()
                    .itPtlAsctId(asctId)
                    .evlDtpSno(req.dtpSno())
                    .evlDtpNm(req.dtpNm())
                    .evlDtpDfntCone(req.dtpCone())
                    .evlDtpClfCone(req.clf())
                    .evlDtpMsmPtmCone(req.msmTpm())
                    .evlDtpMsmCleCone(req.msmCle())
                    .build();
            entityManager.persist(perf);
        }
        // 신규 성과지표 INSERT를 즉시 flush — 제약 위반을 본 트랜잭션에서 조기 표면화
        entityManager.flush();
    }
```

- [ ] **Step 2: 컴파일 + 관련 테스트**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.FeasibilityServiceTest"`
Expected: PASS (테스트 없으면 컴파일 + 인접 council 테스트 그린 확인: `--tests "com.kdb.it.domain.council.service.*"` 중 본 클래스). flush는 동작보존.

- [ ] **Step 3: Commit**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java
git commit -m "refactor: FeasibilityService 성과지표 persist 후 flush 명시 (TASK)"
```

## Task 4: EaiServiceTest — umsTrSno 비정상 케이스

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/infra/eai/service/EaiServiceTest.java`

> `UmsPayloadSection.java:42` `Integer.parseInt(umsTrSno)`가 빈/비숫자 입력 시 `NumberFormatException`(⊂ IllegalArgumentException) → `EaiService.java:58` catch → `EaiResult.failure("전문 조립 실패: ...")`. 이 경로를 명시 커버. 테스트 전용(plain JUnit5).

- [ ] **Step 1: 빈 umsTrSno 실패 테스트 추가**

`EaiServiceTest`에 추가 (기존 `service(props, client)`·`buildOverflow_returnsFailure` 패턴 미러):
```java
    @Test
    @DisplayName("umsTrSno가 빈 문자열이면 parseInt 실패 → EaiResult.failure")
    void umsTrSnoBlank_returnsFailure() {
        EaiRequest bad = EaiRequest.ums("IPPO00012345", com.kdb.it.infra.eai.dto.UmsPayload.builder()
                .umsBzDttId("SMS2096").umsTrSno("")
                .emplNum("K1234567").cstNm("홍길동").reqCh("01012345678")
                .deptKey("182").deptNm("디지털금융부").umData1("123456").build());
        EaiProperties props = new EaiProperties(true, "http://eai.test/eai", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
        RestClient client = RestClient.builder().baseUrl("http://eai.test").build();
        EaiResult r = service(props, client).sendEai(bad);
        assertThat(r.success()).isFalse();
        assertThat(r.errorMessage()).contains("전문");
    }

    @Test
    @DisplayName("umsTrSno가 비숫자면 parseInt 실패 → EaiResult.failure")
    void umsTrSnoNonNumeric_returnsFailure() {
        EaiRequest bad = EaiRequest.ums("IPPO00012345", com.kdb.it.infra.eai.dto.UmsPayload.builder()
                .umsBzDttId("SMS2096").umsTrSno("abc")
                .emplNum("K1234567").cstNm("홍길동").reqCh("01012345678")
                .deptKey("182").deptNm("디지털금융부").umData1("123456").build());
        EaiProperties props = new EaiProperties(true, "http://eai.test/eai", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
        RestClient client = RestClient.builder().baseUrl("http://eai.test").build();
        EaiResult r = service(props, client).sendEai(bad);
        assertThat(r.success()).isFalse();
        assertThat(r.errorMessage()).contains("전문");
    }
```

- [ ] **Step 2: 실행 (기존 동작 검증 — 통과해야 함)**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.eai.service.EaiServiceTest"`
Expected: PASS (현재 코드가 이미 failure 경로를 가지므로 신규 테스트가 바로 통과 — 회귀 가드). 만약 FAIL이면 catch 경로가 예상과 달라 실제 결함 → 보고.

- [ ] **Step 3: Commit**

```bash
cd it_backend && git add src/test/java/com/kdb/it/infra/eai/service/EaiServiceTest.java
git commit -m "test: EaiServiceTest umsTrSno 빈/비숫자 parseInt 실패 경로 커버 (TASK)"
```

## Task 5: BoardMetaServiceTest — 부정 분기 보강

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardMetaServiceTest.java`

> 5개 public 메서드는 happy-path만 커버됨. 부정/빈 분기 3건 추가. 테스트 전용.

- [ ] **Step 1: 누락 분기 확인**

`BoardMetaService.java` 확인: `getOne`/`updateBoard`/`deleteBoard`가 미존재 게시판 시 던지는 예외 타입을 `findActiveBoard`(L93) 또는 각 메서드에서 확인. 기존 `getOne_missingBoard_throws`(L58)가 사용하는 예외 클래스/매처를 그대로 재사용.

- [ ] **Step 2: 부정 분기 테스트 3건 추가**

기존 `getOne_missingBoard_throws`의 stub/assert 스타일을 미러. (예외 타입은 Step 1에서 확인한 실제 타입 사용 — 아래 `CustomGeneralException`은 `getOne` 미존재 테스트와 동일한 타입으로 맞춤):
```java
    @Test
    @DisplayName("getAllActive: 활성 게시판이 없으면 빈 리스트를 반환한다")
    void getAllActive_empty_returnsEmpty() {
        given(boardMetaRepository.findByDelYnOrderBy<기존 getAllActive가 쓰는 메서드>)
                .willReturn(List.of());
        assertThat(service.getAllActive()).isEmpty();
    }

    @Test
    @DisplayName("updateBoard: 미존재 게시판이면 예외를 던진다")
    void updateBoard_missing_throws() {
        // getOne_missingBoard_throws와 동일한 미존재 stub 사용
        assertThatThrownBy(() -> service.updateBoard("NOPE", updateRequest("X")))
                .isInstanceOf(<getOne 미존재 테스트와 동일 예외>.class);
    }

    @Test
    @DisplayName("deleteBoard: 미존재 게시판이면 예외를 던진다")
    void deleteBoard_missing_throws() {
        assertThatThrownBy(() -> service.deleteBoard("NOPE"))
                .isInstanceOf(<getOne 미존재 테스트와 동일 예외>.class);
    }
```
`getAllActive`가 호출하는 실제 repository 메서드명과 `findActiveBoard` 미존재 stub은 기존 테스트(L33 getAllActive, L58 getOne missing)에서 그대로 복사해 맞춘다. 미존재 예외 타입/매처는 Step 1 확인값으로 치환.

- [ ] **Step 3: 실행**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.board.service.BoardMetaServiceTest"`
Expected: PASS (9 tests).

- [ ] **Step 4: Commit**

```bash
cd it_backend && git add src/test/java/com/kdb/it/common/board/service/BoardMetaServiceTest.java
git commit -m "test: BoardMetaServiceTest 빈/미존재 부정 분기 보강 (TASK)"
```

## Task 6: 클래스 JavaDoc 누락 컨트롤러 보강 (detection-driven)

**Files:**
- Modify: 클래스 JavaDoc이 없는 `*Controller.java` (검출 결과에 따름)

> "12개" 수치는 부정확(ItBudget/Gemini는 이미 보유). 실제 누락분만 검출해 보강. 문서 전용.

- [ ] **Step 1: 누락 컨트롤러 검출**

`@RestController` 클래스 선언 바로 위에 `/** */` JavaDoc이 없는 컨트롤러를 찾는다:
```bash
cd it_backend && for f in $(git grep -l "@RestController" -- 'src/main/**/*Controller.java'); do
  # 클래스 선언 라인 직전 비주석/비어노테이션 여부로 판별이 어려우므로,
  # 파일에 'public class' 직전 5줄 내 '*/' 종료가 없으면 후보로 출력
  awk 'BEGIN{doc=0} /\/\*\*/{doc=NR} /public class/{ if (doc==0 || NR-doc>15) print FILENAME }' "$f"
done | sort -u
```
검출 목록을 확정(확인된 예: `domain/menu/controller/AdminMenuController.java` — L17 `@RestController` 위 JavaDoc 없음). 거짓양성(JavaDoc 있는데 멀리 떨어진 경우)은 직접 파일 열어 배제.

- [ ] **Step 2: 각 누락 컨트롤러에 클래스 JavaDoc 추가**

각 컨트롤러의 `@RequestMapping` 경로·`@Tag`·`@PreAuthorize`를 근거로 역할/기본URL/권한을 1문단으로 기술. 예 — `AdminMenuController` (`@RequestMapping("/api/admin/menus")`, `@Tag(name="메뉴 관리(관리자)")`, ADMIN 전용):
```java
/**
 * 관리자 메뉴 관리 REST 컨트롤러.
 *
 * <p>기본 URL: {@code /api/admin/menus}. DB 기반 메뉴 트리의 CRUD·정렬·이동(reparent)을 제공한다.
 * 클래스 레벨 {@code @PreAuthorize("hasRole('ADMIN')")}로 관리자 전용이다.</p>
 */
@RestController
@RequestMapping("/api/admin/menus")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "메뉴 관리(관리자)", description = "메뉴 CRUD·정렬·이동")
public class AdminMenuController {
```
나머지 검출 컨트롤러도 동일 형식(각자의 경로/태그/권한 반영)으로 추가. 본문 코드·어노테이션은 변경하지 않는다.

- [ ] **Step 3: 빌드 그린**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL (주석만 추가).

- [ ] **Step 4: Commit**

```bash
cd it_backend && git add src/main/java
git commit -m "docs: 클래스 JavaDoc 누락 컨트롤러 보강 (TASK)"
```

---

# PR-3 — 프론트 hwpx 회귀 테스트 (it_frontend)

> item g를 hwpx 변환 회귀로 좁힘(excel/pdf는 14/13건으로 충분). 테스트 전용·동작보존. 기존 행동을 고정하는 회귀 테스트이므로 작성 직후 통과해야 함.

## Task 7: hwpx 변수 노드 변환 회귀 테스트 보강

**Files:**
- Modify: `it_frontend/tests/unit/utils/hwpx.test.ts`

> 현재 변수 노드 치환 테스트는 2건(snapshot 있음/없음, L350-366). 표 셀 내 변수·다중 변수 단락 경로를 추가 고정.

- [ ] **Step 1: 회귀 테스트 2건 추가**

`hwpx.test.ts`의 `describe('hwpx 변환 — 변수 노드 치환')` 블록(L350)에 추가. 기존 helper `getTableXml`(L10-15)와 `htmlToHwpxBlob`/`preprocessHtmlForHwpx`(import L7) 사용:
```ts
    it('표 셀 안의 변수 노드도 data-snapshot 텍스트로 치환된다', async () => {
        const tableHtml =
            '<table><tbody><tr>' +
            '<td><span data-type="tiptap-variable" data-token="2026.itBudget.requestAmount" data-snapshot="900억원">{2026.itBudget.requestAmount}</span></td>' +
            '<td>일반셀</td>' +
            '</tr></tbody></table>';
        const xml = await getTableXml(tableHtml);
        expect(xml).toContain('900억원');
        expect(xml).not.toContain('data-snapshot');
    });

    it('한 단락에 여러 변수 노드가 있으면 각각 snapshot으로 치환된다', () => {
        const html =
            '<p>' +
            '<span data-type="tiptap-variable" data-token="2026.itBudget.requestAmount" data-snapshot="900억원">{a}</span>' +
            ' / ' +
            '<span data-type="tiptap-variable" data-token="2026.itBudget.allocatedAmount" data-snapshot="850억원">{b}</span>' +
            '</p>';
        const out = preprocessHtmlForHwpx(html);
        expect(out).toContain('900억원');
        expect(out).toContain('850억원');
    });
```
(두 번째 테스트는 `preprocessHtmlForHwpx`가 동기 함수이므로 `async` 불필요. 첫 번째는 `htmlToHwpxBlob` 경유라 `async`.)

- [ ] **Step 2: 실행 (회귀 — 통과 기대)**

Run: `cd it_frontend && npx vitest run tests/unit/utils/hwpx.test.ts`
Expected: PASS (기존 + 신규 2건). 만약 표 셀 내 변수가 치환되지 않아 FAIL이면 — 현재 동작상 실제 갭(표 내 변수 미치환) → 코드 변경 없이 보고하고, 해당 테스트는 현재 동작에 맞게 조정하거나 별도 이슈로 분리.

- [ ] **Step 3: 타입체크 + 린트**

Run: `cd it_frontend && npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd it_frontend && git add tests/unit/utils/hwpx.test.ts
git commit -m "test: hwpx 표 셀·다중 변수 노드 치환 회귀 테스트 보강 (TASK)"
```

---

# 마무리

## 최종 검증
- [ ] **백엔드**: `cd it_backend && ./gradlew test` → 신규 실패 0건 (기존 8건 — CORS 속성해석 5·XCR Ccodem 2·Committee 상태전이 1 — 무관, `task_00754fe5` 추적). 빌드 전 `./gradlew --stop` 후 `build/test-results/test/binary` 잠금 정리 필요시.
- [ ] **프론트**: `cd it_frontend && npm run typecheck && npm run lint && npx vitest run tests/unit/utils/hwpx.test.ts` → PASS
- [ ] **TASK.md**: Phase 0 반영 확인 (종료/재범위/정정).

## 후속(범위 외, 별도)
- item d (VariableNodeView resolve-on-insert): Tiptap 확장에 `resolveTokens` 연동 + `editor.storage.tiptapVariable.values` 갱신 필요 — 별도 미니 design 후 진행.
