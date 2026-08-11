# 수기 엑셀 일괄 마이그레이션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포탈 도입 전 수기 관리하던 2026년 예산·사업 엑셀 4시트를 관리자 화면에서 검증·보정 후 원장으로 일괄 반입한다.

**Architecture:** 브라우저가 exceljs로 파싱해 정규화 행(JSON)을 만들고, 서버가 dry-run에서 조직·코드 해석과 검증 진단을 돌려주며, 사용자가 미리보기에서 보정한 뒤 commit이 단일 트랜잭션으로 기존 도메인 서비스(`CostService`·`ProjectService`·`BudgetRateApplicationService`)를 호출해 원장과 이관용 결재완료 받이를 만든다. dry-run 결과는 서버에 보관하지 않고 commit이 전부 재검증한다.

**Tech Stack:** Java 25 / Spring Boot 4.1 / Spring Data JPA / QueryDSL / Oracle / Flyway, Nuxt 4 / Vue 3 Composition API / TypeScript / PrimeVue / exceljs, JUnit 5 + Mockito + MockMvc, Vitest, Playwright

**스펙:** `docs/superpowers/specs/2026-08-11-excel-bulk-migration-design.md` (§ 참조는 모두 이 문서)

## Global Constraints

- 신규 주석은 모두 한글. public API·service 메서드 JavaDoc에 입력값과 실패 조건을 함께 기록한다.
- 모든 `@Column`에 한글 `comment`. 엔티티는 `BaseEntity` 상속, 물리 삭제 대신 `delete()`로 `DEL_YN='Y'`.
- 응답 DTO의 모든 속성에 `@Schema(requiredMode = REQUIRED)`, null 가능 속성만 `nullable = true`, 값 집합이 정해진 속성은 `allowableValues`.
- 변경 API는 `@Valid` + `consumes = MediaType.APPLICATION_JSON_VALUE`.
- `@RequestParam`·`@PathVariable`·`@RequestHeader`에 `name` 명시.
- 조회 서비스 `@Transactional(readOnly = true)`, 쓰기 `@Transactional`.
- 관리자 전용 컨트롤러는 클래스 수준 `@PreAuthorize("hasRole('ADMIN')")`.
- 프론트 운영 `.ts`·`.vue` 파일은 800줄(`scripts/max-lines-baselines.mjs`의 `MAX_NEW_FILE_LINES`)을 넘지 않는다. 예외 목록에 추가하지 말고 책임을 분리한다.
- 프론트 컴포넌트는 `app/components/{도메인}/`에 둔다. `app/components/` 루트에 파일을 두지 않는다.
- 반응형 GET은 `useApiFetch`, 명령형·POST는 `$apiFetch`. `runtimeConfig.public.apiBase`로 만든 절대 URL을 넘긴다.
- CSS 클래스명은 kebab-case 또는 BEM. DB 컬럼명(camelCase)을 클래스명에 그대로 쓰지 않는다.
- Flyway 파일명 `V{YYYYMMDD_NNN}__{CamelCase설명}.sql`. 적용된 스크립트는 수정하지 않는다. 현재 최신은 `V20260809_004`.
- 금액 단위: 일반관리비 시트 ×1,000 / 자본예산·부문계획 시트 ×1,000,000 / 위임예산 시트 변환 없음. DB 저장은 원 단위.
- `ABUS_TC` 코드값: `10`=신규, `20`=계속, `0`=해당없음. 한글 문자열이 아니다.
- `IOE_C` 코드값: `001`~`015`(일반관리비 계열), `101`·`102`(기계장치), `103`·`104`(개발비), `105`~`107`(기타무형자산).
- `BBUGTM.FNT_TB_NM`은 `BITEMM`·`BCOSTM`만 쓴다. `PK_COL_NM`은 `GCL_MNG_NO` 또는 `COST` 번호, `FNT_TB_CRY_SNO`는 원천 행의 `SNO`.
- `BudgetWorkDto.ItemRate.orcTb`는 접두어 없는 `BPROJM`·`BCOSTM`.
- 실 xlsx 3개(`C:\it\*.xlsx`)는 실명·실금액이 담긴 미추적 업무 데이터다. 저장소에 커밋하지 않는다. 테스트 픽스처는 익명화·축약해 새로 만든다.

## 파일 구조

**백엔드 신규** (`it_backend/src/main/java/com/kdb/it/domain/migration/`)

| 파일 | 책임 |
| --- | --- |
| `controller/MigrationController.java` | dry-run·commit 엔드포인트, 관리자 권한 게이트 |
| `dto/MigrationDto.java` | 정규화 행·진단·요청/응답 계약 (정적 중첩 record) |
| `dto/SheetKind.java` | 시트 종류 enum |
| `dto/MigrationColumns.java` | 시트별 정규 컬럼 id 상수 (프론트 파서와의 계약) |
| `service/MigrationImportService.java` | 트랜잭션 경계, 어댑터 순서, `applyItemRates` 단일 호출 |
| `service/MigrationValidator.java` | 진단 카탈로그 |
| `service/OrgIdentityResolver.java` | 부서·팀·담당자 해석 + 후보 |
| `service/MigrationApprovalStamper.java` | 이관용 `CAPPLM`·`CAPPLA` 생성 |
| `service/adapter/SheetAdapter.java` | 어댑터 인터페이스 |
| `service/adapter/CostSheetAdapter.java` | `전체취합(국내외)` → `BCOSTM` |
| `service/adapter/CapitalProjectSheetAdapter.java` | `1-1. 26년정보화사업` → `BPROJM`·`BITEMM` |
| `service/adapter/DelegatedBudgetSheetAdapter.java` | `2. 위임예산(경상)` → 경상 `BPROJM`·`BITEMM` |
| `service/adapter/PlanAdjustmentSheetAdapter.java` | `26년정보화사업(자본예산)` → `BPLANM`·`BPLANA`·`BITEMM` 버전 교체 |

**백엔드 수정**

| 파일 | 변경 |
| --- | --- |
| `domain/budget/cost/service/CostService.java:86` | 기간 검증 생략 오버로드 추가 |
| `domain/budget/project/service/ProjectService.java:135` | 기간 검증 생략 오버로드 추가 |
| `domain/budget/work/entity/Bbugtm.java:58` | `FNT_TB_NM` 주석 정정 |
| `domain/budget/project/entity/Bprojm.java:219` | `ABUS_TC` 주석 정정 |
| `domain/budget/work/dto/BudgetWorkDto.java:65` | `ItemRate.orcTb` 주석 정정 |

**프론트 신규**

| 파일 | 책임 |
| --- | --- |
| `app/pages/admin/migration/index.vue` | 라우팅·화면 조합 |
| `app/composables/useMigrationPage.ts` | 화면 상태 파사드 |
| `app/composables/migration/columns.ts` | 정규 컬럼 id (백엔드 `MigrationColumns`와 동일 리터럴) |
| `app/composables/migration/useMigrationParser.ts` | exceljs 파싱·시트 판별·정규화 |
| `app/composables/migration/useMigrationPreview.ts` | dry-run 호출·진단 병합·보정값 |
| `app/components/migration/MigrationPreviewTable.vue` | 미리보기 표, 진단 강조, 보정 드롭다운 |
| `app/components/migration/MigrationFileSlots.vue` | 파일 슬롯 4개 |

**DB 신규**

| 파일 | 책임 |
| --- | --- |
| `it_database/migrations/V20260811_001__SeedCurrencyAndBudgetXcr.sql` | `CUR_C` GBP·AUD 코드 + 2026 예산환율 `C_TP='XCR'` 행 |
| `it_database/migrations/V20260811_002__SeedMigrationAdminMenu.sql` | `/admin/migration` `PGE` 메뉴 |

---

## Phase A — 선행 조치

### Task 1: 통화·예산환율 공통코드 시드

`Ccodem`에 GBP·AUD 통화 코드와 2026년 예산환율 행이 없으면 외화 데이터가 전혀 적재되지 않는다(§3.2, §3.7). `XcrLookupService.resolveXcr`는 `C_ID='CUR_C'`, `CDVA=통화`, `C_TP='XCR'`, 유효기간이 기준일을 포함하는 행의 `CO_CDVA_NM`을 환율로 파싱하고, 없으면 `IllegalStateException`으로 롤백한다.

**Files:**
- Create: `it_database/migrations/V20260811_001__SeedCurrencyAndBudgetXcr.sql`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/util/XcrLookupServiceBudgetSeedIt.java`

**Interfaces:**
- Consumes: `XcrLookupService.resolveXcr(String curC, LocalDate baseDate)` → `BigDecimal` (기존)
- Produces: `Ccodem` 행 — `C_ID='CUR_C'`, `CDVA∈{KRW,USD,GBP,EUR,JPY,SGD,AUD,CNY}`, `C_TP='XCR'`, `CO_CDVA_NM`=환율 문자열, `STT_DT='20260101'`, `END_DT='20261231'`

- [ ] **Step 1: 통합 테스트를 먼저 작성한다**

`it_backend/src/test/java/com/kdb/it/domain/budget/cost/util/XcrLookupServiceBudgetSeedIt.java`

```java
package com.kdb.it.domain.budget.cost.util;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.support.AbstractOracleRepositoryTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Tag;
import org.springframework.beans.factory.annotation.Autowired;

/** 2026년 예산환율 시드가 XcrLookupService 조회 규약을 만족하는지 확인합니다. */
@Tag("it")
class XcrLookupServiceBudgetSeedIt extends AbstractOracleRepositoryTest {

    @Autowired private XcrLookupService xcrLookupService;

    /** 이관 대상 통화 전부가 2026년 기준일로 조회된다. */
    @Test
    @DisplayName("2026년 예산환율 시드로 GBP·AUD·USD·JPY 환율을 조회한다")
    void 예산환율시드로_이관대상_통화환율을_조회한다() {
        LocalDate base = LocalDate.of(2026, 8, 11);

        assertThat(xcrLookupService.resolveXcr("GBP", base))
                .isEqualByComparingTo(new BigDecimal("1924"));
        assertThat(xcrLookupService.resolveXcr("AUD", base))
                .isEqualByComparingTo(new BigDecimal("929"));
        assertThat(xcrLookupService.resolveXcr("USD", base))
                .isEqualByComparingTo(new BigDecimal("1432"));
        assertThat(xcrLookupService.resolveXcr("JPY", base))
                .isEqualByComparingTo(new BigDecimal("9.7"));
    }

    /** KRW는 조회를 우회해 null을 반환한다 (BudgetAmountCalculator 결정 B의 전제). */
    @Test
    @DisplayName("KRW는 환율 조회를 우회해 null을 반환한다")
    void 원화는_환율조회를_우회한다() {
        assertThat(xcrLookupService.resolveXcr("KRW", LocalDate.of(2026, 8, 11))).isNull();
    }

    /** 엑셀 외화열 × 시드 환율이 엑셀 원화열과 일치한다 (AMOUNT_MISMATCH 진단의 근거). */
    @Test
    @DisplayName("GBP 2890 × 1924 = 5560360원 — 엑셀 원화열 5560.36천원과 일치한다")
    void 외화금액과_환율의_곱이_엑셀원화열과_일치한다() {
        BigDecimal xcr = xcrLookupService.resolveXcr("GBP", LocalDate.of(2026, 8, 11));

        assertThat(new BigDecimal("2890").multiply(xcr))
                .isEqualByComparingTo(new BigDecimal("5560360"));
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew integrationTest --tests '*XcrLookupServiceBudgetSeedIt*' --no-daemon`
Expected: FAIL — `IllegalStateException` (GBP 환율 행 없음)

> Gradle 파일락을 피하려고 `--no-daemon`을 붙인다. 실패가 `tail`로 가려지지 않게 출력 전체를 본다.

- [ ] **Step 3: Flyway 시드 스크립트를 작성한다**

`it_database/migrations/V20260811_001__SeedCurrencyAndBudgetXcr.sql`

```sql
-- 2026년 수기 엑셀 이관 선행 조치
-- 1) CUR_C 공통코드에 GBP·AUD 추가 (기존: CNY, EUR, JPY, KRW, SGD, USD)
-- 2) 전 통화에 C_TP='XCR' 예산환율 행 추가 — XcrLookupService.resolveXcr의 단일 원천
--    환율값 출처: 2026년 전산일반관리비 편성 요구서 '(환율 기준)' 시트
--    유효기간을 2026년 전체로 두어 이관 실행일(기준일=오늘)이 포함되게 한다

-- 1) 통화 코드값 추가 (이미 있으면 건너뛴다)
MERGE INTO ITPOWN.TPRMPP_CCODEM t
USING (
    SELECT 'CUR_C' AS CO_C_ID_NM, 'GBP' AS CDVA_ID, '영국파운드' AS CDVA_NM FROM DUAL
    UNION ALL SELECT 'CUR_C', 'AUD', '호주달러' FROM DUAL
) s
ON (t.CO_C_ID_NM = s.CO_C_ID_NM AND t.CDVA_ID = s.CDVA_ID AND t.CO_C_INTN_NM IS NULL)
WHEN NOT MATCHED THEN INSERT (
    CO_C_ID_NM, CDVA_ID, CDVA_NM, STT_DT, END_DT, CO_C_NM,
    DEL_YN, FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM
) VALUES (
    s.CO_C_ID_NM, s.CDVA_ID, s.CDVA_NM, '20260101', '99991231', '통화코드',
    'N', 'SYSTEM', SYSTIMESTAMP, 'SYSTEM', SYSTIMESTAMP
);

-- 2) 2026년 예산환율 행 (C_TP='XCR', 환율값은 CO_CDVA_NM)
MERGE INTO ITPOWN.TPRMPP_CCODEM t
USING (
    SELECT 'KRW' AS CDVA_ID, '1'    AS XCR FROM DUAL
    UNION ALL SELECT 'USD', '1432'  FROM DUAL
    UNION ALL SELECT 'GBP', '1924'  FROM DUAL
    UNION ALL SELECT 'EUR', '1666'  FROM DUAL
    UNION ALL SELECT 'JPY', '9.7'   FROM DUAL
    UNION ALL SELECT 'SGD', '1114'  FROM DUAL
    UNION ALL SELECT 'AUD', '929'   FROM DUAL
    UNION ALL SELECT 'CNY', '199'   FROM DUAL
) s
ON (t.CO_C_ID_NM = 'CUR_C' AND t.CDVA_ID = s.CDVA_ID AND t.CO_C_INTN_NM = 'XCR')
WHEN MATCHED THEN UPDATE SET
    t.CO_CDVA_NM = s.XCR, t.STT_DT = '20260101', t.END_DT = '20261231',
    t.DEL_YN = 'N', t.LST_CHG_USID = 'SYSTEM', t.LST_CHG_DTM = SYSTIMESTAMP
WHEN NOT MATCHED THEN INSERT (
    CO_C_ID_NM, CDVA_ID, CDVA_NM, CO_C_INTN_NM, CO_CDVA_NM, STT_DT, END_DT, CO_C_NM,
    DEL_YN, FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM
) VALUES (
    'CUR_C', s.CDVA_ID, s.CDVA_ID || ' 2026년 예산환율', 'XCR', s.XCR, '20260101', '20261231',
    '통화코드', 'N', 'SYSTEM', SYSTIMESTAMP, 'SYSTEM', SYSTIMESTAMP
);
```

- [ ] **Step 4: 실제 컬럼명을 대조하고 스크립트를 보정한다**

시드가 `TPRMPP_CCODEM`의 실제 NOT NULL 제약과 맞는지 확인한다.

```bash
cd /c/it && { printf '%s\n' "$DB_PASSWORD"; printf "%s\n" "SET LINESIZE 200 PAGESIZE 100" "SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE FROM ALL_TAB_COLUMNS WHERE OWNER='ITPOWN' AND TABLE_NAME='TPRMPP_CCODEM' ORDER BY COLUMN_ID;" "EXIT"; } | NLS_LANG=KOREAN_KOREA.AL32UTF8 sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

NOT NULL인데 위 INSERT에 없는 컬럼이 나오면 해당 컬럼을 기본값과 함께 추가한다. `DB_PASSWORD`는 stdin으로만 넘기고 명령행 인자로 쓰지 않는다.

- [ ] **Step 5: 백엔드를 기동해 Flyway를 적용하고 테스트를 통과시킨다**

