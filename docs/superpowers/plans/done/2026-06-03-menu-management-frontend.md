# Menu Management — Frontend Cutover Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the sidebar from its hardcoded `menuItems` tree to the DB-backed `/api/menus`, add a header Breadcrumb, ship the `/admin/menus` and `/admin/routes` management screens, and wire the backend DYN board resolver — so an admin can change order/label/role/hidden with no deploy.

**Architecture:** A `useMenu` composable fetches the role-filtered tree once and exposes `treeByContext` (sidebar), `nodeByPath` + `nodeById` (breadcrumb). Icons/badges live in a static `menuPresentation.ts` map keyed by `MNU_ID` (meta-standard decision §3.6). The backend gains a `BoardListMenuResolver` so the `DYN` board node's children are produced server-side. Admin screens reuse the existing `StyledDataTable` + `useAdminTableEdit` (routes) and PrimeVue `Tree` (menus).

**Tech Stack:** Nuxt 4 (CSR-only), Vue 3 `<script setup>`, PrimeVue v4 (Tree, Select, Breadcrumb — auto-imported), Vitest, + a small Spring Boot addition (board resolver). Backend Plan 1 must be merged and its API live first.

---

## Prerequisites

- **Plan 1 (`2026-06-03-menu-management-backend.md`) is merged and its API works** (Task 13 of Plan 1 passed). `/api/menus`, `/api/admin/menus`, `/api/admin/routes` are live; the menu tree is seeded with stable `MNU_ID`s.
- Read the spec `docs/superpowers/specs/2026-05-30-menu-management-design.md` §5 (frontend), §3.6 (presentation map), §6.4 (parity verification).

## Verified codebase facts (read before starting)

1. **`useApiFetch<T>(url)`** is CSR-only (`server:false, lazy:true, credentials:'include'`), must be called in setup, returns `{ data, pending, error, refresh }`. Use for GETs.
2. **Mutations use `$apiFetch`** from `useNuxtApp()` with an **absolute URL**: `const config = useRuntimeConfig(); const BASE = ` + "`${config.public.apiBase}/api`" + `; await $apiFetch(` + "`${BASE}/...`" + `, { method, body })`. No `baseURL` is set, so relative URLs break.
3. **PrimeVue v4 is auto-imported** — `<Tree>`, `<Select>` (v4 name for Dropdown), `<Breadcrumb>`, `<Column>`, `<Button>`, `<Tag>`, `<Checkbox>`, `<InputText>` need no import. `useToast` needs `import { useToast } from 'primevue/usetoast'`.
4. **`StyledDataTable`** (`~/components/common/StyledDataTable.vue`) passes all DataTable props via `$attrs`; explicit import required. **`useAdminTableEdit`** returns `{ viewMode, editRows, selectedRows, saving, enterEditMode, cancelEdit, saveAndExitEdit, addRow, rowStatus, rowClass, isRowEditing, markDirty, deleteRow, deleteSelectedRows }`, options `{ sourceData, onBatchSave, toast, makeBlankRow? }`, `onBatchSave({ newRows, modifiedRows, deletedRows })`.
5. **Admin page boilerplate:** `definePageMeta({ middleware: 'admin', layout: 'admin' })`. Reference page: `app/pages/admin/codes.vue`.
6. **`ROLE`** from `~/types/auth`: `ADMIN='ITPAD001'`, `DEPT_MANAGER='ITPZZ002'`, `USER='ITPZZ001'`. Auth user: `useAuth()` → `user` ref with `user.value.athIds`.
7. **Board listing is NOT permission-filtered on the backend today** — `BoardMetaService.getAllActive()` returns all `USE_YN='Y'` boards; `AppSidebar` filters client-side (`inqAthC === 'ALL'` OR admin). Plan 2 moves that exact filter into the backend `BoardListMenuResolver`.
8. **Board route:** `/board/{blbMngNo}`. **Board fields:** `blbMngNo` (PK), `blbNm` (label), `blbTp` (`002`=자료실 else 공지), `inqAthC`, `sreSqnNo` (order).
9. **Vitest:** tests in `tests/unit/...`; explicitly import `ref`/`computed` from `vue`; mock `#app` for `useRuntimeConfig`; `vi.stubGlobal('$fetch', ...)`. Command: `npm test` (= `vitest run`).
10. **`layouts/default.vue`** is template-only; insert `<AppBreadcrumb/>` between `<AppHeader/>` and `<main>`.

## File structure (what this plan creates/changes)

```
it_backend/.../menu/service/
  BoardListMenuResolver.java                  ★ DYN board children (server-side filter)
  MenuQueryService.java                       ◇ inject List<MenuChildrenResolver>

it_frontend/app/
  types/menu.ts                               ★ MenuNode, RouteCatalogItem, ContextCode
  utils/menuPresentation.ts                   ★ MENU_ICON, MENU_BADGE (keyed by MNU_ID)
  utils/breadcrumb.ts                         ★ pure breadcrumb items builder
  utils/adminLogs.ts                          ◇ add cmenum log entry
  composables/useMenu.ts                      ★ tree fetch + treeByContext/nodeByPath/nodeById
  composables/useAdminMenu.ts                 ★ admin CRUD ($apiFetch)
  components/AppSidebar.vue                    ◇ remove hardcoded menuItems; consume useMenu
  components/AppBreadcrumb.vue                 ★ new
  layouts/default.vue                         ◇ insert <AppBreadcrumb/>
  pages/admin/menus/index.vue                 ★ Tree DnD + edit form
  pages/admin/routes/index.vue                ★ StyledDataTable
tests/unit/
  composables/useMenu.test.ts                 ★
  components/AppBreadcrumb.test.ts            ★
  utils/menuPresentation.test.ts             ★
```

---

## Task 1: Backend — DYN board resolver + inject resolvers (TDD)

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/service/BoardListMenuResolver.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`

- [ ] **Step 1: Confirm the board DTO getters**

```bash
grep -n "class Response\|getBlbMngNo\|getBlbNm\|getInqAthC\|blbMngNo\|blbNm\|inqAthC" "C:/it/it_backend/src/main/java/com/kdb/it/common/board/dto/BoardMetaDto.java"
```
Expected: `BoardMetaDto.Response` exposes `getBlbMngNo()`, `getBlbNm()`, `getInqAthC()` (Lombok `@Getter`). Use those exact getter names in Step 4. (If a field name differs, adjust.)

- [ ] **Step 2: Change `MenuQueryService` to inject resolvers** — replace the hardcoded empty list

In `MenuQueryService.java`, delete the line:
```java
    private final List<MenuChildrenResolver> resolvers = List.of();
