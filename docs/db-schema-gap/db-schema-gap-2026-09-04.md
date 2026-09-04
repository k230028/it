# 운영·로컬 DB Gap 분석 결과 (2026-09-04)

## 1. 결론

`FLYWAY_SCHEMA_HISTORY`를 제외하고 제공된 운영 메타와 로컬 DDL 스냅샷을 비교했다.

- 테이블 92개, 컬럼 1,684개, 시퀀스 62개의 **구조 Gap은 0건**이다.
- 공통 인덱스 70개는 모두 일치한다. 로컬에만 인덱스 3개가 있다.
- 운영 조치는 `IX_TPRMPP_CAPPLA_02` 반영 1건과 `IX_TPRMPP_BPROJM_02` 유지 여부 결정 1건이다.
- 로컬 조치는 비표준 `UX_BGDOCM_CONTACT_INFO`를 운영에 복제하지 않고, 작성 완료된
  `V20260903_004`·`V20260903_005`의 표준 BGDOC 인덱스 계약으로 전환하는 것이다.

## 2. 비교 기준

| 입력 | 기준 시점 |
| --- | --- |
| `meta/table.txt` | 루트 `bb53b8d` (2026-08-28) |
| `meta/sequence.txt` | 루트 `e853680` (2026-08-20) |
| `meta/index.txt` | 루트 `393c995` (2026-08-28) |
| `it_database/ITPOWN_DDL_live.sql` | DB 저장소 `c32aaf4`, `Generated at: 2026-09-02 01:01:54 +09:00` |

로컬 DDL은 2026-09-03 마이그레이션보다 앞선 스냅샷이다. 따라서 아래의 직접 Gap과,
이미 작성됐지만 아직 스냅샷에 나타나지 않은 배포 목표를 구분한다.

## 3. 직접 비교 결과

| 비교 항목 | 결과 |
| --- | --- |
| 테이블명·테이블 코멘트 | 92개 전부 일치 |
| 컬럼명·순서·코멘트 | 1,684개 전부 일치 |
| 컬럼 타입·길이·소수점 | 1,684개 전부 일치 |
| PK | 92개 전부 구성과 순서 일치 |
| NULL 제약 | 실질 Gap 0건; PK가 NULL을 막는 표기 차이 2건만 존재 |
| 기본값 | 전부 일치 |
| 시퀀스명 | 62개 집합 일치 |
| 시퀀스 `MAXVALUE` | 62개 전부 일치 |
| 시퀀스 기타 속성 | `MINVALUE`·`INCREMENT`·`CACHE`·`CYCLE`·`ORDER` 전부 일치 |
| 인덱스 | 공통 70개 정의 일치, 로컬 전용 3개 |

함수 기반 인덱스는 따옴표·공백·불필요한 괄호를 정규화해 비교했다.

### 조치 불필요 차이

- `TPRMPP_CRTOKM.LGN_LOG_SNO`, `TPRMPP_CUSERI.ENO`: 운영 메타는 `NULL=N`, 로컬 DDL은
  별도 `NOT NULL` 표기가 없지만 두 컬럼 모두 PK이므로 동작은 같다.
- 시퀀스 현재값은 62개 모두 다르고 모두 로컬이 더 크다. 이는 스키마 정의가 아닌 런타임
  카운터다. 대표 차이는 `SQ_TPRMPP_CFILEM_1`(운영 41 / 로컬 5,118),
  `SQ_TPRMPP_CRTOKM_1`(201 / 5,002), `SQ_TPRMPP_CLOGNH_1`(101 / 3,985)이다.
  로컬 값을 운영 값으로 낮추지 않는다.

## 4. 운영에서 변경이 필요한 부분

| 대상 | 현재 Gap | 조치 |
| --- | --- | --- |
| `IX_TPRMPP_CAPPLA_02` | 로컬에만 존재 | 운영 사전 확인 후 생성. 컬럼은 `FNT_TB_NM, PK_COL_NM, FNT_TB_CRY_SNO, DEL_YN, APF_DCM_NO` |
| `IX_TPRMPP_BPROJM_02` | 로컬에만 존재 | PK `(ABUS_MNG_NO, SNO)`와 중복 효과를 먼저 측정해 유지 시 운영 생성, 불필요 시 로컬 제거 및 백로그를 삭제 전환 |

`UX_BGDOCM_CONTACT_INFO`는 이름과 `GDOC-%` 술어가 폐기 대상이므로 운영에 생성하지 않는다.

BGDOC 최종 목표는 `V20260903_004__NormalizeBgdocNamespaces.sql` 적용 후
`V20260903_005__NormalizeBgdocIndexes.sql`로 다음 세 UNIQUE FBI를 만드는 것이다.

- `IX_TPRMPP_BGDOCM_02`: 담당자 `CDOC-%`
- `IX_TPRMPP_BGDOCM_03`: 공통 팝업 `PDOC-%`
- `IX_TPRMPP_BGDOCM_04`: 사업 가이드 `GDOC-%` 제목 유일성

이는 현재 네 입력의 직접 Gap 3건에는 포함하지 않은 **적용 대기 목표**다. 로컬 검증을 마친 뒤
운영에도 같은 마이그레이션과 사후 검증을 적용하고 `meta/index.txt`를 실측 결과로 재추출한다.

## 5. 로컬에서 변경이 필요한 부분

1. `V20260903_004` 사전 진단과 네임스페이스 보정을 수행한다.
2. `V20260903_005`로 `UX_BGDOCM_CONTACT_INFO` 및 존재 가능한
   `UX_BGDOCM_COMMON_POPUP`을 제거하고 표준 `IX_TPRMPP_BGDOCM_02`~`04`를 생성한다.
3. 전용 검증 SQL로 인덱스 이름·UNIQUE·함수식·중복 0건·Flyway 성공 이력을 확인한다.
4. `ITPOWN_DDL_live.sql`을 다시 추출해 이 보고서를 재검증한다. 스냅샷 파일을 직접 수정하지 않는다.

상세 적용·복구 순서는
`it_database/docs/operations/2026-09-03-bgdoc-namespace-index-handover.md`를 따른다.

## 6. 판정 한계

- 제공된 `meta/*.txt`와 로컬 DDL의 비교 결과다. 운영 Oracle 데이터 사전을 직접 조회한 결과는 아니다.
- 운영 테이블 메타에는 `CHAR`/`BYTE` semantics가 없어 이를 비교할 수 없다.
- 운영 메타에 없는 FK·CHECK·뷰·트리거·프로시저는 판정 범위 밖이다.
- 실제 운영 반영 완료는 `ALL_TAB_COLUMNS`, `ALL_INDEXES`, `ALL_IND_EXPRESSIONS`,
  `ALL_SEQUENCES`, `flyway_schema_history` 실측 후 확정한다.
