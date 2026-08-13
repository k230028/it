# 부점 전산예산 편성요청서 반입 설계

- 작성일: 2026-08-13
- 대상: 부점이 제출한 `전산예산 편성 요청서` 엑셀의 정보화사업·경상사업·전산업무비 상세 신청 내역 반입
- 관련 저장소: `it_backend`, `it_frontend`, `it_database`

## 1. 배경과 목표

포탈 도입 전에는 부점이 `전산예산 편성 요청서` 엑셀 양식에 정보화사업·경상사업·전산 일반관리비 신청 내역을 적어 제출했다. 수십~수백 건에 이르는 이 제출본을 포탈 원장으로 옮겨야 한다.

기존 자산과의 관계: `/admin/migration`(설계 `2026-08-11-excel-bulk-migration-design.md`)이 이미 있으나 **전사 취합본**(`전체취합(국내외)`, `1-1. 26년정보화사업(전산예산반영)` 등) 전용이다. 이번 대상은 **부점 제출 원본**이라 시트 구조가 전혀 다르다(표가 아니라 폼 레이아웃, 부점당 파일 1개). 기존 화면·어댑터는 수정하지 않고 별도 경로를 만든다.

목표는 **상시 관리자 일괄업로드 화면**이다. 편성 시즌마다 재사용한다.

## 2. 대상 양식

한 워크북 = 한 부점(또는 한 사업)의 제출본이며 시트 4개로 고정된다.

| 시트명 | 성격 | 대상 |
| --- | --- | --- |
| `① (정보화사업) 1-1. 정보화사업 개요` | 폼 (라벨-값 세로 배치) | `TPRMPP_BPROJM` |
| `① (정보화사업) 1-2. 소요자원 상세내용` | 표 2블록 (자본예산 / 일반관리비) | `TPRMPP_BITEMM` |
| `② (경상사업) 2. 경상적인 사업` | 폼 + 소요자원 표 | `TPRMPP_BPROJM`(`ODN_YN='Y'`) + `BITEMM` |
| `③ (일반관리비) 전산 일반관리비 편성요청서` | 표 | `TPRMPP_BCOSTM` |

시트가 비어 있으면(사업명·데이터 행 모두 공백) 그 시트는 건너뛴다. 정보화사업만 낸 파일, 일반관리비만 낸 파일이 모두 정상이다.

**한 워크북에 정보화사업은 최대 1건, 경상사업도 최대 1건이다.** 정보화사업이 여러 건인 부점은 파일을 여러 개 낸다(샘플의 `[자료1] … 스마트워크 인프라(VDI) 고도화 사업.xlsx`가 그 형태로, 시트 ①만 채워져 있다). 같은 부서 폴더 안의 파일 여러 개는 각각 독립 반입 단위다.

`Bprojm` 컬럼이 1-1 폼 항목과 거의 1:1로 대응한다. 이 양식이 곧 포탈 정보화사업 등록 화면의 원형이다.

### 2.1 실측으로 확인한 제약

근거는 `C:\it\sample`의 실제 제출본 3건과 로컬 Oracle(`ITPAPP@127.0.0.1:11521/XEPDB1`) 실측이다.

**행 위치가 파일마다 다르다.** 두 파일이 1-1 시트에서 각각 38행·41행이다. 사업범위·추진경과 칸에 사용자가 행을 끼워 넣기 때문이다. 고정 셀 좌표는 성립하지 않는다.

**`.xls`(BIFF8)가 섞여 있다.** 샘플 3건 중 2건이 OLE 복합문서(`D0CF11E0`)다. 현행 프론트 파서 `exceljs`는 `.xlsx`만 읽는다.

**1-1 요약표의 금액 단위가 파일마다 다르다.** 헤더는 `예산 소요(상세) (백만원, 부가세포함)`인데 실제 기재값이 갈린다.

| 파일 | 1-2 품목 합계 | 1-1 요약표 기재값 | 실제 단위 |
| --- | --- | --- | --- |
| 스마트워크 인프라(VDI) | 2,637,140,000 | `2637` | 백만원 |
| 자금운용실 | 1,014,981,660 | `1014981660` | 원 |

1-2는 `수량 × 단가`라 두 파일 모두 원 단위다. **1-2를 금액 원본으로 삼고 1-1 요약표는 대사 검증용으로만 쓴다.**

**시트 ③은 대사할 상대가 없다.** 헤더는 `(단위 : 천원, 천엔, 기타 통화 일, 부가세 포함)`인데 자금운용실은 `841,854,085`(원)로 적었다. 천원으로 읽으면 8,418억이 되어 성립하지 않는다. 이 시트만 단위를 미리보기에서 확인·지정한다.

**해외점포는 영문 양식을 낸다.** 런던지점 파일은 라벨·비목명이 전부 영문이다(`Expense`, `IT Service`, `Foreign branch line usage fees`). 다만 **시트명은 국문 그대로**라 시트 판별은 영향받지 않는다.

