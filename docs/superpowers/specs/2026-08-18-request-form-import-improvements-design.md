# 편성요청서 반입 기능 개선 설계 (진단 추적성·통화·전결권자)

작성일: 2026-08-18

## 1. 배경

`/admin/migration/requests`(편성요청서 반입)를 실제 부점 제출본으로 돌려 보면서 네 가지
문제가 드러났다. 네 건 모두 **관리자가 진단을 보고 그 자리에서 고칠 수 있는가**라는
한 가지 축에 걸려 있다.

1. 부점 폴더 아래에 팀·사업 폴더가 더 들어가면(`[연도]/[부서명(코드)]/[팀]/[사업]/…`)
   한 부서 그룹에 파일이 여러 개 쌓인다. 결과 표는 진단 줄에 파일을 적지 않으므로
   어느 파일의 진단인지 알 수 없다.
2. 그 깊은 구조에서는 편성요청서가 아닌 엑셀이 함께 딸려 온다. 지금은 그런 파일이
   `BLOCKER` + 상태 `실패`로 붉게 뜨는데, 반입 대상이 아닌 것을 실패로 부르는 것은
   사실과 다르고 관리자가 고칠 방법도 없다.
3. 시트 ③(전산 일반관리비)의 통화 인식이 `KRW` 정확 일치뿐이라, 빈칸이나 다른 표기는
   전부 외화로 흘러 `FC_AMT`에 들어가고 환율이 곱해진다. 또 원화 행이 하나도 없는
   시트(국외 점포)에서도 원화 금액 단위 경고가 떠서 의미 없는 확인을 요구한다.
4. 전결권자 이름이 공통코드에 없으면 후보 없이 `BLOCKER`만 남는다. 화면에 고를 상자가
   생기지 않아 그 파일은 원본 엑셀을 고치기 전까지 영구히 차단된다.

## 2. 목표

1. 모든 진단이 **어느 파일의 어느 행**에 대한 것인지 화면에서 바로 읽히게 한다.
2. 반입 대상이 아닌 파일을 실패가 아닌 별도 상태로 구분한다.
3. 시트 ③의 통화를 공통코드 기준으로 확정하고, 확정하지 못하면 사람이 고르게 한다.
   원화 행이 없는 시트에는 원화 단위 경고를 내지 않는다.
4. 전결권자 미매칭도 화면에서 골라 풀 수 있게 한다.

## 3. 범위 밖

- 폴더 구조 자체의 해석 변경. `deptFolderOf`가 이미 `부서명(코드)` 표기를 만족하는
  가장 안쪽 폴더를 부서로 삼으므로 깊은 구조에서도 부서·연도 판정은 지금 그대로 맞다.
- 반입 대상 파일의 사전 필터링(파일명 규칙 등). 시트 인식 결과로만 가른다.
- 진단 이외의 화면 개편(요약 카드, 배치 크기, 진행률 등).
- 이미 반입된 원장의 소급 보정.

## 4. 확정한 결정

| 항목 | 결정 |
| --- | --- |
| 진단 줄의 파일 표기 | 부서 폴더 **이후** 상대경로를 작은 글씨로. 전체 경로는 툴팁 |
| 경로 클릭 동작 | 메모리의 `File`로 blob URL을 만들어 **사본을 연다** |
| 시트 미인식 파일 | `SKIPPED` 상태 신설 + 심각도 `WARNING` |
| 통화 미해석 행 | **빈칸 포함** 모두 `BLOCKER`. 공통코드 `CUR_C`에서 고른다 |
| 통화 진단 단위 | **행 단위**. `excelRow`와 계약명을 함께 담는다 |
| 단위 추정 경고 | 원화로 확정된 행이 하나도 없으면 내지 않는다 |
| 전결권자 미매칭 | `BLOCKER` 유지 + `EDRT_CPIT` 계열 후보 제시 |

### 4.1 경로 클릭이 "사본 열기"인 이유

브라우저는 `http(s)` 문서에서 `file:///C:/…` 링크를 따라가지 않는다. 사용자가 방금 고른
폴더의 실제 경로도 페이지에 노출되지 않는다(`webkitRelativePath`는 고른 폴더 기준의
상대경로뿐이다). 반면 반입 화면은 업로드 대상 `File` 객체를 `useRequestFormUpload.files`에
그대로 들고 있으므로, 그 객체로 blob URL을 만들어 여는 것은 확실히 동작한다.

따라서 "원본 파일을 연다"가 아니라 "사본을 연다"로 정의하고, 툴팁에 그 사실을 적는다.
동작하지 않는 링크를 두는 것보다 낫고, 관리자가 확인하려는 것(그 파일의 내용)은 사본으로
충분하다.

