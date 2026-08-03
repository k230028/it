# Employee Search Organization Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직원 단일 클릭 시 좌측 조직 트리를 소속 조직으로 이동하고, 하위 조직 아이콘과 무제한 깊이 들여쓰기를 일관되게 표시한다.

**Architecture:** 조직 트리의 탐색·아이콘·들여쓰기 계산을 `employeeSearchTree.ts` 순수 유틸리티로 분리한다. `EmployeeSearchDialog.vue`는 직원 선택 상태, 트리 선택 상태, 렌더링 후 스크롤만 조정하며 기존 부서별 직원 조회와 확정 흐름은 유지한다.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils, PrimeIcons, scoped CSS

## Global Constraints

- 신규 주석은 한글로 작성한다.
- 직원 단일 클릭은 확정 이벤트를 발생시키지 않는다.
- 더블클릭과 `[선택]` 버튼의 기존 확정 동작을 유지한다.
- API와 백엔드는 변경하지 않는다.
- 사용자의 기존 미커밋 변경을 수정하거나 되돌리지 않는다.

---

### Task 1: 조직 트리 표시 및 탐색 유틸리티

**Files:**
- Create: `it_frontend/app/utils/employeeSearchTree.ts`
- Create: `it_frontend/tests/unit/utils/employeeSearchTree.test.ts`

**Interfaces:**
- Consumes: `OrgTreeNode` from `~/composables/useOrganization`
- Produces: `findOrgTreeSelection(nodes, key): OrgTreeSelection | null`, `getOrgNodeIcon(depth, hasChildren): string`, `getOrgNodeIndent(depth): string`

- [ ] **Step 1: 조직 경로와 상위 키를 찾는 실패 테스트 작성**

```ts
expect(findOrgTreeSelection(nodes, 'L5')).toEqual({
    node: { key: 'L5', label: '하위부서', depth: 4, hasChildren: false },
    path: ['한국산업은행', '전무이사', '기획관리부문', 'KDB미래전략연구소', '하위부서'],
    ancestorKeys: ['ROOT', 'EXEC', 'PLAN', 'LAB'],
});
expect(findOrgTreeSelection(nodes, 'UNKNOWN')).toBeNull();
```

- [ ] **Step 2: 테스트를 실행해 함수 미구현으로 실패하는지 확인**

Run: `npm test -- tests/unit/utils/employeeSearchTree.test.ts`
Expected: FAIL because `employeeSearchTree` 또는 내보낸 함수가 존재하지 않는다.

- [ ] **Step 3: 재귀 탐색의 최소 구현 작성**

```ts
export interface EmployeeSearchFlatNode {
    key: string;
    label: string;
    depth: number;
    hasChildren: boolean;
}

export interface OrgTreeSelection {
    node: EmployeeSearchFlatNode;
    path: string[];
    ancestorKeys: string[];
}

export const findOrgTreeSelection = (
    nodes: OrgTreeNode[],
    key: string,
    depth = 0,
    path: string[] = [],
    ancestorKeys: string[] = [],
): OrgTreeSelection | null => {
    for (const node of nodes) {
        const hasChildren = node.children.length > 0;
        const nextPath = [...path, node.label];
        if (node.key === key) {
            return {
                node: { key: node.key, label: node.label, depth, hasChildren },
                path: nextPath,
                ancestorKeys,
            };
        }
        const found = findOrgTreeSelection(
            node.children,
            key,
            depth + 1,
            nextPath,
            [...ancestorKeys, node.key],
        );
        if (found) return found;
    }
    return null;
};
```

- [ ] **Step 4: 아이콘과 5단계 이상 들여쓰기 실패 테스트 작성**

```ts
expect(getOrgNodeIcon(0, true)).toBe('pi pi-building');
expect(getOrgNodeIcon(1, true)).toBe('pi pi-sitemap');
expect(getOrgNodeIcon(5, true)).toBe('pi pi-sitemap');
expect(getOrgNodeIcon(5, false)).toBe('pi pi-users');
expect(getOrgNodeIndent(0)).toBe('10px');
expect(getOrgNodeIndent(5)).toBe('70px');
```

- [ ] **Step 5: 테스트를 실행해 표시 함수 미구현으로 실패하는지 확인**

Run: `npm test -- tests/unit/utils/employeeSearchTree.test.ts`
Expected: FAIL because `getOrgNodeIcon`과 `getOrgNodeIndent`가 존재하지 않는다.

- [ ] **Step 6: 아이콘과 들여쓰기의 최소 구현 작성**

```ts
export const getOrgNodeIcon = (depth: number, hasChildren: boolean): string => {
    if (depth === 0) return 'pi pi-building';
    return hasChildren ? 'pi pi-sitemap' : 'pi pi-users';
};

export const getOrgNodeIndent = (depth: number): string => `${10 + Math.max(0, depth) * 12}px`;
```

- [ ] **Step 7: 유틸리티 테스트 전체 통과 확인**

Run: `npm test -- tests/unit/utils/employeeSearchTree.test.ts`
Expected: PASS with all tree lookup, icon, and indentation cases green.

### Task 2: 직원 클릭과 조직 트리 동기화

**Files:**
- Modify: `it_frontend/app/composables/useOrganization.ts`
- Modify: `it_frontend/app/components/common/EmployeeSearchDialog.vue`
- Create: `it_frontend/tests/unit/components/EmployeeSearchDialog.test.ts`

