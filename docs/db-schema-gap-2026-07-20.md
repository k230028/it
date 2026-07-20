# 운영·로컬 DB Gap 분석 결과

## 비교 기준

- 운영 기준: `C:\it\meta\table.txt`
- 로컬 기준: `C:\it\it_database\ITPOWN_DDL_live.sql` 및 변경 후 Oracle `ITPOWN` 데이터 사전
- 제외 테이블: `FLYWAY_SCHEMA_HISTORY`
- 비교 항목: 테이블명·테이블 코멘트, 컬럼명·순서·타입·길이·소수점, PK·NULL·기본값, 컬럼 코멘트

## 최초 Gap

| 항목 | 최초 결과 |
| --- | ---: |
| 업무 테이블 | 로컬 88 / 운영 88 |
| 업무 컬럼 | 로컬 1,611 / 운영 1,613 |
| 로컬 전용 컬럼 | 8개 |
| 운영 전용 컬럼 | 10개 |
| 컬럼 순서 또는 구성 차이 테이블 | 17개 |
| 길이 차이 | 4개 |
| NULL 제약 차이 | 64개 |
| 기본값 표기 차이 | 45개 |
| 테이블 코멘트 차이 | 7개 |
| 컬럼 코멘트 차이 | 91개 |

`TPRMPP_CRTOKM.FAM_NM`의 운영 기본값 `LEGACY`는 문자열 따옴표가 빠진 내보내기 표기입니다. Oracle에서 유효한 동일 의미의 기본값은 `'LEGACY'`이므로 로컬의 유효 SQL을 유지했습니다. 과거 기본값이 있던 컬럼은 Oracle 특성상 `DEFAULT NULL` 이력이 데이터 사전에 남으므로, 기본값 없음과 `DEFAULT NULL`은 같은 동작으로 정규화해 판정했습니다.

## 주요 구조 변경

- 운영에 없는 `BASCTM/BASCTL.REQ_DOC_NO`, `BASKPM/BASKPL.PRTY_IVG_OMT_RSN_TC`, `BESTIM/BESTIL.IOE_C`를 제거했습니다.
- `BPLEVM/BPLEVL.EVAL_OPNN_CONE`를 운영명 `CKG_OPNN_CONE`로 변경했습니다.
- `BBIZPM/BBIZPL`에 사업추진 필요성·방향·내용·기대효과 CLOB 4개씩을 추가했습니다.
- 로그 PK 숫자 길이, 사업관리번호 길이, NULL 제약, 감사 기본값을 운영 기준으로 정렬했습니다.
- 17개 테이블의 표시 컬럼 순서를 Oracle `INVISIBLE`/`VISIBLE` 재배치로 운영 순서에 맞췄습니다.
- 운영과 다른 테이블·컬럼 코멘트를 모두 운영 값으로 갱신했습니다.

## 데이터 보존 확인

- 삭제 대상 `BASCT*`, `BASKP*`, `BPLEV*` 컬럼에는 값이 없었습니다.
- `BESTIM.IOE_C` 4건과 `BESTIL.IOE_C` 6건은 모두 정보화사업 고정 구분으로, DB 컬럼 대신 서비스 상수 `100`으로 응답을 유지합니다.
- 갱신토큰 32건의 `API_TOK_CONE`는 원문을 복원하지 않고 기존 SHA-256 조회값으로 채웠습니다. 신규 토큰도 원문이 아닌 동일 해시를 두 운영 컬럼에 저장합니다.

## 변경 후 검증

- 업무 테이블: 로컬 88 / 운영 88
- 업무 컬럼: 로컬 1,613 / 운영 1,613
- 테이블·컬럼 구성, 순서, 타입·길이, PK, NULL, 유효 기본값 Gap: 0건
- 테이블·컬럼 코멘트 SHA-256 전수 비교 Gap: 0건

적용 스크립트는 `it_database/migrations/V20260720_010__AlignLocalSchemaWithProduction.sql`입니다.

## 애플리케이션 정합화

- 백엔드 엔티티와 로그 엔티티를 운영 컬럼명·NULL 제약·CLOB 구성에 맞췄습니다.
- 계획협의회 계획관리번호는 운영 `BASCTM`에 존재하는 `ABUS_MNG_NO`에 저장·조회하도록 변경했습니다.
- 운영에 없는 소요예산 산정의 대상구분 컬럼은 서비스 상수 `100`으로 호환 응답하고, 중복 검사·사업 동기화도 사업관리번호 기준으로 변경했습니다.
- 생략판정 사유코드는 API와 화면에서 제거하고 설명 중심 입력으로 변경했습니다.
- 갱신토큰은 운영 필수 컬럼 `API_TOK_CONE`와 기존 암호화 컬럼에 동일한 SHA-256 해시를 저장하도록 변경했습니다.

## 실행 검증

- Flyway 이력: `20260720.010 / AlignLocalSchemaWithProduction / success=1`
- 백엔드: `gradlew test` 성공
- 프론트: 타입체크·ESLint 성공, Vitest 127개 파일 1,629개 테스트 성공
- 프론트: Nuxt 프로덕션 빌드 성공
- 변경 후 Oracle 데이터 사전에서 `ITPOWN_DDL_live.sql` 재생성 완료
