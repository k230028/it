# info-plan-form-budget-tables Planning Document

> **Summary**: 정보기술부문계획 등록 화면(/info/plan/form) 미리보기에 자본예산·일반관리비 테이블 카드 추가
>
> **Project**: IT Portal (IT 정보화 포탈)
> **Version**: Nuxt 4 / Spring Boot 4.0.5
> **Author**: K140024
> **Date**: 2026-05-05
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | `/info/plan/form` 미리보기 영역에 자본예산·일반관리비 요약 카드가 없어, 계획 생성 시 예산 구분별 집계 현황을 직관적으로 파악하기 어렵다 |
| **Solution** | 선택된 정보화사업(PUL_DTT 기준)과 전산업무비(DUP_IOE·IOE-239-0200 기준) 데이터를 클라이언트 사이드에서 집계하여 전산예산 카드 아래에 두 카드를 추가 |
| **Function/UX Effect** | 계획 담당자가 [생성] 버튼 클릭 후 신규/계속 사업별 자본예산과 비목별 일반관리비를 즉시 확인 가능; 새 API 호출 없이 이미 로드된 데이터로 표시 |
| **Core Value** | 계획 품의서 작성 시 필요한 예산 구분별 테이블을 시스템에서 자동 생성, 수기 집계 오류 방지 |

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

### 1.1 Purpose

`/info/plan/form` 미리보기 영역에 **자본예산 테이블 카드**와 **일반관리비 테이블 카드**를 추가하여, 계획 담당자가 [생성] 버튼 클릭 후 예산 구분별 집계를 즉시 확인할 수 있도록 한다.

### 1.2 Background

현재 `/info/plan/form` 미리보기에는 다음 카드가 존재한다:
1. 예산 총계 카드 (총예산/자본예산/일반관리비 합계)
2. 정보화사업 요약 카드 (부문/본부별 건수·편성예산)
3. **전산예산 카드** (`PlanBudgetAllocationCard`) - 비목별 편성 결과
4. 부문별 사업목록
5. 사업유형별 사업목록

PRD에 따라 전산예산 카드 아래에 두 개의 카드를 추가한다:
- **자본예산 카드**: 신규/계속 사업별 자본예산 집계
- **일반관리비 카드**: 비목(DUP_IOE)·세목(IOE-239-0200) 기준 일반관리비 집계

### 1.3 Related Documents

- PRD: `prds/PRD_20260505.md`
- 현재 form.vue: `it_frontend/app/pages/info/plan/form.vue`
- 전산예산 카드: `it_frontend/app/components/plan/PlanBudgetAllocationCard.vue`
- 전산업무비 composable: `it_frontend/app/composables/useCost.ts`
- 계획 composable: `it_frontend/app/composables/usePlan.ts`

---

## 2. Scope

### 2.1 In Scope

- [ ] `PlanCapitalBudgetCard.vue` 신규 컴포넌트 생성
  - 정보화사업 스냅샷(prjSnapshots)을 PUL_DTT 코드별로 집계
  - 신규(PUL_DTT_001)/계속(PUL_DTT_002) 구분, Top 2 사업명(assetBg 기준), 편성액 합계 표시
- [ ] `PlanExpenseCostCard.vue` 신규 컴포넌트 생성
  - 전산업무비 데이터를 DUP_IOE(구분)/IOE-239-0200(세목) 기준으로 그룹핑
  - rowspan/colspan 구조로 구분·세목·주요내역·편성예산·소계·합계 표시
- [ ] `form.vue` 수정
  - `costDetailsRef` ref 추가 (PlanExpenseCostCard에 raw ItCost[] 전달용)
  - 두 카드를 PlanBudgetAllocationCard 아래에 삽입
- [ ] 단위 선택(`selectedUnit`) 연동: 두 카드 모두 formatBudget 적용

### 2.2 Out of Scope

