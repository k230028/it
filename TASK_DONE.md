# ✅ IT Portal 완료·종료 내역 (Archive)

> 🗓️ **기준일:** 2026-09-18
> 🎯 **목적:** [`TASK.md`](TASK.md)에서 분리한 완료(✅)·해소(✔️)·감내(☑️)·폐기(⛔) 항목을 보관합니다.

### 🔑 범례 (Legend)

| 상태 | 의미 |
| :--: | --- |
| ✅ Done | 완료 |
| ✔️ Resolved | 해소(거짓양성 등) |
| ☑️ Accepted | 감내(업스트림 미해결) |
| ⛔ Discarded | 사용자 범위 결정으로 폐기 |

---

### ✅ 2026-09-18 예산 첨부 삭제 권한 개선·로컬 검증

| ID | 상태 | 조치 | 근거 |
| --- | --- | --- | --- |
| BE-115 | ✅ Done | 정보화사업·경상사업·전산업무비·금융단말 첨부를 업로더 본인·주관부서 사용자·시스템관리자가 단건·일괄 삭제하도록 개선. 사업 첨부 삭제 차단 분리 해제, 파일 연결 변경·다른 종류의 보호 유지 | [설계](docs/superpowers/specs/done/2026-09-18-budget-attachment-deletion-design.md) · [분석설계서](docs/design-docs/2026-09-18-analysis-design-since-260918.md) · [결과서](docs/test-docs/2026-09-18-test-result-since-260918.md) |

- 검증: 최종 시나리오 9건 통과(JUnit 144건·Vitest 25건·E2E 4건), 실DB 인계 확인 1건 미실시. 앞선 백엔드 전체 실행 5,573건 통과·2건 건너뜀, check·bootJar 통과. 프론트 check·format:check 통과.
- 구현 완료 계획: [BE-115](docs/superpowers/plans/done/2026-09-18-budget-attachment-deletion.md). 테스트 결과서·PDF·증적은 기존 정책에 따른 로컬 산출물. 최초 검증 시점에는 로컬 변경만 존재. 이후 사용자 요청으로 백엔드 `362703ec`·프론트 `8661c5cb`를 원격 main에 push했으며 호환 조합은 `versions.lock`에 기록. DB 변경·실서버 배포 없음.

### ✅ 2026-09-17 사용자 요청 4건 구현·로컬 검증

| ID | 상태 | 조치 | 근거 |
| --- | --- | --- | --- |
| FE-89 | ✅ Done | 주요일정·FAQ·가이드 일반 사용자 작성·편집 숨김, 관리자 유지 | [결과서](docs/test-docs/2026-09-17-test-result-since-260917.md) TC-01~03 |
| FE-90 | ✅ Done | 증감사유 200바이트 입력·저장 제한, 일괄 선택 컬럼 및 너비 조정 | [결과서](docs/test-docs/2026-09-17-test-result-since-260917.md) TC-04~07 |
| FE-91 | ✅ Done | 직원정보 연락 버튼 5종 일반 사용자 노출, 기존 호출 유지 | [결과서](docs/test-docs/2026-09-17-test-result-since-260917.md) TC-08~09 · 외부 실호출 TC-13 대기 |
| FE-92 | ✅ Done | 전결권 30~35 로컬 등록·선택 다이얼로그·수동값 재계산 방지 | [결과서](docs/test-docs/2026-09-17-test-result-since-260917.md) TC-10~12 · 로컬 DB 검증 제약은 결과서 참조 |

- 검증: 프런트 단위 242건·백엔드 124건·E2E 6건 통과. 호환 커밋은 `versions.lock` 참조.
- 테스트결과서·PDF·실행 증적은 `.gitignore` 정책에 따른 로컬 산출물. 운영 배포·DBA 적용·실연동 확인은 별도.

### ✅ 2026-09-12 문서 현행화(it-doc-sync) 등재 19건 일괄 조치

2026-09-12 문서 현행화에서 등재한 SEC-24, BE-107~114, FE-84~86, CQ-47~50, REPO-05·06을 같은 날 모두 조치했다. 코드 변경은 TDD(실패 테스트 → 최소 구현)로 진행했고, 원래 표는 [`TASK.md`](TASK.md) 2026-09-12 절에 있던 것을 여기로 옮겼다.

| ID | 상태 | 조치 | 근거 |
| --- | --- | --- | --- |
| SEC-24 | ✅ Done | `ServerMetricsController`에 클래스 `@PreAuthorize("hasRole('ADMIN')")` 추가, 일반 사용자 403 컨트롤러 테스트 추가(RED 200→GREEN 403) | `it_backend/.../common/admin/metrics/controller/ServerMetricsController.java`, `ServerMetricsControllerTest.java` |
| BE-107 | ✅ Done | 전결권 안내 신규 문서 접두사를 `APOP-`로 분리. 기존 `PDOC-` 행은 PK·BGDOCL·CFILEM 참조 때문에 개명하지 않고 조회가 `DOC_TTL_CONE`+`DOC_DTL_ITM_C`만 쓰는 점을 JavaDoc·data-model 가이드에 명시 | `CommonPopupService.java`, `CommonPopupServiceTest.java`, `it_backend/docs/guides/persistence/data-model.md` |
| BE-108 | ✅ Done | `ProjectRepository.ProjectDirectoryView` 10컬럼 프로젝션 + `(관리번호, 순번)` 내림차순 + `Limit 500`(목록 API `MAX_LIST_ROWS`와 동일). Oracle `ProjectDirectoryProjectionIt` 실제 실행 통과. 트레이드오프: 최종본 사업 500건 초과 시 전역검색에서 가장 오래된 사업이 빠진다 | `ProjectRepository.java`, `ProjectDirectoryService.java`, `ProjectDirectoryServiceTest.java`, `ProjectDirectoryProjectionIt.java` |
| BE-109 | ✅ Done | `ServerMetricsProperties`를 `Long`/`Integer`로 바꿔 미설정만 기본값, `<=0`은 속성명을 담은 `IllegalArgumentException` | `ServerMetricsProperties.java`, `ServerMetricsPropertiesTest.java` |
| BE-110 | ✅ Done | `CookieUtil`이 `jwt.sso-verified-validity`를 읽어 `sso-verified` 쿠키 Max-Age를 초 단위 올림(최소 1초)으로 맞춤 | `CookieUtil.java`, `CookieUtilTest.java`, `it_backend/docs/guides/integrations/sso.md` |
| BE-111 | ✅ Done | 신청일자 null 대기 건은 `urgency="unknown"`·`requestedAt=null`로 표면화하고 WARN 로그. **OpenAPI 계약 변경**(`ApprovalPendingItem.requestedAt` nullable, `urgency` enum에 `unknown`) → 프론트 `npm run codegen` 재생성·`codegen:check` 드리프트 없음. 프론트 `ApprovalHomeInboxCard`는 이미 `requestedAt || '-'`로 null을 처리 | `ApplicationDashboardService.java`, `ApplicationDto.java`, `ApplicationDashboardServiceTest.java`, `it_frontend/app/types/api.d.ts` |
| BE-112 | ✅ Done | `spring.task.scheduling.pool.size=4`와 4개 작업 주석. `SchedulingPoolSizeTest`가 main 클래스의 `@Scheduled` 수가 풀 크기를 넘지 않는지 고정(RED에서 4개 나열) | `application.properties`, `config/SchedulingPoolSizeTest.java` |
| BE-113 | ✅ Done | `V20260907_002` 단계별 파괴 지점·복구 입력·백업 테이블 30일 정리 규칙을 담은 운영 인계와 사후 assert SQL 작성, backlog·migrations 가이드에서 링크 | `it_database/docs/operations/2026-09-12-project-content-clob-and-bgdoc-type-handover.md`, `it_database/docs/verification/V20260907_002__ClassifyGuideDocumentsAndExpandProjectContent.verify.sql` |
| BE-114 | ✅ Done | 빈 `V20260907_001`은 checksum 보존을 위해 그대로 두고 운영도 빈 버전으로 적용하도록 위 인계에 기록. `migrations.md`에 번호 선점 시 한 줄 주석 규칙 추가 | `it_database/docs/guides/migrations.md` |
| FE-84 | ✅ Done | `useAssignableEmployee`가 부서명 조회 실패 시 `null`+`departmentNameError`를 돌려주고 `retryDepartmentName()` 제공. 단말기 Excel 업로드는 부서 공용 담당자 행이 있는데 부서명을 모르면 중단·경고(i18n `cost.terminal.table.writerDepartmentUnavailable`) | `useAssignableEmployee.ts`, `useTerminalExcelTransfer.ts`, `i18n/messages/cost.ts`, 각 테스트 |
| FE-85 | ✅ Done | `Terminal.sno`는 `number \| null \| undefined`이고 `addRow`는 `sno`를 넣지 않으므로 `isNewLocalRow`를 `sno == null`로 단순화, 캐스트 제거 | `useCostConflictMerge.ts`, 테스트 |
| FE-86 | ✅ Done | `RETIRE_PDF_PREVIEW_SW_UNTIL='2026-10-12'` 만료일 도입, 만료 후 브라우저 API 미접근 no-op. **2026-10-12 이후 플러그인·유틸·테스트 삭제** | `retirePdfPreviewServiceWorker.ts`, `retire-pdf-preview-sw.client.ts`, 테스트, `scripts/user-facing-copy-allowlist.json` |
| CQ-47 | ✅ Done | `AuthService.isLoginBlocked`가 `BranchCodes.isForeign`을 사용, 변수·JavaDoc을 국외점포 의미로 정정(null/빈 값 동작 동일, 특성화 테스트 추가) | `AuthService.java`, `AuthServiceTest.java` |
| CQ-48 | ✅ Done | 델타의 `as unknown as T` 5파일 전부 제거(오버로드·타입 가드·`Reflect.get/set` 헬퍼). 남긴 캐스트 없음 | `useCostFormSave.ts`, `useCostPersistence.ts`, `useCostConflictMerge.ts`, `project/useResourceAmountFocus.ts`, `CostConflictMergeDialog.vue` |
| CQ-49 | ✅ Done | 그룹 분류를 읽는 곳이 없어 `adminLogMenuGroups`·`getAdminLogMenuItem`·eslint-disable·관련 import 삭제 | `AppSidebar.vue` |
| CQ-50 | ✅ Done | `.compile-warn.log`를 `git rm --cached`로 추적 해제하고 `.gitignore`에 `*.log` 추가(스테이징만, 미커밋) | `it_backend/.gitignore` |
| REPO-05 | ✅ Done | 완료 계획 7건·spec 5건을 `done/`으로 이동하고 TASK_DONE·운영 기록·계획 내부 링크 갱신. 백엔드 `docs/superpowers/specs/2026-08-10-jdk-25-…`를 루트 `specs/done/`으로 이관 | `docs/superpowers/plans/done/`, `docs/superpowers/specs/done/` |
| REPO-06 | ✅ Done | 가이드 콘텐츠 이관 계획 상단에 "보류" 상태와 재개 조건 명시 | `docs/superpowers/plans/2026-09-01-guide-content-migration.md` |

**검증:** 백엔드 `spotlessCheck` 통과, `./gradlew test` 5,487건 실패 0(스킵 2), Oracle `integrationTest --tests '*ProjectDirectoryProjectionIt'` 통과. 프론트 `prettier --check`·`npm run check`(0 errors, 28 기존 warnings) 통과, `npx vitest run` 496 파일 5,595건 통과, `codegen:check` 드리프트 없음. 커밋·푸시는 하지 않았다.

### ✅ 2026-09-09~10 첨부 기능 후속 6건 (TASK.md에서 2026-09-12 이관)

반입 원본 파일 다이얼로그와 전산업무비·금융정보단말기 첨부 기능([`docs/superpowers/specs/done/2026-09-09-import-source-and-cost-attachments-design.md`](docs/superpowers/specs/done/2026-09-09-import-source-and-cost-attachments-design.md)) 최종 리뷰에서 범위 밖으로 분류한 후속 항목입니다. 2026-09-10에 모두 조치했습니다.

| ID     | 우선순위 | 상태   | 과제                                                                                                                                                                                                                                                                                                                                                                                | 다음 조치                                                                                                                                                                                                                          | 근거 문서                                                                                                                                                    |
| ------ | :------: | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FE-79  |   보통   | ✅ Done (2026-09-10) | `TerminalFormDialog`의 첨부 재시도 상태(`pendingAttachmentRetryCostBgNo`, `pendingAttachmentRetrySnapshotCurrent`)와 `savedTerminalSnapshot`이 다이얼로그를 닫거나 대상을 바꿔도 남아, 첨부 동기화 실패 뒤 다른 전산업무비로 다시 열면 이전 costBgNo를 가리키는 재시도 버튼과 강제 view 모드가 따라왔다 | 해결: `resetAttachmentRetryState()`를 열림·닫힘 watcher와 대상(`itMngcNo`·`parentCostId`) 변경 watcher에서 호출해 세 상태를 함께 버린다. 첨부 동기화 실패로 재시도 버튼이 남은 채 다른 관리번호로 다시 열면 버튼이 사라지고 테이블이 edit 모드로 돌아오는지 회귀 테스트로 고정했다 | `it_frontend/app/components/cost/TerminalFormDialog.vue`, `it_frontend/tests/unit/components/cost/TerminalFormDialog.test.ts` |
| FE-80  |   보통   | ✅ Done (2026-09-10) | 전산업무비 개별 수정 화면(`/info/cost/form`)의 첨부 섹션이 `isSubmitting`만으로 잠겨, 요청 왕복이 끝난 뒤 병합 확인이 진행 중인 구간에서는 잠금이 풀렸다. 금융정보단말기 다이얼로그에는 같은 문제를 operation lock으로 막았지만 폼 경로는 미적용이었다 | 해결: `useCostFormSave`에 조작 단위 잠금 `isSaveOperationLocked`를 두고 저장 요청부터 본문 PUT·첨부 동기화까지, 그리고 병합 다이얼로그가 열려 있는 동안 유지한다. 병합 확정·취소·예외·검증 실패는 모두 잠금을 푼다. 화면은 이 값으로 첨부 섹션을 잠그고 모델 갱신·삭제 예약 핸들러도 막으며, `CostFormActions`에 `saving`을 넘겨 행 추가·임시저장·저장 버튼을 비활성화한다 | `it_frontend/app/composables/cost/useCostFormSave.ts`, `it_frontend/app/pages/info/cost/form.vue`, `it_frontend/app/components/cost/CostFormActions.vue` |
| FE-82  |   보통   | ⛔ Discarded (2026-09-10, 기능 철회) | Excalidraw 커스텀 글꼴 적용 시 도형에 묶인 텍스트(`containerId` 보유)의 줄바꿈을 다시 계산하지 않아, 글자 폭이 크게 다른 글꼴로 바꾸면 도형 밖으로 넘쳤다. 라이브러리의 `redrawTextBoundingBox`가 export되지 않아 `excalidraw-text-metrics.ts`가 글꼴·폭·높이만 갱신했다 | 해결: 0.17.x의 `wrapText`·`parseTokens`·`getBoundTextMaxWidth`/`MaxHeight`·`computeContainerDimensionForBoundText`·`getContainerCoords`·`computeBoundTextPosition`을 같은 규칙으로 이식했다. `applyFontFamily`는 `originalText`에서 줄바꿈을 다시 계산해(끊긴 자리 누적 방지) 도형 폭에 맞추고, 새 텍스트가 도형을 넘치면 도형 치수를 늘린 뒤 정렬 기준으로 텍스트 좌표를 다시 잡는다. 사각형·타원·마름모·화살표 라벨을 모두 다룬다. 좁은 도형 + 긴 한글 회귀 테스트를 추가했다 | `it_frontend/app/utils/excalidraw-text-metrics.ts`, `it_frontend/tests/unit/utils/excalidraw-text-metrics.test.ts` |
| FE-83  |   낮음   | ⛔ Discarded (2026-09-10, 기능 철회) | Excalidraw 내보내기 SVG에 커스텀 글꼴만 base64로 담고 내장 글꼴(Virgil·Cascadia)은 담지 않아, 손글씨·코드 글꼴로 쓴 다이어그램이 HWPX 내보내기에서 대체 글꼴로 떨어졌다. 라이브러리가 넣는 `@font-face`는 `https://unpkg.com/...`을 가리켜 폐쇄망에서 죽은 링크다 | 해결: 패키지의 `Virgil.woff2`·`Cascadia.woff2`를 `?url`로 가져와 커스텀 글꼴과 같은 방식으로 인라인한다. `EXCALIDRAW_INLINABLE_FONT_FAMILY`와 `collectUsedInlinableFonts`가 장면이 실제로 쓰는 글꼴만 고르며, 같은 font-family는 나중 선언이 이기므로 라이브러리 블록 뒤에 붙여 죽은 URL을 대체한다. 파일이 없는 Helvetica는 대상에서 제외한다 | `it_frontend/app/utils/excalidraw-fonts.ts`, `it_frontend/tests/unit/utils/excalidraw-fonts.test.ts` |
| BE-106 |   보통   | ✅ Done (2026-09-10) | 전산업무비 생성 API(`POST /api/cost`)가 담당부서코드(`costSvnDpmC`)가 빈 요청을 그대로 저장했다. 목록·건수 조회는 부서 범위로 거르므로 부서 없는 행은 등록 성공 안내 뒤 어느 부서 목록에도 나타나지 않았다(관리자 전체 범위에서만 노출) | 해결: `CostDto.CreateRequest.costSvnDpmC`에 `@NotBlank`를 걸어 `POST /api/cost`와 `POST /api/cost/{itMngcNo}/linked-costs` 모두 빈 부서를 400으로 막고 서비스 호출까지 가지 않는 것을 컨트롤러 테스트로 고정했다. 이관 전용 경로는 부서 없는 행을 만들지 않음을 확인했다 — 반입 폼은 부서코드 해석 실패 시 파일을 미해석으로 차단하고(`RequestFormImportService`), 단말기 일괄업로드는 `resolveOrg`가 예외를 던진다. 필수화로 OpenAPI `required`가 바뀌어 프론트 `app/types/api.d.ts`를 재생성했다 | `it_backend/src/main/java/com/kdb/it/domain/budget/cost/dto/CostDto.java`, `it_backend/src/test/java/com/kdb/it/domain/budget/cost/controller/CostControllerTest.java` |
| FE-81  |   낮음   | ✅ Done (2026-09-10) | 2026-09-09에 정보화사업·전산업무비 작성 화면의 자동 임시저장을 제거한 뒤, 자동저장만 쓰던 저장 옵션 `background`(필수 검증·첨부 반영·완료 다이얼로그 생략)에 운영 호출자가 없는데도 단위 테스트 20여 곳이 조용한 저장 경로로 쓰고 있었다 | 해결: `useCostFormSave.saveCosts`와 `useProjectFormSave.saveProject`·`executeSave`에서 `background` 옵션과 그 분기를 모두 제거했다. 해당 테스트는 수동 저장 경로로 옮기고, 옵션 자체를 검증하던 테스트 3건은 함께 삭제했다. 사업 저장 실패 안내가 background 전용 토스트 분기 없이 확인 다이얼로그 하나로 통일된다 | `it_frontend/app/composables/cost/useCostFormSave.ts`, `it_frontend/app/features/project/useProjectFormSave.ts` |

### ✅ 2026-09-08 전산업무비 동시성 병합 후속 12건 (TASK.md에서 2026-09-12 이관)

전산업무비 동시성 스탬프·병합 기능([`docs/superpowers/specs/done/2026-09-08-cost-concurrency-conflict-merge-design.md`](docs/superpowers/specs/done/2026-09-08-cost-concurrency-conflict-merge-design.md), 배포 절차는 [`docs/operations/2026-09-08-cost-concurrency-rollout.md`](docs/operations/2026-09-08-cost-concurrency-rollout.md)) 구현 과정에서 의도적으로 뒤로 미룬 항목을 아래 표에 등록합니다. 기능 자체는 배포 가능하지만 아래 항목은 배포를 막지 않는 후속 개선입니다.

| ID     | 우선순위 | 상태                 | 과제                                                                                                                                                                                                                                                   | 다음 조치                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 근거 문서                                                                                                                                                                                                                                         |
| ------ | :------: | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| BE-101 |   높음   | ✅ Done (2026-09-08) | 전산업무비 충돌 응답의 `changedBy`가 부모 BCOSTM의 `LST_CHG_USID`만 사용해, 금융정보단말(BTERMM) 행만 수정된 충돌에서 바꾸지 않은 사람을 변경자로 표시했다                                                                                             | 해결: `CostConcurrencyGuard.lastChange`가 스탬프 계산에 이미 읽어 둔 단말 목록을 재사용해 부모·자식 중 `LST_CHG_DTM`이 더 늦은 쪽의 사번과 일시를 고른다(추가 조회 없음). 수정일시가 없는 단말은 비교에서 제외한다                                                                                                                                                                                                                                                                                                                                                         | `docs/superpowers/specs/done/2026-09-08-cost-concurrency-conflict-merge-design.md` 5절(충돌 응답)                                                                                                                                                      |
| BE-102 |   보통   | ✅ Done (2026-09-08) | 동시성 스탬프·충돌 병합 규약이 전산업무비(BCOSTM·BTERMM)에만 있다. 정보화사업(BPROJM·BITEMM)도 부모·자식 구조가 같아 같은 lost update 노출이 있다                                                                                                      | 해결: `ProjectConcurrencyStamper`·`ProjectConcurrencyGuard`·`ProjectConflictException`을 신설해 상세·개정본 조회 응답에 `concurrencyStamp`를 싣고 `PUT /api/projects/{id}`가 스탬프 누락 400·불일치 409(`PROJECT_SOURCE_CHANGED`, 현재 상태 포함)·잠금 초과 409로 응답한다. 검사는 행 잠금·결재 확인 뒤, 원장·품목 수정 전에 수행하며 반입·생성 경로는 면제한다. 프론트는 폼 밖에 스탬프·baseline을 보관하고 `useProjectConflictMerge`와 `ProjectConflictMergeDialog`로 3-way 병합을 제공하며 생성·수정 성공마다 스탬프를 재조회한다. 배포는 프론트 → 백엔드 순서여야 한다 | `docs/operations/2026-09-08-project-concurrency-rollout.md`, `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectConcurrencyStampIt.java`                                                                                   |
| BE-103 |   낮음   | ✅ Done (2026-09-08) | 외화 금융정보단말 스탬프 왕복이 단위 테스트로만 검증되고 Oracle 통합 테스트는 KRW 단말만 시드했다. 읽기·쓰기의 금액·환율 스케일이 어긋나면 외화 단말이 있는 예산은 저장할 때마다 409가 난다                                                            | 해결: `CostConcurrencyStampIt` 시드에 외화 단말(USD, fcAmt·xcr 포함)을 추가하고 실 Oracle에서 통과 확인(tests=2, skipped=0). 저장 경로가 매번 환율을 다시 조회해 단말 환율을 덮어쓰므로(스탬프 대조 이후), 환율 조회를 시드와 같은 값으로 고정해 그 갱신을 배제했다                                                                                                                                                                                                                                                                                                        | `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyStampIt.java`                                                                                                                                                      |
| BE-104 |   높음   | ✅ Done (2026-09-08) | 금융정보단말 연결 등록이 부모 전산업무비에 최소 필드만 담아 수정 API를 호출해, `Bcostm.update`의 전체 치환 때문에 요청에 없는 부모 업무 필드가 null이 되고 부모의 단말기 행이 모두 논리 삭제됐다(`main`에 이미 있던 결함)                              | 해결: 표시 전용 경로 `POST /api/cost/{itMngcNo}/terminal-link`와 `CostTerminalLinkService.markTerminalLinked`를 신설해 행을 잠그고 결재 상태를 확인한 뒤 `TMN_YN`만 바꾼다. 프론트는 `useCost.markTerminalLinked`를 호출하며 부모에 수정 API를 쓰지 않는다                                                                                                                                                                                                                                                                                                                 | `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostTerminalLinkService.java`, `it_frontend/app/components/cost/TerminalFormDialog.vue`                                                                                           |
| BE-105 |   보통   | ✅ Done (2026-09-08) | 신규 금융정보단말 연결 흐름이 `createCost`와 부모 표시(`markTerminalLinked`)를 순차로 두 번 호출한다. 두 번째 호출이 실패하면(예: 부모가 결재 진행 중) 단말 생성만 적용된 반쯤 적용 상태가 남는다                                                      | 해결: `POST /api/cost/{itMngcNo}/linked-costs`와 `CostTerminalLinkService.createLinkedCost`가 부모 행 잠금·결재 확인 → 단말 전산업무비 생성 → 부모 `TMN_YN` 표시를 한 트랜잭션에서 수행한다. 부모가 결재 진행 중이면 아무것도 저장하지 않는다. 프론트 `TerminalFormDialog`는 `useCost.createLinkedCost` 하나만 호출하며 `markTerminalLinked`는 프론트에서 제거했다. 기존 `POST …/terminal-link`는 구버전 번들 호환용으로만 남겼고 프론트 배포 뒤 제거 대상이다                                                                                                             | `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostTerminalLinkService.java`, `it_frontend/app/components/cost/TerminalFormDialog.vue`                                                                                           |
| FE-74  |   낮음   | ✅ Done (2026-09-08) | 병합 다이얼로그가 충돌 항목을 `cttNm`처럼 원시 컬럼명으로 보여줘 사용자가 어떤 항목을 고르는지 알기 어려웠다                                                                                                                                           | 해결: `app/utils/costFieldLabels.ts`의 `costFieldLabelKey`가 DTO 필드명을 편집 화면·목록이 이미 쓰는 i18n 키로 옮긴다. 새 문구를 만들지 않아 화면 간 표현이 갈라지지 않는다. 매핑에 없는 필드는 감추지 않고 필드명 원문을 그대로 노출한다                                                                                                                                                                                                                                                                                                                                  | `it_frontend/app/utils/costFieldLabels.ts`, `it_frontend/app/components/cost/CostConflictMergeDialog.vue`                                                                                                                                         |
| FE-75  |   보통   | ✅ Done (2026-09-08) | 사용자가 새로 추가한 금융정보단말 행이 `applyCostResolution`을 거쳐 살아남는지 증명하는 테스트가 없어, 손으로 추적해서만 확인된 상태였다                                                                                                               | 해결: 서버 식별자가 있는 추가 행과 식별자가 아직 없는 로컬 신규 행 두 경우 모두 테스트를 추가했다. 로컬 신규 행이 여러 개일 때 서로 뭉개지지 않는 것도 함께 고정한다                                                                                                                                                                                                                                                                                                                                                                                                       | `it_frontend/tests/unit/composables/cost/useCostConflictMerge.test.ts`                                                                                                                                                                            |
| FE-76  |   낮음   | ✅ Done (2026-09-08) | `app/types/api.d.ts`에 서버 배포 경로가 OpenAPI `@example` 값으로 들어가 다른 환경에서 `codegen:check` 드리프트를 유발했다. 원인은 런타임 캡처가 아니라 `FileDto.java`의 하드코딩된 예시 값이었고, 공개 스펙에 배포 경로 구조가 그대로 노출되고 있었다 | 해결: `FileDto`의 `@Schema(example=)`을 환경 중립적인 값으로 바꾸고 프론트에서 codegen 재생성. 내부 JavaDoc 주석의 같은 경로는 공개 스펙과 무관해 그대로 뒀다                                                                                                                                                                                                                                                                                                                                                                                                              | `it_backend/src/main/java/com/kdb/it/infra/file/dto/FileDto.java`                                                                                                                                                                                 |
| FE-77  |   낮음   | ✅ Done (2026-09-08) | 병합 다이얼로그로 충돌을 해소해 저장에 성공해도 자동저장 기준 상태가 clean으로 표시되지 않아, 다음 자동저장 주기에 내용이 같은 PUT이 한 번 더 나갔다                                                                                                   | 해결: `form.vue`에서 `resolveConflict`를 `saveCosts`와 같은 방식으로 감싸 성공 시 `markAutoSaveClean()`을 호출한다. 페이지 컴포넌트라 단위 테스트 하네스가 없어 타입체크와 코드 검토로만 확인했다 — 자동 회귀 테스트는 없다                                                                                                                                                                                                                                                                                                                                                | `it_frontend/app/pages/info/cost/form.vue`                                                                                                                                                                                                        |
| FE-78  |   높음   | ✅ Done (2026-09-08) | 기준 스냅샷이 없을 때 병합이 빈 객체를 base로 위장해, 한쪽에만 있는 금융정보단말 행이 충돌로 표면화되지 않고 조용히 합집합으로 병합됐다. 동료가 삭제한 단말 행이 되살아났다                                                                            | 해결: `buildCostConflict`·`applyCostResolution`의 `base`를 `ItCost                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | null`로 바꿔 '원본을 모른다'를 명시한다. base가 null이면 mine과 theirs가 다른 단말 행을 모두 사용자에게 묻고, 재적용은 서버 목록에서 출발해 사용자 선택만 반영한다. 부수 효과로 `ADDED_BY_THEM` 분기가 다시 도달 가능해져 죽은 코드가 아니게 됐다 | `it_frontend/app/composables/cost/useCostConflictMerge.ts` |
| CQ-45  |   보통   | ✅ Done (2026-09-08) | `CostDto.java`가 `max-lines-baselines.properties`에 804줄 예외로 등록되어 있다. 예외 기준선을 올려 둔 채로는 파일이 계속 커져도 게이트가 걸리지 않는다                                                                                                 | 해결: 목록 프로젝션(`CostListRow`)·검색 조건·일괄 조회 요청·개정본 참조를 `CostQueryDto`로 옮기고 `CostDto extends CostQueryDto extends CostTerminalDto` 상속으로 `CostDto.SearchCondition` 같은 기존 이름과 `@Schema(name)`을 그대로 유지했다(호출부·OpenAPI 무변경). `CostDto`는 653줄로 내려가 기준선 예외를 삭제했다. 같은 방식으로 `ProjectDto`의 검색·일괄 조회 DTO도 `ProjectQueryDto`로 분리해 BE-102의 필드 추가를 상쇄하고 기준값을 1005→920으로 낮췄다                                                                                                          | `it_backend/src/main/java/com/kdb/it/domain/budget/cost/dto/CostQueryDto.java`, `it_backend/src/test/resources/architecture/max-lines-baselines.properties`                                                                                       |
| CQ-46  |   보통   | ✅ Done (2026-09-08) | `CostService.java`가 800줄 ratchet 중 789줄까지 차 있어 다음 작은 변경만으로도 게이트를 넘길 여유가 거의 없다                                                                                                                                          | 해결: 금융정보단말기 생성·동기화(채번·환율 재계산·담당자 조직코드 보정·제자리 수정·논리 삭제)를 `CostTerminalSynchronizer`로, 담당자 이름·소속 조직 스냅샷 해석을 `CostNameSnapshotResolver`로 분리했다. `CostService`는 540줄이 되어 원장 검증·권한·결재 스탬프 흐름만 남는다. 동작은 그대로이며 기존 `CostServiceTest` 계열이 실물 협력자로 계속 검증한다                                                                                                                                                                                                                | `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostTerminalSynchronizer.java`, `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostNameSnapshotResolver.java`                                                    |

세부 구현 내용, 검증 명령과 결과는 각 근거 문서와 태스크 실행 기록을 참조합니다.

> **FE-82·FE-83 상태 정정(2026-09-12 문서 현행화):** 두 항목이 근거로 든 `app/utils/excalidraw-fonts.ts`·`excalidraw-text-metrics.ts`·`useExcalidrawFontSelector.ts`와 단위 테스트는 같은 날 뒤 커밋 `a99fb009`(2026-09-10 19:13)에서 Excalidraw 커스텀 글꼴 기능 자체가 철회되며 삭제됐다. 조치 코드가 워킹트리에 없으므로 완료가 아니라 폐기로 기록한다.


### ✅ 2026-09-08 잔여과제 BE-102 · BE-105 · CQ-45 · CQ-46 일괄 완료

전산업무비 동시성 스탬프·병합 기능에서 뒤로 미뤘던 네 항목을 조치했다. 상세 상태와 근거 문서는 [`TASK.md`](TASK.md)의 2026-09-08 표에 있다.

- **BE-102 정보화사업 동시성 스탬프·충돌 병합:** 백엔드는 `ProjectConcurrencyStamper`(부모 BPROJM 업무 필드 + 활성 BITEMM 품목, 감사·`LST_YN` 제외)·`ProjectConcurrencyGuard`(행 잠금·결재 확인 뒤, 원장 수정 전 검사; 잠금 초과 409 변환)·`ProjectConflictException`/`ProjectConflictResponse`·`GlobalExceptionHandler.handleProjectConflict`를 신설하고 `ProjectQueryAssembler.assembleDetail`이 `concurrencyStamp`를 싣는다. `PUT /api/projects/{id}`는 400 `PROJECT_STAMP_REQUIRED`·409 `PROJECT_SOURCE_CHANGED`(현재 상세 포함)·409 `PROJECT_CONCURRENT_UPDATE`를 응답한다. 반입·생성 경로는 면제한다. 프론트는 `projectFormMapping`(상세→폼·폼→payload 순수 함수), `useProjectConflictMerge`(payload 형태 3-way 병합, `gclMngNo` 키, 원본 미보관 시 보수 전환), `ProjectConflictMergeDialog`(cost 다이얼로그와 CSS 공유), `useProjectFormSave`의 409 처리·생성/수정 직후 스탬프 재조회, i18n `project.form.conflict.*`, `projectFieldLabels`를 추가했다. 배포는 프론트 → 백엔드 순서다([`docs/operations/2026-09-08-project-concurrency-rollout.md`](docs/operations/2026-09-08-project-concurrency-rollout.md)).
- **BE-105 연결 단말 생성 단일 트랜잭션:** `POST /api/cost/{itMngcNo}/linked-costs`·`CostTerminalLinkService.createLinkedCost`가 부모 잠금·결재 확인 → 단말 전산업무비 생성 → `TMN_YN` 표시를 한 트랜잭션으로 처리한다. `TerminalFormDialog`는 `useCost.createLinkedCost` 하나만 호출하고 프론트의 `markTerminalLinked`는 제거했다. 기존 `POST …/terminal-link`는 구버전 번들 호환용으로만 남겨 두었다(프론트 배포 뒤 제거 대상).
- **CQ-45 `CostDto` 기준선 예외 해제:** `CostListRow`·`SearchCondition`·`BulkGetRequest`·`VersionRef`를 `CostQueryDto`로 옮기고 `CostDto extends CostQueryDto extends CostTerminalDto` 상속으로 `CostDto.SearchCondition` 같은 참조와 `@Schema(name)`을 그대로 유지했다(호출부·OpenAPI 무변경). 804→653줄로 기준선 항목을 삭제했다. 같은 방식으로 `ProjectDto`의 검색·일괄 조회 DTO를 `ProjectQueryDto`로 분리해 BE-102의 두 필드 추가를 상쇄하고 기준값을 1005→920으로 낮췄다.
- **CQ-46 `CostService` 분해:** 금융정보단말기 생성·동기화를 `CostTerminalSynchronizer`, 담당자·조직 스냅샷 해석을 `CostNameSnapshotResolver`로 분리했다(789→540줄). 동작은 그대로이며 `CostServiceTest`·`CostServiceMigrationOverloadTest`·`CostServiceXcrLookupTest`·`TerminalBulkImportCostServiceTest`가 실물 협력자로 계속 검증한다.
- **검증:** 백엔드 `./gradlew test` 5,365건 통과(실패 0, 건너뜀 2), `MaxLinesRatchetTest`·`ApiResponseOpenApiContractTest` 포함. Oracle 통합 `./gradlew integrationTest --tests '*ConcurrencyStampIt'` 4건 통과(cost 2, project 2). 프론트 `npm run codegen`(paths 224 / schemas 329) 후 `codegen:check` 드리프트 없음, `format:check`·`check`(0 errors, 22 pre-existing warnings) 통과, `npm test` 5,222건 통과·4건 실패. 4건은 이 작업이 손대지 않은 파일의 기존 실패다 — `max-lines-ratchet`(`ProjectDetailSections.vue` 802줄), `useCostListPage` 반환 키 기준선(`conflictChangedByEno` 누락), `projectDetailBudgetCard`·`projectFormBudgetRow`(기 지급금액 라벨 `{year}` 인자 단정). 백엔드 전체 스위트 실행 중 다른 도구의 동시 `gradlew check`가 `build/test-results`를 지워 첫 실행 결과가 오염됐고, 그 프로세스가 끝난 뒤 재실행해 위 수치를 얻었다.
- **인계 — 수동 화면 확인 필요(미실행):** 두 브라우저에서 같은 정보화사업을 열어 순차 저장했을 때 병합 다이얼로그가 뜨고 먼저 저장한 쪽의 소요자원 행이 사라지지 않는지, 신규 사업 임시저장 직후 자동 임시저장이 400 없이 이어지는지, 금융정보단말 연결 신규 등록이 한 요청으로 저장되는지는 로컬 기동 후 사람이 직접 확인해야 한다.

### ✅ 2026-09-07 SSO 세션 무상태화·지정맥 공급자 무상태화 (L4 세션 유지 의존 제거)

다중 WAS 인스턴스를 L4 Least Connection만으로 운영할 수 있도록, 요청 간 인스턴스 로컬 상태를 쓰던 두 곳을 DDL 변경 없이 제거했다. 서버 고정·NAT 없음 조건에서는 source IP hash로도 우회 가능했지만, 롤링 재기동과 인프라 변경에 흐름이 조용히 깨지는 의존을 없애는 쪽을 택했다.

- **SSO(`SsoController`):** `HttpSession`에 두던 `resultCode`/`resultData`/`ssoVerifiedEno`/`secureSessionId`/`ssoNext`/`ssoOrigin`을 모두 제거했다. 검증 사번은 `JwtUtil.generateSsoVerifiedToken`(`tokenUse=sso-verified`, 60초, `jti`)을 담은 `sso-verified` httpOnly 쿠키(`Path=/api/auth/sso`)로 `checkauth`/모의 `business`가 발급하고, `complete`가 `resolveSsoVerifiedEno`로 서명·만료·용도를 검증한 뒤 성공·실패 모두 삭제한다. `loginProc`/`agentProc`는 `sso-next`/`sso-origin` 쿠키만 쿼리로 옮긴다. 설정 `jwt.sso-verified-validity`(기본 60000) 추가. 서버 저장소가 없어 60초 내 재전송을 서버가 막지 못하는 점은 설계 시 확인·수용했으며(httpOnly 쿠키 탈취 위협 모델은 Refresh 쿠키와 동일) 가이드에 기록했다.
- **지정맥(`FingerVeinMfaProvider`):** 인스턴스 로컬 `activeScans` 맵과 용량 제한·`synchronized`를 제거했다. `start`가 6자리 랜덤키를 `MfaChallengeData.providerTransactionId`로도 돌려 `MfaService`가 기존 경로로 `TPRMPP_CMFATM.APN_CER_SVC_TR_NO`(VARCHAR2(20))에 저장하고, `verify`는 `MfaVerifyContext.providerTransactionId`의 랜덤키와 컨텍스트 사번으로 기대 해시를 재계산한다. 1회 사용·재전송 차단은 `MfaService`의 거래 상태 전이가 담당한다(FIDO SEC-16과 같은 패턴). 관련 JavaDoc의 "FIDO만 값이 있다" 설명을 지정맥 랜덤키까지 넓혔다.
- **문서:** `it_backend/README.md`, `docs/guides/integrations/sso.md`(다중 인스턴스 전제 섹션을 "sticky 불필요·`jwt.secret` 공유 필수"로 교체), `docs/guides/security/authentication-authorization.md`(SSO 경로 표·CSRF 트리거 목록).
- **검증:** `FingerVeinMfaProviderTest` 13건, `JwtUtilTest` 33건, `CookieUtilTest` 23건, `SsoControllerTest` 70건(세션 기반 케이스를 쿠키 기반으로 재작성, 세션 ID 교체·동시 소비 테스트는 대상 소멸로 삭제). 백엔드 전체 `./gradlew test` 5,191건 통과(실패 0), `spotlessCheck` 통과. 프론트엔드·DB 변경 없음.
- **운영 인계:** 모든 WAS 인스턴스에 같은 `JWT_SECRET`을 주입해야 한다. L4에서 persistence를 켜 두었다면 해제해도 되고, 켜 둔 채로도 동작한다. `EnvironmentValidator`의 `JSESSIONID` 속성 검사는 방어용으로 유지했다.

### ✅ 2026-09-03 전산예산 작성 화면 개선(변경1~5) 완료

전산예산 작성·상신 화면에 접수된 다섯 가지 변경 요청을 한 번에 반영했다. 기 지급금액 라벨 연도 표기, 사업연도 Select 축소·유의사항 팝업, 소요자원 입력 개선, 결재라인 자동지정, 임시저장·작성완료 분리를 구현했다.

- **DB:** `V20260903_001__AddDraftedApplicationStatusCode.sql`(신청서상태 `IT_PTL_APF_PRG_STS_C`에 `0`=작성완료 신설, 기존 `0` 행은 `9`=수기등록으로 이관), `V20260903_002__SeedApprovalLinePositionCodes.sql`(결재자직위코드 `IT_PTL_APF_DCR_PT_C` 8건 시드), `V20260903_003__SeedBudgetBasisTypeCodes.sql`(산정근거구분코드 `IT_PTL_CNCD_FDTN_TC` 4건 시드).
- **백엔드:** 공용 결재선 도장 `common.approval.service.ApprovalStamper`(반입 전용이던 `MigrationApprovalStamper`를 승격하고 멱등 규칙 추가), 결재라인 제안 `common.approval.service.ApprovalLineSuggestionService`와 `GET /api/applications/approval-line/suggestion`, `ProjectDto`·`CostDto` 저장 요청에 `complete` 플래그 추가, 결재함·목록 조회에서 `0`(작성완료) 제외.
- **프론트:** `project.form.fields.paidBudget`을 연도 포함 라벨로 변경하고 보조 문구를 추가, `defaultBudgetYear()` 기준월을 9월로 전환하고 사업연도 Select를 올해·내년 2개로 축소·유의사항 팝업 추가(`useProjectFormPage.ts`), 소요자원 금액 포커스·블러 0 처리(`useResourceAmountFocus`)와 산정근거 Select+기타 텍스트 입력(`ResourceTableSection.vue`), 작성 화면 [임시저장]/[저장] 버튼 분리와 상신 화면 결재라인 자동 채움·사유 배너(`report.vue`).
- **검증:** 각 태스크에서 이 계획이 새로 추가·수정한 코드에 대한 백엔드 테스트와 프론트 `format:check`·`check`·`npm test`가 통과했다. 백엔드 전체 스위트에는 이 계획 이전부터 main에 있던 무관한 실패(`MaxLinesRatchetTest`, `ApplicationServiceRecallTest`, `RequestForm2026SampleSmokeTest`, `MigrationYearSnapshotTest`, 마커 텍스트 단정 등 최대 10건)가 있었으며, 이 작업이 원인이 아니라 기존 결함임을 별도로 확인했다. 상세 결과는 각 태스크 실행 기록을 따른다.
- **설계·계획:** [`docs/superpowers/specs/2026-09-03-budget-form-improvements-design.md`](docs/superpowers/specs/2026-09-03-budget-form-improvements-design.md), [`docs/superpowers/plans/2026-09-03-budget-form-improvements.md`](docs/superpowers/plans/2026-09-03-budget-form-improvements.md).
- **알려진 부작용:** 상신 화면 스코프가 "활성·완료 신청서 없음"에서 "최신 신청서가 작성완료(`0`)"로 바뀌면서, 편성요청서 반입으로 들어온 항목(수기등록 `9` 신청서를 달고 있음)은 더 이상 상신 화면에 보이지 않는다. 예전에는 보였던 항목이라 영향을 받는 대상은 편성요청서로 반입된 사업·전산업무비 담당자이며, 화면을 열어 [저장]해 작성완료로 갱신해야 다시 나타난다. 이전 동작(반입 항목도 상신 대상에 포함)으로 되돌리려면 별도 결정이 필요하며, 이번 계획은 그 규칙을 의도하지 않았다.
- **호환 커밋(`versions.lock`):** it_database `675dd12`, it_backend `2841f9ec`, it_frontend `901cd9ad`.
- **인계 — 수동 화면 확인 필요(미실행):** 자동 검증(단위 테스트·게이트)은 태스크마다 통과했지만, 다음 5개 시나리오는 로컬 기동 후 사람이 직접 화면으로 확인해야 한다.
  1. 정보화사업 신규 작성 시 사업연도 Select에 올해·내년만 보인다. (시스템 날짜를 9월 이후로 바꾸거나 `requiresCurrentYearNotice`를 콘솔에서 호출해) 올해 선택 시 "유의사항 안내" 팝업이 뜨고 취소하면 내년으로 돌아간다.
  2. 기 지급금액 라벨이 `{연도} 이전 지급금액 (원)` 형태이고 아래에 `* 당해 지급예정액 포함`이 보인다.
  3. 소요자원 금액 `₩0` 칸을 클릭하면 빈칸, 벗어나면 `₩0`으로 복원된다. 산정근거는 Select이며 기타를 고르면 텍스트 입력이 나타나고 비운 채 저장하면 행 번호 안내가 뜬다.
  4. [임시저장] 후 목록 배지가 `임시저장`, [저장] 후 `작성완료`로 보인다. 결재 상신 화면 "작성완료" 스코프에 저장 건만 보이고, 작성완료 건을 다시 열면 [임시저장] 버튼이 없다.
  5. 상신 화면 진입 시 국내 기안자의 팀장·부서장이 채워지거나 사유 배너가 보인다. 상신 후 결재함 목록에 작성완료 신청서가 나타나지 않는다.

### ✅ 2026-09-03 잔여과제 SEC-21~23 · BE-90~100 · FE-68~73 · CQ-42~44 일괄 완료

- **접근 범위(SEC-21~23):** 정보화사업·전산업무비 목록과 bulk 조회에 인증 사용자의 부서 범위를 서버에서 강제했다. 범위 밖 bulk 항목은 `failedIds`로 분리하고 인증 주체가 없으면 차단한다. Q&A의 타 부서 비공개 글은 제목·작성자 등 식별 정보를 마스킹한다.
- **문서·이관·계약(BE-90~93):** BGDOC 문서번호를 가이드 `GDOC-`, 담당자 `CDOC-`, 공통 팝업 `PDOC-`로 분리했다. 단말기 반입 API는 `baseYear`와 `previousCostId`·`currentCostId`로 연도 중립화했고, 첨부파일 OpenAPI 한글명을 표준 메타 명칭으로 정정했다. 예산 조직명 스냅샷은 Oracle 100 BYTE 경계를 저장 전에 검증한다.
- **비용 이력·정리(BE-94·BE-100):** 비용 이력은 개정본별 상세 재조회 없이 배치 조립하며 actor 필수 권한 경계로 이동했다. 모든 개정본의 부서가 읽기 가능한지 확인해 부서 변경 이력이 섞여 노출되지 않게 했다. BGDOC 채번을 공통 생성기로 통합하고 철회 산출물·미사용 래퍼·중복 테스트를 정리했다.
- **DB 운영 안전(BE-95~99):** 철회된 `20260901.002` 버전을 영구 봉인하고 repair/잔존 인덱스 확인 절차를 기록했다. BYTE 전환은 사전 점검·승인·백업·사후 감사를 분리했고 파괴적 DDL 3건의 소급 인계 기록과 신규 테이블 BYTE 검증 규칙을 보완했다. 가이드 이관 계획은 충돌하지 않는 `V20260903_001`·`002`로 현행화했다.
- **프런트 오류 상태(FE-68~70):** 게시판 첨부 bulk 실패를 빈 첨부로 숨기지 않고 오류·재시도 상태로 표시한다. 담당자 정보 조회 실패에서도 스피드다이얼 진입과 재시도가 유지된다. 예산·사업 보고서의 손상된 sessionStorage는 정상 빈 선택과 구분해 차단하고 항상 제거한다.
- **프런트 타입·중복(FE-71~73):** 사용자 가이드를 생성 OpenAPI 타입에 연결하고, HTML escape/strip/본문 유의미성 판정과 프로젝트 입력 제한의 중복·미사용 export를 정리했다. 게시판 멘션 접근성 이름은 호출부의 현재 locale 번역을 사용한다.
- **구조·품질(CQ-42~44):** 800줄을 넘던 프런트 7개 화면·에디터의 책임을 하위 컴포넌트와 composable로 분리했다. 정규식 ESLint 오류와 pdfmake 테이블 타입 오류를 해소했다. 백엔드도 `CostDto`와 `ApplicationService`를 800줄 아래로 내리고 `ProjectDto` 기존 기준선을 1016에서 1011로 낮췄다.
- **검증:** 프런트 전체 Vitest 422개 파일 중 421개 통과·1개 skip, 4,461건 통과·8건 skip. 커버리지는 라인 97.65%, 분기 85.53%, 함수 96.64%, 구문 96.16%이며 측정 대상 237개 파일이 네 지표 모두 70% 이상이다. `npm run check`·Stylelint·Prettier·OpenAPI drift 검사와 예산 핵심 E2E 9건을 통과했다. 백엔드는 전체 4,753건(20건 skip, 실패·오류 0), 클래스별 라인·분기·복잡도 70% 게이트, Spotless, bootJar와 Javadoc 생성을 통과했다. 결과는 [`docs/test/test-report-2026-09-03.html`](docs/test/test-report-2026-09-03.html)에 갱신했다.
- **DB 적용 경계:** 마이그레이션 파일과 검증 SQL은 작성·정적 리뷰를 마쳤지만 실제 Oracle/Flyway 적용은 하지 않았다. DBA가 [`meta/backlog.md`](meta/backlog.md)의 `적용대기` 항목과 각 운영 인계 문서를 확인해 적용한 뒤, 실 DB에서 다시 추출한 결과로만 `meta/index.txt`를 갱신한다.

### ✅ 2026-09-03 공통 안내 팝업 구현

`TPRMPP_BGDOCM`의 `DOC_TTL_CONE='common.popup'` 문서를 관리자가 `/admin/common-popup`에서 게시·수정·중지하도록 구현했다. 활성 문서는 하나만 유지하며, 인증 화면의 공통 `AppShell`이 어느 업무 경로로 직접 진입하더라도 표준 다이얼로그로 표시한다.

- **API:** `GET /api/common-popup`은 인증 사용자에게 활성 팝업을 반환하고 없으면 204를 반환한다. 관리자용 `GET`·`PUT`·`DELETE /api/admin/common-popup`은 `ROLE_ADMIN`으로 제한하며 저장 HTML을 서버에서 정화한다.
- **다시 보지 않기:** 문서번호와 최종변경시각으로 만든 콘텐츠 버전을 1년 쿠키 `it-common-popup-dismissed-version`에 저장한다. 같은 버전만 숨기므로 관리자가 내용을 갱신하면 다시 표시한다.
- **DB:** `V20260902_002__AddCommonPopupDocumentAndAdminMenu.sql`이 활성 `common.popup` 문서의 조건부 유일 인덱스와 [관리자] > [컨텐츠 관리] > [안내 팝업 관리] 메뉴·영문 번역·`ITPAD001` 권한을 추가한다.
- **검증:** 백엔드 공통 팝업 테스트와 OpenAPI 계약 테스트, 프론트 컴포저블·다이얼로그·관리 화면·AppShell 단위 테스트를 통과했다. Playwright 5개 시나리오로 `/info`·`/budget` 직접 진입, 동일 버전 숨김, 변경 버전 재노출, API 500 시 화면 진입 유지를 확인했다.
- **설계·계획:** [`docs/superpowers/specs/2026-09-02-common-popup-design.md`](docs/superpowers/specs/2026-09-02-common-popup-design.md), [`docs/superpowers/plans/2026-09-02-common-popup.md`](docs/superpowers/plans/2026-09-02-common-popup.md).

### ✅ 2026-08-31 사용자가이드 관리 기능 구현

전용 테이블 없이 기존 `TPRMPP_CFILEM`을 재사용해 사용자가이드 업로드·전사 공개 다운로드·이력 관리를 구현했다. 서버가 `APG_FL_KD_NM='사용자가이드'` / `APG_FL_LNK_CTZ_NM='HEADER'` / `FL_TP_CONE='첨부파일'`을 고정하고, `DEL_YN`으로 현재 가이드(`N`)와 이력(`Y`)을 구분한다. 업로드·되돌리기 모두 같은 트랜잭션에서 기존 활성 건을 먼저 내려 **현재 가이드는 항상 0건 또는 1건**을 유지한다.

- **API:** `/api/user-guides` — `GET /active`(인증 사용자 전체, 없으면 204), `GET /admin`·`POST`·`PATCH /{id}/active`(관리자). 내려받기는 전용 경로 없이 공통 `GET /api/files/{flMpnId}/download`와 신설 `UserGuideFileReadAuthorizer`(전사 공개)를 사용한다. 허용 확장자는 pdf·hwp·hwpx·docx·pptx.
- **화면:** 관리 화면 `/admin/user-guides`(사이드바 [콘텐츠 관리] 하위), 헤더 [통합검색] 좌측 [사용자가이드] 버튼(현재 가이드가 없으면 숨김).
- **DB:** `it_database/migrations/V20260830_003__SeedUserGuideAdminMenu.sql`로 관리자 메뉴를 시드했다.
- **설계·계획:** [`docs/superpowers/specs/2026-08-30-user-guide-design.md`](docs/superpowers/specs/2026-08-30-user-guide-design.md), [`docs/superpowers/plans/2026-08-30-user-guide.md`](docs/superpowers/plans/2026-08-30-user-guide.md).
- **호환 커밋(`versions.lock`):** it_backend `e675f488`(브랜치 `codex/speed-dial-faq-qna`, 읽기 판정기 `95b1b3d5`→서비스·DTO `ebf5e461`→컨트롤러 `3f6f4227`→쓰기 판정기 `e675f488`), it_database `a407c0c`, it_frontend `19ccb819`(컴포저블 `38a02e72`→헤더 버튼 `e4ede996`/`68638d85`→관리 화면 `90e97fbf`/`063b81e3`→파일 포맷·census·copy baseline 등재 `19ccb819`).
- **검증:** 후속 커밋 `19ccb819`(`fix: 사용자가이드 파일 포맷·아키텍처 census·copy baseline 등재`)가 component-boundaries census와 copy baseline 등재 누락을 해소했다. 현재 전량 통과: 프론트 `npm run format:check` 통과, `npm run check` 통과, `npm test` 383 파일/4,174 테스트 0 failures, `npm run codegen:check` 드리프트 없음. 백엔드 전체 `./gradlew test --no-daemon` `BUILD SUCCESSFUL`(쓰기 판정기 누락으로 인한 C1 취약점 수정 커밋 `e675f488` 포함).
- **미검증 범위:** 관리자·일반 사용자 실계정을 통한 실제 브라우저 왕복 확인(사이드바 메뉴 노출·업로드·되돌리기·내려받기·권한 차단)은 이 기록 시점에 계정 준비가 없어 별도로 처리한다.

### ✅ 2026-08-29 TASK remediation plan 코드 조치

- **SEC-18~22, CQ-38:** 관리자 판정 fail-closed, 사업 첨부 부모 권한 재검증, fingerprint secret 분리, 서버 절대경로 비노출, `@ModelAttribute` mass-assignment 방어를 반영했다.
- **FE-61~63, CQ-34, CQ-37:** 프로젝트 입력 제한을 문자/UTF-8 바이트 단일 SoT로 통합하고, 협의회 첨부 다운로드·비용 이월·401 세션 갱신 coordinator를 공통 경계로 정리했다.
- **BE-78~82, CQ-36, CQ-40:** 운영 표준 `VARCHAR2(... BYTE)`를 유지하면서 단말 조직명 저장 전 byte 검증을 추가하고, 반입 원본 보관 실패 결과 노출·첨부 ZIP 공통화·UTF-8 byte 유틸리티 공통화를 구현했다.
- **CQ-39:** 예산 필터 중복과 미사용 테스트 import를 정리했다.
- **DB/문서:** `meta/table.txt`와 적용된 Flyway migration은 수정하지 않았다. BE-78의 BYTE 기준은 [`it_database/docs/operations/2026-08-29-terminal-org-name-byte-semantics.md`](it_database/docs/operations/2026-08-29-terminal-org-name-byte-semantics.md)에, BE-83의 측정 전 인덱스 보류는 [`it_database/docs/operations/2026-08-29-be83-index-review.md`](it_database/docs/operations/2026-08-29-be83-index-review.md)에 기록했다. CQ-35는 [`docs/db-schema-gap/db-schema-gap-2026-08-29.md`](docs/db-schema-gap/db-schema-gap-2026-08-29.md) 6.3절의 라이브 DDL 재추출·대조로 해소했다. 환경별 Flyway repair(REPO-04)만 승인된 운영 접근 후 처리할 인계 항목이다.
- **검증:** 프론트 `npm run format:check`, `npm run check`, `npm run codegen:check`, 전체 Vitest 366개 파일/4,059개 테스트 통과. 백엔드 전체 `./gradlew test --no-daemon --max-workers=1 --console=plain` `BUILD SUCCESSFUL`.
- 상세 계획과 커밋별 작업 내역은 [`docs/superpowers/plans/2026-08-29-task-remediation-plan.md`](docs/superpowers/plans/2026-08-29-task-remediation-plan.md)와 SDD 진행 장부를 참조한다.

### ✅ 2026-08-30 TASK remediation 완료

- **ERR-15·ERR-17:** 이관 조정비율·일반관리비율에서 빈 값과 형식 오류를 분리했다. 형식 오류는 `RATE_UNPARSEABLE` 셀 진단/차단 또는 경고·예외로 표면화하고 정상 기본값으로 계산하지 않는다.
- **ERR-16:** 협의회 계획·공지 조회 실패를 빈 결과나 수립 폴백으로 숨기지 않고 오류 상태와 재시도를 제공하며, 실패 시 이전 성공 상태를 정리한다.
- **FE-64:** 백엔드 OpenAPI 계약을 기준으로 프론트 타입을 재생성했다. `app/types/api.d.ts`는 197 paths/276 schemas이며 `npm run codegen:check`에서 드리프트가 없다. 기존 imports→terminals 계약에 맞춰 레거시 미리보기 테스트 경계도 정리했다.
- **FE-65·FE-66:** Nuxt fetch 옵션과 관리자 행 정제의 우회 단언을 제거하고, 협의회 준비·결과 접근 판정을 `useCouncilAccessContext`로 공통화했다. 관련 타입·구조 테스트를 추가했다.
- **FE-67:** 정보 홈의 공지·일정 초기 조회와 검토의견 세션 조회를 공유 Promise/명시적 재시도 경계로 통합했다. KeepAlive 최초 활성화는 중복 조회하지 않고 실제 재활성화 때만 갱신한다. 정보 홈·검토 첨부 E2E 10건이 통과했다.
- **BE-84·BE-85:** 공통 데이터 이관 조회를 IN 900개 단위로 분할하고 삭제·활성·번역 길이 규칙을 검증했다. `CostTerminalDto`의 누락 required properties를 OpenAPI 계약과 테스트에 반영했다.
- **BE-86·BE-87:** Javadoc 기준선을 실제 2,106건으로 정합화하고 재실행 옵션을 추가했다(실측 2,064건). 프로젝트·비용 목록은 read projection, 안정 정렬, 최대 500건으로 제한하고 전체 Spotless도 통과시켰다.
- **BE-88·BE-89·CQ-41:** 신청 목록 bulk 조립을 batch 조회·상한으로 바꾸고, 협의회 skip 조회를 IN/map 방식으로 바꿨다. 게시글·댓글의 공통 조회/안전 헬퍼를 추출했다.
- **문서·검증:** 루트/백엔드/프론트 `README.md`와 `CLAUDE.md`에 목록·bulk·OpenAPI codegen·오류/빈 결과·초기 조회 공유 규칙을 추가했다. 프론트 `format:check`, `check`, `codegen:check`, Vitest 375개 파일/4,113건 및 관련 E2E 10건, 백엔드 전체 test 4,416건과 `check bootJar`, Javadoc 검사, Spotless를 통과했다.

### ✅ 2026-08-28 활성 잔여과제 일괄 조치 (BE-64 제외)

- **FE-59:** 관리자 화면 13개의 렌더링 E2E와 코드·역할·라우트·조직·권한등급·사용자 편집 진입 6건을 추가했다. 사업단계 상세는 심의결과·계약·지급의 저장 요청 본문까지 검증한다.
- **FE-60:** 예산연도 필터를 타는 E2E fixture는 `defaultBudgetYear()` 기준으로 정리됐음을 재검증했다. 남아 있던 고정 연도는 상세·스냅샷·PDF·성능 fixture로 기본연도 필터를 타지 않으며, 현재 날짜(2026-08-28)에도 관련 스펙이 통과함을 확인했다.
- **BE-75:** 삭제된 동일 PK 엔티티를 새 객체로 merge하지 않고 복구하는 `EntityRestoreSupport`를 도입하고, 사업계획과 협의회 6개 서비스의 7개 위험 경로에 적용했다. 복구 시 기존 GUID를 보존하는 회귀 테스트를 추가했다.
- **BE-76:** 예산카드 참고사항과 길라잡이 저장 DTO에 고유 OpenAPI 스키마 이름을 부여했다. 프론트 API 타입을 재생성하고 길라잡이 composable을 `FormGuideSaveRequest`에 연결했다.
- **BE-77:** 현재 1,915건을 기준선으로 삼는 `scripts/check-javadoc-warnings.ps1`을 추가했다. 신규 Javadoc 경고가 기준선을 넘으면 CI용 명령이 실패한다.
- **SEC-12:** 제공된 `prds/mfa.md`에는 사용자 거부 상태값이 없으므로 값을 추측하지 않았다. 대신 `MFA_FIDO_REJECTED_STATUSES` 허용목록을 추가해 공급자 확정값을 배포 설정으로 즉시 반영할 수 있게 했고, 설정된 거부 상태가 실패로 판정되는 테스트와 README 운영 문서를 추가했다.

BE-64는 사용자 요청에 따라 변경하지 않았다.

## 🗂️ 진행 중에서 종료된 항목 (영역별)

### ✅ 2026-08-25 사업 입력 길라잡이 구현·교차 저장소 검증

`/info/projects/form`의 정보화사업·경상사업 입력 필드와 소요자원 상세 셀에 고정 ID 기반 길라잡이를 연결하고, 등록된 내용이 있을 때만 우측 반응형 패널에 표시하도록 구현했다. 관리자 메뉴 `/admin/form-guides`에서는 고정 카탈로그 항목만 선택해 `TPRMPP_BGDOCM`의 `FDOC-*` 문서를 등록·수정·삭제하며, 기존 단계 문서는 `GDOC-*` 경계를 유지한다.

호환 커밋은 백엔드 `e258da9c`(입력 길라잡이 API·권한·GDOC 경계, 유니코드 공백과 수식·첨부를 포함한 의미 있는 HTML 판정), 프론트엔드 `d5e6821b`(폼·패널·최초 조회 복구·접근성·관리 화면, 서버와 일치하는 의미 판정 및 단일 scope 재조회 소유권), 데이터베이스 `8d0dc42f`(V001 체크섬 보존과 V002 인덱스 완전식 검증·관리자 메뉴 수렴)이다.

검증 결과: 백엔드 `./gradlew test check -x spotlessJavaCheck`가 JaCoCo 포함 통과했다. 기능 변경 파일과 Controller 테스트 2개를 파일 한정 Spotless로 정규화했으며, 전체 `spotlessCheck`의 잔여는 이번 기능과 무관한 기존 Java 18개 파일이다. 프론트엔드는 `npm run format:check`, `npm run check`, `npm test`(3,926 통과·8 skip) 및 의미 판정·관리 조회 집중 테스트를 통과했다. Flyway는 V001 적용 상태에서 112개 마이그레이션 validate 후 V002만 적용했으며, 검증 SQL에서 V001/V002 성공 이력, 완전 일치 함수식, 중복 0건과 인덱스·경로·메뉴·영문 번역·ITPAD001 권한 각각 1건을 확인했다.

### ✅ 2026-08-24 BE-51 완료 — `TPRMPP_CFILEM` 부모 키 컬럼 개명·폭 축소

**배경.** BE-51은 2026-08-22 실측에서 `PK_COL_NM`·`PK_CONE`(각 `VARCHAR2(4000)`) 위에 복합 인덱스를 만들려던 원안이 선언 키 8000바이트로 `ORA-01450`(상한 6397바이트)에 걸려 실패한다는 것과, 실 데이터 최대 길이가 각각 21·17바이트뿐이라는 것을 확인하고 "컬럼 폭 축소가 유일하게 합리적"이라는 결론과 함께 보류됐다. 이번 조치는 그 결론을 실행하면서, 두 컬럼명이 실제 쓰임(서로 다른 값이 2개뿐인 종류 구분자와 그 연결 콘텐츠 식별자)과 동떨어져 있던 것도 함께 바로잡았다.

**조치.**
- DB: `it_database/migrations/V20260824_003__RenameAndResizeCfilemParentKeyColumns.sql` — `PK_COL_NM`→`APG_FL_KD_NM`(첨부파일종류명), `PK_CONE`→`APG_FL_LNK_CTZ_NM`(첨부파일연결콘텐츠명)으로 `RENAME COLUMN` 후 각 `VARCHAR2(100 CHAR)`로 축소. 재실행 안전(이미 새 이름·길이면 건너뜀). 두 컬럼 다 인덱스가 없어 안전. 새 컬럼명은 `meta/meta.txt`에 이미 등록된 표준 용어(동일 이름·길이)였다. `meta/table.txt`의 `TPRMPP_CFILEM` 행도 갱신했다.
- 백엔드: `Cfilem` 엔티티(길이 4000→100 포함)·`FileRepository`(Spring Data derived 쿼리 메서드명 포함)·`FileDto`·`FileService`·`FileController`·`infra.file.authz` 전체 프레임워크·배너/게시판/가이드문서/편성요청서반입/관리자 파일목록 등 도메인 호출부·관련 테스트까지 `pkColNm`→`apgFlKdNm`, `pkCone`→`apgFlLnkCtzNm`로 일괄 리팩토링했다(약 65개 파일). `RequestFormSourceFileArchiver.PK_COL_NM`→`APG_FL_KD_NM`, `BannerService.BANNER_PK_CONE`→`BANNER_APG_FL_LNK_CTZ_NM`, `FileUploadUnitService.SAFE_PK_COL_NM`→`SAFE_APG_FL_KD_NM` 상수도 함께 개명했다. `TPRMPP_BBUGTM`/`TPRMPP_BBUGTL`(예산집행 원천 추적)·`TPRMPP_CAPPLA`(전자결재 원장 연결)가 같은 이름 `PK_COL_NM`을 무관한 의미로 재사용하는 지점은 건드리지 않았다(`RequestFormFileReadAuthorizer`·그 테스트는 두 개념이 한 파일에 섞여 있어 줄 단위로만 개명). `docs/operations/file-read-migration.md`는 2026-07-19 시점 실행 기록이라 SQL·수치는 그대로 두고 개명 사실만 안내 문구로 추가했다.
- 프론트: `useFiles.ts` 등 파일 API 계층, 배너·게시판·가이드문서·협의회·검토의견·전자결재뷰어 등 파일첨부 호출부(FormData 키·쿼리 파라미터명 포함), 관련 단위·e2e 테스트까지 동일하게 개명했다(약 33개 파일). `ApplicationOrcItem`(전자결재 원천 연결, 무관한 동명 필드)은 건드리지 않았다. `app/types/api.d.ts`는 로컬 `local-ext` 백엔드를 임시 기동해 `npm run codegen`으로 재생성했다(수기 편집 아님).

**검증.** 백엔드 `./gradlew test` **4,063건 중 1건 실패**(`RequestForm2026SampleSmokeTest` — 로컬 `sample/2026/` 폴더에 다른 작업이 추가한 부서 폴더로 파일 개수 기준선이 어긋난 환경 문제이며 이번 변경과 무관, 기존에 알려진 결함). 프론트 `npm run codegen:check`·`format:check`·`npm test` **3,867건 중 1건 실패**(`user-facing-copy-ratchet` — `app/utils/infoDashboardCost.ts`는 이 작업이 건드리지 않은 파일로 같은 워킹트리의 다른 진행 중 작업 소관). 두 실패 모두 이번 리네이밍과 무관함을 확인했다. `npm run check`(typecheck·lint·check:copy 중 lint·typecheck)는 통과.

**주의.** `V20260824_003`는 로컬 `local-ext` 기동으로 적용됐다. dev/prod는 이 저장소 관례대로 DBA가 검토 후 수동 적용해야 한다.

### ✅ 2026-08-23 완료 — 세션 만료 시 수동 로그인 대신 SSO 재진입 (프론트)

**원인.** 화면용 `it-portal-user` 쿠키(7일)는 남고 httpOnly JWT 쿠키만 사라진 상태에서, `auth.global.ts`는 쿠키 존재만으로 인증으로 판정해 SSO를 건너뛰고 페이지를 렌더링했다. 이어지는 API 401 → 갱신 실패 시 `plugins/auth.ts`와 `useApiFetch`의 세션 종료 처리가 `navigateTo('/login')`으로 수동 로그인 페이지에 보냈다. 백엔드 재기동 직후 최초 접속이 항상 이 경로를 타 "SSO 대신 수동 로그인" 증상이 됐다(e2e `session.spec.ts` 케이스 4 주석의 의도는 SSO 리다이렉트였으나 단언이 `/login` 도달도 통과로 인정해 불일치를 못 잡았다).

**조치.** `app/utils/sessionExpiryRedirect.ts` 신설 — 세션 만료 확정 시 현재 경로를 `next`로 담아 `/sso/business`로 재진입한다. 무한 루프 차단: 재진입 시각을 sessionStorage(`it-portal-sso-reentry-at`)에 기록하고 60초 안에 다시 만료가 확정되면 SSO 대신 `/login?error=sso`로 폴백한다(로그인 경로·sessionStorage 사용 불가 시에도 동일 폴백). 두 401 처리기는 이 유틸을 호출하도록 교체했고, `useApiFetch`는 800줄 상한 준수를 위해 조정자 배선을 `composables/api/useSessionRefreshCoordinator.ts`로 분리했다(803→760줄).

**회귀 방지.** 단위: `sessionExpiryRedirect.test.ts`(6건 — SSO 재진입 URL·기록·60초 루프 가드·로그인 경로·storage 불가 폴백), `useSessionRefreshCoordinator.test.ts`(3건 — 배선·로그아웃 후 순서·로그아웃 실패 시 미호출). e2e: 케이스 4 단언을 SSO 요청 필수·`/login` 불허로 강화하고, 케이스 4b(재진입 직후 재만료 → `/login?error=sso` 폴백·SSO 요청 0건)를 추가했다.

**검증.** `npm test` 3,844건 통과, `npm run check`·`format:check` 통과, `session.spec.ts` e2e 6건 통과. 라이브: mock SSO 환경에서 JWT 쿠키만 삭제 + `it-portal-user` 재주입 후 리로드 → SSO 재진입을 거쳐 원래 페이지(`/info`)로 인증 복귀함을 브라우저에서 확인.

### ✅ 2026-08-23 BE-57 완료 — 원격 WAS 로그 다운로드 복구

**원인.** `WasLogController.download`는 최대 약 24MB 링버퍼를 여러 사본으로 만들지 않기 위해 `StreamingResponseBody`로 한 줄씩 내보낸다(BE-61). 최초 `REQUEST`는 관리자 JWT와 `/api/admin/**` 인가를 통과했지만, 스트림 완료 과정에서 같은 URL로 발생하는 `ASYNC` 재디스패치는 stateless 보안 체인에서 인증 컨텍스트 없이 다시 평가됐다. 그 결과 응답이 시작된 뒤 `AuthorizationDeniedException`이 발생해 `response is already committed`만 남고 파일은 내려오지 않았다.

**조치.** `SecurityConfig`에서 `DispatcherType.ASYNC` 재디스패치를 URL 규칙보다 먼저 `permitAll`로 두었다. 외부 요청이 이 타입을 지정할 수 있는 것이 아니라, 최초 `REQUEST`가 URL 인가와 `@PreAuthorize`를 이미 통과한 뒤 컨테이너가 이어서 수행하는 내부 디스패치만 허용한다. 따라서 비인증·일반 사용자의 최초 관리자 요청은 종전처럼 각각 401·403 경계에 남고, BE-61의 스트리밍 메모리 특성도 보존된다.

**회귀 방지.** `SecurityConfigTest`에 실제 `SecurityConfig`·`JwtAuthenticationFilter`·`JwtUtil`과 브라우저 방식의 `accessToken` 쿠키를 쓰는 스트리밍 probe를 추가했다. 수정 전에는 관리자 `asyncDispatch`가 실제 장애와 같은 `AuthorizationDeniedException`으로 실패하는 것을 먼저 확인했다. 수정 후에는 관리자가 본문까지 200으로 완료되고 일반 사용자는 비동기 시작 전 403으로 차단됨을 함께 고정했다. MockMvc 응답 헤더 Map은 실제 컨테이너와 달리 thread-safe하지 않아, 테스트 스트림은 최초 필터 체인이 헤더를 마친 뒤 latch로 풀도록 해 전체 스위트 부하에서도 안정화했다.

**2-WAS 실환경 재검증.** 사용자의 기존 3000(PID 28276)·28080(PID 53508)과 별도 Nuxt 3002(PID 16276)는 유지하고, 새 JAR로 3001/28081(SVR1)/28082(SVR2)를 격리 기동했다. 모의 SSO 관리자 로그인 후 WAS 로그 화면에서 SVR2를 선택해 원격 28082 로그가 표시되는 것을 확인하고 다운로드를 눌렀다. 28081에는 `actor=K140024 instance=SVR2 lines=43` 성공 감사가 남고 종전 보안 예외는 재발하지 않았다. 같은 SSO 세션으로 첨부 응답을 직접 저장한 결과는 **HTTP 200**, `text/plain; charset=UTF-8`, `attachment; filename="was-log_SVR2_20260823_213341.log"`, **9,567바이트**였으며 본문에 `SVR2`와 원격 포트 `28082` 로그가 모두 포함됐다. 검증 뒤 3001/28081/28082와 임시 로그·다운로드 파일을 제거했고 기존 세 포트의 PID가 그대로임을 재확인했다.

**검증.** `WasLogDownloadTest`·`FileControllerTest`·`SecurityConfigTest` 대상 테스트 통과, 백엔드 전체 `./gradlew test` **4,009건(1건 skip) 통과**, `./gradlew spotlessCheck bootJar` 통과.

### ✅ 2026-08-23 MIG-01 완료 — 부문계획 `사업진행` 이관 배선

코드 체계 개편으로 기록 위치를 만든 데 이어 **이관 어댑터 배선까지 마쳤다.** 조정 시트의 `사업진행` 값이 이제 계획 스냅샷뿐 아니라 원장(`BPROJA`)에도 상태코드로 남는다.

**매핑(2026-08-23 사용자 결정).** 시트가 갖는 값은 세 가지뿐이다(설계 `2026-08-11-excel-bulk-migration-design.md` §5.4).

| 시트 값 | 상태코드 | 비고 |
| --- | --- | --- |
| `진행(품의)` | `71` 입찰/계약 요청 | |
| `진행(계약)` | `75` 입찰/계약 진행 | 시트에 체결 전·후 구분이 없어 진행중으로 고정 — `79`(완료)로 보면 체결 전 건까지 완료로 읽힌다 |
| `취소(연기)` | `00` 취소(연기) | 대응값이 없어 `V20260823_005`로 신설 |

신설한 `00`은 진행률 0, 정렬 순번 31(마지막)이다. 코드값은 앞자리가 단계를 뜻하는 체계에서 "어느 단계도 아닌 예외 상태"로 읽히고, 순번을 마지막에 둔 것은 종료·보류 상태가 선택 목록 맨 앞에 오면 진행 흐름을 읽는 데 방해가 되기 때문이다. 영문은 `Cancelled / Postponed`.

**기록 위치.** `BprojaSyncService.upsert(사업번호, "ADJ-" + 사업번호, 코드)`로 **전용 key**를 쓴다. 사업 자신의 행(`CNCD_RFR_NO = ABUS_MNG_NO`)에 쓰면 예산편성 요청 상태를 덮고, 부문계획 문서 행에 쓰면 부문계획 자체의 상태(11·19)와 뒤섞인다. 단계 서비스마다 자기 문서 key를 쓰는 기존 관례(사업계획은 `BIZ-`)를 그대로 따랐다. BE-33 이후 대표상태는 사업 자신의 행만 보므로 이 새 key는 **대표상태를 흔들지 않고**, `bprojaStsCodes`를 통해 진행현황 카드에만 반영된다(의도한 효과).

**모르는 값은 접지 않는다.** 매핑에 없는 문구나 빈 값이면 아무것도 쓰지 않고 `log.warn`만 남긴다 — 임의 코드로 접으면 화면에 사실과 다른 단계가 켜진다. 원문은 종전대로 계획 스냅샷(`BPLANM.REDT_CONE_INF`)에 남아 정보가 사라지지 않는다.

**관심사 분리.** 처음에는 `MigrationImportService`에 직접 넣었는데 파일이 843줄이 되어 `MaxLinesRatchetTest`가 막았다(800줄 상한, 기준선 추가는 허용된 해소 수단이 아니다). 매핑표와 기록 판정을 `PlanAdjustmentProgressRecorder`로 분리해 오케스트레이션 서비스는 790줄로 돌아왔다 — "시트 문구를 상태코드로 옮긴다"는 판정이 매핑표와 한 덩어리로 움직이므로 분리 경계가 자연스럽다.

**프론트 보강.** `00`은 어느 타임라인 단계에도 속하지 않는데 앞자리 폴백이 `0`을 예산편성과 겹쳐 읽어 **취소된 사업이 '예산편성'으로 보이는** 문제가 있었다. `NON_STAGE_STATUS_CODES`로 먼저 걸러 단계 없음(-1) → 회색 태그가 되게 했다.

**회귀 방지.** `MigrationImportServiceTest`에 매핑 3건을 `@ParameterizedTest`로 고정하고(전용 key까지 함께 검증), 모르는 값·빈 값에서 `upsert`가 호출되지 않는 것을 2건 추가했다. 프론트는 `00`의 밴드 폴백 차단과 회색 태그를 고정했다.

**검증.** 백엔드 `./gradlew check` BUILD SUCCESSFUL. 프론트 `format:check`·`check`·`npm test` **3,835건 전부 통과**. `V20260823_005`는 로컬에 적용해 확인했다(`success=1`, 112ms) — 코드 `00`이 이름·진행률 0·순번 31로 자리 잡았고 영문 번역도 들어갔다. **dev/prod 적용은 DBA 몫이다.**

### ✅ 2026-08-23 FE-47·FE-48 E2E 재검증·안정화

**FE-47.** 기존 조치(`/api/cost` 공통 mock, 결재선 미지정 버튼의 접근성 이름 복원)를 수동 로그인 setup이 없는 `chromium` 프로젝트로 직접 재검증했다. `info-home.spec.ts` 7건과 `report-pdf-latest.spec.ts` 4건, 총 **11건이 재시도 없이 통과**했다. `ApprovalLineSelector.test.ts` 3건도 통과해 표시 라벨과 aria-label 계약을 단위 경계에서 다시 확인했다.

**FE-48.** 간헐 실패의 경계는 알림 버튼 렌더와 `useNotifications.refresh()` 완료가 동기화되지 않은 데 있었다. `notifications.spec.ts`가 버튼 가시성만 기다리지 않고, `/api/notifications`·`/api/notifications/unread-count` GET 응답 두 건과 기대 뱃지 DOM 상태까지 조건 기반으로 기다린다. 고정 timeout은 늘리지 않았다.

이 단언을 추가하며 별도의 mock 충돌도 드러났다. 넓은 `/api/notifications` 정규식이 `/api/notifications/unread-count`까지 매칭하는데, Playwright가 나중에 등록한 route를 먼저 검사해 넓은 mock이 미읽음 응답을 가로채고 있었다. 구체적인 `unread-count` mock을 마지막에 등록해 우선순위를 바로잡고, 이전에는 이름과 달리 종 아이콘만 검사하던 첫 테스트가 실제 `3` 뱃지를 검증하게 했다.

**검증.** `notifications.spec.ts` 4건 단일 실행 통과 후 `--repeat-each=10 --retries=0`으로 **40/40 통과**했다. 알림 composable·결재선 접근성·편성요청서 이관 페이지 선별 단위 테스트도 **26/26 통과**했다. FE-48에 함께 기록된 이관 페이지 케이스는 FE-58에서 파일 단위 60초 한도를 적용한 현재 상태로 통과했다(해당 케이스 약 8.0초). 전체 `npm test`도 **337개 파일·3,835건 전부 통과**했다.

### ✅ 2026-08-23 V20260823_004 — 공통첨부파일 CHAR semantics 재적용 + 비대칭 마무리

`V20260823_001~003`을 로컬에 적용한 뒤 후속으로 확인하다 **`V20260820_011`이 남아 있지 않다는 것**을 발견해 재적용했다.

**발견.** `V20260820_011__WidenCommonFileNameAndPathToCharSemantics`는 이력에 `success=1`인데 `TPRMPP_CFILEM.FL_NM`·`APG_FL_PTH`가 **여전히 BYTE**였다. 그 스크립트는 전환 실패 시 `ORA-20004`로 중단하는 검증 블록까지 갖고 있었으므로 적용 당시엔 성공했고 **그 뒤에 되돌아간 것**으로 본다. 가장 그럴듯한 경로는 `ITPOWN_DDL_live.sql`을 쓰는 부트스트랩 재생성(`tools/apply-ddl-live.ps1`)이나 덤프 복원이다 — 그 스냅샷은 두 컬럼을 BYTE로 담고 있고, Flyway 이력 테이블도 같은 스키마에 있어 함께 복원되면 "적용됨"으로 남는다.

**감사 방법을 바꿨다.** `V20260823_002`가 2건을 놓친 원인이 스냅샷을 출처로 삼은 것이었으므로, 이번에는 `ALL_TAB_COLUMNS` + **실데이터**로 확인했다. BYTE 컬럼 200개를 전부 훑어 `LENGTHB(col) <> LENGTH(col)`인 행을 세니 **비ASCII를 실제로 담은 컬럼은 딱 둘**이었다.

| 컬럼 | 비ASCII 행 | 최대 바이트 / 한도 |
| --- | ---: | --- |
| `TPRMPP_CFILEM.APG_FL_PTH` | 294 | **254 / 255** — 1바이트 남음 |
| `TPRMPP_CFILEM.FL_NM` | 296 | 93 / 100 |

**즉 지금 실재하는 결함이었다.** 값이 전부 한글 부서명·사업명 폴더라 조금만 긴 편성요청서를 올리면 `ORA-12899`로 업로드가 실패한다. 이 발견이 `_004`의 주된 이유이고, 비대칭 3건 마무리는 부수적이다.

**대상 5건.** `CFILEM.FL_NM(100)`·`APG_FL_PTH(255)` 재적용, 그리고 `V20260823_002`가 놓친 마스터↔로그 비대칭 `CAPPLM.APF_DCM_NO(64)`·`CCODEM.CO_C_ID_NM(100)`과 형제 일관성 `CORGNI.PRLM_OGZ_C_CONE(100)`. `CAPPLA.FNT_TB_NM`은 주석이 '…명'으로 끝나지만 값이 테이블 이름(ASCII)이고 로그 짝도 없어 제외했다.

**적용·검증(로컬).** 별도 포트(28099)로 백엔드를 띄워 Flyway가 적용하게 하고 즉시 내렸다 — 28080의 기존 인스턴스는 건드리지 않았다. `20260823.004` `success=1`(269ms). 확인 결과: 대상 5개 모두 `CHAR_USED='C'`, **마스터↔로그 비대칭 잔존 0건**, BYTE varchar 컬럼 200 → 195, 여유가 `FL_NM` 54자·`APG_FL_PTH` 124자로 돌아왔다. 검증 블록에는 목록 재확인에 더해 **마스터↔로그 비대칭 전수 0건**을 넣어, 이번 목록 밖에서 새로 생겨도 걸리게 했다.

**dev/prod 적용은 DBA 몫이다.** 운영에도 `V20260820_011`이 되돌아가 있을 수 있으므로, 적용 전 `ALL_TAB_COLUMNS`에서 두 컬럼의 `CHAR_USED`를 먼저 확인한다.

### ✅ 2026-08-23 FE-54 가상 스크롤 도입 · MIG-01 프로젝트상태 코드 체계 개편

**사용자 결정(2026-08-23)**: FE-54는 선택지 A(도입), MIG-01은 프로젝트 단계를 신설하는 코드 체계 개편으로 진행한다.

#### FE-54 — `WasLogTable` 가상 스크롤 (설계 §6.1)

등재된 블로커("펼침 행의 가변 높이가 고정 `itemSize`와 충돌")는 **실재하지 않았다.** 모든 행이 `white-space: nowrap` 한 줄이고 예외 스택은 이 목록이 아니라 형제 컴포넌트 `WasLogDetailPanel`이 그린다(설계 §6.1·§6.3도 "펼침 **아이콘**"이라고만 적고 있다). 고정 `itemSize` 전제가 그대로 성립해 `VirtualScroller`를 그대로 넣었다.

실제 비용은 다른 곳이었다 — **스크롤 컨테이너 소유권 이동**이다. 종전에는 페이지의 `.was-logs-page__scroll` div가 스크롤을 소유하고 거기에 §6.2의 자동 일시정지·하단 고정이 걸려 있었다. 이제 스크롤은 `VirtualScroller`의 viewport가 소유하므로 배선을 다음처럼 옮겼다.

| 종전 | 현재 |
| --- | --- |
| 페이지가 `scrollArea` DOM ref로 `scrollHeight`·`scrollTop`·`clientHeight`를 직접 읽음 | `WasLogTable`이 `scroll` 이벤트를 올려보내고 페이지는 `event.target`에서 읽음 |
| 페이지가 `el.scrollTop = el.scrollHeight`로 하단 고정 | `WasLogTable`이 노출한 `scrollToBottom()` 호출 (`scrollToIndex(마지막, 'auto')`) |
| `.was-logs-page__scroll { overflow: auto }` | `overflow: hidden` — 크기·테두리만 담당 |

임계값 24px, 자동 일시정지와 수동 일시정지 구분은 그대로다. 페이지가 DOM을 직접 만지지 않게 해서 스크롤 구현이 또 바뀌어도 배선이 깨지지 않는다.

**회귀 방지.** `WasLogTable.test.ts`에 스크롤 소유권 계약 5건을 새로 고정했다 — `scroll` 재발행, `scrollToBottom`이 마지막 인덱스로 이동, 빈 목록에서 무해, 빈 목록이면 스크롤러 대신 안내 문구, 그리고 **`itemSize`와 CSS 행 높이가 같은 값(28px)인지**를 소스에서 대조한다(둘이 어긋나면 스크롤 위치가 밀리는데 화면에서만 드러난다). `wasLogsPageWiring.test.ts`의 스크롤 6건은 관측 지점을 DOM에서 계약으로 바꿔 다시 썼다 — 하단 고정을 `scrollToBottom()` 호출 횟수로 센다. 그 과정에서 **테스트가 페이지를 한 번도 unmount하지 않아** 모듈 전역 `feed`의 변경에 앞 테스트의 watch가 함께 반응하던 것을 발견해 `afterEach` 정리를 추가했다.

**남은 확인.** 이 화면은 `admin` 미들웨어가 걸려 있고 E2E 인증이 수동 로그인을 요구해(FE-47·48) **실제 브라우저 렌더는 확인하지 못했다.** 행 높이(28px)와 태그 축소가 실제로 맞아떨어지는지는 화면에서 한 번 봐야 한다.

#### MIG-01 — 프로젝트상태(`IT_PTL_STS_TC`) 코드 체계 개편

8번대를 신설 '프로젝트' 단계에 배정하고 기존 8·9번대를 9번대 안으로 밀었다.

| 신코드 | 구코드 | 코드명 | 진행률 | 순번 |
| --- | --- | --- | ---: | ---: |
| 81 | — | 프로젝트 착수 | 10 | 23 |
| 85 | — | 프로젝트 진행 | 50 | 24 |
| 89 | — | 프로젝트 완료 | 100 | 25 |
| 91 | 81 | 대금지급 요청 작성중 | 10 | 26 |
| 93 | 85 | 대금지급 진행중 | 50 | 27 |
| 95 | 89 | 대금지급 완료 | 100 | 28 |
| 98 | 91 | 성과평가 작성중 | 10 | 29 |
| 99 | 99 | 성과평가 완료 | 100 | 30 |

**마이그레이션** `V20260823_003__ReorganizeProjectStatusCodesForProjectStage.sql`. 이동 대상이 서로의 목적지를 쓰고 있어(81의 목적지 91은 성과평가가 쓰던 값) **뒤에서부터** 옮긴다 — 91→98, 89→95, 85→93, 81→91. 순서를 바꾸면 한 코드가 두 번 옮겨져 성과평가가 대금지급으로 둔갑한다. `IT_PTL_STS_TC` 값을 담는 컬럼 전부(BPROJA·BPROJM/L의 대표상태·BPAYMM/L·BCONTM/L·BDELIM/L·BESTIM/L)와 **번역 키**(`13:IT_PTL_STS_TC2:{코드}8:20260101`에 코드가 박혀 있다)를 같은 순서로 옮긴다. 코드 81의 이름이 아직 '대금지급 요청 작성중'일 때만 실행하는 가드를 둬 재실행 안전하다 — 가드가 없으면 재실행 시 새 대금지급 91을 다시 98로 밀어 버린다. 끝에 8개 코드의 이름·순번과 `BPAYMM`의 구 코드 잔존 0건을 확인하고 어긋나면 `ORA-20006`으로 실패한다.

**백엔드.** `PaymentService`의 `STS_DRAFT`·`STS_IN_PROGRESS`·`STS_DONE`을 81/85/89 → 91/93/95로 옮겼다. 다른 단계 서비스(`ContractService` 71/75/79, `DeliberationService` 61/65/69, `BizplanService` 21/29)는 영향이 없다. `CouncilService.STS_COUNCIL_SKIPPED = "99"`는 협의회 코드군(`IT_PTL_ASCT_PRG_STS_TC`)이라 무관하다.

**프론트엔드 — 개편이 깨뜨린 규칙 셋을 함께 고쳤다.**

1. **"끝자리 9 = 단계 완료"** — 대금지급 완료가 `95`, 성과평가 작성중이 `98`이 되어 깨졌다. `getStageProgress`가 `codes.at(-1)`(단계 정의의 마지막 코드)을 완료코드로 쓰도록 바꿨다. `stageCompletionCode`로 노출해 대시보드도 같은 출처를 쓴다.
2. **"코드 앞자리 = 단계"** — 9번대에 대금지급(91·93·95)과 성과평가(98·99)가 함께 들어와 깨졌다. `IT_PTL_STS_PHASE_TAG_CLASS`(앞자리 → 색) 를 `IT_PTL_STS_STAGE_TAG_CLASS`(단계 순서 → 색)로 바꾸고 `getProjectStatusBandIndex`로 단계를 찾는다. 프로젝트 단계 색은 `kdb-tag-emerald`다.
3. **`bandOf`의 앞자리 매칭** — 같은 이유로 `98`·`99`가 대금지급으로 잡히고 있었다(배열에서 대금지급이 먼저다). **정확히 일치하는 단계를 먼저 찾고** 없을 때만 앞자리로 폴백하게 바꿨다. 앞자리 폴백은 공통코드에 없는 중간 상태코드(예: 예산편성 결재 상신 `02`)를 위해 남겼다.

그 밖에 `IT_PTL_STS_TIMELINE`에 '프로젝트' 단계를 추가하고(i18n 키 `project.form.progress.stages.project`, ko/en 추가) 대금지급·성과평가의 `codes`를 옮겼다. 단계가 10개 → 11개가 되어 `buildStageOrders`의 연번도 1~11(경상사업 1~7)로 늘었다. 새 라벨 '프로젝트'는 기존 단계 라벨과 같은 사유로 `user-facing-copy-allowlist.json`에 등재했다(화면 표시가 아니라 로직이 비교하는 값이며 표시는 `labelKey`로 한다).

**⚠️ 배포 순서 제약.** 백엔드가 이제 대금지급을 91/93/95로 쓰므로 **`V20260823_003`이 적용되지 않은 DB에 새 코드를 배포하면 기존 대금지급 원장(81/85/89)을 찾지 못한다.** 마이그레이션과 애플리케이션을 같은 배포 단위로 묶어야 한다. 로컬 실측 기준 영향 데이터는 0건이었다(BPAYMM·BCONTM·BDELIM은 비어 있고 BPROJA는 `01`만, `BPROJM.IT_PTL_RPR_STS_TC`의 `99`는 불변) — 운영은 DBA가 적용 전 같은 조회로 확인한다.

**검증.** 백엔드 `./gradlew check` BUILD SUCCESSFUL. 프론트 `npm run format:check`·`npm run check`·`npm test` **337개 파일 3,832건 전부 통과**.

**로컬 적용 완료(2026-08-23).** `V20260823_001`·`_002`·`_003`이 모두 `success=1`로 적용됐다 — 로컬 백엔드가 devtools로 재기동되며 Flyway가 실행했다(각 2,959ms·14,824ms·1,031ms). 적용 후 확인한 것: `max_string_size=EXTENDED`, 1군 대표 컬럼(`BCOSTM.CTT_OPP_NM`·`CBLBCM.NAC_CONE`·`CUSERI.USR_NM`)과 2군 대표(`BCOSTM.TMN_YN`) 모두 `CHAR_USED='C'`, 코드 8건이 이름·진행률·순번(23~30)대로, 영문 번역 8건이 새 키로 이동(`818→Project Kickoff` … `958→Payment Complete`), `BPAYMM`의 구 코드(81/85/89) 잔존 0건, `BPROJM.IT_PTL_RPR_STS_TC`의 `99`는 불변, `V20260823_001`의 비ASCII 미채움 행 0건. **dev/prod 적용은 여전히 DBA 몫이다.**

### ☑️ 2026-08-23 BE-72 감내 판정 — `MAXVALUE 9999` 시퀀스 `CYCLE`

**결정: 조치하지 않는다(감내).** 발동 조건이 실제 업무량으로 도달할 수 없고, 되돌리는 방향(`NOCYCLE`)이 오히려 더 나쁘다.

**등재된 분석이 두 군데 틀렸다. 이 정정이 감내 판단의 근거다.**

| 등재 내용 | 실제 |
| --- | --- |
| 상한 도달 = **누적 9,999건** | **한 해에 같은 시퀀스를 10,000번 채번**해야 한다. 관리번호가 `{연도}-{seq:04d}`이고 시퀀스는 연도와 무관한 전역 순번이라, 같은 값이 다시 나오려면 9,999회 채번이 지나야 하고 그것이 같은 연도 안에서 일어나야 한다 |
| 충돌하면 **PK 위반** | **예외가 나지 않는다.** `Bcostm`·`Bprojm`의 PK는 `(관리번호, 일련번호)` 복합키이고 일련번호는 *버전*이다(`LST_YN='Y'`가 현재 유효 버전). `CostService.createCost`가 `getNextSnoValue(costBgNo)`로 기존 원장의 max+1을 받아 `lstYn("Y")`로 저장하고 이전 버전을 `'N'`으로 내리지 않으므로, 충돌 시 ① 무관한 남의 원장에 새 버전으로 조용히 붙고 ② 같은 관리번호에 `LST_YN='Y'`가 둘 생겨 "Y는 하나"라는 불변식이 깨진다. 오류로 드러나지 않는 데이터 오염이라 등재 내용보다 심각한 양상이다 |

**실측(로컬, 개발 기간 누적).** `ALL_SEQUENCES` 기준 `CYCLE` 시퀀스 14개의 소모량이다.

| 시퀀스 | `LAST_NUMBER` | 상한(9,999) 대비 |
| --- | ---: | ---: |
| `SQ_TPRMPP_BCOSTM_1` | 1,073 | 10.7% |
| `SQ_TPRMPP_BITEMM_1` | 689 | 6.9% |
| `SQ_TPRMPP_BPROJM_1` | 499 | 5.0% |
| `SQ_TPRMPP_BBUGTM_1` | 472 | 4.7% |
| 나머지 10개 | 21 ~ 471 | ≤ 4.7% |

**이 수치는 실제 업무량보다 크게 부풀려져 있다.** 가장 빠른 `BCOSTM`이 1,073을 소모했는데 `TPRMPP_BCOSTM`의 실제 행은 **120건**(고유 `BG_NO`도 120건)이다. 차이 953은 삭제된 테스트 데이터·롤백된 트랜잭션·`CACHE 20`이 devtools 재기동마다 버리는 값이다. 운영은 재기동이 드물고 삭제가 soft delete라 이 낭비가 훨씬 적다. 즉 연 10,000건에 닿으려면 실제 업무량이 **80배 이상** 늘어야 한다.

착수 전 세웠던 "자식 행 채번이라 빨리 탄다"는 가설(단말 `TER-`, 품목 `GCL-`)은 사실이 아니었다 — `SQ_TPRMPP_BTERMM_1`은 21, `SQ_TPRMPP_BITEMM_1`은 689다. 품목 채번은 신규 품목에만 일어나고 기존 품목은 `getGclMngNo()`를 재사용한다(`ProjectItemSynchronizer`).

**`NOCYCLE`로 되돌리지 말 것.** 되돌리면 **누적 9,999건에서 시스템이 영구 정지**한다(`ORA-08004`, 해당 원장 생성 자체가 막힘). 현재의 `CYCLE`은 그 대안보다 명백히 낫다 — 하드 정지를 "연 10,000건에서만 발생하는 도달 불가 조건"으로 바꾼 것이다. 운영 DDL도 이미 `CYCLE`이다. 이 판단 근거가 없으면 다음 리뷰가 "`CYCLE`이 위험하다"는 표면만 보고 되돌릴 수 있어 여기에 남긴다.

**재개 조건.** 어느 원장이든 **연간 생성이 수천 건대에 진입**하면 다시 본다. 그때의 선택지는 `CYCLE` 해제가 아니라 ① 자릿수 확대(`%05d` — 단 `BG_NO`가 `VARCHAR2(15)`라 `COST-2026-00001`이 정확히 15자로 여유가 없다) ② 연도별 리셋 ③ 채번 후 존재 확인·재시도다.

**함께 관찰했으나 채택하지 않은 것.** `LST_YN='Y'`가 관리번호당 하나라는 불변식을 **DB가 강제하지 않는다** — 유니크 인덱스는 PK 두 개(`PK_BCOSTM_BG_NO_BG_SNO`, `PK_BPROJM`)뿐이다. 현재 데이터는 깨끗하다(중복 활성 버전 `BCOSTM` 0건·`BPROJM` 0건). 시퀀스 순환은 이 불변식을 깨는 여러 경로 중 가장 비현실적인 하나일 뿐이고 버전 승격 로직 결함이 훨씬 그럴듯한 경로이므로, BE-72의 근거로 삼지 않고 항목화도 하지 않는다. 필요해지면 별도 과제로 다룬다.

### ✅ 2026-08-23 잔여과제 저비용 배치 4 — FE-56·FE-58

앞선 세 배치에서 **"백엔드를 기동할 수 없어 `api.d.ts`를 재생성하지 못한다"는 이유로 두 번 미뤘던 FE-56을 이번에 끝냈다.** `DB_PASSWORD`가 환경변수에 이미 있었고, 로컬 백엔드가 28080에서 이미 떠 있어 그 인스턴스의 `/v3/api-docs`로 타입을 재생성할 수 있었다.

| ID | 조치 | 파일 |
| --- | --- | --- |
| FE-56 | **백엔드 계약 → 타입 재생성 → 프론트 판정 전환**을 한 번에 마쳤다. ① 백엔드 `ApplicationInfoDto`·`CostDto.Response`·`ProjectDto.Response`에 `apfStsC`를 추가하고, 라벨을 세팅하던 어셈블러 4곳(`CostQueryAssembler` 2·`ProjectQueryAssembler`·`ProjectBatchAssembler`)에서 코드 원본을 함께 세팅한다. ② `npm run codegen`으로 `app/types/api.d.ts`를 재생성했다 — **추가 9줄이 전부**라 미반영 드리프트가 없었음도 함께 확인했고 `npm run codegen:check`도 통과했다. ③ `useApprovalLock`을 `APPROVAL_COMPLETED_LABEL = '결재완료'` 비교에서 `APPROVAL_COMPLETED_CODE = '02'` 비교로 바꾸고 호출부 5곳(`TerminalFormDialog`·`useCostEditingState`·`info/cost/[id]`·`info/cost/terminal/[id]`·`info/projects/[id]`)이 `apfStsC`를 넘기게 했다. | `it_backend`: `common/approval/dto/ApplicationInfoDto.java`, `domain/budget/cost/dto/CostDto.java`, `domain/budget/project/dto/ProjectDto.java`, `domain/budget/cost/service/CostQueryAssembler.java`, `domain/budget/project/service/{ProjectQueryAssembler,ProjectBatchAssembler}.java` · `it_frontend`: `app/types/api.d.ts`, `app/composables/useApprovalLock.ts`, 호출부 5곳 |
| FE-58 | 부하 민감 테스트 2건에 파일 단위 `vi.setConfig({ testTimeout: 60_000 })`를 줬다(조치 후보 ①). `requestFormMigrationPageBoundary`는 페이지를 12번 실제 마운트하는데 **무거운 자식은 이미 전부 stub**이라 ②(추가 stub)로 줄일 여지가 없고, ③(워커 하향)은 `vitest.config.ts`가 이미 MIG-25 실측으로 `maxWorkers = cpus/2`를 걸어 둔 상태라 전체를 더 느리게 만든다. 같은 실행에서 걸렸던 `architecture/scripts-lint`(ESLint Node API로 `scripts/**` 전수 검사)도 같이 올렸다. | `tests/unit/pages/requestFormMigrationPageBoundary.test.ts`, `tests/unit/architecture/scripts-lint.test.ts` |

**로컬 DB는 건드리지 않았다.** 코드젠을 위해 백엔드를 직접 띄우려 했으나 28080이 이미 사용 중이어서(사용자 인스턴스가 devtools로 재시작하며 새 DTO를 이미 반영하고 있었다) 그 인스턴스의 스펙을 그대로 썼다. 애초에 띄울 때도 `FLYWAY_ENABLED=false`로 시작해 **미적용 마이그레이션 2건(`V20260823_001`·`_002`)이 로컬 스키마에 적용되지 않게** 했다 — 두 스크립트는 여전히 적용 대기 상태다.

**회귀 방지.** `useApprovalLock.test.ts`를 코드값 기준으로 바꾸고 **"표시 라벨(`'결재완료'`·`'Approved'`)을 넘기면 잠기지 않는다"** 는 단언을 추가했다 — 라벨 비교로 되돌아가면 이 테스트가 깨진다. 라벨만 세팅하던 픽스처 3곳(`useCostEditingState`·`useCostListPage`·`TerminalFormDialog` 테스트)에 `apfStsC`를 함께 넣었다.

**계약 가드가 세 번 걸렸고 셋 다 정당했다.** ① `ApiResponseOpenApiContractTest`가 `CostDto.Response`의 `requiredProperties`와 `ApplicationInfoDto`의 nullable 예외 목록에 `apfStsC`가 빠진 것을 잡았다 — 응답 스키마의 필수·nullable 계약을 필드 추가와 함께 갱신하도록 강제하는 가드다. ② `MaxLinesRatchetTest`가 `ProjectDto.java`를 1,016 → 1,024줄로 키운 것을 막았다(정책상 기준값 상향은 해소 수단이 아니다). 새 필드의 여러 줄 JavaDoc과 바로 위 `apfSts`의 블록 주석을 각각 한 줄 요약으로 압축해 **정확히 1,016줄로 되돌렸고** 설명은 그대로 남겼다. ③ `requiredProperties` 변경이 스키마의 `required` 배열을 바꿔 `codegen:check`가 드리프트를 잡았고, 재생성해 `apfStsC?: string | null` → `apfStsC: string | null`로 맞췄다.

**검증.** 백엔드 `./gradlew check`(test + spotlessCheck + Jacoco) **BUILD SUCCESSFUL**. 프론트 `npm run codegen:check` 드리프트 없음, `npm run format:check`·`npm run check` 통과, `npm test` **337개 파일 3,816건 전부 통과** — FE-58 대상이던 두 파일도 이번 전체 실행에서 통과했다.

**남은 것.** 이번 회차 뒤 `TASK.md`의 활성 항목은 전부 **이 환경에서 끝낼 수 없는 것들**이다 — 🏛️ External 3건(BE-24·BE-58·BE-66), DB 접속·DBA 판단이 선행인 2건(BE-64와 그에 걸린 BE-71), 두 프로세스 실환경 검증(BE-57), 설계·업무 결정이 선행인 4건(FE-54·BE-72·MIG-01·BE-51), 조건부 1건(BE-52), 외부 규격 대기 1건(SEC-12), 해외점포 자료 대기 1건(MIG-12), 수동 로그인이 필요한 E2E 2건(FE-47·FE-48).

### ✅ 2026-08-23 잔여과제 저비용 배치 3 — BE-65(BE-73 ② 포함)·CQ-32 ③

남은 항목 중 코드·스크립트만으로 끝낼 수 있는 것을 마저 처리했다. 이번 회차는 **DDL 한 건과 프론트 정리 한 건**이다. 나머지 잔여는 DB 접속·DBA 판단·외부 규격에 걸려 있어 손대지 않았다(아래 「손대지 않은 것」).

| ID | 조치 | 파일 |
| --- | --- | --- |
| BE-65 | `V20260823_002__AlignByteSemanticColumnsToCharSemantics.sql`를 추가했다. **전수 감사부터 했다** — `ITPOWN_DDL_live.sql`을 파싱해 VARCHAR2 컬럼 1,089개(BYTE 284 / CHAR 805)를 뽑고, 백엔드 엔티티의 `@Table`·`@Column`과 대조해 **엔티티에 매핑된 BYTE 컬럼 103개**를 확정했다. 103개 모두 엔티티 `length`가 DDL 길이와 같아 **글자 수를 전제**하고 있었다. 그중 한글이 실제로 들어가는 **46개**(1군)를 CHAR로 바꾼다 — BE-65가 지목한 후보(`BCOSTM/BCOSTL.CTT_OPP_NM`, `BTERMM/BTERML.RMK`, `CFILEM.FL_PYS_NM`·`FL_KPN_PTH`, `CMENUM/CMENUL.IMK_NM`) 8개에 더해, 같은 결함이지만 후보 목록에 없던 자리들을 찾았다. **가장 큰 것은 `CBLBCM/CBLBCL.NAC_CONE`(게시물 본문)** — `BoardPostDto`가 `@Size(max = 4000)`을 **글자 수**로 검증하는데 컬럼은 4000 BYTE라 한글 1,334자부터 `ORA-12899`가 난다. `CUSERI.USR_NM`·`CORGNI.BBR_NM`·`CCODEM.CO_CDVA_NM`·`CDECIM.DCR_OPNN_CONE`·`CINFMM.TTL`·`BPLANM/BPLANL`의 예산 비고 4종도 같은 성격이다. | `it_database/migrations/V20260823_002__AlignByteSemanticColumnsToCharSemantics.sql`(신규) |
| BE-73 ② | 같은 스크립트의 **2군 54개**로 처리했다(BE-65에 합쳐 두었던 항목). 마스터↔로그 짝을 전수 대조해 semantics가 갈린 62쌍을 찾았고, 1군에서 이미 처리되는 8개를 뺀 54개를 정렬한다. 방향은 **마스터를 로그에 맞춘다** — 2026-08-20 재구축이 로그 쪽만 CHAR로 만들어 생긴 비대칭이라 로그가 기준이다(`BTERML.IT_PTL_TMN_SVC_TC` 하나만 반대라 로그 쪽을 고친다). 길이 문제는 없고 비대칭 해소가 목적이다. **2026-08-23 로컬 적용 후 실측: 2건이 빠졌다.** `TPRMPP_CAPPLM.APF_DCM_NO`(마스터 BYTE/64 vs 로그 CHAR/64)와 `TPRMPP_CCODEM.CO_C_ID_NM`(BYTE/100 vs CHAR/100)이 남았다. 원인은 감사 출처가 `ITPOWN_DDL_live.sql` **스냅샷**이었다는 것이다 — 실제 DB보다 낡아 두 컬럼의 semantics를 다르게 담고 있어 짝 비교에서 걸러지지 않았다. 둘 다 ASCII만 담아(신청서문서번호·공통코드ID명) 기능 영향은 없으나 위 "54개"는 **실제로 52개**다. 같은 감사를 다시 할 때는 스냅샷이 아니라 `ALL_TAB_COLUMNS`를 출처로 삼는다. | 위와 같음 |
| CQ-32 ③ | **실측 결과 "통합하지 않는다"로 결정하고, 대신 basename 헬퍼만 합쳤다.** 두 트리 빌더는 겉모습만 닮았고 계약이 다르다 — 노드 필드(`SourceTreeFolder{id,name,folders,files}` vs `RequestFormAnalysisFolder{id,path,name,depth,childFolders,files,descendantFileCount,descendantBlockerCount}`), 파일 payload(서버 `FileRecord` vs 진단이 붙은 클라이언트 파일), 정렬 규칙(형식 순위 우선 vs 이름만), 루트 구성(단일 루트 vs 부서별 루트)이 모두 다르다. 공통분모는 "경로 세그먼트를 따라 폴더를 찾거나 만드는" 12줄뿐이라, 이를 뽑으려면 노드 타입·자식 접근자·생성자를 제네릭 인자로 받는 헬퍼가 필요하고 그 배관이 없애는 중복보다 길다. 반면 basename 헬퍼 2벌은 실익이 분명해 합쳤다 — `requestFormSourceTree`의 `safeBasename`을 export하고, 가드가 없던 `requestFormAnalysisFiles.basenameOf`를 삭제해 그쪽도 제어문자·`.`·`..`를 `'file'`로 중화하는 같은 판정을 쓰게 했다(`normalizeSafeRelativePath`가 이미 내부적으로 `safeBasename`을 fallback으로 쓰고 있어 동작은 그대로다). | `app/utils/requestFormSourceTree.ts`, `app/utils/requestFormAnalysisFiles.ts` |

**마이그레이션 설계.** 100개 컬럼을 `ALTER` 문 100줄로 늘어놓는 대신, `'테이블\|컬럼\|길이'` 문자열 컬렉션을 도는 PL/SQL 블록 하나로 썼다. 이유가 두 가지다. ① **재실행 안전** — 컬럼이 없거나 이미 CHAR면 건너뛰므로, `ITPOWN_DDL_live.sql` 스냅샷이 최신이 아니어도(실제로 `V20260820_011`이 바꾼 `FL_NM`이 스냅샷에는 BYTE로 남아 있다) 안전하다. ② **목록과 검증이 갈라지지 않는다** — 전환 뒤 같은 목록을 되짚어 `CHAR_USED <> 'C'`가 하나라도 남으면 `ORA-20005`로 실패시킨다. 레코드 타입에는 생성자가 없어 컬렉션 리터럴을 못 만들므로, 스키마에 OBJECT 타입을 새로 만들지 않으려고 파이프 구분 문자열을 쓴다.

**안전성 근거.** ① 확장 방향이라 기존 값은 반드시 들어간다. ② `MAX_STRING_SIZE`가 이미 EXTENDED다(스키마에 `VARCHAR2(6000 CHAR)` 컬럼이 있다) — 4000자 컬럼도 CHAR로 선언할 수 있고, STANDARD였다면 `ORA-00910`으로 막혔을 자리다. ③ 대상 중 인덱스에 걸린 컬럼은 3개뿐이고 전환 후 최대 키가 모두 1KB 미만이라 키 길이 한도에 닿지 않는다. 적용·검증·실패 대응은 [`it_database/docs/operations/2026-08-23-char-semantics-alignment-handover.md`](it_database/docs/operations/2026-08-23-char-semantics-alignment-handover.md)에 인계 노트로 남겼다.

**회귀 방지.** `safeBasename`이 export되어 공개 계약이 됐으므로 `requestFormSourceTree.test.ts`에 경로 분리·중화(`.`·`..`·공백·제어문자)·멱등성 3건을 고정했다.

**손대지 않은 것.** 표에 남은 항목은 이번 회차의 수단으로 끝낼 수 없다.

- **BE-64**(옵티마이저 통계)·**BE-71**(`CBLBCM` 인덱스) — BE-64는 dev/prod 통계 상태 확인이 선행이고 로컬 수집도 DB 접속이 필요하다. BE-71은 항목 자체가 "실행계획 판단이 유효하려면 BE-64를 먼저 확인"이라고 못박고 있다.
- **FE-56**(`useApprovalLock` 코드값 판정) — `apfStsC`가 `ApplicationResponse`에만 있고 호출부 5곳이 쓰는 `ApplicationInfo`·`CostBulkResponse`·`ProjectResponse`에는 없다. 백엔드 DTO 3곳을 고친 뒤 **백엔드를 기동해 `npm run codegen`으로 `api.d.ts`를 재생성**해야 하는데(프론트 CLAUDE §2), 기동에 필요한 DB 비밀값이 없어 재생성을 할 수 없다. DTO만 고치고 타입을 안 맞추면 그 규칙을 어기는 중간 상태가 되므로 손대지 않았다.
- **BE-72**(`MAXVALUE 9999` + `CYCLE`) — 항목 자체가 "운영 DDL도 이미 CYCLE이라 즉시 되돌릴 사안은 아니며 … 검토 과제로 둔다"고 적고 있다. 채번 시 존재 확인 재시도든 연도별 리셋이든 채번 설계 결정이 선행이다.
- **FE-54**(가상 스크롤) — 펼침 행의 가변 높이를 고정 `itemSize` 전제와 어떻게 맞출지가 설계 결정이다.
- **BE-52**(1+M 조회) — 항목이 "다부모로 부르는 화면이 생기면 그때" 다루라고 조건을 달아 두었다.
- **SEC-12**(FIDO 거부 상태) — 연동 규격에 거부 상태값이 정의되면 그때 분기한다.
- **FE-47·FE-48** — 이 환경에서는 `auth.setup.ts`가 수동 로그인(`headless:false`)을 요구해 E2E를 돌릴 수 없다.

**검증.** 프론트 `npm run format:check`·`npm run check`(typecheck+lint+copy ratchet) 통과, `npm test` **3,815건 중 3,814건 통과**. 실패 1건은 `pages/requestFormMigrationPageBoundary.test.ts`의 20초 타임아웃으로 단독 실행에서는 3.1초에 통과한다 — 이번 변경(`safeBasename` 통합)이 건드린 화면이라 특히 확인했고, 부하 의존 flaky임을 확정해 **FE-58로 신규 등재**했다(2026-08-23 전체 실행 3회 중 2회 실패, 매번 단독 실행은 통과). 백엔드는 이번 회차에 코드 변경이 없어 배치 2의 `./gradlew check` 결과가 그대로 유효하다. 추가한 마이그레이션은 **아직 적용하지 않았다** — 로컬은 백엔드 기동 시 Flyway가, dev/prod는 DBA가 인계 노트의 절차대로 적용한다.

### ✅ 2026-08-23 잔여과제 저비용 배치 2 — BE-67·BE-70·BE-73·FE-57 + BE-66·CQ-32 부분

같은 날 첫 배치([아래 절](#-2026-08-23-잔여과제-저비용-배치--sec-17be-68be-69be-74cq-30cq-31cq-33))에 이어, 코드·문서만으로 끝낼 수 있는 항목을 한 번 더 처리했다. **BE-66·CQ-32는 남은 조각이 있어 표에 축소된 형태로 유지한다.**

| ID | 조치 | 파일 |
| --- | --- | --- |
| BE-67 | 검증·권한 판정을 응답 헤더 확정 **이전**으로 옮겼다. 두 아카이브 서비스를 `prepareArchive(...)`(검증 → 권한 조회 → 선택 판정 → 엔트리명 확정 → `ArchivePlan` 반환)와 `writeArchive(plan, output)`(확정된 바이트 전송만)으로 갈랐고, `FileController`가 `prepareArchive`를 먼저 부른 뒤 그 결과로 `ResponseEntity`를 만든다. 이제 잘못된 요청·권한 밖 선택은 `200 OK` 커밋 전에 400으로 나가 공통 예외 응답 계약을 그대로 탄다. | `infra/file/service/BoardAttachmentArchiveService.java`, `domain/migration/request/service/RequestFormSourceArchiveService.java`, `infra/file/controller/FileController.java` |
| BE-70 | `deleteExpiredBefore`에 `OR e.endDtm IS NULL`을 보강해 `TPRMPP_CMFATM`·`TPRMPP_CMFADM` 양쪽에서 END_DTM이 NULL인 행이 조회·정리 어디에도 걸리지 않고 영구 잔존하는 구간을 막았다. `fail`의 `e.failureCount + 1`은 `COALESCE(e.failureCount, 0) + 1`로 바꿔 `FLUR_NOT`이 NULL일 때 실패 잠금이 발화하지 않던 문제도 함께 닫았다. | `common/mfa/store/MfaTransactionJpaRepository.java`, `LoginPendingTransactionJpaRepository.java` |
| BE-73 ① | 로그 엔티티 `@Column(length)`를 물리 DDL에 맞췄다 — `BprojmL` 14건(`ABUS_NM` 200→100, `USID`·`TLR_USID`·`DVM_USID`·`DVM_TLR_USID` 32→14, `SVN_DPM_C`·`DVM_DPM_C` 100→20, `DGOG_PPO_CONE`·`PLM_DES` 1000→4000, `ABUS_RNG_CONE` 1000→600, `ABUS_NCS_CONE`·`HRF_PLN_CONE` 1000→300, `ABUS_MNG_NO` 32→30, `PRLM_HRK_OGZ_C_CONE` 32→100), `BtermmL` 4건(`SVN_DPM_C` 3→20, `BG_NO` 32→15, `CGPR_ID` 32→14, `TMN_MNG_NO` 32→16), 그리고 `length` 자체가 빠져 JPA 기본값 255가 되던 날짜 문자열 3건(`BprojmL.FLF_FSG_DT`, `BtermmL.XCR_BSE_DT`, `BcostmL.FST_DFR_DT`·`XCR_BSE_DT`)에 8을 넣었다. **마스터 엔티티(`Bprojm`·`Btermm`·`Bcostm`)는 이미 DDL과 일치했으므로 로그 쪽이 유일한 이탈이었다** — 정렬 대상을 마스터가 아니라 DDL로 잡은 근거다. 대조는 DDL 파싱 스크립트로 전수 확인했고 남은 불일치 0건이다. | `domain/log/entity/{BprojmL,BtermmL,BcostmL}.java` |
| BE-73 ③ | 백필 술어를 런타임 판정기에 맞춘 보정 마이그레이션 `V20260823_001__AlignPersonNameBackfillPredicate.sql`을 추가했다. `V20260822_002`는 `REGEXP_LIKE(v, '[^[:print:]]|[가-힣]')`로 판정해 한자·악센트 라틴 이름을 건너뛰었는데, `UserNameResolver`는 `[^\p{ASCII}]`로 본다. Oracle에는 `[:ascii:]` 클래스가 없어 `LENGTHB(TRIM(v)) <> LENGTH(TRIM(v))`로 같은 판정을 만들었다(이 DB는 AL32UTF8이라 비ASCII는 반드시 2바이트 이상). `IS NULL` 가드가 있어 재실행 안전하며 이미 채워진 행은 건드리지 않는다. **적용은 아직 하지 않았다** — 로컬은 백엔드 기동 시 Flyway가, dev/prod는 DBA가 적용한다. | `it_database/migrations/V20260823_001__AlignPersonNameBackfillPredicate.sql` |
| BE-73 ② | **BE-65로 이관한다.** 마스터↔로그 BYTE/CHAR 시맨틱 비대칭은 현 저장값에서 무해하고, 손대려면 어차피 DDL이 필요하다. 같은 성격의 BE-65(운영 레이아웃 재구축이 남긴 BYTE 시맨틱 컬럼)와 한 번에 다루는 편이 맞다. | — |
| FE-57 | 두 곳 모두 실패를 상태로 올렸다. ① `useInfoHomeFeed.loadBoardAttachments`가 `{ attachmentsByPost, failed }`를 돌려주고, 공지·일정 각각 `noticeAttachmentsFailed`·`scheduleAttachmentsFailed`를 노출한다. 본 목록은 그대로 두고(READY 유지) 그 위에 인라인 경고 + [첨부 다시 시도]를 띄운다 — 첨부가 있는 글이 **첨부 없음처럼** 보이던 것이 이제 구분된다. ② 경상예산 상세 조회 실패는 `ordinaryBudgetDetailError`로 올려 `InfoBudgetTimingCard`에 인라인 경고 + [다시 시도]를 붙였다(본 목록 재조회 없이 상세만 다시 부른다). 미등록의 `-`와 조회 실패의 `-`가 구분된다. | `app/composables/useInfoHomeFeed.ts`, `app/pages/info/index.vue`, `app/components/info/InfoBudgetTimingCard.vue`, `i18n/messages/info.ts` |
| CQ-32 ① | 확장자→아이콘 매핑 SoT를 `app/utils/fileFormatPresentation.ts` 하나로 합쳤다. 두 벌이던 `utils/requestFormSourceTree.filePresentation()`과 `components/common/FileFormatIcon.presentationFromFileName()`이 모두 이 표를 쓴다. 어긋나 있던 두 지점을 정리했다 — csv를 excel로 보고(컴포넌트 쪽 규칙 채택), hwp/hwpx 색상 분리는 유지했다(반입 트리는 아이콘이 같아 배지·색으로 구분하고, 컴포넌트는 한글 문서에 전용 아이콘을 써서 색을 무시하므로 손실이 없다). 반입 트리도 이제 word·image·archive를 인식하며 정렬 순위는 종전과 같다(PDF 0 · 엑셀 1 · 나머지 2). | `app/utils/fileFormatPresentation.ts`(신규), `app/utils/requestFormSourceTree.ts`, `app/components/common/FileFormatIcon.vue` |
| CQ-32 ② | `toBoardScheduleYmd`를 공통 `toLocalDateKey` 위임으로 바꿨다. 본문이 같았고 공통 쪽에 Invalid Date 가드가 있어 더 안전하다. | `app/utils/boardSchedule.ts` |
| CQ-32 ④ | `useFiles`의 ZIP 다운로드 두 곳에 복제돼 있던 파일명 안전화를 `app/utils/downloadFileName.ts`의 `safeDownloadNamePart`로 뽑았다. | `app/utils/downloadFileName.ts`(신규), `app/composables/useFiles.ts` |
| BE-66 ②③ | ② 개번 이력·증상·복구 절차를 `it_database/docs/operations/2026-08-23-migration-renumbering-recovery.md`에 기록했다. 세 대상 스크립트가 모두 멱등(`MERGE`·`INSERT … WHERE NOT EXISTS`·컬럼 존재 확인)임을 확인하고, 그 사실 위에 "중간 상태 이력 행만 삭제 → 재기동으로 새 번호 재적용" 절차를 세웠다. 개번 사슬은 git으로 재확인했다(`7ccebf2` → `ac71cd3` → `ba62fa5`, `e1d7828`). ③ 버전 예약 규칙(내용 채우기 전 빈 파일로 번호 선점, push된 번호는 개번 금지)을 `it_database/CLAUDE.md` §2와 `docs/guides/migrations.md`에 명문화했다. | `it_database/docs/operations/2026-08-23-migration-renumbering-recovery.md`(신규), `it_database/CLAUDE.md`, `it_database/docs/guides/migrations.md` |

**회귀 방지.** BE-67은 `FileControllerTest`에 두 엔드포인트 각각 "대상 확정 실패 → `400` + `asyncNotStarted()` + `Content-Disposition` 없음 + `writeArchive` 미호출"을 고정하는 테스트를 추가했다. 기존 서비스 테스트 29건은 확정→전송을 이어 부르는 헬퍼로 감싸 시나리오를 그대로 유지했다. FE-57은 `useInfoHomeFeed.test.ts`에 첨부 일괄조회 실패/성공 두 경우의 플래그를 고정하는 테스트를 추가했고, CQ-32는 `fileFormatPresentation.test.ts`(반입 트리와 공통 표가 **같은 객체**를 돌려주는지 포함)와 `downloadFileName.test.ts`를 새로 두었다.

**남긴 것.**

- **BE-66 ①** — dev/prod 미적용 확인은 DBA 조회가 필요해 표에 🏛️ External로 남긴다. 조회 SQL과 판단 기준은 위 운영 문서 §1에 있다.
- **CQ-32 ③** — 폴더 트리 빌더 2벌(`requestFormAnalysisFiles.ts`·`requestFormSourceTree.ts`)은 노드 타입과 집계 필드가 달라 통합 비용 실측이 필요하다. 표에 축소해 남긴다.
- **BE-73 ③의 적용** — 스크립트만 추가했고 실제 적용은 기동·DBA 몫이다.

**검증.** 백엔드 `./gradlew check`(test + spotlessCheck + Jacoco 커버리지 검증) **BUILD SUCCESSFUL**. 신규 Java 코드가 google-java-format을 어겨 첫 실행이 spotlessCheck에서 red였고 `spotlessApply` 후 통과했다. 프론트 `npm run format:check`·`npm run check`(typecheck+lint+copy ratchet) 통과, `npm test` **337개 파일 3,812건 전부 통과**(첫 배치에서 부하 타임아웃으로 실패했던 `scripts-lint`·`requestFormMigrationPageBoundary` 2건도 이번 실행에서는 통과했다).

### ✅ 2026-08-23 잔여과제 저비용 배치 — SEC-17·BE-68·BE-69·BE-74·CQ-30·CQ-31·CQ-33

2026-08-23 REVIEW·TEST 점검이 등재한 항목 중 **DDL 변경도 API 계약 재생성도 필요 없는 7건**을 한 배치로 처리했다.

| ID | 조치 | 파일 |
| --- | --- | --- |
| SEC-17 | `SearchCondition.ignorePublicationPeriod`에 `@Setter(AccessLevel.NONE)`. 클래스 레벨 Lombok `@Setter`가 만들던 `setIgnorePublicationPeriod(boolean)`가 사라져 `@ModelAttribute` 바인딩 경로가 끊긴다. 서비스는 종전대로 무인자 `ignorePublicationPeriod()`로만 켠다. | `common/board/dto/BoardPostDto.java` |
| BE-68 | `OnePassClient.request`의 `catch (Exception ignored)`를 `catch (Exception exception)` + cause 체이닝으로 바꾸고, null 응답 판정을 try 밖으로 분리해 자기 예외를 다시 감싸지 않게 했다. `MfaService`에 `@Slf4j`를 도입해 재포장 3지점(공급자 거부·challenge 시작 실패·검증 실패)에 `log.warn(..., exception)`을 남긴다. | `common/mfa/provider/OnePassClient.java`, `common/mfa/service/MfaService.java` |
| BE-69 | 로그 엔티티 `BcostmL`·`BprojmL`에 `cncdRfrNo` 필드 추가. `AuditLogPersister.copyColumnFields`가 필드명 일치로 복사하므로 필드만 있으면 채워진다. 물리 컬럼은 `V20260820_008`·`_009`에 이미 있어 DDL 변경 없음. | `domain/log/entity/BcostmL.java`, `BprojmL.java` |
| BE-74 | 조치 후보 ②를 택했다 — `RequestFormSourceFileArchiver`의 `private FileDto.UploadRequest.UploadRequestBuilder request(String)`를 없애고 `private FileDto.UploadRequest uploadRequest(String apfMngNo, String relativePath)`로 바꿔 시그니처에서 Lombok 생성 타입을 걷어냈다(`request(apfMngNo, null)`이 `request(String, ArchivePlanItem)`과 모호해져 이름을 분리). **그 뒤 첫 에러에 가려져 있던 javadoc 에러 3건이 더 드러나 함께 고쳤다** — 모두 같은 성격(javadoc이 Lombok 생성 게터·미import 타입을 못 봄)이다: `FileController:117`의 `@throws CustomGeneralException`을 같은 파일 다른 두 곳과 같은 FQN 표기로, `MigrationController:52`의 `{@link CustomUserDetails#getEno()}`와 `PlanService:319`의 `{@link PlanDto.SnapshotDto#getMigrationAdjustments()}`를 `{@link 타입}` + `{@code 메서드()}` 조합으로. 결과: `./gradlew javadoc` **BUILD SUCCESSFUL**(에러 0건, 경고 1,781건). | `domain/migration/request/service/RequestFormSourceFileArchiver.java`, `infra/file/controller/FileController.java`, `domain/migration/controller/MigrationController.java`, `domain/budget/plan/service/PlanService.java` |
| CQ-30 | **✔️ Resolved — 등재 시점 이후 이미 해소돼 있었다.** 워킹트리가 clean인 상태에서 `./gradlew spotlessCheck --rerun-tasks`가 **BUILD SUCCESSFUL**이고, `spotlessApply`도 완주하며 **변경 파일 0건**이었다(`MenuPathPolicyTest` lint 중단 없음, 40건 위반 없음). 커밋 `8a1c9f1` 「품질 정비」가 처리한 것으로 보인다. 별도 조치 없이 종료한다. | — |
| CQ-31 | ①~⑤ 전부 정리. ①`readDroppedEntries`(래퍼) 삭제 — 남는 `captureDroppedEntries`의 TSDoc으로 "drop 핸들러에서 동기적으로 호출해야 한다"는 경고를 옮겼고, 테스트는 지우는 대신 실제 소비 조합(`captureDroppedEntries`+`readDroppedEntryRoots`)을 부르도록 바꿔 순회·페이징·깊이 상한 커버리지를 지켰다. ②`monthFromYmd8`와 해당 describe 블록 삭제. ③`admin.requestForm.progress`·`dropActive` ko/en 4개 키 삭제. ④`FileKindRegistry.knownKinds()` 삭제. ⑤배너 PNG 3종 `git rm`. | `app/utils/directoryDrop.ts`, `app/utils/common.ts`, `i18n/messages/admin.ts`, `tests/unit/utils/{directoryDrop,common}.test.ts`, `app/assets/banner/*.png`, `infra/file/authz/FileKindRegistry.java` |
| CQ-33 | `infoDashboardProgress.ts`에 파일 헤더 배너와 공개 함수 4개·인터페이스 2개 TSDoc을 붙이고 `buildInfoDashboardProgressRows`의 **제외 조건 4가지(경상사업·중복 ID·날짜 파싱 실패·윈도우 밖)와 기간 역전 보정**을 문서에 명시했다. `getInfoDashboardProgressStage`에는 `stsTc` 앞자리 10단계 → 카드 4종으로 접는 규칙과 그 기준이 `utils/common.ts`의 `IT_PTL_STS_PHASE_TAG_CLASS`와 같다는 출처를 적었다. 테스트는 손으로 선언한 모듈 형태와 **옵셔널 호출을 걷어내고 실제 export를 직접 import**하도록 다시 썼다(export가 사라지면 타입 에러로 잡힌다). 문서화한 제외 조건 중 검증이 없던 **중복 ID·날짜 파싱 실패·기간 역전** 3건을 추가해 5건 → 8건. | `app/utils/infoDashboardProgress.ts`, `app/utils/infoDashboardSummary.ts`, `tests/unit/utils/infoDashboardProgress.test.ts` |

**회귀 방지.** SEC-17은 `BoardPostControllerTest`에 `GET /api/boards/{blbMngNo}/posts?ignorePublicationPeriod=true&keyword=공지`를 쏘고 `ArgumentCaptor`로 받은 `SearchCondition`의 `isIgnorePublicationPeriod()`가 `false`이며 `keyword`는 정상 바인딩됨을 고정하는 테스트를 추가했다.

**검증.** 백엔드 `./gradlew check`(spotlessCheck 포함)·`./gradlew javadoc` BUILD SUCCESSFUL. 프론트 `npm run format:check`·`npm run check`(typecheck+lint+copy ratchet) 통과, `npm test` 3,798건 중 3,796건 통과 — 실패 2건(`architecture/scripts-lint.test.ts`, `pages/requestFormMigrationPageBoundary.test.ts`)은 **전체 실행 부하에서만 나는 20초 타임아웃**이고 단독 실행에서는 각각 3.8초·3.3초로 통과한다(이번 변경과 무관, FE-48과 같은 성격).

### ✅ 2026-08-22 BE-63 이름 스냅샷 컬럼 8개 적재

**결정: 채운다. 규칙은 "생성·수정 시 갱신, 조인 값이 없으면(퇴사자) 기존 값 유지".**
이 규칙은 곧 목적이 **퇴사자 이름 보존**임을 뜻한다 — 조인이 비면 덮지 않고 남기므로 스냅샷이
유일한 보존 수단이 된다.

| 계층 | 변경 |
| --- | --- |
| 엔티티 | `Bprojm`에 `tlrNm`·`usrNm` + `assignPersonNames`, `Bcostm`·`Btermm`에 `cgprNm` + `assignCgprName` |
| 변경로그 엔티티 | `BprojmL`(2)·`BcostmL`(1)·`BtermmL`(1) — 리스너가 이름이 같은 필드를 반사로 복사하므로 필드만 추가하면 이력에도 따라 남는다 |
| 저장 경로 | `ProjectService` 생성·수정 2곳, `CostService` 생성·수정 2곳, 단말 생성 2곳·수정 1곳 — 기존 `assignSvnOrgNames` 스냅샷과 같은 자리 |
| 마이그레이션 | `V20260822_002__BackfillPersonNameSnapshots.sql` — 기존 8개 컬럼을 한 번 채운다 |

**핵심 설계 — 덮어쓰지 않는다.** `assignPersonNames`/`assignCgprName`은 인자가 null이거나 공백이면
**기존 값을 그대로 둔다.** 담당자가 퇴사하면 `TPRMPP_CUSERI` 조인이 비는데 그때 null로 덮으면 이
컬럼을 둔 이유가 사라진다. 조인으로는 되살릴 수 없는 값이라 한 번 채운 뒤에는 지키는 쪽이 맞다.

**담당자 컬럼이 사번 또는 이름을 담는다는 사정을 반영했다.** `USID`·`TLR_USID`·`CGPR_ID`에는 사번이
아니라 이름이 그대로 저장된 행이 있어(`UserNameResolver` 주석), 애플리케이션은 그 판정기를 그대로
쓰고 백필 SQL도 같은 규칙을 재현한다 — ① CUSERI 조인 성공 시 조회된 이름, ② 조인 실패 + 저장값에
한글이 섞였으면 저장값 자체가 이름. **조인 실패 + ASCII는 건드리지 않는다**(퇴직·미등록 사번을
이름처럼 노출하면 안 된다).

**검증**: `./gradlew test` **BUILD SUCCESSFUL**(전체). 백필 SQL은 실제 로컬 Oracle에서 롤백
트랜잭션으로 **8문 전부 실행**해 문법을 확인했고, 값이 실제로 채워지는 것도 확인했다 —
`TPRMPP_BTERML`의 `K140024 → 박차장`. 로컬은 사업·전산업무비 마스터가 0행이라 그쪽은 대상이 없었다.

**남는 것 — 운영 적용 시 확인**: 이미 퇴사한 담당자의 이름은 조인으로 되살릴 수 없어 백필 후에도
NULL로 남는다. 이 컬럼을 둔 목적이 그 보존이므로 **앞으로 생성·수정되는 행부터** 채워진다.
과거분 복원이 필요하면 인사 원장 등 다른 출처가 있어야 하며 이 작업 범위가 아니다. 운영 적용 전
DBA와 대상 행 수를 함께 확인하는 것이 좋다.

### ✅ 2026-08-22 FE-49 감사기 Record 값 탐지 도입 + 기준선 등재

**결정: 규칙을 켜고 기준선에 등재한다(1번).** 신규 유입만 막고 기존 분량은 감소 전용 부채로
전환한다.

| 파일 | 변경 |
| --- | --- |
| `scripts/lib/user-facing-copy-audit.mjs` | `object-copy` 규칙 추가 — 객체 리터럴 속성값이 한글을 담은 문자열이면 화면 문구로 본다 |
| `scripts/user-facing-copy-baselines.mjs` | 빈 객체 → **86개 파일 397건** 등재. 도입 배경과 재생성 절차를 주석에 명시 |

**착수 조건을 실제로 확인했다.** FE-49는 "다른 작업의 미커밋 변경이 없는 시점에 등재해야 남의
위반까지 흡수하지 않는다"를 조건으로 달아 두었다. 위반 파일 86개와 워킹트리 수정 파일의 교집합을
구하니 **12개가 나왔고 전부 이번 세션에서 내가 고친 파일**이었다 — 다른 작업의 파일은 하나도
포함되지 않아 흡수 위험이 없음을 확인하고 진행했다.

**FE-37의 "기준선 0건"은 이 사각지대를 포함한 착시였다.** 속성 이름이 `DISPLAY_KEYS`에 없고
export도 아니면 어느 규칙에도 걸리지 않아, `{ curC: '통화', ioeC: '비목' }` 같은 Record가 그대로
통과했다. 상위 오염원은 `composables/migration/columns.ts` 48건, `useCouncilCodes.ts` 36건,
`approval/forms/itBudget/pdf/projectSection.ts` 35건이다.

**규칙이 실제로 막는지 확인했다** — 임의 파일에 `const PROBE = { label: '새로 들어온 하드코딩
문구' }`를 넣자 ratchet이 `app/utils/breadcrumb.ts (1건)`으로 정확히 실패했고, 되돌리자 통과했다.

**ESLint 게이트가 두 번 잡았다**: `regexp/no-obscure-range`(한글 범위를 문자 그대로 쓰지 말 것),
`unicorn/escape-case`(이스케이프는 대문자). 최종 형태는 `/[가-힣]/`이다.

**검증**: `npm run check`(typecheck+lint+check:copy) 무오류, `npm test` **330파일 3,732건 전건
통과**. 중간에 `useInfoDashboardYear`·`infoHomeFeed` 2건이 실패했으나 공유 워킹트리에서 다른
작업이 편집 중이던 순간의 것이었고(그 사이 테스트 수가 3,730 → 3,732로 늘었다), 재실행에서 전건
통과했다. 해당 파일은 이번 작업이 건드리지 않았다.

### ✅ 2026-08-22 BE-36 `totRqmAmt` → `tyyBgAmt` 개명

**결정: 필드명을 정리한다. 이름은 `tyyBgAmt`(당년예산금액, `TYY_BG_AMT`).**
`meta/meta.txt` 형태소 기준 — 당년 `TYY`, 예산 `BG`, 금액 `AMT`. 형제 `prjBgAmt`도 meta에 통째
항목이 없는 조합어라 같은 방식으로 만든 선례다.

의미가 이름에 드러난다: `prjBgAmt`(총 예산) = `tyyBgAmt`(당해예산) + `mplAmt`(익년 이후 예산).

**동명이의를 가른 것이 이 작업의 전부였다.** 같은 이름이 두 도메인에 있고 한쪽만 틀렸다.

| 위치 | 의미 | 처리 |
| --- | --- | --- |
| `ProjectDto.Response.totRqmAmt` | 당해예산 | **개명** |
| `Bprojm`·`BprojmL`·`ProjectAmounts`·`ApprovalMailSnapshot` | DB `TOT_RQM_AMT` = 총 예산 | 그대로(컬럼명과 일치) |
| `Bbizpm`·`BizplanDto` | 사업계획 **총소요금액** | 그대로(컬럼명과 일치) |

**앞서 세운 가정 하나가 틀렸다 — 정정한다.** "프론트 전수 조사는 컴파일러가 대신한다"고 적었으나
사실이 아니었다. 프론트는 생성 타입 `ProjectResponse`가 아니라 `useProjects.ts`의 **손으로 쓴
`Project` 인터페이스**를 쓴다. 생성 타입만 바꾸면 `npm run typecheck`가 **오류 0으로 통과한다** —
잡아 주지 않는다. 그래서 32곳을 수동으로 분류해 옮겼고, 사업계획 문맥 5곳은 그대로 두었다.

| 저장소 | 변경 |
| --- | --- |
| `it_backend` | `ProjectDto.Response` 필드 + `ProjectBudgetSummaryService` setter. 소비처 5곳(`PlanService` 2·`CouncilService` 2, 나머지 1) + 테스트 15줄. 계약 테스트는 **사업 응답만** 갱신 |
| `it_frontend` | 앱 32곳 + 테스트 32곳. `api.d.ts`의 `ProjectResponse` 속성 |

**주의해서 되돌린 실수 하나**: 계약 테스트에서 `"totRqmAmt"`를 일괄 치환했더니 `BizplanDetail`·
`BizplanListItem` 계약까지 바뀌어 실패했다. 그 넷은 되돌리고 사업 응답 것만 남겼다. 동명이의
함정이 실제로 작동한 사례다.

**파일 크기 동결선에 걸려 주석을 줄였다**: 새 필드에 붙인 JavaDoc이 `ProjectDto.java`를 1,016 →
1,025줄로 늘려 `MaxLinesRatchetTest`가 실패했다. 기준값 상향은 허용된 해소 수단이 아니므로
한 줄 주석으로 압축했다(상세 근거는 이 기록에 남긴다).

**검증**: `./gradlew test` **BUILD SUCCESSFUL**(전체), 프론트 `format:check`·`check`·
`npm test` **330파일 3,730건 전건 통과**.

**남은 확인 하나**: `npm run codegen`을 실행하지 못했다 — 포트 28080이 OS 예약 대역이라 백엔드를
띄울 수 없었다. 생성물은 규칙(알파벳 정렬)상 위치가 같아 손으로 동일하게 반영했으나
(`tlrUsidPtCNm` < `totRqmAmt` < `tyyBgAmt` < `usid`), 백엔드를 띄울 수 있는 환경에서
`npm run codegen:check`로 한 번 확인해야 한다.

**함께 관찰**: `PlanDto.ProjectSnapshot.prjBg`가 당해예산(`tyyBgAmt`)으로 채워진다. 이름은 총예산을
가리키는데 값은 당해예산이라 BE-36과 같은 부류의 불일치일 수 있으나, `PlanDto`의 자체 의미일
가능성도 있어 범위를 넓히지 않았다.

### ✅ 2026-08-22 BE-55 WAS 로그 본문 마스킹

**결정: 마스킹 필터 도입. 대상은 토큰류(JWT·Bearer)와 주민등록번호 둘뿐, 사번은 제외.**
설계 §9의 '수용한 리스크'를 철회하고 문서를 개정했다.

| 파일 | 내용 |
| --- | --- |
| `WasLogMasker.java`(신규) | JWT(base64url 3분절)·`Bearer`/`Basic` 토큰 값·주민등록번호를 표시로 치환 |
| `RingBufferAppender.java` | `append`에서 메시지와 스택트레이스를 가린 뒤 담는다 |
| 설계 §9 | 수용 리스크 → 마스킹 도입으로 개정, 남는 리스크 명시 |

**설계에서 신경 쓴 것 넷**

1. **사번은 남긴다.** 어느 사용자의 요청에서 난 오류인지가 추적의 출발점이다. 이것을 지키는 음성
   테스트를 뒀다 — 범위를 넓히려면 그 테스트를 먼저 고쳐야 한다.
2. **파일 로그는 가리지 않는다.** 마스킹은 링버퍼 사본에만 적용된다. 화면·다운로드로 나가는
   경로만 막는 것이 목적이고, 서버 로그로 조사하는 경로는 그대로 둔다.
3. **자르기 전에 가린다.** 순서를 뒤집으면 12,000자 상한에서 잘린 자리의 토큰이 반쪽만 남아
   정규식에 걸리지 않는다.
4. **적재 경로 비용.** 모든 로그 이벤트가 지나는 자리라 평시 비용이 곧 처리량이다. 정규식 전에
   값싼 사전 검사(`.` 포함, `bearer`/`basic` 포함, 숫자 6자 연속)로 거르고, 가릴 것이 없으면
   **새 문자열을 만들지 않고 원본 인스턴스를 그대로 돌려준다**(테스트가 `isSameAs`로 고정).

**오탐을 줄인 패턴 선택**: JWT는 각 분절 길이 하한 8자를 둬서 `com.kdb.it` 같은 점 표기를 잡지
않고, 주민번호는 뒷자리 첫 숫자를 1~8로 제한해 전화번호·금액 같은 13자리 조합을 덜 잡는다.
`APF-2026-00000001 금액 1234567 전화 02-1234-5678`이 그대로 남는 것을 테스트로 지킨다.

**검증**: `WasLogMaskerTest` 7건 + `RingBufferAppenderTest`에 적재 경로 마스킹 1건 추가.
메시지뿐 아니라 **스택트레이스**도 가려지는지 함께 본다.

### ✅ 2026-08-22 SEC-14 파일 종류 화이트리스트

**결정: 등록된 종류만 받는다.** 클라이언트가 임의의 새 종류 이름으로 첨부를 만들고 그 종류에는
부모 자원 쓰기 권한 검사가 붙지 않던 경로를 닫았다.

**설계를 바꾼 실측 하나**: "registry에 등록된 종류만"을 **쓰기 판정기 기준으로 좁히면 안 된다.**
등록된 쓰기 판정기는 넷(배너·공통게시판·편성요청서반입·검토의견)뿐이라, 그대로 적용하면
요구사항정의서·타당성검토표·가이드문서·사업계획서·협의회관련자료 업로드가 전부 막힌다.

전수 조사로 실제 사용 종류를 확정했다 — 프론트 업로드 호출부 **14곳**의 `pkColNm` 인자(네 번째
인자다. 두 번째는 `flTpCone`이라 헷갈리기 쉽다)와 백엔드 내부 업로드를 모두 훑으면 **9종**이고,
이는 **읽기·쓰기 판정기가 선언한 종류의 합집합과 정확히 일치한다**.

| 파일 | 내용 |
| --- | --- |
| `FileKindRegistry.java`(신규) | 아는 종류 = 읽기·쓰기 판정기가 선언한 종류의 합집합. 손으로 목록을 관리하지 않으므로 **새 종류를 쓰려면 판정기를 먼저 등록**해야 한다 — 권한 규칙 없는 종류가 조용히 생기는 경로가 구조적으로 막힌다 |
| `FileTargetWriteAuthorizerRegistry.java` | `verifyTargetWriteAccess`가 부모 권한 검사에 앞서 **아는 종류인지**부터 본다. 세 진입점(단건 업로드·다건 업로드·메타 수정)이 모두 이 메서드를 지나므로 한 곳으로 전부 덮인다 |

**두 가지를 일부러 구분했다**: ① 아는 종류인가 ② 부모 권한을 누가 판정하는가. 쓰기 판정기가 없는
종류도 **알기만 하면 통과**시킨다 — 이 목록의 목적은 종류를 아는지 묻는 것이지 부모 권한 검사를
대신하는 것이 아니다.

**`pkColNm`이 null이면 종류 검사를 건너뛴다** — 메타 수정에서 "종류를 바꾸지 않음"을 뜻하기
때문이다. 업로드 경로는 `@RequestPart`가 필수로 강제하고, 저장경로 정화(2026-08-22)가 null을
이미 업무 예외로 거부한다.

**기존 행은 영향 없음**: 판정은 신규 업로드 경로에서만 한다. 그래서 착수 전 확인 대상이던
`PK_COL_NM`이 NULL인 2행도 조회·삭제가 그대로 되며, 이 변경으로 접근이 막히지 않는다.

**검증**: `./gradlew test` **BUILD SUCCESSFUL**(전체). 레지스트리 테스트에 3건 추가 — 아는 종류인데
쓰기 판정기가 없으면 통과(기존 동작 보존), 모르는 종류는 거부, null은 검사 생략. 기존 테스트
1건("미등록 레거시 종류는 검증을 생략한다")은 새 규칙과 어긋나 신규 테스트가 대체했다.
`RequestFormFileControllerProtectionTest`의 `@WebMvcTest` 슬라이스에 새 빈을 함께 올렸다.

### ✅ 2026-08-22 FE-55 WAS 로그 다운로드 본문을 파일 로그 형식으로

**결정: 변형 패턴(2번).** 자리와 구분자는 `FILE_LOG_PATTERN` 그대로 두고 **PID 자리에만
인스턴스ID**를 넣는다. 형식이 다르다는 사실은 파일 첫 줄 `#` 주석으로 밝힌다.

**형식을 추측하지 않았다** — `spring-boot-4.0.5.jar`의 `logback/defaults.xml`에서 실제 정의를 읽어
맞췄다.

```
FILE_LOG_PATTERN = %d{yyyy-MM-dd'T'HH:mm:ss.SSSXXX} %5p ${PID:-} --- %esb(){APPLICATION_NAME}[%t] %-40.40logger{39} : %m%n
다운로드      = 2025-08-20T18:00:00.000+09:00  INFO SVR2 --- [it] [http-1] com.kdb.it.A       : 메시지
                                                    └ PID 자리에 인스턴스ID
```

| 칸 | 구현 |
| --- | --- |
| `%d` | `DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSXXX")` + `ZonedDateTime` |
| `%5p` | `String.format(" %5s ", level)` |
| `${PID:-}` | **인스턴스ID**(`snapshot.instanceId()`) |
| `%esb(){APPLICATION_NAME}` | `spring.application.name`을 `[이름] `로. 비면 그 자리를 통째로 비운다 |
| `%-40.40logger{39}` | logback의 `TargetLengthBasedClassNameAbbreviator(39)` + `String.format("%-40.40s", …)` |

**축약기를 직접 만들지 않은 것이 핵심이었다.** 테스트가 두 번 내 기대를 반박했다 —
① `com.kdb.it.A`(12자)는 39자 안에 들어 **축약하지 않는다**(내 기대 `c.k.i.A`는 틀렸다),
② `com.kdb.it.common.admin.waslog.controller.WasLogController`는 39자에 맞는 순간 멈춰
`c.k.i.c.a.w.controller.WasLogController`가 된다(내 기대 `c.k.i.c.a.w.c.WasLogController`는 틀렸다).
손으로 구현했다면 두 경우 모두 파일 로그와 어긋났을 것이다.

| 파일 | 변경 |
| --- | --- |
| `WasLogController.java` | `streamOf`가 인스턴스ID·애플리케이션명을 받아 파일 로그 형식으로 출력. `applicationName` 주입 |
| `WasLogDownloadTest.java` | 형식 계약 2건 신규 — 칸 순서·구분자 전체 일치, 긴 로거명 축약과 40칸 고정 |
| `2026-08-20-was-log-viewer-design.md` | §5.6에 변형 사유 개정 각주 |

**검증**: `./gradlew test` **BUILD SUCCESSFUL**(전체). `WasLogDownloadTest` 7건 통과.
타임스탬프는 정규식 대신 `OffsetDateTime.parse`로 실제 파싱해 ISO8601+오프셋임을 확인한다.
로거 칸은 ` : ` 앞이 정확히 40칸인지 재어 고정폭 파서가 깨지지 않게 지킨다.

### ✅ 2026-08-22 FE-51 지정맥 손가락 선택 고아 코드 정리

**결정: 선택 UI는 불필요.** 기본값(`DEFAULT_BIO_AGENT_FINGER_TYPE = '10'`, 오른손 검지)으로
충분하다고 확정하고, 그리는 화면이 없어 고아가 된 것들을 정리했다.

**이력 확인**: 2026-08-12 계획서
[`docs/superpowers/plans/2026-08-12-mfa-vein-finger-field-removal.md`](docs/superpowers/plans/2026-08-12-mfa-vein-finger-field-removal.md)가
`MfaDialog`의 `인증할 손가락` 선택 항목을 이미 제거했고, 그때는 "**`useMfa`의 공개 인터페이스는
변경하지 않는다**"를 제약으로 두어 상태와 제어 함수를 일부러 남겼다. 이번 결정은 그 후속이다 —
UI가 불필요함이 확정됐으므로 남겨 둔 인터페이스까지 정리한다. 종전 TASK 문면이 걱정한 "다른
손가락 등록자의 인증 실패" 위험은 그 계획에서 이미 감내로 판단한 사안이다.

| 대상 | 조치 | 파일 |
| --- | --- | --- |
| `useMfa.selectFingerType` | 제거(함수 + 반환 export). 호출하는 컴포넌트가 0곳이었다 | `useMfa.ts` |
| `useMfa.fingerType` ref | 제거. 바뀔 경로가 없어져 상수와 같아졌으므로, 전송부가 `DEFAULT_BIO_AGENT_FINGER_TYPE`을 직접 쓰게 했다 | 〃 |
| `isBioAgentFingerType` | 제거. 유일한 호출부가 `selectFingerType` 안이었다 | `types/mfa.ts` |
| `BIO_AGENT_FINGER_TYPES`의 `labelKey` | 제거하고 값 배열로 단순화(`['9','17','33','10','18','34']`) | 〃 |
| `common.fingerTypes.*` 12개 키 | ko·en 모두 제거 | `i18n/messages/common.ts` |

**남긴 것과 이유**: `BIO_AGENT_FINGER_TYPES`(값 목록)·`BioAgentFingerType`·
`DEFAULT_BIO_AGENT_FINGER_TYPE`은 유지했다. 목록은 외부 규격(`mfa.md`)이 정한 값 집합이라 나중에
다시 필요해질 때 규격을 되찾는 출처이고, 타입이 여기서 파생된다. 왜 UI가 없는지도 주석에 남겼다.

**검증**: `npm run format:check`·`npm run check`(typecheck+lint+check:copy) 무오류,
`npm test` **330파일 3,730건 전건 통과**. `useMfa.test.ts` 22건·`MfaDialog.test.ts` 23건 포함.
제거된 동작을 검증하던 테스트 1건("손가락 종류를 바꾸면 다음 identify에 그 값을 보낸다")은 함께
삭제하고, 기본값이 나가는 것을 지키는 테스트는 이름과 주석을 정리해 남겼다 — 이 값이 바뀌면
BioAgent 연계 규격과 어긋나므로 상수를 고정하는 회귀 방지선이다.

**참고 — 알려진 flake**: `npm test` 첫 실행에서
`requestFormMigrationPageBoundary.test.ts` 1건이 실패했으나 단독 실행(3.0초) 통과, 재실행 전건
통과로 FE-48이 적어 둔 부하 의존 flake임을 확인했다(해당 파일은 MFA를 쓰지 않는다).

### ☑️ 2026-08-22 판단 대기 11건 결정 — 종결 2건

6차까지 정리한 판단 대기 11건에 사용자가 결정을 내렸다. 그중 **코드 변경 없이 종결되는 2건**을
여기로 옮긴다. 나머지 9건(조치 7 · 보류 2)은 결정 내용을 `TASK.md` 각 항목에 반영했다.

| 상태 | 항목 | 결정 | 근거 |
| :--: | --- | --- | --- |
| ☑️ Accepted | BE-56 | **현행 유지** — 관리자 행위 감사를 별도 테이블로 남기지 않는다 | `WasLogAuditLogger`의 애플리케이션 WARN 로그(파일 appender 12개월 보관, 조회는 행위자+인스턴스별 10분 스로틀)로 충분하다고 판단했다. 감사 요건이 조회 가능한 테이블을 요구하는 것으로 바뀌면 전용 테이블과 Flyway 마이그레이션을 그때 추가한다 — 삽입 지점은 `WasLogAuditLogger` 한 곳이라 재개 비용이 낮다 |
| ⛔ Discarded | MIG-30 | **불필요** — 반입 배치의 공통코드 조회 최적화를 하지 않는다 | 반입 배치는 **오픈 초기에 한정해 쓰는 기능**이라 누적 조회가 문제 되는 규모에 이르지 않는다. 최적화 비용(어댑터 계약 변경 — `FormAdapterContext` 생성 지점 19곳 + 어댑터 테스트 리더 스텁 전면 재작성)이 얻는 것보다 크다. 사실관계는 확인해 두었다 — `MigrationIoeCatalogReader`가 `CodeService`를 우회해 `CodeRepository`를 직접 부르므로 `codesByCid` 캐시를 타지 않는 것은 맞다(파일당 자본 8회 + 통화 1회) |

**결정 전체 요약** (7건 조치 · 2건 보류 · 2건 종결)

| 항목 | 결정 |
| --- | --- |
| SEC-14 | 화이트리스트 — registry 등록 종류만 허용 |
| BE-55 | 마스킹 필터 도입 (마스킹 대상 목록은 확정 대기) |
| BE-63 | 채운다 — 생성·수정 시 갱신, 조인 값 없으면(퇴사자) 기존 값 유지 |
| FE-51 | 선택 UI 불필요 → 고아 코드·i18n 키 정리 |
| BE-36 | 필드명 정리 (세 저장소 동시 변경) |
| FE-49 | 규칙 켜고 기준선 등재 |
| FE-55 | 변형 패턴 — PID 자리에 인스턴스ID |
| MIG-01 | 보류 — 전반적인 상태 코드 개편과 함께 |
| BE-51 | 보류 — 컬럼 폭 개편과 함께 |
| BE-56 | 현행 유지 (종결) |
| MIG-30 | 불필요 (종결) |

**함께 신설**: BE-64(옵티마이저 통계) — BE-51 실측 중 `ITPOWN` 93개 테이블 전부 통계가 없음을
발견해 별도 항목으로 세웠다. 로컬이 `impdp` DATA_ONLY로 만들어진 탓일 수 있어, 먼저 dev/prod의
실제 상태 확인이 필요하다.

### ✅ 2026-08-22 `main`에 남아 있던 붉은 테스트 2건 해소 (6차)

여섯 번째 배치. `TASK.md`에서 조치 가능한 항목이 사실상 소진돼(아래 분류) **1~5차 내내
"다른 작업의 미커밋 파일 탓"으로 넘겨온 프론트엔드 실패 2건을 다시 확인했다.** 귀속이
틀렸다 — `app/pages/info/cost/[id].vue`는 미커밋이 아니라 **커밋된 `main`의 파일**이었고,
두 실패 모두 `main` 자체의 결함이었다. 4차의 감사기 오탐에 이어 두 번째 자기 정정이다.

이로써 **프론트엔드 전체 스위트가 처음으로 완전히 초록이 됐다**(330파일 / 3729건).

| 상태 | 항목 | 조치 | 파일 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | `max-lines-ratchet` 실패 | `app/pages/info/cost/[id].vue`가 830줄로 상한 800을 넘고 있었다(기준선은 FE-38 이후 빈 객체라 예외가 없다). 순수 표시 변환을 `utils/costDetailDisplay.ts`로, 연관사업 다이얼로그 상태를 `composables/cost/useRelatedCostDialog.ts`로 분리해 **781줄**로 낮췄다 | `it_frontend` `app/pages/info/cost/[id].vue`, `app/utils/costDetailDisplay.ts`, `app/composables/cost/useRelatedCostDialog.ts` | `npm test` 330파일 3729건 **전건 통과**, `npm run check`(typecheck+lint+check:copy) 무오류 |
| ✅ Done | `costDetailBudgetItemCard` 실패 | 표시 규칙을 템플릿 **원문 정규식**으로 훑던 테스트가, 표시 로직을 computed로 정리하는 무해한 변경에 걸려 깨져 있었다(동작은 멀쩡했다). 규칙을 순수 함수로 꺼내 **동작으로** 검증하고, 원문 검사는 원문으로만 볼 수 있는 것(단말 여부에 따른 카드 노출·열 수)에만 남겼다 | `it_frontend` `tests/unit/utils/costDetailDisplay.test.ts`(9건 신규), `tests/unit/pages/costDetailBudgetItemCard.test.ts`(재작성) | 비목 표시 규칙 9건: 이름+상세코드 결합, 구 형식(`IOE_240-0200`) 재매칭, 상세코드 미발견 시 원값 노출, 한쪽만 있는 경우, 둘 다 없을 때 `-` |
| ✅ Done | 리팩터링 중 자체 발견 | 분리한 컴포저블이 처음에는 안에서 `useToast()`를 불렀는데, 호출부가 setup에서 상세를 `await`로 조회한 **뒤에** 이 함수를 부른다 — Nuxt가 주입 컨텍스트를 잃어 라우트가 500으로 떨어지는, 이 저장소에서 이미 한 번 겪은 함정이다. 의존성(`toast`·`t`·`fetchCostOnce`)을 `await` 이전에 확보해 인자로 넘기는 형태로 바꾸고 그 이유를 컴포저블 JSDoc에 남겼다 | 〃 | `useRelatedCostDialog.test.ts` 4건 — Nuxt 컨텍스트 없이 그대로 부를 수 있다는 사실 자체가 계약이다(성공·실패·번호 없음·대체 문자) |

**`TASK.md`의 조치 가능 항목은 소진됐다.** 남은 20건의 성격은 다음과 같다.

| 성격 | 항목 | 왜 지금 못 하나 |
| --- | --- | --- |
| 외부 의존 | BE-24, BE-58, SEC-12, MIG-12 | DBA 적용·망 설정·OnePass 규격·해외점포 제출본을 기다린다 |
| 업무·방침 판단 | SEC-14, FE-49, FE-51, FE-55, BE-36, BE-51, BE-55, BE-56, BE-63, MIG-01, MIG-30 | 선택지와 비용은 1~5차에서 실측해 각 항목에 정리했다. 고르는 일이 남았다 |
| 실환경 필요 | BE-57, FE-47, FE-48 | 피어 2대 구성, E2E 수동 로그인(`headless:false`) |
| 구현 규모 | FE-54, BE-52 | 가변 높이 행 가상 스크롤 / 다부모 조회 화면이 생긴 뒤 |

### ✅ 2026-08-22 조치 용이 잔여과제 일괄 처리 5차 (FE-47 원인 규명)

다섯 번째 배치. 남은 목록이 대부분 외부 의존·업무 판단이라 **FE-47 하나를 끝까지 팠다**.
결과적으로 두 원인 중 하나는 테스트 문제가 아니라 **제품 접근성 회귀**였다 — 4차의 감사기
오탐과 같은 패턴이다(테스트가 옳고 제품이 틀렸다).

| 상태 | 항목 | 조치 | 파일 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | FE-47 ② (제품 결함) | `ApprovalLineSelector`의 미지정 버튼 접근성 이름을 되살렸다. 이 컴포넌트는 표시 라벨(`팀장 지정`)과 aria-label(`팀장 결재자 지정`)을 **일부러 다르게** 둔다 — 화면 낭독기는 버튼 이름만 읽으므로 무엇을 지정하는지가 이름에 있어야 한다. FE-37 이관이 둘을 `assignTeamLead` 한 키로 합치면서 접근성 이름이 `팀장 결재자 지정` → `팀장 지정`으로 바뀌었다. `assignTeamLeadAria`·`assignDepartmentHeadAria`(ko·en) 키를 되살려 분리 | `it_frontend` `ApprovalLineSelector.vue`, `i18n/messages/common.ts` | 원인 확정: `git show c5bc074f`(이관 전)에서 aria-label이 `'팀장 결재자 지정'`이었음을 대조. 셀렉터 일치 실측: E2E 정규식 `/팀장 결재자( 지정\| 변경)/`이 `팀장 지정`에는 **false**, 복원값에는 true — 90초 타임아웃의 원인이 정확히 이것이다 |
| ✅ Done | FE-47 ② (회귀 방지) | `ApprovalLineSelector.test.ts` 신설 — 표시 라벨과 접근성 이름을 **각각** 고정해 다시 한 키로 합쳐지지 않게 한다 | `it_frontend` `tests/unit/components/approval/ApprovalLineSelector.test.ts` | 3건 통과. **돌연변이 검증**: aria-label을 FE-37 회귀 상태로 되돌리면 3건 중 2건이 실패한다 |
| ✅ Done | FE-47 ① (테스트 격리) | 가설대로 미mock 호출이 실제 백엔드로 새는 경로였고, 누락 엔드포인트는 `/api/cost` **하나**다 — `useInfoDashboardYear`가 연도마다 `useCost().fetchCosts`로 전산업무비 전량을 조회하는데 `mockCommonApis`에 없었다. 같은 자리에 기본 빈 목록 mock을 추가했다(`/api/projects`·`/api/ccodem/`·`/api/banners`가 쓰는 것과 같은 패턴) | `it_frontend` `tests/e2e/helpers/mockApi.ts` | 커밋본 기준으로 홈이 부르는 엔드포인트를 전수 대조: `boards/meta`·`boards/{id}/posts`·`council`·`projects`는 mock 있음, `cost`만 없음. (`/api/organizations`는 다른 작업의 미커밋 변경에서 새로 생긴 호출이라 2026-08-19 실패의 원인이 아니다) |

**E2E 재실행은 이 환경에서 못 했다**: `auth.setup.ts`가 수동 로그인(`headless:false`)을 요구한다.
그래서 FE-47을 닫지 않고 "원인 조치 후 재실행 확인"으로 남겼다(🟡 → 🟢). 위 증거는 코드·git
이력·정규식 실측이며, 실제 6건이 초록이 되는지는 실행 가능한 환경에서 확인해야 한다.

**MIG-30은 실측 후 착수하지 않았다**: 캐시를 타지 않는다는 전제는 사실로 확인했지만
(`MigrationIoeCatalogReader`가 `CodeService`를 우회해 `CodeRepository` 직접 호출), 원안대로
`FormAdapterContext`에 스냅샷을 넘기면 **생성 지점 19곳**을 고치고 어댑터 테스트의 리더 스텁을
전부 다시 써야 한다 — 인자 추가가 아니라 어댑터 계약 변경이다. 대안 둘(싱글턴 배치 캐시,
`@RequestScope` 메모 빈)도 각각 동시 업로드 경합·스코프 밖 접근으로 접었다. 근거를 `TASK.md`
MIG-30에 남겼다.

### ✅ 2026-08-22 조치 용이 잔여과제 일괄 처리 4차 (4건)

네 번째 배치. 가장 큰 성과는 **`npm run check`가 `main`에서 초록이 됐다**는 것이다 — 세 라운드
동안 "다른 작업의 미커밋 파일 탓"으로 넘겨온 `user-facing-copy-ratchet` 실패가 실은 감사기의
**오탐**이었다.

| 상태 | 항목 | 조치 | 파일 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | BE-59 | `apply`와 `restoreExpired`가 `ReentrantLock` 하나를 공유한다. `apply`는 상한 판정부터 레지스트리 등록까지, `restoreExpired`는 만료 제거부터 복원까지가 한 단위다. 로거별로 쪼개지 않은 이유는 레벨 변경이 드물고 스캔은 대부분의 틱에서 아무 일도 하지 않아 실제 경합이 없기 때문이다 | `it_backend` `LevelOverrideService.java` | `./gradlew test --tests '*LevelOverride*'` 통과. **돌연변이 검증**: `restoreExpired`의 락을 떼면 실제 호출 순서가 `["apply:WARN", "restore:INFO"]`로 뒤집혀 실패한다 — 복원의 INFO가 관리자의 WARN 뒤에 도착해 새 설정을 덮어쓰는 바로 그 결과다. 락은 인스턴스 필드이므로 테스트도 한 인스턴스에서 적용·만료를 모두 재현하도록 이동 가능한 `Clock`을 쓴다(운영은 싱글턴 빈 하나) |
| ✅ Done | FE-49(오탐) | `check-user-facing-copy`가 `t(cond ? 'a.b.c' : keyRef)`의 **카탈로그 키**를 고정 문구로 잘못 집어내고 있었다. 삼항 분기를 훑는 규칙이 번역 호출 안이라는 사실을 몰라서다. 번역 호출(`t`·`$t`·`te`·`tm`·`rt`) 안에서는 키 모양(`a.b.c`) 문자열만 건너뛰게 했다 — 키 모양이 아닌 `t('고정 문구')`는 vue-i18n이 그대로 렌더하므로 계속 잡는다 | `it_frontend` `scripts/lib/user-facing-copy-audit.mjs` | `npm run check:copy` 3/3 통과(이전에는 1건 실패). **오탐/누락 4종 대조**: `isEditing ? '편집' : doc.title` 검출 ✓, `t(cond ? 'migration.a.b' : k)` 미검출 ✓, `t(cond ? '고정 문구입니다' : k)` 검출 ✓, `doc.title \|\| '제목 없음'` 검출 ✓. `scripts-lint` 게이트도 통과(정규식 `i` 플래그 규칙 반영) |
| ✅ Done | FE-49(라벨) | `RequestFormResultTable`의 `fieldLabel` Record 18건을 `migration.bulkImport.result.fields.*` 카탈로그(ko·en)로 이관. 컴포넌트에는 라벨을 가진 field 집합만 남기고, 집합 밖 field는 원값(코드)을 그대로 보인다 | `it_frontend` `RequestFormResultTable.vue`, `i18n/messages/migration.ts` | 마이그레이션 컴포넌트 테스트 72건 통과, `npm run typecheck`·`npm run lint` 무오류 |
| ✅ Done | FE-54② | 설계 §6.2의 "위로 스크롤하면 자동으로 일시정지 상태가 된다"를 구현. 하단 복귀 시 자동 해제하되, **사용자가 도구모음에서 직접 누른 일시정지는 자동 해제 대상에서 뺐다**(`autoPaused` 구분) — 구분하지 않으면 직접 멈춰 둔 사용자가 하단으로 스크롤하는 순간 의사와 무관하게 다시 흐른다 | `it_frontend` `pages/admin/was-logs.vue`, `tests/unit/pages/wasLogsPageWiring.test.ts` | 페이지 배선 테스트 6건 → 8건(자동 일시정지·수동 일시정지 보존 2건 신규) |

**FE-49의 남은 절반은 방침 결정이다**: 감사기에 「객체 속성값의 한글 문자열」 규칙을 넣으면
`--scope app`에서 **60여 파일 397건**이 나온다(실측). 기준선이 FE-37로 빈 객체라 규칙을 켜려면
397건을 등재하거나 전부 이관해야 한다. ① 켜고 등재해 신규 유입만 차단 ② 도메인별 이관 후 켜기
③ 켜지 않기 — 세 갈래를 `TASK.md` FE-49에 정리했다(우선순위 🟡 → 🟢, 유형을 i18n → 도구로).

**FE-54는 ①만 남았다**: `WasLogTable`의 가상 스크롤이다. 펼침 행(예외 스택)의 가변 높이가
고정 `itemSize`를 전제하는 구현과 충돌하므로 그 처리를 함께 정해야 한다(우선순위 🟡 → 🟢).

**세 라운드의 오해 정정**: 1~3차에서 "다른 작업의 미커밋 파일 탓"으로 보고한 실패 3건 중
`user-facing-copy-ratchet`은 실제로는 커밋된 정상 코드(`RequestFormCommitProgressDialog.vue`의
`t(삼항)`)에 대한 감사기 오탐이었다. 나머지 둘(`max-lines-ratchet`,
`costDetailBudgetItemCard`)도 같은 파일 `app/pages/info/cost/[id].vue`에서 온다. **정정(2026-08-22, 6차)**: 그 파일은 미커밋이 아니라 **커밋된 `main`의 파일**이었다 — 즉 남은 둘도 다른 작업 탓이 아니라 `main` 자체의 결함이었고, 6차에서 해소했다.

### ✅ 2026-08-22 조치 용이 잔여과제 일괄 처리 3차 (5건)

세 번째 배치. 남은 목록이 대부분 외부 의존(`🏛️`)·업무 판단·실환경 검증이라 조치 가능한 5건을
골랐다. 테스트를 새로 만든 두 건(FE-53·BE-48)은 **돌연변이 검증**으로 실제 회귀를 잡는지
확인했다 — 통과만 하는 테스트를 늘리는 것이 두 과제의 문제제기였기 때문이다.

| 상태 | 항목 | 조치 | 파일 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | SEC-14(본체) | `buildStorageDir`가 클라이언트 `pkColNm`을 허용 문자 집합(`[0-9A-Za-z가-힣_-]{1,100}`)으로 거른 뒤, 정규화한 절대경로가 `basePath` 안인지 다운로드(`FileService.downloadFile`)와 같은 기준으로 다시 확인한다. `null`도 NPE 대신 업무 예외로 거부한다. 저장 경로 **문자열 형태는 바꾸지 않았다** — `FL_KPN_PTH`에 그대로 들어가므로 기존 행과 같은 형태를 유지해야 한다(`toAbsolutePath()`를 반환값에 쓰면 드라이브 문자가 붙어 형태가 갈린다). 거부 메시지에 클라이언트 입력을 되돌려주지 않고 WARN 로그로만 남긴다 | `it_backend` `FileUploadUnitService.java` | `./gradlew test --tests '*FileUploadUnitServiceTest'` 통과(상위 이동·경로 구분자·드라이브 지정·공백·빈 문자열·null 거부와 한글 종류 정상 저장 4건 신규). 로컬 Oracle 실측으로 부작용 없음 확인 — `TPRMPP_CFILEM`의 실제 종류는 전부 한글이고(공통게시판·배너·요구사항정의서·타당성검토표·편성요청서반입 1,328건) 허용 집합 밖 값은 NULL뿐이다 |
| ✅ Done | BE-48 | `ApprovalMailPayloadTransactionBoundaryIT` 신설. 상신 트랜잭션을 `TransactionTemplate`으로 재현하고 메일용 조회를 던지게 만든 뒤, `render()`가 null을 돌려주고 **바깥 트랜잭션이 rollback-only로 표시되지 않으며 커밋된다**를 실제 트랜잭션 매니저로 검증한다 | `it_backend` `ApprovalMailPayloadTransactionBoundaryIT.java` | `./gradlew integrationTest --tests '*ApprovalMailPayloadTransactionBoundaryIT'` 통과. **돌연변이 검증**: 로더에서 `REQUIRES_NEW`를 떼면 이 테스트가 `UnexpectedRollbackException: Transaction silently rolled back because it has been marked as rollback-only`로 실패한다(원래 구조 복원 후 재통과 확인) |
| ✅ Done | FE-53 | `tests/unit/pages/wasLogsPageWiring.test.ts` 신설. 잎 컴포넌트 테스트와 composable 테스트 사이에 비어 있던 페이지 배선 셋을 덮는다 — `onMounted` 시작/`onBeforeUnmount` 정지, 인스턴스·필터 변경 시 `resetCursor()` → `fetchOnce()` **순서**, 자동 스크롤 고정 임계값(하단 24px 미만) | `it_frontend` `tests/unit/pages/wasLogsPageWiring.test.ts` | 6건 통과. **돌연변이 검증**: 호출 순서 뒤집기·임계값 24→200·`onBeforeUnmount` 본문 제거를 동시에 주입하면 해당 4건이 실패하고, 그 돌연변이와 무관한 2건만 통과한다(페이지 원복 후 6건 재통과) |
| ✅ Done | MIG-29 | `openSourceFile`의 반환값을 버리지 않고 false면 Toast로 이유를 안내한다. 알림 책임은 화면이 지므로 페이지가 감싸고 표는 그대로 presentational로 둔다 | `it_frontend` `pages/admin/migration/requests.vue`, `i18n/messages/admin.ts` | `npm run typecheck`·`npm run lint` 무오류, `useRequestFormUpload` 37건 통과. i18n 키 ko·en 동시 추가 |
| ✅ Done | BE-53 | `docs/guides/domains/request-form-import.md` 신설(7장) — 경로·권한, 처리 흐름과 트랜잭션 경계, 진단 심각도 표(BLOCKER/WARNING)와 `FileStatus` 4종, 공통코드 조회 기준(유효일자를 보는 것과 보지 않는 것의 이유), 원본 보관·열람 권한, 금액 단위 결정 순서, 국문·영문 대조표. 가이드 인덱스에도 등재 | `it_backend` `docs/guides/domains/request-form-import.md`, `docs/guides/README.md` | 문서의 사실관계를 코드에서 대조 확인(진단 코드 심각도 enum, `FileStatus` javadoc, `RequestFormImportService`·`RequestFormFileImporter`·`RequestFormSourceFileArchiver` 트랜잭션 주석, `OrgIdentityResolver.snapshot()`·`IoeHierarchyIndex.snapshot()` 존재, `FormLexicon` 주석). 상호 링크 3건 경로 존재 확인 |

**SEC-14는 절반만 닫았다**: traversal은 해소했고, `FileTargetWriteAuthorizerRegistry`가 등록된
writer 없는 종류를 그냥 통과시키는 레거시 정책은 업무 판단이 필요해 남겼다(우선순위 🟡 → 🟢,
유형을 파일 → 정책으로 바꿨다).

**함께 관찰**: `requestFormMigrationPageBoundary.test.ts`의 한 케이스가 `npm test` 전체 실행에서만
간헐 실패한다(단독 2.6초 통과 → 전체 실행 실패 → 재실행 통과). E2E 쪽 같은 성격의 flake를 다루는
FE-48에 실측을 붙여 두었다.

### ✅ 2026-08-22 조치 용이 잔여과제 일괄 처리 2차 (8건)

같은 기준으로 두 번째 배치를 처리했다. 착수 전 재확인에서 FE-52·MIG-31은 이미 다른 작업이
해소해 둔 상태였고(코드 변경 없이 종결), 나머지 6건을 조치했다. BE-51은 이번에도 대상이
아니다 — 1차에서 `ORA-01450`으로 원안 불가가 확정돼 선택지 정리만 남아 있다.

| 상태 | 항목 | 조치 | 파일 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | SEC-15 | 반입 원본 열람 판정을 활성 행만 보도록 바꿨다. `findByApfDcmNo` → `findByApfDcmNoAndDelYn(no, "N")`으로 교체하고, 원장(`Bprojm`·`Bcostm`)도 `DEL_YN='N'`인 경우에만 주관부서를 읽는다. 권한 판정은 실패 시 거부여야 하므로 매핑·원장 어느 쪽이 논리 삭제돼도 거부한다 | `it_backend` `ApplicationMapRepository.java`, `RequestFormFileReadAuthorizer.java` | `./gradlew test --tests '*RequestFormFileReadAuthorizerTest'` 18건 통과(삭제된 매핑·삭제된 사업 원장·삭제된 전산업무비 원장 3건 신규) |
| ✅ Done | BE-61 | 다운로드를 `StreamingResponseBody`로 바꿔 항목을 만드는 즉시 흘려보낸다. `StringBuilder` → `String` → UTF-8 `byte[]`의 사본 3벌(최대 24MB×3)이 사라진다 | `it_backend` `WasLogController.java` | `./gradlew test --tests '*WasLogDownloadTest'` 5건 통과. 성공 경로는 `asyncDispatch`로 본문까지 검증하고, 피어 실패 502 경로는 동기 그대로라 감사 미기록·`text/plain` 검증이 유지된다 |
| ✅ Done | BE-62 | 런타임 레벨 변경에 상한을 세웠다 — 동시 적용 50건, **프로세스 누적 서로 다른 로거 200종**, 로거명 256자. logback이 `setLogLevel`로 만든 `Logger`를 프로세스 수명 동안 해제하지 않으므로 동시 개수만 막으면 TTL마다 새 이름으로 계속 늘릴 수 있어, 만료돼도 줄지 않는 카운터에 상한을 뒀다. 이미 건드린 로거의 재조정은 상한과 무관하게 허용한다 | `it_backend` `LevelOverrideService.java`, `LevelOverrideRegistry.java` | `./gradlew test --tests '*LevelOverride*'` 통과. "만료로 활성 슬롯이 비어도 누적 상한은 남는다"를 직접 검증하는 케이스 포함(4건 신규) |
| ✅ Done | MIG-28 | 리더에 `currencyCandidates()`를 두고 통화 후보만 유효일자 기준(`findByCIdWithValidDate`)으로 읽게 했다. 저장 경로(`resolveXcr`)와 판정 기준이 맞아 유효기간이 닫힌 통화가 선택지에 뜨는 경로가 사라진다. 환율값 파싱 가능 여부까지 거르지는 **않는다** — `resolveXcr`이 `KRW`를 조회 없이 통과시키므로 그러면 가장 흔한 통화가 선택지에서 빠진다 | `it_backend` `MigrationIoeCatalogReader.java`, `GeneralExpenseFormAdapter.java` | `./gradlew test` 관련 3개 클래스 통과. `MigrationIoeCatalogReaderTest`에 후보 조회의 유효일자 필터·`findByCIdAndDelYn` 미사용·환율 없는 KRW 잔존 3건 추가(기존 `verify(never())`가 `xcrByCurrency()` 안에서만 걸려 새 호출부를 잡지 못하던 사각지대 해소) |
| ✅ Done | FE-55(절반) | `dropped`를 폴링 응답으로 덮어쓰지 않고 래치한 뒤 사용자가 닫을 때만 지운다(`dismissDropped`). `restarted`와 같은 취급이다 — 일회성 유실이 3초 만에 사라지면 "로그를 조용히 잃지 않는다"는 원칙이 무너진다 | `it_frontend` `useWasLogFeed.ts`, `pages/admin/was-logs.vue` | `npx vitest run tests/unit/composables/useWasLogFeed.test.ts` 15건 통과(dropped 유지·dismiss 1건 신규) |
| ✅ Done | CQ-29 | severity 3중 중복 중 Realtime 두 곳을 `utils/realtimeLogs.chgTypeSeverity`로 승격하고, 라벨은 `chgTypeLabel` 하나로 통일했다(`adminLogPresentation.formatChangeType`이 위임). `RealtimeFeedTable`의 하드코딩 라벨 `생성`·`수정`·`삭제`도 함께 제거됐다. **`info` vs `warn`은 의도로 판단해 합치지 않았다** — 변경이력은 지나간 기록을 훑는 조회 화면이고 실시간 피드는 지금 일어나는 변경을 주시하는 모니터링 화면이라 수정의 강조 수준이 다르다. 판단 근거를 두 곳 주석과 테스트에 남겼다 | `it_frontend` `realtimeLogs.ts`, `adminLogPresentation.ts`, `RealtimeFeedTable.vue`, `RealtimeDetailDrawer.vue` | `npx vitest run tests/unit/utils/{realtimeLogs,adminLogPresentation}.test.ts` 25건 통과(severity 매핑 1건 신규), `npm run typecheck`·`npm run lint` 무오류 |
| ✔️ Resolved | FE-52 | 코드 변경 없음. 이관 작업이 `archiveOnly` 호출부 3곳을 갱신해 이미 해소돼 있었다 | — | `npm run typecheck` 무오류, `npm run lint` 오류 0(경고 1건은 무관한 기존 항목) |
| ✔️ Resolved | MIG-31 | 코드 변경 없음. 요구하던 회귀 테스트가 `GeneralExpenseFormAdapterTest.asksUnitWhenCurrencyStillUnresolved`로 이미 커밋돼 있었다 — 통화 미해석 행이 남으면 `UNIT_UNCERTAIN`을 생략하지 않는다는 규칙을 직접 검증한다 | — | `./gradlew test --tests '*GeneralExpenseFormAdapterTest'` 통과 |

**FE-55의 나머지 절반은 남겼다**: 다운로드 본문을 설계 §5.6이 요구한 `FILE_LOG_PATTERN`과
같게 맞추는 일이다. 그대로 재현할 수 없다는 것이 이번에 확인됐다 — 기본 패턴은 PID와
애플리케이션명을 포함하는데, 다운로드는 피어 인스턴스의 링버퍼를 위임 조회한 결과를 담을
수 있고 `WasLogEntry`에는 그 피어의 PID가 없다. 로컬 PID를 적으면 남의 로그에 이 인스턴스의
PID를 붙이는 셈이라 파서를 속인다. 선택지 3안을 `TASK.md` FE-55에 정리했다(유형을 UX →
설계로 바꿨다).

### ✅ 2026-08-22 조치 용이 잔여과제 일괄 처리 (8건)

`TASK.md`에서 범위가 좁고 자체 완결적인 8건을 골라 처리했다. 가장 무거운 건은 BE-47로,
알림 컬럼이 BYTE 시맨틱인데 `clamp`가 글자 수로 잘라 한글 알림이 `ORA-12899`로 조용히
유실될 수 있던 결함이다. BE-45·BE-54는 대상 메뉴가 겹쳐 마이그레이션 한 건으로 묶었다.

| 상태 | 항목 | 조치 | 파일 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | BE-47 | `clamp`를 글자 수 → UTF-8 바이트 기준으로 교체. `CharsetEncoder`가 출력 버퍼가 찰 때 문자 경계에서 멈추는 성질로 멀티바이트 문자를 중간에서 끊지 않는다(`EaiTextFitter` 선례와 동일 방식). TTL 100·INFM_MSG_CONE 4000·INFM_RCD_URL 300을 상수로 명시 | `it_backend` `NotificationOutboxService.java` | `./gradlew test --tests 'com.kdb.it.common.notification.*'` BUILD SUCCESSFUL. `NotificationOutboxServiceTest` 5건 → 7건(바이트 예산·문자 경계 미분할·예산 내 원본 보존 케이스 추가) |
| ✅ Done | BE-50 | `updateTranslations`의 `@RequestBody`에 `@Valid`, `UpdateRequest.translations`에 `@NotNull` 부여. 요소 단위 공백 검증은 두지 않는다 — 빈 `text`는 논리 삭제 신호라 의도된 값이다 | `it_backend` `TranslationAdminController.java` | `./gradlew test --tests 'com.kdb.it.common.i18n.*'` BUILD SUCCESSFUL (5건) |
| ✅ Done | BE-54 | `/admin/translations`·`/admin/migration`·`/admin/migration/requests`의 `TPRMPP_CMENUD` 경로 카탈로그 행을 MERGE로 시드 | `it_database` `V20260822_001__SeedAdminMenuCatalogPathsAndAuthMapping.sql` | 로컬 Flyway 적용 성공(`FLYWAY_SCHEMA_HISTORY` 20260822.001 `success=1`). 적용 후 대상 3경로 카탈로그 3행 |
| ✅ Done | BE-45 | 같은 마이그레이션에서 위 3개 메뉴에 `TPRMPP_CMENUA` ITPAD001 매핑을 `NOT EXISTS` 가드로 보강. 매핑 0건을 "전체 공개"로 보는 `MenuQueryService.isAllowed()` 판정에서 비관리자 노출을 막는다. 시드 패턴 차원의 결정은 `V20260820_005`(WAS 로그)가 이미 매핑을 함께 넣는 쪽으로 정리했다 | 〃 | 적용 후 경로별 매핑 정확히 1건씩(중복 없음) |
| ✅ Done | BE-60 | `app.was-log.buffer-capacity`를 `logback-spring.xml`의 `<springProperty>`로 배선해 링버퍼 용량의 단일 출처로 만들었다. XML 하드코딩 `2000`은 제거하고 `defaultValue`로 남겼다 | `it_backend` `logback-spring.xml`, `application.properties`, `WasLogProperties.java`, `RingBufferAppender.java` | 프로퍼티를 1234로 임시 변경하고 Spring 부팅 후 `WasLogBuffer.shared().capacity()`를 실측 → `1234`(배선 전이면 2000). 확인 후 2000으로 복원 |
| ✅ Done | MIG-27 | `CodeRepository.findByCIdAndDelYn` JPQL에 `ORDER BY c.cSqn ASC NULLS LAST, c.cdva ASC` 추가 — `CodeRepositoryImpl.findByCIdWithValidDate`와 같은 정렬이라 반입 선택 상자 후보 순서가 다른 조회 경로와 일치한다 | `it_backend` `CodeRepository.java` | `./gradlew integrationTest --tests '*UserRepositoryTemCInIt'` BUILD SUCCESSFUL — `@DataJpaTest`가 전체 리포지토리를 로드하므로 Hibernate가 새 JPQL을 부팅 시점에 파싱한다 |
| ✅ Done | FE-46 | `ColumnSpec.groupKey`를 필수로 바꾸고 `localize`의 `groupKey ? … : undefined` 삼항 제거. 실제로 모든 spec이 groupKey를 넘기고 있어 `undefined` 쪽은 진입 통로가 없는 죽은 분기였다(이 파일 branches 50% 고정의 유일한 원인) | `it_frontend` `useBudgetStatusColumns.ts` | `npm run typecheck`·`npm run lint` 통과, `npm test` 해당 스위트 통과 |
| ✅ Done | FE-50 | 소비처 0곳인 `MFA_METHOD_LABEL`·`qrImageSource`(`types/mfa.ts`)와 고아 i18n 키 `common.messages.warning`(ko·en) 삭제 | `it_frontend` `app/types/mfa.ts`, `i18n/messages/common.ts` | 전수 grep으로 정적·동적 참조 0건 확인, `npm run check` typecheck·lint 통과 |

**미처리로 남긴 것 — BE-51**: `TPRMPP_CFILEM (PK_COL_NM, PK_CONE)` 보조 인덱스는 원안대로
만들 수 없다. 로컬 Oracle 실측에서 `ORA-01450: 키의 최대 길이(6397)를 초과했습니다`가 나며,
두 컬럼이 모두 `VARCHAR2(4000 BYTE)`라 선언 키 길이 8000바이트가 8K 블록 상한을 넘는다.
컬럼 폭 축소·선행 컬럼 단독·함수기반 인덱스 세 갈래로 선택지를 정리해 `TASK.md` BE-51에
남겼다(우선순위 🟢 Low → 🟡 Medium).

### ✅ 2026-08-20 SEC-13 MFA 거래·로그인 대기 저장소를 Oracle 공유 테이블로 교체

`InMemoryMfaTransactionStore`/`InMemoryLoginPendingTransactionStore`만 있던 저장소에
`JpaMfaTransactionStore`/`JpaLoginPendingTransactionStore`를 추가해 `app.mfa.store`(기본
`jpa`)로 전환했다. `TPRMPP_CMFATM`/`TPRMPP_CMFADM` 두 테이블 모두 `BaseEntity`를 상속해
감사 컬럼을 남기며, 상태 전이는 조건부 `UPDATE`(TPRMPP_CMFATM) 또는 조건부 `DELETE`
(TPRMPP_CMFADM, 상태 컬럼 없음) 한 문장으로 원자성을 얻는다. `EnvironmentValidator`가 운영
프로파일에서 `app.mfa.store=memory`를 기동 실패로 막는다.

| 상태 | 항목 | 조치 | 저장소 커밋 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | SEC-13 | 테이블 2건, Jpa 저장소 2건, 정리 배치, 설정 토글, 운영 강제 | it_database `4732a9d`, it_backend `455ee70c` | `./gradlew test` BUILD SUCCESSFUL, `./gradlew integrationTest --tests '*Mfa*IT'` BUILD SUCCESSFUL(로컬 Oracle) |

**범위 밖으로 남긴 것**: `FidoMfaProvider`의 인스턴스 로컬 `svcTrId` 맵과 `MfaService`의 로컬
만료·취소 추적 맵은 저장소 인터페이스 밖에 있어 이번 교체로 해소되지 않는다. `TASK.md` SEC-16으로
후속 등록.

### ✅ 2026-08-20 SEC-16 FIDO 인스턴스 로컬 상태 제거

`FidoMfaProvider`의 `svcTrId` 로컬 맵(LRU 축출 포함)과 `MfaService`의 만료·취소 추적 로컬 맵
2개를 모두 제거했다. `svcTrId`는 `MfaChallengeData`·`MfaVerifyContext`의 새 필드
`providerTransactionId`로 컨텍스트를 통해 주고받고, SEC-13에서 이미 마련해둔
`TPRMPP_CMFATM.APN_CER_SVC_TR_NO`에 실제로 영속·조회한다. 만료 판정은
`MfaTransactionStore.isExpired()` 조회 메서드로 대체했다 — Jpa 구현은 DB를 근거로 다른
인스턴스에서 시작된 거래도 정확히 판별하고, InMemory 구현은 자체 보조 맵으로 단일 인스턴스
dev 용도를 그대로 지원한다.

| 상태 | 항목 | 조치 | 저장소 커밋 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | SEC-16 | svcTrId 컨텍스트 경유, 로컬 맵 2종 제거, FidoMfaProvider·OnePassClient 단순화 | it_backend `5cf27940` | `./gradlew test` BUILD SUCCESSFUL, `./gradlew integrationTest --tests '*JpaMfaTransactionStoreIT*'` BUILD SUCCESSFUL(로컬 Oracle) |

### ✅ 2026-08-19 BE-49 다국어 변경로그·관리자 메뉴 시드 마이그레이션 복원

2026-08-18 다국어 배치가 계획한 `V20260818_001__CreateClangmChangeLog.sql`(TPRMPP_CLANGL +
SQ_TPRMPP_CLANGL_1)과 `V20260818_002__SeedTranslationAdminMenu.sql`이 **미푸시 임시 클론에서만
커밋되어 유실**됐던 것을 같은 날 REVIEW가 발견(당시 versions.lock의 it_database SHA `809db9c9`가
어디에도 없는 유령이었던 것이 증거)하고, 계획 문서의 SQL 전문으로 원래 버전명 그대로 복원했다.
어느 환경의 schema history에도 `20260818.*`가 없음을 확인한 뒤였다.

| 상태 | 항목 | 조치 | 저장소 커밋 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | BE-49 | 마이그레이션 2건 + 검증 스크립트 복원, 로컬 Flyway 적용(임시 28081 기동) | it_database `c791c63` | Flyway `20260818.001/002` success=1, 검증 [1]~[5] 기대값 일치([5] 길이 불일치 0건), 메뉴 `MNU0001014`(부모 MADM0004, `pi pi-language`, en=Translations) 시드, `./gradlew integrationTest --tests '*ClangmChangeLogIt*'` BUILD SUCCESSFUL |

유실됐던 기간의 영향(정리): `ClangmChangeLogIt` 통합 테스트 차단, 번역 저장 변경로그의 무음 유실
(afterCommit 감사 경로 — 지표만 증가), 관리자 사이드바 메뉴 미노출. 복원 후 모두 해소. 단,
**복원 전에 기동된 백엔드는 메뉴 캐시에 새 메뉴가 없으므로 재기동(또는 메뉴 저장으로 캐시 무효화)
후 사이드바에 나타난다.** BE-45(시드의 권한 매핑 미포함)는 별건으로 계속 열려 있다.

### ✅ 2026-08-18 FE-37 사이트 전체 고정 문구 i18n 이관 완료 (1530건)

`node scripts/check-user-facing-copy.mjs --scope app` 실측이 **1530 → 0건**이 되었고,
감소 전용 기준선 `scripts/user-facing-copy-baselines.mjs`가 **비었습니다**. 이제 이 규칙은
"새 파일에서 고정 리터럴이 발견되면 실패"라는 순수 회귀 차단으로만 동작합니다.

| 상태 | 도메인 | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | 협의회 | `components/council` 전체(타당성검토표·질의응답·주요 Q&A·개최통보·계획협의회·결과서·일정)와 요청 화면 4개(목록·상세·개최준비·개최결과), 화면 전용 composable, 목록 카드 표시 모듈까지 503건을 새 카탈로그 `i18n/messages/council.ts`로 옮겼다. 중복은 공용 키로 접었다 — 점수 선택지(`council.scoreOptions`)는 평가의견과 자체점검이, 파일 Toast(`council.files`)는 개최통보와 결과서 첨부가 함께 쓴다. `CouncilQna`의 `kind-label` prop을 `written` 불리언으로 바꿔 호출부 3곳의 리터럴을 없앴다. 위원유형 표시는 하드코딩 삼항을 지우고 `getMemberTypeLabel`로 바꿨다(공통코드 표시명은 DB가 SoT). | it_frontend `47bdb75`·`07b1717`·`7a6ce16` | `npm run check` 통과, `npm test` 3343건 통과 |
| ✅ Done | 정보기술부문 계획 | 목록·등록·상세 세 화면, 카드 컴포넌트 5개, Excel·PDF·인쇄·목차 모듈 4개, composable 2개의 209건을 새 카탈로그 `i18n/messages/plan.ts`로 옮겼다. Excel 시트명·컬럼 헤더·행 라벨과 PDF 진행 단계 문구까지 포함한다(FE-39와 같은 결정). | it_frontend `9ab6a20` | 같음 |
| ✅ Done | 관리자 | 상세 로그 화면(로그 21종 제목·메뉴 라벨 포함)·실시간 모니터링 컴포넌트 7개·관리자 화면 14개의 397건을 `admin` 카탈로그로 옮겼다. CRUD 화면이 공유하는 표·툴바 어휘는 `admin.crud`로 접고, 재조회 안내는 `{target}`에 화면별 대상명을 끼우는 한 벌로 통일했다. `ADMIN_LOG_TABLES`는 key·tableName만 갖는 순수 데이터가 되고 제목·라벨은 카탈로그로 갔다. | it_frontend `e7e552f`·`4457f11` | 같음 |
| ✅ Done | 게시판 | 게시판 목록·게시물 목록·작성·수정·상세·댓글 트리·첨부파일 composable 86건을 새 카탈로그 `i18n/messages/board.ts`로 옮겼다. | it_frontend `8c41591` | 같음 |
| ✅ Done | 사업 가이드 | 조회·작성·삭제 화면과 첨부 composable 38건을 `info.guide`로 옮겼다. | it_frontend `5065450` | 같음 |
| ✅ Done | 사전진단·감사·기타 화면 | 사전진단 설문(선택지 코드값 분리 포함)·감사 대시보드·준비중 화면·루트 리다이렉트 43건. | it_frontend `6f58e89` | 같음 |
| ✅ Done | 데이터 일괄 반입 | 슬롯·미리보기 표·편성요청서 결과표와 화면 전용 composable 32건. | it_frontend `8c7eb2b` | 같음 |
| ✅ Done | 잔여 composable·유틸·타입 | 문서 상세·사업 상세·표 테두리·API 오류·전산업무비 헬퍼·HWPX·PDF 폰트·알림 종류·지정맥 손가락 134건. 이 커밋으로 감사 0건에 도달했다. | it_frontend `507929b` | 같음 |

**이관 중 확정한 규칙 세 가지.**

1. **순수 모듈은 `t`를 인자로 받는다.** `council-list-presentation`·`adminLogPresentation`·`realtimeLogs`·`useBoardAttachments`의 헬퍼는 Vue setup 밖이라 `useI18n()`을 부를 수 없다. 이미 `getDeptName`·`getStatusLabel`을 주입받던 방식과 같게 번역 함수를 받는다. 그 단위 테스트는 스텁 문자열이 아니라 **ko 카탈로그를 실제로 조회하는 `t`**를 넘겨, 키가 사라지면 테스트가 먼저 깨지게 했다.
2. **백엔드가 주는 한국어 표시명보다 카탈로그를 우선한다.** 상세 로그 제목이 그 예다(`useAdminLogList`). 백엔드 제목은 한국어 고정이라 영어 화면에 그대로 노출할 수 없다(CLAUDE.md §6).
3. **왕복하는 Excel 양식은 한국어로 고정한다.** 공통코드 화면은 내려받은 파일을 같은 화면이 다시 반입하므로 컬럼명·시트명을 locale에 따라 바꾸면 영어로 받은 파일을 반입 파서가 해석하지 못한다. allowlist에 근거를 남겼다.

**800줄 상한 대응.** `t()` 호출로 줄바꿈이 늘자 상한에 닿아 있던 파일 넷이 초과했다. 기준선을 올리지 않고 책임을 분리했다 — `components/plan/PlanNoteField.vue`(계획 상세의 서술 필드 5개가 같은 구조를 반복하고 있었다), `components/council/CouncilApplyDialog.vue`, `components/council/result/CouncilResultReviewSection.vue`를 새로 만들고, `useCouncilRequestPage`는 catch마다 반복하던 서버 메시지 조립을 `failureDetail`로, 성공 Toast를 `notifySuccess`로 모았다. 네 파일 모두 상한 아래로 내려왔다(792·754·790·796줄).

**사전진단 선택지의 코드값 분리(선행 판단이 필요했던 유일한 건).** 설문 선택지 문자열이 그대로
`calculateResult()`의 분기 값이라 문구만 옮기면 업무 분기가 깨졌다. 선택지를 `value`(코드값)와
표시명(카탈로그)으로 나눴다 — CLAUDE.md §6의 "업무 분기와 저장에는 번역된 명칭이 아니라 코드값만"
규칙 그대로다. 문자열 포함 검사(`serviceTypes.some(t => t.includes('신규'))`)는 `NEW_SERVICE_TYPES`
집합 비교로 바꿨다. 이 과정에서 **도달할 수 없던 가지 하나를 지웠다** — 정보보호팀 조건의
`workTypes.includes('정보보호')`는 업무 유형 선택지에 정보보호가 없어 항상 거짓이었다(주석에 복구
조건을 남겼다).

**allowlist에 남긴 것과 그 근거.** 번역 대상이 아닌 리터럴만 넣었다 — ① 로직이 값 자체를 비교하는
상수(`utils/common.ts`의 전결권 기준, `utils/projectTimeline.ts`의 단계명; 표시는 각각
`common.approvalBasis.*`와 같은 항목의 `labelKey`가 담당), ② 언어와 무관한 기호·단위·코드
(테두리 기호 `─ ╌ ⋯ ═`, CSS 단위 `1px~5px`, 통화 코드 `KRW`, 단계 배지 숫자, 정보 배지 `i`),
③ 공통코드 값(`MAIN_CODE_TYPE`), ④ 같은 화면이 왕복하는 한국어 Excel 양식(공통코드),
⑤ 실데이터 연동 전 자리표시자 숫자(감사 대시보드).

용어집([`it_frontend/docs/guides/i18n/glossary.md`](it_frontend/docs/guides/i18n/glossary.md))에 협의회 도메인 21개 용어를 추가했다.

### ✅ 2026-08-17 업무 판단 반영 배치 6 — 2차 (4건)

| 상태 | ID | 결정 | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- | --- |
| ✅ Done | FE-39 | B(locale별 전환) | 시트명 4건(`사업목록`·`단말기상세목록`·`전산업무비`·`결재상신목록`)과 헤더 9건+시트명을 카탈로그로 옮겼다. 파일명도 같은 값을 쓰므로 함께 따라간다. `useBudgetWorkExcel`은 i18n을 쓰지 않던 composable이라 setup 시점에 `t`를 받아 둔다. allowlist 27 → 14건. **기준선 조정은 필요 없었다** — 억제되던 건들이라 애초에 기준선에 세어지지 않았고, 리터럴이 사라져 실측 0건이다. 부수: `budgetWorkOrdinaryTag` 테스트가 헤더 리터럴을 소스 문자열로 고정하고 있어 키 기준으로 바꿨다(컬럼 key는 행 데이터와 짝이라 유지). | it_frontend `0455995` | `npm run check`·`check:copy` 통과, `npm test` 3338건 통과 |
| ✅ Done | MIG-26 | B(기존값을 초기값으로) | 비목별 편성 결과(`summaryData.data`)의 `capital`·`dupRt`로 기존 편성률을 읽어 초기값으로 쓴다. 기본값 계산은 **기존값이 없을 때만** — 순서가 뒤집히면 화면을 열었다 저장하는 것만으로 덮인다. 편성률은 비목 단위 저장이고 이 화면 입력은 행별 자본·일반관리비 2버킷이라 1:1이 아니므로, **계열 안에서 값이 하나로 일치할 때만** 대표값으로 삼고 엇갈리면 기본값 계산으로 떨어뜨려 사용자가 명시적으로 일괄 적용하게 한다. 선언 순서도 바꿨다 — `summaryFetch`·`existingRates`가 `calculateDefaultRates`보다 앞에 와야 `immediate` watch가 setup 중 TDZ로 죽지 않는다. | it_frontend `d59bed5` | `npm run check`(typecheck 0) 통과, `npm test` 3342건 통과. "기존값 우선" 순서를 `budgetWorkExistingRates` 테스트로 고정 |
| ✅ Done | MIG-03 | B + 필수 아님(WARNING) | 새 진단 코드 `USER_DEFAULTED`(WARNING)로 "시트에 담당자 열이 없어 업로드 사용자로 채운다"를 알리고, 미리보기에서 부점 담당자를 골라 덮을 수 있게 했다. **경고는 부점 그룹마다 한 번**만 낸다 — 담당자는 그룹 단위 값이라 행마다 내면 10행짜리 부점에 같은 경고가 10번 붙는다. 후보는 그 부점 소속 사용자(`Index.userCandidatesOfOrg`)이며 후보가 비면 화면에 드롭다운이 그려지지 않는다. 보정값은 실재 사번인지 검증하고(없으면 BLOCKER, 후보는 유지) 미보정은 종전대로 업로더로 채운다. 카탈로그(MIG-10)를 일반화해 담당자 컬럼을 선언하되 **후보는 비운다** — 선택지가 행마다 달라 행별 진단이 싣는다. 그에 맞춰 카탈로그 컬럼의 드롭다운에 후보 유무 조건을 붙였다. | it_backend `6f5ed822`, it_frontend `c851e1f` | `migration.*` 전체 통과(부점당 1건 경고·후보 구성·보정 시 경고 소멸·없는 사번 BLOCKER). `codegen` 재생성 결과 차이는 `USER_DEFAULTED` 추가 한 줄. `npm test` 3343건 통과 |
| ✅ Done | MIG-25 후속 | (재발 관측 대응) | 배치 4의 워커 상한 뒤에도 전체 실행 한 번에서 두 파일이 **22.4초·23.2초** 스파이크로 전역 `testTimeout`(20초)을 넘겨 타임아웃했다. 상한이 평균은 크게 낮췄지만 꼬리는 남았다. 타임아웃 한 번이 모듈 전역 Mock 오염으로 여러 실패로 번지므로, **그 두 파일에만** `vi.setConfig`로 60초를 준다 — 전역값을 올리면 실제 무한 대기 검출이 늦어진다. 이 값이 모자라기 시작하면 타임아웃을 더 올리는 대신 페이지 마운트를 쪼개 테스트를 가볍게 만드는 쪽을 먼저 검토한다는 판단 근거를 주석에 남겼다. | it_frontend `ce3f1c2` | 조치 후 전체 3338건 통과, 두 파일 4.6초·4.8초 |

**MIG-01은 완료하지 못했다** — 업무 매핑(품의 `71`, 계약 체결 전 `75`, 체결 완료 `79`)은 확정됐지만 **기록 위치**가 결정되지 않았다. 실측한 `BPROJA` 관례상 `PRJ-` 행이 상태 `01`, `PLN-` 행이 `11`을 쓰고 있어, 사업진행을 어느 행에 쓰든 `ProjectQueryAssembler`의 대표상태 산출이 바뀌어 여러 화면의 사업 상태 표시가 달라진다. 도달할 수 없는 매핑 상수를 미리 넣지 않는다는 원칙(`columns.ts` 선례)에 따라 코드를 추가하지 않고 `TASK.md` 항목을 결정 내용·실측 근거·남은 질문으로 갱신했다. 종전 항목이 후보로 적었던 `BPROJM.IT_PTL_RPR_STS_TC`는 조회 결과 **보고 대상 직급**이라 후보가 아니라는 점도 정정했다.

### ✅ 2026-08-17 업무 판단 반영 배치 6 — 1차 (5건)

> 업무·UX 판단이 필요해 멈춰 있던 항목들에 결정이 내려와 처리했다. 결정 내용을 그대로 적어 두어 나중에 "왜 이 값인가"를 다시 묻지 않게 한다.

| 상태 | ID | 결정 | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- | --- |
| ✅ Done | MIG-16 | DDL 적용 승인 | `/admin/migration` 메뉴명을 `데이터 일괄 반입` → `편성률 반영`으로 갱신하는 Flyway 스크립트를 추가했다. **영문 번역행(`TPRMPP_CLANGM`)도 함께 갱신한다** — 조회해 보니 `Bulk Data Import` 행이 있어 한쪽만 바꾸면 영어 화면이 옛 이름을 유지한다. `MNU_ID`는 환경별로 다를 수 있어 화면경로로 식별하고 멱등하게 작성했다. `/admin/migration/requests`(`편성요청서 반입`)는 이미 올바라 손대지 않았다. | it_database `7d909ef` | 로컬 Flyway 적용(`v20260817.001`) 후 `CMENUM='편성률 반영'`·`CLANGM(en)='Apply Allocation Rates'` 재조회 확인 |
| ✅ Done | MIG-14 | 비율 상한 **100배** | 폴백 경로에 `총 사업금액(전체기간) ÷ (26년 합계 + 26년 이후)` 상한을 걸어 초과 시 미적재+경고로 돌린다. 조건 ⑥이 두 해석이 **둘 다 성립할 때**만 막았기 때문에 남아 있던 구멍(원 단위 해석의 지급금액이 음수인 경우)을 닫는다. 검사 순서는 컬럼 용량 검사(조건 ⑤) **뒤**에 뒀다 — 저장 가능 여부는 하드 제약이고 비율은 업무 타당성 판정이라, 둘 다 걸리는 파일에서는 저장 제약 문구가 원인에 더 가깝다. **결정값 해석**: 지시는 "100%"였으나 문자 그대로 1.0배면 기지급액이 있는 모든 다년도 사업이 걸리므로 **100배**로 읽었다(정상 실측 한~두 자릿수, 단위 혼재 5자릿수 이상). | it_backend `837363d8` | 비율 초과 미적재·100배 이내 정상 적재를 각각 고정. 기존 조건 ①~⑥ 테스트 유지 |
| ✅ Done | FE-43 | A(현행 유지) | 문서 상세(`[id]`)는 마지막 세그먼트인 **문서번호**를 그대로 둔다 — 식별자라 번역 대상이 아니고 여러 문서를 열었을 때 탭을 구분해 준다. 검토 화면(`[id]/review`)만 라우트 단어 `review`가 노출되므로 `info.documents.tabs.review` 키를 줬다. | it_frontend `d66ce26` | `check:copy` 통과(리터럴 추가 없음), i18n·useTabs 테스트 43건 통과 |
| ☑️ Accepted | MIG-17 | 조정 계획 없음 | 위임예산에 하반기 조정을 걸 계획이 없다는 확인을 받아 **현재 가정(편성률 100% 고정)을 그대로 유지**한다. 시트에 조정률 열이 생기면 재검토 대상이므로 이 판단 근거를 남긴다. | (조치 없음) | 코드 변경 없음 |
| ✅ Done | REPO-01 | 개발자 3명 이상 | 머신 종속 값(`java.jdt.ls.vmargs`의 lombok javaagent 절대경로, `java.import.gradle.home`)을 워크스페이스 설정에서 제거했다. **`settings.local.json`은 쓰지 않았다** — VS Code에는 그런 병합 기능이 없어 조용히 무시되고, 워크스페이스 설정이 사용자 설정을 덮으므로 두 값은 **각자의 사용자 설정**에 두는 것이 유일하게 동작하는 방식이다. 주석이 담고 있던 함정 설명(중복 빈 등록·워크트리 프로젝트명 중복·Gradle 배포판 재설치 실패)은 루트 `README.md`의 「IDE 설정(VS Code)」로 옮기고 복사용 설정 값도 함께 실었다. | (루트 커밋 — 아래 참조) | JSONC 파싱 확인, 남은 설정에 절대경로 0건 |

### ✅ 2026-08-17 DDL 불필요 잔여과제 배치 5 (3건)

> 배치 4가 "다음 배치 후보"로 남긴 두 건(FE-40·MIG-22, MIG-24)을 이어서 처리했다. 둘 다 업무 판단이 걸리지 않은 항목이었다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | FE-40 | 탭 제목이 i18n 키를 받는다. `definePageMeta`는 컴파일 타임 매크로라 인자에 `t()`를 쓸 수 없으므로, **페이지는 키만 선언하고 번역은 탭을 만드는 시점에** 한다 — `meta.tabTitleKey`를 최우선 순위로 두고 `addTab(route, menuTitle, translate)`가 번역한다. 번역기를 받지 못했거나 결과가 공백이면 키 문자열을 노출하지 않고 리터럴·메뉴명 경로로 떨어진다(화면에 `migration.tabs.x`가 보이는 것이 더 나쁘다). 탭에 `titleKey`를 함께 보관하고 `retranslateTabs`를 추가해 **locale 전환 시 이미 열려 있던 탭까지** 다시 번역한다 — `setAppLocale`은 라우트 이동·새로고침을 하지 않으므로 이 갱신이 없으면 옛 언어 제목이 남는다. 동일 경로 구분용 ` (id)` 접미사는 보존한다. **항목이 미확인으로 남긴 질문에 실측으로 답했다**: 로컬 `TPRMPP_CMENUM` 조회 결과 `/info/documents`·`/info/documents/form`·`/info/documents/list`(+status 쿼리 3건)는 **메뉴 엔트리가 맞다**. 메뉴에 없는 것은 동적 라우트 둘(`[id]`, `[id]/review`)이며 문서마다 경로가 달라 원리상 메뉴 엔트리가 될 수 없다 → UX 판단이 필요해 FE-43으로 등록. | it_frontend `c65f357` | `npm run check` 통과, `npm test` **3338건** 통과(신규 7건 — 키 우선순위·번역기 누락·공백 폴백, `retranslateTabs` 3갈래, AppHeader의 locale watch) |
| ✅ Done | MIG-22 | `admin/migration` 두 화면의 한국어 리터럴 `tabTitle`을 `migration.tabs.*` 키로 옮겼다(고정 문구 기준선 3 → 2, 15 → 14). FE-40이 도입한 경로의 첫 소비처다. | it_frontend `c65f357` | 위와 같음 |
| ✅ Done | MIG-24 | `@decision-clear`·`@decision-clear-all` 페이지 배선 두 줄을 E2E로 덮었다. 기존 편성률 반영 시나리오에 결정을 넣은 뒤 행 단위·시트 전체로 지우는 단계를 추가해 드롭다운과 BLOCKER 배너가 되살아나는지 확인한다. 결정은 일괄 지정 버튼으로 넣는다 — PrimeVue Select 오버레이에서 옵션을 고르는 것보다 안정적이고, 배선 확인에는 결정이 들어간 상태이기만 하면 충분하다. 확정 반영은 하지 않아 원장에 쓰지 않는다. | it_frontend `de5c119` | **배선 두 줄을 일부러 지워 `:103`에서 실패하는 것을 확인한 뒤 원복**해 3건 통과(백엔드 기동 + Playwright 프론트 3002, 26.9초) |

**남긴 관찰 (신규 등록)**: FE-43 — 동적 문서 라우트(`[id]`, `[id]/review`)의 탭 제목. 상세는 지금 문서번호가 제목이 되는데 식별자라 번역 대상이 아니면서 탭 구분에도 쓰이고, 검토 화면은 영어 라우트 단어 `review`가 노출된다. 라벨만 쓸지·라벨+문서번호로 조합할지가 UX 판단이라 등록만 했다.

### ✅ 2026-08-17 DDL 불필요 잔여과제 배치 4 (4건)

> 남은 DDL 불필요 과제 중 **업무 판단이 선행되지 않는 것**만 골랐다. 잔여 16건을 분류한 결과 절반 이상이 스스로 해소할 수 없는 항목이었다(아래 「손대지 않은 이유」). MIG-10은 API 계약 변경이 필요해 앞 배치들이 미뤄 둔 항목이고, FE-41은 이번 작업 중에 실제로 발목을 잡아 함께 닫았다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | MIG-25 | **원인이 TASK 항목의 가설과 달랐다** — 항목은 두 테스트가 공유하는 타이머·전역 상태 경합을 의심했지만, 실측 결과 **코드 경합이 아니라 부하 민감성**이었다. 항목이 지목한 두 파일이 실제로 스위트에서 가장 무거운 두 파일이고, 각 파일 안에서 한 테스트가 소요를 지배한다: `refresh-banner-visibility`의 첨부 목록(격리 1.87초 → 기본 병렬 6.69초 → 다른 작업이 겹치면 **15.34초**), `onactivated-refresh-guard`의 사업 상세(1.94 → 8.42 → **15.78초**). `testTimeout`이 20초이므로 여유가 1.3배까지 좁아지고, 하나가 타임아웃되면 살아남은 컴포넌트가 모듈 전역 Mock을 오염시켜 뒤따르는 2건이 연쇄 실패해 관측된 **3건**이 된다(이 연쇄는 `vitest.config.ts` 기존 주석이 이미 적어 둔 메커니즘이다). 진짜 원인은 **초과 구독**이었다 — 기본값은 코어 수만큼 fork를 띄우는데 각 fork가 happy-dom 환경을 따로 세워 `environment` 합계가 822초까지 부푼다. 워커 상한을 코어 절반(최소 2)으로 두면 **더 빨라지면서** 무거운 테스트가 절반으로 줄어 절충이 아니다. | it_frontend `9bd3519` | 12코어·다른 작업 없이 실측: 기본(12) 113.1초·무거운 테스트 6.69초·environment 822.7초 → 상한 6 **101.8초·3.17초·352.2초**. 설정 적용 후 전체 3326건 통과(103.0초), 무거운 테스트 2.93초로 20초 대비 여유 6배. 조치 전 5회 연속 전체 실행은 모두 통과해(재현률이 낮아) **실패 재현이 아니라 여유 폭 측정**으로 판정했다 |
| ✅ Done | MIG-10 | 자본예산 품목 비목을 미리보기에서 고를 수 있게 했다. 보정 키(`devAmountIoeC`·`hwAmountIoeC`·`swAmountIoeC`)는 어댑터가 이미 읽고 검증기가 이미 검사하고 있었으므로 **빠진 것은 선택지를 내려보내는 일뿐**이었다. dry-run 응답에 `catalogs`(진단과 무관한 (시트, 컬럼, 선택지) 묶음)를 추가하고, 미리보기가 그 컬럼을 데이터 컬럼 뒤에 보정 전용 컬럼으로 그린다. **어떤 컬럼을 그릴지도 응답이 정한다** — 자본예산 시트를 올리지 않았으면 카탈로그가 비어 컬럼 자체가 나타나지 않는다(쓸 수 없는 컬럼을 그리면 항상 빈 드롭다운이 된다). `candidatesOf`는 카탈로그를 먼저 깔고 진단 후보를 덧붙여, 없는 코드를 골라 BLOCKER가 붙은 상태에서도 선택지가 남아 되돌릴 수 있다. 보정 컬럼 목록은 `MigrationColumns.CAPITAL_IOE_OVERRIDES`로 모아 검증기와 카탈로그가 같은 목록을 보게 했고, 엑셀 열이 아니므로 정규 컬럼 계약(`of()`, MIG-02가 프론트와 자동 대조)에는 넣지 않았다. | it_backend `1e9329d2`, it_frontend `c4fa26e` | `./gradlew test --tests '*Migration*'` 통과(카탈로그가 자본 계열만 담는지·자본 시트가 없으면 비는지·컨트롤러가 직렬화하는지·OpenAPI 필수 계약). `npm run codegen` 재생성 후 `codegen:check` 드리프트 없음, `npm run check` 통과, `npm test` **3331건** 통과(신규 5건) |
| ✅ Done | FE-41 | 감사기 억제의 판정 기준을 `(경로, 줄, 종류, 값)` → `(경로, 종류, 값)`으로 좁혔다. **이번 MIG-10 작업이 바로 그 함정을 밟았다** — `useMigrationPreview.ts`에 상태 하나를 추가했더니 아래로 밀려난 `__decision`(코드 식별자)이 되살아나 무관한 감사 실패가 났다. 억제 범위는 넓어지지 않는다: 여전히 그 파일의 그 값 하나만 억제하고, 값이 달라지면 자동으로 다시 잡힌다. TASK 항목이 검토 대상으로 적어 둔 "휴리스틱을 ASCII 전용으로 좁히는" 방안은 **택하지 않았다** — 항목이 지적한 대로 영문 표시 문구를 놓치며, 위치 의존만 없애면 재발 원인이 사라지므로 탐지력을 깎을 이유가 없다. | it_frontend `3454955` | 값·종류가 다른 항목은 억제하지 않는다는 단정을 유지하고 "같은 값이 다른 줄로 이동해도 억제가 유지된다"를 새로 고정. `npm run check:copy` 통과 |
| ✔️ Resolved | FE-42 | 항목의 전제가 이미 낡아 있었다 — "기준선 파일이 미커밋 FE-37 브랜치의 신규 파일이라 조정이 워킹트리에만 있다"고 적었지만, `scripts/user-facing-copy-baselines.mjs`는 FE-38 커밋(`2f55333`)에 포함돼 추적 중이고 분할 규약 주석과 두 값(`common.ts: 2`, `projectTimeline.ts: 10`)이 모두 들어 있다. 조치할 것이 없어 종결한다. | (조치 없음) | `git ls-files scripts`로 추적 확인, `npm run check:copy` 통과(기준선 실제 건수 일치) |

**손대지 않은 잔여 DDL 불필요 과제와 이유** — 스스로 결정할 수 없는 것을 임의로 정하지 않았다.

- **업무 판단 선행**: FE-39(Excel 시트명·헤더를 locale별로 바꿀지 원장 대조용으로 한글 고정할지), MIG-01(`IT_PTL_STS_TC`·`IT_PTL_RPR_STS_TC` 유효 코드셋 확정), MIG-26(기존 편성률을 초기값으로 쓸지 덮어쓰기 경고를 낼지), MIG-14(정상 다년도 사업의 비율 상한값), MIG-17(위임예산 조정률 도입 여부), MIG-03(부점별 담당자 입력을 미리보기에 둘지)
- **외부 입력 대기**: SEC-12(연동 규격에 사용자 거부 `trStatus` 값 없음), MIG-12(해외점포 제출본 유입 후 어휘 수집), BE-24(DBA의 dev/prod 적용 — DDL이기도 하다)
- **설계 범위 제외**: SEC-13(MFA 다중 인스턴스 — 설계 §8이 이번 범위에서 제외, 공유 캐시 도입 결정 선행)
- **DDL 필요**: MIG-16(메뉴명 갱신 스크립트)
- **규모·조건 미충족**: FE-37(사이트 전체 i18n 이관 1553건 — 화면 단위 완결 원칙상 다회차 작업), BE-36(`totRqmAmt` 소비처 10곳 이상 전수 조사), REPO-01(`.vscode` 머신 종속 경로 — 항목이 "개발자가 늘어나면" 조건을 달아 둠)
- **남은 저비용 후보**: FE-40·MIG-22(탭 제목 i18n — `definePageMeta` 매크로 제약을 우회할 `tabTitleKey` 도입), MIG-24(`@decision-clear` 페이지 배선 E2E — 두 서버 기동 필요). 둘 다 판단 선행이 없어 다음 배치에서 처리 가능하다 → **배치 5에서 처리 완료**.

### ✅ 2026-08-17 DDL 불필요 잔여과제 배치 3 — 품질 게이트 복구 (4건)

> 앞 두 배치가 "기준에 맞지 않아 남긴다"고 적어 둔 **BE-37(커버리지 게이트 실패)** 을 정면으로 처리했다. 병합 전 품질 게이트가 무력화된 채 `./gradlew test`로 대체 운용하던 상태를 끝내는 것이 목표였고, 결과적으로 `./gradlew check`가 **다시 green**이다. 운영 코드는 한 줄도 바꾸지 않았다 — 전부 테스트·픽스처 추가다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | BE-37 / MIG-18 | 커버리지 게이트 위반 **7클래스**를 해소해 `./gradlew check`를 복구했다(두 항목은 같은 위반을 각자 기록한 것이라 함께 닫는다). ① `TranslationTargetKey`·`TranslationAdminController`·`TranslationCatalogService` — 미검증 분기(구성요소 공백 판정, 대상 문자열 파싱, 신규행 저장·논리삭제·대상키 이동·2000자 상한)를 채웠다. ② `CodeService` — **`@InjectMocks`에 `TranslationCatalogService` mock이 아예 없어** 언어별 조회(`localize`) 4메서드가 통째로 미검증이었다. mock을 추가하고 KO 경로(번역 저장소 미호출)·EN 경로(필드 단위 fallback)를 고정했다. ③ `IoeCandidates` — 유틸 생성자 차단. ④ `GeneralExpenseFormAdapter` — 비목 해석의 미검증 갈래 세 개(중분류 기본값 → 대안 후보와 함께 경고, 중분류로도 못 좁힘 → 후보 실은 중의적 진단, 카탈로그가 비어 후보가 없음 → 미해석)와 JPY 천엔 전개·헤더만 있는 시트를 픽스처로 덮었다. ⑤ `FormCheckboxReader`(lines **0.04 → 0.98**) — 아래 별항. | it_backend `09f7fa26` | `./gradlew check` **BUILD SUCCESSFUL**. 단위 3464건 통과·실패 0·스킵 1(403파일). 7클래스 실측 비율: `CodeService`·`IoeCandidates`·`TranslationTargetKey`·`TranslationCatalogService`·`TranslationAdminController` 1.00, `GeneralExpenseFormAdapter` LINE 1.00·BRANCH 0.96·COMPLEXITY 0.95, `FormCheckboxReader` LINE 0.98·BRANCH 0.83·COMPLEXITY 0.74 |
| ✅ Done | (BE-37 별항) | **"POI로 만들 수 없어 사실상 미검증"이라던 `FormCheckboxReader`를 저수준 픽스처로 열었다**(`FormCheckboxFixtures`). 종전 판단은 "POI에 양식 컨트롤 생성 API가 없다"였고 그건 사실이지만, 생성 API 없이도 두 형식 모두 만들 수 있다. `.xls`는 Escher 도형 컨테이너와 `ObjRecord`를 직접 만들어 `EscherAggregate.associateShapeToObjRecord`로 시트에 등록하고, POI가 해석하지 않는 `FtCblsData`(sid `0x12`) 체크 상태는 `SubRecord.createSubRecord`에 실측 바이트(`12 00 08 00 01 00 …`)를 먹여 넣는다. `.xlsx`는 OPC 패키지를 파트 단위로 조립한다 — 시트 XML의 `control`(실 제출본처럼 `mc:AlternateContent`로 감싼 형태), `ctrlProps` 파트의 `checked`, VML 그림 파트의 문구, 그리고 셋을 잇는 `.rels`. 걸러져야 하는 갈래도 함께 담았다: 콤보 컨트롤, 앵커 없는 도형, 관계가 끊긴/빈 컨트롤, XML이 깨진 `ctrlProps`, 문구 도형이 없는 컨트롤, 행 번호가 숫자가 아닌 앵커. | it_backend `09f7fa26` | 신규 `FormCheckboxReaderTest` 6건 통과. 체크·해제·`FtCblsData` 누락(→해제)·콤보 제외를 두 형식에서 각각 단정하고, 읽기 실패가 배치를 무너뜨리지 않고 빈 목록으로 접히는지도 고정 |
| ✅ Done | MIG-13 | `./gradlew integrationTest` 잔여 실패 1건을 해소했다. **원인은 TASK 항목의 추정과 달랐다** — 항목은 "프로젝션 단정이 로컬 Oracle 실제 데이터를 읽으므로 데이터 전제 문제인지 계약 위반인지 가려야 한다"고 적었지만, 실패한 `:224` 단정은 DB를 전혀 읽지 않는 **리플렉션 계약 단정**이었다. 두 겹의 원인이 겹쳐 있었다. ① `AdminUserView`에 `default getBbrNm()`이 추가되면서(`cd45bdf2`) 승인 필드 목록이 낡았다 — `AdminService`가 실제로 소비하는 필드이므로 목록에 추가하는 것이 맞다. ② 더 중요하게, JaCoCo 에이전트가 **본문 있는 메서드를 가진 인터페이스**에 합성 `$jacocoInit`을 넣어 `getDeclaredMethods()`에 섞여 들어왔다. 그래서 `integrationTest`(커버리지 켜짐)에서만 깨지고 격리 실행에서는 통과하는 모습이었다. 합성 메서드를 걸러내는 `declaredMethodNames` 헬퍼를 도입해 두 원인을 함께 닫았다. | it_backend `375ce33b` | `./gradlew integrationTest` **154건 실패 0**(종전 1실패). 스킵 4건은 `BoardReplySequenceMigrationIT` 한 클래스로 이 배치와 무관하다. 해당 클래스 단독 실행도 통과 |

| ✅ Done | BE-40 | MIG-13에서 등록한 합성 메서드 함정을 전수 제거했다. 걸러내는 책임을 공용 테스트 지원 `ProjectionContracts.declaredMethodNames`로 올리고, 계약 단정 **19곳(13파일)** 을 그것으로 바꿨다 — `.hasSize(n)`으로 세던 형태와 이름 목록을 대조하던 형태 모두 포함한다. **남긴 3곳은 취약하지 않아 남겼다**: `AdminCodeServiceCacheEvictTest`·`MfaGuardAspectTest`는 이름으로 메서드 하나를 찾아 애노테이션을 읽는 용도라 `Method` 객체가 필요하고(개수를 세지 않는다), `GuideDocServiceTest`는 특정 이름의 **부재**를 확인하므로 합성 메서드가 섞여도 결과가 바뀌지 않는다 — 다만 이름 단정 형태였으므로 원시 패턴 예시를 남기지 않으려 헬퍼로 옮겼다. 결과적으로 선언 메서드를 이름으로 다루는 리플렉션은 이제 헬퍼 한 곳에만 있다. 필터가 조용히 무력화되는 것을 막으려고 `ProjectionContractsTest`를 함께 두었다 — 좁힌 반환형 구현의 bridge 메서드(전제 단정으로 실제 생성 여부까지 확인)와 `default` 메서드를 가진 인터페이스의 `$jacocoInit`을 둘 다 재현한다. | it_backend `62505df9` | `./gradlew check` **BUILD SUCCESSFUL**, 단위 **3467건 실패 0**(신규 3건). `./gradlew integrationTest` **154건 실패 0**. 변환 전후 단정의 기대값(개수·이름 집합)은 그대로 두었으므로 통과가 곧 동등성의 증거다 |

**남긴 관찰**: 없음.

### ✅ 2026-08-17 DDL 불필요 잔여과제 배치 2 (5건)

> 앞 배치와 같은 기준(DDL 변경 불필요 + 업무 판단 선행 없음)으로 골랐다. 세 건은 **재발 구조를 닫는 게이트 추가**가 핵심이라 조치와 함께 자동 검증을 남겼다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | BE-35 | `ProjectService`의 품목 CUD 블록을 `ProjectItemSynchronizer`로 분리했다(741 → **550줄**, 800줄 상한까지 250줄 확보). 등록 경로의 품목 저장 루프, 수정 경로의 CUD 병합, `buildBitemm`·`toItdYm`·`clampMpl`이 함께 옮겨 갔고 채번→환율 표준 조회→외화 재계산→저장 순서는 그대로 보존했다. **Spring 빈으로 만들지 않고 `ProjectService`가 호출 시점에 직접 생성한다** — 빈으로 주입하면 `@InjectMocks`가 mock으로 대체해 품목 동기화 검증이 조용히 무력화되기 때문이다(같은 이유로 `ProjectItemChangeDetector`·`ProjectResponseMapper`도 정적 협력자다). TASK 항목이 경고한 `applyAmountSnapshot`·`sumActiveItems` 경로는 `ProjectService`에 그대로 남겨 `ProjectServiceTest`의 dfrAmt 검증 7건이 실제 코드를 계속 탄다. | it_backend `f119b7c3` | `./gradlew test` **3426건 통과·실패 0·스킵 1**. 테스트 코드는 한 줄도 고치지 않았다 — 기존 품목 동기화 단정이 그대로 통과하는 것이 behavior-preserving의 증거다 |
| ✅ Done | BE-38 | 진단 코드를 `MigrationDiagnosticCode` enum(20개)으로 모으고 `MigrationDiagnostics.blocker`·`warning`이 그 타입만 받도록 좁혔다. 호출부 27곳의 문자열 리터럴을 상수로 바꿨으므로 **목록에 없는 코드는 컴파일되지 않는다**. 여기에 `MigrationDiagnosticCodeContractTest`가 enum 집합과 `MigrationDto.CellDiagnostic.code`의 `allowableValues`가 정확히 같은지 리플렉션으로 대조한다(어느 한쪽만 늘어도 실패). MIG-23에서 `CREATE_NOT_SUPPORTED`가 발행되면서도 목록에서 빠졌던 드리프트가 이 두 겹으로 닫힌다. | it_backend `deca8691` | 대조 테스트가 현재 20 = 20으로 통과. `migration.*` 전체 통과 |
| ✅ Done | BE-39 | `TranslationAdminController`의 `@PathVariable(name = "target")`·`@RequestParam(name = "targetKey")`를 명시했다. 재발 방지로 `RequestParameterNamingTest`를 추가해 `src/main/java` 전수에서 이름 없는 `@RequestParam`·`@PathVariable`·`@RequestHeader`를 잡는다(축약형 `("eno")`와 `name =`·`value =` 모두 허용). | it_backend `46806b74` | 전수 스캔 위반 **0건**. 빌드가 `-parameters`를 이미 주므로 스펙 값은 종전과 같고, 커밋된 `api.d.ts`의 `targetKey`와 일치해 프론트 영향 없음 |
| ✅ Done | REPO-02 | `CLAUDE.md` §2 트리에 실제 추적 중인 루트 구성을 채웠다 — `meta/`·`prds/`·`FP/`·`tools/`·`scripts/`·`sample/`·`.vscode/`·`versions.lock`에 역할을 한 줄씩 달고, 세 하위 저장소에는 `[별도 원격 저장소]` 표시를 붙였다. `REVIEW.md`·`TEST.md`가 반복 워크플로우 지시문이고 `AGENTS.md`가 포인터라는 점도 트리 아래 한 문장으로 남겼다. | (루트 문서 커밋) | `git ls-files` 루트 집계와 트리 항목 대조 |
| ✅ Done | REPO-03 | `.gitignore`의 사멸 규칙 `everything-claude-code/`·`.bkit`을 제거했다. | (루트 문서 커밋) | 제거 후 `git status --porcelain`이 편집한 두 파일만 보고 — 새로 노출되는 파일이 없어 두 규칙이 실제로 죽어 있었음을 확인 |

**남긴 관찰**: 없음. BE-36(`totRqmAmt` 이름 불일치, 소비처 10곳 이상 전수 조사 필요)·BE-37(커버리지 게이트 기존 위반 9건)은 이 배치의 기준(저비용·판단 불요)에 맞지 않아 `TASK.md`에 남겼다. BE-37은 같은 날 배치 3에서 처리했다(실측 위반은 7클래스였다).

### ✅ 2026-08-17 DDL 불필요 잔여과제 배치 (9건)

> DDL 변경이 필요 없고 업무 판단이 선행되지 않는 과제를 골라 TDD로 처리했다. 각 과제는 개별 커밋이며, 두 저장소에 걸친 과제는 백엔드 계약 커밋을 먼저 만들고 프론트가 뒤따른다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | MIG-19 | 전제가 폐지된 `@Disabled` 테스트(`부문계획_조정이_품목을_교체한다`)와 그 유일한 소비처였던 `plan.json` 픽스처를 삭제했다. Task 9 재설계가 품목 버전 교체를 폐지하고 경로(`ProjectService.replaceItemsForMigration`)까지 지웠으므로 다시 켤 수 없는 테스트다. 대체 동작은 `하반기_조정_후에도_요청_품목이_활성으로_남는다`가 고정한다. | it_backend `bdf0672d` | `./gradlew compileTestJava` 통과 |
| ✅ Done | MIG-20 | `requireSupported`가 dry-run·commit 양쪽에서 같은 `SheetKind`의 중복 업로드를 거부한다. 시트별 처리 상태(`createNewRows`·`matchedPkByRow`·`createdPkByRow`)가 `SheetKind`를 키로 쓰므로 중복 업로드는 두 페이로드의 엑셀 행 번호를 같은 키 아래 섞었다. 판정은 종류·연도 검사 뒤에 둬 기존 연도 혼재 메시지를 보존한다. | it_backend `b67ec0bf` | RED 2건(예외 미발생) 확인 후 GREEN. `migration.*` 31→33건 통과 |
| ✅ Done | MIG-23 | 일반관리비 목표액이 진단 없이 미반영되던 두 경로에 WARNING을 붙였다. ① `CREATE_NEW` 행에 일반관리비 열이 채워진 경우(`GENERAL_AMOUNT_NOT_CREATABLE`) — 신규 품목은 자본 3열에서만 생성돼 담을 품목이 없다. ② 열이 비었고 그 비목에 기존 편성률이 하나도 없어 `DEFAULT_DUP_RT = 100`이 실리는 경우(`GENERAL_RATE_DEFAULTED`) — 판정 단위는 품목이 아니라 **비목코드**다(`itemRates`가 비목 칸에 담고, 같은 비목의 품목 하나라도 기존값이 있으면 보존되므로). 부수 수정: 서비스가 이미 발행하던 `CREATE_NOT_SUPPORTED`가 `allowableValues`에 빠져 프론트 생성 타입 union에서 누락돼 있었다(→ BE-38로 등록). | it_backend `157ae6f7` | RED(진단 미발생) 확인 후 GREEN. 위임예산·열이 채워진 경우·기존 편성률이 있는 경우에 경고가 나지 않음을 음성 케이스 4건으로 고정 |
| ✅ Done | MIG-06 | 조용히 건너뛰던 두 경로의 건수를 `CommitResponse`에 노출하고 반영 결과 화면에 경고색으로 표시한다. `skippedRateCount`(배분됐지만 그 PK가 연도 스냅샷에 없어 `itemRates`에 실리지 못한 원장), `skippedPlanCount`(부문계획 조정 대상 사업 미발견). `createAdjustmentPlan`이 문서번호와 건수를 함께 돌려주도록 `AdjustmentPlan` 레코드로 감쌌다. | it_backend `01cc1da7`, it_frontend `36f42f0` | RED(필드 부재) → GREEN. 0건일 때 0을 내는 음성 케이스 포함. `api.d.ts` 재생성 후 `codegen:check` 드리프트 없음 |
| ✅ Done | MIG-04 | 위임예산 부점 그룹을 표기가 아니라 **해석된 조직코드**로 묶는다. 종전 조치(`6fafbcba`)는 사업명이 `2026년 0910 위임예산(경상)`이 되는 표면 증상만 닫았고, `resolveOrg`의 부분 일치 단계가 엑셀 `런던`을 정식명 `런던지점`으로 확정하는 경우엔 보정 행(정식명)과 형제 행(엑셀 표기)의 그룹키가 갈려 한 부점이 두 사업으로 쪼개졌다. 두 그룹 모두 `svnDpmC`가 같은 코드로 해석되므로 BLOCKER도 나지 않았다. 사업명 표시명과 주관부서는 그룹 안 첫 행 값을 써 기존 출력을 보존한다. | it_backend `bff602f9` | 정식명≠엑셀 표기 픽스처로 RED(사업 2건) 확인 후 GREEN. 기존 12건 유지 |
| ✅ Done | MIG-02 | 정규 컬럼 계약을 **양방향**으로 자동 대조한다. 양쪽의 리터럴 고정 테스트는 각자의 목록만 지켜 "두 목록이 서로 다르게 바뀐" 상태를 통과시켰고, 그때 dry-run은 진단 없이 빈 셀을 읽는다. 형제 디렉터리의 상대 파일을 읽어 시트별 목록과 순서까지 대조하며, 상대 저장소가 없으면 건너뛴다(그때는 반대편 테스트가 게이트). 파싱 무력화로 대조가 조용히 통과하지 않도록 "네 시트 모두에서 실제로 뽑아냈는지"를 따로 단정한다. | it_backend `247c4ff9`, it_frontend `cadb857` | 컬럼 하나를 일부러 어긋내 **두 저장소 테스트가 모두 실패**하는 것을 확인한 뒤 원복 |
| ✅ Done | MIG-21 | `MigrationPreviewTable.candidatesOf`가 후보를 가진 첫 진단에서 멈추던 것을 진단 전체 합산으로 바꿨다. 같은 코드는 한 번만 남긴다 — 서로 다른 진단이 같은 후보를 함께 제시하면(미해석 + 모호) 선택지가 중복된다. | it_frontend `100708c` | 한 셀에 후보 있는 진단 2건을 걸어 RED(후보 1개) 확인 후 GREEN. mount 기반 컴포넌트 테스트 15건 통과 |
| ✅ Done | FE-38 | 값과 표시명이 결합된 세 형태를 분리했다. ① `IT_PTL_STS_TIMELINE[].labelKey` 신설 — 화면은 키만 `t()`에 넘기고, 소비처가 갖고 있던 인덱스 평행 배열(`STAGE_MESSAGE_KEYS`)과 앞자리 맵(`PROJECT_STATUS_BAND_KEYS`)을 삭제했다(둘 다 타임라인 순서가 바뀌면 조용히 어긋났다). 단일 출처는 `getProjectStatusBandLabelKey`. ② `getApprovalAuthorityBasis().label`용 `APPROVAL_BASIS_LABEL_KEY` 맵 — 소요예산 화면의 `label === '자본예산'` 리터럴 비교를 없애고, 사업 상세의 한글 템플릿(`… 기준으로 결정`)을 `common.approvalBasis.text` 키로 옮겼다. ③ `StageProgress`는 유일 소비처가 클래스·아이콘 분기에만 쓰고 텍스트로 렌더하지 않음을 확인해 키를 두지 않고 타입 주석에 명시했다. 부수: `labelKey` 추가로 `common.ts`가 800줄을 넘어 `app/utils/projectTimeline.ts`로 책임 분리(844 → 649 + 206). | it_frontend `2f55333` | RED 9건 확인 후 GREEN. `npm run check` 통과, `npm test` 3325건 통과(286파일) |
| ✅ Done | MIG-15 | `/budget/work` 편성률 입력이 소수를 받는다. 원인이 둘이었다 — 백엔드 2버킷(`assetDupRt`·`costDupRt`)이 `Integer`라 Jackson이 `70.5`를 조용히 `70`으로 잘랐고, 프론트 InputNumber는 `max-fraction-digits`가 없으면 **소수 구분자 입력 자체를 무시**한다(`insert()`의 `decimalCharIndex === -1 && this.maxFractionDigits` 분기). 계약을 `BigDecimal`로 넓히고 입력에 `max-fraction-digits=5`(ASG_RT 스케일)·`min-fraction-digits=0`을 지정했다. | it_backend `d1e97915`, it_frontend `a8b58d8` | RED(컴파일 거부 → 소수 미반영) 확인 후 GREEN. `./gradlew test` 전체 통과, `codegen:check` 드리프트 없음 |

**남긴 관찰 (신규 등록)**: MIG-26(`/budget/work`가 기존 편성률을 조회하지 않고 DUP 기본값으로 덮음 — 화면 성격 판단 선행), BE-38(진단 코드 `allowableValues` 드리프트를 막을 장치 없음), BE-39(`TranslationAdminController` 파라미터명 미지정으로 스펙이 흔들림), FE-41 보강(감사기가 로직 값으로 남겨야 하는 한글까지 셈), FE-42(기준선 분할 규약이 미커밋 파일에만 있음).

### ✅ 2026-08-16 담당자 이름 표시 보정 (이력 추적용 기록)

> **이 절은 커밋 메시지로는 찾을 수 없는 변경을 기록하기 위한 것이다.** 아래 작업은 다른 작업의 미커밋 변경과 함께 진행되다가, 무관한 커밋 메시지를 단 두 커밋에 그대로 쓸려 들어갔다. 두 커밋 모두 `origin/main`에 푸시된 뒤 다른 작업이 그 위에 쌓였으므로 이력을 재작성하지 않고 대응표만 남긴다.

**문제**: 정보화사업 담당자 컬럼(`USID`·`TLR_USID`·`DVM_USID`·`DVM_TLR_USID`)은 사번 **또는 이름**을 담는다(엔티티 `Bprojm` 주석에 명시). 서버는 이 값을 사번으로만 보고 `TPRMPP_CUSERI`를 조회하므로, 이름이 저장된 행은 조회가 실패해 `*Nm`이 `null`이 되고 화면에 `-`만 나왔다. 실제 데이터(`PRJ-2026-0499`)의 네 컬럼이 모두 한글 이름이었다.

**판정 규칙**: 조회된 사용자명이 있으면 그 값, 없고 저장값에 비ASCII(한글 등)가 섞였으면 저장값을 이름으로, ASCII 값이면(퇴직·미등록 사번) `null`. 사번 형식(`^[A-Za-z]\d{6}$`) 기준을 쓰지 않은 이유는 실제 계정 `TEST001`과 테스트 픽스처 `E10001`이 그 형식에 맞지 않아 멀쩡한 사번을 이름으로 오인하기 때문이다.

| 저장소 | 커밋 (실제 메시지) | 이 작업에 해당하는 파일 |
| --- | --- | --- |
| it_backend | `993abe90` — *feat(migration): read form controls and resolve org by folder code* | `common/util/UserNameResolver.java`(신규), `common/util/UserNameResolverTest.java`(신규, 4건), `domain/budget/project/service/ProjectQueryAssembler.java`(상세), `.../ProjectBatchAssembler.java`(목록·일괄), `domain/budget/status/repository/BudgetStatusQueryRepositoryImpl.java`(예산현황 4개 컬럼) |
| it_frontend | `5fa4e97` — *feat(migration): rework request form import result view* | `components/common/EmployeeLink.vue`(사번 형식이 아닌 값은 링크 대신 텍스트), `tests/unit/components/EmployeeLink.test.ts`(케이스 1건 추가, 총 6건), `pages/info/projects/[id].vue`(IT부서 카드 담당팀장이 주관부서 팀장 `tlrUsidNm`을 참조하던 오류를 `dvmTlrUsidNm`으로 수정) |

**부수 효과**: 예산현황은 `EmployeeLink`가 `eno` 폴백으로 이름을 이미 보여주고 있었으나 `*Nm` 필드가 비어 있어 **Excel 내보내기와 담당자 검색 필터**가 담당자를 놓치고 있었다. 이 수정으로 함께 해소된다.

**범위 밖으로 둔 것**: 사업 목록·예산현황 표에 컬럼을 추가하지 않았고, `EmployeeLink`의 링크 판정 변경은 전 화면(14곳)에 적용되므로 사번이 ASCII인 기존 사용처는 동작이 같다.

### ✅ 2026-08-16 정보화사업 금액 컬럼 3종 추가 (MIG-05)

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | MIG-05 | `updateProject`의 신규 품목 생성 분기가 `Bitemm.builder()`를 직접 호출해 `buildBitemm`과 필드 목록을 손으로 중복하던 것을 해소했다. 세 경로(`createProject`·`replaceItemsForMigration`·`updateProject`)가 모두 `buildBitemm` 하나를 거친다. 금액 컬럼 작업이 `ProjectService`를 800줄 상한 위로 밀어 올려 상쇄 분량을 찾던 중 처리했다 — 중복 제거가 곧 34줄 감축이었다. 19개 필드가 기존 인라인 빌더와 동일함(`dfrCleC` 기본값, `sectSysUtzYn`·`itrInfrYn` null→`"N"`, `lstYn("Y")`, `xcrBseDt` 정규화, `mplAmt` 클램프 포함)을 최종 리뷰가 필드 단위로 대조 확인했다. | it_backend `4af5c9ff` | `./gradlew test` 3287건 통과(실패 0). `MaxLinesRatchetTest` 통과 — `ProjectService.java` 816→785줄. 최종 전체 브랜치 리뷰가 behavior-preserving 확인 |

> 같은 작업에서 발견한 잔여 항목은 `TASK.md`에 BE-35(`ProjectService` 800줄 근접)·BE-36(`totRqmAmt` 이름 불일치)·BE-37(`jacocoTestCoverageVerification` 기존 위반)로 등록했고, MIG-07에는 통합 테스트 실패 원인 재확인 결과를 보강했다.
> 기능 자체(BPROJM/BPROJL 금액 3종 + 기 지급예산 입력)는 잔여과제가 아니라 신규 기능이므로 설계·계획 문서(`docs/superpowers/specs/2026-08-15-project-amount-columns-design.md`, `docs/superpowers/plans/2026-08-15-project-amount-columns.md`)를 근거로 남긴다.

### ✅ 2026-08-09 잔여과제 일괄 조치 (FE-36 · BE-24 · CQ-25 · CQ-26)

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | FE-36 | `/budget/list` 500 오류의 **실제 원인은 undefined 컴포넌트가 아니었다**. `fetchBudgetListPageData()`가 첫 `await` **뒤에** `fetchProjects({odnYn:'Y'})`·`useCost()`를 부르는데, `<script setup>`의 top-level await는 `withAsyncContext`가 **페이지 레벨에서만** 인스턴스를 복원하므로 그 시점에는 setup 컨텍스트가 없다 → `useApiFetch` → `useToast()`의 `inject()` 실패 → PrimeVue가 `No PrimeVue Toast provided!`를 던져 async setup이 거부된다. `Invalid vnode type: undefined`와 `Cannot read properties of undefined (reading 'length')`는 그 **하위 증상**이었다. 세 조회 핸들을 첫 await 이전에 만들고 `Promise.all`로 함께 기다리게 고쳤다(순차 waterfall도 제거됨). **같은 결함이 `useCouncilRequestPage`에도 있었다** — `/info/council-request/:id`가 동일하게 500이 되는 것을 확인하고 함께 고쳤다. `useDocumentDetailPage`는 await 이후 호출이 `useNuxtApp()`에서 미리 받아 둔 `$apiFetch` 클로저라 영향 없음을 확인했다. | it_frontend `9d57a38` | 브라우저 콘솔 계측으로 실패 지점을 단계 로그(A→B→C)로 특정. `budget.spec.ts:161` e2e 재현→통과 전환. 호출 시점을 고정하는 회귀 단위 테스트 추가(수정 전 실패·수정 후 통과 확인). 변경 페이지 e2e 14건, 단위 2943건, `check`·`format:check` 통과 |
| ✅ Done | BE-24 | Phase 1-B(b) 함수 기반 UNIQUE 인덱스를 마이그레이션으로 추가했다(`V20260809_001`). 세 집행 문서 테이블에 `CASE WHEN LST_YN='Y' AND DEL_YN='N' THEN DOC_MNG_NO END` UNIQUE 인덱스(`IX_TPRMPP_{BDELIM,BCONTM,BPAYMM}_03`)를 만들어 "문서당 활성행 1건"을 DB가 강제하게 했다. 스크립트는 재실행 안전이며 중복 활성행이 있으면 `ORA-01452` 대신 원인이 드러나는 오류로 중단한다. 기존 통합 테스트의 "버전이 다르면 활성행이 둘 생긴다"(구멍을 기록하던 케이스)를 **거부 단언으로 뒤집고**, 이전 버전을 내리면 새 활성 버전이 허용되는 반대편 케이스를 추가했다. DBA 인계 노트 작성 완료. | it_database `c04242d`, it_backend `4426b528` | 로컬 적용 후 세 인덱스가 `UNIQUE`/`FUNCTION-BASED NORMAL`로 생성됨을 `ALL_IND_EXPRESSIONS`로 확인. 재실행 시 skip 로그로 idempotency 확인. `ExecutionDocumentActiveVersionIt` 5건 통과, `./gradlew check` 통과 |
| ✅ Done | CQ-25 | `it_backend`가 추적하던 도구 산출물 `graphify-out/cache/stat-index.json`(약 206KB)의 추적을 해제하고, `it_backend`·`it_frontend` 두 하위 저장소 `.gitignore`에 `graphify-out/`을 추가했다(루트 규칙이 독립 저장소에 적용되지 않는 문제). 로컬 파일은 유지했다. | it_backend `9e3ea8af`, it_frontend `49c4fc0` | `git ls-files graphify-out/` 0건, `git check-ignore -v`로 두 저장소 모두 규칙 적중 확인, 로컬 파일 잔존 확인 |
| ✅ Done | CQ-26 | FE-15 전환이 남긴 고아 타입 10건(`BizplanSchedule`·`BizplanContract`·`BoardPostListItem`·`IoeCategoryResponse`·`ProjectSummaryCategory`·`CategoryAmount`·`ProjectSummaryItem`·`HearingType`·`MemberScheduleStatus`·`PlanBusinessVerdict`)을 선언·주석과 함께 제거하고, `BudgetSummaryResultTable.vue`의 로컬 재선언 2건(`SummaryRowType`·`SummaryDisplayRow`)을 `types/budget-work`의 정식 export import로 바꿨다. `EvaluationItem`은 `useCouncilEvaluationApi.ts:48`이 인라인 `import('~/types/council')` 형태로 쓰고 있어 **삭제하지 않았다**. | it_frontend `78965f2` | 삭제 전 각 이름을 인라인 `import()` 포함해 전수 재확인(생성물 `types/api.d.ts`의 스키마 키 문자열 제외). 로컬 선언과 정식 타입의 15개 필드 구조 동일성 확인. `npm run check`·`format:check`·단위 2943건 통과 |

> BE-24는 완료 이관하지 않았다. dev/prod 인덱스 적용은 DBA 소관이라 `TASK.md`에 🏛️ External로 남긴다.
> BRD-02는 발동 조건(게시판당 1만 건)을 로컬 실측으로 확인했으나 전체 2건에 그쳐 미충족이다. 조건부 항목으로 `TASK.md`에 유지하고 측정값만 기록했다.

### ✅ 2026-08-09 FE-15 전면 마이그레이션·BE-03 읽기 프로젝션 후속

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | FE-15 | API 응답 DTO의 required·nullable·enum OpenAPI 계약을 전 도메인에 고정하고, 프론트의 수동 API 응답 미러를 생성 스키마 alias로 전환했다. Cost는 서버 응답과 날짜·신규행을 허용하는 편집 모델을 분리했다. `review.ts`는 서버 미러가 아닌 브라우저 검토 세션 상태라 UI 타입으로 유지했다. 줄 수 ratchet을 지키도록 Cost 단말기와 협의회 워크플로 DTO 책임도 별도 기반 타입으로 분리했다. | it_backend `2e3bf61f`·`1078fa4f`·`0696655e`·`0bbfeb69`·`8a17c591`·`ee4a8f6d`, it_frontend `9264a65`·`8945a18`·`1fa53e5`·`2e69658`·`1da2194` | springdoc 모델 계약 테스트, 생성 OpenAPI 160 paths·229 schemas, `codegen:check`, 프론트 타입검사·전체 테스트 통과 |
| ✅ Done | BE-03 후속 | 쓰기 엔티티와 DDL을 유지한 채 BBUGTM 7필드, `ProjectKeyView` 2필드, 알림함 8필드 읽기 프로젝션을 적용했다. 대표행 정렬·서비스 결과·알림 페이지 합계가 기존 엔티티 조회와 동등함을 Oracle 통합 테스트로 확인했다. | it_backend `c4f4e0c4`·`6d9578b7` | 예산·사업명·알림함 projection 통합 테스트와 관련 서비스·컨트롤러 단위 테스트, `./gradlew check` 통과 |

> BE-03의 남은 Project/Cost wide 추가 프로젝션은 14일 이상 운영 AWR·호출량에서 병목이 확인될 때만 재개한다. 현재는 운영 증거가 없으므로 외부 게이트로 유지한다.

### ✅ 2026-08-09 비DDL Wave 2·3 구조·ORM 상환

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | CQ-22 | Tiptap extension barrel 2개와 툴바 2개를 책임별 모듈·하위 컴포넌트로 분해했다. 네 기준 파일이 모두 800줄 이하가 되었고 runtime export·PluginKey·schema 계약을 특성화 테스트로 고정했다. | it_frontend `a10580e`…`c489b3a`(후속 런타임 import 보정 `6b83263`) | extension barrel 계약, 툴바 컴포넌트 테스트, max-lines ratchet, 전체 `npm test`·`check` 통과 |
| ✅ Done | CQ-15 | 잔여 16개 기준 파일을 composable·표시 컴포넌트·순수 변환 모듈로 분해해 모든 운영 파일을 800줄 이하로 낮췄다. `scripts/max-lines-baselines.mjs`의 기준선은 0개가 되었고 신규 초과 금지 ratchet만 남았다. | it_frontend `36803de`…`3715038` | `max-lines-ratchet.test.ts`가 기준선 0개와 운영 파일 전수 상한을 확인, 전체 `npm test`·`format:check`·`check` 통과 |
| ✅ Done | CQ-18 | 루트의 `PageHeader`·`AppDialogFooter`·`TableCard`를 `components/common`으로 옮기고 모든 소비처를 명시 import로 전환했다. 루트 범용 UI 후보는 0개다. | it_frontend `0703b01` | `component-boundaries.test.ts`, max-lines ratchet, `npm run check` 통과 |
| ✅ Done | FE-19 | SFC Stylelint 잔여를 모두 해소하고 파일별 grandfather 면제를 회수했다. 미디어 쿼리는 Safari 16.4 미만 호환을 보존하도록 prefix 표기로 명시했고, 구형 인쇄 엔진용 `page-break-inside`만 사유가 적힌 단일 행 예외로 유지했다. | it_frontend `3100058` | `npm run lint:css`·`format:check`·`check`, max-lines ratchet 통과 |
| ✅ Done | BE-25 | `Cappla`·`Bcmmtm`·`Bmqnam`·`Bpqnam`의 `@IdClass`와 Repository ID 타입을 기존 물리 복합 PK에 정렬했다. Q&A 서비스는 협의회ID를 포함한 복합키로 조회하고, 위원유형 변경은 영속 PK 직접 변경 대신 기존 행 비활성화·대상키 복원/생성으로 처리한다. DDL은 변경하지 않았다. | it_backend `85af6122` | 매핑 계약 단위 테스트, 관련 서비스 테스트, `./gradlew check`, 실제 Oracle에서 네 엔티티의 동일 부분키 다중행 조회·수정·삭제 격리 통합 테스트 통과 |

> FE-15는 완료 이관하지 않았다. 이번 파동에서 실시간 로그와 메뉴 도메인의 required·nullable·enum OpenAPI 계약을 보강하고 수동 타입을 생성 타입 기반으로 전환했으며(backend `ce7b234d`·`1c19407f`, frontend `0f8a09a`·`a15c6f5`), JVM 재기동 사이의 무의미한 생성 순서 드리프트를 `alphabetize: true`와 계약 테스트로 제거했다(frontend `8c7fd3b`). 나머지 수동 API 도메인은 활성 FE-15에서 계속 추적한다.

### 2026-08-09 비DDL Wave 1 감사·정책 정렬

| 상태 | ID | 결과 | 근거 |
| --- | --- | --- | --- |
| ☑️ Accepted | FE-29 | “다시” 유무는 최초 로드/첫 후속 조회와 명시적 재시도 실패의 실행 맥락 차이이므로 전역 치환하지 않는다. | [`Wave 1 evidence`](docs/superpowers/reports/2026-08-09-non-ddl-wave1-evidence.md), `it_frontend/CLAUDE.md` §2 |
| ✅ Done | BE-32 | 협의회 통보·생략 후 BPROJA 상태를 현재 코드셋의 타당성검토 완료 `49`로 정렬했다. | `CouncilServiceTest`, `versions.lock`의 `it_backend` SHA |

### ☑️ 2026-08-09 DDL 없는 조건부 과제 3건 종결

| 상태 | ID | 종결 범위 | 후속 트리거·근거 |
| :--: | :--: | --- | --- |
| ☑️ Accepted | FE-25 | 결과서 저장 뒤 자식 `ResultForm`은 결과서 내용을, 부모 화면은 상태 전이가 반영된 협의회 상세를 각각 재조회한다. 두 배너는 같은 문장의 중복이 아니라 독립 데이터 실패와 각자의 [다시 조회] 경로를 보여준다. 하나를 숨기면 해당 데이터의 복구 경로가 사라지므로 현 동작을 유지한다. | `ResultForm.vue`의 `resultRefreshFailed`와 부모 `result/[id].vue`의 `detailRefreshFailed`·문구·재시도 핸들러를 2026-08-09 재확인했다. 호출 단위 알림 정책이 필요해질 때만 재검토한다. |
| ☑️ Accepted | BE-21 | `DCD_TP_C`는 현재 결재선 모든 행에 요청(`10`)을 쓰지만 운영 코드의 읽기 소비처와 프론트 소비처는 0건이라 현재 동작에 의미 차이가 없다. 미확정 정책을 임의 코드값으로 바꾸지 않고 현 쓰기 계약을 유지한다. | `it_backend/CLAUDE.md`에 이 값을 조회·응답·분기에서 처음 소비할 때 최종결재자 포함 행별 의미와 코드셋을 먼저 확정하고 계약 테스트를 추가하는 규칙을 고정했다. backend `40bc50ba`. |
| ☑️ Accepted | BE-28 | 사용자 결정대로 시퀀스 정의와 DDL은 바꾸지 않는다. 운영 확인과 체크인된 live DDL 스냅샷의 CYCLE 상태가 달라 환경별 `ALL_SEQUENCES.CYCLE_FLAG`를 직접 확인하도록 DBA 인계 문서를 현행화했다. | CYCLE 연도 결합 시퀀스는 연간 발급량 5,000건 초과 시 조기 재검토하고, NOCYCLE은 `LAST_NUMBER`와 9,999 상한을 감시한다. BBUGTM의 LPAD 절단 경로는 이미 제거됐다. `it_database/docs/operations/2026-07-24-migration-handover.md`, database `7579c0c`. |

### ✅ 2026-08-09 FE-35 KST 날짜 경계 보정

> 활성표에서 이미 완료된 게시판 첨부 가드 과제 FE-33을 재사용하고 있어, 완료 이관 시 다음 빈 번호 FE-35로 정규화했다. 구현 커밋의 FE-33 표기는 이관 전 ID를 가리킨다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | FE-35 | DatePicker의 로컬 자정 `Date`를 UTC로 바꾼 뒤 날짜를 잘라 KST에서 하루 전이 되던 결함을 해소했다. `toLocalDateKey`가 로컬 연·월·일로 `YYYY-MM-DD`를 만들며, 사업 기간 필터·관리자 변경이력·공통코드 기준일·요구사항 완료기한·단말기 환율기준일·관리자 오늘 통계 등 업무 날짜 지점이 이를 공유한다. UTC 타임스탬프와 다운로드 파일명은 의도대로 유지했다. | it_frontend `319fc05`(RED), `200039e`(GREEN) | KST 재현에서 사업 기간 필터가 이전 종료 사업을 포함하고 관리자 로그 날짜가 하루 전이 되는 실패를 확인한 뒤 동일 테스트 230건 GREEN. 영향 컴포넌트·ratchet 테스트까지 264건 통과, `admin/codes.vue` 1041줄·`documents/[id]` 1533줄 기준선 유지. |

### ✅ 2026-08-09 TASK.md 완료 행 정리·프론트 의존성 감사 0건

> 활성 목록에 남아 있던 완료 행 17건을 이관했다. SEC-10은 원래 대상(`brace-expansion`)과 후속 운영 의존성(`dompurify`)이 이미 해소된 상태를 정리하고, 마지막 dev 전용 `js-yaml` advisory까지 최소 override로 닫았다.

| ID | 상태 | 유형 | 완료 과제 | 완료 근거 |
| --- | :--: | --- | --- | --- |
| SEC-10 | ✅ Done | 의존 | ~~프론트 의존성 취약점 판정 대기~~ **2026-08-09 완료** | GHSA-mh99-v99m-4gvg는 2026-07-24 갱신 상태에서도 영향 버전을 `<=5.0.7`, 패치 버전을 `5.0.8`로만 명시한다. 2026-07-30 npm dist-tags에 `maintenance-v1=1.1.17`, `maintenance-v2=2.1.3`이 공개됐지만 공식 advisory가 두 버전을 패치로 판정하지 않아 의존성을 갱신하거나 완료 처리하지 않는다. 현재 설치 버전은 1.1.16/2.1.2/5.0.8이고 `npm audit`은 `brace-expansion` high를 포함해 총 23건(22 high)을 보고한다. 5.x 라인의 5.0.8 override는 유지하되 CJS named export가 다른 minimatch 계약과 호환되지 않으므로 전역 override를 금지한다. 공식 패치 판정 후에만 소비자별 호환 범위에서 갱신하고 `npm audit`으로 해당 advisory 제거를 확인한다. `npm audit fix --force`는 nuxt/exceljs 다운그레이드를 유발하므로 금지. **재확인(2026-08-08) — 이 항목의 대상은 해소됐다**: `npm audit`에서 **`brace-expansion`이 사라졌다**. 설치 버전이 1.1.16/2.1.2 → **1.1.18/2.1.4**로 올라 있고(5.0.8 override 유지), 총 취약점도 23건(22 high) → **3건(moderate 1·high 2)** 으로 줄었다. SEC-10이 기다리던 "공식 advisory 패치 판정"과 무관하게 소비자 재해석으로 풀렸다. **대신 이 항목에 없던 신규 3건이 잡혔다** — 성격이 달라 별도 판단이 필요하다. ① **`dompurify` 3.4.12 (moderate, GHSA-55q2-fjhq-7xh7)** — IN_PLACE hook 제거 시 분리된 서브트리가 실행 가능해 XSS. **운영 번들에 닿는 유일한 건**이다(`isomorphic-dompurify@3.14.0`이 prod 의존이고 `it_frontend/CLAUDE.md` §3이 `v-html` 정화에 이 라이브러리를 요구한다). 패치는 3.4.13. ② **`js-yaml` 4.3.0 (high, GHSA-5p4m-2wfm-xmqj)** — `!!omap` 해석의 2차 CPU 소비, CVE-2026-59870 fix가 4.x에 backport되지 않음. 경로가 `eslint`·`stylelint`·`openapi-typescript` 세 갈래로 **전부 devDependency**라 운영 번들에 없다. ③ **`@redocly/openapi-core` (high)** — ②의 전이 의존(`openapi-typescript` 경유), 역시 dev 전용. **`npm audit fix`는 `--force` 없이도 쓰면 안 된다**: dry-run 결과 **307건 변경**으로 nuxt 4.4.8 → 4.5.2 전체 툴체인, `@unhead/vue` 2.1.15 → **3.3.1(메이저)**, `rolldown` 신규 도입이 딸려 오고 nuxt 4.5.2는 Node `^22.19.0`을 요구하는데 현재 v22.18.0이다. 보안 패치가 아니라 대규모 업그레이드다. **권고**: 운영 번들에 닿는 ①만 좁은 override로 3.4.13에 고정하고, ②③은 dev 전용이므로 툴체인 정기 갱신 시점에 함께 처리한다. 계획: `docs/superpowers/plans/2026-08-08-task-quickfix-batch4.md` **최종 조치(2026-08-09)**: 기존 `brace-expansion`과 운영 경로 `dompurify`는 이미 패치 버전으로 해소돼 있었고, 남은 dev 전용 `js-yaml` 4.3.0 경로 3개를 최상위 override `^4.3.1`로 통일했다. `npm audit --audit-level=low` 결과 취약점 0건. 회귀 테스트 `dependency-security-policy.test.ts`를 추가했다. 프론트 커밋 `1b780f6`, `f4b7d04`. |
pm audit --audit-level=low 결과 취약점 0건. 회귀 테스트 dependency-security-policy.test.ts를 추가했다. 프론트 커밋 1b780f6, 4b7d04. |
| ERR-15 | ✅ Done | 검증  | ~~ERR-13 감사 리포트가 놓친 재조회 미판정 잔여(census 누락)~~ **2026-08-06 완료** | ERR-13 감사(`docs/superpowers/reports/2026-07-err13-refresh-audit.md`)의 정규식이 `@saved="refreshX"` 형태의 무괄호 템플릿 바인딩을 못 잡아 누락된 지점이다. 전부 "쓰기 성공 후 재조회 미판정"이라는 ERR-13과 **동일한 결함 클래스**다. 잔여 지점: `app/pages/info/council-request/prepare/[id].vue:679,699`(`@saved="refreshCouncil"`), `app/pages/info/council-request/result/[id].vue:910`(동일), `app/pages/info/cost/terminal/[id].vue`(`@saved="refreshCost"`, `TerminalFormDialog` 핸들러). **감사 리포트의 총계 145는 과소 집계다** — 후속 census는 정규식이 아니라 템플릿 바인딩까지 포함해야 한다. 발견 경위: ERR-13 3c·3f 구현자가 각각 발견해 보고, 리뷰어가 확인. 범위 규칙("감사 리포트에 없는 지점을 손대지 마라")에 따라 이번 범위에서 손대지 않았다. **추가(2026-07-31 통합 리뷰)**: `app/pages/admin/logs/[logKey].vue`도 감사 census에서 누락된 것으로 확인됐다(진짜 누락 1건 — `app/pages/budget/summary.vue`·`budget/comparison.vue`는 C-2로 의도적 제외가 이미 등재돼 있어 대상이 아니다). 이 파일의 재조회 지점은 무괄호 템플릿 바인딩이 아니라 `watch(logKey, ...)`(라우트 파라미터 변경, 45·277~280행)와 툴바 새로고침 버튼(`@click="() => refresh()"`, 559~563행)이다 — 놓친 메커니즘은 다르지만(정규식 사각지대가 아니라 파일 자체가 census 대상에서 빠짐) "감사 총계가 과소 집계"라는 같은 결함 클래스라 별도 ID를 만들지 않고 이 항목에 합친다. 이 파일은 `useRefreshGuard`가 아예 없어 재조회 실패와 최초 로드 실패를 화면이 구분하지 못하고(`v-else` 오류 블록이 공용), 배너·재시도 경로도 없다. 후속 census는 정규식뿐 아니라 파일 단위 전수 확인도 병행해야 한다. **2026-08-06 조치 완료**: ① 전수 census를 다시 돌린 결과 위 기록의 4지점은 **6지점**이었다 — 기록된 좌표 2건이 드리프트했고(`result/[id].vue:910 @saved` → 실제 `:731 @status-advanced`), 기록에 없던 `prepare/[id].vue`의 `@status-advanced` 1건과 `CommitteeSelector.vue`의 툴바 재조회 1건이 추가로 나왔다. ② 판정이 필요한 5지점을 가드에 배선했다(`prepare` 2건·`result` 1건·`terminal` 1건은 각 화면의 기존 가드로 교체, `admin/logs/[logKey].vue`는 가드가 없어 조회·파생·판정을 `useAdminLogList` composable로 분리하며 신규 배선 — CQ-15 기준선 939줄을 지키기 위한 추출이기도 하다). `CommitteeSelector.vue`는 초기 로드 오류 블록 안의 [다시 시도] 버튼이고 재시도 실패 시 그 블록이 그대로 남아 실패가 이미 화면 상태로 보고되므로 면제했다. ③ **재발 방지**: 좌표를 기록하는 census 자체가 드리프트의 원인이었으므로 `tests/unit/architecture/refresh-binding-census.test.ts`가 매 실행마다 app 하위 SFC를 전수 스캔하고, 면제는 `파일 경로 + 핸들러 이름` 쌍으로만 선언한다(줄이 밀려도 흔들리지 않는다). 가드를 거치는 래퍼는 `attempt`/`retry` 접두 관례를 게이트가 강제한다. |
| FE-20 |  ✅ 완료  | 제한  | ~~편집 중 다른 행의 미저장 편집이 재조회로 덮어써짐~~ **2026-08-08 완료**                       | `app/composables/costList/useCostTerminalDialogs.ts:205,208` / `app/composables/costList/useCostExcelTransfer.ts:214`의 재조회가 같은 편집 세션의 **다른 행**(저장 대상이 아닌 행)의 미저장 `_status='modified'` 편집을 덮어쓴다. `useCostEditingState.ts`의 merge watcher가 `_saveError` 보유 행만 보존하기 때문이다(2026-07-31 완료한 FE-16과 같은 보존 로직의 사각지대). 발견·확인: FE-16 구현자가 발견, 리뷰어가 코드로 독립 확인. FE-16은 `onActivated` 억제가 범위였고 이 경로는 "사용자가 명시적으로 일으킨 동작"이라 억제 대상이 아니었다. **2026-08-08 완료**(`it_frontend` `6d23724`). **조치**: 병합 watcher의 보존 조건을 `_saveError` 보유 행 → **"로컬 미저장 상태(`_saveError` 또는 `_status`)를 가진 행"**으로 넓혔다. 서버 원본으로 통째로 대체해도 되는 행은 미저장 상태가 없는 행뿐이라는 규칙이다. 삭제 표시(`_status='deleted'`)도 같은 부류의 미저장 작업이라 함께 보존한다 — 병합은 서버가 여전히 돌려주는 `costBgNo`에만 치환을 적용하므로 서버에서 삭제된 행이 로컬 보존 때문에 되살아나지는 않는다. **반대 결함(저장 결과가 화면에 반영되지 않음)이 생기지 않는 근거**: `useCostPersistence.saveAll`이 저장에 성공한 행의 `_status`를 **재조회 전에** 지우므로(`delete row._status`) 저장 대상 행은 보존 대상이 아니고 서버 원본으로 정상 갱신된다 — 이 순서 자체를 테스트로 고정했다. **신규 테스트 4건**: ① 다른 행의 편집 보존 + 편집하지 않은 행은 정상 갱신 ② 저장 대상 행은 서버 원본으로 갱신 ③ 삭제 표시 보존 ④ 보존 행이 있어도 스냅샷은 서버 원본 기준(ERR-11 규칙 유지). 억제 대상이 아닌 재조회를 `refreshCostsRaw()` 직접 호출로 재현해 병합 watcher가 실제로 도는 상황을 관측한다(기존 FE-16 테스트는 `onActivated` 억제로 watcher가 아예 돌지 않는 경로라 서로 다르다). **RED 확인**: 보존 조건을 되돌리면 신규 ①③이 실패하고 ②④는 양쪽 모두 통과하는 회귀 방지 가드다. 계획: `docs/superpowers/plans/2026-08-08-task-quickfix-batch3.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| FE-22 |  ✅ 완료  | UX  | `useRefreshGuard` 토스트 억제 — **2026-08-07 완료** (호출 단위 전환 + 16곳 적용)         | **2026-08-07 완료**(`it_frontend` `8f04574`). **인스턴스 단위 `notifyMode`로는 적용 가능한 지점이 0개였다** — 소비처 0곳은 지점 선정을 안 해서가 아니라 구조적으로 켤 수 없었기 때문이다. 실측 manifest(가드 54개, grep 56건 중 2건은 JSDoc `@example`): `onActivated` 구동 16개(직접 13 + `budget/list.vue`의 `refreshBudgetList()` 경유 간접 3)가 **전부 [다시 조회] 버튼을 보유**해 종전 기준상 전부 제외됐다. 더 결정적으로 **한 가드 인스턴스가 C-3와 Class B를 겸한다** — `documents/[id]/index.vue`의 `attemptFilesRefresh`는 6곳에서 호출되는데 `onActivated` 1곳과 파일 업로드·삭제 등 **쓰기 직후 5곳**이 섞여 있어, 인스턴스 단위로 끄면 저장 실패 알림까지 침묵했다. `retryRefresh`도 `attemptRefresh(retryFailureDetail)` 그 자체라 같은 인스턴스다. **조치**: `notifyMode`를 제거하고 `attemptRefresh(문구, { silent: true })`**호출 단위 옵션**으로 바꿨다. 기본값이 종전 동작이라 나머지 38개 가드는 영향이 없고, `retryRefresh`는 사용자 명시 조작이므로 억제 대상이 아니다. `onActivated` 호출 **16곳에만** 적용했고 검색·페이지 이동처럼 사용자가 일으킨 재조회(`board/[blbMngNo]/index.vue` 2곳 등)는 의도적으로 제외했다. **줄 수 처리**: 옵션 추가로 CQ-15 기준선 파일 6개가 +2~+4가 되고 `info/cost/[id].vue`가 799→801로 800 상한을 넘어, 기준값 상향·기준선 신규 등재가 모두 금지 방향이므로 가드 JSDoc이 이미 설명하는 중복 주석을 압축해 상쇄했다(결과적으로 5개 파일 기준값을 1씩 하향 — ratchet이 `toBe`라 감소도 동반 갱신이 필수다). 규칙은 `it_frontend/CLAUDE.md` §2에 등재했다. 종전 기록: **2026-08-06 옵션 도입**(`it_frontend` `382c5ef`·`94a5656`). `notifyMode?: 'toast+banner' \| 'banner'`를 추가했고 기본값이 종전 동작이라 회귀가 없다. `'banner'`는 배너 상태와 진단 로그는 그대로 남기고 Toast만 끈다. **잔여: 어느 C-3 지점에 실제로 적용할지는 화면별 판단이라 아직 아무 소비처에도 적용하지 않았다** — 적용 대상을 정하고 화면별로 켜야 한다. 원 문제: C-3 지점(`onActivated` 재조회·툴바 새로고침·검색/페이징)은 KeepAlive 재방문마다 실행되므로 백엔드가 지속적으로 400/409/422를 내면 탭을 오갈 때마다 토스트가 반복된다. `it_frontend/CLAUDE.md` §2는 "toast 또는 화면 상태"를 요구하므로 배너만으로도 규약은 만족한다. **적용 시 주의**: `notifyMode`는 호출 단위가 아니라 **가드 인스턴스 단위**로 고정되므로 `retryRefresh()`도 같은 값을 물려받는다 — `'banner'`인 가드에서는 사용자가 배너의 [다시 조회] 버튼을 눌러 일으킨 재시도까지 Toast가 뜨지 않는다. 재시도 UI가 있는 지점에 켤 때는 그 동작이 맞는지 별도로 판단한다(JSDoc에도 명시해 뒀다). 쓰기가 선행한 지점(Class B)에는 쓰지 않는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| FE-23 |  ✅ 완료  | 테스트 | `clearNuxtData()`·언마운트 purge 보존 동작 — **2026-08-07 실측 전환 완료**             | ERR-13 3-keep의 보존 메커니즘은 `clear()`(반환 객체 메서드)에 대해서만 실측 테스트가 있다. `clearNuxtData()`(모듈 전역)와 언마운트 purge는 같은 `clearNuxtDataByKey`를 타므로 구조적으로 동일하다는 추론에만 의존하며, 테스트 대역도 그 두 경로를 구현하지 않는다. 실측 테스트 보강이 필요하다. **2026-08-07 완료**(`it_frontend` `9890e79`). 두 경로가 `clear()`와 다른 점은 **반환 객체를 거치지 않고 키로 항목을 찾아 비운다**는 것이다 — 소비자가 `clear()`를 노출하지 않아도 일어난다. 그래서 대역이 만든 항목을 키로 등록(`clearHandlesByKey`)하고 `control.clearNuxtData(key?)`·`control.purgeOnUnmount(key?)`를 노출했다. Nuxt에서 셋 다 `clearNuxtDataByKey` 하나로 모이므로 대역도 `clearEntry` 하나를 공유하며, **이름만 나눠** 테스트가 어느 경로를 재현하는지 드러낸다. `describe.each`로 두 경로에 같은 3케이스를 건다(실제로 비워짐 / 진행 중 요청과 겹쳐도 보존값이 되살아나지 않음 / 비운 뒤의 실패가 지운 데이터를 부활시키지 않음). **RED 확인**: `useApiFetch`의 `errorAtRequestStart` 판별을 제거하면 새 두 경로가 기존 `clear()` 테스트와 **함께** 3건 실패한다 — 추론이 실측으로 바뀌었다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| FE-26 | ✅ Done | UX  | ~~`prepare/[id].vue`의 탭 가시성 한계로 재조회 실패 배너가 안 보일 수 있음~~ **2026-08-06 완료** | `onCommitteeSaved`(탭0 "평가위원 선정")가 실패시키는 대상은 탭1에 있는 `ScheduleStatus`의 배너다. `<Tabs>`에 `lazy`가 없어 패널은 마운트되지만 `v-show`로 숨겨져 있어, 탭0에 머무는 사용자에게는 보이지 않는다. **조치**: `ScheduleStatus`가 `defineExpose`로 돌려주는 값이 이미 가드의 `RefreshGuardOutcome`이므로, 부모는 배너를 복제하지 않고 그 값만 읽어 **실패한 경우에만** 탭1로 전환한다(성공하면 사용자 흐름을 끊지 않고 탭0에 남는다). 배너와 실패 원인의 소유권은 여전히 자식에 있어 task-3c 판단 1과 충돌하지 않는다. 종전 `scheduleStatusRef` 타입이 `Promise<void>`로 선언돼 outcome을 뭉개고 있어 실제 반환 타입으로 정정했다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| FE-27 |  ✅ 완료  | 테스트 | 통합 리뷰 B 테스트 위생 5종 — **2026-08-07 재조사·조치 완료**                             | 2026-07-31 병합 후 통합 리뷰 그룹 ③(테스트 신뢰도)의 Important I1~I6 중 Critical만 처리(`it_frontend/.superpowers/sdd/integration-fix-B-report.md`)하고 아래는 남겼다: ① 스파이(`vi.spyOn`)가 테스트별로 복원되지 않아 다음 테스트로 누수될 수 있는 지점 ② 대역(mock)이 파일 간 공유돼 격리가 깨지는 지점 ③ 더 이상 소비되지 않는 죽은 mock 배치 ④ `cdvaNm` 분기가 항상 같은 값으로 귀결해 사문화된 지점 ⑤ `stubGlobal`이 `afterEach`에서 수동 복원되지 않는 지점. 사용자 영향이 없는 테스트 코드 위생 문제라 "사용자 영향 + 테스트 신뢰도" 수정 범위(그룹 ③-A~E, Critical) 밖으로 판단해 손대지 않았다. 세부 파일·라인은 통합 리뷰 산출물(`it_frontend/.superpowers/sdd/integration-findings.md` "후속 등재로 넘길 것" 절)에 개별 기록이 남아 있지 않아 착수 시 `tests/unit/`·`tests/integration/` 재조사가 선행돼야 한다. **2026-08-07 재조사·조치 완료**(`it_frontend` `5d49ed4`). 204개 테스트 파일 전면 재조사 결과 **5종 중 2종만 실재**했다. **① 스파이 미복원 — 9파일**(`vi.spyOn` 수 > `mockRestore` 수): `vitest.config.ts`가 `clearMocks`만 켜 두었고 **`restoreMocks`는 없다** — `clearMocks`는 호출 기록만 지우고 `spyOn`이 갈아끼운 **구현은 남기므로** 스파이를 걸지 않은 뒤 테스트가 앞 테스트의 대역을 물려받는다. 블록 안에서만 스파이하는 4파일(`tiptap-error-diagnostics`·`useTiptapTableTools`·`diagnostics`·`file-meta-update`)에 `afterEach` + `restoreAllMocks`를 넣었다(`useTiptapTableTools`는 `TableMap.get`을 10곳에서 갈아끼우고 한 번도 복원하지 않던 파일이라 효과가 가장 크다). **② 대역 파일 간 공유 — 0건**: `createNuxtFetchFake`의 `sharedEntries`는 팩토리 **내부**라 인스턴스마다 새로 생기고 vitest는 파일 단위 격리가 기본이다. **③ 죽은 mock 배치 — 0건**: 선언 후 미참조 `vi.fn` 0건, 존재하지 않는 모듈을 겨냥한 `vi.mock` 0건(두 정의 모두 확인). **④ `cdvaNm` 분기 사문화 — 1건 확정**(`useCostExcelTransfer.test.ts`): production `codeId`는 `(o.cdvaNm ?? o.cNm) === cNm`인데 `option()` 헬퍼의 3번째 인자를 호출부 4곳이 **전부 생략**해 `cdvaNm`이 항상 `undefined`였다 — 우선순위가 한 번도 검증된 적이 없다. `cNm ≠ cdvaNm`인 옵션으로 두 케이스를 추가했고 우선순위를 뒤집으면 둘 다 실패함을 RED로 확인했다. **⑤ `stubGlobal` 미복원 — 1건 확정**(`useCostListPage.test.ts`): `bbrC` 없는 `useAuth` 스텁을 **테스트 본문 끝**에서 수동 복원하고 있어, 그 앞 단언이 하나라도 실패하면 복원에 도달하지 못해 빈 `bbrC`가 뒤 테스트 전부로 새고 실패 1건이 연쇄 실패가 된다 — `describe`로 묶고 복원을 `afterEach`로 옮겼다. **손대지 않은 것**: `useHwpxExport.direct.test.ts`·`excel.test.ts`는 모듈 수준 `spyOn`을 파일 전체 픽스처로 쓴다 — `afterEach` 복원을 넣으면 첫 테스트 뒤 픽스처가 사라져 깨진다. 같은 이유로 `vitest.config.ts`에 `restoreMocks: true`를 켜는 전역 해법도 쓸 수 없다(`unstubGlobals: true`는 `tests/setup.ts`의 전역 스텁까지 지워 더 위험하다)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FE-28 |  ✅ 완료  | 테스트 | 재조회 가드 회귀 검출 커버리지 공백 — **2026-08-07 전 항목 완료**                            | 통합 리뷰 그룹 ③이 지적한 커버리지 공백(`it_frontend/.superpowers/sdd/integration-findings.md` "후속 등재로 넘길 것" 절): ① KeepAlive `onActivated` → 재조회 가드 경로가 실제로 도는지 관측하는 테스트가 없는 화면이 14개(구체 파일 목록은 리뷰 산출물에 남아 있지 않아 재조사 필요) — 가드·보존 로직이 회귀해도 이 경로에서는 잡히지 않는다 ② **2026-08-06 완료** — FE-21 조치와 함께 `useMentionAutocomplete`·`useGlobalSearch` 양쪽에 순서 역전 검증 테스트를 추가했다(낡은 응답이 최신 결과·로딩·오류 상태를 덮지 않음). ③ **2026-08-06 완료** — 판정 로직을 `scripts/codegen-drift.mjs`로 분리하고(`codegen.mjs`는 최상위 await로 스펙을 fetch한 뒤 `process.exit`으로 끝나 import만으로는 테스트할 수 없었다) `tests/unit/architecture/codegen-drift.test.ts`에서 7건을 고정했다: 생성물 부재/불일치/일치 3분기, 공백 1칸 차이도 drift로 잡는 바이트 단위 비교, **빈 생성물을 파일 부재로 오판하지 않는 경계**(존재 여부를 내용의 truthiness로 판정하면 깨지는 지점), `paths`·`schemas` 카운트의 누락 필드 안전성. 회귀를 조용히 통과시킬 수 있는 공백이라 다른 Minor 항목보다 한 단계 높였다. ① **2026-08-07 완료**(`it_frontend` `5626ce1`). **재조사 결과 대상은 14개**(페이지 12 + composable 2)로 기록된 "14파일"과 일치했다: `onActivated`에서 재조회를 일으키는 것만 센 값이며, `useScrollSpy`·`usePlanToc`(observer 재연결)·`useProjectFormLoad`·`budget/report`·`guide/index`·`cost/form`(상태 초기화·코드 로드)은 재조회가 아니라 제외했다. **이미 커버돼 있던 7개**: `useCostEditingState`·`useInfoHomeFeed`(둘 다 실제 KeepAlive 사이클) + `plan/index`·`plan/[id]`·`projects/index`·`documents/list`·`documents/[id]/index`(`refresh-banner-visibility.test.ts`). **공백 7개**: `approval/list`·`board/[blbMngNo]/index`·`budget/approval`·`budget/list`·`cost/[id]`·`cost/terminal/[id]`·`projects/[id]`. 이 중 `budget/approval`·`projects/[id]`는 테스트 파일이 있었으나 `readFileSync` + 문자열 단언이라 `onActivated`를 전혀 구동하지 않아 커버로 세지 않았다. 신규 `tests/unit/pages/onactivated-refresh-guard.test.ts`가 7개를 덮으며 화면마다 **세 축**을 함께 고정한다: ① 가드 경로가 실제로 돈다(KeepAlive deactivate→activate로 두 번째 이후 `onActivated` 재현 후 배너 도달) ② 보존이 걸린다(재조회 실패에도 직전 정상값 유지) ③ **Toast가 뜨지 않는다**(FE-22 `{ silent: true }` 회귀 방지). RED 2종으로 관측을 검증했다 — `cost/[id]`에서 `silent`를 빼면 Toast 단언이, `budget/list`에서 `onActivated` 재조회를 빼면 배너 단언이 실패한다. **FE-28 전 항목 완료**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| FE-30 | ✅ 완료 | 구조  | ~~통합 리뷰 C Minor 잔여(설정·구조)~~ — **①②③ 전 항목 완료 (2026-08-08)**                                | 그룹 ⑤ 수정(`it_frontend/.superpowers/sdd/integration-fix-A-report.md`) 과정에서 확인한 3건. **③ `scripts/codegen.mjs`가 정적 분석 게이트 밖 → 2026-08-06 완료**(`it_frontend` `92ce020`): 원래는 `eslint.config.mjs`의 `ignores`에서 `'scripts/**'`를 빼려 했으나 그 파일이 config-protection 훅 대상이라 차단됐다. CQ-15 ratchet과 같은 결정(사용자 결정)으로 `tests/unit/architecture/scripts-lint.test.ts`에서 ESLint Node API를 호출하는 **Vitest 게이트**를 뒀다 — `ignore:false` + `overrideConfig` 조합으로 프로젝트 규칙은 유지한 채 배제만 해제한다(type-aware 규칙은 `scripts/`가 tsconfig 프로젝트 밖이라 끔). RED 확인: `scripts/`에 미사용 변수를 넣으면 `scripts/__red_probe.mjs:1 no-unused-vars - ...` 형태로 실패한다. **트레이드오프**: `npm test`에는 잡히지만 `npm run check`에는 안 잡힌다 — 훅 정책이 바뀌어 `eslint.config.mjs`를 직접 고칠 수 있게 되면 그쪽으로 이관하고 이 테스트는 제거하는 편이 낫다(테스트 JSDoc에도 명시). **① 완료**: 2026-08-06 완료(`it_frontend` `989d48e`). 두 파사드가 `useApiFetch` 반환 필드 7개(`data`·`pending`·`error`·`status`·`refresh`·`runWithErrorToastSuppressed`·`enableKeepPreviousData`)를 그대로 노출해 소비처가 `useRefreshGuard`를 배선할 수 있다. **명시 `key`는 두지 않았다** — 두 URL의 소비처가 각각 1곳뿐이고(`approval/index.vue`, `info/documents/index.vue`) 사이드바 배지는 별도 엔드포인트를 써서 키 공유가 없다. 그 근거는 양쪽 JSDoc에 기록했다. 소비처에 실제 가드를 붙이는 것은 화면별 판단이라 FE-22에 남는다. **② 2026-08-08 완료**(`it_frontend` `1bf5121`): FE-19의 `ignoreFiles` grandfather가 파일 단위라 grandfather된 파일에 새 CSS가 추가돼도 영구히 lint 대상에서 빠지던 문제다. **`ignoreFiles`를 통째로 없애고 파일별 `overrides`로 바꿨다** — 각 파일이 실제로 위반하는 규칙만 꺼지고 나머지는 전부 검사받는다. 면제 범위를 최소화하려고 잔여 위반의 성격을 먼저 갈랐다: **설정 결함**(`tiptap-editor.css`의 `selector-pseudo-class-no-unknown` 70건은 전부 `:deep`인데 `ignorePseudoClasses` override가 `**/*.vue`에만 걸려 `.css`가 빠져 있었다 → 규칙을 최상위 `rules`로 올려 해소), **무위험 소스 수정**(`#ffffff`→`#fff`, 폰트명 따옴표, `inset-block` 단축, `currentColor`→`currentcolor`, `word-break: break-word`→`overflow-wrap`, `:after`→`::after` — 전부 렌더링 동일), **정책 결정 선행이라 면제로 남긴 것**(`media-feature-range-notation`·`page-break-inside` 레거시 인쇄 폴백·`-webkit-user-select` Safari 대응·primeicons의 generic family 부재·CQ-15 기준선 파일과 800줄 상한 때문에 빈 줄을 넣을 수 없는 `rule-empty-line-before`). **RED 확인**: `ProjectListCard.vue` 이름으로 stdin을 흘려 면제하지 않은 `color-no-hex`는 잡히고 면제한 `media-feature-range-notation`은 통과함을 확인했다. `lint:css` 통과 자체가 7개 override 글롭이 모두 매칭됨을 증명한다(하나라도 빗나갔다면 그 파일의 잔여 위반이 드러난다). **FE-30 전 항목 완료**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| FE-32 |  ✅ 완료  | 테스트 | `createNuxtFetchFake` 성공 반복 시 동일 참조 재대입 — **2026-08-07 완료**              | `tests/support/nuxtAsyncData.ts:307`(`data.value = result as T \| undefined;`, `useFetch` 성공 분기)에서 `result`는 `control.value`를 그대로 참조한다. 테스트가 `control.value`를 바꾸지 않은 채 같은 대역으로 성공을 2회 이상 재현하면 `data.value`에 **동일한 객체 참조**가 재대입돼 `shallowRef`가 변경을 감지하지 못한다. 실제 Nuxt/ofetch는 매 응답을 새 객체로 파싱하므로 이 지점은 대역의 충실도 공백이다(2026-07-31 통합 리뷰 그룹 ③ 수정 중 실측, `it_frontend/.superpowers/sdd/integration-fix-B-report.md` 우려사항 C-1). 재현 조건: 같은 `createNuxtFetchFake` 인스턴스로 성공 실행을 2회 이상 일으키고 두 번째 실행에서 `data.value` 갱신(참조 변경 또는 watcher 트리거)을 관측하는 테스트. `useCostPersistence.test.ts`의 취소 복원 테스트와 admin/menus 트리 재조회 성공 케이스는 이미 `control.value`를 새 배열로 갈아 끼우는 방식으로 우회했다. 검증된 공유 대역(별도 리뷰가 "충실도 높음"으로 판정)이라 이번 범위에서 수정하지 않았다 — 고치려면 성공 경로에서 `structuredClone`/얕은 복사로 새 객체를 반환하도록 바꾸되 전 파일 영향(실패 경로의 보존 참조 동일성 단언 포함) 검토가 선행돼야 한다. **2026-08-07 완료**(`it_frontend` `9890e79`). **착수 전 영향 조사**: `control.value`를 제자리 변형(`push`/`splice`/속성 대입)하는 테스트 **0건**이고 전부 재대입(10곳)이라 안전했다. `data.value`에 대한 참조 동일성 단언도 **0건**이었다. `freshResponse()`로 성공 응답을 매번 새 객체로 만든다. **얕은 복사만 한다** — `shallowRef` 트리거에는 최상위 참조만 새로우면 충분하고 깊은 복사는 중첩 객체의 참조 동일성을 깨 멀쩡한 단언을 무너뜨린다. 배열·평범한 객체만 대상이며 원시값·`null`·`Date`·클래스 인스턴스는 그대로 둔다. **RED 확인**: `freshResponse`를 되돌리면 `data` 워처가 한 번도 돌지 않아(관측 배열이 빈 채) 실패한다. 기존 우회(`useCostPersistence` 취소 복원, `admin/menus` 트리 재조회가 `control.value`를 새 배열로 갈아 끼우던 것)는 이제 없어도 되지만 명시적이라 해롭지 않고 건드리면 무관한 회귀 위험만 생기므로 **그대로 뒀다**|
| BE-27 |    ✅ Done    | 테스트 | ~~Oracle IT 공유 조직 fixture(`"120"`) 격리~~ **2026-08-06 완료**  | `OrganizationNameProjectionIt`·`UserReadProjectionIt`·`CommitteeUserProjectionIt`가 같은 조직코드 `"120"` 행을 각자 upsert/변형해 공유한다. 현재 순차 실행에서는 안전하나 Gradle 병렬 테스트 도입 시 경합 위험 — 클래스별 접두사 코드로 격리 검토(2026-07-27 BE-03 리뷰 지적). **정정**: 위 서술의 "각자 upsert/변형해 공유한다"는 메커니즘은 사실이 아니다. `AbstractOracleRepositoryTest`는 `@DataJpaTest`의 기본 트랜잭션 롤백을 쓰므로 픽스처가 테스트 메서드 밖으로 남지 않는다. 실제 위험은 상태 공유가 아니라 **병렬 실행 시 같은 PK를 동시 INSERT하는 잠금 경합·중복키 경쟁**이다. **조치**: ① 조직코드를 클래스별로 분리했다(`UserReadProjectionIt`=`Z71`, `CommitteeUserProjectionIt`=`Z72`, `OrganizationNameProjectionIt`은 `120` 유지 — 더 이상 어느 둘도 겹치지 않는다). `BBR_C`가 `VARCHAR2(3)`이라 긴 접두사를 쓸 수 없어 3자 코드를 나눠 썼다. ② **조직코드보다 큰 경합이 사번에 있었다** — `UserReadProjectionIt`과 `CommitteeUserProjectionIt`이 `BE03001`·`BE03002`를 둘 다 INSERT하고 있어 후자의 사번 접두를 `BE27CU`로 분리했다. ③ `UserReadProjectionIt`이 `ORG_CODE` 상수를 두고도 한 곳에서 `"120"` 리터럴을 단언하던 잠재 결함을 상수 참조로 고쳤다. 검증: 로컬 Oracle에서 `./gradlew integrationTest --tests '*ProjectionIt'` BUILD SUCCESSFUL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| BE-19 |   ✅ 완료    | 검증  | ~~`ProjectDto.CreateRequest.abusTc`에 `@NotBlank` 추가 검토~~ **2026-08-08 완료** | `it_backend/src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java:217`에 검증 어노테이션이 없어 의미상 누락된 사업구분 값이 서비스 계층에서 `CodeDefaults.orNotApplicable()`로 조용히 `'0'`(해당없음)으로 보정된다(`ProjectDto.java:272`). 누락과 고의적인 '해당없음' 선택을 구분하려면 입력 단계 검증이 필요하다. **재조사(2026-08-08) — 전제가 실데이터로 확인되지 않는다.** 로컬 `TPRMPP_BPROJM`(미삭제 21건)의 `ABUS_TC` 분포는 **`'10'` 20건 · `'20'` 1건**이고 **`'0'`(해당없음)은 0건**이다. 즉 "누락값이 `CodeDefaults.orNotApplicable()`로 조용히 `'0'`이 된다"는 상황이 실제로는 발생하지 않았다 — 값이 어딘가에서 정상적으로 채워지고 있다는 뜻이므로 `@NotBlank`를 붙이기 전에 **그 경로가 어디인지부터 밝혀야 한다**(사업 폼이 아닌 다른 생성 경로이거나 시드 데이터일 수 있다). **부수 발견**: `abusTc`는 프론트에 존재하되 **전산업무비 도메인에만** 있다(`CostFormTableSection.vue`·`PrevYearCostPickerDialog.vue`·`TerminalFormDialog.vue`·`useCostCarryOver.ts` 등). 사업 폼에 없다는 원 기록은 그대로 맞다. 다만 **두 도메인이 같은 컬럼명에 다른 값 집합을 쓴다** — `BCOSTM`은 신규 `'01'`/계속 `'02'`(`useCostEditingState.ts:123` 주석), `BPROJM`은 `'10'`/`'20'`이다. 사업의 `ABUS_TC` 의미와 유효 코드셋을 먼저 확정해야 한다. **추가 착수 제약**: `app/pages/info/projects/form.vue`는 **1266줄이고 CQ-15 기준값도 정확히 1266**이라 선택 UI를 넣으면 그만큼 다른 줄을 줄여 상쇄해야 ratchet(`toBe`)이 깨지지 않는다. 폼 필드 하나가 8~15줄이라 부담이 작지 않다. **2026-08-08 완료**(`it_backend` `03e952be`). **업무 확정(사용자)**: 사업구분은 **필수**이고 유효값은 신규 `'10'`·계속 `'20'`이다. 공통코드 `ABUS_TC`에는 `'0'`(해당없음)도 있으나 사업 도메인의 유효값이 아니므로 **`@NotBlank`만으로는 부족**하고 `@Pattern(regexp = "10|20")`으로 값 집합도 강제한다. **선행 조건은 실재하지 않았다** — 원 기록의 "`projects/form.vue`에 `abusTc` 바인딩이 아예 없다"는 페이지 파일만 grep한 결과였고, 매핑은 CQ-15 분해로 추출된 **`useProjectFormSave.ts:178`(`abusTc: f.pulDtt`)** 에 있다. 폼은 이미 `useCodeOptions('ABUS_TC')`로 코드를 로드해 `projectBusinessTypeOptions`로 **신규·계속만** 노출하고 `projectFormModel.ts`의 기본값이 `'10'`이라, 검증을 걸어도 기존 등록 흐름이 깨지지 않는다(위 재조사의 데이터 분포와도 일치한다). 따라서 프론트 선행 배포가 필요 없었다. **생성·수정 양쪽에 적용**했다 — 프론트가 같은 payload 빌더를 쓰므로 생성에만 걸면 수정으로 값을 비우거나 `'0'`으로 되돌릴 수 있는 구멍이 남는다. **줄 수 상쇄**: `ProjectDto.java`가 CQ-15 기준선 1070이라 검증 추가분(+5)을 **`@Schema` description과 글자까지 같은 중복 JavaDoc 5개 제거**로 상쇄했다(`시작일자`·`종료일자`·`주관부서담당팀장`·`IT부서담당팀장`·`주관본부/부문`). 정보 손실이 없고 `it_backend/CLAUDE.md` §9의 "설명 가치가 없는 주석은 두지 않는다"에 부합하며 1070 유지를 실측 확인했다. **테스트**: 기존 정상 경로 2건에 유효값을 채우고(생성 `'10'`·수정 `'20'`으로 두 값을 모두 덮는다) 검증 케이스 2건을 추가했다 — 누락 시 400, `'0'` 전송 시 400. **RED 확인**: `@Pattern`을 빼면 `'0'` 케이스만 실패하고 누락 케이스는 `@NotBlank`로 계속 통과한다. 검증: `./gradlew check` BUILD SUCCESSFUL. **선행 조건(2026-08-07 확인)**: 한 줄 어노테이션 추가로 끝나지 않는다 — `app/pages/info/projects/form.vue`에 **`abusTc` 바인딩이 아예 없다**(`grep -rn "abusTc" app/pages/info/projects/` 결과가 `index.vue`의 표시용 2곳뿐). 지금 `@NotBlank`를 붙이면 현재 프론트의 사업 등록이 전부 400으로 실패한다. 순서: ① 사업 등록 폼에 사업구분 입력 추가 ② 백엔드 `@NotBlank` ③ `CodeDefaults.orNotApplicable()` 폴백 유지 여부 결정.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| BE-20 |   ✅ 완료    | DB  | ~~`TPRMPP_CINFMM.INFM_SD_STS_C` 운영 DEFAULT `'10'`이 앱 코드셋에 없음~~ **2026-08-08 완료** | 운영 컬럼 DEFAULT는 `'10'`이나 앱이 실제 쓰는 코드셋은 `Cinfmm.DISPATCH_PENDING`/`SENT`/`FAILED`(01/02/03)뿐이라 DEFAULT가 사실상 도달 불가능한 값이다. 운영과 앱 코드셋의 정합성을 DBA와 함께 확인해야 한다. **2026-08-08 완료**(`it_database` `81804c2`). **정본 결정(사용자)**: 앱 코드셋을 정본으로 한다 — 발송상태를 읽고 쓰는 주체가 애플리케이션뿐이고(`NotificationDispatcherRouter`·재시도 스케줄러), 운영 코드셋에 `'10'`을 추가하는 반대 방향은 `Cinfmm.DISPATCH_*` 상수와 라우터 분기를 함께 넓혀야 해 변경 범위가 훨씬 크다. **조치**: `V20260808_001__AlignCinfmmDispatchStatusDefault.sql`로 컬럼 DEFAULT를 `'10'` → `'01'`(발송대기)로 정렬했다. `V20260724_002`가 기존 NULL 행을 `'01'`로 backfill하면서도 DEFAULT는 운영과 같은 `'10'`으로 둬 값과 기본값이 어긋나 있던 것을 맞춘 것이다. **현재 동작 영향 없음** — 앱이 모든 INSERT에서 값을 명시해 DEFAULT가 적용되는 경로가 없다. DB만 보고 값을 넣는 경로가 나중에 생겼을 때 도달 불가능한 코드가 들어가는 것을 막는 예방 조치다. 데이터 행은 건드리지 않았다. **검증**: 로컬 Oracle에서 `'10'` → `'01'` 적용 확인, 재실행해도 건너뛰어 멱등성 확인(exit 0).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| BE-22 |     ✅ 완료     | 운영  | ~~dev/prod 마이그레이션 적용 전 DBA 인계 노트~~ **2026-08-08 완료**       | **2026-08-08 완료**(`it_database` `38509ed`). `it_database/docs/operations/2026-07-24-migration-handover.md`를 신설하고 `README.MD` §2.3에 링크했다(운영 문서 디렉터리가 없어 `docs/operations/`도 함께 신설). 스크립트 실물을 읽어 아래 원 기록 (a)(b)(c) 외에 **세 가지를 추가로 확인해 담았다**: ① `align_nullable`의 `SELECT ... INTO`는 대상 컬럼이 없으면 `NO_DATA_FOUND`로 죽으므로 dev/prod 스키마 불일치가 이 지점에서 마이그레이션을 멈춘다(사전 확인 쿼리 22행 기대) ② `V20260724_001`은 컬럼 순서 재배치를 `INVISIBLE`→`VISIBLE`로 처리해 두 테이블에 **총 60회의 `ALTER TABLE`**이 순차 실행된다 ③ backfill 직후 명시적 `COMMIT`이 있어 PK 단계에서 실패하면 backfill만 커밋된 상태가 남는다(전 단계가 멱등이라 재적용은 안전). 부록으로 BE-20(`INFM_SD_STS_C` DEFAULT 불일치)과 BE-28(`%04d` 시퀀스 9,999 상한 감시 쿼리)을 같은 문서에 넣어 운영 인계 창구를 하나로 모았다 — **두 항목의 해소 자체는 각 항목에서 계속 추적한다**. 원 기록: (a) `V20260724_001`의 `TPRMPP_BESTTM` PK DROP/ADD는 기존 PK가 이미 올바르더라도 무조건 재생성해 유지보수 창에서 비용이 발생한다. (b) `V20260724_002` 적용 전 `TPRMPP_BBIZCM`/`TPRMPP_BBIZCL`.`NOW_CTT_MANR_C` NULL 건수를 반드시 사전 확인해야 한다 — 있으면 RAISE_APPLICATION_ERROR 가드가 마이그레이션 전체를 중단시킨다. 가드에 의해 중단된 경우 Flyway가 실패 시도를 이력에 남겼을 수 있으므로 재적용 전 `flyway repair`가 필요할 수 있다. NULL을 채운 뒤 재실행하는 것은 안전하다 — backfill은 `WHERE ... IS NULL` 조건의 멱등 갱신이고 두 `ALTER ... DEFAULT` 문도 멱등이며, `align_nullable`은 `ALL_TAB_COLUMNS.NULLABLE`을 먼저 확인한 뒤에만 변경한다. (c) `*L` 변경로그 테이블의 backfill은 "당시 값 없음"을 코드값으로 덮어쓰는 이력 변경이므로 감사 이력 관점의 사전 공지가 필요하다.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| BE-33 |   ✅ 완료    | 정책  | ~~`ProjectService`의 사업 '대표상태'가 다른 단계 문서에 가려짐~~ **2026-08-08 완료**                 | 2026-08-03 `GET /api/council` 0건 조사에서 발견한 인접 결함. `ProjectService.representativeStatus`(1372~1379행)가 한 사업의 BPROJA 행 전체에서 `IT_PTL_STS_TC` 최댓값을 대표상태로 채택하고 목록 응답에 주입한다(1129~1136행). 그러나 BPROJA는 `(ABUS_MNG_NO, CNCD_RFR_NO)` 단위 **단계 문서별** 상태 테이블이라 사업 자신의 상태는 `CNCD_RFR_NO = ABUS_MNG_NO`인 행뿐이고, 나머지는 상위 계획(`PLN-...`)·사업계획(`BIZ-...`) 등 다른 문서의 상태다. 2026-08-03 로컬 기준 21개 사업 전부가 자신의 행은 `'09'`인데 상위 계획 행 `'11'`을 함께 갖고 있어 대표상태가 전부 `'11'`(정보기술부문계획 정실협 진행중)로 계산된다 — 사업 자신의 단계와 무관한 값이 목록에 표시된다. 협의회 목록(`CouncilRepository`)은 같은 원인으로 0건이었고 사업 자신의 행만 조인하도록 고쳤으나, 이쪽은 "대표상태"의 업무 정의(사업 자신의 단계인가, 관련 문서 중 가장 진척된 단계인가)를 먼저 확정해야 해 이번 범위에서 제외했다. 정의 확정 후 Oracle 통합 테스트로 다른 단계 문서가 섞여도 값이 흔들리지 않음을 검증한다. **2026-08-08 완료**(`it_backend` `b75a1d18`). **업무 정의 확정(사용자)**: 대표상태 = **사업 자신의 단계**, 즉 `CNCD_RFR_NO = ABUS_MNG_NO`인 행의 `IT_PTL_STS_TC`. 협의회 목록을 같은 원인으로 고친 것과 같은 방향이다. **착수 시 좌표 드리프트**: 기록된 `ProjectService`(1372~1379행)는 CQ-01 분해로 사라졌다 — 실제 위치는 `ProjectQueryAssembler.representativeStatus`이고 `ProjectService.java`는 670줄이다. **조치 범위가 기록보다 넓었다** — 표시값 2곳(`ProjectQueryAssembler:109` 상세, `ProjectBatchAssembler:287` 목록 배치) 외에 **목록 상태 필터**(`ProjectRepositoryImpl`)도 같은 MAX 방식이라 그대로 두면 화면에 보이는 값과 필터 결과가 어긋난다. 셋 다 자기 행 기준으로 맞췄고, 자기 행은 사업당 하나라 "이 행이 최댓값인가"를 확인하던 `bprojaMax` 서브쿼리가 통째로 불필요해져 필터가 단순해졌다. `bprojaStsCodes`는 단계 문서 상태를 **모두** 나열하는 별개 필드라 종전대로 둔다(화면의 탭 활성 조건이 쓴다). **테스트**: 기존 3건이 결함 동작(전체 MAX)을 고정하고 있어 새 규칙으로 다시 썼다 — 그중 `ProjectServiceCoverageTest`의 픽스처(자기 행 `'01'` + 심의 문서 `'09'`)가 BE-33 시나리오 그 자체라 기대값만 뒤집어 회귀 테스트가 됐고, "자기 행이 없으면 null" 경계 케이스가 새로 생겼다. `전체null` 케이스는 `cncdRfrNo`가 자기 행이 아니어서 새 규칙에서 **잘못된 이유로 통과**하고 있었으므로 자기 행으로 바꿔 원래 의도(null 필터)를 실제로 검증하게 했다. **RED 확인**: 자기행 필터를 빼면 3건이 실패한다. 검증: `./gradlew check` BUILD SUCCESSFUL. **Oracle 통합 테스트 추가 완료**(`it_backend` `70b83f6d`): 원 기록이 요구한 "다른 단계 문서가 섞여도 값이 흔들리지 않음" 검증을 `ProjectStatusFilterIt` 4건으로 고정했다. 기존 `ProjectListProjectionIt`은 경량 프로젝션의 필드 동등성만 보고 `stsTc`·`Bproja`를 전혀 다루지 않아 이 경로가 통합 수준에서 무방비였다 — 같은 결함 부류를 이미 검증하는 `CouncilProjectStatusFilterIt`의 구조를 따랐다. 케이스: ① 자신의 상태(`'09'`)로 검색하면 잡힌다 ② 상위 계획 행의 상태(`'11'`)로 검색하면 잡히지 않는다(종전에는 정확히 반대였다) ③ `searchByCondition`·`searchListByCondition`·`countBySearchCondition`이 같은 WHERE를 공유해 결과가 일치한다 ④ 자신의 행이 없으면 어느 상태로도 잡히지 않는다. **RED 확인**: `cncdRfrNo` 조건을 빼면 4건 중 3건이 실패한다. 검증: `./gradlew check` + `integrationTest` BUILD SUCCESSFUL(통합 47개 클래스, 실패 0).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| CQ-19 |  ✅ 완료   | 리팩터링  | ~~`Btermm.update`의 15개 위치 인자를 명시적 명령 객체로 전환할지 판단~~ **2026-08-08 완료** | CQ-06 크로스체크에서 별도 패턴으로 확인했다. **2026-08-08 완료**(`it_backend` `645960c9`). **착수 시 재조사**: 기록된 좌표가 드리프트해 있었다 — `CostService.java:383` → **285**, `CostServiceTest.java:832` → **853**(CQ-01 서비스 분해 여파). 소비처는 여전히 production 1곳 + 테스트 1곳뿐이라 저비용이 유지됐다. **조치**: CQ-06이 같은 도메인에 남긴 `Bcostm.UpdateCommand` 선례(`@Builder record` + `Objects.requireNonNull`)를 그대로 따랐고, `dfrCleC`의 `CodeDefaults.orNotApplicable()` 보정은 위치를 유지해 동작이 같다. `CostService`에 `toTerminalUpdateCommand`를 추출했다(기존 `toUpdateCommand`와 같은 자리). 테스트의 `any()` 15개 `verify`는 `ArgumentCaptor`로 바꿔 **호출 여부만이 아니라 전달값까지** 확인한다. 신규 `BtermmUpdateCommandTest`가 전 필드 매핑과 null 명령 거부를 고정한다. **RED 확인**: `termSvnTemC`/`termSvnDpmC` 대입을 뒤바꾸면 실패한다 — 둘 다 `String`이라 위치 인자 시절에는 컴파일러가 잡지 못하던 결함 부류다. 검증: `./gradlew check` BUILD SUCCESSFUL. 계획: `docs/superpowers/plans/2026-08-08-task-quickfix-batch3.md` |
| CQ-23 | ✅ Done | 게이트 | ~~품질 게이트 3종이 HEAD에서 이미 실패 중~~ **2026-08-06 발견·해소** | ERR-15 조치 중 사전 상태를 확인하다 발견했다. 셋 다 이번 변경과 무관하며 `git stash`로 HEAD를 재현해 확인했다. ① **CQ-15 ratchet 실패** — `app/pages/info/council-request/index.vue`가 **876줄**인데 `scripts/max-lines-baselines.mjs` 기준선에 없다. 800줄 상한을 넘긴 채 등재도 분해도 되지 않아 `npm test`가 빨간 상태다. 기준선 신규 등재는 게이트 범위를 줄이는 금지 방향이므로 **분해가 정답**이다(CQ-15 본 항목으로 흡수 검토). ② **`npm run format:check` 실패** — `app/components/council/result/CouncilAttachments.vue`에 Prettier 위반이 커밋돼 있다. `npx prettier --write` 1회로 해소된다. ③ **`PlanCouncilTargets.test.ts` 5건 실패** — `ReferenceError: useCodeOptions is not defined`. 테스트 환경에서 자동 import 심볼이 해석되지 않는 문제로, CQ-15에 기록된 nuxt 4.4.8 → 4.5.2 업그레이드 여파(자동 import 심볼 누락)와 같은 부류로 보인다. 해당 테스트에 `useCodeOptions` 스텁을 주입하거나 명시 import로 전환해야 한다. **왜 High인가**: 게이트가 상시 빨간 상태면 새로 들어온 회귀와 기존 실패를 구분할 수 없어 게이트가 사실상 무력화된다. **조치(2026-08-06)**: ① 페이지를 **876 → 786줄**로 분해했다. 기준선 등재 대신 `app/features/council/request/` 아래로 두 모듈을 분리했고(`council-list-filter` = 필터·정렬·점진 노출, `council-plan-stats` = 계획협의회 카드 통계), 같은 디렉터리의 기존 `council-list-presentation.ts`와 짝을 이룬다. 옮기는 김에 그동안 무테스트였던 규칙 15건을 고정했다(필터 AND 결합, applied → dbrTc 안정 정렬, 상태 옵션 null 제외, 예산 `prjBg>0` 폴백의 항목별 판정, 기수신 id 재조회 방지, 한 건 실패 시 나머지 카드 유지). 부수로 타입 위치에서만 쓰이던 `(typeof filteredCouncils.value)[0]` 9곳을 `CouncilListItem`으로 정리했다. ② `prettier --write` 1회로 해소. ③ `useCouncil`에 이미 쓰던 `stubGlobal` 패턴대로 `useCodeOptions` 스텁을 추가하되, `getCodeName`의 실제 계약(빈값 `'-'`, 미등록 시 원본 코드)을 그대로 재현했다 — 대역이 실제와 다르면 컴포넌트의 `pulDttLabel` 분기가 대역 때문에 갈려 배너 단언까지 흔들린다. **결과: 게이트 3종 전부 초록** (`npm run check`·`format:check` 통과, `npm test` 201파일 2405건 전건 통과). **참고**: 조사 중 `scripts-lint.test.ts`와 `refresh-banner-visibility.test.ts`가 전체 병렬 실행에서만 간헐 실패하는 것을 봤다(단독 실행은 통과, ESLint를 띄우는 무거운 테스트와 경합). 최종 전체 실행은 전건 통과했으나 부하가 늘면 재발할 수 있다 |
| CQ-24 | ✅ Done | 게이트 | ~~`it_backend` 작업트리에 미커밋 변경 4건 — 그중 max-lines 상한 완화~~ **2026-08-07 완료** | BE-27 조치 중 `git status`에서 확인했다. 변경 4건: ① `MaxLinesRatchetTest.java`의 `LIMIT`이 **800 → 850으로 상향**(안내 문구 3곳 포함) ② `CouncilServiceTest.startPreparation` 계약이 "결재완료 아니면 거부"에서 "이미 개최준비면 멱등 유지"로 변경 ③④ `oss/maven-repo-manifest.txt`·`maven-repo-manifest-pom-only.txt` 각 166줄 삭제. **상태 정정(2026-08-07)**: 이 4건은 미커밋이 아니라 `관리자 메뉴 개선` 커밋(backend `4e28ee7e`)에 **판단 없이 그대로 실려 main에 들어가** 있었다 — 항목 성격이 "커밋 여부 판단"에서 "커밋된 게이트 완화 되돌리기"로 바뀌었다. **조치**: ① 상한을 **800으로 복귀**했다. 완화의 실제 수혜자는 기준선에 없던 `CouncilService.java`(**821줄**)로 LIMIT 800이면 즉시 실패한다 — 기준선 신규 등재는 금지 방향이라 분해로 해소했다. 순수 DTO 조립 2건을 `CouncilResponseMapper`(신규 106줄, static 전용)로 분리하고 리포지토리 조회는 서비스에 남겼으며, 목록 제목 해석을 `resolveListTitle`로 추출해 **821 → 770줄**(상한까지 30줄 여유). 안내 문구 3곳과 게이트 자체 검증 케이스(`851` → `801`)도 함께 복원해 코드와 기준선 properties 주석("800줄")의 불일치를 없앴다. ② 테스트 계약 변경은 **정당했다** — production `CouncilService.startPreparation`이 이미 `PREPARATION_OR_LATER_STATUSES`(05~13)에서 멱등 반환하도록 구현돼 있어 구 테스트가 실제 계약을 검증하지 못하는 상태였다. 그 커밋에 딸린 완전수식 `org.assertj.core.api.Assertions.assertThatCode`만 static import로 정리했다. ③④ manifest 삭제는 되돌리지 않았다. 검증: `./gradlew check` BUILD SUCCESSFUL. 계획: `docs/superpowers/plans/2026-08-07-task-quickfix-batch2.md` |


### ✅ 2026-08-06 잔여과제 저비용 배치 1 (ERR-14·BE-34·FE-21·FE-30①)

> 설계 `docs/superpowers/specs/2026-08-06-task-quickfix-batch1-design.md`, 실행 계획 `docs/superpowers/plans/2026-08-06-task-quickfix-batch1.md`을 실행했다. 세 항목이 계획이 상정한 것과 다른 결말을 맞았다 — **ERR-14는 고친 것이 아니라 이미 해소돼 있었고 `TASK.md`의 근거가 낡아 있었다.** **BE-34는 증상 자체가 재현되지 않아 재현 불가로 종결했다**(애노테이션은 유지하되 원인 해결로 단정하지 않는다). **FE-30①은 계획이 상정한 명시 `key` 분리가 불필요한 것으로 드러났다.**
>
> 최종 검증: `npm run format:check`·`npm run lint`·`npm run typecheck`(0 errors)·`npm run codegen:check` 통과, 프론트 단위 테스트 **2374/2374(195파일)** 통과, `./gradlew check` 통과(2589 tests, JaCoCo 97%/88%). `npm run test:e2e`는 계획대로 실행하지 않았다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✔️ Resolved | ERR-14 | **재현 불가(분기 A)로 종결** — 고친 것이 아니라 이미 해소돼 있었다. `useApiFetchRefreshCoordinator.ts:45-57`의 `phase === 'retrying' → terminateCycle` 경로가 이미 401 재조회 루프를 끊는다: 401 → 갱신 성공 → 재조회 → 401이 오면 새 주기를 열지 않고 세션을 종료한다. **`TASK.md`의 근거가 낡아 있었다** — 지목했던 `useApiFetch.ts`의 `isRefreshing`·`tokenRefreshSignal`은 저장소에 더 이상 존재하지 않는다(401 처리가 그 사이 코디네이터로 분리됨). 회귀 방지로 특성화 테스트 3건을 추가하고 그 분기가 의도된 상한임을 코드 주석으로 고정했다 | it_frontend `ad2fa0b`, `c977de3` | `tests/unit/composables/useApiFetchRefreshCoordinator.test.ts` 신규 3건 통과. 리뷰어가 독립 추적으로 vacuous가 아님을 확인 — 재시도 파동이 부른 401이 같은 주기의 'retrying' phase를 만나 `refresh` 1회 / `terminateSession` 1회로 종료하는 경로를 테스트가 실제로 지난다 |
| ✔️ Resolved | BE-34 | **재현 불가로 종결(사용자 결정).** 실행 중이던 백엔드(IDE 산출물 `bin\main`, `@ParameterObject` 미적용)와 `./gradlew bootRun`으로 띄운 백엔드(적용, 포트 28081) 두 스펙을 파라미터명·개수까지 비교한 결과 완전히 동일했고 양쪽 모두 `arg0`이 **0건**이었다. 6개 오퍼레이션 전부 실제 필드명으로 전개된다(예: `getProjects` → `apfSts, bseYy, stsTc, bzTpC, dvmDpmC, svnDpmC, odnYn`). 커밋돼 있던 `api.d.ts`의 파라미터명도 `arg0`이 아니라 `condition`이었다 — 래퍼 객체 참조였을 뿐이다. 통제군·처치군이 동일하므로 **`@ParameterObject` 애노테이션이 정상화의 원인이 아니다** — 근본 원인(CGLIB 프록시 여부)은 **미확인**으로 남는다 — 증상 자체가 재현되지 않아 원인 조사를 수행하지 않았다. 계획이 적어둔 actuator `beans` 확인은 **시도하지 않았다**(기본 노출 설정이 `management.endpoints.web.exposure.include=health,metrics`라 그 엔드포인트는 열려 있지 않다). 다시 `arg0`이 관측되면 이 실측이 재관측의 출발점이다. `@ParameterObject` 6곳은 springdoc이 POJO 쿼리 파라미터에 권장하는 명시적 선언이고 바인딩 불변·테스트 통과로 무해해 **유지**한다(사용자 결정, 원인 해결이라 단정하지 않음) | it_backend `d7f924e2` (부수 성과: `api.d.ts` 재생성 it_frontend `35d7c85`) | 컨트롤러 6개 지점 전부 `@ParameterObject` 적용 확인, `@ModelAttribute`·`@PageableDefault` 속성 보존, `./gradlew test` 대상 컨트롤러 테스트 58건 통과. 두 백엔드 인스턴스(28080 IDE 기동·28081 `bootRun`)의 `/v3/api-docs` 비교로 `arg0` 0건·완전 동일 실측. `api.d.ts` 재생성으로 paths 160 불변, schemas 234 → **229**(래퍼 DTO 5개 제거: `ProjectSearchCondition`·`FileDto.SearchCondition`·`CostSearchCondition`·`BoardPostSearchCondition`·`Pageable`), 소비처 영향 0(`npm run check` clean) |
| ✅ Done | FE-21 | `useMentionAutocomplete.ts`·`useGlobalSearch.ts` 두 곳에 요청 시퀀스 토큰을 도입했다. 토큰을 요청 시작 전에 캡처하고 모든 `await` 이후 비교한다. `items`/`suggestions`뿐 아니라 `searchLoading`·`searchError`, `close()`까지 판정 대상으로 포함했다. `GlobalSearchBar.vue`에 디바운스는 **추가하지 않았다** — 가드로 경합이 사라지고, 디바운스는 입력 반응성에 영향을 주는 별개 결정이라 분리했다. 같은 가드의 순서 역전 검증 테스트 공백이던 FE-28②가 함께 소진됐다 | it_frontend `8905cc5`, `082a251`, `f8c6f2d` | `useMentionAutocomplete.test.ts`·`useGlobalSearch.test.ts` 전량 통과. 리뷰어가 `items`(154-156)·`searchLoading`(finally 164)·`searchError`(catch 159-161)·`close()`(238) 네 지점 전부 확인. 변이 검증: 낡은 응답이 최신 요청 진행 중 도착하는 신규 테스트에서 가드 제거 시 해당 테스트만 실패, 나머지는 통과 |

> **FE-30①(참고, ID는 `TASK.md`에 존속)**: `useApprovalDashboard`·`useDocumentDashboard` 두 파사드가 `useApiFetch` 반환 필드 7개(`data`·`pending`·`error`·`status`·`refresh`·`runWithErrorToastSuppressed`·`enableKeepPreviousData`)를 노출하도록 완료했다(it_frontend `989d48e`). **계획이 상정한 명시 `key` 분리는 불필요한 것으로 드러나 도입하지 않았다** — 두 URL의 소비처가 각각 1곳뿐이고(`approval/index.vue`, `info/documents/index.vue`) 사이드바 배지는 별도 엔드포인트를 써서 키 공유가 없다. FE-30 자체는 ②(FE-19 grandfather 규칙 단위 전환)가 남아 `TASK.md`에서 계속 추적한다.
>
> **병합 완료**: it_backend `feature/be34-openapi-parameter-names` → `main`(`b4f48109`), it_frontend `feature/task-quickfix-batch1` → `main`(`cb965a2`) 순서로 병합했다(4-repo 규약: 백엔드 계약 먼저). `versions.lock`은 `scripts/update-versions-lock.ps1`로 갱신했다.
>
> **이력 정리**: 프론트 브랜치에 섞여 있던 취약점 조치 커밋 2개(`78228cc` "취약점 조치", `f544e78` "불필요파일")를 매니페스트 변경만 남긴 단일 커밋(`915e32c`)으로 재작성했다. 원 커밋이 5.4MB 바이너리 `it_frontend.Egg`를 추가한 뒤 다음 커밋에서 지웠는데, 삭제 커밋이 있어도 추가 커밋의 블롭은 이력에 영구히 남기 때문이다. 재작성 후 트리가 원본과 완전히 동일함을 `git diff`로 확인했고(차이 0), `main` 이력에 해당 블롭이 없음을 확인했다. 두 브랜치 모두 원격에 푸시된 적이 없어 로컬 재작성으로 충분했다. 병합 후 `main`(`cb965a2`)의 트리가 재작성 전(`345bbc0`)과 완전히 동일함을 재확인한 뒤 백업 ref를 지우고 `git reflog expire --expire-unreachable=now --all` + `git gc --prune=now`로 블롭을 오브젝트 저장소에서 완전히 제거했다(원 커밋 `78228cc`는 더 이상 조회되지 않는다). **되돌릴 수 없다** — 내용은 `main`에 그대로 있고 사라진 것은 그 두 커밋 객체뿐이다. 재발 방지로 `.gitignore`에 `*.egg`·`*.alz`를 추가했다(`b5ab6e0`).
>
> **이 병합이 함께 들여온 의존성 변경**: `nanoid ^3.3.17` override와 그 여파의 **nuxt 4.4.8 → 4.5.2**. 4.5.2가 `<template>`의 자동 import 심볼을 컴포넌트 인스턴스 타입에서 제외해 깨진 typecheck 23곳(15개 page 파일)을 명시 import로 해소했고, Vitest에는 `#app` alias가 없어 호출 시점 전역 조회 shim(`tests/support/nuxtAppAlias.ts`)과 alias를 함께 뒀다.

### ✅ 2026-08-06 CQ-01 대형 서비스 분해·BE-30 결정론 보완

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | CQ-01 | `CouncilController` 분해에 이어 서비스 3개를 도메인 경계로 분리: `ProjectService` 1549→670 (`ProjectQueryService` 104, `ProjectQueryAssembler` 283), `CostService` 1159→351 (`CostQueryService` 96, `CostQueryAssembler` 527, `CostTerminalAssembler` 148), `BudgetWorkService` 1156→77 (`BudgetRateApplicationService` 263, `BudgetSummaryService` 355, `BudgetProjectSummaryService` 351, `BudgetIoeCatalog` 50). 신규 운영 소스는 모두 800줄 이하이며 ratchet 기준선은 `ProjectDto` 1070, `CouncilDto` 990, `AdminService` 866, `ApplicationService` 852, `CostDto` 801 다섯 개만 남았다. | backend `f80b5b8`, `c35945d`, `24e139e`, `659041a`, `19b0a90`, `4e491b1`, `15f09b33`; frontend `b014ec4`, `acf0d60` | backend `./gradlew check --rerun-tasks`: 2580 tests, 0 failure/error, 1 skipped. `./gradlew integrationTest --rerun-tasks`: 107 tests 중 103 pass, 4 skipped, 0 failure/error. 격리 포트 28083에서 OpenAPI paths 160/schemas 234 및 `npm run codegen:check` 통과. 두 프론트 생성 커밋은 선언 순서만 동기화했고 API 의미 변경은 없다. `npm run format:check`·`npm run check` 통과. |
| ✅ Done | BE-30 | 동일 표시명 그룹의 ioeC·편성률을 encounter order가 아니라 최신 대표행에서 함께 취하도록 고정했다. | backend `e206cf0` | 대표행의 `bgNo` 우선순위와 동일 행 값 연결을 서비스 계약 테스트로 검증했고, 전체 `integrationTest` 게이트도 통과했다. |

> **프론트 테스트 감내:** 전체 `npm test` 2282건 중 2277건 통과, 실패 5건은 CQ-01 이전부터 있던 범위 밖 항목으로 의도적으로 수정·마스킹하지 않았다(`admin/codes.vue` max-lines 1건, council-manager redirect 기대값 4건).
>
> **통합 게이트 정합화:** IAM 정확 계약 테스트의 `getPtCNm` 누락은 production CQ-01 범위 밖의 기존 assertion drift로, 별도 test-only 커밋 backend `d5221bab`에서 보정했다.
>
> **병합 후 정정(2026-08-06):** 위 "기준선 다섯 개" 서술은 병합 시점 기준 **네 개**다 — 같은 날 병렬로 진행된 BE-29(아래 절)가 공통코드 CRUD를 `AdminCodeService`로 추출해 `AdminService`를 866→581줄로 줄이면서 그 항목을 등재 해제했다. 현재 기준선은 `ProjectDto` 1070 · `CouncilDto` 990 · `ApplicationService` 852 · `CostDto` 801 네 개다.
>
> **`CouncilController` 분해의 스펙 영향 확인 완료(2026-08-06):** 분해 당시 "빈이 1개에서 7개가 되어 springdoc의 `paths` 순서가 달라질 수 있다"는 미확인 사항을 남겼는데, BE-31 작업에서 백엔드를 기동해 재생성한 결과 **`paths` 순서 변경은 0건**이었다. `codegen:check`도 드리프트 없음(paths 160 / schemas 234)으로 통과했다 — 이 분해로 인한 스펙 회귀는 없다.

### ✅ 2026-08-06 비-CQ 잔여과제 Quick Win (BE-26·BE-29·BE-31·FE-24·FE-33)

`TASK.md`에서 Clean Code 부채(CQ-\*)를 제외한 활성 항목을 전수 분류해, 설계 결정·DBA 협의·외부 의존 없이 코드로 끝낼 수 있는 것만 골라 상환했다. 계획·분류 근거는 `docs/superpowers/plans/2026-08-05-non-cq-quick-wins.md`.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | BE-29 | 공통코드 CRUD의 캐시 무효화 공백을 해소했다. `AdminService`의 코드 CRUD 5개(`getCodes`·`createCode`·`updateCode`·`deleteCode`·`bulkUpsertCodes`)와 private 헬퍼(`CodeKey`·`validateCodeKey`·`toCodeResponse`)를 신설 `AdminCodeService`(346줄)로 **순수 이동**하고, 쓰기 4개에 `CodeService.java:116-120`과 동일한 `@Caching(evict={budgetPeriod, codesByCid}, allEntries=true)`를 적용했다. `AdminController`는 배선만 바꿨고 URL·`@Operation`·`@PreAuthorize`·DTO는 불변이다. **애노테이션만 추가하는 최초 계획은 CQ-01 동결선과 충돌해 폐기했다** — `AdminService`가 866줄로 등재돼 있고 동결선은 실측과 기준값의 정확한 일치를 요구하므로 한 줄도 더할 수 없었다. 기준선 파일 11행이 "기준값 상향은 허용된 해소 수단이 아니다"라고 명시하고 8행이 "같은 PR에서 동등 이상 분량을 추출해 상쇄한다"를 지시하므로, 사용자 결정에 따라 추출로 상쇄했다. 결과적으로 `AdminService`가 866→**581줄**이 되어 800 이하로 내려가 **기준선 항목 자체를 삭제**했다(규약 9행). CQ-01의 "해당 도메인 기능 변경 착수 시 분해" 트리거 원칙과도 정합한다 | it_backend `699dbbb` | 이동 순수성을 기계적으로 재현 검증했다 — 이전 버전에서 공통코드 섹션을 추출해 `@Caching` 블록만 제거하고 diff한 결과 `EXIT:0`(애노테이션 외 한 글자도 다르지 않음). 리플렉션 회귀 테스트 `AdminCodeServiceCacheEvictTest`가 RED 4/4 → GREEN 4/4. 옮긴 테스트 10개가 1:1 대응하며 단언 내용 불변. self-invocation 없음 확인(`bulkUpsertCodes`가 다른 public 쓰기 메서드를 부르지 않아 프록시 우회 경로 없음). `common/admin` 전체에서 `Ccodem`/`CodeRepository` 참조가 `AdminCodeService`에만 남아 잔여 캐시 쓰기 경로 0건. `./gradlew clean test` + `jacocoTestCoverageVerification spotlessCheck` 모두 BUILD SUCCESSFUL, `MaxLinesRatchetTest` 6/6 통과. JaCoCo 클래스별 70% 규칙 때문에 테스트 4개를 추가했고, 그 과정에서 기존 `getCodes` 테스트가 `@DisplayName`이 약속한 이름 변환을 실제로는 단언하지 않던 것을 발견해 별도 테스트로 보강했다 |
| ✅ Done | BE-26 | `AdminService.getOrganizations`의 등록·변경자명 N+1을 제거했다. `toOrgResponse`가 행마다 단건 `resolveUserName(String)`을 호출하던 것을, 같은 클래스에 이미 있던 배치 헬퍼(`loadUserNameMap`/`resolveUserName(eno, map)`)를 써서 배치 조회 1회로 바꿨다. 같은 클래스의 로그인 이력 조회가 쓰던 모범형을 그대로 따랐다. **`TASK.md`가 우려하던 "동작 차이"는 실재하지 않았다** — 단건 경로의 `Optional.map(...).orElse(eno)`는 매핑 결과가 null이면 빈 Optional이 되어 `eno`를 돌려주므로, 배치 경로의 `getOrDefault(eno, eno)`와 결과가 같다. 이름이 null인 등록 사용자에 대해 신·구 경로가 동일하게 동작한다 | it_backend `b6f2c7b` | `getOrganizations_사용자명_배치조회_1회` 테스트가 RED(`WantedButNotInvoked` — 배치 메서드 미호출) → GREEN. `AdminDto.OrgResponse`의 record 필드 순서(`AdminDto.java:249-260`)와 새 `toOrgResponse`의 생성자 인자 순서를 1:1 대조해 완전 일치 확인(둘 다 String인 인자가 뒤바뀌어도 컴파일되므로 이 대조가 필수였다). `loadUserNameMap`이 빈 Set에 `Map.of()` 조기 반환하므로 조직 0건이면 쿼리 자체가 나가지 않음을 확인. `./gradlew check` BUILD SUCCESSFUL. `AdminService.java` 581→591줄(800 미만, ratchet 무관) |
| ✅ Done | BE-31 | 공통 첨부파일 API의 실제 파라미터는 `pkColNm`·`pkCone`인데 `GuideDocController`의 `@Operation(description=...)` 2곳이 레거시 `orcDtt`·`orcPkVl`로 안내하던 것을 정정하고, 프론트 생성 타입을 재생성했다. 이 문자열은 OpenAPI 스펙을 타고 `app/types/api.d.ts`에 실려 소비자가 잘못된 파라미터명을 따라 쓰게 했고, 실제로 `guide/index.vue`가 400을 받은 전례가 있다(2026-08-01 `fe5be3b`). 4-repo 규약대로 백엔드 계약 커밋 → 프론트 재생성 커밋 → `versions.lock` 순서로 처리했다 | it_backend `5a7b7b7` · it_frontend `4751211` · root `d2f7ff4` | 정정 전 `FileDto.SearchCondition`(L146·149·152)·`UpdateRequest`(L54·60)·`BulkDeleteRequest`(L127·133)와 `FileController`의 `@RequestPart("pkColNm")`/`("pkCone")`(L146-150)로 실제 파라미터명을 검증했다. 잔여 grep 결과 예산작업 도메인의 `orcPkVl`(BBUGTM 실제 필드명)과 화면의 지역 변수명만 남아 대상이 아님을 확인. `./gradlew check` BUILD SUCCESSFUL, `npm run codegen:check` 드리프트 없음(paths 160 / schemas 234), `npm run check` 클린. **CQ-01 후속 확인 동반 완료**: `CouncilController` 7분해로 인한 `paths` 순서 변경 0건 — 회귀 없음. 재생성 시 무관한 드리프트(객체형 쿼리 파라미터명 `arg0` 유실) 6건이 함께 드러나 `TASK.md` BE-34로 분리 등재했다 |
| ✅ Done | FE-24 | `admin/boards`가 재조회 보존을 잃었던 트레이드오프를 해소했다. `useBoard`가 키 없이 `${BASE}/boards/meta`를 열어 관리자 화면과 공개 게시판 화면이 같은 asyncData 키를 공유했고, Nuxt는 같은 키의 최초 인스턴스가 만든 `default`만 보관하므로 관리자 화면이 보존을 켜면 공개 화면까지 켜졌다. 그래서 ERR-13에서 `enableKeepPreviousData` 노출을 포기했고 관리자 화면은 재조회 실패 시 목록이 비었다. `useBoard(options?: { key?: string })`로 명시 키를 받아 `admin/boards`만 `'admin-board-meta'`를 열고 스위치를 노출했다. JSDoc 2곳(`useBoard.ts`·`admin/boards/index.vue`)의 비노출 사유 서술도 정정했다 | it_frontend `e04c4d6` · `80fe195` | RED(`expected '0' to be '1'` — 수정 전 재조회 실패 후 목록이 빔) → GREEN. **숨은 위험이던 `key: undefined` 동등성을 Nuxt 소스로 직접 확인**했다 — `node_modules/nuxt/dist/app/composables/fetch.js:74`가 `toValue(fetchOptions.key) \|\| "$f" + hash(...)`로 단순 속성 접근·`\|\|` 판정만 하므로 `'key' in options` 검사가 없고, 키 미전달과 `{ key: undefined }`가 같은 키를 만든다. 공개 화면 4개 호출부(`board/index.vue:13`·`[blbMngNo]/index.vue:24`·`form.vue:33`·`[nacMngNo]/index.vue:25`)가 전부 인자 없이 호출함을 확인. 기존 공개 화면 테스트가 그대로 통과. **회귀 가드 보강(`80fe195`)**: 최초 테스트 3개가 관리자 화면 단독 마운트로 "보존이 켜지는가"(증상)만 확인하고 "키 분리 유지"(원인)는 잡지 못하는 것을 리뷰가 지적해, 호출부 계약을 단언하는 가드를 추가했다. 두 화면 동시 마운트로 누출을 재현하는 방식은 테스트 대역(`tests/support/nuxtAsyncData.ts:228-244`)이 호출마다 독립 ref를 만들고 `options.key`를 실행 코드에서 읽지 않아 **구조적으로 불가능**함을 확인하고 근거를 테스트 주석에 남겼다 |
| ✅ Done | FE-33 | 게시판 첨부 업로드·삭제 성공 뒤의 목록 재조회가 가드의 `attemptRefresh`가 아니라 원시 `refresh()`를 호출해, 실패해도 `refreshFailed` 배너가 뜨지 않던 것을 고쳤다. 가드 생성 시점에 `enableKeepPreviousData()`가 켜져 있어 데이터는 보존됐지만 실패 판정은 `attemptRefresh`가 담당하므로, 사용자가 낡은 목록을 최신으로 오인하는 상태였다. `edit.vue`에 첨부 삭제 UI가 있어 실제로 밟히는 경로다. 두 호출부를 Class B 문구("쓰기는 반영되었고 목록만 못 불러왔다")와 함께 `attemptRefresh`로 전환하고, 미사용이 된 `refresh` 바인딩을 제거했다 | it_frontend `bf41a06` · `9e40218` | 삭제 경로 RED(`expected false to be true` — 배너 미렌더) → GREEN. `.message-stub`이 `edit.vue`의 첨부 배너(단일 `<Message v-if="attachmentsRefreshFailed">`)를 잡는 것이 맞고 게시물 본문 배너가 아님을 확인(거짓 통과 아님). `refresh` 바인딩 제거는 반환 객체에 노출된 적이 없고(`git show bf41a06^`로 확인) 소비처 의존도 0건이라 계약 무변경. **업로드 경로 가드 보강(`9e40218`)**: 두 호출부를 고쳤는데 배너 단언이 삭제 경로에만 있어 형제 호출부의 같은 회귀를 못 잡는다는 리뷰 지적에 따라, `uploadPendingFiles`를 실제로 호출하는(=`attemptRefresh`를 우회하지 않는) composable 단위 테스트를 추가했다. RED 확인 시 나머지 19개는 통과해 지적이 정확했음이 확인됐다 |

> **동반 문서 정정**: FE-24로 `it_frontend/CLAUDE.md` §2와 `docs/guides/architecture/api-client.md`의 "`useMenu`·`useBoard`는 스위치를 의도적으로 비노출" 서술이 사실과 달라져 정정했다(it_frontend `97f8f12`). 같은 문장이 `admin/menus`를 한 덩어리로 묶던 것도 갈랐다 — 그 화면에는 가드가 둘이고 사이드바(`useMenu`)는 보존이 꺼지지만 관리 트리(`fetchAdminTree`)는 켜진다.

> **미완료로 남긴 것**: FE-19(자동 수정분만 해소, `color-no-hex`·`selector-class-pattern` 잔여) · FE-22(옵션 도입 완료, 지점별 적용 잔여) · FE-30(③만 처리, ①② 결정 선행) — 셋 다 `TASK.md`에 잔여 범위를 명시해 남겼다. 실행 중 새로 등재한 것은 BE-34(OpenAPI 파라미터명 `arg0` 유실)다.

> **병합 시점에 확인한 두 가지**(2026-08-06):
> ① 실행 중 FE-34(프론트 `npm test` 선행 실패 2건 — `admin/codes.vue` max-lines 1건, council-manager redirect 4건)를 등재했으나, **병합 결과 194개 파일 2365개 테스트가 전부 통과**해 해소됐다. 이 브랜치는 해당 테스트도 대상 파일도 건드리지 않았으므로(`git diff main...HEAD`로 확인) 같은 기간 `main`에서 진행된 CQ-01 후속 작업이 함께 해소한 것이다. 그래서 `TASK.md`에서 FE-34를 제거했다.
> ② `api.d.ts`는 `main`도 병렬로 재생성해 병합에서 충돌했다. 생성물이므로 손으로 병합하지 않고 **병합된 백엔드를 기동해 `npm run codegen`으로 재생성**했다(`it_frontend` `30cfdca`). 재생성 결과는 `main` 대비 BE-31의 `@description` 2곳 정정과 스키마 프로퍼티 순서 noise뿐이었고 `codegen:check` 드리프트 없음으로 통과했다. **`arg0` 드리프트는 이 diff에 나타나지 않았다** — `main`이 이미 같은 상태였다는 뜻이며, BE-34가 이 브랜치와 무관한 선행 조건임이 재확인됐다.

### ✅ 2026-08-05 FE-31 admin/menus 관리 트리 가드 주석 정정

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | FE-31 | `app/pages/admin/menus/index.vue`(65~72행 → 76행)의 관리 트리 재조회 실패 가드 주석을 실제 동작에 맞춰 정정했다. 기존 주석은 "실패하면 `adminTree`가 undefined가 되어 좌측 편집 트리가 빈다"고 서술했으나, 실측 결과 `fetchAdminTree()`가 `useApiFetch` 반환 객체를 그대로 돌려주고 화면이 그것을 `useRefreshGuard`에 그대로 넘기므로(`useRefreshGuard.ts:204`) 가드 생성 시점에 `enableKeepPreviousData()`가 실제로 켜진다. 재조회 실패 시(401·403 제외) `adminTree`는 비지 않고 직전 정상값을 유지하므로 좌측 트리는 빈 트리가 아니라 낡은 값으로 남는다 — 정정한 주석은 이 사실과, 화면이 멀쩡해 보여 사용자가 낡은 값을 최신으로 오인하기 쉬우므로 배너가 오히려 더 중요하다는 점을 함께 서술한다. 주석 문구만 교체했고 동작 코드는 변경하지 않았다 | it_frontend `ec182bc` | `npm run format:check`·`npm run check`(typecheck+lint) 모두 클린 종료(오류 0건). 정정 전 `useAdminMenu.ts:38`의 `fetchAdminTree`가 `useApiFetch(...)`를 감싸지 않고 그대로 반환함과, `useRefreshGuard.ts:198,204`의 `keepPreviousData` 기본값 `true`·생성 시점 `enableKeepPreviousData()` 호출을 코드로 확인한 뒤 주석을 교체했다 |

### ✔️ 2026-08-01 Prettier 잔여 위반 해소 (CQ-20)

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✔️ Resolved | CQ-20 | ERR-13·FE-15~19 브랜치 이전부터 남아 있던 Prettier 포맷 드리프트 3개 파일(`app/composables/useAuth.ts`, `app/types/menu.ts`, `tests/unit/composables/useAdminMenu.test.ts`)이 별도 조치 없이 해소된 것을 확인했다 | — (별도 커밋 없이 해소 확인) | 2026-08-01 세 파일 모두 `npx prettier --check` 통과. 같은 시점 `npm run format:check`가 함께 보고한 2건(`useLatestRequest.test.ts`, `useProjectFormCodes.test.ts`)은 미커밋·미추적 작업 트리 파일이라 이 항목의 커밋된 부채가 아니었다 |

> **후속**: 2026-08-04 Wave B 실행 중 `app/pages/info/council-request/prepare/[id].vue`에서 같은 클래스의 드리프트가 **추가로** 발견돼 정리했다. 이 파일은 긴 줄이 풀리며 731→803줄로 실제 크기가 드러나 `TASK.md` CQ-15의 ratchet 기준선에 등록됐다(상세는 아래 Wave B·C 절).

### ✅ 2026-08-04 Clean Code Wave 3 Wave B·C (CQ-16 완료 / CQ-15 진행)

> 계획 `plans/done/2026-07-29-clean-code-wave3-wave-b-frontend-structure.md`, `…-wave-c1-hwpx-decomposition.md`, `…-wave-c3-composable-decomposition.md`를 실행했다. 대상은 `it_frontend` 단일 저장소이며 동작·UI·route·API·props/emits·CSS 선언은 변경하지 않았다.
>
> **계획서 수치는 실행 시점에 재실측했다.** cross-check commit은 frontend `937f5f9`였으나 실행 시점 HEAD는 `f11ef47`였고, 800줄 초과 운영 파일은 30개가 아니라 **31개**였다(`app/composables/useApiFetch.ts` 813 신규 초과, 다수 파일 증가). 생성물 `app/types/api.d.ts`(13,368줄)는 ESLint 전역 ignores 대상이라 제외했다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | CQ-16 | editor 14개 → `app/components/editor/`(+`extensions/`), layout 10개 → `app/components/layout/` 이동. 자동 등록에 의존하던 production 소비자 17곳에 명시적 import를 추가하고 기존 명시 import 4곳의 경로를 갱신했다. root에는 CQ-18 후보 4개만 남는다 | it_frontend `fe1bc56`(editor), `bb08ea3`(layout) | `component-boundaries.test.ts` 신규 2건이 두 디렉터리 구성과 root 잔여 4개를 고정. 이전 경로·자동등록 잔존 grep 0건. 전체 2216 테스트 통과, `check`·`format:check`·`lint:css` 클린 |
| 🔄 진행 | CQ-15 | 증가 불가 ratchet 도입(31개 기준선) 후 즉시 분해 4건 완료 — `utils/hwpx.ts` 1502→314, `composables/useCouncil.ts` 824→57, `composables/useTiptapTableTools.ts` 913→70, `components/editor/TiptapEditor.vue` 1329→781. 기준 항목 4개 삭제 | it_frontend `7ac70c3`(ratchet), `52868b6`·`c5d6fdc`(C-1), `d11091a`·`26049e1`·`9cb31ac`(C-3), `e97f870`(C-2 일부) | 공개 계약을 먼저 characterization test로 고정한 뒤 분해: HWPX runtime export 2개 + ZIP entry 10종, `useCouncil` 47 key, `useTiptapTableTools` 29 key. 분해 후 production consumer 변경 **0건**. 전체 2234 테스트 통과 |

> 최종 품질 게이트(`e97f870`): `npm run format:check`·`npm run check`·`npm run lint:css` 클린, `npx vitest run` **178 files / 2234 tests 통과**. `npm run test:e2e`는 프론트·백엔드·DB 동시 기동이 필요해 이번 실행 환경에서 수행하지 못했다 — CQ-22의 착수 조건으로 남겼다.
>
> **판단이 필요했던 지점 4가지**
>
> 1. **ratchet을 ESLint가 아닌 Vitest로 구현** — 계획서는 `eslint.config.mjs`에 `max-lines` 규칙을 추가하도록 했으나 config-protection 훅이 해당 파일 수정을 차단했다. 사용자 결정에 따라 `scripts/max-lines-baselines.mjs`(기준값 SoT) + architecture test 조합으로 확정했다. 테스트가 기준 파일의 **증가와 감소를 모두 실패**시키고 기준선 밖 파일의 800줄 초과도 막으므로 정지선 목적은 동일하게 달성한다. 대신 에디터 인라인 경고는 없다.
> 2. **`.stylelintrc.json` 경로 재지정** — 컴포넌트 이동으로 FE-19 grandfather 경로 8개가 어긋나 `lint:css`가 153건 실패했다. 예외를 새로 추가하지 않고 경로만 옮겨 이동 전과 **정확히 같은 검사 범위**를 복원했다. C-2에서 TiptapEditor의 scoped CSS를 외부 파일로 뺄 때도 `.vue` 항목을 `styles/tiptap-editor.css`로 **이동**해 예외 개수를 늘리지 않았다.
> 3. **기준 항목 1개 증가(31→32 후 최종 28)** — `app/pages/info/council-request/prepare/[id].vue`는 HEAD에 있던 Prettier 드리프트를 정리하자 긴 줄이 풀리며 731→803줄로 실제 크기가 드러났다. 로직 추가가 아니므로 기준선에 등록하고 C-4 상환 대상으로 남겼다.
> 4. **테스트 파일 재배치 생략** — C-3 계획은 테스트도 `council/*.test.ts`·`tiptap-table/*.test.ts`로 쪼개도록 했으나, Wave B에서 확정한 "테스트 재배치는 불필요한 churn" 판단을 따라 기존 위치를 유지했다. production 책임 경계는 계약 테스트가 이미 고정한다.
>
> **후속 등록**: C-2 잔여 4개(툴바 2개·extension barrel 2개)는 `TASK.md` **CQ-22**로 등록했다. 툴바 2개는 E2E 없이는 회귀를 관찰할 수 없어 보류했다.

### ✅ 2026-08-04 Clean Code Wave 3 Wave A (CQ-17·CQ-06)

> 계획 `docs/superpowers/plans/done/2026-07-29-clean-code-wave3-wave-a-backend-refactors.md`(Task 1~4)를 실행했다. 대상은 `it_backend` 단일 저장소이며 REST API·DTO·DB 스키마·트랜잭션 경계·인증 실패 의미는 변경하지 않았다.
>
> 계획서의 cross-check commit은 backend `74814d3`였으나 실행 시점 HEAD는 `b4ae577`였다. 착수 전 `loadAthIds` grep으로 계획서가 지목한 5개 호출 지점(`AuthService:188/313/397/442`, `RefreshTokenRotator:125`)과 2개 private 구현(`AuthService:496`, `RefreshTokenRotator:180`)이 모두 그대로임을 확인한 뒤 진행했다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | CQ-17 | `common.iam.service.UserRoleResolver` 신설로 역할 조회 정책 단일화. 활성·미삭제 조회(`eno`,`useYn='Y'`,`delYn='N'`), 조회 순서 보존 immutable 목록, 빈 결과 `ATH_USER` 폴백, Repository 예외 원본 전파를 단독 소유한다. 로그인·세션 복원·개발 사용자 전환·SSO·Refresh **5경로 전부** 전환하고 `AuthService`·`RefreshTokenRotator`의 중복 `loadAthIds` 2개와 `RoleRepository` 의존을 제거했다 | it_backend `391bd37` | `UserRoleResolverTest` 3건(다건 순서·불변성, 폴백, 원본 예외 동일성) 신규. `AuthServiceTest`·`RefreshTokenRotatorTest`를 resolver mock으로 재배선하면서 JWT 발급 검증을 `anyList()`에서 **정확값 인자**로 좁혀 resolver 결과가 토큰·응답에 그대로 전달되는지 고정. 게이트: `loadAthIds` production grep 0건, 두 소비자 파일 `RoleRepository` grep 0건 |
| ✅ Done | CQ-21 | 백엔드 `spotlessCheck` 위반 해소로 main의 `./gradlew check` 게이트 복구. 2026-08-01 REVIEW가 지목한 파일(`domain/menu/repository/CmenumRepositoryCustom.java`)은 이미 해소돼 있었고, 실제 잔여 위반은 `domain/budget/project/repository/ProjectItemRepository.java`의 `hasSecuritySystemItem()` JavaDoc 줄바꿈 1건이었다(작업 트리 미수정, HEAD 상태) | it_backend `3f65cf5` | `./gradlew spotlessApply` 후 해당 파일만 분리 커밋. 같은 시점 `./gradlew check` **BUILD SUCCESSFUL** |
| ✅ Done | CQ-06 | `Bcostm.update`의 20개 위치 인자를 `@Builder Bcostm.UpdateCommand` record로 전환. `dfrCleC`·`abusTc`의 `CodeDefaults.orNotApplicable` 보정은 `update(UpdateCommand)` 본문에 유지하고, null 명령은 어떤 필드도 바꾸기 전에 `Objects.requireNonNull`로 실패한다. production 호출부는 계획서 확정대로 `CostService.java:312` 1곳뿐이었고 `:383` `Btermm.update`는 CQ-19로 남겼다 | it_backend `47fa027` | `BcostmUpdateCommandTest` 2건(20개 필드 전량 매핑 + 두 기본값 보정, null 명령 부분변경 없음) 신규. `CostServiceTest`에 요청→command 20필드 매핑을 record 동등성으로 한 번에 고정하는 테스트 추가, 기존 계약명·환율 회귀 verify 2곳을 command captor로 전환. 계획서의 임시 20인자 오버로드는 **커밋에 남기지 않았다** — `Bcostm`의 public `update` 선언은 `update(UpdateCommand)` 1개 |

> 최종 품질 게이트: `cd it_backend && ./gradlew check` → **BUILD SUCCESSFUL**(Spotless·전체 단위 테스트·JaCoCo 검증 통과, 3분 24초).
>
> **부수 사실 2건**: ① 착수 시점 `./gradlew check`는 **이미 main에서 실패**하고 있었다 — 원인은 이번 변경과 무관한 `ProjectItemRepository.java` JavaDoc 줄바꿈 1건으로, `TASK.md` CQ-21이 기록한 위반 파일(`CmenumRepositoryCustom.java`)과 달랐다. `spotlessApply` 후 해당 파일만 분리 커밋(`3f65cf5`)해 CQ-21을 완료 처리했다. ② 신규 파일이 LF로 작성돼 Spotless 줄바꿈 위반이 났고 `spotlessApply` 결과를 별도 커밋(`b66ccee`)으로 남겼다.
>
> `versions.lock`은 갱신하지 않았다 — API 호환 조합이 바뀌지 않는 백엔드 내부 리팩터링이다.

### ✅ 2026-07-31 ERR-13·FE-15~19 조치

> 계획 `docs/superpowers/plans/done/2026-07-29-err13-fe15-19-remediation.md`(Task 1~9)를 실행했다. it_frontend 브랜치 `feature/err13-fe15-19-remediation`(main 대비 71커밋, `3a01cbd`…`48a8563`)을 `main`에 로컬 병합했다(병합 커밋 `02faaba`, 충돌 없음 — 병합 전 `main`이 분기 이후 움직이지 않았음을 확인). **push는 하지 않았다.**
>
> **중요한 사실**: 감사 결과 Class A(죽은 `try/catch` 판정)는 **0건**이었다 — 계획서가 전제한 "죽은 try/catch 판정" 결함은 실제로 존재하지 않았고, 진짜 결함은 "쓰기 성공 안내 직후 재조회 실패를 판정하지 않는 것"(Class B)이었다. 이번 브랜치 실행 중 **계약 서술이 여섯 번 틀렸고 매번 Nuxt 소스 실측으로만 정정됐다**(예: `refresh()`가 reject한다는 최초 가정, dedupe-abort 반환값, `createError` 조건, 보존 파사드 노출 범위 등). 후속 작업자는 Nuxt `useAsyncData`/`useApiFetch` 계약을 절대 추측하지 말고 실행으로 확인해야 한다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | ERR-13 | `useApiFetch` 유래 `refresh()` 호출부 전수 조사·분류(감사 리포트 `docs/superpowers/reports/2026-07-err13-refresh-audit.md`: 총 **145건** = A **0**·B **84**·C **35**(C-2 7, C-3 28)·D **26**) 후 교정 대상 **112곳**(B 84 + C-3 28) 전량 교정. 공통 가드 `useRefreshGuard`(마지막 정상값 보존 포함)와 예외 승격 헬퍼 `refreshOrThrow` 신설, 재조회 실패 시 배너·재시도 제공, 가드가 도는 구간에만 공통 오류 토스트 억제 | it_frontend `3a01cbd`…`48a8563`(main 대비 71커밋 중 ERR-13 계열; 대표: `3a01cbd` refreshOrThrow 헬퍼, `0807a8e` useRefreshGuard 신설, `68fe44c` 3-keep 마지막 정상값 보존, `82f1a0e` 401 투명 재조회 화면 유지 실측, `aa4dc2a` 협의회 개최 결과 최종 지점) | 병합 후 `main`에서 전체 166 files/2129 tests 통과, `npm run check` 클린. 교정 지점마다 실제 계약 기반(resolve + `data` 초기화 + `error` 세팅) mock 테스트, `refreshOrThrow` 계약 테스트 3건, 401 투명 재조회 경로에서 화면이 비지 않음을 증상으로 관찰하는 테스트(`82f1a0e`) 포함 |
| ✅ Done | FE-16 | 전산업무비 편집 모드에서 KeepAlive `onActivated`로 인한 우발적 재조회를 억제해 미저장 편집 유실 방지 | it_frontend `34671ff` | 편집 모드 재조회 억제·조회 모드 복귀 시 1회 갱신·편집값 보존 단위 테스트 통과 |
| ✅ Done | FE-17 | 전산업무비 목록 재조회 실패 알림 중복 제거. `fetchCosts()`에 `suppressNetworkError` opt-in 옵션 추가, 다른 7개 호출부는 동작 불변 | it_frontend `9a2ffa4`, `faa39d6` | `fetchCosts` 옵션 전달 단위 테스트, 전산업무비 화면 공통 토스트 억제 확인, 다른 호출부 회귀 테스트 통과 |
| ✅ Done | FE-18 | `searchDept`·`searchAllType`·`searchMajorHdq`·`searchEmployee`·`searchContinueProjects` 등 AutoComplete 계열 응답 순서 역전 가드 `useLatestRequest` 도입·적용, 재리뷰에서 `useEmployeeSearch` 누락분 추가 반영 | it_frontend `9ceb404`, `215e62f` | `useLatestRequest` 계약 테스트 4건, 네트워크 자동완성 3계열 각각 늦은 응답 폐기 테스트 통과 |
| ☑️ Accepted(부분) | FE-19 | SFC `<style scoped>`를 `lint:css` 검사 범위(postcss-html customSyntax)에 포함. 실측 총 580건/37개 파일 중 `:deep`/`:global` 157건은 config 교정(`ignorePseudoClasses`)으로 위반 아님 재분류, 잔여 423건/28개 파일은 `ignoreFiles`로 grandfather 처리해 신규·미변경 139개 SFC부터 즉시 게이트 적용 | it_frontend `2a355df` | `npx stylelint "app/**/*.vue" --custom-syntax postcss-html` 실측(580건/37파일), `npm run lint:css` 통과. **잔여 423건/28개 파일 정리는 `TASK.md` FE-19에 남아 있다**(58→57 수치 정정 포함) |
| ☑️ Accepted(부분) | FE-15 | openapi-typescript codegen 파이프라인(`scripts/codegen.mjs`, `npm run codegen`/`codegen:check`) 도입, 생성물 `app/types/api.d.ts` 커밋, `useCost.ts` 1개 도메인에 적용해 스펙 불일치 시 `typecheck` 실패를 실증 | it_frontend `47594a7`, `4bc0b13`(npm ci peer 충돌 해소), `de89541`(codegen:check Windows CRLF 오탐 방지) | `npm run codegen`·`codegen:check` 동작, 생성물 diff 0, 필드 삭제 통제 변이로 typecheck 실패 실증. **전면 마이그레이션은 `TASK.md` FE-15에 남아 있다**(생성 스키마 전부 optional·nullable 미반영 등 백엔드 OpenAPI 애노테이션 보강 선행 필요) |

> 최종 품질 게이트(병합 후 `main`, `02faaba`): `npx vitest run` 166 files/2129 tests 통과(실패 0), `npm run check` 클린. `npm run format:check` 잔여 위반은 브랜치 이전부터 있던 3개 파일(`app/composables/useAuth.ts`, `app/types/menu.ts`, `tests/unit/composables/useAdminMenu.test.ts`)뿐이며 `TASK.md`에 `CQ-20`으로 별도 등록했다.
>
> **후속 등록**: 이 브랜치 실행 중 리뷰가 코드로 확인했으나 범위 밖이라 고치지 않은 항목은 `TASK.md`에 `ERR-14`(401 무한 재조회 폭주 가능성)·`ERR-15`(ERR-13 census가 놓친 무괄호 템플릿 바인딩 3지점)·`FE-20`(편집 중 다른 행 미저장 편집 덮어쓰기)·`FE-21`(FE-18 census가 놓친 자동완성 2지점)·`FE-22`~`FE-26`(토스트 억제 옵션 부재·`clearNuxtData`/언마운트 purge 미검증·`admin/boards` 보존 트레이드오프·`ResultForm` 배너 2중 노출 가능성·`prepare/[id].vue` 탭 가시성 한계)·`CQ-20`(format:check 잔여 3파일)로 등록했다.
>
> **통합 리뷰 사후 실행(2026-07-31)**: main 병합·푸시 후 브랜치를 가로지르는 통합 리뷰 3건(A: 적용 지점 / B: 테스트 / C: composable·설정, `it_frontend/.superpowers/sdd/integration-findings.md`)을 사후 실행했다. **각 리뷰의 최대 목표는 통과했다** — 파사드 누락 0건 / `mockRejectedValue` 규율 142건 전수 준수 / 설정 5종 실측 확인 / 가드 43 ↔ 배너 43 누락 0. 그러나 **개별 단계 리뷰가 구조적으로 볼 수 없던 결함 3종**이 드러나 사용자 결정("사용자 영향 + 테스트 신뢰도"까지 고친다)에 따라 후속 커밋 10개로 수정했다: ① 보존(`keptValueForFailure`)이 `data`만 유지하고 `error.value`는 세팅된 채 남겨, 템플릿이 `error`를 먼저 분기하면 보존된 데이터가 가려지거나 배너에 도달하지 못했던 것(`app/pages/info/documents/[id]/index.vue` 등 7개 화면) ② `app/composables/costList/useCostEditingState.ts`만 `refreshOrThrow` 3-인자 형태로 공유 가드를 우회해 배너 없이 자체 토스트만 뜨고 5xx에서는 공통 토스트와 겹쳐 2개가 뜨던 것 ③ 테스트 대역 5곳(`useCost.test.ts`·`useCostListPage.test.ts`·costList 3파일)이 "실패 시 `data`가 undefined로 비워진다"는 3-keep 이전 모델을 손으로 재현해, 전산업무비 화면의 ERR-13 배선(보존·억제·배너)이 회귀 검출 범위 밖이던 것. 수정 상세는 `it_frontend/.superpowers/sdd/integration-fix-A-report.md`(그룹 ①②④⑤)·`integration-fix-B-report.md`(그룹 ③)를 참조. 최종 `npx vitest run`은 **167 files / 2152 tests 전부 통과**(통합 리뷰 전 166 files/2129 tests → +23). 수정 과정에서 새로 드러난 결함과 잔여 지적은 `TASK.md`에 `ERR-15`(admin/logs census 누락 추가)·`FE-27`~`FE-33`(테스트 위생·커버리지 공백·A/C Minor·admin/menus 주석 표류·`createNuxtFetchFake` 참조 재사용 한계·게시판 첨부 가드 밖 경로)로 등록했다.
>
> **교훈**: 각 단계 리뷰는 "배너가 템플릿에 있는가"만 확인했고 **주변 `v-if` 체인이 배너에 도달하게 해주는가**는 아무도 보지 않았다. 단계별 리뷰만으로는 브랜치를 가로지르는 결함을 못 잡는다.

### ✅ 2026-07-29~30 SEC-11~15 보안 조치 완료

> 계획 `docs/superpowers/plans/done/2026-07-29-sec10-sec15-security-remediation.md`의 완료 항목만 이관했다. SEC-10은 1.x/2.x 호환 백포트가 공식 advisory에서 식별될 때까지 `TASK.md`에 유지한다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | SEC-11 | Oracle 도구의 비밀번호를 명령행·환경변수·임시 SQL에서 제거하고 수동 콘솔 프롬프트와 무인 Wallet 별칭을 분리했다. fake client가 모든 argv와 두 번째·중첩 `@sqlfile`까지 재귀 추적해 비밀 sentinel을 거부하고, SPOOL/포함 경로도 검사한다. Wallet 생성·배포·실재 검증은 운영/DBA 절차로 남긴다. | database 변경 `d5756ad`(호환 HEAD `0af106f`); root `604ff1e`…`892f447` | `verify-sec11-powershell.ps1`을 PS7·Windows PowerShell 5.1에서 각각 종료 0로 재실행. Process CommandLine, prompt/Wallet, repository DDL·임시/중첩 SQL, BOM 없는 한글 스크립트 파싱 검증 통과. |
| ✅ Done | SEC-12 | `SsoAgentClient.authorize()`·`isServerAlive()`, `SsoController.loginProc()`·`checkauth()`·`complete()`의 token/session/eno/body/IP 원문을 제거했다. 유효 resultCode 진단은 유지하되 제어문자·포맷 문자열·과대 resultCode는 한 줄 안전 표현으로 바꾸고, 비정상 길이는 UTF-16 unit이 아닌 Unicode code point 수로 기록한다. | backend `c8861cc`…`eb79b76`(호환 main HEAD `ae61469`) | `authorize_비정상resultCode_로그주입차단_반환값유지`, `loginProc_비정상resultCode_로그주입차단_인증결과유지`, `checkauth_비정상resultCode_로그주입차단`, `checkauth_유효resultCode_로그진단유지`, `ssoLogSanitizer_resultCode_보충문자길이코드포인트기준` 및 기존 sentinel log-capture 테스트. |
| ✅ Done | SEC-13 | prod에서 OpenAPI 두 속성을 false로 강제하고 override·누락·빈값을 차단했다. 운영 위험 Boolean은 Spring `Binder`의 typed binding과 같은 true/false 별칭을 사용하되 공백·오타는 fail-closed이며, lazy initialization에서도 validator를 eager 실행한다. active profile을 우선하고 없을 때 default profile을 사용하며 `prod`/`PROD`를 모두 운영으로 판정한다. | backend `e8d8aa4`…`312367a`(호환 main HEAD `ae61469`) | prod 문서 endpoint 익명 401/인증 404·local/dev 유지, `lazyProd_dangerousToggle_failsDuringStartup`, `validate_prodDirectEnoSpringTrueAliases_throws`, `validate_prodDirectEnoInvalidBoolean_throwsWithoutValue`, default/uppercase PROD 실제 startup 및 active non-prod 우선 테스트. |
| ✅ Done | SEC-14 | Java/TypeScript가 내부 단일 `/` 경로를 브라우저 기준으로 canonicalize하고 dot segment·unreserved percent encoding을 정규화하되 안전한 query/hash suffix 원문은 보존한다. 외부/scheme-relative, 역슬래시·인코딩 구분자/제어문자, 잘못된 percent encoding, canonical 첫 `login` segment를 거부한다. 프론트 배열 쿼리는 **첫 요소가 문자열일 때 그 값만 사용**하며 첫 값이 비문자/위험하면 뒤의 안전값으로 폴백하지 않는다. malformed 상태 쿠키는 비밀 노출 없이 루트 복구하고 반복 `error`도 첫 문자열만 판정한다. 새 `business` 진입은 새 next 판정 전에 이전 `ssoNext`·`ssoOrigin` 세션 값과 쿠키를 먼저 제거해 위험한 새 입력이 과거 복귀 상태를 되살리지 못하게 한다. | backend `20827a8`…`bfcc9e1`(main HEAD `ae61469`); frontend `3e5637a`…`f079900`(main HEAD `f079900`) | Java/TS canonical allow/deny 표, safe suffix 보존, malformed 쿠키 복구 및 auth/server middleware 반복 error·배열 테스트에 더해 `business_안전하지않은새next_이전복귀상태제거`가 세션 제거·쿠키 만료·루트 복귀를 고정한다. `npm run test:e2e:static` 종료 0. |
| ✅ Done | SEC-15 | 기존 CSRF 보강 트리거 5개와 운영 `JSESSIONID`의 Secure·HttpOnly·SameSite=Lax 강제를 유지하면서 실제 자동 자격증명·상태 변경 경계를 보강했다. SSO 세션은 한 번만 소비하고 로그아웃 시 서버 세션을 무효화하며, 프론트 로그아웃은 POST를 사용하고 서버 실패에도 로컬 인증 상태를 정리한다. 새 업무 진입도 이전 복귀 세션·쿠키를 비운 뒤 새 목적지를 판정한다. 게시물 상세 GET/조회수 POST를 분리했고, 게시판·게시물·댓글의 계층 소속과 작성자 소유권 및 비활성 게시판 쓰기 거부를 서버에서 검증한다. 게시물·댓글 쓰기와 답글 순서는 managed 감사 갱신, 비관적 잠금, 원자적 꼬리 순번 배정으로 동시성을 보장한다. DB는 `V20260730_001` DML 보정과 `V20260730_002` 답글 꼬리 인덱스를 분리했으며, disposable schema marker/token으로 오실행을 막는 마이그레이션 IT를 제공한다. | backend SEC-15 계열 `c9bca15`…`bfcc9e1`(main HEAD `ae61469`); frontend `8e94190`…`f079900`(main HEAD `f079900`); database `de35930`…`0af106f`(main HEAD `0af106f`); root FP `33ade11`…`b33d148` | 실제 Oracle에서 `BoardWriteConcurrencyIT`·`BoardPostViewAuditIT`가 동시 쓰기/조회 감사·잠금 계약을 통과했다. `BoardReplySequenceMigrationIT`는 `@JdbcTest` 최소 JDBC slice, 테스트 DB 자동 교체 금지, 알림 재시도·Spring task scheduler 비활성 구성으로 격리했다. disposable 환경이 없어 4/4 의도적으로 skip됐고, 로컬 Docker daemon/Testcontainers도 없어 V001/V002 런타임 적용 성공을 주장하지 않는다. marker/token을 갖춘 disposable Oracle에서의 migration runtime은 배포 전 필수 게이트다. |

> 최종 품질 게이트(2026-07-30): 호환 main HEAD는 backend `ae61469`, frontend `f079900`, database `0af106f`다. backend `ae61469`에서 `gradlew clean check`는 단위 테스트 2,505건(실패·오류 0, 스킵 1)과 Spotless·JaCoCo를 통과했고, `BoardWriteConcurrencyIT`·`BoardPostViewAuditIT`·`BoardReplySequenceMigrationIT` 집중 `integrationTest`도 17건 중 13건 성공·실패/오류 0으로 종료했다. 실제 Oracle 게시판 동시성·감사 테스트는 실행됐고 migration IT 4건은 disposable 환경 부재로 의도적으로 skip됐다. `cf62c96`은 migration IT를 scheduler 없는 `@JdbcTest` slice로 격리했고 `bfcc9e1`은 새 업무 진입의 과거 복귀 상태 제거 회귀를 추가했으며, 병합 후 `ae61469`는 migration SHA를 LF canonical text에 고정해 Windows CRLF 체크아웃에서도 같은 DB SoT를 검증한다. frontend `npm run format:check`, `npm run check`, 전체 Vitest는 main에서 종료 0이었고, 사용자 `nuxt dev`와 생성 산출물 경합을 피한 동일 `f079900` 격리 worktree에서 `npm run test:e2e:static` 2/2가 통과했다. `verify-sec11-powershell.ps1`은 PS7·Windows PowerShell 5.1에서 각각 종료 0이었다. FP generator 결과는 UFP 1,305, 총 278개 기능(ILF 37, EIF 2, EI 136, EO 31, EQ 72)이며 root 증빙 HEAD는 `b33d148`이다.

> 운영 보안 escalation: 역사적 문서·계획·완료 기록에서 평문 자격증명으로 보일 수 있는 값이 관찰되었으나 이번 범위 밖이다. 값을 이 문서에 재노출하지 않으며, 저장소 접근 이력·비밀 관리 담당자와 별도 비밀 스캔/접근 영향·필요 시 rotation 및 승인된 정리 절차를 평가한다. 이번 작업에서는 history rewrite·rotation을 수행하지 않았다.

### ✅ 2026-07-29 ERR-11·ERR-12·FE-12(스파이크)·FE-13·FE-14 조치

> 계획 `docs/superpowers/plans/2026-07-29-err11-12-fe12-14-remediation.md`를 서브에이전트 기반(구현 → 스펙 리뷰 → 품질 리뷰 → 재작업 루프)으로 실행했다. 구현은 `it_frontend` 브랜치 `feature/err-fe-remediation-20260729`에 있으며 **아직 main에 병합되지 않았다** — 병합 후 `scripts/update-versions-lock.ps1`로 `versions.lock`을 갱신해야 한다. 리뷰 과정에서 계획 자체의 오진 2건(FE-14 수정 지점, ERR-11 재조회 상호작용)과 Nuxt `useAsyncData` 계약 오해 1건이 드러나 계획을 정정하며 진행했고, 파생 과제는 ERR-13·FE-15~19로 등록했다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | FE-14 | Tiptap 변수 칩이 재시도 성공값을 반영하지 않던 간헐 버그 해소. 원인은 병합 로직이 아니라 **반응성 경계**였다: Tiptap core의 `Extendable.storage` getter가 `addStorage()` 반환값을 객체 스프레드로 복사해 확장 정의의 반응형이 사라지고, `@tiptap/vue-3`의 `editor.storage`는 `beforeTransaction`에서만 trigger되는 `customRef`라 값 재할당이 `VariableNodeView`의 computed를 무효화하지 못했다(무관한 트랜잭션 발생 시에만 우연히 갱신 → flaky). `VariableExtension.onBeforeCreate`에서 살아 있는 `editor.storage.tiptapVariable`을 `shallowReactive`로 교체 | it_frontend `92331bb`(무효 시도) → `94a626e`(mock 경계 회귀) → `3577eea`(최종) | 실제 `@tiptap/vue-3` Editor 경로 단위 테스트 2건(설치 전 미전파/설치 후 전파), `error-recovery-tiptap.spec.ts` `--repeat-each=5` 5회 연속 통과(+리뷰어 3회 추가), 전체 148 files/1886 tests. 리뷰어가 Tiptap core 소스와 자체 프로브로 `beforeCreate`가 NodeView 마운트보다 선행하고 `editor.storage.tiptapVariable === editor.extensionStorage.tiptapVariable`임을 독립 검증 |
| ✅ Done | ERR-11 | 전산업무비 일괄 저장의 부분 실패 복구. ① 실패 행별 사유(`_saveError`)·편집값·`_status`를 편집 모드에 보존하고 성공 행만 정리 ② `costsRaw` watcher가 실패 행을 서버 데이터로 덮어쓰지 않도록 보존(스냅샷은 서버 원본 기준 유지) ③ 재조회 실패를 `error` ref로 판정해 배너·재시도(`retryRefreshAfterSave`) 제공, 성공한 쓰기는 재전송하지 않음 ④ 취소 경로의 미처리 예외 처리 ⑤ 화면 표면화(실패 배너·재조회 실패 배너·실패 행 강조 `row-save-failed`) | it_frontend `8af9d9f`·`17940b0`·`7e85e97`·`482d324`·`9602152`·`334eea2`·`ae4317e` | 단위·통합 테스트 15건(부분 실패·전체 실패·성공 회귀·재조회 실패·중복 저장 차단·유령 배너 해제·취소 경로·실제 watcher 통합), 리뷰어가 소스만 되돌려 RED 재현 및 `StyledDataTable` 실제 DOM 렌더로 `tr.row-save-failed` 적용 확인, 전체 149 files/1905 tests |
| ✅ Done | ERR-12 | 계속사업 자동완성의 조회 실패를 "결과 없음"과 구분. `continueSearchError`로 사유를 남기고 인라인 `Message`+[다시 시도](로딩 상태 포함) 제공, 사업구분 전환 시 낡은 오류 정리 | it_frontend `32aee86`·`d67a23e` | 단위 테스트 4건(빈 결과·실패·재시도·오류 초기화), watcher 초기화 한 줄 제거로 RED 실측, 전체 150 files/1909 tests |
| ✅ Done | FE-13 | `it_frontend/docs/design/`을 `docs/preview/`로 통합하고 `docs/guides/README.md`에 위치 규약 명시(참조 0건 사전 확인) | it_frontend `8034ae0` | `git grep`으로 두 경로 참조 0건 확인, rename으로 이력 보존, `docs/design` 제거 확인 |
| ✅ Done | FE-12(스파이크) | openapi-typescript vs orval 실측 비교 완료 — **openapi-typescript 조건부 채택, orval 보류**. 도입 실행은 FE-15로 재등록 | 루트 `fa27c6d` (리포트) | 실측: 스펙 paths 159·operations 235·schemas 234(OpenAPI 3.1), openapi-typescript 1파일 13,328줄·런타임 의존성 0, orval 37파일 15,594줄·mutator 위임 구조 확인. 프론트 저장소 무변경 확인. 리포트 `docs/superpowers/reports/2026-07-fe12-openapi-codegen-spike.md` |

### ✅ 2026-07-27 BE-03 보수적 프로젝션 1차 적용 (6개 묶음 + 가이드 목록 계약 분리)

> 사용자 승인(2026-07-27: "6건 전부 구현" + "가이드 목록 계약 분리 지금 함께")에 따라 경계선 6개 묶음 전부에 응답 전용 프로젝션을 적용했다. 응답 JSON은 가이드 목록(승인된 계약 변경, `feat!`)을 제외하고 전부 불변이며, 읽기·쓰기 공유 메서드는 기존 엔티티 경로를 유지했다. 잔여 과제(운영 관측 조정, Project/Cost·알림함 계약 분리, BBUGTM 재계획, versions.lock)는 `TASK.md` BE-03 참조. 조사 중 발견된 부수 이슈는 BE-25(캐시 공백)·BE-26(N+1)·BE-27(IT fixture 격리)로 분리 등록.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | BE-03(1차) | ① Estimate 상세 `EstimateDetailView`(7컬럼) ② Application 읽기 `ApplicationReadView`(8컬럼, 죽은 오버로드 제거) ③ 공통코드 REST `CcodemResponseRow`(18컬럼, 캐시·직접 소비자 불변) ④ 게시판 메타·댓글 목록 `BoardMetaListRow`/`BoardCommentListRow` ⑤ 조직 소비자별 `OrganizationListView`/`OrganizationAdminView`(인메모리 delYn 필터→쿼리 필터) ⑥ 가이드 목록 계약 분리(`GuideDocListView`+`ListResponse`, 본문 CLOB 제외) + 프론트 전환(목록 Summary 타입, 선택 시 단건 본문 조회, 상세 로드 실패 시 빈 본문 덮어쓰기 차단) | it_backend `feature/be03-conservative-projections` `7e73d18`…`b6714db`(11커밋); it_frontend `feature/be03-guide-list-split` `c23413a`·`8b45d3a` | 신규 조회마다 Oracle IT 동등성 케이스(로컬 Oracle 실제 실행 GREEN, `Projections.constructor` 순서 검출 fixture 보강 포함), 백엔드 전체 `./gradlew test`·`integrationTest` GREEN, 프론트 `npm run check`+`npm test` 1834건 GREEN, Task별 2단계 리뷰(프론트 CRITICAL 빈 본문 덮어쓰기 경로 발견·수정 포함) 및 전체 최종 리뷰 READY TO MERGE. 계획: `docs/superpowers/plans/2026-07-27-be03-conservative-projections.md` |

### ✅ 2026-07-27 BE-17 프로젝션 보류 정책 4건 확정·대표행 결정론화 구현

> 2026-07-27 사용자 확정 정책: ① BITEMM GCL 대표행 = `LST_YN='Y'` 우선(없으면 SNO 최대 폴백) ② BBUGTM 편성률 대표행 = 최신 편성 실행(`bgNo` 최대, 동률 시 `sno` 최대) ③ BPROJM 배치 사업명 = `LST_YN='Y'` 행 이름(없으면 관리번호 폴백)으로 단건 조회와 통일 ④ `getProjectSummary` 그룹 키 = `(orcTb, pkVl)` 복합키 분리. 차단 해제된 BBUGTM·`ProjectKeyView` 프로젝션은 BE-03 보수적 프로젝션 후속 재계획 시 포함한다. 범위 외로 발견된 `getSummary` 표시명 병합 블록의 잔여 encounter-order 채택은 BE-24로 분리 등록했다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | BE-17 | 대표행 셀렉터 3종 신설(`BudgetRepresentativeSelector`·`ItemRepresentativeSelector`·`ProjectRepresentativeSelector`)과 `BudgetWorkService`의 encounter-order 채택 지점 교체(getIoeCategories 편성률, getProjectSummary 헤더 편성률·품목 편성행·BITEMM 그룹핑·배치 사업명, computeMplAdjustment 품목 대표행·비목 분류 편성행), `SourceKey(orcTb, pkVl)` 복합키 분리 및 `orcTbMap` 제거 | it_backend `feature/be17-representative-row-policies` 브랜치 `bdf3c92`…`579accd` 11커밋 | TDD RED→GREEN 단계별 실증(구버전 구현 복원 실패 실증 포함), 신규 단위 테스트 21건 추가·전체 `./gradlew test` BUILD SUCCESSFUL, Task별 스펙·품질 2단계 리뷰 및 전체 최종 리뷰 READY TO MERGE. 구현 계획: `docs/superpowers/plans/2026-07-27-be17-representative-row-policies.md` |

### ⛔ 2026-07-26 프론트엔드 잔여과제 범위 종료

> 사용자 결정에 따라 아래 항목은 구현 완료로 간주하지 않고 후속 범위에서 폐기했다. 알려진 제한과 검증 증거는 추후 의사결정에 참고할 수 있도록 보존한다.

| 상태 | ID | 폐기 범위 | 보존 근거 |
| :--: | :--: | --- | --- |
| ⛔ Discarded | REV-01 | 사전협의 검토자·세션 상태 서버 영속화와 실제 인증 완료 흐름 | 계약·메타용어 미승인 상태에서 구현하지 않는다는 계획 게이트를 준수했으며 메모리 전용 흐름은 현행 유지 |
| ⛔ Discarded | REV-04 | 검토의견 첨부 배치 조회의 URL 길이·Oracle `IN` 1,000개 상한 보강 | 현재 배치 계약은 유지하며 대규모 부모 요청 최적화는 수행하지 않음 |
| ⛔ Discarded | TIP-02 | Tiptap 사업 변수·실DB·HWPX 전체 인수조건 완성 | 당시 자동화 subset과 expected-failure 검증 기록은 Git 이력에 남고 현행 분석 문서는 제거됨 |
| ⛔ Discarded | TIP-03 | `CAP_BUDGET`의 `IOE_CPIT` 포함 정책 결정과 런타임 정렬 | 2026년 `IOE_CPIT` 0건으로 합계는 일치하지만 3종·4종 정책 불일치는 미해결 상태로 보존 |
| ⛔ Discarded | TIP-05 | 변수 칩·다크모드·키보드·ARIA·모바일 실화면 재검증 | 브라우저 미가용으로 미수행한 검증 범위와 코드 점검 결과는 Git 이력에 남고 현행 분석 문서는 제거됨 |
| ⛔ Discarded | TIP-07 | 변수 NodeView `data-token` DOM 계약과 비동기 해석 즉시 반영 | 알려진 결함과 expected-failure 테스트는 보존하되 제품 수정은 수행하지 않음 |
| ⛔ Discarded | TIP-08 | 변수 칩 다크 대비와 Suggestion 팝업 접근성·모바일 경계 | 측정된 대비·ARIA·viewport clamp 제한은 보존하되 제품 수정은 수행하지 않음 |
| ⛔ Discarded | TIP-09 | HWPX 내보내기 전 최신 변수값 재해석 | stale `data-snapshot` 출력 결함과 expected-failure 테스트는 보존하되 제품 수정은 수행하지 않음 |

### ✅ 2026-07-26 프론트엔드 잔여과제 통합 조치 완료 이관

> 기존 FE-01 완료 기록은 KPI·진행현황 API 전환 범위다. 아래 FE-01은 그 후속인 공지·협의회 일정 운영 피드 범위를 별도로 기록한다.

| 상태 | ID | 완료 범위 | 저장소 커밋 | 검증 증거 |
| :--: | :--: | --- | --- | --- |
| ✅ Done | REV-02 | 검토의견 응답의 작성자 사번·이름·현재 팀명을 배치 프로젝션으로 조회하고 프론트 `authorTeam` 문자열 매핑·표시를 연결했다. | backend `805ba14`; frontend `96cd7ad` | 작성자 프로젝션 배치 호출 단위 테스트, 백엔드·프론트 focused/full 테스트와 정적 검증 통과, 작업 리뷰 Approved |
| ✅ Done | REV-03 | 검토의견별 첨부 배치 조회, 상위 문서 기반 읽기 권한, 댓글 작성자·관리자 쓰기 권한, 작성·조회·삭제 UI와 부모별 독립 재시도/폐기를 연결했다. 후속 통합 리뷰에서 재시도 세션 격리와 실제 HTTP 권한 경계도 보강했다. | backend `1e38af2`, `989df67`, `cd7d402`, `df26a06`; frontend `10a96f0`, `0168b2f`, `e1d4038` | backend focused 25/25·전체 테스트·Spotless·Oracle/MockMvc download/preview 403 통과, frontend focused 50/50·전체 142파일/1,791건·`npm run check`·Playwright 2/2 통과, mutation RED와 재리뷰 Approved |
| ✅ Done | FE-01 | 정보 홈의 정적 공지·일정을 공개 공지 게시물과 접근 가능한 확정 협의회 일정 API로 교체하고 영역별 로딩·오류·빈 상태·재시도를 제공했다. 후속 통합 리뷰에서 화면 재활성화 시 피드 갱신을 보강했다. | backend `96048c6`; frontend `f8fa350`, `e728738`, `d4360ca` | 공개 게시물 Oracle 통합 3건·백엔드 전체 테스트/Spotless, frontend focused 6건·전체 테스트·`npm run check`·정보 홈 Playwright 3/3 통과 |
| ✅ Done | FE-04 | 사업계획·소요예산·협의회 목록을 필터·정렬 후 최초 20건, 20건 단위 더보기로 점진 노출하고 검색·필터 변경 시 노출 수를 초기화했다. 네트워크 페이지네이션은 실서버 p95 측정 전까지 별도 게이트로 남겼다. | root `d8fa8b8`, `910b367`, `7f2fd06`; frontend `c029c5f`, `fa1367b` | 1,000건에서 화면별 20카드, 필터 중앙값 21.2~27.0ms; 전체 frontend 1,775건·`npm run check` 통과, 재현 가능한 env-gated 성능 하네스와 리뷰 Approved |
| ✅ Done | FE-07 | `budget/status.vue`의 PrimeVue footer 바인딩 3곳을 `:footer-class`로 정정하고 합계 회귀 테스트를 갱신했다. | frontend `7be77dc` | 대상 ESLint 0 warning/0 error, footer 합계 Vitest 2/2, 전체 137파일/1,759건·`npm run check` 통과 |
| ✅ Done | FE-08 | `useCostRowEditing().addRow()`의 맨 앞 삽입, 사용자 코드, 선택 연도/기본 연도, `abusTc`·`dfrCleC` 해당없음 기본값을 실제 composable 테스트로 잠갔다. | frontend `5c799ca`, `631a996` | focused Vitest 4/4, `unshift`→`push` 통제 변이 RED 확인, cost Playwright 6/6·전체 테스트·`npm run check` 통과 |
| ✅ Done | FE-09 | Excel 지급주기 전용 매퍼를 추가해 공백·미매칭 값을 해당없음 코드로 저장하고 실제 워크시트 행 번호의 집계 경고를 표시했다. 공용 nullable `codeId()` 계약은 유지했다. | frontend `500f486`, `631a996` | 매퍼 Vitest 3/3, 실제 XLSX Playwright에서 물리 행 번호와 저장 payload `dfrCleC='0'` 검증, 통제 변이 RED·cost Playwright 6/6·`npm run check` 통과 |
| ✅ Done | FE-10 | 백엔드 `CodeDefaults.NOT_APPLICABLE`에 대응하는 `NOT_APPLICABLE_CODE='0'`을 추가하고 비용·단말·자원 생성 경로의 업무상 해당없음 기본값 8곳을 통합했다. | frontend `ec13c87` | focused 테스트 11건, 잔여 `abusTc: '0'`/`dfrCleC: '0'` 검색 0건, 전체 테스트·`npm run check` 통과 |
| ✅ Done | FE-11 | 계약방법 누락 저장 시 삭제되지 않은 원본 행 번호와 총 건수를 안내하고 첫 오류 combobox 스크롤·포커스, `aria-invalid`, 선택 즉시 오류 해제를 구현했다. | frontend `5e23825`, `fb0d31c` | unit 1/1, bizplan Playwright 1/1, 전체 138파일/1,760건·`npm run check`·Prettier/diff check 통과, 접근성 수정 재리뷰 Approved |
| ✅ Done | TIP-06 | StarterKit의 `link`·`underline` 등록을 비활성화하고 기존 독립 Link/Underline 옵션을 유지해 Tiptap 중복 확장 경고를 제거했다. | frontend `116009e` | 실제 editor 마운트 RED→GREEN 8/8, 상세·편집 재진입 Playwright 3/3, 전체 137파일/1,759건·`npm run check` 통과 |
| ✅ Done | BRD-11 | 기존 공통 파일 API로 게시글 첨부 작성·조회·추가·삭제를 연결하고 서버 `flApgYn`/`flNbr` 캐시, 파일 크기 메타, 부분 실패 재시도를 보강했다. 후속 통합 리뷰에서 route의 부모 전환 반응성·동기화를 보완했다. | database `6e1a9c5`; backend `3366c73`, `b92c8ce`, `ae8e29c`; frontend `8087aa4`, `015aabd`, `6f9142c`, `628204f` | migration 로컬 2회 적용·`APG_FL_SZ NUMBER(10)` 확인, backend 전체 2,269건·Spotless, frontend 전체 1,784건·board Playwright 9/9·`npm run check` 통과, 동시성·중복 파일명·부모 식별자 재시도 리뷰 Approved |

### ✅ 2026-07-26 프론트 Prettier 포맷 드리프트 정리 (FE-03)

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | FE-03 | Prettier 포맷 드리프트 일괄 정리 | 기능 변경이 끝난 시점의 `prettier --list-different` 기준선 39개를 보존한 뒤 `npm run format`을 한 번 적용했다. Git 콘텐츠 diff는 기준선의 부분집합인 13개였고 기준선 밖 변경은 0개였다. |

- 프론트 커밋: `3038532`.
- 검증: `npm run format:check`·`npm run check` 통과, `npm test` 143파일·1,811건 통과, staged/commit diff check 통과.
- 포맷 전용 리뷰: 줄바꿈·들여쓰기·공백 정리만 포함하고 의미 변경이 없음을 확인해 Approved.

### ✅ 2026-07-26 프론트 포맷터·사업카드 색상 정책 정리 (FE-02, FE-05, FE-06)

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | FE-02 | 잔여 파일 크기·통화·금액 표시 중복 공통화 | 검토의견 팝오버·메신저는 공용 `formatFileSize`를 사용하고, 의미가 같은 네 상세 화면의 통화 표시는 신규 `formatCurrencyAmount`로 통합했다. 표현 의미가 다른 로컬 포맷터는 유지했다. |
| ✅ Done | FE-05 | 목록 예산 축약 포맷터 이름 충돌 해소 | 두 목록 화면의 동명 로컬 `formatBudget`을 제거하고 경계·음수 계약을 고정한 공용 `formatBudgetCompact`로 승격해 기존 단위 변환용 `formatBudget`과 이름·용도를 분리했다. |
| ✅ Done | FE-06 | `ProjectListCard` 상태·칩 톤을 의미 클래스 정책으로 통합 | 상태 5톤과 보조 칩 4톤을 `.project-card-status--*`·`.project-card-chip--*`로 옮기고 `tags.css`의 일반 `span`용 `@apply` 규칙으로 관리한다. PrimeVue `.kdb-tag-*`의 `!important`와 CTA `.v3-cta--*` 색상 계약은 변경하지 않았다. |

- 프론트 커밋: `d9b8a52`(FE-02·FE-05), `39024e9`(FE-06).
- 검증: `npm test` 143파일·1,811건 통과, `npm run check` 통과, `npm run lint:css` 통과, 지정 포맷터 중복 검색 0건.
- 비차단 확인: 기존 밝은/어두운 pixel baseline 또는 screenshot 시나리오가 없어 픽셀 비교는 실행하지 않았고, 전체 tone 의미 매핑과 CTA 불변을 단위/CSS 게이트로 고정했다.
- 기존의 “FE-02 예산 목록/승인 화면 금액 0 표시 정책 보정” 완료 기록은 별도 과거 범위이므로 아래 기록을 유지한다.

### ✅ 2026-07-26 에러 표면화·복구 (ERR-09, ERR-10)

> `TASK.md`의 ⚠️ 에러 처리 ERR-09·ERR-10을 구현·검증하고 종료 이관했습니다. 설계: `docs/superpowers/specs/2026-07-25-security-error-remediation-sec08-err10-design.md` §4(Phase B)·§5(Phase C), 계획: `docs/superpowers/plans/done/2026-07-25-security-error-phase-b-backend-surfacing.md`·`docs/superpowers/plans/done/2026-07-25-security-error-phase-c-frontend-states.md`. it_backend 브랜치 `feat/err08-err09-backend-surfacing`를 main에 병합(머지 `6fa3cf9`, ERR-09 NativeRowMapper 중앙 진단)하고, `feat/err10-council-sync-auth`를 main에 병합(머지 `0a98a43`, ERR-10 C4-1). it_frontend 브랜치 `feat/err08-banner-err10-frontend`를 main에 병합(머지 `a90f79c`, ERR-10 C1~C4-2 + ERR-08 스냅샷 배너).

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | ERR-09 | 네이티브 조회 타입 변환 실패를 실제 NULL과 구분 | `NativeRowMapper`의 날짜 문자열·미지원 JDBC 타입 변환 실패를 원본 값·타입 문맥과 함께 중앙에서 진단(경고)하도록 전환하고 변환 회귀 테스트를 추가했다. it_backend main 병합(`6fa3cf9`). |
| ✅ Done | ERR-10 | 프론트 핵심 업무의 실패 폴백을 사용자 오류 상태로 승격 | 4개 레인 모두 "조용히 삼키기" 대신 사용자 오류 상태로 표면화: (C1) 통화 조회 single-flight + last-known-good 상태머신(`useProjectCurrencies`, eager 옵션 하위호환), (C2) Tiptap 단건 해석 ERROR 승격·재시도와 인스턴스 스코프 시퀀스 가드(`useTiptapVariables`/`TiptapEditor.vue`, 기존 배치 STALE 계약 보존), (C3) 최신 revision PDF만 미리보기·상신 + Blob URL 누수 방지 순수 상태머신(`utils/reportPdfState.ts`/`projects/report.vue`), (C4) 협의회 상태 동기화 실패를 auth/permanent/transient로 분류·재시도 배너·epoch 가드(`utils/statusSyncError.ts`/`ResultReviewProgress.vue`) + 백엔드 `syncReviewStatus` 관리자 권한 강제(C4-1). |

- 최종 검증: it_frontend `npm run check`(타입·ESLint 0 errors)·`npm test`(135파일 1746 통과)·신규 e2e 5종(통화·Tiptap·PDF·스냅샷·협의회 sync) 통과. it_backend `./gradlew test`·`spotlessCheck` BUILD SUCCESSFUL. 태스크별 2단계 리뷰(스펙 준수·코드 품질) + 최종 홀리스틱 프론트 리뷰 READY-TO-MERGE(교차 레인 일관성·하위호환·회귀 없음 확인).
- 최종 게이트 재검증(2026-07-26): 이관 전 root `0439417`, frontend 제품/E2E `8d3eda3`·최종 테스트 `4e91e9c`, backend `52552cc`에서 수행한 정확한 명령·종료 코드·레인 C1~C4 PASS 수락은 [`2026-07-26-err10-final-gate.md`](docs/superpowers/evidence/2026-07-26-err10-final-gate.md)에 고정했다. 해당 영수증에 따라 it_frontend `npm run typecheck`·`npm run lint`·`npm test -- --run`·지정 Playwright 4개 spec(9건), it_backend `./gradlew test`·`./gradlew spotlessCheck`가 모두 종료 코드 0이다. 기준일자 필수화 뒤 누락된 `TerminalFormDialog` 정상 통화 fixture에는 유효 `cdvaDtl`을 보강했다(`4e91e9c`). lint의 `budget/status.vue` `:footerClass` 3건은 FE-07 소유 경고로 제품 코드 변경 없이 보류했다.
- 최종 수정 라운드(2026-07-26): frontend `a6f0cba`에서 PDF 생성 실패 뒤 결재선을 바꾸지 않는 명시적 `다시 시도`를 추가하고, Tiptap의 삭제 ERROR 토큰 정리·문서/변수 맵 전환 중 구 비동기 응답 격리를 보강했다. TDD RED(신규 3건 실패) 뒤 GREEN(집중 19/19)과 영향 E2E 5/5를 확인했으며, 최종 `npm run check`·전체 Vitest 135파일/1,751건·지정 ERR-10 Playwright 9/9가 모두 종료 코드 0이다. 정확한 명령과 SHA는 같은 [`최종 게이트 영수증`](docs/superpowers/evidence/2026-07-26-err10-final-gate.md)의 “최종 수정 라운드 추가 증빙”에 고정했다.
- 잔여 후속(비차단): `TerminalFormDialog` eager:false 다이얼로그가 `cost`를 초기 로드 후 다시 null로 만들 경우의 상태 리셋 방지(key-stable 래퍼/문서화), `ResultReviewProgress`의 `asctId`를 반응형으로 바꾸는 미래 caller에서 자동 트리거 지연 가능성 문서화, 분당 1회 toast 스로틀 공용 헬퍼 추출(DRY) — 별도 과제로 추적.

### ✅ 2026-07-25 보안 트랜잭션 무결성 (SEC-08, SEC-09)

> `TASK.md`의 🔒 보안 SEC-08·SEC-09를 구현·검증하고 종료 이관했습니다. 설계: `docs/superpowers/specs/2026-07-25-security-error-remediation-sec08-err10-design.md` §3(Phase A), 계획: `docs/superpowers/plans/2026-07-25-security-error-phase-a-security-txn.md`. it_backend 브랜치 `feat/sec09-sec08-txn-integrity`를 main에 병합(머지 커밋 `34822a4`).

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | SEC-09 | 로그인 실패 이력의 롤백 독립성과 계정 잠금 동작 보장 | `AuthService.login()`을 `@Transactional(noRollbackFor = LoginRejectedException.class)` 단일 트랜잭션으로 바꿔 로그인 거부(실패 이력)만 커밋하고 DB·프로그래밍 예외는 전체 롤백한다. 비인증 인증 흐름의 감사자를 명시적으로 기록(`JpaAuditConfig`가 `AnonymousAuthenticationToken` 제외, `Clognh` 로그인 이력=`SYSTEM`, `Crtokm` 토큰=소유자 `eno`)해 NOT NULL 감사컬럼 위반을 방지한다. 실 Oracle IT `AuthLoginFailureIsolationIT`가 익명 컨텍스트에서 public 로그인 실패 5건 커밋(감사자 SYSTEM)+6회째 계정 잠금+DB 오류 시 전체 롤백을 검증. `LoginHistoryWriter`/`REQUIRES_NEW`는 도입하지 않음(단일 트랜잭션 방식). |
| ✅ Done | SEC-08 | Refresh Token 재사용 탐지 시 패밀리 폐기 커밋 보장 | 회전과 폐기를 2개 트랜잭션으로 분리했다. `RefreshTokenRotator.rotate()`(`@Transactional`, PESSIMISTIC_WRITE)가 재사용/만료를 삭제 없이 마커 예외로 신호해 회전 트랜잭션을 롤백(비관적 락 해제)하고, 비트랜잭션 오케스트레이터 `AuthService.refreshAccessToken()`이 락 해제 뒤 `RefreshTokenRevoker.revokeByEno()`(`REQUIRES_NEW`+flush)로 패밀리를 확정 폐기한 뒤 `InvalidRefreshTokenException`으로 거부한다. grace 내 동시 재제출은 패밀리를 유지(`ConcurrentRefreshException`). 실 Oracle IT `RefreshTokenIsolationIT`가 재사용·만료 시 패밀리 커밋 삭제(COUNT=0)와 2스레드 동시 회전의 교착 부재(타임아웃 가드)·단일 활성 토큰을 검증. SEC-01(단일 활성)·SEC-04(tokenUse=refresh) 불변식 보존. |

- 최종 검증: it_backend `./gradlew clean check integrationTest` BUILD SUCCESSFUL(unit·JaCoCo 커버리지 게이트·spotlessCheck·로컬 Oracle `@Tag("it")` 통합). 최종 홀리스틱 보안 리뷰 READY(교차 통합·회귀 없음, SEC-08/SEC-09 모두 실 DB 근거로 종결).
- 잔여 후속(비차단): `loadAthIds` 중복 제거(DRY), `refreshAccessToken` 비트랜잭션 전제조건 런타임 가드, revoker 폐기 실패 시 쿠키 삭제 정책 — 별도 과제로 추적.

### ✅ 2026-07-25 백엔드 2026-07-21 범위 잔여과제 정리 (Wave 1~3)

> 2026-07-21 계획 범위의 `TASK.md` 백엔드 과제 중 즉시 구현 가능한 항목과 ERR-08을 해소하고, BE-02·BE-06을 상시 규칙으로 `it_backend/CLAUDE.md`에 이관했습니다. 이후 추가된 BE-19~22는 별도 과제로 유지합니다. 설계: `docs/superpowers/specs/2026-07-21-backend-backlog-cleanup-design.md`, 계획: `docs/superpowers/plans/2026-07-21-backend-backlog-cleanup.md`.

| 상태 | Wave | 과제 | 조치 |
| ---- | ---- | ---- | ---- |
| ✅ Done | 1 | BE-15 `Bplana` 복합키 길이 정합화 | ORM length를 32→30으로 변경해 물리 DDL·`Bplanm`과 일치시키고 `BplanaColumnContractTest`로 계약을 고정했다. |
| ✅ Done | 1 | BE-14 BPLANA 역방향 조회 인덱스 | `V20260725_001__AddBplanaReqDocNoIndex.sql`로 `(REQ_DOC_NO, DEL_YN, ABUS_MNG_NO)` 인덱스를 멱등 이력화했다. 로컬 63행에서 `INDEX RANGE SCAN`, SELECT Cost 3을 확인했고 `BplanaReqDocNoLookupIt`로 실제 Oracle 조회를 검증했다. DB 커밋 `cbd81a1`. |
| ✅ Done | 1 | BE-16 공통코드 업로드 배치화 | 선조회 1회(`findAllByCIdInAndDelYn`) + 메모리 upsert + `saveAll`로 전환하고 요청 내 중복 키의 마지막 값 반영 의미를 보존했다. |
| ✅ Done | 2 | BE-13 기준 계획 탐색 N+1·동률 제거 | `findBaselineReqDocNos` 조인 단건 조회와 `IT_PTL_ASCT_ID DESC` tie-break를 적용했다. 로컬 BASCTM 3행에서 Cost 5, BPLANM full scan + 기존 `IX_TPRMPP_BASCTM_01` range scan을 확인해 추가 인덱스는 만들지 않았고 `CouncilBaselineLookupIt`로 계약을 고정했다. |
| ✅ Done | 2 | ERR-08 스냅샷 손상·빈 결과 구분 | 심의 대상 경로의 JSON 파싱 실패는 문서번호를 포함한 `DataCorruptionException`으로 HTTP 500을 반환하고, 결과서 사업명은 WARN+관리번호 폴백을 유지했으며 기준 계획 조회의 예외 스킵을 제거했다. |
| ✅ Done | 2 | BE-12 사업 일괄 상세 N+1 제거 | 사업·결재선·조직·코드·품목·예산·IOE 명칭을 영역별 IN 배치 조회 후 메모리 조립하도록 전환했다. 입력 순서·중복·실패 ID 계약과 단건/일괄 상세 parity, IOE 공통코드 조회 횟수, 중복 활성 사업 데이터 손상 계약을 `ProjectServiceTest`·`ProjectServiceCoverageTest`로 검증했다. |
| ✅ Done | 3 | BE-02 통합 테스트 하네스 규칙화 | 미보유 Oracle IT 3건(BPLANA 역방향 조회·기준 계획·사업별 평가의견)을 보충하고 “신규 QueryDSL·JPQL·네이티브 조회는 실제 Oracle IT 필수” 규칙을 `it_backend/CLAUDE.md` §9로 이관했다. |
| ✅ Done | 3 | BE-06 Javadoc 정책 이관 | “신규 미분류 경고 불허 + 기능 변경 시 의미 있는 공개 계약부터 점진 정리” 정책을 `it_backend/CLAUDE.md` §9로 이관하고 수치형 잔여 과제 추적을 종료했다. |

- 재분류: BE-03·BE-18은 재개 조건을 명시해 🏛️ External로 전환했다. BE-17의 완료된 BESTTM PK 정합화는 결정 대상에서 제외하고, 나머지 네 정책은 사용자 결정 후 별도 기록한다. BE-19~22는 이 계획과 무관한 별도 과제로 유지한다.
- 최종 코드: `it_backend` 병합 커밋 `31641eb`; 인덱스 이력은 `it_database` 커밋 `cbd81a1`.
- 최종 검증: `./gradlew clean check --rerun-tasks` BUILD SUCCESSFUL(8분 27초, 단위 테스트 2,205건·실패 0·오류 0·skip 1, JaCoCo·Spotless 통과), 이어서 `./gradlew integrationTest --rerun-tasks` BUILD SUCCESSFUL(57건·실패 0·오류 0·skip 0).

### ✅ 2026-07-25 TASK.md 완료 항목 정리 이관

> `TASK.md` Clean Code 부채 §에서 `✅ Done` 항목을 활성 목록에서 제거하고 정리했습니다. CQ-02·03·04·05·07·08·10·11·12·13·14는 아래 2026-07-21 Clean Code Wave 0·1·2 절에 이미 완료 근거가 등재되어 있어(중복 잔존분) `TASK.md`에서만 제거했습니다. 아직 미이관 상태였던 `CQ-09`만 아래에 완료 근거를 신규 등재합니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | CQ-09 | 파일 업로드 서비스 추출 후 `FileService`의 dead code 제거 | 2026-07-19 확인: 업로드 경로 생성·디렉터리 준비·UUID 채번은 `FileUploadUnitService`로 이동했고 `FileService`의 잔여 private 메서드·필드·import는 모두 사용 중이라 제거 대상 dead code가 없음을 확인했다. 추출 커밋 `d25dc87`, 후속 정리 `bb5b64c`(2026-07-25 두 커밋 모두 it_backend 저장소에 존재 재확인). |

### ✅ 2026-07-21 Clean Code Wave 2 (구조·타입 개선)

> Clean Code 부채 이행계획(`docs/superpowers/plans/2026-07-21-clean-code-wave2-structure-types.md`)의 Wave 2를 완료했습니다. Wave 0에서 구축한 안전망(PDF 구조 스냅샷·`test:e2e:core`·커버리지 게이트) 위에서 모두 기능 불변으로 수행했습니다. 분해 전 검증 기준은 `docs/superpowers/notes/2026-07-21-wave2-qa-checklist.md`에 고정했습니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | CQ-11 | `default`·`admin` 레이아웃의 중복 앱 셸 공통화 | 템플릿·스타일이 100% 동일하던 두 레이아웃의 골격을 `components/AppShell.vue`로 추출하고 각 레이아웃을 얇은 래퍼로 전환했다. 레이아웃 이름(`default`/`admin`)과 페이지의 `layout: 'admin'` 선언, 라우트 가드 구조는 그대로 유지된다. 일반·관리자 화면 E2E(core 14건 + access-control·realtime-logs 9건) 통과. it_frontend 커밋 `c26d0d5`. |
| ✅ Done | CQ-03 | 프로덕션 `any` 타입 우회 제거 | 4개 배치로 나눠 제거했다. 배치① 결재·사업집행(`ccd17ae`, `c45d78e`) — 공용 `getErrorMessage(unknown, fallback)`를 `utils/common.ts`에 추가해 `catch (e: any)` 패턴을 대체. 배치② Tiptap·Excel·PDF(`486b629`, `344d759`, `cd919b7`) — `@tiptap/core`·exceljs 제공 타입 적용, pdfmake 0.3 런타임과 0.2 타입 선언의 불일치는 `pdf/compat.ts` 단일 경계로 격리. 배치③ 가이드 문서(`8e14f43`). 배치④ 예산·인라인편집·info·잔여(`20a4f42`, `ac75df1`, `965e4a3`). 정당 사유 잔여는 3건(파일·사유는 TASK.md 기재)이며 각 지점에 사유 주석이 있다. |
| ✅ Done | CQ-02 | 대형 프론트 composable/page 분해 | 4개 파일을 façade·ctx 팩토리 패턴으로 분해했다(모두 기능 불변, 템플릿·페이지 무변경). ① IT예산 PDF: 1,290 → **661줄**, `pdf/` 4모듈(fonts·textPrimitives·headerSection·projectSection) — 각 커밋마다 CQ-04 스냅샷 `passed`(재작성 없음) 확인(`1005f73`~`83df597`). ② 계획 상세: 2,158 → **1,239줄**, `features/plan/` 5모듈(Excel·HWPX·PDF·인쇄·TOC)(`f1c4ad0`~`0f9834b`). ③ 사업 폼: 2,192 → **1,229줄**, `features/project/` 6모듈(모델·코드필드·직원검색·저장·계속사업·로드)(`06edd16`~`7233cd8`). ④ 전산업무비 목록: façade **380줄** + `costList/` 7모듈 — 공개 키 82개 기준선 테스트로 계약 불변을 고정했고 소비 페이지 `pages/info/cost/index.vue`는 0변경(`84b4679`~`d51d07f`). |

- 최종 검증: `npm run check` 0 errors, `npm test` 128 파일/1,645건 통과, `npm run test:e2e:core` 14건 통과. 도메인별로 `budget`·`cost`·`documents`·`projects`·`tiptap-variable` spec을 각 분해 단계에서 함께 실행했다.
- 수동 QA 체크리스트(`docs/superpowers/notes/2026-07-21-wave2-qa-checklist.md`)의 화면 확인 항목은 사용자 수행 대상으로 남아 있다.

### ✅ 2026-07-21 Clean Code Wave 1 (저위험 일괄 정리)

> Clean Code 부채 이행계획(`docs/superpowers/plans/2026-07-21-clean-code-wave1-low-risk-cleanup.md`)의 Wave 1을 완료했습니다. 모든 태스크는 동작 변경 없는 기능 불변 정리입니다. CQ-01·CQ-06은 Wave 3 조건부 항목으로 착수 트리거를 TASK.md에 확정했습니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | CQ-07 | Java 포맷터 도입과 매직 넘버 상수화 | Spotless(google-java-format 1.28.0 AOSP 4칸 들여쓰기) 도입 후 전체 634개 파일 일괄 포맷을 단독 커밋으로 분리했다(it_backend `ac3d058`). spotlessCheck는 check 게이트에 자동 연결된다. 편성률 매직 넘버는 `DEFAULT_DUP_RT`·`PERCENT_BASE` 상수로 정리했고(it_backend `755f278`), Toast 표시시간은 `TOAST_LIFE` 상수를 도입해 장시간 표시(5000/6000/8000) 21개소를 선도 전환했다(it_frontend `d61da36`). 잔여 3000/4000 리터럴은 신규 코드 상수 필수 규칙(it_frontend/CLAUDE.md)으로 점진 관리한다. |
| ✅ Done | CQ-08 | `AdminMenuController.move` 요청 본문 검증 규칙 재정의 | "null=루트 이동" 규칙을 현행 유지로 확정하고 코드 변경 없이 `MoveRequest` Javadoc·Swagger 스키마 설명과 컨트롤러 Javadoc에 명시했다. 빈 본문({})도 루트 이동으로 해석되며 잘못된 대상·순환 계층은 서비스 계층이 검증한다. it_backend 커밋 `a980da3`. |
| ✅ Done | CQ-10 | 미사용 프론트 컴포넌트 제거 | 자동 등록명(디렉터리 접두사·Lazy 변형 포함) 전수 grep으로 참조 0건을 재확인한 뒤 `IconActivity.vue`, `ReviewVersionHistory.vue`를 제거했다. 타입 검사·단위 테스트 통과. it_frontend 커밋 `d14d847`. |
| ✅ Done | CQ-12 | 백엔드 Gradle 프로젝트 설명 교체 | `description = 'IT Project Portal backend API'`(ASCII)로 교체. it_backend 커밋 `31e0b07`. |
| ✅ Done | CQ-14 | 미사용 REST Docs·Asciidoctor 빌드 설정 제거 | `src/docs`·REST Docs 테스트 미사용을 재확인하고 asciidoctor 플러그인, snippetsDir ext, restdocs 의존성 2건, test outputs.dir, asciidoctor 태스크 블록을 제거했다. `clean check` 통과, `tasks --all`에서 asciidoctor 태스크 소멸 확인. it_backend 커밋 `95929fd`. |

- 최종 검증: it_backend `./gradlew check` BUILD SUCCESSFUL(테스트·커버리지 게이트·spotlessCheck 포함), it_frontend `npm run check`·`npm test`(128 파일/1,636건) 통과.
- Wave 3 조건부 확정: CQ-01(대형 서비스 분해)·CQ-06(Bcostm.update record 전환)은 해당 도메인 기능 변경 착수 시 함께 수행하는 트리거를 TASK.md에 기록했다.

### ✅ 2026-07-21 Clean Code Wave 0 (검증 기반 구축)

> Clean Code 부채 이행계획(`docs/superpowers/plans/2026-07-21-clean-code-wave0-verification-foundation.md`)의 Wave 0을 완료했습니다. Wave 2 리팩터링의 안전망(커버리지 게이트·PDF 회귀 스냅샷·핵심 E2E 명령)을 구축했습니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | CQ-04 | PDF/HWPX/Excel 산출물 회귀 테스트 기준 수립 | 기존 `useItBudgetApprovalFormPdf.test.ts`에 docDefinition 정규화 구조 스냅샷(고정 표시값·표 구조·스타일·페이지 구분 보존, 함수는 `[Function]`으로 구조만 고정)을 추가하고 재실행 고정을 확인했다. HWPX/Excel은 기존 단위 테스트 5개 파일 104건이 기준선 역할을 함을 확인했다. it_frontend 커밋 `7141c7a`. |
| ✅ Done | CQ-05 | E2E 핵심 3개 시나리오를 정기 실행 경로에 편입 | `test:e2e:core` npm script로 로그인·프로젝트 조회/생성·결재 처리 3개 spec을 단일 명령으로 고정하고 실행 절차를 `it_frontend/README.md`에 문서화했다. API 전면 모킹(mockApi.ts) + 테스트 쿠키 주입 방식이라 백엔드·Oracle 기동이 불필요하다. it_frontend 커밋 `6921ab6`. |
| ✅ Done | CQ-13 | JaCoCo 커버리지 검증을 기본 `check` 게이트에 연결 | `jacocoTestCoverageVerification`에 `dependsOn test`를 추가하고 `check`가 커버리지 검증에 의존하도록 연결했다. 사전 실측에서 확인된 CLASS 위반 2건은 임시 기준선 없이 테스트 보강으로 해소했다: `FeasibilityService`(자체점검 upsert·검증 분기 8건 추가, BRANCH 0.50→1.00·COMPLEXITY 0.56→1.00), `AuthService`(토큰 패밀리 중복 예외 1건 추가, COMPLEXITY 0.69→0.72). it_backend 커밋 `1f0301d`. |

- 최종 검증: it_backend `./gradlew check` BUILD SUCCESSFUL(커버리지 게이트 포함), it_frontend `npm run check`·`npm test` 통과, `npm run test:e2e:core` 14건 통과(최초 실행 1건 플레이키 재실행 확인).

### ✅ 2026-07-20 백엔드 잔여과제 조치(Phase A~C)

> `BE-09`의 비결정 대표행 선택, `BE-10`의 팀 조회 N+1·검토자 API 계약, `BE-11`의 파일 메타 NULL 정책을 정리하고, 조사에서 승인된 `BE-03` 안전 후보를 응답 전용 프로젝션으로 전환했습니다. `BE-06`은 최신 전수 기준선으로 상위 오염원과 요청 DTO 경고를 분류·정리했습니다. `BE-07`·`BE-08`의 기존 완료 판정도 함께 종료 이관합니다.

| 상태 | Phase | 종료 항목 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | A | BE-09 비용·사업계획 대표행 결정성 | 비용 대표행 선택기를 공용화하고 최신·일련번호 tie-break를 고정했으며 사업계획 `BG_NO` 연계 키도 결정적 규칙으로 교체했다. 백엔드 병합 커밋 `78306bd`. |
| ✅ Done | B | BE-10 팀 조회 배치화·전역 검토자 API | `findByTemCInAndDelYn` 배치 조회, 팀장 우선·사번 tie-break, 전역 `/api/reviews/reviewers` 계약과 프론트 연동을 적용했다. 백엔드 병합 `d949cab`, 프론트 병합 `be2f4b5`. 구 문서별 경로 제거는 관측 조건이 남아 `TASK.md` BE-18로 추적한다. |
| ✅ Done | B | BE-11 `CFILEM` NULL 정책 통일 | 실제 Oracle과 읽기 소비 경로에 맞춰 `FL_NM`, `FL_PYS_NM`, `FL_KPN_PTH`의 ORM null 계약과 응답 처리를 일치시켰다. 백엔드 병합 `d949cab`. |
| ✅ Done | C | BE-03 안전 프로젝션 구현 | 게시글, 사용자·조직·팀 대표, 계획·안전 예산, 결재 응답, 계약·심의·지급 상세, 관리자 파일·토큰·로그인 이력, 요구사항 버전 조회를 응답 전용 프로젝션으로 분리했다. 백엔드 병합 `540d456`; 후보 판정 보고서 `docs/superpowers/reports/2026-07-be03-projection-survey.md`; Oracle 29개 repository signature·30개 before/after 시나리오 PASS 기록 `it_backend/.superpowers/sdd/task-13-step8-oracle-matrix.md`. |
| ✅ Done | C | BE-06 Javadoc 경고 분류·정리 | Task 14 기준 1,176건에서 `Bprojm`, `ContractController`, `CouncilProjectRow`, `UmsPayload`, `Btermm`과 `ApplicationDto` 요청 DTO의 122건을 해소했다. 최종 1,054건 중 `ApplicationDto` 11건은 역할별 허용 잔여이며 신규 미분류는 0건이다. 백엔드 병합 `540d456`; 최종 기록 `it_backend/.superpowers/sdd/task-17-final-verification.md`. |
| ✅ Done | 선행 확인 | BE-07 CFILEM 컬럼명 정합·BE-08 BTERMM 인덱스 검토 | 활성 Java/SQL과 실제 `TPRMPP_CFILEM` 컬럼명이 일치하고, `TPRMPP_BTERMM(BG_NO,BG_SNO)` 인덱스가 현재 조회와 데이터 규모에 충분해 추가 인덱스가 불필요함을 확인했다. |

- 최종 백엔드 검증: `./gradlew test --rerun-tasks` 2,170건(실패 0, 오류 0, Oracle 수동 통합 1건 skip), `./gradlew javadoc --rerun-tasks` 성공·1,054 warnings.
- Phase B 통합 검증: 로컬 Oracle `integrationTest` 32건(실패·오류·skip 0), 프론트 Vitest 1,633건 통과.

### ✅ 2026-07-19 보안·에러 처리 Remediation Phase 1

> `TASK.md`의 `SEC-04`, `SEC-05`, `ERR-06`을 코드·정책 문서·회귀 테스트 및 로컬 DB 적용 이력과 대조하고 구현 완료로 판정해 종료 이관했습니다. 설계는 `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md`의 Phase 1을 따릅니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | SEC-04 | Access/Refresh Token 용도 구분과 검증 강제 | JWT에 `tokenUse=access/refresh`를 발급하고 Access 필터와 Refresh 서비스가 각 용도 allowlist를 검증합니다. 과도기 Access 토큰만 claim 누락을 허용하며 Refresh 경로는 누락·오용·비문자 claim을 거부하고 401 응답과 인증 쿠키 삭제를 수행합니다. |
| ✅ Done | SEC-05 | 비게시판 업무 파일의 부모 자원 기준 읽기 권한 검증 | `FileReadAuthorizerRegistry`와 게시판·가이드·요구사항 정의서·협의회 authorizer를 적용했습니다. 미등록·null 종류는 기본 거부하고 목록·메타·다운로드·미리보기 네 경로가 동일 검증을 사용합니다. 부모 키 요청 캐시와 레거시 키 정규화도 반영했으며, `V20260719_001__NormalizeCfilemParentKeys.sql`이 로컬 DB 설치 순번 45·성공 상태로 적용된 것을 확인했습니다. |
| ✅ Done | ERR-06 | 감사로그 저장 실패의 지속 탐지·격리 | 원 업무 커밋 후 감사로그를 `REQUIRES_NEW`로 저장하고 실패를 `audit.log.write.failure` 메트릭과 구조화 ERROR 로그로 노출합니다. `ThreadLocal` 재진입 가드로 실패 기록의 재귀를 차단하고 `/actuator/metrics`는 관리자에게만 허용합니다. 감사 저장 실패가 원 업무를 롤백하지 않는 계약도 Oracle 통합 테스트로 확인했습니다. |

- 주요 구현: `it_backend` SEC-04 커밋 `c507935`, `5ecb527`, `cf70912`, `8137fc5`; SEC-05 커밋 `1608287`, `c7512cb`, `5206e6e`, `b78ef29`, `a840483`, `d8212ec`, `ee25c14`, `94601a3`, `32b1f22`, `fb0f7ea`, `2d34dc6`, `82f5b06`; ERR-06 커밋 `66d3658`, `05e2689`, `0a337bf`, `cbf770e`, `6627817`, `204df59`, `0506a7c`.
- DB 정합화: `it_database` 커밋 `3183b60`, `it_database/migrations/V20260719_001__NormalizeCfilemParentKeys.sql`; 로컬 `ITPOWN.FLYWAY_SCHEMA_HISTORY` 적용 성공 확인.
- 2026-07-19 재검증: SEC-05 코드 범위를 포함한 선별 단위·서비스·컨트롤러 테스트 159건과 Oracle 통합 테스트(`FileReadAuthorizationIT`, `AuditFailureIsolationIT`) 11건 모두 통과(실패·오류·스킵 0건).

### ✅ 2026-07-19 보안·에러 처리 Remediation Phase 2

> `TASK.md`의 `SEC-03`, `SEC-07`, `ERR-07`을 구현·검증하고 종료 이관했습니다. 설계는 `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md`, 실행 계획은 `docs/superpowers/plans/2026-07-19-security-error-handling-remediation-phase-2.md`를 따릅니다. SEC-06은 원문 제거 마이그레이션의 Flyway 버전 중복, ERR-05는 그 뒤 마이그레이션 미적용이 재확인되어 `TASK.md`로 환원했습니다(이후 아래 2026-07-19 배포 정합성 후속에서 종료).

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | SEC-03 | GWE `IF_ID` 설정 단일화 | `GweProperties`와 `eai.gwe.if-id`를 유일한 설정 원천으로 적용하고 dispatcher·집행 4단계의 중복 상수를 제거했습니다. |
| ✅ Done | SEC-07 | 운영 위험 토글 기동 차단·SSO 세션 고정 방어 | `prod`에서 mock SSO·Bearer 폴백·`Secure=false`를 fail-fast 처리하고 SSO 인증 성공 시 세션 ID를 교체합니다. |
| ✅ Done | ERR-07 | 정상 빈 상태와 조회·변환 실패 UI 분리 | 에디터·자동완성·통화·예산기간·사업개요·과거버전·PDF/인쇄 경로에 경고, 재시도, 기존 데이터 유지 또는 대체 출력을 적용했습니다. |

- 주요 파일: `it_backend/common/system/service/AuthService`, `EnvironmentValidator`, `common/notification/**`, `infra/eai/config/GweProperties`, `it_frontend/app/components/editor/**`, `app/composables/**`, `app/pages/**`, `app/stores/review.ts`
- 검증 명령: `it_backend ./gradlew clean test`, `it_frontend npm run format:check`, `npm run check`, `npm test`, `npx playwright test tests/e2e/security-error-remediation-phase2.spec.ts --project=chromium`

### ✅ 2026-07-19 보안·에러 처리 배포 정합성 후속 (SEC-06·ERR-05)

> Phase 2에서 `TASK.md`로 환원했던 `SEC-06`(Flyway 버전 중복)·`ERR-05`(알림 outbox 마이그레이션 미적용)를 마이그레이션 개번·적용·검증 완료로 종료 이관했습니다.

| 상태 | ID | 과제 | 완료 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | SEC-06 | Refresh Token 원문 제거 마이그레이션의 Flyway 버전 중복 해소·적용 | `it_database` 커밋 `0e286a6`이 `V20260719_001__RemovePlainRefreshToken.sql`을 `V20260719_003`으로 개번했습니다(성공 적용된 SEC-05 `V20260719_001__NormalizeCfilemParentKeys.sql`은 미수정, 설치 순번 45 유지). 로컬 `ITPOWN.FLYWAY_SCHEMA_HISTORY`에 설치 순번 47·버전 `20260719.003`·성공 상태로 2026-07-19 적용을 확인했습니다. 적용 후 `TPRMPP_CRTOKM.API_TOK_CONE`은 NULL 허용으로 전환되고 전 행 원문이 NULL이며, `ECY_RNW_PUB_TOK_CONE`은 NOT NULL로 전환되고 해시 누락 0행입니다. |
| ✅ Done | ERR-05 | 알림 outbox 상태 마이그레이션 적용 | `V20260719_002__AddNotificationDispatchState.sql`이 설치 순번 46·성공 상태로 2026-07-19 적용을 확인했습니다. `TPRMPP_CINFMM`에 `INFM_SD_STS_C`(NOT NULL, 기본 '02')·`RE_TRY_NOT`(NOT NULL, 기본 0)·`ERR_CONE`(NULL 허용) 컬럼과 `IX_CINFMM_SD_RETRY(INFM_SD_STS_C, RE_TRY_NOT, SD_DTM)` 인덱스가 생성됐습니다. 재시도 동작은 `NotificationDispatchServiceTest`·`CinfmmTest` 단위 6건과 `CinfmmRepositoryImplTest` 로컬 Oracle 통합 2건 통과로 검증했습니다. |

- 검증 명령: `it_backend ./gradlew test --tests '*NotificationDispatchServiceTest' --tests '*CinfmmTest' --tests '*CinfmmRepositoryImplTest'`, `./gradlew integrationTest --tests '*CinfmmRepositoryImpl*'` 모두 성공(실패·오류·스킵 0건).

### 🧩 2026-07-02 협의회 후속 정비 + 작성자 소속 컬럼

> `TASK.md`에서 종료 이관. 협의회 관리 액션 서버 권한·컬럼 드리프트·생략판정 필터 3건은 `REVIEW.md` 델타 정비 중 라이브 스키마/코드 대조로 완료 확인. 작성자 소속 컬럼(AuthorOrg)은 신규 구현·테스트 완료. 코드 커밋은 중첩 repo(`it_backend` main `20fcafb`·`769130a`·`9432023`, `it_database` main `6feb16e`).

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 협의회 개최준비 전이의 서버 권한·심의유형 범위 검증 추가 — ITPAD001 전체 심의유형, ITPAD002 `dbrTc='04'`만 허용을 서비스 최종 경계로 적용 | `CouncilService.verifyCouncilManager(asctId, userDetails)` 신설(admin∪정보보호관리자+dbrTc04) + `CouncilController` 관리 액션 12개(start/complete/start-preparation/schedule confirm·confirm-written/result save·update·confirm·approval/notify)에 principal 가드 부착, skip·approval콜백은 `verifyAdmin` 전용. 커밋 `9432023`, 종료일: 2026-07-02 |
| ✅ Done | 🟠 High | [버그] 협의회 `CouncilRepository` BPROJM 컬럼 드리프트 2건 (`task_11b75a35`) — 라이브 스키마 대조로 `p.BBR_C`는 `p.SVN_DPM_C`(존재)로 정합, `IT_PTL_STS_TC`는 BPROJM이 아닌 `ps.`(TPRMPP_BPROJA 서브쿼리) 대상이며 BPROJA에 컬럼 존재 확인 → `ORA-00904` 미발생. 협의회 리팩토링 과정에서 해소됨 | `CouncilRepository.findByDepartment`/`findProjectsForCouncilAll`/`findProjectsForCouncilByDepartment`, 라이브 `all_tab_columns`(ITPOWN.TPRMPP_BPROJM: `SVN_DPM_C`/`IT_PTL_RPR_STS_TC`, TPRMPP_BPROJA: `IT_PTL_STS_TC`), 검증일: 2026-07-02 |
| ✅ Done | 🟢 Low | 생략 판정 요청 목록의 삭제여부 필터를 DB 쿼리로 이동 — `getActiveSkipRequests()`가 `findByDelYn("N")`로 DB 필터 적용(기존 `findAll()` 후 JVM 필터 제거) | `CouncilSkipService.getActiveSkipRequests()`, `BaskpmRepository.findByDelYn`, 커밋 `769130a`, 종료일: 2026-07-02 |
| ✅ Done | 🟡 Medium | 작성자 소속 컬럼(AuthorOrg) 신규 구현 — `AuthorOrg`(record)/`AuthorOrgResolver`(사번→CuserI 조회로 주관부서·주관팀·인사상위조직 스냅샷) 추가, BPROJM `SVN_TEM_C`·BCOSTM `PRLM_HRK_OGZ_C_CONE`·BRDOCM `SVN_DPM_C`/`SVN_TEM_C`(+ `*L` 미러)를 신규 생성 시 작성자 기준으로 채움. `V20260701_002`는 2026-07-06 로컬 DDL 확인 기준으로 dev/prod 적용 완료 판정 | `common/iam/service/AuthorOrg*`, `ProjectService`/`CostService`/`ServiceRequestDocService`, `it_database/migrations/V20260701_002`, 커밋 `20fcafb`/`6feb16e`, 종료일: 2026-07-02 |

### 🗄️ 2026-07-06 DB/JPA dev/prod 적용 확인

- ✅ P4 후보 인덱스 `V20260629_002~005` 적용 확인
  - 근거: `it_database/ITPOWN_DDL_live.sql`
  - 확인 인덱스: `IX_BASCTM_PRJ_DEL`, `IX_BCMMTM_ENO_DEL_ASCT`, `IX_BRDOCM_DEL_DOC_VRS_FED`, `IX_BRIVGM_DOC_VRS_DEL_FED`
- ✅ 작성자 소속 컬럼 `V20260701_002` 적용 확인
  - 근거: `it_database/ITPOWN_DDL_live.sql`
  - 확인 컬럼: `BPROJM/BPROJL.SVN_TEM_C`, `BCOSTM/BCOSTL.PRLM_HRK_OGZ_C_CONE`, `BRDOCM/BRDOCL.SVN_DPM_C/SVN_TEM_C`
- 판정 기준: 로컬 DDL(`C:\it\it_database\ITPOWN_DDL_live.sql`)에 적용 완료가 확인되면 dev/prod도 적용 완료로 간주한다.

### ✅ 2026-07-07 TASK 잔여 조치(Subagent-Driven)

> `TASK.md`의 에러 처리, DB/JPA, 프론트/백엔드 리팩토링 잔여 중 구현 가능한 항목을 Subagent-Driven 방식으로 조치하고 이관. DB 컬럼은 사용자 결정에 따라 `API_TOK_HASH_CONE`이 아니라 `ECY_RNW_PUB_TOK_CONE`(암호화갱신발행토큰내용, `VARCHAR2(900)`)로 반영.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | Refresh Token 원문 조회 대신 암호화갱신발행토큰내용 기반 조회·UNIQUE 인덱스 정합화 | `it_backend` `f9912d7`, `1c48abc`; `it_database` `f02d3b9`. `Crtokm.ECY_RNW_PUB_TOK_CONE`, `RefreshTokenRepository.findByEcyRnwPubTokCone`, 기존 원문 fallback/backfill 테스트 완료 |
| ✅ Done | 🟡 Medium | Tiptap metadata 캐시 null 부서 키 격리 | `it_backend` `f9912d7`, `1c48abc`. `metadataCacheKey`: `ANONYMOUS`/`ALL`/`DEPT:<bbrC>`/`USER_NO_DEPT:<username>` 테스트 완료 |
| ✅ Done | 🟠 High | 예산 작업 DUP 기준코드 조회 실패 시 계산·저장 차단 | `it_frontend` `88d0565`. `work.vue` loaded/error 상태와 toast, 저장·계산 guard 반영 |
| ✅ Done | 🟠 High | HWPX 이미지 변환 실패 부분 성공 결과·누락 목록 노출 | `it_frontend` `88d0565`. `convertHtmlImagesForHwpx()`가 `{ images, failures }` 반환, export warning 및 단위 테스트 반영 |
| ✅ Done | 🟡 Medium | 감사로그 리플렉션 필드 접근·설정 실패 진단 보강 | `it_backend` `f9f24a5`, `6854fbe`. `targetClass`/`fieldName` warn 경로와 회귀 테스트 반영 |
| ✅ Done | 🟡 Medium | 정보기술부문 예산 조회/비교 화면 Mock 제거와 API wiring | `it_frontend` `a8ce04d`, `7e1d4f3`; `it_backend` `6854fbe`. summary/comparison API 연결, FSS mapping 응답 DTO·화면 렌더링 반영 |
| ✅ Done | 🟡 Medium | `useProjects`/`useTabs` 타입 정리와 파일 크기 표시 일부 공통화 | `it_frontend` `a8ce04d`. 프로젝트 mutation payload 타입, 최소 라우트 입력 타입, 문서 form/detail·`AttachmentNodeView` `formatFileSize` 공통 유틸 사용 |
| ✅ Done | 🟡 Medium | 파일 다건 업로드 부분 성공 트랜잭션 계약 정리 | `it_backend` `d25dc87`. `FileUploadUnitService` `REQUIRES_NEW`, `uploadFiles` per-file success/fail 응답, 두 번째 DB 저장 실패 회귀 테스트 반영 |
| ✅ Done | 🟡 Medium | 감사로그 리스너·EstimateRepository 로컬 Oracle 통합 테스트 보강 | `it_backend` `d25dc87`. `AuditLogPersisterIntegrationTest`, `EstimateRepositoryIntegrationTest` 추가 |
| ✅ Done | 🟢 Low | `EaiServiceTest`에 `umsTrSno=""`/비숫자 케이스 추가 | `EaiServiceTest.umsTrSnoBlank_returnsFailure`, `EaiServiceTest.umsTrSnoNonNumeric_returnsFailure`가 `Integer.parseInt` 실패 → `EaiResult.failure` 경로를 검증 |

검증:
- Backend focused: `./gradlew --no-daemon test --tests AuthServiceTest --tests TiptapVariableServiceTest --tests ItBudgetServiceTest --tests ItBudgetControllerTest --tests AuditLogPersisterTest --tests FileServiceTest --warning-mode all` 성공.
- Backend integration: `./gradlew --no-daemon integrationTest --tests EstimateRepositoryIntegrationTest --tests AuditLogPersisterIntegrationTest --warning-mode all` 성공.
- Frontend focused: `npm test -- tests/unit/utils/hwpx-images.test.ts tests/unit/composables/useTabs.test.ts tests/unit/utils/common.test.ts` 성공(182 tests).
- Backend full: `./gradlew --no-daemon cleanTest test --warning-mode all` 성공. Frontend `npm run typecheck`는 기존 테스트 fixture 타입 오류(`tests/e2e/generate-report.ts`, 다수 unit test fixture)로 실패하며 이번 변경 파일 진단은 확인되지 않음.

### ✅ 2026-07-07 무테이블 DDL 잔여 개선

> `TASK.md`에서 DB 테이블/컬럼/PK 변경이 불필요한 항목만 선별해 Subagent-Driven 방식으로 구현·검증. 중첩 저장소별로 커밋했으며, 루트 저장소에서 무시되는 하위 저장소 파일은 각 저장소 내부에서만 커밋했다. 실행 계획: `docs/superpowers/plans/2026-07-07-task-no-table-ddl-improvement.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | SEC-01 Refresh Token 회전 동시성·활성 토큰 1개 불변식 강화 | `it_backend` `db7322d..46b6959`; `AuthService`, `AuthServiceTest`. 검증: `./gradlew test --tests com.kdb.it.common.system.service.AuthServiceTest --warning-mode all`, `./gradlew test --warning-mode all` |
| ✅ Done | 🟡 Medium | SEC-02 부서코드 없는 비관리자 조회 차단 | `it_backend` `db7322d`; `PaymentService`, `PaymentServiceTest`. 검증: `./gradlew test --tests com.kdb.it.domain.payment.service.PaymentServiceTest --warning-mode all` |
| ✅ Done | 🟡 Medium | ERR-01 문서 버전 본문·코멘트·이력 조회 실패를 `loadWarnings` 기반 오류 상태로 표시 | `it_frontend` `df3fb05..9664e78`; `stores/review.ts`, `pages/info/documents/[id]/*`, `review.direct.test.ts`. 검증: `npm test -- tests/unit/stores/review.direct.test.ts`, `npm run typecheck` |
| ✅ Done | 🟡 Medium | ERR-02 클립보드 기록 실패 중복 제한 진단 추가 | `it_frontend` `df3fb05`; `useTableCellSelection.ts`, 관련 단위 테스트. 검증: `npm test -- tests/unit/composables/useTableCellSelection.direct.test.ts` |
| ✅ Done | 🟡 Medium | FE-01 `info/index.vue` KPI·진행현황 정적 데이터 API 기반 전환 | `it_frontend` `85461b1`; `app/pages/info/index.vue`. 검증: `npm run typecheck` |
| ✅ Done | 🟢 Low | FE-02 예산 목록/승인 화면 금액 0 표시 정책 보정 | `it_frontend` `0463584`; `budget/approval.vue`, `budget/list.vue`. 검증: `npm test -- tests/unit/composables/useTiptapVariables.test.ts`, `npm run typecheck` |
| ✅ Done | 🟡 Medium | BE-01 HWPX/문서 내보내기 회귀 테스트 범위 확대 | `it_frontend` `32348d8`; `hwpx.test.ts`, `hwpx-images.test.ts`, `useHwpxExport.direct.test.ts`. 검증: `npm test -- tests/unit/utils/hwpx.test.ts tests/unit/utils/hwpx-images.test.ts tests/unit/composables/useHwpxExport.direct.test.ts` |
| ✅ Done | 🟡 Medium | BE-02 `CinfmmRepositoryImpl` Oracle 통합 테스트 추가 | `it_backend` `53bc356`; `CinfmmRepositoryImplTest`. 검증: `./gradlew integrationTest --tests "*CinfmmRepositoryImpl*" --warning-mode all` |
| ✅ Done | 🟡 Medium | BE-03 `ProjectRepositoryImpl`/`CostRepositoryImpl` 목록 프로젝션 회귀 가드 추가 | `it_backend` `53bc356`; `ProjectRepositoryImplTest`, `CostRepositoryImplTest`. 검증: `./gradlew test --tests "*ProjectRepositoryImpl*" --tests "*CostRepositoryImpl*" --warning-mode all` |
| ✅ Done | 🟡 Medium | BE-04 품목 금액 환율 환산 규칙 통일 — `BITEMM.amt`는 KRW 금액으로 직접 합산 | `it_backend` `c2aa574..d407430`; `BudgetWorkService`, `ProjectBudgetSummaryService`, Budget query repositories. 검증: `./gradlew test --tests "*BudgetWorkService*" --tests "*ProjectBudgetSummaryService*" --warning-mode all` |
| ✅ Done | 🟢 Low | BE-05 알림 문구 null-safe 말줄임 공통화 | `it_backend` `53bc356`; `NotificationMessageFormatter`, `ApplicationService`, `BoardPostService`, `BoardCommentService`, `NotificationEventListener`. 검증: `./gradlew test --tests "*NotificationMessageFormatter*" --warning-mode all` |
| ✅ Done | 🟢 Low | BE-06 `CouncilDto`·`BudgetStatusDto` Javadoc 경고 정리 | `it_backend` `53bc356`; DTO JavaDoc 보강. 검증: `./gradlew javadoc --warning-mode all` |
| ✅ Done | 🟡 Medium | TIP-01 Tiptap 변수 prop 적용 범위 확대 | `it_frontend` `85461b1..3f3c4ac`; 문서/계획/게시판/가이드 페이지. 검증: `npm test -- tests/unit/composables/useTiptapVariables.test.ts`, `npm run typecheck` |
| ✅ Done | 🟡 Medium | TIP-04 VariableNodeView 작성 직후 `resolveTokens` 호출 및 비동기 응답 병합 보강 | `it_frontend` `85461b1..0463584`; `TiptapEditor.vue`, `useTiptapVariables.ts`. 검증: `npm test -- tests/unit/composables/useTiptapVariables.test.ts`, 재리뷰 clean |
| ✅ Done | 🟡 Medium | LOG-01 `/api/admin/realtime-logs` 관리자/일반/미인증·커서 검증 보강 | `it_backend` `87ed5bd`; `RealtimeLogControllerTest`, `RealtimeLogRepositoryTest`. 검증: `./gradlew test --tests "*RealtimeLog*" --warning-mode all` |
| ✅ Done | 🟡 Medium | LOG-02 라이브 피드 행 클릭에서 로그번호 포함 상세 이동 연결 | `it_frontend` `6f7d736`; `RealtimeDetailDrawer.vue`, `RealtimeFeedTable.vue`, `admin/logs/[logKey].vue`, E2E. 검증: `npm run test:e2e -- tests/e2e/admin/realtime-logs.spec.ts` |
| ✅ Done | 🟢 Low | LOG-03 SSE/WebSocket 전환 운영 임계치·feature flag 설계 문서화 | 루트 `3d137d6`; `docs/superpowers/notes/2026-07-07-realtime-log-explain.md`. 실제 push 구현은 별도 잔여로 유지 |
| ✅ Done | 🟢 Low | LOG-04 로그 보존 정책·아카이브 분리 View 운영 방향 문서화 | 루트 `3d137d6`; 신규 테이블 없이 운영 정책 노트 작성. 실제 보존기간 시행은 별도 잔여로 유지 |
| ✅ Done | 🟢 Low | LOG-05 실시간 로그 즐겨찾기·필터 브라우저 저장 | `it_frontend` `c1f14a9`; key `it-portal:realtime-log-preferences:v1`, schema `{ version: 1; favoriteLogKeys: string[]; filter: 'all' \| 'favorites' }`. 동일 브라우저 프로필의 UI 선호만 저장하며 서버·계정 간 동기화하지 않고 사용자·권한·인증정보·로그 행은 저장하지 않음. 검증: 단위 10/10, E2E 5/5, 전체 1,801, `npm run check` |
| ✅ Done | 🟡 Medium | LOG-06 `V_ITPAPP_LOG_FEED` 실행계획/인덱스 현황 기록 | 루트 `3d137d6`; 기존 `V20260629_005`와 `IX_CCODEL_CHG_DTM` 유효성 확인, 신규 DDL 없음 |
| ✅ Done | 🟡 Medium | LOG-07 실시간 로그 Playwright E2E 실행 | `it_frontend` `6f7d736`; `tests/e2e/admin/realtime-logs.spec.ts`. 검증: `npm run test:e2e -- tests/e2e/admin/realtime-logs.spec.ts` |
| ✅ Done | 🟡 Medium | BRD-01 게시판 본문 4000자 정책 검증 추가 | `it_backend` `61d26d4`, `it_frontend` `487bcb1`; `BoardPostDto`, board form/edit UI, controller tests. 검증: `./gradlew test --tests "*Board*" --no-daemon --max-workers=1`, `npm run test:e2e -- tests/e2e/board.spec.ts` |
| ✅ Done | 🟢 Low | BRD-04 게시판 멘션 알림 연동 확인·회귀 유지 | `it_backend` `61d26d4`; 기존 `BoardPostService`/`BoardCommentService` 알림 이벤트 경로 유지 및 테스트 통과 |
| ✅ Done | 🟢 Low | BRD-07 답변글·댓글 깊이 UI 5단계 캡 | `it_frontend` `487bcb1`; `BoardCommentTree.vue`, board detail/list 화면. 검증: `npm run typecheck`, `npm run test:e2e -- tests/e2e/board.spec.ts` |
| ✅ Done | 🟢 Low | BRD-08 게시판 검색 키워드 최소 2자 강제 | `it_backend` `61d26d4`, `it_frontend` `487bcb1`; `BoardPostService.validateSearchCondition`, board E2E. 검증: `./gradlew test --tests "*Board*"`, `npm run test:e2e -- tests/e2e/board.spec.ts` |
| ✅ Done | 🟡 Medium | BRD-09 게시물 목록 서버사이드 페이지네이션 | `it_backend` `61d26d4`, `it_frontend` `487bcb1`; backend `Page<BoardPostDto.ListItem>`, frontend `BoardPostPage`. 검증: backend Board tests + board E2E |
| ✅ Done | 🟡 Medium | BRD-10 게시판 단위/E2E 테스트 확대 | `it_backend` `61d26d4`, `it_frontend` `487bcb1`; `BoardPostControllerTest`, `BoardPostServiceTest`, `board.spec.ts`. 검증: `./gradlew test --tests "*Board*"`, `npm run test:e2e -- tests/e2e/board.spec.ts` |
| ✅ Done | 🟢 Low | EAI-03 `NotificationDispatcher` → `EaiService` 라우터 연결 | `it_backend` `56a8cee..86eaa04`; `NotificationDispatcherRouter`, `NotificationService`, `NotificationDispatcherRouterTest`. 검증: `./gradlew test --tests "*Notification*" --warning-mode all` |
| ✅ Done | 🟡 Medium | EAI-04 `Estimate`/`Deliberation`/`Contract`/`PaymentService` 상태전이 EAI side-effect 연결 | `it_backend` `56a8cee`; 4개 도메인 서비스·테스트. 검증: `./gradlew test --tests "*EstimateServiceTest" --tests "*DeliberationServiceTest" --tests "*ContractServiceTest" --tests "*PaymentServiceTest" --warning-mode all` |

검증:
- Backend Task 5 focused: `./gradlew test --tests "*RealtimeLog*" --tests "*Board*" --tests "*Eai*" --tests "*Notification*" --tests "*ApplicationServiceTest" --warning-mode all` 성공.
- Frontend: `npm run typecheck`, `npm run test:e2e -- tests/e2e/board.spec.ts`, `npm run test:e2e -- tests/e2e/admin/realtime-logs.spec.ts` 성공.
- DDL 가드: `it_database`와 `it_backend/src/main/resources` diff에서 `CREATE TABLE|ALTER TABLE|ADD .*COLUMN|DROP COLUMN|PRIMARY KEY|CONSTRAINT` 금지 패턴 없음.

### 🗄️ 2026-06-30 DB/JPA 최적화 (P0~P5)

> `TASK.md` 🗄️ DB/JPA § 12건 전체 조치 완료 이관. 페이즈별 서브에이전트 구현 + 2단계 리뷰(스펙·품질) + 폴리시. 코드 커밋은 중첩 repo(`it_backend` main `0e247a5`, `it_database` main `37fd523`). design: `docs/superpowers/specs/2026-06-29-db-jpa-optimization-design.md`, plans: `docs/superpowers/plans/2026-06-29-db-jpa-p0~p5-*.md`. 검증: 로컬 Oracle `@DataJpaTest`(`@Tag("it")`) 하네스 신설(P0).

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | [P0] 로컬 Oracle 기반 `@DataJpaTest` 통합 테스트 인프라 신설 — `AbstractOracleRepositoryTest`+`OracleAvailableCondition`(DB 미가동 자동 스킵), `application-test-it.properties`(ddl-auto=none), `integrationTest` Gradle 태스크(`@Tag("it")` 로컬 전용) | `it_backend` `support/*`, `build.gradle`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `BudgetWorkService.applyItemRates()` 전체 BBUGTM 메모리 로드+루프 Soft Delete → `@Modifying` 벌크 UPDATE(감사컬럼 수동 세팅, AuditorAware) | `BbugtmRepository.softDeleteByBseYy`, `BudgetWorkService`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `FeasibilityService.replacePerformances()` JPQL DELETE 직후 `flush()` 명시(순서 보장) | `FeasibilityService`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `EvaluationService`·`CommitteeService` 사용자명 N+1 — **기구현 확인**(`findByEnoIn`), 회귀 테스트로 고정(배치 1회·per-row 0회) | `EvaluationServiceTest`/`CommitteeServiceTest`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `CouncilService` per-evaluator count 반복 → JPQL GROUP BY 배치(`countByEnoForCouncil`)로 N+1 제거 + DB 검증 IT | `EvaluationRepository`, `CouncilService.completeCouncil`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `findProjectsForCouncilAll/ByDepartment`(18컬럼) native `Object[]` → `CouncilProjectRow.fromRow` 단일 팩토리 봉인(§5.5.4 `NativeRowMapper`), `CouncilService` 직접 캐스트 제거 | `CouncilProjectRow`, `NativeRowMapper`, `CouncilRepository`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | 나머지 Native `Object[]` 반환(`Council`/`Application`/`ServiceRequestDoc`/`LoginHistory`/`Evaluation`) → DTO `fromRow` 봉인 + 동등성 IT | `*Row` DTO 5종, 각 Repository default 래퍼, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `ProjectRepositoryImpl`/`CostRepositoryImpl` `selectFrom` 전체 컬럼 → 목록용 경량 QueryDSL `Projections.constructor`(대용량 텍스트 제외), 상세 경로 불변 | `ProjectRepositoryImpl.searchListByCondition`, `CostRepositoryImpl.searchListByCondition`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | 협의회 `BASCTM`/`BCMMTM` 역방향 인덱스 — `V20260629_002`(EXPLAIN: BASCTM Full Scan 제거). 최초 dev/prod 적용은 DBA 위임으로 추적했으나 2026-07-06 로컬 DDL 확인 기준으로 적용 완료 판정 | `it_database/migrations/V20260629_002`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `BRDOCM.findLatestVersionsAll()` 복합 인덱스 — `V20260629_003`(상관 MAX 서브쿼리 cost 9→7; 외부 ORDER BY SORT는 미제거 명시). 최초 dev/prod 적용은 DBA 위임으로 추적했으나 2026-07-06 로컬 DDL 확인 기준으로 적용 완료 판정 | `it_database/migrations/V20260629_003`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | `BRIVGM` 검토의견 목록 인덱스 — `V20260629_004`(EXPLAIN: SORT ORDER BY 제거, cost 3→2). 최초 dev/prod 적용은 DBA 위임으로 추적했으나 2026-07-06 로컬 DDL 확인 기준으로 적용 완료 판정 | `it_database/migrations/V20260629_004`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | 실시간 로그 피드 `V_ITPAPP_LOG_FEED` 실행계획 검증 — 뷰가 20개 *L UNION ALL이라 단일 커버 인덱스 불가; 누락된 `TPRMPP_CCODEL(CHG_DTM)`만 `V20260629_005` 보완(집계 24→22). 피드 스냅샷 경로는 인덱스 효과 없음(☑️ 감내). 2026-07-06 로컬 DDL 확인 기준으로 적용 완료 판정 | `it_database/migrations/V20260629_005`, EXPLAIN 노트 `docs/superpowers/notes/2026-06-29-p4-explain-results.md`, 종료일: 2026-06-30 |
| ✅ Done | 🟡 Medium | [T13] 캐시 TTL 미적용 보완 — `ConcurrentMapCacheManager`→`CaffeineCacheManager`(per-cache TTL: codes*/menuAuthMap 1h, tiptapMetadata 10m, unread 60s), `TransactionAwareCacheManagerProxy`로 evict 커밋 후 지연, `ProjectService` 쓰기경로 `tiptapMetadata` `@CacheEvict` 추가. 캐시명 6종·기존 evict 의미 보존 | `CacheConfig`, `ProjectService`, `spring-boot-starter-cache`, 종료일: 2026-06-30 |

### 🔒 2026-06-29 보안하드닝 정비

> 보안 하드닝 착수 정비. `TASK.md`에서 종료 이관한 항목. plan: `docs/superpowers/plans/2026-06-29-security-hardening.md`, design: `docs/superpowers/specs/2026-06-29-security-hardening-design.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | 클래스 JavaDoc 누락 컨트롤러 소수 잔여 (전수 86% 완료) — `AdminMenuController`/`AdminRouteController`/`MenuQueryController` 클래스 JavaDoc 보강 완료로 종료 | W2b PR-2 `30dc249`, 종료일: 2026-06-29 |

### 🔒 2026-06-29 보안 하드닝 구현

> `TASK.md` 🔒 보안 § 잔여 6건 구현 완료 이관(#1·#2·#3·#5·#6·#7). 코드 커밋은 중첩 `it_backend`/`it_frontend`/`it_database` repo. #4 Blocklist는 감내(☑️ Accepted)로 종료 이관. plan: `docs/superpowers/plans/2026-06-29-security-hardening.md`, design: `docs/superpowers/specs/2026-06-29-security-hardening-design.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 결정 + CLAUDE.md 명시 — `app.auth.allow-bearer-header` 플래그로 게이팅(base/prod=false, dev/local=true), 헤더 폴백 비활성 시 쿠키 전용 | `JwtAuthenticationFilter`, `it_backend/CLAUDE.md §5.6`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `it-portal-user` 쿠키 변조 시 프론트 관리자 가드 E2E 검증 — 백엔드 경계 테스트 `AdminSecurityBoundaryTest`가 `/api/admin/**`은 JWT 필수(`it-portal-user` 무시)→401 입증, 프론트 E2E 스펙 `access-control.spec.ts` 추가(로컬 실행) | `AdminSecurityBoundaryTest`, `tests/e2e/access-control.spec.ts`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | SSO 운영 설정 검증 강화 — `EnvironmentValidator`가 prod에서 `allow-direct-eno`/`frontend-url`/cors 이미 차단, `app.dev.user-switch.enabled=true` prod 가드 추가. `getClientIp`는 이미 `ClientIpResolver`(trusted-proxy) 적용. CLAUDE.md §5.6 정정 | `EnvironmentValidator`, `ClientIpResolver`, `it_backend/CLAUDE.md §5.6`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | [후속/T10] Refresh Token 재사용 탐지(토큰 패밀리/세대) — `TPRMPP_CRTOKM`에 `FAM_NM`/`AVL_YN` 추가(Flyway `V20260629_001`), `AuthService` 패밀리 회전 + 재사용 탐지(회전 grace 윈도우로 다중탭 오탐 방지) | `TPRMPP_CRTOKM`(`V20260629_001`), `AuthService`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | Tiptap 변수 metadata 프로젝트 카탈로그 권한 필터링 — `getMetadata(user)` 부서(bbrC) 필터(ADMIN/부서매니저 전체), 캐시 키 사용자 부서 기준 분리 | `TiptapVariableController.java`, `TiptapVariableService.java`, 종료일: 2026-06-29 |
| ✅ Done | 🟡 Medium | 사업집행 4단계 `changeStatus` role 분기(구 [W3 카브아웃]) — ADMIN 전용 전이로 구현(`OwnershipVerifier.verifyAdmin`, 4개 서비스 적용), CLAUDE.md §5.18 갱신 | `EstimateService`/`DeliberationService`/`ContractService`/`PaymentService`, `OwnershipVerifier.verifyAdmin`, `it_backend/CLAUDE.md §5.18`, 종료일: 2026-06-29 |
| ☑️ Accepted | 🟡 Medium | Access Token Blocklist 도입 검토 — stateless JWT·access 15분 단기·사내 3천명 조건에서 잔존 access(최대 15분) 위험 수용 | `AuthService.logout()`은 refresh 삭제, T10 재사용 탐지로 탈취 대응. 2026-06-29 감내 결정 |

### 🔒 보안

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🔴 Critical | 베이스/운영 `application.properties` 비밀값 기본값(`DB_PASSWORD`, `JWT_SECRET`) 제거 — 빈값이면 `EnvironmentValidator`가 기동 차단. local/dev 프로파일의 개발 기본값은 운영 배포 체크리스트에서 별도 확인 | `application.properties`, `application-prod.properties` 검증일: 2026-06-21 |
| ✅ Done | 🟠 High | `FileController`·`GeminiController` 등 `@PreAuthorize` 미적용 컨트롤러에 소유권 검증 또는 권한 어노테이션 추가                                                         | `FileOwnershipChecker` 적용, `GeminiController` ADMIN 전용                                |
| ✅ Done | 🟠 High | 로그인 Brute-force 보호 — 연속 실패 횟수 임계값(예: 5회/10분) + 계정 잠금 또는 지연 응답 적용                                                                              | `LoginAttemptService` 구현, `AuthService.login()` 연동                                    |
| ✅ Done | 🟠 High | 파일 업로드 확장자 화이트리스트 검증 추가 (`FileService.uploadFileInternal()`)                                                                                  | `FileValidator` 구현, `FileService` 연동                                                  |

#### 🔐 2026-06-23 소유권/권한 검증 하드닝 (`feature/ownership-authorization-hardening`)

> 공통 유틸 `OwnershipVerifier.verifyOwnerOrAdmin(ownerEno, user)`(`common/system/security`, 실패 시 `AccessDeniedException`→403) 표준 도입 후 쓰기·읽기 경로에 일괄 적용. 전체 백엔드 테스트 스위트 통과(`./gradlew clean test` BUILD SUCCESSFUL).

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `FileController` 다운로드/미리보기/단건조회/목록조회에 파일 읽기 권한 검증 적용 | `FileOwnershipChecker.checkReadAccess()`/`canRead()` 적용, 완료일: 2026-06-23 |
| ✅ Done | 🟠 High | `FileController.updateFileMeta()`와 `deleteFilesByOrc()`에 소유권/관리자 권한 검증 추가 | updateFileMeta→소유권 검증, deleteFilesByOrc→owner-or-admin(403), 완료일: 2026-06-23 |
| ✅ Done | 🟠 High | 요구사항 정의서 생성/수정/삭제/새 버전 생성 API 소유권 검증 추가 | `ServiceRequestDocService` update/createNewVersion/delete에 `OwnershipVerifier` 적용, 컨트롤러 `@AuthenticationPrincipal` 전달, 완료일: 2026-06-23 |
| ✅ Done | 🟠 High | 사업집행 4단계 서비스 쓰기 메서드(update/delete/changeStatus/save*) 소유자/관리자 검증 추가 | `EstimateService`/`DeliberationService`/`ContractService`/`PaymentService`에 `OwnershipVerifier.verifyOwnerOrAdmin` 적용, 완료일: 2026-06-23 |
| ✅ Done | 🟡 Medium | `GET /api/documents/dashboard`·`/badge-count` — 클라이언트 제공 `bbrC` 신뢰 제거, 서버측 검증 | 관리자=요청값, 비관리자=JWT 클레임 `bbrC` 서버측 강제, 완료일: 2026-06-23 |
| ✅ Done | 🟡 Medium | 소유권 검증 403 표준화 — `BoardPostService`/`BoardCommentService` 본인 게시물·댓글 수정/삭제 실패 400→403 | `OwnershipVerifier.verifyOwnerOrAdmin()`(`AccessDeniedException`)로 통일, 완료일: 2026-06-23 |
| ✅ Done | 🟢 Low | `it_backend/CLAUDE.md §5.18` 보안 규칙에 `OwnershipVerifier`를 소유권 검증 표준 수단으로 명시 | §5.18 보안 규칙 블록 갱신, 완료일: 2026-06-23 |

### ⚠️ 에러 처리 (백엔드 Critical+High, `feature/error-handling-backend`)

> `TASK.md` "에러 처리" 백엔드 3건 해소. 전체 백엔드 테스트 스위트 `./gradlew test` BUILD SUCCESSFUL, 프론트 `npm run typecheck` 통과. 설계/계획: `docs/superpowers/specs/2026-06-23-backend-error-handling-design.md`, `docs/superpowers/plans/2026-06-23-backend-error-handling.md`. (프론트 에러 처리 sweep 12건은 `TASK.md`에 잔존)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🔴 Critical | `ApplicationService.getApplicationsByIds()`·`ProjectService.getProjectsByIds()`·`CostService.getCostsByIds()` — `null` 반환 + `Objects::nonNull` 필터 제거, 부분 성공 래퍼 `*Dto.BulkResponse{items, failedIds}` 반환 + 실패 ID `log.warn`. 컨트롤러 3곳·프론트 `useProjects`/`useCost` 언랩(failedIds 시 toast 경고)까지 반영 | `BulkResponse` 도입, 완료일: 2026-06-24 |
| ✅ Done | 🟠 High | `NotificationEventListener.onApprovalCompleted()`·`onApprovalRecalled()` — AFTER_COMMIT 핸들러에 `@Transactional(REQUIRES_NEW)` 추가(§5.16, `NotificationService.send()`와 동일 근거) | `NotificationEventListener.java`, 완료일: 2026-06-24 |
| ✅ Done | 🟠 High | `ChangeLogEntityListener.persistLog()` 감사로그 실패 로그 `log.warn`→`log.error` 승격(모니터링 알람 노출) + 운영 알람 확장점 주석 | `ChangeLogEntityListener.java`, 완료일: 2026-06-24 |

### 📦 의존성 취약점 (Snyk, 업스트림 미해결)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✔️ Resolved | 🟠 High | `io.jsonwebtoken:jjwt-jackson@0.13.0` 전이 `jackson-core@2.12.7` Snyk 거짓 양성 — `build.gradle` resolutionStrategy에서 `jackson-core`/`jackson-databind`를 `2.21.2`로 강제. 실제 runtimeClasspath 해소 버전도 `2.21.2` 확인 (2026-05-27) | `build.gradle` jackson 2.x strict force, `./gradlew dependencyInsight` 검증 |
| ☑️ Accepted | 🟠 High | `org.springdoc:springdoc-openapi-starter-webmvc-ui@3.0.3` — 14건 전이 취약점 업스트림 패치 없음. Spring Boot 4.x 호환 최신 3.0.3 사용 중. 차기 springdoc 릴리스 모니터링 필요 | Snyk Priority 542, "Fixable issues 0" (jackson-core, spring-boot-autoconfigure 전이) |
| ☑️ Accepted | 🟡 Medium | `com.querydsl:querydsl-jpa@5.1.0` — SQL Injection(CWE-89, CVSS 6.9) 업스트림 패치 없음. 프로젝트 내 사용은 정적 Q클래스 + `BooleanBuilder` 기반으로 사용자 입력 문자열 직접 SQL 결합 경로 없음. 신규 QueryDSL 사용 시 `Expressions.template()` 등 raw 표현식 회피 | Snyk SNYK-JAVA-COMQUERYDSL-8400287, "Fixable issues 0" |

### 🤝 사전협의

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 프로젝트별 검토자 목록 서버 API 조회로 전환 + `defaultReviewers` 하드코딩 제거 | `ReviewerController` + `ReviewerService` TDD 구현, `stores/review.ts` API 연동 |

### ⚠️ 에러 처리 (주석 FIXME 등록 완료 — 코드 수정 후속)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `SsoController.complete()` catch 블록에 `log.error()` 추가                                                                                                                                               | SSO 인증 실패 원인 추적 불가 — FIXME 주석 존재                                                 |
| ✅ Done | 🟠 High | `FileService.java:318,325` IOException → `CustomGeneralException(msg, e)` — cause 전달                                                                                                                | 스택 트레이스 손실 — FIXME 주석 존재                                                         |
| ✅ Done | 🟠 High | `ApplicationService.updateApprovalLineInDetail()` private `@Transactional` 제거·`ApprovalLineDelegate` 위임 메서드 추출                                                                                      | Spring AOP 무효 — FIXME 주석 존재                                                      |
| ✅ Done | 🟠 High | `ApplicationService.java:207` 결재선 업데이트 실패 처리 방침 결정 (`warn`만 vs 예외 재발생)                                                                                                                              | @Transactional 컨텍스트에서 롤백 없이 커밋됨                                                  |
| ✅ Done | 🟠 High | `NotificationService.send()` — `recipientEno` null/blank 가드 구현 완료 (`null \|\| isBlank()` 조건 후 warn 로그 + return null) | `NotificationService.java:48-50`, 검증일: 2026-06-01 |
| ✅ Done | 🟡 Medium | `budget/approval.vue:458-460` PDF 생성 실패 시 `alert()` 사용 — PrimeVue `toast.error`로 교체 완료 | `pages/budget/approval.vue:458-459`, 검증일: 2026-06-21 |
| ✅ Done | 🟡 Medium | 프론트엔드 `alert()` → PrimeVue `toast` 교체: `approval/list.vue:204` | `pages/approval/list.vue:213-221` toast 처리 확인, 검증일: 2026-06-05 |
| ✅ Done | 🟠 High | `approval/list.vue:213-214` — 결재 처리 실패 시 `console.error`만 출력, `toast.error` 사용자 알림 없음 (CLAUDE.md 4.2.1 위반) | `pages/approval/list.vue:213-221` toast 처리 확인, 검증일: 2026-06-05 |
| ✅ Done | 🟠 High | `budget/report.vue:170-172,249-251` — PDF 생성/데이터 로드 실패 toast 및 버튼 비활성화 처리 완료 | `pages/budget/report.vue:176-184,263-270,284`, 검증일: 2026-06-21 |
| ✅ Done | 🟠 High | `info/projects/report.vue:164-166,199-201` — PDF 생성/프로젝트 로드 실패 toast 및 실패 상태 UI 처리 완료 | `pages/info/projects/report.vue:168-176,208-215,325`, 검증일: 2026-06-21 |

#### 2026-06-24 프론트엔드 에러 처리 sweep (TASK.md에서 이관, 2026-06-27)

> `TASK.md` "에러 처리" 섹션의 프론트 toast/silent-failure 26건(✅ Done 16 + ✔️ Resolved 10) 일괄 이관. 조치/확인일 2026-06-24.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] 프론트 toast 누락 다발 — 구체 사이트(`useCostListPage` 코드로드/검색, `projects/form.vue`, `terminal/[id].vue`, `ResourceTableSection` 등) 개별 항목으로 분해·조치 완료. 잔여 silent 경로는 아래 개별 행 참조 | 본 섹션 개별 행으로 분해, 조치일: 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] 사전협의 자동 저장 실패 사용자 알림 및 재시도 정책 보강 — `console.warn`과 경고 toast 적용 확인 | `pages/info/documents/[id]/review.vue:180`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟡 Medium | [확인 2026-06-24] 사전협의 버전/코멘트/검토자 — `stores/review.ts`가 실패 시 `loadWarnings` 리스트로 호출자에 전달(toast 표시)하도록 기조치 확인 | `stores/review.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] 전산업무비 일괄 업로드 실패 행/원인 상세화 — 행별 catch가 `err.data?.message` 추출해 `failedReasons` 수집, 집계 toast detail에 실패 사유 요약(최대 5건 + 외 N건) 노출 | `useCostListPage.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] HWPX 내보내기 이미지 fetch 실패 시 `src` 포함 `console.warn` 진단 로그 추가(외부 export catch는 toast 유지) | `useHwpxExport.ts`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `useTiptapImageInsertion.ts` blob URL 해제 — 성공/실패 경로 모두 `URL.revokeObjectURL()` 보장 확인(기조치) | `useTiptapImageInsertion.ts` 현행 코드 확인, 2026-06-24 |
| ✔️ Resolved | 🟡 Medium | [확인 2026-06-24] `usePdfReport.ts` 한글 폰트 로드 실패 시 `console.error` + 경고 toast('일부 글자가 깨질 수 있습니다') 후 Roboto 폴백 기조치 확인 | `usePdfReport.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] HWPX/Tiptap 실패 경로 보강 — `ExcalidrawNodeView` SVG 재생성 실패 `loadError` 표시, `useTiptapTableTools.syncColumnWidths`·`useHwpxExport` warn 로그. `hwpx-images.ts`는 선택적 null 처리로 기조치 확인 | `ExcalidrawNodeView.vue`, `useHwpxExport.ts`, `useTiptapTableTools.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `useTiptapTableTools.syncColumnWidths` 빈 catch → `catch (e)` + `console.warn` 추가 | `useTiptapTableTools.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] 손상된 `it-portal-user` 쿠키/구버전 `localStorage.user` 파싱 실패 시 `console.warn` + 손상 데이터 정리(쿠키 만료, `user.value=null`) | `stores/auth.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `info/projects/form.vue` 편집 모드 데이터 로드 실패 시 toast 후 목록 리다이렉트 적용 확인 | `pages/info/projects/form.vue:712`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `approval/[apfMngNo].vue` 결재 상세 로드 실패 — `toast.error` + `/approval/list` 리다이렉트 적용 확인(기조치) | `pages/approval/[apfMngNo].vue` 현행 코드 확인, 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `board/[blbMngNo]/[nacMngNo]/index.vue` 삭제 실패 — `console.error` + `toast.error` 적용 확인(기조치) | `pages/board/[blbMngNo]/[nacMngNo]/index.vue` 현행 코드 확인, 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `EmployeeSearchDialog.vue` 조직도·부서원 목록 로드 실패 — 양쪽 경로 `toast.error` 적용 확인(기조치) | `components/common/EmployeeSearchDialog.vue` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `ExcalidrawWrapper.vue` 내보내기·초기화·장면 복원 실패 toast 적용 확인 | `components/ExcalidrawWrapper.vue:92`, `components/ExcalidrawWrapper.vue:160`, `components/ExcalidrawWrapper.vue:201`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `useEmployeeSearch.ts` 직원 검색 실패 — warn toast + 빈 목록 처리 적용 확인(기조치) | `composables/useEmployeeSearch.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟠 High | [완료 2026-06-24] `useGlobalSearch` 실패를 빈 결과와 구분 — `console.warn` + `searchError` ref 인라인 오류 상태, `GlobalSearchBar`가 "검색 중 오류" 표시(타입어헤드 노이즈 방지로 toast 미사용). 단위 테스트 추가 | `composables/useGlobalSearch.ts`, `components/GlobalSearchBar.vue`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `useCostListPage.ts` 공통코드 로드 실패 — `toast.error` 적용 확인(기조치) | `composables/useCostListPage.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `useCostListPage` 전년도 상세 조회 폴백 실패 `console.warn` 추가(요약 데이터 폴백 추적). 자동완성 빈 결과 폴백은 정상 UX로 유지 | `useCostListPage.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `ResourceTableSection.vue` 소요자원 코드 로드 실패 시 `useToast` 추가 + `toast.error` 알림 | `components/projects/ResourceTableSection.vue`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `terminal/[id].vue` 삭제 실패 시 `useToast` import + `toast.error`(백엔드 메시지 추출) 추가 | `pages/info/cost/terminal/[id].vue`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `info/cost/form.vue` 초기 데이터 로드 실패 — `toast.error` 적용 확인(기조치) | `pages/info/cost/form.vue` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `ResultReviewProgress.vue` 상태 전이 실패 `console.warn` 기록 추가 확인 (toast 억제 유지) | `components/council/result/ResultReviewProgress.vue:60`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `council-request/[id].vue` `saveTemp`/`saveComplete`/`submitApproval` 3개 catch를 `catch (e: unknown)` + `err.data?.message` 추출로 통일 | `pages/info/council-request/[id].vue`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `council-request/[id].vue` `councilStatus` `?? '01'`→`?? null`(fail-closed). `readonly = councilStatus !== '01'`로 로드 실패(null) 시 화면 잠금, 정상 DRAFT 편집 불변 | `pages/info/council-request/[id].vue`, 조치일: 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `CommitteeSelector.vue`(위원 저장·기본위원)·`ScheduleStatus.vue`(일정 확정) catch를 `catch (e: unknown)` + `err.data?.message` 추출로 통일 | `CommitteeSelector.vue`, `ScheduleStatus.vue`, 조치일: 2026-06-24 |

### 🗄️ DB / JPA 최적화

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `BudgetWorkService.getSummary()` — 비목 루프 내 `findApprovedCostsByPrefix`/`findApprovedItemsByPrefix` N+1 → 단일 집계 쿼리 통합 | `BudgetWorkQueryRepository` 개선 완료 |
| ✅ Done | 🟠 High | `CAPPLA` 테이블 복합 인덱스(`ORC_TB_CD, ORC_PK_VL, ORC_SNO_VL, APF_REL_SNO`) 존재 여부 DDL 확인 및 미비 시 추가 | `V20260510_001__add_cappla_composite_index.sql` |
| ✅ Done | 🟠 High | `BITEMM(PRJ_MNG_NO)` 단일 컬럼 인덱스 존재 여부 확인 및 미비 시 추가 | `V20260510_002__add_bitemm_prj_mng_no_index.sql` |
| ✅ Done | 🟠 High | `Bprojm.update()` 35+ 파라미터 → `BprojmUpdateCommand` 객체 도입으로 시그니처 단순화 | `Bprojm.java` 리팩토링 완료 |
| ✅ Done | 🔴 Critical | `TPRMPP_CINFMM` 테이블명 매핑 확인 — V20260520_001이 `TAAABB_CINFMM` 생성, V20260521_006(line 60)이 `TPRMPP_CINFMM`으로 RENAME. 마이그레이션 체인 정상 확인. 엔티티 `@Table` 매핑 유효 | 2026-05-22 직접 검증 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `AdminMenuService.create()`/`delete()` 트랜잭션 경계 재검증 — 클래스 레벨 `@Transactional` 적용 확인 | `AdminMenuService.java:24`, 탐지: 2026-06-22, 조치일: 2026-06-24 |

### 🎨 프론트엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 — 실제 컴포넌트가 `components/ApplicationViewerDialog.vue`로 이전됨       | auto-import 이름 충돌 위험 해소                 |
| ✅ Done | 🟠 High | `formatDateTime` 중복 구현 통합 — `utils/common.ts`, `pages/guide/index.vue`, `pages/info/documents/[id]/index.vue` 3개 상이한 구현 | `utils/common.ts` 단일 구현으로 통합             |
| ✅ Done | 🟠 High | `stores/review.ts` 검토자 조회 `$apiFetch('/api/...')` 상대 URL 제거 — `${config.public.apiBase}`를 붙여 Nuxt origin 오호출 방지 | `stores/review.ts`, 조치일: 2026-06-21 |
| ✅ Done | 🟠 High | `useCouncilCodes.ts` 코드명 필드 불일치 수정 — `statusMap`/`hearingMap`/`memberTypeMap` 모두 `c.cdvaNm` 매핑 사용, `CodeItem`에 `cNm`/`cdvaNm` 정의 확인 | 코드 확인 2026-06-12: `useCouncilCodes.ts:68,73,78` |

#### 2026-06-24 프론트엔드 리팩토링 일괄 처리 (Phase 0~4, spec/plan: `docs/superpowers/specs|plans/2026-06-24-frontend-refactoring*`)

| ✅ Done | 🟠 High | `result/[id].vue` `reviewProgressEnabled` `s >= '05'` 사전순 비교 버그 수정 — `app/utils/councilStatus.ts`의 `isReviewProgressEnabled`(허용 상태 Set.has) 순수 함수 추출 + 단위테스트. `'SKIPPED'` 오노출 차단 | 조치일: 2026-06-24, `84581e2`/`dd3d8e4` |
| ✅ Done | 🟢 Low | `AppSidebar.vue` 미사용 `_isGroupExpanded` 제거 | 조치일: 2026-06-24, `c7e0fd9` |
| ✅ Done | 🟢 Low | `contract/index.vue` 빈 `/* ── 상태 표시 ── */` 잔재 주석 제거 | 조치일: 2026-06-24, `b06c309` |
| ✅ Done | 🟡 Medium | `budget/list.vue` 탭 제거 후 dead code 정리 — 미사용 filter/pageSize/download/computed 다수 제거(참조 0건 검증) | 조치일: 2026-06-24, `7b9aebb` |
| ✅ Done | 🟢 Low | 사업집행 4개 composable `changeStatus` 중복 → `useDocumentStatusApi.ts`의 `createChangeStatus(apiFetch, baseUrl)` 팩토리로 통합(공개 시그니처 유지) + 단위테스트 | 조치일: 2026-06-24, `274b15d` |
| ✅ Done | 🟡 Medium | `useProjectOptions.ts` 단일 사용 확인 후 `projects/form.vue`에 인라인, composable·테스트 제거 | 조치일: 2026-06-24, `b4eaca1` |
| ✅ Done | 🟢 Low | 사업집행 3개 페이지 대상선택 상태 → `useProjectCostSelector.ts` 공통화(watch/hasTarget/selectedCncdRfrNo/resetSelection 동작 보존) | 조치일: 2026-06-24, `509dd0f` |
| ✅ Done | 🟡 Medium | 관리자 `사용여부` 옵션/태그 중복 → `useYnOptions.ts`(ynOptions/getYnLabel/getYnSeverity) 공통화, auth-grades·roles 적용 | 조치일: 2026-06-24, `4c28a26` |
| ✅ Done | 🟢 Low | `ResultForm.vue` emit/type 단순화 — 이미 목표 상태(emit 단일 union, `ResultData` 미import) 확인 | 검증일: 2026-06-24 (코드 변경 불요) |
| ✅ Done | 🟢 Low | `useTableColumnResize.ts` 숫자 파싱/배열 스타일 — 이미 `Number.parseInt`/`Array.from` 일관 적용 확인 | 검증일: 2026-06-24 (코드 변경 불요) |
| ✔️ Resolved | 🟢 Low | 위원유형 라벨 중복 — `CommitteeList.vue`/`CommitteeSelector.vue`는 이미 `getMemberTypeLabel` 사용. `ScheduleStatus.vue`는 좁은 `구분` 컬럼용 축약 라벨('당연'/'소집')을 의도적으로 유지(전체 라벨 '당연위원'과 다름, 동작 보존) | 검증일: 2026-06-24 (의도된 차이 수용) |
| ✅ Done | 🟡 Medium | `useDeptFilter` — 공통 composable 미도입 폐기 결정, `it_frontend/CLAUDE.md` §4.7.1.3 반영(YAGNI) | 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | `/admin/boards` 관리자 레이아웃 적용 — `definePageMeta`에 `layout: 'admin'` 추가 | 조치일: 2026-06-24, `be537ec` |
| ✅ Done | 🟢 Low | `ReviewVersionHistory.vue` 로컬 `formatDateTime`을 축약 전용 `formatVersionTimestamp`로 개명(공통 함수와 혼동 방지) | 조치일: 2026-06-24, `6494b6a` |
| ✅ Done | 🟡 Medium | `useNotifications` 모듈 싱글턴 상태(`unreadCount`/`items`/`loading`)를 `useState` SSR-safe로 전환(계약·공개 API 보존), CLAUDE.md §4.7.3 반영, 테스트 갱신 | 조치일: 2026-06-24, `3ab412b` |
| ✔️ Resolved | 🟢 Low | `useNotifications.refresh()` 호출부 toast — `NotificationBell`/`NotificationDropdown` 사용자 호출 경로 모두 try-catch+toast 보유 확인 | 검증일: 2026-06-24 (이미 충족) |
| ✅ Done | 🟡 Medium | Tiptap 표 도구 계약 문서화 — `useTiptapTableTools.ts` TSDoc 보강 + `docs/guides/tiptap-table-tools.md` 신규(syncTableWidths swallowed-catch/저장영향 명시) | 조치일: 2026-06-24, `0f773c8` |
| ✅ Done | 🟠 High | 협의회 평가 요약 템플릿 닫힘 구조 정리 | ESLint 단독 실행 2026-06-12: `EvalSummaryPanel.vue` 오류 0건 (847a947 개선 반영) |
| ✅ Done | 🟠 High | `utils/common.ts` 협의회 상태/심의유형 매핑 구 3자리 코드 잔재 수정 — `COUNCIL_STATUS_TAG_MAP` 키와 `getHearingTypeLabel` switch case를 2자리(`'01'`~`'13'`/`'01'`~`'05'`)로 교체. dead branch 해소(`getCouncilTagClass`/`getHearingTypeLabel` 정상 동작). `tests/unit/utils/common.test.ts` 해당 케이스 2자리로 갱신, 124 tests 통과 | `app/utils/common.ts:342-356,375-383`, 검증일: 2026-06-15 |
| ✅ Done | 🟠 High | [완료 2026-06-24] 프론트 build health 6항목 stale 정리 — lint 0 errors/2 warnings, typecheck 0 errors, RichEditor 컴포넌트/참조 부재 확인. ESLint 62/73 errors, typecheck 4건, 단일 template root, 전산업무비 prop, plan/[id] 타입, RichEditor 마이그레이션 모두 해소. cost 컴포넌트 type-only import 정리도 lint 0 errors로 동반 해소(7행째 이관) | 2026-06-24 build 검증 |

### 🟠 2026-06-27 High 잔여 조치 (Batch 1~3, `feature/task-high-remediation`)

> `TASK.md` 🟠 High 잔여 6건 조치. 설계/계획: `docs/superpowers/specs/2026-06-27-task-high-remediation-design.md`, `docs/superpowers/plans/2026-06-27-task-high-remediation.md`.
> 변경 영역 테스트 통과(`CostServiceTest` 40건, `BudgetWorkServiceTest` 전건). 전체 스위트 `./gradlew clean test`의 잔여 실패 8건(`FrontendUrlPropertyResolutionTest`·`ProjectServiceXcrLookupTest`·`CommitteeServiceTest`)은 베이스 커밋 `6a4b0f9`에서도 동일 재현되는 **기존 실패**로, 본 조치와 무관함을 워크트리 대조로 확인(2026-06-27).
> 최종 리뷰(2026-06-27, java/database reviewer)에서 알림 발송 진입 로그(`NotificationService.java:51`)의 수신자 사번 INFO 노출 추가 발견 → `973732b`로 강등. SSO 인증 흐름 INFO eno 노출은 별도 항목으로 `TASK.md` 등록.
> 인덱스 마이그레이션은 로컬 Oracle XE 호환을 위해 `ONLINE` 절을 생략(XE 미지원). dev/prod DBA 적용 시 대용량 테이블(CDECIM/CAPPLM) 락 최소화를 위해 `ONLINE` 옵션 적용을 권장.
> 커밋: it_backend `439023c`/`607092b`/`f988b35`/`af5135b`/`ba9f740`/`b8c8fc4`/`973732b`, it_database `a863dd2`, 루트 문서 `34fd26f`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 게시판 멘션·결재 알림 진단 로그 운영 노출 정리 — `BoardPostService` 멘션 진단 6건, `ApplicationService` 결재요청 알림 진단(결재자 사번), `NotificationService` 발송 진입(수신자 사번) INFO→DEBUG 강등 (PII 운영 로그 미노출) | `BoardPostService.java`(439023c), `ApplicationService.java`(607092b), `NotificationService.java`(973732b), 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | `BudgetWorkService.applyRates()` 원본 레코드별 개별 Upsert SELECT N+1 제거 — BCOSTM/BITEMM 테이블별 키맵 일괄 조회로 전환(동일런 dedup 동등성 보존) | `BudgetWorkService.java`(ba9f740/b8c8fc4), `BbugtmRepository.findByBseYyAndFntTbNmAndDelYn`, 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | `CostService.enrichCostListBatch()` 단말기 첨부 N+1 제거 — `tmnYn='Y'` 행 단말기를 IN 일괄 조회 후 그룹핑 | `CostService.java`(f988b35), `BtermmRepository.findByTermBgNoInAndDelYn`, 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | 전산업무비 삭제(`CostService.deleteCost`) 단말기 조회 N+1 제거 — 비용별 반복 조회를 IN 일괄 조회로 전환(`DEL_YN='N'`만 대상, 멱등) | `CostService.java`(f988b35/af5135b), 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | 결재 대기/대시보드 쿼리 인덱스 보강 — 실제 쿼리 술어 기준으로 `IX_CDECIM_PENDING(DCR_ENO, DCD_STS_C, APF_DCM_NO)`·`IX_CAPPLM_USER_STS(DCD_REQ_USID, APF_PRG_STS_C, DCD_REQ_DTM)` 추가(멱등 가드) | `V20260627_001__AddDashboardListIndexes.sql`(a863dd2), 조치일: 2026-06-27 |
| ✅ Done | 🟠 High | 요구사항 정의서 대시보드 `BRDOCM`/`BRIVGM` 보조 인덱스 — `IX_BRDOCM_ENR_DEL(FST_ENR_USID, DEL_YN)`·`IX_BRIVGM_DOC_DEL_FSG(DOC_MNG_NO, DEL_YN, FSG_YN)` 추가(멱등 가드) | `V20260627_001__AddDashboardListIndexes.sql`(a863dd2), 조치일: 2026-06-27 |

### 🟠 2026-06-29 bbrC 부서 필터 적용 (보안 High W1, it_backend main 통합)

> `TASK.md` W1 보안 High. subagent-driven 실행(implementer→spec 리뷰→코드품질 리뷰). 설계/계획: `docs/superpowers/specs/2026-06-28-task-remediation-design.md` §6.1, `docs/superpowers/plans/2026-06-28-bbrc-dept-filter.md`.
> 커밋(it_backend main): `88e1419`/`8f0151e`/`f0c9f8b`(3 RepositoryImpl) + `2ff2399`(코드리뷰 반영) + `4ee3ebd`(§5.18 문서).
> 검증: `compileJava` BUILD SUCCESSFUL, 전체 `test`는 기존 실패 8건(`FrontendUrlPropertyResolutionTest`·`ProjectServiceXcrLookupTest`·`CommitteeServiceTest`)만 — 베이스 main에서 동일 재현 확인(본 변경 무파손).
> **런타임 검증 완료(2026-06-29, 로컬 Oracle 실데이터)**: 실행단계 문서가 DB에 0건이라 가상 과업심의 3행(부서150 사업·부서180 사업·부서180 전산업무비)을 실제 `TPRMPP_BPROJM`/`TPRMPP_BCOSTM`에 조인(read-only)해 필터 술어 검증 — 관리자(필터없음)=3행·부서 해석 정확, bbrC=150→1행, bbrC=180→2행(사업+전산업무비), bbrC=999→0행(타부서 격리). 대상 2종 분기·부서 격리 정상 확인. (서비스의 bbrC 도출 계층은 본 변경과 무관·기존 유지)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 사업집행 ②과업심의·③계약·④지급 목록 `bbrC` 부서 필터 적용 — 대상구분 100=`Bprojm.svnDpmC`/200=`Bcostm.costSvnDpmC`를 `cncdRfrNo` 키로 LEFT JOIN(최신 `lstYn='Y'`) 후 `Expressions.anyOf(allOf(...))` 분기 비교 + `.distinct()` 가드. `EstimateRepositoryImpl` 패턴을 2대상으로 확장. 일반 사용자 타부서 열람 차단 | `DeliberationRepositoryImpl`/`ContractRepositoryImpl`/`PaymentRepositoryImpl`, `it_backend/CLAUDE.md §5.18`, 통합일: 2026-06-29 |
| ✅ Done | 🟠 High | 과업심의 목록 부서(bbrC) 필터 미적용 — 위 작업으로 동일 해소(과업심의=Deliberation 목록 동일 RepositoryImpl) | 별도 항목이었으나 통합 해소 |

### 🧹 2026-06-29 영향도 낮은 백로그 묶음 처리 (W2+Low 13건, 4 PR)

> `TASK.md` 실행 로드맵 W2(코드부채) + Low 잔여 13건을 단독 수정 가능한 영향도 낮은 작업으로 묶어 4 PR로 처리. 설계/계획: `docs/superpowers/specs/2026-06-29-low-impact-task-bundling-design.md`, `docs/superpowers/plans/2026-06-29-low-impact-task-bundling.md`.
> 커밋: it_backend `b58558d..1da0e32`(4 PR), it_frontend `9035174`.
> W2에 함께 묶여 있던 2건(사업집행 4단계 `changeStatus` role 분기·품목 금액 환율 환산 규칙 통일)은 각각 업무요건 확정·단일 규칙 결정이 선행되어야 하므로 카브아웃하여 `TASK.md` W3로 재범위(Open 유지).

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | SSO 인증 흐름 INFO 로그 사번(eno) 평문 노출 → INFO→DEBUG 강등 (알림/게시판 PII 강등 2026-06-27 동일 정책) | `SsoController.java:321,373`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | mutating 컨트롤러 요청 본문 `@Valid` 누락 보강 — 협의회/게시판 POST·PUT DTO 검증 일관성 회복 + 핵심 필드 제약 | `CouncilController.java`, `BoardPostController.java`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `LoginAttemptService` 클래스 레벨 `@Transactional(readOnly=true)` 적용 (조회 전용 트랜잭션 경계 명시) | `LoginAttemptService.java`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `PlanService` 클래스 레벨 `@Transactional(readOnly=true)` 적용 — 쓰기 메서드는 `@Transactional` 오버라이드 | `PlanService.java:43`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `council-request/result/[id].vue` catch 바인딩 통일(`catch (e: unknown)` + `err.data?.message`) + 통보 성공·수신자 null 시 무피드백 보완 | `pages/info/council-request/result/[id].vue:273,299,314`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `ScheduleService` 위원 사용자명 조회 N+1 제거 — 위원별 `findByEno` 반복을 `findByEnoIn` 일괄 조회로 전환 | `ScheduleService.java:311`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `CouncilService.deriveCurrentYearBudget` 협의회 목록 N+1 제거 — 행별 `findByAbusMngNoAndDelYn` 호출을 품목 배치 prefetch로 전환 | `CouncilService`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `Deliberation/Contract/PaymentService.get()` 상세 조회 대상명 별도 SELECT 제거 — `loadCurrent()`+`resolveTargetName()` 2쿼리를 BPROJM/BCOSTM LEFT JOIN 단일 쿼리로 통합(`EstimateRepositoryImpl` 패턴) | `DeliberationService.java:148`, `ContractService.java:146`, `PaymentService.java:176`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `CinfmmRepositoryImpl.markAllReadByRmsEno()` 벌크 UPDATE 감사컬럼(`LST_CHG_DTM`/`LST_CHG_USID`) 명시 SET — JPA Auditing 우회/1차 캐시 stale 해소 | `CinfmmRepositoryImpl.java:67-78`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `BtermmL.IND_RSN` `@Column(length)` 600→200 — `TPRMPP_BTERML` DDL 정합(BcostmL 2026-06-22 정정과 동일) | `BtermmL.java`, `TPRMPP_BTERML`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `ApplicationContextHolder.publishEvent()` 미사용 메서드 + 구 `@TransactionalEventListener(BEFORE_COMMIT)` JavaDoc 제거 (`AuditLogEvent`는 2026-06-22 삭제됨) | `ApplicationContextHolder.java:38-53`, 조치일: 2026-06-29 |
| ✅ Done | 🟢 Low | `CodeNameMapBuilder` → `common.util` 패키지 이동 — `CostService`/`ProjectService` 공유 유틸 위치 정리 | `CodeNameMapBuilder`, 조치일: 2026-06-29 |
| ✅ Done | 🟡 Medium | EAI `HostAddressProvider` IP/MAC 조회 실패 진단 로깅 보강 — 원인 예외 없는 info만 남던 경로에 `log.warn`+예외 추가(전문 공통부 공백 추적성 확보) | `HostAddressProvider.java:34,57`, 조치일: 2026-06-29 |

### 🧹 2026-06-29 재검증 종료

> `TASK.md` 잔여 항목을 6개 병렬 에이전트로 코드 재대조한 결과, 이미 해소·정정 완료되었거나 코드 부재로 실행 불가한 7건을 종료 이관. 재범위/문구 정정 7건은 `TASK.md` 본문에 반영(Open 유지). plan: `docs/superpowers/plans/2026-06-29-task-recheck-improvement.md`, design: `docs/superpowers/specs/2026-06-29-task-recheck-improvement-design.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E 검증 — 회귀 테스트 존재 확인 | `plugins/auth.ts:113-115`, `tests/unit/plugins/auth.test.ts:136-146`, `tests/e2e/session.spec.ts:75-125`, 검증일: 2026-06-29 |
| ✅ Done | 🟡 Medium | `AdminDto` 잔여 DTO JavaDoc 보강 — 전 중첩 DTO 문서화 완료 확인 | `AdminDto.java` 전 중첩 DTO 문서화 완료, 검증일: 2026-06-29 |
| ✅ Done | 🟡 Medium | 메타 `BPAYTM/BPAYTL.DFR_DT` NULL여부 N→Y 정정 — `table.csv` 이미 Y 등재 확인 | `table.csv` 이미 Y, 검증일: 2026-06-29 |
| ✅ Done | 🟡 Medium | 메타 `BPOVWM PRJ_BG_AMR→RQM_BG_AMT` — 메타 정정 완료. (운영 데이터 이관은 EXTERNAL로 `TASK.md` 메타 섹션에 1줄 유지) | 메타 정정 완료, 검증일: 2026-06-29 |
| ✔️ Resolved | 🟡 Medium | 실시간로그 `V20260531_001` 마이그레이션 적용 검증 — STALE: 해당 마이그레이션 미존재. `V_ITPAPP_LOG_FEED`는 비버전 로컬 DDL | `ITPOWN_DDL_live.sql:3609`(비버전 로컬 DDL), 검증일: 2026-06-29 |
| ✔️ Resolved | 🟡 Medium | `board/index.vue` + `AppSidebar.vue` 공통 권한 필터 추출 (inqAthC 중복) — 재검증 결과 코드 부재로 종료(실행불가): `inqAthC`가 프론트·백 코드에 부재(문서 prose만 존재) | `board/index.vue`/`AppSidebar.vue` `inqAthC` 코드 부재, 검증일: 2026-06-29 |
| ✔️ Resolved | 🟡 Medium | 게시판 권한 코드(`inqAthC`/`enrAthC`) `ROLE.ADMIN` 외 역할 매핑 통합테스트 — 재검증 결과 코드 부재로 종료(실행불가): `inqAthC`/`enrAthC`가 프론트·백 코드에 부재(문서 prose만 존재) | 권한 코드 `inqAthC`/`enrAthC` 코드 부재, 검증일: 2026-06-29 |

### 🔍 2026-06-28 코드 대조 검증 — stale Open 이관

> `TASK.md` 전체 ⬜ Open 항목을 6개 병렬 에이전트로 코드베이스 대조 검증(read-only) 후, 실제 이미 해소된 stale 3건만 이관. 대부분 항목은 정상 추적(STILL_OPEN) 재확인. spot-check로 에이전트 오판 2건 정정 — `ApplicationContextHolder.publishEvent()`는 구 이벤트 기반 감사로그 JavaDoc(38-53행)이 잔존해 Open 유지, `BRIVGM` 인덱스는 06-27 추가분(`IX_BRIVGM_DOC_DEL_FSG`)이 대시보드용 별개라 검토의견 목록 쿼리는 미커버로 Open 유지. 검증 기록·잔여 로드맵·보안 High 2건 상세 설계: `docs/superpowers/specs/2026-06-28-task-remediation-design.md`.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `ProjectService.enrichProjectListBatch()` 사업별 비목 요약 N+1 제거 — BBUGTM을 사업 키 묶음으로 일괄 조회 | `ProjectService.java:715`(enrich)·`:678` `bbugtmRepository.sumDupBgByPrjMngNos()` 배치, `BbugtmRepositoryImpl.java:262` 집계, 검증일: 2026-06-28 |
| ✔️ Resolved | 🟢 Low | `applyAthIds()` 적용 대상 최소화 — prune된 트리에만 적용 + `MenuAuthMapProvider` 캐시(2026-06-22)로 권한Map 조회비용 해소 → 추가 최적화 실익 낮음, 현행 유지 | `MenuQueryService.java:47-49,61-68`, 검증일: 2026-06-28 |
| ✅ Done | 🟡 Medium | 메타 미등재 테이블 12종(사업집행 4단계 `BESTIM/BESTTM/BDELIM/BCONTM/BPAYMM/BPAYTM` + 각 `*L` 로그) 등재 — 컬럼명은 이미 표준 명칭 사용 | `meta/table.csv` 해당 12테이블 등재 확인, 검증일: 2026-06-28 |

### 🔎 2026-06-22 코드 대조 검증 완료 (백엔드)

> 백엔드 4개 섹션 ⬜ Open 항목을 라이브 IDE 진단 + 코드 광범위 대조로 검증, 완료 확정분.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `CodeController.createCcodem()`/`updateCcodem()` `@Valid` 추가 — Bean Validation이 컨트롤러 진입 시 동작하도록 일관성 확보                                        | `CodeController.java:68,81` — ✅ 검증 2026-06-22: CodeController.java:75,97 `@Valid @RequestBody` 적용 확인 |
| ✅ Done | 🟡 Medium | `FeasibilityService.replacePerformances()` 물리 DELETE 예외 정책 정리 — `Bperfm` 성과지표도 Soft Delete 원칙을 지키도록 PK 재삽입 문제를 해결하거나 운영 예외로 승인 | `FeasibilityService.java:223`, 발견일: 2026-06-01 — ✅ 검증 2026-06-22: FeasibilityService.java:170-173 하드딜리트 사유(복합PK+merge del_yn) JavaDoc 명문화 → 운영 예외 승인 |
| ✅ Done | 🟡 Medium | `ServiceRequestDocService.getDashboard()` 네이티브 쿼리 결과 직접 캐스트 안전 변환 적용 — Oracle JDBC/Hibernate 반환 타입 차이로 `ClassCastException` 가능. `RealtimeLogRepository`의 `toStr`/`Number` 변환 패턴 참고 | `ServiceRequestDocService.java:295,307`, 탐지: 2026-06-21 — ✅ 검증 2026-06-22: ServiceRequestDocService.java:294-311 toLdt() instanceof 분기 + try/catch 적용 |
| ✅ Done | 🟢 Low | `BestimL`/`BesttmL` 로그 엔티티가 `SEQ_BESTIL`/`SEQ_BESTTL` 시퀀스를 정확히 참조하는지 `AuditLogIdGenerator` 파생 로직과 대조 검증 (`V20260607_004`에서 `SEQ_BESTIDL→SEQ_BESTTL` rename) | `V20260607_004:15`, `V20260607_002:105-107`, 탐지: 2026-06-09 — ✅ 검증 2026-06-22: V20260607_004:14-15 rename + AuditLogIdGenerator:40 파생 정합 + @Table 매핑 확인 |
| ✅ Done | 🟡 Medium | `BprojmL` 변경로그 엔티티에 `cncdRfrNo`(`CNCD_RFR_NO`) 컬럼 누락 — 마스터 `Bprojm`은 보유(`Bprojm.java:203`)하나 미러 엔티티에 미정의. `AuditLogPersister`가 필드명 기준 복사하므로 관련프로젝트관리번호 변경이 감사로그에 미기록. `BprojmL`에 필드 추가 + `TPRMPP_BPROJL` ADD 마이그레이션 필요 | `BprojmL.java`, 탐지: 2026-06-14 — ✅ 검증 2026-06-22: BprojmL.java:34 필드 + V20260612_002:1009 TPRMPP_BPROJL ADD CNCD_RFR_NO |
| ✅ Done | 🟠 High | 알림 시스템 백엔드 단위·통합 테스트 추가 — `NotificationServiceTest`(Mockito), `MentionExtractorTest`(순수 단위), `CinfmmRepositoryImplTest`(Testcontainers/H2). 커버리지 대상: 빈 수신자 가드, REQUIRES_NEW 전파, markAllRead 행 수, 멘션 추출 엣지케이스 | `it_backend/src/test/` — notification 패키지 테스트 없음 — ✅ 검증 2026-06-22: NotificationServiceTest/MentionExtractorTest/NotificationEventListenerTest/NotificationControllerTest 존재(CinfmmRepositoryImplTest만 잔여) |
| ✅ Done | 🟠 High | Tiptap 변수 시스템 백엔드 단위 테스트 추가 — `TiptapTokenParserTest`(정규식·switch·IllegalArgumentException), `TiptapVariableServiceTest`(Mockito: MISSING/INVALID·금액 포맷·null 가드) | `it_backend/src/test/` — tiptap 패키지 테스트 없음 — ✅ 검증 2026-06-22: TiptapTokenParserTest/TiptapVariableServiceTest/TiptapVariableControllerTest 존재 |
| ✅ Done | 🟠 High | `QnaService.updateQna()` 관리자 수정 무력화(`ROLE_ITPAD001`) 교정 — `OwnershipVerifier.verifyOwnerOrAdmin()`로 교체, 비소유자 403 매핑 | — ✅ 구현 2026-06-22(feat/ownership-verifier-foundation): `OwnershipVerifier`(공통 유틸) 도입 + `GlobalExceptionHandler` AccessDeniedException→403 + `QnaService.java` 권한 검증 위임. Plan: docs/superpowers/plans/2026-06-22-ownership-verifier-foundation.md |

### ✅ 2026-06-22 백엔드 로드맵 Phase 2-5 실행 완료

> 백엔드 개선 로드맵 Phase 2~5를 브랜치 `backend-roadmap-phase2-5`에서 구현·코드리뷰 완료. (코드 커밋은 중첩 `it_backend` repo, 마이그레이션은 `it_database` repo)

#### Phase 2 — 에러 전파·입력 안정성

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 리소스 미존재 시 HTTP 404 반환을 위한 전용 `NotFoundException` 도입 + `GlobalExceptionHandler` 매핑 | 구현 2026-06-22: `NotFoundException`(404) + `GlobalExceptionHandler` `ResponseStatusException` 핸들러 |
| ✅ Done | 🟠 High | `ResponseStatusException` 전용 핸들러 추가 — 서비스에서 던진 404/500 상태가 `RuntimeException` 포괄 핸들러에 의해 400으로 바뀌지 않도록 분리 | 구현 2026-06-22: `GlobalExceptionHandler`에 `ResponseStatusException` 핸들러 추가 |
| ✅ Done | 🟡 Medium | `ChangeLogEntityListener.java:133-137` `delYn` 리플렉션 접근 실패 시 warn 로그 + 스택트레이스 추가 | 구현 2026-06-22: 에러 로깅 표준화 9곳 중 하나 |
| ✅ Done | 🟠 High | `PlanService.java:443` `JsonProcessingException` cause 전달 — `ResponseStatusException` 3인수 생성자로 교체 | 구현 2026-06-22: snapshot 직렬화 실패 cause 보존 |
| ✅ Done | 🟠 High | `PlanService.applyExistingPlanSnapshot()` 빈 `catch (JsonProcessingException) {}` — 스냅샷 파싱 실패 로깅 | 구현 2026-06-22: `PlanService.java:133-137`(FIXME [B-H-05]) cause 로깅 |
| ✅ Done | 🟡 Medium | `FileService.downloadFile()` `MalformedURLException` 원인 예외 보존 + `uploadFiles` warn 로깅 | 구현 2026-06-22: `FileService` cause 전달·warn 추가 |
| ✅ Done | 🟠 High | `SsoController.complete()` `sendRedirect` IOException 로깅 | 구현 2026-06-22: 에러 로깅 표준화 |
| ✅ Done | 🟡 Medium | `AdminLogService.readField()` 필드 미발견 시 `log.warn` 추가 (TODO [B-M-01]) | 구현 2026-06-22: `AdminLogService.java:232-241` warn 추가 |
| ✅ Done | 🟡 Medium | `CustomUserDetails` — `athIds` 클레임 타입 불일치 시 `log.warn` 추가 | 구현 2026-06-22: `JwtUtil` athIds warn |
| ✅ Done | 🟡 Medium | `AuditLogPersister` CHG_USID null warn · `CouncilService` 회의일자 warn · `NotificationService` 길이 clamp | 구현 2026-06-22: 에러 로깅 표준화 9곳 |
| ✅ Done | 🟢 Low | `NotificationEvent` `infTtl`(100자)·`infCone`(300자) 길이 강제 — 초과 시 clamp 적용 | 구현 2026-06-22: `NotificationService.send()` 길이 clamp |
| ✅ Done | 🟠 High | `GeminiService` `RestClient`에 `connectTimeout`/`readTimeout` 설정 — 스레드 풀 고갈 방지 | 구현 2026-06-22: connect/read timeout 적용 |
| ✅ Done | 🟡 Medium | Gemini 첨부 파일 실제 크기 제한 구현 | 구현 2026-06-22: `Files.readAllBytes` 전 첨부 크기 사전검사 |
| ✅ Done | 🟡 Medium | Gemini 요청 DTO 검증 추가 — `@NotBlank`, `@Size`, 첨부 개수 제한 | 구현 2026-06-22: `GeminiDto` Bean Validation |
| ✅ Done | 🟡 Medium | `NotificationController` `size` 파라미터 상한 — `@Max(100)` 또는 클램핑 | 구현 2026-06-22: `NotificationController` `@Max` Bean Validation |
| ✅ Done | 🟡 Medium | `@Valid` 입력검증 일관화 — `ApplicationController`, 사업집행 4단계 DTO, `TiptapVariableService` FORBIDDEN 분기 | 구현 2026-06-22: `@Valid`/`@Max` 적용 + Tiptap FORBIDDEN 분기 |
| ✅ Done | 🟡 Medium | 사업집행 4단계 DTO — 금융 금액 필드(`cttAmt`, `dfrAmt`) `@DecimalMin`, YN 플래그 `@Pattern` 적용 | 구현 2026-06-22: 4단계 DTO Bean Validation |

#### Phase 3 — 보안 하드닝

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `gemini.api.key` 운영 필수 검증 — `EnvironmentValidator` 검증 대상 포함 | 구현 2026-06-22: `EnvironmentValidator` gemini 키 검증 |
| ✅ Done | 🟡 Medium | `EnvironmentValidator`에 `eai.enabled`/`EAI_URL` 운영값 검증 추가 | 구현 2026-06-22: `EnvironmentValidator` eai 검증 |
| ✅ Done | 🟠 High | `cors.allowed-origins` 기본값 `*` 제거 + 빈값/와일드카드 운영 차단 가드 | 구현 2026-06-22: `EnvironmentValidator` cors wildcard 검증 + 기본값 제거 + blank 가드 |
| ✅ Done | 🟡 Medium | `SecurityConfig.allowedHeaders` `List.of("*")` → 실제 사용 헤더 명시 화이트리스트 | 구현 2026-06-22: `allowedHeaders` 명시 |
| ✅ Done | 🟡 Medium | `SecurityConfig` 관리자 URL 패턴 `/api/plan/**`을 실제 `/api/plans/**`와 일치 정비 | 구현 2026-06-22: 라우트 `/api/plans` 정합 |
| ✅ Done | 🟢 Low | `AuthController.getClientIp()` — `X-Forwarded-For` 멀티 IP 미분리 | 구현 2026-06-22: `ClientIpResolver` 멀티IP+신뢰프록시 |
| ✅ Done | 🟡 Medium | X-Forwarded-For 신뢰 프록시 목록 제한 | 구현 2026-06-22: `ClientIpResolver` 신뢰프록시 처리 |
| ✅ Done | 🟠 High | Refresh Token Rotation 도입 — `/api/auth/refresh` 시 Refresh Token도 신규 발급·DB 교체 | 구현 2026-06-22: `AuthService` Refresh Token Rotation |
| ✅ Done | 🟡 Medium | `UserDto.DetailResponse` 휴대폰/내선/이메일 PII 노출 본인·ADMIN 한정 | 구현 2026-06-22: `UserService` PII self/admin 한정(`OwnershipVerifier`) |
| ✅ Done | 🟡 Medium | 사번(`eno`) PII INFO 로그 정책 — DEBUG 강등 | 구현 2026-06-22: eno/bbrC INFO→DEBUG, `BoardCommentService` 멘션 INFO 제거 |
| ✅ Done | 🟡 Medium | `EaiService.sendEai()` 전송 실패 로그 — EAI URL/내부 경로 노출 방지 | 구현 2026-06-22: `EaiService` safeMessage |
| ✅ Done | 🟢 Low | `EaiProperties` `enabled=true`+`url` 공백/null 가드 추가 | 구현 2026-06-22: `EaiProperties` enabled+blank-url 가드 |

#### Phase 4 — 성능

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 요구사항 정의서 목록 작성자명 조회 N+1 제거 | 구현 2026-06-22: `ServiceRequestDocService` 배치화 |
| ✅ Done | 🟡 Medium | `ReviewCommentService` 검토의견 작성자명 조회 N+1 제거 | 구현 2026-06-22: `ReviewCommentService` 배치화 |
| ✅ Done | 🟠 High | `ApplicationService.getApplications()` 결재자 목록 N+1 제거 | 구현 2026-06-22: `ApplicationService.getApplications` 배치화 |
| ✅ Done | 🟡 Medium | `ApplicationService.getPendingCount()` full entity 조회 후 `.size()` → `count` 쿼리 | 구현 2026-06-22: `getPendingCount` COUNT 전환 |
| ✅ Done | 🟠 High | `BudgetWorkService.getProjectSummary()` BBUGTM 루프 N+1 + `resolveProjectName()` IN절 일괄 조회 | 구현 2026-06-22: `BudgetWorkService` 배치화 |
| ✅ Done | 🟡 Medium | `GET /api/notifications/unread-count` 상시 `COUNT(*)` → 캐시 | 구현 2026-06-22: `NotificationService` unread-count 캐시(evict-on-write) |
| ✅ Done | 🟡 Medium | `TiptapVariableService.getMetadata()`·`resolve()` 매 호출 DB 조회 → 캐시 | 구현 2026-06-22: `TiptapVariableService` metadata 캐시 + 인트라-요청 memoize |
| ✅ Done | 🟠 High | 메뉴 권한 매핑 `athByMenu()` 캐시 도입 | 구현 2026-06-22: `MenuAuthMapProvider` 캐시(evict-on-write) |
| ✅ Done | 🟠 High | 결재 대기/대시보드·요구사항 정의서·사업집행 4단계 목록·메뉴 활성조회 인덱스 보강 | 구현 2026-06-22: 인덱스 마이그레이션 `V20260622_003`(`IDX_BESTIM_LIST/FST_DTM`, `IDX_BDELIM_LIST/FST_DTM`, `IDX_BCONTM_LIST/FST_DTM`, `IDX_BPAYMM_LIST/FST_DTM`, `IDX_CMENUM_DEL`, `IDX_CMENUA_DEL` 포함) |
| ✅ Done | 🟢 Low | `SEQ_CINFMM` 및 사업집행 4단계 마스터 시퀀스 `NOCACHE → CACHE 20` 변경 | 구현 2026-06-22: 시퀀스 CACHE 20 마이그레이션 `V20260622_004`(`SEQ_BESTIM`, `SEQ_BDELIM`, `SEQ_BCONTM`, `SEQ_BPAYMM` 포함) |
| ✔️ Resolved | 🟡 Medium | `BPAYTM` 회차별 지급 조회 보조 인덱스 검토 — `(DOC_MNG_NO, DOC_VRS_SNO)` 선행 조건은 기존 PK 프리픽스로 커버되어 별도 인덱스 제외 | 검토 2026-06-22: `V20260622_003` 주석에 중복 제외 사유 기록 |
| ✅ Done | 🟡 Medium | `CouncilRepository.updateProjectStatus()` `@Modifying` 후 1차 캐시 stale 정합 | 구현 2026-06-22: `clearAutomatically`/`flushAutomatically` 적용 |

#### Phase 5 — 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `buildCodeNameMap` 중복 private 메서드 추출 — 공통 유틸로 단일화 | 구현 2026-06-22: `CodeNameMapBuilder` 공통 추출(`CostService`/`ProjectService` 위임) |
| ✅ Done | 🟢 Low | `BbugtmRepositoryImpl.sumCostDupBg`/`sumAssetDupBg` 공통 private 메서드 추출 | 구현 2026-06-22: `sumDupBg` 3건 통합 |
| ✅ Done | 🟢 Low | `AuditLogEvent.java` 정리 — 잔여 이벤트 기반 감사로그 제거 | 구현 2026-06-22: `AuditLogEvent` 삭제 |
| ✅ Done | 🟢 Low | `BcostmL` JPA `@Column(length)` 실제 DDL/마스터와 불일치 정정 | 구현 2026-06-22: `BcostmL` @Column length 12건 정정 |
| ✅ Done | 🟡 Medium | `stream().collect(Collectors.toList())` → `.toList()` 전환 | 구현 2026-06-22: 50/51건 전환 (소비자 코드 가변성 확인) |
| ✅ Done | 🟢 Low | `BoardCommentService` 미사용 import 제거 · `FileService` `FL_MNG_NO_RETRY` 제거 | 구현 2026-06-22: dead code 정리 |

### 2026-07-19 — 보안·에러 처리 Remediation Phase 3 (ERR-03·ERR-04)

- **변경 파일**
  - 프론트 진단·복구: `app/utils/diagnostics.ts`, `app/utils/file-meta-update.ts`, `app/composables/useHwpxExport.ts`, `app/composables/useExcalidrawAttachment.ts`, 문서 등록·상세/사업 등록/가이드/예산 현황 화면, Tiptap 확장·표 도구와 관련 단위 테스트.
  - 비운영 자산 경계: `it_backend/sso/README.md`, 양쪽 `oss/README.md`, Maven/npm 로컬 저장소 PowerShell 도구의 의도적 인코딩 실패 진단.
- **자동 검증 4개**
  1. `it_frontend npm run format:check` — PASS.
  2. `it_frontend npm run check` — PASS(0 errors, 기존 `vue/attribute-hyphenation` 경고 3건).
  3. `it_frontend npm test` — 전체 Vitest suite PASS.
  4. `it_backend .\gradlew.bat clean test --console=plain` — `BUILD SUCCESSFUL`.
- **QA 시나리오 5개 결과** — 브라우저 수동 조작 대신 동일 실패를 자동 주입하거나 소스 계약으로 재현했다.
  1. 부서 조회·Excalidraw 변환 실패 후에도 HWPX 생성이 계속되고 `일부 내용 제외` 경고가 각각 1회 노출됨 — `useHwpxExport.direct.test.ts` PASS.
  2. 파일 메타 일부 실패 ID 보존, 경고와 재시도 버튼, 성공 ID 치환 계약 — `file-meta-update.test.ts`, `useExcalidrawAttachment.test.ts`, `document-file-meta-warning.test.ts` PASS.
  3. 가이드 첨부 실패를 정상 빈 목록과 구분하고 재시도 제공 — `guide-attachment-error.test.ts` PASS.
  4. 손상된 예산 컬럼 설정 삭제, 기본값 복구, 제한 경고 계약 — `budgetStatusFooterTotals.test.ts` PASS.
  5. Tiptap DOM 매핑 반복 실패를 분당 1회·`tablePos` 포함 진단으로 제한하고 DOM 전용 보정이 문서 모델을 변경하지 않음 — `tiptap-error-diagnostics.test.ts`, `useTiptapTableTools.test.ts` PASS.
- **벤더 샘플 유지 결정** — SSO 공급 계약과 장애 대응 참고자료이므로 유지한다. Gradle `main`·`test` 소스셋과 운영 WAR에는 포함하지 않고, 향후 정적분석에서는 `it_backend/sso/**`를 vendor/non-production 경로로 제외한다. 삭제는 계약·보존 기간·운영 담당자 승인을 확인하는 별도 작업에서만 결정한다.

## 📋 완료 로그 (시간순)

| 상태 | 일자 | 영역 | 조치 |
| :--: | :--: | :--: | --- |
| ✅ Done | 2026-08-16 | 테스트 | MIG-07 완료 — `test-it` 전체 컨텍스트 통합 테스트가 `MfaProviderRegistry` 빈을 찾지 못해 로딩 단계에서 전부 실패하던 문제 해소. 운영 `MfaConfig`의 `@Profile`을 넓히는 대신 기존 `MfaTestSupportConfig`(빈 레지스트리, `@ConditionalOnMissingBean`)를 전체 컨텍스트 통합 테스트 8개에 `@Import`했다. 프로파일을 넓히면 mock 차단 가드는 유지되더라도 mock이 꺼진 `test-it`이 실제 공급자 분기를 타 endpoint·지정맥 고정키 더미를 테스트 설정에 넣어야 하므로, 운영 보안 설정을 건드리지 않는 쪽을 골랐다. `./gradlew integrationTest` 실패 48건 → 8건. 잔여는 MIG-13으로 승계. (it_backend `560706d3`) |
| ✅ Done | 2026-08-16 | 이관/문서 | MIG-08 완료 — `CostDto.Response.prevBgAmt` 주석의 `abusTc` 코드값 오기 정정(01/02 → 10/20). `V20260720_008__AlignCommonCodesWithProd.sql`이 `01→10(신규)`·`02→20(계속)`으로 이관한 뒤에도 주석만 구 체계로 남아 있었다. 주석만 고쳤고 로직은 그대로다. |
| ✅ Done | 2026-08-16 | 이관/문서 | MIG-11 완료 — 편성요청서 반입 후 편성행 생성 절차를 반입 화면(`admin/migration/requests`)에 안내로 명시. 반입은 원장까지만 만들고 `BBUGTM`을 만들지 않아 반입 직후 예산 화면이 0으로 보이므로, 반입을 모두 마친 뒤 [예산 작업]에서 편성률을 한 번에 적용해야 한다는 절차를 적었다. 사용자 가이드 문서가 따로 없어 사용 시점 화면에 두었다. |
| ✅ Done | 2026-08-09 | 주석/문서/백로그 | REVIEW.md 재실행 (델타: 대상 문서 마지막 커밋 이후 — FE `3dc317a..HEAD` 45커밋, BE `40bc50ba..HEAD` 13커밋). **Task1**: 최대 수확은 협의회 위원유형 코드값 드리프트다 — 실제 값은 `01`/`02`/`03`/`04`이고 `IT_PTL_ASCT_MEB_TC`가 VARCHAR2(2)인데 주석 다수가 저장 불가능한 4자 니모닉 `MAND`/`CALL`/`SECR`를 서술하고 있었다(`Bcmmtm` 클래스·필드 JavaDoc, `CouncilDto` 2곳, `CommitteeRepository` `@param`, `CouncilResultController`, `CommitteeService` 인라인 3곳). 공통코드 그룹명도 `VLR_TC`(2026-06-23 `V20260623_003`에서 개명) 잔존 표기를 BE 2곳·FE 2곳 정정. `BcmmtmId`의 "`Bcmmtm.asctId`와 이름 일치 필수"는 존재하지 않는 필드를 지목해 `itPtlAsctId`로 정정(`@IdClass` 이름 일치 규칙 주석이라 오기가 특히 위험). Tiptap 확장 분해 시 섹션 배너 7개가 다른 파일 코드를 설명한 채 남아 있어 실체 있는 4건은 해당 파일로 이동하고 배너만 남은 3건은 삭제. CQ-18 이동 3파일(`AppDialogFooter`·`PageHeader`·`TableCard`)의 헤더 경로와 `useProjectFormPage.ts`의 `[pages/…]` 배너 정정, 페이지 composable 8종에 TSDoc 보강, `max-lines-baselines.mjs` JSDoc이 존재하지 않는 31개 기준선을 서술하던 것을 CQ-15 완료 상태로 갱신. 오류삼킴 탐지는 위반 0건. **Task2/3**: FE-15로 API 타입이 백엔드 OpenAPI 생성물이 된 것이 7개 문서 어디에도 없어 루트/FE/BE 전반에 반영(생성 타입 SoT·`npm run codegen`/`codegen:check`·화면 전용 UI 타입 예외), CQ-15 페이지↔`use{화면}Page` 경계와 800줄 상한, CQ-18 `components` 루트 비움, Tiptap 확장 배럴 규칙을 FE CLAUDE에 등재. BE CLAUDE·README에는 물리 PK 전체 `@Id` 매핑 규칙(BE-25)과 **조회 프로젝션 규칙**을 신설 — 프로젝션 타입 17종·`*ProjectionIt` 23종으로 이미 저장소 전반의 패턴인데 규칙이 전무했다. 응답 `@Schema`가 프론트 타입의 SoT임을 BE 문서에 명시. **Task4**: 신규 2건 등재 — CQ-25(도구 산출물 `graphify-out/`이 `it_backend`에 추적, 루트 `.gitignore`는 하위 독립 저장소에 미적용), CQ-26(FE-15 잔여 고아 타입 10건 + `BudgetSummaryResultTable` 중복 선언). BE-24·BRD-02는 조건 미충족으로 Open 유지. DB/JPA 탐지는 문제 0건(BE-25가 `Bpqnam`/`Bmqnam`의 부분키 매핑 결함을 실제로 고친 것으로 확인). 검증: BE `spotlessCheck` 통과(한글 JavaDoc 재래핑 1건 수동 반영), BE 협의회·복합키·계약 테스트 `BUILD SUCCESSFUL`, FE 변경분 Prettier 통과, 아키텍처·배럴 27건과 페이지·컴포넌트 271건 통과. 전체 게이트는 세션 중 유입된 **타 세션 미커밋 테스트 파일 6종** 때문에 red이며 이번 작업과 무관하다. |
| ✅ Done | 2026-07-19 | 보안/에러 처리 | SEC-04·SEC-05·ERR-06 완료 재검증 — JWT 용도 allowlist, 업무 파일 부모 권한·default-deny와 SEC-05 마이그레이션 적용 성공, 감사로그 실패 메트릭·재진입 방지·트랜잭션 격리를 확인. 선별 테스트 159건과 Oracle 통합 테스트 11건 통과. SEC-06은 별도 Flyway 정합성 잔여로 환원. |
| ✅ Done | 2026-07-19 | 에러처리/비운영 자산 | ERR-03·ERR-04 완료 — HWPX 부분 누락 경고, 파일 메타 실패 ID 보존·재시도, 보조 조회 오류 상태, 손상 설정 복구, Tiptap rate-limit 진단을 반영하고 SSO/OSS 비운영 경계와 스캔 제외·삭제 판단 기준을 문서화. 프론트 전체 게이트와 백엔드 `clean test` 통과. |
| ✅ Done | 2026-06-29 | 보안 | 보안 하드닝 구현 완료 — `TASK.md` 🔒 보안 § 잔여 6건(#1·#2·#3·#5·#6·#7) 조치·`TASK_DONE.md` 이관. ① `Authorization: Bearer` 헤더 폴백 `app.auth.allow-bearer-header` 게이팅(base/prod=false)·CLAUDE.md §5.6; ② `AdminSecurityBoundaryTest`로 `/api/admin/**` JWT 필수(`it-portal-user` 무시)→401 입증 + 프론트 `access-control.spec.ts`; ③ SSO 운영 설정 검증(`EnvironmentValidator` prod 가드 + `app.dev.user-switch.enabled` 추가, `ClientIpResolver` 기적용); ④ [T10] Refresh Token 재사용 탐지(`TPRMPP_CRTOKM` FAM_NM/AVL_YN, Flyway `V20260629_001`, `AuthService` 패밀리 회전+grace 윈도우); ⑤ Tiptap 변수 metadata bbrC 부서 권한 필터(`getMetadata(user)`·캐시 키 분리); ⑥ 사업집행 4단계 `changeStatus` ADMIN 전용 전이(`OwnershipVerifier.verifyAdmin` 4개 서비스, CLAUDE.md §5.18). #4 Blocklist는 감내(☑️ Accepted)로 보안 §에 유지 → 보안 § 잔여 = Blocklist(감내) 외 0건. plan `docs/superpowers/plans/2026-06-29-security-hardening.md`·design `docs/superpowers/specs/2026-06-29-security-hardening-design.md`. |
| ✅ Done | 2026-06-29 | 백로그 | TASK.md 재검증 반영 — `TASK.md` 잔여 항목을 6개 병렬 에이전트로 코드 재대조. 이미 해소·정정 완료 또는 코드 부재로 실행 불가한 7건 종료 이관(`$apiFetch` 401 E2E 검증·`AdminDto` JavaDoc·메타 `BPAYTM/BPAYTL.DFR_DT` N→Y·메타 `BPOVWM PRJ_BG_AMR→RQM_BG_AMT`·실시간로그 `V20260531_001` STALE·게시판 `inqAthC` 공통필터 추출·`inqAthC/enrAthC` 매핑 통합테스트 — 후 2건은 코드 부재로 실행불가). 재범위/문구 정정 7건은 `TASK.md` 본문 반영(Open 유지): `EvaluationService`·`CommitteeService` N+1(ScheduleService 완료)·`CouncilService` L298 per-evaluator count 분리·클래스 JavaDoc 잔여(전수 86%)·IT부문 예산 화면 wiring 잔여·본문 최대크기 정책(DECISION)·`findProjectsForCouncilAll/ByDepartment`(18컬럼) 메서드명/컬럼수 정정·환율 환산 활성 충돌(`BudgetWorkService` no-xcr vs `ProjectBudgetSummaryService` ×xcr). 2차 안전 묶음 W2b 착수. plan `docs/superpowers/plans/2026-06-29-task-recheck-improvement.md`·design `docs/superpowers/specs/2026-06-29-task-recheck-improvement-design.md`. |
| ✅ Done | 2026-06-29 | 백로그 | 영향도 낮은 백로그 묶음 처리 — 실행 로드맵 W2(코드부채)+Low 잔여 13건을 단독 수정 가능한 영향도 낮은 작업으로 묶어 4 PR(it_backend `b58558d..1da0e32`, it_frontend `9035174`)로 처리·`TASK_DONE.md` 이관. SSO eno 로그 INFO→DEBUG 강등, `@Valid` 보강(Council/BoardPost), 클래스레벨 `@Transactional(readOnly)`(Plan/LoginAttempt), N+1 제거 4건(ScheduleService·CouncilService.deriveCurrentYearBudget·Deliberation/Contract/Payment.get), `CinfmmRepositoryImpl` 감사컬럼 명시 SET, `BtermmL` length 600→200, `ApplicationContextHolder` 미사용 메서드/구주석 제거, `CodeNameMapBuilder` common.util 이동, `HostAddressProvider` 진단 로깅, council-request/result catch 통일. W2에 묶여 있던 2건(`changeStatus` role 분기·환율 환산 규칙 통일)은 업무요건/단일규칙 결정 선행 필요로 카브아웃하여 W3 재범위(Open 유지). 설계/계획: `docs/superpowers/specs/2026-06-29-low-impact-task-bundling-design.md`, `docs/superpowers/plans/2026-06-29-low-impact-task-bundling.md`. |
| ✅ Done | 2026-06-28 | 백로그 | TASK.md 코드 대조 검증 — 6개 병렬 에이전트로 전체 ⬜ Open 항목을 코드베이스 대조(read-only). 실제 해소된 stale 3건 이관(`ProjectService` 비목 N+1 제거, `applyAthIds` 실익 낮음 종료, 메타 12종 등재). spot-check로 `ApplicationContextHolder` 잔여 JavaDoc·`BRIVGM` 검토의견 인덱스는 Open 유지로 정정. 잔여 항목을 Wave 1~4 실행 로드맵으로 재정리, 보안 High 2건(bbrC 부서필터·사전협의 서버영속화) 상세 설계 문서화(`docs/superpowers/specs/2026-06-28-task-remediation-design.md`). |
| ✅ Done | 2026-06-27 | 백엔드 | 테스트 스텁 정합(후속/T) 검증 종료 — 백로그가 "실패 6건"으로 추적하던 `CostServiceTest`(`@Mock CodeNameMapBuilder` 누락)·`BudgetWorkServiceTest`(단일키→배치 finder 스텁) 항목을 `./gradlew test --tests *CostServiceTest --tests *BudgetWorkServiceTest`로 재검증 → **BUILD SUCCESSFUL**. CostServiceTest는 `@Mock CodeNameMapBuilder`+`@BeforeEach` 기본값 적용 완료, BudgetWorkServiceTest는 배치 finder 스텁 반영 완료. 06-22 이후 커밋에서 해소된 stale 백로그로 확정·종료. |
| ✅ Done | 2026-06-27 | 백로그 | TASK.md 완료 항목 아카이빙 — "에러 처리" 프론트 sweep 26건(2026-06-24)을 dated 서브섹션으로 이관, `AdminMenuService` DB/JPA 1건 이관, 테스트 스텁 stale 항목 종료. TASK.md는 잔여 ⬜ Open만 유지. High 잔여 7건 코드 검증 후 조치 계획 수립(`docs/superpowers/specs/2026-06-27-task-high-remediation-design.md`). |
| ✅ Done | 2026-06-22 | 백엔드 로드맵 | 백엔드 개선 로드맵 Phase 2~5 실행(브랜치 `backend-roadmap-phase2-5`, 코드리뷰 완료). **Phase 2**: `NotFoundException`(404)+`ResponseStatusException` 핸들러, 에러 로깅 표준화 9곳, `GeminiService` 타임아웃+첨부 크기 사전검사, 입력검증(`@Valid`/`@Max`/Bean Validation + Tiptap FORBIDDEN). **Phase 3**: `EnvironmentValidator` 운영 필수키 검증(gemini/eai/cors), CORS allowedHeaders 명시·기본값 제거·blank 가드, `/api/plans` 라우트 정합, `ClientIpResolver`, Refresh Token Rotation, `UserService` PII 한정, eno/bbrC 로그 DEBUG 강등, `EaiService` safeMessage·blank-url 가드. **Phase 4**: N+1 배치화(ServiceRequestDoc/ReviewComment/Application/BudgetWork), 캐시(notification unread-count·tiptap metadata·MenuAuthMap, evict-on-write), 인덱스 `V20260622_003`·시퀀스 CACHE 20 `V20260622_004`, `CouncilRepository.updateProjectStatus` clear/flush. **Phase 5**: `CodeNameMapBuilder` 공통 추출, `sumDupBg` 통합, `AuditLogEvent` 삭제, `BcostmL` length 12건 정정, `.toList()` 50/51 전환, dead code 정리. 후속(테스트 스텁·통합테스트 인프라·프로젝션 DTO·토큰 재사용 탐지·캐시 TTL 등)은 TASK.md 신규 등록. |
| ✅ Done | 2026-06-21 | 주석/문서/백로그 | REVIEW.md 재실행 — 병렬 에이전트 관찰 결과와 직접 검증을 통합. **Task1**: `NotificationEvent`/`NotificationEventListener`의 AFTER_COMMIT “비동기” 주석을 실제 동기 콜백 설명으로 정정, `ApplicationService.bulkApprove()` 반환/롤백 JavaDoc 정정, `ReviewerController` `@PathVariable(name)` 명시, 프론트 `$apiFetch`/`useApiFetch` 예시 절대 URL 정정, `stores/review.ts` 검토자 조회 상대 URL을 `${config.public.apiBase}`로 수정. **Task2/3**: 루트/BE/FE README·CLAUDE에 백엔드 포트 28080, Spring Boot 4.1.0, 소스 통계(BE 349/120/74/35, FE 83/56/67/109), 보안 기본값(DB/JWT 기본값 제거, cookie secure=true), `CouncilController` 메서드 레벨 권한 예외, Playwright 3002를 반영. **Task4**: DB/JWT 기본값 제거·프론트 PDF 실패 toast 완료 항목 [Done] 전환, 요구사항 정의서 소유권 검증과 `ServiceRequestDocService` 네이티브 타입 변환 과제 신규 등록. 검증: `it_backend ./gradlew.bat compileJava`, `it_frontend npm run typecheck` 통과. |
| ✅ Done | 2026-06-14 | 주석/문서/백로그 | REVIEW.md 재실행 (델타: 2026-06-12 회차 이후 BE `26a71cd..HEAD` 금액 컬럼 개편·미사용 테이블 정비·폐쇄망 빌드, FE/DB 동일 구간). **Task1**: 검증 후 stale 주석 5건 교정 — `CostRepositoryCustom`(@param 필드명)·`CostRepositoryImpl`(예시 SQL `IT_MNGC_NO`→`BG_NO`) 금액 컬럼 개편 반영, `BplanmL` IT_PRJ_RMK 주석(`IT예산비고`→`IT프로젝트비고`), `types/council.ts` 2자리 코드 주석 2건. java/ts/silent-failure 병렬 탐지는 다수 기추적·오탐 확인. **Task2/3**: 소스 통계 현행화(BE 350→347 Java/115→116 test/79→77 엔티티/36→38 컨트롤러, FE 84→83 컴포넌트·types 11→15, `@IdClass` 15→29), 감사로그 31→30 전반 반영(Bchklc 드롭, JavaDoc 예시 중복 보정), 폐쇄망 빌드는 이미 문서화 확인, Bchklc 드롭에 따른 README 트리·감사표·data-model 참조 3건 정리 + 협의회 10→9 Repository 정정. **Task4**: 신규 5건 등록 — `common.ts` 3자리 dead branch(High), `BprojmL` CNCD_RFR_NO 누락(Medium), `AdminLogService.readField` warn 누락(Medium), `BcostmL` length 불일치(Low), `result/[id].vue` catch 바인딩(Low). `PlanService` 빈 catch 라인 현행화(126-130→133-137), 메타 미등재 BCHKLC 드롭 반영. |
| ✅ Done | 2026-06-12 | 주석/문서/백로그 | REVIEW.md 재실행 (델타 중심: BE 26a71cd 메뉴 athIds, FE 9dcdc68..HEAD 4커밋) — Task1: 협의회 상태코드 3→2자리 전환 미반영 주석 5건 교정(`[id].vue`, `result/[id].vue`), `MenuQueryService.getMenuTree` JavaDoc athIds 반영, `types/menu.ts` athIds TSDoc 전환, 오류삼킴 FIXME/TODO 5곳 등록. Task2/3: FE README 메뉴 표시 유틸·council 2자리 코드 반영, 루트 README 메뉴 숨김 계층(`admin:true` 플래그→DB 권한 매핑) 정정·감사로그 고정 카운트 제거, BE CLAUDE.md §5.5.5 athIds 이원 용도·메뉴 유형 HED 허용(`AdminMenuService:174` 기준) 반영, 감사로그 31쌍 재검증(검증일 부기), FE CLAUDE.md 메뉴 왕관 유틸·협의회 2자리 코드 규칙 추가(인증 코드 무변경 확인으로 보안 규칙 보강 불필요). Task4: silent-failure 4건(High 1)·메뉴 DB 4건(캐시·인덱스, High 2)·리팩토링 3건 신규 등록, `useCouncilCodes` cdvaNm·`EvalSummaryPanel` 템플릿 오류 해소 확인 → [Done] 전환. |
| ✅ Done | 2026-06-09 | 주석/문서/백로그 | REVIEW.md 재실행 — Task1: java/typescript/silent-failure 병렬 탐지 결과 검증(기존 추적·false positive 다수 확인, `MenuChildrenResolver` 영문주석 지적은 이미 한글로 오탐), 신규 도메인 코드는 한글 주석 충실 → `PaymentController` 클래스 주석 1건 보강. Task2/3: 정보화사업 집행 4단계(`domain/{estimate,deliberation,contract,payment}`, `/api/project/**`)와 `infra/eai`를 BE/FE README·CLAUDE.md에 반영, 소스 통계 현행화(BE 291→350 Java/96→115 test/64→79 entity/감사로그 25→31, FE composables 52→56/pages 58→67), CLAUDE.md §5.18~5.19 집행 4단계·EAI 섹션 신설. Task3 security-reviewer: 집행 4단계 소유권 검증 누락·bbrC 필터 미적용 등 HIGH 2건 외 보안 7건 등록. Task4 database-reviewer: 시퀀스 NOCACHE·DEL_YN 복합인덱스·상세 N+1 등 DB 7건 등록. |
| ✅ Done | 2026-06-05 | 주석/문서/백로그 | REVIEW.md 재실행 — DB 기반 메뉴(`domain/menu`, `useMenu`, `useAdminMenu`) 주석과 README/CLAUDE 반영, 소스 통계 현행화(백엔드 291 Java/96 test/63 entity, 프론트 84 components/52 composables/58 pages), 실시간 로그 타입 경로 정정. stale `approval/list.vue` toast 항목 [Done] 전환, `PlanService` 라인 근거 126-130으로 현행화, 프론트 silent fallback 3건과 DB N+1/실시간 로그 인덱스 후보 추가. |
| ✅ Done | 2026-06-01 | 백로그 | silent-failure-hunter·refactor-cleaner·database-reviewer·security-reviewer 4개 분석 결과 신규 7건(High 3·Medium 4) 추가. `NotificationService.send()` recipientEno null 가드 구현 완료 확인 → [Done] 전환. `QnaService` ROLE_ITPAD001·`PlanService.java:108` 빈 catch 코드 미수정 확인 → [Open] 유지. `cors.allowed-origins` High 보안 항목 신규 등록. `Collectors.toList()` 48곳 파일 목록 구체화. `ChangeLogEntityListener:133` Medium·`PlanService:443` High·`budget/approval.vue:458` Medium silent-failure 신규 등록. DB N+1 2건(`BudgetWorkService.getProjectSummary` High·`resolveProjectName` Medium) 신규 등록. |
| ✅ Done | 2026-06-01 | 주석/문서 | REVIEW.md 전체 재실행 — Task1: java/typescript/silent-failure 병렬 탐지 후 `CouncilService`, `info/plan/[id].vue`, `budget/status.vue` 무시형 실패 경로에 한글 TODO 주석 추가. Task2/3: BE/FE README·CLAUDE.md에 실시간 로그 모니터링(`common/admin/realtime`, `useRealtimeLogs`, `/api/admin/realtime-logs`), Nitro `server/` 구조, 최신 파일 수 반영. Task4: 2026-06-01 typecheck/lint 실패, 실시간 로그 검증, N+1/인덱스 후보를 신규 백로그로 등록 |
| ✅ Done | 2026-05-29 | 주석/문서 | REVIEW.md 전체 재실행 — Task1: java/typescript/silent-failure 병렬 탐지 후 검증, 잘못된 주석 3건 교정(`AuthService` 로그인이력 테이블명 `TPRMPP_CLOGNH`, `AuthController` 로그인 응답 필드 주석, `review.ts` nextVersion JSDoc 0.01/2자리), `QnaService` ROLE_ITPAD001 버그 FIXME 추가. Task2/3: BE/FE README·CLAUDE.md에 IT부문 예산 도메인(`domain/budget/it`, `/api/budget/it` ADMIN 전용)·신규 composable(useItBudget/useItProjectRows/useApprovalStatus) 반영. Task4: security-reviewer 신규 2건(문서 대시보드 bbrC 신뢰, getClientIp XFF 미분리) + QnaService 권한 버그 등록. 다수 기존 탐지 항목은 이전 회차에서 이미 수정됨(stale) 확인 |
| ✅ Done | 2026-05-26 | 백로그 | REVIEW.md Task 4 — refactor-cleaner·database-reviewer·silent-failure-hunter 분석. `task1-silent-failures.md` HIGH 이상 항목 전수 검토 후 신규 14건(Critical 1·High 13) 에러 처리 섹션에 등록. 기존 항목 완료 여부 코드 확인(모두 Open 유지). 기준일 2026-05-26 갱신. |
| ✅ Done | 2026-05-22 | 주석 | REVIEW.md Task 1 — java-reviewer·typescript-reviewer·silent-failure-hunter·comment-analyzer 병렬 분석. `@Valid` 누락 FIXME(ApplicationController, ProjectController, PlanController), `@Transactional(readOnly=true)` TODO(PlanService), 유니코드 이스케이프 TODO(CouncilService), 빈 catch [HIGH] TODO 3건(stores/review.ts), FIXME(budget/report.vue), 폴링 정책 주석 보강(useNotifications.ts), 고아 JavaDoc 삭제(NotificationService.java) |
| ✅ Done | 2026-05-22 | 문서 | REVIEW.md Task 2/3 — BE/FE README.md 및 CLAUDE.md에 알림 시스템(common/notification), Tiptap 변수 시스템(common/system/tiptap) 섹션 추가. 컴포넌트 72개·Composable 48개 카운트 갱신. 루트 README §18.10 현행화 메모 추가 |
| ✅ Done | 2026-05-17 | 주석 | REVIEW.md Task 1 재실행 — Java/TypeScript 주석 불일치 교정, Excalidraw/HWPX/Tiptap/Auth 실패 경로 TODO/FIXME 추가, `Bcmmtm.cnfmYn` 컬럼 comment 보강 |
| ✅ Done | 2026-05-19 | 주석/문서 | REVIEW.md 재점검 — 깨진 한글 주석, JavaDoc 위치 오류, 게시판 QueryDSL 설명, 관리자 미들웨어 적용 범위 문서 보강 |
| ✅ Done | 2026-05-17 | 문서 | 루트/백엔드/프론트 README·CLAUDE 현행화 — 테스트 수, Nuxt 버전, 실제 API 경로(`/api/cost`, `/api/plans`), Gemini 관리자 권한, 감사로그 저장 시점 정정 |
| ✅ Done | 2026-05-16 | 주석 | java-reviewer / typescript-reviewer / silent-failure-hunter 탐지 후 comment-analyzer로 48개 파일에 한글 주석/FIXME 마커 적용 (`TaskNotes/review_task1_applied.md`) |
| ✅ Done | 2026-05-16 | 문서 | 루트/it_backend/it_frontend README·CLAUDE.md 현행화 — 모노레포 구조, 캐시 전략(@Cacheable codesByCid·budgetPeriod), @Valid 일관성, 감사로그 BaseLogEntity 패턴, 이벤트 리스너 선택 기준, 프론트 에러 처리/Pinia 에러 전파 규칙 추가 |
| ✅ Done | 2026-05-16 | 보안 | security-reviewer 10개 보안 규칙 감사 — 신규 Critical/High 항목(BCrypt 전환, Refresh Token Rotation, CORS allowedHeaders 화이트리스트 등) TASK.md 등록 |
| ✅ Done | 2026-05-14 | 문서 | 공통 게시판(`common/board`, `/board`, `/admin/boards`)을 루트/백엔드/프론트 README·CLAUDE에 반영 |
| ✅ Done | 2026-05-14 | 문서 | 로그인 Brute-force 보호 설명을 DB 로그인 이력(`TPRMPP_CLOGNH`) 집계 방식으로 정정 |
| ✅ Done | 2026-05-14 | 주석 | `AdminDto`, `BoardPostRepositoryImpl`, `Cblbcm`, 일부 프론트 파일 헤더/계약 주석 보강 |
| ✅ Done | 2026-05-14 | 문서 | `useDeptFilter` 미구현 상태를 프론트 CLAUDE/README에 반영하고 후속 과제로 이동 |
| ✅ Done | 2026-05-10 | 사전협의 | `stores/review.ts` `defaultReviewers` 하드코딩 제거 → `ReviewerService`/`ReviewerController`/`ReviewerDto` TDD 구현 + API 조회 연동 |
| ✅ Done | 2026-05-10 | 프론트엔드 | `formatDateTime` 3개 중복 구현 → `utils/common.ts` 단일 구현으로 통합 |
| ✅ Done | 2026-05-10 | 프론트엔드 | `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 |
| ✅ Done | 2026-05-10 | 문서 | 실제 설정 기준 로컬 포트(프론트 3000, 백엔드 8080)와 비밀값 기본값 잔존 상태를 README/CLAUDE/TASK에 반영 |
| ✅ Done | 2026-05-10 | DB/JPA | `CAPPLA` 복합 인덱스 추가 마이그레이션 확인 (`V20260510_001__add_cappla_composite_index.sql`) |
| ✅ Done | 2026-05-10 | DB/JPA | `BITEMM(PRJ_MNG_NO)` 인덱스 추가 마이그레이션 확인 (`V20260510_002__add_bitemm_prj_mng_no_index.sql`) |
| ✅ Done | 2026-05-09 | 보안 | `EnvironmentValidator` — `spring.datasource.password`, `jwt.secret` 빈값 fast-fail 검증 추가 (단, 개발 기본값 제거는 미완료) |
| ✅ Done | 2026-05-09 | 보안 | `FileOwnershipChecker` 소유권 검증 → `FileController` 적용, `GeminiController` `@PreAuthorize("hasRole('ADMIN')")` 추가 |
| ✅ Done | 2026-05-09 | 보안 | `LoginAttemptService` — `TPRMPP_CLOGNH` 로그인 실패 이력 기반 5회/10분 Brute-force 차단, `AuthService.login()` 연동 |
| ✅ Done | 2026-05-09 | 보안 | `FileValidator` — 허용 확장자 화이트리스트 검증, `FileService.uploadFileInternal()` 연동 |
| ✅ Done | 2026-05-09 | 에러처리 | `SsoController.complete()` catch → `log.error()` 추가 |
| ✅ Done | 2026-05-09 | 에러처리 | `FileService.java` IOException → `CustomGeneralException(msg, e)` cause 전달 |
| ✅ Done | 2026-05-09 | 에러처리 | `ApplicationService.updateApprovalLineInDetail()` → `ApprovalLineDelegate` 위임 메서드 추출, private `@Transactional` 제거 |
| ✅ Done | 2026-05-09 | 에러처리 | `ApplicationService.java` 결재선 업데이트 실패 시 예외 재발생 방침 적용 |
| ✅ Done | 2026-05-09 | DB/JPA | `BudgetWorkQueryRepository` — `getSummary()` 비목 루프 N+1 → 단일 집계 쿼리 통합 |
| ✅ Done | 2026-05-09 | DB/JPA | `Bprojm.update()` 35+ 파라미터 → `BprojmUpdateCommand` 객체 도입 |
| ✅ Done | 2026-05-09 | 주석 | java-reviewer·typescript-reviewer 탐지 결과 → 오류 주석 교정, 누락 JavaDoc/TSDoc 추가 |
| ✅ Done | 2026-05-09 | 주석 | silent-failure-hunter 탐지 결과 → 에러 삼킴 30개 위치에 TODO/FIXME 한글 주석 추가 |
| ✅ Done | 2026-05-09 | 문서 | it_backend/README.md, it_frontend/README.md 전면 재작성 (설계 결정, API 맵, 보안 흐름 포함) |
| ✅ Done | 2026-05-09 | 문서 | it_backend/CLAUDE.md §5.6 보안 규칙 보강 (미적용 컨트롤러 목록, 비밀값 기본값 위험, Brute-force 등) |
| ✅ Done | 2026-04-29 | 인증 | Access Token 쿠키 Max-Age를 JWT 기본 유효시간 15분과 일치시킴 |
| ✅ Done | 2026-04-29 | 문서 | 인증 주석을 httpOnly 쿠키 전략 기준으로 정리 |
| ✅ Done | 2026-04-29 | 테스트 | `CookieUtilTest`를 추가하여 JWT 쿠키 보안 속성과 만료 시간을 검증 |
| ✅ Done | 2026-05-06 | 문서 | JWT 설정 키명과 CORS 개발 Origin 문서를 실제 설정값 기준으로 갱신 |
| ✅ Done | 2026-05-06 | 주석 | 사전협의 코멘트 작성자 팀명/첨부파일 TODO를 백엔드 DTO와 프론트 매퍼에 명시 |

## ☑️ 완료된 체크리스트

- [x] 백엔드 실시간 로그 API 구현 — `RealtimeLogController`/`RealtimeLogService`/`RealtimeLogRepository`, `V_ITPAPP_LOG_FEED` 조회, ADMIN 권한 테스트와 서비스 단위 테스트 추가
- [x] 메타(table.csv) `CBLBCM/CBLBCL` 게시물고유ID 컬럼 정정 — DB·엔티티는 `NAC_UNQ_ID` VARCHAR2(16) 변경 완료(`V20260612_003`), table.csv도 `NAC_UNQ_ID`(16)·`DFR_DT`(지급일자) 등재 반영 확인(2026-06-12). 컬럼 순서 정합은 `V20260612_004`로 완료.
