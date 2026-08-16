# 언어 선택기 아이콘 + Listbox 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헤더·로그인 화면의 언어 선택기를 텍스트 세그먼트 버튼 2개에서 Language 아이콘 버튼 1개로 줄이고, 아이콘 클릭 시 Popover 안의 Listbox에서 언어를 고르게 한다.

**Architecture:** 변경 파일은 `app/components/common/LocaleSwitcher.vue` 하나다. 소비처인 `AppHeader.vue`와 `pages/login.vue`는 이 컴포넌트를 그대로 쓰므로 수정 없이 두 화면에 반영된다. 트리거 버튼은 `primeicons`의 `pi pi-language` 클래스를 쓰고, 오버레이는 PrimeVue `Popover` + `Listbox` 조합으로 만든다. 언어 전환 로직(`useAppLocale().setAppLocale`, 중복 클릭 가드)은 그대로 유지한다.

**Tech Stack:** Nuxt 4 (CSR), Vue 3 `<script setup lang="ts">`, PrimeVue 4.5 (`Popover`, `Listbox` — `@primevue/nuxt-module` 자동 임포트), primeicons 7, Tailwind CSS, Vitest + `@vue/test-utils`

## Global Constraints

- 신규 npm 의존성을 추가하지 않는다. `@primeicons/vue`는 이 저장소에 없으므로 `primeicons@7.0.0`의 CSS 클래스 `pi pi-language`를 쓴다.
- i18n 메시지를 추가하지 않는다. 기존 `common.language.label` / `common.language.korean` / `common.language.english` 키만 재사용한다.
- `app/components/common` 컴포넌트는 자동 등록 접두사 혼선을 피하기 위해 명시적으로 import한다 (`it_frontend/CLAUDE.md` §5). 이 계획에서는 소비처를 수정하지 않으므로 기존 import 문을 그대로 둔다.
- 주석은 한글로 작성한다 (`CLAUDE.md` §4.1).
- Prettier 설정은 4-space 들여쓰기, `printWidth: 100`이다.
- 지원 로케일은 `ko`, `en` 두 개뿐이다 (`app/types/i18n.ts`의 `APP_LOCALES`). 국기 이미지·언어 코드 뱃지·검색 필터는 넣지 않는다.
- `AppHeader.vue`, `pages/login.vue`, `i18n/messages/common.ts`는 이 계획에서 수정하지 않는다.

---

### Task 1: LocaleSwitcher를 아이콘 트리거 + Popover Listbox로 전환

**Files:**

- Modify: `it_frontend/app/components/common/LocaleSwitcher.vue` (전체 교체, 현재 48줄)
- Test: `it_frontend/tests/unit/components/LocaleSwitcher.test.ts` (전체 재작성, 현재 43줄)

**Interfaces:**

- Consumes:
  - `useAppLocale()` → `{ locale: Ref<string>, setAppLocale: (value: AppLocale) => Promise<void> }` (`~/composables/useAppLocale`)
  - `useI18n({ useScope: 'global' })` → `{ t: (key: string) => string }` (Nuxt i18n 전역 자동 임포트)
  - `AppLocale = 'ko' | 'en'` (`~/types/i18n`)
- Produces (외부에서 의존하는 DOM 계약):
  - 트리거 버튼: `[data-testid="locale-switcher-trigger"]`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-label`
  - 옵션 라벨: `[data-locale="ko"]`, `[data-locale="en"]`
  - props·emit·slot 없음 (기존과 동일)

**배경 — 지금 코드가 이렇게 생겼다:**

현재 `LocaleSwitcher.vue`는 `role="group"` 컨테이너 안에 `v-for`로 버튼 2개를 그리고, 활성 언어를 `aria-pressed`와 배경색으로 표시한다. 기존 단위 테스트는 `[data-locale="ko"]`의 `aria-pressed`와 `[role="group"]`의 `aria-label`을 확인하므로 이 구조가 사라지면 반드시 깨진다. 그래서 테스트를 먼저 새 계약으로 바꾼 뒤 컴포넌트를 고친다.

PrimeVue 컴포넌트는 `@primevue/nuxt-module`이 런타임에 자동 등록하지만 **Vitest에는 그 모듈이 없다.** 스텁 없이 mount하면 `Failed to resolve component: Popover` 경고와 함께 슬롯이 렌더링되지 않는다. `tests/unit/components/mfa/MfaDialog.test.ts`가 `Dialog`/`Button`/`InputText`를 스텁으로 바꾸는 것과 같은 방식으로 `Popover`/`Listbox`를 스텁한다. `Popover`는 실제로는 `body`로 teleport되므로, 스텁이 슬롯을 인라인으로 렌더링해 주는 것이 이 테스트가 성립하는 전제다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`it_frontend/tests/unit/components/LocaleSwitcher.test.ts`의 내용을 아래로 **전부 교체**한다.

```ts
/**
 * ============================================================================
 * [tests/unit/components/LocaleSwitcher.test.ts]
 * 언어 선택기(Language 아이콘 트리거 + Popover Listbox) 컴포넌트 테스트
 * ============================================================================
 * - PrimeVue Popover/Listbox는 최소 스텁으로 대체해 teleport 없이 슬롯을 렌더링한다.
 * - 언어 전환은 useAppLocale 모킹으로 호출 계약만 확인한다.
 * ============================================================================
 */
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestTranslator } from '../../helpers/i18n';

