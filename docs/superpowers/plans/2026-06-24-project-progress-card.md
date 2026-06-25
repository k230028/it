# [사업 진행 현황] 단계별 카드 (BPROJA 기반) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보화사업 상세 화면의 "사업 진행 현황" 섹션을 단일 대표코드 선형 타임라인에서, 단계별 BPROJA 상태 독립 표시(완료 `V` / 진행중 `...` / 미실시 `-`)로 교체한다.

**Architecture:** 백엔드는 상세 응답(`ProjectDto.Response`)에 해당 사업의 활성 BPROJA `IT_PTL_STS_TC` 코드 목록(`bprojaStsCodes`)을 추가하고(이미 조회 중인 BPROJA 결과 재사용), 프론트는 `IT_PTL_STS_TIMELINE`(10단계×코드대역)을 단계 정의로 재사용해 각 단계를 `getStageProgress`(순수 함수)로 완료/진행중/미실시 판정한다. `ProjectProgressSection`은 코드 목록만 prop으로 받아 표시한다. 선행으로 2차-A의 예산편성 코드 오류(`21`→`03`)를 정정한다.

**Tech Stack:** Spring Boot 4 / JPA(it_backend), Nuxt 4 / Vue 3 / TypeScript / Vitest(it_frontend). 대상: 중첩 git repo `C:\it\it_backend`·`C:\it\it_frontend`(각 main), 문서는 top-level `C:\it`.

---

## 선행 사실 / 제약

- **판정 규칙**: 단계 대역 내 BPROJA 코드 중 `*9`(완료코드) 존재 → 완료; 대역 내 코드는 있으나 `*9` 없음 → 진행중; 대역 내 코드 없음 → 미실시.
- **검증**: 백엔드 `cd it_backend && ./gradlew compileJava -q`(test worker JVM이 깨져 있어 컴파일 게이트). 프론트 `cd it_frontend && npm run check`(typecheck+lint, 기준 오류 0) + `npm test`(vitest, `getStageProgress` 단위).
- **확인된 코드 위치**(근사, 내용으로 특정):
  - `it_backend`: `ProjectService.getProject` 약 194~205행에 이미 `bprojaRepository.findByAbusMngNoAndDelYn(prjMngNo,"N")` 호출. `BudgetWorkService` 약 322행 `bprojaSyncService.upsert(item.orcPkVl(), bbugtm.getBgNo(), "21")`.
  - `it_frontend`: `utils/common.ts` `IT_PTL_STS_TIMELINE` 정의(요구사항 구체화 `['23','24']`), `components/projects/ProjectProgressSection.vue`(단일코드 타임라인), `pages/info/projects/[id].vue:471` `<ProjectProgressSection :status-code="project.stsTc" :status-label="statusLabel" />`, `composables/useProjects.ts`의 `ProjectDetail extends Project`(약 95행).

## File Structure

- **백엔드(it_backend)**:
  - `domain/budget/work/service/BudgetWorkService.java` — 예산편성 코드 `21`→`03` 정정.
  - `domain/budget/project/dto/ProjectDto.java` — `Response.bprojaStsCodes` 필드 추가.
  - `domain/budget/project/service/ProjectService.java` — `getProject`에서 BPROJA 코드 목록 주입.
- **프론트(it_frontend)**:
  - `app/utils/common.ts` — 요구사항 구체화 대역 `28/29` + `getStageProgress` 헬퍼.
  - `tests/unit/utils/common.test.ts` — `getStageProgress` 단위 테스트.
  - `app/components/projects/ProjectProgressSection.vue` — 단계별 V/.../- 표시로 교체.
  - `app/pages/info/projects/[id].vue` — prop 교체 + 미사용 코드 정리.
  - `app/composables/useProjects.ts` — `ProjectDetail.bprojaStsCodes?: string[]` 추가.
- **문서(top-level)**: 2차 spec §2·2차-A 계획 코드 정정.

---

### Task 1: 2차-A 예산편성 코드 정정 (21 → 03)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`

- [ ] **Step 1: upsert 코드 수정**

`applyItemRates`의 BPROJM 분기에서 아래 줄(약 322행)을 찾아:

```java
                    bprojaSyncService.upsert(item.orcPkVl(), bbugtm.getBgNo(), "21"); // 예산편성 진행중
```

`"21"` → `"03"`으로 수정:

```java
                    bprojaSyncService.upsert(item.orcPkVl(), bbugtm.getBgNo(), "03"); // 예산편성 작업 진행중
```

> 근거: 통합 IT_PTL_STS_TC 코드표에서 예산편성=01~09(작업 진행중 `03`, 완료 `09`), `21`은 사전협의 코드.

- [ ] **Step 2: 컴파일 검증**

Run: `cd C:/it/it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java && git commit -m "fix(backend): 예산편성 BPROJA 상태코드 21→03 정정(21은 사전협의)"
```

---

### Task 2: 백엔드 — `bprojaStsCodes` 응답 필드 + getProject 주입

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`

- [ ] **Step 1: `ProjectDto.Response`에 필드 추가**

`Response` 클래스의 `stsTc` 필드(약 572행) 인근에 추가(다른 필드와 동일한 Lombok/@Schema 스타일):

```java
        /** 해당 사업의 활성 BPROJA 단계 상태코드 목록(IT_PTL_STS_TC) */
        @Schema(description = "해당 사업의 활성 BPROJA 단계 상태코드 목록(IT_PTL_STS_TC)")
        private java.util.List<String> bprojaStsCodes;
```

> `Response`는 Lombok setter를 보유하므로(`setStsTc` 사용 중) `setBprojaStsCodes`가 자동 생성된다. `fromEntity` 빌더는 손대지 않는다(서비스에서 주입).

- [ ] **Step 2: `ProjectService.getProject`에서 BPROJA 코드 목록 주입**

`getProject(...)`의 기존 대표상태 주입부(약 203~205행):

```java
        // 프로젝트 대표상태(BPROJA 중 IT_PTL_STS_TC 최댓값) 주입. 1차에서는 BPROJA 미적재라 null일 수 있음.
        response.setStsTc(representativeStatus(
                bprojaRepository.findByAbusMngNoAndDelYn(prjMngNo, "N")));
```

를 아래로 교체(조회 1회 재사용 + 코드 목록 주입):

```java
        // BPROJA 단계 상태 조회(1회). 대표상태(MAX)와 단계별 코드 목록에 함께 사용.
        java.util.List<com.kdb.it.domain.budget.project.entity.Bproja> bprojaRows =
                bprojaRepository.findByAbusMngNoAndDelYn(prjMngNo, "N");
        // 프로젝트 대표상태(BPROJA 중 IT_PTL_STS_TC 최댓값). BPROJA 미적재면 null.
        response.setStsTc(representativeStatus(bprojaRows));
        // 단계별 카드용: 활성 BPROJA 상태코드 목록(진행 현황 섹션이 대역별로 판정).
        response.setBprojaStsCodes(bprojaRows.stream()
                .map(com.kdb.it.domain.budget.project.entity.Bproja::getStsTc)
                .filter(java.util.Objects::nonNull)
                .toList());
```

> `representativeStatus(List<Bproja>)`는 1차에서 추가된 기존 헬퍼. 시그니처 변경 없음.

- [ ] **Step 3: 컴파일 검증**

Run: `cd C:/it/it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java && git commit -m "feat(backend): 사업 상세 응답에 BPROJA 단계 상태코드 목록(bprojaStsCodes) 추가"
```

---

### Task 3: 프론트 유틸 — 대역 수정 + `getStageProgress` (TDD)

**Files:**
- Modify: `it_frontend/app/utils/common.ts`
- Test: `it_frontend/tests/unit/utils/common.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`it_frontend/tests/unit/utils/common.test.ts`에 추가(파일 없으면 신설; import 경로는 프로젝트 alias `~/utils/common` 또는 상대경로 `../../../app/utils/common` 중 기존 테스트 관례를 따른다):

