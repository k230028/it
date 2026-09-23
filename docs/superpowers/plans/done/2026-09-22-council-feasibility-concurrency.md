# COUNCIL-012 타당성검토표 동시 편집 충돌 감지(경량) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Step1 타당성검토표 저장에 조회 시점 스탬프(`concurrencyStamp`)를 붙여 다른 사용자의 저장을 조용히 덮어쓰지 않게 하고, 충돌 시 [다시 불러오기]/[내 입력으로 덮어쓰기]로 해소한다.

**Architecture:** 백엔드는 `CouncilFeasibilityStamper`(BPOVWM+BCHKLM+BPERFM SHA-256)와 `CouncilFeasibilityConcurrencyGuard`(잠금 뒤 비교, `CouncilConflictException` 400/409)를 두고, `GET`은 스탬프를 싣고 `POST/PUT`은 `FeasibilitySaveResponse { concurrencyStamp }`를 돌려준다. 프론트는 `useCouncilRequestPage`가 스탬프를 보관·전송하고 409 `COUNCIL_SOURCE_CHANGED`를 `conflict` 상태로 받아 페이지 다이얼로그가 해소한다.

**Tech Stack:** Spring Boot 3 (JPA, `ItBudgetCanonicalJson`), JUnit 5 + Mockito, Nuxt 4 + Vue 3, PrimeVue `Dialog`, Vitest, openapi-typescript codegen.

**Spec:** `docs/superpowers/specs/done/2026-09-22-council-feasibility-concurrency-design.md`

## Global Constraints

- 수정 범위: `it_backend/src/{main,test}/java/com/kdb/it/domain/council/**`, `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java`(핸들러 1개 추가만 — 사용자 승인 2026-09-22), `it_frontend/app/composables/council/useCouncilCommitteeApi.ts`(`saveFeasibility` 반환형), `app/composables/useCouncilRequestPage.ts`, `app/pages/info/council-request/[id].vue`, `i18n/messages/council.ts`, `app/types/council.ts`(타입 별칭 1개), `app/types/api.d.ts`(codegen 산출), 해당 테스트. 그 밖은 사용자 확인 없이 수정하지 않는다.
- 스탬프 입력·제외 필드는 스펙 2절 그대로: BPOVWM 업무 필드 11개 + BCHKLM(항목코드 정렬) + BPERFM(순번 정렬). `KPN_TP_TC`·감사 필드·`DEL_YN` 제외.
- 저장 계약(스펙 3절): 사업개요 없음 → 검사 없음 / 형식 오류 400 `COUNCIL_STAMP_INVALID` / 누락·불일치 409 `COUNCIL_SOURCE_CHANGED`(+`current`) / 잠금 초과는 기존 409 유지.
- 오류 응답 스키마 이름 `CouncilConflictResponse`, 저장 응답 `FeasibilitySaveResponse`.
- 파일 상한 800줄(`MaxLinesRatchetTest`·프론트 `max-lines-ratchet`): `FeasibilityService.java`(372)·`useCouncilRequestPage.ts`(782)·`[id].vue`(~560)에 여유가 적으므로 새 로직은 새 파일에 둔다. 프론트 사용자 노출 문구는 i18n 키로만.
- 커밋: 경로 명시 `git add`, 메시지 끝 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. 백엔드는 커밋 전 `./gradlew spotlessApply -q`.
- `npm run codegen`은 백엔드가 `http://localhost:28080`에 떠 있어야 한다. 끝나면 백엔드와 Gradle 데몬을 내린다(노트북 부하).

---

### Task 1: 스탬퍼 `CouncilFeasibilityStamper`

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilFeasibilityStamper.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilFeasibilityStamperTest.java`

**Interfaces:**
- Consumes: `com.kdb.it.common.approval.itbudget.service.ItBudgetCanonicalJson#digest(Object)`, `#money(BigDecimal)`; 엔티티 `Bpovwm`(getter: `getItPtlAsctId`, `getAbusNm`, `getAbusTrmCone`, `getAbusNcsCone`, `getRqmBgAmt`, `getItPtlEdrtTc`, `getAbusCone`, `getLwRglYn`, `getLwFdtn`, `getDgogPpoCone`, `getFlMpnId`), `Bchklm`(`getItPtlCkgItmTc`, `getQuelRcrd`, `getCkgOpnn`), `Bperfm`(`getEvlDtpSno`, `getEvlDtpNm`, `getEvlDtpDfntCone`, `getEvlDtpClfCone`, `getEvlDtpMsmPtmCone`, `getEvlDtpMsmCleCone`).
- Produces: `public String stamp(Bpovwm overview, List<Bchklm> selfChecks, List<Bperfm> performances)` — 64자 소문자 16진수. null 목록은 빈 목록.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```java
package com.kdb.it.domain.council.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.approval.itbudget.service.ItBudgetCanonicalJson;
import com.kdb.it.domain.council.entity.Bchklm;
import com.kdb.it.domain.council.entity.Bperfm;
import com.kdb.it.domain.council.entity.Bpovwm;
import java.math.BigDecimal;
import java.util.List;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 스탬프는 업무 내용에만 반응하고 저장유형·감사 필드·행 순서에는 반응하지 않아야 한다 (COUNCIL-012). */
class CouncilFeasibilityStamperTest {

    /* ItBudgetCanonicalJsonTest와 같은 방식으로 만든다 — LocalDate 등 모듈 등록이 필요하다 */
    private final CouncilFeasibilityStamper stamper =
            new CouncilFeasibilityStamper(
                    new ItBudgetCanonicalJson(new ObjectMapper().findAndRegisterModules()));

    /* 세 엔티티 모두 @SuperBuilder라 모든 필드를 builder로 넣을 수 있다 */
    private static Bpovwm overview(String abusNm, String kpnTpTc) {
        return Bpovwm.builder()
                .itPtlAsctId("ASCT-2026-0001")
                .abusNm(abusNm)
                .abusTrmCone("2026.01~2026.12")
                .abusNcsCone("필요성")
                .rqmBgAmt(new BigDecimal("1000"))
                .itPtlEdrtTc("부장")
                .abusCone("내용")
                .lwRglYn("N")
                .dgogPpoCone("효과")
                .kpnTpTc(kpnTpTc)
                .flMpnId("FL-1")
                .build();
    }

    private static Bchklm check(String code, int score, String opinion) {
        return Bchklm.builder()
                .itPtlAsctId("ASCT-2026-0001")
                .itPtlCkgItmTc(code)
                .quelRcrd(score)
                .ckgOpnn(opinion)
                .build();
    }

    private static Bperfm perf(int sno, String name) {
        return Bperfm.builder().itPtlAsctId("ASCT-2026-0001").evlDtpSno(sno).evlDtpNm(name).build();
    }

    @Test
    @DisplayName("같은 내용이면 같은 스탬프, 64자 소문자 16진수")
    void sameContent_sameStamp() {
        String a = stamper.stamp(overview("사업", "10"), List.of(check("01", 5, "좋음")), List.of(perf(1, "지표")));
        String b = stamper.stamp(overview("사업", "10"), List.of(check("01", 5, "좋음")), List.of(perf(1, "지표")));
        assertThat(a).isEqualTo(b).matches("[a-f0-9]{64}");
    }

    @Test
    @DisplayName("저장유형(KPN_TP_TC) 변화는 스탬프를 바꾸지 않는다")
    void kpnTpTc_ignored() {
        assertThat(stamper.stamp(overview("사업", "10"), List.of(), List.of()))
                .isEqualTo(stamper.stamp(overview("사업", "20"), List.of(), List.of()));
    }

    @Test
    @DisplayName("업무 필드·자체점검·성과지표 내용이 바뀌면 스탬프가 바뀐다")
    void contentChange_changesStamp() {
        String base = stamper.stamp(overview("사업", "10"), List.of(check("01", 5, "좋음")), List.of(perf(1, "지표")));
        assertThat(stamper.stamp(overview("사업2", "10"), List.of(check("01", 5, "좋음")), List.of(perf(1, "지표")))).isNotEqualTo(base);
        assertThat(stamper.stamp(overview("사업", "10"), List.of(check("01", 4, "좋음")), List.of(perf(1, "지표")))).isNotEqualTo(base);
        assertThat(stamper.stamp(overview("사업", "10"), List.of(check("01", 5, "좋음")), List.of(perf(1, "지표"), perf(2, "추가")))).isNotEqualTo(base);
    }

    @Test
    @DisplayName("자식 행의 입력 순서는 결과에 영향을 주지 않고 null 목록은 빈 목록과 같다")
    void orderAndNull() {
        String ab = stamper.stamp(overview("사업", "10"), List.of(check("01", 5, "a"), check("02", 3, "b")), List.of(perf(1, "x"), perf(2, "y")));
        String ba = stamper.stamp(overview("사업", "10"), List.of(check("02", 3, "b"), check("01", 5, "a")), List.of(perf(2, "y"), perf(1, "x")));
        assertThat(ab).isEqualTo(ba);
        assertThat(stamper.stamp(overview("사업", "10"), null, null))
                .isEqualTo(stamper.stamp(overview("사업", "10"), List.of(), List.of()));
    }
}
```

`ItBudgetCanonicalJson.money(null)`은 null을 돌려주므로(`exact` 구현 확인) 스탬퍼에서 null 방어를 따로 하지 않는다.

- [ ] **Step 2: 실패를 확인한다**

Run (in `C:\it\it_backend`): `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilFeasibilityStamperTest' -q`
Expected: 컴파일 실패 — `CouncilFeasibilityStamper` 없음.

- [ ] **Step 3: 스탬퍼를 만든다**