Run:
```bash
cd it_backend && ./gradlew integrationTest --tests '*XcrLookupServiceBudgetSeedIt*' --no-daemon
```
Expected: PASS (3 tests). `local-ext`/`local-int` 프로파일이 `filesystem:../it_database/migrations`를 읽어 신규 스크립트를 자동 적용한다.

- [ ] **Step 6: 커밋**

두 저장소가 분리돼 있으므로 각각 커밋한 뒤 루트 `versions.lock`을 갱신한다.

```bash
cd /c/it/it_database && git add migrations/V20260811_001__SeedCurrencyAndBudgetXcr.sql && git commit -m "feat: 2026년 예산환율·GBP·AUD 통화 공통코드 시드"
cd /c/it/it_backend && git add src/test/java/com/kdb/it/domain/budget/cost/util/XcrLookupServiceBudgetSeedIt.java && git commit -m "test: 2026년 예산환율 시드의 XcrLookupService 조회 규약 검증"
cd /c/it && pwsh -File scripts/update-versions-lock.ps1 && git add versions.lock && git commit -m "chore: 예산환율 시드 반영해 versions.lock 갱신"
```

---

### Task 2: 기간 검증 생략 오버로드와 낡은 주석 정정

`CostService.createCost:87`과 `ProjectService.createProject:137`의 `codeService.validateBudgetPeriod()`가 편성 시즌 밖 이관을 400으로 막는다(§3.8). 마이그레이션만 쓰는 생략 경로를 추가하고, 기존 시그니처는 검증하는 경로로 위임해 호출부 동작을 그대로 둔다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:86`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:135`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/entity/Bbugtm.java:58`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java:219`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/dto/BudgetWorkDto.java:65`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceMigrationOverloadTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceMigrationOverloadTest.java`

**Interfaces:**
- Produces: `CostService.createCost(CostDto.CreateRequest request, boolean skipBudgetPeriodValidation)` → `String` (전산업무비 관리번호)
- Produces: `ProjectService.createProject(ProjectDto.CreateRequest request, boolean skipBudgetPeriodValidation)` → `String` (프로젝트 관리번호)
- 기존 1-인자 시그니처는 `(request, false)`로 위임하며 동작이 바뀌지 않는다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceMigrationOverloadTest.java`

```java
package com.kdb.it.domain.budget.cost.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.kdb.it.common.code.service.CodeService;
import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.exception.CustomGeneralException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.assertj.core.api.Assertions;

/** 마이그레이션 전용 기간 검증 생략 오버로드의 동작을 고정합니다. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CostServiceMigrationOverloadTest {

    @Mock private CodeService codeService;
    @InjectMocks private CostService costService;

    /** 생략 플래그가 true면 기간 검증을 아예 호출하지 않는다. */
    @Test
    @DisplayName("skipBudgetPeriodValidation=true면 validateBudgetPeriod를 호출하지 않는다")
    void 생략플래그가_참이면_기간검증을_호출하지_않는다() {
        doThrow(new CustomGeneralException("예산 신청 기간이 아닙니다."))
                .when(codeService)
                .validateBudgetPeriod();

        // 기간 밖이어도 예외가 기간 검증에서 나오지 않는다 (이후 채번 단계로 진행)
        Assertions.assertThatThrownBy(
                        () -> costService.createCost(new CostDto.CreateRequest(), true))
                .isNotInstanceOf(CustomGeneralException.class);

        verify(codeService, never()).validateBudgetPeriod();
    }

    /** 기존 1-인자 시그니처는 종전대로 기간을 검증한다. */
    @Test
    @DisplayName("1-인자 createCost는 기간 검증을 그대로 수행한다")
    void 기존시그니처는_기간검증을_유지한다() {
        doThrow(new CustomGeneralException("예산 신청 기간이 아닙니다."))
                .when(codeService)
                .validateBudgetPeriod();

        Assertions.assertThatThrownBy(() -> costService.createCost(new CostDto.CreateRequest()))
                .isInstanceOf(CustomGeneralException.class);

        verify(codeService, times(1)).validateBudgetPeriod();
    }
}
```

`ProjectServiceMigrationOverloadTest`는 같은 구조로 `projectService.createProject(new ProjectDto.CreateRequest(), true)` / `createProject(new ProjectDto.CreateRequest())`를 검증한다. 두 테스트 모두 `@Mock`으로 선언할 협력자 목록은 대상 서비스의 `@RequiredArgsConstructor` 필드를 그대로 따라간다 — `CostService`는 `codeService` 외에 `costRepository`·`xcrLookupService`·`orgNameResolver` 등을 갖고, `ProjectService`는 `projectRepository`·`bitemmRepository`·`xcrLookupService`·`orgNameResolver`·`codeService`를 갖는다. 파일 상단에서 실제 필드를 읽고 빠짐없이 `@Mock`으로 선언한다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationOverloadTest' --no-daemon`
Expected: 컴파일 실패 — `createCost(CreateRequest, boolean)` 메서드 없음

- [ ] **Step 3: 오버로드를 추가한다**

`CostService.java` — 기존 `createCost(CostDto.CreateRequest request)`의 본문을 2-인자 메서드로 옮기고 1-인자는 위임만 한다.

```java
    /**
     * 신규 전산업무비와 요청 단말기를 생성합니다.
     *
     * <p>예산 신청 기간을 검증합니다. 기간 밖 호출은 실패합니다.
     *
     * @param request 생성 요청
     * @return 생성된 전산업무비 관리번호
     * @throws com.kdb.it.exception.CustomGeneralException 예산 신청 기간이 아닌 경우
     */
    @Transactional
    public String createCost(CostDto.CreateRequest request) {
        return createCost(request, false);
    }

    /**
     * 신규 전산업무비와 요청 단말기를 생성합니다.
     *
     * <p>{@code skipBudgetPeriodValidation}은 관리자 전용 수기 엑셀 이관 경로만 사용합니다. 이관 작업은 편성 시즌 밖에서도 실행되어야 하므로
     * 기간 검증을 건너뛸 수 있어야 하지만, 일반 사용자 화면 경로는 반드시 검증을 거쳐야 하므로 기본값 false인 1-인자 시그니처를 남겨 둡니다.
     *
     * @param request 생성 요청
     * @param skipBudgetPeriodValidation true면 예산 신청 기간 검증을 생략 (이관 전용)
     * @return 생성된 전산업무비 관리번호
     * @throws com.kdb.it.exception.CustomGeneralException 검증을 수행했고 예산 신청 기간이 아닌 경우
     */
    @Transactional
    public String createCost(
            CostDto.CreateRequest request, boolean skipBudgetPeriodValidation) {
        if (!skipBudgetPeriodValidation) {
            codeService.validateBudgetPeriod();
        }
        String costBgNo = request.getCostBgNo();
        // ... 기존 본문을 그대로 유지 (채번 → xcr 조회 → reconcileAmount → save → 단말기)
    }
```

`ProjectService.createProject`에도 같은 형태를 적용한다. `@CacheEvict(cacheNames = "tiptapMetadata", allEntries = true)`는 **실제 로직이 있는 2-인자 메서드**에 붙인다. `@Cacheable`·`@CacheEvict`는 Spring 프록시를 통해야 동작하므로, 1-인자에서 2-인자를 내부 호출하면 어노테이션이 무시된다 — 어노테이션을 1-인자에만 남기면 캐시 무효화가 조용히 사라진다.

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationOverloadTest' --no-daemon`
Expected: PASS (4 tests)

- [ ] **Step 5: 낡은 주석 3곳을 정정한다**

`Bbugtm.java:58`

```java
    /** 원본테이블: 집계 대상 테이블 (BITEMM 또는 BCOSTM) */
    @Column(name = "FNT_TB_NM", length = 120, comment = "원본테이블 (물리컬럼 FNT_TB_NM=원천테이블명)")
    private String fntTbNm;
```

`Bbugtm.java:62` — `PK_COL_NM`의 실제 값도 함께 명확히 한다.

```java
    /** 원본PK값: BITEMM이면 품목관리번호(GCL_MNG_NO), BCOSTM이면 전산업무비코드(BG_NO) */
    @Column(name = "PK_COL_NM", length = 4000, comment = "원본PK값 (물리컬럼 PK_COL_NM=주식별자컬럼명)")
    private String pkColNm;
```

`Bprojm.java:219`

```java
    /** 사업구분: 공통코드 ABUS_TC의 코드값 ('10'=신규, '20'=계속, '0'=해당없음) */
    @Column(name = "ABUS_TC", length = 2, nullable = false, comment = "사업구분 (물리컬럼 ABUS_TC=사업구분코드)")
    private String abusTc;
```

`BudgetWorkDto.java:65` — `ItemRate` JavaDoc의 `@param orcTb` 줄을 바꾼다.

```java
     * @param orcTb 원본 테이블 — 접두어 없는 {@code BPROJM} 또는 {@code BCOSTM}
```

- [ ] **Step 6: 기존 테스트가 깨지지 않았는지 확인한다**

Run: `cd it_backend && ./gradlew test --no-daemon`
Expected: PASS. 실패가 있으면 오버로드 위임이나 `@CacheEvict` 위치를 되짚는다.

- [ ] **Step 7: 커밋**

```bash
cd /c/it/it_backend && git add -A src/main/java/com/kdb/it/domain/budget src/test/java/com/kdb/it/domain/budget && git commit -m "feat: 이관 전용 기간검증 생략 오버로드 추가와 BBUGTM·ABUS_TC 주석 정정"
```

---

## Phase B — 백엔드 계약·해석·검증

### Task 3: 정규 컬럼 id와 전송 계약

프론트 파서와 백엔드 어댑터가 공유하는 정규 컬럼 id를 상수로 못박고, dry-run·commit의 요청·응답 record를 정의한다. 이 계약이 이후 모든 태스크의 입력이다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/dto/SheetKind.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/dto/MigrationColumns.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/dto/MigrationDto.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/dto/MigrationColumnsTest.java`

**Interfaces:**
- Produces: `SheetKind` — `COST`, `CAPITAL_PROJECT`, `DELEGATED_BUDGET`, `PLAN_ADJUSTMENT`
- Produces: `MigrationColumns.of(SheetKind)` → `List<String>` (해당 시트의 정규 컬럼 id 순서)
- Produces: `MigrationDto.NormalizedRow(int excelRow, Map<String,String> cells)`
- Produces: `MigrationDto.SheetPayload(SheetKind kind, String bseYy, List<NormalizedRow> rows)`
- Produces: `MigrationDto.DryRunRequest(List<SheetPayload> sheets)`
- Produces: `MigrationDto.CellDiagnostic(SheetKind sheet, int excelRow, String column, String code, Severity severity, String message, List<Candidate> candidates)`
- Produces: `MigrationDto.Candidate(String code, String label)`
- Produces: `MigrationDto.Severity` — `BLOCKER`, `WARNING`
- Produces: `MigrationDto.DryRunResponse(List<CellDiagnostic> diagnostics, Summary summary)`
- Produces: `MigrationDto.Summary(int totalRows, int blockerCount, int warningCount)`
- Produces: `MigrationDto.CellOverride(SheetKind sheet, int excelRow, String column, String value)`
- Produces: `MigrationDto.CommitRequest(List<SheetPayload> sheets, List<CellOverride> overrides)`
- Produces: `MigrationDto.CommitResponse(int costCount, int projectCount, int itemCount, int budgetRowCount, String planReqDocNo, List<String> createdIds)`

- [ ] **Step 1: 컬럼 id 계약 테스트를 작성한다**

`it_backend/src/test/java/com/kdb/it/domain/migration/dto/MigrationColumnsTest.java`

```java
package com.kdb.it.domain.migration.dto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 정규 컬럼 id 계약을 고정합니다.
 *
 * <p>이 목록은 프론트 파서(app/composables/migration/columns.ts)와 동일한 리터럴이어야 합니다. 한쪽만 바꾸면 dry-run이 조용히 빈 셀을
 * 읽으므로, 컬럼을 추가·삭제할 때 두 파일과 이 테스트를 함께 갱신합니다.
 */
class MigrationColumnsTest {

    @Test
    @DisplayName("전산일반관리비 시트의 정규 컬럼 id 목록을 고정한다")
    void 일반관리비_컬럼계약() {
        assertThat(MigrationColumns.of(SheetKind.COST))
                .containsExactly(
                        "abusCode", "ioeName", "abusTcLabel", "vendorName", "requestDetail",
                        "securityFlag", "terminalFlag", "deptName", "teamName", "currency",
                        "fcAmount", "krwAmount", "remark");
    }

    @Test
    @DisplayName("자본예산 시트의 정규 컬럼 id 목록을 고정한다")
    void 자본예산_컬럼계약() {
        assertThat(MigrationColumns.of(SheetKind.CAPITAL_PROJECT))
                .containsExactly(
                        "projectName", "projectType", "progressLabel", "projectOutline",
                        "headquarters", "deptName", "teamName", "managerName", "teamLeaderName",
                        "itTeamName", "feasibility", "startYm", "endYm",
                        "devAmount", "hwAmount", "swAmount", "adjustRate", "delegationLabel");
    }

    @Test
    @DisplayName("위임예산 시트의 정규 컬럼 id 목록을 고정한다")
    void 위임예산_컬럼계약() {
        assertThat(MigrationColumns.of(SheetKind.DELEGATED_BUDGET))
                .containsExactly(
                        "branchName", "itemName", "currency", "hwQty", "hwFcAmount",
                        "hwKrwAmount", "swQty", "swFcAmount", "swKrwAmount");
    }

    @Test
    @DisplayName("부문계획 시트의 정규 컬럼 id 목록을 고정한다")
    void 부문계획_컬럼계약() {
        assertThat(MigrationColumns.of(SheetKind.PLAN_ADJUSTMENT))
                .containsExactly(
                        "projectName", "projectType", "headquarters", "deptName", "teamName",
                        "managerName", "teamLeaderName", "budgetChangeLabel", "startYm", "endYm",
                        "devAmount", "hwAmount", "swAmount", "generalAmount", "totalAmount",
                        "spentBefore", "spent26", "planned26", "paymentSchedule", "plannedAfter27",
                        "progressLabel", "remark");
    }

    @Test
    @DisplayName("컬럼 id는 시트 간 의미가 같으면 같은 이름을 쓴다")
    void 시트간_공통컬럼은_같은_id를_쓴다() {
        List<String> capital = MigrationColumns.of(SheetKind.CAPITAL_PROJECT);
        List<String> plan = MigrationColumns.of(SheetKind.PLAN_ADJUSTMENT);

        assertThat(capital).contains("projectName", "deptName", "managerName");
        assertThat(plan).contains("projectName", "deptName", "managerName");
    }

