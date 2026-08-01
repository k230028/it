# 운영·로컬 DB Gap 분석 결과 (2026-08-01)

## 1. 비교 기준

- 운영 기준: `C:\it\meta\table.txt` (1,607행 = 헤더 1 + 데이터 1,606, 커밋 `2dc4f44` 2026-07-31)
- 로컬 기준: `C:\it\it_database\ITPOWN_DDL_live.sql`
  (`Generated at: 2026-07-31 20:20:24 +09:00` `DBMS_METADATA` 스냅샷, 커밋 `7b17257` 2026-07-31)
- 제외 테이블: `FLYWAY_SCHEMA_HISTORY`
- 비교 항목: 테이블명 / 테이블 코멘트 / 컬럼명 / 컬럼 타입·길이·소수점 / 컬럼 순서 / 컬럼 코멘트 / PK / NULL 제약 / 기본값

양쪽 기준 파일 모두 2026-07-31 커밋본이고 작업트리가 깨끗하므로, 이전 회차와 달리 스냅샷 시점 차이로 인한
왜곡은 없습니다.

판정 규칙(2026-07-24 회차와 동일하게 유지):

- PK 컬럼은 Oracle에서 암묵적 `NOT NULL`이므로 NULL 제약 비교에서 제외합니다.
- 로컬의 `DEFAULT NULL`은 기본값 미지정과 동작이 같으므로 정규화하여 Gap으로 집계하지 않습니다.
- `VARCHAR2` 길이는 숫자만 비교합니다. 운영 추출본에 `CHAR`/`BYTE` semantics 정보가 없기 때문입니다(4장 참조).
- `NUMBER`의 운영 길이 `22`는 정밀도 미지정 `NUMBER`로 정규화합니다.

비교 스크립트는 `table.txt`를 테이블·컬럼 순서 그대로 파싱하고, `ITPOWN_DDL_live.sql`의 `CREATE TABLE` 블록과
`COMMENT ON TABLE|COLUMN` 절을 정규식으로 파싱해 테이블 단위로 대조하는 일회성 파서입니다
(리포지토리 외부 스크래치 경로, 커밋 대상 아님). 이전 회차에서 확정된 수치
(`VARCHAR2` 1,090개 중 `CHAR` 799 / `BYTE` 291, 혼용 테이블 49개, `DEFAULT NULL` 32개 컬럼)를
그대로 재현하는 것을 확인해 파서 정확성을 교차 검증했습니다.

## 2. 요약

`조치 전`은 최초 분석 시점(로컬 DDL `2026-07-31 20:20:24` 스냅샷),
`현재`는 마이그레이션 적용 후 재추출본(`2026-08-01 20:25:14`) 기준입니다.

| 항목 | 조치 전 | 현재 |
| --- | ---: | ---: |
| 업무 테이블 | 로컬 88 / 운영 88 | 로컬 88 / 운영 88 |
| 업무 컬럼 | 로컬 1,607 / 운영 1,606 | 로컬 1,607 / 운영 1,606 |
| 테이블명 Gap | 0건 | 0건 |
| 테이블 코멘트 Gap | 0건 | 0건 |
| 운영 전용 컬럼 | 0건 | 0건 |
| 로컬 전용 컬럼 | **1건** | **1건** (운영 반영 대기) |
| 컬럼 타입·길이·소수점 Gap | 0건 | 0건 |
| 컬럼 코멘트 Gap | 0건 | 0건 |
| 컬럼 순서 Gap (공통 컬럼 상대 순서) | 0건 | 0건 |
| 컬럼 순서 Gap (절대 `COLUMN_ID`) | 0건 | 0건 |
| PK 구성 Gap | 0건 | 0건 |
| NULL 제약 Gap | 2건 | **0건** (해소) |
| 기본값 Gap (유효 기본값 기준) | 0건 | 0건 |
| `DEFAULT NULL` 표기 차이 (동작 동일) | 32건 | 32건 |

2026-07-24 정렬 시점의 Gap 0건 상태에서, 이후 로컬에 적용된 기능 변경 1건과 운영 추출본 갱신 1건으로
총 2개 항목이 새로 발생했습니다. **두 건은 방향이 서로 달랐습니다** — 하나는 로컬이 운영보다 앞서 있고,
하나는 로컬이 운영보다 느슨했습니다.

이 중 `KPN_TP_TC` NULL 제약 2건은 마이그레이션을 적용해 해소했습니다(재검증 상세는 6장).
**현재 남은 Gap은 `APG_FL_SZ` 1건뿐이며, 운영 측 DDL 반영 대상입니다.**

아래 3장은 조치 전 시점의 분석 내용을 그대로 보존합니다.

