# DB Gap Analysis Result

- Generated: 2026-07-06 21:58:42 KST
- Local DB source: C:/it/it_database/ITPOWN_DDL_live.sql
- Production DB source: C:/it/meta/table.txt
- Excluded tables: FLYWAY_SCHEMA_HISTORY, TPRMPP_BASKPM, TPRMPP_BASKPL
- Type normalization: NUMBER(n,0) is treated as NUMBER(n).
- Default normalization: DEFAULT NULL is treated as no default.

## Summary

| Item | Count |
| --- | --- |
| Local table count | 76 |
| Production table count | 76 |
| Common table count | 76 |
| Local column count | 1397 |
| Production column count | 1400 |
| Local-only tables | 0 |
| Production-only tables | 0 |
| Table comment differences | 0 |
| Local-only columns | 0 |
| Production-only columns | 3 |
| Column type differences | 0 |
| Column comment differences | 5 |
| NULL flag differences | 5 |
| PK flag differences | 0 |
| Default differences | 1 |

## Local-only Tables

| Table | Local table comment |
| --- | --- |

## Production-only Tables

| Table | Production table comment |
| --- | --- |

## Table Comment Differences

| Table | Production | Local |
| --- | --- | --- |

## Local-only Columns

| Table | Column | Local type | Local comment |
| --- | --- | --- | --- |

## Production-only Columns

| Table | Column | Production type | Production comment |
| --- | --- | --- | --- |
| TPRMPP_BRDOCL | PRLM_HRK_OGZ_C_CONE | VARCHAR2(100) | 인사상위조직코드내용 |
| TPRMPP_BRDOCM | PRLM_HRK_OGZ_C_CONE | VARCHAR2(100) | 인사상위조직코드내용 |
| TPRMPP_CRTOKM | ECY_RNW_PUB_TOK_CONE | VARCHAR2(900) | 암호화갱신발행토큰내용 |

## Column Type Differences

| Table | Column | Production type | Local type |
| --- | --- | --- | --- |

## Column Comment Differences

| Table | Column | Production comment | Local comment |
| --- | --- | --- | --- |
| TPRMPP_BPROJA | CNCD_RFR_NO | 관련참조번호 | 관련참조번호(단계 원본문서 key) |
| TPRMPP_CCODEL | CO_C_ID_NM | 공통코드ID명 | 공통코드ID |
| TPRMPP_CCODEM | CO_C_ID_NM | 공통코드ID명 | 공통코드ID |
| TPRMPP_CRTOKM | AVL_YN | 유효여부 | 유효여부(Y=활성 토큰, N=회전된 구토큰 → 재제출 시 재사용 탐지) |
| TPRMPP_CRTOKM | FAM_NM | 가족명 | 가족명(토큰패밀리=로그인 1회, 재사용 탐지용) |

## NULL Flag Differences

| Table | Column | Production NULL | Local NULL |
| --- | --- | --- | --- |
| TPRMPP_BPROJM | ABUS_MNG_NO | N | Y |
| TPRMPP_BPROJM | SNO | N | Y |
| TPRMPP_CRTOKM | FAM_NM | Y | N |
| TPRMPP_CRTOKM | LGN_LOG_SNO | N | Y |
| TPRMPP_CUSERI | ENO | N | Y |

## PK Flag Differences

| Table | Column | Production PK | Local PK |
| --- | --- | --- | --- |

## Default Differences

| Table | Column | Production default | Local default |
| --- | --- | --- | --- |
| TPRMPP_CRTOKM | FAM_NM |  | 'LEGACY' |
