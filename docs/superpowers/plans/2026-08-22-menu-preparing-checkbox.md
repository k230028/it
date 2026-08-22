# 메뉴 관리 준비중 체크박스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/menus`에서 '준비중'을 체크하면 서버가 `/preparing/{mnuId 소문자}` 경로를 만들어 라우트 카탈로그에 등록하고 메뉴에 연결한다. 체크를 해제하면 그 자동 경로를 회수한다.

**Architecture:** 카탈로그 등록과 메뉴 저장을 `AdminMenuService`의 한 트랜잭션에서 처리한다. 경로 이름은 서버가 채번한 `mnuId`에서 나오므로 충돌 탐색이 없다. 준비중 여부는 DB에 저장하지 않고 `srePth`의 `/preparing/` 접두로 판정한다.

**Tech Stack:** Spring Boot(JPA·JUnit5·Mockito·AssertJ), Nuxt 4 + Vue 3 Composition API + PrimeVue, Vitest

**설계 문서:** `docs/superpowers/specs/2026-08-22-menu-preparing-checkbox-design.md`

## Global Constraints

- 신규 JavaDoc·TSDoc·주석은 한글로 쓴다. 공개 API·서비스 메서드는 입력과 실패 조건을 기록한다.
- 사용자 노출 문구는 `i18n/messages/admin.ts`에 두고 한국어·영어 트리를 함께 채운다. 화면에 한국어 리터럴을 넣지 않는다(`npm run check:copy` 기준선을 늘리지 않는다).
- `git add -A`·`git commit -a`를 쓰지 않는다. 워킹트리를 다른 작업과 공유하므로 커밋 전 `git diff --cached --stat`으로 자기 경로만 담겼는지 확인한다. 세 하위 저장소는 각각 독립 git 저장소이므로 커밋은 해당 저장소 안에서 한다.
- 자동 생성 경로: `"/preparing/" + mnuId.toLowerCase()` (예: `MNU0001018` → `/preparing/mnu0001018`).
- 카탈로그 경로명: `"{메뉴명} (준비중)"`, `SRE_MNU_NM`은 100자 컬럼이므로 초과분은 잘라 넣는다.
- 자동 회수 대상은 **정확히** `"/preparing/" + 그 메뉴의 mnuId.toLowerCase()`인 경로뿐이다. `/preparing/cdp` 같은 수동 등록 경로는 건드리지 않는다.
- `Cmenud`는 setter가 없다. 갱신은 같은 PK로 새 엔티티를 만들어 `save()`(JPA merge)한다.

## File Structure

**백엔드 (`it_backend`)**
- `src/main/java/com/kdb/it/domain/menu/service/MenuPathPolicy.java` — 준비중 경로 접두 상수와 판정 추가
- `src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java` — `UpsertRequest.preparingYn` 추가
- `src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java` — 준비중 경로 해석·카탈로그 등록·자동 회수
- `src/test/java/com/kdb/it/domain/menu/service/MenuPathPolicyTest.java` — 판정 테스트
- `src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java` — 생성·수정·회수 테스트

**프론트엔드 (`it_frontend`)**
- `app/utils/menuPath.ts` — `PREPARING_PATH_PREFIX`, `isPreparingPath()`
- `app/composables/useAdminMenu.ts` — `MenuUpsertRequest.preparingYn`
- `app/pages/admin/menus/index.vue` — 체크박스·폼 상태·저장 후 카탈로그 재조회
- `i18n/messages/admin.ts` — `admin.menus` 문구 5건(ko/en)
- `tests/unit/utils/menuPath.test.ts` — 판정 테스트
- `tests/unit/pages/admin-menus-preparing.test.ts` — 화면 동작 테스트

---

### Task 1: 준비중 경로 규약 (백엔드)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuPathPolicy.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuPathPolicyTest.java`

**Interfaces:**
- Consumes: 없음
- Produces: `MenuPathPolicy.PREPARING_PATH_PREFIX` (`String`, 값 `"/preparing/"`), `MenuPathPolicy.isPreparing(String value)` → `boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`MenuPathPolicyTest.java` 끝, 마지막 `}` 앞에 추가한다.

```java
    @Test
    @DisplayName("isPreparing: /preparing/ 접두를 가진 경로만 준비중으로 본다")
    void isPreparing_접두일치만참() {
        assertThat(MenuPathPolicy.isPreparing("/preparing/mnu0001018")).isTrue();
        assertThat(MenuPathPolicy.isPreparing("/preparing/cdp")).isTrue();
        // slug 없는 `/preparing`은 메뉴가 가리키는 경로가 아니다
        assertThat(MenuPathPolicy.isPreparing("/preparing")).isFalse();
        assertThat(MenuPathPolicy.isPreparing("/budget/list")).isFalse();
        assertThat(MenuPathPolicy.isPreparing(null)).isFalse();
    }
