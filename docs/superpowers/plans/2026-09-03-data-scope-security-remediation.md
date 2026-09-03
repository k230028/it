# Data Scope Security Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SEC-21~SEC-23의 목록·건수·bulk 데이터 범위 우회를 막고 상세 조회와 같은 서버 권한 경계를 적용한다.

**Architecture:** 예산 도메인은 기존 `BudgetDetailAccessVerifier`의 관리자·IT조직·동일부서 판정을 재사용한다. 목록은 인증 주체의 부서로 검색 조건을 서버에서 제한하고, bulk는 입력 순서를 유지하면서 범위 밖 항목을 `failedIds`로 분리한다. Q&A 비공개 글은 저장소 술어에서 공개 글 또는 actor 부서 글만 조회한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Security, Querydsl, JUnit 5, Mockito.

**Spec:** `docs/superpowers/specs/2026-09-03-task-backlog-remediation-design.md`

## Global Constraints

- 클라이언트가 전달한 부서코드를 권한 근거로 사용하지 않는다.
- 인증 정보가 없으면 전체 조회로 폴백하지 않는다.
- bulk의 범위 밖 ID는 존재 여부를 노출하지 않도록 미존재 ID와 같은 `failedIds`에 넣는다.
- 목록 body와 `X-Total-Count`는 반드시 같은 범위를 사용한다.

---

### Task 1: SEC-21 정보화사업 목록 범위 계약 추가

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/controller/ProjectController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectQueryService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/controller/ProjectControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectQueryServiceTest.java`

**Interfaces:**
- Produces: `searchProjectList(SearchCondition, CustomUserDetails, ListPageParams)`
- Produces: `countProjectList(SearchCondition, CustomUserDetails)`

- [ ] **Step 1: 일반 사용자가 다른 `svnDpmC`를 보내도 자기 부서로 제한되는 테스트를 작성한다**

```java
given(user.getBbrC()).willReturn("180");
condition.setSvnDpmC("999");
service.searchProjectList(condition, user, paging);
assertThat(condition.getSvnDpmC()).isEqualTo("180");
```

관리자와 IT조직은 명시 조건 또는 전체 범위를 유지하고, 부서코드가 없는 일반 사용자는 빈 목록/0건을 반환하는 경우도 추가한다.

- [ ] **Step 2: 테스트가 actor 오버로드 부재로 실패하는지 확인한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*ProjectControllerTest' --tests '*ProjectQueryServiceTest'`

Expected: 새 메서드 컴파일 실패.

- [ ] **Step 3: 목록용 범위 판정을 구현한다**

```java
public List<ProjectDto.Response> searchProjectList(
        ProjectDto.SearchCondition condition, CustomUserDetails actor, ListPageParams paging) {
    ProjectDto.SearchCondition scoped = applyReadableScope(condition, actor);
    if (scoped == null) return List.of();
    return searchProjectList(scoped, paging);
}
```

`ProjectQueryService.applyReadableScope` private 메서드는 원본 요청 객체를 변조하지 않도록 검색 조건 복사본을 만들며, 관리자 또는 `BudgetDetailAccessVerifier`가 인정하는 IT조직은 요청 범위를 유지한다. 같은 메서드를 count 경로에서도 호출한다.

- [ ] **Step 4: 컨트롤러에 인증 주체를 전달한다**

`getProjects`에 `@AuthenticationPrincipal CustomUserDetails user`를 추가하고 body와 count 모두 같은 actor 오버로드를 호출한다.

- [ ] **Step 5: focused 테스트를 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*ProjectControllerTest' --tests '*ProjectQueryServiceTest' --tests '*ProjectRepositoryImplTest'`

Expected: PASS.

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/project src/test/java/com/kdb/it/domain/budget/project
git -C C:\it\it_backend commit -m "fix: 정보화사업 목록 부서 범위 강제"
```

### Task 2: SEC-21 정보화사업 bulk 범위 계약 추가

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/controller/ProjectController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectQueryService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/controller/ProjectControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectQueryServiceTest.java`

**Interfaces:** Produces `getProjectsByIds(BulkGetRequest, CustomUserDetails)`.

- [ ] **Step 1: 동일부서·타부서·미존재가 섞인 입력 순서 테스트를 작성한다**

입력 `[OWN, FOREIGN, MISSING]`은 `items=[OWN]`, `failedIds=[FOREIGN, MISSING]`을 반환해야 한다. 관리자/IT조직은 `FOREIGN`도 받는다.

- [ ] **Step 2: 테스트가 actor 오버로드 부재로 실패하는지 확인한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*ProjectQueryServiceTest'`

Expected: 컴파일 실패.

- [ ] **Step 3: 조립 전 Bprojm 단위로 범위를 분리한다**

```java
if (!BudgetDetailAccessVerifier.isReadable(project.getSvnDpmC(), actor)) {
    failedIds.add(prjMngNo);
    continue;
}
projects.add(project);
```

이를 위해 verifier에 부작용 없는 `isReadable(String, CustomUserDetails): boolean`을 추가하고 기존 `verifyReadable`은 false일 때 예외를 던지도록 위임한다.

