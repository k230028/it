# 협의회 입력 BYTE 한도 정합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 협의회 자유입력 21개 필드가 DB BYTE 한도를 넘지 못하도록 서버(엔티티 `@PrePersist/@PreUpdate`)와 프론트(바이트 기준 입력 거부 + 인디케이터)를 함께 맞춘다.

**Architecture:** 백엔드는 `domain/council/entity/CouncilTextLimits.require`를 10개 엔티티의 JPA 콜백에서 호출해 어떤 저장 경로든 JDBC 전에 400으로 거부한다. 프론트는 한도를 `app/features/council/councilFormLimits.ts` 한 곳에 두고, 기존 공통 `useDatabaseByteLimit`(거부·토스트)과 `TextLengthIndicator`(현재/최대 바이트)를 협의회 11개 입력 지점에 연결하며 글자 수 `maxlength`를 제거한다.

**Tech Stack:** Spring Boot 4 + JPA(Hibernate) + JUnit 5/AssertJ/Spring `ReflectionTestUtils`, Nuxt 4 + Vue 3 + PrimeVue + Vitest/@vue/test-utils(happy-dom), Spotless, ESLint/Prettier.

**Spec:** `docs/superpowers/specs/done/2026-09-20-council-text-byte-limits-design.md`

## Global Constraints

- 수정 범위: `it_backend/src/main/java/com/kdb/it/domain/council/**`, `it_backend/src/test/java/com/kdb/it/domain/council/**`, `it_frontend/app/components/council/**`, `it_frontend/app/pages/info/council-request/**`, `it_frontend/app/features/council/**`, `it_frontend/tests/unit/**/council/**`, 그리고 사용자가 승인한 `it_frontend/i18n/messages/council.ts`. 그 밖의 파일을 고쳐야 하면 멈추고 사용자 확인을 받는다.
- DB 스키마, DTO, 컨트롤러, 공통 유틸(`Utf8ByteLimit`, `useDatabaseByteLimit`, `TextLengthIndicator`, `textLength.ts`)은 바꾸지 않는다. 새 i18n 키를 만들지 않는다.
- 서버 거부 메시지 형식: `협의회 <엔티티> <컬럼>은 UTF-8 기준 <max>바이트를 초과할 수 없습니다. (현재: <actual>바이트)` — `IllegalArgumentException`(공통 처리기가 400). `null`·빈 값은 통과.
- 프론트 한도 = DB 바이트 한도. 기존 글자 수 `maxlength`와 자리표시자의 `(최대 {max}자)`는 전부 제거한다.
- 한글 1자 = UTF-8 3바이트. 테스트의 초과값은 `"가".repeat(n)`으로 만든다.
- 신규 주석은 한글. 커밋은 `git add <경로>` 명시, 메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 백엔드 명령은 `C:\it\it_backend`, 프론트 명령은 `C:\it\it_frontend`에서 실행한다.

---

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| Create `it_backend/.../domain/council/entity/CouncilTextLimits.java` | 바이트 한도 검사 공통 헬퍼(패키지 전용) |
| Modify `Bpovwm` `Bperfm` `Bchklm` `Bevalm` `Bplevm` `Brsltm` `Bpqnam` `Bmqnam` `Baskpm` `Basctm` (같은 패키지) | 한도 상수 + `@PrePersist @PreUpdate validateTextLimitsBeforePersist()` |
| Create `it_backend/src/test/.../domain/council/entity/CouncilTextLimitsTest.java`, `CouncilEntityByteLimitTest.java` | 헬퍼 경계값·엔티티별 거부 테스트 |
| Modify `it_frontend/i18n/messages/council.ts` | 자리표시자의 글자 수 접미 제거(ko·en) |
| Create `it_frontend/app/features/council/councilFormLimits.ts`, `meetingPlace.ts` | 프론트 한도 단일 출처, 회의장소 결합 함수 |
| Modify `app/components/council/feasibility/FeasibilityOverview.vue`, `FeasibilityPerformance.vue`, `FeasibilitySelfCheck.vue` | 네이티브 `:value/@input` 입력의 바이트 거부·복원·인디케이터 |
| Modify `app/components/council/evaluation/EvaluationForm.vue`, `plan/PlanPprtForm.vue`, `result/ResultForm.vue`, `qna/CouncilQna.vue`, `mainqna/MainQnaSection.vue` | `v-model` 입력의 바이트 거부·인디케이터 |
| Modify `app/components/council/schedule/ScheduleStatus.vue`, `app/pages/info/council-request/index.vue`, `app/pages/info/council-request/[id].vue` | 회의장소(결합 100B)·판정 사유·생략요청 사유 |
| Create `tests/unit/features/council/councilFormLimits.test.ts`, `meetingPlace.test.ts`, `tests/unit/components/council/FeasibilityOverview-byte-limit.test.ts` | 한도 숫자 고정, 결합 검사, 네이티브 입력 거부·복원 |
| Modify `C:\it\TASK_COUNCIL.md`, `TASK_COUNCIL_DONE.md`, 스펙·계획 문서 이동 | 완료 기록 |

---

### Task 1: `CouncilTextLimits` 헬퍼

**Files:**
- Create: `src/main/java/com/kdb/it/domain/council/entity/CouncilTextLimits.java`
- Test: `src/test/java/com/kdb/it/domain/council/entity/CouncilTextLimitsTest.java`

**Interfaces:**
- Consumes: `com.kdb.it.common.util.Utf8ByteLimit.length(String)`.
- Produces: `static void require(String entityLabel, String columnName, String value, int maxBytes)` — 패키지 전용. Task 2의 엔티티가 호출한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/test/java/com/kdb/it/domain/council/entity/CouncilTextLimitsTest.java`:

```java
package com.kdb.it.domain.council.entity;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 협의회 문자열 컬럼의 UTF-8 바이트 한도 헬퍼 계약을 검증합니다. */
class CouncilTextLimitsTest {

    @Test
    @DisplayName("한도와 같은 바이트는 통과하고 1바이트만 넘어도 거부한다")
    void boundary() {
        // 한글 1자 = 3바이트. 33자 = 99바이트, 34자 = 102바이트
        assertThatCode(() -> CouncilTextLimits.require("검토표", "ABUS_NM", "가".repeat(33), 100))
                .doesNotThrowAnyException();
        assertThatCode(() -> CouncilTextLimits.require("검토표", "ABUS_NM", "a".repeat(100), 100))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> CouncilTextLimits.require("검토표", "ABUS_NM", "가".repeat(34), 100))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("협의회 검토표 ABUS_NM은 UTF-8 기준 100바이트를 초과할 수 없습니다. (현재: 102바이트)");
    }

    @Test
    @DisplayName("null과 빈 값은 검사 없이 통과한다")
    void nullAndEmptyPass() {
        assertThatCode(() -> CouncilTextLimits.require("검토표", "ABUS_NM", null, 100))
                .doesNotThrowAnyException();
        assertThatCode(() -> CouncilTextLimits.require("검토표", "ABUS_NM", "", 100))
                .doesNotThrowAnyException();
    }
}
```

- [ ] **Step 2: 컴파일 실패를 확인한다**

Run: `./gradlew compileTestJava -q`
Expected: `CouncilTextLimits` 심볼을 찾을 수 없어 실패.

- [ ] **Step 3: 헬퍼를 구현한다**

`src/main/java/com/kdb/it/domain/council/entity/CouncilTextLimits.java`:

```java
package com.kdb.it.domain.council.entity;

import com.kdb.it.common.util.Utf8ByteLimit;

/**
 * 협의회 엔티티가 JDBC 호출 전에 문자열 컬럼의 UTF-8 바이트 한도를 검증할 때 쓰는 공통 헬퍼입니다.
 *
 * <p>ITPOWN의 VARCHAR2는 BYTE semantics라 글자 수가 아니라 바이트로 판정합니다. 예산 엔티티의 스냅샷 이름 검증과 같은 메시지 형식을 씁니다.
 */
final class CouncilTextLimits {

    private CouncilTextLimits() {}

