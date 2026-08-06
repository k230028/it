# 잔여과제 저비용 배치 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md`의 활성 잔여과제 중 코드 변경만으로 완결되는 4건(ERR-14 · BE-34 · FE-21+FE-28② · FE-30①)을 조치하고 문서를 정리한다.

**Architecture:** 저장소 2개에 걸친 독립 조치 4건이다. 서로 코드 의존이 없으므로 4-repo 규약(백엔드 계약 커밋 먼저)만 순서를 정한다. ERR-14는 `TASK.md` 근거가 낡아 결함 존치 여부부터 실측으로 판정하고 그 결과로 분기한다. BE-34는 원인 수정이 아니라 파라미터명을 고정하는 우회이며, 나머지 둘은 기존에 검증된 처방(FE-24 패턴, 시퀀스 토큰)의 적용이다.

**Tech Stack:** Spring Boot 4.1 / springdoc-openapi 3.0.3 / Java 25 (백엔드), Nuxt 4 / Vue 3 / TypeScript / Vitest (프론트)

## Global Constraints

- 기준 커밋: root `8aface0`, backend `981b112a`, frontend `9cf9d84`. 세 저장소 모두 착수 시점 `main`이 clean이다.
- 브랜치: `it_backend`는 `feature/be34-openapi-parameter-names`, `it_frontend`는 `feature/task-quickfix-batch1`. root(`C:\it`)는 문서만 다루므로 `main`에서 직접 커밋한다.
- 커밋 순서는 **백엔드 → 프론트**다(`C:\it\CLAUDE.md` §2 4-repo 규약). Task 3·4가 Task 5 이후로 밀리면 안 된다.
- 모든 신규 주석은 한글로 작성한다(`C:\it\CLAUDE.md` §4.1). public API·service 메서드·composable 반환 함수에는 입력값과 실패 조건을 함께 기록한다. 단순 대입에는 주석을 달지 않는다.
- 프론트 게이트: `npm run check`, `npm test`, `npm run codegen:check`. 백엔드 게이트: `./gradlew check`.
- `npm run test:e2e`는 **실행하지 않는다**. 4건 모두 단위 수준에서 관측 가능하고 이 환경에서는 프론트·백엔드·DB 동시 기동이 어렵다.
- 백엔드 코드 수정 후에는 반드시 `./gradlew spotlessApply`를 실행한다(AOSP 스타일, `./gradlew check`가 포맷 위반을 실패로 처리한다).
- `.stylelintrc.json`·`eslint.config.mjs`는 config-protection 훅 대상이라 이 배치에서 건드리지 않는다.
- 설계 SoT: [`docs/superpowers/specs/2026-08-06-task-quickfix-batch1-design.md`](../specs/2026-08-06-task-quickfix-batch1-design.md)

---

## File Structure

**신규 생성**

| 파일 | 책임 |
| --- | --- |
| `it_frontend/tests/unit/composables/useApiFetchRefreshCoordinator.test.ts` | 401 갱신 주기의 유한성 특성화 테스트 (ERR-14) |

**수정**

| 파일 | 변경 내용 |
| --- | --- |
| `it_backend/.../project/controller/ProjectController.java:77` | `condition`에 `@ParameterObject` 추가 |
| `it_backend/.../file/controller/FileController.java:71` | `condition`에 `@ParameterObject` 추가 |
| `it_backend/.../cost/controller/CostController.java:168` | `condition`에 `@ParameterObject` 추가 |
| `it_backend/.../board/controller/BoardPostController.java:37` | `cond`에 `@ParameterObject` 추가 |
| `it_backend/.../admin/controller/AdminController.java:366,426` | `pageable` 2건에 `@ParameterObject` 추가 |
| `it_frontend/app/types/api.d.ts` | codegen 재생성 결과 (수기 편집 금지) |
| `it_frontend/app/composables/useMentionAutocomplete.ts` | 응답 순서 역전 가드 |
| `it_frontend/app/composables/useGlobalSearch.ts` | 응답 순서 역전 가드 |
| `it_frontend/app/composables/useApprovalDashboard.ts` | 가드 배선용 필드 노출 |
| `it_frontend/app/composables/useDocumentDashboard.ts` | 가드 배선용 필드 노출 |
| `it_frontend/tests/unit/composables/useMentionAutocomplete.test.ts` | 순서 역전 테스트 추가 (FE-28②) |
| `it_frontend/tests/unit/composables/useGlobalSearch.test.ts` | 순서 역전 테스트 추가 (FE-28②) |
| `it_frontend/tests/unit/composables/useApprovalDashboard.direct.test.ts` | 노출 필드 단언 갱신 |
| `it_frontend/tests/unit/composables/useDocumentDashboard.direct.test.ts` | 노출 필드 단언 갱신 |
| `C:\it\TASK.md`, `C:\it\TASK_DONE.md`, `C:\it\versions.lock` | 문서 정리 |

**착수 전 조사에서 확정된 사실 (Task 7 설계 근거)**

`useApprovalDashboard`와 `useDocumentDashboard`가 여는 두 URL의 소비처를 전수 확인했다.

- `/api/applications/dashboard` → `app/pages/approval/index.vue:25` **1곳**
- `/api/documents/dashboard` → `app/pages/info/documents/index.vue:29` **1곳**
- 사이드바 배지는 별도 엔드포인트(`/api/documents/badge-count`, `/api/applications/badge-count`)를 쓴다 — `useDocumentDashboard.ts:108-109` 주석이 이 분리를 이미 기록하고 있다.

따라서 **asyncData 키를 공유하는 소비자가 없으므로 명시 `key` 옵션을 도입하지 않는다.** 설계 스펙 §3.4는 FE-24 처방(명시 `key`로 분리 후 노출)을 기본으로 적었으나 그 전제인 "키 공유 확인"을 실제로 수행한 결과 공유가 없었다. 불필요한 옵션을 넣지 않는다(YAGNI). 대신 그 판단 근거를 JSDoc에 남겨, 나중에 소비처가 늘면 키 분리가 필요하다는 사실이 드러나게 한다.

---

## Task 1: ERR-14 — 401 갱신 주기 유한성 특성화 테스트

**성격:** 이 태스크는 **조사**다. 결함이 이미 해소됐는지를 코드 판독이 아니라 실측으로 판정한다. 따라서 테스트가 처음부터 통과할 수 있고, **그것이 정상적인 결과**다(TDD의 RED 요구를 어기는 것이 아니라 기존 동작을 특성화하는 것이다). 결과에 따라 Task 2가 2A 또는 2B로 갈린다.

**Files:**
- Create: `it_frontend/tests/unit/composables/useApiFetchRefreshCoordinator.test.ts`

**Interfaces:**
- Consumes: `createUseApiFetchRefreshCoordinator(options: { refresh: () => Promise<boolean>; terminateSession: () => Promise<void> })` from `~/composables/api/useApiFetchRefreshCoordinator`. 반환 객체는 `{ bindRetry(cb: () => Promise<unknown>): void; registerScopedRetry(): () => void; onResponseError(status: number): Promise<boolean> }`.
- Produces: 판정 결과(통과/실패). Task 2가 이 결과로 분기한다.

**배경:** `TASK.md` ERR-14는 `useApiFetch.ts`의 `isRefreshing`·`tokenRefreshSignal`을 지목하지만 그 심볼은 저장소에 존재하지 않는다. 401 처리는 `app/composables/api/useApiFetchRefreshCoordinator.ts`로 분리됐고, 그 모듈의 45~57행은 재시도 파동 중(`phase === 'retrying'`) 다시 401이 오면 `terminateCycle`을 호출한다. 이 경로가 실제로 루프를 끊는지 확인한다.

**주의 — 모듈 전역 상태:** 코디네이터는 모듈 수준 `activeCycle`과 `retryConsumers`를 갖는다. 리셋 API가 없으므로 테스트마다 `vi.resetModules()` + 동적 `import()`로 새 모듈 인스턴스를 얻는다.

