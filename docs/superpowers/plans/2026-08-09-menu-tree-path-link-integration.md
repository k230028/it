# Menu Tree, Path Catalog, and External Link Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 메뉴 트리에 3가지 펼침 동작과 유형별 A안 스타일을 적용하고, 게시판을 PGE로 통합하며 경로 카탈로그에 등록한 외부 URL을 LNK 메뉴가 새 창으로 열게 한다.

**Architecture:** `SRE_PTH` 형식과 `MNU_TP_C` 조합을 단일 계약으로 사용한다. 백엔드는 내부 경로·외부 URL·게시판 경로를 중앙 정책으로 검증하고, 프론트는 같은 분류 규칙으로 선택지를 필터링한다. 사용자 탐색은 공통 메뉴 링크 컴포넌트와 노드 탐색 함수로 통일한다.

**Tech Stack:** Oracle/Flyway SQL, Java 21, Spring Boot, JUnit 5, Mockito, Nuxt 4 CSR, Vue 3, TypeScript, PrimeVue 4, Vitest, Playwright

## Global Constraints

- 모든 신규 코드 주석과 JavaDoc/TSDoc은 한글로 작성한다.
- 메뉴 최대 깊이는 기존과 같은 4단이며, 부분 접기는 정확히 2단계 메뉴까지만 표시한다.
- 버튼 라벨은 `모두 펼치기`, `부분 접기`, `모두 접기`를 사용한다.
- 유효 메뉴유형은 `GRP`, `LNK`, `PGE`뿐이며 `BRD`는 신규 마이그레이션으로 제거한다.
- 외부 URL은 사용자정보가 없는 `http` 또는 `https` 절대 URL만 허용한다.
- LNK는 `target="_blank"`, `rel="noopener noreferrer"`로 열고 현재 포털 라우트를 바꾸지 않는다.
- 게시판 PGE는 `/board/{게시판관리번호}` 경로를 사용하며 비활성 게시판은 사용자 트리에서 숨긴다.
- 프론트는 CSR 전용이며 GET은 `useApiFetch`, 변경 요청은 `$apiFetch`를 사용한다.
- `app/types/api.d.ts`는 직접 수정하지 않고 백엔드 OpenAPI에서 `npm run codegen`으로 생성한다.
- 신규 의존성을 추가하지 않는다.
- 각 저장소의 기존 사용자 변경을 보존하고 이 계획에 명시된 파일만 커밋한다.

---

## File Structure

### Database repository (`it_database`)

- Create `migrations/V20260809_003__UnifyBoardMenusAsPageScreens.sql`: BRD 데이터·공통코드·제약 전환.
- Create `migrations/_verify/menu-path-integration-verify.sql`: 전환 결과와 경로 참조 정합성 확인.

### Backend repository (`it_backend`)

- Create `src/main/java/com/kdb/it/domain/menu/service/MenuPathPolicy.java`: 내부 경로와 외부 URL의 순수 분류 정책.
- Create `src/test/java/com/kdb/it/domain/menu/service/MenuPathPolicyTest.java`: 경계값 테스트.
- Rename `BoardMenuLink.java`/`BoardMenuLinkTest.java` to `BoardScreenPath.java`/`BoardScreenPathTest.java`: 게시판 경로 규약만 보유.
- Modify `AdminRouteService.java`/`AdminRouteServiceTest.java`: 외부 URL 경로 등록 허용.
- Modify `AdminMenuService.java`/`AdminMenuServiceTest.java`: GRP/PGE/LNK 조합 검증.
- Modify `MenuQueryService.java`/`MenuQueryServiceTest.java`: PGE 게시판 경로의 사용 가능 여부 필터.
- Modify `MenuDto.java`/`MenuOpenApiContractTest.java`: BRD OpenAPI 허용값 제거.
- Modify `CLAUDE.md`: 게시판 PGE와 LNK 외부 URL 규칙 현행화.

### Frontend repository (`it_frontend`)

- Create `app/utils/menuPath.ts`: 내부·외부·게시판 경로 분류와 메뉴 노드 탐색 함수.
- Create `tests/unit/utils/menuPath.test.ts`: 분류·새 창 탐색 테스트.
- Create `app/components/layout/MenuNavigationLink.vue`: PGE는 NuxtLink, LNK는 안전한 외부 앵커로 렌더링.
- Create `tests/unit/components/MenuNavigationLink.test.ts`: href/target/rel 계약 테스트.
- Create `app/composables/admin/useMenuTreeExpansion.ts`: 펼침 키 계산 책임.
- Create `tests/unit/composables/admin/useMenuTreeExpansion.test.ts`: 전체·2단계·전체 접기 테스트.
- Modify `app/utils/menuPresentation.ts`/`tests/unit/utils/menuPresentation.test.ts`: A안 유형 표시 메타데이터.
- Modify `app/pages/admin/menus/index.vue`: 툴바·유형 스타일·PGE/LNK 선택지 통합.
- Rename `tests/unit/pages/admin-menus-board-type.test.ts` to `admin-menus-path-options.test.ts`: BRD 전용 계약을 PGE/LNK 계약으로 교체.
- Modify `tests/support/adminMenusPage.ts`: expandedKeys와 경로 픽스처 지원.
- Modify `app/pages/admin/routes/index.vue`: 경로 관리 명칭·유형 태그·기존 PK 읽기 전용.
- Create `tests/unit/pages/admin-routes-path-contract.test.ts`: 내부/외부 표시와 PK 편집 계약.
- Modify `app/components/layout/AppSidebar.vue`/`AppHeader.vue`: 공통 외부 탐색 적용.
- Modify `tests/unit/components/AppHeader.test.ts`; create `AppSidebarExternalLink.test.ts`: 모든 탐색 진입점 검증.
- Modify `CLAUDE.md`: 게시판과 외부 링크 경로 규칙 현행화.
- Regenerate `app/types/api.d.ts` from backend OpenAPI.

