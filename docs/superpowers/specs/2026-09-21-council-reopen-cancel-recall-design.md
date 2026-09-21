# 정보화실무협의회 작성완료 수정 복귀·오신청 취소·결재 회수 복구

- 과제: [COUNCIL-010](../../../TASK_COUNCIL.md)
- 선행: [COUNCIL-011 설계](done/2026-09-20-council-write-boundaries-design.md) — `CouncilAccessGuard`와 403/404/409 관례를 그대로 잇는다.
- 범위: `it_backend` `domain/council`(리스너 1개·서비스 2메서드·컨트롤러 2엔드포인트·테스트), `it_frontend` 협의회 Step1 페이지·`useCouncilRequestPage`·`useCouncilLifecycleApi`·`i18n/messages/council.ts`·생성 타입(`npm run codegen`). 공통 결재 모듈·DB 스키마는 바꾸지 않는다.

## 문제

협의회 상태 전이는 앞으로만 간다. 세 경우에 사용자가 갇힌다.

| 경우 | 현재 동작 | 원인 |
| --- | --- | --- |
| 결재 **회수** | 공통 결재 `recall`이 신청서를 `RECALLED`로 바꾸고 `ApprovalRecalledEvent`를 발행하지만 협의회는 구독하지 않는다. 협의회는 결재요청(`03`)에 남고, 재상신은 작성완료(`02`)에서만 허용되므로 **영구 고착** | `CouncilApprovalEventListener`가 `ApprovalCompletedEvent`만 처리 |
| 작성완료 후 수정 | 작성완료(`02`)가 되면 `lockWritableDraft`가 `01`만 허용해 저장이 409. 오타 하나도 결재 반려를 받아야 고친다 | `02 → 01` 경로 없음 |
| 오신청 | 삭제·취소 API가 없다. 신청 시 사업 상태를 `09`(신청 대상)에서 `45`(정실협 진행중)로 바꾸므로, 잘못 신청한 사업은 다른 협의회를 신청할 수 없고 목록에도 계속 남는다 | `createCouncil`의 역방향 없음 |

과거 PRD(0509~0803)에는 반려 재작성(`03 → 01`, 구현됨)만 있고 위 세 경우의 요구는 없다. 2026-09-21 사용자 결정으로 셋 다 구현한다.

## 상태 전이 (추가분)

| 전이 | 트리거 | 허용 주체 | 선행 조건 | 부수 효과 |
| --- | --- | --- | --- | --- |
| `03 → 02` | 공통 결재 회수 이벤트 | 시스템(리스너) | 회수된 신청서가 `BASCTM`에 연결돼 있고 현재 `03` | 없음. 작성 내용 유지, 재상신 가능 |
| `12 → 11` | 공통 결재 회수 이벤트 | 시스템(리스너) | 현재 `12` | 없음. 결과서 재결재 가능 |
| `02 → 01` | `PATCH /api/council/{asctId}/reopen` | 관리 또는 주관부서(`verifyOwningOrManageable`) | 현재 `02` | `BPOVWM.KPN_TP_TC`를 임시저장(`10`)으로 되돌린다 |
| `01·02 → 삭제` | `DELETE /api/council/{asctId}` | 관리 또는 주관부서(`verifyOwningOrManageable`) | 현재 `01` 또는 `02`(결재 이력 없음) | `BASCTM.DEL_YN='Y'`. 사업 협의회면 `BPROJA` 상태 `45 → 09` 복귀. 계획협의회(`02` 유형)는 원장만 삭제 |

그 밖의 상태에서 `reopen`·`DELETE`는 409(`IllegalStateException`, 기존 CommitteeService 관례). 권한 없음은 403, 없거나 이미 삭제된 협의회는 404.

`03` 이후의 취소는 두지 않는다 — 회수(`03 → 02`) 뒤 취소하도록 유도한다. 결재완료(`04`) 이후는 생략(`99`) 경로가 이미 있다.

## 설계

### 1. 회수 리스너 (백엔드)

`CouncilApprovalEventListener`에 `@EventListener @Transactional public void handleApprovalRecalled(ApprovalRecalledEvent)`를 추가한다. 기존 완료 핸들러와 같은 방식으로 `applicationMapRepository.findByApfDcmNoAndFntTbNm(apfMngNo, "BASCTM")`으로 협의회를 찾고 `CouncilApprovalService.processApprovalRecall(asctId)`를 부른다.

`processApprovalRecall`은 현재 상태가 `03`이면 `02`, `12`면 `11`로 `councilService.changeStatus`하고, 그 밖의 상태면 경고 로그만 남기고 아무것도 하지 않는다(회수 이벤트가 늦게 도착한 경우 원장을 뒤로 되돌리지 않기 위함). 발행자(`ApplicationService.recall`)와 같은 트랜잭션에서 동기 실행되므로 실패 시 회수 전체가 롤백된다 — 완료 핸들러와 같은 선택이며 같은 주석을 남긴다.

### 2. 작성완료 수정 복귀 (백엔드)

`FeasibilityService.reopenFeasibility(String asctId)`:

1. `councilService.findActiveCouncil` → `councilAccessGuard.verifyOwningOrManageable(council)`.
2. 상태가 `02`가 아니면 `IllegalStateException("작성완료(02) 상태에서만 수정으로 되돌릴 수 있습니다. 현재 상태: …")` → 409.
3. `BPOVWM`(사업개요)의 `KPN_TP_TC`를 `10`(임시저장)으로 바꾼다 — `Bpovwm`에 `reopenAsDraft()` 메서드를 추가한다(기존 `update(…)`는 본문 전체를 받는다). 사업개요가 없으면(작성완료가 됐다면 항상 있어야 하므로) `IllegalStateException` → 409.
4. `councilService.changeStatus(asctId, "01")`.

