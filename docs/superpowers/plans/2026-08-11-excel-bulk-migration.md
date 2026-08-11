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
        return Index.of(organizationRepository.findByDelYn("N"), userRepository.findByDelYn("N"));
    }

    /** 이름 → 코드 역방향 매칭 인덱스입니다. 한 요청 처리 동안만 살아 있습니다. */
    public static final class Index {

        private final Map<String, CorgnI> orgByExactName = new LinkedHashMap<>();
        private final Map<String, CorgnI> orgByNormalizedName = new LinkedHashMap<>();
        private final Map<String, String> orgNameByCode = new LinkedHashMap<>();
        private final List<CorgnI> allOrgs;
        private final List<CuserI> allUsers;
        private final Map<String, CuserI> userByEno = new LinkedHashMap<>();

        /**
         * 조직·사용자 목록으로 인덱스를 만듭니다.
         *
         * <p>운영 경로는 {@link OrgIdentityResolver#snapshot()}을 쓰고, 이 팩토리는 리포지토리 없이 인덱스를 조립해야 하는
         * 단위 테스트가 씁니다(어댑터·검증기 테스트가 공유). 그래서 생성자 대신 패키지 밖에서도 보이는 정적 팩토리로 둡니다.
         *
         * @param orgs 조직 목록 (null 아님)
         * @param users 사용자 목록 (null 아님)
         * @return 이름 → 코드 매칭 인덱스
         */
        public static Index of(List<CorgnI> orgs, List<CuserI> users) {
            return new Index(orgs, users);
        }

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
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationLookupIndex.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationYearSnapshot.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationValidator.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationValidatorTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/TestSnapshots.java` (Task 6·11 테스트가 공유하는 픽스처 헬퍼)

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
                        TestSnapshots.emptyIndex(),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.indexWithOrgs("0450", "금융공학실", "0451", "금융공학실 퀀트인프라팀"),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.indexWithIoe("001", "국내전산임차료"),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.indexWithIoe("008", "외주용역(외주운영/관제 등)"),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.emptyIndex(),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.emptyIndex(),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.indexWithIoe("001", "국내전산임차료"),
                        TestSnapshots.snapshotWithCostKey("2026", "2026|571|001|커브|올인원워크스페이스"),
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
                        TestSnapshots.indexWithXcr("GBP", "1924"),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.emptyIndex(),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.emptyIndex(),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.emptyIndex(),
                        TestSnapshots.empty("2026"),
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
                        TestSnapshots.emptyIndex(),
                        TestSnapshots.empty("2026"),
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

`it_backend/src/test/java/com/kdb/it/domain/migration/service/TestSnapshots.java`

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

/** 이관 단위 테스트가 공유하는 인덱스·스냅샷 조립 헬퍼입니다. 검증기·어댑터·오케스트레이션 테스트가 함께 씁니다. */
public final class TestSnapshots {

    private TestSnapshots() {}

    /** 아무것도 해석되지 않는 빈 인덱스. */
    public static MigrationLookupIndex emptyIndex() {
        return new MigrationLookupIndex(
                new OrgIdentityResolver(
                                (delYn) -> List.of(), (delYn) -> List.of())
                        .snapshot(),
                Map.of(),
                Map.of());
    }

    /** 조직만 담긴 인덱스. 인자는 (코드, 이름) 쌍의 반복입니다. */
    public static MigrationLookupIndex indexWithOrgs(String... codeNamePairs) {
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
    public static MigrationLookupIndex indexWithIoe(String code, String name) {
        return new MigrationLookupIndex(emptyIndex().org(), Map.of(name, code), Map.of());
    }

    /** 통화별 환율만 담긴 인덱스. */
    public static MigrationLookupIndex indexWithXcr(String curC, String xcr) {
        return new MigrationLookupIndex(
                emptyIndex().org(), Map.of(), Map.of(curC, new BigDecimal(xcr)));
    }

    /** 기존 데이터가 없는 연도 스냅샷. */
    public static MigrationYearSnapshot.Data empty(String bseYy) {
        return new MigrationYearSnapshot.Data(
                bseYy, Set.of(), new LinkedHashMap<>(), Set.of(), new LinkedHashMap<>(), List.of());
    }

    /** 전산업무비 자연키 하나가 이미 있는 연도 스냅샷. */
    public static MigrationYearSnapshot.Data snapshotWithCostKey(String bseYy, String naturalKey) {
        Set<String> keys = new LinkedHashSet<>();
        keys.add(naturalKey);
        return new MigrationYearSnapshot.Data(
                bseYy, keys, new LinkedHashMap<>(), Set.of(), new LinkedHashMap<>(), List.of());
    }
}
```

> 위 픽스처의 람다 표기(`(delYn) -> List.of()`)는 **쓸 수 없다** — `OrgIdentityResolver`가 리포지토리 인터페이스를 생성자로 받기 때문이다. Task 4에서 추가한 정적 팩토리 `OrgIdentityResolver.Index.of(List<CorgnI>, List<CuserI>)`를 직접 호출한다.
>
> ```java
>     public static MigrationLookupIndex emptyIndex() {
>         return new MigrationLookupIndex(
>                 OrgIdentityResolver.Index.of(List.of(), List.of()), Map.of(), Map.of());
>     }
>
>     public static MigrationLookupIndex indexWithOrgs(String... codeNamePairs) {
>         List<CorgnI> orgs = new ArrayList<>();
>         for (int i = 0; i < codeNamePairs.length; i += 2) {
>             orgs.add(
>                     CorgnI.builder()
>                             .prlmOgzCCone(codeNamePairs[i])
>                             .bbrNm(codeNamePairs[i + 1])
>                             .build());
>         }
>         return new MigrationLookupIndex(
>                 OrgIdentityResolver.Index.of(orgs, List.of()), Map.of(), Map.of());
>     }
>
>     public static MigrationLookupIndex indexWithIoe(String code, String name) {
>         return new MigrationLookupIndex(
>                 OrgIdentityResolver.Index.of(List.of(), List.of()), Map.of(name, code), Map.of());
>     }
>
>     public static MigrationLookupIndex indexWithXcr(String curC, String xcr) {
>         return new MigrationLookupIndex(
>                 OrgIdentityResolver.Index.of(List.of(), List.of()),
>                 Map.of(),
>                 Map.of(curC, new BigDecimal(xcr)));
>     }
> ```
>
> 이 헬퍼는 Task 6·7·8·9의 어댑터 테스트와 Task 11의 오케스트레이션 테스트도 쓰므로 `public`으로 만든다. 테스트 전용 클래스지만 여러 테스트 클래스가 공유하므로 패키지-프라이빗으로 두면 어댑터 테스트(`...service.adapter` 패키지)에서 보이지 않는다.

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

`TestSnapshots`는 Task 5 Step 3에서 만든 공용 픽스처 헬퍼다. 이 테스트가 `...service.adapter` 패키지에 있으므로 FQN 또는 import로 참조한다.

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

### Task 7: `CapitalProjectSheetAdapter`

자본예산 편성요구서 행 하나를 `BPROJM` 생성요청 + 품목 최대 3건으로 바꾼다(§5.3). 금액 배수는 ×1,000,000이고 비목은 국내/국외·일반/감리 구분이 엑셀에 없어 기본값을 넣고 미리보기 보정에 맡긴다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/CapitalProjectSheetAdapter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/adapter/CapitalProjectSheetAdapterTest.java`

**Interfaces:**
- Consumes: `SheetAdapter`, `AdapterContext`, `AdapterOutput`, `RateIntent`, `AdapterSupport` (Task 6)
- Consumes: `ProjectDto.CreateRequest` — setter 기반 POJO. `setItems(List<ProjectDto.BitemmDto>)`로 품목을 넘긴다
- Produces: `CapitalProjectSheetAdapter` 빈. `supports()` = `SheetKind.CAPITAL_PROJECT`
- Produces: 품목 기본 비목 상수 — `IOE_DEV = "103"`, `IOE_HW = "101"`, `IOE_SW = "106"`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

실제 엑셀 3행(글로벌 표준 뱅킹시스템: 개발비 16,888 / 기계장치 2,821 / 기타무형 4,576, 조정비율 1)을 재현한다.

```java
package com.kdb.it.domain.migration.service.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.dto.MigrationColumns;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.MigrationLookupIndex;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import com.kdb.it.domain.migration.service.TestSnapshots;
import com.kdb.it.common.iam.entity.CorgnI;
import com.kdb.it.common.iam.entity.CuserI;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 자본예산 시트 → BPROJM·BITEMM 변환 규칙을 고정합니다 (§5.3). */
class CapitalProjectSheetAdapterTest {

    private final CapitalProjectSheetAdapter adapter = new CapitalProjectSheetAdapter();

    @Test
    @DisplayName("백만원 단위 금액을 원 단위로 올린다")
    void 백만원을_원으로_올린다() {
        ProjectDto.CreateRequest project = adaptSingle(cells());

        assertThat(project.getItems())
                .extracting(ProjectDto.BitemmDto::getAmt)
                .containsExactlyInAnyOrder(
                        new BigDecimal("16888000000.000"),
                        new BigDecimal("2821000000.000"),
                        new BigDecimal("4576000000.000"));
    }

    @Test
    @DisplayName("금액이 0이거나 빈 항목은 품목을 만들지 않는다")
    void 금액이_없는_항목은_품목을_만들지_않는다() {
        Map<String, String> cells = cells();
        cells.put("devAmount", "");
        cells.put("hwAmount", "0");
        cells.put("swAmount", "1406");

        assertThat(adaptSingle(cells).getItems()).hasSize(1);
    }

    @Test
    @DisplayName("품목 비목 기본값은 개발비 103·기계장치 101·기타무형 106이다")
    void 품목비목_기본값을_넣는다() {
        assertThat(adaptSingle(cells()).getItems())
                .extracting(ProjectDto.BitemmDto::getIoeC)
                .containsExactlyInAnyOrder("103", "101", "106");
    }

    @Test
    @DisplayName("비목 보정값이 오면 해당 항목의 비목을 바꾼다")
    void 비목보정값을_적용한다() {
        Map<String, String> overrides =
                Map.of(
                        com.kdb.it.domain.migration.service.MigrationValidator.overrideKey(
                                SheetKind.CAPITAL_PROJECT, 2, "devAmountIoeC"),
                        "104");

        AdapterOutput out = adapter.adapt(sheet(cells()), context(overrides));

        assertThat(out.projects().get(0).getItems())
                .filteredOn(i -> "104".equals(i.getIoeC()))
                .hasSize(1);
    }

    @Test
    @DisplayName("'26.05 형태 기간을 해당 월 1일·말일로 바꾼다")
    void 연월표기를_날짜로_바꾼다() {
        Map<String, String> cells = cells();
        cells.put("startYm", "'26.05");
        cells.put("endYm", "'26.12");

        ProjectDto.CreateRequest project = adaptSingle(cells);

        assertThat(project.getSttDtm()).isEqualTo(LocalDate.of(2026, 5, 1));
        assertThat(project.getEndDtm()).isEqualTo(LocalDate.of(2026, 12, 31));
    }

    @Test
    @DisplayName("파싱 불가 기간은 null로 둔다")
    void 파싱불가_기간은_null이다() {
        Map<String, String> cells = cells();
        cells.put("startYm", "미정");

        assertThat(adaptSingle(cells).getSttDtm()).isNull();
    }

    @Test
    @DisplayName("담당자·팀장 이름을 사번으로 바꾸고 IT부서·주관부서 코드를 채운다")
    void 담당자와_부서를_해석한다() {
        ProjectDto.CreateRequest project = adaptSingle(cells());

        assertThat(project.getUsid()).isEqualTo("100001");
        assertThat(project.getTlrUsid()).isEqualTo("100002");
        assertThat(project.getSvnDpmC()).isEqualTo("0210");
    }

    @Test
    @DisplayName("경상여부는 N, 주관본부는 문자열 그대로 넣는다")
    void 경상여부와_주관본부를_채운다() {
        ProjectDto.CreateRequest project = adaptSingle(cells());

        assertThat(project.getOdnYn()).isEqualTo("N");
        assertThat(project.getPrlmHrkOgzCCone()).isEqualTo("글로벌사업부문");
    }

    @Test
    @DisplayName("조정비율 0.7을 편성률 70의 RateIntent로 남긴다")
    void 조정비율을_편성률로_바꾼다() {
        Map<String, String> cells = cells();
        cells.put("adjustRate", "0.7");

        AdapterOutput out = adapter.adapt(sheet(cells), context(Map.of()));

        assertThat(out.rates())
                .singleElement()
                .satisfies(
                        r -> {
                            assertThat(r.orcTb()).isEqualTo("BPROJM");
                            assertThat(r.percent()).isEqualTo(70);
                            assertThat(r.naturalKeyOrPk()).isEqualTo("글로벌표준뱅킹시스템재구축");
                        });
    }

    @Test
    @DisplayName("조정비율이 비면 편성률 100으로 둔다")
    void 조정비율이_없으면_100이다() {
        Map<String, String> cells = cells();
        cells.put("adjustRate", "");

        assertThat(adapter.adapt(sheet(cells), context(Map.of())).rates().get(0).percent())
                .isEqualTo(100);
    }

    private ProjectDto.CreateRequest adaptSingle(Map<String, String> cells) {
        return adapter.adapt(sheet(cells), context(Map.of())).projects().get(0);
    }

    private static MigrationDto.SheetPayload sheet(Map<String, String> cells) {
        return new MigrationDto.SheetPayload(
                SheetKind.CAPITAL_PROJECT, "2026", List.of(new MigrationDto.NormalizedRow(2, cells)));
    }

    private static AdapterContext context(Map<String, String> overrides) {
        return new AdapterContext(
                "2026",
                new MigrationLookupIndex(
                        OrgIdentityResolver.Index.of(
                                List.of(org("0210", "글로벌사업부"), org("0211", "글로벌IT혁신팀")),
                                List.of(
                                        user("100001", "장원섭", "차장", "0210"),
                                        user("100002", "이효재", "팀장", "0210"))),
                        Map.of(),
                        Map.of()),
                TestSnapshots.empty("2026"),
                overrides,
                "999999");
    }

    private static CorgnI org(String code, String name) {
        return CorgnI.builder().prlmOgzCCone(code).bbrNm(name).build();
    }

    private static CuserI user(String eno, String name, String title, String bbrC) {
        return CuserI.builder().eno(eno).usrNm(name).ptCNm(title).bbrC(bbrC).temC("0211").build();
    }

    /** 전 컬럼을 채운 뒤 검사 대상만 덮어씁니다. 엑셀 3행(글로벌 표준 뱅킹시스템)을 재현합니다. */
    private static Map<String, String> cells() {
        Map<String, String> cells = new LinkedHashMap<>();
        for (String column : MigrationColumns.of(SheetKind.CAPITAL_PROJECT)) {
            cells.put(column, "");
        }
        cells.put("projectName", "글로벌 표준 뱅킹시스템 재구축");
        cells.put("projectType", "글로벌 뱅킹");
        cells.put("progressLabel", "계속");
        cells.put("projectOutline", "글로벌네트워크 표준뱅킹시스템 재구축");
        cells.put("headquarters", "글로벌사업부문");
        cells.put("deptName", "글로벌사업부");
        cells.put("teamName", "글로벌IT혁신팀");
        cells.put("managerName", "장원섭 차장");
        cells.put("teamLeaderName", "이효재 팀장");
        cells.put("itTeamName", "글로벌개발팀");
        cells.put("feasibility", "확정");
        cells.put("startYm", "'24.08");
        cells.put("endYm", "'27.04");
        cells.put("devAmount", "16888");
        cells.put("hwAmount", "2821");
        cells.put("swAmount", "4576");
        cells.put("adjustRate", "1");
        return cells;
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*CapitalProjectSheetAdapterTest' --no-daemon`
Expected: 컴파일 실패 — `CapitalProjectSheetAdapter` 없음

- [ ] **Step 3: `ProjectDto.BitemmDto`의 실제 setter 이름을 확인한다**

```bash
cd /c/it/it_backend && grep -n "class BitemmDto" -A 45 src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java | grep -E "private|class "
```

`amt`·`ioeC`·`gclNm`·`qty`·`curC`·`fcAmt`·`xcrBseDt`·`bseYm`·`dfrCleC`·`sectSysUtzYn`·`itrInfrYn`·`cncdFdtnCone` 중 실제로 있는 필드만 세팅한다. 없는 setter를 쓰면 컴파일 실패한다.

- [ ] **Step 4: `CapitalProjectSheetAdapter`를 구현한다**

```java
package com.kdb.it.domain.migration.service.adapter;

import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.MigrationValidator;
import com.kdb.it.domain.migration.service.MigrationYearSnapshot;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * 자본예산 편성 요구서 `1-1. 26년정보화사업(전산예산반영)` 시트를 사업·품목 생성요청으로 바꿉니다 (§5.3).
 *
 * <p>품목 비목은 엑셀에 국내/국외·일반/감리 구분이 없어 기본값(개발비 103, 기계장치 101, 기타무형 106)을 넣고, 미리보기에서 보정할 수 있게
 * `{금액컬럼}IoeC` 형태의 보정 키를 인정합니다. 예를 들어 개발비 비목을 감리(104)로 바꾸려면 컬럼 `devAmountIoeC`에 `104`를 보정합니다.
 */
@Component
public class CapitalProjectSheetAdapter implements SheetAdapter {

    /** 개발비 기본 비목 — 개발비(일반). 감리/컨설팅은 104. */
    static final String IOE_DEV = "103";

    /** 기계장치 기본 비목 — 국내기계장치. 국외는 102. */
    static final String IOE_HW = "101";

    /** 기타무형자산 기본 비목 — 국내기타무형자산(일반). 국외는 105, SW라이선스는 107. */
    static final String IOE_SW = "106";

    @Override
    public SheetKind supports() {
        return SheetKind.CAPITAL_PROJECT;
    }

    @Override
    public AdapterOutput adapt(MigrationDto.SheetPayload sheet, AdapterContext ctx) {
        List<ProjectDto.CreateRequest> projects = new ArrayList<>();
        List<RateIntent> rates = new ArrayList<>();

        for (MigrationDto.NormalizedRow row : sheet.rows()) {
            String projectName = AdapterSupport.cellOf(sheet, row, "projectName", ctx);
            String deptCode = resolveOrg(sheet, row, "deptName", ctx);

            ProjectDto.CreateRequest request = new ProjectDto.CreateRequest();
            request.setBseYy(ctx.bseYy());
            request.setAbusNm(projectName);
            request.setBzTpC(AdapterSupport.cellOf(sheet, row, "projectType", ctx));
            request.setAbusCone(AdapterSupport.cellOf(sheet, row, "projectOutline", ctx));
            request.setPrlmHrkOgzCCone(AdapterSupport.cellOf(sheet, row, "headquarters", ctx));
            request.setSvnDpmC(deptCode);
            request.setDvmDpmC(resolveOrg(sheet, row, "itTeamName", ctx));
            request.setUsid(resolveUser(sheet, row, "managerName", deptCode, ctx));
            request.setTlrUsid(resolveUser(sheet, row, "teamLeaderName", deptCode, ctx));
            request.setSttDtm(
                    AdapterSupport.ymToFirstDay(AdapterSupport.cellOf(sheet, row, "startYm", ctx)));
            request.setEndDtm(
                    AdapterSupport.ymToLastDay(AdapterSupport.cellOf(sheet, row, "endYm", ctx)));
            request.setExePttYn(AdapterSupport.cellOf(sheet, row, "feasibility", ctx));
            request.setAbusTc(
                    AdapterSupport.abusTc(AdapterSupport.cellOf(sheet, row, "progressLabel", ctx)));
            request.setOdnYn("N");
            request.setItems(items(sheet, row, ctx));
            projects.add(request);

            rates.add(
                    new RateIntent(
                            "BPROJM",
                            MigrationYearSnapshot.normalizeName(projectName),
                            AdapterSupport.ratePercent(
                                    AdapterSupport.cellOf(sheet, row, "adjustRate", ctx))));
        }
        return new AdapterOutput(List.of(), projects, List.of(), rates);
    }

    /** 개발비·기계장치·기타무형 세 열 중 금액이 0보다 큰 것만 품목으로 만듭니다. */
    private List<ProjectDto.BitemmDto> items(
            MigrationDto.SheetPayload sheet, MigrationDto.NormalizedRow row, AdapterContext ctx) {
        List<ProjectDto.BitemmDto> items = new ArrayList<>();
        addItem(items, sheet, row, ctx, "devAmount", IOE_DEV, "개발비");
        addItem(items, sheet, row, ctx, "hwAmount", IOE_HW, "기계장치");
        addItem(items, sheet, row, ctx, "swAmount", IOE_SW, "기타무형자산");
        return items;
    }

    private void addItem(
            List<ProjectDto.BitemmDto> items,
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            AdapterContext ctx,
            String amountColumn,
            String defaultIoeC,
            String itemLabel) {
        BigDecimal amount =
                AdapterSupport.amount(
                        AdapterSupport.cellOf(sheet, row, amountColumn, ctx), sheet.kind());
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        String ioeOverride =
                ctx.overrides()
                        .get(
                                MigrationValidator.overrideKey(
                                        sheet.kind(), row.excelRow(), amountColumn + "IoeC"));
        ProjectDto.BitemmDto item = new ProjectDto.BitemmDto();
        item.setIoeC(ioeOverride != null ? ioeOverride : defaultIoeC);
        item.setGclNm(itemLabel);
        item.setCurC("KRW");
        item.setAmt(amount);
        item.setXcrBseDt(ctx.bseYy() + "0101");
        items.add(item);
    }

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
        return ctx.index().org().orgNameOf(raw) != null ? raw : null;
    }

    private String resolveUser(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            String column,
            String deptHint,
            AdapterContext ctx) {
        String raw = AdapterSupport.cellOf(sheet, row, column, ctx);
        OrgIdentityResolver.Resolution resolution = ctx.index().org().resolveUser(raw, deptHint);
        if (resolution.code() != null) {
            return resolution.code();
        }
        return ctx.index().org().teamOfUser(raw) != null ? raw : null;
    }
}
```

- [ ] **Step 5: 비목 보정 컬럼을 검증기에 등록한다**

`MigrationValidator.validateProjectRow`에 품목 비목 보정 컬럼(`devAmountIoeC`·`hwAmountIoeC`·`swAmountIoeC`)이 유효한 자본예산 계열 비목인지 확인하는 검사를 추가한다.

```java
        for (String column : List.of("devAmountIoeC", "hwAmountIoeC", "swAmountIoeC")) {
            String override = overrides.get(overrideKey(sheet.kind(), row.excelRow(), column));
            if (override != null && !CAPITAL_IOE_CODES.contains(override)) {
                out.add(
                        blocker(
                                sheet,
                                row,
                                column,
                                "CODE_UNRESOLVED",
                                "'" + override + "'는 자본예산 계열 비목이 아닙니다.",
                                List.of()));
            }
        }
```

`MigrationValidator` 상단에 상수를 추가한다.

```java
    /** 자본예산 계열 비목코드 — 개발비·기계장치·기타무형자산 (IoeCategories.CAPITAL_CTPS에 대응). */
    private static final Set<String> CAPITAL_IOE_CODES =
            Set.of("101", "102", "103", "104", "105", "106", "107");
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*CapitalProjectSheetAdapterTest' --tests '*MigrationValidatorTest' --no-daemon`
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it/domain/migration src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 자본예산 시트 어댑터 추가와 품목 비목 보정 검증"
```

---

### Task 8: `DelegatedBudgetSheetAdapter`

위임예산 시트는 부점명이 병합·공백이라 forward-fill로 그룹을 만들고 부점당 사업 1건 + 품목 N건을 만든다(§5.5). 이 시트의 원화환산액은 이미 원 단위라 배수를 곱하지 않는다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/DelegatedBudgetSheetAdapter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/adapter/DelegatedBudgetSheetAdapterTest.java`

**Interfaces:**
- Produces: `DelegatedBudgetSheetAdapter` 빈. `supports()` = `SheetKind.DELEGATED_BUDGET`
- Produces: 경상 품목 비목 상수 — `IOE_HW_OVERSEA = "102"`, `IOE_SW_OVERSEA = "105"`
- 참고: 부점명 forward-fill은 **프론트 파서가 이미 수행**한다(Task 14). 어댑터는 모든 행에 부점명이 채워져 있다고 전제하되, 비어 있으면 직전 행 값을 이어 쓰는 방어 로직을 둔다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

실제 엑셀 2행(런던 데스크탑(고사양) GBP 12개 × 1,945.57 = 23,346.84, 원화 44,919,320)과 8행(런던 MS오피스 SW 99개)을 재현한다.

```java
package com.kdb.it.domain.migration.service.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.MigrationLookupIndex;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import com.kdb.it.domain.migration.service.TestSnapshots;
import com.kdb.it.common.iam.entity.CorgnI;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 위임예산 시트 → 경상 사업·품목 변환 규칙을 고정합니다 (§5.5). */
class DelegatedBudgetSheetAdapterTest {

    private final DelegatedBudgetSheetAdapter adapter = new DelegatedBudgetSheetAdapter();

    @Test
    @DisplayName("부점별로 사업 1건을 만들고 사업명·경상여부·기간을 규칙대로 채운다")
    void 부점별_경상사업을_만든다() {
        AdapterOutput out = adapter.adapt(sheet(londonRows()), context());

        assertThat(out.projects()).hasSize(2);
        assertThat(out.projects())
                .extracting(ProjectDto.CreateRequest::getAbusNm)
                .containsExactly("2026년 런던 위임예산(경상)", "2026년 런던 PF 위임예산(경상)");
        assertThat(out.projects())
                .allSatisfy(
                        p -> {
                            assertThat(p.getOdnYn()).isEqualTo("Y");
                            assertThat(p.getAbusTc()).isEqualTo("20");
                            assertThat(p.getSttDtm()).isEqualTo(LocalDate.of(2026, 1, 1));
                            assertThat(p.getEndDtm()).isEqualTo(LocalDate.of(2026, 12, 31));
                            assertThat(p.getUsid()).isEqualTo("999999");
                        });
    }

    @Test
    @DisplayName("원화환산액은 이미 원 단위라 배수를 곱하지 않는다")
    void 원화환산액을_그대로_쓴다() {
        ProjectDto.BitemmDto item = adapter.adapt(sheet(londonRows()), context())
                .projects()
                .get(0)
                .getItems()
                .get(0);

        assertThat(item.getAmt()).isEqualByComparingTo(new BigDecimal("44919320.16"));
    }

    @Test
    @DisplayName("HW 행은 국외기계장치 102, SW 행은 국외기타무형자산 105로 만든다")
    void 하드웨어와_소프트웨어_비목을_구분한다() {
        List<ProjectDto.BitemmDto> items =
                adapter.adapt(sheet(londonRows()), context()).projects().get(0).getItems();

        assertThat(items).extracting(ProjectDto.BitemmDto::getIoeC).containsExactly("102", "105");
    }

    @Test
    @DisplayName("수량·통화·외화금액을 품목에 옮긴다")
    void 수량과_외화금액을_옮긴다() {
        ProjectDto.BitemmDto item = adapter.adapt(sheet(londonRows()), context())
                .projects()
                .get(0)
                .getItems()
                .get(0);

        assertThat(item.getQty()).isEqualByComparingTo(new BigDecimal("12"));
        assertThat(item.getCurC()).isEqualTo("GBP");
        assertThat(item.getFcAmt()).isEqualByComparingTo(new BigDecimal("23346.84"));
    }

    @Test
    @DisplayName("부점명이 빈 행은 직전 행 부점을 이어 쓴다")
    void 부점명_공백행은_직전값을_잇는다() {
        List<MigrationDto.NormalizedRow> rows =
                List.of(
                        row(2, hwCells("런던", "데스크탑(고사양)", "12", "23346.84", "44919320.16")),
                        row(3, hwCells("", "데스크탑(일반사양)", "82", "68569.22", "131927179.28")));

        AdapterOutput out = adapter.adapt(sheet(rows), context());

        assertThat(out.projects()).hasSize(1);
        assertThat(out.projects().get(0).getItems()).hasSize(2);
    }

    @Test
    @DisplayName("HW·SW 금액이 모두 0인 행은 품목을 만들지 않는다")
    void 금액이_없는_행은_품목을_만들지_않는다() {
        Map<String, String> cells = hwCells("런던", "빈 항목", "0", "0", "0");

        AdapterOutput out = adapter.adapt(sheet(List.of(row(2, cells))), context());

        assertThat(out.projects().get(0).getItems()).isEmpty();
    }

    @Test
    @DisplayName("부점별로 편성률 100의 RateIntent를 남긴다")
    void 부점별_편성률의도를_남긴다() {
        AdapterOutput out = adapter.adapt(sheet(londonRows()), context());

        assertThat(out.rates())
                .hasSize(2)
                .allSatisfy(
                        r -> {
                            assertThat(r.orcTb()).isEqualTo("BPROJM");
                            assertThat(r.percent()).isEqualTo(100);
                        });
    }

    private static List<MigrationDto.NormalizedRow> londonRows() {
        return List.of(
                row(2, hwCells("런던", "데스크탑(고사양)", "12", "23346.84", "44919320.16")),
                row(3, swCells("런던", "MS오피스", "99", "53174.88", "102308469.12")),
                row(4, hwCells("런던 PF", "내부망 PC", "2", "1610.4", "3098409.6")));
    }

    private static MigrationDto.NormalizedRow row(int excelRow, Map<String, String> cells) {
        return new MigrationDto.NormalizedRow(excelRow, cells);
    }

    private static MigrationDto.SheetPayload sheet(List<MigrationDto.NormalizedRow> rows) {
        return new MigrationDto.SheetPayload(SheetKind.DELEGATED_BUDGET, "2026", rows);
    }

    private static AdapterContext context() {
        return new AdapterContext(
                "2026",
                new MigrationLookupIndex(
                        OrgIdentityResolver.Index.of(
                                List.of(org("0910", "런던"), org("0911", "런던 PF")), List.of()),
                        Map.of(),
                        Map.of("GBP", new BigDecimal("1924"))),
                TestSnapshots.empty("2026"),
                Map.of(),
                "999999");
    }

    private static CorgnI org(String code, String name) {
        return CorgnI.builder().prlmOgzCCone(code).bbrNm(name).build();
    }

    private static Map<String, String> hwCells(
            String branch, String item, String qty, String fc, String krw) {
        Map<String, String> cells = baseCells(branch, item);
        cells.put("hwQty", qty);
        cells.put("hwFcAmount", fc);
        cells.put("hwKrwAmount", krw);
        return cells;
    }

    private static Map<String, String> swCells(
            String branch, String item, String qty, String fc, String krw) {
        Map<String, String> cells = baseCells(branch, item);
        cells.put("swQty", qty);
        cells.put("swFcAmount", fc);
        cells.put("swKrwAmount", krw);
        return cells;
    }

    private static Map<String, String> baseCells(String branch, String item) {
        Map<String, String> cells = new LinkedHashMap<>();
        for (String column :
                com.kdb.it.domain.migration.dto.MigrationColumns.of(SheetKind.DELEGATED_BUDGET)) {
            cells.put(column, "");
        }
        cells.put("branchName", branch);
        cells.put("itemName", item);
        cells.put("currency", "GBP");
        return cells;
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*DelegatedBudgetSheetAdapterTest' --no-daemon`
Expected: 컴파일 실패 — `DelegatedBudgetSheetAdapter` 없음

- [ ] **Step 3: 구현한다**

```java
package com.kdb.it.domain.migration.service.adapter;

import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.MigrationYearSnapshot;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 자본예산 편성 요구서 `2. 위임예산(경상)` 시트를 부점별 경상사업과 품목으로 바꿉니다 (§5.5).
 *
 * <p>이 시트에는 사업명·주관부서·담당자·기간이 없어 규칙으로 생성합니다. 사업명은 `{연도}년 {부점명} 위임예산(경상)`, 기간은 해당 연도 전체, 담당자는
 * 업로드 사용자입니다. 원화환산액이 이미 원 단위라 금액 배수를 곱하지 않습니다.
 */
@Component
public class DelegatedBudgetSheetAdapter implements SheetAdapter {

    /** 국외점포 기계장치 비목. */
    static final String IOE_HW_OVERSEA = "102";

    /** 국외점포 기타무형자산 비목. */
    static final String IOE_SW_OVERSEA = "105";

    @Override
    public SheetKind supports() {
        return SheetKind.DELEGATED_BUDGET;
    }

    @Override
    public AdapterOutput adapt(MigrationDto.SheetPayload sheet, AdapterContext ctx) {
        // 부점명 등장 순서를 유지해야 사업 생성 순서가 엑셀과 같아진다
        Map<String, List<ProjectDto.BitemmDto>> itemsByBranch = new LinkedHashMap<>();
        String currentBranch = null;

        for (MigrationDto.NormalizedRow row : sheet.rows()) {
            String branch = AdapterSupport.cellOf(sheet, row, "branchName", ctx);
            if (!branch.isBlank()) {
                currentBranch = branch;
            }
            if (currentBranch == null) {
                // 첫 행부터 부점명이 비면 귀속시킬 사업이 없다 — 검증이 이미 막았어야 한다
                continue;
            }
            List<ProjectDto.BitemmDto> items =
                    itemsByBranch.computeIfAbsent(currentBranch, key -> new ArrayList<>());
            String currency = AdapterSupport.cellOf(sheet, row, "currency", ctx);
            String itemName = AdapterSupport.cellOf(sheet, row, "itemName", ctx);
            addItem(items, sheet, row, ctx, currency, itemName, "hw");
            addItem(items, sheet, row, ctx, currency, itemName, "sw");
        }

        List<ProjectDto.CreateRequest> projects = new ArrayList<>();
        List<RateIntent> rates = new ArrayList<>();
        itemsByBranch.forEach(
                (branch, items) -> {
                    String projectName = ctx.bseYy() + "년 " + branch + " 위임예산(경상)";
                    ProjectDto.CreateRequest request = new ProjectDto.CreateRequest();
                    request.setBseYy(ctx.bseYy());
                    request.setAbusNm(projectName);
                    request.setOdnYn("Y");
                    request.setAbusTc("20");
                    request.setSvnDpmC(resolveBranch(branch, ctx));
                    request.setUsid(ctx.actorEno());
                    request.setDvmUsid(ctx.actorEno());
                    int year = Integer.parseInt(ctx.bseYy());
                    request.setSttDtm(LocalDate.of(year, 1, 1));
                    request.setEndDtm(LocalDate.of(year, 12, 31));
                    request.setItems(items);
                    projects.add(request);
                    rates.add(
                            new RateIntent(
                                    "BPROJM",
                                    MigrationYearSnapshot.normalizeName(projectName),
                                    100));
                });
        return new AdapterOutput(List.of(), projects, List.of(), rates);
    }

    /**
     * HW·SW 한쪽의 품목을 만듭니다.
     *
     * @param prefix `hw` 또는 `sw` — 컬럼 id 접두어이자 비목 선택 기준
     */
    private void addItem(
            List<ProjectDto.BitemmDto> items,
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            AdapterContext ctx,
            String currency,
            String itemName,
            String prefix) {
        BigDecimal krw =
                AdapterSupport.amount(
                        AdapterSupport.cellOf(sheet, row, prefix + "KrwAmount", ctx), sheet.kind());
        if (krw == null || krw.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        ProjectDto.BitemmDto item = new ProjectDto.BitemmDto();
        item.setIoeC("hw".equals(prefix) ? IOE_HW_OVERSEA : IOE_SW_OVERSEA);
        item.setGclNm(itemName);
        item.setQty(AdapterSupport.number(AdapterSupport.cellOf(sheet, row, prefix + "Qty", ctx)));
        item.setCurC(currency.isBlank() ? "KRW" : currency);
        item.setFcAmt(
                AdapterSupport.foreignAmount(
                        AdapterSupport.cellOf(sheet, row, prefix + "FcAmount", ctx), currency));
        item.setAmt(krw);
        item.setXcrBseDt(ctx.bseYy() + "0101");
        items.add(item);
    }

    private String resolveBranch(String branch, AdapterContext ctx) {
        OrgIdentityResolver.Resolution resolution = ctx.index().org().resolveOrg(branch);
        return resolution.code();
    }
}
```

- [ ] **Step 4: 위임예산 검증에 부점명 forward-fill 전제를 추가한다**

`MigrationValidator.validateDelegatedRow`는 첫 행부터 부점명이 비면 귀속 사업이 없으므로 BLOCKER를 낸다. 시트 단위 상태가 필요하므로 `validate`의 `DELEGATED_BUDGET` 분기를 시트 루프 밖에서 한 번에 처리하도록 바꾼다.

```java
                    case DELEGATED_BUDGET -> { /* 시트 단위로 아래에서 처리 */ }
```

그리고 시트 루프 뒤에 추가한다.

```java
            if (sheet.kind() == SheetKind.DELEGATED_BUDGET && !sheet.rows().isEmpty()) {
                MigrationDto.NormalizedRow first = sheet.rows().get(0);
                if (cell(first, "branchName", overrides, sheet).isBlank()) {
                    out.add(
                            blocker(
                                    sheet,
                                    first,
                                    "branchName",
                                    "REQUIRED_MISSING",
                                    "첫 행의 부점명이 비어 있어 이후 행을 귀속시킬 사업을 만들 수 없습니다.",
                                    List.of()));
                }
                for (MigrationDto.NormalizedRow row : sheet.rows()) {
                    validateDelegatedRow(sheet, row, index, overrides, out);
                }
            }
```

`validateDelegatedRow`의 `resolveOrgCell(... "branchName" ... required=true)` 호출은 부점명이 빈 행(forward-fill 대상)에서 오탐을 내므로 `required=false`로 바꾼다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*DelegatedBudgetSheetAdapterTest' --tests '*MigrationValidatorTest' --no-daemon`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it/domain/migration src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 위임예산 시트 어댑터 추가와 부점명 forward-fill 검증"
```

---

### Task 9: `PlanAdjustmentSheetAdapter`

부문계획 조정 시트를 계획 조정 의도로 바꾼다. 조정액은 비율 곱이 아니라 확정 금액이라 `PlanIntent`로 넘기고, `MigrationImportService`가 대상 사업의 `BITEMM`을 버전 교체한다(§5.4).

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/adapter/PlanAdjustmentSheetAdapter.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/adapter/PlanAdjustmentSheetAdapterTest.java`

**Interfaces:**
- Produces: `PlanAdjustmentSheetAdapter` 빈. `supports()` = `SheetKind.PLAN_ADJUSTMENT`
- Produces: `AdapterOutput.plans()`에 행별 `PlanIntent`, `AdapterOutput.rates()`에 편성률 100의 `RateIntent`
- `snapshotFields` 키: `spentBefore`, `spent26`, `planned26`, `plannedAfter27`, `progressLabel`, `budgetChangeLabel`, `remark`, `generalAmount`, `totalAmount`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

실제 엑셀 3행(웹한글 기안기: 개발비 0, 기계장치 0, 기타무형 416, 감액, 진행(품의), 예상지급일정 `'26.12월`)을 재현한다.

```java
package com.kdb.it.domain.migration.service.adapter;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.migration.dto.MigrationColumns;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.MigrationLookupIndex;
import com.kdb.it.domain.migration.service.OrgIdentityResolver;
import com.kdb.it.domain.migration.service.TestSnapshots;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 부문계획 조정 시트 → 계획 조정 의도 변환 규칙을 고정합니다 (§5.4). */
class PlanAdjustmentSheetAdapterTest {

    private final PlanAdjustmentSheetAdapter adapter = new PlanAdjustmentSheetAdapter();

    @Test
    @DisplayName("조정액을 백만원에서 원 단위로 올려 PlanIntent에 담는다")
    void 조정액을_원단위로_올린다() {
        PlanIntent intent = adaptSingle(cells());

        assertThat(intent.swAmount()).isEqualByComparingTo(new BigDecimal("416000000.000"));
        assertThat(intent.devAmount()).isNull();
        assertThat(intent.hwAmount()).isNull();
    }

    @Test
    @DisplayName("사업명을 정규화해 동일성 판정 키로 담는다")
    void 사업명을_정규화한다() {
        assertThat(adaptSingle(cells()).normalizedProjectName())
                .isEqualTo("웹한글기안기도입을위한내규솔루션업그레이드");
    }

    @Test
    @DisplayName("예상지급일정을 BSE_YM 6자리로 바꾼다")
    void 예상지급일정을_연월6자리로_바꾼다() {
        assertThat(adaptSingle(cells()).paymentYm()).isEqualTo("202612");
    }

    @Test
    @DisplayName("금액 0은 품목을 만들지 않도록 null로 접는다")
    void 금액0은_null로_접는다() {
        Map<String, String> cells = cells();
        cells.put("swAmount", "0");

        assertThat(adaptSingle(cells).swAmount()).isNull();
    }

    @Test
    @DisplayName("집행 실적·사업진행·비고는 스냅샷 필드로만 담는다")
    void 집행실적은_스냅샷에만_담는다() {
        PlanIntent intent = adaptSingle(cells());

        assertThat(intent.snapshotFields())
                .containsEntry("progressLabel", "진행(품의)")
                .containsEntry("budgetChangeLabel", "감액")
                .containsEntry("planned26", "416")
                .containsEntry("remark", "6.10자 품의 완료");
    }

    @Test
    @DisplayName("조정된 사업에는 편성률 100의 RateIntent를 남긴다")
    void 편성률100을_남긴다() {
        AdapterOutput out = adapter.adapt(sheet(cells()), context());

        assertThat(out.rates())
                .singleElement()
                .satisfies(
                        r -> {
                            assertThat(r.orcTb()).isEqualTo("BPROJM");
                            assertThat(r.percent()).isEqualTo(100);
                            assertThat(r.naturalKeyOrPk())
                                    .isEqualTo("웹한글기안기도입을위한내규솔루션업그레이드");
                        });
    }

    @Test
    @DisplayName("사업·전산업무비 생성요청은 만들지 않는다")
    void 원장_생성요청은_만들지_않는다() {
        AdapterOutput out = adapter.adapt(sheet(cells()), context());

        assertThat(out.costs()).isEmpty();
        assertThat(out.projects()).isEmpty();
    }

    private PlanIntent adaptSingle(Map<String, String> cells) {
        return adapter.adapt(sheet(cells), context()).plans().get(0);
    }

    private static MigrationDto.SheetPayload sheet(Map<String, String> cells) {
        return new MigrationDto.SheetPayload(
                SheetKind.PLAN_ADJUSTMENT, "2026", List.of(new MigrationDto.NormalizedRow(2, cells)));
    }

    private static AdapterContext context() {
        return new AdapterContext(
                "2026",
                new MigrationLookupIndex(
                        OrgIdentityResolver.Index.of(List.of(), List.of()), Map.of(), Map.of()),
                TestSnapshots.empty("2026"),
                Map.of(),
                "999999");
    }

    private static Map<String, String> cells() {
        Map<String, String> cells = new LinkedHashMap<>();
        for (String column : MigrationColumns.of(SheetKind.PLAN_ADJUSTMENT)) {
            cells.put(column, "");
        }
        cells.put("projectName", "웹한글 기안기 도입을 위한 내규 솔루션 업그레이드");
        cells.put("projectType", "법률/규제대응");
        cells.put("headquarters", "기획관리부문");
        cells.put("deptName", "종합기획부");
        cells.put("teamName", "조직평가팀");
        cells.put("managerName", "김성원 과장");
        cells.put("teamLeaderName", "김도준 팀장");
        cells.put("budgetChangeLabel", "감액");
        cells.put("startYm", "'26.06");
        cells.put("endYm", "'26.12");
        cells.put("swAmount", "416");
        cells.put("totalAmount", "416");
        cells.put("planned26", "416");
        cells.put("paymentSchedule", "'26.12월");
        cells.put("progressLabel", "진행(품의)");
        cells.put("remark", "6.10자 품의 완료");
        return cells;
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*PlanAdjustmentSheetAdapterTest' --no-daemon`
Expected: 컴파일 실패 — `PlanAdjustmentSheetAdapter` 없음

- [ ] **Step 3: 구현한다**

```java
package com.kdb.it.domain.migration.service.adapter;

import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.MigrationYearSnapshot;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 정보기술부문계획 조정 `26년정보화사업(자본예산)` 시트를 계획 조정 의도로 바꿉니다 (§5.4).
 *
 * <p>조정액은 편성요청액에 비율을 곱한 값이 아니라 확정 금액입니다(품의·계약 반영). {@code Bbugtm.asgRt}가 정수라 비율로는 재현되지 않으므로,
 * 대상 사업의 {@code BITEMM}을 이 금액으로 버전 교체하고 편성률 100을 적용합니다. 실제 교체는
 * {@code MigrationImportService}가 수행하고 이 어댑터는 의도만 만듭니다.
 *
 * <p>집행 실적 4열과 사업진행·비고는 원장 컬럼에 대응하는 자리가 없어 계획 스냅샷({@code BPLANM.REDT_CONE_INF})에만 남깁니다.
 */
@Component
public class PlanAdjustmentSheetAdapter implements SheetAdapter {

    /** 계획 스냅샷에만 남길 컬럼 목록. */
    private static final List<String> SNAPSHOT_ONLY_COLUMNS =
            List.of(
                    "spentBefore", "spent26", "planned26", "plannedAfter27",
                    "progressLabel", "budgetChangeLabel", "remark",
                    "generalAmount", "totalAmount");

    @Override
    public SheetKind supports() {
        return SheetKind.PLAN_ADJUSTMENT;
    }

    @Override
    public AdapterOutput adapt(MigrationDto.SheetPayload sheet, AdapterContext ctx) {
        List<PlanIntent> plans = new ArrayList<>();
        List<RateIntent> rates = new ArrayList<>();

        for (MigrationDto.NormalizedRow row : sheet.rows()) {
            String normalizedName =
                    MigrationYearSnapshot.normalizeName(
                            AdapterSupport.cellOf(sheet, row, "projectName", ctx));

            Map<String, String> snapshotFields = new LinkedHashMap<>();
            for (String column : SNAPSHOT_ONLY_COLUMNS) {
                snapshotFields.put(column, AdapterSupport.cellOf(sheet, row, column, ctx));
            }

            plans.add(
                    new PlanIntent(
                            normalizedName,
                            positiveAmount(sheet, row, ctx, "devAmount"),
                            positiveAmount(sheet, row, ctx, "hwAmount"),
                            positiveAmount(sheet, row, ctx, "swAmount"),
                            AdapterSupport.ymToYyyymm(
                                    AdapterSupport.cellOf(sheet, row, "paymentSchedule", ctx)),
                            snapshotFields));

            rates.add(new RateIntent("BPROJM", normalizedName, 100));
        }
        return new AdapterOutput(List.of(), List.of(), plans, rates);
    }

    /** 0 이하 금액은 품목을 만들 이유가 없으므로 null로 접습니다. */
    private BigDecimal positiveAmount(
            MigrationDto.SheetPayload sheet,
            MigrationDto.NormalizedRow row,
            AdapterContext ctx,
            String column) {
        BigDecimal amount =
                AdapterSupport.amount(AdapterSupport.cellOf(sheet, row, column, ctx), sheet.kind());
        return (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) ? null : amount;
    }
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*SheetAdapterTest' --no-daemon`
Expected: PASS (어댑터 4개 테스트 전부)

- [ ] **Step 5: 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it/domain/migration src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 부문계획 조정 시트 어댑터 추가"
```

---

## Phase D — 오케스트레이션과 API

### Task 10: `MigrationApprovalStamper`

원장만 적재하면 예산 편성·집계 화면이 0으로 나온다(§3.6). 이관용 결재완료 받이를 만들어 `CAPPLA`로 원천에 연결한다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationApprovalStamper.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationApprovalStamperTest.java`

**Interfaces:**
- Consumes: `ApplicationRepository`(=`Capplm` 리포지토리), `ApplicationMapRepository`(=`Cappla` 리포지토리). 실제 이름은 `ls src/main/java/com/kdb/it/common/approval/repository/`로 확인한다
- Produces: `MigrationApprovalStamper.stamp(String fntTbNm, String pkColNm, Integer fntTbCrySno, String title, String actorEno, String bseYy)` → `String` (생성한 `APF_DCM_NO`)

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```java
package com.kdb.it.domain.migration.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.kdb.it.common.approval.domain.ApprovalStatus;
import com.kdb.it.common.approval.entity.Cappla;
import com.kdb.it.common.approval.entity.Capplm;
import com.kdb.it.common.approval.repository.ApplicationMapRepository;
import com.kdb.it.common.approval.repository.ApplicationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** 이관용 결재완료 받이 생성 규칙을 고정합니다 (§3.6). */
@ExtendWith(MockitoExtension.class)
class MigrationApprovalStamperTest {

    @Mock private ApplicationRepository applicationRepository;
    @Mock private ApplicationMapRepository applicationMapRepository;
    @InjectMocks private MigrationApprovalStamper stamper;

    @Captor private ArgumentCaptor<Capplm> capplmCaptor;
    @Captor private ArgumentCaptor<Cappla> capplaCaptor;

    @Test
    @DisplayName("신청서 번호는 기존 APF-{연도}-{8자리} 형식을 그대로 쓴다")
    void 신청서번호는_기존형식을_쓴다() {
        when(applicationRepository.getNextSequenceValue()).thenReturn(42L);
        when(applicationRepository.save(any(Capplm.class))).thenAnswer(i -> i.getArgument(0));

        String apfNo = stamper.stamp("BCOSTM", "COST-2026-0001", 1, "이관", "999999", "2026");

        assertThat(apfNo).isEqualTo("APF-2026-00000042");
    }

    @Test
    @DisplayName("상태는 결재완료('2')이고 요청자는 업로드 사용자다")
    void 결재완료상태로_생성한다() {
        when(applicationRepository.getNextSequenceValue()).thenReturn(1L);
        when(applicationRepository.save(any(Capplm.class))).thenAnswer(i -> i.getArgument(0));

        stamper.stamp("BCOSTM", "COST-2026-0001", 1, "2026년 전산업무비 이관", "999999", "2026");

        org.mockito.Mockito.verify(applicationRepository).save(capplmCaptor.capture());
        Capplm saved = capplmCaptor.getValue();
        assertThat(saved.getItPtlApfPrgStsC()).isEqualTo(ApprovalStatus.COMPLETED.code());
        assertThat(saved.getDcdReqUsid()).isEqualTo("999999");
        assertThat(saved.getDcdReqTtl()).contains("이관");
    }

    @Test
    @DisplayName("원천 연결 CAPPLA를 같은 신청서번호로 만든다")
    void 원천연결을_만든다() {
        when(applicationRepository.getNextSequenceValue()).thenReturn(7L);
        when(applicationRepository.save(any(Capplm.class))).thenAnswer(i -> i.getArgument(0));

        stamper.stamp("BPROJM", "PRJ-2026-0001", 1, "이관", "999999", "2026");

        org.mockito.Mockito.verify(applicationMapRepository).save(capplaCaptor.capture());
        Cappla saved = capplaCaptor.getValue();
        assertThat(saved.getApfDcmNo()).isEqualTo("APF-2026-00000007");
        assertThat(saved.getFntTbNm()).isEqualTo("BPROJM");
        assertThat(saved.getPkColNm()).isEqualTo("PRJ-2026-0001");
        assertThat(saved.getFntTbCrySno()).isEqualTo(1);
    }

    @Test
    @DisplayName("이관 표시를 등록자결재요청내용에 남긴다")
    void 이관표시를_남긴다() {
        when(applicationRepository.getNextSequenceValue()).thenReturn(1L);
        when(applicationRepository.save(any(Capplm.class))).thenAnswer(i -> i.getArgument(0));

        stamper.stamp("BCOSTM", "COST-2026-0001", 1, "이관", "999999", "2026");

        org.mockito.Mockito.verify(applicationRepository).save(capplmCaptor.capture());
        assertThat(capplmCaptor.getValue().getRgprDcdReqCone())
                .contains("수기 엑셀 이관")
                .doesNotContain("MIG-");
    }
}
```

- [ ] **Step 2: 리포지토리 이름과 시퀀스 메서드를 확인한다**

```bash
cd /c/it/it_backend && ls src/main/java/com/kdb/it/common/approval/repository/
grep -rn "getNextSequenceValue\|SQ_TPRMPP_CAPPLM" src/main/java/com/kdb/it/common/approval/repository/
```

`Capplm`용 시퀀스 조회 메서드가 없으면 추가한다.

```java
    /**
     * 신청서식별번호 채번용 Oracle 시퀀스 원값을 가져옵니다.
     *
     * <p>번호 조립은 호출자가 {@code String.format("APF-%s-%08d", ...)}로 수행합니다. Oracle {@code LPAD}는 자릿수를
     * 넘는 값을 잘라내 번호가 조용히 충돌하므로 쓰지 않습니다.
     *
     * @return 다음 시퀀스 값
     */
    @Query(value = "SELECT SQ_TPRMPP_CAPPLM_1.NEXTVAL FROM DUAL", nativeQuery = true)
    Long getNextSequenceValue();
```

실제 시퀀스명은 DB에서 확인한다.

```bash
cd /c/it && { printf '%s\n' "$DB_PASSWORD"; printf "%s\n" "SELECT SEQUENCE_NAME FROM ALL_SEQUENCES WHERE SEQUENCE_OWNER='ITPOWN' AND SEQUENCE_NAME LIKE '%CAPPL%';" "EXIT"; } | sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationApprovalStamperTest' --no-daemon`
Expected: 컴파일 실패 — `MigrationApprovalStamper` 없음

- [ ] **Step 4: 구현한다**

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.common.approval.domain.ApprovalStatus;
import com.kdb.it.common.approval.entity.Cappla;
import com.kdb.it.common.approval.entity.Capplm;
import com.kdb.it.common.approval.repository.ApplicationMapRepository;
import com.kdb.it.common.approval.repository.ApplicationRepository;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이관한 원장에 결재완료 받이를 붙입니다.
 *
 * <p>예산 편성·집계 조회는 결재완료 신청서가 {@code CAPPLA}로 연결된 원장만 집계하므로(§3.6), 받이가 없으면 이관 데이터가 화면에서 0으로 보입니다.
 * 상승된 결재이력({@code CDECIM} 등)은 만들지 않아 재현된 결재선이 아님이 구분됩니다.
 *
 * <p>신청서번호는 기존 {@code APF-{연도}-{8자리}} 형식을 그대로 씁니다. {@code ApplicationMapRepository}가 사전식 내림차순을
 * 시간순으로 전제하므로 별도 접두어를 쓰면 이관 문서가 항상 최신으로 정렬되어 그 전제가 깨집니다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class MigrationApprovalStamper {

    private final ApplicationRepository applicationRepository;
    private final ApplicationMapRepository applicationMapRepository;

    /**
     * 원천 한 건에 결재완료 받이를 만듭니다.
     *
     * @param fntTbNm 원천테이블명 — `BCOSTM` 또는 `BPROJM`
     * @param pkColNm 원천 PK (전산업무비코드 또는 사업관리번호)
     * @param fntTbCrySno 원천 일련번호
     * @param title 결재요청제목 (이관임을 알 수 있게 조립해 넘긴다)
     * @param actorEno 업로드 사용자 사번
     * @param bseYy 예산연도 (신청서번호 연도부에 씁니다)
     * @return 생성한 신청서식별번호
     */
    public String stamp(
            String fntTbNm,
            String pkColNm,
            Integer fntTbCrySno,
            String title,
            String actorEno,
            String bseYy) {
        Long sequence = applicationRepository.getNextSequenceValue();
        String apfDcmNo = String.format("APF-%s-%08d", bseYy, sequence);

        Capplm application =
                Capplm.builder()
                        .apfMngNo(apfDcmNo)
                        .itPtlApfPrgStsC(ApprovalStatus.COMPLETED.code())
                        .dcdReqTtl(title)
                        .dcdReqUsid(actorEno)
                        .dcdReqDtm(LocalDate.now())
                        .rgprDcdReqCone("수기 엑셀 이관으로 생성된 결재완료 기록입니다. 실제 결재선을 거치지 않았습니다.")
                        .build();
        applicationRepository.save(application);

        applicationMapRepository.save(
                Cappla.builder()
                        .apfDcmNo(apfDcmNo)
                        .fntTbNm(fntTbNm)
                        .pkColNm(pkColNm)
                        .fntTbCrySno(fntTbCrySno)
                        .build());
        return apfDcmNo;
    }
}
```

> `Capplm`의 `DCD_REQ_BBR_C`가 NOT NULL이면 빌더에 업로드 사용자 부점코드를 함께 넣는다. 엔티티 정의에는 nullable이지만 물리 제약을 `ALL_TAB_COLUMNS`로 확인한다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationApprovalStamperTest' --no-daemon`
Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 이관용 결재완료 받이 생성기 추가"
```

---

### Task 11: `MigrationImportService`

트랜잭션 경계와 §7의 5단계 순서를 구현한다. 이 태스크가 계획의 중심이다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationImportService.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/service/MigrationIoeCatalogReader.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/service/MigrationImportServiceTest.java`

**Interfaces:**
- Consumes: 어댑터 4개(`List<SheetAdapter>` 주입), `MigrationValidator`, `MigrationYearSnapshot`, `OrgIdentityResolver`, `MigrationApprovalStamper`, `CostService`, `ProjectService`, `BudgetRateApplicationService`, `ProjectItemRepository`, `PlanService`
- Produces: `MigrationImportService.dryRun(MigrationDto.DryRunRequest request)` → `MigrationDto.DryRunResponse`
- Produces: `MigrationImportService.commit(MigrationDto.CommitRequest request, String actorEno)` → `MigrationDto.CommitResponse`
- Produces: `MigrationIoeCatalogReader.ioeCodeByName()` → `Map<String,String>`, `xcrByCurrency()` → `Map<String,BigDecimal>`

- [ ] **Step 1: 조회 인덱스 로더를 먼저 만든다**

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.common.code.CommonCodeGroups;
import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CodeRepository;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이관 검증·변환에 필요한 공통코드를 한 번에 읽습니다.
 *
 * <p>비목은 코드값명 → 코드값 역방향 맵, 환율은 통화 → 예산환율 맵으로 만듭니다. 환율은
 * {@code XcrLookupService}와 같은 원천({@code C_ID='CUR_C'}, {@code C_TP='XCR'}, {@code CO_CDVA_NM})을 읽어
 * dry-run의 금액 대조가 실제 저장값과 어긋나지 않게 합니다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class MigrationIoeCatalogReader {

    private final CodeRepository codeRepository;

    /**
     * 비목 코드값명 → 코드값 맵을 만듭니다.
     *
     * @return 예: `{"국내전산임차료" → "001", "유지보수료" → "011"}`. 코드값명이 중복되면 먼저 나온 것을 씁니다
     */
    public Map<String, String> ioeCodeByName() {
        Map<String, String> out = new LinkedHashMap<>();
        for (Ccodem code : codeRepository.findByCIdAndDelYn(CommonCodeGroups.IOE, "N")) {
            if (code.getCdvaNm() != null) {
                out.putIfAbsent(code.getCdvaNm().trim(), code.getCdva());
            }
        }
        return out;
    }

    /**
     * 통화 → 예산환율 맵을 만듭니다.
     *
     * @return 예: `{"GBP" → 1924, "USD" → 1432}`. 숫자로 파싱되지 않는 행은 건너뛰고 경고를 남깁니다
     */
    public Map<String, BigDecimal> xcrByCurrency() {
        Map<String, BigDecimal> out = new LinkedHashMap<>();
        for (Ccodem code : codeRepository.findByCIdAndDelYn(CommonCodeGroups.CURRENCY, "N")) {
            if (!"XCR".equals(code.getCTp()) || code.getCdvaDtlC() == null) {
                continue;
            }
            try {
                out.putIfAbsent(code.getCdva(), new BigDecimal(code.getCdvaDtlC().trim()));
            } catch (NumberFormatException e) {
                log.warn("예산환율 공통코드 값을 숫자로 읽지 못했습니다: 통화={}", code.getCdva());
            }
        }
        return out;
    }
}
```

`CodeRepository.findByCIdAndDelYn(String cId, String delYn)`이 없으면 추가한다. 실제 필드명은 `Ccodem.cId`(물리 `CO_C_ID_NM`)이므로 Spring Data 메서드명은 `findByCIdAndDelYn`이 맞다.

- [ ] **Step 2: 실패하는 서비스 테스트를 작성한다**

```java
package com.kdb.it.domain.migration.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.cost.service.CostService;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.budget.project.service.ProjectService;
import com.kdb.it.domain.budget.work.dto.BudgetWorkDto;
import com.kdb.it.domain.budget.work.service.BudgetRateApplicationService;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/** 반영 순서·전량 롤백·applyItemRates 단일 호출을 고정합니다 (§7). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MigrationImportServiceTest {

    @Mock private CostService costService;
    @Mock private ProjectService projectService;
    @Mock private BudgetRateApplicationService budgetRateApplicationService;
    @Mock private MigrationApprovalStamper approvalStamper;
    @Mock private MigrationValidator validator;
    @Mock private MigrationYearSnapshot yearSnapshot;
    @Mock private OrgIdentityResolver orgIdentityResolver;
    @Mock private MigrationIoeCatalogReader catalogReader;

    /** BLOCKER가 하나라도 있으면 아무 서비스도 호출되지 않는다. */
    @Test
    @DisplayName("BLOCKER가 있으면 원장을 하나도 쓰지 않고 실패한다")
    void 블로커가_있으면_아무것도_쓰지_않는다() {
        MigrationImportService service = service();
        when(validator.validate(any(), any(), any(), any()))
                .thenReturn(
                        List.of(
                                new MigrationDto.CellDiagnostic(
                                        SheetKind.COST,
                                        2,
                                        "deptName",
                                        "ORG_UNRESOLVED",
                                        MigrationDto.Severity.BLOCKER,
                                        "해석 실패",
                                        List.of())));

        assertThatThrownBy(() -> service.commit(commitRequest(), "999999"))
                .isInstanceOf(com.kdb.it.exception.CustomGeneralException.class)
                .hasMessageContaining("반영할 수 없습니다");

        verify(costService, never()).createCost(any(), anyBoolean());
        verify(projectService, never()).createProject(any(), anyBoolean());
        verify(budgetRateApplicationService, never()).applyItemRates(any());
    }

    /** WARNING만 있으면 반영이 진행된다. */
    @Test
    @DisplayName("WARNING만 있으면 반영을 진행한다")
    void 경고만_있으면_반영한다() {
        MigrationImportService service = service();
        when(validator.validate(any(), any(), any(), any()))
                .thenReturn(
                        List.of(
                                new MigrationDto.CellDiagnostic(
                                        SheetKind.COST,
                                        2,
                                        "krwAmount",
                                        "AMOUNT_MISMATCH",
                                        MigrationDto.Severity.WARNING,
                                        "금액 불일치",
                                        List.of())));
        when(costService.createCost(any(), anyBoolean())).thenReturn("COST-2026-0001");

        MigrationDto.CommitResponse response = service.commit(commitRequest(), "999999");

        assertThat(response.costCount()).isEqualTo(1);
        verify(costService).createCost(any(), anyBoolean());
    }

    /** 원장 생성은 기간 검증 생략 경로를 쓴다. */
    @Test
    @DisplayName("원장 생성은 기간 검증을 생략하는 오버로드를 호출한다")
    void 기간검증_생략경로를_쓴다() {
        MigrationImportService service = service();
        when(validator.validate(any(), any(), any(), any())).thenReturn(List.of());
        when(costService.createCost(any(), anyBoolean())).thenReturn("COST-2026-0001");

        service.commit(commitRequest(), "999999");

        ArgumentCaptor<Boolean> skip = ArgumentCaptor.forClass(Boolean.class);
        verify(costService).createCost(any(CostDto.CreateRequest.class), skip.capture());
        assertThat(skip.getValue()).isTrue();
    }

    /** applyItemRates는 정확히 한 번만 호출한다. */
    @Test
    @DisplayName("applyItemRates를 정확히 한 번만 호출한다")
    void 편성률적용은_한번만_호출한다() {
        MigrationImportService service = service();
        when(validator.validate(any(), any(), any(), any())).thenReturn(List.of());
        when(costService.createCost(any(), anyBoolean())).thenReturn("COST-2026-0001");

        service.commit(commitRequest(), "999999");

        verify(budgetRateApplicationService, times(1)).applyItemRates(any());
    }

    /** items에는 이관분과 기존 연도 데이터가 모두 담겨야 한다. */
    @Test
    @DisplayName("applyItemRates items에 이관분과 기존 연도 데이터를 함께 담는다")
    void 편성률items에_연도전체를_담는다() {
        MigrationImportService service = service();
        when(validator.validate(any(), any(), any(), any())).thenReturn(List.of());
        when(costService.createCost(any(), anyBoolean())).thenReturn("COST-2026-0001");
        when(yearSnapshot.load("2026"))
                .thenReturn(
                        new MigrationYearSnapshot.Data(
                                "2026",
                                java.util.Set.of(),
                                new java.util.LinkedHashMap<>(
                                        Map.of("기존사업", "PRJ-2026-0099")),
                                java.util.Set.of(),
                                new java.util.LinkedHashMap<>(
                                        Map.of("BPROJM|PRJ-2026-0099", 80)),
                                List.of("COST-2026-0099")));

        service.commit(commitRequest(), "999999");

        ArgumentCaptor<BudgetWorkDto.ItemApplyRequest> captor =
                ArgumentCaptor.forClass(BudgetWorkDto.ItemApplyRequest.class);
        verify(budgetRateApplicationService).applyItemRates(captor.capture());

        assertThat(captor.getValue().items())
                .extracting(BudgetWorkDto.ItemRate::orcPkVl)
                .contains("COST-2026-0001", "PRJ-2026-0099", "COST-2026-0099");
        assertThat(captor.getValue().items())
                .filteredOn(i -> "PRJ-2026-0099".equals(i.orcPkVl()))
                .singleElement()
                .satisfies(i -> assertThat(i.assetDupRt()).isEqualTo(80));
    }

    /** 원장 생성 직후 결재 받이를 만든다. */
    @Test
    @DisplayName("생성한 전산업무비마다 결재 받이를 만든다")
    void 원장마다_결재받이를_만든다() {
        MigrationImportService service = service();
        when(validator.validate(any(), any(), any(), any())).thenReturn(List.of());
        when(costService.createCost(any(), anyBoolean())).thenReturn("COST-2026-0001");

        service.commit(commitRequest(), "999999");

        verify(approvalStamper)
                .stamp(
                        org.mockito.ArgumentMatchers.eq("BCOSTM"),
                        org.mockito.ArgumentMatchers.eq("COST-2026-0001"),
                        any(),
                        anyString(),
                        org.mockito.ArgumentMatchers.eq("999999"),
                        org.mockito.ArgumentMatchers.eq("2026"));
    }

    /** dry-run은 아무것도 쓰지 않는다. */
    @Test
    @DisplayName("dry-run은 원장을 쓰지 않고 진단만 돌려준다")
    void dryRun은_쓰지_않는다() {
        MigrationImportService service = service();
        when(validator.validate(any(), any(), any(), any()))
                .thenReturn(
                        List.of(
                                new MigrationDto.CellDiagnostic(
                                        SheetKind.COST,
                                        2,
                                        "deptName",
                                        "ORG_UNRESOLVED",
                                        MigrationDto.Severity.BLOCKER,
                                        "해석 실패",
                                        List.of())));

        MigrationDto.DryRunResponse response =
                service.dryRun(new MigrationDto.DryRunRequest(commitRequest().sheets()));

        assertThat(response.summary().blockerCount()).isEqualTo(1);
        assertThat(response.summary().totalRows()).isEqualTo(1);
        verify(costService, never()).createCost(any(), anyBoolean());
    }

    private MigrationImportService service() {
        when(yearSnapshot.load(anyString())).thenReturn(TestSnapshots.empty("2026"));
        when(orgIdentityResolver.snapshot())
                .thenReturn(OrgIdentityResolver.Index.of(List.of(), List.of()));
        when(catalogReader.ioeCodeByName()).thenReturn(Map.of("유지보수료", "011"));
        when(catalogReader.xcrByCurrency()).thenReturn(Map.of());
        return new MigrationImportService(
                List.of(new com.kdb.it.domain.migration.service.adapter.CostSheetAdapter()),
                validator,
                yearSnapshot,
                orgIdentityResolver,
                catalogReader,
                approvalStamper,
                costService,
                projectService,
                budgetRateApplicationService,
                null,
                null);
    }

    private static MigrationDto.CommitRequest commitRequest() {
        Map<String, String> cells =
                new java.util.LinkedHashMap<>(
                        Map.of(
                                "abusCode", "571",
                                "ioeName", "유지보수료",
                                "abusTcLabel", "계속",
                                "vendorName", "커브",
                                "requestDetail", "올인원워크스페이스",
                                "deptName", "IT기획부",
                                "teamName", "IT기획팀",
                                "currency", "KRW",
                                "krwAmount", "15401"));
        return new MigrationDto.CommitRequest(
                List.of(
                        new MigrationDto.SheetPayload(
                                SheetKind.COST,
                                "2026",
                                List.of(new MigrationDto.NormalizedRow(2, cells)))),
                List.of());
    }
}
```

> 마지막 두 생성자 인자(`null`)는 `ProjectItemRepository`와 `PlanService`다. 이 테스트는 전산업무비 경로만 검증하므로 `@Mock`으로 바꿔 넣되 사용되지 않는다. 부문계획 경로 검증은 Task 13의 Oracle 통합 테스트가 담당한다 — 목으로는 `BITEMM` 버전 교체와 `applyItemRates`의 상호작용을 신뢰성 있게 검증하기 어렵다.

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationImportServiceTest' --no-daemon`
Expected: 컴파일 실패 — `MigrationImportService` 없음

- [ ] **Step 4: 구현한다**

```java
package com.kdb.it.domain.migration.service;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.cost.service.CostService;
import com.kdb.it.domain.budget.plan.service.PlanService;
import com.kdb.it.domain.budget.project.dto.ProjectDto;
import com.kdb.it.domain.budget.project.entity.Bitemm;
import com.kdb.it.domain.budget.project.repository.ProjectItemRepository;
import com.kdb.it.domain.budget.project.service.ProjectService;
import com.kdb.it.domain.budget.work.dto.BudgetWorkDto;
import com.kdb.it.domain.budget.work.service.BudgetRateApplicationService;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.adapter.AdapterContext;
import com.kdb.it.domain.migration.service.adapter.AdapterOutput;
import com.kdb.it.domain.migration.service.adapter.PlanIntent;
import com.kdb.it.domain.migration.service.adapter.RateIntent;
import com.kdb.it.domain.migration.service.adapter.SheetAdapter;
import com.kdb.it.exception.CustomGeneralException;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 수기 엑셀 이관의 사전검증과 확정 반영을 조율합니다.
 *
 * <p>dry-run 결과를 서버에 보관하지 않으므로 확정 반영은 클라이언트가 보낸 값을 신뢰하지 않고 같은 검증을 다시 돌립니다. BLOCKER가 하나라도 있으면 아무
 * 원장도 쓰지 않고 실패합니다.
 *
 * <p>반영 순서가 중요합니다(§7). 부문계획 조정은 자본예산이 만든 품목을 버전 교체하므로 원장 단계의 마지막이며, 편성행은
 * {@code applyItemRates} 단일 호출이 전담합니다 — 이 메서드는 연도 전체를 재작성하고 삭제 이력을 남기지 않으므로 두 번 호출하면 첫 결과가 흔적 없이
 * 사라집니다.
 */
@Service
@Slf4j
public class MigrationImportService {

    private final Map<SheetKind, SheetAdapter> adapters = new EnumMap<>(SheetKind.class);
    private final MigrationValidator validator;
    private final MigrationYearSnapshot yearSnapshot;
    private final OrgIdentityResolver orgIdentityResolver;
    private final MigrationIoeCatalogReader catalogReader;
    private final MigrationApprovalStamper approvalStamper;
    private final CostService costService;
    private final ProjectService projectService;
    private final BudgetRateApplicationService budgetRateApplicationService;
    private final ProjectItemRepository projectItemRepository;
    private final PlanService planService;

    /**
     * 어댑터를 시트 종류별로 색인해 둡니다.
     *
     * @param sheetAdapters 등록된 어댑터 전체 (Spring이 주입)
     */
    public MigrationImportService(
            List<SheetAdapter> sheetAdapters,
            MigrationValidator validator,
            MigrationYearSnapshot yearSnapshot,
            OrgIdentityResolver orgIdentityResolver,
            MigrationIoeCatalogReader catalogReader,
            MigrationApprovalStamper approvalStamper,
            CostService costService,
            ProjectService projectService,
            BudgetRateApplicationService budgetRateApplicationService,
            ProjectItemRepository projectItemRepository,
            PlanService planService) {
        for (SheetAdapter adapter : sheetAdapters) {
            adapters.put(adapter.supports(), adapter);
        }
        this.validator = validator;
        this.yearSnapshot = yearSnapshot;
        this.orgIdentityResolver = orgIdentityResolver;
        this.catalogReader = catalogReader;
        this.approvalStamper = approvalStamper;
        this.costService = costService;
        this.projectService = projectService;
        this.budgetRateApplicationService = budgetRateApplicationService;
        this.projectItemRepository = projectItemRepository;
        this.planService = planService;
    }

    /**
     * 올린 시트를 검증해 행별 진단을 돌려줍니다. 아무것도 저장하지 않습니다.
     *
     * @param request 시트 목록
     * @return 진단 목록과 요약
     * @throws IllegalArgumentException 시트 목록이 비었거나 지원하지 않는 시트 종류가 온 경우
     */
    @Transactional(readOnly = true)
    public MigrationDto.DryRunResponse dryRun(MigrationDto.DryRunRequest request) {
        requireSupported(request.sheets());
        String bseYy = request.sheets().get(0).bseYy();
        List<MigrationDto.CellDiagnostic> diagnostics =
                validator.validate(request.sheets(), lookupIndex(), yearSnapshot.load(bseYy), Map.of());

        int totalRows = request.sheets().stream().mapToInt(s -> s.rows().size()).sum();
        int blockers = (int) diagnostics.stream().filter(d -> d.severity() == MigrationDto.Severity.BLOCKER).count();
        return new MigrationDto.DryRunResponse(
                diagnostics,
                new MigrationDto.Summary(totalRows, blockers, diagnostics.size() - blockers));
    }

    /**
     * 보정값을 반영해 원장과 결재 받이를 만들고 편성률을 적용합니다.
     *
     * <p>전 과정이 하나의 트랜잭션입니다. 검증에서 BLOCKER가 남거나 어느 단계에서든 예외가 나면 전부 롤백됩니다.
     *
     * @param request 시트 목록과 보정값
     * @param actorEno 업로드 사용자 사번
     * @return 반영 건수와 생성한 관리번호
     * @throws CustomGeneralException 검증에 BLOCKER가 남은 경우
     */
    @Transactional
    public MigrationDto.CommitResponse commit(
            MigrationDto.CommitRequest request, String actorEno) {
        requireSupported(request.sheets());
        String bseYy = request.sheets().get(0).bseYy();
        Map<String, String> overrides = foldOverrides(request.overrides());
        MigrationYearSnapshot.Data snapshot = yearSnapshot.load(bseYy);
        MigrationLookupIndex index = lookupIndex();

        // 1단계: 재검증 — BLOCKER가 남으면 아무것도 쓰지 않는다
        List<MigrationDto.CellDiagnostic> diagnostics =
                validator.validate(request.sheets(), index, snapshot, overrides);
        long blockers =
                diagnostics.stream().filter(d -> d.severity() == MigrationDto.Severity.BLOCKER).count();
        if (blockers > 0) {
            throw new CustomGeneralException(
                    "해결되지 않은 오류가 " + blockers + "건 있어 반영할 수 없습니다. 미리보기에서 보정해 주세요.");
        }

        AdapterContext ctx =
                new AdapterContext(bseYy, index, snapshot, overrides, actorEno);

        // 2단계: 이관 대상이 아닌 기존 편성행의 편성률을 유지하도록 미리 모아 둔다
        List<BudgetWorkDto.ItemRate> rateItems = new ArrayList<>();
        for (String projectNo : snapshot.allProjectNos()) {
            Integer rate = snapshot.existingRateOf("BPROJM", projectNo);
            rateItems.add(new BudgetWorkDto.ItemRate("BPROJM", projectNo, orDefault(rate), orDefault(rate)));
        }
        for (String costNo : snapshot.allCostNos()) {
            Integer rate = snapshot.existingRateOf("BCOSTM", costNo);
            rateItems.add(new BudgetWorkDto.ItemRate("BCOSTM", costNo, orDefault(rate), orDefault(rate)));
        }

        // 3단계: 어댑터 순서대로 원장 생성. 부문계획은 자본예산이 만든 품목을 교체하므로 마지막
        List<String> createdIds = new ArrayList<>();
        Map<String, String> projectNoByName = new LinkedHashMap<>(snapshot.projectNoByNormalizedName());
        Map<String, String> costNoByNaturalKey = new LinkedHashMap<>();
        List<RateIntent> rateIntents = new ArrayList<>();
        List<PlanIntent> planIntents = new ArrayList<>();
        int costCount = 0;
        int projectCount = 0;
        int itemCount = 0;

        for (SheetKind kind : List.of(SheetKind.COST, SheetKind.CAPITAL_PROJECT, SheetKind.DELEGATED_BUDGET, SheetKind.PLAN_ADJUSTMENT)) {
            for (MigrationDto.SheetPayload sheet : request.sheets()) {
                if (sheet.kind() != kind) {
                    continue;
                }
                AdapterOutput output = adapters.get(kind).adapt(sheet, ctx);
                rateIntents.addAll(output.rates());
                planIntents.addAll(output.plans());

                for (CostDto.CreateRequest cost : output.costs()) {
                    String costNo = costService.createCost(cost, true);
                    costNoByNaturalKey.put(
                            MigrationYearSnapshot.costNaturalKey(
                                    bseYy,
                                    cost.getBgUntAbusC(),
                                    cost.getIoeC(),
                                    cost.getCttOppNm(),
                                    cost.getCttNm()),
                            costNo);
                    approvalStamper.stamp(
                            "BCOSTM", costNo, 1, bseYy + "년 전산일반관리비 이관", actorEno, bseYy);
                    createdIds.add(costNo);
                    costCount++;
                }
                for (ProjectDto.CreateRequest project : output.projects()) {
                    String projectNo = projectService.createProject(project, true);
                    projectNoByName.put(
                            MigrationYearSnapshot.normalizeName(project.getAbusNm()), projectNo);
                    approvalStamper.stamp(
                            "BPROJM", projectNo, 1, bseYy + "년 정보화사업 이관", actorEno, bseYy);
                    createdIds.add(projectNo);
                    projectCount++;
                    itemCount += project.getItems() == null ? 0 : project.getItems().size();
                }
            }
        }

        // 부문계획: 대상 사업의 품목을 조정 금액으로 버전 교체
        for (PlanIntent intent : planIntents) {
            itemCount += replaceItems(intent, projectNoByName, bseYy);
        }
        String planReqDocNo = planIntents.isEmpty() ? null : createAdjustmentPlan(planIntents, projectNoByName, bseYy);

        // 5단계: 편성률 단일 적용 — 이관분 편성률로 기존 항목을 덮어쓴다
        for (RateIntent intent : rateIntents) {
            String pk =
                    "BPROJM".equals(intent.orcTb())
                            ? projectNoByName.get(intent.naturalKeyOrPk())
                            : costNoByNaturalKey.get(intent.naturalKeyOrPk());
            if (pk == null) {
                log.warn("편성률 대상 PK를 찾지 못해 건너뜁니다: {} {}", intent.orcTb(), intent.naturalKeyOrPk());
                continue;
            }
            rateItems.removeIf(
                    existing ->
                            existing.orcTb().equals(intent.orcTb())
                                    && existing.orcPkVl().equals(pk));
            rateItems.add(
                    new BudgetWorkDto.ItemRate(
                            intent.orcTb(), pk, intent.percent(), intent.percent()));
        }
        BudgetWorkDto.ApplyResponse applied =
                budgetRateApplicationService.applyItemRates(
                        new BudgetWorkDto.ItemApplyRequest(bseYy, rateItems));

        return new MigrationDto.CommitResponse(
                costCount, projectCount, itemCount, applied.totalRecords(), planReqDocNo, createdIds);
    }

    /**
     * 부문계획 조정 금액으로 대상 사업의 품목을 버전 교체합니다.
     *
     * <p>기존 활성 품목을 {@code LST_YN='N'}으로 닫고 조정 금액으로 새 품목을 만듭니다. 조정액은 비율 곱이 아니라 확정 금액이라 편성률로는 재현되지
     * 않기 때문입니다(§5.4).
     *
     * @return 새로 만든 품목 수
     */
    private int replaceItems(
            PlanIntent intent, Map<String, String> projectNoByName, String bseYy) {
        String projectNo = projectNoByName.get(intent.normalizedProjectName());
        if (projectNo == null) {
            log.warn("부문계획 조정 대상 사업을 찾지 못해 건너뜁니다: {}", intent.normalizedProjectName());
            return 0;
        }
        for (Bitemm existing :
                projectItemRepository.findByAbusMngNoAndDelYnAndLstYn(projectNo, "N", "Y")) {
            existing.delete();
        }
        ProjectDto.CreateRequest patch = new ProjectDto.CreateRequest();
        patch.setAbusMngNo(projectNo);
        patch.setBseYy(bseYy);
        patch.setItems(
                buildAdjustedItems(intent, bseYy));
        // 사업 마스터는 그대로 두고 품목만 새 버전으로 추가한다
        projectService.replaceItemsForMigration(projectNo, patch.getItems());
        return patch.getItems().size();
    }

    /** 조정 금액이 있는 항목만 품목으로 만듭니다. 비목 기본값은 자본예산 어댑터와 같습니다. */
    private List<ProjectDto.BitemmDto> buildAdjustedItems(PlanIntent intent, String bseYy) {
        List<ProjectDto.BitemmDto> items = new ArrayList<>();
        addAdjustedItem(items, intent.devAmount(), "103", "개발비", intent.paymentYm(), bseYy);
        addAdjustedItem(items, intent.hwAmount(), "101", "기계장치", intent.paymentYm(), bseYy);
        addAdjustedItem(items, intent.swAmount(), "106", "기타무형자산", intent.paymentYm(), bseYy);
        return items;
    }

    private void addAdjustedItem(
            List<ProjectDto.BitemmDto> items,
            java.math.BigDecimal amount,
            String ioeC,
            String label,
            String paymentYm,
            String bseYy) {
        if (amount == null) {
            return;
        }
        ProjectDto.BitemmDto item = new ProjectDto.BitemmDto();
        item.setIoeC(ioeC);
        item.setGclNm(label);
        item.setCurC("KRW");
        item.setAmt(amount);
        item.setBseYm(paymentYm);
        item.setXcrBseDt(bseYy + "0101");
        items.add(item);
    }

    /** 조정 계획({@code BPLANM} + {@code BPLANA})을 만듭니다. */
    private String createAdjustmentPlan(
            List<PlanIntent> intents, Map<String, String> projectNoByName, String bseYy) {
        List<String> projectNos = new ArrayList<>();
        for (PlanIntent intent : intents) {
            String projectNo = projectNoByName.get(intent.normalizedProjectName());
            if (projectNo != null) {
                projectNos.add(projectNo);
            }
        }
        return planService.createPlanForMigration(bseYy, "조정", projectNos, intents);
    }

    /** 보정값 목록을 {@code MigrationValidator.overrideKey} 키의 맵으로 접습니다. */
    private Map<String, String> foldOverrides(List<MigrationDto.CellOverride> overrides) {
        Map<String, String> out = new LinkedHashMap<>();
        for (MigrationDto.CellOverride override : overrides) {
            out.put(
                    MigrationValidator.overrideKey(
                            override.sheet(), override.excelRow(), override.column()),
                    override.value());
        }
        return out;
    }

    private MigrationLookupIndex lookupIndex() {
        return new MigrationLookupIndex(
                orgIdentityResolver.snapshot(),
                catalogReader.ioeCodeByName(),
                catalogReader.xcrByCurrency());
    }

    private void requireSupported(List<MigrationDto.SheetPayload> sheets) {
        if (sheets == null || sheets.isEmpty()) {
            throw new IllegalArgumentException("올린 시트가 없습니다.");
        }
        for (MigrationDto.SheetPayload sheet : sheets) {
            if (!adapters.containsKey(sheet.kind())) {
                throw new IllegalArgumentException("지원하지 않는 시트 종류입니다: " + sheet.kind());
            }
        }
    }

    /** 기존 편성률이 없으면 100으로 둡니다. */
    private static int orDefault(Integer rate) {
        return rate == null ? 100 : rate;
    }
}
```

- [ ] **Step 5: `ProjectService`·`PlanService`에 이관 전용 메서드를 추가한다**

`ProjectService.replaceItemsForMigration(String abusMngNo, List<ProjectDto.BitemmDto> items)`

```java
    /**
     * 이관 전용 — 사업의 품목을 새 버전으로 교체합니다.
     *
     * <p>호출자가 기존 활성 품목을 이미 논리삭제한 상태를 전제합니다. 채번(`GCL-{연도}-{4자리}`)과 환율 표준 조회, 외화 금액 재계산은
     * {@code createProject}와 같은 규칙을 따릅니다. 부문계획 조정액이 편성률로 재현되지 않아 품목 금액 자체를 바꿔야 하는 경로에만 씁니다(§5.4).
     *
     * @param abusMngNo 사업관리번호
     * @param items 새 품목 목록 (비어 있으면 아무것도 하지 않습니다)
     * @throws IllegalArgumentException 사업이 없거나 최종 버전이 아닌 경우
     */
    @Transactional
    public void replaceItemsForMigration(String abusMngNo, List<ProjectDto.BitemmDto> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        Bprojm project =
                projectRepository
                        .findByAbusMngNoAndLstYnAndDelYn(abusMngNo, "Y", "N")
                        .orElseThrow(
                                () -> new IllegalArgumentException("사업을 찾을 수 없습니다: " + abusMngNo));
        int gclSno = 0;
        for (ProjectDto.BitemmDto itemDto : items) {
            Long gclSeq = bitemmRepository.getNextSequenceValue();
            String gclMngNo =
                    String.format("GCL-%s-%04d", java.time.LocalDate.now().getYear(), gclSeq);
            itemDto.setXcr(xcrLookupService.resolveXcr(itemDto.getCurC(), LocalDate.now()));
            BigDecimal[] reconciled =
                    BudgetAmountCalculator.reconcileAmount(
                            itemDto.getFcAmt(),
                            itemDto.getAmt(),
                            itemDto.getCurC(),
                            itemDto.getXcr());
            bitemmRepository.save(
                    Bitemm.builder()
                            .gclMngNo(gclMngNo)
                            .sno(++gclSno)
                            .abusMngNo(project.getAbusMngNo())
                            .fntTbCrySno(project.getSno())
                            .ioeC(itemDto.getIoeC())
                            .gclNm(itemDto.getGclNm())
                            .qty(itemDto.getQty())
                            .curC(itemDto.getCurC())
                            .xcr(itemDto.getXcr())
                            .xcrBseDt(DateFormatUtil.toYmd8(itemDto.getXcrBseDt()))
                            .bseYm(itemDto.getBseYm())
                            .dfrCleC(CodeDefaults.orNotApplicable(itemDto.getDfrCleC()))
                            .lstYn("Y")
                            .amt(reconciled[0])
                            .fcAmt(reconciled[1])
                            .build());
        }
    }
```

`PlanService.createPlanForMigration(String bseYy, String plnTp, List<String> projectNos, List<PlanIntent> intents)` — 기존 `createPlan`의 채번·스냅샷 조립을 재사용하고 `PlanIntent.snapshotFields()`를 스냅샷 JSON에 함께 넣는다. 기존 `createPlan`이 받는 요청 DTO(`PlanDto.CreateRequest`)로 조립할 수 있으면 새 메서드 대신 그 경로를 쓰고, 스냅샷 필드를 넣을 자리가 없을 때만 새 메서드를 만든다. **먼저 `PlanService.createPlan`을 읽고 판단한다.**

```bash
cd /c/it/it_backend && sed -n '260,380p' src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationImportServiceTest' --no-daemon`
Expected: PASS (7 tests)

- [ ] **Step 7: 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 이관 오케스트레이션 서비스와 품목 버전 교체 경로 추가"
```

---

### Task 12: `MigrationController`와 OpenAPI 계약

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/controller/MigrationController.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/controller/MigrationControllerTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/MigrationOpenApiContractTest.java`

**Interfaces:**
- Produces: `POST /api/admin/migration/imports/dry-run` — 본문 `MigrationDto.DryRunRequest`, 응답 `MigrationDto.DryRunResponse`
- Produces: `POST /api/admin/migration/imports` — 본문 `MigrationDto.CommitRequest`, 응답 `MigrationDto.CommitResponse`, 201 Created

- [ ] **Step 1: 실패하는 슬라이스 테스트를 작성한다**

```java
package com.kdb.it.domain.migration.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.service.MigrationImportService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

/** 이관 API의 권한·계약을 고정합니다. */
@org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest(MigrationController.class)
class MigrationControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private MigrationImportService migrationImportService;

    @Test
    @DisplayName("관리자가 아니면 dry-run이 403이다")
    @WithMockUser(roles = "USER")
    void 비관리자는_거부된다() throws Exception {
        mockMvc.perform(
                        post("/api/admin/migration/imports/dry-run")
                                .with(org.springframework.security.test.web.servlet.request
                                        .SecurityMockMvcRequestPostProcessors.csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(dryRunRequest())))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("관리자는 dry-run 결과를 받는다")
    @WithMockUser(roles = "ADMIN")
    void 관리자는_사전검증을_수행한다() throws Exception {
        when(migrationImportService.dryRun(any()))
                .thenReturn(
                        new MigrationDto.DryRunResponse(
                                List.of(), new MigrationDto.Summary(3, 0, 1)));

        mockMvc.perform(
                        post("/api/admin/migration/imports/dry-run")
                                .with(org.springframework.security.test.web.servlet.request
                                        .SecurityMockMvcRequestPostProcessors.csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(dryRunRequest())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.summary.totalRows").value(3))
                .andExpect(jsonPath("$.summary.blockerCount").value(0));
    }

    @Test
    @DisplayName("시트가 비면 400이다")
    @WithMockUser(roles = "ADMIN")
    void 빈_시트목록은_400이다() throws Exception {
        mockMvc.perform(
                        post("/api/admin/migration/imports/dry-run")
                                .with(org.springframework.security.test.web.servlet.request
                                        .SecurityMockMvcRequestPostProcessors.csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"sheets\":[]}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("확정 반영은 201과 반영 건수를 돌려준다")
    @WithMockUser(roles = "ADMIN", username = "999999")
    void 확정반영은_201이다() throws Exception {
        when(migrationImportService.commit(any(), anyString()))
                .thenReturn(
                        new MigrationDto.CommitResponse(
                                14, 4, 9, 23, "PLN-2026-0001", List.of("COST-2026-0001")));

        mockMvc.perform(
                        post("/api/admin/migration/imports")
                                .with(org.springframework.security.test.web.servlet.request
                                        .SecurityMockMvcRequestPostProcessors.csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(commitRequest())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.costCount").value(14))
                .andExpect(jsonPath("$.planReqDocNo").value("PLN-2026-0001"));
    }

    @Test
    @DisplayName("JSON이 아닌 Content-Type은 415다")
    @WithMockUser(roles = "ADMIN")
    void 잘못된_컨텐츠타입은_415다() throws Exception {
        mockMvc.perform(
                        post("/api/admin/migration/imports")
                                .with(org.springframework.security.test.web.servlet.request
                                        .SecurityMockMvcRequestPostProcessors.csrf())
                                .contentType(MediaType.TEXT_PLAIN)
                                .content("{}"))
                .andExpect(status().isUnsupportedMediaType());
    }

    private static MigrationDto.DryRunRequest dryRunRequest() {
        return new MigrationDto.DryRunRequest(
                List.of(
                        new MigrationDto.SheetPayload(
                                com.kdb.it.domain.migration.dto.SheetKind.COST,
                                "2026",
                                List.of(
                                        new MigrationDto.NormalizedRow(
                                                2, java.util.Map.of("ioeName", "유지보수료"))))));
    }

    private static MigrationDto.CommitRequest commitRequest() {
        return new MigrationDto.CommitRequest(dryRunRequest().sheets(), List.of());
    }
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*MigrationControllerTest' --no-daemon`
Expected: 컴파일 실패 — `MigrationController` 없음

- [ ] **Step 3: 구현한다**

```java
package com.kdb.it.domain.migration.controller;

import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.service.MigrationImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 수기 엑셀 일괄 이관 API입니다. 관리자만 호출할 수 있습니다. */
@Tag(name = "데이터 이관", description = "수기 엑셀 일괄 반입")
@RestController
@RequestMapping("/api/admin/migration")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class MigrationController {

    private final MigrationImportService migrationImportService;

    /**
     * 올린 시트를 검증해 행별 진단과 해석 후보를 돌려줍니다. 아무것도 저장하지 않습니다.
     *
     * @param request 시트 목록
     * @return 진단 목록과 요약
     */
    @Operation(summary = "이관 사전검증", description = "조직·코드 해석과 중복·필수값 검증 결과를 돌려줍니다. 저장하지 않습니다.")
    @PostMapping(path = "/imports/dry-run", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<MigrationDto.DryRunResponse> dryRun(
            @Valid @RequestBody MigrationDto.DryRunRequest request) {
        return ResponseEntity.ok(migrationImportService.dryRun(request));
    }

    /**
     * 보정값을 반영해 원장과 결재 받이를 만들고 편성률을 적용합니다.
     *
     * @param request 시트 목록과 보정값
     * @param user 인증 사용자 (사번을 업로드 작성자로 씁니다)
     * @return 반영 건수와 생성한 관리번호
     */
    @Operation(summary = "이관 확정 반영", description = "단일 트랜잭션으로 원장을 만듭니다. 오류가 남아 있으면 전량 롤백됩니다.")
    @PostMapping(path = "/imports", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<MigrationDto.CommitResponse> commit(
            @Valid @RequestBody MigrationDto.CommitRequest request,
            @AuthenticationPrincipal UserDetails user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(migrationImportService.commit(request, user.getUsername()));
    }
}
```

- [ ] **Step 4: `SecurityConfig`에 경로가 관리자 전용으로 걸려 있는지 확인한다**

```bash
cd /c/it/it_backend && grep -n "admin" src/main/java/com/kdb/it/config/SecurityConfig.java
```

`/api/admin/**`가 이미 `hasRole("ADMIN")`이면 추가 설정이 필요 없다. 없으면 규칙을 추가한다. 클래스 수준 `@PreAuthorize`가 이미 있으므로 이중 방어다.

- [ ] **Step 5: OpenAPI 계약 테스트를 작성한다**

기존 `ApiResponseOpenApiContractTest`가 도메인 전반을 검사하는 방식을 그대로 따른다. 먼저 그 파일을 읽고 같은 패턴으로 `MigrationOpenApiContractTest`를 만든다.

```bash
cd /c/it/it_backend && find src/test -name "*OpenApiContractTest.java" | head -3
```

응답 DTO 4개(`DryRunResponse`·`Summary`·`CellDiagnostic`·`CommitResponse`·`Candidate`)의 모든 속성이 `requiredMode = REQUIRED`이고, null이 올 수 있는 `CellDiagnostic.column`·`CommitResponse.planReqDocNo`만 `nullable = true`인지, `CellDiagnostic.code`에 `allowableValues`가 있는지 고정한다.

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `cd it_backend && ./gradlew test --tests '*Migration*' --no-daemon`
Expected: PASS (이관 관련 전체)

- [ ] **Step 7: 커밋**

```bash
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/main/java/com/kdb/it src/test/java/com/kdb/it/domain/migration
git commit -m "feat: 이관 dry-run·확정반영 API와 OpenAPI 계약 추가"
```

---

### Task 13: Oracle 통합 테스트

목으로는 검증할 수 없는 것들을 실제 Oracle에서 확인한다 — 전량 롤백, 결재 받이가 붙은 뒤 예산 집계에 실제로 잡히는지, `applyItemRates`가 연도 전체를 재작성해도 기존 편성행이 살아남는지, 품목 버전 교체.

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/MigrationImportIt.java`
- Test: `it_backend/src/test/resources/fixtures/migration/*.json` (익명화 정규화 행 픽스처)

**Interfaces:**
- Consumes: `AbstractOracleRepositoryTest` (기존), `MigrationImportService`, 모든 리포지토리

- [ ] **Step 1: 익명화 픽스처를 만든다**

실 xlsx를 커밋하지 않는다. 대신 각 시트의 정규화 행을 JSON으로 손으로 적는다 — 실제 파일과 구조는 같고 이름·금액은 가공한다.

`src/test/resources/fixtures/migration/cost.json`

```json
[
  {
    "excelRow": 2,
    "cells": {
      "abusCode": "571", "ioeName": "유지보수료", "abusTcLabel": "계속",
      "vendorName": "테스트벤더", "requestDetail": "테스트 유지보수",
      "securityFlag": "", "terminalFlag": "", "deptName": "IT기획부",
      "teamName": "IT기획팀", "currency": "KRW", "fcAmount": "",
      "krwAmount": "15000", "remark": "테스트"
    }
  },
  {
    "excelRow": 3,
    "cells": {
      "abusCode": "571", "ioeName": "국외전산임차료", "abusTcLabel": "계속",
      "vendorName": "Test Vendor Ltd", "requestDetail": "테스트 해외 임차",
      "securityFlag": "", "terminalFlag": "", "deptName": "IT기획부",
      "teamName": "IT인프라팀", "currency": "GBP", "fcAmount": "1000",
      "krwAmount": "1924", "remark": ""
    }
  }
]
```

`capital.json`·`delegated.json`·`plan.json`도 같은 형태로 만든다. 부서·담당자 이름은 로컬 DB `TPRMPP_CORGNI`·`TPRMPP_CUSERI`에 실제로 있는 값을 골라야 해석이 통과한다. 먼저 조회한다.

```bash
cd /c/it && { printf '%s\n' "$DB_PASSWORD"; printf "%s\n" "SELECT PRLM_OGZ_C_CONE, BBR_NM FROM ITPOWN.TPRMPP_CORGNI WHERE DEL_YN='N' AND ROWNUM<=20;" "SELECT ENO, USR_NM, PT_C_NM, BBR_C FROM ITPOWN.TPRMPP_CUSERI WHERE DEL_YN='N' AND ROWNUM<=10;" "EXIT"; } | NLS_LANG=KOREAN_KOREA.AL32UTF8 sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

- [ ] **Step 2: 통합 테스트를 작성한다**

```java
package com.kdb.it.domain.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kdb.it.domain.budget.cost.repository.CostRepository;
import com.kdb.it.domain.budget.project.repository.ProjectItemRepository;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.budget.work.repository.BbugtmRepository;
import com.kdb.it.domain.migration.dto.MigrationDto;
import com.kdb.it.domain.migration.dto.SheetKind;
import com.kdb.it.domain.migration.service.MigrationImportService;
import com.kdb.it.support.AbstractOracleRepositoryTest;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;

/** 실제 Oracle에서 이관 반영의 원자성과 집계 반영을 확인합니다. */
@Tag("it")
class MigrationImportIt extends AbstractOracleRepositoryTest {

    private static final String BSE_YY = "2999"; // 실 데이터와 섞이지 않는 테스트 연도

    @Autowired private MigrationImportService service;
    @Autowired private CostRepository costRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ProjectItemRepository projectItemRepository;
    @Autowired private BbugtmRepository bbugtmRepository;
    @Autowired private ObjectMapper objectMapper;

    @Test
    @DisplayName("전산업무비 픽스처를 반영하면 BCOSTM과 결재완료 받이가 함께 생긴다")
    void 전산업무비를_반영하면_결재받이가_함께_생긴다() {
        MigrationDto.CommitResponse response =
                service.commit(
                        new MigrationDto.CommitRequest(List.of(sheet(SheetKind.COST, "cost.json")), List.of()),
                        actorEno());

        assertThat(response.costCount()).isEqualTo(2);
        assertThat(costRepository.findByBseYyAndLstYnAndDelYn(BSE_YY, "Y", "N")).hasSize(2);
        // 결재완료 받이가 붙어야 예산 집계에 잡힌다 (§3.6)
        assertThat(bbugtmRepository.findByBseYyAndFntTbNmAndDelYn(BSE_YY, "BCOSTM", "N"))
                .isNotEmpty();
    }

    @Test
    @DisplayName("외화 행 금액은 서버가 FC_AMT × Ccodem 환율로 재계산해 저장한다")
    void 외화행은_서버가_재계산한다() {
        service.commit(
                new MigrationDto.CommitRequest(List.of(sheet(SheetKind.COST, "cost.json")), List.of()),
                actorEno());

        assertThat(costRepository.findByBseYyAndLstYnAndDelYn(BSE_YY, "Y", "N"))
                .filteredOn(c -> "GBP".equals(c.getCurC()))
                .singleElement()
                .satisfies(
                        c -> {
                            // 픽스처 외화 1,000 GBP × 시드 환율 1,924 = 1,924,000원
                            assertThat(c.getCostTotXpAmt())
                                    .isEqualByComparingTo(new BigDecimal("1924000"));
                            assertThat(c.getFcAmt()).isEqualByComparingTo(new BigDecimal("1000"));
                        });
    }

    @Test
    @DisplayName("BLOCKER가 남은 요청은 아무 행도 남기지 않고 실패한다")
    void 블로커가_있으면_전량_롤백된다() {
        MigrationDto.SheetPayload broken =
                new MigrationDto.SheetPayload(
                        SheetKind.COST,
                        BSE_YY,
                        List.of(
                                new MigrationDto.NormalizedRow(
                                        2,
                                        java.util.Map.of(
                                                "deptName", "존재하지않는부서",
                                                "requestDetail", "테스트",
                                                "ioeName", "유지보수료",
                                                "currency", "KRW",
                                                "krwAmount", "1000"))));

        assertThatThrownBy(
                        () ->
                                service.commit(
                                        new MigrationDto.CommitRequest(List.of(broken), List.of()),
                                        actorEno()))
                .hasMessageContaining("반영할 수 없습니다");

        assertThat(costRepository.findByBseYyAndLstYnAndDelYn(BSE_YY, "Y", "N")).isEmpty();
    }

    @Test
    @DisplayName("자본예산과 부문계획을 함께 반영하면 품목이 조정 금액으로 교체된다")
    void 부문계획_조정이_품목을_교체한다() {
        service.commit(
                new MigrationDto.CommitRequest(
                        List.of(
                                sheet(SheetKind.CAPITAL_PROJECT, "capital.json"),
                                sheet(SheetKind.PLAN_ADJUSTMENT, "plan.json")),
                        List.of()),
                actorEno());

        String projectNo =
                projectRepository.findByBseYyAndLstYnAndDelYn(BSE_YY, "Y", "N").get(0).getAbusMngNo();

        // 활성 품목은 조정 금액만 남고 편성요청 원값은 LST_YN='N'으로 보존된다 (§5.4)
        assertThat(projectItemRepository.findByAbusMngNoAndDelYnAndLstYn(projectNo, "N", "Y"))
                .isNotEmpty();
        assertThat(projectItemRepository.findByAbusMngNoAndDelYn(projectNo, "Y"))
                .as("편성요청 시점 품목이 논리삭제로 보존된다")
                .isNotEmpty();
    }

    @Test
    @DisplayName("같은 파일을 다시 반영하면 중복으로 거부한다")
    void 재업로드는_중복으로_거부된다() {
        MigrationDto.CommitRequest request =
                new MigrationDto.CommitRequest(List.of(sheet(SheetKind.COST, "cost.json")), List.of());
        service.commit(request, actorEno());

        assertThatThrownBy(() -> service.commit(request, actorEno()))
                .hasMessageContaining("반영할 수 없습니다");
    }

    @Test
    @DisplayName("이관 대상이 아닌 기존 연도 편성행은 편성률이 유지된다")
    void 기존_편성행의_편성률이_유지된다() {
        // 1차 반영으로 편성행을 만들고
        service.commit(
                new MigrationDto.CommitRequest(List.of(sheet(SheetKind.COST, "cost.json")), List.of()),
                actorEno());
        int before = bbugtmRepository.findByBseYyAndDelYn(BSE_YY, "N").size();

        // 다른 시트를 추가 반영해도 앞서 만든 편성행이 사라지지 않는다 (§3.5)
        service.commit(
                new MigrationDto.CommitRequest(
                        List.of(sheet(SheetKind.CAPITAL_PROJECT, "capital.json")), List.of()),
                actorEno());

        assertThat(bbugtmRepository.findByBseYyAndDelYn(BSE_YY, "N")).hasSizeGreaterThanOrEqualTo(before);
    }

    /** 픽스처 JSON을 읽어 시트 페이로드로 만듭니다. 예산연도는 테스트 연도로 바꿔 실 데이터와 섞이지 않게 합니다. */
    private MigrationDto.SheetPayload sheet(SheetKind kind, String fixture) {
        try {
            List<MigrationDto.NormalizedRow> rows =
                    objectMapper.readValue(
                            new ClassPathResource("fixtures/migration/" + fixture).getInputStream(),
                            new TypeReference<List<MigrationDto.NormalizedRow>>() {});
            return new MigrationDto.SheetPayload(kind, BSE_YY, rows);
        } catch (java.io.IOException e) {
            throw new IllegalStateException("픽스처를 읽지 못했습니다: " + fixture, e);
        }
    }

    /** 로컬 DB에 실제로 있는 사번을 씁니다. 없는 사번이면 조직 스냅샷 해석이 비어 버립니다. */
    private String actorEno() {
        return "999999";
    }
}
```

- [ ] **Step 3: 테스트 연도 환율 시드를 보강한다**

`BSE_YY = "2999"`를 쓰지만 `XcrLookupService`는 **오늘 날짜**로 환율을 조회하므로 Task 1의 2026년 유효기간 시드가 그대로 쓰인다. 오늘이 2026년 밖이면 통합 테스트가 실패한다. 이를 막기 위해 Task 1 시드의 `END_DT`를 `99991231`로 바꾼다.

```sql
-- V20260811_003__ExtendBudgetXcrValidity.sql
-- 예산환율 유효기간을 열어 둔다. XcrLookupService가 조회 기준일로 오늘을 쓰므로
-- 연도 경계를 넘기면 이관·통합테스트가 IllegalStateException으로 실패한다.
UPDATE ITPOWN.TPRMPP_CCODEM
   SET END_DT = '99991231', LST_CHG_USID = 'SYSTEM', LST_CHG_DTM = SYSTIMESTAMP
 WHERE CO_C_ID_NM = 'CUR_C' AND CO_C_INTN_NM = 'XCR';
```

> Task 1의 스크립트는 이미 적용됐을 수 있어 수정하지 않고 새 버전으로 추가한다(Flyway 체크섬).

- [ ] **Step 4: 통합 테스트를 돌린다**

Run: `cd it_backend && ./gradlew integrationTest --tests '*MigrationImportIt*' --no-daemon`
Expected: PASS (6 tests). 실패하면 픽스처의 부서·담당자 이름이 로컬 DB에 실제로 있는지 먼저 확인한다.

- [ ] **Step 5: 테스트 데이터를 정리한다**

`BSE_YY='2999'` 행이 남으면 다음 실행이 중복으로 거부된다. `@AfterEach`에서 정리한다.

```java
    @org.junit.jupiter.api.AfterEach
    void 테스트연도_데이터를_정리한다() {
        // 물리 삭제는 테스트 연도 한정. 운영 코드에서는 논리삭제만 쓴다
        entityManager
                .createNativeQuery("DELETE FROM ITPOWN.TPRMPP_BBUGTM WHERE BSE_YY = :yy")
                .setParameter("yy", BSE_YY)
                .executeUpdate();
        entityManager
                .createNativeQuery(
                        "DELETE FROM ITPOWN.TPRMPP_BITEMM WHERE ABUS_MNG_NO IN"
                                + " (SELECT ABUS_MNG_NO FROM ITPOWN.TPRMPP_BPROJM WHERE BSE_YY = :yy)")
                .setParameter("yy", BSE_YY)
                .executeUpdate();
        entityManager
                .createNativeQuery("DELETE FROM ITPOWN.TPRMPP_BPROJM WHERE BSE_YY = :yy")
                .setParameter("yy", BSE_YY)
                .executeUpdate();
        entityManager
                .createNativeQuery("DELETE FROM ITPOWN.TPRMPP_BCOSTM WHERE BSE_YY = :yy")
                .setParameter("yy", BSE_YY)
                .executeUpdate();
        entityManager.flush();
    }
```

`AbstractOracleRepositoryTest`가 `entityManager`를 노출하는지 확인하고, 없으면 `@Autowired EntityManager`를 선언한다. `CAPPLM`·`CAPPLA`는 연도 컬럼이 없으므로 `APF_DCM_NO LIKE 'APF-2999-%'`로 지운다.

- [ ] **Step 6: 커밋**

```bash
cd /c/it/it_database && git add migrations/V20260811_003__ExtendBudgetXcrValidity.sql && git commit -m "fix: 예산환율 유효기간을 열어 연도 경계에서 조회 실패를 막음"
cd /c/it/it_backend && ./gradlew spotlessApply --no-daemon
git add src/test
git commit -m "test: 이관 반영의 원자성·집계 반영 Oracle 통합 테스트 추가"
```

---

## Phase E — 프론트엔드

### Task 14: 정규 컬럼 계약과 exceljs 파서

엑셀 헤더는 파일마다 다르다(병합 2행 헤더, 줄바꿈, 공백). 파서가 헤더를 정규 컬럼 id로 접고, 위임예산은 부점명을 forward-fill한다.

**Files:**
- Create: `it_frontend/app/composables/migration/columns.ts`
- Create: `it_frontend/app/composables/migration/useMigrationParser.ts`
- Test: `it_frontend/tests/unit/composables/migration/useMigrationParser.test.ts`

**Interfaces:**
- Produces: `SHEET_COLUMNS: Record<SheetKind, string[]>` — 백엔드 `MigrationColumns`와 동일 리터럴
- Produces: `type SheetKind = 'COST' | 'CAPITAL_PROJECT' | 'DELEGATED_BUDGET' | 'PLAN_ADJUSTMENT'`
- Produces: `HEADER_PATTERNS: Record<SheetKind, Record<string, RegExp>>` — 컬럼 id → 헤더 매칭 정규식
- Produces: `detectSheetKind(sheetName: string): SheetKind | null`
- Produces: `useMigrationParser().parseFile(file: File): Promise<ParsedSheet[]>`
- Produces: `interface ParsedSheet { kind: SheetKind; sheetName: string; rows: NormalizedRow[] }`
- Produces: `interface NormalizedRow { excelRow: number; cells: Record<string, string> }`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`it_frontend/tests/unit/composables/migration/useMigrationParser.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { useMigrationParser } from '~/composables/migration/useMigrationParser';
import { SHEET_COLUMNS, detectSheetKind } from '~/composables/migration/columns';

/** 시트명으로 종류를 판별하고 헤더를 정규 컬럼 id로 접는 규칙을 고정합니다. */
describe('useMigrationParser', () => {
    describe('detectSheetKind', () => {
        it('실제 시트명 4개를 각 종류로 판별한다', () => {
            expect(detectSheetKind('전체취합(국내외)')).toBe('COST');
            expect(detectSheetKind('1-1. 26년정보화사업(전산예산반영)')).toBe('CAPITAL_PROJECT');
            expect(detectSheetKind('2. 위임예산(경상)')).toBe('DELEGATED_BUDGET');
            expect(detectSheetKind('26년정보화사업(자본예산)')).toBe('PLAN_ADJUSTMENT');
        });

        it('참조표와 숨김 레거시 시트는 판별하지 않는다', () => {
            expect(detectSheetKind('(환율 기준)')).toBeNull();
            expect(detectSheetKind('조정구분')).toBeNull();
            expect(detectSheetKind('국내')).toBeNull();
            expect(detectSheetKind('국외')).toBeNull();
        });

        it('연도가 바뀐 시트명도 판별한다', () => {
            expect(detectSheetKind('1-1. 27년정보화사업(전산예산반영)')).toBe('CAPITAL_PROJECT');
            expect(detectSheetKind('27년정보화사업(자본예산)')).toBe('PLAN_ADJUSTMENT');
        });
    });

    describe('parseFile', () => {
        it('일반관리비 시트의 1행 헤더를 정규 컬럼 id로 접는다', async () => {
            const file = await buildWorkbook('전체취합(국내외)', [
                [
                    '사업코드', '세   목', '세목코드', '구분', '계약업체명', '요구내역', '보안',
                    '금융정보단말기', '요구부서', '팀', '25년 통화', '25년 요구액',
                    '25년 요구액(원화)', '26년 통화', '26년 요구액', '26년 요구액(원화)',
                    '증감액', '증감률', '비고',
                ],
                [
                    '571', '유지보수료', '240-0200', '계속', '커브', '올인원워크스페이스', '', '',
                    'IT기획부', 'IT기획팀', 'KRW', 15401, 15401, 'KRW', 15401, 15401, 0, 0,
                    '전년도 동일수준',
                ],
            ]);

            const [sheet] = await useMigrationParser().parseFile(file);

            expect(sheet.kind).toBe('COST');
            expect(sheet.rows).toHaveLength(1);
            expect(sheet.rows[0]).toEqual({
                excelRow: 2,
                cells: expect.objectContaining({
                    abusCode: '571',
                    ioeName: '유지보수료',
                    abusTcLabel: '계속',
                    vendorName: '커브',
                    requestDetail: '올인원워크스페이스',
                    deptName: 'IT기획부',
                    teamName: 'IT기획팀',
                    currency: 'KRW',
                    krwAmount: '15401',
                    remark: '전년도 동일수준',
                }),
            });
        });

        it('26년 통화·요구액을 25년 열과 혼동하지 않는다', async () => {
            const file = await buildWorkbook('전체취합(국내외)', [
                [
                    '사업코드', '세   목', '세목코드', '구분', '계약업체명', '요구내역', '보안',
                    '금융정보단말기', '요구부서', '팀', '25년 통화', '25년 요구액',
                    '25년 요구액(원화)', '26년 통화', '26년 요구액', '26년 요구액(원화)',
                    '증감액', '증감률', '비고',
                ],
                [
                    '571', '국외전산임차료', '237-9100', '계속', 'hansen', 'Teams', '', '',
                    'PF2실', '', 'GBP', 2014, 3630, 'GBP', 2890, 5560.36, 1930, 0.53, '런던',
                ],
            ]);

            const [sheet] = await useMigrationParser().parseFile(file);

            expect(sheet.rows[0].cells.fcAmount).toBe('2890');
            expect(sheet.rows[0].cells.krwAmount).toBe('5560.36');
        });

        it('부문계획의 2행 병합 헤더를 결합해 읽는다', async () => {
            const file = await buildWorkbook('26년정보화사업(자본예산)', [
                ['구분', '', '사 업 명', '주관부문', '주관부서', '', '', '', "'26년 6월 조정 기준"],
                ['', '유형', '', '', '', '담당팀', '담당자', '담당팀장', '예산 변경'],
                ['1', '법률/규제대응', '웹한글 기안기 도입', '기획관리부문', '종합기획부',
                 '조직평가팀', '김성원 과장', '김도준 팀장', '감액'],
            ]);

            const [sheet] = await useMigrationParser().parseFile(file);

            expect(sheet.kind).toBe('PLAN_ADJUSTMENT');
            expect(sheet.rows).toHaveLength(1);
            expect(sheet.rows[0].excelRow).toBe(3);
            expect(sheet.rows[0].cells).toMatchObject({
                projectName: '웹한글 기안기 도입',
                projectType: '법률/규제대응',
                headquarters: '기획관리부문',
                deptName: '종합기획부',
                teamName: '조직평가팀',
                managerName: '김성원 과장',
                teamLeaderName: '김도준 팀장',
                budgetChangeLabel: '감액',
            });
        });

        it('위임예산의 빈 부점명을 직전 행 값으로 채운다', async () => {
            const file = await buildWorkbook('2. 위임예산(경상)', [
                ['부점명', '내용', '통화', '수량', '단가', '기계장치 총금액(HW)', '합계(원화환산)',
                 '수량', '단가', '기타무형자산 총금액(SW)', '합계(원화환산)'],
                ['런던', '데스크탑(고사양)', 'GBP', 12, 1945.57, 23346.84, 44919320.16, '', '', 0, 0],
                ['', '데스크탑(일반사양)', 'GBP', 82, 836.21, 68569.22, 131927179.28, '', '', 0, 0],
                ['런던 PF', '내부망 PC', 'GBP', 2, 671, 1610.4, 3098409.6, '', '', 0, 0],
            ]);

            const [sheet] = await useMigrationParser().parseFile(file);

            expect(sheet.rows.map((r) => r.cells.branchName)).toEqual(['런던', '런던', '런던 PF']);
        });

        it('전 컬럼 키를 빈 문자열로라도 채워 보낸다', async () => {
            const file = await buildWorkbook('전체취합(국내외)', [
                ['사업코드', '세   목', '요구내역'],
                ['571', '유지보수료', '테스트'],
            ]);

            const [sheet] = await useMigrationParser().parseFile(file);

            expect(Object.keys(sheet.rows[0].cells).sort()).toEqual([...SHEET_COLUMNS.COST].sort());
        });

        it('내용이 전부 빈 행은 건너뛴다', async () => {
            const file = await buildWorkbook('전체취합(국내외)', [
                ['사업코드', '세   목', '요구내역'],
                ['571', '유지보수료', '테스트'],
                ['', '', ''],
                [null, null, null],
            ]);

            const [sheet] = await useMigrationParser().parseFile(file);

            expect(sheet.rows).toHaveLength(1);
        });

        it('판별되지 않는 시트만 있는 파일은 빈 배열을 돌려준다', async () => {
            const file = await buildWorkbook('(환율 기준)', [
                ['통화코드', '예산환율'],
                ['GBP', 1924],
            ]);

            await expect(useMigrationParser().parseFile(file)).resolves.toEqual([]);
        });

        it('숫자 셀을 문자열로 바꾸되 지수 표기를 만들지 않는다', async () => {
            const file = await buildWorkbook('전체취합(국내외)', [
                ['사업코드', '세   목', '요구내역', '26년 요구액(원화)'],
                ['571', '유지보수료', '테스트', 131927179.28],
            ]);

            const [sheet] = await useMigrationParser().parseFile(file);

            expect(sheet.rows[0].cells.krwAmount).toBe('131927179.28');
        });
    });
});

/** 메모리에서 xlsx를 만들어 File로 넘깁니다. 실 업무 데이터를 테스트에 쓰지 않기 위한 장치입니다. */
async function buildWorkbook(sheetName: string, rows: unknown[][]): Promise<File> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);
    rows.forEach((row) => ws.addRow(row));
    const buffer = await wb.xlsx.writeBuffer();
    return new File([buffer], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
}
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_frontend && npx vitest run tests/unit/composables/migration/useMigrationParser.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: `columns.ts`를 작성한다**

```ts
/**
 * ============================================================================
 * [migration/columns.ts] 수기 엑셀 이관 정규 컬럼 계약
 * ============================================================================
 * 백엔드 `MigrationColumns.java`와 **동일한 리터럴**을 갖습니다. 한쪽만 바꾸면 dry-run이
 * 조용히 빈 셀을 읽으므로 컬럼을 추가·삭제할 때 두 파일과 양쪽 테스트를 함께 갱신합니다.
 *
 * 엑셀 헤더 문자열은 파일마다 공백·줄바꿈·병합이 달라 전송 계약에 쓰지 않습니다.
 * 파서가 HEADER_PATTERNS로 헤더를 컬럼 id에 매칭해 정규화합니다.
 * ============================================================================
 */

/** 이관 대상 시트 종류. 백엔드 `SheetKind` enum과 값이 같습니다. */
export type SheetKind = 'COST' | 'CAPITAL_PROJECT' | 'DELEGATED_BUDGET' | 'PLAN_ADJUSTMENT';

/** 시트별 정규 컬럼 id (엑셀 열 순서). */
export const SHEET_COLUMNS: Record<SheetKind, readonly string[]> = {
    COST: [
        'abusCode', 'ioeName', 'abusTcLabel', 'vendorName', 'requestDetail',
        'securityFlag', 'terminalFlag', 'deptName', 'teamName', 'currency',
        'fcAmount', 'krwAmount', 'remark',
    ],
    CAPITAL_PROJECT: [
        'projectName', 'projectType', 'progressLabel', 'projectOutline',
        'headquarters', 'deptName', 'teamName', 'managerName', 'teamLeaderName',
        'itTeamName', 'feasibility', 'startYm', 'endYm',
        'devAmount', 'hwAmount', 'swAmount', 'adjustRate', 'delegationLabel',
    ],
    DELEGATED_BUDGET: [
        'branchName', 'itemName', 'currency', 'hwQty', 'hwFcAmount',
        'hwKrwAmount', 'swQty', 'swFcAmount', 'swKrwAmount',
    ],
    PLAN_ADJUSTMENT: [
        'projectName', 'projectType', 'headquarters', 'deptName', 'teamName',
        'managerName', 'teamLeaderName', 'budgetChangeLabel', 'startYm', 'endYm',
        'devAmount', 'hwAmount', 'swAmount', 'generalAmount', 'totalAmount',
        'spentBefore', 'spent26', 'planned26', 'paymentSchedule', 'plannedAfter27',
        'progressLabel', 'remark',
    ],
} as const;

/** 사용자에게 보여줄 컬럼 라벨. 미리보기 표 헤더에 씁니다. */
export const COLUMN_LABELS: Record<string, string> = {
    abusCode: '사업코드', ioeName: '세목', abusTcLabel: '구분', vendorName: '계약업체명',
    requestDetail: '요구내역', securityFlag: '보안', terminalFlag: '금융정보단말기',
    deptName: '요구부서', teamName: '팀', currency: '통화', fcAmount: '요구액',
    krwAmount: '요구액(원화)', remark: '비고',
    projectName: '사업명', projectType: '유형', progressLabel: '진행상황',
    projectOutline: '사업개요', headquarters: '주관부문', managerName: '담당자',
    teamLeaderName: '담당팀장', itTeamName: '담당IT팀', feasibility: '추진가능성',
    startYm: '시작', endYm: '종료', devAmount: '개발비', hwAmount: '기계장치',
    swAmount: '기타무형자산', adjustRate: '조정비율', delegationLabel: '전결권',
    branchName: '부점명', itemName: '내용', hwQty: 'HW 수량', hwFcAmount: 'HW 외화',
    hwKrwAmount: 'HW 원화', swQty: 'SW 수량', swFcAmount: 'SW 외화', swKrwAmount: 'SW 원화',
    budgetChangeLabel: '예산 변경', generalAmount: '일반관리비', totalAmount: '총 사업금액',
    spentBefore: '25년 이전', spent26: '26년 집행완료', planned26: '26년 집행예정',
    paymentSchedule: '예상지급일정', plannedAfter27: '27년 이후',
    devAmountIoeC: '개발비 비목', hwAmountIoeC: '기계장치 비목', swAmountIoeC: '기타무형 비목',
};

/**
 * 컬럼 id → 헤더 매칭 정규식.
 *
 * 25년/26년 열이 나란히 있는 일반관리비 시트에서 연도를 구분해야 하므로 `26년`을 명시합니다.
 * 연도가 바뀌어도 동작하도록 두 자리 연도는 `\d{2}`로 받고, 25년 열은 매칭하지 않도록
 * `요구액`만으로는 잡지 않습니다 — 대신 파서가 같은 패턴에 매칭된 열 중 **가장 오른쪽**을
 * 채택합니다(편성 문서는 항상 전년도 → 당해연도 순서로 배열됩니다).
 */
export const HEADER_PATTERNS: Record<SheetKind, Record<string, RegExp>> = {
    COST: {
        abusCode: /^사업코드$/,
        ioeName: /^세\s*목$/,
        abusTcLabel: /^구분$/,
        vendorName: /^계약업체명$/,
        requestDetail: /^요구내역$/,
        securityFlag: /^보안$/,
        terminalFlag: /금융정보단말기/,
        deptName: /^요구부서$/,
        teamName: /^팀$/,
        currency: /^\d{2}년\s*통화$/,
        fcAmount: /^\d{2}년\s*요구액$/,
        krwAmount: /^\d{2}년\s*요구액\(원화\)$/,
        remark: /^비고/,
    },
    CAPITAL_PROJECT: {
        projectName: /^사\s*업\s*명$/,
        projectType: /^유형$/,
        progressLabel: /^진행상황$/,
        projectOutline: /^사\s*업\s*개\s*요$/,
        headquarters: /^주관부문$/,
        deptName: /^주관부서$/,
        teamName: /^담당팀$/,
        managerName: /^담당자$/,
        teamLeaderName: /^담당팀장$/,
        itTeamName: /^담당IT팀$/,
        feasibility: /^추진가능성$/,
        startYm: /^시작$/,
        endYm: /^종료$/,
        devAmount: /^편성요청\s*개발비$/,
        hwAmount: /^편성요청\s*기계장치$/,
        swAmount: /^편성요청\s*기타무형$/,
        adjustRate: /^조정비율$/,
        delegationLabel: /^전결권$/,
    },
    DELEGATED_BUDGET: {
        branchName: /^부점명$/,
        itemName: /^내용$/,
        currency: /^통화$/,
        hwQty: /^수량$/,
        hwFcAmount: /기계장치\s*총금액/,
        hwKrwAmount: /^합계\(원화환산\)$/,
        swQty: /^수량$/,
        swFcAmount: /기타무형자산\s*총금액/,
        swKrwAmount: /^합계\(원화환산\)$/,
    },
    PLAN_ADJUSTMENT: {
        projectName: /^사\s*업\s*명$/,
        projectType: /^유형$/,
        headquarters: /^주관부문$/,
        deptName: /^주관부서$/,
        teamName: /^담당팀$/,
        managerName: /^담당자$/,
        teamLeaderName: /^담당팀장$/,
        budgetChangeLabel: /^예산\s*변경$/,
        startYm: /^시작$/,
        endYm: /^종료$/,
        devAmount: /^개발비$/,
        hwAmount: /^기계장치$/,
        swAmount: /^기타무형자산$/,
        generalAmount: /^일반관리비$/,
        totalAmount: /^총\s*사업금액$/,
        spentBefore: /^'?\d{2}년\s*이전$/,
        spent26: /^'?\d{2}년$/,
        planned26: /^'?\d{2}년$/,
        paymentSchedule: /예상지급일정/,
        plannedAfter27: /^'?\d{2}년\s*이후$/,
        progressLabel: /^사업\s*진행$/,
        remark: /^비고$/,
    },
};

/** 시트명 판별 규칙. 참조표와 숨김 레거시 시트는 어디에도 걸리지 않습니다. */
const SHEET_NAME_PATTERNS: ReadonlyArray<[SheetKind, RegExp]> = [
    ['COST', /^전체취합/],
    ['CAPITAL_PROJECT', /^\d+-\d+\..*정보화사업.*전산예산반영/],
    ['DELEGATED_BUDGET', /위임예산/],
    ['PLAN_ADJUSTMENT', /^\d{2}년정보화사업\(자본예산\)$/],
];

/**
 * 시트명으로 이관 대상 종류를 판별합니다.
 *
 * @param sheetName 엑셀 시트명
 * @returns 대상이면 시트 종류, 아니면 null (참조표·레거시 시트)
 */
export function detectSheetKind(sheetName: string): SheetKind | null {
    const name = sheetName.trim();
    for (const [kind, pattern] of SHEET_NAME_PATTERNS) {
        if (pattern.test(name)) return kind;
    }
    return null;
}
```

- [ ] **Step 4: `useMigrationParser.ts`를 작성한다**

```ts
/**
 * ============================================================================
 * [migration/useMigrationParser.ts] 수기 엑셀 파싱·정규화
 * ============================================================================
 * exceljs로 파일을 읽어 대상 시트만 골라 정규 컬럼 id로 접습니다. 서버는 이 결과를
 * 신뢰하지 않고 다시 검증하므로(§4.1) 파서는 형식 정규화만 책임집니다.
 * ============================================================================
 */
import type { CellValue, Row, Worksheet } from 'exceljs';
import {
    HEADER_PATTERNS,
    SHEET_COLUMNS,
    detectSheetKind,
    type SheetKind,
} from '~/composables/migration/columns';

/** 정규화된 엑셀 한 행. 백엔드 `MigrationDto.NormalizedRow`와 형태가 같습니다. */
export interface NormalizedRow {
    /** 엑셀 사용자 관점 행 번호 (1-based) */
    excelRow: number;
    /** 정규 컬럼 id → 셀 문자열. 빈 셀도 빈 문자열로 채웁니다 */
    cells: Record<string, string>;
}

/** 파싱한 시트 하나. */
export interface ParsedSheet {
    kind: SheetKind;
    sheetName: string;
    rows: NormalizedRow[];
}

/** 헤더로 쓸 수 있는 최대 행 수. 부문계획이 2행 병합 헤더를 쓰므로 2까지 봅니다. */
const MAX_HEADER_ROWS = 2;

/** 부점명 forward-fill 대상 컬럼 (시트별). */
const FORWARD_FILL: Partial<Record<SheetKind, string[]>> = {
    DELEGATED_BUDGET: ['branchName'],
};

/**
 * 엑셀 파싱·정규화 composable.
 *
 * @returns parseFile — 파일을 읽어 대상 시트만 정규화해 돌려준다
 */
export function useMigrationParser() {
    /**
     * xlsx 파일을 읽어 이관 대상 시트를 정규화합니다.
     *
     * @param file 사용자가 선택한 xlsx 파일
     * @returns 대상 시트 목록. 대상이 없으면 빈 배열
     * @throws Error 파일을 xlsx로 읽지 못한 경우 (호출자가 사용자에게 안내)
     */
    async function parseFile(file: File): Promise<ParsedSheet[]> {
        const { default: ExcelJS } = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());

        const parsed: ParsedSheet[] = [];
        workbook.eachSheet((worksheet) => {
            const kind = detectSheetKind(worksheet.name);
            if (!kind) return;
            parsed.push({
                kind,
                sheetName: worksheet.name,
                rows: normalizeSheet(worksheet, kind),
            });
        });
        return parsed;
    }

    return { parseFile };
}

/** 헤더를 찾아 컬럼 위치를 정하고 데이터 행을 정규화합니다. */
function normalizeSheet(worksheet: Worksheet, kind: SheetKind): NormalizedRow[] {
    const { columnIndex, firstDataRow } = mapHeader(worksheet, kind);
    const rows: NormalizedRow[] = [];
    const lastValue: Record<string, string> = {};

    worksheet.eachRow({ includeEmpty: false }, (row: Row, rowNumber: number) => {
        if (rowNumber < firstDataRow) return;

        const cells: Record<string, string> = {};
        for (const column of SHEET_COLUMNS[kind]) {
            const index = columnIndex[column];
            cells[column] = index ? cellText(row.getCell(index).value) : '';
        }

        // 전부 빈 행은 서식만 남은 잔재이므로 버린다
        if (Object.values(cells).every((v) => v === '')) return;

        for (const column of FORWARD_FILL[kind] ?? []) {
            if (cells[column]) {
                lastValue[column] = cells[column];
            } else if (lastValue[column]) {
                cells[column] = lastValue[column];
            }
        }
        rows.push({ excelRow: rowNumber, cells });
    });
    return rows;
}

/**
 * 헤더 행을 찾아 컬럼 id → 열 번호 맵을 만듭니다.
 *
 * 부문계획처럼 헤더가 2행에 걸쳐 병합된 시트가 있어 1~2행을 함께 봅니다. 같은 패턴에 여러 열이
 * 걸리면 **가장 오른쪽**을 채택합니다 — 편성 문서는 전년도 열을 먼저, 당해연도 열을 뒤에 두므로
 * 오른쪽이 당해연도입니다. 단 위임예산의 `수량`·`합계(원화환산)`는 HW·SW가 좌우로 짝을 이루므로
 * 예외 처리합니다.
 */
function mapHeader(
    worksheet: Worksheet,
    kind: SheetKind,
): { columnIndex: Record<string, number>; firstDataRow: number } {
    const patterns = HEADER_PATTERNS[kind];
    const columnIndex: Record<string, number> = {};
    let headerRows = 1;

    for (let rowNumber = 1; rowNumber <= MAX_HEADER_ROWS; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        let matchedInThisRow = false;
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const text = cellText(cell.value);
            if (!text) return;
            for (const [column, pattern] of Object.entries(patterns)) {
                if (!pattern.test(text)) continue;
                matchedInThisRow = true;
                // 오른쪽 열 우선. 이미 더 오른쪽 열이 잡혔으면 유지한다
                if (!columnIndex[column] || colNumber > columnIndex[column]) {
                    columnIndex[column] = colNumber;
                }
            }
        });
        if (matchedInThisRow) headerRows = rowNumber;
    }

    if (kind === 'DELEGATED_BUDGET') {
        assignPairedColumns(worksheet, headerRows, columnIndex);
    }
    return { columnIndex, firstDataRow: headerRows + 1 };
}

/**
 * 위임예산의 HW·SW 짝 컬럼을 좌우 순서로 배정합니다.
 *
 * `수량`과 `합계(원화환산)`가 각각 두 번 나오는데 앞쪽이 HW, 뒤쪽이 SW입니다. 오른쪽 우선 규칙을
 * 그대로 적용하면 HW 컬럼이 SW 열을 가리키게 되므로 여기서 다시 배정합니다.
 */
function assignPairedColumns(
    worksheet: Worksheet,
    headerRow: number,
    columnIndex: Record<string, number>,
): void {
    const qtyColumns: number[] = [];
    const totalColumns: number[] = [];
    worksheet.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const text = cellText(cell.value);
        if (/^수량$/.test(text)) qtyColumns.push(colNumber);
        if (/^합계\(원화환산\)$/.test(text)) totalColumns.push(colNumber);
    });
    qtyColumns.sort((a, b) => a - b);
    totalColumns.sort((a, b) => a - b);
    if (qtyColumns[0]) columnIndex.hwQty = qtyColumns[0];
    if (qtyColumns[1]) columnIndex.swQty = qtyColumns[1];
    if (totalColumns[0]) columnIndex.hwKrwAmount = totalColumns[0];
    if (totalColumns[1]) columnIndex.swKrwAmount = totalColumns[1];
}

/**
 * exceljs 셀 값을 문자열로 바꿉니다.
 *
 * 숫자는 지수 표기가 되지 않도록 다룹니다 — `String(131927179.28)`은 안전하지만 아주 크거나
 * 작은 값은 지수가 되므로 서버가 `BigDecimal`로 파싱하지 못합니다. 수식 셀은 계산된 값을 씁니다.
 */
function cellText(value: CellValue): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
        return Number.isInteger(value) ? String(value) : trimExponent(value);
    }
    if (typeof value === 'boolean') return value ? 'Y' : 'N';
    if (value instanceof Date) {
        const month = String(value.getMonth() + 1).padStart(2, '0');
        return `'${String(value.getFullYear()).slice(2)}.${month}`;
    }
    if (typeof value === 'object') {
        // 수식 셀 { formula, result } / 리치텍스트 { richText } / 하이퍼링크 { text }
        const candidate = value as { result?: CellValue; text?: string; richText?: { text: string }[] };
        if (candidate.result !== undefined) return cellText(candidate.result);
        if (candidate.richText) return candidate.richText.map((r) => r.text).join('');
        if (candidate.text !== undefined) return String(candidate.text).trim();
        return '';
    }
    return String(value).trim();
}