    /**
     * 값이 한도를 넘으면 예외를 던집니다. {@code null}과 빈 값은 통과합니다.
     *
     * @param entityLabel 사용자에게 보일 엔티티 이름(예: "타당성검토표")
     * @param columnName 컬럼명(예: "ABUS_NCS_CONE")
     * @param value 검사할 값
     * @param maxBytes 허용 최대 바이트
     * @throws IllegalArgumentException UTF-8 바이트 길이가 {@code maxBytes}를 넘는 경우
     */
    static void require(String entityLabel, String columnName, String value, int maxBytes) {
        if (value == null || value.isEmpty()) {
            return;
        }
        int actualBytes = Utf8ByteLimit.length(value);
        if (actualBytes > maxBytes) {
            throw new IllegalArgumentException(
                    "협의회 "
                            + entityLabel
                            + " "
                            + columnName
                            + "은 UTF-8 기준 "
                            + maxBytes
                            + "바이트를 초과할 수 없습니다. (현재: "
                            + actualBytes
                            + "바이트)");
        }
    }
}
```

- [ ] **Step 4: 테스트를 실행한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.entity.CouncilTextLimitsTest' -q`
Expected: 2건 PASS.

- [ ] **Step 5: 포맷 후 커밋한다**

Run: `./gradlew spotlessApply -q && ./gradlew spotlessJavaCheck -q`

```bash
git add src/main/java/com/kdb/it/domain/council/entity/CouncilTextLimits.java src/test/java/com/kdb/it/domain/council/entity/CouncilTextLimitsTest.java
git commit -m "feat(council): 문자열 컬럼 UTF-8 바이트 한도 헬퍼 추가 (COUNCIL-005)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: 엔티티 10개 `@PrePersist/@PreUpdate` 검증

**Files:**
- Modify: `src/main/java/com/kdb/it/domain/council/entity/{Bpovwm,Bperfm,Bchklm,Bevalm,Bplevm,Brsltm,Bpqnam,Bmqnam,Baskpm,Basctm}.java`
- Test: `src/test/java/com/kdb/it/domain/council/entity/CouncilEntityByteLimitTest.java`

**Interfaces:**
- Consumes: Task 1의 `CouncilTextLimits.require(...)`.
- Produces: 각 엔티티의 패키지 전용 `void validateTextLimitsBeforePersist()` (테스트가 리플렉션으로 호출).

- [ ] **Step 1: 엔티티별 거부 테스트를 쓴다**

`src/test/java/com/kdb/it/domain/council/entity/CouncilEntityByteLimitTest.java`:

```java
package com.kdb.it.domain.council.entity;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.function.Supplier;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.test.util.ReflectionTestUtils;

/** 협의회 엔티티 10개가 JPA 콜백에서 문자열 컬럼의 바이트 한도를 검사하는지 검증합니다. */
class CouncilEntityByteLimitTest {

    static Stream<Arguments> cases() {
        return Stream.of(
                Arguments.of("Bpovwm.abusNm", (Supplier<Object>) () -> Bpovwm.builder().build(), "abusNm", 100),
                Arguments.of("Bpovwm.abusTrmCone", (Supplier<Object>) () -> Bpovwm.builder().build(), "abusTrmCone", 300),
                Arguments.of("Bpovwm.abusNcsCone", (Supplier<Object>) () -> Bpovwm.builder().build(), "abusNcsCone", 300),
                Arguments.of("Bpovwm.abusCone", (Supplier<Object>) () -> Bpovwm.builder().build(), "abusCone", 1000),
                Arguments.of("Bpovwm.lwFdtn", (Supplier<Object>) () -> Bpovwm.builder().build(), "lwFdtn", 300),
                Arguments.of("Bpovwm.dgogPpoCone", (Supplier<Object>) () -> Bpovwm.builder().build(), "dgogPpoCone", 4000),
                Arguments.of("Bperfm.evlDtpNm", (Supplier<Object>) () -> Bperfm.builder().build(), "evlDtpNm", 100),
                Arguments.of("Bperfm.evlDtpDfntCone", (Supplier<Object>) () -> Bperfm.builder().build(), "evlDtpDfntCone", 4000),
                Arguments.of("Bperfm.evlDtpClfCone", (Supplier<Object>) () -> Bperfm.builder().build(), "evlDtpClfCone", 4000),
                Arguments.of("Bperfm.evlDtpMsmPtmCone", (Supplier<Object>) () -> Bperfm.builder().build(), "evlDtpMsmPtmCone", 300),
                Arguments.of("Bperfm.evlDtpMsmCleCone", (Supplier<Object>) () -> Bperfm.builder().build(), "evlDtpMsmCleCone", 300),
                Arguments.of("Bchklm.ckgOpnn", (Supplier<Object>) () -> Bchklm.builder().build(), "ckgOpnn", 1000),
                Arguments.of("Bevalm.ckgOpnn", (Supplier<Object>) () -> Bevalm.builder().build(), "ckgOpnn", 1000),
                Arguments.of("Bplevm.evalOpnn", (Supplier<Object>) () -> Bplevm.builder().build(), "evalOpnn", 1000),
                Arguments.of("Brsltm.synOpnn", (Supplier<Object>) () -> Brsltm.builder().build(), "synOpnn", 6000),
                Arguments.of("Brsltm.ckgOpnn", (Supplier<Object>) () -> Brsltm.builder().build(), "ckgOpnn", 1000),
                Arguments.of("Bpqnam.qtnCone", (Supplier<Object>) () -> Bpqnam.builder().build(), "qtnCone", 4000),
                Arguments.of("Bpqnam.repCone", (Supplier<Object>) () -> Bpqnam.builder().build(), "repCone", 2000),
                Arguments.of("Bmqnam.qtnCone", (Supplier<Object>) () -> Bmqnam.builder().build(), "qtnCone", 4000),
                Arguments.of("Bmqnam.repCone", (Supplier<Object>) () -> Bmqnam.builder().build(), "repCone", 2000),
                Arguments.of("Baskpm.cgprOpnnCone", (Supplier<Object>) () -> Baskpm.builder().build(), "cgprOpnnCone", 4000),
                Arguments.of("Basctm.cnrcPlc", (Supplier<Object>) () -> Basctm.builder().build(), "cnrcPlc", 100),
                Arguments.of("Basctm.prtyIvgOmtRsn", (Supplier<Object>) () -> Basctm.builder().build(), "prtyIvgOmtRsn", 200));
    }