```
and instead declare it `final` alongside the repositories so `@RequiredArgsConstructor` injects all `MenuChildrenResolver` beans:
```java
    private final CmenumRepository cmenumRepository;
    private final CmenuaRepository cmenuaRepository;
    private final List<MenuChildrenResolver> resolvers;   // Spring injects all beans (empty list if none)
```
Then make `resolveDyn` null-safe (in case the list is null in a unit test):
```java
    private List<MenuDto.Node> resolveDyn(String mnuId, List<String> athIds) {
        if (resolvers == null) return new ArrayList<>();
        return resolvers.stream()
                .filter(r -> r.mnuId().equals(mnuId))
                .findFirst()
                .map(r -> r.resolveChildren(athIds))
                .orElseGet(ArrayList::new);
    }
```

- [ ] **Step 3: Update the existing test + add a DYN-injection test** (the old `@InjectMocks` no longer supplies `resolvers`, so construct the service explicitly)

In `MenuQueryServiceTest.java` replace the field declarations / remove `@InjectMocks`, add a `setUp`, and add the new test:
```java
    @Mock CmenumRepository cmenumRepository;
    @Mock CmenuaRepository cmenuaRepository;
    MenuQueryService service;   // constructed per-test (resolvers vary)

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new MenuQueryService(cmenumRepository, cmenuaRepository, java.util.List.of());
    }

    @Test
    void dynNode_getsChildrenFromMatchingResolver() {
        Cmenum dyn = Cmenum.builder().mnuId("MBRD0001").hrkMnuId(null).sreTc("04").mnuNm("게시판")
                .mnuTpC("DYN").mnuSotSqnSno(10).hidYn("N").mnuDep(1).whlMnuPth("/MBRD0001").delYn("N").build();
        given(cmenumRepository.findAllActive()).willReturn(List.of(dyn));
        given(cmenuaRepository.findAllActive()).willReturn(List.of());

        MenuChildrenResolver fake = new MenuChildrenResolver() {
            public String mnuId() { return "MBRD0001"; }
            public List<MenuDto.Node> resolveChildren(List<String> athIds) {
                return List.of(MenuDto.Node.builder().mnuId("MBRD-B1").mnuNm("공지").mnuTpC("LNK")
                        .srePth("/board/BLBM-0001").build());
            }
        };
        MenuQueryService svc = new MenuQueryService(cmenumRepository, cmenuaRepository, List.of(fake));
        List<MenuDto.Node> tree = svc.getMenuTree(List.of("ITPZZ001"));

        assertThat(tree).extracting(MenuDto.Node::getMnuId).containsExactly("MBRD0001");
        assertThat(tree.get(0).getChildren()).extracting(MenuDto.Node::getMnuId).containsExactly("MBRD-B1");
    }
```
> The two existing tests keep working because `setUp()` provides an empty-resolver service. Use `service` (the field) in those tests instead of the removed `@InjectMocks` instance.

- [ ] **Step 4: Implement `BoardListMenuResolver`** (replicates the client-side filter: visible if `inqAthC == 'ALL'` OR admin)

```java
package com.kdb.it.domain.menu.service;

import com.kdb.it.common.board.dto.BoardMetaDto;
import com.kdb.it.common.board.service.BoardMetaService;
import com.kdb.it.domain.menu.dto.MenuDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/** DYN 게시판 노드(MBRD0001)의 children을 서버 단에서 권한 필터링하여 생성. */
@Component
@RequiredArgsConstructor
public class BoardListMenuResolver implements MenuChildrenResolver {

    /** 시드의 게시판 DYN 노드 MNU_ID (V20260603_008 시드와 일치해야 함). */
    private static final String BOARD_DYN_MNU_ID = "MBRD0001";
    private static final String ADMIN_ATH_ID = "ITPAD001";

    private final BoardMetaService boardMetaService;

    @Override
    public String mnuId() { return BOARD_DYN_MNU_ID; }

    @Override
    public List<MenuDto.Node> resolveChildren(List<String> athIds) {
        boolean isAdmin = athIds != null && athIds.contains(ADMIN_ATH_ID);
        return boardMetaService.getAllActive().stream()
                .filter(b -> "ALL".equals(b.getInqAthC()) || isAdmin)
                .map(this::toNode)
                .collect(Collectors.toList());
    }

    private MenuDto.Node toNode(BoardMetaDto.Response b) {
        return MenuDto.Node.builder()
                .mnuId("MBRD-" + b.getBlbMngNo())
                .hrkMnuId(BOARD_DYN_MNU_ID)
                .sreTc("04")
                .mnuNm(b.getBlbNm())
                .mnuTpC("LNK")
                .srePth("/board/" + b.getBlbMngNo())
                .mnuDep(2)
                .children(List.of())
                .build();
    }
}
```

- [ ] **Step 5: Run the tests + build**

```bash
cd "C:/it/it_backend" && ./gradlew test --tests "com.kdb.it.domain.menu.service.MenuQueryServiceTest" -q
```
Expected: PASS (3 tests). Then `./gradlew compileJava -q` → BUILD SUCCESSFUL.

- [ ] **Step 6: Smoke-check the DYN node returns boards**

```bash
cd "C:/it/it_backend" && ./gradlew bootRun   # second terminal, logged in as admin (Plan 1 Task 13):
curl -s -b cookies.txt "http://localhost:8080/api/menus" | python -c "import sys,json; t=json.load(sys.stdin); print([n for n in t if n['mnuId']=='MBRD0001'][0]['children'][:2])"
```
Expected: the board DYN node has children with `srePth` like `/board/BLBM-0001`. Stop the app.

- [ ] **Step 7: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/domain/menu/service/BoardListMenuResolver.java it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java
git commit -m "feat(menu): wire DYN board resolver with server-side permission filter"
```

---

## Task 2: `app/types/menu.ts`

**Files:**
- Create: `it_frontend/app/types/menu.ts`

- [ ] **Step 1: Write the types** (mirror `MenuDto.Node` + route DTO from the backend)

```ts
// 백엔드 MenuDto.Node와 1:1 대응
export interface MenuNode {
  mnuId: string;
  hrkMnuId: string | null;
  sreTc: string;            // 01 info / 02 audit / 03 admin / 04 board / 05 documents / 06 approval
  mnuNm: string;
  mnuTpC: 'LNK' | 'GRP' | 'DYN';
  srePth: string | null;
  mnuSotSqnSno: number | null;
  hidYn: string;
  mnuDep: number;
  whlMnuPth: string;
  children: MenuNode[] | null;
}

export interface RouteCatalogItem {
  srePth: string;
  sreMnuNm: string;
  sreTc: string | null;
  useYn: string;
  rmk: string | null;
}

// 사이드바 컨텍스트 ↔ SRE_TC 매핑
export const CONTEXT_BY_SRE_TC = {
  '01': 'info',
  '02': 'audit',
  '03': 'admin',
  '04': 'board',
  '05': 'documents',
  '06': 'approval',
} as const;

export type ContextCode = typeof CONTEXT_BY_SRE_TC[keyof typeof CONTEXT_BY_SRE_TC];
```