```java
package com.kdb.it.domain.council.service;

import com.kdb.it.common.approval.itbudget.service.ItBudgetCanonicalJson;
import com.kdb.it.domain.council.entity.Bchklm;
import com.kdb.it.domain.council.entity.Bperfm;
import com.kdb.it.domain.council.entity.Bpovwm;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 타당성검토표(BPOVWM + BCHKLM + BPERFM)의 업무 내용을 SHA-256 스탬프로 요약합니다 (COUNCIL-012).
 *
 * <p>조회 응답과 저장 검증이 같은 입력 집합을 쓰도록 이 컴포넌트 하나만 사용합니다. 공통 감사 필드와 저장유형(KPN_TP_TC)은 입력에서
 * 제외하므로 임시저장↔작성완료 전환·수정 복귀·의미상 동일한 원복은 충돌로 판정되지 않습니다. 정보화사업의 {@code
 * ProjectConcurrencyStamper}와 같은 규약입니다.
 */
@Component
@RequiredArgsConstructor
public class CouncilFeasibilityStamper {

    private final ItBudgetCanonicalJson canonical;

    /**
     * @param overview 사업개요. null이면 안 된다(사업개요가 없으면 스탬프도 없다)
     * @param selfChecks 활성 자체점검 행. 입력 순서 무관, null은 빈 목록
     * @param performances 활성 성과지표 행. 입력 순서 무관, null은 빈 목록
     * @return 64자리 소문자 SHA-256 다이제스트
     */
    public String stamp(Bpovwm overview, List<Bchklm> selfChecks, List<Bperfm> performances) {
        return canonical.digest(
                new StampInput(parent(overview), checks(selfChecks), perfs(performances)));
    }

    private ParentView parent(Bpovwm o) {
        return new ParentView(
                o.getItPtlAsctId(),
                o.getAbusNm(),
                o.getAbusTrmCone(),
                o.getAbusNcsCone(),
                canonical.money(o.getRqmBgAmt()),
                o.getItPtlEdrtTc(),
                o.getAbusCone(),
                o.getLwRglYn(),
                o.getLwFdtn(),
                o.getDgogPpoCone(),
                o.getFlMpnId());
    }

    private static List<CheckView> checks(List<Bchklm> rows) {
        return rows == null
                ? List.of()
                : rows.stream()
                        .map(c -> new CheckView(c.getItPtlCkgItmTc(), c.getQuelRcrd(), c.getCkgOpnn()))
                        .sorted(Comparator.comparing(CheckView::code, Comparator.nullsFirst(Comparator.naturalOrder())))
                        .toList();
    }

    private static List<PerfView> perfs(List<Bperfm> rows) {
        return rows == null
                ? List.of()
                : rows.stream()
                        .map(
                                p ->
                                        new PerfView(
                                                p.getEvlDtpSno(),
                                                p.getEvlDtpNm(),
                                                p.getEvlDtpDfntCone(),
                                                p.getEvlDtpClfCone(),
                                                p.getEvlDtpMsmPtmCone(),
                                                p.getEvlDtpMsmCleCone()))
                        .sorted(Comparator.comparing(PerfView::sno, Comparator.nullsFirst(Comparator.naturalOrder())))
                        .toList();
    }

    private record StampInput(ParentView overview, List<CheckView> selfChecks, List<PerfView> performances) {}

    private record ParentView(
            String asctId,
            String abusNm,
            String abusTrmCone,
            String abusNcsCone,
            BigDecimal rqmBgAmt,
            String itPtlEdrtTc,
            String abusCone,
            String lwRglYn,
            String lwFdtn,
            String dgogPpoCone,
            String flMpnId) {}

    private record CheckView(String code, Integer score, String opinion) {}

    private record PerfView(Integer sno, String name, String definition, String formula, String measurePoint, String measureCycle) {}
}
```

`canonical.money(null)`은 null을 돌려주므로 그대로 둔다.

- [ ] **Step 4: 통과·포맷을 확인한다**

Run: `./gradlew spotlessApply -q && ./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilFeasibilityStamperTest' -q`
Expected: 4건 PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add src/main/java/com/kdb/it/domain/council/service/CouncilFeasibilityStamper.java src/test/java/com/kdb/it/domain/council/service/CouncilFeasibilityStamperTest.java
git commit -m "feat(council): 타당성검토표 동시성 스탬프 계산기 추가 (COUNCIL-012)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 예외·응답 DTO·전역 핸들러

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/council/exception/CouncilConflictException.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/council/dto/CouncilConflictResponse.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java` (`FeasibilityRequest`·`FeasibilityResponse`에 `concurrencyStamp`, 신규 `FeasibilitySaveResponse`)
- Modify: `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java` (핸들러 1개 추가 — 승인됨)
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/controller/CouncilFeasibilityConflictHandlerTest.java`

**Interfaces:**
- Produces: `CouncilConflictException(HttpStatus status, String code, String message, String changedBy, String changedByEno, LocalDateTime changedAt, String currentStamp, CouncilDto.FeasibilityResponse current)` + 접근자 `status()`, `code()`, `changedBy()`, `changedByEno()`, `changedAt()`, `currentStamp()`, `current()`; `CouncilConflictResponse` record; `CouncilDto.FeasibilitySaveResponse(String concurrencyStamp)`; `FeasibilityRequest.concurrencyStamp()`(마지막 인자), `FeasibilityResponse.concurrencyStamp()`(마지막 인자).

- [ ] **Step 1: 핸들러 슬라이스 테스트를 쓴다**

```java
package com.kdb.it.domain.council.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.willThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kdb.it.common.system.security.CustomUserDetailsService;
import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.config.TestSecurityConfig;
import com.kdb.it.domain.council.dto.CouncilDto;
import com.kdb.it.domain.council.exception.CouncilConflictException;
import com.kdb.it.domain.council.service.FeasibilityService;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** 409 충돌 응답이 CouncilConflictResponse 계약(코드·변경자·현재 스탬프·현재값)으로 나가는지 확인한다 (COUNCIL-012). */
@WebMvcTest(CouncilFeasibilityController.class)
@Import(TestSecurityConfig.class)
class CouncilFeasibilityConflictHandlerTest {

    @Autowired private MockMvc mockMvc;
    @MockitoBean private FeasibilityService feasibilityService;
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    private static final String BODY =
            "{\"prjNm\":\"사업\",\"prjTrm\":\"\",\"ncs\":\"\",\"prjBg\":null,\"edrt\":\"\",\"prjDes\":\"\",\"lglRglYn\":\"N\",\"lglRglNm\":null,\"xptEff\":\"\",\"kpnTc\":\"10\",\"performances\":[],\"flMngNo\":null,\"selfChecks\":[],\"concurrencyStamp\":\"abc\"}";

    @Test
    @DisplayName("COUNCIL_SOURCE_CHANGED는 409와 변경자·현재 스탬프·현재값을 담는다")
    void sourceChanged_409Body() throws Exception {
        CouncilDto.FeasibilityResponse current =
                new CouncilDto.FeasibilityResponse(
                        "상대 사업", "", "", null, "", "", "N", null, "", "10", java.util.List.of(), null, java.util.List.of(), "f".repeat(64));
        willThrow(
                        new CouncilConflictException(
                                HttpStatus.CONFLICT,
                                "COUNCIL_SOURCE_CHANGED",
                                "다른 사용자가 이 타당성검토표를 수정했습니다.",
                                "홍길동",
                                "K000002",
                                LocalDateTime.of(2026, 9, 22, 10, 5),
                                "f".repeat(64),
                                current))
                .given(feasibilityService)
                .saveFeasibility(eq("ASCT-2026-0001"), any());

        mockMvc.perform(put("/api/council/ASCT-2026-0001/feasibility").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("COUNCIL_SOURCE_CHANGED"))
                .andExpect(jsonPath("$.changedBy").value("홍길동"))
                .andExpect(jsonPath("$.currentStamp").value("f".repeat(64)))
                .andExpect(jsonPath("$.current.prjNm").value("상대 사업"));
    }

    @Test
    @DisplayName("COUNCIL_STAMP_INVALID는 400이고 현재값이 없다")
    void stampInvalid_400() throws Exception {
        willThrow(new CouncilConflictException(HttpStatus.BAD_REQUEST, "COUNCIL_STAMP_INVALID", "동시성 스탬프 형식이 올바르지 않습니다.", null, null, null, null, null))
                .given(feasibilityService)
                .saveFeasibility(eq("ASCT-2026-0001"), any());

        mockMvc.perform(put("/api/council/ASCT-2026-0001/feasibility").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("COUNCIL_STAMP_INVALID"))
                .andExpect(jsonPath("$.current").doesNotExist());
    }
}
```

`TestSecurityConfig`의 패키지는 `CouncilRouteContractTest`의 import를 따라 맞춘다. `saveFeasibility`의 반환형이 Task 3에서 `FeasibilitySaveResponse`로 바뀌므로 `willThrow(...).given(...)` 형태를 쓴다(void/비void 모두 동작).

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.controller.CouncilFeasibilityConflictHandlerTest' -q`
Expected: 컴파일 실패 — `CouncilConflictException` 없음, `FeasibilityResponse` 인자 14개.

- [ ] **Step 3: 예외와 응답 DTO를 만든다**

`CouncilConflictException.java`:

```java
package com.kdb.it.domain.council.exception;

import com.kdb.it.domain.council.dto.CouncilDto;
import java.time.LocalDateTime;
import org.springframework.http.HttpStatus;

/**
 * 타당성검토표 저장의 동시성 위반을 HTTP 상태와 현재 문서 상태로 전달합니다 (COUNCIL-012).
 *
 * <p>{@code COUNCIL_STAMP_INVALID}(400)는 현재 상태 없이, {@code COUNCIL_SOURCE_CHANGED}(409)는 사용자가 다시 불러오거나 덮어쓸 수
 * 있도록 현재 상태와 최신 스탬프를 함께 담습니다. 정보화사업의 {@code ProjectConflictException}과 같은 계약입니다.
 */
public final class CouncilConflictException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final String changedBy;
    private final String changedByEno;
    private final LocalDateTime changedAt;
    private final String currentStamp;
    private final transient CouncilDto.FeasibilityResponse current;

    public CouncilConflictException(
            HttpStatus status,
            String code,
            String message,
            String changedBy,
            String changedByEno,
            LocalDateTime changedAt,
            String currentStamp,
            CouncilDto.FeasibilityResponse current) {
        super(message);
        this.status = status;
        this.code = code;
        this.changedBy = changedBy;
        this.changedByEno = changedByEno;
        this.changedAt = changedAt;
        this.currentStamp = currentStamp;
        this.current = current;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public String changedBy() { return changedBy; }
    public String changedByEno() { return changedByEno; }
    public LocalDateTime changedAt() { return changedAt; }
    public String currentStamp() { return currentStamp; }
    public CouncilDto.FeasibilityResponse current() { return current; }
}
```

`CouncilConflictResponse.java`:

```java
package com.kdb.it.domain.council.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/**
 * 타당성검토표 저장 충돌 응답 (COUNCIL-012)
 *
 * <p>{@code current}는 저장 직전 잠금 상태에서 읽은 타당성검토표 응답이다. 400 응답에서는 {@code changedBy}·{@code changedAt}·{@code
 * currentStamp}·{@code current}가 모두 null이다.
 */
@Schema(name = "CouncilConflictResponse", description = "타당성검토표 저장 충돌 응답")
public record CouncilConflictResponse(
        LocalDateTime timestamp,
        int status,
        String code,
        String message,
        String changedBy,
        String changedByEno,
        LocalDateTime changedAt,
        String currentStamp,
        CouncilDto.FeasibilityResponse current) {}
```

`CouncilDto.java`: `FeasibilityRequest`의 마지막 인자 `List<SelfCheckItem> selfChecks)` 뒤에 추가:

```java
            List<SelfCheckItem> selfChecks,
            /** 조회 응답의 동시성 스탬프 (COUNCIL-012). 사업개요가 이미 있으면 필수, 최초 저장이면 무시 */
            @Schema(nullable = true) String concurrencyStamp) {}
```

`FeasibilityResponse`의 마지막 인자 `List<SelfCheckItemResponse> selfChecks)` 뒤에 추가하고, `@Schema(requiredProperties = {...})` 목록에 `"concurrencyStamp"`를 더한다:

```java
            List<SelfCheckItemResponse> selfChecks,
            /** 저장 검증용 동시성 스탬프 (COUNCIL-012). BPOVWM+BCHKLM+BPERFM 업무 내용의 SHA-256 */
            String concurrencyStamp) {}

    /** 타당성검토표 저장 응답 — 다음 저장에 쓸 최신 스탬프 (COUNCIL-012) */
    @Schema(name = "FeasibilitySaveResponse")
    public record FeasibilitySaveResponse(String concurrencyStamp) {}
```

`FeasibilityResponse`를 `new`로 만드는 곳(`FeasibilityService.toFeasibilityResponse`, 테스트)은 Task 3에서 인자를 맞춘다. 이 단계에서는 컴파일이 깨진 채로 다음 단계로 간다.

- [ ] **Step 4: 전역 핸들러에 1개를 추가한다 (승인된 범위 밖 수정)**

`GlobalExceptionHandler.java`의 `handleProjectConflict` 메서드 바로 아래:

```java
    /** 협의회 타당성검토표 저장 충돌을 코드와 현재 문서 상태로 반환한다 (COUNCIL-012). */
    @ExceptionHandler(CouncilConflictException.class)
    public ResponseEntity<CouncilConflictResponse> handleCouncilConflict(
            CouncilConflictException e) {
        log.warn("협의회 타당성검토표 저장 충돌: code={}, status={}", e.code(), e.status().value());
        CouncilConflictResponse body =
                new CouncilConflictResponse(
                        LocalDateTime.now(),
                        e.status().value(),
                        e.code(),
                        e.getMessage(),
                        e.changedBy(),
                        e.changedByEno(),
                        e.changedAt(),
                        e.currentStamp(),
                        e.current());
        return ResponseEntity.status(e.status()).body(body);
    }
```

import 두 줄: `import com.kdb.it.domain.council.dto.CouncilConflictResponse;`, `import com.kdb.it.domain.council.exception.CouncilConflictException;`. 기존 핸들러는 건드리지 않는다.

- [ ] **Step 5: `toFeasibilityResponse` 호출을 임시로 맞춘다**

`FeasibilityService.toFeasibilityResponse`의 `new CouncilDto.FeasibilityResponse(...)` 마지막 인자 `selfCheckResponses` 뒤에 `null`을 넣어 컴파일만 통과시킨다(Task 3에서 실제 스탬프로 교체). `FeasibilityServiceTest`·`CouncilAccessBoundaryTest`의 `new CouncilDto.FeasibilityRequest(` 13인자 호출은 뒤에 `null`을 하나씩 붙인다(`sed`로 일괄 처리하지 말고 각 호출을 확인한다 — 12번째 `flMngNo`, 13번째 `selfChecks` 다음).

- [ ] **Step 6: 통과·포맷을 확인한다**

Run: `./gradlew spotlessApply -q && ./gradlew test --tests 'com.kdb.it.domain.council.controller.CouncilFeasibilityConflictHandlerTest' --tests 'com.kdb.it.domain.council.controller.CouncilRouteContractTest' -q`
Expected: 2건 + 라우트 계약 PASS.

- [ ] **Step 7: 커밋한다**

```bash
git add src/main/java/com/kdb/it/domain/council/exception/CouncilConflictException.java src/main/java/com/kdb/it/domain/council/dto/CouncilConflictResponse.java src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java src/test/java/com/kdb/it/domain/council/controller/CouncilFeasibilityConflictHandlerTest.java src/test/java/com/kdb/it/domain/council/service/FeasibilityServiceTest.java src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java
git commit -m "feat(council): 타당성검토표 충돌 예외·응답 계약과 전역 핸들러 추가 (COUNCIL-012)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 가드 `CouncilFeasibilityConcurrencyGuard`와 서비스·컨트롤러 배선

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilFeasibilityConcurrencyGuard.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java` (`getFeasibility`, `saveFeasibility`, `toFeasibilityResponse`)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilFeasibilityController.java` (`POST/PUT` 반환형)
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/CouncilFeasibilityConcurrencyGuardTest.java`, `FeasibilityServiceTest.java`, `CouncilAccessBoundaryTest.java`

**Interfaces:**
- Consumes: Task 1 `CouncilFeasibilityStamper.stamp(...)`, Task 2 `CouncilConflictException`, `UserRepository.findById(String eno): Optional<CuserI>`(`CuserI.getUsrNm()`).
- Produces: `CouncilFeasibilityConcurrencyGuard.verifyStamp(String submitted, Bpovwm overview, List<Bchklm> selfChecks, List<Bperfm> performances, Supplier<CouncilDto.FeasibilityResponse> currentSupplier, UnaryOperator<String> nameResolver): void`; `FeasibilityService.saveFeasibility(...)`가 `CouncilDto.FeasibilitySaveResponse`를 반환; `getFeasibility`가 `concurrencyStamp`를 채움.

- [ ] **Step 1: 가드 테스트를 쓴다**

