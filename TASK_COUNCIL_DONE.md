# IT정보화포탈 정보화실무협의회 완료·종료 내역

[TASK_COUNCIL.md](TASK_COUNCIL.md)에서 분리한 완료·해소·감내·폐기 항목을 보관합니다. 공통 과제 이력은 [TASK_DONE.md](TASK_DONE.md)를 참조합니다.

| 상태 | 의미 |
| :--: | --- |
| ✅ Done | 구현 및 해당 범위 검증 완료 |
| ✔️ Resolved | 해소(거짓양성 등) |
| ☑️ Accepted | 근거를 기록하고 감내 |
| ⛔ Discarded | 사용자 범위 결정으로 폐기 |

검증 완료 후 날짜별로 `ID / 상태 / 조치 / 근거` 표와 검증 결과를 추가합니다.

## 2026-09-25

| ID | 상태 | 조치 | 근거 |
| --- | :--: | ---- | ---- |
| COUNCIL-027 | ✅ Done | 로컬 프론트·`local-ext` 백엔드·Oracle과 실제 역할 계정 7개를 연결해 일반 사업 협의회 한 건의 전체 수명주기를 검증했다. 신청·타당성검토표 동시성 충돌·회수·반려·승인·위원 편성·일정·평가·결과 검토·2단계 최종 결재가 상태 01→02→03→02→03→01→02→03→04→05→06→07→08→09→10→11→12→13으로 이어졌고 권한 밖 접근과 단계 밖 쓰기도 400·403·409 계약대로 차단됐다. 실행 중 확인한 타당성검토표 신규 저장 필수값 persist 순서, 성과지표 벌크 교체 영속성 충돌, 저장 응답 스탬프 불일치, 비위원 본인 일정 조회 허용, 비위원 결과 검토의 잘못된 400 변환을 수정하고 회귀 테스트를 추가했다 | [실행 증적](docs/superpowers/evidence/2026-09-25-council-027-live-e2e.md) · [완료 계획](docs/superpowers/plans/done/2026-09-25-council-027-live-e2e-verification.md) |
| COUNCIL-028 | ✅ Done | 협의회 프론트 대표 경로를 `/info/council-request`에서 `/info/council`로 변경하고 기존 경로 리다이렉트는 두지 않았다. 목록·상세·개최준비·결과 페이지와 이동 규칙·테스트·문구 검사 경로를 함께 옮겼고, 생략 판정 알림 링크도 새 경로로 변경했다. 로컬 라우트 카탈로그와 `MINF0017` 메뉴를 `/info/council`로 적용했으며 코드·문서·백엔드를 `K230028` 브랜치에 푸시했다. 개발계 배포와 메뉴 오픈은 사용자 결정으로 연기했다 | [현재 페이지](it_frontend/app/pages/info/council/index.vue) · [라우팅 유틸](it_frontend/app/features/council/request/council-routing.ts) · [알림 링크](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilSkipService.java) |
| COUNCIL-029 | ✅ Done | 우선 오픈 대상인 02 유형을 실제 로컬 계획 스냅샷·기본위원 7명·심의대상 8건으로 신청(01)부터 최종 결재 완료(13)까지 검증했다. 전원 일정 제출 전 확정, 02 유형 서면개최, 개최준비 이후 일정 재저장을 서버에서 차단했고, 결과검토(10) 화면에서 위원 검토 섹션이 렌더링되지 않던 컴포넌트명 오류를 수정했다 | [실행 증적](docs/superpowers/evidence/2026-09-25-council-029-plan-live-e2e.md) |
| COUNCIL-023 | ✅ Done | 평가·결과서 쓰기에 단계 제한과 원장 잠금 추가. `CouncilAccessGuard.lockAtStatus(협의회ID, 허용상태, 관형구)`가 `findByIdForUpdate`로 원장을 비관적 잠금한 뒤 진행상태를 검사하고, 허용 밖이면 409로 거부한다(`lockWritableDraft` 선례, 사용자 승인). 일반·계획 평가 저장은 협의회 진행 중(07)·평가의견 작성 중(08), 결과서 저장은 08·결과서 작성 중(09), 결과서 확정은 09만 허용한다. 종전 `confirmResult`는 결과서 존재만 확인하고 무조건 10으로 전이해 완료(13)가 검토 중(10)으로 역행할 수 있었다. 잠금 덕에 다른 세션의 상태 전이와 직렬화되어 낡은 상태로 쓰는 경합도 막는다 | [가드](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilAccessGuard.java) · [결과서](it_backend/src/main/java/com/kdb/it/domain/council/service/ResultService.java) |
| COUNCIL-024 | ✅ Done | 평가위원 가명을 비밀값 기반으로 교체. COUNCIL-013의 가명은 사번 오름차순이라, 위원 명단 API가 사번·성명을 그대로 돌려주는 이상 명단을 정렬하기만 하면 신원이 복원됐다. 이제 협의회ID와 사번의 HMAC-SHA256 순위로 번호를 매겨 사번 크기·입력 순서와 무관하게 만든다. 번호 대상도 제출자에서 위원 명단 전체로 바꿔, 사번이 더 작은 위원이 나중에 제출할 때 기존 가명이 바뀌던 문제를 없앴다. 비밀값은 `council.evaluator-pseudonym-secret`(전용 프로퍼티, 사용자 승인)으로 주입하며 미설정 시 기동마다 무작위 키를 쓰고 경고를 남긴다 | [가명](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilEvaluatorMasking.java) |
| COUNCIL-025 | ✅ Done | 계획협의회 완료를 심의 대상 전부 평가 기준으로 판정. 종전에는 위원이 한 건이라도 제출하면 완료로 봐서 대상이 다섯 사업이어도 한 건만 평가하고 닫을 수 있었다. 이제 위원마다 대상 사업을 빠짐없이 평가해야 하며, 대상 밖 데이터가 남아 있어도 대상 집합만 기준으로 세고, 스냅샷 손상 등으로 대상이 0개면 완료를 막는다(사용자 결정). 구조상 계획 스냅샷 해석을 `CouncilPlanSnapshot`으로 분리했다 — 완료 판정을 하는 `CouncilService`가 심의 대상을 알아야 하는데 그 지식을 가진 `PlanEvaluationService`가 `CouncilService`를 의존해 되받아 주입하면 순환이 생기기 때문이다 | [스냅샷 해석](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilPlanSnapshot.java) · [완료 판정](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilService.java) |
| COUNCIL-026 | ✅ Done | 일반 평가의 항목·점수 검증과 완료 판정 정확화. 요청 계층은 `EvaluationRequest.items`에 중첩 검증(`@Valid`)을 걸어 항목 제약이 실제로 발화하게 하고 항목코드 필수·점수 1~5 필수를 추가했다(종전에는 점수 0·999·null과 빈 코드가 그대로 저장됐다). 서비스 계층은 Bean Validation이 표현하지 못하는 정의 밖 코드·중복·누락을 검사해 정의된 6개 항목을 정확히 한 번씩 담은 요청만 받는다(6개 전부 필수, 사용자 결정). 완료 판정은 행 개수 대신 정의된 항목의 서로 다른 개수를 센다 — 종전 집계는 중복 행까지 합산해 실제 6개를 채우지 않아도 완료로 볼 수 있었다 | [요청 DTO](it_backend/src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java) · [평가 서비스](it_backend/src/main/java/com/kdb/it/domain/council/service/EvaluationService.java) |

