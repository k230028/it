# 수기 엑셀 일괄 마이그레이션 설계

- 작성일: 2026-08-11
- 대상: IT 정보화 포탈 도입 전 수기로 관리하던 2026년 예산·사업 엑셀의 일괄 반입
- 관련 저장소: `it_backend`, `it_frontend`, `it_database`

## 1. 배경과 목표

포탈 개발 전에는 2026년 전산예산·정보화사업을 엑셀로 수기 관리했다. 세 파일에 흩어진 기존 데이터를 포탈 원장으로 옮겨야 한다.

- `2026년 전산일반관리비 편성 요구서.xlsx`
- `2026년 전산자본예산 편성 요구서.xlsx`
- `2026년 정보기술부문계획 조정.xlsx`

목표는 **상시 관리자 일괄업로드 화면**이다. 2026년 이관에 쓰고, 매년 편성 시즌마다 재사용한다. 일회성 스크립트가 아니라 화면·API·검증을 갖춘 기능으로 만든다.

기존 자산과의 관계: `it_frontend/app/composables/costList/useCostExcelTransfer.ts`에 전산업무비 엑셀 일괄업로드가 이미 있으나, *포탈이 내보낸 템플릿 형식* 전용이고 행별 `createCost` 순차 호출에 검증·미리보기·롤백이 없다. 수기 엑셀은 형식이 전혀 달라 이 경로를 확장하지 않고 별도 기능으로 만든다.

## 2. 대상 시트와 도메인 매핑

| 파일 | 시트 | 실데이터 | 대상 |
| --- | --- | --- | --- |
| 전산일반관리비 편성 요구서 | `전체취합(국내외)` | 14행 | `TPRMPP_BCOSTM` |
| 전산자본예산 편성 요구서 | `1-1. 26년정보화사업(전산예산반영)` | 2행 | `TPRMPP_BPROJM` + `BITEMM` + `BBUGTM` |
| 전산자본예산 편성 요구서 | `2. 위임예산(경상)` | 12행 → 사업 2건 | `TPRMPP_BPROJM`(경상) + `BITEMM` |
| 정보기술부문계획 조정 | `26년정보화사업(자본예산)` | 3행 | `TPRMPP_BPLANM` + `BPLANA` + 편성 조정 |
| 전산일반관리비 편성 요구서 | `(환율 기준)` | 11행 | 참조표 (`XCR`) |
| 전산자본예산 편성 요구서 | `조정구분` | 4행 | 참조표 (`ASG_RT` 기준) |

범위 제외: 일반관리비 파일의 숨김 `국내`(373행)·`국외`(106행) 시트는 2013~2017년 과거 편성내역이라 2026년 이관과 무관하다.

### 2.1 파일 간 사업 중복

자본예산 편성요구서와 정보기술부문계획 조정에 같은 사업이 다른 시점으로 등장한다.

| 사업명 | 편성요구서(편성요청) | 부문계획(26.6월 조정) |
| --- | --- | --- |
| 웹한글 기안기 도입을 위한 내규 솔루션 업그레이드 | 1,406 → 조정 984 | 416 (감액), 진행(품의) |
| 글로벌 표준 뱅킹시스템 재구축을 위한 구축사업(감리비 포함) | 24,285 | 24,285 (유지), 진행(계약) |
| 문자메시지 안심마크 도입 | 없음 | 0 (연기), 취소(연기) |

**결정**: 편성요청은 `BPROJM`(사업 마스터)을 만들고, 조정은 `BBUGTM`(편성)에 반영한다. 사업 동일성은 **정규화된 사업명**(공백 압축)으로 판정하며, 두 파일의 중복 2건은 사업명이 완전히 일치한다. 부문계획에만 있는 `문자메시지 안심마크 도입`은 부문계획 어댑터가 `BPROJM` SNO 1을 생성한다.

## 3. 실측으로 확인한 제약

설계 근거는 모두 로컬 Oracle(`ITPAPP@127.0.0.1:11521/XEPDB1`) 실측이다.

### 3.1 `IOE_C`는 3자리 자체 비목코드

엑셀 세목코드(`237-0700`)와 체계가 다르다. 세목명으로 매칭한다.

| 엑셀 세목 | `IOE_C` | 상태 |
| --- | --- | --- |
| 국내전산임차료 / 국외전산임차료 | `001` / `002` | 일치 |
| 국내출장 / 국외출장 | `003` / `004` | 일치 |
| 원고강사심사료 / 국외전산용역비 | `006` / `007` | 일치 |
| 회선사용료 / 유지보수료 / 전산소모품비 | `010` / `011` / `012` | 일치 |
| 국외회선사용료 | `013` | 일치 |
| 국외전산유지보수료 | `014` (`국외유지보수료`) | 부분 일치 |
| 외주용역비 | `008` 또는 `009` | **중의적** |
| 전산회의비 | — | **코드 없음** |
| 국외전산기타제비 | — | **코드 없음** (`015`는 `국외전산소모품비`) |

