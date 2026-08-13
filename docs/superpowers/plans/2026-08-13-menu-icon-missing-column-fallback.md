# IMK_NM 컬럼 부재 환경의 메뉴 조회 내성 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TPRMPP_CMENUM.IMK_NM` 컬럼이 없는 환경에서도 `/api/menus` 조회가 성공하고, 메뉴별 기본 아이콘이 채워져 사이드바가 정상 렌더링된다.

**Architecture:** `CmenumRepositoryImpl`이 데이터 사전으로 `IMK_NM` 존재를 1회 판정해 캐시하고, 없으면 QueryDSL select 목록에서 그 컬럼을 빼 `MenuTreeRow` 프로젝션을 만든다. `MenuQueryService`는 컬럼이 없을 때만 `MenuIconDefaults`(2026-08-13 로컬 DB 스냅샷 42건)로 아이콘을 채운다. 엔티티 `Cmenum`과 쓰기 경로는 손대지 않고, 프론트는 변경하지 않는다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, QueryDSL, Oracle, JUnit 5, Mockito, AssertJ

**설계 문서:** `docs/superpowers/specs/2026-08-13-menu-icon-missing-column-fallback-design.md`

## Global Constraints

- 모든 신규 주석(JavaDoc/인라인)은 한글로 작성한다. public API와 service 메서드 JavaDoc에는 입력값·반환값·실패 조건을 기록한다. (`CLAUDE.md` §4.1)
- 모든 `@Column`에는 한글 `comment`를 지정한다 — 이 계획은 엔티티를 추가하지 않으므로 해당 없음.
- 응답 직렬화 전용 조회는 엔티티 대신 `*Row`·`*View` 접미사 프로젝션으로 읽는다. (`it_backend/CLAUDE.md` §4)
- 신규 QueryDSL 조회는 `AbstractOracleRepositoryTest` 기반 Oracle 통합 테스트로 결과·정렬·null 계약을 검증한다. `@Tag("it")`은 베이스 클래스가 이미 붙여 준다. (`it_backend/CLAUDE.md` §9)
- 아이콘 클래스 저장 규약은 `^[a-z0-9 -]{1,100}$`이다. (`it_backend/CLAUDE.md` §8)
- 접속 계정은 `ITPAPP`, 객체 소유 스키마는 `ITPOWN`이며 세션 `CURRENT_SCHEMA`가 `ITPOWN`으로 전환된다. 코드에 스키마 접두어를 하드코딩하지 않는다. (`it_backend/CLAUDE.md` §2)
- 커밋 메시지 끝에 다음 줄을 붙인다:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- `it_backend`는 독립 git 저장소다. 루트 `C:\it`가 아니라 `it_backend` 안에서 커밋한다.
- 포맷 게이트는 Spotless다. 커밋 전 `./gradlew spotlessApply`를 돌린다.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuIconDefaults.java` | (신규) `MNU_ID → 아이콘 클래스` 고정 스냅샷 42건. 컬럼 부재 시에만 읽힌다 |
| `it_backend/src/main/java/com/kdb/it/domain/menu/repository/MenuTreeRow.java` | (신규) 메뉴 트리 조립 전용 경량 프로젝션 record. 10인자 canonical + 9인자 보조 생성자 |
| `it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenumRepositoryCustom.java` | (수정) `isIconColumnPresent()`, `findActiveMenuTreeRows()` 계약 추가 |
| `it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenumRepositoryImpl.java` | (수정) 데이터 사전 판정 + 캐시, 조건부 생성자 프로젝션 |
| `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java` | (수정) 엔티티 조회 → 프로젝션 조회, 컬럼 부재 시 기본 아이콘 주입 |
| `it_backend/CLAUDE.md` | (수정) §8 메뉴 아이콘 항목에 폴백 규칙 |
| `docs/db-schema-gap/db-schema-gap-2026-08-12.md` | (수정) §5.1에 "앱 조회는 내성 확보, DDL 반영은 여전히 필요" 메모 |

**손대지 않는 것:** `Cmenum`, `CmenumL`, `AdminMenuService`, `AdminRouteService`, `MenuDto`, `it_frontend` 전체. `MenuDto.Node.imkNm`의 `@Schema` 계약이 그대로이므로 `app/types/api.d.ts` 재생성도 필요 없다.

---

### Task 1: 기본 아이콘 스냅샷 `MenuIconDefaults`

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuIconDefaults.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuIconDefaultsTest.java`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `public static String MenuIconDefaults.iconOf(String mnuId)` — 없으면 `null`. `public static Map<String, String> MenuIconDefaults.all()` — 불변 전량 맵.

- [ ] **Step 1: 실패하는 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuIconDefaultsTest.java`:

```java
package com.kdb.it.domain.menu.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("IMK_NM 컬럼 부재 시 쓰는 메뉴 기본 아이콘 스냅샷")
class MenuIconDefaultsTest {

    /** 아이콘 클래스 저장 규약(it_backend/CLAUDE.md §8)과 동일한 허용 패턴. */
    private static final Pattern ICON_CLASS = Pattern.compile("^[a-z0-9 -]{1,100}$");

    @Test
    @DisplayName("2026-08-13 로컬 DB 스냅샷 42건을 담는다")
    void holdsSnapshotOf42Menus() {
        assertThat(MenuIconDefaults.all()).hasSize(42);
    }

    @Test
    @DisplayName("모든 값이 아이콘 클래스 저장 규약을 만족한다")
    void everyValueMatchesStorageRule() {
        assertThat(MenuIconDefaults.all().values())
                .allSatisfy(icon -> assertThat(ICON_CLASS.matcher(icon).matches()).isTrue());
    }