### Root repository (`C:\it`)

- Modify `versions.lock`: 호환되는 database/backend/frontend 커밋 조합 갱신.

---

### Task 1: Convert BRD data to PGE in a forward-only migration

**Files:**
- Create: `it_database/migrations/V20260809_003__UnifyBoardMenusAsPageScreens.sql`
- Create: `it_database/migrations/_verify/menu-path-integration-verify.sql`

**Interfaces:**
- Consumes: 기존 `TPRMPP_CMENUM.MNU_TP_C`, `TPRMPP_CCODEM`, `CK_CMENUM_TP`.
- Produces: 활성 메뉴유형이 `GRP/LNK/PGE`로 제한되고 기존 `/board/{게시판관리번호}` 메뉴가 `PGE`인 DB 계약.

- [ ] **Step 1: Write the verification SQL first**

```sql
-- BRD 메뉴·활성 공통코드가 남으면 결과 행이 출력된다.
SELECT MNU_ID, MNU_NM, SRE_PTH
  FROM ITPOWN.TPRMPP_CMENUM
 WHERE MNU_TP_C = 'BRD';

SELECT CO_C_ID_NM, CDVA_ID
  FROM ITPOWN.TPRMPP_CCODEM
 WHERE CO_C_ID_NM = 'MNU_TP_C'
   AND CDVA_ID = 'BRD'
   AND DEL_YN = 'N';

SELECT SEARCH_CONDITION
  FROM ALL_CONSTRAINTS
 WHERE OWNER = 'ITPOWN'
   AND TABLE_NAME = 'TPRMPP_CMENUM'
   AND CONSTRAINT_NAME = 'CK_CMENUM_TP';
```

- [ ] **Step 2: Confirm the current migration still permits BRD**

Run: `rg -n "BRD|CK_CMENUM_TP" migrations/V20260806_001__AddBoardMenuTypeAndSeedBoardMenus.sql`

Expected: the old migration contains the BRD code insert and a four-value check constraint.

- [ ] **Step 3: Add the forward-only migration**

```sql
UPDATE ITPOWN.TPRMPP_CMENUM
   SET MNU_TP_C = 'PGE'
 WHERE MNU_TP_C = 'BRD';

UPDATE ITPOWN.TPRMPP_CCODEM
   SET DEL_YN = 'Y'
 WHERE CO_C_ID_NM = 'MNU_TP_C'
   AND CDVA_ID = 'BRD'
   AND DEL_YN = 'N';

BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE ITPOWN.TPRMPP_CMENUM DROP CONSTRAINT CK_CMENUM_TP';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -2443 THEN RAISE; END IF;
END;
/

ALTER TABLE ITPOWN.TPRMPP_CMENUM
    ADD CONSTRAINT CK_CMENUM_TP CHECK (MNU_TP_C IN ('GRP','LNK','PGE'));
```

Do not edit `V20260806_001__AddBoardMenuTypeAndSeedBoardMenus.sql`; applied migrations are immutable.

- [ ] **Step 4: Run static migration checks**

Run: `rg -n "MNU_TP_C = 'PGE'|CDVA_ID = 'BRD'|GRP','LNK','PGE" migrations/V20260809_003__UnifyBoardMenusAsPageScreens.sql`

Expected: all three transition clauses are found and no check constraint in the new file contains `BRD`.

- [ ] **Step 5: Commit the database migration**

```powershell
git add migrations/V20260809_003__UnifyBoardMenusAsPageScreens.sql migrations/_verify/menu-path-integration-verify.sql
git commit -m "feat: 게시판 메뉴를 페이지화면으로 통합"
```

---

### Task 2: Centralize internal path and external URL validation

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuPathPolicy.java`
- Create: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuPathPolicyTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminRouteService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminRouteServiceTest.java`

**Interfaces:**
- Produces: `MenuPathPolicy.isInternal(String): boolean`, `MenuPathPolicy.isExternalHttpUrl(String): boolean`.
- Consumers: `AdminRouteService` in this task and `AdminMenuService` in Task 3.

- [ ] **Step 1: Write failing path-policy tests**

