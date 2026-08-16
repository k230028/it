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

| ID     |     우선순위     | 유형 | 과제                                  | 근거/조건                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | :--------------: | ---- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-12 |     🟢 Low      | MFA  | OnePass FIDO 사용자 거부 상태 구분    | `trResultConfirm`이 `resultCode=100000`이면서 `trStatus != 1`인 응답을 모두 미결정(UNDECIDED)으로 본다. 연동 규격에 사용자 거부를 뜻하는 `trStatus` 값이 정의되어 있지 않아 거부와 대기를 구분하지 못하며, 거부한 거래도 challenge 만료(90초)까지 미결정으로 남는다. 규격에 거부 상태값이 추가되면 `OnePassClient.confirmFido`의 분기에서 `failure()`로 분리한다.                                                     |
| SEC-13 |     🟢 Low      | MFA  | MFA 거래의 다중 인스턴스 지원         | 로그인 대기·MFA 거래를 애플리케이션 메모리에만 두어 서버 재시작 시 진행 중 거래가 모두 폐기되고, 다중 인스턴스 배포를 지원하지 않는다(설계 §8에서 이번 범위 제외). 필요해지면 `MfaTransactionStore`·`LoginPendingTransactionStore` 인터페이스를 공유 캐시 구현으로 교체한다.                                                                                                                                        |

_SEC-04·SEC-05 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-19 Remediation Phase 1, SEC-06은 같은 문서의 2026-07-19 배포 정합성 후속, SEC-08·SEC-09는 2026-07-25 보안 트랜잭션 무결성 절을 참조합니다._

_SEC-10(지정맥 BioAgent 연동 규격 반영)과 SEC-11(지정맥 해시 검증 도입)은 `mfa.md` 반입 직후 같은 작업에서 해소해 표에 남기지 않습니다. 규격과 구현 대조 결과는 `it_frontend/README.md`의 「추가 인증(MFA) 연결」을 참조합니다._

## 🤝 사전협의

> 현재 활성 사전협의 과제 없음. 2026-07-26 완료·폐기 항목은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다.

## ⚠️ 에러 처리

> 현재 활성 에러 처리 과제 없음.

_ERR-09·ERR-10 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-26 에러 표면화·복구 기록을, ERR-06은 2026-07-19 Remediation Phase 1, ERR-05는 같은 문서의 2026-07-19 배포 정합성 후속 기록을 참조합니다. ERR-11·ERR-12는 같은 문서의 2026-07-29 저장 복구·조회 실패 표면화 기록을, ERR-13은 2026-07-31 ERR-13·FE-15~19 조치 기록을, ERR-14는 2026-08-06 잔여과제 저비용 배치 1 기록을 참조합니다._

## 🎨 프론트엔드

