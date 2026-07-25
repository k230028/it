# Clean Code Wave 2 — 구조·타입 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로덕션 `any` 부채 제거(CQ-03, 실측 356건/49개 파일), 레이아웃 앱 셸 공통화(CQ-11), 대형 프론트 파일 4개 분해(CQ-02)를 기능 불변으로 수행한다.

**Architecture:** Wave 0에서 구축한 안전망(PDF 구조 스냅샷, `test:e2e:core`, 커버리지 게이트) 위에서 진행한다. `any` 제거는 "단일 지점 캐스팅 + 기존 도메인 타입 재사용" 패턴으로, 파일 분해는 "기존 파일을 façade로 유지하고 책임 단위 모듈을 추출"하는 패턴으로 통일한다. 모든 커밋은 기능 불변 — 동작 변경이 필요해 보이면 그 자리에서 중단하고 TASK.md에 별도 항목으로 분리한다.

**Tech Stack:** Vue 3/Nuxt 4, TypeScript, Tiptap(@tiptap/core), pdfmake, exceljs, Vitest 4, Playwright

**스펙:** `docs/superpowers/specs/2026-07-21-clean-code-debt-design.md`
**선행:** Wave 0·1 완료 — PDF 회귀 스냅샷과 `test:e2e:core` 명령이 존재해야 한다

---

## 공통 규칙 (전 태스크 적용)

1. **기능 불변**: 로직·조건·계산을 바꾸지 않는다. 타입 부여와 코드 이동만 한다.
2. **커밋 단위**: 파일(또는 파일군) 하나가 완결되면 즉시 커밋. 커밋 전 `npm run check`와 관련 테스트를 통과해야 한다.
3. **불가피한 `any` 잔여**: 제거가 불가능하면(외부 라이브러리 타입 공백 등) 아래 형식으로 사유를 남기고 잔여 건수를 Wave 종료 시 TASK.md에 기록한다:
   ```ts
   // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdfmake vfs 타입 미제공
   ```
4. **검증 명령**: 타입/린트 `npm run check`, 단위 `npm test`, 핵심 E2E `npm run test:e2e:core`, 화면별 E2E는 해당 spec 지정 실행(예: `npx playwright test tests/e2e/cost.spec.ts`).
5. 모든 명령은 `cd C:\it\it_frontend` 후 실행. 커밋은 루트 저장소(`C:\it`)에서 수행.

## `any` 제거 표준 패턴 (배치 태스크 공통 — 아래에서 "패턴 A~D"로 인용)

**패턴 A — `catch (e: any)`**: 파라미터 타입을 제거하고 `unknown`을 문자열로 바꾸는 공용 `getErrorMessage`를 거친 뒤 기존 `formatApiError(string)`을 호출한다. `formatApiError`에 `unknown`을 직접 넘기면 타입 검사가 실패하므로 금지한다.

```ts
// 전
} catch (e: any) {
    toast.add({ severity: 'error', summary: '오류', detail: e.message, life: 3000 });
}
// 후 — utils/common.ts의 formatApiError 재사용
} catch (e) {
    toast.add({
        severity: 'error',
        summary: '오류',
        detail: formatApiError(getErrorMessage(e)),
        life: 3000,
    });
}
```

`getErrorMessage(error: unknown, fallback?: string)`은 Task 2에서 `utils/common.ts`에 먼저 추가한다. 우선순위는 `$fetch` 오류의 `data.message` → `statusMessage` → 일반 `Error.message` → 문자열 오류 → fallback이며, 각 후보가 비어 있거나 문자열이 아니면 다음 후보로 넘어간다.

**패턴 B — DataTable/목록 슬롯의 `(slotProps.data as any)`**: 행 타입을 script에서 1회 선언하고 단일 지점 캐스팅 헬퍼로 축소.

```ts
// script setup — 행 타입은 새로 만들지 말고 데이터를 공급하는 composable의 응답 타입을 재사용한다
type Row = ApprovalItem; // 예: ~/composables/useApprovals의 목록 항목 타입
const asRow = (d: unknown) => d as Row;
```

```vue
<!-- 전 --> {{ (slotProps.data as any).abusNm }}
<!-- 후 --> {{ asRow(slotProps.data).abusNm }}
```

**패턴 C — API 응답/ref의 `any`**: `useApiFetch<T>`·`ref<T>()` 제네릭에 기존 DTO/도메인 타입을 지정한다. 타입이 없으면 데이터를 공급하는 composable에 이미 정의된 인터페이스를 찾아 import하고, 정말 없을 때만 그 composable 파일에 인터페이스를 신설한다(페이지 파일에 타입 정의 금지 — 재사용 불가해짐).

**패턴 D — 라이브러리 타입**: 라이브러리가 제공하는 타입을 쓴다.
- Tiptap: `import type { CommandProps, RawCommands, Editor, JSONContent } from '@tiptap/core';`, NodeView는 `import type { NodeViewProps } from '@tiptap/vue-3';`
- pdfmake: 런타임 0.3.x와 설치된 `@types/pdfmake` 0.2.x가 불일치하므로 `TDocumentDefinitions`/`Content`/`TableCell`은 공통 문서 구조에만 사용한다. 0.3 전용 `addVirtualFileSystem`/`addFonts`/Promise형 `getBlob()`은 `pdf/compat.ts`에 최소 호환 인터페이스를 정의하고 `unknown` 경계에서 한 번만 단언한다. 타입에 없는 속성을 없다고 가정하거나 0.2 콜백 시그니처로 되돌리지 않는다.
- exceljs: `import type { Workbook, Worksheet, Row as ExcelRow } from 'exceljs';`

---

### Task 0: 수동 QA 체크리스트 작성

CQ-02 분해 대상 화면은 E2E가 일부만 커버하므로, 분해 **전에** 검증 기준을 문서로 고정한다(스펙 요구사항).

**Files:**
- Create: `docs/superpowers/notes/2026-07-21-wave2-qa-checklist.md`

- [ ] **Step 1: 체크리스트 파일 작성**