```ts
import { describe, it, expect } from 'vitest';
import { getStageProgress } from '~/utils/common';

describe('getStageProgress', () => {
    const band = ['01', '02', '03', '09']; // 예산편성 대역

    it('대역 내 코드가 없으면 미실시', () => {
        expect(getStageProgress([], band)).toBe('미실시');
        expect(getStageProgress(['41', '51'], band)).toBe('미실시');
    });

    it('대역 내 *9 완료코드가 있으면 완료', () => {
        expect(getStageProgress(['09'], band)).toBe('완료');
        expect(getStageProgress(['03', '09'], band)).toBe('완료'); // 혼재 시 *9 우선
    });

    it('대역 내 코드가 있으나 *9가 없으면 진행중', () => {
        expect(getStageProgress(['03'], band)).toBe('진행중');
        expect(getStageProgress(['01', '02'], band)).toBe('진행중');
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/utils/common.test.ts`
Expected: FAIL — `getStageProgress`가 export되지 않아 import 오류/정의 없음.

- [ ] **Step 3: `common.ts` 구현**

(a) `IT_PTL_STS_TIMELINE`에서 요구사항 구체화 대역 수정(약 289행):

```ts
    { label: '요구사항 구체화', codes: ['28', '29'] },
```

(b) 파일에 헬퍼 추가(`IT_PTL_STS_TIMELINE`/`getProjectTimelineIndex` 인근):

```ts
/** 단계 진행 상태 (사업 진행 현황 카드용) */
export type StageProgress = '완료' | '진행중' | '미실시';

/**
 * 단계 코드대역과 활성 BPROJA 코드 집합으로 단계 진행상태를 판정합니다.
 * - 대역 내 코드 없음 → 미실시
 * - 대역 내 *9(완료코드) 존재 → 완료
 * - 대역 내 코드 있으나 *9 없음 → 진행중
 * @param codes 해당 사업의 활성 BPROJA IT_PTL_STS_TC 코드 목록
 * @param stageCodes 단계 코드대역 (IT_PTL_STS_TIMELINE 항목의 codes)
 */
export const getStageProgress = (codes: string[], stageCodes: string[]): StageProgress => {
    const inBand = codes.filter((c) => stageCodes.includes(c));
    if (inBand.length === 0) return '미실시';
    return inBand.some((c) => c.endsWith('9')) ? '완료' : '진행중';
};
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/utils/common.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd C:/it/it_frontend && git add app/utils/common.ts tests/unit/utils/common.test.ts && git commit -m "feat(frontend): getStageProgress 단계 판정 헬퍼 + 요구사항구체화 대역 28/29 정정"
```

---

### Task 4: `ProjectProgressSection.vue` 단계별 표시로 교체

**Files:**
- Modify: `it_frontend/app/components/projects/ProjectProgressSection.vue`

- [ ] **Step 1: 컴포넌트 전체 교체**

파일 전체를 아래로 교체:

```vue
<!--
정보화사업 상세 화면의 진행 현황 섹션입니다.
각 단계의 BPROJA 상태코드를 기준으로 완료/진행중/미실시를 독립 표시합니다(비선형 허용).
-->
<script setup lang="ts">
import { IT_PTL_STS_TIMELINE, getStageProgress } from '~/utils/common';

const props = defineProps<{
    /** 해당 사업의 활성 BPROJA 상태코드 목록(IT_PTL_STS_TC). 단계별 판정에 사용 */
    statusCodes?: string[];
}>();

/** 각 단계의 진행 상태(완료/진행중/미실시)를 계산 */
const stageStates = computed(() =>
    IT_PTL_STS_TIMELINE.map((stage) => ({
        label: stage.label,
        progress: getStageProgress(props.statusCodes ?? [], stage.codes),
    })),
);
</script>

<template>
    <section
        id="section-progress"
        class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-visible"
    >
        <div class="flex items-center justify-between mb-8">
            <h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <i class="pi pi-step-forward-alt text-indigo-500" />
                사업 진행 현황
            </h3>
        </div>

        <div class="flex items-start justify-between w-full gap-1">
            <div
                v-for="(stage, index) in stageStates"
                :key="index"
                class="relative flex flex-col items-center flex-1 group"
            >
                <!-- 단계 상태 아이콘 원 -->
                <div
                    class="w-10 h-10 rounded-full flex items-center justify-center border-2 relative z-10 mb-3 shrink-0 transition-all duration-300"
                    :class="
                        stage.progress === '완료'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : stage.progress === '진행중'
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:border-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                              : 'border-zinc-200 bg-white text-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-600'
                    "
                >
                    <!-- 완료: 체크 -->
                    <i v-if="stage.progress === '완료'" class="pi pi-check text-lg font-bold" />
                    <!-- 진행중: 점 3개 애니메이션 -->
                    <span v-else-if="stage.progress === '진행중'" class="flex gap-0.5">
                        <span class="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 0ms" />
                        <span class="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 150ms" />
                        <span class="w-1 h-1 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 300ms" />
                    </span>
                    <!-- 미실시: 대시 -->
                    <i v-else class="pi pi-minus text-base" />
                </div>

                <!-- 단계 라벨 -->
                <div class="h-10 flex items-start justify-center w-full">
                    <span
                        class="text-10 sm:text-xs font-medium text-center break-keep leading-tight px-0.5 w-full transition-colors duration-300"
                        :class="
                            stage.progress === '완료'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : stage.progress === '진행중'
                                  ? 'text-indigo-700 dark:text-indigo-400 font-bold'
                                  : 'text-zinc-300 dark:text-zinc-600'
                        "
                    >
                        {{ stage.label }}
                    </span>
                </div>
            </div>
        </div>
    </section>
</template>
```

