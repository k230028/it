# ERR-06 감사로그 저장 실패 지속 탐지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 감사로그 저장 실패를 삼키는 정책은 유지하되, 실패를 Micrometer 카운터로 지속 탐지하고 향후 알람 확장 시 재귀를 막는 ThreadLocal 가드를 심는다.

**Architecture:** `ChangeLogEntityListener.persistLog`의 기존 `catch` 삼킴을 유지하면서, 실패 시 `MeterRegistry` 카운터(`audit.log.write.failure`)를 증가시키고, 실패 처리 구간을 `ThreadLocal<Boolean>` 재진입 가드로 감싼다. 리스너는 Spring 빈이 아니므로 `MeterRegistry`도 기존 `ApplicationContextHolder.getBean(...)` 패턴으로 조회한다. 메트릭 조회 실패가 감사 실패 로깅을 막지 않도록 내부 try로 격리한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Micrometer(`spring-boot-starter-actuator` 기존 포함), JUnit 5, Mockito(`MockedStatic`), AssertJ.

**참조 스펙:** `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md` §3.3

---

## File Structure

- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java`
  - `persistLog`에 재진입 가드 + 실패 시 메트릭·구조화 로그를 담당하는 `recordAuditFailure` 추가.
- Modify (test): `it_backend/src/test/java/com/kdb/it/domain/log/listener/ChangeLogEntityListenerTest.java`
  - 실패 시 카운터 증가 + 실패 후 플래그 복원 검증 테스트 추가.

---

## Task 1: 감사 실패 시 카운터 증가·플래그 복원 (RED)

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/domain/log/listener/ChangeLogEntityListenerTest.java`

- [ ] **Step 1: 실패 카운터 테스트 추가**

기존 import 블록에 아래 3줄을 추가한다(파일 상단 import 영역):

```java
import static org.assertj.core.api.Assertions.assertThat;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
```

`// ---- 실패 케이스 ----` 섹션(기존 `onPrePersist_Persister예외_예외삼킴` 아래)에 테스트 2개를 추가한다:

```java
    /**
     * AuditLogPersister 예외 발생 시 audit.log.write.failure 카운터가
     * 엔티티·변경유형 태그와 함께 1 증가해야 합니다.
     */
    @Test
    @DisplayName("persistLog - 감사 저장 실패 시 audit.log.write.failure 카운터 1 증가")
    void persistLog_감사실패_실패카운터증가() throws Exception {
        // Arrange
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        contextHolderMock.when(() -> ApplicationContextHolder.getBean(MeterRegistry.class))
                .thenReturn(registry);
        doThrow(new RuntimeException("DB 오류"))
                .when(auditLogPersister).persist(any(), any(), any());
        SampleEntity entity = new SampleEntity();

        // Act
        listener.onPrePersist(entity);

        // Assert: entity=SampleEntity, chgTp=C 태그로 카운터 1 증가
        double count = registry.counter("audit.log.write.failure",
                "entity", "SampleEntity", "chgTp", "C").count();
        assertThat(count).isEqualTo(1.0);
    }

    /**
     * 감사 실패 처리 후 재진입 가드 플래그가 복원되어
     * 다음 엔티티의 정상 감사 저장이 정상 동작해야 합니다.
     */
    @Test
    @DisplayName("persistLog - 실패 처리 후 다음 엔티티는 정상적으로 감사 저장")
    void persistLog_실패처리후_다음엔티티정상저장() throws Exception {
        // Arrange: 첫 호출만 실패, 이후 정상
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        contextHolderMock.when(() -> ApplicationContextHolder.getBean(MeterRegistry.class))
                .thenReturn(registry);
        SampleEntity failing = new SampleEntity();
        doThrow(new RuntimeException("DB 오류"))
                .when(auditLogPersister).persist(eq(failing), any(), any());

        // Act: 실패 1건 → 정상 1건
        listener.onPrePersist(failing);
        SampleEntity ok = new SampleEntity();
        listener.onPrePersist(ok);

        // Assert: 정상 엔티티는 persist 호출됨(가드가 정상 흐름을 막지 않음)
        verify(auditLogPersister, times(1)).persist(eq(ok), eq(SampleLogEntity.class), eq("C"));
    }
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.ChangeLogEntityListenerTest"`
Expected: `persistLog_감사실패_실패카운터증가` FAIL — 현재 구현은 카운터를 증가시키지 않으므로 `count`가 `0.0`이라 `isEqualTo(1.0)` 실패. (`persistLog_실패처리후_다음엔티티정상저장`은 현재도 통과할 수 있음 — 가드가 아직 없어 흐름을 막지 않으므로. 정상.)

---

## Task 2: 카운터 + 재진입 가드 구현 (GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java`

- [ ] **Step 1: import 추가**

파일 상단 import 영역(`import org.slf4j.LoggerFactory;` 아래)에 추가:

```java
import io.micrometer.core.instrument.MeterRegistry;
```

- [ ] **Step 2: 재진입 가드 ThreadLocal 필드 추가**

`inFlightEntities` 필드 선언 바로 아래(약 40행)에 추가:

```java
    /** 감사 실패 처리 중 재진입 차단 플래그 (향후 catch 내 알림·감사 유발 코드의 재귀·연쇄 실패 방지) */
    private static final ThreadLocal<Boolean> handlingFailure =
            ThreadLocal.withInitial(() -> Boolean.FALSE);
```

