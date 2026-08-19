# 운영·로컬 DB Gap 분석 결과 (2026-08-18)

## 1. 비교 기준

- 운영 테이블 기준: `C:\it\meta\table.txt`
  (1,644행 = 헤더 1 + 데이터 1,643. 2026-08-18 갱신, 작업트리 미커밋 상태.
  직전 커밋 `db9239f` 대비 데이터 35행 추가 + 파일 끝 개행 보정 1행 — 상세는 1.4)
- 운영 시퀀스 기준: `C:\it\meta\sequence.txt`
  (62행 = 헤더 1 + 시퀀스 61. 커밋 `db9239f`, **2026-08-12 이후 갱신 없음** — 1.5 참조)
- 로컬 기준: `C:\it\it_database\ITPOWN_DDL_live.sql`
  (`Generated at: 2026-08-18 08:25:10 +09:00` `DBMS_METADATA` 스냅샷, 커밋 `5ff1eb2`,
  `it_database` 작업트리 클린)
- 제외 테이블: `FLYWAY_SCHEMA_HISTORY`
- 비교 항목: 시퀀스명 / 시퀀스 MAXVALUE·MINVALUE·INCREMENT·CYCLE·START WITH /
  테이블명 / 테이블 코멘트 / 컬럼명 / 컬럼 타입·길이·소수점 / 컬럼 순서 / 컬럼 코멘트 / PK / NULL 제약 / 기본값

지시문(`docs/prompts/DB_GAP.md`) 7행은 운영 시퀀스 원본을 `meta/table.txt`로 적고 있으나 `table.txt`에는
시퀀스 정보가 전혀 없으므로, 직전 회차와 같이 **`meta/sequence.txt`를 운영 시퀀스 기준으로 사용**했습니다.

### 1.1 로컬 스냅샷 시점 유효성

로컬 DDL 스냅샷(`2026-08-18 08:25`)은 최신 마이그레이션 `V20260817_001__UpdateMigrationAdminMenuName.sql`
이후에 추출되었고 `it_database` 작업트리에 미커밋 마이그레이션이 없습니다. 현재 로컬 스키마의 유효한
기준선입니다.

### 1.2 판정 규칙 (이전 회차 유지)

- PK 컬럼은 Oracle에서 암묵적 `NOT NULL`이므로 NULL 제약 비교에서 제외합니다.
  단, PK 구성 자체가 어긋난 테이블은 이 규칙이 실제 차이를 가리므로 별도로 적었습니다(3.6).
- 로컬의 `DEFAULT NULL`은 기본값 미지정과 동작이 같으므로 정규화하여 Gap으로 집계하지 않습니다.
- `VARCHAR2` 길이는 숫자만 비교합니다. 운영 추출본에 `CHAR`/`BYTE` semantics 정보가 없기 때문입니다(4장).
- `NUMBER`의 운영 길이 `22`는 정밀도 미지정 `NUMBER`로, 운영의 빈 소수점은 `0`으로 정규화합니다.
- 시퀀스 `START WITH`는 `DBMS_METADATA`가 현재 카운터(`LAST_NUMBER`)를 렌더링한 값이므로 스키마 Gap으로
  집계하지 않습니다(3.9.3).

비교 도구는 `table.txt`·`sequence.txt`를 원본 순서대로 파싱하고, `ITPOWN_DDL_live.sql`의 `CREATE TABLE`
블록·`CREATE SEQUENCE` 절·`COMMENT ON TABLE|COLUMN` 절을 파싱해 대조하는 일회성 Node 스크립트입니다
(스크래치 경로, 커밋 대상 아님). **직전 회차에서 확정된 수치를 그대로 재현**하는 것을 확인해 파서 정확성을
교차 검증했습니다 — `DEFAULT NULL` 32개 컬럼(목록 동일), 시퀀스 `CYCLE` Gap 14건(목록 동일),
`MAX VALUE` Gap 39건, `START WITH` 차이 50건, `VARCHAR2` `BYTE` 293개.

### 1.3 운영 기준 파일의 성격 — 직전 회차 전제 유지

직전 회차(2026-08-12) 1.3에서 정리한 **운영 기준 파일이 라이브 DB 추출본이 아니라 표 형식 정의서로
보이는 정황**은 이번에도 그대로입니다(시퀀스 `START WITH` 61건 전부 `1`, 15 유효자리 절삭,
`Default Value` 열에 `NULL` 표기 0건). 따라서 **컬럼 순서·시퀀스 `START WITH`·시퀀스 `MAX VALUE`
세 항목은 운영 DB의 실제 상태가 아니라 설계상 값일 수 있습니다.**

이번 회차에서 이 전제를 뒷받침하는 근거가 하나 더 확인됐습니다. 로컬 마이그레이션
`V20260730_003__NormalizeSequenceMaxValues.sql`이 로컬 시퀀스 `MAXVALUE`를 18자리(대상 컬럼이
`NUMBER(22)`인 2건만 22자리)로 통일했는데, 운영 파일의 값 39건이 **정확히 그 통일 후 값의 15 유효자리
절삭형**입니다. 운영이 통일 전 8종 분산 상태였다면 나올 수 없는 분포입니다(3.9.1).

**단, 이번 회차의 주요 Gap인 3.3~3.6은 이 유보의 영향을 받지 않습니다.** 해당 항목들은 운영 파일의
정밀도·표기 한계가 아니라 로컬 DDL 자체가 **로컬의 나머지 88개 테이블 규약과 어긋나는** 지점이기 때문에,
운영 DB 조회 없이도 확정할 수 있습니다.

### 1.4 운영 기준 파일의 이번 변경분 (미커밋)

`meta/table.txt`에 오늘 데이터 35행이 추가되었습니다. 내용은 세 갈래입니다.