> `computed`는 Nuxt 자동 import. `text-10` 등 기존 유틸 클래스는 프로젝트에 존재(기존 컴포넌트에서 사용 중). 디자인 토큰 규칙(§4.9)상 hex 직접 사용 금지 — 위는 Tailwind 색 토큰만 사용.

- [ ] **Step 2: 정적 점검**

Run: `cd C:/it/it_frontend && npm run check`
Expected: 오류 0 (이 파일 기준 신규 오류 없음). 기존 무관 경고는 무시.

- [ ] **Step 3: 커밋**

```bash
cd C:/it/it_frontend && git add app/components/projects/ProjectProgressSection.vue && git commit -m "feat(frontend): 사업 진행 현황 섹션을 단계별 BPROJA 상태(완료/진행중/미실시)로 교체"
```

---

### Task 5: `[id].vue` prop 교체 + 타입 추가 + 미사용 정리

**Files:**
- Modify: `it_frontend/app/composables/useProjects.ts`
- Modify: `it_frontend/app/pages/info/projects/[id].vue`

- [ ] **Step 1: 상세 타입에 필드 추가**

`useProjects.ts`의 `ProjectDetail`(약 95행, `extends Project`) 본문에 추가:

```ts
    bprojaStsCodes?: string[]; // 활성 BPROJA 단계 상태코드 목록(IT_PTL_STS_TC) — 진행 현황 카드용
```

- [ ] **Step 2: `[id].vue`에서 prop 교체**

`<ProjectProgressSection :status-code="project.stsTc" :status-label="statusLabel" />`(약 471행)을 교체:

```vue
                <ProjectProgressSection :status-codes="project.bprojaStsCodes ?? []" />
```

- [ ] **Step 3: 미사용 코드 정리**

위 교체로 `statusLabel`(약 39행 `const statusLabel = computed(() => getStatusName(project.value?.stsTc));`)이 더 이상 쓰이지 않으면 그 줄과, 그로 인해 미사용이 되는 `getStatusName`(약 29행 `const { getCodeName: getStatusName } = useCodeOptions('IT_PTL_STS_TC');`)을 제거한다.

> 주의: `getStatusName`/`statusLabel`이 파일 내 다른 곳에서도 쓰이면 제거하지 말 것. 먼저 파일에서 `statusLabel`·`getStatusName` 사용처를 grep으로 확인하고, 진행현황 섹션 외 사용이 없을 때만 제거한다. 헤더의 상태 태그(약 429행)는 `getProjectStatusTagClass(project.stsTc)`를 쓰며 이와 무관하므로 그대로 둔다.

- [ ] **Step 4: 정적 점검 + 단위 테스트**

