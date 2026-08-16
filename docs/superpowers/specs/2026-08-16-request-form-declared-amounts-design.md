# 편성요청서 반입 — 정보화사업 금액 3종을 1-1 요약표 기재값에서 산출 설계

- 작성일: 2026-08-16
- 대상: `it_backend` 편성요청서 반입 경로(`domain/migration/request`), `ProjectService` 금액 스냅샷
- 화면: `http://localhost:3000/admin/migration/requests` (부점 편성요청서 반입)

## 1. 배경과 요구

편성요청서 일괄 반입에서 **정보화사업**의 사업 단위 금액 3종을 1-1 시트 기재값에서 산출한다.

| 컬럼 | 한글명 | 산식 |
| --- | --- | --- |
| `TOT_RQM_AMT` | 총소요금액 | 엑셀 `총 사업금액(전체기간)` |
| `MPL_AMT` | 예정금액 | 엑셀 `sum('26년도 이후)` |
| `DFR_AMT` | 지급금액 | `총 사업금액(전체기간) − sum('26년도 이후) − '26년도 합계` |

`DFR_AMT`는 "전체기간 총액에서 예산연도 이후 계획분을 뺀 값" = **이미 지급한 예산**이다.

### 1.1 현행과의 충돌

세 컬럼은 [2026-08-15 금액 컬럼 설계](2026-08-15-project-amount-columns-design.md)로 이미 존재하지만, 값의 출처가 다르다.

[`ProjectService.applyAmountSnapshot`](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java)이 `createProject`·`updateProject` 끝에서 실행된다.

```
TOT_RQM_AMT = ∑ 활성품목 AMT
MPL_AMT     = ∑ 활성품목 MPL_AMT
DFR_AMT     = 요청값, 단 dfrAmt ≤ ∑품목 AMT 아니면 IllegalArgumentException
```

반입은 `RequestFormFileImporter`가 `projectService.createProject(request, true)`를 호출하므로 이 경로를 그대로 탄다. 세 값 모두 덮어쓰이고, 특히 `DFR_AMT`는 **전체기간 기준이라 2026년분만 담은 품목 합계보다 큰 것이 정상**이어서 현행 상한 검증에 걸려 예외가 나고 그 파일 트랜잭션이 롤백된다.

### 1.2 단위 문제

1-1 요약표(`예산 소요(상세)`)는 **적재하지 않는 것이 현행 설계**다. 헤더에 `백만원`이라 적혀 있어도 실제 기재 단위가 부점마다 다르기 때문이다(실측: 한 파일 `2637`, 다른 파일 `1014981660`). 그래서 지금은 `'26년도 합계`만 읽어 1-2 품목 합계와 대사하는 데만 쓴다([`AmountUnitResolver`](../../../it_backend/src/main/java/com/kdb/it/domain/migration/request/service/AmountUnitResolver.java)).

이번 요구는 그 요약표에서 값을 **적재**하겠다는 것이므로, 단위 확정 규칙이 설계의 핵심이 된다.

## 2. 1-1 시트 레이아웃

실측 픽스처([`RequestFormFixtures`](../../../it_backend/src/test/java/com/kdb/it/domain/migration/request/support/RequestFormFixtures.java)) 기준.

```
시작일자 (YY/MM) | 25/06 | 종료일자 (YY/MM) | 26/02 |  | 총 사업금액(전체기간) |  | 2,000백만원
──────────────────────────────────────────────────────────────────────────────────────
예산 소요(상세) (백만원, 부가세포함) | 1분기 | 2분기 | 3분기 | 4분기 | '26년도 합계 | '26년도 이후 | 전체 합계
자본예산   | 기타무형자산(SW) | ...
일반관리비 | 전산제비         | ...
총 계      |                  | ...      1,265,624,700      (빈칸)      1,265,624,700
```

- `총 사업금액(전체기간)`은 **요약표 밖의 라벨-값 칸**이고 값이 **단위 접미사를 포함한 자유 텍스트**다.
- 요약표의 `전체 합계`는 `'26년도 합계 + '26년도 이후`이므로 총액 원천으로 쓸 수 없다 — 그 값을 쓰면 `DFR_AMT`가 항상 0이 된다.
- 픽스처의 `총 계` 행은 `'26년도 이후` 칸이 비어 있다. 총계 행만 읽는 현행 방식으로는 이 값을 얻지 못한다.

## 3. 읽기 — `CapitalOverviewReader`