- [ ] **Step 1: 브랜치 생성**

```bash
git -C C:/it/it_frontend checkout -b feature/task-quickfix-batch1
```

- [ ] **Step 2: 특성화 테스트 작성**

`it_frontend/tests/unit/composables/useApiFetchRefreshCoordinator.test.ts` 를 생성한다.

```ts
/**
 * ============================================================================
 * [tests/unit/composables/useApiFetchRefreshCoordinator.test.ts]
 * 401 갱신 주기 조정자 — 재시도 유한성 특성화 테스트 (ERR-14)
 * ============================================================================
 * ERR-14는 "갱신 후에도 서버가 계속 401을 내면 401 → refresh → 재조회 → 401이
 * 무한 반복된다"는 자원 고갈 결함으로 등재됐다. 이 테스트는 그 시나리오를 실제로
 * 재현해 재시도가 유한한지 판정한다.
 *
 * 코디네이터는 모듈 수준 상태(activeCycle·retryConsumers)를 가지므로 테스트마다
 * vi.resetModules()로 새 모듈 인스턴스를 얻는다.
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/** 매 테스트마다 모듈 전역 상태가 깨끗한 코디네이터 팩토리를 얻는다. */
async function freshFactory() {
    vi.resetModules();
    const mod = await import('~/composables/api/useApiFetchRefreshCoordinator');
    return mod.createUseApiFetchRefreshCoordinator;
}

describe('useApiFetchRefreshCoordinator — 재시도 유한성 (ERR-14)', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('갱신 성공 후 재시도가 다시 401을 내도 무한 반복하지 않고 세션을 종료한다', async () => {
        const createCoordinator = await freshFactory();
        /* 갱신은 항상 성공한다고 보고하지만 서버는 계속 401을 낸다 — ERR-14가 서술한 상황 */
        const refresh = vi.fn(async () => true);
        const terminateSession = vi.fn(async () => undefined);

        const coordinator = createCoordinator({ refresh, terminateSession });
        const dispose = coordinator.registerScopedRetry();

        let retryCount = 0;
        coordinator.bindRetry(async () => {
            retryCount += 1;
            /* 폭주 시 테스트가 영원히 멈추지 않도록 하드 상한을 둔다.
               이 상한에 걸린다는 것 자체가 결함이 살아 있다는 뜻이다. */
            if (retryCount > 50) throw new Error('재시도가 50회를 넘었다 — 무한 반복');
            /* 재조회가 다시 401을 받는 상황 */
            await coordinator.onResponseError(401);
        });

        const handled = await coordinator.onResponseError(401);
        dispose();

        expect(handled).toBe(true);
        expect(retryCount).toBeLessThanOrEqual(50);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(terminateSession).toHaveBeenCalledTimes(1);
    });

    it('갱신이 실패하면 재시도 없이 세션을 한 번만 종료한다', async () => {
        const createCoordinator = await freshFactory();
        const refresh = vi.fn(async () => false);
        const terminateSession = vi.fn(async () => undefined);

        const coordinator = createCoordinator({ refresh, terminateSession });
        const retry = vi.fn(async () => undefined);
        coordinator.bindRetry(retry);
        const dispose = coordinator.registerScopedRetry();

        await coordinator.onResponseError(401);
        dispose();

        expect(retry).not.toHaveBeenCalled();
        expect(terminateSession).toHaveBeenCalledTimes(1);
    });

    it('401이 아닌 응답은 주기를 시작하지 않는다', async () => {
        const createCoordinator = await freshFactory();
        const refresh = vi.fn(async () => true);
        const terminateSession = vi.fn(async () => undefined);

        const coordinator = createCoordinator({ refresh, terminateSession });

        await expect(coordinator.onResponseError(500)).resolves.toBe(false);
        expect(refresh).not.toHaveBeenCalled();
        expect(terminateSession).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: 테스트 실행 — 판정**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useApiFetchRefreshCoordinator.test.ts
```

두 결과 중 하나가 나온다. **어느 쪽인지 기록하고 Task 2의 분기를 정한다.**

- **3개 모두 PASS** → **분기 A**. `phase === 'retrying'` 경로가 루프를 끊고 있다. ERR-14는 이미 해소됐다. Task 2A로 간다.
- **첫 번째 테스트가 FAIL** (`재시도가 50회를 넘었다` 또는 `terminateSession` 호출 0회) → **분기 B**. 결함이 살아 있다. Task 2B로 간다.

> 나머지 두 테스트가 실패하면 그것은 이 배치의 범위 밖 결함이다. 실패 내용을 기록하고 사용자에게 알린 뒤 계속할지 확인한다.

- [ ] **Step 4: 커밋**

```bash
cd C:/it/it_frontend && git add tests/unit/composables/useApiFetchRefreshCoordinator.test.ts && git commit -m "test: 401 갱신 주기 재시도 유한성 특성화 테스트 추가 (ERR-14)"
```

---

## Task 2A: ERR-14 — 해소 확인 후 종결 (Task 1이 분기 A일 때만)

**Files:**
- Modify: `it_frontend/app/composables/api/useApiFetchRefreshCoordinator.ts` (주석만)

**Interfaces:**
- Consumes: Task 1의 판정 결과
- Produces: 없음 (문서·주석 변경)

Task 1의 테스트가 이미 회귀 방지 역할을 한다. 코드 동작은 바꾸지 않고, 이 보호가 **의도된 것**임을 코드에 명시해 나중에 리팩터링으로 조용히 사라지지 않게 한다.

- [ ] **Step 1: 코디네이터에 의도 주석 추가**

`app/composables/api/useApiFetchRefreshCoordinator.ts`의 `onResponseError` 안, 기존 주석 없는 분기에 다음을 넣는다. 대상은 아래 `if` 블록이다.

```ts
            const cycle = activeCycle;
            if (cycle?.phase === 'retrying' || cycle?.phase === 'terminating') {
                await terminateCycle(cycle, options.terminateSession);
                return true;
            }
```

이것을 다음으로 바꾼다.

```ts
            const cycle = activeCycle;
            /* 갱신 직후의 재시도가 다시 401을 받으면 그 갱신은 무의미했다는 뜻이므로
               새 주기를 열지 않고 즉시 종료한다. 이 분기가 ERR-14(401 → refresh →
               재조회 → 401 무한 반복)의 상한 역할을 하므로 제거하면 폭주가 되살아난다.
               회귀 방지: tests/unit/composables/useApiFetchRefreshCoordinator.test.ts */
            if (cycle?.phase === 'retrying' || cycle?.phase === 'terminating') {
                await terminateCycle(cycle, options.terminateSession);
                return true;
            }
```

