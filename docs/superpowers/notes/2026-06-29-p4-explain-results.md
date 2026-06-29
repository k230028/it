# P4 인덱스 EXPLAIN 결과 (2026-06-29)

> 로컬 Oracle 21c XE (ITPAPP@127.0.0.1:11521/XEPDB1, CURRENT_SCHEMA=ITPOWN).
> 각 항목: (1) 베이스라인 PLAN, (2) 후보 인덱스, (3) 인덱스 적용 후 PLAN, (4) 판정(개선/무효).
> 측정일 2026-06-29. EXPLAIN PLAN FOR + DBMS_XPLAN.DISPLAY 사용. 측정용 임시 인덱스는 측정 직후 DROP했고, 영속 변경은 Flyway V*.sql만 수행.

## 0. 환경 확인
- 테이블 존재: TPRMPP_BASCTM, TPRMPP_BCMMTM, TPRMPP_BPROJM, TPRMPP_BRDOCM, TPRMPP_BRIVGM 모두 확인.
- 뷰 존재: V_ITPAPP_LOG_FEED 확인.
- V_ITPAPP_LOG_FEED 정의: **20개 `*L` 로그 테이블의 UNION ALL** (TPRMPP_BASCTL, BBUGTL, BCHKLL, BCMMTL, BCOSTL, BEVALL, BGDOCL, BITEML, BPERFL, BPLANL, BPOVWL, BPQNAL, BPROJL, BRDOCL, BRIVGL, BRSLTL, BSCHDL, BTERML, CAPPLL, CCODEL). 각 SELECT가 상수 `LOG_TBL`/`LOG_KEY` 라벨을 붙임. **단일 기반 테이블 없음** → 단일 커버링 인덱스 불가.
- 행 수(소규모 로컬 데이터): BASCTM=1, BCMMTM=6, BPROJM=24, BRDOCM=26, BRIVGM=3. 로그 테이블 최대 ~114행(BITEML). **데이터가 작아 일부 비용 차이는 작지만, 플랜 구조(FULL SCAN→INDEX, SORT 제거)로 인덱스 효과를 판정함.**

### 컬럼명 정정 (계획 대비)
- `Basctm`(TPRMPP_BASCTM): ABUS_MNG_NO, SNO, DEL_YN, IT_PTL_ASCT_ID, FST_ENR_DTM 확인 (계획의 메타명 PRJ_MNG_NO/PRJ_SNO 아님).
- `Bcmmtm`(TPRMPP_BCMMTM): ENO, DEL_YN, IT_PTL_ASCT_ID, FST_ENR_DTM 확인 (ASCT_ID 아님).
- `Brdocm`/`Brivgm`: 버전 컬럼 DOC_VRS_SNO 확인 (DOC_VRS 아님). BRIVGM.DOC_VRS_SNO는 NUMBER.
- **중요(계획 오류 정정)**: TPRMPP_BPROJM에 **`BBR_C` 컬럼이 없음**(`all_tab_columns` COUNT=0). 부서 컬럼은 SVN_DPM_C / DVM_DPM_C. 즉 `CouncilRepository.findByDepartment`의 native 쿼리 `WHERE p.BBR_C = :bbrC`는 현재 스키마에서 ORA-00904로 실패함(애플리케이션 선결 과제, P4 범위 외). #8 Q1 EXPLAIN은 실제 존재 컬럼 `p.SVN_DPM_C`로 대체 측정함 — BASCTM 후보 인덱스는 BASCTM 조인키(ABUS_MNG_NO,SNO,DEL_YN) 대상이라 BPROJM 필터 컬럼 선택과 무관하게 동일한 효과 판정 가능.

## #8 BASCTM / BCMMTM 역방향 조회

### 베이스라인 PLAN
- **Q1 (findByDepartment, BASCTM↔BPROJM)**: Cost **5**. `TABLE ACCESS FULL TPRMPP_BASCTM`(id 4) → PK_BPROJM unique scan. SORT ORDER BY.
- **Q2 (findByCommitteeMember, BASCTM↔BCMMTM)**: Cost **4**. BCMMTM은 `INDEX SKIP SCAN PK_BCMMTM`(ENO가 PK 선두가 아니어서 skip scan) + TABLE ACCESS, BASCTM은 PK unique scan. SORT ORDER BY.

### 후보 인덱스
- `IX_BASCTM_PRJ_DEL ON TPRMPP_BASCTM (ABUS_MNG_NO, SNO, DEL_YN)`
- `IX_BCMMTM_ENO_DEL_ASCT ON TPRMPP_BCMMTM (ENO, DEL_YN, IT_PTL_ASCT_ID)`

