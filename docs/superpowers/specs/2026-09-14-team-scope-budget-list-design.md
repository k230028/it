# 예산 목록 팀 단위 조회 범위([팀|부서]) 설계

- 날짜: 2026-09-14
- 대상 저장소: `it_frontend` (백엔드 계약 변경 없음)
- 관련 파일: `app/utils/infoDashboardScope.ts`, `app/components/info/InfoDashboardScopeToggle.vue`,
  `app/composables/useCostListPage.ts`, `app/composables/project/useProjectListFilters.ts`,
  `app/pages/info/projects/index.vue`, `app/composables/cost/useCostFormSave.ts`,
  `app/features/project/useProjectFormSave.ts`, `i18n/messages/info.ts`

## 1. 배경과 목표

전산업무비·정보화사업 목록은 서버가 일반 사용자의 범위를 **소속 부서**로 강제하고, 관리자만 화면의
[부서|전체] 토글로 전체 조회를 연다. 부서 안에 여러 팀이 있어 사용자는 자기 팀 항목만 보고 싶어도
부서 전체 목록에서 찾아야 한다.

목표:

1. 두 목록 화면에 **[팀 | 부서]** 범위 선택을 추가하고 기본값을 **팀**으로 둔다. 관리자는
   [팀 | 부서 | 전체].
2. 팀 범위는 **조회 편의 필터**다. 권한 경계는 지금처럼 부서이며 서버 검증 규칙
   (`OwnershipVerifier`, `BudgetDetailAccessVerifier`, `myDeptOnly` 강제)은 바꾸지 않는다.
3. 신규·수정 저장 규칙은 바꾸지 않는다. 저장되는 팀은 **담당자 소속 팀**이며(기본값은 로그인
   사용자 팀), 담당자를 같은 부서 다른 팀 직원으로 바꾸면 그 팀으로 저장된다. 이 경우 저장 직후
   "[부서] 범위에서 확인" 안내만 띄운다.

비목표: 팀을 접근 경계로 만드는 것(다른 팀 건 수정 차단), JWT에 `temC` 클레임 추가, 결재 화면·
사업예산 Home 카드·미상신 작성 목록의 팀 범위, 범위 선택값의 영속 저장(localStorage).

## 2. 접근 방식 선택

| 안 | 내용 | 판단 |
| --- | --- | --- |
| 1 | 조회 편의 필터: 부서 권한 안에서 목록만 팀으로 좁힘 | **채택**. 기존 정책과 충돌 없고 백엔드 무변경 |
| 2 | 접근 경계: 일반 사용자는 팀 건만 보고 고침, [부서]는 부서장·관리자만 | 소유권·상세·삭제·결재·bulk까지 팀 기준 재정의 필요. 범위 과다 |

저장 시 팀 처리는 (a) 담당자 팀 그대로 저장 + 안내 토스트를 채택했다. (b) [팀] 모드에서 담당자를
내 팀으로 제한하는 안은 부서 내 팀 간 대행을 막아 사실상 2안이 되고, (c) 편성 팀과 담당자 팀을 분리하는
안은 스키마·집계 기준이 바뀌어 제외했다.

## 3. 현재 구조(사실 확인)

- 전산업무비 목록 API(`GET /api/costs`)의 `SearchCondition`은 이미 `svnTemC`를 받아
  `BCOSTM.SVN_TEM_C = :svnTemC` AND 조건으로 쓴다(`CostRepositoryImpl`). 일반 사용자는
  `CostService.searchCostList`가 `costSvnDpmC`를 `user.getBbrC()`로 덮어쓰므로 클라이언트의
  `svnTemC`는 허용 범위 안에서 좁히기만 한다. `countCostList`도 같은 조건을 쓰므로 `X-Total-Count`가
  목록과 일치한다.
- 정보화사업 목록은 서버가 부서까지 강제한 응답을 받아 `useProjectListFilters.filteredProjects`가
  부서·상태·기간 등을 클라이언트에서 거른다. 응답(`ProjectResponseMapper`)에 `svnTemC`가 포함된다.
- 로그인 사용자 팀코드는 `stores/auth.ts`의 `user.temC`로 프론트에 있다. JWT 클레임에는 없다.
- 폼의 `svnTemC` 기본값은 로그인 사용자 팀이며, 담당자 선택 시 담당자의 `bbrC`/`temC`로 함께
  덮어쓴다(타 부서는 차단, 같은 부서 다른 팀은 허용).
- 범위 토글 컴포넌트 `InfoDashboardScopeToggle`은 `InfoDashboardScope = 'itDepartment' | 'department' | 'all'`
  을 쓰며 사업예산 Home 카드와 전산업무비 목록(관리자만 노출)이 사용한다.

## 4. 설계

### 4.1 범위 타입과 토글 컴포넌트

- `InfoDashboardScope`에 `'team'`을 추가한다. 기존 사용처는 `'team'`을 넘기지 않으므로 영향이 없다.
- `InfoDashboardScopeToggle` prop 추가:
  - `includeTeam?: boolean` (기본 `false`): true면 [팀] 옵션을 맨 앞에 넣는다.
  - `includeAll?: boolean` (기본 `true`): false면 [전체] 옵션을 뺀다. 일반 사용자 목록 화면용.
  - `teamDisabled?: boolean` (기본 `false`): true면 [팀] 옵션을 비활성화한다(`optionDisabled`).
- 옵션 순서: [IT담당] [팀] [부서] [전체] 중 활성화된 것.

### 4.2 기본값·팀코드 없는 사용자