```markdown
# Wave 2 수동 QA 체크리스트

각 분해 커밋 후 해당 화면 항목을 dev 서버(http://localhost:3000)에서 확인한다.
백엔드 필요 항목은 로컬 백엔드(28080) 기동 후 확인한다.

## /info/cost (useCostListPage 분해 — Task 9)
- [ ] 목록 조회·예산연도 필터·검색어 필터 동작
- [ ] 수정 모드 진입/해제, 행 추가, 필수값 검증 표시
- [ ] 행 수정 후 저장(신규/수정/삭제 혼합) 및 취소
- [ ] Excel 일괄 다운로드, 일괄 업로드 다이얼로그
- [ ] 비목코드 CascadeSelect 셀 편집, 셀 붙여넣기(Ctrl+V)
- [ ] 단말기 상세 다이얼로그 열기/작성/해제
- [ ] 계속계약 자동완성·전년도 불러오기

## /info/projects/form (form.vue 분해 — Task 8)
- [ ] 신규 진입·수정 진입(?id=) 렌더
- [ ] 공통코드 드롭다운 + 직접입력(커스텀) 복원
- [ ] 직원검색 다이얼로그 6개 필드 각각 동작, 부서 자동 세팅·불일치 경고
- [ ] 소요예산·단가 자동계산, 소요자원 행 편집
- [ ] 계속사업 자동완성 선택 시 값 복제·연도 +1
- [ ] 저장(신규/수정)·취소 라우팅

## /info/plan/[id] (plan 상세 분해 — Task 7)
- [ ] 상세 렌더(부문/사업유형 목록, 총계·비율)
- [ ] TOC 바로가기 스크롤·ScrollSpy 하이라이트
- [ ] Excel 내보내기(다중 시트) 파일 생성
- [ ] HWPX 내보내기 파일 생성(한글에서 열림)
- [ ] PDF 내보내기(진행률 표시·취소 포함) 파일 생성
- [ ] 브라우저 인쇄 미리보기
- [ ] 텍스트 인라인 수정 저장/취소, 협의회 신청 버튼
- [ ] 삭제(논리삭제) 동작

## 레이아웃 (AppShell 공통화 — Task 1)
- [ ] 일반 화면(/)과 관리자 화면(/admin 이하) 렌더 동일
- [ ] 사이드바·헤더·푸터 표시, main 영역 스크롤바 스타일
- [ ] 인쇄 미리보기에서 사이드바/헤더/푸터 숨김(print: 클래스)
- [ ] 다크모드 전환 시 배경/텍스트 색상
```

- [ ] **Step 2: Commit (루트 저장소)**

```bash
cd C:\it
git add docs/superpowers/notes/2026-07-21-wave2-qa-checklist.md
git commit -m "docs: Wave 2 수동 QA 체크리스트 작성"
```

---

### Task 1: 레이아웃 앱 셸 공통화 (CQ-11)

조사 결과 `default.vue`(72줄)와 `admin.vue`(62줄)는 **템플릿·스타일이 100% 동일**하다(차이는 주석뿐). 공통 `AppShell` 컴포넌트로 추출하고 두 레이아웃을 얇은 래퍼로 유지한다 — 레이아웃 이름(`default`/`admin`)을 모두 보존해 페이지의 `layout: 'admin'` 선언과 라우트 가드 구조를 건드리지 않고, 향후 admin 전용 UI가 생겨도 래퍼에만 추가하면 된다.

**Files:**
- Create: `it_frontend/app/components/AppShell.vue` (components 루트에 배치 — 자동 등록명이 `AppShell` 그대로가 되도록)
- Modify: `it_frontend/app/layouts/default.vue`
- Modify: `it_frontend/app/layouts/admin.vue`

- [ ] **Step 1: AppShell.vue 작성** (기존 default.vue의 마크업·스타일 그대로 이동)

```vue
<!--
[components/AppShell.vue] 공통 앱 셸
default·admin 레이아웃이 공유하는 사이드바 + 헤더 + 콘텐츠 + 푸터 골격.
레이아웃별 차이가 생기면 이 컴포넌트가 아니라 각 레이아웃 래퍼에 추가한다.
-->
<template>
    <div
        class="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans print:h-auto print:overflow-visible print:bg-white"
    >
        <AppSidebar class="print:hidden" />
        <div
            class="flex-1 flex flex-col min-w-0 relative print:h-auto print:overflow-visible print:block"
        >
            <AppHeader class="print:hidden" />
            <main
                class="main-scroll flex-1 min-h-0 overflow-auto p-6 print:overflow-visible print:p-0 print:h-auto"
            >
                <slot />
            </main>
            <footer
                class="h-10 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 text-xs bg-white dark:bg-zinc-900 shrink-0 print:hidden"
            >
                &copy; 2026 IT Portal System. All rights reserved.
            </footer>
        </div>
    </div>
</template>

<style scoped>
.main-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}
.main-scroll::-webkit-scrollbar-track {
    background: transparent;
}
.main-scroll::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 3px;
    transition: background 0.2s;
}
.main-scroll:hover::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.18);
}
.main-scroll::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.35);
}
</style>
```

- [ ] **Step 2: default.vue를 래퍼로 교체**

```vue
<!--
[layouts/default.vue] 기본 레이아웃
인증된 사용자에게 표시되는 메인 애플리케이션 레이아웃.
골격은 components/AppShell.vue를 공유한다.
-->
<template>
    <AppShell>
        <slot />
    </AppShell>
</template>
```

- [ ] **Step 3: admin.vue를 래퍼로 교체**

```vue
<!--
[layouts/admin.vue] 관리자 전용 레이아웃
시스템관리자(ITPAD001) 전용. 현재는 default와 동일한 AppShell 골격을 사용하며,
관리자 전용 UI가 필요해지면 이 래퍼에 추가한다.
-->
<template>
    <AppShell>
        <slot />
    </AppShell>
</template>
```

- [ ] **Step 4: 검증**

Run: `cd C:\it\it_frontend; npm run check` 그리고 `npm test`
Expected: 통과

Run: `cd C:\it\it_frontend; npm run test:e2e:core` 그리고 `npx playwright test tests/e2e/access-control.spec.ts tests/e2e/admin/realtime-logs.spec.ts`
Expected: 통과 — 일반 레이아웃(로그인·프로젝트·결재)과 admin 레이아웃(접근제어·실시간로그) 화면 렌더 회귀 없음

QA 체크리스트 "레이아웃" 절 수행.

- [ ] **Step 5: Commit (루트 저장소)**