/** 지수 표기를 십진 표기로 펴 서버 BigDecimal 파싱이 실패하지 않게 합니다. */
function trimExponent(value: number): string {
    const text = String(value);
    if (!text.includes('e') && !text.includes('E')) return text;
    return value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}
```

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `cd it_frontend && npx vitest run tests/unit/composables/migration/useMigrationParser.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: 백엔드 계약과 컬럼 리터럴이 같은지 눈으로 대조한다**

`it_backend/.../MigrationColumns.java`의 4개 목록과 `columns.ts`의 `SHEET_COLUMNS`를 나란히 놓고 비교한다. 자동 검증 수단이 없으므로 이 대조가 유일한 게이트다.

- [ ] **Step 7: 커밋**

```bash
cd /c/it/it_frontend && npm run format && npm run check
git add app/composables/migration tests/unit/composables/migration
git commit -m "feat: 수기 엑셀 파서와 정규 컬럼 계약 추가"
```

---

### Task 15: dry-run 연동과 보정값 관리

**Files:**
- Create: `it_frontend/app/composables/migration/useMigrationPreview.ts`
- Test: `it_frontend/tests/unit/composables/migration/useMigrationPreview.test.ts`

**Interfaces:**
- Consumes: `$apiFetch` (Nuxt 플러그인), `useRuntimeConfig().public.apiBase`
- Consumes: `components['schemas']['MigrationDryRunResponse']` 등 `~/types/api` 생성 타입
- Produces: `useMigrationPreview()` → `{ sheets, diagnostics, summary, overrides, blockerCount, canCommit, runDryRun, setOverride, clearOverride, commit, isRunning, errorMessage }`
- Produces: `diagnosticsOf(sheet: SheetKind, excelRow: number, column: string)` → `CellDiagnostic[]`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMigrationPreview } from '~/composables/migration/useMigrationPreview';