**결정**: 미해석 3건은 새 공통코드를 만들지 않고 미리보기에서 사용자가 기존 비목 중 선택한다.

### 3.2 `CUR_C` 공통코드에 GBP·AUD가 없다 — 차단 요인

DB에는 `CNY, EUR, JPY, KRW, SGD, USD` 6개뿐이다. 일반관리비 14행 중 4행과 위임예산 12행 **전부**가 GBP(런던지점·런던 PF·파생데스크)이므로, 통화 코드 시드 없이는 데이터 대부분이 적재되지 않는다. `AUD`(시드니사무소)도 없다.

**결정**: 마이그레이션 기능과 분리된 선행 Flyway 스크립트로 `GBP`·`AUD`를 추가한다.

### 3.3 `ABUS_TC`는 `10`/`20` 코드값

`ABUS_TC` 공통코드는 `0`(해당없음)·`10`(신규)·`20`(계속)이고, 실제 저장값도 코드다(`BCOSTM` `10`:17건 `20`:5건, `BPROJM` `10`:25건 `20`:1건). 엑셀의 `신규`/`계속` 문자열을 코드로 변환한다.

`Bprojm.java:219`의 `"사업구분 (물리컬럼 ABUS_TC=사업구분코드)"` 필드 주석에 딸린 `예: '신규', '계속'` 설명은 실제 저장값과 어긋난 낡은 서술이므로 함께 정정한다.

### 3.4 금액 단위가 파일마다 다르다

`BCOSTM.AMT`·`BITEMM.AMT`는 **원 단위**로 저장한다(`FC_AMT 90,000 USD → AMT 126,000,000`, `BITEMM.AMT 100,000,000`). 화면이 `formatBudget`으로 단위를 변환한다.

| 시트 | 엑셀 단위 | 변환 |
| --- | --- | --- |
| 전체취합(국내외) | 천원 (헤더에 `단위 : 천원, 천엔, 기타 외화 일` 명시) | ×1,000 |
| 1-1. 26년정보화사업 | 백만원 (표기 없음, 결정으로 확정) | ×1,000,000 |
| 26년정보화사업(자본예산) | 백만원 (표기 없음, 결정으로 확정) | ×1,000,000 |
| 2. 위임예산(경상) | **원** (`23,346.84 GBP × 1,924 = 44,919,320` 실측) | 변환 없음 |

자본예산·부문계획 두 시트에는 단위 표기가 전혀 없다. 글로벌 표준 뱅킹시스템 재구축 총사업금액 `68,600`이 천원이면 6,860만원으로 코어뱅킹 재구축 규모와 맞지 않아 백만원으로 확정했다.

### 3.5 `BBUGTM`의 `BG_NO`·`SNO` 의미

```
BG-2025-0430  BITEMM  SNO  1~20   DISTINCT 원천 20
BG-2025-0430  BCOSTM  SNO 21~29   DISTINCT 원천  9
BG-2026-0431  BITEMM  SNO  1~23   DISTINCT 원천 23
BG-2026-0431  BCOSTM  SNO 24~35   DISTINCT 원천 12
```

`BG_NO`는 **편성 실행(배치) 1건**, `SNO`는 **그 배치 안의 편성행 순번**이다. 연도별 `BG_NO` 1개이고 `BITEMM`·`BCOSTM`이 SNO 공간을 공유한다. `SNO`는 조정 회차가 아니다.

`FNT_TB_NM`의 실제 값은 `BITEMM`·`BCOSTM`뿐이고 `PK_COL_NM`은 `GCL_MNG_NO`(품목관리번호), `FNT_TB_CRY_SNO`는 `BITEMM.SNO`다. 즉 `BBUGTM`은 품목 단위다. `Bbugtm.java:58`의 `"BPROJM 또는 BCOSTM"` 주석은 실제와 다르므로 정정한다.

**같은 `BG_NO`에 `max(SNO)+1`로 조정 행을 덧붙이면 깨진다.** `BbugtmRepository.findByBseYyAndFntTbNmAndPkColNmAndFntTbCrySnoAndIoeCAndDelYn`이 `Optional`을 반환하므로 같은 (연도·원천·품목·비목) 조합에 2행이 생기는 순간 이후 모든 편성률 적용이 `IncorrectResultSizeDataAccessException`으로 실패한다.

**결정**: 조정은 `BudgetRateApplicationService.applyItemRates()`를 호출한다. 어댑터가 `BBUGTM`을 직접 쓰지 않는다.

단 이 메서드는 **사업별이 아니라 연도 전체를 재작성**한다.

```java
bbugtmRepository.softDeleteByBseYy(bgYy, changerUsid, LocalDateTime.now());  // 연도 전량 논리삭제
for (ItemRate item : request.items()) { ... }                                 // items에 있는 것만 재삽입
```

