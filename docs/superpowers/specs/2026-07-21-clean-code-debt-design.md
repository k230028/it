# Clean Code 부채 이행계획

## 목적

`TASK.md` [Clean Code 부채] 섹션의 미완료 13건(CQ-01~08, CQ-10~14)을 처리한다. 이 항목들은 2026-07-08 Clean Code 리뷰 이행(`docs/superpowers/specs/done/2026-07-08-clean-code-review-remediation-design.md`)에서 "범위 밖 이관"된 잔여 부채다. 검증 기반을 먼저 구축한 뒤 저위험 정리와 구조 개선을 순차 수행하고, 기능 변경 연계 항목은 착수 트리거를 정의해 종결한다.

## 사전 확정 사항

| 결정 | 내용 |
| --- | --- |
| 범위 | 미완료 13건 전체를 하나의 로드맵으로 관리 |
| CQ-07 | Java 포매터(Spotless + google-java-format) 도입. 일괄 포맷은 단독 커밋으로 격리 |
| CQ-08 | API 계약 변경 없이 현행(null=루트 이동) 유지 + 문서화로 종결 |
| CQ-05 | 외부 CI 대신 로컬 정기 실행 명령(`test:e2e:core`)으로 고정 |

## 접근안

| 접근 | 내용 | 장점 | 단점 |
| --- | --- | --- | --- |
| A. 안전망 우선 웨이브 | 검증 기반 → 저위험 정리 → 구조 개선 → 조건부 트리거 순 | 리팩터링 전 회귀 안전망 확보 | 초기 가시적 개선이 적음 |
| B. 도메인별 병렬 배치 | 백엔드/프론트/테스트 3개 배치 병행 | PR 분리와 병행 작업 용이 | 테스트 기반 없이 리팩터링 착수 위험, 교차 의존(CQ-04→CQ-02) 관리 복잡 |
| C. 우선순위 순 처리 | Medium 7건 → Low 6건 | 관리 단순 | Medium 안에 리팩터링과 그 전제조건이 섞여 순서가 어긋날 수 있음 |

채택안은 A다. CQ-02는 TASK.md에 "테스트 또는 수동 QA 기준을 먼저 세운 뒤 진행"이 명시되어 있고, CQ-04는 CQ-02의 PDF composable 분해를 판별하는 전제조건이므로 안전망을 먼저 구축한다.

## Wave 0 — 검증 기반 구축

| 항목 | 작업 내용 | 완료 기준 |
| --- | --- | --- |
| CQ-13 | `jacocoTestCoverageVerification`을 `check` 태스크 의존성에 연결. 먼저 현재 실측 커버리지를 확인하고, 기준(70%) 미달이면 실측치 기준으로 시작 임계값을 정한 뒤 점진 상향 규칙을 문서화 | `./gradlew check` 실행만으로 커버리지 게이트가 동작 |
| CQ-04 | PDF/HWPX/Excel 산출물 회귀 기준 수립: 최소 fixture 데이터 정의, 바이트 비교가 아닌 구조·텍스트 추출 기반 Vitest 검증(셀 값, 페이지 텍스트, 문서 구조) | `useItBudgetApprovalFormPdf.ts` 분해 전후를 판별할 수 있는 테스트가 `npm test`에 편입 |
| CQ-05 | E2E 3시나리오(로그인, 프로젝트 조회/생성, 결재 처리)를 `test:e2e:core` 고정 명령으로 분리. 로컬 Oracle·인증 데이터 사전조건 준비 스크립트/문서 작성, 배포 전 체크리스트에 편입 | 단일 명령으로 3시나리오 실행 가능 + 실행 절차 문서화 |

## Wave 1 — 저위험 일괄 정리

| 항목 | 작업 내용 |
| --- | --- |
| CQ-07 | Spotless(google-java-format) 도입 → 전체 일괄 포맷 단독 커밋 → Toast `life`, 기본 편성률 `100` 등 반복 리터럴 도메인별 상수화 |
| CQ-12 | `build.gradle`의 `description = 'Demo project for Spring Boot'`를 실제 서비스명으로 교체 |
| CQ-14 | 미사용 REST Docs·Asciidoctor 플러그인/의존성/snippets 설정 제거 (Gradle 10 제거 예정 API 경고 근원 해소) |
| CQ-10 | `IconActivity.vue`, `ReviewVersionHistory.vue`의 동적 연결(동적 import, 문자열 참조) 최종 확인 후 제거 |
| CQ-08 | 코드 변경 없이 `MenuDto.MoveRequest` Javadoc과 API 문서에 "null=루트 이동" 규칙을 명시하고 항목 종결 |

