# CQ-01 잔여 대형 서비스 분해 조치계획

- 작성일: 2026-08-05
- 대상: `TASK.md` §🧹 Clean Code 부채 `CQ-01`
- 선행 완료: 백엔드 max-lines 동결선, `CouncilController` 7분할
- 선행 설계: `docs/superpowers/specs/2026-08-05-cq01-council-controller-decomposition-design.md`
- 계획 성격: 잔여 3개 서비스의 트리거 기반 실행계획. 세 도메인을 한 PR에서 일괄 분해하지 않는다.

## 1. 목표

`ProjectService`·`CostService`·`BudgetWorkService`의 외부 호출 계약과 HTTP/OpenAPI 계약을 유지하면서 조회 조립과 변경 로직을 책임별 빈으로 분리한다. 각 작업 묶음은 기능 변경 트리거와 함께 독립적으로 실행하고, 완료한 원본 서비스는 `max-lines-baselines.properties`에서 제거한다.

최종적으로 다음을 달성한다.

1. 세 원본 서비스와 모든 신규 운영 클래스가 각각 800줄 이하이다.
2. 컨트롤러와 타 도메인이 사용하는 기존 서비스 메서드 시그니처는 유지한다.
3. 읽기 전용/쓰기 트랜잭션, 프로젝트 캐시 무효화, 소유권·결재 상태 검증의 경계가 분해 전과 같다.
4. 신규 클래스별 LINE·BRANCH·COMPLEXITY 커버리지 70% 게이트를 통과한다.
5. 세 서비스의 기준선 항목을 제거한 뒤 `CQ-01`을 완료 이관한다.

## 2. 현황과 판단

### 2.1 실측

줄 수는 동결선과 같은 `(Get-Content <path>).Count`/`Files.readAllLines(...).size()` 정의를 사용한다.

| 대상 | 현재 줄 수 | 공개 진입점 | 직접 단위 테스트 | 판단 |
| --- | ---: | ---: | ---: | --- |
| `ProjectService.java` | 1,549 | 조회 4, 변경 3 | `ProjectServiceTest` 78 + `CoverageTest` 31 + XCR 3 + cache 3 | 최우선. 조회·응답 조립이 약 절반 이상이며 분리 방향이 가장 명확하다. |
| `CostService.java` | 1,159 | 조회 4, 변경 3 | `CostServiceTest` 55 + XCR 3 | CQ-06이 2026-08-04 완료되어 선행조건이 충족됐다. |
| `BudgetWorkService.java` | 1,156 | 조회 3, 변경 2 | `BudgetWorkServiceTest` 48 + batch 3 + XCR 5 | BE-30을 먼저 고정한 뒤 조회/적용 알고리즘을 분리한다. |

### 2.2 핵심 결정

- `ProjectService`, `CostService`, `BudgetWorkService`는 **호환 파사드**로 남긴다. 컨트롤러, `PlanService`, 테스트 대역의 주입 타입을 한꺼번에 바꾸지 않는다.
- 새 빈이 실제 로직과 트랜잭션을 소유하고 파사드는 위임만 한다. 쓰기 메서드의 `@Transactional`은 실제 쓰기 로직을 실행하는 빈의 public 메서드에 둔다.
- `ProjectService`의 `@CacheEvict("tiptapMetadata")`는 기존 public 변경 진입점에 유지해 Spring 프록시 발화를 보존한다.
- 단순히 한 대형 파일을 다른 800줄 초과 파일로 옮기지 않는다. 신규 파일 목표는 600줄 이하, 절대 상한은 800줄이다.
- 서비스 분해는 API 경로·Swagger annotation·DTO·DB 스키마를 바꾸지 않는다. DTO 3개와 `AdminService`·`ApplicationService`는 이번 CQ-01 잔여 서비스 범위 밖이다.

## 3. 목표 구조

```text
ProjectController / PlanService
            |
            v
      ProjectService (호환 파사드, 변경 진입점/캐시)
       |                         |
       v                         v
ProjectQueryService       기존 command 로직
       |
       v
ProjectQueryAssembler ---- repositories / code-name helpers

CostController
      |
      v
 CostService (호환 파사드, 변경 진입점)
       |                         |
       v                         v
 CostQueryService          기존 command 로직
       |
       v
 CostQueryAssembler ------- repositories / approval / terminal enrichment

BudgetWorkController
          |
          v
BudgetWorkService (호환 파사드)
    |                 |                    |
    v                 v                    v
BudgetRate        BudgetSummary       BudgetProjectSummary
ApplicationService   Service                Service
    |
    +---------------> BudgetSummaryService
```

