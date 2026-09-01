# 예산 재상신 코드리뷰 지적 재검증과 개선 계획

작성일: 2026-09-01
대상 기능: 정보화사업·전산업무비 재상신(재신청) 버전 관리
선행 문서: [`docs/superpowers/plans/2026-08-31-budget-reapplication-design.md`](2026-08-31-budget-reapplication-design.md), [`it_database/docs/operations/2026-08-31-plan-reapplication-versioning.md`](../../../it_database/docs/operations/2026-08-31-plan-reapplication-versioning.md)

---

## 1. 재검증 요약

리뷰가 제시한 10건을 저장소 코드·마이그레이션·git 이력에서 한 건씩 직접 확인했다. **10건 모두 재현 경로가 코드에 존재한다.** 리뷰 본문과 다르거나 범위를 넓혀야 하는 지점은 4곳이며 §2에 정리했다.

| # | 결함 | 위치 | 판정 | 우선순위 |
| --- | --- | --- | :---: | :---: |
| D1 | 상신된 재상신 초안이 결재 목록 양쪽 스코프에서 사라짐 | [ProjectRepositoryImpl.java:156](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepositoryImpl.java:156), [CostRepositoryImpl.java:188](../../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepositoryImpl.java:188) | 확인 | P0 |
| D2 | 결재중 초안 삭제 허용 → 최종 승인 시 500·전체 롤백 | [CostService.java:570](../../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:570) | 확인 | P0 |
| D3 | `PUT ?sno=` 로 결재완료본·결재중 초안 제자리 수정 가능 | [CostService.java:369](../../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:369) | 확인 | P0 |
| D4 | 문서 삭제 시 재상신 초안 잔존 → 삭제 문서 부활 | [CostService.java:543](../../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:543) (+ 프로젝트 측 동일) | 확인 | P0 |
| D5 | 적용된 `V20260831_002` 제자리 수정, 인덱스 생성 블록 소실 | [V20260831_002__AddPlanReapplicationVersioning.sql](../../../it_database/migrations/V20260831_002__AddPlanReapplicationVersioning.sql) | 확인 | P0 |
| D6 | 중복 재상신 초안 생성 가드 부재 + 승인본 조용한 강등 | [ProjectVersionService.java:68](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectVersionService.java:68), [CostVersionService.java:35](../../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostVersionService.java:35) | 확인 | P1 |
| D7 | 프로젝트 목록의 초안 행이 구버전 결재완료 상태 표시 | [ProjectBatchAssembler.java:87](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBatchAssembler.java:87) | 확인 | P1 |
| D8 | `fntTbCrySno` `'1'` 하드코딩 → 승인 시 구버전 재승격 | [report.vue:463](../../../it_frontend/app/pages/info/projects/report.vue:463) | 확인(잠복) | P1 |
| D9 | PDF 보고서가 재상신 초안 대신 구 승인본 수치 출력 | [useBudgetApprovalPage.ts:538](../../../it_frontend/app/composables/useBudgetApprovalPage.ts:538) | 확인 | P1 |
| D10 | 이관 조정계획에 라벨 `'조정'` 저장 시도 → ORA-12899 | [MigrationImportService.java:703](../../../it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationImportService.java:703) | 확인 | P1 |

### 근거 요약

