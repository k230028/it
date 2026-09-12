# Import Source and Cost Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 편성요청서 수기등록 원본을 일반 첨부 목록에서 전용 다이얼로그로 분리하고, 저장된 전산업무비의 개별 수정 경로에 관리번호 단위 첨부파일 기능을 추가한다.

**Architecture:** 기존 공통 파일 API와 `CFILEM`을 유지하면서 백엔드에 `전산업무비` 파일 종류의 읽기·쓰기 판정기를 등록한다. 프론트엔드는 반입 원본 조회·선택·ZIP 다운로드 상태를 공통 composable과 전용 다이얼로그로 분리하고, 사업 및 전산업무비 상세의 `AttachmentListSection` 헤더 액션에서 이를 연다. 전산업무비 일반 첨부는 `costBgNo`에 연결하고 명시적 개별 저장이 성공한 뒤에만 동기화한다.

**Tech Stack:** Java 25, Spring Boot 4, Spring Data JPA, JUnit 5, Nuxt 4, Vue 3 Composition API, TypeScript, PrimeVue, Vitest, Playwright

**Spec:** `docs/superpowers/specs/done/2026-09-09-import-source-and-cost-attachments-design.md`

## Global Constraints

- 수기등록 상태 코드는 `9`이며 레거시 `09`도 같은 상태로 판정한다.
- 수기등록 항목에는 재상신 기능을 추가하지 않는다.
- 전산업무비 일반 첨부는 `costBgNo`에 연결하여 모든 개정 순번이 공유한다.
- 반입 원본은 `APG_FL_KD_NM=편성요청서반입`, 부모 `apfMngNo` 계약을 유지하며 범용 파일 API로 변경하지 못한다.
- 전산업무비 목록의 인라인 작성·수정, 신규·복수 작성, 연결 신규 단말기에는 첨부 입력을 노출하지 않는다.
- 자동 임시저장과 충돌 대기 중에는 첨부를 동기화하지 않는다.
- 첨부파일 목록은 `AttachmentListSection`, 파일 선택은 `AttachmentUploadField`, 인증 다운로드는 `useAttachmentDownload()`를 사용한다.
- 각 저장소의 기존 dirty 변경은 보존하고 커밋할 경로만 명시적으로 스테이징한다.
- 백엔드 계약을 먼저 완료한 후 프론트엔드 소비 코드를 변경한다.

---

### Task 1: 전산업무비 파일 종류와 서버 권한 등록

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/CostFileReadAuthorizer.java`
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/CostFileTargetWriteAuthorizer.java`
- Create: `it_backend/src/test/java/com/kdb/it/infra/file/authz/CostFileReadAuthorizerTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/infra/file/authz/CostFileTargetWriteAuthorizerTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/FileStoragePathPolicy.java`
- Modify: `it_backend/src/test/java/com/kdb/it/infra/file/FileStoragePathPolicyTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/infra/file/FileReadAuthorizationIT.java`

**Interfaces:**
- Consumes: `CostRepository.findByCostBgNoAndLstYnAndDelYn(String, String, String)`, `BudgetDetailAccessVerifier.isReadable(String, CustomUserDetails)`, `OwnershipVerifier.canModify(String, String, CustomUserDetails)`
- Produces: `CostFileReadAuthorizer.COST_KIND = "전산업무비"`; 파일 레지스트리가 자동 수집하는 읽기·쓰기 판정기; 물리 폴더 별칭 `it-costs`

- [ ] **Step 1: 읽기 판정기의 실패 테스트를 작성한다**

```java
class CostFileReadAuthorizerTest {
    private static final String COST = "COST-2026-0001";
    private final CostRepository repository = mock(CostRepository.class);
    private final CostFileReadAuthorizer authorizer = new CostFileReadAuthorizer(repository);

    @Test
    void sameDepartmentAndItOrganizationCanReadCurrentCost() {
        given(repository.findByCostBgNoAndLstYnAndDelYn(COST, "Y", "N"))
                .willReturn(Optional.of(Bcostm.builder()
                        .costBgNo(COST).bgSno(2).costSvnDpmC("29001").build()));

        assertThat(authorizer.canRead(file(COST), user("E001", "29001"))).isTrue();
        assertThat(authorizer.canRead(file(COST), user("E002", "180"))).isTrue();
        assertThat(authorizer.canRead(file(COST), user("E003", "39001"))).isFalse();
    }

    @Test
    void missingParentAndAnonymousAreDenied() {
        given(repository.findByCostBgNoAndLstYnAndDelYn(COST, "Y", "N"))
                .willReturn(Optional.empty());
        assertThat(authorizer.canRead(file(COST), user("E001", "180"))).isFalse();
        assertThat(authorizer.canRead(file(COST), null)).isFalse();
    }
}
```

- [ ] **Step 2: 쓰기 판정기와 파일 경로의 실패 테스트를 작성한다**

```java
@Test
void ownerSameDepartmentAndAdminCanWriteButUnrelatedUserCannot() {
    givenCurrentCost("OWNER", "29001");
    assertThat(authorizer.canWrite(COST, user("OWNER", "39001"))).isTrue();
    assertThat(authorizer.canWrite(COST, user("OTHER", "29001"))).isTrue();
    assertThat(authorizer.canWrite(COST, admin())).isTrue();
    assertThat(authorizer.canWrite(COST, user("OTHER", "39001"))).isFalse();
    assertThat(authorizer.allowsGenericMutation()).isTrue();
}

@Test
void costKindUsesSafeEnglishDirectory() {
    assertThat(FileStoragePathPolicy.directoryName("전산업무비")).isEqualTo("it-costs");
}
```

- [ ] **Step 3: 대상 테스트를 실행해 새 클래스와 경로가 없어 실패하는지 확인한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*CostFileReadAuthorizerTest' --tests '*CostFileTargetWriteAuthorizerTest' --tests '*FileStoragePathPolicyTest'
```

Expected: `CostFileReadAuthorizer`, `CostFileTargetWriteAuthorizer` 또는 `전산업무비` 경로 매핑 부재로 FAIL.

- [ ] **Step 4: 읽기·쓰기 판정기와 저장 경로를 구현한다**

```java
@Component
@RequiredArgsConstructor
public class CostFileReadAuthorizer implements FileReadAuthorizer {
    public static final String COST_KIND = "전산업무비";
    private final CostRepository costRepository;

    @Override
    public Set<String> supportedApgFlKdNms() {
        return Set.of(COST_KIND);
    }

    @Override
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        if (user == null || file == null || !StringUtils.hasText(file.getApgFlLnkCtzNm())) {
            return false;
        }
        return costRepository
                .findByCostBgNoAndLstYnAndDelYn(file.getApgFlLnkCtzNm(), "Y", "N")
                .map(cost -> BudgetDetailAccessVerifier.isReadable(cost.getCostSvnDpmC(), user))
                .orElse(false);
    }
}
```

```java
@Component
@RequiredArgsConstructor
public class CostFileTargetWriteAuthorizer implements FileTargetWriteAuthorizer {
    private final CostRepository costRepository;

