# 셀 복사 시 헤더 포함 여부 다이얼로그 (Design)

- 작성일: 2026-06-18
- 대상: `it_frontend` 공통 셀 선택/복사 기능 (`useTableCellSelection` + `StyledDataTable`)
- 적용 범위: 모든 `StyledDataTable` (admin/codes 포함)

## 1. 배경 / 목적
StyledDataTable의 엑셀형 셀 선택 후 `Ctrl/Cmd+C` 복사 시, 선택 영역과 함께
**테이블 헤더(컬럼명)** 를 포함할지 사용자에게 다이얼로그로 물어본다.

## 2. 기술 제약
`copy` 이벤트는 동기 이벤트라 다이얼로그 응답을 기다린 뒤 `clipboardData`에 기록할 수 없다.
따라서 다이얼로그 경로에서는 `copy` 이벤트를 `preventDefault()`로 막고, 사용자의 선택을
받은 뒤 비동기 Clipboard API(`navigator.clipboard.writeText`)로 기록한다.
사내 포털(Chrome/Edge)에서 포커스된 동일 출처 페이지는 이 API가 정상 동작한다.

## 3. 동작 흐름
1. 셀 드래그 선택 후 `Ctrl/Cmd+C`
2. `copy` 이벤트 가로채기 → `preventDefault()`
3. 선택 영역의 데이터 TSV와 선택 열의 헤더 텍스트를 동기 수집
   (헤더는 `thead`의 leaf 헤더 행 × 선택 열 인덱스)
4. 커스텀 모달 `<Dialog>` 표시 — "선택한 셀과 함께 테이블 헤더(컬럼명)도 복사할까요?"
   - **헤더 포함** → 헤더 행 + 데이터 행
   - **헤더 제외** → 데이터 행만 (기존과 동일)
   - **취소** / X / Esc / 배경 클릭 → 복사 안 함 (클립보드 변경 없음)
5. 결과 TSV를 `navigator.clipboard.writeText()`로 비동기 기록

## 4. 컴포넌트 분리
### 4.1 `composables/useTableCellSelection.ts` (UI 비의존)
- 4번째 인수 `copyOptions?: Ref<CellCopyOptions | undefined>` 추가.
- `CellCopyOptions.confirmIncludeHeader?: (ctx: { headers: string[] }) => Promise<boolean | null>`
  - `true` = 헤더 포함, `false` = 헤더 제외, `null`(또는 undefined) = 복사 취소.
- 콜백이 있으면 비동기 경로(preventDefault + writeText), 없으면 **기존 동기
  `clipboardData.setData` 경로 그대로 유지** (직접 사용처/기존 테스트 하위 호환).
- 헤더 추출: `thead tr:last-child`의 셀을 본문 선택 열 인덱스로 매칭, 텍스트 정규화.
  스크롤형 PrimeVue 테이블은 thead/tbody가 동일 table이라 열 인덱스가 정렬된다.

### 4.2 `components/common/StyledDataTable.vue` (UI)
- `headerCopyPrompt?: boolean` prop (기본 `true`). `false`면 기존 동기 복사 유지.
- 내부에 모달 `<Dialog>` + 3버튼(헤더 포함 / 헤더 제외 / 취소) 렌더.
- Promise 래퍼로 `confirmIncludeHeader`를 구성해 `copyOptions`로 composable에 전달.
  버튼 클릭 → resolve(true/false/null), `@hide`(X·Esc·배경) → 미해결 시 resolve(null).

## 5. 테스트
- 기존: `copyOptions` 미지정 → 동기 `setData` 경로 유지 (기존 테스트 통과).
- 신규(`useTableCellSelection.direct.test.ts`): `thead` 포함 테이블에서
  `confirmIncludeHeader`가 `true`/`false`/`null`을 반환할 때
  `navigator.clipboard.writeText` 호출 여부와 헤더 prefix 포함 여부를 검증(mock).
- 실제 브라우저 admin/codes에서 포함/제외/취소 3경로 확인.

## 6. 비범위 (YAGNI)
- 선택 기억("다시 묻지 않기"), 우클릭 메뉴, 붙여넣기(paste) 다이얼로그는 범위 밖.
