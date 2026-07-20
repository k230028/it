# Excalidraw 장면 외부 저장 + LZ-String 압축 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Excalidraw 다이어그램의 sceneData와 임베드 이미지를 `/api/files` 첨부파일 시스템에 분리 저장하여 HTML BLOB 크기를 수십 바이트로 최소화한다.

**Architecture:** 다이어그램 저장 시 `handleExcalidrawSave`에서 임베드 이미지를 개별 첨부파일로 업로드하고, sceneData를 LZ-String 압축 후 scene 첨부파일로 업로드한다. HTML에는 `data-attachment-id`만 기록된다. 로드 시 NodeView가 첨부파일을 fetch → 압축 해제 → SVG 재생성한다. 기존 `data-scene` 형식은 parseHTML에서 하위 호환 처리한다.

**Tech Stack:** `lz-string` (압축), Tiptap Node Extension, Vue 3 Composable, `/api/files` (기존 파일 API), Vitest

---

## 파일 구조

| 파일 | 변경 유형 | 역할 |
|------|----------|------|
| `app/composables/useExcalidrawAttachment.ts` | **신규** | 저장/로딩 핵심 로직 (이미지 추출, LZ-String, API 호출, pending ID 추적) |
| `app/composables/useExcalidrawDialog.ts` | 수정 | `ExcalidrawSaveData`에 `attachmentId` 추가 |
| `app/components/TiptapToolbar.vue` | 수정 | `handleExcalidrawSave` — 저장 전 업로드 + `isExcalidrawSaving` 로딩 상태 |
| `app/components/extensions/tiptap-extensions.ts` | 수정 | `attachmentId` 속성 추가, `parseHTML`/`renderHTML` 분기 |
| `app/components/ExcalidrawNodeView.vue` | 수정 | 첨부파일 기반 로드, `localSceneData` 관리 |
| `app/pages/info/documents/form.vue` | 수정 | 저장 후 Excalidraw pending 파일 orcPkVl 업데이트 |
| `app/pages/info/documents/[id]/index.vue` | 수정 | 수정 저장 후 Excalidraw pending 파일 orcPkVl 업데이트 |
| `tests/unit/composables/useExcalidrawAttachment.test.ts` | **신규** | 순수 함수 + composable 단위 테스트 |

---

## Task 1: lz-string 패키지 설치

**Files:**
- Modify: `it_frontend/package.json`

- [ ] **Step 1: 패키지 설치**

```bash
cd it_frontend && npm install lz-string
```

Expected: `package.json`의 `dependencies`에 `"lz-string": "^1.5.0"` 추가됨

- [ ] **Step 2: 타입 확인**

```bash
cd it_frontend && node -e "const LZString = require('lz-string'); console.log(typeof LZString.compressToBase64)"
```

Expected: `function`

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/package.json it_frontend/package-lock.json
git commit -m "chore: lz-string 패키지 설치"
```

---

## Task 2: useExcalidrawAttachment composable 작성 + 테스트

**Files:**
- Create: `it_frontend/app/composables/useExcalidrawAttachment.ts`
- Create: `it_frontend/tests/unit/composables/useExcalidrawAttachment.test.ts`

- [ ] **Step 1: 테스트 파일 작성 (RED)**

`it_frontend/tests/unit/composables/useExcalidrawAttachment.test.ts` 생성:

```typescript
import { describe, it, expect } from 'vitest';
import {
    dataUrlToFile,
    extractFiles,
    compressScene,
    decompressScene
} from '~/composables/useExcalidrawAttachment';

describe('dataUrlToFile', () => {
    it('PNG dataURL을 File 객체로 변환한다', () => {
        // 1x1 투명 PNG의 base64
        const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const dataUrl = `data:image/png;base64,${base64}`;

        const file = dataUrlToFile(dataUrl, 'image/png', 'test.png');

        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe('test.png');
        expect(file.type).toBe('image/png');
        expect(file.size).toBeGreaterThan(0);
    });
});