파사드 유지로 HTTP·OpenAPI 계약과 상위 소비자 계약은 보존하되, 신규 기능은 해당 책임 빈에 추가한다. 파사드가 다시 비대해지지 않도록 위임 메서드 외 로직 추가를 금지한다.

## 4. 공통 실행 규칙

각 도메인 작업 묶음은 아래 순서를 지킨다.

1. 기존 테스트를 공개 진입점/분기별로 목록화하고 누락된 실패·빈 결과·부분 성공 경로를 원본 서비스에 먼저 추가한다.
2. 테스트를 신규 책임별 테스트 클래스로 **이동**한다. 테스트 이름·단언·fixture 의미는 유지하고, 이동 전후 `@Test` 총수를 비교한다.
3. 운영 로직을 신규 빈으로 이동하고 파사드에서 위임한다. 같은 커밋에서 원본 서비스의 기준선 항목을 삭제한다.
4. 신규 클래스별 JaCoCo 70%를 확인한다. 파사드만 mock하는 테스트로 신규 로직의 커버리지를 대신하지 않는다.
5. `spotlessApply` 후 도메인 대상 테스트 → 전체 `check` → Oracle `integrationTest` 순으로 검증한다.

기준선은 감소도 실패하므로 **운영 소스 이동 + 테스트 이동 + 기준선 제거**는 같은 백엔드 커밋에 포함한다. 기준값 상향이나 신규 예외 추가는 허용하지 않는다.

## Task 0 — 선행 `CouncilController` codegen 후속 확인

서비스 분해와 직접 관련은 없지만 현재 `TASK.md`의 CQ-01에 남은 유일한 선행 확인 사항이므로 최초 실행 전에 닫는다.

1. 백엔드를 `local-ext` 또는 프로젝트 표준 로컬 프로파일로 기동한다.
2. 프론트에서 `npm run codegen:check`를 실행한다.
3. 실패하면 `npm run codegen`으로 `app/types/api.d.ts`를 재생성하고 diff를 분류한다.
   - 경로·HTTP 메서드·operation schema가 같고 선언 순서만 바뀜: 생성물을 프론트 커밋으로 반영한다.
   - operation 또는 schema의 의미 변경: CQ-01 작업을 중단하고 누락 라우트/annotation 회귀를 조사한다.
4. `npm run format:check && npm run check && npm test`를 실행한다.
5. 결과를 `TASK.md` CQ-01 메모와 최종 `TASK_DONE.md` 근거에 기록한다.

이 단계 외에는 서비스 내부 분해가 OpenAPI에 영향을 주지 않으므로 매 작업 묶음에서 프론트 타입을 재생성하지 않는다. 최종 종료 시 `codegen:check`만 한 번 더 실행한다.

## Task 1 — ProjectService 분해

### 6.1 활성화 조건

- 프로젝트 조회·품목·일괄조회 기능 변경이 시작되거나,
- CQ-01 상환 작업을 별도 승인해 `ProjectService`를 우선 처리할 때.

현재 세 대상 중 가장 크고 `ProjectQueryAssembler` 방향이 이미 확정되어 있으므로 실행 순서는 1순위다.

### 6.2 운영 코드

Create:

- `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectQueryService.java`
  - `getProjectList`, `searchProjectList`, `getProject`, `getProjectsByIds`의 조회 흐름 소유
  - 클래스 수준 `@Transactional(readOnly = true)`
- `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectQueryAssembler.java`
  - 단건 상세, 목록 배치, bulk 상세의 신청서·결재선·조직·사용자·코드명·BPROJA·품목 응답 조립
  - `ProjectBudgetSummaryService`, `CodeNameMapBuilder` 등 기존 헬퍼 재사용

Modify:

- `ProjectService.java`
  - 조회 4개는 `ProjectQueryService`로 위임
  - `createProject`, `updateProject`, `deleteProject`와 품목 동기화·소유권·결재 검증은 유지
  - 세 변경 메서드의 `@CacheEvict`와 쓰기 트랜잭션을 유지
- `max-lines-baselines.properties`
  - `ProjectService.java=1549` 항목 삭제

