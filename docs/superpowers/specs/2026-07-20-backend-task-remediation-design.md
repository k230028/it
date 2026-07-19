# 백엔드 잔여과제(BE-02·03·06·09·10·11) 조치 설계

- 작성일: 2026-07-20
- 대상: `TASK.md` ⚙️ 백엔드 섹션의 진행 중 과제 전체 6건
- 상태: 사용자 승인 완료 (범위·방침·접근안·설계 섹션별 승인)

## 1. 배경과 목표

TASK.md 백엔드 섹션에 남은 과제는 정합성 결함 1건(BE-09, High), 성능·DB 정합 3건(BE-03, BE-10, BE-11), 테스트 관행 1건(BE-02), 문서 부채 1건(BE-06)이다. 이번 사이클에서 6건을 하나의 조치 계획으로 묶되, 위험도 순서(High→Medium→Low)로 3개 Phase로 나눠 순차 완결한다.

확정된 방침:

| 항목 | 확정 방침 |
| ---- | --------- |
| 범위 | 전체 6건 일괄 계획 |
| BE-09 | 결정적 선택 + 다건 WARN 로그 (fail-fast 아님) |
| BE-11 | ORM `nullable` 완화 확정 (Flyway 변경 없음) |
| BE-06 | 상위 클래스 수동 정리 + Lombok 생성자 경고 정책화 |
| BE-03 | 실행계획 조사 + 명백한 후보만 이번에 구현 |
| BE-02 | 별도 작업이 아니라 각 코드 수정에 회귀 테스트를 편입 |
| 접근안 | 위험도 기반 3단계 순차 진행 (Phase A→B→C) |

## 2. 작업 단위와 저장소 전략

- `it_backend`는 독립 git 저장소이므로 코드 변경은 `it_backend` 내부에서 Phase별 브랜치로 진행한다. Phase 완료·검증 후 병합하고 다음 Phase를 시작한다.
- 외부 `C:\it` 저장소에는 스펙·계획 문서, BE-03 조사 리포트, TASK.md/TASK_DONE.md 갱신만 커밋한다.

## 3. Phase A — BE-09 비결정 첫 행 선택 제거 (🟠 High)

### 3.1 CostService (3곳: `getCost`, `updateCost`, `deleteCost`)

- 공통 private 헬퍼 `resolvePrimaryRow(List<Bcostm>)`를 도입한다.
- 선택 규칙: ① `LST_YN='Y'` 행 우선 → ② tie-break로 `BG_SNO` 내림차순(최신 일련번호).
- 규칙 적용 후에도 후보가 2건 이상이면(예: `LST_YN='Y'` 다건) WARN 로그를 남기고 tie-break 결과를 사용한다. 운영 데이터에 다건이 있어도 장애 없이 동작한다.
- `updateCost`의 기존 `lstYn` 필터 + `get(0)` 폴백을 이 헬퍼로 통일한다.
- `deleteCost`는 전 행 삭제 로직을 유지하고, 소유권 검증 대상 행만 헬퍼로 선택한다.
- `getCost` Javadoc의 "유니크하게 관리된다면 목록 크기는 1" 전제 설명을 실제 동작(결정적 선택 + 다건 경고)으로 현행화한다.

### 3.2 BizplanService.resolveBgNo()

- `BG-` 접두 후보 키를 `cncdRfrNo` 내림차순으로 정렬해 최신 채번 키를 선택한다.
- 서로 다른 `BG-` 키가 2건 이상이면 WARN 로그를 남긴다.
- "1건 전제, 다건 시 비보장" Javadoc을 실제 동작으로 현행화한다.

### 3.3 테스트 (BE-02 편입)

- 선택 로직은 서비스 계층이므로 단위 테스트로 커버한다:
  - 단건 조회 시 그대로 선택
  - `LST_YN='Y'`/`'N'` 혼재 시 `'Y'` 우선
  - 동순위 다건 시 `BG_SNO` 내림차순 선택 + WARN 경로 검증
  - `BG-` 키 다건 시 최신 키 선택 + WARN 경로 검증
- 이 Phase에서 Repository 쿼리 자체는 변경되지 않으므로 통합 테스트 추가는 없다.

### 3.4 완료 기준

- 비결정 선택 4곳(`CostService` 3곳 + `resolveBgNo`) 제거, 신규 단위 테스트 통과, `./gradlew test` 녹색.

## 4. Phase B — BE-10 팀 조회 배치화 + BE-11 Cfilem NULL 정책 (🟡 Medium)

### 4.1 BE-10: 검토자·협의회 위원 팀 조회

