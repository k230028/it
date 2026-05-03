# 전산업무비 화면 개선 Design Document

> **Summary**: `[id].vue` 코드명 표시 + 단말기 섹션 조건부 렌더링, `form.vue` 단건 수정 Form 기반 재작성
>
> **Project**: IT Portal (IT 정보화 포탈)
> **Version**: 1.0
> **Author**: K140024
> **Date**: 2026-05-01
> **Status**: Draft
> **Planning Doc**: [cost-detail-enhancement.plan.md](../../01-plan/features/cost-detail-enhancement.plan.md)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 전산업무비 단건 화면이 조회 품질(코드명 미노출, 단말기 누락)·수정 UX(일괄 편집 테이블) 모두 정보화사업 대비 열위 → 담당자 혼란 및 운영 비효율 발생 |
| **WHO** | IT 정보화 포탈 내부 사용자 (전산업무비 담당 및 조회 권한 보유 임직원, 약 3,000명) |
| **RISK** | 단건 수정 form.vue 전면 재작성 중 기존 일괄 수정 동작(`?ids=…`)과의 모드 분리 로직 충돌 가능성 |
| **SUCCESS** | (1) 조회 화면 pulDtt/dfrCle → 코드명 출력 확인, (2) IT_MNGC_TP_001 조건부 단말기 목록 렌더링 확인, (3) 수정 화면 Form 기반 저장/취소 정상 동작, (4) 단말기 입력 테이블 CRUD 연동 확인 |
| **SCOPE** | Phase 1: 조회 화면 개선(`[id].vue`) / Phase 2: 수정 화면 재작성(`form.vue` 단건 모드) |

---

## 1. Overview

### 1.1 Design Goals

1. `[id].vue`: `pulDtt`, `dfrCle` 필드에 코드명을 노출하여 원시 코드값 노출 문제 해소
2. `[id].vue`: `itMngcTp === 'IT_MNGC_TP_001'`일 때 화면 하단에 금융정보단말기 상세목록 DataTable 렌더링
3. `form.vue`: 단건 수정 모드(`?id=…`)에서 섹션별 Form UI 제공, 일괄·신규 모드는 기존 동작 100% 보존
4. `form.vue`: 단건 수정 모드에서 `itMngcTp === 'IT_MNGC_TP_001'`일 때 `TerminalTableSection` 렌더링

### 1.2 Design Principles

- **최소 변경**: 신규 파일 0개, 기존 2개 파일만 수정 — 라우팅·API·백엔드 변경 없음
- **기존 패턴 재사용**: `useCodeOptions` composable, `TerminalTableSection` 컴포넌트, `StyledDataTable` 래퍼
- **모드 명확한 분리**: `isBulk`/`isEditSingle` computed로 분기점을 명시적으로 드러내 향후 유지보수 용이

---

## 2. Architecture

### 2.0 Architecture Comparison

| Criteria | Option A: Minimal | Option B: Clean | Option C: Pragmatic |
|----------|:-:|:-:|:-:|
| **New Files** | 0 | 2 | **0** |
| **Modified Files** | 2 | 2 | **2** |
| **Complexity** | Low | High | **Medium** |
| **Maintainability** | Medium | High | **High** |
| **Effort** | Low | High | **Medium** |
| **Risk** | Low | Low | **Low** |

**Selected**: Option C (Pragmatic)
**Rationale**: 신규 파일 없이 기존 패턴(useCodeOptions, TerminalTableSection) 재사용으로 DRY 원칙을 지키면서, `isBulk`/`isEditSingle` computed를 통해 모드 분기를 명확히 드러냄. 라우팅·API·백엔드 변경 없이 최소 리스크로 목표 달성 가능.

### 2.1 Component Diagram

