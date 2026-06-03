# ITPAPP 컬럼 코멘트 ↔ meta 표준용어 대조 분석

- 기준 시점: 2026-06-03 12:31:49 KST
- 기준 스키마: 라이브 DB `ITPAPP`의 `TPRMPP_%` 테이블
- 기준 표준: `C:/it/meta.csv` (`표준용어물리명`, `표준용어논리명`)
- 판정 기준: 컬럼 물리명으로 meta를 찾고, DB 컬럼 코멘트에서 `(메타등록필요)` 표기를 제거한 값이 meta 논리명과 같은지 비교
- 메타에 없는 용어는 `...(메타등록필요)`로 표기
- 상세 표는 동일 컬럼/코멘트 조합을 사용테이블 기준으로 묶어 표시

## 1. 요약

| 구분 | 건수 | 설명 |
|---|---:|---|
| 전체 컬럼 | 1125 | 라이브 DB 테이블 컬럼 |
| 코멘트 있음 | 1035 | DB `USER_COL_COMMENTS` 기준 |
| 코멘트 누락 | 90 | 코멘트가 NULL/빈 문자열 |
| 코멘트-메타 일치 | 924 | 물리명 등록 + 논리명 일치 |
| 메타 미등록 | 96 | 물리명이 meta.csv에 없음 |
| 코멘트 불일치 | 15 | 물리명은 있으나 코멘트가 meta 논리명과 다름 |

> 요약 건수는 실제 컬럼 단위 집계이며, 아래 표는 같은 컬럼/코멘트 조합을 묶어 표시합니다.

## 2. 코멘트 누락 컬럼

| 컬럼 | 타입 | 사용테이블 | meta 표준논리명 | 비고 |
|---|---|---|---|---|
| `ASG_RT` | NUMBER(8,5) | BBUGTL | 배정률 | 코멘트 추가 필요 |
| `C_SQN_SNO` | NUMBER(9) | CCODEL | 코드순서일련번호 | 코멘트 추가 필요 |
| `CHG_TC` | VARCHAR2(1) | BRDOCL | CHG_TC(메타등록필요) | 코멘트 추가 필요 |
| `CMMT_DEP_NBR` | NUMBER(4) | CCMMTL | 댓글깊이수 | 코멘트 추가 필요 |
| `CMMT_SQN_SNO` | NUMBER(9) | CCMMTL | 댓글순서일련번호 | 코멘트 추가 필요 |
| `CNFM_YN` | VARCHAR2(1) | BCMMTM | 확인여부 | 코멘트 추가 필요 |
| `FST_ENR_DTM` | DATE | BBUGTL, BCOSTL, BCOSTM, BGDOCL, BITEML, BPLANL, BPROJL, BRDOCL, BRIVGL, BRIVGM, CAPPLL, CBLBCL, CBLBCM, CBLBML, CBLBMM, CCMMTL, CCMMTM, CCODEL, CCODEM, CINFMM, CLOGNH | 최초등록일시 | 코멘트 추가 필요 |
| `GUID_PRG_SNO` | NUMBER(4) | BBUGTL, BCOSTL, BCOSTM, BGDOCL, BITEML, BPLANL, BPROJL, BRDOCL, BRIVGM, CAPPLL, CBLBCL, CBLBCM, CBLBMM, CCODEM, CINFMM, CLOGNH | GUID진행일련번호 | 코멘트 추가 필요 |
| `IPM_OPNN_SNO` | NUMBER(9) | BRIVGL, BRIVGM | 개선의견일련번호 | 코멘트 추가 필요 |
| `LGN_DTM` | DATE | CLOGNH | 로그인일시 | 코멘트 추가 필요 |
| `LOG_HIS_TGR_SNO` | NUMBER(18) | BBUGTL, BCOSTL, BGDOCL, BITEML, BPLANL, BPROJL, BRDOCL, CBLBCL | 로그이력전문일련번호 | 코멘트 추가 필요 |
| `LST_CHG_DTM` | DATE | BBUGTL, BCOSTL, BCOSTM, BGDOCL, BITEML, BPLANL, BPROJL, BRDOCL, BRIVGL, BRIVGM, CAPPLL, CBLBCL, CBLBCM, CBLBML, CBLBMM, CCMMTL, CCMMTM, CCODEL, CCODEM, CINFMM, CLOGNH | 최종변경일시 | 코멘트 추가 필요 |
| `PRJ_BG_AMR` | NUMBER(18,3) | BPOVWL, BPOVWM | PRJ_BG_AMR(메타등록필요) | 코멘트 추가 필요 |
| `QTN_ENO` | VARCHAR2(32) | BMQNAL, BMQNAM, BPQNAL, BPQNAM | QTN_ENO(메타등록필요) | 코멘트 추가 필요 |
| `REP_ENO` | VARCHAR2(32) | BMQNAL, BMQNAM, BPQNAL, BPQNAM | REP_ENO(메타등록필요) | 코멘트 추가 필요 |
| `SNO` | NUMBER(9) | BBUGTL, BPROJL | 일련번호 | 코멘트 추가 필요 |
| `SRE_SQN_SNO` | NUMBER(9) | CBLBML | 화면순서일련번호 | 코멘트 추가 필요 |
| `VLR_TC` | VARCHAR2(32) | BCMMTL, BCMMTM | VLR_TC(메타등록필요) | 코멘트 추가 필요 |