- **D1**: 두 리포지토리 모두 `if (!"none".equals(apfSts)) { builder.and(lstYn.eq("Y")); }`. `apfSts` 코드는 단일 문자(`ApprovalStatus`: `1`=결재중, `2`=결재완료, `3`=반려, `4`=회수)이고 EXISTS 서브쿼리는 `(PK_COL_NM, FNT_TB_CRY_SNO)`로 버전을 정확히 지목한다. 상신된 초안은 `LST_YN='N'`이므로 `apfSts=1` 스코프에서 걸러지고, 구 최종본은 자체 최신 결재가 결재완료라 매칭되지 않는다. 프런트는 `apfSts` 로 `'none'`과 `'1'`만 사용한다([useBudgetApprovalPage.ts:66](../../../it_frontend/app/composables/useBudgetApprovalPage.ts:66)).
- **D2**: `deleteCost(itMngcNo, bgSno)`는 `LST_YN='N'`과 `OwnershipVerifier`만 확인한다. 승인 이벤트는 `ApplicationService`가 승인 트랜잭션 안에서 발행하고([ApplicationService.java:339](../../../it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java:339)) `CostVersionApprovalListener`는 `@EventListener`(동기)라 `promoteApprovedVersion` → `findVersionForUpdate(DEL_YN='N')` 빈 결과 → `IllegalArgumentException`이 승인 트랜잭션 전체를 롤백시킨다.
- **D3**: `updateCost(itMngcNo, bgSno, ...)`에 `LST_YN`·결재상태 검사가 없다. 프로젝트 측 `ProjectService.updateProject`/`deleteProject`는 `isBlockedByApproval`을 호출한다([ProjectService.java:327](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:327), [:410](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:410), [:647](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:647)).
- **D4**: `CostRepository.findByCostBgNoAndDelYn`는 기본 메서드로 `LST_YN='Y'`를 강제한다([CostRepository.java:102](../../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java:102)). 따라서 문서 전체 삭제가 최종본만 지우고 초안(`DEL_YN='N'`,`LST_YN='N'`)을 남긴다. 남은 초안은 `apfSts=none` 스코프(LST_YN 미필터)에 그대로 노출된다.
- **D5**: `git log`상 `0fe7a46`(최초) → `323d8c5`(제자리 수정). `323d8c5` diff에서 `IX_TPRMPP_CAPPLA_02` 생성·정의검증 블록 33줄이 삭제됐고, 저장소 전체에서 이 인덱스를 만드는 마이그레이션은 남아 있지 않다. 같은 커밋의 `V20260831_005`가 002의 계획 테이블 변경을 전부 철회하므로 **002가 스키마에 남기는 것은 이 인덱스 하나뿐**이고, 그것이 소실된 상태다(§3.5.1). 검증 SQL은 여전히 이 인덱스를 기대한다([2026-08-31-plan-reapplication-versioning.sql:26](../../../it_database/docs/verification/2026-08-31-plan-reapplication-versioning.sql:26)).
- **D6**: `createReapplication`은 잠근 원본(`LST_YN='Y'`)의 최신 결재상태만 검사한다. 기존 미결 초안 존재 검사가 없고 `getNextVersionSno`는 `NVL(MAX(SNO),0)+1`이라 v2·v3가 공존할 수 있다. `promoteApprovedVersion`은 순번 역행을 막지 않아 나중 승인이 먼저 승인된 버전을 조용히 강등한다.
- **D7**: `assembleList`는 `loadBatchData(..., keyBySequence=false)`로 관리번호 단위 키를 쓰고, `assembleBulk`는 `true`(=`mngNo|sno`)를 쓴다. 코스트 측 `CostQueryAssembler`는 버전 단위 키를 쓴다([CostQueryAssembler.java:146](../../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostQueryAssembler.java:146)).
- **D8**: `info/projects/report.vue`만 `fntTbCrySno: '1'` 고정, `budget/report.vue`는 `String(p.sno ?? 1)`([budget/report.vue:412](../../../it_frontend/app/pages/budget/report.vue:412)). `sessionStorage('selectedProjectIds')`를 쓰는 프로덕션 코드는 없고 테스트만 설정한다 → 잠복.
- **D9**: `downloadPdf`가 `_id`만 넘기고, 상신 경로는 `{ id, sno }`를 유지한다([useBudgetApprovalPage.ts:325](../../../it_frontend/app/composables/useBudgetApprovalPage.ts:325)). bulk 조회는 `findByAbusMngNoInAndDelYnAndLstYn(..., "Y")`로 최종본만 반환한다.
- **D10**: `createPlanForMigration(bseYy, "조정", ...)`의 두 번째 인자가 `Bplanm.itPtlPlnTpC`와 스냅샷 JSON에 그대로 들어간다([PlanService.java:346](../../../it_backend/src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java:346)). 컬럼은 `VARCHAR2(2)`이고 `V20260831_003`으로 BYTE semantics로 되돌아왔으므로 `'조정'`(UTF-8 6바이트)은 ORA-12899. `MigrationYearSnapshot`의 `existingPlanTypes`는 `List.of("01","02")`로만 채워지므로([MigrationYearSnapshot.java:237](../../../it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationYearSnapshot.java:237)) `planExists("조정")`은 항상 false다.

---

## 2. 리뷰와 다르거나 범위를 넓혀야 하는 지점

| 항목 | 리뷰 서술 | 재검증 결과 |
| --- | --- | --- |
| D1 영향 범위 | `apfSts=1`(결재중)만 언급 | `apfSts=3`(반려)·`4`(회수) 스코프도 같은 이유로 `LST_YN='N'` 초안을 숨긴다. 반대로 `apfSts=2`(결재완료)는 `LST_YN='Y'` 필터를 **유지**해야 과거 승인 버전이 목록에 중복 노출되지 않는다. 즉 "필터 제거"가 아니라 "스코프별 적용"이 정답이다. |
| D4 영향 범위 | CostService만 지목 | `ProjectService.deleteProject(prjMngNo, null)`도 `findByAbusMngNoAndDelYn`(=`LST_YN='Y'`)로 최종본 1건만 지운다([ProjectRepository.java:86](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java:86)). 다만 프로젝트는 `isBlockedByApproval`이 비관리자에게 결재완료본 삭제를 막으므로 **관리자 경로에서만** 재현된다. 코스트는 가드가 없어 전원 재현. |
| D5 복구 방법 | "체크섬 불일치 → repair 필요" | 더 안전한 대안이 있다. `V20260831_002`를 `0fe7a46` 원본으로 되돌리면 이미 적용된 환경의 체크섬이 자동 복원되어 repair가 필요 없다. 소실된 인덱스는 신규 버전으로 옮긴다(§3.5에 환경별 분기 포함). |
| D5 파급 범위 | 인덱스 소실과 체크섬 불일치 | 같은 커밋의 `V20260831_005`가 002의 계획 테이블 변경을 전부 철회한다는 사실이 리뷰에 빠져 있다. 그 결과 (a) 002의 순 DDL은 `IX_TPRMPP_CAPPLA_02` 1건뿐이고, (b) 제자리 수정으로 들어간 ORA-01442 멱등 로직은 신규 버전으로 옮길 필요가 없으며, (c) 기존 검증 SQL은 기대값이 어긋난 정도가 아니라 **ORA-00904로 실행 자체가 실패한다**(§3.5.1, §3.5.4). |
| D9 수정 난도 | 조회 시 `_sno` 반영 | 현행 bulk 계약(`BulkGetRequest.prjMngNos`, `costBgNos`)에 순번 필드가 없다. 프런트만 고쳐서는 해결되지 않고 **백엔드 DTO·OpenAPI 변경 + `npm run codegen`** 이 선행되어야 한다. |