```bash
cd C:\it
git add it_frontend/app/components/AppShell.vue it_frontend/app/layouts
git commit -m "refactor: default·admin 레이아웃의 중복 앱 셸을 AppShell로 공통화 (CQ-11)"
```

---

### Task 2: CQ-03 배치① — 결재·사업집행 4단계 `any` 제거 (약 66건)

**Files (파일: 조사 시점 매칭 건수):**
- Modify: `app/utils/common.ts`, `tests/unit/utils/common.test.ts` — `unknown` 오류 메시지 추출 헬퍼와 단위 테스트
- Modify: `app/pages/approval/list.vue` (24), `app/components/approval/ApprovalTimeline.vue` (2)
- Modify: `app/pages/project/estimate/index.vue` (4), `app/pages/project/deliberation/[docNo].vue` (10), `app/pages/project/deliberation/index.vue` (2), `app/pages/project/contract/[docNo].vue` (10), `app/pages/project/contract/index.vue` (2), `app/pages/project/payment/[docNo].vue` (10), `app/pages/project/payment/index.vue` (2)

(참고: `useItBudgetApprovalFormPdf.ts`의 16건은 PDF 성격이므로 배치②에서 처리)

- [ ] **Step 1: 공용 `getErrorMessage` 추가 및 검증**

`app/utils/common.ts`에 다음 계약으로 추가한다.

```ts
/**
 * 알 수 없는 오류 값에서 사용자 표시용 원문 메시지를 추출한다.
 *
 * @param error Error, $fetch 오류 객체, 문자열 등 알 수 없는 오류 값
 * @param fallback 식별 가능한 메시지가 없을 때 반환할 기본 문구
 * @returns 추출한 원문 메시지. 반환값은 필요하면 formatApiError로 정제한다.
 */
export const getErrorMessage = (
    error: unknown,
    fallback = '요청 처리 중 오류가 발생했습니다.',
): string => {
    if (typeof error === 'string' && error.trim()) return error;
    if (typeof error !== 'object' || error === null) return fallback;

    const candidate = error as {
        data?: { message?: unknown };
        statusMessage?: unknown;
        message?: unknown;
    };
    const messages = [candidate.data?.message, candidate.statusMessage, candidate.message];
    return messages.find((value): value is string => typeof value === 'string' && value.trim() !== '') ?? fallback;
};
```

`tests/unit/utils/common.test.ts`에 `$fetch data.message`, `statusMessage`, 일반 `Error`, 문자열, null/객체 fallback 케이스를 추가한다.

Run: `npx vitest run tests/unit/utils/common.test.ts` 그리고 `npm run check`
Expected: 통과

- [ ] **Step 2: 현재 매칭 목록 확보**

Run: `cd C:\it\it_frontend; rg -n ":\s*any\b|=\s*any\b|\bas\s+any\b|<[^>]*\bany\b[^>]*>|\bany\[\]|eslint-disable.*no-explicit-any" app/pages/approval app/components/approval app/pages/project/estimate app/pages/project/deliberation app/pages/project/contract app/pages/project/payment` (rg가 없으면 PowerShell `Select-String` 사용 — `npx rg` 사용 금지)
Expected: 위 파일들에서 66건 내외 목록

- [ ] **Step 3: approval/list.vue + ApprovalTimeline.vue 치환**

패턴 A~D를 적용한다. 행 타입은 `~/composables/useApprovals`의 목록 항목 타입을 재사용(패턴 B). 완료 후:
Run: `npm run check` 그리고 `npx vitest run tests/unit/composables/useApprovals.test.ts tests/unit/composables/useApprovalStatus.test.ts`
Expected: 통과, 두 파일 매칭 0

- [ ] **Step 4: Commit**

```bash
cd C:\it
git add it_frontend/app/utils/common.ts it_frontend/tests/unit/utils/common.test.ts it_frontend/app/pages/approval it_frontend/app/components/approval
git commit -m "refactor: 결재 목록·타임라인의 any 타입 우회 제거 (CQ-03 배치1)"
```

- [ ] **Step 5: 사업집행 4단계 8개 파일 치환**

estimate/deliberation/contract/payment의 index.vue와 [docNo].vue에 패턴 A~C 적용. 행·상세 타입은 `useEstimates`/`useDeliberations`/`useContracts`/`usePayments` composable의 기존 타입을 재사용한다(이들 composable은 매칭 0건 — 이미 타입이 정의돼 있다).
Run: `npm run check` 그리고 `npm test`
Expected: 통과, 8개 파일 매칭 0

- [ ] **Step 6: E2E 확인 및 Commit**

Run: `cd C:\it\it_frontend; npm run test:e2e:core`
Expected: 통과 (결재 처리 흐름 포함)

```bash
cd C:\it
git add it_frontend/app/pages/project
git commit -m "refactor: 사업집행 4단계 페이지의 any 타입 우회 제거 (CQ-03 배치1)"
```

---

### Task 3: CQ-03 배치② — Tiptap/Excel/PDF `any` 제거 (약 120건)

**Files (파일: 건수):**
- Tiptap 확장·composable: `app/components/extensions/tiptap-content-extensions.ts` (44), `app/components/extensions/tiptap-extensions.ts` (10), `app/composables/useTiptapTableTools.ts` (12), `app/composables/useTiptapVariables.ts` (4)
- Tiptap 컴포넌트: `app/components/TiptapEditor.vue` (7), `app/components/TiptapToolbar.vue` (4), NodeView 3종(`VariableNodeView.vue`/`InlineMathNodeView.vue`/`BlockMathNodeView.vue` 각 2), `app/components/review/ReviewEditor.vue` (2)
- 산출물·기타: `app/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts` (16), `app/components/ExcalidrawWrapper.vue` (8), `app/utils/excel.ts` (3), `app/composables/useHwpxExport.ts` (4)
- Create: `app/features/approval/forms/itBudget/pdf/compat.ts` — pdfmake 0.3 런타임과 0.2 타입 선언 사이의 최소 호환 경계

- [ ] **Step 1: Tiptap 확장·composable 치환**

패턴 D의 Tiptap 타입을 적용한다. 특히 `tiptap-content-extensions.ts`(44건)는 `addCommands()`/`addAttributes()`의 `any`를 `RawCommands`·`CommandProps`·`JSONContent`로 교체한다. Tiptap 내부 스키마 접근처럼 타입이 제공되지 않는 지점은 공통 규칙 3(사유 명시) 적용.
Run: `npm run check` 그리고 `npx vitest run tests/unit/components/extensions/variableExtension.test.ts`
Expected: 통과

