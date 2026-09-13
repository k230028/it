# PDF 뷰어 연속 스크롤 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pdf.js 뷰어를 "현재 페이지만 렌더링·휠 넘김" 방식에서 "전 페이지를 세로로 이어 붙이고 보이는 범위만 렌더링하는 연속 스크롤"로 바꾸고, 다이얼로그 전체화면에서 툴바 오버레이가 보이지 않는 결함을 고친다.

**Architecture:** `usePdfViewer`가 전 페이지의 배율 1 크기를 캐시해 `pages`(페이지별 CSS 크기)·`rows`(행 배치와 누적 top)를 계산하고, 컴포넌트는 `v-for` 슬롯을 그려 `registerSlot`으로 canvas·텍스트 레이어를 등록한다. 스크롤 좌표로 현재 페이지·가시 행(±1행 버퍼)을 구해 가시 페이지만 렌더하고 범위를 벗어나면 취소·해제한다. 프레젠테이션은 `rows = [[currentPage]]`인 특수 레이아웃이다.

**Tech Stack:** Nuxt 4 / Vue 3 Composition API, pdfjs-dist 6, PrimeVue 4, Vitest + @vue/test-utils(jsdom)

**Spec:** `docs/superpowers/specs/2026-09-14-pdf-viewer-continuous-scroll-design.md`

## Global Constraints

- 작업 저장소는 `C:\it\it_frontend`(독립 git 저장소). 커밋은 그 안에서, 경로를 명시해 `git add`한다(`git add -A` 금지).
- 신규 주석·TSDoc은 한글. 공개 함수에는 입력과 실패 조건을 적는다.
- 생성 타입(`app/types/api/`)은 건드리지 않는다(백엔드 계약 변경 없음).
- 검증 명령: `npm run format:check`, `npm run check`, `npm test` (루트 `C:\it\it_frontend`).
- 내가 쓴 파일이 LF면 `npm run format`(prettier)으로 정리한 뒤 `format:check`를 돌린다.
- pdf.js 뷰포트 크기는 `Math.floor`로 정수화해 슬롯 크기와 canvas 스타일 크기가 같게 한다.
- 상수: `PDF_SPREAD_GAP = 16`(행 안 가로 간격, 기존), `PDF_PAGE_GAP = 16`(행 사이 세로 간격, 신규), 렌더 버퍼 = 앞뒤 1행.

---

## 파일 구조

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `app/composables/pdf/usePdfViewer.ts` | 문서 열기, 레이아웃(`pages`/`rows`), 스크롤 추적, 가시 페이지 렌더·취소, 이동·배율·회전·펼침·프레젠테이션 | 재작성 |
| `app/composables/pdf/usePdfSearch.ts` | 검색·하이라이트. `visibleLayers`는 "렌더된 레이어", 새 옵션 `isPageVisible`로 화면 안 여부 판정 | 소폭 수정 |
| `app/components/common/PdfViewer.vue` | 행·페이지 슬롯 `v-for`, 슬롯 등록, 키보드, 프레젠테이션, 인쇄·속성(기존) | 본문·스크립트 수정, 휠 넘김 삭제 |
| `app/components/common/pdf/PdfViewerToolbar.vue` | 배율 `Select`·더 보기 `Menu`를 `append-to="self"` | 2줄 |
| `app/components/common/pdf/PdfPropertiesDialog.vue` | `Dialog`를 `append-to="self"` | 1줄 |
| `tests/unit/composables/pdf/usePdfViewer.test.ts` | 새 API 기준 재작성 | 재작성 |
| `tests/unit/composables/pdf/usePdfSearch.test.ts` | `isPageVisible`·이동 후 하이라이트 | 추가 |
| `tests/unit/components/common/PdfViewer.test.ts` | 슬롯 렌더·등록, 검색 연동, 프레젠테이션, 휠 테스트 삭제 | 수정 |
| `tests/unit/components/common/pdf/PdfViewerToolbar.test.ts`, `PdfPropertiesDialog.test.ts` | `appendTo` 단언 | 추가 |
| `docs/guides/components/common-components.md` | 뷰어 동작 설명 갱신 | 문단 수정 |

---

### Task 1: `usePdfViewer` 연속 스크롤 모델로 재작성

**Files:**
- Modify: `app/composables/pdf/usePdfViewer.ts` (전체)
- Test: `tests/unit/composables/pdf/usePdfViewer.test.ts` (전체 재작성)

**Interfaces:**
- Consumes: `~/utils/pdfjs`의 `loadPdfjs()` (기존)
- Produces (Task 2·3이 사용):

```ts
export const PDF_PAGE_GAP = 16;
export interface PdfPageLayout { page: number; width: number; height: number }
export interface PdfRowLayout { pages: number[]; top: number; height: number }
export interface PdfPageSlot { canvas: HTMLCanvasElement; textLayer: HTMLElement | null }
export interface UsePdfViewerOptions {
    src: Ref<string | null>;
    container: Ref<HTMLElement | null>;
    fitPadding?: number;
    onError?: (error: unknown) => void;
}
// UsePdfViewer에 추가되는 멤버
pages: ShallowRef<PdfPageLayout[]>;
rows: ComputedRef<PdfRowLayout[]>;
renderedPages: Ref<number[]>;
presentation: Ref<boolean>;
registerSlot(page: number, slot: PdfPageSlot): void;
unregisterSlot(page: number): void;
getSlot(page: number): PdfPageSlot | null;
setPresentation(active: boolean): void;
// 삭제되는 옵션: canvas, textLayer, secondCanvas, secondTextLayer
```

- [ ] **Step 1: 실패하는 테스트 작성 — 테스트 파일 전체를 아래 내용으로 교체**

