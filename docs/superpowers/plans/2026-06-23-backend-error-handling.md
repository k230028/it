# 백엔드 에러 처리 보강 (Critical+High 3건) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TASK.md "에러 처리" 백엔드 Critical+High 3건을 해소한다 — bulk-get 실패 건 가시화(B-1), 알림 리스너 트랜잭션 경계(B-2), 감사로그 실패 알람 승격(B-3).

**Architecture:** B-1은 3개 bulk-get 서비스/컨트롤러의 응답을 `{items, failedIds}` 래퍼로 바꾸고 catch에서 실패 ID를 수집·warn 로그한다. 프론트는 두 composable(`useProjects`/`useCost`)이 래퍼를 내부에서 풀어 `items` 배열을 그대로 반환하되 `failedIds`가 있으면 toast 경고를 띄워 호출부(plan/form.vue 등)는 변경하지 않는다. B-2는 리스너 핸들러에 `@Transactional(REQUIRES_NEW)` 추가. B-3은 `log.warn`→`log.error` 승격.

**Tech Stack:** Spring Boot 4 / Java 25 / JUnit5 + Mockito + AssertJ (백엔드), Nuxt 4 / TypeScript / Vitest + Playwright (프론트), PrimeVue Toast.

> **Spec:** `docs/superpowers/specs/2026-06-23-backend-error-handling-design.md`
>
> **기존 Phase 2 plan과의 관계:** `docs/superpowers/plans/2026-06-22-phase2-error-propagation-input-safety.md`는 예외→HTTP 매핑/로깅 표준화/Gemini 타임아웃/Validation을 다루며 본 3건과 겹치지 않는다. 유일 접점 `ChangeLogEntityListener.persistLog`는 Phase 2가 스택트레이스 전달(완료)을, 본 plan B-3이 그 위 `warn→error` 승격만 수행한다.
>
> ⚠️ **중첩 git 저장소 주의:** `it_backend`는 별도 git 저장소다(외부 `C:\it`에서 gitignore). 백엔드 변경 커밋은 반드시 `git -C it_backend ...`로 한다. 프론트(`it_frontend`)·문서는 각 경로를 추적하는 저장소에서 커밋한다(커밋 전 `git -C <dir> rev-parse --show-toplevel`로 확인).
>
> ℹ️ TASK.md가 부른 메서드명 `findByIds`는 실제로 `getApplicationsByIds`/`getProjectsByIds`/`getCostsByIds`다.

---

## File Structure

**백엔드 (it_backend, B-1):**
- `ApplicationDto.java` / `ProjectDto.java` / `CostDto.java` — 정적 중첩 `BulkResponse` record 추가.
- `ApplicationService.java` / `ProjectService.java` / `CostService.java` — `*ByIds` 반환형을 `BulkResponse`로, catch에서 failedIds 수집 + warn 로그.
- `ApplicationController.java` / `ProjectController.java` / `CostController.java` — 응답형을 `BulkResponse`로.
- 대응 `*ServiceTest.java` — 부분 성공 케이스 테스트.

**백엔드 (it_backend, B-2/B-3):**
- `NotificationEventListener.java` — 두 핸들러에 `@Transactional(REQUIRES_NEW)`.
- `ChangeLogEntityListener.java` — `log.warn`→`log.error` + 확장점 주석.
- 대응 테스트는 동작 회귀 방지 수준으로 보강.

**프론트 (it_frontend, B-1 파급):**
- `app/composables/useProjects.ts` / `app/composables/useCost.ts` — 래퍼 언랩 + toast.
- `tests/unit/composables/useProjects(.direct).test.ts` / `useCost(.direct).test.ts` — 새 응답 shape 반영.
- `tests/e2e/budget.spec.ts` — bulk-get mock을 래퍼로 감쌈.

---