- 백엔드 API 신규 개발/변경 없음
- 기존 저장(save) 로직에 새 카드 데이터 포함 없음 (snapshot에 추가 저장하지 않음)
- 계획 상세 조회(`/info/plan/[id]`) 화면 변경 없음 (PRD 범위 외)
- 공통코드 관리 API 신규 개발 없음 (기존 `useCodeOptions` 활용)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | [생성] 버튼 클릭 후 자본예산 카드가 전산예산 카드 아래에 표시됨 | High | Pending |
| FR-02 | 자본예산 카드: PUL_DTT_001(신규) / PUL_DTT_002(계속)으로 정보화사업 그룹핑 | High | Pending |
| FR-03 | 자본예산 카드: 각 구분의 Top 2 사업명(assetBg 기준 내림차순) 표시 | High | Pending |
| FR-04 | 자본예산 카드: 각 구분의 assetBg 합계를 오른쪽 정렬로 표시 | High | Pending |
| FR-05 | 일반관리비 카드가 자본예산 카드 아래에 표시됨 | High | Pending |
| FR-06 | 일반관리비 카드: DUP_IOE 코드명을 구분 컬럼으로 rowspan 표시 | High | Pending |
| FR-07 | 일반관리비 카드: IOE-239-0200 코드 기준 세목별 최대 금액 사업명 표시 | High | Pending |
| FR-08 | 일반관리비 카드: 세목별 소계 + 전체 합계 행 표시 | High | Pending |
| FR-09 | 두 카드 모두 selectedUnit(예산 단위) 변경에 반응하여 금액 재표시 | Medium | Pending |
| FR-10 | 선택된 사업이 없거나 해당 데이터가 없을 때 빈 상태 메시지 표시 | Medium | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 두 카드 모두 이미 로드된 데이터 기반 computed — 추가 API 호출 없음 | Vue DevTools / Network 탭 |
| Consistency | 기존 카드와 동일한 스타일(파란 헤더 bg-blue-900, border-zinc-200) 적용 | 시각적 검토 |
| Accessibility | 테이블 thead/tbody/tfoot 구조 적용 | 화면 검토 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] 자본예산 카드: PRD 샘플 테이블과 동일한 구조·데이터로 렌더링
- [ ] 일반관리비 카드: PRD 샘플 테이블과 동일한 rowspan/colspan 구조로 렌더링
- [ ] 기존 저장·조회·삭제 기능 회귀 없음
- [ ] `npx nuxt typecheck` 타입 오류 없음
- [ ] `npx eslint .` 린트 오류 없음

### 4.2 Quality Criteria

- [ ] 선택 사업 없을 때 두 카드 모두 빈 상태 처리
- [ ] pulDtt가 undefined이거나 PUL_DTT_001/002 외 값일 때 안전 처리
- [ ] costBg=0인 전산업무비 항목의 표시/제외 처리

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 공통코드(DUP_IOE, IOE-239-0200) 매핑이 실제 DB 데이터와 불일치 | High | Medium | 개발 전 useCodeOptions('DUP_IOE') 호출로 코드 목록 확인 |
| ItCost의 ioeC 필드가 세목 그룹핑에 사용 가능한지 불명확 | High | Medium | 백엔드 Cost 엔티티의 ioeC 필드 의미 확인 후 구현 |
| costSnapshots에 ioeC가 누락 | Medium | High | costDetails(raw ItCost[])를 별도 ref로 유지하여 직접 전달 |
| rowspan/colspan 계산 오류로 테이블 레이아웃 깨짐 | Medium | Medium | useBudgetAllocationSummary 기존 로직 참고 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `app/pages/info/plan/form.vue` | Vue 페이지 | costDetailsRef ref 추가, 두 신규 카드 컴포넌트 삽입 |
| `app/components/plan/PlanCapitalBudgetCard.vue` | Vue 컴포넌트 (신규) | 자본예산 테이블 카드 |
| `app/components/plan/PlanExpenseCostCard.vue` | Vue 컴포넌트 (신규) | 일반관리비 테이블 카드 |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `form.vue` | READ | `/info/plan/form` 페이지 | 기존 기능 유지, 미리보기 영역에 카드 추가만 |
| `costDetails` (handleGenerate 지역변수) | READ | form.vue handleGenerate() | ref로 승격하여 PlanExpenseCostCard에 전달 |
| `PlanBudgetAllocationCard` | READ | form.vue template | 변경 없음 (아래에 새 카드 삽입) |

