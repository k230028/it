# PDF 뷰어 연속 스크롤 전환 설계

- 날짜: 2026-09-14
- 대상 저장소: `it_frontend`
- 관련 파일: `app/components/common/PdfViewer.vue`, `app/composables/pdf/usePdfViewer.ts`,
  `app/components/common/pdf/PdfViewerToolbar.vue`, `app/components/common/pdf/PdfPropertiesDialog.vue`

## 1. 배경과 목표

현재 pdf.js 뷰어는 canvas 슬롯 2개(단일/2페이지 보기)에 **현재 페이지만** 렌더링하고, 휠이 페이지 끝에 닿으면
다음 페이지로 "넘기는" 방식이다. 사용자는 페이지 단위로 끊기지 않고 일반 PDF 리더처럼 자연스럽게
세로로 이어서 스크롤되기를 원한다.

목표:

1. 문서 전체를 세로로 이어 붙인 **연속 스크롤**을 유일한 보기 방식으로 한다(페이지 넘김 모드 토글 없음).
2. 2페이지 보기(펼침)는 유지하되 `1-2`, `3-4`, … 를 한 행으로 두고 행들을 세로로 이어 스크롤한다.
3. 프레젠테이션(전체화면) 모드만 예외로 한 장씩 표시한다.
4. 페이지 수에 상관없이 메모리·초기 렌더 시간이 폭발하지 않도록 **보이는 범위만 렌더링**한다(가상화).
5. (추가 결함) 신청서 다이얼로그를 Fullscreen API로 최대화한 상태에서 툴바의 배율 드롭다운·더 보기 메뉴·
   문서 속성 다이얼로그가 보이지 않는 문제를 해결한다.

비목표: pdf.js 내장 `PDFViewer`(`pdfjs-dist/web/pdf_viewer`) 도입, 가로 스크롤 모드, 주석·폼 렌더링.

## 2. 접근 방식 선택

| 안 | 내용 | 판단 |
| --- | --- | --- |
| A | 현재 composable을 N페이지 가상화 구조로 확장 | **채택**. 검색·사이드바·툴바·인쇄·텍스트 레이어 CSS 계약 유지 |
| B | pdf.js 내장 `PDFViewer` 도입 | EventBus·`pdf_viewer.css`·LinkService를 통째로 들여와야 하고 자체 검색·툴바·회전 계약과 충돌. 사실상 재작성 |
| C | 전 페이지 무조건 렌더링 | 결재 문서 페이지 수를 보장할 수 없어 메모리·시간 폭발. 제외 |

## 3. 설계

### 3.1 `usePdfViewer` 렌더링 모델

- 입력 옵션: `src`, `container`(스크롤 영역), `fitPadding`, `onError`. 기존 `canvas`/`textLayer`/`secondCanvas`/
  `secondTextLayer` 옵션은 제거한다.
- 슬롯 등록 API: `registerSlot(page, { canvas, textLayer })`, `unregisterSlot(page)`. 컴포넌트가 `v-for`로
  만든 페이지 슬롯을 마운트/언마운트 시점에 등록·해제한다.
- 레이아웃 상태:
  - `pages: ShallowRef<PdfPageLayout[]>` — `{ page, width, height }`(현재 배율·회전이 반영된 CSS px 크기).
    문서 열기 시 전 페이지의 배율 1 viewport(폭·높이)를 한 번 읽어 캐시하고, `scale`·`rotation`이 바뀔 때
    캐시에서 다시 계산한다(페이지 재접근 없음).
  - `rows: ComputedRef<PdfRowLayout[]>` — `{ pages, top, height }`. 단일이면 `[[1],[2],…]`, 펼침이면
    `[[1,2],[3,4],…]`, 프레젠테이션이면 `[[currentPage]]`이며 `top`은 누적 세로 오프셋이다.
  - `PDF_SPREAD_GAP`(행 안 가로 간격, 기존)과 `PDF_PAGE_GAP`(행 사이 세로 간격, 신규) 상수.