요약표 두 값은 **단위 미확정 raw**로 돌려주고, 환산은 품목 합계를 아는 어댑터가 한다.

| 값 | 출처 | 읽는 법 |
| --- | --- | --- |
| `W` 총 사업금액(전체기간) | 라벨-값 칸 | 숫자 + 접미사 파싱 (§3.2) |
| `Y` '26년도 합계 | 요약표 컬럼 | 총계 행 → 비면 데이터 행 합산 (§3.1) |
| `L` '26년도 이후 | 요약표 컬럼 | 〃 |

### 3.1 요약표 컬럼 탐색

현행 `declaredYearTotal`의 방식을 일반화한다.

1. `총 계` / `총계` 라벨 행을 찾는다.
2. 그 위쪽에서 정규화 문자열이 `년도합계`(또는 `년도이후`)로 끝나는 헤더 열을 찾는다.
3. `총 계` 행의 그 열 값을 읽는다.
4. **비어 있으면 `헤더행+1 ~ 총계행-1` 구간의 같은 열 숫자를 합산한다.**

**두 컬럼에 같은 규칙을 적용한다.** 산식이 세 값을 빼고 더하므로 읽기 규칙이 갈리면 결과가 어긋난다.

> **부수효과(의도됨):** 현행 `declaredYearTotal`은 총계 행만 읽고 비면 `null`을 돌려주며, 그 값은 단위 역추정과 기존 `AMOUNT_MISMATCH` 대사에도 쓰인다. 폴백이 붙으면 지금 대사를 건너뛰던 파일이 새로 대사 대상이 되어 `AMOUNT_MISMATCH` 경고가 새로 뜰 수 있다. 차단이 아니라 경고이며, 대사 자체가 원래 의도된 동작이므로 감수한다.

### 3.2 접미사 파싱

`원`·`천원`·`백만원`만 인식한다(`AmountUnit`의 값 집합).

- 접미사가 있으면 **그 단위가 이 칸의 유일한 근거**다. 요약표 배수를 적용하지 않는다.
- 접미사가 없으면 "미확정"으로 두고 어댑터가 요약표 배수를 적용한다.
- **인식하지 못하는 접미사(`억원` 등)는 배수 폴백을 쓰지 않고 미적재+경고로 보낸다.** 폴백하면 100배 틀린 값이 조용히 들어간다. 실제로 `억원` 파일이 나타나면 이 경고가 드러내 준다.

### 3.3 반환 타입

`Result`의 `declaredYearTotal` 단일 필드를 아래 record로 교체한다.

```java
public record DeclaredAmounts(
        BigDecimal wholePeriodWon,   // 접미사로 원 단위 확정된 총액. 접미사 없으면 null
        BigDecimal wholePeriodRaw,   // 접미사 없는 경우의 기재 숫자
        boolean wholePeriodUnknownUnit, // 인식 못 한 접미사가 붙어 있었으면 true
        BigDecimal yearTotalRaw,
        BigDecimal laterTotalRaw) {}
```

기존 `declaredYearTotal()` 소비처(`reconcileTotals`)는 `yearTotalRaw()`로 잇는다.

## 4. 환산과 산출 — `CapitalProjectFormAdapter`

품목을 읽은 뒤, 이미 `reconcileTotals`가 쓰는 대사 결과를 재사용한다.

```
u = AmountUnitResolver.inferUnit(Y_raw, ∑품목 AMT)      // 요약표 배수
Y = u.toWon(Y_raw)
L = u.toWon(L_raw ?? 0)
W = wholePeriodWon != null ? wholePeriodWon : u.toWon(wholePeriodRaw)

TOT_RQM_AMT = W
MPL_AMT     = L
DFR_AMT     = W − L − Y
```

### 4.1 미적재 조건

아래 중 하나라도 해당하면 **금액을 적재하지 않고 경고만 남긴다.** 파일 자체는 그대로 반영되며, 세 컬럼은 현행 동작(품목 합계 스냅샷, `DFR_AMT=0`)으로 남는다.

1. 요약표를 못 찾음 (`Y_raw` 없음)
2. 배수 판정 실패 (품목 없음 / 품목 합계 0 / 어느 배수로도 오차 0.5% 초과)
3. `W`를 못 읽음 (라벨 없음, 숫자 아님, 미인식 접미사)
4. **`W − L − Y < 0`**