- [ ] **Step 2: Commit**

```bash
git add it_frontend/app/types/menu.ts
git commit -m "feat(menu): add frontend menu types"
```

---

## Task 3: `app/utils/menuPresentation.ts` (icon/badge maps)

**Files:**
- Create: `it_frontend/app/utils/menuPresentation.ts`
- Reference: `it_database/migrations/V20260603_008__SeedRouteCatalogAndMenuTree.sql` (authoritative MNU_ID list) + the pre-refactor `AppSidebar.vue` (icons per label, from git history)

- [ ] **Step 1: Build the MNU_ID → icon/badge mapping**

Open the seed file to get each node's `MNU_ID` + `MNU_NM`, and the old `AppSidebar.vue` `menuItems` to get the icon string that node used (`icon: 'pi pi-...'`) and any badge key (`badge: 'approvalPending' | 'docReviewing' | 'approvalInProgress'`). Produce one `MENU_ICON` entry per node that had an icon (~28), and one `MENU_BADGE` entry per node that had a badge (3).

- [ ] **Step 2: Write the file** (fill all real entries from Step 1; the entries below are the exact shape)

```ts
// MNU_ID → 표시 속성 규약 맵 (meta 미등재 개념: 아이콘/배지는 DB 컬럼이 아님 — 스펙 §3.6).
// 키는 V20260603_008 시드의 MNU_ID와 일치해야 한다.

/** MNU_ID → PrimeVue icon class. 아이콘 없는 노드는 키를 두지 않는다. */
export const MENU_ICON: Record<string, string> = {
  MINF0001: 'pi pi-wallet',
  MAUD0001: 'pi pi-shield',
  MADM0001: 'pi pi-cog',
  MBRD0001: 'pi pi-comments',
  // … 아이콘을 가진 모든 노드 (약 28개)
};

/** 배지 카운트 composable 식별 key. 현재 앱 전체 3건. */
export type BadgeKey = 'approvalPending' | 'approvalInProgress' | 'docReviewing';

/** MNU_ID → BadgeKey. */
export const MENU_BADGE: Record<string, BadgeKey> = {
  // 예: 결재 대기 메뉴 노드 → 'approvalPending'
  // MAPV0001: 'approvalPending',
  // MDOC0001: 'docReviewing',
  // … 배지를 가진 노드 (3개)
};

export const iconFor = (mnuId: string): string | undefined => MENU_ICON[mnuId];
export const badgeKeyFor = (mnuId: string): BadgeKey | undefined => MENU_BADGE[mnuId];
```

- [ ] **Step 3: Commit**

```bash
git add it_frontend/app/utils/menuPresentation.ts
git commit -m "feat(menu): add MNU_ID-keyed icon/badge presentation maps"
```

---

## Task 4: `useMenu` composable (TDD)

**Files:**
- Create: `it_frontend/app/composables/useMenu.ts`
- Test: `it_frontend/tests/unit/composables/useMenu.test.ts`

- [ ] **Step 1: Write the failing test** for the pure tree-flattening helpers (export them so they are testable without Nuxt)

```ts
import { describe, expect, it } from 'vitest';
import { flattenById, indexByPath, groupByContext } from '~/composables/useMenu';
import type { MenuNode } from '~/types/menu';

const tree: MenuNode[] = [
  { mnuId: 'MINF0001', hrkMnuId: null, sreTc: '01', mnuNm: '정보화', mnuTpC: 'GRP', srePth: null,
    mnuSotSqnSno: 10, hidYn: 'N', mnuDep: 1, whlMnuPth: '/MINF0001',
    children: [
      { mnuId: 'MINF0002', hrkMnuId: 'MINF0001', sreTc: '01', mnuNm: '예산', mnuTpC: 'LNK', srePth: '/info/budget',
        mnuSotSqnSno: 10, hidYn: 'N', mnuDep: 2, whlMnuPth: '/MINF0001/MINF0002', children: [] },
    ] },
  { mnuId: 'MADM0001', hrkMnuId: null, sreTc: '03', mnuNm: '관리', mnuTpC: 'LNK', srePth: '/admin/menus',
    mnuSotSqnSno: 10, hidYn: 'N', mnuDep: 1, whlMnuPth: '/MADM0001', children: [] },
];

describe('useMenu helpers', () => {
  it('flattenById indexes every node by mnuId', () => {
    const map = flattenById(tree);
    expect(map.get('MINF0002')?.mnuNm).toBe('예산');
    expect(map.size).toBe(3);
  });

  it('indexByPath indexes LNK nodes by srePth', () => {
    const map = indexByPath(tree);
    expect(map.get('/info/budget')?.mnuId).toBe('MINF0002');
    expect(map.get('/admin/menus')?.mnuId).toBe('MADM0001');
  });

  it('groupByContext buckets roots by SRE_TC context', () => {
    const byCtx = groupByContext(tree);
    expect(byCtx.info?.map(n => n.mnuId)).toEqual(['MINF0001']);
    expect(byCtx.admin?.map(n => n.mnuId)).toEqual(['MADM0001']);
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
cd "C:/it/it_frontend" && npm test -- useMenu
```
Expected: FAIL — module/exports not found.

- [ ] **Step 3: Implement `useMenu.ts`** (pure helpers exported for tests; composable wraps them)

