# Phase A — 보안 트랜잭션 무결성 (SEC-08, SEC-09) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 재사용/만료 탐지 시 Refresh Token 패밀리 폐기(SEC-08)와 로그인 실패 이력(SEC-09)을 인증 거부 롤백과 무관하게 독립 커밋시켜, 비관적 락 교착 없이 보안 통제(패밀리 폐기·계정 잠금)의 실효성을 복원한다.

**Architecture:** `AuthService.refreshAccessToken`을 비트랜잭션 오케스트레이터로 바꾸고, 비관적 락 회전은 별도 빈 `RefreshTokenRotator.rotate()`(`@Transactional`)로 분리한다. 재사용/만료는 삭제 없이 타입 마커 예외로 회전 트랜잭션을 롤백해 락을 해제하고, 오케스트레이터가 `RefreshTokenRevoker`(`REQUIRES_NEW`+flush)로 패밀리를 별도 커밋한 뒤 `InvalidRefreshTokenException`을 던진다. 로그인 실패 이력은 신규 `LoginHistoryWriter`(`REQUIRES_NEW`+flush)로 독립 커밋해 `LoginAttemptService`의 5회/10분 잠금 근거를 보존한다.

**Tech Stack:** Spring Boot, JPA/Hibernate, Oracle, JUnit5 + Mockito + @Tag("it") 로컬 Oracle 통합 테스트

---

## 설계 미결 항목 해소 (구현 전 확정 사실)

읽은 실제 파일 기준으로 스펙 §7 미결 항목 #1을 확정한다.

- **SEC-08 탐지 read 잠금 모드 = PESSIMISTIC_WRITE (확정).** `RefreshTokenRepository.findByEcyRnwPubTokCone`(`RefreshTokenRepository.java:54-55`)에 `@Lock(LockModeType.PESSIMISTIC_WRITE)`가 붙어 있고, 회전 검증용 `findByFamNmAndAvlYn`(`:64-65`)도 동일하다. 따라서 단순 `REQUIRES_NEW` 삭제 빈은 outer가 잠근 행을 inner가 DELETE하려다 자기교착(self-deadlock)에 빠진다. **스펙의 2-트랜잭션 분리를 그대로 채택**한다(회전 TX가 탐지 시 read만 한 상태로 롤백→락 해제→별도 TX 폐기).
- **CLOGNH/CRTOKM 감사 컬럼 NOT NULL (확정).** `ITPOWN_DDL_live.sql`에서 `TPRMPP_CLOGNH`(`:1912-1918`)와 `TPRMPP_CRTOKM`(`:2044-2050`)의 `FST_ENR_USID`/`LST_CHG_USID`가 `NOT NULL`이다. `JpaAuditConfig.auditorProvider()`는 인증 컨텍스트가 없으면 `Optional.empty()`를 반환하고(`JpaAuditConfig.java:51-56`), Hibernate는 감사 컬럼에 명시적 NULL을 INSERT하므로 제약 위반이 난다. 지금까지는 실패 이력 INSERT가 원 트랜잭션 롤백으로 flush되지 않아 이 위반이 잠복해 있었다. **독립 커밋으로 실제 flush되므로, 두 `@Tag("it")` 격리 테스트는 `AuditFailureIsolationIT`처럼 `@BeforeEach`에서 SecurityContext를 심어 감사자를 채운다.**
- **회전 TX 롤백의 안전성.** `rotate()`는 재사용/만료를 탐지하는 시점까지 `findByEcyRnwPubTokCone` read만 수행하므로, 마커 예외로 롤백해도 유실되는 쓰기가 없다(폐기는 오케스트레이터가 별도 커밋).
- **만료 분기 폐기 범위 결정.** 기존 만료 분기는 `refreshTokenRepository.delete(refreshToken)`(단일 행)이었다. 2-TX 분리 후 오케스트레이터는 롤백된 마커 예외에서 `eno`만 보유하므로, 만료도 `RefreshTokenRevoker.revokeFamilyByEno(eno)`(패밀리 단위)로 통일한다. 1인 1패밀리 정책상 만료 토큰의 패밀리 = 해당 토큰뿐이며, 과다 폐기는 재로그인 유도로 보안상 안전하다(스펙 §3.1의 `revokeSingle`은 "필요 시" 선택지였고 채택하지 않는다).

---

## File Structure

**신규 생성 (Create)** — 모두 `it_backend/src/main/java/com/kdb/it/common/system/service/` 하위:

| 파일 | 단일 책임 |
| --- | --- |
| `LoginHistoryWriter.java` | SEC-09: 로그인 실패 이력을 `REQUIRES_NEW`+`flush`로 독립 커밋 |
| `RefreshTokenRevoker.java` | SEC-08: 패밀리 폐기(`deleteByEno`)를 `REQUIRES_NEW`+`flush`로 독립 커밋 |
| `RefreshTokenRotator.java` | SEC-08: 비관적 락 회전 트랜잭션(정상 회전 / 탐지 시 마커 예외로 롤백) |
| `RefreshReuseDetectedException.java` | 재사용 내부 신호(`eno`,`famNm`) — 인증 거부 예외와 구분 |
| `RefreshExpiredException.java` | 만료 내부 신호(`eno`) — 인증 거부 예외와 구분 |

**신규 테스트 (Create)** — `it_backend/src/test/java/com/kdb/it/common/system/service/` 하위:

| 파일 | 성격 |
| --- | --- |
| `LoginHistoryWriterTest.java` | 순수 Mockito 단위 |
| `RefreshTokenRevokerTest.java` | 순수 Mockito 단위 |
| `RefreshTokenRotatorTest.java` | 순수 Mockito 단위(회전 로직 전수 이관) |
| `LoginFailureIsolationIT.java` | `@Tag("it")` 로컬 Oracle 격리 통합 (SEC-09) |
| `RefreshReuseIsolationIT.java` | `@Tag("it")` 로컬 Oracle 격리 통합 (SEC-08) |

**수정 (Modify)**:

| 파일 | 변경 |
| --- | --- |
| `.../service/AuthService.java` | `recordLoginFailure` 위임(Task 1), `refreshAccessToken` 오케스트레이터화 + `rotate`/검증 헬퍼 이관 + 협력자 필드 추가 + `rotationGraceSeconds` 제거(Task 5) |
| `.../service/AuthServiceTest.java` | 신규 협력자 Mock 반영 및 refresh 테스트 재작성(Task 1, Task 5) |

---

## Task 1 — `LoginHistoryWriter` 독립 커밋 빈 + `recordLoginFailure` 위임 (SEC-09)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/service/LoginHistoryWriter.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java` (필드 추가 ~68 부근, `recordLoginFailure` 559-563)
- Test: Create `it_backend/src/test/java/com/kdb/it/common/system/service/LoginHistoryWriterTest.java`; Modify `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java`

**Steps:**

- [ ] RED: `LoginHistoryWriterTest.java`를 작성한다(아직 없는 `LoginHistoryWriter` 참조 → 컴파일 실패):

```java
package com.kdb.it.common.system.service;

import static org.mockito.Mockito.verify;

import com.kdb.it.common.system.entity.Clognh;
import com.kdb.it.common.system.repository.LoginHistoryRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** LoginHistoryWriter 단위 테스트 — 저장 후 flush까지 호출해 독립 커밋 경계를 확정하는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class LoginHistoryWriterTest {

    @Mock private LoginHistoryRepository loginHistoryRepository;
    @Mock private EntityManager entityManager;

    @InjectMocks private LoginHistoryWriter loginHistoryWriter;

    @Test
    @DisplayName("recordFailure - 실패 이력을 저장하고 flush로 즉시 확정한다")
    void recordFailure_savesAndFlushes() {
        Clognh failure = Clognh.createLoginFailure("10001", "127.0.0.1", "Agent", "비밀번호 불일치");

        loginHistoryWriter.recordFailure(failure);

        verify(loginHistoryRepository).save(failure);
        verify(entityManager).flush();
    }
}
```

- [ ] RED 실행 — 컴파일 실패(cannot find symbol `LoginHistoryWriter`)를 확인:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.LoginHistoryWriterTest"` → **FAIL (compileTestJava)**
- [ ] GREEN: `LoginHistoryWriter.java`를 생성한다(`AuditLogWriter` 패턴: `REQUIRES_NEW`+`entityManager.flush()`, 별도 빈):

