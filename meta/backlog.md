# 운영 DB 반영 사항 백로그

운영 DB 현황 it\meta\table.txt (테이블), it\meta\sequence.txt (시퀀스), it\meta\index.txt (인덱스) 기준 변경이 필요한 내용을 아래의 양식으로 정리한다.

## 1. 테이블

- 변경 구분 : 신규/수정/삭제

| NO | 테이블명  | 테이블한글명 | 컬럼명 | PK여부 | NULL여부 | Default Value | 타입	길이 | 소수점 | 변경 구분 | 작성일자   |
| -- | --------- | ------------ | ------ | ------ | -------- | ------------- | --------- | ------ | --------- | ---------- |
|    | 해당 없음 |              |        |        |          |               |           |        |           | 2026-09-01 |

## 2. 인덱스

- 변경 구분 : 신규/수정/삭제

| NO        | 테이블명      | 인덱스명             | UNIQUE여부 | 인덱스종류 | DB접속대상명 | DB스키마명 | 인덱스스페이스 | 인덱스컬럼(조합)                                                         | 인덱스구성유형   | FBI스크립트                                                                                                                                                                                                       | 설명                                                                                                                                       | 변경 구분 | 작성일자   |
| --------- | ------------- | -------------------- | ---------- | ---------- | ------------ | ---------- | -------------- | ------------------------------------------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| 1(적용중) | TPRMPP_CAPPLA | IX_TPRMPP_CAPPLA_02  | 아니요     |            | DPRMDB       | ITPOWN     | TSIITP01       | FNT_TB_NM,ASC;PK_COL_NM,ASC;FNT_TB_CRY_SNO,ASC;DEL_YN,ASC;APF_DCM_NO,ASC | 일반(컬럼구성)   |                                                                                                                                                                                                                   | 원본 테이블·관리번호·개정순번 단위로 최신 결재문서를 조회하기 위한 인덱스. 예산 목록·상세의 버전별 결재상태 매핑이 이 조합으로 조회한다 | 신규      | 2026-09-01 |
| 2(적용중) | TPRMPP_BPROJM | IX_TPRMPP_BPROJM_02  | 아니요     |            | DPRMDB       | ITPOWN     | TSIITP01       | ABUS_MNG_NO,ASC;DEL_YN,ASC;LST_YN,ASC;SNO,ASC                            | 일반(컬럼구성)   |                                                                                                                                                                                                                   | 사업관리번호 기준으로 재상신 개정본 이력과 현재 최종본을 조회하기 위한 인덱스                                                              | 신규      | 2026-09-01 |
| 3(적용대기) | TPRMPP_BGDOCM | IX_TPRMPP_BGDOCM_02  | 예         |            | DPRMDB       | ITPOWN     | TSIITP01       | DEL_YN,ASC;DOC_MNG_NO,ASC;DOC_TTL_CONE,ASC                               | Function Based Index | CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BGDOCM_02 ON ITPOWN.TPRMPP_BGDOCM (CASE WHEN DEL_YN = 'N' AND DOC_MNG_NO LIKE 'CDOC-%' AND DOC_TTL_CONE = 'SPEED_DIAL_CONTACT_INFO' THEN 1 END);                      | 담당자 정보 전용 `CDOC-` 문서가 활성 상태로 하나만 존재하도록 보장한다. 비표준명 `UX_BGDOCM_CONTACT_INFO`를 대체한다                    | 수정      | 2026-09-03 |
| 4(적용대기) | TPRMPP_BGDOCM | IX_TPRMPP_BGDOCM_03  | 예         |            | DPRMDB       | ITPOWN     | TSIITP01       | DEL_YN,ASC;DOC_MNG_NO,ASC;DOC_TTL_CONE,ASC                               | Function Based Index | CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BGDOCM_03 ON ITPOWN.TPRMPP_BGDOCM (CASE WHEN DEL_YN = 'N' AND DOC_MNG_NO LIKE 'PDOC-%' AND DOC_TTL_CONE = 'common.popup' THEN 1 END);                                  | 공통 안내 팝업 전용 `PDOC-` 문서가 활성 상태로 하나만 존재하도록 보장한다. 비표준명 `UX_BGDOCM_COMMON_POPUP`을 대체한다                 | 수정      | 2026-09-03 |
| 5(적용대기) | TPRMPP_BGDOCM | IX_TPRMPP_BGDOCM_04  | 예         |            | DPRMDB       | ITPOWN     | TSIITP01       | DEL_YN,ASC;DOC_MNG_NO,ASC;DOC_TTL_CONE,ASC                               | Function Based Index | CREATE UNIQUE INDEX ITPOWN.IX_TPRMPP_BGDOCM_04 ON ITPOWN.TPRMPP_BGDOCM (CASE WHEN DEL_YN = 'N' AND DOC_MNG_NO LIKE 'GDOC-%' THEN DOC_TTL_CONE END);                                                         | 삭제되지 않은 사업 가이드 문서가 제목별로 하나만 존재하도록 보장한다                                                                       | 신규      | 2026-09-03 |

