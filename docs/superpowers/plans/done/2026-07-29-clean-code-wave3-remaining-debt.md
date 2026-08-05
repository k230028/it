# Clean Code Wave 3 — CQ-01 ~ CQ-19 잔여 부채 조치 로드맵

- 작성일: 2026-07-29
- 대상: `TASK.md` §🧹 Clean Code 부채 (기존 CQ-01 ~ CQ-17 + 크로스체크 파생 CQ-18·CQ-19)
- 선행: `plans/done/2026-07-21-clean-code-wave0/wave1/wave2-*.md` (CQ-02~05·07~14 완료)
- 문서 성격: 상위 로드맵. 각 Wave는 별도 실행계획의 리뷰·검증을 통과한 뒤 착수
- Wave A 실행 SoT: [`2026-07-29-clean-code-wave3-wave-a-backend-refactors.md`](2026-07-29-clean-code-wave3-wave-a-backend-refactors.md)
- 크로스체크 기준: root `a7eda19`, backend `74814d3`, frontend `937f5f9` (`main`, feature branch merge 결과와 동일 tree)

## 1. 현황 요약

기존 CQ-01~17 중 **12건(CQ-02~05·07~14)은 완료 이관**되었고, 크로스체크에서 분리한 CQ-18·19를 포함한 활성 항목은 **7건(CQ-01·06·15·16·17·18·19)** 입니다.

| ID    | 우선순위 | 현재 상태(2026-07-29 실측)                                      | 이번 계획의 처리 |
| ----- | :------: | --------------------------------------------------------------- | ---------------- |
| CQ-01 | 🟡 Medium | 4개 파일 합계 5,055줄 (직전 실측 대비 `BudgetWorkService` +37줄) | Wave D (트리거) |
| CQ-06 | 🟢 Low    | `Bcostm.update` 20개 매개변수, 운영 호출부 1곳                   | **Wave A (별도 실행계획)** |
| CQ-15 | 🟡 Medium | 운영 소스 **30개** 파일이 800줄 초과 (24 → 29 → 30, 계속 악화)   | Wave B·C |
| CQ-16 | 🟢 Low    | `components/` 루트 평면 파일 25개                                | Wave B |
| CQ-17 | 🟢 Low    | 두 `loadAthIds` 구현이 **바이트 단위로 동일**(6줄)               | **Wave A (별도 실행계획)** |
| CQ-18 | 🟢 Low    | 범용 UI 4개는 `editor`·`layout` 경계 밖이며 소비 범위가 큼       | CQ-16과 분리해 후속 판단 |
| CQ-19 | 🟢 Low    | `Btermm.update` 15개 위치 인자, production 호출부 1곳             | CQ-06과 분리해 후속 판단 |

### 1.1 백엔드 실측 (CQ-01)

| 파일 | 줄 수 | 비고 |
| ---- | ----: | ---- |
| `domain/budget/project/service/ProjectService.java` | 1,478 | public 8 / private 17, `updateProject` 단독 228줄(387–615) |
| `domain/council/controller/CouncilController.java` | 1,279 | 라우트 42개, 위임 대상 서비스는 이미 13개로 분리됨 |
| `domain/budget/work/service/BudgetWorkService.java` | 1,156 | 직전 실측 1,119 → **+37 증가** |
| `domain/budget/cost/service/CostService.java` | 1,142 | 동일 |

### 1.2 프론트 실측 (CQ-15)

800줄 초과 **34개** = 운영 소스 30 + 테스트 4.

| 군집 | 파일 수 | 최대 |
| ---- | ----: | ---- |
| 페이지(`app/pages/**`) | 20 | `info/documents/[id]/index.vue` 1,447 |
| 에디터 컴포넌트·확장(Tiptap 계열) | 5 | `TiptapEditor.vue` 1,328 |
| 기타 컴포넌트 | 2 | `common/EmployeeSearchDialog.vue` 899 |
| composable | 2 | `useTiptapTableTools.ts` 913 |
| 유틸 | 1 | `utils/hwpx.ts` **1,502**(전체 최대, export는 단 4개) |
| 테스트 | 4 | `useCostListPage.test.ts` 2,144 |

### 1.3 핵심 판단 — 단발 분해로는 해결되지 않습니다

