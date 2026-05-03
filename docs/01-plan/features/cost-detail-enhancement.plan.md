# 전산업무비 화면 개선 Planning Document

> **Summary**: 전산업무비 단건 조회·수정 화면을 정보화사업 화면 수준으로 개편
>
> **Project**: IT Portal (IT 정보화 포탈)
> **Version**: 1.0
> **Author**: K140024
> **Date**: 2026-05-01
> **Status**: Draft

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | 전산업무비 단건 조회 화면에서 공통코드 코드명 미출력(원시 코드값 노출)과 금융정보단말기 유형(IT_MNGC_TP_001) 상세목록 누락으로 담당자가 정보를 파악하기 위해 별도 화면으로 이동해야 하는 불편이 발생하며, 단건 수정 화면이 일괄 수정 테이블과 동일한 구조로 운영되어 UX가 일관되지 않음 |
| **Solution** | (1) 조회 화면에 `useCodeOptions` composable로 `pulDtt`/`dfrCle` 코드명 표시, (2) `itMngcTp === 'IT_MNGC_TP_001'`일 때 기존 `TerminalTableSection` 컴포넌트로 하단 상세목록 렌더링, (3) 수정 화면을 projects/form.vue 패턴의 Form 기반으로 재작성하고 동일 조건에서 단말기 입력 테이블 추가 |
| **Function/UX Effect** | 조회 화면에서 코드명을 즉시 확인하고 금융정보단말기 목록을 한 페이지에서 파악 가능; 수정 화면이 정보화사업과 동일한 UX 패턴으로 통일되어 학습 비용 감소 |
| **Core Value** | 운영 담당자의 조회·수정 workflow 단순화 및 화면 UX 일관성 확보 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 전산업무비 단건 화면이 조회 품질(코드명 미노출, 단말기 누락)·수정 UX(일괄 편집 테이블) 모두 정보화사업 대비 열위 → 담당자 혼란 및 운영 비효율 발생 |
| **WHO** | IT 정보화 포탈 내부 사용자 (전산업무비 담당 및 조회 권한 보유 임직원, 약 3,000명) |
| **RISK** | 단건 수정 form.vue 전면 재작성 중 기존 일괄 수정 동작(form?ids=…)과의 모드 분리 로직 충돌 가능성 |
| **SUCCESS** | (1) 조회 화면 pulDtt/dfrCle → 코드명 출력 확인, (2) IT_MNGC_TP_001 조건부 단말기 목록 렌더링 확인, (3) 수정 화면 Form 기반 저장/취소 정상 동작, (4) 단말기 입력 테이블 CRUD 연동 확인 |
| **SCOPE** | Phase 1: 조회 화면 개선([id].vue) / Phase 2: 수정 화면 재작성(form.vue 단건 모드) |

---

## 1. Overview

### 1.1 Purpose

전산업무비 단건 조회 화면(`/info/cost/:id`)에 누락된 정보(코드명, 금융정보단말기 목록)를 추가하고, 단건 수정 화면(`/info/cost/form?id=:id`)을 정보화사업 form과 동일한 Form 기반 패턴으로 전환하여 UX 일관성을 달성합니다.

### 1.2 Background

- **공통코드 미노출**: `cost/[id].vue`에서 `pulDtt`(추진구분)와 `dfrCle`(지급주기)를 DB 원시 코드값(`PUL_DTT_001` 등)으로 출력 중. 정보화사업 조회 화면은 `useCodeOptions` composable로 코드명을 정상 노출함.
- **단말기 목록 누락**: 전산업무비 유형이 `IT_MNGC_TP_001`(금융정보단말기)인 경우 관련 단말기 상세 목록(`terminals[]`)이 조회 화면에 표시되지 않음. 별도 `/info/cost/terminal/:id` 경로로만 확인 가능하여 동선 낭비 발생.
- **수정 화면 UX 불일치**: `form.vue`는 일괄 수정을 위한 DataTable 인라인 편집 방식으로 구현되어 있어, 단건 수정(`?id=…`)에서도 동일 UI를 사용. 정보화사업 `projects/form.vue`의 섹션별 Form 방식과 달라 직관성이 낮음.

### 1.3 Related Documents