따라서 `items`에는 **그 연도의 모든 사업(`BPROJM`) + 모든 전산업무비(`BCOSTM`)**를 담아야 한다. 빠진 것은 되살아나지 않고 유실된다. 게다가 `softDeleteByBseYy`는 벌크 UPDATE라 `@PreUpdate`→`ChangeLogEntityListener`를 우회하므로(해당 메서드 Javadoc에 명시) **삭제된 행의 이력이 `BBUGT_L`에도 남지 않는다.** 편성행을 두 번 만들어 첫 번째를 이력으로 남기는 방식은 성립하지 않는다.

`ItemRate.orcTb`의 Javadoc은 `TPRMPP_BPROJM / TPRMPP_BCOSTM`이라고 적었으나 구현은 `"BPROJM".equals(...)`·`"BCOSTM".equals(...)`로 비교한다. 접두어 없는 이름을 쓴다.

이관 대상이 아닌 기존 편성행의 `ASG_RT`는 `applyItemRates` 호출 전에 읽어 두고 같은 값으로 `items`에 담아 유지한다.

### 3.6 결재완료 없이는 예산 화면에 집계되지 않는다

`BbugtmRepositoryImpl.sumApprovedCostAmountByIoeCValues`와 `sumApprovedItemAmountByIoeCValues`는 결재완료(`CAPPLM.IT_PTL_APF_PRG_STS_C = '2'`) 신청서가 `CAPPLA`로 연결된 `BCOSTM`/`BPROJM`만 집계한다. 원장만 적재하면 목록에는 보이지만 예산 현황·편성 화면에서 0으로 나온다.

**결정**: 이관용 결재완료 받이를 함께 생성한다. `CAPPLM`(상태 `2`, 제목에 이관 명시, 요청자=업로드 사용자) + `CAPPLA`(`FNT_TB_NM`, `PK_COL_NM`, `FNT_TB_CRY_SNO`) 연결. 상승된 결재이력은 생성하지 않아 재현된 결재선이 아님이 구분된다.

`APF_DCM_NO`에 별도 접두어를 쓰지 않는다. 형식은 기존 `APF-{YYYY}-{8자리}`를 유지한다. `ApplicationMapRepository`가 사전식 내림차순을 시간순으로 전제하므로, `MIG-` 같은 접두어는 `'A' < 'M'`이라 이관 문서가 항상 최신으로 정렬되어 그 전제를 깨뜨린다. 이관 여부는 제목과 `RGPR_DCD_REQ_CONE`으로 표시한다.

### 3.7 환율은 엑셀이 아니라 `Ccodem`이 결정한다

`XcrLookupService.resolveXcr(curC, baseDate)`는 클라이언트가 보낸 `xcr`을 신뢰하지 않고 `Ccodem(C_ID='CUR_C', CDVA=통화코드, C_TP='XCR', 유효기간 포함 baseDate)`의 `CO_CDVA_NM`을 파싱해 환율을 결정한다(설계 결정 E). 외화인데 유효한 행이 없으면 `IllegalStateException`으로 트랜잭션을 롤백한다.

이어서 `BudgetAmountCalculator.reconcileAmount`의 **결정 C**가 외화 행(`curC != null && != "KRW"`, `fcAmt != null`, `xcr > 0`)이면 **클라이언트 원화금액을 버리고 `fcAmt × xcr`을 `setScale(3, HALF_UP)`으로 재계산**해 저장한다. 원화 행은 `krwAmt`를 보존하고 `fcAmt`를 `null`로 강제한다(결정 B).

`CostService.createCost:96`은 `resolveXcr(curC, LocalDate.now())`를 호출한다 — **기준일이 오늘**이다.

결론:
- 외화 행의 저장 금액은 엑셀 원화열이 아니라 `FC_AMT × Ccodem 환율`이다.
- 선행 시드는 단순 통화 코드 추가가 아니라 `C_TP='XCR'`, `CO_CDVA_NM=환율값`, **유효기간이 이관 실행일을 포함하는** 환율 행이어야 한다.
- 그 값을 엑셀 `(환율 기준)` 시트의 2026년 예산환율로 넣으면 재계산 결과가 엑셀 원화열과 일치한다(`GBP 2,890 × 1,924 = 5,560,360` ✓). `AMOUNT_MISMATCH` 진단이 이 전제를 지키는 장치가 된다.
- JPY는 엑셀 외화열이 천엔이므로 `FC_AMT`를 엔으로 ×1,000 변환해야 재계산이 맞는다(§5.1).

### 3.8 `validateBudgetPeriod()`가 마이그레이션을 차단한다

`CostService.createCost:87`과 `ProjectService.createProject:137`이 `codeService.validateBudgetPeriod()`를 호출한다. 오늘이 `BG_RQS/STA`~`BG_RQS/END` 밖이면 `CustomGeneralException`(400)으로 실패한다. 이관 작업이 편성 시즌 밖에서 돌면 무조건 막힌다.

