# CQ-01 백엔드 동결선 + CouncilController 분해 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 대형 파일의 순증가를 자동 게이트로 차단하고, `CouncilController` 1,215줄을 URL 불변·로직 무변경으로 7개 컨트롤러로 분해한다.

**Architecture:** 세 겹의 안전망을 먼저 세운 뒤 이동한다. ① `MaxLinesRatchetTest`가 800줄 초과 파일 7개를 기준선으로 동결하고 신규 초과를 차단한다. ② `CouncilRouteContractTest`가 `/api/council` 하위 42개 (HTTP 메서드, 경로) 쌍을 golden 목록으로 고정해 이동이 URL을 바꾸지 않았음을 증명한다. ③ 테스트가 0건인 `plan-evaluation`·`plan-targets` 5개 라우트를 먼저 보강해 분할 후 JaCoCo 클래스별 70% 규칙을 통과시킨다. 그다음에야 컨트롤러를 옮긴다.

**Tech Stack:** Java 25, Spring Boot 4.1, JUnit 5, Spring Test(`@WebMvcTest`), AssertJ, Mockito(`@MockitoBean`), Gradle, spotless(google-java-format AOSP), JaCoCo

**Spec:** [`docs/superpowers/specs/2026-08-05-cq01-council-controller-decomposition-design.md`](../specs/2026-08-05-cq01-council-controller-decomposition-design.md)

## Global Constraints

- 작업 디렉터리는 `C:\it\it_backend`. 모든 Gradle 명령은 이 디렉터리에서 실행한다.
- 이 계획은 **백엔드 단독 변경**이다. `it_frontend`·`it_database`는 건드리지 않는다. 커밋은 `git -C C:\it\it_backend` 로 백엔드 저장소 `main`에 만든다(4-repo 토폴로지).
- 라우트 URL은 **하나도 바꾸지 않는다**. 추가·삭제·변경 전부 금지.
- 컨트롤러 메서드의 시그니처·본문·`@Operation`·`@ApiResponses`·`@Parameter`·메서드 Javadoc은 **문자 단위로 그대로** 옮긴다. 문구를 다듬지 않는다(BE-31 소관).
- 신규 컨트롤러 7개는 전부 `com.kdb.it.domain.council.controller` 패키지에 두고, `@RestController`·`@RequestMapping("/api/council")`·`@RequiredArgsConstructor`·`@Tag(name = "Council", description = "정보화실무협의회 관리 API")`를 **동일하게** 부여한다. `@Tag`가 같아야 Swagger 그룹과 OpenAPI 스펙이 변하지 않는다.
- 모든 신규 주석은 한글로 쓴다. public API·service 메서드 JavaDoc에는 입력값과 실패 조건을 함께 적는다(루트 `CLAUDE.md` §4.1).
- 각 태스크의 마지막 커밋 직전에 `./gradlew spotlessApply`를 실행한다. spotless는 google-java-format AOSP(4칸 들여쓰기)를 강제하며 `check`에 연결돼 있다.
- 줄 수 측정의 정의는 `Files.readAllLines(path, UTF_8).size()`다. **PowerShell `Get-Content | Measure-Object -Line`을 쓰지 않는다** — `Measure-Object -Line`은 빈 문자열의 줄 수를 0으로 계산해 빈 줄을 통째로 누락한다(Task 1에서 확인: `AdminService.java` 866줄 − 빈 줄 61줄 = 805). 스팟체크는 `[System.IO.File]::ReadAllLines($p).Length` 또는 `(Get-Content $p).Count`를 쓴다.
- 기준선 파일의 경로 키는 `src/main/java` 기준 상대 경로이며 구분자는 항상 `/`다.

---

## File Structure

| 경로 | 책임 | 태스크 |
| --- | --- | --- |
| `src/test/java/com/kdb/it/architecture/MaxLinesRatchetTest.java` | 800줄 동결선 게이트 + 게이트 자체 검증 | 1 |
| `src/test/resources/architecture/max-lines-baselines.properties` | 기준선 SoT (`경로=줄수`) | 1, 4 |
| `src/test/java/com/kdb/it/domain/council/controller/CouncilRouteContractTest.java` | `/api/council` 라우트 42개 golden 계약 | 2, 4 |
| `src/test/java/com/kdb/it/domain/council/controller/CouncilControllerTest.java` | 기존 컨트롤러 테스트 (보강 → 축소) | 3, 4, 5 |
| `src/main/java/com/kdb/it/domain/council/controller/CouncilController.java` | 목록·생성·상세 3개 라우트 (잔존) | 4 |
| `.../CouncilFeasibilityController.java` | `/feasibility` 3개 | 4 |
| `.../CouncilLifecycleController.java` | 승인·상태전이·생략요청 10개 | 4 |
| `.../CouncilCommitteeController.java` | `/committee` 4개 | 4 |
| `.../CouncilScheduleController.java` | `/schedule` 5개 | 4 |
| `.../CouncilEvaluationController.java` | `/evaluation`·`/plan-*` 8개 | 4 |
| `.../CouncilResultController.java` | `/result` 8개 + `/notify` 1개 | 4 |
| `src/test/java/.../CouncilControllerSecurityTest.java` | `/result/review/sync` 권한 경계 | 4 |
| `src/test/java/.../Council{Feasibility,Lifecycle,Committee,Schedule,Evaluation,Result,Qna}ControllerTest.java` | 분할된 컨트롤러 테스트 | 5 |
| `C:\it\TASK.md` | CQ-01 항목 갱신 | 6 |
| `C:\it\versions.lock` | 호환 커밋 조합 갱신 | 6 |

---

## Task 1: 동결선 게이트 (MaxLinesRatchetTest)

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/architecture/MaxLinesRatchetTest.java`
- Create: `it_backend/src/test/resources/architecture/max-lines-baselines.properties`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `MaxLinesRatchetTest.findViolations(Map<String,Integer> baseline, Map<String,Integer> actual, int limit)` → `List<String>` (위반 메시지 목록, 위반 없으면 빈 리스트). Task 4가 `max-lines-baselines.properties`에서 `CouncilController` 항목을 제거한다.

---

- [ ] **Step 1: 기준선 파일을 만든다**

`it_backend/src/test/resources/architecture/max-lines-baselines.properties`:

```properties
# 백엔드 운영 소스 800줄 초과 파일의 동결선 (CQ-01 / Wave D-1)
#
# 규칙
#   1. 여기 적힌 파일의 실제 줄 수는 기준값과 정확히 일치해야 한다 (증가·감소 모두 실패).
#   2. 여기 없는 src/main/java 파일이 800줄을 넘으면 실패한다.
#   3. 여기 적힌 경로가 실재하지 않으면 실패한다.
#
# 기능 추가로 불가피하게 초과하면 같은 PR에서 동등 이상 분량을 추출해 상쇄한다.
# 분해로 줄었으면 같은 커밋에서 기준값을 실측값으로 낮추고, 800줄 이하가 되면 항목을 지운다.
#
# 경로는 src/main/java 기준 상대 경로이며 구분자는 항상 '/'다.
# 측정 정의: Files.readAllLines(path, UTF_8).size()
#
# 기준 시점: 2026-08-05 / backend 9b5104e9
com/kdb/it/domain/budget/project/service/ProjectService.java=1549
com/kdb/it/domain/council/controller/CouncilController.java=1279
com/kdb/it/domain/budget/cost/service/CostService.java=1159
com/kdb/it/domain/budget/work/service/BudgetWorkService.java=1156
com/kdb/it/domain/budget/project/dto/ProjectDto.java=1070
com/kdb/it/domain/council/dto/CouncilDto.java=990
com/kdb/it/common/admin/service/AdminService.java=866
com/kdb/it/common/approval/service/ApplicationService.java=852
com/kdb/it/domain/budget/cost/dto/CostDto.java=801
```

- [ ] **Step 2: 기준값이 실제와 맞는지 먼저 확인한다**

PowerShell에서 실행:

```bash
cd C:\it\it_backend; Get-ChildItem -Path 'src\main\java' -Recurse -Filter *.java | ForEach-Object { [pscustomobject]@{ L=[System.IO.File]::ReadAllLines($_.FullName).Length; P=$_.FullName } } | Where-Object { $_.L -gt 800 } | Sort-Object L -Descending | ForEach-Object { "{0,6}  {1}" -f $_.L, $_.P }
```

기대 출력: 9개 파일이 `1549 / 1279 / 1159 / 1156 / 1070 / 990 / 866 / 852 / 801` 순으로 나온다. 숫자가 다르면 **기준선 파일의 값을 실측값으로 고친 뒤** 다음 단계로 간다(HEAD가 `9b5104e9`에서 진행됐을 수 있다).

- [ ] **Step 3: 실패하는 테스트를 쓴다 — 판정 로직 단위 테스트**

`it_backend/src/test/java/com/kdb/it/architecture/MaxLinesRatchetTest.java`:

```java
package com.kdb.it.architecture;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.TreeMap;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 백엔드 운영 소스 파일 크기 동결선(ratchet) 게이트 — CQ-01 / Wave D-1.
 *
 * <p>기준선은 {@code src/test/resources/architecture/max-lines-baselines.properties}가 단일 진실
 * 공급원입니다. 기준값 변경이 diff에 한 줄로 드러나도록 테스트 코드와 분리했습니다.
 *
 * <p>줄 수 측정 정의는 {@code Files.readAllLines(path, UTF_8).size()}입니다. spotless의 {@code
 * endWithNewline()}이 강제되므로 이 값은 {@code wc -l}, PowerShell {@code Measure-Object -Line} 결과와
 * 일치합니다. 다른 방식으로 세면 기준값이 흔들리므로 이 정의를 바꾸지 마십시오.
 */
