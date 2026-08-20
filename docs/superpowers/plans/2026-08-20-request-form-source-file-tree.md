# Request Form Source File Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 편성요청서 반입 원본의 업로드 폴더 구조를 보존하고, 트리 선택·ZIP 다운로드·반영 진행 다이얼로그를 제공한다.

**Architecture:** 공통 파일 메타데이터에 nullable 상대경로를 추가하고 반입 보관 흐름에서만 채운다. 백엔드는 권한 검증된 원본 파일을 상대경로대로 스트리밍 ZIP으로 만들고, 프론트엔드는 응답 메타데이터를 순수 트리 모델로 변환해 표준 다이얼로그에서 표시한다. 기존 배치 진행 상태를 공개해 [반영] 전용 상태 다이얼로그를 구동한다.

**Tech Stack:** Oracle/Flyway, Java 25, Spring Boot 4, JPA, JUnit 5, Nuxt 4, Vue 3, TypeScript, PrimeVue, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-08-20-request-form-source-file-tree-design.md`

## Global Constraints

- 신규 DB 컬럼은 `TPRMPP_CFILEM.APG_FL_PTH VARCHAR2(255)`이며 nullable이다.
- 기존 파일의 상대경로가 null이면 파일을 트리 루트에 표시한다.
- ZIP 엔트리명은 서버에서 재정규화하고 현재 신청서에 연결된 파일만 포함한다.
- 폴더는 최초 표시 시 모두 펼친다.
- 고정 사용자 문구는 한국어·영어 번역 트리에 함께 추가한다.
- 신규 주석과 공개 함수 문서는 한글로 작성한다.
- 운영 코드보다 실패하는 테스트를 먼저 작성하고 RED 출력 확인 후 최소 구현한다.

---

### Task 1: 공통 파일 상대경로 스키마와 영속성

**Files:**
- Create: `it_database/migrations/V20260820_001__AddCommonFileRelativePath.sql`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/entity/Cfilem.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/dto/FileDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileUploadUnitService.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/service/FileUploadUnitServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java`

**Interfaces:**
- Produces: `FileDto.UploadRequest.relativePath`, `FileDto.Response.relativePath`, `Cfilem.apgFlPth`

- [ ] **Step 1: Write failing persistence and mapping tests**

```java
FileDto.UploadRequest request = FileDto.UploadRequest.builder()
        .flTpCone("첨부파일")
        .pkColNm("편성요청서반입")
        .pkCone("APF-1")
        .relativePath("2026/IT부(D01)/01. 사업/근거.pdf")
        .build();

assertThat(saved.getApgFlPth()).isEqualTo(request.getRelativePath());
assertThat(linked.getApgFlPth()).isEqualTo(saved.getApgFlPth());
assertThat(fileService.getFile("FL-1").getRelativePath())
        .isEqualTo("2026/IT부(D01)/01. 사업/근거.pdf");
```

- [ ] **Step 2: Run RED tests**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*FileUploadUnitServiceTest' --tests '*FileServiceTest'`

Expected: compilation failure because relative-path fields do not exist.

- [ ] **Step 3: Add the idempotent Flyway migration**

```sql
DECLARE
    V_COUNT NUMBER;
BEGIN
    SELECT COUNT(*) INTO V_COUNT
      FROM USER_TAB_COLUMNS
     WHERE TABLE_NAME = 'TPRMPP_CFILEM'
       AND COLUMN_NAME = 'APG_FL_PTH';
    IF V_COUNT = 0 THEN
        EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CFILEM ADD (APG_FL_PTH VARCHAR2(255))';
        EXECUTE IMMEDIATE q'[COMMENT ON COLUMN TPRMPP_CFILEM.APG_FL_PTH IS '첨부파일경로']';
    END IF;
END;
/
```

- [ ] **Step 4: Implement entity, request, response, upload, link, and response mapping**

Add `@Column(name = "APG_FL_PTH", length = 255)` to `Cfilem`; copy `request.relativePath` during upload and `source.apgFlPth` during link; map it to `FileDto.Response.relativePath`.

