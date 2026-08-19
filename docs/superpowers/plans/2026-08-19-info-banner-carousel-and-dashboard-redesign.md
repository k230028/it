# /info 배너 캐러셀·즐겨찾기·KPI 카드 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/info` 홈에 관리자가 올린 배너 이미지를 순차 전환하는 캐러셀을 추가하고, 우측 즐겨찾기를 예산 작성 4항목으로, 상단 KPI 카드를 올해·내년 대칭 4종으로 교체한다.

**Architecture:** 배너는 신규 테이블 없이 `TPRMPP_CFILEM`을 `PK_COL_NM='배너'` / `PK_CONE='/info'`로 재사용한다. 범용 `/api/files`에 복원 엔드포인트를 추가하는 대신 배너 전용 `/api/banners`를 두어 규약을 서버가 강제하고, 파일 읽기 default-deny 정책 때문에 `배너` 종류 전용 read authorizer를 신설한다. 프론트는 `info/index.vue`(781줄, 800줄 상한 근접)에서 KPI 카드를 컴포넌트로 추출한 뒤 내년 카드를 추가한다.

**Tech Stack:** Spring Boot(Java 21, JUnit 5 + Mockito + MockMvc), Nuxt 4 CSR + Vue 3 Composition API + PrimeVue 4.5.4 + Tailwind, Vitest + @vue/test-utils, Playwright, Oracle + Flyway.

**Spec:** `docs/superpowers/specs/2026-08-19-info-banner-carousel-and-dashboard-redesign-design.md`

## Global Constraints

- 세 하위 저장소(`it_backend`·`it_frontend`·`it_database`)는 각각 **독립 원격 저장소**다. 커밋은 반드시 해당 디렉터리 안에서 수행한다. 루트 `C:\it`에는 이 계획서와 `TASK.md`만 커밋한다.
- 공유 워킹트리다. `git add -A`·`git add .`·`git commit -a`를 **사용하지 않는다**. 경로를 명시해 스테이징하고, 커밋 전 `git diff --cached --stat`과 `git rev-parse --abbrev-ref HEAD`를 확인한다. 다른 작업의 변경을 되돌리거나 정리하지 않는다.
- 신규 JavaDoc·TSDoc·인라인 주석은 **한글**로 작성한다. 공개 API·서비스 메서드·composable 반환 함수에는 입력과 실패 조건을 기록한다. 단순 대입이나 자명한 메서드에는 주석을 달지 않는다.
- `app/` 아래 운영 `.ts`·`.vue` 파일은 **800줄**을 넘을 수 없다 (`MAX_NEW_FILE_LINES`, `tests/unit/architecture/max-lines-ratchet.test.ts`). `OVERSIZED_FILE_BASELINES`는 현재 비어 있으므로 예외 등재는 허용되지 않는다.
- `app/` 아래 사용자 노출 문구는 **고정 리터럴 금지**. `USER_FACING_COPY_BASELINES`는 비어 있다. 모든 표시 문구는 `i18n/messages/*.ts`의 ko·en 양쪽에 키를 추가하고 `t()`로 참조한다. 검증: `npm run check:copy`
- 배너 규약 상수: `PK_COL_NM = '배너'`, `PK_CONE = '/info'`, `FL_TP_CONE = '이미지'`, `DEL_YN` `'N'`=활성 / `'Y'`=비활성.
- 배너 허용 확장자: `jpg`, `jpeg`, `png`, `gif` (소문자 비교, 대소문자 무시).
- 캐러셀 자동 전환 주기: **5000ms**.
- 배너 정렬: `FL_MPN_ID` **오름차순** (업로드 순).
- 마이그레이션 파일명 규칙: `it_database/migrations/V{YYYYMMDD_NNN}__{CamelCaseDescription}.sql`. 이미 적용된 스크립트는 수정하지 않는다.
- 관리자 전용 백엔드 엔드포인트는 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")` 패턴을 따른다.
- 메뉴 아이콘 `IMK_NM`은 CSS 클래스로 바인딩되므로 `^[a-z0-9 -]{1,100}$`를 만족해야 한다.

## File Structure

**`it_database`**

| 파일 | 책임 |
| --- | --- |
| `migrations/V20260819_001__SeedBannerAdminMenu.sql` | `/admin/banners` 경로 카탈로그·메뉴·영문명 시드 |
| `migrations/_verify/banner-menu-seed-verify.sql` | 시드 결과 검증 쿼리 |

**`it_backend`**

| 파일 | 책임 |
| --- | --- |
| `infra/file/authz/BannerFileReadAuthorizer.java` | `배너` 읽기 = 인증 사용자 전체 |
| `infra/file/authz/BannerFileTargetWriteAuthorizer.java` | `배너` 쓰기 = ADMIN, generic mutation 차단 |
| `infra/file/repository/FileRepository.java` (수정) | 활성·비활성 함께 조회하는 메서드 추가 |
| `domain/banner/dto/BannerDto.java` | `Response`, `ActiveRequest` |
| `domain/banner/service/BannerService.java` | 배너 규약 강제·확장자 검증·활성 토글 |
| `domain/banner/controller/BannerController.java` | `/api/banners` 4개 엔드포인트 |

**`it_frontend`**

| 파일 | 책임 |
| --- | --- |
| `app/composables/useBanners.ts` | `/api/banners` 호출과 미리보기 URL 조합 |
| `app/components/info/InfoBannerCarousel.vue` | 활성 배너 캐러셀 표시 (0건이면 미렌더) |
| `app/pages/admin/banners.vue` | 배너 업로드·목록·활성 토글 |
| `app/composables/useInfoDashboardYear.ts` | 연도 1개의 사업·예산 조회 + 부서/전체 집계 |
| `app/components/info/InfoKpiCountCard.vue` | 건수형 KPI 카드 |
| `app/components/info/InfoKpiBudgetCard.vue` | 금액형 KPI 카드 |
| `app/pages/info/index.vue` (수정) | KPI 4종·즐겨찾기 4항목·캐러셀 배치 |
| `app/utils/menuPresentation.ts` (수정) | `MENU_ICON_OPTIONS`에 `pi pi-images` 추가 |
| `i18n/messages/info.ts` (수정) | `info.dashboard.*` 키 추가·제거 |
| `i18n/messages/admin.ts` (수정) | `admin.banners.*` 키 추가 |
| `tests/e2e/helpers/mockApi.ts` (수정) | `mockCommonApis`에 `/api/banners` 기본 mock 추가 |

---

## Task 1: 배너 관리자 메뉴 시드 마이그레이션

**Files:**
- Create: `it_database/migrations/V20260819_001__SeedBannerAdminMenu.sql`
- Create: `it_database/migrations/_verify/banner-menu-seed-verify.sql`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `/admin/banners` 경로가 `TPRMPP_CMENUD`에 등재되고 `TPRMPP_CMENUM`에 `배너 관리` PGE 메뉴(부모 `MADM0010`)가 생긴다. Task 7의 `/admin/banners` 페이지가 사이드바에 노출되는 근거다.

**배경:** `AdminMenuService.requireUsableCatalogPath()`가 PGE 메뉴 저장 시 `TPRMPP_CMENUD` 행을 요구한다. 카탈로그를 빠뜨리면 관리자가 `/admin/menus`에서 배너 메뉴를 다시 저장할 수 없다.

- [ ] **Step 1: 마이그레이션 스크립트 작성**

`it_database/migrations/V20260819_001__SeedBannerAdminMenu.sql`:

```sql
-- ============================================================================
-- 배너 관리 관리자 메뉴 시드
-- ============================================================================
-- /info 홈 캐러셀에 노출할 배너 이미지를 업로드·활성 관리하는 화면(/admin/banners)의
-- 경로 카탈로그와 메뉴 행을 추가한다.
--
-- [부모 메뉴]
--   배너는 화면에 노출되는 콘텐츠이므로 '게시판 관리'(MADM0011)와 같은 성격이다.
--   그 부모인 MADM0010(콘텐츠 관리)을 부모로 둔다.
--
-- [경로 카탈로그]
--   AdminMenuService.requireUsableCatalogPath()가 PGE 메뉴 저장 시 TPRMPP_CMENUD
--   행을 요구한다. 카탈로그가 없으면 관리자가 /admin/menus에서 이 메뉴를 다시
--   저장할 수 없으므로 CMENUM보다 먼저 넣는다.
--
-- [채번]
--   MNU_ID는 CmenumRepositoryImpl.nextMnuId()와 같은 형식('MNU' + SQ_TPRMPP_CMENUM_1
--   시퀀스를 7자리로 LPAD)을 SQL에서 재현한다.
--
-- [아이콘]
--   IMK_NM은 CSS 클래스로 바인딩되므로 `^[a-z0-9 -]{1,100}$`를 만족해야 한다.
--   'pi pi-images'를 쓰고 프론트 선택지 목록(utils/menuPresentation.ts
--   MENU_ICON_OPTIONS)에도 같은 값을 추가해 메뉴관리 화면에서 재선택할 수 있게 한다.
--
-- [재실행 안전]
--   같은 화면경로의 활성(DEL_YN='N') 메뉴가 이미 있으면 건너뛴다.
--   부모(MADM0010)가 없는 스키마에서도 조용히 건너뛴다.
-- ============================================================================

MERGE INTO ITPOWN.TPRMPP_CMENUD target
USING (SELECT '/admin/banners' AS sre_pth FROM DUAL) source
ON (target.SRE_PTH = source.sre_pth)
WHEN NOT MATCHED THEN
    INSERT (SRE_PTH, SRE_MNU_NM, USE_YN, RMK)
    VALUES (source.sre_pth, '배너 관리', 'Y', '/info 홈 배너 캐러셀 이미지 관리');

DECLARE
    c_parent_id   CONSTANT VARCHAR2(10) := 'MADM0010';
    c_sre_pth     CONSTANT VARCHAR2(40) := '/admin/banners';
    v_parent_path ITPOWN.TPRMPP_CMENUM.WHL_MNU_PTH%TYPE;
    v_parent_dep  ITPOWN.TPRMPP_CMENUM.MNU_DEP%TYPE;
    v_mnu_id      ITPOWN.TPRMPP_CMENUM.MNU_ID%TYPE;
    v_max_sort    NUMBER;
    v_exists      NUMBER;
BEGIN
    BEGIN
        SELECT WHL_MNU_PTH, MNU_DEP
          INTO v_parent_path, v_parent_dep
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE MNU_ID = c_parent_id
           AND DEL_YN = 'N';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN; -- 콘텐츠 관리 그룹이 없는 스키마는 시드 대상이 아니다
    END;

    SELECT COUNT(*)
      INTO v_exists
      FROM ITPOWN.TPRMPP_CMENUM
     WHERE SRE_PTH = c_sre_pth
       AND DEL_YN = 'N';

    IF v_exists = 0 THEN
        SELECT 'MNU' || LPAD(ITPOWN.SQ_TPRMPP_CMENUM_1.NEXTVAL, 7, '0') INTO v_mnu_id FROM DUAL;

        SELECT NVL(MAX(MNU_SOT_SQN_SNO), 0)
          INTO v_max_sort
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE HRK_MNU_ID = c_parent_id
           AND DEL_YN = 'N';

        INSERT INTO ITPOWN.TPRMPP_CMENUM (
            MNU_ID, HRK_MNU_ID, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO,
            HID_YN, MNU_DEP, WHL_MNU_PTH, IMK_NM,
            DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM
        ) VALUES (
            v_mnu_id, c_parent_id, '배너 관리', 'PGE', c_sre_pth, v_max_sort + 10,
            'N', v_parent_dep + 1, v_parent_path || '/' || v_mnu_id, 'pi pi-images',
            'N',
            LOWER(REGEXP_REPLACE(RAWTOHEX(SYS_GUID()), '(.{8})(.{4})(.{4})(.{4})(.{12})', '\1-\2-\3-\4-\5')),
            1, 'MIGRATION', SYSDATE, 'MIGRATION', SYSDATE
        );
    END IF;
END;
/

MERGE INTO ITPOWN.TPRMPP_CLANGM target
USING (
    SELECT m.MNU_ID AS tc_id_cone
      FROM ITPOWN.TPRMPP_CMENUM m
     WHERE m.SRE_PTH = '/admin/banners'
       AND m.DEL_YN = 'N'
) source
ON (
    target.TC_ID_CONE = source.tc_id_cone
    AND target.DTT_LAN_C = 'en'
    AND target.TC_COL_NM = 'MNU_NM'
)
WHEN NOT MATCHED THEN
    INSERT (TC_ID_CONE, DTT_LAN_C, TC_COL_NM, TC_DES, DTT_NM, DEL_YN)
    VALUES (source.tc_id_cone, 'en', 'MNU_NM', 'Banners', '메뉴', 'N');

COMMIT;
```

- [ ] **Step 2: 검증 스크립트 작성**

`it_database/migrations/_verify/banner-menu-seed-verify.sql`:

```sql
-- V20260819_001__SeedBannerAdminMenu.sql 적용 결과 검증
-- 기대: 세 쿼리 모두 EXPECTED_COUNT = 1

SELECT '1. CMENUD 경로 카탈로그' AS CHECK_NAME, COUNT(*) AS EXPECTED_COUNT
  FROM ITPOWN.TPRMPP_CMENUD
 WHERE SRE_PTH = '/admin/banners'
   AND USE_YN = 'Y'
UNION ALL
SELECT '2. CMENUM 활성 메뉴(부모 MADM0010, PGE, 아이콘)', COUNT(*)
  FROM ITPOWN.TPRMPP_CMENUM
 WHERE SRE_PTH = '/admin/banners'
   AND DEL_YN = 'N'
   AND HRK_MNU_ID = 'MADM0010'
   AND MNU_TP_C = 'PGE'
   AND IMK_NM = 'pi pi-images'
UNION ALL
SELECT '3. CLANGM 영문 메뉴명', COUNT(*)
  FROM ITPOWN.TPRMPP_CLANGM l
  JOIN ITPOWN.TPRMPP_CMENUM m ON m.MNU_ID = l.TC_ID_CONE
 WHERE m.SRE_PTH = '/admin/banners'
   AND m.DEL_YN = 'N'
   AND l.DTT_LAN_C = 'en'
   AND l.TC_COL_NM = 'MNU_NM'
   AND l.TC_DES = 'Banners'; -- 번역문은 TC_DES에 들어간다. DTT_NM은 대상 구분 상수('메뉴')다
```

- [ ] **Step 3: 재실행 안전성 확인 (스크립트를 두 번 적용)**

로컬 Oracle에 직접 적용해 확인한다. 접속 정보는 `it_database/CLAUDE.md`를 따르고, 비밀번호는 명령행 인자·문서·로그에 남기지 않는다 (콘솔 프롬프트 사용).

Run:
```bash
sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1 @it_database/migrations/V20260819_001__SeedBannerAdminMenu.sql
```

같은 스크립트를 한 번 더 실행한 뒤 검증 스크립트를 돌린다.

Run:
```bash
sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1 @it_database/migrations/_verify/banner-menu-seed-verify.sql
```

Expected: 세 행 모두 `EXPECTED_COUNT = 1`. 두 번 실행해도 2가 되지 않아야 한다.

- [ ] **Step 4: 커밋**

```bash
cd C:/it/it_database && git rev-parse --abbrev-ref HEAD
```

```bash
cd C:/it/it_database && git add migrations/V20260819_001__SeedBannerAdminMenu.sql migrations/_verify/banner-menu-seed-verify.sql && git diff --cached --stat
```

```bash
cd C:/it/it_database && git commit -m "feat: 배너 관리 화면(/admin/banners) 메뉴·경로 카탈로그 시드"
```

---

## Task 2: 배너 파일 권한 판정기 2종

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/BannerFileReadAuthorizer.java`
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/BannerFileTargetWriteAuthorizer.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/authz/BannerFileReadAuthorizerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/authz/BannerFileTargetWriteAuthorizerTest.java`

**Interfaces:**
- Consumes: `FileReadAuthorizer`, `FileTargetWriteAuthorizer` (기존 인터페이스), `CustomUserDetails#isAdmin()`
- Produces: 두 `@Component`가 스프링 컨텍스트에 등록되어 `FileReadAuthorizerRegistry`·`FileTargetWriteAuthorizerRegistry`가 `"배너"` 키로 수집한다. Task 3·4가 이 판정에 의존한다.

**배경:** `FileReadAuthorizerRegistry`는 **default-deny**다. 미등록 `PK_COL_NM`은 관리자만 읽을 수 있으므로, read authorizer가 없으면 일반 사용자에게 캐러셀 이미지가 403으로 막힌다.

`allowsGenericMutation()=false`는 `FileService.deleteFile()`·`updateFileMeta()`·`deleteFilesByOrc()`에서 검사되며 업로드 경로에는 적용되지 않는다. 업로드는 `canWrite()`가 ADMIN으로 막는다.

- [ ] **Step 1: 실패하는 테스트 작성 (읽기 판정기)**

`it_backend/src/test/java/com/kdb/it/infra/file/authz/BannerFileReadAuthorizerTest.java`:

