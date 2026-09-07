# 운영 DB 반영 사항 백로그

운영 DB 현황 it\meta\table.txt (테이블), it\meta\sequence.txt (시퀀스), it\meta\index.txt (인덱스) 기준 변경이 필요한 내용을 아래의 양식으로 정리한다.

로컬 마이그레이션 `V20260907_002`(정보화사업 본문 CLOB 전환·가이드 문서 분류)의 컬럼 변경은 운영 `table.txt`(2026-09-07 12:51 추출)에 이미 반영돼 있다. 운영에 남은 것은 인덱스 교체와 데이터 보정 확인이다. 운영에는 `BAK_*` 백업 테이블이 없으므로 `V20260907_002` 스크립트를 그대로 실행하면 사전 진단(구 컬럼 존재 확인)에서 실패한다. 아래 항목은 스크립트의 해당 구간만 발췌해 적용한다.

## 1. 테이블

- 변경 구분 : 신규/수정/삭제

| NO | 테이블명  | 테이블한글명 | 컬럼명 | PK여부 | NULL여부 | Default Value | 타입	길이 | 소수점 | 변경 구분 | 작성일자   |
| -- | --------- | ------------ | ------ | ------ | -------- | ------------- | --------- | ------ | --------- | ---------- |
|    | 해당 없음 |              |        |        |          |               |           |        |           | 2026-09-07 |

> **반영 확인** — `TPRMPP_BPROJM`·`TPRMPP_BPROJL`의 CLOB 4개(`ABUS_PUL_CONE_INF`·`ABUS_XPT_EFF_INF`·`ABUS_PUL_DRCN_INF`·`ABUS_PUL_NCS_INF`) 추가와 구 컬럼 4개(`ABUS_CONE`·`DGOG_PPO_CONE`·`ABUS_RNG_CONE`·`ABUS_NCS_CONE`) 삭제, `TPRMPP_BGDOCM`·`TPRMPP_BGDOCL`의 `DOC_DTL_ITM_C VARCHAR2(2)` 추가는 2026-09-07 운영 `table.txt`에 존재한다. 로컬 재추출 DDL과 컬럼·타입·코멘트가 일치한다.

## 2. 인덱스

- 변경 구분 : 신규/수정/삭제

| NO | 테이블명 | 인덱스명 | UNIQUE여부 | 인덱스종류 | DB접속대상명 | DB스키마명 | 인덱스스페이스 | 인덱스컬럼(조합) | 인덱스구성유형 | FBI스크립트 | 설명 | 변경 구분 | 작성일자 |
| -- | -------- | -------- | ---------- | ---------- | ------------ | ---------- | -------------- | ---------------- | -------------- | ----------- | ---- | --------- | -------- |
| 1 | TPRMPP_BGDOCM | IX_TPRMPP_BGDOCM_01 | 예 |  | DPRMDB | ITPOWN | TSIITP01 | DEL_YN,ASC;DOC_MNG_NO,ASC;DOC_TTL_CONE,ASC | 일반(컬럼구성) |  | 운영 실측(2026-09-07 `index.txt`)은 함수 기반이 아닌 일반 UNIQUE 인덱스이며 PK `DOC_MNG_NO`를 포함해 유일성 효과가 없다. 통합 인덱스 NO 2로 대체한다 | 삭제 | 2026-09-07 |
| 2 | TPRMPP_BGDOCM | IX_TPRMPP_BGDOCM_02 | 예 |  | DPRMDB | ITPOWN | TSIITP01 | DOC_DTL_ITM_C,ASC;DOC_TTL_CONE,ASC | Function Based Index | CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BGDOCM_02 ON ITPOWN.TPRMPP_BGDOCM (CASE WHEN DEL_YN = 'N' THEN DOC_DTL_ITM_C END, CASE WHEN DEL_YN = 'N' THEN DOC_TTL_CONE END); | 문서상세항목코드와 제목 조합별로 활성 문서 하나만 허용한다. 접두어별 인덱스와 길라잡이 인덱스를 하나로 대체한다 | 신규 | 2026-09-07 |

### 인덱스 항목별 근거와 선행 조건

| NO | 근거 | 선행 조건 |
| -- | ---- | --------- |
| 1 | 2026-09-07 20:22 운영 `index.txt` 실측에 존재한다. 로컬은 `V20260907_002`가 이미 제거했다 | 없음(삭제만 수행). `UX_BGDOCM_*`는 운영에 없다 |
| 2 | 2026-09-07 20:22 운영 `index.txt` 실측에 없다. 로컬 재추출 DDL(20:14)에 같은 정의로 존재하며 Oracle은 `CASE "DEL_YN" WHEN 'N' THEN ... END` 단순 CASE로 저장한다 | 데이터 보정 NO 2가 끝나 활성 문서의 코드·제목 중복 그룹이 0건이어야 UNIQUE 생성이 성공한다 |

