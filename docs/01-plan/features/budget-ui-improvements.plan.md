---
template: plan
version: 1.3
feature: budget-ui-improvements
date: 2026-05-10
author: K140024 (박종훈)
project: IT 정보화 Portal (it_frontend / it_backend)
status: Draft
---

# budget-ui-improvements Planning Document

> **Summary**: 전산업무비·예산·사업·결재 화면 18건 UI 개선 — CSS 표시 오류 수정, 부서 필터링 백엔드 연동, 셀 복사·붙여넣기, 일괄 다운로드
>
> **Project**: IT 정보화 Portal
> **Author**: K140024 (박종훈)
> **Date**: 2026-05-10
> **Status**: Draft
> **Source**: `C:/it/prds/PRD_20260509.md`

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 전산업무비·예산·사업·결재 화면에서 텍스트 선택 불가, 칼럼 레이아웃 깨짐, 부서 간 데이터 노출, 셀 편집 생산성 저하 등 사용자 불편이 지속 접수되고 있음 |
| **Solution** | CSS 수정·컬럼 재배치 등 프론트 단독 수정(Phase 1), 부서 필터링 백엔드 API `bbrC` 파라미터 추가(Phase 2), `useCellCopyPaste` composable 도입(Phase 3), 일괄 다운로드·천단위 서식(Phase 4) 순서로 단계적 개선 |
| **Function/UX Effect** | 목록 가독성 및 데이터 입력 속도 향상, 부서별 데이터 격리로 정보 보호 강화, 다운로드 편의성 개선 |
| **Core Value** | 임직원 3,000명이 매일 사용하는 예산·사업 관리 화면의 생산성·정확성·보안성을 실질적으로 높임 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 사용자 불편 신고(텍스트 선택 불가, 부서 데이터 혼재) + 운영 중 발견된 UI 결함 18건을 PRD 기반으로 일괄 처리 |
| **WHO** | 기획·예산 담당 임직원(데이터 입력·조회 빈도 최고), 부서 관리자(부서별 데이터 격리 필요), IT 운영팀(화면 유지보수) |
| **RISK** | 부서 필터링 `bbrC` 파라미터 추가 시 기존 전체 목록 API 응답 변화 → 관리자 화면 회귀 필요; `useCellCopyPaste` 클립보드 API 브라우저 호환성(IE 미지원, iOS Safari 제한) |
| **SUCCESS** | 18개 FR 전량 구현 완료, 기존 Vitest 단위 테스트 통과(1,046+), 부서 필터링 적용 3개 페이지 통합 테스트, 관리자 전체 조회 회귀 없음 |
| **SCOPE** | Phase 1: CSS·정렬·버튼·다이얼로그 수정(FR-01~10, 프론트 전용) → Phase 2: 부서 필터링 백엔드+프론트(FR-11~15) → Phase 3: 셀 복사·붙여넣기(FR-16~17) → Phase 4: 일괄 다운로드·천단위 서식(FR-18) |

---

## 1. Overview

### 1.1 Purpose

`PRD_20260509.md`에 정리된 전산업무비·예산·사업·결재 화면 UI 개선 요구사항 18건을 구현하여 사용자 생산성 및 데이터 정확성을 높인다.

### 1.2 Background

- 사용자 피드백: `user-select: none` 전역 CSS로 텍스트 선택이 막혀 있어 복사·붙여넣기 불가.
- 전산업무비 목록: 칼럼 순서·폭이 실무 흐름과 맞지 않고, 자동완성이 미작동.
- 부서 필터링 부재: 로그인 사용자의 `bbrC`(부서 코드)와 무관하게 전체 목록 노출.
- 인라인 편집 생산성: 셀 값을 복사해 인접 셀에 붙여넣는 기능이 없어 반복 입력 발생.
- 일괄 다운로드: 현재 1개 연도만 지원, 2개 연도 동시 다운로드 요청.

---

## 2. Scope

### 2.1 In-Scope

