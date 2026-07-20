# Clean Code 리뷰 이행계획

## 목적

`docs/clean-code-review-2026-07-07.md`에서 확인된 코드 품질 이슈를 사용자 영향과 회귀 위험 기준으로 나누어 처리한다. 이번 개선은 실제 버그와 입력 검증 공백, 보안·정합성 중복, 타입 우회 재발 방지의 첫 단계까지 포함한다. 대형 모듈 분해와 장기 검증 체계는 `TASK.md`에 별도 추적 항목으로 남긴다.

## 접근안

| 접근 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| A. 전부 로드맵화 | 모든 항목을 `TASK.md`로 이동 | 관리가 단순함 | 실제 버그와 검증 공백이 지연됨 |
| B. 즉시 수정만 처리 | 필드명 버그, `@Valid`, 응답 코드만 수정 | 빠르고 위험이 낮음 | 재발 원인과 구조 부채가 남음 |
| C. 2단계 실행 | 즉시 수정과 단기 안정화를 이번 범위로 처리하고 나머지를 `TASK.md`에 이관 | 사용자 영향과 재발 방지를 함께 다룸 | 작업 단위 관리가 필요함 |

추천안은 C다. 리뷰 문서의 CRITICAL 항목은 실제 사용자 증상이 있으므로 즉시 처리하고, 같은 유형의 버그를 만든 `any` 우회 관행은 핵심 도메인부터 줄인다. 반면 God Class 분해와 테스트 체계 확장은 변경 범위가 크므로 별도 작업으로 추적한다.

## 이번 개선 범위

| Wave | 목표 | 대상 | 완료 기준 |
| --- | --- | --- | --- |
| P0 | 실사용자 영향 버그 수정 | `ornYn` 오참조 3곳을 `odnYn` 기준으로 수정 | 프로젝트 상세, PDF 보고서, 목록 배지가 경상사업을 정상 표시 |
| P0 | 입력 검증 공백 보강 | mutating 엔드포인트 6곳 `@Valid` 추가 | 요청 본문 검증 실패가 400으로 처리 |
| P0 | API 응답 규약 보정 | `CostController.createCost` 201 Created + Location 적용 | 생성 API가 REST 규약과 일치 |
| P1 | 권한 중복 제거 | `ProjectService`/`CostService`의 `validateModifyPermission` 공통화 | 동일 권한 정책이 한 경로에서만 유지됨 |
| P1 | 환율 환산 규칙 단일화 | `BudgetWorkService`, `ProjectBudgetSummaryService` 기준 대조 후 한 규칙으로 정리 | 동일 데이터가 화면·집계마다 다르게 계산되지 않음 |
| P2 | 타입 우회 재발 방지 | 결재/예산/PDF 핵심 경로의 `any + eslint-disable` 일부 제거 | `odnYn` 계열 버그가 타입 검사나 테스트에서 잡힘 |

## 범위 밖 이관

다음 항목은 이번 개선에서 직접 구현하지 않고 `TASK.md`에 반영한다.

| 항목 | 이관 이유 |
| --- | --- |
| `ProjectService`, `useCostListPage.ts`, `usePdfReport.ts`, `CouncilController` 분해 | 변경 폭이 크고 테스트 재구성이 함께 필요 |
| 전체 `any + eslint-disable` 184건 제거 | 한 번에 제거하면 UI 회귀 위험이 크므로 도메인별 점진 처리 필요 |
| Repository 통합 테스트 확대와 E2E CI 편입 | 환경 안정화와 실행 비용 검토 필요 |
| `Bcostm.UpdateCommand` record 도입 | 엔티티 호출부 영향 범위 확인 필요 |
| 포맷터 도입, Toast life 상수화, 기타 매직 넘버 정리 | 코드 스타일 변화가 넓어 별도 PR이 적합 |
| PDF/HWPX/Excel 회귀 테스트 체계화 | 테스트 데이터와 산출물 검증 기준 정의 필요 |

## 실행 순서

1. 기준선 확인
   - 루트, `it_backend`, `it_frontend`의 `git status --short`를 확인한다.
   - 리뷰 문서의 파일 위치가 현재 코드와 일치하는지 `rg`로 재확인한다.