**Y/N 표기가 4종 이상이다.** 런던 파일의 `Ⅹ`는 알파벳 X가 아니라 로마숫자 10(U+2169)이고, 자금운용실은 체크표시 `√`를 쓴다. 단순 문자 비교로는 둘 다 `N`이 된다.

**시트 ③에 사업코드(`BG_UNT_ABUS_C`) 열이 없다.** 전사 취합본에는 있던 열이다.

**빈 행이 대량으로 남아 있다.** 자금운용실 ③ 시트가 `ref=A1:M65535`다. 서식만 남은 행이 6만 5천 개다.

**`BITEMM`에 일반관리비 비목이 이미 들어 있다.** 실측 분포는 자본예산 `101~107`(31건)과 일반관리비 `001,005,006,007,013,014,015`(15건)다. 양식 주석 "정보화사업에 포함된 일반관리비는 1-1·1-2 시트에 작성"과 일치한다. **1-2 시트의 일반관리비 품목도 `BITEMM`으로 보낸다.**

**`CO_CDVA_SPS`가 시트 ③의 2단 분류와 대응한다.** `IOE_C` 공통코드의 `CO_CDVA_SPS`가 `일반관리비 - 전산임차료 - 국내전산임차료` 계층이라, 시트 ③의 (A열 비목명, B열 세부비목) 쌍과 직접 매칭된다. 이름 하나로 맞추는 것보다 견고하다.

**통화·환율 시드는 이미 있다.** `V20260811_001__SeedCurrencyAndBudgetXcr.sql`이 GBP `1924`, AUD `929`, USD `1432`, EUR `1666`, JPY `9.7`을 `C_TP='XCR'`, 유효기간 `20260101~99991231`로 넣어 두었다. 런던 파일의 GBP·USD·EUR가 모두 커버된다. 선행 조치가 아니다.

**기간 검증 생략 오버로드도 이미 있다.** `CostService.createCost(request, skipBudgetPeriodValidation)`(`CostService.java:105`)와 `ProjectService.createProject(...)`(`ProjectService.java:174`)가 존재한다. `MigrationApprovalStamper.stamp(...)`도 그대로 쓸 수 있다.

**Apache POI가 폐쇄망에 없다.** `C:\maven-repo`에 `poi*.jar`가 0건이고 Nexus(`10.6.65.151:20080`)는 TCP 접속이 되지 않는다. `build.gradle:148`이 Caffeine 사례로 명시하듯 신규 라이브러리는 반입 신청이 선행되어야 한다. **§9의 1번이 이 기능의 유일한 착수 전제다.**

## 3. 아키텍처

### 3.1 흐름

화면은 `/admin/migration/requests`(신규)다. 기존 `/admin/migration`은 수정하지 않는다.

```
[브라우저]                                      [서버]
webkitdirectory 폴더 선택
 └ 자금운용실/요청서.xlsx
   런던지점/붙임.xls          relativePath 최상위 폴더 = 부서
대상 예산연도 선택 (BSE_YY)
        │
        │  20개씩 배치로 분할 (기본값, 설정 가능 / 진행률 표시)
        │
        ├─→ POST /api/admin/migration/requests:dry-run   (multipart)
        │     parts: files[] + manifest(예산연도·파일별 부서명·상대경로) + overrides
        │     · POI가 워크북을 열어 4시트를 라벨 앵커로 스캔
        │     · 부서·사용자·비목·통화 해석 (기존 헬퍼 3종 재사용)
        │   ←── 파일별 진단 + 해석 후보 + 요약
   미리보기에서 보정 (미해석 비목·부서·단위·사업코드)
        │
        ├─→ POST /api/admin/migration/requests           (multipart, 같은 파일 재전송)
        │     · 파일 1개 = 트랜잭션 1개 (REQUIRES_NEW)
        │     · 재검증 후 BLOCKER 있는 파일만 건너뜀
        │   ←── 파일별 성공/실패 + 생성된 관리번호
```

### 3.2 핵심 결정 3가지

**서버가 dry-run 결과를 보관하지 않는다.** staging 테이블과 정리 배치를 만들지 않는 대신, commit 시 브라우저가 같은 `File` 객체를 다시 올리고 서버가 전량 재검증한다. 검증 로직은 dry-run과 commit이 같은 `RequestFormValidator`를 공유한다. 기존 `/admin/migration`과 같은 원칙이다.

**파일 단위 트랜잭션을 `REQUIRES_NEW`로 분리한다.** 배치 요청 하나에 20파일이면 트랜잭션 20개다. 한 파일이 실패해도 나머지는 커밋된다. 오케스트레이터(`RequestFormImportService`)는 자신에게 트랜잭션을 걸지 않는다 — 걸면 바깥 트랜잭션이 롤백될 때 안쪽 커밋과 어긋난다.