    @Test
    @DisplayName("null 시트 종류는 거부한다")
    void null_시트종류는_거부한다() {
        assertThatThrownBy(() -> MigrationColumns.of(null))
                .isInstanceOf(NullPointerException.class);
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationColumnsTest' --no-daemon`
Expected: 컴파일 실패 — `SheetKind`·`MigrationColumns` 없음

- [ ] **Step 3: `SheetKind`를 작성한다**

```java
package com.kdb.it.domain.migration.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** 수기 엑셀 이관 대상 시트 종류입니다. */
@Schema(name = "MigrationSheetKind", description = "이관 대상 시트 종류")
public enum SheetKind {
    /** 전산일반관리비 편성 요구서 '전체취합(국내외)' → BCOSTM */
    COST,
    /** 전산자본예산 편성 요구서 '1-1. 26년정보화사업(전산예산반영)' → BPROJM·BITEMM */
    CAPITAL_PROJECT,
    /** 전산자본예산 편성 요구서 '2. 위임예산(경상)' → 경상 BPROJM·BITEMM */
    DELEGATED_BUDGET,
    /** 정보기술부문계획 조정 '26년정보화사업(자본예산)' → BPLANM·BPLANA */
    PLAN_ADJUSTMENT
}
```

- [ ] **Step 4: `MigrationColumns`를 작성한다**

```java
package com.kdb.it.domain.migration.dto;

import java.util.List;
import java.util.Objects;

/**
 * 시트별 정규 컬럼 id 목록입니다.
 *
 * <p>프론트 파서가 엑셀 헤더를 이 id로 정규화해 보내고 어댑터가 같은 id로 읽습니다. 엑셀 헤더 문자열은 파일마다 미묘하게 다르므로(병합 헤더, 공백, 줄바꿈)
 * 전송 계약에는 헤더 원문을 쓰지 않습니다. {@code app/composables/migration/columns.ts}가 같은 리터럴을 갖고 있으며 두 곳을 함께 바꿉니다.
 */
public final class MigrationColumns {

    private MigrationColumns() {
        throw new UnsupportedOperationException("유틸 클래스 — 인스턴스화 금지");
    }

    /** 전산일반관리비 '전체취합(국내외)'. 25년 3열·증감액·증감률·세목코드는 미적재라 제외합니다. */
    private static final List<String> COST =
            List.of(
                    "abusCode", "ioeName", "abusTcLabel", "vendorName", "requestDetail",
                    "securityFlag", "terminalFlag", "deptName", "teamName", "currency",
                    "fcAmount", "krwAmount", "remark");

    /** 자본예산 '1-1. 26년정보화사업(전산예산반영)'. 편성요청 3열과 조정비율까지 받습니다. */
    private static final List<String> CAPITAL_PROJECT =
            List.of(
                    "projectName", "projectType", "progressLabel", "projectOutline",
                    "headquarters", "deptName", "teamName", "managerName", "teamLeaderName",
                    "itTeamName", "feasibility", "startYm", "endYm",
                    "devAmount", "hwAmount", "swAmount", "adjustRate", "delegationLabel");

    /** 위임예산 '2. 위임예산(경상)'. HW·SW 수량·외화·원화를 각각 받습니다. */
    private static final List<String> DELEGATED_BUDGET =
            List.of(
                    "branchName", "itemName", "currency", "hwQty", "hwFcAmount",
                    "hwKrwAmount", "swQty", "swFcAmount", "swKrwAmount");

    /** 부문계획 '26년정보화사업(자본예산)'. 집행 실적 4열은 스냅샷 보존용으로 받습니다. */
    private static final List<String> PLAN_ADJUSTMENT =
            List.of(
                    "projectName", "projectType", "headquarters", "deptName", "teamName",
                    "managerName", "teamLeaderName", "budgetChangeLabel", "startYm", "endYm",
                    "devAmount", "hwAmount", "swAmount", "generalAmount", "totalAmount",
                    "spentBefore", "spent26", "planned26", "paymentSchedule", "plannedAfter27",
                    "progressLabel", "remark");

    /**
     * 시트 종류에 해당하는 정규 컬럼 id 목록을 반환합니다.
     *
     * @param kind 시트 종류 (null 아님)
     * @return 불변 컬럼 id 목록 (엑셀 열 순서)
     * @throws NullPointerException kind가 null인 경우
     */
    public static List<String> of(SheetKind kind) {
        Objects.requireNonNull(kind, "kind");
        return switch (kind) {
            case COST -> COST;
            case CAPITAL_PROJECT -> CAPITAL_PROJECT;
            case DELEGATED_BUDGET -> DELEGATED_BUDGET;
            case PLAN_ADJUSTMENT -> PLAN_ADJUSTMENT;
        };
    }
}
```

- [ ] **Step 5: `MigrationDto`를 작성한다**

```java
package com.kdb.it.domain.migration.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.media.Schema.RequiredMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.Map;

/** 수기 엑셀 이관 요청·응답 계약입니다. */
public final class MigrationDto {

    private MigrationDto() {
        throw new UnsupportedOperationException("계약 컨테이너 — 인스턴스화 금지");
    }

    /** 진단 심각도. BLOCKER가 하나라도 남으면 반영을 거부합니다. */
    @Schema(name = "MigrationSeverity", description = "진단 심각도")
    public enum Severity {
        BLOCKER,
        WARNING
    }

    /**
     * 정규화된 엑셀 한 행입니다.
     *
     * @param excelRow 엑셀 사용자 관점 행 번호 (헤더 다음 행이 2)
     * @param cells 정규 컬럼 id → 셀 문자열. 빈 셀은 빈 문자열이며 키를 생략하지 않습니다
     */
    @Schema(name = "MigrationNormalizedRow", description = "정규화된 엑셀 행")
    public record NormalizedRow(
            @Schema(description = "엑셀 행 번호", example = "2", requiredMode = RequiredMode.REQUIRED)
                    int excelRow,
            @Schema(description = "정규 컬럼 id → 셀 문자열", requiredMode = RequiredMode.REQUIRED)
                    @NotNull Map<String, String> cells) {}

    /**
     * 시트 하나의 전송 단위입니다.
     *
     * @param kind 시트 종류
     * @param bseYy 예산연도 4자리
     * @param rows 정규화 행 목록 (비어 있지 않음)
     */
    @Schema(name = "MigrationSheetPayload", description = "시트 단위 전송 페이로드")
    public record SheetPayload(
            @Schema(description = "시트 종류", requiredMode = RequiredMode.REQUIRED) @NotNull
                    SheetKind kind,
            @Schema(description = "예산연도", example = "2026", requiredMode = RequiredMode.REQUIRED)
                    @Pattern(regexp = "\\d{4}", message = "예산연도는 4자리 숫자입니다.")
                    String bseYy,
            @Schema(description = "정규화 행 목록", requiredMode = RequiredMode.REQUIRED)
                    @NotEmpty @Valid List<NormalizedRow> rows) {}

    /**
     * dry-run 요청입니다.
     *
     * @param sheets 올린 시트 목록 (1~4개)
     */
    @Schema(name = "MigrationDryRunRequest", description = "이관 사전검증 요청")
    public record DryRunRequest(
            @Schema(description = "시트 목록", requiredMode = RequiredMode.REQUIRED) @NotEmpty @Valid
                    List<SheetPayload> sheets) {}

    /**
     * 해석 후보입니다.
     *
     * @param code 저장할 코드값 (부서코드·사번·비목코드 등)
     * @param label 사용자에게 보여줄 이름
     */
    @Schema(name = "MigrationCandidate", description = "해석 후보")
    public record Candidate(
            @Schema(description = "코드값", example = "0210", requiredMode = RequiredMode.REQUIRED)
                    String code,
            @Schema(description = "표시명", example = "IT기획부", requiredMode = RequiredMode.REQUIRED)
                    String label) {}

    /**
     * 셀 단위 진단입니다.
     *
     * @param sheet 시트 종류
     * @param excelRow 엑셀 행 번호
     * @param column 정규 컬럼 id. 행 전체에 걸린 진단은 null
     * @param code 진단 코드 (ORG_UNRESOLVED 등)
     * @param severity 심각도
     * @param message 사용자 문구
     * @param candidates 보정 후보. 후보가 없으면 빈 목록
     */
    @Schema(name = "MigrationCellDiagnostic", description = "셀 단위 진단")
    public record CellDiagnostic(
            @Schema(description = "시트 종류", requiredMode = RequiredMode.REQUIRED) SheetKind sheet,
            @Schema(description = "엑셀 행 번호", example = "2", requiredMode = RequiredMode.REQUIRED)
                    int excelRow,
            @Schema(
                            description = "정규 컬럼 id (행 단위 진단은 null)",
                            example = "deptName",
                            requiredMode = RequiredMode.REQUIRED,
                            nullable = true)
                    String column,
            @Schema(
                            description = "진단 코드",
                            requiredMode = RequiredMode.REQUIRED,
                            allowableValues = {
                                "ORG_UNRESOLVED", "ORG_AMBIGUOUS", "USER_UNRESOLVED",
                                "USER_AMBIGUOUS", "CODE_UNRESOLVED", "REQUIRED_MISSING",
                                "DUPLICATE_EXISTS", "LENGTH_EXCEEDED", "PROJECT_NOT_FOUND",
                                "AMOUNT_MISMATCH", "RATE_OUT_OF_RANGE", "DATE_UNPARSEABLE"
                            })
                    String code,
            @Schema(description = "심각도", requiredMode = RequiredMode.REQUIRED) Severity severity,
            @Schema(description = "사용자 문구", requiredMode = RequiredMode.REQUIRED) String message,
            @Schema(description = "보정 후보", requiredMode = RequiredMode.REQUIRED)
                    List<Candidate> candidates) {}

    /**
     * dry-run 요약입니다.
     *
     * @param totalRows 검증한 전체 행 수
     * @param blockerCount BLOCKER 진단 수
     * @param warningCount WARNING 진단 수
     */
    @Schema(name = "MigrationSummary", description = "사전검증 요약")
    public record Summary(
            @Schema(description = "전체 행 수", requiredMode = RequiredMode.REQUIRED) int totalRows,
            @Schema(description = "BLOCKER 수", requiredMode = RequiredMode.REQUIRED)
                    int blockerCount,
            @Schema(description = "WARNING 수", requiredMode = RequiredMode.REQUIRED)
                    int warningCount) {}

    /**
     * dry-run 응답입니다.
     *
     * @param diagnostics 진단 목록. 문제가 없으면 빈 목록
     * @param summary 요약
     */
    @Schema(name = "MigrationDryRunResponse", description = "이관 사전검증 응답")
    public record DryRunResponse(
            @Schema(description = "진단 목록", requiredMode = RequiredMode.REQUIRED)
                    List<CellDiagnostic> diagnostics,
            @Schema(description = "요약", requiredMode = RequiredMode.REQUIRED) Summary summary) {}

    /**
     * 사용자가 미리보기에서 보정한 셀 하나입니다.
     *
     * @param sheet 시트 종류
     * @param excelRow 엑셀 행 번호
     * @param column 정규 컬럼 id
     * @param value 보정 값 (코드값)
     */
    @Schema(name = "MigrationCellOverride", description = "미리보기 보정값")
    public record CellOverride(
            @Schema(description = "시트 종류", requiredMode = RequiredMode.REQUIRED) @NotNull
                    SheetKind sheet,
            @Schema(description = "엑셀 행 번호", example = "2", requiredMode = RequiredMode.REQUIRED)
                    int excelRow,
            @Schema(description = "정규 컬럼 id", example = "ioeName", requiredMode = RequiredMode.REQUIRED)
                    @NotNull String column,
            @Schema(description = "보정 코드값", example = "008", requiredMode = RequiredMode.REQUIRED)
                    @NotNull String value) {}

    /**
     * 확정 반영 요청입니다.
     *
     * @param sheets 시트 목록 (dry-run과 같은 내용)
     * @param overrides 보정값 목록. 없으면 빈 목록
     */
    @Schema(name = "MigrationCommitRequest", description = "이관 확정 반영 요청")
    public record CommitRequest(
            @Schema(description = "시트 목록", requiredMode = RequiredMode.REQUIRED) @NotEmpty @Valid
                    List<SheetPayload> sheets,
            @Schema(description = "보정값 목록", requiredMode = RequiredMode.REQUIRED) @NotNull @Valid
                    List<CellOverride> overrides) {}

    /**
     * 확정 반영 응답입니다.
     *
     * @param costCount 생성한 전산업무비 수
     * @param projectCount 생성한 사업 수
     * @param itemCount 생성한 품목 수
     * @param budgetRowCount applyItemRates가 만든 편성행 수
     * @param planReqDocNo 생성한 계획관리번호. 부문계획 시트를 올리지 않았으면 null
     * @param createdIds 생성한 관리번호 목록 (화면 표시용)
     */
    @Schema(name = "MigrationCommitResponse", description = "이관 확정 반영 응답")
    public record CommitResponse(
            @Schema(description = "생성 전산업무비 수", requiredMode = RequiredMode.REQUIRED)
                    int costCount,
            @Schema(description = "생성 사업 수", requiredMode = RequiredMode.REQUIRED) int projectCount,
            @Schema(description = "생성 품목 수", requiredMode = RequiredMode.REQUIRED) int itemCount,
            @Schema(description = "생성 편성행 수", requiredMode = RequiredMode.REQUIRED)
                    int budgetRowCount,
            @Schema(
                            description = "생성 계획관리번호",
                            example = "PLN-2026-0001",
                            requiredMode = RequiredMode.REQUIRED,
                            nullable = true)
                    String planReqDocNo,
            @Schema(description = "생성 관리번호 목록", requiredMode = RequiredMode.REQUIRED)
                    List<String> createdIds) {}
}
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationColumnsTest' --no-daemon`
Expected: PASS (6 tests)

- [ ] **Step 7: Spotless 포맷을 적용하고 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it/domain/migration src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 수기 엑셀 이관 전송 계약과 정규 컬럼 id 정의"
```

---

### Task 4: `OrgIdentityResolver` — 부서·팀·담당자 해석

엑셀에는 코드가 없고 이름만 있다. `CORGNI`(부점명)와 `CUSERI`(사용자명+직위명)를 역방향으로 조회해 코드·사번을 얻고, 실패·중의성은 후보와 함께 돌려준다(§6.3). 행별 조회는 N+1이므로 전량을 1회 읽어 메모리 인덱스로 매칭한다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/OrgIdentityResolver.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/OrgIdentityResolverTest.java`

**Interfaces:**
- Consumes: `OrganizationRepository` (기존, `CorgnI` — `getPrlmOgzCCone()`=조직코드, `getBbrNm()`=조직명)
- Consumes: `UserRepository` (기존, `CuserI` — `getEno()`, `getUsrNm()`, `getPtCNm()`, `getBbrC()`, `getTemC()`, `getTemNm()`)
- Produces: `OrgIdentityResolver.snapshot()` → `OrgIdentityResolver.Index`
- Produces: `Index.resolveOrg(String name)` → `Resolution`
- Produces: `Index.resolveUser(String nameWithTitle, String deptCodeHint)` → `Resolution`
- Produces: `record Resolution(String code, String label, List<MigrationDto.Candidate> candidates)` — `code != null`이면 확정, `code == null && candidates.isEmpty()`면 미해석, `code == null && !candidates.isEmpty()`면 중의적
- Produces: `Index.orgNameOf(String code)` → `String` (스냅샷 컬럼용), `Index.teamOfUser(String eno)` → `String` 팀코드

- [ ] **Step 1: 실패하는 단위 테스트를 작성한다**

`it_backend/src/test/java/com/kdb/it/domain/migration/service/OrgIdentityResolverTest.java`

```java
package com.kdb.it.domain.migration.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.kdb.it.common.iam.entity.CorgnI;
import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.OrganizationRepository;
import com.kdb.it.common.iam.repository.UserRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 이름 → 코드 역방향 해석의 3단계와 중의성 처리를 고정합니다. */
@ExtendWith(MockitoExtension.class)
class OrgIdentityResolverTest {

    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;
    @InjectMocks private OrgIdentityResolver resolver;

    private OrgIdentityResolver.Index index;

    @BeforeEach
    void setUp() {
        when(organizationRepository.findByDelYn("N"))
                .thenReturn(
                        List.of(
                                org("0210", "IT기획부"),
                                org("0211", "IT기획팀"),
                                org("0212", "IT인프라팀"),
                                org("0330", "PF2실"),
                                org("0450", "금융공학실"),
                                org("0451", "금융공학실 퀀트인프라팀")));
        when(userRepository.findByDelYn("N"))
                .thenReturn(
                        List.of(
                                user("100001", "김성원", "과장", "0210", "0211", "IT기획팀"),
                                user("100002", "장원섭", "차장", "0330", "0331", "글로벌IT혁신팀"),
                                user("100003", "장원섭", "부장", "0450", "0451", "퀀트인프라팀")));
        index = resolver.snapshot();
    }

    @Test
    @DisplayName("부서명이 정확히 일치하면 조직코드를 확정한다")
    void 정확일치_부서명은_코드를_확정한다() {
        OrgIdentityResolver.Resolution result = index.resolveOrg("IT기획부");

        assertThat(result.code()).isEqualTo("0210");
        assertThat(result.label()).isEqualTo("IT기획부");
        assertThat(result.candidates()).isEmpty();
    }

    @Test
    @DisplayName("공백이 다른 부서명도 2단계에서 확정한다")
    void 공백차이_부서명은_2단계에서_확정한다() {
        assertThat(index.resolveOrg("IT 기획부").code()).isEqualTo("0210");
        assertThat(index.resolveOrg(" IT기획부 ").code()).isEqualTo("0210");
    }

    @Test
    @DisplayName("부분 일치가 둘 이상이면 미확정으로 두고 후보를 돌려준다")
    void 부분일치_다수는_후보를_돌려준다() {
        OrgIdentityResolver.Resolution result = index.resolveOrg("금융공학");

        assertThat(result.code()).isNull();
        assertThat(result.candidates())
                .extracting(com.kdb.it.domain.migration.dto.MigrationDto.Candidate::code)
                .containsExactlyInAnyOrder("0450", "0451");
    }

    @Test
    @DisplayName("어디에도 없는 부서명은 후보 없이 미해석이다")
    void 미등록_부서명은_후보없이_미해석이다() {
        OrgIdentityResolver.Resolution result = index.resolveOrg("없는부서");

        assertThat(result.code()).isNull();
        assertThat(result.candidates()).isEmpty();
    }

    @Test
    @DisplayName("빈 부서명은 후보 없이 미해석이며 예외를 던지지 않는다")
    void 빈_부서명은_미해석이다() {
        assertThat(index.resolveOrg("").code()).isNull();
        assertThat(index.resolveOrg(null).code()).isNull();
        assertThat(index.resolveOrg("-").code()).isNull();
    }

    @Test
    @DisplayName("이름+직위로 담당자 사번을 확정한다")
    void 이름과직위로_사번을_확정한다() {
        OrgIdentityResolver.Resolution result = index.resolveUser("김성원 과장", null);

        assertThat(result.code()).isEqualTo("100001");
        assertThat(result.label()).isEqualTo("김성원 과장");
    }

    @Test
    @DisplayName("직위가 없어도 이름이 유일하면 확정한다")
    void 직위없이_이름이_유일하면_확정한다() {
        assertThat(index.resolveUser("김성원", null).code()).isEqualTo("100001");
    }

    @Test
    @DisplayName("동명이인은 부서 힌트로 좁힌다")
    void 동명이인은_부서힌트로_좁힌다() {
        OrgIdentityResolver.Resolution result = index.resolveUser("장원섭", "0450");

        assertThat(result.code()).isEqualTo("100003");
    }

    @Test
    @DisplayName("부서 힌트로도 좁혀지지 않는 동명이인은 후보를 돌려준다")
    void 좁혀지지_않는_동명이인은_후보를_돌려준다() {
        OrgIdentityResolver.Resolution result = index.resolveUser("장원섭", null);

        assertThat(result.code()).isNull();
        assertThat(result.candidates())
                .extracting(com.kdb.it.domain.migration.dto.MigrationDto.Candidate::code)
                .containsExactlyInAnyOrder("100002", "100003");
    }

    @Test
    @DisplayName("조직코드로 조직명 스냅샷을 얻는다")
    void 조직코드로_조직명을_얻는다() {
        assertThat(index.orgNameOf("0210")).isEqualTo("IT기획부");
        assertThat(index.orgNameOf("9999")).isNull();
    }

    @Test
    @DisplayName("사번으로 소속 팀코드를 얻는다")
    void 사번으로_팀코드를_얻는다() {
        assertThat(index.teamOfUser("100001")).isEqualTo("0211");
        assertThat(index.teamOfUser("999999")).isNull();
    }

    private static CorgnI org(String code, String name) {
        return CorgnI.builder().prlmOgzCCone(code).bbrNm(name).build();
    }

    private static CuserI user(
            String eno, String name, String title, String bbrC, String temC, String temNm) {
        return CuserI.builder()
                .eno(eno)
                .usrNm(name)
                .ptCNm(title)
                .bbrC(bbrC)
                .temC(temC)
                .temNm(temNm)
                .build();
    }
}
```

- [ ] **Step 2: 리포지토리 조회 메서드가 있는지 확인한다**

`findByDelYn("N")`이 `OrganizationRepository`·`UserRepository`에 없으면 추가한다.

```bash
cd /c/it/it_backend && grep -n "findByDelYn\|interface " src/main/java/com/kdb/it/common/iam/repository/OrganizationRepository.java src/main/java/com/kdb/it/common/iam/repository/UserRepository.java
```

없으면 두 인터페이스에 각각 추가한다.

```java
    /**
     * 미삭제 조직 전체를 조회합니다. 이관 dry-run의 이름 → 코드 역방향 인덱스 구축에 사용합니다.
     *
     * @param delYn 삭제여부 ('N')
     * @return 미삭제 조직 목록
     */
    List<CorgnI> findByDelYn(String delYn);
```

`CorgnI`에는 `@Builder`가 없으면 테스트가 컴파일되지 않는다. `CorgnI`는 `@SuperBuilder`를 갖고 있으므로 `CorgnI.builder()`가 동작한다 — 확인하고 없으면 테스트를 생성자 기반으로 바꾼다.

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*OrgIdentityResolverTest' --no-daemon`
Expected: 컴파일 실패 — `OrgIdentityResolver` 없음

- [ ] **Step 4: `OrgIdentityResolver`를 구현한다**

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.common.iam.entity.CorgnI;
import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.OrganizationRepository;
import com.kdb.it.common.iam.repository.UserRepository;
import com.kdb.it.domain.migration.dto.MigrationDto;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 엑셀의 부서명·팀명·담당자명을 조직코드·사번으로 해석합니다.
 *
 * <p>수기 엑셀에는 코드가 전혀 없고 이름만 있습니다. 행마다 DB를 조회하면 N+1이 되므로 {@link #snapshot()}으로 조직·사용자를 각 1회 전량 읽어
 * 메모리 인덱스를 만들고, 그 인덱스에서 매칭합니다. 조직·직원 규모가 작아 전량 로드가 타당합니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OrgIdentityResolver {

    /** 팀·부서 미지정을 뜻하는 엑셀 표기. 이 값들은 해석하지 않고 미해석으로 둡니다. */
    private static final List<String> BLANK_TOKENS = List.of("", "-", "–", "없음", "해당없음");

    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;

    /**
     * 해석 결과입니다.
     *
     * @param code 확정된 코드값. 미확정이면 null
     * @param label 확정된 표시명. 미확정이면 입력 원문
     * @param candidates 중의적일 때의 후보. 확정·미해석이면 빈 목록
     */
    public record Resolution(String code, String label, List<MigrationDto.Candidate> candidates) {

        /** 확정 결과를 만듭니다. */
        static Resolution of(String code, String label) {
            return new Resolution(code, label, List.of());
        }

        /** 후보 없는 미해석 결과를 만듭니다. */
        static Resolution unresolved(String input) {
            return new Resolution(null, input, List.of());
        }

        /** 후보가 있는 중의적 결과를 만듭니다. */
        static Resolution ambiguous(String input, List<MigrationDto.Candidate> candidates) {
            return new Resolution(null, input, List.copyOf(candidates));
        }

        /** 확정되지 않았고 후보도 없는 상태인지 판정합니다. */
        public boolean isUnresolved() {
            return code == null && candidates.isEmpty();
        }

        /** 확정되지 않았으나 후보가 있는 상태인지 판정합니다. */
        public boolean isAmbiguous() {
            return code == null && !candidates.isEmpty();
        }
    }

    /**
     * 조직·사용자 전량 스냅샷 인덱스를 만듭니다.
     *
     * <p>dry-run·commit 각 호출의 시작에서 한 번만 만들고 그 호출 안에서 재사용합니다. 트랜잭션 밖에서 오래 들고 있지 않습니다.
     *
     * @return 이름 → 코드 매칭 인덱스
     */
    public Index snapshot() {
        return new Index(organizationRepository.findByDelYn("N"), userRepository.findByDelYn("N"));
    }

    /** 이름 → 코드 역방향 매칭 인덱스입니다. 한 요청 처리 동안만 살아 있습니다. */
    public static final class Index {

        private final Map<String, CorgnI> orgByExactName = new LinkedHashMap<>();
        private final Map<String, CorgnI> orgByNormalizedName = new LinkedHashMap<>();
        private final Map<String, String> orgNameByCode = new LinkedHashMap<>();
        private final List<CorgnI> allOrgs;
        private final List<CuserI> allUsers;
        private final Map<String, CuserI> userByEno = new LinkedHashMap<>();

        private Index(List<CorgnI> orgs, List<CuserI> users) {
            this.allOrgs = List.copyOf(orgs);
            this.allUsers = List.copyOf(users);
            for (CorgnI org : orgs) {
                if (org.getBbrNm() != null) {
                    orgByExactName.putIfAbsent(org.getBbrNm(), org);
                    orgByNormalizedName.putIfAbsent(normalize(org.getBbrNm()), org);
                }
                orgNameByCode.put(org.getPrlmOgzCCone(), org.getBbrNm());
            }
            for (CuserI user : users) {
                userByEno.put(user.getEno(), user);
            }
        }

        /**
         * 부서명·팀명을 조직코드로 해석합니다.
         *
         * <p>3단계로 좁힙니다. ① 정확 일치 ② 공백·괄호를 제거한 정규화 일치 ③ 부분 일치. ③에서 후보가 둘 이상이면 확정하지 않고 후보를 돌려줍니다.
         *
         * @param name 엑셀 부서명·팀명. null·공백·`-` 같은 미지정 표기는 미해석으로 처리
         * @return 해석 결과
         */
        public Resolution resolveOrg(String name) {
            if (isBlankToken(name)) {
                return Resolution.unresolved(name == null ? "" : name);
            }
            CorgnI exact = orgByExactName.get(name);
            if (exact != null) {
                return Resolution.of(exact.getPrlmOgzCCone(), exact.getBbrNm());
            }
            CorgnI normalized = orgByNormalizedName.get(normalize(name));
            if (normalized != null) {
                return Resolution.of(normalized.getPrlmOgzCCone(), normalized.getBbrNm());
            }
            String needle = normalize(name);
            List<MigrationDto.Candidate> partial = new ArrayList<>();
            for (CorgnI org : allOrgs) {
                if (org.getBbrNm() == null) {
                    continue;
                }
                String hay = normalize(org.getBbrNm());
                if (hay.contains(needle) || needle.contains(hay)) {
                    partial.add(
                            new MigrationDto.Candidate(org.getPrlmOgzCCone(), org.getBbrNm()));
                }
            }
            if (partial.size() == 1) {
                MigrationDto.Candidate only = partial.get(0);
                return Resolution.of(only.code(), only.label());
            }
            return partial.isEmpty()
                    ? Resolution.unresolved(name)
                    : Resolution.ambiguous(name, partial);
        }

        /**
         * `김성원 과장` 형태의 담당자 표기를 사번으로 해석합니다.
         *
         * <p>공백으로 이름과 직위를 분리해 사용자명+직위명으로 좁히고, 직위가 없거나 일치하지 않으면 이름만으로 좁힙니다. 그래도 둘 이상이면
         * {@code deptCodeHint}(같은 행의 주관부서코드)로 한 번 더 좁힙니다.
         *
         * @param nameWithTitle 엑셀 담당자 표기. null·공백은 미해석
         * @param deptCodeHint 같은 행에서 해석된 부서코드. 없으면 null
         * @return 해석 결과
         */
        public Resolution resolveUser(String nameWithTitle, String deptCodeHint) {
            if (isBlankToken(nameWithTitle)) {
                return Resolution.unresolved(nameWithTitle == null ? "" : nameWithTitle);
            }
            String trimmed = nameWithTitle.trim();
            int lastSpace = trimmed.lastIndexOf(' ');
            String name = lastSpace > 0 ? trimmed.substring(0, lastSpace).trim() : trimmed;
            String title = lastSpace > 0 ? trimmed.substring(lastSpace + 1).trim() : null;

            List<CuserI> byName = new ArrayList<>();
            for (CuserI user : allUsers) {
                if (name.equals(user.getUsrNm())) {
                    byName.add(user);
                }
            }
            if (byName.isEmpty()) {
                return Resolution.unresolved(nameWithTitle);
            }
            List<CuserI> narrowed = byName;
            if (title != null && byName.size() > 1) {
                List<CuserI> byTitle = new ArrayList<>();
                for (CuserI user : byName) {
                    if (title.equals(user.getPtCNm())) {
                        byTitle.add(user);
                    }
                }
                if (!byTitle.isEmpty()) {
                    narrowed = byTitle;
                }
            }
            if (narrowed.size() > 1 && deptCodeHint != null && !deptCodeHint.isBlank()) {
                List<CuserI> byDept = new ArrayList<>();
                for (CuserI user : narrowed) {
                    if (deptCodeHint.equals(user.getBbrC())) {
                        byDept.add(user);
                    }
                }
                if (!byDept.isEmpty()) {
                    narrowed = byDept;
                }
            }
            if (narrowed.size() == 1) {
                CuserI only = narrowed.get(0);
                return Resolution.of(only.getEno(), label(only));
            }
            List<MigrationDto.Candidate> candidates = new ArrayList<>();
            for (CuserI user : narrowed) {
                candidates.add(new MigrationDto.Candidate(user.getEno(), label(user)));
            }
            return Resolution.ambiguous(nameWithTitle, candidates);
        }

        /**
         * 조직코드에 해당하는 조직명을 반환합니다. 스냅샷 컬럼(SVN_DPM_NM 등) 채우기에 사용합니다.
         *
         * @param code 조직코드
         * @return 조직명. 미등록이면 null
         */
        public String orgNameOf(String code) {
            return code == null ? null : orgNameByCode.get(code);
        }

        /**
         * 사번의 소속 팀코드를 반환합니다.
         *
         * @param eno 사번
         * @return 팀코드. 미등록이면 null
         */
        public String teamOfUser(String eno) {
            CuserI user = eno == null ? null : userByEno.get(eno);
            return user == null ? null : user.getTemC();
        }

        /**
         * 사번의 소속 팀명을 반환합니다.
         *
         * @param eno 사번
         * @return 팀명. 미등록이면 null
         */
        public String teamNameOfUser(String eno) {
            CuserI user = eno == null ? null : userByEno.get(eno);
            return user == null ? null : user.getTemNm();
        }

        private static String label(CuserI user) {
            return user.getPtCNm() == null
                    ? user.getUsrNm()
                    : user.getUsrNm() + " " + user.getPtCNm();
        }

        private static boolean isBlankToken(String value) {
            return value == null || BLANK_TOKENS.contains(value.trim());
        }

        /** 공백·괄호·중점을 제거해 표기 차이를 흡수합니다. */
        private static String normalize(String value) {
            return value.replaceAll("[\\s()\\[\\]·]", "");
        }
    }
}
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*OrgIdentityResolverTest' --no-daemon`
Expected: PASS (11 tests)

- [ ] **Step 6: 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 이관용 부서·팀·담당자 이름 역방향 해석기 추가"
```

---

### Task 5: 연도 스냅샷과 진단 카탈로그

중복 판정(§6.2)과 Task 11의 "연도 전체 `items`" 구성이 같은 데이터를 필요로 하므로 연도 스냅샷을 한 번만 읽어 공유한다. 진단 카탈로그는 그 스냅샷 위에서 셀 단위 진단을 만든다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/repository/PlanRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationYearSnapshot.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationValidator.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationValidatorTest.java`

**Interfaces:**
- Produces: `CostRepository.findByBseYyAndLstYnAndDelYn(String bseYy, String lstYn, String delYn)` → `List<Bcostm>`
- Produces: `ProjectRepository.findByBseYyAndLstYnAndDelYn(String bseYy, String lstYn, String delYn)` → `List<Bprojm>`
- Produces: `PlanRepository.existsByBseYyAndItPtlPlnTpCAndDelYn(String bseYy, String itPtlPlnTpC, String delYn)` → `boolean`
- Produces: `MigrationYearSnapshot.load(String bseYy)` → `MigrationYearSnapshot.Data`
- Produces: `Data.costNaturalKeys()` → `Set<String>`, `Data.projectNamesNormalized()` → `Set<String>`, `Data.projectNoByName(String normalizedName)` → `String`, `Data.planExists(String plnTp)` → `boolean`, `Data.existingRateOf(String orcTb, String orcPkVl)` → `Integer`, `Data.allProjectNos()` → `List<String>`, `Data.allCostNos()` → `List<String>`
- Produces: `MigrationValidator.validate(List<SheetPayload> sheets, Index index, Data snapshot, Map<String,String> resolvedOverrides)` → `List<MigrationDto.CellDiagnostic>`
- Produces: `MigrationValidator.overrideKey(SheetKind sheet, int excelRow, String column)` → `String` (보정값 조회 키. commit이 `CellOverride` 목록을 이 키의 맵으로 접어 넘긴다)

- [ ] **Step 1: 리포지토리 조회 메서드를 추가한다**

`CostRepository.java`에 추가한다.

```java
    /**
     * 예산연도의 최종·미삭제 전산업무비 전체를 조회합니다.
     *
     * <p>수기 엑셀 이관의 중복 판정과 편성률 재적용 대상 구성에 사용합니다. 연도 단위라 행 수가 제한적이므로 전량 로드가 타당합니다.
     *
     * @param bseYy 예산연도 (4자리)
     * @param lstYn 최종여부 ('Y')
     * @param delYn 삭제여부 ('N')
     * @return 해당 연도의 최종·미삭제 전산업무비 목록
     */
    List<Bcostm> findByBseYyAndLstYnAndDelYn(String bseYy, String lstYn, String delYn);
```

`ProjectRepository.java`에 추가한다.

```java
    /**
     * 예산연도의 최종·미삭제 사업 전체를 조회합니다.
     *
     * <p>수기 엑셀 이관의 사업명 중복 판정과 편성률 재적용 대상 구성에 사용합니다.
     *
     * @param bseYy 예산연도 (4자리)
     * @param lstYn 최종여부 ('Y')
     * @param delYn 삭제여부 ('N')
     * @return 해당 연도의 최종·미삭제 사업 목록
     */
    List<Bprojm> findByBseYyAndLstYnAndDelYn(String bseYy, String lstYn, String delYn);
```

`PlanRepository.java`에 추가한다.

```java
    /**
     * 같은 연도·계획구분의 미삭제 계획이 있는지 확인합니다.
     *
     * <p>수기 엑셉 이관의 계획 중복 판정에 사용합니다.
     *
     * @param bseYy 대상연도 (4자리)
     * @param itPtlPlnTpC 계획구분 ('신규' 또는 '조정')
     * @param delYn 삭제여부 ('N')
     * @return 존재하면 true
     */
    boolean existsByBseYyAndItPtlPlnTpCAndDelYn(String bseYy, String itPtlPlnTpC, String delYn);
```

> `PlanRepository`의 실제 경로·이름을 먼저 확인한다: `ls src/main/java/com/kdb/it/domain/budget/plan/repository/`. 파일명이 다르면 그 파일에 추가한다.

- [ ] **Step 2: 실패하는 진단 테스트를 작성한다**

`it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationValidatorTest.java`

```java
package com.kdb.it.domain.migration.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 진단 카탈로그(§6.1)의 코드별 발생 조건을 고정합니다. */
class MigrationValidatorTest {

    private final MigrationValidator validator = new MigrationValidator();

    /** 부서명이 CORGNI에 없으면 BLOCKER. */
    @Test
    @DisplayName("미해석 부서명은 ORG_UNRESOLVED BLOCKER를 낸다")
    void 미해석_부서명은_블로커다() {
        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(costSheet(row(2, costCells(Map.of("deptName", "없는부서"))))),
                        TestFixtures.emptyIndex(),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result)
                .anySatisfy(
                        d -> {
                            assertThat(d.code()).isEqualTo("ORG_UNRESOLVED");
                            assertThat(d.severity()).isEqualTo(MigrationDto.Severity.BLOCKER);
                            assertThat(d.column()).isEqualTo("deptName");
                            assertThat(d.excelRow()).isEqualTo(2);
                        });
    }

    /** 후보가 둘 이상이면 ORG_AMBIGUOUS이며 후보가 함께 온다. */
    @Test
    @DisplayName("중의적 부서명은 ORG_AMBIGUOUS와 후보를 낸다")
    void 중의적_부서명은_후보를_낸다() {
        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(costSheet(row(2, costCells(Map.of("deptName", "금융공학"))))),
                        TestFixtures.indexWithOrgs("0450", "금융공학실", "0451", "금융공학실 퀀트인프라팀"),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result)
                .filteredOn(d -> "ORG_AMBIGUOUS".equals(d.code()))
                .singleElement()
                .satisfies(d -> assertThat(d.candidates()).hasSize(2));
    }

    /** 비목명이 코드표에 없으면 CODE_UNRESOLVED. 전산회의비·국외전산기타제비가 실제 사례다(§3.1). */
    @Test
    @DisplayName("코드표에 없는 비목명은 CODE_UNRESOLVED를 낸다")
    void 미등록_비목명은_코드미해석이다() {
        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(costSheet(row(2, costCells(Map.of("ioeName", "전산회의비"))))),
                        TestFixtures.indexWithIoe("001", "국내전산임차료"),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result)
                .anySatisfy(
                        d -> {
                            assertThat(d.code()).isEqualTo("CODE_UNRESOLVED");
                            assertThat(d.column()).isEqualTo("ioeName");
                        });
    }

    /** 보정값이 오면 해당 셀의 미해석 진단이 사라진다. */
    @Test
    @DisplayName("보정값이 있으면 그 셀의 미해석 진단을 내지 않는다")
    void 보정값이_있으면_진단을_내지_않는다() {
        Map<String, String> overrides =
                Map.of(MigrationValidator.overrideKey(SheetKind.COST, 2, "ioeName"), "008");

        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(costSheet(row(2, costCells(Map.of("ioeName", "외주용역비"))))),
                        TestFixtures.indexWithIoe("008", "외주용역(외주운영/관제 등)"),
                        TestFixtures.emptySnapshot("2026"),
                        overrides);

        assertThat(result).noneMatch(d -> "CODE_UNRESOLVED".equals(d.code()));
    }

    /** 필수값(계약명)이 비면 REQUIRED_MISSING. */
    @Test
    @DisplayName("계약명이 비면 REQUIRED_MISSING을 낸다")
    void 계약명이_비면_필수값누락이다() {
        Map<String, String> cells = costCells(Map.of("requestDetail", ""));

        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(costSheet(row(2, cells))),
                        TestFixtures.emptyIndex(),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result)
                .anySatisfy(
                        d -> {
                            assertThat(d.code()).isEqualTo("REQUIRED_MISSING");
                            assertThat(d.column()).isEqualTo("requestDetail");
                        });
    }

    /** 계약명 100자·비고 200자 초과는 LENGTH_EXCEEDED. */
    @Test
    @DisplayName("물리 길이를 넘는 값은 LENGTH_EXCEEDED를 낸다")
    void 길이초과는_블로커다() {
        Map<String, String> cells = costCells(Map.of("requestDetail", "가".repeat(101)));

        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(costSheet(row(2, cells))),
                        TestFixtures.emptyIndex(),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result)
                .anySatisfy(
                        d -> {
                            assertThat(d.code()).isEqualTo("LENGTH_EXCEEDED");
                            assertThat(d.severity()).isEqualTo(MigrationDto.Severity.BLOCKER);
                        });
    }

    /** 같은 자연키의 전산업무비가 이미 있으면 DUPLICATE_EXISTS. */
    @Test
    @DisplayName("자연키가 중복되면 DUPLICATE_EXISTS를 낸다")
    void 자연키_중복은_블로커다() {
        Map<String, String> cells =
                costCells(
                        Map.of(
                                "abusCode", "571",
                                "ioeName", "국내전산임차료",
                                "vendorName", "커브",
                                "requestDetail", "올인원워크스페이스"));

        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(costSheet(row(2, cells))),
                        TestFixtures.indexWithIoe("001", "국내전산임차료"),
                        TestFixtures.snapshotWithCostKey("2026", "2026|571|001|커브|올인원워크스페이스"),
                        Map.of());

        assertThat(result).anyMatch(d -> "DUPLICATE_EXISTS".equals(d.code()));
    }

    /** 외화 재계산값이 엑셀 원화열과 1원 넘게 다르면 WARNING. */
    @Test
    @DisplayName("금액 불일치는 AMOUNT_MISMATCH WARNING이며 반영을 막지 않는다")
    void 금액불일치는_경고다() {
        Map<String, String> cells =
                costCells(
                        Map.of(
                                "currency", "GBP",
                                "fcAmount", "2890",
                                "krwAmount", "9999")); // 2890 × 1924 / 1000 = 5560.36 이어야 한다

        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(costSheet(row(2, cells))),
                        TestFixtures.indexWithXcr("GBP", "1924"),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result)
                .filteredOn(d -> "AMOUNT_MISMATCH".equals(d.code()))
                .singleElement()
                .satisfies(d -> assertThat(d.severity()).isEqualTo(MigrationDto.Severity.WARNING));
    }

    /** 조정비율이 0~100 밖이면 WARNING. */
    @Test
    @DisplayName("편성률 범위를 벗어나면 RATE_OUT_OF_RANGE WARNING을 낸다")
    void 편성률_범위이탈은_경고다() {
        Map<String, String> cells = new LinkedHashMap<>(capitalCells());
        cells.put("adjustRate", "1.5");

        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(
                                new MigrationDto.SheetPayload(
                                        SheetKind.CAPITAL_PROJECT, "2026", List.of(row(2, cells)))),
                        TestFixtures.emptyIndex(),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result)
                .filteredOn(d -> "RATE_OUT_OF_RANGE".equals(d.code()))
                .singleElement()
                .satisfies(d -> assertThat(d.severity()).isEqualTo(MigrationDto.Severity.WARNING));
    }

    /** `'26.05` 형식이 아니면 WARNING이며 날짜를 null로 둔다. */
    @Test
    @DisplayName("파싱 불가 기간은 DATE_UNPARSEABLE WARNING을 낸다")
    void 파싱불가_기간은_경고다() {
        Map<String, String> cells = new LinkedHashMap<>(capitalCells());
        cells.put("startYm", "미정");

        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(
                                new MigrationDto.SheetPayload(
                                        SheetKind.CAPITAL_PROJECT, "2026", List.of(row(2, cells)))),
                        TestFixtures.emptyIndex(),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result).anyMatch(d -> "DATE_UNPARSEABLE".equals(d.code()));
    }

    /** 부문계획 행의 사업이 같은 반영에도 DB에도 없으면 PROJECT_NOT_FOUND BLOCKER. */
    @Test
    @DisplayName("대상 사업이 없는 부문계획 행은 PROJECT_NOT_FOUND를 낸다")
    void 대상사업이_없는_부문계획행은_블로커다() {
        Map<String, String> cells = new LinkedHashMap<>();
        for (String column :
                com.kdb.it.domain.migration.dto.MigrationColumns.of(SheetKind.PLAN_ADJUSTMENT)) {
            cells.put(column, "");
        }
        cells.put("projectName", "포탈에 없는 사업");

        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(
                                new MigrationDto.SheetPayload(
                                        SheetKind.PLAN_ADJUSTMENT, "2026", List.of(row(2, cells)))),
                        TestFixtures.emptyIndex(),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result).anyMatch(d -> "PROJECT_NOT_FOUND".equals(d.code()));
    }

