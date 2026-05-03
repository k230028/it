# 전산업무비 화면 개선 Analysis Document

> **Feature**: cost-detail-enhancement
> **Phase**: Check
> **Date**: 2026-05-01
> **Match Rate**: 99% (LOW 수정 후)
> **Status**: PASS (≥ 90%)

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

## 1. Match Rate Summary

| Axis | Rate | Weight | Contribution |
|------|------|--------|-------------|
| Structural Match | 100% | 0.2 | 20 |
| Functional Depth | 98% | 0.4 | 39.2 |
| API Contract | 100% | 0.4 | 40 |
| **Overall** | **99%** | — | — |

> Static-only formula (no server): `(Structural × 0.2) + (Functional × 0.4) + (Contract × 0.4)`

---

## 2. Structural Match: 100%

### `pages/info/cost/[id].vue`

| Check | Status | Evidence |
|-------|--------|----------|
| `useCodeOptions('PUL_DTT')` import + call | ✅ | L24, L33 |
| `useCodeOptions('DFR_CLE')` call | ✅ | L34 |
| `StyledDataTable` explicit import | ✅ | L26 |
| `isTerminalType` computed | ✅ | L48 |
| `tocItems` converted to computed (조건부 terminal 항목 포함) | ✅ | L99-105 |
| `section#section-terminal` in template | ✅ | L427-452 |
| IntersectionObserver iterates `tocItems.value` | ✅ | L152-155 |

### `pages/info/cost/form.vue`

| Check | Status | Evidence |
|-------|--------|----------|
| `useCurrencyRates` import + usage | ✅ | L37, L95 |
| `useEmployeeSearch` import + usage | ✅ | L38, L100-105 |
| `TerminalTableSection` import | ✅ | L40 |
| `EmployeeSearchDialog` import | ✅ | L41 |
| `isEditMode`, `isBulk`, `isEditSingle`, `isTerminalType` computeds | ✅ | L86-92 |
| `tmnSvcOptions` ref + TMN_SVC in Promise.all | ✅ | L63, L157 |
| 4-section single-edit form UI | ✅ | L337-555 |
| `EmployeeSearchDialog` in template | ✅ | L559-562 |

---

## 3. Functional Depth: 98%

### `[id].vue` — 코드명 바인딩

| Field | Before | After | Status |
|-------|--------|-------|--------|
| `pulDtt` (헤더 Tag) | raw code ID | `getPulDttName(cost.pulDtt)` | ✅ |
| `pulDtt` (계약정보 섹션) | raw code ID | `getPulDttName(cost.pulDtt) \|\| '-'` | ✅ |
| `dfrCle` (예산 섹션) | raw code ID | `getDfrCleName(cost.dfrCle) \|\| '-'` | ✅ |
| `dfrCle` (단말기 테이블) | — | `getDfrCleName(data.dfrCle)` | ✅ |

### `[id].vue` — 단말기 섹션

| Check | Status | Evidence |
|-------|--------|----------|
| `v-if="isTerminalType"` 조건부 렌더링 | ✅ | L428 |
| `StyledDataTable :value="cost.terminals ?? []"` | ✅ | L435 |
| 컬럼: 단말기명, 이용방법, 용도, 서비스, 금액(formatCurrency), 지급주기(코드명), 비고 | ✅ | L436-451 |
| TOC 조건부 항목 (computed spread) | ✅ | L103-105 |

### `form.vue` — 모드 분기 + Form UI

| Check | Status | Evidence |
|-------|--------|----------|
| `isEditSingle` → Form UI (v-if) | ✅ | L90, L336 |
| `isBulk` → CostFormTableSection (v-else) | ✅ | L88, L566 |
| 계약정보 섹션 (비목코드, 계약명, 계약상대처) | ✅ | L344-368 |
| 예산 및 지급 섹션 (6개 필드) | ✅ | L370-435 |
| 기타정보 섹션 (유형, 구분, 사업코드, 정보보호여부, 증감사유) | ✅ | L437-490 |
| 담당조직 섹션 (AutoComplete + 직원조회 + 읽기전용 필드) | ✅ | L492-536 |
| `TerminalTableSection` 4 props + @update:model-value | ✅ | L547-554 |
| `EmployeeSearchDialog` v-model:visible + @select | ✅ | L559-562 |
| `xcrBseDt` DatePicker (LOW 수정 완료) | ✅ | L402-410 |