    @Test
    @DisplayName("스냅샷에 있는 메뉴는 해당 아이콘을, 없는 메뉴와 null은 null을 돌려준다")
    void iconOf_returnsSnapshotValueOrNull() {
        assertThat(MenuIconDefaults.iconOf("MHED0001")).isEqualTo("pi pi-file-check");
        assertThat(MenuIconDefaults.iconOf("MAUD0003")).isEqualTo("pi pi-clock");
        // 스냅샷 이후 생성된 메뉴는 null로 내려가고 프론트 iconFor()가 DEFAULT_MENU_ICON으로 받는다.
        assertThat(MenuIconDefaults.iconOf("MNU9999999")).isNull();
        assertThat(MenuIconDefaults.iconOf(null)).isNull();
    }

    @Test
    @DisplayName("반환 맵은 불변이다")
    void allIsImmutable() {
        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> MenuIconDefaults.all().put("X", "pi pi-home"))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd it_backend && ./gradlew test --tests '*MenuIconDefaultsTest'
```

Expected: 컴파일 실패 — `cannot find symbol: class MenuIconDefaults`

- [ ] **Step 3: 구현 작성**

`it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuIconDefaults.java`:

```java
package com.kdb.it.domain.menu.service;

import java.util.Map;

/**
 * {@code TPRMPP_CMENUM.IMK_NM} 컬럼이 없는 환경에서만 쓰는 메뉴 아이콘 기본값.
 *
 * <p>값의 출처는 2026-08-13 로컬 DB {@code TPRMPP_CMENUM}의 현재 값({@code DEL_YN='N'} 중 {@code IMK_NM IS NOT
 * NULL}) 42건이다. {@code V20260806_002__AddMenuIconColumn.sql}의 시드가 아니라 실 DB를 뜬 이유는, 시드 이후 관리
 * 화면에서 편집된 값({@code MAUD0003}·{@code MAUD0009})과 시드 이후 생성된 메뉴({@code MNU0001006}·{@code
 * MNU0001012})를 포함해야 하기 때문이다.
 *
 * <p>컬럼이 있는 정상 환경에서는 한 번도 읽히지 않는다. 아이콘의 단일 출처는 여전히 메뉴 행이며, 이 맵은 갱신 의무가 없는 고정 스냅샷이다 — 컬럼이 없는 환경은
 * 어차피 아이콘 편집이 불가능하다.
 */
public final class MenuIconDefaults {

    private static final Map<String, String> ICONS =
            Map.ofEntries(
                    Map.entry("MADM0001", "pi pi-sitemap"),
                    Map.entry("MADM0002", "pi pi-link"),
                    Map.entry("MADM0003", "pi pi-chart-line"),
                    Map.entry("MADM0004", "pi pi-database"),
                    Map.entry("MADM0010", "pi pi-comments"),
                    Map.entry("MADM0012", "pi pi-shield"),
                    Map.entry("MADM0016", "pi pi-bolt"),
                    Map.entry("MADM0017", "pi pi-history"),
                    Map.entry("MADM0018", "pi pi-wallet"),
                    Map.entry("MADM0020", "pi pi-chart-bar"),
                    Map.entry("MADM0022", "pi pi-briefcase"),
                    Map.entry("MADM0025", "pi pi-desktop"),
                    Map.entry("MADM0028", "pi pi-file-check"),
                    Map.entry("MADM0032", "pi pi-shield"),
                    Map.entry("MAPV0001", "pi pi-home"),
                    Map.entry("MAPV0002", "pi pi-inbox"),
                    Map.entry("MAPV0005", "pi pi-send"),
                    Map.entry("MAUD0001", "pi pi-home"),
                    Map.entry("MAUD0002", "pi pi-check-square"),
                    Map.entry("MAUD0003", "pi pi-clock"),
                    Map.entry("MAUD0008", "pi pi-cog"),
                    Map.entry("MAUD0009", "pi pi-clock"),
                    Map.entry("MBRD0001", "pi pi-comments"),
                    Map.entry("MCDP0001", "pi pi-clock"),
                    Map.entry("MDOC0001", "pi pi-home"),
                    Map.entry("MDOC0002", "pi pi-folder"),
                    Map.entry("MDOC0005", "pi pi-chart-pie"),
                    Map.entry("MHED0001", "pi pi-file-check"),
                    Map.entry("MHED0002", "pi pi-wallet"),
                    Map.entry("MHED0003", "pi pi-sparkles"),
                    Map.entry("MHED0004", "pi pi-check-square"),
                    Map.entry("MHED0005", "pi pi-send"),
                    Map.entry("MHED0006", "pi pi-comments"),
                    Map.entry("MHED0007", "pi pi-cog"),
                    Map.entry("MINF0001", "pi pi-home"),
                    Map.entry("MINF0002", "pi pi-book"),
                    Map.entry("MINF0003", "pi pi-wallet"),
                    Map.entry("MINF0009", "pi pi-chart-pie"),
                    Map.entry("MINF0012", "pi pi-chart-bar"),
                    Map.entry("MINF0015", "pi pi-briefcase"),
                    Map.entry("MNU0001006", "pi pi-sitemap"),
                    Map.entry("MNU0001012", "pi pi-upload"));

    private MenuIconDefaults() {}

    /**
     * 메뉴ID에 대응하는 기본 아이콘 클래스를 반환한다.
     *
     * @param mnuId 메뉴ID. {@code null}이면 {@code null}을 반환한다
     * @return 스냅샷에 있는 아이콘 클래스. 스냅샷에 없으면 {@code null} — 호출부는 그대로 내려보내고 프론트 {@code iconFor()}가 기본 아이콘으로 받는다
     */
    public static String iconOf(String mnuId) {
        return mnuId == null ? null : ICONS.get(mnuId);
    }

