# Tiptap Editor 변수 입력 기능 설계

- **작성일**: 2026-05-17
- **출처 PRD**: `prds/PRD_20260517.md`
- **적용 범위**: `it_frontend`의 모든 `TiptapEditor` 사용처(사전협의·계획·요구사항정의서·가이드문서·공통게시판 등)
- **단일 진실 공급원**: 본 문서가 변수 입력 기능의 설계 SoT. 데이터 모델 SoT는 `it_backend/docs/guides/data-model.md`, 인증 정책 SoT는 `it_backend/CLAUDE.md`를 따른다.

## 1. 목적

Tiptap Editor 작성 시 `{2026.requestAmount}`와 같은 토큰 형태로 변수값을 삽입하고, 게시글을 다시 조회할 때마다 백엔드의 최신 예산·사업 데이터를 가져와 동적으로 반영한다. 작성자가 게시글을 수정하지 않아도 값이 자동 갱신되어야 한다.

### 1.1 지원 변수 카탈로그
- 연도별 전산예산 / 자본예산 / 일반관리비 — 각각 편성요청액(합계), 편성액(합계), 편성률(총액 기준)
- 연도별 사업별 — 편성요청액, 편성액, 편성률

### 1.2 핵심 결정 요약
| 항목 | 결정 |
|---|---|
| Tiptap 모델링 | Atomic inline Node (분해 불가) |
| 적용 범위 | 전체 TiptapEditor |
| 동적 반영 시점 | 게시글 조회 시마다 최신값 일괄 조회 |
| 사업 식별 | 드롭다운에서 카테고리 → (사업) → 연도 → 항목 순차 선택 |
| 값 포맷팅 | 백엔드에서 표시용 문자열로 반환 |
| 누락 데이터 | 빨간색 경고 + 원본 토큰 노출 |
| 편집 동작 | Atomic 노드(클릭 한 번에 선택, Backspace는 전체 삭제) |
| 내보내기 | 내보내기 시점의 포맷된 값으로 고정 |
| 카탈로그 로딩 | 에디터 로드 시 1회 / 값은 조회 시 일괄 |

## 2. 아키텍처 개요

### 2.1 프론트엔드 (Nuxt 4 + Tiptap)
- `VariableExtension` — `app/components/extensions/tiptap-extensions.ts`에 신규 atomic inline Node 추가. 기존 `ResizableImage`, `AttachmentExtension` 패턴과 일관.
- `VariableNodeView.vue` — chip 형태 렌더링, 정상/누락/로딩/권한없음/스냅샷폴백 5상태 시각화.
- `createVariableSuggestion()` — `{` 트리거 Suggestion 핸들러. `createAttachmentSuggestion`과 동일한 closure-mutation 패턴.
- `useTiptapVariables.ts` (신규 composable) — 메타데이터 캐시 + 값 일괄 조회 + 토큰 추출 유틸.

### 2.2 백엔드 (Spring Boot)
- `TiptapVariableController` — 2개 엔드포인트.
  - `GET /api/tiptap-variables/metadata` — 드롭다운용 카탈로그(카테고리·연도·사업·항목).
  - `POST /api/tiptap-variables/resolve` — 토큰 배열을 받아 `{ token: { value, status } }` 매핑 반환.
- `TiptapVariableService` — 기존 예산/사업 도메인 서비스(`BudgetService`, `ProjectService` 등)를 조합해 포맷된 문자열 생성. 단위 결정 책임 보유.

### 2.3 저장 구조
```html
<span data-type="tiptap-variable"
      data-token="2026.proj.PROJ001.requestAmount"
      data-snapshot="900억원"></span>
```
- `data-token` — 변수 식별자. 백엔드 해석 대상.
- `data-snapshot` — 작성 시점의 포맷된 값. `resolve` 실패 시 폴백 표시용.