| # | 영역 | 내용 |
|---|------|------|
| FR-01 | 공통 CSS | `user-select: none` 제거 → 텍스트 선택·복사 허용 |
| FR-02 | 직원조회 다이얼로그 | 결과 정렬 기준 `empNm` ASC, 스크롤 후 클릭 동작 수정 |
| FR-03 | 결재 상신 버튼 | 결재선 미지정 시 버튼 비활성화(disabled 상태) |
| FR-04 | 전산업무비 목록 | 칼럼 재배치: 비용항목·금액·부서명·신청일 순 |
| FR-05 | 전산업무비 목록 | 관리번호 칼럼 표시 추가 |
| FR-06 | 전산업무비 목록 | 행 클릭 → 상세 페이지 이동 |
| FR-07 | 전산업무비 목록 | 검색 자동완성(업체명·프로젝트명) AutoComplete 수정 |
| FR-08 | 전산업무비 목록 | 금액 천단위 서식(₩1,000,000) 적용 |
| FR-09 | 사업 목록 | `PRJ_YR` 기본 정렬 내림차순 적용 |
| FR-10 | 예산현황 카드 | 소계 카드 레이아웃 깨짐 CSS 수정 |
| FR-11 | 전산업무비 목록 | 부서 필터링: 로그인 `bbrC` 기준 백엔드 파라미터 추가 |
| FR-12 | 사업 목록 | 부서 필터링: 로그인 `bbrC` 기준 백엔드 파라미터 추가 |
| FR-13 | 예산 목록 | 부서 필터링: 로그인 `bbrC` 기준 백엔드 파라미터 추가 |
| FR-14 | 결재 목록 | 부서 필터링: 로그인 `bbrC` 기준 백엔드 파라미터 추가 |
| FR-15 | 공통 | 관리자(ROLE_ADMIN)는 부서 필터 무시, 전체 데이터 조회 유지 |
| FR-16 | 인라인 편집 공통 | `useCellCopyPaste` composable 구현 (Ctrl+C/V 셀 복사·붙여넣기) |
| FR-17 | 인라인 편집 전 페이지 | `useCellCopyPaste` 적용: 전산업무비·예산·사업 인라인 편집 페이지 |
| FR-18 | 일괄 다운로드 | 2개 연도 선택 다운로드 + 금액 천단위 서식 포함 |

### 2.2 Out-of-Scope

- 모바일·반응형 레이아웃 개선 (별도 과제)
- 신규 도메인 기능 추가 (현황 집계 리포트 등)
- 백엔드 쿼리 성능 최적화 (TASK.md DB/JPA 항목으로 별도 추적)

---

## 3. Requirements

### 3.1 Functional Requirements

#### Phase 1 — CSS·정렬·버튼·다이얼로그 (프론트 전용)

**FR-01: 텍스트 선택 허용**
- 전역 CSS에서 `user-select: none`(또는 동등 Tailwind 클래스) 제거.
- 입력 필드, 버튼은 기존 동작 유지.
- 검증: 목록 테이블에서 마우스 드래그로 텍스트 선택 가능.

**FR-02: 직원조회 다이얼로그 정렬·스크롤**
- `GET /api/users` 응답을 `empNm` ASC 정렬 후 렌더링.
- 목록 스크롤 후 항목 클릭 시 올바른 직원 선택.

**FR-03: 결재 상신 버튼 비활성화**
- 결재선(`approvalLine`) 배열이 비어 있으면 상신 버튼 `disabled`.
- 결재선 추가 후 즉시 활성화.

**FR-04~08: 전산업무비 목록 개선**
- 칼럼 순서: 관리번호 | 비용항목 | 금액(천단위) | 부서명 | 신청일 | 상태.
- 행 클릭 → `/info/cost/{id}` 이동.
- 업체명·프로젝트명 AutoComplete: `minLength=2` 이상에서만 API 호출.
- 금액: `toLocaleString('ko-KR')` 또는 `formatBudget` 유틸 사용.

**FR-09: 사업 목록 기본 정렬**
- `StyledDataTable` `sortField="prjYr"` `sortOrder="-1"` (내림차순).

**FR-10: 예산현황 카드 CSS 수정**
- 소계 카드가 잘리지 않도록 `grid-template-columns` 수정.

#### Phase 2 — 부서 필터링 (백엔드 API + 프론트)