```
브라우저
  │
  ├─ /info/cost/:id  →  [id].vue
  │     ├─ useCodeOptions('PUL_DTT') ─────────── GET /api/ccodem/type/PUL_DTT
  │     ├─ useCodeOptions('DFR_CLE') ─────────── GET /api/ccodem/type/DFR_CLE
  │     ├─ useCost.fetchCost(id) ──────────────── GET /api/cost/:id
  │     └─ v-if="isTerminalType"
  │           └─ 읽기 전용 StyledDataTable (cost.terminals[])
  │
  └─ /info/cost/form  →  form.vue
        ├─ isBulk     = !!route.query.ids
        ├─ isEditSingle = isEditMode && !isBulk
        │
        ├─ v-if="!isEditSingle"
        │     └─ 기존 CostFormTableSection (일괄수정/신규 — 변경 없음)
        │
        └─ v-else  (단건 수정 전용)
              ├─ 섹션별 Form (계약정보/예산지급/기타/담당조직)
              ├─ v-if="isTerminalType"
              │     └─ TerminalTableSection
              │           props: modelValue, dfrCleOptions, tmnSvcOptions, currencyOptions
              └─ 저장(PUT /api/cost/:id) / 취소
```

### 2.2 Data Flow

```
[id].vue 조회 흐름:
  fetchCost(id) → ItCost { itMngcTp, terminals[], pulDtt, dfrCle, ... }
  useCodeOptions('PUL_DTT').getCodeName(cost.pulDtt) → "신규" | "계속"
  useCodeOptions('DFR_CLE').getCodeName(cost.dfrCle) → "월별" | "분기별" | ...
  isTerminalType = cost.itMngcTp === 'IT_MNGC_TP_001'
  → true: section#section-terminal 렌더링 (StyledDataTable, cost.terminals[])

form.vue 단건 수정 흐름:
  fetchCostOnce(id) → form 데이터 (cost ref)
  isEditSingle = true → Form UI 렌더링
  isTerminalType = cost.itMngcTp === 'IT_MNGC_TP_001'
  → true: TerminalTableSection (v-model="cost.terminals")
  저장 → updateCost(id, cost) → PUT /api/cost/:id
```

### 2.3 Dependencies

| Component | Depends On | Purpose |
|-----------|-----------|---------|
| `[id].vue` | `useCodeOptions` composable | pulDtt, dfrCle 코드명 변환 |
| `[id].vue` | `useCost.fetchCost` | ItCost + terminals 조회 |
| `[id].vue` | `StyledDataTable` | 읽기 전용 단말기 DataTable |
| `form.vue` | `TerminalTableSection` | 단말기 편집 테이블 |
| `form.vue` | `useCurrencyRates` | currencyOptions 계산 |
| `TerminalTableSection` | `dfrCleOptions`, `tmnSvcOptions`, `currencyOptions` | Select 옵션 |

---

## 3. Data Model

### 3.1 기존 인터페이스 (변경 없음)

```typescript
// composables/useCost.ts — 변경 없음
export interface Terminal {
    tmnMngNo?: string;    // 단말기관리번호
    tmnSno?: string;      // 단말기일련번호
    tmnNm: string;        // 단말기명
    tmnTuzManr: string;   // 단말기이용방법
    tmnUsg: string;       // 단말기용도
    tmnSvc: string;       // 단말기서비스
    tmlAmt: number;       // 단말기금액
    cur: string;          // 통화
    xcr?: number;         // 환율
    xcrBseDt?: string | Date;
    dfrCle: string;       // 지급주기
    indRsn: string;       // 증감사유
    cgpr: string;         // 담당자
    cgprNm?: string;
    biceTem: string;      // 담당팀
    biceDpm: string;      // 담당부서
    rmk: string;          // 비고
}

export interface ItCost {
    itMngcNo?: string;
    itMngcTp: string;     // 'IT_MNGC_TP_001' = 금융정보단말기
    pulDtt: string;       // 추진구분 코드 (PUL_DTT 유형)
    dfrCle: string;       // 지급주기 코드 (DFR_CLE 유형)
    terminals?: Terminal[];
    // ... 기타 필드 (변경 없음)
}
```

### 3.2 신규 로컬 상태 (`form.vue`에 추가)

```typescript
// form.vue에 추가될 computed
const isBulk = computed(() => !!route.query.ids);
const isEditSingle = computed(() => isEditMode.value && !isBulk.value);
const isTerminalType = computed(() => cost.value?.itMngcTp === 'IT_MNGC_TP_001');

// form.vue onActivated에 추가될 옵션 ref
const tmnSvcOptions = ref<CodeOption[]>([]);  // TMN_SVC 코드 목록
const exchangeRates = ref<Record<string, number>>({});
const currencyOptions = computed(() => Object.keys(exchangeRates.value));
```

