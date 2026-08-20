# 운영·로컬 DB Gap 분석 결과 (2026-08-20)

## 1. 비교 기준

- 운영 테이블 기준: `C:\it\meta\table.txt`
  (1,680행 = 헤더 1 + 컬럼 1,679. 커밋 `e853680`, 작업트리 클린)
- 운영 시퀀스 기준: `C:\it\meta\sequence.txt`
  (63행 = 헤더 1 + 시퀀스 62. 커밋 `e853680`. **파일 형식이 이번 회차에 교체되었습니다** — 1.3)
- 로컬 기준: `C:\it\it_database\ITPOWN_DDL_live.sql`
  (`Generated at: 2026-08-20 19:12:34 +09:00` `DBMS_METADATA` 스냅샷, 커밋 `b21bf8a`,
  `it_database` 작업트리 클린)
- 제외 테이블: `FLYWAY_SCHEMA_HISTORY`
- 비교 항목: 시퀀스명 / 시퀀스 `MAX VALUE`·`MIN VALUE`·`INCREMENT`·`CYCLE`·**`CACHE`·`ORDER`·현재값** /
  테이블명 / 테이블 코멘트 / 컬럼명 / 컬럼 타입·길이·소수점 / 컬럼 순서 / 컬럼 코멘트 / PK / NULL 제약 / 기본값

지시문(`docs/prompts/DB_GAP.md`) 7행은 운영 시퀀스 원본을 `meta/table.txt`로 적고 있으나 `table.txt`에는
시퀀스 정보가 없으므로, 직전 회차들과 같이 **`meta/sequence.txt`를 운영 시퀀스 기준으로 사용**했습니다.

### 1.1 로컬 스냅샷 시점 유효성

로컬 DDL 스냅샷(`2026-08-20 19:12`)은 최신 마이그레이션 `V20260820_004__AddCommonFileRelativePath.sql`
적용 결과(`TPRMPP_CFILEM.APG_FL_PTH`)를 포함하고 있고 `it_database` 작업트리에 미커밋 마이그레이션이
없습니다. 현재 로컬 스키마의 유효한 기준선입니다.
(`V20260820_003__AddScheduleBoardType.sql`은 공통코드·번역 시드만 넣는 데이터 마이그레이션이라
스키마 비교에 영향이 없습니다.)

### 1.2 판정 규칙 (직전 회차 유지)

- PK 컬럼은 Oracle에서 암묵적 `NOT NULL`이므로 NULL 제약 비교에서 제외합니다.
  단, PK 구성이 어긋난 테이블은 이 규칙이 실제 차이를 가리므로 별도로 적었습니다(3.8).
- 로컬의 `DEFAULT NULL`은 기본값 미지정과 동작이 같으므로 정규화하여 Gap으로 집계하지 않습니다(3.12).
- `VARCHAR2` 길이는 숫자만 비교합니다. 운영 추출본에 `CHAR`/`BYTE` semantics 정보가 없기 때문입니다(4장).
- `NUMBER`의 운영 길이 `22`는 정밀도 미지정 `NUMBER`로, 운영의 빈 소수점은 `0`으로 정규화합니다.
- 시퀀스 현재값은 런타임 카운터이므로 스키마 Gap으로 집계하지 않습니다(3.11.4).

### 1.3 운영 시퀀스 기준 파일이 라이브 추출본으로 교체되었습니다 — 이번 회차의 가장 큰 변화

`meta/sequence.txt`는 헤더부터 바뀌었습니다.

| | 직전 (~2026-08-12) | 이번 (2026-08-20) |
| --- | --- | --- |
| 헤더 | `시퀀스(물리명)(*)` … `CYCLE여부` | `Sequence Name` `Value` `Min Value` `Max Value` `Increment` `Cache` `Cycle` `Ordered` |
| 현재값 | `START WITH` 열, 61건 전부 `1` | `Value` 열, `1`/`21`/`41`/`61`/`81`/`101`/`201` 분포 |
| `CACHE` | 열 없음 | 62건 전부 `20` |
| `ORDER` | 열 없음 | 62건 전부 `false` |

**직전 3회차가 "운영 기준 파일은 라이브 DB 추출본이 아니라 표 형식 정의서로 보인다"고 유보해 온 전제가
시퀀스에 한해 해소되었습니다.** 근거는 `Value` 열의 분포입니다 — 값이 전부 `20k+1` 형태이고,
같은 파일의 `Cache`가 전부 `20`입니다. Oracle의 `ALL_SEQUENCES.LAST_NUMBER`는 캐시 단위로 선점되므로
캐시 20인 시퀀스의 `LAST_NUMBER`는 정확히 `1, 21, 41, …`만 나옵니다. **`Cache` 열과 `Value` 열이 서로
독립적으로 같은 사실을 가리키므로 이 파일은 운영 DB 실측값입니다.**

따라서 이번 회차부터 시퀀스 항목은 다음이 달라집니다.

- **`CACHE`·`ORDER`를 처음으로 비교**했습니다(3.11.3). `CACHE`에서 30건 Gap이 새로 드러났습니다.
- `MAX VALUE` 39건은 여전히 **15 유효자리 절삭 표기**입니다. 라이브 추출본에서도 같은 절삭이 나오므로
  **원인이 "정의서라서 값이 다르다"가 아니라 "추출 도구의 수치 포맷"임이 확정**됩니다(3.11.1).
- `CYCLE` 14건은 **운영 DB의 실제 상태**로 확정됩니다. 직전 회차까지 "정의서상 값일 수 있다"고 남겨둔
  여지가 사라졌습니다(3.11.2).

### 1.4 운영 테이블 기준 파일은 여전히 정의서 성격입니다

`meta/table.txt`는 형식·성격 모두 그대로입니다. 정의서 판단 근거도 유지됩니다.

- `Default Value` 열에 `NULL` 표기가 **0건**입니다(`sysdate` 184, `'00000000000000'` 184, `0` 94,
  `'N'` 94, `'000…0'` 92, `'10'` 2, `'Y'` 1, `'LEGACY'` 1). "기본값 없음"과 "기본값 `NULL`"을 구분하지 못합니다.
- 이번에 추가된 운영 전용 컬럼 8개가 **테이블 중간에 삽입**되어 있습니다(3.3). 라이브 DB라면
  `ALTER TABLE ... ADD`의 결과로 마지막에 붙습니다.

따라서 **컬럼 순서는 이번에도 판단을 유보**합니다(3.10). 단 3.2·3.3·3.8은 이 유보의 영향을 받지 않습니다.

### 1.5 파서 검증

비교 도구는 `table.txt`·`sequence.txt`를 원본 순서대로 파싱하고 `ITPOWN_DDL_live.sql`의
`CREATE TABLE` 블록·`CREATE SEQUENCE` 절·`COMMENT ON TABLE|COLUMN` 절을 대조하는 일회성 Node
스크립트입니다(스크래치 경로, 커밋 대상 아님).

**직전 회차(2026-08-18) 입력으로 되돌려 실행해 수치를 재현**했습니다
(`meta` = `c041d21`, DDL = `it_database` `5ff1eb2`).

| 항목 | 직전 리포트 | 재현 | |
| --- | ---: | ---: | --- |
| 테이블 수 (로컬/운영) | 89 / 90 | 89 / 90 | 일치 |
| 컬럼 수 (로컬/운영) | 1,627 / 1,643 | 1,627 / 1,643 | 일치 |
| 시퀀스 수 | 61 / 61 | 61 / 61 | 일치 |
| 운영 전용 테이블 | `TPRMPP_CLANGL` 1건 | 동일 | 일치 |
| 테이블 코멘트 / 컬럼 타입 / 컬럼 코멘트 | 1 / 0 / 3 | 1 / 0 / 3 | 일치 |
| 기본값 / `DEFAULT NULL` | 7 / 32 | 7 / 32 | 일치 |
| 상대 컬럼 순서 | 6테이블 | 6테이블 | 일치 |
| 시퀀스 `MAX VALUE` / `CYCLE` / 현재값 | 39 / 14 / 50 | 39 / 14 / 50 | 일치 |
| `VARCHAR2` `CHAR`/`BYTE`, 혼용 테이블 | 808 / 293, 51 | 808 / 293, 51 | 일치 |
| CHECK 17 / 인덱스 67 / 뷰 1 | — | 17 / 67 / 1 | 일치 |

차이가 난 3항목(`TPRMPP_CLANGM`의 PK 구성·NULL 제약·절대 순서)은 **파서 문제가 아니라 입력 차이**입니다.
직전 리포트는 미커밋 작업트리를 봤고, 그 뒤 커밋 `c041d21`에 리포트 5.4 요청(PK 3컬럼화,
`DTT_LAN_C`·`TC_COL_NM` `NOT NULL`)이 반영된 상태로 기록되었습니다. `db9239f`에는 `TPRMPP_CLANGM`
행 자체가 없었음을 확인했습니다.

**파싱 주의점 2가지** — 6장에도 적었습니다.

1. `DBMS_METADATA`의 `COMMENT ON TABLE ... "  IS '...'`는 테이블명과 `IS` 사이에 **공백 2개**입니다
   (`COMMENT ON COLUMN`은 1개).
2. `CREATE TABLE` 블록을 정규식의 "행 첫 `)`"로 끊으면 **여러 줄 `CHECK` 제약이 있는 테이블에서
   블록이 잘려 PK를 놓칩니다**(`TPRMPP_CLANGM`의 `CK_CLANGM_DTT_COL`). 여는 괄호부터 깊이 0으로
   돌아오는 지점까지 문자 단위로 스캔해야 합니다.

## 2. 요약

