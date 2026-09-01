# 운영 DB 반영 사항 백로그

운영 DB 현황 it\meta\table.txt (테이블), it\meta\sequence.txt (시퀀스), it\meta\index.txt (인덱스) 기준 변경이 필요한 내용을 아래의 양식으로 정리한다.

## 1. 테이블

- 변경 구분 : 신규/수정/삭제

| NO | 테이블명  | 테이블한글명 | 컬럼명 | PK여부 | NULL여부 | Default Value | 타입	길이 | 소수점 | 변경 구분 | 작성일자   |
| -- | --------- | ------------ | ------ | ------ | -------- | ------------- | --------- | ------ | --------- | ---------- |
|    | 해당 없음 |              |        |        |          |               |           |        |           | 2026-09-01 |

## 2. 인덱스

- 변경 구분 : 신규/수정/삭제

| NO | 테이블명      | 인덱스명            | UNIQUE여부 | 인덱스종류 | DB접속대상명 | DB스키마명 | 인덱스스페이스 | 인덱스컬럼(조합)                                                         | 인덱스구성유형       | FBI스크립트                                                                                                                          | 설명                                                                                                                                       | 변경 구분 | 작성일자   |
| -- | ------------- | ------------------- | ---------- | ---------- | ------------ | ---------- | -------------- | ------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| 1  | TPRMPP_CAPPLA | IX_TPRMPP_CAPPLA_02 | 아니요     |            | DPRMDB       | ITPOWN     | TSIITP01       | FNT_TB_NM,ASC;PK_COL_NM,ASC;FNT_TB_CRY_SNO,ASC;DEL_YN,ASC;APF_DCM_NO,ASC | 일반(컬럼구성)       |                                                                                                                                      | 원본 테이블·관리번호·개정순번 단위로 최신 결재문서를 조회하기 위한 인덱스. 예산 목록·상세의 버전별 결재상태 매핑이 이 조합으로 조회한다 | 신규      | 2026-09-01 |
| 2  | TPRMPP_BPROJM | IX_TPRMPP_BPROJM_02 | 아니요     |            | DPRMDB       | ITPOWN     | TSIITP01       | ABUS_MNG_NO,ASC;DEL_YN,ASC;LST_YN,ASC;SNO,ASC                            | 일반(컬럼구성)       |                                                                                                                                      | 사업관리번호 기준으로 재상신 개정본 이력과 현재 최종본을 조회하기 위한 인덱스                                                              | 신규      | 2026-09-01 |
| 3  | TPRMPP_BPROJM | IX_TPRMPP_BPROJM_03 | 예         |            | DPRMDB       | ITPOWN     | TSIITP01       | LST_YN,ASC;DEL_YN,ASC;ABUS_MNG_NO,ASC                                    | Function Based Index | CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BPROJM_03 ON ITPOWN.TPRMPP_BPROJM (CASE WHEN (LST_YN='N' AND DEL_YN='N') THEN ABUS_MNG_NO END); | 미상신 재상신 초안이 사업관리번호별로 하나만 존재하도록 보장하는 함수 기반 UNIQUE 인덱스                                                   | 신규      | 2026-09-01 |
| 4  | TPRMPP_BCOSTM | IX_TPRMPP_BCOSTM_03 | 예         |            | DPRMDB       | ITPOWN     | TSIITP01       | LST_YN,ASC;DEL_YN,ASC;COST_BG_NO,ASC                                     | Function Based Index | CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BCOSTM_03 ON ITPOWN.TPRMPP_BCOSTM (CASE WHEN (LST_YN='N' AND DEL_YN='N') THEN COST_BG_NO END);  | 미상신 재상신 초안이 전산업무비예산번호별로 하나만 존재하도록 보장하는 함수 기반 UNIQUE 인덱스                                             | 신규      | 2026-09-01 |

### 인덱스 항목별 근거와 선행 조건