| 변경 | 행수 | 의미 |
| --- | ---: | --- |
| `TPRMPP_CMENUL.IMK_NM` 추가 (6번째 위치) | 1 | **직전 회차 5.1 요청 반영** — 해당 Gap 해소 |
| `TPRMPP_BPROJM`·`BPROJL`에 금액 3종 추가 | 6 | 로컬 `V20260816_001` 대응분 |
| `TPRMPP_CLANGM`·`CLANGL` 신규 정의 | 28 | 로컬 `V20260815_001` 대응분 + **운영 전용 `CLANGL`** |

즉 운영 기준 파일은 로컬의 최근 변경 3건을 따라잡는 방향으로 갱신되었고, 그 과정에서 **로컬 설계와
어긋나는 부분이 새 Gap으로 드러났습니다**(3.3~3.6).

### 1.5 운영 시퀀스 파일은 이번 변경을 반영하지 않았습니다

`meta/sequence.txt`는 2026-08-12 이후 변경이 없어 `CLANGM`/`CLANGL` 관련 시퀀스가 없습니다.
운영이 정의한 `TPRMPP_CLANGL.LOG_HIS_TGR_SNO`(`NUMBER(18)`, PK)는 **로컬의 다른 37개 변경로그 테이블이
예외 없이 `SQ_TPRMPP_*L_1` 시퀀스로 채번**하는 것과 같은 구조인데, `SQ_TPRMPP_CLANGL_1`이 양쪽 어디에도
없습니다. 시퀀스 Gap 집계에서는 제외했으며 3.3의 방향 결정과 함께 정리해야 합니다.

## 2. 요약

| 항목 | 결과 | 성격 |
| --- | ---: | --- |
| 업무 테이블 | 로컬 89 / 운영 90 | 차이 1건 |
| 업무 컬럼 | 로컬 1,627 / 운영 1,643 | 차이 16건 (전부 `CLANGL`) |
| 시퀀스 | 로컬 61 / 운영 61 | 일치 |
| **운영 전용 테이블** | **1건 (`TPRMPP_CLANGL`, 16컬럼)** | **신규 — 방향 결정 필요** |
| 로컬 전용 테이블 | 0건 | — |
| **테이블 코멘트 Gap** | **1건 (`CLANGM`)** | **신규 — 로컬 규약 위반** |
| 운영 전용 컬럼 / 로컬 전용 컬럼 | 0건 / 0건 | 공통 89개 테이블 기준 |
| 컬럼 타입·길이·소수점 Gap | 0건 (표기 차이 2건 미집계) | 4장 |
| **컬럼 코멘트 Gap** | **3건 (`BPROJM` 금액)** | **신규 — 부연 유무** |
| **PK 구성 Gap** | **1건 (`CLANGM`)** | **신규 — 운영 정의서 오류 유력** |
| **NULL 제약 Gap** | **2건 (+PK 규칙에 가려진 2건)** | **신규 — 위와 동일 원인** |
| **기본값 Gap** | **7건** | 6건 신규 + 1건 이월 |
| 컬럼 순서 Gap (공통 컬럼 상대 순서) | 6테이블 | 5테이블 판단 유보 / **1테이블 실질** |
| 컬럼 순서 Gap (절대 위치) | 67건 | **5건 실질** / 62건 판단 유보 |
| `DEFAULT NULL` 표기 차이 (동작 동일) | 32건 | 조치 불필요 (직전 회차와 동일) |
| 시퀀스명 / `INCREMENT BY` / `MIN VALUE` Gap | 0건 | — |
| 시퀀스 `MAX VALUE` Gap | 39건 | 표기 아티팩트 유력 (이월) |
| **시퀀스 `CYCLE` Gap** | **14건** | **실질 Gap — 이월, 미조치** |
| 시퀀스 `START WITH` 차이 | 50건 | 런타임 카운터 (미집계) |

### 2.1 직전 회차(2026-08-12) 조치 현황

| 직전 항목 | 상태 |
| --- | --- |
| 5.1 `TPRMPP_CMENUL.IMK_NM` 운영 반영 | **해소** — 운영 기준 파일에 반영됨(1.4) |
| 5.2 `TPRMPP_CINFMM.INFM_SD_STS_C` 기본값 | 미해소 — 운영 여전히 `'10'` |
| 5.3 시퀀스 `CYCLE` 14건 로컬 정렬 | 미해소 — 해당 마이그레이션 미작성 확인 |
| 5.4 운영 실제값 확인 (컬럼 순서·`MAX VALUE`) | 미착수 — 유보 유지 |

### 2.2 이번 회차 결론

새로 조치가 필요한 항목은 **다국어 마스터(`CLANGM`/`CLANGL`) 관련 4건**과 **정보화사업 금액 3종 관련
2건**입니다. 전자는 운영 정의서와 로컬 구현이 서로 다른 설계를 갖고 있어 **어느 쪽이 정본인지 먼저 정해야**
하고, 후자는 문서·정의서 보완 성격입니다. 이월 2건(`CINFMM` 기본값, 시퀀스 `CYCLE`)은 그대로 남아 있습니다.

## 3. 상세 Gap

### 3.1 테이블명 — 1건 (운영 전용 `TPRMPP_CLANGL`)

| 방향 | 테이블 | 컬럼수 | 비고 |
| --- | --- | ---: | --- |
| 운영에만 존재 | `TPRMPP_CLANGL` (프로젝트관리_공통언어기본변경로그) | 16 | 로컬 미구현 |
| 로컬에만 존재 | — | — | 없음 |

컬럼 수 차이 16건은 전부 이 테이블입니다. 상세는 3.3.

### 3.2 테이블 코멘트 — 1건

| 테이블 | 운영 | 로컬 |
| --- | --- | --- |
| `TPRMPP_CLANGM` | `프로젝트관리_공통언어기본` | `구분언어마스터` |

나머지 88개 테이블의 코멘트는 전수 일치합니다. **로컬의 나머지 88개 테이블은 예외 없이
`프로젝트관리_` 접두어를 갖고 있으며, `CLANGM` 하나만 벗어나 있습니다.**
`V20260815_001__CreateLanguageTranslationMaster.sql`의 `COMMENT ON TABLE` 문이 원인입니다.

