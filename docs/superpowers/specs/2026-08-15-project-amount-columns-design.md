# 정보화사업 금액 컬럼 3종 추가 및 '기 지급예산' 입력 설계

- 작성일: 2026-08-15
- 대상: `TPRMPP_BPROJM`, `TPRMPP_BPROJL`, 정보화사업 등록·수정 폼, 정보화사업 상세

## 1. 배경

`TPRMPP_BPROJM`에는 현재 금액 컬럼이 하나도 없다. 총예산·예정금액은 모두 품목(`TPRMPP_BITEMM`) 합산 파생값으로 응답에 실어 내린다.

이 구조는 2026-06-22 [품목 예정금액 설계](done/2026-06-22-item-planned-amount-design.md)에서 의도적으로 만든 것이다. 같은 날 [V20260622_007__DropBprojmPlannedAmtColumns.sql](../../../it_database/migrations/V20260622_007__DropBprojmPlannedAmtColumns.sql)이 `TOT_RQM_AMT`·`MPL_CPIT_AMT`·`MPL_MNGC_AMT`를 `TPRMPP_BPROJM`과 `TPRMPP_BPROJL`에서 드롭했다.

이번 요구는 사업 단위 금액을 다시 컬럼으로 보유하되, 새로 **기 지급예산(`DFR_AMT`)** 을 사용자 입력값으로 받는 것이다. 파생 계산을 없애지 않고 **저장 시점 스냅샷**으로 공존시킨다.

### 1.1 이름 충돌 (중요)

`TOT_RQM_AMT`는 이름과 값이 원래 어긋나 있었다. 2026-06-22 설계문서가 명시한다 — "컬럼명은 '총소요금액'이나 실제 저장값은 **당해예산**".

현재 응답 `ProjectDto.Response.totRqmAmt`도 [ProjectBudgetSummaryService](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBudgetSummaryService.java)에서 `max(0, ∑AMT − ∑MPL_AMT)`, 즉 화면 **[2026년 예산]** 칸 값이다.

이번에 추가하는 `TOT_RQM_AMT` 컬럼은 화면 **[총 예산]**(`∑AMT`)을 담는다. 따라서:

- **DB 컬럼 `TOT_RQM_AMT` = 총 예산** (신규 의미)
- **응답 필드 `totRqmAmt` = 당해예산** (기존 의미 유지, 변경 없음)
- 총 예산은 응답에 **새 필드 `prjBgAmt`** 로 분리해 노출한다

기존 `totRqmAmt` 소비처(예산목록·상세·PDF)는 손대지 않는다.

## 2. 화면과 컬럼 대응

현재 폼의 4칸 계산식은 [useProjectFormPage.ts](../../../it_frontend/app/composables/useProjectFormPage.ts)에 있다.

| 화면 칸 | 프론트 계산 | 대응 컬럼 |
| --- | --- | --- |
| 총 예산 | `form.prjBg` = ∑ 품목 소계 | `TOT_RQM_AMT` |
| 2026년 예산 | `budgetYearAmount` = `prjBg − 이후예정합` | (컬럼 없음, 파생 유지) |
| 2027년 이후 예산 | `laterCapitalAmt + laterMngcAmt` = ∑ 품목 `MPL_AMT` | `MPL_AMT` |
| 기 지급예산 | 사용자 입력 | `DFR_AMT` |

## 3. 데이터 모델

새 Flyway 스크립트 `V20260815_003__AddBprojmAmountColumns.sql`.

`TPRMPP_BPROJM`과 `TPRMPP_BPROJL`에 동일하게 3개 컬럼을 추가한다.

| 컬럼 | 한글명 | 타입 | 담는 값 |
| --- | --- | --- | --- |
| `TOT_RQM_AMT` | 총소요금액 | `NUMBER(18,3)` | 총 예산 = ∑ 활성품목 `AMT` |
| `MPL_AMT` | 예정금액 | `NUMBER(18,3)` | 예산연도+1 이후 예산 = ∑ 활성품목 `MPL_AMT` |
| `DFR_AMT` | 지급금액 | `NUMBER(18,3)` | 기 지급예산 (사용자 입력) |

- 컬럼명·한글명은 `meta/meta.txt` 용어를 그대로 따른다.
- `DEFAULT 0`으로 추가해 기존 행을 백필한다. 합계성 금액이라 NULL 대신 0이 자연스럽고, 프론트 `?? 0` 분기를 늘리지 않는다.
- `V20260622_007`의 멱등 패턴(`ALL_TAB_COLS` 조회 후 존재하지 않을 때만 `ADD`)을 그대로 재사용한다.
- 스크립트 주석에 **드롭했던 컬럼을 다시 추가하는 이유**와 **품목 합산이 여전히 조회 기준이고 이 컬럼은 스냅샷**임을 남긴다.

## 4. 엔티티와 변경이력

- `Bprojm`에 `totRqmAmt`·`mplAmt`·`dfrAmt` 3개 필드를 `@Column(precision = 18, scale = 3, comment = ...)`로 추가한다.
- `BprojmL`에 같은 이름·같은 컬럼명으로 3개 필드를 추가한다.
- [AuditLogPersister](../../../it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java)가 `@Column` 필드를 수집해 이름으로 매칭 복사하므로 **변경이력 적재 코드는 수정하지 않는다**. 두 엔티티에 같은 필드명을 두는 것이 유일한 요건이다.

## 5. 저장 규칙