**FR-11~14: 부서별 목록 필터링**
- 백엔드: `CostController`, `ProjectController`, `BudgetController`, `ApplicationController`에 선택적 `bbrC` 쿼리 파라미터 추가.
- 서비스 레이어: `bbrC` 파라미터 비어 있으면 전체 조회, 값 있으면 해당 부서만.
- QueryDSL: `BEQ` 조건 추가 (`Bcostm.bbrC`, `Bprojm.bbrC`, `Bbbugtm.bbrC`, `Cappla.bbrC`).
- 프론트: `useAuth()` → `user.value.bbrC`를 API query 파라미터로 자동 전달.

**FR-15: 관리자 전체 조회**
- `ROLE_ADMIN` 사용자는 `bbrC` 파라미터를 전달하지 않아 전체 데이터 조회.
- 프론트: `user.value.athIds.includes(ROLE.ADMIN)` 체크 → `bbrC` 파라미터 생략.

#### Phase 3 — 셀 복사·붙여넣기 (useCellCopyPaste)

**FR-16: useCellCopyPaste composable**
- `useCellCopyPaste(tableData: Ref<Row[]>, editableColumns: string[])` 형태.
- `Ctrl+C`: 포커스된 셀 값 → 클립보드 + 내부 버퍼 저장.
- `Ctrl+V`: 내부 버퍼 값 → 포커스된 셀에 붙여넣기 (편집 가능 셀만).
- `keydown` 이벤트는 `@keydown.ctrl.c.exact` / `@keydown.ctrl.v.exact` 사용.
- 클립보드 API 실패 시 내부 버퍼만 사용 (silent fallback).

**FR-17: 인라인 편집 페이지 적용**
- 대상: `pages/info/cost/[id]/index.vue`, `pages/budget/work/[id]/index.vue`, `pages/info/projects/[id]/index.vue` 등 인라인 편집(`DataTable`+`InputText` 조합) 사용 페이지 전체.

#### Phase 4 — 일괄 다운로드·서식

**FR-18: 2개 연도 일괄 다운로드**
- 다운로드 대화상자에 연도 멀티셀렉트(최대 2개) 추가.
- 각 연도별 데이터를 동일 Excel 워크북의 시트로 분리 저장.
- 금액 컬럼에 `formatBudget` (천단위 + 원 단위) 적용.

### 3.2 Non-Functional Requirements

- 기존 Vitest 테스트 1,046건 모두 통과 유지.
- `useCellCopyPaste` 단위 테스트 추가 (Vitest).
- 부서 필터링 API 변경: 기존 테스트가 `bbrC` 무관하게 동작하도록 백엔드 테스트 갱신.

---

## 4. Architecture Considerations

### 4.1 부서 필터링 설계

백엔드 서비스 레이어에서 `bbrC`가 `null`·빈 문자열이면 WHERE 조건 미추가(전체 조회), 값이 있으면 `and(entity.bbrC.eq(bbrC))` 추가. `@PreAuthorize`는 변경 없음.

```java
// QueryDSL 조건 패턴
BooleanBuilder builder = new BooleanBuilder();
if (StringUtils.hasText(bbrC)) {
    builder.and(entity.bbrC.eq(bbrC));
}
```

프론트엔드에서 `useApiFetch` query 파라미터로 전달:

```ts
const { user } = useAuth();
const bbrC = user.value?.athIds.includes(ROLE.ADMIN) ? undefined : user.value?.bbrC;
const { data } = useApiFetch('/api/costs', { query: { bbrC } });
```

### 4.2 useCellCopyPaste 설계

- `useTableCellSelection`(기존 composable)을 참고해 포커스 셀 관리.
- 클립보드 접근: `navigator.clipboard.writeText` (HTTPS 환경). 실패 시 내부 `ref<string | null>(null)` 버퍼만 사용.
- 붙여넣기 대상 셀의 유효성은 `editableColumns` 배열 포함 여부로 판단.

---

## 5. Success Criteria

| SC-01 | 모든 화면에서 마우스 드래그로 텍스트 선택 가능 |
|-------|----------------------------------------------|
| SC-02 | 전산업무비·사업·예산·결재 목록이 로그인 부서 데이터만 표시 |
| SC-03 | ROLE_ADMIN 사용자는 전 부서 데이터 조회 가능 |
| SC-04 | 인라인 편집 테이블에서 Ctrl+C/V로 셀 값 복사·붙여넣기 동작 |
| SC-05 | 일괄 다운로드 시 2개 연도 Excel 시트 분리 생성 |
| SC-06 | 기존 단위 테스트 전량 통과, `useCellCopyPaste` 단위 테스트 추가 |