- `UserRepository`에 `findByTemCIn(Collection<String>)` 파생 쿼리를 추가한다(기존 `findByEnoIn` 선례와 동일 패턴).
- 대표자 선택 규칙을 공용 정적 유틸(`common/iam`의 `UserRepresentativeSelector`)로 한 곳에 두고 두 서비스가 공유한다:
  - ① 직위명 `팀장` 우선 → ② 사번(`eno`) 오름차순 첫 번째.
- `ReviewerService.getReviewers`: 팀별 반복 `findByTemC` 호출(N+1)을 `findByTemCIn` 1회 배치로 전환하고 `REVIEW_TEAM_MAP` 순서를 보존한다.
- `CommitteeService.resolveTeamLeads`: 동일하게 배치 전환하고, 기존 `팀장` 우선 로직을 공용 헬퍼로 흡수한다(빈 팀 제외·입력 순서 보존 동작 유지).

### 4.2 BE-11: Cfilem NULL 허용 정책 통일

- `Cfilem`의 `FL_NM`, `FL_PYS_NM`, `FL_KPN_PTH` 3개 컬럼에서 `nullable=false`를 제거해 실제 DB(NULL 허용)와 일치시킨다.
- Flyway 마이그레이션은 추가하지 않는다.
- 필드 Javadoc에 "DB는 NULL 허용이며 업로드 플로우가 항상 값을 채운다"는 정책을 명시한다.

### 4.3 테스트 (BE-02 편입)

- `findByTemCIn`: 공통 로컬 Oracle `@DataJpaTest` 하네스로 통합 테스트 추가.
- tie-break 규칙(팀장 우선, 사번 오름차순, 빈 팀 제외, 순서 보존): 단위 테스트.

### 4.4 완료 기준

- 배치 전환·tie-break 적용, Cfilem 3컬럼 완화, `./gradlew test integrationTest` 녹색.

## 5. Phase C — BE-03 프로젝션 조사·구현 + BE-06 Javadoc 정리 (🟡/🟢)

### 5.1 BE-03: 잔여 전체 엔티티 로딩 후보 재식별

- 조사 방법:
  - 집행 4단계 상세 조회 등 네이티브/파생 쿼리를 grep으로 수집하고, 조회 컬럼 대비 실제 사용 컬럼을 분석한다.
  - 로컬 Oracle `EXPLAIN PLAN`으로 후보별 실행계획을 실측한다.
- 산출물: `docs/superpowers/reports/2026-07-be03-projection-survey.md` (외부 저장소).
- 구현 범위: **목록성 조회인데 전체 엔티티를 적재하는 명백한 후보만** 이번에 프로젝션 분리를 구현한다. 경계선 후보는 측정 근거와 함께 TASK.md에 후속 등록한다.

### 5.2 BE-06: Javadoc 잔여 경고 정리와 정책화

- 상위 오염원의 누락 주석을 한글 주석 원칙에 따라 수동 보강한다: `Bprojm`(63건), `ContractController`(18건), `ApplicationDto`(18건), `CouncilProjectRow`(17건), `UmsPayload`(16건), `Btermm`(16건).
- Lombok 기본 생성자 경고 정책:
  - 핵심 DTO는 Javadoc을 단 명시적 no-arg 생성자로 전환한다.
  - 잔여 대량 DTO는 허용 기준으로 문서화하고 총량 기준선을 기록한다.
  - 정책은 `it_backend/CLAUDE.md`에 규칙으로 남긴다.
- 측정: `-Xmaxwarns` 임시 적용으로 전수 재측정한다(javadoc 기본 출력 상한 100건 우회).

### 5.3 완료 기준

- 조사 리포트 산출, 명백 후보 프로젝션 적용, Javadoc 경고 총량 재측정·정책 문서화, `./gradlew test` 녹색.

## 6. 검증·마무리

- Phase A·C 후 `./gradlew test`, Phase B 후 `./gradlew test integrationTest` 녹색 확인.
- 완료 항목은 TASK.md에서 제거하고 TASK_DONE.md에 근거와 함께 이관한다. BE-02는 지속 관행 항목이므로 이번 사이클에서 추가된 테스트를 근거로 남기되 항목 자체는 유지한다.
- README 변경 이력을 갱신한다.

## 7. 범위 제외

- BE-07·BE-08: 이미 완료(✅ Done) — TASK.md 정리 시 TASK_DONE.md로 이관만 수행.
- 프론트엔드·사전협의·Clean Code 등 다른 섹션 과제는 이번 계획에 포함하지 않는다.
- Flyway DDL 변경 없음(BE-11은 ORM 선언 완화로 확정).
