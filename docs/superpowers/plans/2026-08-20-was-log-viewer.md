# 관리자 실시간 WAS 로그 뷰어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 브라우저에서 여러 WAS 인스턴스의 애플리케이션 로그를 실시간에 가깝게 조회하고, 한시적으로 로그 레벨을 올리고, 화면 범위를 파일로 내려받게 한다.

**Architecture:** logback Appender가 로그 이벤트를 프로세스 메모리 링버퍼에 담고, 관리자 API가 seq 커서 기반 증분 조회로 그 스냅샷을 내려준다. 대상 인스턴스가 요청을 받은 인스턴스와 다르면 설정에 적힌 피어의 내부 엔드포인트로 위임 호출해 결과를 대신 가져온다(피어 팜아웃). 프론트는 3초 폴링으로 커서를 밀며 목록을 이어붙인다.

**Tech Stack:** Spring Boot(Java 25) · logback · Spring `LoggingSystem` · `RestClient` · Nuxt 4 CSR · Vue 3 Composition API · PrimeVue · Vitest · Oracle(Flyway)

**설계 문서:** [`docs/superpowers/specs/2026-08-20-was-log-viewer-design.md`](../specs/2026-08-20-was-log-viewer-design.md)

## Global Constraints

- **저장소 분리**: `it_backend`·`it_frontend`·`it_database`는 각각 독립 git 저장소다. 커밋은 각 저장소 안에서 따로 한다.
- **공유 워킹트리**: `git add -A`·`git add .`·`git commit -a` 금지. 항상 경로를 명시한다. 커밋 전 `git diff --cached --stat`으로 자기 변경만 담겼는지 확인한다.
- **Java 25**, 포매터는 spotless + google-java-format **AOSP**(4-space indent). 커밋 전 `./gradlew spotlessApply`.
- **신규 JavaDoc·TSDoc·주석은 한글**로 쓴다. 공개 API·서비스 메서드에는 입력과 실패 조건을 적는다.
- **Gradle 파일락**: 테스트 실행이 `binary/output.bin` 락으로 실패하면 `--no-daemon`으로 재실행한다.
- **프론트 사용자 노출 문구는 전부 i18n 키**로 만든다. 하드코딩 한국어 리터럴 금지(`npm run check:copy` 래칫이 감시).
- **프론트 들여쓰기 4-space**, 커밋 전 `npm run format:check`.
- **비밀값**은 환경변수로만 주입한다. properties 파일·문서·커밋 메시지에 실제 값을 적지 않는다.

### 확정 상수 (설계 §11)

| 상수 | 값 | 위치 |
| --- | --- | --- |
| 링버퍼 크기 | 2000건 | `app.was-log.buffer-capacity` |
| 메시지 절단 | 4000자 | `RingBufferAppender.MAX_MESSAGE_CHARS` |
| 스택트레이스 절단 | 8000자 | `RingBufferAppender.MAX_THROWABLE_CHARS` |
| 조회 limit 기본·상한 | 200 | `WasLogService.MAX_LIMIT` |
| 폴링 주기 | 3000ms | `useWasLogFeed` `POLL_INTERVAL_MS` |
| 프론트 보관 상한 | 2000줄 | `useWasLogFeed` `MAX_ROWS` |
| 레벨 TTL 범위 | 1~120분 | `LevelOverrideService.MAX_TTL_MINUTES` |
| TTL 복원 스캔 주기 | 30000ms | `app.was-log.restore-scan-ms` |
| 피어 타임아웃 | connect 1000ms / read 3000ms | `app.was-log.connect-timeout-ms` / `.read-timeout-ms` |

### 파일 구조

**백엔드** — `it_backend/src/main/java/com/kdb/it/common/admin/waslog/`

| 파일 | 책임 | Task |
| --- | --- | --- |
| `dto/WasLogEntry.java` | 로그 한 줄의 불변 표현 | 1 |
| `appender/WasLogBuffer.java` | 정적 링버퍼. 적재·스냅샷만 | 1 |
| `appender/RingBufferAppender.java` | logback 이벤트 → 버퍼 | 1 |
| `config/WasLogProperties.java` | 버퍼 크기·피어·비밀값·타임아웃 | 2 |
| `config/WasLogConfig.java` | 프로퍼티 등록 + 피어용 `RestClient` 빈 | 2 |
| `dto/WasLogDto.java` | 조회 조건·응답·레벨 요청/응답 | 2 |
| `service/WasLogService.java` | 필터·커서·인스턴스 라우팅 | 2,4 |
| `service/WasLogAuditLogger.java` | 관리자 행위 감사 로그 | 6 |
| `service/LevelOverrideRegistry.java` | 오버라이드 보관 | 5 |
| `service/LevelOverrideService.java` | 레벨 적용·원복 | 5 |
| `service/LevelOverrideRestoreScheduler.java` | 만료 스캔 | 5 |
| `client/WasLogPeerClient.java` | 피어 위임 호출 | 4 |
| `controller/WasLogController.java` | `/api/admin/was-logs/**` | 3,5,6 |
| `controller/WasLogInternalController.java` | `/internal/was-logs/**` | 4 |

**프론트엔드** — `it_frontend/`

| 파일 | 책임 | Task |
| --- | --- | --- |
| `app/types/wasLog.ts` | 응답·조건 타입 | 7 |
| `app/composables/useWasLogFeed.ts` | 폴링·커서·버퍼 | 7 |
| `app/components/admin/waslog/WasLogToolbar.vue` | 필터·제어 | 8 |
| `app/components/admin/waslog/WasLogTable.vue` | 목록 | 8 |
| `app/components/admin/waslog/WasLogDetailPanel.vue` | 스택트레이스 | 8 |
| `app/components/admin/waslog/WasLogLevelDialog.vue` | 레벨 변경 입력 | 8 |
| `app/pages/admin/was-logs.vue` | 페이지 조립 | 8 |
| `i18n/messages/admin.ts` | `admin.wasLogs.*` 키 | 8 |

**DB** — `it_database/migrations/V20260820_001__SeedWasLogAdminMenu.sql` (Task 9)

---

### Task 1: 링버퍼와 logback Appender

로그 이벤트를 메모리에 담는 최하단 레이어. Spring 컨텍스트와 무관하게 동작한다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/dto/WasLogEntry.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/appender/WasLogBuffer.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/appender/RingBufferAppender.java`
- Modify: `it_backend/src/main/resources/logback-spring.xml`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/appender/WasLogBufferTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/appender/RingBufferAppenderTest.java`

**Interfaces:**
- Consumes: 없음(최하단)
- Produces:
  - `WasLogEntry(long seq, long timestamp, String level, String thread, String logger, String message, String throwable)`
  - `WasLogBuffer.shared()` → 프로세스 공용 인스턴스
  - `WasLogBuffer.resize(int capacity)` — 버퍼를 비우고 용량 재설정
  - `WasLogBuffer.add(long timestamp, String level, String thread, String logger, String message, String throwable)`
  - `WasLogBuffer.snapshot()` → `WasLogBuffer.BufferSnapshot(String epoch, long oldestSeq, long lastSeq, List<WasLogEntry> entries)` — seq 오름차순
  - `WasLogBuffer.DEFAULT_CAPACITY = 2000`

- [ ] **Step 1: 버퍼 실패 테스트 작성**

`WasLogBufferTest.java`:

```java
package com.kdb.it.common.admin.waslog.appender;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.admin.waslog.dto.WasLogEntry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WasLogBufferTest {

    private WasLogBuffer newBuffer(int capacity) {
        WasLogBuffer buffer = new WasLogBuffer(capacity);
        return buffer;
    }

    @Test
    @DisplayName("적재한 순서대로 seq가 1부터 단조 증가한다")
    void add_seq단조증가() {
        WasLogBuffer buffer = newBuffer(10);

        buffer.add(1L, "INFO", "main", "com.kdb.it.A", "첫번째", null);
        buffer.add(2L, "WARN", "main", "com.kdb.it.B", "두번째", null);

        WasLogBuffer.BufferSnapshot snapshot = buffer.snapshot();
        assertThat(snapshot.entries()).extracting(WasLogEntry::seq).containsExactly(1L, 2L);
        assertThat(snapshot.oldestSeq()).isEqualTo(1L);
        assertThat(snapshot.lastSeq()).isEqualTo(2L);
    }

    @Test
    @DisplayName("용량을 넘으면 가장 오래된 항목부터 버린다")
    void add_용량초과_오래된항목폐기() {
        WasLogBuffer buffer = newBuffer(2);

        buffer.add(1L, "INFO", "main", "com.kdb.it.A", "하나", null);
        buffer.add(2L, "INFO", "main", "com.kdb.it.A", "둘", null);
        buffer.add(3L, "INFO", "main", "com.kdb.it.A", "셋", null);

        WasLogBuffer.BufferSnapshot snapshot = buffer.snapshot();
        assertThat(snapshot.entries()).extracting(WasLogEntry::message).containsExactly("둘", "셋");
        assertThat(snapshot.oldestSeq()).isEqualTo(2L);
        assertThat(snapshot.lastSeq()).isEqualTo(3L);
    }

    @Test
    @DisplayName("비어 있으면 oldestSeq와 lastSeq가 0이다")
    void snapshot_빈버퍼() {
        WasLogBuffer.BufferSnapshot snapshot = newBuffer(5).snapshot();

        assertThat(snapshot.entries()).isEmpty();
        assertThat(snapshot.oldestSeq()).isZero();
        assertThat(snapshot.lastSeq()).isZero();
        assertThat(snapshot.epoch()).isNotBlank();
    }

    @Test
    @DisplayName("resize는 버퍼를 비우고 용량을 바꾼다")
    void resize_버퍼초기화() {
        WasLogBuffer buffer = newBuffer(2);
        buffer.add(1L, "INFO", "main", "com.kdb.it.A", "하나", null);

        buffer.resize(5);

        WasLogBuffer.BufferSnapshot snapshot = buffer.snapshot();
        assertThat(snapshot.entries()).isEmpty();
        assertThat(buffer.capacity()).isEqualTo(5);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.appender.WasLogBufferTest" --no-daemon
```

Expected: 컴파일 실패 — `WasLogBuffer`, `WasLogEntry` 없음

- [ ] **Step 3: `WasLogEntry` 작성**

```java
package com.kdb.it.common.admin.waslog.dto;

/**
 * WAS 로그 한 줄.
 *
 * @param seq 인스턴스 내 단조 증가 일련번호. 조회 커서로 쓴다
 * @param timestamp 이벤트 발생 시각(epoch millis)
 * @param level ERROR/WARN/INFO/DEBUG/TRACE
 * @param thread 로그를 남긴 스레드명
 * @param logger 로거명(FQCN)
 * @param message 포맷이 적용된 메시지. 4000자에서 절단될 수 있다
 * @param throwable 스택트레이스 문자열. 예외가 없으면 null. 8000자에서 절단될 수 있다
 */
public record WasLogEntry(
        long seq,
        long timestamp,
        String level,
        String thread,
        String logger,
        String message,
        String throwable) {}
```

- [ ] **Step 4: `WasLogBuffer` 작성**

```java
package com.kdb.it.common.admin.waslog.appender;

import com.kdb.it.common.admin.waslog.dto.WasLogEntry;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * WAS 로그 링버퍼.
 *
 * <p>logback Appender는 Spring 컨텍스트보다 먼저 기동하므로 빈으로 만들 수 없다. 프로세스 공용 인스턴스를 {@link #shared()}로 노출하고,
 * 서비스 계층은 {@link #snapshot()}만 읽는다.
 *
 * <p>모든 공개 메서드는 {@code synchronized}다. 적재는 로깅 경로에서 호출되므로 O(1) 작업만 한다.
 */
public final class WasLogBuffer {

    /** 기본 용량. 설정으로 덮어쓸 수 있다. */
    public static final int DEFAULT_CAPACITY = 2000;

    private static final WasLogBuffer SHARED = new WasLogBuffer(DEFAULT_CAPACITY);

    /**
     * 버퍼 스냅샷.
     *
     * @param epoch 버퍼 세대 식별자. 인스턴스가 재기동하면 바뀌므로 클라이언트는 커서를 버려야 한다
     * @param oldestSeq 남아 있는 가장 오래된 항목의 seq. 비었으면 0
     * @param lastSeq 마지막으로 적재된 항목의 seq. 비었으면 0
     * @param entries seq 오름차순 복사본
     */
    public record BufferSnapshot(
            String epoch, long oldestSeq, long lastSeq, List<WasLogEntry> entries) {}

    private final String epoch = UUID.randomUUID().toString();

    private WasLogEntry[] slots;
    private int writeIndex;
    private int size;
    private long seq;

    WasLogBuffer(int capacity) {
        this.slots = new WasLogEntry[Math.max(1, capacity)];
    }

    /** 프로세스 공용 인스턴스. */
    public static WasLogBuffer shared() {
        return SHARED;
    }

    /** 현재 용량. */
    public synchronized int capacity() {
        return slots.length;
    }

    /**
     * 용량을 바꾸고 버퍼를 비운다. Appender 기동 시 1회만 호출한다.
     *
     * @param capacity 1 미만이면 1로 보정
     */
    public synchronized void resize(int capacity) {
        this.slots = new WasLogEntry[Math.max(1, capacity)];
        this.writeIndex = 0;
        this.size = 0;
    }

    /** 로그 한 줄을 적재한다. 용량 초과 시 가장 오래된 항목을 덮어쓴다. */
    public synchronized void add(
            long timestamp,
            String level,
            String thread,
            String logger,
            String message,
            String throwable) {
        seq++;
        slots[writeIndex] = new WasLogEntry(seq, timestamp, level, thread, logger, message, throwable);
        writeIndex = (writeIndex + 1) % slots.length;
        if (size < slots.length) size++;
    }

    /** 현재 보관 중인 항목을 seq 오름차순 복사본으로 반환한다. */
    public synchronized BufferSnapshot snapshot() {
        List<WasLogEntry> entries = new ArrayList<>(size);
        int start = (writeIndex - size + slots.length) % slots.length;
        for (int i = 0; i < size; i++) {
            entries.add(slots[(start + i) % slots.length]);
        }
        long oldest = entries.isEmpty() ? 0L : entries.get(0).seq();
        long last = entries.isEmpty() ? 0L : entries.get(entries.size() - 1).seq();
        return new BufferSnapshot(epoch, oldest, last, entries);
    }
}
```

- [ ] **Step 5: 버퍼 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.appender.WasLogBufferTest" --no-daemon
```

Expected: PASS (4건)

- [ ] **Step 6: Appender 실패 테스트 작성**

`RingBufferAppenderTest.java`:

```java
package com.kdb.it.common.admin.waslog.appender;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import com.kdb.it.common.admin.waslog.dto.WasLogEntry;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RingBufferAppenderTest {

    private LoggingEvent event(Level level, String message, Throwable throwable) {
        LoggerContext context = new LoggerContext();
        Logger logger = context.getLogger("com.kdb.it.Sample");
        LoggingEvent e = new LoggingEvent("com.kdb.it.Sample", logger, level, message, throwable, null);
        e.setThreadName("test-thread");
        return e;
    }

    @Test
    @DisplayName("이벤트의 레벨·로거·스레드·메시지를 버퍼에 담는다")
    void append_필드매핑() {
        RingBufferAppender appender = new RingBufferAppender();
        appender.setCapacity(10);
        appender.start();

        appender.doAppend(event(Level.WARN, "경고 메시지", null));

        WasLogEntry entry = WasLogBuffer.shared().snapshot().entries().getLast();
        assertThat(entry.level()).isEqualTo("WARN");
        assertThat(entry.logger()).isEqualTo("com.kdb.it.Sample");
        assertThat(entry.thread()).isEqualTo("test-thread");
        assertThat(entry.message()).isEqualTo("경고 메시지");
        assertThat(entry.throwable()).isNull();
    }

    @Test
    @DisplayName("예외가 있으면 스택트레이스 문자열을 담는다")
    void append_예외포함() {
        RingBufferAppender appender = new RingBufferAppender();
        appender.setCapacity(10);
        appender.start();

        appender.doAppend(event(Level.ERROR, "실패", new IllegalStateException("터짐")));

        WasLogEntry entry = WasLogBuffer.shared().snapshot().entries().getLast();
        assertThat(entry.throwable()).contains("IllegalStateException").contains("터짐");
    }

    @Test
    @DisplayName("긴 메시지는 4000자에서 절단한다")
    void append_메시지절단() {
        RingBufferAppender appender = new RingBufferAppender();
        appender.setCapacity(10);
        appender.start();

        appender.doAppend(event(Level.INFO, "가".repeat(5000), null));

        WasLogEntry entry = WasLogBuffer.shared().snapshot().entries().getLast();
        assertThat(entry.message()).hasSize(RingBufferAppender.MAX_MESSAGE_CHARS);
    }
}
```

- [ ] **Step 7: 테스트 실패 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.appender.RingBufferAppenderTest" --no-daemon
```

Expected: 컴파일 실패 — `RingBufferAppender` 없음

- [ ] **Step 8: `RingBufferAppender` 작성**

```java
package com.kdb.it.common.admin.waslog.appender;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.AppenderBase;

/**
 * 로그 이벤트를 {@link WasLogBuffer}에 적재하는 logback Appender.
 *
 * <p>{@code logback-spring.xml}에서 {@code <capacity>}로 버퍼 크기를 주입한다. 메시지·스택트레이스는 각각 4000자·8000자에서 절단해
 * 버퍼 메모리 상한을 고정한다(2000건 × 12000자 ≈ 24MB).
 */
public class RingBufferAppender extends AppenderBase<ILoggingEvent> {

    /** 메시지 보관 상한(문자 수). */
    public static final int MAX_MESSAGE_CHARS = 4000;

    /** 스택트레이스 보관 상한(문자 수). */
    public static final int MAX_THROWABLE_CHARS = 8000;

    private int capacity = WasLogBuffer.DEFAULT_CAPACITY;

    /** logback XML의 {@code <capacity>} 주입용 setter. */
    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    @Override
    public void start() {
        WasLogBuffer.shared().resize(capacity);
        super.start();
    }

    @Override
    protected void append(ILoggingEvent event) {
        WasLogBuffer.shared()
                .add(
                        event.getTimeStamp(),
                        event.getLevel().toString(),
                        event.getThreadName(),
                        event.getLoggerName(),
                        truncate(event.getFormattedMessage(), MAX_MESSAGE_CHARS),
                        throwableText(event));
    }

    private String throwableText(ILoggingEvent event) {
        IThrowableProxy proxy = event.getThrowableProxy();
        if (proxy == null) return null;
        return truncate(ThrowableProxyUtil.asString(proxy), MAX_THROWABLE_CHARS);
    }

    private String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
```

- [ ] **Step 9: Appender 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.appender.*" --no-daemon
```

Expected: PASS (7건)

- [ ] **Step 10: logback에 Appender 배선**

`logback-spring.xml`의 FILE appender 정의 **뒤**, `<root>` **앞**에 추가:

```xml
    <!-- 관리자 화면 조회용 인메모리 링버퍼 (재기동 시 소실, 파일 로그와 별개) -->
    <appender name="RINGBUFFER" class="com.kdb.it.common.admin.waslog.appender.RingBufferAppender">
        <capacity>2000</capacity>
    </appender>
```

그리고 `<root>` 안에 참조를 추가:

```xml
    <root level="INFO">
        <appender-ref ref="CONSOLE"/>
        <appender-ref ref="FILE"/>
        <appender-ref ref="RINGBUFFER"/>
    </root>
```

- [ ] **Step 11: 포맷 적용 후 커밋**

```bash
cd C:/it/it_backend && ./gradlew spotlessApply --no-daemon
```

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/common/admin/waslog src/test/java/com/kdb/it/common/admin/waslog src/main/resources/logback-spring.xml && git diff --cached --stat && git commit -m "feat: WAS 로그 인메모리 링버퍼와 logback Appender 추가"
```

---

### Task 2: 설정 프로퍼티와 로컬 조회 서비스

버퍼 스냅샷에 필터와 커서를 적용해 응답 DTO를 만든다. 아직 피어 라우팅은 없다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/config/WasLogProperties.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/config/WasLogConfig.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/dto/WasLogDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/service/WasLogService.java`
- Modify: `it_backend/src/main/resources/application.properties`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/service/WasLogServiceTest.java`

**Interfaces:**
- Consumes: `WasLogBuffer.shared()`, `WasLogEntry`(Task 1)
- Produces:
  - `WasLogProperties(int bufferCapacity, Map<String,String> peers, String internalSecret, int connectTimeoutMs, int readTimeoutMs)`
  - `WasLogDto.Query(long afterSeq, int limit, Set<String> levels, String logger, String keyword)`
  - `WasLogDto.Snapshot(String instanceId, String bufferEpoch, List<WasLogEntry> entries, long lastSeq, boolean dropped, List<WasLogDto.LevelOverride> levelOverrides, String peerError)`
  - `WasLogDto.LevelOverride(String logger, String level, String previousLevel, LocalDateTime expiresAt)`
  - `WasLogDto.LevelRequest(String instanceId, String logger, String level, int ttlMinutes)`
  - `WasLogDto.InstanceInfo(String id, boolean self, boolean reachable)`
  - `WasLogService.localSnapshot(WasLogDto.Query query)` → `WasLogDto.Snapshot`
  - `WasLogService.MAX_LIMIT = 200`, `WasLogService.ALLOWED_LEVELS`

- [ ] **Step 1: 서비스 실패 테스트 작성**

`WasLogServiceTest.java`:

```java
package com.kdb.it.common.admin.waslog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kdb.it.common.admin.waslog.appender.WasLogBuffer;
import com.kdb.it.common.admin.waslog.config.WasLogProperties;
import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import com.kdb.it.common.admin.waslog.dto.WasLogEntry;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WasLogServiceTest {

    private WasLogService service;

    /**
     * setUp이 넣은 첫 항목의 seq.
     *
     * <p>{@code WasLogBuffer.shared()}는 프로세스 공용 싱글턴이고 {@code resize()}는 항목만 비울 뿐 seq 카운터는 되돌리지
     * 않는다(의도된 동작 — seq를 되돌리면 같은 {@code bufferEpoch} 안에서 커서가 뒤로 가 클라이언트가 신규 로그를 건너뛴다). 그래서 테스트는 절대
     * seq 값을 박지 않고 이 기준값에서 상대적으로 단언한다.
     */
    private long base;

    @BeforeEach
    void setUp() {
        WasLogBuffer.shared().resize(10);
        WasLogProperties properties =
                new WasLogProperties(10, Map.of("SVR1", "http://svr1:28080"), "", 1000, 3000);
        service = new WasLogService(properties, "SVR1", null, null);

        WasLogBuffer.shared().add(1L, "INFO", "main", "com.kdb.it.A", "정상 처리", null);
        WasLogBuffer.shared().add(2L, "ERROR", "main", "com.kdb.it.B", "저장 실패", "stack");
        WasLogBuffer.shared().add(3L, "WARN", "http-1", "org.hibernate.C", "느린 쿼리", null);

        base = WasLogBuffer.shared().snapshot().oldestSeq();
    }

    @Test
    @DisplayName("afterSeq 이후 항목만 돌려준다")
    void localSnapshot_커서적용() {
        WasLogDto.Snapshot snapshot =
                service.localSnapshot(new WasLogDto.Query(base + 1, 200, Set.of(), null, null));

        assertThat(snapshot.entries()).extracting(WasLogEntry::seq).containsExactly(base + 2);
        assertThat(snapshot.lastSeq()).isEqualTo(base + 2);
        assertThat(snapshot.dropped()).isFalse();
        assertThat(snapshot.instanceId()).isEqualTo("SVR1");
    }

    @Test
    @DisplayName("레벨 필터는 지정한 레벨만 통과시킨다")
    void localSnapshot_레벨필터() {
        WasLogDto.Snapshot snapshot =
                service.localSnapshot(new WasLogDto.Query(0L, 200, Set.of("ERROR", "WARN"), null, null));

        assertThat(snapshot.entries()).extracting(WasLogEntry::level).containsExactly("ERROR", "WARN");
    }

    @Test
    @DisplayName("로거 필터는 접두사 일치로 좁힌다")
    void localSnapshot_로거필터() {
        WasLogDto.Snapshot snapshot =
                service.localSnapshot(new WasLogDto.Query(0L, 200, Set.of(), "com.kdb.it", null));

        assertThat(snapshot.entries()).extracting(WasLogEntry::logger)
                .containsExactly("com.kdb.it.A", "com.kdb.it.B");
    }

    @Test
    @DisplayName("키워드는 메시지·로거에 대소문자 무시 부분일치로 적용한다")
    void localSnapshot_키워드필터() {
        WasLogDto.Snapshot snapshot =
                service.localSnapshot(new WasLogDto.Query(0L, 200, Set.of(), null, "실패"));

        assertThat(snapshot.entries()).extracting(WasLogEntry::message).containsExactly("저장 실패");
    }

    @Test
    @DisplayName("커서 이후 항목이 버퍼에서 밀려났으면 dropped를 세운다")
    void localSnapshot_밀림감지() {
        WasLogBuffer.shared().resize(2);
        WasLogBuffer.shared().add(1L, "INFO", "main", "com.kdb.it.A", "하나", null);
        WasLogBuffer.shared().add(2L, "INFO", "main", "com.kdb.it.A", "둘", null);
        WasLogBuffer.shared().add(3L, "INFO", "main", "com.kdb.it.A", "셋", null);

        // 남은 것은 '둘'·'셋'이고 '하나'는 밀려났다. 커서가 '하나'보다 앞이어야 실제로 건너뛴 항목이 생긴다.
        long missedSeq = WasLogBuffer.shared().snapshot().oldestSeq() - 2;

        WasLogDto.Snapshot snapshot =
                service.localSnapshot(new WasLogDto.Query(missedSeq, 200, Set.of(), null, null));

        assertThat(snapshot.dropped()).isTrue();
    }

    @Test
    @DisplayName("limit은 200을 넘지 못하고 최신 항목을 남긴다")
    void localSnapshot_limit상한() {
        WasLogDto.Snapshot snapshot =
                service.localSnapshot(new WasLogDto.Query(0L, 2, Set.of(), null, null));

        assertThat(snapshot.entries())
                .extracting(WasLogEntry::seq)
                .containsExactly(base + 1, base + 2);
        assertThat(snapshot.lastSeq()).isEqualTo(base + 2);
    }

    @Test
    @DisplayName("조회 상한 때문에 오래된 항목을 버리면 dropped를 세운다")
    void localSnapshot_상한초과_dropped() {
        WasLogDto.Snapshot snapshot =
                service.localSnapshot(new WasLogDto.Query(0L, 2, Set.of(), null, null));

        assertThat(snapshot.dropped()).isTrue();
    }

    @Test
    @DisplayName("상한에 걸리지 않으면 dropped를 세우지 않는다")
    void localSnapshot_상한미달_dropped없음() {
        WasLogDto.Snapshot snapshot =
                service.localSnapshot(new WasLogDto.Query(0L, 200, Set.of(), null, null));

        assertThat(snapshot.entries()).hasSize(3);
        assertThat(snapshot.dropped()).isFalse();
    }

    @Test
    @DisplayName("허용되지 않은 레벨이면 IllegalArgumentException을 던진다")
    void localSnapshot_잘못된레벨() {
        WasLogDto.Query query = new WasLogDto.Query(0L, 200, Set.of("FATAL"), null, null);

        assertThatThrownBy(() -> service.localSnapshot(query))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("FATAL");
    }

    @Test
    @DisplayName("인스턴스 목록은 자기 자신을 self로 표시한다")
    void instances_self표시() {
        List<WasLogDto.InstanceInfo> instances = service.instances();

        assertThat(instances).extracting(WasLogDto.InstanceInfo::id).containsExactly("SVR1");
        assertThat(instances.getFirst().self()).isTrue();
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.service.WasLogServiceTest" --no-daemon
```

Expected: 컴파일 실패 — `WasLogService`, `WasLogProperties`, `WasLogDto` 없음

- [ ] **Step 3: `WasLogProperties` 작성**

```java
package com.kdb.it.common.admin.waslog.config;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * WAS 로그 뷰어 설정 — 접두사 {@code app.was-log}.
 *
 * @param bufferCapacity 링버퍼 용량. logback XML의 {@code <capacity>}와 같은 값을 유지한다
 * @param peers 인스턴스ID → 내부 호출용 base URL. 자기 자신을 포함해도 된다
 * @param internalSecret 피어 내부 엔드포인트 공유 비밀값. 비어 있으면 내부 컨트롤러가 등록되지 않는다
 * @param connectTimeoutMs 피어 연결 타임아웃(ms)
 * @param readTimeoutMs 피어 읽기 타임아웃(ms)
 */
@ConfigurationProperties(prefix = "app.was-log")
public record WasLogProperties(
        int bufferCapacity,
        Map<String, String> peers,
        String internalSecret,
        int connectTimeoutMs,
        int readTimeoutMs) {

    /** 누락 기본값 보정. */
    public WasLogProperties {
        if (bufferCapacity <= 0) bufferCapacity = 2000;
        if (peers == null) peers = Map.of();
        if (internalSecret == null) internalSecret = "";
        if (connectTimeoutMs <= 0) connectTimeoutMs = 1000;
        if (readTimeoutMs <= 0) readTimeoutMs = 3000;
    }
}
```

- [ ] **Step 4: `WasLogDto` 작성**

```java
package com.kdb.it.common.admin.waslog.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/** WAS 로그 뷰어 요청·응답 계약. */
public final class WasLogDto {

    private WasLogDto() {}

    /**
     * 조회 조건.
     *
     * @param afterSeq 이 seq 초과분만 조회. 0이면 처음부터
     * @param limit 조회 상한. 0 이하면 200, 200 초과면 200으로 보정
     * @param levels 허용 레벨 집합. 비어 있으면 필터 없음
     * @param logger 로거명 접두사. null/공백이면 필터 없음
     * @param keyword 메시지·로거 부분일치. null/공백이면 필터 없음
     */
    public record Query(long afterSeq, int limit, Set<String> levels, String logger, String keyword) {}

    /**
     * 조회 응답.
     *
     * @param instanceId 실제로 응답한 인스턴스ID
     * @param bufferEpoch 버퍼 세대 식별자. 바뀌면 클라이언트는 커서를 버린다
     * @param entries seq 오름차순 로그
     * @param lastSeq 다음 요청에 쓸 커서
     * @param dropped 커서 이후 일부 로그를 건너뛰었으면 true. 버퍼에서 밀려났거나 조회 상한에 걸려 오래된 쪽을 버린 경우
     * @param levelOverrides 해당 인스턴스에 적용 중인 런타임 레벨 변경
     * @param peerError 피어 위임 실패 사유. 성공이면 null
     */
    public record Snapshot(
            String instanceId,
            String bufferEpoch,
            List<WasLogEntry> entries,
            long lastSeq,
            boolean dropped,
            List<LevelOverride> levelOverrides,
            String peerError) {}

    /**
     * 런타임 레벨 변경 현황.
     *
     * @param logger 대상 로거명
     * @param level 적용된 레벨
     * @param previousLevel 변경 직전 레벨. 설정값이 없었으면 null
     * @param expiresAt 자동 원복 예정 시각
     */
    public record LevelOverride(
            String logger, String level, String previousLevel, LocalDateTime expiresAt) {}

    /**
     * 런타임 레벨 변경 요청.
     *
     * @param instanceId 대상 인스턴스ID
     * @param logger 화이트리스트 접두사에 속하는 로거명
     * @param level ERROR/WARN/INFO/DEBUG/TRACE
     * @param ttlMinutes 자동 원복까지 분. 1~120
     */
    public record LevelRequest(String instanceId, String logger, String level, int ttlMinutes) {}

    /**
     * 인스턴스 정보.
     *
     * @param id 인스턴스ID
     * @param self 이 응답을 만든 인스턴스인지
     * @param reachable 피어 URL이 설정되어 호출 가능한지
     */
    public record InstanceInfo(String id, boolean self, boolean reachable) {}
}
```

- [ ] **Step 5: `WasLogService` 작성 (로컬 조회만)**

Task 4에서 라우팅을 붙일 자리를 위해 생성자에 `WasLogPeerClient`·`LevelOverrideRegistry` 자리를 남기되, 이 태스크에서는 `null`을 허용한다.

```java
package com.kdb.it.common.admin.waslog.service;

import com.kdb.it.common.admin.waslog.appender.WasLogBuffer;
import com.kdb.it.common.admin.waslog.client.WasLogPeerClient;
import com.kdb.it.common.admin.waslog.config.WasLogProperties;
import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import com.kdb.it.common.admin.waslog.dto.WasLogEntry;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * WAS 로그 조회 서비스.
 *
 * <p>로컬 링버퍼를 필터링해 스냅샷을 만든다. 대상 인스턴스가 자신이 아니면 {@link WasLogPeerClient}로 위임한다(Task 4).
 */
@Service
public class WasLogService {

    /** 조회 상한. 기본값이자 최대값. */
    public static final int MAX_LIMIT = 200;

    /** 허용 레벨. */
    public static final Set<String> ALLOWED_LEVELS =
            Set.of("ERROR", "WARN", "INFO", "DEBUG", "TRACE");

    private final WasLogProperties properties;
    private final String selfInstanceId;
    private final WasLogPeerClient peerClient;
    private final LevelOverrideRegistry overrideRegistry;

    public WasLogService(
            WasLogProperties properties,
            @Value("${app.server.instance-id:SVR1}") String selfInstanceId,
            WasLogPeerClient peerClient,
            LevelOverrideRegistry overrideRegistry) {
        this.properties = properties;
        this.selfInstanceId = selfInstanceId;
        this.peerClient = peerClient;
        this.overrideRegistry = overrideRegistry;
    }

    /** 이 인스턴스의 ID. */
    public String selfInstanceId() {
        return selfInstanceId;
    }

    /**
     * 로컬 링버퍼 스냅샷을 조건에 맞춰 반환한다.
     *
     * @throws IllegalArgumentException 허용되지 않은 레벨이 포함된 경우
     */
    public WasLogDto.Snapshot localSnapshot(WasLogDto.Query query) {
        Set<String> levels = query.levels() == null ? Set.of() : query.levels();
        for (String level : levels) {
            if (!ALLOWED_LEVELS.contains(level)) {
                throw new IllegalArgumentException("허용되지 않은 로그 레벨: " + level);
            }
        }

        // 상한은 버퍼 용량이다. 폴링 API는 컨트롤러가 MAX_LIMIT(200)으로 따로 조이고, 다운로드는
        // 버퍼 전체를 내보내야 하므로(설계 §5.6) 여기서 200으로 막으면 파일이 조용히 잘린다.
        int cap = Math.max(1, properties.bufferCapacity());
        int limit = query.limit() <= 0 ? Math.min(MAX_LIMIT, cap) : Math.min(query.limit(), cap);
        WasLogBuffer.BufferSnapshot buffer = WasLogBuffer.shared().snapshot();

        List<WasLogEntry> filtered = new ArrayList<>();
        for (WasLogEntry entry : buffer.entries()) {
            if (entry.seq() <= query.afterSeq()) continue;
            if (!levels.isEmpty() && !levels.contains(entry.level())) continue;
            if (!matchesLogger(entry, query.logger())) continue;
            if (!matchesKeyword(entry, query.keyword())) continue;
            filtered.add(entry);
        }
        boolean truncated = filtered.size() > limit;
        if (truncated) {
            filtered = new ArrayList<>(filtered.subList(filtered.size() - limit, filtered.size()));
        }

        // 커서 이후 항목을 건너뛰는 경로는 둘이다 — ① 버퍼에서 밀려남 ② 조회 상한을 넘겨 최신분만 남김.
        // ②는 오래된 쪽을 버리므로 커서를 낮춰도 복구되지 않는다. 조용히 넘기면 클라이언트는 연속된
        // 로그를 본다고 착각하므로, 두 경로 모두 dropped로 알린다.
        boolean evicted = query.afterSeq() > 0 && buffer.oldestSeq() > query.afterSeq() + 1;
        boolean dropped = evicted || truncated;
        long lastSeq = Math.max(query.afterSeq(), buffer.lastSeq());

        return new WasLogDto.Snapshot(
                selfInstanceId,
                buffer.epoch(),
                filtered,
                lastSeq,
                dropped,
                overrideRegistry == null ? List.of() : overrideRegistry.list(),
                null);
    }

    /** 다운로드가 버퍼 전체를 받기 위해 쓰는 상한. */
    public int exportLimit() {
        return Math.max(1, properties.bufferCapacity());
    }

    /** 설정에 등록된 인스턴스 목록. */
    public List<WasLogDto.InstanceInfo> instances() {
        List<WasLogDto.InstanceInfo> result = new ArrayList<>();
        for (var entry : properties.peers().entrySet()) {
            String id = entry.getKey();
            boolean self = id.equals(selfInstanceId);
            boolean reachable = self || (entry.getValue() != null && !entry.getValue().isBlank());
            result.add(new WasLogDto.InstanceInfo(id, self, reachable));
        }
        if (result.stream().noneMatch(WasLogDto.InstanceInfo::self)) {
            result.add(new WasLogDto.InstanceInfo(selfInstanceId, true, true));
        }
        result.sort((a, b) -> a.id().compareTo(b.id()));
        return result;
    }

    private boolean matchesLogger(WasLogEntry entry, String prefix) {
        if (prefix == null || prefix.isBlank()) return true;
        return entry.logger() != null && entry.logger().startsWith(prefix);
    }

    private boolean matchesKeyword(WasLogEntry entry, String keyword) {
        if (keyword == null || keyword.isBlank()) return true;
        String needle = keyword.toLowerCase(Locale.ROOT);
        String message = entry.message() == null ? "" : entry.message().toLowerCase(Locale.ROOT);
        String logger = entry.logger() == null ? "" : entry.logger().toLowerCase(Locale.ROOT);
        return message.contains(needle) || logger.contains(needle);
    }
}
```

- [ ] **Step 6: `LevelOverrideRegistry` 최소 골격 작성**

Task 5에서 채우지만 컴파일과 `list()` 호출을 위해 지금 만든다.

```java
package com.kdb.it.common.admin.waslog.service;

import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * 이 인스턴스에 적용 중인 런타임 로그레벨 변경 보관소.
 *
 * <p>프로세스 메모리에만 둔다. 재기동하면 설정 파일 레벨로 자연 복원되므로 영속화하지 않는다.
 */
@Component
public class LevelOverrideRegistry {

    private final Map<String, WasLogDto.LevelOverride> overrides = new ConcurrentHashMap<>();

    /** 로거별 오버라이드를 등록하거나 갱신한다. */
    public void put(WasLogDto.LevelOverride override) {
        overrides.put(override.logger(), override);
    }

    /** 로거의 현재 오버라이드. 없으면 null. */
    public WasLogDto.LevelOverride find(String logger) {
        return overrides.get(logger);
    }

    /** 로거명 오름차순 목록. */
    public List<WasLogDto.LevelOverride> list() {
        List<WasLogDto.LevelOverride> result = new ArrayList<>(overrides.values());
        result.sort((a, b) -> a.logger().compareTo(b.logger()));
        return result;
    }

    /**
     * 만료된 항목을 꺼내며 제거한다.
     *
     * <p>제거는 값까지 일치할 때만 한다. 스캔 도중 같은 로거에 새 오버라이드가 들어오면 그것까지 지워버려,
     * 스케줄러가 새 설정을 되돌리고 화면에는 살아 있는 것처럼 보이는 어긋남이 생기기 때문이다.
     */
    public List<WasLogDto.LevelOverride> removeExpired(LocalDateTime now) {
        List<WasLogDto.LevelOverride> expired = new ArrayList<>();
        for (WasLogDto.LevelOverride override : list()) {
            if (!override.expiresAt().isAfter(now) && overrides.remove(override.logger(), override)) {
                expired.add(override);
            }
        }
        return expired;
    }
}
```

- [ ] **Step 7: `WasLogPeerClient` 최소 골격 작성**

Task 4에서 구현을 채운다. 지금은 생성자 주입 타입만 존재하면 된다.

```java
package com.kdb.it.common.admin.waslog.client;

/** 다른 WAS 인스턴스의 내부 엔드포인트를 호출하는 클라이언트. 구현은 Task 4. */
public interface WasLogPeerClient {}
```

- [ ] **Step 8: `WasLogConfig` 작성**

```java
package com.kdb.it.common.admin.waslog.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** WAS 로그 뷰어 설정 등록. */
@Configuration
@EnableConfigurationProperties(WasLogProperties.class)
public class WasLogConfig {}
```

- [ ] **Step 9: `application.properties`에 기본 설정 추가**

파일 끝에 추가:

```properties
# WAS 로그 뷰어 (/admin/was-logs)
# 링버퍼 용량 — logback-spring.xml의 RINGBUFFER <capacity>와 같은 값을 유지한다
app.was-log.buffer-capacity=2000
# 인스턴스ID → 내부 호출 base URL. 서버마다 같은 목록을 갖는다
app.was-log.peers.SVR1=${WAS_LOG_PEER_SVR1:}
app.was-log.peers.SVR2=${WAS_LOG_PEER_SVR2:}
# 피어 내부 엔드포인트 공유 비밀값. 비어 있으면 내부 컨트롤러를 등록하지 않는다
# 값에 작은따옴표(')를 넣지 않는다 — 이 값은 @ConditionalOnExpression의 SpEL 리터럴에 치환되므로
# 따옴표가 들어가면 파싱이 깨져 기동이 실패한다(실패는 닫히는 방향이라 안전하지만 원인 파악이 어렵다).
app.was-log.internal-secret=${WAS_LOG_INTERNAL_SECRET:}
app.was-log.connect-timeout-ms=1000
app.was-log.read-timeout-ms=3000
# 런타임 레벨 오버라이드 만료 스캔 주기(ms)
app.was-log.restore-scan-ms=30000
```

- [ ] **Step 10: 서비스 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.service.WasLogServiceTest" --no-daemon
```

Expected: PASS (10건)

- [ ] **Step 11: 포맷 적용 후 커밋**

```bash
cd C:/it/it_backend && ./gradlew spotlessApply --no-daemon
```

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/common/admin/waslog src/test/java/com/kdb/it/common/admin/waslog src/main/resources/application.properties && git diff --cached --stat && git commit -m "feat: WAS 로그 조회 서비스와 설정 프로퍼티 추가"
```

---

### Task 3: 관리자 조회 API와 보안 경계

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/controller/WasLogController.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/controller/WasLogControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/WasLogSecurityBoundaryTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/controller/WasLogControllerAuthorizationTest.java`

**Interfaces:**
- Consumes: `WasLogService.localSnapshot`, `WasLogService.instances`, `WasLogDto.*`(Task 2)
- Produces:
  - `GET /api/admin/was-logs` → `WasLogDto.Snapshot`
  - `GET /api/admin/was-logs/instances` → `List<WasLogDto.InstanceInfo>`
  - `WasLogController.snapshot(String instanceId, Long afterSeq, int limit, String levels, String logger, String q)`

- [ ] **Step 1: 컨트롤러 실패 테스트 작성**

`WasLogControllerTest.java`:

```java
package com.kdb.it.common.admin.waslog.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import com.kdb.it.common.admin.waslog.dto.WasLogEntry;
import com.kdb.it.common.admin.waslog.service.WasLogService;
import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.config.TestSecurityConfig;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

// 운영 SecurityConfig는 CSRF를 끈다. 슬라이스 기본값(CSRF 켜짐)을 그대로 쓰면 POST 테스트가
// .with(csrf())를 붙여야 통과하는데, 그러면 운영에 없는 설정에서만 초록인 테스트가 된다.
@WebMvcTest(WasLogController.class)
@Import(TestSecurityConfig.class)
@WithMockUser(roles = "ADMIN")
class WasLogControllerTest {

    @Autowired private MockMvc mockMvc;

    // JwtAuthenticationFilter는 @Component Filter라 @WebMvcTest가 자동 포함한다. 그 생성자 의존을 채운다.
    @MockitoBean private JwtUtil jwtUtil;

    @MockitoBean private WasLogService service;

