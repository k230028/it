# 전산예산 작성 화면 개선 설계 (변경1~5)

## 1. 목적

전산예산 작성·상신 화면에 접수된 다섯 가지 변경 요청을 한 번에 반영한다.

| 번호 | 요청 | 영향 저장소 |
| --- | --- | --- |
| 변경1 | 정보화사업 기 지급금액 라벨을 `YYYY 이전 지급금액 (원)`으로 바꾸고 당해 지급예정액 포함 안내를 붙인다 | 프론트 |
| 변경2 | 사업연도 Select에서 과거연도를 숨기고 9월부터 다음 연도를 기본값으로 하며 9월 이후 당해연도 선택 시 유의사항 팝업을 띄운다 | 프론트 |
| 변경3 | 소요자원 상세의 항목 라벨 수정, 금액 0 포커스 시 빈칸, 산정근거를 단일 Select로 전환한다 | 프론트, DB(코드) |
| 변경4 | 국내점포 기안자의 전산예산 요청서 결재라인을 직위 기준으로 자동 지정한다 | 백엔드, 프론트, DB(코드) |
| 변경5 | 저장 상태를 임시저장(신청서 없음)과 작성완료(코드 `0`)로 나눈다 | 백엔드, 프론트, DB(코드·데이터) |

## 2. 범위

### 포함

- 정보화사업·경상사업 작성 화면(`app/pages/info/projects/form.vue`)과 전산업무비 작성 화면(`app/pages/info/cost/form.vue`)
- 전산예산 결재 상신 화면(`app/pages/budget/report.vue`, `app/pages/budget/list.vue`)
- 신청서 상태 코드 `IT_PTL_APF_PRG_STS_C`의 코드값 정리와 기존 데이터 이관
- 결재자 직위 판정용 공통코드 그룹과 산정근거 선택지 공통코드 그룹 신설
- 결재라인 제안 API 신설
- 백엔드·프론트엔드·DB 마이그레이션 테스트

### 제외

- 국외점포(부점코드 `9`로 시작) 결재라인 자동지정. 현행 수동 지정을 유지한다
- 결재 상신 이후 결재선 변경(기존 결재선 편집 기능 그대로)
- 사업연도에 대한 서버 검증 추가
- 전산업무비 화면의 산정근거·금액 입력 변경(변경3은 정보화사업·경상사업만 대상)
- 정보화사업관계(`TPRMPP_BPROJA`) 단계코드 변경. 저장은 지금처럼 `01`을 유지한다
- 신청서 PDF 문구 변경. PDF는 기 지급금액과 소요자원 컬럼 헤더를 출력하지 않는다

## 3. 현행 구조 요약

- 기 지급금액은 `BPROJM.DFR_AMT` 사용자 입력이며 정보화사업 폼에서만 보인다. 라벨은 i18n `project.form.fields.paidBudget`과 `project.detail.fields.paidBudget`에 있다.
- 사업연도 선택지는 `useProjectFormPage.ts`가 작년·올해·내년 세 개를 만들고, 기본값은 `app/utils/budgetYear.ts`의 `defaultBudgetYear()`가 8월부터 다음 연도로 계산한다. 이 함수는 목록·상신·건수 조회 화면도 공유한다. 수정 모드에서는 Select가 비활성이다.
- 소요자원 상세는 `ResourceTableSection.vue`(편집)와 `ProjectResourceTable.vue`(조회)가 담당한다. 항목은 `BITEMM.GCL_NM`, 산정근거는 `BITEMM.CNCD_FDTN_CONE VARCHAR2(600 BYTE)` 자유 텍스트다. 금액 두 컬럼(`gclAmt`, `laterAmt`)은 신규 행이 0으로 시작해 `₩0`으로 표시된다.
- 결재라인은 `report.vue`가 기안자만 로그인 사용자로 채우고 팀장·부서장은 `ApprovalLineEditorDialog`로 수동 선택한다. 자동지정 로직은 없다. 사용자 테이블 `TPRMPP_CUSERI`에는 부점코드 `BBR_C`, 팀코드 `TEM_C`, 직위코드 `PT_C`, 직위명 `PT_C_NM`이 있고 직책 컬럼은 없다. 결재자 후보는 사번 접두사 `K`로 제한한다(`EMPLOYEE_ASSIGNABLE_ENO_PREFIX`).
- 신청서 상태는 `TPRMPP_CAPPLM.IT_PTL_APF_PRG_STS_C`에만 있다. 결재 상신은 여러 사업·전산업무비를 묶어 신청서 한 건을 만들고, 저장만 한 원천은 신청서 행이 없어 상태가 null이다. 목록의 결재상태 판정은 원천 `(관리번호, 순번)`에 연결된 신청서 중 신청서번호가 가장 큰 것을 본다.
- `ApprovalStatus` enum은 `MANUAL("0","수기등록")`을 가지며 편성요청서 반입(`RequestFormFileImporter` → `MigrationApprovalStamper`)이 결재선 없는 신청서 행을 이 코드로 만든다. 그 행은 등록자결재요청내용 `수기등록` 표식으로 구분한다.