- 배율 계산(`resolveScale`): 기존 규칙(`auto`·`actual`·`page-fit`·`fit-width`·`custom`) 유지. 기준 크기는
  현재 행(펼침이면 두 장 합산 폭·최대 높이)으로 계산해 현재와 같은 결과를 낸다.
- 가시 범위: 스크롤 이벤트(rAF 스로틀)에서 `scrollTop`·`clientHeight`와 누적 행 높이를 비교해 "영역과
  교차하는 행 ±1행"을 `visiblePages`로 계산한다. IntersectionObserver 대신 스크롤 좌표 계산을 쓰는 이유는
  jsdom 테스트에서 결정적으로 검증할 수 있기 때문이다.
- 렌더 관리: 페이지별 `RenderTask`·`TextLayer`를 `Map<page, …>`로 관리한다. 가시 범위에 새로 들어온 페이지만
  렌더하고, 벗어난 페이지는 취소 후 canvas를 비워(`width=0`) 메모리를 반납한다. 배율·회전이 바뀌면 렌더된
  전 페이지를 무효화하고 다시 그린다. `rendering`은 진행 중 태스크가 하나라도 있으면 `true`, `renderCount`는
  페이지 하나의 canvas·텍스트 레이어 렌더가 끝날 때마다 증가한다.
- 문서 전환·언마운트 시 기존과 같이 세대 카운터로 늦게 도착한 결과를 폐기하고 모든 태스크를 취소한다.

### 3.2 현재 페이지와 이동

- `currentPage`: pdf.js 규칙을 따른다 — 현재 행이 뷰포트에 완전히 보이면 유지하고, 아니면 겹침 비율(보이는
  높이 / 행 높이)이 가장 큰 행의 첫 페이지(동률이면 위쪽). 겹치는 행이 없으면 scrollTop이 0이면 첫 행, 아니면
  마지막 행. 스크롤마다 갱신한다. 펼침에서는 행의 왼쪽(홀수) 페이지다. (설계 초안의 "세로 중앙선" 규칙은 행
  높이가 뷰포트 절반보다 작을 때 goToPage와 충돌해 페이지를 건너뛰므로 구현 중 교체했다.)
- `goToPage(n)`: 해당 행의 상단 오프셋으로 `scrollTop`을 설정한다(1..pageCount 보정은 유지).
  `prevPage`/`nextPage`/`firstPage`/`lastPage`는 행 단위 이동이다.
- 배율·회전 변경 시 변경 전 현재 행과 행 안 상대 오프셋(0~1)을 기억했다가 레이아웃 재계산 후 같은 위치로
  스크롤을 복원한다.
- 삭제: 휠 넘김 로직(`onWheel`, `WHEEL_PAGE_COOLDOWN_MS`, `scrollAfterRender`). 브라우저 기본 스크롤에 맡긴다.
- 키보드: ←/→/PageUp/PageDown/Home/End(행 이동), +/=/-/0, R/Shift+R, Ctrl+F, Ctrl+P 유지. Space는 브라우저
  기본 스크롤.

### 3.3 프레젠테이션 모드

- 전체화면 진입 시 컴포넌트가 `viewer.setPresentation(true)`를 호출한다. composable은 이전 배율을 기억하고
  `page-fit`으로 바꾸며 `rows`는 `[[currentPage]]`만 반환한다. 컨테이너는 `overflow: hidden`.
  Space/Enter/Backspace/화살표는 `goToPage`로 `currentPage`만 바꿔 그 페이지 한 장을 렌더한다.
  `setPresentation(false)`는 배율을 복원하고 현재 페이지가 속한 행으로 스크롤한다(펼침은 바뀌지 않으므로 복원 대상이 아니다).
  프레젠테이션 중 `currentPage`가 바뀌면 그 페이지 기준으로 페이지 맞춤 배율을 다시 계산한다(혼합 방향 문서).
- 별도 렌더 경로를 두지 않고 "가시 행 = 현재 행"인 특수 레이아웃으로 취급한다.

### 3.4 컴포넌트와 주변 계약