### 4.2 빈 통화 칸도 차단하는 이유

빈칸을 원화로 간주하면 판정이 두 곳에서 어긋난다. 하나는 금액 반영이고(원화로 보면
`COST_TOT_XP_AMT`, 외화로 보면 `FC_AMT`), 다른 하나는 이번에 새로 넣는 "원화 행이 없으면
단위 경고를 내지 않는다"는 규칙이다. 추정이 틀리면 두 결과가 함께 틀린다.

시트 ③에는 `통화 구분` 칸이 양식에 명시되어 있으므로, 비어 있는 것은 정상 기재가 아니라
누락이다. 누락은 사람이 확정해야 한다.

### 4.3 전결권자를 `WARNING`으로 낮추지 않는 이유

전결권자를 아예 적지 않은 파일은 지금도 진단 없이 통과한다(`hasText` 검사). 이름을
**적어 냈는데** 코드표에 없는 경우는 다르다 — 제출자가 특정 전결권자를 지정했다는 뜻이므로
빈 값으로 넘기면 원장에 제출 의사와 다른 값이 남는다. 그래서 차단은 유지하고, 대신 고를
수단을 준다.

## 5. 변경 설계

### 5.1 ① 진단 줄 파일 경로 (프론트 전용)

백엔드 계약은 바뀌지 않는다. `RequestFormFileResult.fileKey`가 이미 상대경로 전문이다.

**`useRequestFormUpload`**
- `openSourceFile(fileKey: string): boolean` 추가. `files`에서 `fileKey`가 같은
  `SelectedFile`을 찾아 `URL.createObjectURL(file)`로 앵커를 만들고 `download` 속성에
  원본 파일명을 넣어 클릭한다. URL은 다음 태스크에서 `revokeObjectURL`로 해제한다.
  찾지 못하면 `false`(결과만 남고 선택이 초기화된 상태).
- 반환 객체에 `openSourceFile`을 노출한다.

**`useRequestFormPage`**
- `upload.openSourceFile`을 그대로 통과시킨다(파사드 일관성).

**`RequestFormResultTable.vue`**
- `props`에 `openSourceFile?: (fileKey: string) => boolean` 추가. 없으면 경로를 표기만
  하고 클릭 대상으로 만들지 않는다(테스트·읽기 전용 사용을 위한 기본값).
- `subPathOf(fileKey)` — 부서 폴더명이 경로에 나타나는 위치를 찾아 그 **다음** 조각부터
  잇는다. 부서 폴더를 찾지 못하면 전체 경로를 쓴다.
- 표 위 파일 목록의 `fileNameOf` → `subPathOf`로 교체.
- 진단 줄: 기존 `locatorParts` 뒤에 경로 조각을 하나 더 붙인다. 표기 순서는
  `시트 · N행 · 대상 · 경로`가 아니라 **경로를 별도 요소**로 두어 스타일을 다르게 준다
  (`result-table__path`, 작은 글씨·밑줄). `openSourceFile`이 있으면 `<button type="button">`,
  없으면 `<span>`.
- `fieldLabel`에 `curC: '통화'` 추가(③에서 쓴다).
- `statusLabel`에 `SKIPPED: '대상 아님'` 추가(②에서 쓴다).

**i18n** (`i18n/messages/migration.ts`, 한국어·영어 블록 **양쪽**)
- `migration.bulkImport.result.openSourceFile` — 버튼 `title`/`aria-label`.
  한국어: `원본 파일 사본 열기`, 영어: `Open a copy of the source file`.

### 5.2 ② 시트 미인식 → `SKIPPED`

**`RequestFormDto.FileStatus`**
- `SKIPPED` 추가. JavaDoc: "반입 대상 시트가 없어 건너뜀 — 실패가 아님".

**`RequestFormDiagnosticCode`**
- `SHEET_NOT_FOUND`의 심각도를 `BLOCKER` → `WARNING`으로 바꾸고, 그 이유를 주석에 남긴다
  (깊은 폴더 구조에서 대상 아닌 엑셀이 함께 올라오는 것이 정상 케이스다).

**`RequestFormImportService`**
- `sheets.isEmpty()` 분기가 `failed(...)` 대신 새 `skipped(entry)`를 부른다.
- `skipped`는 상태 `SKIPPED`, 진단 1건(`SHEET_NOT_FOUND`, 문구 유지), 생성 목록 빈 값,
  건수 0, 단위 제안 null로 만든다.
- `summarize()`는 손대지 않는다. `SKIPPED`는 `appliedFiles`에도 `blockedFiles`에도
  들어가지 않으므로 요약에 새 필드가 필요 없다. (`FAILED`도 이미 같은 취급이다.)
