# ERR-06 감사로그 저장 실패 지속 탐지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 감사로그 저장 실패가 원 업무 트랜잭션을 롤백하지 않도록 감사 INSERT를 원 업무 커밋 후 별도 트랜잭션으로 실행하고, 모든 감사 쓰기 실패를 Micrometer 카운터·구조화 로그로 지속 탐지한다.

**Architecture:** `ChangeLogEntityListener`는 기존처럼 엔티티 스냅샷 생성을 `AuditLogPersister`에 위임한다. `AuditLogPersister`는 활성 트랜잭션에서는 `afterCommit` 콜백을 등록하고, 콜백이 `AuditLogWriter.writeInNewTransaction`을 호출해 별도 트랜잭션에서 INSERT와 flush를 완료한다. 실패는 `AuditFailureRecorder`가 카운터와 엔티티 식별자를 포함한 로그로 기록하며, 정적 ThreadLocal 상태를 통해 실패 처리 중 감사 재진입을 차단한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Transaction Synchronization, Spring Data JPA, Micrometer, JUnit 5, Mockito, AssertJ, 로컬 Oracle 통합 테스트.

## Global Constraints

- 감사 실패가 원 업무 커밋을 롤백해서는 안 된다.
- 원 업무가 롤백되면 감사 INSERT도 실행하지 않는다.
- 감사 INSERT는 `REQUIRES_NEW` 트랜잭션에서 `flush()`까지 완료해 지연 DB 오류를 실패 카운터에 포함한다.
- 메트릭 태그는 `entity`, `chgTp`, `stage`처럼 값 종류가 제한된 항목만 사용하며 PK는 태그에 넣지 않는다.
- 오류 로그에는 엔티티 종류·식별자·변경유형·실패 단계만 기록하고 비밀값·전체 엔티티·PII는 기록하지 않는다.
- `/actuator/metrics`는 관리자만 접근할 수 있어야 한다.
- 신규 JavaDoc과 인라인 주석은 한글로 작성한다.

**참조 스펙:** `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md` §3.3

---

## Data Flow

```text
JPA @PrePersist/@PreUpdate
        |
        v
ChangeLogEntityListener
        |
        v
AuditLogPersister: 로그 엔티티 스냅샷 생성
        |
        +-- 원 업무 트랜잭션 rollback --> 종료(감사 INSERT 없음)
        |
        `-- 원 업무 transaction afterCommit
                    |
                    v
        AuditLogWriter.writeInNewTransaction(REQUIRES_NEW)
                    |
             persist + flush
              |           |
            성공          실패
                          |
                          v
              AuditFailureRecorder
              counter + ERROR log
              ThreadLocal 재진입 차단
```

---

## File Structure

- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java`
  - 실패 처리 중 재진입 차단, 스냅샷 준비 단계 예외를 recorder에 위임.
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java`
  - 즉시 INSERT 대신 스냅샷 생성과 afterCommit 등록을 담당.
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogWriter.java`
  - `REQUIRES_NEW` 감사 INSERT·flush 전담.
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditFailureRecorder.java`
  - 카운터·구조화 로그·재진입 ThreadLocal 전담.
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditEntityIdentifier.java`
  - 단일·다중·복합 PK와 guid의 안전한 로그 식별자 생성.
- Modify: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`
  - Actuator health 공개, 나머지 Actuator 관리자 제한.
- Modify: `it_backend/src/main/resources/application.properties`
  - `health,metrics`만 HTTP 노출.
- Create: `it_backend/docs/guides/operations/audit-failure-monitoring.md`
  - 조회 URL, 카운터 태그, 경보 기준과 장애 대응 절차.
- Modify/Create tests:
  - `ChangeLogEntityListenerTest.java`
  - `AuditLogPersisterTest.java`
  - `AuditLogWriterTest.java`
  - `AuditFailureRecorderTest.java`
  - `AuditEntityIdentifierTest.java`
  - `AuditFailureIsolationIT.java` (`@Tag("it")`)

---

## Task 1: 감사 실패 recorder와 실제 재진입 차단 (RED → GREEN)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditFailureRecorder.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditFailureRecorderTest.java`

**Interfaces:**
- Produces: `boolean AuditFailureRecorder.isHandlingFailure()`
- Produces: `void AuditFailureRecorder.record(String entityName, String entityId, String chgTp, String stage, Exception cause)`