Run: `cd C:/it/it_frontend && npm run check`
Expected: 오류 0, 신규 경고 0(미사용 변수 경고가 없어야 함 — Step 3로 정리됨).

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/utils/common.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
cd C:/it/it_frontend && git add app/composables/useProjects.ts app/pages/info/projects/[id].vue && git commit -m "feat(frontend): 상세 진행 현황을 BPROJA 단계 코드로 연결(prop 교체)"
```

---

### Task 6: 문서 정정 (2차 spec 대역표 + 2차-A 계획)

**Files:**
- Modify: `docs/superpowers/specs/2026-06-24-bproja-stage-sync-design.md`
- Modify: `docs/superpowers/plans/2026-06-24-bproja-stage-sync.md`

- [ ] **Step 1: 2차 spec §2 대역표 정정**

`docs/superpowers/specs/2026-06-24-bproja-stage-sync-design.md`의 §2 코드대역 표에서 뒤바뀐 행을 바로잡는다:
- `01–09`는 **예산편성**(기존 "사전협의"로 오기) — 수정.
- `21–22`는 **사전협의**(기존 "예산편성"으로 오기) — 수정.
- 요구사항 구체화 대역을 `23–24`가 아니라 `28–29`로 표기.
그리고 §4.3(예산편성)의 "생성 시 고정 21" 언급을 "03(작업 진행중)"으로 정정.

- [ ] **Step 2: 2차-A 계획 코드 표기 정정**

`docs/superpowers/plans/2026-06-24-bproja-stage-sync.md`의 Task 6(예산편성) 코드 `"21"` 표기를 `"03"`으로 정정하고, 상단 Architecture/요약의 "예산편성 21" 언급도 "예산편성 03"으로 수정한다.

- [ ] **Step 3: 커밋**

```bash
cd C:/it && git add docs/superpowers/specs/2026-06-24-bproja-stage-sync-design.md docs/superpowers/plans/2026-06-24-bproja-stage-sync.md && git commit -m "docs: 2차 BPROJA 코드대역표 정정(예산편성 01-09/03, 사전협의 21-22)"
```

---

### Task 7: 최종 검증

- [ ] **Step 1: 백엔드 컴파일** — `cd C:/it/it_backend && ./gradlew compileJava -q` → BUILD SUCCESSFUL
- [ ] **Step 2: 프론트 정적 점검** — `cd C:/it/it_frontend && npm run check` → 오류 0
- [ ] **Step 3: 프론트 단위 테스트** — `cd C:/it/it_frontend && npm test` → `getStageProgress` 통과(전체 스위트 통과)
- [ ] **Step 4: (선택) 로컬 구동 확인** — 상세 화면에서 진행 현황 섹션이 단계별 V/.../-로 렌더되고, 예산편성 단계가 BPROJA `03/09`에 반응하는지 확인.

---

## Self-Review

- **Spec 커버리지**: 판정 규칙(§2)=Task 3 헬퍼/Task 4 표시 ✓; 백엔드 `bprojaStsCodes`(§3)=Task 2 ✓; 요구사항 28/29(§2)=Task 3 ✓; 컴포넌트 교체(§4)=Task 4 ✓; `[id].vue` prop·타입(§4)=Task 5 ✓; 2차-A 21→03 + 문서 정정(§5)=Task 1·Task 6 ✓; 테스트(§7)=Task 3 단위 ✓.
- **Placeholder 스캔**: 모든 코드 스텝에 실제 코드 포함. import 경로/미사용 정리는 "grep으로 확인 후" 구체 지시(placeholder 아님).
- **타입 일관성**: 백엔드 `bprojaStsCodes`(List<String>)↔프론트 `bprojaStsCodes?: string[]`↔컴포넌트 prop `statusCodes?: string[]` 일치. `getStageProgress(codes, stageCodes)` 시그니처는 Task 3 정의 → Task 4 사용 일치. `IT_PTL_STS_TIMELINE` 항목 형태 `{label, codes}`는 기존 정의와 일치.
- **위험**: (1) `[id].vue` 미사용 변수 정리 — Step 3에서 grep 선확인 지시. (2) vitest import alias(`~/utils/common`) — 기존 테스트 관례 확인 지시. (3) test worker 이슈로 백엔드는 compileJava.
