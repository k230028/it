# 관리자 메뉴 신설
아래의 기능들을 관리자 메뉴로 신설

## 공통 요청사항
  - 상단 메뉴바 [관리자] 추가
  - [관리자] 메뉴는 우측에 노란색 왕관 모양의 svg 이미지 반영
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-yellow-500">
      <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z" />
      <path d="M19 18H5V20H19V18Z" />
    </svg>
  - [관리자] 메뉴 클릭 시 [대시보드] 화면으로 이동
  - GUID, GUID_PRG_SNO 컬럼은 화면에 표시하지 않음
  - ENO(사원번호), FST_ENR_USID(최초생성자), LST_CHG_USID(마지막수정자)는 '사원번호' 형태가 아닌 이름으로 표기
  - '이름' 클릭 시 공통 컴포넌트로 [직원정보] 다이얼로그 팝업 반영

## 대상 기능
 1. 공통코드 관리 : 조회 테이블 (공통코드 테이블) 및 수정(인라인 편집)/추가/삭제 기능
  - 사용자 및 조직 정보과 join하여 사원번호, 이름, 직위, 팀, 부서 정보 함께 조회
  - 테이블명 : TAAABB_CCODEM
  - 컬럼
컬럼명	Type	Type Mod	#	Not Null	디폴트	Comment
C_ID	VARCHAR2(32)	[NULL]	1	true	[NULL]	코드ID
C_NM	VARCHAR2(100)	[NULL]	2	false	[NULL]	코드명
CDVA	VARCHAR2(100)	[NULL]	3	false	[NULL]	코드값
C_DES	VARCHAR2(500)	[NULL]	4	false	[NULL]	코드설명
CTT_TP	VARCHAR2(100)	[NULL]	5	false	[NULL]	코드값구분
CTT_TP_DES	VARCHAR2(500)	[NULL]	6	false	[NULL]	코드값구분설명
STT_DT	DATE	[NULL]	7	false	[NULL]	시작일자
END_DT	DATE	[NULL]	8	false	[NULL]	종료일자
DEL_YN	VARCHAR2(1)	[NULL]	9	false	[NULL]	삭제여부
FST_ENR_DTM	DATE	[NULL]	10	false	[NULL]	최초생성시간
FST_ENR_USID	VARCHAR2(14)	[NULL]	11	false	[NULL]	최초생성자
GUID	VARCHAR2(38)	[NULL]	12	false	[NULL]	일련번호
GUID_PRG_SNO	NUMBER(4,0)	[NULL]	13	false	[NULL]	일련번호2
LST_CHG_DTM	DATE	[NULL]	14	false	[NULL]	마지막수정시간
LST_CHG_USID	VARCHAR2(14)	[NULL]	15	false	[NULL]	마지막수정자
C_SQN	NUMBER(4,0)	[NULL]	16	false	[NULL]	코드순서

2. 자격등급 관리 : 조회 테이블 (공통코드 테이블) 및 수정(인라인 편집)/추가/삭제 기능
  - 사용자 및 조직 정보과 join하여 사원번호, 이름, 직위, 팀, 부서 정보 함께 조회
  - 테이블명 : TAAABB_CAUTHI
  - 컬럼
컬럼명	Type	Type Mod	#	Not Null	디폴트	Comment
ATH_ID	VARCHAR2(32)	[NULL]	1	true	[NULL]	권한ID
QLF_GR_NM	VARCHAR2(200)	[NULL]	2	false	[NULL]	자격등급명
QLF_GR_MAT	VARCHAR2(600)	[NULL]	3	false	[NULL]	자격등급사항(내용)
USE_YN	VARCHAR2(1)	[NULL]	4	false	'Y'	사용여부
DEL_YN	VARCHAR2(1)	[NULL]	5	false	'N'	삭제여부
FST_ENR_DTM	DATE	[NULL]	6	false	SYSDATE	최초생성시간
FST_ENR_USID	VARCHAR2(14)	[NULL]	7	false	[NULL]	최초생성자
GUID	VARCHAR2(38)	[NULL]	8	false	[NULL]	일련번호
GUID_PRG_SNO	NUMBER(4,0)	[NULL]	9	false	[NULL]	GUID진행일련번호
LST_CHG_DTM	DATE	[NULL]	10	false	SYSDATE	마지막수정시간
LST_CHG_USID	VARCHAR2(14)	[NULL]	11	false	[NULL]	마지막수정자

3. 사용자 관리 : 조회 테이블 (공통코드 테이블) 및 수정(인라인 편집)/추가/삭제 기능
  - 조직과 join 하여 소속팀, 소속부서 등 정보도 포함
  - 테이블명 : TAAABB_CUSERI