## 3. 상세 Gap

### 3.1 테이블명 — Gap 없음

운영·로컬 모두 88개 업무 테이블로 일치합니다. 어느 한쪽에만 존재하는 테이블은 없습니다.

### 3.2 테이블 코멘트 — Gap 없음

88개 테이블 코멘트가 전수 일치합니다. 2026-07-24에 정정한 `TPRMPP_BBIZCL`도 유지되고 있습니다.

### 3.3 로컬 전용 컬럼 — 1건 (로컬이 앞섬)

| 테이블 | 컬럼 | 로컬 순서 | 타입 | 코멘트 | 운영 |
| --- | --- | ---: | --- | --- | --- |
| `TPRMPP_CFILEM` | `APG_FL_SZ` | 15 (마지막) | `NUMBER(10,0)`, `NULL` 허용 | 첨부파일크기 | 없음 |

운영 전용 컬럼은 없습니다. 컬럼 수 차이 1건은 전부 이 항목입니다.

`it_database/migrations/V20260726_001__AddCommonFileSize.sql`로 2026-07-26에 로컬에 추가된 컬럼이며,
**로컬 드리프트가 아니라 운영에 아직 반영되지 않은 신규 기능 변경**입니다. 애플리케이션이 이미 이 컬럼에
의존합니다.

| 참조 위치 | 내용 |
| --- | --- |
| `it_backend/.../infra/file/entity/Cfilem.java:69` | `@Column(name = "APG_FL_SZ", precision = 10)` 매핑 |
| `it_backend/.../infra/file/dto/FileDto.java:89` | 응답 DTO 필드 `apgFlSz` |
| `it_backend/.../infra/file/service/FileUploadUnitService.java:89` | 업로드 시 `file.getSize()` 저장 |
| `it_backend/.../infra/file/service/FileService.java:96` | 조회 응답에 크기 노출 |

따라서 이 컬럼 없이 백엔드를 운영에 배포하면 `TPRMPP_CFILEM` 접근 시점에 매핑 오류가 발생합니다.
**배포 선행 조건**으로 취급해야 합니다.

컬럼 위치가 감사 컬럼(`FST_ENR_*` ~ `LST_CHG_DTM`) 뒤 마지막인 점은 `ALTER TABLE ... ADD`의 결과입니다.
운영 반영 시에도 동일하게 마지막에 추가하면 순서 Gap이 발생하지 않습니다.

### 3.4 NULL 제약 — 2건 (로컬이 느슨함)

PK 컬럼은 판정에서 제외했습니다.

| 테이블 | 컬럼 | 코멘트 | 운영 | 로컬 |
| --- | --- | --- | --- | --- |
| `TPRMPP_BPOVWM` | `KPN_TP_TC` | 저장유형구분코드 | `NOT NULL` (기본값 없음) | `NULL` 허용 |
| `TPRMPP_BPOVWL` | `KPN_TP_TC` | 저장유형구분코드 | `NOT NULL` (기본값 없음) | `NULL` 허용 |

기본(`*M`) 테이블과 변경로그(`*L`) 테이블이 짝을 이루는 기존 패턴과 동일합니다.
타입은 양쪽 모두 `VARCHAR2(2)`로 일치하며 차이는 NULL 제약뿐입니다.

운영에 기본값이 없는 `NOT NULL`이므로, **이 컬럼을 생략한 INSERT는 로컬에서만 성공하고 운영에서는
`ORA-01400`으로 실패합니다.** 로컬 테스트를 통과한 코드가 운영에서만 깨지는 유형의 잠복 위험입니다.

현재 쓰기 경로는 안전한 편입니다. `CouncilDto.FeasibilityRequest.kpnTc`가 `@NotBlank`이고
(`it_backend/.../domain/council/dto/CouncilDto.java:238`), `FeasibilityService`가 이 값을 그대로
`Bpovwm.kpnTpTc`에 넣습니다(`FeasibilityService.java:185`). 변경로그 `BpovwmL`은 기본 테이블 값을 복사합니다.
즉 신규 행은 항상 값이 채워집니다. 다만 **로컬에 이미 쌓인 기존 행 중 `KPN_TP_TC IS NULL`이 있으면**
제약 추가가 `ORA-02296`으로 실패합니다. 이 선행 backfill은 5.2의 마이그레이션 스크립트에 포함했습니다.

### 3.5 컬럼 타입 / 길이 / 소수점 — Gap 없음

공통 1,606개 컬럼 전수에서 `데이터타입 | 길이(정밀도) | 소수점` 조합이 모두 일치합니다.
`VARCHAR2`, `NUMBER`, `DATE`, `CLOB` 4종 모두 차이 없습니다.

