# Employee Search Breadcrumb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직원 검색 다이얼로그에서 최상위 조직 자체를 선택한 경우에만 level 1을 표시하고, 하위 조직의 브레드크럼에서는 level 1을 제외한다.

**Architecture:** 전체 조직 경로 상태 `selectedPath`는 유지하고 렌더링 전용 computed `breadcrumbPath`를 추가한다. 브레드크럼 항목과 구분자 및 현재 항목 강조만 이 계산값을 사용하므로 조직 선택과 직원 조회 로직은 영향을 받지 않는다.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils

## Global Constraints

- 최상위 level 1 조직 자체를 선택한 경우에는 해당 조직을 표시한다.
- level 2 이하 조직을 선택한 경우에는 경로 첫 항목을 제외한다.
- 조직명 문자열을 비교하지 않고 경로 길이로 판단한다.
- 신규 주석은 한글로 작성한다.
- 사용자의 기존 미커밋 변경을 수정하거나 되돌리지 않는다.

---

### Task 1: 브레드크럼 표시 경로 분리

**Files:**
- Modify: `it_frontend/app/components/common/EmployeeSearchDialog.vue:73-74,365-373`
- Modify: `it_frontend/tests/unit/components/EmployeeSearchDialog.test.ts`

**Interfaces:**
- Consumes: `selectedPath: Ref<string[]>`
- Produces: `breadcrumbPath: ComputedRef<string[]>`

- [ ] **Step 1: 최상위 조직 자체 선택 표시 테스트 작성**

```ts
const wrapper = await mountDialog();
const crumbs = wrapper.get('.esd-crumbs');
expect(crumbs.text()).toContain('한국산업은행');
expect(crumbs.findAll('.pi-angle-right')).toHaveLength(0);
```

- [ ] **Step 2: 하위 조직 선택 시 level 1 제외 실패 테스트 작성**

```ts
await wrapper.get('tbody tr').trigger('click');
await nextTick();
const crumbs = wrapper.get('.esd-crumbs');
expect(crumbs.text()).not.toContain('한국산업은행');
expect(crumbs.text()).toContain('전무이사');
expect(crumbs.text()).toContain('하위부서');
expect(crumbs.find('.here').text()).toBe('하위부서');
```

- [ ] **Step 3: 컴포넌트 테스트를 실행해 하위 경로 테스트 실패 확인**

Run: `npm test -- tests/unit/components/EmployeeSearchDialog.test.ts`
Expected: FAIL because 현재 템플릿이 `selectedPath` 전체를 렌더링하여 `한국산업은행`이 보인다.

- [ ] **Step 4: 표시 전용 경로 computed 구현**

```ts
const breadcrumbPath = computed(() =>
    selectedPath.value.length > 1 ? selectedPath.value.slice(1) : selectedPath.value,
);
```

- [ ] **Step 5: 브레드크럼 렌더링을 표시 경로에 연결**

```vue
<template v-if="breadcrumbPath.length">
    <template v-for="(seg, idx) in breadcrumbPath" :key="idx">
        <i v-if="idx > 0" class="pi pi-angle-right" />
        <span :class="{ here: idx === breadcrumbPath.length - 1 }">{{ seg }}</span>
    </template>
</template>
```

- [ ] **Step 6: 컴포넌트 테스트 통과 확인**

Run: `npm test -- tests/unit/components/EmployeeSearchDialog.test.ts`
Expected: PASS with root-only and child-path breadcrumb cases green.

- [ ] **Step 7: 변경 단위 커밋**

```powershell
git add -- app/components/common/EmployeeSearchDialog.vue tests/unit/components/EmployeeSearchDialog.test.ts
git commit -m "fix: 직원 검색 브레드크럼 최상위 조직 생략"
```

### Task 2: 변경 범위 검증

**Files:**
- Verify: `it_frontend/app/components/common/EmployeeSearchDialog.vue`
- Verify: `it_frontend/tests/unit/components/EmployeeSearchDialog.test.ts`

**Interfaces:**
- Consumes: Task 1의 전체 변경
- Produces: 완료 조건을 입증하는 테스트와 정적 검사 결과

- [ ] **Step 1: 관련 컴포넌트 테스트 실행**

Run: `npm test -- tests/unit/components/EmployeeSearchDialog.test.ts`
Expected: PASS with zero failed tests.

- [ ] **Step 2: 타입 검사와 ESLint 실행**

Run: `npm run check`
Expected: exit code 0 with no type or lint errors.

- [ ] **Step 3: CSS 정적 검사 실행**

Run: `npm run lint:css -- app/components/common/EmployeeSearchDialog.vue`
Expected: exit code 0 with no Stylelint errors.

- [ ] **Step 4: 변경 파일 포맷 검사 실행**

Run: `npx prettier --check app/components/common/EmployeeSearchDialog.vue tests/unit/components/EmployeeSearchDialog.test.ts`
Expected: exit code 0 with both files formatted.

- [ ] **Step 5: 전체 단위 테스트 실행**

Run: `npm test`
Expected: exit code 0 with zero failed tests.