운영 파일의 정밀도 문제가 아니라 **로컬 DDL이 자기 저장소의 규약을 벗어난 경우**이므로 판단을 유보할
필요가 없습니다. 로컬 정렬 대상입니다(5.2).

### 3.3 운영 전용 테이블 `TPRMPP_CLANGL` — 방향 결정 필요

운영 정의서는 `CLANGM`에 대응하는 변경로그 테이블 `CLANGL`을 16컬럼으로 정의했습니다.

| # | 컬럼 | 타입 | 제약 | 코멘트 |
| ---: | --- | --- | --- | --- |
| 1 | `LOG_HIS_TGR_SNO` | `NUMBER(18)` | PK, NOT NULL | 로그이력전문일련번호 |
| 2 | `TC_ID_CONE` | `VARCHAR2(255)` | NOT NULL | 구분코드ID내용 |
| 3 | `DTT_LAN_C` | `VARCHAR2(2)` | NULL | 구분언어코드 |
| 4 | `TC_COL_NM` | `VARCHAR2(255)` | NULL | 구분코드컬럼명 |
| 5 | `TC_DES` | `VARCHAR2(2000)` | NULL | 구분코드설명 |
| 6 | `DTT_NM` | `VARCHAR2(100)` | NULL | 구분명 |
| 7 | `CHG_DTT_YN` | `VARCHAR2(1)` | NULL | 변경구분여부 |
| 8 | `CHG_DTM` | `DATE` | NOT NULL | 변경일시 |
| 9 | `CHG_USID` | `VARCHAR2(14)` | NULL | 변경사용자ID |
| 10~16 | 공통 감사 7컬럼 | — | 표준 기본값 | `FST_ENR_*` / `DEL_YN` / `GUID*` / `LST_CHG_*` |

구조는 로컬의 다른 37개 변경로그 테이블과 동일한 표준형입니다.

**로컬은 이 테이블을 갖고 있지 않으며, 이는 실수가 아니라 설계 판단으로 보입니다.**

- 다국어 설계 문서 3종(`docs/superpowers/specs/2026-08-15-multilingual-i18n-design.md`,
  `plans/2026-08-15-multilingual-i18n.md`, `plans/2026-08-15-multilingual-i18n-db-backend.md`)
  어디에도 `CLANGL`이 등장하지 않습니다. 산출물 목록은 `TPRMPP_CLANGM`, `PK_CLANGM`,
  `IX_TPRMPP_CLANGM_01` 세 개뿐입니다.
- 변경로그 테이블이 없는 기본 테이블은 이미 존재합니다 — `CDECIM`, `CFILEM`, `CINFMM`, `CRTOKM`
  4개는 **운영 정의서에도 대응 `*L`이 없습니다.** 즉 `*M`↔`*L` 짝은 전역 규약이 아닙니다.
- 변경로그는 DB 트리거가 아니라 애플리케이션이 씁니다(로컬 DDL의 `TRIGGERS` 절 비어 있음).
  백엔드에는 `TPRMPP_*L` 매핑 엔티티가 **정확히 37개** 있어 로컬 `*L` 테이블 37개와 1:1이며,
  `Clangl` 엔티티는 없습니다.

따라서 이 Gap은 **운영 정의서가 표준 템플릿을 기계적으로 적용한 결과**이거나, **운영 측이 번역 이력
보존을 요구한 것**이거나 둘 중 하나입니다. 어느 쪽인지에 따라 조치 방향이 정반대이므로 확인이
필요합니다(5.1). 로컬에 만들기로 한다면 `SQ_TPRMPP_CLANGL_1` 시퀀스, `Clangl` 엔티티, 번역 저장
경로의 로그 기록까지 함께 필요합니다(1.5).

### 3.4 `TPRMPP_CLANGM` 컬럼 순서 — 5건 (로컬 규약 위반, 실질 Gap)

| 컬럼 | 운영 위치 | 로컬 위치 |
| --- | ---: | ---: |
| `FST_ENR_USID` | 6 | 9 |
| `FST_ENR_DTM` | 7 | 10 |
| `DEL_YN` | 8 | 6 |
| `GUID` | 9 | 7 |
| `GUID_PRG_SNO` | 10 | 8 |

**로컬 89개 업무 테이블 중 88개가 공통 감사 컬럼을 예외 없이 아래 순서로 배치합니다.**

```
FST_ENR_USID → FST_ENR_DTM → DEL_YN → GUID → GUID_PRG_SNO → LST_CHG_USID → LST_CHG_DTM
```

`TPRMPP_CLANGM` 단 하나만 `DEL_YN → GUID → GUID_PRG_SNO → FST_ENR_USID → FST_ENR_DTM → LST_CHG_*`
순서입니다. `V20260815_001`의 `CREATE TABLE` 컬럼 나열 순서가 그대로 물리 순서가 된 것으로,
**운영 정의서가 정밀도를 잃었을 가능성과 무관하게 로컬 자체 규약 위반**입니다(3.7의 나머지 62건과
성격이 다릅니다).

다만 **정렬은 권하지 않습니다.** Oracle에서 컬럼 순서를 바꾸려면 테이블 재생성이 필요하고, 컬럼명 기반
매핑을 쓰는 이 프로젝트에서 동작 영향이 없기 때문입니다. **다음 신규 테이블에서 반복하지 않도록 규약을
기록하는 것**이 실질적 조치입니다(5.3).

### 3.5 `TPRMPP_CLANGM` PK 구성 — 1건

| | PK 컬럼 |
| --- | --- |
| 운영 | `TC_ID_CONE` (1컬럼) |
| 로컬 | `TC_ID_CONE`, `DTT_LAN_C`, `TC_COL_NM` (3컬럼, `PK_CLANGM`) |