```java
package com.kdb.it.domain.council.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

import com.kdb.it.domain.council.dto.CouncilDto;
import com.kdb.it.domain.council.entity.Bchklm;
import com.kdb.it.domain.council.entity.Bperfm;
import com.kdb.it.domain.council.entity.Bpovwm;
import com.kdb.it.domain.council.exception.CouncilConflictException;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class CouncilFeasibilityConcurrencyGuardTest {

    private final CouncilFeasibilityStamper stamper = mock(CouncilFeasibilityStamper.class);
    private final CouncilFeasibilityConcurrencyGuard guard = new CouncilFeasibilityConcurrencyGuard(stamper);
    private final Bpovwm overview = mock(Bpovwm.class);
    private final CouncilDto.FeasibilityResponse current = mock(CouncilDto.FeasibilityResponse.class);
    private static final String STAMP = "a".repeat(64);

    private void currentStampIs(String stamp) {
        given(stamper.stamp(overview, List.of(), List.of())).willReturn(stamp);
        given(overview.getLstChgUsid()).willReturn("K000002");
        given(overview.getLstChgDtm()).willReturn(LocalDateTime.of(2026, 9, 22, 10, 5));
    }

    @Test
    @DisplayName("스탬프가 일치하면 통과한다")
    void match_passes() {
        currentStampIs(STAMP);
        assertThatCode(() -> guard.verifyStamp(STAMP, overview, List.of(), List.of(), () -> current, eno -> eno)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("형식이 깨진 스탬프는 400 COUNCIL_STAMP_INVALID")
    void malformed_400() {
        assertThatThrownBy(() -> guard.verifyStamp("not-a-stamp", overview, List.of(), List.of(), () -> current, eno -> eno))
                .isInstanceOfSatisfying(CouncilConflictException.class, e -> {
                    org.assertj.core.api.Assertions.assertThat(e.status()).isEqualTo(HttpStatus.BAD_REQUEST);
                    org.assertj.core.api.Assertions.assertThat(e.code()).isEqualTo("COUNCIL_STAMP_INVALID");
                    org.assertj.core.api.Assertions.assertThat(e.current()).isNull();
                });
    }

    @Test
    @DisplayName("누락 또는 불일치는 409 COUNCIL_SOURCE_CHANGED와 변경자·현재값을 담는다")
    void missingOrStale_409() {
        currentStampIs(STAMP);
        for (String submitted : new String[] {null, "b".repeat(64)}) {
            assertThatThrownBy(() -> guard.verifyStamp(submitted, overview, List.of(), List.of(), () -> current, eno -> "홍길동(" + eno + ")"))
                    .isInstanceOfSatisfying(CouncilConflictException.class, e -> {
                        org.assertj.core.api.Assertions.assertThat(e.status()).isEqualTo(HttpStatus.CONFLICT);
                        org.assertj.core.api.Assertions.assertThat(e.code()).isEqualTo("COUNCIL_SOURCE_CHANGED");
                        org.assertj.core.api.Assertions.assertThat(e.changedBy()).isEqualTo("홍길동(K000002)");
                        org.assertj.core.api.Assertions.assertThat(e.changedByEno()).isEqualTo("K000002");
                        org.assertj.core.api.Assertions.assertThat(e.currentStamp()).isEqualTo(STAMP);
                        org.assertj.core.api.Assertions.assertThat(e.current()).isSameAs(current);
                    });
        }
    }

    @Test
    @DisplayName("자식 행이 더 나중에 바뀌었으면 그 행의 변경자를 지목한다")
    void latestChildWins() {
        Bperfm perf = mock(Bperfm.class);
        given(perf.getLstChgUsid()).willReturn("K000003");
        given(perf.getLstChgDtm()).willReturn(LocalDateTime.of(2026, 9, 22, 11, 0));
        given(stamper.stamp(overview, List.of(), List.of(perf))).willReturn(STAMP);
        given(overview.getLstChgUsid()).willReturn("K000002");
        given(overview.getLstChgDtm()).willReturn(LocalDateTime.of(2026, 9, 22, 10, 5));

        assertThatThrownBy(() -> guard.verifyStamp("b".repeat(64), overview, List.of(), List.of(perf), () -> current, eno -> eno))
                .isInstanceOfSatisfying(CouncilConflictException.class, e ->
                        org.assertj.core.api.Assertions.assertThat(e.changedByEno()).isEqualTo("K000003"));
    }
}
```

`FeasibilityResponse`는 record라 `mock()`이 안 되면(Mockito inline은 final 클래스도 mock하지만 record는 가능) 14인자 `new`로 만든다.

- [ ] **Step 2: 서비스 테스트를 추가한다**

`FeasibilityServiceTest.java`에 `@Mock private CouncilFeasibilityStamper stamper;`, `@Mock private CouncilFeasibilityConcurrencyGuard concurrencyGuard;`, `@Mock private UserRepository userRepository;`를 추가하고 끝에:

```java
    // ───────────────────────────────────────────────────────
    // concurrencyStamp (COUNCIL-012)
    // ───────────────────────────────────────────────────────

    @Test
    @DisplayName("getFeasibility: 응답에 스탬프를 채운다")
    void getFeasibility_스탬프포함() {
        Bpovwm overview = mock(Bpovwm.class);
        given(overview.getAbusNm()).willReturn("사업");
        given(projectOverviewRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(Optional.of(overview));
        given(selfCheckRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(List.of());
        given(performanceRepository.findByItPtlAsctIdAndDelYnOrderByEvlDtpSnoAsc(ASCT_ID, "N")).willReturn(List.of());
        given(stamper.stamp(overview, List.of(), List.of())).willReturn("c".repeat(64));

        assertThat(feasibilityService.getFeasibility(ASCT_ID).concurrencyStamp()).isEqualTo("c".repeat(64));
    }

    @Test
    @DisplayName("saveFeasibility: 사업개요가 없으면(최초 저장) 스탬프 검사를 하지 않고 새 스탬프를 돌려준다")
    void saveFeasibility_최초저장_검사없음() {
        given(projectOverviewRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(Optional.empty());
        given(stamper.stamp(any(), any(), any())).willReturn("d".repeat(64));

        CouncilDto.FeasibilitySaveResponse res = feasibilityService.saveFeasibility(ASCT_ID, requestWithStamp("10", null));

        verify(concurrencyGuard, never()).verifyStamp(any(), any(), any(), any(), any(), any());
        assertThat(res.concurrencyStamp()).isEqualTo("d".repeat(64));
    }

    @Test
    @DisplayName("saveFeasibility: 사업개요가 있으면 잠금 뒤·수정 전에 가드를 호출하고 저장 후 새 스탬프를 돌려준다")
    void saveFeasibility_기존문서_가드호출() {
        Bpovwm overview = mock(Bpovwm.class);
        given(projectOverviewRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(Optional.of(overview));
        given(selfCheckRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(List.of());
        given(performanceRepository.findByItPtlAsctIdAndDelYnOrderByEvlDtpSnoAsc(ASCT_ID, "N")).willReturn(List.of());
        given(stamper.stamp(any(), any(), any())).willReturn("e".repeat(64));

        CouncilDto.FeasibilitySaveResponse res = feasibilityService.saveFeasibility(ASCT_ID, requestWithStamp("10", "a".repeat(64)));

        var order = org.mockito.Mockito.inOrder(councilService, concurrencyGuard, overview);
        order.verify(councilService).findWritableDraftCouncil(ASCT_ID);
        order.verify(concurrencyGuard).verifyStamp(eq("a".repeat(64)), eq(overview), any(), any(), any(), any());
        order.verify(overview).update(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        assertThat(res.concurrencyStamp()).isEqualTo("e".repeat(64));
    }

    @Test
    @DisplayName("saveFeasibility: 가드가 충돌을 던지면 저장하지 않고 그대로 전파한다")
    void saveFeasibility_충돌_전파() {
        Bpovwm overview = mock(Bpovwm.class);
        given(projectOverviewRepository.findByItPtlAsctIdAndDelYn(ASCT_ID, "N")).willReturn(Optional.of(overview));
        willThrow(new CouncilConflictException(HttpStatus.CONFLICT, "COUNCIL_SOURCE_CHANGED", "충돌", "홍길동", "K000002", null, "f".repeat(64), null))
                .given(concurrencyGuard)
                .verifyStamp(any(), any(), any(), any(), any(), any());

        assertThatThrownBy(() -> feasibilityService.saveFeasibility(ASCT_ID, requestWithStamp("10", "b".repeat(64))))
                .isInstanceOf(CouncilConflictException.class);
        verify(overview, never()).update(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(councilService, never()).changeStatus(any(), any());
    }

    private static CouncilDto.FeasibilityRequest requestWithStamp(String kpnTc, String stamp) {
        return new CouncilDto.FeasibilityRequest("사업", "2026", null, null, null, null, "N", null, null, kpnTc, null, "FL_00000001", null, stamp);
    }
```

필요 import: `org.mockito.ArgumentMatchers.eq`, `org.mockito.BDDMockito.willThrow`, `org.springframework.http.HttpStatus`, `com.kdb.it.domain.council.exception.CouncilConflictException`, `com.kdb.it.common.iam.repository.UserRepository`(없는 것만). 기존 `saveFeasibility_*` 테스트에서 `given(projectOverviewRepository.findByItPtlAsctIdAndDelYn(...)).willReturn(Optional.of(overview))`를 쓰는 케이스는 `concurrencyGuard`가 mock이라 통과하지만, `stamper.stamp`가 null을 돌려주므로 반환값을 검사하지 않는 한 그대로 둔다.

- [ ] **Step 3: 실패를 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.service.CouncilFeasibilityConcurrencyGuardTest' --tests 'com.kdb.it.domain.council.service.FeasibilityServiceTest' -q`
Expected: 컴파일 실패 — 가드 없음, `saveFeasibility` 반환형 void.

- [ ] **Step 4: 가드를 만든다**