- [ ] **Step 1: 실패 테스트 작성**

다음 네 동작을 검증한다.

```java
@Test
void record_실패카운터를제한된태그로증가한다() {
    recorder.record("Bprojm", "PRJ-1", "U", "afterCommit", new RuntimeException("DB 오류"));
    assertThat(registry.counter("audit.log.write.failure",
            "entity", "Bprojm", "chgTp", "U", "stage", "afterCommit").count()).isEqualTo(1.0);
}

@Test
void record_처리중재호출은무시한다() {
    MeterRegistry reentrantRegistry = mock(MeterRegistry.class);
    given(reentrantRegistry.counter(anyString(), any(String[].class))).willAnswer(invocation -> {
        assertThat(AuditFailureRecorder.isHandlingFailure()).isTrue();
        recorder.record("Bprojm", "PRJ-1", "U", "nested", new RuntimeException("재진입"));
        throw new IllegalStateException("메트릭 실패");
    });
    assertThatCode(() -> new AuditFailureRecorder(reentrantRegistry)
            .record("Bprojm", "PRJ-1", "U", "afterCommit", new RuntimeException("DB 오류")))
            .doesNotThrowAnyException();
}

@Test
void record_완료후ThreadLocal을제거한다() {
    recorder.record("Bprojm", "PRJ-1", "U", "afterCommit", new RuntimeException("DB 오류"));
    assertThat(AuditFailureRecorder.isHandlingFailure()).isFalse();
}

@Test
void record_메트릭실패가예외로전파되지않는다() {
    MeterRegistry broken = mock(MeterRegistry.class);
    given(broken.counter(anyString(), any(String[].class))).willThrow(new IllegalStateException("registry 오류"));
    assertThatCode(() -> new AuditFailureRecorder(broken)
            .record("Bprojm", "PRJ-1", "C", "schedule", new RuntimeException("원인")))
            .doesNotThrowAnyException();
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.AuditFailureRecorderTest"`

Expected: 컴파일 실패 — `AuditFailureRecorder` 미존재.

- [ ] **Step 3: 최소 구현**

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditFailureRecorder {
    private static final ThreadLocal<Boolean> HANDLING_FAILURE =
            ThreadLocal.withInitial(() -> Boolean.FALSE);
    private final MeterRegistry meterRegistry;

    public static boolean isHandlingFailure() {
        return Boolean.TRUE.equals(HANDLING_FAILURE.get());
    }

    public void record(String entityName, String entityId, String chgTp,
            String stage, Exception cause) {
        if (isHandlingFailure()) {
            return;
        }
        HANDLING_FAILURE.set(Boolean.TRUE);
        try {
            try {
                meterRegistry.counter("audit.log.write.failure",
                        "entity", entityName,
                        "chgTp", chgTp,
                        "stage", stage).increment();
            } catch (Exception metricException) {
                log.warn("[감사로그] 실패 메트릭 기록 실패: entity={}, chgTp={}, stage={}",
                        entityName, chgTp, stage, metricException);
            }
            log.error("[감사로그 기록 실패] entity={}, entityId={}, chgTp={}, stage={}",
                    entityName, entityId, chgTp, stage, cause);
        } finally {
            HANDLING_FAILURE.remove();
        }
    }
}
```

- [ ] **Step 4: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.AuditFailureRecorderTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/domain/log/listener/AuditFailureRecorder.java src/test/java/com/kdb/it/domain/log/listener/AuditFailureRecorderTest.java
git commit -m "feat(log): 감사 실패 recorder와 재진입 가드 추가 (ERR-06)"
```

---

## Task 2: 별도 트랜잭션 감사 writer (RED → GREEN)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogWriter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditLogWriterTest.java`

**Interfaces:**
- Consumes: 완성된 `BaseLogEntity`
- Produces: `void AuditLogWriter.writeInNewTransaction(BaseLogEntity logEntity)`

- [ ] **Step 1: persist와 flush를 모두 호출하는 테스트 작성**