    /**
     * 스냅샷 전량.
     *
     * @return 불변 {@code MNU_ID → 아이콘 클래스} 맵
     */
    public static Map<String, String> all() {
        return ICONS;
    }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
cd it_backend && ./gradlew test --tests '*MenuIconDefaultsTest'
```

Expected: PASS (4 tests)

- [ ] **Step 5: 포맷 후 커밋**

```bash
cd it_backend && ./gradlew spotlessApply
```

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/menu/service/MenuIconDefaults.java src/test/java/com/kdb/it/domain/menu/service/MenuIconDefaultsTest.java && git commit -m "feat: IMK_NM 컬럼 부재 환경용 메뉴 기본 아이콘 스냅샷 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `MenuTreeRow` 프로젝션과 컬럼 존재 판정

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/menu/repository/MenuTreeRow.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenumRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenumRepositoryImpl.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/repository/CmenumMenuTreeProjectionIt.java`

**Interfaces:**
- Consumes: 없음 (Task 1과 독립)
- Produces:
  - `record MenuTreeRow(String mnuId, String hrkMnuId, String mnuNm, String mnuTpC, String srePth, Integer mnuSotSqnSno, String hidYn, Integer mnuDep, String whlMnuPth, String imkNm)` — 9인자 보조 생성자는 `imkNm = null`
  - `List<MenuTreeRow> CmenumRepositoryCustom.findActiveMenuTreeRows()`
  - `boolean CmenumRepositoryCustom.isIconColumnPresent()`

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/menu/repository/CmenumMenuTreeProjectionIt.java`:

```java
package com.kdb.it.domain.menu.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.support.AbstractOracleRepositoryTest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

@DisplayName("메뉴 트리 경량 프로젝션의 엔티티 조회 동등성")
class CmenumMenuTreeProjectionIt extends AbstractOracleRepositoryTest {

    private static final String ICON_ID = "ZZPRJ00001";
    private static final String PLAIN_ID = "ZZPRJ00002";
    private static final String DELETED_ID = "ZZPRJ00003";

    @Autowired CmenumRepository menuRepository;

    @Test
    @DisplayName("로컬 스키마에는 IMK_NM이 있으므로 판정이 true다")
    void iconColumnIsPresentOnLocalSchema() {
        assertThat(menuRepository.isIconColumnPresent()).isTrue();
    }

    @Test
    @DisplayName("findActiveMenuTreeRows는 findAllActive와 동일한 행 집합·필드값·null 계약을 반환한다")
    void menuTreeRows_matchEntityQuery() {
        menuRepository.saveAllAndFlush(
                List.of(
                        menu(ICON_ID, "pi pi-home", "N"),
                        menu(PLAIN_ID, null, "N"),
                        menu(DELETED_ID, "pi pi-cog", "Y")));

        Map<String, Cmenum> entities =
                menuRepository.findAllActive().stream()
                        .filter(e -> e.getMnuId().startsWith("ZZPRJ"))
                        .collect(Collectors.toMap(Cmenum::getMnuId, Function.identity()));
        Map<String, MenuTreeRow> rows =
                menuRepository.findActiveMenuTreeRows().stream()
                        .filter(r -> r.mnuId().startsWith("ZZPRJ"))
                        .collect(Collectors.toMap(MenuTreeRow::mnuId, Function.identity()));

        // DEL_YN='Y'는 양쪽 모두에서 제외된다
        assertThat(entities.keySet()).containsExactlyInAnyOrder(ICON_ID, PLAIN_ID);
        assertThat(rows.keySet()).containsExactlyInAnyOrder(ICON_ID, PLAIN_ID);

        for (Map.Entry<String, Cmenum> entry : entities.entrySet()) {
            Cmenum e = entry.getValue();
            MenuTreeRow r = rows.get(entry.getKey());
            assertThat(r.hrkMnuId()).isEqualTo(e.getHrkMnuId());
            assertThat(r.mnuNm()).isEqualTo(e.getMnuNm());
            assertThat(r.mnuTpC()).isEqualTo(e.getMnuTpC());
            assertThat(r.srePth()).isEqualTo(e.getSrePth());
            assertThat(r.mnuSotSqnSno()).isEqualTo(e.getMnuSotSqnSno());
            assertThat(r.hidYn()).isEqualTo(e.getHidYn());
            assertThat(r.mnuDep()).isEqualTo(e.getMnuDep());
            assertThat(r.whlMnuPth()).isEqualTo(e.getWhlMnuPth());
            // null 계약: 아이콘이 없는 행은 프로젝션에서도 null이어야 한다
            assertThat(r.imkNm()).isEqualTo(e.getImkNm());
        }

        assertThat(rows.get(ICON_ID).imkNm()).isEqualTo("pi pi-home");
        assertThat(rows.get(PLAIN_ID).imkNm()).isNull();
    }

    @Test
    @DisplayName("전체 활성 메뉴 건수가 엔티티 조회와 일치한다")
    void rowCount_matchesEntityQuery() {
        assertThat(menuRepository.findActiveMenuTreeRows())
                .hasSameSizeAs(menuRepository.findAllActive());
    }