## 4. 변경1. 기 지급금액 라벨

프론트 문구만 바꾼다.

- i18n `project.form.fields.paidBudget`를 `{year} 이전 지급금액 (원)`으로, `project.detail.fields.paidBudget`를 `{year} 이전 지급금액`으로 바꾸고 호출부가 `form.bgYy`(상세는 `project.bseYy`)를 넘긴다.
- 입력란 아래에 보조 문구 `project.form.fields.paidBudgetNote = '* 당해 지급예정액 포함'`을 작은 글씨로 둔다. 상세 화면에도 같은 문구를 값 아래에 둔다.
- 영문 번역은 `Payments before {year} (KRW)`, 보조 문구는 `* Includes the amount scheduled for {year}`로 둔다.
- 백엔드·DB·PDF 변경은 없다.

## 5. 변경2. 사업연도 Select

### 5.1 선택지와 기본값

- `defaultBudgetYear(now)`의 기준 월을 8월에서 9월로 옮긴다. 1~8월은 올해, 9~12월은 내년을 반환한다. 이 함수를 쓰는 목록·상신·건수 조회 화면의 기본 연도도 함께 9월 기준으로 바뀐다. 이는 전산예산 회계연도 전환 시점을 한 곳에서 관리하기 위한 의도적 결정이다.
- `useProjectFormPage.ts`의 `yearOptions`를 `[올해, 내년]` 두 개로 줄인다. 기본값은 `defaultBudgetYear()`가 정한다.
- 수정 모드에서 불러온 사업연도가 두 선택지에 없으면(과거연도 사업) 그 연도만 선택지에 추가해 빈 값으로 보이지 않게 한다. Select는 수정 모드에서 계속 비활성이다.

### 5.2 유의사항 팝업

- 신규 작성 모드에서 현재 월이 9~12월이고 사용자가 올해를 선택하면 `useProjectFormPage.ts`가 이미 쓰는 PrimeVue `useConfirm()`으로 팝업을 띄운다.
- 제목 `유의사항 안내`, 본문 `매년 9월 이후 당해년도 예산 신청은 IT기획팀 전산예산 담당자와 사전협의 후 진행하셔야 하며, 협의되지 않은 예산은 반려될 수 있습니다.`
- 확인은 선택을 유지한다. 취소는 내년으로 되돌린다.
- 기본값이 내년인 상태로 화면이 열릴 때는 팝업을 띄우지 않는다. 사용자의 명시적 선택에만 반응한다.
- 문구는 i18n `project.form.yearNotice.{title,body}`에 둔다.

## 6. 변경3. 소요자원 상세내용

### 6.1 항목 라벨

i18n `project.form.resource.columns.item`을 `항목(품목 등)`으로 바꾼다. 편집·조회 테이블이 같은 키를 쓰므로 함께 바뀐다. 영문은 `Item (goods, etc.)`.

### 6.2 금액 입력의 0 처리