class MaxLinesRatchetTest {

    /** 기준선에 없는 파일에 허용되는 최대 줄 수 */
    private static final int LIMIT = 800;

    private static final String BASELINE_RESOURCE = "/architecture/max-lines-baselines.properties";

    // =====================================================================
    // 판정 로직 (순수 함수 — 아래 단위 테스트가 이 로직 자체를 검증한다)
    // =====================================================================

    /**
     * 기준선과 실측값을 비교해 위반 메시지 목록을 만든다.
     *
     * @param baseline 기준선 (경로 → 기준 줄 수). 경로는 {@code src/main/java} 기준 상대 경로
     * @param actual 실측값 (경로 → 실제 줄 수). 기준선 경로가 없으면 "실재하지 않음" 위반이 된다
     * @param limit 기준선에 없는 파일에 허용되는 최대 줄 수
     * @return 위반 메시지 목록. 위반이 없으면 빈 리스트
     */
    static List<String> findViolations(
            Map<String, Integer> baseline, Map<String, Integer> actual, int limit) {
        List<String> violations = new ArrayList<>();

        for (Map.Entry<String, Integer> entry : new TreeMap<>(baseline).entrySet()) {
            String path = entry.getKey();
            int expected = entry.getValue();
            Integer measured = actual.get(path);

            if (measured == null) {
                violations.add(
                        "[경로 부재] %s — 기준선에 있으나 파일이 없습니다. 파일을 옮기거나 지웠다면 기준선 항목도 함께 갱신하십시오."
                                .formatted(path));
            } else if (measured > expected) {
                violations.add(
                        "[증가] %s — 기준 %d줄, 실측 %d줄 (+%d). 같은 PR에서 동등 이상 분량을 추출해 상쇄하거나, 분해 후 기준값을 낮추십시오."
                                .formatted(path, expected, measured, measured - expected));
            } else if (measured < expected) {
                violations.add(
                        "[감소] %s — 기준 %d줄, 실측 %d줄 (%d). 분해했다면 기준값을 실측값으로 낮추십시오. 800줄 이하가 되면 항목을 지우십시오."
                                .formatted(path, expected, measured, measured - expected));
            }
        }

        for (Map.Entry<String, Integer> entry : new TreeMap<>(actual).entrySet()) {
            String path = entry.getKey();
            if (!baseline.containsKey(path) && entry.getValue() > limit) {
                violations.add(
                        "[신규 초과] %s — %d줄. %d줄을 넘는 신규 파일은 허용하지 않습니다. 관심사를 분리하십시오."
                                .formatted(path, entry.getValue(), limit));
            }
        }

        return violations;
    }

    // =====================================================================
    // 게이트 자체 검증
    // =====================================================================

    @Test
    @DisplayName("기준값보다 늘어나면 증가 위반을 낸다")
    void 증가를_검출한다() {
        List<String> violations =
                findViolations(Map.of("a/B.java", 100), Map.of("a/B.java", 101), LIMIT);

        assertThat(violations).hasSize(1);
        assertThat(violations.get(0)).startsWith("[증가] a/B.java").contains("+1");
    }

    @Test
    @DisplayName("기준값보다 줄어들면 감소 위반을 낸다 — 분해와 기준선 갱신을 같은 커밋으로 묶기 위함")
    void 감소를_검출한다() {
        List<String> violations =
                findViolations(Map.of("a/B.java", 100), Map.of("a/B.java", 40), LIMIT);

        assertThat(violations).hasSize(1);
        assertThat(violations.get(0)).startsWith("[감소] a/B.java");
    }

    @Test
    @DisplayName("기준선 경로가 실재하지 않으면 위반을 낸다")
    void 경로_부재를_검출한다() {
        List<String> violations = findViolations(Map.of("a/B.java", 100), Map.of(), LIMIT);

        assertThat(violations).hasSize(1);
        assertThat(violations.get(0)).startsWith("[경로 부재] a/B.java");
    }

    @Test
    @DisplayName("기준선 밖 파일이 한계를 넘으면 위반을 낸다")
    void 신규_초과를_검출한다() {
        List<String> violations = findViolations(Map.of(), Map.of("a/New.java", 801), LIMIT);

        assertThat(violations).hasSize(1);
        assertThat(violations.get(0)).startsWith("[신규 초과] a/New.java");
    }