    private Cmenum menu(String mnuId, String imkNm, String delYn) {
        LocalDateTime now = LocalDateTime.of(2026, 8, 13, 12, 0);
        return Cmenum.builder()
                .mnuId(mnuId)
                .hrkMnuId(null)
                .mnuNm("프로젝션테스트-" + mnuId)
                .mnuTpC("PGE")
                .srePth("/projection-test/" + mnuId)
                .mnuSotSqnSno(900)
                .hidYn("N")
                .mnuDep(1)
                .whlMnuPth("/" + mnuId)
                .imkNm(imkNm)
                .delYn(delYn)
                .fstEnrUsid("TEST")
                .fstEnrDtm(now)
                .lstChgUsid("TEST")
                .lstChgDtm(now)
                .guid(UUID.randomUUID().toString())
                .guidPrgSno(1)
                .build();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd it_backend && ./gradlew integrationTest --tests '*CmenumMenuTreeProjectionIt'
```

Expected: 컴파일 실패 — `cannot find symbol: class MenuTreeRow`, `method isIconColumnPresent()`

> 로컬 Oracle이 꺼져 있으면 `OracleAvailableCondition`이 전체를 스킵한다. 스킵이 나오면 Oracle을 먼저 기동한다.

- [ ] **Step 3: `MenuTreeRow` record 작성**

`it_backend/src/main/java/com/kdb/it/domain/menu/repository/MenuTreeRow.java`:

```java
package com.kdb.it.domain.menu.repository;

/**
 * 메뉴 트리 조립 전용 경량 프로젝션.
 *
 * <p>{@code Cmenum} 엔티티 대신 이 record로 읽는 이유는 두 가지다. 첫째, 메뉴 트리는 응답 직렬화 전용 조회다(it_backend/CLAUDE.md §4).
 * 둘째, {@code IMK_NM} 컬럼이 없는 환경에서는 select 목록에서 그 컬럼을 빼야 하는데 엔티티 매핑은 정적이라 그럴 수 없다.
 *
 * @param imkNm 아이콘 클래스. 컬럼이 없는 환경에서는 항상 {@code null}이며 서비스 계층이 {@code MenuIconDefaults}로 채운다
 */
public record MenuTreeRow(
        String mnuId,
        String hrkMnuId,
        String mnuNm,
        String mnuTpC,
        String srePth,
        Integer mnuSotSqnSno,
        String hidYn,
        Integer mnuDep,
        String whlMnuPth,
        String imkNm) {

    /** {@code IMK_NM} 컬럼이 없는 환경용 보조 생성자. 아이콘을 select하지 않고 {@code null}로 채운다. */
    public MenuTreeRow(
            String mnuId,
            String hrkMnuId,
            String mnuNm,
            String mnuTpC,
            String srePth,
            Integer mnuSotSqnSno,
            String hidYn,
            Integer mnuDep,
            String whlMnuPth) {
        this(mnuId, hrkMnuId, mnuNm, mnuTpC, srePth, mnuSotSqnSno, hidYn, mnuDep, whlMnuPth, null);
    }
}
```

- [ ] **Step 4: 저장소 계약 추가**

`it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenumRepositoryCustom.java` — 기존 `nextMnuId()` 선언 뒤, 닫는 중괄호 앞에 아래를 추가한다.

```java
    /**
     * 활성 메뉴 전량을 트리 조립용 경량 프로젝션으로 읽는다.
     *
     * <p>{@code DEL_YN='N'} 조건은 {@code findAllActive()}와 동일하다. {@code IMK_NM} 컬럼이 없는 환경에서는 그 컬럼을 select
     * 목록에서 제외하므로 {@code imkNm}이 전부 {@code null}로 온다.
     *
     * @return 활성 메뉴 행 목록. 정렬은 하지 않으며 트리 조립 시 서비스가 정렬한다
     */
    List<MenuTreeRow> findActiveMenuTreeRows();

    /**
     * {@code TPRMPP_CMENUM.IMK_NM} 컬럼이 실제 스키마에 있는지 판정한다.
     *
     * <p>스키마는 런타임에 바뀌지 않으므로 최초 호출 때 한 번만 데이터 사전을 읽고 결과를 캐시한다. 판정 실패는 '없음'으로 접는다.
     *
     * @return 컬럼이 있으면 true. 없거나 판정에 실패하면 false
     */
    boolean isIconColumnPresent();
```

- [ ] **Step 5: 저장소 구현 작성**

`it_backend/src/main/java/com/kdb/it/domain/menu/repository/CmenumRepositoryImpl.java` — import에 다음을 추가한다.

```java
import com.querydsl.core.types.ConstructorExpression;
import com.querydsl.core.types.Projections;
```

`nextMnuId()` 뒤, 클래스 닫는 중괄호 앞에 아래를 추가한다.

```java
    /** IMK_NM 컬럼 존재 여부 캐시. 스키마는 런타임에 바뀌지 않으므로 최초 1회만 판정한다. */
    private volatile Boolean iconColumnPresent;

    @Override
    public boolean isIconColumnPresent() {
        Boolean cached = iconColumnPresent;
        if (cached != null) return cached;
        boolean present = probeIconColumn();
        iconColumnPresent = present;
        return present;
    }

    /**
     * 데이터 사전에서 TPRMPP_CMENUM.IMK_NM을 찾는다.
     *
     * <p>접속 계정(ITPAPP)과 객체 소유 스키마(ITPOWN)가 달라 USER_TAB_COLUMNS로는 보이지 않는다. 세션 CURRENT_SCHEMA를 소유자로 놓고
     * ALL_TAB_COLUMNS를 본다.
     *
     * <p>조회 실패를 '없음'으로 접는 것은 "Repository는 DB 예외를 전파한다"(it_backend/CLAUDE.md §4)에 대한 의도적 예외다. 업무 조회가 아니라
     * 카탈로그 탐지이며, 반대로 판정하면 메뉴 조회 전체가 ORA-00904로 죽는다. 이 방향의 오판은 아이콘이 기본값으로 표시될 뿐이다.
     */
    private boolean probeIconColumn() {
        try {
            Number count =
                    (Number)
                            entityManager
                                    .createNativeQuery(
                                            """
                                            SELECT COUNT(*) FROM ALL_TAB_COLUMNS
                                             WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
                                               AND TABLE_NAME = 'TPRMPP_CMENUM'
                                               AND COLUMN_NAME = 'IMK_NM'
                                            """)
                                    .getSingleResult();
            return count.intValue() > 0;
        } catch (RuntimeException e) {
            return false;
        }
    }

    @Override
    public List<MenuTreeRow> findActiveMenuTreeRows() {
        QCmenum m = QCmenum.cmenum;
        return queryFactory.select(menuTreeRowProjection(m)).from(m).where(m.delYn.eq("N")).fetch();
    }

    /**
     * IMK_NM 유무에 따라 select 목록이 갈리는 생성자 프로젝션.
     *
     * <p>컬럼이 없을 때 null 리터럴을 select에 넣지 않고 목록에서 아예 뺀다. 생성되는 SQL에 IMK_NM이 등장할 여지가 없어야 ORA-00904가 원천
     * 차단되며, Hibernate의 typed-null 렌더링 동작에 의존하지 않는다. 9인자 보조 생성자가 imkNm을 null로 채운다.
     */
    private ConstructorExpression<MenuTreeRow> menuTreeRowProjection(QCmenum m) {
        if (isIconColumnPresent()) {
            return Projections.constructor(
                    MenuTreeRow.class,
                    m.mnuId,
                    m.hrkMnuId,
                    m.mnuNm,
                    m.mnuTpC,
                    m.srePth,
                    m.mnuSotSqnSno,
                    m.hidYn,
                    m.mnuDep,
                    m.whlMnuPth,
                    m.imkNm);
        }
        return Projections.constructor(
                MenuTreeRow.class,
                m.mnuId,
                m.hrkMnuId,
                m.mnuNm,
                m.mnuTpC,
                m.srePth,
                m.mnuSotSqnSno,
                m.hidYn,
                m.mnuDep,
                m.whlMnuPth);
    }
```

- [ ] **Step 6: 통합 테스트가 통과하는지 확인**

```bash
cd it_backend && ./gradlew integrationTest --tests '*CmenumMenuTreeProjectionIt'
```

Expected: PASS (3 tests)

- [ ] **Step 7: 기존 테스트 회귀 확인**

```bash
cd it_backend && ./gradlew test
```

Expected: PASS — 이 시점에는 `MenuQueryService`가 아직 새 조회를 쓰지 않으므로 기존 테스트가 그대로 통과해야 한다.

- [ ] **Step 8: 포맷 후 커밋**

```bash
cd it_backend && ./gradlew spotlessApply
```

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/menu/repository src/test/java/com/kdb/it/domain/menu/repository && git commit -m "feat: IMK_NM 유무에 따라 select가 갈리는 메뉴 트리 프로젝션 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `MenuQueryService`를 프로젝션 조회로 전환하고 기본 아이콘 주입

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`

**Interfaces:**
- Consumes: `MenuIconDefaults.iconOf(String)` (Task 1), `CmenumRepositoryCustom.findActiveMenuTreeRows()` / `isIconColumnPresent()` (Task 2)
- Produces: 외부 계약 변화 없음. `MenuDto.Node`와 `/api/menus` 응답 형태는 그대로다.

- [ ] **Step 1: 기존 테스트를 프로젝션 기반으로 고치고 새 테스트 2건을 추가**

`it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`에서 다음을 바꾼다.

1) import 교체 — `com.kdb.it.domain.menu.entity.Cmenum`을 지우고 아래를 넣는다.

```java
import static org.mockito.Mockito.lenient;

import com.kdb.it.domain.menu.repository.MenuTreeRow;
```

2) `setUp()`에 컬럼 존재 기본 스텁을 추가한다. 컬럼이 있는 정상 환경이 기본값이며, 부재 시나리오만 개별 테스트에서 뒤집는다.

```java
    @BeforeEach
    void setUp() {
        service = new MenuQueryService(cmenumRepository, menuAuthMapProvider, boardMetaService);
        // 기본은 컬럼이 있는 정상 환경. 부재 시나리오 테스트만 이 스텁을 뒤집는다.
        lenient().when(cmenumRepository.isIconColumnPresent()).thenReturn(true);
    }
```

3) `node(...)`와 `boardNode(...)` 헬퍼가 `MenuTreeRow`를 만들도록 바꾼다. `MenuTreeRow`는 불변이므로 아이콘·경로를 인자로 받는다.

```java
    private MenuTreeRow node(String id, String parent, String type, int dep, String path) {
        return row(id, parent, type, dep, path, null, null);
    }

    private MenuTreeRow row(
            String id,
            String parent,
            String type,
            int dep,
            String path,
            String srePth,
            String imkNm) {
        return new MenuTreeRow(id, parent, id, type, srePth, 10, "N", dep, path, imkNm);
    }
```

4) `boardNode(...)`를 아래로 교체한다.