CQ-01과 CQ-15는 **조치 항목으로 등록된 이후에도 계속 증가**했습니다(프론트 24→29→30, `BudgetWorkService` 1,119→1,156). `it_frontend/eslint.config.mjs`(67줄)를 확인한 결과 **`max-lines` 계열 규칙이 없어** 파일 비대화를 막는 자동 게이트가 존재하지 않습니다.

따라서 이 계획의 중심은 "한 번에 분해"가 아니라 **① 즉시 회수 가능한 소형 항목 정리 → ② 악화 정지선(ratchet) 도입 → ③ 군집 단위 점진 분해** 순서입니다. 게이트 없이 분해만 하면 다음 실측에서 다시 악화됩니다.

---

## 2. Wave A — 즉시 실행 (저위험 · 확정 범위)

두 항목 모두 범위가 닫혀 있고 외부 의존이 없습니다. 상세 구현·테스트·커밋 순서는 별도
[`Wave A 실행계획`](2026-07-29-clean-code-wave3-wave-a-backend-refactors.md)을 단일 진실 공급원으로 사용합니다.

### A-1. CQ-17 — 역할 조회 로직 단일화

- `common.iam.service.UserRoleResolver`가 활성·미삭제 역할 조회와 `ATH_USER` 폴백을 단독 소유합니다.
- 전환 대상은 `AuthService`의 로그인·세션 복원·개발 사용자 전환·SSO **4곳**과 `RefreshTokenRotator`의 Refresh **1곳**입니다.
- 신규 resolver·테스트 2파일, production 소비자 2파일, 기존 소비자 테스트 2파일의 총 6파일이 변경됩니다.
- 완료 기준은 resolver 경계·오류 테스트, 다섯 소비 경로 테스트, `loadAthIds` production grep 0건, `./gradlew check`입니다.

### A-2. CQ-06 — `Bcostm.update` 매개변수 record 전환

- `Bcostm.java:185-205`의 20개 인자를 `@Builder Bcostm.UpdateCommand` record로 전환합니다.
- production 호출부는 `CostService.java:312` **1곳**입니다. 기존 계획이 두 번째로 집계한 `:383`은 `Btermm.update`이며 CQ-19로 분리합니다.
- `CostServiceTest`에서는 `Bcostm` 대상 `:758`·`:1893`만 command captor로 전환하고 `Btermm` 대상 `:832`는 그대로 둡니다.
- `dfrCleC`·`abusTc`의 `CodeDefaults.orNotApplicable` 보정은 `update(UpdateCommand)` 본문에 유지합니다.
- 완료 기준은 20개 필드·기본값 엔티티 테스트, 서비스 금액 회귀 테스트, 20인자 오버로드 제거, `./gradlew check`입니다.

---

## 3. Wave B — 프론트 구조 정리 (CQ-16 + CQ-15 사전작업)

상세 구현·검증·커밋 순서는 [`Wave B 실행계획`](2026-07-29-clean-code-wave3-wave-b-frontend-structure.md)을 단일 진실 공급원으로 사용합니다.

### B-0. 순서 제약 (중요)

CQ-16의 이동 대상과 CQ-15의 에디터 군집은 **동일 파일 5개**(`TiptapEditor` 1,328 / `TiptapToolbar` 1,287 / `TiptapTableFloatingToolbar` 1,104 / `tiptap-content-extensions` 1,079 / `tiptap-extensions` 1,007)를 공유합니다.
→ **CQ-16(경로 이동)을 먼저** 수행하고 CQ-15(내부 분해)를 이어서 합니다. 순서가 뒤바뀌면 같은 파일을 두 번 건드리고 리뷰 diff가 뒤섞입니다.

### B-1. CQ-16 — 3단 분할 이동 (churn 기준 재설계)

TASK.md는 25개 파일 일괄 이동을 전제했지만 소비 범위가 파일마다 크게 다릅니다. 참조 수는 기능 브랜치에서 계속 변하므로 이 로드맵에 고정하지 않고, 각 이동 실행계획을 작성할 때 tag·명시적 import·상대경로·테스트 mock을 다시 전수 실측합니다.