```java
@ParameterizedTest
@ValueSource(strings = {"/budget/list", "/board/BLBM-0001", "/info/list?status=open"})
void internalPaths_areAccepted(String value) {
    assertThat(MenuPathPolicy.isInternal(value)).isTrue();
}

@ParameterizedTest
@ValueSource(strings = {"//evil.example/x", "budget/list", "/budget list", "https://example.com"})
void nonInternalPaths_areRejected(String value) {
    assertThat(MenuPathPolicy.isInternal(value)).isFalse();
}

@ParameterizedTest
@ValueSource(strings = {"https://example.com/manual", "http://docs.example.com:8080/a?b=1"})
void externalHttpUrls_areAccepted(String value) {
    assertThat(MenuPathPolicy.isExternalHttpUrl(value)).isTrue();
}

@ParameterizedTest
@ValueSource(strings = {
    "javascript:alert(1)",
    "data:text/html,test",
    "//example.com/manual",
    "https://user:pass@example.com/manual",
    "https:///missing-host",
    "https://example.com/a b"
})
void unsafeExternalUrls_areRejected(String value) {
    assertThat(MenuPathPolicy.isExternalHttpUrl(value)).isFalse();
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `./gradlew test --tests "*MenuPathPolicyTest"`

Expected: FAIL because `MenuPathPolicy` does not exist.

- [ ] **Step 3: Implement the minimal policy**

```java
public final class MenuPathPolicy {
    private MenuPathPolicy() {}

    public static boolean isInternal(String value) {
        return value != null
                && value.startsWith("/")
                && !value.startsWith("//")
                && value.chars().noneMatch(Character::isWhitespace);
    }

    public static boolean isExternalHttpUrl(String value) {
        if (value == null || value.chars().anyMatch(Character::isWhitespace)) return false;
        try {
            URI uri = new URI(value);
            String scheme = uri.getScheme();
            return uri.isAbsolute()
                    && ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    && uri.getHost() != null
                    && !uri.getHost().isBlank()
                    && uri.getUserInfo() == null;
        } catch (URISyntaxException ignored) {
            return false;
        }
    }
}
```

- [ ] **Step 4: Replace the route-service rejection test with acceptance and unsafe cases**

```java
@Test
@DisplayName("create: 안전한 HTTPS 외부 URL을 경로로 저장한다")
void create_외부Url_저장() {
    MenuDto.Route route =
            MenuDto.Route.builder()
                    .srePth("https://docs.example.com/manual")
                    .sreMnuNm("업무매뉴얼")
                    .useYn("Y")
                    .build();
    given(cmenudRepository.findBySrePthAndDelYn(route.getSrePth(), "N"))
            .willReturn(Optional.empty());

    service.create(route);

    verify(cmenudRepository).save(any(Cmenud.class));
}

@Test
@DisplayName("create: javascript URL은 거부한다")
void create_javascriptUrl_예외() {
    MenuDto.Route route =
            MenuDto.Route.builder().srePth("javascript:alert(1)").sreMnuNm("위험").build();

    assertThatThrownBy(() -> service.create(route))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("내부 경로 또는 안전한 http(s) URL");
}
```

Update `AdminRouteService.validatePath` to accept when either policy method returns true.

- [ ] **Step 5: Run focused backend tests**

Run: `./gradlew test --tests "*MenuPathPolicyTest" --tests "*AdminRouteServiceTest"`

Expected: PASS.

- [ ] **Step 6: Commit the path policy**

```powershell
git add src/main/java/com/kdb/it/domain/menu/service/MenuPathPolicy.java src/main/java/com/kdb/it/domain/menu/service/AdminRouteService.java src/test/java/com/kdb/it/domain/menu/service/MenuPathPolicyTest.java src/test/java/com/kdb/it/domain/menu/service/AdminRouteServiceTest.java
git commit -m "feat: 경로 카탈로그에 외부 URL 허용"
```

---

### Task 3: Enforce GRP/PGE/LNK menu contracts and board PGE visibility

**Files:**
- Rename: `it_backend/src/main/java/com/kdb/it/domain/menu/service/BoardMenuLink.java` → `BoardScreenPath.java`
- Rename: `it_backend/src/test/java/com/kdb/it/domain/menu/service/BoardMenuLinkTest.java` → `BoardScreenPathTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/dto/MenuOpenApiContractTest.java`

**Interfaces:**
- Consumes: `MenuPathPolicy` from Task 2 and `BoardMetaService.getAllActive()`.
- Produces: `BoardScreenPath.pathOf(String)`, `BoardScreenPath.isBoardPath(String)`, `BoardScreenPath.boardNoOf(String)`, menu API enum `GRP/LNK/PGE`.

- [ ] **Step 1: Write failing AdminMenuService tests**

```java
@Test
@DisplayName("create: LNK는 사용 중인 외부 URL 카탈로그를 참조하면 저장한다")
void create_LNK외부Url_저장() {
    String url = "https://docs.example.com/manual";
    given(cmenudRepository.findBySrePthAndDelYn(url, "N"))
            .willReturn(Optional.of(route(url, "Y")));
    given(cmenumRepository.nextMnuId()).willReturn("MNU0000001");
    given(cmenumRepository.findByMnuIdAndDelYn("PARENT", "N"))
            .willReturn(Optional.of(node("PARENT", null, 1, "/PARENT")));
    MenuDto.UpsertRequest request =
            MenuDto.UpsertRequest.builder()
                    .mnuNm("업무매뉴얼")
                    .mnuTpC("LNK")
                    .hrkMnuId("PARENT")
                    .srePth(url)
                    .build();

    service.create(request);

    verify(cmenumRepository).save(argThat(menu -> "LNK".equals(menu.getMnuTpC())));
}