```ts
import { computed } from 'vue';
import { useApiFetch } from '~/composables/useApiFetch';
import { CONTEXT_BY_SRE_TC, type ContextCode, type MenuNode } from '~/types/menu';

/** 트리를 mnuId → 노드 Map으로 평탄화. */
export function flattenById(tree: MenuNode[]): Map<string, MenuNode> {
  const map = new Map<string, MenuNode>();
  const walk = (nodes: MenuNode[]) => {
    for (const n of nodes) {
      map.set(n.mnuId, n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return map;
}

/** LNK 노드를 srePth → 노드 Map으로 인덱싱 (Breadcrumb 역인덱스). */
export function indexByPath(tree: MenuNode[]): Map<string, MenuNode> {
  const map = new Map<string, MenuNode>();
  const walk = (nodes: MenuNode[]) => {
    for (const n of nodes) {
      if (n.srePth) map.set(n.srePth, n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return map;
}

/** 루트 노드를 SRE_TC 컨텍스트별로 버킷팅. */
export function groupByContext(tree: MenuNode[]): Partial<Record<ContextCode, MenuNode[]>> {
  const out: Partial<Record<ContextCode, MenuNode[]>> = {};
  for (const root of tree) {
    const ctx = CONTEXT_BY_SRE_TC[root.sreTc as keyof typeof CONTEXT_BY_SRE_TC];
    if (!ctx) continue;
    (out[ctx] ??= []).push(root);
  }
  return out;
}

/** 메뉴 트리 단일 소스. 사이드바·Breadcrumb 공용. */
export function useMenu() {
  const config = useRuntimeConfig();
  const { data, pending, refresh } = useApiFetch<MenuNode[]>(`${config.public.apiBase}/api/menus`);

  const tree = computed<MenuNode[]>(() => data.value ?? []);
  const treeByContext = computed(() => groupByContext(tree.value));
  const nodeById = computed(() => flattenById(tree.value));
  const nodeByPath = computed(() => indexByPath(tree.value));

  return { tree, treeByContext, nodeById, nodeByPath, pending, refresh };
}
```

- [ ] **Step 4: Run — verify pass, then commit**

```bash
cd "C:/it/it_frontend" && npm test -- useMenu
git add it_frontend/app/composables/useMenu.ts it_frontend/tests/unit/composables/useMenu.test.ts
git commit -m "feat(menu): add useMenu composable with tree helpers (TDD)"
```

---

## Task 5: `useAdminMenu` composable (admin CRUD)

**Files:**
- Create: `it_frontend/app/composables/useAdminMenu.ts`

- [ ] **Step 1: Write the composable** (GET via `useApiFetch`; mutations via `$apiFetch` + absolute URL)

```ts
import { useApiFetch } from '~/composables/useApiFetch';
import type { MenuNode, RouteCatalogItem } from '~/types/menu';

export interface MenuUpsertRequest {
  mnuNm: string;
  sreTc: string;
  mnuTpC: 'LNK' | 'GRP' | 'DYN';
  hrkMnuId?: string | null;
  srePth?: string | null;
  hidYn?: string;
  athIds?: string[];
}

export function useAdminMenu() {
  const config = useRuntimeConfig();
  const { $apiFetch } = useNuxtApp();
  const BASE = `${config.public.apiBase}/api/admin`;

  const fetchAdminTree = () => useApiFetch<MenuNode[]>(`${BASE}/menus`);
  const fetchRoutes = () => useApiFetch<RouteCatalogItem[]>(`${BASE}/routes`);
  const fetchAllRoutes = () => useApiFetch<RouteCatalogItem[]>(`${BASE}/routes/all`);

  const createMenu = (req: MenuUpsertRequest) =>
    $apiFetch<string>(`${BASE}/menus`, { method: 'POST', body: req });
  const updateMenu = (mnuId: string, req: MenuUpsertRequest) =>
    $apiFetch<void>(`${BASE}/menus/${mnuId}`, { method: 'PUT', body: req });
  const deleteMenu = (mnuId: string) =>
    $apiFetch<void>(`${BASE}/menus/${mnuId}`, { method: 'DELETE' });
  const reorderMenus = (orderedMnuIds: string[]) =>
    $apiFetch<void>(`${BASE}/menus/reorder`, { method: 'PATCH', body: { orderedMnuIds } });
  const moveMenu = (mnuId: string, newHrkMnuId: string | null) =>
    $apiFetch<void>(`${BASE}/menus/${mnuId}/move`, { method: 'PATCH', body: { newHrkMnuId } });

  const createRoute = (req: RouteCatalogItem) =>
    $apiFetch<void>(`${BASE}/routes`, { method: 'POST', body: req });
  const updateRoute = (req: RouteCatalogItem) =>
    $apiFetch<void>(`${BASE}/routes`, { method: 'PUT', body: req });
  const deleteRoute = (srePth: string) =>
    $apiFetch<void>(`${BASE}/routes?srePth=${encodeURIComponent(srePth)}`, { method: 'DELETE' });

  return { fetchAdminTree, fetchRoutes, fetchAllRoutes,
           createMenu, updateMenu, deleteMenu, reorderMenus, moveMenu,
           createRoute, updateRoute, deleteRoute };
}
```

- [ ] **Step 2: Commit**

```bash
git add it_frontend/app/composables/useAdminMenu.ts
git commit -m "feat(menu): add useAdminMenu composable (CRUD/reorder/move)"
```

---

## Task 6: `AppBreadcrumb.vue` (TDD on the items builder)

**Files:**
- Create: `it_frontend/app/utils/breadcrumb.ts` (pure items builder — testable)
- Create: `it_frontend/app/components/AppBreadcrumb.vue`
- Test: `it_frontend/tests/unit/components/AppBreadcrumb.test.ts`

- [ ] **Step 1: Write the failing test** for the pure builder

```ts
import { describe, expect, it } from 'vitest';
import { buildBreadcrumbItems } from '~/utils/breadcrumb';
import type { MenuNode } from '~/types/menu';

const node = (id: string, type: 'LNK'|'GRP', path: string | null, nm: string): MenuNode => ({
  mnuId: id, hrkMnuId: null, sreTc: '01', mnuNm: nm, mnuTpC: type, srePth: path,
  mnuSotSqnSno: 10, hidYn: 'N', mnuDep: 1, whlMnuPth: '', children: [],
});

describe('buildBreadcrumbItems', () => {
  const byId = new Map<string, MenuNode>([
    ['MINF0001', node('MINF0001', 'GRP', null, '정보화')],
    ['MINF0002', node('MINF0002', 'LNK', '/info/budget', '예산')],
  ]);

  it('maps WHL_MNU_PTH segments to {label, route}, GRP has no route', () => {
    const current = { ...node('MINF0002', 'LNK', '/info/budget', '예산'), whlMnuPth: '/MINF0001/MINF0002' };
    const items = buildBreadcrumbItems(current, byId);
    expect(items).toEqual([
      { label: '정보화', route: undefined },
      { label: '예산', route: '/info/budget' },
    ]);
  });

  it('returns [] when current is null', () => {
    expect(buildBreadcrumbItems(null, byId)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
cd "C:/it/it_frontend" && npm test -- AppBreadcrumb
```
Expected: FAIL — `buildBreadcrumbItems` not found.

- [ ] **Step 3: Implement the builder + component**

