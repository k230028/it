# 운영·로컬 DB Gap 분석 결과 (2026-09-07, 2차)

같은 날 1차 비교(로컬 DDL 09-04 스냅샷, 구 형식 `index.txt`) 결과를 재추출 입력으로 갱신한 보고서다. 1차 결과와의 대응은 5장에 적었다.

## 1. 결론

`FLYWAY_SCHEMA_HISTORY`를 제외하고 제공된 운영 메타와 로컬 DDL 스냅샷을 비교했다.

- 테이블 92개, 컬럼 1,686개, PK 92개, 시퀀스 62개의 **구조 Gap은 0건**이다. 1차의 컬럼 존재 Gap 18건은 로컬에 `V20260907_002`가 적용되며 해결됐다.
- 남은 차이는 `TPRMPP_BGDOCM` 인덱스 교체 1쌍이다. 운영에는 `IX_TPRMPP_BGDOCM_01`만, 로컬에는 통합 `IX_TPRMPP_BGDOCM_02`만 있다. 운영의 컬럼 변경은 이미 반영돼 있으므로 `V20260907_002` 전체가 아니라 인덱스 교체 구간만 운영 적용 대상이다.
- 1차의 로컬 전용 인덱스 6건 중 `IX_TPRMPP_CAPPLA_02`·`IX_TPRMPP_BPROJM_02`는 운영 실측에 존재해 **해결**됐고, 접두어 기반 `IX_TPRMPP_BGDOCM_02`~`05`는 로컬에서 제거돼 **해결**됐다.
- 재추출된 `meta/index.txt`에 PK 인덱스 92개가 처음 포함됐다. 컬럼 구성은 전부 일치하지만 이름이 62개 다르다. 구조 영향은 없고 명명 규약 결정이 필요하다.
- 운영 `IX_TPRMPP_BGDOCM_01`은 함수 기반이 아니라 `(DEL_YN, DOC_MNG_NO, DOC_TTL_CONE)` 일반 UNIQUE 인덱스로 실측됐다. 구 `index.txt`의 FBI 정의와 다르며, PK를 포함하므로 유일성 보장 효과가 없다.

## 2. 비교 기준

| 입력 | 기준 시점 |
| --- | --- |
| `meta/table.txt` | 루트 `0628609` 대비 **미커밋 수정본** (2026-09-07 12:51). 커밋 기준은 `bb53b8d` |
| `meta/sequence.txt` | 루트 `e853680` (2026-08-20), 변경 없음 |
| `meta/index.txt` | **미커밋 재추출본** (2026-09-07 20:22). 형식이 신청서에서 데이터 사전 추출로 바뀌었다 |
| `it_database/ITPOWN_DDL_live.sql` | **미커밋 재추출본**, `Generated at: 2026-09-07 20:14:45 +09:00` |

### 2.1 로컬 스냅샷은 `V20260907_002`가 적용된 상태다

`BAK_TPRMPP_BPROJM`·`BAK_TPRMPP_BPROJL` 백업 테이블, BPROJM·BPROJL의 CLOB 4개, BGDOCM·BGDOCL의 `DOC_DTL_ITM_C`, 통합 `IX_TPRMPP_BGDOCM_02`가 모두 스냅샷에 있다. 마이그레이션 파일 `V20260907_001`(0바이트 선점)·`V20260907_002`는 DB 저장소에서 아직 미추적이다.

### 2.2 `meta/index.txt` 형식 변경

| 항목 | 구 형식 (2026-08-28) | 신 형식 (2026-09-07) |
| --- | --- | --- |
| 출처 | 인덱스 신청서 (요청구분·설명 포함) | 데이터 사전 추출 (인덱스명·Column·테이블·유형·Unique·Tablespace) |
| PK 인덱스 | 없음 | 92개 포함 |
| 함수 기반 인덱스 | `FBI스크립트` 열에 원문 | `SYS_NC000nn$` 가상 컬럼만 표시, `Expression` 열은 전부 `[NULL]` |
| 행 수 | 70 | 164 (PK 92 + 일반 72) |

따라서 이번 회차부터 FBI는 **존재·테이블·UNIQUE·종류**만 비교하고 표현식은 비교할 수 없다. 반대로 PK 인덱스 이름과 테이블스페이스는 처음 비교 대상이 됐다.

