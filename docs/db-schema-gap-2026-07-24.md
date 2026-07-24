# 운영·로컬 DB Gap 분석 결과 (2026-07-24)

## 1. 비교 기준

- 운영 기준: `C:\it\meta\table.txt` (2026-07-24 20:12 갱신본, 작업트리 수정 상태)
- 로컬 기준: `C:\it\it_database\ITPOWN_DDL_live.sql` (2026-07-22 13:47 `DBMS_METADATA` 스냅샷)
- 제외 테이블: `FLYWAY_SCHEMA_HISTORY`
- 비교 항목: 테이블명 / 테이블 코멘트 / 컬럼명 / 컬럼 타입·길이·소수점 / 컬럼 순서 / 컬럼 코멘트 / PK / NULL 제약 / 기본값

> 로컬 기준 파일이 운영 추출본보다 이틀 앞선 스냅샷입니다. 스냅샷 이후 로컬 DB에 직접 DDL을 적용했다면
> 실제 로컬 DB와 결과가 달라질 수 있으므로, 조치 전 `ITPOWN_DDL_live.sql` 재추출을 권장합니다.

## 2. 요약

| 항목 | 결과 |
| --- | ---: |
| 업무 테이블 | 로컬 88 / 운영 88 |
| 업무 컬럼 | 로컬 1,604 / 운영 1,606 |
| 테이블명 Gap | **0건** |
| 테이블 코멘트 Gap | **1건** |
| 운영 전용 컬럼 | **2건** |
| 로컬 전용 컬럼 | 0건 |
| 컬럼 타입·길이·소수점 Gap | **0건** |
| 컬럼 코멘트 Gap | **0건** |
| 컬럼 순서 Gap (공통 컬럼 상대 순서) | 0건 |
| 컬럼 순서 Gap (절대 `COLUMN_ID`) | **25건** (2개 테이블, 위 컬럼 누락에 따른 밀림) |
| PK 구성 Gap | **1건** |
| NULL 제약 Gap | **22건** |
| 기본값 Gap (유효 기본값 기준) | **2건** |
| `DEFAULT NULL` 표기 차이 (동작 동일) | 32건 |

2026-07-20 정렬 시점에는 Gap 0건이었으나, 이후 운영 추출본이 갱신되면서 다시 차이가 발생했습니다.

## 3. 상세 Gap

### 3.1 테이블명 — Gap 없음

운영·로컬 모두 88개 업무 테이블로 일치합니다. 어느 한쪽에만 존재하는 테이블은 없습니다.

### 3.2 테이블 코멘트 — 1건

| 테이블 | 운영 | 로컬 |
| --- | --- | --- |
| `TPRMPP_BBIZCL` | `프로젝트관리_사업계약기본변경로그` | `프로젝트관리_사업계약기본 변경 로그` |

공백 유무만 다릅니다. 운영 표기(공백 없음)가 나머지 87개 `*L` 테이블 코멘트 규칙과 일치합니다.

### 3.3 운영 전용 컬럼 — 2건

| 테이블 | 컬럼 | 운영 순서 | 타입 | 코멘트 |
| --- | --- | ---: | --- | --- |
| `TPRMPP_BESTTM` | `IPM_OPNN_SNO` | 3 | `NUMBER(9)` | 개선의견일련번호 |
| `TPRMPP_BESTTL` | `IPM_OPNN_SNO` | 4 | `NUMBER(9)` | 개선의견일련번호 |

로컬 전용 컬럼은 없습니다. 컬럼 수 차이 2건은 전부 이 항목입니다.

### 3.4 PK 구성 — 1건

| 테이블 | 운영 PK | 로컬 PK |
| --- | --- | --- |
| `TPRMPP_BESTTM` | `RQM_BG_REQ_DOC_NO`, `DOC_VRS_SNO`, `IPM_OPNN_SNO` | `RQM_BG_REQ_DOC_NO`, `DOC_VRS_SNO` |

운영에서 `IPM_OPNN_SNO`가 PK 3번째 컬럼으로 추가되었습니다. 3.3과 동일 원인이며,
같은 요청서·버전에 개선의견을 여러 건 보관할 수 있도록 카디널리티가 1:N으로 확장된 변경입니다.

### 3.5 컬럼 타입 / 길이 / 소수점 — Gap 없음

공통 1,604개 컬럼 전수에서 `데이터타입 | 길이(정밀도) | 소수점` 조합이 모두 일치합니다.
`VARCHAR2`, `NUMBER`, `DATE`, `CLOB` 4종 모두 차이 없습니다.

