# DB/JPA 최적화 P0 — 로컬 Oracle 기반 @DataJpaTest 인프라 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** P1~P3의 DB-backed 검증을 가능케 하는, 실제 로컬 Oracle에 연결되는 `@DataJpaTest` 통합 테스트 인프라를 구축한다.

**Architecture:** 이미 가동 중인 로컬 Oracle(`ITPAPP@127.0.0.1:11521/XEPDB1`, `ITPOWN` 스키마)에 `@DataJpaTest`+`@AutoConfigureTestDatabase(replace=NONE)`로 연결한다. `ddl-auto=none`으로 실 스키마를 절대 변경하지 않고, `@DataJpaTest`의 트랜잭션 롤백으로 데이터 오염을 막는다. 통합 테스트는 `@Tag("it")`로 분리해 **로컬 전용**(CI `test` 제외)으로 두고, DB 미가동 시 TCP 프로브로 자동 스킵한다.

**Tech Stack:** Spring Boot 4.1.0, Java 25, JUnit 5, AssertJ, QueryDSL 5.1.0, Oracle JDBC(ojdbc11, 기존 의존).

**관련 spec:** [`2026-06-29-db-jpa-optimization-design.md`](../specs/2026-06-29-db-jpa-optimization-design.md) §3.

**전제(2026-06-29 확인 완료):** Docker 미설치 → Testcontainers 불가. 로컬 Oracle 21c XE 가동 중, `ITPAPP/kdb1234!!`로 접속 가능, `ITPOWN` 77테이블 + `V_ITPAPP_LOG_FEED` 뷰 + `TPRMPP_CCODEM` 206행 확인.

---

## File Structure

| 파일 | 책임 | 생성/수정 |
| --- | --- | --- |
| `it_backend/build.gradle` | `integrationTest` 태스크 추가 + `test`에서 `it` 태그 제외 (신규 의존성 없음) | 수정 |
| `it_backend/src/test/resources/application-test-it.properties` | 통합 테스트 전용 프로파일(실 Oracle 연결, ddl-auto=none, CURRENT_SCHEMA) | 생성 |
| `it_backend/src/test/java/com/kdb/it/support/AbstractOracleRepositoryTest.java` | `@DataJpaTest` 베이스 + DB 미가동 자동 스킵 | 생성 |
| `it_backend/src/test/java/com/kdb/it/common/code/repository/OracleHarnessSmokeTest.java` | 하네스 동작 스모크 테스트 | 생성 |
| `it_backend/CLAUDE.md` | 통합 테스트 실행법 1단락 | 수정 |

---

## Task 1: Gradle 태스크 분리 (it 태그)

**Files:**
- Modify: `it_backend/build.gradle` (`tasks.named('test')` 블록 L201-206)

신규 의존성은 없다(Oracle JDBC `ojdbc11`은 이미 `runtimeOnly`라 testRuntimeClasspath에 포함, AssertJ/JUnit5는 `spring-boot-starter-data-jpa-test`에 포함). `test`/`integrationTest` 태스크 분리만 수행한다.

- [ ] **Step 1: `test` 태스크에서 `it` 태그 제외 + `integrationTest` 태스크 추가**

기존 `tasks.named('test')` 블록(L201-206)을 아래로 교체한다. 기존 `outputs.dir`/`finalizedBy` 설정을 보존하면서 `useJUnitPlatform`에 `excludeTags`만 추가하고, 통합 테스트 전용 태스크를 신규 등록한다.