    @Test
    @DisplayName("기준값과 실측이 같고 신규 초과가 없으면 위반이 없다")
    void 위반이_없으면_빈_목록이다() {
        List<String> violations =
                findViolations(
                        Map.of("a/B.java", 100),
                        Map.of("a/B.java", 100, "a/Small.java", 10),
                        LIMIT);

        assertThat(violations).isEmpty();
    }
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

```bash
cd C:\it\it_backend; ./gradlew test --tests "com.kdb.it.architecture.MaxLinesRatchetTest"
```

기대: 5개 테스트 PASS. (아직 실제 소스 스캔 테스트가 없으므로 전부 순수 함수 검증이다.)

- [ ] **Step 5: 실제 소스 트리를 스캔하는 테스트를 추가한다**

`MaxLinesRatchetTest` 클래스의 `위반이_없으면_빈_목록이다()` 아래에 다음을 붙인다:

```java
    // =====================================================================
    // 실제 소스 트리 검증
    // =====================================================================

    @Test
    @DisplayName("운영 소스가 기준선과 일치하고 기준선 밖 파일이 800줄을 넘지 않는다")
    void 운영_소스가_동결선을_지킨다() throws IOException {
        Map<String, Integer> baseline = loadBaseline();
        Map<String, Integer> actual = measureSourceTree(sourceRoot());

        List<String> violations = findViolations(baseline, actual, LIMIT);

        assertThat(violations)
                .withFailMessage(
                        """
                        파일 크기 동결선 위반 %d건:

                        %s

                        기준선 파일: src/test/resources%s
                        배경: TASK.md CQ-01 / docs/superpowers/plans/2026-08-05-cq01-council-controller-decomposition.md
                        """
                                .formatted(
                                        violations.size(),
                                        String.join(System.lineSeparator(), violations),
                                        BASELINE_RESOURCE))
                .isEmpty();
    }

    // =====================================================================
    // 입출력 헬퍼
    // =====================================================================

    /** 기준선 리소스를 읽어 경로 → 줄 수 맵으로 만든다. 리소스가 없으면 IllegalStateException. */
    private static Map<String, Integer> loadBaseline() throws IOException {
        Properties properties = new Properties();
        try (InputStream in = MaxLinesRatchetTest.class.getResourceAsStream(BASELINE_RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("기준선 리소스를 찾을 수 없습니다: " + BASELINE_RESOURCE);
            }
            properties.load(new InputStreamReader(in, StandardCharsets.UTF_8));
        }
        Map<String, Integer> baseline = new TreeMap<>();
        for (String name : properties.stringPropertyNames()) {
            baseline.put(name, Integer.parseInt(properties.getProperty(name).trim()));
        }
        return baseline;
    }

    /** src/main/java 하위 모든 .java 파일의 줄 수를 잰다. 키는 루트 기준 상대 경로('/' 구분자). */
    private static Map<String, Integer> measureSourceTree(Path root) throws IOException {
        Map<String, Integer> measured = new TreeMap<>();
        try (Stream<Path> paths = Files.walk(root)) {
            for (Path path : paths.filter(p -> p.toString().endsWith(".java")).toList()) {
                String key = root.relativize(path).toString().replace('\\', '/');
                measured.put(key, Files.readAllLines(path, StandardCharsets.UTF_8).size());
            }
        }
        return measured;
    }

    /**
     * src/main/java 위치를 찾는다.
     *
     * <p>Gradle {@code test} 태스크의 작업 디렉터리는 프로젝트 디렉터리(it_backend)이므로 상대 경로가 바로 맞습니다.
     * IDE가 워크스페이스 루트에서 실행하는 경우를 대비해 {@code it_backend/} 접두 경로도 확인합니다.
     */
    private static Path sourceRoot() {
        Path direct = Path.of("src", "main", "java");
        if (Files.isDirectory(direct)) {
            return direct;
        }
        Path nested = Path.of("it_backend", "src", "main", "java");
        if (Files.isDirectory(nested)) {
            return nested;
        }
        throw new IllegalStateException(
                "src/main/java를 찾을 수 없습니다. 작업 디렉터리: " + Path.of("").toAbsolutePath());
    }
```

- [ ] **Step 6: 게이트가 실제로 동작하는지 확인한다 (일부러 깨뜨려 본다)**

기준선 파일에서 `AdminService.java=805`를 `AdminService.java=806`으로 잠깐 바꾼 뒤:

```bash
cd C:\it\it_backend; ./gradlew test --tests "com.kdb.it.architecture.MaxLinesRatchetTest"
```

기대: FAIL. 실패 메시지에 `[감소] com/kdb/it/common/admin/service/AdminService.java — 기준 806줄, 실측 805줄 (-1)`이 보인다. 확인 후 `805`로 되돌린다.

- [ ] **Step 7: 전체 게이트를 돌린다**

```bash
cd C:\it\it_backend; ./gradlew spotlessApply; ./gradlew check
```

기대: BUILD SUCCESSFUL. 실패하면 `MaxLinesRatchetTest` 관련인지 기존 테스트인지 먼저 구분한다.

- [ ] **Step 8: 커밋**

```bash
git -C C:\it\it_backend add src/test/java/com/kdb/it/architecture/MaxLinesRatchetTest.java src/test/resources/architecture/max-lines-baselines.properties
git -C C:\it\it_backend commit -m "test: CQ-01 파일 크기 동결선 게이트 도입 (Wave D-1)"
```

---

## Task 2: 라우트 계약 characterization 테스트

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/domain/council/controller/CouncilRouteContractTest.java`

**Interfaces:**
- Consumes: 없음
- Produces: golden 목록 상수 `EXPECTED_ROUTES` (`List<String>`, 42개, `"METHOD /path"` 형식, 사전순 정렬). Task 4가 `@WebMvcTest`의 컨트롤러 목록만 바꾸고 **이 상수는 한 글자도 바꾸지 않는다**.

---

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`it_backend/src/test/java/com/kdb/it/domain/council/controller/CouncilRouteContractTest.java`:

```java
package com.kdb.it.domain.council.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.common.system.service.CustomUserDetailsService;
import com.kdb.it.config.TestSecurityConfig;
import com.kdb.it.domain.council.service.CommitteeService;
import com.kdb.it.domain.council.service.CouncilApprovalService;
import com.kdb.it.domain.council.service.CouncilService;
import com.kdb.it.domain.council.service.CouncilSkipService;
import com.kdb.it.domain.council.service.EvaluationService;
import com.kdb.it.domain.council.service.FeasibilityService;
import com.kdb.it.domain.council.service.PlanEvaluationService;
import com.kdb.it.domain.council.service.ResultService;
import com.kdb.it.domain.council.service.ScheduleService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * {@code /api/council} 라우트 계약 characterization 테스트 — CQ-01 컨트롤러 분해 안전망.
 *
 * <p>컨트롤러를 7개로 분해하는 동안 URL이 하나도 바뀌지 않았음을 기계적으로 증명합니다. 분해 시 이 파일에서 바꿔도 되는 것은
 * {@code @WebMvcTest}의 컨트롤러 목록과 {@code @MockitoBean} 목록뿐이며, {@link #EXPECTED_ROUTES}는 한 글자도
 * 바꾸지 않습니다.
 *
 * <p>슬라이스에 등재된 컨트롤러의 매핑만 관측하므로 QnA 컨트롤러({@code /api/council/{asctId}/qna},
 * {@code /main-qna})의 라우트는 이 목록에 포함되지 않습니다.
 */
@WebMvcTest(CouncilController.class)
@Import(TestSecurityConfig.class)
class CouncilRouteContractTest {

    /** 분해 전 실측한 42개 라우트. 사전순 정렬된 {@code "METHOD /path"} 문자열. */
    private static final List<String> EXPECTED_ROUTES =
            List.of(
                    "GET /api/council",
                    "GET /api/council/skip-requests",
                    "GET /api/council/{asctId}",
                    "GET /api/council/{asctId}/committee",
                    "GET /api/council/{asctId}/committee/default",
                    "GET /api/council/{asctId}/evaluation",
                    "GET /api/council/{asctId}/evaluation/my",
                    "GET /api/council/{asctId}/feasibility",
                    "GET /api/council/{asctId}/plan-evaluation",
                    "GET /api/council/{asctId}/plan-evaluation/my",
                    "GET /api/council/{asctId}/plan-evaluation/result-summary",
                    "GET /api/council/{asctId}/plan-targets",
                    "GET /api/council/{asctId}/result",
                    "GET /api/council/{asctId}/result/review/my",
                    "GET /api/council/{asctId}/schedule",
                    "GET /api/council/{asctId}/schedule/my",
                    "GET /api/council/{asctId}/skip-request",
                    "PATCH /api/council/{asctId}/approval",
                    "PATCH /api/council/{asctId}/complete",
                    "PATCH /api/council/{asctId}/skip",
                    "PATCH /api/council/{asctId}/start",
                    "PATCH /api/council/{asctId}/start-preparation",
                    "POST /api/council",
                    "POST /api/council/{asctId}/approval",
                    "POST /api/council/{asctId}/committee",
                    "POST /api/council/{asctId}/evaluation",
                    "POST /api/council/{asctId}/feasibility",
                    "POST /api/council/{asctId}/notify",
                    "POST /api/council/{asctId}/plan-evaluation",
                    "POST /api/council/{asctId}/result",
                    "POST /api/council/{asctId}/result/approval",
                    "POST /api/council/{asctId}/result/review",
                    "POST /api/council/{asctId}/result/review/sync",
                    "POST /api/council/{asctId}/schedule",
                    "POST /api/council/{asctId}/skip-request",
                    "POST /api/council/{asctId}/skip-request/decision",
                    "PUT /api/council/{asctId}/committee",
                    "PUT /api/council/{asctId}/feasibility",
                    "PUT /api/council/{asctId}/result",
                    "PUT /api/council/{asctId}/result/confirm",
                    "PUT /api/council/{asctId}/schedule/confirm",
                    "PUT /api/council/{asctId}/schedule/confirm-written");

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;

    @MockitoBean private CouncilService councilService;
    @MockitoBean private FeasibilityService feasibilityService;
    @MockitoBean private CouncilApprovalService councilApprovalService;
    @MockitoBean private CommitteeService committeeService;
    @MockitoBean private ScheduleService scheduleService;
    @MockitoBean private EvaluationService evaluationService;
    @MockitoBean private ResultService resultService;
    @MockitoBean private CouncilSkipService councilSkipService;
    @MockitoBean private PlanEvaluationService planEvaluationService;
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    @Test
    @DisplayName("/api/council 라우트 42개가 정확히 일치한다 — 개수·경로·HTTP 메서드·중복 없음")
    void 라우트_계약이_유지된다() {
        assertThat(actualRoutes())
                .withFailMessage(
                        """
                        /api/council 라우트 계약이 깨졌습니다.

                        기대(%d개): %s

                        실제(%d개): %s

                        분해 작업이라면 라우트를 옮기다 누락·오타가 났거나 매핑이 중복됐습니다.
                        EXPECTED_ROUTES를 고치지 말고 컨트롤러를 고치십시오.
                        """
                                .formatted(
                                        EXPECTED_ROUTES.size(),
                                        EXPECTED_ROUTES,
                                        actualRoutes().size(),
                                        actualRoutes()))
                .isEqualTo(EXPECTED_ROUTES);
    }

    /**
     * 슬라이스에 등재된 컨트롤러에서 {@code /api/council}로 시작하는 (HTTP 메서드, 경로) 쌍을 모두 모아 사전순으로 정렬한다.
     *
     * <p>집합이 아니라 정렬된 리스트로 비교하므로 중복 매핑도 검출됩니다.
     */
    private List<String> actualRoutes() {
        return handlerMapping.getHandlerMethods().keySet().stream()
                .flatMap(CouncilRouteContractTest::toRouteStrings)
                .sorted()
                .toList();
    }

    private static java.util.stream.Stream<String> toRouteStrings(RequestMappingInfo info) {
        if (info.getPathPatternsCondition() == null) {
            throw new IllegalStateException(
                    "PathPatterns 기반 매핑이 아닙니다. Spring 설정을 확인하십시오: " + info);
        }
        return info.getPathPatternsCondition().getPatternValues().stream()
                .filter(pattern -> pattern.startsWith("/api/council"))
                .flatMap(
                        pattern ->
                                info.getMethodsCondition().getMethods().stream()
                                        .map(method -> method.name() + " " + pattern));
    }
}
```

- [ ] **Step 2: 테스트를 돌린다**

```bash
cd C:\it\it_backend; ./gradlew test --tests "com.kdb.it.domain.council.controller.CouncilRouteContractTest"
```

기대: **PASS**. 이 테스트는 현재 상태를 기록하는 characterization 테스트이므로 처음부터 통과해야 한다.

FAIL이면 실패 메시지의 "실제" 목록이 진실이다. HEAD가 `9b5104e9`에서 진행되며 라우트가 바뀌었을 수 있으니, **실제 목록을 `EXPECTED_ROUTES`에 반영하고** 스펙 §4.3 표와 §5.1 분할표도 함께 고친 뒤 진행한다. 라우트 개수가 42가 아니면 Task 4의 분할 배정도 다시 계산해야 한다.

- [ ] **Step 3: 전체 게이트를 돌린다**

```bash
cd C:\it\it_backend; ./gradlew spotlessApply; ./gradlew check
```

기대: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
git -C C:\it\it_backend add src/test/java/com/kdb/it/domain/council/controller/CouncilRouteContractTest.java
git -C C:\it\it_backend commit -m "test: /api/council 라우트 42개 계약 characterization 테스트 추가 (CQ-01 분해 안전망)"
```

---

## Task 3: plan-evaluation·plan-targets 5개 라우트 테스트 보강

**왜 지금인가:** `jacocoTestCoverageVerification`이 **클래스별** LINE·BRANCH·COMPLEXITY 70%를 강제하고 컨트롤러는 제외 목록(`build.gradle`의 `jacocoExcludes`)에 없다. 지금은 42개 라우트가 한 클래스에 있어 37개 커버(약 88%)로 통과하지만, `plan-targets`·`plan-evaluation` 계열 5개는 테스트가 0건이다. Task 4에서 분할하면 `CouncilEvaluationController`가 8개 중 3개만 커버돼 약 37%로 떨어져 `check`가 깨진다. 분해 전에 메운다.

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/controller/CouncilControllerTest.java`

**Interfaces:**
- Consumes: 기존 `CouncilControllerTest`의 필드 `mockMvc`, `objectMapper`, `planEvaluationService`, 상수 `ASCT_ID`
- Produces: 테스트 메서드 6개. Task 5가 이들을 `CouncilEvaluationControllerTest`로 옮긴다.

---

- [ ] **Step 1: 현재 테스트 개수를 기록한다**

```bash
cd C:\it\it_backend; (Select-String -Path 'src\test\java\com\kdb\it\domain\council\controller\CouncilControllerTest.java' -Pattern '^    @Test').Count
```

기대: `49`. 이 숫자를 적어 둔다 — Task 5에서 "이동 전후 개수 동일"을 확인하는 기준이다. 다른 값이면 그 값을 기준으로 삼는다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`CouncilControllerTest.java`에서 `saveEvaluation_인증_200()` 메서드의 닫는 `}` 바로 다음(현재 410행 부근, `// M7: 결과서` 구획 주석 **앞**)에 다음을 삽입한다:

```java
    // =========================================================================
    // 계획협의회(dbrTc='02') — 심의 대상 + 사업별 적정/유보
    // =========================================================================

    @Test
    @DisplayName("GET /api/council/{asctId}/plan-targets - 인증된 사용자 → 200 + 계획 요약")
    @WithMockUser(username = "10001")
    void getPlanTargets_인증_200() throws Exception {
        given(planEvaluationService.getPlanTargets(ASCT_ID))
                .willReturn(
                        new CouncilDto.PlanTargetsResponse(
                                "PLN-2026-0001", "2026", "10", List.of(), 0, false));

        mockMvc.perform(get("/api/council/" + ASCT_ID + "/plan-targets"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reqDocNo").value("PLN-2026-0001"))
                .andExpect(jsonPath("$.snapshotIncomplete").value(false));
    }

    @Test
    @DisplayName("GET /api/council/{asctId}/plan-evaluation - 인증된 사용자 → 200 + 평가·판정 배열")
    @WithMockUser(username = "10001")
    void getPlanEvaluations_인증_200() throws Exception {
        given(planEvaluationService.getAllEvaluations(ASCT_ID))
                .willReturn(new CouncilDto.PlanEvaluationSummaryResponse(List.of(), List.of()));

        mockMvc.perform(get("/api/council/" + ASCT_ID + "/plan-evaluation"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.evaluations").isArray())
                .andExpect(jsonPath("$.verdicts").isArray());
    }

    @Test
    @DisplayName("GET /api/council/{asctId}/plan-evaluation/my - 인증된 사용자 → 200 + 본인 평가 목록")
    @WithMockUser(username = "10001")
    void getMyPlanEvaluation_인증_200() throws Exception {
        given(planEvaluationService.getMyEvaluation(anyString(), any()))
                .willReturn(
                        List.of(
                                new CouncilDto.PlanEvaluationItemResponse(
                                        "10001", "홍길동", "ABUS-2026-0001", "Y", "적정 사유")));

        mockMvc.perform(get("/api/council/" + ASCT_ID + "/plan-evaluation/my"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pprtYn").value("Y"));
    }

    @Test
    @DisplayName("POST /api/council/{asctId}/plan-evaluation - 인증된 사용자 → 200")
    @WithMockUser(username = "10001")
    void savePlanEvaluation_인증_200() throws Exception {
        mockMvc.perform(
                        post("/api/council/" + ASCT_ID + "/plan-evaluation")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        objectMapper.writeValueAsString(
                                                new CouncilDto.PlanEvaluationRequest(
                                                        List.of(
                                                                new CouncilDto.PlanEvaluationItem(
                                                                        "ABUS-2026-0001",
                                                                        "Y",
                                                                        "적정 사유"))))))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/council/{asctId}/plan-evaluation - items 비어있음 → 400 (@NotEmpty)")
    @WithMockUser(username = "10001")
    void savePlanEvaluation_빈항목_400() throws Exception {
        mockMvc.perform(
                        post("/api/council/" + ASCT_ID + "/plan-evaluation")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        objectMapper.writeValueAsString(
                                                new CouncilDto.PlanEvaluationRequest(List.of()))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/council/{asctId}/plan-evaluation/result-summary - 인증된 사용자 → 200 + 요약 HTML")
    @WithMockUser(username = "10001")
    void getPlanResultSummary_인증_200() throws Exception {
        given(planEvaluationService.buildResultSummary(ASCT_ID))
                .willReturn(
                        new CouncilDto.PlanResultSummaryResponse(
                                "<table></table>", List.of(), false));

        mockMvc.perform(get("/api/council/" + ASCT_ID + "/plan-evaluation/result-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summaryHtml").value("<table></table>"));
    }
```

새 import는 필요 없다. `given`·`any`·`anyString`·`get`·`post`·`jsonPath`·`status`·`MediaType`·`List`·`CouncilDto`는 이미 임포트돼 있다.

- [ ] **Step 3: 테스트를 돌린다**

```bash
cd C:\it\it_backend; ./gradlew test --tests "com.kdb.it.domain.council.controller.CouncilControllerTest"
```

기대: 55개 PASS (49 + 6).

`savePlanEvaluation_빈항목_400`이 FAIL하면 `GlobalExceptionHandler`가 `MethodArgumentNotValidException`을 400이 아닌 다른 상태로 매핑하는 것이다. `src/test/java/com/kdb/it/exception/GlobalExceptionHandlerTest.java`에서 실제 매핑을 확인하고 기대 상태를 그에 맞춘다 — **핸들러를 고치지 않는다**(이 계획의 범위 밖).

- [ ] **Step 4: 전체 게이트를 돌린다**

```bash
cd C:\it\it_backend; ./gradlew spotlessApply; ./gradlew check
```

기대: BUILD SUCCESSFUL.

- [ ] **Step 5: 커밋**

```bash
git -C C:\it\it_backend add src/test/java/com/kdb/it/domain/council/controller/CouncilControllerTest.java
git -C C:\it\it_backend commit -m "test: 계획협의회 plan-targets/plan-evaluation 5개 라우트 테스트 보강"
```

---

## Task 4: CouncilController 7분할

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilController.java` (1,215줄 → ~160줄)
- Create: `.../CouncilFeasibilityController.java`
- Create: `.../CouncilLifecycleController.java`
- Create: `.../CouncilCommitteeController.java`
- Create: `.../CouncilScheduleController.java`
- Create: `.../CouncilEvaluationController.java`
- Create: `.../CouncilResultController.java`
- Modify: `it_backend/src/test/resources/architecture/max-lines-baselines.properties` (CouncilController 항목 제거)
- Modify: `it_backend/src/test/java/.../CouncilRouteContractTest.java` (`@WebMvcTest` 목록만)
- Modify: `it_backend/src/test/java/.../CouncilControllerTest.java` (`@WebMvcTest` 목록만)
- Modify: `it_backend/src/test/java/.../CouncilControllerSecurityTest.java` (`@WebMvcTest` 대상 교체)

**Interfaces:**
- Consumes: Task 2의 `EXPECTED_ROUTES`(불변), Task 1의 기준선 파일, Task 3이 보강한 테스트 6개
- Produces: 컨트롤러 클래스 7개. Task 5가 각각에 대응하는 테스트 클래스를 만든다.

**메서드 배정 (원본 42개 전부)**

| 새 클래스 | 옮길 메서드 (원본 등장 순서) | 주입 서비스 |
| --- | --- | --- |
| `CouncilController` (잔존) | `getCouncilList`, `createCouncil`, `getCouncil` | `CouncilService` |
| `CouncilFeasibilityController` | `getFeasibility`, `saveFeasibility`, `updateFeasibility` | `FeasibilityService` |
| `CouncilLifecycleController` | `requestApproval`, `processApprovalCallback`, `startCouncil`, `completeCouncil`, `skipCouncil`, `startPreparation`, `createSkipRequest`, `decideSkipRequest`, `getSkipRequests`, `getSkipRequest` | `CouncilService`, `CouncilApprovalService`, `CouncilSkipService` |
| `CouncilCommitteeController` | `getDefaultCommittee`, `getCommittee`, `saveCommittee`, `updateCommittee` | `CommitteeService` |
| `CouncilScheduleController` | `getScheduleStatus`, `getMySchedule`, `submitSchedule`, `confirmSchedule`, `confirmWrittenMeeting` | `ScheduleService`, `CouncilService` |
| `CouncilEvaluationController` | `getAllEvaluations`, `getMyEvaluation`, `saveEvaluation`, `getPlanTargets`, `getPlanEvaluations`, `getMyPlanEvaluation`, `savePlanEvaluation`, `getPlanResultSummary` | `EvaluationService`, `PlanEvaluationService` |
| `CouncilResultController` | `getResult`, `saveResult`, `updateResult`, `confirmResult`, `reviewResult`, `syncReviewStatus`, `getMyResultReview`, `requestResultApproval`, `notifyCouncil` | `ResultService`, `CouncilService`, `CouncilApprovalService` |

주입 서비스는 실측 확인 결과다(`confirmSchedule`·`confirmWrittenMeeting`이 `councilService`도 호출하고, `notifyCouncil`은 `councilService`만 호출한다). 이동 후 각 클래스에서 **실제로 쓰이지 않는 필드가 0개**여야 한다.

---

- [ ] **Step 1: `CouncilFeasibilityController`를 만든다**

`it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilFeasibilityController.java`:

```java
package com.kdb.it.domain.council.controller;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.council.dto.CouncilDto;
import com.kdb.it.domain.council.service.FeasibilityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 정보화실무협의회 타당성검토표 REST 컨트롤러 (M4)
 *
 * <p>기본 URL: {@code /api/council} — URL은 다른 협의회 컨트롤러와 공유하고 클래스만 책임별로 분리했습니다(CQ-01).
 *
 * <p>담당 범위: {@code /{asctId}/feasibility} 조회·저장·수정.
 */
@RestController
@RequestMapping("/api/council")
@RequiredArgsConstructor
@Tag(name = "Council", description = "정보화실무협의회 관리 API")
public class CouncilFeasibilityController {