    @Override
    public Set<String> supportedApgFlKdNms() {
        return Set.of(CostFileReadAuthorizer.COST_KIND);
    }

    @Override
    public boolean allowsGenericMutation() {
        return true;
    }

    @Override
    public boolean canWrite(String parentId, CustomUserDetails user) {
        if (user == null || !StringUtils.hasText(parentId)) return false;
        return costRepository.findByCostBgNoAndLstYnAndDelYn(parentId, "Y", "N")
                .map(cost -> OwnershipVerifier.canModify(
                        cost.getFstEnrUsid(), cost.getCostSvnDpmC(), user))
                .orElse(false);
    }
}
```

Add `Map.entry("전산업무비", "it-costs")` to `FileStoragePathPolicy`. Update the integration test's known-kind constants, cleanup for `TPRMPP_BCOSTM`, cost fixture insert helper, and quarantine allowlist so `전산업무비` is tested as a registered kind rather than an unknown row.

- [ ] **Step 5: 백엔드 대상 테스트를 실행해 통과하는지 확인한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test --tests '*CostFileReadAuthorizerTest' --tests '*CostFileTargetWriteAuthorizerTest' --tests '*FileStoragePathPolicyTest' --tests '*FileTargetWriteAuthorizerRegistryTest' --tests '*FileReadAuthorizerRegistryTest'
```

Expected: PASS.

- [ ] **Step 6: 백엔드 변경만 커밋한다**

```powershell
cd C:\it\it_backend
git add -- src/main/java/com/kdb/it/infra/file/authz/CostFileReadAuthorizer.java src/main/java/com/kdb/it/infra/file/authz/CostFileTargetWriteAuthorizer.java src/main/java/com/kdb/it/infra/file/FileStoragePathPolicy.java src/test/java/com/kdb/it/infra/file/authz/CostFileReadAuthorizerTest.java src/test/java/com/kdb/it/infra/file/authz/CostFileTargetWriteAuthorizerTest.java src/test/java/com/kdb/it/infra/file/FileStoragePathPolicyTest.java src/test/java/com/kdb/it/infra/file/FileReadAuthorizationIT.java
git diff --cached --check
git commit -m "feat: 전산업무비 첨부 권한 등록"
```

---

### Task 2: 반입 원본 공통 상태와 전용 다이얼로그 분리

**Files:**
- Create: `it_frontend/app/composables/migration/useRequestFormSourceFiles.ts`
- Create: `it_frontend/app/components/migration/RequestFormSourceFilesDialog.vue`
- Create: `it_frontend/tests/unit/composables/migration/useRequestFormSourceFiles.test.ts`
- Create: `it_frontend/tests/unit/components/migration/RequestFormSourceFilesDialog.test.ts`
- Modify: `it_frontend/app/components/migration/RequestFormSourceFiles.vue`
- Modify: `it_frontend/tests/unit/components/migration/RequestFormSourceFiles.test.ts`
- Modify: `it_frontend/i18n/messages/layout.ts`

**Interfaces:**
- Consumes: `useFiles().fetchFilesBatch('편성요청서반입', [apfMngNo])`, `useFiles().downloadRequestFormSourceArchive(apfMngNo, fileIds)`, `useAttachmentDownload().downloadAttachment(file)`
- Produces: `useRequestFormSourceFiles()` with `files`, `selectedFileIds`, `loading`, `loadFailed`, `downloadAction`, `isDownloading`, `load(apfMngNo)`, `reset()`, `download(apfMngNo, action)`; `<RequestFormSourceFilesDialog v-model:visible apf-mng-no>`

- [ ] **Step 1: 공통 상태의 지연 조회·stale 응답·다운로드 실패 테스트를 작성한다**

```ts
it('마지막으로 요청한 신청서의 파일만 반영한다', async () => {
    const first = deferred<Record<string, FileRecord[]>>();
    fetchFilesBatch.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ B: [fileB] });
    const source = useRequestFormSourceFiles();

    const loadA = source.load('A');
    await source.load('B');
    first.resolve({ A: [fileA] });
    await loadA;

    expect(source.files.value).toEqual([fileB]);
});

it('선택 다운로드는 선택한 파일 ID만 전달한다', async () => {
    const source = useRequestFormSourceFiles();
    source.selectedFileIds.value = ['FL-2'];
    await source.download('APF-1', 'selected');
    expect(downloadRequestFormSourceArchive).toHaveBeenCalledWith('APF-1', ['FL-2']);
});
```

- [ ] **Step 2: 전용 다이얼로그와 단건 인증 다운로드의 실패 테스트를 작성한다**

```ts
it('열릴 때만 조회하고 실패하면 다시 시도 버튼을 제공한다', async () => {
    const wrapper = mount(RequestFormSourceFilesDialog, {
        props: { visible: false, apfMngNo: 'APF-1' },
    });
    expect(load).not.toHaveBeenCalled();
    await wrapper.setProps({ visible: true });
    expect(load).toHaveBeenCalledWith('APF-1');
    expect(wrapper.get('[data-testid="source-retry"]').exists()).toBe(true);
});

it('파일명 클릭은 인증 다운로드 composable을 사용한다', async () => {
    const wrapper = mountSourceFiles([fileA]);
    await wrapper.get('[data-testid="source-file-download-FL-1"]').trigger('click');
    expect(downloadAttachment).toHaveBeenCalledWith(fileA);
});
```

- [ ] **Step 3: 프론트 대상 테스트를 실행해 실패를 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/composables/migration/useRequestFormSourceFiles.test.ts tests/unit/components/migration/RequestFormSourceFilesDialog.test.ts tests/unit/components/migration/RequestFormSourceFiles.test.ts
```

Expected: 새 composable·다이얼로그 부재와 기존 `<a href>` 다운로드 때문에 FAIL.

- [ ] **Step 4: 반입 원본 공통 상태를 구현한다**

```ts
export const REQUEST_FORM_SOURCE_KIND = '편성요청서반입';
export type SourceDownloadAction = 'all' | 'selected';