| 단계 | 이동 대상 | 파일 수 | 판단 |
| ---- | -------- | ----: | ---- |
| **B-1a** | `components/editor/` — `TiptapEditor`, `TiptapToolbar`, `TiptapTableFloatingToolbar`, `AttachmentNodeView`, `BlockMathNodeView`, `InlineMathNodeView`, `ResizableImageNodeView`, `VariableNodeView`, `ExcalidrawNodeView`, `ExcalidrawWrapper`, `MentionAutocomplete` + `extensions/tiptap-*.ts` 3종 | 14 | 별도 실행계획 |
| **B-1b** | `components/layout/` — `AppShell`, `AppHeader`, `AppSidebar`, `AppBreadcrumb`, `GlobalSearchBar`, `NotificationBell`, `NotificationDropdown`, `GeminiChat`, `SwitchUserDialog`, `ApplicationViewerDialog` | 10 | 별도 실행계획 |
| **B-1c** | `components/common/` 편입 후보 — `PageHeader`, `AppDialogFooter`, `TableCard`, `AppDialogHeader` | 4 | **CQ-18로 보류** |

**B-1c를 보류하는 이유:** 이 4개는 성격상 `editor`도 `layout`도 아닌 범용 UI이며 다수 화면이 자동 등록명으로 소비합니다. `common/` 편입 시 모든 소비 파일에 명시적 import를 추가해야 하므로 구조 개선 효과 대비 회귀 표면이 큽니다. CQ-16은 B-1a·B-1b만 다루고 편입 여부는 CQ-18에서 컴포넌트별로 판단합니다.

**이동 시 필수 처리**

- Nuxt 기본 `pathPrefix: true`이므로 이동하면 자동 등록명이 `EditorTiptapEditor`·`LayoutAppShell`로 바뀝니다(`nuxt.config.ts`에 Nuxt `components` 옵션 설정 없음 — `:99`의 `components`는 PrimeVue preset 토큰 블록입니다). 프로젝트 규약(`it_frontend/CLAUDE.md` §5)대로 **명시적 import로 전환**합니다(자동 등록명 의존 금지).
- 경로 참조 갱신 대상은 실행 브랜치에서 `rg`로 다시 manifest화합니다. `VariableNodeView.test.ts`의 `../../../app/` 상대경로, 동적 import, E2E·extension·composable 테스트까지 포함하며 과거의 고정된 15+5 집계를 재사용하지 않습니다.
- 각 단계마다 `npm run check` → `npm test` → `npm run test:e2e` 순으로 검증. 이동 커밋에는 **내용 변경을 섞지 않습니다**(순수 rename diff 유지).

### B-2. CQ-15 정지선 — `max-lines` ratchet 도입

`eslint.config.mjs`에 파일 크기 규칙을 추가해 신규 800줄 초과와 기존 30개 파일의 순증가를 모두 차단합니다. 기존 파일을 단순 ignore하면 계속 커져도 통과하므로 ratchet이 아니며, 각 파일의 현재 줄 수를 개별 상한으로 적용합니다.

```js
const oversizedFileBaselines = {
    // 실행계획 착수 시점의 app/**/*.ts|vue 800줄 초과 파일 30개와 각 현재 줄 수
};

// eslint.config.mjs — .append(...) 내부
{
    files: ['app/**/*.{ts,vue}'],
    ignores: Object.keys(oversizedFileBaselines),
    rules: {
        'max-lines': ['error', { max: 800, skipBlankLines: false, skipComments: false }],
    },
},
...Object.entries(oversizedFileBaselines).map(([file, max]) => ({
    files: [file],
    rules: {
        'max-lines': ['error', { max, skipBlankLines: false, skipComments: false }],
    },
})),
```

- 테스트 파일(`tests/**`)은 대상 제외 — AAA 패턴상 길이가 곧 결함이 아닙니다.
- **운영 규칙:** 기준 파일 추가 금지, 기준값 증가 금지, 분해 시 기준값 감소, 800줄 이하가 되면 개별 기준을 제거합니다.
- ESLint 설정 자체와 ratchet 회귀 테스트를 별도 실행계획으로 먼저 반영한 뒤 구조 이동을 시작합니다.

---

## 4. Wave C — CQ-15 군집별 분해

실행 순서와 C-4 trigger 정책은 [`Wave C 상위 실행계획`](2026-07-29-clean-code-wave3-wave-c-frontend-decomposition.md)을 따릅니다.
즉시 실행분은 subsystem별 child plan으로 분리했습니다.