```java
package com.kdb.it.common.system.service;

import com.kdb.it.common.system.entity.Clognh;
import com.kdb.it.common.system.repository.LoginHistoryRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인 실패 이력을 원 로그인 트랜잭션과 분리된 별도 트랜잭션에서 커밋하는 컴포넌트 — SEC-09.
 *
 * <p>{@code AuthService.login}은 실패 분기에서 이력 저장 직후 예외를 던져 원 트랜잭션을 롤백한다. 실패 이력이 그 롤백에
 * 휩쓸리면 {@link com.kdb.it.common.iam.service.LoginAttemptService}의 5회/10분 계정 잠금 근거가 사라진다. 이
 * 컴포넌트는 {@code REQUIRES_NEW}로 독립 트랜잭션을 열고 {@code flush()}까지 강제해, 로그인 거부와 무관하게 실패 행을 확정
 * 커밋한다. 실패 이력은 INSERT라 락 경합이 없어 단순 독립 커밋으로 충분하다(SEC-08과 달리 교착 무관).
 */
@Component
@RequiredArgsConstructor
public class LoginHistoryWriter {

    /** 로그인 이력 데이터 접근 리포지토리 (TPRMPP_CLOGNH) */
    private final LoginHistoryRepository loginHistoryRepository;

    @PersistenceContext private EntityManager entityManager;

    /**
     * 로그인 실패 이력을 별도 트랜잭션에서 저장한다.
     *
     * @param failure 저장할 로그인 실패 이력 ({@code IT_PTL_LGN_TC='2'})
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(Clognh failure) {
        loginHistoryRepository.save(failure);
        // 지연 커밋 대신 이 트랜잭션 경계 안에서 INSERT를 확정한다(원 로그인 롤백과 독립).
        entityManager.flush();
    }
}
```

- [ ] GREEN 실행 — 단위 테스트 통과 확인:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.LoginHistoryWriterTest"` → **PASS**
- [ ] Modify `AuthService.java`: 협력자 필드를 추가한다. `LoginAttemptService loginAttemptService` 필드(67) 아래에 삽입:

```java
    /** 로그인 실패 이력 독립 커밋 컴포넌트 — SEC-09 */
    private final LoginHistoryWriter loginHistoryWriter;
```

- [ ] Modify `AuthService.recordLoginFailure`(559-563 본문)를 위임으로 교체한다. 기존:

```java
    private void recordLoginFailure(
            String eno, String ipAddress, String userAgent, String failureReason) {
        Clognh loginHistory = Clognh.createLoginFailure(eno, ipAddress, userAgent, failureReason);
        loginHistoryRepository.save(loginHistory);
    }
```

교체 후:

```java
    private void recordLoginFailure(
            String eno, String ipAddress, String userAgent, String failureReason) {
        Clognh loginHistory = Clognh.createLoginFailure(eno, ipAddress, userAgent, failureReason);
        // 원 로그인 트랜잭션이 곧 롤백되므로, 실패 이력은 REQUIRES_NEW 독립 커밋으로 잔존시켜 계정 잠금 근거를 보존한다(SEC-09).
        loginHistoryWriter.recordFailure(loginHistory);
    }
```

- [ ] Modify `AuthServiceTest.java`: 신규 협력자 Mock을 추가한다. `@Mock private LoginAttemptService loginAttemptService;`(57) 아래에 삽입:

```java
    @Mock private LoginHistoryWriter loginHistoryWriter;
```

- [ ] Modify `AuthServiceTest.login_비밀번호불일치_실패이력저장`(131-154)의 검증부를 위임 협력자 기준으로 교체한다. 마지막 검증 라인:

```java
        // then: 실패 이력 1회 저장
        verify(loginHistoryRepository, times(1)).save(any(Clognh.class));
```

교체 후:

```java
        // then: 실패 이력이 독립 커밋 협력자(LoginHistoryWriter)로 1회 위임된다 (SEC-09)
        verify(loginHistoryWriter, times(1)).recordFailure(any(Clognh.class));
```

  > 성공/로그아웃 경로는 `loginHistoryRepository.save`를 그대로 사용하므로 `login_성공_성공이력저장`(182-204), `logout_성공_...`(599-608) 등은 변경하지 않는다.
- [ ] 회귀 실행 — `AuthServiceTest` 전체 통과 확인:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"` → **PASS**
- [ ] Commit:
  `cd C:/it/it_backend && git commit -am "feat: 로그인 실패 이력 독립 커밋용 LoginHistoryWriter 도입 (SEC-09)"`

---

## Task 2 — SEC-09 계정 잠금 격리 통합 테스트 (`@Tag("it")`)

**Files:**
- Test: Create `it_backend/src/test/java/com/kdb/it/common/system/service/LoginFailureIsolationIT.java`
- (프로덕션 변경 없음 — Task 1 결과를 실 Oracle로 검증)

**Steps:**

- [ ] RED: `LoginFailureIsolationIT.java`를 작성한다. 존재하지 않는 사번은 `login`의 "존재하지 않는 사번" 분기(`AuthService.java:161-163`)에서 `recordLoginFailure`를 거치므로, 시드 사용자·비밀번호 없이 실패 커밋을 격리 검증할 수 있다. `TPRMPP_CLOGNH` 감사 컬럼 NOT NULL 때문에 `@BeforeEach`에서 SecurityContext를 심는다:

```java
package com.kdb.it.common.system.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kdb.it.exception.CustomGeneralException;
import com.kdb.it.support.OracleAvailableCondition;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;

/**
 * 로그인 실패 이력이 로그인 거부(원 트랜잭션 롤백)와 무관하게 독립 커밋되는지 실제 로컬 Oracle로 검증하는 통합 테스트 — SEC-09.
 *
 * <p>{@link com.kdb.it.common.iam.service.LoginAttemptService}의 5회/10분 계정 잠금이 실제로 발동하려면 실패 이력
 * ({@code TPRMPP_CLOGNH}, {@code IT_PTL_LGN_TC='2'})이 커밋 잔존해야 한다. 존재하지 않는 사번으로 로그인하면 {@code
 * AuthService.login}이 실패 이력을 남기고 예외를 던지므로, 비밀번호·시드 사용자 없이 실패 커밋만 격리 검증할 수 있다.
 *
 * <p>{@code TPRMPP_CLOGNH}의 {@code FST_ENR_USID}/{@code LST_CHG_USID}가 NOT NULL이므로 JPA Auditing이 감사자를
 * 채우도록 인증 컨텍스트를 심는다(감사자 없으면 Hibernate가 명시적 NULL을 INSERT해 제약 위반). 로컬 Oracle이 꺼져 있으면
 * {@link OracleAvailableCondition}이 컨텍스트 로드 전에 테스트를 깨끗하게 스킵한다.
 */
@Tag("it")
@SpringBootTest(
        properties = {
            // 비-prod 기동 필수값 — application.properties 의 ${JWT_SECRET} 플레이스홀더 대체(EnvironmentValidator 통과).
            "jwt.secret=test-secret-key-for-junit-test-minimum-256-bits-length-ok"
        })
@ActiveProfiles("test-it")
@ExtendWith(OracleAvailableCondition.class)
class LoginFailureIsolationIT {

    /** 계정 잠금 임계값(직전 10분 내 실패 5회 이상 → 다음 시도 차단). LoginAttemptService.MAX_FAILURES와 동일. */
    private static final int MAX_FAILURES = 5;

    @Autowired private AuthService authService;

    @Autowired private JdbcTemplate jdbcTemplate;

    /** 정리 대상 테스트 사번 — 종료 시 이력 삭제. */
    private String testEno;

    @BeforeEach
    void setUp() {
        // 존재하지 않는 고유 사번(<=32자). ZZIT 접두로 운영 데이터와 충돌 방지.
        testEno = ("ZZIT" + UUID.randomUUID().toString().replace("-", "")).substring(0, 20);
        // CLOGNH NOT NULL 감사자(FST_ENR_USID/LST_CHG_USID)를 채우도록 인증 컨텍스트를 심는다.
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                "ITEST01",
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM TPRMPP_CLOGNH WHERE ENO = ?", testEno);
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("로그인 실패 5회 → 실패 이력 COUNT=5 커밋 잔존, 6회째 계정 잠금")
    void loginFailures_committedIndependently_thenAccountLocks() {
        // 5회 실패 — 각 시도는 원 로그인 트랜잭션을 롤백하지만 실패 이력은 REQUIRES_NEW로 독립 커밋된다.
        for (int i = 0; i < MAX_FAILURES; i++) {
            assertThatThrownBy(
                            () -> authService.login(testEno, "wrong-pw", "127.0.0.1", "TestAgent"))
                    .isInstanceOf(RuntimeException.class)
                    .hasMessageContaining("사용자를 찾을 수 없습니다");
        }

        // 실패 이력이 커밋 잔존해야 계정 잠금 근거가 남는다.
        assertThat(countFailureRows()).isEqualTo(MAX_FAILURES);

        // 6회째: checkLocked가 커밋된 5건을 세어(>=5) 이력 기록 전에 계정을 잠근다.
        assertThatThrownBy(
                        () -> authService.login(testEno, "wrong-pw", "127.0.0.1", "TestAgent"))
                .isInstanceOf(CustomGeneralException.class)
                .hasMessageContaining("계정 잠금");

        // 잠금 시도는 이력을 남기지 않으므로 실패 이력은 5건 그대로.
        assertThat(countFailureRows()).isEqualTo(MAX_FAILURES);
    }

    private int countFailureRows() {
        Integer count =
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM TPRMPP_CLOGNH WHERE ENO = ? AND IT_PTL_LGN_TC = '2'",
                        Integer.class,
                        testEno);
        return count == null ? 0 : count;
    }
}
```

  > 카운팅 근거: `login`은 맨 앞에서 `loginAttemptService.checkLocked(eno)`를 호출한다(`AuthService.java:157`). 시도 1~5는 커밋된 실패가 각각 0~4건(`<5`)이라 통과 후 실패를 커밋한다. 6회째는 5건(`>=5`)이라 `checkLocked`가 `recordLoginFailure` 전에 `CustomGeneralException`을 던진다. 즉 "5건 커밋 후 다음 시도 잠금"이 실제 경계다.