@Test
@DisplayName("create: PGE에 외부 URL을 지정하면 거부한다")
void create_PGE외부Url_예외() {
    String url = "https://docs.example.com/manual";
    given(cmenudRepository.findBySrePthAndDelYn(url, "N"))
            .willReturn(Optional.of(route(url, "Y")));
    MenuDto.UpsertRequest request =
            MenuDto.UpsertRequest.builder().mnuNm("잘못된 화면").mnuTpC("PGE").srePth(url).build();

    assertThatThrownBy(() -> service.create(request))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("PGE 메뉴는 내부 화면경로");
}

@Test
@DisplayName("create: PGE 게시판 경로는 활성 게시판이면 저장한다")
void create_PGE게시판_저장() {
    given(boardMetaService.getAllActive())
            .willReturn(List.of(board("BLBM-0001", "공지사항")));
    given(cmenumRepository.nextMnuId()).willReturn("MNU0000002");
    given(cmenumRepository.findByMnuIdAndDelYn("PARENT", "N"))
            .willReturn(Optional.of(node("PARENT", null, 1, "/PARENT")));
    MenuDto.UpsertRequest request =
            MenuDto.UpsertRequest.builder()
                    .mnuNm("공지사항")
                    .mnuTpC("PGE")
                    .hrkMnuId("PARENT")
                    .srePth("/board/BLBM-0001")
                    .build();

    service.create(request);

    verify(cmenumRepository).save(argThat(menu -> "PGE".equals(menu.getMnuTpC())));
}
```

Add this route helper beside the existing `node(String, String, int, String)` and `board(String, String)` helpers:

```java
private Cmenud route(String path, String useYn) {
    return Cmenud.builder()
            .srePth(path)
            .sreMnuNm("테스트 경로")
            .useYn(useYn)
            .delYn("N")
            .build();
}
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `./gradlew test --tests "*AdminMenuServiceTest" --tests "*MenuQueryServiceTest" --tests "*MenuOpenApiContractTest"`

Expected: FAIL because LNK is still blocked, PGE does not accept board paths, and OpenAPI still lists BRD.

- [ ] **Step 3: Rename the board helper and remove menu-type ownership**

```java
public final class BoardScreenPath {
    private static final String PATH_PREFIX = "/board/";

    private BoardScreenPath() {}

    public static String pathOf(String blbMngNo) {
        return PATH_PREFIX + blbMngNo;
    }

    public static boolean isBoardPath(String srePth) {
        return srePth != null && srePth.startsWith(PATH_PREFIX);
    }

    public static String boardNoOf(String srePth) {
        if (srePth == null || !srePth.startsWith(PATH_PREFIX)) return null;
        String boardNo = srePth.substring(PATH_PREFIX.length());
        return boardNo.isBlank() || boardNo.contains("/") ? null : boardNo;
    }
}
```

Rename the test class and retain the existing path construction and rejection cases under the new class name.

- [ ] **Step 4: Implement menu type/path validation**

Use these exact branches in `AdminMenuService.validateTypePath`:

```java
if (!List.of("GRP", "LNK", "PGE").contains(mnuTpC)) {
    throw badRequest("잘못된 메뉴유형코드: " + mnuTpC);
}
if ("GRP".equals(mnuTpC)) {
    if (srePth != null) throw badRequest("GRP 메뉴는 경로를 가질 수 없습니다.");
    return;
}
if ("LNK".equals(mnuTpC)) {
    Cmenud route = requireUsableCatalogPath(srePth);
    if (!MenuPathPolicy.isExternalHttpUrl(route.getSrePth())) {
        throw badRequest("LNK 메뉴는 외부 http(s) URL이 필수입니다.");
    }
    return;
}
if (BoardScreenPath.isBoardPath(srePth)) {
    validateBoardPath(srePth);
    return;
}
Cmenud route = requireUsableCatalogPath(srePth);
if (!MenuPathPolicy.isInternal(route.getSrePth())) {
    throw badRequest("PGE 메뉴는 내부 화면경로가 필수입니다.");
}
```

`requireUsableCatalogPath` must reject null/blank, missing, deleted, or `useYn != "Y"` entries with a 400 response.

- [ ] **Step 5: Filter inactive board PGE rows by path**

Change `MenuQueryService` so `activeBoardPaths` is loaded only when an active row has `BoardScreenPath.isBoardPath(m.getSrePth())`. Apply the active-board filter to every row with that prefix, including malformed paths; ordinary PGE and all LNK rows remain visible.

- [ ] **Step 6: Remove BRD from the API contract**

