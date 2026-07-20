# 보안·에러 처리 잔여과제 Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ERR-03의 남은 무시형 프론트 실패를 진단·경고·재시도 계약으로 통일하고, ERR-04의 비운영 SSO 샘플과 로컬 저장소 복구 스크립트가 제품 빌드·정적분석 경계 밖임을 명시한다.

**Architecture:** 반복될 수 있는 DOM·파싱 진단은 공용 rate-limit 유틸리티를 거쳐 콘솔을 보호한다. 사용자 동작으로 시작된 HWPX 변환·파일 메타 갱신·조회 실패는 warnings 또는 실패 ID를 반환하고 화면이 toast/인라인 재시도를 담당한다. 저장에 영향을 주지 않는 Tiptap DOM 보정 실패는 사용자 알림 없이 rate-limit 진단만 남긴다. 벤더 샘플과 로컬 복구 스크립트는 삭제하지 않고 README와 검증 명령으로 비운영 경계를 고정한다.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, PrimeVue, Vitest, PowerShell, Gradle.

**참조 스펙:** `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md` §5

## Global Constraints

- Phase 2의 ERR-07 구현과 검증이 끝난 뒤 시작한다. 동일 화면에서 Phase 2가 추가한 경고 상태를 덮어쓰지 않는다.
- 모든 신규 TSDoc·JavaDoc·인라인 주석은 한글로 작성한다. 단순 대입에는 주석을 추가하지 않는다.
- store/composable은 PrimeVue toast를 직접 호출하지 않는다. 화면이나 사용자 액션 composable만 toast를 표시한다.
- 사용자에게 토큰, 사번, 파일관리번호 전체 목록, 원문 문서 내용, 예외 stack을 노출하지 않는다. 진단 로그의 파일관리번호는 단건 상관 ID로만 사용한다.
- rate-limit은 동일 호출 지점에서 60초당 1회이다. 사용자 재시도 동작 자체는 rate-limit하지 않는다.
- 파일 메타 갱신 일부 실패는 문서 본문 저장을 롤백하지 않지만, 실패 ID를 메모리에 보존하고 화면 이탈 전에 재시도할 수 있어야 한다.
- HWPX 일부 변환 실패는 다운로드를 계속하되 누락 위치를 대체 문구로 남기고 완료 후 warning toast를 1회 표시한다.
- Tiptap 표 너비 보정은 DOM 표시만 다루므로 실패해도 문서 모델과 저장을 차단하지 않는다.
- `it_backend/sso`와 양쪽 `oss` 디렉터리는 제품 소스셋에 편입하지 않는다. 향후 정적분석 도구의 제외 경로로 문서화한다.
- 검증 게이트는 `npm run format:check`, `npm run check`, `npm test`, `./gradlew clean test`이다.

---

## File Structure

### Shared frontend diagnostics

- Create: `it_frontend/app/utils/diagnostics.ts` — 호출 지점별 60초 진단 제한 팩토리.
- Create: `it_frontend/app/utils/file-meta-update.ts` — 파일 메타 갱신 성공/실패 ID 집계.
- Test: `it_frontend/tests/unit/utils/diagnostics.test.ts`.
- Test: `it_frontend/tests/unit/utils/file-meta-update.test.ts`.

### ERR-03 user-visible paths

- Modify: `it_frontend/app/composables/useHwpxExport.ts`.
- Modify: `it_frontend/tests/unit/composables/useHwpxExport.direct.test.ts`.
- Modify: `it_frontend/app/composables/useExcalidrawAttachment.ts`.
- Modify: `it_frontend/tests/unit/composables/useExcalidrawAttachment.test.ts`.
- Modify: `it_frontend/app/pages/info/documents/form.vue`.
- Modify: `it_frontend/app/pages/info/documents/[id]/index.vue`.
- Create: `it_frontend/tests/unit/pages/document-file-meta-warning.test.ts`.
- Modify: `it_frontend/app/pages/info/projects/form.vue`.
- Create: `it_frontend/tests/unit/pages/project-previous-year-load.test.ts`.
- Modify: `it_frontend/app/pages/guide/index.vue`.
- Create: `it_frontend/tests/unit/pages/guide-attachment-error.test.ts`.
- Modify: `it_frontend/app/pages/budget/status.vue`.
- Modify: `it_frontend/tests/unit/pages/budgetStatusFooterTotals.test.ts`.

### ERR-03 diagnostic-only paths

- Modify: `it_frontend/app/components/extensions/tiptap-extensions.ts`.
- Modify: `it_frontend/app/components/extensions/tiptap-content-extensions.ts`.
- Modify: `it_frontend/app/composables/useTiptapTableTools.ts`.
- Create: `it_frontend/tests/unit/components/extensions/tiptap-error-diagnostics.test.ts`.
- Modify: `it_frontend/tests/unit/composables/useTiptapTableTools.test.ts`.

### ERR-04 non-production boundaries