```gradle
tasks.named('test') {
	outputs.dir snippetsDir
	// 통합 테스트(@Tag("it"))는 로컬 전용 — CI 기본 test 게이트에서 제외
	useJUnitPlatform {
		excludeTags 'it'
	}
	// 테스트 완료 후 자동으로 커버리지 리포트 생성
	finalizedBy jacocoTestReport
}

// 로컬 전용 통합 테스트(실제 로컬 Oracle @DataJpaTest). 로컬 Oracle 가동 필요.
// 실행: ./gradlew integrationTest
tasks.register('integrationTest', Test) {
	description = '로컬 Oracle 기반 @DataJpaTest 통합 테스트 (로컬 전용, 로컬 Oracle 가동 필요)'
	group = 'verification'
	useJUnitPlatform {
		includeTags 'it'
	}
	testClassesDirs = sourceSets.test.output.classesDirs
	classpath = sourceSets.test.runtimeClasspath
	shouldRunAfter tasks.named('test')
}
```

- [ ] **Step 2: 태스크 등록 확인**

Run: `cd it_backend && ./gradlew tasks --group verification | grep -i integrationTest`
Expected: `integrationTest - 로컬 Oracle 기반 ...` 출력.

- [ ] **Step 3: Commit**

```bash
git add it_backend/build.gradle
git commit -m "test: integrationTest 태스크 분리(it 태그) — 통합 테스트 로컬 전용"
```

---

## Task 2: 통합 테스트 프로파일 (실 Oracle 연결)

**Files:**
- Create: `it_backend/src/test/resources/application-test-it.properties`

- [ ] **Step 1: 프로파일 파일 작성**

`ddl-auto=none`(실 스키마 변경 금지)과 CURRENT_SCHEMA init-sql이 핵심이다. DB 접속 정보는 환경변수로 오버라이드 가능하되 로컬 기본값(베이스 `application.properties`와 동일한 dev 기본값)을 둔다.

```properties
# 통합 테스트(@Tag("it"), 로컬 전용) 전용 프로파일 — 실제 로컬 Oracle 연결.
# @DataJpaTest의 트랜잭션 롤백 + ddl-auto=none으로 dev 스키마/데이터를 변경하지 않는다.

# DataSource — 로컬 Oracle (env 오버라이드 가능, 기본값은 dev 기본값과 동일)
spring.datasource.url=${DB_URL:jdbc:oracle:thin:@127.0.0.1:11521/XEPDB1}
spring.datasource.username=${DB_USERNAME:ITPAPP}
spring.datasource.password=${DB_PASSWORD:kdb1234!!}
spring.datasource.driver-class-name=oracle.jdbc.OracleDriver

# 세션 스키마 — 운영/개발과 동일하게 ITPOWN으로 전환 (CLAUDE §2)
spring.datasource.hikari.connection-init-sql=ALTER SESSION SET CURRENT_SCHEMA=${DB_SCHEMA:ITPOWN}

# 실 스키마 변경 절대 금지 — 읽기만. create/create-drop 금지.
spring.jpa.hibernate.ddl-auto=none
spring.jpa.show-sql=false

# Flyway는 통합 테스트에서 비활성 (마이그레이션 검증은 별도 로컬 경로)
spring.flyway.enabled=false
```

- [ ] **Step 2: Commit**

```bash
git add it_backend/src/test/resources/application-test-it.properties
git commit -m "test: 통합 테스트 프로파일(test-it) — 로컬 Oracle 연결, ddl-auto=none"
```

---

## Task 3: @DataJpaTest 베이스 클래스 (DB 미가동 자동 스킵)

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/support/AbstractOracleRepositoryTest.java`

- [ ] **Step 1: 베이스 클래스 작성**

`@BeforeAll`에서 `127.0.0.1:11521` TCP 프로브로 DB 가동 여부를 확인하고 꺼져 있으면 `Assumptions.assumeTrue`로 전체 스킵한다. 이로써 로컬 Oracle이 없어도 `./gradlew integrationTest`가 빌드를 깨지 않는다.

```java
package com.kdb.it.support;

import com.kdb.it.config.QuerydslConfig;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;