    @ParameterizedTest(name = "{0} ≤ {3}B")
    @MethodSource("cases")
    void acceptsBoundaryAndRejectsOverLimit(
            String name, Supplier<Object> factory, String field, int maxBytes) {
        Object entity = factory.get();
        // 한글 1자 = 3바이트. maxBytes/3 자는 한도 이하, +1자는 한도 초과
        ReflectionTestUtils.setField(entity, field, "가".repeat(maxBytes / 3));
        assertThatCode(() -> ReflectionTestUtils.invokeMethod(entity, "validateTextLimitsBeforePersist"))
                .doesNotThrowAnyException();
        ReflectionTestUtils.setField(entity, field, "가".repeat(maxBytes / 3 + 1));
        assertThatThrownBy(() -> ReflectionTestUtils.invokeMethod(entity, "validateTextLimitsBeforePersist"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(String.valueOf(maxBytes));
    }
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.entity.CouncilEntityByteLimitTest' -q`
Expected: 23건 전부 FAIL — `validateTextLimitsBeforePersist` 메서드 없음.

- [ ] **Step 3: 엔티티 10개에 검증 메서드를 추가한다**

각 파일에 import 두 줄을 추가한다(Spotless가 정렬한다):

```java
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
```

각 클래스의 마지막 필드 선언 뒤(첫 메서드 앞)에 상수와 메서드를 넣는다.

`Bpovwm.java`:

```java
    private static final int ABUS_NM_MAX_BYTES = 100;
    private static final int ABUS_TRM_CONE_MAX_BYTES = 300;
    private static final int ABUS_NCS_CONE_MAX_BYTES = 300;
    private static final int ABUS_CONE_MAX_BYTES = 1000;
    private static final int LW_FDTN_MAX_BYTES = 300;
    private static final int DGOG_PPO_CONE_MAX_BYTES = 4000;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("타당성검토표", "ABUS_NM", abusNm, ABUS_NM_MAX_BYTES);
        CouncilTextLimits.require("타당성검토표", "ABUS_TRM_CONE", abusTrmCone, ABUS_TRM_CONE_MAX_BYTES);
        CouncilTextLimits.require("타당성검토표", "ABUS_NCS_CONE", abusNcsCone, ABUS_NCS_CONE_MAX_BYTES);
        CouncilTextLimits.require("타당성검토표", "ABUS_CONE", abusCone, ABUS_CONE_MAX_BYTES);
        CouncilTextLimits.require("타당성검토표", "LW_FDTN", lwFdtn, LW_FDTN_MAX_BYTES);
        CouncilTextLimits.require("타당성검토표", "DGOG_PPO_CONE", dgogPpoCone, DGOG_PPO_CONE_MAX_BYTES);
    }
```

`Bperfm.java`:

```java
    private static final int EVL_DTP_NM_MAX_BYTES = 100;
    private static final int EVL_DTP_DFNT_CONE_MAX_BYTES = 4000;
    private static final int EVL_DTP_CLF_CONE_MAX_BYTES = 4000;
    private static final int EVL_DTP_MSM_PTM_CONE_MAX_BYTES = 300;
    private static final int EVL_DTP_MSM_CLE_CONE_MAX_BYTES = 300;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("성과지표", "EVL_DTP_NM", evlDtpNm, EVL_DTP_NM_MAX_BYTES);
        CouncilTextLimits.require("성과지표", "EVL_DTP_DFNT_CONE", evlDtpDfntCone, EVL_DTP_DFNT_CONE_MAX_BYTES);
        CouncilTextLimits.require("성과지표", "EVL_DTP_CLF_CONE", evlDtpClfCone, EVL_DTP_CLF_CONE_MAX_BYTES);
        CouncilTextLimits.require("성과지표", "EVL_DTP_MSM_PTM_CONE", evlDtpMsmPtmCone, EVL_DTP_MSM_PTM_CONE_MAX_BYTES);
        CouncilTextLimits.require("성과지표", "EVL_DTP_MSM_CLE_CONE", evlDtpMsmCleCone, EVL_DTP_MSM_CLE_CONE_MAX_BYTES);
    }
```

`Bchklm.java`:

```java
    private static final int CKG_OPNN_CONE_MAX_BYTES = 1000;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("자체점검", "CKG_OPNN_CONE", ckgOpnn, CKG_OPNN_CONE_MAX_BYTES);
    }
```

`Bevalm.java`:

```java
    private static final int CKG_OPNN_CONE_MAX_BYTES = 1000;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("평가의견", "CKG_OPNN_CONE", ckgOpnn, CKG_OPNN_CONE_MAX_BYTES);
    }
```

`Bplevm.java`:

```java
    private static final int CKG_OPNN_CONE_MAX_BYTES = 1000;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("계획평가", "CKG_OPNN_CONE", evalOpnn, CKG_OPNN_CONE_MAX_BYTES);
    }
```

`Brsltm.java`:

```java
    private static final int SYN_OPNN_CONE_MAX_BYTES = 6000;
    private static final int CKG_OPNN_CONE_MAX_BYTES = 1000;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("결과서", "SYN_OPNN_CONE", synOpnn, SYN_OPNN_CONE_MAX_BYTES);
        CouncilTextLimits.require("결과서", "CKG_OPNN_CONE", ckgOpnn, CKG_OPNN_CONE_MAX_BYTES);
    }
```

`Bpqnam.java`:

```java
    private static final int QTN_CONE_MAX_BYTES = 4000;
    private static final int REP_CONE_MAX_BYTES = 2000;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("사전질의응답", "QTN_CONE", qtnCone, QTN_CONE_MAX_BYTES);
        CouncilTextLimits.require("사전질의응답", "REP_CONE", repCone, REP_CONE_MAX_BYTES);
    }
```

`Bmqnam.java`:

```java
    private static final int QTN_CONE_MAX_BYTES = 4000;
    private static final int REP_CONE_MAX_BYTES = 2000;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("주요질의응답", "QTN_CONE", qtnCone, QTN_CONE_MAX_BYTES);
        CouncilTextLimits.require("주요질의응답", "REP_CONE", repCone, REP_CONE_MAX_BYTES);
    }
```

`Baskpm.java`:

```java
    private static final int CGPR_OPNN_CONE_MAX_BYTES = 4000;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("생략요청", "CGPR_OPNN_CONE", cgprOpnnCone, CGPR_OPNN_CONE_MAX_BYTES);
    }
```

`Basctm.java`:

```java
    private static final int CNRC_PLC_NM_MAX_BYTES = 100;
    private static final int PRTY_IVG_OMT_RSN_MAX_BYTES = 200;

    /** 어떤 저장 경로든 JDBC 호출 전에 문자열 컬럼의 BYTE 한도를 검증합니다. */
    @PrePersist
    @PreUpdate
    void validateTextLimitsBeforePersist() {
        CouncilTextLimits.require("협의회", "CNRC_PLC_NM", cnrcPlc, CNRC_PLC_NM_MAX_BYTES);
        CouncilTextLimits.require("협의회", "PRTY_IVG_OMT_RSN", prtyIvgOmtRsn, PRTY_IVG_OMT_RSN_MAX_BYTES);
    }
```

- [ ] **Step 4: 테스트와 council 도메인 회귀를 실행한다**

Run: `./gradlew test --tests 'com.kdb.it.domain.council.*' -q`
Expected: `CouncilEntityByteLimitTest` 23건 포함 전부 PASS. 기존 엔티티 테스트가 `ReflectionTestUtils.setField`로 한도 초과 값을 넣고 저장하는 케이스가 있으면 이 단계에서 드러난다 — 그 경우 해당 테스트의 값을 한도 이하로 줄인다(검증 자체를 우회하지 않는다).

- [ ] **Step 5: 포맷 후 커밋한다**

Run: `./gradlew spotlessApply -q && ./gradlew spotlessJavaCheck -q`

```bash
git add src/main/java/com/kdb/it/domain/council/entity/Bpovwm.java src/main/java/com/kdb/it/domain/council/entity/Bperfm.java src/main/java/com/kdb/it/domain/council/entity/Bchklm.java src/main/java/com/kdb/it/domain/council/entity/Bevalm.java src/main/java/com/kdb/it/domain/council/entity/Bplevm.java src/main/java/com/kdb/it/domain/council/entity/Brsltm.java src/main/java/com/kdb/it/domain/council/entity/Bpqnam.java src/main/java/com/kdb/it/domain/council/entity/Bmqnam.java src/main/java/com/kdb/it/domain/council/entity/Baskpm.java src/main/java/com/kdb/it/domain/council/entity/Basctm.java src/test/java/com/kdb/it/domain/council/entity/CouncilEntityByteLimitTest.java
git commit -m "feat(council): 협의회 엔티티 10개에 문자열 컬럼 BYTE 한도 검증 추가 (COUNCIL-005)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 프론트 한도 단일 출처와 회의장소 결합 함수

**Files:**
- Create: `app/features/council/councilFormLimits.ts`
- Create: `app/features/council/meetingPlace.ts`
- Test: `tests/unit/features/council/councilFormLimits.test.ts`
- Test: `tests/unit/features/council/meetingPlace.test.ts`

**Interfaces:**
- Consumes: `~/utils/textLength`의 `isDatabaseTextWithinByteLimit(value, maxBytes)`.
- Produces:
  - `export const councilFormLimits` (아래 형태, `as const`)
  - `export const joinMeetingPlace = (place1: string, place2: string): string`
  - `export const isMeetingPlaceWithinLimit = (joined: string): boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/unit/features/council/councilFormLimits.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { councilFormLimits } from '~/features/council/councilFormLimits';

/** 값은 it_database DDL(BYTE semantics)과 같아야 한다. 바뀌면 백엔드 엔티티 상수도 함께 바꾼다. */
describe('councilFormLimits', () => {
    it('타당성검토표 개요 한도는 BPOVWM 컬럼과 같다', () => {
        expect(councilFormLimits.feasibility).toEqual({
            projectName: { maxBytes: 100 },
            period: { maxBytes: 300 },
            necessity: { maxBytes: 300 },
            description: { maxBytes: 1000 },
            legalBasis: { maxBytes: 300 },
            expectedEffect: { maxBytes: 4000 },
        });
    });

    it('성과지표 한도는 BPERFM 컬럼과 같다', () => {
        expect(councilFormLimits.performance).toEqual({
            indicatorName: { maxBytes: 100 },
            definition: { maxBytes: 4000 },
            formula: { maxBytes: 4000 },
            measurePoint: { maxBytes: 300 },
            measureCycle: { maxBytes: 300 },
        });
    });

    it('의견·질의응답·사유·장소 한도는 각 테이블 컬럼과 같다', () => {
        expect(councilFormLimits.selfCheckOpinion.maxBytes).toBe(1000);
        expect(councilFormLimits.evaluationOpinion.maxBytes).toBe(1000);
        expect(councilFormLimits.planEvaluationOpinion.maxBytes).toBe(1000);
        expect(councilFormLimits.result).toEqual({
            overallOpinion: { maxBytes: 6000 },
            feasibilityOpinion: { maxBytes: 1000 },
        });
        expect(councilFormLimits.qna).toEqual({
            question: { maxBytes: 4000 },
            reply: { maxBytes: 2000 },
        });
        expect(councilFormLimits.skipRequestReason.maxBytes).toBe(4000);
        expect(councilFormLimits.meetingPlace.maxBytes).toBe(100);
        expect(councilFormLimits.skipDecisionReason.maxBytes).toBe(200);
    });
});
```

`tests/unit/features/council/meetingPlace.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isMeetingPlaceWithinLimit, joinMeetingPlace } from '~/features/council/meetingPlace';

describe('joinMeetingPlace', () => {
    it('두 장소를 " / "로 잇고 공백만 있는 값은 뺀다', () => {
        expect(joinMeetingPlace(' 본관 3층 ', '')).toBe('본관 3층');
        expect(joinMeetingPlace('본관 3층', ' 화상회의 ')).toBe('본관 3층 / 화상회의');
        expect(joinMeetingPlace('', '')).toBe('');
    });
});

describe('isMeetingPlaceWithinLimit', () => {
    it('결합 문자열이 CNRC_PLC_NM 100바이트를 넘으면 거짓이다', () => {
        // 한글 33자(99B)는 통과, 각 17자를 " / "로 이으면 51*2+3=105B라 거부
        expect(isMeetingPlaceWithinLimit('가'.repeat(33))).toBe(true);
        expect(isMeetingPlaceWithinLimit(joinMeetingPlace('가'.repeat(17), '가'.repeat(17)))).toBe(false);
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/unit/features/council`
Expected: 모듈을 찾을 수 없어 FAIL.

- [ ] **Step 3: 두 파일을 만든다**

`app/features/council/councilFormLimits.ts`:

```ts
/**
 * 협의회 입력 컬럼의 운영 DB UTF-8 Byte 제한을 모은 단일 출처입니다.
 *
 * 값은 it_database DDL(BYTE semantics)과 같고, 백엔드는 각 엔티티의 `*_MAX_BYTES` 상수로 같은 값을 검사합니다.
 * 한 쪽을 바꾸면 다른 쪽도 함께 바꿉니다.
 */
export const councilFormLimits = {
    /** 타당성검토표 개요 — TPRMPP_BPOVWM */
    feasibility: {
        projectName: { maxBytes: 100 }, // ABUS_NM
        period: { maxBytes: 300 }, // ABUS_TRM_CONE
        necessity: { maxBytes: 300 }, // ABUS_NCS_CONE
        description: { maxBytes: 1000 }, // ABUS_CONE
        legalBasis: { maxBytes: 300 }, // LW_FDTN
        expectedEffect: { maxBytes: 4000 }, // DGOG_PPO_CONE
    },
    /** 성과지표 — TPRMPP_BPERFM */
    performance: {
        indicatorName: { maxBytes: 100 }, // EVL_DTP_NM
        definition: { maxBytes: 4000 }, // EVL_DTP_DFNT_CONE
        formula: { maxBytes: 4000 }, // EVL_DTP_CLF_CONE
        measurePoint: { maxBytes: 300 }, // EVL_DTP_MSM_PTM_CONE
        measureCycle: { maxBytes: 300 }, // EVL_DTP_MSM_CLE_CONE
    },
    /** 자체점검 의견 — TPRMPP_BCHKLM.CKG_OPNN_CONE */
    selfCheckOpinion: { maxBytes: 1000 },
    /** 평가위원 평가의견 — TPRMPP_BEVALM.CKG_OPNN_CONE */
    evaluationOpinion: { maxBytes: 1000 },
    /** 계획협의회 평가의견 — TPRMPP_BPLEVM.CKG_OPNN_CONE */
    planEvaluationOpinion: { maxBytes: 1000 },
    /** 결과서 — TPRMPP_BRSLTM */
    result: {
        overallOpinion: { maxBytes: 6000 }, // SYN_OPNN_CONE
        feasibilityOpinion: { maxBytes: 1000 }, // CKG_OPNN_CONE
    },
    /** 사전·주요 질의응답 — TPRMPP_BPQNAM / TPRMPP_BMQNAM */
    qna: {
        question: { maxBytes: 4000 }, // QTN_CONE
        reply: { maxBytes: 2000 }, // REP_CONE
    },
    /** 생략 판정 요청 사유 — TPRMPP_BASKPM.CGPR_OPNN_CONE */
    skipRequestReason: { maxBytes: 4000 },
    /** 회의장소(두 입력 결합 후) — TPRMPP_BASCTM.CNRC_PLC_NM */
    meetingPlace: { maxBytes: 100 },
    /** 생략 판정 사유 — TPRMPP_BASCTM.PRTY_IVG_OMT_RSN */
    skipDecisionReason: { maxBytes: 200 },
} as const;
```

`app/features/council/meetingPlace.ts`:

```ts
import { isDatabaseTextWithinByteLimit } from '~/utils/textLength';
import { councilFormLimits } from '~/features/council/councilFormLimits';

/** 두 회의장소를 PRD §22 규칙대로 " / "로 잇습니다. 공백만 있는 값은 뺍니다. */
export const joinMeetingPlace = (place1: string, place2: string): string =>
    [place1, place2]
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .join(' / ');

/** 결합된 회의장소가 CNRC_PLC_NM(100 BYTE)에 들어가는지 판정합니다. */
export const isMeetingPlaceWithinLimit = (joined: string): boolean =>
    isDatabaseTextWithinByteLimit(joined, councilFormLimits.meetingPlace.maxBytes);
```

- [ ] **Step 4: 테스트를 실행한다**

Run: `npx vitest run tests/unit/features/council`
Expected: 5건 PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add app/features/council/councilFormLimits.ts app/features/council/meetingPlace.ts tests/unit/features/council/councilFormLimits.test.ts tests/unit/features/council/meetingPlace.test.ts
git commit -m "feat(council): 협의회 입력 바이트 한도 단일 출처와 회의장소 결합 함수 추가 (COUNCIL-005)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: 자리표시자의 글자 수 접미 제거 (사용자 승인 완료)

**Files:**
- Modify: `i18n/messages/council.ts`

**Interfaces:**
- Produces: 아래 키의 문구에서 `{max}` 파라미터가 사라진다. Task 5~7의 템플릿은 `t(key)`만 호출한다.

- [ ] **Step 1: 대상 키를 확인한다**

Run: `grep -nE '\(최대 \{max\}자\)|\(up to \{max\} characters\)' i18n/messages/council.ts`
Expected: ko 8줄(`evaluationForm.opinionPlaceholder`, `feasibility.overview.necessityPlaceholder`·`descriptionPlaceholder`·`expectedEffectPlaceholder`, `feasibility.selfCheck.opinionPlaceholder`, `qna.replyPlaceholder`, `planCouncil.reasonPlaceholder`, `resultForm.feasibilityOpinionPlaceholder`)과 en 대응 줄, 그리고 `requestDetail.skipReasonPlaceholder`가 `{max}`를 쓰면 그 줄도 포함.

- [ ] **Step 2: 접미를 제거한다**

각 줄에서 다음 부분 문자열만 지운다(문장 본문·말줄임표는 유지).

- ko: `' (최대 {max}자)'` → 빈 문자열
- en: `' (up to {max} characters)'` → 빈 문자열
- `skipReasonPlaceholder`가 다른 형태로 `{max}`를 쓰면 같은 규칙으로 `{max}`가 든 괄호 절만 지운다.

예: `'사업의 필요성을 입력하세요 (최대 {max}자)'` → `'사업의 필요성을 입력하세요'`.

- [ ] **Step 3: 남은 참조가 없는지 확인하고 형식을 맞춘다**

Run: `grep -nE '\{max\}' i18n/messages/council.ts; npm run format:check`
Expected: `{max}` 0건(있으면 Step 2를 다시 적용). 포맷 통과.

- [ ] **Step 4: 커밋한다**

```bash
git add i18n/messages/council.ts
git commit -m "chore(council): 협의회 자리표시자의 글자 수 안내 제거 — 바이트 인디케이터로 대체 (COUNCIL-005)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 타당성검토표 개요·성과지표·자체점검 (네이티브 입력)

**Files:**
- Modify: `app/components/council/feasibility/FeasibilityOverview.vue`
- Modify: `app/components/council/feasibility/FeasibilityPerformance.vue`
- Modify: `app/components/council/feasibility/FeasibilitySelfCheck.vue`
- Test: `tests/unit/components/council/FeasibilityOverview-byte-limit.test.ts`

**Interfaces:**
- Consumes: Task 3의 `councilFormLimits`; 공통 `useDatabaseByteLimit().acceptText(value, maxBytes): boolean`, `restoreRejectedInput(event, currentValue, maxBytes)`; `TextLengthIndicator` props `value`, `maxBytes`.
- Produces: 세 컴포넌트의 외부 계약(props/emit)은 그대로.

- [ ] **Step 1: 개요 컴포넌트 거부·복원 테스트를 쓴다**

`tests/unit/components/council/FeasibilityOverview-byte-limit.test.ts`:

```ts
/**
 * 타당성검토표 개요의 네이티브 입력이 DB BYTE 한도를 넘는 값을 모델에 반영하지 않는지 검증합니다.
 * 바이트 계산·토스트 규칙은 useDatabaseByteLimit 테스트가 담당하므로 여기서는 emit 여부만 관찰합니다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import FeasibilityOverview from '~/components/council/feasibility/FeasibilityOverview.vue';

const toastAdd = vi.fn();
/** 한글 1자는 UTF-8 3Byte — n자로 3n Byte 문자열을 만듭니다. */
const hangul = (count: number) => '가'.repeat(count);

const InputTextStub = defineComponent({
    props: { value: { type: String, default: '' } },
    template: '<input :value="value" />',
});
const TextareaStub = defineComponent({
    props: { value: { type: String, default: '' } },
    template: '<textarea :value="value"></textarea>',
});
const PassthroughStub = defineComponent({ template: '<div><slot /></div>' });

const baseModel = {
    prjNm: '',
    prjTrm: '',
    ncs: '',
    prjBg: null,
    edrt: '',
    prjDes: '',
    lglRglYn: 'N',
    lglRglNm: null,
    xptEff: '',
};

const mountOverview = () =>
    mount(FeasibilityOverview, {
        props: { modelValue: { ...baseModel }, readonly: false },
        global: {
            stubs: {
                InputText: InputTextStub,
                Textarea: TextareaStub,
                InputNumber: PassthroughStub,
                Select: PassthroughStub,
                RadioButton: PassthroughStub,
                TextLengthIndicator: PassthroughStub,
            },
        },
    });

describe('FeasibilityOverview 바이트 한도', () => {
    beforeEach(() => {
        toastAdd.mockClear();
        vi.stubGlobal('useToast', () => ({ add: toastAdd }));
    });

    it('필요성(300B)은 한글 100자를 반영하고 101자는 거부한다', async () => {
        const wrapper = mountOverview();
        const necessity = wrapper.findAll('textarea')[0]!;
        await necessity.setValue(hangul(100));
        expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({ ncs: hangul(100) });
        const before = wrapper.emitted('update:modelValue')?.length ?? 0;
        await necessity.setValue(hangul(101));
        expect(wrapper.emitted('update:modelValue')?.length ?? 0).toBe(before);
        expect(toastAdd).toHaveBeenCalledTimes(1);
    });

    it('사업명(100B)은 한글 34자를 거부한다', async () => {
        const wrapper = mountOverview();
        const name = wrapper.findAll('input')[0]!;
        await name.setValue(hangul(34));
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
        expect(toastAdd).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run tests/unit/components/council/FeasibilityOverview-byte-limit.test.ts`
Expected: FAIL — 현재는 `maxlength`만 있어 101자·34자가 그대로 emit된다.

- [ ] **Step 3: `FeasibilityOverview.vue`를 수정한다**

script의 `import { stripHtml } from '~/utils/common';` 아래에 추가:

```ts
import TextLengthIndicator from '~/components/common/TextLengthIndicator.vue';
import { useDatabaseByteLimit } from '~/composables/useDatabaseByteLimit';
import { councilFormLimits } from '~/features/council/councilFormLimits';
```

`const update = (...)` 정의 바로 아래에 추가:

```ts
const limits = councilFormLimits.feasibility;
const { acceptText, restoreRejectedInput } = useDatabaseByteLimit();

/** 바이트 한도를 넘는 입력은 모델에 반영하지 않고 입력창을 마지막 승인값으로 되돌린다. */
const updateText = (
    field: 'prjNm' | 'prjTrm' | 'ncs' | 'lglRglNm' | 'xptEff',
    event: Event,
    maxBytes: number,
) => {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (acceptText(value, maxBytes)) update(field, value);
    else restoreRejectedInput(event, String(props.modelValue[field] ?? ''), maxBytes);
};
```

기존 `prjDesEdit` computed(주석 포함)를 다음으로 교체한다:

```ts
/**
 * 편집 모드 사업내용 입력.
 *
 * <p>사업내용은 사업 등록 화면의 리치에디터(Tiptap) HTML로 프리필되므로, 편집용 Textarea에도 읽기 전용과 동일하게
 * HTML 태그를 제거한 순수 텍스트를 표시한다(원시 &lt;p&gt; 노출 방지). 입력 시에는 순수 텍스트로 저장하여 화면
 * 표시값과 저장값을 일치시키고, ABUS_CONE 바이트 한도를 넘는 입력은 반영하지 않는다.</p>
 */
const onPrjDesInput = (event: Event) => {
    const value = (event.target as HTMLTextAreaElement).value;
    if (acceptText(value, limits.description.maxBytes)) update('prjDes', value);
    else restoreRejectedInput(event, prjDesPlain.value, limits.description.maxBytes);
};
```

템플릿 6곳을 바꾼다. 각 입력의 `md:col-span-3` div 안, 입력 요소 바로 아래에 인디케이터를 넣는다.

사업명:

```vue
<InputText
    :value="modelValue.prjNm"
    :disabled="readonly"
    :placeholder="t('council.feasibility.overview.projectNamePlaceholder')"
    fluid
    @input="updateText('prjNm', $event, limits.projectName.maxBytes)"
/>
<TextLengthIndicator :value="modelValue.prjNm" :max-bytes="limits.projectName.maxBytes" />
```

사업기간: `@input="updateText('prjTrm', $event, limits.period.maxBytes)"` + `<TextLengthIndicator :value="modelValue.prjTrm" :max-bytes="limits.period.maxBytes" />`

필요성(`:maxlength="1000"` 제거, 자리표시자 인자 제거):

```vue
<Textarea
    :value="modelValue.ncs"
    :disabled="readonly"
    :placeholder="t('council.feasibility.overview.necessityPlaceholder')"
    rows="4"
    fluid
    @input="updateText('ncs', $event, limits.necessity.maxBytes)"
/>
<TextLengthIndicator :value="modelValue.ncs" :max-bytes="limits.necessity.maxBytes" />
```

사업내용(편집 분기):

```vue
<Textarea
    v-else
    :value="prjDesPlain"
    :placeholder="t('council.feasibility.overview.descriptionPlaceholder')"
    rows="4"
    fluid
    @input="onPrjDesInput($event)"
/>
<TextLengthIndicator v-if="!readonly" :value="prjDesPlain" :max-bytes="limits.description.maxBytes" />
```

법률근거: `@input="updateText('lglRglNm', $event, limits.legalBasis.maxBytes)"` + `<TextLengthIndicator :value="modelValue.lglRglNm ?? ''" :max-bytes="limits.legalBasis.maxBytes" />`

기대효과(`:maxlength="1000"` 제거, 자리표시자 인자 제거): `:placeholder="t('council.feasibility.overview.expectedEffectPlaceholder')"`, `@input="updateText('xptEff', $event, limits.expectedEffect.maxBytes)"` + `<TextLengthIndicator :value="modelValue.xptEff" :max-bytes="limits.expectedEffect.maxBytes" />`

- [ ] **Step 4: `FeasibilityPerformance.vue`를 수정한다**

`import type { PerformanceItem } from '~/types/council';` 아래에 추가:

```ts
import TextLengthIndicator from '~/components/common/TextLengthIndicator.vue';
import { useDatabaseByteLimit } from '~/composables/useDatabaseByteLimit';
import { councilFormLimits } from '~/features/council/councilFormLimits';
```

`const updateField = (...)` 정의 아래에 추가:

```ts
const limits = councilFormLimits.performance;
const { acceptText, restoreRejectedInput } = useDatabaseByteLimit();

/** 바이트 한도를 넘는 입력은 행에 반영하지 않고 입력창을 마지막 승인값으로 되돌린다. */
const updateText = (
    index: number,
    field: 'dtpNm' | 'dtpCone' | 'clf' | 'msmTpm' | 'msmCle',
    event: Event,
    maxBytes: number,
) => {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    if (acceptText(value, maxBytes)) updateField(index, field, value);
    else restoreRejectedInput(event, props.modelValue[index]?.[field] ?? '', maxBytes);
};
```

템플릿 5곳의 `@input="updateField(index, '<field>', ($event.target as ...).value)"`를 다음으로 바꾸고 입력 아래에 인디케이터를 넣는다.

| 필드 | 새 `@input` | 인디케이터 |
| --- | --- | --- |
| `dtpNm` | `updateText(index, 'dtpNm', $event, limits.indicatorName.maxBytes)` | `<TextLengthIndicator :value="item.dtpNm" :max-bytes="limits.indicatorName.maxBytes" />` |
| `dtpCone` | `updateText(index, 'dtpCone', $event, limits.definition.maxBytes)` | `<TextLengthIndicator :value="item.dtpCone" :max-bytes="limits.definition.maxBytes" />` |
| `clf` | `updateText(index, 'clf', $event, limits.formula.maxBytes)` | `<TextLengthIndicator :value="item.clf" :max-bytes="limits.formula.maxBytes" />` |
| `msmTpm` | `updateText(index, 'msmTpm', $event, limits.measurePoint.maxBytes)` | `<TextLengthIndicator :value="item.msmTpm" :max-bytes="limits.measurePoint.maxBytes" />` |
| `msmCle` | `updateText(index, 'msmCle', $event, limits.measureCycle.maxBytes)` | `<TextLengthIndicator :value="item.msmCle" :max-bytes="limits.measureCycle.maxBytes" />` |

- [ ] **Step 5: `FeasibilitySelfCheck.vue`를 수정한다**

`import type { CheckItemCode, FeasibilitySelfCheckItem } from '~/types/council';` 아래에 추가:

```ts
import TextLengthIndicator from '~/components/common/TextLengthIndicator.vue';
import { useDatabaseByteLimit } from '~/composables/useDatabaseByteLimit';
import { councilFormLimits } from '~/features/council/councilFormLimits';
```

`const updateField = (...)` 정의 아래에 추가:

```ts
const opinionLimit = councilFormLimits.selfCheckOpinion.maxBytes;
const { acceptText, restoreRejectedInput } = useDatabaseByteLimit();

/** 점검의견은 BCHKLM.CKG_OPNN_CONE 바이트 한도 안에서만 반영한다. */
const onOpinionInput = (item: FeasibilitySelfCheckItem, event: Event) => {
    const value = (event.target as HTMLTextAreaElement).value;
    if (acceptText(value, opinionLimit)) updateField(item.ckgItmC, 'ckgOpnn', value);
    else restoreRejectedInput(event, item.ckgOpnn, opinionLimit);
};
```

점검의견 `Textarea`에서 `maxlength="1000"`을 지우고, `:placeholder`를 `t('council.feasibility.selfCheck.opinionPlaceholder')`로, 기존 `@input="updateField(item.ckgItmC, 'ckgOpnn', ...)"` 속성 전체를 `@input="onOpinionInput(item, $event)"`로 바꾼다. Textarea 바로 아래에 추가:

```vue
<TextLengthIndicator :value="item.ckgOpnn" :max-bytes="opinionLimit" />
```

- [ ] **Step 6: 테스트·타입·포맷을 확인한다**

Run: `npx vitest run tests/unit/components/council/FeasibilityOverview-byte-limit.test.ts tests/unit/components/council && npm run check && npm run format:check`
Expected: 신규 2건 PASS, 기존 협의회 컴포넌트 테스트 PASS, 타입·린트·포맷 통과. 포맷 실패면 `npm run format`을 실행한다.

- [ ] **Step 7: 커밋한다**

```bash
git add app/components/council/feasibility/FeasibilityOverview.vue app/components/council/feasibility/FeasibilityPerformance.vue app/components/council/feasibility/FeasibilitySelfCheck.vue tests/unit/components/council/FeasibilityOverview-byte-limit.test.ts
git commit -m "feat(council): 타당성검토표 개요·성과지표·자체점검 입력을 바이트 한도로 제한 (COUNCIL-005)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 평가의견·계획평가·결과서·질의응답 (`v-model` 입력)

**Files:**
- Modify: `app/components/council/evaluation/EvaluationForm.vue`
- Modify: `app/components/council/plan/PlanPprtForm.vue`
- Modify: `app/components/council/result/ResultForm.vue`
- Modify: `app/components/council/qna/CouncilQna.vue`
- Modify: `app/components/council/mainqna/MainQnaSection.vue`

**Interfaces:**
- Consumes: Task 3의 `councilFormLimits`; `useDatabaseByteLimit().createModel(get, set, maxBytes)`, `acceptText`, `restoreRejectedInput`; `TextLengthIndicator`.
- Produces: 외부 계약 불변.

- [ ] **Step 1: `EvaluationForm.vue` (배열 항목 `item.ckgOpnn`)**

`import { useToast } from 'primevue/usetoast';` 아래에 추가:

```ts
import TextLengthIndicator from '~/components/common/TextLengthIndicator.vue';
import { useDatabaseByteLimit } from '~/composables/useDatabaseByteLimit';
import { councilFormLimits } from '~/features/council/councilFormLimits';
```

script 안(다른 `const` 선언들 뒤)에 추가:

```ts
const opinionLimit = councilFormLimits.evaluationOpinion.maxBytes;
const { acceptText, restoreRejectedInput } = useDatabaseByteLimit();
```

`v-model="item.ckgOpnn"` Textarea를 다음으로 바꾼다(`maxlength="1000"`·자리표시자 인자 제거, 나머지 속성은 유지):

```vue
<Textarea
    v-if="editMode"
    :model-value="item.ckgOpnn"
    rows="3"
    :placeholder="t('council.evaluationForm.opinionPlaceholder')"
    class="w-full text-sm"
    auto-resize
    :class="
        item.ckgRcrd !== null && item.ckgRcrd <= 2 && !item.ckgOpnn.trim()
            ? 'border-amber-400 dark:border-amber-600'
            : ''
    "
    @update:model-value="(value) => acceptText(value ?? '', opinionLimit) && (item.ckgOpnn = value ?? '')"
    @input="restoreRejectedInput($event, item.ckgOpnn, opinionLimit)"
/>
<TextLengthIndicator v-if="editMode" :value="item.ckgOpnn" :max-bytes="opinionLimit" />
```

기존 `:class` 표현식이 위와 다르면 기존 것을 그대로 둔다.

- [ ] **Step 2: `PlanPprtForm.vue` (배열 항목 `row.evalOpnn`)**

`import { useToast } from 'primevue/usetoast';` 아래에 같은 세 import를 추가하고 script에 추가:

```ts
const opinionLimit = councilFormLimits.planEvaluationOpinion.maxBytes;
const { acceptText, restoreRejectedInput } = useDatabaseByteLimit();
```

`v-model="row.evalOpnn"` Textarea를 다음으로 바꾼다:

```vue
<Textarea
    v-if="editMode"
    :model-value="row.evalOpnn"
    rows="2"
    :placeholder="t('council.planCouncil.reasonPlaceholder')"
    class="w-full text-sm"
    auto-resize
    :class="!row.evalOpnn.trim() ? 'border-amber-400 dark:border-amber-600' : ''"
    @update:model-value="(value) => acceptText(value ?? '', opinionLimit) && (row.evalOpnn = value ?? '')"
    @input="restoreRejectedInput($event, row.evalOpnn, opinionLimit)"
/>
<TextLengthIndicator v-if="editMode" :value="row.evalOpnn" :max-bytes="opinionLimit" />
```

- [ ] **Step 3: `ResultForm.vue` (reactive `form`)**

`import { useRefreshGuard } from '~/composables/useRefreshGuard';` 아래에 같은 세 import를 추가하고, `const form = reactive({...})` 아래에 추가:

```ts
const resultLimits = councilFormLimits.result;
const { createModel, restoreRejectedInput } = useDatabaseByteLimit();
/** 한도 초과 입력은 폼에 반영하지 않는 v-model 대역 */
const guardedSynOpnn = createModel(
    () => form.synOpnn,
    (value) => (form.synOpnn = value),
    resultLimits.overallOpinion.maxBytes,
);
const guardedCkgOpnn = createModel(
    () => form.ckgOpnn,
    (value) => (form.ckgOpnn = value),
    resultLimits.feasibilityOpinion.maxBytes,
);
```

종합의견 Textarea: `v-model="guardedSynOpnn"`, 추가 `@input="restoreRejectedInput($event, form.synOpnn, resultLimits.overallOpinion.maxBytes)"`, 아래에 `<TextLengthIndicator v-if="!readonly" :value="form.synOpnn" :max-bytes="resultLimits.overallOpinion.maxBytes" />`.

타당성검토의견 Textarea: `maxlength="1000"` 제거, `:placeholder="t('council.resultForm.feasibilityOpinionPlaceholder')"`, `v-model="guardedCkgOpnn"`, 추가 `@input="restoreRejectedInput($event, form.ckgOpnn, resultLimits.feasibilityOpinion.maxBytes)"`, 아래에 `<TextLengthIndicator v-if="!readonly" :value="form.ckgOpnn" :max-bytes="resultLimits.feasibilityOpinion.maxBytes" />`.

- [ ] **Step 4: `CouncilQna.vue` (ref `askText`, `replyText`)**

`import { useRefreshGuard } from '~/composables/useRefreshGuard';` 아래에 같은 세 import를 추가한다. `const replyText = ref('');` 선언 바로 아래(두 ref가 모두 선언된 뒤)에 추가:

```ts
const qnaLimits = councilFormLimits.qna;
const { createModel, restoreRejectedInput } = useDatabaseByteLimit();
const guardedAskText = createModel(
    () => askText.value,
    (value) => (askText.value = value),
    qnaLimits.question.maxBytes,
);
const guardedReplyText = createModel(
    () => replyText.value,
    (value) => (replyText.value = value),
    qnaLimits.reply.maxBytes,
);
```

질문 Textarea(`v-model="askText"`): `v-model="guardedAskText"`, 추가 `@input="restoreRejectedInput($event, askText, qnaLimits.question.maxBytes)"`, 아래에 `<TextLengthIndicator :value="askText" :max-bytes="qnaLimits.question.maxBytes" />`.

답변 Textarea(`v-model="replyText"`): `maxlength="2000"` 제거, `:placeholder="t('council.qna.replyPlaceholder')"`, `v-model="guardedReplyText"`, 추가 `@input="restoreRejectedInput($event, replyText, qnaLimits.reply.maxBytes)"`, 아래에 `<TextLengthIndicator :value="replyText" :max-bytes="qnaLimits.reply.maxBytes" />`.

- [ ] **Step 5: `MainQnaSection.vue`**

Step 4와 같은 내용을 적용한다(파일만 다르다): import 세 줄은 `import { useRefreshGuard } from '~/composables/useRefreshGuard';` 아래, guarded 모델 블록은 `const replyText = ref('');` 아래에 동일 코드로 추가하고, 질문·답변 Textarea를 Step 4와 동일하게 바꾼다(답변의 `maxlength="2000"` 제거, 자리표시자 `t('council.qna.replyPlaceholder')`).

- [ ] **Step 6: 타입·테스트·포맷을 확인한다**

Run: `npm run check && npx vitest run tests/unit/components/council tests/unit/composables/council && npm run format:check`
Expected: 통과. 포맷 실패면 `npm run format`.

- [ ] **Step 7: 커밋한다**

```bash
git add app/components/council/evaluation/EvaluationForm.vue app/components/council/plan/PlanPprtForm.vue app/components/council/result/ResultForm.vue app/components/council/qna/CouncilQna.vue app/components/council/mainqna/MainQnaSection.vue
git commit -m "feat(council): 평가의견·계획평가·결과서·질의응답 입력을 바이트 한도로 제한 (COUNCIL-005)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 회의장소·생략 판정 사유·생략요청 사유

**Files:**
- Modify: `app/components/council/schedule/ScheduleStatus.vue`
- Modify: `app/pages/info/council-request/index.vue`
- Modify: `app/pages/info/council-request/[id].vue`

**Interfaces:**
- Consumes: Task 3의 `councilFormLimits`, `joinMeetingPlace`, `isMeetingPlaceWithinLimit`; 공통 `useDatabaseByteLimit`, `TextLengthIndicator`.

- [ ] **Step 1: `ScheduleStatus.vue` — 입력 2개 + 결합 검사**

`import { useRefreshGuard } from '~/composables/useRefreshGuard';` 아래에 추가:

```ts
import TextLengthIndicator from '~/components/common/TextLengthIndicator.vue';
import { useDatabaseByteLimit } from '~/composables/useDatabaseByteLimit';
import { councilFormLimits } from '~/features/council/councilFormLimits';
import { isMeetingPlaceWithinLimit, joinMeetingPlace } from '~/features/council/meetingPlace';
```

`confirmForm` 선언 아래에 추가:

```ts
const placeLimit = councilFormLimits.meetingPlace.maxBytes;
const { acceptText, createModel, restoreRejectedInput } = useDatabaseByteLimit();
const guardedPlace1 = createModel(
    () => confirmForm.cnrcPlc1,
    (value) => (confirmForm.cnrcPlc1 = value),
    placeLimit,
);
const guardedPlace2 = createModel(
    () => confirmForm.cnrcPlc2,
    (value) => (confirmForm.cnrcPlc2 = value),
    placeLimit,
);
/** 저장되는 값은 두 장소를 " / "로 이은 문자열이므로 인디케이터도 결합값 기준으로 보여 준다. */
const combinedPlace = computed(() => joinMeetingPlace(confirmForm.cnrcPlc1, confirmForm.cnrcPlc2));
```

제출 함수에서 기존 결합 코드

```ts
const cnrcPlc = [confirmForm.cnrcPlc1, confirmForm.cnrcPlc2]
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(' / ');
```

를 다음으로 바꾼다(`acceptText`가 초과 시 토스트를 띄운다):

```ts
const cnrcPlc = joinMeetingPlace(confirmForm.cnrcPlc1, confirmForm.cnrcPlc2);
if (!isMeetingPlaceWithinLimit(cnrcPlc)) {
    acceptText(cnrcPlc, placeLimit);
    return;
}
```

템플릿: 회의장소 1 `InputText`를 `v-model="guardedPlace1"` + `@input="restoreRejectedInput($event, confirmForm.cnrcPlc1, placeLimit)"`, 회의장소 2를 `v-model="guardedPlace2"` + `@input="restoreRejectedInput($event, confirmForm.cnrcPlc2, placeLimit)"`로 바꾸고, 회의장소 2 블록 아래에 추가:

```vue
<TextLengthIndicator :value="combinedPlace" :max-bytes="placeLimit" />
```

- [ ] **Step 2: `index.vue` — 생략 판정 사유 (200B)**

import 블록 끝(`import { useRefreshGuard } from '~/composables/useRefreshGuard';` 아래)에 추가:

```ts
import TextLengthIndicator from '~/components/common/TextLengthIndicator.vue';
import { useDatabaseByteLimit } from '~/composables/useDatabaseByteLimit';
import { councilFormLimits } from '~/features/council/councilFormLimits';
```

`const decisionForm = ref<{ omtYn: string; cnfmCone: string }>({ omtYn: '', cnfmCone: '' });` 아래에 추가:

```ts
const decisionReasonLimit = councilFormLimits.skipDecisionReason.maxBytes;
const { createModel, restoreRejectedInput } = useDatabaseByteLimit();
const guardedDecisionReason = createModel(
    () => decisionForm.value.cnfmCone,
    (value) => (decisionForm.value.cnfmCone = value),
    decisionReasonLimit,
);
```

판정 사유 Textarea를 다음으로 바꾼다:

```vue
<Textarea
    v-model="guardedDecisionReason"
    rows="3"
    auto-resize
    :placeholder="t('council.list.decisionReasonPlaceholder')"
    @input="restoreRejectedInput($event, decisionForm.cnfmCone, decisionReasonLimit)"
/>
<TextLengthIndicator :value="decisionForm.cnfmCone" :max-bytes="decisionReasonLimit" />
```

- [ ] **Step 3: `[id].vue` — 생략요청 사유 (4000B)**

import 블록 끝에 같은 세 import를 추가한다. script에서 `skipForm`이 `useCouncilRequestPage()` 반환값에서 구조분해된 뒤에 추가:

```ts
const skipReasonLimit = councilFormLimits.skipRequestReason.maxBytes;
const { createModel, restoreRejectedInput } = useDatabaseByteLimit();
const guardedSkipReason = createModel(
    () => skipForm.value.rsn,
    (value) => (skipForm.value.rsn = value),
    skipReasonLimit,
);
```

생략요청 사유 Textarea를 다음으로 바꾼다(`maxlength="200"`·자리표시자 인자 제거):

```vue
<Textarea
    v-model="guardedSkipReason"
    rows="3"
    auto-resize
    :placeholder="t('council.requestDetail.skipReasonPlaceholder')"
    @input="restoreRejectedInput($event, skipForm.rsn, skipReasonLimit)"
/>
<TextLengthIndicator :value="skipForm.rsn" :max-bytes="skipReasonLimit" />
```

- [ ] **Step 4: 남은 글자 수 제한이 없는지 확인한다**

Run: `grep -rnE 'maxlength' app/components/council app/pages/info/council-request`
Expected: 0건.

- [ ] **Step 5: 타입·테스트·포맷을 확인한다**

Run: `npm run check && npm test && npm run format:check`
Expected: 통과(협의회 기존 20개 테스트 파일 포함). 포맷 실패면 `npm run format`.

- [ ] **Step 6: 커밋한다**

```bash
git add app/components/council/schedule/ScheduleStatus.vue app/pages/info/council-request/index.vue "app/pages/info/council-request/[id].vue"
git commit -m "feat(council): 회의장소·생략 판정 사유·생략요청 사유 입력을 바이트 한도로 제한 (COUNCIL-005)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 전체 게이트와 완료 기록

**Files:**
- Modify: `C:\it\TASK_COUNCIL.md`, `C:\it\TASK_COUNCIL_DONE.md`
- Modify: `C:\it\docs\superpowers\specs\2026-09-20-council-text-byte-limits-design.md` (필드명 정정 후 `done/`으로 이동)
- Move: `C:\it\docs\superpowers\plans\2026-09-20-council-text-byte-limits.md` → `plans/done/`

- [ ] **Step 1: 백엔드 게이트**

Run (in `C:\it\it_backend`): `./gradlew test -q && ./gradlew spotlessJavaCheck -q`
Expected: BUILD SUCCESSFUL, failures=0. 건수는 `build/test-results/test/*.xml`의 `tests`/`failures`/`errors` 합으로 기록한다.

- [ ] **Step 2: 프론트 게이트**

Run (in `C:\it\it_frontend`): `npm run format:check && npm run check && npm test`
Expected: 전부 통과. 테스트 건수는 Vitest 요약(`Tests N passed`)을 기록한다.

- [ ] **Step 3: 스펙의 필드명을 실제 코드에 맞게 정정한다**

`2026-09-20-council-text-byte-limits-design.md`의 한도 표에서 `ckgOpnnCone` → `ckgOpnn`(Bchklm·Bevalm·Brsltm) / `evalOpnn`(Bplevm), `synOpnnCone` → `synOpnn`, `cnrcPlcNm` → `cnrcPlc`로 고친다. 컬럼명은 그대로 둔다.

- [ ] **Step 4: 완료 기록을 쓴다**

`TASK_COUNCIL_DONE.md`의 `## 2026-09-20` 표에 행을 추가한다:

```markdown
| COUNCIL-005 | ✅ Done | 협의회 자유입력 21개 필드를 DB BYTE 한도로 정합: 엔티티 10개 `@PrePersist/@PreUpdate`(`CouncilTextLimits`, 초과 시 400)와 프론트 `councilFormLimits` 단일 출처 + `createModel`/`acceptText` 거부 + `TextLengthIndicator`, 글자 수 `maxlength`·자리표시자 "(최대 N자)" 제거, 회의장소 결합값 100B 검사 | [설계](docs/superpowers/specs/done/2026-09-20-council-text-byte-limits-design.md) · [계획](docs/superpowers/plans/done/2026-09-20-council-text-byte-limits.md) |
```

표 뒤 문단으로 추가한다(건수는 Step 1·2의 실제 값):

```markdown
코드 변경(COUNCIL-005): `it_backend` — `domain/council/entity/CouncilTextLimits.java`(신규), 엔티티 10개, 테스트 2개. `it_frontend` — `features/council/councilFormLimits.ts`·`meetingPlace.ts`(신규), 협의회 컴포넌트 8개·페이지 2개, 사용자 승인으로 `i18n/messages/council.ts` 자리표시자 문구 정리, 테스트 3개. DTO·컨트롤러·DB·공통 유틸 변경 없음.

검증 결과(COUNCIL-005):

- 백엔드: `CouncilTextLimitsTest` 2건, `CouncilEntityByteLimitTest` 23건, council 도메인 N건, 전체 `./gradlew test` N건 통과, `spotlessJavaCheck` 통과.
- 프론트: `councilFormLimits.test.ts` 3건, `meetingPlace.test.ts` 2건, `FeasibilityOverview-byte-limit.test.ts` 2건, `npm run check`·`npm run format:check` 통과, `npm test` N건 통과.

미검증 범위(COUNCIL-005): `v-model` 배선 컴포넌트(평가·계획평가·결과서·질의응답·장소·사유)는 타입 검사와 기존 테스트로만 확인했고 거부 동작의 컴포넌트 테스트는 두지 않음(거부 규칙 자체는 `useDatabaseByteLimit` 테스트가 담당). 실제 브라우저에서의 붙여넣기 복원, 서버 400 메시지의 화면 노출(COUNCIL-009).
```

- [ ] **Step 5: 활성 표에서 005를 제거하고 문서를 옮긴다**

`TASK_COUNCIL.md`에서 `| COUNCIL-005 | 높음 | 진행 | ...` 행을 삭제한다.

```bash
cd C:\it
git mv docs/superpowers/specs/2026-09-20-council-text-byte-limits-design.md docs/superpowers/specs/done/
git mv docs/superpowers/plans/2026-09-20-council-text-byte-limits.md docs/superpowers/plans/done/
```

옮긴 스펙의 `[COUNCIL-005](../../../TASK_COUNCIL.md)`를 `../../../../TASK_COUNCIL.md`로, 옮긴 계획의 `**Spec:**` 경로를 `docs/superpowers/specs/done/2026-09-20-council-text-byte-limits-design.md`로 고친다.

- [ ] **Step 6: 루트 문서를 커밋한다**

```bash
cd C:\it
git add TASK_COUNCIL.md TASK_COUNCIL_DONE.md docs/superpowers/specs/done/2026-09-20-council-text-byte-limits-design.md docs/superpowers/plans/done/2026-09-20-council-text-byte-limits.md
git commit -m "docs(council): COUNCIL-005 완료 기록 및 설계·계획 문서 이동

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

푸시는 사용자 확인 후 `it_backend`·`it_frontend`는 `fork/main`, 루트는 `fork/K230028`에 올린다.