    /** 타당성검토표 서비스 */
    private final FeasibilityService feasibilityService;

    // 원본 CouncilController에서 getFeasibility, saveFeasibility, updateFeasibility 세 메서드를
    // Javadoc 첫 줄(`/**`)부터 닫는 `}`까지 통째로 옮겨 붙인다. 문자 하나도 고치지 않는다.
}
```

원본 `CouncilController.java`에서 `getFeasibility`, `saveFeasibility`, `updateFeasibility`를 각각 Javadoc `/**`부터 닫는 `}`까지 **잘라내어** 위 주석 자리에 붙인다. 원본에서는 지운다. 남는 import는 Step 8의 `spotlessApply`(`removeUnusedImports`)가 정리한다.

- [ ] **Step 2: 나머지 5개 컨트롤러를 같은 방식으로 만든다**

각 파일의 클래스 헤더는 아래와 같다. 본문(메서드)은 배정표대로 원본에서 잘라 붙인다.

각 파일은 Step 1의 `CouncilFeasibilityController`와 동일하게 `package com.kdb.it.domain.council.controller;`로 시작한다. import는 원본 `CouncilController.java`의 1~34행 import 블록을 그대로 복사해 넣은 뒤 `spotlessApply`의 `removeUnusedImports`가 정리하게 한다 — 손으로 고르지 말 것(누락 시 컴파일 오류로 돌아온다).

`CouncilLifecycleController.java`:

```java
/**
 * 정보화실무협의회 상태 전이·결재·생략요청 REST 컨트롤러
 *
 * <p>기본 URL: {@code /api/council} — URL은 다른 협의회 컨트롤러와 공유하고 클래스만 책임별로 분리했습니다(CQ-01).
 *
 * <p>담당 범위: 결재 요청·콜백({@code /approval}), 상태 전이({@code /start}, {@code /complete}, {@code
 * /skip}, {@code /start-preparation}), 생략요청({@code /skip-request}, {@code /skip-requests}).
 */
@RestController
@RequestMapping("/api/council")
@RequiredArgsConstructor
@Tag(name = "Council", description = "정보화실무협의회 관리 API")
public class CouncilLifecycleController {