| 항목 | 결과 | 성격 |
| --- | ---: | --- |
| 업무 테이블 | 로컬 92 / 운영 92 | **일치 — 직전 회차 1건 해소** |
| 업무 컬럼 | 로컬 1,672 / 운영 1,679 | 차이 7건 |
| 시퀀스 | 로컬 62 / 운영 62 | 일치 |
| 운영 전용 테이블 / 로컬 전용 테이블 | 0건 / 0건 | — |
| **테이블 코멘트 Gap** | **2건** | 1 이월 + **1 신규** — 둘 다 로컬 규약 이탈 |
| **운영 전용 컬럼** | **8건 (`*_NM` 4종)** | **신규 — 방향 결정 필요** |
| **로컬 전용 컬럼** | **1건 (`CFILEM.APG_FL_PTH`)** | **신규 — 운영 등록 요청** |
| 컬럼 타입·길이·소수점 Gap | 0건 | 4장 |
| **컬럼 코멘트 Gap** | **6건** | 3 이월 + **3 신규(`CMFATM`)** |
| PK Gap | 1건 (`CLANGM`) | **구성은 일치, 컬럼 순서만 상이** |
| **NULL 제약 Gap** | **11건 (+PK 규칙에 가려진 4건)** | **전부 신규 등록 4개 테이블** |
| 기본값 Gap | 7건 | 전부 이월 (직전 회차와 동일) |
| 컬럼 순서 Gap (공통 컬럼 상대 순서) | 7테이블 | **2테이블 실질** / 5테이블 판단 유보 |
| 컬럼 순서 Gap (절대 위치) | 193건 / 11테이블 | **9건 실질** / 184건 파생·유보 |
| `DEFAULT NULL` 표기 차이 (동작 동일) | 32건 | 조치 불필요 (3회차 동일 목록) |
| 시퀀스명 / `INCREMENT BY` / `MIN VALUE` / `ORDER` Gap | 0건 | `ORDER`는 이번 회차 신규 비교 |
| 시퀀스 `MAX VALUE` Gap | 39건 | **표기 아티팩트 확정** (1.3) |
| 시퀀스 `CYCLE` Gap | 14건 | **실질 — 3회차 이월, 미조치** |
| **시퀀스 `CACHE` Gap** | **30건** | **신규 — 이번 회차에 처음 비교 가능** |
| 시퀀스 현재값 차이 | 51건 | 런타임 카운터 (미집계) |

### 2.1 직전 회차(2026-08-18) 조치 현황

| 직전 항목 | 상태 |
| --- | --- |
| 5.1 `TPRMPP_CLANGL` 방향 결정 | **해소 — (A) 채택.** `V20260818_001__CreateClangmChangeLog.sql`로 테이블 + `SQ_TPRMPP_CLANGL_1` 생성, 운영 시퀀스 파일에도 등록됨. 단 부수 Gap 3건 발생(3.2·3.10·3.11.1) |
| 5.2 `CLANGM` 테이블 코멘트 로컬 정렬 | 미해소 — 여전히 `구분언어마스터` |
| 5.3 감사 컬럼 배치 순서 규약 문서화 | 미착수 — `data-model.md`·`it_database/CLAUDE.md`·`migrations.md` 어디에도 기록 없음 |
| 5.4 운영 정의서 `CLANGM` PK·NULL 수정 요청 | **부분 해소** — PK 3컬럼화와 `DTT_LAN_C`·`TC_COL_NM` `NOT NULL`은 반영, `TC_DES`·`DTT_NM`은 미반영 |
| 5.5 운영 반영 요청 (기본값 7건) | 미해소 — 운영 측 작업 |
| 5.6 `BPROJM` 금액 코멘트 정의서 비고 | 미해소 |
| 3.9.2 시퀀스 `CYCLE` 14건 로컬 정렬 | 미해소 — 해당 마이그레이션 미작성 확인 |
| 5.7 운영 실측 확인 | **시퀀스에 한해 해소** (1.3). 컬럼 순서·기본값은 여전히 미확인 |

### 2.2 이번 회차 결론

테이블·시퀀스 **집합 자체는 이번 회차에 처음으로 양쪽이 완전히 일치**합니다(92/92, 62/62).
직전 회차의 최우선 과제였던 `TPRMPP_CLANGL` 방향 결정이 로컬 구현으로 종결됐고,
MFA 테이블 2종(`CMFATM`/`CMFADM`)은 운영 등록과 로컬 마이그레이션이 같은 날 함께 이뤄졌습니다.

새로 조치가 필요한 항목은 세 갈래입니다.

1. **운영 전용 컬럼 8건(`*_NM` 이름 스냅샷)** — 로컬 코드·문서·마이그레이션 어디에도 흔적이 없습니다.
   구현할지 정의서에서 뺄지 먼저 정해야 합니다(5.1).
2. **신규 등록 4개 테이블의 NULL 제약 11건** — 운영 정의서가 신규 테이블에서 PK 외 업무 컬럼을 전부
   선택으로 적는 패턴이 `CLANGM`에 이어 `CLANGL`·`CMFATM`·`CMFADM`에서 반복됐습니다(5.4).
3. **시퀀스 `CACHE` 30건** — 이번 회차에 처음 보이게 된 실질 Gap입니다(5.7).

이월 3건(`CINFMM`·금액 3종 기본값, 시퀀스 `CYCLE`, 감사 컬럼 규약 문서화)은 그대로 남아 있습니다.

## 3. 상세 Gap

### 3.1 테이블명 — 0건

| 방향 | 결과 |
| --- | --- |
| 운영에만 존재 | 없음 |
| 로컬에만 존재 | 없음 |

92개 업무 테이블이 양쪽 모두에 있습니다. 직전 회차의 운영 전용 `TPRMPP_CLANGL`이 로컬에 구현되어
해소됐고, 이번에 추가된 `TPRMPP_CMFATM`·`TPRMPP_CMFADM`은 운영 등록과 로컬 마이그레이션
(`V20260820_002__CreateMfaTransactionTables.sql`)이 같은 날 함께 반영됐습니다.

`V20260820_002` 헤더 주석이 이를 명시합니다 — "테이블·컬럼명과 감사 컬럼 채택 여부는 2026-08-20
meta 등록 결과를 따른다 (스펙 문서의 `TPRMPP_CMFTRM`/`CMFLPM`, `BaseEntity` 미상속 제안은 채택하지 않았다)".
설계 스펙이 아니라 **운영 meta 등록을 정본으로 삼은 사례**입니다.

### 3.2 테이블 코멘트 — 2건 (둘 다 로컬 규약 이탈)

| 테이블 | 운영 | 로컬 | 상태 |
| --- | --- | --- | --- |
| `TPRMPP_CLANGM` | `프로젝트관리_공통언어기본` | `구분언어마스터` | 이월 (직전 3.2) |
| `TPRMPP_CLANGL` | `프로젝트관리_공통언어기본변경로그` | `프로젝트관리_구분언어기본변경로그` | **신규** |

나머지 90개 테이블의 코멘트는 전수 일치합니다.

- `CLANGM`은 **`프로젝트관리_` 접두어가 아예 없는 유일한 테이블**입니다
  (`V20260815_001__CreateLanguageTranslationMaster.sql`).
- `CLANGL`은 접두어는 있으나 **`공통`이어야 할 자리가 `구분`**입니다
  (`V20260818_001__CreateClangmChangeLog.sql` 39행). 직전 회차 5.1의 (A) 채택으로 테이블을 만들면서
  운영 정의서의 코멘트를 그대로 옮기지 않은 결과입니다.

두 건 모두 운영 파일의 정밀도 문제가 아니라 **로컬 DDL이 자기 저장소 규약을 벗어난 경우**이므로
판단을 유보할 필요가 없습니다. 로컬 정렬 대상입니다(5.2).

### 3.3 운영 전용 컬럼 — 8건 (`*_NM` 이름 스냅샷, 방향 결정 필요)

운영 정의서가 담당자·팀장·사용자의 **이름을 담는 스냅샷 컬럼**을 4개 테이블 쌍에 추가했습니다.

| 테이블 | 컬럼 | 한글명 | 타입 | 운영 위치 | 짝이 되는 기존 ID 컬럼 |
| --- | --- | --- | --- | ---: | --- |
| `TPRMPP_BPROJM` | `TLR_NM` | 팀장명 | `VARCHAR2(100)` | 28 (`TLR_USID` 직후) | `TLR_USID` |
| `TPRMPP_BPROJM` | `USR_NM` | 사용자명 | `VARCHAR2(100)` | 30 (`USID` 직후) | `USID` |
| `TPRMPP_BPROJL` | `TLR_NM` | 팀장명 | `VARCHAR2(100)` | 29 | `TLR_USID` |
| `TPRMPP_BPROJL` | `USR_NM` | 사용자명 | `VARCHAR2(100)` | 31 | `USID` |
| `TPRMPP_BCOSTM` | `CGPR_NM` | 담당자명 | `VARCHAR2(100)` | 8 (`CGPR_ID` 직후) | `CGPR_ID` |
| `TPRMPP_BCOSTL` | `CGPR_NM` | 담당자명 | `VARCHAR2(100)` | 9 | `CGPR_ID` |
| `TPRMPP_BTERMM` | `CGPR_NM` | 담당자명 | `VARCHAR2(100)` | 6 | `CGPR_ID` |
| `TPRMPP_BTERML` | `CGPR_NM` | 담당자명 | `VARCHAR2(100)` | 7 | `CGPR_ID` |

컬럼 수 차이 8건(운영 초과분)은 전부 이 컬럼들입니다.

**로컬에는 이 컬럼들의 흔적이 전혀 없습니다.** 저장소 전체(`it_backend`·`it_frontend`·`it_database`·
`docs`·`prds`)에서 `CGPR_NM`·`TLR_NM`을 검색하면 `meta/table.txt`와 `meta/meta.txt` 두 파일에서만
나옵니다. 관련 마이그레이션·엔티티 필드·설계 문서·`TASK.md` 항목이 없습니다.