```java
    /** 게시판 메뉴 노드. 화면경로가 게시판을 가리키는 유일한 연결 고리다. */
    private MenuTreeRow boardNode(String id, String blbMngNo) {
        return row(
                id,
                "MBRD0001",
                "PGE",
                3,
                "/MHED0006/MBRD0001/" + id,
                "/board/" + blbMngNo,
                null);
    }
```

5) 모든 `given(cmenumRepository.findAllActive())`를 `given(cmenumRepository.findActiveMenuTreeRows())`로 바꾼다. 총 10곳이다.

6) `tree_carriesMenuIcon()`을 아래로 교체한다 — `Cmenum.setImkNm()`을 쓰던 자리를 `row(...)` 인자로 옮긴다.

```java
    @Test
    void tree_carriesMenuIcon() {
        // 아이콘은 프론트 하드코딩 맵이 아니라 메뉴 행이 단일 출처다 — 트리에 실려 나가야 한다.
        given(cmenumRepository.findActiveMenuTreeRows())
                .willReturn(
                        List.of(
                                row("A", null, "PGE", 1, "/A", null, "pi pi-home"),
                                node("B", null, "PGE", 1, "/B")));
        given(menuAuthMapProvider.getMenuAuthMap()).willReturn(Map.of());

        List<MenuDto.Node> tree = service.getMenuTree(List.of("ITPZZ001"));

        assertThat(tree)
                .extracting(MenuDto.Node::getMnuId, MenuDto.Node::getImkNm)
                .containsExactly(tuple("A", "pi pi-home"), tuple("B", null));
    }
```

7) `boardListIsNotQueried_whenTreeHasNoBoardMenu()`의 `link.setSrePth(...)`도 불변 record에 맞게 고친다.

```java
    @Test
    void boardListIsNotQueried_whenTreeHasNoBoardMenu() {
        // 게시판 메뉴가 없는 트리에서까지 게시판을 조회하면 메뉴 조회마다 불필요한 쿼리가 는다.
        given(cmenumRepository.findActiveMenuTreeRows())
                .willReturn(
                        List.of(
                                node("P", null, "PGE", 1, "/P"),
                                row(
                                        "L",
                                        null,
                                        "LNK",
                                        1,
                                        "/L",
                                        "https://docs.example.com/manual",
                                        null)));
        given(menuAuthMapProvider.getMenuAuthMap()).willReturn(Map.of());

        List<MenuDto.Node> tree = service.getMenuTree(List.of("ITPZZ001"));

        assertThat(tree).extracting(MenuDto.Node::getMnuId).containsExactly("P", "L");
        verifyNoInteractions(boardMetaService);
    }
```