| ID    |   우선순위    | 유형   | 과제                                        | 근거/조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | :-----------: | ------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-37 |  🟡 Medium   | 다국어 | 사이트 전체 고정 문구의 i18n 카탈로그 이관 잔여 | 작업 브랜치는 `it_frontend`의 `codex/sitewide-fixed-copy-i18n`이다. 2026-08-16 기준 `node scripts/check-user-facing-copy.mjs --scope app`이 **1553건**을 보고한다. 완료 도메인은 공통 UI·사업(project)·전산업무비(cost)·예산·전자결재·메뉴 관리(admin/menus)·사업예산 홈·사전협의 문서 5화면이며 감사 0건이다. 잔여는 `components/council` 408, `pages/admin` 317, `pages/info`(plan·council-request) 287, `composables` 154, `pages/board` 62, `components/admin` 47, `components/plan` 42, 기타 236건이다. 카탈로그는 `i18n/messages/`에 도메인 파일로 두고 `i18n/locales/{ko,en}.ts`에 등록한다. 화면 단위로 완결해 커밋한다 — 절반만 이관하면 한 화면에 한글·영문이 섞여 이관 전보다 나쁘다. |
| FE-38 |   🟠 High    | 다국어 | 값과 표시명이 결합된 문구의 분리             | 감사기는 리터럴만 보므로 **변수로 렌더되는 한글은 잡지 못한다**. 실제로 `pages/info/index.vue`가 `{{ row.stage }}`로 `ProgressStage`(`'예산작성' \| '사전협의' \| ...`) union 값을 그대로 렌더하고 있었다(2026-08-16 조치). 같은 형태가 `app/utils/common.ts`에 남아 있다 — `getApprovalAuthorityBasis`의 반환 `label: '자본예산' \| '일반관리비'`, `StageProgress = '완료' \| '진행중' \| '미실시' \| '대상 아님'`, `IT_PTL_STS_TIMELINE[].label`. 값 자체를 로직이 비교하므로 `t()`로 감싸면 비교가 깨진다. 값은 유지하고 표시명만 i18n 키로 분리한 뒤 렌더 시점에 번역한다(선례: `pages/info/index.vue`의 `STAGE_LABEL_KEY`, `composables/budget/useBudgetStatusColumns.ts`). |
| FE-39 |  🟡 Medium   | 다국어 | Excel·문서 출력 문구의 locale 전환           | 화면 문구와 달리 Excel 시트명·헤더는 이관을 미루고 `scripts/user-facing-copy-allowlist.json`에 사유와 함께 기록해 두었다(13건: 사업목록·단말기상세목록·전산업무비·결재상신목록 시트명, `composables/budget/useBudgetWorkExcel.ts` 헤더 9건). 파일명·시트명·헤더를 locale별로 바꿀지, 원장 대조를 위해 한글로 고정할지 업무 판단이 먼저 필요하다. 방침이 정해지면 allowlist 항목을 지우면서 함께 처리한다.                                                                                                                                                                                                                          |
| FE-40 |  🟡 Medium   | 다국어 | 탭 제목의 다국어 지원 부재                   | `definePageMeta`는 컴파일 타임 평가라 `t()`를 부를 수 없어, 이관하면서 각 화면의 `title`을 제거하고 `/api/menus` 메뉴명에 의존하도록 바꿨다(CLAUDE.md §4의 메뉴 단일출처 규칙과 일치). 그 결과 **메뉴에 없는 라우트는 탭 제목이 경로 마지막 세그먼트로 떨어진다** — `documents/list`·`documents/form`·`documents/[id]`처럼 하위 경로로 여는 화면이 메뉴 엔트리인지 확인하지 못했다. 또 메뉴명 자체가 DB 한글이라 언어를 바꿔도 탭은 한글로 남는다. `composables/useTabs.ts`의 우선순위(`meta.tabTitle` → 메뉴명 → `meta.title`)가 i18n 키를 받도록 확장하는 방안을 검토한다.                                                     |
| FE-41 |    🟢 Low     | 다국어 | 고정 문구 감사기의 `export-copy` 오탐 정리   | `export`된 문자열 상수를 전부 표시 문구로 보므로 코드 식별자가 오탐으로 잡힌다(CSS 선택자·localStorage 키·PrimeIcons 클래스·코드값·locale 태그 등 12건). 현재는 `scripts/user-facing-copy-allowlist.json`에 사유와 함께 기록해 억제하고 있으나 줄 번호 기준이라 파일이 바뀌면 되살아난다. 다만 휴리스틱을 ASCII 전용으로 좁히면 영문 표시 문구(감사기 테스트의 `English title`)를 놓치므로, 오탐을 줄이면서 영문 문구를 계속 잡을 판별 기준을 먼저 정해야 한다.                                                                                                              |

_2026-07-26 잔여과제 통합 조치의 완료·폐기 이력은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다. FE-21과 FE-30①·FE-28②는 같은 문서의 2026-08-06 잔여과제 저비용 배치 1 기록을, FE-36은 2026-08-09 잔여과제 일괄 조치 기록을 참조합니다._

## ⚙️ 백엔드

