# Phase C — 프론트 오류 상태 (ERR-10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 통화 조회를 공용 `useProjectCurrencies`로 통합하고, PDF 미리보기·검토 상태 동기화·Tiptap 토큰 해석의 실패를 "정상 빈 결과"와 구분되게 표면화하여 ERR-10과 CLAUDE.md 프론트 §2/§4/§6 위반을 동시에 해소한다.

**Architecture:** 화면별 인라인 복제 로직(통화 CUR 조회·PDF 유효성·오류 분류)을 순수 컴포저블/유틸로 끌어올려 로직 레벨 Vitest로 검증하고, 컴포넌트는 그 결과를 `useToast`/PrimeVue `Message`/인라인 배너로 표면화한다. 스토어·컴포저블은 오류 상태(ref)만 반환하고 toast 직접 호출을 하지 않으며, 표면화·재시도·stale 차단은 컴포넌트 계층에서 수행한다. 신규 오류 상태는 기존 재시도 `Message` 모델(`metadataError`)과 `warnOncePerMinute`(useTableCellSelection) 스로틀 선례를 그대로 준용한다.

**Tech Stack:** Nuxt 4, Vue 3 (script setup, TypeScript), PrimeVue (useToast/Message), Vitest

---

## File Structure

```
it_frontend/
├── app/
│   ├── composables/
│   │   ├── useProjectCurrencies.ts        # (수정) currencyAutoFillMap 추가 + previewRates 유지
│   │   ├── useTiptapVariables.ts          # (수정) resolveInsertedToken STALE→ERROR 승격
│   │   └── costListPageHelpers.ts         # (참조) parseCurrencyRate/parseFstDfrDt 재사용
│   ├── components/
│   │   ├── TiptapEditor.vue               # (수정) variableResolveError + Message + 재시도 + 스로틀
│   │   ├── VariableNodeView.vue           # (수정) 'ERROR' 상태 칩 렌더 + CSS
│   │   ├── cost/TerminalFormDialog.vue    # (수정) 인라인 CUR 제거 → 컴포저블, .catch 스왈로 제거
│   │   └── council/result/ResultReviewProgress.vue  # (수정) 오류 분류 + 스로틀 toast + 재시도
│   ├── pages/info/
│   │   ├── cost/form.vue                  # (수정) 인라인 CUR 제거 → 컴포저블 + 인라인 오류/재시도
│   │   └── projects/report.vue           # (수정) 빈-URL 오류 상태 + submit 가드
│   ├── features/approval/
│   │   └── reportPdfGuards.ts             # (신규) PDF 유효성 순수 가드
│   ├── utils/
│   │   └── statusSyncError.ts             # (신규) 검토 동기화 오류 분류 순수 함수
│   └── types/
│       └── tiptapVariable.ts              # (수정) ClientStatus에 'ERROR' 추가
└── tests/unit/
    ├── composables/
    │   ├── useProjectCurrencies.test.ts   # (수정) currencyAutoFillMap + loadError 확장
    │   └── useTiptapVariables.test.ts     # (수정) resolveInsertedToken ERROR + STALE 하위호환 가드
    ├── components/
    │   ├── VariableNodeView.test.ts       # (수정) 'ERROR' 칩 렌더 케이스
    │   └── editor-error-state.test.ts     # (수정) useTiptapVariables 스텁에 resolveTokens 추가
    ├── features/approval/
    │   └── reportPdfGuards.test.ts        # (신규) isPdfReadyForSubmit 분기
    └── utils/
        └── statusSyncError.test.ts        # (신규) classifyStatusSyncError 4xx/5xx/네트워크
```

**공통 규약**
- 모든 명령은 `it_frontend`에서 실행: `cd C:/it/it_frontend && npm test -- <file>`, `npm run check`.
- `it_frontend`는 중첩 git 저장소이므로 커밋도 내부에서: `cd C:/it/it_frontend && git commit -m "..."`.
- 신규 주석은 한글(CLAUDE.md §4.1). TDD: 각 테스트는 먼저 **FAIL**을 확인한 뒤 구현으로 **PASS**시킨다.

---

## Task 1 — `useProjectCurrencies` 확장 (currencyAutoFillMap 추가, previewRates 유지)

두 화면의 인라인 CUR 조회를 흡수할 수 있도록 컴포저블이 `currencyOptions`/`previewRates`에 더해 cost/form이 쓰는 `currencyAutoFillMap`(CDVA_ID → { 환율, 환율기준일자 })까지 산출하게 확장한다. 기존 반환 필드는 모두 유지하여 두 소비자(`pages/info/projects/form.vue`, `pages/project/bizplan/[abusMngNo].vue`)와 하위 호환을 보장한다.

**Files:**
- `it_frontend/app/composables/useProjectCurrencies.ts` (전체 재작성 — 현재 1-70)
- `it_frontend/app/composables/costListPageHelpers.ts:95` `parseFstDfrDt`, `:113` `parseCurrencyRate` (재사용)
- `it_frontend/tests/unit/composables/useProjectCurrencies.test.ts` (loadError 54-68 확장 + 신규 케이스)

**하위 호환 확인 (구현 전 필수):**
- `pages/info/projects/form.vue:69-75` → `{ currencyOptions, previewRates, loading, loadError, loadCurrencyOptions }` 소비. 모두 유지됨.
- `pages/project/bizplan/[abusMngNo].vue:107-112` → `{ currencyOptions, loading, loadError, loadCurrencyOptions }` 소비. 모두 유지됨.
- 신규 `currencyAutoFillMap`는 **추가(additive)**이므로 두 소비자를 깨지 않는다.
- `currencyAutoFillMap`의 키는 `currencyOptions`/`previewRates`와 동일한 `code`(= `cdva || cdvaDtl`)로 맞춰 세 산출물의 키가 항상 정합하게 한다(실데이터에서 `cdva`가 항상 채워지므로 cost/form의 기존 `cdva`-기준 키와 동치).

**Steps:**

- [ ] **(RED)** `tests/unit/composables/useProjectCurrencies.test.ts`에 `currencyAutoFillMap` 검증을 추가하고 실패를 확인한다. 기존 파일 상단 스텁(`mockApiFetch`, `useNuxtApp`, `useRuntimeConfig`)은 그대로 두고, 아래 두 케이스를 `describe` 블록 안에 추가한다.

```ts
    it('currencyAutoFillMap에 환율·환율기준일자를 CDVA_ID 기준으로 채운다', async () => {
        // Arrange: cdvaDtlC=환율, cdvaDtl=환율기준일자(YYYYMMDD)
        mockApiFetch.mockResolvedValue([
            { cdva: 'KRW', cdvaDtl: '20260101', cdvaDtlC: '1' },
            { cdva: 'USD', cdvaDtl: '20260701', cdvaDtlC: '1,380.5' },
            { cdva: 'JPY', cdvaDtl: '', cdvaDtlC: 'not-number' },
        ]);

        const currencies = useProjectCurrencies();
        await currencies.loadCurrencyOptions();

        // KRW는 자동입력 맵에서 제외(원화는 환율/기준일 미적용)
        expect(currencies.currencyAutoFillMap.value.KRW).toBeUndefined();
        expect(currencies.currencyAutoFillMap.value.USD.xcr).toBe(1380.5);
        expect(currencies.currencyAutoFillMap.value.USD.xcrBseDt).toBeInstanceOf(Date);
        // 파싱 불가 환율은 null, 빈 기준일은 ''
        expect(currencies.currencyAutoFillMap.value.JPY.xcr).toBeNull();
        expect(currencies.currencyAutoFillMap.value.JPY.xcrBseDt).toBe('');
    });

    it('API 실패 시 currencyAutoFillMap은 빈 객체를 유지한다', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockApiFetch.mockRejectedValue(new Error('network'));

        const currencies = useProjectCurrencies();
        await currencies.loadCurrencyOptions();

        expect(currencies.currencyAutoFillMap.value).toEqual({});
        expect(currencies.loadError.value).toBe(true);
        warnSpy.mockRestore();
    });
```

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/composables/useProjectCurrencies.test.ts` → **FAIL** (currencyAutoFillMap 미존재) 확인.

- [ ] **(GREEN)** `app/composables/useProjectCurrencies.ts`를 아래 전체 코드로 교체한다.

```ts
import { ref } from 'vue';

