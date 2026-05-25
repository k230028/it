# 한글 주석 누락/오류 탐지 목록 — it_frontend

**생성일:** 2026-05-26
**분석 범위:** C:\it\it_frontend\app 하위 모든 .ts / .vue 파일
**판단 기준:** CLAUDE.md §4.1 — 신규 주석 한글 의무, composable 반환 함수 입력값/실패 조건 기록, 실제 동작과 불일치 기존 주석은 수정 대상

---

## 요약

| 심각도 | 건수 |
|--------|------|
| HIGH   | 9    |
| MEDIUM | 12   |
| LOW    | 9    |
| **합계** | **30** |

---

## HIGH — 즉시 보완 필요

### H-01 useApprovalStatus.ts — 파일 전체 주석 없음

**파일:** app/composables/useApprovalStatus.ts
**행:** 1–14 (파일 전체)

**문제:** 파일 헤더 주석 전무. APF_STS_LABEL 코드표(001=결재중/002=결재완료/003=반려/004=회수)와 labelOf, isInProgress, isTerminated 함수의 목적·실패 조건 설명이 없음. CLAUDE.md §4.1 위반.

**보완 요소:**
- 파일 상단 헤더 블록 (파일명, 용도, 코드 테이블 설명)
- APF_STS_LABEL 상수에 코드값 의미 인라인 주석
- useApprovalStatus JSDoc (@returns 각 함수 설명)
- labelOf / isInProgress / isTerminated 입력값·반환값 설명

---

### H-02 useNotifications.ts — refresh @throws 누락, 함수별 @param/@throws 미기재

**파일:** app/composables/useNotifications.ts

**문제:**
- refresh() — 사용자 주도 호출 시 에러 전파 여부가 JSDoc에 기록되지 않음 (폴링과 동작 다름)
- markRead(infMngNo) — @param infMngNo 없음, @throws 없음
- markAllRead() — @returns 반환값(업데이트 개수) 설명 없음, @throws 없음
- remove(infMngNo) — @param infMngNo 없음, @throws 없음

---

### H-03 useCostListPage.ts — silent failure catch 블록 다수

**파일:** app/composables/useCostListPage.ts

**행 및 문제:**
- L366-369: onMounted catch — TODO 주석만 있고 toast 미구현. 오류 시 사용자 피드백 없음
- L427-430: 직원 검색 catch — 동일 패턴, toast 미구현
- L723-726: 삭제 루프 catch — itMngcNo 식별자 없이 에러 로깅만. 어떤 항목이 실패했는지 불명
- L988: 업로드 루프 catch {} — 에러 객체 자체 없어 디버깅 불가

**영향:** CLAUDE.md §4.2.1 위반 — API 실패 시 toast 필수.

---

### H-04 useTiptapTableTools.ts — any 4곳 한글 설명 없음, 빈 catch

**파일:** app/composables/useTiptapTableTools.ts

**문제:**
- L126: editor: any — ProseMirror Editor 타입 import 없이 사용. 한글 이유 주석 없음
- L135: attrs: any — 테이블 cell 속성 타입 불명. 한글 이유 주석 없음
- L163: selection as any — CellSelection 타입 단언. 한글 이유 주석 없음
- L234: Map<number, any> — 셀 데이터 맵 값 타입 불명. 한글 이유 주석 없음
- L629-630: catch (e) {} — 에러 변수 선언만 있고 처리 없음. silent failure

**참고:** useGuideDocuments.ts는 동일한 ProseMirror any에 한글 이유 주석을 상세히 달아 기준 사례가 됨.

---

### H-05 useTiptapImageInsertion.ts — 프로덕션 코드 console.error 3곳

**파일:** app/composables/useTiptapImageInsertion.ts
**행:** L69, L119, L144

**문제:** 세 곳 모두 console.error 단독 사용. CLAUDE.md §4.2.1에서 console.error 단독 금지, toast 의무화. 동일 파일에 blob URL 메모리 릭 FIXME가 3회 중복 — 하나의 FIXME로 통합하거나 TASK.md에 등록 필요.

---

### H-06 useOrganization.ts — any[] 이유 주석 없음

**파일:** app/composables/useOrganization.ts
**행:** L118–120

**문제:** buildOrgTree 함수 내 any[] 파라미터에 한글 이유 주석 없음. PrimeVue TreeNode 타입 제약으로 인해 any를 쓰는 이유 기록 필요.

---

### H-07 usePdfReport.ts — any 3곳 한글 설명 없음, 캐시 변수 영문

**파일:** app/composables/usePdfReport.ts

**문제:**
- L40-41: 모듈 레벨 cachedVfs, cachedFonts 변수 설명이 영문만. 한글 추가 필요
- L238-239: docDefinition: any — pdfmake 타입 정의 부재로 any 사용. 한글 이유 주석 없음
- L499-501: ornYn any 단언 — 한글 이유 주석 없음