추가로 검증 중 확인한 부수 결함(리뷰 10건 상한 밖, 이번 계획에 포함):

- **D11**: [BudgetDetailAccessVerifier.java:29](../../../it_backend/src/main/java/com/kdb/it/domain/budget/common/security/BudgetDetailAccessVerifier.java:29) — `Set.of(...)`는 불변 집합이라 `contains(null)`이 `NullPointerException`을 던진다(`ImmutableCollections.SetN.contains`의 `Objects.requireNonNull`). 부점코드가 null인 계정은 403 대신 500을 받는다.
- **D12**(문서): [CostRepositoryImpl.java:196](../../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepositoryImpl.java:196) 주석이 결재상태 코드를 `001/002/003/004`로 적었으나 실제 코드는 `1/2/3/4`다.
- **D13**(문서): [ProjectRepository.java:99](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java:99) javadoc이 "LST_YN 조건 없는 별도 메서드"라고 적었으나 기본 메서드는 `LST_YN='Y'`를 강제한다. D9의 오해를 유발한 서술이다.

---

## 3. 결함별 개선안

### 3.1 D1 — 결재 목록 스코프별 버전 필터 (P0)

**변경 대상**
- `it_backend/.../budget/project/repository/ProjectRepositoryImpl.java` `buildConditionPredicate`
- `it_backend/.../budget/cost/repository/CostRepositoryImpl.java` `buildConditionPredicate`
- 신규 `it_backend/.../budget/common/repository/BudgetListVersionScope.java`(공용 판정 + 코드/라벨 정규화)

**설계**

```java
/** 목록 스코프별로 최종본만 노출할지 판정하고 결재상태 입력을 코드로 정규화한다. */
public final class BudgetListVersionScope {

    /** 라벨("결재중")로 들어오는 레거시 입력을 코드("1")로 정규화한다. null·공백은 그대로 반환. */
    public static String normalize(String apfSts) { ... }

    /**
     * 재상신 초안(LST_YN='N')까지 보여야 하는 스코프인지 판정한다.
     * 미상신(none)·결재중(1)·반려(3)·회수(4)는 초안을 포함하고,
     * 필터 미지정과 결재완료(2)는 최종본만 노출해 과거 승인본 중복을 막는다.
     */
    public static boolean includesDrafts(String apfSts) { ... }
}
```

두 `buildConditionPredicate`에서 기존 두 줄을 다음으로 교체한다.

```java
String apfSts = BudgetListVersionScope.normalize(condition.getApfSts());
if (!BudgetListVersionScope.includesDrafts(apfSts)) {
    builder.and(bprojm.lstYn.eq("Y"));   // cost 측은 bcostm.lstYn
}
```

`normalize`를 앞단에서 한 번 수행하므로 EXISTS 절 내부의 `hasLabel(...) ? ofLabel(...).code() : apfSts` 삼항도 함께 제거한다(중복 제거).

**부수 확인**: `countBySearchCondition`이 같은 헬퍼를 공유하므로 목록/건수 불일치는 생기지 않는다.

**테스트**
- `ProjectRepositoryImplTest`, `CostRepositoryImplTest`에 케이스 추가
  1. v1 결재완료 + v2 초안 상신(결재중) → `apfSts=1` 결과에 **v2만** 존재
  2. 같은 상태에서 `apfSts=none` → 결과 없음(초안이 결재중이므로)
  3. v1 결재완료 + v2 초안 반려 → `apfSts=3`과 `apfSts=none` 양쪽에 v2 노출
  4. v1 결재완료 + v2 승격 완료 → `apfSts=2` 결과가 v2 1건(과거 v1 미노출)
  5. `apfSts` 미지정 → 최종본만
- 라벨 입력(`apfSts=결재중`) 회귀 케이스 1건

### 3.2 D2·D3·D4 — 코스트 쓰기 경로 결재 가드 (P0)

**변경 대상**
- 신규 `it_backend/.../budget/common/security/ApprovalWriteGuard.java`
- `ProjectService`의 `isBlockedByApproval`/`approvalBlockMessage`를 위 가드로 이관(동작 동일)
- `CostService.updateCost(itMngcNo, bgSno, ...)`, `deleteCost(itMngcNo)`, `deleteCost(itMngcNo, bgSno)`

**설계**

```java
@Component
@RequiredArgsConstructor
public class ApprovalWriteGuard {
    private final CapplaRepository capplaRepository;

    /**
     * 결재 상태 때문에 쓰기가 막히는지 판정한다.
     * 결재중(1)은 전원 차단, 결재완료(2)는 시스템관리자에게만 허용한다.
     *
     * @param fntTbNm 원본 테이블명 ("BPROJM"/"BCOSTM")
     * @param pkColNm 관리번호
     * @param sno 개정 순번
     */
    public boolean isBlocked(String fntTbNm, String pkColNm, Integer sno) { ... }

    /** 막혀 있으면 {@link IllegalStateException}을 던진다. */
    public void verifyWritable(String fntTbNm, String pkColNm, Integer sno, String action) { ... }
}
```

적용:

| 경로 | 추가 가드 |
| --- | --- |
| `updateCost(itMngcNo, bgSno, req, false)` | 대상 조회 직후 `verifyWritable("BCOSTM", itMngcNo, target.getBgSno(), "수정")` |
| `updateCost(..., preserveSubmittedAmounts=true)` | **가드 미적용**(이관 일괄업로드 경로, 기존 동작 유지) |
| `deleteCost(itMngcNo, bgSno)` | 기존 `LST_YN='N'` 검사 유지 + `verifyWritable(..., "삭제")` |
| `deleteCost(itMngcNo)` | 모든 활성 개정본을 대상으로 각각 `verifyWritable` 후 전부 삭제 |

**D4 삭제 범위 수정**

```java
// AS-IS: findByCostBgNoAndDelYn → LST_YN='Y' 1건만
// TO-BE: 모든 활성 개정본
List<Bcostm> costs = costRepository.findByCostBgNoAndDelYnOrderByBgSnoAsc(itMngcNo, "N");
```

단말기 삭제도 `(termBgNo, termBgSno)` 키로 개정본별 전부를 지우도록 그룹 맵을 개정본 순번 기준으로 다시 만든다. 프로젝트 측 `deleteProject(prjMngNo, null)`도 `findByAbusMngNoAndDelYnOrderBySnoAsc`로 전환하고 개정본별 `Bitemm`을 함께 삭제한다.

> 대안으로 "초안이 있으면 문서 삭제 차단"도 가능하지만, 사용자가 초안을 먼저 지워야 문서를 지울 수 있어 UX 비용이 크다. 초안은 최종본에 종속된 파생물이므로 **cascade 삭제**를 채택한다.

**추가 안전망**: `CostVersionApprovalListener`/`ProjectVersionApprovalListener`가 승인 트랜잭션을 통째로 롤백시키는 구조 자체가 위험하다. 가드로 원인은 막되, 승격 대상 부재 시 예외 대신 **경고 로그 + 승인 트랜잭션 유지**로 바꿀지 여부는 별도 판단이 필요하다 → §6 열린 질문 Q1.

**테스트**
- `CostServiceTest`: (a) 결재중 초안 삭제 시도 → `IllegalStateException`, (b) 결재중 초안 수정 시도 → 차단, (c) 결재완료 최종본 수정 — 비관리자 차단·관리자 허용, (d) 문서 삭제 시 초안·초안 단말기까지 `DEL_YN='Y'`
- `CostVersionApprovalListenerTest`: 초안 삭제 후 승인 시 롤백이 나던 시나리오가 가드 도입으로 도달 불가임을 확인하는 회귀 테스트
- `ProjectServiceTest`: 관리자 문서 삭제 시 초안 동반 삭제

### 3.3 D6 — 중복 초안 차단과 승격 역행 방지 (P1)

**변경 대상**
- `ProjectVersionService.createReapplication`, `CostVersionService.createReapplication`
- `ProjectVersionService.promoteApprovedVersion`, `CostVersionService.promoteApprovedVersion`
- 신규 마이그레이션(부분 고유 인덱스)
- `it_frontend` 재상신 버튼 노출 조건

**설계**

1. 원본 최종본을 비관적 락으로 잠근 **뒤**, 같은 관리번호에 활성 미결 초안이 있는지 검사한다.
   ```java
   if (projectRepository.existsByAbusMngNoAndLstYnAndDelYn(abusMngNo, "N", "N")) {
       throw new IllegalStateException("이미 재신청 초안이 있습니다: " + abusMngNo);
   }
   ```
   락이 두 트랜잭션을 직렬화하므로 두 번째 트랜잭션은 이 검사에서 차단된다.

2. ~~DB 차원 이중 안전망 — 함수 기반 부분 고유 인덱스~~ **철회(2026-09-01)**.
   `LST_YN='N' AND DEL_YN='N'`은 미결 초안뿐 아니라 **승격으로 강등된 과거 버전**까지 포함한다. 실제 데이터(`PRJ-2027-0600`: 최종본 `SNO=4`, `SNO=1`·`3`이 `N`/`N`)로 로컬 적용에서 확인했다. 재상신을 한 번이라도 거친 문서는 모두 위반이 되므로 이 불변식은 성립하지 않는다. 미결 초안은 "최종본보다 뒤 순번"으로만 가려낼 수 있고 이는 행 단위 술어가 아니어서 함수 기반 인덱스로 강제할 수 없다. `V20260901_002`를 철회하고 중복 차단은 애플리케이션 가드에만 맡긴다.

   같은 이유로 **1의 가드 술어도 정정**했다. `existsByAbusMngNoAndLstYnAndDelYn(mngNo,'N','N')`은 위와 같은 오판을 하므로 `existsByAbusMngNoAndSnoGreaterThanAndDelYn(mngNo, 최종본순번, 'N')`으로 바꿨다.

3. 승격 역행 방지 — `promoteApprovedVersion`에서 현재 최종본 순번보다 낮은 순번으로의 승격을 거부한다.
   ```java
   Integer currentSno = repository.findCurrentVersionForUpdate(mngNo).map(...).orElse(null);
   if (currentSno != null && sno < currentSno) {
       throw new IllegalStateException("이전 개정본으로 되돌릴 수 없습니다: " + mngNo + "#" + sno);
   }
   ```
   D8이 만드는 "구버전 재승격"도 이 가드로 함께 차단된다.

4. 프런트: 재상신 버튼(`canReapply`)이 이력에 활성 초안이 있으면 비활성화되도록 조건을 추가한다.