### 3.6 컬럼 코멘트 — Gap 없음

공통 1,604개 컬럼 코멘트가 전수 일치합니다.

### 3.7 컬럼 순서 — 2개 테이블 25건

공통 컬럼만의 **상대 순서**는 88개 테이블 전부 일치합니다.
**절대 `COLUMN_ID`** 기준으로는 `TPRMPP_BESTTL` / `TPRMPP_BESTTM` 두 테이블에서만 차이가 있으며,
전부 3.3의 `IPM_OPNN_SNO` 누락으로 뒤 컬럼이 한 칸씩 당겨진 결과입니다.

| 테이블 | 영향 컬럼 수 | 운영 순서 | 로컬 순서 |
| --- | ---: | --- | --- |
| `TPRMPP_BESTTL` | 14 | `SVN_TEM_C` 5 ~ `LST_CHG_DTM` 18 | 4 ~ 17 |
| `TPRMPP_BESTTM` | 11 | `SVN_TEM_C` 4 ~ `LST_CHG_DTM` 14 | 3 ~ 13 |

`IPM_OPNN_SNO`를 운영과 같은 위치에 추가하면 순서 Gap도 함께 해소됩니다.

### 3.8 NULL 제약 — 22건

PK 컬럼은 Oracle에서 암묵적으로 `NOT NULL`이므로 판정에서 제외했습니다.

**운영 `NOT NULL` / 로컬 `NULL` — 20건 (로컬이 느슨함)**

| 테이블 | 컬럼 |
| --- | --- |
| `TPRMPP_BBIZCM`, `TPRMPP_BBIZCL` | `NOW_CTT_MANR_C` |
| `TPRMPP_BCOSTM`, `TPRMPP_BCOSTL` | `ABUS_TC`, `DFR_CLE_C` |
| `TPRMPP_BDELIM`, `TPRMPP_BDELIL` | `TASK_DBR_TC`, `TASK_DBR_RLT_TC`, `TASK_DBR_TOD` |
| `TPRMPP_BITEMM`, `TPRMPP_BITEML` | `DFR_CLE_C` |
| `TPRMPP_BPROJM`, `TPRMPP_BPROJL` | `ABUS_TC` |
| `TPRMPP_BTERMM`, `TPRMPP_BTERML` | `DFR_CLE_C` |
| `TPRMPP_CDECIM` | `DCD_TP_C` |
| `TPRMPP_CINFMM` | `INFM_SD_STS_C` |

기본(`*M`) 테이블과 변경로그(`*L`) 테이블이 짝을 이루어 나타납니다.

**운영 `NULL` / 로컬 `NOT NULL` — 2건 (로컬이 엄격함)**

| 테이블 | 컬럼 | 로컬 선언 |
| --- | --- | --- |
| `TPRMPP_CBLBCM` | `XPO_YN` | `VARCHAR2(1 CHAR) DEFAULT NULL NOT NULL ENABLE` |
| `TPRMPP_CBLBCL` | `XPO_YN` | `VARCHAR2(1 CHAR) DEFAULT NULL NOT NULL ENABLE` |

`DEFAULT NULL` + `NOT NULL` 조합이라 값을 생략한 INSERT가 로컬에서만 실패합니다.
운영 기준으로 맞추려면 `NOT NULL`을 해제하고, 유지하려면 `'Y'`/`'N'` 등 유효 기본값을 지정해야 합니다.

### 3.9 기본값 — 2건

| 테이블 | 컬럼 | 운영 | 로컬 |
| --- | --- | --- | --- |
| `TPRMPP_CDECIM` | `DCD_TP_C` | `'10'` (+ `NOT NULL`) | 기본값 없음, `NULL` 허용 |
| `TPRMPP_CINFMM` | `INFM_SD_STS_C` | `'10'` (+ `NOT NULL`) | `DEFAULT NULL`, `NULL` 허용 |

두 건 모두 3.8의 NULL 제약 Gap과 같은 컬럼입니다. 운영에서 상태코드 초기값 `'10'`이 신규 부여되었습니다.
`TPRMPP_CINFMM.INFM_SD_STS_C`는 인덱스 `IX_TPRMPP_CINFMM_01`의 선두 컬럼이므로
알림 발송 배치 조회 조건과 함께 확인이 필요합니다.

### 3.10 동작상 동일한 표기 차이 — 32건 (조치 불필요)

