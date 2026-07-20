# 영향도 낮은 TASK 백로그 묶음 처리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md`의 W2(코드부채)+🟢 Low 13개 항목을 위험도로 분리한 4개 묶음 PR(PR-1 백엔드 안전 애너테이션, PR-2 백엔드 정리, PR-3 쿼리 N+1, PR-4 프론트 에러 피드백)로 처리한다.

**Architecture:** 동작 불변 묶음(PR-1·2·4)은 안전하게 일괄 머지, 동작 보존이 필요한 쿼리 변경(PR-3)만 분리해 Mockito 단위테스트로 검증. 백엔드 통합테스트 인프라 부재(T18)로 N+1 검증은 `verify(times(1))` 수준으로 제한된다.

**Tech Stack:** Spring Boot 4.1 / Java 25 / Spring Data JPA + QueryDSL 5.1 (백엔드), Nuxt 4 / Vue 3 `<script setup>` / TypeScript / Vitest (프론트). 테스트: JUnit 5 + `@WebMvcTest` + `@MockitoBean` + BDDMockito (백엔드), Vitest + @vue/test-utils (프론트).

**설계 문서:** [`2026-06-29-low-impact-task-bundling-design.md`](../specs/2026-06-29-low-impact-task-bundling-design.md)

**카브아웃(이 plan 제외):** changeStatus role 분기·환율 규칙 통일·@Valid 제약 전수 설계는 별도 트랙. 단 PR-1의 @Valid는 "서비스가 이미 non-null로 가정하는 핵심 필드"에만 보수적으로 제약을 추가한다(유효한 클라이언트에는 동작 보존).

---

## 진행 순서

PR-1 → PR-2 → PR-4(안전 3종 선청산) → PR-3(집중 리뷰). 각 PR은 독립이며 병행 가능. 각 PR 머지 후 `TASK.md`에서 해당 항목 체크.

---

# PR-1 — 백엔드 안전 애너테이션

> 동작 불변(@Transactional) + 동작 경미(@Valid는 유효 클라이언트 보존). CLAUDE.md §5.5(트랜잭션 규칙)·§5.5.2(@Valid 일관성) 준수.

## Task 1: PlanService 클래스 레벨 @Transactional(readOnly=true)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java:35-49,79,169`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/plan/service/PlanServiceTest.java` (기존)

- [ ] **Step 1: 기존 테스트가 통과하는지 먼저 확인 (베이스라인)**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.plan.service.PlanServiceTest"`
Expected: PASS (변경 전 그린 상태 확인)

- [ ] **Step 2: 클래스 선언에 클래스 레벨 어노테이션 추가 + 완료된 TODO 주석 제거**

현재 (L35-49):
```java
/**
 * 정보기술부문 계획 서비스
 *
 * <p>
 * 정보기술부문계획(TPRMPP_BPLANM)과 정보기술부문계획 관계(TPRMPP_BPLANA)의
 * 등록, 조회, 삭제 비즈니스 로직을 담당합니다.
 * </p>
 */
// 후속 과제: 클래스 레벨 @Transactional(readOnly=true) 추가 필요 — 조회 위주 서비스이므로 메서드별 어노테이션
// 누락 방지 (CLAUDE.md §5.5)
// 누락 배경: 초기 개발 시 트랜잭션 전략 미수립. 쓰기 메서드에 @Transactional(readOnly=false) 오버라이드 후
// 클래스 레벨 적용 예정.
@Service
@RequiredArgsConstructor
public class PlanService {
```

변경 후:
```java
/**
 * 정보기술부문 계획 서비스
 *
 * <p>
 * 정보기술부문계획(TPRMPP_BPLANM)과 정보기술부문계획 관계(TPRMPP_BPLANA)의
 * 등록, 조회, 삭제 비즈니스 로직을 담당합니다.
 * </p>
 *
 * <p>조회 위주 서비스이므로 클래스 레벨 {@code @Transactional(readOnly=true)}를 적용하고,
 * 쓰기 메서드는 메서드 레벨 {@code @Transactional}로 오버라이드합니다 (CLAUDE.md §5.5).</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PlanService {
```
(`import org.springframework.transaction.annotation.Transactional;`은 L30에 이미 존재.)

- [ ] **Step 3: 조회 메서드의 중복 @Transactional(readOnly=true) 제거**

클래스 레벨로 흡수되므로 L79·L169의 메서드 레벨 `@Transactional(readOnly = true)` 한 줄씩 제거. 쓰기 메서드 L203·L313·L341의 `@Transactional`(readOnly=false 오버라이드)은 **그대로 유지**.

L79 (제거):
```java
        @Transactional(readOnly = true)
        public List<PlanDto.ListResponse> getPlans() {
```
→
```java
        public List<PlanDto.ListResponse> getPlans() {
```

L169 (제거):
```java
        @Transactional(readOnly = true)
        public PlanDto.DetailResponse getPlan(String reqDocNo) {
```
→
```java
        public PlanDto.DetailResponse getPlan(String reqDocNo) {
```

- [ ] **Step 4: 컴파일 + 기존 테스트 재확인 (동작 불변)**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.plan.service.PlanServiceTest"`
Expected: PASS (쓰기 메서드 오버라이드 유지로 동작 동일)

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java
git commit -m "refactor: PlanService 클래스 레벨 @Transactional(readOnly) 적용 (TASK W2)"
```

## Task 2: LoginAttemptService 클래스 레벨 @Transactional(readOnly=true)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/service/LoginAttemptService.java:1-21`

- [ ] **Step 1: transaction import 추가**

L9 이후 import 블록에 추가:
```java
import org.springframework.transaction.annotation.Transactional;
```

- [ ] **Step 2: 클래스 선언에 클래스 레벨 어노테이션 추가**

현재 (L19-21):
```java
@Service
@RequiredArgsConstructor
public class LoginAttemptService {
```
변경 후:
```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LoginAttemptService {
```
(`checkLocked`는 `countByEno...` 조회 전용이므로 클래스 레벨 readOnly로 충분. 쓰기 메서드 없음.)

- [ ] **Step 3: 컴파일 + 기존 테스트 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.iam.service.*"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/iam/service/LoginAttemptService.java
git commit -m "refactor: LoginAttemptService 클래스 레벨 @Transactional(readOnly) 적용 (TASK W2)"
```

## Task 3: CouncilController @Valid + 핵심 필드 제약

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilController.java` (mutating @RequestBody 13곳)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java` (핵심 record 제약)
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/controller/CouncilControllerTest.java` (기존, 셋업 L42-79)