describe('extractFiles', () => {
    it('sceneData에서 files를 추출하고 dataURL을 제거한다', () => {
        const sceneData = JSON.stringify({
            elements: [{ id: 'elem1' }],
            appState: {},
            files: {
                'file-abc': { dataURL: 'data:image/png;base64,abc123', mimeType: 'image/png' },
                'file-def': { dataURL: 'data:image/jpeg;base64,def456', mimeType: 'image/jpeg' }
            }
        });

        const { modifiedScene, files } = extractFiles(sceneData);
        const parsed = JSON.parse(modifiedScene);

        expect(files).toHaveLength(2);
        expect(files[0]!.fileId).toBe('file-abc');
        expect(files[0]!.dataUrl).toBe('data:image/png;base64,abc123');
        expect(files[0]!.mimeType).toBe('image/png');
        expect(files[1]!.fileId).toBe('file-def');

        // dataURL이 제거되어야 함
        expect(parsed.files['file-abc'].dataURL).toBeUndefined();
        expect(parsed.files['file-def'].dataURL).toBeUndefined();

        // 나머지 필드는 유지
        expect(parsed.files['file-abc'].mimeType).toBe('image/png');
        expect(parsed.elements).toEqual([{ id: 'elem1' }]);
    });

    it('files가 없는 sceneData는 빈 배열을 반환한다', () => {
        const sceneData = JSON.stringify({ elements: [], appState: {} });
        const { files } = extractFiles(sceneData);
        expect(files).toHaveLength(0);
    });
});

describe('compressScene / decompressScene', () => {
    it('압축 후 복원하면 원본과 동일하다', () => {
        const original = JSON.stringify({
            elements: [{ id: 'e1', type: 'rectangle', x: 100, y: 200 }],
            appState: { zoom: { value: 1 } },
            files: {}
        });

        const compressed = compressScene(original);
        expect(compressed).not.toBe(original);
        expect(compressed.length).toBeLessThan(original.length);

        const restored = decompressScene(compressed);
        expect(restored).toBe(original);
    });

    it('빈 객체 압축/복원이 안전하다', () => {
        const compressed = compressScene('{}');
        const restored = decompressScene(compressed);
        expect(restored).toBe('{}');
    });
});
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
cd it_frontend && npx vitest run tests/unit/composables/useExcalidrawAttachment.test.ts
```

Expected: `Cannot find module '~/composables/useExcalidrawAttachment'` 오류

- [ ] **Step 3: composable 구현**

`it_frontend/app/composables/useExcalidrawAttachment.ts` 생성:

```typescript
/**
 * ============================================================================
 * [useExcalidrawAttachment] Excalidraw 장면 첨부파일 저장/로딩 Composable
 * ============================================================================
 * Excalidraw 다이어그램의 sceneData와 임베드 이미지를 /api/files에 분리 저장합니다.
 *
 * [저장 흐름]
 *  1. sceneData.files에서 이미지 dataURL 추출 → 각각 binary로 업로드
 *  2. sceneData.files의 dataURL을 attachmentId 참조로 교체
 *  3. 수정된 sceneData → LZString.compressToBase64() → scene 파일 업로드
 *  4. scene 파일의 flMngNo 반환
 *
 * [로딩 흐름]
 *  1. scene flMngNo → /api/files/{id}/download → LZString 압축 해제
 *  2. sceneData.files의 attachmentId → 각각 /api/files/{id}/preview → dataURL 복원
 *  3. 복원된 sceneData 반환
 * ============================================================================
 */

import LZString from 'lz-string';

/** sceneData.files에서 추출된 이미지 정보 */
export interface ExtractedFile {
    fileId: string;
    dataUrl: string;
    mimeType: string;
}

/**
 * sceneData JSON에서 files를 추출하고 dataURL을 제거한 sceneData를 반환
 * @param sceneData - Excalidraw 장면 JSON 문자열
 */