### 2.4 경계 원칙
- 변수 카탈로그·해석·포맷팅은 **백엔드 단일 책임**. 프론트는 카탈로그를 받고 표시만 함.
- 변수 권한 필터링은 백엔드에서 처리(JWT 클레임 기반 `@PreAuthorize` + 서비스 계층 권한 검증 이중 적용).

## 3. 컴포넌트 및 인터페이스

### 3.1 `VariableExtension` (Tiptap Node)
```ts
// app/components/extensions/tiptap-extensions.ts
const VariableExtension = Node.create({
  name: 'tiptapVariable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes: () => ({
    token: { default: null },
    snapshot: { default: '' },
  }),
  parseHTML: () => [{ tag: 'span[data-type="tiptap-variable"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'span',
    { 'data-type': 'tiptap-variable', ...HTMLAttributes },
  ],
  addNodeView: () => VueNodeViewRenderer(VariableNodeView),
  addProseMirrorPlugins() {
    return [Suggestion({ editor: this.editor, ...this.options.suggestion })];
  },
});
```

### 3.2 `VariableNodeView.vue`
```ts
defineProps<{ node: Node; editor: Editor }>()
// editor.storage.tiptapVariable.values: Map<token, ResolvedValue>
// type ResolvedValue = { value: string; status: 'OK'|'LOADING'|'MISSING'|'FORBIDDEN'|'STALE' }
```
- 상태별 클래스(Tailwind 기반): `OK`=연한 indigo, `LOADING`=skeleton, `MISSING`=빨간 배경+토큰 노출, `FORBIDDEN`=회색+자물쇠, `STALE`=노랑+재시도.
- 접근성: `role="img"`, `aria-label="변수: <카테고리> <연도> <항목> — <표시값>"`.

### 3.3 `createVariableSuggestion()` 흐름 (`{` 트리거)
1단계: 카테고리 선택 — 전산예산 / 자본예산 / 일반관리비 / 사업별.
2단계 분기:
- 전산/자본/일반관리비 → 연도 선택 → 항목(편성요청액/편성액/편성률) 선택.
- 사업별 → 사업 검색·선택 → 연도 선택 → 항목 선택.

선택 완료 시:
```ts
editor.commands.insertContent({
  type: 'tiptapVariable',
  attrs: { token, snapshot: '' },
});
// 삽입 직후 resolveTokens([token]) 호출하여 snapshot 즉시 채움.
```

### 3.4 `useTiptapVariables.ts` 공개 API
```ts
interface VariableMetadata {
  categories: Array<{
    code: 'IT_BUDGET' | 'CAP_BUDGET' | 'OPEX' | 'PROJ';
    label: string;
    years: number[];
    projects?: Array<{ code: string; name: string }>;
    items: Array<{ key: 'requestAmount' | 'allocatedAmount' | 'allocationRate'; label: string }>;
  }>;
}

// 서버 응답 상태 (백엔드가 반환)
type ServerStatus = 'OK' | 'MISSING' | 'FORBIDDEN' | 'INVALID';

// 클라이언트 표시 상태 (서버 상태 + 네트워크/로딩 상태)
type ClientStatus = ServerStatus | 'LOADING' | 'STALE';

interface ResolvedValue {
  value: string;       // 표시값 또는 폴백 스냅샷
  status: ClientStatus;
}

const {
  metadata,
  loadMetadata,
  resolveTokens,
  extractTokens,
} = useTiptapVariables();
```

### 3.5 `TiptapEditor.vue` 통합
- `extensions` 배열에 `VariableExtension.configure({ suggestion: createVariableSuggestion(state) })` 추가.
- 신규 prop:
  ```ts
  variableValues?: Map<string, ResolvedValue>;
  ```
- `watch(variableValues)` → `editor.storage.tiptapVariable.values` 동기화 → NodeView가 reactive하게 재렌더.
- 부모 페이지는 게시글 HTML 로드 후 `extractTokens` → `resolveTokens` → `variableValues` 전달 책임.