> **제약 범위 원칙:** 서비스가 이미 non-null로 가정하는 식별자/본문/컬렉션 필드에만 `@NotBlank`/`@NotNull`/`@NotEmpty` 추가. 선택 필드(`rqsOpnn`, `csfHopeYn`, `flMngNo` 등)는 건드리지 않는다 → 유효한 클라이언트에는 동작 보존, 잘못된 요청만 400.

- [ ] **Step 1: 실패 테스트 작성 — 필수 필드 누락 시 400**

`CouncilControllerTest`에 추가 (셋업의 `mockMvc`/`objectMapper`/`@WithMockUser` 패턴 재사용). `createCouncil`은 `prjMngNo` 필수:
```java
    @Test
    @DisplayName("POST /api/council - prjMngNo 누락 → 400")
    @WithMockUser(username = "10001", roles = "ADMIN")
    void createCouncil_prjMngNo누락_400() throws Exception {
        // prjMngNo=null, prjSno=null, dbrTc=null → 제약 위반
        var body = new CouncilDto.CreateRequest(null, null, null);
        mockMvc.perform(post("/api/council")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.controller.CouncilControllerTest.createCouncil_prjMngNo누락_400"`
Expected: FAIL (현재 @Valid·제약 없어 200/다른 경로)

- [ ] **Step 3: CouncilDto 핵심 record에 제약 추가**

`CouncilDto.java` 상단 import 추가 (L4 `import java.util.List;` 아래):
```java
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
```

각 record component에 제약 추가 (해당 record만 발췌, 나머지 필드/주석은 그대로 유지):

`CreateRequest` (L83):
```java
    public record CreateRequest(
        @NotBlank String prjMngNo,
        @NotNull Integer prjSno,
        @NotBlank String dbrTc
    ) {}
```

`FeasibilityRequest` (L144) — 저장구분 `kpnTc` 필수:
```java
    // (다른 필드는 기존 주석/타입 유지, kpnTc에만 제약 추가)
        @NotBlank
        String kpnTc,
```

`CommitteeRequest` (L240) — 위원 목록 필수:
```java
    public record CommitteeRequest(
        String dbrTc,
        @NotEmpty List<CommitteeMemberRequest> members
    ) {}
```

`ScheduleRequest` (L260) — 가능 슬롯 필수:
```java
    public record ScheduleRequest(
        @NotEmpty List<ScheduleItem> availableSlots,
        String csfHopeYn
    ) {}
```

`ScheduleConfirmRequest` (L284) — 확정 일자/시간 필수:
```java
    public record ScheduleConfirmRequest(
        @NotNull LocalDate cnrcDt,
        @NotBlank String cnrcTm,
        String cnrcPlc
    ) {}
```

`EvaluationRequest` (L302) — 항목 필수:
```java
    public record EvaluationRequest(
        @NotEmpty List<EvaluationItem> items
    ) {}
```

`ApprovalRequest` (L495) — 결재자 사번 필수:
```java
    public record ApprovalRequest(
        @NotBlank String approverEno,
        String rqsOpnn
    ) {}
```

`ResultApprovalRequest` (L526) — 결재자 사번 필수:
```java
    public record ResultApprovalRequest(
        @NotBlank String teamLeadEno,
        @NotBlank String deptHeadEno,
        String rqsOpnn
    ) {}
```

(`ResultRequest`·`FeasibilityRequest`의 본문 필드·`ApprovalCallbackRequest`(boolean)는 제약 미추가 — 선택/원시값.)

- [ ] **Step 4: CouncilController 모든 mutating @RequestBody에 @Valid 추가**

import 추가 (기존 import 블록 L1-31 내):
```java
import jakarta.validation.Valid;
```

13개 `@RequestBody` 파라미터 앞에 `@Valid` 추가 (라인: 121, 194, 218, 249, 278, 438, 461, 525, 551, 651, 703, 726, 839). 패턴:
```java
            @Valid @RequestBody CouncilDto.CreateRequest request,
```
대표 예 — `createCouncil` (L119-122):
```java
    @PostMapping
    public ResponseEntity<String> createCouncil(
            @Valid @RequestBody CouncilDto.CreateRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
```
`saveEvaluation` (L647-652):
```java
    @PostMapping("/{asctId}/evaluation")
    public ResponseEntity<Void> saveEvaluation(
            @Parameter(description = "협의회ID", required = true, example = "ASCT-2026-0001")
            @PathVariable("asctId") String asctId,
            @Valid @RequestBody CouncilDto.EvaluationRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
```
(나머지 11곳 동일하게 `@RequestBody` → `@Valid @RequestBody`. `ApprovalCallbackRequest`(L278)는 제약이 없어 @Valid가 no-op이나 일관성 위해 함께 부착.)

- [ ] **Step 5: 신규 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.controller.CouncilControllerTest"`
Expected: PASS (신규 400 테스트 + 기존 테스트 전부). 기존 정상-경로 테스트는 유효 DTO를 보내므로 그대로 통과해야 함. 만약 기존 테스트가 깨지면 그 DTO가 필수 필드를 비워 보내고 있다는 뜻 → 테스트 데이터를 유효값으로 보정.