**테스트**
- `ProjectVersionServiceTest`/`CostVersionServiceTest`: 연속 2회 `createReapplication` → 두 번째 예외
- 같은 테스트에 `promoteApprovedVersion(mngNo, 1)`을 최종본 sno=2 상태에서 호출 → 예외
- 프런트 재상신 버튼 노출 조건 단위 테스트

### 3.4 D7 — 목록 조립의 버전 단위 결재 매핑 (P1)

**변경**: [ProjectBatchAssembler.java:87](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBatchAssembler.java:87)의 `loadBatchData(projects, responses, false)` → `true`, [:99](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBatchAssembler.java:99)의 `applyCommon(..., false)` → `true`.

`keyBySequence=true`는 `bprojaStsCodes` 세팅도 함께 켠다([:289](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectBatchAssembler.java:289)). 목록 응답 DTO에 이 필드가 늘어나는 것이 허용되는지 확인하고, 목록에 불필요하면 `keyBySequence`와 `includeStepCodes`를 별도 플래그로 분리한다.

**선행 데이터 점검**: 버전 단위 키로 바꾸면 `CAPPLA.FNT_TB_CRY_SNO`가 NULL이거나 원본과 어긋난 레거시 행은 매칭에서 빠져 결재 배지가 사라진다. 배포 전 검증 SQL로 건수를 센다.

```sql
SELECT COUNT(*) FROM ITPOWN.TPRMPP_CAPPLA
 WHERE FNT_TB_NM = 'BPROJM' AND (FNT_TB_CRY_SNO IS NULL OR FNT_TB_CRY_SNO < 1);
```

0이 아니면 보정 마이그레이션(해당 관리번호의 최소 SNO로 채움)을 D5 배치에 함께 넣는다.

**테스트**: `ProjectQueryServiceTest`에 "v1 결재완료 + v2 미상신 초안" 픽스처로 `apfSts=none` 조회 시 초안 행의 `apfSts`·`apfMngNo`·`applicationInfo`가 모두 null인지 검증.

### 3.5 D5 — Flyway 체크섬 복원과 인덱스 재생성 (P0)

#### 3.5.1 선행 사실 — 002가 남기는 순 DDL은 인덱스 1건뿐이다

같은 커밋 `323d8c5`가 [`V20260831_005__RemoveLocalPlanVersionColumns.sql`](../../../it_database/migrations/V20260831_005__RemoveLocalPlanVersionColumns.sql)을 함께 추가했고, 이 스크립트는 002가 계획 테이블에 넣은 것을 **전부 되돌린다**.

| 002가 추가한 객체 | 005의 처리 |
| --- | --- |
| `TPRMPP_BPLANM.SNO`·`LST_YN`·`SVN_DPM_C`, `TPRMPP_BPLANA.SNO` | `DROP COLUMN` |
| `PK_BPLANM(REQ_DOC_NO, SNO)`, `PK_TPRMPP_BPLANA(ABUS_MNG_NO, REQ_DOC_NO, SNO)` | `DROP` 후 운영 메타와 같은 원래 PK로 재생성 |
| `CK_BPLANM_SNO`, `CK_BPLANM_LST_YN` | `DROP CONSTRAINT` |
| `IX_TPRMPP_BPLANM_01`, `IX_TPRMPP_BPLANA_02` | `DROP INDEX` |
| `IX_TPRMPP_CAPPLA_02` | **유지**(005가 건드리지 않음) |

즉 002→005를 모두 거치고 나면 이 기능이 스키마에 남기는 것은 `IX_TPRMPP_CAPPLA_02` 하나이고, 하필 그 생성 블록이 `323d8c5`에서 삭제됐다. **원본 002로 적용한 환경에만 이 인덱스가 있고, 수정본으로 적용했거나 앞으로 새로 구축하는 환경에는 이 기능의 인덱스가 하나도 남지 않는다.**

이 사실이 계획에 미치는 영향은 두 가지다.

- `323d8c5`가 002에 밀어 넣은 ORA-01442 멱등 로직(`ALL_TAB_COLUMNS.NULLABLE` 확인 후 NOT NULL 전환)은 **신규 버전으로 옮기지 않는다.** 그 로직은 002 자신의 재실행 경로를 위한 것인데, 005가 대상 컬럼을 지우므로 이후 버전에서는 대상이 존재하지 않는다. 002 중단 시 복구는 기존 운영 런북을 따른다.
- 기존 검증 SQL은 더 이상 "기대값이 어긋난" 수준이 아니라 **실행 자체가 실패한다**(§3.5.4).

#### 3.5.2 환경별 분기 원칙

배포 전 각 환경에서 아래를 먼저 확인한다.

```sql
SELECT version, checksum, success, installed_on
  FROM ITPAPP.flyway_schema_history
 WHERE version IN ('20260831.002', '20260831.005')
 ORDER BY version;
```

| 상황 | 조치 | `IX_TPRMPP_CAPPLA_02` 현재 상태 |
| --- | --- | --- |
| 002 미적용(신규 환경) | A안 그대로 적용. 원본 002 → 003 → 004 → 005 → `V20260901_001` 순서로 실행된다 | 002가 생성 → 001이 건너뜀 |
| 002를 **원본**(`0fe7a46`)으로 적용 완료 | A안. 되돌린 파일이 원래 체크섬과 일치하므로 repair 불필요 | 존재 → 001이 정의만 검증하고 건너뜀 |
| 002를 **수정본**(`323d8c5`)으로 적용 완료 | A안 적용 시 체크섬 불일치 → 해당 환경만 `flyway repair` 1회 | **없음** → 001이 생성 |

