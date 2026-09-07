# 전산업무비 저장 충돌 감지와 병합 설계

## 1. 배경

전산업무비(BCOSTM)와 금융정보단말(BTERMM) 작성 화면은 여러 담당자가 같은 문서를 동시에 열어 편집할 수 있다. 현재 보호 수단은 두 가지다.

- 쓰기 트랜잭션의 행 잠금: `CostWriteTargetLoader.loadForUpdate()`가 수정 대상 개정본을 `PESSIMISTIC_WRITE`로 잠근 뒤 수정한다(`CostRepository.findVersionForUpdate`, 잠금 대기 5초).
- 상신 시점 지문 비교: `ItBudgetApprovalFacade`가 `IT_BUDGET_SOURCE_CHANGED`·`IT_BUDGET_CONCURRENT_UPDATE` 409를 던진다.

두 수단 모두 저장 요청 사이의 간격은 보호하지 못한다. 행 잠금은 트랜잭션 수명(수 밀리초) 동안만 유지되므로 사람이 화면을 열어 둔 수 분을 덮지 못하고, 상신 검사는 원장이 이미 덮어써진 뒤에 동작한다.

### 1.1 현재 결함

**결함 1 — 편집 세션 사이의 lost update.** `CostDto.UpdateRequest`에 버전이나 지문 필드가 없다. A가 10:00에 화면을 열고, B가 10:05에 저장하고, A가 10:10에 저장하면 B의 변경이 오류 없이 사라진다. 사용자에게는 실패가 보이지 않으므로 발견이 늦다.

**결함 2 — 금융정보단말의 전체 치환 저장.** `CostService.updateCost`는 요청 목록에 없는 기존 BTERMM 행을 soft delete 한다(`CostService.java:526-531`). B가 단말 1건을 추가한 뒤 A가 그 행이 없는 오래된 화면으로 저장하면 B가 추가한 행이 삭제된다. 필드 덮어쓰기보다 피해가 크다.

## 2. 범위

전산업무비와 금융정보단말의 사용자 저장 경로에만 적용한다. 정보화사업(BPROJM·BITEMM)은 같은 규약으로 확장할 수 있으나 이 설계의 범위가 아니다. DB 마이그레이션은 없다.

## 3. 개정본 스탬프

조회 응답에 `concurrencyStamp` 문자열 한 개를 싣는다. 부모 BCOSTM 업무 필드와 활성 BTERMM 행 전체를 정규 순서로 직렬화한 SHA-256 64자 소문자 16진수다.

`@Version` 컬럼을 쓰지 않는 이유는 두 가지다. 부모 버전 하나로는 자식 BTERMM의 추가·삭제·수정을 판정할 수 없고, 컬럼 방식은 DDL 변경을 요구한다.

### 3.1 해시 입력

- 부모: BCOSTM의 업무 필드. `COST_BG_NO`, `BG_SNO`를 포함한다.
- 자식: `DEL_YN='N'`인 BTERMM 행 전체를 `(TMN_MNG_NO, SNO)` 오름차순으로 정렬해 포함한다.
- 금액·환율·수량은 `ItBudgetCanonicalJson`의 `money`·`exchangeRate`·`quantity` 정규화를 거친다. 스케일 차이가 충돌로 오판되지 않게 한다.

### 3.2 해시에서 제외하는 값

`LST_CHG_DTM`, `LST_CHG_ENO`, `FST_RGS_DTM` 같은 공통 감사 필드와 결재 상태 필드(`LST_YN` 전환 등)는 제외한다. 결재 진행에 따른 상태 변경은 업무 내용 변경이 아니므로 충돌로 보지 않는다. 값이 바뀌었다가 의미상 완전히 같게 원복되면 충돌이 아니다. 상신 경로 설계(`2026-09-06-it-budget-snapshot-integrity-design.md` 9절)와 같은 규칙이다.

### 3.3 구현

`common/approval/itbudget/service/ItBudgetCanonicalJson`을 그대로 재사용한다. `common/` 아래에 있으므로 `domain/budget/cost`에서 의존해도 계층 규칙을 위반하지 않는다. 신규 컴포넌트 `CostConcurrencyStamper`가 부모 엔티티와 단말 목록을 받아 스탬프를 계산하며, 조회 조립(`CostQueryAssembler`)과 저장 검증(`CostService.updateCost`)이 같은 함수를 호출한다.

## 4. 저장 API 계약

`CostDto.UpdateRequest`에 `concurrencyStamp` 필드를 추가한다. 사용자 저장 경로에서 **필수**이며, 누락되거나 형식이 맞지 않으면 400으로 차단한다.

