# IT정보화포탈 정보화실무협의회 잔여과제

## 관리 방식

정보화실무협의회(`/info/council-request`, API `/api/council`) 전용 과제의 단일 관리 문서입니다. 공통 과제는 [TASK.md](TASK.md), 협의회 완료·해소·감내·폐기 기록은 [TASK_COUNCIL_DONE.md](TASK_COUNCIL_DONE.md)에서 관리합니다.

- 기존 TASK와 동일하게 활성 과제만 아래 표에 유지하고, 검증을 마친 항목은 완료 파일로 옮깁니다. 일부만 구현하면 완료로 표시하지 않습니다.
- ID는 `COUNCIL-001`부터 순차 채번하며 두 파일을 합쳐 중복을 확인합니다. 코드 변경, 검증 결과, 미검증 범위를 완료 기록에 남깁니다.
- 과거 `PRD_c_날짜.md`는 요구사항 원본으로 보존하고, 새 작업 상태는 이 파일에서 관리합니다. 기존 PRD를 찾으면 실제 내용을 대조한 뒤 ID와 원문 링크를 연결합니다.
- 아래 초기 과제는 2026-09-20 사용자 요청과 현재 코드 비교 결과를 근거로 등록했습니다. 과거 PRD 원본 13건(`PRD_c_20260509`~`PRD_c_20260803`, `council-fk-erd.md`, `DESIGN_c_20260709_plan-council-mapping.md`, `PLAN_c_20260709_impl.md`)은 `prds/`·`prds/done/`에 미추적 파일로 보관하며 저장소에는 포함하지 않습니다. 과거 요구사항의 과제 이관은 2026-09-23에 PRD 원본 13건을 현재 코드와 대조해 완료했고, 미구현으로 확인된 항목은 COUNCIL-014~022로 등록했습니다(아래 "범위 밖 발견" 포함).

## 활성 과제

| ID | 우선순위 | 상태 | 과제 | 다음 조치 | 근거 문서 |
| --- | :------: | ---- | ---- | --------- | --------- |
| COUNCIL-015 | 중간 | 보류 | 협의회 알림 연동 미구현 — ① 사전 Q&A 등록 시 추진부서 담당자 알림, ② 평가위원 선정·일정 응답 요청 시 위원 알림("알림은 추후구현"). 협의회 도메인에서 알림을 발행하는 곳은 생략 판정 결재 결과(`CouncilSkipService`) 1곳뿐 | 사용자가 알림을 보낼 위치·상황·대상을 결정한 뒤 착수(2026-09-23). 결정되면 공통 `common/notification` 아웃박스(`NotificationEvent`)로 발행 지점·수신자·문구 설계 → `QnaService.createQna`, `CommitteeService.saveCommittee`/일정 요청 흐름에 배선. 공통 알림 코드 수정이 필요하면 사용자 확인 | `prds/PRD_c_20260620.md`:5 · `prds/done/PRD_c_20260520.md`:320 |
| COUNCIL-017 | 중간 | 열림 | 결재 콜백 `PATCH /api/council/{id}/approval` 정리 — 프론트 호출처 없음(라이프사이클 API는 start·complete·skip·start-preparation·reopen만 PATCH), 결재 완료·회수는 `CouncilApprovalEventListener`가 이벤트로 처리. 관리자 가드는 있으나 사용되지 않는 진입점 | 공통 결재 시스템이 이 URL을 호출하지 않는지 확인 후 엔드포인트·`processApprovalCallback`·`ApprovalCallbackRequest` 제거, `CouncilRouteContractTest` 44→43 | `prds/PRD_c_20260701.md` §1-2 |
| COUNCIL-018 | 낮음 | 열림 | 목록 카드 문구 정리 요구 미반영 — '담당 협의회에 안건으로 상정합니다'(`council.list.hintNew`) 삭제, '상세보기' 보조링크(`council.list.detail`, `@detail`) 삭제. 2026-05-20 디자인 요구 4건 중 2건이 그대로 남아 있음 | 요구가 아직 유효한지 사용자 확인 → `index.vue` 카드 props·i18n 키 제거, `ProjectListCard` `detailLabel` 미전달 | `prds/done/PRD_c_20260520.md`:20-22 |
| COUNCIL-019 | 낮음 | 열림 | 사전·본회의 Q&A 응답의 질의자·답변자 성명(`usrNm`·`repNm`)이 항상 null — 프론트는 사번 노출을 제거(2026-08-04)해 현재 이름 없이 표시 | `UserRepository.findNameViewsByEnoIn` 배치 조회로 성명 채움(사번은 계속 비노출). 성명 표시가 개인정보 정책상 허용되는지 사용자 확인 | `prds/PRD_c_20260701.md`:132 · `prds/PRD_c_20260803.md`:57 |
| COUNCIL-020 | 낮음 | 열림 | 계획협의회 테스트 공백 — 조정 예산 최초/조정 비교 단위 테스트(`planBudgetDiff`), 계획→02 협의회→적정/유보→완료 전 구간 e2e 없음(현재 e2e는 스냅샷 손상 배너 Mock 검증뿐) | 예산 비교 util 단위 테스트, e2e 시나리오 1개(공통 API 목 필수) | `prds/PLAN_c_20260709_impl.md`:142-143 |
| COUNCIL-021 | 낮음 | 열림 | 코드 위생 잔여 4건(2026-07-01 보류) — `EmployeeSearchDialog` 자동/명시 임포트 혼재, `prepare/[id].vue` 탭 value 선언 순서(2→3→5→4), `FeasibilityService.getFeasibility` null 반환 미명시, `ResultService.getMyReviewStatus` 비위원·미검토 미구분 | 한 번에 정리. 동작 변경 없음, 타입·테스트로 확인 | `prds/PRD_c_20260701.md` §4·§5 |
| COUNCIL-022 | 낮음 | 열림 | 계획협의회(02) 일정확정 필수응답 팀 규칙 미확정 — `INFO_SYS_REQUIRED_TEM_CODES`(12004·18001)가 심의유형 구분 없이 적용됨 | 02 유형의 필수응답 팀을 사용자와 확정 → 유형별 Map으로 분리 | `prds/PLAN_c_20260709_impl.md`:56 |