## Task 1: B-1 ApplicationService bulk-get 실패 가시화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java` (BulkResponse 추가)
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java:497-511`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java:122-128`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java`

> DTO 파일의 정확한 위치 확인:
> Run: `git -C it_backend grep -l "class ApplicationDto"`

- [ ] **Step 1: 실패 케이스 테스트 작성**

`ApplicationServiceTest.java`에 추가(기존 import·`@Mock applicationRepository`·`@Mock approverRepository`·`@InjectMocks applicationService` 재사용). 존재하지 않는 ID는 `getApplication`이 `IllegalArgumentException`을 던지므로 `applicationRepository.findById`가 빈 Optional을 반환하게 한다.

```java
@Test
@DisplayName("getApplicationsByIds: 일부 미존재 ID는 failedIds에 담기고 items는 정상분만 반환")
void getApplicationsByIds_partialMissing_returnsItemsAndFailedIds() {
    // Arrange
    Capplm found = mock(Capplm.class);
    when(found.getApfMngNo()).thenReturn("APF-1");
    when(applicationRepository.findById("APF-1")).thenReturn(Optional.of(found));
    when(applicationRepository.findById("APF-X")).thenReturn(Optional.empty());
    when(approverRepository.findByDcdMngNoOrderByDcrSqnSnoAsc("APF-1"))
            .thenReturn(java.util.List.of());
    ApplicationDto.BulkGetRequest req = new ApplicationDto.BulkGetRequest();
    req.setApfMngNos(java.util.List.of("APF-1", "APF-X"));

    // Act
    ApplicationDto.BulkResponse result = applicationService.getApplicationsByIds(req);

    // Assert
    assertThat(result.items()).hasSize(1);
    assertThat(result.failedIds()).containsExactly("APF-X");
}
```

> `Capplm`/`BulkGetRequest`의 실제 getter/setter는 `git -C it_backend grep "class BulkGetRequest" -A 10 -- '*ApplicationDto.java'`로 확인해 필드 접근을 맞춘다(빌더면 빌더로 교체).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.approval.service.ApplicationServiceTest" 2>&1 | tail -20`
Expected: 컴파일 실패 — `BulkResponse` 미정의, `getApplicationsByIds` 반환형 불일치.

- [ ] **Step 3: BulkResponse record 추가**

`ApplicationDto.java`의 클래스 본문(다른 중첩 DTO 옆)에 추가:

```java
@Schema(name = "ApplicationBulkResponse", description = "신청서 일괄 조회 결과 (부분 성공)")
public record BulkResponse(
        @Schema(description = "조회 성공 항목") java.util.List<Response> items,
        @Schema(description = "조회 실패(미존재) 신청관리번호 목록") java.util.List<String> failedIds
) {}
```

- [ ] **Step 4: 서비스 메서드 수정**

`ApplicationService.java:497-511`을 통째로 교체:

```java
public ApplicationDto.BulkResponse getApplicationsByIds(ApplicationDto.BulkGetRequest request) {
    List<ApplicationDto.Response> items = new java.util.ArrayList<>();
    List<String> failedIds = new java.util.ArrayList<>();
    for (String apfMngNo : request.getApfMngNos()) {
        try {
            items.add(getApplication(apfMngNo)); // 개별 신청서 조회
        } catch (IllegalArgumentException e) {
            // 미존재 ID는 조용히 버리지 않고 실패 목록에 수집해 호출자에게 노출한다.
            failedIds.add(apfMngNo);
        }
    }
    if (!failedIds.isEmpty()) {
        log.warn("bulk-get 누락: type=application, failedIds={}", failedIds);
    }
    return new ApplicationDto.BulkResponse(items, failedIds);
}
```

> 클래스에 `@Slf4j`(lombok)가 없으면 추가: `git -C it_backend grep -n "Slf4j" -- '*ApplicationService.java'` 확인 후 없으면 클래스 어노테이션에 `@Slf4j` + `import lombok.extern.slf4j.Slf4j;`.

- [ ] **Step 5: 컨트롤러 수정**

`ApplicationController.java:124-127` 교체:

```java
    public ResponseEntity<ApplicationDto.BulkResponse> bulkGetApplications(
            @RequestBody ApplicationDto.BulkGetRequest request) {
        ApplicationDto.BulkResponse response = applicationService.getApplicationsByIds(request);
        return ResponseEntity.ok(response);
    }
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.approval.service.ApplicationServiceTest" 2>&1 | tail -20`
Expected: PASS. 기존 테스트가 옛 반환형(List)을 단언하면 함께 갱신.

