# 운영DB-로컬DB Gap 분석 결과

- 비교 입력
  - 로컬DB DDL: `C:\it\it_database\ITPOWN_DDL_live.sql`
  - 운영DB 메타: `C:\it\meta\table.csv`

## 요약
- 로컬 테이블/컬럼: 79 / 1447
- 운영 테이블/컬럼: 78 / 1433
- 엄격 비교 Gap: 292건
- 실질 비교 Gap: 69건
- 표현 차이로 제외: 223건

## 실질 Gap 카테고리
- COLUMN_COMMENT_DIFF: 21
- COLUMN_DEFAULT_DIFF: 8
- COLUMN_NULL_DIFF: 18
- COLUMN_ONLY_LOCAL: 16
- COLUMN_ONLY_PROD: 2
- COLUMN_TYPE_DIFF: 1
- TABLE_COMMENT_DIFF: 2
- TABLE_ONLY_LOCAL: 1

## 주요 내용
- 로컬에만 있는 테이블: FLYWAY_SCHEMA_HISTORY
- 운영에만 있는 테이블: 없음
- 실제 타입 불일치: TPRMPP_BASKPL.LOG_HIS_TGR_SNO local=NUMBER, prod=NUMBER(18)
- 운영에만 있는 컬럼: TPRMPP_BRDOCM.PRLM_HRK_OGZ_C_CONE, TPRMPP_CRTOKM.ECY_RNW_PUB_TOK_CONE
- 로컬에만 있는 주요 업무 컬럼: TPRMPP_BASKPL/TPRMPP_BASKPM.PRTY_IVG_OMT_RSN_TC, TPRMPP_BCOSTL.PRLM_HRK_OGZ_C_CONE, TPRMPP_BPROJL.SVN_TEM_C, TPRMPP_BRDOCL.SVN_DPM_C/SVN_TEM_C

## 결과 파일
- 전체 엄격 비교: `C:\it\meta\gap_analysis\db_gap_detail.csv`
- 실질 비교: `C:\it\meta\gap_analysis\db_gap_detail_normalized.csv`
- 요약 JSON: `C:\it\meta\gap_analysis\db_gap_summary_normalized.json`