**고정 셀 좌표를 쓰지 않는다.** §2.1대로 행 위치가 파일마다 다르다. A·C열의 라벨 텍스트로 행을 찾는 앵커 스캔을 쓰고, 표 헤더도 `구분|항목|수량|단가|통화` 조합을 찾아 열 위치를 정한다. "서식 제각각"에 대한 유일한 방어책이다.

### 3.3 부서 귀속

시트 ②·③에는 부서 열이 아예 없다. 1-1만 `주관부문/주관부서/팀`을 담는다. 파일명도 신뢰할 수 없다(샘플 3건 중 1건은 괄호 안이 부점명이 아니라 사업명이다).

**`webkitRelativePath`의 최상위 폴더명을 부서로 삼는다.** `OrgIdentityResolver.resolveOrg()`로 해석하며, 미해석·중의적이면 그 폴더의 모든 파일이 `ORG_UNRESOLVED` BLOCKER가 되고 미리보기에서 한 번 고르면 폴더 전체에 적용된다.

1-1 시트에 `주관부서/팀`이 적혀 있으면 **폼 값이 폴더명보다 우선**한다. 폼이 더 구체적이고(팀까지 있음) 사업 단위로 다를 수 있기 때문이다. 폴더명은 시트 ②·③과 1-1 미기재 시의 근거다.

## 4. 시트별 매핑

### 4.1 공통 변환 규칙

| 항목 | 규칙 |
| --- | --- |
| 금액 | 1-2·②는 원 단위 그대로. 1-1 요약표는 적재하지 않고 대사에만 사용. ③은 미리보기 지정 단위 적용 |
| 외화 `FC_AMT` | 통화 기본 단위. JPY만 천엔→엔 ×1,000 |
| 환율 | 서버가 `Ccodem`에서 결정한다. 어댑터는 `XCR`을 설정하지 않고 `XCR_BSE_DT`만 채운다. 외화 행 저장 금액은 `BudgetAmountCalculator`가 `FC_AMT × 환율`로 재계산한다 |
| `ABUS_TC` | `신규`·`New`→`10`, `계속`·`Cont.`→`20`, 그 외 `CodeDefaults.orNotApplicable` |
| Y/N | §5.2 정규화표 |
| `DFR_CLE_C` | 1-2 일반관리비 블록·시트 ③은 `대금지급주기` 열에서 해석. **자본예산 품목에는 이 열이 없으므로** 물리 NOT NULL을 채우기 위해 일시지급 기본값을 넣는다 |
| 공통 | `LST_YN='Y'`, `DEL_YN='N'`, `BSE_YY`=화면에서 선택한 예산연도 |

### 4.2 `① 1-1. 정보화사업 개요` → `BPROJM`

라벨 앵커로 행을 찾고 오른쪽 병합영역의 값을 읽는다.

| 폼 항목 | 컬럼 | 변환 |
| --- | --- | --- |
| 사업명 | `ABUS_NM`(100) | |
| (개요) | `ABUS_CONE`(1000) | |
| (현황) | `CPN_SAF_CONE`(1000) | |
| (필요성) | `ABUS_NCS_CONE`(300) | |
| (기대효과) | `DGOG_PPO_CONE`(4000) | |
| (미추진시 문제점) | `PLM_DES`(4000) | |
| 사업 범위 (전산 요구사항) | `ABUS_RNG_CONE`(600) | 여러 행에 걸침 → 줄바꿈 결합 |
| 추진경과 | `MN_PRG_CONE`(2000) | 여러 행 결합 |
| 향후계획 | `HRF_PLN_CONE`(300) | 여러 행 결합 |
| 업무구분 | `BZ_DTT_NM`(100) | 공통코드 `BZ_DTT` **코드값명 그대로** 저장 |
| 사업유형 | `ABUS_PPO_CONE`(300) | 공통코드 `ABUS_PPO` 코드값명 |
| 디지털 기술 유형 | `SKL_FLD_NM`(500) | 공통코드 `SKL_FLD` 코드값명 |
| 주 사용자 | `CST_TP_TC_NM`(1000) | 공통코드 `CST_TP_TC` 코드값명 |
| 중복 여부 | `DPL_YN`(1) | |
| 법규상 완료시기 | `FLF_FSG_DT`(8) | YYYYMMDD |
| 주관부문/본부 | `PRLM_HRK_OGZ_C_CONE`(100) | |
| 주관부서/팀 (`자금운용실/원화유가증권팀`) | `SVN_DPM_C`+`SVN_DPM_NM` / `SVN_TEM_C`+`SVN_TEM_NM` | `/` 분리 후 조직 해석 |
| 팀장 | `TLR_USID` | 사용자 해석 |
| IT팀장 | `DVM_TLR_USID` | 사용자 해석 |
| 실무자(정/부) (`허진성/장준호`) | `USID` ← **정(앞)만** | 부(뒤)는 담을 컬럼이 없다 |
| IT실무자(정/부) | `DVM_USID` ← 정만 | |
| 최종보고 | `IT_PTL_RPR_STS_TC` | 코드 매칭 |
| 추진가능성 | `EXE_PTT_YN` | 코드 매칭 |
| 전결권자 (`수석부행장`) | `IT_PTL_EDRT_TC` | 코드 매칭 |
| 시작일자 (`25/06`) | `STT_DTM` | 해당월 1일 |
| 종료일자 (`26/02`) | `END_DTM` | 해당월 말일 |
| — | `ODN_YN='N'`, `SNO=1` | |