export const extractFiles = (sceneData: string): {
    modifiedScene: string;
    files: ExtractedFile[];
} => {
    const parsed = JSON.parse(sceneData) as {
        elements: unknown[];
        appState: unknown;
        files?: Record<string, { dataURL?: string; mimeType?: string; [key: string]: unknown }>;
    };
    const files: ExtractedFile[] = [];

    if (parsed.files) {
        for (const [fileId, fileData] of Object.entries(parsed.files)) {
            if (fileData.dataURL) {
                files.push({
                    fileId,
                    dataUrl: fileData.dataURL,
                    mimeType: fileData.mimeType || 'image/png'
                });
                // 수정된 객체에서 dataURL 제거 (attachmentId로 대체될 예정)
                const { dataURL: _removed, ...rest } = fileData;
                parsed.files[fileId] = rest;
            }
        }
    }

    return { modifiedScene: JSON.stringify(parsed), files };
};

/**
 * dataURL 문자열을 File 객체로 변환
 * @param dataUrl - data:image/...;base64,... 형식의 문자열
 * @param mimeType - 파일 MIME 타입
 * @param fileName - 파일명
 */
export const dataUrlToFile = (dataUrl: string, mimeType: string, fileName: string): File => {
    const parts = dataUrl.split(',');
    const binaryStr = atob(parts[1]!);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    return new File([bytes], fileName, { type: mimeType });
};

/** sceneData JSON 문자열을 LZ-String으로 압축 */
export const compressScene = (sceneJson: string): string => {
    return LZString.compressToBase64(sceneJson);
};

/** LZ-String 압축된 문자열을 sceneData JSON으로 복원 */
export const decompressScene = (compressed: string): string => {
    return LZString.decompressFromBase64(compressed) || '';
};

// ── 모듈 레벨 pending 파일 추적 (form.vue에서 orcPkVl 업데이트용) ──
const _pendingFlMngNos = ref<string[]>([]);

/**
 * Excalidraw 첨부파일 저장/로딩 Composable
 */