- [ ] **Step 2: Commit**

```bash
cd C:\it
git add it_frontend/app/components/extensions it_frontend/app/composables/useTiptapTableTools.ts it_frontend/app/composables/useTiptapVariables.ts
git commit -m "refactor: Tiptap 확장·composable의 any를 @tiptap/core 타입으로 교체 (CQ-03 배치2)"
```

- [ ] **Step 3: Tiptap 컴포넌트 + Excalidraw 치환**

NodeView는 `NodeViewProps`(패턴 D), 에디터 인스턴스는 `Editor` 타입. `ExcalidrawWrapper.vue`는 `@excalidraw/excalidraw`의 제공 타입(`ExcalidrawImperativeAPI` 등)을 우선 적용하고, React 브리지 경계처럼 타입이 없는 지점은 사유 명시.
Run: `npm run check` 그리고 `npm test` — 이후 `npx playwright test tests/e2e/tiptap-variable.spec.ts`
Expected: 통과

- [ ] **Step 4: Commit**

```bash
cd C:\it
git add it_frontend/app/components
git commit -m "refactor: Tiptap 컴포넌트·Excalidraw 래퍼의 any 축소 (CQ-03 배치2)"
```

- [ ] **Step 5: 산출물 모듈(excel/hwpx/PDF) 치환**

`excel.ts`는 exceljs 타입, `useHwpxExport.ts`는 내부 옵션 인터페이스를 적용한다. PDF는 패턴 D에 따라 공통 문서 타입과 0.3 최소 호환 인터페이스를 분리한다. 현재 소스에 명시된 `@types/pdfmake` 공백을 단순 삭제하지 말고 `pdf/compat.ts`의 단일 경계로 옮긴다. **PDF 파일 치환 후 Wave 0 회귀 스냅샷이 변하면 안 된다.**

Run: `npm run check` 그리고 `npx vitest run tests/unit/features/approval/forms/itBudget/ tests/unit/utils/excel.test.ts tests/unit/composables/useHwpxExport.direct.test.ts`
Expected: 전체 PASS, 특히 `useItBudgetApprovalFormPdf.test.ts`의 CQ-04 스냅샷이 `1 snapshot passed`

- [ ] **Step 6: Commit**

```bash
cd C:\it
git add it_frontend/app/utils/excel.ts it_frontend/app/composables/useHwpxExport.ts it_frontend/app/features/approval/forms/itBudget
git commit -m "refactor: Excel·HWPX·PDF 산출물 모듈의 any를 라이브러리 타입으로 교체 (CQ-03 배치2)"
```

---

### Task 4: CQ-03 배치③ — 가이드 문서 CRUD `any` 제거 (약 17건)

**Files:**
- Modify: `app/pages/guide/index.vue` (10), `app/composables/useGuideDocuments.ts` (7)

- [ ] **Step 1: composable부터 치환**

`useGuideDocuments.ts`의 응답 타입을 인터페이스로 명시(패턴 C — 타입 신설은 이 composable 파일에)하고, `guide/index.vue`는 그 타입을 import해 패턴 A~B 적용.
Run: `npm run check` 그리고 `npm test`
Expected: 통과, 두 파일 매칭 0

- [ ] **Step 2: Commit**

```bash
cd C:\it
git add it_frontend/app/pages/guide it_frontend/app/composables/useGuideDocuments.ts
git commit -m "refactor: 가이드 문서 CRUD의 any 타입 우회 제거 (CQ-03 배치3)"
```

---

### Task 5: CQ-03 배치④ — 잔여 도메인 `any` 제거 (약 153건)

TASK.md의 명시 순서(①~③) 밖 잔여를 도메인 묶음으로 처리해 CQ-03을 완결한다.

**Files (묶음별):**
- 예산·인라인편집: `app/components/common/InlineEditCell.vue` (20), `app/pages/budget/list.vue` (19), `app/pages/budget/status.vue` (16), `app/pages/budget/work.vue` (6), `app/pages/budget/approval.vue` (6)
- info 도메인: `app/pages/info/projects/form.vue` (13), `app/pages/info/documents/[id]/index.vue` (10), `app/pages/info/plan/[id].vue` (8), `app/pages/info/documents/form.vue` (8), 그 외 info 하위 2건짜리 파일들(`info/projects/[id].vue`, `info/cost/[id].vue`, `info/documents/[id]/review.vue`, `info/council-request/prepare/[id].vue`)
- 기타: `app/composables/useCostListPage.ts` (6), `app/pages/project/bizplan/[abusMngNo].vue` (6), `app/components/common/EmployeeSearchDialog.vue` (6), `app/components/GeminiChat.vue` (5), `app/pages/admin/boards/index.vue` (4), 나머지 2건 이하 파일들(`plugins/auth.ts`, `composables/useApiFetch.ts`, `composables/useOrganization.ts`, `composables/useProjects.ts`, `pages/login.vue`, `components/cost/TerminalTableSection.vue` 등)

- [ ] **Step 1: 예산·인라인편집 묶음 치환 → 검증 → 커밋**

`InlineEditCell.vue`(20건)는 제네릭 컴포넌트화가 과설계가 되기 쉬우므로 셀 값 타입을 `unknown` + 렌더 지점 단일 캐스팅(패턴 B 변형)으로 정리한다.
Run: `npm run check`, `npx vitest run tests/unit/components/budget/`, `npx playwright test tests/e2e/budget.spec.ts`
Expected: 통과

```bash
cd C:\it
git add it_frontend/app/components/common/InlineEditCell.vue it_frontend/app/pages/budget
git commit -m "refactor: 예산·인라인편집의 any 타입 우회 제거 (CQ-03 배치4)"
```

- [ ] **Step 2: info 도메인 묶음 치환 → 검증 → 커밋**

주의: `info/projects/form.vue`와 `info/plan/[id].vue`는 Task 7·8에서 분해 예정이므로 **이 단계에서 타입만 정리**하고 구조는 건드리지 않는다(분해 시 diff 최소화).
Run: `npm run check`, `npm test`, `npx playwright test tests/e2e/documents.spec.ts tests/e2e/projects.spec.ts`
Expected: 통과

