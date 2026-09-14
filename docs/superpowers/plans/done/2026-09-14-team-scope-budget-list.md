# 예산 목록 팀 단위 조회 범위([팀|부서]) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전산업무비·정보화사업 목록에 [팀 | 부서](관리자는 [팀 | 부서 | 전체]) 범위 토글을 추가하고 기본값을 팀으로 두며, 저장한 항목의 담당자 팀이 내 팀과 다르면 안내 토스트를 띄운다.

**Architecture:** 백엔드는 변경하지 않는다. 전산업무비 목록은 이미 지원되는 `svnTemC` 쿼리 파라미터를 [팀] 범위일 때만 보내고, 정보화사업 목록은 기존 클라이언트 필터(`useProjectListFilters`)에 팀 분기를 추가한다. 공용 토글 `InfoDashboardScopeToggle`에 `includeTeam`/`includeAll`/`teamDisabled` prop을 더해 두 화면이 공유한다. 저장 안내는 폼 저장 composable의 완료 다이얼로그 직전에 1회 토스트로 처리한다.

**Tech Stack:** Nuxt 4 CSR, Vue 3 `<script setup>`, PrimeVue 4 `SelectButton`, vue-i18n, Vitest + @vue/test-utils(happy-dom).

**Spec:** `docs/superpowers/specs/2026-09-14-team-scope-budget-list-design.md`

## Global Constraints

- 작업 저장소는 `C:\it\it_frontend`(독립 git 저장소). 커밋은 `git -C C:/it/it_frontend add <경로>` + `git -C C:/it/it_frontend commit`으로 경로를 명시해 수행한다. `git add -A`·`git add .`·`commit -a` 금지.
- 커밋 메시지는 한글, 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. 메시지 안에 큰따옴표를 넣지 않는다.
- 신규 주석·TSDoc은 한글. 자명한 대입에는 주석을 달지 않는다.
- 사용자에게 보이는 문구는 반드시 i18n(`i18n/messages/*.ts`)에 두고 ko/en을 함께 추가한다. 문자열 상수를 `export`하지 않는다(`check:copy` 래칫).
- 백엔드·OpenAPI 계약 변경 없음. `npm run codegen` 실행 불필요.
- 권한 경계는 부서 그대로다. [팀]은 조회 편의 필터일 뿐이며 서버 검증 규칙을 건드리지 않는다.
- 범위 선택값은 composable `ref`에만 두고 localStorage 등에 저장하지 않는다.
- 테스트 명령: `cd C:/it/it_frontend && npx vitest run <파일>` (단일 파일), 게이트는 `npm run format:check`, `npm run check`, `npm test`.
- 인증 사용자 팀코드는 `useAuth().user.value?.temC`(문자열, 없으면 `''`).

---

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `app/utils/infoDashboardScope.ts` (수정) | `InfoDashboardScope`에 `'team'` 추가, 기본 범위 판정 `defaultBudgetListScope()` |
| `app/components/info/InfoDashboardScopeToggle.vue` (수정) | 옵션 구성 prop 3개 추가 |
| `tests/unit/components/info/InfoDashboardScopeToggle.test.ts` (신규) | 옵션 구성·비활성 검증 |
| `i18n/messages/info.ts` (수정) | `info.dashboard.scope.team`, `teamMismatchSummary`, `teamMismatchDetail` |
| `app/composables/useCostListPage.ts` (수정) | 기본 범위·쿼리 조립·토글 노출 상태 |
| `app/pages/info/cost/index.vue` (수정) | 토글 prop 바인딩 |
| `tests/unit/composables/useCostListPage.test.ts` (수정) | 범위별 쿼리 검증 |
| `app/composables/project/useProjectListFilters.ts` (수정) | `listScope`·`showAllDepts` 파생·팀 필터 |
| `app/pages/info/projects/index.vue` (수정) | 토글 배치, 체크박스 바인딩 변경 |
| `tests/unit/composables/project/useProjectListFilters.test.ts` (수정) | 팀 범위·동기화 검증 |
| `tests/unit/pages/project-domain-i18n.test.ts` (수정) | 필터 mock에 새 반환 키 추가 |
| `app/composables/cost/useCostFormSave.ts` (수정) | 담당자 팀 불일치 토스트 |
| `app/pages/info/cost/form.vue` (수정) | `myTeamCode` ctx 전달 |
| `tests/unit/composables/cost/useCostFormSave.test.ts` (수정) | 토스트 조건 검증 |
| `app/features/project/useProjectFormSave.ts` (수정) | 저장 후 재조회 상세의 `svnTemC`로 토스트 |
| `tests/unit/features/project/useProjectFormSave.test.ts` (수정) | 토스트 조건 검증 |

---

### Task 1: 범위 타입·토글 컴포넌트·i18n

**Files:**
- Modify: `app/utils/infoDashboardScope.ts:3`
- Modify: `app/components/info/InfoDashboardScopeToggle.vue`
- Modify: `i18n/messages/info.ts:18-23` (ko), `i18n/messages/info.ts:530-535` (en)
- Create: `tests/unit/components/info/InfoDashboardScopeToggle.test.ts`

**Interfaces:**
- Produces: `type InfoDashboardScope = 'itDepartment' | 'team' | 'department' | 'all'`
- Produces: `defaultBudgetListScope(teamCode: string | undefined | null): InfoDashboardScope` — 팀코드가 비어 있지 않으면 `'team'`, 아니면 `'department'`
- Produces: `InfoDashboardScopeToggle` props `includeTeam?: boolean`(기본 false), `includeAll?: boolean`(기본 true), `teamDisabled?: boolean`(기본 false)
- Produces: i18n 키 `info.dashboard.scope.team`, `info.dashboard.scope.teamMismatchSummary`, `info.dashboard.scope.teamMismatchDetail`

- [ ] **Step 1: 실패하는 컴포넌트 테스트 작성**

`tests/unit/components/info/InfoDashboardScopeToggle.test.ts`:

```ts
/**
 * ============================================================================
 * [InfoDashboardScopeToggle] 조회 범위 토글 옵션 구성 테스트
 * ============================================================================
 * 사업예산 Home 카드와 전산업무비·정보화사업 목록이 공유하는 토글이라 옵션 순서·
 * 노출·비활성 계약을 여기서 고정한다.
 * ============================================================================
 */
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import InfoDashboardScopeToggle from '~/components/info/InfoDashboardScopeToggle.vue';

/** PrimeVue SelectButton 대역 — 옵션 배열을 버튼으로 펼쳐 value·disabled를 노출한다 */
const SelectButtonStub = defineComponent({
    props: {
        modelValue: { type: String, default: '' },
        options: { type: Array as () => Array<{ label: string; value: string; disabled: boolean }>, default: () => [] },
        optionLabel: { type: String, default: '' },
        optionValue: { type: String, default: '' },
        optionDisabled: { type: String, default: '' },
    },
    emits: ['update:modelValue'],
    template: `
        <div :data-option-disabled="optionDisabled">
            <button
                v-for="option in options"
                :key="option.value"
                type="button"
                :data-value="option.value"
                :disabled="option.disabled"
                @click="$emit('update:modelValue', option.value)"
            >{{ option.label }}</button>
        </div>
    `,
});

const mountToggle = (props: Record<string, unknown> = {}) =>
    mount(InfoDashboardScopeToggle, {
        props: { modelValue: 'department', ...props },
        global: { stubs: { SelectButton: SelectButtonStub } },
    });

const values = (wrapper: ReturnType<typeof mountToggle>) =>
    wrapper.findAll('button').map((button) => button.attributes('data-value'));

describe('InfoDashboardScopeToggle', () => {
    it('기본은 [부서][전체]만 보인다 (기존 대시보드 카드 계약)', () => {
        expect(values(mountToggle())).toEqual(['department', 'all']);
    });

    it('includeTeam이면 [팀]이 [부서] 앞에 온다', () => {
        const wrapper = mountToggle({ includeTeam: true });
        expect(values(wrapper)).toEqual(['team', 'department', 'all']);
        expect(wrapper.find('[data-value="team"]').text()).toBe('팀');
    });

    it('includeAll=false면 [전체]를 뺀다 (일반 사용자 목록)', () => {
        expect(values(mountToggle({ includeTeam: true, includeAll: false }))).toEqual([
            'team',
            'department',
        ]);
    });

    it('includeItDepartment와 함께 쓰면 [IT담당][팀][부서][전체] 순서다', () => {
        expect(values(mountToggle({ includeItDepartment: true, includeTeam: true }))).toEqual([
            'itDepartment',
            'team',
            'department',
            'all',
        ]);
    });

    it('teamDisabled면 [팀] 옵션만 비활성이고 disabled 속성명을 SelectButton에 넘긴다', () => {
        const wrapper = mountToggle({ includeTeam: true, teamDisabled: true });
        expect(wrapper.find('[data-value="team"]').attributes('disabled')).toBeDefined();
        expect(wrapper.find('[data-value="department"]').attributes('disabled')).toBeUndefined();
        expect(wrapper.find('div').attributes('data-option-disabled')).toBe('disabled');
    });

    it('옵션을 누르면 update:modelValue를 낸다', async () => {
        const wrapper = mountToggle({ includeTeam: true });
        await wrapper.find('[data-value="team"]').trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['team']);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/components/info/InfoDashboardScopeToggle.test.ts`
Expected: FAIL — `includeTeam` 케이스에서 `['department','all']`만 렌더링되어 배열 불일치.

- [ ] **Step 3: 범위 타입·기본 범위 헬퍼 추가**

`app/utils/infoDashboardScope.ts` 3행의 타입 선언을 바꾸고, 그 아래에 헬퍼를 추가한다:

```ts
export type InfoDashboardScope = 'itDepartment' | 'team' | 'department' | 'all';

/**
 * 예산 목록 화면의 초기 조회 범위를 정합니다.
 *
 * 팀코드가 있으면 팀, 없으면(SSO 미동기화 등) 부서입니다. 팀코드 없이 팀 범위를 기본으로 두면
 * 빈 목록을 "팀 항목이 없다"로 오해하게 되므로 부서로 내립니다.
 *
 * @param teamCode 로그인 사용자 팀코드
 * @returns 초기 범위
 */
export const defaultBudgetListScope = (teamCode: string | undefined | null): InfoDashboardScope =>
    teamCode ? 'team' : 'department';
```

- [ ] **Step 4: i18n 키 추가**

`i18n/messages/info.ts` ko 블록(18~23행)의 `scope`를 다음으로 교체:

```ts
                scope: {
                    label: '조회 범위',
                    itDepartment: 'IT담당',
                    team: '팀',
                    department: '부서',
                    all: '전체',
                    /** 저장한 항목의 담당자 팀이 내 팀과 달라 [팀] 목록에서 보이지 않을 때 */
                    teamMismatchSummary: '담당자 팀이 다릅니다',
                    teamMismatchDetail:
                        '저장한 항목의 담당자 팀이 내 팀과 달라 [팀] 목록에는 보이지 않습니다. [부서] 범위에서 확인할 수 있습니다.',
                },
```

en 블록(530~535행)의 `scope`를 다음으로 교체:

```ts
                scope: {
                    label: 'View scope',
                    itDepartment: 'IT owner',
                    team: 'Team',
                    department: 'Department',
                    all: 'All',
                    teamMismatchSummary: 'Different owner team',
                    teamMismatchDetail:
                        'The saved item belongs to another team, so it is hidden in the [Team] list. Switch to [Department] to find it.',
                },
```

- [ ] **Step 5: 토글 컴포넌트 수정**

`app/components/info/InfoDashboardScopeToggle.vue` 전체를 다음으로 교체:

```vue
<script setup lang="ts">
import type { InfoDashboardScope } from '~/utils/infoDashboardScope';

const scope = defineModel<InfoDashboardScope>({ required: true });
const props = withDefaults(
    defineProps<{
        /** IT담당부서 기준 범위를 제공할지 여부 */
        includeItDepartment?: boolean;
        /** 로그인 사용자 팀 기준 범위를 제공할지 여부 (예산 목록 화면) */
        includeTeam?: boolean;
        /** 전체 범위를 제공할지 여부. 일반 사용자 목록 화면은 false */
        includeAll?: boolean;
        /** 팀 범위를 고를 수 없게 할지 여부 (사용자 팀코드가 없을 때) */
        teamDisabled?: boolean;
    }>(),
    { includeItDepartment: false, includeTeam: false, includeAll: true, teamDisabled: false },
);
const { t } = useI18n();

interface ScopeOption {
    label: string;
    value: InfoDashboardScope;
    disabled: boolean;
}

/* 순서는 [IT담당][팀][부서][전체]로 고정한다 — 화면마다 달라지면 사용자가 위치로 기억하지 못한다. */
const options = computed<ScopeOption[]>(() => [
    ...(props.includeItDepartment
        ? [{ label: t('info.dashboard.scope.itDepartment'), value: 'itDepartment' as const, disabled: false }]
        : []),
    ...(props.includeTeam
        ? [{ label: t('info.dashboard.scope.team'), value: 'team' as const, disabled: props.teamDisabled }]
        : []),
    { label: t('info.dashboard.scope.department'), value: 'department' as const, disabled: false },
    ...(props.includeAll
        ? [{ label: t('info.dashboard.scope.all'), value: 'all' as const, disabled: false }]
        : []),
]);
</script>

<template>
    <SelectButton
        v-model="scope"
        :options="options"
        option-label="label"
        option-value="value"
        option-disabled="disabled"
        :allow-empty="false"
        size="small"
        class="dashboard-scope-toggle"
        :aria-label="t('info.dashboard.scope.label')"
    />
</template>

<style scoped>
.dashboard-scope-toggle :deep(.p-togglebutton) {
    min-width: 2.75rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    line-height: 1rem;
}
</style>
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/components/info/InfoDashboardScopeToggle.test.ts tests/unit/utils/infoDashboardScope.test.ts tests/unit/components/info/InfoBudgetTimingSection.test.ts`
Expected: 모두 PASS (기존 대시보드 카드 테스트는 prop 미지정이라 그대로 통과).

