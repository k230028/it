# Frontend State Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FE-68~FE-73을 해결해 조회 실패·손상 입력·정상 빈 상태를 구분하고 생성 API 타입 및 공통 HTML 유틸을 일관되게 사용한다.

**Architecture:** 화면별 네트워크 실패는 명시적인 오류 ref와 재시도 함수로 유지한다. sessionStorage 복원은 순수 파서로 분리해 손상 여부를 반환하며 반드시 소비한 키를 삭제한다. 타입과 HTML 변환은 공통 유틸에 모으되 의미가 다른 strip 동작은 테스트가 같음을 입증한 범위만 통합한다.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, vue-i18n, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-03-task-backlog-remediation-design.md`

## Global Constraints

- 정상 빈 값과 조회 실패를 같은 UI로 렌더링하지 않는다.
- 재시도는 실패한 요청만 다시 실행한다.
- 사용자 노출 문구는 한국어·영어 i18n 트리를 함께 갱신한다.
- 생성된 API 타입을 수기로 편집하지 않는다.
- HTML 가공 뒤 호출부의 DOMPurify 정화 순서를 유지한다.

---

### Task 1: FE-68 게시판 첨부 일괄 조회 실패 표면화

**Files:**
- Modify: `it_frontend/app/pages/board/[blbMngNo]/index.vue`
- Modify: `it_frontend/i18n/messages/board.ts`
- Create: `it_frontend/tests/unit/pages/board/BoardPostListAttachments.test.ts`

**Interfaces:** 화면 상태로 `attachmentsError: Ref<boolean>`과 `retryAttachments(): Promise<void>`를 제공한다.

- [ ] **Step 1: 첨부가 있다고 표시된 행에서 batch 실패 시 `-` 대신 실패 버튼이 보이는 테스트를 작성한다**

```ts
expect(wrapper.get('[data-testid="post-attachments-error"]')).toBeTruthy();
expect(wrapper.text()).not.toContain('-');
```

- [ ] **Step 2: 테스트가 현재 빈 맵 폴백 때문에 실패하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/pages/board/BoardPostListAttachments.test.ts`

- [ ] **Step 3: watch 본문을 재호출 가능한 함수로 추출한다**

```ts
const attachmentsError = ref(false);
const loadAttachments = async (currentPosts = posts.value) => { /* 기존 generation guard 유지 */ };
const retryAttachments = () => loadAttachments(posts.value);
```

요청 시작 시 error=false, catch에서 true, 성공 시 맵과 false를 설정한다. stale 응답은 상태를 덮어쓰지 않는다.

- [ ] **Step 4: 첨부 대상 행에만 실패 표식과 다시 시도 버튼을 렌더링한다**

`attachmentsError && (flNbr > 0 || flApgYn === 'Y')`일 때 `data-testid="post-attachments-error"` 버튼을 표시한다.

- [ ] **Step 5: 한국어·영어 문구와 테스트를 검증한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/pages/board/BoardPostListAttachments.test.ts; npm run check:copy`

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/pages/board/[blbMngNo]/index.vue i18n/messages/board.ts tests/unit/pages/board/BoardPostListAttachments.test.ts
git -C C:\it\it_frontend commit -m "fix: 게시판 첨부 조회 실패 상태 표시"
```

### Task 2: FE-69 스피드다이얼 담당자 조회 실패 경로 복구

**Files:**
- Modify: `it_frontend/app/components/layout/SpeedDial.vue`
- Test: `it_frontend/tests/unit/components/layout/SpeedDial.test.ts`
- Test: `it_frontend/tests/unit/components/layout/SpeedDialContactInfoDialog.test.ts`

**Interfaces:** 담당자 버튼 노출 조건은 `contactInfoError || (docMngNo && contentHtml)`다.

- [ ] **Step 1: 초기 조회 실패에도 담당자 버튼이 남고 dialog 재시도 UI에 도달하는 테스트를 작성한다**

```ts
controller.contactInfoError.value = new Error('network');
expect(wrapper.get('[data-testid="speed-dial-contact-information"]')).toBeTruthy();
await wrapper.get('[data-testid="speed-dial-contact-information"]').trigger('click');
expect(wrapper.getComponent(SpeedDialContactInfoDialog).props('visible')).toBe(true);
```

- [ ] **Step 2: 테스트가 기존 v-if 때문에 실패하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/layout/SpeedDial.test.ts tests/unit/components/layout/SpeedDialContactInfoDialog.test.ts`

- [ ] **Step 3: 노출 조건을 computed로 명명한다**

```ts
const showContactInfoAction = computed(
    () => Boolean(controller.contactInfoError.value) ||
        Boolean(controller.contactInfo.value.docMngNo && controller.contactInfo.value.contentHtml),
);
```

- [ ] **Step 4: 테스트를 다시 실행한다**

Expected: 실패 시 버튼·dialog·재시도, 정상 빈 응답 시 버튼 숨김이 모두 PASS.

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/components/layout/SpeedDial.vue tests/unit/components/layout/SpeedDial.test.ts tests/unit/components/layout/SpeedDialContactInfoDialog.test.ts
git -C C:\it\it_frontend commit -m "fix: 담당자 정보 조회 실패 진입점 유지"
```