- [ ] **Step 5: Run GREEN tests**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*FileUploadUnitServiceTest' --tests '*FileServiceTest'`

Expected: PASS.

- [ ] **Step 6: Commit Task 1 paths only**

```powershell
git -C C:\it\it_database add migrations/V20260820_001__AddCommonFileRelativePath.sql
git -C C:\it\it_database commit -m "feat: 공통 파일 상대경로 컬럼 추가"
git -C C:\it\it_backend add src/main/java/com/kdb/it/infra/file src/test/java/com/kdb/it/infra/file
git -C C:\it\it_backend commit -m "feat: 공통 파일 상대경로 메타데이터 지원"
```

### Task 2: 반입 상대경로 정규화와 보관

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormRelativePath.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiver.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormRelativePathTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiverTest.java`

**Interfaces:**
- Consumes: `FileDto.UploadRequest.relativePath`
- Produces: `RequestFormRelativePath.normalize(String fileKey, String fileName): String`

- [ ] **Step 1: Write failing path and archiver tests**

```java
assertThat(RequestFormRelativePath.normalize(
        "2026\\IT부(D01)\\01. 사업\\근거.pdf", "근거.pdf"))
        .isEqualTo("2026/IT부(D01)/01. 사업/근거.pdf");
assertThatThrownBy(() -> RequestFormRelativePath.normalize("../secret.pdf", "secret.pdf"))
        .isInstanceOf(CustomGeneralException.class);
assertThat(capturedRequest.getRelativePath())
        .isEqualTo("2026/IT부(D01)/01. 사업/근거.pdf");
```

- [ ] **Step 2: Run RED tests**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*RequestFormRelativePathTest' --tests '*RequestFormSourceFileArchiverTest'`

Expected: FAIL because the normalizer and relative-path request value do not exist.

- [ ] **Step 3: Implement strict normalization**

Normalize separators, reject absolute paths, drive prefixes, control characters and `..`, remove empty/`.` segments, replace the last segment with the physical upload filename, and reject results longer than 255 characters.

- [ ] **Step 4: Pass each archive plan item's `fileKey` to upload metadata**

Extend `ArchivePlanItem` with the full file key and build requests with `.relativePath(RequestFormRelativePath.normalize(item.fileKey(), file.getOriginalFilename()))`. Preserve the normalized value automatically when linking an existing physical file.

- [ ] **Step 5: Run GREEN tests**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*RequestFormRelativePathTest' --tests '*RequestFormSourceFileArchiverTest'`

Expected: PASS.

- [ ] **Step 6: Commit Task 2 paths only**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/migration/request/service/RequestFormRelativePath.java src/main/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiver.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormRelativePathTest.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormSourceFileArchiverTest.java
git -C C:\it\it_backend commit -m "feat: 편성요청서 원본 상대경로 보존"
```

### Task 3: 권한 검증된 원본 ZIP 다운로드 API

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormSourceArchiveRequest.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/request/service/RequestFormSourceArchiveService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/controller/FileController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/request/service/RequestFormSourceArchiveServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java`

**Interfaces:**
- Produces: `POST /api/files/request-form-source/archive`
- Produces: `RequestFormSourceArchiveRequest(String apfMngNo, List<String> fileIds)` where null IDs mean all and an empty list is invalid
- Produces: `writeArchive(RequestFormSourceArchiveRequest request, String userId, OutputStream output)`

- [ ] **Step 1: Write failing service tests for all, selected, invalid, duplicate, and legacy paths**

```java
service.writeArchive(new RequestFormSourceArchiveRequest("APF-1", List.of("FL-2")), "EMP1", out);
assertThat(zipEntries(out)).containsExactly("2026/IT부(D01)/근거.pdf");

assertThatThrownBy(() -> service.writeArchive(
        new RequestFormSourceArchiveRequest("APF-1", List.of("FOREIGN")), "EMP1", out))
        .isInstanceOf(CustomGeneralException.class);
```

Also assert duplicate entry renaming (`근거.pdf`, `근거(2).pdf`), null-relative-path root placement, empty selection rejection, and `PK_COL_NM`/`PK_CONE` constrained lookup.

