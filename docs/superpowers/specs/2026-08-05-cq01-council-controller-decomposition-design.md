# CQ-01 조치 설계 — 백엔드 동결선 도입 + CouncilController 분해

- 작성일: 2026-08-05
- 대상 과제: `TASK.md` §🧹 Clean Code 부채 **CQ-01** (대형 서비스·컨트롤러를 도메인 경계별로 분해)
- 선행 로드맵: [`plans/done/2026-07-29-clean-code-wave3-remaining-debt.md`](../plans/done/2026-07-29-clean-code-wave3-remaining-debt.md) §5 Wave D
- 기준 커밋: backend `9b5104e9`, root `ba01caf`
- 문서 성격: 설계 스펙. 구현 순서·태스크 분해는 후속 실행계획이 SoT
- 상태: 2026-08-05 구현 완료 (실행 SoT: [`plans/2026-08-05-cq01-council-controller-decomposition.md`](../plans/2026-08-05-cq01-council-controller-decomposition.md))

---

## 1. 배경과 현황

CQ-01은 대형 파일 4개를 도메인 경계로 분해하는 과제이며, "단독 빅뱅 분해는 하지 않고 해당 도메인 기능 변경 시 동반 수행한다"는 트리거 방식으로 등재돼 있습니다. Wave D 로드맵은 이 결정을 유지하되, 트리거만으로는 증가를 막지 못한 사실(`BudgetWorkService` +37줄)을 근거로 **D-1 동결선**과 **D-2 사전 확정 분해 설계**를 추가했습니다. D-1은 "적용 결정 시"로 보류돼 있었고, 이 스펙이 그 결정을 확정합니다.

### 1.1 재실측 (2026-08-05)

> **측정 방식 주의.** 이 절의 초판은 PowerShell `Get-Content | Measure-Object -Line`으로 측정해 **전 항목이 과소 집계**돼 있었습니다. `Measure-Object -Line`은 빈 문자열의 줄 수를 0으로 계산하므로 파일의 빈 줄이 통째로 누락됩니다(`AdminService.java` 866줄 − 빈 줄 61줄 = 805, `CouncilController.java` 1,279줄 − 빈 줄 64줄 = 1,215 — 둘 다 총줄수−빈줄수와 정확히 일치). 인코딩·BOM과는 무관합니다. 아래 값은 게이트와 같은 정의(`Files.readAllLines(path, UTF_8).size()`)로 다시 측정하고 .NET `File.ReadAllLines`·LF 바이트 수로 교차 검증한 값입니다. PowerShell로 셀 때는 `[System.IO.File]::ReadAllLines($p).Length` 또는 `(Get-Content $p).Count`를 씁니다.

| 파일 | 2026-07-29 | 2026-08-05 | 증감 |
| --- | ---: | ---: | ---: |
| `domain/budget/project/service/ProjectService.java` | 1,478 | **1,549** | +71 |
| `domain/council/controller/CouncilController.java` | 1,279 | **1,279** | 0 |
| `domain/budget/cost/service/CostService.java` | 1,142 | **1,159** | +17 |
| `domain/budget/work/service/BudgetWorkService.java` | 1,156 | **1,156** | 0 |
| 합계 | 5,055 | **5,143** | +88 |

2026-07-29 로드맵 수치는 정확했고, 그 뒤로도 **증가가 이어졌습니다**(`ProjectService` +71). 트리거만으로는 증가를 막지 못한다는 Wave D의 판단이 재확인됩니다.

CQ-01 대상 4개 외에 800줄을 넘는 운영 파일이 5개 더 있습니다(총 9개).

| 파일 | 줄 수 | 성격 |
| --- | ---: | --- |
| `domain/budget/project/dto/ProjectDto.java` | 1,070 | 중첩 DTO 집합 — 길이가 곧 결함은 아님 |
| `domain/council/dto/CouncilDto.java` | 990 | 동일 |
| `common/admin/service/AdminService.java` | 866 | 서비스. 향후 분해 후보 |
| `common/approval/service/ApplicationService.java` | 852 | 서비스. 향후 분해 후보 |
| `domain/budget/cost/dto/CostDto.java` | 801 | 중첩 DTO 집합 |

