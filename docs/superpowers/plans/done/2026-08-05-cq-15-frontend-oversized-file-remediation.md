# CQ-15 Frontend Oversized File Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CQ-22로 분리된 editor 4개를 제외한 프론트 800줄 초과 기준 24개를 증가 불가 상태로 복구하고, 기능 변경과 결합한 책임 분해로 기준 항목을 점진적으로 0개까지 줄인다.

**Architecture:** 먼저 현재 실패 중인 max-lines ratchet을 복구한다. 감소한 파일은 기준값을 실제 값으로 낮추고, 증가한 협의회 화면 3개는 기준값을 올리지 않고 presentation/access/panel 경계로 즉시 분해한다. 이후 공통 컴포넌트·API facade는 연결된 기능 과제와 함께 분해하고, page는 기능 변경 PR마다 하나 이상의 독립 책임을 component/composable/pure utility로 이동한다.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils, Playwright, ESLint, Prettier

## Global Constraints

- `scripts/max-lines-baselines.mjs`가 최대 줄 수의 단일 진실 공급원이다. 기준값 증가는 허용하지 않는다.
- 물리 줄 수는 `tests/unit/architecture/max-lines-ratchet.test.ts`의 `physicalLineCount`와 동일한 방식으로 센다.
- 공개 component props/emits/expose, composable 반환 key, route, API URL·method·payload·response를 유지한다.
- 구조 분해와 기능 변경은 별도 커밋으로 나눈다. 연결 과제가 기능 변경을 요구하면 먼저 characterization test를 고정한 뒤 분해한다.
- 신규 `.ts`·`.vue` 운영 파일은 800줄 이하로 작성한다. 분해 후 원본이 800줄 이하이면 같은 커밋에서 기준 항목을 삭제한다.
- 신규 주석과 TSDoc은 한글로 작성한다.
- `app/types/api.d.ts`는 codegen 산출물이므로 이 과제의 줄 수 게이트에서 제외한다.
- CQ-22의 editor 4개는 이 계획의 수정 범위에서 제외한다. CQ-22 계획의 Task 1 → 2 → 4 → 5 순서를 별도로 따른다.
- 사용자가 이동 중인 루트 문서와 기존 변경을 덮어쓰지 않는다. 이 계획 실행 전 `git status --short`로 각 저장소의 변경을 확인한다.

## Current Evidence (2026-08-05)

- Frontend branch/HEAD: `main` / `509d9df`.
- 기준 항목: 총 28개. CQ-22 editor 4개를 제외하면 CQ-15 범위는 24개다.
- CQ-15 실제 구성: page 21개 + component 2개 + composable 1개다. `TASK.md`의 “page 20개+component 2개”는 최신 기준선과 어긋난다.
- architecture gate는 현재 실패한다. 여섯 파일에서 실제 줄 수와 기준값이 다르다.

| 파일 | 실제 | 기준 | 판정 |
| --- | ---: | ---: | --- |
| `app/pages/admin/codes.vue` | 1041 | 1061 | 감소 — 기준 하향 필요 |
| `app/pages/admin/logs/[logKey].vue` | 939 | 957 | 감소 — 기준 하향 필요 |
| `app/pages/budget/list.vue` | 1203 | 1222 | 감소 — 기준 하향 필요 |
| `app/pages/info/council-request/index.vue` | 967 | 963 | 증가 — 분해로 상환 필요 |
| `app/pages/info/council-request/prepare/[id].vue` | 862 | 803 | 증가 — 분해로 상환 필요 |
| `app/pages/info/council-request/result/[id].vue` | 1133 | 1115 | 증가 — 분해로 상환 필요 |

## Considered Approaches

1. **24개 전면 일괄 분해:** 숫자는 빠르게 줄지만 서로 다른 10여 개 도메인의 회귀 표면을 한 번에 열고 리뷰 단위를 무너뜨린다.
2. **기능 변경 trigger만 적용:** 회귀 위험은 가장 낮지만 현재 깨진 ratchet을 방치하며, 장기간 변경되지 않는 대형 파일은 계속 남는다.
3. **권장 — gate 복구 + trigger 상환:** 증가한 파일과 자주 변경되는 공통 경계를 먼저 정상화하고, 나머지는 기능 변경 PR에 분해를 의무화한다. 90일간 trigger가 없는 1,200줄 초과 파일만 별도 구조 PR로 올린다.

---