**로컬이 정본이라고 판단합니다.** 운영 정의서대로 `TC_ID_CONE` 단일 PK면 하나의 대상에 대해
**언어를 하나만 저장할 수 있어 다국어 테이블의 목적 자체가 성립하지 않습니다.** 메뉴 하나에 한국어와
영어를 함께 넣을 수 없습니다.

로컬 3컬럼 복합키는 설계 문서와 코드, 테스트에 모두 명시되어 있습니다.

- `docs/superpowers/plans/2026-08-15-multilingual-i18n.md:16`
  — "번역 테이블명은 `TPRMPP_CLANGM`, PK는 `(TC_ID_CONE, DTT_LAN_C, TC_COL_NM)`이다."
- `it_backend/src/main/java/com/kdb/it/common/i18n/entity/Clangm.java` — `@IdClass(ClangmId.class)` 3필드
- `it_backend/src/test/java/com/kdb/it/common/i18n/entity/ClangmSchemaContractTest.java`
  — 세 컬럼 복합키를 계약으로 검증

운영 정의서 수정 요청 대상입니다(5.4). 운영 DB에 정의서대로 반영되면 영어 번역 저장이 실패합니다.

### 3.6 `TPRMPP_CLANGM` NULL 제약 — 2건 (+PK 제외 규칙에 가려진 2건)

집계된 2건입니다.

| 컬럼 | 운영 | 로컬 |
| --- | --- | --- |
| `TC_DES` | NULL 허용 | `NOT NULL` |
| `DTT_NM` | NULL 허용 | `NOT NULL` |

1.2의 "PK 컬럼은 NULL 비교 제외" 규칙 때문에 집계에서 빠졌지만, 실제로는 아래 2건도 어긋나 있습니다.
로컬에서는 PK 구성 컬럼이고 운영 정의서에서는 아니기 때문입니다.

| 컬럼 | 운영 | 로컬 |
| --- | --- | --- |
| `DTT_LAN_C` | NULL 허용 (PK 아님) | `NOT NULL` (PK 구성) |
| `TC_COL_NM` | NULL 허용 (PK 아님) | `NOT NULL` (PK 구성) |

즉 운영 정의서는 `TPRMPP_CLANGM`에서 `TC_ID_CONE`만 필수로 보고 나머지 4개 업무 컬럼을 전부 선택으로
정의했습니다. **3.5와 같은 원인으로 판단합니다** — 운영 정의서가 이 테이블을 "코드 하나에 설명 하나"
구조로 오해한 것으로 보입니다. 번역이 없는 행(`DTT_NM`·`TC_DES`가 비어 있는 행)은 조회 fallback 대상이
없어 의미가 없으므로, 로컬의 `NOT NULL`이 설계와 맞습니다. 5.4에 함께 묶었습니다.

### 3.7 컬럼 순서 (`CLANGM` 외) — 상대 5테이블 / 절대 62건, 판단 유보

절대 위치 Gap 67건의 테이블별 내역입니다.

| 테이블 | 건수 | 원인 컬럼 | 운영 위치 | 로컬 위치 | 성격 |
| --- | ---: | --- | ---: | ---: | --- |
| `TPRMPP_CMENUL` | 16 | `IMK_NM` | 6 | 21 (마지막) | 판단 유보 |
| `TPRMPP_BPROJL` | 13 | `TOT_RQM_AMT`/`MPL_AMT`/`DFR_AMT` | 40~42 | 50~52 (마지막) | 판단 유보 |
| `TPRMPP_CMENUM` | 13 | `IMK_NM` | 5 | 17 (마지막) | 판단 유보 |
| `TPRMPP_BPROJM` | 10 | `TOT_RQM_AMT`/`MPL_AMT`/`DFR_AMT` | 39~41 | 46~48 (마지막) | 판단 유보 |
| `TPRMPP_CFILEM` | 10 | `APG_FL_SZ` | 6 | 15 (마지막) | 판단 유보 |
| `TPRMPP_CLANGM` | 5 | 감사 컬럼 배치 | — | — | **실질 (3.4)** |

`CLANGM`을 뺀 62건은 원인이 하나로 같습니다. **로컬은 `ALTER TABLE ... ADD`로 추가해 물리적으로 마지막에
붙고, 운영 정의서는 컬럼을 논리적으로 어울리는 자리에 배치**했습니다. 나머지 83개 테이블은 절대 위치까지
전수 일치합니다.

직전 회차와 동일하게 **판단을 유보합니다.** 운영 DB에도 같은 `ALTER TABLE ... ADD`로 반영했다면 실제
`COLUMN_ID`는 로컬과 같이 마지막일 것이고, 그 경우 62건은 실재하지 않는 Gap입니다. 확인 쿼리는 5.7에
있습니다. `CMENUL.IMK_NM`은 직전 회차 요청(5.1)이 반영되면서 이번에 새로 이 목록에 들어왔습니다.

### 3.8 `TPRMPP_BPROJM` / `BPROJL` 금액 3종 — 기본값 6건 + 코멘트 3건

`V20260816_001__AddBprojmAmountColumns.sql`이 추가한 `TOT_RQM_AMT`(총소요금액) /
`MPL_AMT`(예정금액) / `DFR_AMT`(지급금액)입니다. 타입은 양쪽 모두 `NUMBER(18,3)`로 일치합니다.

#### 3.8.1 기본값 — 6건

| 테이블 | 컬럼 | 운영 | 로컬 |
| --- | --- | --- | --- |
| `TPRMPP_BPROJM` | `TOT_RQM_AMT` / `MPL_AMT` / `DFR_AMT` | (없음) | `DEFAULT 0` |
| `TPRMPP_BPROJL` | `TOT_RQM_AMT` / `MPL_AMT` / `DFR_AMT` | (없음) | `DEFAULT 0` |