- PRD: `prds/PRD_20260501.md`
- 참고 조회 화면: `pages/info/projects/[id].vue` (소요자원 상세내용 섹션)
- 참고 수정 화면: `pages/info/projects/form.vue`

---

## 2. Scope

### 2.1 In Scope

- [ ] `[id].vue`: `pulDtt` 코드명 출력 (PUL_DTT 공통코드)
- [ ] `[id].vue`: `dfrCle` 코드명 출력 (DFR_CLE 공통코드)
- [ ] `[id].vue`: `itMngcTp === 'IT_MNGC_TP_001'`일 때 하단에 "금융정보단말기 상세목록" 섹션 추가 (기존 `TerminalTableSection` 재사용 또는 inline DataTable)
- [ ] `[id].vue`: TOC(바로가기 목차)에 "금융정보단말기 상세목록" 항목 조건부 추가
- [ ] `form.vue`: 단건 수정 모드(`?id=…`)에서 Form 기반 레이아웃 렌더링
- [ ] `form.vue`: `itMngcTp === 'IT_MNGC_TP_001'`일 때 단말기 입력 테이블 섹션 추가

### 2.2 Out of Scope

- 기존 일괄 수정 모드(`?ids=…`) UI 변경 없음 — 기존 DataTable 인라인 편집 방식 유지
- 신규 등록 모드(`?id 없음`) 변경 없음 — 기존 방식 유지
- 단말기 단건 상세 페이지 `/info/cost/terminal/:id` 기능 변경 없음
- 백엔드 API 스펙 변경 없음 (기존 `GET /api/cost/:id`, `PUT /api/cost/:id` 사용)
- `useCodeOptions` composable 자체 수정 없음 (기존 composable 활용)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | 조회 화면에서 `pulDtt` 값을 PUL_DTT 공통코드 기준 코드명으로 표시 | High | Pending |
| FR-02 | 조회 화면에서 `dfrCle` 값을 DFR_CLE 공통코드 기준 코드명으로 표시 | High | Pending |
| FR-03 | 조회 화면에서 `itMngcTp === 'IT_MNGC_TP_001'`이면 화면 하단에 "금융정보단말기 상세목록" DataTable 표시 | High | Pending |
| FR-04 | 조회 화면 TOC에 금융정보단말기 섹션 조건부 표시 (IT_MNGC_TP_001일 때만) | Medium | Pending |
| FR-05 | 수정 화면 단건 모드에서 projects/form.vue 패턴의 섹션별 Form UI 제공 | High | Pending |
| FR-06 | 수정 화면에서 `itMngcTp === 'IT_MNGC_TP_001'`이면 단말기 입력 테이블 섹션 표시 | High | Pending |
| FR-07 | 일괄 수정 모드(`?ids=…`)는 기존 DataTable 인라인 편집 방식 유지 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| Performance | 공통코드 API 호출은 기존 `onActivated` 내 병렬 fetch로 유지, 초기 로드 지연 없음 | 브라우저 Network 탭 확인 |
| UX 일관성 | 수정 화면 섹션 구조가 projects/form.vue와 동일한 패턴 준수 | 시각적 대조 검토 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] FR-01~07 모두 구현 및 로컬 환경에서 동작 확인
- [ ] 단건 수정 저장(PUT) 후 조회 화면에 변경사항 반영 확인
- [ ] 일괄 수정 모드(`?ids=…`) 기존 동작 회귀 없음 확인
- [ ] TypeScript 타입 에러 없음 (`npx nuxt typecheck`)
- [ ] ESLint 오류 없음 (`npx eslint .`)

### 4.2 Quality Criteria