- [ ] **Step 2: Run RED service tests**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*RequestFormSourceArchiveServiceTest'`

Expected: compilation failure because the archive service does not exist.

- [ ] **Step 3: Implement ZIP streaming service**

Use `FileService.getFiles` with `pkColNm=편성요청서반입`, `pkCone=apfMngNo`, and the current user so existing read authorizers remain the security boundary. Validate requested IDs against that authorized list, obtain each physical resource through `FileService.downloadFile`, and copy it into `ZipOutputStream` using revalidated paths.

- [ ] **Step 4: Write failing MVC contract tests**

```java
mockMvc.perform(post("/api/files/request-form-source/archive")
        .with(csrf())
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"apfMngNo\":\"APF-1\",\"fileIds\":[\"FL-1\"]}"))
    .andExpect(status().isOk())
    .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "application/zip"));
```

- [ ] **Step 5: Add controller streaming response and OpenAPI schema annotations**

Return `StreamingResponseBody`, `Content-Type: application/zip`, and an RFC 5987-safe attachment filename containing the application number. Pass the authenticated user ID explicitly into the service.

- [ ] **Step 6: Run GREEN API tests**

Run: `cd C:\it\it_backend; ./gradlew test --tests '*RequestFormSourceArchiveServiceTest' --tests '*FileControllerTest'`

Expected: PASS.

- [ ] **Step 7: Commit Task 3 paths only**

```powershell
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/migration/request/dto/RequestFormSourceArchiveRequest.java src/main/java/com/kdb/it/domain/migration/request/service/RequestFormSourceArchiveService.java src/main/java/com/kdb/it/infra/file/controller/FileController.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormSourceArchiveServiceTest.java src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java
git -C C:\it\it_backend commit -m "feat: 편성요청서 원본 ZIP 다운로드 추가"
```

### Task 4: 프론트 파일 트리 모델과 다운로드 클라이언트

**Files:**
- Create: `it_frontend/app/utils/requestFormSourceTree.ts`
- Modify: `it_frontend/app/composables/useFiles.ts`
- Test: `it_frontend/tests/unit/utils/requestFormSourceTree.test.ts`
- Test: `it_frontend/tests/unit/composables/useFiles.test.ts`
- Generated: `it_frontend/app/types/api.d.ts`

**Interfaces:**
- Consumes: backend `FileDto.Response.relativePath` and archive endpoint
- Produces: `SourceTreeFolder`, `SourceTreeFile`, `buildSourceFileTree(files)` and `downloadRequestFormSourceArchive(apfMngNo, fileIds?)`

- [ ] **Step 1: Regenerate API types after starting the backend**

Run: `cd C:\it\it_frontend; npm run codegen`

- [ ] **Step 2: Write failing tree tests**

```ts
const tree = buildSourceFileTree([
    file('FL-1', '근거.pdf', '2026/IT부(D01)/01. 사업/근거.pdf'),
    file('FL-2', '기존.hwp', undefined),
]);
expect(tree.folders[0]?.name).toBe('2026');
expect(tree.files.map((item) => item.file.flMpnId)).toEqual(['FL-2']);
expect(filePresentation('양식.HWPX').kind).toBe('hwpx');
```

- [ ] **Step 3: Run RED tree tests**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils/requestFormSourceTree.test.ts`

Expected: FAIL because the utility does not exist.

- [ ] **Step 4: Implement deterministic tree construction and file presentation metadata**

Keep folders before files, compare Korean labels with the active locale only at presentation time, retain stable IDs from full folder paths, and map xls/xlsx/pdf/hwp/hwpx/default icon classes.

- [ ] **Step 5: Write failing archive client test and implement blob download**

Assert POST body `{ apfMngNo, fileIds: null }` for all and `{ apfMngNo, fileIds: ['FL-1'] }` for selected files. Return the Blob and filename to the component; keep DOM anchor creation in a small tested download helper or the caller.

- [ ] **Step 6: Run GREEN frontend utility tests and codegen check**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/utils/requestFormSourceTree.test.ts tests/unit/composables/useFiles.test.ts; npm run codegen:check`

