---
template: design
version: 1.3
feature: budget-ui-improvements
date: 2026-05-10
author: K140024 (박종훈)
project: IT 정보화 Portal (it_frontend / it_backend)
status: Draft
architecture: Option C — Pragmatic Balance
---

# budget-ui-improvements Design Document

> **Plan**: `docs/01-plan/features/budget-ui-improvements.plan.md`
> **Architecture**: Option C — Pragmatic Balance (기존 composable 확장 + 신규 useDeptFilter 1개)

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 사용자 불편 신고(텍스트 선택 불가, 부서 데이터 혼재) + 운영 중 발견된 UI 결함 18건을 PRD 기반으로 일괄 처리 |
| **WHO** | 기획·예산 담당 임직원(데이터 입력·조회 빈도 최고), 부서 관리자(부서별 데이터 격리 필요), IT 운영팀(화면 유지보수) |
| **RISK** | 부서 필터링 `bbrC` 파라미터 추가 시 기존 전체 목록 API 응답 변화 → 관리자 화면 회귀 필요; `useTableCellSelection` paste 확장 시 기존 복사 경로 회귀 필요 |
| **SUCCESS** | 18개 FR 전량 구현 완료, 기존 Vitest 단위 테스트(1,046+) 통과, TDD 테스트 추가, 관리자 전체 조회 회귀 없음 |
| **SCOPE** | Phase 1: CSS/정렬/버튼/다이얼로그 → Phase 2: 부서 필터링(bbrC) → Phase 3: paste 확장 → Phase 4: 일괄 다운로드 |

---

## 1. Overview

### 1.1 Architecture Decision Record

**선택: Option C — Pragmatic Balance**

| 항목 | 결정 | 근거 |
|------|------|------|
| 셀 붙여넣기 | `useTableCellSelection`에 `pasteEnabled` 옵션 추가 | 기존 composable에 복사 로직이 이미 있어 paste 버퍼를 내부에서 자연스럽게 관리 가능. 파일 추가 없음. |
| 부서 필터링 | `useDeptFilter.ts` composable 신규 1개 | `bbrC`/ADMIN 예외 로직을 1곳에서 관리. 4개 목록 페이지가 import해 사용. |
| 백엔드 필터링 | Controller RequestParam + QueryDSL BooleanBuilder | 기존 Service/Repository 패턴 그대로 따름. |
| Excel 멀티 시트 | `utils/excel.ts`에 `exportMultiSheetToExcel` 추가 | 기존 `exportRowsToExcel` 구조 유지, 연도별 시트 분리 추가. |

### 1.2 Convention Decisions (재발 방지)

이번 작업에서 도출된 재발 방지 컨벤션:

| 문제 | 컨벤션 |
|------|-------|
| `user-select: none` 전역 적용으로 텍스트 선택 불가 | 새 요소 추가 시 전역 비활성화 대신 whitelist(`main.css §텍스트 선택 허용`) 추가 |
| 부서 필터 누락 | 신규 목록 API는 `bbrC` 선택 파라미터 필수, 프론트는 `useDeptFilter` 사용 |
| 금액 표시 불일치 | 금액 표시는 항상 `formatBudget(utils/common.ts)` 사용, 직접 `toLocaleString` 금지 |
| composable 중복 생성 | 신규 composable 전 기존 확장 가능 여부 먼저 검토 (`CLAUDE.md §4.7` 규칙 강화) |

---

## 2. Component Design