export const useExcalidrawAttachment = () => {
    const config = useRuntimeConfig();
    const { $apiFetch } = useNuxtApp();
    const API_BASE = `${config.public.apiBase}/api/files`;

    /**
     * 이미지 dataURL을 binary 파일로 업로드
     * @returns 업로드된 flMngNo
     */
    const uploadImageFile = async (dataUrl: string, mimeType: string, fileId: string): Promise<string> => {
        const ext = mimeType.split('/')[1] || 'png';
        const file = dataUrlToFile(dataUrl, mimeType, `excalidraw-img-${fileId}.${ext}`);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('flDtt', '이미지');
        formData.append('orcPkVl', '');
        formData.append('orcDtt', '요구사항정의서');

        const result = await $apiFetch<{ flMngNo: string }>(API_BASE, {
            method: 'POST',
            body: formData
        });
        return result.flMngNo;
    };

    /**
     * LZ-String 압축된 sceneData를 파일로 업로드
     * @returns 업로드된 flMngNo
     */
    const uploadSceneFile = async (compressed: string): Promise<string> => {
        const blob = new Blob([compressed], { type: 'text/plain' });
        const file = new File([blob], 'excalidraw-scene.lzstr', { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', file);
        formData.append('flDtt', '이미지');
        formData.append('orcPkVl', '');
        formData.append('orcDtt', '요구사항정의서');

        const result = await $apiFetch<{ flMngNo: string }>(API_BASE, {
            method: 'POST',
            body: formData
        });
        return result.flMngNo;
    };

    /**
     * sceneData를 첨부파일로 저장
     * 임베드 이미지는 개별 파일로, sceneData는 LZ-String 압축 후 저장합니다.
     * @param sceneData - Excalidraw 장면 JSON 문자열
     * @returns scene 파일의 flMngNo
     */
    const saveScene = async (sceneData: string): Promise<string> => {
        const { modifiedScene, files } = extractFiles(sceneData);
        const uploadedFileIds: string[] = [];

        // ① 이미지 병렬 업로드
        const imageFlMngNos = await Promise.all(
            files.map(f => uploadImageFile(f.dataUrl, f.mimeType, f.fileId))
        );
        uploadedFileIds.push(...imageFlMngNos);

        // ② sceneData.files에 attachmentId 참조 삽입
        const parsedScene = JSON.parse(modifiedScene) as {
            files?: Record<string, { mimeType?: string; attachmentId?: string; [key: string]: unknown }>;
            [key: string]: unknown;
        };
        files.forEach((f, idx) => {
            if (parsedScene.files?.[f.fileId]) {
                parsedScene.files[f.fileId]!.attachmentId = imageFlMngNos[idx];
            }
        });

        // ③ sceneData LZ-String 압축 → scene 파일 업로드
        const compressed = compressScene(JSON.stringify(parsedScene));
        const sceneFlMngNo = await uploadSceneFile(compressed);
        uploadedFileIds.push(sceneFlMngNo);

        // pending 추적 (form.vue에서 orcPkVl 업데이트용)
        _pendingFlMngNos.value.push(...uploadedFileIds);

        return sceneFlMngNo;
    };

    /**
     * scene 첨부파일에서 sceneData 복원
     * 이미지 참조(attachmentId)를 dataURL로 복원합니다.
     * @param flMngNo - scene 파일의 관리번호
     * @returns 복원된 sceneData JSON 문자열
     */
    const loadScene = async (flMngNo: string): Promise<string> => {
        // ① scene 파일 다운로드 → 압축 해제
        const compressed = await $apiFetch<string>(`${API_BASE}/${flMngNo}/download`, {
            responseType: 'text'
        });
        const sceneJson = decompressScene(compressed);
        const parsed = JSON.parse(sceneJson) as {
            files?: Record<string, { attachmentId?: string; mimeType?: string; dataURL?: string; [key: string]: unknown }>;
            [key: string]: unknown;
        };

        // ② 이미지 첨부파일 병렬 fetch → dataURL 복원
        if (parsed.files) {
            const imageEntries = Object.entries(parsed.files).filter(([, v]) => v.attachmentId);
            await Promise.all(
                imageEntries.map(async ([fileId, fileData]) => {
                    const imageFlMngNo = fileData.attachmentId!;
                    const blob = await $apiFetch<Blob>(`${API_BASE}/${imageFlMngNo}/preview`, {
                        responseType: 'blob'
                    });
                    const dataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                    parsed.files![fileId]!.dataURL = dataUrl;
                    delete parsed.files![fileId]!.attachmentId;
                })
            );
        }

        return JSON.stringify(parsed);
    };

    /** 업로드된 Excalidraw 파일 관리번호 목록 반환 */
    const getPendingFlMngNos = (): string[] => [..._pendingFlMngNos.value];

    /** pending 목록 초기화 (orcPkVl 업데이트 완료 후 호출) */
    const clearPendingFlMngNos = (): void => {
        _pendingFlMngNos.value = [];
    };

    return {
        saveScene,
        loadScene,
        getPendingFlMngNos,
        clearPendingFlMngNos
    };
};
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

```bash
cd it_frontend && npx vitest run tests/unit/composables/useExcalidrawAttachment.test.ts
```

Expected: `Tests 6 passed (6)`

- [ ] **Step 5: 타입 검사**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | grep -i "error" | head -20
```

Expected: useExcalidrawAttachment 관련 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add it_frontend/app/composables/useExcalidrawAttachment.ts it_frontend/tests/unit/composables/useExcalidrawAttachment.test.ts
git commit -m "feat: useExcalidrawAttachment — Excalidraw 장면 첨부파일 저장/로딩 composable 추가"
```

---

## Task 3: useExcalidrawDialog — attachmentId 필드 추가

**Files:**
- Modify: `it_frontend/app/composables/useExcalidrawDialog.ts`

- [ ] **Step 1: ExcalidrawSaveData 인터페이스에 attachmentId 추가**

`useExcalidrawDialog.ts`의 `ExcalidrawSaveData` 인터페이스를 교체:

```typescript
/** 저장 시 전달되는 다이어그램 데이터 */
interface ExcalidrawSaveData {
    /** SVG 문자열 (에디터 내 인라인 미리보기용) */
    svgContent: string;
    /** Excalidraw 장면 JSON 문자열 (인메모리 편집용, HTML에는 직렬화되지 않음) */
    sceneData: string | null;
    /** 업로드된 scene 파일의 flMngNo */
    attachmentId: string | null;
}
```

- [ ] **Step 2: 타입 검사**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | grep -i "error" | head -20
```

Expected: 타입 에러 없음 (attachmentId가 추가되어 기존 confirm 호출부에서 에러 발생할 수 있음 — Task 4에서 수정)

- [ ] **Step 3: 커밋**

```bash
git add it_frontend/app/composables/useExcalidrawDialog.ts
git commit -m "feat: ExcalidrawSaveData에 attachmentId 필드 추가"
```

---

## Task 4: TiptapToolbar.vue — handleExcalidrawSave 업로드 로직 추가

**Files:**
- Modify: `it_frontend/app/components/TiptapToolbar.vue`

- [ ] **Step 1: `isExcalidrawSaving` ref 및 `saveScene` 추가**

TiptapToolbar.vue에서 `const { isOpen: isExcalidrawOpen, ...} = useExcalidrawDialog();` 선언 바로 아래에 추가:

```typescript
/** Excalidraw 다이어그램 업로드 중 여부 */
const isExcalidrawSaving = ref(false);
const { saveScene } = useExcalidrawAttachment();
```

- [ ] **Step 2: `handleExcalidrawSave` 업로드 로직으로 교체**

기존:
```typescript
/** Excalidraw 다이얼로그에서 저장 버튼 클릭 */
const handleExcalidrawSave = async () => {
    const data = await excalidrawWrapperRef.value?.exportData();
    if (data) {
        confirmExcalidraw(data);
    }
};
```

교체:
```typescript
/** Excalidraw 다이얼로그에서 저장 버튼 클릭 */
const handleExcalidrawSave = async () => {
    const data = await excalidrawWrapperRef.value?.exportData();
    if (!data) return;

    isExcalidrawSaving.value = true;
    try {
        // sceneData를 첨부파일로 업로드 (이미지 분리 + LZ-String 압축)
        const attachmentId = await saveScene(data.sceneData);
        confirmExcalidraw({
            svgContent: data.svgContent,
            sceneData: data.sceneData,
            attachmentId
        });
    } finally {
        isExcalidrawSaving.value = false;
    }
};
```

- [ ] **Step 3: 저장 버튼에 loading 상태 바인딩**

기존:
```html
<Button label="다이어그램 저장" icon="pi pi-check" @click="handleExcalidrawSave" />
```

교체:
```html
<Button label="다이어그램 저장" icon="pi pi-check" :loading="isExcalidrawSaving" @click="handleExcalidrawSave" />
```

- [ ] **Step 4: `insertExcalidraw` 콜백 — attachmentId 포함**

기존:
```typescript
const insertExcalidraw = () => {
    openExcalidraw(null, (data) => {
        props.editor?.chain().focus().insertContent({
            type: 'excalidraw',
            attrs: {
                svgContent: data.svgContent,
                sceneData: data.sceneData
            }
        }).run();
    });
};
```

교체:
```typescript
const insertExcalidraw = () => {
    openExcalidraw(null, (data) => {
        props.editor?.chain().focus().insertContent({
            type: 'excalidraw',
            attrs: {
                svgContent: data.svgContent,
                sceneData: data.sceneData,
                attachmentId: data.attachmentId
            }
        }).run();
    });
};
```

- [ ] **Step 5: 타입 검사**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | grep -i "error" | head -20
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add it_frontend/app/components/TiptapToolbar.vue
git commit -m "feat: TiptapToolbar — Excalidraw 저장 시 첨부파일 업로드 로직 추가"
```

---

## Task 5: tiptap-extensions.ts — attachmentId 속성 및 직렬화 수정

**Files:**
- Modify: `it_frontend/app/components/extensions/tiptap-extensions.ts`

- [ ] **Step 1: `addAttributes`에 `attachmentId` 추가**

기존:
```typescript
addAttributes() {
    return {
        /** 에디터 내 미리보기용 SVG 문자열 */
        svgContent: { default: '' },
        /** 재편집을 위한 Excalidraw 장면 JSON 문자열 */
        sceneData: { default: null }
    };
},
```

교체:
```typescript
addAttributes() {
    return {
        /** 에디터 내 미리보기용 SVG 문자열 */
        svgContent: { default: '' },
        /** 재편집을 위한 Excalidraw 장면 JSON 문자열 (인메모리, HTML에 직렬화 안 됨) */
        sceneData: { default: null },
        /** 업로드된 scene 파일의 flMngNo */
        attachmentId: { default: null }
    };
},
```

- [ ] **Step 2: `parseHTML` — 신규 형식(data-attachment-id) 처리 추가**

기존 `parseHTML()` 반환 배열:
```typescript
parseHTML() {
    return [
        {
            tag: 'figure[data-type="excalidraw"]',
            getAttrs: (element) => {
                const el = element as HTMLElement;
                const img = el.querySelector('img');
                return extractExcalidrawAttrs(el, img);
            }
        },
        {
            tag: 'img[src^="data:image/svg+xml"]',
            getAttrs: (element) => {
                const img = element as HTMLImageElement;
                const attrs = extractExcalidrawAttrs(null, img);
                if (attrs.sceneData) return attrs;
                return false;
            }
        }
    ];
},
```

교체:
```typescript
parseHTML() {
    return [
        {
            // 신규 형식: data-attachment-id만 있는 figure
            tag: 'figure[data-type="excalidraw"][data-attachment-id]',
            getAttrs: (element) => {
                const el = element as HTMLElement;
                return {
                    attachmentId: el.dataset.attachmentId || null,
                    svgContent: '',
                    sceneData: null
                };
            }
        },
        {
            // 구형식: data-scene이 있는 figure (하위 호환)
            tag: 'figure[data-type="excalidraw"]',
            getAttrs: (element) => {
                const el = element as HTMLElement;
                const img = el.querySelector('img');
                return extractExcalidrawAttrs(el, img);
            }
        },
        {
            // 백엔드 sanitizer에 의해 figure가 잘리고 img만 남은 경우 (구형식 하위 호환)
            tag: 'img[src^="data:image/svg+xml"]',
            getAttrs: (element) => {
                const img = element as HTMLImageElement;
                const attrs = extractExcalidrawAttrs(null, img);
                if (attrs.sceneData) return attrs;
                return false;
            }
        }
    ];
},
```

- [ ] **Step 3: `renderHTML` — attachmentId가 있으면 간결한 형식으로 출력**

기존 `renderHTML` 전체를 교체:

```typescript
renderHTML({ node }) {
    // 신규 형식: attachmentId가 있으면 HTML에 ID만 기록 (sceneData 인라인 저장 안 함)
    if (node.attrs.attachmentId) {
        return [
            'figure',
            {
                'data-type': 'excalidraw',
                'data-attachment-id': node.attrs.attachmentId,
                style: 'margin: 1rem 0;'
            }
        ];
    }

    // 구형식 폴백: attachmentId 없는 경우 (레거시 노드 또는 업로드 전)
    const encodedScene = node.attrs.sceneData
        ? btoa(encodeURIComponent(node.attrs.sceneData))
        : '';

    let finalSvgContent = node.attrs.svgContent || '';
    if (encodedScene && finalSvgContent.includes('</svg>')) {
        finalSvgContent = finalSvgContent.replace('</svg>', `<!-- excalidraw-scene-data:${encodedScene} --></svg>`);
    }

    return [
        'figure',
        {
            'data-type': 'excalidraw',
            'data-scene': encodedScene,
            style: 'margin: 1rem 0;'
        },
        [
            'img',
            {
                src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(finalSvgContent)}`,
                style: 'max-width: 100%; display: block;',
                alt: 'Excalidraw 다이어그램'
            }
        ]
    ];
},
```

- [ ] **Step 4: 타입 검사**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | grep -i "error" | head -20
```

Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/components/extensions/tiptap-extensions.ts
git commit -m "feat: Excalidraw 노드에 attachmentId 속성 추가 및 renderHTML/parseHTML 분기 처리"
```

---

## Task 6: ExcalidrawNodeView.vue — 첨부파일 기반 로딩 추가

**Files:**
- Modify: `it_frontend/app/components/ExcalidrawNodeView.vue`

- [ ] **Step 1: `localSceneData`와 `loadAndRenderFromAttachment` 추가**

`displaySvgUrl` ref 선언 바로 아래에 추가:

```typescript
/** 첨부파일에서 로드된 sceneData (페이지 재로드 후 편집 시 사용) */
const localSceneData = ref<string | null>(null);

