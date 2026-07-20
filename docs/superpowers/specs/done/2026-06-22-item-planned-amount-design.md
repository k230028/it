# 품목 예정금액(MPL_AMT) 기반 예산 계산 전환 — 설계 문서

- 작성일: 2026-06-22
- 대상 도메인: `domain/budget/project` (정보화사업), 프론트 `info/projects`
- 관련 PRD: `prds/ing/PRD_20260622.md`

## 1. 목적 / 배경

정보화사업의 "예정금액(익년 이후 예산)"을 **프로젝트 단위 직접 입력**에서 **품목 단위 입력**으로 전환한다.

- 품목 테이블(`TPRMPP_BITEMM`/`TPRMPP_BITEML`)에 품목별 예정금액 컬럼 `MPL_AMT`를 추가한다.
- 프로젝트 테이블(`TPRMPP_BPROJM`/`TPRMPP_BPROJL`)에 저장하던 합계성 금액 3종(`TOT_RQM_AMT`, `MPL_CPIT_AMT`, `MPL_MNGC_AMT`)을 **삭제**한다.
- 위 3종을 직접 참조하던 모든 로직을 **매번 품목 `MPL_AMT`를 기준으로 계산**하도록 전환한다.

### 현행 구조 (변경 전)

- `prjBg`(총 예산, 화면값) = 품목 `AMT` 합계
- `MPL_CPIT_AMT`(예정자본금액), `MPL_MNGC_AMT`(예정관리비금액) = 사용자가 **프로젝트 단위로 직접 입력**(비목 한도 내), `Bprojm`에 저장
- `TOT_RQM_AMT`(컬럼명은 "총소요금액"이나 실제 저장값은 **당해예산**) = `총 예산 − (예정자본 + 예정관리비)`. 프론트 전송값을 백엔드(`ProjectService.recalcCurrentYearBudget`)가 동일 산식으로 재계산하여 저장.

### 목표 구조 (변경 후)

- 품목별 `MPL_AMT`(예정금액 = "익년 이후 예산") 입력, 기본값 0
- `Bprojm`의 3개 컬럼 삭제
- 3개 값은 **품목 `MPL_AMT` 합산으로 파생(derive)** 하여 API 응답에서 계속 제공

## 2. 확정된 설계 결정 (사용자 승인)

1. **MPL_AMT와 AMT의 관계**: `MPL_AMT`는 `AMT`의 일부(익년 이후분). 즉 `AMT`=품목 총액(당해+익년 이후), `MPL_AMT`=그중 익년 이후분. `당해예산 = ∑AMT − ∑MPL_AMT`. 검증: `0 ≤ MPL_AMT ≤ AMT`.
2. **자본/관리비 분리**: 품목 비목(`IOE_C`) 기준 자동 분류. 기존 `ProjectBudgetSummaryService`의 분류 집합을 재사용한다.
3. **기존 데이터 백필**: 신규 `MPL_AMT`는 `DEFAULT 0`으로 초기화. 기존 프로젝트의 예정자본/관리비 정보는 소실되며 필요 시 사용자가 재입력. 삭제되는 3개 컬럼 값은 폐기.
4. **API 응답 호환**: DB 컬럼은 삭제하되 `Response` DTO는 `totRqmAmt`/`mplCpitAmt`/`mplMngcAmt`를 **품목 합산 파생값으로 유지**. 프론트 변경 최소화.

## 3. 단일 파생 계산 규칙 (Single Source of Truth)

활성 품목(`DEL_YN='N'`) 목록을 입력으로, 다음 파생값을 계산한다. 비목 분류는 기존 `ProjectBudgetSummaryService`의 IOE 분류를 재사용한다.

- 자본 비목 집합: cTp ∈ {`IOE_DVC`, `IOE_HW`, `IOE_SW`} + 구데이터 `IOE_CPIT`
- 관리비 비목 집합: cTp ∈ {`IOE_IDR`, `IOE_SEVS`, `IOE_XPN`, `IOE_LEAFE`}

파생식:

```
mplCpitAmt(파생) = ∑ MPL_AMT  (item.ioeC ∈ 자본 비목)
mplMngcAmt(파생) = ∑ MPL_AMT  (item.ioeC ∈ 관리비 비목)
totRqmAmt (파생, 당해예산) = max(0, ∑ AMT − ∑ MPL_AMT)
```

**환율 처리 규칙**: `MPL_AMT`는 각 계산 지점에서 `AMT`와 **동일한 환산 규칙**을 따른다.
> 주의(기존 불일치): `ProjectService.recalcCurrentYearBudget`는 합산 시 `× xcr`를 적용하지 않고, `ProjectBudgetSummaryService.applyBudgetSummary`는 `item.getAmt() × xcr`를 적용한다. 본 작업은 이 불일치를 **확대하지 않기 위해** 각 지점의 기존 AMT 처리 방식을 그대로 미러링한다. 환산 규칙 통일은 별도 정리 과제(`TASK.md`)로 분리한다.

## 4. 데이터 모델 변경