세 경우 모두 `V20260901_001`이 멱등해야 하므로 존재 확인 후 생성하는 형태를 유지한다.

#### 3.5.3 A안 (채택)

1. `V20260831_002__AddPlanReapplicationVersioning.sql`를 `git show 0fe7a46:migrations/V20260831_002__AddPlanReapplicationVersioning.sql` 내용으로 되돌린다.
2. 신규 `V20260901_001__RestoreCapplaIndexAndDraftUniqueness.sql`을 추가하고 다음을 멱등하게 담는다.
   - 삭제된 `IX_TPRMPP_CAPPLA_02` 생성 블록 원문 복원 — `(FNT_TB_NM, PK_COL_NM, FNT_TB_CRY_SNO, DEL_YN, APF_DCM_NO)` 5컬럼 + 기존 인덱스 정의 검증(`RAISE_APPLICATION_ERROR(-20097, ...)`)
   - **ORA-01442 멱등 로직은 옮기지 않는다**(§3.5.1)
   - **초안 유일성 인덱스는 이 버전에 넣지 않는다.** DB 제약이 애플리케이션 가드(§3.3, 배치 2)보다 먼저 배포되면 더블클릭이 안내 문구 대신 ORA-00001 기반 500으로 표면화된다. 별도 `V20260901_002__AddReapplicationDraftUniqueness.sql`로 배치 2에서 함께 배포한다
3. 운영 기록 `it_database/docs/operations/2026-09-01-flyway-002-checksum-recovery.md`에 되돌림 근거, 환경별 판단 SQL, repair가 필요한 조건, 002→005 순 DDL 요약을 남긴다.
4. 검증 SQL을 교체한다(§3.5.4).
5. 운영 DB 반영 목록은 [`meta/backlog.md`](../../../meta/backlog.md)에 이미 등록했다 — 인덱스 4건, 테이블·시퀀스 변경 없음.

> A안은 "적용된 마이그레이션은 수정하지 않는다"는 `CLAUDE.md` 규칙 위반을 **되돌려** 규칙 상태로 복귀시키는 조치다. 되돌림 자체가 파일 변경이므로, 수정본으로 이미 적용한 환경이 있으면 그 환경에 한해 repair가 필요하다는 점을 운영 기록에 명시한다.

#### 3.5.4 검증 SQL 교체

기존 [`2026-08-31-plan-reapplication-versioning.sql`](../../../it_database/docs/verification/2026-08-31-plan-reapplication-versioning.sql)은 005 적용 후 **대부분의 쿼리가 실패하거나 빈 결과를 낸다.**

| 쿼리 | 005 적용 후 결과 |
| --- | --- |
| L3–8 `BPLANM`의 `SNO`·`LST_YN`·`SVN_DPM_C` 컬럼 조회 | `REQ_DOC_NO` 1행만 — 나머지는 삭제됨 |
| L10–14 `PK_BPLANM`·`PK_TPRMPP_BPLANA` 구성 | 순번 컬럼이 빠진 원래 PK |
| L16–21 `CK_BPLANM_SNO`·`CK_BPLANM_LST_YN` | 빈 결과 — 삭제됨 |
| L23–27 인덱스 3종 | `IX_TPRMPP_CAPPLA_02` 1건만(있는 경우) |
| L29–32 `BPLANM` `LST_YN` 집계 | **ORA-00904** — 컬럼 없음 |
| L34–39 `BPLANM` 순번 유효성 | **ORA-00904** |
| L41–43 `BPLANA` 순번 유효성 | **ORA-00904** |

조치:

- 기존 파일은 삭제하지 않고 상단에 "V20260831_005로 계획 버전 컬럼이 철회되어 더 이상 유효하지 않음. `2026-09-01-...` 스크립트로 대체" 주석을 달아 이력으로 남긴다(적용 당시 기록의 근거이므로 내용은 보존).
- 신규 `it_database/docs/verification/2026-09-01-budget-reapplication-indexes.sql`을 추가하고 다음만 확인한다.
  1. `IX_TPRMPP_CAPPLA_02`의 5개 컬럼과 순서
  2. `IX_TPRMPP_BPROJM_03`·`IX_TPRMPP_BCOSTM_03`의 함수 기반 인덱스 식(`ALL_IND_EXPRESSIONS`에 식 1개)
  3. 초안 중복 잔존 여부(§3.3 점검 SQL과 동일)
  4. `TPRMPP_CAPPLA`의 `FNT_TB_CRY_SNO` NULL·1 미만 건수(§3.4 선행 점검)
- `BPLANM`/`BPLANA` 관련 검증 항목은 신규 스크립트에 **넣지 않는다** — 해당 스키마 변경이 철회됐다.

### 3.6 D8 — `report.vue` 순번 전달 (P1)

```diff
-orcItems: [
-    { fntTbNm: 'BPROJM', pkColNm: project.abusMngNo, fntTbCrySno: '1' },
-] as OrcItem[],
+orcItems: [
+    { fntTbNm: 'BPROJM', pkColNm: project.abusMngNo, fntTbCrySno: String(project.sno ?? 1) },
+] as OrcItem[],
```

`projects.value`는 `fetchProjectsBulk` 결과(`ProjectDetail`)라 `sno`를 포함한다([report.vue:375](../../../it_frontend/app/pages/info/projects/report.vue:375)).

