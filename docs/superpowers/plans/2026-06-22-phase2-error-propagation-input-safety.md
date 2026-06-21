# Phase 2 — Error Propagation & Input Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로드맵 Phase 2(T4~T7)를 구현한다. 전용 `NotFoundException`(404)과 `ResponseStatusException` 핸들러로 예외→HTTP 매핑을 정비하고(T4), 9개 지점의 에러 로깅을 표준화하며(T5, cause/스택트레이스·warn 보강), `GeminiService`에 RestClient 타임아웃 + 첨부 크기 사전검사를 추가하고(T6), 컨트롤러 `@Valid`·DTO Bean Validation·Tiptap FORBIDDEN 분기로 입력 검증을 표준화한다(T7).

**Architecture:** T4는 `exception` 패키지에 새 `NotFoundException`(RuntimeException 하위)과 `GlobalExceptionHandler` 핸들러 2종(`NotFoundException`→404, `ResponseStatusException`→상태코드 보존)을 추가한다. 기존 헬퍼 `buildErrorResponse(HttpStatus, String)`와 `RuntimeException`(400)/`Exception`(500)/`AccessDeniedException`(403, Phase 1 완료) 핸들러를 그대로 유지하면서 더 구체적인 핸들러를 끼워 넣는다(`@RestControllerAdvice`는 가장 구체적인 핸들러를 우선 적용하므로 선언 순서 무관). T5는 각 서비스/리스너/유틸의 catch·로그 지점을 표준 패턴(`log.warn("...", e)` 또는 cause 전달 생성자)으로 교체한다. T6은 `GeminiService` 생성자의 `RestClient.builder()`에 `JdkClientHttpRequestFactory`(connect 5s/read 60s)를 주입하고 첨부 읽기 전 `Files.size()` 사전검사를 추가한다. T7은 컨트롤러/DTO에 jakarta Bean Validation 애너테이션을 추가한다.

**Tech Stack:** Java 25, Spring Boot 4.1.0, Spring Security, JUnit 5 + AssertJ + Mockito. 빌드/테스트: `./gradlew`(루트 `it_backend`).

**범위 메모:**
- T4의 **`AccessDeniedException`→403 핸들러는 Phase 1 계획**(`2026-06-22-ownership-verifier-foundation.md` Task 2)에서 이미 구현·검증 완료**(`GlobalExceptionHandler.java:121-125`, 테스트 `:138-153`). 본 계획에서 중복 구현하지 않고 그대로 둔다.**
- 작업 순서: 공통 기반인 **T4(NotFoundException + 핸들러)를 먼저** 구축한 뒤, 독립적인 T5/T6/T7 항목을 테마별로 진행한다. 각 Task는 독립 커밋 가능하다.
- **이미 처리된 지점(스킵):** `FileService.uploadFileInternal()`의 디렉토리/저장 IOException은 이미 `new CustomGeneralException(msg, e)`로 cause를 전달하고 있어(`FileService.java:316-328`) 본 계획 대상이 아니다. T5의 FileService 작업은 cause를 빠뜨린 `uploadFiles()`(B-H-01)와 `downloadFile()` 두 곳만 대상으로 한다.

---

## File Structure

| 파일 | 책임 | 작업 |
| --- | --- | --- |
| `exception/NotFoundException.java` | 리소스 미존재 전용 예외(404 매핑용, RuntimeException 하위) | Create |
| `test/.../exception/NotFoundExceptionTest.java` | 메시지/타입 단위 테스트 | Create |
| `exception/GlobalExceptionHandler.java` | `NotFoundException`→404, `ResponseStatusException`→상태 보존 핸들러 추가 | Modify |
| `test/.../exception/GlobalExceptionHandlerTest.java` | 404·ResponseStatusException 핸들러 테스트 추가 | Modify |
| `domain/log/listener/ChangeLogEntityListener.java` | persistLog 스택트레이스 전달(B-H-01), resolveUpdateType warn(B-C-02/B-M-03) | Modify |
| `domain/log/listener/AuditLogPersister.java` | CHG_USID null 시 warn(B-M-02) | Modify |
| `domain/budget/plan/service/PlanService.java` | 로거 추가 + 스냅샷 파싱 실패 warn(B-H-05), 직렬화 예외 cause 전달 | Modify |
| `infra/file/service/FileService.java` | uploadFiles warn+stacktrace(B-H-01), downloadFile cause 전달 | Modify |
| `common/sso/SsoController.java` | sendRedirect IOException 내부 catch+로그(B-H-06) | Modify |
| `common/admin/service/AdminLogService.java` | readField 미발견 시 warn(B-M-01) | Modify |
| `common/system/security/JwtUtil.java` | athIds 타입 불일치 warn(B-M-04) | Modify |
| `domain/council/service/CouncilService.java` | 회의일자 파싱 실패 warn | Modify |
| `common/notification/service/NotificationService.java` | ttl/내용 길이 초과 시 clamp + warn | Modify |
| `infra/ai/service/GeminiService.java` | RestClient connect/read 타임아웃, 첨부 크기 사전검사+warn(B-H-03/B-M-05) | Modify |
| `infra/ai/dto/GeminiDto.java` | Request Bean Validation(@NotBlank/@Size/@Size 첨부수) | Modify |
| `common/approval/controller/ApplicationController.java` | submit/approve `@Valid` 추가 | Modify |
| `common/notification/controller/NotificationController.java` | `@Validated` + size `@Max(200)` | Modify |
| `common/system/tiptap/service/TiptapVariableService.java` | resolveOne FORBIDDEN 분기(권한 훅) | Modify |
| `domain/estimate/dto/EstimateDto.java` | rqmBgAmt `@DecimalMin("0")` | Modify |
| `domain/deliberation/dto/DeliberationDto.java` | taskDbrOmtYn `@Pattern("^[YN]$")` | Modify |
| `domain/contract/dto/ContractDto.java` | cttAmt `@DecimalMin("0")` | Modify |
| `domain/payment/dto/PaymentDto.java` | cttAmt/dfrAmt `@DecimalMin("0")` | Modify |

모든 경로 접두사: `it_backend/src/main/java/com/kdb/it/` (테스트는 `it_backend/src/test/java/com/kdb/it/`).

---

## Task 1: NotFoundException 전용 예외 (T4 기반)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/exception/NotFoundException.java`
- Test: `it_backend/src/test/java/com/kdb/it/exception/NotFoundExceptionTest.java`

**배경:** 현재 리소스 미존재는 `IllegalArgumentException`(400)으로 던져진다. 404 매핑을 위한 전용 예외를 도입한다. `RuntimeException` 하위로 두어 기존 트랜잭션 롤백 동작과 호환되게 한다.

- [ ] **Step 1: 실패 테스트 작성**

Create `it_backend/src/test/java/com/kdb/it/exception/NotFoundExceptionTest.java`:

```java
package com.kdb.it.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * NotFoundException 단위 테스트 — 메시지 보존 및 RuntimeException 상속 검증.
 */
class NotFoundExceptionTest {

    @Test
    @DisplayName("메시지를 그대로 보존한다")
    void preservesMessage() {
        NotFoundException ex = new NotFoundException("신청서를 찾을 수 없습니다: APF-2026-0001");
        assertThat(ex.getMessage()).isEqualTo("신청서를 찾을 수 없습니다: APF-2026-0001");
    }

    @Test
    @DisplayName("RuntimeException 하위 타입이다")
    void isRuntimeException() {
        assertThat(new NotFoundException("x")).isInstanceOf(RuntimeException.class);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.exception.NotFoundExceptionTest"`
Expected: 컴파일 실패 — `NotFoundException` 심볼 없음.

- [ ] **Step 3: 예외 구현**

Create `it_backend/src/main/java/com/kdb/it/exception/NotFoundException.java`:

```java
package com.kdb.it.exception;

/**
 * 리소스 미존재 예외 (404 Not Found).
 *
 * <p>조회 대상 리소스(신청서·문서·파일 등)가 존재하지 않을 때 던집니다.
 * {@code GlobalExceptionHandler}가 404로 매핑합니다. 잘못된 입력값(400)과 구분하기 위해
 * {@link IllegalArgumentException} 대신 본 예외를 사용합니다.</p>
 */
public class NotFoundException extends RuntimeException {

    /**
     * @param message 사용자/클라이언트에 노출 가능한 미존재 사유
     */
    public NotFoundException(String message) {
        super(message);
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.exception.NotFoundExceptionTest"`
Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/exception/NotFoundException.java src/test/java/com/kdb/it/exception/NotFoundExceptionTest.java && git commit -m "feat: add NotFoundException for 404 mapping"
```

---

## Task 2: GlobalExceptionHandler — 404 + ResponseStatusException 핸들러 (T4)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java`
- Test: `it_backend/src/test/java/com/kdb/it/exception/GlobalExceptionHandlerTest.java`