```java
@Schema(
        requiredMode = Schema.RequiredMode.REQUIRED,
        allowableValues = {"GRP", "LNK", "PGE"})
private String mnuTpC;
```

Update `MenuUpsertRequest.srePth` description to `PGE 내부화면경로 또는 LNK 외부 URL` and change the OpenAPI contract test expected set to exactly `GRP`, `LNK`, `PGE`.

- [ ] **Step 7: Run the full menu-domain test slice**

Run: `./gradlew test --tests "com.kdb.it.domain.menu.*"`

Expected: PASS and no test or production source references `BoardMenuLink` or `MNU_TP_C='BRD'`.

- [ ] **Step 8: Commit the backend menu contract**

```powershell
git add src/main/java/com/kdb/it/domain/menu src/test/java/com/kdb/it/domain/menu
git commit -m "feat: 링크메뉴와 게시판 페이지 경로 통합"
```

---

### Task 4: Add shared frontend path classification and safe menu navigation

**Files:**
- Create: `it_frontend/app/utils/menuPath.ts`
- Create: `it_frontend/tests/unit/utils/menuPath.test.ts`
- Create: `it_frontend/app/components/layout/MenuNavigationLink.vue`
- Create: `it_frontend/tests/unit/components/MenuNavigationLink.test.ts`
- Modify: `it_frontend/app/components/layout/AppSidebar.vue`
- Modify: `it_frontend/app/components/layout/AppHeader.vue`
- Modify: `it_frontend/tests/unit/components/AppHeader.test.ts`
- Create: `it_frontend/tests/unit/components/AppSidebarExternalLink.test.ts`
- Modify: `it_frontend/tests/unit/architecture/component-boundaries.test.ts`

**Interfaces:**
- Produces: `isInternalMenuPath`, `isExternalHttpUrl`, `isBoardScreenPath`, `navigateToMenuNode`.
- Produces: `<MenuNavigationLink :node="node">` with inherited classes and slot content.
- Consumers: header/sidebar in this task and admin pages in Tasks 5–6.

- [ ] **Step 1: Write failing utility tests**

```ts
it('내부 경로와 안전한 외부 URL을 구분한다', () => {
    expect(isInternalMenuPath('/budget/list')).toBe(true);
    expect(isInternalMenuPath('//evil.example')).toBe(false);
    expect(isExternalHttpUrl('https://docs.example.com/manual')).toBe(true);
    expect(isExternalHttpUrl('javascript:alert(1)')).toBe(false);
});

it('LNK는 새 창으로 열고 현재 라우트를 이동하지 않는다', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const navigate = vi.fn();
    await navigateToMenuNode(
        { mnuTpC: 'LNK', srePth: 'https://docs.example.com/manual' } as MenuNode,
        navigate,
    );

    expect(open).toHaveBeenCalledWith(
        'https://docs.example.com/manual',
        '_blank',
        'noopener,noreferrer',
    );
    expect(navigate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run utility tests and verify failure**

Run: `npm test -- tests/unit/utils/menuPath.test.ts`

Expected: FAIL because `~/utils/menuPath` does not exist.

- [ ] **Step 3: Implement the frontend policy**

```ts
export const isInternalMenuPath = (value: string | null | undefined): boolean =>
    !!value && value.startsWith('/') && !value.startsWith('//') && !/\s/.test(value);

export const isExternalHttpUrl = (value: string | null | undefined): boolean => {
    if (!value || /\s/.test(value)) return false;
    try {
        const url = new URL(value);
        return (
            (url.protocol === 'http:' || url.protocol === 'https:') &&
            !!url.hostname &&
            !url.username &&
            !url.password
        );
    } catch {
        return false;
    }
};

export const isBoardScreenPath = (value: string | null | undefined): boolean =>
    boardNoOfMenuPath(value) !== null;

export const navigateToMenuNode = async (
    node: Pick<MenuNode, 'mnuTpC' | 'srePth'>,
    navigate: (path: string) => unknown | Promise<unknown> = navigateTo,
): Promise<void> => {
    if (!node.srePth) return;
    if (node.mnuTpC === 'LNK') {
        window.open(node.srePth, '_blank', 'noopener,noreferrer');
        return;
    }
    await navigate(node.srePth);
};
```

- [ ] **Step 4: Write and implement the semantic link component**

Test assertions:

```ts
expect(wrapper.get('a').attributes()).toMatchObject({
    href: 'https://docs.example.com/manual',
    target: '_blank',
    rel: 'noopener noreferrer',
});
expect(internal.getComponent({ name: 'NuxtLink' }).props('to')).toBe('/budget/list');
```

Component branches:

```vue
<template>
    <a
        v-if="node.mnuTpC === 'LNK'"
        :href="node.srePth ?? undefined"
        target="_blank"
        rel="noopener noreferrer"
    >
        <slot />
    </a>
    <NuxtLink v-else :to="node.srePth ?? undefined"><slot /></NuxtLink>