- [ ] GREEN 실행 — 로컬 Oracle 기동 상태에서:
  `cd C:/it/it_backend && ./gradlew integrationTest --tests "com.kdb.it.common.system.service.LoginFailureIsolationIT"` → **PASS** (Oracle 미기동 시 `OracleAvailableCondition`으로 스킵)
- [ ] Commit:
  `cd C:/it/it_backend && git commit -am "test: SEC-09 로그인 실패 이력 독립 커밋·계정 잠금 격리 통합 테스트 추가"`

---

## Task 3 — `RefreshTokenRevoker` 독립 커밋 빈 + 단위 테스트 (SEC-08)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/service/RefreshTokenRevoker.java`
- Test: Create `it_backend/src/test/java/com/kdb/it/common/system/service/RefreshTokenRevokerTest.java`
- (이 태스크에서는 `AuthService`를 아직 건드리지 않는다 — Revoker는 독립 빈이라 `AuthServiceTest`에 영향 없음)

**Steps:**

- [ ] RED: `RefreshTokenRevokerTest.java`를 작성한다(아직 없는 `RefreshTokenRevoker` 참조 → 컴파일 실패):

```java
package com.kdb.it.common.system.service;

import static org.mockito.Mockito.verify;

import com.kdb.it.common.system.repository.RefreshTokenRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** RefreshTokenRevoker 단위 테스트 — 패밀리 삭제 후 flush까지 호출해 독립 커밋 경계를 확정하는지 검증한다. */
@ExtendWith(MockitoExtension.class)
class RefreshTokenRevokerTest {

    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private EntityManager entityManager;

    @InjectMocks private RefreshTokenRevoker refreshTokenRevoker;

    @Test
    @DisplayName("revokeFamilyByEno - 사번 기준 패밀리를 삭제하고 flush로 즉시 확정한다")
    void revokeFamilyByEno_deletesAndFlushes() {
        refreshTokenRevoker.revokeFamilyByEno("10001");

        verify(refreshTokenRepository).deleteByEno("10001");
        verify(entityManager).flush();
    }
}
```

- [ ] RED 실행 — 컴파일 실패 확인:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.RefreshTokenRevokerTest"` → **FAIL (compileTestJava)**
- [ ] GREEN: `RefreshTokenRevoker.java`를 생성한다(실 폐기 메서드는 `deleteByEno`, 스펙 §3.1):

```java
package com.kdb.it.common.system.service;

import com.kdb.it.common.system.repository.RefreshTokenRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refresh Token 패밀리 폐기를 인증 거부와 분리된 별도 트랜잭션에서 커밋하는 컴포넌트 — SEC-08.
 *
 * <p>재사용·만료 탐지 시 회전 트랜잭션({@link RefreshTokenRotator#rotate(String)})은 삭제 없이 마커 예외로 롤백되어 비관적
 * 락을 해제한다. 이 컴포넌트는 락이 해제된 직후 {@code REQUIRES_NEW}로 독립 트랜잭션을 열어 {@code deleteByEno}로 패밀리를
 * 폐기하고 {@code flush()}까지 강제해, 인증 거부 예외와 무관하게 폐기를 확정 커밋한다. 오케스트레이터가 회전 트랜잭션을 종료한 뒤
 * 호출하므로 잠긴 행을 기다리는 자기교착(self-deadlock)이 없다.
 *
 * <p>패밀리 폐기는 user-wide {@code deleteByEno}가 관례이며(1인 1패밀리), 과다 폐기는 재로그인 유도로 보안상 안전하다.
 */
@Component
@RequiredArgsConstructor
public class RefreshTokenRevoker {

    /** 갱신토큰 데이터 접근 리포지토리 (TPRMPP_CRTOKM) */
    private final RefreshTokenRepository refreshTokenRepository;

    @PersistenceContext private EntityManager entityManager;

    /**
     * 사번 기준 Refresh Token 패밀리 전체를 별도 트랜잭션에서 폐기한다.
     *
     * @param eno 폐기 대상 사용자 사번
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revokeFamilyByEno(String eno) {
        refreshTokenRepository.deleteByEno(eno);
        // 지연 커밋 대신 이 트랜잭션 경계 안에서 DELETE를 확정한다(인증 거부와 독립).
        entityManager.flush();
    }
}
```

- [ ] GREEN 실행 — 단위 테스트 통과 확인:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.RefreshTokenRevokerTest"` → **PASS**
- [ ] Commit:
  `cd C:/it/it_backend && git commit -am "feat: Refresh Token 패밀리 폐기 독립 커밋용 RefreshTokenRevoker 도입 (SEC-08)"`

---

## Task 4 — `RefreshTokenRotator` 회전 트랜잭션 빈 + 마커 예외 + 단위 테스트 (SEC-08)

이 태스크는 회전 로직을 담은 **별도 빈**과 두 마커 예외를 만들고, 회전 로직을 검증하는 단위 테스트를 이관·작성한다. `AuthService`는 아직 수정하지 않으므로(구 `refreshAccessToken` 유지) `AuthServiceTest`는 이 시점까지 그대로 통과한다. 오케스트레이터 전환은 Task 5.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/service/RefreshReuseDetectedException.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/system/service/RefreshExpiredException.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/system/service/RefreshTokenRotator.java`
- Test: Create `it_backend/src/test/java/com/kdb/it/common/system/service/RefreshTokenRotatorTest.java`

**Steps:**

- [ ] GREEN(선행 타입): 마커 예외 두 개를 생성한다(패키지-프라이빗 내부 신호 전용). `RefreshReuseDetectedException.java`:

```java
package com.kdb.it.common.system.service;

/**
 * Refresh Token 재사용 탐지 내부 신호 예외 — SEC-08.
 *
 * <p>{@link RefreshTokenRotator#rotate(String)}가 회전된(AVL_YN='N') 토큰의 grace 경과 재제출을 감지하면 삭제 없이 이
 * 예외를 던져 회전 트랜잭션을 롤백(비관적 락 해제)한다. 인증 거부용 {@link com.kdb.it.exception.InvalidRefreshTokenException}과
 * 구분되는 내부 신호 전용 타입으로, 오케스트레이터가 이를 catch해 패밀리 폐기를 트리거한 뒤 인증 거부 예외로 변환한다.
 */
class RefreshReuseDetectedException extends RuntimeException {

    /** 폐기 대상 사용자 사번. */
    private final String eno;

    /** 재사용이 탐지된 토큰 패밀리명(진단 로그용). */
    private final String famNm;

    RefreshReuseDetectedException(String eno, String famNm) {
        this.eno = eno;
        this.famNm = famNm;
    }

    String getEno() {
        return eno;
    }

    String getFamNm() {
        return famNm;
    }
}
```

- [ ] GREEN(선행 타입): `RefreshExpiredException.java`:

```java
package com.kdb.it.common.system.service;

/**
 * Refresh Token 만료 탐지 내부 신호 예외 — SEC-08.
 *
 * <p>{@link RefreshTokenRotator#rotate(String)}가 DB 저장 만료일(END_DTM) 경과를 감지하면 삭제 없이 이 예외를 던져 회전
 * 트랜잭션을 롤백(비관적 락 해제)한다. 오케스트레이터가 catch해 패밀리 폐기를 트리거한 뒤 인증 거부 예외로 변환한다.
 */
class RefreshExpiredException extends RuntimeException {

    /** 폐기 대상 사용자 사번. */
    private final String eno;

    RefreshExpiredException(String eno) {
        this.eno = eno;
    }

