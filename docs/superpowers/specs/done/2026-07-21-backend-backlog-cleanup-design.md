# TASK.md 백엔드 섹션 전면 정리 설계 (2026-07-21)

## 배경

`TASK.md` [백엔드] 섹션에는 BE-02, BE-03, BE-06, BE-12~BE-18 총 9건이 남아 있다.
2026-07-21 코드·문서 조사 결과 과제 성격이 네 갈래로 나뉘며, "모두 정리"의 종결 방식이 각각 다르다.

| 분류 | 과제 | 종결 방식 |
| ---- | ---- | --------- |
| 즉시 구현 가능 | BE-12, BE-13, BE-14, BE-15, BE-16 | 코드/DDL 구현 후 `TASK_DONE.md` 이관 |
| 상시 규칙화 | BE-02, BE-06 | 잔여 보충 후 `it_backend/CLAUDE.md` 규칙 이관·종결 |
| 사용자 결정 선행 | BE-17 | 결정 세션(결정 #1~#5) 후 승인분만 재계획 |
| 외부/시간 조건 대기 | BE-03, BE-18 | 🏛️ External 재분류 + 조건 명시 |

사용자 승인 사항(2026-07-21):

- **A안 전면 정리** 채택 — 구현 5건 + 규칙화 종결 + BE-17 결정 세션 + External 재분류를 한 프로그램으로 수행.
- **ERR-08 병합** — BE-13과 같은 코드(`PlanEvaluationService`)를 지목하므로 함께 처리.
- 설계안 본문 승인 — "이대로 진행".

## 목표

1. 백엔드 섹션의 즉시 구현 가능 5건(+ERR-08)을 TDD로 해소한다.
2. BE-02·BE-06을 상시 규칙으로 `it_backend/CLAUDE.md`에 명문화하고 백로그에서 종결한다.
3. BE-17 보류 정책 5건을 결정 세션으로 확정한다(승인분 재계획, 현행 유지 확정분 종결).
4. BE-03·BE-18을 🏛️ External로 재분류하고 재개 조건을 실행 가능한 형태로 명시한다.
5. 완료분을 기존 관례(BE-09~11 이관 형식)대로 `TASK_DONE.md`로 이관한다.

## 비목표

- BE-06 Javadoc 잔여 1,043건의 일괄 해소(정책 운영으로 대체).
- BE-03 경계선 9개의 프로젝션 전환(운영 통계 확보 전 판정 불가).
- BE-17 결정 전 차단 경로의 코드 변경(조사 리포트의 차단 계약 준수).
- BE-18 레거시 경로의 즉시 제거(관측 조건 미충족).

## 작업 구조 — 4 Wave, 위험 오름차순

코드 작업은 `it_backend`(중첩 repo) 브랜치 `chore/backend-backlog-cleanup`, 인덱스 DDL은 `it_database`, 문서는 루트 repo에서 각각 커밋한다. 모든 코드 작업은 실패 테스트 선행(TDD).

### Wave 1 — 저위험 정합·DB

#### BE-15: `Bplana` 복합키 길이 정합화

- 현황: `Bplana.java`의 `ABUS_MNG_NO`·`REQ_DOC_NO` `length=32`. 물리 DDL(`ITPOWN_DDL_live.sql`)과 형제 엔티티 `Bplanm`은 30.
- 변경: 두 컬럼 length를 30으로 정정. DDL 변경 없음(물리가 이미 30).
- 검증: 기존 매핑·리포지토리 테스트 회귀. 31~32자 값이 애플리케이션 계층에서 거부되는지 확인.

#### BE-14: `TPRMPP_BPLANA` 역방향 조회 인덱스

- 현황: PK `(ABUS_MNG_NO, REQ_DOC_NO)`만 존재. `BplanaRepository`의 `findAllByReqDocNoAndDelYn`(단건)·`findAllByReqDocNoInAndDelYn`(IN)은 `REQ_DOC_NO` 선행 조회라 PK를 타지 못함.
- 변경: 새 Flyway `V20260721_001__AddBplanaReqDocNoIndex.sql`(당일 선행 스크립트가 생기면 일련번호만 조정)로 `(REQ_DOC_NO, DEL_YN, ABUS_MNG_NO)` 인덱스 추가. `V20260629_002`의 멱등(`idx_exists`) 패턴 재사용. 애플리케이션 코드 무변경.
- 검증: 로컬 Oracle에서 적용 전/후 `EXPLAIN PLAN`으로 FULL → INDEX RANGE 전환 확인·기록. `BplanaRepository` IN 변형 Oracle IT를 함께 추가(Wave 3 BE-02 보충분 선반영).

#### BE-16: 공통코드 일괄 업로드 배치화

- 현황: `AdminService.bulkUpsertCodes`가 행마다 복합키 단건 SELECT + 개별 `save()`.
- 변경: 요청 키 집합 선조회(`findAllById` 등) → 메모리 upsert 판정 → 기존행은 dirty checking, 신규행만 `saveAll`. created/updated 카운터·응답 계약·요청 내 중복 행 처리 의미 보존.
- 검증: 동작 동등성 단위 테스트 + 리포지토리 호출 횟수가 행수와 무관하게 상수 회인지 검증.

### Wave 2 — 성능 핵심

#### BE-13 + ERR-08: 기준 계획 탐색 통합과 예외 구분

- 현황: `PlanEvaluationService.findBaselinePlan`이 완료 협의회 전체를 `FST_ENR_DTM DESC`로 받아 후보마다 `planService.getPlan()` 호출, `catch (Exception)`으로 전 예외 스킵. 동률 tie-break 없음. 같은 서비스의 사업·전산업무비·사업명 JSON 파싱 실패도 빈 목록·0건·관리번호로 조용히 폴백(ERR-08).
- 변경:
  - 협의회↔계획 조인 단건 조회로 통합 — 조건 판정을 DB로 내리고 `ORDER BY FST_ENR_DTM DESC, IT_PTL_ASCT_ID DESC` + `FETCH FIRST 1`로 동률 비결정 제거.
  - 예외 정책: **미존재만** 빈 결과 폴백. 데이터 손상(JSON 파싱 실패)은 문맥 로그(협의회 ID·계획 ID 포함) + 응답의 명시적 불완전/실패 상태로 노출하고, DB·권한 예외는 폴백 없이 전파한다. JSON 파싱 폴백 경로(사업·전산업무비·사업명)도 동일 원칙 적용.
  - 인덱스: `EXPLAIN PLAN`과 BASCTM 행 규모 확인 후 이득이 확인될 때만 Flyway 추가(소규모 테이블이면 미추가로 기록).
- 검증: 신규 조회 Oracle IT(정렬·tie-break 계약, 동률 fixture 포함) + 예외 시나리오 단위 테스트(손상 JSON → 실패 상태, 미존재 → 폴백).

#### BE-12: 사업 일괄 상세 조회 배치화

- 현황: `ProjectService.getProjectsByIds()`가 ID마다 `getProject()`를 호출해 ID당 6~8쿼리(결재선·조직/사용자명·품목·상태·예산요약). 편성예산 합계만 기 배치화. 프로덕션 호출 3곳: `PlanEvaluationService`, `PlanService`, `ProjectController`.
- 변경: 같은 파일 `enrichProjectListBatch()` 선례를 따라 영역별 IN 배치 조회 + 메모리 조립으로 전환. 필요한 IN 리포지토리 메서드는 대부분 기존재(`findViewsByFntTbNmAndPkColNmIn...`, `findReadViewsByDcdMngNoIn...`, `findNameViewsBy...In`, `findByAbusMngNoInAndDelYn` 등). `getProject()` 단건 경로와 호출 3곳의 시그니처·응답 계약 불변.
- 검증: 전환 전 특성화 테스트로 기존 응답 고정 → 전환 → Hibernate Statistics 기반 쿼리 횟수 회귀 테스트(N건 조회 시 상수 회). 영향 테스트(`ProjectServiceTest`, `ProjectControllerTest`, `PlanServiceTest`, `PlanEvaluationServiceTest` 스텁) 정비.

### Wave 3 — 테스트 보충·규칙화

#### BE-02: IT 보충 후 상시 규칙 이관

- 보충 대상: `BplanaRepository` IN 변형(Wave 1에서 선반영), Wave 2 신규 기준 계획 조회(작업 중 TDD로 생성), `PlanEvaluationRepository` 파생 finder.
- 규칙화: `it_backend/CLAUDE.md`에 "신규 QueryDSL/JPQL/네이티브 조회는 `AbstractOracleRepositoryTest` 기반 Oracle IT로 결과 동등성·정렬·null 계약을 검증한다"를 명문화.
- 종결: 보충 완료 + 규칙 명문화 확인 후 `TASK_DONE.md` 이관.

#### BE-06: Javadoc 정책 이관

- `it_backend/CLAUDE.md`에 "신규 미분류 Javadoc 경고 불허, 기존 잔여(2026-07-21 기준 1,054건 중 허용 분류 제외 1,043건)는 기능 변경 시 의미 있는 공개 계약부터 점진 정리" 정책 명문화.
- 종결: 정책 명문화 후 `TASK_DONE.md` 이관. 경고 일괄 해소는 하지 않음.

### Wave 4 — 결정·재분류

#### BE-17: 프로젝션 보류 정책 결정 세션

- 대상: 조사 리포트(`docs/superpowers/reports/2026-07-be03-projection-survey.md`)의 결정 #1 BITEMM GCL 대표행, #2 BBUGTM 대표행, #3 BPROJM 배치 사업명 대표행, #4 BESTTM 물리 PK/JPA Id 정합, #5 `(sourceNamespace,key)` 분리.
- 진행: 결정별 "추천안 + 근거"를 제시하는 세션 1회. 승인분은 구체 과제로 TASK.md 재등록, 현행 유지 확정분은 종결 기록. 결정 전 차단 경로 코드는 불변.

#### BE-03: 경계선 9개 External 재분류

- TASK.md에서 우선순위를 🏛️ External로 변경하고, 재개 조건으로 필요한 운영 데이터를 명시: 대상 경로별 AWR/SQL 실행 통계, API 호출량, 응답 계약 확정 여부(알림함 DTO 등).

#### BE-18: 구 검토자 경로 External 재분류

- TASK.md에서 🏛️ External로 변경. 재개 조건(운영 1릴리스 + 14일 WARN 0건)과 제거 대상(`ReviewerController.getReviewersLegacy` + `/{docMngNo}/reviewers` 라우트 + `ReviewerControllerTest.getReviewers_구경로호환_200`)을 조건란에 명시해 조건 도래 시 바로 실행 가능하게 한다.

## 검증 게이트

- Wave 종료마다: `./gradlew test` 전체 통과 + 변경 도메인 `integrationTest`(로컬 Oracle) 통과.
- 프로그램 종료: `./gradlew test --rerun-tasks` 전체 + `jacocoTestCoverageVerification` 통과, `TASK.md`/`TASK_DONE.md` 갱신 커밋.
- 완료 기준: 백엔드 섹션에는 🏛️ External 2건(BE-03·BE-18)과 BE-17 결정 결과에 따른 재등록분만 남는다.

## 리스크와 대응

| 리스크 | 대응 |
| ------ | ---- |
| BE-12 응답 계약 회귀(조립 순서·null 처리 차이) | 특성화 테스트로 전환 전 응답 고정, 필드 단위 동등성 비교 |
| BE-13 조인 통합 시 기존 선택 의미 변화 | 기존 순회 로직의 판정 조건을 IT fixture로 재현(동률 포함) 후 결과 동등성 확인 |
| ERR-08 예외 전파로 기존 화면 폴백 의존 깨짐 | 미존재 폴백은 유지, 예외 전파는 호출부(협의회 평가 API) 응답 계약 확인 후 적용 |
| BE-16 요청 내 중복 키 의미 변화 | 현행 동작(후행 행 우선 여부)을 테스트로 고정 후 배치화 |
| Flyway 체크섬 | 기존 스크립트 수정 금지, 신규 버전 파일로만 추가 |
