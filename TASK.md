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

| ID     | 우선순위 | 유형 | 과제                                                           | 근거/조건                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | :------: | ---- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-10 | 🟢 Low   | 의존 | 프론트 `brace-expansion` 1.x/2.x DoS advisory 백포트 반영 대기 | GHSA-mh99-v99m-4gvg(≤5.0.7, 개발·빌드 도구 한정 DoS). 2026-07-26 기준 패치는 5.0.8뿐이며 CJS named export로 minimatch 3.x/9.x와 비호환이라 전역 override 불가(로컬 검증 완료). 5.x 라인은 override로 5.0.8 적용 완료. 1.1.17/2.1.3류 백포트 릴리스 확인 시 `npm update brace-expansion` 후 `npm audit`으로 해소 확인. `npm audit fix --force`는 nuxt/exceljs 다운그레이드를 유발하므로 금지 |
| SEC-11 | 🟡 Medium | 운영 | `it_database` 스크립트의 비밀번호 명령행 인자 노출 개선 | `expdp`/`impdp` 호출부와 `apply-ddl-live.ps1` 등이 비밀번호를 명령행 인자로 받아 프로세스 목록·셸 이력에 노출될 수 있음(2026-07-26 아키텍처 리뷰 이행 보안 리뷰 MEDIUM, #7 후속). 프롬프트 입력/표준입력/Oracle Wallet 방식 검토. 관련하여 BOM 없는 한글 포함 `.ps1` 3종(`it_database/apply-ddl-live.ps1`·`export-ddl-live.ps1`, `it_backend/scripts/generate-jwt-secret.ps1`)의 PowerShell 5.1 오파싱 가능성 점검 포함 |

> 완료 항목은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다.

_SEC-04·SEC-05 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-19 Remediation Phase 1, SEC-06은 같은 문서의 2026-07-19 배포 정합성 후속, SEC-08·SEC-09는 2026-07-25 보안 트랜잭션 무결성 절을 참조합니다._

## 🤝 사전협의

> 현재 활성 사전협의 과제 없음. 2026-07-26 완료·폐기 항목은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다.

## ⚠️ 에러 처리

_활성 에러 처리 과제가 없습니다. ERR-09·ERR-10 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-26 에러 표면화·복구 기록을, ERR-06은 2026-07-19 Remediation Phase 1, ERR-05는 같은 문서의 2026-07-19 배포 정합성 후속 기록을 참조합니다._

## 🎨 프론트엔드

> 2026-07-26 잔여과제 통합 조치의 완료·폐기 이력은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다.

| ID    | 우선순위  | 유형   | 과제                                                                                                             | 근거/조건                                                                                                                                                                                                                                                      |
| ----- | :-------: | ------ | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-12 |  🟢 Low   | 도구   | OpenAPI 타입 codegen 도입 검토 (openapi-typescript vs orval 비교 스파이크)                                       | 백엔드 OpenAPI 스펙 기반 프론트 타입 자동 생성으로 수기 DTO 타입 드리프트를 방지할 수 있는지 별도 스파이크로 비교 검토 (2026-07-08 아키텍처 리뷰 #14 위임)                                                                                                                                          |
| FE-13 |  🟢 Low   | 정리   | 정적 미리보기 파일 위치 규약 통일                                                                                | `it_frontend` 정적 미리보기 파일이 `docs/design/`과 `docs/preview/` 두 위치에 혼재. 하나의 위치로 통합하는 규약 확정 검토 (2026-07-26 아키텍처 리뷰 이행 #9 후속)                                                                                                                                    |

## ⚙️ 백엔드

| ID    | 우선순위  | 유형   | 과제                                                                     | 근거/조건                                                                                                                                                                                                                                                                                                                                        |
| ----- | :-------: | ------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE-03 | 🟡 Medium | 성능   | 프로젝션 1차 적용 완료 — 운영 관측 조정·잔여 계약 분리                   | 2026-07-27 1차 적용 완료(6개 묶음 전부 + 가이드 목록 계약 분리, 사용자 승인): it_backend `feature/be03-conservative-projections`(11커밋, `7e73d18`…`b6714db`) + it_frontend `feature/be03-guide-list-split`(2커밋, `c23413a`·`8b45d3a`), 계획 `docs/superpowers/plans/2026-07-27-be03-conservative-projections.md`. **잔여**: ① 운영 관측(AWR/호출량) 후 컬럼 추가 축소 조정 ② Project/Cost wide 검색·알림함 응답 계약 분리 결정 ③ BBUGTM·`ProjectKeyView` 프로젝션 재계획(BE-17 후속) ④ 병합 후 `versions.lock` 갱신(`scripts/update-versions-lock.ps1`). 배포 주의: 가이드 목록 계약 변경(`feat!`)으로 **"신 백엔드+구 프론트" 혼재 구간 금지** — 함께 배포하거나, 간극이 불가피하면 **프론트 선배포 → 백엔드 후배포**(신 프론트는 구 백엔드와 호환: 목록 잉여 본문 무시+단건 API 기존재. 반대 조합은 구 프론트가 빈 본문 PUT으로 데이터 유실 위험). 병합(커밋 이력) 순서는 4-repo 규약대로 백엔드 계약 먼저. 근거: `docs/superpowers/reports/2026-07-be03-projection-survey.md`. |
| BE-25 | 🟡 Medium | 캐시   | AdminService 공통코드 CRUD의 CacheEvict 공백                             | `AdminService`의 코드 CRUD(`createCode`/`updateCode`/`deleteCode`/`bulkUpsertCodes`)는 `CodeService`와 같은 `CodeRepository`를 쓰지만 `@CacheEvict`가 전혀 없어 관리자 화면에서 코드를 변경해도 `codesByCid`/`budgetPeriod` 캐시가 무효화되지 않는다(1시간 TTL 안전망에만 의존). 2026-07-27 BE-03 조사에서 확인. 영향 범위에 맞는 CacheEvict 적용 필요. |
| BE-26 |  🟢 Low   | 성능   | `AdminService.getOrganizations`의 등록·변경자명 단건 반복 조회(N+1)      | `toOrgResponse`가 행마다 `resolveUserName`을 단건 호출한다. 기존 `UserRepository` 이름 배치 조회(`findNameViewsByEnoIn` 류)로 전환 검토. 조직 12건 규모라 위험도 낮음(2026-07-27 BE-03 조사). |
| BE-27 |  🟢 Low   | 테스트 | Oracle IT 공유 조직 fixture(`"120"`) 격리                                | `OrganizationNameProjectionIt`·`UserReadProjectionIt`·`CommitteeUserProjectionIt`가 같은 조직코드 `"120"` 행을 각자 upsert/변형해 공유한다. 현재 순차 실행에서는 안전하나 Gradle 병렬 테스트 도입 시 경합 위험 — 클래스별 접두사 코드로 격리 검토(2026-07-27 BE-03 리뷰 지적). |
| BE-24 |  🟢 Low   | 성능   | `getSummary` 표시명 병합 블록의 잔여 encounter-order 채택 2곳            | BE-17 최종 리뷰에서 발견된 계획 범위 외 잔여 지점: `BudgetWorkService.getSummary`의 표시명 병합 블록에서 대표 ioeC를 `ioeCodes.get(0)`으로, 편성률을 `allRecords...findFirst()`로 채택한다(2026-07-27 기준 약 588·622행, `c5be086` 이전부터 존재). BE-17 결정 #2와 같은 원칙(대표 편성행 기준)으로 정리 검토. 위험도 낮음 — 같은 표시명 그룹 내 값 차이가 드묾. |
| BE-18 | 🏛️ External | 정리   | P2 구 검토자 API 경로 제거                                                | 재개 조건: 전역 `/api/reviews/reviewers` 경로가 운영에 1릴리스 배포된 후 14일간 구 경로 WARN 호출 0건. 조건 충족 시 제거 대상: `ReviewerController.getReviewersLegacy`(`/{docMngNo}/reviewers` 라우트 포함)와 `ReviewerControllerTest.getReviewers_구경로호환_200`. 충족 전에는 호환 경로와 WARN 관측 유지. |
| BE-19 | 🟡 Medium | 검증   | `ProjectDto.CreateRequest.abusTc`에 `@NotBlank` 추가 검토                | `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java:217`에 검증 어노테이션이 없어 의미상 누락된 사업구분 값이 서비스 계층에서 `CodeDefaults.orNotApplicable()`로 조용히 `'0'`(해당없음)으로 보정된다(`ProjectDto.java:272`). 누락과 고의적인 '해당없음' 선택을 구분하려면 입력 단계 검증이 필요하다.                        |
| BE-20 | 🟡 Medium | DB     | `TPRMPP_CINFMM.INFM_SD_STS_C` 운영 DEFAULT `'10'`이 앱 코드셋에 없음     | 운영 컬럼 DEFAULT는 `'10'`이나 앱이 실제 쓰는 코드셋은 `Cinfmm.DISPATCH_PENDING`/`SENT`/`FAILED`(01/02/03)뿐이라 DEFAULT가 사실상 도달 불가능한 값이다. 운영과 앱 코드셋의 정합성을 DBA와 함께 확인해야 한다.                                                                    |
| BE-21 |  🟢 Low   | 정책   | `TPRMPP_CDECIM.DCD_TP_C`가 결재선 전 행에 `'10'`(요청)으로 일괄 부여됨   | `ApplicationService.java:189`가 최종결재자를 포함한 결재선 전 행에 `Cdecim.DECISION_TYPE_REQUEST`를 부여해 최종결재자에게도 '요청'이 들어간다. 현재 이 컬럼을 읽는 코드가 없어 무해하나, 결재유형이 실제 의미를 갖는 기능이 추가되면 재검토가 필요하다.                                                          |
| BE-22 | 🟠 High   | 운영   | dev/prod 마이그레이션 적용 전 DBA 인계 노트                              | (a) `V20260724_001`의 `TPRMPP_BESTTM` PK DROP/ADD는 기존 PK가 이미 올바르더라도 무조건 재생성해 유지보수 창에서 비용이 발생한다. (b) `V20260724_002` 적용 전 `TPRMPP_BBIZCM`/`TPRMPP_BBIZCL`.`NOW_CTT_MANR_C` NULL 건수를 반드시 사전 확인해야 한다 — 있으면 RAISE_APPLICATION_ERROR 가드가 마이그레이션 전체를 중단시킨다. 가드에 의해 중단된 경우 Flyway가 실패 시도를 이력에 남겼을 수 있으므로 재적용 전 `flyway repair`가 필요할 수 있다. NULL을 채운 뒤 재실행하는 것은 안전하다 — backfill은 `WHERE ... IS NULL` 조건의 멱등 갱신이고 두 `ALTER ... DEFAULT` 문도 멱등이며, `align_nullable`은 `ALL_TAB_COLUMNS.NULLABLE`을 먼저 확인한 뒤에만 변경한다. (c) `*L` 변경로그 테이블의 backfill은 "당시 값 없음"을 코드값으로 덮어쓰는 이력 변경이므로 감사 이력 관점의 사전 공지가 필요하다. |
| BE-23 | 🏛️ External | 운영   | SSO 벤더 배포물(`it_backend/sso/`) 사내 아티팩트 저장소 이전             | 보관 위치 팀 합의 필요. 현재 상태: 로컬 사본만 유지 중이며 git 추적 해제 완료, `sso/README.md`(보존 거버넌스)만 추적 유지 (2026-07-26 아키텍처 리뷰 이행 #8 후속)                                                                                                                                |

## 🧹 Clean Code 부채

| ID    |   우선순위    | 유형   | 과제                                                                          | 근거/조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | :-------: | ---- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CQ-01 | 🟡 Medium | 리팩터링 | 대형 서비스·컨트롤러를 도메인 경계별로 분해                                                    | 착수 트리거: 대상 4개(`ProjectService`, `CostService`, `BudgetWorkService`, `CouncilController`) 중 해당 도메인의 기능 변경 착수 시, 같은 계획에 Query/Command(조회·변경) 분리와 모듈별 컨트롤러·테스트 분리를 포함해 수행한다. 단독 빅뱅 분해는 하지 않는다 (2026-07-21 Clean Code 로드맵 Wave 3 확정). 출처: `docs/clean-code-review-2026-07-07.md` §5 4순위, `docs/superpowers/specs/architecture-review-2026-07-08.md` #10 후속 위임(2026-07-26 재실측 `ProjectService` 1,478줄·`CouncilController` 1,279줄·`CostService` 1,142줄·`BudgetWorkService` 1,119줄 — 리뷰 시점 대비 증가 중) |
| CQ-06 |  🟢 Low   | 리팩터링 | `Bcostm.update`의 20개 매개변수를 `UpdateCommand` record로 전환                       | 착수 트리거: 비용 도메인 리팩터링(CQ-01의 `CostService` 분해 포함) 착수 시 `Bprojm.UpdateCommand` 선례(record + 위임 오버로드)를 따라 `Bcostm.update`의 20개 매개변수를 record로 전환하고 호출부를 함께 갱신한다 (2026-07-21 Clean Code 로드맵 Wave 3 확정)                                                                                                                                                                                                                                                                                              |
| CQ-15 | 🟡 Medium | 리팩터링 | 프론트 잔여 800줄 초과 파일 분해                                                        | 2026-07-08 아키텍처 리뷰 시점 24개 → 2026-07-26 재실측 29개 파일이 800줄 상한 초과(악화, 최대 `utils/hwpx.ts` 1,502줄). `docs/clean-code-review-2026-07-07.md` §5 4순위 및 clean-code wave 후속으로 위임 (`docs/superpowers/specs/architecture-review-2026-07-08.md` #11)                                                                                                                                                                                                                                                       |
| CQ-16 |  🟢 Low   | 리팩터링 | `components/` 루트 평면 파일을 `components/editor`·`components/layout` 신설 디렉터리로 이동 | `components/` 루트에 평면 파일 25개 혼재(Tiptap·노드뷰 계열 9, Excalidraw 2, 앱 크롬 10 등). `components/editor/`·`components/layout/`을 신설해 이동하고 tiptap-extensions 계열도 editor 하위로 정리. clean-code wave 후속으로 위임 (`docs/superpowers/specs/architecture-review-2026-07-08.md` #12)                                                                                                                                                                                                                                  |

_CQ-02~05·07~14 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-21 Clean Code Wave 0·1·2와 2026-07-25 정리 이관 절을 참조합니다._

## 📝 Tiptap 변수 입력

> 현재 활성 Tiptap 변수 입력 과제 없음. 2026-07-26 완료·폐기 항목과 알려진 제한은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다.

## 📡 실시간 로그

| ID     | 우선순위 | 유형 | 과제                                                 | 근거/조건                                                                                               |
| ------ | :------: | ---- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| LOG-03 |  🟢 Low  | 확장 | SSE 또는 WebSocket push 실제 전환                    | 운영 임계치와 feature flag 설계는 문서화 완료. 관리자 수·트래픽 증가 시 별도 기능으로 구현              |
| LOG-04 |  🟢 Low  | 운영 | 로그 데이터 보존 정책 시행과 아카이브 운영 절차 확정 | 테이블 분리 없이 View/운영 설정 기준 문서화 완료. 실제 보존기간·아카이브 운영 기준은 운영 의사결정 필요 |

## 📬 공통 게시판

| ID     | 우선순위  | 유형 | 과제                                             | 근거/조건                                                              |
| ------ | :-------: | ---- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| BRD-02 |  🟢 Low   | 성능 | 본문 검색 Oracle Text 인덱스 도입                | 게시판당 1만 건 또는 검색 1초 초과 시                                  |
| BRD-03 |  🟢 Low   | 성능 | 조회수 카운터 Redis 전환                         | 다중 인스턴스 운영 시                                                  |
| BRD-05 |  🟢 Low   | 기능 | 첨부파일 다운로드 카운트 컬럼(`FL_DWN_NBR`) 추가 | 자료실 인기 자료 통계                                                  |
| BRD-06 |  🟢 Low   | 기능 | 댓글 첨부파일 지원                               | `ORC_DTT="공통게시판댓글"` 추가                                        |

## 🔌 EAI

| ID     |  우선순위   | 유형 | 과제                                                                          | 근거/조건                                                               |
| ------ | :---------: | ---- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| EAI-01 | 🏛️ External | 운영 | KDB EAI 운영팀으로부터 IT Portal 전용 IF_ID 및 UMS 템플릿 발급·확정           | 시스템 식별자 IPP/PRM/PP는 프로퍼티로 확정                              |
| EAI-02 | 🏛️ External | 운영 | 운영 프로파일에서 `eai.enabled=true` + `eai.url` 주입 및 배포 체크리스트 반영 | 코드 설정은 환경변수 기반. 실제 운영 `EAI_URL` 주입·검증 필요           |
| EAI-05 | 🏛️ External | 운영 | 발신채널 상수 IT Portal 발신처 교체 필요성 확인                               | 현재 값: `1588-1500`, `hrd@kdb.co.kr`                                   |
| EAI-06 | 🏛️ External | 운영 | GWE 전문 실제 규칙 KDB 확인                                                   | `RMS_SYS_C`, `IF_ID`, `MSG_KEY` 접두, 발신자 상수, `SYSTEM_CODE` 운영값 |
| EAI-07 |   🟢 Low    | 확장 | 신규 시스템 연동 시 EaiPayload + EaiPayloadSection 1쌍 추가 패턴 유지         | 플러그형 확장 규칙                                                      |
