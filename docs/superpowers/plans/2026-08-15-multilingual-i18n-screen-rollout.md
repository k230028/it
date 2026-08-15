# 한국어·영어 다국어 화면 전환·출시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포함 범위의 모든 사용자 노출 고정 문구를 도메인별 번역 리소스로 전환하고, 메뉴·공통코드 영어 관리 UI와 초기 영어 데이터를 완성한 뒤 실제 사용자 흐름을 검증하고 언어 선택기를 공개한다.

**Architecture:** AST/SFC 기반 정적 인벤토리가 사용자 노출 한글 literal을 검출하고 도메인 전환마다 0으로 수렴시킨다. 각 화면은 공통 locale controller, Intl formatter, localized menu/code API만 소비한다. DB 초기 영문 데이터와 관리자 번역 UI는 동일한 번역 계약을 사용하며 Playwright가 쿠키부터 상태 보존·fallback까지 종단 검증한다.

**Tech Stack:** Nuxt 4, Vue 3, Vue I18n, PrimeVue 4, TypeScript compiler API, `@vue/compiler-sfc`, Vitest, Playwright, Oracle/Flyway.

**Depends on:** `docs/superpowers/plans/2026-08-15-multilingual-i18n-frontend-foundation.md` 완료

## Global Constraints

- 사용자 입력 콘텐츠, 업무 데이터 fixture, 소스 주석, 테스트 설명, OpenAPI 설명, PDF/HWPX/Excel 본문은 정적 문구 전환 대상에서 제외한다.
- 표 제목·라벨·버튼·placeholder·Toast·Confirm·빈 상태·로딩·`aria-label`·`title`·페이지 meta는 반드시 포함한다.
- page meta는 `titleKey`/`tabTitleKey`로 바꾸고 자연어 `title`/`tabTitle` fallback을 최종적으로 제거한다.
- 날짜·숫자·금액은 `useLocaleFormat`, PrimeVue 문구는 global locale, 메뉴는 `useMenu`, 공통코드는 `useCodeOptions`를 사용한다.
- 번역문을 업무 분기·저장·정렬용 ID로 사용하지 않는다.
- 영문 출력 서식은 범위 밖이므로 PDF/HWPX/Excel 생성 코드의 한국어 본문은 그대로 둔다.
- 선택기는 전체 포함 범위와 초기 데이터 검증이 끝날 때까지 `public.multilingualEnabled=false`로 숨긴다.
- 도메인 전환 커밋마다 해당 테스트와 정적 인벤토리를 실행한다.

---

### Task 1: 사용자 노출 literal 인벤토리와 ratchet 게이트

**Files:**
- Create: `it_frontend/scripts/i18n-literal-audit.mjs`
- Create: `it_frontend/scripts/i18n-literal-allowlist.json`
- Modify: `it_frontend/package.json`
- Create: `it_frontend/tests/unit/i18n/user-facing-literals.test.ts`
- Create: `it_frontend/i18n/locales/ko/admin.json`
- Create: `it_frontend/i18n/locales/en/admin.json`
- Create: `it_frontend/i18n/locales/ko/workflow.json`
- Create: `it_frontend/i18n/locales/en/workflow.json`
- Create: `it_frontend/i18n/locales/ko/budget.json`
- Create: `it_frontend/i18n/locales/en/budget.json`
- Create: `it_frontend/i18n/locales/ko/info.json`
- Create: `it_frontend/i18n/locales/en/info.json`
- Create: `it_frontend/i18n/locales/ko/project.json`
- Create: `it_frontend/i18n/locales/en/project.json`
- Modify: `it_frontend/i18n/locales/ko.ts`
- Modify: `it_frontend/i18n/locales/en.ts`

**Interfaces:**
- Adds scripts: `npm run i18n:audit`, `npm run i18n:audit:check`
- Produces deterministic findings `{ file, kind, text }`; exit code 1 when a non-allowlisted finding remains

- [ ] **Step 1: 탐지기 자체 실패 테스트를 작성한다**

임시 fixture 문자열로 다음은 검출하고 다음은 제외하는지 검증한다.