---

## 4. API Specification

### 4.1 사용 API (기존, 변경 없음)

| Method | Path | Description | 사용처 |
|--------|------|-------------|--------|
| GET | `/api/cost/:id` | 전산업무비 단건 조회 (terminals[] 포함) | `[id].vue`, `form.vue` |
| PUT | `/api/cost/:id` | 전산업무비 단건 수정 | `form.vue` 단건 저장 |
| GET | `/api/ccodem/type/PUL_DTT` | 추진구분 코드 목록 | `[id].vue` (useCodeOptions 내부) |
| GET | `/api/ccodem/type/DFR_CLE` | 지급주기 코드 목록 | `[id].vue`, `form.vue` |
| GET | `/api/ccodem/type/TMN_SVC` | 단말기서비스 코드 목록 | `form.vue` (신규 추가 호출) |

> **백엔드 변경 없음** — 기존 `GET /api/cost/:id` 응답에 `terminals[]` 이미 포함됨.

---

## 5. UI/UX Design

### 5.1 `[id].vue` 변경 레이아웃

```
┌─ PageHeader: 계약명 + [pulDtt 코드명] Tag + 결재현황 Tag + 액션 ─┐
│                                                                    │
├─ col1 (75%)                              col2 (25%) TOC           │
│   ┌─ section#section-contract ───────┐   ┌─ 바로가기 목차 ───┐   │
│   │  계약 정보                       │   │ • 계약 정보       │   │
│   │  비목코드 | 신규/계속 → [코드명] │   │ • 담당 조직       │   │
│   │  계약명 | 계약상대처             │   │ • 예산 및 지급    │   │
│   └───────────────────────────────────┘   │   지급주기 → 코드명│  │
│   ┌─ section#section-org ─────────────┐   │ • 기타 정보       │   │
│   │  담당 조직                        │   │ • 금융정보단말기  │   │
│   └───────────────────────────────────┘   │   ← v-if 조건부   │   │
│   ┌─ section#section-budget ──────────┐   └───────────────────┘   │
│   │  예산 및 지급 정보                │                            │
│   │  지급주기 카드 → [dfrCle 코드명] │                            │
│   └───────────────────────────────────┘                            │
│   ┌─ section#section-etc ─────────────┐                            │
│   │  기타 정보                        │                            │
│   └───────────────────────────────────┘                            │
│   ┌─ section#section-terminal (v-if="isTerminalType") ───────────┐ │
│   │  금융정보단말기 상세목록                                      │ │
│   │  StyledDataTable :value="cost.terminals" (읽기 전용)         │ │
│   │  컬럼: 단말기명, 이용방법, 용도, 서비스, 금액, 지급주기      │ │
│   └───────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

### 5.2 `form.vue` 단건 수정 Form 레이아웃 (`v-else` 블록)

```
┌─ PageHeader: "전산업무비 수정" + 저장/취소 버튼 ─────────────────┐
│                                                                    │
│  ┌─ 계약 정보 섹션 ────────────────────────────────────────────┐  │
│  │  비목코드 (Select)    │  신규/계속 (Select, pulDtt)         │  │
│  │  계약명 (InputText)   │  계약상대처 (InputText)             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ 예산 및 지급 섹션 ─────────────────────────────────────────┐  │
│  │  전산업무비 예산 (InputNumber)  │  통화 (Select)            │  │
│  │  지급주기 (Select, dfrCle)      │  최초지급일 (DatePicker)  │  │
│  │  환율 (InputNumber, 외화시)     │  환율기준일 (외화시)      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ 기타 정보 섹션 ────────────────────────────────────────────┐  │
│  │  정보보호여부 (ToggleButton)  │  증감사유 (Textarea)        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ 담당 조직 섹션 ────────────────────────────────────────────┐  │
│  │  담당자 (AutoComplete + 직원조회 다이얼로그)                │  │
│  │  담당부서 / 담당팀 (자동 입력)                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ 금융정보단말기 섹션 (v-if="isTerminalType") ──────────────┐  │
│  │  <TerminalTableSection v-model="cost.terminals"             │  │
│  │    :dfrCleOptions :tmnSvcOptions :currencyOptions />        │  │
│  └────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 5.3 Component List

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `[id].vue` | `pages/info/cost/` | 조회 화면 (코드명 표시 + 단말기 섹션 추가) |
| `form.vue` | `pages/info/cost/` | 수정 화면 (단건 Form UI + 단말기 TerminalTableSection) |
| `TerminalTableSection` | `components/cost/` | 단말기 편집 DataTable (기존, 재사용) |
| `StyledDataTable` | `components/common/` | 읽기 전용 단말기 표 (`[id].vue`용) |
| `useCodeOptions` | `composables/` | 코드명 변환 (기존, 재사용) |