| 상황 | HTTP | 코드 |
| --- | ---: | --- |
| `concurrencyStamp` 누락 또는 64자 16진수가 아님 | 400 | `COST_STAMP_REQUIRED` |
| 잠긴 시점의 현재 스탬프와 다름 | 409 | `COST_SOURCE_CHANGED` |
| 잠금 대기 5초 초과 | 409 | `COST_CONCURRENT_UPDATE` |

충돌 응답은 `changedBy`·`changedAt`·`currentStamp`·`current`를 담아야 하므로 `ItBudgetApprovalDto.ErrorResponse`를 재사용할 수 없다. 전산업무비 전용 예외 `CostConflictException`과 응답 DTO `CostDto.ConflictResponse`를 신설하고, `GlobalExceptionHandler`에 `handleItBudgetApproval`과 같은 형태의 핸들러를 추가한다. 공통 필드 `timestamp`·`status`·`code`·`message`의 이름과 형식은 기존 오류 응답과 동일하게 맞춘다. 내부 record는 springdoc에서 단순 이름으로 노출되어 다른 DTO와 충돌하므로 `@Schema(name = "CostConflictResponse")`를 명시하고, codegen 전에 `/v3/api-docs`에서 스키마 이름을 확인한다. 잠금 타임아웃 판정은 `ItBudgetApprovalFacade.isLockTimeout`과 같은 기준(`LockTimeoutException`, `CannotAcquireLockException`, ORA-30006·ORA-00054)을 쓴다.

## 5. 충돌 응답

병합 화면에는 원본·내 값·서버 값의 3-way 비교가 필요하지만, 서버는 사용자가 화면을 연 시점의 원본을 보관하지 않는다. 원본은 프론트엔드가 화면 로드 시 이미 들고 있으므로(`useCostFormData`) 서버는 현재값만 반환하고 차이 계산은 클라이언트가 수행한다. 미리보기 토큰 같은 서버 측 캐시 인프라를 추가하지 않는다.

```json
{
  "timestamp": "2026-09-08T14:30:00",
  "status": 409,
  "code": "COST_SOURCE_CHANGED",
  "message": "다른 사용자가 이 전산업무비를 수정했습니다.",
  "changedBy": "홍길동",
  "changedAt": "2026-09-08T14:25:00",
  "currentStamp": "a3f...",
  "current": { "costBgNo": "COST_2026_0001", "bgSno": 2, "cttNm": "...", "terminals": [] }
}
```

- `current`는 저장 직전 잠금 상태에서 읽은 전산업무비 상세 응답과 같은 구조다. 단말 목록 전체를 포함한다.
- `changedBy`는 부모와 자식의 `LST_CHG_DTM` 중 가장 최근 값에 해당하는 사번을 사용자 정보로 해석한 이름이다. 해석할 수 없으면 사번을 그대로 쓴다.
- `currentStamp`를 함께 주므로 사용자가 병합을 마치면 그 값으로 즉시 재저장할 수 있다. 병합 중 또 변경되면 다시 409가 발생하고 같은 절차를 반복한다.

## 6. 잠금과 트랜잭션 순서

`CostService.updateCost`는 다음 순서를 지킨다.

1. 부모 정확한 개정본을 `PESSIMISTIC_WRITE`로 잠근다. 기존 `CostWriteTargetLoader.loadForUpdate`를 그대로 쓴다.
2. 잠긴 상태에서 BTERMM 활성 행을 배치 조회한다.
3. 현재 스탬프를 재계산한다.
4. 요청 스탬프와 비교한다. 다르면 `COST_SOURCE_CHANGED` 409로 전체 롤백한다.
5. 같으면 기존 저장 로직을 그대로 수행한다.

검사를 잠금 획득 **뒤**에 두는 것이 핵심이다. 잠금 앞에 두면 검사와 저장 사이에 다른 트랜잭션이 커밋될 수 있다.

잠금 순서는 기존 규약대로 `costBgNo → bgSno`로 고정해 교착을 피한다. 결재 진행 중인 개정본에 대한 쓰기 차단은 기존 `ApprovalWriteGuard`가 계속 담당하며 이 설계가 대체하지 않는다.

## 7. 프론트엔드

### 7.1 상세 폼 — 병합 다이얼로그

- `app/components/cost/CostConflictMergeDialog.vue` (신규): 필드는 `내 값 / 서버 값 / 선택` 3열로 보여주고, 단말 행은 `상대가 추가`·`상대가 삭제`·`양쪽 수정` 배지로 구분한다. 양쪽이 같은 값이면 목록에서 감춘다.
- `app/composables/cost/useCostConflictMerge.ts` (신규): 화면 로드 시점의 원본(base), 사용자가 편집한 값(mine), 응답의 `current`(theirs)로 차이를 계산하고, 사용자의 선택을 저장 payload로 조립한다. 재저장 시 응답의 `currentStamp`를 실어 보낸다.
- `useCostFormData`는 조회 응답의 `concurrencyStamp`와 원본 스냅샷을 함께 보관한다.
- `useCostFormSave`는 409 `COST_SOURCE_CHANGED`를 잡아 병합 다이얼로그를 연다. 사용자가 취소하면 편집 내용을 유지한 채 저장만 취소한다. 저장 실패로 입력값을 버리지 않는다.