**배경:** `NotFoundException`을 404로, `ResponseStatusException`(예: `PlanService.buildSnapshot`이 던지는 500)을 그 자체 상태코드로 매핑한다. `AccessDeniedException`→403 핸들러는 Phase 1에서 이미 추가됨(중복 금지). `ResponseStatusException`은 `RuntimeException` 하위이므로 전용 핸들러가 없으면 포괄 핸들러가 400으로 강등한다 — 이를 막아 원래 상태코드(404/500 등)를 보존한다.

- [ ] **Step 1: 실패 테스트 추가**

`it_backend/src/test/java/com/kdb/it/exception/GlobalExceptionHandlerTest.java` import 블록에 추가:

```java
import org.springframework.web.server.ResponseStatusException;
```

`// ---- 엣지 케이스 ----` 주석 **바로 앞**(기존 `handleAccessDenied_권한없음_403반환` 테스트 아래)에 테스트 2개 추가:

```java
    /** NotFoundException 발생 시 404 Not Found 와 원본 메시지를 반환해야 합니다. */
    @Test
    @DisplayName("handleNotFound - 리소스 미존재 예외 발생 시 404 반환")
    void handleNotFound_리소스미존재_404반환() {
        // Arrange
        NotFoundException ex = new NotFoundException("신청서를 찾을 수 없습니다: APF-2026-0001");

        // Act
        ResponseEntity<Map<String, Object>> response = handler.handleNotFound(ex);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).containsEntry("status", 404);
        assertThat(response.getBody()).containsEntry("message", "신청서를 찾을 수 없습니다: APF-2026-0001");
        assertThat(response.getBody()).containsKey("timestamp");
    }

    /** ResponseStatusException 발생 시 지정한 상태코드(500 등)를 그대로 보존해 반환해야 합니다. */
    @Test
    @DisplayName("handleResponseStatus - 지정 상태코드를 보존하여 반환")
    void handleResponseStatus_상태코드보존() {
        // Arrange
        ResponseStatusException ex = new ResponseStatusException(
                HttpStatus.INTERNAL_SERVER_ERROR, "계획 스냅샷 직렬화에 실패했습니다.");

        // Act
        ResponseEntity<Map<String, Object>> response = handler.handleResponseStatus(ex);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).containsEntry("status", 500);
        assertThat(response.getBody()).containsEntry("message", "계획 스냅샷 직렬화에 실패했습니다.");
        assertThat(response.getBody()).containsKey("timestamp");
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.exception.GlobalExceptionHandlerTest"`
Expected: 컴파일 실패 — `handler.handleNotFound` / `handler.handleResponseStatus` 메서드 없음.

- [ ] **Step 3: 핸들러 구현**

`it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java` import 블록(예: `import org.springframework.web.context.request.async.AsyncRequestNotUsableException;` 아래)에 추가:

```java
import org.springframework.web.server.ResponseStatusException;
```

`handleAccessDenied` 메서드(현재 `:121-125`) **바로 아래**, `handleRuntimeException` **위**에 두 핸들러 추가:

```java
    /**
     * 리소스 미존재 예외 처리 (404 Not Found)
     *
     * <p>{@link NotFoundException}을 404로 매핑합니다. 잘못된 입력값(400)과 구분하기 위한
     * 전용 핸들러로, 포괄 {@code RuntimeException} 핸들러(400)보다 우선 매칭됩니다.</p>
     *
     * @param e {@link NotFoundException}
     * @return 404 응답 + 오류 메시지
     */
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NotFoundException e) {
        log.warn("리소스 미존재: {}", e.getMessage());
        return buildErrorResponse(HttpStatus.NOT_FOUND, e.getMessage());
    }

    /**
     * 명시적 상태코드 예외 처리 (상태코드 보존)
     *
     * <p>{@link ResponseStatusException}이 지정한 HTTP 상태코드(404·500 등)를 그대로 보존합니다.
     * 본 핸들러가 없으면 {@code RuntimeException} 핸들러가 400으로 강등합니다.
     * 5xx는 ERROR, 그 외는 WARN으로 로깅합니다.</p>
     *
     * @param e {@link ResponseStatusException}
     * @return 지정 상태코드 응답 + 사유 메시지
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException e) {
        HttpStatus status = HttpStatus.valueOf(e.getStatusCode().value());
        String message = e.getReason() != null ? e.getReason() : status.getReasonPhrase();
        if (status.is5xxServerError()) {
            log.error("상태코드 예외(5xx): status={}, reason={}", status.value(), message, e);
        } else {
            log.warn("상태코드 예외: status={}, reason={}", status.value(), message);
        }
        return buildErrorResponse(status, message);
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.exception.GlobalExceptionHandlerTest"`
Expected: PASS (기존 + 신규 2 테스트 모두 통과).

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java src/test/java/com/kdb/it/exception/GlobalExceptionHandlerTest.java && git commit -m "feat: map NotFoundException to 404 and preserve ResponseStatusException status"
```

---

## Task 3: ChangeLogEntityListener 로깅 표준화 (T5: B-H-01 / B-C-02 / B-M-03)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java:101-114, 125-138`

**배경:** (1) `persistLog`는 감사로그 실패를 `e.getMessage()`만 로깅해 스택트레이스를 잃는다(B-H-01). (2) `resolveUpdateType`의 `IllegalAccessException` catch는 **로그 없이** 삼키고 `"U"`를 반환한다(B-C-02/B-M-03). 본 변경은 로깅만 보강하며, 감사로그 실패가 원본 트랜잭션을 롤백하지 않는 기존 정책(예외 삼킴)은 유지한다.

> **TDD 메모:** 이 두 지점은 catch 내부 로깅이라 단위 테스트로 동작을 단정하기 어렵다(로그 출력은 부수효과). 본 Task는 **로깅 보강 리팩토링**으로 분류하고, 회귀 방지는 `./gradlew compileJava` + 기존 감사로그 테스트(`./gradlew test --tests "com.kdb.it.domain.log.*"`) 통과로 갈음한다.

- [ ] **Step 1: persistLog 스택트레이스 전달 (B-H-01)**

`ChangeLogEntityListener.java:107-113` 교체 전:

```java
        } catch (Exception e) {
            // FIXME: [B-H-01] e.getMessage() 대신 e를 마지막 인자로 전달하여 스택트레이스 포함 필요
            // 감사로그 실패가 본 업무 트랜잭션을 롤백시키지 않도록 예외를 삼킨다.
            // 시퀀스 미생성(ORA-02289) 등 인프라 오류 시 본 작업은 정상 완료되어야 한다.
            log.warn("[감사로그 기록 실패] entity={}, logClass={}, chgTp={}, reason={}",
                    entity.getClass().getSimpleName(), logClass.getSimpleName(), chgTp, e.getMessage());
        }
```

교체 후:

```java
        } catch (Exception e) {
            // 감사로그 실패가 본 업무 트랜잭션을 롤백시키지 않도록 예외를 삼킨다.
            // 시퀀스 미생성(ORA-02289) 등 인프라 오류 시 본 작업은 정상 완료되어야 한다.
            // 단, 진단을 위해 스택트레이스(e)를 마지막 인자로 전달한다.
            log.warn("[감사로그 기록 실패] entity={}, logClass={}, chgTp={}",
                    entity.getClass().getSimpleName(), logClass.getSimpleName(), chgTp, e);
        }
```

- [ ] **Step 2: resolveUpdateType warn 추가 (B-C-02 / B-M-03)**

`ChangeLogEntityListener.java:133-136` 교체 전:

```java
        } catch (IllegalAccessException e) {
            // FIXME: [B-C-02] delYn 리플렉션 실패 시 warn 로그에 원인 예외를 포함해 삭제 판정 실패를 추적한다.
            // TODO: [B-M-03] IllegalAccessException 발생 시 원인 로깅 후 기본값(U) 반환 필요
            return "U";
        }
```

교체 후:

```java
        } catch (IllegalAccessException e) {
            // delYn 리플렉션 실패 시 삭제 판정 불가 → 기본값 U로 폴백하되, 원인 예외를 warn으로 추적한다.
            log.warn("[감사로그] delYn 리플렉션 실패 — 변경유형 U로 폴백: entity={}",
                    entity.getClass().getSimpleName(), e);
            return "U";
        }
```

- [ ] **Step 3: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.domain.log.*"`
Expected: BUILD SUCCESSFUL (기존 감사로그 테스트 통과).

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java && git commit -m "refactor: pass stacktrace and warn on audit-log failures in ChangeLogEntityListener"
```

---

## Task 4: AuditLogPersister CHG_USID null warn (T5: B-M-02)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java:243-249`