2. P0 프론트 버그 수정
   - `it_frontend/app/pages/info/projects/[id].vue`
   - `it_frontend/app/composables/usePdfReport.ts`
   - `it_frontend/app/pages/info/projects/index.vue`
   - `Project` 타입에 `odnYn` 접근이 드러나도록 이번 버그 경로의 `any` 캐스팅을 제거한다.

3. P0 백엔드 검증·응답 수정
   - `CostController.createCost`
   - `AdminBoardMetaController.create`
   - `GuideDocController.createDocument`
   - `ServiceRequestDocController.createDocument`
   - `BoardCommentController.create`
   - `AdminMenuController.move`
   - DTO 제약 조건이 부족하면 기존 필드 의미에 맞춰 최소 검증만 보강한다.

4. P1 권한·환율 정합화
   - 기존 `OwnershipVerifier` 사용 가능성을 먼저 확인한다.
   - 공통화 후 `ProjectService`와 `CostService`의 정책 차이가 없는지 테스트한다.
   - 환율 규칙은 최근 TASK 정리와 실제 코드 계산식을 대조한 뒤 중복 환산 또는 미환산 한쪽으로 정리한다.

5. P2 타입 안전성 착수
   - 이번 버그와 직접 연결되는 경로부터 `as any`와 `eslint-disable-next-line @typescript-eslint/no-explicit-any`를 제거한다.
   - DataTable slot 타입처럼 한 번에 정리하기 어려운 곳은 후속 TASK로 남긴다.

6. 검증
   - 프론트: `npm run typecheck`, `npm run lint`, 관련 Vitest가 있으면 focused test 후 `npm test`
   - 백엔드: 관련 컨트롤러/서비스 테스트 focused run 후 `./gradlew test`
   - 브라우저 확인이 필요한 경상사업 표시와 생성 API 흐름은 서버 기동 후 수동 또는 `/qa`로 확인한다.

## 테스트 전략

| 범위 | 테스트 |
| --- | --- |
| `odnYn` 표시 | 프로젝트 상세/목록/PDF 생성 경로의 타입 체크와 화면 기준 확인 |
| `@Valid` | WebMvcTest 또는 기존 컨트롤러 테스트에서 잘못된 요청 본문 400 검증 |
| `createCost` | 생성 성공 시 201과 Location 헤더 검증 |
| 권한 공통화 | 본인/관리자/타부서 사용자 케이스 회귀 테스트 |
| 환율 규칙 | 동일 입력에 대해 작업 예산과 프로젝트 요약이 같은 기준으로 합산되는지 검증 |
| 타입 우회 제거 | `npm run typecheck`가 `ornYn` 같은 잘못된 필드 접근을 차단하는지 확인 |

## 리스크와 대응

| 리스크 | 대응 |
| --- | --- |
| DTO에 검증 어노테이션이 부족해 `@Valid`만으로 효과가 약할 수 있음 | 요청 DTO별 필수 필드만 최소 보강하고 Swagger 설명과 맞춘다 |
| 권한 공통화 중 도메인별 예외 정책이 섞일 수 있음 | 공통 검증 함수는 소유자·관리자 판단만 맡기고 도메인 특수 조건은 서비스에 남긴다 |
| 환율 규칙이 문서와 실제 데이터 관행이 다를 수 있음 | 최근 커밋과 `TASK.md` 정리 내용, 테스트 기대값을 먼저 대조한다 |
| `any` 제거가 DataTable 타입 추론 문제로 커질 수 있음 | 이번 버그 경로만 먼저 강타입화하고 나머지는 후속 TASK로 남긴다 |

## 완료 기준

- P0 항목이 모두 수정되고 프론트/백엔드 기본 검증 명령이 통과한다.
- P1 항목은 공통 정책 또는 단일 계산 규칙이 테스트로 보호된다.
- P2는 `odnYn` 관련 재발 방지 범위가 타입 또는 테스트로 고정된다.
- 이번 범위 밖 항목은 `TASK.md`의 Clean Code 부채 섹션에서 추적된다.