`ProjectQueryAssembler` 하나에 bulk와 단건 조립을 모두 넣어 800줄을 넘길 경우 `ProjectDetailAssembler`와 `ProjectBatchAssembler`로 즉시 나눈다. 기준선에 신규 파일을 추가하는 방식은 사용하지 않는다.

### 6.3 테스트

Create/Modify:

- `ProjectQueryServiceTest.java` — 조회 4개 공개 계약, 미존재, bulk 부분 성공·중복 활성행 오류
- `ProjectQueryAssemblerTest.java` — 단건/목록/bulk 응답 동등성, 코드명·결재·품목·대표상태 조립
- `ProjectServiceTest.java`, `ProjectServiceCoverageTest.java` — 변경 경로 테스트만 잔존하도록 분리
- `ProjectServiceCacheEvictTest.java` — 기존 3개 캐시 발화 단언 유지
- `ProjectServiceXcrLookupTest.java` — 생성/수정 환율 경로 유지
- `ProjectControllerTest.java`, `PlanServiceTest.java` — 기존 `ProjectService` mock 계약이 그대로 통과하는지 확인

필수 비교:

- 서비스 테스트의 기존 `@Test` 115개(78+31+3+3)를 이동 후에도 유지하고, 새 characterization 테스트만 순증가로 계산한다.
- 단건과 bulk가 같은 코드명·신청서·품목·대표상태 규칙을 유지한다.
- `ProjectServiceCacheEvictTest`가 프록시를 통과해 세 변경 메서드 모두 캐시를 비운다.

검증:

```powershell
./gradlew test --tests "com.kdb.it.domain.budget.project.service.*" --tests "com.kdb.it.domain.budget.project.controller.ProjectControllerTest" --tests "com.kdb.it.domain.budget.plan.service.PlanServiceTest"
./gradlew check
./gradlew integrationTest --tests "com.kdb.it.domain.budget.project.repository.ProjectRepositoryImplTest"
```

## Task 2 — CostService 분해

### 7.1 활성화 조건

- 비용 조회·단말기·일괄조회 기능 변경이 시작되거나,
- Task 1 완료 후 다음 CQ-01 상환 작업을 승인할 때.

CQ-06의 `Bcostm.UpdateCommand` 전환은 이미 완료되어 선행조건이 충족됐다. CQ-19(`Btermm.update`)는 별도 과제로 유지한다.

### 7.2 운영 코드

Create:

- `CostQueryService.java`
  - `getCost`, `getCostList`, `searchCostList`, `getCostsByIds`의 조회 흐름 소유
  - 클래스 수준 `@Transactional(readOnly = true)`
- `CostQueryAssembler.java`
  - 신청서·결재선·조직·사용자·코드명·이전예산·단말기·편성예산 응답 조립
  - `CostRepresentativeSelector`, `CodeNameMapBuilder` 재사용

Modify:

- `CostService.java`
  - 조회 4개는 `CostQueryService`로 위임
  - 생성·수정·삭제, `Bcostm.UpdateCommand`, 단말기 동기화와 검증은 유지
- `max-lines-baselines.properties`
  - `CostService.java=1159` 항목 삭제

`CostQueryAssembler`가 800줄에 접근하면 단말기 응답 조립을 `CostTerminalAssembler`로 분리한다. `CostDto` 분해는 이 작업에 포함하지 않는다.

### 7.3 테스트

- `CostQueryServiceTest.java` — 단건/목록/검색/bulk 공개 계약
- `CostQueryAssemblerTest.java` — 결재·조직·코드·단말기·이전예산 enrichment
- `CostServiceTest.java` — 생성·수정·삭제와 단말기 변경 경로만 잔존
- `CostServiceXcrLookupTest.java`, `BcostmUpdateCommandTest.java` — 변경 없이 통과
- `CostControllerTest.java` — 기존 파사드 mock 계약 유지

기존 서비스 테스트 `@Test` 58개(55+3)를 이동 후에도 유지한다. bulk 대표행 선택과 단건 대표행 선택의 동등성, 단말기 soft-delete/복원, 요청→`UpdateCommand` 필드 매핑을 필수 회귀로 둔다.

검증:

```powershell
./gradlew test --tests "com.kdb.it.domain.budget.cost.service.*" --tests "com.kdb.it.domain.budget.cost.entity.BcostmUpdateCommandTest" --tests "com.kdb.it.domain.budget.cost.controller.CostControllerTest"
./gradlew check
./gradlew integrationTest --tests "com.kdb.it.domain.budget.cost.repository.CostRepositoryImplTest"
```

