# COUNCIL-010 작성완료 수정 복귀·오신청 취소·결재 회수 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 협의회가 결재 회수·작성완료·오신청에서 갇히지 않도록 회수 리스너(`03→02`, `12→11`), 수정 복귀 API(`02→01`), 취소 API(`01·02` 소프트 삭제 + 사업 상태 `45→09`)와 Step1 버튼을 추가한다.

**Architecture:** 백엔드는 기존 `CouncilApprovalEventListener`에 회수 핸들러를 더하고, `FeasibilityService.reopenFeasibility`·`CouncilService.cancelCouncil`을 각 컨트롤러에 `PATCH /reopen`·`DELETE /{asctId}`로 노출한다. 권한은 `CouncilAccessGuard.verifyOwningOrManageable`(관리 또는 주관부서), 상태 위반은 `IllegalStateException`(409). 프론트는 `useCouncilLifecycleApi`에 두 호출을 더하고 `useCouncilRequestPage`가 판정(`canReopen`·`canCancel`)과 액션을 제공하며, 확인 다이얼로그는 페이지가 `useConfirm`으로 감싼다.

**Tech Stack:** Spring Boot 3 (JPA, `@EventListener`), JUnit 5 + Mockito, Nuxt 4 + Vue 3, PrimeVue `useConfirm`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-council-reopen-cancel-recall-design.md`

## Global Constraints

- 수정 범위: `it_backend/src/{main,test}/java/com/kdb/it/domain/council/**`, `it_frontend/app/composables/council/useCouncilLifecycleApi.ts`, `app/composables/useCouncilRequestPage.ts`, `app/pages/info/council-request/[id].vue`, `i18n/messages/council.ts`, `app/types/api.d.ts`(codegen 산출), 해당 테스트. 그 밖의 디렉터리는 사용자 확인 없이 수정하지 않는다.
- 취소 허용 상태는 `01`·`02`뿐. 권한은 "관리 또는 주관부서"(`verifyOwningOrManageable`) — 사용자 승인(2026-09-21).
- 오류 관례: 권한 403(`AccessDeniedException`, 가드가 던짐), 없음 404(`IllegalArgumentException`, `findActiveCouncil`), 상태 위반 409(`IllegalStateException`).
- 커밋: 경로 명시 `git add`, 메시지 끝 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. 백엔드는 커밋 전 `./gradlew spotlessApply -q`.
- 프론트 사용자 노출 문구는 i18n 키로만(`user-facing-copy-ratchet`). 진단 로그 접두어(`logLabel`)에 한글 리터럴을 새로 넣지 않는다.
- `npm run codegen`은 백엔드가 `http://localhost:28080`에 떠 있어야 한다(`OPENAPI_BACKEND_URL`로 변경 가능). 사용자 노트북이 느리므로 codegen 후 백엔드·Gradle 데몬을 내린다.

---

### Task 1: 결재 회수 리스너 (`03→02`, `12→11`)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilApprovalService.java` (processApprovalCallback 아래)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilApprovalEventListener.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilApprovalServiceTest.java`, `CouncilApprovalEventListenerTest.java`

**Interfaces:**
- Consumes: `ApprovalRecalledEvent(String apfMngNo, String recallerEno, List<String> approvedMiddleApproverEnos)` (공통 결재, 이미 존재), `ApplicationMapRepository.findByApfDcmNoAndFntTbNm(apfMngNo, "BASCTM")`, `CouncilService.findActiveCouncil`, `CouncilService.changeStatus`.
- Produces: `CouncilApprovalService.processApprovalRecall(String asctId): void`, `CouncilApprovalEventListener.handleApprovalRecalled(ApprovalRecalledEvent): void`.

- [ ] **Step 1: 서비스 테스트를 쓴다**

`CouncilApprovalServiceTest.java`의 `processApprovalCallback` 블록 뒤에 추가:

```java
    // ───────────────────────────────────────────────────────
    // processApprovalRecall (COUNCIL-010)
    // ───────────────────────────────────────────────────────

    @Test
    @DisplayName("processApprovalRecall: 결재요청(03)에서 회수되면 작성완료(02)로 되돌린다")
    void processApprovalRecall_03이면_02로복귀() {
        Basctm council = mock(Basctm.class);
        given(council.getItPtlAsctPrgStsTc()).willReturn("03");
        given(councilService.findActiveCouncil(ASCT_ID)).willReturn(council);

        councilApprovalService.processApprovalRecall(ASCT_ID);

        verify(councilService).changeStatus(ASCT_ID, "02");
    }

    @Test
    @DisplayName("processApprovalRecall: 결과서 결재 중(12)에서 회수되면 최종결재 대기(11)로 되돌린다")
    void processApprovalRecall_12이면_11로복귀() {
        Basctm council = mock(Basctm.class);
        given(council.getItPtlAsctPrgStsTc()).willReturn("12");
        given(councilService.findActiveCouncil(ASCT_ID)).willReturn(council);

        councilApprovalService.processApprovalRecall(ASCT_ID);

        verify(councilService).changeStatus(ASCT_ID, "11");
    }

    @Test
    @DisplayName("processApprovalRecall: 결재 대기가 아닌 상태면 아무것도 바꾸지 않는다 (늦게 도착한 회수 이벤트)")
    void processApprovalRecall_그밖의상태_무시() {
        Basctm council = mock(Basctm.class);
        given(council.getItPtlAsctPrgStsTc()).willReturn("04");
        given(councilService.findActiveCouncil(ASCT_ID)).willReturn(council);

        councilApprovalService.processApprovalRecall(ASCT_ID);

        verify(councilService, never()).changeStatus(any(), any());
    }
```

`import static org.mockito.ArgumentMatchers.any;`, `import static org.mockito.Mockito.never;`가 없으면 추가한다.

- [ ] **Step 2: 리스너 테스트를 쓴다**

`CouncilApprovalEventListenerTest.java` 끝에 추가:

```java
    // ───────────────────────────────────────────────────────
    // handleApprovalRecalled (COUNCIL-010)
    // ───────────────────────────────────────────────────────

    @Test
    @DisplayName("handleApprovalRecalled: BASCTM 연결이 있으면 협의회마다 회수 복구를 호출한다")
    void handleApprovalRecalled_연결있음_복구호출() {
        Cappla link = mock(Cappla.class);
        given(link.getPkColNm()).willReturn(ASCT_ID);
        given(applicationMapRepository.findByApfDcmNoAndFntTbNm(APF_MNG_NO, "BASCTM"))
                .willReturn(List.of(link));

        councilApprovalEventListener.handleApprovalRecalled(
                new ApprovalRecalledEvent(APF_MNG_NO, "K000001", List.of()));

        verify(councilApprovalService).processApprovalRecall(ASCT_ID);
    }

    @Test
    @DisplayName("handleApprovalRecalled: BASCTM 연결이 없으면 아무것도 호출하지 않는다")
    void handleApprovalRecalled_연결없음_건너뜀() {
        given(applicationMapRepository.findByApfDcmNoAndFntTbNm(APF_MNG_NO, "BASCTM"))
                .willReturn(List.of());

        councilApprovalEventListener.handleApprovalRecalled(
                new ApprovalRecalledEvent(APF_MNG_NO, "K000001", List.of()));

        verify(councilApprovalService, never()).processApprovalRecall(any());
    }
```

`import com.kdb.it.common.approval.event.ApprovalRecalledEvent;`를 추가한다.

- [ ] **Step 3: 실패를 확인한다**

Run (in `C:\it\it_backend`): `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilApprovalServiceTest' --tests 'com.kdb.it.domain.council.service.CouncilApprovalEventListenerTest' -q`
Expected: 컴파일 실패 — `processApprovalRecall`, `handleApprovalRecalled` 없음.

- [ ] **Step 4: 서비스 메서드를 만든다**

`CouncilApprovalService.java`의 `processApprovalCallback` 메서드 바로 아래:

```java
    /**
     * 결재 회수 처리 (공통 결재 회수 이벤트, COUNCIL-010)
     *
     * <p>회수된 신청서에 연결된 협의회를 상신 직전 상태로 되돌려 재상신할 수 있게 합니다.
     *
     * <ul>
     *   <li>타당성검토표 결재요청(03) → 작성완료(02)
     *   <li>개최결과서 결재 중(12) → 최종결재 대기(11)
     * </ul>
     *
     * <p>그 밖의 상태에서는 아무것도 바꾸지 않습니다. 회수 이벤트가 결재 완료 뒤에 늦게 도착해도 원장을 뒤로 되돌리지 않기 위함입니다.
     *
     * @param asctId 협의회ID
     */
    @Transactional
    public void processApprovalRecall(String asctId) {
        Basctm council = councilService.findActiveCouncil(asctId);
        String currentStatus = council.getItPtlAsctPrgStsTc();

        if ("03".equals(currentStatus)) {
            councilService.changeStatus(asctId, "02");
        } else if ("12".equals(currentStatus)) {
            councilService.changeStatus(asctId, "11");
        } else {
            log.warn(
                    "[CouncilApproval] 회수 이벤트를 무시한다 - asctId={}, 현재 상태={}",
                    asctId,
                    currentStatus);
        }
    }