---

## 6. Risks

| Risk | 확률 | 영향 | 대응 |
|------|------|------|------|
| 부서 필터 추가 후 관리자 화면 전체 조회 회귀 | 중 | 높음 | Phase 2 완료 후 ROLE_ADMIN 계정으로 회귀 테스트 |
| 클립보드 API iOS Safari 제한 | 중 | 낮음 | 내부 버퍼 폴백 구현, 지원 브라우저 안내 |
| 인라인 편집 페이지 다수 적용 시 이벤트 중첩 | 낮음 | 중 | `useCellCopyPaste` 내부에서 중복 리스너 방지 (`onMounted`/`onUnmounted`) |
| bbrC 미설정 계정(인증 이슈) | 낮음 | 중 | `bbrC` 없으면 관리자 처리와 동일(전체 조회) |

---

## 7. Impact Analysis

| 영역 | 변경 수준 | 파일 예상 |
|------|----------|-----------|
| 전역 CSS | 낮음 | `assets/css/main.css` 또는 Tailwind 클래스 |
| 전산업무비 목록 페이지 | 중간 | `pages/info/cost/index.vue` |
| 사업 목록 페이지 | 낮음 | `pages/info/projects/index.vue` |
| 예산 목록 페이지 | 낮음 | `pages/budget/index.vue` |
| 결재 목록 페이지 | 낮음 | `pages/approval/list.vue` |
| 예산현황 카드 | 낮음 | `pages/budget/status/index.vue` |
| 결재 상신 버튼 | 낮음 | `pages/approval/form.vue` 또는 관련 컴포넌트 |
| 인라인 편집 페이지들 | 중간 | 3~5개 페이지 + `useCellCopyPaste.ts` 신규 |
| 일괄 다운로드 | 중간 | `utils/excel.ts` + 다운로드 모달 컴포넌트 |
| 백엔드 API (4개 컨트롤러·서비스·QueryDSL) | 중간 | 4개 Controller + 4개 Service + 4개 RepositoryImpl |

---

## 8. Implementation Phases

### Phase 1 — CSS·정렬·버튼·다이얼로그 (FR-01~10)
- 예상 기간: 1~2일
- 백엔드 변경 없음, 프론트 단독 수정
- 완료 기준: FR-01~10 체크리스트 전항목 확인

### Phase 2 — 부서 필터링 (FR-11~15)
- 예상 기간: 2~3일
- 백엔드: 4개 API `bbrC` 파라미터 + QueryDSL 조건 추가
- 프론트: `useAuth` bbrC 전달 + ADMIN 예외 처리
- 완료 기준: 일반사용자 부서 격리, 관리자 전체 조회 확인

### Phase 3 — 셀 복사·붙여넣기 (FR-16~17)
- 예상 기간: 1~2일
- `useCellCopyPaste` composable TDD 구현 + 인라인 편집 페이지 전체 적용
- 완료 기준: Vitest 단위 테스트 통과, Ctrl+C/V 동작 확인

### Phase 4 — 일괄 다운로드·서식 (FR-18)
- 예상 기간: 1일
- `utils/excel.ts` 멀티 시트 지원 확장
- 완료 기준: 2개 연도 Excel 파일 시트 분리 확인

---

## 9. Dependencies

- `stores/auth.ts` — `user.bbrC`, `user.athIds` (이미 존재)
- `useTableCellSelection.ts` — `useCellCopyPaste` 참고용 (이미 존재)
- `utils/excel.ts` — 멀티 시트 확장 대상 (이미 존재)
- 백엔드 QueryDSL `RepositoryImpl` 4개 — `bbrC` 조건 추가 대상

---

## 10. Open Questions

| # | 질문 | 담당 | 기한 |
|---|------|------|------|
| Q-01 | `bbrC`가 없는 계정(예: SSO 미동기화)은 전체 조회 허용 여부? | 기획팀 | Phase 2 착수 전 |
| Q-02 | 일괄 다운로드 2개 연도 초과 선택 시 에러 메시지 문구? | UX 담당 | Phase 4 착수 전 |