**결정**: 두 서비스에 기간 검증을 생략하는 오버로드를 추가하고, 기존 시그니처는 검증하는 경로로 위임한다. 마이그레이션만 생략 경로를 쓴다(관리자 전용 컨트롤러 뒤에 있다). 기존 화면 호출부의 동작은 바뀌지 않는다. 공통 `validateBudgetPeriod`에 관리자 예외를 넣는 방식은 기간 검증이 걸린 7개 호출 지점의 정책을 한꺼번에 바꾸므로 택하지 않는다.

## 4. 아키텍처

### 4.1 3단계 흐름

```
[브라우저]                          [서버]
파일 선택
  └ exceljs 파싱 ─→ 정규화 행 목록(JSON)
                       │
                       ├─→ POST /api/admin/migration/imports:dry-run
                       │     · 시트 종류별 어댑터로 도메인 명령 조립
                       │     · 부서·팀·사번 해석(CORGNI/CUSERI) + 후보 목록
                       │     · 필수값·코드값·중복(자연키)·길이 검증
                       │   ←── 행별 진단 + 해석 후보 + 요약
  미리보기 표에서 보정
  (미해석·중의적 셀 드롭다운)
                       ├─→ POST /api/admin/migration/imports
                       │     · 단일 @Transactional
                       │     · 재검증 후 원장 + 이관 결재완료 받이 생성
                       │   ←── 반영 건수 + 생성된 관리번호
```

파싱은 프런트에서 한다. `exceljs`가 이미 의존성에 있고 `useCostExcelTransfer`에 전례가 있으며, 새 백엔드 의존성(Apache POI)이 필요 없고, 신뢰할 수 없는 zip을 서버에서 해제하지 않는다.

dry-run 결과를 서버가 보관하지 않는다. staging 테이블과 정리 배치를 만들지 않는 대신 **commit이 클라이언트가 보낸 값을 신뢰하지 않고 전부 재검증**한다. 검증 로직은 dry-run과 commit이 같은 `MigrationValidator`를 공유한다.

### 4.2 백엔드 모듈 — `com.kdb.it.domain.migration`

| 클래스 | 책임 |
| --- | --- |
| `MigrationController` | 클래스 수준 `@PreAuthorize("hasRole('ADMIN')")`. dry-run·commit 2개 엔드포인트 |
| `MigrationImportService` | 트랜잭션 경계. 어댑터 선택 → 검증 → 반영 오케스트레이션 |
| `SheetAdapter` (인터페이스) | 정규화 행 → 도메인 명령 변환 |
| `CostSheetAdapter` | `전체취합(국내외)` → `BCOSTM` |
| `CapitalProjectSheetAdapter` | `1-1. 26년정보화사업` → `BPROJM`·`BITEMM`·`BBUGTM` |
| `DelegatedBudgetSheetAdapter` | `2. 위임예산(경상)` → `BPROJM`(경상)·`BITEMM` |
| `PlanAdjustmentSheetAdapter` | `26년정보화사업(자본예산)` → `BPLANM`·`BPLANA`·편성 조정 |
| `OrgIdentityResolver` | 부서명·팀명·담당자명 → 코드·사번 해석 + 후보 산출 |
| `MigrationValidator` | 행별 진단 생성 |
| `MigrationApprovalStamper` | 이관용 `CAPPLM`(상태 `2`) + `CAPPLA` 생성 |

원장 생성은 새 INSERT 경로를 만들지 않고 기존 서비스를 호출한다.

- `CostService.createCost` — `COST-{yy}-%04d` 채번
- `ProjectService.createProject` — `PRJ-{yy}-%04d`·`GCL-{yy}-%04d` 채번, `BITEMM` 생성 포함
- `BudgetRateApplicationService.applyItemRates` — 편성 조정
- `PlanService` 스냅샷 생성 로직 — `BPLANM.REDT_CONE_INF`

채번·조직명 스냅샷·`@LogTarget` 감사로그가 모두 이 경로에 있어 우회하면 전부 다시 구현해야 한다. 외부 `@Transactional`이 같은 트랜잭션을 공유하므로 파일 단위 원자 반영도 성립한다.

### 4.3 프론트 모듈

| 파일 | 책임 |
| --- | --- |
| `app/pages/admin/migration/index.vue` | `definePageMeta({ middleware: 'admin' })`. 라우팅·조합만 |
| `app/composables/useMigrationPage.ts` | 화면 상태 파사드 (파일·단계·진단·보정값) |
| `app/composables/migration/useMigrationParser.ts` | exceljs 파싱 + 시트 종류 판별 + 정규화 |
| `app/composables/migration/useMigrationPreview.ts` | dry-run 호출·진단 병합·보정값 관리 |
| `app/components/migration/MigrationPreviewTable.vue` | `StyledDataTable` 기반 미리보기. 진단 셀 강조 + 드롭다운 보정 |