### 3.6 컬럼 코멘트 — Gap 없음

공통 1,606개 컬럼 코멘트가 전수 일치합니다.

### 3.7 컬럼 순서 — Gap 없음

공통 컬럼의 **상대 순서**와 **절대 `COLUMN_ID`** 모두 88개 테이블 전부 일치합니다.
3.3의 `APG_FL_SZ`가 마지막 컬럼이라 뒤 컬럼을 밀지 않기 때문입니다.

### 3.8 PK 구성 — Gap 없음

88개 테이블의 PK 컬럼 구성과 순서가 전수 일치합니다.
2026-07-24에 재생성한 `PK_BESTTM`(`RQM_BG_REQ_DOC_NO`, `DOC_VRS_SNO`, `IPM_OPNN_SNO`)도 유지되고 있습니다.

### 3.9 기본값 — Gap 없음

유효 기본값 기준으로 차이가 없습니다. `TPRMPP_CDECIM.DCD_TP_C`, `TPRMPP_CINFMM.INFM_SD_STS_C`의
`DEFAULT '10'`도 양쪽 일치합니다.

### 3.10 동작상 동일한 표기 차이 — 32건 (조치 불필요·정렬 불가)

로컬에만 `DEFAULT NULL`이 명시된 컬럼이 32개 있습니다. Oracle에서 `DEFAULT NULL`은 기본값 미지정과
동작이 같아 Gap으로 집계하지 않았습니다. 과거 기본값을 제거한 컬럼에 남는 데이터 사전 이력이며,
2026-07-24 회차와 동일한 목록입니다.

**이 표기는 `ALTER TABLE`로 제거할 수 없습니다.** 2026-08-01에 조사한 근거는 다음과 같습니다.

- `MODIFY (컬럼 DEFAULT NULL)`은 `DATA_DEFAULT`에 문자열 `'NULL'`을 기록할 뿐 비우지 못합니다.
  실제로 `V20260720_010__AlignLocalSchemaWithProduction.sql:113-114`가 기본값을 해제할 의도로
  `TPRMPP_CINFMM.RE_TRY_NOT`에 이 구문을 실행했고, 그 컬럼은 지금도 `DEFAULT NULL`로 남아 있습니다.
  즉 이 잔재를 만든 구문 자체입니다.
- `DEFAULT` 절을 생략한 `MODIFY (컬럼 타입)`도 해결책이 아닙니다. Oracle 문서는 "컬럼 정의의 선택적
  부분(데이터타입, 기본값, 제약)을 생략하면 해당 부분은 변경되지 않는다"고 명시합니다.
- Oracle에는 `DROP DEFAULT` 구문이 없습니다. `DATA_DEFAULT`를 실제로 비우려면 테이블 재생성
  (CTAS 후 인덱스·제약·권한·코멘트 재구성) 또는 컬럼 삭제 후 재생성이 필요합니다.
  후자는 컬럼이 맨 뒤로 이동해 **없던 컬럼 순서 Gap을 새로 만들므로** 오히려 해롭습니다.

또한 **운영이 이 잔재를 갖고 있는지 자체를 확인할 수 없습니다.** `table.txt`의 `Default Value` 열에는
`NULL` 표기가 단 한 건도 없어(전 1,606행), 운영 컬럼의 `DATA_DEFAULT`가 비어 있는 경우와
문자열 `'NULL'`인 경우가 모두 공백으로 렌더링됩니다. 두 상태를 구분할 수 없으므로
이 32건은 "운영과 다르다"고 단정할 수도 없습니다.

동작 차이가 0이고, 정렬 수단은 테이블 재생성뿐이며, 대상 상태조차 확인 불가이므로 조치하지 않습니다.

`BCONTM.LST_YN`, `BDELIM.LST_YN`/`TASK_DBR_OMT_YN`, `BESTIM.LST_YN`,
`BITEMM.ITR_INFR_YN`/`SECT_SYS_UTZ_YN`/`LST_YN`, `BPAYMM.LST_YN`, `BPROJM.DPL_YN`/`ODN_YN`,
`CAPPLM.DCD_REQ_DTM`, `CAUTHI.USE_YN`, `CBLBCM` 7개, `CBLBMM` 6개, `CCMMTM` 2개,
`CINFMM.INQ_YN`/`RE_TRY_NOT`, `CMENUD.USE_YN`, `CMENUM.HID_YN`, `CROLEI.USE_YN`

## 4. 이번 비교로 확인할 수 없는 항목

운영 추출본(`table.txt`)에 정보가 없어 판정 대상에서 제외했습니다. 이전 회차와 동일합니다.