```text
검출: <Button label="저장" />, placeholder="검색", aria-label="닫기",
      <span>조회 결과가 없습니다</span>, toast.add({ summary: '오류' }),
      confirm.require({ message: '삭제하시겠습니까?' }), definePageMeta({ title: '예산' })
제외: // 한국어 주석, test description, i18n JSON, API fixture의 usrNm,
      PDF/HWPX/Excel renderer 경로, 코드값 비교식
```

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/i18n/user-facing-literals.test.ts`

Expected: audit script가 없어 실패한다.

- [ ] **Step 3: AST/SFC 기반 audit를 구현한다**

Vue 파일은 `@vue/compiler-sfc`로 template/script를 분리하고, template AST에서 text node와 사용자 노출 attribute(`label`, `placeholder`, `title`, `aria-label`, `header`, `emptyMessage`, `emptyFilterMessage`, `chooseLabel`, `uploadLabel`, `cancelLabel`)를 검사한다. TS/JS는 TypeScript AST로 Toast/Confirm/Dialog 인자와 page meta 자연어 값을 검사한다. 단순 전체 정규식으로 주석·업무 데이터를 오탐하지 않는다.

allowlist는 경로 glob이 아니라 `{file,kind,text,reason}` 정확한 항목만 허용한다. 허용 reason은 `user-content`, `business-code`, `document-output`, `test-fixture` 네 값 중 하나다. 사용자 UI 파일 전체를 allowlist하는 규칙은 금지한다.

- [ ] **Step 4: 현재 기준선을 출력하고 namespace 파일을 연결한다**

Run: `cd it_frontend && npm run i18n:audit -- --report reports/i18n-literals.json`

현재 finding을 커밋 baseline으로 숨기지 않고 아래 Task 2~7의 도메인 목록으로 분류한다. 새 namespace JSON은 빈 객체가 아니라 각 도메인에서 공통으로 쓰는 `title`, `actions`, `columns`, `messages`, `validation`, `empty` 구조를 한국어/영어에 동일하게 만든다.

- [ ] **Step 5: audit 기반을 커밋한다**

```powershell
git -C it_frontend add -- scripts/i18n-literal-audit.mjs scripts/i18n-literal-allowlist.json package.json tests/unit/i18n/user-facing-literals.test.ts i18n
git -C it_frontend diff --cached --check
git -C it_frontend commit -m "test: audit user facing locale literals"
```

### Task 2: 로그인·공통 컴포넌트·레이아웃 완전 전환

**Files:**
- Modify: `it_frontend/app/pages/login.vue`
- Modify: `it_frontend/app/layouts/login.vue`
- Modify: `it_frontend/app/layouts/default.vue`
- Modify: all `.vue` files under `it_frontend/app/components/common/`
- Modify: all `.vue` files under `it_frontend/app/components/layout/`
- Modify: `it_frontend/i18n/locales/ko/common.json`
- Modify: `it_frontend/i18n/locales/en/common.json`
- Modify: `it_frontend/i18n/locales/ko/layout.json`
- Modify: `it_frontend/i18n/locales/en/layout.json`
- Modify: `it_frontend/i18n/locales/ko/auth.json`
- Modify: `it_frontend/i18n/locales/en/auth.json`
- Modify: relevant tests under `it_frontend/tests/unit/components/`, `it_frontend/tests/unit/pages/login.test.ts`

**Interfaces:**
- Converts: 재사용 label/column/action/empty/loading/accessibility 문자열
- Preserves: component props/events, login flow, AppShell/KeepAlive 구조

- [ ] **Step 1: 공통 컴포넌트 locale 실패 테스트를 작성한다**

대표 테스트에 `ko/en` parameterized assertions를 추가한다: `PageHeader`, `StyledDataTable`, `TableSearchInput`, `EmployeeSearchDialog`, `DownloadButton`, `ApplicationViewerDialog`, `GlobalSearchBar`, `NotificationDropdown`, `SwitchUserDialog`. locale 변경 후 component를 remount하지 않고 텍스트와 aria label이 바뀌는지 확인한다.

- [ ] **Step 2: RED와 도메인 finding 수를 기록한다**

```powershell
cd it_frontend
npm test -- tests/unit/components tests/unit/pages/login.test.ts
npm run i18n:audit -- --include app/pages/login.vue --include app/layouts --include app/components/common --include app/components/layout
```

Expected: 영어 assertion과 literal audit가 실패한다.

- [ ] **Step 3: 공통/레이아웃 리소스로 전환한다**

템플릿에서는 `$t` 또는 setup의 `t`, script에서 반응형 computed가 필요하면 `computed(() => t(...))`를 사용한다. 모듈 import 시점에 번역 결과를 상수로 저장하지 않는다. 부모가 넘기는 업무 데이터 label은 번역하지 않고, 컴포넌트가 소유한 기본 label만 번역한다. `AppShell`과 layout의 component key를 locale로 바꾸지 않는다.

- [ ] **Step 4: 공통 범위 GREEN과 audit 0을 확인한다**

Run: Task 2 Step 2와 같은 명령.

Expected: 지정 scope finding은 정확한 제외 allowlist 외 0이고 기존 기능 테스트가 통과한다.

- [ ] **Step 5: 공통 화면 slice를 커밋한다**

```powershell
git -C it_frontend add -- app/pages/login.vue app/layouts app/components/common app/components/layout i18n/locales/ko/common.json i18n/locales/en/common.json i18n/locales/ko/layout.json i18n/locales/en/layout.json i18n/locales/ko/auth.json i18n/locales/en/auth.json tests/unit
git -C it_frontend commit -m "feat: localize shared application shell"
```

### Task 3: 관리자 고정 화면 문구 전환

**Files:**
- Modify: all `.vue` files under `it_frontend/app/pages/admin/`
- Modify: all `.vue` files under `it_frontend/app/components/admin/`
- Modify: all `.ts` files under `it_frontend/app/composables/admin/`
- Modify: `it_frontend/app/composables/useAdminApi.ts`
- Modify: `it_frontend/app/composables/useAdminCodesPage.ts`
- Modify: `it_frontend/app/composables/useAdminLogList.ts`
- Modify: `it_frontend/app/composables/useAdminMenu.ts`
- Modify: `it_frontend/i18n/locales/ko/admin.json`
- Modify: `it_frontend/i18n/locales/en/admin.json`
- Modify: relevant tests matching `admin` under `it_frontend/tests/unit/`

**Interfaces:**
- Converts: 18 admin pages, realtime widgets, table columns, filters, dialogs, toasts, page meta
- Preserves: 권한 middleware, CRUD payload, drag/drop, log/realtime behavior

- [ ] **Step 1: 관리자 대표 locale 실패 테스트를 작성한다**

기존 관리자 메뉴 drag/drop·route path·코드 컬럼·사용자 성능·로그 컬럼 테스트에 언어 parameter를 추가한다. 한국어/영어에서 컬럼 field/sort key는 같고 header만 바뀌는지, Toast action 이후 payload는 같고 message만 바뀌는지 검증한다.

- [ ] **Step 2: RED와 관리자 finding을 확인한다**

```powershell
cd it_frontend
npm test -- tests/unit/pages tests/unit/composables/admin tests/unit/composables/useAdminApi.test.ts tests/unit/composables/useAdminCodesPage.test.ts tests/unit/composables/useAdminMenu.test.ts
npm run i18n:audit -- --include app/pages/admin --include app/components/admin --include app/composables/admin --include app/composables/useAdmin
```

- [ ] **Step 3: 관리자 namespace로 모든 고정 문구를 전환한다**

DataTable column 배열은 locale이 바뀌면 header가 재계산되도록 computed로 만든다. date/user/identifier 데이터는 그대로 둔다. `definePageMeta`는 `titleKey`/`tabTitleKey`를 사용한다. admin root/dashboard/boards/logs/menus/migration/routes/auth-grades/codes/files/login-history/organizations/realtime/roles/tokens/users를 빠짐없이 처리한다.

- [ ] **Step 4: 관리자 범위 GREEN과 audit 0을 확인한다**

Run: Task 3 Step 2와 같은 명령.

Expected: 정확한 제외 항목 외 관리자 finding 0, 기존 관리자 테스트 통과.

- [ ] **Step 5: 관리자 고정 문구 slice를 커밋한다**

```powershell
git -C it_frontend add -- app/pages/admin app/components/admin app/composables/admin app/composables/useAdminApi.ts app/composables/useAdminCodesPage.ts app/composables/useAdminLogList.ts app/composables/useAdminMenu.ts i18n/locales/ko/admin.json i18n/locales/en/admin.json tests/unit
git -C it_frontend commit -m "feat: localize administration screens"
```

### Task 4: 관리자 메뉴·공통코드 번역 편집 UI

**Files:**
- Create: `it_frontend/app/components/admin/MenuTranslationFields.vue`
- Create: `it_frontend/app/components/admin/CodeTranslationDialog.vue`
- Modify: `it_frontend/app/pages/admin/menus/index.vue`
- Modify: `it_frontend/app/pages/admin/codes.vue`
- Modify: `it_frontend/app/composables/useAdminMenu.ts`
- Modify: `it_frontend/app/composables/useAdminApi.ts`
- Modify: `it_frontend/app/composables/useAdminCodesPage.ts`
- Modify: `it_frontend/tests/unit/composables/useAdminMenu.test.ts`
- Modify: `it_frontend/tests/unit/composables/useAdminApi.test.ts`
- Modify: `it_frontend/tests/unit/composables/useAdminCodesPage.test.ts`
- Modify: `it_frontend/tests/unit/pages/admin-menus-dragdrop.test.ts`
- Modify: `it_frontend/tests/unit/pages/adminCodesPageBoundary.test.ts`
- Modify: `it_frontend/i18n/locales/ko/admin.json`
- Modify: `it_frontend/i18n/locales/en/admin.json`

**Interfaces:**
- Consumes/produces: `translations: Array<{ language; columnName; text }>`
- Menu editable column: `MNU_NM`
- Code editable columns: `CO_C_NM`, `CDVA_NM`, `CO_CDVA_ABV_NM`, `CO_CDVA_SPS`, `CO_C_INTN_CONE`

- [ ] **Step 1: 요청 변환과 UI 실패 테스트를 작성한다**

메뉴 편집은 한국어 메뉴명 필수·영어 메뉴명 선택 입력을 검증한다. 공통코드는 테이블 가로 열을 늘리지 않고 행 action으로 translation dialog를 여는지 검증한다. 기존 영어값을 비우면 해당 `{language:'en',columnName,text:''}`가 payload에 포함되고, 변경하지 않은 translation 영역은 `translations`를 생략하는지 확인한다. 기술 컬럼 두 개는 입력 목록에 없어야 한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_frontend && npm test -- tests/unit/composables/useAdminMenu.test.ts tests/unit/composables/useAdminApi.test.ts tests/unit/composables/useAdminCodesPage.test.ts tests/unit/pages/admin-menus-dragdrop.test.ts tests/unit/pages/adminCodesPageBoundary.test.ts`