미적재: 1-1 예산 소요 요약표(분기별·`26년도 이후`·전체합계) 전체. 1-2 품목 합계로 대사만 한다. 실무자(부)는 `SUBSTITUTE_DROPPED` 경고로 알린다.

1-1에도 상단에 `(확인자)`·`(작성자)` 행이 있으나 **쓰지 않는다.** 담당자·팀장은 `관련 조직` 블록의 `팀장`·`실무자(정/부)`·`IT팀장`·`IT실무자(정/부)`가 정본이다. 두 곳은 어긋날 수 있다 — 자금운용실 파일은 확인자·작성자가 `허인선 팀장`·`김준영 차장`인데 `관련 조직`의 팀장·실무자는 `윤소정`·`허진성`이다(제출 담당자와 사업 주관자가 다른 경우). 한쪽만 정본으로 정한다.

### 4.3 `① 1-2. 소요자원 상세내용` → `BITEMM`

헤더 블록 2개를 각각 찾는다. 첫 블록이 자본예산(`소요예산 (부가세포함)`·`도입시기(월)`), 둘째가 일반관리비(`연간 소요예산 (부가세포함)`·`대금지급주기 (월/분기/년)`)다. 두 블록의 열 구성은 이 두 항목만 다르다.

| 엑셀 열 | 컬럼 | 비고 |
| --- | --- | --- |
| 항목 | `GCL_NM`(100) | |
| 수량 | `QTY` | |
| 통화 | `CUR_C` | |
| 소요예산 / 연간 소요예산 | `AMT`(원화) 또는 `FC_AMT`(외화) | 외화는 서버가 재계산 |
| 산정근거 | `CNCD_FDTN_CONE`(600) | |
| 도입시기(월) | `BSE_YM`(6) | |
| 대금지급주기 | `DFR_CLE_C`(1) | 일반관리비 블록만. 자본예산 블록은 §4.1 기본값 |
| 정보보호여부 | `SECT_SYS_UTZ_YN`(1) | |
| 인프라 통합관리 여부 | `ITR_INFR_YN`(1) | |
| 중분류 + 통화 | `IOE_C` | 아래 추정표 |

`IOE_C` 추정 (원화=국내, 외화=국외):

| 중분류 | 원화 | 외화 | 보정 후보 |
| --- | --- | --- | --- |
| 기계장치(HW) | `101` | `102` | |
| 개발비 | `103` | `103` | `104` 감리/컨설팅 |
| 기타무형자산(SW) | `106` | `105` | `107` SW라이선스 |
| 전산임차료 | `001` | `002` | |
| 전산제비 | — | — | **항상 `CODE_AMBIGUOUS`** |

전산제비는 세부(회선사용료 `010` / 유지보수료 `011` / 전산소모품비 `012` / 국외회선사용료 `013` / 국외전산유지보수료 `014` / 국외전산소모품비 `015`)가 이 폼에 없어 자동 결정할 수 없다. 미리보기에서 고른다.

단가(`F`열)는 적재하지 않는다. `BITEMM`에 단가 컬럼이 없고 `수량 × 단가 = 소요예산` 대사에만 쓴다.

금액이 0이거나 항목명이 공백인 행은 생성하지 않는다.

### 4.4 `② 2. 경상적인 사업` → `BPROJM`(경상) + `BITEMM`

1-1과 같은 앵커 방식이다. 폼 항목이 5개로 줄어든다.

| 폼 항목 | 컬럼 |
| --- | --- |
| 사업명 | `ABUS_NM`(100) |
| (개요) | `ABUS_CONE`(1000) |
| (현황) | `CPN_SAF_CONE`(1000) |
| (추진내용) | `ABUS_RNG_CONE`(600) |
| (미추진시 문제점) | `PLM_DES`(4000) |
| — | `ODN_YN='Y'`, `SNO=1`, 기간 `{연도}-01-01`~`{연도}-12-31` |

부서는 폴더명에서 온다(폼에 없음). 담당자(`USID`)·담당팀장(`TLR_USID`)은 `(작성자)`·`(확인자)` 행의 이름으로 해석하고, 실패하면 업로드 사용자로 채우지 않고 null로 둔다.

런던지점 샘플은 **사업명이 공란인 채로 소요자원 7행이 채워져 있다.** 이 조합은 `REQUIRED_MISSING` BLOCKER이며, 미리보기에서 사업명을 입력해야 반입된다. 드문 예외가 아니라 첫 샘플부터 나온 형태이므로 보정 입력을 지원한다.

