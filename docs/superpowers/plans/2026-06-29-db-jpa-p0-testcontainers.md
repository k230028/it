# DB/JPA 최적화 P0 — Testcontainers Oracle 통합 테스트 인프라 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** P1~P3의 DB-backed 검증을 가능케 하는 Testcontainers Oracle 기반 `@DataJpaTest` 인프라를 구축한다.

**Architecture:** 싱글톤 `OracleContainer`(gvenzl/oracle-free) 위에서 Hibernate `ddl-auto=create-drop`로 엔티티에서 스키마를 생성하고, `@DataJpaTest`+`@AutoConfigureTestDatabase(replace=NONE)`로 컨테이너 DataSource를 사용한다. 통합 테스트는 `@Tag("it")`로 분리해 **로컬 전용**(CI `test` 태스크 제외)으로 두고, Docker 미존재 시 자동 스킵한다.

**Tech Stack:** Spring Boot 4.1.0, Java 25, JUnit 5, Testcontainers(oracle-free 모듈), AssertJ, QueryDSL 5.1.0.

**관련 spec:** [`2026-06-29-db-jpa-optimization-design.md`](../specs/2026-06-29-db-jpa-optimization-design.md) §3.

---

## File Structure

| 파일 | 책임 | 생성/수정 |
| --- | --- | --- |
| `it_backend/build.gradle` | Testcontainers 의존성 + `integrationTest` 태스크 + `test`에서 `it` 태그 제외 | 수정 |
| `it_backend/src/test/resources/application-test-it.properties` | 통합 테스트 전용 프로파일(ddl-auto, flyway off) | 생성 |
| `it_backend/src/test/java/com/kdb/it/support/AbstractOracleRepositoryTest.java` | 싱글톤 컨테이너 + `@DataJpaTest` 베이스 | 생성 |
| `it_backend/src/test/java/com/kdb/it/common/code/repository/OracleHarnessSmokeTest.java` | 하네스 동작 스모크 테스트 | 생성 |

---

## Task 0: 환경 전제 확인 (폐쇄망/Docker)

이 저장소는 폐쇄망 오프라인 maven 저장소(`C:/maven-repo`)와 내부 Nexus를 사용한다(`build.gradle` L41-69). Testcontainers JAR과 Docker 이미지는 외부망에서 자동으로 받지 못할 수 있다.

- [ ] **Step 1: Docker 가동 확인**

Run: `docker version`
Expected: Client/Server 버전 출력. 실패하면 Docker Desktop을 먼저 기동한다(통합 테스트는 로컬 전용이므로 Docker 필수).

- [ ] **Step 2: Oracle 이미지 준비**

Run: `docker pull gvenzl/oracle-free:slim-faststart`
Expected: 이미지 pull 성공. 폐쇄망이라 pull이 막히면, 외부망 PC에서 `docker save gvenzl/oracle-free:slim-faststart -o oracle-free.tar` 후 반입하여 `docker load -i oracle-free.tar`로 적재한다. **이 단계가 막히면 이후 통합 테스트는 실행 불가** — 이미지 반입을 선결한다.

- [ ] **Step 3: Testcontainers reuse 활성화(선택, 로컬 속도)**

`~/.testcontainers.properties`에 다음 한 줄을 추가(없으면 생성):
```properties
testcontainers.reuse.enable=true
```
없어도 동작하며, 있으면 컨테이너 재사용으로 반복 실행이 빨라진다.

---

## Task 1: Gradle 의존성 + 태스크 분리

**Files:**
- Modify: `it_backend/build.gradle` (dependencies 블록 L116-122, `tasks.named('test')` 블록 L201-206)

- [ ] **Step 1: Testcontainers 의존성 추가**

`dependencies` 블록의 기존 `testImplementation` 묶음(`build.gradle` L116-122) 끝에 다음 두 줄을 추가한다. 버전은 Spring Boot 4.1.0 BOM이 관리하므로 명시하지 않는다.

```gradle
	testImplementation 'org.testcontainers:junit-jupiter'
	testImplementation 'org.testcontainers:oracle-free'
```

- [ ] **Step 2: `test` 태스크에서 `it` 태그 제외 + `integrationTest` 태스크 추가**

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