페이지가 `MAX_NEW_FILE_LINES`(800줄)를 넘지 않도록 상태·업무 흐름을 파사드로 내린다.

화면은 **파일 슬롯 4개**(일반관리비/자본예산/위임예산/부문계획)를 두고 올린 것만 반영한다. 부문계획만 단독으로 올렸을 때 대상 사업이 DB에 이미 있으면 통과하고, 없으면 진단으로 막는다.

## 5. 어댑터 매핑

### 5.1 공통 변환 규칙

| 항목 | 규칙 |
| --- | --- |
| 금액 단위 | §3.4 표에 따라 시트별 배수 적용 |
| 외화 `FC_AMT` | 통화 기본 단위. JPY만 천엔→엔 ×1,000 |
| 환율 | 서버가 `Ccodem`에서 결정한다(§3.7). 어댑터는 `XCR`을 설정하지 않고 `XCR_BSE_DT='20260101'`만 채운다 |
| 금액 정합 | 외화 행은 서버가 `FC_AMT × Ccodem 환율`로 재계산한다. dry-run이 그 재계산값을 엑셀 원화열과 대조하고(허용 오차 1원) 어긋나면 `AMOUNT_MISMATCH` 경고를 낸다. 원화 행은 엑셀 원화열이 그대로 저장된다 |
| `ABUS_TC` | `신규`→`10`, `계속`→`20`, 그 외 `CodeDefaults.orNotApplicable` |
| `O`/공백 | `Y`/`N` |
| 공통 | `BSE_YY='2026'`, `LST_YN='Y'`, `DEL_YN='N'` |

### 5.2 `전체취합(국내외)` → `BCOSTM`

1행 1레코드, 14건.

| 엑셀 열 | 컬럼 | 비고 |
| --- | --- | --- |
| 사업코드 | `BG_UNT_ABUS_C` | `571`·`501` 모두 코드표 존재 |
| 세목 | `IOE_C` | 코드값명 매칭 (§3.1) |
| 구분 | `ABUS_TC` | |
| 계약업체명 / 요구내역 | `CTT_OPP_NM` / `CTT_NM` | |
| 보안 / 금융정보단말기 | `SECT_SYS_UTZ_YN` / `TMN_YN` | |
| 요구부서 / 팀 | `SVN_DPM_C`+`SVN_DPM_NM` / `SVN_TEM_C`+`SVN_TEM_NM` | `-`·공백 → null |
| 26년 통화 / 요구액 / 요구액(원화) | `CUR_C` / `FC_AMT` / `AMT` | KRW행 `FC_AMT=null` |
| 비고 | `IND_RSN` | |
| — | `CGPR_ID` | 업로드 사용자 사번 (엑셀에 담당자 열 없음) |
| — | `DFR_CLE_C` / `BG_SNO` | 기본값 / `1` |

미적재: 세목코드, 25년 통화·요구액·요구액(원화), 증감액, 증감률 (파생·전년도).

### 5.3 `1-1. 26년정보화사업` → `BPROJM` + `BITEMM` + `BBUGTM`

`BPROJM`: 사업명→`ABUS_NM`, 유형→`ABUS_PPO_CONE`, 사업개요→`ABUS_CONE`, 주관부문→`PRLM_HRK_OGZ_C_CONE`, 주관부서·담당팀→`SVN_DPM_C`·`SVN_TEM_C`, 담당자·담당팀장→`USID`·`TLR_USID`, 담당IT팀→`DVM_TEM_C`·`DVM_DPM_C`, 추진가능성→`EXE_PTT_YN`, 진행상황→`ABUS_TC`, 전결권→`IT_PTL_EDRT_TC`, 시작·종료(`'26.05`)→`STT_DTM`·`END_DTM`(해당월 1일/말일), `ODN_YN='N'`, `SNO=1`.

`BITEMM`은 금액 > 0인 항목만 생성한다.

| 엑셀 열 | `IOE_C` 기본값 | 보정 후보 |
| --- | --- | --- |
| 편성요청 개발비 | `103` 개발비(일반) | `104` 감리/컨설팅 |
| 편성요청 기계장치 | `101` 국내기계장치 | `102` 국외 |
| 편성요청 기타무형 | `106` 국내기타무형자산(일반) | `105` 국외, `107` SW라이선스 |

엑셀에 국내/국외·일반/감리 구분이 없다(`글로벌 표준 뱅킹시스템…(감리비 포함)`은 `104`가 섞여 있다). 기본값을 제시하고 미리보기에서 보정한다.

`BBUGTM`은 이 어댑터가 직접 쓰지 않는다(§3.5). 조정비율 열(`0.7`·`1`)만 ×100해 `ItemRate`(`assetDupRt`=`costDupRt`=`70`·`100`)로 모아 두고, 반영 마지막 단계의 `applyItemRates` 단일 호출에 넘긴다. 자본예산 파일의 조정액은 실제로 비율 곱이라 이 방식으로 정확히 재현된다(`1,406 × 0.7 = 984` ✓).