```

클래스에 `log`가 없으면 `@Slf4j`(lombok)를 클래스에 붙인다(`import lombok.extern.slf4j.Slf4j;`).

- [ ] **Step 5: 리스너 핸들러를 만든다**

`CouncilApprovalEventListener.java`의 `handleApprovalCompleted` 메서드 아래:

```java
    /**
     * 결재 회수 이벤트 처리 (COUNCIL-010)
     *
     * <p>회수된 신청서가 BASCTM(협의회)에 연결된 경우에만 협의회를 상신 직전 상태로 되돌립니다. 완료 핸들러와 같은 이유로
     * {@code @EventListener} + {@code @Transactional}을 써서 발행자({@code ApplicationService.recall()})와 같은 트랜잭션에서
     * 동기 처리하며, 실패하면 회수 전체가 롤백됩니다.
     *
     * @param event 결재 회수 이벤트 (신청관리번호 포함)
     */
    @EventListener
    @Transactional
    public void handleApprovalRecalled(ApprovalRecalledEvent event) {
        List<Cappla> links =
                applicationMapRepository.findByApfDcmNoAndFntTbNm(
                        event.apfMngNo(), COUNCIL_ORC_TB_CD);
        if (links.isEmpty()) {
            return;
        }
        for (Cappla link : links) {
            String asctId = link.getPkColNm();
            try {
                councilApprovalService.processApprovalRecall(asctId);
                log.info("협의회 결재 회수 복구 완료 - asctId: {}", asctId);
            } catch (RuntimeException e) {
                log.error("협의회 결재 회수 복구 실패 - asctId: {}, apfMngNo: {}", asctId, event.apfMngNo(), e);
                throw e;
            }
        }
    }
```

`import com.kdb.it.common.approval.event.ApprovalRecalledEvent;`를 추가한다.

- [ ] **Step 6: 통과·포맷을 확인한다**

Run: `./gradlew spotlessApply -q && ./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilApprovalServiceTest' --tests 'com.kdb.it.domain.council.service.CouncilApprovalEventListenerTest' -q`
Expected: BUILD SUCCESSFUL, 신규 5건 PASS.

- [ ] **Step 7: 커밋한다**