- [ ] **Step 4: controller가 actor를 서비스에 넘기도록 바꾼다**

- [ ] **Step 5: focused 테스트를 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*BudgetDetailAccessVerifierTest' --tests '*ProjectControllerTest' --tests '*ProjectQueryServiceTest'`

Expected: PASS.

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/common/security/BudgetDetailAccessVerifier.java src/main/java/com/kdb/it/domain/budget/project src/test/java/com/kdb/it/domain/budget/common/security/BudgetDetailAccessVerifierTest.java src/test/java/com/kdb/it/domain/budget/project
git -C C:\it\it_backend commit -m "fix: 정보화사업 bulk 조회 권한 적용"
```

### Task 3: SEC-22 전산업무비 bulk 범위 계약 추가

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/controller/CostControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`

**Interfaces:** Produces `getCostsByIds(CostDto.BulkGetRequest, CustomUserDetails)`.

- [ ] **Step 1: 타부서 cost가 `failedIds`로 이동하는 테스트를 작성한다**

```java
CostDto.BulkResponse result = service.getCostsByIds(request, departmentUser("180"));
assertThat(result.getItems()).extracting(CostDto.Response::getItMngcNo).containsExactly("OWN");
assertThat(result.getFailedIds()).containsExactly("FOREIGN", "MISSING");
```

- [ ] **Step 2: 테스트가 새 시그니처 부재로 실패하는지 확인한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*CostControllerTest' --tests '*CostServiceTest'`

Expected: 컴파일 실패.

- [ ] **Step 3: 기존 query 결과를 입력 순서대로 필터링한다**

`queryService.getCostsByIds(request)`의 결과에서 각 `costSvnDpmC`를 `BudgetDetailAccessVerifier.isReadable`로 판정하고, 거부 항목 ID를 원래 `failedIds`와 입력 순서대로 합친다.

- [ ] **Step 4: controller에 `@AuthenticationPrincipal`을 추가한다**

- [ ] **Step 5: focused 테스트를 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*CostControllerTest' --tests '*CostServiceTest' --tests '*CostQueryServiceTest'`

Expected: PASS.

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/cost src/test/java/com/kdb/it/domain/budget/cost
git -C C:\it\it_backend commit -m "fix: 전산업무비 bulk 조회 권한 적용"
```

### Task 4: SEC-23 Q&A 비공개 목록 술어 적용

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardPostRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/repository/BoardPostRepositoryImpl.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardPostServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/board/repository/BoardPostRepositoryImplTest.java`

**Interfaces:** Q&A 목록 조건에 actor 부서코드를 전달하며 조회 술어는 `xpoYn='Y' OR bbrC=:actorBbrC`다.

- [ ] **Step 1: 타부서 비공개 글이 목록 투영에 포함되지 않는 테스트를 작성한다**

같은 부서 비공개 글과 공개 글은 포함되고, 부서코드가 없는 사용자는 공개 글만 포함되는지 검증한다.

- [ ] **Step 2: 현재 테스트가 기존 전체 노출 동작 때문에 실패하는지 확인한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*BoardPostServiceTest' --tests '*BoardPostRepositoryImplTest'`

Expected: 새 기대값이 실패한다.

- [ ] **Step 3: repository 검색 계약에 actor 부서를 추가한다**

```java
BooleanExpression visibility = includePrivatePosts
        ? cblbcm.xpoYn.eq("Y").or(cblbcm.bbrC.eq(actorBbrC))
        : cblbcm.xpoYn.eq("Y");
```

`actorBbrC`가 비어 있으면 `.eq(null)`을 만들지 않고 공개 글 조건만 사용한다.

- [ ] **Step 4: service의 Q&A 분기에 인증 주체 부서를 전달한다**

- [ ] **Step 5: focused 테스트를 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*BoardPostServiceTest' --tests '*BoardPostRepositoryImplTest' --tests '*BoardPostControllerTest'`

Expected: PASS.

- [ ] **Step 6: 변경을 커밋한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/common/board src/test/java/com/kdb/it/common/board
git -C C:\it\it_backend commit -m "fix: Q&A 비공개 목록 부서 범위 적용"
```

### Task 5: 보안 회귀 검증과 완료 기록

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:** SEC-21~SEC-23의 테스트와 커밋 근거를 완료 기록으로 남긴다.

- [ ] **Step 1: 백엔드 전체 검증을 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test; ./gradlew check; ./gradlew bootJar`

Expected: 모두 exit code 0.

- [ ] **Step 2: 완료 기록을 갱신한다**

`TASK_DONE.md`에 공격 입력, 기대 거부 결과, 검증 명령을 기록하고 `TASK.md`에서 SEC-21~SEC-23만 제거한다.

- [ ] **Step 3: 루트 문서를 커밋한다**

```powershell
git -C C:\it add TASK.md TASK_DONE.md
git -C C:\it commit -m "docs: 데이터 범위 보안 과제 완료 기록"
```