</template>
```

- [ ] **Step 5: Replace all sidebar links and imperative group navigation**

Replace the top-level branch with `MenuNavigationLink :node="item"`, the nested branch with `MenuNavigationLink :node="nested"`, and the direct child branch with `MenuNavigationLink :node="sub"`. Change `getFirstNavigationTarget` to return `MenuNode | undefined`, then call `navigateToMenuNode(target)` in collapsed mode.

In `AppHeader.vue`, make `firstTarget` return the first target node rather than its string path, and call `navigateToMenuNode(target)`. Add a test asserting an LNK first child calls `window.open` and not `navigateTo`.

- [ ] **Step 6: Run focused component tests**

Run: `npm test -- tests/unit/utils/menuPath.test.ts tests/unit/components/MenuNavigationLink.test.ts tests/unit/components/AppHeader.test.ts tests/unit/components/AppSidebarExternalLink.test.ts tests/unit/architecture/component-boundaries.test.ts`

Expected: PASS; LNK anchors at every sidebar depth have the safe new-window attributes.

- [ ] **Step 7: Commit shared navigation**

```powershell
git add app/utils/menuPath.ts app/components/layout/MenuNavigationLink.vue app/components/layout/AppSidebar.vue app/components/layout/AppHeader.vue tests/unit/utils/menuPath.test.ts tests/unit/components/MenuNavigationLink.test.ts tests/unit/components/AppHeader.test.ts tests/unit/components/AppSidebarExternalLink.test.ts tests/unit/architecture/component-boundaries.test.ts
git commit -m "feat: 링크메뉴를 안전한 새 창으로 연결"
```

---

### Task 5: Add tree controls, A-style presentation, and PGE/LNK path options

**Files:**
- Create: `it_frontend/app/composables/admin/useMenuTreeExpansion.ts`
- Create: `it_frontend/tests/unit/composables/admin/useMenuTreeExpansion.test.ts`
- Modify: `it_frontend/app/utils/menuPresentation.ts`
- Modify: `it_frontend/tests/unit/utils/menuPresentation.test.ts`
- Modify: `it_frontend/app/pages/admin/menus/index.vue`
- Rename: `it_frontend/tests/unit/pages/admin-menus-board-type.test.ts` → `admin-menus-path-options.test.ts`
- Modify: `it_frontend/tests/support/adminMenusPage.ts`

**Interfaces:**
- Consumes: `isInternalMenuPath`, `isExternalHttpUrl`, `isBoardScreenPath` from Task 4.
- Produces: `expandedKeys`, `expandAll`, `collapseToSecondLevel`, `collapseAll`.
- Produces: `menuTypePresentation(type)` returning `{ label, icon, rowClass, badgeClass }`.

- [ ] **Step 1: Write failing expansion tests**

```ts
const node = (mnuId: string, children: MenuNode[] = []): MenuNode => ({
    mnuId,
    hrkMnuId: null,
    mnuNm: mnuId,
    mnuTpC: children.length ? 'GRP' : 'PGE',
    srePth: children.length ? null : `/${mnuId.toLowerCase()}`,
    mnuSotSqnSno: 10,
    hidYn: 'N',
    mnuDep: 1,
    whlMnuPth: `/${mnuId}`,
    children,
});

const tree = ref<MenuNode[]>([
    node('ROOT', [node('L2', [node('L3', [node('L4')])])]),
    node('EMPTY'),
]);
const state = useMenuTreeExpansion(tree);

state.expandAll();
expect(state.expandedKeys.value).toEqual({ ROOT: true, L2: true, L3: true });

state.collapseToSecondLevel();
expect(state.expandedKeys.value).toEqual({ ROOT: true });

state.collapseAll();
expect(state.expandedKeys.value).toEqual({});
```

- [ ] **Step 2: Run the expansion test and verify failure**

Run: `npm test -- tests/unit/composables/admin/useMenuTreeExpansion.test.ts`

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Implement depth-bounded expansion**

```ts
const collect = (
    nodes: MenuNode[],
    result: Record<string, boolean>,
    depth: number,
    visibleLevels: number,
) => {
    for (const node of nodes) {
        const children = node.children ?? [];
        if (!children.length || depth >= visibleLevels - 1) continue;
        result[node.mnuId] = true;
        collect(children, result, depth + 1, visibleLevels);
    }
};

const setVisibleLevels = (visibleLevels: number) => {
    const next: Record<string, boolean> = {};
    collect(toValue(tree), next, 0, visibleLevels);
    expandedKeys.value = next;
};
```

Use `Number.POSITIVE_INFINITY`, `2`, and `{}` for the three public actions. Watch the source tree and remove keys that no longer exist.

- [ ] **Step 4: Add failing A-style presentation tests**

```ts
expect(menuTypePresentation('GRP')).toMatchObject({ label: '그룹', icon: 'pi pi-folder' });
expect(menuTypePresentation('LNK')).toMatchObject({ label: '링크', icon: 'pi pi-external-link' });
expect(menuTypePresentation('PGE')).toMatchObject({ label: '화면', icon: 'pi pi-file' });
expect(menuTypePresentation('BRD' as MenuTypeCode)).toBeUndefined();
```

Add a typed constant in `menuPresentation.ts` with explicit Tailwind class strings for blue GRP, purple LNK, and green PGE backgrounds/text. Do not replace `imkNm`; render the type icon separately.

- [ ] **Step 5: Replace BRD page tests with unified path-option tests**

Required cases in `admin-menus-path-options.test.ts`:

```ts
const route = (srePth: string, sreMnuNm: string): RouteCatalogItem => ({
    srePth,
    sreMnuNm,
    useYn: 'Y',
    rmk: null,
});

