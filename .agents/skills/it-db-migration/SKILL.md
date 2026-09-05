---
name: it-db-migration
description: Use when authoring, numbering, applying, verifying, or recovering a Flyway migration for this IT Portal project's Oracle schema, including checksum mismatch, duplicate version, missing migration, sequence, or BYTE semantics failures.
---

# IT Portal DB 마이그레이션

## 핵심 원칙

규칙의 SoT는 `it_database`이며 이 스킬은 진입점 라우팅과 실행 판단만 담는다. 규칙 본문을 여기에 복제하지 않고 아래 문서를 실제로 읽은 뒤 작업한다.

적용되었거나 push된 마이그레이션은 수정·교체·개번하지 않고 새 버전을 추가한다. 로컬 적용까지만 수행하고 dev·prod 적용은 DBA 검토 대상으로 남긴다.

## 진입점

| 필요한 것 | 문서 |
| --- | --- |
| 저장소 작업 계약, 계정·비밀값, 적용 경계 | `it_database/CLAUDE.md` |
| 파일명·번호, 변경 단위, 파괴적 DDL 체크리스트, BYTE 컬럼 계약 | `it_database/docs/guides/migrations.md` |
| Flyway 적용 정책과 컬럼 변경 절차 | `it_backend/docs/guides/operations/flyway.md` |
| 테이블·컬럼·시퀀스 명명 | `meta/meta.txt` |
| 조회용 데이터 모델 관계 | `it_backend/docs/guides/persistence/data-model.md` |
| 운영 적용 대기 항목 관리 | `meta/backlog.md` |
| 과거 사고 복구 절차 | `it_database/docs/operations/` |

`meta/table.txt`, `meta/sequence.txt`, `meta/index.txt`는 운영 실제 현황 스냅샷이다. 마이그레이션을 작성했다는 이유로 수정하지 않는다. 로컬 DDL과 운영 메타의 차이를 확인해야 하면 `it-db-gap`을 사용한다.

## 워크플로우

1. 루트 `CLAUDE.md`와 `it_database/CLAUDE.md`, `docs/guides/migrations.md`를 읽는다.
2. 번호를 선점한다. 같은 날짜의 최댓값 다음 번호를 확인하고, 내용을 채우기 전에 빈 파일을 먼저 만든다.

```powershell
Get-ChildItem C:\it\it_database\migrations -Filter "V$(Get-Date -Format yyyyMMdd)_*.sql" |
  Select-Object -ExpandProperty Name | Sort-Object
```

3. `meta/meta.txt`와 현재 마이그레이션·백엔드 엔티티에 객체명과 타입을 대조하며 SQL을 작성한다. `VARCHAR2`는 `VARCHAR2(n BYTE)`로 명시하고 가이드의 계약 검증 블록을 함께 둔다.
4. 파괴적 DDL, NOT NULL 전환, PK·인덱스 재생성, 대량 backfill이면 사전 진단·백업 식별자·복구 입력을 먼저 확정하고 가이드의 체크리스트를 따른다.
5. 백엔드 `local-ext` 또는 `local-int` 기동으로 로컬 적용하고 `flyway_schema_history`의 성공 여부와 checksum을 확인한다.
6. 검증 SQL을 실행한다. 재사용할 검증이면 `it_database/docs/verification/{버전}.verify.sql`로 남긴다.
7. 함께 바뀌는 계약을 동기화한다.

| 물리 변경 | 함께 확인할 대상 |
| --- | --- |
| 테이블·컬럼 | 백엔드 엔티티, `data-model.md`, 테스트 픽스처 |
| 엔티티·DTO 변경 | 프론트 `npm run codegen`과 `npm run codegen:check`, 소비 코드 |
| 시퀀스 | 채번 컬럼과 현재값 |
| 인덱스 | `meta/backlog.md` 운영 적용 대기 등록 |
| 함께 검증한 리비전 | 루트 `versions.lock` |

8. 운영 적용이 필요하면 `meta/backlog.md`에 기존 양식과 `적용대기` 상태로 등록하고, 위험 변경은 `it_database/docs/operations/`에 사전 점검·적용·검증·복구를 기록한다.

## 실패 분기

증상을 먼저 확정하고 해당 런북을 따른다. 원인을 확정하지 못한 상태에서 `repair`를 실행하지 않는다.

| 증상 | 먼저 확인할 것 | 절차 |
| --- | --- | --- |
| 같은 버전 번호가 둘 이상 | 어느 쪽이 이미 적용·push되었는지 | `docs/operations/2026-08-23-migration-renumbering-recovery.md` |
| checksum 불일치로 기동 차단 | 파일이 적용 후 수정되었는지, DB가 재임포트되었는지 | `docs/operations/2026-09-01-flyway-002-checksum-recovery.md` |
| 이력에는 있으나 파일이 없음 | 파일 삭제인지 개번 잔재인지 | `docs/operations/2026-09-03-missing-migration-recovery.md` |
| 시퀀스 채번이 기존 행과 충돌 | 시퀀스별 채번 컬럼의 실제 최댓값 | `docs/operations/2026-07-30-board-reply-sequence-repair.md` |
| `ORA-12899` 값이 너무 큼 | 글자 수가 아니라 `LENGTHB` 바이트 길이 | `docs/operations/2026-09-03-byte-semantics-truncation-audit.md` |
| 이미 적용된 파괴적 DDL의 소급 대응 | 환경별 실제 스키마 상태 | `docs/operations/2026-09-03-destructive-ddl-retrospective.md` |

적용된 마이그레이션에 소급 가드를 추가하지 않는다. checksum을 보존한 채 실제 스키마를 진단하고 승인된 repair 또는 백업 기반 복구로 분기한다.

## 종료 조건

- 버전 번호가 기존 `migrations/V*.sql`과 충돌하지 않는다.
- 객체명·타입·기본값이 `meta/meta.txt`, 현재 마이그레이션, 백엔드 엔티티와 일치한다.
- 로컬 적용이 성공했고 `flyway_schema_history`의 상태와 checksum을 실제로 확인했다.
- 검증 SQL과 영향 범위의 백엔드 테스트를 실행했고 결과를 그대로 보고했다.
- 운영 적용이 필요한 항목이 `meta/backlog.md`에 등록되었거나 등록 불필요 사유가 기록되었다.
- 실행하지 못한 검증은 미검증으로 남기고 완료로 표현하지 않는다.

## 흔한 실수

- 적용되었거나 push된 파일을 제자리 수정해 checksum을 깨뜨린다.
- 개번으로 충돌을 해결해 다른 개발자의 적용 이력과 어긋나게 만든다.
- 원인을 확정하지 않고 `flyway repair`나 이력 직접 수정을 먼저 실행한다.
- `VARCHAR2(n)`을 세션 기본 semantics에 맡기고 바이트 길이를 검증하지 않는다.
- 저장 가능 여부를 글자 수로 판단하고 `LENGTHB`로 확인하지 않는다.
- 마이그레이션을 추가했다는 이유로 운영 현황 스냅샷인 `meta/index.txt`·`table.txt`·`sequence.txt`를 수정한다.
- Oracle DDL의 implicit commit을 무시하고 데이터 보정과 DDL을 하나의 롤백 단위로 가정한다.
- 비밀번호를 명령행 인자나 `.par` 파일, 로그에 남긴다.
- 물리 변경만 하고 백엔드 엔티티·생성 타입·테스트 픽스처를 함께 갱신하지 않는다.