    /** 협의회 기본 서비스 (목록/상태 관리) */
    private final CouncilService councilService;

    /** 협의회 결재 연동 서비스 */
    private final CouncilApprovalService councilApprovalService;

    /** 협의회 생략요청 서비스 */
    private final CouncilSkipService councilSkipService;
```

`CouncilCommitteeController.java`:

```java
/**
 * 정보화실무협의회 평가위원 선정 REST 컨트롤러 (M6)
 *
 * <p>기본 URL: {@code /api/council} — URL은 다른 협의회 컨트롤러와 공유하고 클래스만 책임별로 분리했습니다(CQ-01).
 *
 * <p>담당 범위: {@code /{asctId}/committee} 기본 후보 조회·목록 조회·저장·수정.
 */
@RestController
@RequestMapping("/api/council")
@RequiredArgsConstructor
@Tag(name = "Council", description = "정보화실무협의회 관리 API")
public class CouncilCommitteeController {

    /** 평가위원 서비스 */
    private final CommitteeService committeeService;
```

`CouncilScheduleController.java`:

```java
/**
 * 정보화실무협의회 일정 취합·확정 REST 컨트롤러 (M6)
 *
 * <p>기본 URL: {@code /api/council} — URL은 다른 협의회 컨트롤러와 공유하고 클래스만 책임별로 분리했습니다(CQ-01).
 *
 * <p>담당 범위: {@code /{asctId}/schedule} 현황·본인 일정 조회, 제출, 대면 확정, 서면 확정.
 */
@RestController
@RequestMapping("/api/council")
@RequiredArgsConstructor
@Tag(name = "Council", description = "정보화실무협의회 관리 API")
public class CouncilScheduleController {