### 1.2 로드맵 실측 정정

Wave D 로드맵의 `CouncilController` 서술 중 두 가지가 실제와 다릅니다.

- "위임 대상 서비스는 이미 13개로 분리됨" → 실제 주입 서비스는 **9개**(`CouncilService`, `FeasibilityService`, `CouncilApprovalService`, `CommitteeService`, `ScheduleService`, `EvaluationService`, `ResultService`, `CouncilSkipService`, `PlanEvaluationService`).
- 라우트 그룹 분포 "core 4 / lifecycle 9" → 실제 **core 3 / lifecycle 10**(`/start-preparation`이 lifecycle에 속함). 총 42개는 일치.

### 1.3 분해 난이도 실측

`CouncilController`의 42개 라우트는 전부 **1~5줄의 서비스 위임 + 대량 Javadoc·Swagger 애노테이션** 구조입니다. 조건 분기·트랜잭션·조립 로직이 컨트롤러에 없으므로 분해는 로직 변경 없는 순수 이동이며, 4개 대상 중 위험도가 가장 낮습니다.

---

## 2. 범위

### 2.1 이번 범위

1. **D-1 동결선** — 백엔드 운영 소스의 800줄 초과 파일 9개를 기준선으로 동결하고, 기준선 밖 파일의 신규 800줄 초과를 차단하는 자동 게이트를 도입합니다.
2. **라우트 계약 characterization 테스트** — 분해 전에 `/api/council` 하위 42개 (HTTP 메서드, 경로) 쌍을 golden 목록으로 고정합니다.
3. **CouncilController 7분할** — URL 불변, 로직 무변경의 순수 이동.
4. **컨트롤러 테스트 분리** — 분해 축과 동일하게 나눕니다.

### 2.2 범위 밖 (명시적 제외)

| 항목 | 처리 |
| --- | --- |
| `ProjectService`·`CostService`·`BudgetWorkService` 분해 | 트리거 방식 유지. Wave D-2 사전 확정 설계를 그대로 둡니다 |
| `ProjectDto`·`CouncilDto`·`AdminService`·`ApplicationService`·`CostDto` 분해 | 동결만 하고 분해하지 않습니다 |
| `@Operation`·`@ApiResponses` 문구 수정 | BE-31 소관. 이번에는 이동만 하고 문자열을 건드리지 않습니다 |
| 라우트 추가·변경·삭제, 서비스 계층 변경, 권한 정책 변경 | 전부 금지 |
| 프론트 변경 | 없음 (URL 불변) |

---

## 3. 동결선 게이트 (D-1)

### 3.1 메커니즘

JUnit 아키텍처 테스트로 구현합니다. `test`가 이미 `check`에 물려 있어 별도 Gradle 배선이 필요 없고, 실패 메시지를 사람이 읽을 수 있는 형태로 통제할 수 있으며, 프론트 CQ-15 ratchet(`scripts/max-lines-baselines.mjs` + Vitest)과 같은 형태가 됩니다.

**신규 파일 2개**

| 경로 | 역할 |
| --- | --- |
| `it_backend/src/test/java/com/kdb/it/architecture/MaxLinesRatchetTest.java` | 게이트 로직 |
| `it_backend/src/test/resources/architecture/max-lines-baselines.properties` | 기준선 SoT (`경로=줄수`) |

기준선을 코드 밖 리소스로 분리하는 이유는 기준값 변경이 diff에서 한 줄로 드러나 리뷰에서 놓치지 않게 하기 위함입니다.

### 3.2 강제 규칙

