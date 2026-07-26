# Phase B — 백엔드 오류 표면화 (ERR-09, ERR-08 후속) Implementation Plan

> **검토 반영일:** 2026-07-25
>
> **상태:** Engineering Review 반영 완료, 구현 가능
> **범위 정정:** BE-13은 이미 완료되었고 신규 인덱스가 불필요하다고 확정되었다. 이 계획에서는 회귀 검증만 하며 Flyway를 만들지 않는다.

**Goal:** 네이티브 DATE 변환 실패를 실제 NULL과 구분해 안전하게 관측하고(ERR-09), 계획 스냅샷의 문법·구조 손상을 정상 빈 결과와 구분하여 부분 데이터와 `snapshotIncomplete`로 제공한다(ERR-08 우아한 저하 후속).

**Architecture:**

- ERR-09는 `NativeRowMapper.toLd`의 불량 값만 정화·길이 제한한 warn으로 기록한다. null/blank는 정상 null이며 무경고다. 반복 불량 행은 분당 한 번만 warn하고 다음 warn에 억제 건수를 포함한다.
- ERR-08은 스냅샷을 한 번만 파싱한다. Jackson 문법 오류뿐 아니라 루트·배열·노드 형태와 필수 식별자를 검증한다. 복구 가능한 노드는 계속 반환하고 손상 신호를 OR 누적한다.
- 백엔드는 `snapshotIncomplete`; 프론트는 경고 배너로 같은 계약을 소비한다. DB·권한·조회 예외는 우아한 저하 대상으로 바꾸지 않고 그대로 전파한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Jackson, Spring Data JPA, Oracle, JUnit 5, Logback ListAppender, Nuxt 4, Vue 3, Vitest, Playwright

---

## 현재 상태와 확정 사실

1. `CouncilRepository.findBaselineReqDocNos`는 이미 결정적 조인 단건 조회와 tie-break를 사용한다.
2. `CouncilBaselineLookupIt`와 기존 실행계획에서 현재 인덱스로 충분함이 확인되었다.
3. `TASK_DONE.md`에 BE-13과 기존 ERR-08 조치가 이미 완료로 기록되어 있다. `TASK.md`에는 ERR-09만 남아 있다.
4. 이번 ERR-08은 과거 완료를 되돌리는 작업이 아니라 “손상 시 전체 500”을 “부분 데이터 + 불완전 표시”로 개선하는 후속 변경이다.

```text
redtConeInf
  ├─ null/blank
  │    -> 정상 빈 ParsedSnapshot(incomplete=false)
  └─ JSON
       -> readTree
          ├─ 문법 오류
          │    -> 빈 부분 결과 + incomplete=true + warn
          └─ 문법 정상
               -> 루트/배열/노드/식별자 검증
                  ├─ 정상 노드 -> 사업·비용·이름에 반영
                  └─ 손상 노드 -> 해당 노드 제외 + incomplete=true + warn

PlanTargetsResponse / PlanResultSummaryResponse
  -> snapshotIncomplete
     -> PlanCouncilTargets 경고 배너
```

---

## What already exists

- `findBaselineReqDocNos`와 `CouncilBaselineLookupIt`가 BE-13의 N+1·동률 문제를 이미 해결한다. 수정하지 않고 회귀만 확인한다.
- `PlanEvaluationService`의 `SNAPSHOT_MAPPER`, `textOf`, `decimalOf`를 재사용한다.
- `PlanTargetsResponse`, `PlanResultSummaryResponse`, `PlanCouncilTargets.vue`가 계약 확장 지점이다.
- `NativeRowMapperTest`에 형제 변환 메서드 예외 테스트가 존재한다. `toLd`의 null/불량 구분 테스트를 같은 스타일로 확장한다.
- `DataCorruptionException`은 다른 서비스가 계속 사용하므로 클래스·전역 핸들러는 삭제하지 않는다.

## NOT in scope

- BE-13 쿼리 재작성 또는 신규 Flyway 인덱스: 설계 §7과 기존 실행계획이 불필요로 확정했다.
- 모든 JSON 스냅샷을 강타입 DTO로 전환: 이번 변경보다 범위가 큰 데이터 모델 마이그레이션이다.
- `PlanResultSummaryResponse.snapshotIncomplete`를 사용하는 신규 화면: API 계약은 유지하되 현재 보이는 배너는 PlanTargets 화면에만 추가한다.
- 전역 로깅 프레임워크 도입: `NativeRowMapper`의 작은 제한 로거로 닫는다.
- 광범위한 ERR-10 상태 UI: Phase C에서 수행한다.

