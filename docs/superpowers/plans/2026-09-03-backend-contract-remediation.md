# Backend Contract Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BE-91~BE-94와 BE-100을 해결해 연도 중립 API, UTF-8 바이트 검증, 전산업무비 이력 권한/성능, 중복 코드를 정리한다.

**Architecture:** API 계약 변경은 백엔드 DTO·테스트를 먼저 고친 뒤 프론트 생성 타입을 갱신한다. 엔티티의 BYTE 컬럼은 `Utf8ByteLimit`에서 fail-fast하고, 이력 권한은 `CostVersionService`가 소유한다. 문서번호 채번은 prefix와 Clock을 받는 단일 컴포넌트로 모은다.

**Tech Stack:** Java 25, Spring Boot 4.1, JPA, OpenAPI, JUnit 5, Nuxt codegen.

**Spec:** `docs/superpowers/specs/2026-09-03-task-backlog-remediation-design.md`

## Global Constraints

- 생성된 `app/types/api.d.ts`는 수기로 편집하지 않는다.
- DB 문자열 한도는 UTF-8 바이트 수로 검증한다.
- actor 없는 기존 서비스 오버로드는 이관/내부 호출 호환이 확인된 경우에만 유지한다.
- DB 계획에서 확정한 `GDOC-`, `FDOC-`, `CDOC-`, `PDOC-`를 사용한다.

---

### Task 1: BE-91 금융정보단말기 연도 중립 계약

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/terminal/dto/TerminalBulkImportDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/terminal/TerminalBulkImportPlanner.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/terminal/TerminalBulkImportService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/terminal/TerminalBulkImportPlannerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/terminal/TerminalBulkImportServiceTest.java`
- Modify: `it_frontend/app/types/api.d.ts`
- Modify: `it_frontend/app/utils/terminalBulkImport.ts`
- Modify: `it_frontend/app/composables/useTerminalBulkImportPage.ts`
- Modify: `it_frontend/app/pages/admin/migration/index.vue`

**Interfaces:** `Request`에 `baseYear: int`, `Row`에 `previousCostId`, `currentCostId`를 두고 `previousYear=baseYear-1`, `currentYear=baseYear`로 계산한다.

- [ ] **Step 1: 2027 기준 요청이 2026/2027 그룹을 만드는 테스트를 작성한다**

```java
var plans = planner.plan(2027, rows);
assertThat(plans).extracting(PlannedGroup::year).containsExactly("2026", "2027");
```

- [ ] **Step 2: 테스트가 기존 고정 연도 때문에 실패하는지 확인한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*TerminalBulkImportPlannerTest' --tests '*TerminalBulkImportServiceTest'`

- [ ] **Step 3: DTO와 planner를 연도 중립으로 변경한다**

`plan(List<Row>)`를 `plan(int baseYear, List<Row>)`로 바꾸고 서비스의 `YEAR_2025` 분기를 `year == baseYear - 1` 판정으로 바꾼다. 허용 범위는 2000~2100으로 검증한다.

- [ ] **Step 4: 백엔드 테스트를 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*TerminalBulkImport*'`

Expected: PASS.

- [ ] **Step 5: 백엔드를 기동해 프론트 타입과 소비 코드를 갱신한다**

Run: `cd C:\it\it_frontend; npm run codegen; npm run codegen:check`

Expected: `costId2025`, `costId2026`가 생성 타입과 운영 코드에서 0건.

- [ ] **Step 6: 저장소별로 커밋한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/migration/terminal src/test/java/com/kdb/it/domain/migration/terminal
git -C C:\it\it_backend commit -m "refactor: 단말기 이관 연도 계약 중립화"
git -C C:\it\it_frontend add app/types/api.d.ts app/utils/terminalBulkImport.ts app/composables/useTerminalBulkImportPage.ts app/pages/admin/migration/index.vue
git -C C:\it\it_frontend commit -m "refactor: 단말기 이관 연도 중립 계약 반영"
```

### Task 2: BE-92 첨부파일 OpenAPI 명칭 정정

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/banner/controller/BannerController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/controller/FileController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/userguide/controller/UserGuideController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/dto/FileDto.java`
- Test: corresponding `*OpenApiContractTest.java`
- Modify: `it_frontend/app/types/api.d.ts`

**Interfaces:** `APG_FL_KD_NM=첨부파일종류명`, `APG_FL_LNK_CTZ_NM=첨부파일연결콘텐츠명`으로 문서화한다.

- [ ] **Step 1: OpenAPI description 문자열 계약 테스트를 먼저 정정한다**

- [ ] **Step 2: 테스트가 기존 설명으로 실패하는지 확인한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*OpenApiContractTest'`

- [ ] **Step 3: controller, DTO, JavaDoc의 잘못된 용어를 정정한다**