판단에 필요한 사실 3가지입니다.

- **명명은 표준을 따릅니다.** `meta/meta.txt`에 `담당자명 CGPR_NM VARCHAR2(100)`(20032행),
  `사용자명 USR_NM VARCHAR2(100)`(34167행), `팀장명 TLR_NM VARCHAR2(100)`(72316행)이 등록돼 있습니다.
  임의로 지어낸 이름이 아닙니다.
- **같은 테이블에 이미 이름 스냅샷 선례가 있습니다.** `TPRMPP_BPROJM`은 `SVN_DPM_NM`(주관부서명),
  `SVN_TEM_NM`(주관팀명)을 물리 컬럼으로 갖고 있습니다. 즉 이 테이블에서 이름 스냅샷은 새 개념이 아니라
  **기존 패턴의 확장**입니다.
- **현재 로컬은 조인으로 해결합니다.** `Bprojm`·`Bcostm`·`Btermm` 엔티티는 `TLR_USID`·`USID`·`CGPR_ID`
  같은 ID만 갖고, 이름은 `TPRMPP_CUSERI` 조회로 채웁니다.

따라서 이 Gap은 **운영 측이 조회 성능이나 이력 보존(퇴사자 이름 유지)을 위해 스냅샷을 요구한 것**이거나,
**정의서에 먼저 등록해 둔 예정 항목**이거나 둘 중 하나입니다. 어느 쪽이냐에 따라 조치가 정반대이므로
확인이 필요합니다(5.1).

`*L`(변경로그) 쪽에도 짝이 맞춰 등록된 점은 (A) 쪽 근거입니다 — 단순 오등록이라면 마스터에만 들어갔을
가능성이 큽니다.

### 3.4 로컬 전용 컬럼 — 1건

| 테이블 | 컬럼 | 코멘트 | 타입 | 로컬 위치 | 출처 |
| --- | --- | --- | --- | ---: | --- |
| `TPRMPP_CFILEM` | `APG_FL_PTH` | 첨부파일경로 | `VARCHAR2(255)` | 16 (마지막) | `V20260820_004__AddCommonFileRelativePath.sql` |

`meta/meta.txt` 66551행에 `첨부파일경로 APG_FL_PTH VARCHAR2(255)`가 등록돼 있어 **명명·길이 모두
표준을 따릅니다.** 운영 정의서(`meta/table.txt`)에만 아직 행이 없습니다. 어제 추가된 컬럼이라
등록이 따라오지 않은 것으로 보이며, 운영 등록 요청 대상입니다(5.5).

**주의 1건** — 이 컬럼은 `VARCHAR2(255)`로 `CHAR` semantics 표기가 없습니다(= `BYTE`).
같은 날 만들어진 `TPRMPP_CMFATM`/`CMFADM`의 `VARCHAR2`는 전부 `CHAR` 표기이고
`V20260815_001`의 `CLANGM`도 전부 `CHAR`입니다. 마이그레이션이 `ADD (APG_FL_PTH VARCHAR2(255))`로
semantics를 생략한 결과입니다(4장의 혼용 문제와 같은 뿌리). 현재 저장값이 서버 채번 경로라 한글이
들어갈 경로가 아니어서 동작 영향은 없습니다.

### 3.5 컬럼 타입·길이·소수점 — 0건

92개 테이블에 공통으로 존재하는 1,671개 컬럼(운영 전용 8건·로컬 전용 1건 제외)에서 타입 Gap이 없습니다.
`NUMBER` 정밀도 미지정 표기 차이 2건은 1.2 규칙에 따라 미집계했습니다(4장).

### 3.6 컬럼 코멘트 — 6건

#### 3.6.1 `TPRMPP_CMFATM` — 3건 (신규)

| 컬럼 | 운영 | 로컬 |
| --- | --- | --- |
| `APN_CER_USG_TC` | 추가인증용도구분코드 | **IT포탈**추가인증용도구분코드 |
| `APN_CER_MNS_TC` | 추가인증수단구분코드 | **IT포탈**추가인증수단구분코드 |
| `APN_CER_STS_TC` | 추가인증상태구분코드 | **IT포탈**추가인증상태구분코드 |

로컬이 `IT포탈` 접두어를 붙였습니다(`V20260820_002` 51~53행). 같은 테이블의 나머지 15개 컬럼 코멘트는
전부 일치하고, `CMFADM` 10개 컬럼도 전수 일치합니다.

**로컬 표기가 다른 테이블 관행과 맞습니다** — 기존 코드성 컬럼이 `IT포탈협의회진행상태구분코드`
(`BASCTL.IT_PTL_ASCT_PRG_STS_TC`), `IT포탈게시판구분코드` 등으로 `IT포탈` 접두어를 쓰고 있고,
이 세 컬럼의 값도 `IT_PTL_` 계열 공통코드에서 옵니다. 정의서 쪽 보완이 맞는 방향입니다(5.8).

#### 3.6.2 `TPRMPP_BPROJM` 금액 3종 — 3건 (이월)

| 컬럼 | 운영 | 로컬 |
| --- | --- | --- |
| `TOT_RQM_AMT` | 총소요금액 | 총소요금액 (총 예산 = 활성품목 AMT 합계 스냅샷) |
| `MPL_AMT` | 예정금액 | 예정금액 (예산연도+1 이후 = 활성품목 MPL_AMT 합계 스냅샷) |
| `DFR_AMT` | 지급금액 | 지급금액 (기 지급예산, 사용자 입력) |

직전 회차 3.8.2와 동일합니다. `BPROJL`의 같은 3컬럼은 부연 없이 운영과 일치합니다.
로컬 부연이 더 정확하므로 깎지 않기를 권합니다 — 근거는 직전 회차 3.8.2에 그대로 남아 있습니다(5.8).

### 3.7 PK — 1건 (구성 일치, 컬럼 순서만 상이)

| | PK 컬럼 |
| --- | --- |
| 운영 `TPRMPP_CLANGM` | `TC_ID_CONE`, `TC_COL_NM`, `DTT_LAN_C` |
| 로컬 `TPRMPP_CLANGM` (`PK_CLANGM`) | `TC_ID_CONE`, `DTT_LAN_C`, `TC_COL_NM` |

**직전 회차 5.4 요청이 반영되어 PK 구성(3컬럼)은 일치하게 됐습니다.** 남은 것은 2·3번째 컬럼의 순서뿐입니다.
나머지 91개 테이블의 PK는 구성·순서 모두 전수 일치합니다.

PK 컬럼 순서는 자동 생성되는 PK 인덱스의 선두 컬럼을 결정하므로 의미가 있습니다. 로컬은
`(TC_ID_CONE, DTT_LAN_C, TC_COL_NM)`이라 "대상 ID + 언어"까지의 접두 조회가 인덱스를 탑니다.
설계 문서와 엔티티가 이 순서를 명시하므로(`docs/superpowers/plans/2026-08-15-multilingual-i18n.md:16`,
`Clangm.java`의 `@IdClass(ClangmId.class)`, `ClangmSchemaContractTest`) **로컬이 정본**이고
정의서 쪽 행 순서를 맞추면 됩니다(5.4). 동작 영향은 없어 긴급도는 낮습니다.

### 3.8 NULL 제약 — 11건 (+PK 규칙에 가려진 4건)

**11건 전부가 최근 등록된 4개 테이블이며, 전부 "운영=NULL 허용 / 로컬=`NOT NULL`" 방향입니다.**

