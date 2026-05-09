---
template: plan
version: 1.3
feature: health-tech-debt
date: 2026-05-09
author: K140024 (박종훈)
project: IT 정보화 Portal (it_backend / it_frontend)
status: Draft
---

# health-tech-debt Planning Document

> **Summary**: 헬스 리포트(2026-05-09) 기반 TypeScript 에러 21건 및 ESLint HIGH/MEDIUM 이슈 해소
>
> **Project**: IT 정보화 Portal
> **Author**: K140024 (박종훈)
> **Date**: 2026-05-09
> **Status**: Draft
> **Source**: `C:/it/.gstack/health-reports/health-report-2026-05-09.md`

---

## Executive Summary

| Perspective | Content |
|-------------|---------|
| **Problem** | TypeScript 타입 에러 21건과 XSS 잠재 위험(`no-v-html`) 등이 코드 안전성과 유지보수성을 저해하고 있음 |
| **Solution** | 파일별 타입 수정 + v-html 사용처 XSS 대응 + AppSidebar/auth.ts 타입 정비 (HIGH+MEDIUM 범위) |
| **Function/UX Effect** | `npx nuxt typecheck` exit 0 달성 → IDE 자동완성 품질 향상, XSS 위험 제거 |
| **Core Value** | 기술 부채 해소로 향후 기능 개발 속도 증가 및 보안 수준 향상 |

---

## Context Anchor

| Key | Value |
|-----|-------|
| **WHY** | 헬스 리포트 종합 87점 → typecheck exit 1 (21건), ESLint no-v-html XSS 위험이 지속되는 상태 |
| **WHO** | 개발팀 (타입 안전성 개선 직접 혜택), 사용자 (XSS 방어로 보안 향상) |
| **RISK** | `EvalSummaryPanel.vue` 타입 수정 시 의존 컴포넌트 렌더 깨짐 가능성 |
| **SUCCESS** | `npx nuxt typecheck` exit 0, `no-v-html` 처리 완료, ESLint errors 34→10 이하 |
| **SCOPE** | Phase 1: TS 에러 수정(21건) / Phase 2: ESLint HIGH/MEDIUM 이슈 / Phase 3: 검증 |

---

## 1. Overview

### 1.1 Purpose

헬스 체크(2026-05-09) 결과 발견된 TypeScript 컴파일 에러 21건과 ESLint HIGH/MEDIUM 이슈를 해소하여
코드베이스의 타입 안전성과 보안 수준을 개선한다.

### 1.2 Background

- 종합 헬스 점수 **87/100** (typecheck 74점, ESLint 72점이 감점 요인)
- `npx nuxt typecheck` exit 1 → CI/CD 파이프라인 도입 시 빌드 차단 요인
- `no-v-html` 미처리 → council-request 뷰어 화면에서 XSS 잠재 위험 존재
- 테스트(Vitest 902건, JUnit 586건)는 모두 통과 — 비즈니스 로직 자체는 정상

### 1.3 Related Documents

- 헬스 리포트: `C:/it/.gstack/health-reports/health-report-2026-05-09.md`
- QA 리포트: `C:/it/.gstack/qa-reports/qa-report-localhost-2026-05-09.md`

---

## 2. Scope

### 2.1 In Scope (HIGH+MEDIUM)

**Phase 1 — TypeScript 에러 수정 (21건)**
- [ ] `EvalSummaryPanel.vue` — `CommitteeList`/`CommitteeMember` 타입 임포트, `summary` optional 처리 (9건)
- [ ] `useTableColumnResize.ts` — `HTMLTableCellElement` 캐스팅, optional chaining (7건)
- [ ] `AppSidebar.vue` — nav 아이템 타입에 `admin?: boolean` 추가 (2건)
- [ ] `plugins/auth.ts` — `$Fetch` 타입 호환 수정 (1건)
- [ ] `pages/info/cost/form.vue` — possibly undefined 처리 (1건)
- [ ] `pages/info/council-request/prepare/[id].vue` — props 타입 불일치 수정 (1건)

**Phase 2 — ESLint HIGH/MEDIUM 이슈**
- [ ] `no-v-html` 검토 및 대응 — `council-request/view/[id].vue` XSS 방어
- [ ] `hwpx.ts` `parseFloat` → `Number.parseFloat` (4건, prefer-globalThis)
- [ ] `plugins/auth.ts` `no-this-alias` 해결

### 2.2 Out of Scope