**백엔드 보강**: 프런트 수정만으로는 다른 클라이언트가 잘못된 순번을 보내는 경우를 막지 못한다. 상신 시 `CAPPLA` 링크 생성 지점에서 `fntTbCrySno`가 (a) null이 아니고 (b) 해당 관리번호의 활성 개정본에 실제 존재하는지 검증하고, 아니면 400으로 거절한다. §3.3의 승격 역행 가드와 함께 이중 방어가 된다.

**테스트**: `it_frontend/tests/unit/pages/infoProjectsReport.test.ts`에 sno=2 픽스처로 상신 시 `fntTbCrySno: '2'`가 전송되는지 검증. 백엔드는 `ApplicationService` 테스트에 존재하지 않는 순번 상신 → 400 케이스 추가.

### 3.7 D9 — PDF 보고서의 버전 정합 (P1)

계약 변경이 선행이다(`CLAUDE.md` §4: 백엔드 DTO/OpenAPI 확정 → 프런트 codegen).

1. **백엔드**: `ProjectDto.BulkGetRequest`에 선택 필드 추가
   ```java
   /** 버전 지정 조회. 비우면 최종본(LST_YN='Y')을 반환한다. */
   private List<VersionRef> versions;   // record VersionRef(String mngNo, Integer sno)
   ```
   `CostDto.BulkGetRequest`도 동일. `ProjectQueryService.getProjectsByIds`는 `versions`가 있으면 `findByAbusMngNoAndSnoAndDelYn` 배치 조회로, 없으면 기존 `LST_YN='Y'` 경로로 분기한다. 배치 조회는 `(mngNo, sno)` IN 절 1회로 처리해 N+1을 만들지 않는다.
2. **프런트**: `npm run codegen` → `downloadPdf`가 상신 경로와 동일하게 `{ id, sno }` 쌍을 만들어 넘긴다.
   ```diff
   -const projectIds = filteredItems.value.filter(...).map((i) => i._id);
   +const projectVersions = filteredItems.value.filter(...).map((i) => ({ mngNo: i._id, sno: i._sno ?? 1 }));
   ```
3. `npm run codegen:check`로 생성 타입 드리프트가 없는지 확인한다.

**테스트**: `useBudgetApprovalPage.test.ts`에 `_sno=2` 행의 PDF 다운로드 시 bulk 요청 payload에 순번이 실리는지 검증. 백엔드는 `ProjectQueryServiceTest`에 버전 지정 bulk 조회 케이스 추가.

**부수 정리**: [ProjectRepository.java:99](../../../it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java:99)의 잘못된 javadoc(D13)을 이 작업에서 함께 고친다.

### 3.8 D10 — 이관 조정계획 코드값 (P1)

```diff
 return new AdjustmentPlan(
         planService.createPlanForMigration(
                 bseYy,
-                "조정",
+                PlanType.ADJUSTMENT.code(),
```

```diff
-if (snapshot.planExists("조정")) {
+if (snapshot.planExists(PlanType.ADJUSTMENT.code())) {
```

`createPlanForMigration`의 `plnTp` 파라미터에 `PlanType`을 받도록 시그니처를 바꾸는 것이 더 안전하지만, 호출부가 한 곳뿐이므로 우선 코드값 정정 + javadoc에 "저장 코드값(`01`/`02`)" 명시로 처리하고 타입 강화는 후속으로 둔다.

**테스트**: `MigrationImportService` 테스트에 조정계획 생성 시 `Bplanm.itPtlPlnTpC == "02"` 검증, `MigrationValidator` 테스트에 "같은 연도 조정계획 존재 시 BLOCKER 발생" 케이스 추가(현재는 어떤 입력에도 발화하지 않으므로 신규 커버리지).

### 3.9 D11·D12 — 부수 정리

```diff
-if (actor.isAdmin() || IT_ORGANIZATION_CODES.contains(actor.getBbrC())) {
+if (actor.isAdmin()
+        || (actor.getBbrC() != null && IT_ORGANIZATION_CODES.contains(actor.getBbrC()))) {
```

`CostRepositoryImpl`의 `001/002/003/004` 주석을 실제 코드 `1/2/3/4`로 정정한다.

**테스트**: `ProjectVersionAccessTest`에 `bbrC=null` 사용자가 `AccessDeniedException`(403)을 받는지 확인.

---

## 4. 실행 순서

교차 저장소 순서는 `CLAUDE.md` §4를 따른다 — DB → 백엔드 계약 → 프런트.

**배치 1 (P0, DB·백엔드 안전성)**
1. D5: 002 되돌림 + `V20260901_001`(CAPPLA 인덱스 복원) + 검증 SQL 교체 + 운영 기록 (`it_database`)
2. 선행 점검 SQL 2종 실행 — D7의 `CAPPLA.FNT_TB_CRY_SNO` NULL 건수, §3.3의 중복 초안 건수. 후자는 배치 2의 인덱스 생성 가능 여부를 미리 확정하기 위해 여기서 돌린다
3. D2·D3·D4: `ApprovalWriteGuard` 도입과 코스트 쓰기 경로 가드, 삭제 범위 수정 (`it_backend`)
4. D1: `BudgetListVersionScope` 도입과 두 리포지토리 술어 수정 (`it_backend`)
5. `./gradlew test` → `it_backend` 커밋