| # | 규칙 | 실패가 강제하는 것 |
| --- | --- | --- |
| 1 | 기준선에 등재된 파일의 실측 줄 수 == 기준값 (**증가·감소 모두** 실패) | 늘리면 같은 PR에서 동등 분량 상쇄 추출, 줄이면 기준값 동반 인하 |
| 2 | 기준선 밖 `src/main/java/**/*.java`가 800줄 초과 시 실패 | 신규 파일 비대화 차단 |
| 3 | 기준선에 적힌 경로가 실재하지 않으면 실패 | 파일 이동·삭제 후 기준선 방치 방지 |

### 3.3 초기 기준선

```properties
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

경로는 `src/main/java` 기준 상대 경로로 적어 OS 구분자 차이를 흡수합니다(비교 시 `/`로 정규화).

### 3.4 줄 수 측정 정의

`Files.readAllLines(path, UTF_8).size()`를 사용합니다. 측정 방식이 도구마다 달라지면 기준값이 흔들리므로, 이 정의를 테스트 Javadoc에 명시합니다.

**PowerShell `Get-Content | Measure-Object -Line`을 쓰지 않습니다.** `Measure-Object -Line`은 빈 문자열의 줄 수를 0으로 계산해 빈 줄을 통째로 누락합니다(§1.1 주의 참조). 스팟체크가 필요하면 `[System.IO.File]::ReadAllLines($p).Length` 또는 `(Get-Content $p).Count`를 씁니다. 두 방식과 LF 바이트 수, 그리고 게이트의 Java 측정이 모두 일치함을 확인했습니다.

### 3.5 실패 메시지 요건

파일별로 `경로 / 기준값 / 실측값 / 차이`를 표시하고, 다음 조치 안내를 함께 출력합니다.

- 증가한 경우: "같은 PR에서 동등 이상 분량을 추출해 상쇄하거나, 분해 후 기준값을 낮추십시오."
- 감소한 경우: "분해했다면 `max-lines-baselines.properties`의 기준값을 실측값으로 낮추십시오. 800줄 이하가 되면 항목을 제거하십시오."
- 신규 초과: "800줄을 넘는 신규 파일은 허용하지 않습니다. 관심사를 분리하십시오."

### 3.6 게이트 자체의 검증

ratchet 테스트가 실제로 실패를 잡는지 확인해야 합니다. 기준선 파싱·비교 로직을 테스트에서 직접 호출 가능한 형태(경로→줄수 맵을 인자로 받는 순수 메서드)로 분리하고, 위반 케이스(기준값 초과·미달·경로 부재·신규 초과)를 인자로 넣어 위반이 검출되는지 확인하는 단위 테스트를 같은 파일에 둡니다. 실제 소스 트리 스캔은 별도 테스트 메서드가 담당합니다.

---

## 4. 라우트 계약 characterization 테스트

### 4.1 목적

분해가 URL을 바꾸지 않았음을 기계적으로 증명합니다. 프론트 15개 파일과 E2E 스펙이 `/api/council` 경로에 의존하고 있어(총 65개 참조), 경로 하나만 어긋나도 런타임에서만 드러납니다.

### 4.2 설계

- 신규 파일: `it_backend/src/test/java/com/kdb/it/domain/council/controller/CouncilRouteContractTest.java`
- `RequestMappingHandlerMapping`에서 매핑 전체를 읽어 `/api/council`로 시작하는 (HTTP 메서드, 경로 패턴) 쌍만 추출하고, 정렬한 뒤 golden 목록과 정확히 비교합니다.
- 비교는 집합이 아니라 **정렬된 리스트 동등성**으로 하여 중복 매핑도 검출합니다.
- **분해 전에 먼저 추가하고 통과를 확인**합니다. 분해 후 같은 테스트가 통과하면 URL 계약이 보존된 것입니다.

### 4.3 golden 목록 (42개)

| # | 메서드 | 경로 | 이동 대상 |
| ---: | --- | --- | --- |
| 1 | GET | `/api/council` | Council |
| 2 | POST | `/api/council` | Council |
| 3 | GET | `/api/council/{asctId}` | Council |
| 4 | GET | `/api/council/{asctId}/feasibility` | Feasibility |
| 5 | POST | `/api/council/{asctId}/feasibility` | Feasibility |
| 6 | PUT | `/api/council/{asctId}/feasibility` | Feasibility |
| 7 | POST | `/api/council/{asctId}/approval` | Lifecycle |
| 8 | PATCH | `/api/council/{asctId}/approval` | Lifecycle |
| 9 | PATCH | `/api/council/{asctId}/start` | Lifecycle |
| 10 | PATCH | `/api/council/{asctId}/complete` | Lifecycle |
| 11 | PATCH | `/api/council/{asctId}/skip` | Lifecycle |
| 12 | PATCH | `/api/council/{asctId}/start-preparation` | Lifecycle |
| 13 | POST | `/api/council/{asctId}/skip-request` | Lifecycle |
| 14 | POST | `/api/council/{asctId}/skip-request/decision` | Lifecycle |
| 15 | GET | `/api/council/skip-requests` | Lifecycle |
| 16 | GET | `/api/council/{asctId}/skip-request` | Lifecycle |
| 17 | GET | `/api/council/{asctId}/committee/default` | Committee |
| 18 | GET | `/api/council/{asctId}/committee` | Committee |
| 19 | POST | `/api/council/{asctId}/committee` | Committee |
| 20 | PUT | `/api/council/{asctId}/committee` | Committee |
| 21 | GET | `/api/council/{asctId}/schedule` | Schedule |
| 22 | GET | `/api/council/{asctId}/schedule/my` | Schedule |
| 23 | POST | `/api/council/{asctId}/schedule` | Schedule |
| 24 | PUT | `/api/council/{asctId}/schedule/confirm` | Schedule |
| 25 | PUT | `/api/council/{asctId}/schedule/confirm-written` | Schedule |
| 26 | GET | `/api/council/{asctId}/evaluation` | Evaluation |
| 27 | GET | `/api/council/{asctId}/evaluation/my` | Evaluation |
| 28 | POST | `/api/council/{asctId}/evaluation` | Evaluation |
| 29 | GET | `/api/council/{asctId}/plan-targets` | Evaluation |
| 30 | GET | `/api/council/{asctId}/plan-evaluation` | Evaluation |
| 31 | GET | `/api/council/{asctId}/plan-evaluation/my` | Evaluation |
| 32 | POST | `/api/council/{asctId}/plan-evaluation` | Evaluation |
| 33 | GET | `/api/council/{asctId}/plan-evaluation/result-summary` | Evaluation |
| 34 | GET | `/api/council/{asctId}/result` | Result |
| 35 | POST | `/api/council/{asctId}/result` | Result |
| 36 | PUT | `/api/council/{asctId}/result` | Result |
| 37 | PUT | `/api/council/{asctId}/result/confirm` | Result |
| 38 | POST | `/api/council/{asctId}/result/review` | Result |
| 39 | POST | `/api/council/{asctId}/result/review/sync` | Result (**메서드 수준 `@PreAuthorize("hasRole('ADMIN')")` 동반 이동**) |
| 40 | GET | `/api/council/{asctId}/result/review/my` | Result |
| 41 | POST | `/api/council/{asctId}/result/approval` | Result |
| 42 | POST | `/api/council/{asctId}/notify` | Result |

---

## 5. CouncilController 7분할

### 5.1 분할 결과

전부 `com.kdb.it.domain.council.controller` 패키지에 두고, 각 클래스에 `@RestController`·`@RequestMapping("/api/council")`·`@RequiredArgsConstructor`·`@Tag(name = "Council", description = "정보화실무협의회 관리 API")`를 **동일하게** 부여합니다. `@Tag`를 통일하면 Swagger 그룹과 OpenAPI 스펙이 분해 전후로 동일하게 유지됩니다.

| 클래스 | 라우트 | 주입 서비스 | 예상 줄 수 |
| --- | ---: | --- | ---: |
| `CouncilController` (잔존) | 3 | `CouncilService` | ~160 |
| `CouncilFeasibilityController` | 3 | `FeasibilityService` | ~150 |
| `CouncilLifecycleController` | 10 | `CouncilService`, `CouncilApprovalService`, `CouncilSkipService` | ~310 |
| `CouncilCommitteeController` | 4 | `CommitteeService` | ~165 |
| `CouncilScheduleController` | 5 | `ScheduleService`, `CouncilService` | ~190 |
| `CouncilEvaluationController` | 8 | `EvaluationService`, `PlanEvaluationService` | ~275 |
| `CouncilResultController` | 9 | `ResultService`, `CouncilApprovalService`, `CouncilService` | ~235 |

전부 800줄 아래이므로 분해 완료 시 `CouncilController` 항목을 기준선에서 제거합니다.

각 클래스가 실제로 주입하는 서비스는 이동한 메서드가 호출하는 것만 남깁니다. 이동 후 사용되지 않는 필드가 남으면 spotless가 아니라 컴파일 경고로 드러나므로, 각 파일에서 미사용 필드 0을 확인합니다.

### 5.2 이동 규칙

- 메서드 시그니처·본문·`@Operation`·`@ApiResponses`·`@Parameter`·메서드 Javadoc은 **문자 단위로 그대로 이동**합니다.
- 메서드 수준 `@PreAuthorize`(라우트 39)는 반드시 함께 이동합니다.
- 원본 파일의 `// ===== M3: 협의회 목록/기본 =====` 형태 구획 주석은 분할 후 클래스 단위가 그 역할을 하므로 제거합니다.
- **예외 — 클래스 Javadoc은 재작성합니다.** 현재 `CouncilController`의 클래스 Javadoc(41행)은 "전체 협의회 API 엔드포인트를 단일 컨트롤러에서 관리합니다"라고 서술하므로 분해 후 사실과 달라집니다. 잔존 `CouncilController`에는 자신이 담당하는 범위와 나머지 6개 컨트롤러로의 분해 사실을 적고, 신규 6개에는 각자의 담당 범위와 기본 URL을 적습니다. 각 클래스 Javadoc에 "URL은 `/api/council` 공유, 클래스만 분리"라는 사실을 남겨 다음 독자가 경로를 혼동하지 않게 합니다.
- 이동 후 `./gradlew spotlessApply`로 import 정리와 포맷을 맞춥니다.