    /** 일정 서비스 */
    private final ScheduleService scheduleService;

    /** 협의회 기본 서비스 (일정 확정 시 상태 전이에 사용) */
    private final CouncilService councilService;
```

`CouncilEvaluationController.java`:

```java
/**
 * 정보화실무협의회 평가의견 REST 컨트롤러 (M7)
 *
 * <p>기본 URL: {@code /api/council} — URL은 다른 협의회 컨트롤러와 공유하고 클래스만 책임별로 분리했습니다(CQ-01).
 *
 * <p>담당 범위: 일반 협의회 평가의견({@code /{asctId}/evaluation})과 정보기술부문계획 협의회(dbrTc='02')의 심의 대상·사업별
 * 적정/유보({@code /{asctId}/plan-targets}, {@code /{asctId}/plan-evaluation}).
 */
@RestController
@RequestMapping("/api/council")
@RequiredArgsConstructor
@Tag(name = "Council", description = "정보화실무협의회 관리 API")
public class CouncilEvaluationController {

    /** 평가의견 서비스 */
    private final EvaluationService evaluationService;

    /** 계획협의회 평가 서비스 */
    private final PlanEvaluationService planEvaluationService;
```

`CouncilResultController.java`:

```java
/**
 * 정보화실무협의회 결과서·통보 REST 컨트롤러 (M7)
 *
 * <p>기본 URL: {@code /api/council} — URL은 다른 협의회 컨트롤러와 공유하고 클래스만 책임별로 분리했습니다(CQ-01).
 *
 * <p>담당 범위: 결과서 CRUD·확정({@code /{asctId}/result}), 위원 검토({@code /result/review}), 결재
 * 요청({@code /result/approval}), 결과 통보({@code /{asctId}/notify}).
 *
 * <p>{@code POST /{asctId}/result/review/sync}는 메서드 수준 {@code @PreAuthorize("hasRole('ADMIN')")}로
 * 보호합니다. 원본에서 옮길 때 이 애노테이션을 반드시 함께 가져가십시오.
 */
@RestController
@RequestMapping("/api/council")
@RequiredArgsConstructor
@Tag(name = "Council", description = "정보화실무협의회 관리 API")
public class CouncilResultController {

    /** 결과서 서비스 */
    private final ResultService resultService;

    /** 협의회 기본 서비스 (결과서 저장·확정 시 상태 조회·전이에 사용) */
    private final CouncilService councilService;