// 로컬 전용 통합 테스트(Testcontainers Oracle). Docker 필요.
// 실행: ./gradlew integrationTest
tasks.register('integrationTest', Test) {
	description = 'Testcontainers Oracle 기반 @DataJpaTest 통합 테스트 (로컬 전용, Docker 필요)'
	group = 'verification'
	useJUnitPlatform {
		includeTags 'it'
	}
	testClassesDirs = sourceSets.test.output.classesDirs
	classpath = sourceSets.test.runtimeClasspath
	shouldRunAfter tasks.named('test')
}
```

- [ ] **Step 3: 의존성 해석 확인**

Run: `cd it_backend && ./gradlew dependencies --configuration testRuntimeClasspath | grep -i testcontainers`
Expected: `org.testcontainers:junit-jupiter`, `org.testcontainers:oracle-free`, 전이 의존 `org.testcontainers:oracle-free` → `org.testcontainers:jdbc` 등이 버전과 함께 출력. 해석 실패(버전 미발견) 시 오프라인 저장소에 Testcontainers 아티팩트 반입이 필요하다.

- [ ] **Step 4: Commit**

```bash
git add it_backend/build.gradle
git commit -m "test: Testcontainers oracle-free 의존성 + integrationTest 태스크 분리(it 태그)"
```

---

## Task 2: 통합 테스트 프로파일

**Files:**
- Create: `it_backend/src/test/resources/application-test-it.properties`

- [ ] **Step 1: 프로파일 파일 작성**

`@DataJpaTest` 슬라이스는 `EnvironmentValidator` 등 일반 `@Component`를 로드하지 않으므로 jwt/gemini 등 더미값은 불필요하다. 스키마 생성과 Flyway 비활성만 지정한다.

```properties
# 통합 테스트(Testcontainers Oracle) 전용 프로파일 — 로컬 전용(@Tag("it"))
# 스키마는 Hibernate가 JPA 엔티티에서 생성한다(베이스 DDL 덤프 재생 대신, spec §3.2 결정).
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.show-sql=false

# Flyway는 비활성 — 마이그레이션 자체 검증은 실제 로컬 Oracle 경로에서 수행한다.
spring.flyway.enabled=false
```

- [ ] **Step 2: Commit**

```bash
git add it_backend/src/test/resources/application-test-it.properties
git commit -m "test: 통합 테스트 전용 프로파일(test-it) — ddl-auto create-drop, flyway off"
```

---

## Task 3: 싱글톤 컨테이너 베이스 클래스

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/support/AbstractOracleRepositoryTest.java`

- [ ] **Step 1: 베이스 클래스 작성**

싱글톤 컨테이너 패턴(static 필드 + static 블록 1회 기동, `@Container` 미사용)으로 클래스 간 컨테이너를 공유한다. `disabledWithoutDocker=true`로 Docker 부재 시 자동 스킵한다.

```java
package com.kdb.it.support;

import com.kdb.it.config.QuerydslConfig;
import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.oracle.OracleContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Testcontainers Oracle 기반 @DataJpaTest 공통 베이스.
 *
 * <p>싱글톤 컨테이너(static 1회 기동)를 모든 하위 테스트가 공유한다. 스키마는
 * Hibernate ddl-auto=create-drop가 JPA 엔티티에서 생성한다(test-it 프로파일).
 * QueryDSL 리포지토리 구현체 검증을 위해 {@link QuerydslConfig}를 함께 임포트한다.</p>
 *
 * <p>로컬 전용: {@code @Tag("it")}로 CI 기본 test 게이트에서 제외되며,
 * Docker 미존재 시 {@code disabledWithoutDocker=true}로 자동 스킵된다.</p>
 */
@Tag("it")
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(QuerydslConfig.class)
@ActiveProfiles("test-it")
@Testcontainers(disabledWithoutDocker = true)
public abstract class AbstractOracleRepositoryTest {

    static final OracleContainer ORACLE =
            new OracleContainer(DockerImageName.parse("gvenzl/oracle-free:slim-faststart"))
                    .withReuse(true);

    static {
        ORACLE.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", ORACLE::getJdbcUrl);
        registry.add("spring.datasource.username", ORACLE::getUsername);
        registry.add("spring.datasource.password", ORACLE::getPassword);
        registry.add("spring.datasource.driver-class-name", ORACLE::getDriverClassName);
    }
}
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileTestJava`
Expected: BUILD SUCCESSFUL. `org.testcontainers.oracle.OracleContainer` import가 풀리지 않으면 oracle-free 모듈 좌표를 재확인한다(클래스 패키지는 `org.testcontainers.oracle`).

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/test/java/com/kdb/it/support/AbstractOracleRepositoryTest.java
git commit -m "test: 싱글톤 Oracle 컨테이너 @DataJpaTest 베이스 클래스"
```

---

## Task 4: 하네스 스모크 테스트 (RED → GREEN)

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/common/code/repository/OracleHarnessSmokeTest.java`

스모크 테스트는 (a) 컨테이너 기동, (b) 전체 엔티티 스키마 생성, (c) JPA 리포지토리 와이어링, (d) JPQL 라운드트립을 한 번에 검증한다. 엔티티 객체를 만들지 않고 빈 스키마 조회로 확인한다.