### 인덱스 항목별 근거와 선행 조건

| NO | 발생 원인                                                                                                                                                                                                                                       | 마이그레이션                      | 선행 조건                                                                                                                |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1  | 커밋`323d8c5`가 이미 적용된 `V20260831_002`를 제자리 수정하면서 이 인덱스 생성 블록을 삭제했다. 같은 커밋의 `V20260831_005`가 002의 나머지 변경을 전부 철회하므로, 002가 스키마에 남기는 객체는 이 인덱스 하나뿐인데 그것이 소실된 상태다 | 신규`V20260901_001`로 복원 예정 | 없음(비고유 인덱스)                                                                                                      |
| 2  | 재상신 이력 조회 경로용으로`V20260831_001__AddBudgetVersionLookupIndexes.sql`이 추가했으나 `index.txt`에 미반영                                                                                                                             | `V20260831_001` (기적용)        | PK`(ABUS_MNG_NO, SNO)`가 이미 선두컬럼을 덮으므로 **실효성 재검토 필요**. 불필요 판정 시 이 행을 삭제로 전환한다 |
| 3  | `V20260902_001`이 `meta/index.txt` 규칙과 다른 `UX_BGDOCM_CONTACT_INFO`를 만들었고, BE-90의 문서번호 네임스페이스 분리 시 조건식도 `CDOC-%`로 바뀌어야 한다                                                                                  | `V20260903_002__NormalizeBgdocIndexes.sql` (작성 완료, DBA 적용 대기) | 기존 인덱스 존재 여부와 표현식을 확인한 뒤 정규명으로 재생성하고 구 인덱스를 제거한다                                         |
| 4  | `V20260902_002`가 `meta/index.txt` 규칙과 다른 `UX_BGDOCM_COMMON_POPUP`을 만들었고, BE-90의 문서번호 네임스페이스 분리 시 조건식도 `PDOC-%`로 바뀌어야 한다                                                                                | `V20260903_002__NormalizeBgdocIndexes.sql` (작성 완료, DBA 적용 대기) | 기존 인덱스 존재 여부와 표현식을 확인한 뒤 정규명으로 재생성하고 구 인덱스를 제거한다                                         |
| 5  | 가이드 콘텐츠 이관 계획이 요구하는 활성 사업 가이드 제목 유일성 인덱스다. 계획에 적힌 `V20260901_001`은 이미 다른 마이그레이션이 사용했으므로 실제 작성 시 다음 미사용 버전을 배정한다                                                     | `V20260903_002__NormalizeBgdocIndexes.sql` (작성 완료, DBA 적용 대기) | 활성 `GDOC-%` 문서의 `DOC_TTL_CONE` 중복 그룹이 0건이어야 한다                                                            |

> **철회 기록** — 초안 유일성 함수 기반 UNIQUE 인덱스(`IX_TPRMPP_BPROJM_03`,
> `IX_TPRMPP_BCOSTM_03`)는 2026-09-01 로컬 적용에서 불변식 오류가 드러나 철회했다.
> `LST_YN='N' AND DEL_YN='N'`은 미결 초안뿐 아니라 승격으로 강등된 과거 버전까지
> 포함하므로, 재상신을 거친 문서는 모두 위반이 된다. 미결 초안은 "최종본보다 뒤 순번"으로만
> 가려낼 수 있고 이는 행 단위 술어가 아니라 함수 기반 인덱스로 강제할 수 없다.
> 중복 초안 차단은 애플리케이션 가드(`ProjectVersionService`·`CostVersionService`)가 담당한다.