`app/utils/breadcrumb.ts`:
```ts
import type { MenuNode } from '~/types/menu';

export interface BreadcrumbItem { label: string; route?: string; }

export function buildBreadcrumbItems(
  current: MenuNode | null | undefined,
  byId: Map<string, MenuNode>,
): BreadcrumbItem[] {
  if (!current) return [];
  return current.whlMnuPth.split('/').filter(Boolean).map((id) => {
    const node = byId.get(id);
    return {
      label: node?.mnuNm ?? id,
      route: node?.mnuTpC === 'LNK' ? (node.srePth ?? undefined) : undefined,
    };
  });
}
```

`app/components/AppBreadcrumb.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useMenu } from '~/composables/useMenu';
import { buildBreadcrumbItems } from '~/utils/breadcrumb';

const route = useRoute();
const { nodeByPath, nodeById } = useMenu();

const home = { icon: 'pi pi-home', route: '/' };

const items = computed(() => {
  const current = nodeByPath.value.get(route.fullPath) ?? nodeByPath.value.get(route.path);
  return buildBreadcrumbItems(current, nodeById.value);
});
</script>

<template>
  <Breadcrumb v-if="items.length" :home="home" :model="items" class="px-6 py-2 border-b print:hidden" />
</template>
```
> PrimeVue `Breadcrumb` auto-disables items without a `route`. `route.fullPath` (incl. query) is tried before `route.path`, matching the spec's query-string fallback.

- [ ] **Step 4: Run — verify pass, then commit**

```bash
cd "C:/it/it_frontend" && npm test -- AppBreadcrumb
git add it_frontend/app/utils/breadcrumb.ts it_frontend/app/components/AppBreadcrumb.vue it_frontend/tests/unit/components/AppBreadcrumb.test.ts
git commit -m "feat(menu): add AppBreadcrumb component (TDD)"
```

---

## Task 7: Insert `<AppBreadcrumb/>` into the layout

**Files:**
- Modify: `it_frontend/app/layouts/default.vue`

- [ ] **Step 1: Add the component** between `<AppHeader/>` and `<main>`

Find:
```html
      <AppHeader class="print:hidden" />

      <!-- Main content -->
      <main class="main-scroll flex-1 min-h-0 overflow-auto p-6 ...">
```
Replace with (insert the one line):
```html
      <AppHeader class="print:hidden" />

      <AppBreadcrumb />

      <!-- Main content -->
      <main class="main-scroll flex-1 min-h-0 overflow-auto p-6 ...">
```
> `AppBreadcrumb` is auto-imported (Nuxt components dir). It renders nothing on pages with no matching menu node (e.g. login), since `items` is empty.

- [ ] **Step 2: Commit**

```bash
git add it_frontend/app/layouts/default.vue
git commit -m "feat(menu): mount AppBreadcrumb in default layout"
```

---

## Task 8: Refactor `AppSidebar.vue` to consume `useMenu`

**Files:**
- Modify: `it_frontend/app/components/AppSidebar.vue`

> This is the riskiest task. The template (~190 lines) stays; only the data source changes. Keep the badge-count composables. Replace the hardcoded `menuItems` tree with `treeByContext`, and read icon/badge from the presentation maps. Do this on a branch and verify visually before committing.

- [ ] **Step 1: Add imports + data source** (in `<script setup>`)

Add near the existing imports:
```ts
import { useMenu } from '~/composables/useMenu';
import { iconFor, badgeKeyFor } from '~/utils/menuPresentation';
import type { MenuNode } from '~/types/menu';
```
Add the menu source (keep the existing `context` computed that derives `'info'|'audit'|...` from `route.path`):
```ts
const { treeByContext } = useMenu();
```

- [ ] **Step 2: Replace the hardcoded `menuItems` computed**

Delete the entire old `const menuItems = computed(() => { ... })` block (the ~145-line switch that builds the `info`/`audit`/`admin`/`board`/`approval` trees, including the `sidebarBoards` mapping — boards now come from the backend DYN node). Replace with:
```ts
// DB 트리에서 현재 컨텍스트의 루트 목록을 가져온다. 아이콘/배지/동적 게시판은 서버+규약 맵 소관.
const menuItems = computed<MenuNode[]>(() => treeByContext.value[context.value] ?? []);
```
Then remove the now-unused `sidebarBoards` computed and the `useBoard` import **if** nothing else uses them — first run `grep -n "sidebarBoards\|useBoard" app/components/AppSidebar.vue` and only delete lines with no other references.

- [ ] **Step 3: Adapt the template bindings** (switch field names to `MenuNode`; source icon/badge from maps)

The old template used `item.label`, `item.icon`, `item.to`, `item.badge`, `item.admin`, `item.items`. Map each:
- `item.label` → `item.mnuNm`
- `item.to` → `item.srePth`
- `item.items` → `item.children`
- `item.icon` → `iconFor(item.mnuId)` (in `:class` bindings)
- `item.badge` → `badgeKeyFor(item.mnuId)`
- admin-only hiding: the backend already pruned unauthorized nodes, so change `v-else-if="!item.admin || isAdminUser"` to plain `v-else` (no node carries `admin` anymore).

Add a badge → live count helper (reuse the existing count refs already in the file — `approvalCount`, `docReviewingCount`, `approvalPendingCount`, `approvalInProgressCount`; confirm their exact names with `grep -n "Count" app/components/AppSidebar.vue` and adjust):
```ts
const badgeCount = (mnuId: string): number => {
  switch (badgeKeyFor(mnuId)) {
    case 'approvalPending': return approvalPendingCount.value ?? approvalCount.value ?? 0;
    case 'approvalInProgress': return approvalInProgressCount.value ?? 0;
    case 'docReviewing': return docReviewingCount.value ?? 0;
    default: return 0;
  }
};
```
In the template badge `<span>`, replace the old `getMenuBadge(sub)` logic with `v-if="badgeCount(sub.mnuId) > 0"` rendering `{{ badgeCount(sub.mnuId) }}`. Replace the icon binding `:class="[item.icon, ...]"` with `:class="[iconFor(item.mnuId), ...]"`.

> Keep the existing nesting structure (root → children → grandchildren) but bind `.children` instead of `.items`. The depth-3 structure is unchanged.

- [ ] **Step 4: Verify visually** (the real test for this task)

```bash
cd "C:/it/it_frontend" && npm run dev
```
With the backend running (Plan 1) and logged in:
- Sidebar renders the same items as before in each context (info/audit/admin/board/documents/approval).
- Icons appear on the same nodes; approval/document badges still show counts.
- Board context lists boards (from the DYN node).
- A normal user does NOT see admin-only nodes.

- [ ] **Step 5: Commit**

```bash
git add it_frontend/app/components/AppSidebar.vue
git commit -m "refactor(menu): drive AppSidebar from DB menu tree via useMenu"
```