조건 4가 사실상 단위 오판 탐지기 역할을 한다. 전체기간 총액이 예산연도 이후 계획분보다 작을 수 없으므로, 음수는 단위가 어긋났거나 기재가 잘못됐다는 신호다.

### 4.2 진단 코드

기존 `AMOUNT_MISMATCH`(WARNING)를 재사용하고 메시지로 구분한다. 새 enum 값을 넣으면 OpenAPI enum이 바뀌어 프론트 `codegen`까지 파급되는데, 이 경고의 실질 내용이 "1-1과 1-2가 맞지 않아 금액을 확정하지 못함"이라 기존 코드의 의미 범위 안이다.

메시지에 **"기 지급예산을 산출하지 못했습니다"**를 명시한다. 그렇지 않으면 `DFR_AMT=0`이 "기 지급예산 없음"과 구분되지 않는다.

### 4.3 적용 범위

**정보화사업(`CapitalProjectFormAdapter`)만 대상이다.** 경상사업(`RecurringProjectFormAdapter`)과 전산업무비는 변경하지 않는다.

## 5. 전달 — `FormAdapterOutput`

`projects`와 **길이가 같은 병렬 리스트** `List<ProjectAmounts> projectAmounts`를 추가한다.

- `ProjectAmounts(BigDecimal totRqmAmt, BigDecimal mplAmt, BigDecimal dfrAmt)`
- `ProjectAmounts.none()` — 3필드 모두 null. 선언값이 없는 어댑터와 미적재 파일이 쓴다.
- 컴팩트 생성자에서 `projectAmounts.size() == projects.size()`를 강제한다.
- `merge()`는 두 리스트를 같은 순서로 이어 붙인다.
- **기존 4-인자 생성자를 편의 생성자로 남긴다.** `projectAmounts`를 `none()`으로 채워 위임하므로, 선언값을 내지 않는 나머지 어댑터와 기존 테스트 19곳의 호출부가 그대로 컴파일된다. 5-인자 정규 생성자는 `CapitalProjectFormAdapter`만 쓴다.

> **대안과 선택 이유:** `projects()`의 원소를 `record PreparedProject(CreateRequest, ProjectAmounts)`로 감싸는 방법이 타입 안전하지만, `RequestFormFileImporter`·`RequestFormValidator`와 어댑터 테스트 전반이 함께 바뀐다. 인덱스 대응은 footgun이나 생성자 불변식으로 고정되고 변경 범위가 훨씬 작아 병렬 리스트를 택한다.

## 6. 저장 — `ProjectService` 이관 전용 메서드

공개 API(`CreateRequest`/`Response`)는 건드리지 않는다. 스냅샷을 요청 DTO로 받게 하면 아무 클라이언트나 주입할 수 있게 되어 2026-08-15 설계의 "서버가 계산한다"는 전제가 깨진다.

```java
/**
 * 이관 전용 — 편성요청서가 선언한 사업 단위 금액을 그대로 기록합니다.
 *
 * <p>검증하지 않습니다. 선언값이 원본이고, applyAmountSnapshot의 "기 지급예산 ≤ 총 예산" 상한은
 * 품목 합계 기준이라 전체기간 총액에서 산출한 기 지급예산이 정상적으로 그 상한을 넘습니다.
 */
@Transactional
public void assignDeclaredAmounts(
        String abusMngNo, BigDecimal totRqmAmt, BigDecimal mplAmt, BigDecimal dfrAmt)
```

`RequestFormFileImporter.apply`가 `createProject(project, true)` **직후** 호출해 `applyAmountSnapshot`이 써 놓은 품목 합계를 선언값으로 덮어쓴다. `ProjectAmounts.none()`이면 호출하지 않으므로 현행 동작이 그대로 남는다.

`ProjectService`는 [`replaceItemsForMigration`](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java)이라는 같은 성격의 이관 전용 메서드를 이미 갖고 있어 패턴이 일관된다.

## 7. 수정 시 저장 실패 완화

반입된 사업을 사용자가 수정 화면에서 저장하면 `updateProject` → `applyAmountSnapshot`이 `DFR_AMT ≤ ∑품목 AMT`를 검증해 **400으로 실패**한다. 반입값이 정상적으로 품목 합계보다 크기 때문이다.

상한을 기존 저장값까지 허용하도록 완화한다.