Expected: 번역 UI와 payload 변환이 없어 실패한다.

- [ ] **Step 3: 번역 편집 UI를 구현한다**

`MenuTranslationFields`는 `MNU_NM`의 영어 입력과 fallback badge만 표시한다. `CodeTranslationDialog`는 승인된 다섯 물리 컬럼을 한국어 원본/영어 입력 쌍으로 세로 배치하고 각 max length를 `min(원본 컬럼 길이, 2000)`으로 제한한다. 빈 영어는 한국어 대체 표시 상태로 나타낸다. 저장 성공 후 관리자 원본 목록과 현재 사용자용 locale 캐시 데이터를 다시 읽는다.

- [ ] **Step 4: 번역 UI 테스트 GREEN을 확인한다**

Run: Task 4 Step 2와 같은 명령.

Expected: 조회→편집→삭제 payload와 fallback badge가 모두 통과한다.

- [ ] **Step 5: 번역 관리 UI slice를 커밋한다**

```powershell
git -C it_frontend add -- app/components/admin/MenuTranslationFields.vue app/components/admin/CodeTranslationDialog.vue app/pages/admin/menus/index.vue app/pages/admin/codes.vue app/composables/useAdminMenu.ts app/composables/useAdminApi.ts app/composables/useAdminCodesPage.ts tests/unit i18n/locales/ko/admin.json i18n/locales/en/admin.json
git -C it_frontend commit -m "feat: edit menu and code translations"
```