## 3. 직접 비교 결과

| 비교 항목 | 결과 |
| --- | --- |
| 테이블명·테이블 코멘트 | 92개 전부 일치. 로컬 전용 `BAK_TPRMPP_BPROJM`·`BAK_TPRMPP_BPROJL` 2개 |
| 컬럼 존재·코멘트 | 공통 1,686개 전부 일치 |
| 타입·길이·정밀도·스케일 | 1,686개 전부 일치 |
| 컬럼 순서 | 4개 테이블 차이 (4.2) |
| PK 구성·순서 | 92개 전부 일치 |
| PK 인덱스명 | 62개 차이 (4.3) |
| NULL 제약 | 실질 Gap 0건. PK가 NULL을 막는 표기 차이 2건만 존재 |
| 기본값 | 정규화 후 전부 일치. `DEFAULT NULL` 표기 차이 29건은 조치 불필요 |
| 시퀀스명·`MINVALUE`·`MAXVALUE`·`INCREMENT`·`CACHE`·`CYCLE`·`ORDER` | 62개 전부 일치 |
| 일반 인덱스 | 공통 71개 테이블·컬럼·순서·UNIQUE·종류 일치. 운영 전용 1개, 로컬 전용 1개 (4.1) |
| FBI 표현식 | `IX_TPRMPP_BPAYMM_03`·`BCONTM_03`·`BDELIM_03` 3개는 운영 표현식 부재로 비교 불가 |
| 테이블스페이스 | 운영 164개 전부 `TSIITP01`. 로컬 DDL에 테이블스페이스 절이 없어 비교 불가 |

정규화 규칙은 직전 회차와 같다. 정밀도 미지정 `NUMBER`의 운영 길이 `22`는 로컬 `NUMBER` 미지정과 같게 보고, 운영의 빈 소수점은 `0`으로 본다.

## 4. 상세 Gap

### 4.1 `TPRMPP_BGDOCM` 인덱스 교체 — 운영 미적용

| 인덱스 | 운영 실측 | 로컬 | 판정 |
| --- | --- | --- | --- |
| `IX_TPRMPP_BGDOCM_01` | 일반 UNIQUE `(DEL_YN, DOC_MNG_NO, DOC_TTL_CONE)` | 없음 (`V20260907_002`가 삭제) | 운영 적용 후보 |
| `IX_TPRMPP_BGDOCM_02` | 없음 | UNIQUE FBI `(CASE DEL_YN WHEN 'N' THEN DOC_DTL_ITM_C END, CASE DEL_YN WHEN 'N' THEN DOC_TTL_CONE END)` | 운영 적용 후보 |

두 차이는 `V20260907_002`의 인덱스 교체 구간이 만든다. 이 구간은 `IX_TPRMPP_BGDOCM_01`~`05`·`UX_BGDOCM_*`를 이름으로 제거한 뒤 `IX_TPRMPP_BGDOCM_02`를 생성한다. 운영의 `BGDOCM_01`이 FBI가 아니어도 삭제 루프는 이름 기준이므로 그대로 적용된다. 다만 운영은 컬럼 변경이 이미 반영돼 있고 `BAK_*` 테이블이 없어 스크립트 전체를 실행하면 사전 진단(구 컬럼 4개 존재)에서 실패하므로, 운영에는 인덱스 교체 구간만 발췌해 적용한다.

운영 `IX_TPRMPP_BGDOCM_01`의 실측 구조는 구 `index.txt` NO 19의 정의(`CASE WHEN DEL_YN='N' AND DOC_MNG_NO LIKE 'FDOC-%' THEN DOC_TTL_CONE END`)와 다르다. 일반 인덱스 세 컬럼에 PK `DOC_MNG_NO`가 포함되므로 활성 FDOC 문서 제목 유일성을 보장하지 못한다. 신 `BGDOCM_02`는 `DOC_DTL_ITM_C='02'`(길라잡이)와 제목 조합으로 이를 대체하므로 별도 보정은 필요 없다. 다만 `meta/backlog.md`에는 `BGDOCM_01` 삭제 행이 여전히 없다.

### 4.2 컬럼 순서 차이 4건 — 조치 불필요

정의서(`meta/table.txt`)는 신 컬럼을 설계 위치에 두고, 물리 구조는 `ALTER TABLE ... ADD` 순서대로 말미에 둔다.