```java
package com.kdb.it.infra.file.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BannerFileReadAuthorizerTest {

    private final BannerFileReadAuthorizer authorizer = new BannerFileReadAuthorizer();

    @Test
    @DisplayName("배너 종류를 담당한다")
    void supports_banner() {
        assertThat(authorizer.supportedPkColNms()).containsExactly("배너");
    }

    @Test
    @DisplayName("인증 사용자는 읽기 가능(전사 공개)")
    void authenticatedUser_canRead() {
        CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "IT001");
        assertThat(authorizer.canRead(mock(Cfilem.class), user)).isTrue();
    }

    @Test
    @DisplayName("비인증(null) 사용자는 읽기 불가")
    void nullUser_cannotRead() {
        assertThat(authorizer.canRead(mock(Cfilem.class), null)).isFalse();
    }
}
```

- [ ] **Step 2: 실패하는 테스트 작성 (쓰기 판정기)**

`it_backend/src/test/java/com/kdb/it/infra/file/authz/BannerFileTargetWriteAuthorizerTest.java`:

```java
package com.kdb.it.infra.file.authz;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.system.security.CustomUserDetails;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BannerFileTargetWriteAuthorizerTest {

    private static final String ADMIN_ATH = "ITPAD001"; // CustomUserDetails.ATH_ADMIN
    private static final String USER_ATH = "ITPZZ001"; // CustomUserDetails.ATH_USER

    private final BannerFileTargetWriteAuthorizer authorizer = new BannerFileTargetWriteAuthorizer();

    @Test
    @DisplayName("배너 종류를 담당한다")
    void supports_banner() {
        assertThat(authorizer.supportedPkColNms()).containsExactly("배너");
    }

    @Test
    @DisplayName("관리자는 배너 위치에 쓰기 가능")
    void admin_canWrite() {
        CustomUserDetails admin = new CustomUserDetails("E001", List.of(ADMIN_ATH), "IT001");
        assertThat(authorizer.canWrite("/info", admin)).isTrue();
    }

    @Test
    @DisplayName("일반 사용자는 쓰기 불가")
    void normalUser_cannotWrite() {
        CustomUserDetails user = new CustomUserDetails("E002", List.of(USER_ATH), "IT001");
        assertThat(authorizer.canWrite("/info", user)).isFalse();
    }

    @Test
    @DisplayName("비인증(null) 사용자는 쓰기 불가")
    void nullUser_cannotWrite() {
        assertThat(authorizer.canWrite("/info", null)).isFalse();
    }

    @Test
    @DisplayName("배너 위치(pkCone)가 비면 쓰기 불가")
    void blankPkCone_cannotWrite() {
        CustomUserDetails admin = new CustomUserDetails("E001", List.of(ADMIN_ATH), "IT001");
        assertThat(authorizer.canWrite("  ", admin)).isFalse();
        assertThat(authorizer.canWrite(null, admin)).isFalse();
    }

    @Test
    @DisplayName("범용 파일 API의 수정·삭제를 차단한다")
    void genericMutation_isBlocked() {
        assertThat(authorizer.allowsGenericMutation()).isFalse();
    }
}
```

**확인 완료:** 관리자 자격등급 ID는 `ITPAD001`(`CustomUserDetails.ATH_ADMIN`), 일반사용자는 `ITPZZ001`(`ATH_USER`)이다. `isAdmin()`은 `athIds.contains(ATH_ADMIN)`이다. 위 상수 값을 그대로 쓴다.

- [ ] **Step 3: 테스트 실행해 실패 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --no-daemon --tests '*BannerFile*AuthorizerTest'
```

Expected: 컴파일 실패 — `BannerFileReadAuthorizer` / `BannerFileTargetWriteAuthorizer` 심볼을 찾을 수 없음.

- [ ] **Step 4: 읽기 판정기 구현**

`it_backend/src/main/java/com/kdb/it/infra/file/authz/BannerFileReadAuthorizer.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 배너 이미지 읽기 판정기 — 전사 공개(인증 사용자 전체).
 *
 * <p>배너는 /info 홈 캐러셀에 모든 사용자에게 노출되는 이미지이므로 인증된 사용자에게 읽기를 허용한다.
 * (default-deny의 명시적 예외)
 */
@Component
public class BannerFileReadAuthorizer implements FileReadAuthorizer {

    /** 배너 파일 종류(PK_COL_NM). */
    public static final String BANNER_KIND = "배너";

    @Override
    public Set<String> supportedPkColNms() {
        return Set.of(BANNER_KIND);
    }