**배경:** `resolveCurrentUserId()`는 인증 컨텍스트가 없으면 **무로그**로 null을 반환해 감사로그 CHG_USID가 null로 적재된다(B-M-02). 시스템 트리거(스케줄러·이벤트 등) 경로일 수 있으므로 동작은 유지하되 warn 로그로 가시성을 확보한다.

> **TDD 메모:** Task 3과 동일하게 로깅 보강 리팩토링으로 분류. 회귀 방지는 컴파일 + 기존 `domain.log.*` 테스트로 갈음.

- [ ] **Step 1: warn 로그 추가**

`AuditLogPersister.java:243-249` 교체 전:

```java
    private String resolveCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return null;
        }
        return auth.getName();
    }
```

교체 후:

```java
    private String resolveCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            // 인증 컨텍스트가 없는 경로(시스템 트리거·비동기 등)에서는 CHG_USID가 null로 적재된다.
            // 동작은 유지하되, 변경자 추적 누락을 진단할 수 있도록 warn 로그를 남긴다.
            log.warn("[감사로그] 인증 컨텍스트 없음 — CHG_USID null로 기록됨");
            return null;
        }
        return auth.getName();
    }
```

- [ ] **Step 2: 로거 존재 확인**

`AuditLogPersister`에 `log` 필드(`@Slf4j` 또는 `LoggerFactory`)가 있는지 확인한다. 없으면 클래스 상단에 추가:

```java
private static final Logger log = LoggerFactory.getLogger(AuditLogPersister.class);
```

및 import `org.slf4j.Logger;`, `org.slf4j.LoggerFactory;`. (`@Slf4j`가 이미 있으면 본 단계 생략.)

- [ ] **Step 3: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.domain.log.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java && git commit -m "refactor: warn when audit-log CHG_USID resolves to null"
```

---

## Task 5: PlanService 스냅샷 로깅 (T5: B-H-05 + 직렬화 cause)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java`

**배경:** (1) `getPlans()` 스냅샷 파싱 `catch (JsonProcessingException e)`가 **무로그**로 카운트를 0으로 폴백해 잘못된 예산 보고서가 산출될 수 있다(B-H-05, `:133-137`). (2) `buildSnapshot()`의 `ResponseStatusException`이 cause `e`를 전달하지 않아 직렬화 실패 원인이 유실된다(`:450-452`). `PlanService`는 **로거 필드가 없으므로** 먼저 추가한다(현재 `@RequiredArgsConstructor`, `@Slf4j` 미사용. `ResponseStatusException`/`HttpStatus`는 이미 import됨).

> **TDD 메모:** catch 내부 로깅이라 동작 단정이 어렵다. 로깅/진단 보강으로 분류하고 컴파일 + 기존 plan 테스트 통과로 회귀를 막는다.

- [ ] **Step 1: 로거 필드 추가**

`PlanService.java` import 블록에 추가:

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
```

`public class PlanService {` 바로 아래(첫 필드 위)에 추가:

```java
    private static final Logger log = LoggerFactory.getLogger(PlanService.class);
```

- [ ] **Step 2: 스냅샷 파싱 실패 warn (B-H-05)**

`PlanService.java:133-137` 교체 전:

```java
                } catch (JsonProcessingException e) {
                    // FIXME: [B-H-05] 스냅샷 파싱 실패 시 카운트 0 폴백으로
                    // 잘못된 예산 보고서가 산출될 수 있으므로 실패 로그와 보정 정책이 필요합니다.
                    // 스냅샷 파싱 실패 시 카운트는 0 으로 유지 (목록 화면은 동작해야 함)
                }
```

교체 후:

```java
                } catch (JsonProcessingException e) {
                    // 스냅샷 파싱 실패 시 카운트는 0 으로 유지(목록 화면은 동작해야 함).
                    // 단, 잘못된 예산 집계가 조용히 산출되지 않도록 원인 예외를 warn으로 남긴다.
                    log.warn("[계획] 스냅샷 파싱 실패 — 사업 카운트 0으로 폴백", e);
                }
```

> **들여쓰기 주의:** `PlanService.java`는 탭/스페이스가 혼재한다. 교체 시 해당 블록의 **기존 들여쓰기 폭을 그대로 유지**한다(Read로 정확한 공백을 확인 후 편집).

- [ ] **Step 3: buildSnapshot 직렬화 cause 전달**

`PlanService.java:450-452` 교체 전:

```java
            } catch (JsonProcessingException e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "계획 스냅샷 직렬화에 실패했습니다.");
            }
```

교체 후:

```java
            } catch (JsonProcessingException e) {
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "계획 스냅샷 직렬화에 실패했습니다.", e);
            }
```

(`ResponseStatusException(HttpStatus, String, Throwable)` 생성자 사용 — cause 보존.)

- [ ] **Step 4: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.domain.budget.plan.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java && git commit -m "refactor: log snapshot parse failures and propagate cause in PlanService"
```

---

## Task 6: FileService 로깅 보강 (T5: B-H-01 + downloadFile cause)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`

**배경:** (1) `uploadFiles()`의 catch가 `e.getMessage()`만 사용자 목록에 담고 **로깅이 전혀 없다**(B-H-01, `:393-403`). (2) `downloadFile()`의 `MalformedURLException` catch가 cause `e`를 `CustomGeneralException`에 전달하지 않는다(`:520-525`). `uploadFileInternal()`의 IOException 두 곳은 이미 cause를 전달하므로 대상 아님(범위 메모 참조).

> **TDD 메모:** 로깅/cause 보강. `FileService`에 로거가 있는지 먼저 확인하고 없으면 추가.

- [ ] **Step 1: 로거 존재 확인**

`FileService`에 `log` 필드가 있는지 확인. 없으면 `@Slf4j` 또는 `private static final Logger log = LoggerFactory.getLogger(FileService.class);`를 추가(+import).

- [ ] **Step 2: uploadFiles warn + 스택트레이스 (B-H-01)**

`FileService.java:399-402` 교체 전:

```java
            } catch (Exception e) {
                // TODO: [B-H-01] 파일 업로드 실패 로그에 원본 파일명과 스택 트레이스를 포함해 실패 원인을 추적한다.
                failList.add(file.getOriginalFilename() + " (" + e.getMessage() + ")");
            }
```

교체 후:

```java
            } catch (Exception e) {
                // 다건 업로드 중 일부 실패는 전체를 중단하지 않고 실패 목록으로 수집한다.
                // 단, 원본 파일명과 스택트레이스를 warn으로 남겨 실패 원인을 추적한다.
                log.warn("[파일] 업로드 실패 — fileName={}", file.getOriginalFilename(), e);
                failList.add(file.getOriginalFilename() + " (" + e.getMessage() + ")");
            }
```

- [ ] **Step 3: downloadFile cause 전달**

`FileService.java:522-525` 교체 전:

```java
        try {
            resource = new UrlResource(filePath.toUri());
        } catch (MalformedURLException e) {
            throw new CustomGeneralException("파일 경로가 잘못되었습니다. 파일매핑ID: " + flMpnId);
        }
```

교체 후:

```java
        try {
            resource = new UrlResource(filePath.toUri());
        } catch (MalformedURLException e) {
            throw new CustomGeneralException("파일 경로가 잘못되었습니다. 파일매핑ID: " + flMpnId, e);
        }
```

> **확인:** `CustomGeneralException(String, Throwable)` 생성자가 존재하는지 확인한다(`uploadFileInternal`이 이미 `new CustomGeneralException(msg, e)`를 사용하므로 존재함 — `FileService.java:319, 327` 참조).

- [ ] **Step 4: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.infra.file.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/infra/file/service/FileService.java && git commit -m "refactor: warn on bulk upload failures and propagate cause in FileService"
```

---

## Task 7: SsoController sendRedirect IOException 처리 (T5: B-H-06)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/sso/SsoController.java:278-282`

**배경:** `complete()`의 catch 블록 내부 `response.sendRedirect(...)`가 `IOException`을 던질 수 있는데 감싸지지 않아(B-H-06) 전파된다. 내부 try-catch로 감싸 로그만 남기고 안전하게 종료한다.

> **TDD 메모:** HttpServletResponse를 mock해 `sendRedirect`가 IOException을 던지는 케이스를 단정하기 쉬우면 테스트를 추가한다. SsoController 테스트 인프라가 무거우면(서블릿 mock 부담) 로깅 보강 리팩토링으로 분류하고 컴파일 + 기존 sso 테스트로 갈음한다. 우선 기존 테스트 유무를 확인한다: `it_backend/src/test/java/com/kdb/it/common/sso/`.

- [ ] **Step 1: 내부 try-catch 추가**

`SsoController.java:278-282` 교체 전:

```java
        } catch (Exception e) {
            // TODO: [B-H-06] sendRedirect() IOException을 내부 try-catch로 감싸고 에링 로그 추가 필요
            log.error("SSO 인증 실패 - eno: {}, reason: {}", eno, e.getMessage(), e);
            response.sendRedirect(resolveFrontendBaseUrl(origin) + "/login?error=sso");
        }
```

교체 후:

```java
        } catch (Exception e) {
            log.error("SSO 인증 실패 - eno: {}, reason: {}", eno, e.getMessage(), e);
            // 오류 리다이렉트 자체도 IOException(클라이언트 연결 종료 등)을 던질 수 있으므로
            // 별도 try-catch로 감싸 2차 예외가 핸들러 밖으로 전파되지 않게 한다.
            try {
                response.sendRedirect(resolveFrontendBaseUrl(origin) + "/login?error=sso");
            } catch (IOException redirectEx) {
                log.warn("SSO 오류 리다이렉트 실패 - eno: {}", eno, redirectEx);
            }
        }
```

> **import 확인:** `java.io.IOException`이 import되어 있는지 확인하고 없으면 추가. (메서드 시그니처가 이미 `throws IOException`을 선언하고 있을 수 있으나, 이제 내부에서 처리하므로 `throws`는 그대로 두어도 무방하다.)

- [ ] **Step 2: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.common.sso.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/sso/SsoController.java && git commit -m "fix: guard SSO error redirect against IOException in SsoController"
```

---

## Task 8: AdminLogService readField 미발견 warn (T5: B-M-01)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminLogService.java:225-241`

**배경:** `readField()`가 클래스 계층에서 필드를 찾지 못하면 **무로그**로 null을 반환하고, 호출부 `toRow()`는 null 체크 없이 사용해 NPE 위험이 있다(B-M-01). 동작(null 반환)은 유지하되 미발견 시 warn 로그로 가시성을 확보한다.

> **TDD 메모:** 로깅 보강 리팩토링. 컴파일 + 기존 admin 테스트로 갈음.

- [ ] **Step 1: 미발견 warn 추가**

`AdminLogService.java:238-241` 교체 전:

```java
        // TODO: [B-M-01] 클래스 계층에서 필드 미발견 시 null 반환 — 호출부 null 체크 없이 사용 시 NPE 위험
        // Optional<Object> 반환 타입 변경 또는 호출부에서 null 체크 보강 권장
        return null;
    }
```

교체 후:

```java
        // 클래스 계층 전체에서 필드를 찾지 못한 경우 null 반환(기존 동작 유지).
        // 호출부가 null을 그대로 사용하므로, 매핑 누락을 진단할 수 있도록 warn 로그를 남긴다.
        log.warn("[관리자로그] 로그 필드 미발견 — null 반환: fieldName={}", fieldName);
        return null;
    }
```

- [ ] **Step 2: 로거/파라미터명 확인**

`AdminLogService`에 `log` 필드가 없으면 `@Slf4j` 또는 `LoggerFactory`로 추가(+import). `fieldName`이 `readField` 메서드 파라미터명과 일치하는지 Read로 확인 — 다르면 실제 파라미터명으로 교정.

- [ ] **Step 3: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.common.admin.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/admin/service/AdminLogService.java && git commit -m "refactor: warn when log field not found in AdminLogService.readField"
```

---

## Task 9: JwtUtil athIds 타입 불일치 warn (T5: B-M-04)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtUtil.java:165-174`

**배경:** `getAthIdsFromToken()`은 `athIds` 클레임이 `List`가 아니면 **무로그**로 빈 리스트를 반환해, 모든 권한이 조용히 제거되고 사용자가 기본값 `ITPZZ001`로 강등된다(B-M-04). 권한 강등은 보안상 가시성이 필요하므로 warn 로그를 추가한다. (로거는 이미 존재: `JwtUtil.java:49`.)

- [ ] **Step 1: warn 추가**

`JwtUtil.java:167-173` 교체 전:

```java
        Object claim = getClaims(token).get("athIds");
        if (claim instanceof List<?>) {
            return (List<String>) claim;
        }
        // TODO: [B-M-04] athIds 클레임 타입 불일치 시 빈 권한 목록 반환 (warn 로그 없음)
        // JWT 토큰 구조 변경 시 모든 권한이 조용히 제거될 수 있음 — log.warn 추가 권장
        return List.of();
```

교체 후:

```java
        Object claim = getClaims(token).get("athIds");
        if (claim instanceof List<?>) {
            return (List<String>) claim;
        }
        // athIds 클레임이 비어있거나 List가 아니면 빈 권한 목록을 반환한다(사용자는 기본 ITPZZ001로 강등).
        // 토큰 구조 변경·손상 시 권한이 조용히 제거되는 것을 탐지할 수 있도록 warn 로그를 남긴다.
        // (claim == null은 athIds 미포함 정상 경로(예: Refresh Token)이므로 로깅하지 않고, 타입 불일치만 경고한다.)
        if (claim != null) {
            log.warn("[JWT] athIds 클레임 타입 불일치 — 빈 권한 목록 반환: actualType={}",
                    claim.getClass().getSimpleName());
        }
        return List.of();
```

- [ ] **Step 2: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.common.system.security.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/security/JwtUtil.java && git commit -m "refactor: warn on athIds claim type mismatch in JwtUtil"
```

---

## Task 10: CouncilService 회의일자 파싱 실패 warn (T5)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java:509-537`

**배경:** `toLocalDate()`가 문자열 회의일자를 파싱하다 `NumberFormatException`/`DateTimeException`을 `ignored`로 삼키고 null을 반환해, 잘못된 날짜가 UI에서 조용히 사라진다. 동작은 유지하되 원본 값을 warn으로 남긴다.

> **TDD 메모:** 로깅 보강. 로거 존재를 확인하고 없으면 추가.

- [ ] **Step 1: warn 추가**

`CouncilService.java:530-533` 교체 전:

```java
                } catch (NumberFormatException | java.time.DateTimeException ignored) {
                    // TODO: 회의일자 문자열 파싱 실패 시 원본 값을 warn 로그로 남겨 데이터 정합성 점검이 가능하게 합니다.
                    return null;
                }
```

교체 후:

```java
                } catch (NumberFormatException | java.time.DateTimeException e) {
                    // 회의일자 문자열이 yyyyMMdd로 변환되지 않으면 null 반환(카드에 미표시).
                    // 데이터 정합성 점검을 위해 원본 값과 원인 예외를 warn으로 남긴다.
                    log.warn("[협의회] 회의일자 파싱 실패 — 원본값={}", s, e);
                    return null;
                }
```

> **변수/로거 확인:** catch 진입 시점에 `s`(원본 문자열, `:522 if (val instanceof String s)`)가 스코프에 있는지 확인. 스코프 밖이면 `val`을 사용. `CouncilService`에 로거가 없으면 `@Slf4j`/`LoggerFactory` 추가.

- [ ] **Step 2: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.domain.council.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/council/service/CouncilService.java && git commit -m "refactor: warn on meeting-date parse failure in CouncilService"
```

---

## Task 11: NotificationService 알림 제목/내용 길이 강제 (T5)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationService.java:52-62`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/service/NotificationServiceTest.java`

**배경:** `send()`는 `event.ttl()`(제목, DB 최대 100자)/`event.infmMsgCone()`(본문, 최대 4000자)/`event.infmRcdUrl()`(URL, 최대 300자)을 길이 검증 없이 `Cinfmm` 빌더에 그대로 넣는다(`:57-59`). 발행자가 긴 문자열을 보내면 INSERT 시 ORA-12899(value too large)로 알림 적재가 실패한다. 저장 직전에 길이를 clamp하고 truncation 발생 시 warn 로그를 남긴다.

- [ ] **Step 1: 실패 테스트 작성 (RED)**

`NotificationServiceTest.java`(기존 테스트 파일)에 테스트 추가. 기존 테스트의 mock 셋업(`generateInfmMsgNo()`가 호출하는 시퀀스 repository mock + `cinfmmRepository.saveAndFlush(...)`)을 그대로 재사용한다. ArgumentCaptor로 빌드된 `Cinfmm`의 `ttl` 길이를 단정:

```java
    @Test
    @DisplayName("send: 제목이 100자를 초과하면 100자로 잘라 저장한다")
    void send_제목초과_100자로_clamp() {
        // Arrange
        String longTitle = "가".repeat(150);
        NotificationEvent event = NotificationEvent.builder()
                .recipientEno("E0001")
                .infmSvcTc("01")
                .ttl(longTitle)
                .infmMsgCone("본문")
                .build();
        given(cinfmmRepository.saveAndFlush(any(Cinfmm.class)))
                .willAnswer(inv -> inv.getArgument(0));

        // Act
        notificationService.send(event);

        // Assert
        ArgumentCaptor<Cinfmm> captor = ArgumentCaptor.forClass(Cinfmm.class);
        verify(cinfmmRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getTtl()).hasSize(100);
    }