- [ ] **Step 1: 스모크 테스트 작성**

```java
package com.kdb.it.common.code.repository;

import com.kdb.it.support.AbstractOracleRepositoryTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Testcontainers Oracle 통합 테스트 하네스 스모크")
class OracleHarnessSmokeTest extends AbstractOracleRepositoryTest {

    @Autowired
    CodeRepository codeRepository;

    @Test
    @DisplayName("빈 스키마에서 공통코드 카운트는 0이고 단건 조회는 비어 있다")
    void emptySchema_returnsNoRows() {
        assertThat(codeRepository.count()).isZero();
        assertThat(codeRepository.findByCIdAndCdvaAndSttDtAndDelYn("X", "Y", "20260101", "N"))
                .isEmpty();
    }
}
```

- [ ] **Step 2: 테스트 실행 (스키마 생성 검증)**

Run: `cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.common.code.repository.OracleHarnessSmokeTest"`
Expected: 최초 실행은 이미지 기동으로 수십 초 소요 후 **PASS**.

스키마 생성 실패 시(예: `SchemaManagementException` 또는 특정 엔티티 DDL 오류)는 로그가 **문제 엔티티/컬럼**을 지목한다. 이 경우:
- 뷰 매핑 엔티티가 있으면(현재 `V_ITPAPP_LOG_FEED`는 `@Entity`가 아니라 EntityManager 네이티브로만 조회하므로 대상 아님) `@Subselect`/`@Immutable` 처리 또는 통합 테스트 대상에서 제외.
- Oracle 전용 컬럼 정의로 ddl-auto 생성이 실패하는 엔티티는 해당 `@Column` 매핑을 점검(이 plan 범위에서는 매핑 수정 없이 통과하는 것이 정상 기대값 — 실패하면 별도 이슈로 분리하고 본 plan은 통과하는 엔티티 부분집합으로 스모크를 한정).

- [ ] **Step 3: CI 게이트(단위 test)에서 제외됨을 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.code.repository.OracleHarnessSmokeTest"`
Expected: `No tests found` 또는 해당 테스트가 **실행되지 않음**(it 태그 제외). 즉 기본 `test` 게이트는 Docker 없이도 깨지지 않는다.

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/test/java/com/kdb/it/common/code/repository/OracleHarnessSmokeTest.java
git commit -m "test: Oracle 통합 테스트 하네스 스모크(빈 스키마 라운드트립)"
```

---

## Task 5: 문서화 — 실행 방법 기록

**Files:**
- Modify: `it_backend/CLAUDE.md` (§5.9 테스트 기준 인접에 통합 테스트 실행법 1단락 추가)

- [ ] **Step 1: 통합 테스트 실행법 추가**

`it_backend/CLAUDE.md` §5.9 "테스트 기준" 섹션 끝에 다음 단락을 추가한다.

```markdown
- **통합 테스트(Testcontainers Oracle, 로컬 전용)**: `@Tag("it")` 부착 테스트는 기본 `./gradlew test`에서 제외되며 `./gradlew integrationTest`로만 실행한다. Docker와 `gvenzl/oracle-free:slim-faststart` 이미지가 필요하고, 베이스 클래스는 `com.kdb.it.support.AbstractOracleRepositoryTest`다. 스키마는 Hibernate `ddl-auto=create-drop`가 엔티티에서 생성하며, 뷰(`V_ITPAPP_LOG_FEED`) 의존 검증·인덱스 EXPLAIN은 실제 로컬 Oracle에서 수행한다.
```

- [ ] **Step 2: Commit**

```bash
git add it_backend/CLAUDE.md
git commit -m "docs: 통합 테스트(Testcontainers, 로컬 전용) 실행법 백엔드 가이드에 추가"
```

---

## Self-Review (작성자 확인 완료)

- **Spec 커버리지**: spec §3(P0)의 의존성·싱글톤 컨테이너·세션/스키마(ddl-auto 결정 반영)·베이스 클래스·로컬 전용 게이트·스모크 산출물을 Task 0~5가 모두 구현. ✔
- **Placeholder 스캔**: TBD/모호 단계 없음. 스키마 생성 실패 분기는 실제 런타임 진단에 따른 TDD 루프로 구체화. ✔
- **타입 일관성**: 클래스명 `AbstractOracleRepositoryTest`/`OracleHarnessSmokeTest`, 프로파일 `test-it`, 태그 `it`, 태스크 `integrationTest`가 전 Task에서 일관. `CodeRepository.findByCIdAndCdvaAndSttDtAndDelYn` 시그니처는 실제 소스와 일치. ✔
```