- [ ] **Step 7: 커밋**

```bash
git -C C:/it/it_frontend add app/utils/infoDashboardScope.ts app/components/info/InfoDashboardScopeToggle.vue i18n/messages/info.ts tests/unit/components/info/InfoDashboardScopeToggle.test.ts
git -C C:/it/it_frontend commit -m "조회 범위 토글에 팀 옵션과 전체 숨김·팀 비활성 prop 추가" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 전산업무비 목록 — 팀 범위 쿼리와 토글 노출

**Files:**
- Modify: `app/composables/useCostListPage.ts:37,46,91-93,147-150,520-521`
- Modify: `app/pages/info/cost/index.vue:38-42,143`
- Modify: `tests/unit/composables/useCostListPage.test.ts:135-147,250,278-282,327,468-527`

**Interfaces:**
- Consumes: `defaultBudgetListScope`, `InfoDashboardScope` (Task 1)
- Produces(façade 반환): `costListScope: Ref<InfoDashboardScope>`, `canUseAllCostScope: ComputedRef<boolean>`, `isTeamScopeDisabled: ComputedRef<boolean>`. `showCostScopeToggle`은 제거한다.
- 서버 쿼리: `{ myDeptOnly: 'true' | 'false', svnTemC?: string, bseYy?: string }` — `svnTemC`는 `scope === 'team'`이고 팀코드가 있을 때만 키가 존재한다.

- [ ] **Step 1: 기존 테스트의 useAuth mock을 조작 가능하게 바꾸고 실패하는 테스트 작성**

`tests/unit/composables/useCostListPage.test.ts`의 `mocks` hoisted 객체(41~55행)에 다음 항목을 추가한다:

```ts
    authUser: {
        value: {
            eno: '100001',
            empNm: '테스터',
            bbrC: 'D001',
            bbrNm: 'IT부',
            temC: 'T001',
            temNm: '포탈팀',
        } as Record<string, string>,
        __v_isRef: true,
    },
```

135~147행의 `vi.mock('~/composables/useAuth', ...)`을 다음으로 교체:

```ts
vi.mock('~/composables/useAuth', () => ({
    useAuth: () => ({
        user: mocks.authUser,
        isAdmin: mocks.isAdmin,
    }),
}));
```

`beforeEach`(219행 `mocks.isAdmin.mockReset()...` 다음 줄)에 팀코드 복원을 추가:

```ts
        mocks.authUser.value = {
            eno: '100001',
            empNm: '테스터',
            bbrC: 'D001',
            bbrNm: 'IT부',
            temC: 'T001',
            temNm: '포탈팀',
        };
```

공개 키 목록(228행부터의 배열)에서 `'showCostScopeToggle',`을 지우고, `'canCreate',` 다음 줄에 `'canUseAllCostScope',`를, `'isRowEditing',` 다음 줄에 `'isTeamScopeDisabled',`를 넣는다(배열은 `.sort()` 결과와 비교하므로 순서가 정확해야 한다).

468~527행의 범위 관련 테스트 4개(`목록은 기본적으로 소속 부서 한정…`, `예산연도를 바꾸면…`, `예산연도를 비우면…`, `관리자는 부서/전체 범위를…`)를 다음으로 교체:

```ts
    it('팀코드가 있으면 기본 범위는 팀이며 myDeptOnly=true와 svnTemC를 함께 보낸다', () => {
        mocks.fetchCosts.mockClear();

        const page = useCostListPage();

        /* 부서코드는 클라이언트가 보내지 않는다 — 서버가 인증 정보로 판정한다.
           팀코드는 허용 범위(부서) 안에서 좁히기만 하므로 클라이언트가 보낸다.
           예산연도는 서버로 내린다 — 상한(500건) 안에서 해당 연도가 밀려나지 않게 한다 */
        expect(page.costListScope.value).toBe('team');
        expect(page.canUseAllCostScope.value).toBe(false);
        expect(page.isTeamScopeDisabled.value).toBe(false);
        expect(mocks.fetchCosts).toHaveBeenCalledWith(
            expect.objectContaining({
                value: {
                    myDeptOnly: 'true',
                    svnTemC: 'T001',
                    bseYy: String(defaultBudgetYear()),
                },
            }),
            expect.objectContaining({ suppressNetworkError: true }),
        );
    });

    it('[부서]로 바꾸면 svnTemC 없이 부서 한정으로 조회한다', async () => {
        mocks.fetchCosts.mockClear();
        const page = useCostListPage();

        page.costListScope.value = 'department';
        await nextTick();

        expect(mocks.fetchCosts.mock.calls[0][0].value).toEqual({
            myDeptOnly: 'true',
            bseYy: String(defaultBudgetYear()),
        });
    });

    it('팀코드가 없으면 기본 범위는 부서이고 [팀]은 비활성이다', () => {
        mocks.authUser.value = { ...mocks.authUser.value, temC: '' };
        mocks.fetchCosts.mockClear();

        const page = useCostListPage();

        expect(page.costListScope.value).toBe('department');
        expect(page.isTeamScopeDisabled.value).toBe(true);
        expect(mocks.fetchCosts.mock.calls[0][0].value).toEqual({
            myDeptOnly: 'true',
            bseYy: String(defaultBudgetYear()),
        });
    });

    it('예산연도를 바꾸면 서버 조회 조건의 bseYy가 함께 바뀐다', async () => {
        mocks.fetchCosts.mockClear();
        const page = useCostListPage();

        page.selectedYear.value = 2030;
        await nextTick();

        expect(mocks.fetchCosts.mock.calls[0][0].value).toEqual({
            myDeptOnly: 'true',
            svnTemC: 'T001',
            bseYy: '2030',
        });
    });

    it('예산연도를 비우면 bseYy 없이 전체 연도를 조회한다', async () => {
        mocks.fetchCosts.mockClear();
        const page = useCostListPage();

        page.selectedYear.value = null;
        await nextTick();

        expect(mocks.fetchCosts.mock.calls[0][0].value).toEqual({
            myDeptOnly: 'true',
            svnTemC: 'T001',
        });
    });

    it('관리자는 팀/부서/전체를 전환하는 반응형 조회 조건을 가진다', async () => {
        mocks.isAdmin.mockReturnValue(true);

        try {
            mocks.fetchCosts.mockClear();
            const page = useCostListPage();
            expect(page.canUseAllCostScope.value).toBe(true);
            expect(page.costListScope.value).toBe('team');

            page.costListScope.value = 'all';
            await nextTick();
            expect(mocks.fetchCosts.mock.calls[0][0].value).toEqual({
                myDeptOnly: 'false',
                bseYy: String(defaultBudgetYear()),
            });

            /* [전체]에서 [팀]으로 돌아오면 부서 한정과 팀코드가 함께 나가 본인 부서·팀으로 좁혀진다 */
            page.costListScope.value = 'team';
            await nextTick();
            expect(mocks.fetchCosts.mock.calls[0][0].value).toEqual({
                myDeptOnly: 'true',
                svnTemC: 'T001',
                bseYy: String(defaultBudgetYear()),
            });
        } finally {
            mocks.isAdmin.mockReturnValue(false);
        }
    });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/composables/useCostListPage.test.ts`
Expected: FAIL — 공개 키 목록 불일치(`showCostScopeToggle` 존재, `canUseAllCostScope` 없음), 기본 범위가 `'department'`, 쿼리에 `svnTemC` 없음.

- [ ] **Step 3: composable 수정**

`app/composables/useCostListPage.ts` 37행의 import를 다음으로 바꾼다:

```ts
import { defaultBudgetListScope, type InfoDashboardScope } from '~/utils/infoDashboardScope';
```

91~93행(`/** 관리자 목록 범위 ... */`, `costListScope`, `showCostScopeToggle`)을 다음으로 교체:

```ts
    /** 로그인 사용자 팀코드. 없으면 [팀] 범위를 열지 않는다(빈 목록을 팀 항목 없음으로 오해하지 않게). */
    const myTeamCode = computed(() => user.value?.temC || '');
    /** 목록 범위: 팀코드가 있으면 팀, 없으면 부서가 기본이다. 부서 경계는 서버가 강제한다. */
    const costListScope = ref<InfoDashboardScope>(defaultBudgetListScope(myTeamCode.value));
    /** [전체] 범위는 관리자만 고를 수 있다 */
    const canUseAllCostScope = computed(() => isAdmin());
    const isTeamScopeDisabled = computed(() => !myTeamCode.value);