### 5.3 왜 7분할인가

3분할은 lifecycle 묶음이 500줄대로 남아 다음 부채가 되고, 서비스 1:1 9분할은 `notify`(`CouncilService` + `ResultService`)나 `skip-request`(`CouncilSkipService` + `CouncilService`)처럼 서비스가 겹치는 라우트에서 경계가 어색해집니다. 7분할은 라우트 경로 접두어와 일치해 "어느 파일에 있는가"를 URL만 보고 판단할 수 있습니다.

---

## 6. 테스트 분리

### 6.1 현황

- `CouncilControllerTest` 706줄 — `@WebMvcTest({CouncilController.class, CouncilMainQnaController.class, CouncilQnaController.class})`로 QnA 컨트롤러 2개와 컨텍스트를 공유하고 서비스 11개 + 인증 빈 2개를 일괄 `@MockitoBean` 합니다.
- `CouncilControllerSecurityTest` 100줄.

### 6.2 분리 설계

| 신규 테스트 | 대상 | Mock 대상 |
| --- | --- | --- |
| `CouncilControllerTest` (잔존) | `CouncilController` | `CouncilService` |
| `CouncilFeasibilityControllerTest` | `CouncilFeasibilityController` | `FeasibilityService` |
| `CouncilLifecycleControllerTest` | `CouncilLifecycleController` | `CouncilService`, `CouncilApprovalService`, `CouncilSkipService` |
| `CouncilCommitteeControllerTest` | `CouncilCommitteeController` | `CommitteeService` |
| `CouncilScheduleControllerTest` | `CouncilScheduleController` | `ScheduleService`, `CouncilService` |
| `CouncilEvaluationControllerTest` | `CouncilEvaluationController` | `EvaluationService`, `PlanEvaluationService` |
| `CouncilResultControllerTest` | `CouncilResultController` | `ResultService`, `CouncilApprovalService`, `CouncilService` |
| `CouncilQnaControllerTest` | `CouncilMainQnaController`, `CouncilQnaController` | `QnaService`, `MainQnaService` |

