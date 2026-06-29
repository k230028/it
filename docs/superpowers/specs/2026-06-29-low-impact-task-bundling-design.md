# 영향도 낮은 TASK 백로그 묶음 처리 설계

> 🗓️ 작성일: 2026-06-29
> 🎯 목적: `TASK.md` 실행 로드맵의 **W2(코드부채, 단독 수정 가능) + 🟢 Low** 항목을 주제/유형별 묶음 PR로 재편해 영향도 낮은 백로그를 일괄 청산한다.
> 관련 문서: [`TASK.md`](../../../TASK.md), [`2026-06-28-task-remediation-design.md`](2026-06-28-task-remediation-design.md)

---

## 1. 배경

[`2026-06-28-task-remediation-design.md`](2026-06-28-task-remediation-design.md)에서 잔여 Open 항목을 4개 웨이브로 분류했고, **W2**를 "단독 수정 가능한 Medium/Low 다수 → 묶음 PR로 처리"로 정의했으나 **구체 묶음 단위는 미정의** 상태였다.

본 설계는 W2 + 🟢 Low 항목을 실제 PR 경계로 분해한다. 범위·묶음축·결정밴 처리 방침은 사용자 확인을 거쳤다:

- **범위**: W2 코드부채 + 🟢 Low 전체. (저위험 DB/JPA Medium은 제외 — W2 미포함분)
- **묶음 축**: 주제/유형별. 단, 위험도(동작 변경 여부)로 머지 순서를 분리.
- **결정밴 항목**: changeStatus role 분기·환율 규칙 통일 2건은 요건/결정 선행 필요 → 묶음에서 **카브아웃**.

## 2. 대상 항목 인벤토리 (13건, 카브아웃 2건 제외)

2026-06-29 코드 스폿체크로 참조 유효성 재확인(아래 line은 현재 코드 기준).

| # | 테마 | 항목 | 근거 | 동작변경 |
| :--: | --- | --- | --- | :--: |
| ① | 트랜잭션 경계 | `PlanService` 클래스레벨 `@Transactional(readOnly=true)` | `PlanService.java:43,49`(쓰기 메서드 `:203,313,341` 오버라이드 유지) | 없음 |
| ① | 트랜잭션 경계 | `LoginAttemptService` 클래스레벨 `@Transactional(readOnly=true)` | `LoginAttemptService.java` | 없음 |
| ② | 입력 검증 | mutating 컨트롤러 `@Valid` 누락 보강 | `CouncilController.java`, `BoardPostController.java` | 경미\* |
| ③ | N+1/쿼리 | `ScheduleService` 위원 사용자명 `findByEno`→`findByEnoIn` | `ScheduleService.java:383`(TASK.md `:311`은 stale, 정정) | 보존필요 |
| ③ | N+1/쿼리 | `CouncilService.deriveCurrentYearBudget` 행별 `findByAbusMngNoAndDelYn` 배치 prefetch | `CouncilService` | 보존필요 |
| ③ | N+1/쿼리 | `Deliberation/Contract/PaymentService.get()` 대상명 별도 SELECT → JOIN 프로젝션 단일쿼리 | `DeliberationService.java:148`, `ContractService.java:146`, `PaymentService.java:176` | 보존필요 |
| ③ | N+1/쿼리 | `CinfmmRepositoryImpl.markAllReadByRcvUsid()` 벌크 UPDATE 감사컬럼/`clearAutomatically` | `CinfmmRepositoryImpl.java:67-78` | 보존필요 |
| ④ | 주석/리팩터 | `ApplicationContextHolder` 미사용 `publishEvent()` + 구 `@TransactionalEventListener(BEFORE_COMMIT)` 주석 제거 | `ApplicationContextHolder.java:43,48,52` | 없음 |
| ④ | 주석/리팩터 | `CodeNameMapBuilder` `domain/budget/cost/util` → `common` 이동 | `CodeNameMapBuilder` | 없음 |
| ⑤ | 로그/스키마 | SSO 흐름 INFO 로그 eno 평문 → DEBUG 강등 | `SsoController.java:321,373` | 없음 |
| ⑤ | 로그/스키마 | `BtermmL.IND_RSN` `@Column(length)` 드리프트 확인/정정 | `BtermmL.java`, `TPRMPP_BTERML` | 없음 |
| ⑥ | 진단 | `HostAddressProvider` 로컬 IP/MAC 조회 실패 진단 보강 | `HostAddressProvider.java:34,57` | 없음 |
| ⑦ | 프론트 에러 | `council-request/result/[id].vue` `handleNotify`/`handleRequestApproval`/`handleStartResultWriting` catch 바인딩 통일 | `pages/info/council-request/result/[id].vue:273,299,314` | 없음 |