로컬에만 `DEFAULT NULL`이 명시된 컬럼이 32개 있습니다. Oracle에서 `DEFAULT NULL`은 기본값 미지정과
동작이 같아 Gap으로 집계하지 않았습니다. 과거 기본값을 제거한 컬럼에 남는 데이터 사전 이력입니다.

`BCONTM.LST_YN`, `BDELIM.LST_YN`/`TASK_DBR_OMT_YN`, `BESTIM.LST_YN`,
`BITEMM.ITR_INFR_YN`/`SECT_SYS_UTZ_YN`/`LST_YN`, `BPAYMM.LST_YN`, `BPROJM.DPL_YN`/`ODN_YN`,
`CAPPLM.DCD_REQ_DTM`, `CAUTHI.USE_YN`, `CBLBCM` 7개, `CBLBMM` 6개, `CCMMTM` 2개,
`CINFMM.INQ_YN`/`RE_TRY_NOT`, `CMENUD.USE_YN`, `CMENUM.HID_YN`, `CROLEI.USE_YN`

## 4. 이번 비교로 확인할 수 없는 항목

운영 추출본(`table.txt`)에 정보가 없어 판정 대상에서 제외했습니다.

- **문자 길이 semantics (`CHAR` / `BYTE`)** — 운영은 길이 숫자만 제공합니다.
  로컬은 `VARCHAR2` 1,090개 중 799개가 `CHAR`, 291개가 `BYTE` 이며 49개 테이블이 두 방식을 혼용합니다.
  멀티바이트 데이터 저장 한계가 달라질 수 있어 별도 확인이 필요합니다.
- **인덱스, FK, CHECK 제약, UNIQUE 제약** — 운영은 PK 여부만 제공합니다.
  로컬에는 `CK_*_DEL_YN` 계열 CHECK 제약과 `IX_*` 인덱스가 다수 존재합니다.
- **시퀀스, 뷰, 트리거** — 운영 추출본에 없습니다. 로컬에는 시퀀스·뷰가 정의되어 있습니다.
- **가상 컬럼 / INVISIBLE 컬럼** — 로컬에는 0건이며 운영 여부는 확인 불가입니다.

## 5. 권고 조치

운영 기준으로 로컬을 정렬할 경우 필요한 변경은 다음 4가지입니다.

1. `TPRMPP_BESTTM` / `TPRMPP_BESTTL`에 `IPM_OPNN_SNO NUMBER(9)` 추가 + 컬럼 순서 정렬 + 코멘트 부여
2. `TPRMPP_BESTTM` PK를 `(RQM_BG_REQ_DOC_NO, DOC_VRS_SNO, IPM_OPNN_SNO)`로 재생성
   — 기존 행에 `IPM_OPNN_SNO` 값 채움(예: `1`)이 선행되어야 합니다.
3. NULL 제약 22건 정렬 — 20건은 `NOT NULL` 부여(기존 NULL 데이터 선점검 필요), `XPO_YN` 2건은 제약 해제
4. `CDECIM.DCD_TP_C`, `CINFMM.INFM_SD_STS_C`에 `DEFAULT '10' NOT NULL` 적용,
   `TPRMPP_BBIZCL` 테이블 코멘트를 `프로젝트관리_사업계약기본변경로그`로 수정

적용 시 `it_database/migrations/V20260724_0NN__*.sql` 신규 스크립트로 작성합니다
(적용 완료된 기존 스크립트는 Flyway 체크섬 대상이므로 수정 금지).

## 6. 정렬 후 재검증 (2026-07-24)

적용 스크립트: `it_database/migrations/V20260724_001__AddBesttImprovementOpinionSno.sql`,
`it_database/migrations/V20260724_002__AlignConstraintsWithProduction.sql`

- 운영 기준: `C:\it\meta\table.txt` (변경 없음, 1,607행 = 헤더 1 + 데이터 1,606)
- 로컬 기준: `it_database/ITPOWN_DDL_live.sql` 재추출본 (Generated at: 2026-07-24 23:13:57 +09:00,
  `pwsh -File C:/it/it_database/export-ddl-live.ps1` 인자 없이 실행)
- 비교 스크립트: PowerShell로 신규 작성한 파서 겸 비교기(리포지토리 외부 스크래치 경로에 보관, 커밋 대상 아님).
  `table.txt`를 테이블/컬럼 순서 그대로 파싱하고, `ITPOWN_DDL_live.sql`의 `CREATE TABLE` 블록과
  `COMMENT ON TABLE|COLUMN` 절을 정규식으로 파싱해 테이블 단위로 대조했습니다.