const apiFetch = vi.fn();

vi.mock('#app', () => ({
    useNuxtApp: () => ({ $apiFetch: apiFetch }),
    useRuntimeConfig: () => ({ public: { apiBase: 'http://localhost:28080' } }),
}));

/** dry-run 호출·진단 조회·보정값 관리·반영 가드를 고정합니다. */
describe('useMigrationPreview', () => {
    beforeEach(() => {
        apiFetch.mockReset();
    });

    it('절대 URL로 dry-run을 호출한다', async () => {
        apiFetch.mockResolvedValue({ diagnostics: [], summary: { totalRows: 1, blockerCount: 0, warningCount: 0 } });
        const preview = useMigrationPreview();
        preview.sheets.value = [{ kind: 'COST', bseYy: '2026', rows: [{ excelRow: 2, cells: {} }] }];

        await preview.runDryRun();

        expect(apiFetch).toHaveBeenCalledWith(
            'http://localhost:28080/api/admin/migration/imports/dry-run',
            expect.objectContaining({ method: 'POST' }),
        );
    });

    it('BLOCKER가 있으면 반영을 막는다', async () => {
        apiFetch.mockResolvedValue({
            diagnostics: [
                { sheet: 'COST', excelRow: 2, column: 'deptName', code: 'ORG_UNRESOLVED', severity: 'BLOCKER', message: '실패', candidates: [] },
            ],
            summary: { totalRows: 1, blockerCount: 1, warningCount: 0 },
        });
        const preview = useMigrationPreview();
        preview.sheets.value = [{ kind: 'COST', bseYy: '2026', rows: [{ excelRow: 2, cells: {} }] }];

        await preview.runDryRun();

        expect(preview.blockerCount.value).toBe(1);
        expect(preview.canCommit.value).toBe(false);
    });

    it('WARNING만 있으면 반영을 허용한다', async () => {
        apiFetch.mockResolvedValue({
            diagnostics: [
                { sheet: 'COST', excelRow: 2, column: 'krwAmount', code: 'AMOUNT_MISMATCH', severity: 'WARNING', message: '차이', candidates: [] },
            ],
            summary: { totalRows: 1, blockerCount: 0, warningCount: 1 },
        });
        const preview = useMigrationPreview();
        preview.sheets.value = [{ kind: 'COST', bseYy: '2026', rows: [{ excelRow: 2, cells: {} }] }];

        await preview.runDryRun();

        expect(preview.canCommit.value).toBe(true);
    });

    it('dry-run 전에는 반영을 허용하지 않는다', () => {
        const preview = useMigrationPreview();
        preview.sheets.value = [{ kind: 'COST', bseYy: '2026', rows: [{ excelRow: 2, cells: {} }] }];

        expect(preview.canCommit.value).toBe(false);
    });

    it('보정값을 설정하면 dry-run을 다시 돌려 진단을 갱신한다', async () => {
        apiFetch
            .mockResolvedValueOnce({
                diagnostics: [
                    { sheet: 'COST', excelRow: 2, column: 'ioeName', code: 'CODE_UNRESOLVED', severity: 'BLOCKER', message: '실패', candidates: [{ code: '008', label: '외주용역' }] },
                ],
                summary: { totalRows: 1, blockerCount: 1, warningCount: 0 },
            })
            .mockResolvedValueOnce({ diagnostics: [], summary: { totalRows: 1, blockerCount: 0, warningCount: 0 } });

        const preview = useMigrationPreview();
        preview.sheets.value = [{ kind: 'COST', bseYy: '2026', rows: [{ excelRow: 2, cells: {} }] }];
        await preview.runDryRun();

        await preview.setOverride('COST', 2, 'ioeName', '008');

        expect(preview.blockerCount.value).toBe(0);
        expect(preview.canCommit.value).toBe(true);
        expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    it('셀 좌표로 진단을 조회한다', async () => {
        apiFetch.mockResolvedValue({
            diagnostics: [
                { sheet: 'COST', excelRow: 2, column: 'deptName', code: 'ORG_UNRESOLVED', severity: 'BLOCKER', message: '실패', candidates: [] },
                { sheet: 'COST', excelRow: 3, column: 'deptName', code: 'ORG_AMBIGUOUS', severity: 'BLOCKER', message: '중의', candidates: [] },
            ],
            summary: { totalRows: 2, blockerCount: 2, warningCount: 0 },
        });
        const preview = useMigrationPreview();
        preview.sheets.value = [{ kind: 'COST', bseYy: '2026', rows: [] }];
        await preview.runDryRun();

        expect(preview.diagnosticsOf('COST', 2, 'deptName')).toHaveLength(1);
        expect(preview.diagnosticsOf('COST', 2, 'deptName')[0].code).toBe('ORG_UNRESOLVED');
        expect(preview.diagnosticsOf('COST', 9, 'deptName')).toHaveLength(0);
    });

    it('보정값을 CellOverride 배열로 접어 commit에 보낸다', async () => {
        apiFetch.mockResolvedValue({ diagnostics: [], summary: { totalRows: 1, blockerCount: 0, warningCount: 0 } });
        const preview = useMigrationPreview();
        preview.sheets.value = [{ kind: 'COST', bseYy: '2026', rows: [{ excelRow: 2, cells: {} }] }];
        await preview.runDryRun();
        await preview.setOverride('COST', 2, 'ioeName', '008');
        apiFetch.mockResolvedValue({ costCount: 1, projectCount: 0, itemCount: 0, budgetRowCount: 1, planReqDocNo: null, createdIds: ['COST-2026-0001'] });

        await preview.commit();

        const lastCall = apiFetch.mock.calls.at(-1);
        expect(lastCall?.[0]).toBe('http://localhost:28080/api/admin/migration/imports');
        expect(lastCall?.[1].body.overrides).toEqual([
            { sheet: 'COST', excelRow: 2, column: 'ioeName', value: '008' },
        ]);
    });

    it('dry-run 실패는 errorMessage에 담고 예외를 삼키지 않는다', async () => {
        apiFetch.mockRejectedValue({ data: { message: '서버 오류' } });
        const preview = useMigrationPreview();
        preview.sheets.value = [{ kind: 'COST', bseYy: '2026', rows: [] }];

        await expect(preview.runDryRun()).rejects.toBeTruthy();
        expect(preview.errorMessage.value).toContain('서버 오류');
        expect(preview.isRunning.value).toBe(false);
    });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd it_frontend && npx vitest run tests/unit/composables/migration/useMigrationPreview.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현한다**

```ts
/**
 * ============================================================================
 * [migration/useMigrationPreview.ts] dry-run 연동·보정값 관리
 * ============================================================================
 * dry-run 결과를 서버가 보관하지 않으므로(§4.1) 시트 원본과 보정값을 화면이 들고 있다가
 * 확정 반영에 함께 보냅니다. 보정값이 바뀌면 dry-run을 다시 돌려 진단을 갱신합니다.
 * ============================================================================
 */
import { computed, ref } from 'vue';
import { useNuxtApp, useRuntimeConfig } from '#app';
import { formatApiError } from '~/utils/common';
import type { components } from '~/types/api';
import type { SheetKind } from '~/composables/migration/columns';
import type { NormalizedRow } from '~/composables/migration/useMigrationParser';

type DryRunResponse = components['schemas']['MigrationDryRunResponse'];
type CommitResponse = components['schemas']['MigrationCommitResponse'];
type CellDiagnostic = components['schemas']['MigrationCellDiagnostic'];

/** 서버로 보낼 시트 페이로드. */
export interface SheetPayload {
    kind: SheetKind;
    bseYy: string;
    rows: NormalizedRow[];
}

/**
 * 이관 미리보기 상태와 서버 연동.
 *
 * @returns sheets(올린 시트), diagnostics·summary(dry-run 결과), overrides(보정값),
 *   blockerCount·canCommit(반영 가드), runDryRun·setOverride·clearOverride·commit,
 *   isRunning·errorMessage(진행·오류 표시)
 */
export function useMigrationPreview() {
    const { $apiFetch } = useNuxtApp();
    const apiBase = useRuntimeConfig().public.apiBase;

    const sheets = ref<SheetPayload[]>([]);
    const diagnostics = ref<CellDiagnostic[]>([]);
    const summary = ref<DryRunResponse['summary'] | null>(null);
    /** `{SheetKind}|{excelRow}|{column}` → 보정 코드값 */
    const overrides = ref<Record<string, string>>({});
    const isRunning = ref(false);
    const errorMessage = ref('');
    const hasRunDryRun = ref(false);
    const commitResult = ref<CommitResponse | null>(null);

    const blockerCount = computed(() => summary.value?.blockerCount ?? 0);
    const warningCount = computed(() => summary.value?.warningCount ?? 0);

    /** dry-run을 한 번은 돌렸고 BLOCKER가 없어야 반영을 허용합니다. */
    const canCommit = computed(
        () => hasRunDryRun.value && blockerCount.value === 0 && sheets.value.length > 0,
    );

    /**
     * 현재 시트와 보정값으로 사전검증을 요청합니다.
     *
     * @throws 서버 오류를 그대로 전파합니다. 호출자가 Toast로 알립니다
     */
    async function runDryRun(): Promise<void> {
        isRunning.value = true;
        errorMessage.value = '';
        try {
            const response = await $apiFetch<DryRunResponse>(
                `${apiBase}/api/admin/migration/imports/dry-run`,
                { method: 'POST', body: { sheets: sheets.value } },
            );
            diagnostics.value = response.diagnostics;
            summary.value = response.summary;
            hasRunDryRun.value = true;
        } catch (error) {
            errorMessage.value = formatApiError(error);
            throw error;
        } finally {
            isRunning.value = false;
        }
    }

    /**
     * 셀 보정값을 설정하고 사전검증을 다시 돌립니다.
     *
     * @param sheet 시트 종류
     * @param excelRow 엑셀 행 번호
     * @param column 정규 컬럼 id
     * @param value 보정 코드값
     */
    async function setOverride(
        sheet: SheetKind,
        excelRow: number,
        column: string,
        value: string,
    ): Promise<void> {
        overrides.value = { ...overrides.value, [overrideKey(sheet, excelRow, column)]: value };
        await runDryRun();
    }

    /**
     * 셀 보정값을 지우고 사전검증을 다시 돌립니다.
     *
     * @param sheet 시트 종류
     * @param excelRow 엑셀 행 번호
     * @param column 정규 컬럼 id
     */
    async function clearOverride(
        sheet: SheetKind,
        excelRow: number,
        column: string,
    ): Promise<void> {
        const next = { ...overrides.value };
        delete next[overrideKey(sheet, excelRow, column)];
        overrides.value = next;
        await runDryRun();
    }

    /**
     * 확정 반영을 요청합니다.
     *
     * @returns 반영 결과
     * @throws 서버 오류를 그대로 전파합니다
     */
    async function commit(): Promise<CommitResponse> {
        isRunning.value = true;
        errorMessage.value = '';
        try {
            const response = await $apiFetch<CommitResponse>(
                `${apiBase}/api/admin/migration/imports`,
                {
                    method: 'POST',
                    body: {
                        sheets: sheets.value,
                        overrides: Object.entries(overrides.value).map(([key, value]) => {
                            const [sheet, excelRow, column] = key.split('|');
                            return {
                                sheet: sheet as SheetKind,
                                excelRow: Number(excelRow),
                                column,
                                value,
                            };
                        }),
                    },
                },
            );
            commitResult.value = response;
            return response;
        } catch (error) {
            errorMessage.value = formatApiError(error);
            throw error;
        } finally {
            isRunning.value = false;
        }
    }

    /**
     * 셀 좌표에 걸린 진단을 조회합니다.
     *
     * @param sheet 시트 종류
     * @param excelRow 엑셀 행 번호
     * @param column 정규 컬럼 id
     * @returns 그 셀의 진단 목록
     */
    function diagnosticsOf(
        sheet: SheetKind,
        excelRow: number,
        column: string,
    ): CellDiagnostic[] {
        return diagnostics.value.filter(
            (d) => d.sheet === sheet && d.excelRow === excelRow && d.column === column,
        );
    }

    /**
     * 행 전체에 걸린 진단(컬럼 없음)을 조회합니다.
     *
     * @param sheet 시트 종류
     * @param excelRow 엑셀 행 번호
     * @returns 행 단위 진단 목록
     */
    function rowDiagnosticsOf(sheet: SheetKind, excelRow: number): CellDiagnostic[] {
        return diagnostics.value.filter(
            (d) => d.sheet === sheet && d.excelRow === excelRow && !d.column,
        );
    }

    /** 시트를 다시 올릴 때 진단·보정값을 초기화합니다. */
    function reset(): void {
        diagnostics.value = [];
        summary.value = null;
        overrides.value = {};
        hasRunDryRun.value = false;
        commitResult.value = null;
        errorMessage.value = '';
    }

    return {
        sheets,
        diagnostics,
        summary,
        overrides,
        commitResult,
        isRunning,
        errorMessage,
        blockerCount,
        warningCount,
        canCommit,
        runDryRun,
        setOverride,
        clearOverride,
        commit,
        diagnosticsOf,
        rowDiagnosticsOf,
        reset,
    };
}

/** 백엔드 `MigrationValidator.overrideKey`와 같은 형식입니다. */
function overrideKey(sheet: SheetKind, excelRow: number, column: string): string {
    return `${sheet}|${excelRow}|${column}`;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd it_frontend && npx vitest run tests/unit/composables/migration/useMigrationPreview.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
cd /c/it/it_frontend && npm run format && npm run check
git add app/composables/migration tests/unit/composables/migration
git commit -m "feat: 이관 dry-run 연동과 보정값 관리 composable 추가"
```

---

### Task 16: 미리보기 표와 파일 슬롯 컴포넌트

**Files:**
- Create: `it_frontend/app/components/migration/MigrationFileSlots.vue`
- Create: `it_frontend/app/components/migration/MigrationPreviewTable.vue`
- Modify: `it_frontend/tests/unit/architecture/component-boundaries.test.ts`
- Test: `it_frontend/tests/unit/components/migration/MigrationPreviewTable.test.ts`

**Interfaces:**
- Produces: `MigrationFileSlots` props — `{ slots: SlotState[] }`, emits — `select(kind: SheetKind, file: File)`, `clear(kind: SheetKind)`
- Produces: `interface SlotState { kind: SheetKind; label: string; fileName: string | null; rowCount: number }`
- Produces: `MigrationPreviewTable` props — `{ sheet: SheetPayload; diagnosticsOf: Function; rowDiagnosticsOf: Function; overrides: Record<string,string> }`, emits — `override(sheet, excelRow, column, value)`

- [ ] **Step 1: 컴포넌트 경계 테스트를 먼저 갱신한다**

`tests/unit/architecture/component-boundaries.test.ts`가 파일 목록을 고정하므로 새 디렉터리를 등록한다. 먼저 그 테스트를 읽어 형식을 파악한다.

```bash
cd /c/it/it_frontend && sed -n '1,60p' tests/unit/architecture/component-boundaries.test.ts
```

`components/migration/MigrationFileSlots.vue`·`MigrationPreviewTable.vue` 두 항목을 그 테스트의 허용 목록에 추가한다.

- [ ] **Step 2: 실패하는 컴포넌트 테스트를 작성한다**

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MigrationPreviewTable from '~/components/migration/MigrationPreviewTable.vue';

/** 진단 강조와 보정 드롭다운 노출 규칙을 고정합니다. */
describe('MigrationPreviewTable', () => {
    const sheet = {
        kind: 'COST' as const,
        bseYy: '2026',
        rows: [
            { excelRow: 2, cells: { ioeName: '외주용역비', deptName: 'IT기획부', requestDetail: '원가계산 용역' } },
            { excelRow: 3, cells: { ioeName: '유지보수료', deptName: 'IT기획부', requestDetail: '올인원' } },
        ],
    };

    it('BLOCKER 셀에 오류 클래스를 붙인다', () => {
        const wrapper = mount(MigrationPreviewTable, {
            props: {
                sheet,
                overrides: {},
                diagnosticsOf: (_k: string, row: number, column: string) =>
                    row === 2 && column === 'ioeName'
                        ? [{ code: 'CODE_UNRESOLVED', severity: 'BLOCKER', message: '비목 미해석', candidates: [{ code: '008', label: '외주용역(외주운영/관제 등)' }] }]
                        : [],
                rowDiagnosticsOf: () => [],
            },
            global: { stubs: { StyledDataTable: false } },
        });

        expect(wrapper.find('.migration-cell--blocker').exists()).toBe(true);
    });

    it('후보가 있는 셀에 보정 드롭다운을 노출한다', () => {
        const wrapper = mount(MigrationPreviewTable, {
            props: {
                sheet,
                overrides: {},
                diagnosticsOf: (_k: string, row: number, column: string) =>
                    row === 2 && column === 'ioeName'
                        ? [{ code: 'CODE_UNRESOLVED', severity: 'BLOCKER', message: '비목 미해석', candidates: [{ code: '008', label: '외주용역' }, { code: '009', label: '자문/심사' }] }]
                        : [],
                rowDiagnosticsOf: () => [],
            },
        });

        expect(wrapper.find('[data-testid="override-select-2-ioeName"]').exists()).toBe(true);
    });

    it('WARNING 셀은 경고 클래스만 붙이고 드롭다운을 노출하지 않는다', () => {
        const wrapper = mount(MigrationPreviewTable, {
            props: {
                sheet,
                overrides: {},
                diagnosticsOf: (_k: string, row: number, column: string) =>
                    row === 2 && column === 'requestDetail'
                        ? [{ code: 'AMOUNT_MISMATCH', severity: 'WARNING', message: '금액 차이', candidates: [] }]
                        : [],
                rowDiagnosticsOf: () => [],
            },
        });

        expect(wrapper.find('.migration-cell--warning').exists()).toBe(true);
        expect(wrapper.find('[data-testid="override-select-2-requestDetail"]').exists()).toBe(false);
    });

    it('보정된 셀은 보정 표시를 남긴다', () => {
        const wrapper = mount(MigrationPreviewTable, {
            props: {
                sheet,
                overrides: { 'COST|2|ioeName': '008' },
                diagnosticsOf: () => [],
                rowDiagnosticsOf: () => [],
            },
        });

        expect(wrapper.find('.migration-cell--overridden').exists()).toBe(true);
    });

    it('진단이 없는 셀은 아무 클래스도 붙이지 않는다', () => {
        const wrapper = mount(MigrationPreviewTable, {
            props: { sheet, overrides: {}, diagnosticsOf: () => [], rowDiagnosticsOf: () => [] },
        });

        expect(wrapper.find('.migration-cell--blocker').exists()).toBe(false);
        expect(wrapper.find('.migration-cell--warning').exists()).toBe(false);
    });
});
```

- [ ] **Step 3: 테스트를 돌려 실패를 확인한다**

Run: `cd it_frontend && npx vitest run tests/unit/components/migration`
Expected: FAIL — 컴포넌트 없음

- [ ] **Step 4: `MigrationPreviewTable.vue`를 작성한다**

```vue
<!--
  ============================================================================
  [MigrationPreviewTable.vue] 이관 미리보기 표
  ============================================================================
  정규화 행을 StyledDataTable로 보여주며 진단이 걸린 셀을 강조하고, 해석 후보가 있는
  셀에는 보정 드롭다운을 노출합니다. BLOCKER가 남아 있으면 페이지가 반영 버튼을 막습니다.
  ============================================================================
-->
<script setup lang="ts">
import { computed } from 'vue';
import Select from 'primevue/select';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import Column from 'primevue/column';
import { COLUMN_LABELS, SHEET_COLUMNS, type SheetKind } from '~/composables/migration/columns';
import type { SheetPayload } from '~/composables/migration/useMigrationPreview';
import type { components } from '~/types/api';

type CellDiagnostic = components['schemas']['MigrationCellDiagnostic'];

const props = defineProps<{
    /** 보여줄 시트 */
    sheet: SheetPayload;
    /** 보정값 맵 (`{SheetKind}|{excelRow}|{column}` 키) */
    overrides: Record<string, string>;
    /** 셀 진단 조회 함수 */
    diagnosticsOf: (sheet: SheetKind, excelRow: number, column: string) => CellDiagnostic[];
    /** 행 단위 진단 조회 함수 */
    rowDiagnosticsOf: (sheet: SheetKind, excelRow: number) => CellDiagnostic[];
}>();

const emit = defineEmits<{
    override: [sheet: SheetKind, excelRow: number, column: string, value: string];
}>();

/** 표에 그릴 컬럼 목록. */
const columns = computed(() => SHEET_COLUMNS[props.sheet.kind]);

/** 표 행 데이터. StyledDataTable이 객체 배열을 받으므로 셀 맵을 그대로 넘긴다. */
const rows = computed(() => props.sheet.rows);

/** 셀 강조 클래스를 정한다. BLOCKER > WARNING > 보정됨 순으로 우선한다. */
function cellClass(excelRow: number, column: string): string {
    const diagnostics = props.diagnosticsOf(props.sheet.kind, excelRow, column);
    if (diagnostics.some((d) => d.severity === 'BLOCKER')) return 'migration-cell--blocker';
    if (diagnostics.some((d) => d.severity === 'WARNING')) return 'migration-cell--warning';
    if (props.overrides[`${props.sheet.kind}|${excelRow}|${column}`]) {
        return 'migration-cell--overridden';
    }
    return '';
}

/** 셀에 걸린 진단 문구를 툴팁용으로 합친다. */
function cellTitle(excelRow: number, column: string): string {
    return props
        .diagnosticsOf(props.sheet.kind, excelRow, column)
        .map((d) => d.message)
        .join('\n');
}

/** 보정 후보가 있는 진단을 찾는다. 없으면 드롭다운을 그리지 않는다. */
function candidatesOf(excelRow: number, column: string): { code: string; label: string }[] {
    for (const diagnostic of props.diagnosticsOf(props.sheet.kind, excelRow, column)) {
        if (diagnostic.candidates.length > 0) return diagnostic.candidates;
    }
    return [];
}

/** 현재 보정값을 읽는다. */
function overrideValue(excelRow: number, column: string): string | null {
    return props.overrides[`${props.sheet.kind}|${excelRow}|${column}`] ?? null;
}
</script>

<template>
    <div class="migration-preview">
        <StyledDataTable :value="rows" :loading="false" data-key="excelRow" scrollable>
            <Column field="excelRow" header="행" style="width: 4rem" />
            <Column
                v-for="column in columns"
                :key="column"
                :field="`cells.${column}`"
                :header="COLUMN_LABELS[column] ?? column"
            >
                <template #body="{ data }">
                    <div
                        :class="['migration-cell', cellClass(data.excelRow, column)]"
                        :title="cellTitle(data.excelRow, column)"
                    >
                        <span class="migration-cell__text">{{ data.cells[column] }}</span>
                        <Select
                            v-if="candidatesOf(data.excelRow, column).length > 0"
                            :data-testid="`override-select-${data.excelRow}-${column}`"
                            :model-value="overrideValue(data.excelRow, column)"
                            :options="candidatesOf(data.excelRow, column)"
                            option-label="label"
                            option-value="code"
                            placeholder="선택"
                            class="migration-cell__select"
                            @update:model-value="
                                (value: string) => emit('override', sheet.kind, data.excelRow, column, value)
                            "
                        />
                    </div>
                </template>
            </Column>
        </StyledDataTable>
    </div>
</template>

<style scoped>
.migration-cell {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
}

.migration-cell--blocker {
    background-color: var(--color-danger-subtle);
    outline: 1px solid var(--color-danger);
}

.migration-cell--warning {
    background-color: var(--color-warning-subtle);
}

.migration-cell--overridden {
    background-color: var(--color-success-subtle);
}

.migration-cell__select {
    min-width: 12rem;
}
</style>
```

> `--color-danger-subtle` 등 토큰이 `assets/css/tokens.css`에 없으면 추가하지 말고 기존 토큰으로 대체한다. `npm run lint:css`가 통과해야 한다. 사용 가능한 토큰은 `docs/guides/styling/design-tokens.md`에서 확인한다.

- [ ] **Step 5: `MigrationFileSlots.vue`를 작성한다**

```vue
<!--
  ============================================================================
  [MigrationFileSlots.vue] 이관 파일 슬롯 4개
  ============================================================================
  올린 파일에서 판별된 시트를 슬롯에 채웁니다. 슬롯을 비워 둔 채로도 반영할 수 있으나
  부문계획만 단독으로 올리면 서버가 PROJECT_NOT_FOUND로 막습니다(§4.3).
  ============================================================================
-->
<script setup lang="ts">
import Button from 'primevue/button';
import type { SheetKind } from '~/composables/migration/columns';

/** 슬롯 하나의 상태. */
export interface SlotState {
    kind: SheetKind;
    label: string;
    fileName: string | null;
    rowCount: number;
}

defineProps<{ slots: SlotState[] }>();

const emit = defineEmits<{
    select: [kind: SheetKind, file: File];
    clear: [kind: SheetKind];
}>();

/** 파일 선택 이벤트에서 File을 꺼내 상위로 올립니다. */
function onFileChange(kind: SheetKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) emit('select', kind, file);
    // 같은 파일을 다시 고를 수 있도록 초기화한다
    input.value = '';
}
</script>

<template>
    <div class="migration-slots">
        <div v-for="slot in slots" :key="slot.kind" class="migration-slot">
            <div class="migration-slot__label">{{ slot.label }}</div>
            <div v-if="slot.fileName" class="migration-slot__file">
                <span>{{ slot.fileName }}</span>
                <span class="migration-slot__count">{{ slot.rowCount }}행</span>
                <Button
                    label="비우기"
                    severity="secondary"
                    text
                    :data-testid="`clear-${slot.kind}`"
                    @click="emit('clear', slot.kind)"
                />
            </div>
            <label v-else class="migration-slot__picker">
                <input
                    type="file"
                    accept=".xlsx"
                    :data-testid="`file-${slot.kind}`"
                    @change="(event) => onFileChange(slot.kind, event)"
                />
            </label>
        </div>
    </div>
</template>

<style scoped>
.migration-slots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--spacing-3);
}

.migration-slot {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    padding: var(--spacing-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
}

.migration-slot__file {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
}
</style>
```

- [ ] **Step 6: 테스트를 돌리고 스타일 검사를 통과시킨다**

Run:
```bash
cd it_frontend && npx vitest run tests/unit/components/migration tests/unit/architecture/component-boundaries.test.ts && npm run lint:css
```
Expected: PASS (6 tests + Stylelint)

- [ ] **Step 7: 커밋**

```bash
cd /c/it/it_frontend && npm run format && npm run check
git add app/components/migration tests/unit
git commit -m "feat: 이관 미리보기 표와 파일 슬롯 컴포넌트 추가"
```

---

### Task 17: 관리자 화면과 메뉴 등록

**Files:**
- Create: `it_frontend/app/composables/useMigrationPage.ts`
- Create: `it_frontend/app/pages/admin/migration/index.vue`
- Create: `it_database/migrations/V20260811_002__SeedMigrationAdminMenu.sql`
- Test: `it_frontend/tests/unit/pages/migrationPageBoundary.test.ts`
- Test: `it_frontend/tests/unit/composables/useMigrationPage.test.ts`

**Interfaces:**
- Consumes: `useMigrationParser`, `useMigrationPreview`, `useToast`, `TOAST_LIFE`
- Produces: `useMigrationPage()` → `{ slots, preview, bseYy, selectFile, clearSlot, runDryRun, commit }`

- [ ] **Step 1: 실패하는 파사드 테스트를 작성한다**

```ts
import { describe, expect, it, vi } from 'vitest';
import { useMigrationPage } from '~/composables/useMigrationPage';

const parseFile = vi.fn();
const runDryRun = vi.fn();
const toastAdd = vi.fn();

vi.mock('~/composables/migration/useMigrationParser', () => ({
    useMigrationParser: () => ({ parseFile }),
}));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));