> **반영 확인** — 2026-09-01 등록한 `IX_TPRMPP_CAPPLA_02`·`IX_TPRMPP_BPROJM_02`는 2026-09-07 운영 `index.txt` 실측에 존재해 백로그에서 제외했다. `IX_TPRMPP_BPROJM_02`는 PK `(ABUS_MNG_NO, SNO)`와 선두 컬럼이 겹치므로 실효성 재검토는 별도 과제로 남는다.

## 3. 시퀀스

- 변경 구분 : 신규/수정/삭제

| NO | Sequence  | Name | Value | Min Value | Max Value | Increment | Cache | Cycle | Ordered | 변경 구분 | 작성일자   |
| -- | --------- | ---- | ----- | --------- | --------- | --------- | ----- | ----- | ------- | --------- | ---------- |
|    | 해당 없음 |      |       |           |           |           |       |       |         |           | 2026-09-07 |

## 4. 데이터 보정

메타 파일로는 데이터 반영 여부를 알 수 없다. 각 항목은 확인 조회를 먼저 실행하고, 기대값과 다를 때만 `V20260907_002`의 해당 구간을 적용한다.

| NO | 대상 | 변경 내용 | 선행 조건 | 작성일자 |
| -- | ---- | --------- | --------- | -------- |
| 1 | TPRMPP_BPROJM, TPRMPP_BPROJL | 구 컬럼 값이 신 CLOB 컬럼으로 복사됐는지 확인. 구 컬럼은 이미 삭제됐으므로 재복사는 불가능하며, 누락 시 컬럼 변경 전 백업본에서 복구한다 | 확인 조회: `SELECT COUNT(*) FROM ITPOWN.TPRMPP_BPROJM WHERE LST_YN='Y' AND DEL_YN='N' AND ABUS_PUL_CONE_INF IS NULL AND ABUS_XPT_EFF_INF IS NULL AND ABUS_PUL_DRCN_INF IS NULL AND ABUS_PUL_NCS_INF IS NULL` 결과가 컬럼 변경 전 본문 미보유 건수와 맞아야 한다 | 2026-09-07 |
| 2 | TPRMPP_BGDOCM, TPRMPP_BGDOCL | `DOC_DTL_ITM_C` 분류: `CDOC-%` 또는 제목 `SPEED_DIAL_CONTACT_INFO`→`04`, `PDOC-%` 또는 제목 `common.popup`·`project.approval-authority`→`05`, `FDOC-%`→`02`, `BNOTE-%`→`03`, `GDOC-%`→`01` | 확인 조회: `SELECT COUNT(*) FROM ITPOWN.TPRMPP_BGDOCM WHERE DEL_YN='N' AND DOC_DTL_ITM_C IS NULL` 기대값 0. 0이 아니면 스크립트의 `UPDATE ... SET DOC_DTL_ITM_C = CASE ...` 구간(BGDOCM·BGDOCL)을 적용한다. 사후 코드·제목 조합 중복 그룹 0건 확인 후 인덱스 NO 2를 생성한다 | 2026-09-07 |
| 3 | TPRMPP_CCODEM | 공통코드 `DOC_DTL_ITM_C` 5건 등록: `01` 사업 가이드, `02` 길라잡이, `03` 사용자가이드, `04` 담당자 정보, `05` 안내 팝업 (`STT_DT=20260101`, `END_DT=99991231`, 등록자 `MIGRATION`) | 확인 조회: `SELECT COUNT(*) FROM ITPOWN.TPRMPP_CCODEM WHERE CO_C_ID_NM='DOC_DTL_ITM_C' AND DEL_YN='N'` 기대값 5. 미달이면 스크립트의 `INSERT ... WHERE NOT EXISTS` 구간을 적용한다(재실행 안전) | 2026-09-07 |

## 5. 보류

| 항목 | 내용 | 작성일자 |
| ---- | ---- | -------- |
| PK 제약·인덱스 명명 | 운영은 92개 전부 `PK_TPRMPP_{접미}`, 로컬은 62개가 `PK_{접미}` 등 짧은 형식이다. 컬럼 구성은 전부 일치해 운영 변경은 없다. 규약 확정 뒤 로컬 개명 여부를 별도 결정한다 | 2026-09-07 |

## 근거 문서

- [`it_database/migrations/V20260907_002__ClassifyGuideDocumentsAndExpandProjectContent.sql`](../it_database/migrations/V20260907_002__ClassifyGuideDocumentsAndExpandProjectContent.sql) — 인덱스 교체·데이터 보정 SQL 원문(운영에는 해당 구간만 발췌 적용)
- [`docs/db-schema-gap/db-schema-gap-2026-09-07.md`](../docs/db-schema-gap/db-schema-gap-2026-09-07.md) — 운영 실측 `index.txt`·로컬 재추출 DDL 비교 결과
- [`docs/superpowers/plans/2026-09-01-guide-content-migration.md`](../docs/superpowers/plans/2026-09-01-guide-content-migration.md) — 사업 가이드 제목 유일성 요구
- [`it_database/docs/operations/2026-09-03-bgdoc-namespace-index-handover.md`](../it_database/docs/operations/2026-09-03-bgdoc-namespace-index-handover.md) — 접두어 기반 BGDOC 인덱스의 이전 인계 기록(통합 인덱스로 대체됨)