각 테스트는 `@WebMvcTest(대상.class)` + 해당 컨트롤러가 실제 쓰는 서비스 + 인증 빈(`JwtUtil`, `CustomUserDetailsService`)만 mock합니다.

`CouncilControllerSecurityTest`는 대상 컨트롤러 목록만 갱신하고 단언은 유지합니다. **구현 결과(2026-08-05)**: 검증 대상이 `CouncilResultController`로 바뀌어 이름이 실제와 어긋나므로 최종 리뷰 지적에 따라 `CouncilResultControllerSecurityTest`로 개명했습니다(단언은 그대로).

**테스트 케이스는 이동만 하고 단언을 수정하지 않습니다.** 이동 전후 테스트 메서드 총 개수가 같아야 합니다.

---

## 7. 실행·검증 순서

| 단계 | 내용 | 게이트 |
| ---: | --- | --- |
| 1 | ratchet 테스트 + 기준선 9개(§3.3) 도입 | `./gradlew check` |
| 2 | `CouncilRouteContractTest`(golden 42) 도입 | `./gradlew check` — **분해 전** 통과 확인 |
| 2.5 | `plan-evaluation`·`plan-targets` 5개 라우트 테스트 보강 (§8 커버리지 위험) | `./gradlew check` |
| 3 | 컨트롤러 7분할 이동 + 기준선에서 `CouncilController` 항목 제거 + `spotlessApply` | `./gradlew check` — 라우트 계약·ratchet 동시 통과 |
| 4 | 컨트롤러 테스트 분리 | `./gradlew check` |
| 5 | `TASK.md` CQ-01 갱신, `versions.lock` 갱신 | — |

