# IT Portal 잔여과제

|  우선순위   | 의미           |
| :---------: | -------------- |
| 🔴 Critical | 즉시 조치      |
|   🟠 High   | 조속 조치      |
|  🟡 Medium  | 계획 반영      |
|   🟢 Low    | 선택 개선      |
| 🏛️ External | 외부/운영 의존 |
|   ✅ Done   | 확인 완료      |

## 🔒 보안

| ID | 우선순위 | 유형 | 과제 | 근거/조건 |
| --- | :---: | --- | --- | --- |
| SEC-06 | 🟠 High | 배포 정합성 | Refresh Token 원문 제거 마이그레이션의 Flyway 버전 중복 해소·적용 | `V20260719_001__NormalizeCfilemParentKeys.sql`은 로컬 DB 설치 순번 45로 성공 적용됨. 이후 추가된 `V20260719_001__RemovePlainRefreshToken.sql`이 동일 버전을 재사용해 미적용 상태. 2026-07-19 로컬 확인 기준 토큰 13행 모두 원문 컬럼 값이 남아 있고 4행은 해시가 없으며, 스키마도 `API_TOK_CONE NOT NULL`·`ECY_RNW_PUB_TOK_CONE NULL 허용` 상태. 성공 적용된 SEC-05 스크립트는 수정하지 않고 SEC-06 스크립트에 고유 전진 버전을 부여한 뒤 적용·검증해야 함 |

_SEC-04·SEC-05 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-19 Remediation Phase 1 기록을 참조합니다._

## 🤝 사전협의