---

## File Structure

```text
it_backend/
  src/main/java/com/kdb/it/
    common/util/NativeRowMapper.java
    domain/council/dto/CouncilDto.java
    domain/council/service/PlanEvaluationService.java
  src/test/java/com/kdb/it/
    common/util/NativeRowMapperTest.java
    domain/council/service/PlanEvaluationServiceTest.java
    domain/council/repository/CouncilBaselineLookupIt.java  # 회귀만

it_frontend/
  app/types/council.ts
  app/components/council/plan/PlanCouncilTargets.vue
  tests/unit/components/PlanCouncilTargets.test.ts
  tests/e2e/council-snapshot-incomplete.spec.ts
```

---

## Task 1 — ERR-09: 안전하고 제한된 DATE 변환 경고

**Files**

- Modify: `it_backend/src/main/java/com/kdb/it/common/util/NativeRowMapper.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/util/NativeRowMapperTest.java`

**RED**

- null과 blank 문자열은 null을 반환하고 warn이 없다.
- 지원되는 `LocalDate`, `LocalDateTime`, `Timestamp`, `Date`, 정상 문자열은 기존 변환 결과를 유지한다.
- 불량 문자열과 미지원 타입은 null을 반환하고 warn을 한 번 기록한다.
- warn에는 실제 클래스명과 정화된 값만 들어간다.
- 값은 최대 128자로 자르고 `\r`, `\n`, `\t`를 공백으로 바꾼다.
- 같은 분 안의 반복 실패는 warn을 추가하지 않고 억제 수를 누적한다.
- 다음 허용 warn에는 직전 구간 억제 건수가 포함된다.
- 테스트 종료 시 `ListAppender.stop()`과 logger detach를 수행해 다른 테스트로 로그가 새지 않는다.

**GREEN**

1. `toLd`의 기존 정상 변환 분기를 바꾸지 않는다.
2. `sanitizeForLog(Object value)`를 private static으로 추가한다.
3. 전역 한 구간에 대해 최대 분당 한 번만 기록하는 작은 limiter를 `NativeRowMapper` 내부 package-private helper로 둔다.
   - `System.nanoTime()` 기반
   - `AtomicLong nextWarnNanos`, `AtomicLong suppressedCount`
   - 테스트 전용 package-private reset 메서드 제공
   - 값이나 타입을 키로 하는 무제한 Map은 만들지 않는다.
4. 예상된 변환 실패에는 stack trace를 남기지 않는다.
5. 실제 SQL·사용자·문서 내용 등 추가 문맥을 임의로 로그에 붙이지 않는다.

**검증**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.common.util.NativeRowMapperTest"
.\gradlew test -PincludeTags=it --tests "*CouncilProjectRowMappingIt" --tests "*ServiceRequestDocDashboardMappingIt"
```

**커밋**

```powershell
git add src/main/java/com/kdb/it/common/util/NativeRowMapper.java `
        src/test/java/com/kdb/it/common/util/NativeRowMapperTest.java
git commit -m "fix: 네이티브 DATE 변환 실패를 안전한 제한 경고로 표면화 (ERR-09)"
```

---

## Task 2 — ERR-08: 단일 파서와 구조 손상 판정

**Files**

- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/council/service/PlanEvaluationServiceTest.java`

**구조 계약**

| 입력 | 결과 |
|---|---|
| null/blank | 정상 빈 결과, `snapshotIncomplete=false` |
| `{}` 또는 알려진 루트 키가 하나도 없는 nonblank object | 빈 부분 결과, `snapshotIncomplete=true` |
| 루트가 array/scalar | 빈 부분 결과, `snapshotIncomplete=true` |
| `projects`/`prjSnapshots`/`costDetails`가 존재하지만 array가 아님 | 해당 부분 제외, `snapshotIncomplete=true` |
| 배열 원소가 object가 아님 | 해당 원소 제외, `snapshotIncomplete=true` |
| 사업 원소에 `prjMngNo`가 없음 | 해당 원소 제외, `snapshotIncomplete=true` |
| 일부 정상·일부 손상 | 정상 원소 반환, `snapshotIncomplete=true` |
| 문법 오류 | 빈 부분 결과, `snapshotIncomplete=true` |
| DB·권한·`planService.getPlan` 오류 | 예외 전파 |

`abusNm` 누락은 사업 자체를 버리지 않고 관리번호 폴백을 사용하되 `snapshotIncomplete=true`로 표시한다. `ornYn` 누락은 기존 포함 동작을 유지한다.

**RED**

- 위 표의 모든 행을 parameterized test 또는 명시적 테스트로 작성한다.
- 동일 스냅샷이 한 요청에서 한 번만 `readTree` 되는지 spy/counter로 검증한다.
- 파싱 성공 일부 + 손상 일부가 실제 부분 데이터를 유지하는지 단언한다.
- 정상 빈 상태와 손상 빈 상태를 별도 테스트로 고정한다.
- baseline 조회 예외가 `snapshotIncomplete`로 바뀌지 않고 전파되는 회귀 테스트를 유지한다.

**GREEN**

1. 두 응답 record의 마지막 컴포넌트에 `boolean snapshotIncomplete`를 추가한다.
2. `ParsedSnapshot`은 다음을 보관한다.
   - 유효 사업 노드
   - 비용 건수
   - 사업명 맵
   - `boolean incomplete`
3. `parseSnapshot(String json, String reqDocNo)`는 문법 오류를 잡고 구조 검증 결과를 OR 누적한다.
4. 구조 손상은 예외 stack trace 없이 문서번호와 손상 종류만 warn한다.
5. 파싱 밖에서 발생한 DB·권한 예외를 catch하지 않는다.
6. `parseSnapshotBusinesses`, `countCostDetails`, `resolveBusinessNames`의 중복 파싱을 제거한다.
7. `findBaselinePlan`과 `findBaselineReqDocNos`는 변경하지 않는다.

복잡한 구조 판정 ASCII 주석은 `parseSnapshot` 위에 축약해서 넣고, 입력 계약을 바꾸면 주석과 테스트를 함께 갱신한다.

**검증 및 커밋**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.domain.council.service.PlanEvaluationServiceTest"
git add src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java `
        src/main/java/com/kdb/it/domain/council/service/PlanEvaluationService.java `
        src/test/java/com/kdb/it/domain/council/service/PlanEvaluationServiceTest.java
git commit -m "fix: 스냅샷 문법·구조 손상을 불완전 부분 결과로 표면화 (ERR-08)"
```

---

## Task 3 — BE-13 회귀 검증만 수행한다

**금지 사항**

- 신규 Flyway 파일 생성 금지
- `it_backend` 중첩 저장소에서 `../it_database`를 stage하려는 명령 금지
- 검증 결과가 기존 확정과 다르지 않은데 쿼리·인덱스를 변경하는 작업 금지

**검증**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "com.kdb.it.domain.council.service.PlanEvaluationServiceTest"
.\gradlew test -PincludeTags=it --tests "*CouncilBaselineLookupIt"
```

Oracle에서 기존 EXPLAIN을 재확인할 수는 있지만 산출물은 검증 메모뿐이다. 대규모 데이터나 통계 변화로 실제 회귀가 측정되면 이번 계획을 확장하지 말고 별도 성능 과제로 등록한다.

---

## Task 4 — 프론트 배너와 계약 테스트

**Files**

- Modify: `it_frontend/app/types/council.ts`
- Modify: `it_frontend/app/components/council/plan/PlanCouncilTargets.vue`
- Create: `it_frontend/tests/unit/components/PlanCouncilTargets.test.ts`
- Create: `it_frontend/tests/e2e/council-snapshot-incomplete.spec.ts`

**RED**

- `snapshotIncomplete=false`이거나 응답이 없으면 배너가 없다.
- `snapshotIncomplete=true`이면 “일부 스냅샷을 해석하지 못했습니다. 표시된 내용을 확인해 주세요.” 배너가 보인다.
- 부분 데이터 행은 배너와 함께 계속 렌더링된다.
- 정상 빈 결과는 기존 empty state를 보이고 손상 배너가 없다.
- Playwright는 API를 정상 빈/부분 손상 두 응답으로 route mock하여 사용자에게 두 상태가 구분되는지 확인한다.

**GREEN**

- `PlanTargets`와 `PlanResultSummary` 타입에 `snapshotIncomplete: boolean`을 추가한다.
- 컴포넌트에 non-closable warn `Message`를 추가한다.
- toast만 사용하지 않고 화면에 지속되는 인라인 상태를 제공한다.

**검증 및 커밋**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/components/PlanCouncilTargets.test.ts
npx playwright test tests/e2e/council-snapshot-incomplete.spec.ts
npm run typecheck
git add app/types/council.ts `
        app/components/council/plan/PlanCouncilTargets.vue `
        tests/unit/components/PlanCouncilTargets.test.ts `
        tests/e2e/council-snapshot-incomplete.spec.ts