const board = (blbMngNo: string, blbNm: string, useYn: string): BoardMeta =>
    ({ blbMngNo, blbNm, useYn }) as BoardMeta;

it('PGE는 내부 경로와 활성 게시판 경로만 제공한다', async () => {
    const page = await mountMenusPage({
        routes: [
            route('/budget/list', '예산목록'),
            route('https://docs.example.com', '업무매뉴얼'),
        ],
        boards: [board('BLBM-0001', '공지사항', 'Y')],
    });
    expect(vmOf(page).pagePathOptions.map((option) => option.value)).toEqual([
        '/budget/list',
        '/board/BLBM-0001',
    ]);
});

it('LNK는 외부 URL만 제공한다', async () => {
    const page = await mountMenusPage({
        routes: [
            route('/budget/list', '예산목록'),
            route('https://docs.example.com', '업무매뉴얼'),
        ],
    });
    expect(vmOf(page).externalLinkOptions.map((option) => option.value)).toEqual([
        'https://docs.example.com',
    ]);
});
```

Extend the shared mount options with `routes?: unknown[]` and the Tree stub props with `expandedKeys`.

- [ ] **Step 6: Integrate controls, type styles, and path selects**

In `admin/menus/index.vue`:

```vue
<div class="flex flex-wrap gap-1 mb-2">
    <Button label="모두 펼치기" icon="pi pi-angle-double-down" size="small" @click="expandAll" />
    <Button label="부분 접기" icon="pi pi-angle-down" size="small" @click="collapseToSecondLevel" />
    <Button label="모두 접기" icon="pi pi-angle-double-up" size="small" @click="collapseAll" />
</div>
<Tree v-model:expanded-keys="expandedKeys" />
```

Render the type wrapper using `menuTypePresentation(node.data.mnuTpC)` and show its icon and label alongside the existing menu label, crown, and broken-board warning.

Replace the BRD-only Select with:

- `PGE`: `pagePathOptions` made from usable internal routes plus active boards.
- `LNK`: `externalLinkOptions` made from usable external URL routes.
- `GRP`: no path Select.

Set `saveDisabled` when PGE/LNK has no selected path. Rename broken-board state to `brokenBoardScreenIds` and identify candidates from PGE `/board/{게시판관리번호}` paths.

When an option list is empty, render these exact messages below the matching Select:

- PGE: `사용 가능한 내부 화면 또는 게시판 경로가 없습니다. 경로·게시판 설정을 확인해 주세요.`
- LNK: `사용 가능한 외부 URL이 없습니다. 경로 관리에서 외부 URL을 등록해 주세요.`

- [ ] **Step 7: Run all admin-menu unit tests**

Run: `npm test -- tests/unit/pages/admin-menus-path-options.test.ts tests/unit/pages/admin-menus-type-code.test.ts tests/unit/pages/admin-menus-dragdrop.test.ts tests/unit/pages/admin-menus-refresh-failure.test.ts tests/unit/composables/admin/useMenuTreeExpansion.test.ts tests/unit/utils/menuPresentation.test.ts`

Expected: PASS; no frontend test or page branch refers to `mnuTpC === 'BRD'`.

- [ ] **Step 8: Commit the menu-management UI**

```powershell
git add app/composables/admin/useMenuTreeExpansion.ts app/utils/menuPresentation.ts app/pages/admin/menus/index.vue tests/unit/composables/admin/useMenuTreeExpansion.test.ts tests/unit/utils/menuPresentation.test.ts tests/unit/pages/admin-menus-path-options.test.ts tests/support/adminMenusPage.ts
git add -u tests/unit/pages/admin-menus-board-type.test.ts
git commit -m "feat: 메뉴 트리와 경로 선택 통합"
```

---

### Task 6: Turn the route catalog screen into path management

**Files:**
- Modify: `it_frontend/app/pages/admin/routes/index.vue`
- Create: `it_frontend/tests/unit/pages/admin-routes-path-contract.test.ts`

**Interfaces:**
- Consumes: `isInternalMenuPath`, `isExternalHttpUrl` from Task 4.
- Produces: visible `내부화면`/`외부링크` tags and immutable existing `srePth` keys.

- [ ] **Step 1: Write the failing page behavior tests**

Mount the route-management page with internal and external fixtures. Verify the rendered
heading and path-kind tags, then enter edit mode and assert that an existing `srePth` is
plain text while a newly added row exposes the path `InputText`. Tests must exercise the
mounted component rather than inspecting Vue source text.

- [ ] **Step 2: Run the page test and verify failure**

Run: `npm test -- tests/unit/pages/admin-routes-path-contract.test.ts`

Expected: FAIL because the old page says `라우트 카탈로그`, has no path-kind tags, and edits every path key.

- [ ] **Step 3: Implement path-management copy and classification**

Use:

```ts
const pathKind = (path: string) => (isExternalHttpUrl(path) ? 'external' : 'internal');
const pathKindLabel = (path: string) =>
    pathKind(path) === 'external' ? '외부링크' : '내부화면';