| ID    |     우선순위     | 유형  | 과제                                  | 근거/조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | :----------: | --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE-35 |   🟠 High    | 구조  | `ProjectService`가 800줄 상한에 근접 | 2026-08-16 금액 컬럼 작업 후 **766줄**로, `MaxLinesRatchetTest`의 하드 상한 800줄까지 34줄만 남았다. 이 작업에서만 두 번 게이트에 걸려 `ProjectResponseMapper`(`ProjectDto.Response.fromEntity` 52줄)와 `ProjectItemChangeDetector`(`isItemChanged`·`defaultYn`·`bigDecimalChanged`)를 급히 추출해 상쇄했다. 규칙상 기준값 상향·기준선 항목 추가는 허용되지 않으므로, 다음 변경은 **추출 분량을 먼저 계획에 잡아야** 한다. 추출 후보: 품목 동기화(CUD) 블록 전체를 `ProjectItemSyncService`로 분리. 단 `ProjectServiceTest`의 dfrAmt 검증 7건이 `ProjectBudgetSummaryService`를 mock한 채 `ProjectService`를 통해 `applyAmountSnapshot`을 타므로, 그 경로를 옮기면 테스트가 조용히 무력화된다(2026-08-16 최종 리뷰에서 확인). |
| BE-36 |  🟡 Medium   | 계약  | `totRqmAmt` 이름과 값의 불일치 | DB 컬럼 `TPRMPP_BPROJM.TOT_RQM_AMT`는 **총 예산**(∑품목 AMT)이고, 응답 필드 `ProjectDto.Response.totRqmAmt`는 **당해예산**(`∑AMT − ∑MPL_AMT`)이다. 2026-06-22 설계문서가 이미 "컬럼명은 총소요금액이나 실제 저장값은 당해예산"이라 적었고, 2026-08-16 컬럼 재추가 때 총 예산은 새 응답 필드 `prjBgAmt`로 분리해 충돌을 피했다. 현재는 `ProjectResponseMapper.fromEntity`가 엔티티 값을 동명 응답 필드로 흘리지 못하는 구조라 혼선이 차단되어 있으나(최종 리뷰가 세 저장소 전 소비처를 추적해 확인), 이름 자체를 정리하려면 `totRqmAmt` 소비처(예산목록·상세·PDF·전역검색 등 10곳 이상) 전수 조사가 필요하다. |
| BE-37 |  🟡 Medium   | 테스트 | `jacocoTestCoverageVerification` 기존 위반으로 `./gradlew check` 실패 | 2026-08-16 기준 `./gradlew check`가 커버리지 게이트에서 실패한다. 위반 클래스는 `CodeService`, `migration.request.service.adapter`의 `FormPersonNames`·`IoeCandidates`·`FormCheckboxReader`·`GeneralExpenseFormAdapter`·`CapitalProjectFormAdapter`, `MigrationIoeCatalogReader`, i18n의 `TranslationTargetKey`·`TranslationCatalogService`·`TranslationAdminController`다(per-class 70% LINE/BRANCH/COMPLEXITY). 이 작업 이전부터 실패 상태이며 금액 컬럼 작업이 추가한 클래스는 위반 목록에 없다(확인 완료). 병합 전 품질 게이트가 사실상 무력화된 상태이므로 `./gradlew test`로 대체 운용 중이다. |
| BE-24 | 🏛️ External | DB  | 집행 문서 활성 버전 UNIQUE 인덱스의 dev/prod 적용 | 코드·마이그레이션·검증은 2026-08-09에 완료했다([`TASK_DONE.md`](TASK_DONE.md) 2026-08-09 잔여과제 일괄 조치). 남은 것은 **DBA의 dev/prod 적용 하나뿐**이다. 적용 대상은 `it_database/migrations/V20260809_001__AddExecutionDocumentActiveVersionUniqueIndex.sql`(세 테이블에 `IX_TPRMPP_{BDELIM,BCONTM,BPAYMM}_03` 함수 기반 UNIQUE 인덱스), 절차·사전점검·롤백은 `it_database/docs/operations/2026-08-09-be24-active-version-index-handover.md`를 따른다. **사전 점검이 게이트다**: 활성행이 둘 이상인 문서가 있으면 `ORA-01452`로 실패하므로 인계 노트 §2의 중복 조회를 dev/prod에서 먼저 돌려 3건 모두 0인지 확인한다(로컬은 0 확인). 0이 아니면 어느 버전을 남길지 업무 담당자 확인이 선행되어야 하므로 적용하지 않는다. |