### 7.2 목록 인라인 편집

`useCostPersistence.saveAndExitEdit`는 여러 행을 순차 저장하므로 행마다 병합 다이얼로그를 띄우면 사용자가 감당할 수 없다. 이 경로에서는 기존 부분 실패 표면화(`saveFailures`, ERR-11)에 충돌 사유를 실어 해당 행만 재조회하도록 안내한다. 성공한 행은 그대로 커밋된 상태로 둔다.

### 7.3 타입 생성

백엔드 DTO와 OpenAPI 계약을 먼저 확정한 뒤 `npm run codegen`과 `npm run codegen:check`를 실행한다. 생성 타입은 수기로 편집하지 않는다.

## 8. 검사 면제 경로

사람이 여는 화면이 없는 경로는 스탬프를 요구하지 않고 검사도 하지 않는다.

- `CostService.createCostForMigration`
- `updateCostForMigration` 및 `preserveSubmittedAmounts=true` 경로
- 관리자성 보정·일괄 이관

면제 경로도 부모 행 잠금은 그대로 유지한다. 면제는 스탬프 검사에만 적용되며 잠금 규약을 우회하지 않는다.

## 9. 배포 순서 제약

스탬프 누락을 400으로 차단하므로 **백엔드를 먼저 배포하면 구버전 프론트엔드의 모든 전산업무비 저장이 실패한다**. 배포는 반드시 다음 순서를 지킨다.

1. 프론트엔드에서 조회 응답의 `concurrencyStamp`를 보관하고 저장 요청에 실어 보내는 변경을 먼저 배포한다. 이 시점의 백엔드는 아직 필드를 무시하므로 동작에 영향이 없다.
2. 프론트엔드 배포가 완료되고 캐시된 구버전 번들이 만료된 뒤 백엔드의 필수 검증을 배포한다.

두 단계 사이에는 보호가 없다. 간격을 짧게 유지한다.

## 10. 테스트

**백엔드**

- 스탬프 계산의 결정성: 단말 행 입력 순서가 달라도 같은 스탬프가 나온다.
- 금액 스케일 차이(`1000` 대 `1000.00`)가 충돌로 판정되지 않는다.
- 감사 필드만 바뀐 경우 충돌이 아니다.
- 부모 필드 변경, 단말 추가, 단말 삭제 각각에서 `COST_SOURCE_CHANGED` 409가 발생하고 저장이 롤백된다.
- 스탬프 누락·형식 오류에서 `COST_STAMP_REQUIRED` 400이 발생한다.
- 면제 경로는 스탬프 없이 저장에 성공한다.
- 잠금 타임아웃에서 `COST_CONCURRENT_UPDATE` 409로 변환된다.
- 동시 저장 통합 테스트: 두 트랜잭션이 같은 문서를 저장하면 하나만 성공한다.

**프론트엔드**

- base·mine·theirs 차이 계산 단위 테스트. 단말 추가·삭제·양쪽 수정 각 분류를 검증한다.
- 병합 선택 결과가 payload로 정확히 조립되고 `currentStamp`가 실린다.
- 409 수신 시 편집 내용이 보존된다.
- 목록 인라인 저장에서 충돌 행이 `saveFailures`로 표면화되고 성공 행은 유지된다.

## 11. 리스크

- 병합 다이얼로그는 필드 수가 많아 화면이 길어진다. 차이가 있는 항목만 노출해 완화한다.
- 스탬프 입력 필드 집합이 조회 응답과 어긋나면 사용자가 아무것도 바꾸지 않아도 충돌이 발생한다. 조회와 검증이 같은 `CostConcurrencyStamper` 함수를 호출하도록 강제해 방지한다.
- 배포 두 단계 사이의 보호 공백(9절).

## 12. 손대는 파일

| 저장소 | 파일 |
| --- | --- |
| it_backend | `CostDto`(UpdateRequest·Response·신규 ConflictResponse), `CostService.updateCost`, 신규 `CostConcurrencyStamper`, 신규 `CostConflictException`, `GlobalExceptionHandler`, `CostQueryAssembler` |
| it_frontend | codegen 산출 타입, `useCost`, `useCostFormData`, `useCostFormSave`, 신규 `useCostConflictMerge`, 신규 `CostConflictMergeDialog.vue`, `useCostPersistence` |
| it_database | 없음 |