```

파일 상단에 `import org.junit.jupiter.api.DisplayName;`와 `static org.assertj.core.api.Assertions.assertThat;`이 없으면 추가한다.

- [ ] **Step 2: 실패를 확인한다**

```bash
cd C:\it\it_backend && ./gradlew test --tests '*MenuPathPolicyTest*' --no-daemon
```

Expected: 컴파일 실패 — `cannot find symbol: method isPreparing(String)`

- [ ] **Step 3: 최소 구현을 넣는다**

`MenuPathPolicy.java`의 `private MenuPathPolicy() {}` 아래에 추가한다.

```java
    /** 공용 준비중 화면 경로 접두. `/preparing/{slug}`는 `preparing/[[slug]].vue` 하나가 처리한다. */
    public static final String PREPARING_PATH_PREFIX = "/preparing/";

    /**
     * 준비중 화면 경로인지 판정한다.
     *
     * @param value 판정할 경로
     * @return `/preparing/`로 시작하면 {@code true}. null과 slug 없는 `/preparing`은 {@code false}
     */
    public static boolean isPreparing(String value) {
        return value != null && value.startsWith(PREPARING_PATH_PREFIX);
    }
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd C:\it\it_backend && ./gradlew test --tests '*MenuPathPolicyTest*' --no-daemon
```

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
cd C:\it\it_backend && git add src/main/java/com/kdb/it/domain/menu/service/MenuPathPolicy.java src/test/java/com/kdb/it/domain/menu/service/MenuPathPolicyTest.java && git diff --cached --stat && git commit -m "feat: 준비중 화면 경로 판정 추가"
```

---

### Task 2: 준비중 메뉴 생성 (백엔드)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java` (`UpsertRequest`)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java` (`create`, 내부 헬퍼)
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java`

**Interfaces:**
- Consumes: `MenuPathPolicy.PREPARING_PATH_PREFIX`, `MenuPathPolicy.isPreparing(String)`
- Produces:
  - `MenuDto.UpsertRequest.getPreparingYn()` → `String` (`"Y"`/`"N"`/null)
  - `AdminMenuService`의 private 헬퍼 `isPreparingRequest(MenuDto.UpsertRequest)` → `boolean`,
    `resolvePreparingPath(String mnuId, String currentPath, String mnuNm, String mnuTpC)` → `String`,
    `preparingCatalogName(String mnuNm)` → `String`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`AdminMenuServiceTest.java` 끝, 마지막 `}` 앞에 추가한다.

```java
    @Test
    @DisplayName("create: 준비중이면 메뉴 ID 기반 경로를 만들고 카탈로그에 등록한다")
    void create_준비중_경로자동생성및카탈로그등록() {
        // given
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("사업계획서 작성")
                        .mnuTpC("PGE")
                        .hrkMnuId("P1")
                        .srePth(null)
                        .preparingYn("Y")
                        .hidYn("N")
                        .athIds(List.of())
                        .build();
        given(cmenumRepository.findByMnuIdAndDelYn("P1", "N"))
                .willReturn(Optional.of(node("P1", "MHED0002", 2, "/MHED0002/P1")));
        given(cmenumRepository.nextMnuId()).willReturn("MNU0001018");
        given(cmenudRepository.findBySrePthAndDelYn("/preparing/mnu0001018", "N"))
                .willReturn(Optional.empty())
                .willReturn(Optional.of(route("/preparing/mnu0001018", "Y")));
        given(cmenuaRepository.findByMnuId("MNU0001018")).willReturn(List.of());

        // when
        String result = service.create(req);

        // then
        assertThat(result).isEqualTo("MNU0001018");
        ArgumentCaptor<Cmenud> catalog = ArgumentCaptor.forClass(Cmenud.class);
        verify(cmenudRepository).save(catalog.capture());
        assertThat(catalog.getValue().getSrePth()).isEqualTo("/preparing/mnu0001018");
        assertThat(catalog.getValue().getSreMnuNm()).isEqualTo("사업계획서 작성 (준비중)");
        assertThat(catalog.getValue().getUseYn()).isEqualTo("Y");
        ArgumentCaptor<Cmenum> menu = ArgumentCaptor.forClass(Cmenum.class);
        verify(cmenumRepository).save(menu.capture());
        assertThat(menu.getValue().getSrePth()).isEqualTo("/preparing/mnu0001018");
    }

    @Test
    @DisplayName("create: 준비중은 페이지화면만 가능하다")
    void create_준비중인데GRP_400() {
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("새 그룹")
                        .mnuTpC("GRP")
                        .hrkMnuId("P1")
                        .srePth(null)
                        .preparingYn("Y")
                        .hidYn("N")
                        .athIds(List.of())
                        .build();
        given(cmenumRepository.nextMnuId()).willReturn("MNU0001019");

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("준비중은 페이지화면만 가능합니다");
        verifyNoInteractions(cmenudRepository);
    }

    @Test
    @DisplayName("create: 메뉴명이 길어도 카탈로그 경로명은 100자를 넘지 않는다")
    void create_준비중_긴메뉴명_경로명절단() {
        String longName = "가".repeat(100);
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm(longName)
                        .mnuTpC("PGE")
                        .hrkMnuId("P1")
                        .srePth(null)
                        .preparingYn("Y")
                        .hidYn("N")
                        .athIds(List.of())
                        .build();
        given(cmenumRepository.findByMnuIdAndDelYn("P1", "N"))
                .willReturn(Optional.of(node("P1", "MHED0002", 2, "/MHED0002/P1")));
        given(cmenumRepository.nextMnuId()).willReturn("MNU0001020");
        given(cmenudRepository.findBySrePthAndDelYn("/preparing/mnu0001020", "N"))
                .willReturn(Optional.empty())
                .willReturn(Optional.of(route("/preparing/mnu0001020", "Y")));
        given(cmenuaRepository.findByMnuId("MNU0001020")).willReturn(List.of());

        service.create(req);

        ArgumentCaptor<Cmenud> catalog = ArgumentCaptor.forClass(Cmenud.class);
        verify(cmenudRepository).save(catalog.capture());
        assertThat(catalog.getValue().getSreMnuNm()).hasSize(100);
        assertThat(catalog.getValue().getSreMnuNm()).endsWith(" (준비중)");
    }