### Task 5: 승인·감사·게시판·가이드 등 workflow 화면 전환

**Files:**
- Modify: all `.vue` files under `it_frontend/app/pages/approval/`, `app/pages/audit/`, `app/pages/board/`, `app/pages/diagnosis/`, `app/pages/guide/`, `app/pages/preparing/`
- Modify: all source files under `it_frontend/app/components/approval/`, `app/components/board/`, `app/components/mfa/`, `app/components/review/`
- Modify: all source files under `it_frontend/app/features/approval/` except PDF/HWPX/Excel rendering text
- Modify: approval/board/guide composables that the audit reports
- Modify: `it_frontend/i18n/locales/ko/workflow.json`
- Modify: `it_frontend/i18n/locales/en/workflow.json`
- Modify: matching unit tests under `it_frontend/tests/unit/`

**Interfaces:**
- Converts: page meta, 목록/상세/폼 action, validation, timeline, MFA, review, comment UI
- Excludes: 결재 문서 PDF/HWPX 본문과 사용자 작성 게시글/댓글

- [ ] **Step 1: workflow 대표 실패 테스트를 작성한다**

승인 목록/상세, 게시판 목록/폼/댓글, MFA dialog, review toolbar, preparing 화면을 `ko/en`으로 검증한다. 게시글 제목·본문·댓글 fixture는 locale 변경 후 그대로여야 한다. 출력 문서 snapshot은 변경하지 않는다.

