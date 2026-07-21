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

| ID     | 우선순위 | 유형 | 과제                                                 | 근거/조건                                                                                                                                                                                                                                  |
| ------ | :------: | ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SEC-08 | 🟠 High  | 인증 | Refresh Token 재사용 탐지 시 패밀리 폐기 커밋 보장   | `AuthService.refreshAccessToken()`이 `deleteByEno()` 직후 `InvalidRefreshTokenException`을 던져 같은 `@Transactional` 경계에서 삭제가 롤백될 수 있음. 폐기를 `REQUIRES_NEW` 등 독립 트랜잭션으로 확정하고 재사용 테스트에서 DB 삭제를 검증 |
| SEC-09 | 🟠 High  | 인증 | 로그인 실패 이력의 롤백 독립성과 계정 잠금 동작 보장 | `AuthService.login()`의 실패 이력 저장 뒤 `RuntimeException`이 발생하면 로그인 트랜잭션과 함께 롤백될 수 있어 `LoginAttemptService`의 10분 내 5회 차단 근거가 남지 않을 수 있음. 실패 기록을 독립 커밋하고 반복 실패 통합 테스트 추가      |

_SEC-04·SEC-05 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-19 Remediation Phase 1, SEC-06 완료 근거는 같은 문서의 2026-07-19 배포 정합성 후속 기록을 참조합니다._

## 🤝 사전협의

