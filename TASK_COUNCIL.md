# IT정보화포탈 정보화실무협의회 잔여과제

## 관리 방식

정보화실무협의회(`/info/council`, API `/api/council`) 전용 과제의 단일 관리 문서입니다. 공통 과제는 [TASK.md](TASK.md), 협의회 완료·해소·감내·폐기 기록은 [TASK_COUNCIL_DONE.md](TASK_COUNCIL_DONE.md)에서 관리합니다.

- 기존 TASK와 동일하게 활성 과제만 아래 표에 유지하고, 검증을 마친 항목은 완료 파일로 옮깁니다. 일부만 구현하면 완료로 표시하지 않습니다.
- ID는 `COUNCIL-001`부터 순차 채번하며 두 파일을 합쳐 중복을 확인합니다. 코드 변경, 검증 결과, 미검증 범위를 완료 기록에 남깁니다.
- 과거 `PRD_c_날짜.md`는 요구사항 원본으로 보존하고, 새 작업 상태는 이 파일에서 관리합니다. 기존 PRD를 찾으면 실제 내용을 대조한 뒤 ID와 원문 링크를 연결합니다.
- 아래 초기 과제는 2026-09-20 사용자 요청과 현재 코드 비교 결과를 근거로 등록했습니다. 과거 PRD 원본 13건(`PRD_c_20260509`~`PRD_c_20260803`, `council-fk-erd.md`, `DESIGN_c_20260709_plan-council-mapping.md`, `PLAN_c_20260709_impl.md`)은 `prds/`·`prds/done/`에 미추적 파일로 보관하며 저장소에는 포함하지 않습니다. 과거 요구사항의 과제 이관은 2026-09-23에 PRD 원본 13건을 현재 코드와 대조해 완료했고, 미구현으로 확인된 항목은 COUNCIL-014~022로 등록했습니다(아래 "범위 밖 발견" 포함).

## 활성 과제

| ID | 우선순위 | 상태 | 과제 | 다음 조치 | 근거 문서 |
| --- | :------: | ---- | ---- | --------- | --------- |
| COUNCIL-034 | 높음 | 열림 | 정보보호관리자(ITPAD002)가 계획협의회 위원이어도 목록에 안 뜬다. `getCouncilList`의 정보보호관리자 분기는 사업 기반 조회 결과만 거르고, 계획협의회(02)는 관리자 분기에서만 따로 덧붙는다. 02 필수 위원 7팀에 정보보호기획(18301)이 있어 그 팀장이 ITPAD002면 자기 협의회가 영구 누락되고 일정·평가 진입이 막힌다 | 정보보호관리자 분기에 배정 위원인 02 협의회를 더한다. 주석이 이미 "심의유형 무관 배정 건"을 선언하므로 그 의도대로 맞춘다. 관리자·평가위원 분기와 중복되지 않는지 확인하고 해당 분기 02 테스트 추가 | [목록 조회](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java) |
| COUNCIL-035 | 높음 | 열림 | 협의회 알림 링크가 계획협의회에서 존재하지 않는 화면으로 간다. `CouncilNotifier`가 `/info/council/{협의회ID}`(타당성검토표 Step1)로 고정하는데 02는 그 단계가 없고 Step1 페이지에 02 분기가 0건이다. 위원 선정·일정 요청·결과서 검토·완료 알림이 빈 화면으로 떨어진다(COUNCIL-015 후속) | 알림 링크를 협의회 상태·심의유형에 맞는 단계 화면으로 보낸다. 프론트 `council-routing`의 규칙과 어긋나지 않게 맞추고, 02 링크 테스트를 `CouncilNotifierTest`에 추가 | [알림 발행기](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilNotifier.java) · [라우팅 규칙](it_frontend/app/features/council/request/council-routing.ts) |
| COUNCIL-036 | 중간 | 열림 | 계획협의회는 오신청 취소가 사실상 불가능하다. 취소 허용 상태는 작성중(01)·작성완료(02)뿐인데, 계획 상세의 신청 흐름이 생성 직후 `startPreparation`을 연달아 호출해 바로 개최준비(05)로 올린다. 잘못 신청한 02를 되돌릴 경로가 없다 | 02의 취소 허용 범위를 사용자와 확정한다(위원 편성 전인 05까지 허용할지). 확정 후 취소 서비스 상태 가드와 화면 버튼 노출 조건을 맞추고 경계 테스트 추가 | [취소](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilCancelService.java) · [신청 흐름](it_frontend/app/composables/usePlanDetailPage.ts) |
| COUNCIL-037 | 중간 | 열림 | 계획협의회 결과서 결재 신청서명이 사업명 대신 협의회ID로 찍힌다. 제목을 타당성검토표(BPOVWM)에서 찾는데 02는 그 문서가 없어 항상 fallback으로 떨어진다. 02가 실제로 도달하는 유일한 결재 단계라 결재함에서 바로 보인다 | 이미 있는 `CouncilSubjectName`(02는 '정보기술부문계획 수립/조정')을 결재 서비스에 주입해 쓴다. 02 신청서명 테스트 추가 | [결재 서비스](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilApprovalService.java) |
| COUNCIL-038 | 중간 | 열림 | 생략 처리의 사업 상태 갱신에 심의유형 가드가 없다. `skipCouncil`이 `ABUS_MNG_NO`를 사업번호로 넘기는데 02에서는 계획번호다. upsert라 키가 없으면 새로 넣으므로 계획번호를 키로 한 사업관계 행이 생길 수 있다. 지금은 결재완료(04) 상태 게이트로 02가 도달하지 못해 피해는 없지만 유일하게 남은 무가드 지점 | 신청·완료·취소와 같은 규칙으로 02를 건너뛴다. 02를 넣은 경계 테스트 추가 | [생략 처리](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java) |
| COUNCIL-039 | 중간 | 열림 | 심의유형별 API 오용이 서버에서 막히지 않는다. ① 사전·주요 Q&A는 화면에서만 02를 숨기고 서버는 분기가 없어 API 직접 호출 시 02에도 질의가 쌓인다 ② 02 전용 조회·저장(`plan-targets`·`plan-evaluation`)은 유형을 안 봐서 사업번호를 계획번호로 계획 조회에 넘긴다 ③ 일반 6항목 평가에 "02는 대상 아님" 가드가 없어 02 위원이 직접 호출하면 BEVALM에 무용한 행이 쌓인다 | 세 지점에 심의유형 가드를 넣고 거부 코드를 정한다. 프론트 노출 조건은 이미 맞으므로 정상 흐름 영향 없음. 오용 거부 테스트 추가 | [사전 Q&A](it_backend/src/main/java/com/kdb/it/domain/council/service/QnaService.java) · [계획 평가](it_backend/src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java) · [일반 평가](it_backend/src/main/java/com/kdb/it/domain/council/service/EvaluationService.java) |
| COUNCIL-040 | 낮음 | 열림 | 계획협의회 원장을 순번이 빈 복합키로 사업 조회에 넣는다. 목록·상세 변환 두 곳이 `new BprojmId(계획번호, null)`로 `findById`를 호출한다. 권한 가드는 순번 null을 조기 반환해 이 패턴을 피하는데 이 두 곳은 그대로 넘긴다. 항상 빈 결과로 떨어지는지가 드라이버·구현에 달려 있어, 예외가 나면 관리자 목록 전체가 깨진다 | 02는 사업 조회를 건너뛰도록 분기한다. 같은 자리의 정보보호 소요자원 존재 조회도 계획번호로 헛도므로 함께 정리. 02 원장으로 두 변환을 태우는 테스트 추가 | [목록·상세 변환](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java) |