const locale = ref<'ko' | 'en'>('ko');
const setAppLocale = vi.fn();
vi.mock('~/composables/useAppLocale', () => ({
    useAppLocale: () => ({ locale, setAppLocale }),
}));

/** 컴포넌트가 popoverRef로 호출하는 메서드를 테스트에서 관찰하기 위한 스파이. */
const toggle = vi.fn();
const hide = vi.fn();

/** teleport 없이 기본 슬롯을 그대로 렌더링하고 toggle/hide만 노출하는 Popover 스텁. */
const PopoverStub = defineComponent({
    name: 'Popover',
    setup(_, { slots, expose }) {
        expose({ toggle, hide });
        return () => h('div', { class: 'popover-stub' }, slots.default?.());
    },
});

/** options를 li로 펼치고 #option 슬롯을 그대로 통과시키는 Listbox 스텁. */
const ListboxStub = defineComponent({
    name: 'Listbox',
    props: {
        modelValue: { type: String, default: '' },
        options: {
            type: Array as () => { value: string; label: string }[],
            default: () => [],
        },
    },
    emits: ['update:modelValue'],
    setup(props, { emit, slots }) {
        return () =>
            h(
                'ul',
                props.options.map((option) =>
                    h(
                        'li',
                        {
                            'data-option': option.value,
                            'aria-selected': props.modelValue === option.value,
                            onClick: () => emit('update:modelValue', option.value),
                        },
                        slots.option ? slots.option({ option }) : option.label,
                    ),
                ),
            );
    },
});

const mountSwitcher = async () => {
    const Component = (await import('~/components/common/LocaleSwitcher.vue')).default;
    return mount(Component, {
        global: { stubs: { Popover: PopoverStub, Listbox: ListboxStub } },
    });
};