### 5.4 Page UI Checklist

#### `pages/info/cost/[id].vue` — 조회 화면

- [ ] Tag: `pulDtt` 필드를 PUL_DTT 코드명으로 표시 (헤더 영역 `Tag` 컴포넌트)
- [ ] Field: 계약 정보 섹션 "신규/계속" 항목에 `pulDtt` 코드명 표시 (원시 코드값 대신)
- [ ] Card: 예산 및 지급 정보 섹션 "지급주기" 카드에 `dfrCle` 코드명 표시
- [ ] Section: `itMngcTp === 'IT_MNGC_TP_001'`일 때 `section#section-terminal` 렌더링
- [ ] Table: 단말기 상세목록 `StyledDataTable` — 컬럼: 단말기명, 이용방법, 용도, 서비스, 금액(통화 포맷), 지급주기
- [ ] TOC: `itMngcTp === 'IT_MNGC_TP_001'`일 때 "금융정보단말기 상세목록" TOC 항목 표시
- [ ] TOC: `itMngcTp !== 'IT_MNGC_TP_001'`일 때 단말기 TOC 항목 미표시
- [ ] Observer: 새 단말기 섹션 ID(`section-terminal`)가 IntersectionObserver에 등록됨

#### `pages/info/cost/form.vue` — 수정 화면 (단건 모드)

- [ ] Mode: `?id=…` 쿼리 → `isEditSingle = true` → Form UI 렌더링
- [ ] Mode: `?ids=…` 쿼리 → `isBulk = true` → 기존 DataTable UI 유지 (회귀 없음)
- [ ] Mode: 쿼리 없음 → 기존 신규 등록 UI 유지 (회귀 없음)
- [ ] Section: 계약 정보 섹션 (비목코드 Select, 신규/계속 Select, 계약명 InputText, 계약상대처 InputText)
- [ ] Section: 예산 및 지급 섹션 (전산업무비 예산 InputNumber, 통화 Select, 지급주기 Select, 최초지급일)
- [ ] Section: 기타 정보 섹션 (정보보호여부 ToggleButton, 증감사유 Textarea)
- [ ] Section: 담당 조직 섹션 (담당자 AutoComplete + 직원조회, 담당부서/팀 자동입력)
- [ ] Button: 저장 버튼 → `updateCost(id, cost.value)` 호출 → 성공 시 `/info/cost` 이동
- [ ] Button: 취소 버튼 → `router.back()` 호출
- [ ] Section: `itMngcTp === 'IT_MNGC_TP_001'`일 때 `TerminalTableSection` 표시
- [ ] TerminalTableSection: `v-model="cost.terminals"`, `:dfrCleOptions`, `:tmnSvcOptions`, `:currencyOptions` 바인딩

---

## 6. Error Handling

| Scenario | Handling |
|----------|---------|
| `fetchCost` 실패 | 기존 `v-else-if="error"` 블록으로 처리 (변경 없음) |
| `updateCost` 실패 | `toast.add({ severity: 'error', ... })` — 기존 패턴과 동일 |
| `cost.terminals` 가 undefined | `cost.terminals ?? []` 기본값으로 폴백 |
| `getCodeName` 매칭 실패 | `useCodeOptions` 내부에서 원본 코드값 그대로 반환 (기존 동작) |
| TMN_SVC 코드 API 실패 | `Promise.allSettled` 또는 try/catch로 부분 실패 허용, 빈 배열로 폴백 |