```bash
cd C:\it
git add it_frontend/app/pages/info
git commit -m "refactor: info 도메인 페이지의 any 타입 우회 제거 (CQ-03 배치4)"
```

- [ ] **Step 3: 기타 묶음 치환 → 검증 → 커밋**

Run: `npm run check`, `npm test`, `npx playwright test tests/e2e/cost.spec.ts`
Expected: 통과

```bash
cd C:\it
git add it_frontend/app it_frontend/server
git commit -m "refactor: 잔여 composable·컴포넌트의 any 타입 우회 제거 (CQ-03 배치4)"
```

- [ ] **Step 4: 전체 재스캔**

Run: `cd C:\it\it_frontend; rg -n --glob "*.ts" --glob "*.vue" ":\s*any\b|=\s*any\b|\bas\s+any\b|<[^>]*\bany\b[^>]*>|\bany\[\]|eslint-disable.*no-explicit-any" app server`
Expected: 사유 주석이 달린 정당한 잔여만 남음. 파일별 잔여 건수를 기록해 Task 10에서 TASK.md에 반영. 정규식 카운트는 재고 확인용이며 최종 합격 기준은 `npm run check`의 `no-explicit-any` 결과다.

---

### Task 6: CQ-02 분해 1 — useItBudgetApprovalFormPdf.ts (1,288줄 → 본체 800줄 이하)

Wave 0의 회귀 스냅샷이 판별 기준이다. **각 이동 커밋 후 스냅샷이 `passed`(not `written`)여야 한다.**

**Files:**
- Create: `app/features/approval/forms/itBudget/pdf/fonts.ts`
- Create: `app/features/approval/forms/itBudget/pdf/textPrimitives.ts`
- Create: `app/features/approval/forms/itBudget/pdf/headerSection.ts`
- Modify: `app/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts`

이동 매핑(원본 라인은 조사 시점 기준 — 실행 시 함수명으로 검색):

| 원본 | 이동 위치 | export |
| --- | --- | --- |
| `cachedVfs`/`cachedFonts`/`initDefaults` (43~71행) | `pdf/fonts.ts` | 내부 유지하되 `PdfFontContext`로 결과 노출 |
| `loadKoreanFont`+`toBase64` (97~178행) | `pdf/fonts.ts` | `ensureKoreanFonts(): Promise<PdfFontContext>` |
| `cellVal`/`htmlToText`/`splitDateTime`/`buildDateCell` (310~381행) | `pdf/textPrimitives.ts` | 각 named export |
| `buildApprovalTable`/`buildHeaderSection` (388~492행) | `pdf/headerSection.ts` | 각 named export |
| `generateReport` 본문 나머지 | 원본 파일 유지 | 변경 없음 |

- [ ] **Step 1: fonts.ts 추출**

`loadKoreanFont`는 현재 composable 클로저의 `toast`를 쓰므로, 추출 시 toast를 인자로 받는다:

```ts
// app/features/approval/forms/itBudget/pdf/fonts.ts
import pdfFonts from 'pdfmake/build/vfs_fonts';
import nanumGothic from '@/assets/fonts/NanumGothic-Regular.ttf?url';
import nanumGothicBold from '@/assets/fonts/NanumGothic-Bold.ttf?url';
import nanumGothicExtraBold from '@/assets/fonts/NanumGothic-ExtraBold.ttf?url';
import type { PdfFontContext } from './compat';

/** 원본 43~71행의 cachedVfs/cachedFonts/initDefaults를 그대로 이동 */

/**
 * NanumGothic 3종의 pdfmake VFS 구성을 만든다. 실패 시 Roboto 폴백 후 경고 toast.
 * 원본 97~178행의 loadKoreanFont 본문을 그대로 이동하고 toast 참조만 인자로 바꾼다.
 */
export async function ensureKoreanFonts(
    toastAdd: (msg: { severity: string; summary: string; detail: string; life: number }) => void,
): Promise<PdfFontContext> {
    // 원본 로딩·폴백 본문을 이동한다.
    // 성공과 Roboto 폴백 모두 본체가 필요로 하는 세 값을 반환한다.
    return { font: fontName, vfs: cachedVfs, fonts: cachedFonts };
}
```

`PdfFontContext`는 `pdf/compat.ts`에 다음 의미로 정의한다: `font`는 문서 기본 폰트명, `vfs`는 `Record<string, string>`, `fonts`는 pdfmake 폰트 패밀리 맵. null 캐시는 반환하지 않도록 `initDefaults()` 이후에만 결과를 만든다.

원본 파일에서는 해당 블록을 삭제하고 기존 호출을 다음처럼 교체한다.

```ts
const { font, vfs: currentVfs, fonts: currentFonts } = await ensureKoreanFonts((msg) =>
    toast.add(msg),
);
```

PDF 생성부의 `addVirtualFileSystem(currentVfs)`·`addFonts(currentFonts)` 계약은 그대로 유지한다. `font` 또는 캐시를 본체에서 참조할 수 없는 `Promise<void>` 형태로 추출하면 안 된다.

Run: `npx vitest run tests/unit/features/approval/forms/itBudget/`
Expected: 기존 테스트 + `useItBudgetApprovalFormPdf.test.ts`의 CQ-04 회귀 스냅샷 `passed`

```bash
cd C:\it
git add it_frontend/app/features/approval/forms/itBudget
git commit -m "refactor: IT예산 PDF 폰트 초기화를 pdf/fonts.ts로 추출 (CQ-02)"
```

- [ ] **Step 2: textPrimitives.ts 추출**

`cellVal`/`htmlToText`/`splitDateTime`/`buildDateCell`은 `generateReport` 내부 중첩 함수다. 순수 함수이므로 그대로 모듈 함수로 이동하고 named export한다. 원본에서는 import로 교체.

Run: 같은 vitest 명령
Expected: 스냅샷 `passed`

```bash
cd C:\it
git add it_frontend/app/features/approval/forms/itBudget
git commit -m "refactor: IT예산 PDF 텍스트 프리미티브 분리 (CQ-02)"
```

- [ ] **Step 3: headerSection.ts 추출**