소요자원 표는 헤더행부터 `계` 행 직전까지다. `구분`(기계장치(HW)/기타무형자산(SW))과 통화로 `IOE_C`를 §4.3 표대로 추정한다. `계` 행은 적재하지 않고 대사에만 쓴다.

### 4.5 `③ 전산 일반관리비 편성요청서` → `BCOSTM`

헤더가 2행(`비 목 명`/`계약명 / 건명`/`소요예산`+`월간`·`연간`/`계약`+`상대처`·`계속`·`신규`)이고 A·B열이 병합이라 forward-fill이 필요하다.

| 엑셀 열 | 컬럼 | 비고 |
| --- | --- | --- |
| A 비목명 + B 세부비목 | `IOE_C` | `CO_CDVA_SPS`의 `일반관리비 - 중분류 - 세부` 2단계 정확 매칭 |
| C 계약명 / 건명 | `CTT_NM`(100) | |
| D 통화 구분 | `CUR_C`(3) | |
| F 연간 | `AMT` 또는 `FC_AMT` | 지정 단위 적용 |
| E 월간 | **미적재** | `월간 × 주기 ≈ 연간` 대사에만 사용 |
| G 상대처 | `CTT_OPP_NM`(100) | |
| H 계속 / I 신규 | `ABUS_TC` = `20` / `10` | |
| J 정보보호 관련여부 | `SECT_SYS_UTZ_YN`(1) | |
| K 비고 | `IND_RSN`(200) | |
| 폴더명 | `SVN_DPM_C`·`SVN_DPM_NM` | |
| 미리보기 지정 | `BG_UNT_ABUS_C`(3) | 폼에 없음. 폴더 단위 지정, 미지정은 경고 통과 |
| — | `BG_SNO=1`, `CGPR_ID`=업로드 사용자, `DFR_CLE_C` 기본값 | |

세부비목이 `외주용역`이면 `008`(외주/개발)과 `009`(감리/심사)가 모두 `239-0200`이라 중의적이다. `국외전산기타제비`는 대응 코드가 없다(`015`는 `국외전산소모품비`). 두 경우 모두 새 공통코드를 만들지 않고 미리보기에서 기존 비목 중 고른다.

### 4.6 반영 범위 — `BBUGTM`을 만들지 않는다

`BudgetRateApplicationService.applyItemRates`는 `softDeleteByBseYy`로 **해당 연도 편성행 전량을 논리삭제한 뒤** `request.items()`에 담긴 것만 재삽입한다(`BudgetRateApplicationService.java:136`). 파일마다 호출하면 앞서 반입한 편성행이 전부 사라진다. §3.2의 "파일 단위 원자 + 정상 파일만 반영"과 양립할 수 없다.

**이 기능은 원장(`BPROJM`·`BITEMM`·`BCOSTM`)과 이관용 결재완료 받이까지만 만든다.** 편성은 반입을 모두 마친 뒤 관리자가 기존 예산작업 화면에서 한 번에 적용한다.

결재 받이가 없으면 `BbugtmRepositoryImpl`의 집계가 결재완료(`CAPPLM.IT_PTL_APF_PRG_STS_C='2'`) 신청서만 세므로 나중에 편성해도 0으로 남는다. 그래서 받이는 반입 시점에 만든다 — `MigrationApprovalStamper.stamp(fntTbNm, pkColNm, fntTbCrySno, title, actorEno, bseYy)`를 그대로 호출한다.

## 5. 검증

### 5.1 진단 카탈로그

파일 단위·셀 단위로 좌표·코드·메시지·해석 후보를 반환한다. **BLOCKER가 하나라도 있으면 그 파일만 제외**되고 나머지 파일은 정상 반영된다.

| 코드 | severity | 조건 |
| --- | --- | --- |
| `FILE_UNREADABLE` | BLOCKER | POI가 워크북을 열지 못함 (손상·암호·형식 불일치) |
| `SHEET_NOT_FOUND` | BLOCKER | 인식 가능한 시트가 하나도 없음 |
| `ANCHOR_NOT_FOUND` | BLOCKER | 라벨·헤더 앵커 실패 (양식이 과도하게 개조됨) |
| `ORG_UNRESOLVED` | BLOCKER | 폴더명·주관부서/팀이 `CORGNI`에 없음 |
| `ORG_AMBIGUOUS` | BLOCKER | 조직 후보 2건 이상 |
| `USER_UNRESOLVED` | BLOCKER | **값이 있는데** `CUSERI`에 없음 (공란은 진단 아님) |
| `USER_AMBIGUOUS` | BLOCKER | 동명이인 |
| `CODE_UNRESOLVED` | BLOCKER | 비목·통화·전결권·추진가능성 미매칭 |
| `CODE_AMBIGUOUS` | BLOCKER | 후보 2건 이상 (전산제비, 외주용역 등) |
| `REQUIRED_MISSING` | BLOCKER | 사업명, 품목 금액 |
| `DUPLICATE_EXISTS` | BLOCKER | 자연키로 기존 행 존재 |
| `LENGTH_EXCEEDED` | BLOCKER | 물리 길이 초과 |
| `UNIT_UNCERTAIN` | WARNING | 시트 ③ 단위를 휴리스틱으로 추정함 — 확인 요청 |
| `AMOUNT_MISMATCH` | WARNING | 1-1 요약 ≠ 1-2 합계 / `월간 × 주기` ≠ 연간 / 소계·총계 불일치 |
| `OPTIONAL_MISSING` | WARNING | 사업구분·편성기준·보고상태 8항목 공란 |
| `SUBSTITUTE_DROPPED` | WARNING | 실무자(부)를 담을 컬럼이 없어 미적재 |
| `DATE_UNPARSEABLE` | WARNING | `25/06` 파싱 실패 → null |