### 6.3 Verification

- [ ] 기존 [저장] 버튼 동작 변경 없음
- [ ] 기존 정보화사업 요약 카드, 전산예산 카드 렌더링 변경 없음
- [ ] selectedUnit 변경 시 기존 카드와 새 카드 모두 반응

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

기존 IT Portal 프로젝트 — **Dynamic** 수준 유지

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 데이터 소스 | 신규 API vs 기존 데이터 재활용 | 기존 데이터 재활용 | handleGenerate에서 이미 로드한 prjDetails/costDetails 활용 |
| 컴포넌트 구조 | form.vue 인라인 vs 별도 컴포넌트 | 별도 컴포넌트 | PlanBudgetAllocationCard와 동일 패턴 |
| 일반관리비 그룹핑 | 컴포넌트 computed vs composable | 컴포넌트 내 computed | 재사용 가능성 낮음; 복잡성 최소화 |
| 공통코드 조회 | useCodeOptions vs 하드코딩 | useCodeOptions 우선 | 코드명 변경 대응; 실제 코드값 확인 필요 |

### 7.3 구현 구조

```
it_frontend/app/components/plan/
├── PlanBudgetAllocationCard.vue      (기존 - 전산예산)
├── PlanCapitalBudgetCard.vue         (신규 - 자본예산)
└── PlanExpenseCostCard.vue           (신규 - 일반관리비)
```

**PlanCapitalBudgetCard.vue**
```
Props: { prjSnapshots: PlanProjectItem[], unit: string }
Computed:
  - PUL_DTT_001(신규) / PUL_DTT_002(계속) 그룹핑
  - top2Names: assetBg 내림차순 Top 2 사업명
  - totalAssetBg: 그룹 내 assetBg 합계
Template: 구분 | 주요 내역 | 편성액
```

**PlanExpenseCostCard.vue**
```
Props: { costDetails: ItCost[], unit: string }
Computed:
  - DUP_IOE 코드(pulDtt 또는 ioeC 상위)별 구분 그룹핑
  - IOE-239-0200 코드(ioeC)별 세목 집계
  - 최고 금액 사업명(cttNm) 추출
  - 소계 + 합계 행 계산
Template: 구분(rowspan) | 세목 | 주요 내역 | 편성예산
```

---

## 8. Open Questions (구현 전 확인 필요)

| # | 질문 | 영향 |
|---|------|------|
| Q1 | `ItCost.ioeC`가 IOE-239-0200 기준 세목 코드인가? | PlanExpenseCostCard 세목 컬럼 |
| Q2 | `ItCost.pulDtt`가 DUP_IOE 기준 구분 코드인가? (전산용역비/전산제비 등) | PlanExpenseCostCard 구분 컬럼 |
| Q3 | 전산업무비 중 costBg=0인 항목은 일반관리비 카드에서 제외하는가? | 필터링 로직 |
| Q4 | 자본예산 카드 "주요 내역" 표시: 줄바꿈(`<br>`) vs 쉼표 구분? | UI 렌더링 |
| Q5 | pulDtt가 undefined인 정보화사업은 자본예산 카드에서 어떻게 처리? | 예외 처리 |

---

## 9. Next Steps

1. [ ] Q1~Q5 확인 후 Design 문서 작성 (`/pdca design info-plan-form-budget-tables`)
2. [ ] `PlanCapitalBudgetCard.vue` 구현
3. [ ] `PlanExpenseCostCard.vue` 구현
4. [ ] `form.vue` 수정 (costDetailsRef 추가, 카드 삽입)
5. [ ] 타입체크·린트 통과 확인

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-05 | Initial draft (PRD_20260505.md 기반) | K140024 |