- **문자 길이 semantics (`CHAR` / `BYTE`)** — 운영은 길이 숫자만 제공합니다.
  로컬은 `VARCHAR2` 1,090개 중 799개가 `CHAR`, 291개가 `BYTE`이며 49개 테이블이 두 방식을 혼용합니다.
  멀티바이트 데이터 저장 한계가 달라질 수 있어 별도 확인이 필요합니다.
- **인덱스, FK, CHECK 제약, UNIQUE 제약** — 운영은 PK 여부만 제공합니다.
  로컬에는 인덱스 62개와 `CK_*_DEL_YN` 계열 CHECK 제약이 존재합니다.
- **시퀀스, 뷰, 트리거** — 운영 추출본에 없습니다. 로컬에는 시퀀스 61개, 뷰 1개가 정의되어 있습니다.
- **가상 컬럼 / INVISIBLE 컬럼** — 로컬에는 0건이며 운영 여부는 확인 불가입니다.

## 5. 권고 조치

방향이 다른 2건이므로 조치 주체도 다릅니다.

### 5.1 운영 반영 요청 — `TPRMPP_CFILEM.APG_FL_SZ` (배포 선행 조건)

로컬을 되돌리는 것이 아니라 **운영에 컬럼을 추가**해야 합니다. 첨부파일 크기 기능이 이 컬럼에 의존하므로
백엔드 운영 배포 전에 선행되어야 합니다.

```sql
ALTER TABLE TPRMPP_CFILEM ADD (APG_FL_SZ NUMBER(10));
COMMENT ON COLUMN TPRMPP_CFILEM.APG_FL_SZ IS '첨부파일크기';
```

기존 행은 신뢰할 수 있는 원천 크기값이 없으므로 `NULL`로 둡니다
(`V20260726_001__AddCommonFileSize.sql`의 판단과 동일). 반영 후 `meta/table.txt` 재추출이 필요합니다.

### 5.2 로컬 정렬 — `KPN_TP_TC` `NOT NULL` 2건 (적용 완료)

마이그레이션 스크립트: `it_database/migrations/V20260801_001__AlignPovwKpnTpTcNotNull.sql`
(신규 파일 — 적용 완료된 기존 스크립트는 Flyway 체크섬 대상이므로 수정하지 않았습니다).

**2026-08-01 로컬에 적용 완료**했습니다(재검증 결과는 6장). `dev`/`prod`는
`spring.flyway.enabled=false`이므로 DBA가 별도 적용합니다.

스크립트 구성:

1. **backfill** — `KPN_TP_TC IS NULL`인 행을 `'10'`(임시저장)으로 채운 뒤 `COMMIT`.
2. **제약 적용** — `ALL_TAB_COLUMNS.NULLABLE`을 확인해 `'Y'`인 경우에만 `MODIFY ... NOT NULL`을
   수행하는 PL/SQL 블록. 이미 `NOT NULL`이면 건너뛰므로 재실행에 안전합니다.

`'10'`을 고른 이유는 **현재 동작을 그대로 보존하는 값**이기 때문입니다. 조회 경로가 `KPN_TP_TC`를 가공 없이
응답에 싣고, 화면이 `kpnTc: data.kpnTc || defaults.kpnTc`로 기본값 `'10'`을 적용하므로
(`it_frontend/app/pages/info/council-request/[id].vue:205`, `:164`),
NULL 행은 이미 사용자에게 임시저장으로 보입니다. `'20'`으로 채우면 작성 중인 건이 제출 완료로 잘못
승격되므로 사용하지 않았습니다.

고정 코드값으로 채우는 단일 컬럼 backfill이라 NULL 건수와 무관하게 결과가 항상 올바르므로,
`V20260724_002`의 `NOW_CTT_MANR_C`처럼 `RAISE_APPLICATION_ERROR` 가드를 두지는 않았습니다.
같은 스크립트의 선례에 따라 변경로그 테이블(`BPOVWL`)도 기본 테이블과 동일하게 처리합니다.

운영에 `DEFAULT`가 없으므로 로컬에도 기본값을 부여하지 않고 NULL 제약만 맞춥니다.

애플리케이션 측 추가 변경은 필요하지 않습니다. 요청 DTO의 `@NotBlank`와 서비스 저장 경로가 이미 값을
보장하므로, 제약 추가로 새로 실패하는 정상 경로는 없습니다.

### 5.3 조치 현황 및 재검증

| 항목 | 조치 | 상태 |
| --- | --- | --- |
| 5.1 `APG_FL_SZ` | 운영 DDL 반영 요청 | 미착수 (운영 측 작업) |
| 5.2 `KPN_TP_TC` | `V20260801_001__AlignPovwKpnTpTcNotNull.sql` | **적용 완료** (6장 재검증) |