- [ ] **Step 2: RED와 workflow finding을 확인한다**

Run: `cd it_frontend && npm run i18n:audit -- --include app/pages/approval --include app/pages/audit --include app/pages/board --include app/pages/diagnosis --include app/pages/guide --include app/pages/preparing --include app/components/approval --include app/components/board --include app/components/mfa --include app/components/review`

Run: `cd it_frontend && npm test -- tests/unit/components/board tests/unit/composables/approval-mfa-coverage.test.ts tests/unit/composables/useApprovalDashboard.test.ts`

- [ ] **Step 3: workflow 리소스로 전환한다**

상태값 표시는 기존 stable code→translation key map을 사용하고 서버가 보낸 사용자 콘텐츠는 `t()`에 넣지 않는다. confirm/toast/validation과 accessibility 문구를 함께 이관한다. PDF/HWPX/Excel renderer 경로의 한글은 allowlist에 정확한 reason `document-output`으로 남긴다.

- [ ] **Step 4: workflow GREEN과 audit 0을 확인한다**

Run: Task 5 Step 2 명령과 관련 전체 unit tests.

- [ ] **Step 5: workflow slice를 커밋한다**

```powershell
git -C it_frontend add -- app/pages/approval app/pages/audit app/pages/board app/pages/diagnosis app/pages/guide app/pages/preparing app/components/approval app/components/board app/components/mfa app/components/review app/features/approval i18n/locales/ko/workflow.json i18n/locales/en/workflow.json tests/unit scripts/i18n-literal-allowlist.json
git -C it_frontend commit -m "feat: localize workflow screens"
```

### Task 6: 예산 화면 전환

**Files:**
- Modify: all `.vue` files under `it_frontend/app/pages/budget/`
- Modify: all source files under `it_frontend/app/components/budget/`
- Modify: budget composables under `it_frontend/app/composables/` and `it_frontend/app/composables/budget/` reported by the audit
- Modify: `it_frontend/app/middleware/budget-period.ts`
- Modify: `it_frontend/i18n/locales/ko/budget.json`
- Modify: `it_frontend/i18n/locales/en/budget.json`
- Modify: matching budget tests under `it_frontend/tests/unit/`

**Interfaces:**
- Converts: 승인/비교/목록/보고/현황/요약/편성 화면 문구와 금액·기간 표시
- Preserves: 금액 raw values, code IDs, Excel 반입/출력 한글 양식

- [ ] **Step 1: 예산 대표 실패 테스트를 작성한다**

BudgetSummaryCards/Table, BudgetTargetTable, 승인 columns, 상태 footer total, 편성 tag, 기간 middleware 오류를 `ko/en`으로 검증한다. 통화/숫자는 `useLocaleFormat` 결과를 사용하고 계산 값은 동일해야 한다. Excel 반입 테스트는 영어 UI에서도 한국어 code lookup을 호출하는지 추가 검증한다.

- [ ] **Step 2: RED와 예산 finding을 확인한다**

Run: `cd it_frontend && npm run i18n:audit -- --include app/pages/budget --include app/components/budget --include app/composables/budget --include app/middleware/budget-period.ts`

Run: `cd it_frontend && npm test -- tests/unit/components/budget tests/unit/composables/budget tests/unit/pages/budgetApprovalColumns.test.ts tests/unit/pages/budgetStatusFooterTotals.test.ts tests/unit/pages/budgetWorkOrdinaryTag.test.ts`

- [ ] **Step 3: 예산 namespace와 locale formatter로 전환한다**

화면의 `원`, 날짜 패턴, 천단위 표시는 공통 formatter에 위임한다. 예산 상태·분류는 이름이 아니라 code→key map으로 바꾼다. Excel/HWPX/PDF 본문 생성 문자열은 건드리지 않고 UI download button/toast만 번역한다.

- [ ] **Step 4: 예산 GREEN과 audit 0을 확인한다**

Run: Task 6 Step 2 명령과 관련 전체 tests.

- [ ] **Step 5: 예산 slice를 커밋한다**

```powershell
git -C it_frontend add -- app/pages/budget app/components/budget app/composables app/middleware/budget-period.ts i18n/locales/ko/budget.json i18n/locales/en/budget.json tests/unit scripts/i18n-literal-allowlist.json
git -C it_frontend commit -m "feat: localize budget screens"
```

