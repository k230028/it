---
name: it-db-gap
description: Use when comparing this IT Portal project's local Oracle DDL snapshot with exported production table, sequence, or index metadata and producing a directional schema-gap report.
---

# IT Portal DB Schema Gap 분석

## 핵심 원칙

입력 스냅샷을 읽기 전용으로 비교하고 운영 변경 필요와 로컬 변경 필요를 분리한다. 이 스킬은 보고서를 만들 뿐 운영 DB, DDL, 마이그레이션, 메타 파일을 수정하지 않는다.

## 입력과 출력

| 역할 | 경로 |
| --- | --- |
| 로컬 DDL | `it_database/ITPOWN_DDL_live.sql` |
| 운영 테이블·컬럼 메타 | `meta/table.txt` |
| 운영 시퀀스 메타 | `meta/sequence.txt` |
| 운영 인덱스 메타 | `meta/index.txt` |
| 결과 | `docs/db-schema-gap/db-schema-gap-YYYY-MM-DD.md` |

필수 입력이 없거나 파싱할 수 없으면 비교 결과를 추측하지 말고 누락·형식 오류를 보고한다. `FLYWAY_SCHEMA_HISTORY`는 분석에서 제외한다.

## 비교 항목

- 테이블과 컬럼 존재 여부
- 테이블·컬럼 코멘트
- 타입, 길이, 정밀도, 스케일
- 컬럼 순서, NULL, 기본값, PK
- 시퀀스명과 현재값·최댓값 관련 속성
- 인덱스 컬럼, 순서, 유일성

Oracle이 동등하게 해석하는 대소문자, 공백, 따옴표, 기본값 표현은 정규화한 뒤 비교한다. 이름만 다른 인덱스와 구조가 다른 인덱스를 구분한다. 스냅샷 생성 시점이 다르면 보고서에 한계로 명시한다.

## 워크플로우

1. 루트와 `it_database/CLAUDE.md`를 읽고 네 입력 파일의 존재와 갱신 시각을 확인한다.
2. 로컬 DDL과 운영 메타를 동일한 객체 모델로 정규화한다.
3. 항목별 차이를 운영 전용, 로컬 전용, 속성 불일치로 분류한다.
4. 각 차이의 근거 원문과 변경 방향을 재확인한다.
5. 최신 기존 보고서와 비교해 신규·잔존·해결 여부를 표시한다.
6. 요약, 상세 Gap, 조치 방향, 비교 한계를 포함한 날짜별 보고서를 생성한다.

## 조치 방향

- 마이그레이션이 SoT인데 운영만 뒤처지면 운영 적용 후보로 분류한다.
- 운영이 승인된 최신 구조이고 로컬 DDL 스냅샷만 뒤처지면 로컬 갱신 후보로 분류한다.
- 어느 쪽이 맞는지 코드·마이그레이션에서 확정할 수 없으면 판단 보류로 둔다.
- 적용된 Flyway 파일 수정이나 운영 직접 변경 명령을 제안하지 않는다. 필요한 변경은 새 마이그레이션 후보로 표현한다.

## 흔한 실수

- 차이가 있다는 이유만으로 운영을 정답 또는 로컬을 정답으로 가정한다.
- 컬럼 순서 차이를 타입·데이터 손실 위험과 같은 심각도로 취급한다.
- 시퀀스 원본을 테이블 메타 파일에서 읽는다.
- 스냅샷 비교를 운영 DB 실시간 조회 결과로 표현한다.
