# 정보화사업 동시성 스탬프 배포 절차

## 배경

전산업무비에 적용한 동시성 스탬프·병합 규약([`2026-09-08-cost-concurrency-rollout.md`](2026-09-08-cost-concurrency-rollout.md))을 정보화사업(BPROJM)·품목(BITEMM) 작성 화면에도 같은 방식으로 확장했다(TASK BE-102). 조회 응답에 `concurrencyStamp`를 싣고, 저장 요청이 이를 동봉하지 않거나 서버 값과 다르면 병합 다이얼로그를 유도한다. 설계 원칙은 [`docs/superpowers/specs/done/2026-09-08-cost-concurrency-conflict-merge-design.md`](../superpowers/specs/done/2026-09-08-cost-concurrency-conflict-merge-design.md)를 그대로 따르며, 정보화사업 고유 사항만 아래에 적는다.

## 계약

| 항목 | 값 |
| --- | --- |
| 조회 응답 | `GET /api/projects/{id}`, `GET /api/projects/{id}/versions/{sno}`, 이력 조회의 `concurrencyStamp`(64자 소문자 16진수). 목록·일괄 조회에는 싣지 않는다 |
| 저장 요청 | `PUT /api/projects/{id}?sno=`의 `concurrencyStamp` 필수 |
| 누락·형식 오류 | 400 `PROJECT_STAMP_REQUIRED` |
| 다른 사용자가 먼저 저장 | 409 `PROJECT_SOURCE_CHANGED` + `changedBy`·`changedByEno`·`changedAt`·`currentStamp`·`current`(품목 포함 상세) |
| 잠금 대기 5초 초과 | 409 `PROJECT_CONCURRENT_UPDATE` |
| 면제 경로 | 편성요청서 반입(`assignImportedPersonNames`, `assignDeclaredAmounts`, `markRequestFormImportApproved`)과 생성(`POST /api/projects`) |

스탬프 입력은 `ProjectConcurrencyStamper` 하나가 계산하며 상세 조회 조립(`ProjectQueryAssembler.assembleDetail`)과 저장 검증(`ProjectConcurrencyGuard.verifyStamp`)이 같은 활성 품목 집합(`DEL_YN='N'`, 개정본 순번 일치)으로 호출한다. 감사 필드와 `LST_YN`은 제외한다. 수량(`QTY`)은 소수 자릿수 계약이 없어 정수 강제 대신 후행 0만 제거한다.

## 순서

백엔드는 스탬프 검증을 처음부터 켠 채로 배포한다. 따라서 **백엔드를 먼저 배포하면 구버전 프론트엔드의 모든 정보화사업 저장이 400으로 실패한다.**

1. 프론트엔드를 먼저 배포한다. 새 프론트는 조회 응답에 스탬프가 없으면 `null`을 보내고, 구버전 백엔드는 알 수 없는 필드를 무시하므로 동작에 영향이 없다.
2. 캐시된 구버전 프론트 번들이 만료될 때까지 기다린다.
3. 백엔드를 배포한다. 이 시점부터 스탬프 없는 저장이 400으로 거부된다.

1~3단계 사이에는 정보화사업의 동시 저장 보호가 아직 없다. 간격을 짧게 유지한다.

## 되돌리기

백엔드만 이전 버전으로 되돌리면 검증(보호)이 사라지지만 저장 자체는 정상 동작한다. 새 프론트가 보내는 `concurrencyStamp` 필드는 이전 백엔드가 무시한다.

## 확인

- 사업 상세 조회 응답에 `concurrencyStamp`가 64자리 16진수로 내려오는가.
- 두 브라우저에서 같은 사업을 열고 한쪽을 저장한 뒤 다른 쪽을 저장하면 병합 다이얼로그가 뜨는가.
- 병합 다이얼로그에서 서버 값을 골라 저장하면 성공하는가.
- 한쪽이 소요자원 품목을 추가한 뒤 다른 쪽이 저장하면 그 행이 사라지지 않는가.
- 신규 사업을 임시저장한 직후 자동 임시저장이 400 없이 이어지는가(생성 직후 스탬프 재조회).
- 편성요청서 반입이 스탬프 없이 성공하는가.

### 수동 확인 — 자동 테스트로 대체 불가

전산업무비와 같은 이유로, 두 브라우저에서 같은 사업 개정본을 열어 순차 저장했을 때 병합 다이얼로그가 뜨고 먼저 저장한 쪽의 품목 행이 사라지지 않는지를 사람이 직접 확인한다. 백엔드 통합 테스트(`ProjectConcurrencyStampIt`)는 스탬프 왕복을 순차로만 검증하고, 프론트 테스트는 서버를 mock으로 대체한다.