## Task 3 — BudgetWorkService + BE-30 분해

### 8.1 활성화 조건

- BE-30을 처리하거나 예산 편성률·편성 결과 기능을 변경할 때,
- Task 1·2와 독립된 백엔드 PR로 실행한다.

### 8.2 BE-30 선행 고정

분해 전에 현재 `getSummary`의 두 encounter-order 채택 지점에 실패하는 테스트를 추가한다.

1. 같은 표시명 그룹에 서로 다른 IOE/편성률 행을 역순으로 넣는다.
2. `BudgetRepresentativeSelector`가 고른 최신 편성 실행(`bgNo` 최대) 행의 IOE와 편성률이 결과에 쓰여야 함을 단언한다.
3. 원본 `BudgetWorkService`에서 테스트를 통과시키고 BE-30 동작 변경을 독립 커밋한다.

이 단계는 리팩터링과 동작 수정을 섞지 않기 위한 선행 커밋이다.

### 8.3 운영 코드

Create:

- `BudgetRateApplicationService.java`
  - `applyRates`, `applyItemRates`, 편성금액 계산, BBUGTM soft-delete/upsert, 감사 사용자 처리
  - public 변경 메서드에 `@Transactional`
  - 저장 후 `ApplyResponse.summary`를 만들 때 `BudgetSummaryService`를 호출한다. 현재와 같이 같은 쓰기 트랜잭션 안에서 저장 결과가 flush되어 요약에 반영되는 계약을 테스트로 고정한다.
- `BudgetSummaryService.java`
  - `getIoeCategories`, `getSummary(bgYy[, srcPks])`, 승인 원본 필터·비목 그룹·MPL 조정
  - `@Transactional(readOnly = true)`
- `BudgetProjectSummaryService.java`
  - `getProjectSummary`, 원본 테이블별 이름 배치조회, 품목→사업 그룹화, 비목별 합계 조립
  - `@Transactional(readOnly = true)`

Modify:

- `BudgetWorkService.java`
  - 5개 공개 메서드만 유지하는 호환 파사드
  - 실제 로직은 위 3개 빈으로 위임
- `max-lines-baselines.properties`
  - `BudgetWorkService.java=1156` 항목 삭제

공통 비목 코드 변환이 두 조회 서비스에 중복되면 package-private `BudgetIoeCatalog`로 추출하되, 첫 분해부터 추상화를 선행하지 않는다. 실제 중복이 확인될 때만 추가한다.

### 8.4 테스트

- `BudgetRateApplicationServiceTest.java` — 적용 2경로, upsert/soft-delete, 비율·반올림·감사 사용자
- `BudgetRateApplicationServiceXcrLookupTest.java` — 기존 XCR 5개 이동
- `BudgetSummaryServiceTest.java` — 비목 목록, summary, `srcPks`, BE-30 결정론, MPL 조정
- `BudgetProjectSummaryServiceTest.java` — 사업/비용 네임스페이스, 대표행, 배치조회, 금액 합계
- `BudgetWorkServiceTest.java` — 5개 위임 계약만 소수 유지
- `BudgetWorkControllerTest.java` — API 권한·응답 계약 유지

기존 서비스 테스트 `@Test` 56개(48+3+5)를 이동 후에도 유지한다. `BudgetWorkServiceBatchTest`의 N+1 회귀 3개는 해당 조회 서비스 테스트로 이동하고 repository 호출 횟수 단언을 보존한다.

검증:

```powershell
./gradlew test --tests "com.kdb.it.domain.budget.work.service.*" --tests "com.kdb.it.domain.budget.work.controller.BudgetWorkControllerTest"
./gradlew check
./gradlew integrationTest
```

## Task 4 — CQ-01 종료와 문서 정합성

세 작업 묶음이 모두 완료된 뒤에만 실행한다.

1. `max-lines-baselines.properties`에서 세 서비스 항목이 모두 제거됐는지 확인한다.
2. 모든 신규 운영 파일이 800줄 이하이고 새 기준선 예외가 없는지 확인한다.
3. 백엔드를 기동하고 프론트 `npm run codegen:check`를 실행한다.
4. `TASK.md`에서 CQ-01을 제거하고 `TASK_DONE.md`에 다음 근거를 이관한다.
   - 도메인별 백엔드 커밋
   - 분해 전후 파일 줄 수
   - 기존/신규 테스트 수와 `check`·`integrationTest` 결과
   - codegen 드리프트 확인 결과
