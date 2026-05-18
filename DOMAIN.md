
| 도메인논리명  | 도메인물리명 | 도메인그룹 | 인포타입     | 데이터타입        | 길이   | 소수점 |
| ------- | ------ | ----- | -------- | ------------ | ---- | --- |
| EID     | EID    | ID    | IDVC16   | VARCHAR2     | 16   |     |
| GUID    | GUID   | ID    | IDVC38   | VARCHAR2     | 38   |     |
| MAC     | MAC    | ID    | IDVC17   | VARCHAR2     | 17   |     |
| 범용고유ID  | UUID   | ID    | IDVC32   | VARCHAR2     | 32   |     |
| 사용자ID   | USID   | ID    | IDVC14   | VARCHAR2     | 14   |     |
| 가       | PR     | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 가격      | PR     | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 공시지가    | OALPR  | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 과태료     | FDFE   | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 관세      | TARF   | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 금액      | AMT    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 단가      | UPR    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 료       | FE     | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 본세      | MNTX   | 금액    | 금액NU18   | NUMBER       | 18   |     |
| 부가가치세   | VAT    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 비       | XP     | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 비용      | XP     | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 세       | TX     | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 세액      | TX     | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 수수료     | FEE    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 원가      | PCOT   | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 원금      | PRA    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 이자      | INT    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 인지세     | STTX   | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 잔액      | BBL    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 적수      | ALA    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 주세      | LQTX   | 금액    | 금액NU18   | NUMBER       | 18   |     |
| 차액      | DFA    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 출연료     | CNBFE  | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 평잔      | AVB    | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 환가료     | XCFE   | 금액    | 금액NU18.3 | NUMBER       | 18   | 3   |
| 기일      | FDT    | 날짜    | 날짜VC2    | VARCHAR2     | 2    |     |
| 년반기     | YHY    | 날짜    | 날짜VC6    | VARCHAR2     | 6    |     |
| 년분기     | YQRT   | 날짜    | 날짜VC6    | VARCHAR2     | 6    |     |
| 년월      | YM     | 날짜    | 날짜VC6    | VARCHAR2     | 6    |     |
| 생년월일    | BTD    | 날짜    | 날짜VC8    | VARCHAR2     | 8    |     |
| 시각      | TM     | 날짜    | 날짜VC6    | VARCHAR2     | 6    |     |
| 시분      | HM     | 날짜    | 날짜VC4    | VARCHAR2     | 4    |     |
| 연도      | YY     | 날짜    | 날짜VC4    | VARCHAR2     | 4    |     |
| 월       | MM     | 날짜    | 날짜VC2    | VARCHAR2     | 2    |     |
| 월일      | MD     | 날짜    | 날짜VC4    | VARCHAR2     | 4    |     |
| 일       | DD     | 날짜    | 날짜VC2    | VARCHAR2     | 2    |     |
| 일시      | DTM    | 날짜    | 날짜DT     | DATE         |      |     |
| 일자      | DT     | 날짜    | 날짜VC8    | VARCHAR2     | 8    |     |
| 타임스탬프   | TS     | 날짜    | 날짜TS     | TIMESTAMP    |      |     |
| IP      | IP     | 내용    | 내용VC20   | VARCHAR2     | 20   |     |
| URL     | URL    | 내용    | 내용VC300  | VARCHAR2     | 300  |     |
| 개요      | OTL    | 내용    | 내용VC300  | VARCHAR2     | 300  |     |
| 경로      | PTH    | 내용    | 내용VC300  | VARCHAR2     | 300  |     |
| 계산식     | CLF    | 내용    | 내용VC2000 | VARCHAR2     | 2000 |     |
| 공간      | STI    | 내용    | 내용SDO    | SDO_GEOMETRY |      |     |
| 근거      | FDTN   | 내용    | 내용VC4000 | VARCHAR2     | 4000 |     |
| 내용      | CONE   | 내용    | 내용VC300  | VARCHAR2     | 300  |     |
| 명세      | SFS    | 내용    | 내용VC4000 | VARCHAR2     | 4000 |     |
| 목적      | PPO    | 내용    | 내용VC300  | VARCHAR2     | 300  |     |
| 비고      | RMK    | 내용    | 내용VC300  | VARCHAR2     | 300  |     |
| 사유      | RSN    | 내용    | 내용VC600  | VARCHAR2     | 600  |     |
| 사항      | MAT    | 내용    | 내용VC2000 | VARCHAR2     | 2000 |     |
| 설명      | DES    | 내용    | 내용VC300  | VARCHAR2     | 300  |     |
| 이미지     | IMG    | 내용    | 내용BL     | BLOB         |      |     |
| 적요      | SPS    | 내용    | 내용VC300  | VARCHAR2     | 300  |     |
| 정보      | INF    | 내용    | 내용CL     | CLOB         |      |     |
| 제목      | TTL    | 내용    | 내용VC100  | VARCHAR2     | 100  |     |
| 길이      | LEN    | 단위    | 단위NU10   | NUMBER       | 10   |     |
| 깊이      | DEP    | 단위    | 단위NU10   | NUMBER       | 10   |     |
| 수량      | QTY    | 단위    | 단위NU10   | NUMBER       | 10   |     |
| 연령      | AGE    | 단위    | 단위NU10   | NUMBER       | 10   |     |
| 제곱미터    | SQM    | 단위    | 단위NU10.6 | NUMBER       | 10   | 6   |
| 총점      | TTS    | 단위    | 단위NU10.6 | NUMBER       | 10   | 6   |
| 크기      | SZ     | 단위    | 단위NU10   | NUMBER       | 10   |     |
| 평점      | ASCR   | 단위    | 단위NU10.6 | NUMBER       | 10   | 6   |
| 명       | NM     | 명칭    | 명칭VC100  | VARCHAR2     | 100  |     |
| 별명      | ALS    | 명칭    | 명칭VC100  | VARCHAR2     | 100  |     |
| 영문성     | LNM    | 명칭    | 명칭VC60   | VARCHAR2     | 60   |     |
| 영문이름    | FNM    | 명칭    | 명칭VC60   | VARCHAR2     | 60   |     |
| BIN번호   | BIN    | 번호    | 번호VC8    | VARCHAR2     | 8    |     |
| 개인번호    | EPN    | 번호    | 번호VC6    | VARCHAR2     | 6    |     |
| 고객번호    | CNO    | 번호    | 번호VC8    | VARCHAR2     | 8    |     |
| 법인등록번호  | CRN    | 번호    | 번호VC13   | VARCHAR2     | 13   |     |
| 사업자등록번호 | BRN    | 번호    | 번호VC10   | VARCHAR2     | 10   |     |
| 사원번호    | ENO    | 번호    | 번호VC32   | VARCHAR2     | 32   |     |
| 사회보장번호  | SOSN   | 번호    | 번호VC12   | VARCHAR2     | 12   |     |
| 증권번호    | NOS    | 번호    | 번호VC20   | VARCHAR2     | 20   |     |
| 가중치     | WERE   | 수     | 수NU3     | NUMBER       | 3    |     |
| 값       | VL     | 수     | 수NU18.6  | NUMBER       | 18   | 6   |
| 건수      | CNT    | 수     | 수NU10    | NUMBER       | 10   |     |
| 계수      | CFC    | 수     | 수NU6.4   | NUMBER       | 6    | 4   |
| 교시      | CLTI   | 수     | 수NU2     | NUMBER       | 2    |     |
| 년수      | YYS    | 수     | 수NU5     | NUMBER       | 5    |     |
| 매수      | NOSH   | 수     | 수NU10    | NUMBER       | 10   |     |
| 수       | NBR    | 수     | 수NU10    | NUMBER       | 10   |     |
| 일수      | DDS    | 수     | 수NU5     | NUMBER       | 5    |     |
| 자릿수     | CPH    | 수     | 수NU2     | NUMBER       | 2    |     |
| 점수      | RCRD   | 수     | 수NU5     | NUMBER       | 5    |     |
| 좌수      | STCN   | 수     | 수NU18    | NUMBER       | 18   |     |
| 중앙값     | MVA    | 수     | 수NU7.2   | NUMBER       | 7    | 2   |
| 지수      | IXN    | 수     | 수NU10.6  | NUMBER       | 10   | 6   |
| 층       | FLR    | 수     | 수NU10    | NUMBER       | 10   |     |
| 컨벡서티    | CVX    | 수     | 수NU18.8  | NUMBER       | 18   | 8   |
| 편중지수    | BEP    | 수     | 수NU18.8  | NUMBER       | 18   | 8   |
| 평균값     | AVRV   | 수     | 수NU10.6  | NUMBER       | 10   | 6   |
| 표준편차    | SDV    | 수     | 수NU18.3  | NUMBER       | 18   | 3   |
| 학점      | CRDS   | 수     | 수NU3     | NUMBER       | 3    |     |
| 회차      | TOD    | 수     | 수NU5     | NUMBER       | 5    |     |
| 횟수      | NOT    | 수     | 수NU5     | NUMBER       | 5    |     |
| 여부      | YN     | 여부    | 여부VC1    | VARCHAR2     | 1    |     |
| 우편번호    | ZIP    | 연락처   | 연락처VC6   | VARCHAR2     | 6    |     |
| 우편번호외주소 | BZCA   | 연락처   | 연락처VC200 | VARCHAR2     | 200  |     |
| 우편번호주소  | ZCA    | 연락처   | 연락처VC200 | VARCHAR2     | 200  |     |
| 전화번호    | TPN    | 연락처   | 연락처VC20  | VARCHAR2     | 20   |     |
| 주소      | ADDR   | 연락처   | 연락처VC300 | VARCHAR2     | 300  |     |
| 휴대전화번호  | MBTNO  | 연락처   | 연락처VC20  | VARCHAR2     | 20   |     |
| 금리      | IRT    | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 률       | RT     | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 배율      | MGN    | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 백분율     | PTG    | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 비율      | RATO   | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 세율      | TXR    | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 소비자물가지수 | CPI    | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 요율      | RT     | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 율       | RT     | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 이율      | ITSR   | 율/비율  | 율NU8.5   | NUMBER       | 8    | 5   |
| 확률      | PBB    | 율/비율  | 율NU15.10 | NUMBER       | 15   | 10  |
| 환율      | XCR    | 율/비율  | 율NU9.4   | NUMBER       | 9    | 4   |
| 일련번호    | SNO    | 일련번호  | 일련번호NU9  | NUMBER       | 9    |     |