| 테이블 | 컬럼 | 코멘트 | 운영 | 로컬 |
| --- | --- | --- | --- | --- |
| `TPRMPP_CLANGM` | `TC_DES` | 구분코드설명 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CLANGM` | `DTT_NM` | 구분명 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CLANGL` | `TC_COL_NM` | 구분코드컬럼명 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CMFATM` | `APN_CER_USG_TC` | 추가인증용도구분코드 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CMFATM` | `APN_CER_MNS_TC` | 추가인증수단구분코드 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CMFATM` | `APN_CER_STS_TC` | 추가인증상태구분코드 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CMFATM` | `ENO` | 사원번호 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CMFATM` | `END_DTM` | 종료일시 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CMFATM` | `FLUR_NOT` | 실패횟수 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CMFADM` | `ENO` | 사원번호 | NULL 허용 | `NOT NULL` |
| `TPRMPP_CMFADM` | `END_DTM` | 종료일시 | NULL 허용 | `NOT NULL` |

**직전 회차 3.6에서 `CLANGM` 하나에만 보였던 현상이 이번에 3개 테이블로 재현됐습니다.**
운영 정의서에서 `CMFATM`은 PK(`APN_CER_TR_TOK_CONE`) 외 업무 컬럼 10개가 전부 `NULL여부 = Y`이고,
`CMFADM`도 PK 외 업무 컬럼 2개가 전부 `Y`입니다. 감사 컬럼 7개만 `N`입니다.

즉 **운영 정의서는 신규 테이블 등록 시 PK와 감사 컬럼 외에는 NULL 허용으로 채우는 경향**이 있습니다.
반대 사례도 있으므로(`BTERML.DFR_CLE_C` 등 기존 테이블의 비 PK `NOT NULL`) 전역 규칙은 아니고,
**신규 등록분에 국한된 패턴**입니다.

로컬이 정본이라고 판단합니다. `CMFATM`은 90초 수명의 MFA 거래 상태 테이블이라
용도·수단·상태·사원번호·만료시각·실패횟수가 없는 행은 검증 자체가 불가능하고,
`CMFADM`의 `ENO`·`END_DTM`도 마찬가지입니다. `CLANGL.TC_COL_NM`은 마이그레이션 주석이
"마스터 PK 컬럼(`TC_ID_CONE`, `DTT_LAN_C`, `TC_COL_NM`)만 `NOT NULL`"이라고 명시했는데
정의서는 셋 중 `TC_COL_NM` 하나만 `Y`로 남아 있어 정의서 내부에서도 일관되지 않습니다.

정의서 수정 요청 대상입니다(5.4).

#### 3.8.1 PK 제외 규칙에 가려진 4건 — 조치 불필요

1.2의 "PK 컬럼은 NULL 비교 제외" 규칙 때문에 집계에서 빠졌습니다. 직전 회차와 동일한 4건입니다.

| 테이블 | 컬럼 | 운영 | 로컬 |
| --- | --- | --- | --- |
| `TPRMPP_BPROJM` | `ABUS_MNG_NO` / `SNO` | `NOT NULL` | 표기 없음 (PK 구성 컬럼) |
| `TPRMPP_CRTOKM` | `LGN_LOG_SNO` | `NOT NULL` | 표기 없음 (PK 구성 컬럼) |
| `TPRMPP_CUSERI` | `ENO` | `NOT NULL` | 표기 없음 (PK 구성 컬럼) |

로컬 DDL이 PK 컬럼에 `NOT NULL`을 따로 적지 않았을 뿐 Oracle이 암묵적으로 강제하므로 **실제 차이가
아닙니다.** 직전 회차와 달리 `CLANGM`의 2건은 이번에 정의서가 반영되어 사라졌습니다.

### 3.9 기본값 — 7건 (전부 이월)

| 테이블 | 컬럼 | 코멘트 | 운영 | 로컬 |
| --- | --- | --- | --- | --- |
| `TPRMPP_BPROJM` | `TOT_RQM_AMT` / `MPL_AMT` / `DFR_AMT` | 금액 3종 | (없음) | `DEFAULT 0` |
| `TPRMPP_BPROJL` | `TOT_RQM_AMT` / `MPL_AMT` / `DFR_AMT` | 금액 3종 | (없음) | `DEFAULT 0` |
| `TPRMPP_CINFMM` | `INFM_SD_STS_C` | 알림발송상태코드 | `'10'` | `'01'` |

직전 회차 3.8.1·3.11과 동일한 7건이며 판정도 같습니다.

- 금액 6건: `V20260816_001__AddBprojmAmountColumns.sql`이 `DEFAULT 0`으로 추가했습니다.
  금액에서 `0`(금액 없음 확정)과 `NULL`(미입력)은 의미가 다르고 합산 시 `NULL` 전파 경로가 생기므로
  운영 반영을 권합니다(5.6). 단 1.4대로 정의서가 `NULL`을 표기하지 않으므로 **운영 DB가 이미
  `DEFAULT 0`일 가능성**이 있습니다 — 5.10의 쿼리로 먼저 확인하는 편이 낫습니다.
- `CINFMM` 1건: `V20260808_001__AlignCinfmmDispatchStatusDefault.sql`이 기록한 정본 결정(BE-20)이며
  로컬 드리프트가 아닙니다. 앱이 모든 INSERT에서 발송상태를 명시하므로 동작 영향은 없습니다.

### 3.10 컬럼 순서

절대 위치 Gap 193건의 테이블별 내역과 원인입니다.

| 테이블 | 절대 Gap | 원인 | 공통 컬럼 상대 순서 | 성격 |
| --- | ---: | --- | --- | --- |
| `TPRMPP_BCOSTL` | 29 | 운영 전용 `CGPR_NM` 삽입 | 일치 | **파생 (3.3 해소 시 소멸)** |
| `TPRMPP_BCOSTM` | 26 | 운영 전용 `CGPR_NM` 삽입 | 일치 | **파생** |
| `TPRMPP_BTERML` | 24 | 운영 전용 `CGPR_NM` 삽입 | 일치 | **파생** |
| `TPRMPP_BTERMM` | 21 | 운영 전용 `CGPR_NM` 삽입 | 일치 | **파생** |
| `TPRMPP_BPROJL` | 24 | `TLR_NM`/`USR_NM` 삽입 + 금액 3종 말단 | 불일치 | 파생 + 판단 유보 |
| `TPRMPP_BPROJM` | 21 | `TLR_NM`/`USR_NM` 삽입 + 금액 3종 말단 | 불일치 | 파생 + 판단 유보 |
| `TPRMPP_CMENUL` | 16 | `IMK_NM` (운영 6 / 로컬 21 = 마지막) | 불일치 | 판단 유보 |
| `TPRMPP_CMENUM` | 13 | `IMK_NM` (운영 5 / 로컬 17 = 마지막) | 불일치 | 판단 유보 |
| `TPRMPP_CFILEM` | 10 | `APG_FL_SZ` (운영 6 / 로컬 15) | 불일치 | 판단 유보 |
| `TPRMPP_CLANGM` | 7 | 아래 3.10.1 | 불일치 | **실질** |
| `TPRMPP_CLANGL` | 2 | 아래 3.10.2 | 불일치 | **실질** |

나머지 81개 테이블은 절대 위치까지 전수 일치합니다.

**100건(`BCOSTL`·`BCOSTM`·`BTERML`·`BTERMM`)은 독립된 Gap이 아닙니다.** 운영 전용 컬럼 1개가 중간에
삽입되면서 뒤의 모든 컬럼 위치가 1씩 밀린 결과이고, 공통 컬럼끼리의 상대 순서는 완전히 일치합니다.
3.3이 정리되면 함께 사라집니다.

**`CMENUL`·`CMENUM`·`CFILEM`·`BPROJL`·`BPROJM`의 순서 차이는 직전 회차와 같은 이유로 판단을
유보합니다** — 로컬은 `ALTER TABLE ... ADD`로 추가해 물리적으로 마지막에 붙고, 운영 정의서는 컬럼을
논리적으로 어울리는 자리에 배치했습니다. 운영 DB에도 같은 `ALTER TABLE ... ADD`로 반영했다면
실제 `COLUMN_ID`는 로컬과 같을 것입니다. 확인 쿼리는 5.10에 있습니다.

#### 3.10.1 `TPRMPP_CLANGM` — 7건 (실질)

| 컬럼 | 운영 위치 | 로컬 위치 |
| --- | ---: | ---: |
| `TC_COL_NM` | 2 | 3 |
| `DTT_LAN_C` | 3 | 2 |
| `FST_ENR_USID` | 6 | 9 |
| `FST_ENR_DTM` | 7 | 10 |
| `DEL_YN` | 8 | 6 |
| `GUID` | 9 | 7 |
| `GUID_PRG_SNO` | 10 | 8 |

뒤 5건은 직전 회차 3.4와 같은 감사 컬럼 배치 문제입니다.
**로컬 92개 업무 테이블 중 91개가 감사 컬럼을 예외 없이 아래 순서로 배치합니다.**

```
FST_ENR_USID → FST_ENR_DTM → DEL_YN → GUID → GUID_PRG_SNO → LST_CHG_USID → LST_CHG_DTM
```

`TPRMPP_CLANGM` 하나만 `DEL_YN → GUID → GUID_PRG_SNO → FST_ENR_USID → FST_ENR_DTM → LST_CHG_*`
입니다(`V20260815_001`의 컬럼 나열 순서가 그대로 물리 순서가 됨). 앞 2건은 3.7의 PK 컬럼 순서와
같은 사안입니다.

> 참고: `BPROJL`·`BPROJM`·`CFILEM`·`CMENUL`·`CMENUM` 5개는 감사 컬럼 **내부 순서**는 규약대로이고,
> `ALTER TABLE ... ADD`로 추가된 컬럼이 감사 블록 뒤에 붙어 있을 뿐입니다. Oracle에서 피할 수 없는
> 결과이므로 규약 이탈로 보지 않습니다.

#### 3.10.2 `TPRMPP_CLANGL` — 2건 (실질, 신규)

| 컬럼 | 운영 위치 | 로컬 위치 |
| --- | ---: | ---: |
| `TC_COL_NM` | 3 | 4 |
| `DTT_LAN_C` | 4 | 3 |

마스터(`CLANGM`)와 정확히 같은 두 컬럼이 같은 방향으로 어긋나 있습니다. 로컬은 마스터와 로그의
컬럼 순서를 맞췄고(`TC_ID_CONE → DTT_LAN_C → TC_COL_NM`), 운영 정의서도 자기 안에서는 마스터·로그가
일관됩니다(`TC_ID_CONE → TC_COL_NM → DTT_LAN_C`). **양쪽 모두 내부 일관성은 있고 서로만 다릅니다.**

**정렬은 권하지 않습니다.** Oracle에서 컬럼 순서를 바꾸려면 테이블 재생성이 필요하고, 컬럼명 기반
매핑을 쓰는 이 프로젝트에서 동작 영향이 없습니다. 3.7의 PK 순서와 함께 **정의서 쪽 행 순서를
로컬에 맞추고, 신규 테이블에서 반복하지 않도록 규약을 기록하는 것**이 실질적 조치입니다(5.4, 5.9).

### 3.11 시퀀스

62개 시퀀스명이 **전수 일치**하며 어느 한쪽에만 있는 시퀀스는 없습니다.
`INCREMENT BY`(전부 1), `MIN VALUE`(전부 1), `ORDER`(전부 `NOORDER`) Gap도 0건입니다.
직전 회차에 운영 파일이 담지 못했던 `SQ_TPRMPP_CLANGL_1`이 이번에 등록되어 비교 대상에 들어왔습니다.

#### 3.11.1 `MAX VALUE` — 39건 (표기 아티팩트 확정, 조치 불필요)

| 운영 표기 | 로컬 실제값 | 건수 |
| --- | --- | ---: |
| `999999999999999000` | `999999999999999999` (9 × 18) | 37 |
| `9999999999999990000000` | `9999999999999999999999` (9 × 22) | 2 (`SQ_TPRMPP_CLOGNH_1`, `SQ_TPRMPP_CRTOKM_1`) |

직전 회차와 동일한 39건입니다. **1.3에서 운영 파일이 라이브 추출본으로 확인되면서 판정이
"유력"에서 "확정"으로 바뀌었습니다** — 라이브 DB에서 뽑은 값이 15 유효자리에서 잘려 있다면
원인은 값 자체가 아니라 추출 도구의 수치 포맷입니다. 두 패턴 모두 정확히 15자리에서 절삭됩니다.

로컬 값은 `V20260730_003__NormalizeSequenceMaxValues.sql`이 의도적으로 통일한 값입니다
("숫자 컬럼 저장용은 대상 `NUMBER(p)`의 `p`자리". 22자리 2건은 대상 컬럼이 `NUMBER(22)`라 예외).
15자리 이하 `MAX VALUE`(`9999`, `9999999`, `99999999`, `999999999`)는 여전히 전부 정확히 일치합니다.

**단, 이 절삭값이 로컬로 역유입된 사례가 1건 생겼습니다.**

```
SQ_TPRMPP_CLANGL_1   운영 999999999999999000   로컬 999999999999999000   (Gap 없음)
```

`V20260818_001__CreateClangmChangeLog.sql` 36~37행이 `MAXVALUE 999999999999999000`으로 시퀀스를
만들었습니다. 운영 정의서의 절삭 표기를 그대로 옮긴 것으로 보입니다. 양쪽이 같으니 Gap 집계에는
잡히지 않지만, **로컬 61개 시퀀스가 `V20260730_003`으로 통일한 18자리 기준에서 이 하나만 벗어나
있습니다.** 로컬 정렬 대상입니다(5.3). 동작 영향은 없습니다(어느 쪽이든 도달할 수 없는 상한).

#### 3.11.2 `CYCLE` — 14건 (실질 Gap, 3회차 이월·미조치)

운영은 `CYCLE = true`, 로컬은 전부 `NOCYCLE`입니다. 대상 14개는 예외 없이 `MAX VALUE = 9999`인
기본(`*M`) 테이블 채번 시퀀스로, 직전 2회차와 **목록이 동일**합니다.

`SQ_TPRMPP_BASCTM_1`, `BBUGTM_1`, `BCONTM_1`, `BCOSTM_1`, `BDELIM_1`, `BESTIM_1`, `BGDOCM_1`,
`BITEMM_1`, `BPAYMM_1`, `BPLANM_1`, `BPROJM_1`, `BRDOCM_1`, `BTERMM_1`, `CBLBCM_1`

`9999` 도달 시 운영은 `1`로 순환하고 로컬은 `ORA-08004`로 채번이 실패합니다. **로컬에서만 발생하는
장애**이며, 관리번호 4자리 포맷(`PRJ-2026-0001`) 설계와도 `NOCYCLE` 쪽이 어긋납니다.

**1.3으로 이 14건이 운영 DB의 실제 상태임이 확정됐습니다.** 직전 회차까지 남아 있던
"정의서상 값일 수 있다"는 여지가 사라졌으므로 이제 정렬 판단을 미룰 근거가 없습니다.
직전 회차 5.3의 스크립트 초안이 그대로 유효합니다.

긴급도는 여전히 낮습니다 — 이 14개 시퀀스의 현재 카운터 최대치는 로컬 537(`SQ_TPRMPP_BCOSTM_1`),
운영 61(`SQ_TPRMPP_BITEMM_1`)로 둘 다 `9999`와 거리가 멉니다.

#### 3.11.3 `CACHE` — 30건 (신규 실질 Gap)

**이번 회차에 운영 파일이 `Cache` 열을 갖게 되면서 처음 비교한 항목입니다.**

| | `CACHE 20` | `NOCACHE` |
| --- | ---: | ---: |
| 운영 | **62 (전부)** | 0 |
| 로컬 | 32 | **30** |

Gap 30건은 전부 "운영 `CACHE 20` / 로컬 `NOCACHE`" 방향입니다. 대상은
`*M` 계열 20개(`BASCTM_1`, `BBUGTM_1`, `BCONTM_1`, `BCOSTM_1`, `BDELIM_1`, `BESTIM_1`, `BGDOCM_1`,
`BITEMM_1`, `BPAYMM_1`, `BPLANM_1`, `BPROJM_1`, `BRDOCM_1`, `BTERMM_1`, `CAPPLM_1`, `CBLBCM_1`,
`CBLBMM_1`, `CFILEM_1`, `CINFMM_1`, `CMENUM_1`, `CRTOKM_1`)와
`*L`/기타 10개(`BASKPL_1`, `BBIZCL_1`, `BBIZGL_1`, `BBIZPL_1`, `BBIZSL_1`, `BMQNAL_1`, `BPLEVL_1`,
`CLANGL_1`, `CLOGNH_1`, `CMENUL_1`)입니다.

**로컬의 `NOCACHE`는 설계 결정이 아니라 마이그레이션 보일러플레이트의 부수 효과로 보입니다.**
`NOCACHE`를 쓰는 마이그레이션 6개(`V20260630_002`, `V20260702_002`, `V20260713_002`, `V20260718_008`,
`V20260720_007`, `V20260818_001`)를 확인했으나 **어느 하나도 `NOCACHE`를 선택한 이유를 적어 두지
않았습니다.** 모두 `CREATE SEQUENCE ... START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE` 형태의
같은 문구를 복사하고 있습니다. 반면 로컬의 나머지 32개는 `CACHE 20`(Oracle 기본값)이라
**로컬은 내부적으로도 32:30으로 갈려 있고, 운영은 62개가 균일**합니다.

동작 차이는 두 가지입니다.

- **운영은 인스턴스 재기동·`ALTER SEQUENCE` 시 최대 20개 번호가 건너뛰어집니다.** 로컬은 건너뛰지 않습니다.
- `NOCACHE`는 매 채번마다 데이터 사전을 갱신하므로 대량 INSERT에서 느립니다. 현재 이 시스템의
  채번량(가장 많이 쓴 시퀀스가 3,975)에서는 체감 차이가 없습니다.

`MAX VALUE 9999` + `CYCLE` 조합인 14개 `*M` 시퀀스에서는 캐시 손실이 상한 소진을 앞당기지만,
운영 실측 최대치가 201이라 당장 문제는 아닙니다. 로컬 정렬을 권합니다(5.7).

#### 3.11.4 현재값 — 51건 (스키마 Gap 아님, 미집계)

운영 `Value`와 로컬 `START WITH`(`DBMS_METADATA`가 렌더링한 `LAST_NUMBER`)의 차이입니다.

| | 값 분포 |
| --- | --- |
| 운영 | `1`(45), `21`(3), `41`(7), `61`(4), `81`(1), `101`(1), `201`(1) |
| 로컬 | `1` ~ `3,975` (`SQ_TPRMPP_CRTOKM_1`) |

둘 다 런타임 카운터라 스키마 차이가 아니므로 조치 대상이 아닙니다(직전 4회차 동일 판정).

운영 분포는 1.3의 근거로 쓴 것 외에도 **운영 DB가 실제 사용 중이되 사용량이 매우 적다**는 사실을
알려 줍니다. 62개 중 45개가 아직 첫 캐시 블록도 다 쓰지 않았습니다.

### 3.12 동작상 동일한 표기 차이 — 32건 (조치 불필요·정렬 불가)

로컬에만 `DEFAULT NULL`이 명시된 컬럼 32개로, **2026-08-01·08-12·08-18 회차와 완전히 동일한
목록**입니다. Oracle에서 `DEFAULT NULL`은 기본값 미지정과 동작이 같아 Gap으로 집계하지 않았습니다.
조치하지 않는 근거는 2026-08-01 회차에서 확정됐고 변동이 없습니다.

`BCONTM.LST_YN`, `BDELIM.LST_YN`/`TASK_DBR_OMT_YN`, `BESTIM.LST_YN`,
`BITEMM.ITR_INFR_YN`/`SECT_SYS_UTZ_YN`/`LST_YN`, `BPAYMM.LST_YN`, `BPROJM.DPL_YN`/`ODN_YN`,
`CAPPLM.DCD_REQ_DTM`, `CAUTHI.USE_YN`, `CBLBCM` 7개, `CBLBMM` 6개, `CCMMTM` 2개,
`CINFMM.INQ_YN`/`RE_TRY_NOT`, `CMENUD.USE_YN`, `CMENUM.HID_YN`, `CROLEI.USE_YN`

## 4. 이번 비교로 확인할 수 없는 항목

운영 기준 파일에 정보가 없어 판정 대상에서 제외했습니다.

- **`NUMBER` 정밀도 미지정 여부** — 운영 파일은 `TPRMPP_CLOGNH.LGN_LOG_SNO`와
  `TPRMPP_CRTOKM.LGN_LOG_SNO`를 `NUMBER` 길이 `22`로 적었고 로컬은 `NUMBER(22,0)`입니다.
  Oracle에서 정밀도 미지정 `NUMBER`의 `DATA_LENGTH`도 22이므로 운영 추출본만으로는 구분할 수
  없습니다. 1.2 규칙에 따라 미집계했습니다. 로컬 값이 의도적이라는 근거는 `V20260730_003` 94~95행입니다.
- **문자 길이 semantics (`CHAR` / `BYTE`)** — 운영은 길이 숫자만 제공합니다.
  로컬은 `VARCHAR2` 1,131개 중 **837개가 `CHAR`, 294개가 `BYTE`**(세션 기본값이라 미표기)이며
  **51개 테이블이 두 방식을 혼용**합니다. 직전 회차(808/293, 51테이블) 대비 `CHAR`가 29개 늘었고
  (`CLANGL` 11 + `CMFATM` 12 + `CMFADM` 6 — 신규 3개 테이블의 `VARCHAR2`는 전부 `CHAR`) `BYTE`가 1개 늘었습니다(`CFILEM.APG_FL_PTH`, 3.4).
  혼용 테이블 수는 51개 그대로입니다. 멀티바이트 저장 한계가 달라질 수 있어 별도 확인이 필요합니다.
- **인덱스, FK, CHECK 제약, UNIQUE 제약** — 운영은 PK 여부만 제공합니다.
  로컬에는 인덱스 **70개**(직전 67개 + MFA 3개 — `UX_TPRMPP_CMFATM_01`,
  `IX_TPRMPP_CMFATM_02`, `IX_TPRMPP_CMFADM_01`)와 CHECK 제약 **17개**가 있습니다.
  `UX_TPRMPP_CMFATM_01`은 `APN_CER_CRTT_TOK_CONE`의 UNIQUE 인덱스라 운영 반영 여부가
  기능에 직접 영향을 줍니다.
  특히 `CK_CLANGM_DTT_COL`은 `DTT_NM`↔`TC_COL_NM` 조합을 제한하는 업무 규칙이라 운영 반영 여부
  확인이 필요합니다(직전 회차와 동일하게 미확인).
- **뷰, 트리거, 프로시저** — 운영 기준 파일에 없습니다. 로컬에는 뷰 1개, 트리거 0개입니다.
- **컬럼 순서·기본값의 운영 실제값** — 1.4의 이유로 `meta/table.txt` 값이 운영 DB의 실제 상태와
  다를 수 있습니다. 5.10의 쿼리로 확인해야 합니다.
  (시퀀스 쪽은 1.3으로 확인 필요가 해소됐습니다.)

## 5. 권고 조치

### 5.0 결정 — 전 항목 운영 기준 정렬 (2026-08-20)

**3.4의 로컬 전용 컬럼 `TPRMPP_CFILEM.APG_FL_PTH` 하나를 빼고, 모든 Gap을 로컬이 운영 기준에 맞추는
방향으로 정했습니다.** 아래 5.1~5.9의 분석과 근거는 그대로 두되, **정렬 방향은 이 절이 우선**합니다.
5.1의 (A)/(B), 5.4·5.6·5.8의 "운영 정의서 수정·반영 요청"은 모두 로컬 정렬로 대체되었습니다.

컬럼 순서(3.10)와 시퀀스 `MAX VALUE`(3.11.1)는 리포트가 각각 "정렬 불필요", "표기 아티팩트"로 판단해
제외를 권했으나, **운영 기준을 그대로 따르기로 결정**해 함께 정렬합니다. 컬럼 순서는 Oracle에 변경
수단이 없어 11개 테이블 재생성이 필요합니다.

작성한 마이그레이션은 5개입니다.

| 파일 | 대상 | 해소 항목 |
| --- | --- | ---: |
| `V20260820_006__AlignSequencesToProduction.sql` | 시퀀스 62개 | `MAX VALUE` 39 + `CYCLE` 14 + `CACHE` 30 = 83 |
| `V20260820_007__AlignMfaAndNotificationToProduction.sql` | `CMFATM`·`CMFADM`·`CINFMM` | NULL 8 + 코멘트 3 + 기본값 1 = 12 |
| `V20260820_008__RebuildCostTablesToProductionLayout.sql` | `BCOSTM`·`BCOSTL`·`BTERMM`·`BTERML` | 신규 컬럼 4 + 순서 100 = 104 |
| `V20260820_009__RebuildProjectTablesToProductionLayout.sql` | `BPROJM`·`BPROJL` | 신규 컬럼 4 + 순서 45 + 기본값 6 + 코멘트 3 = 58 |
| `V20260820_010__RebuildCommonTablesToProductionLayout.sql` | `CFILEM`·`CMENUM`·`CMENUL`·`CLANGM`·`CLANGL` | 순서 48 + 테이블 코멘트 2 + PK 1 + NULL 3 = 54 |

합계 311건으로, 3장에서 집계한 312건 중 제외한 `APG_FL_PTH` 1건을 뺀 전부입니다.

#### 적용 결과 (2026-08-20 19:59, 로컬 `XEPDB1`)

5개 모두 Flyway로 적용됐고 `flyway_schema_history`에 `20260820.006`~`20260820.010`이
`success = 1`로 기록됐습니다(실패 이력 0건). 적용 뒤 `export-ddl-live.ps1`로 DDL을 재추출해
(`Generated at: 2026-08-20 20:34:47`) 3장과 같은 대조를 다시 돌린 결과입니다.

| 항목 | 적용 전 | 적용 후 |
| --- | ---: | ---: |
| 테이블·컬럼·타입·시퀀스 존재 | 일치 | 일치 |
| 테이블 코멘트 / 컬럼 코멘트 | 2 / 6 | **0 / 0** |
| 운영 전용 컬럼 | 8 | **0** |
| PK / NULL 제약 / 기본값 | 1 / 11 / 7 | **0 / 0 / 0** |
| 컬럼 순서 (절대) | 193 | **0** |
| 시퀀스 `MAX VALUE`·`CYCLE`·`CACHE` | 39 / 14 / 30 | **0 / 0 / 0** |
| **로컬 전용 컬럼** | 1 | **1** (`APG_FL_PTH`, 의도적 제외) |
| 합계 | 312 | **1** |

부수 확인 사항입니다.

- **데이터 보존** — 재생성한 11개 테이블의 구 테이블이 휴지통에 남아 있어 행 수를 직접 대조했습니다.
  `BTERML` 201, `BTERMM` 15, `CLANGM` 652, `CMENUM` 99, `CMENUL` 57, `CLANGL` 0은 그대로입니다.
  `BPROJL`(91→100)·`CFILEM`(1,275→1,374)·`BCOSTM`(0→71)·`BCOSTL`(0→71)·`BPROJM`(0→4)의 증가분은
  **전부 `FST_ENR_DTM`이 19:59:43 이후**로, 적용 후 애플리케이션 사용으로 들어온 행입니다.
  기존 행은 `BPROJL` 최소 등록일시 2026-01-21, `CFILEM` 2026-03-15로 그대로 남아 있습니다.
- **의존 객체** — `ITPOWN`에 `INVALID` 객체 0건, `ENABLED`가 아닌 제약 0건, `VALID`가 아닌 인덱스
  0건입니다. `V_ITPAPP_LOG_FEED`도 정상이고 `_NEW` 잔여 테이블은 없습니다.
  테이블 93개(업무 92 + Flyway 이력), 시퀀스 62개, 인덱스 163개(PK 인덱스 포함)입니다.
- **권한** — `ALL_TAB_PRIVS`에 `ITPOWN` 테이블 대상 객체 권한이 원래 없습니다(`ITPAPP`는 시스템
  권한으로 접근). 재생성으로 잃은 권한이 없음을 확인했습니다. 휴지통에 권한이 붙은 객체가 하나
  있으나 2026-06-12에 드롭된 `TPRMPP_BCHKLC`로 이번 작업과 무관합니다.
- **신규 컬럼** — `BPROJM.TLR_NM` 0/4, `BCOSTM.CGPR_NM` 0/71로 예상대로 전부 비어 있습니다(BE-63).

**1장의 로컬 기준(`Generated at: 2026-08-20 19:12:34`)은 분석 시점 스냅샷이고,
현재 `ITPOWN_DDL_live.sql`은 적용 후 재추출본(`20:34:47`)입니다.** 3장·4장의 수치는 적용 전
기준으로 읽어야 합니다.

**남는 후속 작업 2가지**가 있습니다.

- 신규 컬럼 8개(`CGPR_NM`·`TLR_NM`·`USR_NM`)는 **비어 있는 채로 생성됩니다.** 채우는 주체가 없어
  적재 시점을 정하고 백엔드를 고쳐야 합니다(5.1의 (A) 후속 작업).
- `TPRMPP_CFILEM.APG_FL_PTH`의 운영 정의서 등록 요청은 그대로 남습니다(5.5).

**백엔드는 건드리지 않았습니다.** `ddl-auto=none`이라 엔티티 애너테이션이 스키마를 만들지 않고
기동 시 검증도 하지 않습니다. NULL 제약을 완화한 컬럼들의 `@Column(nullable = false)`와
`ClangmSchemaContractTest`는 그대로 두었습니다 — 애플리케이션이 DB보다 엄격한 상태가 되며,
저장되는 데이터는 달라지지 않습니다.

### 5.1 방향 결정 — 운영 전용 컬럼 8건 (`*_NM`) (3.3)

> **5.0에서 (A)로 결정**했습니다. `V20260820_008`·`009`가 컬럼을 만들었고, 아래 표의
> (A) 작업 중 **"엔티티 필드 추가 / 스냅샷 적재 / 기존 행 백필"이 남아 있습니다.**
> 아래 근거는 결정 배경 기록으로 남깁니다.

**먼저 정해야 하는 항목입니다.** 다른 조치와 달리 어느 쪽이 정본인지가 정해져 있지 않습니다.

| 결정 | 필요한 작업 |
| --- | --- |
| **(A) 운영 정의가 정본** — 이름 스냅샷 필요 | `TPRMPP_BPROJM`/`BPROJL`에 `TLR_NM`·`USR_NM`, `BCOSTM`/`BCOSTL`/`BTERMM`/`BTERML`에 `CGPR_NM` 추가 마이그레이션 작성, 엔티티 필드 추가, 저장·변경로그 적재 경로에서 `CUSERI` 조회값 스냅샷 기록, 기존 행 백필 |
| **(B) 로컬 정의가 정본** — 조인으로 충분 | 운영 정의서에서 해당 8행 제거 요청 |

판단 근거는 3.3에 정리했습니다. **결정 전에 운영 측에 용도를 먼저 확인하기를 권합니다.**
`SVN_DPM_NM`·`SVN_TEM_NM` 선례가 있고 `*L`까지 짝을 맞춰 등록된 점은 (A) 쪽이지만,
로컬 설계 문서·과제 목록 어디에도 요구사항이 없어 근거만으로는 가릅니다.
(A)라면 "언제 스냅샷을 갱신하는가"(생성 시점 고정 / 담당자 변경 시 갱신 / 조회 시 동기화)를
함께 정해야 합니다 — `Bprojm`의 `SVN_TEM_C` 주석이 쓰는 "생성·수정 시 담당자 기준 갱신" 규칙을
그대로 따르는 것이 자연스럽습니다.

3.10의 절대 순서 Gap 100건도 이 결정과 함께 해소됩니다.

### 5.2 로컬 정렬 — 테이블 코멘트 2건 (3.2)

로컬 92개 테이블 중 이 2건만 코멘트 규약을 벗어나 있으므로 로컬을 맞춥니다.

```sql
-- V20260820_010__RebuildCommonTablesToProductionLayout.sql 에 포함
COMMENT ON TABLE ITPOWN.TPRMPP_CLANGM IS '프로젝트관리_공통언어기본';
COMMENT ON TABLE ITPOWN.TPRMPP_CLANGL IS '프로젝트관리_공통언어기본변경로그';
```

`COMMENT ON TABLE`은 멱등이고 데이터·동작에 영향이 없어 가드가 필요 없습니다.
**적용된 `V20260815_001`·`V20260818_001`은 Flyway 체크섬 대상이므로 수정하지 말고 새 버전
스크립트로 추가합니다.** 5.3과 같은 스크립트로 묶어도 됩니다.

> **5.0 반영**: `V20260820_010__RebuildCommonTablesToProductionLayout.sql`에 포함했습니다.
> 두 테이블 모두 컬럼 순서 재생성 대상이라 별도 스크립트를 두지 않고 같은 파일에서 처리합니다.

### 5.3 로컬 정렬 — `SQ_TPRMPP_CLANGL_1` `MAXVALUE` (3.11.1)

> **5.0으로 폐기된 권고입니다.** `MAX VALUE` 39건을 운영 표기값으로 맞추기로 하면서
> `SQ_TPRMPP_CLANGL_1`은 이미 운영과 같은 값이 되어 정렬할 것이 없습니다. 아래는 "운영 값이
> 절삭 표기"라는 판단을 유지했을 경우의 권고로, 기록을 위해 남깁니다.

운영 정의서의 15자리 절삭 표기가 로컬 마이그레이션으로 역유입된 건입니다.
`V20260730_003`이 세운 기준(18자리)으로 되돌립니다.

```sql
-- 5.2와 같은 스크립트에 포함 가능
ALTER SEQUENCE ITPOWN.SQ_TPRMPP_CLANGL_1 MAXVALUE 999999999999999999;
```

동작 영향은 없습니다. **같은 실수가 반복되지 않도록, 신규 시퀀스의 `MAXVALUE`는 운영 정의서 값을
옮기지 말고 `V20260730_003`의 기준(대상 `NUMBER(p)`의 `p`자리)으로 계산한다는 점을 5.9에 함께
기록하기를 권합니다.**

### 5.4 운영 정의서 수정 요청 — NULL 제약 11건 + `CLANGM`/`CLANGL` 컬럼 순서 (3.7, 3.8, 3.10)

운영 정의서를 로컬 실제 DDL에 맞춰야 합니다. **로컬을 바꾸는 방향이 아닙니다.**

**(1) `NULL여부` 열 수정 11건** — `Y` → `N`

| 테이블 | 컬럼 |
| --- | --- |
| `TPRMPP_CLANGM` | `TC_DES`, `DTT_NM` |
| `TPRMPP_CLANGL` | `TC_COL_NM` |
| `TPRMPP_CMFATM` | `APN_CER_USG_TC`, `APN_CER_MNS_TC`, `APN_CER_STS_TC`, `ENO`, `END_DTM`, `FLUR_NOT` |
| `TPRMPP_CMFADM` | `ENO`, `END_DTM` |

근거는 3.8에 있습니다. 운영 DB에 정의서대로 반영되면 **MFA 거래 검증과 번역 조회 fallback이
데이터 수준에서 보장되지 않습니다.**

**(2) 컬럼 행 순서 수정** — `TC_COL_NM`과 `DTT_LAN_C`의 순서를 로컬에 맞춥니다.

| 테이블 | 현재 정의서 | 정정 |
| --- | --- | --- |
| `TPRMPP_CLANGM` | `TC_ID_CONE` → `TC_COL_NM` → `DTT_LAN_C` | `TC_ID_CONE` → **`DTT_LAN_C`** → **`TC_COL_NM`** |
| `TPRMPP_CLANGL` | `TC_ID_CONE` → `TC_COL_NM` → `DTT_LAN_C` | `TC_ID_CONE` → **`DTT_LAN_C`** → **`TC_COL_NM`** |

PK 컬럼 순서(3.7)도 이 수정으로 함께 맞습니다. 동작 영향은 없고 정의서 정합성 문제입니다.

직전 회차 5.4의 나머지 요청(PK 3컬럼화, `DTT_LAN_C`·`TC_COL_NM` `NOT NULL`)은 **반영 완료를
확인했습니다.**

### 5.5 운영 정의서 등록 요청 — `TPRMPP_CFILEM.APG_FL_PTH` (3.4)

`meta/table.txt`에 아래 행 추가를 요청합니다. 물리 컬럼은 이미 로컬에 존재하고 명명·길이는
`meta/meta.txt` 66551행 표준을 따릅니다.

| 테이블명 | 컬럼명 | 컬럼한글명 | PK여부 | NULL여부 | Default | 타입 | 길이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `TPRMPP_CFILEM` | `APG_FL_PTH` | 첨부파일경로 | | Y | | `VARCHAR2` | 255 |

### 5.6 운영 반영 요청 — 기본값 7건 (3.9, 이월)

```sql
-- 정보화사업 금액 3종
ALTER TABLE TPRMPP_BPROJM MODIFY (TOT_RQM_AMT DEFAULT 0, MPL_AMT DEFAULT 0, DFR_AMT DEFAULT 0);
ALTER TABLE TPRMPP_BPROJL MODIFY (TOT_RQM_AMT DEFAULT 0, MPL_AMT DEFAULT 0, DFR_AMT DEFAULT 0);