```

147~150행의 `costListQuery`를 다음으로 교체:

```ts
    const costListQuery = computed<Record<string, string>>(() => ({
        myDeptOnly: costListScope.value === 'all' ? 'false' : 'true',
        /* 팀코드는 서버가 강제한 부서 범위 안에서 좁히기만 하므로 클라이언트가 보낸다 */
        ...(costListScope.value === 'team' && myTeamCode.value
            ? { svnTemC: myTeamCode.value }
            : {}),
        ...(selectedYear.value ? { bseYy: String(selectedYear.value) } : {}),
    }));
```

139~140행의 기존 주석 `/* 예산 작성 범위: 관리자만 화면에서 전체 조회로 전환할 수 있다. ... */`를 다음으로 교체:

```ts
    /* 예산 작성 범위: [팀]·[부서]는 모든 사용자, [전체]는 관리자만 고를 수 있다. 부서코드는 클라이언트가
       보내지 않고 서버가 인증 정보에서 결정하므로 일반 사용자는 다른 부서로 범위를 넓힐 수 없다. */
```

반환 객체(520~521행)의 `showCostScopeToggle,`을 다음 두 줄로 교체:

```ts
        canUseAllCostScope,
        isTeamScopeDisabled,
```

- [ ] **Step 4: 페이지 템플릿 수정**

`app/pages/info/cost/index.vue` 38~42행의 구조분해에서 `showCostScopeToggle,`을 다음으로 교체:

```ts
    canUseAllCostScope,
    isTeamScopeDisabled,
```

143행의 토글을 다음으로 교체:

```vue
                    <InfoDashboardScopeToggle
                        v-model="costListScope"
                        include-team
                        :include-all="canUseAllCostScope"
                        :team-disabled="isTeamScopeDisabled"
                    />
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/composables/useCostListPage.test.ts && npm run typecheck`
Expected: 테스트 PASS, 타입 오류 0건 (`showCostScopeToggle` 참조가 남아 있으면 typecheck가 잡는다).

- [ ] **Step 6: 커밋**

```bash
git -C C:/it/it_frontend add app/composables/useCostListPage.ts app/pages/info/cost/index.vue tests/unit/composables/useCostListPage.test.ts
git -C C:/it/it_frontend commit -m "전산업무비 목록에 팀 범위 기본값과 [팀|부서] 토글 적용" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 정보화사업 목록 — 팀 필터와 토글

**Files:**
- Modify: `app/composables/project/useProjectListFilters.ts`
- Modify: `app/pages/info/projects/index.vue:26-47,102-140,269-278,570-611`
- Modify: `tests/unit/composables/project/useProjectListFilters.test.ts:43-56,84-112,271-303`
- Modify: `tests/unit/pages/project-domain-i18n.test.ts:134-151`

**Interfaces:**
- Consumes: `defaultBudgetListScope`, `InfoDashboardScope`, `InfoDashboardScopeToggle` props (Task 1)
- Produces: `useProjectListFilters` 옵션 `userTeamCode: ComputedRef<string | undefined>` 추가. `ProjectListSearchFilters`에서 `showAllDepts` 제거. 반환값에 `listScope: Ref<InfoDashboardScope>`, `showAllDepts: WritableComputedRef<boolean>` 추가.
- 규칙: `listScope === 'all'` ⇔ `showAllDepts === true`; `showAllDepts = false`는 `'department'`로 내린다. `major_department`를 1개 이상 고르면 `listScope`가 `'department'`로 돌아간다. `resetFilters()`는 `listScope`를 기본값(`defaultBudgetListScope(userTeamCode)`)으로 되돌린다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/composables/project/useProjectListFilters.test.ts` 43~56행의 `setup`을 다음으로 교체:

```ts
/**
 * 기본 관리자 컨텍스트로 composable을 만듭니다.
 * 부서·팀 범위 분기를 검증할 때만 isAdmin·userDeptCode·userTeamCode를 바꿉니다.
 * 팀코드를 주지 않으면 기본 범위는 부서이므로, 검색·제안 테스트가 합성 행(svnDpmC 'D01')을
 * 그대로 보도록 부서코드 기본값을 'D01'로 맞춘다.
 */
const setup = (
    projects: Project[],
    options: { isAdmin?: boolean; userDeptCode?: string; userTeamCode?: string; year?: string } = {},
) =>
    useProjectListFilters({
        projects: computed(() => projects),
        selectedYear: computed(() => options.year ?? '2026'),
        isAdmin: computed(() => options.isAdmin ?? true),
        userDeptCode: computed(() => options.userDeptCode ?? 'D01'),
        userTeamCode: computed(() => options.userTeamCode),
        getStatusName,
    });