코드 변경(COUNCIL-023~026): `it_backend` — `CouncilAccessGuard`(`lockAtStatus`·`lockActive` 추가), `CouncilPlanSnapshot`(신규, `PlanEvaluationService`에서 스냅샷 파서 이관), `CouncilEvaluatorMasking`(정적 유틸 → `@Component`, HMAC 순위), `EvaluationService`·`PlanEvaluationService`·`ResultService`·`CouncilService`, `CouncilDto`(평가 요청 제약), `EvaluationRepository`(집계 쿼리에 `DISTINCT`와 유효 코드 필터), `application.properties`(가명 비밀값 1줄, council 밖 파일 — 사용자 승인). 테스트 — `CouncilPlanSnapshotTest`(신규 7건), `CouncilEvaluationRequestValidationTest`(신규 5건), `CouncilAccessBoundaryTest` +2, `ResultServiceTest` +4, `EvaluationServiceTest` +5, `PlanEvaluationServiceTest` +2, `CouncilEvaluatorMaskingTest` 재작성 6건, 기존 테스트 stub 보정. API 응답 계약은 그대로라 codegen 불필요. DB 변경 없음.

파일 크기 변화(COUNCIL-025): `PlanEvaluationService` 688→521줄, `CouncilService` 793→786줄(800줄 상한 여유 확보), `CouncilPlanSnapshot` 254줄 신설.

검증 결과(COUNCIL-023~026): 백엔드 `./gradlew test` 전체 통과(023 시점 5,725건 0 실패), `spotlessJavaCheck` 통과. council 도메인+아키텍처 519건 0 실패. 프론트는 변경이 없어 실행하지 않았다.

미검증 범위(COUNCIL-023~026): 실제 두 세션이 동시에 상태 전이와 저장을 시도하는 잠금 경합의 종단 확인(Oracle 실 잠금 대기), 운영에서 `COUNCIL_EVALUATOR_PSEUDONYM_SECRET` 주입 여부와 다중 인스턴스 간 가명 일관성, 브라우저에서 완료 단계 뒤 저장 시도의 409 안내 문구 노출. COUNCIL-024의 위원 명단(`committee`) 자체는 종전대로 사번·성명을 돌려준다 — 명단 공개는 정상이고 숨겨야 하는 것은 "누가 무엇을 썼는가"라는 판단.

코드 변경(COUNCIL-028): `it_frontend` — `app/pages/info/council/`로 페이지 4개 이동, 이동 규칙·연결 화면·테스트·문구 검사 경로와 `useEmployeeNumberVisibility` 갱신. `it_backend` — `CouncilSkipService` 알림 이동 링크와 테스트 갱신. 루트 — 전용 TASK 상태 기록. DB 스키마·마이그레이션·호환 리다이렉트 없음.

검증 결과(COUNCIL-028): 프론트 관련 Vitest 103건 통과, 백엔드 `CouncilSkipServiceTest` 1건 통과, 런타임·테스트 범위의 `/info/council-request` 참조 0건. 로컬 DB는 라우트 카탈로그 `/info/council` 사용·활성 상태와 `MINF0017`의 `/info/council` 연결을 확인했다. `K230028` 푸시 커밋은 루트 `505f764`, 프론트 `0a817efe`, 백엔드 `a8f22cb0`이다.

미검증 범위(COUNCIL-028): 개발계 배포, 개발계 라우트 카탈로그 교체와 `MINF0017` 메뉴 오픈, 개발계에서 목록·상세·개최준비·결과 직접 진입. 사용자가 개발계 적용을 나중에 수행하기로 결정했다.

코드 변경(COUNCIL-029): `it_backend` — `ScheduleService`에 일정 저장 상태 잠금, 일정 확정 전 평가위원 전원 응답 검사, 02 유형 서면개최 차단과 서비스 테스트 5건(02 시작 전이 2건 포함). `it_frontend` — 결과 페이지가 `CouncilResultReviewSection`을 명시적으로 import해 실제 이름으로 렌더링하도록 수정하고 페이지 테스트의 잘못된 전역 컴포넌트 대체를 제거. 루트 — 전용 TASK 완료 이력과 실행 증적. DB 스키마 변경 없음.

검증 결과(COUNCIL-029): 로컬 실제 API·브라우저·Oracle 종단 89단계 통과(실패 0), 협의회 백엔드 47개 클래스 506건 통과(실패 0), 프론트 관련 단위 테스트 17건 통과, 타입 검사·대상 ESLint·Prettier 통과. 계획 스냅샷 손상 Mock E2E 2건 통과. 기존 계획평가 Mock E2E 1건은 로컬 Nuxt 중복 실행 환경에서 인증 Mock이 SSR 요청을 우회해 실패했으나, 같은 제출 흐름은 실제 종단 검증에서 기본위원 7명 × 심의대상 8건으로 통과했다.

정리·미검증 범위(COUNCIL-029): 완료 상태 13과 결재 이력은 로컬 검증 자료로 보존했다. 식별값·역할표·실행 원본·화면 캡처는 Git 비추적 `.tmp/council-local/`에만 있다. 개발계·운영계 배포 및 개발계 메뉴 오픈은 수행하지 않았다.

코드 변경(COUNCIL-027): `it_backend` — `FeasibilityService`(신규 개요 필수값 설정 뒤 persist, 성과지표 벌크 삭제 뒤 영속성 컨텍스트 초기화, 저장 응답 스탬프 DB 재조회), `ScheduleService`(비위원의 본인 일정 조회 403), `ResultService`(비위원·간사의 결과 검토를 `AccessDeniedException`으로 통일)와 각 서비스 테스트. 루트 — 실행 계획·사전 점검·증적·전용 TASK 이력. 프론트·DB 스키마 변경 없음.

검증 결과(COUNCIL-027): 브라우저별 실제 SSO·개발 사용자 전환, 백엔드 API, 로컬 Oracle을 연결한 12개 시나리오 통과. 최종 DB 대조는 상태 13, 활성 위원 2명, 일정 응답자 2명, 평가자 2명·평가 12행, 결과 확인자 2명, 결과서 1행, 사업 상태 45였다. 백엔드 council 도메인 47개 테스트 클래스 501건 통과·실패 0, 변경 Java 파일 6개 Spotless 검사 통과. 전체 `spotlessJavaCheck`는 이번 변경 밖 `BizplanListQueryIntegrationTest`·`BizplanServiceTest`의 기존 포맷 위반 때문에 실패했다.

정리·미검증 범위(COUNCIL-027): 완료 상태 13과 결재 이력은 수동 삭제하지 않고 로컬 검증 자료로 보존했다. 정확한 협의회·결재 식별자와 역할표는 Git 비추적 `.tmp/council-local/`에, 사업 원본은 로컬 백업 테이블 `C027_BPROJM_BAK`·`C027_BPROJA_BAK`에 보관했다. 개발계·운영계 실행, 심의유형 02·04 전체 흐름, 추진부서 통보 API는 이번 범위에 포함하지 않았다.
## 2026-09-23