-- 알림 발송상태
ALTER TABLE TPRMPP_CINFMM MODIFY (INFM_SD_STS_C DEFAULT '01');
```

기존 행의 값은 건드리지 않습니다. 금액 3종은 운영 DB가 이미 `DEFAULT 0`일 가능성이 있으므로
`ALL_TAB_COLUMNS.DATA_DEFAULT`를 먼저 확인하는 편이 낫습니다(5.10).
`CINFMM` 건의 배경은 2026-08-12 회차 5.2에 있습니다.

### 5.7 로컬 정렬 — 시퀀스 `CYCLE` 14건 + `CACHE` 30건 (3.11.2, 3.11.3)

두 항목 모두 **운영 값이 실측으로 확정됐고**(1.3) 로컬 쪽에 이렇게 둔 이유가 문서에 없으므로,
로컬을 운영에 맞춥니다. 한 스크립트로 묶을 수 있습니다.

```sql
-- V20260820_006__AlignSequencesToProduction.sql 에 포함 (MAX VALUE 39건도 함께)
-- CYCLE: MAX VALUE 9999인 *M 채번 시퀀스 14개 (3.11.2)
ALTER SEQUENCE ITPOWN.SQ_TPRMPP_BASCTM_1 CYCLE;
-- … BBUGTM_1, BCONTM_1, BCOSTM_1, BDELIM_1, BESTIM_1, BGDOCM_1,
--    BITEMM_1, BPAYMM_1, BPLANM_1, BPROJM_1, BRDOCM_1, BTERMM_1, CBLBCM_1