```

> import: `org.mockito.ArgumentCaptor`, `static org.mockito.ArgumentMatchers.any`, `static org.mockito.Mockito.verify`, `static org.mockito.BDDMockito.given`, `com.kdb.it.common.notification.entity.Cinfmm`. 기존 `send` 성공 테스트가 시퀀스 채번 mock을 어떻게 셋업하는지 먼저 확인하고 동일하게 맞춘다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.notification.service.NotificationServiceTest"`
Expected: FAIL — 현재 ttl이 150자 그대로 저장됨(`hasSize(100)` 불만족).

- [ ] **Step 3: clamp 구현 (GREEN)**

`NotificationService.java:52-62` 교체 전:

```java
        String infmMsgNo = generateInfmMsgNo();

        Cinfmm notification = Cinfmm.builder()
            .infmMsgNo(infmMsgNo)
            .infmSvcTc(event.infmSvcTc())
            .ttl(event.ttl())
            .infmMsgCone(event.infmMsgCone())
            .infmRcdUrl(event.infmRcdUrl())
            .rmsEno(event.recipientEno())
            .inqYn("N")
            .build();
```

교체 후:

```java
        String infmMsgNo = generateInfmMsgNo();

        // DB 컬럼 길이(제목 100자 / 본문 4000자 / URL 300자)를 초과하면 INSERT가 ORA-12899로 실패하므로
        // 저장 직전에 안전하게 잘라낸다. truncation 발생 시 발행자 측 데이터 점검을 위해 warn 로그를 남긴다.
        Cinfmm notification = Cinfmm.builder()
            .infmMsgNo(infmMsgNo)
            .infmSvcTc(event.infmSvcTc())
            .ttl(clamp("제목", infmMsgNo, event.ttl(), 100))
            .infmMsgCone(clamp("본문", infmMsgNo, event.infmMsgCone(), 4000))
            .infmRcdUrl(clamp("URL", infmMsgNo, event.infmRcdUrl(), 300))
            .rmsEno(event.recipientEno())
            .inqYn("N")
            .build();
```

그리고 `send()` 메서드 **아래**에 private 헬퍼 추가:

```java
    /**
     * 알림 문자열 필드를 DB 컬럼 최대 길이로 안전하게 잘라냅니다.
     *
     * @param fieldLabel 로그용 필드 라벨(제목/본문/URL)
     * @param infmMsgNo  진단용 알림 채번
     * @param value      원본 값(null이면 그대로 null 반환)
     * @param maxLen     허용 최대 길이
     * @return maxLen 이하로 잘린 값(또는 원본/널)
     */
    private String clamp(String fieldLabel, String infmMsgNo, String value, int maxLen) {
        if (value == null || value.length() <= maxLen) {
            return value;
        }
        log.warn("[알림] {} 길이 초과 — {}자→{}자로 절단: infmMsgNo={}",
                fieldLabel, value.length(), maxLen, infmMsgNo);
        return value.substring(0, maxLen);
    }
```

> **확인:** `NotificationService`에 `log` 필드가 있는지 확인(기존 `send()`가 `log.info(...)`를 사용하므로 존재함 — `:47`).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.notification.service.NotificationServiceTest"`
Expected: PASS (신규 + 기존 테스트 통과).

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/notification/service/NotificationService.java src/test/java/com/kdb/it/common/notification/service/NotificationServiceTest.java && git commit -m "feat: clamp notification title/body/url to DB column limits"
```

---

## Task 12: GeminiService RestClient 타임아웃 (T6)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java:95-109`

**배경:** `RestClient.builder().baseUrl(baseUrl).build()`에 connect/read 타임아웃이 없어(B-H-04/B-H-06) Gemini API 응답 지연 시 스레드가 무한 대기하고 스레드풀이 고갈될 수 있다. JDK `HttpClient` 기반 `JdkClientHttpRequestFactory`로 connect 5s / read 60s를 설정한다.

> **TDD 메모:** 타임아웃 설정은 `RestClient` 내부 상태라 단위 테스트로 값 단정이 어렵다(기존 테스트는 `restClient` 필드를 reflection으로 mock 교체 — `GeminiServiceTest.java:65`). 본 Task는 인프라 설정 변경으로 분류하고, **생성자 시그니처를 변경하지 않으므로** 기존 `GeminiServiceTest`가 그대로 통과하는지로 회귀를 막는다.

- [ ] **Step 1: 타임아웃 설정 적용**

`GeminiService.java:103-108`(생성자 내 RestClient 빌드) 교체 전:

```java
        // FIXME: [B-H-06] connectTimeout/readTimeout 설정 필요, 미설정시 스레드풀 고갈 위험
        // FIXME: [B-H-04] RestClient 타임아웃 미설정 — Gemini API 응답 지연 시 스레드 무한 대기 가능
        // HttpClient.newBuilder().connectTimeout(5s)/readTimeout(60s) 설정 후 .httpClient() 주입 필요
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
```

교체 후:

```java
        // 외부 Gemini API 응답 지연이 스레드를 무한 점유하지 않도록 connect/read 타임아웃을 강제한다.
        // JDK HttpClient의 connectTimeout(5s) + 요청별 readTimeout(60s)을 RequestFactory에 설정한다.
        java.net.http.HttpClient httpClient = java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(5))
                .build();
        org.springframework.http.client.JdkClientHttpRequestFactory requestFactory =
                new org.springframework.http.client.JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(java.time.Duration.ofSeconds(60));
        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
```

> **검증 메모:** `JdkClientHttpRequestFactory`는 Spring Framework 6.1+에 존재하며 Spring Boot 4.1.0에 포함된다. `setReadTimeout(Duration)` 시그니처를 Step 2 컴파일로 확인한다. 미존재 시 `setReadTimeout(int millis)`(밀리초) 또는 `ClientHttpRequestFactorySettings`로 대체한다. 가독성을 위해 import 문(`java.net.http.HttpClient`, `java.time.Duration`, `org.springframework.http.client.JdkClientHttpRequestFactory`)을 상단으로 끌어올려도 무방.

- [ ] **Step 2: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.infra.ai.service.GeminiServiceTest"`
Expected: BUILD SUCCESSFUL (생성자 시그니처 불변 → 기존 테스트 통과).

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/infra/ai/service/GeminiService.java && git commit -m "feat: set RestClient connect/read timeouts in GeminiService"
```

---

## Task 13: GeminiService 첨부 크기 사전검사 + 읽기 실패 warn (T6 + T5: B-H-03/B-M-05)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java:252-296` (`buildFilePartFromFlMngNo`)

**배경:** `buildFilePartFromFlMngNo()`는 `Files.readAllBytes(filePath)`로 파일 전체를 **크기 검사 없이** 메모리에 올린다(20MB 제한이 JavaDoc에만 있고 미구현). 대형 파일은 OOM·Base64 폭증을 유발한다. 읽기 전 `Files.size()`로 사전검사하고, IOException catch에 **warn 로그를 추가**한다(B-H-03/B-M-05 — 현재 무로그).

> **TDD 메모:** 파일시스템 I/O라 단위 테스트가 무겁다. 사전검사 상수와 skip 사유 문자열은 명확하므로, 가능하면 `@TempDir`로 "크기 초과 → skip" 케이스 테스트를 추가하되, 기존 테스트 인프라가 reflection 기반이라 부담되면 컴파일 + 기존 `GeminiServiceTest` 통과로 갈음한다.

- [ ] **Step 1: 크기 상수 추가**

`GeminiService` 클래스 상단 상수 영역에 추가:

```java
    /** Gemini 첨부 파일당 최대 허용 크기(20MB). 초과 시 해당 파일은 스킵한다. */
    private static final long MAX_ATTACHMENT_BYTES = 20L * 1024 * 1024;
```

- [ ] **Step 2: 사전검사 + warn 추가**

`GeminiService.java:273-280`(파일 읽기 블록) 교체 전:

```java
        byte[] fileBytes;
        try {
            fileBytes = Files.readAllBytes(filePath);
        } catch (IOException e) {
            // TODO: [B-M-05] IOException 발생시 warn 로그 추가 후 skip 처리 필요
            // TODO: [B-H-03] log.warn("AI 분석 파일 읽기 실패, 스킵: {}", filePath, e) 최소한 warn 로그 필요
            return FilePartResult.skip("파일 읽기 실패: " + e.getMessage());
        }
```

교체 후:

```java
        // 대형 파일이 메모리를 점유하거나 Base64 폭증을 일으키지 않도록 읽기 전에 크기를 사전검사한다.
        try {
            long size = Files.size(filePath);
            if (size > MAX_ATTACHMENT_BYTES) {
                log.warn("[Gemini] 첨부 크기 초과로 스킵 - flMpnId: {}, size: {}MB (제한: 20MB)",
                        flMpnId, size / (1024 * 1024));
                return FilePartResult.skip("첨부 크기 초과(20MB): " + (size / (1024 * 1024)) + "MB");
            }
        } catch (IOException e) {
            log.warn("[Gemini] 첨부 크기 조회 실패로 스킵 - filePath: {}", filePath, e);
            return FilePartResult.skip("첨부 크기 조회 실패: " + e.getMessage());
        }

        byte[] fileBytes;
        try {
            fileBytes = Files.readAllBytes(filePath);
        } catch (IOException e) {
            // 파일 읽기 실패 시 해당 파일만 스킵하고 원인 예외를 warn으로 남긴다.
            log.warn("[Gemini] AI 분석 파일 읽기 실패로 스킵 - filePath: {}", filePath, e);
            return FilePartResult.skip("파일 읽기 실패: " + e.getMessage());
        }
```

> **변수 확인:** `flMpnId`가 메서드 파라미터로 스코프에 있는지 확인(`buildFilePartFromFlMngNo(String flMpnId)`).