### 2.1 Frontend 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `app/assets/css/main.css` | 수정 | `.p-datatable-tbody td` 텍스트 선택 허용 추가 |
| `app/composables/useTableCellSelection.ts` | 수정 | `pasteEnabled`, `onPaste` 핸들러, 내부 paste 버퍼 추가 |
| `app/composables/useDeptFilter.ts` | **신규** | `bbrC` / ADMIN 예외 로직 캡슐화 |
| `app/pages/info/cost/index.vue` | 수정 | 칼럼 재배치, 행 클릭, AutoComplete, 금액 서식, 부서 필터 |
| `app/pages/info/projects/index.vue` | 수정 | 기본 정렬 내림차순, 부서 필터 |
| `app/pages/budget/index.vue` | 수정 | 부서 필터 |
| `app/pages/approval/list.vue` | 수정 | 결재 상신 버튼 비활성화 조건, 부서 필터 |
| `app/pages/budget/status/index.vue` | 수정 | 소계 카드 CSS grid 수정 |
| `app/components/EmployeeSearchDialog.vue` | 수정 | empNm ASC 정렬, 스크롤 클릭 수정 |
| `app/pages/info/cost/[id].vue` | 수정 | pasteEnabled 옵션 전달 |
| `app/pages/budget/work/[id]/index.vue` | 수정 | pasteEnabled 옵션 전달 |
| `app/pages/info/projects/[id]/index.vue` | 수정 | pasteEnabled 옵션 전달 |
| `app/utils/excel.ts` | 수정 | `exportMultiSheetToExcel` 함수 추가 |

### 2.2 Backend 변경 목록

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| `CostController.java` | 수정 | `GET /api/cost` `@RequestParam(required=false) String bbrC` 추가 |
| `ProjectController.java` | 수정 | `GET /api/projects` `@RequestParam(required=false) String bbrC` 추가 |
| `BudgetController.java` | 수정 | `GET /api/budget` `@RequestParam(required=false) String bbrC` 추가 |
| `ApplicationController.java` | 수정 | `GET /api/applications` `@RequestParam(required=false) String bbrC` 추가 |
| `CostService.java` | 수정 | `getList(bbrC)` 시그니처 추가 |
| `ProjectService.java` | 수정 | `getList(bbrC)` 시그니처 추가 |
| `BudgetService.java` | 수정 | `getList(bbrC)` 시그니처 추가 |
| `ApplicationService.java` | 수정 | `getList(bbrC)` 시그니처 추가 |
| `CostRepositoryImpl.java` | 수정 | `bbrC` BooleanBuilder 조건 추가 |
| `ProjectRepositoryImpl.java` | 수정 | `bbrC` BooleanBuilder 조건 추가 |
| `BbudgtRepositoryImpl.java` | 수정 | `bbrC` BooleanBuilder 조건 추가 |
| `ApplicationRepositoryImpl.java` | 수정 | `bbrC` BooleanBuilder 조건 추가 |

---

## 3. Interface Specifications

### 3.1 useTableCellSelection 확장 API

```typescript
// Design Ref: §2.1 — Option C paste 확장
export function useTableCellSelection(
    containerRef: Ref<HTMLElement | null>,
    enabled?: Ref<boolean>,
    options?: {
        pasteEnabled?: boolean;        // Ctrl+V 붙여넣기 활성화 (기본: false)
        editableColumns?: string[];    // 붙여넣기 허용 칼럼 field명 목록
        onCellPaste?: (rowIndex: number, colField: string, value: string) => void;
    }
): { clearSelection: () => void }
```

**내부 동작 (paste 경로)**:
1. `onKeyDown`에서 `Ctrl+V` 감지 (기존 Esc 핸들러와 병존)
2. `pasteBuffer`(내부 `let` 변수, `onCopy`에서 set)에서 값 조회
3. 현재 `anchor` 셀 → 해당 `<tr>`의 `data-row-index` + `<td>`의 `data-col-field` 읽기
4. `editableColumns` 포함 여부 확인 후 `onCellPaste(rowIndex, colField, value)` 호출
5. 호출자(페이지)가 콜백에서 `tableData[rowIndex][colField] = value` 반영

### 3.2 useDeptFilter composable API

```typescript
// Design Ref: §2.1 — 부서 필터링 단일 진실 공급원
// 파일: app/composables/useDeptFilter.ts

export function useDeptFilter(): {
    deptFilter: ComputedRef<string | undefined>;
}

// 사용 예
const { deptFilter } = useDeptFilter();
const { data } = useApiFetch('/api/cost', {
    query: computed(() => ({ bbrC: deptFilter.value }))
});
```