```

84~112행의 테스트 3개(`관리자는 기본으로 전체 부서를 본다`, `관리자가 전체보기를 끄고…`, `비관리자는 본인 부서 사업만 본다`)를 다음으로 교체:

```ts
        it('팀코드가 없으면 기본 범위는 부서이고 관리자도 본인 부서만 본다', () => {
            const rows = [makeProject({ svnDpmC: 'D01' }), makeProject({ svnDpmC: 'D02' })];

            const { listScope, filteredProjects } = setup(rows, {
                isAdmin: true,
                userDeptCode: 'D01',
            });

            expect(listScope.value).toBe('department');
            expect(filteredProjects.value.map((p) => p.svnDpmC)).toEqual(['D01']);
        });

        it('관리자가 [전체]로 바꾸면 전체 부서를 본다', () => {
            const rows = [makeProject({ svnDpmC: 'D01' }), makeProject({ svnDpmC: 'D02' })];

            const { listScope, showAllDepts, filteredProjects } = setup(rows, {
                isAdmin: true,
                userDeptCode: 'D01',
            });
            listScope.value = 'all';

            expect(showAllDepts.value).toBe(true);
            expect(filteredProjects.value).toHaveLength(2);
        });

        it('관리자가 전체보기를 끄고 주관부서를 고르면 그 부서만 남는다', () => {
            const rows = [
                makeProject({ svnDpmCNm: '디지털기획부' }),
                makeProject({ svnDpmCNm: '여신기획부' }),
            ];
            const { listScope, showAllDepts, searchFilters, filteredProjects } = setup(rows, {
                isAdmin: true,
            });

            listScope.value = 'all';
            showAllDepts.value = false;
            searchFilters.value.major_department = ['여신기획부'];

            expect(listScope.value).toBe('department');
            expect(filteredProjects.value.map((p) => p.svnDpmCNm)).toEqual(['여신기획부']);
        });

        it('비관리자는 본인 부서 사업만 본다', () => {
            const rows = [makeProject({ svnDpmC: 'D01' }), makeProject({ svnDpmC: 'D02' })];

            const { filteredProjects } = setup(rows, { isAdmin: false, userDeptCode: 'D02' });

            expect(filteredProjects.value.map((p) => p.svnDpmC)).toEqual(['D02']);
        });

        it('팀코드가 있으면 기본 범위는 팀이고 같은 부서 다른 팀 사업은 제외한다', () => {
            const rows = [
                makeProject({ abusMngNo: 'A', svnDpmC: 'D01', svnTemC: 'T01' }),
                makeProject({ abusMngNo: 'B', svnDpmC: 'D01', svnTemC: 'T02' }),
                makeProject({ abusMngNo: 'C', svnDpmC: 'D01' }),
            ];

            const { listScope, filteredProjects } = setup(rows, {
                isAdmin: false,
                userDeptCode: 'D01',
                userTeamCode: 'T01',
            });

            expect(listScope.value).toBe('team');
            expect(filteredProjects.value.map((p) => p.abusMngNo)).toEqual(['A']);
        });

        it('[부서]로 바꾸면 같은 부서 다른 팀 사업도 보인다', () => {
            const rows = [
                makeProject({ abusMngNo: 'A', svnDpmC: 'D01', svnTemC: 'T01' }),
                makeProject({ abusMngNo: 'B', svnDpmC: 'D01', svnTemC: 'T02' }),
                makeProject({ abusMngNo: 'X', svnDpmC: 'D02', svnTemC: 'T09' }),
            ];

            const { listScope, filteredProjects } = setup(rows, {
                isAdmin: false,
                userDeptCode: 'D01',
                userTeamCode: 'T01',
            });
            listScope.value = 'department';

            expect(filteredProjects.value.map((p) => p.abusMngNo)).toEqual(['A', 'B']);
        });

        it('관리자가 팀 범위에서 주관부서를 고르면 범위가 부서로 돌아간다', async () => {
            const rows = [
                makeProject({ abusMngNo: 'A', svnDpmCNm: '디지털기획부', svnTemC: 'T01' }),
                makeProject({ abusMngNo: 'B', svnDpmCNm: '여신기획부', svnTemC: 'T02' }),
            ];
            const { listScope, searchFilters, filteredProjects } = setup(rows, {
                isAdmin: true,
                userTeamCode: 'T01',
            });
            expect(listScope.value).toBe('team');

            searchFilters.value.major_department = ['여신기획부'];
            await nextTick();

            expect(listScope.value).toBe('department');
            expect(filteredProjects.value.map((p) => p.abusMngNo)).toEqual(['B']);
        });
```

파일 상단 `import { computed } from 'vue';`를 `import { computed, nextTick } from 'vue';`로 바꾼다.

271~303행의 `필터 상태 관리` describe 안 마지막 테스트(`관리자가 아니면 전체보기 해제만으로 hasFilters가 켜지지 않는다`)를 다음으로 교체하고 그 뒤에 테스트 하나를 더 추가:

```ts
        it('관리자가 아니면 전체보기 해제만으로 hasFilters가 켜지지 않는다', () => {
            // 팀코드가 없으면 기본 범위가 부서이므로 전체보기 해제는 기본값과 같다.
            const { showAllDepts, hasFilters } = setup([makeProject()], { isAdmin: false });

            showAllDepts.value = false;

            expect(hasFilters.value).toBe(false);
        });

        it('범위를 기본값에서 바꾸면 hasFilters가 켜지고 초기화하면 기본 범위로 돌아간다', () => {
            const { listScope, hasFilters, resetFilters } = setup([makeProject()], {
                isAdmin: false,
                userTeamCode: 'T01',
            });
            expect(hasFilters.value).toBe(false);

            listScope.value = 'department';
            expect(hasFilters.value).toBe(true);

            resetFilters();
            expect(listScope.value).toBe('team');
            expect(hasFilters.value).toBe(false);
        });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/composables/project/useProjectListFilters.test.ts`
Expected: FAIL — `listScope`/`showAllDepts`가 반환값에 없어 `undefined` 접근 오류, 타입 오류(`userTeamCode` 미지원).

- [ ] **Step 3: composable 수정**

`app/composables/project/useProjectListFilters.ts`:

1행 import를 다음으로 교체:

```ts
import { computed, ref, watch, type ComputedRef } from 'vue';
import type { Project } from '~/composables/useProjects';
import { toLocalDateKey } from '~/utils/common';
import { defaultBudgetListScope, type InfoDashboardScope } from '~/utils/infoDashboardScope';
```

`ProjectListSearchFilters`에서 다음 두 줄을 삭제:

```ts
    /** 관리자 전용 — 전체 부서 보기 */
    showAllDepts: boolean;
```

`ProjectListFiltersOptions`의 `userDeptCode` 다음에 추가:

```ts
    /** 로그인 사용자의 소속 팀코드 — 팀 범위의 기준. 없으면 기본 범위가 부서다 */
    userTeamCode: ComputedRef<string | undefined>;
```

`emptyFilters`에서 `showAllDepts: true,` 줄을 삭제하고 그 위 주석을 `/** 필터 초기값 */`로 바꾼다.

함수 본문의 `const { projects, selectedYear, isAdmin, userDeptCode, getStatusName } = options;`를 다음으로 교체:

```ts
    const { projects, selectedYear, isAdmin, userDeptCode, userTeamCode, getStatusName } = options;
```

`const searchFilters = ref<ProjectListSearchFilters>(emptyFilters());` 바로 아래에 추가:

```ts
    /** 기본 조회 범위: 팀코드가 있으면 팀, 없으면 부서 */
    const defaultScope = computed(() => defaultBudgetListScope(userTeamCode.value));

    /**
     * 목록 조회 범위. 팀·부서는 모든 사용자, 전체는 관리자만 화면에서 고를 수 있다.
     * 부서 경계는 서버가 이미 걸러 보낸 목록을 다시 좁히는 UX 보조 필터다.
     */
    const listScope = ref<InfoDashboardScope>(defaultScope.value);

    /**
     * 관리자 Drawer의 [전체] 체크박스. 범위 토글의 [전체]와 같은 상태를 가리키도록 listScope에서
     * 파생한다 — 두 상태를 따로 두면 체크박스는 켜져 있는데 목록은 부서만 보이는 식으로 어긋난다.
     */
    const showAllDepts = computed<boolean>({
        get: () => listScope.value === 'all',
        set: (value) => {
            listScope.value = value ? 'all' : 'department';
        },
    });

    /* 특정 주관부서를 고르는 순간 팀·전체 범위는 의미가 없으므로 부서 범위로 되돌린다. */
    watch(
        () => searchFilters.value.major_department.length,
        (count) => {
            if (count > 0 && listScope.value !== 'department') listScope.value = 'department';
        },
    );
