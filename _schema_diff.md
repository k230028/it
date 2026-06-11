# 메타DB(table.csv) vs 현재DB(ITPAPP_DDL_live.sql) 스키마 비교

- 메타 테이블 수: 63
- 현재DB 테이블 수: 76

## 1. 테이블 차이

### 메타에만 있음 (현재DB 없음) : 0개

### 현재DB에만 있음 (메타 없음) : 13개
- TPRMPP_BCHKLC
- TPRMPP_BCONTL
- TPRMPP_BCONTM
- TPRMPP_BDELIL
- TPRMPP_BDELIM
- TPRMPP_BESTIL
- TPRMPP_BESTIM
- TPRMPP_BESTTL
- TPRMPP_BESTTM
- TPRMPP_BPAYML
- TPRMPP_BPAYMM
- TPRMPP_BPAYTL
- TPRMPP_BPAYTM

## 2. 공통 테이블 컬럼/타입 차이 (63개 테이블 검사)

### TPRMPP_CBLBCL
- 타입차이 `NAC_ID`: 메타=VARCHAR2(10) / 현재DB=VARCHAR2(16)

### TPRMPP_CBLBCM
- 타입차이 `NAC_ID`: 메타=VARCHAR2(10) / 현재DB=VARCHAR2(16)