---

## 4. API Contract: 100%

| Contract | Design | Code | Match |
|----------|--------|------|-------|
| `useCodeOptions('PUL_DTT')` → `getCodeName` | ✓ | `getPulDttName` | ✅ |
| `useCodeOptions('DFR_CLE')` → `getCodeName` | ✓ | `getDfrCleName` | ✅ |
| `TMN_SVC` fetched in onActivated | ✓ | Promise.all 9번째 | ✅ |
| `IT_MNGC_TP` fetched in onActivated | ✓ | Promise.all 10번째 | ✅ |
| `useCurrencyRates()` → `Object.keys(exchangeRates.value)` | ✓ | L95-97 | ✅ |
| `TerminalTableSection` 4 props 바인딩 | ✓ | L548-552 | ✅ |
| `EmployeeSearchDialog` visible + @select | ✓ | L559-562 | ✅ |

---

## 5. Success Criteria Final Status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| FR-01 | `pulDtt` → PUL_DTT 코드명 표시 | ✅ Met | `[id].vue`:178, 227 |
| FR-02 | `dfrCle` → DFR_CLE 코드명 표시 | ✅ Met | `[id].vue`:326, 447 |
| FR-03 | `itMngcTp === 'IT_MNGC_TP_001'` → section-terminal 렌더링 | ✅ Met | `[id].vue`:428-452 |
| FR-04 | TOC 조건부 항목 + IntersectionObserver 등록 | ✅ Met | `[id].vue`:99-105, 152-155 |
| FR-05 | `isEditSingle` → 섹션별 Form UI (4섹션) | ✅ Met | `form.vue`:90, 337-536 |
| FR-06 | `isTerminalType` → TerminalTableSection + EmployeeSearchDialog | ✅ Met | `form.vue`:92, 539-562 |
| FR-07 | `isBulk` → 기존 CostFormTableSection 유지 | ✅ Met | `form.vue`:88, 566-577 |

**Success Rate: 7/7 (100%)**

---

## 6. Gap List

| # | Severity | FR | Description | Resolution |
|---|----------|----|-------------|-----------|
| 1 | ~~LOW~~ | FR-05 | `xcrBseDt` InputText → DatePicker UX 불일치 | ✅ 수정 완료 (DatePicker + onActivated Date 변환 추가) |
| 2 | INFO | FR-04 | `TocItem.children?` 미사용 dead branch | 무시 (기존 패턴, 향후 정리 가능) |
| 3 | INFO | FR-06 | `addCostRow` default `itMngcTp: 'IT_MNGC_TP_001'` 타당성 | 무시 (기존 동작 유지) |

---

## 7. TypeScript Check

```
npx nuxt typecheck → 오류 없음 (2026-05-01 기준)
```

---

## 8. Decision Record Verification

| Decision | Design | Implementation | Followed? |
|----------|--------|----------------|-----------|
| Option C (Pragmatic) — 신규 파일 0개 | 0 new files | 0 new files ✓ | ✅ |
| `useCodeOptions` composable 재사용 | `[id].vue` | L33-34 ✓ | ✅ |
| `StyledDataTable` explicit import | `[id].vue` | L26 ✓ | ✅ |
| `TerminalTableSection` 재사용 (form.vue) | form.vue | L40, L547 ✓ | ✅ |
| `isBulk`/`isEditSingle` computed 명시적 분기 | form.vue | L88-90 ✓ | ✅ |
| `v-if/v-else` 조건부 렌더링 | form.vue | L335-578 ✓ | ✅ |

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-05-01 | Initial Check — gap-detector 분석 + LOW 수정 후 최종 | K140024 |