`tests/unit/composables/pdf/usePdfViewer.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import {
    PDF_PAGE_GAP,
    usePdfViewer,
    type PdfPageSlot,
    type UsePdfViewer,
} from '~/composables/pdf/usePdfViewer';

/* ── pdf.js 대역 ── */
const getDocument = vi.fn();
/** TextLayer 대역: 생성 인자를 기록하고 컨테이너에 span 하나를 넣습니다. */
const textLayerInstances: Array<{
    params: { container: HTMLElement; viewport: unknown };
    render: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
}> = [];
class FakeTextLayer {
    render = vi.fn(async () => {
        this.params.container.append(document.createElement('span'));
    });
    cancel = vi.fn();
    constructor(public params: { container: HTMLElement; viewport: unknown }) {
        textLayerInstances.push(this);
    }
}
vi.mock('~/utils/pdfjs', () => ({
    loadPdfjs: async () => ({ getDocument, TextLayer: FakeTextLayer }),
}));

interface FakeRenderTask {
    page: number;
    promise: Promise<void>;
    cancel: ReturnType<typeof vi.fn>;
    resolve: () => void;
}
const renderTasks: FakeRenderTask[] = [];
/** false면 렌더가 완료되지 않은 채 남아 취소 경로를 검증할 수 있습니다. */
let autoResolveRender = true;
/** 600×800pt 세로 페이지. 90°/270° 회전이면 폭·높이를 바꿔 돌려줍니다. cancel은 실제 pdf.js처럼 RenderingCancelledException으로 거부합니다. */
const createPage = (number: number, baseWidth = 600, baseHeight = 800) => ({
    number,
    getViewport: ({ scale, rotation = 0 }: { scale: number; rotation?: number }) => {
        const flipped = rotation % 180 !== 0;
        return {
            width: (flipped ? baseHeight : baseWidth) * scale,
            height: (flipped ? baseWidth : baseHeight) * scale,
            rotation,
            scale,
        };
    },
    streamTextContent: vi.fn(() => 'stream'),
    render: vi.fn(() => {
        let resolve!: () => void;
        let reject!: (reason: unknown) => void;
        const promise = new Promise<void>((resolvePromise, rejectPromise) => {
            resolve = resolvePromise;
            reject = rejectPromise;
        });
        const task: FakeRenderTask = {
            page: number,
            promise,
            resolve,
            cancel: vi.fn(() => {
                const cancelled = new Error('cancelled');
                cancelled.name = 'RenderingCancelledException';
                reject(cancelled);
            }),
        };
        if (autoResolveRender) resolve();
        renderTasks.push(task);
        return task;
    }),
});
type FakePage = ReturnType<typeof createPage>;
const createDocument = (numPages: number, size?: { width: number; height: number }) => {
    const pages = Array.from({ length: numPages }, (_, index) =>
        createPage(index + 1, size?.width, size?.height),
    );
    return {
        pages,
        doc: {
            numPages,
            getPage: vi.fn(async (number: number) => pages[number - 1]!),
        },
        loadingTask: { destroy: vi.fn(async () => undefined) },
    };
};
const queueDocument = (numPages: number, size?: { width: number; height: number }) => {
    const fixture = createDocument(numPages, size);
    getDocument.mockReturnValueOnce({
        promise: Promise.resolve(fixture.doc),
        destroy: fixture.loadingTask.destroy,
    });
    return fixture;
};
/** 페이지별 render 호출 횟수 */
const renderCalls = (page: FakePage) => page.render.mock.calls.length;
/** 페이지가 마지막으로 render된 배율 */
const lastRenderScale = (page: FakePage) =>
    (page.render.mock.calls.at(-1)?.[0] as { viewport: { scale: number } } | undefined)?.viewport
        .scale;

/**
 * 컨테이너 900×1000px. 실제 컴포넌트처럼 `rows`를 v-for로 그려 슬롯을 등록합니다.
 * 슬롯 wrapper는 `.slot[data-page]`, 안에 canvas와 `.layer`가 있습니다.
 */
const setup = (
    initialSrc: string | null = null,
    options: { withTextLayer?: boolean; fitPadding?: number } = {},
) => {
    const src = ref<string | null>(initialSrc);
    const onError = vi.fn();
    let viewer!: UsePdfViewer;
    const wrapper = mount(
        defineComponent({
            setup() {
                const container = ref<HTMLElement | null>(null);
                viewer = usePdfViewer({ src, container, fitPadding: options.fitPadding, onError });
                const bind = (page: number) => (el: unknown) => {
                    if (!(el instanceof HTMLElement)) {
                        viewer.unregisterSlot(page);
                        return;
                    }
                    const slot: PdfPageSlot = {
                        canvas: el.querySelector('canvas')!,
                        textLayer: options.withTextLayer ? el.querySelector('.layer') : null,
                    };
                    viewer.registerSlot(page, slot);
                };
                return () =>
                    h(
                        'div',
                        { ref: container },
                        viewer.rows.value.map((row) =>
                            h(
                                'div',
                                { class: 'row', key: row.pages[0] },
                                row.pages.map((page) =>
                                    h(
                                        'div',
                                        { class: 'slot', 'data-page': page, key: page, ref: bind(page) },
                                        [h('canvas'), h('div', { class: 'layer' })],
                                    ),
                                ),
                            ),
                        ),
                    );
            },
        }),
    );
    const container = wrapper.element as HTMLElement;
    Object.defineProperty(container, 'clientWidth', { value: 900, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 1000, configurable: true });
    /** 컨테이너를 실제 스크롤한 것처럼 scrollTop을 바꾸고 scroll 이벤트를 보냅니다. */
    const scrollTo = async (top: number) => {
        container.scrollTop = top;
        container.dispatchEvent(new Event('scroll'));
        await nextTick();
    };
    const canvasOf = (page: number) =>
        wrapper.find(`.slot[data-page="${page}"] canvas`).element as HTMLCanvasElement;
    const layerOf = (page: number) =>
        wrapper.find(`.slot[data-page="${page}"] .layer`).element as HTMLElement;
    return { wrapper, src, onError, viewer, container, scrollTo, canvasOf, layerOf };
};

/** 문서를 열고 초기 렌더까지 끝냅니다. */
const open = async (numPages = 3, size?: { width: number; height: number }, options = {}) => {
    const fixture = queueDocument(numPages, size);
    const env = setup('blob:doc', options);
    await flushPromises();
    await nextTick();
    await flushPromises();
    return { ...env, ...fixture };
};

describe('usePdfViewer', () => {
    beforeEach(() => {
        renderTasks.length = 0;
        textLayerInstances.length = 0;
        autoResolveRender = true;
        getDocument.mockReset();
        /* 스크롤 추적은 rAF로 스로틀되므로 즉시 실행되게 합니다. */
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        vi.stubGlobal('cancelAnimationFrame', () => undefined);
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('문서를 열면 전 페이지 크기를 자동 배율(폭 맞춤, 125% 상한)로 배치하고 첫 행과 버퍼 한 행만 그린다', async () => {
        const { viewer, pages, canvasOf, wrapper } = await open(3);
        expect(viewer.loading.value).toBe(false);
        expect(viewer.pageCount.value).toBe(3);
        expect(viewer.scale.value).toBe(1.25);
        expect(viewer.pages.value).toEqual([
            { page: 1, width: 750, height: 1000 },
            { page: 2, width: 750, height: 1000 },
            { page: 3, width: 750, height: 1000 },
        ]);
        expect(viewer.rows.value).toEqual([
            { pages: [1], top: 0, height: 1000 },
            { pages: [2], top: 1000 + PDF_PAGE_GAP, height: 1000 },
            { pages: [3], top: 2 * (1000 + PDF_PAGE_GAP), height: 1000 },
        ]);
        expect(wrapper.findAll('.slot')).toHaveLength(3);
        /* 보이는 행 [1] + 버퍼 [2]만 렌더, 3은 비어 있음 */
        expect(viewer.visiblePages.value).toEqual([1]);
        expect(renderCalls(pages[0]!)).toBe(1);
        expect(renderCalls(pages[1]!)).toBe(1);
        expect(renderCalls(pages[2]!)).toBe(0);
        expect(canvasOf(1).style.width).toBe('750px');
        expect(canvasOf(1).style.height).toBe('1000px');
        expect(canvasOf(3).style.width).toBe('');
        expect(viewer.renderedPages.value).toEqual([1, 2]);
        expect(viewer.rendering.value).toBe(false);
        expect(viewer.currentPage.value).toBe(1);
    });

    it('스크롤 위치의 세로 중앙선이 지나는 행이 현재 페이지가 되고 범위를 벗어난 페이지는 취소·해제된다', async () => {
        const { viewer, pages, scrollTo, canvasOf } = await open(4);
        /* 행 높이 1016. 1500~2500 → 행 2·3이 보이고 버퍼로 1·4까지 렌더 */
        await scrollTo(1500);
        await flushPromises();
        expect(viewer.currentPage.value).toBe(2);
        expect(viewer.visiblePages.value).toEqual([2, 3]);
        expect(viewer.renderedPages.value).toEqual([1, 2, 3, 4]);

        /* 3500~4500 → 마지막 행(4)만 보임. 1·2는 해제 */
        await scrollTo(3500);
        await flushPromises();
        expect(viewer.currentPage.value).toBe(4);
        expect(viewer.visiblePages.value).toEqual([4]);
        expect(viewer.renderedPages.value).toEqual([3, 4]);
        expect(canvasOf(1).width).toBe(0);
        expect(renderCalls(pages[3]!)).toBe(1);

        /* 끝을 넘긴 위치는 마지막 행으로 본다 */
        await scrollTo(99999);
        expect(viewer.currentPage.value).toBe(4);
        expect(viewer.visiblePages.value).toEqual([4]);
    });

    it('goToPage는 행의 상단으로 스크롤하고 1..pageCount 범위로 보정하며 이전/다음/첫/마지막이 행 단위로 움직인다', async () => {
        const { viewer, container } = await open(3);
        viewer.goToPage(3);
        expect(container.scrollTop).toBe(2 * (1000 + PDF_PAGE_GAP));
        expect(viewer.currentPage.value).toBe(3);
        expect(viewer.canGoNext.value).toBe(false);
        viewer.goToPage(99);
        expect(viewer.currentPage.value).toBe(3);
        viewer.goToPage(0);
        expect(viewer.currentPage.value).toBe(1);
        expect(container.scrollTop).toBe(0);
        expect(viewer.canGoPrev.value).toBe(false);

        viewer.nextPage();
        expect(viewer.currentPage.value).toBe(2);
        expect(container.scrollTop).toBe(1000 + PDF_PAGE_GAP);
        viewer.prevPage();
        expect(viewer.currentPage.value).toBe(1);
        viewer.lastPage();
        expect(viewer.currentPage.value).toBe(3);
        viewer.firstPage();
        expect(viewer.currentPage.value).toBe(1);
    });

    it('확대·축소는 25% 단계로 50~400% 안에서 움직이고 보던 행의 위치를 유지하며 렌더된 페이지를 새 배율로 다시 그린다', async () => {
        const { viewer, pages, container, scrollTo } = await open(3);
        expect(viewer.canZoomOut.value).toBe(true);
        expect(viewer.canZoomIn.value).toBe(true);
        /* 2행 상단(1016)에서 확대 → 2행 상단은 1216이 된다 */
        await scrollTo(1000 + PDF_PAGE_GAP);
        viewer.zoomIn();
        await nextTick();
        await flushPromises();
        expect(viewer.zoomMode.value).toBe('custom');
        expect(viewer.scale.value).toBe(1.5);
        expect(viewer.pages.value[0]).toEqual({ page: 1, width: 900, height: 1200 });
        expect(container.scrollTop).toBe(1200 + PDF_PAGE_GAP);
        expect(lastRenderScale(pages[0]!)).toBe(1.5);
        expect(lastRenderScale(pages[1]!)).toBe(1.5);

        viewer.setZoomPercent(400);
        await nextTick();
        expect(viewer.canZoomIn.value).toBe(false);
        viewer.zoomIn();
        await nextTick();
        expect(viewer.scale.value).toBe(4);
        viewer.setZoomPercent(50);
        await nextTick();
        expect(viewer.canZoomOut.value).toBe(false);
        viewer.zoomOut();
        await nextTick();
        expect(viewer.scale.value).toBe(0.5);
        viewer.setZoomPercent(10);
        await nextTick();
        expect(viewer.zoomPercent.value).toBe(50);
    });

    it('배율 모드별로 컨테이너·여백·페이지 방향에 맞는 배율을 계산한다', async () => {
        const { viewer } = await open(1, undefined, { fitPadding: 100 });
        /* auto: 폭 맞춤 800/600=1.33 → 상한 1.25 */
        expect(viewer.scale.value).toBe(1.25);
        viewer.setZoomMode('fit-width');
        await nextTick();
        expect(viewer.scale.value).toBe(1.33);
        viewer.setZoomMode('page-fit');
        await nextTick();
        /* min(800/600, 900/800) */
        expect(viewer.scale.value).toBe(1.13);
        viewer.setZoomMode('actual');
        await nextTick();
        expect(viewer.scale.value).toBe(1);
        viewer.fitToWidth();
        await nextTick();
        expect(viewer.zoomMode.value).toBe('fit-width');
    });

    it('가로 페이지의 자동 배율은 페이지 맞춤을 기준으로 한다', async () => {
        const { viewer } = await open(1, { width: 1000, height: 500 });
        /* min(900/1000, 1000/500) = 0.9 */
        expect(viewer.scale.value).toBe(0.9);
        expect(viewer.pages.value[0]).toEqual({ page: 1, width: 900, height: 450 });
    });

    it('회전은 90° 단위로 순환하고 회전된 크기로 레이아웃·배율을 다시 계산한다', async () => {
        const { viewer, pages } = await open(2);
        viewer.rotateClockwise();
        await nextTick();
        await flushPromises();
        expect(viewer.rotation.value).toBe(90);
        /* 800×600 가로 → auto는 페이지 맞춤 min(900/800, 1000/600)=1.13 */
        expect(viewer.scale.value).toBe(1.13);
        expect(viewer.pages.value[0]).toEqual({ page: 1, width: 904, height: 678 });
        expect(
            (pages[0]!.render.mock.calls.at(-1)?.[0] as { viewport: { rotation: number } }).viewport
                .rotation,
        ).toBe(90);
        viewer.rotateCounterclockwise();
        viewer.rotateCounterclockwise();
        await nextTick();
        expect(viewer.rotation.value).toBe(270);
        viewer.rotateClockwise();
        viewer.rotateClockwise();
        await nextTick();
        expect(viewer.rotation.value).toBe(90);
    });

    it('텍스트 레이어가 등록되면 같은 뷰포트로 TextLayer를 그리고 페이지마다 renderCount를 올린다', async () => {
        const { viewer, layerOf } = await open(3, undefined, { withTextLayer: true });
        expect(viewer.renderCount.value).toBe(2);
        expect(textLayerInstances).toHaveLength(2);
        expect(textLayerInstances[0]?.params.container).toBe(layerOf(1));
        expect((textLayerInstances[0]?.params.viewport as { scale: number }).scale).toBe(1.25);
        expect(layerOf(1).style.getPropertyValue('--total-scale-factor')).toBe('1.25');
        expect(layerOf(1).children).toHaveLength(1);
        expect(layerOf(3).children).toHaveLength(0);
    });

    it('src가 바뀌면 이전 문서를 파기하고 진행 중인 렌더를 취소한 뒤 1페이지·회전 0으로 다시 연다', async () => {
        autoResolveRender = false;
        const { viewer, src, container, loadingTask, layerOf } = await open(3, undefined, {
            withTextLayer: true,
        });
        viewer.rotateClockwise();
        await nextTick();
        expect(viewer.rendering.value).toBe(true);
        const pending = renderTasks.filter((task) => task.cancel.mock.calls.length === 0);
        expect(pending.length).toBeGreaterThan(0);

        autoResolveRender = true;
        const next = queueDocument(2);
        src.value = 'blob:next';
        await flushPromises();
        await nextTick();
        await flushPromises();
        expect(loadingTask.destroy).toHaveBeenCalled();
        for (const task of pending) expect(task.cancel).toHaveBeenCalled();
        expect(viewer.document.value).toBe(next.doc);
        expect(viewer.pageCount.value).toBe(2);
        expect(viewer.currentPage.value).toBe(1);
        expect(viewer.rotation.value).toBe(0);
        expect(container.scrollTop).toBe(0);
        expect(viewer.failed.value).toBe(false);
        expect(layerOf(1).children).toHaveLength(1);
    });

    it('src가 null이 되면 문서를 비우고 상태를 초기화한다', async () => {
        const { viewer, src, loadingTask, wrapper } = await open(3);
        src.value = null;
        await flushPromises();
        await nextTick();
        expect(loadingTask.destroy).toHaveBeenCalled();
        expect(viewer.document.value).toBeNull();
        expect(viewer.pageCount.value).toBe(0);
        expect(viewer.pages.value).toEqual([]);
        expect(viewer.rows.value).toEqual([]);
        expect(viewer.visiblePages.value).toEqual([]);
        expect(viewer.renderedPages.value).toEqual([]);
        expect(wrapper.findAll('.slot')).toHaveLength(0);
        expect(viewer.loading.value).toBe(false);
    });

    it('문서 열기에 실패하면 failed를 켜고 onError로 알린다', async () => {
        const error = new Error('broken');
        getDocument.mockReturnValueOnce({ promise: Promise.reject(error), destroy: vi.fn() });
        const { viewer, onError } = setup('blob:bad');
        await flushPromises();
        expect(viewer.failed.value).toBe(true);
        expect(viewer.loading.value).toBe(false);
        expect(onError).toHaveBeenCalledWith(error);
    });

    it('페이지 렌더가 실패하면 failed를 켜고 onError로 알리며 취소는 실패로 보지 않는다', async () => {
        const fixture = queueDocument(1);
        const failure = new Error('render broken');
        fixture.pages[0]!.render.mockImplementationOnce(() => ({
            promise: Promise.reject(failure),
            cancel: vi.fn(),
        }));
        const { viewer, onError } = setup('blob:doc');
        await flushPromises();
        await nextTick();
        await flushPromises();
        expect(viewer.failed.value).toBe(true);
        expect(onError).toHaveBeenCalledWith(failure);
        expect(viewer.rendering.value).toBe(false);
    });

    it('느린 이전 문서 응답은 최신 src의 화면을 덮어쓰지 못한다', async () => {
        let resolveSlow!: (doc: unknown) => void;
        const slow = createDocument(5);
        getDocument.mockReturnValueOnce({
            promise: new Promise((resolve) => {
                resolveSlow = resolve;
            }),
            destroy: slow.loadingTask.destroy,
        });
        const { viewer, src } = setup('blob:slow');
        await flushPromises();
        const fast = queueDocument(2);
        src.value = 'blob:fast';
        await flushPromises();
        await nextTick();
        await flushPromises();
        resolveSlow(slow.doc);
        await flushPromises();
        expect(viewer.document.value).toBe(fast.doc);
        expect(viewer.pageCount.value).toBe(2);
    });

    it('refit은 컨테이너에 의존하는 모드에서만 레이아웃을 다시 계산한다', async () => {
        const { viewer, container } = await open(1);
        Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
        viewer.refit();
        await nextTick();
        expect(viewer.scale.value).toBe(1);
        viewer.setZoomPercent(200);
        await nextTick();
        Object.defineProperty(container, 'clientWidth', { value: 300, configurable: true });
        viewer.refit();
        await nextTick();
        expect(viewer.scale.value).toBe(2);
    });

    it('슬롯 등록을 해제하면 그 페이지의 렌더를 취소한다', async () => {
        autoResolveRender = false;
        const { viewer } = await open(2);
        const task = renderTasks.find((entry) => entry.page === 2)!;
        viewer.unregisterSlot(2);
        expect(task.cancel).toHaveBeenCalled();
        expect(viewer.getSlot(2)).toBeNull();
        expect(viewer.getSlot(1)).not.toBeNull();
    });

    it('언마운트 시 문서를 파기하고 렌더를 취소한다', async () => {
        autoResolveRender = false;
        const { wrapper, loadingTask } = await open(2);
        const pending = renderTasks.filter((task) => task.cancel.mock.calls.length === 0);
        wrapper.unmount();
        expect(loadingTask.destroy).toHaveBeenCalled();
        for (const task of pending) expect(task.cancel).toHaveBeenCalled();
    });

    describe('2페이지 보기', () => {
        it('홀수 페이지를 왼쪽에 두고 두 장을 한 행으로 배치하며 합산 폭 기준으로 배율을 계산한다', async () => {
            const { viewer } = await open(3);
            viewer.setSpread('double');
            await nextTick();
            await flushPromises();
            /* (600*2+16)=1216 → 900/1216=0.74 */
            expect(viewer.scale.value).toBe(0.74);
            expect(viewer.pages.value[0]).toEqual({ page: 1, width: 444, height: 592 });
            expect(viewer.rows.value).toEqual([
                { pages: [1, 2], top: 0, height: 592 },
                { pages: [3], top: 592 + PDF_PAGE_GAP, height: 592 },
            ]);
            expect(viewer.visiblePages.value).toEqual([1, 2, 3]);
        });

        it('두 장씩 이동하고 goToPage는 펼침의 왼쪽 페이지를 현재 페이지로 삼는다', async () => {
            const { viewer, container } = await open(5);
            viewer.setSpread('double');
            await nextTick();
            await flushPromises();
            viewer.nextPage();
            expect(viewer.currentPage.value).toBe(3);
            expect(container.scrollTop).toBe(592 + PDF_PAGE_GAP);
            viewer.goToPage(4);
            expect(viewer.currentPage.value).toBe(3);
            viewer.nextPage();
            expect(viewer.currentPage.value).toBe(5);
            expect(viewer.canGoNext.value).toBe(false);
            viewer.prevPage();
            expect(viewer.currentPage.value).toBe(3);
            viewer.setSpread('single');
            await nextTick();
            expect(viewer.rows.value).toHaveLength(5);
        });
    });

    describe('프레젠테이션', () => {
        it('현재 페이지 한 장만 페이지 맞춤으로 배치하고 이동은 스크롤 없이 페이지를 바꾸며 종료 시 배율을 되돌리고 그 페이지로 스크롤한다', async () => {
            const { viewer, container, pages } = await open(4);
            viewer.setZoomPercent(200);
            await nextTick();
            await flushPromises();
            viewer.setPresentation(true);
            await nextTick();
            await flushPromises();
            expect(viewer.presentation.value).toBe(true);
            expect(viewer.zoomMode.value).toBe('page-fit');
            expect(viewer.scale.value).toBe(1.25);
            expect(viewer.rows.value).toEqual([{ pages: [1], top: 0, height: 1000 }]);
            expect(viewer.visiblePages.value).toEqual([1]);

            viewer.nextPage();
            await nextTick();
            await flushPromises();
            expect(viewer.currentPage.value).toBe(2);
            expect(viewer.rows.value).toEqual([{ pages: [2], top: 0, height: 1000 }]);
            expect(container.scrollTop).toBe(0);
            expect(lastRenderScale(pages[1]!)).toBe(1.25);

            viewer.setPresentation(false);
            await nextTick();
            await flushPromises();
            expect(viewer.zoomMode.value).toBe('custom');
            expect(viewer.scale.value).toBe(2);
            expect(viewer.rows.value).toHaveLength(4);
            expect(container.scrollTop).toBe(1600 + PDF_PAGE_GAP);
            expect(viewer.currentPage.value).toBe(2);
        });

        it('2페이지 보기 중에도 한 장씩 보여 주고 종료하면 그 페이지가 속한 펼침으로 돌아간다', async () => {
            const { viewer } = await open(4);
            viewer.setSpread('double');
            await nextTick();
            viewer.setPresentation(true);
            await nextTick();
            viewer.nextPage();
            viewer.nextPage();
            await nextTick();
            expect(viewer.currentPage.value).toBe(3);
            viewer.nextPage();
            await nextTick();
            expect(viewer.currentPage.value).toBe(4);
            viewer.setPresentation(false);
            await nextTick();
            expect(viewer.currentPage.value).toBe(3);
            expect(viewer.rows.value[1]).toEqual(
                expect.objectContaining({ pages: [3, 4] }),
            );
        });
    });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/composables/pdf/usePdfViewer.test.ts`