마이그레이션이 `ALTER TABLE ... ADD ... NUMBER(18,3) DEFAULT 0`으로 추가한 결과입니다.
금액 컬럼에서 `0`과 `NULL`은 의미가 다르므로(`0`=금액 없음 확정, `NULL`=미입력) 정렬 대상입니다.
운영 반영을 권합니다(5.5) — 이 컬럼들은 신규라 기존 행이 `NULL`로 남을 수 있고, 합산 시
`NULL` 전파로 결과가 통째로 `NULL`이 되는 경로가 생깁니다.

**주의**: 운영 정의서의 `Default Value` 열은 `NULL` 표기를 한 건도 갖고 있지 않으므로(1.3),
"기본값 없음"과 "기본값 `NULL`"을 구분하지 못합니다. 운영 DB가 이미 `DEFAULT 0`일 가능성도 있습니다.

#### 3.8.2 컬럼 코멘트 — 3건

| 테이블 | 컬럼 | 운영 | 로컬 |
| --- | --- | --- | --- |
| `TPRMPP_BPROJM` | `TOT_RQM_AMT` | 총소요금액 | 총소요금액 (총 예산 = 활성품목 AMT 합계 스냅샷) |
| `TPRMPP_BPROJM` | `MPL_AMT` | 예정금액 | 예정금액 (예산연도+1 이후 = 활성품목 MPL_AMT 합계 스냅샷) |
| `TPRMPP_BPROJM` | `DFR_AMT` | 지급금액 | 지급금액 (기 지급예산, 사용자 입력) |

`BPROJL`의 같은 3컬럼은 마이그레이션이 부연 없는 코멘트를 붙여 **운영과 일치**합니다.
로컬 `BPROJM` 쪽 괄호 부연은 마이그레이션 주석이 경고한 의미 충돌을 컬럼 코멘트에 남긴 것입니다 —
"되살린 `TOT_RQM_AMT`의 의미는 드롭 전과 다르다. 드롭 전 = 당해예산, 이번 = 총 예산."

**로컬 표현이 더 정확하므로 로컬을 깎지 않기를 권합니다.** 운영 정의서의 한글명 열(`총소요금액`)은
메타 용어사전 기준 논리명이라 부연을 담기 어렵습니다. 나머지 89개 테이블 전체에서 코멘트 Gap은
이 3건뿐이므로, 정의서 쪽에 비고를 남기는 선으로 정리하면 충분합니다(5.6).

### 3.9 시퀀스

61개 시퀀스명이 **전수 일치**하며 어느 한쪽에만 있는 시퀀스는 없습니다.
`INCREMENT BY`(전부 1)와 `MIN VALUE`(전부 1)도 Gap 0건입니다.
`CLANGM`/`CLANGL` 관련 시퀀스는 운영 파일에 없어 비교 대상에서 빠졌습니다(1.5).

#### 3.9.1 `MAX VALUE` — 39건 (표기 아티팩트 유력, 조치 불필요)

| 운영 표기 | 로컬 실제값 | 건수 |
| --- | --- | ---: |
| `999999999999999000` | `999999999999999999` (9 × 18) | 37 |
| `9.99999999999999E21` | `9999999999999999999999` (9 × 22) | 2 (`SQ_TPRMPP_CLOGNH_1`, `SQ_TPRMPP_CRTOKM_1`) |

직전 회차와 동일한 39건이며 판정도 같습니다 — **운영 기준 파일의 15 유효자리 절삭**으로 봅니다.
근거는 직전 회차 3.7.1과 동일하고, 이번에 하나가 추가됐습니다.

로컬 값은 `V20260730_003__NormalizeSequenceMaxValues.sql`이 **의도적으로 통일한 값**입니다.
같은 스크립트가 밝히듯 통일 전 로컬은 `MAXVALUE`가 8종(4·5·7·8·9·10·22·28자리)으로 흩어져 있었고,
기준은 "숫자 컬럼 저장용은 대상 `NUMBER(p)`의 `p`자리, 문자열 채번용은 zero-padding 폭"입니다.
22자리 2건은 대상 컬럼이 `NUMBER(22)`라 예외로 남긴 것입니다(스크립트 94~95행).

운영 파일 39건이 **정확히 이 통일 후 값의 절삭형**이라는 사실은, 운영 값이 독립적으로 설정된 것이
아니라 같은 값을 정밀도 손실된 채로 옮겨 적은 것임을 시사합니다. 15자리 이하 `MAX VALUE`
(`9999`, `9999999`, `99999999`, `999999999`)는 여전히 전부 정확히 일치합니다.

#### 3.9.2 `CYCLE` — 14건 (실질 Gap, 이월·미조치)

운영은 `CYCLE = Y`, 로컬은 전부 `NOCYCLE`입니다. 대상 14개는 예외 없이 `MAX VALUE = 9999`인
기본(`*M`) 테이블 채번 시퀀스로, 직전 회차와 **목록이 동일**합니다.

`SQ_TPRMPP_BASCTM_1`, `BBUGTM_1`, `BCONTM_1`, `BCOSTM_1`, `BDELIM_1`, `BESTIM_1`, `BGDOCM_1`,
`BITEMM_1`, `BPAYMM_1`, `BPLANM_1`, `BPROJM_1`, `BRDOCM_1`, `BTERMM_1`, `CBLBCM_1`

`9999` 도달 시 운영은 `1`로 순환하고 로컬은 `ORA-08004`로 채번이 실패합니다. **로컬에서만 발생하는
장애**이며, 관리번호 4자리 포맷(`PRJ-2026-0001`) 설계와도 `NOCYCLE` 쪽이 어긋납니다.

직전 회차 5.3에서 정렬을 권고했으나 **해당 마이그레이션은 아직 작성되지 않았습니다**
(`it_database/migrations/`에 `CYCLE` 정렬 스크립트 없음). 근거와 스크립트 초안은 직전 회차 5.3에
그대로 남아 있으며 이번 회차에서도 판단 변경이 없습니다. 긴급도는 낮습니다 — 로컬 카운터 최대치는
`SQ_TPRMPP_BTERMM_1`의 474로 `9999`와 거리가 멉니다.

