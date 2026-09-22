# IT정보화포탈 정보화실무협의회 잔여과제

## 관리 방식

정보화실무협의회(`/info/council-request`, API `/api/council`) 전용 과제의 단일 관리 문서입니다. 공통 과제는 [TASK.md](TASK.md), 협의회 완료·해소·감내·폐기 기록은 [TASK_COUNCIL_DONE.md](TASK_COUNCIL_DONE.md)에서 관리합니다.

- 기존 TASK와 동일하게 활성 과제만 아래 표에 유지하고, 검증을 마친 항목은 완료 파일로 옮깁니다. 일부만 구현하면 완료로 표시하지 않습니다.
- ID는 `COUNCIL-001`부터 순차 채번하며 두 파일을 합쳐 중복을 확인합니다. 코드 변경, 검증 결과, 미검증 범위를 완료 기록에 남깁니다.
- 과거 `PRD_c_날짜.md`는 요구사항 원본으로 보존하고, 새 작업 상태는 이 파일에서 관리합니다. 기존 PRD를 찾으면 실제 내용을 대조한 뒤 ID와 원문 링크를 연결합니다.
- 아래 초기 과제는 2026-09-20 사용자 요청과 현재 코드 비교 결과를 근거로 등록했습니다. 과거 PRD 원본 13건(`PRD_c_20260509`~`PRD_c_20260803`, `council-fk-erd.md`, `DESIGN_c_20260709_plan-council-mapping.md`, `PLAN_c_20260709_impl.md`)은 `prds/`·`prds/done/`에 미추적 파일로 보관하며 저장소에는 포함하지 않습니다. 과거 요구사항의 과제 이관은 아직 완료되지 않았습니다.

## 활성 과제

| ID | 우선순위 | 상태 | 과제 | 다음 조치 | 근거 문서 |
| --- | :------: | ---- | ---- | --------- | --------- |
| COUNCIL-012 | 중간 | 열림 | 작성중 동시 편집의 오래된 입력 덮어쓰기 방지 | 행 잠금과 별도로 조회 시점 스탬프·충돌 해소 계약 설계 | [예산사업 선례](it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectConcurrencyGuard.java) |
| COUNCIL-013 | 높음 | 열림 | 조회 API 11개의 대상 권한 통일: 위원 목록·평가 전체·계획대상·계획평가 전체·결과요약·일정현황·Q&A·주요Q&A 목록·생략요청(건·전체) | `findReadableCouncil` 정책 적용 전 프론트 호출 영향 분석(목록 페이지의 계획협의회 `plan-targets` 호출 등), 관리자 범위가 맞는 항목 구분 | [가드](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilAccessGuard.java) |

ID 최대 번호(활성·완료 합산): COUNCIL-013.