    @Test
    @DisplayName("조회는 스냅샷을 그대로 직렬화한다")
    void snapshot_정상응답() throws Exception {
        WasLogEntry entry =
                new WasLogEntry(7L, 1000L, "ERROR", "http-1", "com.kdb.it.A", "실패", "stack");
        given(service.snapshot(any(), any()))
                .willReturn(
                        new WasLogDto.Snapshot(
                                "SVR1", "epoch-1", List.of(entry), 7L, false, List.of(), null));

        mockMvc.perform(get("/api/admin/was-logs").param("afterSeq", "6"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instanceId").value("SVR1"))
                .andExpect(jsonPath("$.bufferEpoch").value("epoch-1"))
                .andExpect(jsonPath("$.lastSeq").value(7))
                .andExpect(jsonPath("$.entries[0].seq").value(7))
                .andExpect(jsonPath("$.entries[0].throwable").value("stack"));
    }

    @Test
    @DisplayName("허용되지 않은 레벨이면 400을 준다")
    void snapshot_잘못된레벨_400() throws Exception {
        given(service.snapshot(any(), any()))
                .willThrow(new IllegalArgumentException("허용되지 않은 로그 레벨: FATAL"));

        mockMvc.perform(get("/api/admin/was-logs").param("levels", "FATAL"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("인스턴스 목록을 반환한다")
    void instances_정상응답() throws Exception {
        given(service.instances())
                .willReturn(
                        List.of(
                                new WasLogDto.InstanceInfo("SVR1", true, true),
                                new WasLogDto.InstanceInfo("SVR2", false, true)));

        mockMvc.perform(get("/api/admin/was-logs/instances"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("SVR1"))
                .andExpect(jsonPath("$[0].self").value(true))
                .andExpect(jsonPath("$[1].id").value("SVR2"));
    }

    @Test
    @DisplayName("질의 파라미터를 파싱해 서비스에 그대로 넘긴다")
    void snapshot_파라미터전달() throws Exception {
        given(service.snapshot(any(), any()))
                .willReturn(
                        new WasLogDto.Snapshot("SVR2", "e1", List.of(), 9L, false, List.of(), null));

        mockMvc.perform(
                        get("/api/admin/was-logs")
                                .param("instanceId", "SVR2")
                                .param("afterSeq", "9")
                                .param("limit", "50")
                                .param("levels", " ERROR , WARN ,")
                                .param("logger", "com.kdb.it")
                                .param("q", "실패"))
                .andExpect(status().isOk());

        ArgumentCaptor<String> instanceCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<WasLogDto.Query> queryCaptor = ArgumentCaptor.forClass(WasLogDto.Query.class);
        verify(service).snapshot(instanceCaptor.capture(), queryCaptor.capture());

        assertThat(instanceCaptor.getValue()).isEqualTo("SVR2");
        WasLogDto.Query query = queryCaptor.getValue();
        assertThat(query.afterSeq()).isEqualTo(9L);
        assertThat(query.limit()).isEqualTo(50);
        assertThat(query.levels()).containsExactlyInAnyOrder("ERROR", "WARN");
        assertThat(query.logger()).isEqualTo("com.kdb.it");
        assertThat(query.keyword()).isEqualTo("실패");
    }
}
```

`WasLogControllerTest.java` 상단에 import를 추가한다: `static org.assertj.core.api.Assertions.assertThat`,
`static org.mockito.Mockito.verify`, `org.mockito.ArgumentCaptor`.

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.controller.WasLogControllerTest" --no-daemon
```

Expected: 컴파일 실패 — `WasLogController`, `WasLogService.snapshot(...)` 없음

- [ ] **Step 3: `WasLogService.snapshot` 라우팅 진입점 추가**

`WasLogService`에 아래 메서드를 추가한다. 이 태스크에서는 로컬만 처리하고, 다른 인스턴스는 Task 4에서 채운다.

```java
    /**
     * 대상 인스턴스의 스냅샷을 반환한다.
     *
     * @param instanceId null이거나 자기 자신이면 로컬 버퍼를 읽는다
     * @throws IllegalArgumentException 설정에 없는 인스턴스ID인 경우
     */
    public WasLogDto.Snapshot snapshot(String instanceId, WasLogDto.Query query) {
        if (instanceId == null || instanceId.isBlank() || instanceId.equals(selfInstanceId)) {
            return localSnapshot(query);
        }
        // 다른 인스턴스 조회는 Task 4에서 피어 위임으로 구현한다. 그때까지는 알 수 없는 인스턴스와 같이 다룬다.
        throw new IllegalArgumentException("알 수 없는 인스턴스: " + instanceId);
    }
```

`properties.peers()` 조회는 Task 4에서 위임을 붙일 때 함께 넣는다. 지금 넣으면 결과를 쓰지 않는 죽은 코드가 된다.

- [ ] **Step 4: `WasLogController` 작성**

```java
package com.kdb.it.common.admin.waslog.controller;

import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import com.kdb.it.common.admin.waslog.service.WasLogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 실시간 WAS 로그 조회 API.
 *
 * <p>관리자(ROLE_ADMIN) 전용. 응답은 인메모리 링버퍼 스냅샷이며 재기동 이전 로그는 포함하지 않는다.
 */
@RestController
@RequestMapping("/api/admin/was-logs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin/WAS Logs", description = "실시간 WAS 로그")
public class WasLogController {

    private final WasLogService service;

    /**
     * 대상 인스턴스의 로그 스냅샷을 반환한다.
     *
     * @param instanceId 대상 인스턴스ID. 생략하면 요청을 받은 인스턴스
     * @param afterSeq 이 seq 초과분만 조회. 생략하면 0
     * @param limit 조회 상한. 생략하면 200이며 서비스에서 최대 200으로 제한
     * @param levels 쉼표로 구분된 레벨 목록
     * @param logger 로거명 접두사
     * @param q 메시지·로거 부분일치 키워드
     */
    @GetMapping
    @Operation(summary = "WAS 로그 조회", description = "seq 커서 기반 증분 조회입니다.")
    public WasLogDto.Snapshot snapshot(
            @RequestParam(name = "instanceId", required = false) String instanceId,
            @RequestParam(name = "afterSeq", defaultValue = "0") long afterSeq,
            @RequestParam(name = "limit", defaultValue = "200") int limit,
            @RequestParam(name = "levels", required = false) String levels,
            @RequestParam(name = "logger", required = false) String logger,
            @RequestParam(name = "q", required = false) String q) {
        return service.snapshot(
                instanceId, new WasLogDto.Query(afterSeq, limit, splitLevels(levels), logger, q));
    }

    /** 조회 가능한 인스턴스 목록. */
    @GetMapping("/instances")
    @Operation(summary = "인스턴스 목록", description = "설정에 등록된 WAS 인스턴스를 반환합니다.")
    public List<WasLogDto.InstanceInfo> instances() {
        return service.instances();
    }

    /**
     * 피어 위임 실패를 502로 구분해 돌려준다.
     *
     * <p>기본 처리(400)로 두면 관리자가 "피어가 죽었다"와 "로거명을 잘못 적었다"를 구분할 수 없다. 레벨 변경은
     * 실패를 삼키면 "적용됐다"로 읽히는 경로라 상태 코드로도 갈라준다.
     */
    @ExceptionHandler(WasLogPeerException.class)
    public ResponseEntity<String> handlePeerFailure(WasLogPeerException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(e.getMessage());
    }

    private Set<String> splitLevels(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }
}
```

- [ ] **Step 5: 400 변환 확인**

`IllegalArgumentException` → 400 매핑이 이미 있는지 확인한다.

```bash
cd C:/it/it_backend && grep -rn "IllegalArgumentException" src/main/java/com/kdb/it/common/exception/ | head -5
```

전역 핸들러가 400으로 매핑하지 않으면 `WasLogController`에 `@ExceptionHandler(IllegalArgumentException.class)`를 추가해 `ResponseEntity.badRequest().build()`를 반환한다. 기존 핸들러가 있으면 이 단계는 건너뛴다.

- [ ] **Step 6: 컨트롤러 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.controller.WasLogControllerTest" --no-daemon
```

Expected: PASS (4건)

- [ ] **Step 7: 보안 경계 테스트 작성**

`WasLogSecurityBoundaryTest.java`:

```java
package com.kdb.it.common.admin.waslog;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kdb.it.common.admin.waslog.config.WasLogProperties;
import com.kdb.it.common.admin.waslog.controller.WasLogController;
import com.kdb.it.common.admin.waslog.controller.WasLogInternalController;
import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import com.kdb.it.common.admin.waslog.service.WasLogService;
import com.kdb.it.common.system.security.JwtAuthenticationFilter;
import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.common.util.CookieUtil;
import com.kdb.it.config.JacksonConfig;
import com.kdb.it.config.SecurityConfig;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * WAS 로그 API의 인증·인가 경계 검증. 실제 {@link SecurityConfig}를 그대로 적용한다.
 *
 * <p>내부 컨트롤러도 함께 올려 {@code SecurityConfig}의 {@code /internal/was-logs/**} permitAll 매처가
 * 실제로 존재하는지 검증한다 — 그 4줄을 지워도 나머지 테스트는 전부 통과하므로 여기서만 잡을 수 있다.
 */
@WebMvcTest({WasLogController.class, WasLogInternalController.class})
@EnableConfigurationProperties(WasLogProperties.class)
@TestPropertySource(properties = "app.was-log.internal-secret=s3cret")
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, CookieUtil.class, JacksonConfig.class})
class WasLogSecurityBoundaryTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private WasLogService service;

    @Test
    @DisplayName("미인증 요청은 401")
    void 미인증_401() throws Exception {
        mockMvc.perform(get("/api/admin/was-logs")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("일반 사용자 요청은 403")
    @WithMockUser(roles = "USER")
    void 일반사용자_403() throws Exception {
        mockMvc.perform(get("/api/admin/was-logs")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("피어 내부 경로는 미인증이어도 올바른 토큰이면 통과한다")
    void 내부경로_미인증_토큰일치_200() throws Exception {
        given(service.localSnapshot(any()))
                .willReturn(
                        new WasLogDto.Snapshot("SVR1", "e1", List.of(), 0L, false, List.of(), null));

        mockMvc.perform(
                        post("/internal/was-logs/snapshot")
                                .header("X-Internal-Token", "s3cret")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {"afterSeq":0,"limit":200,"levels":[],"logger":null,"keyword":null}
                                        """))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("피어 내부 경로도 토큰이 틀리면 401")
    void 내부경로_토큰불일치_401() throws Exception {
        mockMvc.perform(
                        post("/internal/was-logs/snapshot")
                                .header("X-Internal-Token", "wrong")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {"afterSeq":0,"limit":200,"levels":[],"logger":null,"keyword":null}
                                        """))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 8: 보안 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.WasLogSecurityBoundaryTest" --no-daemon
```

Expected: PASS (4건). 401/403 기대값이 다르면 기존 `AdminSecurityBoundaryTest`의 실제 응답 코드에 맞춘다.

내부 경로 테스트 두 건은 Task 4에서 `WasLogInternalController`와 `SecurityConfig` 매처가 들어온 뒤에야
통과한다. Task 3 시점에는 이 두 건을 넣지 않고, Task 4의 Step 10에서 함께 추가한다.

- [ ] **Step 9: `@PreAuthorize` 격리 검증 테스트 작성**

Step 7의 `WasLogSecurityBoundaryTest`는 실제 `SecurityConfig`를 올리므로 `/api/admin/**` URL 규칙만으로도
통과한다 — 컨트롤러에서 `@PreAuthorize`를 지워도 초록이다. URL 규칙이 없는 `TestSecurityConfig`에 메서드
보안만 켜서 애너테이션 자체를 증명하는 테스트를 따로 둔다(`RealtimeLogControllerTest`가 쓰는 패턴).

`WasLogControllerAuthorizationTest.java`:

```java
package com.kdb.it.common.admin.waslog.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kdb.it.common.admin.waslog.service.WasLogService;
import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.common.system.service.CustomUserDetailsService;
import com.kdb.it.config.TestSecurityConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 컨트롤러 자신의 {@code @PreAuthorize}를 격리 검증한다.
 *
 * <p>URL 패턴 규칙이 없는 {@link TestSecurityConfig}에 메서드 보안만 켜므로, 애너테이션을 지우면 이 테스트가
 * 깨진다. 엔드포인트가 나중에 {@code /api/admin/**} 밖으로 옮겨져도 권한이 유지되는지를 지키는 안전망이다.
 */
@WebMvcTest(WasLogController.class)
@Import({TestSecurityConfig.class, WasLogControllerAuthorizationTest.MethodSecurityTestConfig.class})
class WasLogControllerAuthorizationTest {

    @EnableMethodSecurity
    static class MethodSecurityTestConfig {}

    @Autowired private MockMvc mvc;

    @MockitoBean private WasLogService service;

    @MockitoBean private JwtUtil jwtUtil;

    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("일반 사용자는 로그 조회에서 403")
    void 일반사용자_조회_403() throws Exception {
        mvc.perform(get("/api/admin/was-logs")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("일반 사용자는 인스턴스 목록에서도 403")
    void 일반사용자_인스턴스목록_403() throws Exception {
        mvc.perform(get("/api/admin/was-logs/instances")).andExpect(status().isForbidden());
    }
}
```

- [ ] **Step 10: 격리 검증 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.controller.WasLogControllerAuthorizationTest" --no-daemon
```

Expected: PASS (2건)

- [ ] **Step 11: 포맷 적용 후 커밋**

```bash
cd C:/it/it_backend && ./gradlew spotlessApply --no-daemon
```

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/common/admin/waslog src/test/java/com/kdb/it/common/admin/waslog && git diff --cached --stat && git commit -m "feat: WAS 로그 조회 API와 관리자 권한 경계 추가"
```

---

### Task 4: 피어 팜아웃

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/client/WasLogPeerClient.java` (인터페이스 → 구현 클래스)
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/controller/WasLogInternalController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/service/WasLogService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/config/WasLogConfig.java`
- Modify: `it_backend/src/main/java/com/kdb/it/config/SecurityConfig.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/client/WasLogPeerClientTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/controller/WasLogInternalControllerTest.java`

**Interfaces:**
- Consumes: `WasLogService.localSnapshot`, `WasLogDto.*`, `WasLogProperties`
- Produces:
  - `WasLogPeerClient.fetchSnapshot(String baseUrl, String instanceId, WasLogDto.Query query)` → `WasLogDto.Snapshot`, 실패 시 `WasLogPeerException`
  - `WasLogPeerClient.applyLevel(String baseUrl, WasLogDto.LevelRequest request)` → `WasLogDto.LevelOverride` (Task 5에서 사용)
  - `WasLogPeerException extends RuntimeException`
  - `POST /internal/was-logs/snapshot` (헤더 `X-Internal-Token`)
  - `POST /internal/was-logs/level` (Task 5에서 채움)

- [ ] **Step 1: 피어 클라이언트 실패 테스트 작성**

`WasLogPeerClientTest.java`:

> 이 프로젝트는 `MockWebServer`를 쓰지 않는다 — `build.gradle` 머리말이 적었듯 okhttp 계열을 폐쇄망 반입
> 대상에서 의도적으로 뺐다. 대신 `spring-test`의 `MockRestServiceServer`를 `RestClient.Builder`에 바인딩한다
> (`EaiServiceTest`가 쓰는 것과 같은 방식). 새 의존성이 필요 없다.

```java
package com.kdb.it.common.admin.waslog.client;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.kdb.it.common.admin.waslog.config.WasLogProperties;
import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class WasLogPeerClientTest {

    private static final String PEER_URL = "http://svr2:28080";

    private final WasLogProperties properties =
            new WasLogProperties(2000, Map.of(), "s3cret", 1000, 3000);

    private final WasLogDto.Query query = new WasLogDto.Query(0L, 200, Set.of(), null, null);

    @Test
    @DisplayName("피어 응답을 그대로 반환하고 내부 토큰 헤더를 보낸다")
    void fetchSnapshot_정상() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(PEER_URL + "/internal/was-logs/snapshot"))
                .andExpect(method(POST))
                .andExpect(header("X-Internal-Token", "s3cret"))
                .andRespond(
                        withSuccess(
                                """
                                {"instanceId":"SVR2","bufferEpoch":"e2","entries":[],
                                 "lastSeq":5,"dropped":false,"levelOverrides":[],"peerError":null}
                                """,
                                MediaType.APPLICATION_JSON));

        WasLogPeerClient client = new DefaultWasLogPeerClient(builder.build(), properties);
        WasLogDto.Snapshot snapshot = client.fetchSnapshot(PEER_URL, "SVR2", query);

        server.verify();
        assertThat(snapshot.instanceId()).isEqualTo("SVR2");
        assertThat(snapshot.lastSeq()).isEqualTo(5L);
    }

    @Test
    @DisplayName("피어가 5xx면 WasLogPeerException을 던지고 인스턴스ID를 메시지에 담는다")
    void fetchSnapshot_서버오류() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(PEER_URL + "/internal/was-logs/snapshot"))
                .andRespond(withServerError());

        WasLogPeerClient client = new DefaultWasLogPeerClient(builder.build(), properties);

        assertThatThrownBy(() -> client.fetchSnapshot(PEER_URL, "SVR2", query))
                .isInstanceOf(WasLogPeerException.class)
                .hasMessageContaining("SVR2");
    }

    @Test
    @DisplayName("2xx인데 본문이 비면 WasLogPeerException을 던진다")
    void fetchSnapshot_빈본문() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(PEER_URL + "/internal/was-logs/snapshot"))
                .andRespond(withStatus(HttpStatus.NO_CONTENT));

        WasLogPeerClient client = new DefaultWasLogPeerClient(builder.build(), properties);

        assertThatThrownBy(() -> client.fetchSnapshot(PEER_URL, "SVR2", query))
                .isInstanceOf(WasLogPeerException.class)
                .hasMessageContaining("본문");
    }

    @Test
    @DisplayName("레벨 변경도 같은 토큰 헤더로 위임한다")
    void applyLevel_정상() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(PEER_URL + "/internal/was-logs/level"))
                .andExpect(method(POST))
                .andExpect(header("X-Internal-Token", "s3cret"))
                .andRespond(
                        withSuccess(
                                """
                                {"logger":"com.kdb.it","level":"DEBUG","previousLevel":"INFO",
                                 "expiresAt":"2026-08-20T11:00:00"}
                                """,
                                MediaType.APPLICATION_JSON));

        WasLogPeerClient client = new DefaultWasLogPeerClient(builder.build(), properties);
        WasLogDto.LevelOverride override =
                client.applyLevel(
                        PEER_URL, new WasLogDto.LevelRequest("SVR2", "com.kdb.it", "DEBUG", 30));

        server.verify();
        assertThat(override.logger()).isEqualTo("com.kdb.it");
        assertThat(override.previousLevel()).isEqualTo("INFO");
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.client.WasLogPeerClientTest" --no-daemon
```

Expected: 컴파일 실패 — `DefaultWasLogPeerClient`, `WasLogPeerException` 없음

- [ ] **Step 3: `WasLogPeerException` 작성**

```java
package com.kdb.it.common.admin.waslog.client;

/** 피어 인스턴스 위임 호출 실패. 호출부는 예외를 삼키지 말고 응답의 peerError로 표면화한다. */
public class WasLogPeerException extends RuntimeException {

    public WasLogPeerException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 4: `WasLogPeerClient` 인터페이스 확정**

Task 2에서 만든 빈 인터페이스를 아래로 교체한다.

```java
package com.kdb.it.common.admin.waslog.client;

import com.kdb.it.common.admin.waslog.dto.WasLogDto;

/** 다른 WAS 인스턴스의 내부 엔드포인트를 호출한다. */
public interface WasLogPeerClient {

    /**
     * 피어의 로그 스냅샷을 가져온다.
     *
     * @param baseUrl 피어 base URL(끝에 슬래시 없음)
     * @param instanceId 대상 인스턴스ID. 예외 메시지에만 쓴다
     * @param query 피어에 그대로 전달할 조회 조건
     * @return 피어가 돌려준 스냅샷. null을 반환하지 않는다
     * @throws WasLogPeerException 연결·타임아웃·4xx·5xx, 그리고 2xx인데 본문이 비어 있는 경우
     */
    WasLogDto.Snapshot fetchSnapshot(String baseUrl, String instanceId, WasLogDto.Query query);

    /**
     * 피어에 런타임 레벨 변경을 적용한다.
     *
     * @param baseUrl 피어 base URL(끝에 슬래시 없음)
     * @param request 적용할 로거·레벨·TTL
     * @return 피어가 적용한 오버라이드. null을 반환하지 않는다
     * @throws WasLogPeerException 연결·타임아웃·4xx·5xx, 그리고 2xx인데 본문이 비어 있는 경우
     */
    WasLogDto.LevelOverride applyLevel(String baseUrl, WasLogDto.LevelRequest request);
}
```

- [ ] **Step 5: `DefaultWasLogPeerClient` 작성**

```java
package com.kdb.it.common.admin.waslog.client;

import com.kdb.it.common.admin.waslog.config.WasLogProperties;
import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/** {@link WasLogPeerClient}의 RestClient 구현. */
@Component
public class DefaultWasLogPeerClient implements WasLogPeerClient {

    private static final String TOKEN_HEADER = "X-Internal-Token";

    private final RestClient restClient;
    private final WasLogProperties properties;

    public DefaultWasLogPeerClient(
            @Qualifier("wasLogPeerRestClient") RestClient wasLogPeerRestClient,
            WasLogProperties properties) {
        this.restClient = wasLogPeerRestClient;
        this.properties = properties;
    }

    @Override
    public WasLogDto.Snapshot fetchSnapshot(
            String baseUrl, String instanceId, WasLogDto.Query query) {
        WasLogDto.Snapshot body;
        try {
            body =
                    restClient
                            .post()
                            .uri(baseUrl + "/internal/was-logs/snapshot")
                            .header(TOKEN_HEADER, properties.internalSecret())
                            .body(query)
                            .retrieve()
                            .body(WasLogDto.Snapshot.class);
        } catch (RestClientException e) {
            throw new WasLogPeerException(instanceId + " 인스턴스 조회 실패: " + e.getMessage(), e);
        }
        // 2xx인데 본문이 비면 body()가 예외 없이 null을 준다. 그대로 흘리면 화면이 "로그 없음"으로
        // 읽어 실패가 감춰지므로, 호출 실패로 승격해 peerError 경로를 타게 한다.
        if (body == null) {
            throw new WasLogPeerException(instanceId + " 인스턴스 응답 본문이 비어 있습니다.", null);
        }
        return body;
    }

    @Override
    public WasLogDto.LevelOverride applyLevel(String baseUrl, WasLogDto.LevelRequest request) {
        WasLogDto.LevelOverride body;
        try {
            body =
                    restClient
                            .post()
                            .uri(baseUrl + "/internal/was-logs/level")
                            .header(TOKEN_HEADER, properties.internalSecret())
                            .body(request)
                            .retrieve()
                            .body(WasLogDto.LevelOverride.class);
        } catch (RestClientException e) {
            throw new WasLogPeerException(
                    request.instanceId() + " 인스턴스 레벨 변경 실패: " + e.getMessage(), e);
        }
        if (body == null) {
            throw new WasLogPeerException(
                    request.instanceId() + " 인스턴스 레벨 변경 응답 본문이 비어 있습니다.", null);
        }
        return body;
    }
}
```

- [ ] **Step 6: `WasLogConfig`에 RestClient 빈 추가**

```java
package com.kdb.it.common.admin.waslog.config;

import java.time.Duration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** WAS 로그 뷰어 설정 등록과 피어 호출용 RestClient. */
@Configuration
@EnableConfigurationProperties(WasLogProperties.class)
public class WasLogConfig {

    /**
     * 피어 위임 호출 전용 RestClient.
     *
     * <p>화면 응답성을 위해 타임아웃을 짧게 잡는다. 실패는 예외로 올라가 응답의 {@code peerError}로 표면화된다.
     */
    @Bean
    public RestClient wasLogPeerRestClient(WasLogProperties properties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(properties.connectTimeoutMs()));
        factory.setReadTimeout(Duration.ofMillis(properties.readTimeoutMs()));
        return RestClient.builder().requestFactory(factory).build();
    }
}
```

- [ ] **Step 7: 클라이언트 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.client.WasLogPeerClientTest" --no-daemon
```

Expected: PASS (4건)

- [ ] **Step 8: 내부 컨트롤러 실패 테스트 작성**

`WasLogInternalControllerTest.java`:

```java
package com.kdb.it.common.admin.waslog.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kdb.it.common.admin.waslog.config.WasLogProperties;
import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import com.kdb.it.common.admin.waslog.service.WasLogService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.TestConfiguration;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WasLogInternalController.class)
@Import(WasLogInternalControllerTest.Config.class)
@WithMockUser
class WasLogInternalControllerTest {

    @TestConfiguration
    static class Config {
        @Bean
        WasLogProperties wasLogProperties() {
            return new WasLogProperties(2000, Map.of(), "s3cret", 1000, 3000);
        }
    }

    @Autowired private MockMvc mockMvc;

    @MockitoBean private WasLogService service;

    private static final String BODY =
            """
            {"afterSeq":0,"limit":200,"levels":[],"logger":null,"keyword":null}
            """;

    @Test
    @DisplayName("올바른 토큰이면 로컬 스냅샷을 반환한다")
    void snapshot_토큰일치() throws Exception {
        given(service.localSnapshot(any()))
                .willReturn(
                        new WasLogDto.Snapshot("SVR2", "e2", List.of(), 0L, false, List.of(), null));

        mockMvc.perform(
                        post("/internal/was-logs/snapshot")
                                .header("X-Internal-Token", "s3cret")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.instanceId").value("SVR2"));
    }

    @Test
    @DisplayName("토큰이 다르면 401이고 본문이 없다")
    void snapshot_토큰불일치_401() throws Exception {
        mockMvc.perform(
                        post("/internal/was-logs/snapshot")
                                .header("X-Internal-Token", "wrong")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("토큰 헤더가 없으면 401")
    void snapshot_토큰없음_401() throws Exception {
        mockMvc.perform(
                        post("/internal/was-logs/snapshot")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(BODY))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 9: `WasLogInternalController` 작성**

```java
package com.kdb.it.common.admin.waslog.controller;

import com.kdb.it.common.admin.waslog.config.WasLogProperties;
import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import com.kdb.it.common.admin.waslog.service.WasLogService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 피어 인스턴스 전용 내부 API.
 *
 * <p>사용자 JWT가 아니라 공유 비밀 헤더 {@code X-Internal-Token}으로만 인증한다. 그래서 비밀값이 비어 있으면 빈 자체를 등록하지 않는다 — 설정
 * 실수로 인증 없는 로그 엔드포인트가 열리는 경로를 구조적으로 없앤다.
 */
@RestController
@RequestMapping("/internal/was-logs")
@RequiredArgsConstructor
@ConditionalOnExpression("!'${app.was-log.internal-secret:}'.isBlank()")
public class WasLogInternalController {

    private final WasLogService service;
    private final WasLogProperties properties;

    /** 로컬 버퍼 스냅샷. 라우팅하지 않는다(무한 위임 방지). */
    @PostMapping("/snapshot")
    public ResponseEntity<WasLogDto.Snapshot> snapshot(
            @RequestHeader(name = "X-Internal-Token", required = false) String token,
            @RequestBody WasLogDto.Query query) {
        if (!matches(token)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(service.localSnapshot(query));
    }

    private boolean matches(String token) {
        // 조건식과 이 검사는 같은 값을 서로 다른 경로로 읽는다 — 조건식은 Environment 키를 직접,
        // 이 필드는 @ConfigurationProperties 완화 바인딩(빈 값을 ""로 보정)을 거친다. 두 경로가
        // 어긋나 빈 비밀값으로 빈이 등록되면 MessageDigest.isEqual("", "")가 true라 무인증이 된다.
        // 보안 불변식을 한 경로에만 의존시키지 않는다.
        if (token == null || properties.internalSecret().isBlank()) return false;
        return MessageDigest.isEqual(
                token.getBytes(StandardCharsets.UTF_8),
                properties.internalSecret().getBytes(StandardCharsets.UTF_8));
    }
}
```

- [ ] **Step 10: SecurityConfig에 내부 경로 허용 추가**

`SecurityConfig`의 인가 설정에서 `/api/admin/**` 규칙 **앞**에 다음을 넣는다.

```java
                                    // 피어 인스턴스 전용 경로. 컨트롤러가 X-Internal-Token으로 직접 인증하고,
                                    // 비밀값이 비면 컨트롤러 자체가 등록되지 않아 404가 된다.
                                    .requestMatchers("/internal/was-logs/**")
                                    .permitAll()
```

> 이 경로는 L4 외부에 노출하지 않도록 방화벽에서 사내 서버 대역으로 제한할 것을 운영 인계 시 함께 요청한다.

Task 3에서 만든 `WasLogSecurityBoundaryTest`에 내부 경로 검증 두 건을 이제 추가한다 — 계획 §Task 3의
해당 코드 블록에 이미 반영돼 있으니 그대로 옮겨 넣고, 클래스 애너테이션(`@WebMvcTest`에 내부 컨트롤러 추가,
`@EnableConfigurationProperties`, `@TestPropertySource`)과 import도 함께 맞춘다. 이 두 건이 없으면
`SecurityConfig`의 permitAll 4줄을 지워도 전체 스위트가 초록이다.

- [ ] **Step 11: 내부 컨트롤러 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.controller.WasLogInternalControllerTest" --no-daemon
```

Expected: PASS (3건)

- [ ] **Step 12: `WasLogService.snapshot`을 실제 위임으로 교체**

Task 3 Step 3에서 넣은 임시 `throw`를 아래로 바꾼다.

```java
    public WasLogDto.Snapshot snapshot(String instanceId, WasLogDto.Query query) {
        if (instanceId == null || instanceId.isBlank() || instanceId.equals(selfInstanceId)) {
            return localSnapshot(query);
        }
        String peerUrl = properties.peers().get(instanceId);
        if (peerUrl == null || peerUrl.isBlank()) {
            throw new IllegalArgumentException("알 수 없는 인스턴스: " + instanceId);
        }
        try {
            return peerClient.fetchSnapshot(peerUrl, instanceId, query);
        } catch (WasLogPeerException e) {
            // 실패를 빈 목록으로 위장하지 않는다 — 화면이 "로그 없음"으로 오해하지 않도록 사유를 싣는다.
            return new WasLogDto.Snapshot(
                    instanceId, null, List.of(), query.afterSeq(), false, List.of(), e.getMessage());
        }
    }
```

- [ ] **Step 13: 위임 실패 표면화 테스트 추가**

`WasLogServiceTest.java`에 추가:

```java
    @Test
    @DisplayName("피어 호출이 실패하면 예외 대신 peerError로 표면화한다")
    void snapshot_피어실패_표면화() {
        WasLogProperties properties =
                new WasLogProperties(10, Map.of("SVR2", "http://svr2:28080"), "s", 1000, 3000);
        WasLogPeerClient failing =
                new WasLogPeerClient() {
                    @Override
                    public WasLogDto.Snapshot fetchSnapshot(
                            String baseUrl, String instanceId, WasLogDto.Query query) {
                        throw new WasLogPeerException("SVR2 인스턴스 조회 실패: timeout", null);
                    }

                    @Override
                    public WasLogDto.LevelOverride applyLevel(
                            String baseUrl, WasLogDto.LevelRequest request) {
                        throw new WasLogPeerException("미사용", null);
                    }
                };
        WasLogService routing = new WasLogService(properties, "SVR1", failing, null);

        WasLogDto.Snapshot snapshot =
                routing.snapshot("SVR2", new WasLogDto.Query(0L, 200, Set.of(), null, null));

        assertThat(snapshot.peerError()).contains("timeout");
        assertThat(snapshot.entries()).isEmpty();
        assertThat(snapshot.instanceId()).isEqualTo("SVR2");
    }
```

필요한 import를 파일 상단에 추가한다: `com.kdb.it.common.admin.waslog.client.WasLogPeerClient`, `com.kdb.it.common.admin.waslog.client.WasLogPeerException`.

- [ ] **Step 14: 전체 waslog 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.*" --no-daemon
```

Expected: PASS

- [ ] **Step 15: 포맷 적용 후 커밋**

```bash
cd C:/it/it_backend && ./gradlew spotlessApply --no-daemon
```

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/common/admin/waslog src/test/java/com/kdb/it/common/admin/waslog src/main/java/com/kdb/it/config/SecurityConfig.java && git diff --cached --stat && git commit -m "feat: WAS 로그 피어 팜아웃과 내부 전용 엔드포인트 추가"
```

---

### Task 5: 런타임 로그레벨 변경과 TTL 자동 복원

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/service/LevelOverrideService.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/service/LevelOverrideRestoreScheduler.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/service/WasLogService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/controller/WasLogController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/controller/WasLogInternalController.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/service/LevelOverrideServiceTest.java`

**Interfaces:**
- Consumes: `LevelOverrideRegistry`(Task 2), `WasLogDto.LevelRequest/LevelOverride`, `WasLogPeerClient.applyLevel`(Task 4), 기존 `Clock` 빈(`ClockConfig`, `@Primary`)
- Produces:
  - `LevelOverrideService.apply(String logger, String level, int ttlMinutes)` → `WasLogDto.LevelOverride`
  - `LevelOverrideService.restoreExpired()` → `int` (복원 건수)
  - `LevelOverrideService.MAX_TTL_MINUTES = 120`, `ALLOWED_LOGGER_PREFIXES`
  - `WasLogService.applyLevel(WasLogDto.LevelRequest)` → `WasLogDto.LevelOverride`
  - `POST /api/admin/was-logs/level`, `POST /internal/was-logs/level`

- [ ] **Step 1: 레벨 서비스 실패 테스트 작성**

`LevelOverrideServiceTest.java`:

```java
package com.kdb.it.common.admin.waslog.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggerConfiguration;
import org.springframework.boot.logging.LoggingSystem;

class LevelOverrideServiceTest {

    private static final Instant NOW = Instant.parse("2026-08-20T10:00:00Z");

    private LoggingSystem loggingSystem;
    private LevelOverrideRegistry registry;
    private LevelOverrideService service;
    private Clock clock;

    @BeforeEach
    void setUp() {
        loggingSystem = mock(LoggingSystem.class);
        registry = new LevelOverrideRegistry();
        clock = Clock.fixed(NOW, ZoneId.of("Asia/Seoul"));
        service = new LevelOverrideService(loggingSystem, registry, clock);
    }

    @Test
    @DisplayName("레벨을 적용하고 직전 레벨과 만료 시각을 등록한다")
    void apply_정상() {
        given(loggingSystem.getLoggerConfiguration("com.kdb.it.domain"))
                .willReturn(new LoggerConfiguration("com.kdb.it.domain", LogLevel.INFO, LogLevel.INFO));

        WasLogDto.LevelOverride override = service.apply("com.kdb.it.domain", "DEBUG", 30);

        verify(loggingSystem).setLogLevel("com.kdb.it.domain", LogLevel.DEBUG);
        assertThat(override.level()).isEqualTo("DEBUG");
        assertThat(override.previousLevel()).isEqualTo("INFO");
        assertThat(override.expiresAt())
                .isEqualTo(java.time.LocalDateTime.now(clock).plusMinutes(30));
        assertThat(registry.list()).hasSize(1);
    }

    @Test
    @DisplayName("같은 로거에 다시 적용해도 최초 레벨을 previousLevel로 유지한다")
    void apply_재적용_최초레벨보존() {
        given(loggingSystem.getLoggerConfiguration("com.kdb.it.domain"))
                .willReturn(new LoggerConfiguration("com.kdb.it.domain", LogLevel.INFO, LogLevel.INFO));
        service.apply("com.kdb.it.domain", "DEBUG", 30);

        // 두 번째 호출 시점의 "현재 설정 레벨"은 이미 첫 번째가 써 넣은 DEBUG다.
        given(loggingSystem.getLoggerConfiguration("com.kdb.it.domain"))
                .willReturn(new LoggerConfiguration("com.kdb.it.domain", LogLevel.DEBUG, LogLevel.DEBUG));
        WasLogDto.LevelOverride second = service.apply("com.kdb.it.domain", "TRACE", 30);

        assertThat(second.previousLevel()).isEqualTo("INFO");
    }

    @Test
    @DisplayName("화이트리스트 밖 로거는 거부하고 레벨을 건드리지 않는다")
    void apply_허용되지않은로거() {
        assertThatThrownBy(() -> service.apply("com.evil.Thing", "DEBUG", 30))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("com.evil.Thing");
        verify(loggingSystem, never()).setLogLevel(any(), any());
    }

    @Test
    @DisplayName("접두사만 같고 패키지 경계를 넘는 이름은 거부한다")
    void apply_접두사경계() {
        assertThatThrownBy(() -> service.apply("com.kdb.itX", "DEBUG", 30))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.apply("", "DEBUG", 30))
                .isInstanceOf(IllegalArgumentException.class);
        verify(loggingSystem, never()).setLogLevel(any(), any());
    }

    @Test
    @DisplayName("TTL이 범위를 벗어나면 거부하고 레벨을 건드리지 않는다")
    void apply_TTL범위밖() {
        assertThatThrownBy(() -> service.apply("com.kdb.it.domain", "DEBUG", 0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.apply("com.kdb.it.domain", "DEBUG", 121))
                .isInstanceOf(IllegalArgumentException.class);
        // 검증이 setLogLevel보다 먼저여야 한다 — 레벨만 바뀌고 만료 등록에 실패하면 영구 오버라이드가 된다.
        verify(loggingSystem, never()).setLogLevel(any(), any());
    }

    @Test
    @DisplayName("허용되지 않은 레벨은 거부하고 레벨을 건드리지 않는다")
    void apply_잘못된레벨() {
        assertThatThrownBy(() -> service.apply("com.kdb.it.domain", "FATAL", 30))
                .isInstanceOf(IllegalArgumentException.class);
        verify(loggingSystem, never()).setLogLevel(any(), any());
    }

    @Test
    @DisplayName("원래 설정이 없던 로거는 null로 되돌려 상위 상속으로 복원한다")
    void restoreExpired_설정없음_null복원() {
        given(loggingSystem.getLoggerConfiguration("com.kdb.it.c")).willReturn(null);
        service.apply("com.kdb.it.c", "DEBUG", 1);

        LevelOverrideService later =
                new LevelOverrideService(
                        loggingSystem,
                        registry,
                        Clock.fixed(NOW.plusSeconds(120), ZoneId.of("Asia/Seoul")));
        later.restoreExpired();

        verify(loggingSystem).setLogLevel("com.kdb.it.c", null);
    }

    @Test
    @DisplayName("만료된 오버라이드만 직전 레벨로 되돌린다")
    void restoreExpired_만료분만복원() {
        given(loggingSystem.getLoggerConfiguration("com.kdb.it.a"))
                .willReturn(new LoggerConfiguration("com.kdb.it.a", LogLevel.INFO, LogLevel.INFO));
        given(loggingSystem.getLoggerConfiguration("com.kdb.it.b"))
                .willReturn(new LoggerConfiguration("com.kdb.it.b", LogLevel.WARN, LogLevel.WARN));
        service.apply("com.kdb.it.a", "DEBUG", 1);
        service.apply("com.kdb.it.b", "DEBUG", 60);

        LevelOverrideService later =
                new LevelOverrideService(
                        loggingSystem,
                        registry,
                        Clock.fixed(NOW.plusSeconds(120), ZoneId.of("Asia/Seoul")));
        int restored = later.restoreExpired();

        assertThat(restored).isEqualTo(1);
        verify(loggingSystem).setLogLevel("com.kdb.it.a", LogLevel.INFO);
        assertThat(registry.list()).extracting(WasLogDto.LevelOverride::logger)
                .containsExactly("com.kdb.it.b");
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.service.LevelOverrideServiceTest" --no-daemon
```

Expected: 컴파일 실패 — `LevelOverrideService` 없음

- [ ] **Step 3: `LevelOverrideService` 작성**

```java
package com.kdb.it.common.admin.waslog.service;

import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.springframework.boot.logging.LogLevel;
import org.springframework.boot.logging.LoggerConfiguration;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;

/**
 * 런타임 로그레벨 변경 서비스.
 *
 * <p>Actuator 엔드포인트를 노출하지 않고 {@link LoggingSystem} 빈만 사용한다. 모든 변경은 TTL을 가지며 {@link
 * LevelOverrideRestoreScheduler}가 만료 시 직전 레벨로 되돌린다. 재기동 시에는 설정 파일 레벨로 자연 복원된다.
 */
@Service
@Slf4j
public class LevelOverrideService {

    /** TTL 상한(분). 끄는 것을 잊어 운영 서버가 느려지는 사고를 막는다. */
    public static final int MAX_TTL_MINUTES = 120;

    /** 변경을 허용하는 로거 접두사. 루트 로거 전체 변경은 허용하지 않는다. */
    public static final List<String> ALLOWED_LOGGER_PREFIXES =
            List.of("com.kdb.it", "org.springframework", "org.hibernate");

    private static final Set<String> ALLOWED_LEVELS =
            Set.of("ERROR", "WARN", "INFO", "DEBUG", "TRACE");

    private final LoggingSystem loggingSystem;
    private final LevelOverrideRegistry registry;
    private final Clock clock;

    public LevelOverrideService(
            LoggingSystem loggingSystem, LevelOverrideRegistry registry, Clock clock) {
        this.loggingSystem = loggingSystem;
        this.registry = registry;
        this.clock = clock;
    }

    /**
     * 로거 레벨을 한시적으로 변경한다.
     *
     * @param logger {@link #ALLOWED_LOGGER_PREFIXES} 중 하나로 시작하는 로거명
     * @param level ERROR/WARN/INFO/DEBUG/TRACE
     * @param ttlMinutes 1~{@value #MAX_TTL_MINUTES}
     * @throws IllegalArgumentException 로거·레벨·TTL이 규칙을 벗어난 경우
     */
    public WasLogDto.LevelOverride apply(String logger, String level, int ttlMinutes) {
        if (!allowedLogger(logger)) {
            throw new IllegalArgumentException("변경이 허용되지 않은 로거: " + logger);
        }
        if (level == null || !ALLOWED_LEVELS.contains(level)) {
            throw new IllegalArgumentException("허용되지 않은 로그 레벨: " + level);
        }
        if (ttlMinutes < 1 || ttlMinutes > MAX_TTL_MINUTES) {
            throw new IllegalArgumentException("TTL은 1~" + MAX_TTL_MINUTES + "분이어야 합니다: " + ttlMinutes);
        }

        // 같은 로거에 두 번 적용하면 두 번째가 읽는 "현재 레벨"은 첫 번째가 써 넣은 임시 레벨이다.
        // 그대로 previousLevel로 저장하면 TTL 만료 후 임시 레벨로 되돌아가 영구 고정된다
        // (예: INFO → DEBUG 적용 → 시끄러워서 INFO 재적용 → 만료 시 DEBUG로 복원되어 그대로 굳음).
        // 이미 오버라이드가 있으면 최초에 잡아둔 원래 레벨을 그대로 물려받는다.
        WasLogDto.LevelOverride existing = registry.find(logger);
        String previous = existing != null ? existing.previousLevel() : configuredLevel(logger);
        loggingSystem.setLogLevel(logger, LogLevel.valueOf(level));

        WasLogDto.LevelOverride override =
                new WasLogDto.LevelOverride(
                        logger, level, previous, LocalDateTime.now(clock).plusMinutes(ttlMinutes));
        registry.put(override);
        return override;
    }

    /**
     * 만료된 오버라이드를 직전 레벨로 되돌린다.
     *
     * <p>{@code previousLevel}이 null이면 null을 그대로 넘겨 설정을 지우고 상위 로거 상속으로 되돌린다.
     *
     * <p>이 메서드는 레벨을 바꾸는 주체가 이 기능뿐이라고 가정한다. Actuator {@code loggers} 엔드포인트를
     * 열거나 logback 설정 자동 재로딩을 켜면 그 가정이 깨져 남의 변경을 덮어쓸 수 있다.
     *
     * @return 복원한 건수
     */
    public int restoreExpired() {
        List<WasLogDto.LevelOverride> expired = registry.removeExpired(LocalDateTime.now(clock));
        int restored = 0;
        for (WasLogDto.LevelOverride override : expired) {
            LogLevel restore =
                    override.previousLevel() == null ? null : LogLevel.valueOf(override.previousLevel());
            try {
                loggingSystem.setLogLevel(override.logger(), restore);
                restored++;
            } catch (RuntimeException e) {
                // 한 건이 실패해도 나머지는 되돌린다 — 이미 레지스트리에서 빠졌으므로 여기서 멈추면 영구 고정된다.
                log.warn("[WAS로그] 로그레벨 복원 실패 logger={} level={}", override.logger(), restore, e);
            }
        }
        return restored;
    }

    /**
     * 화이트리스트 판정.
     *
     * <p>단순 {@code startsWith}는 {@code com.kdb.itX}처럼 패키지 경계를 넘는 이름까지 통과시키므로, 접두사와
     * 정확히 같거나 그 아래 패키지({@code 접두사 + "."})인 경우만 허용한다.
     */
    private boolean allowedLogger(String logger) {
        if (logger == null || logger.isBlank()) return false;
        return ALLOWED_LOGGER_PREFIXES.stream()
                .anyMatch(prefix -> logger.equals(prefix) || logger.startsWith(prefix + "."));
    }

    private String configuredLevel(String logger) {
        LoggerConfiguration configuration = loggingSystem.getLoggerConfiguration(logger);
        if (configuration == null || configuration.getConfiguredLevel() == null) return null;
        return configuration.getConfiguredLevel().name();
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.service.LevelOverrideServiceTest" --no-daemon
```

Expected: PASS (5건)

- [ ] **Step 5: 복원 스케줄러 작성**

```java
package com.kdb.it.common.admin.waslog.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 만료된 런타임 로그레벨 오버라이드를 되돌리는 스케줄러.
 *
 * <p>스케줄링은 {@code NotificationSchedulingConfig}의 {@code @EnableScheduling}으로 이미 활성이다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LevelOverrideRestoreScheduler {

    private final LevelOverrideService service;

    /** 만료분을 스캔해 원복한다. */
    @Scheduled(fixedDelayString = "${app.was-log.restore-scan-ms:30000}")
    public void restore() {
        int restored = service.restoreExpired();
        if (restored > 0) {
            log.info("[WAS로그] 만료된 로그레벨 오버라이드 {}건을 원복했습니다.", restored);
        }
    }
}
```

- [ ] **Step 6: `WasLogService`에 레벨 라우팅 추가**

`WasLogService`에 필드와 생성자 파라미터를 마지막 자리에 추가한다.

```java
    private final LevelOverrideService levelOverrideService;
```

```java
    public WasLogService(
            WasLogProperties properties,
            @Value("${app.server.instance-id:SVR1}") String selfInstanceId,
            WasLogPeerClient peerClient,
            LevelOverrideRegistry overrideRegistry,
            LevelOverrideService levelOverrideService) {
        this.properties = properties;
        this.selfInstanceId = selfInstanceId;
        this.peerClient = peerClient;
        this.overrideRegistry = overrideRegistry;
        this.levelOverrideService = levelOverrideService;
    }
```

시그니처가 바뀌므로 **기존 테스트 두 곳의 생성자 호출을 함께 고친다**. 둘 다 이 태스크의 관심사가 아니므로 마지막 인자로 `null`을 넘긴다.

- `WasLogServiceTest.setUp()` → `new WasLogService(properties, "SVR1", null, null, null)`
- `WasLogServiceTest.snapshot_피어실패_표면화()` → `new WasLogService(properties, "SVR1", failing, null, null)`

그리고 아래 메서드를 넣는다.

```java
    /**
     * 대상 인스턴스에 런타임 레벨 변경을 적용한다.
     *
     * @throws IllegalArgumentException 알 수 없는 인스턴스이거나 로거·레벨·TTL 규칙 위반
     * @throws WasLogPeerException 피어 호출 실패
     */
    public WasLogDto.LevelOverride applyLevel(WasLogDto.LevelRequest request) {
        String instanceId = request.instanceId();
        if (instanceId == null || instanceId.isBlank() || instanceId.equals(selfInstanceId)) {
            return levelOverrideService.apply(request.logger(), request.level(), request.ttlMinutes());
        }
        String peerUrl = properties.peers().get(instanceId);
        if (peerUrl == null || peerUrl.isBlank()) {
            throw new IllegalArgumentException("알 수 없는 인스턴스: " + instanceId);
        }
        return peerClient.applyLevel(peerUrl, request);
    }
```

레벨 변경은 조회와 달리 실패를 조용히 넘기면 "적용됐다"는 착시를 준다. 그래서 `WasLogPeerException`을 잡지 않고 그대로 올린다.

- [ ] **Step 7: 컨트롤러에 레벨 변경 엔드포인트 추가**

`WasLogController`에 추가:

```java
    /**
     * 런타임 로그레벨을 한시적으로 변경한다.
     *
     * @param request 대상 인스턴스·로거·레벨·TTL(1~120분)
     */
    @PostMapping("/level")
    @Operation(summary = "런타임 로그레벨 변경", description = "TTL이 지나면 자동으로 원래 레벨로 복원됩니다.")
    public WasLogDto.LevelOverride applyLevel(@RequestBody WasLogDto.LevelRequest request) {
        return service.applyLevel(request);
    }
```

import 추가: `org.springframework.web.bind.annotation.PostMapping`, `org.springframework.web.bind.annotation.RequestBody`.

`WasLogInternalController`에도 같은 동작의 내부 엔드포인트를 추가한다(라우팅 없이 로컬 적용).

> **이 엔드포인트의 유일한 인증 수단은 토큰 검사다.** Task 4가 넣은 `SecurityConfig`의
> `/internal/was-logs/**` permitAll 매처가 와일드카드라 `/level`도 자동으로 익명 허용 대상이 된다.
> 조회와 달리 이 경로는 **서버 상태를 바꾸므로**, `matches(token)` 호출을 빠뜨리면 누구나 운영 서버의
> 로그 레벨을 바꿀 수 있다. 조회 엔드포인트와 완전히 같은 가드를 본문 첫 줄에 둔다.

```java
    /** 로컬 인스턴스에 레벨을 적용한다. 라우팅하지 않는다. */
    @PostMapping("/level")
    public ResponseEntity<WasLogDto.LevelOverride> applyLevel(
            @RequestHeader(name = "X-Internal-Token", required = false) String token,
            @RequestBody WasLogDto.LevelRequest request) {
        if (!matches(token)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(
                levelOverrideService.apply(request.logger(), request.level(), request.ttlMinutes()));
    }
```

`WasLogInternalController`의 생성자 주입에 `LevelOverrideService levelOverrideService`를 추가한다(`@RequiredArgsConstructor`이므로 final 필드 선언만 추가).

- [ ] **Step 8: 컨트롤러 레벨 변경 테스트 추가**

`WasLogControllerTest.java`에 추가(상단에 `post`, `MediaType` import 필요):

```java
    @Test
    @DisplayName("레벨 변경은 적용 결과를 반환한다")
    void applyLevel_정상응답() throws Exception {
        given(service.applyLevel(any()))
                .willReturn(
                        new WasLogDto.LevelOverride(
                                "com.kdb.it.domain",
                                "DEBUG",
                                "INFO",
                                java.time.LocalDateTime.of(2026, 8, 20, 11, 0)));

        mockMvc.perform(
                        post("/api/admin/was-logs/level")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {"instanceId":"SVR1","logger":"com.kdb.it.domain",
                                         "level":"DEBUG","ttlMinutes":30}
                                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logger").value("com.kdb.it.domain"))
                .andExpect(jsonPath("$.previousLevel").value("INFO"));
    }

    @Test
    @DisplayName("TTL 범위 위반은 400")
    void applyLevel_TTL위반_400() throws Exception {
        given(service.applyLevel(any()))
                .willThrow(new IllegalArgumentException("TTL은 1~120분이어야 합니다: 999"));

        mockMvc.perform(
                        post("/api/admin/was-logs/level")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {"instanceId":"SVR1","logger":"com.kdb.it.domain",
                                         "level":"DEBUG","ttlMinutes":999}
                                        """))
                .andExpect(status().isBadRequest());
    }
```

- [ ] **Step 9a: `WasLogService.applyLevel` 테스트 추가**

레벨 변경 경로에 서비스 테스트가 하나도 없어서, `peerClient.applyLevel`을 try/catch로 감싸 실패를 삼켜도
전체 스위트가 통과한다. 브리프가 굵게 강조한 실패 비대칭이 무방비다.

`WasLogServiceTest.java`에 추가(상단에 `static org.mockito.Mockito.mock`, `static org.mockito.BDDMockito.given`,
`java.time.LocalDateTime` import 필요):

```java
    @Test
    @DisplayName("자기 인스턴스면 로컬 레벨 서비스에 적용한다")
    void applyLevel_로컬적용() {
        LevelOverrideService levelService = mock(LevelOverrideService.class);
        WasLogDto.LevelOverride expected =
                new WasLogDto.LevelOverride(
                        "com.kdb.it", "DEBUG", "INFO", LocalDateTime.of(2026, 8, 20, 11, 0));
        given(levelService.apply("com.kdb.it", "DEBUG", 30)).willReturn(expected);
        WasLogProperties properties = new WasLogProperties(10, Map.of(), "", 1000, 3000);
        WasLogService routing = new WasLogService(properties, "SVR1", null, null, levelService);

        WasLogDto.LevelOverride actual =
                routing.applyLevel(new WasLogDto.LevelRequest("SVR1", "com.kdb.it", "DEBUG", 30));

        assertThat(actual).isEqualTo(expected);
    }

    @Test
    @DisplayName("설정에 없는 인스턴스면 IllegalArgumentException")
    void applyLevel_알수없는인스턴스() {
        WasLogProperties properties = new WasLogProperties(10, Map.of(), "", 1000, 3000);
        WasLogService routing =
                new WasLogService(properties, "SVR1", null, null, mock(LevelOverrideService.class));
        WasLogDto.LevelRequest request =
                new WasLogDto.LevelRequest("SVR9", "com.kdb.it", "DEBUG", 30);

        assertThatThrownBy(() -> routing.applyLevel(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("SVR9");
    }

    @Test
    @DisplayName("피어 레벨 변경 실패는 삼키지 않고 그대로 전파한다")
    void applyLevel_피어실패_전파() {
        WasLogProperties properties =
                new WasLogProperties(10, Map.of("SVR2", "http://svr2:28080"), "s", 1000, 3000);
        WasLogPeerClient failing =
                new WasLogPeerClient() {
                    @Override
                    public WasLogDto.Snapshot fetchSnapshot(
                            String baseUrl, String instanceId, WasLogDto.Query query) {
                        throw new WasLogPeerException("미사용", null);
                    }

                    @Override
                    public WasLogDto.LevelOverride applyLevel(
                            String baseUrl, WasLogDto.LevelRequest request) {
                        throw new WasLogPeerException("SVR2 인스턴스 레벨 변경 실패: timeout", null);
                    }
                };
        WasLogService routing =
                new WasLogService(
                        properties, "SVR1", failing, null, mock(LevelOverrideService.class));
        WasLogDto.LevelRequest request =
                new WasLogDto.LevelRequest("SVR2", "com.kdb.it", "DEBUG", 30);

        // 조회와 달리 여기서 예외를 삼키면 관리자에게 "적용됨"으로 보인다.
        assertThatThrownBy(() -> routing.applyLevel(request))
                .isInstanceOf(WasLogPeerException.class)
                .hasMessageContaining("timeout");
    }
```

- [ ] **Step 9b: 내부 `/level` 엔드포인트의 토큰 가드 테스트 추가**

이 엔드포인트는 `SecurityConfig`가 permitAll로 열어둔 경로에 있고 서버 상태를 바꾼다. 그런데 토큰 가드를
지워도 전체 스위트가 통과한다 — 조회 쪽만 테스트가 있기 때문이다.

`WasLogInternalControllerTest.java`에 추가(`static org.mockito.Mockito.verifyNoInteractions` import 필요):

```java
    private static final String LEVEL_BODY =
            """
            {"instanceId":"SVR2","logger":"com.kdb.it","level":"DEBUG","ttlMinutes":30}
            """;

    @Test
    @DisplayName("레벨 변경은 토큰이 없으면 401이고 아무것도 적용하지 않는다")
    void level_토큰없음_401() throws Exception {
        mockMvc.perform(
                        post("/internal/was-logs/level")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(LEVEL_BODY))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(levelOverrideService);
    }

    @Test
    @DisplayName("레벨 변경은 토큰이 틀리면 401이고 아무것도 적용하지 않는다")
    void level_토큰불일치_401() throws Exception {
        mockMvc.perform(
                        post("/internal/was-logs/level")
                                .header("X-Internal-Token", "wrong")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(LEVEL_BODY))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(levelOverrideService);
    }
```

- [ ] **Step 9c: 스케줄러 스레드 풀 확보**

`application.properties`에 추가한다.

```properties
# @Scheduled 기본 풀 크기는 1이다. 알림 재시도 작업(NotificationRetryScheduler)이 외부 전송에서 막히면
# 같은 스레드를 쓰는 로그레벨 복원이 영영 돌지 않아 임시 레벨이 TTL을 넘겨 남는다. 현재 스케줄 작업이
# 둘이므로 2로 둔다.
spring.task.scheduling.pool.size=2
```

- [ ] **Step 9: 피어 레벨 변경의 빈 본문 처리 테스트 추가**

Task 4에서 `fetchSnapshot`만 커버했고 `applyLevel`의 같은 분기는 비어 있었다. 레벨 변경은 실패를 삼키면
"적용됐다"는 착시를 주는 경로이므로 대칭으로 채운다.

`WasLogPeerClientTest.java`에 추가:

```java
    @Test
    @DisplayName("레벨 변경이 2xx인데 본문이 비면 WasLogPeerException을 던진다")
    void applyLevel_빈본문() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(PEER_URL + "/internal/was-logs/level"))
                .andRespond(withStatus(HttpStatus.NO_CONTENT));

        WasLogPeerClient client = new DefaultWasLogPeerClient(builder.build(), properties);
        WasLogDto.LevelRequest request =
                new WasLogDto.LevelRequest("SVR2", "com.kdb.it", "DEBUG", 30);

        assertThatThrownBy(() -> client.applyLevel(PEER_URL, request))
                .isInstanceOf(WasLogPeerException.class)
                .hasMessageContaining("본문");
    }
```

- [ ] **Step 10: 전체 waslog 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.*" --no-daemon
```

Expected: PASS

- [ ] **Step 11: 포맷 적용 후 커밋**

```bash
cd C:/it/it_backend && ./gradlew spotlessApply --no-daemon
```

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/common/admin/waslog src/test/java/com/kdb/it/common/admin/waslog && git diff --cached --stat && git commit -m "feat: WAS 로그 런타임 레벨 변경과 TTL 자동 복원 추가"
```

---

### Task 6: 다운로드와 감사 로그

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/service/WasLogAuditLogger.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/waslog/controller/WasLogController.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/waslog/controller/WasLogDownloadTest.java`

**Interfaces:**
- Consumes: `WasLogService.snapshot`, `WasLogDto.*`
- Produces:
  - `WasLogAuditLogger.logSnapshotAccess(String instanceId)`, `.logLevelChange(WasLogDto.LevelRequest)`, `.logDownload(String instanceId, int lineCount)`
  - `GET /api/admin/was-logs/download` → `text/plain` 첨부

- [ ] **Step 1: 다운로드 실패 테스트 작성**

`WasLogDownloadTest.java`:

```java
package com.kdb.it.common.admin.waslog.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import com.kdb.it.common.admin.waslog.dto.WasLogEntry;
import com.kdb.it.common.admin.waslog.service.WasLogAuditLogger;
import com.kdb.it.common.admin.waslog.service.WasLogService;
import com.kdb.it.common.system.security.JwtUtil;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WasLogController.class)
@WithMockUser(roles = "ADMIN")
class WasLogDownloadTest {

    @Autowired private MockMvc mockMvc;

    // JwtAuthenticationFilter는 @Component Filter라 @WebMvcTest가 자동 포함한다. 그 생성자 의존을 채운다.
    @MockitoBean private JwtUtil jwtUtil;

    @MockitoBean private WasLogService service;
    @MockitoBean private WasLogAuditLogger auditLogger;

    @Test
    @DisplayName("다운로드는 첨부 헤더와 로그 본문을 반환한다")
    void download_첨부응답() throws Exception {
        WasLogEntry entry =
                new WasLogEntry(1L, 1755680400000L, "ERROR", "http-1", "com.kdb.it.A", "실패", "at A.b()");
        given(service.snapshot(any(), any()))
                .willReturn(
                        new WasLogDto.Snapshot(
                                "SVR1", "e1", List.of(entry), 1L, false, List.of(), null));

        mockMvc.perform(get("/api/admin/was-logs/download").param("instanceId", "SVR1"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment; filename=\"was-log_SVR1_")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("ERROR")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("실패")))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("at A.b()")));
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.controller.WasLogDownloadTest" --no-daemon
```

Expected: 컴파일 실패 — `WasLogAuditLogger` 없음, 다운로드 엔드포인트 없음

- [ ] **Step 3: `WasLogAuditLogger` 작성**

```java
package com.kdb.it.common.admin.waslog.service;

import com.kdb.it.common.admin.waslog.dto.WasLogDto;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * WAS 로그 화면의 관리자 행위 감사 기록기.
 *
 * <p>전용 감사 테이블 대신 애플리케이션 로그로 남긴다 — 파일 appender가 12개월 보관하므로 추적 가능성이 확보되고, DDL과 DBA 절차가 필요 없다. DB
 * 적재가 필요해지면 별도 과제로 분리한다.
 */
@Component
@Slf4j
public class WasLogAuditLogger {

    /** 같은 행위자·인스턴스 조합의 조회를 다시 기록하기까지의 최소 간격(분). */
    private static final long THROTTLE_MINUTES = 10;

    /**
     * 스로틀 추적 키 상한.
     *
     * <p>키의 인스턴스ID는 검증 전 값이라 관리자가 서로 다른 문자열을 계속 보내면 맵이 무한히 자란다.
     * 상한에 닿으면 통째로 비운다 — 최악의 결과는 감사 줄이 한 번 더 남는 것뿐이라 안전한 방향이다.
     */
    private static final int MAX_TRACKED_KEYS = 1000;

    private final Map<String, LocalDateTime> lastAccessLog = new ConcurrentHashMap<>();
    private final Clock clock;

    public WasLogAuditLogger(Clock clock) {
        this.clock = clock;
    }

    /**
     * 로그 조회 진입.
     *
     * <p>조회는 3초마다 폴링되므로 매 호출을 남기면 감사 기록이 정작 보려던 로그를 뒤덮는다. 그렇다고
     * 클라이언트가 보낸 커서(`afterSeq==0`)로 first-call을 판정하면, 항상 0이 아닌 값을 보내는 호출자는
     * 흔적을 하나도 남기지 않고 로그를 다 읽어갈 수 있다. 그래서 **서버가** 행위자+인스턴스별로
     * {@value #THROTTLE_MINUTES}분에 한 번만 기록한다 — 클라이언트가 회피할 수 없다.
     */
    public void logSnapshotAccess(String instanceId) {
        String actor = actor();
        if (!shouldLogAccess(actor, instanceId)) return;
        log.warn("[WAS로그감사] 조회 actor={} instance={}", sanitize(actor), sanitize(instanceId));
    }

    /** 런타임 레벨 변경. 드물고 상태를 바꾸므로 스로틀 없이 매번 남긴다. */
    public void logLevelChange(WasLogDto.LevelRequest request) {
        log.warn(
                "[WAS로그감사] 레벨변경 actor={} instance={} logger={} level={} ttl={}분",
                sanitize(actor()),
                sanitize(request.instanceId()),
                sanitize(request.logger()),
                sanitize(request.level()),
                request.ttlMinutes());
    }

    /** 로그 파일 다운로드. 스로틀 없이 매번 남긴다. */
    public void logDownload(String instanceId, int lineCount) {
        log.warn(
                "[WAS로그감사] 다운로드 actor={} instance={} lines={}",
                sanitize(actor()),
                sanitize(instanceId),
                lineCount);
    }

    /** 스로틀 추적 중인 키 개수. 상한 동작 검증용. */
    int trackedKeyCount() {
        return lastAccessLog.size();
    }

    /** 행위자+인스턴스별 스로틀 판정. 창을 벗어났으면 기록 시각을 갱신하고 true. */
    private boolean shouldLogAccess(String actor, String instanceId) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDateTime cutoff = now.minusMinutes(THROTTLE_MINUTES);
        String key = actor + "|" + instanceId;
        LocalDateTime previous = lastAccessLog.get(key);
        if (previous != null && previous.isAfter(cutoff)) return false;
        if (lastAccessLog.size() >= MAX_TRACKED_KEYS) lastAccessLog.clear();
        lastAccessLog.put(key, now);
        return true;
    }

    /**
     * 감사 값 정화.
     *
     * <p>감사 기록은 이 기능의 유일한 보상 통제다. 값이 검증 전에 기록되는 경로가 있어, 개행이 들어가면
     * 로그 파일에 가짜 감사 줄을 심을 수 있다. 개행·캐리지리턴을 눈에 보이는 기호로 바꾼다.
     */
    private String sanitize(String value) {
        if (value == null) return null;
        return value.replace("\r", "\\r").replace("\n", "\\n");
    }

    private String actor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication == null ? "anonymous" : authentication.getName();
    }
}
```

- [ ] **Step 4: 컨트롤러에 다운로드와 감사 호출 추가**

`WasLogController`에 `private final WasLogAuditLogger auditLogger;` 필드를 추가하고, 아래 엔드포인트를 넣는다.

```java
    /**
     * 현재 필터가 적용된 버퍼 내용을 텍스트 파일로 내려받는다.
     *
     * <p>본문 형식은 파일 로그와 같은 도구로 열 수 있도록 {@code yyyy-MM-dd HH:mm:ss.SSS LEVEL [thread] logger - message}
     * 형태로 맞춘다.
     */
    @GetMapping("/download")
    @Operation(summary = "WAS 로그 다운로드", description = "현재 필터 범위를 text/plain 첨부로 반환합니다.")
    public ResponseEntity<String> download(
            @RequestParam(name = "instanceId", required = false) String instanceId,
            @RequestParam(name = "levels", required = false) String levels,
            @RequestParam(name = "logger", required = false) String logger,
            @RequestParam(name = "q", required = false) String q) {
        // 설계 §5.6은 "버퍼 전체"를 요구한다. 폴링용 상한(MAX_LIMIT=200)을 그대로 쓰면 2000건 버퍼에서
        // 최신 200건만 담긴 파일이 아무 표시 없이 내려가 관리자가 완전한 로그로 오해한다.
        WasLogDto.Snapshot snapshot =
                service.snapshot(
                        instanceId,
                        new WasLogDto.Query(
                                0L, service.exportLimit(), splitLevels(levels), logger, q));

        StringBuilder body = new StringBuilder();
        // 그래도 잘렸다면(버퍼 용량보다 필터 결과가 많을 수는 없으나 방어적으로) 파일에 사실을 적는다.
        if (snapshot.dropped()) {
            body.append("# 일부 로그가 생략되었습니다 — 버퍼에서 밀려났거나 조회 상한에 걸렸습니다.
");
        }
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS");
        for (WasLogEntry entry : snapshot.entries()) {
            body.append(
                            formatter.format(
                                    LocalDateTime.ofInstant(
                                            Instant.ofEpochMilli(entry.timestamp()),
                                            ZoneId.systemDefault())))
                    .append(' ')
                    .append(entry.level())
                    .append(" [")
                    .append(entry.thread())
                    .append("] ")
                    .append(entry.logger())
                    .append(" - ")
                    .append(entry.message())
                    .append('\n');
            if (entry.throwable() != null) {
                body.append(entry.throwable()).append('\n');
            }
        }

        String resolvedInstance = snapshot.instanceId() == null ? "unknown" : snapshot.instanceId();
        String fileName =
                "was-log_"
                        + resolvedInstance
                        + "_"
                        + DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")
                                .format(LocalDateTime.now(clock))
                        + ".log";
        auditLogger.logDownload(resolvedInstance, snapshot.entries().size());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8))
                .body(body.toString());
    }
```

`WasLogController`에 `private final Clock clock;` 필드도 추가한다(`@RequiredArgsConstructor`이므로 선언만 하면 된다). 파일명 시각을 `LocalDateTime.now()` 직접 호출로 두면 테스트가 시각을 고정할 수 없고, 같은 기능의 `LevelOverrideService`가 이미 주입된 `Clock`을 쓴다.

import 추가: `com.kdb.it.common.admin.waslog.dto.WasLogEntry`, `com.kdb.it.common.admin.waslog.service.WasLogAuditLogger`, `java.nio.charset.StandardCharsets`, `java.time.Clock`, `java.time.Instant`, `java.time.LocalDateTime`, `java.time.ZoneId`, `java.time.format.DateTimeFormatter`, `org.springframework.http.HttpHeaders`, `org.springframework.http.MediaType`, `org.springframework.http.ResponseEntity`.

폴링 엔드포인트는 컨트롤러가 상한을 조인다 — `snapshot` 메서드에서 Query를 만들 때 `Math.min(limit, WasLogService.MAX_LIMIT)`를 적용한다. 서비스 상한이 버퍼 용량으로 올라갔으므로 이 조임이 없으면 화면이 한 번에 2000건을 받을 수 있다.

- [ ] **Step 5: 조회·레벨변경에도 감사 호출 추가**

`WasLogController.snapshot` 본문 첫 줄에 추가한다. 폭주 억제는 `WasLogAuditLogger`가 행위자+인스턴스별
10분 스로틀로 처리하므로 컨트롤러는 조건 없이 부른다 — 클라이언트가 보낸 커서로 판정하면 항상 0이 아닌
값을 보내는 호출자가 감사를 통째로 회피한다.

```java
        auditLogger.logSnapshotAccess(instanceId);
```

`WasLogController.applyLevel` 본문 첫 줄에 추가한다. 레벨 변경은 드물고 상태를 바꾸므로 매번 남긴다.

```java
        auditLogger.logLevelChange(request);
```

- [ ] **Step 6: 기존 컨트롤러 테스트에 mock 추가**

`WasLogController`를 슬라이스로 올리는 **모든** 테스트 클래스에 `@MockitoBean private WasLogAuditLogger auditLogger;`를 추가한다 — 추가하지 않으면 컨텍스트 로딩이 실패한다. 현재 대상은 `WasLogControllerTest`, `WasLogControllerAuthorizationTest`, `WasLogSecurityBoundaryTest` 셋이다(Task 3·4에서 늘었다). 실제 목록은 다음으로 확인한다.

```bash
cd C:/it/it_backend && grep -rln "WebMvcTest" src/test/java/com/kdb/it/common/admin/waslog
```

- [ ] **Step 7: 감사 배선과 다운로드 완전성 테스트 추가**

감사 호출은 이 기능의 유일한 보상 통제인데, 컨트롤러가 실제로 부르는지 검증하는 테스트가 없으면 호출을
지워도 스위트가 초록이다. 다운로드 완전성도 같다.

`WasLogDownloadTest.java`에 추가:

```java
    @Test
    @DisplayName("다운로드는 폴링 상한이 아니라 버퍼 전체를 요청한다")
    void download_버퍼전체요청() throws Exception {
        given(service.exportLimit()).willReturn(2000);
        given(service.snapshot(any(), any()))
                .willReturn(new WasLogDto.Snapshot("SVR1", "e1", List.of(), 0L, false, List.of(), null));

        mockMvc.perform(get("/api/admin/was-logs/download")).andExpect(status().isOk());

        ArgumentCaptor<WasLogDto.Query> captor = ArgumentCaptor.forClass(WasLogDto.Query.class);
        verify(service).snapshot(any(), captor.capture());
        assertThat(captor.getValue().limit()).isEqualTo(2000);
    }

    @Test
    @DisplayName("다운로드는 감사 기록을 남기고 text/plain으로 응답한다")
    void download_감사기록_컨텐츠타입() throws Exception {
        given(service.exportLimit()).willReturn(2000);
        given(service.snapshot(any(), any()))
                .willReturn(new WasLogDto.Snapshot("SVR1", "e1", List.of(), 0L, false, List.of(), null));

        mockMvc.perform(get("/api/admin/was-logs/download").param("instanceId", "SVR1"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_PLAIN));

        verify(auditLogger).logDownload("SVR1", 0);
    }

    @Test
    @DisplayName("잘린 응답이면 파일 첫 줄에 생략 사실을 적는다")
    void download_생략표시() throws Exception {
        given(service.exportLimit()).willReturn(2000);
        given(service.snapshot(any(), any()))
                .willReturn(new WasLogDto.Snapshot("SVR1", "e1", List.of(), 0L, true, List.of(), null));

        mockMvc.perform(get("/api/admin/was-logs/download"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("일부 로그가 생략")));
    }
```

`WasLogControllerTest.java`에 추가:

```java
    @Test
    @DisplayName("레벨 변경은 감사기를 호출한다")
    void applyLevel_감사호출() throws Exception {
        given(service.applyLevel(any()))
                .willReturn(
                        new WasLogDto.LevelOverride(
                                "com.kdb.it.domain",
                                "DEBUG",
                                "INFO",
                                java.time.LocalDateTime.of(2026, 8, 20, 11, 0)));

        mockMvc.perform(
                        post("/api/admin/was-logs/level")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                        {"instanceId":"SVR1","logger":"com.kdb.it.domain",
                                         "level":"DEBUG","ttlMinutes":30}
                                        """))
                .andExpect(status().isOk());

        ArgumentCaptor<WasLogDto.LevelRequest> captor =
                ArgumentCaptor.forClass(WasLogDto.LevelRequest.class);
        verify(auditLogger).logLevelChange(captor.capture());
        assertThat(captor.getValue().logger()).isEqualTo("com.kdb.it.domain");
        assertThat(captor.getValue().ttlMinutes()).isEqualTo(30);
    }

    @Test
    @DisplayName("조회는 커서 값과 무관하게 감사기를 호출한다 — 폭주 억제는 감사기가 한다")
    void snapshot_감사호출() throws Exception {
        given(service.snapshot(any(), any()))
                .willReturn(new WasLogDto.Snapshot("SVR1", "e1", List.of(), 0L, false, List.of(), null));

        mockMvc.perform(get("/api/admin/was-logs").param("afterSeq", "42"))
                .andExpect(status().isOk());

        verify(auditLogger).logSnapshotAccess(null);
    }
```

`WasLogAuditLoggerTest.java`에 추가:

```java
    @Test
    @DisplayName("같은 행위자·인스턴스의 연속 조회는 한 번만 기록한다")
    void logSnapshotAccess_스로틀() {
        logger.logSnapshotAccess("SVR1");
        logger.logSnapshotAccess("SVR1");
        logger.logSnapshotAccess("SVR1");

        assertThat(appender.list).hasSize(1);
    }

    @Test
    @DisplayName("다른 인스턴스는 따로 기록한다")
    void logSnapshotAccess_인스턴스별() {
        logger.logSnapshotAccess("SVR1");
        logger.logSnapshotAccess("SVR2");

        assertThat(appender.list).hasSize(2);
    }

    @Test
    @DisplayName("서로 다른 인스턴스ID를 계속 보내도 추적 맵이 무한히 자라지 않는다")
    void logSnapshotAccess_추적맵상한() {
        for (int i = 0; i < 1500; i++) {
            logger.logSnapshotAccess("SVR" + i);
        }

        // 상한에 닿으면 비우므로 기록은 남되 맵 크기는 상한 아래로 유지된다.
        assertThat(appender.list).hasSize(1500);
        assertThat(logger.trackedKeyCount()).isLessThan(1000);
    }

    @Test
    @DisplayName("개행이 든 값은 가짜 감사 줄을 만들지 못하게 이스케이프한다")
    void 감사값_개행이스케이프() {
        logger.logDownload("SVR1
[WAS로그감사] 조회 actor=victim", 0);

        assertThat(appender.list.getFirst().getFormattedMessage()).doesNotContain("
");
    }
```

기존 `WasLogAuditLoggerTest`는 고정 `Clock`으로 `WasLogAuditLogger`를 만들어야 스로틀이 결정적으로 동작한다.
`Clock.fixed(...)`를 주입하고, 필요한 import(`java.time.Clock`, `java.time.Instant`, `java.time.ZoneId`,
`org.mockito.ArgumentCaptor`, `static org.mockito.Mockito.verify`, `MockMvcResultMatchers.content`)를 각 파일에 맞춰 추가한다.

- [ ] **Step 8: 테스트 통과 확인**

```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.common.admin.waslog.*" --no-daemon
```

Expected: PASS

- [ ] **Step 9: 포맷 적용 후 커밋**

```bash
cd C:/it/it_backend && ./gradlew spotlessApply --no-daemon
```

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/common/admin/waslog src/test/java/com/kdb/it/common/admin/waslog && git diff --cached --stat && git commit -m "feat: WAS 로그 다운로드와 관리자 행위 감사 로그 추가"
```

---

### Task 7: 프론트 타입과 폴링 composable

**Files:**
- Create: `it_frontend/app/types/wasLog.ts`
- Create: `it_frontend/app/composables/useWasLogFeed.ts`
- Test: `it_frontend/tests/unit/composables/useWasLogFeed.test.ts`

**Interfaces:**
- Consumes: `GET /api/admin/was-logs`, `GET /api/admin/was-logs/instances`(Task 3)
- Produces:
  - `WasLogEntry`, `WasLogSnapshot`, `WasLogInstance`, `WasLogLevel`, `WasLogFilters` 타입
  - `useWasLogFeed()` → `{ rows, instances, instanceId, filters, levelOverrides, paused, loading, error, peerError, dropped, restarted, start, stop, tick, fetchOnce, resetCursor, dismissRestarted, loadInstances }`

- [ ] **Step 1: 타입 작성**

`app/types/wasLog.ts`:

```typescript
/**
 * ============================================================================
 * [types/wasLog.ts] 실시간 WAS 로그 조회 타입
 * ============================================================================
 * 백엔드 `/api/admin/was-logs` 응답 계약과 1:1 대응한다.
 * ============================================================================
 */

/** 로그 레벨. 백엔드 ALLOWED_LEVELS와 같은 집합. */
export type WasLogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';

/** 로그 한 줄. */
export interface WasLogEntry {
    seq: number;
    timestamp: number;
    level: WasLogLevel;
    thread: string;
    logger: string;
    message: string;
    throwable: string | null;
}

/** 런타임 레벨 변경 현황. */
export interface WasLogLevelOverride {
    logger: string;
    level: WasLogLevel;
    previousLevel: WasLogLevel | null;
    expiresAt: string;
}

/** 조회 응답. */
export interface WasLogSnapshot {
    instanceId: string;
    bufferEpoch: string | null;
    entries: WasLogEntry[];
    lastSeq: number;
    dropped: boolean;
    levelOverrides: WasLogLevelOverride[];
    peerError: string | null;
}

/** 인스턴스 정보. */
export interface WasLogInstance {
    id: string;
    self: boolean;
    reachable: boolean;
}

/** 화면 필터. */
export interface WasLogFilters {
    levels: WasLogLevel[];
    logger: string;
    keyword: string;
}
```

- [ ] **Step 2: composable 실패 테스트 작성**

`tests/unit/composables/useWasLogFeed.test.ts`:

```typescript
/**
 * ============================================================================
 * [tests/unit/composables/useWasLogFeed.test.ts]
 * ============================================================================
 * WAS 로그 폴링 composable의 커서·일시정지·버퍼 세대 변경 계약 검증.
 * ============================================================================
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import type { WasLogSnapshot } from '~/types/wasLog';
import { useWasLogFeed } from '~/composables/useWasLogFeed';

const apiFetch = vi.fn();

vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: '' } }));
vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: apiFetch }));

function snapshot(partial: Partial<WasLogSnapshot> = {}): WasLogSnapshot {
    return {
        instanceId: 'SVR1',
        bufferEpoch: 'epoch-1',
        entries: [],
        lastSeq: 0,
        dropped: false,
        levelOverrides: [],
        peerError: null,
        ...partial,
    };
}

function entry(seq: number) {
    return {
        seq,
        timestamp: 1755680400000 + seq,
        level: 'INFO' as const,
        thread: 'main',
        logger: 'com.kdb.it.A',
        message: `메시지 ${seq}`,
        throwable: null,
    };
}

describe('useWasLogFeed', () => {
    beforeEach(() => {
        apiFetch.mockReset();
    });

    it('응답의 lastSeq를 다음 요청의 afterSeq로 보낸다', async () => {
        apiFetch
            .mockResolvedValueOnce(snapshot({ entries: [entry(1), entry(2)], lastSeq: 2 }))
            .mockResolvedValueOnce(snapshot({ entries: [entry(3)], lastSeq: 3 }));

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.fetchOnce();
            await feed.fetchOnce();

            expect(apiFetch.mock.calls[0]![1].query.afterSeq).toBe(0);
            expect(apiFetch.mock.calls[1]![1].query.afterSeq).toBe(2);
            expect(feed.rows.value.map((r) => r.seq)).toEqual([1, 2, 3]);
        });
        scope.stop();
    });

    it('일시정지 상태에서는 폴링 tick이 호출하지 않는다', async () => {
        apiFetch.mockResolvedValue(snapshot());

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            feed.paused.value = true;
            feed.tick();

            expect(apiFetch).not.toHaveBeenCalled();
        });
        scope.stop();
    });

    it('bufferEpoch가 바뀌면 목록과 커서를 초기화하고 restarted를 세운다', async () => {
        apiFetch
            .mockResolvedValueOnce(
                snapshot({ entries: [entry(1)], lastSeq: 1, bufferEpoch: 'epoch-1' }),
            )
            .mockResolvedValueOnce(
                snapshot({ entries: [entry(1)], lastSeq: 1, bufferEpoch: 'epoch-2' }),
            );

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.fetchOnce();
            await feed.fetchOnce();

            expect(feed.restarted.value).toBe(true);
            expect(feed.rows.value.map((r) => r.seq)).toEqual([1]);
        });
        scope.stop();
    });

    it('peerError를 그대로 노출하고 목록·커서를 건드리지 않는다', async () => {
        apiFetch
            .mockResolvedValueOnce(snapshot({ entries: [entry(1)], lastSeq: 1 }))
            .mockResolvedValueOnce(
                snapshot({
                    peerError: 'SVR2 인스턴스 조회 실패: timeout',
                    bufferEpoch: null,
                    lastSeq: 0,
                }),
            )
            .mockResolvedValueOnce(snapshot({ entries: [entry(2)], lastSeq: 2 }));

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.fetchOnce();
            await feed.fetchOnce();

            expect(feed.peerError.value).toContain('timeout');
            expect(feed.rows.value).toHaveLength(1);
            // 실패 응답의 bufferEpoch=null·lastSeq=0을 반영하지 않았는지 — 다음 요청이 커서 1을 쓰고
            // 재기동으로 오인해 목록을 비우지 않아야 한다.
            await feed.fetchOnce();
            expect(apiFetch.mock.calls[2]![1].query.afterSeq).toBe(1);
            expect(feed.restarted.value).toBe(false);
            expect(feed.rows.value.map((r) => r.seq)).toEqual([1, 2]);
            expect(feed.peerError.value).toBeNull();
        });
        scope.stop();
    });

    it('보관 상한을 넘으면 오래된 행부터 버린다', async () => {
        const many = Array.from({ length: 2500 }, (_, i) => entry(i + 1));
        apiFetch.mockResolvedValueOnce(snapshot({ entries: many, lastSeq: 2500 }));

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.fetchOnce();

            expect(feed.rows.value).toHaveLength(2000);
            // 최신이 남고 오래된 쪽이 잘려야 한다.
            expect(feed.rows.value[0]!.seq).toBe(501);
            expect(feed.rows.value.at(-1)!.seq).toBe(2500);
        });
        scope.stop();
    });

    it('조회 실패는 커서·목록을 건드리지 않고 다음 성공에서 지워진다', async () => {
        apiFetch
            .mockResolvedValueOnce(snapshot({ entries: [entry(1)], lastSeq: 1 }))
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce(snapshot({ entries: [entry(2)], lastSeq: 2 }));

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.fetchOnce();
            await feed.fetchOnce();

            expect(feed.error.value).toBeInstanceOf(Error);
            expect(feed.rows.value).toHaveLength(1);

            await feed.fetchOnce();
            expect(feed.error.value).toBeNull();
            expect(apiFetch.mock.calls[2]![1].query.afterSeq).toBe(1);
            expect(feed.rows.value.map((r) => r.seq)).toEqual([1, 2]);
        });
        scope.stop();
    });

    it('dropped와 levelOverrides를 응답 그대로 반영한다', async () => {
        apiFetch.mockResolvedValueOnce(
            snapshot({
                dropped: true,
                levelOverrides: [
                    {
                        logger: 'com.kdb.it',
                        level: 'DEBUG',
                        previousLevel: 'INFO',
                        expiresAt: '2026-08-20T11:00:00',
                    },
                ],
            }),
        );

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.fetchOnce();

            expect(feed.dropped.value).toBe(true);
            expect(feed.levelOverrides.value).toHaveLength(1);
        });
        scope.stop();
    });

    it('인스턴스 목록은 self를 기본 선택한다', async () => {
        apiFetch.mockResolvedValueOnce([
            { id: 'SVR2', self: false, reachable: true },
            { id: 'SVR1', self: true, reachable: true },
        ]);

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.loadInstances();

            expect(feed.instanceId.value).toBe('SVR1');
        });
        scope.stop();
    });

    it('resetCursor는 레벨 오버라이드와 오류 배너까지 지운다', async () => {
        apiFetch
            .mockResolvedValueOnce(
                snapshot({
                    entries: [entry(1)],
                    lastSeq: 1,
                    levelOverrides: [
                        {
                            logger: 'com.kdb.it',
                            level: 'DEBUG',
                            previousLevel: 'INFO',
                            expiresAt: '2026-08-20T11:00:00',
                        },
                    ],
                }),
            )
            .mockResolvedValueOnce(snapshot({ peerError: 'SVR2 인스턴스 조회 실패: timeout' }));

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.fetchOnce();
            await feed.fetchOnce();
            expect(feed.levelOverrides.value).toHaveLength(1);
            expect(feed.peerError.value).not.toBeNull();

            feed.resetCursor();

            expect(feed.levelOverrides.value).toHaveLength(0);
            expect(feed.peerError.value).toBeNull();
            expect(feed.rows.value).toHaveLength(0);
        });
        scope.stop();
    });

    it('세대가 바뀐 뒤 도착한 응답은 반영하지 않는다', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        apiFetch
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveFirst = resolve;
                    }),
            )
            .mockResolvedValueOnce(snapshot({ entries: [entry(9)], lastSeq: 9 }));

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            const pending = feed.fetchOnce();

            // 응답이 도착하기 전에 인스턴스를 바꾼다.
            feed.resetCursor();
            resolveFirst(snapshot({ entries: [entry(1)], lastSeq: 1 }));
            await pending;

            expect(feed.rows.value).toHaveLength(0);

            await feed.fetchOnce();
            expect(apiFetch.mock.calls[1]![1].query.afterSeq).toBe(0);
            expect(feed.rows.value.map((r) => r.seq)).toEqual([9]);
        });
        scope.stop();
    });

    it('필터를 바꾸면 커서와 목록을 비운다', async () => {
        apiFetch.mockResolvedValue(snapshot({ entries: [entry(1)], lastSeq: 1 }));

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.fetchOnce();
            feed.resetCursor();

            expect(feed.rows.value).toHaveLength(0);

            await feed.fetchOnce();
            expect(apiFetch.mock.calls[1]![1].query.afterSeq).toBe(0);
        });
        scope.stop();
    });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useWasLogFeed.test.ts
```

Expected: FAIL — `~/composables/useWasLogFeed` 모듈 없음

- [ ] **Step 4: composable 작성**

`app/composables/useWasLogFeed.ts`:

```typescript
/**
 * ============================================================================
 * [composables/useWasLogFeed.ts] 실시간 WAS 로그 폴링 컴포저블
 * ============================================================================
 * - 3초 주기로 GET /api/admin/was-logs 호출, 응답 lastSeq를 다음 afterSeq로 사용.
 * - 신규 행은 append, 2000줄 초과 시 앞에서 버린다(시간 오름차순 유지).
 * - paused 또는 document.visibilityState === 'hidden'이면 tick을 건너뛴다.
 * - bufferEpoch가 바뀌면 서버 재기동이므로 커서·목록을 초기화한다.
 * - peerError·dropped는 지우지 않고 그대로 노출해 화면이 배너·배지로 표면화한다.
 * ============================================================================
 */
import { ref, shallowRef } from 'vue';
import type {
    WasLogEntry,
    WasLogFilters,
    WasLogInstance,
    WasLogLevelOverride,
    WasLogSnapshot,
} from '~/types/wasLog';

/** 폴링 주기(ms). */
const POLL_INTERVAL_MS = 3000;

/** 프론트 보관 상한(줄). */
const MAX_ROWS = 2000;

/**
 * WAS 로그 폴링 composable.
 *
 * 실패 처리: fetch 실패는 error ref에 담고 다음 tick에 재시도한다. 호출자가 배너·토스트를 결정한다.
 */
export function useWasLogFeed() {
    const { $apiFetch } = useNuxtApp() as { $apiFetch: typeof $fetch };
    const config = useRuntimeConfig();
    const API_URL = `${config.public.apiBase}/api/admin/was-logs`;

    const rows = shallowRef<WasLogEntry[]>([]);
    const instances = ref<WasLogInstance[]>([]);
    const instanceId = ref<string | null>(null);
    const filters = ref<WasLogFilters>({ levels: [], logger: '', keyword: '' });
    const levelOverrides = ref<WasLogLevelOverride[]>([]);
    const paused = ref(false);
    const loading = ref(false);
    const error = ref<unknown>(null);
    const peerError = ref<string | null>(null);
    const dropped = ref(false);
    const restarted = ref(false);

    let timer: ReturnType<typeof setInterval> | null = null;
    let cursor = 0;
    let epoch: string | null = null;
    /**
     * 진행 중인 조회의 세대. 없으면 null.
     *
     * <p>같은 세대의 중복 호출(수동 새로고침 + 타이머 tick)만 막는다. 인스턴스·필터를 바꿔 세대가 올라간
     * 직후의 호출은 통과시켜야 한다 — 막으면 `resetCursor`가 목록을 비운 뒤 다음 tick까지 최대 3초간
     * 빈 화면이 남는다. 앞선 세대의 응답은 어차피 세대 비교에서 버려지므로 겹쳐도 안전하다.
     */
    let inFlightGeneration: number | null = null;
    /**
     * 조회 세대. resetCursor·stop이 증가시킨다.
     *
     * <p>인스턴스를 바꾼 직후 도착한 이전 인스턴스의 응답이 새 커서·목록을 덮어쓰지 못하게 한다.
     */
    let generation = 0;

    /**
     * 커서와 화면 상태를 비운다. 인스턴스·필터 변경 시 호출한다.
     *
     * <p>레벨 오버라이드와 오류도 함께 지운다 — 남겨두면 이전 인스턴스의 값이 새 인스턴스의 것처럼 보인다.
     */
    function resetCursor(): void {
        generation += 1;
        cursor = 0;
        epoch = null;
        rows.value = [];
        levelOverrides.value = [];
        dropped.value = false;
        restarted.value = false;
        peerError.value = null;
        error.value = null;
    }

    /** 재기동 안내를 닫는다. 사용자가 확인하기 전까지 배너를 유지하기 위해 자동으로 지우지 않는다. */
    function dismissRestarted(): void {
        restarted.value = false;
    }

    /** 1회 조회. 같은 세대의 조회가 이미 진행 중이면 아무것도 하지 않는다. */
    async function fetchOnce(): Promise<void> {
        if (inFlightGeneration === generation) return;
        const myGeneration = generation;
        inFlightGeneration = myGeneration;
        loading.value = true;
        try {
            const snapshot = await $apiFetch<WasLogSnapshot>(API_URL, {
                query: {
                    instanceId: instanceId.value ?? undefined,
                    afterSeq: cursor,
                    limit: 200,
                    levels: filters.value.levels.length
                        ? filters.value.levels.join(',')
                        : undefined,
                    logger: filters.value.logger || undefined,
                    q: filters.value.keyword || undefined,
                },
            });

            // 인스턴스·필터가 바뀐 뒤 도착한 응답은 이미 남의 것이다. 반영하면 커서가 되살아난다.
            if (myGeneration !== generation) return;

            // 피어 위임이 실패한 응답은 메타 필드가 비어 있다(bufferEpoch=null, lastSeq=보낸 커서,
            // levelOverrides=[]). 그대로 반영하면 epoch이 두 번 바뀐 것처럼 보여 목록이 중복되고,
            // 살아 있는 임시 로그레벨이 화면에서 사라진다. 배너만 띄우고 나머지는 건드리지 않는다.
            if (snapshot.peerError !== null) {
                peerError.value = snapshot.peerError;
                error.value = null;
                return;
            }

            if (epoch !== null && snapshot.bufferEpoch !== null && snapshot.bufferEpoch !== epoch) {
                // 서버 재기동 — seq가 리셋되므로 이전 커서와 목록은 의미가 없다.
                cursor = 0;
                rows.value = [];
                restarted.value = true;
            }
            if (snapshot.bufferEpoch !== null) epoch = snapshot.bufferEpoch;

            if (snapshot.entries.length > 0) {
                const merged = [...rows.value, ...snapshot.entries];
                rows.value =
                    merged.length > MAX_ROWS ? merged.slice(merged.length - MAX_ROWS) : merged;
            }
            cursor = snapshot.lastSeq;
            levelOverrides.value = snapshot.levelOverrides;
            peerError.value = null;
            dropped.value = snapshot.dropped;
            error.value = null;
        } catch (e) {
            if (myGeneration === generation) error.value = e;
        } finally {
            if (inFlightGeneration === myGeneration) inFlightGeneration = null;
            loading.value = false;
        }
    }

    /** 인스턴스 목록을 불러온다. 첫 항목(self 우선)을 기본 선택한다. */
    async function loadInstances(): Promise<void> {
        try {
            const list = await $apiFetch<WasLogInstance[]>(`${API_URL}/instances`);
            instances.value = list;
            if (instanceId.value === null) {
                instanceId.value = (list.find((i) => i.self) ?? list[0])?.id ?? null;
            }
        } catch (e) {
            error.value = e;
        }
    }

    /** 폴링 1틱. 일시정지·비활성 탭이면 건너뛴다. */
    function tick(): void {
        if (paused.value) return;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
        void fetchOnce();
    }

    function stopTimer(): void {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    }

    function onVisibilityChange(): void {
        if (document.visibilityState === 'visible' && !paused.value) void fetchOnce();
    }

    /** 인스턴스 목록 조회 후 폴링을 시작한다. */
    async function start(): Promise<void> {
        await loadInstances();
        await fetchOnce();
        stopTimer();
        timer = setInterval(tick, POLL_INTERVAL_MS);
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', onVisibilityChange);
        }
    }

    /** 폴링을 멈춘다. 진행 중이던 응답은 도착해도 반영하지 않는다. */
    function stop(): void {
        generation += 1;
        stopTimer();
        if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        }
    }

    return {
        rows,
        instances,
        instanceId,
        filters,
        levelOverrides,
        paused,
        loading,
        error,
        peerError,
        dropped,
        restarted,
        start,
        stop,
        tick,
        fetchOnce,
        resetCursor,
        dismissRestarted,
        loadInstances,
    };
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useWasLogFeed.test.ts
```

Expected: PASS (5건)

- [ ] **Step 6: 타입체크와 포맷 확인**

```bash
cd C:/it/it_frontend && npm run typecheck && npm run format:check
```

- [ ] **Step 7: 커밋**

```bash
cd C:/it/it_frontend && git add app/types/wasLog.ts app/composables/useWasLogFeed.ts tests/unit/composables/useWasLogFeed.test.ts && git diff --cached --stat && git commit -m "feat: WAS 로그 폴링 composable과 타입 추가"
```

---

### Task 8: 화면 컴포넌트와 페이지

> **i18n 호출 규약**: 이 코드베이스의 컴포넌트는 템플릿에서 `$t(...)`를 쓰지 않는다. `<script setup>`에서
> `const { t } = useI18n();`을 선언하고 템플릿에서 `t(...)`를 부른다. 전역 `$t`는 타입 선언이 없어
> `npm run typecheck`가 깨진다. 아래 컴포넌트 네 개와 페이지 모두 이 선언을 포함한다.

**Files:**
- Create: `it_frontend/app/components/admin/waslog/WasLogToolbar.vue`
- Create: `it_frontend/app/components/admin/waslog/WasLogTable.vue`
- Create: `it_frontend/app/components/admin/waslog/WasLogDetailPanel.vue`
- Create: `it_frontend/app/components/admin/waslog/WasLogLevelDialog.vue`
- Create: `it_frontend/app/pages/admin/was-logs.vue`
- Modify: `it_frontend/i18n/messages/admin.ts`
- Test: `it_frontend/tests/unit/components/admin/WasLogTable.test.ts`
- Test: `it_frontend/tests/unit/components/admin/WasLogToolbar.test.ts`

**Interfaces:**
- Consumes: `useWasLogFeed()`, `WasLogEntry`, `WasLogFilters`, `WasLogInstance`, `WasLogLevelOverride`(Task 7)
- Produces:
  - `WasLogTable` props `{ rows: WasLogEntry[]; selectedSeq: number | null }`, emit `select(entry: WasLogEntry)`
  - `WasLogToolbar` props `{ instances, instanceId, filters, paused, levelOverrides }`, emits `update:instanceId`, `update:filters`, `update:paused`, `download`, `openLevelDialog`
  - `WasLogDetailPanel` props `{ entry: WasLogEntry | null }`
  - `WasLogLevelDialog` props `{ visible, instanceId }`, emits `update:visible`, `applied`

- [ ] **Step 1: i18n 키 추가**

`i18n/messages/admin.ts`의 `admin` 객체 안에 `wasLogs` 블록을 추가한다(한국어 원문과 영어 번역 쌍 구조는 파일의 기존 도메인 키를 그대로 따른다).

```typescript
            wasLogs: {
                title: 'WAS 로그',
                instance: '인스턴스',
                level: '레벨',
                logger: '로거',
                loggerPlaceholder: '예: com.kdb.it',
                keyword: '검색어',
                keywordPlaceholder: '메시지·로거 부분일치',
                pause: '일시정지',
                resume: '재개',
                download: '다운로드',
                changeLevel: '로그레벨 변경',
                stackTrace: '스택트레이스',
                empty: '표시할 로그가 없습니다.',
                dropped: '일부 로그를 건너뛰었습니다. 버퍼에서 밀려났거나 한 번에 표시할 수 있는 양을 넘었습니다.',
                restarted: '서버가 재기동되어 이전 로그가 사라졌습니다.',
                peerErrorPrefix: '다른 인스턴스 조회에 실패했습니다',
                overrideActive: '적용 중인 임시 로그레벨',
                overrideExpires: '{time}에 자동 복원',
                dialog: {
                    title: '로그레벨 임시 변경',
                    ttl: '유지 시간(분)',
                    ttlHint: '1~120분. 시간이 지나면 원래 레벨로 자동 복원됩니다.',
                    apply: '적용',
                    cancel: '취소',
                    applied: '로그레벨을 변경했습니다.',
                    failed: '로그레벨 변경에 실패했습니다.',
                },
            },
```

- [ ] **Step 2: 목록 컴포넌트 실패 테스트 작성**

`tests/unit/components/admin/WasLogTable.test.ts`:

```typescript
/**
 * ============================================================================
 * [tests/unit/components/admin/WasLogTable.test.ts]
 * ============================================================================
 * 레벨 태그 렌더와 예외 행에만 펼침 아이콘이 보이는지 검증한다.
 * ============================================================================
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import WasLogTable from '~/components/admin/waslog/WasLogTable.vue';
import type { WasLogEntry } from '~/types/wasLog';

const rows: WasLogEntry[] = [
    {
        seq: 1,
        timestamp: 1755680400000,
        level: 'INFO',
        thread: 'main',
        logger: 'com.kdb.it.A',
        message: '정상',
        throwable: null,
    },
    {
        seq: 2,
        timestamp: 1755680401000,
        level: 'ERROR',
        thread: 'http-1',
        logger: 'com.kdb.it.B',
        message: '실패',
        throwable: 'java.lang.IllegalStateException',
    },
];

describe('WasLogTable', () => {
    it('행마다 레벨을 렌더한다', () => {
        const wrapper = mount(WasLogTable, {
            props: { rows, selectedSeq: null },
            global: { stubs: { Tag: { template: '<span class="tag"><slot />{{ value }}</span>', props: ['value'] } } },
        });

        expect(wrapper.text()).toContain('INFO');
        expect(wrapper.text()).toContain('ERROR');
    });

    it('예외가 있는 행에만 펼침 버튼을 노출한다', () => {
        const wrapper = mount(WasLogTable, {
            props: { rows, selectedSeq: null },
            global: { stubs: { Tag: true } },
        });

        expect(wrapper.findAll('[data-test="expand"]')).toHaveLength(1);
    });

    it('행을 클릭하면 select를 emit한다', async () => {
        const wrapper = mount(WasLogTable, {
            props: { rows, selectedSeq: null },
            global: { stubs: { Tag: true } },
        });

        await wrapper.findAll('[data-test="row"]')[1]!.trigger('click');

        expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ seq: 2 });
    });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/admin/WasLogTable.test.ts
```

Expected: FAIL — 컴포넌트 없음

- [ ] **Step 4: `WasLogTable.vue` 작성**

```vue
<script setup lang="ts">
/**
 * WAS 로그 목록.
 *
 * 행 클릭으로 상세를 선택하고, 예외가 있는 행에만 펼침 표시를 낸다.
 * 대량 행을 다루므로 시각 포맷은 렌더 시점에 계산한다.
 */
import Tag from 'primevue/tag';
import type { WasLogEntry, WasLogLevel } from '~/types/wasLog';

const props = defineProps<{
    rows: WasLogEntry[];
    selectedSeq: number | null;
}>();

const emit = defineEmits<{
    select: [entry: WasLogEntry];
}>();

/** 레벨별 PrimeVue Tag severity. */
function severityOf(level: WasLogLevel): string {
    if (level === 'ERROR') return 'danger';
    if (level === 'WARN') return 'warn';
    if (level === 'DEBUG' || level === 'TRACE') return 'secondary';
    return 'info';
}

/** epoch millis → HH:mm:ss.SSS */
function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const pad = (n: number, size = 2) => String(n).padStart(size, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}
</script>

<template>
    <div class="was-log-table">
        <p v-if="props.rows.length === 0" class="was-log-table__empty">
            {{ t('admin.wasLogs.empty') }}
        </p>
        <ul v-else class="was-log-table__list">
            <li
                v-for="row in props.rows"
                :key="row.seq"
                data-test="row"
                class="was-log-table__row"
                :class="{ 'was-log-table__row--selected': row.seq === props.selectedSeq }"
                @click="emit('select', row)"
            >
                <span class="was-log-table__time">{{ formatTime(row.timestamp) }}</span>
                <Tag :value="row.level" :severity="severityOf(row.level)" />
                <span class="was-log-table__thread">[{{ row.thread }}]</span>
                <span class="was-log-table__logger">{{ row.logger }}</span>
                <span class="was-log-table__message">{{ row.message }}</span>
                <i v-if="row.throwable" data-test="expand" class="pi pi-angle-down" />
            </li>
        </ul>
    </div>
</template>

<style scoped>
.was-log-table__list {
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 0.8125rem;
}

.was-log-table__row {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    padding: 0.125rem 0.5rem;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.was-log-table__row:hover,
.was-log-table__row--selected {
    background: var(--p-surface-100);
}

.was-log-table__message {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
}

.was-log-table__empty {
    padding: 2rem;
    text-align: center;
    color: var(--p-text-muted-color);
}
</style>
```

- [ ] **Step 5: 목록 테스트 통과 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/admin/WasLogTable.test.ts
```

Expected: PASS (3건)

- [ ] **Step 6: `WasLogDetailPanel.vue` 작성**

```vue
<script setup lang="ts">
/** 선택한 로그의 전체 메시지와 스택트레이스. 선택이 없으면 렌더하지 않는다. */
import type { WasLogEntry } from '~/types/wasLog';

const props = defineProps<{ entry: WasLogEntry | null }>();
</script>

<template>
    <section v-if="props.entry" class="was-log-detail">
        <h3 class="was-log-detail__title">{{ props.entry.logger }}</h3>
        <p class="was-log-detail__message">{{ props.entry.message }}</p>
        <template v-if="props.entry.throwable">
            <h4 class="was-log-detail__subtitle">{{ t('admin.wasLogs.stackTrace') }}</h4>
            <pre class="was-log-detail__stack">{{ props.entry.throwable }}</pre>
        </template>
    </section>
</template>

<style scoped>
.was-log-detail {
    padding: 1rem;
    border-top: 1px solid var(--p-content-border-color);
}

.was-log-detail__stack {
    margin: 0;
    max-height: 20rem;
    overflow: auto;
    font-size: 0.75rem;
    white-space: pre-wrap;
}
</style>
```

- [ ] **Step 7: `WasLogToolbar.vue` 작성**

```vue
<script setup lang="ts">
/**
 * WAS 로그 화면 도구모음.
 *
 * 인스턴스 선택·레벨 체크박스·로거·키워드 입력·일시정지·다운로드·레벨변경 진입을 담당한다.
 * 필터 변경은 부모가 커서를 초기화해야 하므로 v-model로 올려보낸다.
 */
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import ToggleButton from 'primevue/togglebutton';
import MultiSelect from 'primevue/multiselect';
import Message from 'primevue/message';
import type { WasLogFilters, WasLogInstance, WasLogLevel, WasLogLevelOverride } from '~/types/wasLog';

const props = defineProps<{
    instances: WasLogInstance[];
    instanceId: string | null;
    filters: WasLogFilters;
    paused: boolean;
    levelOverrides: WasLogLevelOverride[];
}>();

const emit = defineEmits<{
    'update:instanceId': [value: string | null];
    'update:filters': [value: WasLogFilters];
    'update:paused': [value: boolean];
    download: [];
    openLevelDialog: [];
}>();

const LEVELS: WasLogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

function updateFilters(patch: Partial<WasLogFilters>): void {
    emit('update:filters', { ...props.filters, ...patch });
}

/**
 * 임시 로그레벨의 자동 복원 시각을 표시용으로 다듬는다.
 *
 * <p>TTL은 이 기능의 안전장치라 "언제 원래대로 돌아오는지"가 화면에 보여야 한다. 값이 비었거나 파싱되지
 * 않으면 원문을 그대로 보여준다 — 임의로 감추면 만료 정보를 잃는다.
 */
function formatExpiry(expiresAt: string): string {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) return expiresAt;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}
</script>

<template>
    <div class="was-log-toolbar">
        <Select
            :model-value="props.instanceId"
            :options="props.instances"
            option-label="id"
            option-value="id"
            :placeholder="t('admin.wasLogs.instance')"
            @update:model-value="emit('update:instanceId', $event)"
        />
        <MultiSelect
            :model-value="props.filters.levels"
            :options="LEVELS"
            :placeholder="t('admin.wasLogs.level')"
            @update:model-value="updateFilters({ levels: $event })"
        />
        <InputText
            :model-value="props.filters.logger"
            :placeholder="t('admin.wasLogs.loggerPlaceholder')"
            @update:model-value="updateFilters({ logger: $event ?? '' })"
        />
        <InputText
            :model-value="props.filters.keyword"
            :placeholder="t('admin.wasLogs.keywordPlaceholder')"
            @update:model-value="updateFilters({ keyword: $event ?? '' })"
        />
        <ToggleButton
            :model-value="props.paused"
            :on-label="t('admin.wasLogs.resume')"
            :off-label="t('admin.wasLogs.pause')"
            @update:model-value="emit('update:paused', $event)"
        />
        <Button
            :label="t('admin.wasLogs.changeLevel')"
            severity="secondary"
            @click="emit('openLevelDialog')"
        />
        <Button :label="t('admin.wasLogs.download')" severity="secondary" @click="emit('download')" />

        <Message v-if="props.levelOverrides.length > 0" severity="warn" :closable="false">
            {{ t('admin.wasLogs.overrideActive') }}:
            <span
                v-for="override in props.levelOverrides"
                :key="override.logger"
                class="was-log-toolbar__override"
            >
                {{ override.logger }}={{ override.level }}
                ({{ t('admin.wasLogs.overrideExpires', { time: formatExpiry(override.expiresAt) }) }})
            </span>
        </Message>
    </div>
</template>

<style scoped>
.was-log-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    padding: 0.75rem;
}
</style>
```

- [ ] **Step 8: `WasLogLevelDialog.vue` 작성**

```vue
<script setup lang="ts">
/**
 * 런타임 로그레벨 임시 변경 다이얼로그.
 *
 * TTL은 필수이며 1~120분만 허용한다(서버도 같은 범위를 검증한다).
 */
import { ref } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import type { WasLogLevel } from '~/types/wasLog';

const props = defineProps<{ visible: boolean; instanceId: string | null }>();
const emit = defineEmits<{ 'update:visible': [value: boolean]; applied: [] }>();

const { $apiFetch } = useNuxtApp() as { $apiFetch: typeof $fetch };
const config = useRuntimeConfig();
const toast = useToast();
const { t } = useI18n();

const LEVELS: WasLogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

const logger = ref('com.kdb.it');
const level = ref<WasLogLevel>('DEBUG');
const ttlMinutes = ref(30);
const submitting = ref(false);

async function apply(): Promise<void> {
    submitting.value = true;
    try {
        await $apiFetch(`${config.public.apiBase}/api/admin/was-logs/level`, {
            method: 'POST',
            body: {
                instanceId: props.instanceId,
                logger: logger.value,
                level: level.value,
                ttlMinutes: ttlMinutes.value,
            },
        });
        toast.add({
            severity: 'success',
            summary: t('admin.wasLogs.dialog.applied'),
            life: 3000,
        });
        emit('applied');
        emit('update:visible', false);
    } catch {
        toast.add({
            severity: 'error',
            summary: t('admin.wasLogs.dialog.failed'),
            life: 5000,
        });
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <Dialog
        :visible="props.visible"
        modal
        :header="t('admin.wasLogs.dialog.title')"
        :style="{ width: '28rem' }"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="was-log-level-dialog">
            <label for="waslog-logger">{{ t('admin.wasLogs.logger') }}</label>
            <InputText id="waslog-logger" v-model="logger" />

            <label for="waslog-level">{{ t('admin.wasLogs.level') }}</label>
            <Select id="waslog-level" v-model="level" :options="LEVELS" />

            <label for="waslog-ttl">{{ t('admin.wasLogs.dialog.ttl') }}</label>
            <InputNumber id="waslog-ttl" v-model="ttlMinutes" :min="1" :max="120" />
            <small>{{ t('admin.wasLogs.dialog.ttlHint') }}</small>
        </div>
        <template #footer>
            <Button
                :label="t('admin.wasLogs.dialog.cancel')"
                severity="secondary"
                @click="emit('update:visible', false)"
            />
            <Button
                :label="t('admin.wasLogs.dialog.apply')"
                :loading="submitting"
                @click="apply"
            />
        </template>
    </Dialog>
</template>

<style scoped>
.was-log-level-dialog {
    display: grid;
    gap: 0.5rem;
}
</style>
```

- [ ] **Step 9: 페이지 작성**

`app/pages/admin/was-logs.vue`:

```vue
<script setup lang="ts">
/**
 * 실시간 WAS 로그 화면.
 *
 * 자동 스크롤은 사용자가 목록 하단에 있을 때만 동작한다 — 위로 스크롤해 읽는 중이면 화면이 튀지 않아야 한다.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Message from 'primevue/message';
import WasLogDetailPanel from '~/components/admin/waslog/WasLogDetailPanel.vue';
import WasLogLevelDialog from '~/components/admin/waslog/WasLogLevelDialog.vue';
import WasLogTable from '~/components/admin/waslog/WasLogTable.vue';
import WasLogToolbar from '~/components/admin/waslog/WasLogToolbar.vue';
import { useWasLogFeed } from '~/composables/useWasLogFeed';
import type { WasLogEntry, WasLogFilters } from '~/types/wasLog';

// 관리자 라우트 가드. 메뉴를 숨기는 것만으로는 URL 직접 진입을 막지 못한다.
definePageMeta({ middleware: 'admin' });

const feed = useWasLogFeed();
const config = useRuntimeConfig();

const selected = ref<WasLogEntry | null>(null);
const levelDialogVisible = ref(false);
const scrollArea = ref<HTMLElement | null>(null);
/** 사용자가 하단에 붙어 있는지. 위로 스크롤하면 자동 스크롤을 멈춘다. */
const stickToBottom = ref(true);

function onScroll(): void {
    const el = scrollArea.value;
    if (!el) return;
    stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
}

watch(
    () => feed.rows.value,
    async () => {
        if (!stickToBottom.value) return;
        await nextTick();
        const el = scrollArea.value;
        if (el) el.scrollTop = el.scrollHeight;
    },
);

/** 인스턴스·필터가 바뀌면 커서를 버리고 처음부터 다시 받는다. */
function onInstanceChange(value: string | null): void {
    feed.instanceId.value = value;
    feed.resetCursor();
    void feed.fetchOnce();
}

function onFiltersChange(value: WasLogFilters): void {
    feed.filters.value = value;
    feed.resetCursor();
    void feed.fetchOnce();
}

function download(): void {
    const params = new URLSearchParams();
    if (feed.instanceId.value) params.set('instanceId', feed.instanceId.value);
    if (feed.filters.value.levels.length) params.set('levels', feed.filters.value.levels.join(','));
    if (feed.filters.value.logger) params.set('logger', feed.filters.value.logger);
    if (feed.filters.value.keyword) params.set('q', feed.filters.value.keyword);
    window.open(
        `${config.public.apiBase}/api/admin/was-logs/download?${params.toString()}`,
        '_blank',
    );
}

onMounted(() => {
    void feed.start();
});

onBeforeUnmount(() => {
    feed.stop();
});
</script>

<template>
    <div class="was-logs-page">
        <h1 class="was-logs-page__title">{{ t('admin.wasLogs.title') }}</h1>

        <WasLogToolbar
            :instances="feed.instances.value"
            :instance-id="feed.instanceId.value"
            :filters="feed.filters.value"
            :paused="feed.paused.value"
            :level-overrides="feed.levelOverrides.value"
            @update:instance-id="onInstanceChange"
            @update:filters="onFiltersChange"
            @update:paused="feed.paused.value = $event"
            @download="download"
            @open-level-dialog="levelDialogVisible = true"
        />

        <Message v-if="feed.peerError.value" severity="error" :closable="false">
            {{ t('admin.wasLogs.peerErrorPrefix') }}: {{ feed.peerError.value }}
        </Message>
        <!-- 재기동은 일회성 사건이라 자동으로 지우지 않는다. 사용자가 닫을 때까지 남긴다. -->
        <Message
            v-if="feed.restarted.value"
            severity="warn"
            :closable="true"
            @close="feed.dismissRestarted()"
        >
            {{ t('admin.wasLogs.restarted') }}
        </Message>
        <Message v-if="feed.dropped.value" severity="warn" :closable="false">
            {{ t('admin.wasLogs.dropped') }}
        </Message>

        <div ref="scrollArea" class="was-logs-page__scroll" @scroll="onScroll">
            <WasLogTable
                :rows="feed.rows.value"
                :selected-seq="selected?.seq ?? null"
                @select="selected = $event"
            />
        </div>

        <WasLogDetailPanel :entry="selected" />

        <WasLogLevelDialog
            v-model:visible="levelDialogVisible"
            :instance-id="feed.instanceId.value"
            @applied="feed.fetchOnce()"
        />
    </div>
</template>

<style scoped>
.was-logs-page__scroll {
    height: 28rem;
    overflow: auto;
    border: 1px solid var(--p-content-border-color);
    border-radius: var(--p-border-radius-md);
}
</style>
```

- [ ] **Step 10: 툴바 테스트 작성과 통과 확인**

`tests/unit/components/admin/WasLogToolbar.test.ts`:

```typescript
/**
 * ============================================================================
 * [tests/unit/components/admin/WasLogToolbar.test.ts]
 * ============================================================================
 * 필터 변경이 기존 값을 보존한 채 update:filters로 올라가는지 검증한다.
 * 부모(페이지)가 이 이벤트를 받아 커서를 초기화하므로 계약이 깨지면 커서가 남는다.
 * ============================================================================
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import WasLogToolbar from '~/components/admin/waslog/WasLogToolbar.vue';
import type { WasLogFilters, WasLogInstance } from '~/types/wasLog';

const instances: WasLogInstance[] = [
    { id: 'SVR1', self: true, reachable: true },
    { id: 'SVR2', self: false, reachable: true },
];

const filters: WasLogFilters = { levels: ['ERROR'], logger: 'com.kdb.it', keyword: '' };

function mountToolbar() {
    return mount(WasLogToolbar, {
        props: { instances, instanceId: 'SVR1', filters, paused: false, levelOverrides: [] },
        global: {
            mocks: { $t: (key: string) => key },
            stubs: {
                Select: { template: '<div />' },
                MultiSelect: { template: '<div />' },
                // 이름을 주어 테스트가 두 InputText를 순서로 구분할 수 있게 한다.
                InputText: { name: 'InputTextStub', template: '<div />' },
                ToggleButton: { template: '<div />' },
                Message: { template: '<div><slot /></div>' },
                Button: {
                    template: '<button :data-label="label" @click="$emit(\'click\')" />',
                    props: ['label'],
                },
            },
        },
    });
}

describe('WasLogToolbar', () => {
    it('다운로드 버튼은 download를 emit한다', async () => {
        const wrapper = mountToolbar();

        await wrapper.find('[data-label="admin.wasLogs.download"]').trigger('click');

        expect(wrapper.emitted('download')).toHaveLength(1);
    });

    it('레벨변경 버튼은 openLevelDialog를 emit한다', async () => {
        const wrapper = mountToolbar();

        await wrapper.find('[data-label="admin.wasLogs.changeLevel"]').trigger('click');

        expect(wrapper.emitted('openLevelDialog')).toHaveLength(1);
    });

    it('키워드 입력은 나머지 필터 값을 보존한 채 올라간다', async () => {
        const wrapper = mountToolbar();

        // 실제 템플릿 바인딩을 태운다 — updateFilters를 직접 부르면 어느 입력이 어느 필드에
        // 연결됐는지(예: 키워드 입력이 logger에 잘못 물린 경우)를 잡지 못한다.
        const inputs = wrapper.findAllComponents({ name: 'InputTextStub' });
        await inputs[1]!.vm.$emit('update:model-value', '실패');

        expect(wrapper.emitted('update:filters')?.[0]?.[0]).toEqual({
            levels: ['ERROR'],
            logger: 'com.kdb.it',
            keyword: '실패',
        });
    });

    it('로거 입력은 키워드를 덮어쓰지 않는다', async () => {
        const wrapper = mountToolbar();

        const inputs = wrapper.findAllComponents({ name: 'InputTextStub' });
        await inputs[0]!.vm.$emit('update:model-value', 'org.hibernate');

        expect(wrapper.emitted('update:filters')?.[0]?.[0]).toEqual({
            levels: ['ERROR'],
            logger: 'org.hibernate',
            keyword: '',
        });
    });
});
```

세 번째 테스트가 `updateFilters`에 접근하려면 `WasLogToolbar.vue`의 `<script setup>` 안에 노출 선언을 추가한다.

```typescript
defineExpose({ updateFilters });
```

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/admin/WasLogToolbar.test.ts
```

Expected: PASS (3건)

- [ ] **Step 11: 아이콘 선택지 확인**

메뉴 아이콘으로 쓸 `pi pi-server`가 프론트 선택지에 있는지 확인하고 없으면 추가한다.

```bash
cd C:/it/it_frontend && grep -n "MENU_ICON_OPTIONS" -A 30 app/utils/menuPresentation.ts | grep -n "pi-server"
```

없으면 `MENU_ICON_OPTIONS` 배열에 `'pi pi-server'`를 추가한다.

- [ ] **Step 11b: 진행 중 재호출 가드 테스트 추가**

Task 8이 수동 새로고침·인스턴스 전환·필터 변경을 붙이면서 `fetchOnce`가 타이머 tick과 겹칠 통로가 생겼다.
Task 7의 `inFlight` 가드가 실제로 두 번째 호출을 막는지 여기서 잠근다.

`tests/unit/composables/useWasLogFeed.test.ts`에 추가:

```typescript
    it('진행 중인 조회가 있으면 두 번째 호출은 요청을 보내지 않는다', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        apiFetch.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    resolveFirst = resolve;
                }),
        );

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            const first = feed.fetchOnce();

            // 응답이 오기 전에 수동 새로고침이 겹친 상황.
            await feed.fetchOnce();
            expect(apiFetch).toHaveBeenCalledTimes(1);

            resolveFirst(snapshot({ entries: [entry(1)], lastSeq: 1 }));
            await first;

            expect(feed.rows.value.map((r) => r.seq)).toEqual([1]);
        });
        scope.stop();
    });

    it('진행 중이어도 세대가 바뀐 뒤의 조회는 곧바로 나간다', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        apiFetch
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveFirst = resolve;
                    }),
            )
            .mockResolvedValueOnce(snapshot({ entries: [entry(7)], lastSeq: 7 }));

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            const first = feed.fetchOnce();

            // 필터를 바꾼 상황 — 목록이 비워지므로 재조회가 즉시 나가야 화면이 비어 있지 않다.
            feed.resetCursor();
            await feed.fetchOnce();

            expect(apiFetch).toHaveBeenCalledTimes(2);
            expect(feed.rows.value.map((r) => r.seq)).toEqual([7]);

            resolveFirst(snapshot({ entries: [entry(1)], lastSeq: 1 }));
            await first;

            // 이전 세대 응답은 버려야 한다.
            expect(feed.rows.value.map((r) => r.seq)).toEqual([7]);
        });
        scope.stop();
    });

    it('dismissRestarted는 재기동 배너만 내린다', async () => {
        apiFetch
            .mockResolvedValueOnce(snapshot({ entries: [entry(1)], lastSeq: 1, bufferEpoch: 'e1' }))
            .mockResolvedValueOnce(snapshot({ entries: [entry(1)], lastSeq: 1, bufferEpoch: 'e2' }));

        const scope = effectScope();
        await scope.run(async () => {
            const feed = useWasLogFeed();
            await feed.fetchOnce();
            await feed.fetchOnce();
            expect(feed.restarted.value).toBe(true);

            feed.dismissRestarted();

            expect(feed.restarted.value).toBe(false);
            expect(feed.rows.value).toHaveLength(1);
        });
        scope.stop();
    });
```

- [ ] **Step 12: 검증 명령 전체 실행**

```bash
cd C:/it/it_frontend && npm run format:check && npm run check && npm test
```

Expected: 모두 통과. `check:copy` 래칫이 새 하드코딩 문구를 잡으면 해당 문자열을 `admin.wasLogs.*` 키로 옮긴다.

- [ ] **Step 13: 커밋**

```bash
cd C:/it/it_frontend && git add app/components/admin/waslog app/pages/admin/was-logs.vue i18n/messages/admin.ts tests/unit/components/admin/WasLogTable.test.ts tests/unit/components/admin/WasLogToolbar.test.ts && git diff --cached --stat && git commit -m "feat: 실시간 WAS 로그 화면과 컴포넌트 추가"
```

`app/utils/menuPresentation.ts`를 고쳤으면 같은 커밋에 경로를 추가한다.

---

### Task 9: 관리자 메뉴 시드

**Files:**
- Create: `it_database/migrations/V20260820_001__SeedWasLogAdminMenu.sql`

**Interfaces:**
- Consumes: 화면 경로 `/admin/was-logs`(Task 8)
- Produces: `TPRMPP_CMENUD`·`TPRMPP_CMENUM`·**`TPRMPP_CMENUA`**·`TPRMPP_CLANGM` 행

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- ============================================================================
-- 실시간 WAS 로그 화면 관리자 메뉴 시드
-- ============================================================================
-- /admin/was-logs 화면의 경로 카탈로그·메뉴·권한 매핑·영어 번역을 추가한다.
--
-- [부모 메뉴]
--   서버 로그 열람은 운영 추적 성격이므로 MADM0012(이력·보안)를 부모로 둔다.
--
-- [권한 매핑 — BE-45 대응]
--   MenuQueryService.isAllowed()는 "매핑 0건이면 전체 공개"로 판정한다. 매핑을 넣지
--   않으면 비관리자 사이드바에도 이 메뉴가 보인다. 서버 인가(/api/admin/** →
--   hasRole('ADMIN'))가 데이터 유출은 막지만 메뉴 노출 자체가 잘못이므로
--   TPRMPP_CMENUA에 ITPAD001(시스템관리자) 매핑을 함께 넣는다.
--
-- [채번]
--   MNU_ID는 CmenumRepositoryImpl.nextMnuId()와 같은 형식을 SQL에서 재현한다.
--
-- [재실행 안전]
--   같은 화면경로의 활성(DEL_YN='N') 메뉴가 있으면 건너뛴다.
--   부모(MADM0012)가 없는 스키마에서도 조용히 건너뛴다.
-- ============================================================================

MERGE INTO ITPOWN.TPRMPP_CMENUD target
USING (SELECT '/admin/was-logs' AS sre_pth FROM DUAL) source
ON (target.SRE_PTH = source.sre_pth)
WHEN NOT MATCHED THEN
    INSERT (SRE_PTH, SRE_MNU_NM, USE_YN, RMK)
    VALUES (source.sre_pth, 'WAS 로그', 'Y', '실시간 WAS 애플리케이션 로그 조회');

DECLARE
    c_parent_id   CONSTANT VARCHAR2(10) := 'MADM0012';
    c_sre_pth     CONSTANT VARCHAR2(40) := '/admin/was-logs';
    c_ath_id      CONSTANT VARCHAR2(10) := 'ITPAD001';
    v_parent_path ITPOWN.TPRMPP_CMENUM.WHL_MNU_PTH%TYPE;
    v_parent_dep  ITPOWN.TPRMPP_CMENUM.MNU_DEP%TYPE;
    v_mnu_id      ITPOWN.TPRMPP_CMENUM.MNU_ID%TYPE;
    v_max_sort    NUMBER;
    v_exists      NUMBER;
BEGIN
    BEGIN
        SELECT WHL_MNU_PTH, MNU_DEP
          INTO v_parent_path, v_parent_dep
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE MNU_ID = c_parent_id
           AND DEL_YN = 'N';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN; -- 이력·보안 그룹이 없는 스키마는 시드 대상이 아니다
    END;

    SELECT COUNT(*)
      INTO v_exists
      FROM ITPOWN.TPRMPP_CMENUM
     WHERE SRE_PTH = c_sre_pth
       AND DEL_YN = 'N';

    IF v_exists = 0 THEN
        SELECT 'MNU' || LPAD(ITPOWN.SQ_TPRMPP_CMENUM_1.NEXTVAL, 7, '0') INTO v_mnu_id FROM DUAL;

        SELECT NVL(MAX(MNU_SOT_SQN_SNO), 0)
          INTO v_max_sort
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE HRK_MNU_ID = c_parent_id
           AND DEL_YN = 'N';

        INSERT INTO ITPOWN.TPRMPP_CMENUM (
            MNU_ID, HRK_MNU_ID, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO,
            HID_YN, MNU_DEP, WHL_MNU_PTH, IMK_NM,
            DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM
        ) VALUES (
            v_mnu_id, c_parent_id, 'WAS 로그', 'PGE', c_sre_pth, v_max_sort + 10,
            'N', v_parent_dep + 1, v_parent_path || '/' || v_mnu_id, 'pi pi-server',
            'N',
            LOWER(REGEXP_REPLACE(RAWTOHEX(SYS_GUID()), '(.{8})(.{4})(.{4})(.{4})(.{12})', '\1-\2-\3-\4-\5')),
            1, 'MIGRATION', SYSDATE, 'MIGRATION', SYSDATE
        );

        -- 관리자 전용 노출 (매핑이 없으면 전체 공개로 판정된다)
        INSERT INTO ITPOWN.TPRMPP_CMENUA (
            MNU_ID, ATH_ID, DEL_YN, GUID, GUID_PRG_SNO,
            FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM
        ) VALUES (
            v_mnu_id, c_ath_id, 'N',
            LOWER(REGEXP_REPLACE(RAWTOHEX(SYS_GUID()), '(.{8})(.{4})(.{4})(.{4})(.{12})', '\1-\2-\3-\4-\5')),
            1, 'MIGRATION', SYSDATE, 'MIGRATION', SYSDATE
        );
    END IF;
END;
/

MERGE INTO ITPOWN.TPRMPP_CLANGM target
USING (
    SELECT m.MNU_ID AS tc_id_cone
      FROM ITPOWN.TPRMPP_CMENUM m
     WHERE m.SRE_PTH = '/admin/was-logs'
       AND m.DEL_YN = 'N'
) source
ON (
    target.TC_ID_CONE = source.tc_id_cone
    AND target.DTT_LAN_C = 'en'
    AND target.TC_COL_NM = 'MNU_NM'
)
WHEN NOT MATCHED THEN
    INSERT (TC_ID_CONE, DTT_LAN_C, TC_COL_NM, TC_DES, DTT_NM, DEL_YN)
    VALUES (source.tc_id_cone, 'en', 'MNU_NM', 'WAS Logs', '메뉴', 'N');

COMMIT;
```

- [ ] **Step 2: CMENUA 컬럼 구성 확인**

시드를 돌리기 전에 실제 컬럼과 NOT NULL 제약을 확인해 INSERT 목록을 맞춘다.

```bash
cd C:/it/it_database && grep -n -A 20 "CREATE TABLE \"ITPOWN\".\"TPRMPP_CMENUA\"" ITPOWN_DDL_live.sql
```

`GUID_PRG_SNO`·감사 컬럼 이름이 다르면 실제 DDL에 맞춰 INSERT 절을 수정한다.

- [ ] **Step 3: 로컬 스키마에 적용**

백엔드를 기동해 Flyway가 적용하게 한다(수동 실행 시 Oracle 비밀번호를 명령행에 넣지 않는다 — 콘솔 프롬프트를 쓴다).

```bash
cd C:/it/it_backend && ./gradlew bootRun --no-daemon
```

기동 로그에서 `V20260820_001` 적용을 확인한 뒤 종료한다.

- [ ] **Step 4: 메뉴 노출 확인**

관리자 계정으로 로그인해 사이드바 「이력·보안」 아래 「WAS 로그」가 보이고, 비관리자 계정에서는 보이지 않는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
cd C:/it/it_database && git add migrations/V20260820_001__SeedWasLogAdminMenu.sql && git diff --cached --stat && git commit -m "feat: WAS 로그 관리자 메뉴 시드 추가 (권한 매핑 포함)"
```

---

### Task 10: 통합 검증과 문서·버전 기록

**Files:**
- Modify: `C:\it\TASK.md` (마스킹 후속 과제 등록)
- Modify: `C:\it\versions.lock` (스크립트로 갱신)

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd C:/it/it_backend && ./gradlew test --no-daemon
```

Expected: 전체 PASS. 실패가 있으면 이번 변경과 무관한 기존 실패인지 `git stash` 없이 브랜치 기준으로 확인한다.

- [ ] **Step 2: 프론트엔드 전체 검증**

```bash
cd C:/it/it_frontend && npm run format:check && npm run check && npm test
```

- [ ] **Step 3: 수동 확인 — 다중 인스턴스**

로컬에서 두 인스턴스를 흉내 내 피어 팜아웃을 확인한다. 서로 다른 포트·`SERVER_INSTANCE_ID`로 두 번 기동하고, 두 프로세스 모두에 같은 `WAS_LOG_INTERNAL_SECRET`과 peers 목록을 준다.

확인 항목:
1. 인스턴스 선택을 SVR2로 바꾸면 SVR2의 로그가 뜬다.
2. SVR2를 내리면 목록이 비는 대신 `peerError` 배너가 뜬다.
3. SVR2에 레벨 변경을 걸면 SVR2 로그에만 DEBUG가 나타난다.
4. `WAS_LOG_INTERNAL_SECRET`을 비우고 기동하면 `/internal/was-logs/snapshot` 호출이 404다.

- [ ] **Step 4: 후속 과제 등록**

`C:\it\TASK.md`의 「⚙️ 백엔드」 표에 행을 추가한다.

```markdown
| BE-54 | 🟡 Medium | 보안 | WAS 로그 뷰어 본문 마스킹 | `/admin/was-logs`가 링버퍼 원문을 그대로 화면·다운로드로 노출한다. 토큰·사번·개인정보가 로그에 찍히면 ADMIN 권한과 감사 로그 외에 통제 수단이 없고, 다운로드 파일은 개인 PC로 나가면 추적이 끊긴다. 설계(`docs/superpowers/specs/2026-08-20-was-log-viewer-design.md` §9)에서 수용된 리스크로 명시하고 범위에서 제외했다. 해소는 `RingBufferAppender.append` 적재 직전 한 곳에 마스킹 필터를 끼우면 된다 — 적재 경로가 단일이라 삽입 지점이 명확하다. |
| BE-55 | 🟢 Low | 감사 | WAS 로그 관리자 행위 감사의 DB 적재 | `WasLogAuditLogger`가 조회·레벨변경·다운로드를 애플리케이션 WARN 로그로만 남긴다(파일 appender 12개월 보관). 범용 관리자 행위 감사 테이블이 없어 신규 DDL을 피한 선택이다. 감사 요건이 조회 가능한 테이블을 요구하면 전용 테이블과 Flyway 마이그레이션을 추가한다. |
```

- [ ] **Step 5: 버전 조합 기록**

```bash
cd C:/it && ./scripts/update-versions-lock.ps1
```

- [ ] **Step 6: 루트 커밋**

```bash
cd C:/it && git add TASK.md versions.lock && git diff --cached --stat && git commit -m "docs: WAS 로그 뷰어 후속 과제 등록과 호환 버전 기록"
```

---

## 배포 인계 사항

구현이 끝나면 운영팀에 다음을 요청해야 한다. 코드만으로는 완결되지 않는 부분이다.

1. **`WAS_LOG_INTERNAL_SECRET`** 환경변수를 두 인스턴스에 **같은 값**으로 주입. 비어 있으면 인스턴스 선택이 자기 자신에서만 동작한다.
2. **`WAS_LOG_PEER_SVR1` / `WAS_LOG_PEER_SVR2`** 에 각 인스턴스의 내부 base URL 주입.
3. **`/internal/was-logs/**` 경로를 L4 외부에 노출하지 않도록** 방화벽에서 사내 서버 대역으로 제한.
4. 각 서버의 **`SERVER_INSTANCE_ID`** 가 SVR1/SVR2로 서로 다르게 설정되어 있는지 확인(파일 업로드 채번이 이미 쓰는 값이라 대개 설정되어 있다).