```bash
git add src/main/java/com/kdb/it/domain/council/service/CouncilApprovalService.java src/main/java/com/kdb/it/domain/council/service/CouncilApprovalEventListener.java src/test/java/com/kdb/it/domain/council/service/CouncilApprovalServiceTest.java src/test/java/com/kdb/it/domain/council/service/CouncilApprovalEventListenerTest.java
git commit -m "feat(council): 결재 회수 이벤트로 협의회를 상신 직전 상태로 복구 (COUNCIL-010)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 작성완료 수정 복귀 API (`PATCH /{asctId}/reopen`)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/entity/Bpovwm.java` (`update` 메서드 아래)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java` (`saveFeasibility` 아래)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilFeasibilityController.java` (끝)
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/FeasibilityServiceTest.java`

**Interfaces:**
- Consumes: `CouncilService.findActiveCouncil`, `CouncilService.changeStatus`, `CouncilAccessGuard.verifyOwningOrManageable(Basctm)`, `ProjectOverviewRepository.findByItPtlAsctIdAndDelYn(asctId, "N"): Optional<Bpovwm>`.
- Produces: `Bpovwm.reopenAsDraft(): void`, `FeasibilityService.reopenFeasibility(String asctId): void`, `PATCH /api/council/{asctId}/reopen` → 204.

- [ ] **Step 1: 서비스 테스트를 쓴다**

`FeasibilityServiceTest.java`에 `@Mock private CouncilAccessGuard councilAccessGuard;`를 다른 `@Mock` 옆에 추가하고, 끝에 테스트를 추가한다:

```java
    // ───────────────────────────────────────────────────────
    // reopenFeasibility (COUNCIL-010)
    // ───────────────────────────────────────────────────────

    @Test
    @DisplayName("reopenFeasibility: 작성완료(02)가 아니면 IllegalStateException을 던진다")
    void reopenFeasibility_02아님_예외() {
        Basctm council = mock(Basctm.class);
        given(council.getItPtlAsctPrgStsTc()).willReturn("03");
        given(councilService.findActiveCouncil("ASCT-2026-0001")).willReturn(council);

        assertThatThrownBy(() -> feasibilityService.reopenFeasibility("ASCT-2026-0001"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("02");
        verify(councilService, never()).changeStatus(any(), any());
    }

    @Test
    @DisplayName("reopenFeasibility: 권한 검사를 상태 검사보다 먼저 한다")
    void reopenFeasibility_권한없음_403() {
        Basctm council = mock(Basctm.class);
        given(councilService.findActiveCouncil("ASCT-2026-0001")).willReturn(council);
        willThrow(new AccessDeniedException("권한 없음"))
                .given(councilAccessGuard)
                .verifyOwningOrManageable(council);

        assertThatThrownBy(() -> feasibilityService.reopenFeasibility("ASCT-2026-0001"))
                .isInstanceOf(AccessDeniedException.class);
        verify(council, never()).getItPtlAsctPrgStsTc();
    }

    @Test
    @DisplayName("reopenFeasibility: 작성완료(02)면 사업개요를 임시저장으로 되돌리고 작성중(01)으로 전이한다")
    void reopenFeasibility_02이면_임시저장및01전이() {
        Basctm council = mock(Basctm.class);
        given(council.getItPtlAsctPrgStsTc()).willReturn("02");
        given(councilService.findActiveCouncil("ASCT-2026-0001")).willReturn(council);
        Bpovwm overview = mock(Bpovwm.class);
        given(projectOverviewRepository.findByItPtlAsctIdAndDelYn("ASCT-2026-0001", "N"))
                .willReturn(Optional.of(overview));

        feasibilityService.reopenFeasibility("ASCT-2026-0001");

        verify(overview).reopenAsDraft();
        verify(councilService).changeStatus("ASCT-2026-0001", "01");
    }

    @Test
    @DisplayName("reopenFeasibility: 사업개요가 없으면 IllegalStateException을 던지고 상태를 바꾸지 않는다")
    void reopenFeasibility_사업개요없음_예외() {
        Basctm council = mock(Basctm.class);
        given(council.getItPtlAsctPrgStsTc()).willReturn("02");
        given(councilService.findActiveCouncil("ASCT-2026-0001")).willReturn(council);
        given(projectOverviewRepository.findByItPtlAsctIdAndDelYn("ASCT-2026-0001", "N"))
                .willReturn(Optional.empty());

        assertThatThrownBy(() -> feasibilityService.reopenFeasibility("ASCT-2026-0001"))
                .isInstanceOf(IllegalStateException.class);
        verify(councilService, never()).changeStatus(any(), any());
    }
```

필요한 import: `import com.kdb.it.domain.council.entity.Basctm;`, `import org.springframework.security.access.AccessDeniedException;`, `import static org.assertj.core.api.Assertions.assertThatThrownBy;`, `import static org.mockito.ArgumentMatchers.any;`, `import static org.mockito.BDDMockito.given;`, `import static org.mockito.BDDMockito.willThrow;`, `import static org.mockito.Mockito.mock;`, `import static org.mockito.Mockito.never;`, `import static org.mockito.Mockito.verify;`, `import java.util.Optional;` (이미 있는 것은 생략).

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.service.FeasibilityServiceTest' -q`
Expected: 컴파일 실패 — `reopenFeasibility`, `reopenAsDraft` 없음.

- [ ] **Step 3: 엔티티·서비스·컨트롤러를 만든다**

`Bpovwm.java`의 `update(...)` 메서드 아래:

```java
    /**
     * 작성완료본을 임시저장 상태로 되돌립니다 (COUNCIL-010 수정 복귀).
     *
     * <p>본문은 그대로 두고 저장유형구분코드만 임시저장(10)으로 바꿉니다. 이후 작성자가 다시 작성완료(20)로 저장할 수 있습니다.
     */
    public void reopenAsDraft() {
        this.kpnTpTc = "10";
    }
```

`FeasibilityService.java`: 필드에 `private final CouncilAccessGuard councilAccessGuard;`를 추가하고(`@RequiredArgsConstructor`가 생성자에 넣는다), `saveFeasibility` 메서드 아래에:

```java
    /**
     * 작성완료(02) 타당성검토표를 작성중(01)으로 되돌립니다 (COUNCIL-010).
     *
     * <p>결재 요청 전에만 가능합니다. 권한(관리 또는 주관부서)을 상태보다 먼저 검사합니다.
     *
     * @param asctId 협의회ID
     * @throws org.springframework.security.access.AccessDeniedException 관리자·주관부서가 아닌 경우(403)
     * @throws IllegalArgumentException 협의회가 없거나 삭제된 경우(404)
     * @throws IllegalStateException 작성완료(02)가 아니거나 사업개요가 없는 경우(409)
     */
    @Transactional
    public void reopenFeasibility(String asctId) {
        Basctm council = councilService.findActiveCouncil(asctId);
        councilAccessGuard.verifyOwningOrManageable(council);

        if (!"02".equals(council.getItPtlAsctPrgStsTc())) {
            throw new IllegalStateException(
                    "작성완료(02) 상태에서만 수정으로 되돌릴 수 있습니다. 현재 상태: "
                            + council.getItPtlAsctPrgStsTc());
        }

        Bpovwm overview =
                projectOverviewRepository
                        .findByItPtlAsctIdAndDelYn(asctId, "N")
                        .orElseThrow(
                                () ->
                                        new IllegalStateException(
                                                "사업개요가 없어 수정으로 되돌릴 수 없습니다. asctId=" + asctId));
        overview.reopenAsDraft();

        councilService.changeStatus(asctId, "01");
    }
```

`import com.kdb.it.domain.council.entity.Basctm;`를 추가한다.

`CouncilFeasibilityController.java`의 `updateFeasibility` 아래:

```java
    /**
     * 작성완료 타당성검토표를 작성중으로 되돌리기 (COUNCIL-010)
     *
     * <p>결재 요청 전(작성완료 02)에만 가능하며 관리자 또는 주관부서가 호출합니다.
     *
     * @param asctId 협의회ID
     * @return HTTP 204
     */
    @Operation(summary = "타당성검토표 수정 복귀", description = "작성완료(02) 상태를 작성중(01)으로 되돌립니다. 결재 요청 전에만 가능합니다.")
    @ApiResponses(
            value = {
                @ApiResponse(responseCode = "204", description = "복귀 성공"),
                @ApiResponse(responseCode = "403", description = "관리자·주관부서 아님", content = @Content),
                @ApiResponse(responseCode = "404", description = "존재하지 않는 협의회", content = @Content),
                @ApiResponse(responseCode = "409", description = "작성완료 상태가 아님", content = @Content)
            })
    @PatchMapping("/{asctId}/reopen")
    public ResponseEntity<Void> reopenFeasibility(
            @Parameter(description = "협의회ID", required = true, example = "ASCT-2026-0001")
                    @PathVariable("asctId")
                    String asctId) {
        feasibilityService.reopenFeasibility(asctId);
        return ResponseEntity.noContent().build();
    }
```

- [ ] **Step 4: 통과·포맷·기존 경계 테스트를 확인한다**

Run: `./gradlew spotlessApply -q && ./gradlew test --tests 'com.kdb.it.domain.council.service.FeasibilityServiceTest' --tests 'com.kdb.it.domain.council.service.CouncilAccessBoundaryTest' -q`
Expected: BUILD SUCCESSFUL. `CouncilAccessBoundaryTest`가 `FeasibilityService`를 직접 `new`로 만든다면 생성자 인자에 `councilAccessGuard`를 추가한다(그 테스트 안의 기존 mock을 넘긴다).

- [ ] **Step 5: 커밋한다**

```bash
git add src/main/java/com/kdb/it/domain/council/entity/Bpovwm.java src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java src/main/java/com/kdb/it/domain/council/controller/CouncilFeasibilityController.java src/test/java/com/kdb/it/domain/council/service/FeasibilityServiceTest.java
git commit -m "feat(council): 작성완료 타당성검토표를 작성중으로 되돌리는 reopen API 추가 (COUNCIL-010)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

(`CouncilAccessBoundaryTest`를 고쳤다면 함께 `git add`한다.)

---

### Task 3: 오신청 취소 API (`DELETE /{asctId}`)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java` (`skipCouncil` 위)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilController.java` (`getCouncilList` 아래)
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java`

**Interfaces:**
- Consumes: `findActiveCouncil`, `councilAccessGuard.verifyOwningOrManageable`, `BaseEntity.delete()`(`delYn='Y'`), `bprojaSyncService.upsert(abusMngNo, abusMngNo, PRJ_STS_COUNCIL_TARGET)`.
- Produces: `CouncilService.cancelCouncil(String asctId): void`, `DELETE /api/council/{asctId}` → 204.

- [ ] **Step 1: 테스트를 쓴다**

`CouncilServiceTest.java`의 `skipCouncil` 블록 앞에 추가:

```java
    // ───────────────────────────────────────────────────────
    // cancelCouncil (COUNCIL-010)
    // ───────────────────────────────────────────────────────

    @ParameterizedTest(name = "cancelCouncil: 상태 {0}에서는 IllegalStateException")
    @ValueSource(strings = {"03", "04", "05", "13", "99"})
    void cancelCouncil_01_02아님_예외(String status) {
        Basctm council = mock(Basctm.class);
        given(council.getItPtlAsctPrgStsTc()).willReturn(status);
        given(councilRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N"))
                .willReturn(Optional.of(council));

        assertThatThrownBy(() -> councilService.cancelCouncil(ASCT_ID))
                .isInstanceOf(IllegalStateException.class);
        verify(council, never()).delete();
        verify(bprojaSyncService, never()).upsert(any(), any(), any());
    }

    @Test
    @DisplayName("cancelCouncil: 권한 검사를 상태 검사보다 먼저 한다")
    void cancelCouncil_권한없음_403() {
        Basctm council = mock(Basctm.class);
        given(councilRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N"))
                .willReturn(Optional.of(council));
        willThrow(new AccessDeniedException("권한 없음"))
                .given(councilAccessGuard)
                .verifyOwningOrManageable(council);

        assertThatThrownBy(() -> councilService.cancelCouncil(ASCT_ID))
                .isInstanceOf(AccessDeniedException.class);
        verify(council, never()).delete();
    }

    @ParameterizedTest(name = "cancelCouncil: 사업 협의회 상태 {0}이면 원장을 삭제하고 사업을 신청 대상(09)으로 되돌린다")
    @ValueSource(strings = {"01", "02"})
    void cancelCouncil_사업협의회_삭제및사업상태복귀(String status) {
        Basctm council = mock(Basctm.class);
        given(council.getItPtlAsctPrgStsTc()).willReturn(status);
        given(council.getItPtlAsctDbrTc()).willReturn("03");
        given(council.getAbusMngNo()).willReturn("PRJ-2026-0001");
        given(councilRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N"))
                .willReturn(Optional.of(council));

        councilService.cancelCouncil(ASCT_ID);

        verify(council).delete();
        verify(bprojaSyncService).upsert("PRJ-2026-0001", "PRJ-2026-0001", "09");
    }

    @Test
    @DisplayName("cancelCouncil: 계획협의회(02 유형)는 원장만 삭제하고 사업 상태는 건드리지 않는다")
    void cancelCouncil_계획협의회_원장만삭제() {
        Basctm council = mock(Basctm.class);
        given(council.getItPtlAsctPrgStsTc()).willReturn("01");
        given(council.getItPtlAsctDbrTc()).willReturn("02");
        given(council.getAbusMngNo()).willReturn("PLN-2026-0001");
        given(councilRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N"))
                .willReturn(Optional.of(council));

        councilService.cancelCouncil(ASCT_ID);

        verify(council).delete();
        verify(bprojaSyncService, never()).upsert(any(), any(), any());
    }
```

필요한 import(없는 것만): `org.junit.jupiter.params.ParameterizedTest`, `org.junit.jupiter.params.provider.ValueSource`, `org.springframework.security.access.AccessDeniedException`, `static org.mockito.BDDMockito.willThrow`, `static org.mockito.ArgumentMatchers.any`, `static org.mockito.Mockito.never`.

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilServiceTest' -q`
Expected: 컴파일 실패 — `cancelCouncil` 없음.

- [ ] **Step 3: 서비스·컨트롤러를 만든다**

`CouncilService.java`의 `skipCouncil` 메서드 바로 위:

```java
    /**
     * 오신청 취소 (COUNCIL-010)
     *
     * <p>결재 이력이 없는 작성중(01)·작성완료(02) 협의회만 취소할 수 있습니다. 원장을 소프트 삭제하고, 사업 협의회면 신청 때
     * '타당성검토 정실협 진행중'(45)으로 올렸던 사업 상태를 '예산편성 요청 결재완료'(09, 신청 대상)로 되돌립니다. 계획협의회(02 유형)는
     * 사업 상태 연동이 없으므로 원장만 삭제합니다. 하위 문서는 원장 삭제로 접근이 끊기므로 건드리지 않습니다.
     *
     * @param asctId 협의회ID
     * @throws org.springframework.security.access.AccessDeniedException 관리자·주관부서가 아닌 경우(403)
     * @throws IllegalArgumentException 협의회가 없거나 이미 삭제된 경우(404)
     * @throws IllegalStateException 작성중·작성완료가 아닌 경우(409)
     */
    @Transactional
    public void cancelCouncil(String asctId) {
        Basctm council = findActiveCouncil(asctId);
        councilAccessGuard.verifyOwningOrManageable(council);

        String status = council.getItPtlAsctPrgStsTc();
        if (!"01".equals(status) && !"02".equals(status)) {
            throw new IllegalStateException(
                    "협의회 취소는 작성중(01)·작성완료(02) 상태에서만 가능합니다. 현재 상태: " + status);
        }

        council.delete();

        if (!"02".equals(council.getItPtlAsctDbrTc())) {
            // createCouncil이 09 → 45로 올린 것의 역방향
            bprojaSyncService.upsert(
                    council.getAbusMngNo(), council.getAbusMngNo(), PRJ_STS_COUNCIL_TARGET);
        }
    }
```

`CouncilController.java`의 `getCouncilList` 메서드 아래:

```java
    /**
     * 협의회 오신청 취소 (COUNCIL-010)
     *
     * <p>결재 이력이 없는 작성중(01)·작성완료(02) 협의회를 소프트 삭제하고 사업을 신청 대상 상태로 되돌립니다.
     *
     * @param asctId 협의회ID
     * @return HTTP 204
     */
    @Operation(summary = "협의회 취소", description = "작성중·작성완료 협의회를 취소(소프트 삭제)합니다. 관리자 또는 주관부서만 가능합니다.")
    @ApiResponses(
            value = {
                @ApiResponse(responseCode = "204", description = "취소 성공"),
                @ApiResponse(responseCode = "403", description = "관리자·주관부서 아님", content = @Content),
                @ApiResponse(responseCode = "404", description = "존재하지 않는 협의회", content = @Content),
                @ApiResponse(responseCode = "409", description = "취소할 수 없는 상태", content = @Content)
            })
    @DeleteMapping("/{asctId}")
    public ResponseEntity<Void> cancelCouncil(
            @Parameter(description = "협의회ID", required = true, example = "ASCT-2026-0001")
                    @PathVariable("asctId")
                    String asctId) {
        councilService.cancelCouncil(asctId);
        return ResponseEntity.noContent().build();
    }
```

`import org.springframework.web.bind.annotation.DeleteMapping;`를 추가한다.

- [ ] **Step 4: 통과·포맷을 확인한다**

Run: `./gradlew spotlessApply -q && ./gradlew test --tests 'com.kdb.it.domain.council.*' spotlessJavaCheck -q`
Expected: BUILD SUCCESSFUL, council 도메인 전부 PASS(기존 423건 + 신규).

- [ ] **Step 5: 커밋한다**

```bash
git add src/main/java/com/kdb/it/domain/council/service/CouncilService.java src/main/java/com/kdb/it/domain/council/controller/CouncilController.java src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java
git commit -m "feat(council): 작성중·작성완료 협의회 취소 API 추가, 사업 상태를 신청 대상으로 복귀 (COUNCIL-010)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 프론트 API·판정·액션 (`useCouncilLifecycleApi`, `useCouncilRequestPage`)

**Files:**
- Modify: `it_frontend/app/composables/council/useCouncilLifecycleApi.ts` (`startPreparation` 아래, return 목록)
- Modify: `it_frontend/app/composables/useCouncilRequestPage.ts` (구조분해, `handleSkip` 근처, return)
- Modify: `it_frontend/i18n/messages/council.ts` (`council.request.toast`, `council.requestDetail` ko/en)
- Test: `it_frontend/tests/unit/composables/useCouncilRequestPage.test.ts`

**Interfaces:**
- Consumes: `$apiFetch`(context), `attemptDetailRefresh`, `notifySuccess`, `failureDetail`, `navigateTo`, `isAdmin()`, `user.value.bbrC`, `councilData.value.svnDpm`.
- Produces: `reopenFeasibility(asctId): Promise<void>`, `cancelCouncil(asctId): Promise<void>` (API); composable의 `canReopen: ComputedRef<boolean>`, `canCancel: ComputedRef<boolean>`, `reopenPending: Ref<boolean>`, `cancelPending: Ref<boolean>`, `reopenFeasibility(): Promise<void>`, `cancelCouncil(): Promise<void>`.

- [ ] **Step 1: 테스트를 쓴다**

`useCouncilRequestPage.test.ts`의 `mocks`에 `reopenFeasibility: vi.fn(), cancelCouncil: vi.fn(),`를 추가하고, `vi.mock('~/composables/useCouncil', …)` 반환 객체에 `reopenFeasibility: mocks.reopenFeasibility, cancelCouncil: mocks.cancelCouncil,`를 추가한다. 그리고 `describe('useCouncilRequestPage — 상태 판정 computed'` 앞에:

```ts
describe('useCouncilRequestPage — 수정 복귀·신청 취소 (COUNCIL-010)', () => {
    /** 주관부서 일반 사용자 — 목록 픽스처의 svnDpm 'D001'과 같은 부서 */
    const asOwningUser = () => {
        authUser.value = { athIds: [ROLE.USER], bbrC: 'D001' } as typeof authUser.value;
    };
    /** 타 부서 일반 사용자 */
    const asOtherUser = () => {
        authUser.value = { athIds: [ROLE.USER], bbrC: 'D999' } as typeof authUser.value;
    };

    it('canReopen은 작성완료(02)이면서 관리자 또는 주관부서일 때만 참이다', () => {
        asOwningUser();
        expect(createPage({ councilData: baseCouncilDetail({ asctStsC: '02' }) }).page.canReopen.value).toBe(true);
        expect(createPage({ councilData: baseCouncilDetail({ asctStsC: '01' }) }).page.canReopen.value).toBe(false);
        asOtherUser();
        expect(createPage({ councilData: baseCouncilDetail({ asctStsC: '02' }) }).page.canReopen.value).toBe(false);
        mocks.isAdmin.mockReturnValue(true);
        expect(createPage({ councilData: baseCouncilDetail({ asctStsC: '02' }) }).page.canReopen.value).toBe(true);
    });

    it('canCancel은 작성중(01)·작성완료(02)이면서 관리자 또는 주관부서일 때만 참이다', () => {
        asOwningUser();
        expect(createPage({ councilData: baseCouncilDetail({ asctStsC: '01' }) }).page.canCancel.value).toBe(true);
        expect(createPage({ councilData: baseCouncilDetail({ asctStsC: '02' }) }).page.canCancel.value).toBe(true);
        expect(createPage({ councilData: baseCouncilDetail({ asctStsC: '03' }) }).page.canCancel.value).toBe(false);
        asOtherUser();
        expect(createPage({ councilData: baseCouncilDetail({ asctStsC: '01' }) }).page.canCancel.value).toBe(false);
    });

    it('reopenFeasibility 성공 시 성공 토스트를 띄우고 상세를 재조회한다', async () => {
        asOwningUser();
        mocks.reopenFeasibility.mockResolvedValue(undefined);
        const { page, pageData } = createPage({ councilData: baseCouncilDetail({ asctStsC: '02' }) });

        await page.reopenFeasibility();

        expect(mocks.reopenFeasibility).toHaveBeenCalledWith(asctId);
        expect(pageData.councilFetch.refresh).toHaveBeenCalled();
        expect(mocks.toastAdd).toHaveBeenCalledWith(
            expect.objectContaining({ severity: 'success', summary: '수정으로 되돌렸습니다' }),
        );
        expect(page.reopenPending.value).toBe(false);
    });

    it('reopenFeasibility 실패 시 서버 메시지로 실패 토스트를 띄운다', async () => {
        asOwningUser();
        mocks.reopenFeasibility.mockRejectedValue({ data: { message: '작성완료 상태가 아닙니다.' } });
        const { page } = createPage({ councilData: baseCouncilDetail({ asctStsC: '02' }) });

        await page.reopenFeasibility();

        expect(mocks.toastAdd).toHaveBeenCalledWith(
            expect.objectContaining({ severity: 'error', detail: '작성완료 상태가 아닙니다.' }),
        );
    });

    it('cancelCouncil 성공 시 성공 토스트 후 목록으로 이동한다', async () => {
        asOwningUser();
        mocks.cancelCouncil.mockResolvedValue(undefined);
        const { page } = createPage({ councilData: baseCouncilDetail({ asctStsC: '01' }) });

        await page.cancelCouncil();

        expect(mocks.cancelCouncil).toHaveBeenCalledWith(asctId);
        expect(mocks.toastAdd).toHaveBeenCalledWith(
            expect.objectContaining({ severity: 'success', summary: '협의회 신청을 취소했습니다' }),
        );
        expect(mocks.navigateTo).toHaveBeenCalledWith('/info/council-request');
    });

    it('cancelCouncil 실패 시 이동하지 않고 실패 토스트만 띄운다', async () => {
        asOwningUser();
        mocks.cancelCouncil.mockRejectedValue(new Error('서버 오류'));
        const { page } = createPage({ councilData: baseCouncilDetail({ asctStsC: '01' }) });

        await page.cancelCouncil();

        expect(mocks.navigateTo).not.toHaveBeenCalled();
        expect(mocks.toastAdd).toHaveBeenCalledWith(
            expect.objectContaining({ severity: 'error', detail: '서버 오류' }),
        );
        expect(page.cancelPending.value).toBe(false);
    });
});
```

`authUser`의 타입에 `bbrC`가 없으면 선언을 `ref<{ athIds?: string[]; bbrC?: string } | null>(null)`로 넓히고 위 `as` 캐스트를 지운다. `ROLE.USER`가 없으면 `ROLE`에 정의된 일반 사용자 상수명(`app/types/auth.ts` 확인)을 쓴다.

- [ ] **Step 2: 실패를 확인한다**

Run (in `C:\it\it_frontend`): `npx vitest run tests/unit/composables/useCouncilRequestPage.test.ts`
Expected: 신규 6건 FAIL(`canReopen` 등이 undefined).

- [ ] **Step 3: API 호출을 추가한다**

`useCouncilLifecycleApi.ts`의 `startPreparation` 아래:

```ts
    /**
     * 작성완료(02) 타당성검토표를 작성중(01)으로 되돌립니다 (COUNCIL-010).
     * 결재 요청 전에만 가능하며 관리자·주관부서만 호출할 수 있습니다(그 외 403, 상태 위반 409).
     *
     * @param asctId 협의회ID
     */
    const reopenFeasibility = async (asctId: string): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}/reopen`, { method: 'PATCH' });
    };

    /**
     * 작성중(01)·작성완료(02) 협의회 신청을 취소합니다 (COUNCIL-010).
     * 원장이 소프트 삭제되고 사업은 신청 대상 상태로 돌아갑니다(권한 403, 상태 위반 409).
     *
     * @param asctId 협의회ID
     */
    const cancelCouncil = async (asctId: string): Promise<void> => {
        await $apiFetch(`${BASE}/${asctId}`, { method: 'DELETE' });
    };
```

return 목록에 `reopenFeasibility, cancelCouncil,`을 추가한다. `useCouncil`은 `...useCouncilLifecycleApi(context)`로 펼치므로 추가 배선이 없다.

- [ ] **Step 4: i18n 키를 추가한다**

`i18n/messages/council.ts` ko `council.request.toast`(`approvalRequestFailedDetail` 아래):

```ts
                    reopened: '수정으로 되돌렸습니다',
                    reopenedDetail: '타당성검토표를 다시 편집할 수 있습니다.',
                    reopenFailed: '수정 복귀 실패',
                    reopenFailedDetail: '수정으로 되돌리는 중 오류가 발생했습니다.',
                    cancelled: '협의회 신청을 취소했습니다',
                    cancelledDetail: '사업은 다시 협의회 신청 대상으로 돌아갔습니다.',
                    cancelFailed: '신청 취소 실패',
                    cancelFailedDetail: '신청 취소 중 오류가 발생했습니다.',
```

ko `council.requestDetail`(`planAttachment` 아래):

```ts
                reopen: '수정으로 되돌리기',
                reopenConfirmHeader: '수정으로 되돌리기',
                reopenConfirmMessage:
                    '작성완료를 취소하고 타당성검토표를 다시 편집합니다. 결재 요청 전에만 가능합니다. 계속할까요?',
                cancel: '신청 취소',
                cancelConfirmHeader: '협의회 신청 취소',
                cancelConfirmMessage:
                    '이 협의회 신청을 취소합니다. 작성한 타당성검토표는 더 이상 열 수 없고 사업은 신청 대상으로 돌아갑니다. 되돌릴 수 없습니다. 계속할까요?',
```

en `council.request.toast`:

```ts
                    reopened: 'Reverted to editing',
                    reopenedDetail: 'You can edit the feasibility report again.',
                    reopenFailed: 'Failed to revert',
                    reopenFailedDetail: 'An error occurred while reverting to editing.',
                    cancelled: 'Council request cancelled',
                    cancelledDetail: 'The project is available for a new council request.',
                    cancelFailed: 'Failed to cancel',
                    cancelFailedDetail: 'An error occurred while cancelling the request.',
```

en `council.requestDetail`:

```ts
                reopen: 'Revert to Editing',
                reopenConfirmHeader: 'Revert to Editing',
                reopenConfirmMessage:
                    'This undoes completion so you can edit the feasibility report again. Only possible before requesting approval. Continue?',
                cancel: 'Cancel Request',
                cancelConfirmHeader: 'Cancel Council Request',
                cancelConfirmMessage:
                    'This cancels the council request. The feasibility report will no longer be accessible and the project returns to the request pool. This cannot be undone. Continue?',
```

- [ ] **Step 5: composable에 판정·액션을 추가한다**

`useCouncilRequestPage.ts` 구조분해(`startPreparation, createSkipRequest,` 근처)에 `reopenFeasibility: reopenFeasibilityApi, cancelCouncil: cancelCouncilApi,`를 추가하려면 `fetchCouncilRequestPageData`의 return에 두 함수를 넣어야 한다 — `useCouncil()` 구조분해에 `reopenFeasibility, cancelCouncil,`을 더하고 return 객체에도 넣는다. 그리고 `handleSkip` 정의 바로 위에:

```ts
    /**
     * 현재 사용자가 이 협의회의 주관부서인지 (목록 카드의 isDeptCharge와 같은 판정)
     * 서버의 verifyOwningOrManageable과 같은 기준이며, 버튼 노출에만 쓴다.
     */
    const isOwningDept = computed(
        () =>
            !!user.value?.bbrC &&
            !!councilData.value?.svnDpm &&
            user.value.bbrC === councilData.value.svnDpm,
    );

    /** 관리 또는 주관부서 — 수정 복귀·신청 취소 공통 권한 (COUNCIL-010) */
    const canOwnOrManage = computed(() => isAdmin() || isOwningDept.value);

    /** 작성완료(02)에서 결재 요청 전에만 수정으로 되돌릴 수 있다 (COUNCIL-010) */
    const canReopen = computed(() => councilStatus.value === '02' && canOwnOrManage.value);

    /** 결재 이력이 없는 작성중(01)·작성완료(02)에서만 신청을 취소할 수 있다 (COUNCIL-010) */
    const canCancel = computed(
        () =>
            (councilStatus.value === '01' || councilStatus.value === '02') &&
            canOwnOrManage.value,
    );

    const reopenPending = ref(false);

    /**
     * 작성완료를 취소하고 작성중으로 되돌린다 (COUNCIL-010). 확인 다이얼로그는 페이지가 감싼다.
     * 성공하면 상세를 재조회해 readonly가 풀린다(실패는 ERR-13 배너).
     */
    const reopenFeasibility = async (): Promise<void> => {
        reopenPending.value = true;
        try {
            await reopenFeasibilityApi(asctId);
            notifySuccess('reopened', 'reopenedDetail', 3000);
            await attemptDetailRefresh(t('council.request.detailRetryFailure'));
        } catch (e: unknown) {
            toast.add({
                severity: 'error',
                summary: t('council.request.toast.reopenFailed'),
                detail: failureDetail(e, 'reopenFailedDetail'),
                life: 4000,
            });
        } finally {
            reopenPending.value = false;
        }
    };

    const cancelPending = ref(false);

    /**
     * 협의회 신청을 취소하고 목록으로 돌아간다 (COUNCIL-010). 확인 다이얼로그는 페이지가 감싼다.
     * 취소된 협의회는 더 이상 조회할 수 없으므로 재조회 대신 목록으로 이동한다(목록은 onActivated 재조회로 갱신).
     */
    const cancelCouncil = async (): Promise<void> => {
        cancelPending.value = true;
        try {
            await cancelCouncilApi(asctId);
            notifySuccess('cancelled', 'cancelledDetail', 4000);
            navigateTo('/info/council-request');
        } catch (e: unknown) {
            toast.add({
                severity: 'error',
                summary: t('council.request.toast.cancelFailed'),
                detail: failureDetail(e, 'cancelFailedDetail'),
                life: 4000,
            });
        } finally {
            cancelPending.value = false;
        }
    };
```

`councilStatus`가 이 위치보다 아래에서 선언돼 있으면 이 블록을 `councilStatus`·`readonly` 선언 뒤로 옮긴다. return 객체에 `canReopen, canCancel, reopenPending, cancelPending, reopenFeasibility, cancelCouncil,`을 추가한다.

- [ ] **Step 6: 통과·타입·포맷을 확인한다**

Run: `npx prettier --write app/composables/council/useCouncilLifecycleApi.ts app/composables/useCouncilRequestPage.ts i18n/messages/council.ts tests/unit/composables/useCouncilRequestPage.test.ts && npx vitest run tests/unit/composables/useCouncilRequestPage.test.ts && npm run typecheck && npm run check:copy`
Expected: 전부 PASS(신규 6건 포함), 타입 오류 0, 고정 리터럴 ratchet 통과.

- [ ] **Step 7: 커밋한다**

```bash
git add app/composables/council/useCouncilLifecycleApi.ts app/composables/useCouncilRequestPage.ts i18n/messages/council.ts tests/unit/composables/useCouncilRequestPage.test.ts
git commit -m "feat(council): 수정 복귀·신청 취소 API 호출과 판정·액션 추가 (COUNCIL-010)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Step1 페이지 버튼과 확인 다이얼로그

**Files:**
- Modify: `it_frontend/app/pages/info/council-request/[id].vue` (구조분해, `isSubmitted` 영역, 저장 버튼 영역)

**Interfaces:**
- Consumes: Task 4의 `canReopen`, `canCancel`, `reopenPending`, `cancelPending`, `reopenFeasibility()`, `cancelCouncil()`; PrimeVue `useConfirm`(`primevue/useconfirm`, `result/[id].vue`와 같은 사용법). `app.vue`에 `<ConfirmDialog />`가 이미 있는지 확인한다(`result/[id].vue`가 쓰므로 있어야 한다).

- [ ] **Step 1: 스크립트에 확인 래퍼를 추가한다**

`[id].vue` 구조분해에 `canReopen, canCancel, reopenPending, cancelPending, reopenFeasibility, cancelCouncil,`을 추가하고, `import { useConfirm } from 'primevue/useconfirm';`를 import 블록에 넣은 뒤 `const { t } = useI18n();` 아래에:

```ts
const confirm = useConfirm();

/** 수정으로 되돌리기 — 작성완료 취소는 되돌릴 수 있지만 사용자가 의도를 확인하도록 한 번 묻는다 (COUNCIL-010) */
const confirmReopen = () =>
    confirm.require({
        header: t('council.requestDetail.reopenConfirmHeader'),
        message: t('council.requestDetail.reopenConfirmMessage'),
        icon: 'pi pi-pencil',
        acceptLabel: t('council.requestDetail.reopen'),
        rejectLabel: t('common.actions.cancel'),
        accept: () => void reopenFeasibility(),
    });

/** 신청 취소 — 되돌릴 수 없으므로 위험 스타일로 묻는다 (COUNCIL-010) */
const confirmCancel = () =>
    confirm.require({
        header: t('council.requestDetail.cancelConfirmHeader'),
        message: t('council.requestDetail.cancelConfirmMessage'),
        icon: 'pi pi-exclamation-triangle',
        acceptLabel: t('council.requestDetail.cancel'),
        acceptClass: 'p-button-danger',
        rejectLabel: t('common.actions.cancel'),
        accept: () => void cancelCouncil(),
    });
```

- [ ] **Step 2: 템플릿에 버튼을 넣는다**

`isSubmitted` 영역을 다음으로 바꾼다:

```vue
        <!-- ── SUBMITTED 상태: 수정으로 되돌리기 / 결재 요청 ── -->
        <div v-if="isSubmitted" class="flex justify-end gap-3">
            <Button
                v-if="canReopen"
                :label="t('council.requestDetail.reopen')"
                icon="pi pi-pencil"
                severity="secondary"
                outlined
                :loading="reopenPending"
                @click="confirmReopen"
            />
            <Button
                :label="t('council.requestDetail.requestApproval')"
                @click="showApprovalDialog = true"
            />
        </div>
```

저장 버튼 영역(`<div v-if="canEdit" class="flex justify-end gap-3 pb-6">`) 바로 아래에 취소 영역을 추가한다:

```vue
        <!-- ── 신청 취소 (작성중·작성완료, 관리자 또는 주관부서) — 결재 이력이 생기기 전에만 ── -->
        <div v-if="canCancel" class="flex justify-end pb-6">
            <Button
                :label="t('council.requestDetail.cancel')"
                icon="pi pi-times"
                severity="danger"
                text
                size="small"
                :loading="cancelPending"
                @click="confirmCancel"
            />
        </div>
```

- [ ] **Step 3: 타입·린트·포맷을 확인한다**

Run: `npx prettier --write "app/pages/info/council-request/[id].vue" && npx eslint "app/pages/info/council-request/[id].vue" && npm run typecheck && npx vitest run tests/unit/pages/councilRequestDetailPageBoundary.test.ts`
Expected: 오류 0, 경계 테스트 PASS.

- [ ] **Step 4: 커밋한다**

```bash
git add "app/pages/info/council-request/[id].vue"
git commit -m "feat(council): Step1에 수정으로 되돌리기·신청 취소 버튼과 확인 다이얼로그 추가 (COUNCIL-010)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 생성 타입 갱신과 전체 게이트, 완료 기록

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (codegen 산출물, 수기 편집 금지)
- Modify: `C:\it\TASK_COUNCIL.md`, `C:\it\TASK_COUNCIL_DONE.md`
- Move: spec → `docs/superpowers/specs/done/`, plan → `docs/superpowers/plans/done/`

- [ ] **Step 1: 백엔드를 띄우고 codegen을 돌린다**

Run (in `C:\it\it_backend`, 백그라운드): `./gradlew bootRun --args='--spring.profiles.active=local-ext' -q` → `http://localhost:28080/v3/api-docs`가 응답할 때까지 기다린 뒤 (in `C:\it\it_frontend`) `npm run codegen && npm run codegen:check`.
Expected: `app/types/api.d.ts`에 `"/api/council/{asctId}/reopen"`(patch)와 `"/api/council/{asctId}"`(delete)가 생긴다. 끝나면 bootRun 프로세스를 종료하고 `./gradlew --stop`.

주의: 로컬 백엔드 기동은 Flyway가 `it_database/migrations`를 적용한다(local-ext). 편집 중인 마이그레이션이 없으므로 안전하다.

- [ ] **Step 2: 프론트 전체 게이트**

Run (in `C:\it\it_frontend`): `npm run format:check && npm run check && npm test`
Expected: 통과. `npm test`의 기존 환경 실패 2건(`project-domain-i18n`·`ItBudgetSourceChangedDialog`, Node ICU 한국어 시각)은 협의회와 무관하므로 그대로 기록한다.

- [ ] **Step 3: 백엔드 전체 게이트**

Run (in `C:\it\it_backend`): `./gradlew test -q && ./gradlew spotlessJavaCheck -q`
Expected: BUILD SUCCESSFUL. 건수는 `build/test-results/test/*.xml`의 `tests`/`failures` 합으로 기록한다. `OnePassClientTest` 플레이키가 재현되면 단독 재실행 결과를 함께 적는다.

- [ ] **Step 4: 프론트 커밋**

```bash
git add app/types/api.d.ts
git commit -m "chore(council): reopen·cancel 엔드포인트 OpenAPI 타입 재생성 (COUNCIL-010)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: 완료 기록**

`TASK_COUNCIL.md`에서 `| COUNCIL-010 | 중간 | 진행 |` 행을 삭제한다. `TASK_COUNCIL_DONE.md`의 `## 2026-09-21` 표 맨 위에 추가:

```markdown
| COUNCIL-010 | ✅ Done | 결재 회수 이벤트 리스너(`ApprovalRecalledEvent` → `03→02`, `12→11`, 그 밖은 무시), `PATCH /api/council/{id}/reopen`(작성완료 `02→01`, `BPOVWM.KPN_TP_TC=10`), `DELETE /api/council/{id}`(작성중·작성완료 소프트 삭제, 사업 협의회는 `BPROJA` `45→09` 복귀, 계획협의회는 원장만). 권한은 관리 또는 주관부서(`verifyOwningOrManageable`), 상태 위반 409. Step1에 [수정으로 되돌리기]·[신청 취소] 버튼과 확인 다이얼로그 | [설계](docs/superpowers/specs/done/2026-09-21-council-reopen-cancel-recall-design.md) · [계획](docs/superpowers/plans/done/2026-09-21-council-reopen-cancel-recall.md) |
```

표 아래 문단(건수는 Step 2·3의 실제 값):

```markdown
코드 변경(COUNCIL-010): `it_backend` — `CouncilApprovalEventListener.java`, `CouncilApprovalService.java`, `FeasibilityService.java`, `CouncilService.java`, `CouncilFeasibilityController.java`, `CouncilController.java`, `Bpovwm.java`, 테스트 4개. `it_frontend` — `composables/council/useCouncilLifecycleApi.ts`, `composables/useCouncilRequestPage.ts`, `pages/info/council-request/[id].vue`, `i18n/messages/council.ts`(키 14개 ko/en), `types/api.d.ts`(codegen), 테스트 1개. DB 스키마·공통 결재 모듈 변경 없음.

검증 결과(COUNCIL-010):

- 백엔드: 회수 리스너·서비스 5건, reopen 4건, cancel 8건 신규 통과. `com.kdb.it.domain.council.*` N건, 전체 `./gradlew test` N건 통과, `spotlessJavaCheck` 통과.
- 프론트: `useCouncilRequestPage.test.ts` 신규 6건(판정 2·복귀 2·취소 2) 통과, `npm run check`·`format:check`·`codegen:check` 통과, `npm test` N건 통과.

미검증 범위(COUNCIL-010): 실제 공통 결재 화면에서 회수 → 협의회 02 복귀의 종단 확인(리스너는 단위 테스트로만), 확인 다이얼로그·버튼 배선(페이지 컴포넌트 테스트 없음), 취소 후 사업이 목록에 미신청 행으로 다시 보이는지의 브라우저 확인.
```

```bash
cd C:\it
git mv docs/superpowers/specs/2026-09-21-council-reopen-cancel-recall-design.md docs/superpowers/specs/done/
git mv docs/superpowers/plans/2026-09-21-council-reopen-cancel-recall.md docs/superpowers/plans/done/
```

옮긴 스펙의 `[COUNCIL-010](../../../TASK_COUNCIL.md)`를 `../../../../TASK_COUNCIL.md`로, `[COUNCIL-011 설계](done/…)`를 `(2026-09-20-council-write-boundaries-design.md)`로, 옮긴 계획의 `**Spec:**` 경로를 `docs/superpowers/specs/done/2026-09-21-council-reopen-cancel-recall-design.md`로 고친다.

- [ ] **Step 6: 루트 커밋**

```bash
git add TASK_COUNCIL.md TASK_COUNCIL_DONE.md docs/superpowers/specs/done/2026-09-21-council-reopen-cancel-recall-design.md docs/superpowers/plans/done/2026-09-21-council-reopen-cancel-recall.md
git commit -m "docs(council): COUNCIL-010 완료 기록 및 설계·계획 문서 이동

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

푸시는 사용자 확인 후 `it_backend`·`it_frontend`는 `origin/K230028`, 루트는 `fork/K230028`에 올린다.