#### 3.9.3 `START WITH` — 50건 (스키마 Gap 아님, 미집계)

운영은 61개 전부 `1`이고 로컬은 50개가 `3` ~ `4,170` 범위입니다. `DBMS_METADATA`가
`START WITH`에 현재 카운터(`LAST_NUMBER`)를 렌더링하기 때문이며, 스키마 차이가 아니므로 조치
대상이 아닙니다(직전 3회차 동일 판정).

### 3.10 동작상 동일한 표기 차이 — 32건 (조치 불필요·정렬 불가)

로컬에만 `DEFAULT NULL`이 명시된 컬럼 32개로, **2026-08-01·2026-08-12 회차와 동일한 목록**입니다.
Oracle에서 `DEFAULT NULL`은 기본값 미지정과 동작이 같아 Gap으로 집계하지 않았습니다. 조치하지 않는
근거는 2026-08-01 회차에서 확정됐고 변동이 없습니다.

`BCONTM.LST_YN`, `BDELIM.LST_YN`/`TASK_DBR_OMT_YN`, `BESTIM.LST_YN`,
`BITEMM.ITR_INFR_YN`/`SECT_SYS_UTZ_YN`/`LST_YN`, `BPAYMM.LST_YN`, `BPROJM.DPL_YN`/`ODN_YN`,
`CAPPLM.DCD_REQ_DTM`, `CAUTHI.USE_YN`, `CBLBCM` 7개, `CBLBMM` 6개, `CCMMTM` 2개,
`CINFMM.INQ_YN`/`RE_TRY_NOT`, `CMENUD.USE_YN`, `CMENUM.HID_YN`, `CROLEI.USE_YN`

### 3.11 이월 Gap — `TPRMPP_CINFMM.INFM_SD_STS_C` 기본값

| 테이블 | 컬럼 | 코멘트 | 운영 | 로컬 |
| --- | --- | --- | --- | --- |
| `TPRMPP_CINFMM` | `INFM_SD_STS_C` | 알림발송상태코드 | `DEFAULT '10'` | `DEFAULT '01'` |

직전 회차 3.5·5.2와 동일합니다. `V20260808_001__AlignCinfmmDispatchStatusDefault.sql`이 기록한
정본 결정(BE-20)이며 로컬 드리프트가 아닙니다. 앱이 모든 INSERT에서 발송상태를 명시하므로 현재
동작 영향은 없습니다. 운영 반영 요청 상태가 유지됩니다(5.5).

## 4. 이번 비교로 확인할 수 없는 항목

운영 기준 파일에 정보가 없어 판정 대상에서 제외했습니다.

- **`NUMBER` 정밀도 미지정 여부** — 운영 파일은 `TPRMPP_CLOGNH.LGN_LOG_SNO`와
  `TPRMPP_CRTOKM.LGN_LOG_SNO`를 `NUMBER` 길이 `22`로 적었고 로컬은 `NUMBER(22,0)`입니다.
  Oracle에서 정밀도 미지정 `NUMBER`의 `DATA_LENGTH`도 22이므로 **운영 추출본만으로는 둘을 구분할 수
  없습니다.** 1.2의 정규화 규칙에 따라 Gap으로 집계하지 않았습니다(직전 회차 동일).
  로컬 값이 의도적이라는 근거는 있습니다 — `V20260730_003` 94~95행이 이 두 시퀀스의 대상 컬럼을
  `NUMBER(22)`로 명시합니다.
- **문자 길이 semantics (`CHAR` / `BYTE`)** — 운영은 길이 숫자만 제공합니다.
  로컬은 `VARCHAR2` 1,101개 중 **808개가 `CHAR`, 293개가 `BYTE`**(세션 기본값이라 미표기)이며
  **51개 테이블이 두 방식을 혼용**합니다. 직전 회차(799/293, 51테이블) 대비 `CHAR`가 9개 늘었는데,
  `V20260815_001`이 만든 `CLANGM`의 `VARCHAR2` 9개가 전부 `CHAR` 표기이기 때문입니다
  (`CLANGM`은 `BYTE`가 없어 혼용 테이블 수는 51개 그대로입니다).
  멀티바이트 저장 한계가 달라질 수 있어 별도 확인이 필요합니다.
- **인덱스, FK, CHECK 제약, UNIQUE 제약** — 운영은 PK 여부만 제공합니다.
  로컬에는 인덱스 67개(직전 66개 + `IX_TPRMPP_CLANGM_01`)와 CHECK 제약 17개(직전 15개 +
  `CK_CLANGM_DTT_COL`, `CK_CLANGM_DEL_YN`)가 있습니다. 특히 `CK_CLANGM_DTT_COL`은
  `DTT_NM`↔`TC_COL_NM` 조합을 제한하는 업무 규칙이라 운영 반영 여부 확인이 필요합니다.
- **시퀀스 `CACHE` / `ORDER` / `KEEP` / `SCALE`** — 운영 시퀀스 파일에 열이 없습니다.
  로컬은 61개 중 32개가 `CACHE 20`, 29개가 `NOCACHE`입니다.
- **`CLANGM`/`CLANGL` 시퀀스** — 운영 시퀀스 파일이 2026-08-12자라 신규 테이블을 담고 있지 않습니다(1.5).
- **뷰, 트리거, 프로시저** — 운영 기준 파일에 없습니다. 로컬에는 뷰 1개, 트리거 0개입니다.
- **컬럼 순서(3.7)·시퀀스 `MAX VALUE`(3.9.1)·`START WITH`의 운영 실제값** — 1.3의 이유로 기준 파일 값이
  운영 DB의 실제 상태와 다를 수 있습니다. 5.7의 쿼리로 확인해야 합니다.

## 5. 권고 조치