- 당해 요청금액(`gclAmt`)과 익년 이후 금액(`laterAmt`) `InputNumber`에 포커스·블러 핸들러를 붙인다.
- 포커스 시 값이 정확히 0이면 모델을 `null`로 바꿔 빈칸으로 보인다. 0보다 크면 그대로 둔다.
- 블러 시 모델이 `null`이면 0으로 되돌린다. 저장 페이로드는 지금처럼 항상 숫자다.
- 같은 규칙을 `useResourceAmountFocus` composable로 분리해 두 컬럼이 공유한다. 수량 컬럼은 대상이 아니다.

### 6.3 산정근거 Select

스키마를 바꾸지 않고 선택 라벨을 기존 컬럼 `CNCD_FDTN_CONE`에 문자열로 저장한다(사용자 결정 2026-09-03).

- 공통코드 그룹 `IT_PTL_CNCD_FDTN_TC`(산정근거구분코드)를 신설한다.

  | CDVA_ID | CDVA_NM | C_SQN_SNO |
  | --- | --- | --- |
  | `01` | 견적서 | 1 |
  | `02` | 내부산출 | 2 |
  | `03` | 타행사례 | 3 |
  | `99` | 기타(직접입력) | 4 |

- 편집 화면은 Select 하나와, 기타를 고른 경우에만 보이는 텍스트 입력 하나로 구성한다. 텍스트 입력은 기존 600바이트 제한과 길이 표시를 그대로 쓴다.
- 저장 규칙: 견적서·내부산출·타행사례는 코드명 문자열(`견적서` 등)을 `basis`에 넣는다. 기타는 직접입력 텍스트를 넣는다. 기타를 고르고 텍스트가 비어 있으면 저장 전 검증에서 해당 행을 지목해 막는다.
- 복원 규칙: 불러온 `basis`가 코드명 세 개 중 하나와 정확히 일치하면 그 옵션, 비어 있지 않으면 기타와 텍스트, 비어 있으면 미선택으로 복원한다. 기존 자유 텍스트 데이터는 기타로 복원되어 사용자가 재분류한다.
- 조회 화면·PDF는 지금처럼 `basis` 문자열을 그대로 보여준다.
- 코드명은 저장된 문자열과 매핑 키이므로 바꾸지 않는다. 바꿔야 하면 기존 데이터 이관 마이그레이션을 함께 만든다. 이 제약을 코드 그룹 시드 마이그레이션 주석에 남긴다.

## 7. 변경4. 결재라인 자동지정

### 7.1 판정 규칙

- 대상 기안자는 로그인 사용자다. 부점코드가 `9`로 시작하면 국외점포로 보고 자동지정하지 않는다.
- 국내점포는 공통코드 그룹 `IT_PTL_APF_DCR_PT_C`(결재자직위코드)로 판정한다. `CDVA_ID`는 직위코드 `PT_C` 값, `CDVA_NM`은 직위명, `CO_CDVA_NM`은 차수(`1` 또는 `2`)다. 시드 값은 다음과 같다(사용자 제공 2026-09-03).

  | CDVA_ID | CDVA_NM | CO_CDVA_NM(차수) | C_SQN_SNO |
  | --- | --- | --- | --- |
  | `B1EX` | 팀장 | `1` | 1 |
  | `I3EX` | CO | `1` | 2 |
  | `B1AX` | 부장 | `2` | 3 |
  | `B1CX` | 실장 | `2` | 4 |
  | `B1BX` | 지점장 | `2` | 5 |
  | `B1AY` | 국장 | `2` | 6 |
  | `B1GX` | 센터장 | `2` | 7 |
  | `Z2C` | 사장 | `2` | 8 |

  `PT_C`는 5자리 컬럼이라 3자리 코드 `Z2C`도 그대로 저장한다. 판정은 정확히 일치하는 값으로 하며 접두사 비교를 쓰지 않는다.
  - 1차: 기안자와 같은 팀코드(`TEM_C`)와 같은 부점코드(`BBR_C`)인 재직자 중 차수 `1` 직위
  - 2차: 기안자와 같은 부점코드인 재직자 중 차수 `2` 직위