export const useRequestFormSourceFiles = () => {
    const { fetchFilesBatch, downloadRequestFormSourceArchive } = useFiles();
    const toast = useToast();
    const { t } = useI18n({ useScope: 'global' });
    const files = ref<FileRecord[]>([]);
    const selectedFileIds = ref<string[]>([]);
    const loading = ref(false);
    const loadFailed = ref(false);
    const downloadAction = ref<SourceDownloadAction | null>(null);
    let generation = 0;
    let downloadGeneration = 0;

    const reset = () => {
        generation += 1;
        downloadGeneration += 1;
        files.value = [];
        selectedFileIds.value = [];
        loading.value = false;
        loadFailed.value = false;
        downloadAction.value = null;
    };

    const load = async (apfMngNo: string) => {
        const current = ++generation;
        files.value = [];
        selectedFileIds.value = [];
        loadFailed.value = false;
        loading.value = true;
        try {
            const grouped = await fetchFilesBatch(REQUEST_FORM_SOURCE_KIND, [apfMngNo]);
            if (current === generation) files.value = grouped[apfMngNo] ?? [];
        } catch (error) {
            if (current === generation) loadFailed.value = true;
        } finally {
            if (current === generation) loading.value = false;
        }
    };

    const download = async (apfMngNo: string, action: SourceDownloadAction) => {
        const fileIds = action === 'selected' ? [...selectedFileIds.value] : undefined;
        if (!apfMngNo || downloadAction.value || (action === 'selected' && fileIds?.length === 0)) {
            return;
        }
        const current = ++downloadGeneration;
        downloadAction.value = action;
        try {
            const { blob, fileName } = await downloadRequestFormSourceArchive(apfMngNo, fileIds);
            if (current !== downloadGeneration) return;
            const url = URL.createObjectURL(blob);
            try {
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = fileName;
                anchor.click();
            } finally {
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            if (current !== downloadGeneration) return;
            toast.add({
                severity: 'error',
                summary: t('layout.viewer.downloadFailedTitle'),
                detail: t('layout.viewer.downloadFailed'),
                life: TOAST_LIFE.ERROR,
            });
        } finally {
            if (current === downloadGeneration) downloadAction.value = null;
        }
    };

    return { files, selectedFileIds, loading, loadFailed, downloadAction,
        isDownloading: computed(() => downloadAction.value !== null), load, reset, download };
};
```

- [ ] **Step 5: 전용 다이얼로그와 인증 단건 다운로드를 구현한다**

```vue
<RequestFormSourceFiles
    v-else-if="!source.loadFailed.value"
    v-model:selected-file-ids="source.selectedFileIds.value"
    :files="source.files.value"
/>
<Message v-else severity="error" :closable="false">
    {{ t('layout.viewer.sourceFilesFailed') }}
    <Button data-testid="source-retry" :label="t('common.actions.retry')" @click="source.load(apfMngNo)" />
</Message>
```

Remove `getDownloadUrl` from `RequestFormSourceFiles.vue` and replace the current file-name anchor with this authenticated action:

```vue
<button
    type="button"
    :data-testid="`source-file-download-${row.source.id}`"
    :title="t('layout.viewer.sourceFileDownload', { name: row.source.file.flNm })"
    class="truncate font-medium text-primary hover:underline"
    @click="downloadAttachment(row.source.file)"
>
    {{ row.source.file.flNm }}
</button>
```

- [ ] **Step 6: 대상 테스트와 포맷 검사를 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/composables/migration/useRequestFormSourceFiles.test.ts tests/unit/components/migration/RequestFormSourceFilesDialog.test.ts tests/unit/components/migration/RequestFormSourceFiles.test.ts
npx prettier --check app/composables/migration/useRequestFormSourceFiles.ts app/components/migration/RequestFormSourceFilesDialog.vue app/components/migration/RequestFormSourceFiles.vue tests/unit/composables/migration/useRequestFormSourceFiles.test.ts tests/unit/components/migration/RequestFormSourceFilesDialog.test.ts tests/unit/components/migration/RequestFormSourceFiles.test.ts i18n/messages/layout.ts
```

Expected: PASS.

- [ ] **Step 7: 공통 반입 원본 변경만 커밋한다**

```powershell
cd C:\it\it_frontend
git add -- app/composables/migration/useRequestFormSourceFiles.ts app/components/migration/RequestFormSourceFilesDialog.vue app/components/migration/RequestFormSourceFiles.vue tests/unit/composables/migration/useRequestFormSourceFiles.test.ts tests/unit/components/migration/RequestFormSourceFilesDialog.test.ts tests/unit/components/migration/RequestFormSourceFiles.test.ts i18n/messages/layout.ts
git diff --cached --check
git commit -m "refactor: 반입 원본 파일 다이얼로그 분리"
```

---

### Task 3: 신청서 뷰어를 공통 반입 원본 상태로 전환

**Files:**
- Modify: `it_frontend/app/components/layout/ApplicationViewerDialog.vue`
- Modify: `it_frontend/tests/unit/components/ApplicationViewerDialogMigrated.test.ts`

**Interfaces:**
- Consumes: Task 2의 `useRequestFormSourceFiles()`
- Produces: 일반 신청서는 기존 PDF, 수기등록 신청서는 공통 원본 상태로 렌더링하는 `ApplicationViewerDialog`

- [ ] **Step 1: 기존 뷰어가 공통 composable을 사용하는지 검증하는 실패 테스트를 추가한다**

```ts
it('수기등록 신청서는 공통 원본 상태를 로드하고 닫을 때 초기화한다', async () => {
    const wrapper = mountViewer({ visible: true, apfMngNo: 'APF-1' });
    await flushPromises();
    expect(source.load).toHaveBeenCalledWith('APF-1');
    await wrapper.setProps({ visible: false });
    expect(source.reset).toHaveBeenCalled();
});
```

- [ ] **Step 2: 테스트를 실행해 직접 `useFiles()` 구현 때문에 실패하는지 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/components/ApplicationViewerDialogMigrated.test.ts
```

Expected: 공통 composable 호출이 없어 FAIL.

- [ ] **Step 3: 수기등록 분기의 조회·선택·ZIP 상태를 공통 composable로 교체한다**

```ts
const source = useRequestFormSourceFiles();

if (approval?.migrated || isManualRegistration(approval?.apfStsC)) {
    isMigrated.value = true;
    await source.load(apfMngNo);
    if (!isCurrent()) source.reset();
    return;
}
```

Template의 `sourceFiles`, `selectedFileIds`, `downloadAction`, `downloadSourceArchive` 참조를 `source.files.value`, `source.selectedFileIds.value`, `source.downloadAction.value`, `source.download(props.apfMngNo, action)`으로 교체한다. 닫기·unmount·신청서 변경 시 `source.reset()`을 호출하고 PDF URL 소유권 처리는 그대로 유지한다.

- [ ] **Step 4: 뷰어 회귀 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/components/ApplicationViewerDialogMigrated.test.ts tests/unit/components/migration/RequestFormSourceFilesDialog.test.ts
```

Expected: PASS.

- [ ] **Step 5: 신청서 뷰어 변경만 커밋한다**

```powershell
cd C:\it\it_frontend
git add -- app/components/layout/ApplicationViewerDialog.vue tests/unit/components/ApplicationViewerDialogMigrated.test.ts
git diff --cached --check
git commit -m "refactor: 신청서 뷰어 원본 상태 공통화"
```

---

### Task 4: 사업 상세의 일반 첨부와 반입 원본 분리

**Files:**
- Modify: `it_frontend/app/components/common/AttachmentListSection.vue`
- Modify: `it_frontend/tests/unit/components/common/AttachmentListSection.test.ts`
- Modify: `it_frontend/app/composables/useProjectDetailPage.ts`
- Modify: `it_frontend/tests/unit/composables/useProjectDetailPage.test.ts`
- Modify: `it_frontend/app/components/projects/ProjectDetailSections.vue`
- Modify: `it_frontend/tests/unit/components/projects/ProjectDetailSections.test.ts`
- Modify: `it_frontend/tests/unit/pages/project-domain-i18n.test.ts`

**Interfaces:**
- Consumes: Task 2의 `RequestFormSourceFilesDialog`; 기존 `isManualRegistration()`; 기존 사업 직접 첨부 조회
- Produces: `AttachmentListSection`의 `#header-actions` 슬롯; 사업 상세 모델의 `attachmentFiles`, `attachmentLoading`, `attachmentRefreshFailed`, `attachmentRefreshFailureDetail`, `retryAttachments`

- [ ] **Step 1: 헤더 액션 슬롯과 일반 첨부 건수 테스트를 작성한다**

```ts
it('헤더 액션을 제목 옆에 렌더링하되 파일 건수에는 영향을 주지 않는다', () => {
    const wrapper = mount(AttachmentListSection, {
        props: { files: [attachment('F1', '직접첨부.pdf', '정보화사업')] },
        slots: { 'header-actions': '<button data-testid="source-icon">원본</button>' },
    });
    expect(wrapper.get('[data-testid="source-icon"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('1건');
});
```

- [ ] **Step 2: 사업 상세에서 원본이 직접 목록에 나오지 않고 상태 9 아이콘만 나오는 테스트를 작성한다**

```ts
it('수기등록 사업은 직접 첨부만 표시하고 원본 아이콘으로 다이얼로그를 연다', async () => {
    const wrapper = mountProjectDetail({ apfStsC: '9', apfMngNo: 'APF-1' }, [projectFile]);
    expect(wrapper.getComponent(AttachmentListSection).props('files')).toEqual([projectFile]);
    await wrapper.get('[data-testid="request-form-source-button"]').trigger('click');
    expect(wrapper.getComponent(RequestFormSourceFilesDialog).props()).toMatchObject({
        visible: true,
        apfMngNo: 'APF-1',
    });
});
```

- [ ] **Step 3: 관련 테스트를 실행해 현재 두 그룹 표시 때문에 실패하는지 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/components/common/AttachmentListSection.test.ts tests/unit/composables/useProjectDetailPage.test.ts tests/unit/components/projects/ProjectDetailSections.test.ts tests/unit/pages/project-domain-i18n.test.ts
```

Expected: `header-actions` 슬롯과 직접 첨부 전용 모델 부재로 FAIL.

- [ ] **Step 4: 헤더 슬롯과 사업 직접 첨부 전용 모델을 구현한다**

```vue
<h3 class="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-6">
    <i class="pi pi-paperclip text-indigo-500" />
    {{ title ?? t('common.attachments.title') }}
    <span v-if="totalCount > 0">{{ t('common.units.items', { count: totalCount }) }}</span>
    <slot name="header-actions" />
</h3>
```

`useProjectDetailPage`에서 `useProjectRequestFormFiles`, `attachmentGroups`, 그룹별 재시도를 제거하고 사업 직접 첨부 상태를 개별 반환한다.

```ts
return {
    attachmentFiles: projectAttachments.files,
    attachmentLoading: projectAttachments.pending,
    attachmentRefreshFailed: projectAttachments.refreshFailed,
    attachmentRefreshFailureDetail: projectAttachments.refreshFailureDetail,
    retryAttachments: projectAttachments.retryLoadFiles,
};
```

- [ ] **Step 5: 사업 상세에 아이콘과 전용 다이얼로그를 연결한다**

```vue
<AttachmentListSection :files="attachmentFiles" :loading="attachmentLoading" @retry="retryAttachments">
    <template #header-actions>
        <Button
            v-if="isManual && project.apfMngNo"
            data-testid="request-form-source-button"
            icon="pi pi-folder-open"
            text
            rounded
            :aria-label="t('layout.viewer.sourceFilesTitle')"
            v-tooltip.top="t('layout.viewer.sourceFilesTitle')"
            @click="sourceDialogVisible = true"
        />
    </template>
</AttachmentListSection>
<RequestFormSourceFilesDialog
    v-model:visible="sourceDialogVisible"
    :apf-mng-no="project.apfMngNo ?? ''"
/>
```

- [ ] **Step 6: 사업 상세 회귀 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/components/common/AttachmentListSection.test.ts tests/unit/composables/useProjectDetailPage.test.ts tests/unit/components/projects/ProjectDetailSections.test.ts tests/unit/pages/project-domain-i18n.test.ts
```

Expected: PASS.

- [ ] **Step 7: 사업 상세 분리 변경만 커밋한다**

```powershell
cd C:\it\it_frontend
git add -- app/components/common/AttachmentListSection.vue app/composables/useProjectDetailPage.ts app/components/projects/ProjectDetailSections.vue tests/unit/components/common/AttachmentListSection.test.ts tests/unit/composables/useProjectDetailPage.test.ts tests/unit/components/projects/ProjectDetailSections.test.ts tests/unit/pages/project-domain-i18n.test.ts
git diff --cached --check
git commit -m "feat: 사업 반입 원본을 첨부 목록에서 분리"
```

---

### Task 5: 전산업무비 일반 첨부 상태와 수정 필드 구현

**Files:**
- Create: `it_frontend/app/features/cost/useCostAttachments.ts`
- Create: `it_frontend/tests/unit/features/cost/useCostAttachments.test.ts`
- Create: `it_frontend/app/components/cost/CostFormAttachmentSection.vue`
- Create: `it_frontend/tests/unit/components/cost/CostFormAttachmentSection.test.ts`
- Modify: `it_frontend/i18n/messages/cost.ts`

**Interfaces:**
- Consumes: `useFiles().uploadFilesBulk`, `useFiles().deleteFile`, `AttachmentUploadField`, `useRefreshGuard`
- Produces: `COST_ATTACHMENT_KIND = '전산업무비'`; `useCostAttachmentList(costBgNo)`; `useCostAttachmentEditor(costBgNo)`; `CostAttachmentSyncResult`; `CostFormAttachmentSection`

- [ ] **Step 1: 조회와 동기화 상태의 실패 테스트를 작성한다**

```ts
it('costBgNo를 부모로 전산업무비 파일만 조회한다', async () => {
    const api = useCostAttachmentList(ref('COST-1'));
    await flushPromises();
    expect(useApiFetch).toHaveBeenCalledWith(expect.stringContaining('/api/files'),
        expect.objectContaining({ query: expect.anything() }));
    expect(readQuery()).toEqual({ apgFlKdNm: '전산업무비', apgFlLnkCtzNm: 'COST-1' });
});

it('부분 실패 파일만 다음 저장 선택에 남긴다', async () => {
    uploadFilesBulk.mockResolvedValue({ successList: [], failList: ['b.pdf'] });
    const editor = useCostAttachmentEditor(ref('COST-1'));
    editor.pendingFiles.value = [file('a.pdf'), file('b.pdf')];
    const result = await editor.syncAttachments('COST-1');
    expect(result.failedFiles).toEqual(['b.pdf']);
    expect(editor.pendingFiles.value.map((item) => item.name)).toEqual(['b.pdf']);
});
```

- [ ] **Step 2: 수정 필드의 표시·삭제 예약·실패 배너 테스트를 작성한다**

```ts
it('공통 업로드 필드에 기존·신규·삭제 예약 상태를 연결한다', async () => {
    const wrapper = mount(CostFormAttachmentSection, {
        props: { existingFiles: [saved], deletedFileIds: [], modelValue: [] },
    });
    await wrapper.getComponent(AttachmentUploadField).vm.$emit('markDelete', 'FL-1');
    expect(wrapper.emitted('markDelete')).toEqual([['FL-1']]);
});
```

- [ ] **Step 3: 새 테스트를 실행해 구현 부재로 실패하는지 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/features/cost/useCostAttachments.test.ts tests/unit/components/cost/CostFormAttachmentSection.test.ts
```

Expected: 새 파일과 export가 없어 FAIL.

- [ ] **Step 4: 전산업무비 첨부 composable을 구현한다**

```ts
export const COST_ATTACHMENT_KIND = '전산업무비';

export interface CostAttachmentSyncResult {
    failedFiles: string[];
}

export const useCostAttachmentEditor = (costBgNo: MaybeRefOrGetter<string>) => {
    const list = useCostAttachmentList(costBgNo);
    const pendingFiles = ref<File[]>([]);
    const deletedFileIds = ref<string[]>([]);

    const syncAttachments = async (savedCostBgNo: string): Promise<CostAttachmentSyncResult> => {
        if (!savedCostBgNo) throw new Error(t('cost.attachments.missingCostId'));
        for (const id of [...deletedFileIds.value]) {
            await deleteFile(id);
            deletedFileIds.value = deletedFileIds.value.filter((value) => value !== id);
        }
        if (pendingFiles.value.length === 0) {
            await list.refreshFiles();
            return { failedFiles: [] };
        }
        const targets = [...pendingFiles.value];
        const result = await uploadFilesBulk(targets, '첨부파일', savedCostBgNo, COST_ATTACHMENT_KIND);
        const failedFiles = normalizeBoardUploadFailures(targets, result.failList);
        pendingFiles.value = targets.filter((file) => failedFiles.includes(file.name));
        await list.refreshFiles();
        return { failedFiles };
    };

    return { ...list, pendingFiles, deletedFileIds, markDelete, unmarkDelete, syncAttachments };
};
```

조회 실패는 사업 첨부와 같은 `useRefreshGuard` 계약을 사용하되 번역 키는 `cost.attachments.*`로 분리한다.

- [ ] **Step 5: 공통 업로드 필드를 감싼 전산업무비 수정 섹션을 구현한다**

```vue
<AttachmentUploadField
    v-model="pendingFiles"
    :existing-files="existingFiles"
    :deleted-file-ids="deletedFileIds"
    :disabled="disabled"
    :title="t('cost.attachments.title')"
    :help="t('cost.attachments.help')"
    input-test-id="cost-attachment-input"
    @mark-delete="emit('markDelete', $event)"
    @unmark-delete="emit('unmarkDelete', $event)"
/>
```

- [ ] **Step 6: 새 단위 테스트와 포맷 검사를 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/features/cost/useCostAttachments.test.ts tests/unit/components/cost/CostFormAttachmentSection.test.ts
npx prettier --check app/features/cost/useCostAttachments.ts app/components/cost/CostFormAttachmentSection.vue tests/unit/features/cost/useCostAttachments.test.ts tests/unit/components/cost/CostFormAttachmentSection.test.ts i18n/messages/cost.ts
```

Expected: PASS.

- [ ] **Step 7: 전산업무비 첨부 기반만 커밋한다**

```powershell
cd C:\it\it_frontend
git add -- app/features/cost/useCostAttachments.ts app/components/cost/CostFormAttachmentSection.vue tests/unit/features/cost/useCostAttachments.test.ts tests/unit/components/cost/CostFormAttachmentSection.test.ts i18n/messages/cost.ts
git diff --cached --check
git commit -m "feat: 전산업무비 첨부 상태 추가"
```

---

### Task 6: 전산업무비와 금융정보단말기 상세에 첨부 조회 추가

**Files:**
- Modify: `it_frontend/app/pages/info/cost/[id].vue`
- Modify: `it_frontend/app/components/cost/CostDetailSections.vue`
- Modify: `it_frontend/app/composables/cost/useCostDetailToc.ts`
- Modify: `it_frontend/app/pages/info/cost/terminal/[id].vue`
- Modify: `it_frontend/tests/unit/components/cost/CostDetailSections.test.ts`
- Modify: `it_frontend/tests/unit/composables/cost/useCostDetailToc.test.ts`
- Create: `it_frontend/tests/unit/pages/costAttachmentDetailBoundaries.test.ts`

**Interfaces:**
- Consumes: Task 2의 `RequestFormSourceFilesDialog`, Task 4의 `AttachmentListSection#header-actions`, Task 5의 `useCostAttachmentList`, `isManualRegistration()`
- Produces: 일반·단말기 상세의 직접 첨부 목록, 수기등록 반입 원본 아이콘, 일반 상세 목차의 `section-attachments`

- [ ] **Step 1: 일반 상세의 첨부 목차와 수기등록 아이콘 테스트를 작성한다**

```ts
it('첨부파일 목차를 항상 마지막 본문 항목으로 제공한다', () => {
    expect(api.tocItems.value.at(-1)).toMatchObject({
        id: 'section-attachments',
        icon: 'pi pi-paperclip',
    });
});

it('수기등록 전산업무비는 직접 첨부와 원본 아이콘을 분리한다', async () => {
    const wrapper = mountCostDetail(cost({ apfStsC: '9', apfMngNo: 'APF-9' }), [directFile]);
    expect(wrapper.getComponent(AttachmentListSection).props('files')).toEqual([directFile]);
    await wrapper.get('[data-testid="request-form-source-button"]').trigger('click');
    expect(wrapper.getComponent(RequestFormSourceFilesDialog).props('apfMngNo')).toBe('APF-9');
});
```

- [ ] **Step 2: 단말기 상세도 같은 목록과 아이콘을 구성하는 경계 테스트를 작성한다**

```ts
it('금융정보단말기 상세는 첨부 목록과 원본 다이얼로그를 포함한다', () => {
    const source = readSource('app/pages/info/cost/terminal/[id].vue');
    expect(source).toContain('useCostAttachmentList');
    expect(source).toContain('<AttachmentListSection');
    expect(source).toContain('<RequestFormSourceFilesDialog');
});
```

- [ ] **Step 3: 상세 관련 테스트를 실행해 실패를 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/components/cost/CostDetailSections.test.ts tests/unit/composables/cost/useCostDetailToc.test.ts tests/unit/pages/costAttachmentDetailBoundaries.test.ts
```

Expected: 첨부 section과 원본 다이얼로그가 없어 FAIL.

- [ ] **Step 4: 일반 전산업무비 상세의 상태·목차·렌더링을 연결한다**

```ts
const attachments = useCostAttachmentList(() => cost.value?.costBgNo ?? '');
const attachmentDisplay = {
    files: attachments.files,
    loading: attachments.pending,
    refreshFailed: attachments.refreshFailed,
    refreshFailureDetail: attachments.refreshFailureDetail,
    retry: attachments.retryLoadFiles,
};
```

`CostDetailSections`에 이 display model을 전달하고 `section-attachments` 카드에서 직접 파일만 렌더링한다. `isManualRegistration(cost.apfStsC) && cost.apfMngNo`일 때 헤더 아이콘을 노출하고 전용 다이얼로그를 연다.

- [ ] **Step 5: 금융정보단말기 상세에 동일한 조회 계약을 연결한다**

```vue
<AttachmentListSection
    :files="attachments.files.value"
    :loading="attachments.pending.value"
    :title="t('cost.attachments.title')"
    @retry="attachments.retryLoadFiles"
>
    <template #header-actions>
        <Button v-if="showSourceFiles" data-testid="request-form-source-button"
            icon="pi pi-folder-open" text rounded @click="sourceDialogVisible = true" />
    </template>
</AttachmentListSection>
```

- [ ] **Step 6: 상세 관련 테스트를 재실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/components/cost/CostDetailSections.test.ts tests/unit/composables/cost/useCostDetailToc.test.ts tests/unit/pages/costAttachmentDetailBoundaries.test.ts
```

Expected: PASS.

- [ ] **Step 7: 상세 화면 변경만 커밋한다**

```powershell
cd C:\it\it_frontend
git add -- 'app/pages/info/cost/[id].vue' app/components/cost/CostDetailSections.vue app/composables/cost/useCostDetailToc.ts 'app/pages/info/cost/terminal/[id].vue' tests/unit/components/cost/CostDetailSections.test.ts tests/unit/composables/cost/useCostDetailToc.test.ts tests/unit/pages/costAttachmentDetailBoundaries.test.ts
git diff --cached --check
git commit -m "feat: 전산업무비 상세 첨부 조회 추가"
```

---

### Task 7: 일반 전산업무비 개별 저장에 첨부 동기화 연결

**Files:**
- Modify: `it_frontend/app/pages/info/cost/form.vue`
- Modify: `it_frontend/app/composables/cost/useCostFormSave.ts`
- Modify: `it_frontend/tests/unit/composables/cost/useCostFormSave.test.ts`
- Create: `it_frontend/tests/unit/pages/costAttachmentFormBoundaries.test.ts`

**Interfaces:**
- Consumes: Task 5의 `useCostAttachmentEditor`와 `CostFormAttachmentSection`
- Produces: `useCostFormSave`의 선택적 `syncAttachments(costBgNo)` 의존성; 명시적 저장 및 충돌 해결 성공 뒤 첨부 동기화

- [ ] **Step 1: 자동저장과 충돌 중 첨부를 처리하지 않는 실패 테스트를 작성한다**

```ts
it('백그라운드 자동저장은 첨부를 동기화하지 않는다', async () => {
    const api = createSave({ syncAttachments });
    await api.saveCosts(false, { background: true });
    expect(updateCost).toHaveBeenCalled();
    expect(syncAttachments).not.toHaveBeenCalled();
});

it('최초 PUT 충돌에서는 첨부를 보류하고 해결 저장 성공 뒤 한 번 처리한다', async () => {
    updateCost.mockRejectedValueOnce(sourceChanged).mockResolvedValueOnce({});
    const api = createSave({ syncAttachments });
    await api.saveCosts(true);
    expect(syncAttachments).not.toHaveBeenCalled();
    await api.resolveConflict(choices);
    expect(syncAttachments).toHaveBeenCalledTimes(1);
    expect(syncAttachments).toHaveBeenCalledWith('COST-1');
});
```

- [ ] **Step 2: 부분 실패와 화면 모드 경계의 실패 테스트를 작성한다**

```ts
it('첨부 부분 실패는 전체 저장 성공으로 이동하지 않는다', async () => {
    syncAttachments.mockResolvedValue({ failedFiles: ['계약서.pdf'] });
    const api = createSave({ syncAttachments });
    expect(await api.saveCosts(true)).toBe(false);
    expect(confirm.require).not.toHaveBeenCalled();
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn' }));
});

it('단건 수정에서만 첨부 입력을 렌더링한다', () => {
    const source = readSource('app/pages/info/cost/form.vue');
    expect(source).toContain('v-if="isEditSingle"');
    expect(source).toContain('<CostFormAttachmentSection');
});
```

- [ ] **Step 3: 저장 관련 테스트를 실행해 실패를 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/composables/cost/useCostFormSave.test.ts tests/unit/pages/costAttachmentFormBoundaries.test.ts
```

Expected: `syncAttachments` 의존성과 첨부 섹션 부재로 FAIL.

- [ ] **Step 4: 명시적 저장 전용 첨부 적용 헬퍼를 추가한다**

```ts
const applyAttachments = async (costBgNo: string): Promise<boolean> => {
    if (!ctx.syncAttachments) return true;
    try {
        const { failedFiles } = await ctx.syncAttachments(costBgNo);
        if (failedFiles.length === 0) return true;
        ctx.toast.add({
            severity: 'warn',
            summary: t('cost.attachments.partialFailure'),
            detail: t('cost.attachments.partialFailureDetail', { names: failedFiles.join(', ') }),
            life: 5000,
        });
        return false;
    } catch (error) {
        ctx.toast.add({
            severity: 'error',
            summary: t('cost.attachments.syncFailure'),
            detail: t('cost.attachments.bodySavedSyncFailed'),
            life: 5000,
        });
        return false;
    }
};
```

`PendingConflict`에 `syncAttachments: boolean`을 추가한다. `saveCosts`는 `ctx.isEditSingle.value && !options.background`일 때만 본문 PUT 성공 후 `applyAttachments`를 호출한다. 충돌이면 이 플래그를 pending 상태에 저장하고, `resolveConflict`의 최신 스탬프 PUT 성공 후 같은 함수를 호출한다.
이 보류 경로는 서버 응답의 `data.code === 'COST_SOURCE_CHANGED'`인 경우에만 적용하고 다른 저장 오류에서는 첨부를 호출하지 않은 채 기존 실패 처리를 유지한다.

- [ ] **Step 5: 단건 수정 페이지에 첨부 편집 상태와 UI를 연결한다**

```ts
const attachments = useCostAttachmentEditor(() =>
    isEditSingle.value ? (costs.value[0]?.costBgNo ?? '') : '',
);

const formSave = useCostFormSave({
    costs,
    isEditSingle,
    costFormErrors,
    route,
    router,
    confirm,
    toast,
    removeTab,
    createCost,
    updateCost,
    fetchCostOnce,
    isAdmin,
    baselines,
    syncAttachments: attachments.syncAttachments,
});
```

```vue
<CostFormAttachmentSection
    v-if="isEditSingle"
    v-model="attachments.pendingFiles.value"
    :existing-files="attachments.files.value"
    :deleted-file-ids="attachments.deletedFileIds.value"
    :disabled="isSubmitting"
    @mark-delete="attachments.markDelete"
    @unmark-delete="attachments.unmarkDelete"
    @retry-load="attachments.retryLoadFiles"
/>
```

- [ ] **Step 6: 저장·페이지 경계 테스트를 재실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/composables/cost/useCostFormSave.test.ts tests/unit/pages/costAttachmentFormBoundaries.test.ts tests/unit/features/cost/useCostAttachments.test.ts
```

Expected: PASS.

- [ ] **Step 7: 일반 전산업무비 수정 연동만 커밋한다**

```powershell
cd C:\it\it_frontend
git add -- app/pages/info/cost/form.vue app/composables/cost/useCostFormSave.ts tests/unit/composables/cost/useCostFormSave.test.ts tests/unit/pages/costAttachmentFormBoundaries.test.ts
git diff --cached --check
git commit -m "feat: 전산업무비 개별 저장에 첨부 연동"
```

---

### Task 8: 금융정보단말기 개별 수정에만 첨부 동기화 연결

**Files:**
- Modify: `it_frontend/app/components/cost/TerminalFormDialog.vue`
- Modify: `it_frontend/app/pages/info/cost/terminal/[id].vue`
- Modify: `it_frontend/tests/unit/components/cost/TerminalFormDialog.test.ts`
- Modify: `it_frontend/tests/unit/pages/costAttachmentDetailBoundaries.test.ts`

**Interfaces:**
- Consumes: Task 5의 `useCostAttachmentEditor`와 `CostFormAttachmentSection`
- Produces: `TerminalFormDialog` prop `allowAttachments?: boolean`(기본 `false`); 개별 상세 호출에서만 `true`

- [ ] **Step 1: 호출 경로별 첨부 표시 테스트를 작성한다**

```ts
it.each([
    [{ itMngcNo: 'COST-1', allowAttachments: true }, true],
    [{ itMngcNo: 'COST-1' }, false],
    [{ parentCostId: 'COST-PARENT', allowAttachments: true }, false],
    [{ localCost, allowAttachments: true }, false],
])('개별 기존 수정에서만 첨부를 표시한다', async (props, expected) => {
    const wrapper = mountDialog(props);
    await flushPromises();
    expect(wrapper.findComponent(CostFormAttachmentSection).exists()).toBe(expected);
});
```

- [ ] **Step 2: 본문 저장 실패·성공·첨부 부분 실패 순서 테스트를 작성한다**

```ts
it('본문 PUT 성공 뒤 첨부를 동기화하고 모두 성공해야 saved를 emit한다', async () => {
    const wrapper = mountDialog({ itMngcNo: 'COST-1', allowAttachments: true });
    await acceptSave(wrapper);
    expect(updateCost.mock.invocationCallOrder[0])
        .toBeLessThan(syncAttachments.mock.invocationCallOrder[0]);
    expect(wrapper.emitted('saved')).toHaveLength(1);
});

it('첨부 일부 실패면 다이얼로그를 유지하고 saved를 emit하지 않는다', async () => {
    syncAttachments.mockResolvedValue({ failedFiles: ['원본.pdf'] });
    const wrapper = mountDialog({ itMngcNo: 'COST-1', allowAttachments: true });
    await acceptSave(wrapper);
    expect(wrapper.emitted('saved')).toBeUndefined();
    expect(wrapper.emitted('update:visible')).toBeUndefined();
});
```

- [ ] **Step 3: 단말기 다이얼로그 테스트를 실행해 실패를 확인한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/components/cost/TerminalFormDialog.test.ts tests/unit/pages/costAttachmentDetailBoundaries.test.ts
```

Expected: `allowAttachments` prop과 동기화 경로 부재로 FAIL.

- [ ] **Step 4: 다이얼로그에 명시적인 첨부 허용 경계를 구현한다**

```ts
const props = withDefaults(defineProps<{
    visible: boolean;
    itMngcNo?: string;
    allowAttachments?: boolean;
    revisionSno?: number;
    parentCostId?: string;
    bgYy?: string;
    localCost?: ItCost;
    initialMode?: 'view' | 'edit';
}>(), { allowAttachments: false });

const canEditAttachments = computed(() =>
    props.allowAttachments === true &&
    Boolean(props.itMngcNo) &&
    !isLocalMode.value &&
    !props.parentCostId,
);
const attachments = useCostAttachmentEditor(() =>
    canEditAttachments.value ? (props.itMngcNo ?? '') : '',
);
```

`executeSave`에서 기존 항목 PUT이 성공한 뒤 `canEditAttachments`일 때만 `syncAttachments(payload.costBgNo)`를 호출한다. 실패 파일이 있거나 예외가 발생하면 부분 성공 Toast를 표시하고 성공 Toast·`saved`·닫기 emit을 생략한다.

- [ ] **Step 5: 개별 단말기 상세 호출부에서만 첨부를 허용한다**

```vue
<TerminalFormDialog
    v-if="cost"
    v-model:visible="terminalDialogVisible"
    :it-mngc-no="cost.costBgNo ?? undefined"
    :revision-sno="selectedRevision"
    :allow-attachments="true"
    :initial-mode="isReadonly ? 'view' : 'edit'"
    @saved="onTerminalSaved"
/>
```

목록 화면의 `TerminalFormDialog` 호출은 prop을 전달하지 않아 기본 `false`를 유지한다.

- [ ] **Step 6: 단말기와 목록 회귀 테스트를 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm test -- tests/unit/components/cost/TerminalFormDialog.test.ts tests/unit/pages/costAttachmentDetailBoundaries.test.ts tests/unit/composables/useCostListPage.test.ts
```

Expected: PASS.

- [ ] **Step 7: 단말기 개별 수정 연동만 커밋한다**

```powershell
cd C:\it\it_frontend
git add -- app/components/cost/TerminalFormDialog.vue 'app/pages/info/cost/terminal/[id].vue' tests/unit/components/cost/TerminalFormDialog.test.ts tests/unit/pages/costAttachmentDetailBoundaries.test.ts
git diff --cached --check
git commit -m "feat: 단말기 개별 수정에 첨부 연동"
```

---

### Task 9: 문서 계약과 사용자 흐름 검증

**Files:**
- Modify: `it_backend/docs/guides/security/file-security.md`
- Modify: `it_frontend/docs/guides/components/common-components.md`
- Modify: `it_frontend/tests/e2e/cost.spec.ts`
- Modify: `it_frontend/tests/e2e/projects.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–8의 완성된 서버 권한, 원본 다이얼로그, 사업·전산업무비 화면
- Produces: 운영자가 확인할 파일 종류·권한 문서와 핵심 UI 회귀 시나리오

- [ ] **Step 1: E2E에서 사업 반입 원본 분리와 목록 화면 비노출 시나리오를 작성한다**

```ts
test('수기등록 사업은 원본을 목록 대신 다이얼로그에서 보여준다', async ({ page }) => {
    const sourceFile = {
        flMpnId: 'FL-SOURCE-1', flNm: '반입원본.xlsx', apgFlSz: 1200,
        apgFlKdNm: '편성요청서반입', apgFlLnkCtzNm: 'APF-MANUAL-1',
    };
    await page.route(/\/api\/projects\/PRJ-2026-0001(?:\?.*)?$/, (route) =>
        route.fulfill({ json: {
            ...mockProjectDetail, apfStsC: '9', apfMngNo: 'APF-MANUAL-1',
            applicationInfo: { migrated: true, apfMngNo: 'APF-MANUAL-1' },
        } }),
    );
    await page.route(/\/api\/files\/batch(?:\?.*)?$/, (route) =>
        route.fulfill({ json: { 'APF-MANUAL-1': [sourceFile] } }),
    );
    await page.route(/\/api\/files(?:\?.*)?$/, (route) => route.fulfill({ json: [] }));
    await page.goto('/info/projects/PRJ-2026-0001');
    await expect(page.getByTestId('attachment-list-section')).not.toContainText('반입원본.xlsx');
    await page.getByTestId('request-form-source-button').click();
    await expect(page.getByRole('dialog', { name: '반입 원본 파일' })).toContainText('반입원본.xlsx');
});

test('전산업무비 목록 작성 화면에는 첨부 입력이 없다', async ({ page }) => {
    await page.goto('/info/cost');
    await page.getByRole('button', { name: '행 추가' }).click();
    await expect(page.getByTestId('cost-attachment-input')).toHaveCount(0);
});
```

- [ ] **Step 2: 전산업무비 개별 수정과 개정 공유 시나리오를 작성한다**

```ts
test('전산업무비 첨부는 개별 수정에서 저장되고 모든 순번에 공유된다', async ({ page }) => {
    let attachmentSaved = false;
    await page.route(/\/api\/cost\/COST-2026-001(?:\?sno=[12])?$/, async (route) => {
        if (route.request().method() === 'PUT') return route.fulfill({ json: mockCostDetail });
        return route.fulfill({ json: { ...mockCostDetail, bgSno: Number(new URL(route.request().url()).searchParams.get('sno') ?? 2) } });
    });
    await page.route(/\/api\/files\/bulk$/, async (route) => {
        attachmentSaved = true;
        await route.fulfill({ json: { successList: [{ flMpnId: 'FL-1', flNm: 'attachment.txt' }], failList: [] } });
    });
    await page.route(/\/api\/files(?:\?.*)?$/, (route) =>
        route.fulfill({ json: attachmentSaved ? [{ flMpnId: 'FL-1', flNm: 'attachment.txt', apgFlSz: 3 }] : [] }),
    );
    await page.goto('/info/cost/form?id=COST-2026-001&sno=2');
    await page.getByTestId('cost-attachment-input').setInputFiles({
        name: 'attachment.txt', mimeType: 'text/plain', buffer: Buffer.from('e2e'),
    });
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await page.goto('/info/cost/COST-2026-001?sno=1');
    await expect(page.getByTestId('attachment-list-section')).toContainText('attachment.txt');
});
```

Place the project case inside the existing project detail describe block and the cost cases inside the existing cost list/detail describe blocks so they reuse `setLoggedIn`, `mockCommonApis`, code-option mocks, and the established fixtures.

- [ ] **Step 3: 파일 보안과 공통 컴포넌트 가이드를 갱신한다**

`file-security.md`의 종류별 표에 다음 행을 추가한다.

```markdown
| `전산업무비` | `Bcostm` 현재 최종본(`BG_NO`, `LST_YN='Y'`, `DEL_YN='N'`) | 관리자 또는 IT 조직 사용자 또는 담당부서 사용자 |
```

쓰기 절에는 `전산업무비` 업로드가 관리자·최초 작성자·담당부서 사용자에게 허용되고 기존 행 삭제는 업로더 또는 관리자 계약을 따른다고 기록한다.

`common-components.md`에는 `AttachmentListSection#header-actions` 예제와 반입 원본은 직접 파일 그룹에 넣지 않고 `RequestFormSourceFilesDialog`로 여는 규칙을 기록한다.

- [ ] **Step 4: 문서와 E2E 변경만 커밋한다**

```powershell
cd C:\it\it_backend
git add -- docs/guides/security/file-security.md
git diff --cached --check
git commit -m "docs: 전산업무비 첨부 권한 기록"

cd C:\it\it_frontend
git add -- docs/guides/components/common-components.md tests/e2e/cost.spec.ts tests/e2e/projects.spec.ts
git diff --cached --check
git commit -m "test: 첨부파일 사용자 흐름 검증"
```

---

### Task 10: 전체 회귀 검증과 호환 버전 기록

**Files:**
- Modify: `versions.lock` only if backend or frontend commit IDs changed

**Interfaces:**
- Consumes: Tasks 1–9의 백엔드·프론트엔드 커밋
- Produces: 전체 Health Stack 결과와 호환 커밋 조합

- [ ] **Step 1: 백엔드 전체 검증을 실행한다**

Run:

```powershell
cd C:\it\it_backend
./gradlew test
./gradlew check
./gradlew bootJar
```

Expected: 모든 명령 exit code 0. Oracle 전용 `@Tag("it")` 테스트가 환경 조건으로 skip되면 skip 사유를 완료 보고에 기록하고, Oracle이 가용하면 `./gradlew test --tests '*FileReadAuthorizationIT'`도 PASS.

- [ ] **Step 2: 프론트엔드 전체 정적·단위 검증을 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npm run format:check
npm run check
npm test
npm run lint:css
npm run codegen:check
```

Expected: 모든 명령 exit code 0. OpenAPI 계약이 바뀌지 않아 생성 타입 diff가 없어야 한다.

- [ ] **Step 3: 핵심 E2E를 실행한다**

Run:

```powershell
cd C:\it\it_frontend
npx playwright test tests/e2e/cost.spec.ts tests/e2e/projects.spec.ts
```

Expected: 사업 원본 분리, 전산업무비 개별 첨부, 목록 비노출 시나리오 PASS.

- [ ] **Step 4: dirty 파일과 작업 파일을 구분해 최종 diff를 검토한다**

Run:

```powershell
cd C:\it\it_backend
git status --short
git log --oneline -6

cd C:\it\it_frontend
git status --short
git log --oneline -10
```

Expected: 본 계획의 경로는 모두 커밋되어 있고, 작업 전부터 있던 무관 변경만 남는다.

- [ ] **Step 5: 루트 호환 버전을 갱신하고 해당 파일만 커밋한다**

```powershell
cd C:\it
./scripts/update-versions-lock.ps1
git add -- versions.lock
git diff --cached --check
git diff --cached --stat
git commit -m "chore: 첨부 기능 호환 버전 기록"
```

- [ ] **Step 6: 완료 보고에 검증 근거와 제한 사항을 기록한다**

Report exact command outcomes, skipped Oracle integration tests, changed backend/frontend/root commit IDs, and confirm these user-visible outcomes:

```text
1. 수기등록 사업·전산업무비의 반입 원본은 제목 옆 아이콘으로만 열린다.
2. 일반 첨부 목록에는 직접 첨부한 파일만 표시된다.
3. 전산업무비 목록 작성에서는 첨부할 수 없고 개별 수정에서만 첨부할 수 있다.
4. 전산업무비 첨부는 costBgNo 기준으로 모든 개정 순번에 공유된다.
5. 자동저장과 저장 충돌 중에는 파일이 먼저 반영되지 않는다.
```