```java
BigDecimal ceiling = snapshot.totRqmAmt().max(nvl(project.getDfrAmt()));
if (dfrAmt.compareTo(ceiling) > 0) throw new IllegalArgumentException("기 지급예산은 총 예산을 초과할 수 없습니다.");
```

- 반입된 사업을 그대로 저장하면 통과한다.
- 기존값보다 **늘리는** 수정만 품목 합계로 제한된다.
- 2026-08-15 설계의 의도(오타로 큰 금액을 넣는 것을 막는다)는 유지된다.
- 신규 등록은 `DFR_AMT`가 null이므로 상한이 `∑품목 AMT` 그대로다.

## 8. 알려진 한계 (감수)

`TOT_RQM_AMT`·`MPL_AMT`는 2026-08-15 설계대로 **조회에 쓰이지 않는 컬럼**이다. 응답의 `prjBgAmt`·`mplAmt`는 품목 합계 파생값이다. 따라서:

- 반입한 선언 금액은 사업 상세·수정 화면의 [총 예산]/[2027년 이후 예산]에 **보이지 않는다.** 컬럼과 변경이력에만 남는다.
- 화면에 보이는 것은 `DFR_AMT`(기 지급예산)뿐이다.
- 사용자가 수정 화면에서 저장하면 앞의 두 컬럼은 품목 합계로 되돌아간다.

이를 바꾸려면 응답 `prjBgAmt`/`mplAmt`의 출처를 컬럼으로 옮겨야 하는데 예산 목록·상세·PDF 전 소비처에 파급되므로 이번 범위 밖이다.

## 9. 사용자 동선

배수 판정에 실패한 파일(§4.1)의 보정은 **반입 화면이 아니라 사업 수정 화면**에서 한다.

반입 화면(`/admin/migration/requests`)의 [결정] 열은 어댑터가 `context.override(시트, 행, 필드)`로 다시 읽는 항목만 고칠 수 있고(비목·전결권자·선택 항목·담당자), 금액은 override 대상이 아니다. 반입 화면에는 경고 문구만 뜬다.

보정은 반입 후 `/info/projects/form?id={사업관리번호}`의 [기 지급예산] 입력칸에서 한다. `TOT_RQM_AMT`·`MPL_AMT`는 사용자 입력칸이 없다(§8).

> 반입 화면에서 금액을 직접 입력하게 하려면 `RequestFormDecisionKind`에 숫자 입력 종류를 신설하고 프론트 결정 UI를 확장해야 한다. 배수 판정 실패가 소수 파일일 것으로 보아 이번 범위에서 제외한다. 실패 파일이 많다고 드러나면 별도 과제로 올린다.

## 10. 테스트

**`CapitalOverviewReaderTest`**
- 총계 행에 값이 있는 정상 케이스
- 총계 행의 해당 칸이 비면 데이터 행을 합산
- 요약표가 없으면 세 값 모두 null
- 접미사 3종(`원`·`천원`·`백만원`) 파싱
- 미인식 접미사(`억원`) → `wholePeriodUnknownUnit=true`
- 접미사 없음 → `wholePeriodRaw`만 채움

**`CapitalProjectFormAdapterTest`**
- 산식 정확성: 요약표 원 단위 + 총액 백만원 접미사 혼합
- 배수 판정 실패 → 금액 미적재 + `AMOUNT_MISMATCH` 경고
- `W − L − Y < 0` → 금액 미적재 + 경고
- 정상 산출 시 `ProjectAmounts`가 세 값을 담음

**`RecurringProjectFormAdapterTest`**
- 경상사업은 `ProjectAmounts.none()`

**`RequestFormFileImporterTest`**
- `ProjectAmounts`가 있으면 `assignDeclaredAmounts` 호출
- `none()`이면 미호출

**`ProjectServiceTest` (회귀)**
- 기존 `DFR_AMT`가 품목 합계보다 커도 같은 값으로 저장하면 통과(§7)
- 기존값보다 큰 값으로 늘리면 여전히 거부
- 신규 등록의 상한은 `∑품목 AMT` 그대로

**`RequestFormImportIt`**
- 반입 후 `TPRMPP_BPROJM`의 세 컬럼이 선언값과 일치

## 11. 범위 밖

- 경상사업·전산업무비의 금액 산출
- 응답 `prjBgAmt`/`mplAmt`의 출처를 컬럼으로 옮기는 작업
- 반입 화면에서의 금액 직접 입력(`RequestFormDecisionKind` 확장)
- 기존 반입 데이터의 소급 재계산