### Task 1: Ratchet RED 상태와 변경 원인 고정

**Files:**

- Verify: `it_frontend/scripts/max-lines-baselines.mjs`
- Verify: `it_frontend/tests/unit/architecture/max-lines-ratchet.test.ts`
- Verify: 위 Current Evidence의 여섯 source file

- [ ] **Step 1: 프런트 저장소가 실행 가능한 상태인지 확인**

```powershell
cd C:\it\it_frontend
git status --short
git branch --show-current
git log -1 --oneline
```

Expected: 의도하지 않은 작업 파일이 없고 현재 변경 기준 commit을 기록한다. 변경이 있으면 덮어쓰지 말고 해당 파일을 이번 task에서 제외하거나 사용자에게 충돌을 보고한다.

- [ ] **Step 2: 기존 architecture gate의 실패를 재현**

```powershell
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts
```

Expected: `app/pages/admin/codes.vue`의 실제 1041, 기준 1061 불일치부터 실패한다.

- [ ] **Step 3: 여섯 불일치의 변경 commit을 기록**

```powershell
$files = @(
  'app/pages/admin/codes.vue',
  'app/pages/admin/logs/[logKey].vue',
  'app/pages/budget/list.vue',
  'app/pages/info/council-request/index.vue',
  'app/pages/info/council-request/prepare/[id].vue',
  'app/pages/info/council-request/result/[id].vue'
)
foreach ($file in $files) {
  git log -4 --oneline -- $file
}
```

Expected: 감소 3개는 기준 하향 대상으로, 증가 3개는 기준값을 올리지 않는 분해 대상으로 분류된다.

---

### Task 2: 감소한 세 기준을 실제 값으로 하향

**Files:**

- Modify: `it_frontend/scripts/max-lines-baselines.mjs`
- Test: `it_frontend/tests/unit/architecture/max-lines-ratchet.test.ts`

- [ ] **Step 1: 기준값 세 개만 하향**

```js
'app/pages/admin/codes.vue': 1041,
'app/pages/admin/logs/[logKey].vue': 939,
'app/pages/budget/list.vue': 1203,
```

협의회 화면 3개의 증가분은 이 단계에서 변경하지 않는다.

- [ ] **Step 2: gate를 실행해 다음 증가 위반을 노출**

```powershell
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts
```

Expected: `council-request/index.vue`의 967 > 963 불일치로 실패한다. 이 실패가 Task 3의 RED다.

- [ ] **Step 3: 기준 하향 커밋**

```powershell
git add -- scripts/max-lines-baselines.mjs
git commit -m "chore: 감소한 대형 파일 기준선 하향 (CQ-15)"
```

---

### Task 3: 증가한 협의회 화면 3개 즉시 분해

**Files:**

- Create: `it_frontend/app/features/council/request/council-list-presentation.ts`
- Create: `it_frontend/app/composables/council/useCouncilPreparationAccess.ts`
- Create: `it_frontend/app/composables/council/useCouncilResultAccess.ts`
- Create: `it_frontend/app/components/council/CouncilResultApprovalPanel.vue`
- Modify: `it_frontend/app/pages/info/council-request/index.vue`
- Modify: `it_frontend/app/pages/info/council-request/prepare/[id].vue`
- Modify: `it_frontend/app/pages/info/council-request/result/[id].vue`
- Test: `it_frontend/tests/unit/features/council/request/council-list-presentation.test.ts`
- Test: `it_frontend/tests/unit/composables/council/useCouncilPreparationAccess.test.ts`
- Test: `it_frontend/tests/unit/composables/council/useCouncilResultAccess.test.ts`
- Test: `it_frontend/tests/unit/components/council/CouncilResultApprovalPanel.test.ts`

**Interfaces:**

- `council-list-presentation.ts`는 목록 카드의 날짜·기간·상태·CTA·chip·stat 계산을 pure function으로 제공한다.
- `useCouncilPreparationAccess`는 상세·위원회·사용자 ref를 받아 준비 화면의 탭 가시성·활성·읽기 전용 상태를 computed로 반환한다.
- `useCouncilResultAccess`는 상세·위원회·사용자 ref를 받아 결과 화면의 역할·행위 권한·탭 가시성을 computed로 반환한다.
- `CouncilResultApprovalPanel`은 결재자 지정, 상신, 결재 대기, 통보 전후 UI를 소유하고 기존 이벤트를 상위로 emit한다.