**로직**:
- `user.athIds.includes(ROLE.ADMIN)` → `undefined` (전체 조회)
- `user.bbrC`가 있으면 → 해당 값 반환
- `user.bbrC`가 빈 문자열 또는 user가 null → `undefined`

### 3.3 백엔드 bbrC 필터링 패턴

```java
// Design Ref: §2.2 — QueryDSL BooleanBuilder bbrC 조건 패턴
// 모든 4개 RepositoryImpl에 동일하게 적용

BooleanBuilder builder = new BooleanBuilder();
// ... 기존 조건들 ...
if (StringUtils.hasText(bbrC)) {
    builder.and(entity.bbrC.eq(bbrC));
}
```

### 3.4 exportMultiSheetToExcel API

```typescript
// Design Ref: §2.1 — 멀티 시트 Excel 유틸
interface SheetConfig {
    sheetName: string;
    columns: { header: string; key: string; width?: number }[];
    rows: Record<string, unknown>[];
}

export async function exportMultiSheetToExcel(
    sheets: SheetConfig[],
    fileName: string
): Promise<void>
```

---

## 4. API Contract

### 4.1 변경되는 API 엔드포인트

| Method | Path | 추가 Query Param | 동작 변화 |
|--------|------|-----------------|----------|
| GET | `/api/cost` | `bbrC` (optional) | 지정 시 해당 부서만, 미지정 시 전체 |
| GET | `/api/projects` | `bbrC` (optional) | 지정 시 해당 부서만, 미지정 시 전체 |
| GET | `/api/budget` | `bbrC` (optional) | 지정 시 해당 부서만, 미지정 시 전체 |
| GET | `/api/applications` | `bbrC` (optional) | 지정 시 해당 부서만, 미지정 시 전체 |

**하위 호환성**: 기존 `bbrC` 없는 호출은 전체 조회로 동일하게 동작. Breaking change 없음.

---

## 5. State Management

### 5.1 useDeptFilter 상태

- Pinia 불필요. `computed` + `useAuth()` 조합으로 충분.
- `useAuth()`의 `user` ref가 변경되면 `deptFilter`도 자동 갱신.

### 5.2 useTableCellSelection paste 버퍼 상태

- 외부 노출 없는 `let pasteBuffer: string | null = null` 내부 변수.
- `onCopy` 이벤트에서 선택된 첫 번째 셀 값을 저장.
- 범위 복사(멀티셀) 시 `pasteBuffer = null` (범위 붙여넣기는 이번 스코프 외).

---

## 6. Error Handling

| 상황 | 처리 방법 |
|------|----------|
| `navigator.clipboard` 미지원 환경 | `pasteBuffer`만 사용 (fallback). 에러 억제. |
| `onCellPaste` 콜백 유효성 검증 실패 | 호출자 책임. composable은 콜백만 호출. |
| `bbrC` 없는 계정 | `undefined` → 전체 조회 (기존 동작 유지). |
| Excel 멀티 시트 생성 실패 | `try-catch`로 감싸 toast 에러 알림. |

---

## 7. CSS 변경 상세

### 7.1 main.css 텍스트 선택 whitelist 확장

```css
/* 추가: DataTable 셀 내 텍스트 선택 허용 */
.p-datatable-tbody td,
.p-datatable-tbody td * {
    user-select: text;
}

/* 예외: 인터랙티브 요소는 기본 동작 유지 */
.p-datatable-tbody td .p-checkbox,
.p-datatable-tbody td button {
    user-select: none;
}
```

**컨벤션**: `user-select: none` 전역 정책 불변. 텍스트 선택 필요 시 whitelist에만 추가.

### 7.2 예산현황 카드 CSS

```css
.budget-status-grid {
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
```

---

## 8. Test Plan (TDD)

### 8.1 TDD 원칙

**모든 신규 로직은 RED → GREEN → REFACTOR 순서로 작성합니다.**

### 8.2 신규 테스트 파일

| 파일 | 대상 | 우선순위 |
|------|------|----------|
| `tests/unit/composables/useDeptFilter.test.ts` | 신규 composable TDD | High |
| `tests/unit/composables/useTableCellSelection.paste.test.ts` | paste 경로 TDD | High |
| `tests/unit/utils/excel.multisheet.test.ts` | 멀티 시트 유틸 TDD | Medium |