## 3. 메타 미등록 코멘트

| 컬럼 | 타입 | 사용테이블 | 현재 코멘트 | 현행 표기 |
|---|---|---|---|---|
| `ASCT_ID` | VARCHAR2(32) | BASCTL, BASCTM, BCHKLC, BCHKLL, BCHKLM, BCMMTL, BCMMTM, BEVALL, BEVALM, BMQNAL, BMQNAM, BPERFL, BPERFM, BPOVWL, BPOVWM, BPQNAL, BPQNAM, BRSLTL, BRSLTM, BSCHDL, BSCHDM | 협의회ID | 협의회ID(메타등록필요) |
| `ASCT_STS_C` | VARCHAR2(3) | BASCTL, BASCTM | 협의회상태코드 | 협의회상태코드(메타등록필요) |
| `CKG_ITM_C` | VARCHAR2(20) | BCHKLC, BCHKLL, BCHKLM, BEVALL, BEVALM | 점검항목코드 | 점검항목코드(메타등록필요) |
| `CKG_RCRD` | NUMBER(10) | BCHKLC, BCHKLL, BCHKLM, BEVALL, BEVALM | 점검점수 | 점검점수(메타등록필요) |
| `CNRC_TM` | VARCHAR2(6) | BASCTL, BASCTM | 회의시간 | 회의시간(메타등록필요) |
| `DBR_TC` | VARCHAR2(20) | BASCTL, BASCTM | 심의유형코드 | 심의유형코드(메타등록필요) |
| `DSD_DT` | VARCHAR2(8) | BSCHDL, BSCHDM | 일정일자 | 일정일자(메타등록필요) |
| `DSD_TM` | VARCHAR2(10) | BSCHDL, BSCHDM | 일정시간 | 일정시간(메타등록필요) |
| `DTP_CONE` | VARCHAR2(1000) | BPERFL, BPERFM | 성과지표정의 | 성과지표정의(메타등록필요) |
| `DTP_NM` | VARCHAR2(200) | BPERFL, BPERFM | 성과지표명 | 성과지표명(메타등록필요) |
| `DTP_SNO` | NUMBER(10) | BPERFL, BPERFM | 지표일련번호 | 지표일련번호(메타등록필요) |
| `EDRT_NM` | VARCHAR2(100) | BPOVWL, BPOVWM | 전결권명 | 전결권명(메타등록필요) |
| `FL_MNG_NO` | VARCHAR2(32) | BPOVWL, BPOVWM | 첨부파일관리번호 | 첨부파일관리번호(메타등록필요) |
| `FL_MNG_NO` | VARCHAR2(32) | BRSLTL, BRSLTM | 관련자료 첨부파일관리번호 | 관련자료 첨부파일관리번호(메타등록필요) |
| `GL_NV_CONE` | VARCHAR2(200) | BPERFL, BPERFM | 목표수치내용 | 목표수치내용(메타등록필요) |
| `KPN_TC` | VARCHAR2(10) | BPOVWL, BPOVWM | 저장구분코드 | 저장구분코드(메타등록필요) |
| `LGL_RGL_NM` | VARCHAR2(500) | BPOVWL, BPOVWM | 법률규제명 | 법률규제명(메타등록필요) |
| `LGL_RGL_YN` | VARCHAR2(1) | BPOVWL, BPOVWM | 법률규제여부 | 법률규제여부(메타등록필요) |
| `MSM_CLE` | VARCHAR2(100) | BPERFL, BPERFM | 측정주기 | 측정주기(메타등록필요) |
| `MSM_MANR_CONE` | VARCHAR2(1000) | BPERFL, BPERFM | 측정방법내용 | 측정방법내용(메타등록필요) |
| `MSM_PTM_CONE` | VARCHAR2(100) | BPERFL, BPERFM | 측정시점내용 | 측정시점내용(메타등록필요) |
| `NCS_CONE` | VARCHAR2(1000) | BPOVWL, BPOVWM | 필요성내용 | 필요성내용(메타등록필요) |
| `PRJ_BG_AMT` | NUMBER(18,3) | BPOVWL, BPOVWM | 프로젝트예산금액 | 프로젝트예산금액(메타등록필요) |
| `PRJ_DES` | VARCHAR2(1000) | BPOVWL, BPOVWM | 프로젝트설명 | 프로젝트설명(메타등록필요) |
| `PRJ_MNG_NO` | VARCHAR2(32) | BASCTL, BASCTM | 프로젝트관리번호 | 프로젝트관리번호(메타등록필요) |
| `PRJ_SNO` | NUMBER(10) | BASCTL, BASCTM | 프로젝트순번 | 프로젝트순번(메타등록필요) |
| `PRJ_TRM_CONE` | VARCHAR2(100) | BPOVWL, BPOVWM | 프로젝트기간내용 | 프로젝트기간내용(메타등록필요) |
| `PSB_YN` | VARCHAR2(1) | BSCHDL, BSCHDM | 가능여부 | 가능여부(메타등록필요) |
| `QTN_USID` | VARCHAR2(14) | BMQNAL, BMQNAM, BPQNAL, BPQNAM | 질의사용자ID | 질의사용자ID(메타등록필요) |
| `REP_USID` | VARCHAR2(14) | BMQNAL, BMQNAM, BPQNAL, BPQNAM | 답변사용자ID | 답변사용자ID(메타등록필요) |
| `REP_YN` | VARCHAR2(1) | BMQNAL, BMQNAM, BPQNAL, BPQNAM | 답변여부 | 답변여부(메타등록필요) |
| `RSLV_YN` | VARCHAR2(1) | BRIVGL | 해결여부 | 해결여부(메타등록필요) |
| `XPT_EFF_CONE` | VARCHAR2(1000) | BPOVWL, BPOVWM | 기대효과내용 | 기대효과내용(메타등록필요) |