### Task 7: 정보화 계획·원가·위원회·문서·프로젝트 화면 전환

**Files:**
- Modify: all `.vue` files under `it_frontend/app/pages/info/`
- Modify: all source files under `it_frontend/app/components/cost/`, `app/components/council/`, `app/components/documents/`, `app/components/plan/`, `app/components/projects/`
- Modify: all source files under `it_frontend/app/features/council/`, `app/features/plan/`, `app/features/project/`
- Modify: cost/council/document/plan/project composables reported by the audit
- Modify: `it_frontend/i18n/locales/ko/info.json`
- Modify: `it_frontend/i18n/locales/en/info.json`
- Modify: matching tests under `it_frontend/tests/unit/components/`, `tests/unit/composables/`, `tests/unit/features/`, `tests/unit/pages/`

**Interfaces:**
- Converts: `info` 21개 page와 하위 업무 컴포넌트의 고정 UI
- Preserves: 사업명·문서 제목·위원 의견·사용자 입력 콘텐츠와 코드 식별값

- [ ] **Step 1: 대표 workflow의 locale 실패 테스트를 작성한다**

원가 목록/단말기 dialog, 위원회 일정/결과, 계획 form/detail, 문서 dashboard/review, 프로젝트 form/detail/list를 각각 한 개 이상 `ko/en`으로 검증한다. locale 변경 중 편집 상태와 입력값이 유지되는 component test를 계획 form과 프로젝트 form에 추가한다.

- [ ] **Step 2: RED와 info finding을 확인한다**

Run: `cd it_frontend && npm run i18n:audit -- --include app/pages/info --include app/components/cost --include app/components/council --include app/components/documents --include app/components/plan --include app/components/projects --include app/features/council --include app/features/plan --include app/features/project`

Run: `cd it_frontend && npm test -- tests/unit/components/cost tests/unit/components/council tests/unit/composables/cost tests/unit/composables/council tests/unit/pages/planDetailPageBoundary.test.ts tests/unit/pages/projectDetailPageBoundary.test.ts`

- [ ] **Step 3: info namespace로 전환한다**

공통코드 label은 서버 localized field를 그대로 표시하고 업무 분기는 `cdva`/`cTp`/`cdvaDtlC`로 유지한다. 동적으로 조합한 한국어 문장은 보간 key로 옮기고 수량에 따라 달라지는 문구는 pluralization을 사용한다. 사용자 입력값은 번역 함수에 전달하지 않는다.

- [ ] **Step 4: info GREEN과 audit 0을 확인한다**

Run: Task 7 Step 2 명령과 관련 전체 tests.

- [ ] **Step 5: info slice를 커밋한다**

```powershell
git -C it_frontend add -- app/pages/info app/components/cost app/components/council app/components/documents app/components/plan app/components/projects app/features/council app/features/plan app/features/project app/composables i18n/locales/ko/info.json i18n/locales/en/info.json tests/unit scripts/i18n-literal-allowlist.json
git -C it_frontend commit -m "feat: localize information planning screens"
```

### Task 8: 사업 집행 화면과 전역 잔여 sweep

**Files:**
- Modify: all `.vue` files under `it_frontend/app/pages/project/`
- Modify: project execution composables reported by the audit
- Modify: `it_frontend/app/pages/index.vue`
- Modify: `it_frontend/app/error.vue`
- Modify: remaining in-scope source files reported under `it_frontend/app/`
- Modify: `it_frontend/i18n/locales/ko/project.json`
- Modify: `it_frontend/i18n/locales/en/project.json`
- Modify: relevant project tests under `it_frontend/tests/unit/`
- Modify: `it_frontend/tests/unit/i18n/messages.test.ts`
- Modify: `it_frontend/scripts/i18n-literal-allowlist.json`

**Interfaces:**
- Converts: 사업계획/계약/심의/견적/지급 목록·상세와 전역 잔여 UI
- Closes: 모든 locale namespace key parity와 인스코프 literal finding 0

- [ ] **Step 1: 사업 집행과 전역 잔여 실패 테스트를 작성한다**

bizplan/contract/deliberation/estimate/payment의 목록·상세 대표 테스트를 `ko/en`으로 추가한다. 작성 중인 견적/계약 form 값을 입력한 뒤 locale만 바꾸고 동일 값·route·tab이 유지되는지 검증한다.

- [ ] **Step 2: RED와 전체 finding을 확인한다**