```java
package com.kdb.it.domain.council.service;

import com.kdb.it.domain.council.dto.CouncilDto;
import com.kdb.it.domain.council.entity.Bchklm;
import com.kdb.it.domain.council.entity.Bperfm;
import com.kdb.it.domain.council.entity.Bpovwm;
import com.kdb.it.domain.council.exception.CouncilConflictException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * 타당성검토표 저장의 동시성 방어 (COUNCIL-012).
 *
 * <p>호출 시점은 {@code lockWritableDraft}로 원장을 잠근 뒤, 사업개요·자체점검·성과지표를 처음 수정하기 직전이어야 합니다. 사업개요가 아직 없는 최초
 * 저장은 호출하지 않습니다. 정보화사업의 {@code ProjectConcurrencyGuard}와 같은 규약이되, 스탬프 **누락**은 400이 아니라 409입니다 — 미작성
 * 화면으로 연 사용자는 정당하게 스탬프가 없을 수 있고, 그때도 상대의 저장을 조용히 덮어쓰면 안 되기 때문입니다.
 */
@Component
@RequiredArgsConstructor
public class CouncilFeasibilityConcurrencyGuard {

    /** 동시성 스탬프 형식: 소문자 SHA-256 64자리 */
    private static final Pattern STAMP_FORMAT = Pattern.compile("[a-f0-9]{64}");

    private final CouncilFeasibilityStamper stamper;

    /**
     * 잠근 문서의 현재 스탬프와 요청 스탬프를 비교합니다.
     *
     * @param submitted 요청 스탬프. null이면 누락
     * @param overview 잠금 상태에서 읽은 사업개요(있음이 전제)
     * @param selfChecks 활성 자체점검 행
     * @param performances 활성 성과지표 행
     * @param currentSupplier 충돌이 확정됐을 때만 호출해 현재 응답을 만든다
     * @param nameResolver 사번 → 표시명. 해석 못 하면 사번을 그대로 쓴다
     * @throws CouncilConflictException 형식 오류 400 {@code COUNCIL_STAMP_INVALID}, 누락·불일치 409 {@code COUNCIL_SOURCE_CHANGED}
     */
    public void verifyStamp(
            String submitted,
            Bpovwm overview,
            List<Bchklm> selfChecks,
            List<Bperfm> performances,
            Supplier<CouncilDto.FeasibilityResponse> currentSupplier,
            UnaryOperator<String> nameResolver) {
        if (submitted != null && !STAMP_FORMAT.matcher(submitted).matches()) {
            throw new CouncilConflictException(
                    HttpStatus.BAD_REQUEST,
                    "COUNCIL_STAMP_INVALID",
                    "동시성 스탬프 형식이 올바르지 않습니다. 화면을 다시 조회한 뒤 저장하세요.",
                    null, null, null, null, null);
        }
        String current = stamper.stamp(overview, selfChecks, performances);
        if (current.equals(submitted)) {
            return;
        }
        LastChange last = lastChange(overview, selfChecks, performances);
        throw new CouncilConflictException(
                HttpStatus.CONFLICT,
                "COUNCIL_SOURCE_CHANGED",
                "다른 사용자가 이 타당성검토표를 수정했습니다.",
                displayName(last.usid(), nameResolver),
                last.usid(),
                last.at(),
                current,
                currentSupplier.get());
    }

    private record LastChange(String usid, LocalDateTime at) {}

    /** 사업개요·자체점검·성과지표 중 가장 나중에 바뀐 행의 변경자를 고른다. 수정일시가 없는 행은 제외. */
    private static LastChange lastChange(Bpovwm overview, List<Bchklm> selfChecks, List<Bperfm> performances) {
        LastChange latest = new LastChange(overview.getLstChgUsid(), overview.getLstChgDtm());
        for (Bchklm c : selfChecks) latest = later(latest, c.getLstChgUsid(), c.getLstChgDtm());
        for (Bperfm p : performances) latest = later(latest, p.getLstChgUsid(), p.getLstChgDtm());
        return latest;
    }

    private static LastChange later(LastChange current, String usid, LocalDateTime at) {
        if (at == null) return current;
        if (current.at() == null || at.isAfter(current.at())) return new LastChange(usid, at);
        return current;
    }

    /** 해석에 실패하면 사번을 그대로 노출해 "누가 바꿨는지"가 비지 않게 한다. */
    private static String displayName(String usid, UnaryOperator<String> nameResolver) {
        if (usid == null) return null;
        try {
            String name = nameResolver.apply(usid);
            return name == null || name.isBlank() ? usid : name;
        } catch (RuntimeException e) {
            return usid;
        }
    }
}
```

- [ ] **Step 5: 서비스와 컨트롤러를 배선한다**

`FeasibilityService.java`: 필드 추가

```java
    /** 타당성검토표 동시성 스탬프 (COUNCIL-012) */
    private final CouncilFeasibilityStamper stamper;

    /** 저장 시 스탬프 대조 (COUNCIL-012) */
    private final CouncilFeasibilityConcurrencyGuard concurrencyGuard;

    /** 충돌 변경자 이름 해석용 */
    private final UserRepository userRepository;
```

(`import com.kdb.it.common.iam.repository.UserRepository;`, `import com.kdb.it.common.iam.entity.CuserI;`)

`getFeasibility`의 마지막 줄을 `return toFeasibilityResponse(overviewOpt.get(), selfChecks, performances);` 그대로 두고, `toFeasibilityResponse`가 스탬프를 계산하도록 바꾼다:

```java
    private CouncilDto.FeasibilityResponse toFeasibilityResponse(
            Bpovwm overview, List<Bchklm> selfChecks, List<Bperfm> performances) {
        // ...기존 변환 그대로...
        return new CouncilDto.FeasibilityResponse(
                // ...기존 13개 인자 그대로...,
                selfCheckResponses,
                stamper.stamp(overview, selfChecks, performances));
    }
```

`saveFeasibility`를 다음으로 바꾼다(반환형 변경, 검사 삽입, 저장 후 재계산):

```java
    @Transactional
    public CouncilDto.FeasibilitySaveResponse saveFeasibility(
            String asctId, CouncilDto.FeasibilityRequest request) {
        // 잠금 이후 권한·상태를 검사해 작성완료 이후 덮어쓰기와 단계 역행을 차단한다.
        councilService.findWritableDraftCouncil(asctId);

        // 동시성 검사 (COUNCIL-012): 잠금 뒤·수정 전. 사업개요가 없는 최초 저장은 검사하지 않는다.
        Bpovwm existing =
                projectOverviewRepository.findByItPtlAsctIdAndDelYn(asctId, "N").orElse(null);
        if (existing != null) {
            List<Bchklm> currentChecks = selfCheckRepository.findByItPtlAsctIdAndDelYn(asctId, "N");
            List<Bperfm> currentPerfs =
                    performanceRepository.findByItPtlAsctIdAndDelYnOrderByEvlDtpSnoAsc(asctId, "N");
            concurrencyGuard.verifyStamp(
                    request.concurrencyStamp(),
                    existing,
                    currentChecks,
                    currentPerfs,
                    () -> toFeasibilityResponse(existing, currentChecks, currentPerfs),
                    this::resolvePersonName);
        }

        // 작성완료 시 첨부파일 필수 검증
        if ("20".equals(request.kpnTc())) {
            validateAttachment(request.flMngNo());
        }

        saveOrUpdateOverview(asctId, request);
        saveOrUpdateSelfChecks(asctId, request);
        if (request.performances() != null && !request.performances().isEmpty()) {
            replacePerformances(asctId, request.performances());
        }

        if ("20".equals(request.kpnTc())) {
            councilService.changeStatus(asctId, "02");
        }

        // 저장 직후 상태로 다음 저장에 쓸 스탬프를 돌려준다 (재조회 불필요)
        Bpovwm saved = projectOverviewRepository.findByItPtlAsctIdAndDelYn(asctId, "N").orElseThrow();
        return new CouncilDto.FeasibilitySaveResponse(
                stamper.stamp(
                        saved,
                        selfCheckRepository.findByItPtlAsctIdAndDelYn(asctId, "N"),
                        performanceRepository.findByItPtlAsctIdAndDelYnOrderByEvlDtpSnoAsc(asctId, "N")));
    }

    /** 충돌 안내용 변경자 이름. 사용자 조회 실패·미존재면 사번을 그대로 쓴다. */
    private String resolvePersonName(String eno) {
        return userRepository.findById(eno).map(CuserI::getUsrNm).orElse(eno);
    }
```

주의: `replacePerformances`가 `entityManager`로 하드 딜리트 후 persist하므로 저장 직후 조회가 영속성 컨텍스트 flush 순서에 좌우된다면 `entityManager.flush()`를 재계산 직전에 넣는다(테스트 `FeasibilityServiceTest.saveFeasibility_성과지표있음_교체저장`이 기존처럼 통과해야 한다). `UserRepository.findById`의 ID 타입이 `String`(사번)인지 `CuserI`의 `@Id`로 확인한다.

`CouncilFeasibilityController.java`: `saveFeasibility`·`updateFeasibility`의 반환형을 `ResponseEntity<CouncilDto.FeasibilitySaveResponse>`로, 본문을 `return ResponseEntity.ok(feasibilityService.saveFeasibility(asctId, request));`로 바꾸고 `@ApiResponses`에 다음 두 줄을 더한다:

```java
                @ApiResponse(responseCode = "400", description = "동시성 스탬프 형식 오류(COUNCIL_STAMP_INVALID)", content = @Content(schema = @Schema(implementation = CouncilConflictResponse.class))),
                @ApiResponse(responseCode = "409", description = "다른 사용자가 먼저 저장함(COUNCIL_SOURCE_CHANGED, 현재 상태 포함)", content = @Content(schema = @Schema(implementation = CouncilConflictResponse.class)))
```

(`import com.kdb.it.domain.council.dto.CouncilConflictResponse;`). 200 응답의 `content`에 `FeasibilitySaveResponse` 스키마를 명시한다.

- [ ] **Step 6: 경계 테스트를 맞춘다**

`CouncilAccessBoundaryTest`의 `new FeasibilityService(projectOverviewRepository, performanceRepository, selfCheckRepository, councilService, guard)` 호출에 `stamper`, `concurrencyGuard`, `userRepository` 인자를 순서대로 더한다(필드 선언 순서 = 생성자 순서). 그 테스트는 `@Mock` 없이 `mock(...)`으로 만들 수 있다: `new CouncilFeasibilityStamper(new ItBudgetCanonicalJson())`, `new CouncilFeasibilityConcurrencyGuard(stamper)`, 기존 `userRepository` mock. 사업개요가 있는 상태에서 `saveFeasibility(ID, request("10"))`를 부르는 케이스는 요청 스탬프가 null이라 409가 나므로, 해당 케이스의 `request(...)` 헬퍼가 `projectOverviewRepository`가 돌려주는 overview로 계산한 실제 스탬프를 넣도록 바꾼다(`stamper.stamp(overview, List.of(), List.of())`). 사업개요가 없는(`Optional.empty()`) 케이스는 그대로다.

- [ ] **Step 7: 통과·포맷·상한을 확인한다**