```

`node(...)`와 `route(...)`는 이 테스트 클래스에 이미 있는 헬퍼다. `route(path, useYn)`가 돌려주는 `sreMnuNm`은 "테스트 경로"이며 이 테스트들은 그 값을 단언하지 않는다.

- [ ] **Step 2: 실패를 확인한다**

```bash
cd C:\it\it_backend && ./gradlew test --tests '*AdminMenuServiceTest*' --no-daemon
```

Expected: 컴파일 실패 — `cannot find symbol: method preparingYn(String)`

- [ ] **Step 3: DTO에 필드를 추가한다**

`MenuDto.java`의 `UpsertRequest`에서 `athIds` 선언 위에 넣는다.

```java
        @Schema(
                description =
                        "준비중 여부 Y/N. Y면 서버가 준비중 경로를 만들어 카탈로그에 등록하며 srePth는 무시한다",
                allowableValues = {"Y", "N"})
        private String preparingYn;
```

- [ ] **Step 4: 서비스에 준비중 경로 해석을 넣는다**

`AdminMenuService.java`의 `SORT_STEP` 상수 아래에 상수를 추가한다.

```java
    /** 카탈로그 화면메뉴명(SRE_MNU_NM) 컬럼 길이. 초과분은 잘라 넣는다. */
    private static final int CATALOG_NAME_MAX = 100;

    /** 자동 등록 카탈로그 경로명 접미. */
    private static final String PREPARING_NAME_SUFFIX = " (준비중)";

    /** 자동 등록 카탈로그 비고. 사람이 만든 준비중 경로와 구분하는 표시다. */
    private static final String PREPARING_ROUTE_RMK = "준비중 메뉴 자동 등록";
```

`// ---- 내부 헬퍼 ----` 아래, `load()` 다음에 헬퍼 세 개를 추가한다.

```java
    /** 준비중 요청인지 판정한다. null은 N으로 본다. */
    private boolean isPreparingRequest(MenuDto.UpsertRequest req) {
        return "Y".equals(req.getPreparingYn());
    }

    /** 카탈로그 화면메뉴명을 만든다. 컬럼 길이(100자)를 넘지 않도록 메뉴명을 자른다. */
    private String preparingCatalogName(String mnuNm) {
        int room = CATALOG_NAME_MAX - PREPARING_NAME_SUFFIX.length();
        String base = mnuNm.length() > room ? mnuNm.substring(0, room) : mnuNm;
        return base + PREPARING_NAME_SUFFIX;
    }

    /**
     * 준비중 경로를 확정하고 라우트 카탈로그 행을 준비한다.
     *
     * <p>저장된 메뉴가 이미 준비중 경로를 쓰고 있으면 그 경로를 유지한다. 사람이 등록한
     * {@code /preparing/cdp} 같은 경로를 자동 경로로 갈아치우지 않기 위해서다. 그 외에는
     * {@code /preparing/{mnuId 소문자}}를 쓴다. 카탈로그 행이 없으면 만들고, 있으면 재사용하며
     * 화면메뉴명만 현재 메뉴명 기준으로 맞춘다(같은 메뉴를 다시 저장해도 행이 늘지 않는다).
     *
     * @param mnuId 대상 메뉴 ID. 생성이면 채번 직후 값
     * @param currentPath 저장된 메뉴의 현재 화면경로. 생성이면 null
     * @param mnuNm 카탈로그 화면메뉴명에 쓸 메뉴명
     * @param mnuTpC 메뉴유형코드
     * @return 확정된 준비중 경로
     * @throws ResponseStatusException 메뉴유형이 PGE가 아닌 경우
     */
    private String resolvePreparingPath(
            String mnuId, String currentPath, String mnuNm, String mnuTpC) {
        if (!"PGE".equals(mnuTpC)) throw badRequest("준비중은 페이지화면만 가능합니다.");
        String path =
                MenuPathPolicy.isPreparing(currentPath)
                        ? currentPath
                        : MenuPathPolicy.PREPARING_PATH_PREFIX + mnuId.toLowerCase();
        String catalogName = preparingCatalogName(mnuNm);
        String rmk =
                cmenudRepository
                        .findBySrePthAndDelYn(path, "N")
                        .map(Cmenud::getRmk)
                        .orElse(PREPARING_ROUTE_RMK);
        // Cmenud는 setter가 없으므로 같은 PK로 새 엔티티를 저장해 JPA merge로 갱신한다.
        cmenudRepository.save(
                Cmenud.builder()
                        .srePth(path)
                        .sreMnuNm(catalogName)
                        .useYn("Y")
                        .rmk(rmk)
                        .delYn("N")
                        .build());
        return path;
    }
```

- [ ] **Step 5: `create`를 준비중 경로에 맞춘다**

`create` 메서드의 앞부분을 아래로 교체한다. 나머지(depth·whlPth 계산, `Cmenum.builder()`, `replaceRoles`)는 그대로 두되 `.srePth(req.getSrePth())`만 `.srePth(srePth)`로 바꾼다.

