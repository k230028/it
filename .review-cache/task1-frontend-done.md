# 한글 주석 추가·수정 처리 완료 목록

**처리일:** 2026-05-26

---

## 금번 신규 처리 (비즈니스 로직 미변경, 주석만 수정)

app/composables/useItProjectRows.ts | 19-32 | L-02: ItProjectRow 인터페이스 7개 필드 한글 인라인 설명 추가
app/composables/useItProjectRows.ts | 33-40 | L-02: useItProjectRows 함수 @param/@returns JSDoc 추가
app/utils/hwpx-package-xml.ts | 38 | L-03: 영문 "Hangul" → "한글(Hangul)" 한글 통일
app/utils/hwpx.ts | 1-16 | L-04: 한 줄 설명 → @file/@description/의존성/주의사항 표준 헤더 블록으로 확장
app/types/tiptapVariable.ts | 1-7 | L-05: 경로 주석(비표준) 제거 + @file JSDoc 블록으로 교체, Design Ref 한글 설명 추가
app/components/common/InlineEditCell.vue | 29-32 | L-09: options/suggestions eslint-disable 바로 아래 any 이유 한글 주석 추가
app/composables/useAdminApi.ts | 310 | L-01: 영문 인라인 주석 → 한글 주석으로 변환 (sttDt URL 보간 주의사항)
app/composables/useTiptapTableTools.ts | 491-506 | M-07: 중복 JSDoc 블록 2개 → 1개로 통합 (두 블록 내용 모두 보존)
app/composables/usePdfReport.ts | 175 | F-M-08: 인코딩 깨진 TODO 주석 (â 문자) → 올바른 UTF-8 한글로 재작성

---

## 기처리 확인 항목 (이미 완료 — 금번 수정 불필요)

app/composables/useApprovalStatus.ts | 1-59 | H-01: @file 헤더·코드표·각 함수 @param/@returns 이미 존재
app/composables/useNotifications.ts | 36-110 | H-02: refresh @throws, markRead/markAllRead/remove @param/@returns/@throws 이미 존재
app/composables/useCostListPage.ts | 367,429,724,989 | H-03: TODO/FIXME 한글 주석 이미 존재
app/composables/useTiptapTableTools.ts | 126,137,165,237 | H-04: any 4곳 한글 이유 주석 이미 존재
app/composables/useTiptapTableTools.ts | 633-635 | H-04: 빈 catch FIXME 이미 존재
app/composables/useTiptapImageInsertion.ts | 66,118 | H-05: FIXME 주석 이미 존재
app/composables/useOrganization.ts | 119-120 | H-06: any 이유 한글 주석 이미 존재
app/composables/usePdfReport.ts | 40-42,238-239,500-501 | H-07: any 이유 한글 주석 이미 존재
app/composables/useHwpxExport.ts | 103-104 | H-08: any 이유 한글 주석 이미 존재
app/composables/useEmployeeSearch.ts | 1-110 | H-09: @file 헤더·@param/@returns·FIXME 이미 존재
app/plugins/auth.ts | 80-82 | M-01: any 이유 한글 주석 이미 존재
app/stores/review.ts | 152-153 | M-02: ReviewerApiItem 인라인 선언 이유 한글 주석 이미 존재
app/composables/useGlobalSearch.ts | 46-88 | M-03: searchByName @param/@returns, loadAll 설명 이미 존재
app/composables/useCouncilCodes.ts | 86-103 | M-04: @param 설명이 실제 서버 코드값 형식으로 기재됨
app/composables/useBudgetAllocationSummary.ts | 80-86 | M-05: JSDoc 단일 블록으로 이미 정리됨
app/composables/useExcalidrawAttachment.ts | 88-91 | M-06: 싱글톤 이유 한글 주석 이미 존재
app/composables/useTiptapTableTools.ts | 547-548 | M-07: console.warn 메시지 이미 한글 처리됨
app/composables/useMentionAutocomplete.ts | 213-233 | M-08: @returns 블록 이미 존재
app/composables/useBoardPost.ts | 22-27 | M-09: @param blbMngNo 설명 및 nullable 여부 이미 기재
app/composables/useBudgetPeriod.ts | 36-50 | M-10: composable @returns 이미 존재
app/composables/useTiptapVariables.ts | 34-57 | M-11: getFetch, getApiBase @returns 이미 존재
app/composables/useDocuments.ts | 76-98 | M-12: fetchDocument 실패 조건 @throws 이미 존재
app/composables/useBudgetStatus.ts | 22-64 | L-06: 개별 fetch 함수 @param/@returns 이미 존재
app/composables/useAdminTableEdit.ts | 202 | L-07: FIXME 주석 이미 존재
app/stores/auth.ts | 227,239 | L-08: TODO 주석 이미 존재
app/components/common/EmployeeSearchDialog.vue | 88-91 | F-H-01: FIXME 주석 이미 존재
app/components/common/EmployeeSearchDialog.vue | 204-210 | F-H-02: FIXME 주석 이미 존재
app/components/ExcalidrawWrapper.vue | 85-89 | F-H-03: FIXME 주석 이미 존재
app/components/ExcalidrawWrapper.vue | 150-153 | F-H-04: TODO 주석 이미 존재
app/composables/useCostListPage.ts | 366-368 | F-H-05: FIXME 주석 이미 존재
app/composables/useCostListPage.ts | 987-988 | F-H-06: FIXME 주석 이미 존재
app/composables/useEmployeeSearch.ts | 75-79 | F-H-07: FIXME 주석 이미 존재
app/composables/useGlobalSearch.ts | 82-87 | F-H-08: FIXME 주석 이미 존재
app/composables/useHwpxExport.ts | 124-125 | F-H-09: FIXME 주석 이미 존재
app/composables/useTiptapImageInsertion.ts | 66,118 | F-H-10: FIXME 주석 이미 존재
app/pages/approval/list.vue | 213-218 | F-H-11: FIXME+TODO 주석 이미 존재
app/pages/approval/[apfMngNo].vue | 49-50 | F-H-12: TODO 주석 이미 존재
app/pages/board/[blbMngNo]/[nacMngNo]/index.vue | 38 | F-H-13: FIXME 주석 이미 존재
app/pages/budget/report.vue | 171 | F-H-14: TODO 주석 이미 존재
app/pages/budget/report.vue | 250 | F-H-15: FIXME 주석 이미 존재
app/pages/info/projects/report.vue | 164-165 | F-H-16: TODO 주석 이미 존재
app/pages/info/projects/report.vue | 199 | F-H-17: TODO 주석 이미 존재
app/pages/info/cost/form.vue | 184-185 | F-H-18: FIXME 주석 이미 존재
app/pages/info/projects/form.vue | 604-606 | F-C-01: FIXME 주석 이미 존재