```java
@Test
void writeInNewTransaction_persist후flush한다() {
    SampleLogEntity logEntity = new SampleLogEntity();
    writer.writeInNewTransaction(logEntity);
    InOrder order = inOrder(entityManager);
    order.verify(entityManager).persist(logEntity);
    order.verify(entityManager).flush();
}

@Test
void writeInNewTransaction_flush실패를호출자에게전파한다() {
    SampleLogEntity logEntity = new SampleLogEntity();
    doThrow(new PersistenceException("지연 INSERT 실패"))
            .when(entityManager).flush();
    assertThatThrownBy(() -> writer.writeInNewTransaction(logEntity))
            .isInstanceOf(PersistenceException.class)
            .hasMessageContaining("지연 INSERT 실패");
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.AuditLogWriterTest"`

Expected: 컴파일 실패 — `AuditLogWriter` 미존재.

- [ ] **Step 3: 구현**

```java
@Component
public class AuditLogWriter {
    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void writeInNewTransaction(BaseLogEntity logEntity) {
        entityManager.persist(logEntity);
        // INSERT 오류를 afterCommit 콜백 안에서 확정해 실패 recorder가 포착하도록 강제한다.
        entityManager.flush();
    }
}
```

- [ ] **Step 4: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.AuditLogWriterTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/domain/log/listener/AuditLogWriter.java src/test/java/com/kdb/it/domain/log/listener/AuditLogWriterTest.java
git commit -m "feat(log): 감사로그 별도 트랜잭션 writer 추가 (ERR-06)"
```

---

## Task 3: afterCommit 예약과 실패 기록 (RED → GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditEntityIdentifier.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditLogPersisterTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditEntityIdentifierTest.java`

**Interfaces:**
- Consumes: `AuditLogWriter`, `AuditFailureRecorder`
- Preserves: `void persist(Object sourceEntity, Class<? extends BaseLogEntity> logClass, String chgTp)`

- [ ] **Step 1: 트랜잭션 결과별 실패 테스트 작성**

`TransactionSynchronizationManager.initSynchronization()`으로 동기화를 열고 테스트 후 반드시 `clearSynchronization()`한다.

`AuditEntityIdentifierTest`는 단일 `@Id`, 다중 `@Id`, `@EmbeddedId`, ID 미할당+guid, 모두 미할당의 다섯 경우를 검증한다.

```java
@Test
void persist_호출시즉시쓰지않고afterCommit에서쓴다() {
    persister.persist(source, SampleLogEntity.class, "U");
    verifyNoInteractions(writer);
    TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
    verify(writer).writeInNewTransaction(any(SampleLogEntity.class));
}

@Test
void persist_원업무rollback이면감사쓰기를실행하지않는다() {
    persister.persist(source, SampleLogEntity.class, "U");
    TransactionSynchronizationManager.getSynchronizations()
            .forEach(sync -> sync.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
    verifyNoInteractions(writer);
}

@Test
void persist_afterCommit쓰기실패를recorder에전달한다() {
    doThrow(new RuntimeException("감사 INSERT 실패")).when(writer)
            .writeInNewTransaction(any(BaseLogEntity.class));
    persister.persist(source, SampleLogEntity.class, "U");
    TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
    verify(failureRecorder).record(eq("SampleEntity"), anyString(), eq("U"), eq("afterCommit"), any());
}

@Test
void persist_동기화없는직접쓰기실패는direct단계로기록한다() {
    doThrow(new RuntimeException("감사 INSERT 실패")).when(writer)
            .writeInNewTransaction(any(BaseLogEntity.class));
    persister.persist(source, SampleLogEntity.class, "U");
    verify(failureRecorder).record(
            eq("SampleEntity"), anyString(), eq("U"), eq("direct"), any());
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.AuditLogPersisterTest" --tests "com.kdb.it.domain.log.listener.AuditEntityIdentifierTest"`

Expected: 기존 구현이 writer를 즉시 사용하거나 동기화를 등록하지 않아 실패.

- [ ] **Step 3: 구현 변경**

- 기존 로그 엔티티 생성·공통값·컬럼 복사 코드는 `createSnapshot(...)` private 메서드로 이동한다.
- `AuditLogPersister`의 클래스 수준 `@Transactional`과 `EntityManager` 필드는 제거한다. DB 쓰기는 `AuditLogWriter`만 수행한다.
- 엔티티 식별자는 `@Id`/`@EmbeddedId` 필드 값을 `field=value` 형태로 결합하고, 아직 값이 없으면 `guid`, 둘 다 없으면 `"<unavailable>"`을 사용한다.
- PK는 로그에만 전달하고 Micrometer 태그에는 사용하지 않는다.
- 동기화가 활성화되지 않은 호출은 `writeSafely`를 즉시 실행한다.