## 3. 시퀀스

- 변경 구분 : 신규/수정/삭제

| NO | Sequence  | Name | Value | Min Value | Max Value | Increment | Cache | Cycle | Ordered | 변경 구분 | 작성일자   |
| -- | --------- | ---- | ----- | --------- | --------- | --------- | ----- | ----- | ------- | --------- | ---------- |
|    | 해당 없음 |      |       |           |           |           |       |       |         |           | 2026-09-01 |

## 4. 데이터 보정

| NO | 대상 | 변경 내용 | 선행 조건 | 작성일자 |
| -- | ---- | --------- | --------- | -------- |
| 1(적용대기) | `TPRMPP_BGDOCM`, 필요 시 `TPRMPP_CFILEM` | `DOC_TTL_CONE='SPEED_DIAL_CONTACT_INFO'`인 기존 활성 문서를 `GDOC-`에서 `CDOC-`로, `DOC_TTL_CONE='common.popup'`인 기존 활성 문서를 `PDOC-`로 개번한다. `CFILEM.APG_FL_LNK_CTZ_NM`이 기존 문서번호를 참조하면 같은 매핑으로 갱신한다 | `V20260903_001__NormalizeBgdocNamespaces.sql` 작성 완료. 대상 건수·중복 키·연계 파일을 사전 진단하고 운영 인계 절차에 따라 DBA 적용 | 2026-09-03 |

> BE-95, BE-98, BE-99는 운영 이력·검증 규약 정리이며 현재 물리 스키마를 바꾸지 않는다. BE-96의 기존 자동 절단 문제도 후속 DDL로 소급 방지할 수 없으므로, 영향 감사와 신규 환경 배포 사전 게이트를 별도 운영 문서에서 관리한다.

## 5. 반영 순서

1. 기존 인덱스 1·2의 적용 상태와 실효성을 확정하고 `meta/index.txt` 재추출 기준을 기록
2. `V20260831_002`를 수정본으로 적용한 환경은 배포 전 `flyway repair` 1회
   (2026-09-01 기준 로컬 개발 환경이 여기 해당하며 이미 처리했다)
3. BE-90 사전 진단으로 `BGDOCM` 대상 문서와 `CFILEM` 연계 건수, 새 문서번호 충돌 여부 확인
4. 데이터 보정 NO 1을 적용해 `CDOC-`·`PDOC-` 네임스페이스로 분리
5. 비표준 `UX_BGDOCM_*`를 제거하고 인덱스 NO 3·4를 `IX_TPRMPP_BGDOCM_02`·`03`으로 생성
6. 활성 `GDOC-%` 제목 중복이 0건임을 확인한 뒤 인덱스 NO 5 생성
7. 인덱스 NO 2 실효성 판정 후 유지 또는 삭제 전환
8. 반영 완료 후 `it\meta\index.txt` 재추출로 현황 갱신

## 근거 문서

- [`docs/superpowers/plans/2026-09-01-budget-reapplication-review-remediation.md`](../docs/superpowers/plans/2026-09-01-budget-reapplication-review-remediation.md) — 코드리뷰 재검증과 개선 계획(결함 D5·D6·D7 대응)
- [`docs/superpowers/specs/2026-09-03-task-backlog-remediation-design.md`](../docs/superpowers/specs/2026-09-03-task-backlog-remediation-design.md) — `TASK.md` 전체 정리 순서와 DB 변경 경계
- [`docs/superpowers/plans/2026-09-01-guide-content-migration.md`](../docs/superpowers/plans/2026-09-01-guide-content-migration.md) — 사업 가이드 제목 유일성 요구와 충돌한 마이그레이션 버전
- [`it_database/docs/operations/2026-08-31-plan-reapplication-versioning.md`](../it_database/docs/operations/2026-08-31-plan-reapplication-versioning.md) — `V20260831_002` 적용·복구 기록