`buildApprovalTable`/`buildHeaderSection`을 이동한다. 클로저에서 참조하던 값(결재선, 옵션 등)은 함수 인자로 승격한다 — 이동한 본문이 참조하는 식별자 목록이 곧 인자 목록이다.

Run: 같은 vitest 명령
Expected: 스냅샷 `passed`

- [ ] **Step 4: 본체 라인 수 확인 및 Commit**

Run: `(Get-Content it_frontend/app/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts | Measure-Object -Line).Lines`
Expected: 800 이하. 800을 넘으면 현재 이동 결과는 중간 커밋할 수 있지만 CQ-02 완료로 간주하지 않는다. 남은 책임 블록을 식별해 이 Task에 추가 추출 Step을 작성하고 800 이하가 된 뒤 종료한다.

```bash
cd C:\it
git add it_frontend/app/features/approval/forms/itBudget
git commit -m "refactor: IT예산 PDF 결재선·헤더 빌더 분리 (CQ-02)"
```

---

### Task 7: CQ-02 분해 2 — info/plan/[id].vue (2,149줄)

내보내기 4종(Excel 224~387행, HWPX 388~696행, PDF 697~990행, 인쇄 991~1080행)을 각각 composable로 추출한다. 페이지에는 상태·렌더·인라인 수정만 남긴다.

**Files:**
- Create: `app/features/plan/usePlanExcelExport.ts`
- Create: `app/features/plan/usePlanHwpxExport.ts`
- Create: `app/features/plan/usePlanPdfExport.ts`
- Create: `app/features/plan/usePlanPrint.ts`
- Modify: `app/pages/info/plan/[id].vue`

공통 추출 형식 — 이동 코드가 참조하는 페이지 상태를 팩토리 인자로 받는다. 실행 전에 각 블록의 읽기/쓰기 식별자 표를 작성하고 `ctx` 인터페이스에 실제 export 타입과 `Ref`/`ComputedRef` 여부를 명시한다. 반응성을 보존하기 위해 `.value` 결과를 넘기거나 ctx를 값으로 구조분해하지 않는다.

```ts
// app/features/plan/usePlanHwpxExport.ts (다른 3개도 동일 형식)
/**
 * 계획 상세 HWPX 내보내기.
 * [id].vue 388~696행의 escHtml/sanitizeTableHtml/sanitizeAllocationTableHtml/
 * unitCaption/buildProjectListTable/buildHwpHtml/downloadHwp를 그대로 이동한다.
 * @param ctx 이동한 본문이 참조하는 페이지 상태(plan ref, 포맷 함수 등) —
 *            이동 시 참조 식별자를 이 목록에 추가하고 실제 타입(usePlan 반환 타입 등)을 지정한다
 */
export function usePlanHwpxExport(ctx: {
    planData: Ref<PlanDetail | null | undefined>;
    snapshot: ComputedRef<PlanSnapshot | null>;
    selectedUnit: Ref<string>;
    formatBudget: (amount: number | null | undefined) => string;
    // 이동 전 식별자 표에서 확인한 나머지 상태·함수도 실제 타입으로 추가
}) {
    // (이동한 본문)
    return { downloadHwp };
}
```

`PlanDetail`/`PlanSnapshot`은 `~/composables/usePlan`에서 import하고 `Ref`/`ComputedRef`는 Vue type import를 사용한다. `ReturnType<typeof usePlan>['plan']`은 실제 반환 계약에 없는 속성이므로 사용 금지한다.

- [ ] **Step 1: usePlanExcelExport.ts 추출 → 검증 → 커밋**

Run: `npm run check` 그리고 `npm test`, QA 체크리스트의 "Excel 내보내기" 항목 수동 확인

```bash
cd C:\it
git add it_frontend/app/features/plan it_frontend/app/pages/info/plan
git commit -m "refactor: 계획 상세 Excel 내보내기 composable 추출 (CQ-02)"
```

- [ ] **Step 2: usePlanHwpxExport.ts 추출 → 검증 → 커밋** (QA: HWPX 항목)

검증은 Step 1과 동일하다.

```bash
cd C:\it
git add it_frontend/app/features/plan/usePlanHwpxExport.ts it_frontend/app/pages/info/plan
git commit -m "refactor: 계획 상세 HWPX 내보내기 composable 추출 (CQ-02)"
```

- [ ] **Step 3: usePlanPdfExport.ts 추출 → 검증 → 커밋** (QA: PDF 진행률·취소 포함)

```bash
cd C:\it
git add it_frontend/app/features/plan/usePlanPdfExport.ts it_frontend/app/pages/info/plan
git commit -m "refactor: 계획 상세 PDF 내보내기 composable 추출 (CQ-02)"
```

- [ ] **Step 4: usePlanPrint.ts 추출 → 검증 → 커밋** (QA: 인쇄 미리보기)

```bash
cd C:\it
git add it_frontend/app/features/plan/usePlanPrint.ts it_frontend/app/pages/info/plan
git commit -m "refactor: 계획 상세 인쇄 composable 추출 (CQ-02)"
```

- [ ] **Step 5: 페이지 잔여 라인 확인**

Run: `(Get-Content "it_frontend/app/pages/info/plan/[id].vue" | Measure-Object -Line).Lines`
Expected: 1,300줄 이하로 축소(내보내기 4종 약 850줄 이동). QA 체크리스트 "/info/plan/[id]" 절 전체 수행

---

### Task 8: CQ-02 분해 3 — info/projects/form.vue (2,184줄)

스크립트의 4개 응집 블록을 feature composable로 추출한다. 템플릿은 변경하지 않는다.

**Files:**
- Create: `app/features/project/useProjectFormCodes.ts` — 코드 필드 선택/커스텀/복원 (원본 265~407행)
- Create: `app/features/project/useProjectFormEmployeeSearch.ts` — 직원검색 6필드·부서 자동세팅·불일치 검증 (원본 421~795행)
- Create: `app/features/project/useProjectFormSave.ts` — executeSave/validateRequiredFields/saveProject (원본 884~1076, 1156~1182행)
- Create: `app/features/project/useContinueProjectSearch.ts` — 계속사업 자동완성·연도+1 복제 (원본 1197~1434행)
- Modify: `app/pages/info/projects/form.vue`

