# Tiptap 변수 접근성·반응형 검증 발견사항

- 검증일: 2026-07-26
- 대상: `/info/documents/form`, `TiptapEditor.vue`, `VariableNodeView.vue`
- 자동 검증 viewport: Playwright Desktop Chrome
- 실화면 도구 상태: 로컬 UI용 연결 수단을 검색하고 브라우저 런타임을 초기화했으나 사용 가능한 브라우저가 0개여서 1280×800·390×844의 사람 눈 기준 관찰은 수행하지 못했다.

## 확인된 결함

### TIP-07 — 변수 NodeView 토큰 DOM 계약과 비동기 해석 반영

재현:

1. 요구사항 정의서 편집기에서 `{`를 입력한다.
2. 사업별 → 사업 → 2026년 → 편성요청액을 선택한다.
3. 렌더링된 `.tiptap-variable-chip`의 속성과 해석 직후 상태를 확인한다.

결과:

- Tiptap 문서 저장 HTML에는 `data-token="2026.proj.PROJ001.requestAmount"`가 있으나 Vue NodeView가 렌더링한 실제 DOM에는 `data-token`이 없다. 토큰은 `title`과 `aria-label`에만 포함된다.
- 비동기 해석 응답이 storage에 병합되어도 NodeView가 즉시 다시 그려지지 않아 다음 ProseMirror 편집 transaction 전까지 LOADING이 남을 수 있다. 자동 E2E는 이 결함을 명시적으로 드러내기 위해 응답 후 무손실 편집 transaction을 발생시킨 뒤 해석값을 검증한다.

영향:

- DOM 기반 자동화·진단 도구가 문서 토큰을 안정적으로 식별할 수 없다.
- 사용자가 변수 삽입 직후 편집을 멈추면 정상 해석값 대신 스켈레톤을 계속 볼 수 있다.

후속:

- `VariableNodeView.vue`가 `data-token`을 전달하도록 하고, 비동기 storage 병합만으로 NodeView가 즉시 갱신되는 반응성 경로를 추가한다.
- 후속 transaction 없이 OK/MISSING/ERROR 상태가 정착하는 RED 회귀 테스트를 추가한다.

### TIP-08 — 다크모드 대비와 Suggestion 팝업 접근성·모바일 경계

코드/CSS 기반 대비 계산은 `VariableNodeView.vue`의 실제 전경색과 rgba 배경을 zinc-900(`#18181b`) 위에 합성해 WCAG 상대 휘도 공식으로 산출했다.

| 상태 | 다크모드 대비 |
| --- | ---: |
| OK | 1.99:1 |
| MISSING | 2.46:1 |
| STALE | 2.01:1 |
| FORBIDDEN | 1.52:1 |
| ERROR | 7.60:1 |

결과:

- OK·MISSING·STALE·FORBIDDEN 텍스트가 일반 텍스트 기준 4.5:1에 미달한다.
- 변수 Suggestion 컨테이너와 항목이 일반 `div`라 `listbox`/`option` 의미, 선택 상태, 옵션의 접근 가능한 이름이 접근성 트리에 제공되지 않는다.
- 팝업은 `position: fixed`, `max-width: 320px`, `max-height: 220px`만 적용하며 right/bottom viewport clamp와 `calc(100vw - 여백)` 폭 제한이 없다. 390×844와 작은 가상 키보드 높이에서 화면 밖으로 벗어날 가능성이 있다.

영향:

- 어두운 모드에서 변수 상태와 금액을 읽기 어렵다.
- 스크린리더 사용자가 검색 결과의 역할·현재 선택을 알 수 없다.
- 모바일에서 결과나 주요 조작이 viewport·가상 키보드에 가릴 수 있다.

후속:

- 다크모드 상태별 토큰을 추가해 4.5:1 이상을 확보한다.
- 팝업에 combobox/listbox/option 의미, 접근 가능한 이름, `aria-selected`를 연결한다.
- 좌·우·상·하 viewport clamp, 모바일 폭 제한, 내부 스크롤을 적용하고 키보드 전용 삽입·Escape·재시도 편집위치 복귀를 1280×800/390×844 실제 화면에서 재검증한다.

## 통과한 자동 검증

- 카테고리·연도·항목 선택 후 실제 변수 삽입과 해석 금액
- 사업 선택 후 저장 HTML의 정확한 `data-token`
- MISSING 원본 토큰·tooltip·aria-label
- HWPX `Contents/section0.xml`의 미해석 토큰 0건과 기대 금액 포함
- 키보드 단계 이동은 자동 E2E로 확인했고, Escape 처리는 기존 구현 경로를 코드로 확인

실제 브라우저가 제공되는 환경에서 TIP-07·TIP-08 수정 후 TIP-05 체크리스트 전체를 다시 수행한다.