`OPTIONAL_MISSING` 대상 8항목(`업무구분`, `사업유형`, `디지털 기술 유형`, `주 사용자`, `중복 여부`, `법규상 완료시기`, `최종보고`, `추진가능성`)은 샘플 두 건 모두 공란이다. 전부 nullable이므로 null로 반입하고 경고만 남긴다. 부서가 나중에 포탈 정보화사업 상세 화면에서 채운다.

### 5.2 Y/N 표기 정규화

```
Y ← O ○ ◯ ０ √ ∨ V Y y ●
N ← X x Ⅹ(U+2169) ✕ ㄨ N n 공백
```

그 밖의 문자는 `CODE_UNRESOLVED`로 떨궈 보정한다. 조용히 `N`으로 접지 않는다 — 정보보호 항목이 통째로 뒤집힌다.

### 5.3 국문·영문 대조표

시트명은 런던 파일도 국문(`① (정보화사업) 1-1. …`)이라 시트 판별은 국문 기준으로 동작한다. 내용만 영문이다.

| 영문 | 국문 |
| --- | --- |
| `Business Name` / `Business Overview` | 사업명 / 사업 개요 |
| `Unit Cost` / `Currency` / `Budget (Tax Included)` | 단가 / 통화 / 소요예산 (부가세포함) |
| `Expense` / `Name of the Contract / Item` | 비 목 명 / 계약명 / 건명 |
| `Monthly` / `Annual` / `Counterparty` / `Cont.` / `New` | 월간 / 연간 / 상대처 / 계속 / 신규 |
| `InfoSec. Related` / `Remarks` | 정보보호 관련여부 / 비고 |
| `Contract Type` / `Contract` | 계약구분 / 계약 |
| `IT Service` › `Foreign branch IT service` | 전산 용역비 › 국외전산용역비 (`007`) |
| `IT Expenses` › `Foreign branch line usage fees` | 전산 제비 › 국외회선사용료 (`013`) |
| `IT Expenses` › `Foreign branch IT maintenance fees` | 전산 제비 › 국외전산유지보수료 (`014`) |

대조표는 샘플 1건에서 뽑았다. 다른 해외점포의 번역이 다를 수 있고, 런던 파일에도 `Machinery` › `Tape backup software`처럼 대응이 애매한 행이 있다(일반관리비 시트에 기계장치 분류). 미식별 어휘는 추측하지 않고 `CODE_UNRESOLVED`로 떨궈 미리보기에서 고르게 한다. 대조표는 `FormLexicon` 한 곳에 모아 어휘 추가가 상수 한 줄이 되게 한다.

### 5.4 중복 판정 자연키

재업로드는 거부한다(덮어쓰지 않는다). `LST_YN='Y' AND DEL_YN='N'` 기준으로 조회한다.

| 대상 | 자연키 |
| --- | --- |
| `BPROJM` | `(BSE_YY, 정규화 ABUS_NM)` |
| `BCOSTM` | `(BSE_YY, SVN_DPM_C, IOE_C, CTT_OPP_NM, CTT_NM)` |

`BCOSTM` 자연키에 `SVN_DPM_C`를 쓴다. 기존 이관은 `BG_UNT_ABUS_C`를 썼지만 이 폼엔 없고, 부점별 제출이라 같은 계약명이 여러 부점에 나올 수 있어 부서가 키에 있어야 한다.

이 규칙은 배치 재전송의 안전장치를 겸한다(§7).

### 5.5 조직·사용자 해석

`OrgIdentityResolver`를 그대로 쓴다. dry-run 시작 시 `CORGNI`·`CUSERI`를 각 1회 전량 조회해 메모리 인덱스로 매칭하며, 이 인덱스는 **배치 전체에서 1회만** 만들어 파일 수백 건에 재사용한다.

## 6. 모듈 구성

### 6.1 백엔드 `com.kdb.it.domain.migration.request`