    String getEno() {
        return eno;
    }
}
```

- [ ] RED: `RefreshTokenRotatorTest.java`를 작성한다(아직 없는 `RefreshTokenRotator` 참조 → 컴파일 실패). 기존 `AuthServiceTest`의 회전 로직 테스트를 이관하되, 회전 빈은 더 이상 재사용/만료 시 삭제하지 않고 **마커 예외**를 던진다는 점을 반영한다:

```java
package com.kdb.it.common.system.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.RoleRepository;
import com.kdb.it.common.iam.repository.UserRepository;
import com.kdb.it.common.system.dto.AuthDto;
import com.kdb.it.common.system.entity.Crtokm;
import com.kdb.it.common.system.repository.RefreshTokenRepository;
import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.exception.InvalidRefreshTokenException;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * RefreshTokenRotator 단위 테스트 — 비관적 락 회전 로직을 Mockito로 검증한다.
 *
 * <p>JWT 용도·서명 검증은 오케스트레이터 책임이므로 여기서는 다루지 않는다. 재사용/만료는 삭제 없이 마커 예외로 신호되는지를 핵심으로 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class RefreshTokenRotatorTest {

    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private UserRepository userRepository;
    @Mock private RoleRepository roleRepository;
    @Mock private JwtUtil jwtUtil;

    @InjectMocks private RefreshTokenRotator refreshTokenRotator;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(refreshTokenRotator, "refreshTokenValidityMs", 604_800_000L);
        ReflectionTestUtils.setField(refreshTokenRotator, "rotationGraceSeconds", 30L);
    }

    private CuserI user() {
        return CuserI.builder().eno("10001").usrNm("홍길동").bbrC("BBR001").delYn("N").build();
    }

    @Test
    @DisplayName("rotate - 유효한 활성 토큰 → 새 Access Token 반환")
    void rotate_valid_returnsNewAccessToken() {
        String raw = "valid-refresh-token";
        Crtokm active =
                Crtokm.builder()
                        .ecyRnwPubTokCone(AuthService.sha256HexForToken(raw))
                        .eno("10001")
                        .famNm("FAM-1")
                        .avlYn("Y")
                        .endDtm(LocalDateTime.now().plusDays(7))
                        .build();
        given(refreshTokenRepository.findByEcyRnwPubTokCone(AuthService.sha256HexForToken(raw)))
                .willReturn(Optional.of(active));
        given(userRepository.findByEno("10001")).willReturn(Optional.of(user()));
        given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N"))
                .willReturn(Collections.emptyList());
        given(jwtUtil.generateAccessToken(anyString(), anyList(), any()))
                .willReturn("new-access-token");
        given(jwtUtil.generateRefreshToken("10001")).willReturn("new-refresh-token");

        AuthDto.RefreshResponse response = refreshTokenRotator.rotate(raw);

        assertThat(response.getAccessToken()).isEqualTo("new-access-token");
        assertThat(response.getRefreshToken()).isEqualTo("new-refresh-token");
    }

    @Test
    @DisplayName("rotate - 정상 회전: 구 토큰 markRotated 유지 + 신규 동일 패밀리 저장(삭제 없음)")
    void rotate_normalRotation_keepsOldMarkedRotated() {
        String oldRefresh = "active-token";
        String newRefresh = "new-refresh-token";
        String lookup = AuthService.sha256HexForToken(oldRefresh);
        Crtokm stored =
                Crtokm.builder()
                        .ecyRnwPubTokCone(lookup)
                        .eno("10001")
                        .famNm("FAM-1")
                        .avlYn("Y")
                        .endDtm(LocalDateTime.now().plusDays(7))
                        .build();
        given(refreshTokenRepository.findByEcyRnwPubTokCone(lookup)).willReturn(Optional.of(stored));
        given(userRepository.findByEno("10001")).willReturn(Optional.of(user()));
        given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N"))
                .willReturn(Collections.emptyList());
        given(jwtUtil.generateAccessToken(anyString(), anyList(), any())).willReturn("new-access");
        given(jwtUtil.generateRefreshToken("10001")).willReturn(newRefresh);

        refreshTokenRotator.rotate(oldRefresh);

        assertThat(stored.isRotated()).isTrue();
        verify(refreshTokenRepository, never()).delete(stored);
        // 구 표식 저장 + 신규 저장 = 2회, 신규 토큰에도 SHA-256 조회값을 저장
        ArgumentCaptor<Crtokm> captor = ArgumentCaptor.forClass(Crtokm.class);
        verify(refreshTokenRepository, times(2)).save(captor.capture());
        assertThat(captor.getAllValues().get(1).getEcyRnwPubTokCone())
                .isEqualTo(AuthService.sha256HexForToken(newRefresh));
    }

    @Test
    @DisplayName("rotate - 재사용 탐지(grace 경과): 삭제 없이 RefreshReuseDetectedException 신호")
    void rotate_reuseDetected_throwsMarkerWithoutDelete() {
        String reused = "rotated-old-token";
        Crtokm rotated =
                Crtokm.builder()
                        .ecyRnwPubTokCone(AuthService.sha256HexForToken(reused))
                        .eno("10001")
                        .famNm("FAM-1")
                        .avlYn("N")
                        .endDtm(LocalDateTime.now().plusDays(7))
                        .lstChgDtm(LocalDateTime.now().minusMinutes(5)) // grace 경과
                        .build();
        given(refreshTokenRepository.findByEcyRnwPubTokCone(AuthService.sha256HexForToken(reused)))
                .willReturn(Optional.of(rotated));

        assertThatThrownBy(() -> refreshTokenRotator.rotate(reused))
                .isInstanceOf(RefreshReuseDetectedException.class)
                .satisfies(
                        e -> {
                            RefreshReuseDetectedException marker = (RefreshReuseDetectedException) e;
                            assertThat(marker.getEno()).isEqualTo("10001");
                            assertThat(marker.getFamNm()).isEqualTo("FAM-1");
                        });
        // 회전 빈은 삭제하지 않는다 — 폐기는 오케스트레이터 책임.
        verify(refreshTokenRepository, never()).deleteByEno(anyString());
        verify(refreshTokenRepository, never()).save(any(Crtokm.class));
    }

    @Test
    @DisplayName("rotate - grace 내 동시 새로고침: 패밀리 유지, RuntimeException(다시 시도)")
    void rotate_graceWindow_throwsRetryWithoutDelete() {
        String recent = "just-rotated-token";
        Crtokm rotated =
                Crtokm.builder()
                        .ecyRnwPubTokCone(AuthService.sha256HexForToken(recent))
                        .eno("10001")
                        .famNm("FAM-1")
                        .avlYn("N")
                        .endDtm(LocalDateTime.now().plusDays(7))
                        .lstChgDtm(LocalDateTime.now().minusSeconds(3)) // grace 내
                        .build();
        given(refreshTokenRepository.findByEcyRnwPubTokCone(AuthService.sha256HexForToken(recent)))
                .willReturn(Optional.of(rotated));

        assertThatThrownBy(() -> refreshTokenRotator.rotate(recent))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("다시 시도");
        verify(refreshTokenRepository, never()).deleteByEno(anyString());
    }

    @Test
    @DisplayName("rotate - DB 저장 만료 토큰: 삭제 없이 RefreshExpiredException 신호")
    void rotate_expired_throwsMarkerWithoutDelete() {
        String tokenValue = "expired-refresh-token";
        Crtokm expired =
                Crtokm.builder()
                        .ecyRnwPubTokCone(AuthService.sha256HexForToken(tokenValue))
                        .eno("10001")
                        .famNm("FAM-1")
                        .avlYn("Y")
                        .endDtm(LocalDateTime.now().minusDays(1)) // 만료
                        .build();
        given(
                        refreshTokenRepository.findByEcyRnwPubTokCone(
                                AuthService.sha256HexForToken(tokenValue)))
                .willReturn(Optional.of(expired));

        assertThatThrownBy(() -> refreshTokenRotator.rotate(tokenValue))
                .isInstanceOf(RefreshExpiredException.class)
                .satisfies(
                        e ->
                                assertThat(((RefreshExpiredException) e).getEno())
                                        .isEqualTo("10001"));
        verify(refreshTokenRepository, never()).delete(any(Crtokm.class));
        verify(refreshTokenRepository, never()).deleteByEno(anyString());
    }

    @Test
    @DisplayName("rotate - DB에 활성 토큰이 없으면 InvalidRefreshTokenException")
    void rotate_dbMiss_throwsInvalid() {
        given(
                        refreshTokenRepository.findByEcyRnwPubTokCone(
                                AuthService.sha256HexForToken("missing-refresh")))
                .willReturn(Optional.empty());

        assertThatThrownBy(() -> refreshTokenRotator.rotate("missing-refresh"))
                .isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    @DisplayName("rotate - 토큰 사용자가 없으면 RuntimeException(사용자를 찾을 수 없습니다)")
    void rotate_userMissing_throwsRuntime() {
        String tokenValue = "valid-refresh-token";
        Crtokm active =
                Crtokm.builder()
                        .ecyRnwPubTokCone(AuthService.sha256HexForToken(tokenValue))
                        .eno("10001")
                        .famNm("FAM-1")
                        .avlYn("Y")
                        .endDtm(LocalDateTime.now().plusDays(7))
                        .build();
        given(
                        refreshTokenRepository.findByEcyRnwPubTokCone(
                                AuthService.sha256HexForToken(tokenValue)))
                .willReturn(Optional.of(active));
        given(userRepository.findByEno("10001")).willReturn(Optional.empty());

        assertThatThrownBy(() -> refreshTokenRotator.rotate(tokenValue))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("사용자를 찾을 수 없습니다");
    }

    @Test
    @DisplayName("rotate - 회전 후 패밀리 활성 토큰이 2개 이상이면 IllegalStateException")
    void rotate_duplicateActiveFamily_throwsIllegalState() {
        String oldRefresh = "dup-family-token";
        Crtokm stored =
                Crtokm.builder()
                        .ecyRnwPubTokCone(AuthService.sha256HexForToken(oldRefresh))
                        .eno("10001")
                        .famNm("FAM-1")
                        .avlYn("Y")
                        .endDtm(LocalDateTime.now().plusDays(7))
                        .build();
        Crtokm extraActive =
                Crtokm.builder()
                        .ecyRnwPubTokCone("other-hash")
                        .eno("10001")
                        .famNm("FAM-1")
                        .avlYn("Y")
                        .endDtm(LocalDateTime.now().plusDays(7))
                        .build();
        given(
                        refreshTokenRepository.findByEcyRnwPubTokCone(
                                AuthService.sha256HexForToken(oldRefresh)))
                .willReturn(Optional.of(stored));
        given(userRepository.findByEno("10001")).willReturn(Optional.of(user()));
        given(roleRepository.findAllByIdEnoAndUseYnAndDelYn("10001", "Y", "N"))
                .willReturn(Collections.emptyList());
        given(jwtUtil.generateAccessToken(anyString(), anyList(), any())).willReturn("new-access");
        given(jwtUtil.generateRefreshToken("10001")).willReturn("new-refresh");
        given(refreshTokenRepository.findByFamNmAndAvlYn("FAM-1", "Y"))
                .willReturn(List.of(stored, extraActive));

        assertThatThrownBy(() -> refreshTokenRotator.rotate(oldRefresh))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("패밀리당 1개만 허용");
    }
}
```

- [ ] RED 실행 — 컴파일 실패(cannot find symbol `RefreshTokenRotator`) 확인:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.RefreshTokenRotatorTest"` → **FAIL (compileTestJava)**
- [ ] GREEN: `RefreshTokenRotator.java`를 생성한다. 기존 `AuthService.refreshAccessToken`의 DB 조회~회전 저장 블록과 `findRefreshTokenByValue`/`validateSingleActiveToken`을 이관하되, **재사용/만료 시 삭제를 제거하고 마커 예외로 대체**한다:

```java
package com.kdb.it.common.system.service;

import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.RoleRepository;
import com.kdb.it.common.iam.repository.UserRepository;
import com.kdb.it.common.system.dto.AuthDto;
import com.kdb.it.common.system.entity.Crtokm;
import com.kdb.it.common.system.repository.RefreshTokenRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.exception.InvalidRefreshTokenException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Refresh Token 회전 트랜잭션 컴포넌트 — SEC-08의 2-트랜잭션 분리 중 "비관적 락 read + 회전 판정"을 담당한다.
 *
 * <p>{@code AuthService.refreshAccessToken}(비트랜잭션 오케스트레이터)이 호출하는 <b>별도 빈</b>이다. 반드시 별도 빈이어야
 * 프록시가 적용되어 {@code @Transactional} 경계가 성립한다(같은 빈 내부 호출은 self-invocation으로 트랜잭션이 무시된다).
 *
 * <p>정상 경로에서는 비관적 쓰기 잠금 아래 구 토큰을 회전 표식(AVL_YN='N')으로 남기고 신규 토큰을 같은 패밀리로 저장한 뒤 새
 * 토큰을 반환한다. 재사용·만료를 감지하면 <b>삭제하지 않고</b> {@link RefreshReuseDetectedException}/{@link
 * RefreshExpiredException}을 던진다. 이 예외로 회전 트랜잭션이 롤백되어 비관적 락이 해제되며(탐지 시점까지 read만 수행하므로
 * 유실 없음), 패밀리 폐기는 오케스트레이터가 {@link RefreshTokenRevoker}로 별도 트랜잭션에서 커밋한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RefreshTokenRotator {

    /** Refresh Token 데이터 접근 리포지토리 (TPRMPP_CRTOKM) — 조회는 PESSIMISTIC_WRITE 잠금 */
    private final RefreshTokenRepository refreshTokenRepository;

    /** 사용자 정보 데이터 접근 리포지토리 (TPRMPP_CUSERI) */
    private final UserRepository userRepository;

    /** 역할관리(사용자↔자격등급 매핑) 데이터 접근 리포지토리 (TPRMPP_CROLEI) */
    private final RoleRepository roleRepository;

    /** JWT Access/Refresh Token 생성 유틸리티 */
    private final JwtUtil jwtUtil;

    @Value("${jwt.refresh-token-validity}")
    private long refreshTokenValidityMs;

    /** Refresh Token 회전 직후 동시 새로고침(다중 탭) 허용 grace 기간(초). 이 기간 내 회전 토큰 재제출은 패밀리 폐기 없이 거부만 한다. */
    @Value("${app.auth.refresh-rotation-grace-seconds:30}")
    private long rotationGraceSeconds;

    /**
     * 비관적 락 아래 Refresh Token을 회전하고 새 Access/Refresh 토큰을 발급한다.
     *
     * <p>JWT 용도·서명 검증은 오케스트레이터({@code AuthService.refreshAccessToken})가 선행하므로 이 메서드는 DB 상태만 다룬다.
     *
     * @param refreshTokenValue 클라이언트가 제출한 Refresh Token 원문
     * @return 새 Access Token + 회전된 Refresh Token
     * @throws RefreshReuseDetectedException 회전된 토큰의 grace 경과 재제출(재사용) — 삭제 없이 롤백 신호
     * @throws RefreshExpiredException DB 저장 만료일(END_DTM) 경과 — 삭제 없이 롤백 신호
     * @throws InvalidRefreshTokenException DB에 활성 토큰이 없는 경우
     * @throws RuntimeException grace 내 동시 새로고침 재제출이거나 사용자 미존재인 경우
     * @throws IllegalStateException 회전 후 같은 패밀리 활성 토큰이 2개 이상인 경우
     */
    @Transactional
    public AuthDto.RefreshResponse rotate(String refreshTokenValue) {
        // DB에서 Refresh Token 조회 (비관적 쓰기 잠금으로 회전 동시성 직렬화)
        Crtokm refreshToken = findRefreshTokenByValue(refreshTokenValue);

        // 재사용 탐지(AVL_YN='N' 구 토큰 재제출). 단, 회전 직후 grace 기간 내 재제출은
        // 다중 탭 동시 새로고침으로 간주 → 패밀리 유지, 이 요청만 거부(공유 쿠키의 신규 토큰으로 사용자는 유지됨).
        if (refreshToken.isRotated()) {
            LocalDateTime rotatedAt = refreshToken.getLstChgDtm();
            boolean withinGrace =
                    rotatedAt != null
                            && Duration.between(rotatedAt, LocalDateTime.now()).getSeconds()
                                    <= rotationGraceSeconds;
            if (withinGrace) {
                throw new RuntimeException("토큰이 방금 갱신되었습니다. 잠시 후 다시 시도하세요.");
            }
            // 삭제하지 않고 롤백 신호만 던진다 — 폐기는 오케스트레이터가 별도 트랜잭션으로 커밋한다.
            throw new RefreshReuseDetectedException(
                    refreshToken.getEno(), refreshToken.getFamNm());
        }

        // DB 저장 만료일 기준 만료 여부 확인 (END_DTM 필드)
        if (refreshToken.isExpired()) {
            // 삭제하지 않고 롤백 신호만 던진다 — 폐기는 오케스트레이터가 별도 트랜잭션으로 커밋한다.
            throw new RefreshExpiredException(refreshToken.getEno());
        }

        // Refresh 시에도 최신 자격등급 반영 (자격등급 변경 시 즉시 적용)
        String eno = refreshToken.getEno();
        CuserI user =
                userRepository
                        .findByEno(eno)
                        .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));

        List<String> athIds = loadAthIds(eno);

        // 새로운 Access Token 생성 (최신 자격등급 및 부서코드 반영)
        String newAccessToken = jwtUtil.generateAccessToken(eno, athIds, user.getBbrC());

        // 회전: 구 토큰을 삭제하지 않고 '회전됨' 표식 유지(재사용 탐지용), 신규 토큰을 동일 패밀리로 저장
        refreshToken.markRotated();
        refreshTokenRepository.save(refreshToken);
        String newRefreshTokenValue = jwtUtil.generateRefreshToken(eno);
        String newRefreshTokenHash = AuthService.sha256HexForToken(newRefreshTokenValue);
        Crtokm rotated =
                Crtokm.builder()
                        .apiTokCone(newRefreshTokenHash)
                        .ecyRnwPubTokCone(newRefreshTokenHash)
                        .eno(eno)
                        .famNm(refreshToken.getFamNm())
                        .avlYn("Y")
                        .endDtm(LocalDateTime.now().plus(Duration.ofMillis(refreshTokenValidityMs)))
                        .build();
        refreshTokenRepository.save(rotated);
        validateSingleActiveToken(refreshToken.getFamNm());

        return AuthDto.RefreshResponse.builder()
                .accessToken(newAccessToken) // 새 Access Token
                .refreshToken(newRefreshTokenValue) // 회전된 Refresh Token (컨트롤러가 쿠키 재설정)
                .build();
    }

    /** Refresh Token 원문을 SHA-256 조회값으로 변환해 저장 행을 비관적 잠금으로 조회합니다. */
    private Crtokm findRefreshTokenByValue(String refreshTokenValue) {
        String lookupValue = AuthService.sha256HexForToken(refreshTokenValue);
        return refreshTokenRepository
                .findByEcyRnwPubTokCone(lookupValue)
                // DB 미존재도 재로그인 대상 — 원인은 서버 로그로만 구분하고 토큰 값은 기록하지 않습니다.
                .orElseThrow(
                        () -> {
                            log.warn("Refresh Token 조회 실패 — DB에 활성 토큰 없음");
                            return new InvalidRefreshTokenException();
                        });
    }

    /**
     * 회전 완료 후 같은 패밀리에 활성 Refresh Token이 1개만 남았는지 검증합니다.
     *
     * @param famNm 검증할 토큰 패밀리명
     * @throws IllegalStateException 패밀리에 활성 토큰이 2개 이상 남은 경우
     */
    private void validateSingleActiveToken(String famNm) {
        List<Crtokm> activeTokens = refreshTokenRepository.findByFamNmAndAvlYn(famNm, "Y");
        if (activeTokens.size() <= 1) {
            return;
        }
        log.warn(
                "Refresh Token 패밀리 활성 토큰 중복 탐지: famNm={}, activeCount={}",
                famNm,
                activeTokens.size());
        throw new IllegalStateException("활성 Refresh Token은 패밀리당 1개만 허용됩니다.");
    }

    /**
     * 사용자의 활성 자격등급 목록을 조회한다(없으면 기본 사용자 권한).
     *
     * <p>{@code AuthService.loadAthIds}와 동일 규칙이나, 회전 트랜잭션 경계 안에서 자격등급을 재조회하기 위해 이 빈에 동일 로직을
     * 둔다(두 빈의 순환 의존을 피함).
     *
     * @param eno 조회 대상 사번
     * @return 활성 자격등급 ID 목록(비면 {@link CustomUserDetails#ATH_USER})
     */
    private List<String> loadAthIds(String eno) {
        List<String> athIds =
                roleRepository.findAllByIdEnoAndUseYnAndDelYn(eno, "Y", "N").stream()
                        .map(value -> value.getAthId())
                        .toList();
        return athIds.isEmpty() ? List.of(CustomUserDetails.ATH_USER) : athIds;
    }
}
```