import { parseCurrencyRate, parseFstDfrDt } from '~/composables/costListPageHelpers';

/** Ccodem CUR 단일 응답 형태 (cdvaDtlC=환율/CO_CDVA_NM, cdvaDtl=환율기준일자/CO_CDVA_SPS) */
interface CcodemCurrencyItem {
    cdva?: string;
    cdvaDtl?: string | null;
    cNm?: string | null;
    cdvaDtlC?: string | null;
}

/** 통화별 자동입력 정보: CDVA_ID → { 환율, 환율기준일자 } */
export interface CurrencyAutoFill {
    xcr: number | null;
    xcrBseDt: Date | '';
}

/**
 * 정보화사업 소요자원 입력용 통화 목록·미리보기 환율·자동입력 맵을 제공합니다.
 *
 * @returns 통화 선택지·미리보기 환율·자동입력 맵·조회 진행·오류 상태와 재조회 함수
 * @remarks 최초 조회와 재조회 실패는 throw하지 않고 loadError를 true로 설정하며 KRW 기본값을 유지합니다.
 */
export const useProjectCurrencies = () => {
    const { $apiFetch } = useNuxtApp();
    const runtimeConfig = useRuntimeConfig();

    /** 통화 선택지 (KRW 우선) */
    const currencyOptions = ref<string[]>(['KRW']);

    /** 통화별 미리보기 환율 맵 (KRW=1) */
    const previewRates = ref<Record<string, number>>({ KRW: 1 });

    /** 통화별 자동입력 맵 (CDVA_ID → 환율/환율기준일자, cost/form 단건 폼 자동입력용) */
    const currencyAutoFillMap = ref<Record<string, CurrencyAutoFill>>({});

    /** 통화 목록 조회 진행 여부 */
    const loading = ref(false);
    /** 통화 목록 조회 실패 여부 */
    const loadError = ref(false);

    /**
     * Ccodem CUR 목록을 호출해 통화 선택지·미리보기 환율·자동입력 맵을 갱신합니다.
     *
     * @returns 완료 Promise. 실패 시 기본 KRW 선택지와 빈 자동입력 맵을 유지합니다.
     */
    const loadCurrencyOptions = async () => {
        loading.value = true;
        loadError.value = false;
        try {
            const base = `${runtimeConfig.public.apiBase}/api/ccodem`;
            const list = await $apiFetch<CcodemCurrencyItem[]>(`${base}/CUR_C`);
            const rates: Record<string, number> = { KRW: 1 };
            const fillMap: Record<string, CurrencyAutoFill> = {};
            const codes: string[] = [];
            for (const currency of list ?? []) {
                const code = currency.cdva || currency.cdvaDtl || '';
                if (!code || code === 'KRW') continue;
                codes.push(code);
                // 미리보기 환율: 콤마 없는 단순 숫자 파싱(소비부에서 rate>0 가드)
                const rate = Number(currency.cdvaDtlC);
                if (Number.isFinite(rate)) rates[code] = rate;
                // 자동입력 맵: 콤마 허용 파싱 + 환율기준일자(Date) — cost/form 단건 폼 자동입력용
                const parsedDt = currency.cdvaDtl ? parseFstDfrDt(String(currency.cdvaDtl)) : '';
                fillMap[code] = {
                    xcr: parseCurrencyRate(currency.cdvaDtlC),
                    xcrBseDt: parsedDt instanceof Date ? parsedDt : '',
                };
            }
            previewRates.value = rates;
            currencyAutoFillMap.value = fillMap;
            currencyOptions.value = ['KRW', ...codes];
        } catch (error) {
            loadError.value = true;
            console.warn('[ProjectCurrencies] 통화 목록 조회 실패', error);
        } finally {
            loading.value = false;
        }
    };

    loadCurrencyOptions();

    return {
        currencyOptions,
        previewRates,
        currencyAutoFillMap,
        loading,
        loadError,
        loadCurrencyOptions,
    };
};
```

> 주의: `currencyAutoFillMap` 키는 `cdvaDtl`을 환율기준일자로 해석해 `xcrBseDt`를 채우면서, 동시에 `code` 폴백에도 `cdvaDtl`을 사용한다. 실데이터는 `cdva`(통화코드)가 항상 채워지므로 `code === cdva`이고 두 해석이 충돌하지 않는다(기존 cost/form 동작과 동치). 이 정합성은 위 Vitest가 검증한다.

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/composables/useProjectCurrencies.test.ts` → **PASS**.
- [ ] `cd C:/it/it_frontend && npm run check` → 통과.
- [ ] **(COMMIT)** `cd C:/it/it_frontend && git commit -am "feat: useProjectCurrencies에 currencyAutoFillMap 산출 추가 (ERR-10)"`

---

## Task 2 — `cost/form.vue` 통화 컴포저블 이관 + 인라인 오류/재시도

인라인 `loadCurrencyOptions`(205-227)·`currencyOptions` ref(198)·`currencyAutoFillMap` ref(200)·`CcodemCurItem`(192-196)를 제거하고 공용 컴포저블로 대체한다. `loadError`를 인라인 `Message`+재시도로 표면화한다(선례 `projects/form.vue:1211-1220`). 컴포넌트 mount 없는 로직 이동이므로 이 Task 자체의 신규 Vitest는 없고 회귀는 Task 1의 컴포저블 테스트가 담당한다(수동 QA는 Task 7).

**Files:**
- `it_frontend/app/pages/info/cost/form.vue`
  - import 39 (`parseCurrencyRate` 제거), script 190-227 (인라인 CUR 블록 제거 → 컴포저블), 147/267 (`currencyAutoFillMap` 참조 유지), template 795-812 근처(오류 Message 삽입)

**Steps:**

- [ ] `app/pages/info/cost/form.vue:39` import에서 `parseCurrencyRate`를 제거한다(컴포저블로 이동하여 페이지에서 미사용). `parseFstDfrDt`는 378/381/405/408/595에서 계속 사용하므로 유지.

```ts
import { parseFstDfrDt } from '~/composables/costListPageHelpers';
```

- [ ] `app/pages/info/cost/form.vue`에 컴포저블 import를 추가한다(기존 import 블록 하단, 예: `useCost` import 근처 36행 이후).

```ts
import { useProjectCurrencies } from '~/composables/useProjectCurrencies';
```