- [ ] **Step 7: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/common/approval/ src/test/java/com/kdb/it/common/approval/
git -C it_backend commit -m "fix: 신청서 bulk-get 실패 ID 가시화 (BulkResponse)"
```

---

## Task 2: B-1 ProjectService bulk-get 실패 가시화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java` (BulkResponse 추가)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:630-678`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/controller/ProjectController.java:205-211`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`

> ProjectDto 경로 확인: `git -C it_backend grep -l "class ProjectDto"`

- [ ] **Step 1: 전건 미존재 테스트 작성**

`ProjectServiceTest.java`에 추가. `getProject`가 미존재 시 `IllegalArgumentException`을 던지도록 단건 조회 의존성이 빈 결과를 반환하게 모킹. `bseYy`는 null로 주어 BBUGTM 보강 분기를 건너뛴다. 전건 미존재는 `getProject` 성공 모킹이 불필요해 우선 채택한다.

```java
@Test
@DisplayName("getProjectsByIds: 전건 미존재면 items empty, failedIds 전부 (bseYy null)")
void getProjectsByIds_allMissing_collectsFailedIds() {
    // Arrange — getProject 내부 단건 조회가 빈 결과 → IllegalArgumentException
    when(projectRepository.findById(anyString())).thenReturn(Optional.empty());
    ProjectDto.BulkGetRequest req = new ProjectDto.BulkGetRequest();
    req.setPrjMngNos(java.util.List.of("PRJ-X", "PRJ-Y"));
    req.setBseYy(null);

    // Act
    ProjectDto.BulkResponse result = projectService.getProjectsByIds(req);

    // Assert
    assertThat(result.items()).isEmpty();
    assertThat(result.failedIds()).containsExactly("PRJ-X", "PRJ-Y");
}
```

> `getProject`가 의존하는 실제 repository/메서드명은 `git -C it_backend grep -n "public ProjectDto.Response getProject" -A 6 -- '*ProjectService.java'`로 확인해 `projectRepository.findById` 모킹 대상을 맞춘다. `BulkGetRequest`의 setter/빌더도 동일하게 확인.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.project.service.ProjectServiceTest" 2>&1 | tail -20`
Expected: 컴파일 실패 — `BulkResponse` 미정의.

- [ ] **Step 3: BulkResponse record 추가**

`ProjectDto.java`에 추가:

```java
@Schema(name = "ProjectBulkResponse", description = "정보화사업 일괄 조회 결과 (부분 성공)")
public record BulkResponse(
        @Schema(description = "조회 성공 항목") java.util.List<Response> items,
        @Schema(description = "조회 실패(미존재) 프로젝트관리번호 목록") java.util.List<String> failedIds
) {}
```

- [ ] **Step 4: 서비스 메서드 수정**

`ProjectService.java:630-643`의 스트림 수집부를 for 루프로 교체하고, 마지막 `return responses;`(:677)를 래퍼 반환으로 바꾼다. BBUGTM 보강 블록(:645-676)은 `responses` 변수를 그대로 사용하므로 유지한다.

수집부(630-643) 교체:

```java
public ProjectDto.BulkResponse getProjectsByIds(ProjectDto.BulkGetRequest request) {
    List<ProjectDto.Response> responses = new java.util.ArrayList<>();
    List<String> failedIds = new java.util.ArrayList<>();
    for (String prjMngNo : request.getPrjMngNos()) {
        try {
            responses.add(getProject(prjMngNo)); // 개별 상세 조회 (품목 포함)
        } catch (IllegalArgumentException e) {
            failedIds.add(prjMngNo);
        }
    }
    if (!failedIds.isEmpty()) {
        log.warn("bulk-get 누락: type=project, failedIds={}", failedIds);
    }
    // ── 이하 기존 BBUGTM 편성예산 보강 블록(bgYy 분기, 기존 645-676행) 그대로 유지 ──
```

마지막 줄 `return responses;`(:677)를 교체:

```java
    return new ProjectDto.BulkResponse(responses, failedIds);
}
```

> `@Slf4j` 존재 여부 확인 후 없으면 추가(Task 1 Step 4 동일).

- [ ] **Step 5: 컨트롤러 수정**

`ProjectController.java:207-210` 교체:

```java
    public ResponseEntity<ProjectDto.BulkResponse> bulkGetProjects(
            @RequestBody ProjectDto.BulkGetRequest request) {
        ProjectDto.BulkResponse responses = projectService.getProjectsByIds(request);
        return ResponseEntity.ok(responses);
    }
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.project.service.ProjectServiceTest" 2>&1 | tail -20`
Expected: PASS. 기존 테스트가 옛 List 반환을 단언하면 `.items()`로 갱신.