### 3.6 API 스키마
```http
GET /api/tiptap-variables/metadata
200 OK
{
  "categories": [
    {
      "code": "IT_BUDGET",
      "label": "전산예산",
      "years": [2024, 2025, 2026, 2027],
      "items": [
        { "key": "requestAmount",   "label": "편성요청액" },
        { "key": "allocatedAmount", "label": "편성액" },
        { "key": "allocationRate",  "label": "편성률" }
      ]
    },
    {
      "code": "PROJ",
      "label": "사업별",
      "years": [2024, 2025, 2026, 2027],
      "projects": [
        { "code": "PROJ001", "name": "차세대 시스템 구축" }
      ],
      "items": [
        { "key": "requestAmount",   "label": "편성요청액" },
        { "key": "allocatedAmount", "label": "편성액" },
        { "key": "allocationRate",  "label": "편성률" }
      ]
    }
  ]
}
```
```http
POST /api/tiptap-variables/resolve
Content-Type: application/json
{ "tokens": ["2026.proj.PROJ001.requestAmount", "2026.itBudget.allocationRate"] }

200 OK
{
  "results": {
    "2026.proj.PROJ001.requestAmount": { "value": "900억원", "status": "OK" },
    "2026.itBudget.allocationRate":    { "value": "85.3%",  "status": "OK" }
  }
}
```

### 3.7 토큰 문법
구조: `<YEAR>.<CATEGORY>[.<PROJECT_CODE>].<ITEM>`
- 비-사업 카테고리(`itBudget` / `capBudget` / `opex`) — 정규식: `^\d{4}\.(itBudget|capBudget|opex)\.(requestAmount|allocatedAmount|allocationRate)$`
- 사업 카테고리(`proj`) — 정규식: `^\d{4}\.proj\.[A-Z0-9_-]+\.(requestAmount|allocatedAmount|allocationRate)$`
- 두 정규식 중 어느 하나에도 매치되지 않으면 `INVALID`.

**PRD 원문과의 차이**: PRD에는 `{2026.requestAmount}` 형태로 카테고리 prefix가 생략된 예시가 등장하나, 카테고리가 4종이므로 모호성을 없애기 위해 카테고리 prefix를 필수로 한다. 모든 변수 토큰은 위 구조를 따른다.

## 4. 데이터 흐름

### 4.1 작성 흐름
```
'{' 입력
  → Suggestion 활성, editor.storage.tiptapVariable.metadata 참조
  → 카테고리/연도/(사업)/항목 순차 선택
  → editor.commands.insertContent({ type: 'tiptapVariable', attrs: { token, snapshot: '' } })
  → 삽입 직후 resolveTokens([token]) → storage.values + snapshot 갱신
  → 저장 시 HTML에 data-token, data-snapshot 모두 직렬화
```

### 4.2 조회 흐름
```
페이지 마운트 → 게시글 HTML 로드
  → useTiptapVariables.extractTokens(html)로 토큰 배열 추출 (중복 제거)
  → resolveTokens(tokens) 일괄 호출
  → 부모 컴포넌트의 variableValues에 set
  → TiptapEditor가 prop watch → editor.storage.tiptapVariable.values 갱신
  → 각 VariableNodeView가 reactive하게 OK/MISSING/FORBIDDEN/STALE 상태와 표시값 재렌더
```

### 4.3 에디터 마운트 흐름 — 카탈로그 로딩
```
TiptapEditor onCreate
  → useTiptapVariables.loadMetadata() (모듈 단위 캐시, 적중 시 skip)
  → editor.storage.tiptapVariable.metadata = response
  → Suggestion이 storage를 참조
```

### 4.4 내보내기 흐름 (PDF/HWPX/Excel)
```
내보내기 클릭
  → editor.getHTML()
  → 직전에 resolveTokens 재호출하여 snapshot을 최신값으로 갱신 후 HTML 재직렬화
  → utils/hwpx.ts 등은 <span data-type="tiptap-variable"> 노드를 만나면 data-snapshot 텍스트로 치환
  → 산출물에는 변수 토큰이 사라지고 그 시점의 포맷된 문자열만 남음
```