    /** 같은 반영에 자본예산 행으로 들어오는 사업은 PROJECT_NOT_FOUND가 아니다. */
    @Test
    @DisplayName("같은 반영의 자본예산 시트에 있는 사업은 PROJECT_NOT_FOUND를 내지 않는다")
    void 같은반영에_있는_사업은_블로커가_아니다() {
        Map<String, String> capital = new LinkedHashMap<>(capitalCells());
        capital.put("projectName", "웹한글 기안기 도입");
        Map<String, String> plan = new LinkedHashMap<>();
        for (String column :
                com.kdb.it.domain.migration.dto.MigrationColumns.of(SheetKind.PLAN_ADJUSTMENT)) {
            plan.put(column, "");
        }
        plan.put("projectName", "웹한글 기안기 도입");

        List<MigrationDto.CellDiagnostic> result =
                validator.validate(
                        List.of(
                                new MigrationDto.SheetPayload(
                                        SheetKind.CAPITAL_PROJECT, "2026", List.of(row(2, capital))),
                                new MigrationDto.SheetPayload(
                                        SheetKind.PLAN_ADJUSTMENT, "2026", List.of(row(2, plan)))),
                        TestFixtures.emptyIndex(),
                        TestFixtures.emptySnapshot("2026"),
                        Map.of());

        assertThat(result).noneMatch(d -> "PROJECT_NOT_FOUND".equals(d.code()));
    }