ID 최대 번호(활성·완료 합산): COUNCIL-040.

COUNCIL-023~027은 2026-09-23 추가 코드 검토 결과와 사용자 기록 요청에 따라 등록했습니다. 구현·검증을 마친 COUNCIL-023~027은 완료 이력으로 옮겼습니다.
COUNCIL-015와 COUNCIL-030~033은 2026-09-26 구현·검증을 마쳐 완료 이력으로 옮겼습니다.
COUNCIL-034~040은 2026-09-26 심의유형 02 중심 코드 조사에서 찾은 결함과 확인 항목입니다.

## 범위 밖 발견 (2026-09-23 PRD 대조)

협의회 PRD에서 나왔지만 `/council` 밖 공통 코드·데이터에 속해 이 문서의 과제로 두지 않은 항목입니다. 필요하면 [TASK.md](TASK.md)에 옮깁니다.

- `GlobalExceptionHandler`의 `RuntimeException` 마스킹에서 `DataIntegrityViolationException`·`SQLException` 계열 분리(`prds/PRD_c_20260615.md`:6) — 공통 예외 처리.
- 전역 헤더 `SwitchUserDialog`(개발용 계정 전환) 운영 배포 전 제거(`prds/PRD_c_20260701.md`:131) — 협의회 화면의 진입점은 COUNCIL-008로 제거했고 `AppHeader`에 남아 있음.
- SNO 도메인 정합화(`Basctm.prjSno`·`BaseEntity.guidPrgSno` Integer 유지, `prds/done/PRD_c_20260518.md`:157) — `BPROJM.PRJ_SNO` 외부 PK와 함께 다뤄야 하는 공통 과제.
- 데이터·환경: 사업 논리삭제로 목록에서 빠진 고아 협의회(`ASCT-2026-0400`, `prds/PRD_c_20260803.md`:88), 테스트 시드 SQL(`test_data_council*.sql`) 저장소 부재.
- 문서: `PRD_c_20260620.md` Phase 5·6 `[TODO]`, `PRD_c_20260701.md` §1-2 `[TODO]`, `PLAN_c_20260709_impl.md` 1.1·1.2 "미적용" 표기는 코드상 완료된 상태(원본 보존 방침에 따라 수정하지 않음).
- 이미 해소된 것으로 확인: ITPAD002 배정 협의회 목록 누락, `formatBudget` 공용화, `CouncilNotice` 다운로드 401 갱신, `APG_FL_SZ` 마이그레이션, 결재 콜백 관리자 가드, 계획협의회 결과서 요약·겸직 간사 라벨, CCODEM 시드.