/**
 * 로컬 Oracle 기반 @DataJpaTest 공통 베이스.
 *
 * <p>이미 가동 중인 로컬 Oracle(ITPAPP@127.0.0.1:11521/XEPDB1, CURRENT_SCHEMA=ITPOWN)에
 * 연결한다. {@code ddl-auto=none}으로 실 스키마를 변경하지 않고, {@code @DataJpaTest}의
 * 기본 트랜잭션 롤백으로 데이터 오염을 막는다. QueryDSL 리포지토리 구현체 검증을 위해
 * {@link QuerydslConfig}를 함께 임포트한다.</p>
 *
 * <p>로컬 전용: {@code @Tag("it")}로 CI 기본 test 게이트에서 제외되며, 로컬 Oracle이
 * 꺼져 있으면 {@code @BeforeAll} TCP 프로브가 전체 테스트를 스킵한다.</p>
 */
@Tag("it")
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(QuerydslConfig.class)
@ActiveProfiles("test-it")
public abstract class AbstractOracleRepositoryTest {

    private static final String DB_HOST = "127.0.0.1";
    private static final int DB_PORT = 11521;
    private static final int PROBE_TIMEOUT_MS = 1000;

    @BeforeAll
    static void skipIfDatabaseUnavailable() {
        Assumptions.assumeTrue(isReachable(),
                "로컬 Oracle(" + DB_HOST + ":" + DB_PORT + ") 미가동 — 통합 테스트 스킵");
    }

    private static boolean isReachable() {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(DB_HOST, DB_PORT), PROBE_TIMEOUT_MS);
            return true;
        } catch (IOException e) {
            return false;
        }
    }
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileTestJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/test/java/com/kdb/it/support/AbstractOracleRepositoryTest.java
git commit -m "test: 로컬 Oracle @DataJpaTest 베이스 클래스(DB 미가동 자동 스킵)"
```

---

## Task 4: 하네스 스모크 테스트 (RED → GREEN)

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/common/code/repository/OracleHarnessSmokeTest.java`

스모크 테스트는 (a) 실 Oracle 연결, (b) CURRENT_SCHEMA=ITPOWN 해석, (c) JPA 리포지토리 와이어링, (d) JPQL 라운드트립을 검증한다. 실 데이터에 결합하지 않도록 **결정적 결과**만 단언한다(존재하지 않는 키 조회 → false / 카운트 ≥ 0).

- [ ] **Step 1: 스모크 테스트 작성**

`CodeRepository.existsByCIdAndCdvaAndSttDt`(`CodeRepository.java:33` 시그니처)와 `count()`를 사용한다. 존재하지 않는 키는 항상 false이므로 데이터 변동과 무관하게 결정적이다.

```java
package com.kdb.it.common.code.repository;

import com.kdb.it.support.AbstractOracleRepositoryTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("로컬 Oracle 통합 테스트 하네스 스모크")
class OracleHarnessSmokeTest extends AbstractOracleRepositoryTest {

    @Autowired
    CodeRepository codeRepository;

    @Test
    @DisplayName("실 스키마에 연결되어 JPQL 라운드트립이 동작한다")
    void connectsToRealSchema_andRunsJpql() {
        // CURRENT_SCHEMA=ITPOWN의 TPRMPP_CCODEM에 연결되어 카운트가 음수가 아니다.
        assertThat(codeRepository.count()).isNotNegative();
        // 존재하지 않는 복합키 조회는 데이터 변동과 무관하게 항상 false (결정적).
        assertThat(codeRepository.existsByCIdAndCdvaAndSttDt(
                "ZZ_NONEXIST", "ZZ_NONEXIST", "00000000")).isFalse();
    }
}
```

- [ ] **Step 2: 테스트 실행 (실 Oracle 연결 검증)**

Run: `cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.common.code.repository.OracleHarnessSmokeTest"`
Expected: **PASS** (로컬 Oracle 가동 상태). 로그에 `ALTER SESSION SET CURRENT_SCHEMA=ITPOWN`이 적용되고 JPQL이 `TPRMPP_CCODEM`을 조회.