```

Change the title to `경로 관리`, columns to `유형`, `경로`, `경로명`, and render the type Tag with `data-path-kind`. Add the exact help text `내부 경로는 /budget/list, 외부 URL은 https://example.com 형식으로 입력하세요.`

Render an `InputText` for `srePth` only when `rowStatus(data) === 'new'`; existing keys remain plain text even in edit mode.

- [ ] **Step 4: Run the route page and utility tests**

Run: `npm test -- tests/unit/pages/admin-routes-path-contract.test.ts tests/unit/utils/menuPath.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit path management UI**

```powershell
git add app/pages/admin/routes/index.vue tests/unit/pages/admin-routes-path-contract.test.ts
git commit -m "feat: 경로 관리에서 외부 URL 등록 지원"
```

---

### Task 7: Regenerate contracts, update project rules, and verify end to end

**Files:**
- Modify: `it_backend/CLAUDE.md`
- Modify: `it_frontend/CLAUDE.md`
- Modify generated: `it_frontend/app/types/api.d.ts`
- Modify: `versions.lock`

**Interfaces:**
- Consumes: committed DB, backend, and frontend changes from Tasks 1–6.
- Produces: current OpenAPI types, project SoT documentation, and compatible commit pins.

- [ ] **Step 1: Update the backend and frontend SoT text**

Replace the BRD rules with these facts:

```markdown
- 게시판은 `/board/{게시판관리번호}` 화면경로를 가진 `PGE` 메뉴로 관리합니다. 저장과 사용자 메뉴 노출은 활성 게시판 목록으로 검증하며, 관리 트리에는 비활성 참조도 남깁니다.
- `LNK` 메뉴는 경로 카탈로그에 등록된 안전한 `http(s)` 외부 URL만 참조하며 사용자 메뉴에서 새 창으로 엽니다.
```

Keep backend implementation class names only in backend `CLAUDE.md`; frontend `CLAUDE.md` must reference `types/menu.ts`/`utils/menuPath.ts` helpers rather than literal `/board/` assembly.

- [ ] **Step 2: Run backend formatting and tests**

Run from `it_backend`:

```powershell
./gradlew spotlessApply
./gradlew test
./gradlew check
```

Expected: all tasks PASS. If the Oracle-backed profile is available, also run `./gradlew integrationTest` and confirm the new migration applies.

- [ ] **Step 3: Regenerate the frontend OpenAPI types**

Start the backend with the project local profile, then run from `it_frontend`:

```powershell
npm run codegen
npm run codegen:check
```

Expected: generated `MenuNode.mnuTpC` no longer advertises `BRD`, and `codegen:check` exits 0. Do not hand-edit `app/types/api.d.ts`.

- [ ] **Step 4: Run frontend formatting and Health Stack**

```powershell
npm run format
npm run format:check
npm run check
npm run lint:css
npm test
```

Expected: all commands exit 0 and the max-lines/component-boundary ratchets pass.

- [ ] **Step 5: Perform browser QA with both servers running**

Verify these exact scenarios at `http://localhost:3000`:

1. `/admin/routes`: create `https://example.com`, observe `외부링크`, and save.
2. `/admin/menus`: choose LNK and confirm only external URLs appear.
3. `/admin/menus`: choose PGE and confirm internal routes plus active boards appear.
4. Click `모두 펼치기`, `부분 접기`, `모두 접기`; confirm partial view shows only levels 1–2.
5. Confirm GRP/LNK/PGE use blue/purple/green A-style rows with icon and type label.
6. From every sidebar depth, click an LNK and confirm a new tab opens while the portal route stays unchanged.
7. Confirm a disabled board PGE is absent from the user menu but remains visible with a warning in the admin tree.

Delete the temporary `https://example.com` path after QA if it is not intended as seeded project data.

- [ ] **Step 6: Commit documentation and generated contract changes**

Backend repository:

```powershell
git add CLAUDE.md
git commit -m "docs: 메뉴 경로 계약 현행화"
```

Frontend repository:

```powershell
git add CLAUDE.md app/types/api.d.ts
git commit -m "chore: 메뉴 API 계약과 경로 규칙 갱신"
```

- [ ] **Step 7: Update and commit compatible repository pins**

Run from `C:\it`:

```powershell
./scripts/update-versions-lock.ps1
git add versions.lock
git commit -m "chore: 메뉴 경로 통합 커밋 조합 갱신"
```

- [ ] **Step 8: Final clean-state audit**

Run:

```powershell
git status --short
git -C it_database status --short
git -C it_backend status --short
git -C it_frontend status --short
rg -n "mnuTpC\s*===\s*['\"]BRD|BoardMenuLink|allowableValues.*BRD" it_backend it_frontend
```

Expected: only pre-existing user changes remain; the final `rg` finds no production or current-contract references to BRD-specific behavior.