| 클래스 | 책임 |
| --- | --- |
| `RequestFormController` | 클래스 수준 `@PreAuthorize("hasRole('ADMIN')")`. dry-run·commit 2개, `consumes = MULTIPART_FORM_DATA_VALUE` |
| `RequestFormImportService` | 오케스트레이션. **자신에게 트랜잭션을 걸지 않는다** |
| `RequestFormFileImporter` | `@Transactional(propagation = REQUIRES_NEW)` — 파일 1건 반영 단위 |
| `WorkbookReader` | POI 열기, 시트 판별, 자원 한도 강제 |
| `SheetAnchorScanner` | 라벨·헤더 앵커 스캔 + 병합셀 해석 (어댑터 3종 공용) |
| `FormSheetAdapter` | 인터페이스. POI `Sheet` → 도메인 명령 |
| `CapitalProjectFormAdapter` | **1-1 + 1-2를 함께** 읽어 사업 1건 + 품목 N |
| `RecurringProjectFormAdapter` | ② → `BPROJM`(경상) + `BITEMM` |
| `GeneralExpenseFormAdapter` | ③ → `BCOSTM` |
| `RequestFormValidator` | 진단 생성 |
| `FormLexicon` | 국문·영문 대조표, Y/N 정규화 상수 |
| `AmountUnitResolver` | 1-1↔1-2 대사 배수 역추정, ③ 휴리스틱 |
| `RequestFormDto` | 요청·응답 DTO (`@Schema` `requiredMode` 전량 명시) |

주입해 재사용: `OrgIdentityResolver`, `MigrationIoeCatalogReader`, `MigrationApprovalStamper`, `CostService`, `ProjectService`, `XcrLookupService`.

1-1과 1-2는 같은 사업의 머리와 몸통이므로 어댑터 하나가 두 시트를 함께 읽는다. 시트마다 어댑터를 두면 사업관리번호를 어댑터 사이로 넘겨야 해 경계가 흐려진다.

기존 `MigrationValidator`(761줄)는 확장하지 않는다. 시트 종류별 분기가 이미 크고, 반영 정책(전량 원자 ↔ 파일 단위 원자)도 다르다. 기존 `SheetAdapter`·`AdapterContext`도 "정규화된 행 목록"을 전제하므로 폼 레이아웃과 맞지 않는다.

### 6.2 서버가 파일을 받으면서 새로 필요한 방어

기존 이관은 프론트에서 파싱해 JSON만 받았으므로 아래는 전부 신규다.

- `spring.servlet.multipart.max-file-size`·`max-request-size` 명시 (배치 20파일 기준)
- POI `ZipSecureFile.setMinInflateRatio()` — `.xlsx` zip bomb 차단
- `IOUtils.setByteArrayMaxOverride()` — 거대 레코드 할당 차단
- 시트 수·행 수 상한 (§2.1의 6만 5천 행 사례)
- 확장자 + 매직바이트 검사 (`D0CF11E0`=xls, `504B0304`=xlsx). 불일치는 `FILE_UNREADABLE`
- 업로드 파일을 **디스크에 영구 저장하지 않는다.** 처리 후 즉시 폐기하며 저장 경로를 만들지 않는다
- `X-Requested-With`는 `$apiFetch`가 자동 부착한다. multipart는 CORS 안전 목록이라 `SimpleRequestCsrfFilter`가 이 헤더를 요구한다 — 원시 `$fetch`로 보내면 403이다

### 6.3 프론트

| 파일 | 책임 |
| --- | --- |
| `app/pages/admin/migration/requests.vue` | `definePageMeta({ middleware: 'admin' })`. 라우팅·조합만 |
| `app/composables/migration/useRequestFormPage.ts` | 화면 상태 파사드 |
| `app/composables/migration/useRequestFormUpload.ts` | 폴더 선택·배치 분할·진행률·dry-run/commit |
| `app/components/migration/RequestFormFolderPicker.vue` | `webkitdirectory` 입력 + 폴더별 부서 확인 |
| `app/components/migration/RequestFormResultTable.vue` | 파일별 진단·보정 (`StyledDataTable`) |

파일마다 `MAX_NEW_FILE_LINES`(800줄) 상한을 지킨다. 경계 고정 테스트 2종(`tests/unit/architecture/component-boundaries.test.ts`, `tests/unit/pages/*PageBoundary.test.ts`)을 함께 갱신한다.

수백 파일을 한 표에 다 펼치면 쓸 수 없다. **파일 단위 행 + 진단 있는 파일만 펼침**으로 두고 정상 파일은 접힌 요약 행으로 둔다. 보정은 부서 폴더 단위(비목·단위·사업코드)로 한 번에 적용한다.

## 7. 오류 처리

배치 전송이 네트워크로 실패하면 그 배치만 재시도한다. commit은 멱등하지 않지만 §5.4의 자연키 `DUPLICATE_EXISTS`가 방어벽이라, 이미 반영된 파일을 다시 보내도 중복 생성 없이 걸러진다. 재시도를 안전하게 만드는 것이 그 규칙의 두 번째 목적이다.