### 5.4 `26년정보화사업(자본예산)` → `BPLANM` + `BPLANA` + 편성 조정

헤더가 2행 병합(`I1:Q1`, `R1:S1`, `T1:V1`, `A1:A2`, `C1:C2` 등)이므로 파서가 1·2행을 결합해 열을 식별한다.

`BPLANM`: `PLN-2026-{seq}` 채번, `IT_PTL_PLN_TP_C='조정'`, `REDT_CONE_INF`=`PlanService` 스냅샷 로직 재사용, `ADU_TOT_AMT`·`TOT_CPIT_AMT`·`TOT_XP_AMT`=합계.

`IT_PTL_PLN_TP_C`는 `조정`을 쓴다. 코드집합은 `신규`/`조정` 두 개이고 `it_frontend/app/pages/info/plan/index.vue:112`, `app/components/council/plan/PlanCouncilTargets.vue:50`, `it_backend/.../PlanEvaluationService.java:89`가 `'조정'`으로 분기한다. 다른 값을 넣으면 조정 계획이 "수립"으로 표시되고 협의회 조정 분기가 타지 않는다.

`BPLANA`: 3행 각각 `(ABUS_MNG_NO, REQ_DOC_NO)` 연결.

사업별 조정: 부문계획의 조정액은 비율 곱이 아니라 **확정 절대금액**이다. 웹한글 사업은 편성요청 `1,406`인데 조정이 `416`이고 비고가 `6.10자 품의 완료, 7.9자 계약 완료`다 — 실제 계약금액 반영이다. `416/1,406 = 29.6%`이고 `Bbugtm.asgRt`는 `Integer`라 `30%`밖에 담지 못해 `421.8`로 어긋난다.

**결정**: 이 어댑터가 대상 사업의 기존 `BITEMM` 행을 `LST_YN='N'`으로 닫고 조정 금액으로 새 행을 `LST_YN='Y'`로 만든다. 그리고 `applyItemRates`에는 편성률 `100`을 준다. 편성액이 엑셀과 정확히 일치하고, 편성요청 원값은 `LST_YN='N'` 행으로 보존된다. 26년 6월 조정 기준액이 사업의 현재 요청금액이 되는 것이 도메인상 자연스럽다.

예상지급일정(`'26.12월`) → 새 `BITEMM` 행의 `BSE_YM`.

`사업진행` 열(`진행(품의)`·`진행(계약)`·`취소(연기)`)은 원장 코드에 매핑하지 않고 `BPLANM.REDT_CONE_INF` 스냅샷에만 남긴다. `BPROJA`의 PK는 `(ABUS_MNG_NO, CNCD_RFR_NO)`이고 사업계획 상태는 `(ABUS_MNG_NO, 'BIZ-' + ABUS_MNG_NO)` 행에 작성중(`21`)·작성완료(`29`)로만 기록하는 규약이므로(`it_backend/CLAUDE.md` §8), 이 세 값을 담을 자리가 없다. `BPROJM.IT_PTL_RPR_STS_TC`(보고상태)도 유효 코드셋이 이 값들과 다르다. 원장 코드셋을 새로 정의하는 것은 이번 범위를 넘으므로 스냅샷 보존으로 그친다.

미적재: `25년 이전`, `26년 집행완료`, `26년 집행예정`, `27년 이후` 4열도 집행 실적이라 같은 스냅샷에만 남긴다.

### 5.5 `2. 위임예산(경상)` → `BPROJM`(경상) + `BITEMM`

부점명이 병합·공백이라 **forward-fill**로 그룹을 만든다(런던 7행, 런던 PF 5행 → 사업 2건).

`BPROJM`(부점별 1건): `ABUS_NM='2026년 {부점명} 위임예산(경상)'`, `ODN_YN='Y'`, `ABUS_TC='20'`, `SVN_DPM_C`=부점명 해석, 기간 `2026-01-01`~`2026-12-31`, `USID`·`DVM_USID`=업로드 사용자, `SNO=1`.

`BITEMM`: 행별로 HW/SW 중 금액 > 0인 쪽을 각각 생성. HW→`IOE_C=102`(국외기계장치), SW→`105`(국외기타무형자산), 내용→`GCL_NM`, 수량→`QTY`, 통화→`CUR_C`, 합계(해당통화)→`FC_AMT`, 합계(원화환산)→`AMT`(변환 없음), `XCR=1924`.

## 6. 검증

### 6.1 진단 카탈로그

행/셀 단위로 `severity`, 셀 좌표, 코드, 메시지, 해석 후보를 반환한다.