### 적용 후 PLAN
- **Q1**: Cost **4**. `TABLE ACCESS FULL` → `INDEX SKIP SCAN IX_BASCTM_PRJ_DEL` + table access by rowid. FULL SCAN 제거.
- **Q2**: Cost **3**. BCMMTM 접근이 `INDEX RANGE SCAN IX_BCMMTM_ENO_DEL_ASCT` 단일 단계로 ENO·DEL_YN 등치 + IT_PTL_ASCT_ID 조인키를 모두 커버. PK_BCMMTM skip scan + 별도 table access 제거.

### 판정
**개선 — 채택**. Q1 5→4(FULL→INDEX), Q2 4→3(skip scan+table → 단일 range scan 커버). 데이터가 커질수록 효과 확대. → `V20260629_002`.

## #9 BRDOCM findLatestVersionsAll()

### 베이스라인 PLAN
Cost **9**. 상관 서브쿼리 MAX(DOC_VRS_SNO)가 VW_SQ_1으로 분리되고 `index$_join$_002`(IX_BRDOCM_ENR_DEL + PK_BRDOCM HASH JOIN)로 그룹핑, 외부는 `TABLE ACCESS FULL TPRMPP_BRDOCM`. HASH JOIN + SORT ORDER BY.

### 후보 인덱스
- `IX_BRDOCM_DEL_DOC_VRS_FED ON TPRMPP_BRDOCM (DEL_YN, DOC_MNG_NO, DOC_VRS_SNO, FST_ENR_DTM)`

### 적용 후 PLAN
Cost **7**. 상관 서브쿼리(VW_SQ_1 → HASH GROUP BY)가 `INDEX RANGE SCAN IX_BRDOCM_DEL_DOC_VRS_FED`(cost 1)로 해소 — index-join(cost 3) 대체. 외부 BRDOCM은 여전히 FULL(작은 행수, 모든 컬럼 SELECT * 이므로 정상).

### 판정
**개선 — 채택**. 9→7. 상관 MAX 서브쿼리가 (DEL_YN, DOC_MNG_NO, DOC_VRS_SNO) 선두 컬럼으로 인덱스에서 직접 해소. → `V20260629_003`.

## #10 BRIVGM 검토의견 목록

### 기존 IX_BRIVGM_DOC_DEL_FSG 커버 여부
`IX_BRIVGM_DOC_DEL_FSG` = (DOC_MNG_NO[1], DEL_YN[2], FSG_YN[3]) — `V20260627_001`이 대시보드 EXISTS(미해결 검토의견)용으로 생성. **DOC_VRS_SNO·FST_ENR_DTM 미포함** → 본 목록 쿼리의 DOC_VRS_SNO 등치도, FST_ENR_DTM 정렬도 커버 못함. 확인 완료.

### 베이스라인 PLAN
Cost **3**. `INDEX RANGE SCAN IX_BRIVGM_DOC_DEL_FSG`(DOC_MNG_NO, DEL_YN access) → TABLE ACCESS BY INDEX ROWID(DOC_VRS_SNO filter) → **SORT ORDER BY**(FST_ENR_DTM 정렬 별도 수행).

### 후보 인덱스
- `IX_BRIVGM_DOC_VRS_DEL_FED ON TPRMPP_BRIVGM (DOC_MNG_NO, DOC_VRS_SNO, DEL_YN, FST_ENR_DTM)`

### 적용 후 PLAN
Cost **2**. `INDEX RANGE SCAN IX_BRIVGM_DOC_VRS_DEL_FED`가 세 등치(DOC_MNG_NO, DOC_VRS_SNO, DEL_YN)를 모두 access로 처리하고 **SORT ORDER BY가 사라짐**(인덱스가 FST_ENR_DTM 순서로 행 반환). SORT 노드 제거가 핵심.

### 판정
**개선 — 채택**. 3→2 + **정렬 제거**(가장 명확한 win). 검토의견이 많은 문서에서 정렬 비용 제거 효과 큼. → `V20260629_004`.

## #11 V_ITPAPP_LOG_FEED 실시간 로그 피드