- [ ] **Step 6: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilController.java it_backend/src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java it_backend/src/test/java/com/kdb/it/domain/council/controller/CouncilControllerTest.java
git commit -m "feat: CouncilController @Valid + 핵심 필드 제약 추가 (TASK W2)"
```

## Task 4: BoardPostController @Valid + 제목 제약

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/controller/BoardPostController.java:69-94,126-131`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/dto/BoardPostDto.java:99-151`
- Test: `it_backend/src/test/java/com/kdb/it/common/board/controller/BoardPostControllerTest.java` (기존 `*ControllerTest` 패턴 재사용. 없으면 §Task 3 셋업 패턴으로 신규 생성: `@WebMvcTest(BoardPostController.class)` + `@Import({TestSecurityConfig.class, JacksonConfig.class})` + `@MockitoBean`으로 BoardPostController 의존 서비스/`JwtUtil`/`CustomUserDetailsService` 주입)

- [ ] **Step 1: 실패 테스트 작성 — 제목 누락 시 400**

```java
    @Test
    @DisplayName("POST /api/boards/{blbMngNo}/posts - 제목(nacNm) 누락 → 400")
    @WithMockUser(username = "10001", roles = "ADMIN")
    void createPost_제목누락_400() throws Exception {
        var body = new BoardPostDto.CreateRequest();
        body.setNacNm(null); // @NotBlank 위반
        mockMvc.perform(post("/api/boards/BLB-1/posts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }
```
(실제 경로 prefix는 `BoardPostController`의 `@RequestMapping` 확인 후 맞춤. CLAUDE.md §5.13 기준 `/api/boards/{blbMngNo}/posts`.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.board.controller.BoardPostControllerTest.createPost_제목누락_400"`
Expected: FAIL

- [ ] **Step 3: BoardPostDto 제목 필드 제약 추가**

import 추가 (L5 `import lombok.*;` 아래):
```java
import jakarta.validation.constraints.NotBlank;
```

`CreateRequest.nacNm` (L101):
```java
        @NotBlank
        @Schema(description = "제목 (최대 300자)", requiredMode = Schema.RequiredMode.REQUIRED) private String    nacNm;
```
`UpdateRequest.nacNm` (L118):
```java
        @NotBlank
        @Schema(description = "제목")          private String    nacNm;
```
`ReplyCreateRequest.nacNm` (L144):
```java
        @NotBlank
        @Schema(description = "제목", requiredMode = Schema.RequiredMode.REQUIRED) private String    nacNm;
```
(본문 `nacCone`·기간·부서코드는 선택이므로 제약 미추가.)

- [ ] **Step 4: BoardPostController mutating @RequestBody에 @Valid 추가**

import 추가:
```java
import jakarta.validation.Valid;
```
3곳 (L73 create, L94 update, L131 createReply). 대표:
```java
    @PostMapping
    @Operation(summary = "게시물 등록")
    public ResponseEntity<String> create(
            @PathVariable("blbMngNo") String blbMngNo,
            @Valid @RequestBody BoardPostDto.CreateRequest request,
            @AuthenticationPrincipal CustomUserDetails user) {
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.board.controller.BoardPostControllerTest"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/board/controller/BoardPostController.java it_backend/src/main/java/com/kdb/it/common/board/dto/BoardPostDto.java it_backend/src/test/java/com/kdb/it/common/board/controller/BoardPostControllerTest.java
git commit -m "feat: BoardPostController @Valid + 제목 제약 추가 (TASK W2)"
```

---

# PR-2 — 백엔드 정리

> 모두 동작 불변(주석/로그/스키마/진단). 빌드 그린 + 대조 확인으로 검증.

## Task 5: ApplicationContextHolder 미사용 publishEvent() + 구 주석 제거

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ApplicationContextHolder.java:38-53`

> 근거: `publishEvent()`는 코드베이스 어디서도 호출되지 않는 데드 코드이며, JavaDoc(L43)이 설명하는 `@TransactionalEventListener(BEFORE_COMMIT)` 방식은 현재 구현(직접 `AuditLogPersister.persist()`, CLAUDE.md §5.12.1)과 불일치.

- [ ] **Step 1: 미사용 호출 재확인 (안전 가드)**

Run: `cd it_backend && git grep -n "publishEvent" -- 'src/*.java'`
Expected: `ApplicationContextHolder.java`의 정의부만 출력(호출처 0건). 호출처가 나오면 이 Task 중단하고 재평가.

- [ ] **Step 2: publishEvent() 메서드 + 그 JavaDoc 삭제**

L38-53 블록 전체 삭제:
```java
    /**
     * Spring ApplicationEvent 발행.
     *
     * <p>JPA EntityListener에서 직접 persist()를 호출하면 Hibernate ActionQueue
     * 이터레이션 도중 ConcurrentModificationException이 발생한다.
     * 이 메서드를 통해 이벤트를 발행하고, {@code @TransactionalEventListener(BEFORE_COMMIT)}이
     * flush 완료 후 안전한 시점에 로그 INSERT를 처리한다.</p>
     *
     * @param event 발행할 이벤트 객체
     */
    public static void publishEvent(Object event) {
        if (context == null) {
            throw new IllegalStateException("ApplicationContext가 초기화되지 않았습니다.");
        }
        context.publishEvent(event);
    }
```
삭제 후 클래스는 `getBean()`(L31-36)까지만 남고 닫힌다. (`getBean`은 `AuditLogPersister` 등 조회에 실제 사용되므로 유지.)

- [ ] **Step 3: 컴파일 + 전체 테스트 확인**

Run: `cd it_backend && ./gradlew test`
Expected: PASS (미사용 메서드 제거이므로 영향 없음)

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/log/listener/ApplicationContextHolder.java
git commit -m "refactor: ApplicationContextHolder 미사용 publishEvent + 구 주석 제거 (TASK Low)"
```

## Task 6: CodeNameMapBuilder를 common.util 패키지로 이동

**Files:**
- Move: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/util/CodeNameMapBuilder.java` → `it_backend/src/main/java/com/kdb/it/common/util/CodeNameMapBuilder.java`
- Move: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/util/CodeNameMapBuilderTest.java` → `it_backend/src/test/java/com/kdb/it/common/util/CodeNameMapBuilderTest.java`
- Modify (import 갱신): `ProjectService.java:23`, `CostService.java:32`, `CostServiceTest.java:76`, `ProjectServiceTest.java:102`

> 이 Task는 **별도 커밋**으로 분리(설계 §4 파급 주의). 패키지 이동만 단독 처리.

- [ ] **Step 1: 파일 이동 + package 선언 변경**

`CodeNameMapBuilder.java`를 `common/util`로 이동하고 L1을 변경:
```java
package com.kdb.it.common.util;
```
(나머지 본문 동일.) 테스트 파일 `CodeNameMapBuilderTest.java`도 동일 위치로 이동하고 package 선언을 `com.kdb.it.common.util`로 변경.

- [ ] **Step 2: production import 갱신 (2곳)**

`ProjectService.java:23`:
```java
import com.kdb.it.common.util.CodeNameMapBuilder;
```
`CostService.java:32`:
```java
import com.kdb.it.common.util.CodeNameMapBuilder;
```

- [ ] **Step 3: test FQN 갱신 (2곳)**

`CostServiceTest.java:76`:
```java
    @Mock private com.kdb.it.common.util.CodeNameMapBuilder codeNameMapBuilder;
```
`ProjectServiceTest.java:102`:
```java
    private com.kdb.it.common.util.CodeNameMapBuilder codeNameMapBuilder;
```

- [ ] **Step 4: 컴파일 + 전체 테스트 확인**

Run: `cd it_backend && ./gradlew test`
Expected: PASS. 컴파일 에러가 나면 `git grep -n "budget.cost.util.CodeNameMapBuilder"`로 누락된 참조 확인 후 갱신.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: CodeNameMapBuilder를 common.util로 이동 (TASK Low)"
```

## Task 7: SsoController eno 평문 INFO 로그 → DEBUG 강등

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/sso/SsoController.java:321,373`

> 근거: 성공 경로 routine INFO 로그가 사번(PII)을 운영 로그에 남김. 알림/게시판 PII 강등(2026-06-27)과 동일 정책. ERROR/WARN(L376/L384)은 장애 진단용이므로 유지.

- [ ] **Step 1: L373 INFO → DEBUG**

현재:
```java
            log.info("SSO 인증 완료 - eno: {}, 토큰 쿠키 발급, 복귀 대상: {}", verifiedEno, target);
```
변경:
```java
            log.debug("SSO 인증 완료 - eno: {}, 토큰 쿠키 발급, 복귀 대상: {}", verifiedEno, target);
```

- [ ] **Step 2: L321 INFO → DEBUG (검증 사번 세션 설정 컨텍스트 로그)**

현재:
```java
        log.info("SSO {} - resultCode: {}, ssoVerifiedEno 설정: {}, complete로 이동 (next: {}, origin: {})",
                stage, resultCode, verified, next, origin);
```
변경:
```java
        log.debug("SSO {} - resultCode: {}, ssoVerifiedEno 설정: {}, complete로 이동 (next: {}, origin: {})",
                stage, resultCode, verified, next, origin);
```

- [ ] **Step 3: 컴파일 + 관련 테스트 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.sso.*"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/sso/SsoController.java
git commit -m "refactor: SsoController eno 평문 INFO 로그 DEBUG 강등 (TASK W2 PII)"
```

## Task 8: BtermmL.IND_RSN @Column length 600 → 200 (DDL 정합)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BtermmL.java:64`

> 근거: 엔티티 `length=600`이나 DDL `TPRMPP_BTERML.IND_RSN`은 `VARCHAR2(200 CHAR)`. 짝 마스터/인접 BCOST 계열도 200. BcostmL은 2026-06-22 이미 200으로 정정됨. `ddl-auto=update`는 길이 축소를 반영하지 않으므로(CLAUDE.md §5.2.1) **엔티티를 DDL(200)에 맞추는 방향**.

- [ ] **Step 1: DDL 실제 길이 재확인 (대조)**

Run: `cd it_database && git grep -n "IND_RSN" ITPOWN_DDL_live.sql`
Expected: `TPRMPP_BTERML`의 `IND_RSN`이 `VARCHAR2(200 CHAR)`임을 확인(약 L1222). BcostmL 선례도 `git grep -n "IND_RSN" ../it_backend/src/main/java/com/kdb/it/domain/log/entity/BcostmL.java` → `length = 200` 확인.

- [ ] **Step 2: length 200으로 정정**

현재 (L64):
```java
    @Column(name = "IND_RSN", length = 600, comment = "증감사유")
```
변경:
```java
    @Column(name = "IND_RSN", length = 200, comment = "증감사유")
```

- [ ] **Step 3: 컴파일 + 전체 테스트 확인**

Run: `cd it_backend && ./gradlew test`
Expected: PASS (엔티티 메타 변경, DDL과 정합되어 ddl-auto 무영향)

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/log/entity/BtermmL.java
git commit -m "fix: BtermmL.IND_RSN @Column length 200으로 DDL 정합 (TASK Low)"
```

## Task 9: HostAddressProvider 실패 진단 로그 보강

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/eai/service/HostAddressProvider.java:35,58`

> 근거: 두 catch가 잡은 예외 `e`를 로그에 넘기지 않아 IP/MAC 조회 실패 원인을 추적 불가. SLF4J(`@Slf4j`)이므로 마지막 인자로 throwable 전달 시 스택트레이스 기록.

- [ ] **Step 1: ipAddress() catch 로그에 예외 전달 (L35)**

현재:
```java
            } catch (UnknownHostException e) {
                log.info("EAI ipAddress 조회 실패");
                return "";
            }
```
변경:
```java
            } catch (UnknownHostException e) {
                log.warn("EAI ipAddress 조회 실패 — 전문 공통부 IP 공백 처리", e);
                return "";
            }
```

- [ ] **Step 2: macAddress() catch 로그에 예외 전달 (L58)**

현재:
```java
            } catch (UnknownHostException | SocketException e) {
                log.info("EAI macAddress 조회 실패");
                return "";
            }
```
변경:
```java
            } catch (UnknownHostException | SocketException e) {
                log.warn("EAI macAddress 조회 실패 — 전문 공통부 MAC 공백 처리", e);
                return "";
            }
```

- [ ] **Step 3: 컴파일 + 관련 테스트 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.eai.*"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/service/HostAddressProvider.java
git commit -m "fix: HostAddressProvider 조회 실패 시 원인 예외 로깅 보강 (TASK W2)"
```

---

# PR-3 — 쿼리 N+1 제거

> 동작 보존 필요. 통합테스트 인프라 부재(T18)로 검증은 Mockito `verify(times(1))` 단위테스트 수준. 캐노니컬 선례: `ReviewCommentServiceTest`(findByEnoIn 1회 + findById never).

## Task 10: ScheduleService 위원 사용자명 N+1 → findByEnoIn 일괄 조회

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/ScheduleService.java:376-387`
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/ScheduleServiceTest.java` (기존, `@ExtendWith(MockitoExtension.class)` + `@Mock UserRepository` + `@InjectMocks`)

> `UserRepository.findByEnoIn(Collection<String>)`는 이미 존재(L74). 신규 메서드 불필요.

- [ ] **Step 1: 실패 테스트 작성 — findByEnoIn 1회, findByEno never**

`ScheduleServiceTest`에 추가. `buildUserMap`은 private이므로 이를 호출하는 public 메서드(위원 목록을 사용자명과 함께 반환하는 메서드, 예: 일정 현황 조회)를 통해 검증. 해당 public 메서드명/시그니처는 기존 테스트에서 확인 후 사용. 핵심 단언:
```java
    @Test
    @DisplayName("위원 사용자명 조회는 findByEnoIn 1회 배치 — findByEno 미호출")
    void 위원사용자명_findByEnoIn_1회() {
        // given: 위원 2명(E001, E002)을 포함하는 조회 시나리오 구성 (기존 테스트의 stub 패턴 재사용)
        given(userRepository.findByEnoIn(anyCollection()))
                .willReturn(List.of(
                        CuserI.builder().eno("E001").usrNm("홍길동").build(),
                        CuserI.builder().eno("E002").usrNm("김철수").build()));

        // when: 위원 사용자명을 사용하는 public 메서드 호출
        // (예: scheduleService.getScheduleStatus(ASCT_ID) — 실제 메서드명으로 대체)

        // then
        then(userRepository).should(times(1)).findByEnoIn(anyCollection());
        then(userRepository).should(never()).findByEno(anyString());
    }
```
(`import static org.mockito.ArgumentMatchers.anyCollection;` 등 필요 import 추가.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.ScheduleServiceTest.위원사용자명_findByEnoIn_1회"`
Expected: FAIL (현재 findByEno 반복 호출)

- [ ] **Step 3: buildUserMap을 일괄 조회로 변경**

현재 (L381-387):
```java
        private Map<String, CuserI> buildUserMap(List<Bcmmtm> members) {
                return members.stream()
                                .map(m -> userRepository.findByEno(m.getEno()))
                                .filter(value -> value.isPresent())
                                .map(value -> value.get())
                                .collect(Collectors.toMap(value -> value.getEno(), u -> u, (a, b) -> a));
        }
```
변경 (주석 L376-379도 "후속 과제" 문구 제거):
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

- [ ] **Step 4: 테스트 통과 + 클래스 전체 테스트 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.ScheduleServiceTest"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/council/service/ScheduleService.java it_backend/src/test/java/com/kdb/it/domain/council/service/ScheduleServiceTest.java
git commit -m "perf: ScheduleService 위원 사용자명 N+1 → findByEnoIn 일괄 조회 (TASK W2)"
```

## Task 11: CouncilService.deriveCurrentYearBudget N+1 → 배치 prefetch

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java:120,410-434,509,552`
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java` (기존)

> 근거: 목록 각 행마다 `deriveCurrentYearBudget(abusMngNo)` → `projectItemRepository.findByAbusMngNoAndDelYn` 호출(목록 크기만큼 품목 조회). 목록 전체 사번을 모아 한 번에 품목을 가져와 메모리에서 그룹핑.

- [ ] **Step 1: ProjectItemRepository 일괄 조회 메서드 확인/추가**

`ProjectItemRepository`에 `findByAbusMngNoInAndDelYn(Collection<String> abusMngNos, String delYn)`가 있는지 확인:
```bash
cd it_backend && git grep -n "findByAbusMngNoInAndDelYn\|findByAbusMngNoAndDelYn" -- 'src/main/*ProjectItemRepository.java'
```
없으면 인터페이스에 파생 쿼리 추가(기존 `findByAbusMngNoAndDelYn` 옆):
```java
    /** 사업관리번호 목록으로 품목 일괄 조회 — 협의회 목록 당해예산 파생 N+1 제거용 */
    List<Bitemm> findByAbusMngNoInAndDelYn(Collection<String> abusMngNos, String delYn);
```
(반환 엔티티 타입은 기존 `findByAbusMngNoAndDelYn`의 타입과 동일하게 맞춤 — 확인 후 사용.)

- [ ] **Step 2: 실패 테스트 작성 — 목록 조회 시 품목 일괄 1회**

`CouncilServiceTest`에 추가. 협의회 2건 목록 시나리오에서 품목 조회가 1회로 배치되는지:
```java
    @Test
    @DisplayName("협의회 목록 당해예산 파생은 품목을 1회 배치 조회 (행별 N+1 없음)")
    void 목록_당해예산_품목_배치조회() {
        // given: 협의회 목록 2건(서로 다른 abusMngNo) stub (기존 getCouncilList 테스트 패턴 재사용)
        // ... rows stub ...
        given(projectItemRepository.findByAbusMngNoInAndDelYn(anyCollection(), eq("N")))
                .willReturn(List.of(/* 품목 stub */));

        // when: 목록 조회
        // councilService.getCouncilList(...);

        // then: 품목은 1회만 조회, 행별 단건 조회는 없음
        then(projectItemRepository).should(times(1)).findByAbusMngNoInAndDelYn(anyCollection(), eq("N"));
        then(projectItemRepository).should(never()).findByAbusMngNoAndDelYn(anyString(), anyString());
    }
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.CouncilServiceTest.목록_당해예산_품목_배치조회"`
Expected: FAIL

- [ ] **Step 4: 목록 변환에 배치 prefetch 적용**

`getCouncilList`(L120)에서 행 목록을 먼저 수집해 모든 `abusMngNo`로 품목을 한 번에 조회하고, `Map<String, BigDecimal>`(abusMngNo → 당해예산)을 만들어 각 행 변환에 주입. `deriveCurrentYearBudget(String)`는 단건 호출 대신 prefetch된 맵을 받는 헬퍼로 대체:
```java
    /**
     * 협의회 목록의 모든 사업관리번호에 대한 당해예산(파생)을 1회 배치 조회로 계산.
     *
     * @param abusMngNos 목록에 등장한 사업관리번호(중복/blank 제거)
     * @return abusMngNo → 당해예산 맵 (값 없으면 키 부재)
     */
    private Map<String, java.math.BigDecimal> deriveCurrentYearBudgets(Collection<String> abusMngNos) {
        List<String> keys = abusMngNos.stream()
                .filter(v -> v != null && !v.isBlank())
                .distinct().toList();
        if (keys.isEmpty()) {
            return Map.of();
        }
        var itemsByAbus = projectItemRepository.findByAbusMngNoInAndDelYn(keys, "N").stream()
                .collect(Collectors.groupingBy(Bitemm::getAbusMngNo));
        Map<String, java.math.BigDecimal> result = new java.util.HashMap<>();
        itemsByAbus.forEach((abusMngNo, items) -> {
            var tmp = ProjectDto.Response.builder().build();
            projectBudgetSummaryService.applyBudgetSummary(tmp, items);
            result.put(abusMngNo, tmp.getTotRqmAmt());
        });
        return result;
    }
```
`getCouncilList`에서 행 변환 전에 `var budgetMap = deriveCurrentYearBudgets(<행들의 abusMngNo 모음>);`을 만들고, `toListResponseFromRow`/`toListResponseFromEntity`가 `budgetMap.get(abusMngNo)`를 사용하도록 시그니처에 맵을 전달. 단건 상세(`toDetailResponse`, L642)는 기존 `deriveCurrentYearBudget` 단건 호출 유지(상세는 1건이므로 N+1 아님).

(`Bitemm`/`getAbusMngNo`는 Step 1에서 확인한 실제 엔티티/게터로 맞춤. 컴파일 에러 시 해당 타입으로 보정.)

- [ ] **Step 5: 테스트 통과 + 클래스 전체 테스트 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.CouncilServiceTest"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectItemRepository.java it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilServiceTest.java
git commit -m "perf: CouncilService 목록 당해예산 파생 N+1 → 품목 배치 조회 (TASK Low)"
```

## Task 12: Deliberation/Contract/Payment.get() 대상명 단일 쿼리 통합

**Files:**
- Modify: `DeliberationService.java:162-170,217-220`, `ContractService.java:161-168,210-213`, `PaymentService.java:191-200,240-243`
- Modify (custom 메서드 추가): `DeliberationRepositoryImpl.java`, `ContractRepositoryImpl.java`, `PaymentRepositoryImpl.java` + 각 `*RepositoryCustom` 인터페이스
- Test: `DeliberationServiceTest.java`, `ContractServiceTest.java`, `PaymentServiceTest.java` (기존)

> 근거: `get()`이 `loadCurrent()`(마스터 1건) + `resolveTargetName()`(BPROJM/BCOSTM 별도 SELECT)로 단건당 2쿼리. 엔티티 + 대상명을 단일 LEFT JOIN 쿼리로 가져와 1쿼리화. 기준 패턴: `DeliberationRepositoryImpl.search()`의 BPROJM/BCOSTM 이중 LEFT JOIN(`p.abusMngNo.eq(cncdRfrNo)` / `c.costBgNo.eq(cncdRfrNo)`).
>
> **구현 방식:** 엔티티 전체 컬럼을 다시 나열하지 않도록 `Tuple = select(엔티티, 대상명표현식)`로 조회 → 서비스가 엔티티+대상명을 함께 받음. 기존 `get()`의 DTO 생성 코드는 그대로 두고 데이터 소스만 1쿼리로 교체.

- [ ] **Step 1: Deliberation — RepositoryCustom에 단일 쿼리 메서드 추가**

`DeliberationRepositoryCustom` 인터페이스에 추가:
```java
    /** 상세 조회용: 마스터 엔티티 + 대상명(BPROJM/BCOSTM 분기)을 단일 쿼리로 조회 */
    java.util.Optional<DeliberationTargetRow> findCurrentWithTargetName(String docNo);
```
새 record (같은 패키지 또는 dto에 추가):
```java
public record DeliberationTargetRow(Bdelim entity, String targetName) {}
```

- [ ] **Step 2: DeliberationRepositoryImpl 구현 (search()의 조인 패턴 재사용)**

```java
    @Override
    public Optional<DeliberationTargetRow> findCurrentWithTargetName(String docNo) {
        QBdelim d = QBdelim.bdelim;
        QBprojm p = QBprojm.bprojm;
        QBcostm c = QBcostm.bcostm;

        Tuple row = queryFactory
                .select(d,
                        new CaseBuilder()
                                .when(d.bgPrnTc.eq("100")).then(p.abusNm)
                                .when(d.bgPrnTc.eq("200")).then(c.cttNm)
                                .otherwise(Expressions.nullExpression(String.class)))
                .from(d)
                .leftJoin(p).on(p.abusMngNo.eq(d.cncdRfrNo).and(p.lstYn.eq("Y")).and(p.delYn.eq("N")))
                .leftJoin(c).on(c.costBgNo.eq(d.cncdRfrNo).and(c.lstYn.eq("Y")).and(c.delYn.eq("N")))
                .where(d.docMngNo.eq(docNo).and(d.lstYn.eq("Y")).and(d.delYn.eq("N")))
                .fetchOne();

        if (row == null) {
            return Optional.empty();
        }
        return Optional.of(new DeliberationTargetRow(row.get(0, Bdelim.class), row.get(1, String.class)));
    }
```
(import: `com.querydsl.core.Tuple`, `com.querydsl.core.types.dsl.CaseBuilder`, `com.querydsl.core.types.dsl.Expressions`. `c.cttNm`은 `Bcostm`의 계약/사업명 필드 — 컴파일 에러 시 QBcostm 실제 필드명으로 보정.)

- [ ] **Step 3: DeliberationService.get()를 단일 쿼리로 교체**

현재 (L162-170):
```java
    public DeliberationDto.Detail get(String docNo) {
        Bdelim e = loadCurrent(docNo);
        String tgtNm = resolveTargetName(e.getBgPrnTc(), e.getCncdRfrNo());
        return new DeliberationDto.Detail(
                e.getDocMngNo(), e.getDocVrsSno(), e.getBgPrnTc(), e.getCncdRfrNo(), tgtNm,
                ...);
    }
```
변경:
```java
    public DeliberationDto.Detail get(String docNo) {
        var row = deliberationRepository.findCurrentWithTargetName(docNo)
                .orElseThrow(() -> new IllegalArgumentException("과업심의 문서를 찾을 수 없습니다: " + docNo));
        Bdelim e = row.entity();
        String tgtNm = row.targetName();
        return new DeliberationDto.Detail(
                e.getDocMngNo(), e.getDocVrsSno(), e.getBgPrnTc(), e.getCncdRfrNo(), tgtNm,
                e.getStsTc(), e.getReqCone(), e.getTaskDbrTc(), e.getTaskDbrRltTc(), e.getTaskDbrDt(),
                e.getTaskDbrTod(), e.getTaskDbrOmtYn(), e.getTaskDbrOmtRsn(), e.getOpnnCone(), e.getApvTrdnRsnCone(),
                e.getFstEnrUsid(), e.getFstEnrDtm());
    }
```
`loadCurrent`/`resolveTargetName`이 `get()` 외에 다른 호출처가 있으면 유지, `get()` 전용이면 제거:
```bash
cd it_backend && git grep -n "loadCurrent\|resolveTargetName" -- 'src/main/*deliberation*'
```

- [ ] **Step 4: Deliberation 테스트 — 단일 쿼리 호출 검증**

`DeliberationServiceTest`에서 `get()` 테스트를 신규 메서드 stub으로 갱신:
```java
    @Test
    @DisplayName("get은 findCurrentWithTargetName 1회로 엔티티+대상명을 함께 조회")
    void get_단일쿼리() {
        var e = /* Bdelim stub (bgPrnTc=100, cncdRfrNo=ABUS-1 등) */;
        given(deliberationRepository.findCurrentWithTargetName("DLB-1"))
                .willReturn(Optional.of(new DeliberationTargetRow(e, "사업A")));

        var detail = deliberationService.get("DLB-1");

        assertThat(detail.tgtNm()).isEqualTo("사업A");
        then(deliberationRepository).should(times(1)).findCurrentWithTargetName("DLB-1");
        then(projectRepository).should(never()).findByAbusMngNoAndLstYnAndDelYn(anyString(), anyString(), anyString());
        then(costRepository).should(never()).findByCostBgNoAndLstYnAndDelYn(anyString(), anyString(), anyString());
    }
```
Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.deliberation.service.DeliberationServiceTest"`
Expected: 먼저 FAIL → 구현 후 PASS

- [ ] **Step 5: Contract 동일 적용**

`ContractRepositoryCustom`에 `findCurrentWithTargetName` + `ContractTargetRow(Bcontm entity, String targetName)` 추가, `ContractRepositoryImpl`에 Step 2와 동일 구조(QBcontm `ct`, 조인 키 `ct.cncdRfrNo`)로 구현. `ContractService.get()`(L161-168)을 Step 3 방식으로 교체하되 DTO 생성부는 기존 필드 순서 유지:
```java
        return new ContractDto.Detail(
                e.getDocMngNo(), e.getDocVrsSno(), e.getBgPrnTc(), e.getCncdRfrNo(), tgtNm,
                e.getStsTc(), e.getReqCone(), e.getCttManrC(), e.getCttManrRsn(), e.getCttNm(),
                e.getCttAmt(), e.getCttOppNm(), e.getCttDt(), e.getFstEnrUsid(), e.getFstEnrDtm());
```
`ContractServiceTest.get()` 테스트를 Step 4와 동일 패턴으로 갱신.
Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.contract.service.ContractServiceTest"`
Expected: PASS

- [ ] **Step 6: Payment 동일 적용 (lines 쿼리는 유지)**

`PaymentRepositoryCustom`에 `findCurrentWithTargetName` + `PaymentTargetRow(Bpaymm entity, String targetName)` 추가·구현. `PaymentService.get()`(L191-200)에서 `loadCurrent`+`resolveTargetName`만 단일 쿼리로 교체하고 **회차별 명세 `lineRepository.findByDocMngNoAndDocVrsSnoAndDelYn`(L193)는 그대로 유지**(별개 1:N 데이터):
```java
    public PaymentDto.Detail get(String docNo) {
        var row = paymentRepository.findCurrentWithTargetName(docNo)
                .orElseThrow(() -> new IllegalArgumentException("대금지급 문서를 찾을 수 없습니다: " + docNo));
        Bpaymm e = row.entity();
        List<PaymentDto.Line> lines = lineRepository.findByDocMngNoAndDocVrsSnoAndDelYn(docNo, e.getDocVrsSno(), "N")
                .stream().map(l -> new PaymentDto.Line(l.getDfrTod(), l.getDfrAmt(), l.getDfrDt(), l.getDfrMplDt(), l.getOpnnCone()))
                .toList();
        String tgtNm = row.targetName();
        return new PaymentDto.Detail(
                e.getDocMngNo(), e.getDocVrsSno(), e.getBgPrnTc(), e.getCncdRfrNo(), tgtNm,
                e.getStsTc(), e.getReqCone(), e.getCttNm(), e.getCttAmt(), e.getFstEnrUsid(), e.getFstEnrDtm(), lines);
    }
```
`PaymentServiceTest.get()` 테스트를 Step 4 패턴으로 갱신(단, lines 조회는 1회 유지 검증).
Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.payment.service.PaymentServiceTest"`
Expected: PASS

- [ ] **Step 7: 3개 도메인 전체 테스트 + 커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.deliberation.*" --tests "com.kdb.it.domain.contract.*" --tests "com.kdb.it.domain.payment.*"`
Expected: PASS
```bash
git add it_backend/src/main/java/com/kdb/it/domain/deliberation it_backend/src/main/java/com/kdb/it/domain/contract it_backend/src/main/java/com/kdb/it/domain/payment it_backend/src/test/java/com/kdb/it/domain/deliberation it_backend/src/test/java/com/kdb/it/domain/contract it_backend/src/test/java/com/kdb/it/domain/payment
git commit -m "perf: 집행 4단계 get() 대상명 단일 쿼리 통합 (2쿼리→1쿼리, TASK W2)"
```

## Task 13: CinfmmRepositoryImpl 벌크 UPDATE 감사컬럼 명시 SET

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImpl.java:72-86`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImplTest.java` (있으면 갱신, 없으면 신규 — `@ExtendWith(MockitoExtension.class)`로 `JPAQueryFactory`/update chain mock은 과도하므로, 본 Task는 코드 정합 + 빌드 검증 중심)

> 근거: QueryDSL 벌크 UPDATE가 `INQ_YN`/`INQ_DTM`만 SET하고 감사컬럼 `LST_CHG_DTM`/`LST_CHG_USID`는 미세팅(JPA Auditing 우회). "전체 읽음" 행위자는 수신자 본인(`rmsEno`)이므로 변경자=rmsEno로 명시.

- [ ] **Step 1: 감사컬럼 명시 SET 추가**

현재 (L74-86):
```java
    @Override
    public long markAllReadByRmsEno(String rmsEno) {
        return query
            .update(c)
            .set(c.inqYn, "Y")
            .set(c.inqDtm, LocalDateTime.now())
            .where(
                c.rmsEno.eq(rmsEno),
                c.delYn.eq("N"),
                c.inqYn.eq("N")
            )
            .execute();
    }
```
변경:
```java
    @Override
    public long markAllReadByRmsEno(String rmsEno) {
        LocalDateTime now = LocalDateTime.now();
        return query
            .update(c)
            .set(c.inqYn, "Y")
            .set(c.inqDtm, now)
            // JPA Auditing 우회(벌크 UPDATE)이므로 감사컬럼을 명시 SET — 변경자=수신자 본인
            .set(c.lstChgDtm, now)
            .set(c.lstChgUsid, rmsEno)
            .where(
                c.rmsEno.eq(rmsEno),
                c.delYn.eq("N"),
                c.inqYn.eq("N")
            )
            .execute();
    }
```
(`c.lstChgDtm`/`c.lstChgUsid`는 `Cinfmm`이 `BaseEntity` 상속 시 QCinfmm에 존재. 필드명이 다르면 QCinfmm에서 확인 후 보정. 주석 L72-73의 "clear 불필요" 설명은 유지 — clear 정책은 변경 안 함.)

- [ ] **Step 2: 컴파일 + 관련 테스트 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.notification.*"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImpl.java
git commit -m "fix: CinfmmRepositoryImpl 벌크 UPDATE 감사컬럼 명시 SET (TASK W2)"
```

---

# PR-4 — 프론트 에러 피드백

> 동작 불변(에러 노출 개선). 기준 패턴: `prepare/[id].vue`의 `catch (e: unknown)` + `err?.data?.message ?? err?.message ?? 폴백`.

## Task 14: council-request/result/[id].vue catch 바인딩 통일

**Files:**
- Modify: `it_frontend/app/pages/info/council-request/result/[id].vue:256-295,306-327,337-354`

> 3개 핸들러 모두 `catch {`(바인딩 없음)이라 백엔드 메시지(`e.data?.message`) 미노출. `handleNotify`는 성공 시 `result`가 null이면 무피드백(L341 TODO). `prepare/[id].vue`의 `handleStart`/`handleComplete` 패턴으로 통일.

- [ ] **Step 1: handleRequestApproval catch 바인딩 (L283-289)**

현재:
```js
            } catch {
                toast.add({
                    severity: 'error',
                    summary: '오류',
                    detail: '결재 요청 중 오류가 발생했습니다.',
                    life: 3000,
                });
            } finally {
```
변경:
```js
            } catch (e: unknown) {
                const err = e as { data?: { message?: string }; message?: string };
                toast.add({
                    severity: 'error',
                    summary: '오류',
                    detail: err?.data?.message ?? err?.message ?? '결재 요청 중 오류가 발생했습니다.',
                    life: 3000,
                });
            } finally {
```

- [ ] **Step 2: handleStartResultWriting catch 바인딩 (L317-323)**

현재:
```js
    } catch {
        toast.add({
            severity: 'error',
            summary: '오류',
            detail: '전환 중 오류가 발생했습니다. 평가의견 미제출 위원이 있는지 확인해 주세요.',
            life: 4000,
        });
    } finally {
```
변경:
```js
    } catch (e: unknown) {
        const err = e as { data?: { message?: string }; message?: string };
        toast.add({
            severity: 'error',
            summary: '오류',
            detail: err?.data?.message ?? err?.message ?? '전환 중 오류가 발생했습니다. 평가의견 미제출 위원이 있는지 확인해 주세요.',
            life: 4000,
        });
    } finally {
```

- [ ] **Step 3: handleNotify — 성공 시 null 피드백 + catch 바인딩 (L337-354)**

현재:
```js
const handleNotify = async () => {
    notifying.value = true;
    try {
        const result = await notifyCouncil(asctId);
        // TODO: 성공 경로에서 notifyResult가 null/undefined인 경우 처리 없음 — if (!result) toast.add({ severity: 'warn', ... }) 추가 권장
        notifyResult.value = result;
        await refreshCouncil();
    } catch {
        toast.add({
            severity: 'error',
            summary: '오류',
            detail: '통보 처리 중 오류가 발생했습니다.',
            life: 3000,
        });
    } finally {
        notifying.value = false;
    }
};
```
변경:
```js
const handleNotify = async () => {
    notifying.value = true;
    try {
        const result = await notifyCouncil(asctId);
        notifyResult.value = result;
        if (!result) {
            toast.add({
                severity: 'warn',
                summary: '통보 결과 없음',
                detail: '통보는 처리되었으나 수신자 정보가 확인되지 않았습니다.',
                life: 3000,
            });
        }
        await refreshCouncil();
    } catch (e: unknown) {
        const err = e as { data?: { message?: string }; message?: string };
        toast.add({
            severity: 'error',
            summary: '오류',
            detail: err?.data?.message ?? err?.message ?? '통보 처리 중 오류가 발생했습니다.',
            life: 3000,
        });
    } finally {
        notifying.value = false;
    }
};
```

- [ ] **Step 4: 타입체크 + 린트**

Run: `cd it_frontend && npm run typecheck && npm run lint`
Expected: PASS (에러 없음)

- [ ] **Step 5: Commit**

```bash
git add it_frontend/app/pages/info/council-request/result/[id].vue
git commit -m "fix: council-request/result catch 바인딩 통일 + 통보 null 피드백 (TASK Low)"
```

---

# 마무리

## TASK.md 갱신

- [ ] **각 PR 머지 후 TASK.md에서 해당 항목 처리 표시**

PR-1~4가 모두 머지되면 `TASK.md`에서 다음 13개 항목을 `TASK_DONE.md`로 이관(또는 ✅ 표시):
- 보안 §: SSO eno 로그 강등(Task 7), changeStatus role 분기는 **카브아웃 유지(W3)**
- 에러 처리 §: @Valid(Task 3·4), Plan/LoginAttempt @Transactional(Task 1·2), council-request catch(Task 14)
- DB/JPA §: ScheduleService N+1(Task 10), CouncilService deriveCurrentYearBudget(Task 11), Deliberation/Contract/Payment.get(Task 12), CinfmmRepositoryImpl 감사컬럼(Task 13), BtermmL length(Task 8)
- 백엔드 리팩토링 §: ApplicationContextHolder 주석(Task 5), CodeNameMapBuilder 이동(Task 6), HostAddressProvider 진단(Task 9). 환율 규칙 통일은 **카브아웃 유지(W3)**

카브아웃 2건(changeStatus role 분기·환율 규칙 통일)은 "결정 대기"로 W3 재라벨.

## 최종 검증

- [ ] **백엔드 전체 테스트**: `cd it_backend && ./gradlew clean test` → PASS
- [ ] **프론트 전체 검증**: `cd it_frontend && npm run typecheck && npm run lint && npm test` → PASS