8) `malformedBoardPath_isHiddenFromUserTree()`의 `broken.setSrePth(...)`도 고친다.

```java
    @Test
    void malformedBoardPath_isHiddenFromUserTree() {
        // /board/ 접두사로 시작한 값은 형식이 깨져도 게시판 후보이므로 사용자에게 노출하지 않는다.
        given(cmenumRepository.findActiveMenuTreeRows())
                .willReturn(
                        List.of(
                                node("MBRD0001", null, "GRP", 1, "/MBRD0001"),
                                row(
                                        "B0",
                                        "MBRD0001",
                                        "PGE",
                                        3,
                                        "/MHED0006/MBRD0001/B0",
                                        "/board/BLBM-0001/posts",
                                        null)));
        given(menuAuthMapProvider.getMenuAuthMap()).willReturn(Map.of());
        given(boardMetaService.getAllActive()).willReturn(List.of(activeBoard("BLBM-0001")));

        List<MenuDto.Node> tree = service.getMenuTree(List.of("ITPZZ001"));

        // 자식이 모두 사라진 GRP는 가지치기된다.
        assertThat(tree).isEmpty();
    }
```

9) 파일 끝, 클래스 닫는 중괄호 앞에 새 테스트 2건을 추가한다.

```java
    // =========================================================================
    // IMK_NM 컬럼 부재 환경
    // =========================================================================

    @Test
    @DisplayName("컬럼이 없으면 사용자 트리에 메뉴별 기본 아이콘이 채워진다")
    void userTree_fillsDefaultIcons_whenIconColumnMissing() {
        given(cmenumRepository.isIconColumnPresent()).willReturn(false);
        given(cmenumRepository.findActiveMenuTreeRows())
                .willReturn(
                        List.of(
                                // 스냅샷에 있는 메뉴 → 기본 아이콘
                                node("MHED0001", null, "PGE", 1, "/MHED0001"),
                                // 스냅샷 이후 생성된 메뉴 → null (프론트가 DEFAULT_MENU_ICON으로 받는다)
                                node("MNU9999999", null, "PGE", 1, "/N")));
        given(menuAuthMapProvider.getMenuAuthMap()).willReturn(Map.of());

        List<MenuDto.Node> tree = service.getMenuTree(List.of("ITPZZ001"));

        assertThat(tree)
                .extracting(MenuDto.Node::getMnuId, MenuDto.Node::getImkNm)
                .containsExactly(
                        tuple("MHED0001", "pi pi-file-check"), tuple("MNU9999999", null));
    }

    @Test
    @DisplayName("컬럼이 없으면 관리 트리에도 같은 기본 아이콘이 채워진다")
    void adminTree_fillsDefaultIcons_whenIconColumnMissing() {
        given(cmenumRepository.isIconColumnPresent()).willReturn(false);
        given(cmenumRepository.findActiveMenuTreeRows())
                .willReturn(List.of(node("MADM0001", null, "PGE", 1, "/MADM0001")));
        given(menuAuthMapProvider.getMenuAuthMap()).willReturn(Map.of());

        List<MenuDto.Node> tree = service.getAdminMenuTree();

        assertThat(tree).extracting(MenuDto.Node::getImkNm).containsExactly("pi pi-sitemap");
    }

    @Test
    @DisplayName("컬럼이 있으면 DB의 null을 기본 아이콘으로 되살리지 않는다")
    void iconColumnPresent_keepsNullAsNull() {
        // 관리자가 일부러 비운 아이콘을 서버가 되살리면 '아이콘 단일 출처 = 메뉴 행'이 깨진다.
        given(cmenumRepository.findActiveMenuTreeRows())
                .willReturn(List.of(node("MHED0001", null, "PGE", 1, "/MHED0001")));
        given(menuAuthMapProvider.getMenuAuthMap()).willReturn(Map.of());

        List<MenuDto.Node> tree = service.getMenuTree(List.of("ITPZZ001"));

        assertThat(tree).extracting(MenuDto.Node::getImkNm).containsOnlyNulls();
    }
```

`@DisplayName`을 쓰므로 import를 추가한다.

```java
import org.junit.jupiter.api.DisplayName;
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd it_backend && ./gradlew test --tests '*MenuQueryServiceTest'
```

Expected: 컴파일 실패 — `MenuQueryService`가 아직 `List<Cmenum>`을 받으므로 `findActiveMenuTreeRows()` 스텁 타입이 맞지 않는다.

- [ ] **Step 3: `MenuQueryService` 전환**

`it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java`에서 import를 교체한다.

```java
import com.kdb.it.domain.menu.repository.MenuTreeRow;
```

(`import com.kdb.it.domain.menu.entity.Cmenum;`은 삭제한다.)

`getMenuTree`를 아래로 교체한다.

```java
    public List<MenuDto.Node> getMenuTree(List<String> athIds) {
        List<MenuTreeRow> all = cmenumRepository.findActiveMenuTreeRows();
        boolean iconColumnPresent = cmenumRepository.isIconColumnPresent();
        Map<String, Set<String>> athByMenu = menuAuthMapProvider.getMenuAuthMap();
        Set<String> userAths = new HashSet<>(athIds == null ? List.of() : athIds);
        Set<String> activeBoardPaths = activeBoardPaths(all);

        List<MenuTreeRow> visible =
                all.stream()
                        .filter(m -> !"Y".equals(m.hidYn()))
                        .filter(m -> isAllowed(m.mnuId(), athByMenu, userAths))
                        .filter(m -> isLinkedBoardUsable(m, activeBoardPaths))
                        .toList();

        List<MenuDto.Node> tree = prune(buildTree(visible, iconColumnPresent), true);
        // 사이드바/헤더가 관리자 전용 메뉴에 왕관 아이콘을 표시할 수 있도록 노드별 권한ID를 함께 싣는다.
        applyAthIds(tree, athByMenu);
        return tree;
    }
```

