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

> 현재 활성 보안 과제 없음. 완료 항목은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다.

_SEC-04·SEC-05 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-19 Remediation Phase 1, SEC-06은 같은 문서의 2026-07-19 배포 정합성 후속, SEC-08·SEC-09는 2026-07-25 보안 트랜잭션 무결성 절을 참조합니다._

## 🤝 사전협의

| ID     | 우선순위  | 유형 | 과제                                                | 근거/조건                                                                                                                                                                                          |
| ------ | :-------: | ---- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REV-01 | 🟡 Medium | 기능 | 사전협의 검토자/세션 status 서버 영속화             | 선행조건: 검토 플로우 실제 인증 연동. `stores/review.ts`의 `completeReview`/`submitForReview`가 메모리 전용이고, `review.vue`의 currentUser와 `ReviewToolbar.vue`의 검토완료 흐름이 모의/수동 상태 |
| REV-02 | 🟡 Medium | 기능 | 검토의견 응답에 작성자 팀명(`authorTeam`) 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts`가 임시값 사용                                                                                                                               |
| REV-03 | 🟡 Medium | 기능 | 검토의견 첨부파일 응답 매핑 추가                    | `useReviewCommentApi.ts`가 `attachments`를 빈 배열로 고정                                                                                                                                          |

## ⚠️ 에러 처리

_활성 에러 처리 과제가 없습니다. ERR-09·ERR-10 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-26 에러 표면화·복구 기록을, ERR-06은 2026-07-19 Remediation Phase 1, ERR-05는 같은 문서의 2026-07-19 배포 정합성 후속 기록을 참조합니다._

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
| FE-08 | 🟡 Medium | 테스트 | `useCostRowEditing.ts`의 `addRow()` 신규 행 기본값 잠금 테스트 추가                                              | `it_frontend/app/composables/costList/useCostRowEditing.ts:267,271`의 `addRow()`가 신규 행의 `abusTc`/`dfrCleC`를 `'0'`(해당없음)으로 초기화하지만 이를 고정하는 Vitest가 없음. `it_frontend/CLAUDE.md` §7(composable 로직 변경 시 Vitest 단위 테스트 필수)이 요구하는 잠금 테스트 보강 필요                        |
| FE-09 | 🟡 Medium | 정합성 | Excel 일괄 업로드 경로가 화면에 빈 코드를 남김                                                                   | `it_frontend/app/components/cost/TerminalTableSection.vue:346`의 Excel 업로드 매핑이 공유 `codeId()` 헬퍼로 `dfrCleC`를 채우는데, 매칭 실패 시 빈 문자열을 반환해 저장·재조회 전까지 화면에 빈 코드가 남는다. `codeId()`는 nullable 코드 컬럼에도 쓰이는 공용 헬퍼라 이 경로에서만 일괄 수정하는 것은 부적절 — 전용 처리 또는 헬퍼 계약 재검토 필요 |
| FE-10 |  🟢 Low   | 정리   | 프론트 `'0'`(해당없음) 리터럴 반복을 공용 상수로 통합                                                            | 5개 파일 8곳에서 `'0'` 리터럴 반복: `TerminalFormDialog.vue:204,208`, `TerminalTableSection.vue:219`, `useCostRowEditing.ts:267,271`, `info/cost/form.vue:444,461`, `ResourceTableSection.vue:151`. 백엔드 `CodeDefaults.NOT_APPLICABLE`에 대응하는 프론트 상수 도입 검토                              |
| FE-11 |  🟢 Low   | UX     | 계약방법 미선택 저장 실패 토스트에 행 식별 정보 없음                                                            | `it_frontend/app/pages/project/bizplan/[abusMngNo].vue:438-443`의 `계약방법을 선택하지 않은 계약 행이 있습니다` 토스트가 어느 행인지 지목하지 않아 계약 행이 많은 화면에서 사용자가 직접 찾아야 한다. 실패한 행 번호를 메시지에 포함하거나 해당 행의 계약방법 필드를 인라인 하이라이트하는 방안 검토 (UX 폴리시, 저우선순위)                              |

## ⚙️ 백엔드

| ID    | 우선순위  | 유형   | 과제                                                                     | 근거/조건                                                                                                                                                                                                                                                                                                                                        |
| ----- | :-------: | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE-03 | 🏛️ External | 성능   | 경계선 프로젝션 후보 9개 운영 근거 재평가                                | 대상: Estimate/Application 마스터, 공통코드, 가이드, 게시판 메타·댓글, 조직 전체 목록, Project/Cost wide 검색, 알림함. 재개 조건(운영 데이터 확보): ① 대상 경로별 AWR/SQL 실행 통계 ② API 호출량 ③ Project/Cost 목록·알림함 응답 계약 분리 결정. 확보 전 구현 착수 금지. 근거: `docs/superpowers/reports/2026-07-be03-projection-survey.md` §경계선과 제외 근거. |
| BE-17 | 🟡 Medium | 정책   | 프로젝션 보류 정책 5개 결정 후 재계획                                    | BITEMM GCL 대표행, BBUGTM 대표행, BPROJM 배치 사업명 대표행, BESTTM 물리 PK와 JPA ID 정합화, BITEMM/BCOSTM 키의 `(sourceNamespace,key)` 분리 정책을 각각 확정해야 한다. 결정 전에는 기존 엔티티 1조회와 현재 의미를 유지하며, 승인 기준과 차단 경로는 `docs/superpowers/reports/2026-07-be03-projection-survey.md` §결론과 승인 게이트를 따른다. |
| BE-18 | 🏛️ External | 정리   | P2 구 검토자 API 경로 제거                                                | 재개 조건: 전역 `/api/reviews/reviewers` 경로가 운영에 1릴리스 배포된 후 14일간 구 경로 WARN 호출 0건. 조건 충족 시 제거 대상: `ReviewerController.getReviewersLegacy`(`/{docMngNo}/reviewers` 라우트 포함)와 `ReviewerControllerTest.getReviewers_구경로호환_200`. 충족 전에는 호환 경로와 WARN 관측 유지. |
| BE-19 | 🟡 Medium | 검증   | `ProjectDto.CreateRequest.abusTc`에 `@NotBlank` 추가 검토                | `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java:217`에 검증 어노테이션이 없어 의미상 누락된 사업구분 값이 서비스 계층에서 `CodeDefaults.orNotApplicable()`로 조용히 `'0'`(해당없음)으로 보정된다(`ProjectDto.java:272`). 누락과 고의적인 '해당없음' 선택을 구분하려면 입력 단계 검증이 필요하다.                        |
| BE-20 | 🟡 Medium | DB     | `TPRMPP_CINFMM.INFM_SD_STS_C` 운영 DEFAULT `'10'`이 앱 코드셋에 없음     | 운영 컬럼 DEFAULT는 `'10'`이나 앱이 실제 쓰는 코드셋은 `Cinfmm.DISPATCH_PENDING`/`SENT`/`FAILED`(01/02/03)뿐이라 DEFAULT가 사실상 도달 불가능한 값이다. 운영과 앱 코드셋의 정합성을 DBA와 함께 확인해야 한다.                                                                    |
| BE-21 |  🟢 Low   | 정책   | `TPRMPP_CDECIM.DCD_TP_C`가 결재선 전 행에 `'10'`(요청)으로 일괄 부여됨   | `ApplicationService.java:189`가 최종결재자를 포함한 결재선 전 행에 `Cdecim.DECISION_TYPE_REQUEST`를 부여해 최종결재자에게도 '요청'이 들어간다. 현재 이 컬럼을 읽는 코드가 없어 무해하나, 결재유형이 실제 의미를 갖는 기능이 추가되면 재검토가 필요하다.                                                          |
| BE-22 | 🟠 High   | 운영   | dev/prod 마이그레이션 적용 전 DBA 인계 노트                              | (a) `V20260724_001`의 `TPRMPP_BESTTM` PK DROP/ADD는 기존 PK가 이미 올바르더라도 무조건 재생성해 유지보수 창에서 비용이 발생한다. (b) `V20260724_002` 적용 전 `TPRMPP_BBIZCM`/`TPRMPP_BBIZCL`.`NOW_CTT_MANR_C` NULL 건수를 반드시 사전 확인해야 한다 — 있으면 RAISE_APPLICATION_ERROR 가드가 마이그레이션 전체를 중단시킨다. 가드에 의해 중단된 경우 Flyway가 실패 시도를 이력에 남겼을 수 있으므로 재적용 전 `flyway repair`가 필요할 수 있다. NULL을 채운 뒤 재실행하는 것은 안전하다 — backfill은 `WHERE ... IS NULL` 조건의 멱등 갱신이고 두 `ALTER ... DEFAULT` 문도 멱등이며, `align_nullable`은 `ALL_TAB_COLUMNS.NULLABLE`을 먼저 확인한 뒤에만 변경한다. (c) `*L` 변경로그 테이블의 backfill은 "당시 값 없음"을 코드값으로 덮어쓰는 이력 변경이므로 감사 이력 관점의 사전 공지가 필요하다. |

## 🧹 Clean Code 부채

| ID    | 우선순위  | 유형     | 과제                                                                                                    | 근거/조건                                                                                                                                                                                                                                  |
| ----- | :-------: | -------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CQ-01 | 🟡 Medium | 리팩터링 | 대형 서비스·컨트롤러를 도메인 경계별로 분해                                                             | 착수 트리거: 대상 4개(`ProjectService`, `CostService`, `BudgetWorkService`, `CouncilController`) 중 해당 도메인의 기능 변경 착수 시, 같은 계획에 Query/Command(조회·변경) 분리와 모듈별 컨트롤러·테스트 분리를 포함해 수행한다. 단독 빅뱅 분해는 하지 않는다 (2026-07-21 Clean Code 로드맵 Wave 3 확정) |
| CQ-06 |  🟢 Low   | 리팩터링 | `Bcostm.update`의 20개 매개변수를 `UpdateCommand` record로 전환                                         | 착수 트리거: 비용 도메인 리팩터링(CQ-01의 `CostService` 분해 포함) 착수 시 `Bprojm.UpdateCommand` 선례(record + 위임 오버로드)를 따라 `Bcostm.update`의 20개 매개변수를 record로 전환하고 호출부를 함께 갱신한다 (2026-07-21 Clean Code 로드맵 Wave 3 확정)                                          |

_CQ-02~05·07~14 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-21 Clean Code Wave 0·1·2와 2026-07-25 정리 이관 절을 참조합니다._

## 📝 Tiptap 변수 입력

| ID     | 우선순위  | 유형   | 과제                                                                    | 근거/조건                                |
| ------ | :-------: | ------ | ----------------------------------------------------------------------- | ---------------------------------------- |
| TIP-02 | 🟡 Medium | 테스트 | Tiptap 사업 변수·실DB·HWPX E2E 인수조건 완성                            | 자동화 subset은 구현했으나 실제 NodeView DOM `data-token`이 없고 HWPX가 최신 resolve값 대신 stale `data-snapshot`을 사용한다. TIP-07·TIP-09 해소 후 expected-failure를 정상 회귀 테스트로 전환. `docs/03-analysis/tiptap-operational-validation.md` 참조 |
| TIP-03 | 🟡 Medium | 정책   | Tiptap CAP_BUDGET 분류 정책을 운영 조회와 정렬                           | 승인/seed/검증 SQL은 `IOE_DVC/HW/SW/CPIT` 4종, `BudgetStatusQueryRepositoryImpl`은 `IOE_DVC/HW/SW` 3종이다. 현재 2026년 CPIT 0건이라 합계가 우연히 일치하며 정책 결정·런타임 정렬 전에는 완료할 수 없음 |
| TIP-05 |  🟢 Low   | 검증   | 변수 칩 표시·다크모드 대비·키보드 삽입·aria-label·모바일 팝업 실화면 재검증 | TIP-07·TIP-08 해소 후 1280×800 밝은/어두운 모드와 390×844에서 실제 브라우저 재검증. 2026-07-26 자동 E2E·코드 점검 발견사항은 `docs/03-analysis/tiptap-accessibility-findings.md` 참조 |
| TIP-06 |  🟢 Low   | 품질   | Tiptap `link`·`underline` 확장 중복 등록 제거                               | 2026-07-20 `/qa`에서 요구사항 정의서 상세 진입 시 중복 확장명 콘솔 경고 재현. 확장 등록 경로를 단일화하고 상세·편집 회귀 테스트 추가 |
| TIP-07 | 🟡 Medium | 결함   | 변수 NodeView의 토큰 DOM 계약과 비동기 해석 즉시 반영 보강                | 렌더링 DOM에 `data-token`이 없고 비동기 해석 결과가 후속 ProseMirror transaction 전까지 LOADING으로 남을 수 있음. `VariableNodeView.vue` 속성 전달과 storage 반응성 경로를 수정하고 RED 회귀 테스트 추가 |
| TIP-08 | 🟡 Medium | 접근성 | 변수 칩 다크모드 대비와 Suggestion 팝업 접근성·모바일 경계 보강           | 다크 배경에서 OK 1.99:1·MISSING 2.46:1·STALE 2.01:1·FORBIDDEN 1.52:1. 팝업에 listbox/option 의미·이름이 없고 right/bottom viewport clamp가 없음. 키보드·390×844 실화면 회귀 포함 |
| TIP-09 | 🟡 Medium | 결함   | HWPX 내보내기 전에 Tiptap 변수를 최신값으로 재해석                         | source `data-snapshot=99억원`, resolve 응답 `125억원`에서 section XML이 99억원을 출력한다. `test.fail` 회귀 assertion이 125억원 포함·99억원 미포함을 실행하며, 제품 수정 시 unexpected pass로 전환되어 annotation 제거를 요구해야 함 |

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