/**
 * 첨부파일에서 sceneData를 로드하고 SVG 재생성
 * data-attachment-id 형식으로 저장된 노드를 화면에 렌더링합니다.
 */
const loadAndRenderFromAttachment = async (attachmentId: string) => {
    try {
        const { loadScene } = useExcalidrawAttachment();
        const fullSceneData = await loadScene(attachmentId);
        localSceneData.value = fullSceneData;

        const { exportToSvg } = await import('@excalidraw/excalidraw');
        const parsed = JSON.parse(fullSceneData);
        const svgEl = await exportToSvg({
            elements: parsed.elements || [],
            appState: {
                ...(parsed.appState || {}),
                exportWithDarkMode: false,
                exportBackground: true
            },
            files: parsed.files || {}
        });
        setSvgUrl(new XMLSerializer().serializeToString(svgEl));
    } catch (e) {
        console.error('[ExcalidrawNodeView] 첨부파일에서 장면 로드 실패:', e);
    }
};
```

- [ ] **Step 2: `onMounted` 로직 수정**

기존:
```typescript
onMounted(() => {
    if (props.node.attrs.svgContent) {
        setSvgUrl(props.node.attrs.svgContent);
    } else {
        regenerateSvgFromSceneData();
    }
});
```

교체:
```typescript
onMounted(() => {
    if (props.node.attrs.svgContent) {
        // svgContent가 있으면 바로 표시
        setSvgUrl(props.node.attrs.svgContent);
    } else if (props.node.attrs.attachmentId) {
        // 신규 형식: 첨부파일에서 sceneData 로드 후 SVG 재생성
        loadAndRenderFromAttachment(props.node.attrs.attachmentId);
    } else if (props.node.attrs.sceneData) {
        // 구형식 폴백: sceneData에서 직접 SVG 재생성
        regenerateSvgFromSceneData();
    }
});
```

- [ ] **Step 3: `onEdit` 수정 — localSceneData 활용 및 attachmentId 전달**

기존:
```typescript
const onEdit = () => {
    openExcalidrawDialog(
        props.node.attrs.sceneData || null,
        (data) => {
            props.updateAttributes({
                svgContent: data.svgContent,
                sceneData: data.sceneData
            });
        }
    );
};
```

교체:
```typescript
const onEdit = () => {
    // 인메모리 sceneData 우선, 없으면 첨부파일에서 로드된 localSceneData 사용
    const sceneForEdit = props.node.attrs.sceneData || localSceneData.value;
    openExcalidrawDialog(
        sceneForEdit,
        (data) => {
            // 업로드 후 localSceneData를 최신 sceneData로 갱신
            localSceneData.value = data.sceneData;
            props.updateAttributes({
                svgContent: data.svgContent,
                sceneData: data.sceneData,
                attachmentId: data.attachmentId
            });
        }
    );
};
```

- [ ] **Step 4: 타입 검사**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | grep -i "error" | head -20
```

Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/components/ExcalidrawNodeView.vue
git commit -m "feat: ExcalidrawNodeView — 첨부파일 기반 장면 로드 및 localSceneData 관리"
```

---

## Task 7: form.vue — Excalidraw pending 파일 orcPkVl 업데이트

**Files:**
- Modify: `it_frontend/app/pages/info/documents/form.vue`

- [ ] **Step 1: useExcalidrawAttachment import 추가**

`form.vue`의 `<script setup lang="ts">` 상단 import 영역 (`useDocuments`, `useFiles` import 아래)에 추가:

```typescript
import { useExcalidrawAttachment } from '~/composables/useExcalidrawAttachment';