`getAdminMenuTree`를 아래로 교체한다.

```java
    public List<MenuDto.Node> getAdminMenuTree() {
        List<MenuDto.Node> tree =
                buildTree(
                        cmenumRepository.findActiveMenuTreeRows(),
                        cmenumRepository.isIconColumnPresent());
        applyAthIds(tree, menuAuthMapProvider.getMenuAuthMap());
        return tree;
    }
```

`activeBoardPaths`, `isLinkedBoardUsable`, `buildTree`, `toNode`의 시그니처를 프로젝션에 맞춘다. 나머지 본문은 그대로다.

```java
    private Set<String> activeBoardPaths(List<MenuTreeRow> rows) {
        boolean hasBoardMenu = rows.stream().anyMatch(m -> BoardScreenPath.isBoardPath(m.srePth()));
        if (!hasBoardMenu) return Set.of();
        return boardMetaService.getAllActive().stream()
                .map(b -> BoardScreenPath.pathOf(b.getBlbMngNo()))
                .collect(Collectors.toSet());
    }
```

```java
    private boolean isLinkedBoardUsable(MenuTreeRow m, Set<String> activeBoardPaths) {
        if (!BoardScreenPath.isBoardPath(m.srePth())) return true;
        return activeBoardPaths.contains(m.srePth());
    }
```

```java
    private List<MenuDto.Node> buildTree(List<MenuTreeRow> rows, boolean iconColumnPresent) {
        Map<String, MenuDto.Node> byId = new HashMap<>();
        for (MenuTreeRow m : rows) byId.put(m.mnuId(), toNode(m, iconColumnPresent));
        List<MenuDto.Node> roots = new ArrayList<>();
        for (MenuTreeRow m : rows) {
            MenuDto.Node nodeDto = byId.get(m.mnuId());
            if (m.hrkMnuId() == null) {
                roots.add(nodeDto);
            } else {
                MenuDto.Node parent = byId.get(m.hrkMnuId());
                // 부모가 권한 필터로 제외되어 보이지 않으면 자식(고아 노드)도 노출하지 않는다.
                if (parent == null) continue;
                if (parent.getChildren() == null) parent.setChildren(new ArrayList<>());
                parent.getChildren().add(nodeDto);
            }
        }
        sortRecursive(roots);
        return roots;
    }
```

```java
    /**
     * 메뉴 행을 트리 노드로 변환한다.
     *
     * @param m 메뉴 행
     * @param iconColumnPresent {@code TPRMPP_CMENUM.IMK_NM}이 실제 스키마에 있는지 여부
     * @return 트리 노드. 컬럼이 있으면 DB 값을 그대로 싣고(관리자가 비운 null도 그대로), 없으면 {@link MenuIconDefaults} 스냅샷으로 채운다
     */
    private MenuDto.Node toNode(MenuTreeRow m, boolean iconColumnPresent) {
        return MenuDto.Node.builder()
                .mnuId(m.mnuId())
                .hrkMnuId(m.hrkMnuId())
                .mnuNm(m.mnuNm())
                .mnuTpC(m.mnuTpC())
                .srePth(m.srePth())
                .mnuSotSqnSno(m.mnuSotSqnSno())
                .hidYn(m.hidYn())
                .mnuDep(m.mnuDep())
                .whlMnuPth(m.whlMnuPth())
                .imkNm(iconColumnPresent ? m.imkNm() : MenuIconDefaults.iconOf(m.mnuId()))
                .children(new ArrayList<>())
                .build();
    }
```

클래스 JavaDoc의 `getMenuTree` 설명에 폴백을 한 줄 덧붙인다.

```java
    /**
     * 사용자용 메뉴 트리를 조회한다.
     *
     * @param athIds JWT 클레임에서 복원한 자격등급 ID 목록. null이면 공개 메뉴만 반환한다.
     * @return 숨김 메뉴, 권한 불일치 메뉴, 사용 중이 아닌 게시판을 가리키는 PGE 메뉴를 제거하고, 빈 GRP 노드를 가지치기한 트리. 각 노드의 {@code
     *     athIds}에는 왕관 아이콘 표시 판정용 권한ID 목록이 채워진다. {@code IMK_NM} 컬럼이 없는 환경에서는 {@link MenuIconDefaults}
     *     스냅샷으로 아이콘을 채운다.
     */
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
cd it_backend && ./gradlew test --tests '*MenuQueryServiceTest'
```

Expected: PASS (13 tests — 기존 10 + 신규 3)

- [ ] **Step 5: 전체 단위 테스트 회귀 확인**

```bash
cd it_backend && ./gradlew test
```

Expected: PASS. `MenuOpenApiContractTest`가 함께 통과해야 한다 — `MenuDto.Node.imkNm`의 `@Schema` 계약을 바꾸지 않았으므로 수정할 일이 없다.

- [ ] **Step 6: Oracle 통합 테스트 확인**

```bash
cd it_backend && ./gradlew integrationTest
```

Expected: PASS

- [ ] **Step 7: 포맷 후 커밋**

```bash
cd it_backend && ./gradlew spotlessApply
```

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java && git commit -m "feat: IMK_NM 컬럼이 없어도 메뉴 트리를 기본 아이콘으로 조회

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 문서 갱신

**Files:**
- Modify: `it_backend/CLAUDE.md` (§8 도메인 공통 규칙)
- Modify: `docs/db-schema-gap/db-schema-gap-2026-08-12.md` (§5.1)

**Interfaces:**
- Consumes: Task 1~3의 클래스명 (`MenuIconDefaults`, `CmenumRepositoryImpl`, `MenuQueryService`)
- Produces: 없음

- [ ] **Step 1: `it_backend/CLAUDE.md` §8 갱신**

