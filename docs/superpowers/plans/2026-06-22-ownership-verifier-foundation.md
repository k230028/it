# OwnershipVerifier Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 소유권/권한 검증의 공통 기반(`OwnershipVerifier` 유틸 + 403 매핑)을 구축하고, 첫 적용처로 `QnaService.updateQna`의 깨진 관리자 권한 검증 보안 버그를 바로잡는다.

**Architecture:** 순수 정적 유틸 `OwnershipVerifier.verifyOwnerOrAdmin(ownerEno, user)`가 Spring Security `AccessDeniedException`을 던진다. `GlobalExceptionHandler`에 해당 예외를 403으로 매핑하는 핸들러를 추가해, 서비스 계층에서 던진 권한 실패가 (현재처럼 400으로 강등되지 않고) 403으로 반환되게 한다. `QnaService`가 이 유틸을 첫 소비자로 사용한다.

**Tech Stack:** Java 25, Spring Boot 4.1.0, Spring Security, JUnit 5 + AssertJ + Mockito. 빌드/테스트: `./gradlew`(루트 `it_backend`).

**범위 메모:** 이 계획은 로드맵(`docs/superpowers/specs/2026-06-22-backend-improvement-roadmap-design.md`) **Phase 1 / T1의 기반 슬라이스**다. 사업집행 4단계(Estimate/Deliberation/Contract/Payment)와 FileController·요구사항정의서로의 적용은 **후속 계획**(Plan 2: "OwnershipVerifier 4단계 롤아웃", Plan 3: "파일/요구사항정의서 소유권")으로 분리한다. 4개 서비스 테스트는 공통적으로 `fstEnrUsid` 픽스처 변경이 필요해 한 계획으로 묶는 편이 낫다.

---

## File Structure

| 파일 | 책임 | 작업 |
| --- | --- | --- |
| `common/system/security/OwnershipVerifier.java` | 소유자 또는 관리자 여부 검증(정적 유틸). 실패 시 `AccessDeniedException`. | Create |
| `test/.../common/system/security/OwnershipVerifierTest.java` | 유틸 분기(관리자/소유자/타인/널) 단위 테스트 | Create |
| `exception/GlobalExceptionHandler.java` | `AccessDeniedException` → 403 매핑 추가 | Modify |
| `test/.../exception/GlobalExceptionHandlerTest.java` | 403 핸들러 테스트 추가 | Modify |
| `domain/council/service/QnaService.java` | `updateQna` 권한 검증을 `OwnershipVerifier`로 교체(ITPAD001 버그 제거) | Modify |
| `test/.../domain/council/service/QnaServiceTest.java` | 비소유자→403, 관리자 우회 테스트를 새 동작에 맞춰 갱신 | Modify |

모든 경로 접두사: `it_backend/src/main/java/com/kdb/it/` (테스트는 `it_backend/src/test/java/com/kdb/it/`).

---

## Task 1: OwnershipVerifier 정적 유틸

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/security/OwnershipVerifier.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/security/OwnershipVerifierTest.java`

- [ ] **Step 1: 실패 테스트 작성**

Create `it_backend/src/test/java/com/kdb/it/common/system/security/OwnershipVerifierTest.java`:

```java
package com.kdb.it.common.system.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

/**
 * OwnershipVerifier 단위 테스트 — 관리자/소유자/타인/널 분기 검증.
 */
class OwnershipVerifierTest {

    private CustomUserDetails user(String eno, String ath) {
        return new CustomUserDetails(eno, List.of(ath), "18001");
    }