```powershell
cd it_frontend
npm run i18n:audit
npm test -- tests/unit/pages/project-contract-refresh-failure.test.ts tests/unit/pages/project-payment-list-refresh-failure.test.ts tests/unit/pages/projectBizplanValidation.test.ts
```

- [ ] **Step 3: project namespace 전환과 잔여 sweep를 수행한다**

10개 project page와 audit가 보고하는 모든 인스코프 파일을 처리한다. `ko-KR`, `toLocaleString`, `toLocaleDateString`, literal `원`, PrimeVue component의 `locale="ko-KR"`를 검색해 공통 formatter/global PrimeVue로 바꾼다.

Run: `cd it_frontend && rg -n "ko-KR|toLocaleString\(|toLocaleDateString\(|locale=.[\"']ko|[0-9}]원" app -g "*.vue" -g "*.ts"`

Expected: 출력 서식·업무 fixture 등 명시적 제외 외 사용자 화면 경로에는 결과가 없다.

- [ ] **Step 4: 전체 key parity와 literal audit를 GREEN으로 만든다**

```powershell
cd it_frontend
npm test -- tests/unit/i18n/messages.test.ts tests/unit/i18n/user-facing-literals.test.ts
npm run i18n:audit:check
npm run format:check
npm run check
npm test
```

Expected: 한국어·영어 key 집합이 같고 인스코프 literal finding 0, 전체 Vitest 통과.

- [ ] **Step 5: project·sweep slice를 커밋한다**

```powershell
git -C it_frontend add -- app/pages/project app/pages/index.vue app/error.vue app/composables i18n tests/unit scripts/i18n-literal-allowlist.json
git -C it_frontend commit -m "feat: complete multilingual screen rollout"
```

### Task 9: 메뉴·공통코드 초기 영어 번역 데이터

**Files:**
- Create: `it_database/docs/verification/V20260815_002__EnglishTranslationInventory.sql`
- Create: `it_database/migrations/V20260815_002__SeedEnglishMenuAndCodeTranslations.sql`
- Create: `it_database/docs/verification/V20260815_002__EnglishTranslationCoverage.verify.sql`

**Interfaces:**
- Produces: 활성 메뉴 `MNU_NM`과 한국어가 포함된 사용자 표시용 공통코드 다섯 필드의 `en` 행
- Excludes: `SRE_MNU_NM`, `CO_C_INTN_NM`, `CO_CDVA_NM`

- [ ] **Step 1: 원본 inventory SQL을 작성하고 실행한다**

메뉴는 활성 `TPRMPP_CMENUM`의 `MNU_ID`, `MNU_NM`을 출력한다. 공통코드는 활성/유효 row의 `(CO_C_ID_NM,CDVA_ID,STT_DT)`와 다섯 허용 컬럼을 세로 행으로 펼치고 한국어가 포함된 비공백 값만 출력한다. SQL 자체에서 Java와 같은 길이 접두 `TC_ID_CONE`을 계산하고 중복 target/language/column이 0인지 확인한다.

- [ ] **Step 2: 영문 번역 corpus를 검토한다**

화면 도메인 용어집과 일관되게 각 inventory 행의 영어를 작성한다. 약어는 조직 표준 약어를 우선하고, 코드 적요는 의미를 보존한 자연스러운 영어로 번역한다. 최소 두 사람이 다음을 검토한다.

- 동일 한국어 용어의 영문 일관성
- 메뉴 계층에서 동사/명사 스타일 일관성
- 숫자·코드·통화값을 번역문으로 오인하지 않음
- 영문이 2000자 및 원본 화면 제약을 넘지 않음

- [ ] **Step 3: idempotent seed migration을 작성한다**

각 inventory 행을 `MERGE INTO ITPOWN.TPRMPP_CLANGM`으로 저장한다. match 시 `TC_DES`, `DTT_NM`, `DEL_YN='N'`, 수정 공통 컬럼을 갱신하고, not matched 시 전체 PK/공통 컬럼을 삽입한다. 모든 행은 `DTT_LAN_C='en'`이고 실제 물리 `TC_COL_NM`을 사용한다. migration 내부에 미검토 임시 번역, 미완성 표식, 빈 `TC_DES`를 두지 않는다.

- [ ] **Step 4: 적용 후 coverage를 검증한다**

coverage SQL은 다음 네 숫자를 출력하고 모두 0이어야 한다.

```text
활성 메뉴 중 MNU_NM 영어 번역 누락
한국어 포함 허용 공통코드 필드 중 영어 번역 누락
원본 없는 번역 orphan
허용하지 않은 DTT_NM/TC_COL_NM 조합
```