```java
    public String create(MenuDto.UpsertRequest req) {
        /* 준비중이 아니면 종전 순서 그대로 경로부터 검증한다. 준비중 경로는 채번한 mnuId에서
           나오므로 nextMnuId() 뒤에 확정하고, 그 확정 경로로 같은 검증을 통과시킨다. */
        boolean preparing = isPreparingRequest(req);
        String srePth = req.getSrePth();
        if (!preparing) validateTypePath(req.getMnuTpC(), srePth);
        validateHierarchy(req.getMnuTpC(), req.getHrkMnuId());
        String mnuId = cmenumRepository.nextMnuId();
        if (preparing) {
            srePth = resolvePreparingPath(mnuId, null, req.getMnuNm(), req.getMnuTpC());
            validateTypePath(req.getMnuTpC(), srePth);
        }
```

- [ ] **Step 6: 통과를 확인한다**

```bash
cd C:\it\it_backend && ./gradlew test --tests '*AdminMenuServiceTest*' --tests '*AdminMenuControllerTest*' --tests '*MenuOpenApiContractTest*' --no-daemon
```

Expected: PASS. 기존 `create_*` 테스트도 함께 통과해야 한다 — 준비중이 아닌 요청의 검증 순서는 바뀌지 않았다.

- [ ] **Step 7: 커밋한다**

```bash
cd C:\it\it_backend && git add src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java && git diff --cached --stat && git commit -m "feat: 준비중 메뉴 생성 시 화면경로 자동 등록"
```

---

### Task 3: 준비중 유지와 자동 회수 (백엔드)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java` (`update`, 회수 헬퍼)
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java`

**Interfaces:**
- Consumes: Task 2의 `isPreparingRequest`, `resolvePreparingPath`
- Produces: private 헬퍼 `releaseGeneratedPreparingPath(String mnuId, String previousPath)` → `void`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`AdminMenuServiceTest.java` 끝, 마지막 `}` 앞에 추가한다.

```java
    @Test
    @DisplayName("update: 준비중을 해제하면 그 메뉴의 자동 경로만 카탈로그에서 회수한다")
    void update_준비중해제_자동경로회수() {
        // given
        Cmenum menu = node("MNU0001018", "P1", 3, "/MHED0002/P1/MNU0001018");
        menu.setMnuTpC("PGE");
        menu.setSrePth("/preparing/mnu0001018");
        Cmenud generated = route("/preparing/mnu0001018", "Y");
        given(cmenumRepository.findByMnuIdAndDelYn("MNU0001018", "N"))
                .willReturn(Optional.of(menu));
        given(cmenudRepository.findBySrePthAndDelYn("/budget/list", "N"))
                .willReturn(Optional.of(route("/budget/list", "Y")));
        given(cmenudRepository.findBySrePthAndDelYn("/preparing/mnu0001018", "N"))
                .willReturn(Optional.of(generated));
        given(cmenuaRepository.findByMnuId("MNU0001018")).willReturn(List.of());
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("예산 목록")
                        .mnuTpC("PGE")
                        .srePth("/budget/list")
                        .preparingYn("N")
                        .hidYn("N")
                        .athIds(List.of())
                        .build();

        // when
        service.update("MNU0001018", req);

        // then
        assertThat(menu.getSrePth()).isEqualTo("/budget/list");
        assertThat(generated.getDelYn()).isEqualTo("Y");
    }

    @Test
    @DisplayName("update: 수동 등록 준비중 경로는 해제해도 카탈로그에 남긴다")
    void update_준비중해제_수동경로보존() {
        Cmenum menu = node("MNU0001021", "P1", 3, "/MHED0002/P1/MNU0001021");
        menu.setMnuTpC("PGE");
        menu.setSrePth("/preparing/cdp");
        given(cmenumRepository.findByMnuIdAndDelYn("MNU0001021", "N"))
                .willReturn(Optional.of(menu));
        given(cmenudRepository.findBySrePthAndDelYn("/budget/list", "N"))
                .willReturn(Optional.of(route("/budget/list", "Y")));
        given(cmenuaRepository.findByMnuId("MNU0001021")).willReturn(List.of());
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("예산 목록")
                        .mnuTpC("PGE")
                        .srePth("/budget/list")
                        .preparingYn("N")
                        .hidYn("N")
                        .athIds(List.of())
                        .build();

        service.update("MNU0001021", req);

        assertThat(menu.getSrePth()).isEqualTo("/budget/list");
        // 수동 경로는 조회조차 하지 않는다 — 자동 경로 이름과 다르기 때문이다
        verify(cmenudRepository, never()).findBySrePthAndDelYn("/preparing/cdp", "N");
    }

    @Test
    @DisplayName("update: 이미 준비중 경로를 쓰는 메뉴는 저장해도 같은 경로를 유지한다")
    void update_준비중유지_기존경로보존() {
        Cmenum menu = node("MNU0001022", "P1", 3, "/MHED0002/P1/MNU0001022");
        menu.setMnuTpC("PGE");
        menu.setSrePth("/preparing/cdp");
        given(cmenumRepository.findByMnuIdAndDelYn("MNU0001022", "N"))
                .willReturn(Optional.of(menu));
        given(cmenudRepository.findBySrePthAndDelYn("/preparing/cdp", "N"))
                .willReturn(Optional.of(route("/preparing/cdp", "Y")));
        given(cmenuaRepository.findByMnuId("MNU0001022")).willReturn(List.of());
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("IT/AI CDP")
                        .mnuTpC("PGE")
                        .srePth(null)
                        .preparingYn("Y")
                        .hidYn("N")
                        .athIds(List.of())
                        .build();

        service.update("MNU0001022", req);

        assertThat(menu.getSrePth()).isEqualTo("/preparing/cdp");
        ArgumentCaptor<Cmenud> catalog = ArgumentCaptor.forClass(Cmenud.class);
        verify(cmenudRepository).save(catalog.capture());
        assertThat(catalog.getValue().getSrePth()).isEqualTo("/preparing/cdp");
        assertThat(catalog.getValue().getSreMnuNm()).isEqualTo("IT/AI CDP (준비중)");
    }