| 코드 | severity | 조건 |
| --- | --- | --- |
| `ORG_UNRESOLVED` | BLOCKER | 부서·팀명이 `CORGNI`에 없음 |
| `ORG_AMBIGUOUS` | BLOCKER | 부서·팀 후보 2건 이상 |
| `USER_UNRESOLVED` | BLOCKER | 담당자명이 `CUSERI`에 없음 |
| `USER_AMBIGUOUS` | BLOCKER | 동명이인 |
| `CODE_UNRESOLVED` | BLOCKER | `IOE_C`·`CUR_C`·`BG_UNT_ABUS_C`·`EXE_PTT_YN`·`IT_PTL_EDRT_TC` 미매칭 |
| `REQUIRED_MISSING` | BLOCKER | 사업명·금액 등 필수값 공백 |
| `DUPLICATE_EXISTS` | BLOCKER | 자연키로 기존 행 존재 |
| `PROJECT_NOT_FOUND` | BLOCKER | 부문계획 행의 사업이 같은 반영에도 DB에도 없음 |
| `LENGTH_EXCEEDED` | BLOCKER | 물리 길이 초과 (`CTT_NM` 100, `IND_RSN` 200, `ABUS_NM` 100) |
| `AMOUNT_MISMATCH` | WARNING | `원화열 ≠ 외화열 × 환율` (허용 오차 1원) |
| `RATE_OUT_OF_RANGE` | WARNING | `ASG_RT`가 0~100 밖 |
| `DATE_UNPARSEABLE` | WARNING | `'26.05` 파싱 실패 → null |

BLOCKER가 하나라도 남아 있으면 확정 반영 버튼이 열리지 않는다.

### 6.2 중복 판정 자연키

재업로드는 거부한다(덮어쓰지 않는다). `LST_YN='Y' AND DEL_YN='N'` 기준으로 조회한다.

| 대상 | 자연키 |
| --- | --- |
| `BCOSTM` | `(BSE_YY, BG_UNT_ABUS_C, IOE_C, CTT_OPP_NM, CTT_NM)` |
| `BPROJM` | `(BSE_YY, 정규화 ABUS_NM)` |
| `BPLANM` | `(BSE_YY, IT_PTL_PLN_TP_C)` |

dry-run에서 이미 존재하는 행을 `DUPLICATE_EXISTS`로 표시하고 기본 제외한다.

### 6.3 조직·사용자 해석

`OrgIdentityResolver` 3단계: ① 정확 일치 → ② 공백·괄호 제거 후 일치 → ③ 부분 일치(후보 반환, 2건 이상이면 `AMBIGUOUS`).

담당자는 `김성원 과장`을 이름+직위로 분리해 `CUSERI.USR_NM`+`PT_C_NM`으로 좁히고, 그래도 복수면 같은 행의 주관부서로 재차 좁힌다.

성능: dry-run 시작 시 `CORGNI`·`CUSERI`를 각 1회 전량 조회해 메모리 인덱스로 매칭한다. 행별 조회는 N+1이 되고, 조직·직원 규모가 작아 전량 로드가 타당하다.

## 7. 반영 트랜잭션

파일 단위 원자 반영이다. 단일 `@Transactional`에서 어댑터 실행 순서를 지킨다.

```
1. 전체 재검증 — BLOCKER 하나라도 있으면 아무것도 쓰지 않고 실패
2. 이관 대상이 아닌 기존 BBUGTM 행의 (원천, ASG_RT)를 미리 읽어 둔다
3. 일반관리비(BCOSTM)
   → 자본예산(BPROJM·BITEMM)
   → 위임예산(BPROJM·BITEMM)
   → 부문계획(BPLANM·BPLANA, 대상 사업의 BITEMM 버전 교체)
4. 원장 생성 직후 MigrationApprovalStamper가 CAPPLM(상태 '2') + CAPPLA 생성
5. applyItemRates를 딱 한 번 호출 — items에 그 연도의 모든 사업 + 모든 전산업무비
   (이관분은 어댑터가 모은 편성률, 그 외는 2에서 읽어 둔 기존 ASG_RT)
```

부문계획은 자본예산이 만든 `BITEMM`을 버전 교체하므로 반드시 원장 단계의 마지막이다.

편성행 생성은 5번의 단일 호출이 전담한다. 어댑터는 `BBUGTM`을 직접 쓰지 않는다. `applyItemRates`가 연도 전체를 재작성하면서 삭제 이력을 남기지 않으므로(§3.5), 두 번 호출하면 첫 번째 호출의 결과가 흔적 없이 사라진다.

## 8. 오류 처리

- 파싱 실패(시트 없음·헤더 불일치): 시트 종류 자동 판별 실패를 안내하고 수동 선택을 제공한다.
- dry-run·commit 실패: `formatApiError`로 문구를 만들고 `TOAST_LIFE` 상수를 쓴 Toast와 화면 배너로 알린다. `console.error`만 남기고 끝내지 않는다.
- commit 성공: 반영 건수와 생성된 관리번호를 화면에 표시한다. 이 화면은 목록이 아니라 재조회 가드가 필요하지 않다.
- 파일 업로드가 아니라 JSON 본문을 보내므로 `SimpleRequestCsrfFilter`의 `X-Requested-With` 요건은 `$apiFetch`가 자동 충족한다.