- [ ] `190-227`의 통화 인라인 블록 전체(주석 `/* ── 통화 옵션 ... */`, `CcodemCurItem` interface, `currencyOptions` ref, `currencyAutoFillMap` ref, `loadCurrencyOptions` 함수, `loadCurrencyOptions();` 호출)를 아래 컴포저블 소비로 교체한다.

```ts
/* ── 통화 옵션 (공용 useProjectCurrencies 통합 — ERR-10 / CLAUDE.md §4) ── */
const {
    currencyOptions,
    currencyAutoFillMap,
    loading: currencyLoading,
    loadError: currencyLoadError,
    loadCurrencyOptions,
} = useProjectCurrencies();
```

> `currencyAutoFillMap`는 `terminalTotalAmt`(147: `currencyAutoFillMap.value[t.curC]?.xcr`)와 `onCurrencyChange`(267: `currencyAutoFillMap.value[code]`)에서 그대로 참조된다 — 타입(`Record<string, { xcr: number|null; xcrBseDt: Date|'' }>`)이 동일하므로 소비부 수정 불필요.

- [ ] 통화 `Select`(805-812) 위에 통화 조회 오류 인라인 `Message`+재시도를 추가한다(단건 수정 폼 통화 필드 블록 상단, 795-798의 `<label>통화</label>` 다음). `projects/form.vue:1211-1220` 마크업을 준용한다.

```html
                            <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                                >통화</label
                            >
                            <Message
                                v-if="currencyLoadError"
                                severity="warn"
                                :closable="false"
                                class="mb-1"
                            >
                                통화 목록을 불러오지 못해 KRW만 표시합니다.
                                <Button
                                    label="다시 시도"
                                    text
                                    size="small"
                                    :loading="currencyLoading"
                                    @click="loadCurrencyOptions"
                                />
                            </Message>
```

- [ ] `cd C:/it/it_frontend && npm run check` → 통과(미사용 import·타입 확인).
- [ ] **(COMMIT)** `cd C:/it/it_frontend && git commit -am "refactor: cost/form 통화 조회를 useProjectCurrencies로 통합 + 오류/재시도 표면화 (ERR-10)"`

---

## Task 3 — `TerminalFormDialog.vue` 통화 컴포저블 이관 + `.catch(()=>[])` 스왈로 제거

로컬 `currencyOptions`/`previewRates` ref와 `loadOptions`(155-183) 내부 CUR 인라인 조회·`.catch(()=>[])`(161-165)를 제거한다. 통화는 공용 컴포저블로 조회하고, 실패 시 기존 `loadAll` catch(254-266)의 `loadError`+toast+재시도 버튼(템플릿 407-420) 경로로 편입한다.

**Files:**
- `it_frontend/app/components/cost/TerminalFormDialog.vue`
  - script 66-91 (import·CcodemCurItem·currencyOptions·previewRates), 155-183 (loadOptions), 119 (rowKrwAmount `previewRates` 참조 유지), 254-266 (loadAll catch — 유지)

**Steps:**

- [ ] `app/components/cost/TerminalFormDialog.vue:21` 근처 import 블록에 컴포저블 import를 추가한다.

```ts
import { useProjectCurrencies } from '~/composables/useProjectCurrencies';
```

- [ ] `76-81`의 로컬 `CcodemCurItem` interface, `84`의 `currencyOptions` ref, `91`의 `previewRates` ref를 제거하고, `useNuxtApp`/`config` 선언(66-67) 아래에 컴포저블 소비를 추가한다.

```ts
const { $apiFetch } = useNuxtApp();
const config = useRuntimeConfig();

/* 통화 목록·미리보기 환율은 공용 useProjectCurrencies로 조회 (ERR-10 / CLAUDE.md §4) */
const {
    currencyOptions,
    previewRates,
    loadError: currencyLoadError,
    loadCurrencyOptions,
} = useProjectCurrencies();
```

> `previewRates`는 `rowKrwAmount`(119: `previewRates.value[row.curC] ?? 0`)에서 그대로 참조되며 소비부의 `rate > 0` 가드가 이미 존재하므로 컴포저블 산출(가드 없음)과도 안전하다. 다이얼로그 자체의 데이터 로드 오류용 `loadError` ref(96)는 통화용 `currencyLoadError`와 별개이므로 유지한다.

- [ ] `loadOptions`(155-183)를 아래로 교체한다 — Promise.all에서 CUR 호출을 제거하고 나머지 3개 코드만 병렬 로드한 뒤, 공용 컴포저블로 통화를 조회하고 실패 시 throw하여 `loadAll` 오류 경로로 전파한다.

```ts
const loadOptions = async () => {
    const base = `${config.public.apiBase}/api/ccodem`;
    const [dfrCleCList, tmnSvcList, tmnKdList] = await Promise.all([
        $apiFetch<CodeOption[]>(`${base}/DFR_CLE_C`),
        $apiFetch<CodeOption[]>(`${base}/IT_PTL_TMN_SVC_TC`),
        $apiFetch<CodeOption[]>(`${base}/IT_PTL_TMN_KD_TC`),
    ]);
    dfrCleCOptions.value = dfrCleCList;
    tmnSvcOptions.value = tmnSvcList;
    tmnKdOptions.value = tmnKdList ?? [];
    // 통화 목록은 공용 컴포저블로 조회한다. 실패를 빈 목록 성공으로 삼키지 않고
    // loadError를 상위 loadAll의 오류 화면·재시도 경로로 전파한다.
    await loadCurrencyOptions();
    if (currencyLoadError.value) {
        throw new Error('통화 목록(Ccodem CUR) 로드 실패');
    }
};
```

> `loadOptions`의 JSDoc(146-154) "실패 조건: Ccodem CUR 호출 실패 시 currencyOptions는 ['KRW']만 유지 + 콘솔 경고" 문구를 "통화 조회 실패 시 currencyLoadError를 상위 loadAll로 전파"로 현행화한다(CLAUDE.md §4.1 주석 현행화).

- [ ] `cd C:/it/it_frontend && npm run check` → 통과.
- [ ] **(COMMIT)** `cd C:/it/it_frontend && git commit -am "refactor: TerminalFormDialog 통화 조회를 useProjectCurrencies로 통합, .catch 스왈로 제거 (ERR-10)"`

---

## Task 4 — Tiptap 토큰 해석 실패 전용 상태 `'ERROR'` 도입

**미결 항목 #5 확정:** 실패 상태 명칭은 **`'ERROR'`**로 확정한다(`STALE`=이전/작성 시점 값 표시, `ERROR`=값 없이 해석 실패로 명확히 구분). 칩은 `MISSING`/`INVALID`와 구분되도록 `pi pi-exclamation-triangle` 아이콘 + 전용 클래스로 렌더한다.

**하위 호환 결정 (중요):** `resolveTokens`의 네트워크 오류 반환(`'STALE'`)은 **변경하지 않는다**. `pages/board/[blbMngNo]/[nacMngNo]/index.vue:66`, `pages/info/documents/[id]/index.vue`, `pages/info/plan/[id].vue`, `pages/guide/index.vue`의 읽기 전용 렌더러가 `resolveTokens` 실패 시 `STALE → snapshot` 폴백에 의존하기 때문이다(저장 문서의 "작성 시점 값 표시"는 정상 동작). 에디터에서 **새로 삽입된 토큰**은 snapshot이 없어 `STALE`이 무의미하므로, 단일 삽입 토큰 경로(`resolveInsertedToken`)에서만 `STALE`(=네트워크 실패)을 `ERROR`로 승격한다. 이로써 `resolveTokens`의 기존 계약(및 테스트 165행)을 보존하면서 에디터 경로의 의미 중첩만 해소한다.

