# TASK.md 재점검 및 개선 계획 (2차 안전 묶음 + 백로그 정비) 설계

> 🗓️ 작성일: 2026-06-29
> 🎯 목적: W1·W2 완료 후 잔여 `TASK.md` 항목을 코드 대조로 재검증하여 stale/재범위 항목을 정리하고, 안전하게 묶을 수 있는 코드부채 2차 묶음(W2b)을 정의한다.
> 관련: [`TASK.md`](../../../TASK.md), [`2026-06-29-low-impact-task-bundling-design.md`](2026-06-29-low-impact-task-bundling-design.md), [`2026-06-28-task-remediation-design.md`](2026-06-28-task-remediation-design.md)

---

## 1. 배경

W1(bbrC 부서필터)·W2(영향도 낮은 코드부채 13건)가 완료되면서 일부 `TASK.md` 항목이 stale해졌다. 사용자 요청은 두 가지: ① 잔여 항목 코드 대조 재검증, ② 그 결과로 다음 안전 코드부채 묶음 + 로드맵 개선.

## 2. 재검증 방법론

6개 병렬 read-only 에이전트가 `TASK.md` 잔여 섹션(보안·사전협의·에러처리·DB/JPA·프론트/백엔드 리팩토링·Tiptap·실시간로그·게시판·EAI·메타) 약 50개 항목을 코드와 대조했다. 각 항목을 `DONE`/`PARTIAL`/`STILL_OPEN`/`DECISION`/`EXTERNAL`로 판정하고 `SAFE_BUNDLEABLE`(동작보존 코드전용·스키마/외부/결정 의존 없음) 여부를 표기, `file:line` 근거를 수집했다.

## 3. 재검증 결과 요약

### 3.1 이미 완료/Stale (백로그에서 종료)
| 항목 | 판정 | 근거 |
| --- | :--: | --- |
| `$apiFetch` 401 갱신 후 재시도 결과 반환 E2E 검증 | ✅ DONE | `plugins/auth.ts:113-115`, `tests/unit/plugins/auth.test.ts:136-146`, `tests/e2e/session.spec.ts:75-125` |
| `AdminDto` 잔여 DTO JavaDoc 보강 | ✅ DONE | `AdminDto.java` 전 중첩 DTO에 `@param`+`@Schema` 완비(115-409) |
| 메타 `BPAYTM/BPAYTL.DFR_DT` NULL여부 N→Y | ✅ DONE | `table.csv` 이미 `Y`(1361, 1376) |
| 메타 `BPOVWM PRJ_BG_AMR→RQM_BG_AMT` | ✅ DONE(메타) | `table.csv` 이미 `RQM_BG_AMT`(966, 1019); 런타임 데이터 이관만 EXTERNAL |
| 실시간로그 `V20260531_001` 마이그레이션 적용 검증 | ⚠️ STALE | 해당 마이그레이션 미존재; `V_ITPAPP_LOG_FEED`는 비버전 로컬 DDL(`ITPOWN_DDL_live.sql:3609`) |

### 3.2 Stale 전제 — 재범위 또는 종료
| 항목 | 조치 | 근거 |
| --- | --- | --- |
| 게시판 `Bgdocm.docCone` BLOB→CLOB | 재범위 → "본문 최대 크기 정책 결정(DECISION)" | 실제는 `Cblbcm.nacCone VARCHAR2(4000)`(`Cblbcm.java:39`), BLOB 아님 |
| 게시판 `board/index.vue`+`AppSidebar.vue` `inqAthC` 중복 추출 | 종료(실행불가) | `inqAthC`/`enrAthC`가 프론트·백 코드에 **부재**(문서 prose만) |
| 게시판 `inqAthC/enrAthC` 역할 매핑 통합테스트 | 종료(실행불가) | 동일 — 해당 로직 부재 |
| `CouncilRepository.findWithDetails()`(16컬럼) | 문구 정정 | 실제 `findProjectsForCouncilAll`/`ByDepartment`(18컬럼, `CouncilRepository.java:184,237`); 이슈는 유효(native Object[]) |
| 환율 통일 `recalcCurrentYearBudget` | 문구 정정 | 실제 충돌: `ProjectBudgetSummaryService.java:86`(×xcr) vs `BudgetWorkService.java:224,322`(no-xcr) — 활성 이중환산 위험, DECISION 유지 |

### 3.3 W2로 PARTIAL이 된 항목 — 재범위
| 항목 | 잔여 | 근거 |
| --- | --- | --- |
| 협의회 일정/평가 사용자명 N+1 | `ScheduleService` ✅ 완료 / `EvaluationService`·`CommitteeService` ❌ 잔여 | `EvaluationService.java:254-258`, `CommitteeService.java:244-246` 여전히 `findByEno` 루프 |
| Java 파일 헤더 주석 전수 | 86% 완료, **12개 컨트롤러만 잔여** | `AdminController`/`RealtimeLogController`/`AdminBoardMetaController`/`CodeController`/`ItBudgetController`/`PlanController`/`BudgetStatusController`/`BudgetWorkController`/`AdminMenuController`/`AdminRouteController`/`MenuQueryController`/`GeminiController` |
| budget summary/comparison Mock→API | 백엔드·compos 준비됨, **프론트 wiring만** | `ItBudgetController.java:46,62` + `useItBudget.ts:33,47` 존재, 페이지는 `MOCK_ROWS`(`summary.vue:88`) |
| [T16] 목록 프로젝션 DTO | 4단계 get JOIN ✅(W2) / 목록 projection ❌ | `ProjectRepositoryImpl.java:64`/`CostRepositoryImpl.java:101` `selectFrom` 전체 엔티티 |