## 9. 선행 조치

마이그레이션 기능과 분리된 커밋으로 먼저 반영한다.

1. `it_database/migrations/V20260811_001__SeedCurrencyAndBudgetXcr.sql` — `CUR_C`에 `GBP`·`AUD` 코드 추가 + 엑셀 `(환율 기준)` 시트의 2026년 예산환율을 `C_TP='XCR'`·`CO_CDVA_NM=환율값` 행으로 시드(유효기간이 이관 실행일 포함). **이것 없이는 데이터 대부분이 적재 불가**(§3.2, §3.7)
2. `it_database/migrations/V20260811_002__SeedMigrationAdminMenu.sql` — `/admin/migration` `PGE` 메뉴 시드
3. `CostService.createCost`·`ProjectService.createProject`에 기간 검증 생략 오버로드 추가(§3.8)
4. 주석 정정: `Bbugtm.java:58`(`FNT_TB_NM`은 `BITEMM`/`BCOSTM`), `Bprojm.java:219`(`ABUS_TC` 실제 저장값은 `10`/`20`), `BudgetWorkDto.ItemRate.orcTb`(접두어 없는 `BPROJM`/`BCOSTM`)

## 10. 테스트

| 계층 | 대상 |
| --- | --- |
| 백엔드 단위 | 어댑터 4개 변환 규칙(금액 단위·통화·비목 매칭), `OrgIdentityResolver` 3단계·중의성, 진단 카탈로그 전건, `ABUS_TC`·보안 플래그 변환 |
| 백엔드 슬라이스 | dry-run·commit 권한(비관리자 403), `@Valid`, `consumes` |
| 백엔드 통합 `@Tag("it")` | 실제 Oracle에 4시트분 commit → 각 테이블 행 수·금액·결재상태 검증, BLOCKER 시 전량 롤백, 재업로드 거부 |
| OpenAPI 계약 | `MigrationOpenApiContractTest` — 응답 DTO `requiredMode`·`nullable`·`allowableValues` 고정 |
| 프론트 단위 | 파서(2행 병합 헤더 결합, 부점명 forward-fill, 시트 판별), 보정값 병합 |
| 프론트 E2E | 관리자 로그인 → 업로드 → 진단 표시 → 보정 → 반영 → 결과 확인 |
| 계약 드리프트 | 백엔드 기동 후 `npm run codegen`, `npm run codegen:check` |
| 경계 고정 | `tests/unit/architecture/component-boundaries.test.ts`에 `components/migration/` 추가, `tests/unit/pages/*PageBoundary.test.ts`에 마이그레이션 페이지 추가 |

**픽스처 주의**: `C:\it`의 세 xlsx는 실 업무 데이터(실명 담당자·실제 예산액)이며 현재 git 미추적 상태다. 저장소에 커밋하지 않고 같은 구조의 축약·익명화 픽스처를 만들어 테스트에 쓴다. 실물 검증은 로컬에서만 수행한다.

## 11. 결정 요약

| 항목 | 결정 |
| --- | --- |
| 기능 성격 | 상시 관리자 일괄업로드 화면 (`/admin/migration`) |
| 사업 적재 | 편성요청→`BPROJM`, 조정→대상 `BITEMM` 버전 교체 |
| 편성행 생성 | 반영 마지막에 `applyItemRates` **단일 호출**, `items`에 연도 전체(§3.5) |
| 환율 | 서버가 `Ccodem`에서 결정. 외화 행 금액은 `FC_AMT × 환율` 재계산(§3.7) |
| 기간 검증 | `createCost`·`createProject`에 생략 오버로드 추가(§3.8) |
| 계획구분 | `IT_PTL_PLN_TP_C='조정'` |
| 결재 | 이관용 결재완료 받이(`CAPPLM` 상태 `2` + `CAPPLA`) 생성 |
| 파싱 위치 | 프런트 exceljs + 서버 검증·반영 (dry-run 결과 미보관, 2회 검증) |
| 반영 단위 | 파일 단위 원자 반영, 재업로드 중복 거부 |
| 해석 실패 | 미리보기에서 사용자가 직접 매핑 (BLOCKER 잔존 시 반영 차단) |
| 위임예산 | 부점별 1사업(`ODN_YN='Y'`) + 품목 N |
| 금액 단위 | 일반관리비 천원, 자본예산·부문계획 백만원, 위임예산 원 |
| 미해석 비목 3건 | 새 코드 없이 미리보기에서 기존 비목 선택 |
| 대상 시트 | 핵심 3시트 + 위임예산 + 참조표 2개. 숨김 국내·국외(2013~2017) 제외 |