- [`C-1 HWPX 분해`](2026-07-29-clean-code-wave3-wave-c1-hwpx-decomposition.md)
- [`C-2 Editor 분해`](2026-07-29-clean-code-wave3-wave-c2-editor-decomposition.md)
- [`C-3 Composable 분해`](2026-07-29-clean-code-wave3-wave-c3-composable-decomposition.md)

정지선(B-2) 도입 후, 예외 목록을 한 건씩 걷어내는 방식으로 진행합니다. **일괄 처리하지 않습니다.**

우선순위는 "크기 × 변경빈도 × 분해 용이성"으로 정합니다.

| 순번 | 대상 | 근거 | 분해 방향 |
| ---: | ---- | ---- | -------- |
| C-1 | `app/utils/hwpx.ts` (1,502) | 최대 파일이면서 **export가 4개뿐** → 나머지 전부 내부 헬퍼. 공개 계약을 건드리지 않고 분해 가능한 유일한 대형 파일 | `hwpx/` 하위로 변환 단계별 모듈 분리(전처리 / 스타일 매핑 / 패키징). 공개 API `preprocessHtmlForHwpx`·`htmlToHwpxBlob` 시그니처 유지 |
| C-2 | 에디터 군집 5개 (1,328·1,287·1,104·1,079·1,007) | B-1a 이동 직후라 위치가 안정됨. 툴바/확장은 옵션 테이블 성격이라 기계적 분리 가능 | `TiptapToolbar` → 그룹별 하위 컴포넌트, `tiptap-*extensions.ts` → 확장 단위 파일 |
| C-3 | composable 2개 (913·824) | 순수 로직이라 단위 테스트로 안전망 확보가 쉬움 | 관심사별 composable 분할 |
| C-4 | 페이지 20개 (1,447 ~ 812) | 최대 군집이나 화면 회귀 위험 최상 | **일괄 착수 금지.** 해당 화면 기능 변경 시 동반 분해(CQ-01과 동일한 트리거 방식) |

**C-4 트리거 규칙:** 800줄 초과 페이지를 수정하는 모든 작업은 같은 PR에서 최소 1개의 관심사(폼 섹션 / 테이블 / 조회 로직)를 컴포넌트·composable로 추출합니다. 20개를 별도 프로젝트로 잡지 않고 일상 작업에 상환 배분합니다.

각 분해 후 `npm run check` · `npm test` 통과 + 해당 파일을 B-2 예외 목록에서 제거해야 완료입니다.

---

## 5. Wave D — CQ-01 (트리거 기반 유지 + 동결선 추가)

TASK.md의 "단독 빅뱅 분해 금지, 도메인 기능 변경 시 동반 수행" 결정은 **유지**합니다. 5,055줄을 한 번에 재배치하는 것은 회귀 위험 대비 이득이 없습니다.

다만 트리거만으로는 증가를 막지 못했으므로(`BudgetWorkService` +37줄) 두 가지를 추가합니다.

### D-1. 동결선 (즉시 적용)

대상 4개 파일에 대해 **"순증가 금지"** 를 문서 규칙이 아니라 `it_backend/build.gradle`의 검증 task로 강제합니다. task는 아래 경로별 기준선을 검사하고 `check`가 이 task에 의존하도록 연결합니다.

| 파일 | 기준선(2026-07-29) |
| ---- | ----: |
| `ProjectService.java` | 1,478 |
| `CouncilController.java` | 1,279 |
| `BudgetWorkService.java` | 1,156 |
| `CostService.java` | 1,142 |

기능 추가로 불가피하게 초과할 경우, **같은 PR에서 동등 이상 분량을 추출**해 상쇄합니다.
기준값은 증가시킬 수 없고 파일이 줄어들 때만 함께 낮춥니다. 구체적인 Gradle task·TestKit 또는 task 실행 검증은 Wave D 실행계획에서 확정합니다.

### D-2. 트리거 발동 시 분해 설계 (사전 확정)

각 파일의 분해 방향을 미리 확정해 두어, 트리거가 걸렸을 때 설계부터 시작하지 않도록 합니다.