---

## Task 9: `/admin/routes` page (StyledDataTable)

**Files:**
- Create: `it_frontend/app/pages/admin/routes/index.vue`
- Reference: `it_frontend/app/pages/admin/codes.vue` (exact StyledDataTable + useAdminTableEdit pattern)

- [ ] **Step 1: Write the page**

```vue
<script setup lang="ts">
import { useToast } from 'primevue/usetoast';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import { useAdminTableEdit } from '~/composables/useAdminTableEdit';
import { useAdminMenu } from '~/composables/useAdminMenu';
import type { RouteCatalogItem } from '~/types/menu';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const { fetchAllRoutes, createRoute, updateRoute, deleteRoute } = useAdminMenu();
const { data: routes, pending, refresh } = await fetchAllRoutes();

const {
  viewMode, editRows, selectedRows, saving,
  enterEditMode, cancelEdit, saveAndExitEdit,
  rowStatus, rowClass, isRowEditing, markDirty, addRow, deleteRow,
} = useAdminTableEdit<RouteCatalogItem>({
  sourceData: routes,
  toast,
  makeBlankRow: () => ({ srePth: '', sreMnuNm: '', sreTc: '', useYn: 'Y', rmk: null }),
  onBatchSave: async ({ newRows, modifiedRows, deletedRows }) => {
    await Promise.all([
      ...newRows.map((r) => createRoute(r)),
      ...modifiedRows.map((r) => updateRoute(r)),
      ...deletedRows.map((r) => deleteRoute(r.srePth)),
    ]);
    await refresh();
    toast.add({ severity: 'success', summary: '저장 완료', life: 2000 });
  },
});
</script>

<template>
  <div class="p-6">
    <div class="flex justify-between items-center mb-4">
      <h1 class="text-xl font-bold">라우트 카탈로그</h1>
      <div class="flex gap-2">
        <Button v-if="viewMode === 'view'" label="편집" icon="pi pi-pencil" @click="enterEditMode" />
        <template v-else>
          <Button label="행 추가" icon="pi pi-plus" severity="secondary" @click="addRow" />
          <Button label="취소" severity="secondary" @click="cancelEdit" />
          <Button label="저장" icon="pi pi-check" :loading="saving" @click="saveAndExitEdit" />
        </template>
      </div>
    </div>

    <StyledDataTable
      v-model:selection="selectedRows"
      :value="editRows" :loading="pending" :row-class="rowClass"
      data-key="srePth" scrollable scroll-height="flex" paginator :rows="50">
      <Column v-if="viewMode === 'edit'" header="상태" :style="{ width: '80px' }">
        <template #body="{ data }">
          <Tag v-if="rowStatus(data) === 'new'" value="신규" severity="info" />
          <Tag v-else-if="rowStatus(data) === 'modified'" value="수정" severity="warn" />
          <Tag v-else-if="rowStatus(data) === 'deleted'" value="삭제" severity="danger" />
        </template>
      </Column>
      <Column field="srePth" header="화면경로">
        <template #body="{ data }">
          <InputText v-if="isRowEditing(data)" v-model="data.srePth" class="w-full" @input="markDirty(data)" />
          <span v-else>{{ data.srePth }}</span>
        </template>
      </Column>
      <Column field="sreMnuNm" header="화면메뉴명">
        <template #body="{ data }">
          <InputText v-if="isRowEditing(data)" v-model="data.sreMnuNm" class="w-full" @input="markDirty(data)" />
          <span v-else>{{ data.sreMnuNm }}</span>
        </template>
      </Column>
      <Column field="sreTc" header="화면구분">
        <template #body="{ data }">
          <InputText v-if="isRowEditing(data)" v-model="data.sreTc" class="w-24" @input="markDirty(data)" />
          <span v-else>{{ data.sreTc }}</span>
        </template>
      </Column>
      <Column field="useYn" header="사용">
        <template #body="{ data }">
          <InputText v-if="isRowEditing(data)" v-model="data.useYn" class="w-16" @input="markDirty(data)" />
          <span v-else>{{ data.useYn }}</span>
        </template>
      </Column>
      <Column field="rmk" header="비고">
        <template #body="{ data }">
          <InputText v-if="isRowEditing(data)" v-model="data.rmk" class="w-full" @input="markDirty(data)" />
          <span v-else>{{ data.rmk }}</span>
        </template>
      </Column>
      <Column v-if="viewMode === 'edit'" header="" :style="{ width: '48px' }">
        <template #body="{ data }">
          <Button :icon="rowStatus(data) === 'deleted' ? 'pi pi-undo' : 'pi pi-trash'"
                  :severity="rowStatus(data) === 'deleted' ? 'success' : 'danger'" text @click="deleteRow(data)" />
        </template>
      </Column>
    </StyledDataTable>
  </div>
</template>
```
> Match the exact slot/prop usage in `admin/codes.vue` if your `useAdminTableEdit` build differs (e.g. `InlineEditCell` vs raw `InputText`, or `addRow` requiring `makeBlankRow`). The `makeBlankRow` option above covers the add-row case.

- [ ] **Step 2: Verify in the browser, then commit**

```bash
cd "C:/it/it_frontend" && npm run dev   # visit /admin/routes, add/edit/delete a test route, confirm it persists
git add it_frontend/app/pages/admin/routes/index.vue
git commit -m "feat(menu): add /admin/routes catalog management page"
```

---

## Task 10: `/admin/menus` page (PrimeVue Tree + edit form)

**Files:**
- Create: `it_frontend/app/pages/admin/menus/index.vue`

- [ ] **Step 1: Write the page** (left: draggable Tree; right: edit form; save via `useAdminMenu`)

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useMenu } from '~/composables/useMenu';
import { useAdminMenu, type MenuUpsertRequest } from '~/composables/useAdminMenu';
import type { MenuNode, RouteCatalogItem } from '~/types/menu';
import { ROLE } from '~/types/auth';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const toast = useToast();
const { refresh: refreshSidebar } = useMenu();
const { fetchAdminTree, fetchRoutes, createMenu, updateMenu, deleteMenu, moveMenu } = useAdminMenu();
const { data: adminTree, refresh } = await fetchAdminTree();
const { data: routes } = await fetchRoutes();

// PrimeVue Tree expects { key, label, children } — map MenuNode → TreeNode
const toTreeNode = (n: MenuNode): any => ({
  key: n.mnuId, label: n.mnuNm, data: n,
  children: (n.children ?? []).map(toTreeNode),
});
const treeNodes = computed(() => (adminTree.value ?? []).map(toTreeNode));