순서 규칙: 포매터 일괄 포맷 커밋은 다른 백엔드 변경과 겹치지 않도록 웨이브 내 가장 먼저, 작업 브랜치가 없는 시점에 단독 수행한다. `it_backend`는 별도 git 저장소이므로 백엔드 커밋은 `it_backend` 내부에서 수행한다.

## Wave 2 — 구조·타입 개선 (Wave 0 완료 후 착수)

| 항목 | 작업 내용 | 진행 방식 |
| --- | --- | --- |
| CQ-03 | 프로덕션 `any`·`eslint-disable no-explicit-any` 제거 (2026-07-11 스캔 기준 398라인) | 3배치 순차: ① 결재/사업집행 4단계 페이지 → ② Tiptap/Excel/PDF → ③ 가이드 문서 CRUD. 기존 타입 재사용 우선, 불가피한 우회는 사유 주석으로 축소. 배치마다 `npm run check`와 관련 테스트 통과 확인 |
| CQ-11 | `default`·`admin` 레이아웃의 중복 앱 셸을 공통 `AppShell` 컴포넌트로 추출 | 두 레이아웃 대표 화면 수동 확인 + E2E core 실행으로 회귀 검증 |
| CQ-02 | 대형 프론트 파일 분해: `useCostListPage.ts`, `projects/form.vue`, `plan/[id].vue`, `useItBudgetApprovalFormPdf.ts` | 파일당 독립 커밋. PDF composable은 CQ-04 회귀 테스트로 전후 동일성 검증. 화면 파일은 분해 전 수동 QA 체크리스트를 먼저 기록 |

## Wave 3 — 조건부 항목 트리거 정의 (코드 변경 없음)

CQ-01, CQ-06은 이번 로드맵에서 실행하지 않고 TASK.md 해당 행에 착수 트리거와 수행 기준을 명시해 관리 상태를 확정한다.

| 항목 | 트리거 정의 |
| --- | --- |
| CQ-01 | `ProjectService`, `CostService`, `BudgetWorkService`, `CouncilController` 중 해당 도메인 기능 변경 착수 시 Query·Command 분리와 테스트 분리를 같은 계획에 포함 |
| CQ-06 | 비용 도메인 리팩터링(CQ-01의 `CostService` 분해 포함) 착수 시 `Bprojm.UpdateCommand` 선례를 따라 `Bcostm.update` 20개 매개변수를 record로 전환 |

## 실행 단위와 순서

1. 구현 계획은 웨이브별 독립 plan 문서(`docs/superpowers/plans/`)로 작성한다.
2. 실행 순서는 Wave 0 → Wave 1 → Wave 2. Wave 3은 문서 갱신만이므로 Wave 1 plan에 병합한다.
3. 각 웨이브 완료 시 TASK.md를 갱신하고 완료 근거를 TASK_DONE.md로 이관한다.

## 검증 전략

| 시점 | 검증 |
| --- | --- |
| 각 웨이브 종료 | 프론트 `npm run format:check`, `npm run check`, `npm test` / 백엔드 `./gradlew test` (DB 매핑 변경 시 `integrationTest` 추가) |
| Wave 2 각 커밋 | 기능 불변 원칙. 동작 변경이 필요해 보이면 중단하고 별도 항목으로 분리 |
| CQ-02·CQ-11 | Wave 0에서 구축한 E2E core 명령과 수동 QA 체크리스트로 화면 회귀 확인 |

## 리스크와 대응

| 리스크 | 대응 |
| --- | --- |
| JaCoCo 게이트가 현재 커버리지 미달로 `check`를 실패시킴 | 게이트 연결 전 실측하고 시작 임계값을 실측치 기준으로 설정, 점진 상향 규칙 문서화 |
| 포매터 일괄 커밋이 진행 중 작업과 충돌 | 작업 브랜치가 없는 시점에 단독 커밋으로 수행 |
| PDF/Excel 구조 검증이 라이브러리 내부 표현에 과결합 | 텍스트·셀 값 등 안정적 표면만 검증 대상으로 한정 |
| E2E가 로컬 데이터 상태에 의존해 불안정 | 사전조건 준비 스크립트로 데이터 상태를 고정하고 결정적 대기만 사용 |