- `PdfViewer.vue`: 본문에 `v-for="row in rows"` → `v-for="page in row"` 슬롯. 슬롯은 `:style="{ width, height }"`
  로 미리 크기를 잡아 스크롤 높이를 확정하고, canvas·textLayer는 항상 마운트해 등록한다. 렌더되지 않은
  슬롯은 흰 배경만 보인다. 헤더 주석의 [동작]·[키보드]·설명 문단을 갱신한다.
- `visiblePages`는 기존 의미(현재 행의 페이지들)를 유지해 툴바 페이지 입력란과 사이드바 강조가 바뀌지 않는다.
  뷰포트와 겹치는 페이지 집합은 별도 `viewportPages`로 노출하며 검색의 화면 안 판정(`isPageVisible`)에만 쓴다.
- 페이지 슬롯은 `components/common/pdf/PdfPageSlot.vue`가 `onMounted`/`onBeforeUnmount`에서 등록·해제한다.
  인라인 함수 ref는 펼침 전환 때 새 슬롯 등록 뒤에 옛 슬롯 해제가 와서 새 슬롯을 지우므로 쓰지 않는다.
  `unregisterSlot(page, canvas)`는 등록된 canvas와 같을 때만 해제한다.
- `usePdfSearch`: `visibleLayers`는 렌더된(버퍼 포함) 레이어를, 새 옵션 `isPageVisible`은 화면 안 여부를 받는다.
  화면 밖 결과로 이동할 때 `goToPage` 뒤 바로 하이라이트를 적용해 이미 렌더된 버퍼 페이지도 즉시 강조된다.
  현재 항목으로의 `scrollIntoView`는 명시적 이동(`moveTo`) 뒤 한 번만 수행하고, 렌더 완료에 따른 재적용에서는
  스크롤하지 않는다(버퍼 페이지가 다시 그려질 때 스크롤을 빼앗지 않기 위해).
- `PdfSidebar`·`PdfViewerToolbar`: `visiblePages`(현재 행)·`currentPage`·`goToPage` 의미가 유지되어 변경 없음.
- `printPdfDocument`·문서 속성: 변경 없음.

### 3.5 전체화면에서 오버레이가 보이지 않는 결함

- 원인: `ApplicationViewerDialog`는 Fullscreen API로 `.p-dialog`를 전체화면에 띄운다. PrimeVue `Select`·`Menu`
  (popup)·`Dialog`는 오버레이를 `body`에 붙이므로 전체화면 요소의 자손이 아니어서 그려지지 않는다.
- 조치: `PdfViewerToolbar`의 배율 `Select`와 더 보기 `Menu`, `PdfPropertiesDialog`의 `Dialog`에
  `append-to="self"`를 지정해 뷰어 트리 안에 렌더한다. 툴바·뷰어 루트는 오버레이를 자르는 `overflow`가 없다.
- 프레젠테이션 모드(뷰어 루트 전체화면)에서는 툴바가 숨겨지므로 영향이 없다.

## 4. 테스트

- `tests/unit/composables/pdf/usePdfViewer.test.ts`: 슬롯 등록 API 기준으로 재작성. 레이아웃 계산(배율·회전·펼침),
  스크롤 위치에 따른 `currentPage`·`visiblePages`, 범위 밖 페이지 취소·해제, `goToPage`의 `scrollTop`,
  배율 변경 시 위치 복원, 프레젠테이션 단일 행, 문서 전환·언마운트 시 태스크 취소.
- `tests/unit/components/common/PdfViewer.test.ts`: 휠 넘김 테스트 삭제, 페이지 슬롯 렌더링·키보드 이동·
  프레젠테이션·검색 하이라이트 연동 테스트 갱신.
- `tests/unit/components/common/pdf/PdfViewerToolbar.test.ts`·`PdfPropertiesDialog.test.ts`: `appendTo`가 `self`인지
  확인하는 단언 추가.
- 실제 브라우저(dev 서버)에서 다페이지 PDF로 스크롤·펼침·확대·검색 이동·다이얼로그 전체화면 드롭다운을 확인한다.
  jsdom은 레이아웃이 없으므로 시각 검증은 여기서만 가능하다.

## 5. 검증 명령

```powershell
cd C:\it\it_frontend
npm run format:check
npm run check
npm test
```