/** 파일 선택 → 슬롯 채움 → dry-run 흐름과 오류 안내를 고정합니다. */
describe('useMigrationPage', () => {
    it('파일에서 판별된 시트를 해당 슬롯에 채우고 dry-run을 돌린다', async () => {
        parseFile.mockResolvedValue([
            { kind: 'COST', sheetName: '전체취합(국내외)', rows: [{ excelRow: 2, cells: {} }] },
        ]);
        const page = useMigrationPage();
        page.preview.runDryRun = runDryRun;

        await page.selectFile('COST', new File([], '일반관리비.xlsx'));

        expect(page.slots.value.find((s) => s.kind === 'COST')?.rowCount).toBe(1);
        expect(runDryRun).toHaveBeenCalled();
    });

    it('한 파일에 여러 대상 시트가 있으면 슬롯을 모두 채운다', async () => {
        parseFile.mockResolvedValue([
            { kind: 'CAPITAL_PROJECT', sheetName: '1-1. 26년정보화사업(전산예산반영)', rows: [{ excelRow: 2, cells: {} }] },
            { kind: 'DELEGATED_BUDGET', sheetName: '2. 위임예산(경상)', rows: [{ excelRow: 2, cells: {} }, { excelRow: 3, cells: {} }] },
        ]);
        const page = useMigrationPage();
        page.preview.runDryRun = vi.fn();

        await page.selectFile('CAPITAL_PROJECT', new File([], '자본예산.xlsx'));

        expect(page.slots.value.find((s) => s.kind === 'CAPITAL_PROJECT')?.rowCount).toBe(1);
        expect(page.slots.value.find((s) => s.kind === 'DELEGATED_BUDGET')?.rowCount).toBe(2);
    });

    it('대상 시트가 없는 파일은 경고 Toast를 띄우고 슬롯을 비워 둔다', async () => {
        parseFile.mockResolvedValue([]);
        const page = useMigrationPage();

        await page.selectFile('COST', new File([], '엉뚱한파일.xlsx'));

        expect(toastAdd).toHaveBeenCalledWith(
            expect.objectContaining({ severity: 'warn' }),
        );
        expect(page.slots.value.find((s) => s.kind === 'COST')?.fileName).toBeNull();
    });

    it('파싱 실패는 오류 Toast로 알린다', async () => {
        parseFile.mockRejectedValue(new Error('깨진 파일'));
        const page = useMigrationPage();

        await page.selectFile('COST', new File([], '깨진파일.xlsx'));

        expect(toastAdd).toHaveBeenCalledWith(
            expect.objectContaining({ severity: 'error' }),
        );
    });

    it('슬롯을 비우면 시트와 진단을 함께 지운다', async () => {
        parseFile.mockResolvedValue([
            { kind: 'COST', sheetName: '전체취합(국내외)', rows: [{ excelRow: 2, cells: {} }] },
        ]);
        const page = useMigrationPage();
        page.preview.runDryRun = vi.fn();
        await page.selectFile('COST', new File([], '일반관리비.xlsx'));

        await page.clearSlot('COST');

        expect(page.slots.value.find((s) => s.kind === 'COST')?.fileName).toBeNull();
        expect(page.preview.sheets.value).toHaveLength(0);
    });
});
```

- [ ] **Step 2: 페이지 경계 테스트를 작성한다**

기존 `tests/unit/pages/*PageBoundary.test.ts` 형식을 먼저 읽고 같은 패턴으로 만든다.

```bash
cd /c/it/it_frontend && ls tests/unit/pages/ && sed -n '1,40p' "$(ls tests/unit/pages/*PageBoundary.test.ts | head -1)"
```

`app/pages/admin/migration/index.vue`가 `useMigrationPage`를 소비하는지 소스 문자열로 고정한다.

- [ ] **Step 3: `useMigrationPage.ts`를 작성한다**

```ts
/**
 * ============================================================================
 * [useMigrationPage.ts] 관리자 데이터 일괄 반입 화면 파사드
 * ============================================================================
 * 파일 슬롯 4개, 파싱, dry-run, 확정 반영을 화면에서 분리해 담습니다.
 * 페이지는 라우팅과 화면 조합만 담당합니다.
 * ============================================================================
 */
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import { TOAST_LIFE } from '~/utils/toast';
import { formatApiError } from '~/utils/common';
import { useMigrationParser } from '~/composables/migration/useMigrationParser';
import { useMigrationPreview } from '~/composables/migration/useMigrationPreview';
import type { SheetKind } from '~/composables/migration/columns';
import type { SlotState } from '~/components/migration/MigrationFileSlots.vue';