_BE-34 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-08-06 잔여과제 저비용 배치 1 기록을 참조합니다._

## 🔄 수기 엑셀 이관

| ID     |     우선순위     | 유형 | 과제                                   | 근거/조건                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | :--------------: | ---- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIG-01 |     🟡 Medium     | 이관 | 부문계획 `사업진행`·집행 실적 열의 원장 반영 | 정보기술부문계획 조정의 `사업진행`(`진행(품의)`·`진행(계약)`·`취소(연기)`)과 집행 실적 4열은 대응하는 원장 코드셋이 없어 `BPLANM.REDT_CONE_INF` 계획 JSON 스냅샷에만 남겼다(`docs/superpowers/specs/2026-08-11-excel-bulk-migration-design.md` §5.4). 이 값들을 조회·집계에 쓰려면 `BPROJA.IT_PTL_STS_TC` 또는 `BPROJM.IT_PTL_RPR_STS_TC`의 유효 코드셋을 먼저 확정하고 계약 테스트를 추가한다. |
| MIG-02 |      🟢 Low       | 이관 | 정규 컬럼 id 계약의 자동 검증          | `it_backend/src/main/java/com/kdb/it/domain/migration/dto/MigrationColumns.java`와 `it_frontend/app/composables/migration/columns.ts`가 같은 리터럴 목록을 손으로 유지하며 빌드 타임에 대조하는 장치가 없다. 한쪽만 바꾸면 dry-run이 조용히 빈 셀을 읽는다. 백엔드가 컬럼 목록을 API로 노출하고 프론트 테스트가 그 응답과 대조하는 방식으로 게이트를 만들 수 있다.                          |
| MIG-03 |      🟢 Low       | 이관 | 위임예산 부점 사업의 담당자 지정       | 위임예산 시트에 담당자 열이 없어 `DelegatedBudgetSheetAdapter`가 업로드 사용자 사번(`ctx.actorEno()`)을 담당자·IT담당자로 그대로 넣는다(설계 §5.5). 부점별 실제 담당자를 지정할 수 있는 입력을 미리보기 화면에 추가할 수 있다.                                                                                                                                                                     |
| MIG-04 |     🟡 Medium     | 이관 | 위임예산 연속행의 부점 보정값이 그룹을 분기시킴 | `DelegatedBudgetSheetAdapter.adapt`는 `branchName` 셀이 비어 있지 않을 때마다 `currentBranch`를 갱신해 그 값으로 `itemsByBranch`를 그룹핑한다. 연속행(병합 셀)에 보정값(대개 조직코드, 예: `0910`)을 입력하면 그 행부터 새 그룹키로 분기되어 `2026년 0910 위임예산(경상)`처럼 원래 부점명과 다른 사업이 만들어지고 형제 행에서 분리된다. 보정 UI에서 연속행에 조직코드를 입력할 때 부점명 그룹핑에 영향을 주지 않도록 별도 필드로 분리하거나 경고를 추가하는 방안을 검토한다. |
| MIG-06 |      🟢 Low       | 이관 | 미해결 편성률·계획 intent가 조용히 드롭됨 | `MigrationImportService`의 편성률(270행)·부문계획 조정(305행) 반영 루프는 대상 PK·사업을 찾지 못하면 `log.warn`만 남기고 건너뛴다. 반영 응답(`MigrationCommitResponse`)에 건너뛴 건수를 노출해 사용자가 로그를 보지 않아도 알 수 있게 하는 방안을 검토한다.                                                                                                                                   |
| MIG-07 |     🟠 High       | 테스트 | `test-it` 프로파일의 `MfaProviderRegistry` 미등록으로 통합 테스트 전체 실패 | `MfaConfig.mfaProviderRegistry`가 `@Profile({"local-ext","local-int","dev","prod"})`만 지정하고 `test-it`을 포함하지 않아 `@SpringBootTest` 기반 통합 테스트가 컨텍스트 로딩 단계에서 전부 실패한다(`AuditFailureIsolationIT`로 확인 — `main` 브랜치에서 이 이관 작업 이전부터 실패). 이번 이관 범위와 무관한 기존 결함이며 `MigrationImportIt`은 테스트 전용 폴백 경로를 타서 영향을 받지 않는다. `test-it`을 이 프로파일 목록에 추가할지는 `app.mfa.mock-enabled` 가드와 함께 보안 관련 불변조건을 건드리므로 사용자 확인 후 결정한다. **2026-08-16 재확인**: 금액 컬럼 작업 중 `./gradlew integrationTest`가 143건 중 48건(재실행 시 126건 중 31건) 실패했고, 근본 원인은 이 `NoSuchBeanDefinitionException: MfaProviderRegistry`와 `OutOfMemoryError` 둘뿐이며 나머지는 `ApplicationContext failure threshold exceeded` 연쇄였다. `@DataJpaTest` 계열(budget/project 도메인 포함)은 전부 통과하므로 영향은 `@SpringBootTest` 전체컨텍스트 계열에 한정된다. |
| MIG-10 |     🟡 Medium     | 이관 | 자본예산 품목 비목 보정을 미리보기에서 고를 수 없음 | `CapitalProjectSheetAdapter`는 `devAmountIoeC`·`hwAmountIoeC`·`swAmountIoeC` 보정 키를 받고 `MigrationValidator.checkCapitalIoeOverrides`가 그 값을 검증하지만, 미리보기 표의 보정 드롭다운 선택지는 **그 셀에 걸린 진단의 `candidates`**에서만 나온다. 보정을 아직 넣지 않은 셀에는 진단이 없어 후보도 없으므로 사용자가 기본 비목(개발비 103·기계장치 101·기타무형 106)을 감리(104)·국외(102/105)·SW라이선스(107)로 바꿀 방법이 화면에 없다. 도달할 수 없는 컬럼 라벨은 `it_frontend/app/composables/migration/columns.ts`에서 제거해 두었다. 해소하려면 dry-run 응답에 자본 계열 비목 카탈로그를 실어야 하므로 API 계약 변경이 필요하다. |
| MIG-12 |      🟢 Low       | 이관 | 편성요청서 국문·영문 대조표 보강 | `FormLexicon`의 라벨·비목 대조표는 런던지점 제출본 1건에서 뽑았다. 다른 해외점포(시드니·뉴욕·도쿄 등)의 번역이 다를 수 있고, 실제로 런던 파일에도 `Machinery` › `Tape backup software`처럼 대응 비목이 애매한 행이 있다. 해외점포 제출본이 들어오면 미해석(`CODE_UNRESOLVED`)으로 남은 어휘를 수집해 대조표에 추가한다. 어휘 추가는 `FormLexicon` 상수 한 줄이면 된다. |

## 🧹 Clean Code 부채

> 현재 활성 Clean Code 부채 없음.


_CQ-02~05·07~14 완료 근거는 [`TASK_DONE.md`](TASK_DONE.md)의 2026-07-21 Clean Code Wave 0·1·2와 2026-07-25 정리 이관 절을, CQ-06·17·21은 2026-08-04 Wave 3 Wave A 절을, CQ-16은 2026-08-04 Wave 3 Wave B·C 절을, CQ-20은 2026-08-01 Prettier 잔여 해소 절을, CQ-25·26은 2026-08-09 잔여과제 일괄 조치 절을 참조합니다._

## 📝 Tiptap 변수 입력

> 현재 활성 Tiptap 변수 입력 과제 없음. 2026-07-26 완료·폐기 항목과 알려진 제한은 [`TASK_DONE.md`](TASK_DONE.md)를 참조합니다.

## 📡 실시간 로그

> 현재 활성 실시간 로그 과제 없음.

## 📬 공통 게시판

> 현재 활성 과제 없음.