5. 잔여 기준선 5개(`ProjectDto`, `CouncilDto`, `AdminService`, `ApplicationService`, `CostDto`)는 architecture ratchet에 유지한다. 분해가 필요하면 CQ-01 완료와 섞지 않고 별도 TASK ID로 등록한다.
6. 백엔드/프론트 커밋을 모두 만든 후 루트에서 `scripts/update-versions-lock.ps1`를 실행하고 root 문서 변경을 커밋한다.

## 10. 위험과 방어

| 위험 | 방어 |
| --- | --- |
| 신규 클래스가 JaCoCo 클래스별 70% 미달 | 테스트를 파사드 mock이 아닌 실제 신규 클래스 단위로 이동하고 `check`를 각 도메인 커밋 전에 실행한다. |
| 트랜잭션 프록시가 사라짐 | 실제 repository 쓰기를 수행하는 신규 public 메서드에 `@Transactional`; 조회 빈은 `readOnly=true`를 명시한다. |
| 프로젝트 캐시 무효화 누락 | 기존 파사드 public 변경 메서드의 `@CacheEvict`를 유지하고 Spring context 기반 3개 테스트를 보존한다. |
| 단건·목록·bulk 응답 규칙 드리프트 | 같은 fixture를 사용한 동등성 characterization 테스트를 추출 전에 고정한다. |
| 분해 중 N+1 재발 | 기존 batch 테스트의 repository 호출 횟수 단언을 신규 assembler/summary 테스트로 이동한다. |
| 기준선 갱신 누락 | 소스 이동·테스트 이동·기준선 삭제를 같은 커밋에 포함하고 `check`로 강제한다. |
| CQ-01 범위가 DTO·타 서비스로 다시 팽창 | 잔여 5개 기준선은 별도 판단 대상으로 명시하고 이 계획에서는 수정하지 않는다. |
| 리팩터링과 BE-30 동작 변경이 섞임 | BE-30을 실패 테스트→수정의 선행 커밋으로 끝낸 뒤 BudgetWork 분해를 시작한다. |

## 11. 완료 기준

- [ ] 선행 Council codegen 드리프트를 확인하고 결과를 기록했다.
- [ ] `ProjectService`, `CostService`, `BudgetWorkService`가 각각 800줄 이하이다.
- [ ] 모든 신규 운영 클래스가 800줄 이하이며 신규 baseline 예외가 없다.
- [ ] 세 기존 서비스의 public 메서드 시그니처와 컨트롤러 API 계약이 유지된다.
- [ ] 프로젝트 캐시, 쓰기/읽기 트랜잭션, 소유권·결재 검증이 보존된다.
- [ ] BE-30의 대표행 선택이 encounter order와 무관하게 결정론적이다.
- [ ] 기존 서비스 테스트 총수는 이동으로 감소하지 않고 신규 클래스별 70% 게이트를 통과한다.
- [ ] `./gradlew check`와 `./gradlew integrationTest`가 통과한다.
- [ ] `npm run codegen:check`가 통과한다.
- [ ] 세 서비스 기준선 항목을 제거하고 CQ-01을 `TASK_DONE.md`로 이관했다.

## 12. 권장 커밋 단위

1. frontend(필요 시): `chore: Council OpenAPI 생성 타입 동기화 (CQ-01)`
2. backend: `test(project): CQ-01 조회 분해 characterization 보강`
3. backend: `refactor(project): 조회 조립 책임 분리 및 기준선 제거 (CQ-01)`
4. backend: `test(cost): CQ-01 조회 분해 characterization 보강`
5. backend: `refactor(cost): 조회 조립 책임 분리 및 기준선 제거 (CQ-01)`
6. backend: `fix(budget): 편성 요약 대표행 선택 결정론화 (BE-30)`
7. backend: `refactor(budget): 편성 적용·요약 책임 분리 및 기준선 제거 (CQ-01)`
8. root: `docs: CQ-01 잔여 서비스 분해 완료 이관`

각 backend 리팩터 커밋은 독립적으로 배포 가능해야 하며, 세 도메인 리팩터를 하나의 커밋이나 하나의 대형 PR로 합치지 않는다.