### 4.5 권한·필터링
- `/metadata`는 JWT의 `bbrC`(부서)/`temC`(팀)/`athIds`(권한)에 따라 카테고리·사업 목록을 필터링.
- 일반 사용자는 자기 부서/팀에 해당하는 사업만 노출. 관리자(`ROLE.ADMIN`)는 전체 노출.
- `/resolve` 응답도 동일 정책 — 권한 없는 토큰은 `FORBIDDEN` 상태로 응답.

### 4.6 캐싱
- 메타데이터: 모듈 단위 메모리 캐시. 페이지 새로고침 시 갱신. TTL 미적용.
- 값 해석: 캐시하지 않음(동적 반영 보장).

## 5. 에러 처리 및 엣지 케이스

### 5.1 NodeView 상태별 시각화

| status | 시각화 | 툴팁 | 사용자 동작 |
|---|---|---|---|
| `OK` | 연한 indigo 칩 + 포맷값 | `{token}` | atomic 선택 |
| `LOADING` | 회색 skeleton | "값 조회 중..." | 비활성 |
| `MISSING` | 빨간색 배경 + 원본 토큰 노출 | "해당 데이터 없음" | atomic 선택 후 삭제 가능 |
| `FORBIDDEN` | 회색 + 자물쇠 아이콘 + 토큰 | "권한 없음" | 삭제만 가능 |
| `STALE` | 노란색 배경 + 스냅샷값 | "최신값 조회 실패 — 작성 시점 값 표시" | 재시도 버튼 |

### 5.2 프론트엔드 실패 처리
- `/metadata` 호출 실패 — toast(error) + Suggestion 비활성. 입력은 가능하되 `{` 자동완성만 동작하지 않음.
- `/resolve` 호출 실패 — toast 1회 + 모든 토큰을 `STALE`로 마킹(스냅샷 표시). 사용자가 새로고침으로 재시도.
- 개별 토큰 형식 오류 — 정규식 검증 실패 시 `INVALID`로 분기, NodeView는 `MISSING`과 동일 스타일로 렌더.
- 에디터 unmount 중 응답 도착 — `editor.isDestroyed` 가드로 storage 갱신 차단.
- 에러 메시지 정책 — `error?.data?.message`가 사용자 친화적인 경우만 노출, 아니면 일반 메시지로 대체 (`it_frontend/CLAUDE.md` §4.2.1 준수).

### 5.3 백엔드 검증
- `/resolve` 요청 토큰 배열 최대 200개. 초과 시 400.
- 토큰 정규식 검증(§3.7). 불일치 토큰은 `INVALID` 상태로 응답.
- 권한 검증: 컨트롤러 `@PreAuthorize` + 서비스 계층 권한 체크 이중 적용. 권한 없으면 `FORBIDDEN`.
- 데이터 부재: 해당 연도/사업/항목 row 없으면 `MISSING`. 200 응답으로 token별 status 매핑.

### 5.4 엣지 케이스
- 사업 삭제 후 변수 잔존 — `MISSING` 표시 + 게시글 수정 시 사용자가 인지하여 제거.
- 부모/에디터 modelValue 동기화 race — `extractTokens` → `resolveTokens` 호출은 HTML 로드 완료 후 한 번만, 부모 페이지에서 디바운스 처리.
- 읽기 전용 모드 — Suggestion 비활성, NodeView는 동일하게 값 표시. 클릭 인터랙션 비활성.
- SSR/하이드레이션 — `import.meta.client` 가드. 서버 렌더 단계에서는 NodeView가 `data-snapshot`을 그대로 출력하여 깜빡임 최소화.
- HWPX 내보내기 중 resolve 실패 — 스냅샷으로 폴백 + toast로 "일부 변수는 작성 시점 값으로 출력됨" 안내.

## 6. 테스트 전략