### 8.3 useDeptFilter 테스트 케이스

- 관리자(ROLE_ADMIN) → `undefined`
- 일반 사용자 → `user.bbrC`
- `bbrC` 빈 문자열 → `undefined`
- `user` null → `undefined`

### 8.4 useTableCellSelection paste 테스트 케이스

- 단일 셀 복사 후 `onCellPaste` 콜백 호출 검증
- `editableColumns`에 없는 칼럼 → 붙여넣기 무시
- `pasteEnabled=false` → Ctrl+V 무시
- `pasteBuffer=null` → 붙여넣기 무시

### 8.5 백엔드 테스트 갱신

각 RepositoryImpl 테스트에 `bbrC` 조건 케이스 추가:
- `bbrC` 지정 → 해당 부서 데이터만 반환
- `bbrC` null → 전체 반환

---

## 9. Implementation Guide

### 9.1 구현 순서

```
Phase 1: CSS/정렬/버튼/다이얼로그 (프론트 전용)
├── 1.1  main.css DataTable td user-select 추가
├── 1.2  EmployeeSearchDialog.vue empNm ASC + 스크롤 클릭 수정
├── 1.3  approval/list.vue 결재선 empty → 상신 버튼 disabled
├── 1.4  info/cost/index.vue 칼럼 재배치 + 행 클릭 + AutoComplete + formatBudget
├── 1.5  info/projects/index.vue sortField/sortOrder 내림차순
└── 1.6  budget/status/index.vue 소계 카드 grid 수정

Phase 2: 부서 필터링
├── 2.1  [RED] useDeptFilter.test.ts 작성
├── 2.2  [GREEN] useDeptFilter.ts 구현
├── 2.3  [RED] 4개 RepositoryImpl bbrC 테스트 추가
├── 2.4  [GREEN] 4개 RepositoryImpl bbrC 조건 추가
├── 2.5  4개 Service getList(bbrC) 시그니처 추가
├── 2.6  4개 Controller @RequestParam bbrC 추가
└── 2.7  4개 목록 페이지 useDeptFilter 적용

Phase 3: 셀 붙여넣기
├── 3.1  [RED] useTableCellSelection.paste.test.ts 작성
├── 3.2  [GREEN] useTableCellSelection.ts pasteEnabled + onCellPaste 추가
└── 3.3  인라인 편집 3개 페이지 pasteEnabled + onCellPaste 적용

Phase 4: 일괄 다운로드
├── 4.1  [RED] excel.multisheet.test.ts 작성
├── 4.2  [GREEN] utils/excel.ts exportMultiSheetToExcel 추가
└── 4.3  다운로드 모달 멀티셀렉트(최대 2개) + 멀티 시트 호출
```

### 9.2 Session Guide

| 세션 | 범위 | 예상 시간 |
|------|------|----------|
| Session 1 | Phase 1 전체 | 2~3시간 |
| Session 2 | Phase 2 백엔드 | 2~3시간 |
| Session 3 | Phase 2 프론트 | 1~2시간 |
| Session 4 | Phase 3 | 2~3시간 |
| Session 5 | Phase 4 | 1~2시간 |

---

## 10. Convention Changes (재발 방지)

아래 컨벤션을 CLAUDE.md 및 README.md에 반영합니다 (§11 참조).

| 항목 | 규칙 |
|------|------|
| `user-select` | 전역 정책 불변. whitelist에만 추가. |
| 부서 필터링 | 신규 목록 페이지/API는 `useDeptFilter` / `bbrC` 선택 파라미터 필수. |
| 금액 표시 | `formatBudget(utils/common.ts)` 전용. `toLocaleString` 직접 호출 금지. |
| 기존 composable 확장 우선 | 신규 파일 전 기존 확장 가능 여부 먼저 검토. |
| TDD 의무화 | 신규 composable, utils, 백엔드 서비스 로직은 RED→GREEN→REFACTOR 필수. |