- 보관(`RequestFormSourceFileArchiver`)은 `APPLIED`만 대상이므로 변경 불필요.

**프론트**
- `statusLabel.SKIPPED`, `result-table__status--skipped`(중립 회색) 추가.
- `isResolvedByDecisions`는 `BLOCKED`만 보므로 `SKIPPED` 파일은 자동으로 반영 대상에서
  빠진다. 변경 없음.

**계약 테스트**
- `RequestFormOpenApiContractTest`의 `RequestFormFileStatus` 값 집합에 `SKIPPED` 추가.

### 5.3 ③ 일반관리비 통화·단위

`GeneralExpenseFormAdapter.adapt()`의 처리 순서를 세 단계로 분리한다. 지금은 단위 판정이
행 처리보다 앞서 있어 통화 확정 결과를 쓸 수 없다.

```
1) 통화 해석   readAll() → Map<excelRow, String> resolvedCurrency (+ 진단)
2) 단위 판정   1)에서 KRW로 확정된 행의 연간 금액만으로 판단 (+ 진단)
3) 금액 반영   확정 통화로 CreateRequest 생성
```

**통화 해석 규칙** (행마다, 순서대로)
1. 보정값 `override(GENERAL_EXPENSE, row.excelRow(), "curC")`가 있으면 그 값.
2. 시트값을 `trim().toUpperCase()`한 결과가 공통코드 `CUR_C`의 코드값 집합에 있으면 그 값.
3. 그 밖(빈칸 포함)은 미해석. `CODE_UNRESOLVED`(BLOCKER) 진단을 낸다.
   - `sheet=GENERAL_EXPENSE`, `excelRow=row.excelRow()`, `field="curC"`,
     `subject=row.contractName()`
   - `candidates` = `CUR_C` 전체 → `decision`이 자동으로 `SELECT`
   - 문구: 빈칸이면 `통화 구분이 비어 있습니다. 통화를 골라 주세요.`,
     값이 있으면 ``통화 구분 `%s`를 통화코드로 해석하지 못했습니다. 골라 주세요.``
   - 그 행은 통화·금액을 채우지 않는다(`CUR_C`가 null이면 어차피 반영되지 않고, 파일이
     차단되므로 원장에 가지 않는다).

**단위 판정**
- `krwAnnualAmounts`를 1)의 확정 통화 기준으로 모은다.
- **목록이 비면 `UNIT_UNCERTAIN`을 내지 않고** `AmountUnit.WON`을 쓴다. 배수가 걸릴
  원화 행이 없으므로 어느 값이든 결과가 같다.
- 목록이 있고 사용자가 단위를 지정하지 않았으면 지금처럼 제안값 + `UNIT_UNCERTAIN`.
- 사용자가 지정했으면 그 값(진단 없음). 현재 동작 유지.

**금액 반영**
- `applyCurrencyAndAmount`가 `row.currency()` 대신 확정 통화를 받는다.
- JPY ×1,000 규칙, 외화 행이 `FC_AMT`만 채우고 환율을 비우는 규칙은 그대로.

**공통코드 조회**
- `GeneralExpenseFormAdapter`에 `MigrationIoeCatalogReader`를 주입하고
  `candidates(CommonCodeGroups.CURRENCY, false)`를 `adapt()` 1회당 한 번 부른다
  (`storeName=false` → 저장값이 코드값 `KRW`/`USD`). `CapitalProjectFormAdapter.catalogs()`가
  이미 같은 방식으로 파일당 한 번 조회한다.

### 5.4 ④ 전결권자 후보

**`MigrationIoeCatalogReader`**
- 기존 `candidates(String cId, boolean storeName)`를 `candidates(String cId, String cTp,
  boolean storeName)`에 위임하도록 바꾸고(`cTp == null`이면 필터 없음), 공개
  메서드 `edrtCapitalCandidates()`를 더한다.
  `candidates(CommonCodeGroups.EDRT, "EDRT_CPIT", false)` — `IT_PTL_EDRT_TC`는 2자리
  코드 컬럼이므로 저장값은 코드값이다.
- `EDRT_CAPITAL_CTP` 상수를 그대로 재사용한다(`edrtCapitalCodeByName`과 같은 출처).

**`CapitalProjectFormAdapter.catalogs()`**
- `options.put("edrtTc", catalogReader.edrtCapitalCandidates())`.

**`CapitalOverviewReader.applyDelegation`**
- 넷째 인자를 `Map<String,String> edrtCodes` → `FormCatalogs catalogs`로 바꾼다
  (코드 맵과 후보 목록을 둘 다 써야 하고, 같은 묶음에서 나온 값이므로 하나로 받는 편이
  인자 순서 사고를 막는다). 호출부 `read(...)`는 이미 `catalogs`를 들고 있다.