```

`resetFilters`를 다음으로 교체:

```ts
    /**
     * 검색 필터 초기화
     * 모든 필터 조건과 조회 범위를 초기 상태로 리셋합니다. 통합 검색어는 Drawer 밖에
     * 있으므로 함께 지우지 않습니다.
     */
    const resetFilters = () => {
        searchFilters.value = emptyFilters();
        listScope.value = defaultScope.value;
    };
```

`hasFilters`를 다음으로 교체:

```ts
    /** 필터 적용 여부 (범위를 기본값에서 바꾸거나 조건을 설정하면 활성) */
    const hasFilters = computed(
        () =>
            listScope.value !== defaultScope.value ||
            searchFilters.value.name !== '' ||
            searchFilters.value.category !== '' ||
            (isAdmin.value && searchFilters.value.major_department.length > 0) ||
            searchFilters.value.it_department.length > 0 ||
            searchFilters.value.major_hdq.length > 0 ||
            searchFilters.value.status.length > 0 ||
            searchFilters.value.budgetMin !== null ||
            searchFilters.value.budgetMax !== null ||
            searchFilters.value.startDate !== null ||
            searchFilters.value.endDate !== null,
    );
```

`filteredProjects` 안의 부서 필터 블록(주석 `/* 부서 필터링: ... */`부터 `else { if (project.svnDpmC !== userDeptCode.value) return false; }`까지)을 다음으로 교체:

```ts
            /* 범위 필터링
             *   - team (팀코드 있음)     → 주관팀이 내 팀인 사업만
             *   - all (관리자)           → 전체 부서 통과
             *   - major_department 선택  → 선택 부서만 (관리자만)
             *   - 그 외(department)      → 본인 부서만 */
            if (listScope.value === 'team' && userTeamCode.value) {
                if (project.svnTemC !== userTeamCode.value) return false;
            } else if (isAdmin.value && listScope.value === 'all') {
                /* 전체 부서 보기: 통과 */
            } else if (isAdmin.value && searchFilters.value.major_department.length > 0) {
                if (!searchFilters.value.major_department.includes(project.svnDpmCNm)) return false;
            } else {
                if (project.svnDpmC !== userDeptCode.value) return false;
            }
```

반환 객체에 `searchFilters,` 다음 줄로 추가:

```ts
        listScope,
        showAllDepts,
```

- [ ] **Step 4: 페이지 수정**

`app/pages/info/projects/index.vue`:

import 블록(47행 `YearPickerTitle` 근처)에 추가:

```ts
import InfoDashboardScopeToggle from '~/components/info/InfoDashboardScopeToggle.vue';
```

103행 `const isAdmin = ...` 다음에 추가:

```ts
/** 팀코드가 없으면 [팀] 범위를 고를 수 없다 */
const isTeamScopeDisabled = computed(() => !user.value?.temC);
```

120~140행의 구조분해에 `searchFilters,` 다음 줄로 `listScope,`와 `showAllDepts,`를 추가하고, `useProjectListFilters({...})` 인자에 `userDeptCode: computed(() => user.value?.bbrC),` 다음 줄로 추가:

```ts
    userTeamCode: computed(() => user.value?.temC),
```

`<PageHeader>`의 `#actions` 슬롯(270~278행) 맨 앞, 기존 `<SelectButton v-model="selectedUnit" ...>` 앞에 추가:

```vue
                <InfoDashboardScopeToggle
                    v-model="listScope"
                    include-team
                    :include-all="isAdmin"
                    :team-disabled="isTeamScopeDisabled"
                />
```

Drawer의 [전체] 체크박스(570~611행)에서 `searchFilters.showAllDepts`를 모두 `showAllDepts`로 바꾼다. 정확히 세 곳:

```vue
                                :class="
                                    showAllDepts
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-zinc-700 dark:text-zinc-300'
                                "
```

```vue
                                <Checkbox
                                    v-model="showAllDepts"
                                    :binary="true"
                                    @change="showAllDepts && (searchFilters.major_department = [])"
                                />
```

```vue
                            :disabled="showAllDepts"
```

- [ ] **Step 5: 페이지 i18n 테스트의 필터 mock 갱신**

`tests/unit/pages/project-domain-i18n.test.ts` 134~151행의 `useProjectListFilters` mock 반환 객체에 `searchFilters: ref({}),` 다음 줄로 추가:

```ts
        listScope: ref('department'),
        showAllDepts: ref(false),
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/composables/project/useProjectListFilters.test.ts tests/unit/pages/project-domain-i18n.test.ts && npm run typecheck`
Expected: 모두 PASS, 타입 오류 0건. (`searchFilters.showAllDepts`가 남아 있으면 typecheck가 잡는다.)

- [ ] **Step 7: 커밋**

```bash
git -C C:/it/it_frontend add app/composables/project/useProjectListFilters.ts app/pages/info/projects/index.vue tests/unit/composables/project/useProjectListFilters.test.ts tests/unit/pages/project-domain-i18n.test.ts
git -C C:/it/it_frontend commit -m "정보화사업 목록에 팀 범위 필터와 [팀|부서|전체] 토글 적용" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 전산업무비 저장 후 담당자 팀 불일치 안내

**Files:**
- Modify: `app/composables/cost/useCostFormSave.ts:94-108` (ctx 타입), `:361-364` (완료 다이얼로그 직전)
- Modify: `app/pages/info/cost/form.vue:83-99`
- Modify: `tests/unit/composables/cost/useCostFormSave.test.ts:53-73`

**Interfaces:**
- Consumes: i18n `info.dashboard.scope.teamMismatchSummary/Detail` (Task 1)
- Produces: `useCostFormSave` ctx에 `myTeamCode?: () => string | undefined` 추가. 저장 성공 시 `costs` 중 `svnTemC`가 비어 있지 않고 `myTeamCode()`와 다른 행이 하나라도 있으면 `toast.add({ severity: 'info', ... life: TOAST_LIFE.LONG })` 1회. `myTeamCode()`가 빈 값이면 띄우지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/composables/cost/useCostFormSave.test.ts`의 `createRow`(10~30행)가 오버라이드를 받도록 시그니처를 `const createRow = (overrides: Partial<ItCost> = {}): ItCost => ({`로 바꾸고, 마지막 필드 `assetBg: 0,` 다음 줄에 `...overrides,`를 넣는다. 기존 호출 `createRow()`는 그대로 동작한다.