    @Override
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        return user != null; // 전사 공개: 인증 사용자 전체
    }
}
```

- [ ] **Step 5: 쓰기 판정기 구현**

`it_backend/src/main/java/com/kdb/it/infra/file/authz/BannerFileTargetWriteAuthorizer.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.system.security.CustomUserDetails;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 배너 첨부 대상 쓰기 판정기 — 관리자만 허용합니다.
 *
 * <p>배너는 도메인 부모 레코드가 없고 {@code PK_CONE}이 노출 위치(예: {@code /info})를 담는다.
 * 따라서 부모 존재 검사 대신 위치 값이 비어 있지 않은지와 관리자 여부만 판정한다.
 *
 * <p>{@link #allowsGenericMutation()}을 {@code false}로 두어 범용 {@code /api/files}
 * PUT·DELETE가 배너 행을 변경하지 못하게 막는다. 배너 관리 창구는 {@code /api/banners} 하나다.
 */
@Component
public class BannerFileTargetWriteAuthorizer implements FileTargetWriteAuthorizer {

    @Override
    public Set<String> supportedPkColNms() {
        return Set.of(BannerFileReadAuthorizer.BANNER_KIND);
    }

    /** 배너는 전용 API로만 수정·삭제한다. */
    @Override
    public boolean allowsGenericMutation() {
        return false;
    }

    /**
     * 배너 노출 위치에 이미지를 붙일 수 있는지 판정합니다.
     *
     * @param pkCone 배너 노출 위치 (예: {@code /info})
     * @param user 현재 사용자
     * @return 위치 값이 있고 관리자이면 {@code true}
     */
    @Override
    public boolean canWrite(String pkCone, CustomUserDetails user) {
        if (user == null || !StringUtils.hasText(pkCone)) {
            return false;
        }
        return user.isAdmin();
    }
}
```

- [ ] **Step 6: 테스트 실행해 통과 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --no-daemon --tests '*BannerFile*AuthorizerTest'
```

Expected: PASS (9개 테스트).

- [ ] **Step 7: 레지스트리 회귀 테스트 실행**

`FileReadAuthorizerRegistryTest`·`FileTargetWriteAuthorizerRegistryTest`가 종류 중복 등록을 막는다. `배너`가 다른 판정기와 충돌하지 않는지 확인한다.

Run:
```bash
cd C:/it/it_backend && ./gradlew test --no-daemon --tests '*FileReadAuthorizerRegistryTest' --tests '*FileTargetWriteAuthorizerRegistryTest' --tests '*FileOwnershipCheckerTest'
```

Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
cd C:/it/it_backend && git rev-parse --abbrev-ref HEAD
```

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/infra/file/authz/BannerFileReadAuthorizer.java src/main/java/com/kdb/it/infra/file/authz/BannerFileTargetWriteAuthorizer.java src/test/java/com/kdb/it/infra/file/authz/BannerFileReadAuthorizerTest.java src/test/java/com/kdb/it/infra/file/authz/BannerFileTargetWriteAuthorizerTest.java && git diff --cached --stat
```

```bash
cd C:/it/it_backend && git commit -m "feat: 배너 파일 읽기·쓰기 권한 판정기 추가"
```

---

## Task 3: 배너 DTO와 서비스

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/repository/FileRepository.java` (메서드 1개 추가)
- Create: `it_backend/src/main/java/com/kdb/it/domain/banner/dto/BannerDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/banner/service/BannerService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/banner/service/BannerServiceTest.java`

**Interfaces:**
- Consumes: `BannerFileReadAuthorizer.BANNER_KIND` (Task 2), `FileService#uploadFileAndGet(MultipartFile, FileDto.UploadRequest)`, `FileRepository`
- Produces:
  - `BannerDto.Response` — 필드 `String flMpnId`, `String flNm`, `Long apgFlSz`, `boolean active`, `String previewUrl`, `LocalDateTime fstEnrDtm`, `String fstEnrUsid`. Lombok `@Getter @Builder`.
  - `BannerDto.ActiveRequest` — 필드 `Boolean active`. Lombok `@Getter @Setter @NoArgsConstructor`.
  - `BannerService#getActiveBanners(): List<BannerDto.Response>`
  - `BannerService#getAllBanners(): List<BannerDto.Response>`
  - `BannerService#upload(MultipartFile): BannerDto.Response`
  - `BannerService#setActive(String flMpnId, boolean active): BannerDto.Response`
  - `BannerService.BANNER_PK_CONE` = `"/info"` (public static final String)

  Task 4(컨트롤러)가 이 시그니처에 의존한다.

- [ ] **Step 1: FileRepository에 활성·비활성 통합 조회 메서드 추가**

기존 메서드는 모두 `delYn`을 조건으로 받아 관리자 목록(활성+비활성)에 쓸 수 없다. `it_backend/src/main/java/com/kdb/it/infra/file/repository/FileRepository.java`의 `findAllByPkColNmAndDelYn` 선언 **바로 아래**에 추가한다:

```java
    /**
     * 주식별자컬럼명 + 주식별자내용으로 삭제 여부와 무관하게 파일 목록을 조회합니다.
     *
     * <p>배너 관리 화면처럼 활성(DEL_YN='N')과 비활성(DEL_YN='Y')을 함께 보여줘야 하는
     * 경우에만 사용합니다. 일반 조회는 반드시 delYn 조건이 있는 메서드를 씁니다.
     *
     * @param pkColNm 주식별자컬럼명
     * @param pkCone 주식별자내용
     * @return 파일매핑ID 오름차순 파일 목록 (활성·비활성 포함)
     */
    List<Cfilem> findAllByPkColNmAndPkConeOrderByFlMpnIdAsc(String pkColNm, String pkCone);
```

- [ ] **Step 2: 실패하는 서비스 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/banner/service/BannerServiceTest.java`:

```java
package com.kdb.it.domain.banner.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.kdb.it.domain.banner.dto.BannerDto;
import com.kdb.it.exception.CustomGeneralException;
import com.kdb.it.infra.file.dto.FileDto;
import com.kdb.it.infra.file.entity.Cfilem;
import com.kdb.it.infra.file.repository.FileRepository;
import com.kdb.it.infra.file.service.FileService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class BannerServiceTest {

    @Mock private FileService fileService;
    @Mock private FileRepository fileRepository;

    @InjectMocks private BannerService bannerService;

    /** delYn을 지정해 Cfilem 스텁을 만든다. */
    private Cfilem banner(String flMpnId, String delYn) {
        Cfilem file =
                Cfilem.builder()
                        .flMpnId(flMpnId)
                        .flNm(flMpnId + ".png")
                        .flTpCone("이미지")
                        .apgFlSz(1024L)
                        .pkColNm("배너")
                        .pkCone("/info")
                        .build();
        if ("Y".equals(delYn)) {
            file.delete();
        } else {
            file.restore();
        }
        return file;
    }

    @Test
    @DisplayName("활성 배너만 파일매핑ID 오름차순으로 반환한다")
    void getActiveBanners_sortedAscending() {
        given(fileRepository.findAllByPkColNmAndPkConeAndDelYn("배너", "/info", "N"))
                .willReturn(List.of(banner("FL-00000003", "N"), banner("FL-00000001", "N")));

        List<BannerDto.Response> result = bannerService.getActiveBanners();

        assertThat(result).extracting(BannerDto.Response::getFlMpnId)
                .containsExactly("FL-00000001", "FL-00000003");
        assertThat(result).allMatch(BannerDto.Response::isActive);
        assertThat(result.get(0).getPreviewUrl()).isEqualTo("/api/files/FL-00000001/preview");
    }

    @Test
    @DisplayName("관리자 목록은 비활성 배너도 active=false로 함께 반환한다")
    void getAllBanners_includesInactive() {
        given(fileRepository.findAllByPkColNmAndPkConeOrderByFlMpnIdAsc("배너", "/info"))
                .willReturn(List.of(banner("FL-00000001", "N"), banner("FL-00000002", "Y")));

        List<BannerDto.Response> result = bannerService.getAllBanners();

        assertThat(result).extracting(BannerDto.Response::isActive).containsExactly(true, false);
    }

    @Test
    @DisplayName("업로드는 배너 규약(pkColNm·pkCone·flTpCone)을 서버가 고정한다")
    void upload_forcesBannerContract() {
        MockMultipartFile file =
                new MockMultipartFile("file", "hero.png", "image/png", new byte[] {1});
        given(fileService.uploadFileAndGet(any(), any()))
                .willReturn(
                        FileDto.Response.builder()
                                .flMpnId("FL-00000009")
                                .flNm("hero.png")
                                .apgFlSz(1L)
                                .previewUrl("/api/files/FL-00000009/preview")
                                .build());

        BannerDto.Response result = bannerService.upload(file);

        ArgumentCaptor<FileDto.UploadRequest> captor =
                ArgumentCaptor.forClass(FileDto.UploadRequest.class);
        verify(fileService).uploadFileAndGet(any(), captor.capture());
        assertThat(captor.getValue().getPkColNm()).isEqualTo("배너");
        assertThat(captor.getValue().getPkCone()).isEqualTo("/info");
        assertThat(captor.getValue().getFlTpCone()).isEqualTo("이미지");
        assertThat(result.isActive()).isTrue();
        assertThat(result.getFlMpnId()).isEqualTo("FL-00000009");
    }

    @Test
    @DisplayName("이미지가 아닌 확장자는 업로드를 거부한다")
    void upload_rejectsNonImageExtension() {
        MockMultipartFile file =
                new MockMultipartFile("file", "manual.pdf", "application/pdf", new byte[] {1});

        assertThatThrownBy(() -> bannerService.upload(file))
                .isInstanceOf(CustomGeneralException.class)
                .hasMessageContaining("이미지");
    }

    @Test
    @DisplayName("확장자 비교는 대소문자를 무시한다")
    void upload_extensionComparisonIsCaseInsensitive() {
        MockMultipartFile file =
                new MockMultipartFile("file", "hero.PNG", "image/png", new byte[] {1});
        given(fileService.uploadFileAndGet(any(), any()))
                .willReturn(FileDto.Response.builder().flMpnId("FL-00000010").build());

        assertThat(bannerService.upload(file).getFlMpnId()).isEqualTo("FL-00000010");
    }

    @Test
    @DisplayName("확장자가 없는 파일은 업로드를 거부한다")
    void upload_rejectsMissingExtension() {
        MockMultipartFile file = new MockMultipartFile("file", "hero", "image/png", new byte[] {1});

        assertThatThrownBy(() -> bannerService.upload(file))
                .isInstanceOf(CustomGeneralException.class)
                .hasMessageContaining("이미지");
    }

    @Test
    @DisplayName("비활성화하면 DEL_YN='Y'가 되고 active=false를 반환한다")
    void setActive_false_marksDeleted() {
        Cfilem file = banner("FL-00000001", "N");
        given(fileRepository.findById("FL-00000001")).willReturn(Optional.of(file));

        BannerDto.Response result = bannerService.setActive("FL-00000001", false);

        assertThat(file.getDelYn()).isEqualTo("Y");
        assertThat(result.isActive()).isFalse();
    }

    @Test
    @DisplayName("재활성화하면 DEL_YN='N'으로 복원된다")
    void setActive_true_restores() {
        Cfilem file = banner("FL-00000002", "Y");
        given(fileRepository.findById("FL-00000002")).willReturn(Optional.of(file));

        BannerDto.Response result = bannerService.setActive("FL-00000002", true);

        assertThat(file.getDelYn()).isEqualTo("N");
        assertThat(result.isActive()).isTrue();
    }

    @Test
    @DisplayName("존재하지 않는 파일은 토글을 거부한다")
    void setActive_missingFile_throws() {
        given(fileRepository.findById("FL-99999999")).willReturn(Optional.empty());

        assertThatThrownBy(() -> bannerService.setActive("FL-99999999", true))
                .isInstanceOf(CustomGeneralException.class)
                .hasMessageContaining("배너를 찾을 수 없습니다");
    }

    @Test
    @DisplayName("배너가 아닌 파일은 토글을 거부한다 — 배너 API로 다른 파일을 복원할 수 없다")
    void setActive_nonBannerFile_throws() {
        Cfilem other =
                Cfilem.builder()
                        .flMpnId("FL-00000007")
                        .pkColNm("공통게시판")
                        .pkCone("NAC-1")
                        .build();
        other.delete();
        given(fileRepository.findById("FL-00000007")).willReturn(Optional.of(other));

        assertThatThrownBy(() -> bannerService.setActive("FL-00000007", true))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }
}
```

**확인 완료:** `BaseEntity`에 클래스 레벨 `@Getter`가 있으므로 `Cfilem.getDelYn()`은 존재한다. `delYn`에 setter는 없으므로 위 헬퍼처럼 `delete()`/`restore()`로 상태를 만든다.

- [ ] **Step 3: 테스트 실행해 실패 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --no-daemon --tests '*BannerServiceTest'
```

Expected: 컴파일 실패 — `BannerService`, `BannerDto` 심볼을 찾을 수 없음.

- [ ] **Step 4: BannerDto 구현**

`it_backend/src/main/java/com/kdb/it/domain/banner/dto/BannerDto.java`:

```java
package com.kdb.it.domain.banner.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** /info 홈 배너 API 요청·응답 DTO 모음 */
public class BannerDto {

    private BannerDto() {}

    /** 배너 조회 응답 DTO */
    @Schema(name = "BannerDto.Response", description = "배너 조회 응답 DTO")
    @Getter
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Response {

        @Schema(description = "파일매핑ID", example = "FL-00000001")
        private String flMpnId;

        @Schema(description = "파일명", example = "hero-2026.png")
        private String flNm;

        @Schema(description = "첨부파일크기(바이트). 레거시 파일은 null", example = "204800")
        private Long apgFlSz;

        @Schema(description = "활성 여부 (DEL_YN='N'이면 true)", example = "true")
        private boolean active;

        @Schema(description = "이미지 미리보기 URL", example = "/api/files/FL-00000001/preview")
        private String previewUrl;

        @Schema(description = "최초등록일시")
        private LocalDateTime fstEnrDtm;

        @Schema(description = "최초등록자 사번", example = "EMP0001234")
        private String fstEnrUsid;
    }

    /** 배너 활성 상태 변경 요청 DTO */
    @Schema(name = "BannerDto.ActiveRequest", description = "배너 활성 상태 변경 요청 DTO")
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActiveRequest {

        @Schema(
                description = "활성 여부. true면 DEL_YN='N', false면 DEL_YN='Y'",
                example = "false",
                requiredMode = Schema.RequiredMode.REQUIRED)
        private Boolean active;
    }
}
```

- [ ] **Step 5: BannerService 구현**

`it_backend/src/main/java/com/kdb/it/domain/banner/service/BannerService.java`:

```java
package com.kdb.it.domain.banner.service;

import com.kdb.it.domain.banner.dto.BannerDto;
import com.kdb.it.exception.CustomGeneralException;
import com.kdb.it.infra.file.authz.BannerFileReadAuthorizer;
import com.kdb.it.infra.file.dto.FileDto;
import com.kdb.it.infra.file.entity.Cfilem;
import com.kdb.it.infra.file.repository.FileRepository;
import com.kdb.it.infra.file.service.FileService;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * /info 홈 배너 서비스
 *
 * <p>배너는 전용 테이블 없이 공통첨부파일기본(TPRMPP_CFILEM)을 재사용한다. 이 서비스가
 * {@code PK_COL_NM='배너'}·{@code PK_CONE='/info'}·{@code FL_TP_CONE='이미지'} 규약을 강제하므로
 * 클라이언트가 임의 값을 보낼 수 없다.
 *
 * <p>활성·비활성은 {@code DEL_YN}으로 표현한다. {@code 'N'}이 활성, {@code 'Y'}가 비활성이며
 * 물리 파일은 어느 쪽에서도 지우지 않는다.
 */
@Service
@RequiredArgsConstructor
public class BannerService {

    /** 배너 노출 위치 — 현재는 /info 홈 한 곳이다. */
    public static final String BANNER_PK_CONE = "/info";

    private static final String IMAGE_FL_TP_CONE = "이미지";
    private static final String ACTIVE = "N";

    /** 배너로 허용하는 이미지 확장자. FileValidator는 pdf·hwp도 통과시키므로 여기서 좁힌다. */
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS =
            Set.of("jpg", "jpeg", "png", "gif");

    private final FileService fileService;
    private final FileRepository fileRepository;

    /**
     * 홈 캐러셀에 노출할 활성 배너를 조회합니다.
     *
     * @return 파일매핑ID 오름차순(업로드 순) 활성 배너 목록. 없으면 빈 목록
     */
    @Transactional(readOnly = true)
    public List<BannerDto.Response> getActiveBanners() {
        return fileRepository
                .findAllByPkColNmAndPkConeAndDelYn(
                        BannerFileReadAuthorizer.BANNER_KIND, BANNER_PK_CONE, ACTIVE)
                .stream()
                .sorted(Comparator.comparing(Cfilem::getFlMpnId))
                .map(file -> toResponse(file, true))
                .toList();
    }

    /**
     * 관리 화면용으로 활성·비활성 배너를 모두 조회합니다.
     *
     * @return 파일매핑ID 오름차순 전체 배너 목록
     */
    @Transactional(readOnly = true)
    public List<BannerDto.Response> getAllBanners() {
        return fileRepository
                .findAllByPkColNmAndPkConeOrderByFlMpnIdAsc(
                        BannerFileReadAuthorizer.BANNER_KIND, BANNER_PK_CONE)
                .stream()
                .map(file -> toResponse(file, ACTIVE.equals(file.getDelYn())))
                .toList();
    }

    /**
     * 배너 이미지를 업로드합니다.
     *
     * @param file 업로드할 이미지 파일
     * @return 업로드된 배너 정보 (활성 상태)
     * @throws CustomGeneralException 확장자가 없거나 허용 이미지 확장자가 아닌 경우
     */
    @Transactional
    public BannerDto.Response upload(MultipartFile file) {
        requireImageExtension(file.getOriginalFilename());

        FileDto.Response uploaded =
                fileService.uploadFileAndGet(
                        file,
                        FileDto.UploadRequest.builder()
                                .flTpCone(IMAGE_FL_TP_CONE)
                                .pkColNm(BannerFileReadAuthorizer.BANNER_KIND)
                                .pkCone(BANNER_PK_CONE)
                                .build());

        return BannerDto.Response.builder()
                .flMpnId(uploaded.getFlMpnId())
                .flNm(uploaded.getFlNm())
                .apgFlSz(uploaded.getApgFlSz())
                .active(true)
                .previewUrl(previewUrl(uploaded.getFlMpnId()))
                .fstEnrDtm(uploaded.getFstEnrDtm())
                .fstEnrUsid(uploaded.getFstEnrUsid())
                .build();
    }

    /**
     * 배너 활성 상태를 변경합니다.
     *
     * @param flMpnId 배너 파일매핑ID
     * @param active {@code true}면 DEL_YN='N'으로 복원, {@code false}면 'Y'로 비활성화
     * @return 변경된 배너 정보
     * @throws CustomGeneralException 해당 파일매핑ID가 없는 경우
     * @throws AccessDeniedException 대상 파일이 배너가 아닌 경우
     */
    @Transactional
    public BannerDto.Response setActive(String flMpnId, boolean active) {
        Cfilem file =
                fileRepository
                        .findById(flMpnId)
                        .orElseThrow(
                                () -> new CustomGeneralException("배너를 찾을 수 없습니다: " + flMpnId));

        // 배너 API로 다른 종류의 삭제된 파일을 되살릴 수 없게 막는다.
        if (!BannerFileReadAuthorizer.BANNER_KIND.equals(file.getPkColNm())) {
            throw new AccessDeniedException("배너가 아닌 파일은 배너 API로 변경할 수 없습니다.");
        }

        if (active) {
            file.restore();
        } else {
            file.delete();
        }
        return toResponse(file, active);
    }

    /** 확장자가 허용 이미지 목록에 있는지 검증한다. */
    private void requireImageExtension(String originalFilename) {
        int dot = originalFilename == null ? -1 : originalFilename.lastIndexOf('.');
        String extension =
                dot < 0 ? "" : originalFilename.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            throw new CustomGeneralException(
                    "배너는 이미지 파일만 등록할 수 있습니다. 허용 확장자: jpg, jpeg, png, gif");
        }
    }

    private BannerDto.Response toResponse(Cfilem file, boolean active) {
        return BannerDto.Response.builder()
                .flMpnId(file.getFlMpnId())
                .flNm(file.getFlNm())
                .apgFlSz(file.getApgFlSz())
                .active(active)
                .previewUrl(previewUrl(file.getFlMpnId()))
                .fstEnrDtm(file.getFstEnrDtm())
                .fstEnrUsid(file.getFstEnrUsid())
                .build();
    }

    private String previewUrl(String flMpnId) {
        return "/api/files/" + flMpnId + "/preview";
    }
}
```

- [ ] **Step 6: 테스트 실행해 통과 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --no-daemon --tests '*BannerServiceTest'
```

Expected: PASS (9개 테스트 — 건수형 6개, 금액형 3개).

- [ ] **Step 7: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/banner/ src/main/java/com/kdb/it/infra/file/repository/FileRepository.java src/test/java/com/kdb/it/domain/banner/ && git diff --cached --stat
```

```bash
cd C:/it/it_backend && git commit -m "feat: 배너 서비스와 DTO 추가 — CFILEM 재사용, 이미지 확장자 검증, 활성 토글"
```

---

## Task 4: 배너 REST 컨트롤러

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/banner/controller/BannerController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/banner/controller/BannerControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java` (테스트 1개 추가)

**Interfaces:**
- Consumes: `BannerService#getActiveBanners()`, `#getAllBanners()`, `#upload(MultipartFile)`, `#setActive(String, boolean)` (Task 3)
- Produces: HTTP 계약. Task 5의 `useBanners.ts`가 이 경로·본문 형태에 의존한다.
  - `GET /api/banners` → `200 BannerDto.Response[]` (인증 사용자)
  - `GET /api/banners/admin` → `200 BannerDto.Response[]` (ADMIN)
  - `POST /api/banners` (multipart, part 이름 `file`) → `201 BannerDto.Response` (ADMIN)
  - `PATCH /api/banners/{flMpnId}/active` (JSON `{"active": boolean}`) → `200 BannerDto.Response` (ADMIN)

- [ ] **Step 1: 실패하는 컨트롤러 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/banner/controller/BannerControllerTest.java`:

```java
package com.kdb.it.domain.banner.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kdb.it.common.system.security.JwtUtil;
import com.kdb.it.common.system.service.CustomUserDetailsService;
import com.kdb.it.config.JacksonConfig;
import com.kdb.it.config.TestSecurityConfig;
import com.kdb.it.domain.banner.dto.BannerDto;
import com.kdb.it.domain.banner.service.BannerService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * BannerController @WebMvcTest
 *
 * <p>배너 API의 권한 경계와 응답 구조를 검증합니다.
 */
@WebMvcTest(BannerController.class)
@Import({
    TestSecurityConfig.class,
    JacksonConfig.class,
    BannerControllerTest.MethodSecurityTestConfig.class
})
class BannerControllerTest {

    /** TestSecurityConfig에는 @EnableMethodSecurity가 없어 @PreAuthorize가 꺼진다. 여기서 켠다. */
    @EnableMethodSecurity
    static class MethodSecurityTestConfig {}

    @Autowired private MockMvc mockMvc;

    @MockitoBean private BannerService bannerService;
    @MockitoBean private JwtUtil jwtUtil;
    @MockitoBean private CustomUserDetailsService customUserDetailsService;

    private static final String FL_MPN_ID = "FL-00000001";

    private BannerDto.Response response(boolean active) {
        return BannerDto.Response.builder()
                .flMpnId(FL_MPN_ID)
                .flNm("hero.png")
                .apgFlSz(2048L)
                .active(active)
                .previewUrl("/api/files/" + FL_MPN_ID + "/preview")
                .build();
    }

    @Test
    @DisplayName("GET /api/banners - 비인증 → 401")
    void getActiveBanners_비인증_401() throws Exception {
        mockMvc.perform(get("/api/banners")).andExpect(status().isUnauthorized());
        verifyNoInteractions(bannerService);
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("GET /api/banners - 일반 사용자도 활성 배너를 조회한다")
    void getActiveBanners_일반사용자_200() throws Exception {
        given(bannerService.getActiveBanners()).willReturn(List.of(response(true)));

        mockMvc.perform(get("/api/banners"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].flMpnId").value(FL_MPN_ID))
                .andExpect(jsonPath("$[0].active").value(true))
                .andExpect(jsonPath("$[0].previewUrl").value("/api/files/" + FL_MPN_ID + "/preview"));
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("GET /api/banners/admin - 일반 사용자 → 403")
    void getAllBanners_일반사용자_403() throws Exception {
        mockMvc.perform(get("/api/banners/admin")).andExpect(status().isForbidden());
        verifyNoInteractions(bannerService);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("GET /api/banners/admin - 관리자는 비활성 배너까지 조회한다")
    void getAllBanners_관리자_200() throws Exception {
        given(bannerService.getAllBanners()).willReturn(List.of(response(false)));

        mockMvc.perform(get("/api/banners/admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].active").value(false));
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("POST /api/banners - 일반 사용자 → 403")
    void upload_일반사용자_403() throws Exception {
        MockMultipartFile file =
                new MockMultipartFile("file", "hero.png", "image/png", new byte[] {1});

        mockMvc.perform(multipart("/api/banners").file(file)).andExpect(status().isForbidden());
        verifyNoInteractions(bannerService);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("POST /api/banners - 관리자 업로드 → 201")
    void upload_관리자_201() throws Exception {
        MockMultipartFile file =
                new MockMultipartFile("file", "hero.png", "image/png", new byte[] {1});
        given(bannerService.upload(any())).willReturn(response(true));

        mockMvc.perform(multipart("/api/banners").file(file))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.flMpnId").value(FL_MPN_ID));
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("PATCH /api/banners/{id}/active - 일반 사용자 → 403")
    void setActive_일반사용자_403() throws Exception {
        mockMvc.perform(
                        patch("/api/banners/" + FL_MPN_ID + "/active")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"active\":false}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(bannerService);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("PATCH /api/banners/{id}/active - 관리자 비활성화 → 200")
    void setActive_관리자_200() throws Exception {
        given(bannerService.setActive(anyString(), anyBoolean())).willReturn(response(false));

        mockMvc.perform(
                        patch("/api/banners/" + FL_MPN_ID + "/active")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"active\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(false));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("PATCH /api/banners/{id}/active - active 누락 → 400")
    void setActive_active누락_400() throws Exception {
        mockMvc.perform(
                        patch("/api/banners/" + FL_MPN_ID + "/active")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(bannerService);
    }
}
```

**확인 완료:** `TestSecurityConfig`는 `csrf().disable()`이므로 `with(csrf())`가 필요 없다. 또한 `@EnableMethodSecurity`가 없어 `@PreAuthorize`가 꺼져 있으므로, 위처럼 중첩 `MethodSecurityTestConfig`를 `@Import`해야 403 테스트가 성립한다 (`RealtimeLogControllerTest`와 같은 패턴). `CustomGeneralException`은 `GlobalExceptionHandler`가 400으로, `AccessDeniedException`은 403으로 매핑한다.

- [ ] **Step 2: 범용 파일 API의 배너 차단 회귀 테스트 추가**

`it_backend/src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java` 끝에 추가한다. 기존 테스트에서 쓰는 mock·헬퍼를 그대로 재사용한다:

```java
    @Test
    @WithMockUser(roles = "ADMIN")
    @DisplayName("DELETE /api/files/{id} - 배너 파일은 범용 API로 삭제할 수 없다 → 403")
    void deleteFile_배너파일_403() throws Exception {
        doNothing().when(fileOwnershipChecker).verifyWriteAccess(anyString(), any());
        doThrow(new org.springframework.security.access.AccessDeniedException(
                        "보호된 파일 종류는 generic 파일 API로 변경할 수 없습니다: 배너"))
                .when(fileService)
                .deleteFile(anyString());

        mockMvc.perform(delete("/api/files/" + FL_MNG_NO)).andExpect(status().isForbidden());
    }
```

**확인 완료:** `TestSecurityConfig`가 CSRF를 끄므로 `with(csrf())`는 쓰지 않는다.

- [ ] **Step 3: 테스트 실행해 실패 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --no-daemon --tests '*BannerControllerTest'
```

Expected: 컴파일 실패 — `BannerController` 심볼을 찾을 수 없음.

- [ ] **Step 4: 컨트롤러 구현**

`it_backend/src/main/java/com/kdb/it/domain/banner/controller/BannerController.java`:

```java
package com.kdb.it.domain.banner.controller;

import com.kdb.it.domain.banner.dto.BannerDto;
import com.kdb.it.domain.banner.service.BannerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * /info 홈 배너 REST 컨트롤러
 *
 * <p>기본 URL: {@code /api/banners}
 *
 * <p>배너는 전용 테이블 없이 공통첨부파일기본(TPRMPP_CFILEM)을 재사용하며,
 * {@code PK_COL_NM='배너'}·{@code PK_CONE='/info'} 규약은 {@link BannerService}가 강제한다.
 *
 * <p>보안: 활성 배너 조회는 인증 사용자 전체, 나머지는 관리자 전용이다.
 */
@RestController
@RequestMapping("/api/banners")
@RequiredArgsConstructor
@Validated
@Tag(name = "Banner", description = "/info 홈 배너 API")
public class BannerController {

    private final BannerService bannerService;

    /**
     * 홈 캐러셀에 노출할 활성 배너를 조회합니다.
     *
     * @return 업로드 순 활성 배너 목록. 배너가 없으면 빈 배열
     */
    @GetMapping
    @Operation(
            summary = "활성 배너 목록 조회",
            description = "DEL_YN='N'인 배너를 파일매핑ID 오름차순(업로드 순)으로 조회합니다. 인증 사용자 전체가 조회할 수 있습니다.")
    public ResponseEntity<List<BannerDto.Response>> getActiveBanners() {
        return ResponseEntity.ok(bannerService.getActiveBanners());
    }

    /**
     * 관리 화면용으로 활성·비활성 배너를 모두 조회합니다.
     *
     * @return 파일매핑ID 오름차순 전체 배너 목록
     */
    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "전체 배너 목록 조회 (관리자)",
            description = "비활성(DEL_YN='Y') 배너를 포함해 전체를 조회합니다.")
    public ResponseEntity<List<BannerDto.Response>> getAllBanners() {
        return ResponseEntity.ok(bannerService.getAllBanners());
    }

    /**
     * 배너 이미지를 업로드합니다.
     *
     * @param file 업로드할 이미지 파일 (jpg·jpeg·png·gif)
     * @return 생성된 배너 정보
     * @throws com.kdb.it.exception.CustomGeneralException 허용 이미지 확장자가 아닌 경우
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "배너 업로드 (관리자)",
            description =
                    "multipart/form-data로 배너 이미지 1개를 업로드합니다. "
                            + "주식별자컬럼명('배너')·주식별자내용('/info')·파일유형내용('이미지')은 서버가 고정합니다. "
                            + "허용 확장자는 jpg, jpeg, png, gif입니다.")
    public ResponseEntity<BannerDto.Response> upload(
            @Parameter(description = "업로드할 배너 이미지", required = true) @RequestPart("file")
                    MultipartFile file) {
        BannerDto.Response response = bannerService.upload(file);
        return ResponseEntity.created(URI.create("/api/banners/" + response.getFlMpnId()))
                .body(response);
    }

    /**
     * 배너 활성 상태를 변경합니다.
     *
     * @param flMpnId 배너 파일매핑ID
     * @param request 활성 여부 요청
     * @return 변경된 배너 정보
     * @throws com.kdb.it.exception.CustomGeneralException 해당 배너가 없는 경우
     * @throws org.springframework.security.access.AccessDeniedException 대상이 배너가 아닌 경우
     */
    @PatchMapping("/{flMpnId}/active")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(
            summary = "배너 활성 상태 변경 (관리자)",
            description =
                    "active=true면 DEL_YN='N'으로 복원해 홈에 노출하고, false면 'Y'로 비활성화해 감춥니다. "
                            + "물리 파일은 어느 쪽에서도 삭제하지 않습니다.")
    public ResponseEntity<BannerDto.Response> setActive(
            @PathVariable("flMpnId") String flMpnId,
            @RequestBody @NotNull BannerDto.ActiveRequest request) {
        if (request.getActive() == null) {
            throw new com.kdb.it.exception.CustomGeneralException("활성 여부(active)는 필수입니다.");
        }
        return ResponseEntity.ok(bannerService.setActive(flMpnId, request.getActive()));
    }
}
```

**확인 완료:** `GlobalExceptionHandler`가 `CustomGeneralException`을 400으로 매핑하므로 위 구현대로 `active` 누락 시 400이 나온다.

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --no-daemon --tests '*BannerControllerTest' --tests '*FileControllerTest'
```

Expected: PASS.

- [ ] **Step 6: 백엔드 전체 테스트 실행**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --no-daemon
```

Expected: BUILD SUCCESSFUL. 실패가 있으면 배너 변경과의 인과관계를 확인한 뒤 고친다.

- [ ] **Step 7: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/banner/controller/BannerController.java src/test/java/com/kdb/it/domain/banner/controller/BannerControllerTest.java src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java && git diff --cached --stat
```

```bash
cd C:/it/it_backend && git commit -m "feat: 배너 REST API(/api/banners) 추가 — 조회·업로드·활성 토글"
```

---

## Task 5: useBanners composable

**Files:**
- Create: `it_frontend/app/composables/useBanners.ts`
- Test: `it_frontend/tests/unit/composables/useBanners.test.ts`

**Interfaces:**
- Consumes: Task 4의 HTTP 계약, 기존 `useApiFetch`·`useNuxtApp().$apiFetch`·`useRuntimeConfig().public.apiBase`
- Produces:
  - `export interface BannerRecord { flMpnId: string; flNm: string; apgFlSz: number | null; active: boolean; previewUrl: string; fstEnrDtm: string; fstEnrUsid: string; }`
  - `useBanners()` 반환:
    - `fetchActiveBanners(): ReturnType<typeof useApiFetch<BannerRecord[]>>`
    - `fetchAllBanners(): ReturnType<typeof useApiFetch<BannerRecord[]>>`
    - `uploadBanner(file: File): Promise<BannerRecord>`
    - `setBannerActive(flMpnId: string, active: boolean): Promise<BannerRecord>`
    - `getPreviewUrl(banner: BannerRecord): string`

  Task 6·7이 이 시그니처에 의존한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`it_frontend/tests/unit/composables/useBanners.test.ts`:

```typescript
/**
 * ============================================================================
 * [tests/unit/composables/useBanners.test.ts] 배너 API Composable 단위 테스트
 * ============================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useBanners } from '~/composables/useBanners';

const mockApiFetch = vi.fn();
const mockUseApiFetch = vi.fn();

vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: mockApiFetch }));
vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBase: 'http://localhost:28080' },
}));
vi.stubGlobal('useApiFetch', mockUseApiFetch);

const BASE = 'http://localhost:28080/api/banners';

describe('useBanners', () => {
    beforeEach(() => {
        mockApiFetch.mockReset();
        mockUseApiFetch.mockReset();
        mockUseApiFetch.mockReturnValue({ data: null, pending: false, error: null });
    });

    it('fetchActiveBanners: 활성 배너를 조회하고 404를 토스트로 알리지 않는다', () => {
        const { fetchActiveBanners } = useBanners();
        fetchActiveBanners();
        expect(mockUseApiFetch).toHaveBeenCalledWith(BASE, { suppressNotFound: true });
    });

    it('fetchAllBanners: 관리자용 전체 목록을 조회한다', () => {
        const { fetchAllBanners } = useBanners();
        fetchAllBanners();
        expect(mockUseApiFetch).toHaveBeenCalledWith(`${BASE}/admin`);
    });

    it('uploadBanner: multipart FormData의 file 파트로 POST한다', async () => {
        mockApiFetch.mockResolvedValue({ flMpnId: 'FL-00000001' });
        const { uploadBanner } = useBanners();
        const file = new File(['x'], 'hero.png', { type: 'image/png' });

        const result = await uploadBanner(file);

        expect(result).toEqual({ flMpnId: 'FL-00000001' });
        const [url, options] = mockApiFetch.mock.calls[0];
        expect(url).toBe(BASE);
        expect(options.method).toBe('POST');
        expect(options.body).toBeInstanceOf(FormData);
        expect((options.body as FormData).get('file')).toBe(file);
    });

    it('setBannerActive: PATCH로 활성 여부를 보낸다', async () => {
        mockApiFetch.mockResolvedValue({ flMpnId: 'FL-00000001', active: false });
        const { setBannerActive } = useBanners();

        await setBannerActive('FL-00000001', false);

        expect(mockApiFetch).toHaveBeenCalledWith(`${BASE}/FL-00000001/active`, {
            method: 'PATCH',
            body: { active: false },
        });
    });

    it('getPreviewUrl: 서버가 준 상대 경로 앞에 API 베이스를 붙인다', () => {
        const { getPreviewUrl } = useBanners();
        expect(
            getPreviewUrl({
                flMpnId: 'FL-00000001',
                flNm: 'hero.png',
                apgFlSz: 1,
                active: true,
                previewUrl: '/api/files/FL-00000001/preview',
                fstEnrDtm: '2026-08-19T09:00:00',
                fstEnrUsid: 'E001',
            }),
        ).toBe('http://localhost:28080/api/files/FL-00000001/preview');
    });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useBanners.test.ts
```

Expected: FAIL — `~/composables/useBanners` 모듈을 찾을 수 없음.

- [ ] **Step 3: composable 구현**

`it_frontend/app/composables/useBanners.ts`:

```typescript
/**
 * ============================================================================
 * [composables/useBanners.ts] /info 홈 배너 API Composable
 * ============================================================================
 * /api/banners 엔드포인트를 감쌉니다. 배너는 전용 테이블 없이 공통첨부파일기본
 * (TPRMPP_CFILEM)을 재사용하며 PK_COL_NM='배너' / PK_CONE='/info' 규약은 서버가 고정합니다.
 *
 * [API 엔드포인트]
 *  GET   /api/banners                      - 활성 배너 목록 (인증 사용자 전체)
 *  GET   /api/banners/admin                - 활성·비활성 전체 목록 (관리자)
 *  POST  /api/banners                      - 배너 업로드 (관리자, multipart/form-data)
 *  PATCH /api/banners/{flMpnId}/active     - 활성 상태 변경 (관리자)
 *
 * [활성 상태]
 *  active=true  → DEL_YN='N' (홈 캐러셀 노출)
 *  active=false → DEL_YN='Y' (숨김, 물리 파일은 유지)
 * ============================================================================
 */

/** 배너 응답 타입 — 백엔드 BannerDto.Response 매핑 */
export interface BannerRecord {
    flMpnId: string; // 파일매핑ID (PK)
    flNm: string; // 파일명
    apgFlSz: number | null; // 첨부파일크기(바이트), 레거시 파일은 null
    active: boolean; // 활성 여부 (DEL_YN='N'이면 true)
    previewUrl: string; // 미리보기 상대 경로 (예: /api/files/FL-00000001/preview)
    fstEnrDtm: string; // 최초 등록 일시
    fstEnrUsid: string; // 최초 등록 사용자 사번
}

/**
 * 배너 관리 Composable
 *
 * @returns 배너 조회·업로드·활성 토글 함수와 미리보기 URL 헬퍼
 */
export const useBanners = () => {
    const config = useRuntimeConfig();
    const API_BASE = `${config.public.apiBase}/api/banners`;

    const { $apiFetch } = useNuxtApp();

    /**
     * 홈 캐러셀용 활성 배너 목록 조회.
     *
     * 배너가 없는 상태는 정상이므로 404 토스트를 억제합니다.
     */
    const fetchActiveBanners = () =>
        useApiFetch<BannerRecord[]>(API_BASE, { suppressNotFound: true });

    /** 관리 화면용 전체(활성·비활성) 배너 목록 조회. 관리자만 200을 받습니다. */
    const fetchAllBanners = () => useApiFetch<BannerRecord[]>(`${API_BASE}/admin`);

    /**
     * 배너 이미지 업로드 (multipart/form-data).
     *
     * @param file 업로드할 이미지 파일
     * @returns 생성된 배너 정보
     * @throws 허용 확장자(jpg·jpeg·png·gif)가 아니거나 권한이 없으면 예외를 전파합니다.
     */
    const uploadBanner = async (file: File): Promise<BannerRecord> => {
        const formData = new FormData();
        formData.append('file', file);

        return await $apiFetch<BannerRecord>(API_BASE, {
            method: 'POST',
            body: formData,
        });
    };

    /**
     * 배너 활성 상태 변경.
     *
     * @param flMpnId 배너 파일매핑ID
     * @param active true면 홈에 노출, false면 숨김
     * @returns 변경된 배너 정보
     * @throws 배너가 없거나 관리자가 아니면 예외를 전파합니다.
     */
    const setBannerActive = async (flMpnId: string, active: boolean): Promise<BannerRecord> =>
        await $apiFetch<BannerRecord>(`${API_BASE}/${flMpnId}/active`, {
            method: 'PATCH',
            body: { active },
        });

    /** 서버가 준 미리보기 상대 경로에 API 베이스를 붙여 절대 URL을 만든다. */
    const getPreviewUrl = (banner: BannerRecord): string =>
        `${config.public.apiBase}${banner.previewUrl}`;

    return {
        fetchActiveBanners,
        fetchAllBanners,
        uploadBanner,
        setBannerActive,
        getPreviewUrl,
    };
};
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useBanners.test.ts
```

Expected: PASS (5개 테스트).

- [ ] **Step 5: 커밋**

```bash
cd C:/it/it_frontend && git rev-parse --abbrev-ref HEAD
```

```bash
cd C:/it/it_frontend && git add app/composables/useBanners.ts tests/unit/composables/useBanners.test.ts && git diff --cached --stat
```

```bash
cd C:/it/it_frontend && git commit -m "feat: 배너 API composable(useBanners) 추가"
```

---

## Task 6: 배너 캐러셀 컴포넌트

**Files:**
- Create: `it_frontend/app/components/info/InfoBannerCarousel.vue`
- Modify: `it_frontend/i18n/messages/info.ts` (ko·en 양쪽에 키 추가)
- Test: `it_frontend/tests/unit/components/InfoBannerCarousel.test.ts`

**Interfaces:**
- Consumes: `useBanners()` (Task 5) — `fetchActiveBanners`, `getPreviewUrl`
- Produces: props 없는 컴포넌트 `InfoBannerCarousel`. Task 10이 `/info` 우측 패널에 배치한다.

**동작 계약:**
- 조회 중: 16:9 스켈레톤 표시
- 활성 배너 0건 또는 조회 실패: **아무것도 렌더하지 않는다** (루트가 `v-if`로 사라짐)
- n건: PrimeVue `Carousel`로 n개 슬라이드, 5000ms 자동 순환
- 개별 이미지 로드 실패(`@error`): 해당 배너를 목록에서 제외

- [ ] **Step 1: i18n 키 추가**

`it_frontend/i18n/messages/info.ts`의 ko `info.dashboard` 블록에 추가:

```typescript
                bannerTitle: '배너',
                bannerAlt: '{name} 배너 이미지',
```

같은 파일 en `info.dashboard` 블록에 추가:

```typescript
                bannerTitle: 'Banners',
                bannerAlt: '{name} banner image',
```

- [ ] **Step 2: 실패하는 테스트 작성**

`it_frontend/tests/unit/components/InfoBannerCarousel.test.ts`:

```typescript
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import InfoBannerCarousel from '~/components/info/InfoBannerCarousel.vue';
import type { BannerRecord } from '~/composables/useBanners';

const banner = (flMpnId: string): BannerRecord => ({
    flMpnId,
    flNm: `${flMpnId}.png`,
    apgFlSz: 1024,
    active: true,
    previewUrl: `/api/files/${flMpnId}/preview`,
    fstEnrDtm: '2026-08-19T09:00:00',
    fstEnrUsid: 'E001',
});

const mockFetchActiveBanners = vi.fn();

vi.mock('~/composables/useBanners', () => ({
    useBanners: () => ({
        fetchActiveBanners: mockFetchActiveBanners,
        getPreviewUrl: (b: BannerRecord) => `http://localhost:28080${b.previewUrl}`,
    }),
}));

vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));

/** Carousel은 슬롯 렌더만 확인하면 되므로 value 배열을 그대로 펼치는 스텁으로 대체한다. */
const CarouselStub = {
    name: 'Carousel',
    props: ['value'],
    template: '<div class="carousel-stub"><slot v-for="item in value" :data="item" /></div>',
};

const mountCarousel = () =>
    mount(InfoBannerCarousel, { global: { stubs: { Carousel: CarouselStub } } });

describe('InfoBannerCarousel', () => {
    beforeEach(() => {
        mockFetchActiveBanners.mockReset();
    });

    it('활성 배너가 없으면 아무것도 렌더하지 않는다', () => {
        mockFetchActiveBanners.mockReturnValue({
            data: ref([]),
            pending: ref(false),
            error: ref(null),
        });

        expect(mountCarousel().find('.carousel-stub').exists()).toBe(false);
        expect(mountCarousel().find('img').exists()).toBe(false);
    });

    it('조회에 실패해도 아무것도 렌더하지 않는다 (홈 진입을 막지 않는다)', () => {
        mockFetchActiveBanners.mockReturnValue({
            data: ref(null),
            pending: ref(false),
            error: ref(new Error('boom')),
        });

        expect(mountCarousel().find('.carousel-stub').exists()).toBe(false);
    });

    it('배너 수만큼 이미지를 렌더하고 미리보기 절대 URL을 쓴다', () => {
        mockFetchActiveBanners.mockReturnValue({
            data: ref([banner('FL-00000001'), banner('FL-00000002')]),
            pending: ref(false),
            error: ref(null),
        });

        const images = mountCarousel().findAll('img');

        expect(images).toHaveLength(2);
        expect(images[0]!.attributes('src')).toBe(
            'http://localhost:28080/api/files/FL-00000001/preview',
        );
    });

    it('이미지 로드에 실패한 배너는 목록에서 제외한다', async () => {
        mockFetchActiveBanners.mockReturnValue({
            data: ref([banner('FL-00000001'), banner('FL-00000002')]),
            pending: ref(false),
            error: ref(null),
        });

        const wrapper = mountCarousel();
        await wrapper.findAll('img')[0]!.trigger('error');

        const images = wrapper.findAll('img');
        expect(images).toHaveLength(1);
        expect(images[0]!.attributes('src')).toBe(
            'http://localhost:28080/api/files/FL-00000002/preview',
        );
    });

    it('조회 중에는 스켈레톤을 표시한다', () => {
        mockFetchActiveBanners.mockReturnValue({
            data: ref(null),
            pending: ref(true),
            error: ref(null),
        });

        const wrapper = mountCarousel();
        expect(wrapper.find('[data-testid="banner-skeleton"]').exists()).toBe(true);
        expect(wrapper.find('img').exists()).toBe(false);
    });
});
```

- [ ] **Step 3: 테스트 실행해 실패 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/InfoBannerCarousel.test.ts
```

Expected: FAIL — `~/components/info/InfoBannerCarousel.vue`를 찾을 수 없음.

- [ ] **Step 4: 컴포넌트 구현**

`it_frontend/app/components/info/InfoBannerCarousel.vue`:

```vue
<!--
================================================================================
[components/info/InfoBannerCarousel.vue] /info 홈 배너 캐러셀
================================================================================
관리자가 /admin/banners에서 올린 활성 배너 이미지를 순차 전환합니다.

[표시 규칙]
  - 조회 중          : 16:9 스켈레톤
  - 활성 배너 0건    : 아무것도 렌더하지 않는다 (빈 카드를 홈에 남기지 않음)
  - 조회 실패        : 아무것도 렌더하지 않는다 (배너 때문에 홈 진입을 막지 않음)
  - 이미지 로드 실패 : 해당 배너만 목록에서 제외

[데이터]
  GET /api/banners → DEL_YN='N' AND PK_COL_NM='배너' AND PK_CONE='/info'
  정렬은 서버가 파일매핑ID 오름차순(업로드 순)으로 보장한다.
================================================================================
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useBanners, type BannerRecord } from '~/composables/useBanners';

/** 자동 전환 주기(ms) */
const AUTOPLAY_INTERVAL = 5000;

const { t } = useI18n();
const { fetchActiveBanners, getPreviewUrl } = useBanners();

const { data, pending, error } = fetchActiveBanners();

/** 이미지 로드에 실패해 표시에서 제외할 파일매핑ID */
const brokenIds = ref<string[]>([]);

const banners = computed<BannerRecord[]>(() => {
    if (error.value) return [];
    return (data.value ?? []).filter((banner) => !brokenIds.value.includes(banner.flMpnId));
});

/** 깨진 이미지를 목록에서 제외한다. 남은 배너만 계속 순환한다. */
const handleImageError = (flMpnId: string) => {
    if (!brokenIds.value.includes(flMpnId)) {
        brokenIds.value = [...brokenIds.value, flMpnId];
    }
};
</script>

<template>
    <div
        v-if="pending"
        data-testid="banner-skeleton"
        class="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800"
    >
        <div class="aspect-video w-full animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
    </div>

    <div
        v-else-if="banners.length"
        class="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800"
    >
        <h3 class="font-bold text-lg mb-3 flex items-center gap-2">
            <i class="pi pi-images text-primary-500" />
            {{ t('info.dashboard.bannerTitle') }}
        </h3>
        <Carousel
            :value="banners"
            :num-visible="1"
            :num-scroll="1"
            circular
            :autoplay-interval="AUTOPLAY_INTERVAL"
        >
            <template #item="{ data: banner }">
                <div class="aspect-video w-full overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-800">
                    <img
                        :src="getPreviewUrl(banner)"
                        :alt="t('info.dashboard.bannerAlt', { name: banner.flNm })"
                        class="h-full w-full object-cover"
                        loading="lazy"
                        @error="handleImageError(banner.flMpnId)"
                    />
                </div>
            </template>
        </Carousel>
    </div>
</template>
```

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/InfoBannerCarousel.test.ts
```

Expected: PASS (5개 테스트).

- [ ] **Step 6: 고정 리터럴 감사 통과 확인**

Run:
```bash
cd C:/it/it_frontend && npm run check:copy
```

Expected: 출력 없음 (위반 0건).

- [ ] **Step 7: 커밋**

```bash
cd C:/it/it_frontend && git add app/components/info/InfoBannerCarousel.vue tests/unit/components/InfoBannerCarousel.test.ts i18n/messages/info.ts && git diff --cached --stat
```

```bash
cd C:/it/it_frontend && git commit -m "feat: /info 홈 배너 캐러셀 컴포넌트 추가"
```

---

## Task 7: 배너 관리 화면

**Files:**
- Create: `it_frontend/app/pages/admin/banners.vue`
- Modify: `it_frontend/app/utils/menuPresentation.ts` (`MENU_ICON_OPTIONS`에 항목 1개 추가)
- Modify: `it_frontend/i18n/messages/admin.ts` (ko·en 양쪽에 `admin.banners.*` 추가)

**Interfaces:**
- Consumes: `useBanners()` (Task 5) — `fetchAllBanners`, `uploadBanner`, `setBannerActive`, `getPreviewUrl`. Task 1이 시드한 `/admin/banners` 메뉴가 이 화면으로 연결된다.
- Produces: 라우트 `/admin/banners`. Task 11의 e2e가 이 화면을 검증한다.

- [ ] **Step 1: 메뉴 아이콘 선택지 추가**

`it_frontend/app/utils/menuPresentation.ts`의 `MENU_ICON_OPTIONS` 배열에 항목을 추가한다. 기존 항목의 `labelKey` 명명 규칙을 그대로 따른다 (파일을 먼저 읽고 실제 키 접두어를 확인할 것):

```typescript
    { labelKey: '<기존 항목과 같은 접두어>.images', value: 'pi pi-images' },
```

해당 `labelKey`를 `i18n/messages/admin.ts`의 ko·en 양쪽에 추가한다 (ko: `'이미지'`, en: `'Images'`).

- [ ] **Step 2: i18n 키 추가**

`it_frontend/i18n/messages/admin.ts`의 ko `admin` 블록에 추가:

```typescript
            banners: {
                title: '배너 관리',
                description: '정보화사업 홈(/info) 오른쪽 하단 캐러셀에 노출할 이미지를 관리합니다.',
                upload: '배너 업로드',
                empty: '등록된 배너가 없습니다.',
                preview: '미리보기',
                columns: {
                    thumbnail: '이미지',
                    fileName: '파일명',
                    fileSize: '크기',
                    registeredBy: '등록자',
                    registeredAt: '등록일시',
                    active: '활성',
                },
                toast: {
                    uploadSuccess: '배너를 등록했습니다.',
                    uploadFailed: '배너 등록에 실패했습니다.',
                    activated: '배너를 활성화했습니다.',
                    deactivated: '배너를 비활성화했습니다.',
                    toggleFailed: '배너 상태 변경에 실패했습니다.',
                    invalidExtension: '이미지 파일(jpg, jpeg, png, gif)만 등록할 수 있습니다.',
                },
            },
```

en `admin` 블록에 같은 구조로 추가:

```typescript
            banners: {
                title: 'Banners',
                description: 'Manage the images shown in the carousel on the IT project home page.',
                upload: 'Upload Banner',
                empty: 'No banners registered.',
                preview: 'Preview',
                columns: {
                    thumbnail: 'Image',
                    fileName: 'File Name',
                    fileSize: 'Size',
                    registeredBy: 'Registered By',
                    registeredAt: 'Registered At',
                    active: 'Active',
                },
                toast: {
                    uploadSuccess: 'Banner uploaded.',
                    uploadFailed: 'Failed to upload the banner.',
                    activated: 'Banner activated.',
                    deactivated: 'Banner deactivated.',
                    toggleFailed: 'Failed to change the banner state.',
                    invalidExtension: 'Only image files (jpg, jpeg, png, gif) are allowed.',
                },
            },
```

- [ ] **Step 3: 관리 화면 구현**

`it_frontend/app/pages/admin/banners.vue`:

```vue
<!--
================================================================================
[pages/admin/banners.vue] 배너 관리 페이지
================================================================================
시스템관리자가 /info 홈 캐러셀에 노출할 배너 이미지를 관리하는 화면입니다.

[주요 기능]
  - 배너 업로드 (jpg, jpeg, png, gif)
  - 활성·비활성 전환 (활성=DEL_YN 'N', 비활성='Y')
  - 썸네일 클릭 시 원본 미리보기

[데이터]
  배너는 전용 테이블 없이 TPRMPP_CFILEM을 재사용합니다.
  PK_COL_NM='배너' / PK_CONE='/info' 규약은 서버(BannerService)가 고정합니다.
================================================================================
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import PageHeader from '~/components/common/PageHeader.vue';
import TableCard from '~/components/common/TableCard.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import EmployeeLink from '~/components/common/EmployeeLink.vue';
import { useBanners, type BannerRecord } from '~/composables/useBanners';
import { formatDateTime, formatFileSize } from '~/utils/common';

definePageMeta({ middleware: 'admin' });

/** 배너로 허용하는 확장자 — 서버(BannerService.ALLOWED_IMAGE_EXTENSIONS)와 같은 목록이다. */
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];

const { t } = useI18n();
const toast = useToast();
const { fetchAllBanners, uploadBanner, setBannerActive, getPreviewUrl } = useBanners();

const { data: banners, pending, refresh } = await fetchAllBanners();

const rows = computed<BannerRecord[]>(() => banners.value ?? []);

/** 숨김 file input — [배너 업로드] 버튼이 대신 연다 */
const fileInputRef = ref<HTMLInputElement | null>(null);

/** 미리보기 다이얼로그 상태 */
const previewTarget = ref<BannerRecord | null>(null);
const previewVisible = computed({
    get: () => previewTarget.value !== null,
    set: (value: boolean) => {
        if (!value) previewTarget.value = null;
    },
});

/** 확장자가 허용 목록에 있는지 확인한다. 서버 거절 전에 사용자에게 먼저 알린다. */
const hasAllowedExtension = (name: string) => {
    const dot = name.lastIndexOf('.');
    return dot >= 0 && ALLOWED_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
};

/**
 * 선택한 파일을 업로드하고 목록을 갱신한다.
 *
 * 확장자가 허용 목록 밖이면 요청을 보내지 않고 토스트로 알린다.
 */
const handleUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // 같은 파일을 다시 선택해도 change가 발생하도록 초기화
    if (!file) return;

    if (!hasAllowedExtension(file.name)) {
        toast.add({
            severity: 'warn',
            summary: t('admin.banners.toast.invalidExtension'),
            life: 3000,
        });
        return;
    }

    try {
        await uploadBanner(file);
        toast.add({
            severity: 'success',
            summary: t('admin.banners.toast.uploadSuccess'),
            life: 3000,
        });
        await refresh();
    } catch {
        toast.add({ severity: 'error', summary: t('admin.banners.toast.uploadFailed'), life: 3000 });
    }
};

/**
 * 활성 상태를 전환하고 목록을 갱신한다.
 *
 * 실패하면 서버 상태와 어긋나지 않도록 목록을 다시 조회한다.
 */
const handleToggleActive = async (banner: BannerRecord, active: boolean) => {
    try {
        await setBannerActive(banner.flMpnId, active);
        toast.add({
            severity: 'success',
            summary: active
                ? t('admin.banners.toast.activated')
                : t('admin.banners.toast.deactivated'),
            life: 3000,
        });
    } catch {
        toast.add({ severity: 'error', summary: t('admin.banners.toast.toggleFailed'), life: 3000 });
    } finally {
        await refresh();
    }
};
</script>

<template>
    <div class="space-y-6">
        <PageHeader
            :title="t('admin.banners.title')"
            :subtitle="t('admin.banners.description')"
        >
            <template #actions>
                <Button
                    icon="pi pi-upload"
                    :label="t('admin.banners.upload')"
                    @click="fileInputRef?.click()"
                />
            </template>
        </PageHeader>

        <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            class="hidden"
            @change="handleUpload"
        />

        <TableCard>
            <StyledDataTable :value="rows" :loading="pending" data-key="flMpnId">
                <template #empty>{{ t('admin.banners.empty') }}</template>

                <Column :header="t('admin.banners.columns.thumbnail')">
                    <template #body="{ data }">
                        <button
                            type="button"
                            class="h-12 w-20 overflow-hidden rounded border border-zinc-200 dark:border-zinc-700"
                            :title="t('admin.banners.preview')"
                            @click="previewTarget = data"
                        >
                            <img
                                :src="getPreviewUrl(data)"
                                :alt="data.flNm"
                                class="h-full w-full object-cover"
                                loading="lazy"
                            />
                        </button>
                    </template>
                </Column>

                <Column field="flNm" :header="t('admin.banners.columns.fileName')" />

                <Column :header="t('admin.banners.columns.fileSize')">
                    <template #body="{ data }">{{ formatFileSize(data.apgFlSz) }}</template>
                </Column>

                <Column :header="t('admin.banners.columns.registeredBy')">
                    <template #body="{ data }">
                        <EmployeeLink :eno="data.fstEnrUsid" />
                    </template>
                </Column>

                <Column :header="t('admin.banners.columns.registeredAt')">
                    <template #body="{ data }">{{ formatDateTime(data.fstEnrDtm) }}</template>
                </Column>

                <Column :header="t('admin.banners.columns.active')">
                    <template #body="{ data }">
                        <ToggleSwitch
                            :model-value="data.active"
                            @update:model-value="handleToggleActive(data, $event)"
                        />
                    </template>
                </Column>
            </StyledDataTable>
        </TableCard>

        <Dialog
            v-model:visible="previewVisible"
            modal
            :header="previewTarget?.flNm"
            :style="{ width: '48rem', maxWidth: '90vw' }"
        >
            <img
                v-if="previewTarget"
                :src="getPreviewUrl(previewTarget)"
                :alt="previewTarget.flNm"
                class="w-full rounded"
            />
        </Dialog>
    </div>
</template>
```

**확인 완료:**
- `PageHeader` props는 `title?`·`subtitle?`이며 `description`은 없다. 액션 슬롯 이름은 `actions`가 맞다.
- `TableCard` props는 `title?`·`subtitle?`·`icon?`·`count?`·`fill?`이다. 위 코드처럼 props 없이 감싸도 된다.
- `formatFileSize`는 `app/utils/common.ts:410`에 있다 (`bytes: number | null | undefined` → `string`).
- `StyledDataTable`은 PrimeVue `DataTable` 속성을 그대로 전달받는다. `value`·`loading`·`data-key`는 통과한다.
- 그 밖의 사용법은 `it_frontend/docs/guides/components/`와 `app/components/common/README.md`를 따른다.

- [ ] **Step 4: 타입 검사·린트·포맷 확인**

Run:
```bash
cd C:/it/it_frontend && npm run check
```

Expected: 오류 없음. `Column`·`Dialog`·`Button`·`ToggleSwitch`는 PrimeVue Nuxt 모듈이 자동 임포트한다.

- [ ] **Step 5: 고정 리터럴 감사 통과 확인**

Run:
```bash
cd C:/it/it_frontend && npm run check:copy
```

Expected: 출력 없음.

- [ ] **Step 6: 실제 화면 확인**

`.claude/launch.json`에 프론트 dev 서버 설정이 없으면 추가한 뒤, preview로 `/admin/banners`에 접속해 업로드 → 목록 노출 → 비활성 → 재활성 흐름을 확인한다. 백엔드가 기동되어 있어야 한다.

Expected: 업로드한 이미지가 썸네일로 보이고, 토글이 즉시 반영되며, 콘솔 오류가 없다.

- [ ] **Step 7: 커밋**

```bash
cd C:/it/it_frontend && git add app/pages/admin/banners.vue app/utils/menuPresentation.ts i18n/messages/admin.ts && git diff --cached --stat
```

```bash
cd C:/it/it_frontend && git commit -m "feat: 배너 관리 화면(/admin/banners) 추가"
```

---

## Task 8: 연도별 대시보드 집계 composable

**Files:**
- Create: `it_frontend/app/composables/useInfoDashboardYear.ts`
- Test: `it_frontend/tests/unit/composables/useInfoDashboardYear.test.ts`

**Interfaces:**
- Consumes: `useProjects().fetchProjects(query?: Record<string,string>)`, `useCost().fetchCosts(query?: Record<string,string>)`, `filterDashboardItemsByScope`, `buildInfoDashboardSummary`, `type InfoDashboardScope`, `type InfoDashboardSummary` (모두 기존, 변경하지 않음)
- Produces:

```typescript
export interface InfoDashboardYearData {
    /** 정보화사업(odnYn='N') 원본 목록 */
    projects: ComputedRef<Project[]>;
    /** 경상사업(odnYn='Y') 원본 목록 */
    ordinaryProjects: ComputedRef<Project[]>;
    /** 부서 범위로 필터링한 정보화사업 */
    departmentProjects: ComputedRef<Project[]>;
    /** 부서 범위로 필터링한 경상사업 */
    departmentOrdinaryProjects: ComputedRef<Project[]>;
    /** 조회 범위별 KPI 집계 */
    summaries: ComputedRef<Record<InfoDashboardScope, InfoDashboardSummary>>;
}

export function useInfoDashboardYear(
    year: string,
    options: {
        departmentCode: Ref<string | undefined> | ComputedRef<string | undefined>;
        isAdmin: Ref<boolean> | ComputedRef<boolean>;
    },
): InfoDashboardYearData
```

  Task 10이 올해·내년 각각 한 번씩 호출한다.

**배경:** 기존 `info/index.vue`의 `departmentProjects`·`departmentOrdinaryProjects`·`departmentCosts`·`dashboardSummaries` 로직을 그대로 옮긴다. 집계 규칙은 바꾸지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

`it_frontend/tests/unit/composables/useInfoDashboardYear.test.ts`:

```typescript
import { computed, ref } from 'vue';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockFetchProjects = vi.fn();
const mockFetchCosts = vi.fn();

vi.mock('~/composables/useProjects', () => ({
    useProjects: () => ({ fetchProjects: mockFetchProjects }),
}));
vi.mock('~/composables/useCost', () => ({
    useCost: () => ({ fetchCosts: mockFetchCosts }),
}));

const { useInfoDashboardYear } = await import('~/composables/useInfoDashboardYear');

/** 집계에 필요한 최소 필드만 담은 사업 스텁 */
const project = (over: Record<string, unknown> = {}) => ({
    abusMngNo: 'PRJ-1',
    abusNm: '사업',
    stsTc: '100',
    svnDpmC: 'D001',
    totRqmAmt: 1_000_000,
    assetBg: 600_000,
    costBg: 400_000,
    ...over,
});

describe('useInfoDashboardYear', () => {
    beforeEach(() => {
        mockFetchProjects.mockReset();
        mockFetchCosts.mockReset();
        mockFetchCosts.mockReturnValue({ data: ref([]) });
    });

    it('정보화사업·경상사업·전산업무비를 해당 연도로 조회한다', () => {
        mockFetchProjects.mockReturnValue({ data: ref([]) });

        useInfoDashboardYear('2027', {
            departmentCode: computed(() => 'D001'),
            isAdmin: computed(() => false),
        });

        expect(mockFetchProjects).toHaveBeenCalledWith({ bseYy: '2027', odnYn: 'N' });
        expect(mockFetchProjects).toHaveBeenCalledWith({ bseYy: '2027', odnYn: 'Y' });
        expect(mockFetchCosts).toHaveBeenCalledWith({ bseYy: '2027' });
    });

    it('부서 범위 집계는 사용자 부서 사업만 센다', () => {
        mockFetchProjects
            .mockReturnValueOnce({
                data: ref([project({ svnDpmC: 'D001' }), project({ svnDpmC: 'D999' })]),
            })
            .mockReturnValueOnce({ data: ref([]) });

        const { summaries } = useInfoDashboardYear('2026', {
            departmentCode: computed(() => 'D001'),
            isAdmin: computed(() => false),
        });

        expect(summaries.value.department.projectCount).toBe(1);
    });

    it('관리자의 전체 범위 집계는 모든 부서 사업을 센다', () => {
        mockFetchProjects
            .mockReturnValueOnce({
                data: ref([project({ svnDpmC: 'D001' }), project({ svnDpmC: 'D999' })]),
            })
            .mockReturnValueOnce({ data: ref([]) });

        const { summaries } = useInfoDashboardYear('2026', {
            departmentCode: computed(() => 'D001'),
            isAdmin: computed(() => true),
        });

        expect(summaries.value.all.projectCount).toBe(2);
    });

    it('데이터가 없으면 집계가 0이다', () => {
        mockFetchProjects.mockReturnValue({ data: ref(null) });
        mockFetchCosts.mockReturnValue({ data: ref(null) });

        const { summaries } = useInfoDashboardYear('2027', {
            departmentCode: computed(() => 'D001'),
            isAdmin: computed(() => false),
        });

        expect(summaries.value.department.totalCount).toBe(0);
        expect(summaries.value.department.requestBudget).toBe(0);
    });
});
```

**주의:** `useProjects`·`useCost` mock은 `vi.mock` 호이스팅 때문에 `useInfoDashboardYear`를 동적 `await import`로 불러온다. 기존 테스트 중 같은 패턴을 쓰는 파일이 있으면 그쪽 형태에 맞춘다. `filterDashboardItemsByScope`는 `isAdmin && scope==='all'`일 때만 전체를 돌려주고 그 외에는 부서로 거르므로, 위 두 번째·세 번째 테스트의 기대값은 실제 동작과 맞다 (확인 완료).

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useInfoDashboardYear.test.ts
```

Expected: FAIL — 모듈을 찾을 수 없음.

- [ ] **Step 3: composable 구현**

`it_frontend/app/composables/useInfoDashboardYear.ts`:

```typescript
/**
 * ============================================================================
 * [composables/useInfoDashboardYear.ts] 연도별 사업·예산 집계 Composable
 * ============================================================================
 * /info 홈 KPI 카드가 쓰는 한 연도치 데이터를 조회하고 조회 범위(부서/전체)별로
 * 집계합니다. 올해·내년 카드가 같은 로직을 공유하도록 연도를 인자로 받습니다.
 *
 * 집계 규칙 자체는 utils/infoDashboardSummary.ts가 소유하며 이 파일은 조회와
 * 범위 필터링만 담당합니다.
 * ============================================================================
 */
import { computed, type ComputedRef, type Ref } from 'vue';
import { useCost, type ItCost } from '~/composables/useCost';
import { useProjects, type Project } from '~/composables/useProjects';
import { filterDashboardItemsByScope, type InfoDashboardScope } from '~/utils/infoDashboardScope';
import {
    buildInfoDashboardSummary,
    type InfoDashboardSummary,
} from '~/utils/infoDashboardSummary';

/** 한 연도의 조회 결과와 범위별 집계 */
export interface InfoDashboardYearData {
    projects: ComputedRef<Project[]>;
    ordinaryProjects: ComputedRef<Project[]>;
    departmentProjects: ComputedRef<Project[]>;
    departmentOrdinaryProjects: ComputedRef<Project[]>;
    summaries: ComputedRef<Record<InfoDashboardScope, InfoDashboardSummary>>;
}

/**
 * 연도 하나의 정보화사업·경상사업·전산업무비를 조회하고 범위별 KPI를 집계합니다.
 *
 * @param year 기준연도 (YYYY)
 * @param options.departmentCode 현재 사용자의 부서코드. 부서 범위 필터에 사용
 * @param options.isAdmin 관리자 여부. 전체 범위 조회 허용 여부를 결정
 * @returns 원본 목록·부서 범위 목록과 `department`·`all` 두 범위의 집계
 */
export function useInfoDashboardYear(
    year: string,
    options: {
        departmentCode: Ref<string | undefined> | ComputedRef<string | undefined>;
        isAdmin: Ref<boolean> | ComputedRef<boolean>;
    },
): InfoDashboardYearData {
    const { fetchProjects } = useProjects();
    const { fetchCosts } = useCost();

    const { data: projectData } = fetchProjects({ bseYy: year, odnYn: 'N' });
    const { data: ordinaryData } = fetchProjects({ bseYy: year, odnYn: 'Y' });
    const { data: costData } = fetchCosts({ bseYy: year });

    const projects = computed<Project[]>(() => projectData.value ?? []);
    const ordinaryProjects = computed<Project[]>(() => ordinaryData.value ?? []);
    const costs = computed<ItCost[]>(() => costData.value ?? []);

    const departmentProjects = computed(() =>
        filterDashboardItemsByScope(projects.value, {
            departmentCode: options.departmentCode.value,
            isAdmin: options.isAdmin.value,
            scope: 'department',
            departmentCodeOf: (project) => project.svnDpmC,
        }),
    );
    const departmentOrdinaryProjects = computed(() =>
        filterDashboardItemsByScope(ordinaryProjects.value, {
            departmentCode: options.departmentCode.value,
            isAdmin: options.isAdmin.value,
            scope: 'department',
            departmentCodeOf: (project) => project.svnDpmC,
        }),
    );
    const departmentCosts = computed(() =>
        filterDashboardItemsByScope(costs.value, {
            departmentCode: options.departmentCode.value,
            isAdmin: options.isAdmin.value,
            scope: 'department',
            departmentCodeOf: (cost) => cost.costSvnDpmC,
        }),
    );

    const summaries = computed(() => {
        const result = {} as Record<InfoDashboardScope, InfoDashboardSummary>;
        for (const scope of ['department', 'all'] as const) {
            // 전체 범위는 관리자에게만 의미가 있다. 비관리자는 항상 부서 범위로 집계한다.
            const useAll = scope === 'all' && options.isAdmin.value;
            result[scope] = buildInfoDashboardSummary({
                projects: useAll ? projects.value : departmentProjects.value,
                ordinaryProjects: useAll
                    ? ordinaryProjects.value
                    : departmentOrdinaryProjects.value,
                costs: useAll ? costs.value : departmentCosts.value,
            });
        }
        return result;
    });

    return {
        projects,
        ordinaryProjects,
        departmentProjects,
        departmentOrdinaryProjects,
        summaries,
    };
}
```

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/composables/useInfoDashboardYear.test.ts
```

Expected: PASS (4개 테스트).

- [ ] **Step 5: 기존 집계 함수 회귀 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/utils/infoDashboardSummary.test.ts
```

Expected: PASS. `infoDashboardSummary.ts`는 변경하지 않았으므로 그대로 통과해야 한다.

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_frontend && git add app/composables/useInfoDashboardYear.ts tests/unit/composables/useInfoDashboardYear.test.ts && git diff --cached --stat
```

```bash
cd C:/it/it_frontend && git commit -m "refactor: /info 연도별 사업·예산 집계를 useInfoDashboardYear로 추출"
```

---

## Task 9: KPI 카드 컴포넌트 2종

**Files:**
- Create: `it_frontend/app/components/info/InfoKpiCountCard.vue`
- Create: `it_frontend/app/components/info/InfoKpiBudgetCard.vue`
- Test: `it_frontend/tests/unit/components/InfoKpiCards.test.ts`

**Interfaces:**
- Consumes: `InfoDashboardScopeToggle` (기존), `formatBudget` (기존 `~/utils/common`)
- Produces:

```typescript
/** 세그먼트 막대 한 칸 */
interface KpiSegment {
    /** 범례 라벨 (호출자가 t()로 번역해 넘긴다) */
    label: string;
    /** 표시 수치 */
    value: number;
    /** 막대·범례 점 색상 Tailwind 클래스 (예: 'bg-indigo-600') */
    colorClass: string;
}

// InfoKpiCountCard props
{
    icon: string;              // 예: 'pi pi-calendar'
    iconClass: string;         // 배지 배경·글자색 Tailwind 클래스
    title: string;             // 번역된 카드 제목
    total: number;             // 큰 숫자
    unitLabel: string;         // 번역된 단위 (예: '건')
    segments: KpiSegment[];    // 비율 막대 + 범례
    showScopeToggle: boolean;  // 관리자에게만 true
}
// v-model:scope → InfoDashboardScope

// InfoKpiBudgetCard props
{
    icon: string;
    iconClass: string;
    title: string;
    requestBudget: number;     // 신청액 (원 단위, 컴포넌트가 억원으로 표시)
    allocatedBudget: number;   // 편성액
    allocatedLead: string;     // 번역된 접두 문구
    allocatedTrail: string;    // 번역된 접미 문구
    segments: KpiSegment[];    // 자본예산·일반관리비 구성비 (value는 %)
    showScopeToggle: boolean;
}
// v-model:scope → InfoDashboardScope
```

  Task 10이 이 props에 값을 주입한다.

**배경:** `info/index.vue`는 781줄이고 800줄 상한(`MAX_NEW_FILE_LINES`)에 근접했다. 내년 카드 2개를 인라인으로 추가하면 상한을 넘고 `OVERSIZED_FILE_BASELINES` 예외 등재도 허용되지 않는다. 추출이 선행 조건이다.

- [ ] **Step 1: 실패하는 테스트 작성**

`it_frontend/tests/unit/components/InfoKpiCards.test.ts`:

```typescript
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import InfoKpiCountCard from '~/components/info/InfoKpiCountCard.vue';
import InfoKpiBudgetCard from '~/components/info/InfoKpiBudgetCard.vue';

vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));

const stubs = { InfoDashboardScopeToggle: true };

describe('InfoKpiCountCard', () => {
    const mountCard = (props: Record<string, unknown> = {}) =>
        mount(InfoKpiCountCard, {
            props: {
                icon: 'pi pi-calendar',
                iconClass: 'bg-indigo-50 text-indigo-600',
                title: '올해 사업',
                total: 10,
                unitLabel: '건',
                segments: [
                    { label: '정보화사업', value: 5, colorClass: 'bg-indigo-600' },
                    { label: '경상사업', value: 3, colorClass: 'bg-indigo-400' },
                    { label: '전산업무비', value: 2, colorClass: 'bg-indigo-200' },
                ],
                showScopeToggle: false,
                scope: 'department',
                ...props,
            },
            global: { stubs },
        });

    it('제목과 총 건수를 표시한다', () => {
        const wrapper = mountCard();
        expect(wrapper.text()).toContain('올해 사업');
        expect(wrapper.text()).toContain('10');
    });

    it('세그먼트 폭을 총합 대비 비율(%)로 계산한다', () => {
        const bars = mountCard().findAll('[data-testid="kpi-segment-bar"]');
        expect(bars).toHaveLength(3);
        expect(bars[0]!.attributes('style')).toContain('width: 50%');
        expect(bars[1]!.attributes('style')).toContain('width: 30%');
        expect(bars[2]!.attributes('style')).toContain('width: 20%');
    });

    it('총합이 0이면 모든 세그먼트 폭이 0%다', () => {
        const bars = mountCard({
            total: 0,
            segments: [{ label: '정보화사업', value: 0, colorClass: 'bg-indigo-600' }],
        }).findAll('[data-testid="kpi-segment-bar"]');
        expect(bars[0]!.attributes('style')).toContain('width: 0%');
    });

    it('세그먼트 범례에 라벨과 값을 함께 표시한다', () => {
        expect(mountCard().text()).toContain('정보화사업');
        expect(mountCard().text()).toContain('5');
    });

    it('showScopeToggle=false면 범위 토글을 렌더하지 않는다', () => {
        expect(mountCard().find('info-dashboard-scope-toggle-stub').exists()).toBe(false);
    });

    it('showScopeToggle=true면 범위 토글을 렌더한다', () => {
        expect(
            mountCard({ showScopeToggle: true }).find('info-dashboard-scope-toggle-stub').exists(),
        ).toBe(true);
    });
});

describe('InfoKpiBudgetCard', () => {
    const mountCard = (props: Record<string, unknown> = {}) =>
        mount(InfoKpiBudgetCard, {
            props: {
                icon: 'pi pi-file-edit',
                iconClass: 'bg-amber-100 text-amber-700',
                title: '올해 편성요청 예산',
                requestBudget: 12_300_000_000,
                allocatedBudget: 10_000_000_000,
                allocatedLead: '억원 · 편성',
                allocatedTrail: '억',
                segments: [
                    { label: '자본예산', value: 60, colorClass: 'bg-amber-500' },
                    { label: '일반관리비', value: 40, colorClass: 'bg-amber-300' },
                ],
                showScopeToggle: false,
                scope: 'department',
                ...props,
            },
            global: { stubs },
        });

    it('제목과 구성비 라벨을 표시한다', () => {
        const wrapper = mountCard();
        expect(wrapper.text()).toContain('올해 편성요청 예산');
        expect(wrapper.text()).toContain('자본예산');
        expect(wrapper.text()).toContain('60');
    });

    it('구성비 세그먼트 폭을 퍼센트 값 그대로 쓴다', () => {
        const bars = mountCard().findAll('[data-testid="kpi-segment-bar"]');
        expect(bars[0]!.attributes('style')).toContain('width: 60%');
        expect(bars[1]!.attributes('style')).toContain('width: 40%');
    });

    it('예산이 0이어도 렌더에 실패하지 않는다', () => {
        const wrapper = mountCard({
            requestBudget: 0,
            allocatedBudget: 0,
            segments: [{ label: '자본예산', value: 0, colorClass: 'bg-amber-500' }],
        });
        expect(wrapper.findAll('[data-testid="kpi-segment-bar"]')[0]!.attributes('style')).toContain(
            'width: 0%',
        );
    });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/InfoKpiCards.test.ts
```

Expected: FAIL — 두 컴포넌트를 찾을 수 없음.

- [ ] **Step 3: 건수형 카드 구현**

`<script setup>`은 `export interface`를 지원하지 않으므로 `KpiSegment`는 먼저 공유 타입 파일
`it_frontend/app/types/infoDashboard.ts`로 만들고 두 컴포넌트가 함께 import한다:

```typescript
/** /info 홈 KPI 카드의 세그먼트 막대 한 칸 */
export interface KpiSegment {
    /** 범례 라벨. 호출자가 t()로 번역해 넘긴다 */
    label: string;
    /** 표시 수치. 건수형은 실수치, 금액형은 이미 계산된 퍼센트다 */
    value: number;
    /** 막대·범례 점 색상 Tailwind 클래스 (예: 'bg-indigo-600') */
    colorClass: string;
}
```

`it_frontend/app/components/info/InfoKpiCountCard.vue`:

```vue
<!--
================================================================================
[components/info/InfoKpiCountCard.vue] 건수형 KPI 카드
================================================================================
/info 홈 상단의 '올해 사업'·'내년 사업' 카드를 그립니다.

[구성]
  아이콘 배지 + 제목 + (관리자) 조회범위 토글
  큰 숫자 + 단위
  총합 대비 비율 세그먼트 막대
  세그먼트 범례

표시 문구는 모두 호출자가 번역해 넘깁니다. 이 컴포넌트는 고정 리터럴을 갖지 않습니다.
================================================================================
-->
<script setup lang="ts">
import InfoDashboardScopeToggle from '~/components/info/InfoDashboardScopeToggle.vue';
import type { KpiSegment } from '~/types/infoDashboard';
import type { InfoDashboardScope } from '~/utils/infoDashboardScope';

const props = defineProps<{
    icon: string;
    iconClass: string;
    title: string;
    total: number;
    unitLabel: string;
    segments: KpiSegment[];
    showScopeToggle: boolean;
}>();

const scope = defineModel<InfoDashboardScope>('scope', { required: true });

/** 총합 대비 비율(%). 총합이 0이면 0%를 반환해 나누기 오류를 피한다. */
const widthOf = (value: number) =>
    props.total > 0 ? `${(value / props.total) * 100}%` : '0%';
</script>

<template>
    <div
        class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 xl:p-4 flex flex-col gap-3 xl:gap-2 transition-all duration-200 hover:border-zinc-300 hover:shadow-md"
    >
        <div class="flex items-center justify-between gap-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
                <span
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-none"
                    :class="iconClass"
                >
                    <i :class="icon" />
                </span>
                <span class="text-13 font-medium text-zinc-600">{{ title }}</span>
            </div>
            <InfoDashboardScopeToggle v-if="showScopeToggle" v-model="scope" />
        </div>

        <div class="flex items-baseline gap-x-2 gap-y-1 flex-wrap">
            <span
                class="text-36 font-bold text-zinc-900 dark:text-zinc-100 leading-none tracking-[-0.03em] tabular-nums"
                >{{ total }}</span
            >
            <span class="text-xs text-zinc-400 whitespace-nowrap">{{ unitLabel }}</span>
        </div>

        <!-- 비율 고정 세그먼트(%) -->
        <div class="h-1.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex">
            <span
                v-for="segment in segments"
                :key="segment.label"
                data-testid="kpi-segment-bar"
                class="h-full"
                :class="segment.colorClass"
                :style="{ width: widthOf(segment.value) }"
            />
        </div>

        <div class="flex gap-3.5 text-11 text-zinc-400 tabular-nums flex-wrap">
            <span
                v-for="segment in segments"
                :key="segment.label"
                class="inline-flex items-center gap-1.5"
            >
                <i class="inline-block w-2 h-2 rounded-sm" :class="segment.colorClass" />
                {{ segment.label }} {{ segment.value }}
            </span>
        </div>
    </div>
</template>
```

- [ ] **Step 4: 금액형 카드 구현**

`it_frontend/app/components/info/InfoKpiBudgetCard.vue`:

```vue
<!--
================================================================================
[components/info/InfoKpiBudgetCard.vue] 금액형 KPI 카드
================================================================================
/info 홈 상단의 '올해 편성요청 예산'·'내년 편성요청 예산' 카드를 그립니다.

[구성]
  아이콘 배지 + 제목 + (관리자) 조회범위 토글
  신청액(억원) + 편성액 안내
  구성비(%) 세그먼트 막대 + 범례

세그먼트 value는 총합 대비 비율이 아니라 이미 계산된 퍼센트 값입니다.
표시 문구는 모두 호출자가 번역해 넘깁니다.
================================================================================
-->
<script setup lang="ts">
import InfoDashboardScopeToggle from '~/components/info/InfoDashboardScopeToggle.vue';
import { formatBudget } from '~/utils/common';
import type { KpiSegment } from '~/types/infoDashboard';
import type { InfoDashboardScope } from '~/utils/infoDashboardScope';

defineProps<{
    icon: string;
    iconClass: string;
    title: string;
    requestBudget: number;
    allocatedBudget: number;
    allocatedLead: string;
    allocatedTrail: string;
    segments: KpiSegment[];
    showScopeToggle: boolean;
}>();

const scope = defineModel<InfoDashboardScope>('scope', { required: true });

/** 억원 단위 표시. formatBudget이 단위 접미어를 붙이므로 여기서는 값만 만든다. */
const BUDGET_UNIT = '억원';
</script>

<template>
    <div
        class="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 xl:p-4 flex flex-col gap-3 xl:gap-2 transition-all duration-200 hover:border-zinc-300 hover:shadow-md"
    >
        <div class="flex items-center justify-between gap-2.5">
            <div class="flex items-center gap-2.5 min-w-0">
                <span
                    class="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-none"
                    :class="iconClass"
                >
                    <i :class="icon" />
                </span>
                <span class="text-13 font-medium text-zinc-600">{{ title }}</span>
            </div>
            <InfoDashboardScopeToggle v-if="showScopeToggle" v-model="scope" />
        </div>

        <div class="flex items-baseline gap-x-2 gap-y-1 flex-wrap">
            <span
                class="text-36 font-bold text-zinc-900 dark:text-zinc-100 leading-none tracking-[-0.03em] tabular-nums"
                >{{ formatBudget(requestBudget, BUDGET_UNIT) }}</span
            >
            <span class="text-xs text-zinc-400 whitespace-nowrap"
                >{{ allocatedLead }}
                <b class="text-zinc-700 dark:text-zinc-300 font-semibold"
                    >{{ formatBudget(allocatedBudget, BUDGET_UNIT) }}{{ allocatedTrail }}</b
                ></span
            >
        </div>

        <!-- 구성비 게이지(%) — value가 이미 퍼센트다 -->
        <div class="h-1.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex">
            <span
                v-for="segment in segments"
                :key="segment.label"
                data-testid="kpi-segment-bar"
                class="h-full"
                :class="segment.colorClass"
                :style="{ width: `${segment.value}%` }"
            />
        </div>

        <div class="flex gap-3.5 text-11 text-zinc-400 tabular-nums flex-wrap">
            <span
                v-for="segment in segments"
                :key="segment.label"
                class="inline-flex items-center gap-1.5"
            >
                <i class="inline-block w-2 h-2 rounded-sm" :class="segment.colorClass" />
                {{ segment.label }} {{ segment.value }}%
            </span>
        </div>
    </div>
</template>
```

**확인 완료:** Vue 3.5.35이므로 `defineModel`을 쓸 수 있고, 이미 `CodeSelect.vue`·`IoeCategorySelect.vue` 등이 사용 중이다. `KpiSegment`는 위와 같이 `app/types/infoDashboard.ts`로 분리한다.

- [ ] **Step 5: 테스트 실행해 통과 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/InfoKpiCards.test.ts
```

Expected: PASS (9개 테스트 — 건수형 6개, 금액형 3개).

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_frontend && git add app/components/info/InfoKpiCountCard.vue app/components/info/InfoKpiBudgetCard.vue app/types/infoDashboard.ts tests/unit/components/InfoKpiCards.test.ts && git diff --cached --stat
```

```bash
cd C:/it/it_frontend && git commit -m "refactor: /info KPI 카드를 건수형·금액형 컴포넌트로 추출"
```

---

## Task 10: /info 홈 통합 — KPI 4종·즐겨찾기 4항목·캐러셀

**Files:**
- Modify: `it_frontend/app/pages/info/index.vue`
- Modify: `it_frontend/i18n/messages/info.ts`

**Interfaces:**
- Consumes: `useInfoDashboardYear` (Task 8), `InfoKpiCountCard`·`InfoKpiBudgetCard` (Task 9), `InfoBannerCarousel` (Task 6)
- Produces: 최종 `/info` 화면. Task 11의 e2e가 검증한다.

**변경 요약:**

| 영역 | 변경 |
| --- | --- |
| KPI 카드 | `올해 사업` / `내년 사업` / `올해 편성요청 예산` / `내년 편성요청 예산` |
| 제거 | `진행중인 사업`, `집행완료 예산` 카드와 관련 computed |
| 즐겨찾기 | 예산 작성 3종 + 전산예산 목록 4항목, 중요도 배지 제거 |
| 캐러셀 | 우측 패널 즐겨찾기 카드 아래 배치 |
| 유지 | 간트 타임라인, 공지사항, 주요 일정 (올해 데이터 기준) |

- [ ] **Step 1: i18n 키 정리**

`it_frontend/i18n/messages/info.ts` ko `info.dashboard` 블록에서 **제거**:
`activeProjects`, `completedBudget`, `requestedBudget`, `executionComplete`, `remaining`, `projectGuide`, `requirementWriter`, `preDiagnosis`, `priority`

**추가**:

```typescript
                nextYearProjects: '내년 사업',
                thisYearRequestedBudget: '올해 편성요청 예산',
                nextYearRequestedBudget: '내년 편성요청 예산',
                segments: {
                    project: '정보화사업',
                    ordinary: '경상사업',
                    cost: '전산업무비',
                    capital: '자본예산',
                    general: '일반관리비',
                },
                links: {
                    projectBudget: '정보화사업 예산 작성',
                    ordinaryBudget: '경상사업 예산 작성',
                    costBudget: '전산업무비 예산 작성',
                    budgetList: '전산예산 목록',
                },
```

en `info.dashboard` 블록에 같은 구조로 추가:

```typescript
                nextYearProjects: 'Projects Next Year',
                thisYearRequestedBudget: 'Requested Budget (This Year)',
                nextYearRequestedBudget: 'Requested Budget (Next Year)',
                segments: {
                    project: 'IT Projects',
                    ordinary: 'Recurring Projects',
                    cost: 'IT Operating Costs',
                    capital: 'Capital Budget',
                    general: 'General Admin',
                },
                links: {
                    projectBudget: 'IT Project Budget Entry',
                    ordinaryBudget: 'Recurring Project Budget Entry',
                    costBudget: 'IT Operating Cost Budget Entry',
                    budgetList: 'IT Budget List',
                },
```

en 쪽에서도 대응하는 키를 동일하게 제거한다.

**주의:** 제거하는 키가 다른 화면에서 쓰이지 않는지 먼저 확인한다:

```bash
cd C:/it/it_frontend && grep -rn "activeProjects\|completedBudget\|executionComplete\|dashboard.remaining\|requirementWriter\|preDiagnosis\|dashboard.priority\|dashboard.requestedBudget" app tests
```

`app/pages/info/index.vue` 외의 참조가 있으면 그 화면도 함께 조정하거나 키를 남긴다. 기존 `quickLinks`는 패널 제목이므로 그대로 두고, 항목들은 `info.dashboard.links.*`에 넣는다.

- [ ] **Step 2: script 블록 교체**

`app/pages/info/index.vue`의 `<script setup>`에서:

1. `useCost`·`useProjects` 직접 import를 제거하고 `useInfoDashboardYear`를 import한다.
2. `InfoKpiCountCard`·`InfoKpiBudgetCard`·`InfoBannerCarousel`을 import한다.
3. `DashboardCard` 타입과 `cardScopes`를 새 카드 4종 + 간트로 교체한다:

```typescript
type DashboardCard =
    | 'thisYearCount'
    | 'nextYearCount'
    | 'thisYearBudget'
    | 'nextYearBudget'
    | 'progress';
const cardScopes = reactive<Record<DashboardCard, InfoDashboardScope>>({
    thisYearCount: 'department',
    nextYearCount: 'department',
    thisYearBudget: 'department',
    nextYearBudget: 'department',
    progress: 'department',
});
```

4. 연도와 데이터 조회를 교체한다:

```typescript
const progressYear = new Date().getFullYear();
const progressMonths = Array.from({ length: 12 }, (_, i) => i + 1);
const thisYear = String(progressYear);
const nextYear = String(progressYear + 1);

const yearOptions = { departmentCode: userDepartmentCode, isAdmin };
const thisYearData = useInfoDashboardYear(thisYear, yearOptions);
const nextYearData = useInfoDashboardYear(nextYear, yearOptions);

const thisYearCountSummary = computed(
    () => thisYearData.summaries.value[cardScopes.thisYearCount],
);
const nextYearCountSummary = computed(
    () => nextYearData.summaries.value[cardScopes.nextYearCount],
);
const thisYearBudgetSummary = computed(
    () => thisYearData.summaries.value[cardScopes.thisYearBudget],
);
const nextYearBudgetSummary = computed(
    () => nextYearData.summaries.value[cardScopes.nextYearBudget],
);
```

5. 간트는 올해 데이터만 쓰므로 `progressProjects`를 `thisYearData`로 연결한다:

```typescript
const progressProjects = computed(() =>
    isAdmin.value && cardScopes.progress === 'all'
        ? [...thisYearData.projects.value, ...thisYearData.ordinaryProjects.value]
        : [
              ...thisYearData.departmentProjects.value,
              ...thisYearData.departmentOrdinaryProjects.value,
          ],
);
```

6. 세그먼트 배열 빌더를 추가한다:

```typescript
/** 건수형 카드 세그먼트 — 사업 유형별 구성 */
const countSegments = (summary: InfoDashboardSummary) => [
    {
        label: t('info.dashboard.segments.project'),
        value: summary.projectCount,
        colorClass: 'bg-indigo-600',
    },
    {
        label: t('info.dashboard.segments.ordinary'),
        value: summary.ordinaryCount,
        colorClass: 'bg-indigo-400',
    },
    {
        label: t('info.dashboard.segments.cost'),
        value: summary.costCount,
        colorClass: 'bg-indigo-200',
    },
];

/** 금액형 카드 세그먼트 — 자본예산·일반관리비 구성비(%) */
const budgetSegments = (summary: InfoDashboardSummary) => [
    {
        label: t('info.dashboard.segments.capital'),
        value: summary.capitalRate,
        colorClass: 'bg-amber-500',
    },
    {
        label: t('info.dashboard.segments.general'),
        value: summary.generalRate,
        colorClass: 'bg-amber-300',
    },
];

/** 즐겨찾기 항목 — 예산 작성 3종과 통합 목록 */
const QUICK_LINKS = [
    {
        to: '/info/projects/form',
        labelKey: 'info.dashboard.links.projectBudget',
        icon: 'pi pi-briefcase',
    },
    {
        to: '/info/projects/form?ordinary=true',
        labelKey: 'info.dashboard.links.ordinaryBudget',
        icon: 'pi pi-sync',
    },
    {
        to: '/info/cost/form',
        labelKey: 'info.dashboard.links.costBudget',
        icon: 'pi pi-desktop',
    },
    { to: '/budget/list', labelKey: 'info.dashboard.links.budgetList', icon: 'pi pi-list' },
] as const;
```

7. **제거**: `activeSummary`, `completedSummary`, `QUICK_LINK_PRIORITY`, 그리고 더 이상 쓰지 않는 `percent` 헬퍼(카드 컴포넌트가 자체 계산한다). `percent`가 간트에서도 쓰이면 남긴다 — 확인 후 결정한다.

- [ ] **Step 3: KPI 카드 4종 마크업 교체**

기존 KPI `<div class="grid ...">` 블록(약 200~470행)의 카드 4개를 통째로 교체한다:

```vue
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 xl:shrink-0">
                <!-- 올해 사업: 등록 사업 수와 유형 세그먼트 -->
                <InfoKpiCountCard
                    v-model:scope="cardScopes.thisYearCount"
                    icon="pi pi-calendar"
                    icon-class="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                    :title="t('info.dashboard.thisYearProjects')"
                    :total="thisYearCountSummary.totalCount"
                    :unit-label="t('info.dashboard.itemsUnit')"
                    :segments="countSegments(thisYearCountSummary)"
                    :show-scope-toggle="isAdmin"
                />

                <!-- 내년 사업: 내년 기준연도 등록 사업 수 -->
                <InfoKpiCountCard
                    v-model:scope="cardScopes.nextYearCount"
                    icon="pi pi-calendar-plus"
                    icon-class="bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                    :title="t('info.dashboard.nextYearProjects')"
                    :total="nextYearCountSummary.totalCount"
                    :unit-label="t('info.dashboard.itemsUnit')"
                    :segments="countSegments(nextYearCountSummary)"
                    :show-scope-toggle="isAdmin"
                />

                <!-- 올해 편성요청 예산: 신청액 vs 최종 편성액 -->
                <InfoKpiBudgetCard
                    v-model:scope="cardScopes.thisYearBudget"
                    icon="pi pi-file-edit"
                    icon-class="bg-amber-100 text-amber-700"
                    :title="t('info.dashboard.thisYearRequestedBudget')"
                    :request-budget="thisYearBudgetSummary.requestBudget"
                    :allocated-budget="thisYearBudgetSummary.allocatedBudget"
                    :allocated-lead="t('info.dashboard.allocatedLead')"
                    :allocated-trail="t('info.dashboard.allocatedTrail')"
                    :segments="budgetSegments(thisYearBudgetSummary)"
                    :show-scope-toggle="isAdmin"
                />

                <!-- 내년 편성요청 예산 -->
                <InfoKpiBudgetCard
                    v-model:scope="cardScopes.nextYearBudget"
                    icon="pi pi-wallet"
                    icon-class="bg-blue-100 text-blue-700"
                    :title="t('info.dashboard.nextYearRequestedBudget')"
                    :request-budget="nextYearBudgetSummary.requestBudget"
                    :allocated-budget="nextYearBudgetSummary.allocatedBudget"
                    :allocated-lead="t('info.dashboard.allocatedLead')"
                    :allocated-trail="t('info.dashboard.allocatedTrail')"
                    :segments="budgetSegments(nextYearBudgetSummary)"
                    :show-scope-toggle="isAdmin"
                />
            </div>
```

- [ ] **Step 4: 우측 패널 교체 (즐겨찾기 + 캐러셀)**

기존 우측 패널 `<div class="w-full xl:w-80 flex-shrink-0">` 블록 전체를 교체한다:

```vue
        <!-- 우측 패널: 즐겨찾기 + 배너 -->
        <div class="w-full xl:w-80 flex-shrink-0 space-y-6">
            <!-- [주석] 즐겨찾기는 예산 작성 흐름에서 가장 자주 여는 화면들을 모읍니다. -->
            <div
                class="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800"
            >
                <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
                    <i class="pi pi-star-fill text-yellow-500" />
                    {{ t('info.dashboard.quickLinks') }}
                </h3>
                <div class="space-y-3">
                    <NuxtLink
                        v-for="link in QUICK_LINKS"
                        :key="link.to"
                        :to="link.to"
                        class="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all cursor-pointer group"
                    >
                        <div
                            class="w-8 h-8 shrink-0 rounded-lg bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-300 group-hover:bg-indigo-500 group-hover:text-white transition-colors"
                        >
                            <i :class="link.icon" />
                        </div>
                        <span class="font-medium text-zinc-700 dark:text-zinc-200 truncate">{{
                            t(link.labelKey)
                        }}</span>
                    </NuxtLink>
                </div>
            </div>

            <!-- 배너 캐러셀 — 활성 배너가 없으면 스스로 렌더하지 않습니다. -->
            <InfoBannerCarousel />
        </div>
```

- [ ] **Step 5: 파일 상단 문서 주석 갱신**

`app/pages/info/index.vue` 맨 위 주석 블록의 `[UI 구성]`을 실제 구성으로 고친다:

```
[UI 구성]
  - 상단: 4개 KPI 카드 (올해 사업 / 내년 사업 / 올해 편성요청 예산 / 내년 편성요청 예산)
  - 중간: [사업별 진행현황] 간트 스타일 타임라인 (올해 기준, full-width)
  - 하단: 공지사항 목록 + 주요 일정 리스트 (2열)
  - 우측: 즐겨찾기 패널 + 배너 캐러셀
```

`[향후 개선]` 항목 중 이미 해결된 문장이 있으면 지운다.

- [ ] **Step 6: 800줄 상한 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/architecture/max-lines-ratchet.test.ts
```

Expected: PASS. 실패하면 `info/index.vue`가 여전히 800줄을 넘는 것이므로 간트 타임라인 블록을 `InfoProgressTimeline.vue`로 추가 분리한다.

- [ ] **Step 7: 고정 리터럴 감사와 전체 검사**

Run:
```bash
cd C:/it/it_frontend && npm run check:copy
```

Expected: 출력 없음.

Run:
```bash
cd C:/it/it_frontend && npm run format:check && npm run check
```

Expected: 오류 없음.

- [ ] **Step 8: 단위 테스트 전체 실행**

Run:
```bash
cd C:/it/it_frontend && npm test
```

Expected: PASS. i18n 키 존재를 검사하는 테스트(`tests/unit/i18n`)가 제거한 키를 참조하면 함께 정리한다.

- [ ] **Step 9: 실제 화면 확인**

preview로 `/info`에 접속해 확인한다.

Expected: KPI 카드 4개가 올해·내년 순으로 보이고, 우측에 즐겨찾기 4항목과 그 아래 배너 캐러셀이 보이며(배너가 있을 때), 콘솔 오류가 없다. 즐겨찾기 4개 링크가 각각 올바른 경로로 이동한다.

- [ ] **Step 10: 커밋**

```bash
cd C:/it/it_frontend && git add app/pages/info/index.vue i18n/messages/info.ts && git diff --cached --stat
```

```bash
cd C:/it/it_frontend && git commit -m "feat: /info KPI 카드를 올해·내년 4종으로, 즐겨찾기를 예산 작성 4항목으로 교체하고 배너 캐러셀 배치"
```

---

## Task 11: e2e 검증과 마무리

**Files:**
- Modify: `it_frontend/tests/e2e/helpers/mockApi.ts`
- Modify: `it_frontend/tests/e2e/info-home.spec.ts`
- Create: `it_frontend/tests/e2e/admin/banners.spec.ts`
- Modify: `C:/it/TASK.md`
- Modify: `C:/it/versions.lock` (스크립트가 갱신)

**Interfaces:**
- Consumes: Task 4의 HTTP 계약, Task 7·10의 화면
- Produces: 없음 (최종 검증)

**배경:** `/info`가 새로 `/api/banners`를 호출하므로, mock이 없으면 기존 `/info` e2e가 실제 백엔드로 요청을 흘려 `networkidle` 대기에서 타임아웃한다. `mockCommonApis`에 기본 mock을 넣어야 한다.

- [ ] **Step 1: 공통 mock에 배너 API 추가**

`it_frontend/tests/e2e/helpers/mockApi.ts`의 `mockCommonApis` 함수 안, `/api/notifications` mock 바로 앞에 추가한다:

```typescript
    // /info 홈이 항상 조회하는 배너 API. mock 없이는 실제 백엔드로 요청이 새어
    // networkidle 대기가 정착하지 않는다. 각 명세가 뒤에서 등록하는 구체 mock이 우선한다.
    await mockApi(page, '/api/banners', []);
```

- [ ] **Step 2: /info 홈 e2e 보강**

`it_frontend/tests/e2e/info-home.spec.ts` 끝에 테스트 2개를 추가한다:

```typescript
test('정보 홈은 올해·내년 KPI 카드 4종과 예산 작성 즐겨찾기 4항목을 표시한다', async ({
    page,
}) => {
    await setLoggedIn(page);
    await mockCommonApis(page);
    await page.goto('/info');

    // KPI 카드 4종
    await expect(page.getByText('올해 사업', { exact: true })).toBeVisible();
    await expect(page.getByText('내년 사업', { exact: true })).toBeVisible();
    await expect(page.getByText('올해 편성요청 예산', { exact: true })).toBeVisible();
    await expect(page.getByText('내년 편성요청 예산', { exact: true })).toBeVisible();

    // 제거된 카드는 더 이상 없다
    await expect(page.getByText('진행중인 사업', { exact: true })).toHaveCount(0);
    await expect(page.getByText('집행완료 예산', { exact: true })).toHaveCount(0);

    // 즐겨찾기 4항목의 이동 경로
    await expect(page.getByRole('link', { name: '정보화사업 예산 작성' })).toHaveAttribute(
        'href',
        '/info/projects/form',
    );
    await expect(page.getByRole('link', { name: '경상사업 예산 작성' })).toHaveAttribute(
        'href',
        '/info/projects/form?ordinary=true',
    );
    await expect(page.getByRole('link', { name: '전산업무비 예산 작성' })).toHaveAttribute(
        'href',
        '/info/cost/form',
    );
    await expect(page.getByRole('link', { name: '전산예산 목록' })).toHaveAttribute(
        'href',
        '/budget/list',
    );
});

test('정보 홈 배너는 활성 배너가 있을 때만 표시된다', async ({ page }) => {
    await setLoggedIn(page);
    await mockCommonApis(page);

    // 배너 0건 → 캐러셀이 렌더되지 않는다
    await page.goto('/info');
    await expect(page.locator('img[alt*="배너 이미지"]')).toHaveCount(0);

    // 배너 1건 → 이미지가 노출된다
    await page.route(/\/api\/banners$/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    flMpnId: 'FL-00000001',
                    flNm: 'hero.png',
                    apgFlSz: 2048,
                    active: true,
                    previewUrl: '/api/files/FL-00000001/preview',
                    fstEnrDtm: '2026-08-19T09:00:00',
                    fstEnrUsid: 'E001',
                },
            ]),
        });
    });
    // 이미지 본문 자체도 막아 실제 백엔드로 새지 않게 한다 (1x1 투명 GIF)
    await page.route(/\/api\/files\/.*\/preview$/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'image/gif',
            body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
        });
    });

    await page.reload();
    await expect(page.locator('img[alt*="배너 이미지"]')).toHaveCount(1);
});
```

**주의:** `alt` 문구는 Task 6에서 정한 `info.dashboard.bannerAlt`(`'{name} 배너 이미지'`)와 일치해야 한다. 키 문구를 바꿨다면 셀렉터도 함께 바꾼다. `page.goto('/info')` 뒤에 다른 e2e가 쓰는 대기 방식(`waitForLoadState` 등)을 그대로 따른다.

- [ ] **Step 3: 배너 관리 화면 e2e 작성**

`it_frontend/tests/e2e/admin/banners.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

import { mockApi, mockCommonApis, setLoggedIn } from '../helpers/mockApi.js';

/** 1x1 투명 GIF — 실제 이미지 본문 요청이 백엔드로 새지 않게 막는다. */
const TRANSPARENT_GIF = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64',
);

const banner = (active: boolean) => ({
    flMpnId: 'FL-00000001',
    flNm: 'hero.png',
    apgFlSz: 2048,
    active,
    previewUrl: '/api/files/FL-00000001/preview',
    fstEnrDtm: '2026-08-19T09:00:00',
    fstEnrUsid: 'E001',
});

test('관리자는 배너 목록을 보고 활성 상태를 전환한다', async ({ page }) => {
    await setLoggedIn(page, {
        eno: 'E001',
        empNm: '관리자',
        athIds: ['ITPAD001'], // ROLE.ADMIN — middleware/admin.ts가 이 값을 본다
        bbrC: 'D001',
        temC: 'T001',
    });
    await mockCommonApis(page);
    await page.route(/\/api\/files\/.*\/preview$/, async (route) => {
        await route.fulfill({ status: 200, contentType: 'image/gif', body: TRANSPARENT_GIF });
    });

    let active = true;
    await page.route(/\/api\/banners\/admin$/, async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([banner(active)]),
        });
    });

    let patchBody: unknown = null;
    await page.route(/\/api\/banners\/FL-00000001\/active$/, async (route) => {
        patchBody = route.request().postDataJSON();
        active = (patchBody as { active: boolean }).active;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(banner(active)),
        });
    });

    await page.goto('/admin/banners');

    await expect(page.getByText('hero.png')).toBeVisible();

    // 활성 토글을 끄면 PATCH가 active:false로 나간다
    await page.getByRole('switch').click();
    await expect.poll(() => patchBody).toEqual({ active: false });
});

test('일반 사용자는 배너 관리 화면에 접근할 수 없다', async ({ page }) => {
    await setLoggedIn(page); // 기본 사용자는 일반 권한(ITPZZ001)
    await mockCommonApis(page);
    await mockApi(page, '/api/banners/admin', []);

    await page.goto('/admin/banners');

    // middleware/admin.ts가 ITPAD001 미보유 사용자를 메인('/')으로 리다이렉트한다
    await expect(page).toHaveURL(/\/$/);
});
```

**확인 완료:** 관리자 자격등급 ID는 `ITPAD001`(`~/types/auth`의 `ROLE.ADMIN`)이고, `app/middleware/admin.ts`는 미보유 시 `navigateTo('/')`로 메인에 보낸다.

**남은 확인:** `getByRole('switch')`가 PrimeVue `ToggleSwitch`의 실제 ARIA role과 맞는지 확인하고, 아니면 `ToggleSwitch`에 `data-testid`를 붙여 셀렉터를 안정화한다. 기존 `tests/e2e/access-control.spec.ts`에 리다이렉트 검증 패턴이 있으면 그대로 재사용한다.

- [ ] **Step 4: e2e 실행**

Run:
```bash
cd C:/it/it_frontend && npx playwright test tests/e2e/info-home.spec.ts tests/e2e/admin/banners.spec.ts
```

Expected: PASS. 실패하면 셀렉터·라우팅 대기 방식을 실제 화면에 맞춰 조정한다.

- [ ] **Step 5: 프론트엔드 Health Stack 전체 실행**

Run:
```bash
cd C:/it/it_frontend && npm run format:check && npm run check && npm test
```

Expected: 모두 PASS.

- [ ] **Step 6: 백엔드 Health Stack 전체 실행**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --no-daemon
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 7: 기존 결함을 TASK.md에 등록**

`C:/it/TASK.md`에 항목을 추가한다. 파일의 기존 항목 형식(ID 접두어·표 구조)을 먼저 읽고 그대로 맞춘다. 내용:

> `/admin/translations`와 `/admin/migration`, `/admin/migration/requests` 경로가 `TPRMPP_CMENUD` 경로 카탈로그에 없다. `AdminMenuService.requireUsableCatalogPath()`가 PGE 메뉴 저장 시 카탈로그 행을 요구하므로, 관리자가 `/admin/menus`에서 해당 메뉴를 다시 저장하면 실패한다. 누락 경로를 카탈로그에 시드하는 마이그레이션이 필요하다. (2026-08-19 배너 작업 중 발견)

- [ ] **Step 8: e2e·TASK.md 커밋**

```bash
cd C:/it/it_frontend && git add tests/e2e/helpers/mockApi.ts tests/e2e/info-home.spec.ts tests/e2e/admin/banners.spec.ts && git diff --cached --stat
```

```bash
cd C:/it/it_frontend && git commit -m "test: /info KPI·즐겨찾기·배너와 배너 관리 화면 e2e 추가"
```

```bash
cd C:/it && git add TASK.md && git diff --cached --stat
```

```bash
cd C:/it && git commit -m "docs: TPRMPP_CMENUD 경로 카탈로그 누락 결함 등록"
```

- [ ] **Step 9: 호환 버전 조합 갱신**

세 저장소가 모두 커밋된 뒤에 실행한다.

Run:
```bash
cd C:/it && ./scripts/update-versions-lock.ps1
```

```bash
cd C:/it && git add versions.lock && git diff --cached --stat
```

```bash
cd C:/it && git commit -m "chore: 배너·대시보드 재구성 호환 버전 조합 갱신"
```

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 항목 | 태스크 |
| --- | --- |
| §5.1 CFILEM 재사용 규약 | Task 3 (`BannerService` 상수) |
| §5.2 전용 API 4개 엔드포인트 | Task 3·4 |
| §5.3 read/write authorizer | Task 2 |
| §5.4 이미지 확장자 재검증 | Task 3 Step 5 |
| §5.5 캐러셀 컴포넌트 | Task 6 |
| §5.6 배너 관리 화면 | Task 7 |
| §5.7 메뉴 시드 (CMENUD·CMENUM·CLANGM) | Task 1 |
| §5.8 즐겨찾기 4항목·배지 제거 | Task 10 |
| §5.9 KPI 카드 4종 | Task 10 |
| §5.10 `info/index.vue` 정리 | Task 8·9·10 |
| §5.11 i18n | Task 6·7·10 |
| §8 오류 처리표 | Task 3(확장자·404·403), Task 6(0건·실패·이미지 오류), Task 7(토스트) |
| §9.1 백엔드 테스트 6종 | Task 2·3·4 |
| §9.2 프론트 테스트 7종 | Task 5·6·8·9·11 |
| §9.3 DB 검증 스크립트 | Task 1 |
| §9.4 Health Stack | Task 11 |
| §11 TASK.md 등록 | Task 11 Step 7 |

누락 없음.

**2. 계획 실행 중 확인이 필요한 지점 (플레이스홀더가 아니라 검증 항목)**

각 태스크에 **주의** 블록으로 명시했다. 코드를 쓰기 전에 해당 파일을 읽고 값을 맞춰야 하는 곳이다.

- Task 2: 관리자 권한 ID 상수 (`CustomUserDetails.isAdmin()` 참조값)
- Task 3: `Cfilem.getDelYn()` 노출 여부
- Task 4: `TestSecurityConfig`의 CSRF·메서드 보안 활성화, `CustomGeneralException`의 HTTP 상태 매핑
- Task 7: `PageHeader`·`TableCard`·`StyledDataTable` props, `formatFileSize` 위치
- Task 8: `filterDashboardItemsByScope`의 비관리자 `scope:'all'` 처리
- Task 9: `<script setup>`의 `export interface` 제약 → 타입 파일 분리, `defineModel` 지원 버전
- Task 10: 제거 대상 i18n 키의 타 화면 참조, `percent` 헬퍼 잔존 필요성
- Task 11: `ToggleSwitch`의 ARIA role, `admin` 미들웨어 거부 동작

**3. 타입 일관성**

- `BannerDto.Response` 필드(Task 3) ↔ `BannerRecord` 인터페이스(Task 5) ↔ e2e mock 본문(Task 11): `flMpnId`·`flNm`·`apgFlSz`·`active`·`previewUrl`·`fstEnrDtm`·`fstEnrUsid` 7개로 일치.
- `BannerService#setActive(String, boolean)`(Task 3) ↔ `PATCH .../active` 본문 `{"active": boolean}`(Task 4) ↔ `setBannerActive(flMpnId, active)`(Task 5) ↔ `handleToggleActive`(Task 7): 일치.
- `KpiSegment { label, value, colorClass }`(Task 9) ↔ `countSegments`·`budgetSegments` 반환(Task 10): 일치.
- `useInfoDashboardYear(year, {departmentCode, isAdmin})` 반환 5개 필드(Task 8) ↔ Task 10의 `thisYearData.summaries`·`.projects`·`.ordinaryProjects`·`.departmentProjects`·`.departmentOrdinaryProjects` 사용: 일치.
- `BannerFileReadAuthorizer.BANNER_KIND`(Task 2)를 Task 3의 `BannerService`와 Task 2의 `BannerFileTargetWriteAuthorizer`가 함께 참조: 일치.