| 테이블 | 정의서 위치 | 물리 위치 (로컬) |
| --- | --- | --- |
| `TPRMPP_BGDOCM` | `DOC_DTL_ITM_C`가 3번째 | 11번째 (말미) |
| `TPRMPP_BGDOCL` | `DOC_DTL_ITM_C`가 4번째 | 15번째 (말미) |
| `TPRMPP_BPROJM` | CLOB 4개가 4~7번째, 순서 CONE·NCS·DRCN·XPT | 47~50번째, 순서 CONE·XPT·DRCN·NCS |
| `TPRMPP_BPROJL` | CLOB 4개가 5~8번째, 순서 CONE·DRCN·NCS·XPT | 51~54번째, 순서 CONE·XPT·DRCN·NCS |

운영에 같은 마이그레이션을 적용하면 운영 물리 순서도 로컬과 같아진다. 정의서를 물리 순서에 맞출지는 6장에서 다룬다. 정의서 안에서 BPROJM과 BPROJL의 CLOB 순서가 서로 다른 점은 정의서 내부 불일치다.

### 4.3 PK 인덱스명 차이 62건 — 명명 규약 결정 필요

운영은 92개 전부 `PK_TPRMPP_{접미}` 형식이다. 로컬은 30개만 같은 형식이고 62개는 다음과 같다.

- 60개: `PK_{접미}` (예: `PK_BPROJM`, `PK_CCODEM`, `PK_BGDOCM`)
- 2개: 컬럼명이 붙은 형식 `PK_BITEMM_GCL_MNG_NO_SNO`, `PK_BCOSTM_BG_NO_BG_SNO` (`V20260820_008`이 생성)

PK 컬럼 구성과 순서는 92개 전부 일치하므로 구조 영향은 없다. 백엔드 `src/main`은 어느 제약명도 참조하지 않는다. 마이그레이션 저장소 안에서도 `PK_TPRMPP_` 19건과 짧은 형식 21건이 섞여 있어 명명 규약이 확정돼 있지 않다.

### 4.4 조치 불필요 차이

- `BAK_TPRMPP_BPROJM`·`BAK_TPRMPP_BPROJL`: `CREATE TABLE AS SELECT` 백업이라 PK·코멘트가 없다. 운영 적용 시 같은 테이블이 생기므로 Gap이 아니라 보존 기간 관리 대상이다.
- `TPRMPP_CRTOKM.LGN_LOG_SNO`, `TPRMPP_CUSERI.ENO`: PK라서 `NOT NULL` 표기 차이는 동작이 같다.
- 로컬 `DEFAULT NULL` 표기 29건: 운영 메타의 공란과 동작이 같다.
- 시퀀스 현재값 62개 전부 차이, 모두 로컬이 크다. 런타임 카운터이므로 조정하지 않는다.

## 5. 직전 결과 대비 추적

| 항목 | 2026-09-04 | 2026-09-07 1차 | 2026-09-07 2차 |
| --- | --- | --- | --- |
| `IX_TPRMPP_CAPPLA_02` 로컬 전용 | 잔존 | 잔존 | **해결** (운영 실측 존재) |
| `IX_TPRMPP_BPROJM_02` 로컬 전용 | 잔존 | 잔존, 판단 보류 | **해결** (운영 실측 존재). 실효성 재검토는 백로그 NO 2에 그대로 남는다 |
| `UX_BGDOCM_CONTACT_INFO` 로컬 전용 | 잔존 | 해결 | 해결 |
| `IX_TPRMPP_BGDOCM_02`~`05` 접두어 FBI 로컬 전용 | — | 신규 | **해결** (로컬에서 제거) |
| 컬럼 존재 Gap 18건 | — | 신규 | **해결** (로컬 적용) |
| `IX_TPRMPP_BGDOCM_01` 운영 전용 | — | 예고 | **신규** |
| 통합 `IX_TPRMPP_BGDOCM_02` 로컬 전용 | — | 예고 | **신규** |
| 컬럼 순서 4건 | — | 예고 | **신규**, 조치 불필요 |
| `BAK_*` 로컬 전용 테이블 2건 | — | 예고 | **신규**, 조치 불필요 |
| PK 인덱스명 62건 | 비교 불가 | 비교 불가 | **신규** (입력 형식 변경으로 처음 노출) |