`createSave` 헬퍼(53~73행) `overrides` 타입에 `myTeamCode?: () => string | undefined;`를 추가하고, `useCostFormSave({...})` 인자에 `syncAttachments: overrides.syncAttachments,` 다음 줄로 `myTeamCode: overrides.myTeamCode,`를 추가한다.

`describe('useCostFormSave', ...)` 블록 끝(마지막 `it` 다음, 닫는 `});` 앞)에 추가:

```ts
    describe('담당자 팀 불일치 안내', () => {
        const teamMismatchToast = () =>
            toast.add.mock.calls.filter(
                ([options]) =>
                    (options as { summary?: string }).summary ===
                    'info.dashboard.scope.teamMismatchSummary',
            );

        it('저장한 항목의 담당자 팀이 내 팀과 다르면 info 토스트를 1회 띄운다', async () => {
            const costs = ref<ItCost[]>([
                createRow({ svnTemC: 'T002' }),
                createRow({ costBgNo: 'COST-002', svnTemC: 'T003' }),
            ]);
            const { saveCosts } = createSave({
                costs,
                isEditSingle: false,
                myTeamCode: () => 'T001',
            });

            await saveCosts(false);

            expect(teamMismatchToast()).toHaveLength(1);
            expect(teamMismatchToast()[0]?.[0]).toMatchObject({
                severity: 'info',
                detail: 'info.dashboard.scope.teamMismatchDetail',
            });
        });

        it('전부 내 팀이면 띄우지 않는다', async () => {
            const costs = ref<ItCost[]>([createRow({ svnTemC: 'T001' })]);
            const { saveCosts } = createSave({ costs, myTeamCode: () => 'T001' });

            await saveCosts(false);

            expect(teamMismatchToast()).toHaveLength(0);
        });

        it('내 팀코드가 없거나 저장 행의 팀코드가 비어 있으면 띄우지 않는다', async () => {
            const noMyTeam = createSave({
                costs: ref<ItCost[]>([createRow({ svnTemC: 'T002' })]),
                myTeamCode: () => '',
            });
            await noMyTeam.saveCosts(false);
            expect(teamMismatchToast()).toHaveLength(0);

            const emptyRowTeam = createSave({
                costs: ref<ItCost[]>([createRow({ svnTemC: '' })]),
                myTeamCode: () => 'T001',
            });
            await emptyRowTeam.saveCosts(false);
            expect(teamMismatchToast()).toHaveLength(0);
        });
    });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/composables/cost/useCostFormSave.test.ts`
Expected: FAIL — 첫 케이스에서 토스트 0회.

- [ ] **Step 3: composable 수정**

`app/composables/cost/useCostFormSave.ts` ctx 타입(94~108행)의 `syncAttachments?: ...;` 다음에 추가:

```ts
    /** 로그인 사용자 팀코드. 저장한 항목의 담당자 팀이 이와 다르면 [부서] 범위 안내를 띄운다 */
    myTeamCode?: () => string | undefined;
```

저장 성공 분기에서 `if (attachmentCostBgNo) acceptedBody = null;`(363행) 바로 다음, `/* 작성 내용 확인: ... */` 주석 앞에 추가:

```ts
            notifyTeamMismatch();
```

같은 파일의 `applyAttachments` 정의 바로 위(`/** 본문 저장이 끝난 관리번호에 첨부를 적용하고 ... */` 앞)에 함수를 추가:

```ts
    /**
     * 저장한 항목의 담당자 팀이 내 팀과 다르면 [팀] 목록에서 보이지 않는다고 1회 안내합니다.
     *
     * 저장 규칙 자체는 바꾸지 않는다 — 팀은 담당자 소속을 따른다. 내 팀코드가 없으면 비교할 수 없으므로
     * 띄우지 않는다.
     */
    const notifyTeamMismatch = () => {
        const myTeam = ctx.myTeamCode?.() || '';
        if (!myTeam) return;
        const mismatched = ctx.costs.value.some(
            (cost) => Boolean(cost.svnTemC) && cost.svnTemC !== myTeam,
        );
        if (!mismatched) return;
        ctx.toast.add({
            severity: 'info',
            summary: t('info.dashboard.scope.teamMismatchSummary'),
            detail: t('info.dashboard.scope.teamMismatchDetail'),
            life: TOAST_LIFE.LONG,
        });
    };
```

- [ ] **Step 4: 페이지에서 팀코드 전달**

`app/pages/info/cost/form.vue`의 `useCostFormSave({ ... syncAttachments: attachments.syncAttachments, })` 인자에 마지막 줄로 추가:

```ts
    myTeamCode: () => user.value?.temC,
```

`form.vue` 42행 `const { isAdmin } = useAuth();`를 `const { user, isAdmin } = useAuth();`로 바꾼다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/composables/cost/useCostFormSave.test.ts && npm run typecheck`
Expected: PASS, 타입 오류 0건.

- [ ] **Step 6: 커밋**

```bash
git -C C:/it/it_frontend add app/composables/cost/useCostFormSave.ts app/pages/info/cost/form.vue tests/unit/composables/cost/useCostFormSave.test.ts
git -C C:/it/it_frontend commit -m "전산업무비 저장 후 담당자 팀이 다르면 부서 범위 확인 안내" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: 정보화사업 저장 후 담당자 팀 불일치 안내

**Files:**
- Modify: `app/features/project/useProjectFormSave.ts:106` (useAuth), `:170-176` (finishSave), `:287-297` (refreshStampAndBaseline), `:305-313` (afterMergeSaved)
- Modify: `tests/unit/features/project/useProjectFormSave.test.ts:26-40`

**Interfaces:**
- Consumes: i18n `info.dashboard.scope.teamMismatchSummary/Detail` (Task 1)
- 규칙: 정보화사업 폼에는 `svnTemC`가 없고 서버가 담당자로 주관팀을 정하므로, 저장 후 재조회한 상세(`ProjectDetail.svnTemC`)를 기준으로 판단한다. 재조회가 실패하면 비교할 값이 없으므로 띄우지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/features/project/useProjectFormSave.test.ts` `mocks`(26~36행)에 추가:

```ts
    authUser: { value: { temC: 'T001' } as { temC: string }, __v_isRef: true },
```

38~40행의 useAuth mock을 다음으로 교체:

```ts
vi.mock('~/composables/useAuth', () => ({
    useAuth: () => ({ isAdmin: mocks.isAdmin, user: mocks.authUser }),
}));
```

`beforeEach`(155~162행) 끝에 추가:

```ts
    mocks.authUser.value = { temC: 'T001' };