- [ ] **Step 7: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/budget/project/ src/test/java/com/kdb/it/domain/budget/project/
git -C it_backend commit -m "fix: 정보화사업 bulk-get 실패 ID 가시화 (BulkResponse)"
```

---

## Task 3: B-1 CostService bulk-get 실패 가시화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/dto/CostDto.java` (BulkResponse 추가)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:402-434`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java:183-189`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`

> CostDto 경로 확인: `git -C it_backend grep -l "class CostDto"`

- [ ] **Step 1: 전건 미존재 테스트 작성**

`CostServiceTest.java`에 추가. `getCost` 미존재 시 `IllegalArgumentException`. `bseYy`는 null.

```java
@Test
@DisplayName("getCostsByIds: 전건 미존재면 items empty, failedIds 전부")
void getCostsByIds_allMissing_collectsFailedIds() {
    // Arrange — getCost 내부 단건 조회가 빈 결과 → IllegalArgumentException
    when(costRepository.findById(anyString())).thenReturn(Optional.empty());
    CostDto.BulkGetRequest req = new CostDto.BulkGetRequest();
    req.setCostBgNos(java.util.List.of("COST-X", "COST-Y"));
    req.setBseYy(null);

    // Act
    CostDto.BulkResponse result = costService.getCostsByIds(req);

    // Assert
    assertThat(result.items()).isEmpty();
    assertThat(result.failedIds()).containsExactly("COST-X", "COST-Y");
}
```

> `getCost`가 의존하는 실제 repository/메서드명은 `git -C it_backend grep -n "public CostDto.Response getCost" -A 5 -- '*CostService.java'`로 확인해 모킹 대상을 맞춘다. `BulkGetRequest` setter/빌더도 동일 확인.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest" 2>&1 | tail -20`
Expected: 컴파일 실패 — `BulkResponse` 미정의.

- [ ] **Step 3: BulkResponse record 추가**

`CostDto.java`에 추가:

```java
@Schema(name = "CostBulkResponse", description = "전산관리비 일괄 조회 결과 (부분 성공)")
public record BulkResponse(
        @Schema(description = "조회 성공 항목") java.util.List<Response> items,
        @Schema(description = "조회 실패(미존재) 전산관리비관리번호 목록") java.util.List<String> failedIds
) {}
```

- [ ] **Step 4: 서비스 메서드 수정**

`CostService.java:402-415`의 스트림 수집부를 for 루프로 교체, 마지막 `return responses;`(:433)를 래퍼로 교체. BBUGTM 보강 블록(:417-432)은 유지.

수집부(402-415) 교체:

```java
public CostDto.BulkResponse getCostsByIds(CostDto.BulkGetRequest request) {
    List<CostDto.Response> responses = new java.util.ArrayList<>();
    List<String> failedIds = new java.util.ArrayList<>();
    for (String costBgNo : request.getCostBgNos()) {
        try {
            responses.add(getCost(costBgNo));
        } catch (IllegalArgumentException e) {
            failedIds.add(costBgNo);
        }
    }
    if (!failedIds.isEmpty()) {
        log.warn("bulk-get 누락: type=cost, failedIds={}", failedIds);
    }
    // ── 이하 기존 BBUGTM 편성예산 보강 블록(bseYy 분기, 기존 417-432행) 그대로 유지 ──
```

마지막 `return responses;`(:433) 교체:

```java
    return new CostDto.BulkResponse(responses, failedIds);
}
```

> `@Slf4j` 존재 여부 확인 후 없으면 추가.

- [ ] **Step 5: 컨트롤러 수정**

`CostController.java:188-189` 교체:

```java
    public ResponseEntity<CostDto.BulkResponse> getCostsByIds(@RequestBody CostDto.BulkGetRequest request) {
        return ResponseEntity.ok(costService.getCostsByIds(request));
    }
```

`CostController`의 `@ApiResponses` 어노테이션(:184-186)이 `CostDto.Response.class`를 schema로 명시하므로 `CostDto.BulkResponse.class`로 갱신:

```java
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "조회 성공", content = @Content(schema = @Schema(implementation = CostDto.BulkResponse.class)))
    })
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest" 2>&1 | tail -20`
Expected: PASS. 기존 테스트의 List 단언은 `.items()`로 갱신.