| ID     | 우선순위  | 유형 | 과제                                                | 근거/조건                                                                                                                                                                                          |
| ------ | :-------: | ---- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REV-01 | 🟡 Medium | 기능 | 사전협의 검토자/세션 status 서버 영속화             | 선행조건: 검토 플로우 실제 인증 연동. `stores/review.ts`의 `completeReview`/`submitForReview`가 메모리 전용이고, `review.vue`의 currentUser와 `ReviewToolbar.vue`의 검토완료 흐름이 모의/수동 상태 |
| REV-02 | 🟡 Medium | 기능 | 검토의견 응답에 작성자 팀명(`authorTeam`) 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts`가 임시값 사용                                                                                                                               |
| REV-03 | 🟡 Medium | 기능 | 검토의견 첨부파일 응답 매핑 추가                    | `useReviewCommentApi.ts`가 `attachments`를 빈 배열로 고정                                                                                                                                          |

## ⚠️ 에러 처리

| ID     | 우선순위 | 유형      | 과제                                                   | 근거/조건                                                                                                                                                                                                                                                   |
| ------ | :------: | --------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ERR-08 | 🟠 High  | 오류전파  | 평가 스냅샷 손상과 정상적인 빈 결과를 구분             | `PlanEvaluationService`가 사업·전산업무비·사업명 JSON 파싱 실패를 빈 목록·0건·관리번호로 폴백하고, 기준 계획 탐색에서는 모든 예외를 건너뜀. 미존재만 폴백하고 파싱·DB·권한 오류는 문맥 로그와 명시적 불완전/실패 상태로 노출                                |
| ERR-09 | 🟠 High  | 정합성    | 네이티브 조회 타입 변환 실패를 실제 NULL과 구분        | `NativeRowMapper`가 잘못된 날짜 문자열과 미지원 JDBC 타입을 `null`로 변환하지만 호출부 중앙 로깅이 없음. 원본 값·타입 문맥을 포함한 예외 전파 또는 공통 경고 정책과 변환 회귀 테스트 추가                                                                   |
| ERR-10 | 🟠 High  | UX/정합성 | 프론트 핵심 업무의 실패 폴백을 사용자 오류 상태로 승격 | `ResultReviewProgress.vue` 상태 전이, `cost/form.vue`·`TerminalFormDialog.vue` 통화 조회, `projects/report.vue` PDF URL, `TiptapEditor.vue` 토큰 해석 실패가 콘솔·KRW·빈 목록·STALE로 조용히 축약됨. 재시도·toast·오류 상태와 이전 결과 오인 방지 처리 필요 |

_ERR-06 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-19 Remediation Phase 1, ERR-05 완료 근거는 같은 문서의 2026-07-19 배포 정합성 후속 기록을 참조합니다._

## 🎨 프론트엔드

| ID    | 우선순위  | 유형   | 과제                                                                                                             | 근거/조건                                                                                                                                                                                                                                                      |
| ----- | :-------: | ------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-01 | 🟡 Medium | 기능   | `info/index.vue` 공지/일정 데이터를 실제 API 또는 운영 데이터 소스로 전환                                        | KPI·진행현황은 기존 API composable 기반으로 전환 완료. 공지/일정 영역은 운영 데이터 소스 결정 필요                                                                                                                                                             |
| FE-02 |  🟢 Low   | 정리   | 잔여 파일 크기·통화·금액 표시 중복 함수 공통화                                                                   | 공용 `formatFileSize`와 금액 유틸이 있으나 검토 팝오버/메신저, 비용·단말 상세, 예산·계획 화면에 동일 로직이 남아 있음. 의미가 같은 표현만 공용 함수로 통합                                                                                                     |
| FE-03 |  🟢 Low   | 스타일 | Prettier 포맷 드리프트 일괄 정리                                                                                 | 2026-07-20 `npm run format:check` 기준 33개 운영 파일 위반. 대량 diff 노이즈 방지를 위해 기능 변경이 없는 시점에 `npm run format` 1회 일괄 적용 권장                                                                                                            |
| FE-04 | 🟡 Medium | 성능   | 사업 목록 표준 카드 양식(`ProjectListContainer`)에 페이지네이션/더보기 도입                                      | 2026-07-12 estimate 목록의 테이블→카드 전환으로 기존 `paginator :rows="20"`이 소실되어 전체 목록을 한 번에 렌더링. 백엔드 목록 API도 LIMIT 없음. 데이터 누적 시 카드 DOM 부하 발생 — `ProjectListContainer`에 선택적 페이지네이션 또는 "더보기" 패턴 추가 검토 |
| FE-05 |  🟢 Low   | 정리   | `council-request/index.vue` 로컬 `formatBudget`(억/만 축약)과 공용 `utils/common.ts formatBudget` 이름 충돌 해소 | 목적이 다른 별도 헬퍼이나 동명이라 혼동 소지. `formatBudgetCompact` 등으로 개명하거나 공용 유틸로 승격                                                                                                                                                         |
| FE-06 |  🟢 Low   | 스타일 | `ProjectListCard` 톤 색상 체계의 `.kdb-tag-*` 정책 통합 검토                                                     | 사업카드 팔레트의 원시 `bg-*/text-*` 조합을 장기적으로 `tags.css` 공통 태그 클래스 또는 의미 기반 토큰으로 통합 검토                                                                                                                                           |
| FE-07 |  🟢 Low   | 스타일 | 예산 현황 푸터 속성명 ESLint 경고 정리                                                                           | 2026-07-20 `npm run check` 기준 `app/pages/budget/status.vue`의 `:footerClass` 3곳에서 `vue/attribute-hyphenation` 경고 발생. 기능 변경 시 `:footer-class`로 정리하고 화면 회귀 확인                                                                                |

## ⚙️ 백엔드

| ID    | 우선순위  | 유형   | 과제                                                                     | 근거/조건                                                                                                                                                                                                                                                                                                                                        |
| ----- | :-------: | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE-02 | 🟡 Medium | 테스트 | 공통 로컬 Oracle `@DataJpaTest` 하네스 기반 대상별 통합 테스트 순차 추가 | `UserRepositoryTemCInIt`와 사용자·조직·게시글·계획·예산·결재·집행 상세·관리자 목록·로그인 이력·요구사항 버전 프로젝션 IT가 `integrationTest`에 추가됐다. 신규 QueryDSL·JPQL·네이티브 조회도 같은 하네스로 결과 동등성, 정렬, null 계약과 실행계획을 계속 검증한다. |
| BE-03 | 🟡 Medium | 성능   | 경계선 프로젝션 후보 9개 운영 근거 재평가                                | 대상: Estimate/Application 마스터, 공통코드, 가이드, 게시판 메타·댓글, 조직 전체 목록, Project/Cost wide 검색, 알림함. 운영 SQL 실행 통계·호출량과 API 응답 계약을 확보한 뒤 컬럼 폭·Cost 절감이 명확할 때만 전환한다. 근거: `docs/superpowers/reports/2026-07-be03-projection-survey.md` §경계선과 제외 근거. |
| BE-06 |  🟢 Low   | 문서   | Javadoc 허용 잔여 경고 점진 정리                                         | 2026-07-21 전수 기준선 1,176건에서 상위 오염원과 요청 DTO 122건을 해소해 1,054건이다. `ApplicationDto` 잔여 11건은 DTO 컨테이너 1건과 builder 전용 응답 10건으로 분류·허용했고, 그 밖의 기존 1,043건은 기능 변경 시 의미 있는 공개 계약부터 점진 정리한다. 신규 미분류 경고는 허용하지 않는다. |
| BE-12 |  🟠 High  | 성능   | 사업 일괄 상세 조회의 ID별 N+1 제거                                      | `ProjectService.getProjectsByIds()`가 ID마다 `getProject()`를 호출하고 사업·결재선·조직·품목을 반복 조회하며 `PlanEvaluationService`도 이를 사용함. 영역별 IN 배치 조회와 메모리 조립으로 전환하고 쿼리 횟수 회귀 테스트 추가                                                                                                                    |
| BE-13 | 🟡 Medium | 성능   | 조정 계획의 기준 계획 탐색 N+1·동률 비결정성 제거                        | `PlanEvaluationService`가 완료 협의회를 순회하며 `planService.getPlan()`을 호출하고 `FST_ENR_DTM DESC`만 사용함. 조건을 DB 조인 단건 조회로 통합하고 `IT_PTL_ASCT_ID DESC` tie-break 및 실행계획 기반 인덱스 검토                                                                                                                                |
| BE-14 | 🟡 Medium | DB     | `TPRMPP_BPLANA` 요청문서번호 역방향 조회 인덱스 검토                     | `BplanaRepository`가 `REQ_DOC_NO + DEL_YN` 단건·IN 조회를 반복하지만 PK 선두는 `ABUS_MNG_NO`이고 보조 인덱스가 없음. 실행계획 검증 후 `(REQ_DOC_NO, DEL_YN, ABUS_MNG_NO)` 인덱스를 새 Flyway로 추가                                                                                                                                              |
| BE-15 | 🟡 Medium | DB     | `Bplana` 복합키 컬럼 길이를 물리 DDL과 통일                              | `ABUS_MNG_NO`, `REQ_DOC_NO` ORM 길이는 32이나 물리 DDL과 관련 엔티티는 30. 31~32자 값이 애플리케이션 검증을 통과한 뒤 Oracle에서 실패하지 않도록 매핑과 검증을 정합화                                                                                                                                                                            |
| BE-16 | 🟡 Medium | 성능   | 공통코드 일괄 업로드의 행별 SELECT·save N+1 제거                         | `AdminService`가 업로드 행마다 복합키 조회와 신규 `save()`를 수행함. 키 집합을 `findAllById` 등으로 선조회하고 메모리 Upsert 후 `saveAll`로 반영                                                                                                                                                                                                 |
| BE-17 | 🟡 Medium | 정책   | 프로젝션 보류 정책 5개 결정 후 재계획                                    | BITEMM GCL 대표행, BBUGTM 대표행, BPROJM 배치 사업명 대표행, BESTTM 물리 PK와 JPA ID 정합화, BITEMM/BCOSTM 키의 `(sourceNamespace,key)` 분리 정책을 각각 확정해야 한다. 결정 전에는 기존 엔티티 1조회와 현재 의미를 유지하며, 승인 기준과 차단 경로는 `docs/superpowers/reports/2026-07-be03-projection-survey.md` §결론과 승인 게이트를 따른다. |
| BE-18 | 🟡 Medium | 정리   | P2 구 검토자 API 경로 제거                                                | 신규 프론트의 전역 `/api/reviews/reviewers` 경로가 운영에 최소 한 릴리스 배포되고, 이후 14일 동안 구 경로 WARN 호출이 0건일 때 `ReviewerController.getReviewersLegacy`와 `/{docMngNo}/reviewers` 계약·테스트를 제거한다. 선행 조건 충족 전에는 호환 경로와 WARN 관측을 유지한다. |

## 🧹 Clean Code 부채

| ID    | 우선순위  | 유형     | 과제                                                                                                    | 근거/조건                                                                                                                                                                                                                                  |
| ----- | :-------: | -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CQ-01 | 🟡 Medium | 리팩터링 | 대형 서비스·컨트롤러를 도메인 경계별로 분해                                                             | 대상: `ProjectService`, `CostService`, `BudgetWorkService`, `CouncilController`. 이번 Clean Code 즉시 개선 범위에서는 제외하고, 기능 변경 시 Query/Command·모듈별 컨트롤러 분리와 테스트 분리를 함께 수행                                  |
| CQ-02 | 🟡 Medium | 리팩터링 | 대형 프론트 composable/page를 하위 composable과 표시 컴포넌트로 분해                                    | 대상: `useCostListPage.ts`, `projects/form.vue`, `plan/[id].vue`, `features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts`. 단일 파일 리팩터링만으로 끝내지 말고 기존 화면 테스트 또는 수동 QA 기준을 먼저 세운 뒤 단계적으로 진행 |
| CQ-03 | 🟡 Medium | 타입     | 프로덕션 코드의 `any`와 `eslint-disable-next-line @typescript-eslint/no-explicit-any`를 도메인별로 제거 | 2026-07-11 스캔 기준 프론트 `app/`/`server/`에 398라인 매칭. 결재/사업집행 4단계 페이지, Tiptap/Excel/PDF, 가이드 문서 CRUD 순서로 기존 타입 재사용 또는 우회 사유 축소                                                                    |
| CQ-04 | 🟡 Medium | 테스트   | PDF/HWPX/Excel 산출물 회귀 테스트 기준 수립                                                             | `features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts`(구 `usePdfReport.ts`) 분해 전후 결과 차이를 검증할 최소 fixture와 스냅샷/구조 검증 기준 필요                                                                              |
| CQ-05 | 🟡 Medium | 테스트   | E2E 핵심 3개 시나리오를 정기 실행 경로에 편입                                                           | 대상: 로그인, 프로젝트 조회/생성, 결재 처리. 로컬 Oracle·인증 데이터 의존성을 정리한 뒤 CI 또는 주기 실행 명령으로 고정                                                                                                                    |
| CQ-06 |  🟢 Low   | 리팩터링 | `Bcostm.update`의 20개 매개변수를 `UpdateCommand` record로 전환                                         | `Bprojm.UpdateCommand` 선례를 따르되 호출부 영향이 넓으므로 비용 도메인 리팩터링과 함께 처리                                                                                                                                               |
| CQ-07 |  🟢 Low   | 스타일   | Java 포맷터 도입과 매직 넘버 상수화 검토                                                                | Spotless/google-java-format 도입 여부를 먼저 결정. Toast `life` 값, 기본 편성률 `100` 등 반복 리터럴은 도메인별 상수로 점진 정리                                                                                                           |
| CQ-08 | 🟡 Medium | 검증     | `AdminMenuController.move` 요청 본문 검증 규칙 재정의                                                   | `MenuDto.MoveRequest.newHrkMnuId`는 루트 이동 시 null이 합법이라 필드 단위 필수 검증을 둘 수 없음. 빈 본문 400 요구가 필요하면 DTO/엔드포인트 수준 규칙을 먼저 합의해야 함                                                                 |
| CQ-09 |  ✅ Done  | 정리     | 파일 업로드 서비스 추출 후 `FileService`의 dead code 제거                                               | 2026-07-19 확인: 업로드 경로 생성·디렉터리 준비·UUID 채번은 `FileUploadUnitService`로 이동했고 `FileService`의 잔여 private 메서드·필드·import는 모두 사용 중. 추출 커밋 `d25dc87` 및 후속 정리 `bb5b64c` 반영                             |
| CQ-10 |  🟢 Low   | 정리     | 미사용 프론트 컴포넌트의 동적 연결 여부 확인 후 제거                                                    | 참조가 없는 `IconActivity.vue`, `ReviewVersionHistory.vue` 후보. `AppDialogHeader.vue`는 `PrevYearCostPickerDialog.vue`에서 사용 중이고 estimate 상세의 `isDone` 후보는 제거되어 대상에서 제외함                                           |
| CQ-11 |  🟢 Low   | 리팩터링 | `default`·`admin` 레이아웃의 중복 앱 셸 공통화                                                          | 두 레이아웃의 Sidebar/Header/main/footer와 `.main-scroll` 구조가 사실상 동일함. 관리자 페이지 사용을 유지하면서 공통 `AppShell` 추출 또는 admin의 default 위임 검토                                                                        |
| CQ-12 |  🟢 Low   | 정리     | 백엔드 Gradle 프로젝트 설명을 실제 서비스명으로 교체                                                    | `build.gradle`의 `description = 'Demo project for Spring Boot'`가 IT Portal 메타데이터와 불일치                                                                                                                                            |
| CQ-13 | 🟡 Medium | 테스트   | JaCoCo 커버리지 검증을 기본 `check` 게이트에 연결                                                       | 70% 기준 태스크는 존재하지만 `test`가 보고서만 후처리하고 `check`도 `jacocoTestCoverageVerification`에 의존하지 않아 명시 실행하지 않으면 기준이 적용되지 않음                                                                             |
| CQ-14 |  🟢 Low   | 정리     | 미사용 REST Docs·Asciidoctor 빌드 설정 제거 또는 문서 생성 경로 완성                                    | 플러그인·의존성·snippets 설정은 있으나 `src/docs`와 REST Docs 테스트 사용이 없고 Asciidoctor 플러그인이 Gradle 10 제거 예정 API 경고의 근원으로 확인됨                                                                                     |

## 📝 Tiptap 변수 입력

| ID     | 우선순위  | 유형   | 과제                                                                    | 근거/조건                                |
| ------ | :-------: | ------ | ----------------------------------------------------------------------- | ---------------------------------------- |
| TIP-02 | 🟡 Medium | 테스트 | E2E 시나리오 2/3/5 자동화                                               | 대상: 사업별, 실DB 갱신, HWPX 내보내기   |
| TIP-03 | 🟡 Medium | 검증   | Tiptap 변수 카테고리 매핑 운영 데이터 검증                              | IT_BUDGET 일반관리비 포함 여부 확인 필요 |
| TIP-05 |  🟢 Low   | 검증   | 변수 칩 표시·다크모드 대비·키보드 삽입·aria-label·모바일 팝업 수동 검증 | 병합 후 UI 접근성/반응형 확인 필요       |
| TIP-06 |  🟢 Low   | 품질   | Tiptap `link`·`underline` 확장 중복 등록 제거                               | 2026-07-20 `/qa`에서 요구사항 정의서 상세 진입 시 중복 확장명 콘솔 경고 재현. 확장 등록 경로를 단일화하고 상세·편집 회귀 테스트 추가 |

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