const selectedKey = ref<Record<string, boolean>>({});
const selectedNode = ref<MenuNode | null>(null);
const onSelect = (node: any) => { selectedNode.value = node.data as MenuNode; };

const form = ref<MenuUpsertRequest>({ mnuNm: '', sreTc: '', mnuTpC: 'LNK', srePth: null, hidYn: 'N', athIds: [] });
const isNew = ref(false);

const startNew = () => {
  isNew.value = true; selectedNode.value = null;
  form.value = { mnuNm: '', sreTc: '01', mnuTpC: 'LNK', hrkMnuId: null, srePth: null, hidYn: 'N', athIds: [] };
};
const loadForm = (n: MenuNode) => {
  isNew.value = false;
  form.value = { mnuNm: n.mnuNm, sreTc: n.sreTc, mnuTpC: n.mnuTpC, hrkMnuId: n.hrkMnuId,
                 srePth: n.srePth, hidYn: n.hidYn, athIds: [] };  // athIds: see note below
};

const routeOptions = computed(() => (routes.value ?? []).map((r: RouteCatalogItem) => ({ label: r.srePth, value: r.srePth })));
const roleOptions = [
  { label: '시스템관리자', value: ROLE.ADMIN },
  { label: '기획통할담당자', value: ROLE.DEPT_MANAGER },
  { label: '일반사용자', value: ROLE.USER },
];

const save = async () => {
  try {
    if (isNew.value) await createMenu(form.value);
    else if (selectedNode.value) await updateMenu(selectedNode.value.mnuId, form.value);
    await refresh();
    await refreshSidebar();
    toast.add({ severity: 'success', summary: '저장 완료', life: 2000 });
  } catch (e: any) {
    toast.add({ severity: 'error', summary: '저장 실패', detail: e?.data ?? '오류', life: 4000 });
  }
};

const remove = async () => {
  if (!selectedNode.value) return;
  try {
    await deleteMenu(selectedNode.value.mnuId);
    await refresh(); await refreshSidebar();
    selectedNode.value = null;
    toast.add({ severity: 'success', summary: '삭제 완료', life: 2000 });
  } catch (e: any) {
    toast.add({ severity: 'error', summary: '삭제 실패', detail: e?.data ?? '하위 메뉴 존재 가능', life: 4000 });
  }
};

// 드래그&드롭 부모 변경
const onDrop = async (event: any) => {
  const dragged: MenuNode = event.dragNode?.data;
  const target: MenuNode | null = event.dropNode?.data ?? null;
  if (!dragged) return;
  try {
    await moveMenu(dragged.mnuId, target?.mnuId ?? null);
    await refresh(); await refreshSidebar();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: '이동 실패', detail: e?.data ?? '깊이/순환 위반', life: 4000 });
  }
};

watch(selectedNode, (n) => { if (n) loadForm(n); });
</script>

<template>
  <div class="p-6 grid grid-cols-[360px_1fr] gap-6">
    <div>
      <div class="flex justify-between mb-2">
        <h2 class="font-bold">메뉴 트리</h2>
        <Button label="신규" icon="pi pi-plus" size="small" @click="startNew" />
      </div>
      <Tree :value="treeNodes" v-model:selection-keys="selectedKey" selection-mode="single"
            :dragdrop-scope="'menu'" @node-select="onSelect" @node-drop="onDrop" class="border rounded" />
    </div>

    <div v-if="isNew || selectedNode" class="border rounded p-4 space-y-3 max-w-lg">
      <h2 class="font-bold">{{ isNew ? '새 메뉴' : '메뉴 편집' }}</h2>
      <div><label class="block text-sm">메뉴명</label><InputText v-model="form.mnuNm" class="w-full" /></div>
      <div><label class="block text-sm">화면구분코드</label><InputText v-model="form.sreTc" class="w-24" /></div>
      <div><label class="block text-sm">유형</label>
        <Select v-model="form.mnuTpC" :options="['LNK','GRP','DYN']" class="w-40" />
      </div>
      <div v-if="form.mnuTpC === 'LNK'"><label class="block text-sm">화면경로</label>
        <Select v-model="form.srePth" :options="routeOptions" option-label="label" option-value="value"
                filter class="w-full" placeholder="라우트 선택" />
      </div>
      <div><label class="block text-sm">숨김</label>
        <Select v-model="form.hidYn" :options="[{label:'노출',value:'N'},{label:'숨김',value:'Y'}]"
                option-label="label" option-value="value" class="w-32" />
      </div>
      <div><label class="block text-sm">노출 권한 (비우면 전체 공개)</label>
        <div class="flex gap-3">
          <label v-for="r in roleOptions" :key="r.value" class="flex items-center gap-1">
            <Checkbox v-model="form.athIds" :value="r.value" /> {{ r.label }}
          </label>
        </div>
      </div>
      <div class="flex gap-2 pt-2">
        <Button label="저장" icon="pi pi-check" @click="save" />
        <Button v-if="!isNew" label="삭제" severity="danger" icon="pi pi-trash" @click="remove" />
      </div>
    </div>
  </div>
</template>
```
> **Note on `athIds` when editing:** the read tree does not carry the role mapping, so `loadForm` starts with `athIds: []`. Re-saving would clear existing mappings. Choose one: (a) show a visible hint "권한을 다시 지정하지 않으면 전체 공개로 바뀝니다" (acceptable first cut), or (b) add a lossless path — backend `GET /api/admin/menus/{mnuId}/roles` (controller method → `cmenuaRepository.findActiveByMnuId` → list of athId) and load it in `loadForm`. Prefer (b) if role editing must be safe; it is a 3-step sub-task. Also confirm the installed PrimeVue `Tree` drag-drop event names/payload (`@node-drop`, `event.dragNode`/`event.dropNode`) and adjust if they differ.

- [ ] **Step 2: Verify in the browser**

`npm run dev` → `/admin/menus`: select a node (form loads), rename + save (sidebar updates after `refreshSidebar`), toggle hidden, drag a node to a new parent (tree + sidebar update), create a new menu, delete a leaf (and confirm a parent-with-children returns the 409 toast).

- [ ] **Step 3: Commit**

```bash
git add it_frontend/app/pages/admin/menus/index.vue
git commit -m "feat(menu): add /admin/menus tree management page"
```

---

## Task 11: Register the menu change-log in the admin log registry

**Files:**
- Modify: `it_frontend/app/utils/adminLogs.ts`
- Modify: `it_frontend/app/components/AppSidebar.vue` (the static `adminLogMenuGroups`)

> The menu/route admin pages themselves are seeded as menu nodes `MADM0001`/`MADM0002` in Plan 1 Task 12 (mapped to `ITPAD001`), so they appear in the DB-driven sidebar automatically.

- [ ] **Step 1: Add the menu log table entry**

In `adminLogs.ts`, append to `ADMIN_LOG_TABLES`:
```ts
{ key: 'cmenum', title: '메뉴 변경 로그', menuLabel: '메뉴 관리', tableName: 'TPRMPP_CMENUL' },
```

- [ ] **Step 2: Add `cmenum` to the sidebar log group**

In `AppSidebar.vue`'s `adminLogMenuGroups` (the static admin-log grouping, independent of the DB tree), add `'cmenum'` to the appropriate group's `items: [...].map(getAdminLogMenuItem)` array (e.g. the 공통관리 group).

- [ ] **Step 3: Verify the log page works** — `npm run dev` → make a menu change → `/admin/logs/cmenum` shows the snapshot row.

- [ ] **Step 4: Commit**

```bash
git add it_frontend/app/utils/adminLogs.ts it_frontend/app/components/AppSidebar.vue
git commit -m "feat(menu): register cmenum change-log in admin log registry"
```

---

## Task 12: `menuPresentation` parity unit test

**Files:**
- Create: `it_frontend/tests/unit/utils/menuPresentation.test.ts`

- [ ] **Step 1: Write the test** (shape + no malformed entries)

```ts
import { describe, expect, it } from 'vitest';
import { MENU_ICON, MENU_BADGE, iconFor, badgeKeyFor } from '~/utils/menuPresentation';