/** 슬롯 표시 순서와 라벨. 반영 순서와 같습니다(§7). */
const SLOT_DEFS: ReadonlyArray<{ kind: SheetKind; label: string }> = [
    { kind: 'COST', label: '전산일반관리비 편성 요구서' },
    { kind: 'CAPITAL_PROJECT', label: '전산자본예산 편성 요구서' },
    { kind: 'DELEGATED_BUDGET', label: '위임예산(경상)' },
    { kind: 'PLAN_ADJUSTMENT', label: '정보기술부문계획 조정' },
];

/**
 * 데이터 일괄 반입 화면 상태.
 *
 * @returns slots(슬롯 상태), preview(dry-run·보정·반영), bseYy(예산연도),
 *   selectFile·clearSlot·runDryRun·commit
 */
export function useMigrationPage() {
    const toast = useToast();
    const parser = useMigrationParser();
    const preview = useMigrationPreview();

    /** 화면에서 지정하는 예산연도. 기본값은 올해입니다. */
    const bseYy = ref(String(new Date().getFullYear()));

    const slots = ref<SlotState[]>(
        SLOT_DEFS.map((def) => ({ ...def, fileName: null, rowCount: 0 })),
    );

    /** 슬롯이 하나라도 채워졌는지. 반영 버튼 노출 조건입니다. */
    const hasAnySheet = computed(() => preview.sheets.value.length > 0);

    /**
     * 파일을 파싱해 판별된 시트를 슬롯에 채우고 사전검증을 돌립니다.
     *
     * <p>한 파일에 대상 시트가 여럿 있을 수 있습니다(자본예산 파일은 정보화사업과 위임예산을 함께
     * 담습니다). 어느 슬롯에서 골랐는지와 무관하게 판별된 종류대로 채웁니다.
     *
     * @param kind 사용자가 클릭한 슬롯 (안내 문구에만 씁니다)
     * @param file 선택한 xlsx
     */
    async function selectFile(kind: SheetKind, file: File): Promise<void> {
        try {
            const parsed = await parser.parseFile(file);
            if (parsed.length === 0) {
                toast.add({
                    severity: 'warn',
                    summary: '반입 대상 없음',
                    detail: '이 파일에서 반입할 수 있는 시트를 찾지 못했습니다. 시트명을 확인해 주세요.',
                    life: TOAST_LIFE.MEDIUM,
                });
                return;
            }
            for (const sheet of parsed) {
                upsertSheet(sheet.kind, file.name, sheet.rows);
            }
            await preview.runDryRun();
        } catch (error) {
            console.error('[Migration] 파일 파싱 실패', error);
            toast.add({
                severity: 'error',
                summary: '파일 오류',
                detail: formatApiError(error),
                life: TOAST_LIFE.LONG,
            });
        }
    }

    /**
     * 슬롯을 비우고 해당 시트를 반영 대상에서 제외합니다.
     *
     * @param kind 비울 슬롯
     */
    async function clearSlot(kind: SheetKind): Promise<void> {
        preview.sheets.value = preview.sheets.value.filter((sheet) => sheet.kind !== kind);
        slots.value = slots.value.map((slot) =>
            slot.kind === kind ? { ...slot, fileName: null, rowCount: 0 } : slot,
        );
        if (preview.sheets.value.length === 0) {
            preview.reset();
            return;
        }
        await preview.runDryRun();
    }

    /** 사전검증을 다시 돌립니다. 실패는 Toast로 알립니다. */
    async function runDryRun(): Promise<void> {
        try {
            await preview.runDryRun();
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '사전검증 실패',
                detail: preview.errorMessage.value || formatApiError(error),
                life: TOAST_LIFE.LONG,
            });
        }
    }

    /** 확정 반영합니다. 성공·실패를 모두 Toast로 알립니다. */
    async function commit(): Promise<void> {
        try {
            const result = await preview.commit();
            toast.add({
                severity: 'success',
                summary: '반영 완료',
                detail:
                    `전산업무비 ${result.costCount}건, 사업 ${result.projectCount}건, ` +
                    `품목 ${result.itemCount}건, 편성행 ${result.budgetRowCount}건을 반영했습니다.`,
                life: TOAST_LIFE.LONG,
            });
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '반영 실패',
                detail: preview.errorMessage.value || formatApiError(error),
                life: TOAST_LIFE.LONG,
            });
        }
    }

    /** 같은 종류의 시트가 이미 있으면 교체합니다. */
    function upsertSheet(
        kind: SheetKind,
        fileName: string,
        rows: { excelRow: number; cells: Record<string, string> }[],
    ): void {
        const others = preview.sheets.value.filter((sheet) => sheet.kind !== kind);
        preview.sheets.value = [...others, { kind, bseYy: bseYy.value, rows }];
        slots.value = slots.value.map((slot) =>
            slot.kind === kind ? { ...slot, fileName, rowCount: rows.length } : slot,
        );
    }

    return { slots, preview, bseYy, hasAnySheet, selectFile, clearSlot, runDryRun, commit };
}
```

- [ ] **Step 4: 페이지를 작성한다**

```vue
<!--
  ============================================================================
  [admin/migration/index.vue] 데이터 일괄 반입
  ============================================================================
  포탈 도입 전 수기 관리 엑셀을 원장으로 반입합니다. 파일을 올리면 서버가 조직·코드를
  해석하고 검증해 진단을 돌려주며, 오류를 모두 보정한 뒤에만 반영할 수 있습니다.
  상태와 업무 흐름은 useMigrationPage가 담당합니다.
  ============================================================================