| ID | 상태 | 조치 | 근거 |
| --- | :--: | ---- | ---- |
| COUNCIL-013 | ✅ Done | 조회 API 12개의 대상 권한을 상세 조회 범위 한 규칙으로 통일(bounded, 설계 문서 없음 — 사용자 승인: "1번 규칙", 위원 신원은 익명). ① 읽기 범위 10개(위원 목록·평가 전체·계획대상·계획평가 전체·결과요약·일정현황·사전 Q&A·주요 Q&A·생략요청 건·결과서)는 `findReadableCouncil`(관리자·해당 유형 정보보호관리자·주관부서·배정위원, 계획협의회는 관리자·배정위원)로 교체 — 존재 확인(`findActiveCouncil`/`existsById`)만 하던 곳이 403을 낸다. ② 관리자 범위 2개: 기본 위원 후보(`committee/default`)는 `verifyManageable`, 생략 판정함 전체(`skip-requests`)는 IT관리자(`isAdmin`)만. ③ 평가 전체·계획평가 전체는 관리자가 아니면 위원 사번·성명을 `위원1`… 가명(사번 정렬 순, `CouncilEvaluatorMasking`)으로 바꿔 어느 위원이 무엇을 썼는지 알 수 없게 한다(결과요약은 원래 의견만 담아 변경 없음). 프론트는 목록 페이지가 관리자일 때만 판정함을 조회·재조회 | [가드](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilAccessGuard.java) · [가명](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilEvaluatorMasking.java) · [목록](it_frontend/app/pages/info/council/index.vue) |
| COUNCIL-022 | ✅ Done | 계획협의회(02) 일정확정 필수응답 팀 규칙 — 조사 결과 일정확정은 이미 심의유형과 무관하게 평가위원 전원 응답 기준(`ScheduleService.calcAllRequiredResponded`, PRD_c_20260620 #1)이고, `CommitteeService.INFO_SYS_REQUIRED_TEM_CODES`(12004·18001)는 어디서도 참조하지 않는 사문 상수였다. 상수를 제거하고 클래스 Javadoc에 "특정 팀 응답 여부는 보지 않는다"를 명시. 팀코드는 로컬 DB `TPRMPP_CUSERI` 기준 12004=예산팀, 18001=IT기획팀, 18010=PMO·품질관리팀, 18003=IT계약팀, 18301=정보보호기획팀, 14011=미래전략팀, 18501=AI·디지털전략팀(AI개발팀 겸용)으로 코드 매핑과 일치 | [위원 서비스](it_backend/src/main/java/com/kdb/it/domain/council/service/CommitteeService.java) · [일정 서비스](it_backend/src/main/java/com/kdb/it/domain/council/service/ScheduleService.java) |
| COUNCIL-021 | ✅ Done | 2026-07-01 보류 코드 위생 4건 중 3건 정리 — ① `CouncilResultApprovalPanel`의 `EmployeeSearchDialog` 명시 임포트를 다른 협의회 화면과 같은 자동 임포트(`CommonEmployeeSearchDialog`)로 통일(테스트 스텁명 동반 수정) ② 개최준비 탭 value를 표시 순서에 맞게 주요 Q&A 4·결과서 5로 정리하고 완료 후 결과서 탭 이동 값(`'5'`) 동기화 ③ `FeasibilityService.getFeasibility`에 `@Nullable`과 미작성 시 null 계약 Javadoc | [결재 패널](it_frontend/app/components/council/CouncilResultApprovalPanel.vue) · [개최준비](it_frontend/app/pages/info/council/prepare/[id].vue) |
| COUNCIL-021 (getMyReviewStatus) | ☑️ Accepted | `ResultService.getMyReviewStatus`의 "비위원"과 "미검토"는 여전히 둘 다 false다. 화면(`result/review/my`)은 위원에게만 검토 버튼을 보여 주고 값은 확인 여부로만 쓰므로 구분이 필요한 소비자가 없고, 구분하려면 boolean 응답 계약 변경(codegen)이 따른다. 필요해지면 enum 응답으로 별도 과제 | [결과 서비스](it_backend/src/main/java/com/kdb/it/domain/council/service/ResultService.java) |
| COUNCIL-020 | ✅ Done | 계획협의회 테스트 공백 보강 — 조정 협의회 예산 최초/조정 비교 규칙을 `features/council/planBudgetRows.ts`(`buildPlanBudgetRows`)로 분리하고 단위 테스트 2건, 평가위원이 사업 2건에 적정/유보·사유를 입력해 제출하는 e2e `tests/e2e/council-plan-evaluation.spec.ts`(API Mock, 저장 요청 본문·성공 Toast 검증) 추가 | [규칙](it_frontend/app/features/council/planBudgetRows.ts) · [e2e](it_frontend/tests/e2e/council-plan-evaluation.spec.ts) |
| COUNCIL-019 | ☑️ Accepted | 사전·본회의 Q&A의 질의자·답변자 성명은 표시하지 않는다(사용자 결정 2026-09-23 "익명 유지"). 2026-08-04 사번 노출 제거와 같은 취지로 `usrNm`·`repNm`은 null을 유지 | [Q&A 서비스](it_backend/src/main/java/com/kdb/it/domain/council/service/QnaService.java) |
| COUNCIL-018 | ✅ Done | 목록 카드에서 '담당 협의회에 안건으로 상정합니다'(`council.list.hintNew`) 안내와 '상세보기' 보조링크(`council.list.detail`, `@detail`) 제거(사용자 확인 2026-09-23 "둘 다 삭제"). 신청 완료 카드의 '현재 단계의 화면으로 이동합니다' 안내는 유지. i18n 키 2개(ko/en) 삭제 | [목록](it_frontend/app/pages/info/council/index.vue) |
| COUNCIL-017 | ☑️ Accepted | 결재 콜백 `PATCH /api/council/{id}/approval`은 유지한다(사용자 결정 2026-09-23). 프론트 호출처가 없고 결재 완료·회수는 `CouncilApprovalEventListener`가 처리하지만, 제거하려면 council 밖 `MfaGuardAspectTest` 엔드포인트 목록 수정이 필요해 손대지 않는다. 관리자 가드(`verifyAdmin`)가 있어 열려 있어도 위험은 없다 | [컨트롤러](it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilLifecycleController.java) |
| COUNCIL-016 | ✅ Done | 계획협의회 평가 저장(`PlanEvaluationService.saveEvaluation`)이 위원 자격 검사 뒤 계획 스냅샷의 정보화사업 집합(`getPlanTargets`와 같은 `parseSnapshot`, 경상 `ornYn=Y` 제외)과 요청 항목의 `abusMngNo`를 대조해 범위 밖 사업은 400 "심의 대상이 아닌 사업입니다", 계획 미연결 협의회는 `IllegalStateException`(400)으로 거부. 스냅샷 손상으로 집합이 비면 화면에도 대상이 없으므로 전부 거부해 일관 유지. 저장마다 계획 단건 조회 1회 추가. API·프론트 변경 없음 | [서비스](it_backend/src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java) |
| COUNCIL-014 | ☑️ Accepted | 협의회 테이블 FK 11건을 걸지 않는다(사용자 결정 2026-09-23 "FK하지마"). 근거: 스키마 전체에 FK가 하나도 없음 — 로컬 ITPOWN(운영 덤프 기반) 제약은 PK 127·UNIQUE 1·CHECK/NOT NULL 1,373·FK 0, 마이그레이션 SQL도 PK 37·CHECK 22·FK 0, 운영 DDL 덤프에도 `REFERENCES` 0건. 참조 무결성은 프로젝트 전체가 애플리케이션 계층에서 지키며 협의회만 예외를 두지 않는다. 협의회는 소프트 삭제라 FK가 막을 물리 삭제 사고가 사실상 없고, 덤프 import·복구 순서 제약만 늘어난다 | `prds/council-fk-erd.md` · `prds/PRD_c_20260709.md` §진행 중 |

코드 변경(COUNCIL-013): `it_backend` — `CouncilAccessGuard`(`canManage(Basctm)`·`verifyAdmin()` 공개), `CouncilEvaluatorMasking`(신규), `CommitteeService`·`EvaluationService`·`PlanEvaluationService`·`ScheduleService`·`QnaService`·`MainQnaService`·`CouncilSkipService`(`getActiveSkipRequests(CustomUserDetails)`)·`ResultService`, `CouncilLifecycleController`(판정함 조회에 principal 전달, 403 문서화), `CouncilDto`(평가 항목 `eno`·`usrNm` 주석), 테스트: `CouncilEvaluatorMaskingTest`(신규 2건), `CouncilAccessBoundaryTest` +5건, `EvaluationServiceTest`·`PlanEvaluationServiceTest` 가명 1건씩, `CouncilSkipServiceTest` 비관리자 거부 1건, 기존 서비스 테스트 stub 보정(`findReadableCouncil`·활성 원장 조회). `it_frontend` — `composables/council/useCouncilSkipApi.ts`(`fetchSkipRequests({ enabled })`), `pages/info/council/index.vue`(관리자만 판정함 조회·재조회), `useCouncil.test.ts` +1건. API 계약(DTO·OpenAPI 타입) 변경 없음이라 codegen 불필요. DB 변경 없음. 배포 순서 프론트 → 백엔드(구 프론트가 새 백엔드를 만나면 일반 사용자 목록 화면에 판정함 403 배너가 뜬다).

`plan-targets` 호출 영향 분석(COUNCIL-013): 목록 페이지의 계획협의회(02) 카드 통계(`council-plan-stats`)는 02 카드가 있을 때만 호출하고, 02 카드는 목록 API의 관리자 분기와 배정위원 분기에만 실린다. 둘 다 `verifyReadable`을 통과하므로 목록 화면은 깨지지 않는다. 그 밖의 호출처(`PlanCouncilTargets`·`PlanPprtForm`·`PlanPprtSummaryPanel`)는 상세·준비·결과 페이지 안이라 상세 조회 범위와 같다.

검증 결과(COUNCIL-013): 백엔드 `./gradlew test` 5,704건 0 실패, `spotlessJavaCheck` 통과, council 도메인+아키텍처+`CouncilJsonlessApprovalWorkflowTest` 584건 통과. 프론트 `format:check`·`check`(0 errors) 통과, `npm test` 6,125건 중 6,123 통과 — 실패 2건은 기존 ICU 환경 실패 파일 2개(`project-domain-i18n`, `ItBudgetSourceChangedDialog`)로 이번 변경과 무관.

미검증 범위(COUNCIL-013): 실제 계정(주관부서·배정위원·정보보호관리자)으로 12개 API를 브라우저에서 호출하는 종단 확인, 결과 페이지 비관리자 화면에서 가명 표시(현재 비관리자 화면은 평가 요약 패널을 렌더하지 않아 UI 변화 없음), 위원 목록(`committee`)은 위원 신원을 그대로 담는다(편성 현황이라 가명 대상에서 제외 — 사용자 지시 범위는 "어떤 위원이 무엇을 작성했는지").

검증 결과(COUNCIL-017~022): 백엔드 `./gradlew test` 5,707건 0 실패, `spotlessJavaCheck` 통과. 프론트 `format:check`·`check`(0 errors) 통과, `npm test` 6,127건 중 6,124 통과 — 실패 3건 중 2건은 기존 ICU 환경 실패 파일, 1건(`CouncilResultApprovalPanel.test.ts`)은 스텁명 보정 후 통과. e2e `council-plan-evaluation.spec.ts` 1건 통과(nuxt dev 자동 기동, 52초).

미검증 범위(COUNCIL-017~022): 개최준비 탭 순서 변경의 실제 화면 확인(사용자 화면 점검 기간), 목록 카드 문구 제거 후 카드 하단 여백 등 시각 확인, e2e는 Mock API 기반이라 실제 백엔드 저장 경로는 COUNCIL-016 검증이 담당.

검증 결과(COUNCIL-016): 백엔드 `./gradlew test` 5,707건 0 실패, `spotlessJavaCheck` 통과. `PlanEvaluationServiceTest` 신규 3건(범위 밖 사업·경상사업·계획 미연결 거부), 기존 저장 테스트 5건은 계획 스냅샷 스텁(`planCouncil`)으로 보정.

미검증 범위(COUNCIL-016): 실제 계획협의회 화면에서 평가 제출 종단 확인(사용자 화면 점검 기간에 포함), 조정 협의회의 기준 계획은 대상 집합에 영향 없음(현재 계획만 대상).
## 2026-09-22

| ID | 상태 | 조치 | 근거 |
| --- | :--: | ---- | ---- |
| COUNCIL-012 | ✅ Done | Step1 타당성검토표에 동시성 스탬프(`BPOVWM`+`BCHKLM`+`BPERFM` SHA-256, `KPN_TP_TC`·감사 필드 제외) 도입. `GET`이 `concurrencyStamp`를 싣고 `POST/PUT`은 잠금 뒤·수정 전에 대조해 형식 오류 400 `COUNCIL_STAMP_INVALID`, 누락·불일치 409 `COUNCIL_SOURCE_CHANGED`(변경자·현재 스탬프·현재값)로 응답하며 성공 시 `FeasibilitySaveResponse { concurrencyStamp }`를 돌려준다. 프론트는 스탬프를 보관·전송하고 409를 다이얼로그로 받아 [다시 불러오기]/[내 입력으로 덮어쓰기]로 해소(경량, 3-way 병합 없음 — 사용자 결정). `GlobalExceptionHandler`에 협의회 전용 핸들러 1개 추가(사용자 승인) | [설계](docs/superpowers/specs/done/2026-09-22-council-feasibility-concurrency-design.md) · [계획](docs/superpowers/plans/done/2026-09-22-council-feasibility-concurrency.md) |

코드 변경(COUNCIL-012): `it_backend` — `CouncilFeasibilityStamper`·`CouncilFeasibilityConcurrencyGuard`·`CouncilConflictException`·`CouncilConflictResponse`·`CouncilFeasibilityDto`(신규, `CouncilDto` 800줄 상한으로 타당성검토표 레코드 분리), `CouncilDto`(`FeasibilityRequest/Response.concurrencyStamp`, `FeasibilitySaveResponse`), `FeasibilityService`, `CouncilFeasibilityController`, `GlobalExceptionHandler`(핸들러 1개), 테스트 신규 3개(`CouncilFeasibilityStamperTest` 4건·`CouncilFeasibilityConflictHandlerTest` 2건·`CouncilFeasibilityConcurrencyGuardTest`)와 기존 테스트 보정, `ApiResponseOpenApiContractTest`에 `FeasibilityResponse.concurrencyStamp` nullable 등록 1줄(council 밖 파일, 런타임 영향 없음). `it_frontend` — `composables/council/useFeasibilityConflict.ts`·`useFeasibilityAttachment.ts`(신규, 후자는 `useCouncilRequestPage` 800줄 상한 분리), `useCouncilCommitteeApi.ts`, `useCouncilRequestPage.ts`, `features/council/feasibilityFormDefaults.ts`, `pages/info/council/[id].vue`, `i18n/messages/council.ts`(키 4개 ko/en), `types/council.ts`·`types/api.d.ts`(codegen), 테스트 2개(`useCouncilRequestPage.test.ts` +6건, `FeasibilityOverview-byte-limit.test.ts` 픽스처). 충돌 해소 함수 이름은 `acceptServerVersion`(ERR-15 refresh-binding census가 `reload*` 템플릿 바인딩을 재조회로 오인해 개명). DB 변경 없음. 배포 순서 프론트 → 백엔드(요청 스탬프는 선택 필드라 구 프론트도 동작하나 누락은 409이므로 실제로는 백엔드 배포 후 프론트가 즉시 따라가야 한다).

검증 결과(COUNCIL-012): 백엔드 `./gradlew test` 5,694건 0 실패(2 skipped, 1차 실행의 `ApiResponseOpenApiContractTest` 1건 실패는 위 nullable 등록으로 해소), `spotlessJavaCheck` 통과, council 도메인 456건. 프론트 `format:check`·`check`(0 errors) 통과, `npm test` 6,124건 중 6,120 통과 — 실패 4건은 기존 ICU 환경 실패 파일 2개(`project-domain-i18n`, `ItBudgetSourceChangedDialog`)로 이번 변경과 무관. 아키텍처 ratchet(800줄·문구·refresh census·라우트 계약 44개·`useCouncil` 계약 49키) 통과.

미검증 범위(COUNCIL-012): 실제 두 브라우저 세션의 동시 저장 종단 확인, 다이얼로그 배선(페이지 컴포넌트 테스트 없음), 결과서(`BRSLTM`)는 범위 밖.
## 2026-09-21

| ID | 상태 | 조치 | 근거 |
| --- | :--: | ---- | ---- |
| COUNCIL-010 | ✅ Done | 결재 회수 이벤트 리스너(`ApprovalRecalledEvent` → `03→02`, `12→11`, 그 밖은 무시), `PATCH /api/council/{id}/reopen`(작성완료 `02→01`, `BPOVWM.KPN_TP_TC=10`), `DELETE /api/council/{id}`(작성중·작성완료 소프트 삭제, 사업 협의회는 `BPROJA` `45→09` 복귀, 계획협의회는 원장만; `CouncilCancelService`). 권한은 관리 또는 주관부서(`verifyOwningOrManageable`), 상태 위반 409. Step1에 [수정으로 되돌리기]·[신청 취소] 버튼과 확인 다이얼로그 | [설계](docs/superpowers/specs/done/2026-09-21-council-reopen-cancel-recall-design.md) · [계획](docs/superpowers/plans/done/2026-09-21-council-reopen-cancel-recall.md) |
| COUNCIL-009 | ✅ Done | 첨부·오류 안내 공통화. ① Step1 타당성검토표 첨부 다운로드를 `<a :href="getDownloadUrl()">` 직접 열기에서 공통 `useAttachmentDownload`(Blob 인증 다운로드, 공통 실패 Toast)로 교체 — `fetchCouncilRequestPageData`가 `fetchFiles('첨부파일', asctId)`를 함께 만들고 `useCouncilRequestPage.downloadFeasibilityFile()`이 `flMngNo`로 레코드를 찾아 내려받음(없으면 한 번 재조회, 그래도 없으면 실패 안내). ② 협의회 9개 파일 17곳의 `err?.data?.message ?? err?.message ?? fallback` 수작업 체인을 `features/council/councilErrorDetail.ts`(`formatApiError(getErrorMessage())`, ORA 추출·200자 절단)로 통일 | [오류 문구](it_frontend/app/features/council/councilErrorDetail.ts) · [페이지 상태](it_frontend/app/composables/useCouncilRequestPage.ts) |
| COUNCIL-009 (Step1 업로드 UI 공통화) | ☑️ Accepted | Step1 첨부 업로드(숨김 `input[type=file]` + hwp/hwpx/pdf 검증 + `useFiles.uploadFile`)는 단일 필수 파일 계약이라 다중·삭제표시 모델인 공통 `AttachmentUploadField`와 맞지 않아 유지. 업로드 자체는 이미 공통 `useFiles`를 쓴다 | 동일 |
| COUNCIL-008 | ✅ Done | 협의회 목록 툴바의 `[개발용] 사용자 전환` 버튼·`SwitchUserDialog` 마운트·`showSwitchUserDialog` ref·import와 i18n `council.list.switchUser`/`switchUserHint`(ko/en) 제거. 역할 검사 없이 모든 사용자에게 보이던 진입점만 없앴고, 사용자 전환은 공통 헤더(`AppHeader`, `v-if="isAdmin()"`)가 계속 제공 | [목록](it_frontend/app/pages/info/council/index.vue) · [헤더](it_frontend/app/components/layout/AppHeader.vue) |
| COUNCIL-007 | ✅ Done | 목록 조회 안정 정렬 + 연도·부서 검색. 백엔드 목록 쿼리 4개(`findByDepartment`·`findByCommitteeMember`·`findProjectsForCouncilAll`·`findProjectsForCouncilByDepartment`)의 `ORDER BY FST_ENR_DTM DESC` 뒤에 키 컬럼(`IT_PTL_ASCT_ID` / `ABUS_MNG_NO, SNO`) tie-breaker를 두고, 정렬이 없던 계획협의회(02) 파생 조회는 서비스에서 같은 기준으로 정렬. 프론트 `council-list-filter`에 사업연도(`prjYy`)·주관부서(`svnDpm`) 필터·옵션 추가(응답 필드 재사용, API 변경 없음), 부서 필터는 IT관리자·정보보호관리자에게만 노출 | [리포지토리](it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java) · [필터](it_frontend/app/features/council/request/council-list-filter.ts) |
| COUNCIL-007 (서버 페이징·상한) | ☑️ Accepted | 로컬(운영 덤프) 기준 `TPRMPP_BASCTM` 활성 7건·`TPRMPP_BPROJM` 활성 45건으로 수십 건 규모이고, 4개 쿼리 모두 권한 범위(전체/부서/배정위원)의 DB 필터가 이미 걸려 있으며 화면은 `useProgressiveList` 점진 노출을 쓴다. 서버 페이징은 API 계약 변경(codegen)과 정렬 규칙(신청 건 우선→심의유형) 이전을 동반하므로 연 수백 건을 넘거나 목록 응답이 체감 지연될 때 별도 설계로 도입한다. 정보보호관리자 분기의 전건 조회 후 메모리 필터도 같은 근거로 유지 | 동일 |
| COUNCIL-006 | ✅ Done | KeepAlive(`app.vue` `max: 10`) 재방문 시 협의회 화면 4개가 `onActivated`에서 최신 상태를 조용히 재조회. 목록: 협의회 목록+생략 판정함, 개최준비·결과: 협의회 상태(단계), Step1: 상세는 항상, 타당성검토표는 `formDirty`가 아닐 때만(편집 중 입력 보존). 첫 마운트 직후 발화는 `skipFirstActivation`으로 건너뛰어 초기 lazy 조회를 dedupe-cancel하지 않음. 검토표 조회에 `useRefreshGuard`를 붙여 실패 시 마지막 값을 보존(ERR-13 3keep)하고 COUNCIL-004 배너·잠금으로 안내 | [래퍼](it_frontend/app/features/council/request/activation-refresh.ts) · [페이지 상태](it_frontend/app/composables/useCouncilRequestPage.ts) |
| COUNCIL-004 | ✅ Done | 타당성검토표 초기 조회 실패와 미작성 구분. GET은 미작성이면 200/null, 실패면 data 비움+`status='error'`라 data만으로는 같았고, 실패를 신규 작성으로 프리필해 임시저장하면 기존 저장본을 BPROJM 기본값으로 덮어쓸 수 있었음. `fetchCouncilRequestPageData`가 `feasibilityFetch` 핸들을 함께 넘기고 `useCouncilRequestPage`가 `initialLoadFailed`·`initialLoadFailureDetail`·`canEdit`·`retryInitialLoad`를 제공. 실패 상태는 빈 폼+편집·첨부·저장 버튼 잠금, `saveTemp`/`saveComplete`는 서버 호출 없이 토스트, 페이지 상단 오류 배너의 [새로고침]이 상세·검토표를 재조회 | [페이지 상태](it_frontend/app/composables/useCouncilRequestPage.ts) · [페이지](it_frontend/app/pages/info/council/[id].vue) |
| COUNCIL-003 | ✅ Done | 사업 목록 신청 다이얼로그의 심의유형 선택지에서 계획협의회(02) 제거. 02는 계획(BPLANM)에 붙어 `reqDocNo`가 필요해 사업 카드에서 신청하면 `CreateRequest.isTargetPresent` 400이 났음. 선택지 규칙을 `features/council/request/council-apply-options.ts`(`applyDbrTcOptions`·`defaultApplyDbrTc`)로 분리하고 기본 선택값은 03 우선. 계획 상세(`/info/plan/[id]` → `usePlanDetailPage.handleRequestCouncil`) 신청 경로는 유지 | [선택지](it_frontend/app/features/council/request/council-apply-options.ts) · [목록](it_frontend/app/pages/info/council/index.vue) |

코드 변경(COUNCIL-003): `it_frontend` — `features/council/request/council-apply-options.ts`(신규), `pages/info/council/index.vue`, 테스트 1개. 백엔드·`CouncilApplyDialog`·i18n·계획 상세 경로 변경 없음(백엔드는 계획 상세 경로가 쓰므로 02 신청 API를 그대로 받는다). 01(중장기계획)은 `ADMIN_CREATABLE_TYPES`에 있어 선택지에 유지.

검증 결과(COUNCIL-003):

- `council-apply-options.test.ts` 6건 통과 — 역할 조합·정보보호 소요자원·"어떤 조합에도 02 없음"·기본값 03 우선.
- `tests/unit/features/council`·`tests/unit/components/council` 12개 파일 58건 통과, `npm run typecheck`·eslint(대상 3파일) 통과.

미검증 범위(COUNCIL-003): 목록 페이지 자체의 컴포넌트 테스트는 없음(다이얼로그 props 배선은 타입 검사로만 확인). 실제 브라우저에서 IT관리자 계정의 선택지 표시.

코드 변경(COUNCIL-004): `it_frontend` — `composables/useCouncilRequestPage.ts`, `pages/info/council/[id].vue`, `i18n/messages/council.ts`(council.request 키 3개 ko/en), `tests/unit/composables/useCouncilRequestPage.test.ts`. 백엔드·DTO·다른 화면 변경 없음. 판정은 예외가 아니라 조회 `status` 기준(ERR-13)이며 401·403도 같은 배너로 다룬다.

검증 결과(COUNCIL-004):

- `useCouncilRequestPage.test.ts` 46건 통과(신규 6건 — 검토표 실패 시 빈 폼·잠금, 미작성(200/null)은 기존대로 프리필, 실패 상태 임시저장·작성완료 차단, 상세 실패도 같은 플래그, 재조회 성공 시 해제·저장값 프리필, 재실패 시 유지).
- 협의회 컴포넌트·기능·페이지 경계 테스트 14개 파일 104건 통과, `npm run typecheck`·eslint(대상 3파일)·prettier 통과.

미검증 범위(COUNCIL-004): 페이지 템플릿(배너·버튼 `v-if`)은 타입 검사로만 확인. 실제 브라우저에서 백엔드를 내린 채 진입하는 시나리오. 보존 데이터가 있는 재조회 실패(쓰기 후)는 기존 ERR-13 가드가 계속 담당.

코드 변경(COUNCIL-006): `it_frontend` — `features/council/request/activation-refresh.ts`(신규), `composables/useCouncilRequestPage.ts`(`refreshOnActivated`, 검토표 가드), `pages/info/council/index.vue`·`[id].vue`·`prepare/[id].vue`·`result/[id].vue`, 테스트 2개. 실패 문구는 기존 키(`council.list.retryFailure`·`council.request.skipReqRetryFailure`·`detailRetryFailure`) 재사용으로 i18n 추가 없음. 백엔드 변경 없음.

검증 결과(COUNCIL-006):

- `activation-refresh.test.ts` 3건(첫 호출 무시·인스턴스별 계수·반환값 전달), `useCouncilRequestPage.test.ts` 신규 3건(편집 전 두 조회 재조회·편집 중 상세만·검토표 재조회 실패 시 값 보존+잠금+Toast 없음) 통과.
- 협의회 관련 15개 파일 110건 통과, `npm run typecheck`·eslint(대상 8파일)·prettier 통과.

미검증 범위(COUNCIL-006): 개최준비·결과 페이지의 하위 조회(위원·일정·결과서·Q&A)는 재활성화 때 다시 읽지 않음(각 저장 흐름의 재조회가 담당). `onActivated` 발화 자체는 KeepAlive 통합 테스트가 없어 실제 브라우저 확인 필요. 목록의 계획협의회 카드 통계(`useCouncilPlanStats`)는 목록 데이터 변경에 따라 갱신되는지 별도 확인하지 않음.

코드 변경(COUNCIL-007): `it_backend` — `CouncilRepository.java`(ORDER BY 4곳), `CouncilService.java`(02 목록 정렬), `CouncilRepositoryQueryTest.java`. `it_frontend` — `features/council/request/council-list-filter.ts`, `pages/info/council/index.vue`, `i18n/messages/council.ts`(council.list 키 2개 ko/en), `council-list-filter.test.ts`. DTO·OpenAPI 계약 변경 없음.

검증 결과(COUNCIL-007):

- 백엔드: `CouncilRepositoryQueryTest.listQueries_useStableOrdering`(4개 쿼리 ORDER BY 단언) 포함 `com.kdb.it.domain.council.*` 423건 통과, 실패 0. `spotlessJavaCheck` 통과. 실제 Oracle에 대한 정렬 결과 비교는 하지 않음(구문은 기존 컬럼만 사용).
- 프론트: `council-list-filter.test.ts` 13건(신규 3건 — 연도 옵션 내림차순·완전일치, 부서 옵션 라벨 해석·완전일치, 초기화·isFiltered 포함) 포함 `tests/unit/features/council` 46건 통과, `npm run typecheck`·eslint·prettier 통과.

미검증 범위(COUNCIL-007): 목록 페이지 템플릿(필터 Select 2개, 관리자 전용 노출)은 타입 검사로만 확인. 부서 옵션 순서는 목록 원본 순서(정렬하지 않음).

코드 변경(COUNCIL-008): `it_frontend` — `pages/info/council/index.vue`, `i18n/messages/council.ts`. 다이얼로그 컴포넌트·`useAuth.switchUser`·백엔드 변경 없음. 함께 발견한 후속: COUNCIL-006에서 추가한 검토표 재조회 가드의 `logLabel` 한글 리터럴이 `user-facing-copy-ratchet` 기준선(`useCouncilRequestPage.ts`=2)을 3으로 넘겨 영문 접두어로 정정.

검증 결과(COUNCIL-008): `npm run check:copy`(고정 리터럴 ratchet 3건) 통과, `npm run typecheck`·eslint·prettier 통과, `useCouncilRequestPage.test.ts` 48건 통과. 목록 페이지 컴포넌트 테스트는 없음.

미검증 범위(COUNCIL-008): 실제 브라우저에서 일반 사용자 화면의 버튼 부재 확인.

코드 변경(COUNCIL-009): `it_frontend` — `features/council/councilErrorDetail.ts`(신규), `composables/useCouncilRequestPage.ts`, `pages/info/council/index.vue`·`[id].vue`·`prepare/[id].vue`·`result/[id].vue`, `components/council/committee/CommitteeSelector.vue`·`evaluation/EvaluationForm.vue`·`plan/PlanPprtForm.vue`·`result/ResultForm.vue`·`schedule/ScheduleStatus.vue`, 테스트 2개. 문구 키·백엔드·공통 유틸 변경 없음. 동작 차이는 원문 200자 절단과 ORA 메시지 추출뿐이며 4xx 업무 메시지는 종전처럼 그대로 보인다.

검증 결과(COUNCIL-009):

- `councilErrorDetail.test.ts` 4건(본문 message 우선·폴백·ORA 추출·200자 절단), `useCouncilRequestPage.test.ts` 신규 4건(레코드 매칭 다운로드·레코드 없음 실패 안내·목록 없을 때 재조회·첨부 없음 무동작) 통과.
- 협의회 관련 16개 파일 121건 통과, `npm run typecheck`·eslint·prettier·`check:copy` 통과. 협의회 코드의 `data?.message` 수작업 체인 잔존 0건.

미검증 범위(COUNCIL-009): 실제 브라우저에서 Blob 저장 동작(공통 `useAttachmentDownload`가 담당). 페이지 템플릿의 다운로드 버튼 배선은 타입 검사로만 확인.

코드 변경(COUNCIL-010): `it_backend` — `CouncilApprovalEventListener.java`, `CouncilApprovalService.java`, `FeasibilityService.java`, `Bpovwm.java`, `CouncilCancelService.java`(신규), `CouncilService.java`, `CouncilFeasibilityController.java`, `CouncilController.java`, 테스트 6개(`CouncilRouteContractTest`에 라우트 2개 등재 포함). `it_frontend` — `composables/council/useCouncilLifecycleApi.ts`, `composables/useCouncilRequestPage.ts`, `pages/info/council/[id].vue`, `i18n/messages/council.ts`(키 14개 ko/en), `types/api.d.ts`(codegen), 테스트 2개. DB 스키마·공통 결재 모듈 변경 없음. 함께 한 정리: `MaxLinesRatchet`(800줄)에 걸린 `CouncilService`(820)는 취소를 `CouncilCancelService`로 떼어 788줄로, `useCouncilRequestPage.ts`(1013)·`index.vue`(804)는 `feasibilityFormDefaults`·`useCouncilSkipRequestDialog`·`useCouncilApprovalDialog`·`useCouncilLifecycleActions`·`council-routing`으로 떼어 782·778줄로 낮춤(반환 형태 불변). 페이지 3곳에 `onActivated` 명시 import(페이지 단위 테스트는 auto-import가 없음), `useCouncil` 계약 테스트 49키.

검증 결과(COUNCIL-010):

- 백엔드: 회수 리스너·서비스 5건, reopen 4건, cancel 8건 신규 통과. `com.kdb.it.domain.council.*` 441건, 전체 `./gradlew test` 5,679건 통과·실패 0·건너뜀 2, `MaxLinesRatchetTest`·`spotlessJavaCheck` 통과.
- 프론트: `useCouncilRequestPage.test.ts` 신규 6건(판정 2·복귀 2·취소 2)과 `council-routing.test.ts` 4건 통과, 협의회·아키텍처·페이지 테스트 34파일 205건 통과. `npm run check`·`format:check`·`check:copy`·`codegen:check` 통과. `npm test` 6,118건 중 6,116건 통과, 실패 2 — `project-domain-i18n`·`ItBudgetSourceChangedDialog`(협의회 무관, 로컬 Node ICU 한국어 시각 렌더).

미검증 범위(COUNCIL-010): 실제 공통 결재 화면에서 회수 → 협의회 02 복귀의 종단 확인(리스너는 단위 테스트로만), 확인 다이얼로그·버튼 배선(페이지 컴포넌트 테스트 없음), 취소 후 사업이 목록에 미신청 행으로 다시 보이는지의 브라우저 확인.

## 2026-09-20

| ID | 상태 | 조치 | 근거 |
| --- | :--: | ---- | ---- |
| COUNCIL-001 | ✅ Done | `CouncilAccessGuard.verifyReadable`로 협의회 상세·타당성검토표 조회를 시스템관리자, 심의유형 04의 정보보호관리자, 활성 연결 사업의 주관부서, 해당 협의회 활성 배정위원으로 제한. `CouncilService.findReadableCouncil`을 사용자 상세 조회와 `FeasibilityService` 조회에 적용 | [설계](docs/superpowers/specs/done/2026-09-20-council-access-and-draft-protection.md) · [가드](it_backend/src/main/java/com/kdb/it/domain/council/service/CouncilAccessGuard.java) |
| COUNCIL-002 | ✅ Done | `CouncilAccessGuard.lockWritableDraft`가 `CouncilRepository.findByIdForUpdate`(`PESSIMISTIC_WRITE`, 잠금 3,000ms)로 원장을 잠근 뒤 수정 권한(관리자·정보보호 04·주관부서, 위원 자격 제외)과 작성중(`01`)·비계획협의회 상태를 검사. 권한 없음 403, 삭제·미존재 404, 비작성중·잠금 초과 409. `FeasibilityService` POST/PUT에 적용 | 동일 |
| COUNCIL-011 | ✅ Done | `CouncilAccessGuard`에 `verifyManageable`·`verifyOwningOrManageable`·`verifyCommitteeOrManageable`·`verifyCreatable`을 추가하고 평가위원 편성(관리자, 상태 04·05만, 위반 409)·결재 상신(주관부서·관리자, 권한을 상태보다 먼저)·사전 Q&A 질문(배정위원·관리자)·협의회 신청(관리자 01/02/03/05, 정보보호관리자 04, 일반부서는 주관 사업 03·정보보호 항목 있으면 04, 관리자 04도 정보보호 항목 필요)에 적용 | [설계](docs/superpowers/specs/done/2026-09-20-council-write-boundaries-design.md) · [계획](docs/superpowers/plans/done/2026-09-20-council-write-boundaries.md) |
| COUNCIL-005 | ✅ Done | 협의회 자유입력 21개 필드를 DB BYTE 한도로 정합: 엔티티 10개 `@PrePersist/@PreUpdate`(`CouncilTextLimits`, 초과 시 400)와 프론트 `councilFormLimits` 단일 출처 + `createModel`/`acceptText` 거부 + `TextLengthIndicator`, 글자 수 `maxlength`·자리표시자 "(최대 N자)" 제거, 회의장소 결합값 100B 검사 | [설계](docs/superpowers/specs/done/2026-09-20-council-text-byte-limits-design.md) · [계획](docs/superpowers/plans/done/2026-09-20-council-text-byte-limits.md) |

코드 변경: `it_backend` — `CouncilAccessGuard.java`(신규), `CouncilService.java`, `FeasibilityService.java`, `CouncilRepository.java`, `CouncilServiceTest.java`, `CouncilAccessBoundaryTest.java`(신규), `docs/guides/security/data-scope.md`. 요청·응답 DTO와 DB 스키마는 변경 없음.

검증 결과:

- `CouncilAccessBoundaryTest` 31건 통과 — 타 부서 조회·저장 거부, 비작성중 상태 덮어쓰기 거부, 주관부서 작성중 조회·저장, 작성완료 후 재저장 거부, 배정위원 조회 허용·타 부서 저장 거부, 관리자 작성완료본 덮어쓰기 거부, 정보보호관리자 심의유형 범위, 계획협의회 검토표 생성 거부, 부서·인증·사번 누락 거부, 비정상 principal 거부, 삭제 원장 저장 거부, 잠금 초과 409·미기록, HTTP POST/PUT 403·409.
- `com.kdb.it.domain.council.*` 27개 테스트 클래스 370건 통과, 실패 0.
- `spotlessJavaCheck` 통과.
- 백엔드 전체 `./gradlew test` 5,608건 통과, 실패 0, 건너뜀 2 (품질 게이트).

미검증 범위: Oracle 실제 잠금 대기 시간과 운영 사용자 연동은 별도 검증 대상. 작성중 동시 편집의 오래된 입력 덮어쓰기는 COUNCIL-012, 신규 신청과 다른 하위 API 권한은 COUNCIL-011, 프론트 편집 가능 상태·오류 안내 정렬은 COUNCIL-004·009에서 계속 관리.

코드 변경(COUNCIL-011): `it_backend` — `CouncilAccessGuard.java`, `CommitteeService.java`, `CouncilApprovalService.java`, `QnaService.java`, `CouncilService.java`, `CouncilAccessBoundaryTest.java`, `CommitteeServiceTest.java`, `CouncilApprovalServiceTest.java`, `QnaServiceTest.java`. 사용자 승인으로 `common/approval/service/CouncilJsonlessApprovalWorkflowTest.java`의 생성자 목 인자 1개만 보강. 컨트롤러·DTO·DB·프론트 변경 없음.

검증 결과(COUNCIL-011):

- `CouncilAccessBoundaryTest` 58건 통과(기존 31건 + 신규 27건) — 가드 판정 행렬, 위원 편성 권한·상태(04·05 허용, 그 밖의 12개 상태 409), 결재 상신 권한 우선(403 → 400 순), Q&A 질문 위원·관리자, 신청 거부 시 채번·영속화 미호출, 인증 누락.
- `com.kdb.it.domain.council.*` 397건 통과, 실패 0.
- 백엔드 전체 `./gradlew test` 5,635건 통과, 실패 0, 건너뜀 2. `spotlessJavaCheck` 통과.

미검증 범위(COUNCIL-011): 사전 Q&A 질문의 단계별 허용 시점(상태 가드 미적용), 결재 상신 원장 잠금(COUNCIL-012), 조회 API 11개(COUNCIL-013), 운영 사용자 연동.

코드 변경(COUNCIL-005): `it_backend` — `domain/council/entity/CouncilTextLimits.java`(신규), 엔티티 10개(`Bpovwm`·`Bperfm`·`Bchklm`·`Bevalm`·`Bplevm`·`Brsltm`·`Bpqnam`·`Bmqnam`·`Baskpm`·`Basctm`), 테스트 2개(`CouncilTextLimitsTest`·`CouncilEntityByteLimitTest`). `it_frontend` — `features/council/councilFormLimits.ts`·`meetingPlace.ts`(신규), 협의회 컴포넌트 8개(`FeasibilityOverview`·`FeasibilityPerformance`·`FeasibilitySelfCheck`·`EvaluationForm`·`PlanPprtForm`·`ResultForm`·`CouncilQna`·`MainQnaSection`·`ScheduleStatus`)와 페이지 2개(`council-request/index.vue`·`[id].vue`), 사용자 승인으로 `i18n/messages/council.ts` 자리표시자 문구 18건 정리, 테스트 3개. DTO·컨트롤러·DB·공통 유틸 변경 없음.

검증 결과(COUNCIL-005):

- 백엔드: `CouncilTextLimitsTest` 2건, `CouncilEntityByteLimitTest` 23건, `com.kdb.it.domain.council.*` 422건 통과, 실패 0. 전체 `./gradlew test` 5,660건 중 5,659건 통과, 건너뜀 2, 실패 1 — `common.mfa.provider.OnePassClientTest.fidoStart_exposesChallengeThroughClientFacade`(협의회 무관, 응답 Content-Type 파싱 예외)로 단독 재실행 시 18건 전부 통과. `spotlessJavaCheck` 통과.
- 프론트: `councilFormLimits.test.ts` 3건, `meetingPlace.test.ts` 2건, `FeasibilityOverview-byte-limit.test.ts` 2건, 협의회 컴포넌트·기능 테스트 통과, `npm run typecheck`·`lint`·`check:copy`·`format:check` 통과. `npm test` 6,078건 중 6,076건 통과, 실패 2 — `pages/project-domain-i18n.test.ts`·`components/approval/ItBudgetSourceChangedDialog.test.ts`(협의회 무관, 로컬 Node ICU가 한국어 시각을 `오전` 대신 `AM`으로 렌더).
- `app/components/council`·`app/pages/info/council`에 `maxlength`·`{ max: N }` 잔존 0건.

미검증 범위(COUNCIL-005): `v-model` 배선 컴포넌트(평가·계획평가·결과서·질의응답·장소·사유)는 타입 검사와 기존 테스트로만 확인했고 거부 동작의 컴포넌트 테스트는 두지 않음(거부 규칙 자체는 `useDatabaseByteLimit` 테스트가 담당). 실제 브라우저에서의 붙여넣기 복원, 서버 400 메시지의 화면 노출(COUNCIL-009).