**Files:**
- `it_frontend/app/types/tiptapVariable.ts:13` (`ClientStatus` 유니온)
- `it_frontend/app/composables/useTiptapVariables.ts:119-144` (resolveTokens — 불변), `:151-161` (resolveInsertedToken — 승격)
- `it_frontend/app/components/VariableNodeView.vue:26-48`(displayText/tooltip), `:53-66`(템플릿), `:69-133`(CSS)
- `it_frontend/app/components/TiptapEditor.vue:201-206`(destructure), `:208-228`(오류 상태·스로틀), `:241-277`(resolveMissingVariables), `:524-534`(Message)
- `it_frontend/tests/unit/composables/useTiptapVariables.test.ts` (신규 케이스 + 165행 하위호환 가드)
- `it_frontend/tests/unit/components/VariableNodeView.test.ts` (ERROR 케이스)
- `it_frontend/tests/unit/components/editor-error-state.test.ts:88-93` (스텁에 resolveTokens 추가)

**Steps:**

- [ ] **(RED)** `tests/unit/composables/useTiptapVariables.test.ts`에 아래 케이스를 추가한다. 첫 케이스는 승격을, 둘째는 `resolveTokens`의 STALE 계약이 **유지**됨을 고정한다(읽기 전용 페이지 하위호환 가드). 두 케이스 모두 `resetModules` 격리를 쓰는 두 번째 `describe`(35행) 스타일을 그대로 따른다.

```ts
    it('resolveInsertedToken은 네트워크 실패(STALE)를 ERROR로 승격한다', async () => {
        fetchMock.mockRejectedValue(new Error('network down'));
        const { useTiptapVariables } = await import('~/composables/useTiptapVariables');
        const { resolveInsertedToken } = useTiptapVariables();
        const result = await resolveInsertedToken('2026.itBudget.requestAmount', new Map());
        // 새로 삽입된 토큰은 snapshot이 없으므로 STALE이 아닌 ERROR로 표기
        expect(result.get('2026.itBudget.requestAmount')).toEqual({ value: '', status: 'ERROR' });
    });

    it('resolveTokens는 하위호환을 위해 네트워크 실패에서 STALE을 유지한다', async () => {
        // 읽기 전용 페이지(board/documents/plan/guide)가 STALE→snapshot 폴백에 의존하므로 불변
        fetchMock.mockRejectedValue(new Error('network down'));
        const { useTiptapVariables } = await import('~/composables/useTiptapVariables');
        const { resolveTokens } = useTiptapVariables();
        const result = await resolveTokens(['2026.itBudget.requestAmount']);
        expect(result['2026.itBudget.requestAmount']?.status).toBe('STALE');
    });
```

- [ ] `tests/unit/components/VariableNodeView.test.ts`에 ERROR 렌더 케이스를 추가한다(기존 `describe` 안).

```ts
    it('ERROR 상태에서 경고 아이콘 + 토큰 노출', () => {
        const wrapper = mount(VariableNodeView, { props: makeProps('ERROR') });
        expect(wrapper.attributes('data-status')).toBe('ERROR');
        expect(wrapper.text()).toContain('{2026.itBudget.requestAmount}');
        expect(wrapper.find('.pi-exclamation-triangle').exists()).toBe(true);
    });
```

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/composables/useTiptapVariables.test.ts tests/unit/components/VariableNodeView.test.ts` → **FAIL**(ERROR 미지원) 확인.

- [ ] **(GREEN)** `app/types/tiptapVariable.ts:13`의 `ClientStatus`에 `'ERROR'`를 추가한다.

```ts
/** 클라이언트 표시 상태 (서버 상태 + 네트워크·로딩·해석 실패 상태) */
export type ClientStatus = ServerStatus | 'LOADING' | 'STALE' | 'ERROR';
```

- [ ] `app/composables/useTiptapVariables.ts`의 `resolveInsertedToken`(151-161)을 아래로 교체한다(`resolveTokens`는 그대로 둔다).

```ts
    const resolveInsertedToken = async (
        token: string,
        currentValues: Map<string, ResolvedValue> = new Map(),
    ): Promise<Map<string, ResolvedValue>> => {
        const nextValues = new Map(currentValues);
        nextValues.set(token, { value: '', status: 'LOADING' });

        const resolved = await resolveTokens([token]);
        const entry = resolved[token] ?? { value: '', status: 'MISSING' };
        // 새로 삽입된 토큰은 snapshot이 없어 STALE(작성 시점 값 표시)이 무의미하다.
        // resolveTokens는 네트워크 실패에서만 STALE을 반환하므로, 단일 삽입 토큰의 STALE은
        // 일시 오류로 판단해 ERROR로 승격한다(권한없음·데이터없음은 그대로 유지).
        const normalized: ResolvedValue =
            entry.status === 'STALE' ? { value: '', status: 'ERROR' } : entry;
        nextValues.set(token, normalized);
        return nextValues;
    };
```

- [ ] `app/composables/useTiptapVariables.ts:148`의 `resolveInsertedToken` JSDoc "OK/MISSING/FORBIDDEN/INVALID/STALE을 덮어쓴다"를 "OK/MISSING/FORBIDDEN/INVALID로 덮어쓰고, 네트워크 실패는 ERROR로 표기한다"로 현행화한다.

- [ ] `app/components/VariableNodeView.vue`의 `displayText`(26-32)와 `tooltip`(34-48)에 `ERROR`를 추가한다.

```ts
const displayText = computed(() => {
    const { value, status } = resolved.value;
    if (status === 'OK' || status === 'STALE') return value || `{${token.value}}`;
    if (
        status === 'MISSING' ||
        status === 'FORBIDDEN' ||
        status === 'INVALID' ||
        status === 'ERROR'
    )
        return `{${token.value}}`;
    return '';
});

const tooltip = computed(() => {
    const { status } = resolved.value;
    return (
        (
            {
                OK: token.value,
                LOADING: '값 조회 중...',
                MISSING: '해당 데이터 없음',
                FORBIDDEN: '권한 없음',
                STALE: '최신값 조회 실패 — 작성 시점 값 표시',
                INVALID: '잘못된 변수 토큰',
                ERROR: '변수 값을 불러오지 못했습니다 — 다시 시도해 주세요',
            } as Record<string, string>
        )[status] ?? token.value
    );
});
```

- [ ] `app/components/VariableNodeView.vue` 템플릿(63-65)에 ERROR 아이콘을 추가한다.

```html
        <i v-if="resolved.status === 'FORBIDDEN'" class="pi pi-lock" />
        <i v-if="resolved.status === 'ERROR'" class="pi pi-exclamation-triangle" />
        <span v-if="resolved.status === 'LOADING'" class="tiptap-variable-skeleton" />
        <template v-else>{{ displayText }}</template>