```java
public void persist(Object sourceEntity, Class<? extends BaseLogEntity> logClass, String chgTp) {
    BaseLogEntity snapshot = createSnapshot(sourceEntity, logClass, chgTp);
    String entityName = sourceEntity.getClass().getSimpleName();
    String entityId = AuditEntityIdentifier.resolve(sourceEntity);

    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
        writeSafely(snapshot, entityName, entityId, chgTp, "direct");
        return;
    }
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
        @Override
        public void afterCommit() {
            writeSafely(snapshot, entityName, entityId, chgTp, "afterCommit");
        }
    });
}

private void writeSafely(BaseLogEntity snapshot, String entityName, String entityId,
        String chgTp, String stage) {
    try {
        auditLogWriter.writeInNewTransaction(snapshot);
    } catch (Exception exception) {
        auditFailureRecorder.record(entityName, entityId, chgTp, stage, exception);
    }
}
```

`AuditEntityIdentifier`는 선언 필드와 상위 클래스 필드의 `@Id`/`@EmbeddedId`를 읽고, 값이 없으면 이미 보정된 `guid`로 대체한다. 리스너와 persister가 같은 로직을 사용하도록 별도 utility로 고정한다.

```java
/** 감사 실패 로그에 사용할 엔티티 식별자를 생성하는 utility. */
public final class AuditEntityIdentifier {
    private AuditEntityIdentifier() {
    }

    /**
     * 단일·다중·복합 PK를 읽고 아직 할당되지 않았으면 guid로 대체한다.
     *
     * @param sourceEntity 감사 대상 엔티티
     * @return 필드명=값 목록, 식별 불가 시 {@code <unavailable>}
     */
    public static String resolve(Object sourceEntity) {
        List<String> identifiers = new ArrayList<>();
        Class<?> type = sourceEntity.getClass();
        while (type != null && type != Object.class) {
            for (Field field : type.getDeclaredFields()) {
                if (field.isAnnotationPresent(Id.class)
                        || field.isAnnotationPresent(EmbeddedId.class)) {
                    field.setAccessible(true);
                    try {
                        Object value = field.get(sourceEntity);
                        if (value != null) {
                            if (field.isAnnotationPresent(EmbeddedId.class)) {
                                identifiers.addAll(describeEmbeddedId(value));
                            } else {
                                identifiers.add(field.getName() + "=" + value);
                            }
                        }
                    } catch (IllegalAccessException exception) {
                        identifiers.add(field.getName() + "=<unavailable>");
                    }
                }
            }
            type = type.getSuperclass();
        }
        if (!identifiers.isEmpty()) {
            return String.join(",", identifiers);
        }
        Object guid = readField(sourceEntity, "guid");
        return guid == null ? "<unavailable>" : "guid=" + guid;
    }

    private static List<String> describeEmbeddedId(Object embeddedId) {
        List<String> identifiers = new ArrayList<>();
        for (Field field : embeddedId.getClass().getDeclaredFields()) {
            field.setAccessible(true);
            try {
                identifiers.add(field.getName() + "=" + field.get(embeddedId));
            } catch (IllegalAccessException exception) {
                identifiers.add(field.getName() + "=<unavailable>");
            }
        }
        return identifiers;
    }

    private static Object readField(Object target, String fieldName) {
        Class<?> type = target.getClass();
        while (type != null && type != Object.class) {
            try {
                Field field = type.getDeclaredField(fieldName);
                field.setAccessible(true);
                return field.get(target);
            } catch (NoSuchFieldException exception) {
                type = type.getSuperclass();
            } catch (IllegalAccessException exception) {
                return null;
            }
        }
        return null;
    }
}
```

추가 import는 `jakarta.persistence.Id`, `jakarta.persistence.EmbeddedId`, `java.lang.reflect.Field`, `java.util.ArrayList`, `java.util.List`다.