- 후보는 삭제되지 않은 사용자(`DEL_YN='N'`) 중 사번이 `K`로 시작하는 사람으로 한정하고 기안자 본인은 제외한다. 이 접두사는 기존 사용자 검색 API의 `enoPrefix`와 같은 규칙이며 백엔드 상수로 둔다.
- 차수별 후보가 정확히 한 명이면 지정한다. 0명이거나 2명 이상이면 그 차수는 비우고 사유 코드를 돌려준다.
- 1차와 2차가 같은 사람으로 계산되면 2차만 비우고 사유 `DUPLICATE`를 돌려준다.

### 7.2 백엔드 API

`GET /api/applications/approval-line/suggestion`

응답 `ApplicationDto.ApprovalLineSuggestion`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `foreignBranch` | boolean | 국외점포라 자동지정하지 않았으면 true |
| `teamLead` | `UserDto.ListResponse` 또는 null | 1차 결재자 |
| `deptHead` | `UserDto.ListResponse` 또는 null | 2차 결재자 |
| `teamLeadReason` | `NONE`, `MULTIPLE`, `DUPLICATE` 또는 null | 비운 이유 |
| `deptHeadReason` | 같음 | 비운 이유 |

- 구현은 `common.approval.service.ApprovalLineSuggestionService`가 맡는다. `UserRepository`에 `findByBbrCAndPtCInAndDelYn`, `findByBbrCAndTemCAndPtCInAndDelYn`을 추가해 DB에서 거른다.
- 직위코드 그룹은 `CommonCodeService`로 읽고 차수별로 나눈다. 그룹이 비어 있으면 두 차수 모두 사유 `NONE`으로 응답하고 경고 로그를 남긴다.
- 국외 판정 접두사 `9`는 `FormAdapterContext.FOREIGN_DEPT_PREFIX`가 이미 갖고 있다. `common.iam.BranchCodes.isForeign(bbrC)`로 뽑아 두 곳이 함께 쓴다.
- 인증 실패는 401, 사용자 행이 없으면 `IllegalArgumentException`을 던지고 `GlobalExceptionHandler`가 이를 400으로 매핑해 돌려준다(404가 아니다).

### 7.3 프론트

- `report.vue`는 로그인 사용자 확인 뒤 제안 API를 한 번 호출한다. 팀장·부서장이 비어 있는 경우에만 응답값으로 채우고 PDF를 재생성한다.
- `foreignBranch`가 true면 아무것도 하지 않는다.
- 어느 한 차수라도 비어 있으면 상신 버튼 위에 경고 배너를 띄운다. 문구는 사유별로 둔다(`후보가 없습니다`, `후보가 2명 이상입니다`, `1차 결재자와 같은 사람입니다`). 사용자는 기존 편집 다이얼로그로 직접 고른다.
- 제안 API 호출 실패는 배너로 안내하고 상신 자체는 막지 않는다. 결재라인 필수 검증은 지금처럼 상신 시점에 수행한다.
- 새 API 타입은 `npm run codegen`으로 생성한다.

### 7.4 시드와 운영 조정

7.1의 직위코드 표를 시드 마이그레이션 `V20260903_002__SeedApprovalLinePositionCodes.sql`로 넣는다. 값이 바뀌어도 코드 수정 없이 공통코드에서 조정할 수 있다. 시드는 재실행 안전한 MERGE로 작성하고 검증 블록으로 8행 존재를 확인한다.

## 8. 변경5. 임시저장·작성완료

### 8.1 상태 코드 정리

`IT_PTL_APF_PRG_STS_C`를 다음과 같이 둔다.

| 코드 | 이름 | 비고 |
| --- | --- | --- |
| `0` | 작성완료 | 신설. 결재선 없는 신청서 |
| `1` | 결재중 | 기존 |
| `2` | 결재완료 | 기존 |
| `3` | 반려 | 기존 |
| `4` | 회수 | 기존 |
| `9` | 수기등록 | 편성요청서 반입. `0`에서 이동 |