```

- [ ] `app/components/VariableNodeView.vue` `<style>`에 `--error` 클래스를 추가한다(`--invalid` 규칙 105-109 다음). `MISSING`/`INVALID`와 구분되도록 outline + 아이콘을 부여한다.

```css
.tiptap-variable-chip--error {
    background: rgba(220, 38, 38, 0.15);
    color: #b91c1c;
    font-family: monospace;
    outline: 1px solid rgba(220, 38, 38, 0.45);
}
.tiptap-variable-chip--error .pi {
    font-size: 0.85em;
}
```

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/composables/useTiptapVariables.test.ts tests/unit/components/VariableNodeView.test.ts` → **PASS**.

- [ ] `app/components/TiptapEditor.vue`의 useTiptapVariables destructure(201-206)에 `resolveTokens`를 추가한다.

```ts
const {
    loadMetadata,
    metadata: variableMetadata,
    resolveInsertedToken,
    resolveTokens,
    extractTokens,
} = useTiptapVariables();
```

- [ ] `app/components/TiptapEditor.vue`의 `metadataError` 선언(208-210) 아래에 변수 해석 오류 상태와 분당 1회 진단 스로틀을 추가한다(선례 `useTableCellSelection.ts:101-108`).

```ts
/** 변수 카탈로그 조회 진행 및 실패 상태 */
const metadataLoading = ref(false);
const metadataError = ref(false);

/** 변수 토큰 해석 실패(권한·데이터·일시 오류) 표면화 상태 */
const variableResolveError = ref(false);

let lastVariableWarnAt = 0;
/** 변수 해석 실패 진단 로그를 분당 1회로 제한합니다(선례 useTableCellSelection warnOncePerMinute). */
const warnVariableResolveOncePerMinute = (message: string, detail: unknown) => {
    const now = Date.now();
    if (now - lastVariableWarnAt < 60_000) return;
    lastVariableWarnAt = now;
    console.warn(message, detail);
};
```

- [ ] `app/components/TiptapEditor.vue`의 `resolveMissingVariables` 내부 `.then`/`.catch`(257-275)를 아래로 교체한다. 해석 결과가 `ERROR`면 배너 노출 + 스로틀 진단, `.catch`(예상치 못한 예외)도 `STALE` 대신 `ERROR`로 표기한다.

```ts
        resolveInsertedToken(token, loadingValues)
            .then((resolvedValues) => {
                const latestValues = new Map<string, ResolvedValue>(
                    tiptapVariable.values ?? new Map(),
                );
                const entry = resolvedValues.get(token) ?? {
                    value: '',
                    status: 'MISSING' as const,
                };
                latestValues.set(token, entry);
                tiptapVariable.values = latestValues;
                if (entry.status === 'ERROR') {
                    // 일시 오류·권한 실패를 이전값(STALE)과 구분해 사용자에게 표면화한다.
                    variableResolveError.value = true;
                    warnVariableResolveOncePerMinute('[TiptapEditor] 변수 토큰 해석 실패', token);
                }
            })
            .catch((error) => {
                // 예상치 못한 예외 — STALE로 뭉개지 않고 ERROR로 표기해 재시도를 유도한다.
                const errorValues = new Map<string, ResolvedValue>(
                    tiptapVariable.values ?? new Map(),
                );
                errorValues.set(token, { value: '', status: 'ERROR' });
                tiptapVariable.values = errorValues;
                variableResolveError.value = true;
                warnVariableResolveOncePerMinute('[TiptapEditor] 변수 토큰 해석 예외', error);
            });
```

- [ ] `app/components/TiptapEditor.vue`에 ERROR 토큰 재해석 함수를 추가한다(`resolveMissingVariables` 함수 정의 직후, 277행 이후).

```ts
/**
 * ERROR 상태 변수 토큰을 다시 해석하고, 모두 해소되면 오류 배너를 내립니다.
 * @remarks resolveTokens는 네트워크 실패에서 STALE을 반환하므로 재시도 실패는 ERROR로 유지한다.
 */
const retryVariableResolution = async () => {
    const storage = editor.value?.storage as unknown as TiptapVariableStorage | undefined;
    const tiptapVariable = storage?.tiptapVariable;
    if (!tiptapVariable) return;

    const current = (tiptapVariable.values ?? new Map()) as Map<string, ResolvedValue>;
    const erroredTokens = [...current.entries()]
        .filter(([, entry]) => entry.status === 'ERROR')
        .map(([token]) => token);
    if (erroredTokens.length === 0) {
        variableResolveError.value = false;
        return;
    }

    const resolved = await resolveTokens(erroredTokens);
    const next = new Map<string, ResolvedValue>(tiptapVariable.values ?? new Map());
    let hasRemainingError = false;
    for (const token of erroredTokens) {
        const entry = resolved[token] ?? { value: '', status: 'MISSING' };
        const normalized: ResolvedValue =
            entry.status === 'STALE' ? { value: '', status: 'ERROR' } : entry;
        if (normalized.status === 'ERROR') hasRemainingError = true;
        next.set(token, normalized);
    }
    tiptapVariable.values = next;
    variableResolveError.value = hasRemainingError;
};
```

- [ ] `app/components/TiptapEditor.vue` 템플릿의 `metadataError` Message(524-534) 다음에 변수 해석 오류 Message를 추가한다(동일 모델 준용).

```html
        <Message v-if="variableResolveError" severity="warn" :closable="false">
            일부 변수 값을 불러오지 못했습니다.
            <Button
                data-testid="retry-variable-resolution"
                label="다시 시도"
                text
                size="small"
                @click="retryVariableResolution"
            />
        </Message>
```

- [ ] `tests/unit/components/editor-error-state.test.ts:88-93`의 `useTiptapVariables` 스텁에 `resolveTokens: vi.fn().mockResolvedValue({})`를 추가한다(신규 destructure로 인한 undefined 방지 — 기존 metadataError 테스트 회귀 방지).

```ts
        vi.stubGlobal('useTiptapVariables', () => ({
            loadMetadata: mocks.loadMetadata,
            metadata: ref([]),
            resolveInsertedToken: vi.fn().mockResolvedValue(new Map()),
            resolveTokens: vi.fn().mockResolvedValue({}),
            extractTokens: vi.fn(() => []),
        }));
```

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/components/editor-error-state.test.ts` → **PASS**(회귀 없음 확인).
- [ ] `cd C:/it/it_frontend && npm run check` → 통과.
- [ ] **(COMMIT)** `cd C:/it/it_frontend && git commit -am "feat: Tiptap 토큰 해석 실패 전용 ERROR 상태 도입 + 칩/재시도 배너 (ERR-10)"`

> **테스트 배분 명시:** Vitest = `useTiptapVariables`(resolveInsertedToken ERROR 승격 + resolveTokens STALE 하위호환) + `VariableNodeView`(ERROR 칩 렌더). 수동 QA = TiptapEditor 인라인 Message 노출·"다시 시도" 동작(모킹된 useEditor 하네스에서 onUpdate 유발이 취약하므로 Task 7 체크리스트로 이관, ERR-07 선례).

---

## Task 5 — `projects/report.vue` 빈-URL 오류 상태 + stale 상신 차단

`generatePdf`의 "URL 미반환"(비throw) 분기(184-193)가 `console.error`만 남기고 stale `pdfUrl`을 유지해 오래된 미리보기로 상신 가능한 결함을 고친다. throw 분기(194-203)처럼 `pdfError`+toast+재시도를 부여하고, 빈-URL 시 `pdfUrl`을 무효화하며, `submitApproval`에 유효 PDF 가드를 추가한다. 가드 판정은 순수 함수로 추출해 Vitest로 검증한다.

**Files:**
- `it_frontend/app/features/approval/reportPdfGuards.ts` (신규)
- `it_frontend/app/pages/info/projects/report.vue:176-204`(generatePdf), `:268-278`(submitApproval 가드), `:50-54`(import 블록), `:78-82`(ref)
- `it_frontend/tests/unit/features/approval/reportPdfGuards.test.ts` (신규)

**Steps:**

- [ ] **(RED)** `tests/unit/features/approval/reportPdfGuards.test.ts`를 작성하고 실패를 확인한다.

```ts
import { describe, expect, it } from 'vitest';
import { isPdfReadyForSubmit, PDF_EMPTY_URL_MESSAGE } from '~/features/approval/reportPdfGuards';