- 두 목록 화면 모두 초기 범위는 `user.temC`가 있으면 `'team'`, 없으면 `'department'`.
- `user.temC`가 비어 있으면 [팀] 옵션을 비활성화한다. 빈 목록으로 "팀 항목이 없다"고 오해하지 않게
  한다.
- 범위 선택값은 composable의 `ref`에만 두고 저장하지 않는다. 화면을 새로 열면 기본값으로 돌아간다.
  (`keep-alive`/탭 유지 중에는 그대로 남는다 — 현재 `costListScope`와 같은 수명.)

### 4.3 전산업무비 목록 (`useCostListPage`)

- `costListScope` 초기값을 4.2 규칙으로 바꾼다.
- `showCostScopeToggle`을 관리자 전용에서 **항상 true**로 바꾸고, 템플릿에는 `includeTeam`,
  `includeAll = isAdmin()`, `teamDisabled = !user.temC`를 넘긴다.
- `costListQuery`:
  - `myDeptOnly`: `scope !== 'all'` → `'true'`, 아니면 `'false'`. (일반 사용자는 서버가 어차피 부서로
    강제하므로 값과 무관.)
  - `svnTemC`: `scope === 'team'`이고 `user.temC`가 있을 때만 포함. 그 외는 키 자체를 넣지 않는다.
- 목록 재조회는 기존 `computed` 쿼리 변경으로 자동 수행된다. `X-Total-Count`도 같은 조건으로 맞는다.

### 4.4 정보화사업 목록 (`useProjectListFilters`, `pages/info/projects/index.vue`)

- `useProjectListFilters` 옵션에 `userTeamCode: ComputedRef<string | undefined>`를 추가하고,
  반환값에 `listScope: Ref<InfoDashboardScope>`를 추가한다(초기값 4.2 규칙).
- `filteredProjects` 부서 분기 앞에 팀 분기를 둔다:
  - `listScope === 'team'`이고 `userTeamCode`가 있으면 `project.svnTemC !== userTeamCode` 인 건을 제외한다.
  - `listScope === 'department'`는 현재 부서 로직 그대로.
  - `listScope === 'all'`은 관리자만 도달하며 기존 `showAllDepts = true`와 같은 결과여야 한다.
- 관리자용 `showAllDepts` 체크박스와 `major_department` 선택은 유지한다. 토글 [전체]와 체크박스
  `showAllDepts`는 같은 상태를 가리키도록 **하나의 근원**으로 묶는다: `listScope === 'all'` ⇔
  `showAllDepts === true`. 구현은 `showAllDepts`를 `listScope`에서 파생한 computed(getter/setter)로
  바꾸는 방식을 우선한다. `major_department`를 고르면 `listScope`를 `'department'`로 되돌린다.
- `hasFilters`는 `listScope`가 기본값과 다를 때도 true다(필터 배지 표시).
- 화면 상단(연도 선택 옆)에 `InfoDashboardScopeToggle`을 놓는다. prop은 4.3과 동일.

### 4.5 저장 후 안내 (a)

- 전산업무비: `useCostFormSave`의 저장 성공 분기에서 등록·수정 완료 confirm 다이얼로그를 띄우기 직전에,
  저장한 항목 중 `svnTemC`가 비어 있지 않고 `user.temC`와 다른 건이 하나라도 있으면 `info` 토스트를
  1회 띄운다. 복수 편집도 1회.
- 정보화사업: `features/project/useProjectFormSave`의 저장 성공 경로에서 같은 규칙으로 1회.
- 메시지 키: `common.scope.teamMismatchSummary` / `common.scope.teamMismatchDetail`
  (ko: "담당자 팀이 다릅니다" / "저장한 항목의 담당자 팀이 내 팀과 달라 [팀] 목록에는 보이지 않습니다.
  [부서] 범위에서 확인할 수 있습니다."). `user.temC`가 없으면 띄우지 않는다.
- 토스트 `life`는 `TOAST_LIFE.LONG`.

### 4.6 i18n

- `info.dashboard.scope.team`: ko `'팀'`, en `'Team'`.
- `common.scope.teamMismatchSummary`, `common.scope.teamMismatchDetail`: 4.5 문구, en 병기.

### 4.7 오류·경계 처리

- `user.temC` 없음: 4.2대로 팀 비활성·부서 기본. 서버에 `svnTemC`를 보내지 않는다.
- 목록 조회 실패: 기존 재시도 배너(ERR-13 가드) 그대로. 범위 전환 자체는 실패 상태를 바꾸지 않는다.
- 관리자가 [전체]에서 [팀]으로 바꾸면 `myDeptOnly=true` + `svnTemC`가 함께 나가 본인 부서·팀으로 좁혀진다.

## 5. 백엔드

변경 없음. OpenAPI 계약이 바뀌지 않으므로 `npm run codegen`은 불필요하다.

## 6. 테스트

Vitest:

- `InfoDashboardScopeToggle`: `includeTeam`/`includeAll`/`teamDisabled` 조합별 옵션 구성과 비활성.
- `useCostListPage`(또는 쿼리 조립 헬퍼): team → `svnTemC` 포함·`myDeptOnly='true'`; department →
  `svnTemC` 미포함; all(관리자) → `myDeptOnly='false'`; `temC` 없음 → 초기값 department.
- `useProjectListFilters`: team 범위에서 다른 팀 건 제외, department에서 포함, `listScope`/`showAllDepts`
  동기화, `major_department` 선택 시 `listScope` 복귀.
- 저장 안내: 담당자 팀 불일치 건 1개 이상 → 토스트 1회, 전부 일치 → 없음, `temC` 없음 → 없음.

게이트: `npm run format:check`, `npm run check`, `npm test`. 백엔드 테스트 추가 없음.