| 대상 | 변경 |
|---|---|
| `Bitemm` (`TPRMPP_BITEMM`) | `mplAmt` 추가: `@Column(name="MPL_AMT", precision=18, scale=3, comment="예정금액")` `BigDecimal`, `amt` 필드 바로 뒤에 선언 |
| `BitemmL` (`TPRMPP_BITEML`) | 미러 필드 `mplAmt` 추가 (로그 스냅샷 일치) |
| `Bprojm` (`TPRMPP_BPROJM`) | `totRqmAmt`, `mplCpitAmt`, `mplMngcAmt` 필드 제거. `UpdateCommand` record 및 `update()` 2개 오버로드 시그니처에서 해당 파라미터 제거 |
| `BprojmL` (`TPRMPP_BPROJL`) | 세 필드 제거 |

### Flyway 마이그레이션 (`it_database/migrations/`)

`spring.jpa.hibernate.ddl-auto=update`는 컬럼 DROP을 지원하지 않으므로 마이그레이션 스크립트가 필수다.

- `V20260622_001__AddMplAmtToBitemm.sql`
  - `ALTER TABLE TPRMPP_BITEMM ADD (MPL_AMT NUMBER(18,3) DEFAULT 0 NOT NULL);`
  - `ALTER TABLE TPRMPP_BITEML ADD (MPL_AMT NUMBER(18,3) DEFAULT 0 NOT NULL);`
  - 기존 행은 `DEFAULT 0`으로 자동 백필됨 → 별도 백필 DML 불필요
- `V20260622_002__DropBprojmPlannedAmtColumns.sql`
  - `ALTER TABLE TPRMPP_BPROJM DROP (TOT_RQM_AMT, MPL_CPIT_AMT, MPL_MNGC_AMT);`
  - `ALTER TABLE TPRMPP_BPROJL DROP (TOT_RQM_AMT, MPL_CPIT_AMT, MPL_MNGC_AMT);`

> ⚠️ Oracle은 `ADD` 시 컬럼 **물리 위치**를 강제할 수 없어 MPL_AMT가 일단 맨 끝에 추가된다.
> 물리 순서("AMT 다음")는 후속 마이그레이션 `V20260623_001__ReorderMplAmtAfterAmt.sql`이
> INVISIBLE→VISIBLE 토글 기법으로 재배치한다(메타데이터 전용, 데이터·제약 보존).
> 적용 프로파일: `local-ext`/`local-int`만 자동 적용. `dev`/`prod`는 DBA 검토 후 수동 적용.

## 5. 백엔드 변경

### 5.1 쓰기 경로 (`ProjectService`, `ProjectDto`)

- `ProjectDto.BitemmDto`: `mplAmt` 필드 추가(`@Schema` 포함).
- `ProjectDto.CreateRequest` / `UpdateRequest`: `totRqmAmt`/`mplCpitAmt`/`mplMngcAmt` 필드 및 `toEntity()` 매핑 제거.
- `ProjectService.createProject` / `updateProject`:
  - `recalcCurrentYearBudget(...)` 호출 및 `request.setTotRqmAmt(...)` 제거.
  - `Bprojm.update(...)` / `toEntity()` 호출에서 3개 인자 제거.
  - 품목(`Bitemm`) 생성/수정/신규 빌더에 `.mplAmt(...)` 반영: 기본 0, `0 ≤ mplAmt ≤ amt` 클램프.
  - `isItemChanged(existing, dto)`에 `mplAmt` 비교(`bigDecimalChanged`) 추가 → 변경 시 D/C 버저닝.
  - 기존 `recalcCurrentYearBudget(...)` private 메서드 제거.

### 5.2 읽기/집계 경로

- `ProjectBudgetSummaryService.applyBudgetSummary(...)`: 기존 비목 분류를 재사용해 `mplCpitAmt`/`mplMngcAmt`/`totRqmAmt`(당해예산) 파생값을 계산하여 `Response`에 설정하도록 확장. (3장 산식 구현의 단일 거점)
- `ProjectService.getProject(...)`: 이미 품목을 로드하므로 확장된 summary가 파생값을 주입.
- `ProjectService.enrichProjectListBatch(...)`: 목록은 현재 품목을 로드하지 않음. 대상 프로젝트들의 **활성 품목을 1회 배치 조회**(`abusMngNo`+`fntTbCrySno`, `DEL_YN='N'`)한 뒤 프로젝트별로 그룹핑하여 동일 파생 계산으로 주입한다. (쿼리 +1, 허용 범위)
  - 필요 시 `ProjectItemRepository`에 다건 배치 조회 메서드 추가.
- `ProjectDto.Response`: `totRqmAmt`/`mplCpitAmt`/`mplMngcAmt` getter/setter는 **유지**하되 값의 출처는 엔티티가 아닌 파생 계산. `fromEntity()`에서 엔티티 컬럼 매핑 제거. `BitemmDto`에는 `mplAmt` 포함.
- `BudgetStatusQueryRepositoryImpl`: 세 컬럼 미참조 확인됨 → **변경 없음**.
- `BudgetWorkService`(약 622행): 현재 `totRqmAmt`는 주석 언급만 확인. 구현 시 기능 참조 여부 재확인 후 없으면 무변경.