- [ ] GREEN 실행 — 회전 빈 단위 테스트 통과 확인:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.RefreshTokenRotatorTest"` → **PASS**
- [ ] 회귀 실행 — `AuthService`는 아직 미변경이므로 기존 `AuthServiceTest`도 그대로 통과:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"` → **PASS**
- [ ] Commit:
  `cd C:/it/it_backend && git commit -am "feat: 비관적 락 회전을 RefreshTokenRotator로 분리하고 재사용/만료 마커 예외 도입 (SEC-08)"`

---

## Task 5 — `refreshAccessToken` 오케스트레이터 전환 + `AuthServiceTest` 협력자 반영 (SEC-08)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/service/AuthService.java`
  - 필드 추가(~68 부근), `rotationGraceSeconds` 필드 제거(76-78), `refreshAccessToken`(216-291) 오케스트레이터화, `findRefreshTokenByValue`(494-505)·`validateSingleActiveToken`(507-523) 제거
- Test: Modify `it_backend/src/test/java/com/kdb/it/common/system/service/AuthServiceTest.java` (setUp 61-65, refresh 테스트 재작성)

**Steps:**

- [ ] RED: `AuthServiceTest.java`의 refresh 섹션을 오케스트레이터 계약으로 먼저 재작성한다(아직 없는 협력자 필드/동작 참조 → 컴파일·검증 실패). 먼저 신규 Mock 필드 2개를 추가한다. `@Mock private LoginHistoryWriter loginHistoryWriter;`(Task 1에서 추가됨) 아래에 삽입:

```java
    @Mock private RefreshTokenRevoker refreshTokenRevoker;
    @Mock private RefreshTokenRotator refreshTokenRotator;
```

- [ ] RED: `AuthServiceTest.setUp`(61-65)에서 이제 `AuthService`에 존재하지 않을 `rotationGraceSeconds` 설정 라인을 제거한다. 변경 후:

```java
    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "refreshTokenValidityMs", 604_800_000L);
    }
```

- [ ] RED: 회전 내부 로직 테스트는 `RefreshTokenRotatorTest`로 이관되었으므로 `AuthServiceTest`에서 아래 메서드들을 **삭제**한다(이제 오케스트레이터가 아니라 회전 빈 소관):
  - `refreshAccessToken_유효한토큰_새AccessToken반환`(272-312)
  - `refreshAccessToken_회전_새RefreshToken발급`(314-354)
  - `refreshAccessToken_패밀리활성토큰중복_예외발생`(356-403)
  - `refreshAccessToken_정상회전_구토큰유지`(456-492)
  - `refreshToken_concurrentRotation_keepsSingleActiveTokenPerFamily`(494-544)
  - `refreshAccessToken_만료된DB토큰_예외발생및삭제`(569-595)
  - `refreshAccessToken_DB토큰없음_예외발생`(692-705)
  - `refreshAccessToken_사용자없음_예외발생`(707-731)
  - `refreshAccessToken_encryptedLookupValue_queriesAndSavesLookupValue`(793-832)
- [ ] RED: 재사용/grace 테스트(405-454)를 오케스트레이터 계약으로 재작성하고, 만료·성공·전파 오케스트레이터 테스트를 추가한다. 아래 메서드들을 `AuthServiceTest`의 "Refresh Token 갱신 테스트" 영역에 둔다(용도 가드 파라미터라이즈드 테스트 546-567은 그대로 두되 마지막 검증만 아래처럼 교체):

```java
    @Test
    @DisplayName("refreshAccessToken - 정상: 회전 빈에 위임하고 폐기 없이 응답 반환")
    void refreshAccessToken_정상_회전빈위임() {
        String raw = "valid-refresh-token";
        given(jwtUtil.validateToken(raw, JwtUtil.TOKEN_USE_REFRESH, false)).willReturn(true);
        given(refreshTokenRotator.rotate(raw))
                .willReturn(
                        AuthDto.RefreshResponse.builder()
                                .accessToken("new-access-token")
                                .refreshToken("new-refresh-token")
                                .build());

        AuthDto.RefreshResponse response = authService.refreshAccessToken(raw);

        assertThat(response.getAccessToken()).isEqualTo("new-access-token");
        assertThat(response.getRefreshToken()).isEqualTo("new-refresh-token");
        verify(refreshTokenRevoker, never()).revokeFamilyByEno(anyString());
    }

    @Test
    @DisplayName("refreshAccessToken - 재사용 탐지: 별도 트랜잭션으로 패밀리 폐기 후 InvalidRefreshTokenException")
    void refreshAccessToken_재사용탐지_패밀리폐기() {
        String reused = "rotated-old-token";
        given(jwtUtil.validateToken(reused, JwtUtil.TOKEN_USE_REFRESH, false)).willReturn(true);
        given(refreshTokenRotator.rotate(reused))
                .willThrow(new RefreshReuseDetectedException("10001", "FAM-1"));

        assertThatThrownBy(() -> authService.refreshAccessToken(reused))
                .isInstanceOf(InvalidRefreshTokenException.class);
        // 회전 TX 롤백으로 락 해제 후 별도 트랜잭션 폐기가 정확히 1회.
        verify(refreshTokenRevoker, times(1)).revokeFamilyByEno("10001");
    }

    @Test
    @DisplayName("refreshAccessToken - 만료 탐지: 별도 트랜잭션으로 패밀리 폐기 후 InvalidRefreshTokenException")
    void refreshAccessToken_만료탐지_패밀리폐기() {
        String expired = "expired-refresh-token";
        given(jwtUtil.validateToken(expired, JwtUtil.TOKEN_USE_REFRESH, false)).willReturn(true);
        given(refreshTokenRotator.rotate(expired))
                .willThrow(new RefreshExpiredException("10001"));

        assertThatThrownBy(() -> authService.refreshAccessToken(expired))
                .isInstanceOf(InvalidRefreshTokenException.class);
        verify(refreshTokenRevoker, times(1)).revokeFamilyByEno("10001");
    }

    @Test
    @DisplayName("refreshAccessToken - grace 내 동시 새로고침: 폐기 없이 RuntimeException(다시 시도) 전파")
    void refreshAccessToken_grace내_패밀리유지() {
        String recent = "just-rotated-token";
        given(jwtUtil.validateToken(recent, JwtUtil.TOKEN_USE_REFRESH, false)).willReturn(true);
        given(refreshTokenRotator.rotate(recent))
                .willThrow(new RuntimeException("토큰이 방금 갱신되었습니다. 잠시 후 다시 시도하세요."));

        assertThatThrownBy(() -> authService.refreshAccessToken(recent))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("다시 시도");
        // grace 재제출은 재로그인 대상이 아니므로 패밀리 폐기 없음.
        verify(refreshTokenRevoker, never()).revokeFamilyByEno(anyString());
    }

    @Test
    @DisplayName("refreshAccessToken - DB 미존재: 폐기 없이 InvalidRefreshTokenException 전파")
    void refreshAccessToken_DB미존재_폐기없이전파() {
        String missing = "missing-refresh";
        given(jwtUtil.validateToken(missing, JwtUtil.TOKEN_USE_REFRESH, false)).willReturn(true);
        given(refreshTokenRotator.rotate(missing)).willThrow(new InvalidRefreshTokenException());

        assertThatThrownBy(() -> authService.refreshAccessToken(missing))
                .isInstanceOf(InvalidRefreshTokenException.class);
        verify(refreshTokenRevoker, never()).revokeFamilyByEno(anyString());
    }

    @Test
    @DisplayName("refreshAccessToken - 토큰 사용자 미존재: 폐기 없이 RuntimeException 전파")
    void refreshAccessToken_사용자없음_전파() {
        String raw = "valid-refresh-token";
        given(jwtUtil.validateToken(raw, JwtUtil.TOKEN_USE_REFRESH, false)).willReturn(true);
        given(refreshTokenRotator.rotate(raw))
                .willThrow(new RuntimeException("사용자를 찾을 수 없습니다."));

        assertThatThrownBy(() -> authService.refreshAccessToken(raw))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("사용자를 찾을 수 없습니다");
        verify(refreshTokenRevoker, never()).revokeFamilyByEno(anyString());
    }
```