### Task 3: FE-70 report sessionStorage 손상 계약 분리

**Files:**
- Create: `it_frontend/app/utils/reportSelectionStorage.ts`
- Create: `it_frontend/tests/unit/utils/reportSelectionStorage.test.ts`
- Modify: `it_frontend/app/pages/budget/report.vue`
- Modify: `it_frontend/app/pages/info/projects/report.vue`
- Modify: `it_frontend/i18n/messages/budget.ts`
- Test: `it_frontend/tests/e2e/budget-report-session.spec.ts`

**Interfaces:**

```ts
export type StoredSelection<T> =
    | { status: 'missing'; items: [] }
    | { status: 'valid'; items: T[] }
    | { status: 'malformed'; items: [] };
export const consumeStoredSelection = <T>(storage: Storage, key: string, parse: (v: unknown) => T[]): StoredSelection<T>;
```

- [ ] **Step 1: valid/missing/malformed와 항상 removeItem 계약 테스트를 작성한다**

```ts
expect(consumeStoredSelection(storage, key, parse).status).toBe('malformed');
expect(storage.getItem(key)).toBeNull();
```

- [ ] **Step 2: 유틸 부재로 테스트가 실패하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils/reportSelectionStorage.test.ts`

- [ ] **Step 3: `finally`에서 키를 삭제하는 순수 유틸을 구현한다**

JSON 배열이 아니거나 item의 `id`/`sno`가 유효하지 않으면 malformed로 반환한다. 문자열 레거시는 `{id, sno:1}`로 변환한다.

- [ ] **Step 4: 두 report 페이지가 malformed를 별도 차단하도록 바꾼다**

둘 중 하나라도 malformed면 PDF를 생성하지 않고 손상 안내 Toast 후 원래 목록으로 이동한다. missing은 기존 재방문 데이터 유지 계약을 따른다.

- [ ] **Step 5: E2E에 프로젝트 키만 손상된 사례를 추가한다**

```ts
await page.evaluate(() => {
    sessionStorage.setItem('selectedBudgetProjectIds', '{broken');
    sessionStorage.setItem('selectedBudgetCostIds', JSON.stringify([{ id: 'C1', sno: 1 }]));
});
```

PDF viewer가 뜨지 않고 손상 안내와 키 삭제를 확인한다.

- [ ] **Step 6: 단위·E2E 테스트를 실행한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils/reportSelectionStorage.test.ts; npm run test:e2e -- tests/e2e/budget-report-session.spec.ts`

- [ ] **Step 7: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/utils/reportSelectionStorage.ts app/pages/budget/report.vue app/pages/info/projects/report.vue i18n/messages/budget.ts tests/unit/utils/reportSelectionStorage.test.ts tests/e2e/budget-report-session.spec.ts
git -C C:\it\it_frontend commit -m "fix: 보고서 선택정보 손상 상태 차단"
```

### Task 4: FE-71 사용자가이드 생성 타입 사용

**Files:**
- Modify: `it_frontend/app/composables/useUserGuide.ts`
- Test: `it_frontend/tests/unit/composables/useUserGuide.test.ts`

**Interfaces:** `UserGuideRecord`를 `components['schemas']['UserGuideDto.Response']` 별칭으로 정의한다.

- [ ] **Step 1: generated schema와 composable 반환 타입의 호환성 테스트를 추가한다**

```ts
type Generated = components['schemas']['UserGuideDto.Response'];
expectTypeOf<UserGuideRecord>().toEqualTypeOf<Generated>();
```

- [ ] **Step 2: 수기 interface 때문에 type equality가 실패하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/composables/useUserGuide.test.ts; npm run typecheck`

- [ ] **Step 3: 수기 interface를 generated alias로 교체한다**

```ts
import type { components } from '~/types/api';
export type UserGuideRecord = components['schemas']['UserGuideDto.Response'];
```

- [ ] **Step 4: 테스트와 codegen check를 실행한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/composables/useUserGuide.test.ts; npm run codegen:check`

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/composables/useUserGuide.ts tests/unit/composables/useUserGuide.test.ts
git -C C:\it\it_frontend commit -m "refactor: 사용자가이드 생성 API 타입 사용"
```

### Task 5: FE-72 HTML 유틸 중복과 미사용 export 정리

**Files:**
- Modify: `it_frontend/app/utils/projectFormLimits.ts`
- Create: `it_frontend/app/utils/htmlText.ts`
- Create: `it_frontend/tests/unit/utils/htmlText.test.ts`
- Modify: `it_frontend/app/utils/boardContent.ts`
- Modify: `it_frontend/app/utils/planSummaryText.ts`
- Modify: `it_frontend/app/utils/common.ts`
- Modify: `it_frontend/app/features/council/request/council-list-presentation.ts`
- Modify: `it_frontend/app/composables/useBudgetStatusPage.ts`
- Modify: `it_frontend/app/composables/useSpeedDial.ts`
- Modify: `it_frontend/app/pages/admin/contact-information.vue`
- Modify: `it_frontend/app/pages/admin/common-popup.vue`