컬럼명	Type	Type Mod	#	Not Null	디폴트	Comment
ENO	VARCHAR2(32)	[NULL]	1	true	[NULL]	행번
DEL_YN	VARCHAR2(1)	[NULL]	2	false	[NULL]	삭제여부
FST_ENR_DTM	DATE	[NULL]	3	false	[NULL]	최초생성시간
FST_ENR_USID	VARCHAR2(14)	[NULL]	4	false	[NULL]	최초생성자
USR_ECY_PWD	VARCHAR2(64)	[NULL]	5	false	[NULL]	사용자암호화패스워드
GUID	VARCHAR2(38)	[NULL]	6	false	[NULL]	일련번호
GUID_PRG_SNO	NUMBER(4,0)	[NULL]	7	false	[NULL]	일련번호2
LST_CHG_DTM	DATE	[NULL]	8	false	[NULL]	마지막수정시간
LST_CHG_USID	VARCHAR2(14)	[NULL]	9	false	[NULL]	마지막수정자
BBR_C	VARCHAR2(3)	[NULL]	10	false	[NULL]	부서코드
CADR_TPN	VARCHAR2(20)	[NULL]	11	false	[NULL]	회사번호
DTC_BBR_C	VARCHAR2(3)	[NULL]	12	false	[NULL]	상위조직코드
DTS_DTL_CONE	VARCHAR2(2000)	[NULL]	13	false	[NULL]	상세직무내용
ETR_MIL_ADDR_NM	VARCHAR2(200)	[NULL]	14	false	[NULL]	전자우편주소
INLE_NO	VARCHAR2(20)	[NULL]	15	false	[NULL]	내선번호
PT_C	VARCHAR2(5)	[NULL]	16	false	[NULL]	직위
PT_C_NM	VARCHAR2(200)	[NULL]	17	false	[NULL]	직위명
TEM_C	VARCHAR2(5)	[NULL]	18	false	[NULL]	팀코드
TEM_NM	VARCHAR2(100)	[NULL]	19	false	[NULL]	팀명
USR_NM	VARCHAR2(100)	[NULL]	20	false	[NULL]	사용자명
USR_WREN_NM	VARCHAR2(100)	[NULL]	21	false	[NULL]	사용자영문명
CPN_TPN	VARCHAR2(100)	[NULL]	22	false	[NULL]	휴대폰번호

4. 조직 관리 : 조회 테이블 (공통코드 테이블) 및 수정(인라인 편집)/추가/삭제 기능
  - 사용자 및 조직 정보과 join하여 사원번호, 이름, 직위, 팀, 부서 정보 함께 조회
  - 테이블명 : TAAABB_CORGNI
  - 컬럼
컬럼명	Type	Type Mod	#	Not Null	디폴트	Comment
PRLM_OGZ_C_CONE	VARCHAR2(100)	[NULL]	1	true	[NULL]	조직코드
DEL_YN	VARCHAR2(1)	[NULL]	2	false	[NULL]	
FST_ENR_DTM	DATE	[NULL]	3	false	[NULL]	
FST_ENR_USID	VARCHAR2(14)	[NULL]	4	false	[NULL]	
GUID	VARCHAR2(38)	[NULL]	5	false	[NULL]	
GUID_PRG_SNO	NUMBER(4,0)	[NULL]	6	false	[NULL]	
LST_CHG_DTM	DATE	[NULL]	7	false	[NULL]	
LST_CHG_USID	VARCHAR2(14)	[NULL]	8	false	[NULL]	
BBR_NM	VARCHAR2(100)	[NULL]	9	false	[NULL]	부점명
BBR_WREN_NM	VARCHAR2(100)	[NULL]	10	false	[NULL]	부점영문명
ITM_SQN_SNO	VARCHAR2(9)	[NULL]	11	false	[NULL]	순서
PRLM_HRK_OGZ_C_CONE	VARCHAR2(100)	[NULL]	12	false	[NULL]	상위조직코드

5. 역할 관리 : 조회 테이블 (공통코드 테이블) 및 수정(인라인 편집)/추가/삭제 기능
  - 사용자 및 조직 정보과 join하여 사원번호, 이름, 직위, 팀, 부서 정보 함께 조회
  - 테이블명 : TAAABB_CROLEI
  - 컬럼
컬럼명	Type	Type Mod	#	Not Null	디폴트	Comment
ATH_ID	VARCHAR2(32)	[NULL]	1	true	[NULL]	권한ID
ENO	VARCHAR2(32)	[NULL]	2	true	[NULL]	사원번호
USE_YN	VARCHAR2(1)	[NULL]	3	false	'Y'	사용여부
DEL_YN	VARCHAR2(1)	[NULL]	4	false	'N'	삭제여부
FST_ENR_DTM	DATE	[NULL]	5	false	SYSDATE	최초생성시간
FST_ENR_USID	VARCHAR2(14)	[NULL]	6	false	[NULL]	최초생성자
GUID	VARCHAR2(38)	[NULL]	7	false	[NULL]	일련번호
GUID_PRG_SNO	NUMBER(4,0)	[NULL]	8	false	[NULL]	GUID진행일련번호
LST_CHG_DTM	DATE	[NULL]	9	false	SYSDATE	마지막수정시간
LST_CHG_USID	VARCHAR2(14)	[NULL]	10	false	[NULL]	마지막수정자