### 5.1 방향 결정 — `TPRMPP_CLANGL` 구현 여부 (3.3)

**먼저 정해야 하는 항목입니다.** 다른 조치와 달리 로컬·운영 어느 쪽이 정본인지가 정해져 있지 않습니다.

| 결정 | 필요한 작업 |
| --- | --- |
| **(A) 운영 정의가 정본** — 번역 이력 보존 필요 | 로컬에 `TPRMPP_CLANGL` + `SQ_TPRMPP_CLANGL_1` 마이그레이션 신규 작성, `Clangl` 엔티티 추가, 번역 저장 경로에 로그 기록 추가, 운영 `meta/sequence.txt` 갱신 |
| **(B) 로컬 정의가 정본** — 이력 불필요 | 운영 정의서에서 `TPRMPP_CLANGL` 28행 제거 요청 |

판단 근거는 3.3에 정리했습니다. **(B)를 권합니다** — 다국어 설계 문서 3종 어디에도 이력 요구사항이 없고,
`CDECIM`·`CFILEM`·`CINFMM`·`CRTOKM` 4개 선례처럼 변경로그가 없는 기본 테이블이 이미 운영 정의서에도
존재하기 때문입니다. 다만 이력 필요 여부는 업무 판단이므로 운영 측 확인이 필요합니다.

### 5.2 로컬 정렬 — `TPRMPP_CLANGM` 테이블 코멘트 (3.2)

로컬 89개 중 유일한 규약 이탈이므로 로컬을 맞춥니다.

```sql
-- it_database/migrations/V2026MMDD_NNN__AlignClangmTableComment.sql (미작성)
COMMENT ON TABLE ITPOWN.TPRMPP_CLANGM IS '프로젝트관리_공통언어기본';
```

`COMMENT ON TABLE`은 멱등이고 데이터·동작에 영향이 없어 가드가 필요 없습니다.
**적용된 `V20260815_001`은 Flyway 체크섬 대상이므로 수정하지 말고 새 버전 스크립트로 추가합니다.**
이 리포트에서는 작성하지 않았습니다 — 5.1의 방향 결정과 같은 스크립트로 묶는 편이 낫기 때문입니다.

### 5.3 규약 기록 — 공통 감사 컬럼 배치 순서 (3.4)

`TPRMPP_CLANGM`의 컬럼 순서 자체는 **정렬하지 않기를 권합니다**(테이블 재생성 비용 대비 동작 이득 없음).
대신 반복을 막기 위해 신규 테이블 DDL 규약을 문서에 남깁니다.

```
공통 감사 컬럼은 항상 테이블 끝에 아래 순서로 둔다.
FST_ENR_USID → FST_ENR_DTM → DEL_YN → GUID → GUID_PRG_SNO → LST_CHG_USID → LST_CHG_DTM
```

기록 위치는 `it_backend/docs/guides/persistence/data-model.md`(조회 인덱스 SoT)나 `meta/meta.txt`
(명명 규칙 SoT) 중 신규 테이블 작성 시 실제로 열어 보는 쪽이 적절합니다.
현행 89개 테이블 중 88개가 이미 이 순서이므로 새 규칙이 아니라 **암묵 규약의 명문화**입니다.

### 5.4 운영 정의서 수정 요청 — `TPRMPP_CLANGM` PK·NULL 제약 (3.5, 3.6)

운영 정의서의 `TPRMPP_CLANGM` 정의를 로컬 실제 DDL에 맞춰야 합니다.
**로컬을 바꾸는 방향이 아닙니다** — 운영 정의대로 반영되면 다국어 저장이 동작하지 않습니다.

| 컬럼 | 현재 정의서 | 정정 필요 |
| --- | --- | --- |
| `TC_ID_CONE` | PK, NOT NULL | 유지 |
| `DTT_LAN_C` | NULL 허용 | **PK, NOT NULL** |
| `TC_COL_NM` | NULL 허용 | **PK, NOT NULL** |
| `TC_DES` | NULL 허용 | **NOT NULL** |
| `DTT_NM` | NULL 허용 | **NOT NULL** |

`meta/table.txt`의 `TPRMPP_CLANGM` 5개 행의 `"PK여부"`·`"NULL여부"` 열 수정입니다.
정정 근거(설계 문서·엔티티·계약 테스트)는 3.5에 있습니다.

### 5.5 운영 반영 요청 — 기본값 2건 (3.8.1, 3.11)

```sql
-- 정보화사업 금액 3종 (신규)
ALTER TABLE TPRMPP_BPROJM MODIFY (TOT_RQM_AMT DEFAULT 0, MPL_AMT DEFAULT 0, DFR_AMT DEFAULT 0);
ALTER TABLE TPRMPP_BPROJL MODIFY (TOT_RQM_AMT DEFAULT 0, MPL_AMT DEFAULT 0, DFR_AMT DEFAULT 0);

-- 알림 발송상태 (직전 회차 이월)
ALTER TABLE TPRMPP_CINFMM MODIFY (INFM_SD_STS_C DEFAULT '01');
```

기존 행의 값은 건드리지 않습니다. 금액 3종은 운영 DB가 이미 `DEFAULT 0`일 가능성이 있으므로
(3.8.1의 주의), `ALL_TAB_COLUMNS.DATA_DEFAULT`를 먼저 확인하는 편이 낫습니다(5.7).
`CINFMM` 건의 배경과 되돌리기 방향은 직전 회차 5.2에 있습니다.

### 5.6 정의서 비고 — `TPRMPP_BPROJM` 금액 코멘트 (3.8.2)

로컬 코멘트를 깎지 않고, 운영 정의서 쪽에 의미 구분을 비고로 남기기를 권합니다.
`TOT_RQM_AMT`는 드롭 전(당해예산)과 이번(총 예산)의 의미가 달라, 논리명 `총소요금액`만으로는
응답 필드 `totRqmAmt`(당해예산)와 혼동될 수 있습니다.
근거는 `V20260816_001__AddBprojmAmountColumns.sql` 헤더 주석에 있습니다.