- 백엔드 enum은 `DRAFTED("0","작성완료")`를 추가하고 `MANUAL`의 코드를 `"9"`로 바꾼다. 반입 코드는 계속 `MANUAL`을 쓴다.
- 프론트 `useApprovalStatus.ts`의 라벨 맵에 `0`·`9`를 추가하고 i18n `approval.status.drafted = '작성완료'`, `approval.status.manual = '수기등록'`을 둔다.

### 8.2 데이터 이관

마이그레이션 `V20260903_001__AddDraftedApplicationStatusCode.sql`

1. `TPRMPP_CCODEM`에 `('IT_PTL_APF_PRG_STS_C','0','작성완료', 순번 0)`과 `('IT_PTL_APF_PRG_STS_C','9','수기등록', 순번 9)`를 MERGE 한다.
2. `TPRMPP_CAPPLM`과 `TPRMPP_CAPPLL`의 `IT_PTL_APF_PRG_STS_C='0'` 행을 `'9'`로 UPDATE 한다. 이 시점의 `0` 행은 모두 반입 산출물이다. 앱 기동 전에 Flyway가 먼저 돌아 새 코드가 `0`을 쓰기 전에 정리가 끝난다.
3. 영문 번역(`TPRMPP_CLANGM`)에 `0 = Drafted`, `9 = Manually Registered`를 넣는다.
4. 검증 블록으로 코드 두 건 존재와 `RGPR_DCD_REQ_CONE='수기등록'`이면서 `'0'`인 행이 없음을 확인하고, 어긋나면 실패시킨다.

### 8.3 저장 흐름

- 세 작성 화면(정보화사업·경상사업·전산업무비) 모두 **[임시저장]**과 **[저장]** 두 버튼을 둔다. 문구는 `common.actions.saveDraft = '임시저장'`, `common.actions.save = '저장'`.
- 임시저장은 현행 저장과 같다. 원천만 저장하고 신청서 행을 만들지 않는다. 목록 배지는 `임시저장`으로 보인다.
- 저장은 원천 저장 뒤 결재선 없는 신청서 행을 `0`으로 만든다.
  - `MigrationApprovalStamper`를 `common.approval.service.ApprovalStamper`로 옮기고 반입 코드가 이를 참조한다. 저장 경로는 `stampDrafted(fntTbNm, pkColNm, crySno, title, actorEno, bbrC, bseYy)`를 호출한다.
  - 멱등 규칙: 같은 `(원천테이블, 관리번호, 순번)`에 연결된 최신 신청서가 이미 `0`이면 제목만 갱신한다. `1`(결재중)이면 `IllegalStateException`으로 저장을 거부한다. 신청서가 없거나 `2`·`3`·`4`·`9`이면 새 `0` 행을 만든다.
  - 신청서번호는 기존 시퀀스 형식 `APF-{연도}-{8자리}`를 그대로 쓴다. 결재요청일시(`DCD_REQ_DTM`)는 비워 두고 상신 시점의 신청서에만 기록한다.
- 한 번 작성완료된 원천은 편집 화면에서 [저장]만 보인다. 저장된 내용이 그대로 상신되므로 작성완료 뒤 임시저장은 의미가 없고, 상태를 되돌리는 삭제 로직을 두지 않는다. 화면은 상세 응답의 결재상태로 이를 판정한다.
- 정보화사업관계(`BPROJA`)는 임시저장·저장 모두 `01`로 둔다.

### 8.4 API 계약

- `ProjectDto.CreateRequest`·`UpdateRequest`, `CostDto.CreateRequest`·`UpdateRequest`에 `@NotNull Boolean complete`를 추가한다. `true`가 저장, `false`가 임시저장이다. 누락은 400이다.
- 반입 전용 경로(`createCostForMigration`, `updateCostForMigration`, 편성요청서 반입)는 이 필드를 쓰지 않고 `MANUAL` 스탬프를 유지한다.
- 프론트는 `npm run codegen`으로 타입을 갱신하고 버튼에 따라 값을 보낸다. 전산업무비 폼은 행마다 순차 호출하므로 모든 행에 같은 값을 보낸다.