- [ ] RED: 용도 가드 파라미터라이즈드 테스트(`refreshAccessToken_용도가드실패_DB접근없이전용예외`, 546-567)의 마지막 검증을 신규 협력자 기준으로 교체한다. 기존:

```java
        // 가드는 DB 접근 이전이므로 어떤 리포지토리 상호작용도 없어야 한다.
        verifyNoInteractions(refreshTokenRepository, userRepository);
```

교체 후:

```java
        // 가드는 회전 위임 이전이므로 회전·폐기 협력자와의 상호작용이 전혀 없어야 한다.
        verifyNoInteractions(refreshTokenRotator, refreshTokenRevoker);
```

  > 이 교체로 `refreshTokenRepository`/`userRepository` 대신 오케스트레이터의 실제 협력자를 검증한다. `verifyNoInteractions` import는 유지된다.
- [ ] RED 실행 — `AuthService` 미변경 상태라 새 테스트가 컴파일·검증 실패:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"` → **FAIL**
- [ ] GREEN: `AuthService.java`에 협력자 필드 2개를 추가한다. Task 1에서 추가한 `LoginHistoryWriter loginHistoryWriter` 필드 아래에 삽입:

```java
    /** Refresh Token 패밀리 폐기 독립 커밋 컴포넌트 — SEC-08 */
    private final RefreshTokenRevoker refreshTokenRevoker;

    /** 비관적 락 회전 트랜잭션 컴포넌트(별도 빈) — SEC-08 */
    private final RefreshTokenRotator refreshTokenRotator;
```

- [ ] GREEN: `AuthService`의 `rotationGraceSeconds` 필드(76-78)와 그 `@Value` 선언을 **삭제**한다(회전 빈으로 이관됨). 삭제 대상:

```java
    /** Refresh Token 회전 직후 동시 새로고침(다중 탭) 허용 grace 기간(초). 이 기간 내 회전된 토큰 재제출은 패밀리 폐기 없이 거부만 한다. */
    @org.springframework.beans.factory.annotation.Value(
            "${app.auth.refresh-rotation-grace-seconds:30}")
    private long rotationGraceSeconds;
```

  > `refreshTokenValidityMs`(72-73) 및 그 `@Value`는 `issueNewRefreshFamily`에서 계속 쓰므로 유지한다.
- [ ] GREEN: `refreshAccessToken`(216-291) 전체(메서드 시그니처 위 JavaDoc 194-215 포함)를 오케스트레이터로 교체한다:

```java
    /**
     * Access Token 갱신 (비트랜잭션 오케스트레이터) — SEC-08.
     *
     * <p>JWT 용도·서명 검증 후, 비관적 락 회전은 {@link RefreshTokenRotator#rotate(String)}(별도 트랜잭션)에 위임한다.
     * 재사용·만료가 감지되면 회전 트랜잭션은 삭제 없이 롤백되어 비관적 락을 해제하고, 이 메서드가 {@link RefreshTokenRevoker}로
     * 패밀리를 별도 트랜잭션에서 폐기한 뒤 {@link InvalidRefreshTokenException}으로 재로그인을 요구한다. 폐기 커밋과 인증
     * 거부가 분리되므로 보안 통제가 롤백에 유실되지 않고, 회전 TX 종료 후 폐기하므로 자기교착도 없다(SEC-01 회전 동시성 불변식은
     * 회전 빈 내부에서 그대로 보존된다).
     *
     * @param refreshTokenValue 클라이언트가 제출한 Refresh Token 문자열
     * @return 토큰 갱신 응답 DTO (새로운 Access Token + 회전된 Refresh Token)
     * @throws InvalidRefreshTokenException 용도·서명·만료 검증 실패, DB 미존재, 저장 만료, 재사용 감지(패밀리 폐기)
     * @throws RuntimeException 일시적 동시 새로고침(grace 내 재제출)이거나 사용자 미존재인 경우
     */
    public AuthDto.RefreshResponse refreshAccessToken(String refreshTokenValue) {
        // 용도 강제(1차 검증: JwtUtil) — 서명·만료와 함께 tokenUse=refresh만 허용한다(DB 접근 이전, 무상태).
        // 레거시(용도 클레임 없음) Refresh 토큰은 allowLegacy=false로 거부해 재로그인을 유도한다.
        if (!jwtUtil.validateToken(refreshTokenValue, JwtUtil.TOKEN_USE_REFRESH, false)) {
            throw new InvalidRefreshTokenException();
        }

        try {
            // 비관적 락 회전은 별도 트랜잭션 빈에 위임한다(같은 빈 내부 호출이면 프록시 미적용으로 TX 분리 불가).
            return refreshTokenRotator.rotate(refreshTokenValue);
        } catch (RefreshReuseDetectedException e) {
            // 회전 TX가 롤백되어 비관적 락이 해제된 뒤 별도 트랜잭션으로 패밀리를 폐기한다(교착 없음, 독립 커밋).
            log.warn(
                    "Refresh Token 재사용 탐지 — 패밀리 폐기: eno={}, famNm={}",
                    e.getEno(),
                    e.getFamNm());
            refreshTokenRevoker.revokeFamilyByEno(e.getEno());
            // 재사용 감지는 재로그인 대상 — 전용 예외로 통일(원인은 위 warn 로그로만 구분, 토큰 값 미기록).
            throw new InvalidRefreshTokenException();
        } catch (RefreshExpiredException e) {
            // 만료도 재로그인 대상 — 패밀리 폐기 후 전용 예외로 통일(토큰 값 미기록).
            log.warn("만료된 Refresh Token — 패밀리 폐기 후 재로그인 유도: eno={}", e.getEno());
            refreshTokenRevoker.revokeFamilyByEno(e.getEno());
            throw new InvalidRefreshTokenException();
        }
    }
```

- [ ] GREEN: 회전 빈으로 이관된 private 헬퍼 두 개를 `AuthService`에서 **삭제**한다:
  - `findRefreshTokenByValue`(494-505) 전체
  - `validateSingleActiveToken`(507-523) 전체
  > `public static String sha256HexForToken`(484-492)은 `logoutByRefreshToken`·회전 빈·테스트가 함께 쓰므로 `AuthService`에 유지한다. `loadAthIds`(525-531)도 `login`/SSO/개발스위치가 쓰므로 유지한다(회전 빈은 자체 사본 사용).
- [ ] GREEN 실행 — `AuthServiceTest` 통과 확인(오케스트레이터 계약):
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.AuthServiceTest"` → **PASS**
- [ ] 회귀 실행 — 회전 빈 단위 테스트도 여전히 통과:
  `cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.system.service.RefreshTokenRotatorTest"` → **PASS**
- [ ] Commit:
  `cd C:/it/it_backend && git commit -am "refactor: refreshAccessToken을 비트랜잭션 오케스트레이터로 전환하고 2-트랜잭션 폐기 결선 (SEC-08)"`

---

## Task 6 — SEC-08 재사용·만료 격리 통합 테스트 (`@Tag("it")`)

**Files:**
- Test: Create `it_backend/src/test/java/com/kdb/it/common/system/service/RefreshReuseIsolationIT.java`
- (프로덕션 변경 없음 — Task 4·5 결과를 실 Oracle로 검증)

**Steps:**