- [ ] **Step 4: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.AuditLogPersisterTest" --tests "com.kdb.it.domain.log.listener.AuditEntityIdentifierTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java src/main/java/com/kdb/it/domain/log/listener/AuditEntityIdentifier.java src/test/java/com/kdb/it/domain/log/listener/AuditLogPersisterTest.java src/test/java/com/kdb/it/domain/log/listener/AuditEntityIdentifierTest.java
git commit -m "refactor(log): 감사 저장을 원 업무 커밋 이후로 분리 (ERR-06)"
```

---

## Task 4: 리스너 재진입·예약 실패 처리 (RED → GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/log/listener/ChangeLogEntityListenerTest.java`

- [ ] **Step 1: 실제 가드 테스트 작성**

```java
@Test
void persistLog_감사실패처리중이면persister를호출하지않는다() {
    try (MockedStatic<AuditFailureRecorder> guard = mockStatic(AuditFailureRecorder.class)) {
        guard.when(AuditFailureRecorder::isHandlingFailure).thenReturn(true);
        listener.onPrePersist(new SampleEntity());
        verifyNoInteractions(auditLogPersister);
    }
}
```

`ApplicationContextHolder.getBean(AuditLogPersister.class)` 실패 시 `AuditFailureRecorder.record(..., "schedule", ...)`가 호출되고 예외가 전파되지 않는 테스트도 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.ChangeLogEntityListenerTest"`

Expected: 가드와 recorder 위임이 없어 실패.

- [ ] **Step 3: 구현 변경**

```java
private void persistLog(Object entity, String chgTp) {
    if (AuditFailureRecorder.isHandlingFailure()) {
        return;
    }
    LogTarget annotation = entity.getClass().getAnnotation(LogTarget.class);
    Class<? extends BaseLogEntity> logClass = annotation.entity();
    try {
        ApplicationContextHolder.getBean(AuditLogPersister.class).persist(entity, logClass, chgTp);
    } catch (Exception exception) {
        try {
            ApplicationContextHolder.getBean(AuditFailureRecorder.class)
                    .record(entity.getClass().getSimpleName(),
                            AuditEntityIdentifier.resolve(entity),
                            chgTp, "schedule", exception);
        } catch (Exception recorderException) {
            log.error("[감사로그 예약 실패] entity={}, logClass={}, chgTp={}",
                    entity.getClass().getSimpleName(), logClass.getSimpleName(), chgTp, exception);
            log.warn("[감사로그] 실패 recorder 조회 실패", recorderException);
        }
    }
}
```

- [ ] **Step 4: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.ChangeLogEntityListenerTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java src/test/java/com/kdb/it/domain/log/listener/ChangeLogEntityListenerTest.java
git commit -m "feat(log): 감사 실패 재진입과 예약 실패를 차단 (ERR-06)"
```

---

## Task 5: 메트릭 노출·접근 제어·운영 문서

**Files:**
- Modify: `it_backend/src/main/resources/application.properties`
- Modify: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`
- Test: `it_backend/src/test/java/com/kdb/it/config/SecurityConfigTest.java`
- Create: `it_backend/docs/guides/operations/audit-failure-monitoring.md`

- [ ] **Step 1: Actuator 접근 테스트 추가**

- 비인증 `/actuator/health`는 200.
- 비인증·일반사용자 `/actuator/metrics`는 각각 401·403.
- 관리자 `/actuator/metrics/audit.log.write.failure`는 카운터 생성 후 200.

- [ ] **Step 2: 설정·인가 구현**

`application.properties`:

```properties
management.endpoints.web.exposure.include=health,metrics
```

`SecurityConfig`의 `anyRequest()` 앞:

```java
.requestMatchers("/actuator/health").permitAll()
.requestMatchers("/actuator/**").hasRole("ADMIN")
```

- [ ] **Step 3: 운영 문서 작성**

문서에는 다음을 실제 명령과 함께 기록한다.

```text
GET /actuator/metrics/audit.log.write.failure
경보: 5분 증가량 > 0
분류 태그: entity, chgTp, stage
초동조치: 원 업무 성공 여부 확인 → 감사 테이블/시퀀스/권한 확인 → 누락 범위 산정
주의: 외부 모니터링 계정은 ADMIN JWT를 사용하지 말고 운영망 전용 관리 포트/프록시로 제한
```