### 8.5 상신과 목록

- 결재 상신은 지금처럼 여러 원천을 묶어 `1` 상태의 새 신청서를 만든다. 원천의 `0` 행은 갱신하지 않는다. 목록 판정이 최신 신청서번호 기준이라 새 신청서가 `0` 행을 자연스럽게 덮고, `0` 행은 반려·회수 행처럼 이력으로 남는다.
- 결재 상신 화면의 "상신 대상" 조회는 `apfSts='none'`에서 `apfSts='0'`으로 바꾼다. 결재 상신 사이드바 배지의 건수 조회도 같은 조건을 쓴다. 반려·회수 건은 다시 [저장]해야 상신 대상이 된다. 이는 현행과 다른 동작이며 작성완료를 상신 관문으로 쓰려는 이번 요청의 취지에 맞춘 결정이다.
- `BudgetListVersionScope.DRAFT_VISIBLE_CODES`에 `DRAFTED`를 추가해 저장한 재상신 초안(`LST_YN='N'`)이 작성완료 스코프에서 보이게 한다.
- **알려진 부작용(문서만, 코드 변경 없음):** 편성요청서 반입 경로는 원천에 결재선 없는 수기등록(`9`, `MANUAL`) 신청서를 스탬프한다. 상신 화면 스코프가 "활성·완료 신청서 없음"(`apfSts='none'`)이던 이전에는 이 반입 항목이 상신 대상에 보였지만, 스코프를 "최신 신청서가 작성완료(`0`)"로 좁힌 이번 변경 이후로는 최신 신청서가 `9`(작성완료가 아님)라 상신 대상에서 사라진다. 담당자가 화면을 열어 [저장]해 작성완료(`0`) 신청서로 갱신해야 다시 나타난다. 이는 이번 변경이 낳은 실제 동작 차이이며, 반입 항목을 스코프에 자동 포함시키는 것은 별도 결정이 필요하다(이번 계획은 그런 규칙을 의도하지 않았다).
- `none` 스코프의 의미는 유지한다(활성·완료 신청서가 없는 항목). 상신 대상 판정에는 더 이상 쓰지 않는다.
- 사업·전산업무비 목록 배지: 신청서 없음은 `임시저장`, `0`은 `작성완료`. 기존 `getApprovalTagClass`의 `임시저장` 회색 스타일을 쓰고 `작성완료`는 같은 회색 계열로 추가한다. 목록 응답의 `apfSts` 라벨은 `ApprovalStatus.label()`에서 나온다.
- 결재함 목록(`GET /api/applications`), 대시보드, 결재 대기 조회는 `0`을 제외한다. `findTop500ByOrderByApfMngNoDesc`를 상태 제외 조건이 있는 쿼리로 바꾼다. 대시보드 집계는 이미 `1`·`2`·`3`을 명시하므로 영향이 없다.

## 9. 데이터 흐름 요약

```
[작성 화면] --complete=false--> 원천 저장                         (신청서 없음 = 임시저장)
[작성 화면] --complete=true---> 원천 저장 + CAPPLM/CAPPLA 0 스탬프  (작성완료)
[상신 화면] 상신 대상(apfSts=0) 조회 → 결재라인 제안 API → 상신 → CAPPLM 1 (묶음)
결재 → 2 / 3 / 4 ; 반려·회수 후 [저장] → 새 CAPPLM 0 → 다시 상신 대상
```

## 10. 오류 처리

- 저장 중 원천 저장은 성공했는데 스탬프가 실패하면 같은 트랜잭션이므로 함께 롤백된다. 화면은 저장 실패 토스트를 띄운다.
- 결재중인 원천에 [저장]을 누르면 `ApprovalStamper`가 `IllegalStateException`을 던지고 `GlobalExceptionHandler`가 이를 400으로 매핑해 응답한다(409가 아니다). 화면은 `결재중인 항목은 수정할 수 없습니다`를 띄운다.
- 결재라인 제안 API 실패는 배너로 안내하고 상신은 막지 않는다.
- 산정근거 기타에 텍스트가 없으면 저장 전 검증에서 행 번호를 지목한다.
- 마이그레이션 검증 실패는 기동을 막는다.