추출 형식은 Task 7과 동일(ctx 팩토리 — `form`의 reactive 객체와 참조 상태를 원본 반응형 객체 그대로 전달). 각 Step 전에 읽기/쓰기 식별자 표를 작성하고, 값 복사나 구조분해로 반응성을 잃지 않는지 확인한다. watch가 포함된 블록(소요자원/단가 자동계산 1077~1155행)은 `form`과 강결합이므로 페이지에 남긴다(YAGNI — 무리한 추출로 반응성 경계를 흐리지 않는다).

- [ ] **Step 1: useProjectFormCodes.ts 추출 → `npm run check`+`npm test` → 커밋**

```bash
cd C:\it
git add it_frontend/app/features/project it_frontend/app/pages/info/projects/form.vue
git commit -m "refactor: 사업 폼 코드 필드 로직 composable 추출 (CQ-02)"
```

- [ ] **Step 2: useProjectFormEmployeeSearch.ts 추출 → 검증 → 커밋** (QA: 직원검색 6필드)

```bash
cd C:\it
git add it_frontend/app/features/project/useProjectFormEmployeeSearch.ts it_frontend/app/pages/info/projects/form.vue
git commit -m "refactor: 사업 폼 직원검색 로직 composable 추출 (CQ-02)"
```

- [ ] **Step 3: useProjectFormSave.ts 추출 → 검증 → 커밋** (QA: 저장/검증/라우팅)

```bash
cd C:\it
git add it_frontend/app/features/project/useProjectFormSave.ts it_frontend/app/pages/info/projects/form.vue
git commit -m "refactor: 사업 폼 저장 로직 composable 추출 (CQ-02)"
```

- [ ] **Step 4: useContinueProjectSearch.ts 추출 → 검증 → 커밋** (QA: 계속사업 복제)

```bash
cd C:\it
git add it_frontend/app/features/project/useContinueProjectSearch.ts it_frontend/app/pages/info/projects/form.vue
git commit -m "refactor: 사업 폼 계속사업 검색 로직 composable 추출 (CQ-02)"
```

- [ ] **Step 5: E2E + QA 마감**

Run: `npx playwright test tests/e2e/projects.spec.ts` (신규 등록 버튼→폼 이동 시나리오 포함)
Expected: 통과. QA 체크리스트 "/info/projects/form" 절 전체 수행

- [ ] **Step 6: 페이지 잔여 라인 확인**

Run: `(Get-Content "it_frontend/app/pages/info/projects/form.vue" | Measure-Object -Line).Lines`
Expected: 1,300줄 이하. 초과하면 남은 응집 책임을 이 Task에 추가하고 기준을 충족할 때까지 CQ-02를 완료 처리하지 않는다.

---

### Task 9: CQ-02 분해 4 — useCostListPage.ts (1,819줄)

공유 편집 상태 1개와 책임 모듈 6개를 추출하고 `useCostListPage.ts`는 **반환 계약(1735~1818행의 return 목록)을 그대로 유지하는 façade**로 남긴다 — 페이지(`pages/info/cost/index.vue`)는 한 줄도 바뀌지 않는 것이 목표다. 기존 `composables/costListPageHelpers.ts`(COST_REQUIRED_FIELDS)는 그대로 둔다.

**Files:**
- Create: `app/composables/costList/useCostCodeOptions.ts` — 공통코드 옵션·비목 트리 (원본 62~101, 1098~1191행)
- Create: `app/composables/costList/useCostEditingState.ts` — `viewMode`, invalid map, dirty·검증 원시 연산 (원본 112~232, 577~586행)
- Create: `app/composables/costList/useCostRowEditing.ts` — 직원·행추가/삭제·셀 편집·붙여넣기 (원본 233~576, 869~912, 1242~1307, 1615~1734행)
- Create: `app/composables/costList/useCostPersistence.ts` — 저장/취소/폐기 (원본 658~868행)
- Create: `app/composables/costList/useCostExcelTransfer.ts` — 일괄 다운로드/업로드 (원본 913~1097행)
- Create: `app/composables/costList/useCostTerminalDialogs.ts` — 단말기 편집·다이얼로그 (원본 1225~1241, 1308~1473행)
- Create: `app/composables/costList/useCostCarryOver.ts` — 전년도 선택·계속계약 불러오기 (원본 587~657, 1474~1614행)
- Modify: `app/composables/useCostListPage.ts` — façade화
- Modify: `tests/unit/composables/useCostListPage.test.ts` — 공개 반환 키 기준선과 기존 동작 회귀

위 범위는 서로 겹치지 않는다. 특히 `1225~1241`의 `exitTerminalEdit` 계열은 TerminalDialogs만 소유하고 RowEditing에는 포함하지 않는다.

추출 전에 아래 의존성 표를 실제 식별자로 최신화한다. 모듈은 다른 모듈의 내부 ref를 직접 import하지 않고 façade가 넘기는 ctx 계약만 사용한다.

| 모듈 | 제공 책임 | 선행 ctx |
| --- | --- | --- |
| CodeOptions | 코드 옵션·비목 트리·표시명 | API/config와 façade 공유 ref |
| EditingState | `viewMode`, invalid map, `markInvalidFields`, `markDirty`, row 상태 | `costs`, snapshots, REQUIRED_FIELDS |
| ExcelTransfer | 다운로드·업로드 | costs, 코드 표시 함수, createCost |
| TerminalDialogs | `isTerminal`, `exitTerminalEdit`, 단말기 다이얼로그 | EditingState의 `markDirty`, costs |
| CarryOver | 전년도 선택·계속계약 복제 | EditingState의 `markDirty`, CodeOptions, fetchCostOnce |
| RowEditing | 직원·행·비목 편집·붙여넣기 | EditingState, CodeOptions, TerminalDialogs의 공개 함수 |
| Persistence | 저장·취소·폐기 | EditingState의 검증 API, costs, CRUD/refresh |

추출 순서는 CodeOptions → EditingState → ExcelTransfer → TerminalDialogs → CarryOver → RowEditing → Persistence다. 이 순서로 TerminalDialogs↔RowEditing 및 Persistence→RowEditing의 순환을 만들지 않는다. 각 모듈은 Task 7과 같은 ctx 팩토리 형식으로 작성하고, façade에서는 반환 이름 충돌을 숨기는 무분별한 spread 대신 기존 공개 이름을 명시적으로 재노출한다:

```ts
// useCostListPage.ts (façade 골격 — 반환 목록은 기존 1735~1818행과 동일해야 한다)
export const useCostListPage = () => {
    // (모듈로 이동하지 않은 공유 상태 선언은 여기 유지)
    const codeOptions = useCostCodeOptions({ /* 공유 상태 전달 */ });
    const editingState = useCostEditingState({ /* ... */ });
    const excel = useCostExcelTransfer({ /* ... */ });
    // ...
    return {
        // 기존 1735~1818행의 공개 이름과 순서를 유지해 명시적으로 재노출
        yearOptions,
        selectedYear,
        costs,
        markDirty: editingState.markDirty,
        downloadExcel: excel.downloadExcel,
        // 나머지도 기존 이름을 하나씩 명시
    };
};
```

- [ ] **Step 1: 현재 façade 공개 계약 기준선 고정**

기존 `tests/unit/composables/useCostListPage.test.ts`에 공개 키 기준 테스트를 추가한다. `Object.keys(useCostListPage()).sort()`를 고정 배열과 비교해 추출 중 누락·중복·이름 변경을 즉시 검출한다. 이 테스트는 구현 전 한 번 통과시킨다.

Run: `npx vitest run tests/unit/composables/useCostListPage.test.ts`
Expected: 통과

```bash
cd C:\it
git add it_frontend/tests/unit/composables/useCostListPage.test.ts
git commit -m "test: useCostListPage façade 공개 계약 기준선 고정 (CQ-02)"
```

- [ ] **Step 2~8: 모듈별 추출 → 검증 → 커밋 (7회 반복)**

각 모듈마다:
Run: `npm run check` 그리고 `npx vitest run tests/unit/composables/useCostListPage.test.ts tests/unit/composables/costListPageHelpers.test.ts`, 이후 `npx playwright test tests/e2e/cost.spec.ts`
Expected: 통과

```bash
cd C:\it
git add it_frontend/app/composables/costList/useCostCodeOptions.ts it_frontend/app/composables/useCostListPage.ts
git commit -m "refactor: 전산업무비 목록 공통코드 옵션 로드를 costList/useCostCodeOptions.ts로 추출 (CQ-02)"
```

(이후 6회도 현재 모듈 파일과 `useCostListPage.ts`만 명시적으로 `git add`한다. 커밋 메시지는 같은 형식으로 각 책임·파일명을 기록한다: `편집 상태·dirty 검증을 costList/useCostEditingState.ts로 추출`, `Excel 일괄 전송을 costList/useCostExcelTransfer.ts로 추출`, `단말기 다이얼로그를 costList/useCostTerminalDialogs.ts로 추출`, `전년도·계속계약 불러오기를 costList/useCostCarryOver.ts로 추출`, `행 편집을 costList/useCostRowEditing.ts로 추출`, `저장·취소를 costList/useCostPersistence.ts로 추출`.)

- [ ] **Step 9: 마감 검증**

Run: `(Get-Content it_frontend/app/composables/useCostListPage.ts | Measure-Object -Line).Lines`
Expected: 400줄 이하(façade + 공유 상태), 공개 키 기준 테스트 통과, QA 체크리스트 "/info/cost" 절 전체 수행. 400줄을 넘거나 공개 키가 달라지면 CQ-02를 완료 처리하지 않는다.

---

### Task 10: Wave 2 종료 처리

**Files:**
- Modify: `TASK.md` — CQ-02, CQ-03, CQ-11 행
- Modify: `TASK_DONE.md`

- [ ] **Step 1: 전체 검증 일괄 실행**

Run:
```bash
cd C:\it\it_frontend
npm run check
npm test
npm run test:e2e:core
```
Expected: 전체 통과

- [ ] **Step 2: `any` 최종 카운트 기록**

Run: `rg -n --glob "*.ts" --glob "*.vue" ":\s*any\b|=\s*any\b|\bas\s+any\b|<[^>]*\bany\b[^>]*>|\bany\[\]|eslint-disable.*no-explicit-any" app server`
Expected: 사유 주석 포함 잔여만. 총 건수와 파일 목록을 기록한다. `rg` 결과가 0이어도 `npm run check`가 실패하면 CQ-03을 완료 처리하지 않는다.

- [ ] **Step 3: TASK.md 갱신**

- CQ-11 → `✅ Done`: `2026-07-21 AppShell 공통화(components/AppShell.vue), default·admin 래퍼 전환`
- CQ-03 → `npm run check` 통과 + 사유 없는 잔여 0일 때만 `✅ Done`. 정당한 잔여가 있으면 우선순위 `🟢 Low`로 낮추고 근거/조건을 `2026-07-21 4개 배치 제거 완료, 정당 사유 잔여 N건(파일 목록·사유·단일 경계 위치)`로 교체한다.
- CQ-02 → 아래 네 조건을 모두 만족할 때만 `✅ Done`: PDF 본체 800줄 이하, plan 페이지 1,300줄 이하, project form 1,300줄 이하, cost façade 400줄 이하. 완료 근거는 `2026-07-21 4개 파일 분해 완료(pdf/ 3모듈, features/plan 4모듈, features/project 4모듈, costList 7모듈). 회귀는 PDF 구조 스냅샷·공개 façade 계약 테스트·E2E·QA 체크리스트로 확인`으로 기록한다. 하나라도 미달이면 CQ-02 우선순위를 유지하고 남은 파일·현재 줄 수·다음 추출 책임을 TASK.md에 기록한다.

- [ ] **Step 4: TASK_DONE.md에 `2026-07-21 Clean Code Wave 2` 절 추가 후 Commit**

TASK_DONE.md에는 위 완료 조건을 실제로 만족한 CQ 항목만 이관한다. CQ-02/CQ-03이 조건부 잔여 상태면 TASK.md만 현행화하고 완료 목록에는 넣지 않는다.

```bash
cd C:\it
git add TASK.md TASK_DONE.md
git commit -m "docs: Clean Code Wave 2 완료 이관 (CQ-02, CQ-03, CQ-11)"
```

위 커밋 메시지는 CQ-02·CQ-03·CQ-11이 모두 완료된 경우에만 사용한다. 조건부 잔여가 있으면 완료되지 않은 CQ 번호를 메시지에서 빼고 `docs: Clean Code Wave 2 진행 현황 갱신 (...)` 형식으로 커밋한다.
