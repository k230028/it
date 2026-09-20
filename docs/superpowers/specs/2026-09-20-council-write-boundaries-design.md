# 정보화실무협의회 쓰기 API 4개의 권한·상태 경계

- 과제: [COUNCIL-011](../../../TASK_COUNCIL.md)
- 선행: [COUNCIL-001·002 설계](done/2026-09-20-council-access-and-draft-protection.md) — `CouncilAccessGuard`와 403/404/409 관례를 그대로 잇는다.
- 범위: `POST/PUT /api/council/{id}/committee`, `POST /api/council`, `POST /api/council/{id}/approval`, `POST /api/council/{id}/qna`. 요청·응답 DTO, DB 스키마, 프론트 화면은 바꾸지 않는다. 조회 API 11개는 [COUNCIL-013](../../../TASK_COUNCIL.md)에서 다룬다.

## 문제

네 API는 활성 협의회 존재만 확인하거나 아무 검사도 하지 않는다. 프론트는 역할·상태에 따라 버튼을 숨기지만 서버는 직접 호출을 막지 못한다.

| API | 현재 서버 검사 | 노출 위험 |
| --- | --- | --- |
| 평가위원 편성 `POST/PUT committee` | 존재 확인 | 누구나 어느 협의회든 위원을 바꾸고, 일정 확정(06) 이후에도 바꿀 수 있다 |
| 협의회 신청 `POST /api/council` | 없음 | 아무 사업에 아무 심의유형으로 신청할 수 있다 |
| 결재 상신 `POST approval` | 상태 `02`만 | 타 부서·배정위원도 상신할 수 있다 |
| 사전 Q&A 질문 `POST qna` | 없음 | 무관한 사용자가 질문을 남길 수 있다 |

## 권한 행렬

역할은 합집합이다. "관리" = 시스템관리자 또는 심의유형 `04`의 정보보호관리자(`CouncilAccessGuard.canManage`). "주관부서" = 활성 연결 사업(`BPROJM`)의 `SVN_DPM_C`가 사용자 `BBR_C`와 같음(`isOwningDepartment`). 계획협의회(`02`)는 사업이 없으므로 주관부서 판정이 항상 거짓이다.

| API | 허용 | 상태 가드 | 거부 응답 |
| --- | --- | --- | --- |
| 평가위원 편성 | 관리 | `04`, `05`에서만 허용 | 권한 403 · 그 밖의 상태 409 |
| 협의회 신청 | 심의유형별로 아래 표 | 기존 중복 신청 검사 유지 | 권한 403 · 허용되지 않는 심의유형 403 |
| 결재 상신 | 관리 또는 주관부서. 배정위원 자격만으로는 불가 | 기존 `02` 검사 유지(400) | 권한 403 |
| 사전 Q&A 질문 | 관리 또는 해당 협의회 활성 배정위원 | 두지 않는다 | 권한 403 |

협의회 신청의 심의유형 허용 규칙은 프론트 `roleDbrTcSet`·`dbrTcOptions`와 같다.

| 신청자 | 허용 심의유형 | 추가 조건 |
| --- | --- | --- |
| 시스템관리자 | `01`, `02`, `03`, `05` | 없음 |
| 시스템관리자 | `04` | 대상 사업 소요자원에 정보보호 항목(`BITEMM.SECT_SYS_UTZ_YN='Y'`, 최종본)이 있음 |
| 정보보호관리자 | `04` | 없음 |
| 그 밖의 사용자 | `03` | 대상 사업의 주관부서가 본인 부서 |
| 그 밖의 사용자 | `04` | 위 조건에 더해 대상 사업 소요자원에 정보보호 항목이 있음 |

두 역할을 모두 가진 사용자는 두 행의 합집합이다. 정보보호 항목 판정은 심의유형 `04`에만 쓰이며 정보보호관리자는 면제된다. `02`는 사업이 아니라 계획을 대상으로 하므로 시스템관리자만 신청한다. 대상 사업이 없거나 삭제된 경우는 기존 흐름의 예외를 유지한다.

공통 거부: 미인증·다른 타입 principal·사번 누락은 403, 삭제·미존재 협의회는 기존 조회 예외를 따른다. 응답 본문은 공통 오류 처리기 형식을 사용한다.

## 설계

### `CouncilAccessGuard` 확장

기존 `verifyReadable`·`lockWritableDraft`와 같은 파일에 세 메서드를 추가한다. 인증 주체는 기존 `currentUser()`로 얻으므로 서비스 시그니처는 바꾸지 않는다.