최종 게이트: `./gradlew check` + `./gradlew integrationTest`.

기준선 항목 제거를 3단계에 **함께 넣는 것이 필수**입니다. `CouncilController`가 1,215줄에서 ~160줄로 줄어드는 순간 §3.2 규칙 1(감소도 실패)이 걸리므로, 같은 커밋에서 기준선을 갱신하지 않으면 `check`가 통과하지 않습니다. 이는 결함이 아니라 ratchet이 의도한 동작입니다 — 분해와 기준선 갱신이 분리되지 않도록 강제합니다.

3단계와 4단계를 분리하는 이유는, 컨트롤러만 옮긴 시점에도 기존 `CouncilControllerTest`가 통과해야 하기 때문입니다(`@WebMvcTest`에 7개 클래스를 임시로 모두 등재). 이 중간 통과가 "이동이 동작을 바꾸지 않았다"는 두 번째 증거가 됩니다.

커밋은 단계별로 나눕니다. 4-repo 규약상 백엔드 단독 변경이므로 프론트 커밋은 없습니다.

---

## 8. 위험과 대응

| 위험 | 대응 |
| --- | --- |
| **JaCoCo 클래스 단위 70% 규칙 위반 (실측 확인됨)** | `build.gradle`의 `jacocoTestCoverageVerification`은 **클래스별** LINE·BRANCH·COMPLEXITY 70%를 강제하고 컨트롤러는 제외 목록에 없다. 현재 42개 라우트 중 37개가 한 클래스에 있어 약 88%로 통과하지만, `plan-targets`·`plan-evaluation` 계열 **5개 라우트에는 테스트가 0건**이다(`it_backend/src/test` 전체에서 `plan-evaluation`·`plan-targets` 검색 0건). 분할하면 `CouncilEvaluationController`가 8개 라우트 중 3개만 커버돼 약 37%로 떨어져 `check`가 실패한다. **분해 전에 5개 라우트 테스트를 먼저 보강한다**(실행 순서 2.5단계) |
| 분해 중 라우트 누락·오타 | 라우트 계약 테스트(§4)가 42개 정확 일치를 강제 |
| OpenAPI 스펙 변동 → 프론트 `codegen:check` 드리프트 | `@Tag`를 전부 동일하게 유지해 **오퍼레이션 집합과 태그 그룹은 분해 전후 동일**하게 만듭니다. 다만 이것이 `paths` 항목의 **순서**까지 보장하지는 않습니다 — springdoc은 핸들러 메서드 탐색 순서(컨트롤러 빈 단위)로 `paths`를 구성하므로 빈이 1개에서 7개가 되면 순서가 달라질 수 있고, `it_frontend/scripts/codegen.mjs`는 `api.d.ts`를 전문 텍스트로 비교하므로 순서 변경만으로도 `드리프트 감지`가 납니다. 백엔드 기동이 필요해 이 작업 안에서 실행할 수 없으므로 `TASK.md`에 "다음 프론트 작업 시 `api.d.ts`를 재생성해 diff가 순서 변경뿐인지 확인" 메모를 남깁니다 |
| 중복 매핑으로 인한 기동 실패 | 라우트 계약 테스트가 Spring 컨텍스트를 띄우므로 중복 매핑은 컨텍스트 로드 단계에서 즉시 실패 |
| ratchet 기준값과 실제 측정 도구 불일치 | §3.4에 측정 정의를 고정하고 테스트 Javadoc에 명시 |
| 기준선이 분해를 방해(감소도 실패) | 의도된 동작. 분해 시 기준값 인하가 같은 PR에 포함되도록 실패 메시지에 안내 |
| 미사용 서비스 필드 잔존 | 각 신규 클래스에서 주입 필드 0 미사용 확인을 완료 조건에 포함 |