"메뉴 아이콘은 `TPRMPP_CMENUM.IMK_NM`(이미지키명)에 …공백뿐인 값은 null로 접습니다." 항목 바로 뒤에 아래 항목을 추가한다.

```markdown
- `IMK_NM` 컬럼이 없는 환경(마이그레이션 미적용)에서도 **메뉴 조회는 동작해야 합니다**. `CmenumRepositoryImpl`이 데이터 사전으로 컬럼 존재를 1회 판정해 캐시하고, 없으면 select 목록에서 그 컬럼을 빼 `MenuTreeRow` 프로젝션을 만듭니다. `MenuQueryService`는 그때만 `MenuIconDefaults`(고정 스냅샷)로 아이콘을 채우며, 컬럼이 있으면 DB의 `null`도 그대로 둡니다. 이 폴백은 **조회 전용**입니다 — 아이콘 저장과 변경로그(`TPRMPP_CMENUL.IMK_NM`)는 컬럼이 있어야 동작하므로 DDL 반영을 대체하지 않습니다.
```

- [ ] **Step 2: `docs/db-schema-gap/db-schema-gap-2026-08-12.md` §5.1 갱신**

"기존 행은 아이콘 변경 이력이 없으므로 `NULL`로 둡니다(`V20260806_002`의 판단과 동일). 반영 후 `meta/table.txt` 재추출이 필요합니다." 문단 뒤에 아래를 추가한다.

```markdown
**앱 측 조치(2026-08-13)** — `IMK_NM`이 없는 환경에서 메뉴 조회가 `ORA-00904`로 죽지 않도록 백엔드에
내성을 넣었습니다(`docs/superpowers/specs/2026-08-13-menu-icon-missing-column-fallback-design.md`).
컬럼이 없으면 조회 select에서 빼고 `MenuIconDefaults` 스냅샷으로 아이콘을 채웁니다.

**이 조치는 위 DDL 반영을 대체하지 않습니다.** 내성이 걸린 범위는 조회뿐이며, 아이콘 편집(`CMENUM`)과
아이콘 변경 이력(`CMENUL`)은 컬럼이 있어야 동작합니다.
```

- [ ] **Step 3: 커밋**

문서는 두 저장소에 나뉘어 있으므로 각각 커밋한다.

```bash
cd it_backend && git add CLAUDE.md && git commit -m "docs: 메뉴 아이콘 컬럼 부재 시 조회 폴백 규칙 기록

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

```bash
git add docs/db-schema-gap/db-schema-gap-2026-08-12.md docs/superpowers/specs/2026-08-13-menu-icon-missing-column-fallback-design.md docs/superpowers/plans/2026-08-13-menu-icon-missing-column-fallback.md && git commit -m "docs: IMK_NM 부재 환경 메뉴 조회 내성 설계와 계획 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## 최종 검증

- [ ] **전체 품질 게이트**

```bash
cd it_backend && ./gradlew check
```

Expected: PASS (Spotless + 단위 테스트 + JaCoCo 커버리지 검증)

- [ ] **Oracle 통합 테스트**

```bash
cd it_backend && ./gradlew integrationTest
```

Expected: PASS

- [ ] **수동 확인 — 정상 환경**

백엔드와 프론트를 기동하고 http://localhost:3000 에 로그인해 사이드바 아이콘이 종전과 동일한지 확인한다. `MADM0005`(공통코드)처럼 원래 아이콘이 없던 메뉴는 계속 폴더 아이콘이어야 한다.

- [ ] **수동 확인 — 컬럼 부재 시뮬레이션**

로컬에서만, 임시로 컬럼을 지운 뒤 확인하고 되돌린다. **`it_database/migrations/`에 스크립트를 추가하지 않는다** — 검증용 임시 조작이다.

```bash
{ printf '%s\n' "$DB_PASSWORD"; printf '%s\n' "ALTER TABLE ITPOWN.TPRMPP_CMENUM DROP COLUMN IMK_NM;" "EXIT"; } | sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

백엔드를 **재기동**한 뒤(판정 캐시가 프로세스 수명 동안 유지되므로 필수) 사이드바가 정상 렌더링되고 아이콘이 스냅샷대로 나오는지 확인한다. 확인 후 되돌린다.

```bash
{ printf '%s\n' "$DB_PASSWORD"; printf '%s\n' "ALTER TABLE ITPOWN.TPRMPP_CMENUM ADD (IMK_NM VARCHAR2(100));" "COMMENT ON COLUMN ITPOWN.TPRMPP_CMENUM.IMK_NM IS '이미지키명';" "EXIT"; } | sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

되돌린 뒤 `V20260806_002`의 MERGE로 아이콘 값을 복구한다.

```bash
{ printf '%s\n' "$DB_PASSWORD"; printf '%s\n' "@C:/it/it_database/migrations/V20260806_002__AddMenuIconColumn.sql" "EXIT"; } | sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

> **주의**: 이 MERGE는 시드 38건만 복구합니다. 시드에 없던 로컬 값 4건(`MAUD0003`, `MAUD0009`, `MNU0001006`, `MNU0001012`)은 별도로 넣어야 합니다.

```bash
{ printf '%s\n' "$DB_PASSWORD"; printf '%s\n' "UPDATE ITPOWN.TPRMPP_CMENUM SET IMK_NM='pi pi-clock' WHERE MNU_ID IN ('MAUD0003','MAUD0009');" "UPDATE ITPOWN.TPRMPP_CMENUM SET IMK_NM='pi pi-sitemap' WHERE MNU_ID='MNU0001006';" "UPDATE ITPOWN.TPRMPP_CMENUM SET IMK_NM='pi pi-upload' WHERE MNU_ID='MNU0001012';" "COMMIT;" "EXIT"; } | sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

> 이 시뮬레이션이 부담스러우면 건너뛰어도 됩니다. `MenuQueryServiceTest`의 부재 시나리오 테스트 2건이 같은 분기를 덮습니다. 다만 **QueryDSL이 실제로 IMK_NM 없는 SQL을 만드는지**는 이 수동 확인에서만 검증됩니다.