## 4. meta 등록 용어와 코멘트 불일치

| 컬럼 | 타입 | 사용테이블 | 현재 코멘트 | meta 표준논리명 | meta 타입 |
|---|---|---|---|---|---|
| `FLF_FSG_DT` | VARCHAR2(8) | BPROJL, BPROJM | 의무완료기한 | 이행완료일자 | VARCHAR2(8) |
| `FST_DFR_DT` | VARCHAR2(8) | BCOSTL, BCOSTM | 지급예정월 | 최초지급일자 | VARCHAR2(8) |
| `FST_ENR_DTM` | DATE | BTERML | 최종변경일시 | 최초등록일시 | DATE |
| `IT_PRJ_RMK` | VARCHAR2(600) | BPLANL, BPLANM | IT예산비고 | IT프로젝트비고 | VARCHAR2(600) |
| `RFR_CONE` | VARCHAR2(4000) | BRIVGL, BRIVGM | 인용내용 | 참조내용 | VARCHAR2(4000) |
| `RFR_ID` | VARCHAR2(14) | BRIVGL, BRIVGM | 표시ID | 참조ID | VARCHAR2(14) |
| `RPL_OPNN_TC` | VARCHAR2(2) | BRIVGL, BRIVGM | 의견유형 | 회신의견구분코드 | VARCHAR2(2) |
| `RVW_FSG_TLM_DT` | VARCHAR2(8) | BRDOCL, BRDOCM | 완료기한 | 리뷰완료기한일자 | VARCHAR2(8) |

## 5. 산출 파일

- 원천 추출: 라이브 DB `USER_TAB_COLUMNS`, `USER_COL_COMMENTS`
- 본 문서는 라이브 DB 코멘트 기준으로 재생성됨