- [ ] **Step 2: 테스트 재실행 — 동작 불변 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useApiFetchRefreshCoordinator.test.ts tests/unit/composables/useApiFetch.direct.test.ts
```

Expected: 전부 PASS (주석만 바뀌었으므로 Step 3의 결과와 동일해야 한다)

- [ ] **Step 3: 커밋**

```bash
cd C:/it/it_frontend && git add app/composables/api/useApiFetchRefreshCoordinator.ts && git commit -m "docs: 401 재시도 상한 분기의 의도를 주석으로 고정 (ERR-14)"
```

---

## Task 2B: ERR-14 — 연속 갱신 주기 상한 도입 (Task 1이 분기 B일 때만)

> **실행 결과: 미실행.** Task 1이 **분기 A**(재현 불가)로 판정돼 이 태스크는 수행하지 않았다.
> 아래는 실행되지 않은 대안 경로이며 현재 코드베이스에 반영된 것이 없다. 착수할 일감이 아니다.

**Files:**
- Modify: `it_frontend/app/composables/api/useApiFetchRefreshCoordinator.ts`
- Test: `it_frontend/tests/unit/composables/useApiFetchRefreshCoordinator.test.ts`

**Interfaces:**
- Consumes: Task 1의 판정 결과
- Produces: 모듈 상수 `MAX_CONSECUTIVE_CYCLES = 3`, `CYCLE_BURST_WINDOW_MS = 60_000` (모듈 내부, export하지 않음)

상한은 개별 `useApiFetch` 인스턴스가 아니라 **코디네이터**에 둔다. 인스턴스에 두면 각자 따로 세어 합산 상한이 무의미해진다.

- [ ] **Step 1: 실패하는 테스트 추가**

Task 1이 만든 파일의 `describe` 블록 안에 추가한다.

```ts
    it('연속 갱신 주기가 상한을 넘으면 갱신하지 않고 세션을 종료한다', async () => {
        const createCoordinator = await freshFactory();
        const refresh = vi.fn(async () => true);
        const terminateSession = vi.fn(async () => undefined);

        const coordinator = createCoordinator({ refresh, terminateSession });
        /* scope 밖 fallback 경로로 매번 새 주기를 여는 상황 — 사용자가 계속 조작해
           주기가 끝난 뒤 또 401을 받는 순차 폭주를 재현한다. */
        coordinator.bindRetry(async () => undefined);

        for (let i = 0; i < 10; i += 1) {
            await coordinator.onResponseError(401);
        }

        /* 상한 3을 넘긴 시점부터는 더 이상 갱신을 시도하지 않는다 */
        expect(refresh.mock.calls.length).toBeLessThanOrEqual(3);
        expect(terminateSession).toHaveBeenCalled();
    });
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useApiFetchRefreshCoordinator.test.ts -t '연속 갱신 주기가 상한을'
```

Expected: FAIL — `refresh` 호출이 10회로 상한 3을 초과

- [ ] **Step 3: 상한 구현**

`app/composables/api/useApiFetchRefreshCoordinator.ts`의 모듈 상태 선언부(21~22행)를 다음으로 바꾼다.

```ts
/** 한 폭주 구간에서 허용할 최대 연속 갱신 주기 수 (ERR-14) */
const MAX_CONSECUTIVE_CYCLES = 3;
/** 마지막 주기 시작 이후 이 시간이 지나면 폭주가 아니라고 보고 카운터를 초기화한다 */
const CYCLE_BURST_WINDOW_MS = 60_000;