-->
<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import MigrationFileSlots from '~/components/migration/MigrationFileSlots.vue';
import MigrationPreviewTable from '~/components/migration/MigrationPreviewTable.vue';
import { useMigrationPage } from '~/composables/useMigrationPage';

definePageMeta({ middleware: 'admin', title: '데이터 일괄 반입' });

const { slots, preview, bseYy, hasAnySheet, selectFile, clearSlot, commit } = useMigrationPage();
</script>

<template>
    <div class="migration-page">
        <section class="migration-page__controls">
            <label class="migration-page__year">
                예산연도
                <InputText v-model="bseYy" maxlength="4" data-testid="bse-yy" />
            </label>
            <MigrationFileSlots
                :slots="slots"
                @select="selectFile"
                @clear="clearSlot"
            />
        </section>

        <Message v-if="preview.errorMessage.value" severity="error" :closable="false">
            {{ preview.errorMessage.value }}
        </Message>

        <Message
            v-else-if="preview.summary.value && preview.blockerCount.value > 0"
            severity="error"
            :closable="false"
        >
            해결해야 하는 오류가 {{ preview.blockerCount.value }}건 있습니다. 표에서 빨갛게 표시된
            셀을 보정해 주세요.
        </Message>

        <Message
            v-else-if="preview.summary.value && preview.warningCount.value > 0"
            severity="warn"
            :closable="false"
        >
            확인이 필요한 경고가 {{ preview.warningCount.value }}건 있습니다. 반영은 가능합니다.
        </Message>

        <section v-if="hasAnySheet" class="migration-page__preview">
            <div v-for="sheet in preview.sheets.value" :key="sheet.kind">
                <h3>{{ slots.find((s) => s.kind === sheet.kind)?.label }}</h3>
                <MigrationPreviewTable
                    :sheet="sheet"
                    :overrides="preview.overrides.value"
                    :diagnostics-of="preview.diagnosticsOf"
                    :row-diagnostics-of="preview.rowDiagnosticsOf"
                    @override="preview.setOverride"
                />
            </div>
        </section>

        <footer v-if="hasAnySheet" class="migration-page__footer">
            <Button
                label="확정 반영"
                :disabled="!preview.canCommit.value || preview.isRunning.value"
                :loading="preview.isRunning.value"
                data-testid="commit-button"
                @click="commit"
            />
        </footer>

        <section v-if="preview.commitResult.value" class="migration-page__result">
            <h3>반영 결과</h3>
            <ul>
                <li>전산업무비 {{ preview.commitResult.value.costCount }}건</li>
                <li>사업 {{ preview.commitResult.value.projectCount }}건</li>
                <li>품목 {{ preview.commitResult.value.itemCount }}건</li>
                <li>편성행 {{ preview.commitResult.value.budgetRowCount }}건</li>
                <li v-if="preview.commitResult.value.planReqDocNo">
                    계획 {{ preview.commitResult.value.planReqDocNo }}
                </li>
            </ul>
        </section>
    </div>