const { getPendingFlMngNos, clearPendingFlMngNos } = useExcalidrawAttachment();
```

- [ ] **Step 2: onSave에 Excalidraw 파일 orcPkVl 업데이트 단계 추가**

기존 `onSave`의 step 3 이후 (`for (const flMngNo of pendingAttachmentIds.value)` 루프 완료 직후):

```typescript
// 4단계: Excalidraw 장면 파일 및 임베드 이미지의 orcPkVl을 실제 docMngNo로 업데이트
for (const flMngNo of getPendingFlMngNos()) {
    await updateFileMeta(flMngNo, { orcPkVl: docMngNo });
}
clearPendingFlMngNos();
```

- [ ] **Step 3: 타입 검사**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | grep -i "error" | head -20
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add it_frontend/app/pages/info/documents/form.vue
git commit -m "feat: form.vue — 저장 후 Excalidraw 파일 orcPkVl 업데이트"
```

---

## Task 8: [id]/index.vue — Excalidraw pending 파일 orcPkVl 업데이트

**Files:**
- Modify: `it_frontend/app/pages/info/documents/[id]/index.vue`

- [ ] **Step 1: useExcalidrawAttachment import 추가**

`[id]/index.vue`의 `<script setup lang="ts">` 상단 import 영역에 추가:

```typescript
import { useExcalidrawAttachment } from '~/composables/useExcalidrawAttachment';

const { getPendingFlMngNos, clearPendingFlMngNos } = useExcalidrawAttachment();
```

- [ ] **Step 2: onSave에 Excalidraw 파일 orcPkVl 업데이트 단계 추가**

기존 `onSave`의 step 3 (새 첨부파일 일괄 업로드) 이후, `toast.add` 호출 직전:

```typescript
// 4단계: Excalidraw 장면 파일 및 임베드 이미지의 orcPkVl을 실제 docMngNo로 업데이트
for (const flMngNo of getPendingFlMngNos()) {
    await updateFileMeta(flMngNo, { orcPkVl: docMngNo });
}
clearPendingFlMngNos();
```

- [ ] **Step 3: 타입 검사**

```bash
cd it_frontend && npx nuxt typecheck 2>&1 | grep -i "error" | head -20
```

Expected: 에러 없음

- [ ] **Step 4: 전체 테스트 실행**

```bash
cd it_frontend && npm test
```

Expected: 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/pages/info/documents/[id]/index.vue
git commit -m "feat: [id]/index.vue — 수정 저장 후 Excalidraw 파일 orcPkVl 업데이트"
```

---

## Task 9: console.log 제거

**Files:**
- Modify: `it_frontend/app/components/extensions/tiptap-extensions.ts`

- [ ] **Step 1: tiptap-extensions.ts의 디버그 console.log 제거**

`tiptap-extensions.ts` 117~118번째 줄의 디버그 로그를 제거한다:

```typescript
// 제거 대상 (해당 줄 전체 삭제):
// 디버그 (문제 해결 후 제거)
console.log('[ExcalidrawExt extract] rawDataScene:', rawDataScene?.substring(0, 50), 'sceneData from SVG:', !!sceneData);
```

- [ ] **Step 2: 전체 테스트 실행**

```bash
cd it_frontend && npm test
```

Expected: 모든 테스트 통과

- [ ] **Step 3: 최종 커밋**

```bash
git add it_frontend/app/components/extensions/tiptap-extensions.ts
git commit -m "chore: Excalidraw 디버그 console.log 제거"
```

---

## 검증 체크리스트

구현 완료 후 `/qa` 스킬로 아래 시나리오를 검증한다:

- [ ] 신규 문서 작성 → Excalidraw 다이어그램 삽입 (이미지 없음) → 저장 → DB에 `data-attachment-id`만 저장되는지 확인
- [ ] 신규 문서 작성 → Excalidraw 다이어그램 삽입 (이미지 임베드 포함) → 저장 → `/api/files` 목록에 이미지 + scene 파일 생성 확인
- [ ] 저장된 문서 재열람 → 다이어그램 정상 표시 확인
- [ ] 저장된 문서 편집 모드 → 기존 다이어그램 "편집" 클릭 → 다이어그램 정상 로드 확인
- [ ] 기존 `data-scene` 형식 문서 열람 → 다이어그램 정상 표시 확인 (하위 호환)