---

## 7. Security Considerations

- [ ] 기존 `middleware: ['budget-period']` 미들웨어 유지 (form.vue)
- [ ] `updateCost` 호출 시 기존 `$apiFetch` 사용으로 httpOnly 쿠키 자동 전송
- [ ] 사용자 입력값은 PrimeVue 컴포넌트(InputText, InputNumber)를 통해 처리 — XSS 위험 없음
- [ ] `v-html` 미사용

---

## 8. Test Plan

### 8.1 Test Scope

| Type | Target | Tool | Phase |
|------|--------|------|-------|
| L1: API | `GET /api/cost/:id` (terminals 포함), `PUT /api/cost/:id` | curl | Do |
| L2: UI | `[id].vue` 코드명/단말기 섹션 조건부 표시, `form.vue` 모드 분기 | Playwright | Do |
| L3: E2E | 조회→수정→저장 플로우 | Playwright | Do |

### 8.2 L1: API Test Scenarios

| # | Endpoint | Method | Test Description | Expected |
|---|----------|--------|-----------------|----------|
| 1 | `/api/cost/:id` | GET | `itMngcTp = IT_MNGC_TP_001` 항목 조회 | 200, `data.terminals` 배열 포함 |
| 2 | `/api/cost/:id` | GET | 일반 항목 조회 | 200, `data.terminals` 없거나 빈 배열 |
| 3 | `/api/cost/:id` | PUT | 단건 수정 저장 | 200, 변경값 반영 |

### 8.3 L2: UI Action Test Scenarios

| # | Page | Action | Expected |
|---|------|--------|----------|
| 1 | `[id].vue` (`IT_MNGC_TP_001`) | 페이지 로드 | "금융정보단말기 상세목록" 섹션 표시, TOC 항목 포함 |
| 2 | `[id].vue` (일반) | 페이지 로드 | 단말기 섹션 미표시, TOC 항목 없음 |
| 3 | `[id].vue` | 페이지 로드 | "신규/계속" 항목에 코드명 표시 (코드ID 미표시) |
| 4 | `[id].vue` | 페이지 로드 | "지급주기" 카드에 코드명 표시 |
| 5 | `form.vue?id=:id` | 페이지 로드 | Form UI 렌더링 (계약정보/예산/기타/담당 섹션) |
| 6 | `form.vue?ids=:ids` | 페이지 로드 | 기존 DataTable UI 렌더링 (회귀 없음) |
| 7 | `form.vue?id=:id` (`IT_MNGC_TP_001`) | 페이지 로드 | TerminalTableSection 표시 |
| 8 | `form.vue?id=:id` | 저장 클릭 | updateCost API 호출 → 성공 시 목록으로 이동 |

### 8.4 L3: E2E Scenario Tests

| # | Scenario | Steps | Success Criteria |
|---|----------|-------|-----------------|
| 1 | 금융정보단말기 조회 | 목록 → IT_MNGC_TP_001 항목 클릭 → 상세 | 코드명 노출, 단말기 섹션 표시 |
| 2 | 단건 수정 저장 | 상세 → 수정 클릭 → 필드 변경 → 저장 | 변경사항 상세 화면에 반영 |
| 3 | 일괄 수정 회귀 | `?ids=…` URL 접근 → DataTable 확인 | 기존 인라인 편집 UI 정상 동작 |

---

## 9. Clean Architecture

### 9.1 이 기능의 레이어 배치

| Component | Layer | Location |
|-----------|-------|----------|
| `[id].vue` | Presentation | `app/pages/info/cost/` |
| `form.vue` | Presentation | `app/pages/info/cost/` |
| `TerminalTableSection.vue` | Presentation | `app/components/cost/` |
| `StyledDataTable.vue` | Presentation | `app/components/common/` |
| `useCodeOptions` | Application | `app/composables/` |
| `useCost` | Application | `app/composables/` |
| `Terminal`, `ItCost` interfaces | Domain | `app/composables/useCost.ts` |
| `$apiFetch`, `useApiFetch` | Infrastructure | `app/plugins/auth.ts`, `app/composables/useApiFetch.ts` |