**Interfaces:**
- Consumes: `findOrgTreeSelection`, `getOrgNodeIcon`, `getOrgNodeIndent` from Task 1 and `OrgUser.bbrC`
- Produces: 직원 단일 클릭 시 `selectedKey`, `selectedPath`, `expandedSet`, DOM 스크롤을 동기화하는 다이얼로그 동작

- [ ] **Step 1: 직원 단일 클릭 동기화 실패 테스트 작성**

조직 API는 5단계 트리를, 사용자 API는 현재 목록과 다른 `bbrC`를 가진 직원을 반환하도록 스텁한다. 다이얼로그를 열고 직원 행을 클릭한 뒤 다음 사용자 관찰 가능 상태를 검증한다.

```ts
expect(wrapper.get('[data-org-key="L5"]').classes()).toContain('sel');
expect(wrapper.get('[data-org-key="L5"]').attributes('style')).toContain('padding-left: 70px');
expect(wrapper.findAll('tbody tr.sel')).toHaveLength(1);
expect(wrapper.emitted('select')).toBeUndefined();
```

- [ ] **Step 2: 테스트를 실행해 조직 선택이 이동하지 않아 실패하는지 확인**

Run: `npm test -- tests/unit/components/EmployeeSearchDialog.test.ts`
Expected: FAIL because 직원 클릭 후 소속 조직 노드가 선택되지 않는다.

- [ ] **Step 3: `OrgUser` 응답 타입에 소속 부점 코드 추가**

```ts
export interface OrgUser {
    bbrC: string;
    bbrNm: string;
    // 기존 필드 유지
}
```

- [ ] **Step 4: 직원 클릭 시 트리 상태와 스크롤을 동기화**

`onRowClick`에서 먼저 직원을 하이라이트한 뒤 `findOrgTreeSelection(nodes.value, user.bbrC)` 결과가 있으면 검색 필터를 비우고 상위 키를 `expandedSet`에 합치며 `selectedKey`와 `selectedPath`를 갱신한다. `nextTick` 후 `[data-org-key="..."]` 요소에 `scrollIntoView({ block: 'nearest' })`를 호출한다. 직원 목록 API는 다시 호출하지 않는다.

- [ ] **Step 5: 트리 렌더링을 새 표시 규칙에 연결**

```vue
<div
    :data-org-key="item.key"
    :style="{ paddingLeft: getOrgNodeIndent(item.depth) }"
>
    <i class="ic" :class="getOrgNodeIcon(item.depth, item.hasChildren)" />
</div>
```

기존 `lvl${Math.min(item.depth, 3)}` 클래스와 `.lvl1`~`.lvl3` CSS를 제거한다.

- [ ] **Step 6: 컴포넌트 테스트 통과 확인**

Run: `npm test -- tests/unit/components/EmployeeSearchDialog.test.ts`
Expected: PASS; 단일 클릭은 조직만 이동하고 `select`는 발생하지 않는다.

- [ ] **Step 7: 기존 확정 동작 회귀 테스트 추가**

직원 단일 클릭 후 `[선택]` 버튼을 클릭하면 `select` payload의 `orgCode`가 직원의 `bbrC`인지, 더블클릭하면 즉시 `select`가 한 번 발생하는지 검증한다.

- [ ] **Step 8: 컴포넌트 테스트 전체 통과 확인**

Run: `npm test -- tests/unit/components/EmployeeSearchDialog.test.ts`
Expected: PASS with single-click, button-confirm, and double-click cases green.

### Task 3: 변경 범위 검증

**Files:**
- Verify: `it_frontend/app/utils/employeeSearchTree.ts`
- Verify: `it_frontend/app/composables/useOrganization.ts`
- Verify: `it_frontend/app/components/common/EmployeeSearchDialog.vue`
- Verify: `it_frontend/tests/unit/utils/employeeSearchTree.test.ts`
- Verify: `it_frontend/tests/unit/components/EmployeeSearchDialog.test.ts`

**Interfaces:**
- Consumes: Task 1과 Task 2의 전체 변경
- Produces: 완료 조건을 입증하는 테스트 및 정적 검사 결과

- [ ] **Step 1: 관련 단위 테스트 실행**

Run: `npm test -- tests/unit/utils/employeeSearchTree.test.ts tests/unit/components/EmployeeSearchDialog.test.ts`
Expected: PASS with zero failed tests.

- [ ] **Step 2: CSS 정적 검사 실행**

Run: `npm run lint:css -- app/components/common/EmployeeSearchDialog.vue`
Expected: exit code 0 with no Stylelint errors.

- [ ] **Step 3: 타입 검사와 ESLint 실행**

Run: `npm run check`
Expected: exit code 0 with no type or lint errors.

- [ ] **Step 4: 변경 파일 포맷 검사 실행**

Run: `npx prettier --check app/utils/employeeSearchTree.ts app/composables/useOrganization.ts app/components/common/EmployeeSearchDialog.vue tests/unit/utils/employeeSearchTree.test.ts tests/unit/components/EmployeeSearchDialog.test.ts`
Expected: exit code 0 with every listed file formatted.

- [ ] **Step 5: 변경 내용과 완료 조건 대조**

`git diff --check`와 `git diff --`로 직원 클릭 조직 이동, 자식 조직 아이콘 통일, 5단계 이상 들여쓰기 세 요구사항이 각각 코드와 테스트에 포함됐는지 확인한다.