- [ ] RED: `RefreshReuseIsolationIT.java`를 작성한다. `refreshAccessToken`을 **자체 트랜잭션 밖에서** 직접 호출해 2-트랜잭션 분리(회전 TX 롤백→락 해제→별도 TX 폐기)를 실제 재현한다. 회전 토큰은 실 JWT(`jwtUtil.generateRefreshToken`)로 만들고 SHA-256 조회값을 시드한다. `TPRMPP_CRTOKM` 감사 컬럼 NOT NULL 때문에 SecurityContext를 심는다:

```java
package com.kdb.it.common.system.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kdb.it.common.system.entity.Crtokm;
import com.kdb.it.common.system.repository.RefreshTokenRepository;
import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.exception.InvalidRefreshTokenException;
import com.kdb.it.support.OracleAvailableCondition;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Refresh Token 재사용·만료 탐지 시 패밀리 폐기가 인증 거부(회전 트랜잭션 롤백)와 무관하게 커밋되는지, 비관적 락 자기교착 없이
 * 완료되는지 실제 로컬 Oracle로 검증하는 통합 테스트 — SEC-08.
 *
 * <p>회전 트랜잭션({@link RefreshTokenRotator#rotate(String)})은 탐지 시점까지 read만 수행하므로 마커 예외로 롤백되어 락을 풀고,
 * 오케스트레이터({@code AuthService.refreshAccessToken})가 {@link RefreshTokenRevoker}로 패밀리를 별도 트랜잭션 커밋한다.
 * 검증은 {@code refreshAccessToken}을 자체 트랜잭션 밖에서 호출해 2-트랜잭션 분리를 그대로 재현한다.
 *
 * <p>{@code TPRMPP_CRTOKM}의 {@code FST_ENR_USID}/{@code LST_CHG_USID}가 NOT NULL이므로 시드 저장 시 JPA Auditing이
 * 감사자를 채우도록 인증 컨텍스트를 심는다. 로컬 Oracle이 꺼져 있으면 {@link OracleAvailableCondition}이 테스트를 스킵한다.
 */
@Tag("it")
@SpringBootTest(
        properties = {
            "jwt.secret=test-secret-key-for-junit-test-minimum-256-bits-length-ok"
        })
@ActiveProfiles("test-it")
@ExtendWith(OracleAvailableCondition.class)
class RefreshReuseIsolationIT {

    @Autowired private AuthService authService;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private PlatformTransactionManager transactionManager;

    private TransactionTemplate transactionTemplate;
    private String testEno;

    @BeforeEach
    void setUp() {
        transactionTemplate = new TransactionTemplate(transactionManager);
        testEno = ("ZZIT" + UUID.randomUUID().toString().replace("-", "")).substring(0, 20);
        // CRTOKM NOT NULL 감사자(FST_ENR_USID/LST_CHG_USID)를 채우도록 인증 컨텍스트를 심는다.
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(
                                "ITEST01",
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM TPRMPP_CRTOKM WHERE ENO = ?", testEno);
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("재사용 탐지: 회전된 토큰 grace 경과 재제출 → 401 + 패밀리 COUNT=0 커밋")
    void reuseDetected_revokesFamilyAndRejects() {
        String rawToken = jwtUtil.generateRefreshToken(testEno);
        String hash = AuthService.sha256HexForToken(rawToken);
        // 회전됨(AVL_YN='N') 토큰을 커밋 시드.
        seedToken(hash, "N", LocalDateTime.now().plusDays(7));
        // 회전 시각을 grace(기본 30초) 밖으로 밀어 재사용 경로 강제(시드 시 Auditing이 방금 채운 LST_CHG_DTM 보정).
        jdbcTemplate.update(
                "UPDATE TPRMPP_CRTOKM SET LST_CHG_DTM = ? WHERE ENO = ?",
                LocalDateTime.now().minusMinutes(5),
                testEno);

        assertThatThrownBy(() -> authService.refreshAccessToken(rawToken))
                .isInstanceOf(InvalidRefreshTokenException.class);

        // 패밀리가 별도 트랜잭션으로 폐기 커밋되어 잔존 행이 없어야 한다(교착 없이 완료).
        assertThat(countTokenRows()).isZero();
    }

    @Test
    @DisplayName("만료 탐지: DB 저장 만료 토큰 재제출 → 401 + 패밀리 COUNT=0 커밋")
    void expiredDetected_revokesFamilyAndRejects() {
        String rawToken = jwtUtil.generateRefreshToken(testEno);
        String hash = AuthService.sha256HexForToken(rawToken);
        // 활성(AVL_YN='Y')이나 DB 저장 만료일(END_DTM)이 과거인 토큰을 커밋 시드.
        seedToken(hash, "Y", LocalDateTime.now().minusDays(1));

        assertThatThrownBy(() -> authService.refreshAccessToken(rawToken))
                .isInstanceOf(InvalidRefreshTokenException.class);

        assertThat(countTokenRows()).isZero();
    }

    /** 지정 상태의 Refresh Token 1건을 별도 트랜잭션으로 커밋 시드한다(감사 공통값은 JPA Auditing이 채움). */
    private void seedToken(String hash, String avlYn, LocalDateTime endDtm) {
        transactionTemplate.execute(
                status -> {
                    refreshTokenRepository.saveAndFlush(
                            Crtokm.builder()
                                    .apiTokCone(hash)
                                    .ecyRnwPubTokCone(hash)
                                    .eno(testEno)
                                    .famNm(UUID.randomUUID().toString())
                                    .avlYn(avlYn)
                                    .endDtm(endDtm)
                                    .build());
                    return null;
                });
    }

    private int countTokenRows() {
        Integer count =
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM TPRMPP_CRTOKM WHERE ENO = ?", Integer.class, testEno);
        return count == null ? 0 : count;
    }
}
```

- [ ] GREEN 실행 — 로컬 Oracle 기동 상태에서:
  `cd C:/it/it_backend && ./gradlew integrationTest --tests "com.kdb.it.common.system.service.RefreshReuseIsolationIT"` → **PASS** (Oracle 미기동 시 스킵)
- [ ] Commit:
  `cd C:/it/it_backend && git commit -am "test: SEC-08 재사용·만료 패밀리 폐기 독립 커밋·교착 부재 격리 통합 테스트 추가"`

---

## Task 7 — 최종 검증 게이트 + 과제 메모

**Files:**
- (프로덕션·테스트 코드 변경 없음 — 인증 공통 변경 게이트 실행 및 문서 메모)
- Modify(선택): `C:/it/TASK.md` (SEC-08/09 진행 상태 메모)

**Steps:**

- [ ] 인증 공통 변경 게이트 — 전체 단위·슬라이스 테스트 클린 실행(it_backend/CLAUDE.md §9: 인증 공통 변경은 `clean test`):
  `cd C:/it/it_backend && ./gradlew clean test` → **PASS (BUILD SUCCESSFUL)**
- [ ] 로컬 Oracle 통합 테스트 전체 실행(신규 두 IT 포함):
  `cd C:/it/it_backend && ./gradlew integrationTest` → **PASS** (Oracle 미기동 시 `@Tag("it")` 스킵)
- [ ] 완료 조건 확인(체크리스트):
  - SEC-09: `LoginFailureIsolationIT`에서 실패 5건 커밋 잔존 + 6회째 계정 잠금 확인
  - SEC-08: `RefreshReuseIsolationIT`에서 재사용/만료 → 401 + 패밀리 COUNT=0(교착 없이 완료) 확인
  - 단위: `LoginHistoryWriterTest`/`RefreshTokenRevokerTest`/`RefreshTokenRotatorTest`/`AuthServiceTest` 모두 통과
- [ ] `TASK.md`의 SEC-08·SEC-09 항목에 "Phase A 구현·검증 완료(독립 커밋 2-TX 분리, `@Tag("it")` 격리 IT 추가)" 메모를 남기고, `TASK.md → TASK_DONE.md` 이관 규약(CLAUDE.md §5.3, 스펙 §8)에 따라 후속 이관을 예약한다. 시점성 수치(파일 수·테스트 수)는 `README.md` 변경 이력에만 기록한다.
- [ ] Commit(문서 메모가 있으면):
  `cd C:/it/it_backend && git commit -am "docs: SEC-08/09 Phase A 완료 메모"` (프로덕션 변경 없음)

---

## 부록 — 검증 명령 요약

| 목적 | 명령 (모두 `cd C:/it/it_backend &&` 선행) |
| --- | --- |
| 단위(개별) | `./gradlew test --tests "com.kdb.it.common.system.service.LoginHistoryWriterTest"` 등 |
| 통합(개별, `@Tag("it")`) | `./gradlew integrationTest --tests "com.kdb.it.common.system.service.RefreshReuseIsolationIT"` |
| 인증 공통 변경 게이트 | `./gradlew clean test` |
| 통합 전체 | `./gradlew integrationTest` |

**주의(중첩 git):** 모든 커밋은 `it_backend` 내부 git 저장소에서 수행한다(외부 `C:\it`에서 `it_backend`는 gitignore). 명령 앞에 `cd C:/it/it_backend &&`를 유지한다.