`ProjectService.createProject` / `updateProject`에서 **품목 저장이 끝난 뒤** 스냅샷을 기록한다. 품목 저장 단계가 환율 재계산과 `0 ≤ mplAmt ≤ amt` 클램프를 이미 수행하므로, 그 결과를 읽어야 값이 어긋나지 않는다.

```
totRqmAmt = ∑ 활성품목 AMT
mplAmt    = ∑ 활성품목 MPL_AMT
dfrAmt    = 요청값 (검증 통과분)
```

- 합산 산식을 새로 만들지 않는다. `ProjectBudgetSummaryService`의 기존 집계를 거점으로 재사용해 파생값과 스냅샷이 같은 규칙을 쓰도록 한다.
- **조회 경로는 바꾸지 않는다.** `Response`의 `totRqmAmt`·`mplCpitAmt`·`mplMngcAmt`는 지금처럼 품목 합산으로 계산한다. 기존 응답 값은 하나도 변하지 않는다.

### 5.1 `dfrAmt` 검증

서버에서 다음을 검증하고 위반 시 400을 반환한다.

- `dfrAmt >= 0`
- `dfrAmt <= totRqmAmt` (총 예산 초과 불가)

상한은 요청 품목으로 계산한 총 예산을 기준으로 한다. 미전송(`null`)은 0으로 취급한다.

## 6. API 계약

`ProjectDto.Response`에 3개 필드를 추가한다.

| 필드 | 의미 | 값의 출처 |
| --- | --- | --- |
| `prjBgAmt` | 총 예산 | 신규. **품목 합산 파생** (`∑AMT`). 프론트 `form.prjBg`와 대응 |
| `mplAmt` | 예산연도+1 이후 예산 | 신규. **품목 합산 파생** (`∑MPL_AMT`). 품목 DTO의 `mplAmt`와 레벨이 달라 충돌 없음 |
| `dfrAmt` | 기 지급예산 | 신규. **`BPROJM.DFR_AMT` 컬럼**에서 직접 읽음 |
| `totRqmAmt` | 당해예산 | 기존 파생. **변경 없음** |

스냅샷 컬럼(`TOT_RQM_AMT`·`MPL_AMT`)은 조회에 쓰지 않는다. 사용자가 입력하는 `DFR_AMT`만 컬럼이 유일한 출처다.

`CreateRequest`·`UpdateRequest`에는 `dfrAmt`만 추가한다.

- 응답 속성에 `@Schema(requiredMode = REQUIRED)`를 지정하고 null 가능 여부를 명시한다(`it_backend/CLAUDE.md` §4).
- `ProjectOpenApiContractTest`를 함께 갱신한다.
- 백엔드 기동 후 프론트에서 `npm run codegen`으로 `app/types/api.d.ts`를 재생성하고 `npm run codegen:check`를 통과시킨다.

## 7. 화면

### 7.1 등록·수정 폼 (`app/pages/info/projects/form.vue`)

예산 줄을 4칸으로 재편한다.

| | 1 | 2 | 3 | 4 |
| --- | --- | --- | --- | --- |
| 라벨 | 총 예산 (원) | `{bgYy}`년 예산 (원) | `{bgYy+1}`년 이후 예산 (원) | 기 지급예산 (원) |
| 값 | `form.prjBg` | `budgetYearAmount` | `laterCapitalAmt + laterMngcAmt` | `form.dfrAmt` |
| 입력 | 읽기전용 | 읽기전용 | 읽기전용 | **입력 가능** |

- 기존 3·4번째 칸(`예정자본금액`, `예정관리비금액`)이 3번째 한 칸으로 합쳐진다.
- `laterCapitalAmt`/`laterMngcAmt` 계산 자체는 그대로 둔다. 표시만 합산한다.
- 4번째 칸은 **경상사업에서 숨긴다**(`v-if="!isOrdinary"`). 예산 줄 블록이 정보화·경상 공용이므로 칸 단위로 제어한다.
- 저장 payload(`useProjectFormSave`)에 `dfrAmt`를 싣고, 불러오기(`useProjectFormLoad`)에서 복원한다.

### 7.2 상세 (`app/pages/info/projects/[id].vue`)

'소요예산' 섹션의 총 예산 카드는 이미 `총 예산 / {bseYy}년 예산 / {bseYy+1}년 이후`를 우측 분할로 보여준다. 그 아래에 **기 지급예산** 한 줄을 같은 스타일로 추가한다. 경상사업에서는 숨긴다.

## 8. 테스트

**백엔드**

- 스냅샷 산식: 품목 저장 후 `TOT_RQM_AMT`·`MPL_AMT`가 활성품목 합계와 일치
- `dfrAmt` 경계: 음수 400, 총 예산 초과 400, 총 예산과 같은 값 통과, `null` → 0
- 변경이력: 수정 시 `TPRMPP_BPROJL`에 3개 값이 함께 적재
- 회귀: `Response.totRqmAmt`가 여전히 당해예산(`∑AMT − ∑MPL_AMT`)

**프론트**

- 저장 payload에 `dfrAmt` 포함
- 예산 줄 4칸 렌더링, 3번째 칸이 자본+관리비 합계
- 경상사업에서 기 지급예산 칸 미노출

## 9. 범위 밖

- 예산현황(`budget/status`)·사업 목록 표에는 컬럼을 추가하지 않는다.
- 기존 사업 데이터의 `DFR_AMT` 백필은 하지 않는다(모두 0에서 시작, 필요 시 사용자가 입력).
- `totRqmAmt` 응답 필드의 이름/의미는 이번 범위에서 바꾸지 않는다. 이름과 값의 불일치는 남으며, 정리하려면 소비처 전수 조사가 필요한 별도 과제다.