</template>

<style scoped>
.migration-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
}

.migration-page__controls {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
}

.migration-page__footer {
    display: flex;
    justify-content: flex-end;
}
</style>
```

- [ ] **Step 5: 메뉴 시드를 작성한다**

먼저 기존 관리자 메뉴 시드를 읽어 컬럼과 부모 메뉴 ID를 확인한다.

```bash
cd /c/it/it_database && grep -n "CMENUM" -A 25 migrations/V20260806_001__AddBoardMenuTypeAndSeedBoardMenus.sql | head -40
```

같은 패턴으로 `V20260811_002__SeedMigrationAdminMenu.sql`을 만든다. `MNU_TP_C='PGE'`, 화면경로 `/admin/migration`, 부모는 시스템 관리 메뉴, `IMK_NM`은 `^[a-z0-9 -]{1,100}$`를 만족하는 아이콘 클래스(예: `pi pi-upload`)로 둔다.

- [ ] **Step 6: 테스트와 정적 검사를 통과시킨다**

Run:
```bash
cd it_frontend && npx vitest run tests/unit/composables/useMigrationPage.test.ts tests/unit/pages/migrationPageBoundary.test.ts && npm run check && npm run lint:css
```
Expected: PASS

- [ ] **Step 7: 커밋**

```bash
cd /c/it/it_database && git add migrations/V20260811_002__SeedMigrationAdminMenu.sql && git commit -m "feat: 데이터 일괄 반입 관리자 메뉴 시드"
cd /c/it/it_frontend && npm run format
git add app tests
git commit -m "feat: 데이터 일괄 반입 관리자 화면 추가"
```

---

### Task 18: 계약 재생성과 E2E 검증

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (생성물 — 직접 수정하지 않고 재생성)
- Create: `it_frontend/tests/e2e/migration.spec.ts`
- Modify: `C:\it\TASK.md`
- Modify: `C:\it\versions.lock`

- [ ] **Step 1: 백엔드를 기동하고 프론트 타입을 재생성한다**

Run:
```bash
cd it_backend && ./gradlew bootRun
```
다른 셸에서:
```bash
cd it_frontend && npm run codegen && npm run codegen:check
```
Expected: `app/types/api.d.ts`에 `MigrationDryRunRequest`·`MigrationDryRunResponse`·`MigrationCommitRequest`·`MigrationCommitResponse`·`MigrationCellDiagnostic`·`MigrationCandidate`·`MigrationSheetPayload`·`MigrationNormalizedRow`·`MigrationCellOverride`·`MigrationSummary`·`MigrationSheetKind`·`MigrationSeverity` 스키마가 생긴다. `codegen:check`가 통과해야 한다.

CI가 없으므로 이 확인이 스펙-타입 드리프트의 유일한 게이트다.

- [ ] **Step 2: E2E 시나리오를 작성한다**

`it_frontend/tests/e2e/migration.spec.ts`

```ts
import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * 관리자 데이터 일괄 반입 흐름을 검증합니다.
 *
 * 실 업무 xlsx를 저장소에 두지 않으므로 테스트가 픽스처를 즉석에서 만듭니다.
 * 부서·담당자 이름은 dev DB에 실제로 있는 값이어야 해석이 통과합니다.
 */