6. 로그인 이력 : 단순 조회 테이블
  - 사용자 및 조직 정보과 join하여 사원번호, 이름, 직위, 팀, 부서 정보 함께 조회
  - 테이블명 : TAAABB_CLOGNH
  - 컬럼
컬럼명	Type	Type Mod	#	Not Null	디폴트	Comment
LGN_SNO	NUMBER(19,0)	[NULL]	1	true	[NULL]	로그인일련번호
DEL_YN	VARCHAR2(1)	[NULL]	2	false	[NULL]	
FST_ENR_DTM	TIMESTAMP	[NULL]	3	false	[NULL]	
FST_ENR_USID	VARCHAR2(14)	[NULL]	4	false	[NULL]	
GUID	VARCHAR2(38)	[NULL]	5	false	[NULL]	
GUID_PRG_SNO	NUMBER(10,0)	[NULL]	6	false	[NULL]	
LST_CHG_DTM	TIMESTAMP	[NULL]	7	false	[NULL]	
LST_CHG_USID	VARCHAR2(14)	[NULL]	8	false	[NULL]	
ENO	VARCHAR2(32)	[NULL]	9	true	[NULL]	사원번호
FLUR_RSN	VARCHAR2(200)	[NULL]	10	false	[NULL]	실패사유
IP_ADDR	VARCHAR2(200)	[NULL]	11	false	[NULL]	IP주소
LGN_DTM	TIMESTAMP	[NULL]	12	true	[NULL]	로그인일시
LGN_TP	VARCHAR2(80)	[NULL]	13	true	[NULL]	로그인유형
UST_AGT	VARCHAR2(2000)	[NULL]	14	false	[NULL]	사용자에이전트

7. JWT 토큰 조회 : 단순 조회 테이블
  - 사용자 및 조직 정보과 join하여 사원번호, 이름, 직위, 팀, 부서 정보 함께 조회
  - 테이블명 : TAAABB_CLOGNH
  - 컬럼
컬럼명	Type	Type Mod	#	Not Null	디폴트	Comment
TOK_SNO	NUMBER(19,0)	[NULL]	1	true	[NULL]	토큰일련번호
ENO	VARCHAR2(80)	[NULL]	2	true	[NULL]	사원번호
END_DTM	DATE	[NULL]	3	true	[NULL]	종료일시
TOK	VARCHAR2(2000)	[NULL]	4	true	[NULL]	토큰
DEL_YN	VARCHAR2(1)	[NULL]	5	false	'N'	삭제여부
FST_ENR_DTM	DATE	[NULL]	6	false	SYSDATE	최초생성시간
FST_ENR_USID	VARCHAR2(14)	[NULL]	7	false	[NULL]	최초생성자
GUID	VARCHAR2(38)	[NULL]	8	false	[NULL]	GUID(일련번호)
GUID_PRG_SNO	NUMBER(4,0)	[NULL]	9	false	[NULL]	GUID진행일련번호
LST_CHG_DTM	DATE	[NULL]	10	false	SYSDATE	마지막수정시간
LST_CHG_USID	VARCHAR2(14)	[NULL]	11	false	[NULL]	마지막수정자

8. 첨부파일 조회 : 단순 조회 테이블
  - 사용자 및 조직 정보과 join하여 사원번호, 이름, 직위, 팀, 부서 정보 함께 조회
  - 테이블명 : TAAABB_CFILEM
  - 컬럼
컬럼명	Type	Type Mod	#	Not Null	디폴트	Comment
FL_MNG_NO	VARCHAR2(32)	[NULL]	1	true	[NULL]	파일관리번호
ORC_FL_NM	VARCHAR2(255)	[NULL]	2	true	[NULL]	원본파일명
SVR_FL_NM	VARCHAR2(100)	[NULL]	3	true	[NULL]	서버파일명
FL_KPN_PTH	VARCHAR2(255)	[NULL]	4	true	[NULL]	파일저장경로
FL_DTT	VARCHAR2(100)	[NULL]	5	true	[NULL]	파일구분
ORC_PK_VL	VARCHAR2(32)	[NULL]	6	false	[NULL]	원본PK값
ORC_DTT	VARCHAR2(100)	[NULL]	7	true	[NULL]	원본구분
DEL_YN	VARCHAR2(1)	[NULL]	8	false	'N'	삭제여부
FST_ENR_DTM	DATE	[NULL]	9	false	SYSDATE	최초생성시간
FST_ENR_USID	VARCHAR2(14)	[NULL]	10	false	[NULL]	최초생성자
GUID	VARCHAR2(38)	[NULL]	11	false	[NULL]	GUID(일련번호)
GUID_PRG_SNO	NUMBER(4,0)	[NULL]	12	false	[NULL]	GUID진행일련번호(일련번호2)
LST_CHG_DTM	DATE	[NULL]	13	false	SYSDATE	마지막수정시간
LST_CHG_USID	VARCHAR2(14)	[NULL]	14	false	[NULL]	마지막수정자

9. 대시보드 : chartjs를 활용한 대시보드
  - 접속자 수 추이
  - 서버 자원 사용량
  - 기타 관리자 대시보드 필요한 사항