    private static MigrationDto.SheetPayload costSheet(MigrationDto.NormalizedRow row) {
        return new MigrationDto.SheetPayload(SheetKind.COST, "2026", List.of(row));
    }

    private static MigrationDto.NormalizedRow row(int excelRow, Map<String, String> cells) {
        return new MigrationDto.NormalizedRow(excelRow, cells);
    }

    /** 전 컬럼을 유효한 기본값으로 채운 뒤 인자로 받은 것만 덮어씁니다. 검사 대상 외의 진단이 섞이지 않게 합니다. */
    private static Map<String, String> costCells(Map<String, String> overrides) {
        Map<String, String> cells = new HashMap<>();
        cells.put("abusCode", "571");
        cells.put("ioeName", "국내전산임차료");
        cells.put("abusTcLabel", "계속");
        cells.put("vendorName", "커브");
        cells.put("requestDetail", "올인원워크스페이스");
        cells.put("securityFlag", "");
        cells.put("terminalFlag", "");
        cells.put("deptName", "IT기획부");
        cells.put("teamName", "IT기획팀");
        cells.put("currency", "KRW");
        cells.put("fcAmount", "");
        cells.put("krwAmount", "15401");
        cells.put("remark", "전년도 동일수준");
        cells.putAll(overrides);
        return cells;
    }

    private static Map<String, String> capitalCells() {
        Map<String, String> cells = new HashMap<>();
        for (String column :
                com.kdb.it.domain.migration.dto.MigrationColumns.of(SheetKind.CAPITAL_PROJECT)) {
            cells.put(column, "");
        }
        cells.put("projectName", "테스트 사업");
        cells.put("progressLabel", "신규");
        cells.put("startYm", "'26.05");
        cells.put("endYm", "'26.12");
        cells.put("devAmount", "1406");
        cells.put("adjustRate", "0.7");
        return cells;
    }
}
```

- [ ] **Step 3: 테스트 픽스처 헬퍼를 작성한다**

`it_backend/src/test/java/com/kdb/it/domain/migration/service/TestFixtures.java`

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.common.iam.entity.CorgnI;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** MigrationValidator 단위 테스트용 인덱스·스냅샷 조립 헬퍼입니다. */
final class TestFixtures {

    private TestFixtures() {}

    /** 아무것도 해석되지 않는 빈 인덱스. */
    static MigrationLookupIndex emptyIndex() {
        return new MigrationLookupIndex(
                new OrgIdentityResolver(
                                (delYn) -> List.of(), (delYn) -> List.of())
                        .snapshot(),
                Map.of(),
                Map.of());
    }

    /** 조직만 담긴 인덱스. 인자는 (코드, 이름) 쌍의 반복입니다. */
    static MigrationLookupIndex indexWithOrgs(String... codeNamePairs) {
        List<CorgnI> orgs = new ArrayList<>();
        for (int i = 0; i < codeNamePairs.length; i += 2) {
            orgs.add(
                    CorgnI.builder()
                            .prlmOgzCCone(codeNamePairs[i])
                            .bbrNm(codeNamePairs[i + 1])
                            .build());
        }
        List<CorgnI> snapshot = List.copyOf(orgs);
        return new MigrationLookupIndex(
                new OrgIdentityResolver((delYn) -> snapshot, (delYn) -> List.of()).snapshot(),
                Map.of(),
                Map.of());
    }

    /** 비목 코드값명 → 코드값 맵만 담긴 인덱스. */
    static MigrationLookupIndex indexWithIoe(String code, String name) {
        return new MigrationLookupIndex(emptyIndex().org(), Map.of(name, code), Map.of());
    }

    /** 통화별 환율만 담긴 인덱스. */
    static MigrationLookupIndex indexWithXcr(String curC, String xcr) {
        return new MigrationLookupIndex(
                emptyIndex().org(), Map.of(), Map.of(curC, new BigDecimal(xcr)));
    }

    /** 기존 데이터가 없는 연도 스냅샷. */
    static MigrationYearSnapshot.Data emptySnapshot(String bseYy) {
        return new MigrationYearSnapshot.Data(
                bseYy, Set.of(), new LinkedHashMap<>(), Set.of(), new LinkedHashMap<>(), List.of());
    }

    /** 전산업무비 자연키 하나가 이미 있는 연도 스냅샷. */
    static MigrationYearSnapshot.Data snapshotWithCostKey(String bseYy, String naturalKey) {
        Set<String> keys = new LinkedHashSet<>();
        keys.add(naturalKey);
        return new MigrationYearSnapshot.Data(
                bseYy, keys, new LinkedHashMap<>(), Set.of(), new LinkedHashMap<>(), List.of());
    }
}
```

> `OrgIdentityResolver`가 리포지토리 인터페이스를 직접 의존하면 위 람다를 넘길 수 없다. Task 4에서 만든 생성자 주입 필드를 그대로 두되, **테스트가 조립할 수 있도록** `Index`의 생성자를 패키지-프라이빗 정적 팩토리 `Index.of(List<CorgnI>, List<CuserI>)`로 노출한다. 위 픽스처의 람다 표기는 그 팩토리 호출로 바꿔 쓴다 — `OrgIdentityResolver.Index.of(snapshot, List.of())`.