---

### H-08 useHwpxExport.ts — any 이유 주석 없음

**파일:** app/composables/useHwpxExport.ts
**행:** L103–104

**문제:** parsed 변수 any 타입. HWPX XML 파싱 결과 구조 불명확으로 any 사용. 이유 한글 주석 필요.

---

### H-09 useEmployeeSearch.ts — @returns/@param 누락, FIXME 방치

**파일:** app/composables/useEmployeeSearch.ts

**문제:**
- composable 함수 자체 @returns 없음 — openEmployeeSearch, employeeSearchState 등 반환값 설명 누락
- openEmployeeSearch 함수 @param 없음
- L76: FIXME 주석이 후속 조치 없이 방치됨 — TASK.md 등록 또는 구체적 액션 명시 필요

---

## MEDIUM — 보완 권장

### M-01 plugins/auth.ts — any 설명 주석 위치 분리

**파일:** app/plugins/auth.ts
**행:** L80-81 vs L124

**문제:** eslint-disable-next-line L80 바로 다음 줄(L81)에 any 사용. 이유 주석은 L124에 있어 코드 리뷰 시 연결성 낮음. any 선언 바로 위에 이유 주석 추가 또는 eslint-disable 주석에 이유 합치기 권장.

---

### M-02 stores/review.ts — ReviewerApiItem 인라인 타입 설명 없음

**파일:** app/stores/review.ts
**행:** L152–153

**문제:** ReviewerApiItem 인터페이스가 인라인 선언됨. types/review.ts로 분리하지 않은 이유를 한글 주석으로 설명 필요.

---

### M-03 useGlobalSearch.ts — JSDoc 위치 불일치, @param/@returns 누락

**파일:** app/composables/useGlobalSearch.ts

**문제:**
- JSDoc 블록이 함수 선언부와 물리적으로 분리되어 일반 주석처럼 보임
- searchByName — @param / @returns 없음
- loadAll — 정식 함수 JSDoc 아님

---

### M-04 useCouncilCodes.ts — @param 예시 코드값 불일치

**파일:** app/composables/useCouncilCodes.ts
**행:** L86, L94, L102

**문제:** @param 예시가 DRAFT, INFO_SYS, MAND 등 임의 식별자. 실제 코드는 서버 숫자 코드값(예: 001, 002). 주석이 실제 동작과 불일치 — CLAUDE.md §4.1 불일치 주석은 수정 대상 해당.

---

### M-05 useBudgetAllocationSummary.ts — JSDoc 블록 중복

**파일:** app/composables/useBudgetAllocationSummary.ts
**행:** L81–88

**문제:** 동일 함수에 JSDoc 블록 두 개 존재. 하나 삭제 필요.

---

### M-06 useExcalidrawAttachment.ts — 싱글톤 변수 설명 불충분

**파일:** app/composables/useExcalidrawAttachment.ts
**행:** L88–89

**문제:** _pendingFlMngNos 모듈 레벨 싱글톤 변수에 왜 싱글톤인지, 초기화 책임 설명 없음. useExcalidrawDialog.ts는 같은 패턴에 상세 한글 설명을 달아 대조적.

---

### M-07 useTiptapTableTools.ts — JSDoc 중복, 영문 console.warn

**파일:** app/composables/useTiptapTableTools.ts
**행:** L499–503, L544–545

**문제:**
- L499-503: 동일 함수 JSDoc 블록 중복
- L544-545: console.warn('Sync failed:', e) — 영문 메시지. 한글 또는 구조화 로거 권장

---

### M-08 useMentionAutocomplete.ts — composable @returns 없음

**파일:** app/composables/useMentionAutocomplete.ts

**문제:** composable 함수에 @returns 없음. 반환하는 suggestions, loading, search 등의 의미 설명 누락.

---

### M-09 useBoardPost.ts — @param 설명 비어있음

**파일:** app/composables/useBoardPost.ts

**문제:** @param blbMngNo 설명이 빈 문자열. 게시판 관리번호 의미 및 nullable 여부 기록 필요.

---

### M-10 useBudgetPeriod.ts — composable @returns 없음

**파일:** app/composables/useBudgetPeriod.ts

**문제:** composable 함수에 @returns 없음.

---

### M-11 useTiptapVariables.ts — getFetch, getApiBase @returns 없음

**파일:** app/composables/useTiptapVariables.ts

**문제:** 내부 헬퍼 getFetch, getApiBase에 @returns 없음. Vitest/런타임 분기 로직이 있어 설명 필요.

---

### M-12 useDocuments.ts — fetchDocument 실패 조건 누락

**파일:** app/composables/useDocuments.ts