## 11. 테스트

### 백엔드

- `ApprovalStatusTest`: `0`·`9` 코드와 라벨 조회, `isTerminated`
- `ApprovalStamperTest`: 신규 `0` 생성, 기존 `0` 멱등 갱신, `1`일 때 거부, 반입 `MANUAL` 경로 유지
- `ProjectServiceTest`·`CostServiceTest`: `complete` 값에 따른 스탬프 호출 여부
- `ProjectRepositoryImplTest`·`CostRepositoryImplTest`: `apfSts='0'` 스코프가 최신 `0` 원천만 돌려주고 초안(`LST_YN='N'`)을 포함
- `ApprovalLineSuggestionServiceTest`: 국외 제외, 1차·2차 단일 후보, 0명·복수·중복 사유, 사번 접두사·본인 제외
- `ApplicationServiceTest`: 결재함 목록이 `0`을 제외

### 프론트엔드

- `budgetYear.spec.ts`: 8월은 올해, 9월은 내년
- `useProjectFormPage.spec.ts`: 선택지 두 개, 과거연도 보존, 9월 이후 올해 선택 시 팝업과 취소 복원
- `ResourceTableSection.spec.ts`: 항목 라벨, 0 포커스 빈칸·블러 복원, 산정근거 저장·복원 규칙과 기타 빈값 검증
- `report.spec.ts`: 제안 응답으로 팀장·부서장 채움, 사유 배너, 실패 시 상신 유지
- `useApprovalStatus.spec.ts`: `0`·`9` 라벨
- 작성 화면 버튼: 작성완료 건에서 [임시저장] 숨김

### DB

- 마이그레이션 검증 블록과 `migrations/_verify/code-migration-verify.sql` 갱신

## 12. 문서와 계약 갱신

- `it_backend/docs/guides/` 결재 상태 가이드에 `0`·`9` 의미와 스탬프 규칙을 추가한다.
- `it_frontend/app/composables/useApprovalStatus.ts` 파일 상단 코드표 주석을 갱신한다.
- OpenAPI 변경 뒤 프론트에서 `npm run codegen`과 `npm run codegen:check`를 실행한다.
- `versions.lock`은 `scripts/update-versions-lock.ps1`로 갱신한다.

## 13. 결정 기록

| 날짜 | 결정 | 이유 |
| --- | --- | --- |
| 2026-09-03 | 수기등록을 `9`로 옮기고 `0`을 작성완료로 쓴다 | 요청대로 `0`을 쓰되 반입 데이터와 의미를 분리 |
| 2026-09-03 | 임시저장·저장은 세 작성 화면 모두 적용 | 상신 대상 판정을 한 규칙으로 유지 |
| 2026-09-03 | 결재자 판정은 직위코드 `PT_C` 값 기준, 공통코드로 관리 | 직책 컬럼이 없고 운영에서 조정 가능해야 함 |
| 2026-09-03 | 산정근거는 스키마 변경 없이 라벨 문자열 저장 | 최소 변경 |
| 2026-09-03 | 상신 대상은 작성완료(`0`) 건만 | 작성완료를 상신 관문으로 사용 |
| 2026-09-03 | 상신 시 `0` 행을 갱신하지 않고 새 묶음 신청서로 덮는다 | 상신이 묶음 단위라 단건 갱신이 맞지 않음 |
| 2026-09-03 | 작성완료 뒤에는 [저장]만 노출 | 상태 되돌림 삭제 로직 회피 |
| 2026-09-03 | 회계연도 기본값 전환 시점을 9월로 통일 | 작성·목록 화면이 같은 함수를 공유 |
| 2026-09-03 | 결재자 직위코드 8건 확정(B1EX·I3EX / B1AX·B1CX·B1BX·B1AY·B1GX·Z2C) | 사용자 제공. 사장은 3자리 코드 `Z2C` |