```

파일 상단 static import에 `org.mockito.Mockito.never`가 없으면 추가한다.

- [ ] **Step 2: 실패를 확인한다**

```bash
cd C:\it\it_backend && ./gradlew test --tests '*AdminMenuServiceTest*' --no-daemon
```

Expected: FAIL — `update_준비중해제_자동경로회수`에서 `generated.getDelYn()`이 `"N"`이고, `update_준비중유지_기존경로보존`에서 `menu.getSrePth()`가 null이다.

- [ ] **Step 3: 회수 헬퍼를 넣는다**

`AdminMenuService.java`의 `resolvePreparingPath` 아래에 추가한다.

```java
    /**
     * 이 메뉴가 쓰던 자동 생성 준비중 경로를 카탈로그에서 논리삭제한다.
     *
     * <p>회수 대상은 {@code /preparing/{이 메뉴의 mnuId 소문자}}와 정확히 같은 경로뿐이다.
     * 사람이 등록한 준비중 경로는 다른 메뉴가 쓸 수 있으므로 건드리지 않는다. 호출 시점에는
     * 메뉴가 이미 새 경로를 가리키므로 참조 중 삭제가 아니다.
     *
     * @param mnuId 대상 메뉴 ID
     * @param previousPath 저장 직전 화면경로. null이면 아무것도 하지 않는다
     */
    private void releaseGeneratedPreparingPath(String mnuId, String previousPath) {
        String generated = MenuPathPolicy.PREPARING_PATH_PREFIX + mnuId.toLowerCase();
        if (!generated.equals(previousPath)) return;
        cmenudRepository.findBySrePthAndDelYn(previousPath, "N").ifPresent(Cmenud::delete);
    }
```

- [ ] **Step 4: `update`를 준비중 경로에 맞춘다**

`update` 메서드 전체를 아래로 교체한다.

```java
    @CacheEvict(value = "menuAuthMap", allEntries = true)
    public void update(String mnuId, MenuDto.UpsertRequest req) {
        /* 준비중 경로는 저장된 메뉴의 현재 경로를 봐야 정해지므로 load()가 검증보다 앞선다. */
        Cmenum menu = load(mnuId);
        String previousPath = menu.getSrePth();
        boolean preparing = isPreparingRequest(req);
        String srePth =
                preparing
                        ? resolvePreparingPath(
                                mnuId, previousPath, req.getMnuNm(), req.getMnuTpC())
                        : req.getSrePth();
        validateTypePath(req.getMnuTpC(), srePth);
        // 대상의 현재 계층 위치를 기준으로 다시 검증한다. 이 호출이 없으면 루트 메뉴의 유형만 바꿔 "루트는 GRP" 규칙을 우회할 수 있다.
        validateHierarchy(req.getMnuTpC(), menu.getHrkMnuId());
        menu.setMnuNm(req.getMnuNm());
        menu.setMnuTpC(req.getMnuTpC());
        menu.setSrePth(srePth);
        menu.setHidYn(req.getHidYn() == null ? "N" : req.getHidYn());
        menu.setImkNm(normalizeIcon(req.getImkNm()));
        // JPA dirty checking으로 flush되며, @LogTarget 스냅샷은 @PreUpdate에서 자동 생성된다.
        replaceRoles(mnuId, req.getAthIds());
        if (!preparing) releaseGeneratedPreparingPath(mnuId, previousPath);
    }
```

- [ ] **Step 5: 통과를 확인한다**

```bash
cd C:\it\it_backend && ./gradlew test --tests '*AdminMenu*' --tests '*Menu*' --no-daemon
```

Expected: PASS. `update`에서 `load()`가 검증보다 앞으로 왔으므로, 없는 메뉴에 잘못된 경로를 함께 보내면 400이 아니라 404가 난다. 기존 테스트가 그 조합을 단언하고 있으면 단언을 404로 고치고 이유를 주석으로 남긴다.

- [ ] **Step 6: 커밋한다**

```bash
cd C:\it\it_backend && git add src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java && git diff --cached --stat && git commit -m "feat: 준비중 해제 시 자동 생성 경로 회수"
```

---

### Task 4: 준비중 경로 판정 유틸 (프론트)

**Files:**
- Modify: `it_frontend/app/utils/menuPath.ts`
- Test: `it_frontend/tests/unit/utils/menuPath.test.ts` (없으면 생성)

**Interfaces:**
- Consumes: 없음
- Produces: `PREPARING_PATH_PREFIX` (`string`), `isPreparingPath(value: string | null | undefined)` → `boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/unit/utils/menuPath.test.ts`가 있으면 아래 `describe`를 파일 끝에 추가하고, 없으면 파일을 만든다.

```ts
import { describe, expect, it } from 'vitest';
import { isPreparingPath } from '~/utils/menuPath';