- Create: `it_backend/sso/README.md`.
- Create: `it_backend/oss/README.md`.
- Create: `it_frontend/oss/README.md`.
- Modify: `it_backend/oss/rebuild-local-maven-repo.ps1`.
- Modify: `it_frontend/oss/rebuild-local-npm-repo.ps1`.
- Modify: `TASK.md`.
- Modify: `TASK_DONE.md`.

---

### Task 1: 공용 rate-limit 진단 계약 추가

**Files:**
- Create: `it_frontend/app/utils/diagnostics.ts`
- Create: `it_frontend/tests/unit/utils/diagnostics.test.ts`

**Interfaces:**
- Produces: `createRateLimitedWarn(intervalMs?: number): (message: string, error?: unknown) => void`.
- Failure: `console.warn` 자체의 예외는 전파하지 않는다.
- 범위: 기존 `useTableCellSelection.ts`의 프라이빗 `warnOncePerMinute`(미export, 클립보드 전용)는 본 태스크에서 새 공용 유틸로 수렴시키지 않고 그대로 둔다(동작 동일, 중복 정리는 별도 후속). 신규·이관 대상 호출 지점만 `createRateLimitedWarn`을 사용한다.

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRateLimitedWarn } from '~/utils/diagnostics';

describe('createRateLimitedWarn', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-19T00:00:00Z'));
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('제한 시간 안의 반복 경고는 첫 호출만 출력한다', () => {
        const warn = createRateLimitedWarn(60_000);
        warn('표 너비 보정 실패', new Error('first'));
        warn('표 너비 보정 실패', new Error('second'));
        expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('제한 시간이 지나면 다시 출력한다', () => {
        const warn = createRateLimitedWarn(60_000);
        warn('파싱 실패');
        vi.advanceTimersByTime(60_000);
        warn('파싱 실패');
        expect(console.warn).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: RED 확인**

Run: `cd it_frontend && npm test -- --run tests/unit/utils/diagnostics.test.ts`

Expected: `~/utils/diagnostics` 모듈을 찾지 못해 실패.

- [ ] **Step 3: 최소 구현**

```ts
export const createRateLimitedWarn = (intervalMs = 60_000) => {
    let lastWarnAt = Number.NEGATIVE_INFINITY;

    return (message: string, error?: unknown): void => {
        const now = Date.now();
        if (now - lastWarnAt < intervalMs) return;
        lastWarnAt = now;
        try {
            console.warn(message, error);
        } catch {
            // 진단 출력 실패가 사용자 기능을 중단하지 않게 한다.
        }
    };
};
```

- [ ] **Step 4: GREEN·커밋**

Run: `cd it_frontend && npm test -- --run tests/unit/utils/diagnostics.test.ts`

Expected: PASS.

```bash
git add it_frontend/app/utils/diagnostics.ts it_frontend/tests/unit/utils/diagnostics.test.ts
git commit -m "refactor(frontend): 반복 오류 진단 rate-limit 공통화 (ERR-03)"
```

---

### Task 2: HWPX 부분 누락을 결과 경고로 전달

**Files:**
- Modify: `it_frontend/app/composables/useHwpxExport.ts`
- Modify: `it_frontend/tests/unit/composables/useHwpxExport.direct.test.ts`

**Interfaces:**
- Keeps: `exportToHwpx(html, filename, opts): Promise<void>`.
- Produces: 부서명 또는 다이어그램 변환 실패 시 다운로드 후 `일부 내용 제외` warning toast 1회.

- [ ] **Step 1: 기존 직접-import 테스트에 실패 사례 추가**

```ts
it('작성자 부서 조회 실패 시 placeholder로 내보내고 경고한다', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('network'));
    const { exportToHwpx } = useHwpxExport();
    await exportToHwpx('<p>내용</p>', '문서명', { authorEno: 'E001' });
    expect(mockHtmlToHwpxBlob).toHaveBeenCalled();
    expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn', summary: '일부 내용 제외' }),
    );
});

it('다이어그램 변환 실패 시 위치 표시 문구를 남기고 경고한다', async () => {
    mockLoadScene.mockRejectedValueOnce(new Error('broken scene'));
    const html = '<figure data-type="excalidraw" data-attachment-id="SCENE-1"></figure>';
    const { exportToHwpx } = useHwpxExport();
    await exportToHwpx(html, '문서명');
    expect(mockHtmlToHwpxBlob).toHaveBeenCalledWith(
        expect.stringContaining('[다이어그램을 변환하지 못했습니다]'),
        expect.anything(),
        expect.anything(),
    );
    expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'warn', summary: '일부 내용 제외' }),
    );
});
```

- [ ] **Step 2: RED 확인**

Run: `cd it_frontend && npm test -- --run tests/unit/composables/useHwpxExport.direct.test.ts`

Expected: 현재 부서 조회 실패는 toast가 없고 다이어그램 노드는 제거되므로 두 신규 테스트 실패.

- [ ] **Step 3: warnings 누적과 대체 문구 구현**

`isExporting.value = true` 직후 배열을 만들고 두 catch에서 항목을 추가한다.

```ts
const exportWarnings: string[] = [];

// 작성자 부서 조회 catch
exportWarnings.push('작성자 부서명을 포함하지 못했습니다.');
console.warn('[HwpxExport] 작성자 부서 조회 실패');

// Excalidraw 변환 catch
exportWarnings.push('다이어그램 일부를 변환하지 못했습니다.');
console.warn('[HwpxExport] Excalidraw 변환 실패', attachmentId, err);
const fallback = doc.createElement('p');
fallback.textContent = '[다이어그램을 변환하지 못했습니다]';
fallback.setAttribute('data-export-warning', 'excalidraw-conversion');
fig.replaceWith(fallback);
```

다운로드 앵커를 클릭한 뒤 중복 문구를 제거해 toast를 1회 표시한다.

```ts
const distinctWarnings = [...new Set(exportWarnings)];
if (distinctWarnings.length > 0) {
    toast.add({
        severity: 'warn',
        summary: '일부 내용 제외',
        detail: distinctWarnings.join(' '),
        life: 5000,
    });
}
```

- [ ] **Step 4: GREEN·커밋**

Run: `cd it_frontend && npm test -- --run tests/unit/composables/useHwpxExport.direct.test.ts`

Expected: PASS.

```bash
git add it_frontend/app/composables/useHwpxExport.ts it_frontend/tests/unit/composables/useHwpxExport.direct.test.ts
git commit -m "fix(hwpx): 부분 변환 누락을 사용자 경고로 전달 (ERR-03)"
```

---

### Task 3: 파일 메타 갱신 실패 ID를 보존하고 재시도

**Files:**
- Create: `it_frontend/app/utils/file-meta-update.ts`
- Create: `it_frontend/tests/unit/utils/file-meta-update.test.ts`
- Modify: `it_frontend/app/composables/useExcalidrawAttachment.ts`
- Modify: `it_frontend/tests/unit/composables/useExcalidrawAttachment.test.ts`
- Modify: `it_frontend/app/pages/info/documents/form.vue`
- Modify: `it_frontend/app/pages/info/documents/[id]/index.vue`
- Create: `it_frontend/tests/unit/pages/document-file-meta-warning.test.ts`

**Interfaces:**
- Produces: `updateFileMetaBatch(ids, pkCone, update): Promise<{ succeededIds: string[]; failedIds: string[] }>`.
- Produces: `replacePendingFlMngNos(ids: string[]): void`.

- [ ] **Step 1: 배치 결과 테스트 작성**

```ts
import { describe, expect, it, vi } from 'vitest';
import { updateFileMetaBatch } from '~/utils/file-meta-update';

it('중복 ID를 한 번씩 처리하고 실패 ID를 반환한다', async () => {
    const update = vi.fn(async (id: string) => {
        if (id === 'F-2') throw new Error('network');
    });
    const result = await updateFileMetaBatch(['F-1', 'F-2', 'F-1'], 'DOC-1', update);
    expect(update).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ succeededIds: ['F-1'], failedIds: ['F-2'] });
});
```

`useExcalidrawAttachment.test.ts`에는 pending 교체 계약을 추가한다.

```ts
it('메타 갱신 실패 ID만 pending 목록에 다시 보존한다', () => {
    const attachment = useExcalidrawAttachment();
    attachment.replacePendingFlMngNos(['F-2', 'F-3', 'F-2']);
    expect(attachment.getPendingFlMngNos()).toEqual(['F-2', 'F-3']);
});
```

- [ ] **Step 2: RED 확인**

Run: `cd it_frontend && npm test -- --run tests/unit/utils/file-meta-update.test.ts tests/unit/composables/useExcalidrawAttachment.test.ts`

Expected: 신규 유틸리티와 pending 교체 함수가 없어 실패.

- [ ] **Step 3: 배치 유틸리티와 pending 교체 구현**

```ts
type UpdateFileMeta = (fileId: string, body: { pkCone: string }) => Promise<unknown>;

export const updateFileMetaBatch = async (
    fileIds: string[],
    pkCone: string,
    update: UpdateFileMeta,
): Promise<{ succeededIds: string[]; failedIds: string[] }> => {
    const succeededIds: string[] = [];
    const failedIds: string[] = [];
    for (const fileId of [...new Set(fileIds)]) {
        try {
            await update(fileId, { pkCone });
            succeededIds.push(fileId);
        } catch (error) {
            failedIds.push(fileId);
            console.warn('[file-meta-update] 파일 메타 갱신 실패', fileId, error);
        }
    }
    return { succeededIds, failedIds };
};
```

```ts
const replacePendingFlMngNos = (ids: string[]): void => {
    _pendingFlMngNos.value = [...new Set(ids)];
};
```

`useExcalidrawAttachment` 반환 객체에 `replacePendingFlMngNos`를 포함한다.

- [ ] **Step 4: 두 문서 화면에 재시도 상태 연결**

두 화면에 다음 상태와 함수를 둔다. 신규 등록 화면의 `fileMetaTargetDocNo`는 `createDocument` 반환값을 저장하며, 실패 ID가 0건일 때만 상세 화면으로 이동한다.

```ts
const fileMetaRetryIds = ref<string[]>([]);
const fileMetaTargetDocNo = ref<string | null>(null);
const isRetryingFileMeta = ref(false);

const retryFileMetaUpdates = async () => {
    if (!fileMetaTargetDocNo.value || fileMetaRetryIds.value.length === 0) return;
    isRetryingFileMeta.value = true;
    const result = await updateFileMetaBatch(
        fileMetaRetryIds.value,
        fileMetaTargetDocNo.value,
        updateFileMeta,
    );
    fileMetaRetryIds.value = result.failedIds;
    replacePendingFlMngNos(result.failedIds);
    isRetryingFileMeta.value = false;
    if (result.failedIds.length === 0) {
        toast.add({ severity: 'success', summary: '파일 연결 완료', detail: '파일 연결을 완료했습니다.', life: 3000 });
    }
};
```

저장 직후 대상 ID를 각 화면의 pending 소스와 `getPendingFlMngNos()`에서 합치고 배치 결과를 적용한다.

> **화면별 심볼 주의:** `pendingImageIds`·`pendingAttachmentIds`는 `useExcalidrawAttachment`가 아니라 **`info/documents/form.vue`(신규 등록) 화면의 로컬 ref**이며, 상세 화면 `info/documents/[id]/index.vue`에는 없다(`useExcalidrawAttachment`는 단일 배열 `_pendingFlMngNos`만 노출: `getPendingFlMngNos`/`clearPendingFlMngNos`). 아래 예시는 form.vue 기준이고, 상세 화면은 그 화면이 실제로 보유한 pending 소스(+`getPendingFlMngNos()`)로만 `fileIds`를 구성한다.

```ts
fileMetaTargetDocNo.value = docMngNo;
const fileIds = [
    ...pendingImageIds.value,
    ...pendingAttachmentIds.value,
    ...getPendingFlMngNos(),
];
const result = await updateFileMetaBatch(fileIds, docMngNo, updateFileMeta);
fileMetaRetryIds.value = result.failedIds;
replacePendingFlMngNos(result.failedIds);
if (result.failedIds.length > 0) return;
clearPendingFlMngNos();
```

두 템플릿의 저장 결과 영역에 동일 경고를 추가한다.

```vue
<Message v-if="fileMetaRetryIds.length > 0" severity="warn" :closable="false">
    문서는 저장됐지만 일부 파일 연결에 실패했습니다.
    <Button label="파일 연결 다시 시도" text size="small"
        :loading="isRetryingFileMeta" @click="retryFileMetaUpdates" />
</Message>
```

신규 등록 화면은 재시도 성공 시 `router.push(`/info/documents/${fileMetaTargetDocNo.value}`)` 후 탭을 닫는다. 상세 화면은 성공 시 `refreshFiles()`를 호출한다.

- [ ] **Step 5: 화면 회귀 테스트 작성**

`document-file-meta-warning.test.ts`에서 `updateFileMeta`가 첫 호출에 reject, 재시도에 resolve하도록 mock한다.

```ts
expect(wrapper.text()).toContain('일부 파일 연결에 실패했습니다');
await wrapper.get('[data-testid="retry-file-meta"]').trigger('click');
await flushPromises();
expect(mockUpdateFileMeta).toHaveBeenCalledTimes(2);
expect(wrapper.text()).not.toContain('일부 파일 연결에 실패했습니다');
```

위 selector가 동작하도록 Button에 `data-testid="retry-file-meta"`를 추가한다.

- [ ] **Step 6: GREEN·커밋**

Run: `cd it_frontend && npm test -- --run tests/unit/utils/file-meta-update.test.ts tests/unit/composables/useExcalidrawAttachment.test.ts tests/unit/pages/document-file-meta-warning.test.ts`

Expected: PASS.

```bash
git add it_frontend/app/utils/file-meta-update.ts it_frontend/app/composables/useExcalidrawAttachment.ts it_frontend/app/pages/info/documents/form.vue "it_frontend/app/pages/info/documents/[id]/index.vue" it_frontend/tests/unit
git commit -m "fix(documents): 파일 메타 실패 ID 보존과 재시도 제공 (ERR-03)"
```

---

### Task 4: 사업 자동채움·가이드 첨부·컬럼 설정 실패 표면화

**Files:**
- Modify: `it_frontend/app/pages/info/projects/form.vue`
- Create: `it_frontend/tests/unit/pages/project-previous-year-load.test.ts`
- Modify: `it_frontend/app/pages/guide/index.vue`
- Create: `it_frontend/tests/unit/pages/guide-attachment-error.test.ts`
- Modify: `it_frontend/app/pages/budget/status.vue`
- Modify: `it_frontend/tests/unit/pages/budgetStatusFooterTotals.test.ts`

**Interfaces:**
- Produces: 전년도 사업 조회 실패 error toast.
- Produces: 가이드 첨부 목록 `attachmentLoadError`와 재시도.
- Produces: 손상된 컬럼 설정 삭제와 60초 제한 진단.

- [ ] **Step 1: 세 실패 테스트 작성**

```ts
it('전년도 사업 조회 실패를 toast로 알린다', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('network'));
    await (wrapper.vm as any).onContinueProjectSelect({ value: { abusMngNo: 'P-1' } });
    await flushPromises();
    expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: '전년도 사업 조회 실패' }),
    );
});
```

```ts
it('가이드 첨부 조회 실패와 재시도 버튼을 표시한다', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([]);
    await (wrapper.vm as any).refreshAttachments();
    await flushPromises();
    expect(wrapper.text()).toContain('첨부파일 목록을 불러오지 못했습니다');
    await wrapper.get('[data-testid="retry-guide-attachments"]').trigger('click');
    await flushPromises();
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
});
```

```ts
it('손상된 컬럼 설정을 제거하고 기본 컬럼으로 복구한다', async () => {
    localStorage.setItem('budgetStatus_visibleCols_project', '{broken');
    await import('~/pages/budget/status.vue');
    expect(localStorage.getItem('budgetStatus_visibleCols_project')).toBeNull();
    expect(console.warn).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: RED 확인**

Run: `cd it_frontend && npm test -- --run tests/unit/pages/project-previous-year-load.test.ts tests/unit/pages/guide-attachment-error.test.ts tests/unit/pages/budgetStatusFooterTotals.test.ts`

Expected: 첫 두 경로는 사용자 피드백이 없고 컬럼 설정 key가 남아 실패.

- [ ] **Step 3: 사업 자동채움 catch에 toast 추가**

```ts
} catch (error) {
    console.error('[Projects] 전년도 사업 로드 실패', error);
    toast.add({
        severity: 'error',
        summary: '전년도 사업 조회 실패',
        detail: '선택한 사업 정보를 불러오지 못했습니다. 다시 선택해 주세요.',
        life: 4000,
    });
}
```

- [ ] **Step 4: 가이드 첨부 tri-state 구현**

```ts
const attachmentLoading = ref(false);
const attachmentLoadError = ref(false);

const refreshAttachments = async () => {
    const docMngNo = currentGuide.value?.docMngNo;
    if (!docMngNo) {
        attachmentListData.value = [];
        attachmentLoadError.value = false;
        return;
    }
    attachmentLoading.value = true;
    attachmentLoadError.value = false;
    try {
        const files = await $apiFetch<FileRecord[]>(`${runtimeConfig.public.apiBase}/api/files`, {
            query: { orcDtt: '가이드문서', pkCone: docMngNo },
        });
        attachmentListData.value = (files ?? [])
            .filter((file) => file.flTpCone === '첨부파일')
            .map((file) => ({ flMngNo: file.flMpnId, flNm: file.flNm, flSz: 0 }));
    } catch (error) {
        attachmentListData.value = [];
        attachmentLoadError.value = true;
        console.warn('[guide] 첨부파일 목록 조회 실패', error);
    } finally {
        attachmentLoading.value = false;
    }
};
```

```vue
<Message v-if="attachmentLoadError" severity="warn" :closable="false">
    첨부파일 목록을 불러오지 못했습니다.
    <Button data-testid="retry-guide-attachments" label="다시 시도" text size="small"
        :loading="attachmentLoading" @click="refreshAttachments" />
</Message>
```

- [ ] **Step 5: 손상 localStorage 복구 구현**

모듈 상단에서 경고 함수를 한 번 만들고 parse catch에서 현재 key만 제거한다.

```ts
import { createRateLimitedWarn } from '~/utils/diagnostics';

const warnCorruptColumnSettings = createRateLimitedWarn();

// loadVisibleCols 내부
} catch (error) {
    localStorage.removeItem(STORAGE_KEY_PREFIX + tabKey);
    warnCorruptColumnSettings('[budget-status] 손상된 컬럼 설정을 기본값으로 복구했습니다.', error);
}
```

- [ ] **Step 6: GREEN·커밋**

Run: `cd it_frontend && npm test -- --run tests/unit/pages/project-previous-year-load.test.ts tests/unit/pages/guide-attachment-error.test.ts tests/unit/pages/budgetStatusFooterTotals.test.ts`

Expected: PASS.

```bash
git add it_frontend/app/pages/info/projects/form.vue it_frontend/app/pages/guide/index.vue it_frontend/app/pages/budget/status.vue it_frontend/tests/unit/pages
git commit -m "fix(frontend): 보조 조회 실패 경고와 재시도 제공 (ERR-03)"
```

---

### Task 5: Tiptap 파싱·표 DOM 보정 진단 정리

**Files:**
- Modify: `it_frontend/app/components/extensions/tiptap-extensions.ts`
- Modify: `it_frontend/app/components/extensions/tiptap-content-extensions.ts`
- Modify: `it_frontend/app/composables/useTiptapTableTools.ts`
- Create: `it_frontend/tests/unit/components/extensions/tiptap-error-diagnostics.test.ts`
- Modify: `it_frontend/tests/unit/composables/useTiptapTableTools.test.ts`

**Interfaces:**
- Produces: Excalidraw legacy parse 결과의 `sceneParseError: boolean`.
- Produces: 표 보정 오류의 table 위치가 포함된 60초 제한 진단.
- Decision: 표 DOM 동기화 실패는 문서 모델을 변경하지 않으므로 사용자 저장 경고를 만들지 않는다.

- [ ] **Step 1: 파싱·표 진단 테스트 작성**

`extractExcalidrawAttrs`를 named export로 바꾸고 직접 검증한다.

```ts
it('손상된 SVG는 빈 데이터와 구분되는 parseError를 반환한다', () => {
    const img = document.createElement('img');
    img.src = 'data:image/svg+xml;charset=utf-8,%E0%A4%A';
    expect(extractExcalidrawAttrs(null, img)).toEqual({
        sceneData: null,
        svgContent: '',
        sceneParseError: true,
    });
});

it('normalizeColwidths 예외는 table 위치를 포함해 한 번만 경고한다', () => {
    const tr = { setNodeMarkup: vi.fn(), setMeta: vi.fn() };
    const cell = { type: { name: 'tableCell' }, attrs: { colspan: 1, colwidth: null } };
    const row = {
        type: { name: 'tableRow' },
        forEach: (visit: (node: typeof cell, offset: number) => void) => visit(cell, 0),
    };
    const tableNode = {
        type: { name: 'table' },
        attrs: {},
        forEach: (visit: (node: typeof row, offset: number) => void) => visit(row, 0),
    };
    const editor = {
        isDestroyed: false,
        view: {
            state: {
                doc: { descendants: (visit: (node: typeof tableNode, pos: number) => void) => visit(tableNode, 17) },
                tr,
            },
            nodeDOM: vi.fn(() => { throw new Error('dom lookup'); }),
            dispatch: vi.fn(),
            dom: document.createElement('div'),
        },
    };
    normalizeColwidths(editor as unknown as Editor);
    normalizeColwidths(editor as unknown as Editor);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('tablePos=17'),
        expect.anything(),
    );
});
```

`useTiptapTableTools.test.ts`에는 실제 공개 함수 `applyTableWidths`를 호출하는 다음 테스트를 추가한다.

```ts
it('applyTableWidths의 반복 DOM 오류는 60초 동안 한 번만 경고한다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const editor = ref(makeEditor());
    editor.value.view.nodeDOM.mockImplementation(() => {
        throw new Error('dom lookup');
    });
    const tools = useTiptapTableTools(editor, vi.fn());
    tools.applyTableWidths();
    tools.applyTableWidths();
    expect(warn).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: RED 확인**

Run: `cd it_frontend && npm test -- --run tests/unit/components/extensions/tiptap-error-diagnostics.test.ts tests/unit/composables/useTiptapTableTools.test.ts`

Expected: `sceneParseError`가 없고 기존 경고가 호출 횟수를 제한하지 않아 실패.

- [ ] **Step 3: Excalidraw parse 결과 구분**

```ts
const warnExcalidrawParse = createRateLimitedWarn();

export const extractExcalidrawAttrs = (
    el: HTMLElement | null,
    img: HTMLImageElement | null,
) => {
    let sceneData: string | null = null;
    let svgContent = '';
    let sceneParseError = false;

    const rawDataScene = el?.getAttribute('data-scene');
    if (rawDataScene) {
        try {
            sceneData = decodeURIComponent(atob(rawDataScene));
        } catch {
            sceneData = rawDataScene;
        }
    }

    if (img?.src?.startsWith('data:image/svg+xml')) {
        try {
            svgContent = decodeURIComponent(
                img.src.replace('data:image/svg+xml;charset=utf-8,', ''),
            );
            if (!sceneData) {
                const match = svgContent.match(/<!-- excalidraw-scene-data:(.*?) -->/);
                if (match?.[1]) {
                    try {
                        sceneData = decodeURIComponent(atob(match[1]));
                    } catch {
                        sceneData = match[1];
                    }
                }
            }
        } catch (error) {
            sceneParseError = true;
            warnExcalidrawParse('[tiptap-excalidraw] SVG 장면 데이터 파싱 실패', error);
        }
    }
    return { sceneData, svgContent, sceneParseError };
};
```

`addAttributes()`에 `sceneParseError: { default: false }`를 추가한다. `renderHTML`에는 이 진단 필드를 직렬화하지 않는다. 신규 `data-attachment-id` 분기는 `sceneParseError: false`를 반환한다.

- [ ] **Step 4: 표 보정 catch를 rate-limit 진단으로 교체**

두 모듈 상단에 각 호출 지점 전용 함수를 생성한다.

```ts
const warnTableNormalization = createRateLimitedWarn();
const warnTableDomSync = createRateLimitedWarn();
```

`tiptap-content-extensions.ts`의 catch는 순회 위치를 포함한다.

```ts
} catch (error) {
    warnTableNormalization(
        `[tiptap-content] 표 컬럼 폭 보정 실패: tablePos=${tablePos}`,
        error,
    );
}
```

`useTiptapTableTools.ts`의 `applyTableWidths` 및 `syncColumnWidths` catch는 각각 `pos`를 포함해 `warnTableDomSync`를 호출한다. 해당 TSDoc에는 “DOM 표시 동기화 실패이며 ProseMirror 문서 모델과 저장 데이터는 변경되지 않는다”를 기록하고 미결 주석을 제거한다.

- [ ] **Step 5: GREEN·커밋**

Run: `cd it_frontend && npm test -- --run tests/unit/components/extensions/tiptap-error-diagnostics.test.ts tests/unit/composables/useTiptapTableTools.test.ts`

Expected: PASS.

```bash
git add it_frontend/app/components/extensions/tiptap-extensions.ts it_frontend/app/components/extensions/tiptap-content-extensions.ts it_frontend/app/composables/useTiptapTableTools.ts it_frontend/tests/unit/components/extensions/tiptap-error-diagnostics.test.ts it_frontend/tests/unit/composables/useTiptapTableTools.test.ts
git commit -m "refactor(tiptap): 파싱·DOM 보정 실패 진단 일관화 (ERR-03)"
```

---

### Task 6: 비운영 SSO 샘플·로컬 복구 스크립트 경계 문서화

**Files:**
- Create: `it_backend/sso/README.md`
- Create: `it_backend/oss/README.md`
- Create: `it_frontend/oss/README.md`
- Modify: `it_backend/oss/rebuild-local-maven-repo.ps1`
- Modify: `it_frontend/oss/rebuild-local-npm-repo.ps1`

**Interfaces:**
- Produces: 비운영 자산의 소유·실행·스캔 제외·삭제 판단 계약.
- Decision: 벤더 샘플은 계약/장애 대응 참고자료이므로 유지하고 제품 소스셋에는 편입하지 않는다.

- [ ] **Step 1: 현재 경계 검증**

Run: `cd it_backend && ./gradlew properties --console=plain`

Expected: 명령 exit 0. 이어서 다음 검색을 실행한다.

Run: `rg -n "sourceSets|it_backend/sso|/sso|\\sso" it_backend/build.gradle it_backend/settings.gradle it_backend/src`

Expected: `it_backend/sso`를 `main` 또는 `test` sourceSet에 포함하는 설정 0건.

Run: `rg -n "spotbugs|pmd|checkstyle" it_backend/build.gradle it_frontend/package.json`

Expected: 활성 SpotBugs/PMD/Checkstyle 설정 0건. 결과가 있으면 이 Task를 중지하고 실제 include/exclude 설정을 먼저 조사한다.

- [ ] **Step 2: SSO README 작성**

`it_backend/sso/README.md`에 다음 내용을 완성 문장으로 기록한다.

```md
# SSO 벤더 참고자료

이 디렉터리는 SSO Web Agent 공급사가 제공한 샘플과 원본 배포 자료를 보관한다. 제품의 Gradle `main`·`test` 소스셋에 포함되지 않으며 운영 WAR에도 패키징하지 않는다.

- 제품 SSO 구현의 단일 진실 공급원은 `src/main/java/com/kdb/it/common/sso`이다.
- 이 디렉터리의 JSP·Java·class 파일은 직접 수정하거나 제품 코드에서 import하지 않는다.
- 보안 정적분석 도입 시 이 경로를 vendor/non-production 제외 목록에 명시한다.
- 삭제는 SSO 공급 계약, 장애 대응 자료 보존 기간, 운영 담당자 승인을 확인한 별도 작업에서 결정한다.
```

- [ ] **Step 3: 양쪽 OSS README와 의도적 catch 진단 작성**

각 README에 해당 스크립트가 개발자 로컬 Maven/npm 저장소 복구 전용이고 CI·운영 배포에서 실행되지 않음을 기록한다. 정적분석 제외 경로는 각각 `it_backend/oss/**`, `it_frontend/oss/**`로 명시한다.

두 PowerShell 스크립트의 콘솔 인코딩 best-effort catch를 다음 형식으로 바꾼다.

```powershell
try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
}
catch {
    Write-Verbose '콘솔 UTF-8 인코딩을 설정하지 못해 현재 인코딩으로 계속합니다.'
}
```

- [ ] **Step 4: 스크립트 구문과 제품 빌드 검증**

Run: `pwsh -NoProfile -Command '$tokens = $null; $parseErrors = $null; [System.Management.Automation.Language.Parser]::ParseFile("it_backend/oss/rebuild-local-maven-repo.ps1", [ref]$tokens, [ref]$parseErrors) > $null; if ($parseErrors.Count) { $parseErrors; exit 1 }'`

Expected: exit 0, 출력 없음.

Run: `pwsh -NoProfile -Command '$tokens = $null; $parseErrors = $null; [System.Management.Automation.Language.Parser]::ParseFile("it_frontend/oss/rebuild-local-npm-repo.ps1", [ref]$tokens, [ref]$parseErrors) > $null; if ($parseErrors.Count) { $parseErrors; exit 1 }'`

Expected: exit 0, 출력 없음.

Run: `cd it_backend && ./gradlew clean test`

Expected: BUILD SUCCESSFUL이며 `it_backend/sso` 파일이 compile 입력에 나타나지 않는다.

- [ ] **Step 5: 커밋**

```bash
git add it_backend/sso/README.md it_backend/oss/README.md it_frontend/oss/README.md it_backend/oss/rebuild-local-maven-repo.ps1 it_frontend/oss/rebuild-local-npm-repo.ps1
git commit -m "docs: 비운영 SSO·OSS 자산 경계 명시 (ERR-04)"
```

---

### Task 7: Phase 3 통합 검증과 과제 완료 이관

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:**
- Produces: ERR-03·ERR-04 완료 근거와 검증 명령 이력.

- [ ] **Step 1: 잔여 무시형 표식과 빈 catch 검색**

Run: `rg -n "TO[D]O|FIX[M]E|catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\{\s*\}" it_frontend/app/composables/useHwpxExport.ts it_frontend/app/pages/info/documents it_frontend/app/pages/info/projects/form.vue it_frontend/app/pages/guide/index.vue it_frontend/app/pages/budget/status.vue it_frontend/app/components/extensions it_frontend/app/composables/useTiptapTableTools.ts it_backend/oss it_frontend/oss`

Expected: 이 계획이 다룬 ERR-03·ERR-04 경로에서 미결 표식과 빈 catch 0건. 다른 목적의 표식이 나오면 파일·라인·소유 과제를 `TASK.md`에 명시하고 ERR-03 완료 판정에서 제외 근거를 기록한다.

- [ ] **Step 2: 프론트 전체 게이트**

Run: `cd it_frontend && npm run format:check`

Expected: exit 0.

Run: `cd it_frontend && npm run check`

Expected: typecheck와 lint 모두 exit 0.

Run: `cd it_frontend && npm test`

Expected: 모든 Vitest suite PASS.

- [ ] **Step 3: 백엔드 회귀 게이트**

Run: `cd it_backend && ./gradlew clean test`

Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 수동 QA**

두 서버를 기동한 뒤 다음을 확인한다.

1. HWPX 부서 조회와 Excalidraw 변환을 각각 실패시키면 파일은 생성되고 `일부 내용 제외` toast가 1회 보인다.
2. 문서 저장 후 파일 메타 API 한 건을 실패시키면 저장 성공과 별개인 경고·재시도 버튼이 보이고 재시도 성공 후 사라진다.
3. 가이드 첨부 API 실패는 빈 목록 문구가 아니라 재시도 경고로 보인다.
4. 손상된 예산 컬럼 localStorage 값은 한 번 삭제되고 기본 컬럼으로 복구된다.
5. Tiptap 표 DOM 매핑 실패를 반복시켜도 분당 경고 1회이며 본문 저장은 계속된다.

- [ ] **Step 5: 과제 이관과 최종 커밋**

`TASK.md`에서 ERR-03·ERR-04 항목을 제거한다. `TASK_DONE.md`에는 변경 파일, 자동 검증 4개, 수동 QA 5개 결과, 벤더 샘플 유지 결정과 근거를 기록한다.

```bash
git add TASK.md TASK_DONE.md
git commit -m "docs: Phase 3 오류 처리 완료 이력 반영"
```

---

## 롤백과 운영 관찰

- 프론트 경고가 과도하면 사용자 toast 변경만 되돌리고 `diagnostics.ts`의 rate-limit 진단은 유지한다.
- 파일 메타 재시도에서 반복 실패해도 문서 PK와 실패 ID를 화면 메모리에 보존한다. 새로고침 후 복구가 필요하면 파일 API의 `pkCone` 불일치 조회를 별도 운영 절차로 수행한다.
- ERR-04는 제품 런타임 변경이 없다. README 제거는 경계를 불명확하게 하므로 롤백 대상이 아니다.
- 진단 로그에는 본문·토큰·개인정보를 추가하지 않는다.

## 완료 기준

- 스펙 §5.1의 10개 경로 모두 사용자 경고 또는 rate-limit 진단 중 하나로 분류된다.
- HWPX 및 파일 메타 실패는 정상 성공과 구분되는 사용자 피드백과 재시도/누락 표시가 있다.
- Tiptap DOM-only 실패는 저장 영향 없음이 코드 문서와 테스트에 고정된다.
- `it_backend/sso`, `it_backend/oss`, `it_frontend/oss`의 비운영 경계와 향후 정적분석 제외 규칙이 문서화된다.
- 프론트 3개 게이트와 백엔드 테스트가 모두 통과한다.