5.1이 운영에 반영되면 9개 비교 항목 전부 Gap 0건이 됩니다. 반영 후 `meta/table.txt`를 재추출해
본 문서 기준으로 재검증하는 것을 권장합니다.

## 6. 정렬 후 재검증 (2026-08-01)

적용 스크립트: `it_database/migrations/V20260801_001__AlignPovwKpnTpTcNotNull.sql`

- 운영 기준: `C:\it\meta\table.txt` (변경 없음, 1,607행 = 헤더 1 + 데이터 1,606)
- 로컬 기준: `it_database/ITPOWN_DDL_live.sql` 재추출본
  (`Generated at: 2026-08-01 20:25:14 +09:00`, `pwsh -File C:/it/it_database/export-ddl-live.ps1`)
- 비교 도구·판정 규칙은 1장과 동일하게 적용했습니다.

| 항목 | 결과 |
| --- | ---: |
| 업무 테이블 | 로컬 88 / 운영 88 |
| 업무 컬럼 | 로컬 1,607 / 운영 1,606 |
| 테이블명·테이블 코멘트 Gap | 0건 |
| 운영 전용 컬럼 | 0건 |
| 로컬 전용 컬럼 | **1건** (`APG_FL_SZ` — 5.1 미착수분) |
| 컬럼 타입·길이·소수점 Gap | 0건 |
| 컬럼 코멘트 Gap | 0건 |
| 컬럼 순서 Gap (상대·절대 모두) | 0건 |
| PK 구성 Gap | 0건 |
| **NULL 제약 Gap** | **0건** (2건 → 0건 해소) |
| 기본값 Gap (유효 기본값 기준) | 0건 |

`DEFAULT NULL` 표기(동작 동일, Gap 미집계)는 32개 컬럼 그대로입니다.

재추출본 diff로 교차 확인한 결과:

- `TPRMPP_BPOVWM`/`TPRMPP_BPOVWL`의 `KPN_TP_TC`가 모두
  `VARCHAR2(2 CHAR) ... NOT NULL ENABLE`로 전환되어 운영과 일치합니다.
- 의도한 2줄 외의 스키마 변경은 없습니다. diff의 나머지 항목은 시퀀스 7개
  (`SQ_TPRMPP_BGDOCL_1`, `BGDOCM_1`, `CBLBCL_1`, `CLOGNH_1`, `CMENUL_1`, `CRTOKM_1`)의
  `START WITH` 값 증가로, 애플리케이션 사용에 따른 카운터 진행이며 스키마 차이가 아닙니다.
- `TPRMPP_CFILEM.APG_FL_SZ`는 `NUMBER(10,0)`, 15번째(마지막) 컬럼, 코멘트 `첨부파일크기`로
  변동 없이 유지됩니다. 운영 반영 대기 상태입니다.

남은 Gap은 5.1(`APG_FL_SZ` 운영 반영) 1건뿐이며, 이는 운영 측 DDL 작업 대상입니다.

### 6.1 재추출 시 주의사항

기존 `export-ddl-live.ps1`은 **DB 접속 전에 기존 `ITPOWN_DDL_live.sql`을 먼저 삭제**했습니다.
접속에 실패하면 새 파일이 생성되지 않은 채 기존 파일만 사라지는 구조였고, 이번 재검증 과정에서
`ORA-01017`로 1차 시도가 실패해 실제로 파일이 삭제됐습니다.
커밋본에서 `git checkout -- ITPOWN_DDL_live.sql`로 복구한 뒤 재시도해 위 결과를 얻었습니다.

**이 결함은 수정했습니다.** 이제 추출 결과를 대상 파일과 같은 디렉터리의 임시 파일
(`ITPOWN_DDL_live.sql.tmp-<GUID>`)에 spool하고, Oracle 클라이언트 종료 코드가 0이며 산출물이 실제로
생성된 것을 확인한 뒤에만 `Move-Item`으로 교체합니다. 실패하면 기존 파일은 그대로 남고 임시 파일은
`finally`에서 정리되며, 예외 메시지가 교체하지 않았음을 알립니다.

검증 결과:

- 접속 실패(종료 코드 1) 재현 시 기존 파일의 SHA-256이 변하지 않고 임시 파일도 남지 않음
- 정상 추출 시 파일 교체와 UTF-8 BOM 부여가 종전대로 동작
- `scripts/verify-sec11-powershell.ps1` 통과 (prompt·wallet 4개 시나리오, 저장소 DDL 해시 불변)