Expected: FAIL — `PDF_PAGE_GAP`·`registerSlot`·`rows` 등이 없어 타입/런타임 오류.

- [ ] **Step 3: composable 재작성 — 파일 전체를 아래 내용으로 교체**

`app/composables/pdf/usePdfViewer.ts`:

```ts
/**
 * pdf.js 기반 연속 스크롤 뷰어 상태.
 *
 * Blob URL 하나를 열어 전 페이지의 배율 1 크기를 캐시하고, 현재 배율·회전·펼침에 따라 페이지별
 * CSS 크기(`pages`)와 세로 행 배치(`rows`)를 계산합니다. 컴포넌트는 `rows`를 v-for로 그려
 * `registerSlot`으로 canvas·텍스트 레이어를 등록하고, 이 composable은 스크롤 위치에서 보이는 행
 * (앞뒤 한 행 버퍼 포함)만 렌더하며 범위를 벗어난 페이지는 취소·해제해 메모리를 반납합니다.
 * 텍스트 레이어가 등록된 슬롯에는 같은 배율·회전으로 pdf.js `TextLayer`를 올려 선택·검색
 * 하이라이트가 가능하게 합니다.
 * 프레젠테이션(`setPresentation`)은 현재 페이지 한 장만 배치하는 특수 레이아웃입니다.
 * `src`가 바뀌거나 컴포넌트가 언마운트되면 이전 문서를 파기하고 진행 중인 렌더를 취소해
 * 느린 응답이 최신 화면을 덮거나 워커가 남지 않게 합니다.
 *
 * URL의 소유권(revoke)은 호출자에게 있습니다. 이 composable은 URL을 읽기만 합니다.
 */
import {
    computed,
    nextTick,
    onUnmounted,
    ref,
    shallowRef,
    watch,
    type ComputedRef,
    type Ref,
    type ShallowRef,
} from 'vue';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist';
import { loadPdfjs } from '~/utils/pdfjs';

/** 사용자 지정 배율의 하한(50%). 자동 계산 배율은 이 범위의 제한을 받지 않습니다. */
export const PDF_ZOOM_MIN = 0.5;
/** 사용자 지정 배율의 상한(400%). */
export const PDF_ZOOM_MAX = 4;
/** 확대·축소 버튼 한 번의 배율 단계(25%p). */
export const PDF_ZOOM_STEP = 0.25;
/** 배율 드롭다운의 고정 퍼센트 선택지 */
export const PDF_ZOOM_PRESETS = [50, 75, 100, 125, 150, 200, 300, 400] as const;
/** 2페이지 보기에서 한 행의 두 장 사이 간격(px). 컴포넌트의 gap과 같은 값이어야 배율 계산이 맞습니다. */
export const PDF_SPREAD_GAP = 16;
/** 행 사이 세로 간격(px). 컴포넌트의 gap과 같은 값이어야 행 top 계산이 맞습니다. */
export const PDF_PAGE_GAP = 16;
/** `auto` 모드의 상한. pdf.js 기본 뷰어와 같이 폭 맞춤이 125%를 넘지 않게 합니다. */
const MAX_AUTO_SCALE = 1.25;
/** 화면 밖이지만 미리 그려 두는 행 수(앞뒤 각각) */
const RENDER_BUFFER_ROWS = 1;

/**
 * 배율 모드.
 * - `auto`: 폭 맞춤(가로 페이지는 페이지 맞춤)을 125% 상한으로 자동 계산
 * - `actual`: 실제 크기(100%)
 * - `page-fit`: 페이지 전체가 영역 안에 들어오는 배율
 * - `fit-width`: 컨테이너 폭에 맞춘 배율
 * - `custom`: 사용자가 고른 배율 고정
 */
export type PdfZoomMode = 'auto' | 'actual' | 'page-fit' | 'fit-width' | 'custom';
export type PdfRotation = 0 | 90 | 180 | 270;
/** 펼침 모드. `double`은 홀수 페이지를 왼쪽에 두고 두 장(1-2, 3-4, …)을 한 행에 나란히 보여 줍니다. */
export type PdfSpreadMode = 'single' | 'double';

/** 현재 배율·회전이 반영된 페이지의 CSS 크기(px) */
export interface PdfPageLayout {
    page: number;
    width: number;
    height: number;
}
/** 세로로 쌓이는 한 행. `top`은 첫 행 상단 기준 누적 오프셋(px), `height`는 행 안 가장 큰 페이지 높이 */
export interface PdfRowLayout {
    pages: number[];
    top: number;
    height: number;
}
/** 컴포넌트가 페이지마다 등록하는 렌더 대상 */
export interface PdfPageSlot {
    canvas: HTMLCanvasElement;
    /** 없으면 텍스트 레이어를 만들지 않습니다. */
    textLayer: HTMLElement | null;
}

export interface UsePdfViewerOptions {
    /** 표시할 PDF의 Blob URL. null이면 문서를 닫고 상태를 초기화합니다. */
    src: Ref<string | null>;
    /** 스크롤 영역. 배율 계산 기준이자 scroll 이벤트로 현재 페이지·가시 범위를 추적하는 요소입니다. */
    container: Ref<HTMLElement | null>;
    /** 컨테이너 안쪽 여백(px). 폭·페이지 맞춤 계산에서 양쪽 합계로 제외합니다. 기본 0 */
    fitPadding?: number;
    /** 문서 열기·렌더 실패 시 호출됩니다. 취소된 렌더는 실패로 보고하지 않습니다. */
    onError?: (error: unknown) => void;
}

export interface UsePdfViewer {
    /** 문서 로딩 중(페이지 크기를 읽어 배치하기 전) 여부 */
    loading: Ref<boolean>;
    /** 페이지 렌더가 하나라도 진행 중인지 여부 */
    rendering: Ref<boolean>;
    /** 문서 열기 또는 렌더 실패 여부. 새 src를 열면 초기화됩니다. */
    failed: Ref<boolean>;
    /** 열린 pdf.js 문서. 검색·썸네일·속성처럼 부가 기능이 페이지에 접근할 때 사용합니다. */
    document: ShallowRef<PDFDocumentProxy | null>;
    /** 전체 페이지 수. 문서가 없으면 0 */
    pageCount: Ref<number>;
    /**
     * 현재 페이지(1부터). 스크롤 영역 세로 중앙선이 지나는 행의 첫 페이지이며 2페이지 보기에서는
     * 펼침의 왼쪽(홀수) 페이지입니다. 프레젠테이션에서는 표시 중인 한 장입니다. 문서가 없어도 1을 유지합니다.
     */
    currentPage: Ref<number>;
    spread: Ref<PdfSpreadMode>;
    /** 페이지별 CSS 크기. 문서가 없으면 빈 배열 */
    pages: ShallowRef<PdfPageLayout[]>;
    /** 세로 행 배치. 프레젠테이션에서는 현재 페이지 한 행뿐입니다. */
    rows: ComputedRef<PdfRowLayout[]>;
    /** 스크롤 영역과 실제로 겹치는 행의 페이지 번호들(위·왼쪽부터). 문서가 없으면 빈 배열 */
    visiblePages: ComputedRef<number[]>;
    /** canvas·텍스트 레이어까지 그려진 페이지 번호들(오름차순). 버퍼 행을 포함하므로 `visiblePages`보다 넓습니다. */
    renderedPages: Ref<number[]>;
    /** 프레젠테이션 여부. `setPresentation`으로만 바꿉니다. */
    presentation: Ref<boolean>;
    zoomMode: Ref<PdfZoomMode>;
    /** 실제 렌더에 적용된 배율(1 = 100%) */
    scale: Ref<number>;
    /** 화면 표시용 정수 퍼센트 */
    zoomPercent: ComputedRef<number>;
    rotation: Ref<PdfRotation>;
    /** 페이지 하나의 canvas·텍스트 레이어 렌더가 끝날 때마다 증가합니다. 하이라이트처럼 DOM 후처리의 트리거로 씁니다. */
    renderCount: Ref<number>;
    canGoPrev: ComputedRef<boolean>;
    canGoNext: ComputedRef<boolean>;
    canZoomIn: ComputedRef<boolean>;
    canZoomOut: ComputedRef<boolean>;
    /**
     * 페이지 슬롯을 등록합니다. 같은 요소로 다시 등록하면 무시하므로 v-for 함수 ref에서 매 렌더마다
     * 호출해도 됩니다. 등록 즉시 가시 범위에 있으면 렌더를 시작합니다.
     */
    registerSlot: (page: number, slot: PdfPageSlot) => void;
    /** 슬롯을 해제하고 그 페이지의 진행 중 렌더를 취소합니다. */
    unregisterSlot: (page: number) => void;
    /** 등록된 슬롯. 없으면 null */
    getSlot: (page: number) => PdfPageSlot | null;
    /**
     * 해당 페이지가 속한 행의 상단으로 스크롤합니다. 1..pageCount 범위 밖의 값은 가장 가까운 경계로
     * 보정합니다. 프레젠테이션에서는 스크롤 대신 그 페이지 한 장을 표시합니다. 문서가 없으면 무시합니다.
     */
    goToPage: (page: number) => void;
    /** 한 행(2페이지 보기에서는 두 장) 앞으로 */
    prevPage: () => void;
    nextPage: () => void;
    firstPage: () => void;
    lastPage: () => void;
    /** 현재 배율에서 다음 25% 단계로 확대합니다. 자동 모드였다면 사용자 지정 모드로 전환됩니다. */
    zoomIn: () => void;
    zoomOut: () => void;
    /** 폭 맞춤 모드로 되돌립니다. */
    fitToWidth: () => void;
    /** 배율 모드를 바꿉니다. `custom`은 `setZoomPercent`로만 진입합니다. */
    setZoomMode: (mode: Exclude<PdfZoomMode, 'custom'>) => void;
    /** 퍼센트 배율을 고정합니다(50~400 범위로 보정). */
    setZoomPercent: (percent: number) => void;
    /** 펼침 모드를 바꿉니다. 보던 위치는 유지되고 현재 페이지는 새 행 배치에 맞춰 다시 계산됩니다. */
    setSpread: (mode: PdfSpreadMode) => void;
    rotateClockwise: () => void;
    rotateCounterclockwise: () => void;
    /**
     * 프레젠테이션을 켜거나 끕니다. 켜면 배율을 페이지 맞춤으로 바꾸고 현재 페이지 한 장만 배치하며,
     * 끄면 이전 배율로 되돌리고 현재 페이지가 속한 행으로 스크롤합니다. 같은 상태로의 호출은 무시합니다.
     */
    setPresentation: (active: boolean) => void;
    /** 컨테이너 크기가 바뀌었을 때 호출합니다. 가시 범위를 다시 읽고, 컨테이너에 의존하는 모드면 배율도 다시 계산합니다. */
    refit: () => void;
}

/** 부동소수 오차를 없애기 위해 배율을 소수 둘째 자리로 정리합니다. */
const roundScale = (value: number) => Math.round(value * 100) / 100;

/** pdf.js가 취소된 렌더·텍스트 레이어에 던지는 예외인지 판정합니다. 클래스 인스턴스 검사는 지연 로드 모듈에 의존하므로 이름으로 비교합니다. */
const isRenderingCancelled = (error: unknown) =>
    error instanceof Error &&
    (error.name === 'RenderingCancelledException' || error.name === 'AbortException');

/** 컨테이너 크기에 따라 달라지는 모드인지 판정합니다. */
const dependsOnContainer = (mode: PdfZoomMode) =>
    mode === 'auto' || mode === 'page-fit' || mode === 'fit-width';

/** 페이지가 속한 펼침의 왼쪽(홀수) 페이지 번호 */
const spreadStart = (page: number) => (page % 2 === 0 ? page - 1 : page);

/** 슬롯을 비웁니다(범위를 벗어나거나 문서를 닫을 때). canvas 픽셀 버퍼를 0으로 만들어 메모리를 반납합니다. */
const clearSlot = (slot: PdfPageSlot) => {
    slot.canvas.width = 0;
    slot.canvas.height = 0;
    slot.canvas.style.width = '0px';
    slot.canvas.style.height = '0px';
    slot.textLayer?.replaceChildren();
};

/** 페이지 하나의 진행 중·완료 렌더 상태 */
interface PageRender {
    scale: number;
    rotation: PdfRotation;
    renderTask: RenderTask | null;
    textLayer: TextLayer | null;
    done: boolean;
}

/** 배율·회전 변경 전후로 보던 위치를 잇기 위한 기준. 행의 첫 페이지와 행 안 상대 위치(0~1) */
interface ScrollAnchor {
    page: number;
    fraction: number;
}

export const usePdfViewer = ({
    src,
    container,
    fitPadding = 0,
    onError,
}: UsePdfViewerOptions): UsePdfViewer => {
    const loading = ref(false);
    const rendering = ref(false);
    const failed = ref(false);
    const pdfDocument = shallowRef<PDFDocumentProxy | null>(null);
    const pageCount = ref(0);
    const currentPage = ref(1);
    const spread = ref<PdfSpreadMode>('single');
    const presentation = ref(false);
    /* pdf.js 기본 뷰어와 같은 '자동'(폭 맞춤을 125% 상한으로)으로 시작합니다. */
    const zoomMode = ref<PdfZoomMode>('auto');
    /** 사용자 지정 모드에서 쓰는 배율. 자동 모드에서 전환할 때 그 시점의 실제 배율로 이어집니다. */
    const customScale = ref(1);
    const scale = ref(1);
    const rotation = ref<PdfRotation>(0);
    const renderCount = ref(0);
    const pages = shallowRef<PdfPageLayout[]>([]);
    const renderedPages = ref<number[]>([]);
    /** 마지막으로 읽은 컨테이너 scrollTop·clientHeight */
    const scrollTop = ref(0);
    const viewportHeight = ref(0);

    /** 배율 1·회전 0 기준 페이지 크기(인덱스 = 페이지 - 1) */
    let baseSizes: Array<{ width: number; height: number }> = [];
    const slots = new Map<number, PdfPageSlot>();
    const renders = new Map<number, PageRender>();
    let loadingTask: PDFDocumentLoadingTask | null = null;
    /** src 변경마다 증가해 이전 열기 작업의 결과 반영을 막습니다. */
    let loadGeneration = 0;
    /** 프레젠테이션 진입 전 배율. 종료 시 되돌립니다. */
    let zoomBeforePresentation: { mode: PdfZoomMode; custom: number } | null = null;
    /** 다음 레이아웃 계산 뒤 스크롤할 위치. 현재 스크롤 위치 대신 쓸 때(프레젠테이션 종료) 지정합니다. */
    let pendingAnchor: ScrollAnchor | null = null;

    /* ── 레이아웃 ── */

    const rows = computed<PdfRowLayout[]>(() => {
        const layouts = pages.value;
        if (layouts.length === 0) return [];
        let groups: number[][];
        if (presentation.value) {
            groups = [[Math.min(currentPage.value, layouts.length)]];
        } else if (spread.value === 'double') {
            groups = [];
            for (let page = 1; page <= layouts.length; page += 2) {
                groups.push(page + 1 <= layouts.length ? [page, page + 1] : [page]);
            }
        } else {
            groups = layouts.map((layout) => [layout.page]);
        }
        let top = 0;
        return groups.map((group) => {
            const height = Math.max(...group.map((page) => layouts[page - 1]!.height));
            const row = { pages: group, top, height };
            top += height + PDF_PAGE_GAP;
            return row;
        });
    });

    /** 세로 구간 [from, to)와 겹치는 행 인덱스 범위. 없으면 null */
    const rowRangeIn = (from: number, to: number): [number, number] | null => {
        const list = rows.value;
        let first = -1;
        let last = -1;
        list.forEach((row, index) => {
            if (row.top < to && row.top + row.height > from) {
                if (first < 0) first = index;
                last = index;
            }
        });
        return first < 0 ? null : [first, last];
    };

    /** 겹치는 행이 없을 때의 기준 행: 스크롤이 0이면 첫 행, 아니면 마지막 행 */
    const fallbackRow = () => (scrollTop.value > 0 ? rows.value.at(-1)! : rows.value[0]!);

    const visiblePages = computed<number[]>(() => {
        const list = rows.value;
        if (list.length === 0) return [];
        if (presentation.value) return list[0]!.pages;
        const range = rowRangeIn(scrollTop.value, scrollTop.value + viewportHeight.value);
        /* 겹치는 행이 없으면(마운트 전이라 크기를 모르거나 끝을 넘긴 위치) 첫 행 또는 마지막 행으로 봅니다. */
        if (!range) return fallbackRow().pages;
        return list.slice(range[0], range[1] + 1).flatMap((row) => row.pages);
    });

    /** 렌더 대상: 보이는 행에 앞뒤 버퍼 행을 더한 페이지들 */
    const renderTargets = computed<number[]>(() => {
        const list = rows.value;
        if (list.length === 0) return [];
        if (presentation.value) return list[0]!.pages;
        const fallbackIndex = list.indexOf(fallbackRow());
        const range = rowRangeIn(scrollTop.value, scrollTop.value + viewportHeight.value) ?? [
            fallbackIndex,
            fallbackIndex,
        ];
        const first = Math.max(0, range[0] - RENDER_BUFFER_ROWS);
        const last = Math.min(list.length - 1, range[1] + RENDER_BUFFER_ROWS);
        return list.slice(first, last + 1).flatMap((row) => row.pages);
    });

    /** 스크롤 영역 세로 중앙선이 지나는 행(끝을 넘기면 마지막 행)의 첫 페이지를 현재 페이지로 맞춥니다. */
    const syncCurrentPage = () => {
        const list = rows.value;
        if (presentation.value || list.length === 0) return;
        const center = scrollTop.value + viewportHeight.value / 2;
        const row = list.find((entry) => center < entry.top + entry.height + PDF_PAGE_GAP) ?? list.at(-1)!;
        currentPage.value = row.pages[0]!;
    };

    const rotatedSize = (index: number) => {
        const base = baseSizes[index]!;
        return rotation.value % 180 === 0 ? base : { width: base.height, height: base.width };
    };

    /** 배율 계산의 기준이 되는 현재 행(펼침이면 두 장)의 배율 1 크기 */
    const anchorContentSize = () => {
        const count = baseSizes.length;
        const current = Math.min(currentPage.value, count);
        const numbers =
            presentation.value || spread.value === 'single'
                ? [current]
                : [spreadStart(current), spreadStart(current) + 1].filter((page) => page <= count);
        const sizes = numbers.map((page) => rotatedSize(page - 1));
        return {
            width: sizes.reduce((sum, size) => sum + size.width, 0) + PDF_SPREAD_GAP * (sizes.length - 1),
            height: Math.max(...sizes.map((size) => size.height)),
        };
    };

    /** 회전을 반영한 기본 크기(배율 1)에서 현재 모드의 배율을 계산합니다. */
    const resolveScale = (contentWidth: number, contentHeight: number) => {
        const mode = zoomMode.value;
        if (mode === 'custom') return customScale.value;
        if (mode === 'actual') return 1;
        const area = container.value;
        const availableWidth = Math.max(1, (area?.clientWidth ?? contentWidth) - fitPadding);
        const availableHeight = Math.max(1, (area?.clientHeight ?? contentHeight) - fitPadding);
        const widthScale = availableWidth / contentWidth;
        const heightScale = availableHeight / contentHeight;
        if (mode === 'fit-width') return roundScale(widthScale);
        if (mode === 'page-fit') return roundScale(Math.min(widthScale, heightScale));
        /* auto: 가로 형태(가로 페이지·펼침)는 페이지 맞춤, 세로 페이지는 폭 맞춤을 125% 상한으로 */
        const horizontal =
            contentWidth > contentHeight ? Math.min(widthScale, heightScale) : widthScale;
        return roundScale(Math.min(MAX_AUTO_SCALE, horizontal));
    };

    /* ── 스크롤 ── */

    /** 컨테이너 scrollTop·clientHeight를 상태로 옮깁니다. */
    const readScroll = () => {
        const area = container.value;
        if (!area) return;
        scrollTop.value = area.scrollTop;
        viewportHeight.value = area.clientHeight;
    };
    let scrollFrame = 0;
    const onScroll = () => {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
            scrollFrame = 0;
            readScroll();
        });
    };
    watch(
        container,
        (area, previous) => {
            previous?.removeEventListener('scroll', onScroll);
            area?.addEventListener('scroll', onScroll, { passive: true });
            readScroll();
        },
        { immediate: true },
    );

    /**
     * 컨테이너를 지정 위치로 스크롤합니다. 슬롯 높이가 아직 DOM에 반영되지 않아 브라우저가 scrollHeight로
     * 잘라낸 경우에만 다음 틱에 한 번 더 적용합니다(그 사이 다른 스크롤을 덮지 않기 위해).
     */
    const scrollTo = (top: number) => {
        scrollTop.value = top;
        const area = container.value;
        if (!area) return;
        area.scrollTop = top;
        if (area.scrollTop + 1 < top) {
            void nextTick(() => {
                if (container.value === area) area.scrollTop = top;
            });
        }
    };

    /** 지금 보고 있는 행과 행 안 상대 위치. 프레젠테이션 중이거나 행이 없으면 null */
    const captureScrollAnchor = (): ScrollAnchor | null => {
        if (presentation.value) return null;
        const row = rows.value.find(
            (entry) => scrollTop.value < entry.top + entry.height + PDF_PAGE_GAP,
        );
        if (!row) return null;
        return {
            page: row.pages[0]!,
            fraction: (scrollTop.value - row.top) / (row.height + PDF_PAGE_GAP),
        };
    };
    const restoreScrollAnchor = (anchor: ScrollAnchor | null) => {
        if (!anchor || presentation.value) return;
        const row = rows.value.find((entry) => entry.pages.includes(anchor.page));
        if (!row) return;
        scrollTo(Math.max(0, Math.round(row.top + anchor.fraction * (row.height + PDF_PAGE_GAP))));
    };

    /* ── 렌더 ── */

    const updateRenderState = () => {
        const entries = [...renders.entries()];
        rendering.value = entries.some(([, entry]) => !entry.done);
        renderedPages.value = entries
            .filter(([, entry]) => entry.done)
            .map(([page]) => page)
            .sort((a, b) => a - b);
    };

    const cancelPageRender = (page: number) => {
        const entry = renders.get(page);
        if (!entry) return;
        renders.delete(page);
        entry.renderTask?.cancel();
        entry.textLayer?.cancel();
    };

    /** 페이지 하나를 현재 배율·회전으로 슬롯에 그립니다. 도중에 취소되거나 새 렌더로 대체되면 조용히 중단합니다. */
    const renderPage = async (doc: PDFDocumentProxy, page: number, slot: PdfPageSlot) => {
        const entry: PageRender = {
            scale: scale.value,
            rotation: rotation.value,
            renderTask: null,
            textLayer: null,
            done: false,
        };
        renders.set(page, entry);
        const isStale = () => renders.get(page) !== entry || pdfDocument.value !== doc;
        try {
            const proxy = await doc.getPage(page);
            if (isStale()) return;
            const viewport = proxy.getViewport({ scale: entry.scale, rotation: entry.rotation });
            const pixelRatio = window.devicePixelRatio || 1;
            slot.canvas.width = Math.floor(viewport.width * pixelRatio);
            slot.canvas.height = Math.floor(viewport.height * pixelRatio);
            slot.canvas.style.width = `${Math.floor(viewport.width)}px`;
            slot.canvas.style.height = `${Math.floor(viewport.height)}px`;
            const task = proxy.render({
                canvas: slot.canvas,
                viewport,
                transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
            });
            entry.renderTask = task;
            await task.promise;
            entry.renderTask = null;
            if (isStale()) return;

            if (slot.textLayer) {
                const pdfjs = await loadPdfjs();
                if (isStale()) return;
                slot.textLayer.replaceChildren();
                slot.textLayer.style.setProperty('--total-scale-factor', String(entry.scale));
                const layer = new pdfjs.TextLayer({
                    textContentSource: proxy.streamTextContent(),
                    container: slot.textLayer,
                    viewport,
                });
                entry.textLayer = layer;
                await layer.render();
                entry.textLayer = null;
                if (isStale()) return;
            }
            entry.done = true;
            renderCount.value += 1;
        } catch (error) {
            if (isRenderingCancelled(error) || isStale()) return;
            renders.delete(page);
            failed.value = true;
            onError?.(error);
        } finally {
            updateRenderState();
        }
    };

    /** 렌더 대상과 렌더 상태를 맞춥니다: 범위 밖·배율 불일치는 취소하고, 슬롯이 있는 새 대상은 렌더를 시작합니다. */
    const renderVisible = () => {
        const doc = pdfDocument.value;
        const targets = new Set(doc ? renderTargets.value : []);
        for (const [page, entry] of [...renders.entries()]) {
            const outdated = entry.scale !== scale.value || entry.rotation !== rotation.value;
            if (targets.has(page) && !outdated) continue;
            cancelPageRender(page);
            const slot = slots.get(page);
            if (slot && !targets.has(page)) clearSlot(slot);
        }
        if (doc) {
            for (const page of targets) {
                const slot = slots.get(page);
                if (slot && !renders.has(page)) void renderPage(doc, page, slot);
            }
        }
        updateRenderState();
    };

    const cancelAllRenders = () => {
        for (const page of [...renders.keys()]) cancelPageRender(page);
        for (const slot of slots.values()) clearSlot(slot);
        updateRenderState();
    };

    /* ── 레이아웃 갱신 ── */

    /** 현재 배율 모드·회전·펼침으로 `scale`·`pages`를 다시 계산하고 보던 위치를 복원한 뒤 렌더를 맞춥니다. */
    const layout = () => {
        if (baseSizes.length === 0) {
            pages.value = [];
            return;
        }
        const anchor = pendingAnchor ?? captureScrollAnchor();
        pendingAnchor = null;
        const { width, height } = anchorContentSize();
        scale.value = resolveScale(width, height);
        pages.value = baseSizes.map((_, index) => {
            const size = rotatedSize(index);
            return {
                page: index + 1,
                width: Math.floor(size.width * scale.value),
                height: Math.floor(size.height * scale.value),
            };
        });
        restoreScrollAnchor(anchor);
        renderVisible();
    };

    /* ── 문서 열기·닫기 ── */

    const closeDocument = () => {
        cancelAllRenders();
        pdfDocument.value = null;
        baseSizes = [];
        pages.value = [];
        const task = loadingTask;
        loadingTask = null;
        /* destroy는 대기 중인 promise를 거부시키므로 호출자가 결과를 기다리지 않아도 됩니다. */
        void task?.destroy().catch(() => undefined);
    };

    const openDocument = async (url: string | null) => {
        const generation = ++loadGeneration;
        closeDocument();
        failed.value = false;
        pageCount.value = 0;
        currentPage.value = 1;
        rotation.value = 0;
        scrollTo(0);
        if (!url) {
            loading.value = false;
            return;
        }
        loading.value = true;
        try {
            const pdfjs = await loadPdfjs();
            if (generation !== loadGeneration) return;
            const task = pdfjs.getDocument({ url });
            loadingTask = task;
            const doc = await task.promise;
            if (generation !== loadGeneration) return;
            const sizes = await Promise.all(
                Array.from({ length: doc.numPages }, async (_, index) => {
                    const viewport = (await doc.getPage(index + 1)).getViewport({ scale: 1 });
                    return { width: viewport.width, height: viewport.height };
                }),
            );
            if (generation !== loadGeneration) return;
            pdfDocument.value = doc;
            baseSizes = sizes;
            pageCount.value = doc.numPages;
            layout();
        } catch (error) {
            if (generation !== loadGeneration) return;
            failed.value = true;
            onError?.(error);
        } finally {
            if (generation === loadGeneration) loading.value = false;
        }
    };

    watch(src, (url) => void openDocument(url), { immediate: true });
    watch([zoomMode, customScale, rotation, spread, presentation], layout);
    watch(renderTargets, renderVisible);
    watch([scrollTop, viewportHeight, rows], syncCurrentPage);

    /* ── 명령 ── */

    const registerSlot = (page: number, slot: PdfPageSlot) => {
        const existing = slots.get(page);
        if (existing?.canvas === slot.canvas && existing.textLayer === slot.textLayer) return;
        if (existing) cancelPageRender(page);
        slots.set(page, slot);
        renderVisible();
    };
    const unregisterSlot = (page: number) => {
        cancelPageRender(page);
        slots.delete(page);
        updateRenderState();
    };

    const goToPage = (page: number) => {
        if (pageCount.value === 0) return;
        const clamped = Math.min(pageCount.value, Math.max(1, Math.trunc(page)));
        if (presentation.value) {
            currentPage.value = clamped;
            return;
        }
        const row = rows.value.find((entry) => entry.pages.includes(clamped));
        if (!row) return;
        currentPage.value = row.pages[0]!;
        scrollTo(row.top);
    };
    /** 이전/다음 이동 단위. 2페이지 보기(프레젠테이션 제외)에서는 두 장씩 넘깁니다. */
    const pageStep = () => (spread.value === 'double' && !presentation.value ? 2 : 1);

    const setCustomScale = (value: number) => {
        customScale.value = roundScale(Math.min(PDF_ZOOM_MAX, Math.max(PDF_ZOOM_MIN, value)));
        zoomMode.value = 'custom';
    };
    /**
     * 확대·축소의 기준 배율. 사용자 지정 모드에서는 렌더가 끝나기 전에 연타해도 누적되도록
     * 목표 배율을, 자동 모드에서는 실제 렌더된 배율을 사용합니다.
     */
    const targetScale = () => (zoomMode.value === 'custom' ? customScale.value : scale.value);

    const rotateBy = (delta: 90 | -90) => {
        const next = (((rotation.value + delta) % 360) + 360) % 360;
        rotation.value = next as PdfRotation;
    };

    const setPresentation = (active: boolean) => {
        if (active === presentation.value) return;
        if (active) {
            zoomBeforePresentation = { mode: zoomMode.value, custom: customScale.value };
            presentation.value = true;
            zoomMode.value = 'page-fit';
            return;
        }
        /* 종료: 배율을 되돌리고 보던 페이지가 속한 행으로 스크롤합니다. 레이아웃 watcher가 한 번에 처리합니다. */
        pendingAnchor = { page: currentPage.value, fraction: 0 };
        presentation.value = false;
        const previous = zoomBeforePresentation;
        zoomBeforePresentation = null;
        if (previous) {
            customScale.value = previous.custom;
            zoomMode.value = previous.mode;
        }
    };

    const zoomPercent = computed(() => Math.round(scale.value * 100));
    const canGoPrev = computed(() => currentPage.value > 1);
    const canGoNext = computed(() => currentPage.value + pageStep() <= pageCount.value);
    const canZoomIn = computed(() => targetScale() < PDF_ZOOM_MAX);
    const canZoomOut = computed(() => targetScale() > PDF_ZOOM_MIN);

    onUnmounted(() => {
        loadGeneration += 1;
        if (scrollFrame) cancelAnimationFrame(scrollFrame);
        container.value?.removeEventListener('scroll', onScroll);
        closeDocument();
    });

    return {
        loading,
        rendering,
        failed,
        document: pdfDocument,
        pageCount,
        currentPage,
        spread,
        pages,
        rows,
        visiblePages,
        renderedPages,
        presentation,
        zoomMode,
        scale,
        zoomPercent,
        rotation,
        renderCount,
        canGoPrev,
        canGoNext,
        canZoomIn,
        canZoomOut,
        registerSlot,
        unregisterSlot,
        getSlot: (page) => slots.get(page) ?? null,
        goToPage,
        prevPage: () => goToPage(currentPage.value - 1),
        nextPage: () => goToPage(currentPage.value + pageStep()),
        firstPage: () => goToPage(1),
        lastPage: () => goToPage(pageCount.value),
        /* 자동 배율이 단계 사이에 있어도 다음 단계로 정확히 올라가도록 현재 배율을 단계로 내림·올림합니다. */
        zoomIn: () =>
            setCustomScale(
                Math.floor(targetScale() / PDF_ZOOM_STEP) * PDF_ZOOM_STEP + PDF_ZOOM_STEP,
            ),
        zoomOut: () =>
            setCustomScale(
                Math.ceil(targetScale() / PDF_ZOOM_STEP) * PDF_ZOOM_STEP - PDF_ZOOM_STEP,
            ),
        fitToWidth: () => {
            zoomMode.value = 'fit-width';
        },
        setZoomMode: (mode) => {
            zoomMode.value = mode;
        },
        setZoomPercent: (percent) => setCustomScale(percent / 100),
        setSpread: (mode) => {
            spread.value = mode;
        },
        rotateClockwise: () => rotateBy(90),
        rotateCounterclockwise: () => rotateBy(-90),
        setPresentation,
        refit: () => {
            readScroll();
            if (dependsOnContainer(zoomMode.value)) layout();
        },
    };
};
```

