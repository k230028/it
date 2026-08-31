# 경상예산(BPLANM) 재신청 버전 구현 보고서

## 범위

- 백엔드: `C:\it\it_backend`
- 물리 스키마·운영 검증: `C:\it\it_database`
- 프론트엔드는 변경하지 않았다.

## 물리 스키마 결정

기존 `TPRMPP_BPLANM.REQ_DOC_NO`가 실제 계획관리번호이므로 별도의 부모 컬럼을 만들지 않고 이를 부모 키로 유지했다. `SNO`를 추가하여 BPLANM의 PK를 `(REQ_DOC_NO, SNO)`로 확장했고, 계획-대상 관계 `TPRMPP_BPLANA`도 정확한 부모 개정본을 가리키도록 PK를 `(ABUS_MNG_NO, REQ_DOC_NO, SNO)`로 확장했다.

신규 BPLANM 컬럼은 다음과 같다.

| 컬럼 | 의미 | 보장 |
| --- | --- | --- |
| `SNO` | 부모 계획번호 안의 개정 순번 | NOT NULL, `SNO > 0`, PK 구성 |
| `LST_YN` | 현재 후속 업무에 쓰는 최종본 여부 | NOT NULL, `Y`/`N` check |
| `SVN_DPM_C` | 주관부서·소유 부서 | 신규 생성 시 인증 사용자 부서, 과거 행은 안전 backfill |

`Bplanm`/`Bplana`는 `@IdClass` 복합키로 매핑했고, BPLANA의 명시 순번 조회는 초안·과거 이력용으로만 사용한다.

## Flyway·기존 데이터 안전성

`V20260831_002__AddPlanReapplicationVersioning.sql`은 기존 데이터의 본문, 금액, 감사 필드를 바꾸지 않고 다음만 보정한다.

1. 기존 BPLANM/BPLANA 행은 각각 `SNO=1`, BPLANM은 `LST_YN='Y'`로 보정한다.
2. BPLANM의 `FST_ENR_USID`와 활성 CUSERI를 연결해, 한 사번에 하나의 `BBR_C`가 확정되는 경우에만 `SVN_DPM_C`를 채운다.
3. 부서가 모호하거나 없는 과거 행은 임의 추정하지 않고 NULL로 남긴다. 해당 행은 재신청·승격을 거부하므로 권한 경계가 열리지 않는다.
4. NOT NULL/값 진단 뒤 PK를 변경한다. 기존 PK를 참조하는 FK가 있으면 DDL 전에 `-20093`/`-20094`로 중단한다.
5. BPLANM 부모/최종본 조회, BPLANA 정확한 개정 관계, CAPPLA `(FNT_TB_NM, PK_COL_NM, FNT_TB_CRY_SNO, DEL_YN, APF_DCM_NO)` 조회 인덱스를 추가한다.

운영 적용·복구 절차는 `it_database/docs/operations/2026-08-31-plan-reapplication-versioning.md`, 적용 후 검증 SQL은 `it_database/docs/verification/2026-08-31-plan-reapplication-versioning.sql`에 기록했다. 실제 Oracle에는 이 작업에서 접속·적용하지 않았다.

## 재신청·승인 동작

- `POST /api/plans/{plnMngNo}/reapplications`: 현재 `LST_YN='Y'` 원본을 비관 잠금하고, 원본이 CAPPLA 최신 상태 `02`(결재완료)이며 소유 부서가 확인될 때만 `MAX(SNO)+1` 초안을 만든다. 원본 본문·금액·스냅샷 및 정확한 BPLANA 관계를 복제하고 초안은 `LST_YN='N'`이다.
- `GET /api/plans/{plnMngNo}/history`: 권한 있는 작성부서/IT 조직/관리자에게 전 버전과 최신 결재 상태를 순번순으로 제공한다.
- `GET /api/plans/{plnMngNo}/versions/{sno}`: 명시한 개정본의 상세와 그 개정본 BPLANA 관계만 제공한다.
- `PATCH /api/plans/{plnMngNo}/versions/{sno}`: 비최종 초안만 수정한다. 최종본 직접 수정은 409으로 거부한다.
- 기존 식별자만 받는 목록·상세·중복 검사·관계 조회는 BPLANM `LST_YN='Y'`를 기본으로 사용한다. 협의회 기준 계획과 사업계획 QueryDSL의 직접 BPLANA 소비에도 최종 BPLANM 순번 조인을 추가했다.