-- CACHE: NOCACHE로 남은 30개 (3.11.3)
ALTER SEQUENCE ITPOWN.SQ_TPRMPP_BASCTM_1 CACHE 20;
-- … 목록은 3.11.3 참조
```

**주의**: Oracle에서 `CYCLE`은 `MAXVALUE`가 유한할 때만 의미가 있고, `CACHE`와 함께 쓰면
캐시 크기가 순환 구간(`MAXVALUE - MINVALUE + 1`)보다 작아야 합니다. `9999 > 20`이라 두 설정을
같이 걸어도 문제 없습니다.

`CYCLE`은 **로컬에서만 발생하는 `ORA-08004` 채번 실패를 없애는 항목**이라 `CACHE`보다 우선합니다.
다만 대상 14개의 카운터 최대치가 537(로컬)·61(운영)이라 긴급도는 낮습니다.
`CACHE`는 정합성 목적이며 동작 이득은 사실상 없습니다.

### 5.8 컬럼 코멘트 — 정의서 보완 6건 (3.6)

로컬 코멘트를 깎지 않고 정의서 쪽을 보완하기를 권합니다.

- `CMFATM`의 코드 3종: 정의서 한글명에 `IT포탈` 접두어를 반영하면 기존 `IT_PTL_` 계열 컬럼과
  표기가 통일됩니다.
- `BPROJM` 금액 3종: `TOT_RQM_AMT`는 드롭 전(당해예산)과 이번(총 예산)의 의미가 달라 논리명
  `총소요금액`만으로는 응답 필드 `totRqmAmt`(당해예산)와 혼동될 수 있습니다.
  근거는 `V20260816_001__AddBprojmAmountColumns.sql` 헤더 주석에 있습니다.

### 5.9 규약 기록 — 신규 테이블·시퀀스 작성 규칙 (3.10.1, 3.11.1, 4장)

정렬 비용이 큰(또는 정렬이 불가능한) 항목들이라, **반복을 막는 문서화가 실질적 조치**입니다.
아래 3가지를 신규 테이블·시퀀스 작성 시 실제로 열어 보는 문서에 남깁니다.

```
1. 공통 감사 컬럼은 항상 테이블 끝에 아래 순서로 둔다.
   FST_ENR_USID → FST_ENR_DTM → DEL_YN → GUID → GUID_PRG_SNO → LST_CHG_USID → LST_CHG_DTM
   (현행 92개 중 91개가 이미 이 순서 — 새 규칙이 아니라 암묵 규약의 명문화)

