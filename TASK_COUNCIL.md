# IT정보화포탈 정보화실무협의회 잔여과제

## 관리 방식

정보화실무협의회(`/info/council`, API `/api/council`) 전용 과제의 단일 관리 문서입니다. 공통 과제는 [TASK.md](TASK.md), 협의회 완료·해소·감내·폐기 기록은 [TASK_COUNCIL_DONE.md](TASK_COUNCIL_DONE.md)에서 관리합니다.

- 기존 TASK와 동일하게 활성 과제만 아래 표에 유지하고, 검증을 마친 항목은 완료 파일로 옮깁니다. 일부만 구현하면 완료로 표시하지 않습니다.
- ID는 `COUNCIL-001`부터 순차 채번하며 두 파일을 합쳐 중복을 확인합니다. 코드 변경, 검증 결과, 미검증 범위를 완료 기록에 남깁니다.
- 과거 `PRD_c_날짜.md`는 요구사항 원본으로 보존하고, 새 작업 상태는 이 파일에서 관리합니다. 기존 PRD를 찾으면 실제 내용을 대조한 뒤 ID와 원문 링크를 연결합니다.
- 아래 초기 과제는 2026-09-20 사용자 요청과 현재 코드 비교 결과를 근거로 등록했습니다. 과거 PRD 원본 13건(`PRD_c_20260509`~`PRD_c_20260803`, `council-fk-erd.md`, `DESIGN_c_20260709_plan-council-mapping.md`, `PLAN_c_20260709_impl.md`)은 `prds/`·`prds/done/`에 미추적 파일로 보관하며 저장소에는 포함하지 않습니다. 과거 요구사항의 과제 이관은 2026-09-23에 PRD 원본 13건을 현재 코드와 대조해 완료했고, 미구현으로 확인된 항목은 COUNCIL-014~022로 등록했습니다(아래 "범위 밖 발견" 포함).

## 활성 과제

현재 활성 과제 없음.

ID 최대 번호(활성·완료 합산): COUNCIL-046.

COUNCIL-023~027은 2026-09-23 추가 코드 검토 결과와 사용자 기록 요청에 따라 등록했습니다. 구현·검증을 마친 COUNCIL-023~027은 완료 이력으로 옮겼습니다.
COUNCIL-015와 COUNCIL-030~033은 2026-09-26 구현·검증을 마쳐 완료 이력으로 옮겼습니다.
COUNCIL-034~040은 2026-09-26 심의유형 02 중심 코드 조사에서 찾은 결함과 확인 항목이며, 같은 날 구현·검증을 마쳐 완료 이력으로 옮겼습니다.
COUNCIL-041~045는 COUNCIL-034~040 반영 후 재점검에서 남은 알림 순서·동시성·중복 생성·입력검증·취소 경계 과제이며, 2026-09-26 구현·검증을 마쳐 완료 이력으로 옮겼습니다.
COUNCIL-046은 2026-09-27 브라우저 확인에서 드러난 위원 편성 화면의 심의유형 제약 누락이며, 같은 날 구현·검증과 사용자 화면 확인을 마쳐 완료 이력으로 옮겼습니다.

## 범위 밖 발견 (2026-09-23 PRD 대조)

협의회 PRD에서 나왔지만 `/council` 밖 공통 코드·데이터에 속해 이 문서의 과제로 두지 않은 항목입니다. 필요하면 [TASK.md](TASK.md)에 옮깁니다.

- `GlobalExceptionHandler`의 `RuntimeException` 마스킹에서 `DataIntegrityViolationException`·`SQLException` 계열 분리(`prds/PRD_c_20260615.md`:6) — 공통 예외 처리.
- 전역 헤더 `SwitchUserDialog`(개발용 계정 전환) 운영 배포 전 제거(`prds/PRD_c_20260701.md`:131) — 협의회 화면의 진입점은 COUNCIL-008로 제거했고 `AppHeader`에 남아 있음.
- SNO 도메인 정합화(`Basctm.prjSno`·`BaseEntity.guidPrgSno` Integer 유지, `prds/done/PRD_c_20260518.md`:157) — `BPROJM.PRJ_SNO` 외부 PK와 함께 다뤄야 하는 공통 과제.
- 데이터·환경: 사업 논리삭제로 목록에서 빠진 고아 협의회(`ASCT-2026-0400`, `prds/PRD_c_20260803.md`:88), 테스트 시드 SQL(`test_data_council*.sql`) 저장소 부재.
- `NotificationOutboxService.enqueue`가 ID를 채운 `Cinfmm`에 `saveAndFlush`를 써서 Spring Data JPA가 `merge()`로 처리한다(2026-09-27 발견, 사용자 결정으로 미수정). 알림번호가 이미 있으면 INSERT가 아니라 UPDATE가 나가 남의 알림을 덮어쓴다. 지금은 `DEL_YN` NOT NULL 제약이 `ORA-01407`로 막아 주지만, 제약이 없었다면 조용히 손실됐을 것이고 `NotificationEventListener`가 예외를 삼켜 사용자에게는 표시되지 않는다. `CommitteeService`가 같은 이유로 `save()` 대신 `entityManager.persist()`를 쓴다 — 공통 알림 코드라 `/council` 범위 밖.
- 문서: `PRD_c_20260620.md` Phase 5·6 `[TODO]`, `PRD_c_20260701.md` §1-2 `[TODO]`, `PLAN_c_20260709_impl.md` 1.1·1.2 "미적용" 표기는 코드상 완료된 상태(원본 보존 방침에 따라 수정하지 않음).
- 이미 해소된 것으로 확인: ITPAD002 배정 협의회 목록 누락, `formatBudget` 공용화, `CouncilNotice` 다운로드 401 갱신, `APG_FL_SZ` 마이그레이션, 결재 콜백 관리자 가드, 계획협의회 결과서 요약·겸직 간사 라벨, CCODEM 시드.