test.describe('데이터 일괄 반입', () => {
    test('파일 업로드 → 진단 표시 → 보정 → 반영', async ({ page }) => {
        const filePath = await buildCostWorkbook();

        await page.goto('/admin/migration');
        await expect(page.getByTestId('bse-yy')).toBeVisible();

        await page.getByTestId('bse-yy').fill('2999');
        await page.getByTestId('file-COST').setInputFiles(filePath);

        // dry-run이 끝나면 미리보기 표가 보인다
        await expect(page.locator('.migration-cell').first()).toBeVisible();

        // 미해석 비목 셀에 보정 드롭다운이 노출된다
        const select = page.locator('[data-testid^="override-select-"]').first();
        if (await select.count()) {
            await select.click();
            await page.getByRole('option').first().click();
        }

        // BLOCKER가 남아 있으면 반영 버튼이 비활성이다
        const commitButton = page.getByTestId('commit-button');
        await expect(commitButton).toBeVisible();

        if (await commitButton.isEnabled()) {
            await commitButton.click();
            await expect(page.getByText('반영 완료')).toBeVisible();
        } else {
            await expect(page.getByText(/해결해야 하는 오류가/)).toBeVisible();
        }
    });

    test('반입 대상 시트가 없는 파일은 경고를 띄운다', async ({ page }) => {
        const filePath = await buildUnrelatedWorkbook();

        await page.goto('/admin/migration');
        await page.getByTestId('file-COST').setInputFiles(filePath);

        await expect(page.getByText('반입 대상 없음')).toBeVisible();
    });
});

/** 일반관리비 시트 픽스처를 임시 디렉터리에 만듭니다. */
async function buildCostWorkbook(): Promise<string> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('전체취합(국내외)');
    ws.addRow([
        '사업코드', '세   목', '세목코드', '구분', '계약업체명', '요구내역', '보안',
        '금융정보단말기', '요구부서', '팀', '25년 통화', '25년 요구액', '25년 요구액(원화)',
        '26년 통화', '26년 요구액', '26년 요구액(원화)', '증감액', '증감률', '비고',
    ]);
    ws.addRow([
        '571', '유지보수료', '240-0200', '계속', 'E2E벤더', 'E2E 유지보수', '', '',
        'IT기획부', 'IT기획팀', 'KRW', 1000, 1000, 'KRW', 1000, 1000, 0, 0, 'E2E',
    ]);
    return writeTemp(wb, 'cost.xlsx');
}

/** 반입 대상이 아닌 시트만 담은 픽스처. */
async function buildUnrelatedWorkbook(): Promise<string> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('(환율 기준)');
    ws.addRow(['통화코드', '예산환율']);
    ws.addRow(['GBP', 1924]);
    return writeTemp(wb, 'unrelated.xlsx');
}

async function writeTemp(wb: ExcelJS.Workbook, name: string): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), 'migration-e2e-'));
    const filePath = join(dir, name);
    writeFileSync(filePath, Buffer.from(await wb.xlsx.writeBuffer()));
    return filePath;
}
```

- [ ] **Step 3: E2E를 돌린다**

두 서버를 모두 기동한 상태에서 실행한다.

Run:
```bash
cd it_frontend && npm run test:e2e -- migration.spec.ts
```
Expected: PASS (2 tests). 첫 테스트는 dev DB의 조직·담당자 데이터에 따라 반영까지 가거나 오류 안내에서 멈춘다 — 두 경로 모두 통과로 본다.

- [ ] **Step 4: 전체 Health Stack을 돌린다**

Run:
```bash
cd it_backend && ./gradlew clean check --no-daemon
cd it_frontend && npm run format:check && npm run check && npm run lint:css && npm test
```
Expected: 모두 PASS. `./gradlew check`가 Spotless와 JaCoCo 커버리지 검증까지 포함한다.

`clean`이 Jacoco 리포트를 지우므로 커버리지 수치를 확인하려면 `clean` 없이 다시 돌린다.

- [ ] **Step 5: `TASK.md`에 남은 과제를 등록한다**

이번 범위에서 의도적으로 제외한 것을 기록한다.

```markdown
| MIG-01 | 🟡 Medium | 이관 | `사업진행`·집행 실적 열의 원장 반영 | 정보기술부문계획 조정의 `사업진행`(`진행(품의)`·`진행(계약)`·`취소(연기)`)과 집행 실적 4열은 대응하는 원장 코드셋이 없어 `BPLANM.REDT_CONE_INF` 스냅샷에만 남겼다(2026-08-11 이관 설계 §5.4). 이 값들을 조회·집계에 쓰려면 `BPROJA.IT_PTL_STS_TC` 또는 `BPROJM.IT_PTL_RPR_STS_TC`의 유효 코드셋을 먼저 확정하고 계약 테스트를 추가한다. |
| MIG-02 | 🟢 Low | 이관 | 정규 컬럼 id 계약의 자동 검증 | `MigrationColumns.java`와 `columns.ts`가 같은 리터럴을 손으로 유지한다. 한쪽만 바꾸면 dry-run이 조용히 빈 셀을 읽는다. 백엔드가 컬럼 목록을 API로 노출하고 프론트 테스트가 그 응답과 대조하는 방식으로 게이트를 만들 수 있다. |
| MIG-03 | 🟢 Low | 이관 | 위임예산 부점 사업의 담당자 지정 | 위임예산 시트에 담당자가 없어 업로드 사용자를 담당자·IT담당자로 넣는다(§5.5). 부점별 실제 담당자를 지정할 수 있는 입력을 미리보기에 추가할 수 있다. |
```

- [ ] **Step 6: `versions.lock`을 갱신하고 커밋한다**

교차 저장소 변경이므로 백엔드 계약 커밋이 먼저, 프론트 커밋이 뒤에 있어야 한다(루트 `CLAUDE.md` 4-repo 토폴로지). 이미 그 순서로 커밋했으므로 lock만 갱신한다.

```bash
cd /c/it/it_frontend && git add app/types/api.d.ts tests/e2e/migration.spec.ts && git commit -m "test: 이관 화면 E2E 시나리오 추가와 API 타입 재생성"
cd /c/it && pwsh -File scripts/update-versions-lock.ps1
git add versions.lock TASK.md
git commit -m "chore: 수기 엑셀 이관 반영해 versions.lock·TASK.md 갱신"
```

- [ ] **Step 7: 실물 파일로 최종 확인한다**

로컬에서만 수행한다. `C:\it`의 세 xlsx를 화면에 올려 dry-run 진단을 눈으로 본다.

확인할 것:
1. 일반관리비 14행 중 비목 미해석이 정확히 3건(외주용역비·전산회의비·국외전산기타제비)인지
2. GBP 4행의 금액 대조가 통과하는지 — 통과하지 못하면 Task 1의 환율 시드값을 확인한다
3. 자본예산 2행·부문계획 3행의 담당자·부서가 해석되는지
4. 위임예산 12행이 사업 2건(런던·런던 PF)으로 묶이는지
5. 부문계획에만 있는 `문자메시지 안심마크 도입`이 `PROJECT_NOT_FOUND` 없이 사업으로 생성되는지

반영은 로컬 DB에서만 하고, 결과를 예산 현황 화면에서 확인해 결재 받이가 실제로 집계에 반영되는지 본다. **이 파일들을 커밋하지 않는다.**

---

## 자체 검토 결과

**스펙 커버리지** — §1~§11의 모든 요구가 태스크에 대응한다.

| 스펙 절 | 태스크 |
| --- | --- |
| §3.1 IOE 미해석 3건 | Task 5(진단), Task 6(보정 흡수) |
| §3.2 GBP·AUD 통화 | Task 1 |
| §3.3 ABUS_TC 코드값 | Task 2(주석), Task 6(`AdapterSupport.abusTc`) |
| §3.4 금액 단위 | Task 6(`AdapterSupport.amount`), Task 7·8·9 |
| §3.5 BG_NO·SNO, applyItemRates | Task 2(주석), Task 11 |
| §3.6 결재 받이 | Task 10, Task 13 |
| §3.7 환율 Ccodem 결정 | Task 1, Task 11(`MigrationIoeCatalogReader`), Task 13 |
| §3.8 기간 검증 | Task 2, Task 11 |
| §4.1 3단계 흐름 | Task 12, Task 15 |
| §4.2 백엔드 모듈 | Task 3~12 |
| §4.3 프론트 모듈·슬롯 4개 | Task 14~17 |
| §5.2~§5.5 어댑터 매핑 | Task 6~9 |
| §6.1 진단 카탈로그 | Task 5 |
| §6.2 중복 자연키 | Task 5, Task 13 |
| §6.3 조직 해석 | Task 4 |
| §7 트랜잭션 순서 | Task 11, Task 13 |
| §8 오류 처리 | Task 15, Task 17 |
| §9 선행 조치 | Task 1, Task 2, Task 17 |
| §10 테스트 | 모든 태스크 + Task 18 |

**타입 정합** — 태스크 간 이름이 일치하는지 확인했다. `MigrationValidator.overrideKey`는 Task 5에서 정의하고 Task 6·7·15가 같은 형식(`{SheetKind}|{excelRow}|{column}`)으로 쓴다. `OrgIdentityResolver.Index.of(List<CorgnI>, List<CuserI>)` 정적 팩토리는 Task 5 Step 3의 주석에서 요구하고 Task 4의 구현에 추가해야 한다 — **Task 4 Step 4의 `Index` 생성자를 `private`에서 패키지-프라이빗 정적 팩토리로 바꾸는 것을 잊지 않는다.** `AdapterOutput`·`RateIntent`·`PlanIntent`는 Task 6에서 정의하고 Task 7·8·9·11이 소비한다.

**알려진 제약**

1. 정규 컬럼 id 계약이 백엔드·프론트에 손으로 이중 관리된다(`MIG-02`).
2. `MigrationImportServiceTest`가 전산업무비 경로만 목으로 검증한다. 부문계획 품목 교체와 `applyItemRates` 상호작용은 Task 13의 Oracle 통합 테스트가 담당한다 — 목으로는 신뢰성 있게 검증되지 않는다.
3. `PlanService.createPlanForMigration`이 필요한지는 Task 11 Step 5에서 기존 `createPlan`을 읽고 판단한다. 기존 요청 DTO로 스냅샷 필드를 담을 수 있으면 새 메서드를 만들지 않는다.
4. E2E 첫 시나리오는 dev DB의 조직·담당자 데이터에 따라 반영까지 가거나 오류 안내에서 멈춘다. 두 경로 모두 통과로 본다 — 데이터 의존을 없애려면 E2E 전용 시드가 필요하고, 그건 이번 범위를 넘는다.