### 6.1 단위 테스트 (Vitest)
| 파일 | 대상 | 핵심 케이스 |
|---|---|---|
| `tests/unit/composables/useTiptapVariables.test.ts` | composable | metadata 로드 성공/실패/캐시 히트, extractTokens 정규식, resolveTokens 정상/부분실패/네트워크오류 |
| `tests/unit/components/extensions/variableExtension.test.ts` | Node | parseHTML/renderHTML 라운드트립, atomic 보장(키바인딩), attrs 보존 |
| `tests/unit/components/VariableNodeView.test.ts` | NodeView | OK/LOADING/MISSING/FORBIDDEN/STALE 5상태 렌더, storage 갱신 reactive 반영 |
| `tests/unit/utils/hwpx.test.ts` (확장) | 내보내기 | `tiptap-variable` 노드 → `data-snapshot` 텍스트 치환 |

### 6.2 백엔드 테스트 (JUnit)
| 파일 | 대상 | 핵심 케이스 |
|---|---|---|
| `TiptapVariableControllerTest` | 컨트롤러 | `/metadata` 권한별 필터링, `/resolve` 토큰 200개 초과 시 400, 인증 누락 시 401 |
| `TiptapVariableServiceTest` | 서비스 | 토큰 파싱(정상/INVALID), MISSING/FORBIDDEN 분기, 단위·포맷팅 정확성(억원/%) |
| 권한 통합 테스트 | `@PreAuthorize` | 일반 사용자 타 부서 사업 조회 차단(`FORBIDDEN`) |

### 6.3 E2E 테스트 (Playwright)
| 시나리오 | 검증 |
|---|---|
| `tests/e2e/tiptap-variable.spec.ts` 시나리오 1 | `{` 입력 → 카테고리 → 연도 → 항목 선택 → 노드 삽입 → 저장 → 다시 조회 시 동일 칩 노출 |
| 시나리오 2 | 사업별 변수 — 사업 검색 → 연도 → 항목 선택 → 칩 렌더 |
| 시나리오 3 | DB의 예산값을 직접 수정 후 게시글 새로고침 → 칩 표시값 갱신 |
| 시나리오 4 | 누락된 사업 변수 → 빨간색 표시 + 툴팁 |
| 시나리오 5 | 내보내기(PDF 또는 HWPX) 후 산출물에서 `{...}` 토큰이 사라지고 포맷값만 남음 |

### 6.4 모킹 규칙 (CLAUDE.md §4.10 준수)
- 단위 테스트: `vi.stubGlobal('$fetch', ...)`로 API mock.
- E2E: `page.route('**/api/tiptap-variables/**', ...)`로 응답 고정. 단, 시나리오 3은 실DB 사용.
- Tiptap 에디터는 jsdom에서 `useEditor` 인스턴스 직접 생성 — 기존 `tests/unit/composables/useTiptapTableTools.test.ts` 패턴 참조.

### 6.5 커버리지 목표 (CLAUDE.md §4.10)
- 신규 composable / extension / NodeView 80%+.
- 백엔드 서비스 80%+.

### 6.6 수동 검증 체크리스트 (PR 머지 전)
- [ ] 사전협의·계획·요구사항정의서·가이드문서·공통게시판 5종 화면에서 변수 칩 정상 표시
- [ ] 다크모드 색상 대비 충분
- [ ] 키보드만으로 변수 삽입(`{` → 화살표 → Enter) 가능
- [ ] NodeView `aria-label` 부여로 스크린 리더 대응
- [ ] 모바일 뷰포트(768px 이하)에서 Suggestion 팝업 위치 정상

## 7. 비목표 (Out of Scope)
- 사용자 정의 변수(임의 SQL 또는 표현식)는 본 설계 범위 밖.
- 변수값의 과거 시점 조회(시계열 스냅샷 보존)는 별도 과제.
- 변수의 알림 트리거(값 변경 시 알림 발송)는 별도 과제.

## 8. 마이그레이션
- 기존 게시글에는 변수 노드가 없으므로 데이터 마이그레이션 불필요.
- DB 스키마 변경 없음. 변수 메타데이터는 기존 예산/사업 테이블에서 파생.