### 뷰 EXPLAIN (피드 + 집계)
- **피드 스냅샷(WHERE 없음, ORDER BY CHG_DTM/LOG_TBL/LOG_HIS_TGR_SNO, FETCH 200)**: Cost **71**. `VIEW V_ITPAPP_LOG_FEED` → UNION-ALL → 20개 테이블 모두 `TABLE ACCESS FULL` → 상위 `WINDOW SORT PUSHED RANK`(전역 정렬). WHERE 필터가 없는 전체 스냅샷이라 각 테이블 전건 스캔이 불가피하고, UNION 전역 정렬은 어느 단일 인덱스로도 제거 불가.
- **5분 집계(WHERE CHG_DTM > :since GROUP BY LOG_KEY)**: Cost **24**. UNION-ALL 19개 테이블이 이미 `INDEX (FAST) FULL SCAN IX_*_CHG_DTM`(기존 단일컬럼 CHG_DTM 인덱스) 사용. **단, `TPRMPP_CCODEL`만 `TABLE ACCESS FULL`(cost 3)** — CCODEL에는 CHG_DTM 인덱스가 없음(PK_CCODEL=LOG_HIS_TGR_SNO만).
- **30분 분버킷 집계(GROUP BY TRUNC(CHG_DTM,'MI'))**: 5분 집계와 동일 접근 패턴.

### 핵심 발견 (계획 전제 정정)
- 계획은 "단일 기반 테이블 `TPRMPP_<LOGBASE>`에 커버링 인덱스 `IX_LOGFEED_CHGDTM_CURSOR`"를 가정했으나, **뷰는 20개 `*L` 테이블의 UNION ALL이라 단일 기반 테이블이 없음**. 단일 커버링 인덱스는 불가.
- **20개 중 19개 테이블에 이미 `IX_*_CHG_DTM` (단일 컬럼 CHG_DTM) 인덱스가 존재**하며 집계 쿼리가 이를 사용 중. 즉 계획이 새로 만들려던 인덱스는 대부분 이미 존재(중복).
- **유일한 실 격차: `TPRMPP_CCODEL`에 CHG_DTM 인덱스 부재** → 집계에서 FULL SCAN.

### 후보 인덱스 (계획에서 범위 축소)
- `IX_CCODEL_CHG_DTM ON TPRMPP_CCODEL (CHG_DTM)` — 기존 19개 테이블의 `IX_*_CHG_DTM` 패턴과 동일하게, 누락된 1개 테이블만 보강.

### 적용 후 PLAN
- 5분/30분 집계 Cost **24 → 22**. CCODEL 접근이 `TABLE ACCESS FULL`(cost 3) → `INDEX FULL SCAN IX_CCODEL_CHG_DTM`(cost 1)로 전환. 나머지 19개 테이블 플랜 불변.
- 피드 스냅샷(WHERE 없음) 경로는 인덱스로 개선 불가(전체 스냅샷 + 전역 WINDOW SORT)이며, 이는 단일/다중 인덱스 모두 동일 — 계획대로 "개선 불가" 기록.

### 판정
**부분 개선 — 범위 축소 채택**. 단일 커버링 인덱스(`IX_LOGFEED_CHGDTM_CURSOR`)는 뷰 구조상 부적합·불필요(19개 이미 인덱스됨). 누락된 `TPRMPP_CCODEL`에만 기존 패턴과 동일한 `IX_CCODEL_CHG_DTM (CHG_DTM)`를 추가해 집계 비용 24→22로 낮추고 20개 테이블 인덱싱을 대칭화. → `V20260629_005`(범위 재정의). 피드 스냅샷 경로는 인덱스 무효(감내) — WHERE 없는 전체 정렬이라 인덱스로 제거 불가.

## 요약
| # | 베이스라인 비용 | 적용 후 비용 | 인덱스 채택 | V*.sql |
| - | - | - | - | - |
| #8 Q1 (dept) | 5 (FULL SCAN) | 4 (INDEX SKIP SCAN) | IX_BASCTM_PRJ_DEL | V20260629_002 |
| #8 Q2 (committee) | 4 (skip scan+table) | 3 (단일 range scan 커버) | IX_BCMMTM_ENO_DEL_ASCT | V20260629_002 |
| #9 findLatestVersionsAll | 9 | 7 | IX_BRDOCM_DEL_DOC_VRS_FED | V20260629_003 |
| #10 BRIVGM 검토의견 | 3 (+SORT) | 2 (SORT 제거) | IX_BRIVGM_DOC_VRS_DEL_FED | V20260629_004 |
| #11 집계 5/30분 | 24 (CCODEL FULL) | 22 (CCODEL INDEX) | IX_CCODEL_CHG_DTM (범위 축소) | V20260629_005 |
| #11 피드 스냅샷 | 71 | 71 (인덱스 무효, 감내) | — | — |

### 검증 경로
- 검증은 **sqlplus 직접 실행**으로 수행(각 V*.sql DDL을 라이브 ITPOWN 스키마에 직접 적용해 유효성 확인). bootRun(local-ext) Flyway 픽업은 **포트 28080에서 기존 백엔드 인스턴스가 가동 중일 가능성**이 있어 충돌 회피를 위해 생략. dev/prod는 어차피 DBA 수동 적용이므로 Flyway 자동 픽업은 부차적.