**문제:** fetchDocument JSDoc에 실패 조건(@throws, 404/권한 없음 등) 설명 없음. CLAUDE.md §4.1 — public API 실패 조건 기록 의무 위반.

---

## LOW — 정합성 개선

### L-01 useAdminApi.ts — 영문 인라인 주석

**파일:** app/composables/useAdminApi.ts
**행:** L311–312

**문제:** 인라인 주석이 영문으로 작성됨. CLAUDE.md §4.1 위반.

---

### L-02 useItProjectRows.ts — @param/@returns 누락, 인터페이스 필드 설명 없음

**파일:** app/composables/useItProjectRows.ts

**문제:**
- useItProjectRows(prjSnapshots) — @param prjSnapshots 없음, @returns 없음
- ItProjectRow 인터페이스 — sector, subLabel, showSector, sectorRowspan, hideSectorRightBorder, hideSectorBottomBorder 필드 인라인 설명 없음

---

### L-03 utils/hwpx-package-xml.ts — 영문 혼재

**파일:** app/utils/hwpx-package-xml.ts
**행:** L38

**문제:** Hangul 영문이 한글 주석 중간에 혼재. 전체 한글 표기로 통일 필요.

---

### L-04 utils/hwpx.ts — 표준 헤더 블록 미작성

**파일:** app/utils/hwpx.ts

**문제:** 한 줄 파일 설명만 있고, 함수 목록/의존성/주의사항 등 표준 헤더 블록 없음. 다른 utils 파일들과 형식 불일치.

---

### L-05 types/tiptapVariable.ts — 비표준 헤더, Design Ref 영문

**파일:** app/types/tiptapVariable.ts
**행:** L1

**문제:**
- L1이 경로 주석(// it_frontend/app/types/tiptapVariable.ts) 형식으로 비표준
- Design Ref 설명이 영문만. 한글 보완 필요

---

### L-06 useBudgetStatus.ts — 개별 fetch 함수 실패 조건 누락

**파일:** app/composables/useBudgetStatus.ts

**문제:** 파일 헤더는 있으나 개별 fetch 함수들에 실패 조건(@throws, 권한 에러 등) 설명 없음.

---

### L-07 useAdminTableEdit.ts — FIXME 방치

**파일:** app/composables/useAdminTableEdit.ts
**행:** L202

**문제:** // FIXME: catch 블록 비어있음 주석 방치. TASK.md 등록 또는 수정 필요.

---

### L-08 stores/auth.ts — 빈 catch에 TODO만

**파일:** app/stores/auth.ts
**행:** L227, L239

**문제:** 빈 catch 블록에 TODO 주석만 있고 처리 미구현. TASK.md 등록 필요.

---

### L-09 components/common/InlineEditCell.vue — eslint-disable 이유 주석 없음

**파일:** app/components/common/InlineEditCell.vue
**행:** L30–31

**문제:** options/suggestions props에 eslint-disable 처리되어 있으나 왜 any를 써야 하는지 한글 설명 없음.

---

## 우선 조치 목록 (Top 10)

| 순위 | 파일 | 이슈 | 심각도 |
|------|------|------|--------|
| 1 | useApprovalStatus.ts | 파일 전체 주석 없음 | HIGH |
| 2 | useTiptapTableTools.ts | any 4곳 + 빈 catch | HIGH |
| 3 | useCostListPage.ts | silent failure catch 4곳 | HIGH |
| 4 | useTiptapImageInsertion.ts | console.error 3곳 | HIGH |
| 5 | usePdfReport.ts | any 3곳 영문 설명 | HIGH |
| 6 | useNotifications.ts | @throws/@param 다수 누락 | HIGH |
| 7 | useOrganization.ts | any[] 이유 주석 없음 | HIGH |
| 8 | useHwpxExport.ts | any 이유 주석 없음 | HIGH |
| 9 | useEmployeeSearch.ts | @returns/@param + FIXME 방치 | HIGH |
| 10 | useCouncilCodes.ts | @param 예시 코드값 불일치 | MEDIUM |

---

## 분석 범위 메모

- **composables:** 48개 파일 전수 분석
- **stores:** auth.ts, review.ts
- **plugins:** auth.ts
- **middleware:** auth.global.ts, admin.ts
- **utils:** common.ts, adminLogs.ts, excel.ts, hwpx.ts, hwpx-images.ts, hwpx-package-xml.ts, currencyDisplay.ts, planSummaryText.ts, projectDate.ts, planBusinessLists.ts, planSaveNavigation.ts
- **types:** auth.ts, board.ts, budget-work.ts, budgetStatus.ts, council.ts, review.ts, notification.ts, tiptapVariable.ts
- **components:** StyledDataTable.vue, InlineEditCell.vue 집중 분석

**비즈니스 로직 수정 없음 — 이 문서는 탐지 목록만 포함합니다.**