2. VARCHAR2는 CHAR semantics를 명시한다: VARCHAR2(255 CHAR)
   (세션 NLS_LENGTH_SEMANTICS에 의존하면 BYTE로 만들어져 한글 저장 한계가 1/3로 줄어든다)

3. 시퀀스 MAXVALUE는 운영 정의서 값을 옮기지 않고 V20260730_003의 기준으로 계산한다.
   숫자 컬럼 저장용 = 대상 NUMBER(p)의 p자리, 문자열 채번용 = zero-padding 폭.
   (운영 정의서의 MAX VALUE는 15 유효자리에서 절삭된 표기다)
```

기록 위치는 `it_database/docs/guides/migrations.md`(마이그레이션 작성 가이드)가 가장 적절합니다.
직전 회차 5.3에서 같은 항목(1번)을 권고했으나 아직 어느 문서에도 반영되지 않았습니다.

### 5.10 운영 실측 확인 (판단 유보 항목 해소용)

3.10(컬럼 순서 유보분)과 3.9(기본값)는 `meta/table.txt`가 정의서일 가능성 때문에 판정을
유보했습니다. 시퀀스 관련 쿼리는 1.3으로 불필요해졌습니다.

```sql
-- 컬럼 실제 위치 (3.10 유보분 + 운영 전용 컬럼 실재 여부)
SELECT table_name, column_name, column_id, nullable, data_type, data_length, data_default
  FROM all_tab_columns
 WHERE owner = 'ITPOWN'
   AND (table_name, column_name) IN (
        ('TPRMPP_CFILEM','APG_FL_SZ'),   ('TPRMPP_CMENUM','IMK_NM'),  ('TPRMPP_CMENUL','IMK_NM'),
        ('TPRMPP_BPROJM','TOT_RQM_AMT'), ('TPRMPP_BPROJL','TOT_RQM_AMT'),
        ('TPRMPP_BPROJM','TLR_NM'),      ('TPRMPP_BPROJM','USR_NM'),
        ('TPRMPP_BCOSTM','CGPR_NM'),     ('TPRMPP_BTERMM','CGPR_NM'))
 ORDER BY table_name, column_id;