## 6. 조치 방향

### 6.1 운영 적용 후보

| 대상 | 조치 |
| --- | --- |
| `V20260907_002` 인덱스 교체 구간 | `IX_TPRMPP_BGDOCM_01` 삭제 후 `IX_TPRMPP_BGDOCM_02` 생성. 컬럼 변경은 운영 `table.txt`(09-07 12:51)에 이미 반영돼 있어 스크립트 전체는 적용하지 않는다. `DOC_DTL_ITM_C` 분류·공통코드 5건은 메타로 반영 여부를 알 수 없으므로 `meta/backlog.md` 4장의 확인 조회로 먼저 판정한다 |
| `meta/index.txt`·`meta/backlog.md` | `IX_TPRMPP_BGDOCM_01` 삭제 행을 추가해 의도된 제거임을 기록한다. 운영 실측이 일반 인덱스였다는 사실도 함께 남긴다 |
| `BAK_TPRMPP_BPROJM`·`BAK_TPRMPP_BPROJL` | 보존 기간과 삭제 시점을 `docs/operations/`에 기록한다. 삭제는 새 마이그레이션으로 표현한다 |

운영 직접 변경 명령은 제안하지 않는다.

### 6.2 로컬 갱신 후보

1. `V20260907_001`·`V20260907_002`를 DB 저장소에 커밋하고, 재추출한 `ITPOWN_DDL_live.sql`을 함께 커밋한다.
2. 재추출한 `meta/index.txt`와 `meta/table.txt`를 커밋한다. 형식이 바뀐 `index.txt`는 `meta/backlog.md` 상단의 "운영 DB 현황" 설명과 맞는지 확인한다.
3. `meta/table.txt`의 신 컬럼 위치를 물리 순서로 맞출지 결정한다. `tools/compare-table-spec.mjs --apply`는 물리 추출본 순서를 따르므로 그 방식을 쓰면 4.2의 순서 차이가 사라진다.

### 6.3 판단 보류

- **PK 제약·인덱스 명명 규약**: 운영 `PK_TPRMPP_*`로 로컬을 맞추려면 `RENAME CONSTRAINT`·`ALTER INDEX RENAME` 마이그레이션 62건이 필요하다. 반대로 운영을 바꿀 이유는 없다. 규약을 `it_database/CLAUDE.md`나 `meta/meta.txt`에 먼저 확정한 뒤 신규 테이블부터 적용하고, 기존 62개의 일괄 개명은 별도 승인으로 다룬다.
- `IX_TPRMPP_BPROJM_02` 실효성: Gap은 해결됐지만 PK `(ABUS_MNG_NO, SNO)`와 선두 컬럼이 겹친다는 백로그 NO 2의 재검토 항목은 유효하다.

## 7. 판정 한계

- 제공된 `meta/*.txt`와 로컬 DDL의 비교 결과다. 운영 Oracle 데이터 사전을 직접 조회한 결과는 아니다.
- 네 입력 중 `table.txt`·`index.txt`·DDL 스냅샷·`V20260907_00x`가 **미커밋** 상태다. 커밋 시점에 내용이 바뀌면 판정이 달라진다.
- 신 형식 `index.txt`는 FBI 표현식을 담지 않는다. `IX_TPRMPP_BPAYMM_03`·`BCONTM_03`·`BDELIM_03`의 운영 표현식이 로컬과 같은지는 `ALL_IND_EXPRESSIONS` 실측으로만 확정할 수 있다.
- 로컬 DDL에는 테이블스페이스 절이 없어 운영 `TSIITP01` 배치를 대조할 수 없다.
- 운영 테이블 메타에는 `CHAR`/`BYTE` semantics가 없어 `DOC_DTL_ITM_C`의 BYTE 선언을 대조할 수 없다. 마이그레이션의 `CHAR_USED='B'` 자체 검증에 의존한다.
- 운영 메타에 없는 FK·CHECK·뷰(`V_ITPAPP_LOG_FEED`)·트리거·프로시저는 판정 범위 밖이다.
- 실제 운영 반영 완료는 `ALL_TAB_COLUMNS`, `ALL_INDEXES`, `ALL_IND_EXPRESSIONS`, `ALL_CONSTRAINTS`, `ALL_SEQUENCES`, `flyway_schema_history` 실측 후 확정한다.