- [ ] **Step 1: 목록 presentation characterization test 작성**

다음 케이스를 현재 화면 출력값 그대로 고정한다.

```text
일정: 날짜 없음 / 날짜만 / 날짜+시간
기간: 시작·종료 없음 / 한쪽만 존재 / 양쪽 존재
상태: 신청 전 / 생략 판정 중 / 개최 준비 / 완료
표시: HTML 제거, CTA label·tone, chip·stat 순서
```

- [ ] **Step 2: 목록 presentation test의 RED 확인 후 로직 이동**

```powershell
npm test -- tests/unit/features/council/request/council-list-presentation.test.ts
```

처음에는 모듈 부재로 실패해야 한다. 이후 `index.vue`의 `formatSchedule`부터 `stripHtml`까지 카드 표시 계산을 새 모듈로 이동하고 같은 명령이 통과해야 한다. 목표는 `index.vue`를 800줄 이하로 만들어 기준 항목을 삭제하는 것이다.

- [ ] **Step 3: 준비 화면 access matrix test 작성**

다음 축을 table-driven test로 고정한다.

```text
역할: 일반 / 추진부서 담당 / 평가위원 / IT 관리자 / 정보보안 관리자
상태: 05 / 06 / 07 / 08 / 09 / 10
개최형태: 대면 / 서면
위원회 확정: 전 / 후
```

검증 key는 `isScheduleParticipant`, `canInputMySchedule`, `committeeReadonly`, `noticeTabEnabled`, `resultTabEnabled`, `reviewProgressEnabled`, `mainQnaTabEnabled`, `mainQnaTabVisible`, `resultReadonly`, `canAskQna`, `canReplyQna`다.

- [ ] **Step 4: 준비 화면 access 로직 이동**

```powershell
npm test -- tests/unit/composables/council/useCouncilPreparationAccess.test.ts
```

처음에는 composable 부재로 실패해야 한다. 현재 computed의 조건식을 내용 변경 없이 이동한 뒤 통과시킨다. `prepare/[id].vue`가 800줄 이하가 되면 기준 항목을 삭제한다.

- [ ] **Step 5: 결과 화면 access matrix와 approval panel test 작성**

access test는 일반/추진부서/위원/관리자와 상태 05~13 조합에서 `canEvaluate`, `canReviewResult`, `canAskQna`, `canReplyQna`, `canViewEvalSummary`, `resultReadonly`, `canConfirmResult`, `canRequestApproval`, `canNotify`를 고정한다. panel test는 결재자 선택, 상신 emit, 결재 대기 문구, 통보 완료 수신자 표시를 고정한다.

- [ ] **Step 6: 결과 화면 access와 approval UI 이동**

```powershell
npm test -- `
  tests/unit/composables/council/useCouncilResultAccess.test.ts `
  tests/unit/components/council/CouncilResultApprovalPanel.test.ts `
  tests/unit/pages/council-result-confirmed-messages.test.ts