- [ ] **Step 4: `MigrationLookupIndex`와 `MigrationYearSnapshot`을 작성한다**

`MigrationLookupIndex.java`

```java
package com.kdb.it.domain.migration.service;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 한 요청 처리 동안 재사용하는 조회 인덱스 묶음입니다.
 *
 * @param org 조직·사용자 이름 역방향 인덱스
 * @param ioeCodeByName 비목 코드값명 → 코드값 (예: "국내전산임차료" → "001")
 * @param xcrByCurrency 통화 → 예산환율 (Ccodem C_TP='XCR')
 */
public record MigrationLookupIndex(
        OrgIdentityResolver.Index org,
        Map<String, String> ioeCodeByName,
        Map<String, BigDecimal> xcrByCurrency) {}
```

`MigrationYearSnapshot.java`

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.domain.budget.cost.entity.Bcostm;
import com.kdb.it.domain.budget.cost.repository.CostRepository;
import com.kdb.it.domain.budget.project.entity.Bprojm;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.budget.work.entity.Bbugtm;
import com.kdb.it.domain.budget.work.repository.BbugtmRepository;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 예산연도 하나의 기존 상태를 한 번에 읽어 둡니다.
 *
 * <p>중복 판정(§6.2)과 편성률 재적용 대상 구성(§7 5단계)이 같은 데이터를 필요로 하므로 각 요청에서 한 번만 읽습니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MigrationYearSnapshot {

    private final CostRepository costRepository;
    private final ProjectRepository projectRepository;
    private final BbugtmRepository bbugtmRepository;
    private final com.kdb.it.domain.budget.plan.repository.PlanRepository planRepository;

    /**
     * 연도 스냅샷 데이터입니다.
     *
     * @param bseYy 예산연도
     * @param costNaturalKeys 기존 전산업무비 자연키 집합 (§6.2 형식)
     * @param projectNoByNormalizedName 정규화 사업명 → 사업관리번호
     * @param existingPlanTypes 이미 존재하는 계획구분 집합
     * @param existingRateByOrigin `{orcTb}|{orcPkVl}` → 기존 편성률
     * @param allCostNos 그 연도의 전산업무비 관리번호 전체
     */
    public record Data(
            String bseYy,
            Set<String> costNaturalKeys,
            Map<String, String> projectNoByNormalizedName,
            Set<String> existingPlanTypes,
            Map<String, Integer> existingRateByOrigin,
            List<String> allCostNos) {

        /** 정규화 사업명에 대응하는 기존 사업관리번호를 반환합니다. 없으면 null. */
        public String projectNoByName(String normalizedName) {
            return projectNoByNormalizedName.get(normalizedName);
        }

        /** 그 연도에 해당 계획구분의 계획이 이미 있는지 판정합니다. */
        public boolean planExists(String plnTp) {
            return existingPlanTypes.contains(plnTp);
        }

        /** 원천(테이블, PK)의 기존 편성률을 반환합니다. 없으면 null. */
        public Integer existingRateOf(String orcTb, String orcPkVl) {
            return existingRateByOrigin.get(orcTb + "|" + orcPkVl);
        }

        /** 그 연도 사업관리번호 전체를 반환합니다. */
        public List<String> allProjectNos() {
            return List.copyOf(projectNoByNormalizedName.values());
        }
    }

    /**
     * 예산연도의 기존 상태를 읽습니다.
     *
     * @param bseYy 예산연도 (4자리)
     * @return 스냅샷 데이터
     */
    public Data load(String bseYy) {
        Set<String> costKeys = new LinkedHashSet<>();
        List<String> costNos = new java.util.ArrayList<>();
        for (Bcostm cost : costRepository.findByBseYyAndLstYnAndDelYn(bseYy, "Y", "N")) {
            costKeys.add(costNaturalKey(cost));
            costNos.add(cost.getCostBgNo());
        }
        Map<String, String> projectByName = new LinkedHashMap<>();
        for (Bprojm project : projectRepository.findByBseYyAndLstYnAndDelYn(bseYy, "Y", "N")) {
            projectByName.putIfAbsent(normalizeName(project.getAbusNm()), project.getAbusMngNo());
        }
        Set<String> planTypes = new LinkedHashSet<>();
        for (String plnTp : List.of("신규", "조정")) {
            if (planRepository.existsByBseYyAndItPtlPlnTpCAndDelYn(bseYy, plnTp, "N")) {
                planTypes.add(plnTp);
            }
        }
        Map<String, Integer> rateByOrigin = new LinkedHashMap<>();
        for (Bbugtm budget : bbugtmRepository.findByBseYyAndDelYn(bseYy, "N")) {
            rateByOrigin.putIfAbsent(
                    budget.getFntTbNm() + "|" + budget.getPkColNm(), budget.getAsgRt());
        }
        return new Data(bseYy, costKeys, projectByName, planTypes, rateByOrigin, costNos);
    }

    /**
     * 전산업무비 자연키를 만듭니다. §6.2의 `(BSE_YY, BG_UNT_ABUS_C, IOE_C, CTT_OPP_NM, CTT_NM)` 조합입니다.
     *
     * @param cost 전산업무비 엔티티
     * @return 파이프로 이은 자연키
     */
    public static String costNaturalKey(Bcostm cost) {
        return costNaturalKey(
                cost.getBseYy(),
                cost.getBgUntAbusC(),
                cost.getIoeC(),
                cost.getCttOppNm(),
                cost.getCttNm());
    }

    /**
     * 값으로 전산업무비 자연키를 만듭니다. 어댑터가 엑셀 행에서 같은 키를 만들어 중복을 판정합니다.
     *
     * @param bseYy 예산연도
     * @param abusCode 사업코드
     * @param ioeC 비목코드
     * @param vendorName 계약상대처명
     * @param contractName 계약명
     * @return 파이프로 이은 자연키. null 값은 빈 문자열로 접습니다
     */
    public static String costNaturalKey(
            String bseYy, String abusCode, String ioeC, String vendorName, String contractName) {
        return String.join(
                "|",
                nz(bseYy),
                nz(abusCode),
                nz(ioeC),
                nz(vendorName).trim(),
                nz(contractName).trim());
    }

    /** 사업명을 공백 압축해 동일성 판정 키로 만듭니다. */
    public static String normalizeName(String name) {
        return name == null ? "" : name.replaceAll("\\s+", "");
    }

    private static String nz(String value) {
        return value == null ? "" : value;
    }
}
```

- [ ] **Step 5: `MigrationValidator`를 구현한다**

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * 정규화 행에 대한 셀 단위 진단을 만듭니다 (§6.1).
 *
 * <p>dry-run과 commit이 같은 인스턴스를 호출합니다. commit은 클라이언트가 보낸 값을 신뢰하지 않고 이 검증을 다시 돌린 뒤 BLOCKER가 하나라도
 * 있으면 아무것도 쓰지 않고 실패합니다.
 */
@Component
public class MigrationValidator {

    /** `'26.05` 또는 `26.05` 형태의 연월 표기. */
    private static final Pattern YM = Pattern.compile("^'?(\\d{2})\\.(\\d{1,2})월?$");

    /** 원화 금액 대조 허용 오차 (원). */
    private static final BigDecimal AMOUNT_TOLERANCE = BigDecimal.ONE;

    /** 시트별 금액 배수 — 엑셀 단위를 원 단위로 올립니다 (§3.4). */
    private static BigDecimal amountMultiplier(SheetKind kind) {
        return switch (kind) {
            case COST -> new BigDecimal("1000");
            case CAPITAL_PROJECT, PLAN_ADJUSTMENT -> new BigDecimal("1000000");
            case DELEGATED_BUDGET -> BigDecimal.ONE;
        };
    }

    /**
     * 보정값 조회 키를 만듭니다. commit이 {@code CellOverride} 목록을 이 키의 맵으로 접어 넘깁니다.
     *
     * @param sheet 시트 종류
     * @param excelRow 엑셀 행 번호
     * @param column 정규 컬럼 id
     * @return 파이프로 이은 키
     */
    public static String overrideKey(SheetKind sheet, int excelRow, String column) {
        return sheet.name() + "|" + excelRow + "|" + column;
    }

    /**
     * 시트 전체를 검증해 진단 목록을 만듭니다.
     *
     * @param sheets 올린 시트 목록
     * @param index 조직·비목·환율 조회 인덱스
     * @param snapshot 예산연도 기존 상태
     * @param overrides 보정값 맵 ({@link #overrideKey} 키)
     * @return 진단 목록. 문제가 없으면 빈 목록
     */
    public List<MigrationDto.CellDiagnostic> validate(
            List<MigrationDto.SheetPayload> sheets,
            MigrationLookupIndex index,
            MigrationYearSnapshot.Data snapshot,
            Map<String, String> overrides) {
        List<MigrationDto.CellDiagnostic> out = new ArrayList<>();
        Set<String> namesInThisImport = collectProjectNames(sheets);

        for (MigrationDto.SheetPayload sheet : sheets) {
            for (MigrationDto.NormalizedRow row : sheet.rows()) {
                switch (sheet.kind()) {
                    case COST -> validateCostRow(sheet, row, index, snapshot, overrides, out);
                    case CAPITAL_PROJECT ->
                            validateProjectRow(sheet, row, index, snapshot, overrides, out);
                    case DELEGATED_BUDGET ->
                            validateDelegatedRow(sheet, row, index, overrides, out);
                    case PLAN_ADJUSTMENT ->
                            validatePlanRow(
                                    sheet, row, index, snapshot, namesInThisImport, overrides, out);
                }
            }
        }
        return out;
    }

    /** 같은 반영에 포함된 사업명(자본예산·위임예산)을 모읍니다. PROJECT_NOT_FOUND 판정 기준입니다. */
    private Set<String> collectProjectNames(List<MigrationDto.SheetPayload> sheets) {
        Set<String> names = new LinkedHashSet<>();
        for (MigrationDto.SheetPayload sheet : sheets) {
            if (sheet.kind() != SheetKind.CAPITAL_PROJECT) {
                continue;
            }
            for (MigrationDto.NormalizedRow row : sheet.rows()) {
                names.add(
                        MigrationYearSnapshot.normalizeName(cell(row, "projectName", Map.of(), sheet)));
            }
        }
        return names;
    }

    private void validateCostRow(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            MigrationLookupIndex index,
            MigrationYearSnapshot.Data snapshot,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out) {
        requireText(sheet, row, "requestDetail", 100, overrides, out);
        limitLength(sheet, row, "remark", 200, overrides, out);
        resolveOrgCell(sheet, row, "deptName", index, overrides, out, true);
        resolveOrgCell(sheet, row, "teamName", index, overrides, out, false);

        String ioeName = cell(row, "ioeName", overrides, sheet);
        String ioeCode = overrides.get(overrideKey(sheet.kind(), row.excelRow(), "ioeName"));
        if (ioeCode == null) {
            ioeCode = index.ioeCodeByName().get(ioeName);
        }
        if (ioeCode == null) {
            out.add(
                    blocker(
                            sheet,
                            row,
                            "ioeName",
                            "CODE_UNRESOLVED",
                            "비목 '" + ioeName + "'에 대응하는 비목코드를 찾지 못했습니다. 비목을 직접 선택해 주세요.",
                            candidatesOfIoe(index)));
        }

        checkAmount(sheet, row, index, out);

        if (ioeCode != null) {
            String key =
                    MigrationYearSnapshot.costNaturalKey(
                            sheet.bseYy(),
                            cell(row, "abusCode", overrides, sheet),
                            ioeCode,
                            cell(row, "vendorName", overrides, sheet),
                            cell(row, "requestDetail", overrides, sheet));
            if (snapshot.costNaturalKeys().contains(key)) {
                out.add(
                        blocker(
                                sheet,
                                row,
                                null,
                                "DUPLICATE_EXISTS",
                                "같은 사업코드·비목·계약상대처·계약명의 전산업무비가 이미 있습니다. 이 행은 제외하거나 기존 행을 확인해 주세요.",
                                List.of()));
            }
        }
    }

    private void validateProjectRow(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            MigrationLookupIndex index,
            MigrationYearSnapshot.Data snapshot,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out) {
        requireText(sheet, row, "projectName", 100, overrides, out);
        resolveOrgCell(sheet, row, "deptName", index, overrides, out, true);
        resolveOrgCell(sheet, row, "teamName", index, overrides, out, false);
        resolveUserCell(sheet, row, "managerName", "deptName", index, overrides, out);
        resolveUserCell(sheet, row, "teamLeaderName", "deptName", index, overrides, out);
        checkYm(sheet, row, "startYm", overrides, out);
        checkYm(sheet, row, "endYm", overrides, out);
        checkRate(sheet, row, "adjustRate", overrides, out);

        String normalized =
                MigrationYearSnapshot.normalizeName(cell(row, "projectName", overrides, sheet));
        if (snapshot.projectNoByName(normalized) != null) {
            out.add(
                    blocker(
                            sheet,
                            row,
                            "projectName",
                            "DUPLICATE_EXISTS",
                            "같은 예산연도에 같은 사업명의 사업이 이미 있습니다.",
                            List.of()));
        }
    }

    private void validateDelegatedRow(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            MigrationLookupIndex index,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out) {
        requireText(sheet, row, "itemName", 100, overrides, out);
        resolveOrgCell(sheet, row, "branchName", index, overrides, out, true);
        checkAmount(sheet, row, index, out);
    }

    private void validatePlanRow(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            MigrationLookupIndex index,
            MigrationYearSnapshot.Data snapshot,
            Set<String> namesInThisImport,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out) {
        requireText(sheet, row, "projectName", 100, overrides, out);
        checkYm(sheet, row, "startYm", overrides, out);
        checkYm(sheet, row, "endYm", overrides, out);

        String normalized =
                MigrationYearSnapshot.normalizeName(cell(row, "projectName", overrides, sheet));
        boolean inImport = namesInThisImport.contains(normalized);
        boolean inDb = snapshot.projectNoByName(normalized) != null;
        if (!inImport && !inDb) {
            out.add(
                    blocker(
                            sheet,
                            row,
                            "projectName",
                            "PROJECT_NOT_FOUND",
                            "이 사업이 같은 반영의 자본예산 시트에도, 포탈에도 없습니다. 자본예산 편성요구서를 함께 올리거나 사업명을 확인해 주세요.",
                            List.of()));
        }
        if (snapshot.planExists("조정")) {
            out.add(
                    blocker(
                            sheet,
                            row,
                            null,
                            "DUPLICATE_EXISTS",
                            sheet.bseYy() + "년 조정 계획이 이미 있습니다.",
                            List.of()));
        }
    }

    /** 외화 행의 서버 재계산값을 엑셀 원화열과 대조합니다 (§3.7). */
    private void checkAmount(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            MigrationLookupIndex index,
            List<MigrationDto.CellDiagnostic> out) {
        String currency = cell(row, "currency", Map.of(), sheet);
        String fcColumn = sheet.kind() == SheetKind.DELEGATED_BUDGET ? "hwFcAmount" : "fcAmount";
        String krwColumn = sheet.kind() == SheetKind.DELEGATED_BUDGET ? "hwKrwAmount" : "krwAmount";
        BigDecimal fc = number(cell(row, fcColumn, Map.of(), sheet));
        BigDecimal krw = number(cell(row, krwColumn, Map.of(), sheet));
        if (currency.isBlank() || "KRW".equals(currency) || fc == null || krw == null) {
            return;
        }
        BigDecimal xcr = index.xcrByCurrency().get(currency);
        if (xcr == null) {
            out.add(
                    blocker(
                            sheet,
                            row,
                            "currency",
                            "CODE_UNRESOLVED",
                            "통화 '" + currency + "'의 예산환율이 공통코드에 없습니다. 환율 시드를 먼저 적용해 주세요.",
                            List.of()));
            return;
        }
        // JPY는 엑셀 외화열이 천엔이므로 엔으로 올린다 (§5.1)
        BigDecimal fcInBaseUnit = "JPY".equals(currency) ? fc.multiply(new BigDecimal("1000")) : fc;
        BigDecimal recomputed = fcInBaseUnit.multiply(xcr).setScale(3, RoundingMode.HALF_UP);
        BigDecimal excelKrw =
                krw.multiply(amountMultiplier(sheet.kind())).setScale(3, RoundingMode.HALF_UP);
        if (recomputed.subtract(excelKrw).abs().compareTo(AMOUNT_TOLERANCE) > 0) {
            out.add(
                    warning(
                            sheet,
                            row,
                            krwColumn,
                            "AMOUNT_MISMATCH",
                            "서버 재계산액 "
                                    + recomputed.stripTrailingZeros().toPlainString()
                                    + "원이 엑셀 원화열 "
                                    + excelKrw.stripTrailingZeros().toPlainString()
                                    + "원과 다릅니다. 재계산액으로 저장됩니다."));
        }
    }

    private void checkRate(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out) {
        BigDecimal rate = number(cell(row, column, overrides, sheet));
        if (rate == null) {
            return;
        }
        BigDecimal percent = rate.multiply(new BigDecimal("100"));
        if (percent.compareTo(BigDecimal.ZERO) < 0
                || percent.compareTo(new BigDecimal("100")) > 0) {
            out.add(
                    warning(
                            sheet,
                            row,
                            column,
                            "RATE_OUT_OF_RANGE",
                            "조정비율 " + rate.toPlainString() + "이 0~1 범위를 벗어났습니다. 편성률은 0~100으로 잘립니다."));
        }
    }

    private void checkYm(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out) {
        String value = cell(row, column, overrides, sheet);
        if (value.isBlank()) {
            return;
        }
        if (!YM.matcher(value.trim()).matches()) {
            out.add(
                    warning(
                            sheet,
                            row,
                            column,
                            "DATE_UNPARSEABLE",
                            "'" + value + "'을 연월로 읽지 못했습니다. 날짜가 비워진 채 저장됩니다."));
        }
    }

    private void requireText(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            int maxLength,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out) {
        String value = cell(row, column, overrides, sheet);
        if (value.isBlank()) {
            out.add(
                    blocker(
                            sheet, row, column, "REQUIRED_MISSING", "필수 값이 비어 있습니다.", List.of()));
            return;
        }
        limitLength(sheet, row, column, maxLength, overrides, out);
    }

    private void limitLength(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            int maxLength,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out) {
        String value = cell(row, column, overrides, sheet);
        if (value.length() > maxLength) {
            out.add(
                    blocker(
                            sheet,
                            row,
                            column,
                            "LENGTH_EXCEEDED",
                            "값이 " + value.length() + "자로 최대 " + maxLength + "자를 넘습니다.",
                            List.of()));
        }
    }

    private void resolveOrgCell(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            MigrationLookupIndex index,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out,
            boolean required) {
        if (overrides.containsKey(overrideKey(sheet.kind(), row.excelRow(), column))) {
            return;
        }
        String value = cell(row, column, overrides, sheet);
        OrgIdentityResolver.Resolution resolution = index.org().resolveOrg(value);
        if (resolution.code() != null) {
            return;
        }
        if (resolution.isAmbiguous()) {
            out.add(
                    blocker(
                            sheet,
                            row,
                            column,
                            "ORG_AMBIGUOUS",
                            "'" + value + "'에 해당하는 조직이 여러 개입니다. 하나를 선택해 주세요.",
                            resolution.candidates()));
            return;
        }
        if (required || !value.isBlank()) {
            out.add(
                    blocker(
                            sheet,
                            row,
                            column,
                            "ORG_UNRESOLVED",
                            "'" + value + "'에 해당하는 조직을 찾지 못했습니다. 조직을 선택해 주세요.",
                            List.of()));
        }
    }

    private void resolveUserCell(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            String deptColumn,
            MigrationLookupIndex index,
            Map<String, String> overrides,
            List<MigrationDto.CellDiagnostic> out) {
        if (overrides.containsKey(overrideKey(sheet.kind(), row.excelRow(), column))) {
            return;
        }
        String value = cell(row, column, overrides, sheet);
        if (value.isBlank()) {
            return;
        }
        String deptHint =
                index.org().resolveOrg(cell(row, deptColumn, overrides, sheet)).code();
        OrgIdentityResolver.Resolution resolution = index.org().resolveUser(value, deptHint);
        if (resolution.code() != null) {
            return;
        }
        out.add(
                blocker(
                        sheet,
                        row,
                        column,
                        resolution.isAmbiguous() ? "USER_AMBIGUOUS" : "USER_UNRESOLVED",
                        resolution.isAmbiguous()
                                ? "'" + value + "'에 해당하는 직원이 여러 명입니다. 한 명을 선택해 주세요."
                                : "'" + value + "'에 해당하는 직원을 찾지 못했습니다. 담당자를 선택해 주세요.",
                        resolution.candidates()));
    }

    private static List<MigrationDto.Candidate> candidatesOfIoe(MigrationLookupIndex index) {
        List<MigrationDto.Candidate> out = new ArrayList<>();
        index.ioeCodeByName().forEach((name, code) -> out.add(new MigrationDto.Candidate(code, name)));
        return out;
    }

    private static MigrationDto.CellDiagnostic blocker(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            String code,
            String message,
            List<MigrationDto.Candidate> candidates) {
        return new MigrationDto.CellDiagnostic(
                sheet.kind(),
                row.excelRow(),
                column,
                code,
                MigrationDto.Severity.BLOCKER,
                message,
                candidates);
    }

    private static MigrationDto.CellDiagnostic warning(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            String code,
            String message) {
        return new MigrationDto.CellDiagnostic(
                sheet.kind(),
                row.excelRow(),
                column,
                code,
                MigrationDto.Severity.WARNING,
                message,
                List.of());
    }

    /** 보정값이 있으면 그 값을, 없으면 원본 셀 값을 반환합니다. null은 빈 문자열로 접습니다. */
    private static String cell(
            MigrationDto.NormalizedRow row,
            String column,
            Map<String, String> overrides,
            MigrationDto.SheetPayload sheet) {
        String override = overrides.get(overrideKey(sheet.kind(), row.excelRow(), column));
        if (override != null) {
            return override;
        }
        String value = row.cells().get(column);
        return value == null ? "" : value;
    }

    /** 쉼표를 제거하고 숫자로 파싱합니다. 숫자가 아니면 null. */
    private static BigDecimal number(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(value.replace(",", "").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationValidatorTest' --no-daemon`
Expected: PASS (12 tests). 실패하면 진단 코드 문자열과 `column` 값이 테스트 기대와 정확히 같은지 대조한다.

- [ ] **Step 7: 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 이관 연도 스냅샷과 셀 단위 진단 카탈로그 추가"
```

---

## Phase C — 시트 어댑터

어댑터는 정규화 행을 **기존 도메인 서비스가 받는 요청 DTO**로 바꾸는 순수 변환만 담당한다. 저장·채번·환율 조회·감사로그는 전부 기존 서비스가 한다. 어댑터는 `BBUGTM`을 쓰지 않고 편성률만 모아 돌려준다(§3.5).

### Task 6: 어댑터 인터페이스와 `CostSheetAdapter`

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/SheetAdapter.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/AdapterSupport.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/CostSheetAdapter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/adapter/CostSheetAdapterTest.java`

**Interfaces:**
- Produces: `SheetAdapter.supports()` → `SheetKind`
- Produces: `record AdapterContext(String bseYy, MigrationLookupIndex index, MigrationYearSnapshot.Data snapshot, Map<String,String> overrides, String actorEno)`
- Produces: `record AdapterOutput(List<CostDto.CreateRequest> costs, List<ProjectDto.CreateRequest> projects, List<PlanIntent> plans, List<RateIntent> rates)`
- Produces: `record RateIntent(String orcTb, String naturalKeyOrPk, int percent)` — `orcTb`는 `BPROJM`·`BCOSTM`. 사업·전산업무비는 채번 후에야 PK를 알므로 `naturalKeyOrPk`에 정규화 사업명 또는 전산업무비 자연키를 넣고 `MigrationImportService`가 채번 결과로 치환한다
- Produces: `record PlanIntent(String normalizedProjectName, BigDecimal devAmount, BigDecimal hwAmount, BigDecimal swAmount, String paymentYm, Map<String,String> snapshotFields)`
- Produces: `SheetAdapter.adapt(SheetPayload sheet, AdapterContext ctx)` → `AdapterOutput`
- Produces: `AdapterSupport.cellOf(...)`, `AdapterSupport.amount(...)`, `AdapterSupport.flag(...)`, `AdapterSupport.abusTc(...)`, `AdapterSupport.ymToFirstDay(...)`, `AdapterSupport.ymToLastDay(...)`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`CostSheetAdapterTest.java` — 실제 엑셀 2행(런던 PF Microsoft Teams, GBP)과 4행(국내출장, KRW)을 재현한다.

```java
package com.kdb.it.domain.migration.service.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 전산일반관리비 시트 → BCOSTM 생성요청 변환 규칙을 고정합니다 (§5.2). */
class CostSheetAdapterTest {

    private final CostSheetAdapter adapter = new CostSheetAdapter();

    @Test
    @DisplayName("원화 행은 원화열을 ×1000해 원 단위로 올리고 FC_AMT를 비운다")
    void 원화행은_천원을_원으로_올린다() {
        Map<String, String> cells = cells();
        cells.put("currency", "KRW");
        cells.put("fcAmount", "");
        cells.put("krwAmount", "15401");

        CostDto.CreateRequest result = adaptSingle(cells);

        assertThat(result.getCostTotXpAmt()).isEqualByComparingTo(new BigDecimal("15401000"));
        assertThat(result.getFcAmt()).isNull();
        assertThat(result.getCurC()).isEqualTo("KRW");
    }

    @Test
    @DisplayName("외화 행은 FC_AMT에 외화 원금을 넣고 XCR은 서버가 채우도록 비운다")
    void 외화행은_외화원금만_넣는다() {
        Map<String, String> cells = cells();
        cells.put("currency", "GBP");
        cells.put("fcAmount", "2890");
        cells.put("krwAmount", "5560.36");

        CostDto.CreateRequest result = adaptSingle(cells);

        assertThat(result.getFcAmt()).isEqualByComparingTo(new BigDecimal("2890"));
        assertThat(result.getXcr()).isNull();
        assertThat(result.getCostTotXpAmt()).isEqualByComparingTo(new BigDecimal("5560360"));
    }

    @Test
    @DisplayName("JPY 외화열은 천엔이라 FC_AMT를 엔으로 ×1000한다")
    void 엔화는_천엔을_엔으로_올린다() {
        Map<String, String> cells = cells();
        cells.put("currency", "JPY");
        cells.put("fcAmount", "100");
        cells.put("krwAmount", "970");

        assertThat(adaptSingle(cells).getFcAmt()).isEqualByComparingTo(new BigDecimal("100000"));
    }

    @Test
    @DisplayName("구분 라벨을 ABUS_TC 코드값으로 바꾼다")
    void 사업구분라벨을_코드로_바꾼다() {
        Map<String, String> cells = cells();
        cells.put("abusTcLabel", "신규");
        assertThat(adaptSingle(cells).getAbusTc()).isEqualTo("10");

        cells.put("abusTcLabel", "계속");
        assertThat(adaptSingle(cells).getAbusTc()).isEqualTo("20");

        cells.put("abusTcLabel", "");
        assertThat(adaptSingle(cells).getAbusTc()).isEqualTo("0");
    }

    @Test
    @DisplayName("보안·단말 O 표기를 Y로, 빈 값을 N으로 바꾼다")
    void 플래그표기를_YN으로_바꾼다() {
        Map<String, String> cells = cells();
        cells.put("securityFlag", "O");
        cells.put("terminalFlag", "");

        CostDto.CreateRequest result = adaptSingle(cells);

        assertThat(result.getSectSysUtzYn()).isEqualTo("Y");
        assertThat(result.getTmnYn()).isEqualTo("N");
    }

    @Test
    @DisplayName("비목명을 코드로 바꾸고 보정값이 있으면 보정값을 쓴다")
    void 비목은_보정값을_우선한다() {
        Map<String, String> cells = cells();
        cells.put("ioeName", "외주용역비");

        MigrationDto.SheetPayload sheet = sheet(cells);
        Map<String, String> overrides =
                Map.of(
                        com.kdb.it.domain.migration.service.MigrationValidator.overrideKey(
                                SheetKind.COST, 2, "ioeName"),
                        "009");

        AdapterOutput out = adapter.adapt(sheet, context(overrides));

        assertThat(out.costs()).singleElement().satisfies(c -> assertThat(c.getIoeC()).isEqualTo("009"));
    }

    @Test
    @DisplayName("부서·팀 코드와 이름 스냅샷을 함께 채운다")
    void 부서팀_코드와_이름을_채운다() {
        CostDto.CreateRequest result = adaptSingle(cells());

        assertThat(result.getCostSvnDpmC()).isEqualTo("0210");
        assertThat(result.getSvnTemC()).isEqualTo("0211");
    }

    @Test
    @DisplayName("담당자 열이 없는 시트라 업로드 사용자 사번을 담당자로 넣는다")
    void 담당자는_업로드사용자다() {
        assertThat(adaptSingle(cells()).getCgprId()).isEqualTo("999999");
    }

    @Test
    @DisplayName("전산업무비는 편성률 100의 RateIntent를 자연키로 남긴다")
    void 편성률의도를_자연키로_남긴다() {
        AdapterOutput out = adapter.adapt(sheet(cells()), context(Map.of()));

        assertThat(out.rates())
                .singleElement()
                .satisfies(
                        r -> {
                            assertThat(r.orcTb()).isEqualTo("BCOSTM");
                            assertThat(r.percent()).isEqualTo(100);
                            assertThat(r.naturalKeyOrPk()).contains("커브");
                        });
    }

    private CostDto.CreateRequest adaptSingle(Map<String, String> cells) {
        return adapter.adapt(sheet(cells), context(Map.of())).costs().get(0);
    }

    private static MigrationDto.SheetPayload sheet(Map<String, String> cells) {
        return new MigrationDto.SheetPayload(
                SheetKind.COST, "2026", List.of(new MigrationDto.NormalizedRow(2, cells)));
    }

    private static AdapterContext context(Map<String, String> overrides) {
        return new AdapterContext(
                "2026",
                new com.kdb.it.domain.migration.service.MigrationLookupIndex(
                        com.kdb.it.domain.migration.service.OrgIdentityResolver.Index.of(
                                List.of(
                                        org("0210", "IT기획부"),
                                        org("0211", "IT기획팀")),
                                List.of()),
                        Map.of("국내전산임차료", "001", "유지보수료", "011", "외주용역비", "008"),
                        Map.of("GBP", new BigDecimal("1924"), "JPY", new BigDecimal("9.7"))),
                com.kdb.it.domain.migration.service.TestSnapshots.empty("2026"),
                overrides,
                "999999");
    }

    private static com.kdb.it.common.iam.entity.CorgnI org(String code, String name) {
        return com.kdb.it.common.iam.entity.CorgnI.builder()
                .prlmOgzCCone(code)
                .bbrNm(name)
                .build();
    }

    private static Map<String, String> cells() {
        Map<String, String> cells = new HashMap<>();
        cells.put("abusCode", "571");
        cells.put("ioeName", "유지보수료");
        cells.put("abusTcLabel", "계속");
        cells.put("vendorName", "커브");
        cells.put("requestDetail", "올인원워크스페이스");
        cells.put("securityFlag", "");
        cells.put("terminalFlag", "");
        cells.put("deptName", "IT기획부");
        cells.put("teamName", "IT기획팀");
        cells.put("currency", "KRW");
        cells.put("fcAmount", "");
        cells.put("krwAmount", "15401");
        cells.put("remark", "전년도 동일수준");
        return cells;
    }
}
```

`TestSnapshots.empty(String)`는 Task 5의 `TestFixtures.emptySnapshot`을 어댑터 테스트에서도 쓰기 위한 공용 헬퍼다. `TestFixtures`를 `TestSnapshots`로 이름만 바꿔 `com.kdb.it.domain.migration.service` 패키지에 두고 `public`으로 올린 뒤 두 테스트가 함께 쓴다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*CostSheetAdapterTest' --no-daemon`
Expected: 컴파일 실패 — `SheetAdapter`·`AdapterContext`·`AdapterOutput`·`CostSheetAdapter` 없음

- [ ] **Step 3: 인터페이스와 공용 record를 작성한다**

`SheetAdapter.java`

```java
package com.kdb.it.domain.migration.service.adapter;

import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;

/**
 * 정규화 엑셀 행을 기존 도메인 서비스의 생성요청으로 바꿉니다.
 *
 * <p>어댑터는 순수 변환만 합니다. 채번·환율 조회·금액 재계산·조직명 스냅샷·감사로그는 {@code CostService}·{@code ProjectService}가
 * 담당하며, 편성행({@code BBUGTM})은 어댑터가 쓰지 않고 편성률 의도만 남깁니다.
 */
public interface SheetAdapter {

    /**
     * 이 어댑터가 담당하는 시트 종류를 반환합니다.
     *
     * @return 시트 종류
     */
    SheetKind supports();

    /**
     * 시트 하나를 생성요청 묶음으로 변환합니다.
     *
     * <p>검증은 {@code MigrationValidator}가 이미 통과시킨 상태를 전제합니다. 어댑터는 미해석 값을 만나면 예외를 던지지 않고 null·기본값으로 둡니다.
     *
     * @param sheet 시트 페이로드
     * @param ctx 예산연도·조회 인덱스·스냅샷·보정값·업로드 사용자
     * @return 변환 결과
     */
    AdapterOutput adapt(MigrationDto.SheetPayload sheet, AdapterContext ctx);
}
```

`AdapterContext.java`

```java
package com.kdb.it.domain.migration.service.adapter;

import com.kdb.it.domain.migration.service.MigrationLookupIndex;
import com.kdb.it.domain.migration.service.MigrationYearSnapshot;
import java.util.Map;

/**
 * 어댑터 변환에 필요한 요청 범위 컨텍스트입니다.
 *
 * @param bseYy 예산연도 (4자리)
 * @param index 조직·비목·환율 조회 인덱스
 * @param snapshot 예산연도 기존 상태
 * @param overrides 미리보기 보정값 ({@code MigrationValidator.overrideKey} 키)
 * @param actorEno 업로드 사용자 사번. 엑셀에 담당자가 없는 시트의 기본 담당자로 씁니다
 */
public record AdapterContext(
        String bseYy,
        MigrationLookupIndex index,
        MigrationYearSnapshot.Data snapshot,
        Map<String, String> overrides,
        String actorEno) {}
```

`AdapterOutput.java`

```java
package com.kdb.it.domain.migration.service.adapter;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import java.util.List;

/**
 * 어댑터 변환 결과입니다. 비어 있는 목록은 그 어댑터가 그 종류를 만들지 않는다는 뜻입니다.
 *
 * @param costs 전산업무비 생성요청
 * @param projects 사업 생성요청 (품목 포함)
 * @param plans 부문계획 조정 의도
 * @param rates 편성률 의도 — 반영 마지막의 applyItemRates 단일 호출에 모아 넘깁니다
 */
public record AdapterOutput(
        List<CostDto.CreateRequest> costs,
        List<ProjectDto.CreateRequest> projects,
        List<PlanIntent> plans,
        List<RateIntent> rates) {

    /** 아무것도 만들지 않은 결과입니다. */
    public static AdapterOutput empty() {
        return new AdapterOutput(List.of(), List.of(), List.of(), List.of());
    }
}
```

`RateIntent.java`

```java
package com.kdb.it.domain.migration.service.adapter;

/**
 * 편성률 적용 의도입니다.
 *
 * <p>사업·전산업무비는 채번 후에야 관리번호를 알 수 있으므로 {@code naturalKeyOrPk}에 자연키(전산업무비) 또는 정규화 사업명(사업)을 담고,
 * {@code MigrationImportService}가 채번 결과로 실제 PK로 치환한 뒤 {@code BudgetWorkDto.ItemRate}를 만듭니다.
 *
 * @param orcTb 원본 테이블 — 접두어 없는 {@code BPROJM} 또는 {@code BCOSTM}
 * @param naturalKeyOrPk 전산업무비 자연키 또는 정규화 사업명
 * @param percent 편성률 (0~100)
 */
public record RateIntent(String orcTb, String naturalKeyOrPk, int percent) {}
```

`PlanIntent.java`

```java
package com.kdb.it.domain.migration.service.adapter;

import java.math.BigDecimal;
import java.util.Map;

/**
 * 부문계획 조정 의도입니다.
 *
 * <p>조정액은 비율 곱이 아니라 확정 금액이므로 대상 사업의 {@code BITEMM}을 이 금액으로 버전 교체하고 편성률 100을 적용합니다(§5.4).
 *
 * @param normalizedProjectName 정규화 사업명 (동일성 판정 키)
 * @param devAmount 개발비 조정액 (원 단위). 없으면 null
 * @param hwAmount 기계장치 조정액 (원 단위). 없으면 null
 * @param swAmount 기타무형자산 조정액 (원 단위). 없으면 null
 * @param paymentYm 예상지급일정 6자리 (BITEMM.BSE_YM). 없으면 null
 * @param snapshotFields 원장에 넣지 않고 계획 스냅샷에만 남길 값 (집행 실적·사업진행·비고)
 */
public record PlanIntent(
        String normalizedProjectName,
        BigDecimal devAmount,
        BigDecimal hwAmount,
        BigDecimal swAmount,
        String paymentYm,
        Map<String, String> snapshotFields) {}
```

- [ ] **Step 4: `AdapterSupport` 공용 변환 헬퍼를 작성한다**

```java
package com.kdb.it.domain.migration.service.adapter;

import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.MigrationValidator;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 어댑터가 공유하는 셀 읽기·단위 변환·코드 변환 헬퍼입니다. */
public final class AdapterSupport {

    /** `'26.05`·`26.5`·`'26.12월` 형태를 받습니다. */
    private static final Pattern YM = Pattern.compile("^'?(\\d{2})\\.(\\d{1,2})월?$");

    private AdapterSupport() {
        throw new UnsupportedOperationException("유틸 클래스 — 인스턴스화 금지");
    }

    /**
     * 보정값이 있으면 보정값을, 없으면 원본 셀을 읽습니다.
     *
     * @param sheet 시트 페이로드 (종류를 보정 키에 씁니다)
     * @param row 정규화 행
     * @param column 정규 컬럼 id
     * @param ctx 어댑터 컨텍스트
     * @return 셀 문자열. 없거나 null이면 빈 문자열
     */
    public static String cellOf(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            AdapterContext ctx) {
        String override =
                ctx.overrides()
                        .get(MigrationValidator.overrideKey(sheet.kind(), row.excelRow(), column));
        if (override != null) {
            return override;
        }
        String value = row.cells().get(column);
        return value == null ? "" : value.trim();
    }

    /**
     * 엑셀 금액을 원 단위로 올립니다.
     *
     * @param raw 엑셀 셀 문자열 (쉼표 허용)
     * @param kind 시트 종류 — 배수를 정합니다 (일반관리비 ×1,000 / 자본예산·부문계획 ×1,000,000 / 위임예산 ×1)
     * @return 원 단위 금액. 셀이 비었거나 숫자가 아니면 null
     */
    public static BigDecimal amount(String raw, SheetKind kind) {
        BigDecimal parsed = number(raw);
        if (parsed == null) {
            return null;
        }
        BigDecimal multiplier =
                switch (kind) {
                    case COST -> new BigDecimal("1000");
                    case CAPITAL_PROJECT, PLAN_ADJUSTMENT -> new BigDecimal("1000000");
                    case DELEGATED_BUDGET -> BigDecimal.ONE;
                };
        return parsed.multiply(multiplier).setScale(3, RoundingMode.HALF_UP);
    }

    /**
     * 외화 원금을 통화 기본 단위로 맞춥니다. JPY만 엑셀이 천엔 단위라 ×1,000합니다 (§5.1).
     *
     * @param raw 엑셀 외화 셀 문자열
     * @param currency 통화코드
     * @return 통화 기본 단위 금액. 셀이 비었거나 원화면 null
     */
    public static BigDecimal foreignAmount(String raw, String currency) {
        if (currency == null || currency.isBlank() || "KRW".equals(currency)) {
            return null;
        }
        BigDecimal parsed = number(raw);
        if (parsed == null) {
            return null;
        }
        return "JPY".equals(currency) ? parsed.multiply(new BigDecimal("1000")) : parsed;
    }

    /**
     * `O`·`Y`·`y`를 `Y`로, 나머지를 `N`으로 바꿉니다.
     *
     * @param raw 엑셀 셀 문자열
     * @return `Y` 또는 `N`
     */
    public static String flag(String raw) {
        if (raw == null) {
            return "N";
        }
        String v = raw.trim();
        return ("O".equalsIgnoreCase(v) || "Y".equalsIgnoreCase(v) || "○".equals(v)) ? "Y" : "N";
    }

    /**
     * `신규`·`계속` 라벨을 `ABUS_TC` 코드값으로 바꿉니다.
     *
     * @param label 엑셀 구분·진행상황 라벨
     * @return `10`(신규)·`20`(계속)·`0`(그 외·해당없음)
     */
    public static String abusTc(String label) {
        if (label == null) {
            return "0";
        }
        return switch (label.trim()) {
            case "신규" -> "10";
            case "계속" -> "20";
            default -> "0";
        };
    }

    /**
     * `'26.05`를 해당 월 1일로 바꿉니다.
     *
     * @param raw 엑셀 연월 표기
     * @return 해당 월 1일. 파싱 실패면 null
     */
    public static LocalDate ymToFirstDay(String raw) {
        YearMonth ym = yearMonth(raw);
        return ym == null ? null : ym.atDay(1);
    }

    /**
     * `'26.12`를 해당 월 말일로 바꿉니다.
     *
     * @param raw 엑셀 연월 표기
     * @return 해당 월 말일. 파싱 실패면 null
     */
    public static LocalDate ymToLastDay(String raw) {
        YearMonth ym = yearMonth(raw);
        return ym == null ? null : ym.atEndOfMonth();
    }

    /**
     * `'26.12`를 `BSE_YM` 6자리로 바꿉니다.
     *
     * @param raw 엑셀 연월 표기
     * @return `202612` 형태. 파싱 실패면 null
     */
    public static String ymToYyyymm(String raw) {
        YearMonth ym = yearMonth(raw);
        return ym == null ? null : String.format("%04d%02d", ym.getYear(), ym.getMonthValue());
    }

    /**
     * 조정비율(`0.7`·`1`)을 정수 편성률로 바꿉니다.
     *
     * @param raw 엑셀 조정비율
     * @return 0~100으로 잘린 편성률. 셀이 비었으면 100
     */
    public static int ratePercent(String raw) {
        BigDecimal parsed = number(raw);
        if (parsed == null) {
            return 100;
        }
        int percent = parsed.multiply(new BigDecimal("100")).setScale(0, RoundingMode.HALF_UP).intValue();
        return Math.max(0, Math.min(100, percent));
    }

    /** 쉼표를 제거하고 숫자로 파싱합니다. 숫자가 아니면 null. */
    public static BigDecimal number(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(raw.replace(",", "").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** 2자리 연도를 2000년대로 해석합니다. 은행 편성 문서가 `'26` 표기를 쓰므로 세기 보정이 필요합니다. */
    private static YearMonth yearMonth(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        Matcher m = YM.matcher(raw.trim());
        if (!m.matches()) {
            return null;
        }
        return YearMonth.of(2000 + Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)));
    }
}
```

- [ ] **Step 5: `CostSheetAdapter`를 구현한다**

```java
package com.kdb.it.domain.migration.service.adapter;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.MigrationYearSnapshot;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 전산일반관리비 편성 요구서 `전체취합(국내외)` 시트를 {@code BCOSTM} 생성요청으로 바꿉니다 (§5.2).
 *
 * <p>이 시트에는 담당자 열이 없어 업로드 사용자 사번을 담당자로 넣습니다. {@code XCR}은 설정하지 않습니다 — {@code CostService}가
 * {@code XcrLookupService}로 다시 조회해 덮어쓰기 때문입니다(§3.7).
 */
@Component
public class CostSheetAdapter implements SheetAdapter {

    @Override
    public SheetKind supports() {
        return SheetKind.COST;
    }

    @Override
    public AdapterOutput adapt(MigrationDto.SheetPayload sheet, AdapterContext ctx) {
        List<CostDto.CreateRequest> costs = new ArrayList<>();
        List<RateIntent> rates = new ArrayList<>();

        for (MigrationDto.NormalizedRow row : sheet.rows()) {
            String currency = AdapterSupport.cellOf(sheet, row, "currency", ctx);
            String ioeC = resolveIoe(sheet, row, ctx);
            String deptCode = resolveOrg(sheet, row, "deptName", ctx);
            String teamCode = resolveOrg(sheet, row, "teamName", ctx);
            String vendor = AdapterSupport.cellOf(sheet, row, "vendorName", ctx);
            String contractName = AdapterSupport.cellOf(sheet, row, "requestDetail", ctx);
            String abusCode = AdapterSupport.cellOf(sheet, row, "abusCode", ctx);

            CostDto.CreateRequest request = new CostDto.CreateRequest();
            request.setBseYy(ctx.bseYy());
            request.setBgUntAbusC(abusCode);
            request.setIoeC(ioeC);
            request.setAbusTc(AdapterSupport.abusTc(AdapterSupport.cellOf(sheet, row, "abusTcLabel", ctx)));
            request.setCttOppNm(vendor);
            request.setCttNm(contractName);
            request.setSectSysUtzYn(
                    AdapterSupport.flag(AdapterSupport.cellOf(sheet, row, "securityFlag", ctx)));
            request.setTmnYn(AdapterSupport.flag(AdapterSupport.cellOf(sheet, row, "terminalFlag", ctx)));
            request.setCostSvnDpmC(deptCode);
            request.setSvnTemC(teamCode);
            request.setCurC(currency.isBlank() ? "KRW" : currency);
            request.setFcAmt(
                    AdapterSupport.foreignAmount(
                            AdapterSupport.cellOf(sheet, row, "fcAmount", ctx), currency));
            request.setCostTotXpAmt(
                    AdapterSupport.amount(
                            AdapterSupport.cellOf(sheet, row, "krwAmount", ctx), SheetKind.COST));
            request.setXcrBseDt(ctx.bseYy() + "0101");
            request.setIndRsn(AdapterSupport.cellOf(sheet, row, "remark", ctx));
            request.setCgprId(ctx.actorEno());
            costs.add(request);

            rates.add(
                    new RateIntent(
                            "BCOSTM",
                            MigrationYearSnapshot.costNaturalKey(
                                    ctx.bseYy(), abusCode, ioeC, vendor, contractName),
                            100));
        }
        return new AdapterOutput(costs, List.of(), List.of(), rates);
    }

    /** 보정값이 있으면 그 코드값을, 없으면 비목명으로 코드를 찾습니다. 못 찾으면 null(검증이 이미 막았어야 합니다). */
    private String resolveIoe(
            MigrationDto.SheetPayload sheet, MigrationDto.NormalizedRow row, AdapterContext ctx) {
        String raw = AdapterSupport.cellOf(sheet, row, "ioeName", ctx);
        String mapped = ctx.index().ioeCodeByName().get(raw);
        return mapped != null ? mapped : (raw.isBlank() ? null : raw);
    }

    /** 보정값이 있으면 그 조직코드를, 없으면 이름으로 해석합니다. 미해석이면 null. */
    private String resolveOrg(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            AdapterContext ctx) {
        String raw = AdapterSupport.cellOf(sheet, row, column, ctx);
        OrgIdentityResolver.Resolution resolution = ctx.index().org().resolveOrg(raw);
        if (resolution.code() != null) {
            return resolution.code();
        }
        // 보정값은 이미 코드값이므로 셀 원문이 코드 형태로 왔을 수 있다
        return ctx.index().org().orgNameOf(raw) != null ? raw : null;
    }
}
```

> `resolveIoe`·`resolveOrg`가 보정값을 자연스럽게 흡수하는 이유: `cellOf`가 보정값을 먼저 반환하고, 보정값은 이미 코드값이라 `ioeCodeByName` 조회가 실패한 뒤 원문(=코드값)을 그대로 돌려준다. 조직은 `orgNameOf(코드)`가 비어 있지 않으면 코드로 판정한다.

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*CostSheetAdapterTest' --no-daemon`
Expected: PASS (9 tests)

- [ ] **Step 7: 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it/domain/migration src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 시트 어댑터 인터페이스와 전산일반관리비 어댑터 추가"
```

---

Task 7~18(자본예산·위임예산·부문계획 어댑터, 결재 받이, 오케스트레이션, API, 통합테스트, 프론트 4개, E2E)은 이어서 작성한다.
