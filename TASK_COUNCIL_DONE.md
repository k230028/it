# IT정보화포탈 정보화실무협의회 완료·종료 내역

[TASK_COUNCIL.md](TASK_COUNCIL.md)에서 분리한 완료·해소·감내·폐기 항목을 보관합니다. 공통 과제 이력은 [TASK_DONE.md](TASK_DONE.md)를 참조합니다.

| 상태 | 의미 |
| :--: | --- |
| ✅ Done | 구현 및 해당 범위 검증 완료 |
| ✔️ Resolved | 해소(거짓양성 등) |
| ☑️ Accepted | 근거를 기록하고 감내 |
| ⛔ Discarded | 사용자 범위 결정으로 폐기 |

검증 완료 후 날짜별로 `ID / 상태 / 조치 / 근거` 표와 검증 결과를 추가합니다.

## 2026-09-20

| ID | 상태 | 조치 | 근거 |
| --- | :--: | ---- | ---- |
| COUNCIL-001 | ✅ Done | `CouncilAccessGuard.verifyReadable`로 협의회 상세·타당성검토표 조회를 시스템관리자, 심의유형 04의 정보보호관리자, 활성 연결 사업의 주관부서, 해당 협의회 활성 배정위원으로 제한. `CouncilService.findReadableCouncil`을 사용자 상세 조회와 `FeasibilityService` 조회에 적용 | [설계](docs/superpowers/specs/done/2026-09-20-council-access-and-draft-protection.md) · [가드](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilAccessGuard.java) |
| COUNCIL-002 | ✅ Done | `CouncilAccessGuard.lockWritableDraft`가 `CouncilRepository.findByIdForUpdate`(`PESSIMISTIC_WRITE`, 잠금 3,000ms)로 원장을 잠근 뒤 수정 권한(관리자·정보보호 04·주관부서, 위원 자격 제외)과 작성중(`01`)·비계획협의회 상태를 검사. 권한 없음 403, 삭제·미존재 404, 비작성중·잠금 초과 409. `FeasibilityService` POST/PUT에 적용 | 동일 |

코드 변경: `it_backend` — `CouncilAccessGuard.java`(신규), `CouncilService.java`, `FeasibilityService.java`, `CouncilRepository.java`, `CouncilServiceTest.java`, `CouncilAccessBoundaryTest.java`(신규), `docs/guides/security/data-scope.md`. 요청·응답 DTO와 DB 스키마는 변경 없음.

검증 결과:

- `CouncilAccessBoundaryTest` 31건 통과 — 타 부서 조회·저장 거부, 비작성중 상태 덮어쓰기 거부, 주관부서 작성중 조회·저장, 작성완료 후 재저장 거부, 배정위원 조회 허용·타 부서 저장 거부, 관리자 작성완료본 덮어쓰기 거부, 정보보호관리자 심의유형 범위, 계획협의회 검토표 생성 거부, 부서·인증·사번 누락 거부, 비정상 principal 거부, 삭제 원장 저장 거부, 잠금 초과 409·미기록, HTTP POST/PUT 403·409.
- `com.kdb.it.domain.council.*` 27개 테스트 클래스 370건 통과, 실패 0.
- `spotlessJavaCheck` 통과.
- 백엔드 전체 `./gradlew test` 5,608건 통과, 실패 0, 건너뜀 2 (품질 게이트).

미검증 범위: Oracle 실제 잠금 대기 시간과 운영 사용자 연동은 별도 검증 대상. 작성중 동시 편집의 오래된 입력 덮어쓰기는 COUNCIL-012, 신규 신청과 다른 하위 API 권한은 COUNCIL-011, 프론트 편집 가능 상태·오류 안내 정렬은 COUNCIL-004·009에서 계속 관리.
| COUNCIL-011 | ✅ Done | `CouncilAccessGuard`에 `verifyManageable`·`verifyOwningOrManageable`·`verifyCommitteeOrManageable`·`verifyCreatable`을 추가하고 평가위원 편성(관리자, 상태 04·05만, 위반 409)·결재 상신(주관부서·관리자, 권한을 상태보다 먼저)·사전 Q&A 질문(배정위원·관리자)·협의회 신청(관리자 01/02/03/05, 정보보호관리자 04, 일반부서는 주관 사업 03·정보보호 항목 있으면 04, 관리자 04도 정보보호 항목 필요)에 적용 | [설계](docs/superpowers/specs/done/2026-09-20-council-write-boundaries-design.md) · [계획](docs/superpowers/plans/done/2026-09-20-council-write-boundaries.md) |

코드 변경(COUNCIL-011): `it_backend` — `CouncilAccessGuard.java`, `CommitteeService.java`, `CouncilApprovalService.java`, `QnaService.java`, `CouncilService.java`, `CouncilAccessBoundaryTest.java`, `CommitteeServiceTest.java`, `CouncilApprovalServiceTest.java`, `QnaServiceTest.java`. 사용자 승인으로 `common/approval/service/CouncilJsonlessApprovalWorkflowTest.java`의 생성자 목 인자 1개만 보강. 컨트롤러·DTO·DB·프론트 변경 없음.

검증 결과(COUNCIL-011):

- `CouncilAccessBoundaryTest` 58건 통과(기존 31건 + 신규 27건) — 가드 판정 행렬, 위원 편성 권한·상태(04·05 허용, 그 밖의 12개 상태 409), 결재 상신 권한 우선(403 → 400 순), Q&A 질문 위원·관리자, 신청 거부 시 채번·영속화 미호출, 인증 누락.
- `com.kdb.it.domain.council.*` 397건 통과, 실패 0.
- 백엔드 전체 `./gradlew test` 5,635건 통과, 실패 0, 건너뜀 2. `spotlessJavaCheck` 통과.

미검증 범위(COUNCIL-011): 사전 Q&A 질문의 단계별 허용 시점(상태 가드 미적용), 결재 상신 원장 잠금(COUNCIL-012), 조회 API 11개(COUNCIL-013), 운영 사용자 연동.