`CouncilFeasibilityController`에 `@PatchMapping("/{asctId}/reopen")`(204 No Content). 프론트 저장 흐름(`saveFeasibility`)은 그대로다 — `01`로 돌아왔으므로 `lockWritableDraft`를 통과한다.

### 3. 오신청 취소 (백엔드)

`CouncilService.cancelCouncil(String asctId)`:

1. `findActiveCouncil` → `verifyOwningOrManageable`.
2. 상태가 `01`·`02`가 아니면 `IllegalStateException` → 409.
3. `council.delete()`(`BaseEntity.delYn='Y'`).
4. 계획협의회(`itPtlAsctDbrTc='02'`)가 아니면 `bprojaSyncService.upsert(abusMngNo, abusMngNo, "09")`로 사업을 신청 대상 상태로 되돌린다. `createCouncil`이 `45`로 올린 것의 정확한 역방향이다.

하위 문서(`BPOVWM`·`BCHKLM`·`BPERFM`, 첨부)는 건드리지 않는다. 모든 조회가 `findActiveCouncil`(`DEL_YN='N'`)을 거치므로 원장 삭제만으로 접근이 끊긴다. 목록 쿼리 4개는 `a.DEL_YN = 'N'` 조건을 이미 갖고 있고(관리자·부서 사업 행 쿼리는 `LEFT JOIN TPRMPP_BASCTM a … AND a.DEL_YN = 'N'`, 부서·위원 협의회 행 쿼리는 `WHERE … a.DEL_YN = :delYn`), 따라서 취소된 사업은 미신청 행으로 되돌아간다. 같은 사업에 다시 신청하면 새 `ASCT-` ID가 채번된다.

`CouncilController`에 `@DeleteMapping("/{asctId}")`(204 No Content).

### 4. 프론트 (Step1 `[id].vue`)

`useCouncilLifecycleApi`에 `reopenFeasibility(asctId)`(PATCH)·`cancelCouncil(asctId)`(DELETE)를 추가하고 `useCouncil`이 노출한다. `useCouncilRequestPage`에:

- `canReopen = isSubmitted && (isAdmin() || isOwningDept)` — 서버 규칙과 같은 조건. 주관부서 판정은 목록 카드가 이미 쓰는 `user.bbrC === councilData.svnDpm`을 재사용한다.
- `canCancel = (councilStatus === '01' || '02') && 같은 권한 조건`.
- `reopenFeasibility()`: 확인 다이얼로그(PrimeVue `useConfirm`) → 호출 → `attemptDetailRefresh`(ERR-13) → 성공 토스트. 실패는 `failureDetail`.
- `cancelCouncil()`: 확인 다이얼로그(되돌릴 수 없음 문구) → 호출 → 성공 토스트 → 목록(`/info/council-request`)으로 이동. 실패는 `failureDetail`.

버튼 배치: 결재 요청 버튼 옆(`isSubmitted` 영역)에 [수정으로 되돌리기](secondary), 저장 버튼 영역·결재 요청 영역 아래 공통으로 [신청 취소](danger, outlined)를 `canCancel`일 때만. i18n 키는 `council.requestDetail` 아래 `reopen`, `reopenConfirm`, `reopenDone`, `cancel`, `cancelConfirm`, `cancelDone`과 `council.request.toast.reopenFailed`, `cancelFailed`(ko/en).

생성 타입: 백엔드 기동 후 `npm run codegen` → `app/types/api.d.ts` 갱신, `npm run codegen:check`로 확인.

## 오류·경계

| 상황 | 응답 | 화면 |
| --- | --- | --- |
| `reopen`을 `01`/`03` 이상에서 호출 | 409 | 실패 토스트(서버 메시지) + 상세 재조회 |
| `DELETE`를 `03` 이상에서 호출 | 409 | 실패 토스트 |
| 타 부서·배정위원이 호출 | 403 | 실패 토스트(버튼은 애초에 숨김) |
| 회수 이벤트가 `03`/`12`가 아닌 상태에 도착 | 무시(경고 로그) | — |
| 취소 후 KeepAlive로 목록 복귀 | 목록 `onActivated` 재조회(COUNCIL-006)로 미신청 행으로 갱신 | — |

## 테스트

- 백엔드 `CouncilAccessBoundaryTest`(또는 새 `CouncilReopenCancelTest`): 회수 `03→02`·`12→11`·그 밖 무시, reopen 권한 403·상태 409·성공 시 `KPN_TP_TC=10`+`01`, cancel 권한 403·상태 409·성공 시 `delYn='Y'`+`upsert(…,"09")`, 계획협의회는 `upsert` 미호출. 컨트롤러 슬라이스로 204·403·409.
- 프론트 `useCouncilRequestPage.test.ts`: `canReopen`/`canCancel` 판정(상태×권한), `reopenFeasibility` 성공 시 재조회·토스트, 실패 토스트, `cancelCouncil` 성공 시 목록 이동, 실패 시 이동 안 함.
- 게이트: `./gradlew test --tests 'com.kdb.it.domain.council.*'`·`spotlessJavaCheck`, `npm run check`·`npm test`·`npm run codegen:check`.

## 하지 않는 것

- `03` 이후의 직접 취소, 삭제 복구(undelete), 하위 문서 물리 삭제.
- 결재 회수 API 자체(공통 결재가 이미 제공)와 회수 알림(공통 알림 리스너가 이미 처리).
- 개최준비(`05`) 이후 되돌리기.