\* `@Valid`는 기존 통과되던 잘못된 입력을 거부할 수 있어 호출자가 정상 DTO를 보내는지 확인 필요(동작 회귀 방지).

### 카브아웃 (묶음 제외, 별도 트랙)

| 항목 | 선행 필요 | 근거 |
| --- | --- | --- |
| 사업집행 `changeStatus` role 분기 | 제출/완료 권한 **업무요건 확정** | `EstimateService.java:115` + Deliberation/Contract/Payment 동일 |
| 품목 금액 환율 환산 규칙 통일 | **단일 규칙 결정** | `ProjectBudgetSummaryService`(amt×xcr) vs `recalcCurrentYearBudget`(미적용) 비대칭 |

## 3. 묶음 정의 (접근 A — 위험도로 분리한 4개 테마 PR)

| PR | 묶음명 | 포함 | 성격 |
| :--: | --- | --- | --- |
| **PR-1** | 백엔드 안전 애너테이션 | ① + ② | 동작 불변(검증 경미) — 빠른 머지 |
| **PR-2** | 백엔드 정리 | ④ + ⑤ + ⑥ | 동작 불변 |
| **PR-3** | 쿼리 N+1 제거 | ③ | 동작 보존(테스트 필수) — 집중 리뷰 |
| **PR-4** | 프론트 에러 피드백 | ⑦ | 동작 불변 — 프론트 단독 소규모 |

**원칙**: 동작 불변 묶음(PR-1·2·4)은 안전하게 일괄 머지, 동작 변경(PR-3)만 분리해 테스트·리뷰 집중.

## 4. 순서 및 의존성

- **PR-1 · PR-2 · PR-4 상호 독립** — 어떤 순서로도/병행 머지 가능. 파일 충돌 없음(`CouncilController`@PR-1 ↔ `CouncilService`@PR-3는 별개 파일).
- **파급 주의 1건**: PR-2의 `CodeNameMapBuilder` 패키지 이동은 `ProjectService` 등 소비처 import 갱신 동반 → 이동만 **별도 커밋**으로 분리해 추적.
- **PR-3 독립이나 테스트 부담** — 단독 머지. 백엔드 통합테스트 인프라 부재(T18)로 N+1 검증은 **Mockito 단위테스트**(`findByEnoIn`/배치 호출 1회 단언 + 결과 동등성) 수준으로 제한됨을 명시.
- **권장 진행 순서**: PR-1 → PR-2 → PR-4(안전 3종 선청산) → PR-3(집중 리뷰). 실제 병행 가능.

## 5. 묶음별 검증

- **PR-1**: `@Valid` — MockMvc 컨트롤러 검증 테스트(잘못된 DTO 거부 + 기존 정상 호출 통과). `@Transactional(readOnly)` — 쓰기 메서드 오버라이드 유지 확인, 기존 테스트 그린.
- **PR-2**: 빌드 그린 + import 갱신 컴파일. SSO 로그 레벨 수동 확인. `BtermmL.IND_RSN`은 `TPRMPP_BTERML` DDL 대조 후 정정(`BcostmL` 2026-06-22 선례 동일).
- **PR-3**: Repository/Service 단위테스트로 쿼리 수 감소 + 결과 동등성 단언. `CinfmmRepositoryImpl` 벌크 UPDATE 후 감사컬럼 세팅/1차 캐시 stale 해소 확인.
- **PR-4**: `prepare/[id].vue`의 `catch (e: unknown)` 패턴으로 통일, 백엔드 메시지(`e.data?.message`) 노출 + 통보 수신자 null 시 피드백. 수동/E2E 확인.

> CLAUDE.md §4.1 한글 주석·§5.14 TDD 의무 준수. 단위테스트가 어려운 주석/로그/스키마 항목(④⑤)은 빌드·DDL 대조·수동 확인으로 갈음.

## 6. 산출물 및 후속

- **TASK.md 갱신**: 대상 13개 항목에 묶음 태그(PR-1~4) 부여, 카브아웃 2건은 "결정 대기"로 **W3 재라벨**(요건/결정 선행 → 기능 spec 트랙).
- **실행 계획**: 본 설계 승인 후 `writing-plans`로 4개 PR을 체크포인트로 묶은 **단일 실행 계획 1건** 작성. 안전 3종은 빠른 청산, PR-3는 별도 검증 단계로 구분.
- **카브아웃**: 각각 업무요건/규칙 결정 후 별도 spec → plan. 본 묶음 진행과 무관하게 병행.