- 미매칭 진단의 `candidates`에 `catalogs.optionCandidates("edrtTc")`를 넘긴다.
  `FormDiagnostic.of`가 후보가 있으면 `decision`을 `SELECT`로 정하므로 별도 지정 불필요.
- 심각도는 `CODE_UNRESOLVED`(BLOCKER) 그대로.

**프론트**
- `fieldLabel.edrtTc`는 이미 `'전결권자'`로 있다. 변경 없음.

### 5.5 공통 — 행 번호 표기

행에 매인 진단은 반드시 `excelRow`를 담는다. 신규 통화 진단이 여기 해당한다. 기존
시트 ③·1-2 진단은 이미 `row.excelRow()`를 담고 있다.

가리킬 행이 없는 진단은 그대로 둔다 — `ANCHOR_NOT_FOUND`(표 헤더를 못 찾음),
`generalExpenseUnit`(파일 단위), 작성자 이름 길이 초과(시트 머리말), 부서 미해석(파일
단위), 1-1의 사업 단위 진단(요약표에는 사용자 관점 행이 없다).

결과 표는 이미 `excelRow`가 있으면 `N행`을 찍으므로 화면 쪽 변경은 없다.

## 6. 영향 범위

| 저장소 | 파일 |
| --- | --- |
| `it_backend` | `RequestFormDto`, `RequestFormDiagnosticCode`, `RequestFormImportService`, `GeneralExpenseFormAdapter`, `CapitalOverviewReader`, `CapitalProjectFormAdapter`, `MigrationIoeCatalogReader` |
| `it_frontend` | `useRequestFormUpload.ts`, `useRequestFormPage.ts`, `RequestFormResultTable.vue`, `requests.vue`, `i18n/messages/migration.ts` |
| `it_database` | 없음 (Flyway 스크립트 불필요) |

DB 스키마 변경 없음. 신규 테이블·컬럼 없음. `meta/table.txt` 변경 없음.

## 7. 검증

**백엔드**
- `GeneralExpenseFormAdapterTest`
  - 통화 칸이 빈 행 → `CODE_UNRESOLVED` BLOCKER, `excelRow`·계약명·`CUR_C` 후보 포함
  - 통화 칸이 통화코드가 아닌 값 → 같은 진단, 문구만 다름
  - 전 행이 외화(KRW 행 0건) → `UNIT_UNCERTAIN` **없음**
  - KRW 행이 있고 단위 미지정 → 기존대로 `UNIT_UNCERTAIN` 있음
  - 보정값으로 통화를 지정 → 진단 없이 그 통화로 반영
- `CapitalOverviewReaderTest` — 전결권자 미매칭 진단에 후보가 붙고 `decision=SELECT`
- `RequestFormImportServiceTest` — 인식 시트 0건 파일이 `SKIPPED` + `WARNING`
- `RequestFormOpenApiContractTest` — `FileStatus`에 `SKIPPED`

**프론트**
- `RequestFormResultTable.test.ts` — 진단 줄에 하위 경로가 뜨고, 클릭하면
  `openSourceFile`이 그 `fileKey`로 불린다. `openSourceFile` 미주입 시 버튼이 없다.
- `useRequestFormUpload.test.ts` — `openSourceFile`이 선택 목록에서 파일을 찾고,
  없으면 `false`

**게이트**
- `it_backend`: `./gradlew check`
- `it_frontend`: `npm run check`, `npm test`, `npm run codegen:check`

## 8. 확인한 근거

- `RequestFormImportService.processFile` — 시트 0건이 `failed(...)`로 `FAILED` + BLOCKER
- `GeneralExpenseFormAdapter.resolveUnit` — 단위 미지정이면 조건 없이 `UNIT_UNCERTAIN`
- `GeneralExpenseFormAdapter.applyCurrencyAndAmount` / `krwAnnualAmounts` —
  `"KRW".equalsIgnoreCase` 정확 일치만 원화
- `CapitalOverviewReader.applyDelegation` — 후보 `List.of()`로 `decision=NONE`
- `CommonCodeGroups.CURRENCY = "CUR_C"`, `MigrationIoeCatalogReader.EDRT_CAPITAL_CTP = "EDRT_CPIT"`
- `useRequestFormUpload.deptFolderOf` — 깊은 구조에서도 `부서명(코드)` 폴더를 부서로 삼음
- `RequestFormResultTable.locatorParts` — `excelRow`가 있으면 `N행`을 이미 표기