    /** 협의회 결재 연동 서비스 */
    private final CouncilApprovalService councilApprovalService;
```

- [ ] **Step 3: 잔존 `CouncilController`를 정리한다**

메서드 39개를 잘라낸 뒤 남는 것은 `getCouncilList`, `createCouncil`, `getCouncil` 3개다. 사용하지 않게 된 필드 8개(`feasibilityService`, `councilApprovalService`, `committeeService`, `scheduleService`, `evaluationService`, `resultService`, `councilSkipService`, `planEvaluationService`)를 지운다. `// ===== M3: ... =====` 형태의 구획 주석도 전부 지운다(클래스가 그 역할을 대신한다).

클래스 Javadoc(현재 36~53행)을 아래로 **교체**한다. 기존 문구는 "전체 협의회 API 엔드포인트를 단일 컨트롤러에서 관리합니다"라고 서술해 분해 후 사실과 다르다.

```java
/**
 * 정보화실무협의회 기본 REST 컨트롤러
 *
 * <p>기본 URL: {@code /api/council}
 *
 * <p>담당 범위: 협의회 목록 조회, 신규 신청, 단건 상세 조회.
 *
 * <p>나머지 엔드포인트는 같은 {@code /api/council} URL을 공유하는 책임별 컨트롤러가 담당합니다(CQ-01 분해).
 *
 * <ul>
 *   <li>{@link CouncilFeasibilityController} — 타당성검토표
 *   <li>{@link CouncilLifecycleController} — 결재·상태 전이·생략요청
 *   <li>{@link CouncilCommitteeController} — 평가위원 선정
 *   <li>{@link CouncilScheduleController} — 일정 취합·확정
 *   <li>{@link CouncilEvaluationController} — 평가의견·계획협의회 적정/유보
 *   <li>{@link CouncilResultController} — 결과서·통보
 *   <li>{@link CouncilQnaController}, {@link CouncilMainQnaController} — 사전질의응답
 * </ul>
 *
 * <p>설계 참조: §2.5 API 설계
 */
```

- [ ] **Step 4: 라우트 계약 테스트의 슬라이스 목록을 넓힌다**

`CouncilRouteContractTest.java`의 `@WebMvcTest`만 교체한다. **`EXPECTED_ROUTES`는 건드리지 않는다.**

```java
@WebMvcTest({
    CouncilController.class,
    CouncilFeasibilityController.class,
    CouncilLifecycleController.class,
    CouncilCommitteeController.class,
    CouncilScheduleController.class,
    CouncilEvaluationController.class,
    CouncilResultController.class
})
```

- [ ] **Step 5: 라우트 계약을 확인한다 — 이 단계가 핵심 검증이다**

```bash
cd C:\it\it_backend; ./gradlew test --tests "com.kdb.it.domain.council.controller.CouncilRouteContractTest"
```

기대: **PASS**. FAIL이면 실패 메시지의 "기대"와 "실제"를 비교해 누락·중복·오타를 찾아 **컨트롤러를 고친다**. `EXPECTED_ROUTES`를 고치는 것은 금지다.

- [ ] **Step 6: 기존 컨트롤러 테스트 2개의 슬라이스를 맞춘다**

`CouncilControllerTest.java`의 `@WebMvcTest`를 아래로 교체한다(테스트 본문·단언은 그대로 둔다. 실제 분리는 Task 5):

```java
@WebMvcTest({
    CouncilController.class,
    CouncilFeasibilityController.class,
    CouncilLifecycleController.class,
    CouncilCommitteeController.class,
    CouncilScheduleController.class,
    CouncilEvaluationController.class,
    CouncilResultController.class,
    CouncilMainQnaController.class,
    CouncilQnaController.class
})
```

`CouncilControllerSecurityTest.java`는 `/result/review/sync`만 검증하므로 대상을 교체한다:

```java
@WebMvcTest(CouncilResultController.class)
```

이 파일의 `@MockitoBean` 목록에서 `CouncilResultController`가 쓰지 않는 6개(`FeasibilityService`, `CommitteeService`, `ScheduleService`, `EvaluationService`, `CouncilSkipService`, `PlanEvaluationService`)와 그 import를 지운다. 남는 것은 `ResultService`, `CouncilService`, `CouncilApprovalService`, `JwtUtil`, `CustomUserDetailsService`다.

- [ ] **Step 7: 기준선에서 `CouncilController` 항목을 지운다**

`max-lines-baselines.properties`에서 아래 한 줄을 삭제한다:

```properties
com/kdb/it/domain/council/controller/CouncilController.java=1215
```

이 삭제는 **이 커밋에 반드시 포함해야 한다**. `CouncilController`가 1,215줄에서 ~160줄로 줄어드는 순간 ratchet의 "감소도 실패" 규칙이 걸리기 때문이다. 이는 결함이 아니라 분해와 기준선 갱신을 분리하지 못하게 하려는 의도된 동작이다.

- [ ] **Step 8: 포맷을 맞추고 전체 게이트를 돌린다**

```bash
cd C:\it\it_backend; ./gradlew spotlessApply; ./gradlew check
```

기대: BUILD SUCCESSFUL.

실패 유형별 대응:
- `MaxLinesRatchetTest` `[감소]` → Step 7을 빠뜨렸다.
- `MaxLinesRatchetTest` `[신규 초과]` → 새 컨트롤러가 800줄을 넘었다. 배정표를 다시 확인한다.
- `CouncilRouteContractTest` → Step 5로 돌아간다.
- `jacocoTestCoverageVerification` → 어떤 컨트롤러 클래스가 70% 미만인지 `build/reports/jacoco/test/html/index.html`에서 확인한다. Task 3으로 메운 `CouncilEvaluationController` 외의 클래스가 걸리면, 해당 라우트의 MockMvc 테스트를 `CouncilControllerTest`에 추가한다(형식은 Task 3 Step 2 참조).
- 컴파일 오류 `cannot find symbol` → 새 파일의 import 누락. 원본 `CouncilController`의 import 블록(1~34행)을 복사해 넣고 `spotlessApply`로 정리한다.

- [ ] **Step 9: 미사용 주입 필드가 없는지 확인한다**

7개 컨트롤러 각각에서 `private final` 필드가 본문에서 실제로 쓰이는지 확인한다:

```bash
cd C:\it\it_backend; Get-ChildItem 'src\main\java\com\kdb\it\domain\council\controller\Council*Controller.java' | ForEach-Object { $n=$_.Name; Select-String -Path $_.FullName -Pattern 'private final (\w+) (\w+);' | ForEach-Object { $f=$_.Matches[0].Groups[2].Value; $c=(Select-String -Path "src\main\java\com\kdb\it\domain\council\controller\$n" -Pattern "$f\." ).Count; if ($c -eq 0) { "MISSING-USE  $n  $f" } } }
```

기대: 출력 없음. 출력이 있으면 그 필드를 지운다.

- [ ] **Step 10: 커밋**

```bash
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/council/controller src/test/java/com/kdb/it/domain/council/controller src/test/resources/architecture/max-lines-baselines.properties
git -C C:\it\it_backend commit -m "refactor(council): CouncilController를 책임별 7개 컨트롤러로 분해 (CQ-01)"
```

---

## Task 5: 컨트롤러 테스트 분리

**Files:**
- Modify: `it_backend/src/test/java/.../CouncilControllerTest.java` (55개 → 목록·생성·상세 관련만 잔존)
- Create: `.../CouncilFeasibilityControllerTest.java`
- Create: `.../CouncilLifecycleControllerTest.java`
- Create: `.../CouncilCommitteeControllerTest.java`
- Create: `.../CouncilScheduleControllerTest.java`
- Create: `.../CouncilEvaluationControllerTest.java`
- Create: `.../CouncilResultControllerTest.java`
- Create: `.../CouncilQnaControllerTest.java`

**Interfaces:**
- Consumes: Task 4의 컨트롤러 7개
- Produces: 테스트 클래스 8개. 이동 전후 `@Test` 총 개수가 **55개로 동일**해야 한다.

---

- [ ] **Step 1: 이동 전 테스트 개수를 다시 센다**

```bash
cd C:\it\it_backend; (Select-String -Path 'src\test\java\com\kdb\it\domain\council\controller\CouncilControllerTest.java' -Pattern '^    @Test').Count
```

기대: `55`. 이 값을 적어 둔다.

- [ ] **Step 2: 테스트 파일 8개의 뼈대를 만든다**

각 파일은 아래 형태다. `<이름>`·`<대상 컨트롤러>`·`<mock 목록>`은 그 아래 표대로 채운다.

```java
package com.kdb.it.domain.council.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.common.system.service.CustomUserDetailsService;
import com.kdb.it.config.JacksonConfig;
import com.kdb.it.config.TestSecurityConfig;
import com.kdb.it.domain.council.dto.CouncilDto;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * <대상 컨트롤러> @WebMvcTest
 *
 * <p>HTTP 응답 구조와 인증 동작을 검증합니다.
 */
@WebMvcTest(<대상 컨트롤러>.class)
@Import({TestSecurityConfig.class, JacksonConfig.class})
class <이름> {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    // <mock 목록>
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    private static final String ASCT_ID = "ASCT-2026-0001";
}
```

| 파일 | 대상 컨트롤러 | `@MockitoBean` 서비스 |
| --- | --- | --- |
| `CouncilControllerTest`(잔존) | `CouncilController` | `CouncilService` |
| `CouncilFeasibilityControllerTest` | `CouncilFeasibilityController` | `FeasibilityService` |
| `CouncilLifecycleControllerTest` | `CouncilLifecycleController` | `CouncilService`, `CouncilApprovalService`, `CouncilSkipService` |
| `CouncilCommitteeControllerTest` | `CouncilCommitteeController` | `CommitteeService` |
| `CouncilScheduleControllerTest` | `CouncilScheduleController` | `ScheduleService`, `CouncilService` |
| `CouncilEvaluationControllerTest` | `CouncilEvaluationController` | `EvaluationService`, `PlanEvaluationService` |
| `CouncilResultControllerTest` | `CouncilResultController` | `ResultService`, `CouncilService`, `CouncilApprovalService` |
| `CouncilQnaControllerTest` | `CouncilQnaController`, `CouncilMainQnaController` | `QnaService`, `MainQnaService` |

`CouncilQnaControllerTest`만 `@WebMvcTest({CouncilQnaController.class, CouncilMainQnaController.class})` 형태다.

뼈대의 `objectMapper` 필드와 static import는 그 파일이 실제로 쓰지 않으면 지운다. `objectMapper`는 요청 본문을 직렬화하는 POST·PUT 테스트가 있는 파일에만 필요하다.

- [ ] **Step 3: 테스트 메서드를 옮긴다**

`CouncilControllerTest`의 각 `@Test` 메서드를, 그 메서드가 호출하는 URL이 속한 그룹의 파일로 **본문 수정 없이** 옮긴다. 판단 기준은 `@DisplayName`의 URL이며 Task 4의 메서드 배정표와 같은 축이다.

- `/api/council`(단건 없음), `/api/council/{asctId}`(하위 경로 없음) → `CouncilControllerTest` 잔존
- `/feasibility` → Feasibility
- `/approval`·`/start`·`/complete`·`/skip`·`/start-preparation`·`/skip-request`·`/skip-requests` → Lifecycle
- `/committee` → Committee
- `/schedule` → Schedule
- `/evaluation`·`/plan-targets`·`/plan-evaluation` → Evaluation
- `/result`·`/notify` → Result
- `/qna`·`/main-qna` → Qna

헬퍼 메서드도 함께 옮긴다: `validFeasibilityRequest()`는 Feasibility로, `validCommitteeRequest()`는 Committee로.

각 파일에서 실제로 쓰지 않는 static import는 지운다(`spotlessApply`의 `removeUnusedImports`가 일반 import만 정리하므로 static import는 손으로 확인한다). 컴파일 오류가 나면 그 import가 필요한 것이다.

- [ ] **Step 4: 테스트 총 개수가 보존됐는지 확인한다**

```bash
cd C:\it\it_backend; (Get-ChildItem 'src\test\java\com\kdb\it\domain\council\controller\Council*ControllerTest.java' | ForEach-Object { (Select-String -Path $_.FullName -Pattern '^    @Test').Count } | Measure-Object -Sum).Sum
```

기대: `55` (Step 1에서 기록한 값과 동일). 다르면 옮기다 빠뜨렸거나 중복했다.

- [ ] **Step 5: 협의회 컨트롤러 테스트를 전부 돌린다**

```bash
cd C:\it\it_backend; ./gradlew test --tests "com.kdb.it.domain.council.controller.*"
```

기대: 전부 PASS.

`NoSuchBeanDefinitionException`이 나면 그 테스트의 `@MockitoBean` 목록에 해당 컨트롤러가 주입받는 서비스가 빠진 것이다. Task 4 배정표의 "주입 서비스" 열과 맞춘다.

- [ ] **Step 6: 전체 게이트를 돌린다**

```bash
cd C:\it\it_backend; ./gradlew spotlessApply; ./gradlew check
```

기대: BUILD SUCCESSFUL.

- [ ] **Step 7: 커밋**

```bash
git -C C:\it\it_backend add src/test/java/com/kdb/it/domain/council/controller
git -C C:\it\it_backend commit -m "test(council): 컨트롤러 테스트를 분해 축과 동일하게 8개로 분리 (CQ-01)"
```

---

## Task 6: 문서·버전 락 갱신

**Files:**
- Modify: `C:\it\TASK.md` (CQ-01 행)
- Modify: `C:\it\versions.lock`
- Modify: `C:\it\docs\superpowers\specs\2026-08-05-cq01-council-controller-decomposition-design.md` (완료 표기 — 파일을 `specs/done/`으로 옮기지는 않는다. 나머지 3개 파일 분해가 트리거로 남아 있어 스펙은 계속 참조된다)

**Interfaces:**
- Consumes: Task 1~5의 결과
- Produces: 없음 (종결 태스크)

---

- [ ] **Step 1: 최종 실측을 뜬다**

```bash
cd C:\it\it_backend; Get-ChildItem -Path 'src\main\java' -Recurse -Filter *.java | ForEach-Object { [pscustomobject]@{ L=[System.IO.File]::ReadAllLines($_.FullName).Length; P=$_.FullName.Replace((Get-Location).Path + '\','') } } | Where-Object { $_.L -gt 500 -and $_.P -like '*council*controller*' } | Sort-Object L -Descending | ForEach-Object { "{0,6}  {1}" -f $_.L, $_.P }
```

기대: 출력 없음(협의회 컨트롤러가 전부 500줄 미만). 출력이 있으면 그 줄 수를 기록해 TASK.md에 남긴다.

- [ ] **Step 2: `TASK.md`의 CQ-01 행을 교체한다**

`C:\it\TASK.md`의 CQ-01 행(85행)에서 근거/조건 열을 아래로 바꾼다. 우선순위·유형·과제명은 유지한다.

```
**2026-08-05 부분 완료 — 동결선 도입 + `CouncilController` 분해 완료.** D-1 동결선을 `it_backend/src/test/java/com/kdb/it/architecture/MaxLinesRatchetTest.java` + `src/test/resources/architecture/max-lines-baselines.properties`(SoT)로 도입했다. 게이트는 ① 기준선 파일의 실측 줄 수 일치(증가·감소 모두 실패) ② 기준선 밖 운영 파일의 800줄 초과 금지 ③ 기준선 경로 실재를 강제하며 `./gradlew check`에 자동 포함된다. `CouncilController` 1,279줄은 라우트 42개를 URL 불변으로 7개 컨트롤러(core/feasibility/lifecycle/committee/schedule/evaluation/result)로 분해했고, `CouncilRouteContractTest`가 라우트 42개 계약을 고정한다. 분해 과정에서 `plan-targets`·`plan-evaluation` 5개 라우트에 테스트가 0건인 것을 발견해 함께 보강했다(JaCoCo 클래스별 70% 규칙 대응). **측정 정정**: 종전 계획 초안의 수치는 PowerShell `Get-Content | Measure-Object -Line`으로 측정해 빈 줄이 누락된 값이었다(`Measure-Object -Line`은 빈 문자열의 줄 수를 0으로 계산한다). 실측 결과 2026-07-29 로드맵 수치가 정확했고 그 뒤로도 증가가 이어졌다(`ProjectService` 1,478→1,549). **잔여 기준선 8개**: `ProjectService` 1549 · `CostService` 1159 · `BudgetWorkService` 1156 · `ProjectDto` 1070 · `CouncilDto` 990 · `AdminService` 866 · `ApplicationService` 852 · `CostDto` 801. 나머지 3개 서비스 분해는 **트리거 유지** — 해당 도메인 기능 변경 착수 시 Query/Command 분리와 함께 수행하고 단독 빅뱅 분해는 하지 않는다. 분해 방향은 사전 확정돼 있다(`ProjectService`는 `ProjectQueryAssembler` 분리 1순위, `CostService`는 CQ-06 이후, `BudgetWorkService`는 BE-30과 묶음). **후속 확인 필요**: 프론트 `npm run codegen:check`는 백엔드 기동이 필요해 이번 작업에서 실행하지 못했다 — `@Tag`를 전부 `Council`로 통일해 OpenAPI 스펙 변동 요인은 없앴으나 다음 프론트 작업 시 확인한다. 설계 SoT: `docs/superpowers/specs/2026-08-05-cq01-council-controller-decomposition-design.md`, 실행 SoT: `docs/superpowers/plans/2026-08-05-cq01-council-controller-decomposition.md`
```

- [ ] **Step 3: `versions.lock`을 갱신한다**

```bash
cd C:\it; .\scripts\update-versions-lock.ps1
```

스크립트가 없거나 실패하면 `versions.lock`을 직접 열어 `it_backend` 커밋 해시를 `git -C C:\it\it_backend rev-parse HEAD` 결과로 바꾼다.

- [ ] **Step 4: 스펙 문서에 완료 표기를 남긴다**

`docs/superpowers/specs/2026-08-05-cq01-council-controller-decomposition-design.md`의 머리말 목록 마지막 줄 다음에 한 줄을 추가한다:

```markdown
- 상태: 2026-08-05 구현 완료 (실행 SoT: [`plans/2026-08-05-cq01-council-controller-decomposition.md`](../plans/2026-08-05-cq01-council-controller-decomposition.md))
```

- [ ] **Step 5: 최종 게이트를 돌린다**

```bash
cd C:\it\it_backend; ./gradlew check
```

기대: BUILD SUCCESSFUL.

로컬 Oracle이 떠 있으면 통합 테스트도 돌린다:

```bash
cd C:\it\it_backend; ./gradlew integrationTest
```

기대: BUILD SUCCESSFUL. Oracle이 없어 실패하면 실행하지 못했다는 사실을 그대로 보고한다 — 통과했다고 적지 않는다.

- [ ] **Step 6: 커밋**

```bash
git -C C:\it add TASK.md versions.lock docs/superpowers/specs/2026-08-05-cq01-council-controller-decomposition-design.md
git -C C:\it commit -m "docs: CQ-01 동결선 도입·CouncilController 분해 완료 반영"
```

---

## 완료 기준 (스펙 §9 대응)

| # | 기준 | 확인 방법 |
| ---: | --- | --- |
| 1 | `./gradlew check` 통과 | Task 6 Step 5 |
| 2 | `./gradlew integrationTest` 통과 | Task 6 Step 5 (로컬 Oracle 필요) |
| 3 | 라우트 계약 42개가 분해 전후 모두 통과하고 `EXPECTED_ROUTES` 무변경 | Task 2 Step 2, Task 4 Step 5, `git diff`로 상수 변경 없음 확인 |
| 4 | ratchet이 위반 4종(증가·감소·경로 부재·신규 초과)을 검출 | Task 1 Step 4의 단위 테스트 5개 |
| 5 | `CouncilController`가 기준선에서 제거되고 신규 컨트롤러 7개가 전부 800줄 미만 | Task 4 Step 7, Task 6 Step 1 |
| 6 | 컨트롤러 테스트 메서드 총 개수가 분리 전후 동일(55개) | Task 5 Step 4 |
| 7 | `TASK.md` CQ-01 갱신 | Task 6 Step 2 |
| 8 | 미사용 주입 필드 0 | Task 4 Step 9 |