추가로 동일 원본의 `lang=ko`와 `lang=en` API 응답을 sample 비교해 코드 ID·트리·정렬은 같고 표시 필드만 바뀌는지 확인한다.

- [ ] **Step 5: 초기 데이터 DB 커밋을 만든다**

```powershell
git -C it_database add -- docs/verification/V20260815_002__EnglishTranslationInventory.sql migrations/V20260815_002__SeedEnglishMenuAndCodeTranslations.sql docs/verification/V20260815_002__EnglishTranslationCoverage.verify.sql
git -C it_database diff --cached --check
git -C it_database commit -m "data: seed English menu and code translations"
```

### Task 10: 종단 검증과 언어 선택기 공개

**Files:**
- Create: `it_frontend/tests/e2e/i18n.spec.ts`
- Modify: `it_frontend/tests/e2e/auth.spec.ts`
- Modify: `it_frontend/tests/e2e/role-menu.spec.ts`
- Modify: `it_frontend/nuxt.config.ts`
- Modify: `it_frontend/.env`
- Modify: `it_frontend/.env.local`
- Modify: `it_frontend/.env.development`
- Modify: `it_frontend/.env.production`

**Interfaces:**
- Verifies and enables: `public.multilingualEnabled=true`

- [ ] **Step 1: 공개 전 E2E를 먼저 작성하고 flag-off 상태에서 RED를 확인한다**

`i18n.spec.ts`는 다음 시나리오를 독립적으로 실행한다.

1. locale 쿠키 없이 로그인 화면은 한국어
2. 로그인 화면에서 English 선택, URL 불변, 새로고침 후 영어 유지
3. 로그인 후 Header/Sidebar/Breadcrumb/탭/공통코드가 영어
4. 세 탭을 연 뒤 locale 전환 시 모든 탭 제목 변경, path/order 유지
5. form 입력 후 locale 전환 시 입력값 유지
6. 영어 번역 하나를 관리자에서 비워 저장하면 그 필드만 한국어 fallback
7. 한국어로 돌아가면 원본 한국어 표시
8. 로그아웃·재로그인 뒤 쿠키 언어 유지
9. 영어 unknown API 오류는 일반 영어+request ID이고 한국어 server message 없음

Run: `cd it_frontend && npm run test:e2e -- tests/e2e/i18n.spec.ts`

Expected: flag가 꺼져 선택기가 없어 공개 시나리오가 실패한다.

- [ ] **Step 2: 전체 저장소 품질 게이트를 재실행한다**

```powershell
cd it_backend
./gradlew spotlessCheck test
./gradlew integrationTest

cd ..\it_frontend
npm run codegen:check
npm run i18n:audit:check
npm run format:check
npm run check
npm test
npm run generate:local
```

Expected: 모든 명령이 exit code 0이다. 하나라도 실패하면 flag를 켜지 않는다.

- [ ] **Step 3: 다국어 flag를 공개한다**

네 환경 파일에 `NUXT_PUBLIC_MULTILINGUAL_ENABLED=true`를 설정한다. 운영 파일 변경은 DB seed coverage와 개발 E2E 증적을 확인한 뒤에만 수행한다. `nuxt.config.ts`의 환경변수 미지정 기본값은 false로 유지해 배포 설정 누락 시 부분 번역이 공개되지 않게 한다.

- [ ] **Step 4: E2E GREEN을 확인한다**

```powershell
cd it_frontend
npm run test:e2e -- tests/e2e/i18n.spec.ts tests/e2e/auth.spec.ts tests/e2e/role-menu.spec.ts
npm run test:e2e:static -- tests/e2e/i18n.spec.ts
```

Expected: 동적 API와 정적 배포 양쪽에서 쿠키, 전환, 상태 보존, DB 번역, fallback이 통과한다.

- [ ] **Step 5: 프론트 출시 커밋과 최종 상태를 확인한다**

```powershell
git -C it_frontend add -- tests/e2e/i18n.spec.ts tests/e2e/auth.spec.ts tests/e2e/role-menu.spec.ts nuxt.config.ts .env .env.local .env.development .env.production
git -C it_frontend diff --cached --check
git -C it_frontend commit -m "feat: enable multilingual user experience"
git -C it_frontend status --short
git -C it_backend status --short
git -C it_database status --short
```

Expected: 다국어 파일은 모두 커밋됐고 작업 전부터 있던 사용자 변경만 남는다. 이후 마스터 계획의 최종 통합 체크포인트로 이동한다.