describe('reportPdfGuards.isPdfReadyForSubmit', () => {
    it('유효 URL + 오류 없음이면 상신 가능', () => {
        expect(isPdfReadyForSubmit({ pdfUrl: 'blob:abc', pdfError: '' })).toBe(true);
    });

    it('URL이 null이면 상신 불가', () => {
        expect(isPdfReadyForSubmit({ pdfUrl: null, pdfError: '' })).toBe(false);
    });

    it('URL이 빈 문자열이면 상신 불가', () => {
        expect(isPdfReadyForSubmit({ pdfUrl: '', pdfError: '' })).toBe(false);
    });

    it('오류 메시지가 있으면(빈-URL·throw 모두) 상신 불가', () => {
        expect(isPdfReadyForSubmit({ pdfUrl: 'blob:abc', pdfError: PDF_EMPTY_URL_MESSAGE })).toBe(
            false,
        );
    });
});
```

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/features/approval/reportPdfGuards.test.ts` → **FAIL**(모듈 미존재) 확인.

- [ ] **(GREEN)** `app/features/approval/reportPdfGuards.ts`를 작성한다.

```ts
/**
 * ============================================================================
 * [features/approval/reportPdfGuards] 결재 상신 전 PDF 미리보기 유효성 가드
 * ============================================================================
 * PDF 미리보기 생성 실패(예외·URL 미반환)를 정상 상태와 구분하고,
 * 오래된(stale) 미리보기로 결재 상신되는 것을 순수 함수로 차단한다(ERR-10).
 * ============================================================================
 */

/** PDF 렌더러가 URL을 반환하지 않은 경우 사용자에게 표시할 오류 메시지 */
export const PDF_EMPTY_URL_MESSAGE =
    '신청서 미리보기를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.';

/** PDF 미리보기 상태 (상신 가드 입력) */
export interface PdfPreviewState {
    /** 생성된 PDF Blob URL. 미생성/무효화 시 null 또는 '' */
    pdfUrl: string | null;
    /** PDF 생성 오류 메시지. 정상이면 '' */
    pdfError: string;
}

/**
 * PDF 미리보기가 결재 상신에 사용할 수 있는 유효 상태인지 판정합니다.
 *
 * @param state 현재 PDF 미리보기 상태
 * @returns 유효 URL이 있고 오류가 없으면 true. URL 미반환·오류(빈-URL/throw) 시 false.
 */
export const isPdfReadyForSubmit = (state: PdfPreviewState): boolean =>
    state.pdfUrl !== null && state.pdfUrl !== '' && state.pdfError === '';
```

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/features/approval/reportPdfGuards.test.ts` → **PASS**.

- [ ] `app/pages/info/projects/report.vue:50-54` import 블록에 가드 import를 추가한다.

```ts
import { isPdfReadyForSubmit, PDF_EMPTY_URL_MESSAGE } from '~/features/approval/reportPdfGuards';
```

- [ ] `generatePdf`(176-204)의 `if (url) { ... } else { ... }` 분기(184-193)를 아래로 교체한다. throw 분기와 동일하게 `pdfError`+toast를 설정하고, stale `pdfUrl`을 revoke 후 `null`로 무효화해 오래된 미리보기 재사용을 차단한다. `TOAST_LIFE`는 이 화면이 아직 리터럴 사용 중이므로 throw 분기와 동일하게 `life: 3000`을 유지한다(점진 전환 대상, CLAUDE.md §4).

```ts
        if (url) {
            /* 이전 Blob URL 메모리 해제 */
            if (pdfUrl.value) {
                URL.revokeObjectURL(pdfUrl.value);
            }
            pdfUrl.value = url;
        } else {
            /* URL 미반환: 오류 상태로 표면화하고 stale 미리보기 재사용을 차단한다(ERR-10). */
            console.error('[ProjectsReport] ✗ No URL received from generateReport');
            if (pdfUrl.value) {
                URL.revokeObjectURL(pdfUrl.value);
                pdfUrl.value = null;
            }
            pdfError.value = PDF_EMPTY_URL_MESSAGE;
            toast.add({
                severity: 'error',
                summary: 'PDF 생성 실패',
                detail: PDF_EMPTY_URL_MESSAGE,
                life: 3000,
            });
        }