ID 최대 번호(활성·완료 합산): COUNCIL-022.

## 범위 밖 발견 (2026-09-23 PRD 대조)

협의회 PRD에서 나왔지만 `/council` 밖 공통 코드·데이터에 속해 이 문서의 과제로 두지 않은 항목입니다. 필요하면 [TASK.md](TASK.md)에 옮깁니다.

- `GlobalExceptionHandler`의 `RuntimeException` 마스킹에서 `DataIntegrityViolationException`·`SQLException` 계열 분리(`prds/PRD_c_20260615.md`:6) — 공통 예외 처리.
- 전역 헤더 `SwitchUserDialog`(개발용 계정 전환) 운영 배포 전 제거(`prds/PRD_c_20260701.md`:131) — 협의회 화면의 진입점은 COUNCIL-008로 제거했고 `AppHeader`에 남아 있음.
- SNO 도메인 정합화(`Basctm.prjSno`·`BaseEntity.guidPrgSno` Integer 유지, `prds/done/PRD_c_20260518.md`:157) — `BPROJM.PRJ_SNO` 외부 PK와 함께 다뤄야 하는 공통 과제.
- 데이터·환경: 사업 논리삭제로 목록에서 빠진 고아 협의회(`ASCT-2026-0400`, `prds/PRD_c_20260803.md`:88), 테스트 시드 SQL(`test_data_council*.sql`) 저장소 부재.
- 문서: `PRD_c_20260620.md` Phase 5·6 `[TODO]`, `PRD_c_20260701.md` §1-2 `[TODO]`, `PLAN_c_20260709_impl.md` 1.1·1.2 "미적용" 표기는 코드상 완료된 상태(원본 보존 방침에 따라 수정하지 않음).
- 이미 해소된 것으로 확인: ITPAD002 배정 협의회 목록 누락, `formatBudget` 공용화, `CouncilNotice` 다운로드 401 갱신, `APG_FL_SZ` 마이그레이션, 결재 콜백 관리자 가드, 계획협의회 결과서 요약·겸직 간사 라벨, CCODEM 시드.
