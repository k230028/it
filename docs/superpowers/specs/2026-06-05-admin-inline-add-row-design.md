# admin 행추가 다이얼로그 → 인라인 편집 통일 (설계)

- 작성일: 2026-06-05
- 범위: `it_frontend` admin 페이지 5종 + 공유 composable

## 배경 / 목표

`info/cost`(전산업무비)와 `admin/routes`는 [행추가] 시 빈 행을 테이블에 인라인 삽입하고,
일괄 [저장] 시점에 신규/수정/삭제를 batch 처리한다. 반면 아래 5개 admin 페이지는
[행 추가] 시 **다이얼로그 팝업**으로 단건 POST 한다. 이를 인라인 편집으로 통일한다.

| 페이지 | PK | 필수값 | create API |
|--------|----|--------|-----------|
| admin/codes | cId+cdva+sttDt | cId, cdva | createCode |
| admin/users | eno | eno | createUser |
| admin/roles | athId+eno | athId, eno | createRole |
| admin/auth-grades | athId | athId | createAuthGrade |
| admin/organizations | prlmOgzCCone | prlmOgzCCone | createOrganization |

(`admin/routes`는 이미 인라인 — 변경 없음)

## 설계

### 1) `useAdminTableEdit` 검증 훅 추가 (공유 로직 중앙화)

- 신규 옵션 `requiredFields?: { key; label }[]`.
- 행에 `_invalidFields?: string[]` 메타 저장(반응형) → `cleanRow`에서 제거.
- `isFieldInvalid(row, field)` 노출 — InlineEditCell `:invalid` 바인딩용(빨간 텍스트).
- `saveAndExitEdit`:
  1. 진행 중 인라인 편집 flush(`activeElement.blur()` + `nextTick`),
  2. 신규/수정 행 필수값 검증 → 누락 시 해당 셀 invalid 표시 + `warn` 토스트 + 저장 중단(편집 모드 유지),
  3. 통과 시 `onBatchSave({ newRows, modifiedRows, deletedRows })` 호출.
- `markDirty`는 변경 시 해당 행 재검증(채워지면 invalid 자동 해제).
- `requiredFields` 미지정 페이지(routes)는 동작 불변 — 하위호환.

### 2) 페이지별 변경 (codes/users/roles/auth-grades/organizations)

- `useAdminTableEdit`에 `makeBlankRow` + `requiredFields` 전달, `addRow`/`isFieldInvalid` 구조분해.
- `onBatchSave`에 `newRows` 분기 추가 → 기존 `createXxx` 호출.
- 툴바 [행 추가] 버튼: 다이얼로그 트리거 → 인라인 `addRow`(편집 모드 툴바, cost/routes와 동일).
- PK·필수 컬럼을 신규 행에서 인라인 편집 가능하게 보정:
  - roles/auth-grades/organizations: 평문 PK 컬럼에 body 템플릿 추가(신규 행만 InlineEditCell, 기존 행은 평문 — PK rename 미지원).
  - users: `eno`를 신규 행에서만 편집 가능하게 제한(기존 행 PK 편집 차단 — 기존 잠재 결함 동시 해소).
- 필수 컬럼 InlineEditCell에 `:invalid="isFieldInvalid(data, '<field>')"` 추가.
- Dialog 마크업 + 상태(`newRowVisible`, `newRow`, `blankRow`, `openNewRowDialog`, `saveNewRow`) 제거.

### 3) 동작/UX 결정

- 검증/저장: **일괄 [저장] 시점 검증(cost 방식)** — 누락 시 빨간 셀 + 토스트, 저장 중단.
- users 초기 비밀번호: 인라인엔 비밀번호 컬럼이 없으므로 신규 사용자는 **서버 기본 비밀번호**로 생성(`createUser` password 미전송). 기존 다이얼로그의 커스텀 초기 비밀번호 입력 기능은 제거.

### 4) 테스트 (CLAUDE.md §4.11)

- `tests/unit/composables/useAdminTableEdit.*`: 필수값 누락 시 `saveAndExitEdit`가 `onBatchSave`를 호출하지 않고 invalid 표시 + 중단, 채운 뒤 정상 호출.
- `npm run typecheck`, `npm run lint` 통과.

### 영향 없음

- `admin/routes`(인라인), 각 페이지 일괄 업로드·엑셀·검색 Drawer — 무변경.