실패 시 진단:
- `ORA-00942: table or view does not exist` → CURRENT_SCHEMA init-sql 미적용. `application-test-it.properties`의 `connection-init-sql` 확인.
- 연결 거부/타임아웃 → 로컬 Oracle 미가동. `sqlplus ITPAPP/kdb1234!!@127.0.0.1:11521/XEPDB1`로 수동 확인. (DB가 꺼져 있으면 Task 3의 TCP 프로브로 테스트가 **스킵**되어야 하며 실패가 아니어야 함 — 스킵 대신 실패가 나면 프로브 로직 점검.)
- `EnvironmentValidator` 등으로 컨텍스트 로드 실패 → `@DataJpaTest` 슬라이스는 일반 `@Component`를 로드하지 않아야 정상. 추가 빈이 끌려오면 `@Import` 범위 점검.

- [ ] **Step 3: CI 게이트(단위 test)에서 제외됨을 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.code.repository.OracleHarnessSmokeTest"`
Expected: 해당 테스트가 **실행되지 않음**(it 태그 제외). 기본 `test` 게이트는 로컬 Oracle 없이도 깨지지 않는다.

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/test/java/com/kdb/it/common/code/repository/OracleHarnessSmokeTest.java
git commit -m "test: 로컬 Oracle 통합 테스트 하네스 스모크(실 스키마 JPQL 라운드트립)"
```

---

## Task 5: 문서화 — 실행 방법 기록

**Files:**
- Modify: `it_backend/CLAUDE.md` (§5.9 테스트 기준 끝에 통합 테스트 실행법 1단락 추가)

- [ ] **Step 1: 통합 테스트 실행법 추가**

`it_backend/CLAUDE.md` §5.9 "테스트 기준" 섹션 끝에 다음 단락을 추가한다.

```markdown
- **통합 테스트(로컬 Oracle @DataJpaTest, 로컬 전용)**: `@Tag("it")` 부착 테스트는 기본 `./gradlew test`에서 제외되며 `./gradlew integrationTest`로만 실행한다. 가동 중인 로컬 Oracle(`ITPAPP@127.0.0.1:11521/XEPDB1`, CURRENT_SCHEMA=ITPOWN)에 연결하고, 베이스 클래스는 `com.kdb.it.support.AbstractOracleRepositoryTest`다. `ddl-auto=none`으로 실 스키마를 변경하지 않으며 `@DataJpaTest` 트랜잭션 롤백으로 데이터 오염을 막는다. 로컬 Oracle이 꺼져 있으면 TCP 프로브로 자동 스킵된다. (Docker 미설치 환경이라 Testcontainers 대신 실 로컬 DB를 사용.)
```

- [ ] **Step 2: Commit**

```bash
git add it_backend/CLAUDE.md
git commit -m "docs: 통합 테스트(로컬 Oracle @DataJpaTest) 실행법 백엔드 가이드에 추가"
```

---

## Self-Review (작성자 확인 완료)

- **Spec 커버리지**: spec §3(P0, 로컬 Oracle판)의 태스크 분리·실 DB 프로파일(ddl-auto=none·CURRENT_SCHEMA)·베이스 클래스(자동 스킵)·로컬 전용 게이트·스모크 산출물을 Task 1~5가 모두 구현. ✔
- **Placeholder 스캔**: TBD/모호 단계 없음. Task 4 실패 진단은 결정 트리로 구체화. ✔
- **타입 일관성**: 클래스명 `AbstractOracleRepositoryTest`/`OracleHarnessSmokeTest`, 프로파일 `test-it`, 태그 `it`, 태스크 `integrationTest` 전 Task 일관. `CodeRepository.existsByCIdAndCdvaAndSttDt`/`count` 시그니처는 실제 소스(`CodeRepository.java:33`, `JpaRepository`)와 일치. ✔
- **안전성**: `ddl-auto=none` + `@DataJpaTest` 롤백 + `replace=NONE` 조합으로 실 dev DB의 스키마·데이터 불변 보장. ✔
```