describe('menuPresentation maps', () => {
  it('every icon value is a non-empty pi class and id looks like an MNU_ID', () => {
    for (const [id, icon] of Object.entries(MENU_ICON)) {
      expect(id).toMatch(/^M[A-Z]{3}\d{4}$/);
      expect(icon).toMatch(/^pi pi-/);
    }
  });

  it('every badge value is a known BadgeKey', () => {
    const valid = ['approvalPending', 'approvalInProgress', 'docReviewing'];
    for (const v of Object.values(MENU_BADGE)) expect(valid).toContain(v);
  });

  it('lookup helpers return undefined for unknown ids', () => {
    expect(iconFor('NOPE9999')).toBeUndefined();
    expect(badgeKeyFor('NOPE9999')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, then commit**

```bash
cd "C:/it/it_frontend" && npm test -- menuPresentation
git add it_frontend/tests/unit/utils/menuPresentation.test.ts
git commit -m "test(menu): add menuPresentation map shape tests"
```

---

## Task 13: §6.4 seed-vs-code parity verification + full check

**Files:** none (verification) — both servers running

- [ ] **Step 1: Run the full frontend gate**

```bash
cd "C:/it/it_frontend" && npm test && npm run typecheck && npm run lint
```
Expected: all green.

- [ ] **Step 2: Parity check — DB tree vs old hardcoded sidebar**

With both servers up, log in as admin and compare each context's sidebar against the pre-refactor behavior (git-stashed old `AppSidebar.vue` or screenshots):
- Labels, order, nesting match for info/audit/admin/board/documents/approval.
- Icons appear on the same nodes (any missing icon = a `MENU_ICON` key not matching a seeded `MNU_ID` — fix in `menuPresentation.ts`).
- Approval/document badges show the same counts.
- Board context lists the same boards a normal user saw before (DYN resolver parity).
- Breadcrumb shows the correct trail on a deep page (e.g. `/info/budget`).

- [ ] **Step 3: Regression check — the 2026-04 incident**

In `/admin/menus`, toggle a menu to hidden → in another browser session, refresh → the menu disappears from the sidebar with **no deploy**. This is the core acceptance criterion. Toggle it back.

- [ ] **Step 4: Non-admin check**

Log in as a normal user: admin-context menus and admin-only nodes are absent; `/admin/menus` direct URL redirects to `/` (middleware); the admin API returns 403.

- [ ] **Step 5: Update docs + commit**

Edit `it_frontend/CLAUDE.md`: document `pages/admin/menus`, `pages/admin/routes`, the `useMenu`/`useAdminMenu` composables, and that `app/utils/menuPresentation.ts` (icon/badge) is keyed by `MNU_ID` and must be updated when a new icon-bearing menu node is seeded. Then:
```bash
git add it_frontend/CLAUDE.md
git commit -m "docs(menu): document menu admin pages and presentation map convention"
```

---

## Self-review checklist (run before handing off)

- [ ] **Spec coverage:** §5.1 files ✓ (all tasks), §5.2 useMenu ✓ (T4), §5.3 AppSidebar refactor ✓ (T8), §5.4 AppBreadcrumb ✓ (T6/T7), §5.5 /admin/menus ✓ (T10), §5.6 /admin/routes ✓ (T9), §5.7 middleware (reused, unchanged), §5.8 menu-admin menu nodes ✓ (seeded P1.T12 + log entry T11), §3.6 presentation maps ✓ (T3), §4.3 server-side board filter ✓ (T1), §6.4 parity ✓ (T13).
- [ ] **No placeholders:** the only fill-in is `MENU_ICON`/`MENU_BADGE` entries (T3) — inherent data entry from the seed + old sidebar, with a concrete extraction step.
- [ ] **Type consistency:** `MenuNode`, `RouteCatalogItem`, `MenuUpsertRequest`, `ContextCode`, `BadgeKey` used identically across `types/menu.ts`, `useMenu`, `useAdminMenu`, components, tests. `iconFor`/`badgeKeyFor`/`flattenById`/`indexByPath`/`groupByContext`/`buildBreadcrumbItems` signatures match their call sites and tests.
- [ ] **Open decisions flagged for the implementer:** (a) `athIds` lossless edit in `/admin/menus` (T10 note — option a vs b); (b) PrimeVue `Tree` drag-drop event payload prop names (T10 — verify against installed version); (c) `useAdminTableEdit.addRow`/`makeBlankRow` exact contract (T9 — match `codes.vue`); (d) badge count ref names in `AppSidebar` (T8 — grep to confirm).
- [ ] **Verify before claiming done:** `npm test && npm run typecheck && npm run lint` green AND the T13 parity + 2026-04 regression + non-admin checks all pass against both live servers.

---

## Execution handoff

Plans 1 and 2 together implement the full menu-management spec. Recommended order: finish **Plan 1** end-to-end (backend API live + Task 13 smoke), then **Plan 2** (this plan). Within each plan, **Subagent-Driven** execution (fresh subagent per task + review between tasks) is recommended given the cross-file coupling, with the `AppSidebar.vue` refactor (T8) and `/admin/menus` (T10) reviewed most carefully.