| NO | 발생 원인                                                                                                                                                                                                                                       | 마이그레이션                      | 선행 조건                                                                                                                                                                     |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | 커밋`323d8c5`가 이미 적용된 `V20260831_002`를 제자리 수정하면서 이 인덱스 생성 블록을 삭제했다. 같은 커밋의 `V20260831_005`가 002의 나머지 변경을 전부 철회하므로, 002가 스키마에 남기는 객체는 이 인덱스 하나뿐인데 그것이 소실된 상태다 | 신규`V20260901_001`로 복원 예정 | 없음(비고유 인덱스)                                                                                                                                                           |
| 2  | 재상신 이력 조회 경로용으로`V20260831_001__AddBudgetVersionLookupIndexes.sql`이 추가했으나 `index.txt`에 미반영                                                                                                                             | `V20260831_001` (기적용)        | PK`(ABUS_MNG_NO, SNO)`가 이미 선두컬럼을 덮으므로 **실효성 재검토 필요**. 불필요 판정 시 이 행을 삭제로 전환한다                                                      |
| 3  | 재상신 초안 중복 생성 가드(애플리케이션 검사)의 스키마 측 이중 안전망                                                                                                                                                                           | 신규`V20260901_002` 예정        | ① 생성 전 중복 초안 점검이 0건일 것(아래 SQL). ②**애플리케이션 가드 배포 후**에 적용할 것 — 인덱스가 먼저 나가면 더블클릭이 안내 문구 대신 ORA-00001 기반 500이 된다 |
| 4  | 위와 동일(전산업무비)                                                                                                                                                                                                                           | 신규`V20260901_002` 예정        | 위와 동일                                                                                                                                                                     |

NO 3·4 생성 전 점검 SQL:

```sql
SELECT ABUS_MNG_NO, COUNT(*)
  FROM ITPOWN.TPRMPP_BPROJM
 WHERE LST_YN = 'N' AND DEL_YN = 'N'
 GROUP BY ABUS_MNG_NO HAVING COUNT(*) > 1;

SELECT COST_BG_NO, COUNT(*)
  FROM ITPOWN.TPRMPP_BCOSTM
 WHERE LST_YN = 'N' AND DEL_YN = 'N'
 GROUP BY COST_BG_NO HAVING COUNT(*) > 1;
```

## 3. 시퀀스

- 변경 구분 : 신규/수정/삭제

| NO | Sequence  | Name | Value | Min Value | Max Value | Increment | Cache | Cycle | Ordered | 변경 구분 | 작성일자   |
| -- | --------- | ---- | ----- | --------- | --------- | --------- | ----- | ----- | ------- | --------- | ---------- |
|    | 해당 없음 |      |       |           |           |           |       |       |         |           | 2026-09-01 |

## 4. 반영 순서

1. NO 4-1 점검 SQL로 `CAPPLA` 레거시 건수 확인 → 0이 아니면 보정 마이그레이션 작성
2. 인덱스 NO 3·4 점검 SQL로 중복 초안 확인 → 0건 확인
3. `V20260901_001` 배포 — 인덱스 NO 1 생성, 필요 시 `CAPPLA` 보정 포함
4. 재상신 초안 중복 가드(애플리케이션) 배포
5. `V20260901_002` 배포 — 인덱스 NO 3·4 생성 (반드시 4단계 이후)
6. 인덱스 NO 2 실효성 판정 후 반영 또는 삭제 전환
7. 반영 완료 후 `it\meta\index.txt` 재추출로 현황 갱신

## 근거 문서

- [`docs/superpowers/plans/2026-09-01-budget-reapplication-review-remediation.md`](../docs/superpowers/plans/2026-09-01-budget-reapplication-review-remediation.md) — 코드리뷰 재검증과 개선 계획(결함 D5·D6·D7 대응)
- [`it_database/docs/operations/2026-08-31-plan-reapplication-versioning.md`](../it_database/docs/operations/2026-08-31-plan-reapplication-versioning.md) — `V20260831_002` 적용·복구 기록