```

처음에는 신규 모듈·컴포넌트 부재로 실패해야 한다. 이후 현재 조건식과 template을 이동하고 기존 toast·confirm 문구와 API 호출 순서를 유지한다. 목표는 `result/[id].vue`를 800줄 이하로 만들어 기준 항목을 삭제하는 것이다.

- [ ] **Step 7: 협의회 3개 분해 gate 실행**

```powershell
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts tests/unit/composables/council tests/unit/features/council/request tests/unit/components/council
npm run format:check
npm run check
```

Expected: 협의회 3개 기준 항목 삭제, 총 기준 28개 → 25개. 모든 명령 exit code 0.

- [ ] **Step 8: 구조 분해 커밋**

```powershell
git add -- app/features/council/request app/composables/council app/components/council
git add -- app/pages/info/council-request
git add -- tests/unit/features/council/request tests/unit/composables/council tests/unit/components/council
git add -- scripts/max-lines-baselines.mjs tests/unit/architecture/max-lines-ratchet.test.ts
git commit -m "refactor: 협의회 대형 화면 책임 분리 (CQ-15)"
```

---

### Task 4: 공통 경계 3개를 연결 과제와 함께 상환

#### 4A. `useApiFetch.ts` 813줄 — ERR-14와 결합

**Files:**

- Create: `app/composables/api/useApiFetchRefreshCoordinator.ts`
- Modify: `app/composables/useApiFetch.ts`
- Test: `tests/unit/composables/useApiFetch.test.ts`
- Test: `tests/unit/composables/useApiFetch.keepPreviousData.test.ts`
- Test: `tests/unit/composables/useApiFetch.direct.test.ts`

- [ ] 순차 401 재시도 상한을 먼저 failing test로 고정한다.
- [ ] 모듈 전역 refresh lock·signal·retry state를 coordinator로 이동한다.
- [ ] `useApiFetch`의 공개 반환 계약과 기존 keepPreviousData 동작을 유지한다.
- [ ] 원본이 800줄 이하가 되면 기준 항목을 삭제한다.

#### 4B. `EmployeeSearchDialog.vue` 1055줄 — 다음 직원검색 변경과 결합

**Files:**

- Create: `app/composables/employee/useEmployeeSearchDialog.ts`
- Modify: `app/components/common/EmployeeSearchDialog.vue`
- Test: 기존 직원검색 단위 테스트 + `tests/unit/composables/employee/useEmployeeSearchDialog.test.ts`

- [ ] 검색 요청, debounce, 최신 응답만 반영, 선택 상태, 초기화 로직을 composable로 이동한다.
- [ ] 조직 트리·검색 결과·선택 emit 계약을 characterization test로 고정한다.
- [ ] 800줄 이하가 되면 기준 항목을 삭제한다.

#### 4C. `TerminalTableSection.vue` 813줄 — 다음 단말기 변경과 결합

**Files:**

- Create: `app/composables/cost/useTerminalTableEditing.ts`
- Modify: `app/components/cost/TerminalTableSection.vue`
- Test: `tests/unit/composables/cost/useTerminalTableEditing.test.ts`

- [ ] 행 편집, 금액 계산, dirty 상태와 저장 payload mapping을 composable로 이동한다.
- [ ] 기존 row key·emit·validation 문구를 고정한다.
- [ ] 800줄 이하가 되면 기준 항목을 삭제한다.

각 하위 task 검증:

```powershell
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts
npm run format:check
npm run check
```

---

### Task 5: Page 21개 trigger 상환

**Trigger:** 대상 page의 production 코드가 기능·오류 처리·UI 계약 변경으로 수정되는 모든 PR. 오탈자, import 정렬, 자동 포맷만 수행하는 PR은 제외한다.

**PR당 필수 결과:**

- 원본에서 최소 하나의 독립 관심사를 component/composable/pure utility로 이동한다.
- 원본 물리 줄 수를 PR 시작값보다 줄인다.
- 원본이 800줄 초과면 기준값을 실제 값으로 낮추고, 800줄 이하면 항목을 삭제한다.
- 신규 경계에는 단위 테스트를 추가한다. 사용자 흐름이 달라지면 관련 Playwright spec도 실행한다.

| 우선 | 대상 | 현재 줄 | 첫 분해 경계 |
| ---: | --- | ---: | --- |
| 1 | `pages/info/documents/[id]/index.vue` | 1532 | header/action, 문서 metadata, 첨부/결재 section component |
| 1 | `pages/info/plan/[id].vue` | 1284 | 상세 조회·권한을 `usePlanDetailPage`, tab section을 child component |
| 1 | `pages/info/projects/form.vue` | 1266 | validation·DTO mapping을 `useProjectForm`, form section component |
| 1 | `pages/info/plan/form.vue` | 1261 | validation·DTO mapping을 `usePlanForm`, form section component |
| 1 | `pages/budget/status.vue` | 1260 | filter/query state를 `useBudgetStatusPage`, tab별 child component |
| 1 | `pages/info/projects/[id].vue` | 1226 | 상세 조회·action을 `useProjectDetailPage`, summary/tab component |
| 1 | `pages/budget/list.vue` | 1203 | filter·paging·action을 `useBudgetListPage`, filter panel component |
| 2 | `pages/info/cost/index.vue` | 1140 | 조회·필터·row action을 `useCostIndexPage` |
| 2 | `pages/info/council-request/[id].vue` | 1090 | 상세 상태·권한을 `useCouncilRequestDetailAccess`, section component |
| 2 | `pages/project/bizplan/[abusMngNo].vue` | 1087 | form state·payload mapping을 `useBizPlanForm`, table section component |
| 2 | `pages/budget/approval.vue` | 1072 | 결재 목록 query/action을 `useBudgetApprovalPage` |
| 2 | `pages/budget/work.vue` | 1036 | 작업 목록 query/edit flow를 `useBudgetWorkPage` |
| 2 | `pages/info/cost/form.vue` | 993 | form validation·DTO mapping을 `useCostForm` |
| 2 | `pages/guide/index.vue` | 955 | 목록 query·첨부 action을 `useGuidePage`, editor/dialog child component |
| 2 | `pages/admin/logs/[logKey].vue` | 939 | stream/filter/refresh state를 `useAdminLogDetail` |
| 2 | `pages/project/estimate/[docNo].vue` | 914 | estimate form state·calculation을 `useEstimatePage` |
| 3 | `pages/info/projects/index.vue` | 851 | filter·progressive list·card mapping을 `useProjectIndexPage` |
| 3 | `pages/admin/codes.vue` | 1041 | code group/detail query와 edit state를 `useAdminCodesPage` |
| 3 | `pages/info/council-request/index.vue` | 967 | Task 3에서 즉시 제거 |
| 3 | `pages/info/council-request/prepare/[id].vue` | 862 | Task 3에서 즉시 제거 |
| 3 | `pages/info/council-request/result/[id].vue` | 1133 | Task 3에서 즉시 제거 |

우선순위 1 파일은 마지막 production 변경 후 90일 동안 trigger가 없더라도 별도 구조 PR로 하나씩 착수한다. 한 PR에는 한 page만 넣는다.

---

### Task 6: 각 PR의 품질 gate와 문서 동기화

**Files:**

- Modify: `it_frontend/scripts/max-lines-baselines.mjs`
- Modify: `it_frontend/tests/unit/architecture/max-lines-ratchet.test.ts`
- Modify on milestone: `TASK.md`
- Archive on completion: this plan under `docs/superpowers/plans/done/`

- [ ] **Step 1: 변경 도메인 테스트와 ratchet 실행**

```powershell
npm test -- tests/unit/architecture/max-lines-ratchet.test.ts
npm test
```

- [ ] **Step 2: 프런트 정적 gate 실행**

```powershell
npm run format:check
npm run check
npm test
```

- [ ] **Step 3: 사용자 흐름 변경 시 E2E 실행**

```powershell
npm run test:e2e
```

프런트·백엔드·DB를 함께 기동할 수 없어 E2E를 실행하지 못하면 해당 page의 완료 판정을 보류하고, 미실행 명령과 사유를 기록한다.

- [ ] **Step 4: milestone마다 실제 목록 확인**

```powershell
@'
import { OVERSIZED_FILE_BASELINES } from './scripts/max-lines-baselines.mjs';
console.log(Object.keys(OVERSIZED_FILE_BASELINES).sort().join('\n'));
'@ | node --input-type=module -
```

- [ ] **Step 5: `TASK.md` 상태를 숫자와 유형까지 동기화**

Task 3 완료 시 CQ-15를 “CQ-15 범위 24개 중 3개 즉시 제거, 21개 trigger 상환 중”으로 갱신한다. 이후 milestone마다 page/component/composable 잔여 수를 실제 기준선에서 다시 계산해 기록한다. CQ-22 editor 4개는 별도 숫자로 유지한다.

## Completion Criteria

- architecture max-lines gate가 현재 HEAD에서 통과한다.
- 기준값 증가가 한 건도 없다.
- CQ-15 범위의 component 2개, composable 1개, page 21개가 모두 800줄 이하가 되어 기준선에서 제거된다.
- 신규 경계의 characterization/unit test와 기존 도메인 test가 통과한다.
- 사용자 흐름을 옮긴 page는 관련 Playwright spec까지 통과한다.
- `TASK.md`의 CQ-15는 완료 기록으로 이관한다. CQ-22 editor 4개의 완료 여부는 CQ-15 완료 조건에 포함하지 않는다.

## Self-Review

- **범위:** CQ-15의 비-editor 24개만 포함하며 CQ-22, ERR-14의 기능 설계 자체, FE-19 스타일 부채는 포함하지 않는다.
- **드리프트:** 기존 문서의 22개와 현재 24개 차이를 `useApiFetch.ts` 및 신규 초과 page 반영으로 교정했다.
- **안전성:** 증가한 기준값을 올리지 않고 즉시 분해하도록 했으며, 기능 계약은 characterization test로 먼저 고정한다.
- **종료성:** trigger만 기다려 영구 정체되지 않도록 1,200줄 초과 page에 90일 강제 착수 조건을 둔다.