    @Test
    @DisplayName("소유자 본인이면 통과한다")
    void ownerPasses() {
        assertThatCode(() -> OwnershipVerifier.verifyOwnerOrAdmin("E0001", user("E0001", "ITPZZ001")))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("관리자이면 소유자가 아니어도 통과한다")
    void adminPasses() {
        assertThatCode(() -> OwnershipVerifier.verifyOwnerOrAdmin("E0001", user("E0099", "ITPAD001")))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("소유자도 관리자도 아니면 AccessDeniedException을 던진다")
    void otherDenied() {
        assertThatThrownBy(() -> OwnershipVerifier.verifyOwnerOrAdmin("E0001", user("E0002", "ITPZZ001")))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("소유자 사번이 null이면 (관리자가 아닌 한) 거부한다")
    void nullOwnerDenied() {
        assertThatThrownBy(() -> OwnershipVerifier.verifyOwnerOrAdmin(null, user("E0001", "ITPZZ001")))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("user가 null이면 거부한다")
    void nullUserDenied() {
        assertThatThrownBy(() -> OwnershipVerifier.verifyOwnerOrAdmin("E0001", null))
                .isInstanceOf(AccessDeniedException.class);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.OwnershipVerifierTest"`
Expected: 컴파일 실패 — `OwnershipVerifier` 심볼 없음.

- [ ] **Step 3: 유틸 구현**

Create `it_backend/src/main/java/com/kdb/it/common/system/security/OwnershipVerifier.java`:

```java
package com.kdb.it.common.system.security;

import org.springframework.security.access.AccessDeniedException;

/**
 * 소유권/권한 공통 검증 유틸.
 *
 * <p>업무 도메인 쓰기 경로(수정·삭제·상태전이 등)에서 "본인 또는 관리자만 허용" 규칙을
 * 단일 지점으로 강제합니다. 클래스 레벨 {@code @PreAuthorize}가 없는 업무 컨트롤러는
 * 서비스 계층에서 본 유틸로 소유권을 검증해야 합니다(it_backend/CLAUDE.md §5.18 보안 규칙).</p>
 *
 * <p>실패 시 {@link AccessDeniedException}을 던지며, {@code GlobalExceptionHandler}가 403으로 매핑합니다.</p>
 */
public final class OwnershipVerifier {

    private OwnershipVerifier() {
    }

    /**
     * 대상 리소스의 소유자(최초등록자) 본인 또는 시스템관리자인지 검증합니다.
     *
     * @param ownerEno 리소스 소유자 사번(예: {@code FST_ENR_USID}). null이면 소유자 불일치로 간주.
     * @param user     현재 인증 사용자. null이면 거부.
     * @throws AccessDeniedException 본인도 관리자도 아닌 경우(또는 user가 null)
     */
    public static void verifyOwnerOrAdmin(String ownerEno, CustomUserDetails user) {
        if (user == null) {
            throw new AccessDeniedException("인증 정보가 없습니다.");
        }
        if (user.isAdmin()) {
            return;
        }
        if (ownerEno != null && ownerEno.equals(user.getEno())) {
            return;
        }
        throw new AccessDeniedException("본인 또는 관리자만 수행할 수 있습니다.");
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.OwnershipVerifierTest"`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/security/OwnershipVerifier.java src/test/java/com/kdb/it/common/system/security/OwnershipVerifierTest.java && git commit -m "feat: add OwnershipVerifier for owner-or-admin checks"
```

---

## Task 2: GlobalExceptionHandler — AccessDeniedException → 403

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java`
- Test: `it_backend/src/test/java/com/kdb/it/exception/GlobalExceptionHandlerTest.java`

**배경:** 현재 `@ExceptionHandler(RuntimeException.class)`가 모든 미분류 런타임 예외를 400으로 강등한다. `AccessDeniedException`(RuntimeException 하위)도 400이 되므로, 더 구체적인 핸들러를 추가해 403으로 매핑한다. (Spring `@RestControllerAdvice`는 가장 구체적인 핸들러를 우선 적용하므로 선언 순서와 무관.)

- [ ] **Step 1: 실패 테스트 추가**

`it_backend/src/test/java/com/kdb/it/exception/GlobalExceptionHandlerTest.java`의 import 블록에 다음을 추가:

```java
import org.springframework.security.access.AccessDeniedException;
```

그리고 `// ---- 엣지 케이스 ----` 섹션 바로 앞(`handleException_일반예외_500반환` 위)에 테스트 메서드 추가:

```java
    /** AccessDeniedException 발생 시 403 Forbidden 과 원본 메시지를 반환해야 합니다. */
    @Test
    @DisplayName("handleAccessDenied - 권한 없음 예외 발생 시 403 반환")
    void handleAccessDenied_권한없음_403반환() {
        // Arrange
        AccessDeniedException ex = new AccessDeniedException("본인 또는 관리자만 수행할 수 있습니다.");

        // Act
        ResponseEntity<Map<String, Object>> response = handler.handleAccessDenied(ex);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).containsEntry("status", 403);
        assertThat(response.getBody()).containsEntry("message", "본인 또는 관리자만 수행할 수 있습니다.");
        assertThat(response.getBody()).containsKey("timestamp");
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.exception.GlobalExceptionHandlerTest"`
Expected: 컴파일 실패 — `handler.handleAccessDenied` 메서드 없음.

- [ ] **Step 3: 핸들러 구현**

`it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java`의 import 블록(예: `import org.springframework.web.bind.MethodArgumentNotValidException;` 아래)에 추가:

```java
import org.springframework.security.access.AccessDeniedException;
```

그리고 `handleRuntimeException` 메서드 **바로 위**에 핸들러 추가:

```java
    /**
     * 접근 권한 없음 예외 처리 (403 Forbidden)
     *
     * <p>서비스 계층의 소유권/권한 검증({@code OwnershipVerifier}) 실패 시 발생합니다.
     * 포괄 {@code RuntimeException} 핸들러(400)보다 우선 매칭되어 403으로 반환합니다.</p>
     *
     * @param e {@link AccessDeniedException}
     * @return 403 응답 + 오류 메시지
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException e) {
        log.warn("접근 권한 없음: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, e.getMessage());
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.exception.GlobalExceptionHandlerTest"`
Expected: PASS (기존 + 신규 1 테스트 모두 통과).

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java src/test/java/com/kdb/it/exception/GlobalExceptionHandlerTest.java && git commit -m "feat: map AccessDeniedException to 403 in GlobalExceptionHandler"
```

---

## Task 3: QnaService.updateQna 관리자 권한 버그 수정

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/QnaService.java:119-127`
- Test: `it_backend/src/test/java/com/kdb/it/domain/council/service/QnaServiceTest.java`

**배경(보안 버그):** 현재 `updateQna`는 관리자 판정에 `getAuthority().equals("ROLE_ITPAD001")`을 쓰는데, `CustomUserDetails`는 `ITPAD001`을 `ROLE_ADMIN`으로 매핑하므로 이 비교는 **항상 false** → 관리자 우회 수정이 동작하지 않는다(FIXME 등록됨). `OwnershipVerifier`로 교체한다. 기존 테스트 2건은 (1) 비소유자 거부가 `IllegalArgumentException`→`AccessDeniedException`으로, (2) 관리자 테스트가 깨진 `ROLE_ITPAD001` 권한 스텁→`isAdmin()` 스텁으로 바뀐다(현재 admin 테스트는 버그에 맞춰 작성되어 있어 함께 갱신해야 한다).

- [ ] **Step 1: 기존 테스트를 새 동작에 맞게 수정 (RED)**

`QnaServiceTest.java` import 블록에 추가:

```java
import org.springframework.security.access.AccessDeniedException;
```

(1) `updateQna_본인아님_관리자아님_IllegalArgumentException발생` 테스트(현재 비소유자가 `IllegalArgumentException`을 기대)를 아래로 교체. 메서드명도 새 동작에 맞게 변경:

```java
    @Test
    @DisplayName("updateQna: 본인이 아니고 관리자도 아니면 AccessDeniedException을 던진다")
    void updateQna_본인아님_관리자아님_AccessDenied발생() {
        Bpqnam qna = mockQna(QTN_ID, ASCT_ID, "E_OWNER");
        given(qnaRepository.findById(QTN_ID)).willReturn(Optional.of(qna));
        CustomUserDetails userDetails = mock(CustomUserDetails.class);
        given(userDetails.getEno()).willReturn("E10001");
        given(userDetails.isAdmin()).willReturn(false);

        assertThatThrownBy(() -> qnaService.updateQna(ASCT_ID, QTN_ID,
                new CouncilDto.QnaUpdateRequest("수정 시도"), userDetails))
                .isInstanceOf(AccessDeniedException.class);
    }
```

(2) `updateQna_관리자_타인질의수정가능` 테스트(현재 `() -> "ROLE_ITPAD001"` GrantedAuthority 스텁 사용)에서, 권한 스텁을 `isAdmin()` 스텁으로 교체. 즉 다음 형태의 줄
```java
        org.springframework.security.core.GrantedAuthority adminAuth = () -> "ROLE_ITPAD001";
```
및 이를 `getAuthorities()`에 물리는 `given(admin.getAuthorities())...` 스텁을 제거하고, 대신:
```java
        given(admin.isAdmin()).willReturn(true);
```
로 바꾼다. (소유자 사번과 다른 `admin.getEno()` 스텁은 그대로 두어도 무방하나, `isAdmin()`이 true이면 소유자 비교에 도달하지 않는다.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.QnaServiceTest"`
Expected: FAIL — (1) 현 코드는 비소유자에 `IllegalArgumentException`을 던져 `AccessDeniedException` 기대와 불일치, (2) `isAdmin()` 스텁만으로는 현 코드의 `ROLE_ITPAD001` 권한 검사를 통과하지 못해 관리자 테스트 실패.

- [ ] **Step 3: QnaService 구현 교체 (GREEN)**

`QnaService.java`에서 `updateQna` 내 기존 권한 검증 블록(라인 약 119–127)을 통째로 교체한다. 교체 전:

```java
        /* 본인 또는 관리자만 수정 가능 */
        boolean isOwner = qna.getQtnDwuUsid().equals(userDetails.getEno());
        // FIXME: 권한 문자열 불일치 — ITPAD001은 CustomUserDetails에서 ROLE_ADMIN으로 매핑되므로
        //        "ROLE_ITPAD001" 비교는 항상 false가 되어 관리자 수정이 동작하지 않음. "ROLE_ADMIN" 또는 userDetails.isAdmin()으로 교정 필요 (TASK.md 등록).
        boolean isAdmin = userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ITPAD001"));
        if (!isOwner && !isAdmin) {
            throw new IllegalArgumentException("본인이 등록한 질의만 수정할 수 있습니다.");
        }
```

교체 후:

```java
        /* 본인 또는 관리자만 수정 가능 */
        OwnershipVerifier.verifyOwnerOrAdmin(qna.getQtnDwuUsid(), userDetails);
```

그리고 `QnaService.java` import 블록에 추가:

```java
import com.kdb.it.common.system.security.OwnershipVerifier;
```

(`CustomUserDetails` import는 이미 존재.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.council.service.QnaServiceTest"`
Expected: PASS (수정한 2건 포함 전체 통과).

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/council/service/QnaService.java src/test/java/com/kdb/it/domain/council/service/QnaServiceTest.java && git commit -m "fix: correct admin override in QnaService.updateQna via OwnershipVerifier"
```

---

## Task 4: 통합 검증 & 백로그 동기화

**Files:**
- Modify: `TASK.md`, `TASK_DONE.md` (루트)

- [ ] **Step 1: 영향 범위 테스트 재실행**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.security.*" --tests "com.kdb.it.exception.*" --tests "com.kdb.it.domain.council.service.QnaServiceTest"`
Expected: PASS (BUILD SUCCESSFUL).

- [ ] **Step 2: 컴파일 전체 확인**

Run: `cd it_backend && ./gradlew compileJava compileTestJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 백로그 항목 이관**

`TASK.md`의 🔒 보안 섹션에서 `QnaService.updateQna()` 관리자 수정 무력화 행(⬜ Open, `ROLE_ITPAD001`)을 제거하고, `TASK_DONE.md`의 `### 🔎 2026-06-22 코드 대조 검증 완료 (백엔드)` 표에 다음 행을 추가:

```
| ✅ Done | 🟠 High | `QnaService.updateQna()` 관리자 수정 무력화(`ROLE_ITPAD001`) 교정 — `OwnershipVerifier.verifyOwnerOrAdmin()`로 교체, 403 매핑 | — ✅ 검증 2026-06-22: QnaService.java:119, OwnershipVerifier 도입, GlobalExceptionHandler 403 |
```

`docs/superpowers/specs/2026-06-22-backend-improvement-roadmap-design.md`의 T4 항목 중 "AccessDeniedException 핸들러"가 본 계획에서 선반영되었음을 한 줄 메모로 남긴다(선택).

- [ ] **Step 4: 커밋**

```bash
cd /c/it && git add TASK.md TASK_DONE.md && git commit -m "docs: move QnaService admin-override fix to TASK_DONE"
```

---

## Self-Review

- **Spec coverage:** 본 계획은 로드맵 T1의 기반(`OwnershipVerifier`)과 T4의 일부(403 핸들러)를 구현하고 T1의 QnaService 적용 1건을 완료한다. 나머지 T1 적용처(사업집행 4단계 4개 서비스, FileController, 요구사항정의서)는 후속 계획으로 명시 분리됨 — 의도된 범위.
- **Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "유사하게" 류 표현 없음. ✓
- **Type consistency:** `OwnershipVerifier.verifyOwnerOrAdmin(String, CustomUserDetails)` 시그니처가 Task 1 정의 ↔ Task 3 호출에서 일치. `AccessDeniedException`은 `org.springframework.security.access.AccessDeniedException`으로 전 태스크 통일(스프링 시큐리티 의존성은 백엔드에 이미 존재). `CustomUserDetails.isAdmin()`/`getEno()`는 실제 시그니처(확인됨). ✓
- **주의(실행자):** `QnaServiceTest`의 관리자 테스트는 기존에 깨진 `ROLE_ITPAD001` 권한 스텁으로 통과하던 것이므로, Step 1에서 반드시 `isAdmin()` 스텁으로 교체해야 GREEN이 된다. 누락 시 관리자 테스트가 계속 실패한다.