| 메서드 | 판정 | 사용처 |
| --- | --- | --- |
| `verifyManageable(Basctm council)` | `canManage` | 평가위원 편성 |
| `verifyOwningOrManageable(Basctm council)` | `canManage` 또는 `isOwningDepartment` | 결재 상신 |
| `verifyCommitteeOrManageable(Basctm council)` | `canManage` 또는 활성 배정위원(`committeeRepository.findByItPtlAsctIdAndEnoAndDelYn`) | 사전 Q&A 질문 |
| `verifyCreatable(String dbrTc, String abusMngNo, Integer sno)` | 위 신청 표. 비관리자는 사업을 조회해 주관부서와 정보보호 항목을 판정 | 협의회 신청 |

`verifyCreatable`은 원장이 아직 없으므로 심의유형과 사업 키를 받는다. 정보보호 항목 판정은 `CouncilService`가 목록에서 쓰는 `ProjectItemRepository.existsByAbusMngNoAndSectSysUtzYnAndDelYn(abusMngNo, "Y", "N")`을 그대로 쓴다.

### 서비스 적용 지점

| 서비스 메서드 | 변경 |
| --- | --- |
| `CommitteeService.saveCommittee` | `findActiveCouncil` 뒤에 `verifyManageable`, 이어서 상태가 `04`·`05`가 아니면 `ResponseStatusException(409, "평가위원을 편성할 수 있는 상태가 아닙니다. 협의회를 다시 조회해 주세요.")`. 그 다음 기존 편성 로직 |
| `CouncilService.createCouncil` | 중복 신청 검사 앞에 `verifyCreatable(request.dbrTc(), request.prjMngNo(), request.prjSno())` |
| `CouncilApprovalService.requestApproval` | `findActiveCouncil` 뒤, 기존 `02` 검사 앞에 `verifyOwningOrManageable` |
| `QnaService.createQna` | 협의회 조회 뒤 `verifyCommitteeOrManageable` |

컨트롤러는 바꾸지 않는다. 기존 `CouncilLifecycleController`의 `verifyCouncilManager` 호출도 그대로 둔다.

### 잠금

평가위원 편성은 위원 행을 교체하지만 협의회 원장은 바꾸지 않으므로 002의 `PESSIMISTIC_WRITE` 잠금을 적용하지 않는다. 결재 상신은 기존 흐름이 원장 상태를 바꾸므로 잠금 도입 여부는 COUNCIL-012에서 함께 판단한다.

## 검증

`CouncilAccessBoundaryTest`에 같은 방식(Mockito, 실제 서비스·가드 조립)으로 추가한다.

- 평가위원 편성: 타 부서 일반 사용자 403, 배정위원 403, 정보보호관리자가 `03` 협의회 403·`04` 협의회 허용, 관리자 허용, 상태 `06`에서 관리자 409, 상태 `04`·`05` 허용.
- 협의회 신청: 일반 사용자가 타 부서 사업 `03` 403, 본인 부서 사업 `03` 허용, 본인 부서 사업 `04`는 정보보호 항목 없으면 403·있으면 허용, 일반 사용자 `01`/`02`/`05` 403, 정보보호관리자 `04` 허용·`03` 403, 관리자 `02` 허용.
- 결재 상신: 배정위원 403, 타 부서 403, 주관부서 허용, 정보보호관리자 `04` 허용.
- 사전 Q&A 질문: 무관한 사용자 403, 배정위원 허용, 관리자 허용, 정보보호관리자 `04` 허용·`03` 403.
- 공통: 미인증·사번 누락 403.

기존 `CommitteeServiceTest`·`CouncilServiceTest`·`CouncilApprovalServiceTest`·`QnaServiceTest`와 컨트롤러 테스트의 "인증된 사용자 → 200" 계약은 허용 주체로 로그인하도록 갱신한다. council 도메인 테스트, 백엔드 전체 `./gradlew test`, `spotlessJavaCheck`를 실행하고 결과를 `TASK_COUNCIL_DONE.md`에 남긴다.

## 비범위

- 조회 API 11개의 대상 권한 통일(COUNCIL-013)과 그에 따른 목록 페이지 `plan-targets` 호출 영향.
- 사전 Q&A 질문의 단계별 허용 시점. 탭 활성 규칙이 프론트에 분산돼 있어 서버 상태 가드는 두지 않는다.
- 작성중 동시 편집의 오래된 입력 감지(COUNCIL-012).
- 결재 상신의 `02` 검사 응답 코드(400) 변경.
- `/council` 밖 파일 수정. 공통 `OwnershipVerifier`·`ProjectItemRepository`는 호출만 한다.