- [ ] **Step 7: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/budget/cost/ src/test/java/com/kdb/it/domain/budget/cost/
git -C it_backend commit -m "fix: 전산관리비 bulk-get 실패 ID 가시화 (BulkResponse)"
```

---

## Task 4: B-1 프론트 — composable 언랩 + toast 경고

**Files:**
- Modify: `it_frontend/app/composables/useProjects.ts:183-193`
- Modify: `it_frontend/app/composables/useCost.ts:156-163`
- Test: `it_frontend/tests/unit/composables/useProjects.direct.test.ts`, `useProjects.test.ts`
- Test: `it_frontend/tests/unit/composables/useCost.direct.test.ts`, `useCost.test.ts`
- Test: `it_frontend/tests/e2e/budget.spec.ts:187-199`

설계: 응답을 `{items, failedIds}` 래퍼로 받고, `items` 배열을 반환(호출부 불변). `failedIds`가 있으면 toast 경고. 호출부(`plan/form.vue` 등)는 변경하지 않는다.

> **Step 0 (저장소 확인):** `git -C it_frontend rev-parse --show-toplevel` — 결과가 `.../it_frontend`이면 `git -C it_frontend`로 커밋, `.../it`(외부)면 루트에서 `git add it_frontend/...`로 커밋한다.

- [ ] **Step 1: useProjects 단위 테스트 갱신 (실패 유도)**

`useProjects.direct.test.ts`의 `fetchProjectsBulk` 테스트(76-86행 부근)를 새 응답 shape로 교체:

```ts
it('래퍼 응답에서 items 배열을 반환한다', async () => {
    const mockData = [{ prjMngNo: 'PRJ-001' }, { prjMngNo: 'PRJ-002' }];
    mockApiFetch.mockResolvedValue({ items: mockData, failedIds: [] });
    const { fetchProjectsBulk } = useProjects();
    const result = await fetchProjectsBulk(['PRJ-001', 'PRJ-002']);
    expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/bulk-get`, {
        method: 'POST',
        body: { prjMngNos: ['PRJ-001', 'PRJ-002'] },
    });
    expect(result).toEqual(mockData);
});

it('failedIds가 있으면 toast 경고를 띄운다', async () => {
    mockApiFetch.mockResolvedValue({ items: [], failedIds: ['PRJ-X'] });
    const { fetchProjectsBulk } = useProjects();
    await fetchProjectsBulk(['PRJ-X']);
    expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' }),
    );
});
```

> 이 파일은 `useToast`를 모킹해야 한다. 파일 상단 mock 영역에 추가:
> ```ts
> const mockToastAdd = vi.fn();
> vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: mockToastAdd }) }));
> ```
> `beforeEach`에 `mockToastAdd.mockClear();` 추가. `useProjects.test.ts`의 `fetchProjectsBulk` describe(389-407행)도 응답을 `{ items: [...], failedIds: [] }`로 감싸도록 갱신.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_frontend && npm test -- useProjects 2>&1 | tail -25`
Expected: FAIL — 현재 구현은 배열을 그대로 반환하므로 `result`가 `{items,...}`거나 toast 미호출.

- [ ] **Step 3: useProjects 구현 수정**

`useProjects.ts` composable 함수 본문 상단(다른 ref/const 선언 옆)에 toast 확보:

```ts
const toast = useToast();
```

`fetchProjectsBulk`(183-193) 교체:

```ts
    const fetchProjectsBulk = async (prjMngNos: string[], bgYy?: string): Promise<ProjectDetail[]> => {
        const res = await $apiFetch<{ items: ProjectDetail[]; failedIds: string[] }>(
            `${API_BASE_URL}/bulk-get`,
            {
                method: 'POST',
                body: {
                    prjMngNos,
                    // 백엔드 BulkGetRequest 필드명은 bseYy. 이 값이 있어야 BBUGTM 편성액이 채워진다.
                    ...(bgYy ? { bseYy: bgYy } : {}),
                },
            },
        );
        if (res.failedIds?.length) {
            toast.add({
                severity: 'warn',
                summary: '일부 사업 조회 실패',
                detail: `${res.failedIds.length}건을 불러오지 못했습니다.`,
                life: 3000,
            });
        }
        return res.items ?? [];
    };
```

> `useToast`는 PrimeVue auto-import 대상이라 런타임 import 불필요(테스트는 Step 1에서 mock). 파일에 이미 `import { useToast } from 'primevue/usetoast';`가 있으면 재사용.

- [ ] **Step 4: useProjects 테스트 통과 확인**

Run: `cd it_frontend && npm test -- useProjects 2>&1 | tail -25`
Expected: PASS.

- [ ] **Step 5: useCost 단위 테스트 갱신 (실패 유도)**

`useCost.direct.test.ts`의 `fetchCostsBulk` 테스트(70-94행 부근)를 래퍼 shape로 갱신하고 toast 테스트 추가:

```ts
it('래퍼 응답에서 items 배열을 반환한다', async () => {
    mockApiFetch.mockResolvedValue({ items: [{ costBgNo: 'COST-001' }], failedIds: [] });
    const { fetchCostsBulk } = useCost();
    const result = await fetchCostsBulk(['COST-001']);
    expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/bulk-get`, {
        method: 'POST',
        body: { costBgNos: ['COST-001'] },
    });
    expect(result).toEqual([{ costBgNo: 'COST-001' }]);
});

it('failedIds가 있으면 toast 경고를 띄운다', async () => {
    mockApiFetch.mockResolvedValue({ items: [], failedIds: ['COST-X'] });
    const { fetchCostsBulk } = useCost();
    await fetchCostsBulk(['COST-X']);
    expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn' }),
    );
});
```

> Step 1과 동일한 `useToast` mock 블록을 이 파일에도 추가(+`beforeEach` clear). `useCost.test.ts`의 `fetchCostsBulk` describe(305-319행)도 응답을 `{ items: [...], failedIds: [] }`로 감싸도록 갱신.

- [ ] **Step 6: useCost 테스트 실패 확인**

Run: `cd it_frontend && npm test -- useCost 2>&1 | tail -25`
Expected: FAIL.

- [ ] **Step 7: useCost 구현 수정**

`useCost.ts` composable 본문 상단에 `const toast = useToast();` 추가 후 `fetchCostsBulk`(156-163) 교체:

```ts
    const fetchCostsBulk = async (costBgNos: string[], bseYy?: string): Promise<ItCost[]> => {
        const res = await $apiFetch<{ items: ItCost[]; failedIds: string[] }>(
            `${API_BASE_URL}/bulk-get`,
            {
                method: 'POST',
                body: {
                    costBgNos,
                    ...(bseYy ? { bseYy } : {}),
                },
            },
        );
        if (res.failedIds?.length) {
            toast.add({
                severity: 'warn',
                summary: '일부 전산업무비 조회 실패',
                detail: `${res.failedIds.length}건을 불러오지 못했습니다.`,
                life: 3000,
            });
        }
        return res.items ?? [];
    };
```

- [ ] **Step 8: useCost 테스트 통과 확인**

Run: `cd it_frontend && npm test -- useCost 2>&1 | tail -25`
Expected: PASS.

- [ ] **Step 9: e2e mock 래퍼로 갱신**

`budget.spec.ts:187-199`의 두 mock 응답 body를 래퍼로 감싼다:

```ts
        await page.route(/\/api\/projects\/bulk-get/, (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ items: mockProjects, failedIds: [] }),
            }),
        );
        await page.route(/\/api\/cost\/bulk-get/, (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ items: mockCosts, failedIds: [] }),
            }),
        );
```

- [ ] **Step 10: 타입체크 + 단위 일괄 확인**

Run: `cd it_frontend && npm run typecheck 2>&1 | tail -15 && npm test -- composables 2>&1 | tail -15`
Expected: typecheck 오류 0, 단위 PASS.

- [ ] **Step 11: 커밋**

```bash
git -C it_frontend add app/composables/useProjects.ts app/composables/useCost.ts tests/unit/composables/ tests/e2e/budget.spec.ts
git -C it_frontend commit -m "fix: bulk-get 응답 래퍼 언랩 및 실패건 toast 경고"
```

> Step 0에서 외부 저장소로 확인되면 루트에서 `git add it_frontend/...` 후 커밋.

---

## Task 5: B-2 NotificationEventListener 트랜잭션 경계

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/event/NotificationEventListener.java:51-52, 81-82`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/event/NotificationEventListenerTest.java`

- [ ] **Step 1: 동작 회귀 테스트 확인/추가**

기존 `NotificationEventListenerTest`에 `onApprovalCompleted` 발송 검증 테스트가 있으면 그대로 둔다(트랜잭션 어노테이션은 단위 테스트로 직접 검증 불가). 없으면 동작 회귀 방지용으로 추가:

```java
@Test
@DisplayName("onApprovalCompleted: capplm 존재 시 결재결과 알림을 발송한다")
void onApprovalCompleted_found_sends() {
    Capplm capplm = mock(Capplm.class);
    when(capplm.getDcdReqTtl()).thenReturn("제목");
    when(capplm.getDcdReqUsid()).thenReturn("E1");
    when(applicationRepository.findById("APF-1")).thenReturn(Optional.of(capplm));
    ApprovalCompletedEvent ev = mock(ApprovalCompletedEvent.class);
    when(ev.apfMngNo()).thenReturn("APF-1");
    when(ev.newStatus()).thenReturn("승인");

    listener.onApprovalCompleted(ev);

    verify(notificationService).send(any(NotificationEvent.class));
}
```

> `listener`/`@Mock notificationService`/`@Mock applicationRepository` 주입은 기존 테스트 셋업을 따른다. `ApprovalCompletedEvent`의 실제 접근자(record면 `apfMngNo()` 등)는 `git -C it_backend grep -n "ApprovalCompletedEvent" -A 8 -- '*ApprovalCompletedEvent.java'`로 확인.

- [ ] **Step 2: 테스트 통과(현행 동작) 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.notification.event.NotificationEventListenerTest" 2>&1 | tail -20`
Expected: PASS (어노테이션 추가 전에도 동작 동일).

- [ ] **Step 3: REQUIRES_NEW 추가**

`NotificationEventListener.java` 상단 import 추가:

```java
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
```

`onApprovalCompleted`(:51-52)와 `onApprovalRecalled`(:81-82) 두 메서드의 `@TransactionalEventListener(...)` 아래에 각각 추가:

```java
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onApprovalCompleted(ApprovalCompletedEvent event) {
```

```java
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onApprovalRecalled(ApprovalRecalledEvent event) {
```

> `onNotificationEvent`(:38-39)는 `findById` 없이 곧장 `send()`(이미 REQUIRES_NEW)를 호출하므로 변경하지 않는다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.notification.event.NotificationEventListenerTest" 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/common/notification/event/ src/test/java/com/kdb/it/common/notification/event/
git -C it_backend commit -m "fix: 알림 결재 리스너 AFTER_COMMIT 트랜잭션 경계(REQUIRES_NEW) 추가"
```

---

## Task 6: B-3 ChangeLogEntityListener 감사로그 실패 알람 승격

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java:107-113`
- Test: `it_backend/src/test/java/com/kdb/it/domain/log/listener/ChangeLogEntityListenerTest.java`

- [ ] **Step 1: 실패 시 예외 미전파 회귀 테스트 확인/추가**

`ChangeLogEntityListenerTest`에 "AuditLogPersister가 던져도 onPrePersist가 예외를 전파하지 않는다" 테스트가 있으면 유지. 없으면 추가(로그 레벨이 아니라 "삼킴 동작"을 고정):

```java
@Test
@DisplayName("persist 실패해도 리스너는 예외를 전파하지 않는다")
void persistLog_whenPersisterThrows_doesNotPropagate() {
    // @LogTarget 달린 더미 엔티티와 ApplicationContextHolder mock 설정은 기존 테스트 패턴 재사용.
    // persister.persist(...)가 RuntimeException을 던지도록 스텁한 뒤:
    assertThatCode(() -> listener.onPrePersist(loggedEntity)).doesNotThrowAnyException();
}
```

> `ApplicationContextHolder.getBean(AuditLogPersister.class)` 정적 호출 모킹 방식은 기존 `ChangeLogEntityListenerTest`의 셋업을 그대로 따른다(정적 모킹 인프라가 있으면 재사용; 없으면 본 회귀 테스트는 생략하고 Step 3만 진행).

- [ ] **Step 2: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.ChangeLogEntityListenerTest" 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 3: log.warn → log.error 승격 + 확장점 주석**

`ChangeLogEntityListener.java:107-113`의 catch 블록 교체:

```java
        } catch (Exception e) {
            // 감사로그 실패가 본 업무 트랜잭션을 롤백시키지 않도록 예외를 삼킨다.
            // 시퀀스 미생성(ORA-02289) 등 인프라 오류 시 본 작업은 정상 완료되어야 한다.
            // 단, 감사 추적 유실은 비정상 상황이므로 ERROR로 승격해 로그 수집/모니터링 알람에 노출한다.
            // 확장점: 운영 알람 인프라(EAI 알림톡/메일, 관리자 인앱 알림) 도입 시 여기서 통지 연동.
            //         단, 인앱 알림 발행은 그 자체가 감사로그 대상이라 재귀/연쇄 실패 위험이 있어 별도 채널 권장.
            log.error("[감사로그 기록 실패] entity={}, logClass={}, chgTp={}",
                    entity.getClass().getSimpleName(), logClass.getSimpleName(), chgTp, e);
        }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.ChangeLogEntityListenerTest" 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/log/listener/ src/test/java/com/kdb/it/domain/log/listener/
git -C it_backend commit -m "fix: 감사로그 기록 실패 로그를 ERROR로 승격(모니터링 알람 노출)"
```

---

## Task 7: 전체 검증 및 TASK 갱신

- [ ] **Step 1: 백엔드 전체 테스트 (clean)**

인증/결재/변경로그 공통 영향이므로 clean 재검증 (§5.9):

Run: `cd it_backend && ./gradlew clean test 2>&1 | tail -30`
Expected: BUILD SUCCESSFUL, 본 변경으로 새로 깨진 테스트 0.

> TASK.md 백엔드 리팩토링 항목에 등록된 기존 스텁 불일치 실패(`CostServiceTest`/`BudgetWorkServiceTest`)가 본 변경과 무관하게 남아 있을 수 있다. 본 작업으로 **새로 깨진** 테스트가 없는지에 집중하고, 무관한 기존 실패는 결과에 명시한다.

- [ ] **Step 2: 프론트 정적 점검 + 단위**

Run: `cd it_frontend && npm run check 2>&1 | tail -20 && npm test 2>&1 | tail -20`
Expected: typecheck/lint 오류 0, 단위 PASS.

- [ ] **Step 3: TASK.md 항목 상태 갱신**

`TASK.md` 에러 처리 백엔드 3건을 완료 처리하고 `TASK_DONE.md`로 이관(기존 이관 커밋 관례 참조):
- line 52 `NotificationEventListener.onApprovalCompleted()` (B-2)
- line 60 `ApplicationService/ProjectService/CostService` null 삼킴 (B-1)
- line 61 `ChangeLogEntityListener.beforeAnyOperation()` 알람 연동 (B-3)

프론트 sweep 12건은 그대로 남긴다.

- [ ] **Step 4: 문서/TASK 커밋**

```bash
git add TASK.md TASK_DONE.md docs/superpowers/
git commit -m "docs: 에러 처리 백엔드 3건 완료 이관(TASK_DONE)"
```

---

## Self-Review 체크리스트 (작성자 수행 완료)

- **Spec coverage:** B-1(Task 1-4) / B-2(Task 5) / B-3(Task 6) 전부 매핑. 프론트 파급(Task 4)은 spec의 "프론트 직접 호출부 동시 수정"에 대응. 비범위(프론트 12건, Medium/Low)는 제외 유지.
- **Type consistency:** 래퍼명 `BulkResponse(items, failedIds)`로 3개 DTO 일관. 서비스/컨트롤러 반환형·프론트 언랩 타입 `{items, failedIds}` 일치. 메서드명 `getApplicationsByIds/getProjectsByIds/getCostsByIds` 일관.
- **Placeholder scan:** 코드 스텝마다 완전한 코드 제공. "확인" 지시는 실제 git grep 명령으로 구체화. TBD/TODO 없음.
- **알려진 변동점:** `it_frontend` 저장소 소속은 Task 4 Step 0의 `rev-parse`로 확정. 기존 무관 테스트 실패는 Task 7 Step 1에서 구분. `BulkGetRequest` 접근 방식(setter vs builder)·단건 finder 메서드명은 각 Task에서 git grep으로 검증 후 맞춤.
```