- **`CouncilController` (1,279 / 라우트 42개)** — 가장 먼저 착수할 대상입니다. **위임 대상 서비스가 이미 13개로 분리되어 있어** 컨트롤러만 서비스 경계를 따라 쪼개면 됩니다(구조 설계 불필요). 라우트 경로 기준 분할안:
  - `CouncilController` — 목록·생성·상세 (`/`, `/{asctId}`) 4개
  - `CouncilFeasibilityController` — `/feasibility` 3개
  - `CouncilLifecycleController` — `/approval`, `/start`, `/complete`, `/skip*` 9개
  - `CouncilCommitteeController` — `/committee` 4개
  - `CouncilScheduleController` — `/schedule` 5개
  - `CouncilEvaluationController` — `/evaluation`, `/plan-evaluation`, `/plan-targets` 8개
  - `CouncilResultController` — `/result` 8개, `/notify` 1개
  - URL 경로는 **전부 불변** → 프론트·E2E 영향 0. 기존 `CouncilControllerTest`도 동일 축으로 분리.
- **`ProjectService` (1,478)** — `updateProject`(387–615, 228줄)와 목록 enrich 계열(`enrichProjectBulkDetail`, `enrichProjectListBatch`, `setCodeNames`, `setBudgetSummary`, `buildIoeCNameMap` 등 약 600줄)이 부피의 대부분입니다. **응답 조립(Query) 책임을 `ProjectQueryAssembler`로 분리**하는 것이 1순위이며, Command/Query 분리는 그 다음입니다.
- **`CostService` (1,142)** — CQ-06(A-2) 완료 후 착수. `update` 호출부가 record로 정리되어 있어 분해가 쉬워집니다.
- **`BudgetWorkService` (1,156)** — 증가 중이므로 D-1 동결선을 우선 적용하고, BE-24(잔여 encounter-order 2곳) 조치와 묶어 처리합니다.

---

## 6. 실행 순서와 검증

```
Wave A  A-1 CQ-17 ──┐  (독립, 병렬 가능)
        A-2 CQ-06 ──┘
           ↓
Wave B  B-2 max-lines ratchet 도입 (자동 게이트 선반영)
        B-1a editor/ 이동 → B-1b layout/ 이동     ← CQ-16 종결
           ↓
Wave C  C-1 hwpx.ts → C-2 에디터 군집 → C-3 composable
        C-4 페이지 20개는 트리거 상환             ← CQ-15 진행형
           ↓
Wave D  D-1 동결선 즉시 적용 / D-2 트리거 발동 시 실행  ← CQ-01·잔여
```

**Wave별 검증 게이트**

| Wave | 명령 |
| ---- | ---- |
| A | `cd it_backend && ./gradlew check` |
| B, C | `cd it_frontend && npm run format:check && npm run check && npm test && npm run test:e2e` |
| D | `./gradlew check` + `./gradlew integrationTest` |

**TASK.md 반영 사항**

| 항목 | 상태 |
| ---- | ---- |
| CQ-06 근거란의 "CQ-01 착수 시" 게이트 → "독립 실행" 으로 변경 (§2 A-2 근거) | ✅ **2026-07-29 반영** |
| CQ-16 범위를 B-1a·B-1b로 한정하고, B-1c(범용 UI 4종 `common/` 편입)를 **CQ-18** 로 분리 등록 | ✅ **2026-07-29 반영** |
| CQ-15에 `max-lines` ratchet을 진척 지표로 연결(30 → C-1~3 완료 시 22 → C-4로 0) | ✅ **Wave B·C 실행계획 확정, 구현 대기** |
| CQ-01에 D-1 동결선 기준값 4개 명시 | ⏸️ 미반영 — D-1 적용 결정 시 |

> 2026-07-29 현재 착수한 작업은 없습니다. 위 2건은 과제 정의(범위·게이트) 정정만 반영한 것이며 코드 변경은 포함하지 않습니다.

**범위 외 신규 등록 후보**

- `Btermm.update` 15개 매개변수는 CQ-19로 등록했습니다. CQ-06 완료 후 별도 비용 도메인 변경에서 판단합니다.
- 테스트 파일 800줄 초과 4건(최대 `useCostListPage.test.ts` 2,144) — 별도 판단 필요, 이번 로드맵에서는 게이트 대상 제외.