- [ ] **Step 4: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.config.SecurityConfigTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/resources/application.properties src/main/java/com/kdb/it/config/SecurityConfig.java src/test/java/com/kdb/it/config/SecurityConfigTest.java docs/guides/operations/audit-failure-monitoring.md
git commit -m "feat(ops): 감사 실패 메트릭 노출과 접근 제어 추가 (ERR-06)"
```

---

## Task 6: 트랜잭션 격리 통합 테스트와 전체 회귀

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditFailureIsolationIT.java`

- [ ] **Step 1: 로컬 Oracle 통합 테스트 작성**

`@Tag("it")`, `@SpringBootTest`를 사용하고 각 테스트가 고유 업무 PK를 생성·정리한다.

- 원 업무 커밋 후 writer 성공 → 원본 행과 감사 행 모두 존재.
- 원 업무 rollback → 원본 행과 감사 행 모두 없음.
- `@MockitoSpyBean AuditLogWriter`가 대상 업무 엔티티의 감사 snapshot에만 `DataIntegrityViolationException`을 던지도록 스텁 → 원본 행은 존재, 감사 행은 없음, `audit.log.write.failure{stage=afterCommit}` 1 증가. Task 2의 `EntityManager.flush()` 예외 전파 테스트와 결합해 지연 DB 오류가 같은 catch 경로로 들어옴을 증명한다.
- 실패 후 같은 테스트 스레드의 다음 정상 감사 저장 성공 → ThreadLocal 잔존 없음.

강제 실패 스텁은 한 번만 동작하도록 `doThrow(...).doCallRealMethod().when(auditLogWriter).writeInNewTransaction(any())`를 사용한다. 첫 원 업무 저장 직전 카운터 값을 보관하고 Awaitility 없이 afterCommit 완료 직후 `+1`을 검증한다. 다음 정상 저장은 같은 spy의 실제 메서드를 호출하고 감사 행 존재까지 확인한다.

- [ ] **Step 2: 통합 테스트 실행**

Run: `cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.domain.log.listener.AuditFailureIsolationIT"`

Expected: PASS. 로컬 Oracle 미가동이면 구현 완료로 간주하지 않고 환경을 기동한 뒤 재실행한다.

- [ ] **Step 3: 전체 회귀**

Run: `cd it_backend && ./gradlew clean test integrationTest`

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd it_backend
git add src/test/java/com/kdb/it/domain/log/listener/AuditFailureIsolationIT.java
git commit -m "test(log): 감사 실패와 원 업무 트랜잭션 격리 검증 (ERR-06)"
```

---

## NOT in scope

- 감사 이벤트 영구 outbox와 누락 자동 복구: 프로세스 종료 창까지 제거하려면 별도 저장소가 필요하므로 후속 신뢰성 과제로 분리한다.
- EAI·메일·인앱 경보 발송: 외부 운영값이 필요하므로 본 계획은 수집 가능한 메트릭과 대응 절차까지만 제공한다.
- 기존 감사 데이터 백필: 신규 실패 탐지와 무관하며 누락 범위가 확인된 경우 별도 데이터 조치로 수행한다.

## What already exists

- `ChangeLogEntityListener`의 `@PrePersist`/`@PreUpdate` 진입과 중복 방지 로직은 유지한다.
- `AuditLogPersister`의 스냅샷 생성·공통 감사값·컬럼 복사 로직은 재사용한다.
- `spring-boot-starter-actuator` 의존성은 이미 있으므로 별도 라이브러리를 추가하지 않는다.

## Self-Review

- **Spec coverage:** 원 업무 보호, 실패 카운터, 구조화 로그(엔티티/PK/작업), 재진입 차단, 실제 Oracle 실패 검증을 Task 1~6에 매핑했다.
- **Placeholder scan:** 구현 클래스·시그니처·테스트 분기·명령·기대 결과를 모두 기재했다.
- **Type consistency:** writer는 `BaseLogEntity`, recorder는 제한된 문자열 태그와 예외를 받으며 listener/persister/test에서 동일 시그니처를 사용한다.
- **Failure visibility:** 예약 실패는 `stage=schedule`, 커밋 후 INSERT 실패는 `stage=afterCommit`, 트랜잭션 없는 직접 호출 실패는 `stage=direct`로 구분한다.
- **Performance:** 업무 요청마다 동기 DB INSERT를 제거하고 커밋 후 별도 1회 INSERT를 수행한다. 비동기 executor는 도입하지 않는다.