Run: `./gradlew spotlessApply -q && ./gradlew test --tests 'com.kdb.it.domain.council.*' --tests 'com.kdb.it.architecture.MaxLinesRatchetTest' spotlessJavaCheck -q`
Expected: PASS. `FeasibilityService.java`가 800줄 미만(예상 ~430).

- [ ] **Step 8: 커밋한다**

```bash
git add src/main/java/com/kdb/it/domain/council/service/CouncilFeasibilityConcurrencyGuard.java src/main/java/com/kdb/it/domain/council/service/FeasibilityService.java src/main/java/com/kdb/it/domain/council/controller/CouncilFeasibilityController.java src/test/java/com/kdb/it/domain/council/service/CouncilFeasibilityConcurrencyGuardTest.java src/test/java/com/kdb/it/domain/council/service/FeasibilityServiceTest.java src/test/java/com/kdb/it/domain/council/service/CouncilAccessBoundaryTest.java
git commit -m "feat(council): 타당성검토표 저장에 동시성 스탬프 검사 적용, 저장 응답에 새 스탬프 반환 (COUNCIL-012)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 생성 타입 갱신 (백엔드 기동 → codegen)

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (codegen 산출, 수기 편집 금지)
- Modify: `it_frontend/app/types/council.ts` (별칭 2개)

- [ ] **Step 1: 백엔드를 띄우고 codegen을 돌린다**

Run (in `C:\it\it_backend`, 백그라운드): `./gradlew bootRun --args='--spring.profiles.active=local-ext' -q` → `http://localhost:28080/v3/api-docs`가 200을 줄 때까지 폴링 → (in `C:\it\it_frontend`) `npm run codegen && npm run codegen:check` → bootRun 프로세스 종료, `./gradlew --stop`.
Expected: `api.d.ts`에 `FeasibilitySaveResponse`, `CouncilConflictResponse` 스키마와 `FeasibilityResponse.concurrencyStamp`, `FeasibilityRequest.concurrencyStamp`가 생긴다. `grep -n "CouncilConflictResponse\|FeasibilitySaveResponse" app/types/api.d.ts`로 확인.

- [ ] **Step 2: 타입 별칭을 추가한다**

`app/types/council.ts`의 `FeasibilityData` 별칭 아래:

```ts
/** 타당성검토표 저장 응답 — 다음 저장에 쓸 최신 스탬프 (COUNCIL-012). */
export type FeasibilitySaveResponse = components['schemas']['FeasibilitySaveResponse'];

/** 타당성검토표 저장 충돌(409) 응답 (COUNCIL-012). */
export type CouncilConflictResponse = components['schemas']['CouncilConflictResponse'];
```

- [ ] **Step 3: 타입 검사를 돌려 깨지는 곳을 본다**

Run: `npm run typecheck`
Expected: `FeasibilityData`에 `concurrencyStamp`가 필수로 생겨 `buildBprojmDefaults`(features/council/feasibilityFormDefaults.ts)와 테스트 픽스처(`baseFeasibility`, `FeasibilityOverview-byte-limit.test.ts`의 `baseModel`)가 실패한다. Task 5에서 고친다 — 여기서는 확인만.

- [ ] **Step 4: 커밋한다**