주의(구현자용):
- `watch([zoomMode, customScale, rotation, spread, presentation], layout)`는 pre-flush라 같은 틱의 여러 변경(예: `setPresentation`의 `presentation`+`zoomMode`)을 한 번의 `layout()`으로 처리한다. `pendingAnchor`는 이 한 번의 호출에서 소비된다.
- `syncCurrentPage`가 `rows`를 감시하므로 `goToPage`가 `currentPage`를 먼저 설정해도 `scrollTo`가 `scrollTop`을 동기적으로 갱신해 결과가 같다.
- 테스트의 기대값이 어긋나면 먼저 `Math.floor`·`roundScale`의 적용 순서를 확인한다(예: 회전 90° 페이지 폭 = floor(800 × 1.13) = 904).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/composables/pdf/usePdfViewer.test.ts`
Expected: PASS (전체). 실패하면 기대값이 아니라 구현을 먼저 의심하되, 부동소수 정수화가 원인이면 테스트 기대값을 실제 계산 결과로 정정한다.

- [ ] **Step 5: 타입 검사 후 커밋**

Run: `cd C:\it\it_frontend; npx nuxt typecheck 2>&1 | Select-String "usePdfViewer"` — PdfViewer.vue 쪽 오류는 Task 2에서 해결하므로 여기서는 composable 파일 자체의 오류만 없으면 된다.

```powershell
cd C:\it\it_frontend
git add app/composables/pdf/usePdfViewer.ts tests/unit/composables/pdf/usePdfViewer.test.ts
git commit -m "PDF 뷰어 composable을 연속 스크롤 모델로 재작성

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `usePdfSearch` — 렌더된 레이어 하이라이트·화면 안 판정 분리