---

## 9. 완료 기준

1. `./gradlew check`와 `./gradlew integrationTest` 통과.
2. `CouncilRouteContractTest`가 분해 전후 모두 통과하고 golden 42개가 변경되지 않음.
3. `MaxLinesRatchetTest`가 기준선 위반(증가·감소·경로 부재·신규 800줄 초과) 4종을 검출함이 단위 테스트로 확인됨.
4. `CouncilController`가 기준선에서 제거되고, 신규 컨트롤러 7개가 전부 800줄 미만.
5. 컨트롤러 테스트 메서드 총 개수가 분리 전후 동일.
6. `TASK.md` CQ-01 항목이 갱신됨 — 동결선 도입 사실, 초기 기준선 9개에서 `CouncilController` 제거 후 잔여 8개, `CouncilController` 완료, 나머지 3개 트리거 유지.

---

## 10. 후속 (이번 범위 밖)

- `ProjectService`(1,549) — Wave D-2대로 `ProjectQueryAssembler` 분리가 1순위. 해당 도메인 기능 변경 시 착수.
- `CostService`(1,159) — CQ-06 완료 후 착수.
- `BudgetWorkService`(1,156) — BE-30(잔여 encounter-order 2곳)과 묶어 처리.
- `AdminService`(866) — BE-29(CacheEvict 공백) 조치와 함께 분해 여부 판단.
- `ApplicationService`(852) — 결재 도메인. 이번 실측에서 새로 드러난 800줄 초과 파일.
- `ProjectDto`(1,070)·`CouncilDto`(990)·`CostDto`(801) — 중첩 DTO 집합이라 분해 필요성 자체를 별도 판단.