describe('LocaleSwitcher', () => {
    beforeEach(() => {
        locale.value = 'ko';
        setAppLocale.mockReset();
        toggle.mockReset();
        hide.mockReset();
        vi.stubGlobal('useI18n', () => ({
            t: createTestTranslator(locale),
        }));
    });

    it('Language 아이콘 트리거를 렌더링하고 활성 언어에 맞는 접근성 이름을 제공한다', async () => {
        const wrapper = await mountSwitcher();
        const trigger = wrapper.get('[data-testid="locale-switcher-trigger"]');

        expect(trigger.find('i.pi.pi-language').exists()).toBe(true);
        expect(trigger.attributes('aria-haspopup')).toBe('listbox');
        expect(trigger.attributes('aria-expanded')).toBe('false');
        expect(trigger.attributes('aria-label')).toBe('언어 선택');

        locale.value = 'en';
        await wrapper.vm.$nextTick();

        expect(
            wrapper.get('[data-testid="locale-switcher-trigger"]').attributes('aria-label'),
        ).toBe('Select language');
    });

    it('현재 언어를 Listbox 선택 상태로 표시하고 옵션에 data-locale을 남긴다', async () => {
        const wrapper = await mountSwitcher();

        expect(wrapper.get('[data-option="ko"]').attributes('aria-selected')).toBe('true');
        expect(wrapper.get('[data-option="en"]').attributes('aria-selected')).toBe('false');
        expect(wrapper.get('[data-locale="ko"]').text()).toBe('한국어');
        expect(wrapper.get('[data-locale="en"]').text()).toBe('English');
    });

    it('트리거를 클릭하면 Popover를 토글한다', async () => {
        const wrapper = await mountSwitcher();

        await wrapper.get('[data-testid="locale-switcher-trigger"]').trigger('click');

        expect(toggle).toHaveBeenCalledOnce();
        expect(setAppLocale).not.toHaveBeenCalled();
    });

    it('다른 언어를 선택하면 전환한 뒤 Popover를 닫는다', async () => {
        const wrapper = await mountSwitcher();

        await wrapper.get('[data-option="en"]').trigger('click');
        await flushPromises();

        expect(setAppLocale).toHaveBeenCalledOnce();
        expect(setAppLocale).toHaveBeenCalledWith('en');
        expect(hide).toHaveBeenCalledOnce();
    });

    it('현재 언어를 다시 선택하면 전환하지 않고 Popover만 닫는다', async () => {
        const wrapper = await mountSwitcher();

        await wrapper.get('[data-option="ko"]').trigger('click');
        await flushPromises();

        expect(setAppLocale).not.toHaveBeenCalled();
        expect(hide).toHaveBeenCalledOnce();
    });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run:

```bash
cd it_frontend && npx vitest run tests/unit/components/LocaleSwitcher.test.ts
```

Expected: 5개 테스트 전부 FAIL. 첫 번째는 `Unable to get [data-testid="locale-switcher-trigger"]`로 떨어진다(현재 컴포넌트에 그 요소가 없음). 여기서 실패 사유가 `Cannot find module`이나 import 오류라면 진행하지 말고 경로부터 고친다.

- [ ] **Step 3: 컴포넌트를 새 구조로 교체한다**

`it_frontend/app/components/common/LocaleSwitcher.vue`의 내용을 아래로 **전부 교체**한다.

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useAppLocale } from '~/composables/useAppLocale';
import type { AppLocale } from '~/types/i18n';

const { locale, setAppLocale } = useAppLocale();
const { t } = useI18n({ useScope: 'global' });

/** Popover 인스턴스. 열고 닫는 제어를 PrimeVue에 위임하기 위해 참조만 보관합니다. */
const popoverRef = ref<{ toggle: (event: Event) => void; hide: () => void } | null>(null);
/** 트리거의 aria-expanded 동기화용. Popover의 show/hide 이벤트로만 갱신합니다. */
const open = ref(false);
/** 전환 중 중복 클릭을 막습니다. */
const changing = ref(false);

const localeOptions = computed(() => [
    { value: 'ko' as AppLocale, label: t('common.language.korean') },
    { value: 'en' as AppLocale, label: t('common.language.english') },
]);

const togglePanel = (event: Event) => {
    popoverRef.value?.toggle(event);
};

/**
 * 선택한 언어로 전환합니다.
 * 전환 중이거나 이미 활성인 언어를 다시 고르면 전환하지 않고 Popover만 닫습니다.
 * 열린 채로 두면 선택이 무시된 것처럼 보이기 때문입니다.
 */
const selectLocale = async (value: AppLocale) => {
    if (changing.value || locale.value === value) {
        popoverRef.value?.hide();
        return;
    }
    changing.value = true;
    try {
        await setAppLocale(value);
    } finally {
        changing.value = false;
        popoverRef.value?.hide();
    }
};
</script>

<template>
    <div class="inline-flex">
        <button
            type="button"
            class="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            :aria-label="t('common.language.label')"
            :title="t('common.language.label')"
            aria-haspopup="listbox"
            :aria-expanded="open"
            :disabled="changing"
            data-testid="locale-switcher-trigger"
            @click="togglePanel"
        >
            <i class="pi pi-language text-lg" />
        </button>

        <Popover ref="popoverRef" @show="open = true" @hide="open = false">
            <Listbox
                :model-value="locale"
                :options="localeOptions"
                option-label="label"
                option-value="value"
                :aria-label="t('common.language.label')"
                class="w-40 border-0"
                @update:model-value="selectLocale"
            >
                <template #option="{ option }">
                    <span :data-locale="option.value">{{ option.label }}</span>
                </template>
            </Listbox>
        </Popover>
    </div>
</template>
```

구현 주의사항:

- `open`을 `togglePanel` 안에서 직접 뒤집지 않는다. 바깥 클릭·ESC로 닫힐 때 `aria-expanded`가 어긋난다. `@show`/`@hide`가 단일 출처다.
- `useI18n`은 Nuxt i18n이 전역 자동 임포트하므로 import 문을 추가하지 않는다(교체 전 파일과 동일).
- `<style>` 블록을 추가하지 않는다. 스타일은 Tailwind 유틸리티만 쓴다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run:

```bash
cd it_frontend && npx vitest run tests/unit/components/LocaleSwitcher.test.ts
```

Expected: 5 passed. `Failed to resolve component: Popover` 경고가 남아 있으면 `global.stubs` 이름(`Popover`, `Listbox`)이 템플릿의 태그명과 정확히 일치하는지 확인한다.

- [ ] **Step 5: 커밋한다**

```bash
cd it_frontend && git add app/components/common/LocaleSwitcher.vue tests/unit/components/LocaleSwitcher.test.ts && git commit -m "feat(i18n): 언어 선택기를 Language 아이콘 + Popover Listbox로 전환"
```

> `C:\it`는 문서만 추적하고 `it_frontend`는 별도 원격 저장소다(`CLAUDE.md` §2). 반드시 `it_frontend` 안에서 커밋한다.

---

### Task 2: 품질 게이트와 두 화면 시각 확인

**Files:**

- 코드 변경 없음. Task 1 결과물을 저장소 게이트와 실제 렌더링으로 검증한다.

**Interfaces:**

- Consumes: Task 1이 만든 `LocaleSwitcher.vue`의 DOM 계약(`[data-testid="locale-switcher-trigger"]`, `[data-locale]`)
- Produces: 없음 (검증 전용)

- [ ] **Step 1: 포맷 검사**

Run:

```bash
cd it_frontend && npm run format:check
```

Expected: PASS. 실패하면 `npx prettier --write app/components/common/LocaleSwitcher.vue tests/unit/components/LocaleSwitcher.test.ts`로 고치고 다시 실행한다.

- [ ] **Step 2: 타입 검사와 ESLint**

Run:

```bash
cd it_frontend && npm run check
```

Expected: PASS. `Popover`/`Listbox`의 전역 컴포넌트 타입은 `@primevue/nuxt-module`이 `.nuxt/components.d.ts`에 생성한다. 타입을 못 찾는다는 오류가 나면 `npm run postinstall`(= `nuxt prepare`)로 타입을 재생성한 뒤 다시 실행한다.

- [ ] **Step 3: 스타일 린트**

Run:

```bash
cd it_frontend && npm run lint:css
```

Expected: PASS. Task 1은 `<style>` 블록을 추가하지 않으므로 이 컴포넌트에서 새 위반이 나오면 안 된다.

- [ ] **Step 4: 프론트 단위 테스트 전체**

Run:

```bash
cd it_frontend && npm test
```

Expected: PASS. 특히 `tests/unit/architecture/component-boundaries.test.ts`가 통과해야 한다 — 이 계획은 파일을 추가·이동하지 않으므로 목록 갱신은 필요 없지만, 실패한다면 컴포넌트를 옮기지 않았는지 확인한다.

- [ ] **Step 5: 두 화면에서 실제 렌더링을 확인한다**

프론트(`npm run dev`, http://localhost:3000)와 백엔드(`./gradlew bootRun`, http://localhost:28080)를 모두 띄운 뒤 Playwright MCP로 확인한다.

확인 항목:

1. `/login` — 우측 상단 아이콘이 테마 토글과 나란히 정렬되는가, Popover가 화면 밖으로 잘리지 않는가
2. 로그인 후 헤더 — 아이콘 클릭 → Listbox 표시 → `English` 선택 → 헤더·메뉴 문구가 영어로 바뀌고 Popover가 닫히는가
3. 다시 아이콘 클릭 → `English`가 선택 상태로 표시되는가
4. 다크 모드에서 트리거 hover 배경과 Listbox 대비가 읽히는가

Aura preset 기본 스타일이 어색하면 `Listbox`의 `class`(현재 `w-40 border-0`)만 조정하고, 전역 `primevue.css`는 건드리지 않는다.

- [ ] **Step 6: 시각 조정이 있었다면 커밋한다**

```bash
cd it_frontend && git add app/components/common/LocaleSwitcher.vue && git commit -m "style(i18n): 언어 선택 Popover Listbox 폭·여백 보정"
```

조정이 없었으면 이 단계를 건너뛴다.

---

## 계획 자체 점검 결과

- **스펙 커버리지:** 스펙 §3(아이콘 선택)은 Task 1 Step 3의 `pi pi-language`, §4.1~4.3(구조·상태·선택 처리)은 Task 1 Step 3, §5(접근성)는 Task 1 Step 1의 테스트 1·2번과 Step 3의 트리거 속성, §6(테스트)은 Task 1 Step 1, §7(검증 명령)은 Task 2 Step 1~4, §8(위험)은 Task 2 Step 5에 각각 대응한다. 스펙 §2.2 제외 항목은 Global Constraints에 못 박았다.
- **스펙 §6 대비 테스트 1건 추가:** 스펙은 검증 4건을 적었으나, 계획에서는 `data-locale` 슬롯 계약과 `aria-selected` 표시를 따로 확인하는 테스트를 하나 더 뒀다(총 5건). 슬롯을 지우면 스펙 §5의 테스트 훅이 조용히 사라지기 때문이다.
- **타입·이름 일관성:** `popoverRef`, `open`, `changing`, `localeOptions`, `togglePanel`, `selectLocale`, `[data-testid="locale-switcher-trigger"]`, `[data-locale]`, `[data-option]`이 Task 1과 Task 2에서 동일한 철자로 쓰인다. 테스트 스텁이 만드는 `data-option`은 스텁 전용 훅이고, 컴포넌트가 만드는 `data-locale`은 운영 코드 계약이다 — 둘을 섞지 않는다.