## 4. 안전 코드부채 2차 묶음 (W2b) — SAFE_BUNDLEABLE 항목

재검증에서 `SAFE_BUNDLEABLE=yes`로 확인된 8개 항목. 우선순위 렌즈 = 안전한 코드부채 묶음.

| # | 항목 | 유형 | 근거 |
| :--: | --- | --- | --- |
| a | `EvaluationService.buildUserMapFromEvaluations` N+1 → `findByEnoIn` | 코드(동작보존) | `EvaluationService.java:254-258` |
| b | `CommitteeService.buildUserMap` N+1 → `findByEnoIn` | 코드(동작보존) | `CommitteeService.java:244-246` |
| c | `FeasibilityService.replacePerformances()` `flush()` 명시 | 코드(소규모·방어적) | `FeasibilityService.java:175-190` (DELETE는 이미 즉시 실행 — 명시화) |
| d | `VariableNodeView` 삽입 직후 `resolveTokens`(LOADING 잔류 픽스) | 프론트(소규모) | `tiptap-content-extensions.ts:969-973` 삽입 시 `snapshot:''`, watcher는 `plan/[id].vue`에만 존재 |
| e | `EaiServiceTest` `umsTrSno=""`/비숫자 케이스 | 테스트 | `EaiServiceTest.java` 현 10건, parseInt 실패 경로 미커버 |
| f | `BoardMetaServiceTest` 커버리지 확대(현 6건) | 테스트 | `BoardMetaService` 단위테스트 6건으로 빈약 |
| g | HWPX/PDF/Excel 회귀 테스트 범위 확대 | 테스트 | `tests/unit/utils/hwpx*.test.ts`/`excel.test.ts`/`usePdfReport.test.ts` 존재, 범위 확대 |
| h | 12개 컨트롤러 클래스 JavaDoc 보강 | 문서 | §3.3 목록 |

> `findByEnoIn(Collection<String>)`은 `UserRepository`에 이미 존재(W2 Task 10에서 검증). a·b는 동일 패턴 복제.

## 5. 묶음 PR 구성 (위험도 + 저장소 분리)

| PR | 저장소 | 포함 | 성격 |
| :--: | --- | --- | --- |
| **PR-1** N+1 잔여 | it_backend | a + b | 동작보존, TDD |
| **PR-2** 백엔드 정리 | it_backend | c + e + f + h | 동작불변/테스트/문서 |
| **PR-3** 프론트 | it_frontend | d + g | 소규모 픽스 + 테스트 |

**원칙:** N+1 sweep 완결(W2 후속), 동작 불변 묶음 빠른 머지. PR-1·2(backend)와 PR-3(frontend) 병행 가능.

## 6. 검증

- **PR-1**: Mockito `verify(times(1)).findByEnoIn(...)` + `never().findByEno(...)` (W2 Task 10·`ReviewCommentServiceTest` 선례). 결과 맵 동등성(merge `(a,b)->a`, distinct) 보존. `EvaluationService`/`CommitteeService` 호출하는 public 메서드로 검증.
- **PR-2**: `flush()`는 동작 불변(DELETE 이미 즉시 실행); 테스트 추가는 기존 통과 유지 + 새 케이스 RED→GREEN; JavaDoc는 빌드 그린. 대상 테스트 클래스 `./gradlew test --tests`.
- **PR-3**: d는 삽입 직후 칩이 LOADING에 멈추지 않음 확인(타입체크+린트, 가능 시 vitest); g는 export 회귀 케이스 추가 후 `npm test`.
- **전체**: 백엔드 신규 실패 0건 확인(기존 8건 — CORS 속성해석 5·XCR Ccodem 2·Committee 상태전이 1 — 무관, 별도 `task_00754fe5` 추적).

## 7. 산출물 및 순서

- **Phase 0 (백로그 정비, parent repo)**: §3.1 종료 5건 → `TASK_DONE.md` 이관, §3.2 재범위/종료 5건, §3.3 문구 정정 4건. 로드맵 갱신(완료 반영, DECISION/EXTERNAL 잔여 명확화).
- **Phase 1~3**: PR-1 → PR-2 → PR-3.
- **순서**: Phase 0 → PR-1 → PR-2 → PR-3. Phase 0은 parent repo 단독 커밋.
- **실행**: 본 설계 승인 후 `writing-plans`로 실행 계획 작성 → subagent-driven 실행.

## 8. 범위 외 (별도 트랙)

- **DECISION**: 환율 환산 규칙 통일, `changeStatus` role 분기, 게시판 본문크기 정책, T18 통합테스트 전략(H2 vs Oracle), Access Token Blocklist, T10 Refresh Token 재사용 탐지, Bearer 헤더 폴백 운영 결정.
- **STILL_OPEN(기능 spec 필요, W3)**: Mock→API(`info/index`, budget 페이지 wiring), 게시판 서버 페이지네이션·첨부 UI/API·다운로드 카운트·댓글 첨부·깊이 캡·검색 최소길이, 사전협의 검토자/세션 영속화(인증연동 선행), authorTeam·첨부 매핑, Tiptap prop 확대·metadata 권한필터링, 실시간로그 드릴다운·필터저장, EAI 도메인 연동, 목록 프로젝션 DTO(T16).
- **EXTERNAL(KDB/DBA/운영)**: EAI IF_ID/UMS 발급·GWE 규칙, 인덱스/EXPLAIN(BASCTM/BCMMTM/BRDOCM/BRIVGM/실시간로그), 메타 PK 정합(BBUGTM/BRDOCM), 로그 보존정책, SSE/WebSocket·조회수 Redis·Oracle Text(Backlog).