let activeCycle: RefreshCycle | undefined;
const retryConsumers = new Set<RetryConsumer>();
/** 연속 갱신 주기 수 — 401이 아닌 응답이 오거나 폭주 창을 벗어나면 초기화된다 */
let consecutiveCycles = 0;
/** 마지막 주기가 시작된 시각 (epoch ms) */
let lastCycleStartedAt = 0;
```

`onResponseError`의 401 판정부를 다음으로 바꾼다.

```ts
        async onResponseError(status: number): Promise<boolean> {
            if (status !== 401) {
                /* 401이 아닌 응답이 왔다는 것은 서버가 정상 답을 주고 있다는 뜻이므로
                   폭주 카운터를 초기화한다. */
                consecutiveCycles = 0;
                return false;
            }
```

`coordinateUnauthorized`에서 새 주기를 만들기 직전(현재 74행 `const cycle: RefreshCycle = {` 바로 위)에 다음을 넣는다.

```ts
    const now = Date.now();
    if (now - lastCycleStartedAt > CYCLE_BURST_WINDOW_MS) consecutiveCycles = 0;
    lastCycleStartedAt = now;
    consecutiveCycles += 1;
    /* 짧은 시간에 갱신 주기가 반복된다는 것은 갱신이 401을 해결하지 못한다는 뜻이다.
       무한히 재시도하면 백엔드·클라이언트 양쪽에 자원 고갈을 일으키므로 종료한다 (ERR-14). */
    if (consecutiveCycles > MAX_CONSECUTIVE_CYCLES) {
        await terminateSession();
        return;
    }
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useApiFetchRefreshCoordinator.test.ts tests/unit/composables/useApiFetch.direct.test.ts tests/unit/composables/useApiFetch.test.ts
```

Expected: 전부 PASS. 기존 `useApiFetch` 테스트가 깨지면 상한이 정상 흐름을 막고 있는 것이므로 `MAX_CONSECUTIVE_CYCLES`가 아니라 카운터 초기화 조건을 재검토한다.

- [ ] **Step 5: 커밋**

```bash
cd C:/it/it_frontend && git add app/composables/api/useApiFetchRefreshCoordinator.ts tests/unit/composables/useApiFetchRefreshCoordinator.test.ts && git commit -m "fix: 401 갱신 주기에 연속 재시도 상한 도입 (ERR-14)"
```

---

## Task 3: BE-34 — 객체형 쿼리 파라미터 6곳에 `@ParameterObject` 적용

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/controller/ProjectController.java:77`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/controller/FileController.java:71`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java:168`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/controller/BoardPostController.java:37`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/controller/AdminController.java:366,426`

**Interfaces:**
- Consumes: 없음
- Produces: `/v3/api-docs` 응답에서 6개 오퍼레이션의 파라미터명이 실제 이름으로 노출된다. Task 4가 이를 검증하고 `api.d.ts`에 반영한다.

**주의:** 기존 `@ModelAttribute`·`@PageableDefault`는 **제거하지 않는다**. 바인딩 동작을 바꾸지 않는 것이 이 우회의 전제다. `@ParameterObject`는 문서화 전용 애노테이션이다.

- [ ] **Step 1: 브랜치 생성**

```bash
git -C C:/it/it_backend checkout -b feature/be34-openapi-parameter-names
```

- [ ] **Step 2: `ProjectController` 수정**

import 블록에 추가한다(기존 import 정렬 위치에 맞춘다).

```java
import org.springdoc.core.annotations.ParameterObject;
```

77행 부근을 다음으로 바꾼다.

```java
    public ResponseEntity<List<ProjectDto.Response>> getProjects(
            @ParameterObject @ModelAttribute ProjectDto.SearchCondition condition) {
        return ResponseEntity.ok(projectService.searchProjectList(condition));
    }
```

- [ ] **Step 3: `FileController` 수정**

```java
import org.springdoc.core.annotations.ParameterObject;
```

71행 부근을 다음으로 바꾼다.

```java
    public ResponseEntity<List<FileDto.Response>> getFiles(
            @ParameterObject @ModelAttribute FileDto.SearchCondition condition,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(fileService.getFiles(condition, userDetails));
    }
```

- [ ] **Step 4: `CostController` 수정**

```java
import org.springdoc.core.annotations.ParameterObject;
```

168행 부근을 다음으로 바꾼다.

```java
    public ResponseEntity<List<CostDto.Response>> getCostList(
            @ParameterObject @ModelAttribute CostDto.SearchCondition condition) {
        return ResponseEntity.ok(costService.searchCostList(condition));
    }
```

- [ ] **Step 5: `BoardPostController` 수정**

```java
import org.springdoc.core.annotations.ParameterObject;
```

37행 부근을 다음으로 바꾼다.

```java
    public ResponseEntity<Page<BoardPostDto.ListItem>> searchPosts(
            @PathVariable("blbMngNo") String blbMngNo,
            @ParameterObject @ModelAttribute BoardPostDto.SearchCondition cond,
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(boardPostService.searchPosts(blbMngNo, cond, user));
    }
```

- [ ] **Step 6: `AdminController` 수정 (2곳)**

```java
import org.springdoc.core.annotations.ParameterObject;
```

365~367행을 다음으로 바꾼다.

```java
    public ResponseEntity<Page<AdminDto.LoginHistoryResponse>> getLoginHistory(
            @ParameterObject
                    @PageableDefault(size = 50, sort = "lgnDtm", direction = Sort.Direction.DESC)
                    Pageable pageable) {
        return ResponseEntity.ok(adminService.getLoginHistory(pageable));
    }
```

425~427행을 다음으로 바꾼다.

```java
    public ResponseEntity<AdminLogDto.LogPageResponse> getLogs(
            @PathVariable("logKey") String logKey,
            @ParameterObject @PageableDefault(size = 100) Pageable pageable) {
        return ResponseEntity.ok(adminLogService.getLogs(logKey, pageable));
    }
```

- [ ] **Step 7: 포맷 정리**

```bash
cd C:/it/it_backend && ./gradlew spotlessApply
```

Expected: `BUILD SUCCESSFUL`. 위 코드 블록의 줄바꿈이 AOSP 규칙과 다르면 Spotless가 다시 맞춘다 — 그 결과를 받아들인다.

- [ ] **Step 8: 컴파일과 테스트로 바인딩 회귀 확인**

```bash
cd C:/it/it_backend && ./gradlew test
```

Expected: `BUILD SUCCESSFUL`. `ProjectControllerTest`·`FileControllerTest`·`CostControllerTest`·`BoardPostControllerTest`·`AdminControllerTest`가 모두 통과해야 한다. 하나라도 실패하면 `@ParameterObject`가 바인딩에 영향을 준 것이므로 **중단**하고, 해당 파라미터만 `@ParameterObject` 대신 `@Parameter(name = "condition")`로 바꿔 재시도한다.

- [ ] **Step 9: 커밋**

```bash
cd C:/it/it_backend && git add -A && git commit -m "fix: 객체형 쿼리 파라미터 6건에 @ParameterObject 명시 (BE-34)

springdoc 런타임의 파라미터명 discovery 유실로 스펙에 condition·cond·
pageable이 arg0/arg1로 실렸다. 근본 원인(CGLIB 프록시 또는 Spring
Framework 7 discovery)과 무관하게 이름을 고정하는 우회다. 기존
@ModelAttribute·@PageableDefault는 바인딩 동작 보존을 위해 유지한다."
```

---

## Task 4: BE-34 — 스펙 실측 검증과 `api.d.ts` 재생성

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (codegen 생성물 — 수기 편집 금지)

**Interfaces:**
- Consumes: Task 3의 백엔드 변경
- Produces: 갱신된 `api.d.ts`. 이후 태스크는 이 파일에 의존하지 않는다.

**전제:** 로컬 Oracle(`127.0.0.1:11521/XEPDB1`)이 기동돼 있어야 한다. 프론트 dev 서버와 브라우저는 필요하지 않다.

- [ ] **Step 1: 변경 전 스펙 스냅샷 확보**

백엔드를 기동하기 전에, 현재 커밋된 `api.d.ts`에서 대상 파라미터가 `arg0`인지 확인한다.

```bash
cd C:/it/it_frontend && grep -n "arg0\|arg1" app/types/api.d.ts | head -20
```

Expected: 6건 내외의 `arg0`/`arg1` 항목이 보인다. 0건이면 이미 해소된 것이므로 Task 3~4를 중단하고 사용자에게 알린다.

- [ ] **Step 2: 백엔드 기동 (beans 엔드포인트 임시 노출)**

근본 원인 1차 확인을 함께 하기 위해 `beans` 엔드포인트를 **명령행 인자로만** 연다. `application.properties`는 수정하지 않는다.

```bash
cd C:/it/it_backend && ./gradlew bootRun --args='--management.endpoints.web.exposure.include=health,metrics,beans'
```

기동 완료(`Started ItApplication`) 후 다음 단계로 넘어간다. 이 명령은 계속 실행 상태로 둔다.

- [ ] **Step 3: 근본 원인 1차 확인 — 컨트롤러 빈의 CGLIB 프록시 여부**

```bash
curl -s http://localhost:28080/actuator/beans | grep -o '"projectController":{[^}]*"type":"[^"]*"'
```

세 결과 중 하나를 **기록만** 한다(수정은 이번 범위 밖).

- `type`에 `$$SpringCGLIB$$`가 있다 → 프록시화가 원인. TASK.md의 "미확정 가설"이 확정된다.
- `type`이 순수 클래스명이다 → 프록시가 아니다. 원인이 Spring Framework 7 discovery 또는 springdoc 3.0.3 호환으로 좁혀진다.
- 401/403/404가 온다 → SecurityConfig가 actuator를 막고 있거나 엔드포인트가 열리지 않았다. **미확인으로 기록하고 넘어간다.** 이 확인은 부수적이며 Task 4의 성공 조건이 아니다.

- [ ] **Step 4: 스펙 재생성**

```bash
cd C:/it/it_frontend && npm run codegen
```

Expected: 성공하며 `스펙 출처: http://localhost:28080/v3/api-docs (paths 160 / schemas 234)` 형태의 출력이 나온다.

**paths·schemas 수가 160/234와 다르면 중단한다** — 우회가 오퍼레이션 증감을 일으켰다는 뜻이므로 원인을 규명하기 전에 진행하지 않는다.

- [ ] **Step 5: `arg0` 소멸과 diff 국한 확인**

```bash
cd C:/it/it_frontend && grep -c "arg0\|arg1" app/types/api.d.ts; git diff --stat app/types/api.d.ts
```

Expected:
- `grep -c` 결과가 `0`
- diff가 `app/types/api.d.ts` 한 파일에만, 6개 오퍼레이션 주변에만 나타난다

`arg0`이 남아 있으면 `@ParameterObject`가 그 지점에 듣지 않은 것이다. 남은 파라미터를 `@Parameter(name = "...")`로 바꾸고 Task 3 Step 7부터 다시 수행한다.

- [ ] **Step 6: 타입 검사로 소비처 영향 없음 확인**

```bash
cd C:/it/it_frontend && npm run check
```

Expected: 통과. 프론트 소비처가 0건이므로 컴파일 영향이 없어야 한다. 오류가 나면 우회가 의도 밖 변경을 만든 것이므로 중단하고 사용자에게 알린다.

- [ ] **Step 7: 백엔드 종료와 커밋**

Step 2의 `bootRun`을 종료한다(`Ctrl+C`).

```bash
cd C:/it/it_frontend && git add app/types/api.d.ts && git commit -m "chore: 백엔드 파라미터명 수정 반영해 api.d.ts 재생성 (BE-34)"
```

---

## Task 5: FE-21 — `useMentionAutocomplete` 응답 순서 역전 가드

**Files:**
- Modify: `it_frontend/app/composables/useMentionAutocomplete.ts:62,128-156,221-231`
- Test: `it_frontend/tests/unit/composables/useMentionAutocomplete.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (composable의 외부 계약은 그대로다 — `active`·`items`·`selectedIndex`·`query`·`searchLoading`·`searchError`·`onInput`·`onKeyDown`·`selectItem`·`retrySearch`·`close`)

**결함:** `runSearch`가 `await` 뒤 순서 판정 없이 `items.value`에 대입한다(146~148행). 200ms 디바운스가 있어도 느린 첫 요청이 빠른 두 번째 요청보다 늦게 도착하면 낡은 결과가 최신 결과를 덮는다. `searchLoading`·`searchError`도 같은 결함을 갖는다 — 낡은 응답이 로딩을 먼저 끄거나 이미 성공한 검색에 오류 플래그를 세운다.

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/unit/composables/useMentionAutocomplete.test.ts`의 기존 `describe('useMentionAutocomplete', ...)` 블록 **뒤에** 새 `describe`를 추가한다.

기존 파일에 이미 있는 것을 그대로 쓴다: `mockApiFetch`(모듈 상단), `makeTextarea(value)`, `suggestion(eno, usrNm)`, `currentUser`, 그리고 `beforeEach`의 `vi.useFakeTimers()`. 디바운스 진행은 `await vi.advanceTimersByTimeAsync(200)`이다. 새로 추가할 헬퍼는 아래 `deferred` 하나뿐이다.

파일 상단 `makeTextarea` 정의(24~30행) 아래에 추가한다.

```ts
/** 응답 도착 시점을 테스트가 직접 정하기 위한 수동 제어 Promise */
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};
```

파일 끝에 새 `describe`를 추가한다.

```ts
describe('useMentionAutocomplete — 응답 순서 역전 가드 (FE-21)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        mockApiFetch.mockReset();
        currentUser.value = { bbrC: 'D001' };
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('느린 앞 검색이 빠른 뒤 검색의 후보를 덮어쓰지 않는다', async () => {
        // Arrange: 두 검색의 응답 도착 순서를 테스트가 직접 뒤집는다.
        const first = deferred<UserSuggestion[]>();
        const second = deferred<UserSuggestion[]>();
        mockApiFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

        const text = ref('@김');
        const textareaRef = ref<HTMLTextAreaElement | null>(makeTextarea(text.value));
        const composer = useMentionAutocomplete({ text, textareaRef });

        composer.onInput();
        await vi.advanceTimersByTimeAsync(200);

        text.value = '@김철';
        textareaRef.value = makeTextarea(text.value);
        composer.onInput();
        await vi.advanceTimersByTimeAsync(200);

        // Act: 뒤 검색(최신)이 먼저, 앞 검색(낡음)이 나중에 도착한다.
        second.resolve([suggestion('E002', '김철수')]);
        await vi.advanceTimersByTimeAsync(0);
        first.resolve([suggestion('E001', '김영희')]);
        await vi.advanceTimersByTimeAsync(0);

        // Assert: 최신 검색의 결과만 남는다.
        expect(composer.items.value).toHaveLength(1);
        expect(composer.items.value[0]?.eno).toBe('E002');
        expect(composer.searchLoading.value).toBe(false);
    });

    it('낡은 검색의 실패는 최신 검색의 오류 상태를 세우지 않는다', async () => {
        // Arrange: 앞 검색은 실패하고 뒤 검색은 성공한다.
        const first = deferred<UserSuggestion[]>();
        const second = deferred<UserSuggestion[]>();
        mockApiFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

        const text = ref('@김');
        const textareaRef = ref<HTMLTextAreaElement | null>(makeTextarea(text.value));
        const composer = useMentionAutocomplete({ text, textareaRef });

        composer.onInput();
        await vi.advanceTimersByTimeAsync(200);

        text.value = '@김철';
        textareaRef.value = makeTextarea(text.value);
        composer.onInput();
        await vi.advanceTimersByTimeAsync(200);

        // Act: 최신 검색이 성공한 뒤 낡은 검색이 실패한다.
        second.resolve([suggestion('E002', '김철수')]);
        await vi.advanceTimersByTimeAsync(0);
        first.reject(new Error('네트워크 오류'));
        await vi.advanceTimersByTimeAsync(0);

        // Assert: 낡은 실패가 최신 성공을 훼손하지 않는다.
        expect(composer.searchError.value).toBe(false);
        expect(composer.items.value[0]?.eno).toBe('E002');
    });

    it('close() 이후 도착한 응답은 후보를 되살리지 않는다', async () => {
        // Arrange: 검색을 띄운 뒤 응답이 오기 전에 popup을 닫는다.
        const pending = deferred<UserSuggestion[]>();
        mockApiFetch.mockReturnValueOnce(pending.promise);

        const text = ref('@김');
        const textareaRef = ref<HTMLTextAreaElement | null>(makeTextarea(text.value));
        const composer = useMentionAutocomplete({ text, textareaRef });

        composer.onInput();
        await vi.advanceTimersByTimeAsync(200);
        composer.close();

        // Act: 닫힌 뒤에 응답이 도착한다.
        pending.resolve([suggestion('E001', '김영희')]);
        await vi.advanceTimersByTimeAsync(0);

        // Assert: 닫힌 popup의 후보가 되살아나지 않는다.
        expect(composer.items.value).toHaveLength(0);
        expect(composer.active.value).toBe(false);
    });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useMentionAutocomplete.test.ts -t '응답 순서 역전 가드'
```

Expected: 첫 번째 테스트가 FAIL — `items.value[0].eno`가 `'E002'`가 아니라 `'E001'`(낡은 응답이 덮어씀)

- [ ] **Step 3: 시퀀스 토큰 구현**

`app/composables/useMentionAutocomplete.ts`의 62행 부근, `_searchTimer` 선언 아래에 추가한다.

```ts
    /** 응답 순서 역전 가드 — 마지막으로 시작한 검색의 일련번호 (FE-21) */
    let _searchSeq = 0;
```

`runSearch`(128~156행) 전체를 다음으로 바꾼다.

```ts
    /**
     * 검색 API 호출.
     * - query 비어있으면 동일부서(default) 목록
     * - query 있으면 전체 검색 (orgCode 미지정)
     *
     * 응답이 도착했을 때 자신이 최신 요청일 때만 상태를 쓴다. 느린 앞 요청이 빠른 뒤
     * 요청의 결과를 덮어쓰는 순서 역전을 막는다 (FE-21). `items`뿐 아니라
     * `searchLoading`·`searchError`도 같은 판정을 받아야 한다 — 낡은 응답이 로딩을
     * 먼저 끄거나 이미 성공한 검색에 오류 플래그를 세우는 것도 같은 결함이다.
     */
    const runSearch = async (): Promise<void> => {
        const seq = ++_searchSeq;
        searchLoading.value = true;
        searchError.value = false;
        try {
            const keyword = query.value.trim();
            const orgCode = user.value?.bbrC ?? '';
            const params: Record<string, string> = {};
            if (keyword) {
                params.keyword = keyword;
                // 전체 검색: orgCode 미지정
            } else {
                // 동일부서 default: keyword 없이 orgCode만
                if (!orgCode) {
                    if (seq === _searchSeq) items.value = [];
                    return;
                }
                params.orgCode = orgCode;
            }
            const result = await $apiFetch<UserSuggestion[]>(SEARCH_URL, { query: params });
            if (seq !== _searchSeq) return;
            items.value = (result ?? []).slice(0, 8);
            selectedIndex.value = 0;
        } catch (error) {
            if (seq !== _searchSeq) return;
            items.value = [];
            searchError.value = true;
            console.warn('[MentionAutocomplete] 사용자 검색 실패', error);
        } finally {
            if (seq === _searchSeq) searchLoading.value = false;
        }
    };
```

`close`(221~231행)에 시퀀스 무효화를 추가한다. 진행 중인 응답이 닫힌 popup의 후보를 되살리는 것을 막는다.

```ts
    const close = (): void => {
        active.value = false;
        items.value = [];
        selectedIndex.value = 0;
        triggerStart = -1;
        query.value = '';
        /* 진행 중인 검색의 응답이 닫힌 popup의 후보를 되살리지 않도록 무효화한다 (FE-21) */
        _searchSeq += 1;
        if (_searchTimer) {
            clearTimeout(_searchTimer);
            _searchTimer = null;
        }
    };
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useMentionAutocomplete.test.ts tests/unit/components/MentionAutocomplete.test.ts
```

Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
cd C:/it/it_frontend && git add app/composables/useMentionAutocomplete.ts tests/unit/composables/useMentionAutocomplete.test.ts && git commit -m "fix: 멘션 자동완성에 응답 순서 역전 가드 추가 (FE-21, FE-28②)"
```

---

## Task 6: FE-21 — `useGlobalSearch` 응답 순서 역전 가드

**Files:**
- Modify: `it_frontend/app/composables/useGlobalSearch.ts:44-50,80-102`
- Test: `it_frontend/tests/unit/composables/useGlobalSearch.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (`{ suggestions, searchError, searchByName, clearCache }` 계약 유지)

**결함:** `searchByName`은 캐시가 빈 첫 검색에서 `await loadAll()`을 거친다. `GlobalSearchBar.vue:163`이 디바운스 없는 `@input`으로 이 함수를 호출하므로, 캐시가 차기 전에 여러 호출이 겹치면 낡은 키워드의 필터 결과가 최신 결과를 덮는다.

**하지 않는 것:** `GlobalSearchBar.vue`에 디바운스를 추가하지 않는다. 시퀀스 가드를 붙이면 경합이 사라진다. 디바운스는 호출 횟수를 줄이는 별개의 최적화이고 입력 반응성에 영향을 주므로 이 항목에서 결정하지 않는다.

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/unit/composables/useGlobalSearch.test.ts`의 기존 `describe('useGlobalSearch', ...)` 블록 **뒤에** 새 `describe`를 추가한다.

기존 파일에 이미 있는 것을 그대로 쓴다: `mockApiFetch`(모듈 상단, `useNuxtApp` stub에 연결됨), `mockProjects`, `mockCosts`. 이 파일은 fake timer를 쓰지 않는다.

**경합을 결정적으로 재현하는 방법.** `searchByName`은 캐시가 비어 있으면 `loadAll()`을 호출하고, `loadAll()`은 `$apiFetch`를 projects·costs 두 번 부른다. 검색 2회가 캐시가 차기 전에 겹치면 `$apiFetch` 호출이 총 4번 발생한다(1·2번=앞 검색, 3·4번=뒤 검색). 각 호출의 해소 시점을 배열에 모아두고 **뒤 검색(3·4번)을 먼저, 앞 검색(1·2번)을 나중에** 풀어 순서를 뒤집는다.

파일 끝에 새 `describe`를 추가한다.

```ts
describe('useGlobalSearch — 응답 순서 역전 가드 (FE-21)', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
    });

    /**
     * $apiFetch 호출마다 해소 함수를 모아 두고 테스트가 순서를 직접 정하게 한다.
     * @returns 호출 순서대로 쌓이는 해소 함수 배열 (index 0·1 = 앞 검색, 2·3 = 뒤 검색)
     */
    const captureGates = () => {
        const gates: Array<{ resolve: () => void; reject: (e: unknown) => void }> = [];
        mockApiFetch.mockImplementation(
            (url: string) =>
                new Promise((resolve, reject) => {
                    gates.push({
                        resolve: () =>
                            resolve(url.endsWith('/api/projects') ? mockProjects : mockCosts),
                        reject,
                    });
                }),
        );
        return gates;
    };

    it('느린 앞 검색이 빠른 뒤 검색의 결과를 덮어쓰지 않는다', async () => {
        // Arrange: 캐시가 빈 상태에서 검색 2건을 겹쳐 띄운다.
        const gates = captureGates();
        const { suggestions, searchByName } = useGlobalSearch();

        const firstSearch = searchByName({ query: '로그인' });
        const secondSearch = searchByName({ query: '결재' });
        expect(gates).toHaveLength(4);

        // Act: 뒤 검색(최신)을 먼저 풀고, 앞 검색(낡음)을 나중에 푼다.
        gates[2]!.resolve();
        gates[3]!.resolve();
        await secondSearch;
        gates[0]!.resolve();
        gates[1]!.resolve();
        await firstSearch;

        // Assert: 최신 검색어('결재')의 결과만 남는다.
        expect(suggestions.value).toHaveLength(1);
        expect(suggestions.value[0]?.name).toBe('결재 시스템 구축');
    });

    it('낡은 검색의 로딩 실패는 최신 검색의 오류 상태를 세우지 않는다', async () => {
        // Arrange: 앞 검색의 로딩만 실패시킨다.
        const gates = captureGates();
        const { suggestions, searchError, searchByName } = useGlobalSearch();

        const firstSearch = searchByName({ query: '로그인' });
        const secondSearch = searchByName({ query: '결재' });

        // Act: 최신 검색이 성공한 뒤 낡은 검색이 실패한다.
        gates[2]!.resolve();
        gates[3]!.resolve();
        await secondSearch;
        gates[0]!.reject(new Error('네트워크 오류'));
        await firstSearch;

        // Assert: 낡은 실패가 최신 성공을 훼손하지 않는다.
        expect(searchError.value).toBe(false);
        expect(suggestions.value[0]?.name).toBe('결재 시스템 구축');
    });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useGlobalSearch.test.ts -t '응답 순서 역전 가드'
```

Expected: 첫 번째 테스트가 FAIL — 낡은 검색어 `'로그인'`의 결과 2건(`로그인 개선`·`로그인 인프라`)이 최신 결과를 덮어써서 `toHaveLength(1)`이 깨진다

- [ ] **Step 3: 시퀀스 토큰 구현**

`app/composables/useGlobalSearch.ts`의 캐시 선언부(49~50행) 아래에 추가한다.

```ts
    /** 응답 순서 역전 가드 — 마지막으로 시작한 검색의 일련번호 (FE-21) */
    let searchSeq = 0;
```

`searchByName`(80~102행)의 앞부분을 다음으로 바꾼다. 필터링 이후(104행부터)는 그대로 둔다.

```ts
    const searchByName = async (event: { query: string }) => {
        /* 응답이 도착했을 때 자신이 최신 요청일 때만 상태를 쓴다 — 캐시가 빈 첫 검색에서
           여러 호출이 겹치면 낡은 키워드의 결과가 최신 결과를 덮는다 (FE-21) */
        const seq = ++searchSeq;
        const keyword = event.query.trim().toLowerCase();
        if (!keyword) {
            suggestions.value = [];
            return;
        }

        // 정상 검색 흐름 진입 — 이전 실패 상태 초기화
        searchError.value = false;

        // 최초 검색 시 데이터 로딩
        if (!cachedProjects || !cachedCosts) {
            try {
                await loadAll();
            } catch (e) {
                if (seq !== searchSeq) return;
                // 통합검색 데이터 로딩 실패를 빈 검색 결과("결과 없음")와 구분한다.
                // 타입어헤드 특성상 키 입력마다 toast를 띄우지 않고, searchError 인라인 상태로만 표시한다(의도된 설계).
                console.warn('[GlobalSearch] 통합검색 데이터 로딩 실패', e);
                searchError.value = true;
                suggestions.value = [];
                return;
            }
            if (seq !== searchSeq) return;
        }
```

`searchByName`의 JSDoc(71~79행)에 다음 한 줄을 `@remarks` 뒤에 추가한다.

```
     * @remarks 캐시 로드가 필요한 첫 검색에서 호출이 겹치면 최신 호출의 결과만 반영합니다(FE-21).
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useGlobalSearch.test.ts
```

Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
cd C:/it/it_frontend && git add app/composables/useGlobalSearch.ts tests/unit/composables/useGlobalSearch.test.ts && git commit -m "fix: 통합검색에 응답 순서 역전 가드 추가 (FE-21, FE-28②)"
```

---

## Task 7: FE-30① — 대시보드 파사드에 가드 배선용 필드 노출

**Files:**
- Modify: `it_frontend/app/composables/useApprovalDashboard.ts:89-112`
- Modify: `it_frontend/app/composables/useDocumentDashboard.ts:76-103`
- Test: `it_frontend/tests/unit/composables/useApprovalDashboard.direct.test.ts`
- Test: `it_frontend/tests/unit/composables/useDocumentDashboard.direct.test.ts`

**Interfaces:**
- Consumes: `useApiFetch`가 반환하는 `{ data, pending, error, status, refresh, runWithErrorToastSuppressed, enableKeepPreviousData }`
- Produces: 두 파사드가 위 7개 필드를 그대로 노출한다. 소비처(`app/pages/approval/index.vue`, `app/pages/info/documents/index.vue`)가 `useRefreshGuard(파사드반환값, { toast })`를 배선할 수 있게 된다.

**왜 이 필드들인가:** `useRefreshGuard`의 `assertGuardTarget`(`useRefreshGuard.ts:172-179`)이 `refresh`(함수)·`error`(ref)·`status`(ref)를 **모두** 요구하며, 없으면 `TypeError`를 던진다. `enableKeepPreviousData`는 보존을 켜는 데(227행), `runWithErrorToastSuppressed`는 재조회 구간 Toast 억제에 쓰인다. `refresh`만 노출해서는 가드를 만들 수 없다는 것이 FE-30①의 결함이다.

**명시 `key`를 두지 않는 이유:** 두 URL의 소비처가 각각 1곳뿐임을 전수 확인했다(이 문서 "File Structure" 절 참조). 키를 공유하는 소비자가 없으므로 `useBoard`가 필요로 했던 키 분리가 여기서는 불필요하다.

**착수 전 확인:** `TASK.md`는 비노출이 "의도적 판단인지 미확인"으로 적어뒀다. 아래 Step 1에서 확인한다.

- [ ] **Step 1: 비노출이 의도적이었는지 확인**

```bash
cd C:/it/it_frontend && git log --oneline -5 -- app/composables/useApprovalDashboard.ts app/composables/useDocumentDashboard.ts
```

커밋 메시지에 "노출하지 않는다" 또는 "의도적"이라는 근거가 있으면 **중단**하고, 그 사실을 사용자에게 알린 뒤 `TASK.md`에 기록하는 것으로 항목을 닫는다. 그런 근거가 없으면 계속한다(단순 누락으로 판단).

- [ ] **Step 2: 실패하는 테스트 추가 — `useApprovalDashboard`**

`tests/unit/composables/useApprovalDashboard.direct.test.ts`의 `beforeEach`에서 mock 반환값을 가드 계약에 맞게 바꾼다.

```ts
        mockUseApiFetch.mockReturnValue({
            data: ref(null),
            pending: ref(false),
            error: ref(null),
            status: ref('success'),
            refresh: vi.fn(),
            runWithErrorToastSuppressed: vi.fn(),
            enableKeepPreviousData: vi.fn(),
        });
```

기존 `'data, pending, refresh를 반환한다'` 테스트를 다음으로 교체한다.

```ts
    it('useRefreshGuard 배선에 필요한 필드를 모두 노출한다 (FE-30①)', () => {
        const result = useApprovalDashboard();
        /* assertGuardTarget이 refresh·error·status를 모두 요구한다 (useRefreshGuard.ts:172) */
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pending');
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('status');
        expect(typeof result.refresh).toBe('function');
        expect(typeof result.runWithErrorToastSuppressed).toBe('function');
        expect(typeof result.enableKeepPreviousData).toBe('function');
    });
```

- [ ] **Step 3: 실패하는 테스트 추가 — `useDocumentDashboard`**

`tests/unit/composables/useDocumentDashboard.direct.test.ts`에 같은 처리를 한다. `beforeEach`의 mock 반환값을 Step 2와 동일한 7개 필드로 바꾸고, 반환 필드를 단언하는 테스트를 다음으로 교체(없으면 추가)한다.

```ts
    it('useRefreshGuard 배선에 필요한 필드를 모두 노출한다 (FE-30①)', () => {
        const result = useDocumentDashboard();
        expect(result).toHaveProperty('data');
        expect(result).toHaveProperty('pending');
        expect(result).toHaveProperty('error');
        expect(result).toHaveProperty('status');
        expect(typeof result.refresh).toBe('function');
        expect(typeof result.runWithErrorToastSuppressed).toBe('function');
        expect(typeof result.enableKeepPreviousData).toBe('function');
    });
```

- [ ] **Step 4: 테스트 실행 — 실패 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useApprovalDashboard.direct.test.ts tests/unit/composables/useDocumentDashboard.direct.test.ts -t 'useRefreshGuard 배선에'
```

Expected: 둘 다 FAIL — `expect(received).toHaveProperty('error')` 에서 실패

- [ ] **Step 5: `useApprovalDashboard` 구현**

`app/composables/useApprovalDashboard.ts`의 JSDoc(89행)과 본문(103~111행)을 바꾼다.

```ts
 * @returns 대시보드 데이터와 재조회 계약 전부. `useApiFetch` 반환 필드를 그대로 노출하므로
 *   소비자가 이 객체를 **그대로** `useRefreshGuard`에 넘길 수 있다(필드를 재조립하지 않는다).
 *   `refresh`만 노출하던 때는 소비자가 가드를 배선할 방법이 없어 재조회 실패가 조용히
 *   묻혔다 (FE-30①).
 *
 *   **명시 `key`를 두지 않는다.** 이 파사드가 여는 `/api/applications/dashboard`의 소비처는
 *   `app/pages/approval/index.vue` 한 곳뿐이고 사이드바 배지는 별도 엔드포인트
 *   (`/api/applications/badge-count`)를 쓴다. 소비처가 늘어 같은 키를 공유하게 되면
 *   `useBoard`처럼 `key` 옵션으로 화면을 분리한 뒤에만 보존을 켜야 한다 — Nuxt는 같은 키의
 *   최초 인스턴스가 만든 설정만 보관하므로 한쪽이 켠 보존이 다른 쪽까지 샌다.
 *
 * @example
 * const dashboard = useApprovalDashboard();
 * const guard = useRefreshGuard(dashboard, { toast, summary: '대시보드 갱신 실패' });
 */
export const useApprovalDashboard = () => {
    // 인증된 사용자 정보 획득 (bbrC: 부서코드, eno: 사원번호)
    const { user } = useAuth();

    // runtimeConfig에서 API 베이스 URL 조회
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/applications/dashboard`;

    const {
        data,
        pending,
        error,
        status,
        refresh,
        runWithErrorToastSuppressed,
        enableKeepPreviousData,
    } = useApiFetch<ApprovalDashboard>(url, {
        // computed query: user 변경 시 자동으로 쿼리 파라미터 갱신 및 재요청
        query: computed(() => ({
            bbrC: user.value?.bbrC,
            eno: user.value?.eno,
        })),
    });

    return {
        data,
        pending,
        error,
        status,
        refresh,
        runWithErrorToastSuppressed,
        enableKeepPreviousData,
    };
};
```

- [ ] **Step 6: `useDocumentDashboard` 구현**

`app/composables/useDocumentDashboard.ts`의 JSDoc(81~88행)과 본문(98~102행)을 바꾼다.

```ts
 * @returns 대시보드 데이터와 재조회 계약 전부. `useApiFetch` 반환 필드를 그대로 노출하므로
 *   소비자가 이 객체를 **그대로** `useRefreshGuard`에 넘길 수 있다(필드를 재조립하지 않는다).
 *   `refresh`만 노출하던 때는 소비자가 가드를 배선할 방법이 없었다 (FE-30①).
 *
 *   **명시 `key`를 두지 않는다.** 이 파사드가 여는 `/api/documents/dashboard`의 소비처는
 *   `app/pages/info/documents/index.vue` 한 곳뿐이고 사이드바 배지는 별도 엔드포인트
 *   (`/api/documents/badge-count`)를 쓴다. 소비처가 늘면 `useBoard`처럼 `key` 옵션으로
 *   화면을 분리한 뒤에만 보존을 켠다.
 *
 * @example
 * const dashboard = useDocumentDashboard();
 * const guard = useRefreshGuard(dashboard, { toast, summary: '대시보드 갱신 실패' });
 */
export const useDocumentDashboard = () => {
    // 로그인 사용자 정보에서 부서코드(bbrC) 추출
    const { user } = useAuth();
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/documents/dashboard`;

    // useApiFetch 사용 → 인증 쿠키 포함 전송 + 반응형 갱신
    // query를 computed로 감싸 user 변경 시 자동으로 파라미터 업데이트
    const {
        data,
        pending,
        error,
        status,
        refresh,
        runWithErrorToastSuppressed,
        enableKeepPreviousData,
    } = useApiFetch<DocumentDashboard>(url, {
        query: computed(() => ({ bbrC: user.value?.bbrC })),
    });

    return {
        data,
        pending,
        error,
        status,
        refresh,
        runWithErrorToastSuppressed,
        enableKeepPreviousData,
    };
};
```

- [ ] **Step 7: 테스트 실행 — 통과 확인**

```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useApprovalDashboard.direct.test.ts tests/unit/composables/useDocumentDashboard.direct.test.ts tests/unit/composables/useApprovalDashboard.test.ts tests/unit/composables/useDocumentDashboard.test.ts
```

Expected: 전부 PASS. `useApprovalDashboard.test.ts`·`useDocumentDashboard.test.ts`가 실패하면 그 파일들의 `useApiFetch` mock에도 Step 2의 7개 필드를 채운다.

- [ ] **Step 8: 소비처 컴파일 확인**

```bash
cd C:/it/it_frontend && npm run check
```

Expected: 통과. `app/pages/approval/index.vue:25`와 `app/pages/info/documents/index.vue:29`는 `{ data, pending }`만 구조분해하므로 필드가 늘어도 영향이 없다.

- [ ] **Step 9: 커밋**

```bash
cd C:/it/it_frontend && git add app/composables/useApprovalDashboard.ts app/composables/useDocumentDashboard.ts tests/unit/composables/useApprovalDashboard.direct.test.ts tests/unit/composables/useDocumentDashboard.direct.test.ts && git commit -m "fix: 대시보드 파사드에 재조회 가드 배선 필드 노출 (FE-30①)"
```

---

## Task 8: 전체 게이트 통과 확인

**Files:** 없음 (검증 전용)

**Interfaces:**
- Consumes: Task 1~7의 모든 변경
- Produces: 병합 가능 상태 확인

- [ ] **Step 1: 프론트 게이트**

```bash
cd C:/it/it_frontend && npm run format:check && npm run check && npm test
```

Expected: 전부 통과. `format:check`가 실패하면 `npx prettier --write` 대상 파일을 지정해 정리하고 다시 실행한다.

- [ ] **Step 2: codegen 드리프트 확인**

```bash
cd C:/it/it_frontend && npm run codegen:check
```

Expected: 통과. **백엔드가 기동돼 있어야 한다** — Task 4 Step 2의 명령으로 다시 띄운 뒤 실행하고, 끝나면 종료한다.

- [ ] **Step 3: 백엔드 게이트**

```bash
cd C:/it/it_backend && ./gradlew check
```

Expected: `BUILD SUCCESSFUL` (Spotless + 테스트 + JaCoCo 커버리지 검증)

---

## Task 9: 문서 정리와 `versions.lock` 갱신

**Files:**
- Modify: `C:\it\TASK.md`
- Modify: `C:\it\TASK_DONE.md`
- Modify: `C:\it\versions.lock`
- Modify: `docs/superpowers/specs/2026-08-06-task-quickfix-batch1-design.md` (상태 줄)

**Interfaces:**
- Consumes: Task 1~8의 결과
- Produces: 없음 (배치 종료)

- [ ] **Step 1: 두 기능 브랜치 병합**

```bash
git -C C:/it/it_backend checkout main && git -C C:/it/it_backend merge --no-ff feature/be34-openapi-parameter-names -m "Merge branch 'feature/be34-openapi-parameter-names'"
git -C C:/it/it_frontend checkout main && git -C C:/it/it_frontend merge --no-ff feature/task-quickfix-batch1 -m "Merge branch 'feature/task-quickfix-batch1'"
```

백엔드를 먼저 병합한다(4-repo 규약).

- [ ] **Step 2: `TASK.md` 갱신**

다음과 같이 처리한다.

| 항목 | 처리 |
| --- | --- |
| **ERR-14** | 행 삭제 후 `TASK_DONE.md`로 이관. 분기 A였으면 "코디네이터 도입으로 구조적으로 해소됐음을 실측 테스트로 확인했고, `TASK.md` 근거가 낡아 있었다(지목한 `isRefreshing`·`tokenRefreshSignal`이 존재하지 않음)"를, 분기 B였으면 "연속 갱신 주기 상한 3회를 도입했다"를 기록 |
| **BE-34** | 행 삭제 후 `TASK_DONE.md`로 이관. Task 4 Step 3의 CGLIB 확인 결과를 함께 기록한다. **원인이 미확인으로 남으면** 이관하지 말고 우선순위를 🟢 Low로 낮춘 뒤 "우회로 계약 문서 훼손은 해소됐고 근본 원인 규명만 남았다"로 과제 문구를 다시 쓴다 |
| **FE-21** | 행 삭제 후 `TASK_DONE.md`로 이관 |
| **FE-28** | 행을 남기되 ②를 소진 처리. 근거란에서 ② 문장을 "②는 FE-21 조치와 함께 2026-08-06 완료"로 바꾸고 잔여를 ①(`onActivated` 14파일)·③(`scripts/codegen.mjs` 판정 로직 단위 테스트)로 명시 |
| **FE-30** | 행을 남기되 ①을 소진 처리. "**①② 잔여**"를 "**②만 잔여**"로 바꾸고, ① 문장을 "2026-08-06 완료 — 두 파사드가 `useApiFetch` 반환 필드를 그대로 노출한다. 소비처가 각각 1곳뿐이라 명시 `key`는 두지 않았다"로 교체 |

`TASK.md` 하단의 참조 문장(`_ERR-09·ERR-10 완료 근거는 …_`)에 ERR-14·BE-34·FE-21의 이관 위치를 덧붙인다.

- [ ] **Step 3: `TASK_DONE.md`에 이관 기록 추가**

`TASK_DONE.md`의 기존 절 형식을 따라 `## 2026-08-06 잔여과제 저비용 배치 1` 절을 만들고 이관 항목을 옮긴다. 각 항목에 실행 커밋 해시와 계획 문서 경로(`docs/superpowers/plans/2026-08-06-task-quickfix-batch1.md`)를 남긴다.

- [ ] **Step 4: 설계 스펙의 상태 줄 갱신**

`docs/superpowers/specs/2026-08-06-task-quickfix-batch1-design.md`의 8행을 바꾼다.

```markdown
- 상태: 2026-08-06 구현 완료 (실행 SoT: [`plans/2026-08-06-task-quickfix-batch1.md`](../plans/2026-08-06-task-quickfix-batch1.md))
```

- [ ] **Step 5: `versions.lock` 갱신**

```bash
cd C:/it && pwsh -File scripts/update-versions-lock.ps1
```

스크립트가 없거나 실패하면 `powershell -File scripts/update-versions-lock.ps1`로 재시도한다.

- [ ] **Step 6: 커밋**

```bash
cd C:/it && git add TASK.md TASK_DONE.md versions.lock docs/superpowers/specs/2026-08-06-task-quickfix-batch1-design.md && git commit -m "docs: 저비용 배치 1(ERR-14·BE-34·FE-21·FE-30①) 조치 결과 반영"
```

- [ ] **Step 7: 최종 확인**

```bash
git -C C:/it status --short && git -C C:/it/it_backend status --short && git -C C:/it/it_frontend status --short
```

Expected: 세 저장소 모두 clean

---

## 완료 조건

- [ ] Task 1의 판정 결과(분기 A 또는 B)가 기록됐다
- [ ] `npm run check`, `npm test`, `npm run format:check`, `npm run codegen:check` 전부 통과
- [ ] `./gradlew check` 통과
- [ ] `app/types/api.d.ts`에 `arg0`/`arg1`이 0건
- [ ] `TASK.md`에서 ERR-14·FE-21이 사라지고, FE-28·FE-30의 잔여가 정확히 서술됐다
- [ ] `versions.lock`이 병합 후 커밋으로 갱신됐다