`PK_COL_NM`에만 `주식별자컬럼명` 용어를 남긴다.

- [ ] **Step 4: 타입 재생성과 계약 검증을 실행한다**

Run: `cd C:\it\it_frontend; npm run codegen; npm run codegen:check`

- [ ] **Step 5: 저장소별로 커밋한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/banner/controller/BannerController.java src/main/java/com/kdb/it/infra/file/controller/FileController.java src/main/java/com/kdb/it/domain/userguide/controller/UserGuideController.java src/main/java/com/kdb/it/infra/file/dto/FileDto.java src/test/java/com/kdb/it/domain/banner/controller/BannerControllerTest.java src/test/java/com/kdb/it/infra/file/controller/FileControllerOpenApiContractTest.java src/test/java/com/kdb/it/domain/userguide/controller/UserGuideControllerTest.java
git -C C:\it\it_backend commit -m "docs: 첨부파일 OpenAPI 컬럼명 정정"
git -C C:\it\it_frontend add app/types/api.d.ts
git -C C:\it\it_frontend commit -m "chore: 첨부파일 OpenAPI 타입 재생성"
```

### Task 3: BE-93 조직·담당자명 BYTE 검증 확대

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/entity/BcostmOrgNameByteValidationTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/project/entity/BprojmSnapshotNameByteValidationTest.java`

**Interfaces:** 100 BYTE 필드는 정확히 100바이트를 허용하고 101바이트 이상은 `IllegalArgumentException`으로 실패한다.

- [ ] **Step 1: 한글 33자+ASCII 1자 성공, 한글 34자 실패 테스트를 작성한다**

```java
assertThatCode(() -> entity.assignSvnOrgNames("가".repeat(33) + "a", null)).doesNotThrowAnyException();
assertThatThrownBy(() -> entity.assignSvnOrgNames("가".repeat(34), null))
        .isInstanceOf(IllegalArgumentException.class);
```

`Bprojm`의 `SVN_DPM_NM`, `SVN_TEM_NM`, `TLR_NM`, `USR_NM`, `BZ_DTT_NM`을 각각 검증한다.

- [ ] **Step 2: 테스트가 현재 검증 부재로 실패하는지 확인한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*OrgNameByteValidationTest' --tests '*SnapshotNameByteValidationTest'`

- [ ] **Step 3: 대입 직전 공통 private 검증을 호출한다**

```java
private static void validateSnapshotName(String column, String value) {
    Utf8ByteLimit.requireAtMost(column, value, 100);
}
```

생성/수정/assign 경로가 직접 필드를 대입하는 모든 지점에 같은 검증을 적용한다.

- [ ] **Step 4: 엔티티 focused 테스트를 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*Bcostm*Test' --tests '*Bprojm*Test' --tests '*BtermmOrgNameByteValidationTest'`

- [ ] **Step 5: 변경을 커밋한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java src/test/java/com/kdb/it/domain/budget/cost/entity/BcostmOrgNameByteValidationTest.java src/test/java/com/kdb/it/domain/budget/project/entity/BprojmSnapshotNameByteValidationTest.java
git -C C:\it\it_backend commit -m "fix: 예산 스냅샷명 BYTE 한도 검증"
```

### Task 4: BE-94 전산업무비 이력 권한과 배치 조립

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostVersionService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostQueryAssembler.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostVersionServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostQueryAssemblerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/controller/CostControllerTest.java`

**Interfaces:**
- Produces: `createReapplication(String, CustomUserDetails)`
- Produces: `findHistory(String, CustomUserDetails)`
- Produces: `assembleHistory(List<Bcostm>): List<CostDto.Response>`

- [ ] **Step 1: 타부서 이력/재상신 거부와 batch 조립 호출 수 테스트를 작성한다**

history 3건이어도 terminal/application/code bulk loader가 각각 한 번만 호출되는지 검증한다.

- [ ] **Step 2: 현재 controller 1+N 동작으로 테스트가 실패하는지 확인한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*CostVersionServiceTest' --tests '*CostQueryAssemblerTest' --tests '*CostControllerTest'`

- [ ] **Step 3: service actor 오버로드를 추가한다**

이력은 첫 행의 `svnDpmC`, 재상신은 잠근 source의 `svnDpmC`를 `BudgetDetailAccessVerifier.verifyReadable`로 검증한다.

- [ ] **Step 4: assembler에 이력 전체 조립 메서드를 추가한다**

관리번호+순번 키로 단말기와 결재 상태를 bulk 조회해 맵으로 만든 후 입력 순서대로 DTO를 만든다.

- [ ] **Step 5: controller stream별 상세 재조립을 단일 호출로 교체한다**