---

## 10. Coding Convention Reference

### 10.1 이 기능의 컨벤션 적용

| Item | Convention |
|------|-----------|
| script | `<script setup lang="ts">` |
| 컴포넌트 import | 명시적 import (`import StyledDataTable from '~/components/common/StyledDataTable.vue'`) |
| 코드 옵션 로드 | `useCodeOptions(typeCode)` composable 사용 — `$apiFetch` 직접 호출 대신 |
| 단말기 DataTable | `StyledDataTable` 래퍼 사용 (파란 헤더, gridlines 자동) |
| 주석 | 한글 주석, 로직 의도 위주 |

---

## 11. Implementation Guide

### 11.1 File Structure (변경 대상)

```
app/pages/info/cost/
├── [id].vue      ← 수정: useCodeOptions + 단말기 섹션 + TOC 항목
└── form.vue      ← 수정: isBulk/isEditSingle + Form UI v-else 블록
```

### 11.2 Implementation Order

#### Phase 1: `[id].vue` 개선

1. [ ] `useCodeOptions('PUL_DTT')`, `useCodeOptions('DFR_CLE')` 호출 추가 (`<script setup>` 상단)
2. [ ] `isTerminalType` computed 추가 (`cost.value?.itMngcTp === 'IT_MNGC_TP_001'`)
3. [ ] `tocItems`를 computed로 변환 — `isTerminalType` 기반 단말기 항목 조건부 포함
4. [ ] 단말기 섹션용 IntersectionObserver 등록 (`watch(isTerminalType, ...)` 또는 `watchEffect`)
5. [ ] 헤더 `Tag`의 `:value="cost.pulDtt"` → `:value="pulDttName"` 교체
6. [ ] 계약 정보 섹션 "신규/계속" 값 → `pulDttName` 교체
7. [ ] 예산 섹션 "지급주기" 카드 값 → `dfrCleName` 교체
8. [ ] `v-if="isTerminalType"` `section#section-terminal` DataTable 섹션 추가

#### Phase 2: `form.vue` 단건 수정 Form

9. [ ] `isBulk`, `isEditSingle`, `isTerminalType` computed 추가
10. [ ] `tmnSvcOptions` ref 추가, `onActivated` 내 `TMN_SVC` API 호출 추가
11. [ ] `exchangeRates` 로드 → `currencyOptions` computed 계산 (환율 API 재사용)
12. [ ] 기존 `<CostFormTableSection>` 블록을 `v-if="!isEditSingle"`으로 감싸기
13. [ ] `v-else` 블록: 섹션별 Form UI 작성 (계약정보 / 예산지급 / 기타 / 담당조직)
14. [ ] `v-if="isTerminalType"` 조건으로 `<TerminalTableSection>` 추가 (v-model + props)
15. [ ] 저장 핸들러: `updateCost(id, cost.value)` 호출 후 성공 시 이동

### 11.3 Session Guide

#### Module Map

| Module | Scope Key | Description | Estimated Turns |
|--------|-----------|-------------|:---------------:|
| [id].vue 코드명 | `module-1` | useCodeOptions 추가 + pulDtt/dfrCle 코드명 교체 | 5-8 |
| [id].vue 단말기 섹션 | `module-2` | isTerminalType + section-terminal DataTable + TOC | 8-12 |
| form.vue 모드 분기 | `module-3` | isBulk/isEditSingle computed + v-if/v-else 구조 | 5-8 |
| form.vue Form UI | `module-4` | 섹션별 Form 4개 + TerminalTableSection 바인딩 | 15-20 |

#### Recommended Session Plan

| Session | Phase | Scope | Turns |
|---------|-------|-------|:-----:|
| Session 1 | Plan + Design | 전체 | 완료 |
| Session 2 | Do | `--scope module-1,module-2` | 20-25 |
| Session 3 | Do | `--scope module-3,module-4` | 25-30 |
| Session 4 | Check + Report | 전체 | 20-25 |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-01 | Initial draft — Option C (Pragmatic) 선택 | K140024 |