- [ ] **Step 3: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.infra.ai.service.GeminiServiceTest"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/infra/ai/service/GeminiService.java && git commit -m "feat: precheck attachment size and warn on read failure in GeminiService"
```

---

## Task 14: GeminiDto Request Bean Validation (T7)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/ai/dto/GeminiDto.java:1-61`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/ai/controller/GeminiController.java` (generate에 `@Valid`)
- Test: `it_backend/src/test/java/com/kdb/it/infra/ai/controller/GeminiControllerTest.java`

**배경:** `GeminiDto.Request`는 `prompt`/`systemInstruction`/`flMpnIds`에 Bean Validation이 전혀 없다. 컨트롤러가 `@Valid`를 적용하도록 DTO에 제약을 추가한다(`@NotBlank` prompt, `@Size` 길이 한도, 첨부수 `@Size`).

> **선행 확인:** `GeminiController.generate(...)` 엔드포인트의 `@RequestBody`에 `@Valid`가 있는지 확인한다. 없으면 본 Task에서 함께 추가한다.

- [ ] **Step 1: 검증 실패 테스트 추가 (RED)**

`GeminiControllerTest.java`에 빈 prompt → 400 케이스 추가(기존 `@WebMvcTest` 셋업 재사용):

```java
    @Test
    @DisplayName("generate: prompt가 비어있으면 400을 반환한다")
    void generate_빈prompt_400반환() throws Exception {
        GeminiDto.Request request = GeminiDto.Request.builder()
                .prompt("   ")
                .build();

        mockMvc.perform(post("/api/gemini/generate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.ai.controller.GeminiControllerTest"`
Expected: FAIL — 현재 @Valid/제약 없음 → 200 또는 서비스 진입(400 아님).

- [ ] **Step 3: DTO 제약 + 컨트롤러 @Valid 추가 (GREEN)**

`GeminiDto.java` import 블록에 추가:

```java
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
```

`Request.prompt` 필드 — 교체 전:

```java
    @Schema(description = "Gemini에게 전달할 프롬프트", example = "요구사항 정의서 작성을 도와줘")
    private String prompt;
```

교체 후:

```java
    @Schema(description = "Gemini에게 전달할 프롬프트", example = "요구사항 정의서 작성을 도와줘")
    @NotBlank(message = "프롬프트는 필수입니다.")
    @Size(max = 10000, message = "프롬프트는 10000자를 초과할 수 없습니다.")
    private String prompt;
```

`Request.systemInstruction` 필드 — 교체 전:

```java
    @Schema(description = "시스템 지시문 (선택)", example = "당신은 IT 프로젝트 요구사항 분석 전문가입니다.")
    private String systemInstruction;
```

교체 후:

```java
    @Schema(description = "시스템 지시문 (선택)", example = "당신은 IT 프로젝트 요구사항 분석 전문가입니다.")
    @Size(max = 4000, message = "시스템 지시문은 4000자를 초과할 수 없습니다.")
    private String systemInstruction;
```

`Request.flMpnIds` 필드 — 교체 전:

```java
    @Schema(description = "첨부파일 매핑ID 목록 (선택, 예: [\"FL_00000001\", \"FL_00000002\"])")
    private List<String> flMpnIds;
```

교체 후:

```java
    @Schema(description = "첨부파일 매핑ID 목록 (선택, 최대 10개, 예: [\"FL_00000001\", \"FL_00000002\"])")
    @Size(max = 10, message = "첨부파일은 최대 10개까지 가능합니다.")
    private List<String> flMpnIds;
```

그리고 `GeminiController.generate(...)`의 `@RequestBody` 파라미터에 `@Valid`를 추가하고 `import jakarta.validation.Valid;`를 확인/추가:

```java
public ResponseEntity<GeminiDto.Response> generate(@Valid @RequestBody GeminiDto.Request request) {
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.ai.controller.GeminiControllerTest"`
Expected: PASS (신규 400 케이스 + 기존 케이스 통과).

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/infra/ai/dto/GeminiDto.java src/main/java/com/kdb/it/infra/ai/controller/GeminiController.java src/test/java/com/kdb/it/infra/ai/controller/GeminiControllerTest.java && git commit -m "feat: add Bean Validation to GeminiDto.Request and @Valid in controller"
```

---

## Task 15: ApplicationController @Valid 추가 (T7)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java:146-153, 173-179`

**배경:** `submit`(`:149`)과 `approve`(`:177`)의 `@RequestBody`에 `@Valid`가 없어 DTO Bean Validation이 동작하지 않는다(FIXME 등록됨). `jakarta.validation.Valid`는 **이미 import됨**(`:21`). `recall()`(`:213`)은 이미 `@Valid` 적용 — 참고 패턴.

> **TDD 메모:** DTO에 실제 제약이 있어야 400을 단정할 수 있다. `ApplicationDto.CreateRequest`/`ApproveRequest`에 `@NotBlank` 등 제약이 이미 있으면 무효 입력→400 테스트를 추가한다. 제약이 없으면 본 Task는 `@Valid` 배선만 하고(향후 DTO 제약 추가 시 자동 발효), 컴파일 + 기존 컨트롤러 테스트 통과로 갈음한다. 먼저 `ApplicationDto`를 Read해 기존 제약 유무를 확인한다.

- [ ] **Step 1: submit에 @Valid 추가**

`ApplicationController.java:148-149` 교체 전:

```java
        // FIXME: @Valid 추가 필요 — Bean Validation이 동작하지 않아 미검증 입력이 서비스 레이어로 전달됨 (CLAUDE.md §5.5.2)
    public ResponseEntity<String> submit(@RequestBody ApplicationDto.CreateRequest request) {
```

교체 후:

```java
    public ResponseEntity<String> submit(@Valid @RequestBody ApplicationDto.CreateRequest request) {
```

- [ ] **Step 2: approve에 @Valid 추가**

`ApplicationController.java:175-177` 교체 전:

```java
    public ResponseEntity<Void> approve(@PathVariable("apfMngNo") String apfMngNo,
        // FIXME: @Valid 추가 필요 — Bean Validation이 동작하지 않아 미검증 입력이 서비스 레이어로 전달됨 (CLAUDE.md §5.5.2)
            @RequestBody ApplicationDto.ApproveRequest request) {
```

교체 후:

```java
    public ResponseEntity<Void> approve(@PathVariable("apfMngNo") String apfMngNo,
            @Valid @RequestBody ApplicationDto.ApproveRequest request) {
```

- [ ] **Step 3: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.common.approval.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java && git commit -m "fix: add @Valid to ApplicationController submit/approve endpoints"
```

---

## Task 16: NotificationController size @Max (T7)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/controller/NotificationController.java:40-45`

**배경:** `list()`의 `size` @RequestParam에 상한이 없어(`:44`) 과대 페이지 요청이 가능하다. `@Max(200)`을 적용한다. `@RequestParam`의 제약 발효를 위해 **클래스에 `@Validated`가 필요**하다(현재 없음, jakarta import도 없음).

- [ ] **Step 1: import + @Validated + @Max 추가**

import 블록에 추가:

```java
import jakarta.validation.constraints.Max;
import org.springframework.validation.annotation.Validated;
```

클래스 선언에 `@Validated` 추가(`@RestController` 인근):

```java
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Validated
public class NotificationController {
```

`size` 파라미터(`:44`) 교체 전:

```java
        @RequestParam(value = "size", defaultValue = "20") int size
```

교체 후:

```java
        @Max(value = 200, message = "size는 최대 200까지 가능합니다.")
        @RequestParam(value = "size", defaultValue = "20") int size
```

> **메모:** `@Validated`가 던지는 `ConstraintViolationException`은 현재 `GlobalExceptionHandler`에 전용 핸들러가 없어 `RuntimeException` 핸들러로 400이 된다(400 자체는 적절). 정밀한 메시지가 필요하면 후속 Phase에서 `ConstraintViolationException` 핸들러를 추가한다(본 Task 범위 밖).

- [ ] **Step 2: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.common.notification.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/notification/controller/NotificationController.java && git commit -m "feat: cap notification list size at 200 via @Max"
```

---

## Task 17: 사업집행 4단계 DTO 금액/플래그 검증 (T7)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/dto/EstimateDto.java:32-38`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/dto/DeliberationDto.java:24-34`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/dto/ContractDto.java:25-33`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/dto/PaymentDto.java:14-40`

**배경:** 금융 금액 필드(`rqmBgAmt`/`cttAmt`/`dfrAmt`)에 음수 차단(`@DecimalMin("0")`)이 없고, YN 플래그(`taskDbrOmtYn`)에 형식 제약(`@Pattern("^[YN]$")`)이 없다(CLAUDE.md §5.18 권장). 각 DTO에 제약과 import를 추가한다. 컨트롤러는 이미 mutating 엔드포인트에 `@Valid`를 적용한다(§5.18).

> **TDD 메모:** 각 도메인 컨트롤러 테스트가 있으면 음수 금액→400 케이스 1건씩 추가가 이상적이다. 4개 도메인 컨트롤러 테스트 인프라가 일관되지 않을 수 있으므로, 최소한 EstimateController 또는 PaymentController 테스트 1곳에 음수 금액 400 케이스를 추가하고 나머지는 DTO 제약 + 컴파일 통과로 갈음한다.
>
> **줄번호 주의:** 4단계 DTO는 레코드가 조밀해 줄번호가 근접한다. 각 Edit 전 해당 DTO를 Read해 정확한 위치를 확인하고, 동일 토큰(`BigDecimal cttAmt`)이 한 파일에 여러 번 나오면 더 넓은 컨텍스트로 unique 매칭한다.

- [ ] **Step 1: EstimateDto.LineRequest — rqmBgAmt @DecimalMin**

import 블록에 추가:

```java
import jakarta.validation.constraints.DecimalMin;
```

`EstimateDto.java`(LineRequest) 교체 전:

```java
    public record LineRequest(
            @NotBlank @Size(max = 5) String svnTemC,
            @NotBlank @Size(max = 7) String ioeC,
            @NotNull BigDecimal rqmBgAmt,
            @Size(max = 1000) String opnnCone
    ) {}
```

교체 후:

```java
    public record LineRequest(
            @NotBlank @Size(max = 5) String svnTemC,
            @NotBlank @Size(max = 7) String ioeC,
            @NotNull @DecimalMin(value = "0", message = "산정 예산액은 0 이상이어야 합니다.") BigDecimal rqmBgAmt,
            @Size(max = 1000) String opnnCone
    ) {}
```

- [ ] **Step 2: DeliberationDto.ResultRequest — taskDbrOmtYn @Pattern**

import 블록에 추가:

```java
import jakarta.validation.constraints.Pattern;
```

`DeliberationDto.java`(ResultRequest 내 taskDbrOmtYn) 교체 전:

```java
            @Size(max = 1) String taskDbrOmtYn,
```

교체 후:

```java
            @Pattern(regexp = "^[YN]$", message = "심의생략여부는 Y 또는 N이어야 합니다.") String taskDbrOmtYn,
```

- [ ] **Step 3: ContractDto.WorkRequest — cttAmt @DecimalMin**

import 블록에 추가:

```java
import jakarta.validation.constraints.DecimalMin;
```

`ContractDto.java`(WorkRequest 내 cttAmt) 교체 전:

```java
            BigDecimal cttAmt,
```

교체 후:

```java
            @DecimalMin(value = "0", message = "계약금액은 0 이상이어야 합니다.") BigDecimal cttAmt,
```

- [ ] **Step 4: PaymentDto — cttAmt(2곳)/dfrAmt @DecimalMin**

import 블록에 추가:

```java
import jakarta.validation.constraints.DecimalMin;
```

`PaymentDto.java`의 `CreateRequest.cttAmt`, `UpdateRequest.cttAmt`, `LineRequest.dfrAmt` 세 곳을 교체한다.

`CreateRequest` 내(끝 필드, 콤마 없음) — 교체 전 → 후:

```java
            BigDecimal cttAmt
```
→
```java
            @DecimalMin(value = "0", message = "계약금액은 0 이상이어야 합니다.") BigDecimal cttAmt
```

`UpdateRequest` 내(끝 필드, 콤마 없음) — 위와 동일 토큰이므로 **각 record 블록의 인접 줄을 포함해 unique 매칭**한다. 교체 전 → 후:

```java
            @Size(max = 100) String cttNm,
            BigDecimal cttAmt
```
→
```java
            @Size(max = 100) String cttNm,
            @DecimalMin(value = "0", message = "계약금액은 0 이상이어야 합니다.") BigDecimal cttAmt
```

> CreateRequest도 `@Size(max = 100) String cttNm,` 다음에 `BigDecimal cttAmt`가 오므로, 두 record가 동일 2줄 패턴을 가질 수 있다. 이 경우 `replace_all` 대신 각 record를 Read 후 더 넓은 범위(레코드 선언 `@Schema` 라인 포함)로 개별 Edit한다.

`LineRequest` 내 — 교체 전 → 후:

```java
            BigDecimal dfrAmt,
```
→
```java
            @DecimalMin(value = "0", message = "지급금액은 0 이상이어야 합니다.") BigDecimal dfrAmt,
```

- [ ] **Step 5: (선택) 음수 금액 검증 테스트 추가 (RED→GREEN)**

EstimateController 또는 PaymentController 테스트에 음수 금액 `@DecimalMin` 위반 → 400 케이스를 1건 추가(기존 테스트 셋업 재사용). 제약 추가 전에는 통과/서비스 진입, 추가 후 400.

- [ ] **Step 6: 컴파일 + 회귀 확인**

Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.domain.estimate.*" --tests "com.kdb.it.domain.deliberation.*" --tests "com.kdb.it.domain.contract.*" --tests "com.kdb.it.domain.payment.*"`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/estimate/dto/EstimateDto.java src/main/java/com/kdb/it/domain/deliberation/dto/DeliberationDto.java src/main/java/com/kdb/it/domain/contract/dto/ContractDto.java src/main/java/com/kdb/it/domain/payment/dto/PaymentDto.java && git commit -m "feat: add amount/flag Bean Validation to estimate/deliberation/contract/payment DTOs"
```

---

## Task 18: TiptapVariableService FORBIDDEN 권한 분기 (T7)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/service/TiptapVariableService.java:80-120`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/...` ResolvedValue 정의 파일(forbidden 팩토리), `TiptapVariableController`
- Test: `it_backend/src/test/java/com/kdb/it/common/system/tiptap/service/TiptapVariableServiceTest.java`

**배경:** `resolveOne()`은 OK/INVALID/MISSING만 반환하고 FORBIDDEN 분기가 미구현이다(`:88-92` TODO). 서비스는 현재 SecurityContext에 접근하지 않는다. 본 Task는 **권한 훅 지점을 실제 분기로 구현**한다: 사업(PROJ) 카테고리 토큰에 대해 현재 사용자의 권한을 확인하고, 불가 시 `ResolvedValue.forbidden()`을 반환한다.

> **설계 결정:** 권한 정책의 정확한 범위(어떤 부서가 어떤 PROJ를 볼 수 있는지)는 별도 업무 요건이다. 본 계획은 **확장 가능한 훅 + 기본 정책(관리자/부서매니저는 전체 허용, 그 외는 PROJ 토큰 FORBIDDEN)**을 구현하고, 세부 부서-사업 매핑은 후속 과제로 남긴다. `ResolvedValue.forbidden()` 팩토리가 없으면 함께 추가한다.

- [ ] **Step 1: 실패 테스트 작성 (RED)**

`TiptapVariableServiceTest.java`(있으면 사용, 없으면 생성)에 테스트 추가. 권한 판정을 위해 `resolve()`가 사용자 컨텍스트를 받도록 시그니처를 확장한다(Step 3). 일반 사용자가 PROJ 토큰을 해석하면 FORBIDDEN:

```java
    @Test
    @DisplayName("resolve: 일반 사용자가 사업(PROJ) 토큰을 요청하면 FORBIDDEN을 반환한다")
    void resolve_일반사용자_PROJ토큰_FORBIDDEN() {
        // Arrange
        CustomUserDetails user = mock(CustomUserDetails.class);
        given(user.isAdmin()).willReturn(false);
        given(user.isDeptManager()).willReturn(false);

        // Act
        ResolveResponse res = service.resolve(List.of("2026.proj.P001.allocationRate"), user);

        // Assert
        assertThat(res.results().get("2026.proj.P001.allocationRate").status()).isEqualTo("FORBIDDEN");
    }
```

> import: `static org.mockito.Mockito.mock`, `static org.mockito.BDDMockito.given`, `com.kdb.it.common.system.security.CustomUserDetails`, 서비스 DTO들. 기존 테스트가 `resolve(List)` 시그니처를 쓰면 그 호출부도 새 시그니처(Step 4)로 갱신해야 한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.tiptap.service.TiptapVariableServiceTest"`
Expected: 컴파일 실패(2-arg resolve 없음) 또는 FORBIDDEN 미반환.

- [ ] **Step 3: forbidden 팩토리 + resolve 시그니처 확장 + 분기 구현 (GREEN)**

`ResolvedValue`에 `forbidden()` 팩토리가 없으면 추가(기존 `invalid()`/`missing()` 패턴을 따름):

```java
    /** 권한 없음 — 사용자가 해당 토큰을 조회할 권한이 없음. */
    public static ResolvedValue forbidden() {
        return new ResolvedValue("", "FORBIDDEN");
    }
```

`resolve()` 시그니처를 사용자 컨텍스트를 받도록 확장 — 교체 전:

```java
    public ResolveResponse resolve(List<String> tokens) {
        Map<String, ResolvedValue> results = new LinkedHashMap<>();
        for (String token : tokens) {
            results.put(token, resolveOne(token));
        }
        return new ResolveResponse(results);
    }
```

교체 후:

```java
    public ResolveResponse resolve(List<String> tokens, CustomUserDetails user) {
        Map<String, ResolvedValue> results = new LinkedHashMap<>();
        for (String token : tokens) {
            results.put(token, resolveOne(token, user));
        }
        return new ResolveResponse(results);
    }
```

`resolveOne()`에 FORBIDDEN 분기 추가 — 교체 전(`:93-97`):

```java
    private ResolvedValue resolveOne(String token) {
        ParseResult parsed = tokenParser.parse(token);
        if (!parsed.valid()) {
            return ResolvedValue.invalid();
        }
```

교체 후:

```java
    private ResolvedValue resolveOne(String token, CustomUserDetails user) {
        ParseResult parsed = tokenParser.parse(token);
        if (!parsed.valid()) {
            return ResolvedValue.invalid();
        }
        // 사업(PROJ) 토큰은 부서/권한 종속 데이터이므로 관리자·부서매니저만 허용한다.
        // 일반 사용자는 FORBIDDEN으로 차단(세부 부서-사업 매핑은 후속 과제).
        if (parsed.category() == Category.PROJ
                && (user == null || (!user.isAdmin() && !user.isDeptManager()))) {
            return ResolvedValue.forbidden();
        }
```

import에 `com.kdb.it.common.system.security.CustomUserDetails`를 추가하고, `Category` enum이 접근 가능한지 확인한다(같은 패키지면 import 불필요).

- [ ] **Step 4: 컨트롤러 호출부 갱신**

`TiptapVariableController`의 resolve 엔드포인트가 `@AuthenticationPrincipal CustomUserDetails user`를 받아 `service.resolve(req.tokens(), user)`로 전달하도록 갱신한다. metadata 엔드포인트는 본 Task 범위 밖(향후 카탈로그 필터링). 기존 `resolve(List)` 호출부(컨트롤러/테스트)를 모두 새 시그니처로 갱신한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.system.tiptap.*"`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/system/tiptap/ src/test/java/com/kdb/it/common/system/tiptap/ && git commit -m "feat: add FORBIDDEN branch for PROJ tokens in TiptapVariableService"
```

---

## Task 19: 통합 검증 & 백로그 동기화

**Files:**
- Modify: `TASK.md` (루트), 선택적으로 `TASK_DONE.md`

- [ ] **Step 1: 전체 컴파일**

Run: `cd it_backend && ./gradlew compileJava compileTestJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 2: 영향 범위 테스트 재실행**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.exception.*" --tests "com.kdb.it.infra.ai.*" --tests "com.kdb.it.common.notification.*" --tests "com.kdb.it.common.system.*" --tests "com.kdb.it.domain.*"`
Expected: PASS (실패 시 해당 Task로 복귀해 수정).

- [ ] **Step 3: 전체 테스트(공통 영향 변경 재검증)**

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL. (CLAUDE.md §5.9 — 인증/파일/변경로그/알림 등 공통 영향 변경은 clean test 권장.)

- [ ] **Step 4: 백로그 이관**

`TASK.md`의 ⚠️ 에러 처리·🔒 보안 섹션에서 본 계획으로 처리된 항목(B-H-01/B-C-02/B-M-03/B-M-02/B-H-05/B-H-06/B-M-01/B-M-04, Gemini 타임아웃·첨부크기, ApplicationController @Valid, GeminiDto/4단계 DTO 검증, NotificationController @Max, Tiptap FORBIDDEN)을 제거하고 `TASK_DONE.md`에 근거(`파일:라인`)와 함께 이관한다. 신규 발견 3건(로드맵 §1.3) 중 ApplicationController @Valid는 본 계획에서 완료 처리.

- [ ] **Step 5: 커밋**

```bash
cd /c/it && git add TASK.md TASK_DONE.md && git commit -m "docs: move Phase 2 error-propagation/input-safety items to TASK_DONE"
```

---

## Self-Review

- **Spec coverage:**
  - **T4** — Task 1(NotFoundException)·Task 2(404 + ResponseStatusException 핸들러)로 구현. AccessDeniedException 403 핸들러는 Phase 1에서 이미 완료되어 **중복 구현하지 않고 명시 참조**(범위 메모). 403/404/500 모두 보존. ✓
  - **T5** — ChangeLogEntityListener(Task 3), AuditLogPersister(Task 4), PlanService(Task 5), FileService(Task 6), SsoController(Task 7), AdminLogService(Task 8), JwtUtil(Task 9), CouncilService(Task 10), NotificationEvent 길이 강제(Task 11, NotificationService.send에서 clamp) — 로드맵 T5의 10개 지점 모두 커버. `FileService.uploadFileInternal`은 이미 cause를 전달해 대상에서 제외(명시). ✓
  - **T6** — RestClient 타임아웃(Task 12) + 첨부 크기 사전검사(Task 13). ✓
  - **T7** — ApplicationController @Valid(Task 15), GeminiDto(Task 14), 4단계 DTO @DecimalMin/@Pattern(Task 17), NotificationController @Max(Task 16), TiptapVariableService FORBIDDEN(Task 18). ✓
- **Placeholder scan:** 모든 코드 스텝에 실제 before/after 코드 포함. "유사하게"/"적절히" 류 표현 없음. 줄번호 재확인이 필요한 일부 지점(PlanService 들여쓰기, PaymentDto 중복 cttAmt, CouncilService 변수 스코프)은 **Read 후 편집** 지시를 명시. ✓
- **Type consistency:**
  - `NotFoundException extends RuntimeException` — Task 1 정의 ↔ Task 2 핸들러 시그니처 일치. ✓
  - `buildErrorResponse(HttpStatus, String)` 기존 헬퍼 재사용 — 신규 핸들러 2종이 동일 시그니처 호출. ✓
  - `ResponseStatusException` import는 `org.springframework.web.server.ResponseStatusException`로 핸들러·PlanService 통일(PlanService는 이미 import 확인됨). ✓
  - `clamp(String, String, String, int)` — Task 11 정의 ↔ 호출 일치. ✓
  - Tiptap `resolve(List, CustomUserDetails)` — Task 18 정의 ↔ 컨트롤러 호출 일치(Step 4에서 호출부 갱신 명시). ✓
- **검증이 필요한 가정(실행자 주의):**
  - `JdkClientHttpRequestFactory.setReadTimeout(Duration)` 시그니처(Spring Boot 4.1.0) — Task 12 Step 2 컴파일로 확인. 미존재 시 int(밀리초) 오버로드/`ClientHttpRequestFactorySettings`로 대체.
  - `CustomGeneralException(String, Throwable)` 생성자 — `FileService.uploadFileInternal`이 이미 사용하므로 존재(`:319, 327`).
  - `CustomUserDetails.isAdmin()`/`isDeptManager()` — CLAUDE.md §5.6 RBAC에 정의됨(존재 확인).
  - 각 T5 로깅 보강 Task의 로거 필드 유무 — Step에 "없으면 추가" 지시 포함(PlanService는 없음을 확인, JwtUtil·NotificationService는 있음을 확인).
  - `ResolvedValue.forbidden()` 팩토리 — Task 18에서 없으면 추가 지시.