- 테스트 파일 `no-explicit-any` 22건 (LOW — 별도 스프린트)
- Gradle `output.bin` 파일 잠금 (재기동 시 자연 해소)
- JSDoc `@param`/`@returns` 주석 누락 120건 (LOW)
- 미구현 메뉴 라우트(`/info/estimation` 등) 활성화

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | `npx nuxt typecheck` exit 0 달성 | High | Pending |
| FR-02 | `council-request/view/[id].vue` v-html XSS 방어 처리 | High | Pending |
| FR-03 | `EvalSummaryPanel.vue` 타입 에러 전체 해소 (9건) | High | Pending |
| FR-04 | `useTableColumnResize.ts` 타입 에러 전체 해소 (7건) | High | Pending |
| FR-05 | `AppSidebar.vue` nav 타입 정의 정비 | Medium | Pending |
| FR-06 | `plugins/auth.ts` 타입 호환 및 `no-this-alias` 해결 | Medium | Pending |
| FR-07 | `hwpx.ts` `Number.parseFloat` 4건 수정 | Medium | Pending |
| FR-08 | 기존 Vitest 902건 / JUnit 586건 테스트 모두 유지 | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | Measurement Method |
|----------|----------|-------------------|
| 타입 안전성 | TypeScript 에러 0건 | `npx nuxt typecheck` exit 0 |
| 보안 | v-html XSS 방어 | ESLint `no-v-html` 경고 해소 또는 DOMPurify 적용 |
| 회귀 방지 | 기존 테스트 100% 유지 | `npx vitest run` exit 0 |

---

## 4. Success Criteria

### 4.1 Definition of Done

- [ ] `npx nuxt typecheck` exit 0 (에러 0건)
- [ ] `no-v-html` 처리 완료 (ESLint warning 해소 또는 명시적 sanitize 적용)
- [ ] ESLint errors 34 → 10 이하
- [ ] Vitest 902건 전체 통과 유지

### 4.2 Quality Criteria

- [ ] 수정된 파일에서 새로운 TypeScript 에러 미발생
- [ ] XSS 방어: 사용자 입력 HTML은 반드시 DOMPurify 또는 동등 sanitizer 통과
- [ ] 코드 리뷰 완료 (code-reviewer 에이전트)

---

## 5. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `EvalSummaryPanel.vue` 타입 수정 후 council 화면 렌더 깨짐 | High | Medium | 수정 전 화면 확인, 수정 후 manual QA |
| `useTableColumnResize.ts` 캐스팅 변경 후 테이블 리사이즈 이상 | Medium | Low | Vitest 기존 테스트로 커버, 필요 시 수동 확인 |
| v-html DOMPurify 도입 시 렌더링 차이 | Medium | Low | sanitize 전후 동일 HTML 비교 확인 |
| `plugins/auth.ts` $Fetch 수정 후 인증 흐름 이상 | High | Low | 수정 후 로그인 플로우 수동 확인 |

---

## 6. Impact Analysis

### 6.1 Changed Resources

| Resource | Type | Change Description |
|----------|------|--------------------|
| `app/components/council/evaluation/EvalSummaryPanel.vue` | Vue Component | CommitteeList/CommitteeMember 타입 추가, summary optional 처리 |
| `app/composables/useTableColumnResize.ts` | Composable | HTMLTableCellElement 캐스팅, optional chaining |
| `app/components/AppSidebar.vue` | Vue Component | nav 아이템 타입에 admin 필드 추가 |
| `app/plugins/auth.ts` | Plugin | $Fetch 타입 수정, this alias 제거 |
| `app/pages/info/cost/form.vue` | Page | possibly undefined 옵셔널 처리 |
| `app/pages/info/council-request/prepare/[id].vue` | Page | props 타입 수정 |
| `app/pages/info/council-request/view/[id].vue` | Page | v-html XSS 방어 (DOMPurify 또는 text rendering) |
| `app/utils/hwpx.ts` | Utility | parseFloat → Number.parseFloat (4건) |

### 6.2 Current Consumers

| Resource | Operation | Code Path | Impact |
|----------|-----------|-----------|--------|
| `EvalSummaryPanel.vue` | READ | council 관련 페이지에서 import | 타입만 추가 — 런타임 영향 없음 |
| `useTableColumnResize.ts` | READ | 테이블 컴포넌트에서 import | 캐스팅 변경 — 동작 동일 |
| `AppSidebar.vue` | READ | 레이아웃 전체에서 사용 | 타입 추가만 — 영향 없음 |
| `plugins/auth.ts` | EXEC | 앱 초기화 시 실행 | 인증 흐름 — 신중히 처리 |

### 6.3 Verification

- [ ] EvalSummaryPanel 관련 council 화면 수동 확인
- [ ] 테이블 리사이즈 기능 수동 확인
- [ ] 로그인/인증 플로우 수동 확인

---

## 7. Implementation Order (Recommended)

```
Step 1: EvalSummaryPanel.vue 타입 수정 (9건 — 최다)
Step 2: useTableColumnResize.ts 캐스팅 수정 (7건)
Step 3: plugins/auth.ts $Fetch 타입 + no-this-alias (인증 관련)
Step 4: AppSidebar.vue admin 타입 추가 (2건)
Step 5: cost/form.vue, council-request/prepare/[id].vue (각 1건)
Step 6: council-request/view/[id].vue no-v-html XSS 대응
Step 7: hwpx.ts parseFloat → Number.parseFloat (4건)
Step 8: 전체 typecheck + vitest 검증
```

---

## 8. Next Steps

1. [ ] `/pdca do health-tech-debt` — 파일별 순서대로 수정 시작
2. [ ] `npx nuxt typecheck` 최종 확인
3. [ ] Vitest 전체 재실행 (`npx vitest run`)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-09 | Initial draft — 헬스 리포트 기반 조치 계획 | K140024 |