```bash
git add app/types/api.d.ts app/types/council.ts
git commit -m "chore(council): 타당성검토표 스탬프·충돌 응답 OpenAPI 타입 재생성 (COUNCIL-012)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 프론트 스탬프 보관·전송·충돌 상태 (`useCouncilRequestPage`)

**Files:**
- Modify: `it_frontend/app/composables/council/useCouncilCommitteeApi.ts` (`saveFeasibility` 반환형)
- Modify: `it_frontend/app/features/council/feasibilityFormDefaults.ts` (`concurrencyStamp: null`)
- Create: `it_frontend/app/composables/council/useFeasibilityConflict.ts`
- Modify: `it_frontend/app/composables/useCouncilRequestPage.ts` (`initForm`, `saveTemp`, `saveComplete`, return)
- Modify: `it_frontend/i18n/messages/council.ts`
- Test: `it_frontend/tests/unit/composables/useCouncilRequestPage.test.ts`, `tests/unit/components/council/FeasibilityOverview-byte-limit.test.ts`(픽스처)

**Interfaces:**
- Consumes: Task 4 타입 `FeasibilitySaveResponse`, `CouncilConflictResponse`.
- Produces: `saveFeasibility(asctId, payload, isUpdate): Promise<FeasibilitySaveResponse>`; `asCouncilSourceChanged(error: unknown): CouncilConflictResponse | null`; composable 반환 `concurrencyStamp: Ref<string | null>`, `conflict: Ref<CouncilConflictResponse | null>`, `closeConflict(): void`, `reloadFromConflict(): void`, `overwriteWithMine(): Promise<void>`.

- [ ] **Step 1: 테스트를 쓴다**

`useCouncilRequestPage.test.ts`: `baseFeasibility` 픽스처에 `concurrencyStamp: 'a'.repeat(64),`를 더하고, `describe('useCouncilRequestPage — 상태 판정 computed'` 앞에:

```ts
describe('useCouncilRequestPage — 동시성 스탬프·충돌 해소 (COUNCIL-012)', () => {
    const STAMP_A = 'a'.repeat(64);
    const STAMP_B = 'b'.repeat(64);
    const conflict = (overrides: Partial<CouncilConflictResponse> = {}): CouncilConflictResponse => ({
        timestamp: '2026-09-22T10:05:00',
        status: 409,
        code: 'COUNCIL_SOURCE_CHANGED',
        message: '다른 사용자가 이 타당성검토표를 수정했습니다.',
        changedBy: '홍길동',
        changedByEno: 'K000002',
        changedAt: '2026-09-22T10:05:00',
        currentStamp: STAMP_B,
        current: baseFeasibility({ prjNm: '상대가 저장한 사업명', concurrencyStamp: STAMP_B }),
        ...overrides,
    });

    it('프리필 때 조회 응답의 스탬프를 보관하고 저장 요청에 함께 보낸다', async () => {
        mocks.saveFeasibility.mockResolvedValue({ concurrencyStamp: STAMP_B });
        const { page } = createPage({ feasibilityData: baseFeasibility({ concurrencyStamp: STAMP_A }) });
        expect(page.concurrencyStamp.value).toBe(STAMP_A);

        await page.saveTemp();

        expect(mocks.saveFeasibility).toHaveBeenCalledWith(
            asctId,
            expect.objectContaining({ kpnTc: '10', concurrencyStamp: STAMP_A }),
            true,
        );
        /* 저장 응답의 새 스탬프로 갱신 — 재조회 없이 다음 저장에 쓴다 */
        expect(page.concurrencyStamp.value).toBe(STAMP_B);
    });

    it('미작성(200/null)이면 스탬프 없이 저장하고 응답 스탬프를 보관한다', async () => {
        mocks.saveFeasibility.mockResolvedValue({ concurrencyStamp: STAMP_A });
        const { page } = createPage({ feasibilityData: null });
        expect(page.concurrencyStamp.value).toBeNull();

        await page.saveTemp();

        expect(mocks.saveFeasibility).toHaveBeenCalledWith(asctId, expect.objectContaining({ concurrencyStamp: null }), false);
        expect(page.concurrencyStamp.value).toBe(STAMP_A);
    });

    it('409 COUNCIL_SOURCE_CHANGED는 실패 토스트 대신 conflict 상태를 연다', async () => {
        mocks.saveFeasibility.mockRejectedValue({ data: conflict() });
        const { page } = createPage({ feasibilityData: baseFeasibility({ concurrencyStamp: STAMP_A }) });

        await page.saveTemp();

        expect(page.conflict.value?.changedBy).toBe('홍길동');
        expect(mocks.toastAdd).not.toHaveBeenCalled();
        expect(page.savePending.value).toBe(false);
    });

    it('current가 없는 409나 다른 코드는 기존처럼 실패 토스트다', async () => {
        mocks.saveFeasibility.mockRejectedValue({ data: { code: 'OTHER', message: '잠금 초과' } });
        const { page } = createPage({ feasibilityData: baseFeasibility({ concurrencyStamp: STAMP_A }) });

        await page.saveTemp();

        expect(page.conflict.value).toBeNull();
        expect(mocks.toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error', detail: '잠금 초과' }));
    });

    it('reloadFromConflict는 서버 현재값으로 폼·스탬프를 바꾸고 다이얼로그를 닫는다', async () => {
        mocks.saveFeasibility.mockRejectedValue({ data: conflict() });
        const { page } = createPage({ feasibilityData: baseFeasibility({ concurrencyStamp: STAMP_A }) });
        page.onFormInput({ ...page.form.value, prjNm: '내가 입력한 사업명' });
        await page.saveTemp();

        page.reloadFromConflict();

        expect(page.form.value.prjNm).toBe('상대가 저장한 사업명');
        expect(page.concurrencyStamp.value).toBe(STAMP_B);
        expect(page.conflict.value).toBeNull();
    });

    it('overwriteWithMine은 현재 스탬프로 같은 저장을 다시 보낸다', async () => {
        mocks.saveFeasibility.mockRejectedValueOnce({ data: conflict() }).mockResolvedValueOnce({ concurrencyStamp: 'c'.repeat(64) });
        const { page } = createPage({ feasibilityData: baseFeasibility({ concurrencyStamp: STAMP_A }) });
        page.onFormInput({ ...page.form.value, prjNm: '내가 입력한 사업명' });
        await page.saveTemp();

        await page.overwriteWithMine();

        expect(mocks.saveFeasibility).toHaveBeenLastCalledWith(
            asctId,
            expect.objectContaining({ prjNm: '내가 입력한 사업명', kpnTc: '10', concurrencyStamp: STAMP_B }),
            true,
        );
        expect(page.conflict.value).toBeNull();
        expect(page.concurrencyStamp.value).toBe('c'.repeat(64));
    });
});
```

`import type { CouncilConflictResponse } from '~/types/council';`를 추가한다. `FeasibilityOverview-byte-limit.test.ts`의 `baseModel`에 `concurrencyStamp: null,`을 더한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/unit/composables/useCouncilRequestPage.test.ts`
Expected: 신규 6건 FAIL(`concurrencyStamp`·`conflict` undefined).

- [ ] **Step 3: API 반환형과 폼 기본값을 바꾼다**

`useCouncilCommitteeApi.ts`의 `saveFeasibility`:

```ts
    const saveFeasibility = async (
        asctId: string,
        payload: import('~/types/council').FeasibilityData,
        isUpdate: boolean = false,
    ): Promise<import('~/types/council').FeasibilitySaveResponse> =>
        $apiFetch<import('~/types/council').FeasibilitySaveResponse>(`${BASE}/${asctId}/feasibility`, {
            method: isUpdate ? 'PUT' : 'POST',
            body: payload,
        });
```

JSDoc에 `@returns 저장 직후 스탬프 — 다음 저장 요청에 그대로 싣는다 (COUNCIL-012)`를 더한다.

`feasibilityFormDefaults.ts`의 `buildBprojmDefaults` 반환 객체 끝에 `concurrencyStamp: null,`(생성 타입이 `string | null`이면 그대로, `string`이면 `''` 대신 타입을 확인해 `null`이 허용되도록 백엔드 `@Schema(nullable = true)`가 붙었는지 본다 — Task 2에서 `FeasibilityResponse.concurrencyStamp`는 nullable 표시가 없으므로 `string`이 된다. 그 경우 이 파일에서는 `concurrencyStamp: ''`로 두고, composable은 별도 ref로 관리한다).

- [ ] **Step 4: 충돌 판정 헬퍼를 만든다**

`app/composables/council/useFeasibilityConflict.ts`:

```ts
/**
 * ============================================================================
 * [useFeasibilityConflict] 타당성검토표 저장 충돌(409 COUNCIL_SOURCE_CHANGED) 상태 (COUNCIL-012)
 * ============================================================================
 * 서버가 `current`·`currentStamp`를 준 충돌만 해소 대상이다. 잠금 대기 초과나 `current`가 없는 409는
 * 일반 저장 실패로 남긴다(정보화사업 `asProjectSourceChanged`와 같은 규칙).
 */
import { ref } from 'vue';
import type { CouncilConflictResponse } from '~/types/council';

/** 해소 가능한 충돌 응답이면 그 본문을, 아니면 null을 돌려준다. */
export const asCouncilSourceChanged = (error: unknown): CouncilConflictResponse | null => {
    const data = (error as { data?: Partial<CouncilConflictResponse> } | null)?.data;
    if (!data || data.code !== 'COUNCIL_SOURCE_CHANGED') return null;
    if (!data.current || typeof data.current !== 'object' || !data.currentStamp) return null;
    return data as CouncilConflictResponse;
};

/**
 * 충돌 상태와 해소 명령을 구성한다. 실제 재저장·폼 반영은 호출자가 넘긴 함수가 한다.
 *
 * @param deps.applyServerCurrent 서버 현재값으로 폼·스탬프를 덮어쓰는 함수
 * @param deps.resaveWithStamp 마지막 저장을 주어진 스탬프로 다시 보내는 함수
 */
export const useFeasibilityConflict = (deps: {
    applyServerCurrent: (current: CouncilConflictResponse['current']) => void;
    resaveWithStamp: (stamp: string) => Promise<void>;
}) => {
    /** 열려 있는 충돌. null이면 다이얼로그가 닫혀 있다 */
    const conflict = ref<CouncilConflictResponse | null>(null);

    /** 저장 실패를 충돌로 받아들일 수 있으면 상태에 담고 true를 돌려준다 */
    const captureConflict = (error: unknown): boolean => {
        const found = asCouncilSourceChanged(error);
        if (!found) return false;
        conflict.value = found;
        return true;
    };

    const closeConflict = () => {
        conflict.value = null;
    };

    /** [다시 불러오기] — 내 입력을 버리고 서버 현재값으로 */
    const reloadFromConflict = () => {
        if (!conflict.value) return;
        deps.applyServerCurrent(conflict.value.current);
        conflict.value = null;
    };

    /** [내 입력으로 덮어쓰기] — 현재 스탬프로 같은 저장을 한 번 더. 또 충돌이면 새 정보로 다시 열린다 */
    const overwriteWithMine = async () => {
        if (!conflict.value) return;
        const stamp = conflict.value.currentStamp;
        conflict.value = null;
        await deps.resaveWithStamp(stamp);
    };

    return { conflict, captureConflict, closeConflict, reloadFromConflict, overwriteWithMine };
};
```

- [ ] **Step 5: composable에 배선한다**

`useCouncilRequestPage.ts`:

1. import: `import { useFeasibilityConflict } from '~/composables/council/useFeasibilityConflict';`
2. `savedOnce` 선언 아래:

```ts
    /** 조회 시점(또는 마지막 저장 성공 시점)의 동시성 스탬프 (COUNCIL-012). 미작성이면 null */
    const concurrencyStamp = ref<string | null>(null);
```

3. `initForm(data)`에서 `if (data.prjNm) savedOnce.value = true;` 아래에 `concurrencyStamp.value = data.concurrencyStamp || null;`를 추가하고, `if (!data)` 분기에서 `concurrencyStamp.value = null;`을 추가한다.
4. `saveTemp`·`saveComplete`의 실제 호출을 공통 함수로 뺀다. `saveTemp` 정의 **위**에:

```ts
    /** 마지막으로 시도한 저장 종류 — 충돌 해소 후 같은 저장을 다시 보내기 위해 기억한다 */
    let lastSaveKpnTc: '10' | '20' = '10';

    /**
     * 저장 요청 한 번. 스탬프를 실어 보내고 응답 스탬프를 보관한다.
     *
     * @returns 저장 성공 여부. 충돌(409 COUNCIL_SOURCE_CHANGED)은 conflict 상태를 열고 false, 그 밖의 실패는 throw
     */
    const submitFeasibility = async (kpnTc: '10' | '20', stamp: string | null): Promise<boolean> => {
        lastSaveKpnTc = kpnTc;
        try {
            const res = await saveFeasibility(
                asctId,
                { ...form.value, kpnTc, concurrencyStamp: stamp ?? '' },
                savedOnce.value,
            );
            savedOnce.value = true;
            concurrencyStamp.value = res.concurrencyStamp;
            return true;
        } catch (e: unknown) {
            if (captureConflict(e)) return false;
            throw e;
        }
    };

    const { conflict, captureConflict, closeConflict, reloadFromConflict, overwriteWithMine } =
        useFeasibilityConflict({
            applyServerCurrent: (current) => {
                initForm(current);
                formDirty.value = false;
            },
            resaveWithStamp: async (stamp) => {
                if (lastSaveKpnTc === '20') await saveComplete(stamp);
                else await saveTemp(stamp);
            },
        });
```

`{ ...form.value, kpnTc, concurrencyStamp: stamp ?? '' }` — 생성 타입이 `string | null`이면 `stamp`를 그대로 넣는다(테스트는 `concurrencyStamp: null`을 기대하므로 이 경우 테스트의 `objectContaining({ concurrencyStamp: null })`을 `''`로 맞추거나 백엔드에 `@Schema(nullable = true)`를 붙여 `string | null`로 만든다 — **후자를 택한다**: Task 2의 `FeasibilityResponse.concurrencyStamp`에 `@Schema(nullable = true)`를 붙이고 Task 4를 다시 돌린다. 그러면 `feasibilityFormDefaults`도 `null`이 된다).

`saveTemp`를 다음으로 바꾼다(`saveComplete`도 같은 구조로, 검증·다이얼로그 부분은 유지):

```ts
    const saveTemp = async (stamp: string | null = concurrencyStamp.value) => {
        if (blockSaveIfLoadFailed()) return;
        savePending.value = true;
        try {
            if (await submitFeasibility('10', stamp)) notifySuccess('draftSaved');
        } catch (e: unknown) {
            toast.add({ severity: 'error', summary: t('council.request.toast.saveFailed'), detail: failureDetail(e, 'draftSaveFailed'), life: 4000 });
        } finally {
            savePending.value = false;
        }
    };
```

`saveComplete(stamp = concurrencyStamp.value)`에서는 `await saveFeasibility(asctId, { ...form.value, kpnTc: '20' }, savedOnce.value); savedOnce.value = true;` 두 줄을 `if (!(await submitFeasibility('20', stamp))) return;`로 바꾸고 나머지(재조회·결재 다이얼로그)는 그대로 둔다. `submitFeasibility`·`useFeasibilityConflict` 호출은 `saveTemp`/`saveComplete`보다 **위**에 두되, `resaveWithStamp` 안에서 두 함수를 참조하는 것은 호출 시점이 나중이라 괜찮다.

5. return에 `concurrencyStamp, conflict, closeConflict, reloadFromConflict, overwriteWithMine,`을 추가한다.

- [ ] **Step 6: i18n 키를 추가한다**

ko `council.requestDetail`(`cancelConfirmMessage` 아래):

```ts
                conflictTitle: '다른 사용자가 수정했습니다',
                conflictMessage:
                    '{changedBy}님이 {changedAt}에 이 타당성검토표를 저장했습니다. 지금 저장하면 그 내용을 덮어쓰며, 성과지표는 상대가 추가한 행도 지워집니다.',
                conflictReload: '다시 불러오기',
                conflictOverwrite: '내 입력으로 덮어쓰기',
```

en:

```ts
                conflictTitle: 'Someone else saved this report',
                conflictMessage:
                    '{changedBy} saved this feasibility report at {changedAt}. Saving now overwrites their changes, including any performance indicator rows they added.',
                conflictReload: 'Reload theirs',
                conflictOverwrite: 'Overwrite with mine',
```

- [ ] **Step 7: 통과·타입·포맷·상한을 확인한다**

Run: `npx prettier --write app/composables/council/useCouncilCommitteeApi.ts app/composables/council/useFeasibilityConflict.ts app/composables/useCouncilRequestPage.ts app/features/council/feasibilityFormDefaults.ts i18n/messages/council.ts tests/unit/composables/useCouncilRequestPage.test.ts tests/unit/components/council/FeasibilityOverview-byte-limit.test.ts && npx vitest run tests/unit/composables/useCouncilRequestPage.test.ts tests/unit/components/council tests/unit/features/council tests/unit/architecture && npm run typecheck && npm run check:copy && wc -l app/composables/useCouncilRequestPage.ts`
Expected: 전부 PASS, 800줄 미만(넘으면 `submitFeasibility`·`lastSaveKpnTc`·`useFeasibilityConflict` 호출을 `composables/council/useFeasibilitySave.ts`로 옮긴다).

- [ ] **Step 8: 커밋한다**

```bash
git add app/composables/council/useCouncilCommitteeApi.ts app/composables/council/useFeasibilityConflict.ts app/composables/useCouncilRequestPage.ts app/features/council/feasibilityFormDefaults.ts i18n/messages/council.ts tests/unit/composables/useCouncilRequestPage.test.ts tests/unit/components/council/FeasibilityOverview-byte-limit.test.ts
git commit -m "feat(council): 타당성검토표 저장에 동시성 스탬프를 싣고 409 충돌을 상태로 받아 해소 (COUNCIL-012)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Step1 충돌 다이얼로그, 전체 게이트, 완료 기록

**Files:**
- Modify: `it_frontend/app/pages/info/council-request/[id].vue`
- Modify: `C:\it\TASK_COUNCIL.md`, `C:\it\TASK_COUNCIL_DONE.md`; spec/plan → `done/`

- [ ] **Step 1: 다이얼로그를 넣는다**

`[id].vue` 구조분해에 `conflict, closeConflict, reloadFromConflict, overwriteWithMine,`을 추가하고, 결재 요청 `<Dialog v-model:visible="showApprovalDialog"` 블록 **앞**에:

```vue
        <!-- ── 저장 충돌(409 COUNCIL_SOURCE_CHANGED) 해소 — 다시 불러오기 / 내 입력으로 덮어쓰기 (COUNCIL-012) ── -->
        <Dialog
            :visible="conflict !== null"
            :header="t('council.requestDetail.conflictTitle')"
            modal
            :closable="true"
            :style="{ width: '32rem' }"
            @update:visible="(v) => !v && closeConflict()"
        >
            <p v-if="conflict" class="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
                {{
                    t('council.requestDetail.conflictMessage', {
                        changedBy: conflict.changedBy ?? conflict.changedByEno ?? '-',
                        changedAt: formatDateTime(conflict.changedAt),
                    })
                }}
            </p>
            <template #footer>
                <AppDialogFooter>
                    <Button :label="t('common.actions.cancel')" severity="secondary" class="btn-neutral" @click="closeConflict" />
                    <Button :label="t('council.requestDetail.conflictReload')" severity="secondary" outlined icon="pi pi-refresh" @click="reloadFromConflict" />
                    <Button :label="t('council.requestDetail.conflictOverwrite')" severity="danger" icon="pi pi-save" :loading="savePending" @click="overwriteWithMine" />
                </AppDialogFooter>
            </template>
        </Dialog>
```

`formatDateTime`은 `app/utils/common.ts`의 `formatDateTime(dtm: string | null | undefined, locale = 'ko-KR')`를 import한다(`import { formatDateTime } from '~/utils/common';`). `savePending`은 이미 구조분해돼 있다.

- [ ] **Step 2: 페이지 검증**

Run: `npx prettier --write "app/pages/info/council-request/[id].vue" && npx eslint "app/pages/info/council-request/[id].vue" && npm run typecheck && npx vitest run tests/unit/pages/councilRequestDetailPageBoundary.test.ts tests/unit/architecture && wc -l "app/pages/info/council-request/[id].vue"`
Expected: PASS, 800줄 미만.

- [ ] **Step 3: 커밋**

```bash
git add "app/pages/info/council-request/[id].vue"
git commit -m "feat(council): Step1에 저장 충돌 해소 다이얼로그 추가 (COUNCIL-012)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 4: 전체 게이트**

Run (in `C:\it\it_frontend`): `npm run format:check && npm run check && npm run codegen:check && npm test` — `codegen:check`는 백엔드가 떠 있어야 하므로 Task 4에서 이미 확인했으면 생략 가능.
Run (in `C:\it\it_backend`): `./gradlew test -q && ./gradlew spotlessJavaCheck -q`, 끝나면 `./gradlew --stop`.
Expected: 통과. 프론트의 기존 환경 실패 2건(`project-domain-i18n`·`ItBudgetSourceChangedDialog`)은 그대로 기록.

- [ ] **Step 5: 완료 기록·문서 이동·커밋**

`TASK_COUNCIL.md`에서 `| COUNCIL-012 | 중간 | 진행 |` 행 삭제. `TASK_COUNCIL_DONE.md`의 `## 2026-09-21` 표 위에 `## 2026-09-22` 절을 만들고:

```markdown
## 2026-09-22

| ID | 상태 | 조치 | 근거 |
| --- | :--: | ---- | ---- |
| COUNCIL-012 | ✅ Done | Step1 타당성검토표에 동시성 스탬프(`BPOVWM`+`BCHKLM`+`BPERFM` SHA-256, `KPN_TP_TC`·감사 필드 제외) 도입. `GET`이 `concurrencyStamp`를 싣고 `POST/PUT`은 잠금 뒤·수정 전에 대조해 형식 오류 400 `COUNCIL_STAMP_INVALID`, 누락·불일치 409 `COUNCIL_SOURCE_CHANGED`(변경자·현재 스탬프·현재값)로 응답하며 성공 시 `FeasibilitySaveResponse { concurrencyStamp }`를 돌려준다. 프론트는 스탬프를 보관·전송하고 409를 다이얼로그로 받아 [다시 불러오기]/[내 입력으로 덮어쓰기]로 해소(경량, 3-way 병합 없음 — 사용자 결정). `GlobalExceptionHandler`에 협의회 전용 핸들러 1개 추가(사용자 승인) | [설계](docs/superpowers/specs/done/2026-09-22-council-feasibility-concurrency-design.md) · [계획](docs/superpowers/plans/done/2026-09-22-council-feasibility-concurrency.md) |

코드 변경(COUNCIL-012): `it_backend` — `CouncilFeasibilityStamper`·`CouncilFeasibilityConcurrencyGuard`·`CouncilConflictException`·`CouncilConflictResponse`(신규), `CouncilDto`(`FeasibilityRequest/Response.concurrencyStamp`, `FeasibilitySaveResponse`), `FeasibilityService`, `CouncilFeasibilityController`, `GlobalExceptionHandler`(핸들러 1개), 테스트 N개. `it_frontend` — `composables/council/useFeasibilityConflict.ts`(신규), `useCouncilCommitteeApi.ts`, `useCouncilRequestPage.ts`, `features/council/feasibilityFormDefaults.ts`, `pages/info/council-request/[id].vue`, `i18n/messages/council.ts`(키 4개 ko/en), `types/council.ts`·`types/api.d.ts`(codegen), 테스트 2개. DB 변경 없음. 배포 순서 프론트 → 백엔드.

검증 결과(COUNCIL-012): (Task 1~3·5의 신규 테스트 건수와 Step 4의 전체 건수를 실제 값으로 적는다)

미검증 범위(COUNCIL-012): 실제 두 브라우저 세션의 동시 저장 종단 확인, 다이얼로그 배선(페이지 컴포넌트 테스트 없음), 결과서(`BRSLTM`)는 범위 밖.
```

```bash
cd C:\it
git mv docs/superpowers/specs/2026-09-22-council-feasibility-concurrency-design.md docs/superpowers/specs/done/
git mv docs/superpowers/plans/2026-09-22-council-feasibility-concurrency.md docs/superpowers/plans/done/
```

옮긴 스펙의 `[COUNCIL-012](../../../TASK_COUNCIL.md)`를 `../../../../TASK_COUNCIL.md`로, `[전산업무비 …](done/2026-09-08-…)`를 `(2026-09-08-cost-concurrency-conflict-merge-design.md)`로, 옮긴 계획의 `**Spec:**` 경로를 `docs/superpowers/specs/done/2026-09-22-council-feasibility-concurrency-design.md`로 고친다.

```bash
git add TASK_COUNCIL.md TASK_COUNCIL_DONE.md docs/superpowers/specs/done/2026-09-22-council-feasibility-concurrency-design.md docs/superpowers/plans/done/2026-09-22-council-feasibility-concurrency.md
git commit -m "docs(council): COUNCIL-012 완료 기록 및 설계·계획 문서 이동

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

푸시는 사용자 확인 후 `it_backend`·`it_frontend`는 `origin/K230028`, 루트는 `fork/K230028`.