```

- [ ] `submitApproval`(268-278)의 결재 라인 검사 다음에 유효 PDF 가드를 추가한다.

```ts
const submitApproval = async () => {
    /* 1. 결재 라인 유효성 검사 */
    if (!approvalLine.value.teamLead.id || !approvalLine.value.deptHead.id) {
        toast.add({
            severity: 'warn',
            summary: '결재 라인 미지정',
            detail: '결재 라인을 모두 지정해주세요 (팀장/부서장).',
            life: 4000,
        });
        return;
    }

    /* 1-1. PDF 미리보기 유효성 가드 — 미생성·오류·stale URL이면 상신 차단(ERR-10) */
    if (!isPdfReadyForSubmit({ pdfUrl: pdfUrl.value, pdfError: pdfError.value })) {
        toast.add({
            severity: 'warn',
            summary: '미리보기 확인 필요',
            detail: '신청서 미리보기가 준비되지 않았습니다. 미리보기를 다시 생성해 주세요.',
            life: 4000,
        });
        return;
    }

    try {
```

> throw 분기(194-203)는 `pdfError`만 설정하고 `pdfUrl`은 유지하지만, 새 submit 가드가 `pdfError !== ''`로 상신을 차단하므로 양쪽 실패 경로 모두 안전하다. 빈-URL 분기만 미리보기 자체가 없으므로 `pdfUrl`을 추가로 무효화한다.

- [ ] `cd C:/it/it_frontend && npm run check` → 통과.
- [ ] **(COMMIT)** `cd C:/it/it_frontend && git commit -am "fix: projects/report 빈-URL PDF 오류 표면화 + stale 상신 차단 (ERR-10)"`

> **테스트 배분 명시:** Vitest = `reportPdfGuards.isPdfReadyForSubmit`(빈-URL/무효 URL/오류 분기). 수동 QA = 실제 렌더러가 URL 미반환 시 toast+미리보기 클리어+상신 차단(Task 7).

---

## Task 6 — `ResultReviewProgress.vue` 오류 분류 + 스로틀 toast + 명시적 재시도

배경 자동 동기화(watcher 47-67, catch 55-64)에서 마지막 정상 상태 유지·자동 재시도는 두되, 오류를 분류한다: 4xx(이미 11/12/13·권한 등 정상 흐름)=억제+진단 로그, 5xx/네트워크=분당 1회 스로틀 toast + **명시적 재시도 컨트롤**. 분류는 순수 함수로 추출해 Vitest로 검증한다.

**Files:**
- `it_frontend/app/utils/statusSyncError.ts` (신규)
- `it_frontend/app/components/council/result/ResultReviewProgress.vue:14-67`(script), 템플릿(84-100 다음 배너)
- `it_frontend/tests/unit/utils/statusSyncError.test.ts` (신규)

**Steps:**

- [ ] **(RED)** `tests/unit/utils/statusSyncError.test.ts`를 작성하고 실패를 확인한다. 상태코드 추출은 `CommitteeSelector.vue:104-105`·`stores/auth.ts:299`의 `statusCode ?? response.status ?? status` 형태를 모두 포섭한다.

```ts
import { describe, expect, it } from 'vitest';
import { classifyStatusSyncError } from '~/utils/statusSyncError';

describe('statusSyncError.classifyStatusSyncError', () => {
    it('4xx는 억제(suppress) — 이미 전이·권한 등 정상 흐름', () => {
        expect(classifyStatusSyncError({ statusCode: 404 })).toBe('suppress');
        expect(classifyStatusSyncError({ status: 403 })).toBe('suppress');
        expect(classifyStatusSyncError({ response: { status: 409 } })).toBe('suppress');
    });

    it('5xx는 일시 오류(transient) — 표면화 대상', () => {
        expect(classifyStatusSyncError({ statusCode: 500 })).toBe('transient');
        expect(classifyStatusSyncError({ response: { status: 503 } })).toBe('transient');
    });

    it('상태코드 없는 네트워크 오류는 transient', () => {
        expect(classifyStatusSyncError(new Error('network'))).toBe('transient');
        expect(classifyStatusSyncError(undefined)).toBe('transient');
    });
});
```

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/utils/statusSyncError.test.ts` → **FAIL**(모듈 미존재) 확인.

- [ ] **(GREEN)** `app/utils/statusSyncError.ts`를 작성한다.

```ts
/**
 * ============================================================================
 * [utils/statusSyncError] 협의회 검토 상태 동기화 오류 분류 유틸
 * ============================================================================
 * 배경 자동 동기화 실패를 4xx(정상 흐름·억제)와 5xx/네트워크(일시 오류·표면화)로
 * 구분해 toast 남발 없이 진짜 오류만 사용자에게 노출한다(ERR-10).
 * ============================================================================
 */

/** 동기화 오류 분류 결과 */
export type StatusSyncErrorKind = 'suppress' | 'transient';

/**
 * $apiFetch 오류에서 HTTP 상태 코드를 추출합니다.
 * FetchError(statusCode)·response.status·status 형태를 모두 대응합니다.
 *
 * @param error 알 수 없는 오류 객체
 * @returns 상태 코드 또는 추출 불가 시 undefined
 */
const readStatusCode = (error: unknown): number | undefined => {
    const e = error as { statusCode?: number; status?: number; response?: { status?: number } };
    return e?.statusCode ?? e?.response?.status ?? e?.status;
};

/**
 * 검토 상태 동기화 실패를 분류합니다.
 *
 * @param error 동기화 API 오류
 * @returns 4xx이면 'suppress'(toast 억제·진단 로그만), 그 외(5xx·네트워크)는 'transient'(표면화·재시도)
 */
export const classifyStatusSyncError = (error: unknown): StatusSyncErrorKind => {
    const status = readStatusCode(error);
    if (status !== undefined && status >= 400 && status < 500) return 'suppress';
    return 'transient';
};
```

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/utils/statusSyncError.test.ts` → **PASS**.

- [ ] `app/components/council/result/ResultReviewProgress.vue`의 `<script setup>`(14-79)을 아래로 재구성한다. `useToast`·`TOAST_LIFE`·`classifyStatusSyncError`를 도입하고, watcher/재시도가 공유하는 `runSync`로 DRY하며, 5xx/네트워크만 스로틀 toast+`syncError` 배너로 표면화한다.

```ts
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import type { CommitteeList, CommitteeMember } from '~/types/council';
import { TOAST_LIFE } from '~/utils/toast';
import { classifyStatusSyncError } from '~/utils/statusSyncError';

interface Props {
    asctId: string;
    committeeData?: CommitteeList | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    /** 10 → 11 자동 전이가 발생했을 때 부모에 알림 (부모는 refreshCouncil 호출) */
    (e: 'statusAdvanced'): void;
}>();

const { syncReviewStatus } = useCouncil();
const toast = useToast();

/** 평가 대상 위원 (간사 03 제외) */
const reviewers = computed<CommitteeMember[]>(() => {
    return [...(props.committeeData?.mandatory ?? []), ...(props.committeeData?.call ?? [])];
});

/** 확인 완료 인원 수 */
const confirmedCount = computed(() => reviewers.value.filter((m) => m.cnfmYn === 'Y').length);

/** 5xx·네트워크 동기화 실패 표면화 상태 (명시적 재시도 컨트롤 노출용) */
const syncError = ref(false);

let lastSyncToastAt = 0;
/**
 * 일시 오류(5xx·네트워크)를 분당 1회 toast로 제한 표면화합니다(선례 useTableCellSelection warnOncePerMinute).
 * 진단 로그는 매번 남겨 관측성을 보장합니다.
 */
const notifyTransientSyncError = (error: unknown) => {
    const now = Date.now();
    if (now - lastSyncToastAt >= 60_000) {
        lastSyncToastAt = now;
        toast.add({
            severity: 'warn',
            summary: '검토 상태 동기화 지연',
            detail: '검토 상태를 동기화하지 못했습니다. 잠시 후 다시 시도해 주세요.',
            life: TOAST_LIFE.LONG,
        });
    }
    console.warn('[ResultReviewProgress] 상태 전이 동기화 실패(일시 오류):', error);
};

let syncTriggered = false;

/**
 * 평가위원 전원 cnfmYn='Y'이면 자동 전이 동기화 API를 호출합니다(PRD §31 후속).
 *
 * <p>SQL로 cnfmYn을 직접 'Y'로 바꾼 경우 reviewResult API 흐름을 안 타서 10→11 자동 전이가
 * 누락됩니다. 컴포넌트가 전원 완료를 감지하면 syncReviewStatus를 한 번 호출해 전이를 보장합니다.</p>
 *
 * <p>오류는 분류한다: 4xx(이미 11/12/13·권한 등)는 억제하고, 5xx·네트워크만 표면화·재시도한다.</p>
 */
const runSync = async () => {
    const members = reviewers.value;
    if (members.length === 0) return;
    if (!members.every((m) => m.cnfmYn === 'Y')) return;
    syncTriggered = true;
    try {
        const advanced = await syncReviewStatus(props.asctId);
        if (advanced) emit('statusAdvanced');
        syncError.value = false;
    } catch (error) {
        // 실패 시 트리거를 되돌려 다음 위원 데이터 갱신 때 자동 재시도되도록 한다.
        syncTriggered = false;
        if (classifyStatusSyncError(error) === 'suppress') {
            // 4xx: 이미 11/12/13이거나 권한 없음 등 정상 흐름 — toast 억제, 진단 로그만.
            console.warn('[ResultReviewProgress] 상태 전이 억제(4xx):', error);
            return;
        }
        // 5xx·네트워크: 마지막 정상 상태 유지 + 스로틀 toast + 명시적 재시도 배너 노출.
        syncError.value = true;
        notifyTransientSyncError(error);
    }
};

watch(
    reviewers,
    (members) => {
        if (syncTriggered) return;
        if (members.length === 0) return;
        if (!members.every((m) => m.cnfmYn === 'Y')) return;
        void runSync();
    },
    { immediate: true },
);

/** 사용자 명시적 재시도 — watcher 재실행에만 의존하지 않고 즉시 동기화를 다시 시도한다. */
const retrySync = () => {
    syncTriggered = false;
    void runSync();
};

/** 진행률 (%) */
const progressRate = computed(() => {
    if (reviewers.value.length === 0) return 0;
    return Math.round((confirmedCount.value / reviewers.value.length) * 100);
});

/** 전원 완료 여부 */
const allConfirmed = computed(
    () => reviewers.value.length > 0 && confirmedCount.value === reviewers.value.length,
);
</script>
```

- [ ] `ResultReviewProgress.vue` 템플릿의 진행률 요약 블록(84-100) 다음, 진행률 바(103) 앞에 동기화 오류 배너 + 재시도 컨트롤을 추가한다.

```html
        <!-- 동기화 일시 오류(5xx·네트워크) 표면화 + 명시적 재시도 -->
        <div
            v-if="syncError"
            class="flex items-center justify-between gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
        >
            <span class="flex items-center gap-1.5">
                <i class="pi pi-exclamation-triangle" />
                검토 상태를 동기화하지 못했습니다.
            </span>
            <Button label="다시 시도" text size="small" @click="retrySync" />
        </div>
```

- [ ] `cd C:/it/it_frontend && npm test -- tests/unit/utils/statusSyncError.test.ts` → **PASS**, `cd C:/it/it_frontend && npm run check` → 통과.
- [ ] **(COMMIT)** `cd C:/it/it_frontend && git commit -am "fix: ResultReviewProgress 동기화 오류 분류 + 스로틀 toast + 재시도 (ERR-10)"`

> **테스트 배분 명시:** Vitest = `statusSyncError.classifyStatusSyncError`(4xx/5xx/네트워크 분류). 수동 QA = 4xx 억제·5xx 스로틀 toast·재시도 배너 동작(Task 7).

---

## Task 7 — 수동 QA 체크리스트 + 최종 게이트

로직 레벨 Vitest로 덮이지 않는 컴포넌트 표면화·stale 차단·상태 구분을 ERR-07 선례에 따라 수동 QA로 확인하고 전체 게이트를 통과시킨다.

**Files:** (검증만 — 코드 변경 없음)
- 두 서버 기동: 프론트 `http://localhost:3000`, 백엔드 `http://localhost:28080` (CLAUDE.md §3.1)

**Steps:**

- [ ] **통화 통합 (Task 2/3)** — DevTools Network에서 `CUR_C` 요청을 실패(offline/차단)로 주입한 뒤:
  - `/info/cost/form?id=<외화항목>`: 통화 필드 위에 "통화 목록을 불러오지 못해 KRW만 표시합니다." + "다시 시도" 노출, 재시도 클릭 시 복구(정상 빈 KRW 상태와 구분).
  - `TerminalFormDialog`(금융정보단말기 상세): 통화 실패가 다이얼로그 `loadError` 화면("데이터를 불러오지 못했습니다." + "다시 불러오기")로 편입되는지 확인(KRW 축소 조용한 성공이 아님).
  - 정상 응답 시 두 화면 모두 통화 옵션·환율 자동입력이 이전과 동일하게 동작(회귀 없음).
- [ ] **Tiptap ERROR (Task 4)** — 문서 편집기에서 `{` 변수 삽입 후 `resolve` 요청을 실패로 주입:
  - 신규 삽입 토큰 칩이 amber(STALE)가 아닌 **빨간 경고 아이콘(ERROR)** 칩으로 표시되고 tooltip이 "변수 값을 불러오지 못했습니다"인지 확인.
  - 에디터 상단에 "일부 변수 값을 불러오지 못했습니다." + "다시 시도" Message 노출, 재시도 성공 시 배너 사라짐.
  - **읽기 전용 회귀 확인**: 저장된 문서(board/documents/plan/guide)에서 resolve 실패 시 기존처럼 snapshot(STALE) 폴백으로 작성 시점 값이 보이는지(ERROR로 바뀌지 않음) 확인.
- [ ] **report 빈-URL (Task 5)** — 렌더러가 URL을 반환하지 않도록 유도(또는 임시 주입) 후:
  - "PDF 생성 실패" toast + `errorMessage` 표시, 미리보기가 이전 것으로 남지 않고 비워짐.
  - 이 상태에서 "상신" 시 "미리보기 확인 필요" 경고로 차단되는지 확인(stale 상신 불가).
- [ ] **ResultReviewProgress (Task 6)** — 결과서 검토 진행 화면에서 sync API를:
  - 4xx(예: 409)로 주입 → toast 없이 조용히 억제(콘솔 진단만).
  - 5xx/네트워크로 주입 → amber 배너 + 분당 1회 toast, "다시 시도" 클릭 시 재동기화.
- [ ] **전체 게이트**:
  - `cd C:/it/it_frontend && npm run check` → 통과.
  - `cd C:/it/it_frontend && npm test` → 전체 PASS.
  - `cd C:/it/it_frontend && npm run test:e2e:core` → PASS(auth·projects·approval 핵심 흐름).
- [ ] **(문서/이관)** 완료 후 `TASK.md`의 ERR-10 항목을 `TASK_DONE.md` 이관 규약에 따라 처리(SEC-08/09·ERR-08~10·BE-13 로드맵 진행에 맞춰). 시점성 수치는 `CLAUDE.md`가 아닌 `README.md` 변경 이력/`TASK.md` 메모에만 기록(CLAUDE.md §4.3).

---

## 검증 요약 (Phase C 완료 기준, 스펙 §5.4)

| 대상 | Vitest (로직 레벨) | 수동 QA |
| --- | --- | --- |
| 통화 통합 (Task 1/2/3) | `useProjectCurrencies.test.ts`(currencyAutoFillMap·loadError) | 두 화면 실패 표면화·재시도·회귀 |
| Tiptap ERROR (Task 4) | `useTiptapVariables.test.ts`(ERROR 승격·STALE 하위호환), `VariableNodeView.test.ts`(ERROR 칩) | 에디터 Message·재시도, 읽기전용 회귀 |
| report 빈-URL (Task 5) | `reportPdfGuards.test.ts`(isPdfReadyForSubmit) | toast·미리보기 클리어·상신 차단 |
| ResultReviewProgress (Task 6) | `statusSyncError.test.ts`(4xx/5xx/네트워크) | 억제·스로틀 toast·재시도 배너 |
| 전체 | `npm test` | `npm run check`, `npm run test:e2e:core` |

**정책 정합(CLAUDE.md 프론트 §2/§4/§6):** 컴포저블·유틸은 오류 상태(ref)/분류값만 반환하고 toast를 직접 호출하지 않는다. 사용자 시작 동작 실패는 컴포넌트가 toast/인라인으로 표면화한다(`console.error`만 남기지 않음). 통화는 `useProjectCurrencies`로 단일화하고 신규 toast는 `TOAST_LIFE`를 사용한다. 변수 삽입 후 해석은 최신 맵 병합·stale 무시를 유지하되 실패를 `ERROR`로 구분한다.