```

파일 끝에 describe 추가:

```ts
describe('useProjectFormSave의 담당자 팀 불일치 안내', () => {
    const teamMismatchToast = () =>
        mocks.toast.add.mock.calls.filter(
            ([options]) =>
                (options as { summary?: string }).summary ===
                'info.dashboard.scope.teamMismatchSummary',
        );

    it('저장 후 재조회한 상세의 주관팀이 내 팀과 다르면 info 토스트를 1회 띄운다', async () => {
        mocks.fetchProjectDetailOnce.mockResolvedValue(
            detail({ concurrencyStamp: STAMP_F, svnTemC: 'T002' }),
        );
        const { saveProject } = setup();

        await saveProject(false);

        expect(teamMismatchToast()).toHaveLength(1);
        expect(teamMismatchToast()[0]?.[0]).toMatchObject({
            severity: 'info',
            detail: 'info.dashboard.scope.teamMismatchDetail',
        });
    });

    it('주관팀이 내 팀과 같으면 띄우지 않는다', async () => {
        mocks.fetchProjectDetailOnce.mockResolvedValue(
            detail({ concurrencyStamp: STAMP_F, svnTemC: 'T001' }),
        );
        const { saveProject } = setup();

        await saveProject(false);

        expect(teamMismatchToast()).toHaveLength(0);
    });

    it('내 팀코드가 없거나 재조회가 실패해 상세가 없으면 띄우지 않는다', async () => {
        mocks.authUser.value = { temC: '' };
        mocks.fetchProjectDetailOnce.mockResolvedValue(
            detail({ concurrencyStamp: STAMP_F, svnTemC: 'T002' }),
        );
        await setup().saveProject(false);
        expect(teamMismatchToast()).toHaveLength(0);

        mocks.authUser.value = { temC: 'T001' };
        mocks.fetchProjectDetailOnce.mockRejectedValue(new Error('network'));
        await setup().saveProject(false);
        expect(teamMismatchToast()).toHaveLength(0);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/features/project/useProjectFormSave.test.ts`
Expected: FAIL — 첫 케이스에서 토스트 0회.

- [ ] **Step 3: composable 수정**

`app/features/project/useProjectFormSave.ts` 106행을 다음으로 교체:

```ts
    const { isAdmin, user } = useAuth();
```

`refreshStampAndBaseline` 정의 바로 위에 추가:

```ts
    /** 직전 저장 뒤 서버가 돌려준 주관팀코드. 재조회가 실패하면 null로 두고 안내를 건너뛴다. */
    let lastSavedTeamCode: string | null = null;

    /**
     * 저장한 사업의 주관팀이 내 팀과 다르면 [팀] 목록에서 보이지 않는다고 1회 안내합니다.
     *
     * 정보화사업 폼은 주관팀을 직접 들고 있지 않고 서버가 담당자 소속으로 정하므로, 저장 뒤
     * 재조회한 상세의 값을 기준으로 삼는다. 내 팀코드가 없으면 비교할 수 없으므로 띄우지 않는다.
     */
    const notifyTeamMismatch = () => {
        const myTeam = user.value?.temC || '';
        const savedTeam = lastSavedTeamCode;
        lastSavedTeamCode = null;
        if (!myTeam || !savedTeam || savedTeam === myTeam) return;
        toast.add({
            severity: 'info',
            summary: t('info.dashboard.scope.teamMismatchSummary'),
            detail: t('info.dashboard.scope.teamMismatchDetail'),
            life: TOAST_LIFE.LONG,
        });
    };
```

`refreshStampAndBaseline`의 `if (!fresh) return;` 다음 줄에 추가:

```ts
            lastSavedTeamCode = fresh.svnTemC ?? null;
```

`afterMergeSaved`의 `if (fresh) applyLoadedDetail(fresh);`를 다음으로 교체:

```ts
            if (fresh) {
                lastSavedTeamCode = fresh.svnTemC ?? null;
                applyLoadedDetail(fresh);
            }
```

`finishSave` 안에서 `await applyAttachments(savedPrjMngNo);` 다음 줄에 추가:

```ts
        notifyTeamMismatch();
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:/it/it_frontend && npx vitest run tests/unit/features/project/useProjectFormSave.test.ts tests/unit/composables/useProjectFormPage.test.ts && npm run typecheck`
Expected: PASS, 타입 오류 0건. `useProjectFormPage.test.ts`는 `useAuth`를 `user: ref(null)`로 stub하므로 `user.value?.temC`가 `undefined`로 평가돼 안내를 건너뛰고 그대로 통과한다.

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_frontend add app/features/project/useProjectFormSave.ts tests/unit/features/project/useProjectFormSave.test.ts
git -C C:/it/it_frontend commit -m "정보화사업 저장 후 주관팀이 다르면 부서 범위 확인 안내" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 전체 게이트·브라우저 확인·마무리 기록

**Files:**
- Modify(조건부): 게이트가 잡은 파일
- Modify: `C:\it\versions.lock` (스크립트가 갱신), `C:\it\docs\superpowers\specs\` → `done/` 이동, `C:\it\docs\superpowers\plans\` → `done/` 이동

- [ ] **Step 1: 프론트 게이트 실행**

Run:

```bash
cd C:/it/it_frontend && npm run format:check && npm run check && npm test
```

Expected: 세 명령 모두 종료코드 0. `format:check` 실패면 `npx prettier --write <해당 파일>` 후 재실행하고 해당 파일만 추가 커밋한다(`git -C C:/it/it_frontend add <파일>`; 메시지 `팀 범위 변경분 포맷 정리`).

- [ ] **Step 2: 브라우저 확인 (관찰 가능한 UI 변경)**

`preview_start`로 프론트 dev 서버(`.claude/launch.json`의 프론트 항목)를 열고 백엔드가 떠 있는 상태에서:

1. `/info/cost` 진입 → 헤더 우측에 [팀][부서] (관리자면 [팀][부서][전체]) 토글이 보이고 [팀]이 선택돼 있는지 `read_page`로 확인. `read_network_requests`로 `GET /api/costs?...myDeptOnly=true&svnTemC=<팀코드>&bseYy=...` 요청 확인.
2. [부서] 클릭 → `svnTemC` 없는 재조회 요청 확인.
3. `/info/projects` 진입 → PageHeader 액션 영역에 같은 토글, 목록 건수가 [팀]→[부서]에서 늘어나는지(같은 부서 다른 팀 건이 있을 때) 확인. 관리자면 Drawer의 [전체] 체크박스가 토글 [전체]와 함께 켜지는지 확인.
4. 스크린샷 1장(`computer` screenshot)을 사용자에게 공유.

백엔드가 없으면 이 단계는 건너뛰고 그 사실을 보고한다.

- [ ] **Step 3: 호환 버전 기록과 산출물 이동**

```powershell
cd C:\it
./scripts/update-versions-lock.ps1
git mv docs/superpowers/specs/2026-09-14-team-scope-budget-list-design.md docs/superpowers/specs/done/
git mv docs/superpowers/plans/2026-09-14-team-scope-budget-list.md docs/superpowers/plans/done/
git add versions.lock
git diff --cached --stat
git rev-parse --abbrev-ref HEAD
```

Expected: `main`, 스테이징에 스펙·계획 이동과 `versions.lock`만 있음. 이어서:

```powershell
git commit -m "예산 목록 팀 범위 설계·계획 완료 처리와 호환 버전 갱신" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: 완료 보고**

사용자에게 다음을 보고한다: 프론트 커밋 5건 해시, 게이트 결과(각 명령의 통과 여부와 테스트 개수), 브라우저 확인 결과 또는 건너뛴 사유, 백엔드 변경 없음.