- [ ] **Step 3: persistLog에 가드 + 실패 기록 분리**

기존 `persistLog` 메서드(101~116행)를 아래로 교체한다:

```java
    private void persistLog(Object entity, String chgTp) {
        // 감사 실패 처리 중이면 재진입하지 않는다(재귀·연쇄 실패 방지).
        if (Boolean.TRUE.equals(handlingFailure.get())) {
            return;
        }
        LogTarget ann = entity.getClass().getAnnotation(LogTarget.class);
        Class<? extends BaseLogEntity> logClass = ann.entity();
        try {
            AuditLogPersister persister = ApplicationContextHolder.getBean(AuditLogPersister.class);
            persister.persist(entity, logClass, chgTp);
        } catch (Exception e) {
            // 감사로그 실패가 본 업무 트랜잭션을 롤백시키지 않도록 예외를 삼킨다.
            // 시퀀스 미생성(ORA-02289) 등 인프라 오류 시 본 작업은 정상 완료되어야 한다.
            // 삼킴을 유지하되, 감사 추적 유실을 메트릭으로 지속 탐지한다(ERR-06).
            handlingFailure.set(Boolean.TRUE);
            try {
                recordAuditFailure(entity, logClass, chgTp, e);
            } finally {
                handlingFailure.set(Boolean.FALSE);
            }
        }
    }

    /**
     * 감사로그 저장 실패를 지속 탐지 가능한 형태로 기록한다.
     *
     * <p>Micrometer 카운터({@code audit.log.write.failure})를 엔티티·변경유형 태그와 함께 증가시키고,
     * ERROR 로그를 남긴다. 메트릭 조회·기록 실패가 감사 실패 로깅을 막지 않도록 내부 try로 격리한다.</p>
     *
     * @param entity   감사 대상 엔티티
     * @param logClass 로그 엔티티 클래스
     * @param chgTp    변경 유형(C/U/D)
     * @param e        감사 저장 실패 원인 예외
     */
    private void recordAuditFailure(Object entity, Class<? extends BaseLogEntity> logClass,
            String chgTp, Exception e) {
        try {
            MeterRegistry registry = ApplicationContextHolder.getBean(MeterRegistry.class);
            registry.counter("audit.log.write.failure",
                    "entity", entity.getClass().getSimpleName(),
                    "chgTp", chgTp).increment();
        } catch (Exception metricEx) {
            // 메트릭 기록 실패가 감사 실패 로깅을 막아서는 안 된다.
            log.warn("[감사로그] 실패 메트릭 기록 실패 — 카운터 미증가", metricEx);
        }
        log.error("[감사로그 기록 실패] entity={}, logClass={}, chgTp={}",
                entity.getClass().getSimpleName(), logClass.getSimpleName(), chgTp, e);
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.ChangeLogEntityListenerTest"`
Expected: PASS (기존 실패 삼킴 테스트 포함 전부 통과). `persistLog_감사실패_실패카운터증가`가 카운터 1 증가로 통과.

> 참고: 기존 `onPrePersist_Persister예외_예외삼킴` / `persistLog_컨텍스트예외_예외삼킴` 테스트는 `MeterRegistry` 스텁이 없어 `getBean(MeterRegistry.class)`가 null을 반환한다. `recordAuditFailure` 내부 try가 이 NPE를 잡고 `log.warn`으로 처리하므로 예외는 전파되지 않고 두 테스트는 계속 통과한다.

---

## Task 3: 감사 도메인 전체 회귀 + 커밋

**Files:** (없음 — 검증·커밋)

- [ ] **Step 1: 감사로그 공통 변경 전체 테스트**

CLAUDE.md §9(감사로그 공통 변경)에 따라 clean 포함 실행:

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL. (파일 락 발생 시 메모리 노트대로 `--no-daemon` 병행)

- [ ] **Step 2: 커밋**

```bash
cd it_backend
git add src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java src/test/java/com/kdb/it/domain/log/listener/ChangeLogEntityListenerTest.java
git commit -m "feat(log): 감사로그 저장 실패 Micrometer 카운터·재진입 가드 추가 (ERR-06)"
```

> `it_backend`는 별도 git 저장소이므로 커밋은 `it_backend` 내부에서 수행한다.

---

## Self-Review

- **Spec coverage(§3.3):** Micrometer 카운터(Task 2 Step 3 `audit.log.write.failure`) ✓, 구조화 error 로그 유지(`recordAuditFailure`의 `log.error`) ✓, 재귀 방지 ThreadLocal 가드(Task 2 Step 2·3) ✓, 삼킴·원업무 보호 유지(catch 유지, 예외 미전파) ✓. 폭주 방지(rate-limit)는 카운터 위주 설계로 로그 폭주 위험이 낮아 본 계획에서는 미도입 — 필요 시 후속.
- **Placeholder scan:** 없음. 모든 스텝에 실제 코드·명령·기대결과 기재.
- **Type consistency:** `recordAuditFailure(Object, Class<? extends BaseLogEntity>, String, Exception)` 시그니처가 `persistLog`의 `logClass`(`Class<? extends BaseLogEntity>`) 타입과 일치. 카운터 이름·태그(`audit.log.write.failure` / `entity` / `chgTp`)가 테스트 assert와 구현에서 동일.