### 5.7 운영 실제값 확인 (판단 유보 항목 해소용)

3.7(컬럼 순서 62건)과 3.9.1(`MAX VALUE` 39건)은 운영 기준 파일이 정의서일 가능성 때문에 판정을
유보했습니다. 3.8.1의 기본값도 정의서가 `NULL`을 표기하지 않아 확인이 필요합니다.

```sql
-- 컬럼 실제 위치 (3.7)
SELECT table_name, column_name, column_id
  FROM all_tab_columns
 WHERE owner = 'ITPOWN'
   AND (table_name, column_name) IN (
        ('TPRMPP_CFILEM','APG_FL_SZ'),  ('TPRMPP_CMENUM','IMK_NM'), ('TPRMPP_CMENUL','IMK_NM'),
        ('TPRMPP_BPROJM','TOT_RQM_AMT'),('TPRMPP_BPROJL','TOT_RQM_AMT'))
 ORDER BY table_name, column_id;

-- 금액 3종 기본값 (3.8.1)
SELECT table_name, column_name, data_default
  FROM all_tab_columns
 WHERE owner = 'ITPOWN'
   AND table_name IN ('TPRMPP_BPROJM','TPRMPP_BPROJL')
   AND column_name IN ('TOT_RQM_AMT','MPL_AMT','DFR_AMT');

-- 시퀀스 실제 MAXVALUE / CYCLE / LAST_NUMBER (3.9.1, 3.9.2)
SELECT sequence_name, max_value, cycle_flag, last_number
  FROM all_sequences
 WHERE sequence_owner = 'ITPOWN'
 ORDER BY sequence_name;

-- CLANGM 실제 PK / NULL 제약 (3.5, 3.6) — 운영에 이미 생성되어 있다면
SELECT c.column_name, c.nullable, c.column_id, cc.constraint_name
  FROM all_tab_columns c
  LEFT JOIN all_cons_columns cc
    ON cc.owner = c.owner AND cc.table_name = c.table_name
   AND cc.column_name = c.column_name AND cc.constraint_name = 'PK_CLANGM'
 WHERE c.owner = 'ITPOWN' AND c.table_name = 'TPRMPP_CLANGM'
 ORDER BY c.column_id;
```

`column_id`가 각각 마지막이면 3.7의 62건은 소멸합니다.
`max_value`가 `999999999999999999`·`9999999999999999999999`면 3.9.1의 39건은 소멸합니다.

### 5.8 조치 현황

| 항목 | 건수 | 조치 | 상태 |
| --- | ---: | --- | --- |
| 3.3 `TPRMPP_CLANGL` | 1테이블 | **방향 결정 (5.1)** | **미착수 — 선행 과제** |
| 3.2 `CLANGM` 테이블 코멘트 | 1 | 로컬 마이그레이션 신규 (5.2) | 미착수 |
| 3.5·3.6 `CLANGM` PK·NULL | 1+4 | 운영 정의서 수정 요청 (5.4) | 미착수 (운영 측 작업) |
| 3.8.1 금액 3종 기본값 | 6 | 운영 반영 요청 (5.5) | 미착수 (운영 측 작업, 5.7 확인 후) |
| 3.11 `CINFMM` 기본값 | 1 | 운영 반영 요청 (5.5) | **미착수 — 직전 회차 이월** |
| 3.9.2 시퀀스 `CYCLE` | 14 | 로컬 마이그레이션 신규 | **미착수 — 직전 회차 이월** |
| 3.4 `CLANGM` 컬럼 순서 | 5 | 규약 문서화 (5.3) | 미착수 |
| 3.8.2 `BPROJM` 컬럼 코멘트 | 3 | 정의서 비고 (5.6) | 미착수 |
| 3.7 컬럼 순서 (그 외) | 62 | 판단 유보 → 5.7 확인 | 미착수 |
| 3.9.1 시퀀스 `MAX VALUE` | 39 | 판단 유보 → 5.7 확인 | 미착수 |
| 3.10 `DEFAULT NULL` 표기 | 32 | 조치 불필요 (정렬 불가) | — |
| 3.9.3 시퀀스 `START WITH` | 50 | 조치 불필요 (런타임 카운터) | — |

우선순위는 **5.1 → 5.4 → 5.2 → 나머지** 순입니다. 5.1은 다른 `CLANGM` 조치의 범위를 정하고,
5.4는 운영 DB에 정의서대로 반영될 경우 기능이 깨지는 유일한 항목입니다.

## 6. 재현 방법

본 리포트는 파일 대조만으로 산출했으며 DB에 접속하지 않았습니다. 재현하려면 1장의 세 파일을
같은 커밋 기준으로 두고 아래 규칙으로 대조하면 됩니다.

| 원본 | 파싱 대상 |
| --- | --- |
| `meta/table.txt` | 탭 구분 10열, 헤더 1행 제외, 테이블·컬럼 출현 순서 = 컬럼 순서 |
| `meta/sequence.txt` | 탭 구분 6열, 헤더 1행 제외 |
| `it_database/ITPOWN_DDL_live.sql` | `CREATE TABLE` 블록 / `CREATE SEQUENCE` 절 / `COMMENT ON TABLE\|COLUMN` 절 |

정규화 규칙은 1.2와 같습니다. 파싱 시 주의점 하나 — `DBMS_METADATA`가 출력하는
`COMMENT ON TABLE ... "  IS '...'`는 테이블명과 `IS` 사이에 **공백 2개**를 넣습니다
(`COMMENT ON COLUMN`은 1개). 공백 1개를 가정하면 테이블 코멘트 89건이 전부 미검출되어
거짓 Gap으로 잡힙니다.

로컬 DDL을 다시 추출해야 하면 `pwsh -File C:/it/it_database/export-ddl-live.ps1`을 사용합니다.