**Files:**
- Modify: `app/composables/pdf/usePdfSearch.ts:36-46` (옵션), `:105` (`isVisible`), `:135-146` (`moveTo`)
- Test: `tests/unit/composables/pdf/usePdfSearch.test.ts`

**Interfaces:**
- Produces: `UsePdfSearchOptions.isPageVisible?: (page: number) => boolean` — 없으면 `visibleLayers`에 포함 여부로 판정(기존 동작).

- [ ] **Step 1: 실패하는 테스트 추가**

기존 테스트 파일의 `describe('usePdfSearch', …)` 안, `'2페이지 보기처럼 여러 레이어가 보이면 …'` 테스트 뒤에 추가한다. 이 파일은 `createDocument(pages)`로 문서 대역을 만들고 `usePdfSearch`를 직접 호출하는 관례를 쓴다.

```ts
    it('isPageVisible이 있으면 렌더됐지만 화면 밖인 페이지의 결과로는 이동하고 이동 직후 그 레이어를 바로 강조한다', async () => {
        const { doc } = createDocument(['예산 A', '예산 B']);
        const document = shallowRef<PdfSearchableDocument | null>(doc);
        /* 1·2페이지 모두 렌더(버퍼)돼 있지만 화면에는 1만 보인다 */
        const layers = [1, 2].map((page) => {
            const layer = window.document.createElement('div');
            const span = window.document.createElement('span');
            span.textContent = `예산 ${page === 1 ? 'A' : 'B'}`;
            layer.append(span);
            return { page, layer };
        });
        const goToPage = vi.fn();
        const search = usePdfSearch({
            document,
            visibleLayers: () => layers,
            isPageVisible: (page) => page === 1,
            currentPage: ref(1),
            renderCount: ref(1),
            goToPage,
        });

        search.query.value = '예산';
        await search.search();
        expect(goToPage).not.toHaveBeenCalled();

        search.next();
        expect(goToPage).toHaveBeenCalledWith(2);
        /* renderCount가 오르지 않아도 이미 렌더된 2페이지 레이어에 현재 표시가 붙는다 */
        expect(layers[1]?.layer.querySelector('mark')?.className).toContain('--current');
        expect(layers[0]?.layer.querySelector('mark')?.className).not.toContain('--current');
    });
```