승인 완료 리스너는 `CAPPLA.FNT_TB_NM='BPLANM'`, `PK_COL_NM=REQ_DOC_NO`, `FNT_TB_CRY_SNO=SNO`만 사용해 정확한 버전을 승격한다. 순번이 없는 매핑은 다른 개정본을 추정하지 않고 실패한다. 승격은 부모의 현재 최종본 잠금 뒤 목표 순번을 잠그고, 같은 트랜잭션에서 기존 `Y`를 `N`으로 내린 후 정확한 대상만 `Y`로 올린다. 이미 `Y`인 동일 완료 이벤트는 상태를 다시 바꾸지 않아 멱등이다.

## RED/GREEN 및 검증

### RED

재신청 서비스 구현 전에 `PlanVersionServiceTest`를 추가해 아래를 실행했다.

```powershell
./gradlew --no-daemon -I '.\.codex-plan-version.init.gradle' test --tests 'com.kdb.it.domain.budget.plan.service.PlanVersionServiceTest' --console=plain
```

결과는 `BUILD FAILED in 1m 46s`였다. `PlanVersionService`, `BPLANM.SNO/LST_YN/SVN_DPM_C`, BPLANA 순번, 버전 잠금/승격 리포지토리 메서드가 없어 `compileTestJava`에서 22개 오류가 발생했다. 이는 구현 전 기대한 RED였다.

### GREEN 시도와 차단

구현 후 focused 재실행은 내 변경과 무관한 공유 작업트리 오류에서 `compileJava`가 멈췄다.

```powershell
./gradlew --no-daemon -I 'C:\it\it_backend\.codex-plan-version.init.gradle' test --tests 'com.kdb.it.domain.budget.plan.service.PlanVersionServiceTest' --console=plain
```

마지막 실행 결과는 `BUILD FAILED in 3m 10s`이며, `ProjectDto.java:1041`의 `@Size`에 `jakarta.validation.constraints.Size` import가 없어 다음 3개 오류가 났다.

```text
cannot find symbol: class Size
location: class BulkGetRequest
```

지시에 따라 외부 `ProjectDto.java`는 수정하지 않았다. 따라서 focused GREEN, Oracle 통합 테스트, `bootJar`, 전체 `test`/`check` 성공을 주장하지 않는다. 외부 수정 후 다음 순서로 재실행해야 한다.

```powershell
./gradlew --no-daemon -I '.\.codex-plan-version.init.gradle' test --tests 'com.kdb.it.domain.budget.plan.service.PlanVersionServiceTest' --tests 'com.kdb.it.domain.budget.plan.service.PlanVersionApprovalListenerTest' --tests 'com.kdb.it.domain.budget.plan.service.PlanServiceTest' --tests 'com.kdb.it.domain.budget.plan.controller.PlanControllerTest' --tests 'com.kdb.it.domain.budget.plan.repository.PlanListProjectionIt' --tests 'com.kdb.it.domain.council.repository.CouncilBaselineLookupIt' --tests 'com.kdb.it.domain.bizplan.repository.BizplanPlanVersionQueryContractTest' --console=plain
./gradlew bootJar --console=plain
./gradlew test
./gradlew check
```

정적 self-review로 직접 BPLANM/BPLANA 소비처(Council, Bizplan, migration snapshot)를 재검색했고, `git diff --check`는 백엔드·DB의 본 변경 경로에서 통과했다.

## 테스트 추가 범위

- 재신청: 결재완료 최종본만 다음 `SNO` 초안으로 복제하고 BPLANA 관계도 같은 순번으로 복제
- 거부: 결재중 원본 거부, 소유권 경계, 최종본 직접 수정 거부
- 이력·명시 상세: 순번별 결재 상태와 정확한 관계 반환
- 완료 전환: 부모 잠금 선행, 정확한 순번만 승격, 동일 완료 이벤트 멱등, CAPPLA 순번 누락 거부
- 일반 소비: 계획 목록/협의회/사업계획이 초안 관계를 읽지 않는 계약
- MVC: 재신청·이력·명시 버전 상세의 상태·Location·응답 필드

## 커밋

- backend: `746fb696 feat: add plan reapplication versioning`
- database: `0fe7a46 feat: add plan reapplication migration`
- root report: 이 보고서 커밋에서 기록한다.

## 남은 이슈

1. 공유 작업트리의 외부 `ProjectDto` import 오류가 해결되기 전에는 Java 컴파일을 통과할 수 없다.
2. Oracle 적용은 DBA/Flyway 적용 경계에 있으므로 이 작업에서는 실행하지 않았다. 검증 SQL과 운영 절차를 먼저 검토한 뒤 적용해야 한다.