-- 금액 3종 기본값 (3.9)
SELECT table_name, column_name, data_default
  FROM all_tab_columns
 WHERE owner = 'ITPOWN'
   AND table_name IN ('TPRMPP_BPROJM','TPRMPP_BPROJL')
   AND column_name IN ('TOT_RQM_AMT','MPL_AMT','DFR_AMT');

-- 신규 4개 테이블의 실제 NULL 제약 (3.8) — 운영에 이미 생성되어 있다면
SELECT table_name, column_name, column_id, nullable
  FROM all_tab_columns
 WHERE owner = 'ITPOWN'
   AND table_name IN ('TPRMPP_CLANGM','TPRMPP_CLANGL','TPRMPP_CMFATM','TPRMPP_CMFADM')
 ORDER BY table_name, column_id;

-- CHECK 제약 반영 여부 (4장)
SELECT table_name, constraint_name, search_condition
  FROM all_constraints
 WHERE owner = 'ITPOWN' AND constraint_type = 'C' AND constraint_name LIKE 'CK\_%' ESCAPE '\'
 ORDER BY table_name;
```

- `TLR_NM`·`USR_NM`·`CGPR_NM`이 조회되면 3.3은 **(A) 운영이 정본**으로 확정되고 5.1의 판단이 끝납니다.
  조회되지 않으면 정의서 선등록이므로 (B)를 검토합니다.
- `column_id`가 각각 마지막이면 3.10의 유보분 84건은 소멸합니다.

### 5.11 조치 현황

5.0의 결정에 따른 현황입니다. **5개 모두 2026-08-20 19:59에 적용 완료**했고, 재추출 DDL로
대조해 남은 Gap이 1건(의도적 제외)임을 확인했습니다.

| 항목 | 건수 | 조치 | 상태 |
| --- | ---: | --- | --- |
| 3.11.1 시퀀스 `MAX VALUE` | 39 | `V20260820_006` | 적용 완료 |
| 3.11.2 시퀀스 `CYCLE` | 14 | `V20260820_006` | 적용 완료 (3회차 이월 해소) |
| 3.11.3 시퀀스 `CACHE` | 30 | `V20260820_006` | 적용 완료 |
| 3.8 NULL 제약 (`CMFATM`·`CMFADM`) | 8 | `V20260820_007` | 적용 완료 |
| 3.6.1 컬럼 코멘트 (`CMFATM`) | 3 | `V20260820_007` | 적용 완료 |
| 3.9 기본값 (`CINFMM`) | 1 | `V20260820_007` | 적용 완료 (이월 해소, `V20260808_001` 되돌림) |
| 3.3 운영 전용 컬럼 `*_NM` | 8 | `V20260820_008`·`009` | **컬럼 생성만 완료 — 적재 주체 미정 (BE-63)** |
| 3.10 컬럼 순서 | 193 | `V20260820_008`·`009`·`010` | 적용 완료 |
| 3.9 기본값 (금액 3종) | 6 | `V20260820_009` | 적용 완료 (`DEFAULT 0` 제거) |
| 3.6.2 컬럼 코멘트 (`BPROJM` 금액) | 3 | `V20260820_009` | 적용 완료 (괄호 부연 제거) |
| 3.2 테이블 코멘트 | 2 | `V20260820_010` | 적용 완료 (1건 이월 해소) |
| 3.7 PK 컬럼 순서 (`CLANGM`) | 1 | `V20260820_010` | 적용 완료 |
| 3.8 NULL 제약 (`CLANGM`·`CLANGL`) | 3 | `V20260820_010` | 적용 완료 |
| 3.11.1 `SQ_TPRMPP_CLANGL_1` `MAXVALUE` | — | — | 조치 불필요 — 운영과 이미 일치 |
| 3.4 로컬 전용 컬럼 `APG_FL_PTH` | 1 | 운영 정의서 등록 요청 (5.5) | **정렬 대상에서 제외 — 운영 측 작업** |
| 3.12 `DEFAULT NULL` 표기 | 32 | 재생성 대상 3건은 부수 해소 | 나머지 29건은 조치 불필요 |
| 3.11.4 시퀀스 현재값 | 51 | 조치 불필요 (런타임 카운터) | — |
| 4장 `VARCHAR2` semantics 규약 | — | 규약 기록 (5.9) | 미착수 — 이월 |

적용은 파일 번호순(`006` → `010`)으로 실패 없이 끝났고, 재추출 DDL 대조까지 마쳤습니다(5.0).
재생성한 11개 테이블의 구 버전은 휴지통에 남아 `FLASHBACK TABLE ... TO BEFORE DROP`으로 되살릴
수 있습니다. 다만 적용 후 애플리케이션이 새 행을 넣었으므로(5.0 적용 결과) 되돌릴 때는 그 부분을
함께 고려해야 합니다.

## 6. 재현 방법

3장·4장의 Gap 분석은 파일 대조만으로 산출했습니다(DB 미접속). 5.0의 적용 결과 확인만 로컬
`XEPDB1`에 접속해 수행했습니다. 재현하려면 1장의 세 파일을 같은 커밋 기준으로 두고 아래 규칙으로
대조하면 됩니다. **단 `ITPOWN_DDL_live.sql`은 적용 후 재추출본으로 교체되었으므로, 3장 수치를
재현하려면 커밋 `b21bf8a`의 버전(`Generated at: 2026-08-20 19:12:34`)을 써야 합니다.**

| 원본 | 파싱 대상 |
| --- | --- |
| `meta/table.txt` | 탭 구분 10열, 헤더 1행 제외, 테이블·컬럼 출현 순서 = 컬럼 순서 |
| `meta/sequence.txt` | 탭 구분 **8열**(`Sequence Name` `Value` `Min Value` `Max Value` `Increment` `Cache` `Cycle` `Ordered`), 헤더 1행 제외. **2026-08-12 이전 파일은 6열 구형식**이므로 헤더로 분기해야 합니다 |
| `it_database/ITPOWN_DDL_live.sql` | `CREATE TABLE` 블록 / `CREATE SEQUENCE` 절 / `COMMENT ON TABLE\|COLUMN` 절 |

정규화 규칙은 1.2와 같습니다. 파싱 시 주의점은 1.5에 정리했습니다 —
`COMMENT ON TABLE`의 공백 2개(놓치면 테이블 코멘트 92건이 전부 거짓 Gap),
`CREATE TABLE` 블록의 괄호 깊이 스캔(놓치면 여러 줄 `CHECK` 제약이 있는 테이블의 PK 미검출).

로컬 DDL을 다시 추출해야 하면 `pwsh -File C:/it/it_database/export-ddl-live.ps1`을 사용합니다.