git commit -m "feat: 스냅샷 불완전 상태를 부분 데이터와 함께 표시 (ERR-08)"
```

---

## Task 5 — 최종 게이트와 완료 기록

```powershell
cd C:\it\it_backend
.\gradlew test
.\gradlew spotlessCheck

cd C:\it\it_frontend
npm run typecheck
npm run lint
npm test -- --run
npx playwright test tests/e2e/council-snapshot-incomplete.spec.ts
```

**문서 이관**

- `TASK.md`에서는 실제 남아 있는 ERR-09만 제거한다.
- `TASK_DONE.md`의 기존 BE-13·ERR-08 행을 삭제하거나 중복 추가하지 않는다.
- ERR-08 우아한 저하 후속 완료 행을 별도로 추가하여 과거 500 계약에서 부분 데이터 계약으로 바뀐 이유와 테스트를 기록한다.
- BE-13은 “기존 완료 계약 회귀 확인, 신규 DDL 없음”으로 실행 메모에만 남긴다.

**완료 조건**

- [ ] null/blank와 불량 DATE가 로그 계약에서 구분된다.
- [ ] 로그 값은 정화·길이 제한되고 반복 실패가 제한된다.
- [ ] 문법 오류와 구조 오류가 모두 `snapshotIncomplete=true`다.
- [ ] 부분 데이터가 손상 플래그와 함께 반환된다.
- [ ] 정상 빈 화면과 손상 화면이 컴포넌트·Playwright에서 구분된다.
- [ ] DB·권한 예외는 전파된다.
- [ ] 신규 Flyway가 없다.

---

## 실패 모드와 관측 계약

| 코드 경로 | 운영 실패 | 테스트 | 처리 | 사용자 결과 |
|---|---|---|---|---|
| `NativeRowMapper.toLd` | 불량 값 수천 건으로 로그 폭주 | limiter unit | 분당 1회 + 억제 수 | 화면 계약 유지, 운영 진단 |
| `NativeRowMapper.toLd` | 값에 개행·긴 문자열 포함 | sanitize unit | 개행 제거·128자 제한 | 로그 오염 방지 |
| `parseSnapshot` | JSON 문법 오류 | service unit | 부분 빈 결과+flag | 경고 배너 |
| `parseSnapshot` | 문법 정상·스키마 손상 | service unit | 정상 노드 salvage+flag | 부분 데이터+경고 |
| baseline 조회 | DB/권한 오류 | regression unit/IT | 예외 전파 | 명확한 요청 실패 |
| 배너 | 플래그가 타입에만 있고 UI 미소비 | component+E2E | 인라인 Message | 정상 빈 상태와 구분 |

## 실행 순서와 병렬화

| Step | Modules touched | Depends on |
|---|---|---|
| B1 ERR-09 | backend common/util | — |
| B2 ERR-08 parser | backend council/service,dto | — |
| B3 BE-13 regression | backend council/repository tests | B2 |
| B4 banner | frontend council component/types | B2 |
| B5 docs | root docs | B1, B3, B4 |

- **Lane B1:** ERR-09 독립 실행
- **Lane B2:** ERR-08 parser → BE-13 regression → frontend banner
- B1과 B2는 병렬 가능하다.
- `TASK.md`/`TASK_DONE.md`는 모든 lane 완료 후 한 작업자가 갱신한다.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | STALE | 이전 리뷰 이후 39 commits, 현재 계획에는 미적용 |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 구조 손상 판정·안전한 제한 로그·BE-13 SoT 충돌 보완 |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **UNRESOLVED:** 0
- **VERDICT:** ENG CLEARED — 구현 가능