- [ ] **Step 6: focused 테스트를 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*CostVersionServiceTest' --tests '*CostQueryAssemblerTest' --tests '*CostControllerTest'`

- [ ] **Step 7: 변경을 커밋한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/cost src/test/java/com/kdb/it/domain/budget/cost
git -C C:\it\it_backend commit -m "fix: 전산업무비 이력 권한과 배치 조립"
```

### Task 5: BE-100 문서번호 채번과 잔존물 정리

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/BgdocNumberAllocator.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/BgdocNumberAllocatorTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/popup/CommonPopupCreationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/speeddial/contact/ContactInfoCreationService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/GuideDocService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/entity/Cinfmm.java`
- Delete: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/Utf8ByteLimitTest.java` (완료 후 `common/util/Utf8ByteLimitTest.java`만 남음)

**Interfaces:** `BgdocNumberAllocator.next(String prefix): String`은 공유 시퀀스와 주입된 `Clock`으로 `{prefix}{yyyy}-{seq:04d}`를 만든다.

- [ ] **Step 1: prefix별 동일 시퀀스 채번 테스트를 작성한다**

```java
assertThat(allocator.next("CDOC-")).isEqualTo("CDOC-2026-0017");
assertThat(allocator.next("PDOC-")).isEqualTo("PDOC-2026-0018");
```

- [ ] **Step 2: 새 allocator 부재로 테스트가 실패하는지 확인한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*BgdocNumberAllocatorTest'`

- [ ] **Step 3: allocator를 구현하고 네 서비스를 전환한다**

팝업은 `PDOC-`, 담당자 정보는 `CDOC-`, 사업 가이드는 `GDOC-`, 폼 가이드는 `FDOC-`를 넘긴다.

- [ ] **Step 4: 미사용 `Cinfmm.markDispatched`와 중복 구 경로 테스트를 제거한다**

Run before delete: `cd C:\it\it_backend; rg -n 'markDispatched\(' src/main src/test`

Expected: 선언 외 호출 0건.

- [ ] **Step 5: 관련 서비스 테스트를 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*BgdocNumberAllocatorTest' --tests '*CommonPopupCreationServiceTest' --tests '*ContactInfoCreationServiceTest' --tests '*GuideDocServiceTest' --tests '*FormGuideServiceTest' --tests '*Utf8ByteLimitTest'`

Expected: 공통 util 위치의 `Utf8ByteLimitTest`만 실행되고 PASS.

- [ ] **Step 6: stale 문서 참조 두 곳이 제거됐는지 확인한다**

Run: `cd C:\it; rg -n '후속.*V20260901_002|V20260901_002.*예정' it_database docs`

Expected: 0건.

- [ ] **Step 7: 변경을 커밋한다**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/document/service/BgdocNumberAllocator.java src/main/java/com/kdb/it/common/popup/CommonPopupCreationService.java src/main/java/com/kdb/it/common/speeddial/contact/ContactInfoCreationService.java src/main/java/com/kdb/it/domain/budget/document/service/GuideDocService.java src/main/java/com/kdb/it/domain/budget/document/formguide/FormGuideService.java src/main/java/com/kdb/it/common/notification/entity/Cinfmm.java src/test/java/com/kdb/it/domain/budget/document/service/BgdocNumberAllocatorTest.java src/test/java/com/kdb/it/common/popup/CommonPopupCreationServiceTest.java src/test/java/com/kdb/it/common/speeddial/contact/ContactInfoCreationServiceTest.java src/test/java/com/kdb/it/domain/budget/document/service/GuideDocServiceTest.java src/test/java/com/kdb/it/domain/budget/document/formguide/FormGuideServiceTest.java src/test/java/com/kdb/it/domain/migration/request/service/Utf8ByteLimitTest.java
git -C C:\it\it_backend commit -m "refactor: BGDOC 문서번호 채번 공통화"
```

### Task 6: 전체 검증과 완료 기록

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`
- Modify: `versions.lock`

**Interfaces:** BE-91~BE-94, BE-100의 저장소별 커밋과 검증 결과를 기록한다.

- [ ] **Step 1: 백엔드 Health Stack을 실행한다**

Run: `cd C:\it\it_backend; ./gradlew test; ./gradlew check; ./gradlew bootJar`

- [ ] **Step 2: 프론트 API 계약 검증을 실행한다**

Run: `cd C:\it\it_frontend; npm run codegen:check; npm run check; npm test`

- [ ] **Step 3: 완료 문서와 버전 잠금을 갱신한다**

Run: `cd C:\it; ./scripts/update-versions-lock.ps1`

- [ ] **Step 4: 루트 문서를 커밋한다**

```powershell
git -C C:\it add TASK.md TASK_DONE.md versions.lock
git -C C:\it commit -m "docs: 백엔드 계약 과제 완료 기록"
```