- [ ] `cost/[id].vue` 단말기 섹션 조건부 렌더링 단위 확인
- [ ] 수정 화면 Form 바인딩 및 저장 흐름 정상 동작

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `form.vue` 재작성 중 단건/일괄/신규 3가지 모드 분기 복잡도 증가 | High | Medium | 단건 모드(`isEditMode && !isBulk`)만 UI를 교체하고 나머지 모드는 기존 로직 보존; 조건부 렌더링(`v-if`)으로 명확히 분리 |
| `TerminalTableSection.vue` 인터페이스가 수정 화면 요건과 불일치 | Medium | Low | 컴포넌트 props/emits 확인 후 필요 시 조회 전용 재사용, 편집 테이블은 form 내 직접 작성 |
| 공통코드 API 호출 타이밍 문제 (`onActivated` vs `onMounted`) | Low | Low | 기존 `form.vue` 패턴(`onActivated`) 유지, `useCodeOptions` composable 활용으로 캐싱 자동 적용 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `pages/info/cost/[id].vue` | Vue 컴포넌트 | 공통코드 조회 추가 + 단말기 섹션 추가 |
| `pages/info/cost/form.vue` | Vue 컴포넌트 | 단건 수정 모드 UI 재작성 (Form 기반) |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `pages/info/cost/[id].vue` | READ | 전산업무비 목록 → 단건 클릭 → `/info/cost/:id` | 없음 (기능 추가만) |
| `pages/info/cost/form.vue` | READ/WRITE | `/info/cost/form?id=:id` (단건 수정) | 단건 모드 UI 변경 → 회귀 테스트 필요 |
| `pages/info/cost/form.vue` | READ/WRITE | `/info/cost/form?ids=id1,id2` (일괄 수정) | 변경 없음, 기존 동작 유지 |
| `pages/info/cost/form.vue` | CREATE | `/info/cost/form` (신규 등록) | 변경 없음, 기존 동작 유지 |
| `components/cost/TerminalTableSection.vue` | READ | `terminal/[id].vue`에서 사용 중 | `[id].vue`에서 추가 참조 (재사용) |

### 6.3 Verification

- [ ] 단건 수정 저장 후 정상 반영 확인
- [ ] 일괄 수정(`?ids=…`) 기존 동작 확인
- [ ] 신규 등록(`?id 없음`) 기존 동작 확인
- [ ] `TerminalTableSection` 재사용 시 props 타입 충돌 없음 확인

---

## 7. Architecture Considerations

### 7.1 Project Level Selection

| Level | Characteristics | Selected |
|-------|-----------------|:--------:|
| **Starter** | 단순 구조 | ☐ |
| **Dynamic** | Feature 기반 모듈, 기존 composable 재사용 | ☑ |
| **Enterprise** | 엄격한 계층 분리 | ☐ |

### 7.2 Key Architectural Decisions

| Decision | Options | Selected | Rationale |
|----------|---------|----------|-----------|
| 공통코드 조회 방식 | `useCodeOptions` composable / 직접 $apiFetch | `useCodeOptions` | 기존 projects/[id].vue 패턴과 일치, 캐싱 자동 적용 |
| 단말기 목록 표시 방식 | `TerminalTableSection` 재사용 / 인라인 DataTable | 재사용 우선, 불가시 인라인 | DRY 원칙; props 확인 후 결정 |
| form.vue 모드 분기 | `v-if` 조건 렌더링 / 별도 파일 분리 | `v-if` 조건 렌더링 | 라우팅 구조 변경 최소화; 기존 mode 변수 패턴 유지 |
| 단말기 입력 테이블 (수정 화면) | `TerminalFormDialog` 재활용 / 인라인 편집 DataTable | 인라인 편집 DataTable | projects/form.vue의 ResourceTableSection 패턴과 일치 |

### 7.3 Implementation Approach

```
[id].vue 변경사항:
  1. useCodeOptions('PUL_DTT') → getCodeName으로 pulDtt 코드명 출력
  2. useCodeOptions('DFR_CLE') → getCodeName으로 dfrCle 코드명 출력
  3. isTerminalType computed: cost.itMngcTp === 'IT_MNGC_TP_001'
  4. 조건부 섹션: v-if="isTerminalType"
     → section#section-terminal: 단말기 목록 DataTable
  5. tocItems에 조건부 항목 추가

form.vue 변경사항:
  1. isBulk computed: !!route.query.ids
  2. isEditSingle computed: isEditMode && !isBulk
  3. 기존 DataTable UI: v-if="!isEditSingle" 로 감싸기
  4. v-else: Form 기반 UI (계약정보·예산·기타·담당조직 섹션)
  5. itMngcTp === 'IT_MNGC_TP_001' 조건부 단말기 입력 테이블
```

---

## 8. Next Steps

1. [ ] Design 문서 작성 (`/pdca design cost-detail-enhancement`)
2. [ ] `TerminalTableSection.vue` props 인터페이스 확인 (재사용 가능성 검증)
3. [ ] 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-01 | Initial draft from PRD_20260501.md | K140024 |