Expected: PASS.

- [ ] **Step 7: Commit Task 4 paths only**

```powershell
git -C C:\it\it_frontend add app/utils/requestFormSourceTree.ts app/composables/useFiles.ts app/types/api.d.ts tests/unit/utils/requestFormSourceTree.test.ts tests/unit/composables/useFiles.test.ts
git -C C:\it\it_frontend commit -m "feat: 반입 원본 파일 트리와 ZIP 클라이언트 추가"
```

### Task 5: 원본 파일 표준 다이얼로그 UI

**Files:**
- Modify: `it_frontend/app/components/migration/RequestFormSourceFiles.vue`
- Modify: `it_frontend/app/components/layout/ApplicationViewerDialog.vue`
- Modify: `it_frontend/i18n/messages/layout.ts`
- Test: `it_frontend/tests/unit/components/migration/RequestFormSourceFiles.test.ts`
- Test: `it_frontend/tests/unit/components/ApplicationViewerDialogMigrated.test.ts`

**Interfaces:**
- Consumes: `buildSourceFileTree`, `downloadRequestFormSourceArchive`
- Produces: `update:selectedFileIds` from `RequestFormSourceFiles`

- [ ] **Step 1: Write failing component tests**

Assert all folders render expanded, nested rows are indented, extension-specific icon classes appear, selecting all marks every file, partial selection sets the header checkbox indeterminate, and selected download is disabled with zero selections.

- [ ] **Step 2: Run RED component tests**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/migration/RequestFormSourceFiles.test.ts tests/unit/components/ApplicationViewerDialogMigrated.test.ts`

Expected: FAIL because tree rows, selection, footer, and archive actions do not exist.

- [ ] **Step 3: Implement the accessible expanded tree**

Use PrimeVue `Checkbox`, semantic buttons for folder toggles, `aria-expanded`, translated labels, depth-based classes/CSS variables, and a local `Set<string>` of expanded folder IDs initialized from every folder ID whenever files change.

- [ ] **Step 4: Add standard footer and downloads to the parent dialog**

Import `AppDialogFooter`; render [닫기], [전체 다운로드], [선택 다운로드]. Maintain selected IDs in the parent, disable selected download when empty, and expose loading state while fetching and saving the ZIP.

- [ ] **Step 5: Add Korean and English copy**

Add stable keys for selection counts, folder expand/collapse, close, all download, selected download, and download failure without increasing the copy-check baseline.

- [ ] **Step 6: Run GREEN component and style tests**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/migration/RequestFormSourceFiles.test.ts tests/unit/components/ApplicationViewerDialogMigrated.test.ts; npm run lint:css; npm run check:copy`

Expected: PASS.

- [ ] **Step 7: Commit Task 5 paths only**

```powershell
git -C C:\it\it_frontend add app/components/migration/RequestFormSourceFiles.vue app/components/layout/ApplicationViewerDialog.vue i18n/messages/layout.ts tests/unit/components/migration/RequestFormSourceFiles.test.ts tests/unit/components/ApplicationViewerDialogMigrated.test.ts
git -C C:\it\it_frontend commit -m "feat: 반입 원본 파일 트리 다이얼로그 개선"
```

### Task 6: 반영 진행 다이얼로그

**Files:**
- Create: `it_frontend/app/components/migration/RequestFormCommitProgressDialog.vue`
- Modify: `it_frontend/app/composables/migration/useRequestFormUpload.ts`
- Modify: `it_frontend/app/pages/admin/migration/requests.vue`
- Modify: `it_frontend/i18n/messages/migration.ts`
- Test: `it_frontend/tests/unit/components/migration/RequestFormCommitProgressDialog.test.ts`
- Test: `it_frontend/tests/unit/composables/migration/useRequestFormUpload.test.ts`
- Test: `it_frontend/tests/unit/pages/requestFormMigrationPageBoundary.test.ts`

**Interfaces:**
- Produces: public readonly `completedBatches`, `totalBatches` from `useRequestFormUpload`
- Produces: progress dialog props `visible`, `state`, `progress`, `completedBatches`, `totalBatches`, `summary`, `errorMessage`