- [ ] **Step 2: 실패 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/composables/pdf/usePdfSearch.test.ts`
Expected: FAIL — `isPageVisible`이 무시되어 `goToPage`가 호출되지 않음(2페이지가 visibleLayers에 있어 "보이는" 것으로 판정).

- [ ] **Step 3: 구현**

`app/composables/pdf/usePdfSearch.ts`의 옵션 인터페이스와 구현을 다음처럼 바꾼다.

```ts
export interface UsePdfSearchOptions {
    /** 읽기만 하므로 상위의 `ShallowRef<PDFDocumentProxy | null>`을 그대로 받을 수 있습니다. */
    document: Readonly<ShallowRef<PdfSearchableDocument | null>>;
    /** 텍스트 레이어가 그려진 페이지들(버퍼 포함). 하이라이트 대상 */
    visibleLayers: () => PdfVisibleLayer[];
    /**
     * 페이지가 실제로 화면 안에 있는지 판정합니다. 결과로 이동할 때 스크롤이 필요한지 정하는 데 씁니다.
     * 없으면 `visibleLayers`에 포함된 페이지를 화면 안으로 봅니다.
     */
    isPageVisible?: (page: number) => boolean;
    /** 현재 페이지. 검색 결과 중 어디서 시작할지 정할 때 씁니다. */
    currentPage: Ref<number>;
    /** 뷰어 렌더 완료 카운터. 바뀔 때마다 하이라이트를 다시 적용합니다. */
    renderCount: Ref<number>;
    goToPage: (page: number) => void;
}
```

```ts
export const usePdfSearch = ({
    document,
    visibleLayers,
    isPageVisible,
    currentPage,
    renderCount,
    goToPage,
}: UsePdfSearchOptions): UsePdfSearch => {
    …
    const isVisible = (page: number) =>
        isPageVisible ? isPageVisible(page) : visibleLayers().some((entry) => entry.page === page);
    …
    const moveTo = (index: number) => {
        currentIndex.value = index;
        const match = matches.value[index];
        if (!match) return;
        if (!isVisible(match.page)) goToPage(match.page);
        /* 이미 렌더된(버퍼) 페이지면 바로 강조하고, 아직이면 렌더 완료(renderCount) 때 적용됩니다. */
        applyHighlights();
    };
```

파일 헤더 주석의 "현재 페이지 텍스트 레이어의 하이라이트"를 "렌더된 텍스트 레이어의 하이라이트"로 고친다.

- [ ] **Step 4: 통과 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/composables/pdf/usePdfSearch.test.ts`
Expected: PASS. 기존 테스트 중 "보이는 페이지의 결과면 goToPage를 부르지 않는다"류가 있으면 그대로 통과해야 한다(기본 판정 유지).

- [ ] **Step 5: 커밋**

```powershell
cd C:\it\it_frontend
git add app/composables/pdf/usePdfSearch.ts tests/unit/composables/pdf/usePdfSearch.test.ts
git commit -m "PDF 검색의 화면 안 판정을 렌더 레이어와 분리

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `PdfViewer.vue` 행·슬롯 렌더링과 휠 넘김 제거

**Files:**
- Modify: `app/components/common/PdfViewer.vue`
- Test: `tests/unit/components/common/PdfViewer.test.ts`

**Interfaces:**
- Consumes: Task 1의 `pages`, `rows`, `renderedPages`, `registerSlot`, `unregisterSlot`, `getSlot`, `setPresentation`, `PDF_PAGE_GAP`; Task 2의 `isPageVisible`.

- [ ] **Step 1: 테스트 수정**

`tests/unit/components/common/PdfViewer.test.ts`에서:

(a) composable 대역 상태·명령에 추가:

```ts
import type { PdfPageLayout, PdfPageSlot, PdfRowLayout, … } from '~/composables/pdf/usePdfViewer';

const state = {
    …기존…,
    pages: shallowRef<PdfPageLayout[]>([
        { page: 1, width: 600, height: 800 },
        { page: 2, width: 600, height: 800 },
        { page: 3, width: 600, height: 800 },
    ]),
    renderedPages: ref<number[]>([1, 2]),
    presentation: ref(false),
};
const slots = new Map<number, PdfPageSlot>();
const commands = {
    …기존(setZoomMode·setSpread 등 유지)…,
    registerSlot: vi.fn((page: number, slot: PdfPageSlot) => {
        slots.set(page, slot);
    }),
    unregisterSlot: vi.fn((page: number) => {
        slots.delete(page);
    }),
    getSlot: vi.fn((page: number) => slots.get(page) ?? null),
    setPresentation: vi.fn((active: boolean) => {
        state.presentation.value = active;
    }),
};
```

`usePdfViewerMock`의 반환에 `rows`를 추가한다:

```ts
        rows: computed<PdfRowLayout[]>(() => {
            if (state.presentation.value) {
                return [{ pages: [state.currentPage.value], top: 0, height: 800 }];
            }
            const groups =
                state.spread.value === 'double' ? [[1, 2], [3]] : [[1], [2], [3]];
            return groups.map((pages, index) => ({ pages, top: index * 816, height: 800 }));
        }),
```

`vi.mock('~/composables/pdf/usePdfViewer', …)`에 `PDF_PAGE_GAP: 16`을 추가한다. `beforeEach`에서 `slots.clear()`, `state.presentation.value = false`, `state.renderedPages.value = [1, 2]`를 초기화한다.

(b) 첫 테스트(`2페이지 보기에서는 …`)를 아래로 교체:

```ts
    it('행·페이지 슬롯을 크기와 함께 그리고 canvas·텍스트 레이어를 등록하며 검색에는 렌더된 레이어를 넘긴다', async () => {
        const wrapper = mountViewer();
        const pageSlots = wrapper.findAll('[data-testid="pdf-page"]');
        expect(pageSlots).toHaveLength(3);
        expect(pageSlots[0]?.attributes('data-page')).toBe('1');
        expect((pageSlots[0]?.element as HTMLElement).style.width).toBe('600px');
        expect((pageSlots[0]?.element as HTMLElement).style.height).toBe('800px');
        expect(wrapper.findAll('.pdf-viewer__row')).toHaveLength(3);
        expect(commands.registerSlot).toHaveBeenCalledWith(
            1,
            expect.objectContaining({ canvas: expect.any(HTMLCanvasElement) }),
        );
        expect(slots.get(1)?.textLayer?.classList.contains('pdf-viewer__text-layer')).toBe(true);

        const searchOptions = usePdfSearchMock.mock.calls.at(-1)?.[0] as {
            visibleLayers: () => Array<{ page: number; layer: HTMLElement | null }>;
            isPageVisible: (page: number) => boolean;
        };
        const layers = searchOptions.visibleLayers();
        expect(layers.map((entry) => entry.page)).toEqual([1, 2]);
        expect(layers[0]?.layer).toBe(slots.get(1)?.textLayer);
        expect(searchOptions.isPageVisible(1)).toBe(true);
        expect(searchOptions.isPageVisible(2)).toBe(false);

        state.spread.value = 'double';
        await nextTick();
        expect(wrapper.findAll('.pdf-viewer__row')).toHaveLength(2);
        expect(wrapper.findAll('.pdf-viewer__row')[0]?.findAll('[data-testid="pdf-page"]')).toHaveLength(2);

        wrapper.unmount();
        expect(commands.unregisterSlot).toHaveBeenCalledWith(1);
    });
```

(c) `src·텍스트 레이어·여백을 composable에 넘기고 …` 테스트에서 `options?.textLayer?.value…` 단언 한 줄을 삭제한다(옵션에서 제거됨). 나머지(`src`, `fitPadding`, `container`, `onError`)는 유지.

(d) 프레젠테이션 테스트에서 `expect(commands.setZoomMode).toHaveBeenCalledWith('page-fit')`를 `expect(commands.setPresentation).toHaveBeenCalledWith(true)`로, 종료 쪽의 배율 복원 단언(`setZoomPercent`/`setZoomMode` 호출)을 `expect(commands.setPresentation).toHaveBeenLastCalledWith(false)`로 바꾼다. 본문이 `overflow-hidden` 클래스를 갖는지도 단언한다:

```ts
        expect(wrapper.get('[role="document"]').classes()).toContain('overflow-hidden');
```

(e) `본문 끝에서 아래로 스크롤하면 …` 휠 테스트를 통째로 삭제한다.

(f) `로딩·실패 상태를 표시하고 문서가 없으면 페이지 영역을 숨긴다`에서 페이지 영역 셀렉터가 바뀌면(`[data-testid="pdf-pages"]`) 맞춘다.

- [ ] **Step 2: 실패 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/components/common/PdfViewer.test.ts`
Expected: FAIL — `pdf-page` 슬롯 없음, `registerSlot` 미호출.

- [ ] **Step 3: 컴포넌트 수정**

`app/components/common/PdfViewer.vue`:

(a) 헤더 주석: 3~6행 설명을 다음으로 교체.

```
Blob URL로 받은 PDF를 브라우저 내장 뷰어(iframe) 대신 pdf.js로 직접 그립니다.
전 페이지를 세로로 이어 붙여 연속 스크롤하며, 보이는 행(앞뒤 한 행 버퍼 포함)만 canvas에
렌더링하고 그 위에 텍스트 레이어를 올려 선택·검색이 가능합니다. 내장 뷰어와 달리 브라우저·설정에
관계없이 같은 UI가 보장되고 다운로드·인쇄 진입점을 화면이 통제할 수 있습니다.
```

[키보드] 문단에서 `마우스 휠 …` 줄을 삭제하고, [동작]에 다음을 추가:

```
  - 현재 페이지는 본문 세로 중앙선이 지나는 행이며 이동 명령은 그 행의 상단으로 스크롤합니다.
  - 2페이지 보기는 1-2, 3-4 … 를 한 행으로 두고 행을 세로로 잇습니다.
  - 프레젠테이션 모드는 Fullscreen API로 뷰어를 전체화면에 띄우고 현재 페이지 한 장만 페이지 맞춤으로 보여 줍니다.
```

(b) 스크립트:

- import에 `PDF_PAGE_GAP` 추가, `PdfZoomMode` 제거(더 이상 안 씀), `type ComponentPublicInstance` from 'vue' 추가.
- `canvas`, `textLayer`, `secondCanvas`, `secondTextLayer` ref와 `usePdfViewer` 호출의 해당 옵션을 삭제:

```ts
const viewer = usePdfViewer({
    src: toRef(props, 'src'),
    container: body,
    fitPadding: BODY_PADDING,
    onError: (error) => emit('load-failed', error),
});

/* ── 페이지 슬롯 ── */
/** 페이지 슬롯의 CSS 크기. 레이아웃이 아직 없으면 undefined */
const pageStyle = (page: number) => {
    const layout = viewer.pages.value[page - 1];
    return layout ? { width: `${layout.width}px`, height: `${layout.height}px` } : undefined;
};
/**
 * v-for 슬롯의 함수 ref. 마운트되면 canvas·텍스트 레이어를 composable에 등록하고 언마운트되면 해제합니다.
 * Vue는 인라인 함수 ref를 매 렌더마다 호출하므로 등록은 composable 쪽에서 멱등하게 처리됩니다.
 */
const bindSlot = (page: number, el: Element | ComponentPublicInstance | null) => {
    if (!(el instanceof HTMLElement)) {
        viewer.unregisterSlot(page);
        return;
    }
    const canvas = el.querySelector('canvas');
    if (!canvas) return;
    viewer.registerSlot(page, {
        canvas,
        textLayer: el.querySelector<HTMLElement>('.pdf-viewer__text-layer'),
    });
};
```

- 검색 옵션:

```ts
const search = usePdfSearch({
    document: viewer.document,
    visibleLayers: () =>
        viewer.renderedPages.value.map((page) => ({
            page,
            layer: viewer.getSlot(page)?.textLayer ?? null,
        })),
    isPageVisible: (page) => viewer.visiblePages.value.includes(page),
    currentPage: viewer.currentPage,
    renderCount: viewer.renderCount,
    goToPage: viewer.goToPage,
});
```

- `/* ── 휠 스크롤로 페이지 넘기기 ── */` 블록 전체(`WHEEL_PAGE_COOLDOWN_MS`, `lastWheelPageFlip`, `scrollAfterRender`, `onWheel`, `watch(viewer.renderCount, …)`)를 삭제한다.
- 프레젠테이션: `zoomBeforePresentation`과 배율 저장·복원 로직을 삭제하고 `syncPresentation`을 다음으로 교체.

```ts
const syncPresentation = () => {
    const active = !!root.value && document.fullscreenElement === root.value;
    if (active === isPresentation.value) return;
    isPresentation.value = active;
    viewer.setPresentation(active);
    if (active) body.value?.focus();
};
```

(c) 템플릿: 본문 `div`에서 `@wheel="onWheel"`을 지우고 `:class`를 다음으로 바꾼다.

```vue
                :class="
                    isPresentation ? 'overflow-hidden bg-black' : 'bg-zinc-100 dark:bg-zinc-800'
                "
```

(`overflow-auto`가 기본 클래스에 있으므로 프레젠테이션에서는 `overflow-hidden`이 뒤에 와서 이깁니다. Tailwind 순서가 아니라 동일 특이성의 선언 순서 문제이므로, 확실히 하려면 기본 클래스 목록에서 `overflow-auto`를 빼고 `:class`에 `isPresentation ? 'overflow-hidden …' : 'overflow-auto …'`로 둔다 — 이 방식을 채택한다.)

페이지 영역을 다음으로 교체:

```vue
                <!-- 행 사이 간격은 PDF_PAGE_GAP, 행 안 두 장 사이 간격은 PDF_SPREAD_GAP과 같아야 배율·위치 계산이 맞습니다. -->
                <div
                    v-show="hasDocument"
                    data-testid="pdf-pages"
                    class="flex w-max min-w-full flex-col items-center"
                    :class="isPresentation ? 'min-h-full justify-center' : ''"
                    :style="{ gap: `${PDF_PAGE_GAP}px` }"
                >
                    <div
                        v-for="row in viewer.rows.value"
                        :key="row.pages[0]"
                        class="pdf-viewer__row flex items-start justify-center"
                        :style="{ gap: `${PDF_SPREAD_GAP}px` }"
                    >
                        <div
                            v-for="page in row.pages"
                            :key="page"
                            :ref="(el) => bindSlot(page, el)"
                            class="pdf-viewer__page relative bg-white shadow-md"
                            :style="pageStyle(page)"
                            :data-page="page"
                            data-testid="pdf-page"
                        >
                            <canvas class="block" />
                            <div
                                class="pdf-viewer__text-layer"
                                :class="{ 'pointer-events-none': tool === 'hand' }"
                            />
                        </div>
                    </div>
                </div>
```

`:ref="(el) => bindSlot(page, el)"`의 `el` 타입은 Vue가 `Element | ComponentPublicInstance | null`로 추론한다. vue-tsc가 불평하면 `(el: Element | ComponentPublicInstance | null) => bindSlot(page, el)`로 명시한다.

- [ ] **Step 4: 통과 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/components/common/PdfViewer.test.ts tests/unit/composables/pdf`
Expected: PASS.

- [ ] **Step 5: 커밋**

```powershell
cd C:\it\it_frontend
git add app/components/common/PdfViewer.vue tests/unit/components/common/PdfViewer.test.ts
git commit -m "PDF 뷰어 본문을 행·페이지 슬롯 연속 스크롤로 전환

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 전체화면에서 툴바 오버레이가 보이도록 `append-to="self"`

**Files:**
- Modify: `app/components/common/pdf/PdfViewerToolbar.vue:254-266` (Select), `:334` (Menu)
- Modify: `app/components/common/pdf/PdfPropertiesDialog.vue` (`<Dialog …>`)
- Test: `tests/unit/components/common/pdf/PdfViewerToolbar.test.ts`, `tests/unit/components/common/pdf/PdfPropertiesDialog.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`PdfViewerToolbar.test.ts`(실제 PrimeVue 컴포넌트가 마운트됨) `describe` 안에:

```ts
    it('배율 선택과 더 보기 메뉴의 오버레이는 뷰어 안(self)에 붙여 전체화면에서도 보이게 한다', () => {
        const wrapper = mountToolbar();
        expect(wrapper.findComponent({ name: 'Select' }).props('appendTo')).toBe('self');
        expect(wrapper.findComponent({ name: 'Menu' }).props('appendTo')).toBe('self');
    });
```

`PdfPropertiesDialog.test.ts`의 `DialogStub` props에 `'appendTo'`를 추가하고 `describe` 안에:

```ts
    it('다이얼로그는 뷰어 안(self)에 붙여 전체화면에서도 보이게 한다', () => {
        const wrapper = mountDialog();
        expect(wrapper.findComponent(DialogStub).props('appendTo')).toBe('self');
    });
```

- [ ] **Step 2: 실패 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/components/common/pdf`
Expected: FAIL — `appendTo`가 `'body'`(기본값) 또는 undefined.

- [ ] **Step 3: 구현**

`PdfViewerToolbar.vue`의 `<Select …>`와 `<Menu …>`에 `append-to="self"`를 추가하고 헤더 주석에 한 줄을 남긴다:

```
  오버레이(배율 선택·더 보기 메뉴)는 append-to="self"로 뷰어 트리 안에 둡니다. 신청서 다이얼로그가
  Fullscreen API로 전체화면일 때 body에 붙은 오버레이는 전체화면 요소 밖이라 그려지지 않기 때문입니다.
```

`PdfPropertiesDialog.vue`의 `<Dialog …>`에 `append-to="self"`를 추가하고 같은 취지의 주석 한 줄을 헤더에 남긴다.

- [ ] **Step 4: 통과 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/components/common/pdf`
Expected: PASS.

- [ ] **Step 5: 커밋**

```powershell
cd C:\it\it_frontend
git add app/components/common/pdf/PdfViewerToolbar.vue app/components/common/pdf/PdfPropertiesDialog.vue tests/unit/components/common/pdf/PdfViewerToolbar.test.ts tests/unit/components/common/pdf/PdfPropertiesDialog.test.ts
git commit -m "PDF 툴바 오버레이를 뷰어 안에 붙여 전체화면에서 보이게 수정

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: 문서 갱신, Health Stack, 브라우저 검증

**Files:**
- Modify: `docs/guides/components/common-components.md:138-140`
- Verify: dev 서버 + 브라우저

- [ ] **Step 1: 가이드 문단 수정**

138~140행의 "한 번에 한 페이지만 … 다음/이전 페이지로 이어집니다." 부분을 다음으로 교체:

```
- 전 페이지를 세로로 이어 붙여 연속 스크롤하며, 보이는 행(앞뒤 한 행 버퍼)만 canvas에 그리고 그 위에
  pdf.js `TextLayer`를 올려 텍스트 선택·복사와 검색 하이라이트를 지원합니다. 범위를 벗어난 페이지는
  렌더를 취소하고 canvas를 비워 메모리를 반납합니다. 현재 페이지는 본문 세로 중앙선이 지나는 행이며,
  이동 명령은 그 행 상단으로 스크롤합니다. 기본 배율은 '자동'(폭 맞춤, 125% 상한)입니다.
```

같은 문단의 "2페이지 보기(홀수 페이지를 왼쪽에 두는 펼침, 이동·검색·썸네일 강조가 두 장 단위)"를 "2페이지 보기(1-2, 3-4 … 를 한 행으로 두고 세로로 잇는 펼침)"로, "프레젠테이션 모드(Fullscreen API)"를 "프레젠테이션 모드(Fullscreen API, 현재 페이지 한 장만 페이지 맞춤)"로 고친다. 마지막에 한 줄 추가:

```
- 툴바의 배율 선택·더 보기 메뉴와 문서 속성 다이얼로그는 `append-to="self"`로 뷰어 트리 안에
  렌더합니다. 신청서 다이얼로그가 Fullscreen API로 전체화면일 때 `body`에 붙은 오버레이는 보이지
  않기 때문입니다.
```

- [ ] **Step 2: Health Stack**

```powershell
cd C:\it\it_frontend
npm run format
npm run format:check
npm run check
npm test
```

Expected: 모두 통과. `npm run check`(lint+typecheck)에서 `PdfViewer.vue`의 함수 ref 타입 오류가 나면 Task 3 Step 3의 명시 타입으로 고친다.

- [ ] **Step 3: 브라우저 검증**

`.claude/launch.json`의 프론트 dev 서버를 `preview_start`로 띄우고(백엔드 없이 뷰어만 확인하려면 `tests/e2e/report-pdf-latest.spec.ts`가 쓰는 라우트나 신청서 조회 다이얼로그를 연다) 다음을 확인·스크린샷한다:

1. 다페이지 PDF에서 휠 스크롤이 페이지 경계에서 끊기지 않고 이어지고, 툴바 페이지 번호가 스크롤에 따라 바뀐다.
2. 다음/이전/페이지 입력이 해당 행 상단으로 이동한다.
3. 2페이지 보기에서 1-2, 3-4가 한 행이고 세로로 이어진다.
4. 확대/축소 후 보던 행이 유지된다.
5. 찾기로 다른 페이지 결과로 이동하면 하이라이트가 보인다.
6. 다이얼로그 최대화(전체화면) 상태에서 배율 드롭다운·더 보기 메뉴·문서 속성이 열린다. (Claude 브라우저 패널에서는 `requestFullscreen`이 pending이므로 — `primevue_dialog_maximized_and_browser_pane` 메모리 참고 — 오버레이가 `.pdf-viewer` 안에 렌더되는지 DOM으로 확인하고, 실제 전체화면 확인은 사용자에게 요청한다.)

- [ ] **Step 4: 커밋과 버전 기록**

```powershell
cd C:\it\it_frontend
git add docs/guides/components/common-components.md
git commit -m "PDF 뷰어 가이드를 연속 스크롤 동작으로 갱신

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
cd C:\it
./scripts/update-versions-lock.ps1
```

`versions.lock` 변경은 루트 저장소에서 스펙·계획 문서를 `done/`으로 옮기는 커밋과 함께 남긴다:

```powershell
cd C:\it
git mv docs/superpowers/specs/2026-09-14-pdf-viewer-continuous-scroll-design.md docs/superpowers/specs/done/
git mv docs/superpowers/plans/2026-09-14-pdf-viewer-continuous-scroll.md docs/superpowers/plans/done/
git add versions.lock
git commit -m "PDF 뷰어 연속 스크롤 설계·계획 완료 처리

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