describe('isPreparingPath', () => {
    it('/preparing/ 접두를 가진 경로만 준비중으로 본다', () => {
        expect(isPreparingPath('/preparing/mnu0001018')).toBe(true);
        expect(isPreparingPath('/preparing/cdp')).toBe(true);
        // slug 없는 /preparing은 메뉴가 가리키는 경로가 아니다
        expect(isPreparingPath('/preparing')).toBe(false);
        expect(isPreparingPath('/budget/list')).toBe(false);
        expect(isPreparingPath(null)).toBe(false);
        expect(isPreparingPath(undefined)).toBe(false);
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd C:\it\it_frontend && npx vitest run tests/unit/utils/menuPath.test.ts
```

Expected: FAIL — `isPreparingPath is not a function`

- [ ] **Step 3: 유틸을 구현한다**

`app/utils/menuPath.ts`의 `isInternalMenuPath` 위에 추가한다.

```ts
/** 공용 준비중 화면 경로 접두. 백엔드 `MenuPathPolicy.PREPARING_PATH_PREFIX`와 같은 값이다. */
export const PREPARING_PATH_PREFIX = '/preparing/';

/** 준비중 화면 경로인지 판별합니다. slug 없는 `/preparing`은 메뉴 대상이 아니라 false입니다. */
export const isPreparingPath = (value: string | null | undefined): boolean =>
    !!value && value.startsWith(PREPARING_PATH_PREFIX);
```

- [ ] **Step 4: 통과를 확인한다**

```bash
cd C:\it\it_frontend && npx vitest run tests/unit/utils/menuPath.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋한다**

```bash
cd C:\it\it_frontend && git add app/utils/menuPath.ts tests/unit/utils/menuPath.test.ts && git diff --cached --stat && git commit -m "feat: 준비중 경로 판정 유틸 추가"
```

---

### Task 5: 메뉴 관리 준비중 체크박스 (프론트)

**Files:**
- Modify: `it_frontend/app/composables/useAdminMenu.ts` (`MenuUpsertRequest`)
- Modify: `it_frontend/app/pages/admin/menus/index.vue`
- Modify: `it_frontend/i18n/messages/admin.ts` (`admin.menus`, ko/en)
- Test: `it_frontend/tests/unit/pages/admin-menus-preparing.test.ts` (생성)

**Interfaces:**
- Consumes: `isPreparingPath` (Task 4), 백엔드 `preparingYn` 필드 (Task 2)
- Produces: `MenuUpsertRequest.preparingYn?: string`, 페이지 setupState의 `form.preparingYn`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/unit/pages/admin-menus-preparing.test.ts`를 만든다.

```ts
/**
 * ============================================================================
 * [tests/unit/pages/admin-menus-preparing.test.ts]
 * ============================================================================
 * 준비중 체크박스의 노출·저장 가능 조건·복원과 저장 후 카탈로그 재조회를 검증합니다.
 * ============================================================================
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { MenuNode } from '~/types/menu';
import { createAdminMenusMount, setupAdminMenusGlobals } from '../../support/adminMenusPage';

const toastAdd = vi.fn();
const apiFetchMock = vi.fn();

vi.stubGlobal('useToast', () => ({ add: toastAdd }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
setupAdminMenusGlobals(apiFetchMock);

const { mountMenusPage } = createAdminMenusMount({ apiFetchMock, toastAdd });

type MountedPage = Awaited<ReturnType<typeof mountMenusPage>>;
type PageVm = {
    startNew: () => void;
    onSelect: (node: { data: MenuNode }) => void;
    save: () => Promise<void>;
    saveDisabled: boolean;
    form: {
        mnuNm: string;
        mnuTpC: string;
        srePth: string | null;
        hrkMnuId?: string | null;
        preparingYn: string;
    };
};

const vmOf = (page: MountedPage) =>
    page.wrapper.findComponent({ name: 'index' }).vm as unknown as PageVm;

const menuNode = (srePth: string | null): MenuNode =>
    ({
        mnuId: 'MNU0001018',
        hrkMnuId: 'P1',
        mnuNm: '사업계획서 작성',
        mnuTpC: 'PGE',
        srePth,
        hidYn: 'N',
        imkNm: null,
        children: [],
        athIds: [],
    }) as unknown as MenuNode;

describe('메뉴 관리 준비중 체크박스', () => {
    it('PGE일 때만 준비중 체크박스를 보여준다', async () => {
        const page = await mountMenusPage();
        const vm = vmOf(page);

        vm.startNew();
        await flushPromises();
        vm.form.hrkMnuId = 'ROOT';
        vm.form.mnuTpC = 'GRP';
        await flushPromises();
        expect(page.wrapper.find('[data-field="preparing"]').exists()).toBe(false);

        vm.form.mnuTpC = 'PGE';
        await flushPromises();
        expect(page.wrapper.find('[data-field="preparing"]').exists()).toBe(true);

        page.wrapper.unmount();
    });

    it('준비중을 체크하면 화면경로 없이도 저장할 수 있다', async () => {
        const page = await mountMenusPage();
        const vm = vmOf(page);

        vm.startNew();
        await flushPromises();
        vm.form.mnuNm = '사업계획서 작성';
        vm.form.hrkMnuId = 'ROOT';
        vm.form.mnuTpC = 'PGE';
        await flushPromises();
        expect(vm.saveDisabled).toBe(true);

        vm.form.preparingYn = 'Y';
        await flushPromises();
        expect(vm.saveDisabled).toBe(false);

        page.wrapper.unmount();
    });

    it('유형을 PGE 밖으로 바꾸면 준비중 체크가 풀린다', async () => {
        const page = await mountMenusPage();
        const vm = vmOf(page);

        vm.startNew();
        await flushPromises();
        vm.form.hrkMnuId = 'ROOT';
        vm.form.mnuTpC = 'PGE';
        vm.form.preparingYn = 'Y';
        await flushPromises();

        vm.form.mnuTpC = 'GRP';
        await flushPromises();
        expect(vm.form.preparingYn).toBe('N');

        page.wrapper.unmount();
    });

    it('준비중 경로를 쓰는 메뉴를 고르면 체크 상태로 복원한다', async () => {
        const page = await mountMenusPage();
        const vm = vmOf(page);

        vm.onSelect({ data: menuNode('/preparing/mnu0001018') });
        await flushPromises();
        expect(vm.form.preparingYn).toBe('Y');

        vm.onSelect({ data: menuNode('/budget/list') });
        await flushPromises();
        expect(vm.form.preparingYn).toBe('N');

        page.wrapper.unmount();
    });

    it('저장에 성공하면 라우트 카탈로그를 다시 조회한다', async () => {
        const page = await mountMenusPage();
        const vm = vmOf(page);
        const before = page.routes.executeCount;

        vm.startNew();
        await flushPromises();
        vm.form.mnuNm = '사업계획서 작성';
        vm.form.hrkMnuId = 'ROOT';
        vm.form.mnuTpC = 'PGE';
        vm.form.preparingYn = 'Y';
        await flushPromises();

        await vm.save();
        await flushPromises();

        expect(page.routes.executeCount).toBeGreaterThan(before);
        page.wrapper.unmount();
    });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
cd C:\it\it_frontend && npx vitest run tests/unit/pages/admin-menus-preparing.test.ts
```

Expected: FAIL — `[data-field="preparing"]`가 없고 `form.preparingYn`이 undefined다.

- [ ] **Step 3: 요청 타입과 문구를 추가한다**

`app/composables/useAdminMenu.ts`의 `MenuUpsertRequest`에서 `athIds` 위에 넣는다.

```ts
    /** 준비중 여부 Y/N. Y면 서버가 준비중 경로를 만들어 카탈로그에 등록하고 srePth는 무시한다. */
    preparingYn?: string;
```

`i18n/messages/admin.ts`의 한국어 `menus` 블록에서 `noInternalPath` 아래에 추가한다.

```ts
                preparing: '준비중',
                preparingHelp: '저장하면 준비중 경로가 자동으로 등록됩니다.',
```

같은 블록의 `deletedSidebarRefreshFailed` 아래에 추가한다.

```ts
                routesRefreshTitle: '경로 목록 갱신 실패',
                routesRefreshDetail:
                    '화면경로 목록을 다시 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
                savedRoutesRefreshFailed:
                    '메뉴는 저장되었습니다. 화면경로 목록을 갱신하지 못했으니 잠시 후 다시 불러와 주세요.',
```

영어 `menus` 블록의 같은 위치에 추가한다.

```ts
                preparing: 'In preparation',
                preparingHelp: 'Saving registers a placeholder path automatically.',
```

```ts
                routesRefreshTitle: 'Path List Refresh Failed',
                routesRefreshDetail: 'The screen path list could not be reloaded. Please try again.',
                savedRoutesRefreshFailed:
                    'The menu was saved, but the screen path list could not be refreshed. Please reload shortly.',
```

- [ ] **Step 4: 페이지 스크립트를 고친다**

`app/pages/admin/menus/index.vue`에서 다섯 곳을 바꾼다.

1) import에 판정 유틸을 추가한다(기존 `~/utils/menuPath` import 줄에 합친다).

```ts
import { isExternalHttpUrl, isInternalMenuPath, isPreparingPath } from '~/utils/menuPath';
```

2) 라우트 카탈로그 조회에서 재조회 핸들을 받고 가드를 만든다.

```ts
const routesFetch = await fetchRoutes();
const { data: routes } = routesFetch;
```

`treeRefreshFailed` 가드 블록 바로 아래에 추가한다.

```ts
/* 준비중 저장은 서버가 라우트 카탈로그에 행을 새로 만든다. 이 화면은 KeepAlive로 살아 있어
   재조회하지 않으면 방금 만든 경로가 선택지에 없다 — 저장 성공 뒤 이 조회만 따로 갱신한다. */
const {
    refreshFailed: routesRefreshFailed,
    refreshFailureDetail: routesRefreshFailureDetail,
    attemptRefresh: attemptRoutesRefresh,
    retryRefresh: retryRoutesRefresh,
} = useRefreshGuard(routesFetch, {
    toast,
    summary: () => t('admin.menus.routesRefreshTitle'),
    logLabel: '[AdminMenus] 라우트 카탈로그 재조회 실패',
    retryFailureDetail: () => t('admin.menus.routesRefreshDetail'),
});
```

3) 폼 기본값·복원에 `preparingYn`을 넣는다. `form` 초기값과 `startNew()`의 `replaceForm({...})`에는 `preparingYn: 'N'`을, `loadForm()`의 `replaceForm({...})`에는 아래를 넣는다.

```ts
        preparingYn: isPreparingPath(n.srePth) ? 'Y' : 'N',
```

4) 유형 워처가 준비중 체크도 되돌리게 한다.

```ts
watch(
    () => form.value.mnuTpC,
    (type) => {
        if (replacingForm) return;
        form.value.srePth = null;
        // 준비중은 화면을 여는 PGE에만 있는 상태다
        if (type !== 'PGE') form.value.preparingYn = 'N';
    },
);
```

5) `saveDisabled`에서 준비중을 예외로 두고, `save()` 성공 경로에 카탈로그 재조회를 더한다.

```ts
const saveDisabled = computed(
    () =>
        rootTypeViolation.value ||
        ((form.value.mnuTpC === 'PGE' || form.value.mnuTpC === 'LNK') &&
            !form.value.srePth &&
            form.value.preparingYn !== 'Y'),
);
```

`save()`의 `attemptSidebarRefresh(...)` 다음 줄에 추가한다.

```ts
        await attemptRoutesRefresh(t('admin.menus.savedRoutesRefreshFailed'));
```

- [ ] **Step 5: 템플릿을 고친다**

`app/pages/admin/menus/index.vue`의 PGE 블록(`<div v-if="form.mnuTpC === 'PGE'">`) 전체를 아래로 교체한다.

```vue
            <div v-if="form.mnuTpC === 'PGE'">
                <div class="flex items-center justify-between">
                    <label class="block text-sm">{{ t('admin.menus.screenPath') }}</label>
                    <label class="flex items-center gap-1 text-sm">
                        <Checkbox
                            v-model="form.preparingYn"
                            binary
                            true-value="Y"
                            false-value="N"
                            data-field="preparing"
                        />
                        {{ t('admin.menus.preparing') }}
                    </label>
                </div>
                <Select
                    v-model="form.srePth"
                    :options="pagePathOptions"
                    option-label="label"
                    option-value="value"
                    filter
                    class="w-full"
                    :disabled="form.preparingYn === 'Y'"
                    :placeholder="t('admin.menus.pathPlaceholder')"
                />
                <p v-if="form.preparingYn === 'Y'" class="text-xs text-surface-600">
                    {{ t('admin.menus.preparingHelp') }}
                </p>
                <p v-else-if="!pagePathOptions.length" class="text-xs text-red-600">
                    {{ t('admin.menus.noInternalPath') }}
                </p>
            </div>
```

관리 트리 배너(`<Message v-if="treeRefreshFailed" ...>`) 아래에 카탈로그 배너를 추가한다.

```vue
        <!-- ERR-13: 저장은 반영됐지만 화면경로 목록을 갱신하지 못한 상태 —
             쓰기를 재전송하지 않고 재조회만 다시 시도한다 -->
        <Message v-if="routesRefreshFailed" severity="error" :closable="false" class="col-span-2">
            {{ routesRefreshFailureDetail }}
            <Button
                :label="t('common.actions.refresh')"
                text
                size="small"
                @click="retryRoutesRefresh"
            />
        </Message>
```

- [ ] **Step 6: 통과를 확인한다**

```bash
cd C:\it\it_frontend && npx vitest run tests/unit/pages/admin-menus-preparing.test.ts tests/unit/pages/admin-menus-path-options.test.ts tests/unit/pages/admin-menus-refresh-failure.test.ts tests/unit/pages/admin-menus-type-code.test.ts
```

Expected: PASS (신규 5건 + 기존 메뉴 화면 테스트 전부)

- [ ] **Step 7: 커밋한다**

```bash
cd C:\it\it_frontend && git add app/composables/useAdminMenu.ts app/pages/admin/menus/index.vue i18n/messages/admin.ts tests/unit/pages/admin-menus-preparing.test.ts && git diff --cached --stat && git commit -m "feat: 메뉴 관리 준비중 체크박스 추가"
```

---

### Task 6: 계약 재생성과 전체 검증

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (codegen 산출물)

**Interfaces:**
- Consumes: Task 2의 `preparingYn` DTO 필드
- Produces: 없음 (검증 단계)

- [ ] **Step 1: 백엔드를 기동한다**

```bash
cd C:\it\it_backend && ./gradlew bootRun
```

기동 완료(`Started ItApplication`)까지 기다린다. 다른 셸에서 다음 단계를 진행한다.

- [ ] **Step 2: OpenAPI 타입을 다시 만든다**

```bash
cd C:\it\it_frontend && npm run codegen && npm run codegen:check
```

Expected: `app/types/api.d.ts`의 `MenuUpsertRequest`에 `preparingYn?: string`이 생기고 `codegen:check` 통과

- [ ] **Step 3: 프론트 Health Stack을 돌린다**

```bash
cd C:\it\it_frontend && npm run format:check && npm run check && npm test
```

Expected: 전부 통과. `format:check`이 걸리면 `npx prettier --write`로 해당 파일만 정리한다.

- [ ] **Step 4: 백엔드 테스트를 전부 돌린다**

```bash
cd C:\it\it_backend && ./gradlew test --no-daemon
```

Expected: 전부 통과

- [ ] **Step 5: 화면에서 확인한다**

`/admin/menus`에서 신규 → 유형 `페이지화면` → 준비중 체크 → 저장. 이어서 확인한다.

1. 저장 직후 같은 화면의 화면경로 선택지에 `{메뉴명} (준비중) (/preparing/mnu…)`이 보인다
2. `/admin/routes` 목록에 같은 경로가 `내부화면`으로 있다
3. 사이드바에서 그 메뉴를 누르면 준비중 화면이 뜨고 제목이 메뉴명이다
4. 그 메뉴에서 준비중을 해제하고 실제 경로로 저장하면 `/admin/routes`에서 자동 경로가 사라진다

- [ ] **Step 6: 커밋한다**

```bash
cd C:\it\it_frontend && git add app/types/api.d.ts && git diff --cached --stat && git commit -m "chore: 준비중 여부 필드 OpenAPI 타입 반영"
```

- [ ] **Step 7: 호환 버전을 기록한다**

```bash
cd C:\it && ./scripts/update-versions-lock.ps1
```