- [ ] **Step 1: Write failing upload-state tests**

Assert the first batch advances `completedBatches`, a later failed batch preserves the last completed count, a new run resets it, and `totalBatches` matches archive-group batching.

- [ ] **Step 2: Run RED upload tests**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/composables/migration/useRequestFormUpload.test.ts`

Expected: FAIL because the counters are not returned and failure clearing behavior is not explicit.

- [ ] **Step 3: Expose readonly batch progress and preserve failure state**

Return `readonly(completedBatches)` and computed `totalBatches`; reset before a run, not in the failure handler. Keep results accumulated from successful batches.

- [ ] **Step 4: Write failing progress dialog tests**

Assert running state renders `ProgressBar` and no close action, succeeded state renders 100% plus summary and [확인], failed state keeps the supplied percentage plus sanitized message and [닫기], and running Dialog disables escape/mask closing.

- [ ] **Step 5: Implement standard progress dialog and page orchestration**

Use `AppDialogHeader`, `AppDialogFooter`, PrimeVue `ProgressBar`, and a discriminated state `'running' | 'succeeded' | 'failed'`. Open before `page.commit()`, transition on resolve/reject, keep the existing success/error Toasts, and close only from terminal states.

- [ ] **Step 6: Add Korean and English copy and pass boundary tests**

Run: `cd C:\it\it_frontend; npm test -- --run tests/unit/components/migration/RequestFormCommitProgressDialog.test.ts tests/unit/composables/migration/useRequestFormUpload.test.ts tests/unit/pages/requestFormMigrationPageBoundary.test.ts; npm run check:copy`

Expected: PASS.

- [ ] **Step 7: Commit Task 6 paths only**

```powershell
git -C C:\it\it_frontend add app/components/migration/RequestFormCommitProgressDialog.vue app/composables/migration/useRequestFormUpload.ts app/pages/admin/migration/requests.vue i18n/messages/migration.ts tests/unit/components/migration/RequestFormCommitProgressDialog.test.ts tests/unit/composables/migration/useRequestFormUpload.test.ts tests/unit/pages/requestFormMigrationPageBoundary.test.ts
git -C C:\it\it_frontend commit -m "feat: 편성요청서 반영 진행 다이얼로그 추가"
```

### Task 7: 사용자 흐름과 전체 회귀 검증

**Files:**
- Modify: `it_frontend/tests/e2e/request-form-migration.spec.ts`
- Modify: `C:\it\versions.lock`

**Interfaces:**
- Consumes: all preceding backend and frontend contracts

- [ ] **Step 1: Extend the E2E fixture with nested PDF/HWP/HWPX files**

Create nested fixture folders under `2026/IT기획부(180)/01. 사업/근거/` and assert the upload flow still reaches dry-run results. Keep commit out of E2E to avoid persistent test data, but cover opening and state transitions of the progress component in unit tests.

- [ ] **Step 2: Run focused E2E**

Run: `cd C:\it\it_frontend; npm run test:e2e -- tests/e2e/request-form-migration.spec.ts`

Expected: PASS with frontend and backend local test servers running.

- [ ] **Step 3: Run backend health stack**

Run: `cd C:\it\it_backend; ./gradlew test; ./gradlew check`

Expected: PASS without new warnings.

- [ ] **Step 4: Run frontend health stack**

Run: `cd C:\it\it_frontend; npm run format:check; npm run check; npm test; npm run lint:css; npm run codegen:check`

Expected: PASS without copy-baseline changes.

- [ ] **Step 5: Update compatible repository versions**

Run: `cd C:\it; ./scripts/update-versions-lock.ps1`

- [ ] **Step 6: Review only task-owned diffs and commit final test/version files**

```powershell
git -C C:\it\it_frontend add tests/e2e/request-form-migration.spec.ts
git -C C:\it\it_frontend commit -m "test: 편성요청서 원본 폴더 흐름 검증"
git -C C:\it add versions.lock
git -C C:\it commit -m "chore: 편성요청서 원본 트리 호환 버전 기록"
```
