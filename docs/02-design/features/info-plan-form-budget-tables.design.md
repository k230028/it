# info-plan-form-budget-tables Design Document

> **Summary**: `/info/plan/form` 미리보기에 자본예산·일반관리비 테이블 카드 2개 추가 (프론트엔드 전용)
>
> **Project**: IT Portal (IT 정보화 포탈)
> **Version**: Nuxt 4 / Spring Boot 4.0.5
> **Author**: K140024
> **Date**: 2026-05-05
> **Status**: Draft
> **Planning Doc**: [info-plan-form-budget-tables.plan.md](../../01-plan/features/info-plan-form-budget-tables.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 계획 등록 시 자본예산(신규/계속 구분)·일반관리비(비목 구분)를 직관적으로 확인할 수 없어 업무 효율 저하 |
| **WHO** | IT 계획 담당자 (정보기술부문 계획을 등록하는 기획통할담당자/관리자) |
| **RISK** | 공통코드(DUP_IOE, IOE-239-0200, PUL_DTT) 매핑 로직이 백엔드 데이터와 불일치할 경우 그룹핑 오류 가능 |
| **SUCCESS** | 전산예산 카드 아래에 자본예산·일반관리비 카드가 정확히 표시됨; 기존 기능(저장/조회)에 회귀 없음 |
| **SCOPE** | 프론트엔드 전용 변경 (신규 Vue 컴포넌트 2개 + form.vue 수정); 백엔드 API 변경 없음 |

---

## 1. Overview

### 1.1 Design Goals

- `handleGenerate()`에서 이미 로드한 데이터를 재활용하여 추가 API 호출 없이 두 카드 표시
- `PlanBudgetAllocationCard.vue`와 동일한 컴포넌트 구조·스타일 패턴 적용
- `selectedUnit` 반응성 유지: 단위 변경 시 모든 금액 자동 재포맷

### 1.2 Design Principles

- 기존 패턴 일치: `PlanBudgetAllocationCard.vue`와 동일한 props 구조 + 내부 computed
- YAGNI: composable 신규 추가 없이 컴포넌트 내 computed로 그룹핑
- 단방향 데이터 흐름: form.vue → props → 컴포넌트 내 computed

---

## 2. Architecture

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **Approach** | form.vue 인라인 구현 | 컴포넌트 + composable 분리 | 컴포넌트 분리, 내부 computed |
| **New Files** | 0 | 4 | 2 |
| **Modified Files** | 1 | 1 | 1 |
| **Complexity** | Low | High | Medium |
| **Maintainability** | Low (form.vue 비대화) | High | High |
| **Pattern Match** | ❌ | △ (범위 초과) | ✅ |

**Selected**: **Option C — Pragmatic** — PlanBudgetAllocationCard 패턴과 일치하며, 재사용 가능성이 낮은 그룹핑 로직을 위한 composable 추가가 불필요.

### 2.1 Component Diagram

```
form.vue
├── PlanBudgetAllocationCard      (기존 — 변경 없음)
├── PlanCapitalBudgetCard         (신규)
│     props: prjSnapshots, unit
│     computed: capitalGroups (PUL_DTT 그룹핑, Top 2 + ' 등')
└── PlanExpenseCostCard           (신규)
      props: costDetails, unit
      computed: expenseGroups (DUP_IOE → IOE-239-0200 rowspan 구조)
```

### 2.2 Data Flow

```
handleGenerate() 호출
  ├── fetchProjectsBulk() → prjDetails → prjSnapshots → prjSnapshotsRef   (기존)
  └── fetchCostsBulk()   → costDetails → costDetailsRef                   (신규 할당)

prjSnapshotsRef ──props──▶ PlanCapitalBudgetCard  (computed: PUL_DTT 그룹핑)
costDetailsRef  ──props──▶ PlanExpenseCostCard    (computed: DUP_IOE → IOE-239-0200 그룹핑)
selectedUnit    ──props──▶ 두 카드 모두 (formatBudget 적용)
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `PlanCapitalBudgetCard.vue` | `useCodeOptions('PUL_DTT')` | 신규/계속 코드명 조회 |
| `PlanCapitalBudgetCard.vue` | `formatBudget` (utils/common) | 금액 단위 포맷 |
| `PlanExpenseCostCard.vue` | `useCodeOptions('DUP_IOE')` | 구분명 조회 |
| `PlanExpenseCostCard.vue` | `useCodeOptions('IOE-239-0200')` | 세목명 조회 |
| `PlanExpenseCostCard.vue` | `formatBudget` (utils/common) | 금액 단위 포맷 |
| `form.vue` | `ItCost` (useCost) | costDetailsRef 타입 |

---

## 3. Data Model

### 3.1 Open Questions 해소

| 질문 | 결론 | 근거 |
|------|------|------|
| Q1: `ItCost.ioeC`가 IOE-239-0200 세목코드? | **YES** — `Bcostm.IOE_C` comment: "비목코드" | Bcostm.java:68 |
| Q2: `ItCost.pulDtt`가 DUP_IOE 구분코드? | **YES** — `Bcostm.PUL_DTT` comment: "전산업무비구분" | Bcostm.java:135 |
| Q3: costBg=0 항목 제외? | **YES** — 일반관리비 카드에서 `costBg > 0` 필터 적용 | 설계 결정 |
| Q4: 주요 내역 표시 방식? | **Top 2, 3개 이상 시 ' 등' 추가** | 사용자 확정 |
| Q5: pulDtt undefined 사업 처리? | **제외** — 자본예산 카드 그룹핑에서 필터링 | 설계 결정 |

### 3.2 자본예산 카드 — 내부 computed 타입

```typescript
interface CapitalGroup {
    pulDtt: string       // PUL_DTT 코드값
    groupName: string    // 코드명 (신규 | 계속)
    mainContent: string  // Top 2 prjNm 조합 + 필요 시 ' 등'
    totalAssetBg: number // 그룹 내 assetBg 합계
}
```

### 3.3 일반관리비 카드 — 내부 computed 타입

```typescript
interface ExpenseSubGroup {
    ioeC: string         // IOE-239-0200 세목코드
    subName: string      // 세목명
    mainContent: string  // 세목 내 costBg 최대 항목의 cttNm
    total: number        // 세목 내 costBg 합계
}

interface ExpenseGroup {
    pulDtt: string           // DUP_IOE 구분코드
    groupName: string        // 구분명
    rowspan: number          // tbody rowspan = subGroups.length + 1 (소계 행 포함)
    subGroups: ExpenseSubGroup[]
    subtotal: number         // 구분 내 costBg 합계
}
```

---

## 4. API Specification

신규 API 없음. 기존 API 활용:
- `GET /api/projects/bulk` → `fetchProjectsBulk()` (기존, prjDetails 소스)
- `GET /api/costs/bulk` → `fetchCostsBulk()` (기존, costDetails 소스)
- `GET /api/ccodem/type/{typeCode}` → `useCodeOptions()` (기존, 코드명 조회)

---

## 5. UI/UX Design

### 5.1 카드 배치 순서 (미리보기 영역)

```
[기존] 예산 총계 카드
[기존] 정보화사업 요약 카드
[기존] 전산예산 카드        ← PlanBudgetAllocationCard (form.vue line 682)
[신규] 자본예산 카드        ← PlanCapitalBudgetCard
[신규] 일반관리비 카드      ← PlanExpenseCostCard
[기존] 부문별 사업목록
[기존] 사업유형별 사업목록
```

### 5.2 자본예산 카드 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ 자본예산                                              │
├──────────────┬───────────────────────────┬───────────┤
│ 구분         │ 주요 내역                 │ 편성액    │
├──────────────┼───────────────────────────┼───────────┤
│ 신규         │ A사업, B사업 등           │ 1,234     │
├──────────────┼───────────────────────────┼───────────┤
│ 계속         │ C사업                     │   567     │
├──────────────┴───────────────────────────┼───────────┤
│ 합계                                     │ 1,801     │
└──────────────────────────────────────────┴───────────┘
```

**열 설명**
- 구분: `useCodeOptions('PUL_DTT')` 코드명 (PUL_DTT_001 → 신규, PUL_DTT_002 → 계속)
- 주요 내역: assetBg 내림차순 Top 2 `prjNm`, 3개 이상이면 마지막에 ` 등` 추가
- 편성액: 그룹 내 assetBg 합계, `formatBudget(unit)` 적용, 우측 정렬

### 5.3 일반관리비 카드 레이아웃

```
┌──────────────────┬──────────────┬──────────────────┬───────────┐
│ 구분             │ 세목         │ 주요 내역        │ 편성예산  │
├──────────────────┼──────────────┼──────────────────┼───────────┤
│ 전산용역비       │ 외주용역비   │ X사 유지보수     │   300     │
│ (rowspan=3)      ├──────────────┼──────────────────┼───────────┤
│                  │ 기타용역비   │ Y사 컨설팅       │   150     │
│                  ├──────────────┼──────────────────┼───────────┤
│                  │ 소 계        │                  │   450     │
├──────────────────┼──────────────┼──────────────────┼───────────┤
│ 전산제비         │ 회선사용료   │ Z통신 회선       │    80     │
│ (rowspan=2)      ├──────────────┼──────────────────┼───────────┤
│                  │ 소 계        │                  │    80     │
├──────────────────┴──────────────┼──────────────────┼───────────┤
│ 합 계                           │                  │   530     │
└─────────────────────────────────┴──────────────────┴───────────┘
```

**rowspan 계산**: 구분 셀 rowspan = `subGroups.length + 1` (세목 행 + 소계 행)

### 5.4 공통 스타일 (PlanBudgetAllocationCard 동일)

```html
<!-- 카드 래퍼 -->
<div class="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
  <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200 border-b pb-2">제목</h2>
  <!-- 빈 상태 -->
  <div class="text-center text-zinc-400 dark:text-zinc-500 py-4 text-sm">데이터가 없습니다.</div>
  <!-- 테이블 -->
  <table class="w-full border-collapse">
    <thead>
      <tr>
        <th class="border px-3 py-1.5 text-center font-semibold text-white bg-blue-900" ...>헤더</th>
      </tr>
    </thead>
    <tbody>
      <tr class="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2">...</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="font-semibold bg-zinc-100 dark:bg-zinc-800">
        <td class="border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-right tabular-nums">합계</td>
      </tr>
    </tfoot>
  </table>
</div>
```

### 5.5 Page UI Checklist

#### `/info/plan/form` — 자본예산 카드 (PlanCapitalBudgetCard)

- [ ] 카드 제목 "자본예산" 표시
- [ ] thead: 구분 | 주요 내역 | 편성액 (bg-blue-900 흰 텍스트)
- [ ] tbody: pulDtt 그룹별 행 (신규 / 계속)
- [ ] 주요 내역: assetBg 내림차순 Top 2 prjNm, 3개 이상 시 ' 등' 접미어
- [ ] 편성액: assetBg 합계, 우측 정렬 tabular-nums, formatBudget 적용
- [ ] tfoot: 합계 행 (전체 assetBg 합계)
- [ ] 빈 상태: prjSnapshots 없거나 pulDtt 유효 항목 없을 때 안내 문구 표시

#### `/info/plan/form` — 일반관리비 카드 (PlanExpenseCostCard)

- [ ] 카드 제목 "일반관리비" 표시
- [ ] thead: 구분 | 세목 | 주요 내역 | 편성예산 (bg-blue-900 흰 텍스트)
- [ ] tbody: DUP_IOE 구분 rowspan, IOE-239-0200 세목 행
- [ ] 소계 행: 구분별 costBg 합계 (구분 셀 없이 colspan 처리)
- [ ] tfoot: 합계 행 (전체 costBg 합계)
- [ ] 주요 내역: 세목 내 costBg 최대 항목 cttNm
- [ ] costBg=0 항목 필터링 (표시 안 함)
- [ ] 빈 상태: costDetails 없거나 costBg>0 항목 없을 때 안내 문구 표시
- [ ] selectedUnit 변경 시 편성예산 재포맷

---

## 6. Error Handling

| 상황 | 처리 |
|------|------|
| 생성 전 (prjSnapshotsRef 비어있음) | 두 카드 모두 `v-if` 또는 빈 상태 메시지로 처리 |
| pulDtt 없는 정보화사업 | 자본예산 카드 computed에서 filter로 제외 |
| costDetails 없음 | 일반관리비 카드 빈 상태 메시지 표시 |
| costBg=0인 전산업무비 | 일반관리비 computed에서 filter로 제외 |
| useCodeOptions 코드 미매칭 | getCodeName 기본: 원본 코드값 그대로 반환 |

---

## 7. Security Considerations

- 신규 API 엔드포인트 없음 — 기존 인증 정책 그대로 적용
- XSS: prjNm, cttNm은 `v-html` 없이 텍스트 보간 (`{{ }}`) 처리

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: Unit | 그룹핑 computed 로직 (Top 2 + ' 등', rowspan, 필터링) | Vitest | Do |
| L2: UI Action | 생성 버튼 클릭 후 카드 표시, selectedUnit 변경 반응 | Playwright | Do |
| L3: E2E | 사업 선택 → 생성 → 두 카드 데이터 정확성 확인 | Playwright | Do |

### 8.2 L1: Unit Test Scenarios

| # | 대상 | 입력 | 기대값 |
|---|------|------|--------|
| 1 | Top 2 + ' 등' | assetBg 내림차순 3개 항목 | "A사업, B사업 등" |
| 2 | Top 2 (1개) | 항목 1개 | "A사업" (' 등' 없음) |
| 3 | pulDtt undefined 필터 | pulDtt 없는 항목 포함 | 해당 항목 제외 |
| 4 | costBg=0 필터 | costBg=0 항목 포함 | 해당 항목 제외 |
| 5 | rowspan 계산 | 구분 2개, 세목 각 2개/1개 | rowspan = 3, 2 (세목 수 + 소계) |

### 8.3 L2: UI Action Test Scenarios

| # | 동작 | 기대 결과 |
|---|------|----------|
| 1 | 사업+비용 선택 후 [생성] 클릭 | 자본예산/일반관리비 카드 표시 |
| 2 | 단위 선택 '천원' 변경 | 두 카드 금액 재포맷 |
| 3 | 전산업무비 없이 생성 | 일반관리비 카드 빈 상태 메시지 |

### 8.4 L3: E2E Scenario

| # | 시나리오 | 단계 | 성공 기준 |
|---|----------|------|----------|
| 1 | 전체 생성 플로우 | 연도 입력 → 사업+비용 선택 → 생성 → 두 카드 확인 | 카드 데이터 정확 표시 |
| 2 | 저장 회귀 확인 | 생성 후 [저장] 실행 | 기존 저장 API 정상 호출 |

### 8.5 Seed Data Requirements

| 데이터 | 최소 | 필수 필드 |
|--------|:---:|----------|
| 정보화사업 (pulDtt=PUL_DTT_001) | 3건 | assetBg > 0, prjNm |
| 정보화사업 (pulDtt=PUL_DTT_002) | 1건 | assetBg > 0, prjNm |
| 전산업무비 (costBg > 0, DUP_IOE 2종) | 4건 이상 | ioeC, pulDtt, costBg, cttNm |

---

## 9. Layer Assignment

| Component | Layer | Location |
|-----------|-------|----------|
| `PlanCapitalBudgetCard.vue` | Presentation | `app/components/plan/` |
| `PlanExpenseCostCard.vue` | Presentation | `app/components/plan/` |
| `form.vue` (수정) | Presentation | `app/pages/info/plan/` |
| `useCodeOptions` | Infrastructure (API) | `app/composables/useCodeOptions.ts` |
| `formatBudget` | Utility | `app/utils/common.ts` |
| `ItCost`, `PlanProjectItem` | Domain types | `app/composables/useCost.ts`, `usePlan.ts` |

---

## 10. Coding Convention

| 항목 | 적용 규칙 |
|------|----------|
| 컴포넌트 명칭 | PascalCase (`PlanCapitalBudgetCard`) |
| Props 네이밍 | camelCase (Vue 자동 케밥 변환 적용) |
| 내부 computed | camelCase (`capitalGroups`, `expenseGroups`, `grandTotal`) |
| 코드명 조회 | 컴포넌트 내 `useCodeOptions` 직접 호출 (composable 신규 추가 없음) |
| 금액 포맷 | `formatBudget(value, unit)` — `app/utils/common.ts` |
| 테이블 헤더 | `bg-blue-900 text-white` (기존 패턴 동일) |

---

## 11. Implementation Guide

### 11.1 File Structure

```
it_frontend/app/
├── components/plan/
│   ├── PlanBudgetAllocationCard.vue   (기존 — 변경 없음)
│   ├── PlanCapitalBudgetCard.vue      (신규)
│   └── PlanExpenseCostCard.vue        (신규)
└── pages/info/plan/
    └── form.vue                       (수정)
```

### 11.2 form.vue 수정 위치

**Step 1 — `costDetailsRef` ref 추가** (line 202, `prjSnapshotsRef` 바로 아래):

```typescript
const prjSnapshotsRef = ref<PlanProjectItem[]>([]);
const costDetailsRef = ref<ItCost[]>([]);        // PlanExpenseCostCard prop용
```

**Step 2 — `handleGenerate()` 내 할당 추가** (line 313 `prjSnapshotsRef.value =` 바로 아래):

```typescript
prjSnapshotsRef.value = prjSnapshots;   // 기존
costDetailsRef.value = costDetails;     // 신규
```

**Step 3 — 템플릿에 카드 삽입** (line 682 `<PlanBudgetAllocationCard>` 바로 아래):

```html
<!-- 전산예산 카드 (기존) -->
<PlanBudgetAllocationCard :pln-yy="plnYy" :unit="selectedUnit" />

<!-- 자본예산 카드 (신규) -->
<PlanCapitalBudgetCard :prj-snapshots="prjSnapshotsRef" :unit="selectedUnit" />

<!-- 일반관리비 카드 (신규) -->
<PlanExpenseCostCard :cost-details="costDetailsRef" :unit="selectedUnit" />
```

### 11.3 PlanCapitalBudgetCard.vue 핵심 로직

```typescript
const props = defineProps<{
    prjSnapshots: PlanProjectItem[]
    unit: string
}>()

const { getCodeName } = useCodeOptions('PUL_DTT')

const capitalGroups = computed(() => {
    const validItems = props.prjSnapshots.filter(p => p.pulDtt)
    const grouped = new Map<string, PlanProjectItem[]>()
    for (const item of validItems) {
        const key = item.pulDtt!
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push(item)
    }
    return [...grouped.entries()].map(([pulDtt, items]) => {
        const sorted = [...items].sort((a, b) => b.assetBg - a.assetBg)
        const top2 = sorted.slice(0, 2).map(i => i.prjNm)
        const mainContent = top2.join(', ') + (sorted.length > 2 ? ' 등' : '')
        const totalAssetBg = items.reduce((s, i) => s + i.assetBg, 0)
        return { pulDtt, groupName: getCodeName(pulDtt), mainContent, totalAssetBg }
    })
})

const grandTotal = computed(() =>
    capitalGroups.value.reduce((s, g) => s + g.totalAssetBg, 0)
)
```

### 11.4 PlanExpenseCostCard.vue 핵심 로직

```typescript
const props = defineProps<{
    costDetails: ItCost[]
    unit: string
}>()

const { getCodeName: getDupIoeName } = useCodeOptions('DUP_IOE')
const { getCodeName: getIoeCName } = useCodeOptions('IOE-239-0200')

const expenseGroups = computed(() => {
    const filtered = props.costDetails.filter(c => (c.costBg ?? 0) > 0)
    const groupMap = new Map<string, ItCost[]>()
    for (const item of filtered) {
        const key = item.pulDtt
        if (!groupMap.has(key)) groupMap.set(key, [])
        groupMap.get(key)!.push(item)
    }
    return [...groupMap.entries()].map(([pulDtt, items]) => {
        const subMap = new Map<string, ItCost[]>()
        for (const item of items) {
            const key = item.ioeC
            if (!subMap.has(key)) subMap.set(key, [])
            subMap.get(key)!.push(item)
        }
        const subGroups = [...subMap.entries()].map(([ioeC, subItems]) => {
            const total = subItems.reduce((s, i) => s + (i.costBg ?? 0), 0)
            const top = subItems.reduce((max, i) => (i.costBg ?? 0) > (max.costBg ?? 0) ? i : max)
            return { ioeC, subName: getIoeCName(ioeC), mainContent: top.cttNm, total }
        })
        const subtotal = subGroups.reduce((s, sg) => s + sg.total, 0)
        const rowspan = subGroups.length + 1  // 세목 행 + 소계 행
        return { pulDtt, groupName: getDupIoeName(pulDtt), rowspan, subGroups, subtotal }
    })
})

const grandTotal = computed(() =>
    expenseGroups.value.reduce((s, g) => s + g.subtotal, 0)
)
```

### 11.5 Implementation Order

1. [ ] `PlanCapitalBudgetCard.vue` 생성 (props, computed, template)
2. [ ] `PlanExpenseCostCard.vue` 생성 (props, computed, rowspan template)
3. [ ] `form.vue` 수정 (costDetailsRef 추가, handleGenerate 할당, 카드 삽입)
4. [ ] `npx nuxt typecheck` — 타입 오류 없음 확인
5. [ ] `npx eslint .` — 린트 오류 없음 확인

### 11.6 Session Guide

#### Module Map

| Module | Scope Key | Description | 예상 턴 |
|--------|-----------|-------------|:------:|
| 자본예산 카드 | `module-1` | PlanCapitalBudgetCard.vue 생성 | 10-15 |
| 일반관리비 카드 | `module-2` | PlanExpenseCostCard.vue 생성 (rowspan 구조) | 15-20 |
| form.vue 연동 | `module-3` | costDetailsRef 추가 + 카드 삽입 | 5-8 |

#### Recommended Session Plan

| Session | Phase | Scope | 예상 턴 |
|---------|-------|-------|:------:|
| Session 1 | Plan + Design | 완료 | — |
| Session 2 | Do | `--scope module-1,module-2,module-3` | 30-40 |
| Session 3 | Check + Report | 전체 | 20-30 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-05 | Initial draft | K140024 |