dry-run·commit 실패는 `formatApiError` 문구로 `TOAST_LIFE` Toast와 화면 배너에 남긴다. `console.error`만 남기고 끝내지 않는다. 이 화면은 목록 조회가 아니므로 `useRefreshGuard`는 쓰지 않는다.

commit 결과는 파일별 성공/실패와 생성된 관리번호다. 수백 건이면 화면 스크롤로 못 쫓아가므로 결과를 CSV로 내려받게 한다(`utils/excel.ts` 헬퍼 재사용).

## 8. 테스트

| 계층 | 대상 |
| --- | --- |
| 백엔드 단위 | 어댑터 3종 매핑 / `SheetAnchorScanner`(행 삽입·삭제 변형) / `FormLexicon`(영문 어휘, Y/N 4종 — `Ⅹ`(U+2169)·`√` 포함) / `AmountUnitResolver` 배수 역추정 / 진단 카탈로그 전건 |
| 백엔드 슬라이스 | 비관리자 403, `consumes`, 용량 초과 거부, 매직바이트 불일치 거부 |
| 백엔드 통합 `@Tag("it")` | 실 Oracle에 3파일 commit → 행 수·금액·결재상태 / **1파일 BLOCKER 시 그 파일만 롤백되고 나머지는 커밋**(`REQUIRES_NEW` 검증) / 재업로드 `DUPLICATE_EXISTS` |
| OpenAPI 계약 | `RequestFormOpenApiContractTest` — `requiredMode`·`nullable`·`allowableValues` 고정 |
| 프론트 단위 | 배치 분할, `webkitRelativePath`→부서 추출, 보정값 병합 |
| 프론트 E2E | 관리자 로그인 → 폴더 업로드 → 진단 표시 → 보정 → 반영 → 결과 확인 |
| 계약 드리프트 | 백엔드 기동 후 `npm run codegen`, `npm run codegen:check` |

**픽스처**: `C:\it\sample`의 3건은 실명 담당자·실제 예산액이 든 실 업무 데이터이며 git 미추적이다. 저장소에 커밋하지 않는다. 대신 같은 양식 구조를 유지하되 이름·금액을 익명화한 축소본을 `.xls`·`.xlsx` 각 1개씩 만들어 테스트 리소스로 커밋한다 — 양식 구조 자체가 테스트 대상이라 POI로 생성한 합성 워크북으로는 "행이 밀린 실제 변형"을 재현하지 못한다. 실물 검증은 로컬에서만 한다.

## 9. 선행 조치

기능 커밋과 분리해 먼저 반영한다.

1. **Apache POI 폐쇄망 반입 신청** — `poi`, `poi-ooxml`, `poi-ooxml-lite`, `xmlbeans`, `commons-collections4`, `commons-math3`, `SparseBitSet`, `curvesapi`, `log4j-api`. `commons-compress-1.27.1`은 이미 있다. **이것 없이는 착수 불가**다. 반입이 지연되면 `.xlsx`만 프론트 `exceljs`로 먼저 여는 축소 경로가 폴백이다.
2. `it_database/migrations/V20260813_001__SeedRequestFormMigrationMenu.sql` — `/admin/migration/requests` `PGE` 메뉴 시드

## 10. 결정 요약

| 항목 | 결정 |
| --- | --- |
| 모듈 | `domain.migration.request` 서브패키지. 기존 `/admin/migration` 무수정 |
| 파싱 | 백엔드 Apache POI (`.xls`·`.xlsx` 모두). 기존 경로는 프론트 `exceljs` 유지 |
| 입력 | `webkitdirectory` 폴더 업로드, 20개씩 배치 multipart |
| 부서 귀속 | 최상위 폴더명 → `OrgIdentityResolver`. 1-1 폼 값이 있으면 폼 우선 |
| 반영 단위 | 파일 1개 = 트랜잭션 1개(`REQUIRES_NEW`). 정상 파일만 반영 |
| 반영 범위 | 원장(`BPROJM`·`BITEMM`·`BCOSTM`) + 이관 결재완료 받이. **`BBUGTM` 미생성** |
| 셀 접근 | 고정 좌표 금지. 라벨·헤더 앵커 스캔 |
| 금액 | 1-2가 원본(원 단위). 1-1 요약표는 대사 검증용. ③은 미리보기에서 단위 지정 |
| 공란 8항목 | null 반입 + `OPTIONAL_MISSING` 경고 |
| 영문 양식 | `FormLexicon` 대조표 내장. 미식별 어휘는 `CODE_UNRESOLVED`로 보정 |
| 재업로드 | 자연키 중복 거부 (배치 재전송 안전장치 겸용) |
| 업로드 파일 | 디스크 영구 저장 없음 |
| dry-run 결과 | 서버 미보관. commit 시 재전송 + 전량 재검증 |