**Interfaces:**
- `escapeHtml(value: string): string`
- `stripHtmlToText(html: string | null | undefined, options?: { preserveLineBreaks?: boolean; decodeEntities?: boolean }): string`
- `hasMeaningfulHtml(html: string | null | undefined): boolean`

- [ ] **Step 1: 현재 세 strip 구현의 차이를 fixture로 고정한다**

`&amp;`, `<br>`, 연속 문단, `<p><br></p>`, 공백, script 텍스트를 각각 기대값으로 기록한다.

- [ ] **Step 2: 공통 유틸 부재로 테스트가 실패하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils/htmlText.test.ts`

- [ ] **Step 3: DOM 비의존 공통 유틸을 구현한다**

기본 strip 계약은 엔티티 디코딩과 줄바꿈 보존을 명시적으로 옵션화한다. 기존 호출부마다 현재 결과와 같은 옵션을 전달한다.

- [ ] **Step 4: 두 escapeHtml 구현과 meaningful 판정을 공통 유틸로 교체한다**

- [ ] **Step 5: 참조 0건인 export를 삭제한다**

Run before edit: `cd C:\it\it_frontend; rg -n '\b(BYTE_LIMITS|ProjectTextLimit)\b' app tests`

Expected: 선언 외 운영 참조 0건. 확인 후 `projectFormLimits.ts`에서 제거한다.

- [ ] **Step 6: 관련 단위 테스트와 typecheck를 실행한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils; npm run typecheck`

- [ ] **Step 7: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/utils/projectFormLimits.ts app/utils/htmlText.ts app/utils/boardContent.ts app/utils/planSummaryText.ts app/utils/common.ts app/features/council/request/council-list-presentation.ts app/composables/useBudgetStatusPage.ts app/composables/useSpeedDial.ts app/pages/admin/contact-information.vue app/pages/admin/common-popup.vue tests/unit/utils/htmlText.test.ts
git -C C:\it\it_frontend commit -m "refactor: HTML 텍스트 유틸 공통화"
```

### Task 6: FE-73 멘션 접근성 라벨 번역 주입

**Files:**
- Modify: `it_frontend/app/utils/boardContent.ts`
- Modify: `it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/index.vue`
- Test: `it_frontend/tests/unit/utils/boardContent.test.ts`

**Interfaces:**

```ts
export const renderTiptapMentions = (
    html: string,
    employeeInfoLabel: (name: string) => string,
): string;
```

- [ ] **Step 1: 영어 라벨 formatter가 aria-label에 반영되는 테스트를 작성한다**

```ts
const result = renderTiptapMentions(html, name => `View employee information for ${name}`);
expect(result).toContain('aria-label="View employee information for 홍길동"');
```

- [ ] **Step 2: 테스트가 기존 단일 인자 시그니처로 실패하는지 확인한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils/boardContent.test.ts`

- [ ] **Step 3: formatter를 필수 인자로 받고 호출부에서 기존 `layout.employeeInfo` 번역을 전달한다**

```ts
renderTiptapMentions(html, name => t('layout.employeeInfo', { name }));
```

번역 키가 이름 보간을 지원하지 않으면 한국어·영어 값을 `{name}` 기반으로 현행화한다.

- [ ] **Step 4: 단위 테스트와 copy check를 실행한다**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils/boardContent.test.ts; npm run check:copy`

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_frontend add app/utils/boardContent.ts app/pages/board/[blbMngNo]/[nacMngNo]/index.vue i18n/messages/layout.ts tests/unit/utils/boardContent.test.ts
git -C C:\it\it_frontend commit -m "fix: 게시판 멘션 접근성 라벨 다국어화"
```

### Task 7: 전체 검증과 완료 기록

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:** FE-68~FE-73의 변경·검증 근거를 기록한다.

- [ ] **Step 1: 프론트 Health Stack과 관련 E2E를 실행한다**

Run: `cd C:\it\it_frontend; npm run format:check; npm run check; npm test; npm run test:e2e -- tests/e2e/budget-report-session.spec.ts`

Expected: 모두 exit code 0.

- [ ] **Step 2: 완료 기록을 갱신한다**

`TASK_DONE.md`에 정상 빈 값/실패/손상 입력별 검증 결과를 기록하고 `TASK.md`에서 FE-68~FE-73만 제거한다.

- [ ] **Step 3: 루트 문서를 커밋한다**

```powershell
git -C C:\it add TASK.md TASK_DONE.md
git -C C:\it commit -m "docs: 프론트 상태 처리 과제 완료 기록"
```