## 6. 프론트엔드 변경

### 6.1 입력 화면 (`app/pages/info/projects/form.vue`)

- [소요예상 상세목록](`resourceItems`) 테이블에 품목별 **"{bgYy+1}년 이후 예산"(MPL_AMT)** 입력 컬럼 추가. 기본 0, 해당 품목금액 이내로 제한.
- 프로젝트 레벨 `mplCpitAmt`/`mplMngcAmt` **입력 필드 제거**(현 1880~1909행 영역).
- 예산 구성 표시(총예산/당해예산/이후 예정자본/이후 예정관리비)를 `resourceItems` 기반 `computed`로 전환:
  - 총예산 = ∑ `item.amt`
  - 이후 예정자본 = ∑ `item.mplAmt` (자본 비목)
  - 이후 예정관리비 = ∑ `item.mplAmt` (관리비 비목)
  - 당해예산 = max(0, 총예산 − ∑ `item.mplAmt`)
  - 비목 분류는 기존 `capitalBudgetAmt`/`operatingExpenseAmt` 계산 로직을 재사용.
- 저장 payload: 품목별 `mplAmt` 포함, 프로젝트 3개 필드 제거(서버 파생).
- 계속사업 복사(현 1156행 부근): 프로젝트 레벨 예정금액 복사 대신 **품목별 `mplAmt` 복사**.

### 6.2 타입 및 읽기 전용 표시처

- `app/composables/useProjects.ts`: `Project` 인터페이스의 `totRqmAmt`/`mplCpitAmt`/`mplMngcAmt`는 **유지**(서버 파생 제공). 품목/`ResourceItem` 타입에 `mplAmt` 추가.
- 읽기 전용 표시처는 서버가 파생값을 계속 제공하므로 **변경 최소/없음**, 필드 수신만 확인:
  - `app/pages/info/projects/[id].vue`
  - `app/pages/budget/list.vue`, `app/pages/budget/approval.vue`
  - `app/components/budget/BudgetSummaryCards.vue`
  - `app/composables/usePdfReport.ts`, `app/composables/useGlobalSearch.ts`
  - `app/pages/info/plan/form.vue`

## 7. 테스트

### 백엔드
- `ProjectServiceTest`: 빌더에서 3개 필드 제거, `mplAmt` 케이스 추가, 파생값(당해예산/예정자본/예정관리비) 검증, 클램프(`0 ≤ mplAmt ≤ amt`) 검증.
- `ProjectBudgetSummaryService` 단위 테스트: 비목별 `MPL_AMT` 분리 합산 및 당해예산 산식 검증.
- `council`/`plan` 테스트: `Bprojm` 빌더의 `.totRqmAmt(...)` 등 제거(`CouncilServiceTest`, `PlanServiceTest`).
- 변경 후 `./gradlew test`(공통 영향이므로 가급적 `./gradlew clean test`).

### 프론트엔드
- form computed/저장 로직, `tests/unit/composables/useGlobalSearch.test.ts`.
- e2e `tests/e2e/projects.spec.ts`, `tests/e2e/budget.spec.ts` 픽스처 갱신.
- `npm run check` 0 오류/0 경고, 영향 테스트 통과.

## 8. 문서 갱신

- `it_backend/docs/guides/data-model.md` — `Bitemm`/`Bprojm` 컬럼 매핑.
- `it_backend/docs/guides/colname-collision-map.md` — `TOT_RQM_AMT` 등 항목 정리.
- `it_backend/src/main/resources/sql/plan_ddl.sql` — DDL 동기화.
- 양 `CLAUDE.md`의 관련 참조(있을 경우).

## 9. 리스크 / 메모

- **기존 AMT 환산 불일치**: 4장/3장에 기술. MPL_AMT는 지점별 AMT 처리 미러링으로 대응, 통일은 별도 과제.
- **목록 배치 쿼리 +1**: 품목 합산을 위한 추가 조회. 허용 범위.
- **컬럼 물리 위치**: `ADD`는 맨 끝에 추가되나, `V20260623_001`이 INVISIBLE→VISIBLE 토글로 "AMT 다음"에 재배치(BITEMM/BITEML 적용 완료).
- **기존 예정금액 데이터 소실**: 백필 0 결정에 따른 의도된 동작. 운영 적용 전 이해관계자 공지 권장.

## 10. 작업 순서 (개략)

1. 엔티티/로그 엔티티 변경 + Flyway 마이그레이션 작성
2. `ProjectBudgetSummaryService` 파생 계산 확장 (TDD)
3. `ProjectDto`/`ProjectService` 쓰기·읽기 경로 전환 (TDD)
4. 목록 배치 집계 추가
5. 프론트 form 품목 컬럼/예산 구성 computed 전환
6. 읽기 전용 화면 필드 수신 확인
7. 테스트(백/프론트) 및 문서 갱신
8. `./gradlew clean test`, `npm run check` 검증