| ID     | 우선순위  | 유형 | 과제                                                | 근거/조건                                                                                                                                                                                          |
| ------ | :-------: | ---- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REV-01 | 🟡 Medium | 기능 | 사전협의 검토자/세션 status 서버 영속화             | 선행조건: 검토 플로우 실제 인증 연동. `stores/review.ts`의 `completeReview`/`submitForReview`가 메모리 전용이고, `review.vue`의 currentUser와 `ReviewToolbar.vue`의 검토완료 흐름이 모의/수동 상태 |
| REV-02 | 🟡 Medium | 기능 | 검토의견 응답에 작성자 팀명(`authorTeam`) 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts`가 임시값 사용                                                                                                                               |
| REV-03 | 🟡 Medium | 기능 | 검토의견 첨부파일 응답 매핑 추가                    | `useReviewCommentApi.ts`가 `attachments`를 빈 배열로 고정                                                                                                                                          |

## ⚠️ 에러 처리

| ID | 우선순위 | 유형 | 과제 | 근거/조건 |
| --- | :---: | --- | --- | --- |
| ERR-05 | 🟠 High | 배포 정합성 | 알림 outbox 상태 마이그레이션 적용 | 코드·테스트와 `V20260719_002__AddNotificationDispatchState.sql` 작성은 완료했으나, 앞선 SEC-06 중복 버전 때문에 로컬 Flyway 이력이 `20260719.001`에서 중단됨. 2026-07-19 로컬 확인 기준 `TPRMPP_CINFMM`에 `INFM_SD_STS_C`, `RE_TRY_NOT`, `ERR_CONE` 컬럼이 없으므로 Flyway 체인 정합화 후 적용·인덱스·재시도 동작을 검증해야 함 |

_ERR-06 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-19 Remediation Phase 1 기록을 참조합니다._

## 🎨 프론트엔드

| ID    | 우선순위  | 유형   | 과제                                                                                                             | 근거/조건                                                                                                                                                                                                                                                      |
| ----- | :-------: | ------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-01 | 🟡 Medium | 기능   | `info/index.vue` 공지/일정 데이터를 실제 API 또는 운영 데이터 소스로 전환                                        | KPI·진행현황은 기존 API composable 기반으로 전환 완료. 공지/일정 영역은 운영 데이터 소스 결정 필요                                                                                                                                                             |
| FE-02 |  🟢 Low   | 정리   | 잔여 파일 크기·통화·금액 표시 중복 함수 공통화                                                                   | 공용 `formatFileSize`와 금액 유틸이 있으나 검토 팝오버/메신저, 비용·단말 상세, 예산·계획 화면에 동일 로직이 남아 있음. 의미가 같은 표현만 공용 함수로 통합                                                                                                     |
| FE-03 |  🟢 Low   | 스타일 | Prettier 포맷 드리프트 일괄 정리                                                                                 | 2026-07-11 `npm run format:check` 기준 37개 파일 위반(`app/pages/info/plan/form.vue`, `app/utils/common.ts`, `app/utils/hwpx.ts`, 테스트/문서 다수). 대량 diff 노이즈 방지를 위해 기능 변경이 없는 시점에 `npm run format` 1회 일괄 적용 권장                  |
| FE-04 | 🟡 Medium | 성능   | 사업 목록 표준 카드 양식(`ProjectListContainer`)에 페이지네이션/더보기 도입                                      | 2026-07-12 estimate 목록의 테이블→카드 전환으로 기존 `paginator :rows="20"`이 소실되어 전체 목록을 한 번에 렌더링. 백엔드 목록 API도 LIMIT 없음. 데이터 누적 시 카드 DOM 부하 발생 — `ProjectListContainer`에 선택적 페이지네이션 또는 "더보기" 패턴 추가 검토 |
| FE-05 |  🟢 Low   | 정리   | `council-request/index.vue` 로컬 `formatBudget`(억/만 축약)과 공용 `utils/common.ts formatBudget` 이름 충돌 해소 | 목적이 다른 별도 헬퍼이나 동명이라 혼동 소지. `formatBudgetCompact` 등으로 개명하거나 공용 유틸로 승격                                                                                                                                                         |
| FE-06 |  🟢 Low   | 스타일 | `ProjectListCard` 톤 색상 체계의 `.kdb-tag-*` 정책 통합 검토                                                     | 사업카드 팔레트의 원시 `bg-*/text-*` 조합을 장기적으로 `tags.css` 공통 태그 클래스 또는 의미 기반 토큰으로 통합 검토                                                                                                                                           |

## ⚙️ 백엔드

| ID    | 우선순위  | 유형   | 과제                                                                     | 근거/조건                                                                                                                                                                                                                                                                                                                                        |
| ----- | :-------: | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE-02 | 🟡 Medium | 테스트 | 공통 로컬 Oracle `@DataJpaTest` 하네스 기반 대상별 통합 테스트 순차 추가 | 공통 하네스와 다수 Repository 통합 테스트가 `integrationTest`에 편입됨. 신규 QueryDSL·네이티브 조회 변경 시 같은 하네스로 회귀 테스트를 계속 추가                                                                                                                                                                                                |
| BE-03 | 🟡 Medium | 성능   | 잔여 네이티브/상세 조회 프로젝션 분리 검토                               | `ProjectRepositoryImpl`/`CostRepositoryImpl` 목록 프로젝션은 완료했고 과거 `CouncilRepository.findWithDetails` 후보는 제거됨. 집행 4단계 상세 조회 등 실제 전체 엔티티 로딩 후보를 실행계획과 함께 재식별                                                                                                                                        |
| BE-06 |  🟢 Low   | 문서   | Javadoc 잔여 경고 정리                                                   | `CouncilDto`, `BudgetStatusDto`는 정리 완료. 2026-07-11 전수 측정(`-Xmaxwarns` 임시 적용) 결과 총 985건 — 상위: `Bprojm`(63), `ContractController`(18), `ApplicationDto`(18, default constructor), `CouncilProjectRow`(17), `UmsPayload`(16), `Btermm`(16). Lombok 클래스의 default constructor 경고는 주석만으로 해소 불가하므로 별도 방침 필요 |
| BE-07 |  ✅ Done  | DB     | `TPRMPP_CFILEM` DDL/Flyway와 엔티티 컬럼명 정합성 확인                   | 2026-07-15 로컬 Oracle 대조 결과 활성 Java/SQL과 실제 컬럼명이 일치함. 별도 NULL 허용 정책 불일치는 BE-11에서 추적                                                                                                                                                                                                                               |
| BE-08 |  ✅ Done  | 성능   | `TPRMPP_BTERMM` 연결 비용 조회용 인덱스 검토                             | 2026-07-15 로컬 Oracle에서 `(BG_NO, BG_SNO)` 인덱스를 확인함. 현재 조회 선두 조건과 데이터 규모에는 `DEL_YN` 후행 인덱스 추가 이익이 작아 현 시점 추가하지 않음                                                                                                                                                                                  |
| BE-09 |  🟠 High  | 정합성 | 비용·사업계획의 비결정 첫 행 선택 제거                                   | `CostService`가 버전 테이블 조회 결과 `get(0)`을 사용하고 `BizplanService.resolveBgNo()`가 무정렬 `BG-` 첫 행을 선택함. 최신·활성 조건과 결정적 정렬 또는 유일성 검증 필요                                                                                                                                                                       |
| BE-10 | 🟡 Medium | 성능   | 검토자·협의회 위원 팀 조회를 배치하고 선택 순서 고정                     | `ReviewerService`와 `CommitteeService`가 팀별 반복 조회 후 무정렬 첫 사용자를 선택함. `findByTemCIn` 배치 조회와 팀장·사번 기준 tie-break 적용                                                                                                                                                                                                   |
| BE-11 | 🟡 Medium | DB     | `TPRMPP_CFILEM` 필수 컬럼의 NULL 허용 정책 통일                          | 실제 DB의 `FL_NM`, `FL_PYS_NM`, `FL_KPN_PTH`는 NULL 허용이나 `Cfilem`은 `nullable=false`. 운영 필수값이면 Flyway로 NOT NULL, 레거시 허용이면 ORM 선언 정정                                                                                                                                                                                       |

## 🧹 Clean Code 부채

| ID    | 우선순위  | 유형     | 과제                                                                                                    | 근거/조건                                                                                                                                                                                                 |
| ----- | :-------: | -------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CQ-01 | 🟡 Medium | 리팩터링 | 대형 서비스·컨트롤러를 도메인 경계별로 분해                                                             | 대상: `ProjectService`, `CostService`, `BudgetWorkService`, `CouncilController`. 이번 Clean Code 즉시 개선 범위에서는 제외하고, 기능 변경 시 Query/Command·모듈별 컨트롤러 분리와 테스트 분리를 함께 수행 |
| CQ-02 | 🟡 Medium | 리팩터링 | 대형 프론트 composable/page를 하위 composable과 표시 컴포넌트로 분해                                    | 대상: `useCostListPage.ts`, `projects/form.vue`, `plan/[id].vue`, `features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts`. 단일 파일 리팩터링만으로 끝내지 말고 기존 화면 테스트 또는 수동 QA 기준을 먼저 세운 뒤 단계적으로 진행               |
| CQ-03 | 🟡 Medium | 타입     | 프로덕션 코드의 `any`와 `eslint-disable-next-line @typescript-eslint/no-explicit-any`를 도메인별로 제거 | 2026-07-11 스캔 기준 프론트 `app/`/`server/`에 398라인 매칭. 결재/사업집행 4단계 페이지, Tiptap/Excel/PDF, 가이드 문서 CRUD 순서로 기존 타입 재사용 또는 우회 사유 축소                                   |
| CQ-04 | 🟡 Medium | 테스트   | PDF/HWPX/Excel 산출물 회귀 테스트 기준 수립                                                             | `features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts`(구 `usePdfReport.ts`) 분해 전후 결과 차이를 검증할 최소 fixture와 스냅샷/구조 검증 기준 필요                                                                                                                  |
| CQ-05 | 🟡 Medium | 테스트   | E2E 핵심 3개 시나리오를 정기 실행 경로에 편입                                                           | 대상: 로그인, 프로젝트 조회/생성, 결재 처리. 로컬 Oracle·인증 데이터 의존성을 정리한 뒤 CI 또는 주기 실행 명령으로 고정                                                                                   |
| CQ-06 |  🟢 Low   | 리팩터링 | `Bcostm.update`의 20개 매개변수를 `UpdateCommand` record로 전환                                         | `Bprojm.UpdateCommand` 선례를 따르되 호출부 영향이 넓으므로 비용 도메인 리팩터링과 함께 처리                                                                                                              |
| CQ-07 |  🟢 Low   | 스타일   | Java 포맷터 도입과 매직 넘버 상수화 검토                                                                | Spotless/google-java-format 도입 여부를 먼저 결정. Toast `life` 값, 기본 편성률 `100` 등 반복 리터럴은 도메인별 상수로 점진 정리                                                                          |
| CQ-08 | 🟡 Medium | 검증     | `AdminMenuController.move` 요청 본문 검증 규칙 재정의                                                   | `MenuDto.MoveRequest.newHrkMnuId`는 루트 이동 시 null이 합법이라 필드 단위 필수 검증을 둘 수 없음. 빈 본문 400 요구가 필요하면 DTO/엔드포인트 수준 규칙을 먼저 합의해야 함                                |
| CQ-09 |  🟢 Low   | 정리     | 파일 업로드 서비스 추출 후 `FileService`의 dead code 제거                                               | `FileUploadUnitService`로 이동한 경로 생성 로직과 중복되는 미사용 필드·private 메서드·import·설명 제거                                                                                                    |
| CQ-10 |  🟢 Low   | 정리     | 미사용 프론트 컴포넌트와 상태의 연결 여부 확인 후 제거                                                  | 참조가 없는 `IconActivity.vue`, `ReviewVersionHistory.vue`, `AppDialogHeader.vue`와 estimate 상세의 미사용 `isDone` 후보. 동적 자동 등록 사용 여부를 최종 확인한 뒤 제거                                  |

## 📝 Tiptap 변수 입력

| ID     | 우선순위  | 유형   | 과제                                                                    | 근거/조건                                |
| ------ | :-------: | ------ | ----------------------------------------------------------------------- | ---------------------------------------- |
| TIP-02 | 🟡 Medium | 테스트 | E2E 시나리오 2/3/5 자동화                                               | 대상: 사업별, 실DB 갱신, HWPX 내보내기   |
| TIP-03 | 🟡 Medium | 검증   | Tiptap 변수 카테고리 매핑 운영 데이터 검증                              | IT_BUDGET 일반관리비 포함 여부 확인 필요 |
| TIP-05 |  🟢 Low   | 검증   | 변수 칩 표시·다크모드 대비·키보드 삽입·aria-label·모바일 팝업 수동 검증 | 병합 후 UI 접근성/반응형 확인 필요       |

## 📡 실시간 로그

| ID     | 우선순위 | 유형 | 과제                                                 | 근거/조건                                                                                               |
| ------ | :------: | ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| LOG-03 |  🟢 Low  | 확장 | SSE 또는 WebSocket push 실제 전환                    | 운영 임계치와 feature flag 설계는 문서화 완료. 관리자 수·트래픽 증가 시 별도 기능으로 구현              |
| LOG-04 |  🟢 Low  | 운영 | 로그 데이터 보존 정책 시행과 아카이브 운영 절차 확정 | 테이블 분리 없이 View/운영 설정 기준 문서화 완료. 실제 보존기간·아카이브 운영 기준은 운영 의사결정 필요 |
| LOG-05 |  🟢 Low  | 기능 | 사용자별 즐겨찾기 테이블 필터 저장                   | `localStorage` 기반                                                                                     |

## 📬 공통 게시판

| ID     | 우선순위  | 유형 | 과제                                             | 근거/조건                                                              |
| ------ | :-------: | ---- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| BRD-02 |  🟢 Low   | 성능 | 본문 검색 Oracle Text 인덱스 도입                | 게시판당 1만 건 또는 검색 1초 초과 시                                  |
| BRD-03 |  🟢 Low   | 성능 | 조회수 카운터 Redis 전환                         | 다중 인스턴스 운영 시                                                  |
| BRD-05 |  🟢 Low   | 기능 | 첨부파일 다운로드 카운트 컬럼(`FL_DWN_NBR`) 추가 | 자료실 인기 자료 통계                                                  |
| BRD-06 |  🟢 Low   | 기능 | 댓글 첨부파일 지원                               | `ORC_DTT="공통게시판댓글"` 추가                                        |
| BRD-11 | 🟡 Medium | 기능 | 게시판 첨부파일 UI/API 연결                      | 현재 게시물 타입에 `flApgYn`, `flNbr`만 있고 파일 업로드 흐름은 미연동 |

## 🔌 EAI

| ID     |  우선순위   | 유형 | 과제                                                                          | 근거/조건                                                               |
| ------ | :---------: | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| EAI-01 | 🏛️ External | 운영 | KDB EAI 운영팀으로부터 IT Portal 전용 IF_ID 및 UMS 템플릿 발급·확정           | 시스템 식별자 IPP/PRM/PP는 프로퍼티로 확정                              |
| EAI-02 | 🏛️ External | 운영 | 운영 프로파일에서 `eai.enabled=true` + `eai.url` 주입 및 배포 체크리스트 반영 | 코드 설정은 환경변수 기반. 실제 운영 `EAI_URL` 주입·검증 필요           |
| EAI-05 | 🏛️ External | 운영 | 발신채널 상수 IT Portal 발신처 교체 필요성 확인                               | 현재 값: `1588-1500`, `hrd@kdb.co.kr`                                   |
| EAI-06 | 🏛️ External | 운영 | GWE 전문 실제 규칙 KDB 확인                                                   | `RMS_SYS_C`, `IF_ID`, `MSG_KEY` 접두, 발신자 상수, `SYSTEM_CODE` 운영값 |
| EAI-07 |   🟢 Low    | 확장 | 신규 시스템 연동 시 EaiPayload + EaiPayloadSection 1쌍 추가 패턴 유지         | 플러그형 확장 규칙                                                      |