- 판정 규칙은 원 분석과 동일하게 적용: PK 컬럼은 NULL 제약 비교에서 제외, 로컬의 `DEFAULT NULL`은
  기본값 없음과 동일하게 정규화하여 비교(Gap 미집계).

| 항목 | 결과 |
| --- | ---: |
| 업무 테이블 | 로컬 88 / 운영 88 |
| 업무 컬럼 | 로컬 1,606 / 운영 1,606 |
| 운영 전용 / 로컬 전용 컬럼 | 0 / 0 |
| 테이블·컬럼 구성, 순서, 타입·길이·소수점, PK, NULL, 유효 기본값 Gap | 0건 |
| 테이블·컬럼 코멘트 Gap | 0건 |

`DEFAULT NULL` 표기(동작 동일, Gap 미집계)는 로컬에 32개 컬럼 그대로 남아 있어 최초 분석의 수치와 일치합니다.

주요 항목별 재확인 결과(재추출본 diff 및 개별 조회로 교차 확인):
- `TPRMPP_BESTTM`/`TPRMPP_BESTTL`에 `IPM_OPNN_SNO NUMBER(9,0)`가 운영과 동일한 위치(3번째/4번째 컬럼)에 추가되고,
  `PK_BESTTM`이 `(RQM_BG_REQ_DOC_NO, DOC_VRS_SNO, IPM_OPNN_SNO)` 3컬럼으로 재생성되었습니다.
- NULL 제약 20건(`BBIZCM/L.NOW_CTT_MANR_C`, `BCOSTM/L.ABUS_TC`/`DFR_CLE_C`, `BDELIM/L.TASK_DBR_TC`/`TASK_DBR_RLT_TC`/`TASK_DBR_TOD`,
  `BITEMM/L.DFR_CLE_C`, `BPROJM/L.ABUS_TC`, `BTERMM/L.DFR_CLE_C`, `CDECIM.DCD_TP_C`, `CINFMM.INFM_SD_STS_C`)가 모두
  운영과 동일하게 `NOT NULL`로 전환되었습니다.
- `TPRMPP_CBLBCM`/`TPRMPP_CBLBCL`의 `XPO_YN`은 `NOT NULL`이 해제되어 운영과 동일하게 nullable입니다.
- `TPRMPP_CDECIM.DCD_TP_C`, `TPRMPP_CINFMM.INFM_SD_STS_C`에 `DEFAULT '10' NOT NULL`이 적용되었습니다.
- `TPRMPP_BBIZCL` 테이블 코멘트가 `프로젝트관리_사업계약기본변경로그`(공백 없음)로 운영과 일치합니다.

함께 해소한 애플리케이션 측 불일치:
- `Besttm` 엔티티 복합키를 운영 PK(문서번호+버전+개선의견일련번호)로 정렬. 기존 4컬럼 `@Id`는 물리 PK와
  달라 명세 2행 이상 저장 시 `ORA-00001`이 발생하는 잠복 버그였다.
- `OPNN_CONE`(1000→6000), `BitemmL`/`BtermmL.DFR_CLE_C`(3→1), `BprojmL.ABUS_TC`(32→2) 매핑 길이 정정.
- NOT NULL 전환 대상 코드 컬럼의 빈 문자열 저장 경로를 `CodeDefaults.orNotApplicable`로 차단.

### 6.1 검증 스택 실행 결과 (2026-07-24)

- `cd it_backend && ./gradlew test` — 전체 통과는 아닙니다. `FrontendUrlPropertyResolutionTest`에서
  4개 테스트가 실패했습니다. 이 테스트는 Spring `StandardEnvironment`가 OS 환경변수를 그대로 읽어오는데,
  현재 로컬 머신에 `APP_FRONTEND_URL`/`CORS_ALLOWED_ORIGINS`가 실제로 설정되어 있어 "미설정" 전제의 단언이
  성립하지 않는 **이 프로젝트 이전부터 존재한 환경 의존 실패**입니다. 이 4건을 제외한 나머지는 전부 통과했습니다.
- `cd it_frontend && npm run check && npm test` — `npm run check`는 통과했고 `budget/status.vue`의
  기존 ESLint 경고 3건(이 작업 범위 밖)만 남아 있습니다. `npm test`는 128개 파일 / 1,645개 테스트 전부 통과했습니다.

결론: Gap 재검증은 9개 항목 전부 기대치(0건)와 일치했습니다. 검증 스택은 알려진 환경 의존 실패(백엔드 4건)를
제외하면 전부 통과했습니다.