**배치 2 (P1, 버전 정합)**
6. D6: 중복 초안 가드 + 승격 역행 가드 (`it_backend`), `V20260901_002` 초안 유일성 인덱스 (`it_database`) — 배포 순서는 애플리케이션 가드가 먼저, 인덱스가 뒤
7. D7: `assembleList` 버전 단위 키 전환 (배치 1의 `CAPPLA` 점검 결과가 0이거나 보정 완료된 뒤)
8. D8 백엔드 측 `fntTbCrySno` 검증
9. D10, D11, D12
10. `./gradlew test` → `it_backend` 커밋, `V20260901_002`는 `it_database` 커밋

**배치 3 (P1, 계약·프런트)**
11. D9 백엔드 bulk 계약 확장 → `it_backend` 커밋
12. `npm run codegen` → D9 프런트, D8 프런트, D6 재상신 버튼 조건
13. `npm run format:check && npm run check && npm test && npm run codegen:check` → `it_frontend` 커밋
14. `./scripts/update-versions-lock.ps1` → 루트 커밋

**커밋 규칙**: 네 워킹트리가 공유되므로 `git add -A`를 쓰지 않고 경로를 명시한다. 각 커밋 전 `git diff --cached --stat`과 `git rev-parse --abbrev-ref HEAD`를 확인한다.

---

## 5. 검증

```powershell
cd C:\it\it_backend
./gradlew test
```

```powershell
cd C:\it\it_frontend
npm run format:check
npm run check
npm test
npm run codegen:check
```

```powershell
cd C:\it
./scripts/update-versions-lock.ps1
```

DB는 배포 후 다음을 확인한다.

- 신규 `it_database/docs/verification/2026-09-01-budget-reapplication-indexes.sql` 실행 → `IX_TPRMPP_CAPPLA_02` 5컬럼 정상, `IX_TPRMPP_BPROJM_03`·`IX_TPRMPP_BCOSTM_03` 함수 기반 식 각 1개 (기존 `2026-08-31-...` 스크립트는 `V20260831_005` 이후 ORA-00904로 실패하므로 실행하지 않는다 — §3.5.4)
- `flyway_schema_history`에 `20260831.002`와 `20260831.005`가 SUCCESS이고 `20260901.001`(배치 1)·`20260901.002`(배치 2)가 뒤이어 SUCCESS
- 초안 부분 고유 인덱스 생성 전 사전 점검: 관리번호별 활성 초안이 2건 이상인 행이 없는지

수동 시나리오(스테이징):

1. 결재완료 사업 재상신 → 초안 v2 생성 → 더블클릭 시 두 번째 요청 거절
2. v2 상신 → `/budget/approval`의 **결재중** 탭에 v2가 보이고 미상신 탭에는 없음
3. 결재중 v2 삭제 시도 → 차단 메시지, 승인 완료 클릭 시 500 없이 정상 승격
4. 미상신 v2 행에서 PDF 다운로드 → 화면 금액과 인쇄물 금액 일치
5. 문서 삭제 후 미상신 목록 재조회 → 삭제 문서가 나타나지 않음
6. 일반관리비 조정 편성요구서 이관 → 조정계획 생성 성공, 재업로드 시 중복 BLOCKER 발생

---

## 6. 열린 질문

| # | 질문 | 결정 필요 시점 |
| --- | --- | --- |
| Q1 | 승인 리스너가 승격 대상을 못 찾을 때 예외로 승인 트랜잭션을 롤백하는 현행 정책을 유지할지, 경고 로그 후 승인을 살릴지. 가드 도입으로 원인은 막히지만 레거시 데이터로 재발할 여지가 있다 | 배치 1 착수 전 |
| Q2 | `assembleList`를 `keyBySequence=true`로 바꾸면 목록 응답에 `bprojaStsCodes`가 함께 실린다. 페이로드 증가를 감수할지, 플래그를 분리할지 | 배치 2 착수 전 |
| Q3 | `002` 수정본으로 이미 적용한 환경이 실제로 존재하는지(=`flyway repair`가 필요한 환경이 있는지) | 배치 1 착수 전, DBA 확인 |
| Q4 | 문서 삭제 시 초안 cascade 삭제 대신 "초안 존재 시 삭제 차단"을 원하는 업무 요건이 있는지 | 배치 1 착수 전 |
| Q5 | `info/projects/report.vue`는 프로덕션 진입 경로가 없다. 수정 대신 제거하는 편이 나은지 | 배치 3 착수 전 |

---

## 7. 리스크

| 리스크 | 완화 |
| --- | --- |
| D5 되돌림이 "수정본 적용 환경"에서 기동을 막는다 | 환경별 `flyway_schema_history` 체크섬 확인을 배포 절차의 첫 단계로 고정(§3.5) |
| D7 전환으로 레거시 결재 링크의 배지가 사라진다 | 사전 점검 SQL로 건수 확인, 0이 아니면 보정 마이그레이션 동반 |
| 부분 고유 인덱스 생성이 기존 중복 초안 때문에 실패한다 | 사전 점검 SQL을 검증 스크립트로 먼저 배포하고 통과 후 인덱스 추가 |
| D9 계약 확장이 다른 bulk 소비자에 영향 | `versions`를 선택 필드로 두고 미지정 시 기존 동작을 그대로 유지 |
| 결재 가드 추가로 이관 일괄업로드가 막힌다 | `preserveSubmittedAmounts=true` 경로는 가드 대상에서 제외 |
