# 공통 데이터 이관(개발→운영) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메뉴·메뉴권한·경로·공통코드·다국어 5개 테이블을 개발서버에서 xlsx 1개로 다운로드하고 운영서버에서 dry-run→확정 2단계로 업서트 반영하는 관리자 기능.

**Architecture:** 백엔드는 `domain/migration/commondata/` 패키지에 export(JSON 전량)·dry-run·commit 3개 API를 추가하고, 검증·분류는 순수 Planner, 반영은 JPA 엔티티 경유 서비스가 담당한다(공통코드만 기존 `AdminCodeService.bulkUpsertCodes` 재사용). 프론트는 exceljs로 시트 5개 xlsx를 생성·파싱하고 정규화된 JSON만 서버로 보낸다(금융정보단말기 선례). 메뉴 시퀀스는 커밋 트랜잭션 밖에서 NEXTVAL 소비 루프로 전진시킨다(ALTER SEQUENCE는 DDL implicit commit이라 금지).

**Tech Stack:** Java 25 / Spring Boot 4 / Spring Data JPA (it_backend), Nuxt 4 / Vue 3 / exceljs / Vitest (it_frontend), Oracle Flyway SQL (it_database)

**Spec:** `docs/superpowers/specs/2026-08-29-common-data-migration-design.md`

## Global Constraints

- 세 하위 디렉터리(it_backend, it_frontend, it_database)는 **독립 git 저장소**다. 커밋은 반드시 각 저장소 디렉터리 안에서, 경로를 명시해(`git add <경로>`) 수행한다. `git add -A`/`-a` 금지.
- 신규 JavaDoc·TSDoc·인라인 주석은 한글로 작성한다.
- 엑셀 시트명·헤더는 **한국어 고정**(왕복 양식 규칙, `useAdminCodesPage.ts:284-288` 근거 주석 참조).
- 모든 DB 쓰기는 JPA 엔티티 경유(네이티브 벌크 SQL 금지) — `@LogTarget` 변경로그와 BaseEntity 감사 컬럼 자동 처리를 위해.
- `/api/admin/**`는 SecurityConfig가 이미 hasRole(ADMIN)로 제한하며, 새 컨트롤러에도 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")` 이중 방어를 붙인다.
- 백엔드 검증: `cd C:\it\it_backend; ./gradlew test`. 프론트 검증: `cd C:\it\it_frontend; npm run format:check; npm run check; npm test`.
- `Ccodem`의 Java 필드 `cId`는 JavaBeans 프로퍼티명 문제로 Spring Data 파생 쿼리가 실패한다 — CodeRepository 신규 메서드는 반드시 명시적 JPQL(`@Query`)로 작성(기존 클래스 주석 참조).
- Oracle IN 절은 1000개 제한(ORA-01795) — 다국어 대상키 조회는 900개 단위로 청크 분할한다.
- 신규 운영 `.ts`·`.vue` 파일은 800줄 상한.

---

### Task 1: [BE] 계약 DTO + Export API

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/commondata/dto/CommonDataMigrationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/repository/CodeRepository.java` (findAllActiveOrdered 추가)
- Modify: `it_backend/src/main/java/com/kdb/it/common/i18n/repository/ClangmRepository.java` (findAllActive, findAllByTcIdConeIn 추가)
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/commondata/CommonDataExportService.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/commondata/controller/CommonDataMigrationController.java` (GET /export만; POST는 Task 3에서 추가)
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/commondata/CommonDataExportServiceTest.java`

**Interfaces:**
- Consumes: `CmenumRepository.findAllActive()`, `CmenuaRepository.findAllActive()`, `CmenudRepository.findAllActive()` (기존), 신규 `CodeRepository.findAllActiveOrdered()`, `ClangmRepository.findAllActive()`
- Produces: `CommonDataMigrationDto.{MenuRow, MenuAuthRow, RouteRow, CodeRow, TranslationRow, Request, ExportResponse, TableSummary, Response}` — Task 2~6 전체가 이 record 시그니처에 의존한다.

- [ ] **Step 1: DTO 작성**

```java
package com.kdb.it.domain.migration.commondata.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;

/** 공통 데이터 이관(개발→운영) API 계약입니다. 행 record는 export 응답과 업로드 요청이 공유합니다. */
public final class CommonDataMigrationDto {

    private CommonDataMigrationDto() {}

    /** 메뉴(TPRMPP_CMENUM) 한 행입니다. excelRow는 업로드 파일의 행 번호이며 export 시 0입니다. */
    public record MenuRow(
            int excelRow,
            @NotBlank String mnuId,
            String hrkMnuId,
            @NotBlank String mnuNm,
            @NotBlank String mnuTpC,
            String imkNm,
            String srePth,
            @NotNull Integer mnuSotSqnSno,
            @NotBlank String hidYn,
            @NotNull Integer mnuDep,
            @NotBlank String whlMnuPth) {}

    /** 메뉴권한(TPRMPP_CMENUA) 한 행입니다. */
    public record MenuAuthRow(int excelRow, @NotBlank String mnuId, @NotBlank String athId) {}

    /** 경로 카탈로그(TPRMPP_CMENUD) 한 행입니다. */
    public record RouteRow(
            int excelRow,
            @NotBlank String srePth,
            @NotBlank String sreMnuNm,
            @NotBlank String useYn,
            String rmk) {}

    /** 공통코드(TPRMPP_CCODEM) 한 행입니다. 필드명은 Ccodem 엔티티의 Java 필드명을 따릅니다. */
    public record CodeRow(
            int excelRow,
            @NotBlank String cId,
            @NotBlank String cdva,
            @NotBlank String sttDt,
            String endDt,
            String cNm,
            String cdvaNm,
            String cdvaDes,
            String cdvaDtl,
            String cdvaDtlC,
            String cTp,
            String cTpDes,
            String hrkC,
            Integer cSqn) {}

    /** 다국어(TPRMPP_CLANGM) 한 행입니다. */
    public record TranslationRow(
            int excelRow,
            @NotBlank String tcIdCone,
            @NotBlank String tcColNm,
            @NotBlank String dttLanC,
            @NotBlank String tcDes,
            @NotBlank String dttNm) {}

    /** dry-run과 확정 반영이 공유하는 업로드 요청입니다. 시트가 비어 있어도 목록 자체는 필수입니다. */
    public record Request(
            @NotNull List<@Valid MenuRow> menus,
            @NotNull List<@Valid MenuAuthRow> menuAuths,
            @NotNull List<@Valid RouteRow> routes,
            @NotNull List<@Valid CodeRow> codes,
            @NotNull List<@Valid TranslationRow> translations) {}

    /** 5개 테이블 전량 내보내기 응답입니다. */
    public record ExportResponse(
            List<MenuRow> menus,
            List<MenuAuthRow> menuAuths,
            List<RouteRow> routes,
            List<CodeRow> codes,
            List<TranslationRow> translations) {}

    /** 테이블별 반영(예정) 건수 요약입니다. table은 한국어 시트명(메뉴/메뉴권한/경로/공통코드/다국어)입니다. */
    public record TableSummary(String table, int added, int updated, int restored) {}

    /** dry-run·확정 반영 결과입니다. errors가 비어 있지 않으면 확정 반영은 거부됩니다. */
    public record Response(
            boolean committed,
            List<TableSummary> summaries,
            List<String> warnings,
            List<String> errors) {

        /** 커밋 후 시퀀스 동기화 경고를 덧붙인 사본을 돌려줍니다. */
        public Response withWarning(String warning) {
            List<String> merged = new ArrayList<>(warnings);
            merged.add(warning);
            return new Response(committed, summaries, merged, errors);
        }
    }
}
```

- [ ] **Step 2: 리포지토리 조회 메서드 추가**

`CodeRepository.java`에 추가 (클래스 상단 주석대로 명시적 JPQL 필수):

```java
    /**
     * 활성 공통코드 전량을 조회합니다. 공통 데이터 이관 내보내기가 씁니다.
     *
     * @return 코드ID·코드순서·코드값·시작일자 오름차순의 활성 코드 목록
     */
    @Query(
            "SELECT c FROM Ccodem c WHERE c.delYn = 'N' "
                    + "ORDER BY c.cId ASC, c.cSqn ASC NULLS LAST, c.cdva ASC, c.sttDt ASC")
    List<Ccodem> findAllActiveOrdered();
```

`ClangmRepository.java`에 추가:

```java
    /** 활성 번역 전량을 조회합니다. 공통 데이터 이관 내보내기가 씁니다. */
    @Query(
            "SELECT c FROM Clangm c WHERE c.delYn = 'N' "
                    + "ORDER BY c.dttNm ASC, c.tcIdCone ASC, c.tcColNm ASC, c.dttLanC ASC")
    List<Clangm> findAllActive();

    /**
     * 대상 키 집합의 번역을 논리삭제 행 포함 전량 조회합니다.
     *
     * <p>이관 업서트가 삭제 행을 복원하려면 그 행이 보여야 합니다. 호출자는 Oracle IN 1000개
     * 제한(ORA-01795)을 피하도록 키를 900개 이하로 잘라 호출합니다.
     */
    @Query("SELECT c FROM Clangm c WHERE c.tcIdCone IN :targetKeys")
    List<Clangm> findAllByTcIdConeIn(@Param("targetKeys") Collection<String> targetKeys);
```

- [ ] **Step 3: 실패하는 서비스 테스트 작성**

`CommonDataExportServiceTest.java` — Mockito 스타일은 `TerminalBulkImportServiceTest` 참조:

```java
package com.kdb.it.domain.migration.commondata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CodeRepository;
import com.kdb.it.common.i18n.entity.Clangm;
import com.kdb.it.common.i18n.repository.ClangmRepository;
import com.kdb.it.domain.menu.entity.Cmenua;
import com.kdb.it.domain.menu.entity.Cmenud;
import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import com.kdb.it.domain.menu.repository.CmenudRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import com.kdb.it.domain.migration.commondata.dto.CommonDataMigrationDto;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CommonDataExportServiceTest {

    @Mock private CmenumRepository cmenumRepository;
    @Mock private CmenuaRepository cmenuaRepository;
    @Mock private CmenudRepository cmenudRepository;
    @Mock private CodeRepository codeRepository;
    @Mock private ClangmRepository clangmRepository;

    @Test
    void 활성행전량을_행record로_변환해_내려준다() {
        when(cmenumRepository.findAllActive())
                .thenReturn(
                        List.of(
                                Cmenum.builder()
                                        .mnuId("MNU0000001")
                                        .mnuNm("관리자")
                                        .mnuTpC("GRP")
                                        .mnuSotSqnSno(1)
                                        .hidYn("N")
                                        .mnuDep(1)
                                        .whlMnuPth("/MNU0000001")
                                        .build()));
        when(cmenuaRepository.findAllActive())
                .thenReturn(List.of(Cmenua.builder().mnuId("MNU0000001").athId("ITPAD001").build()));
        when(cmenudRepository.findAllActive())
                .thenReturn(
                        List.of(
                                Cmenud.builder()
                                        .srePth("/admin/menus")
                                        .sreMnuNm("메뉴 관리")
                                        .useYn("Y")
                                        .build()));
        when(codeRepository.findAllActiveOrdered())
                .thenReturn(
                        List.of(
                                Ccodem.builder()
                                        .cId("PRJ_TP")
                                        .cdva("001")
                                        .sttDt("20250101")
                                        .cNm("사업유형")
                                        .build()));
        when(clangmRepository.findAllActive())
                .thenReturn(
                        List.of(
                                Clangm.builder()
                                        .tcIdCone("MNU0000001")
                                        .tcColNm("MNU_NM")
                                        .dttLanC("en")
                                        .tcDes("Admin")
                                        .dttNm("메뉴")
                                        .build()));

        CommonDataExportService service =
                new CommonDataExportService(
                        cmenumRepository,
                        cmenuaRepository,
                        cmenudRepository,
                        codeRepository,
                        clangmRepository);

        CommonDataMigrationDto.ExportResponse response = service.export();

        assertThat(response.menus()).hasSize(1);
        assertThat(response.menus().get(0).mnuId()).isEqualTo("MNU0000001");
        assertThat(response.menuAuths().get(0).athId()).isEqualTo("ITPAD001");
        assertThat(response.routes().get(0).srePth()).isEqualTo("/admin/menus");
        assertThat(response.codes().get(0).cId()).isEqualTo("PRJ_TP");
        assertThat(response.translations().get(0).dttLanC()).isEqualTo("en");
    }
}
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.domain.migration.commondata.CommonDataExportServiceTest'`
Expected: 컴파일 실패 (CommonDataExportService 미존재)

- [ ] **Step 5: Export 서비스 구현**

```java
package com.kdb.it.domain.migration.commondata;

import com.kdb.it.common.code.repository.CodeRepository;
import com.kdb.it.common.i18n.repository.ClangmRepository;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import com.kdb.it.domain.menu.repository.CmenudRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import com.kdb.it.domain.migration.commondata.dto.CommonDataMigrationDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 공통 데이터 5개 테이블(메뉴·메뉴권한·경로·공통코드·다국어)의 활성 행 전량을 이관용 JSON으로 내보냅니다. */
@Service
@RequiredArgsConstructor
public class CommonDataExportService {

    private final CmenumRepository cmenumRepository;
    private final CmenuaRepository cmenuaRepository;
    private final CmenudRepository cmenudRepository;
    private final CodeRepository codeRepository;
    private final ClangmRepository clangmRepository;

    /** 활성(DEL_YN='N') 행 전량을 조회해 행 record 묶음으로 반환합니다. excelRow는 0으로 채웁니다. */
    @Transactional(readOnly = true)
    public CommonDataMigrationDto.ExportResponse export() {
        return new CommonDataMigrationDto.ExportResponse(
                cmenumRepository.findAllActive().stream()
                        .map(
                                m ->
                                        new CommonDataMigrationDto.MenuRow(
                                                0,
                                                m.getMnuId(),
                                                m.getHrkMnuId(),
                                                m.getMnuNm(),
                                                m.getMnuTpC(),
                                                m.getImkNm(),
                                                m.getSrePth(),
                                                m.getMnuSotSqnSno(),
                                                m.getHidYn(),
                                                m.getMnuDep(),
                                                m.getWhlMnuPth()))
                        .toList(),
                cmenuaRepository.findAllActive().stream()
                        .map(
                                a ->
                                        new CommonDataMigrationDto.MenuAuthRow(
                                                0, a.getMnuId(), a.getAthId()))
                        .toList(),
                cmenudRepository.findAllActive().stream()
                        .map(
                                r ->
                                        new CommonDataMigrationDto.RouteRow(
                                                0,
                                                r.getSrePth(),
                                                r.getSreMnuNm(),
                                                r.getUseYn(),
                                                r.getRmk()))
                        .toList(),
                codeRepository.findAllActiveOrdered().stream()
                        .map(
                                c ->
                                        new CommonDataMigrationDto.CodeRow(
                                                0,
                                                c.getCId(),
                                                c.getCdva(),
                                                c.getSttDt(),
                                                c.getEndDt(),
                                                c.getCNm(),
                                                c.getCdvaNm(),
                                                c.getCdvaDes(),
                                                c.getCdvaDtl(),
                                                c.getCdvaDtlC(),
                                                c.getCTp(),
                                                c.getCTpDes(),
                                                c.getHrkC(),
                                                c.getCSqn()))
                        .toList(),
                clangmRepository.findAllActive().stream()
                        .map(
                                t ->
                                        new CommonDataMigrationDto.TranslationRow(
                                                0,
                                                t.getTcIdCone(),
                                                t.getTcColNm(),
                                                t.getDttLanC(),
                                                t.getTcDes(),
                                                t.getDttNm()))
                        .toList());
    }
}
```

주의: Lombok `@Getter`가 `cId`류 필드에 만드는 게터명은 `getCId()`, `getCNm()`, `getCTp()`, `getCTpDes()`, `getCSqn()`이다(기존 `AdminCodeService.toCodeResponse` L337-339와 동일 호출 참조). 컴파일 오류가 나면 그쪽 사용례를 확인한다.

- [ ] **Step 6: 컨트롤러 작성 (GET /export만)**

```java
package com.kdb.it.domain.migration.commondata.controller;

import com.kdb.it.domain.migration.commondata.CommonDataExportService;
import com.kdb.it.domain.migration.commondata.dto.CommonDataMigrationDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 공통 데이터 이관(개발→운영) API입니다. 관리자만 호출할 수 있습니다.
 *
 * <p>{@code /api/admin/**}는 {@code SecurityConfig}에서 이미 {@code hasRole("ADMIN")}로 제한되어 있으므로 클래스 수준
 * {@link PreAuthorize}는 이중 방어입니다.
 */
@Tag(name = "공통 데이터 이관", description = "메뉴·경로·공통코드·다국어 개발→운영 이관")
@RestController
@RequestMapping("/api/admin/migration/common-data")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class CommonDataMigrationController {

    private final CommonDataExportService exportService;

    /** 5개 테이블 활성 행 전량을 내려줍니다. 프론트가 xlsx 파일을 생성합니다. */
    @Operation(summary = "공통 데이터 전량 내보내기", description = "메뉴·메뉴권한·경로·공통코드·다국어 활성 행 전량을 JSON으로 내려줍니다.")
    @GetMapping("/export")
    public ResponseEntity<CommonDataMigrationDto.ExportResponse> export() {
        return ResponseEntity.ok(exportService.export());
    }
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.domain.migration.commondata.*'`
Expected: PASS

- [ ] **Step 8: 커밋 (it_backend 저장소에서)**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/migration/commondata/ src/main/java/com/kdb/it/common/code/repository/CodeRepository.java src/main/java/com/kdb/it/common/i18n/repository/ClangmRepository.java src/test/java/com/kdb/it/domain/migration/commondata/
git diff --cached --stat
git commit -m "feat: 공통 데이터 이관 export API 추가"
```

---

### Task 2: [BE] Planner — 검증·분류 순수 로직

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/commondata/CommonDataMigrationPlanner.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/commondata/CommonDataMigrationPlannerTest.java`

**Interfaces:**
- Consumes: `CommonDataMigrationDto.Request` (Task 1), 엔티티 `Cmenum/Cmenua/Cmenud/Ccodem/Clangm`, `TranslationTarget`(enum, `common/i18n/model`)
- Produces:
  - `CommonDataMigrationPlanner.Snapshot(List<Cmenum> allMenus, List<Cmenua> allMenuAuths, List<Cmenud> allRoutes, List<Ccodem> codesForFileCIds, List<Clangm> translationsForFileKeys, Set<String> athIds)` — 삭제 행 포함 스냅샷 (코드·번역은 파일이 참조하는 키 범위만)
  - `CommonDataMigrationPlanner.Plan(CommonDataMigrationDto.TableSummary menus, ..menuAuths, ..routes, ..codes, ..translations, List<String> warnings, List<String> errors)` + `List<TableSummary> summaries()` 헬퍼
  - `plan(Request request, Snapshot snapshot)` — 저장 없이 검증·분류만 수행. Task 3의 서비스가 dry-run과 commit 양쪽에서 호출한다.

**분류 규칙 (모든 테이블 공통):** 스냅샷에 같은 PK가 없으면 `added`, 있는데 `delYn='Y'`면 `restored`, 활성이면 `updated`.

**오류 규칙 (spec §7):** ① 필수값 누락(어노테이션 검증 외 추가로 planner에서도 안전망), ② `mnuTpC`∉{GRP,LNK,PGE}, ③ `hidYn`/`useYn`∉{Y,N}, ④ `mnuDep`∉1..4, ⑤ `dttLanC` 길이≠2, ⑥ 다국어 구분명↔컬럼명 조합이 `TranslationTarget` 규칙 위반(구분명이 메뉴/공통코드 둘 다 아니면 그것도 오류), ⑦ 메뉴의 `hrkMnuId`가 파일 메뉴에도 스냅샷 활성 메뉴에도 없음, ⑧ 메뉴권한 `athId`가 `snapshot.athIds()`에 없음, ⑨ 메뉴권한 `mnuId`가 파일 메뉴에도 스냅샷 활성 메뉴에도 없음, ⑩ 시트 내 PK 중복(5개 시트 각각), ⑪ 메뉴 행 ≥1건인데 메뉴권한 행 0건.

**경고 규칙 (spec §7):** ① 같은 `mnuId`의 스냅샷 활성 행과 `srePth` 또는 `mnuNm`이 다름(운영 독자 메뉴 덮어쓰기 가능성), ② 다국어 대상키(구분명=메뉴)가 파일 메뉴에도 스냅샷 활성 메뉴에도 없음, ③ PGE 메뉴의 `srePth`가 경로 시트에도 스냅샷 활성 카탈로그에도 없음.

메시지 형식: `"메뉴 시트 12행: 메뉴유형은 GRP/LNK/PGE만 허용합니다 (값: XXX)"` — 시트명·excelRow 포함.

- [ ] **Step 1: 실패하는 테스트 작성 (핵심 케이스부터)**

```java
package com.kdb.it.domain.migration.commondata;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.i18n.entity.Clangm;
import com.kdb.it.domain.menu.entity.Cmenua;
import com.kdb.it.domain.menu.entity.Cmenud;
import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.migration.commondata.dto.CommonDataMigrationDto;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CommonDataMigrationPlannerTest {

    private final CommonDataMigrationPlanner planner = new CommonDataMigrationPlanner();

    private static CommonDataMigrationPlanner.Snapshot emptySnapshot() {
        return new CommonDataMigrationPlanner.Snapshot(
                List.of(), List.of(), List.of(), List.of(), List.of(), Set.of("ITPAD001"));
    }

    private static CommonDataMigrationDto.MenuRow menuRow(String mnuId, String hrkMnuId) {
        return new CommonDataMigrationDto.MenuRow(
                2, mnuId, hrkMnuId, "메뉴명", "PGE", null, "/admin/menus", 1, "N", 1,
                "/" + mnuId);
    }

    @Test
    void 스냅샷에없는행은_added로_분류한다() {
        CommonDataMigrationDto.Request request =
                new CommonDataMigrationDto.Request(
                        List.of(menuRow("MNU0000001", null)),
                        List.of(new CommonDataMigrationDto.MenuAuthRow(2, "MNU0000001", "ITPAD001")),
                        List.of(
                                new CommonDataMigrationDto.RouteRow(
                                        2, "/admin/menus", "메뉴 관리", "Y", null)),
                        List.of(),
                        List.of());

        CommonDataMigrationPlanner.Plan plan = planner.plan(request, emptySnapshot());

        assertThat(plan.errors()).isEmpty();
        assertThat(plan.menus().added()).isEqualTo(1);
        assertThat(plan.menuAuths().added()).isEqualTo(1);
        assertThat(plan.routes().added()).isEqualTo(1);
    }

    @Test
    void 논리삭제행은_restored_활성행은_updated로_분류한다() {
        Cmenud deleted =
                Cmenud.builder().srePth("/admin/menus").sreMnuNm("메뉴 관리").useYn("Y").build();
        deleted.delete();
        Cmenud active =
                Cmenud.builder().srePth("/admin/codes").sreMnuNm("코드 관리").useYn("Y").build();
        active.restore();
        CommonDataMigrationPlanner.Snapshot snapshot =
                new CommonDataMigrationPlanner.Snapshot(
                        List.of(), List.of(), List.of(deleted, active), List.of(), List.of(),
                        Set.of("ITPAD001"));
        CommonDataMigrationDto.Request request =
                new CommonDataMigrationDto.Request(
                        List.of(),
                        List.of(),
                        List.of(
                                new CommonDataMigrationDto.RouteRow(
                                        2, "/admin/menus", "메뉴 관리", "Y", null),
                                new CommonDataMigrationDto.RouteRow(
                                        3, "/admin/codes", "코드 관리", "Y", null)),
                        List.of(),
                        List.of());

        CommonDataMigrationPlanner.Plan plan = planner.plan(request, snapshot);

        assertThat(plan.routes().restored()).isEqualTo(1);
        assertThat(plan.routes().updated()).isEqualTo(1);
    }

    @Test
    void 메뉴만있고_메뉴권한이비면_오류다() {
        CommonDataMigrationDto.Request request =
                new CommonDataMigrationDto.Request(
                        List.of(menuRow("MNU0000001", null)),
                        List.of(),
                        List.of(
                                new CommonDataMigrationDto.RouteRow(
                                        2, "/admin/menus", "메뉴 관리", "Y", null)),
                        List.of(),
                        List.of());

        CommonDataMigrationPlanner.Plan plan = planner.plan(request, emptySnapshot());

        assertThat(plan.errors()).anySatisfy(e -> assertThat(e).contains("메뉴권한"));
    }

    @Test
    void 상위메뉴가_파일과운영어디에도없으면_오류다() {
        CommonDataMigrationDto.Request request =
                new CommonDataMigrationDto.Request(
                        List.of(menuRow("MNU0000002", "MNU9999999")),
                        List.of(new CommonDataMigrationDto.MenuAuthRow(2, "MNU0000002", "ITPAD001")),
                        List.of(
                                new CommonDataMigrationDto.RouteRow(
                                        2, "/admin/menus", "메뉴 관리", "Y", null)),
                        List.of(),
                        List.of());

        CommonDataMigrationPlanner.Plan plan = planner.plan(request, emptySnapshot());

        assertThat(plan.errors()).anySatisfy(e -> assertThat(e).contains("상위메뉴"));
    }

    @Test
    void 다국어_구분명과컬럼명조합이_규칙위반이면_오류다() {
        CommonDataMigrationDto.Request request =
                new CommonDataMigrationDto.Request(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(
                                new CommonDataMigrationDto.TranslationRow(
                                        2, "MNU0000001", "CO_C_NM", "en", "Admin", "메뉴")));

        CommonDataMigrationPlanner.Plan plan = planner.plan(request, emptySnapshot());

        assertThat(plan.errors()).anySatisfy(e -> assertThat(e).contains("컬럼"));
    }

    @Test
    void 같은메뉴ID인데_경로나이름이다르면_경고한다() {
        Cmenum existing = Cmenum.builder()
                .mnuId("MNU0000001").mnuNm("다른이름").mnuTpC("PGE").srePth("/other")
                .mnuSotSqnSno(1).hidYn("N").mnuDep(1).whlMnuPth("/MNU0000001").build();
        existing.restore();
        CommonDataMigrationPlanner.Snapshot snapshot =
                new CommonDataMigrationPlanner.Snapshot(
                        List.of(existing), List.of(), List.of(), List.of(), List.of(),
                        Set.of("ITPAD001"));
        CommonDataMigrationDto.Request request =
                new CommonDataMigrationDto.Request(
                        List.of(menuRow("MNU0000001", null)),
                        List.of(new CommonDataMigrationDto.MenuAuthRow(2, "MNU0000001", "ITPAD001")),
                        List.of(
                                new CommonDataMigrationDto.RouteRow(
                                        2, "/admin/menus", "메뉴 관리", "Y", null)),
                        List.of(),
                        List.of());

        CommonDataMigrationPlanner.Plan plan = planner.plan(request, snapshot);

        assertThat(plan.errors()).isEmpty();
        assertThat(plan.warnings()).anySatisfy(w -> assertThat(w).contains("MNU0000001"));
    }

    @Test
    void 시트내PK중복은_오류다() {
        CommonDataMigrationDto.Request request =
                new CommonDataMigrationDto.Request(
                        List.of(),
                        List.of(),
                        List.of(
                                new CommonDataMigrationDto.RouteRow(2, "/a", "가", "Y", null),
                                new CommonDataMigrationDto.RouteRow(3, "/a", "나", "Y", null)),
                        List.of(),
                        List.of());

        CommonDataMigrationPlanner.Plan plan = planner.plan(request, emptySnapshot());

        assertThat(plan.errors()).anySatisfy(e -> assertThat(e).contains("중복"));
    }
}
```

추가로 다음 케이스도 같은 파일에 작성한다 (각각 3~10줄, 위 패턴 반복):
- `메뉴유형이_허용값밖이면_오류다` (`mnuTpC="XXX"` → errors에 "메뉴유형")
- `숨김여부가_YN이아니면_오류다` / `사용여부가_YN이아니면_오류다`
- `메뉴깊이가_범위밖이면_오류다` (`mnuDep=5`)
- `언어코드가_2자가아니면_오류다` (`dttLanC="eng"`)
- `메뉴권한의_자격등급이없으면_오류다` (`athId="NOPE"`)
- `메뉴권한의_메뉴가없으면_오류다`
- `공통코드는_added_restored_updated를_센다` (Ccodem 스냅샷 이용, `AdminCodeService`와 같은 기준: 신규/삭제행부활/활성갱신)
- `다국어대상키가_메뉴에없으면_경고한다` (구분명=메뉴, tcIdCone이 어디에도 없음 → warnings)
- `PGE메뉴경로가_카탈로그에없으면_경고한다`

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.domain.migration.commondata.CommonDataMigrationPlannerTest'`
Expected: 컴파일 실패 (Planner 미존재)

- [ ] **Step 3: Planner 구현**

구현 골격 (Spring 의존 없는 순수 클래스 + `@Component`):

```java
package com.kdb.it.domain.migration.commondata;

import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.i18n.entity.Clangm;
import com.kdb.it.common.i18n.model.TranslationTarget;
import com.kdb.it.domain.menu.entity.Cmenua;
import com.kdb.it.domain.menu.entity.Cmenud;
import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.migration.commondata.dto.CommonDataMigrationDto;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/** 공통 데이터 이관 요청을 저장 없이 검증하고 테이블별 추가/갱신/부활 건수로 분류합니다. */
@Component
public class CommonDataMigrationPlanner {

    private static final Set<String> MENU_TYPES = Set.of("GRP", "LNK", "PGE");
    private static final Set<String> YN = Set.of("Y", "N");

    /** 삭제 행을 포함한 현재 DB 상태 스냅샷입니다. 코드·번역은 파일이 참조하는 키 범위만 담습니다. */
    public record Snapshot(
            List<Cmenum> allMenus,
            List<Cmenua> allMenuAuths,
            List<Cmenud> allRoutes,
            List<Ccodem> codesForFileCIds,
            List<Clangm> translationsForFileKeys,
            Set<String> athIds) {}

    /** 검증·분류 결과입니다. errors가 비어 있지 않으면 확정 반영을 차단해야 합니다. */
    public record Plan(
            CommonDataMigrationDto.TableSummary menus,
            CommonDataMigrationDto.TableSummary menuAuths,
            CommonDataMigrationDto.TableSummary routes,
            CommonDataMigrationDto.TableSummary codes,
            CommonDataMigrationDto.TableSummary translations,
            List<String> warnings,
            List<String> errors) {

        public List<CommonDataMigrationDto.TableSummary> summaries() {
            return List.of(menus, menuAuths, routes, codes, translations);
        }
    }

    public Plan plan(CommonDataMigrationDto.Request request, Snapshot snapshot) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        // 1) 시트 내 PK 중복 검사 (시트별 키 함수로 공통화)
        // 2) 허용값 검사 (MENU_TYPES, YN, mnuDep 1..4, dttLanC 길이 2)
        // 3) 참조 무결성: 상위메뉴·메뉴권한 메뉴·자격등급
        // 4) 다국어 구분명→TranslationTarget 매핑(dbName 비교) + validateColumn (IllegalArgumentException은 잡아 오류 문자열로)
        // 5) 메뉴 ≥1 && 메뉴권한 0 → 오류
        // 6) 경고: 메뉴 충돌·다국어 고아 키·PGE 경로 누락
        // 7) 분류: 스냅샷 맵(키→delYn)과 대조해 added/restored/updated 카운트
        ...
        return new Plan(...);
    }
}
```

분류 카운트 헬퍼는 `Map<K, String>`(키→delYn)을 만들어 시트 행마다 없으면 added, "Y"면 restored, "N"이면 updated로 센다. 키:
- 메뉴 `mnuId` / 경로 `srePth` / 메뉴권한 `mnuId + "\u0000" + athId` / 코드 `cId+"\u0000"+cdva+"\u0000"+sttDt` / 다국어 `tcIdCone+"\u0000"+tcColNm+"\u0000"+dttLanC`

`TranslationTarget` 매핑: `구분명 "메뉴" → TranslationTarget.MENU`, `"공통코드" → COMMON_CODE` (dbName() 비교로 찾고, 못 찾으면 오류).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.domain.migration.commondata.CommonDataMigrationPlannerTest'`
Expected: PASS (전 케이스)

- [ ] **Step 5: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/migration/commondata/CommonDataMigrationPlanner.java src/test/java/com/kdb/it/domain/migration/commondata/CommonDataMigrationPlannerTest.java
git diff --cached --stat
git commit -m "feat: 공통 데이터 이관 검증·분류 Planner 추가"
```

---

### Task 3: [BE] dry-run/commit 서비스 + 시퀀스 동기화 + POST 엔드포인트

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/commondata/CommonDataMigrationService.java`
- Create: `it_backend/src/main/java/com/kdb/it/domain/migration/commondata/MenuSequenceSynchronizer.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/entity/Cmenud.java` (updateForMigration 추가)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/migration/commondata/controller/CommonDataMigrationController.java` (POST 2본 추가)
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/commondata/CommonDataMigrationServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/commondata/MenuSequenceSynchronizerTest.java`

**Interfaces:**
- Consumes: `CommonDataMigrationPlanner.plan(Request, Snapshot)` (Task 2), `AdminCodeService.bulkUpsertCodes(AdminDto.BulkCodeRequest)` (기존, `common/admin/service`), `AuthRepository.findAll()` (기존, `common/iam/repository` — `CauthI` 엔티티의 ID getter는 파일을 열어 확인: `getAthId()` 유사), `ClangmRepository.findAllByTcIdConeIn` (Task 1)
- Produces:
  - `CommonDataMigrationService.dryRun(Request): Response` / `commit(Request): Response` — errors 존재 시 commit은 `IllegalArgumentException` (GlobalExceptionHandler가 400 매핑)
  - `MenuSequenceSynchronizer.advanceTo(List<MenuRow>): Optional<String>` — 커밋 트랜잭션 밖에서 호출, 실패·미완료 시 경고 문자열 반환
  - `POST /api/admin/migration/common-data/dry-run` (200), `POST /api/admin/migration/common-data` (201)

- [ ] **Step 1: 실패하는 서비스 테스트 작성**

Mockito 스타일 (`TerminalBulkImportServiceTest` 참조). 핵심 케이스:

```java
package com.kdb.it.domain.migration.commondata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kdb.it.common.admin.dto.AdminDto;
import com.kdb.it.common.admin.service.AdminCodeService;
import com.kdb.it.common.code.repository.CodeRepository;
import com.kdb.it.common.i18n.repository.ClangmRepository;
import com.kdb.it.common.iam.repository.AuthRepository;
import com.kdb.it.domain.menu.entity.Cmenud;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import com.kdb.it.domain.menu.repository.CmenudRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import com.kdb.it.domain.migration.commondata.dto.CommonDataMigrationDto;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CommonDataMigrationServiceTest {

    @Mock private CmenumRepository cmenumRepository;
    @Mock private CmenuaRepository cmenuaRepository;
    @Mock private CmenudRepository cmenudRepository;
    @Mock private CodeRepository codeRepository;
    @Mock private ClangmRepository clangmRepository;
    @Mock private AuthRepository authRepository;
    @Mock private AdminCodeService adminCodeService;

    private CommonDataMigrationService service() {
        return new CommonDataMigrationService(
                new CommonDataMigrationPlanner(),
                cmenumRepository,
                cmenuaRepository,
                cmenudRepository,
                codeRepository,
                clangmRepository,
                authRepository,
                adminCodeService);
    }

    private static CommonDataMigrationDto.Request routeOnlyRequest() {
        return new CommonDataMigrationDto.Request(
                List.of(),
                List.of(),
                List.of(new CommonDataMigrationDto.RouteRow(2, "/admin/menus", "메뉴 관리", "Y", null)),
                List.of(),
                List.of());
    }

    @Test
    void dryRun은_저장하지않고_요약만돌려준다() {
        stubEmptySnapshot();

        CommonDataMigrationDto.Response response = service().dryRun(routeOnlyRequest());

        assertThat(response.committed()).isFalse();
        assertThat(summaryOf(response, "경로").added()).isEqualTo(1);
        verify(cmenudRepository, never()).saveAll(any());
        verify(adminCodeService, never()).bulkUpsertCodes(any());
    }

    @Test
    void commit은_신규경로를_저장한다() {
        stubEmptySnapshot();

        CommonDataMigrationDto.Response response = service().commit(routeOnlyRequest());

        assertThat(response.committed()).isTrue();
        verify(cmenudRepository).saveAll(any());
    }

    @Test
    void commit은_삭제된경로를_부활시킨다() {
        Cmenud deleted =
                Cmenud.builder().srePth("/admin/menus").sreMnuNm("옛이름").useYn("N").build();
        deleted.delete();
        stubEmptySnapshot();
        when(cmenudRepository.findAll()).thenReturn(List.of(deleted));

        service().commit(routeOnlyRequest());

        assertThat(deleted.getDelYn()).isEqualTo("N");
        assertThat(deleted.getSreMnuNm()).isEqualTo("메뉴 관리");
        assertThat(deleted.getUseYn()).isEqualTo("Y");
    }

    @Test
    void commit은_공통코드를_AdminCodeService에위임한다() {
        stubEmptySnapshot();
        when(adminCodeService.bulkUpsertCodes(any()))
                .thenReturn(Map.of("created", 1, "updated", 0));
        CommonDataMigrationDto.Request request =
                new CommonDataMigrationDto.Request(
                        List.of(), List.of(), List.of(),
                        List.of(
                                new CommonDataMigrationDto.CodeRow(
                                        2, "PRJ_TP", "001", "20250101", null, "사업유형", "신규",
                                        null, null, null, null, null, null, 1)),
                        List.of());

        service().commit(request);

        verify(adminCodeService).bulkUpsertCodes(any(AdminDto.BulkCodeRequest.class));
    }

    @Test
    void 오류가있으면_commit은_거부한다() {
        stubEmptySnapshot();
        CommonDataMigrationDto.Request menusWithoutAuths =
                new CommonDataMigrationDto.Request(
                        List.of(
                                new CommonDataMigrationDto.MenuRow(
                                        2, "MNU0000001", null, "메뉴", "GRP", null, null, 1, "N", 1,
                                        "/MNU0000001")),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        assertThatThrownBy(() -> service().commit(menusWithoutAuths))
                .isInstanceOf(IllegalArgumentException.class);
        verify(cmenumRepository, never()).saveAll(any());
    }

    private void stubEmptySnapshot() {
        // 코드·번역 조회는 파일에 해당 행이 있을 때만 호출되므로 lenient로 선언해
        // Mockito strict stubbing(UnnecessaryStubbingException)을 피한다.
        lenient().when(cmenumRepository.findAll()).thenReturn(List.of());
        lenient().when(cmenuaRepository.findAll()).thenReturn(List.of());
        lenient().when(cmenudRepository.findAll()).thenReturn(List.of());
        lenient().when(codeRepository.findAllByCIdIn(anyCollection())).thenReturn(List.of());
        lenient()
                .when(clangmRepository.findAllByTcIdConeIn(anyCollection()))
                .thenReturn(List.of());
        lenient().when(authRepository.findAll()).thenReturn(List.of());
    }

    private static CommonDataMigrationDto.TableSummary summaryOf(
            CommonDataMigrationDto.Response response, String table) {
        return response.summaries().stream()
                .filter(s -> s.table().equals(table))
                .findFirst()
                .orElseThrow();
    }
}
```

주의: `stubEmptySnapshot()`의 코드·번역 stub은 파일에 해당 행이 없으면 호출되지 않을 수 있다. Mockito strict stubbing(UnnecessaryStubbingException)이 나면 스냅샷 로딩을 "파일에 행이 있을 때만 조회"로 구현했다는 뜻이므로, 해당 stub을 각 테스트로 옮기거나 `lenient()`를 쓴다. 추가 케이스: `commit은_신규메뉴와_메뉴권한을_저장한다`, `commit은_다국어를_update로_갱신하고_부활시킨다`(Clangm.update(tcDes)가 restore까지 하는 것 검증), `빈요청은_아무것도저장하지않는다`.

- [ ] **Step 2: 실패 확인**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.domain.migration.commondata.CommonDataMigrationServiceTest'`
Expected: 컴파일 실패

- [ ] **Step 3: Cmenud에 갱신 메서드 추가**

```java
    /**
     * 이관 업서트로 화면메뉴명·사용여부·비고를 한 번에 갱신합니다.
     *
     * @param sreMnuNm 화면메뉴명 (필수)
     * @param useYn 사용여부 Y/N (필수)
     * @param rmk 비고 (준비중 화면 안내문구로 사용자에게 노출되므로 내부 메모 금지)
     */
    public void updateForMigration(String sreMnuNm, String useYn, String rmk) {
        this.sreMnuNm = sreMnuNm;
        this.useYn = useYn;
        this.rmk = rmk;
    }
```

- [ ] **Step 4: 서비스 구현**

```java
package com.kdb.it.domain.migration.commondata;

import com.kdb.it.common.admin.dto.AdminDto;
import com.kdb.it.common.admin.service.AdminCodeService;
import com.kdb.it.common.code.repository.CodeRepository;
import com.kdb.it.common.i18n.entity.Clangm;
import com.kdb.it.common.i18n.repository.ClangmRepository;
import com.kdb.it.common.iam.repository.AuthRepository;
import com.kdb.it.domain.menu.entity.Cmenua;
import com.kdb.it.domain.menu.entity.Cmenud;
import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.menu.repository.CmenuaRepository;
import com.kdb.it.domain.menu.repository.CmenudRepository;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import com.kdb.it.domain.migration.commondata.dto.CommonDataMigrationDto;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공통 데이터 이관 업로드를 검증(dry-run)하고 단일 트랜잭션으로 업서트(commit)합니다.
 *
 * <p>반영 순서는 참조 무결성을 따릅니다: 경로 → 메뉴 → 메뉴권한 → 공통코드 → 다국어. 모든 쓰기는 JPA 엔티티
 * 경유이므로 {@code @LogTarget} 변경로그와 BaseEntity 감사 컬럼이 자동으로 채워집니다.
 */
@Service
@RequiredArgsConstructor
public class CommonDataMigrationService {

    /** 다국어 대상키 IN 조회 청크 크기. Oracle IN 1000개 제한(ORA-01795) 회피용. */
    private static final int KEY_CHUNK_SIZE = 900;

    private final CommonDataMigrationPlanner planner;
    private final CmenumRepository cmenumRepository;
    private final CmenuaRepository cmenuaRepository;
    private final CmenudRepository cmenudRepository;
    private final CodeRepository codeRepository;
    private final ClangmRepository clangmRepository;
    private final AuthRepository authRepository;
    private final AdminCodeService adminCodeService;

    /** 저장 없이 검증·분류 요약만 반환합니다. */
    @Transactional(readOnly = true)
    public CommonDataMigrationDto.Response dryRun(CommonDataMigrationDto.Request request) {
        CommonDataMigrationPlanner.Plan plan = planner.plan(request, loadSnapshot(request));
        return new CommonDataMigrationDto.Response(
                false, plan.summaries(), plan.warnings(), plan.errors());
    }

    /**
     * dry-run과 같은 검증을 재수행한 뒤 5개 테이블을 하나의 트랜잭션으로 업서트합니다.
     *
     * @throws IllegalArgumentException 검증 오류가 1건이라도 있는 경우 (400)
     */
    @Transactional
    @CacheEvict(value = "menuAuthMap", allEntries = true)
    public CommonDataMigrationDto.Response commit(CommonDataMigrationDto.Request request) {
        CommonDataMigrationPlanner.Snapshot snapshot = loadSnapshot(request);
        CommonDataMigrationPlanner.Plan plan = planner.plan(request, snapshot);
        if (!plan.errors().isEmpty()) {
            throw new IllegalArgumentException(
                    "검증 오류가 있어 반영할 수 없습니다: " + String.join(" / ", plan.errors()));
        }
        applyRoutes(request.routes(), snapshot.allRoutes());
        applyMenus(request.menus(), snapshot.allMenus());
        applyMenuAuths(request.menuAuths(), snapshot.allMenuAuths());
        applyCodes(request.codes());
        applyTranslations(request.translations(), snapshot.translationsForFileKeys());
        return new CommonDataMigrationDto.Response(
                true, plan.summaries(), plan.warnings(), plan.errors());
    }

    /** 삭제 행 포함 현재 상태를 읽습니다. 메뉴·권한·경로는 소형 테이블이라 전량, 코드·번역은 파일 참조 키만 읽습니다. */
    private CommonDataMigrationPlanner.Snapshot loadSnapshot(
            CommonDataMigrationDto.Request request) {
        Set<String> fileCIds =
                request.codes().stream()
                        .map(CommonDataMigrationDto.CodeRow::cId)
                        .collect(Collectors.toSet());
        return new CommonDataMigrationPlanner.Snapshot(
                cmenumRepository.findAll(),
                cmenuaRepository.findAll(),
                cmenudRepository.findAll(),
                fileCIds.isEmpty() ? List.of() : codeRepository.findAllByCIdIn(fileCIds),
                loadTranslationsChunked(request.translations()),
                authRepository.findAll().stream()
                        .map(auth -> auth.getAthId())
                        .collect(Collectors.toSet()));
    }

    private List<Clangm> loadTranslationsChunked(
            List<CommonDataMigrationDto.TranslationRow> rows) {
        List<String> keys =
                rows.stream()
                        .map(CommonDataMigrationDto.TranslationRow::tcIdCone)
                        .distinct()
                        .toList();
        List<Clangm> result = new ArrayList<>();
        for (int i = 0; i < keys.size(); i += KEY_CHUNK_SIZE) {
            result.addAll(
                    clangmRepository.findAllByTcIdConeIn(
                            keys.subList(i, Math.min(i + KEY_CHUNK_SIZE, keys.size()))));
        }
        return result;
    }

    private void applyRoutes(List<CommonDataMigrationDto.RouteRow> rows, List<Cmenud> existing) {
        Map<String, Cmenud> byPath = new HashMap<>();
        existing.forEach(r -> byPath.put(r.getSrePth(), r));
        List<Cmenud> created = new ArrayList<>();
        for (CommonDataMigrationDto.RouteRow row : rows) {
            Cmenud found = byPath.get(row.srePth());
            if (found == null) {
                created.add(
                        Cmenud.builder()
                                .srePth(row.srePth())
                                .sreMnuNm(row.sreMnuNm())
                                .useYn(row.useYn())
                                .rmk(row.rmk())
                                .build());
            } else {
                found.updateForMigration(row.sreMnuNm(), row.useYn(), row.rmk());
                found.restore();
            }
        }
        cmenudRepository.saveAll(created);
    }

    private void applyMenus(List<CommonDataMigrationDto.MenuRow> rows, List<Cmenum> existing) {
        Map<String, Cmenum> byId = new HashMap<>();
        existing.forEach(m -> byId.put(m.getMnuId(), m));
        List<Cmenum> created = new ArrayList<>();
        for (CommonDataMigrationDto.MenuRow row : rows) {
            Cmenum found = byId.get(row.mnuId());
            if (found == null) {
                created.add(
                        Cmenum.builder()
                                .mnuId(row.mnuId())
                                .hrkMnuId(row.hrkMnuId())
                                .mnuNm(row.mnuNm())
                                .mnuTpC(row.mnuTpC())
                                .imkNm(row.imkNm())
                                .srePth(row.srePth())
                                .mnuSotSqnSno(row.mnuSotSqnSno())
                                .hidYn(row.hidYn())
                                .mnuDep(row.mnuDep())
                                .whlMnuPth(row.whlMnuPth())
                                .build());
            } else {
                // Cmenum은 @Setter가 열려 있는 기존 계약을 그대로 사용한다.
                found.setHrkMnuId(row.hrkMnuId());
                found.setMnuNm(row.mnuNm());
                found.setMnuTpC(row.mnuTpC());
                found.setImkNm(row.imkNm());
                found.setSrePth(row.srePth());
                found.setMnuSotSqnSno(row.mnuSotSqnSno());
                found.setHidYn(row.hidYn());
                found.setMnuDep(row.mnuDep());
                found.setWhlMnuPth(row.whlMnuPth());
                found.restore();
            }
        }
        cmenumRepository.saveAll(created);
    }

    private void applyMenuAuths(
            List<CommonDataMigrationDto.MenuAuthRow> rows, List<Cmenua> existing) {
        Map<String, Cmenua> byKey = new HashMap<>();
        existing.forEach(a -> byKey.put(a.getMnuId() + "\u0000" + a.getAthId(), a));
        List<Cmenua> created = new ArrayList<>();
        for (CommonDataMigrationDto.MenuAuthRow row : rows) {
            Cmenua found = byKey.get(row.mnuId() + "\u0000" + row.athId());
            if (found == null) {
                created.add(Cmenua.builder().mnuId(row.mnuId()).athId(row.athId()).build());
            } else {
                found.restore();
            }
        }
        cmenuaRepository.saveAll(created);
    }

    /** 공통코드는 기존 일괄 업서트를 재사용해 부활·GUID·코드캐시 evict 처리를 물려받습니다. */
    private void applyCodes(List<CommonDataMigrationDto.CodeRow> rows) {
        if (rows.isEmpty()) {
            return;
        }
        List<AdminDto.CodeRequest> codes =
                rows.stream()
                        .map(
                                row ->
                                        new AdminDto.CodeRequest(
                                                row.cId(),
                                                row.cdva(),
                                                row.cNm(),
                                                row.cdvaNm(),
                                                row.cdvaDes(),
                                                row.cdvaDtl(),
                                                row.cdvaDtlC(),
                                                row.cTp(),
                                                row.cTpDes(),
                                                row.hrkC(),
                                                row.sttDt(),
                                                row.endDt(),
                                                row.cSqn()))
                        .toList();
        adminCodeService.bulkUpsertCodes(new AdminDto.BulkCodeRequest(codes));
    }

    private void applyTranslations(
            List<CommonDataMigrationDto.TranslationRow> rows, List<Clangm> existing) {
        Map<String, Clangm> byKey = new HashMap<>();
        existing.forEach(
                t ->
                        byKey.put(
                                t.getTcIdCone() + "\u0000" + t.getTcColNm() + "\u0000"
                                        + t.getDttLanC(),
                                t));
        List<Clangm> created = new ArrayList<>();
        for (CommonDataMigrationDto.TranslationRow row : rows) {
            Clangm found =
                    byKey.get(row.tcIdCone() + "\u0000" + row.tcColNm() + "\u0000" + row.dttLanC());
            if (found == null) {
                created.add(
                        Clangm.builder()
                                .tcIdCone(row.tcIdCone())
                                .tcColNm(row.tcColNm())
                                .dttLanC(row.dttLanC())
                                .tcDes(row.tcDes())
                                .dttNm(row.dttNm())
                                .build());
            } else {
                // update()가 번역 문구 갱신과 논리삭제 복원을 함께 수행한다.
                found.update(row.tcDes());
            }
        }
        clangmRepository.saveAll(created);
    }
}
```

주의 1: `AuthRepository`의 엔티티 `CauthI`의 ID getter 이름은 파일(`common/iam/entity/CauthI.java`)을 열어 확인하고 맞춘다.
주의 2: 관리 엔티티(existing)의 변경은 더티체킹으로 flush되므로 `saveAll`은 신규만 담는다.
주의 3: `AdminCodeService.bulkUpsertCodes`는 외부 빈 호출이므로 `@CacheEvict(codesByCid·budgetPeriod)` 프록시가 정상 동작한다. 메뉴권한 캐시는 이 서비스의 `commit`에 붙인 `@CacheEvict(value = "menuAuthMap")`이 무효화한다(선례: `AdminMenuService`).

- [ ] **Step 5: MenuSequenceSynchronizer 테스트 작성 → 실패 확인 → 구현**

테스트:

```java
package com.kdb.it.domain.migration.commondata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kdb.it.domain.migration.commondata.dto.CommonDataMigrationDto;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

@ExtendWith(MockitoExtension.class)
class MenuSequenceSynchronizerTest {

    @Mock private JdbcTemplate jdbcTemplate;

    private static CommonDataMigrationDto.MenuRow menu(String mnuId) {
        return new CommonDataMigrationDto.MenuRow(
                0, mnuId, null, "메뉴", "GRP", null, null, 1, "N", 1, "/" + mnuId);
    }

    @Test
    void 파일최대번호이상이될때까지_NEXTVAL을소비한다() {
        AtomicLong seq = new AtomicLong(20);
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class)))
                .thenAnswer(inv -> seq.incrementAndGet());
        MenuSequenceSynchronizer synchronizer = new MenuSequenceSynchronizer(jdbcTemplate);

        var warning = synchronizer.advanceTo(List.of(menu("MNU0000023"), menu("MNU0000005")));

        assertThat(warning).isEmpty();
        assertThat(seq.get()).isEqualTo(23);
    }

    @Test
    void 이관대상메뉴가없으면_시퀀스를건드리지않는다() {
        MenuSequenceSynchronizer synchronizer = new MenuSequenceSynchronizer(jdbcTemplate);

        var warning = synchronizer.advanceTo(List.of());

        assertThat(warning).isEmpty();
        verify(jdbcTemplate, never()).queryForObject(anyString(), eq(Long.class));
    }

    @Test
    void MNU형식이아닌ID는_무시한다() {
        MenuSequenceSynchronizer synchronizer = new MenuSequenceSynchronizer(jdbcTemplate);

        var warning = synchronizer.advanceTo(List.of(menu("0000001"), menu("LEGACY")));

        assertThat(warning).isEmpty();
        verify(jdbcTemplate, never()).queryForObject(anyString(), eq(Long.class));
    }

    @Test
    void 조회실패시_예외대신경고를돌려준다() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class)))
                .thenThrow(new RuntimeException("DB down"));
        MenuSequenceSynchronizer synchronizer = new MenuSequenceSynchronizer(jdbcTemplate);

        var warning = synchronizer.advanceTo(List.of(menu("MNU0000023")));

        assertThat(warning).isPresent();
        assertThat(warning.get()).contains("시퀀스");
    }
}
```

구현:

```java
package com.kdb.it.domain.migration.commondata;

import com.kdb.it.domain.migration.commondata.dto.CommonDataMigrationDto;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * 메뉴 이관 후 {@code SQ_TPRMPP_CMENUM_1}을 파일 최대 메뉴 번호 이상으로 전진시킵니다.
 *
 * <p>ALTER SEQUENCE는 DDL이라 implicit commit으로 이관 트랜잭션의 원자성을 깨뜨리므로 쓰지 않고, NEXTVAL을
 * 반복 소비해 전진시킵니다(ITPAPP 계정은 시퀀스 SELECT 권한만으로 충분). 반드시 커밋 트랜잭션 밖에서 호출합니다.
 * 전진 실패는 이관 자체를 되돌릴 이유가 아니므로 예외 대신 경고 문자열을 반환합니다.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MenuSequenceSynchronizer {

    private static final Pattern MNU_ID_PATTERN = Pattern.compile("^MNU(\\d{7})$");
    private static final String NEXTVAL_SQL = "SELECT SQ_TPRMPP_CMENUM_1.NEXTVAL FROM DUAL";

    /** 폭주 방지 상한. 메뉴는 수십 건 규모라 실제로는 수십 회면 끝난다. */
    private static final int MAX_STEPS = 10_000;

    private final JdbcTemplate jdbcTemplate;

    /**
     * 파일 메뉴ID의 최대 번호 이상이 될 때까지 시퀀스를 소비합니다.
     *
     * @param menus 업로드된 메뉴 행 (MNU\d{7} 형식이 아닌 ID는 무시)
     * @return 전진 실패·미완료 시 응답에 덧붙일 경고 문구
     */
    public Optional<String> advanceTo(List<CommonDataMigrationDto.MenuRow> menus) {
        long maxSeq =
                menus.stream()
                        .map(row -> MNU_ID_PATTERN.matcher(row.mnuId()))
                        .filter(Matcher::matches)
                        .mapToLong(m -> Long.parseLong(m.group(1)))
                        .max()
                        .orElse(0);
        if (maxSeq == 0) {
            return Optional.empty();
        }
        try {
            for (int step = 0; step < MAX_STEPS; step++) {
                Long current = jdbcTemplate.queryForObject(NEXTVAL_SQL, Long.class);
                if (current != null && current >= maxSeq) {
                    return Optional.empty();
                }
            }
            return Optional.of(
                    "메뉴 시퀀스를 " + maxSeq + " 이상으로 전진시키지 못했습니다. DBA 확인이 필요합니다.");
        } catch (RuntimeException e) {
            log.warn("메뉴 시퀀스 동기화에 실패했습니다. 이관 반영 자체는 완료된 상태입니다.", e);
            return Optional.of("메뉴 시퀀스 동기화에 실패했습니다. 신규 메뉴 생성 전 DBA 확인이 필요합니다 (ORA-00001 위험).");
        }
    }
}
```

- [ ] **Step 6: 컨트롤러에 POST 2본 추가**

`CommonDataMigrationController`에 필드 `private final CommonDataMigrationService migrationService;`, `private final MenuSequenceSynchronizer menuSequenceSynchronizer;` 추가 후:

```java
    /** 저장 없이 업로드 내용을 검증하고 테이블별 반영 예정 건수·경고·오류를 돌려줍니다. */
    @Operation(summary = "공통 데이터 업로드 사전검증", description = "테이블별 추가/갱신/부활 예정 건수를 검증합니다. 저장하지 않습니다.")
    @PostMapping(path = "/dry-run", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CommonDataMigrationDto.Response> dryRun(
            @Valid @RequestBody CommonDataMigrationDto.Request request) {
        return ResponseEntity.ok(migrationService.dryRun(request));
    }

    /** 검증을 다시 수행한 뒤 5개 테이블을 단일 트랜잭션으로 업서트하고, 트랜잭션 밖에서 메뉴 시퀀스를 동기화합니다. */
    @Operation(summary = "공통 데이터 업로드 확정 반영", description = "경로→메뉴→메뉴권한→공통코드→다국어 순서로 업서트합니다.")
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CommonDataMigrationDto.Response> commit(
            @Valid @RequestBody CommonDataMigrationDto.Request request) {
        CommonDataMigrationDto.Response response = migrationService.commit(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(
                        menuSequenceSynchronizer
                                .advanceTo(request.menus())
                                .map(response::withWarning)
                                .orElse(response));
    }
```

import에 `HttpStatus`, `MediaType`, `PostMapping`, `RequestBody`, `Valid` 추가.

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.domain.migration.commondata.*'`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/migration/commondata/ src/main/java/com/kdb/it/domain/menu/entity/Cmenud.java src/test/java/com/kdb/it/domain/migration/commondata/
git diff --cached --stat
git commit -m "feat: 공통 데이터 이관 dry-run/commit API와 메뉴 시퀀스 동기화 추가"
```

---

### Task 4: [BE] 컨트롤러 보안 테스트 + 백엔드 전체 검증

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/domain/migration/commondata/controller/CommonDataMigrationControllerTest.java`

**Interfaces:**
- Consumes: Task 1·3의 컨트롤러. 테스트 구성(MockMvc 세팅·인증 헬퍼)은 기존 `it_backend/src/test/java/com/kdb/it/domain/migration/controller/MigrationControllerTest.java`를 열어 **같은 방식**(사용 어노테이션, 목 구성, 관리자/비관리자 인증 스텁)을 그대로 따른다.
- Produces: 없음 (검증 전용)

- [ ] **Step 1: `MigrationControllerTest.java`를 읽고 같은 구성으로 테스트 작성**

케이스 3개:
1. `관리자는_dryRun을호출할수있다` — ADMIN 인증으로 `POST /api/admin/migration/common-data/dry-run` (본문: 시트 5개 전부 빈 배열 `{"menus":[],"menuAuths":[],"routes":[],"codes":[],"translations":[]}`) → 200
2. `비관리자는_403이다` — 일반 사용자 인증으로 같은 요청 → 403
3. `관리자는_export를호출할수있다` — `GET /api/admin/migration/common-data/export` → 200

- [ ] **Step 2: 테스트 실행**

Run: `cd C:\it\it_backend; ./gradlew test --tests 'com.kdb.it.domain.migration.commondata.controller.CommonDataMigrationControllerTest'`
Expected: PASS

- [ ] **Step 3: 백엔드 전체 테스트**

Run: `cd C:\it\it_backend; ./gradlew test`
Expected: BUILD SUCCESSFUL (기존 테스트 회귀 없음). `binary/output.bin` 파일락 이슈가 나면 데몬 정리 후 재시도(메모리 참조: `--no-daemon`).

- [ ] **Step 4: 커밋**

```bash
cd C:\it\it_backend
git add src/test/java/com/kdb/it/domain/migration/commondata/controller/
git diff --cached --stat
git commit -m "test: 공통 데이터 이관 컨트롤러 보안 테스트 추가"
```

---

### Task 5: [FE] xlsx 직렬화·파싱 유틸

**Files:**
- Create: `it_frontend/app/utils/commonDataMigration.ts`
- Test: `it_frontend/tests/unit/utils/commonDataMigration.test.ts`

**Interfaces:**
- Consumes: 없음 (순수 유틸, exceljs 비의존 — 행렬(`unknown[][]`) 기반)
- Produces (Task 6이 사용):
  - `COMMON_DATA_SHEETS: { menus|menuAuths|routes|codes|translations: { name: string; headers: readonly string[] } }`
  - 타입 `CommonDataMenuRow, CommonDataMenuAuthRow, CommonDataRouteRow, CommonDataCodeRow, CommonDataTranslationRow, CommonDataBundle` (백엔드 record와 필드 1:1, null 허용 필드는 `| null`)
  - `bundleToSheetMatrices(bundle: CommonDataBundle): Record<string, unknown[][]>` — 시트명→(헤더행 포함) 행렬
  - `parseCommonDataSheets(sheets: Record<string, unknown[][]>): { bundle: CommonDataBundle; errors: string[] }` — 시트명·헤더 매칭 파싱. 다섯 시트 중 하나라도 없으면 errors에 `"'{시트명}' 시트를 찾을 수 없습니다"` 추가. excelRow는 실제 행번호(헤더=1, 데이터 2부터)
  - `toCellValue(value: unknown): unknown` — 수식/서식 셀 정규화 (`useTerminalBulkImportPage.ts:72-77`과 동일 로직을 이 유틸로 export)

- [ ] **Step 1: 실패하는 왕복 테스트 작성**

```ts
import { describe, expect, it } from 'vitest';
import {
    bundleToSheetMatrices,
    COMMON_DATA_SHEETS,
    parseCommonDataSheets,
    type CommonDataBundle,
} from '~/utils/commonDataMigration';

const bundle: CommonDataBundle = {
    menus: [
        {
            excelRow: 0,
            mnuId: 'MNU0000001',
            hrkMnuId: null,
            mnuNm: '관리자',
            mnuTpC: 'GRP',
            imkNm: 'pi pi-cog',
            srePth: null,
            mnuSotSqnSno: 1,
            hidYn: 'N',
            mnuDep: 1,
            whlMnuPth: '/MNU0000001',
        },
    ],
    menuAuths: [{ excelRow: 0, mnuId: 'MNU0000001', athId: 'ITPAD001' }],
    routes: [{ excelRow: 0, srePth: '/admin/menus', sreMnuNm: '메뉴 관리', useYn: 'Y', rmk: null }],
    codes: [
        {
            excelRow: 0,
            cId: 'PRJ_TP',
            cdva: '001',
            sttDt: '20250101',
            endDt: null,
            cNm: '사업유형',
            cdvaNm: '신규',
            cdvaDes: null,
            cdvaDtl: null,
            cdvaDtlC: null,
            cTp: null,
            cTpDes: null,
            hrkC: null,
            cSqn: 1,
        },
    ],
    translations: [
        {
            excelRow: 0,
            tcIdCone: 'MNU0000001',
            tcColNm: 'MNU_NM',
            dttLanC: 'en',
            tcDes: 'Admin',
            dttNm: '메뉴',
        },
    ],
};

describe('commonDataMigration 유틸', () => {
    it('번들 → 행렬 → 번들 왕복이 무손실이다', () => {
        const matrices = bundleToSheetMatrices(bundle);
        const { bundle: parsed, errors } = parseCommonDataSheets(matrices);

        expect(errors).toEqual([]);
        expect(parsed.menus[0]).toMatchObject({ mnuId: 'MNU0000001', mnuSotSqnSno: 1, hrkMnuId: null });
        expect(parsed.menuAuths[0]).toMatchObject({ mnuId: 'MNU0000001', athId: 'ITPAD001' });
        expect(parsed.routes[0]).toMatchObject({ srePth: '/admin/menus', rmk: null });
        expect(parsed.codes[0]).toMatchObject({ cId: 'PRJ_TP', sttDt: '20250101', cSqn: 1 });
        expect(parsed.translations[0]).toMatchObject({ dttLanC: 'en', dttNm: '메뉴' });
    });

    it('행렬 헤더는 정의된 한국어 헤더와 일치한다', () => {
        const matrices = bundleToSheetMatrices(bundle);
        expect(matrices[COMMON_DATA_SHEETS.menus.name]![0]).toEqual([
            ...COMMON_DATA_SHEETS.menus.headers,
        ]);
    });

    it('시트가 빠지면 오류를 보고한다', () => {
        const { errors } = parseCommonDataSheets({});
        expect(errors).toHaveLength(5);
        expect(errors[0]).toContain('시트');
    });

    it('excelRow는 데이터 첫 행이 2다', () => {
        const matrices = bundleToSheetMatrices(bundle);
        const { bundle: parsed } = parseCommonDataSheets(matrices);
        expect(parsed.routes[0]!.excelRow).toBe(2);
    });

    it('숫자 셀이 문자열로 와도 숫자 필드로 변환한다', () => {
        const matrices = bundleToSheetMatrices(bundle);
        const menuSheet = matrices[COMMON_DATA_SHEETS.menus.name]!;
        menuSheet[1]![6] = '3'; // 정렬순서 컬럼
        const { bundle: parsed } = parseCommonDataSheets(matrices);
        expect(parsed.menus[0]!.mnuSotSqnSno).toBe(3);
    });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/utils/commonDataMigration.test.ts`
Expected: FAIL (모듈 미존재)

- [ ] **Step 3: 유틸 구현**

시트 정의(스펙 §5 그대로):

```ts
export const COMMON_DATA_SHEETS = {
    menus: {
        name: '메뉴',
        headers: ['메뉴ID', '상위메뉴ID', '메뉴명', '메뉴유형', '아이콘', '화면경로', '정렬순서', '숨김여부', '메뉴깊이', '전체메뉴경로'],
    },
    menuAuths: { name: '메뉴권한', headers: ['메뉴ID', '자격등급ID'] },
    routes: { name: '경로', headers: ['화면경로', '화면메뉴명', '사용여부', '비고'] },
    codes: {
        name: '공통코드',
        headers: ['코드ID', '코드값', '코드명', '코드값명', '코드값약어명', '코드값상세코드', '코드타입', '타입설명', '코드값상세', '상위코드', '시작일자', '종료일자', '순서'],
    },
    translations: { name: '다국어', headers: ['대상키', '대상컬럼명', '언어코드', '번역내용', '구분명'] },
} as const;
```

공통코드 시트 컬럼↔필드 매핑은 기존 왕복 양식(`useAdminCodesPage.ts` downloadExcel L290-304)과 동일하게: 코드ID=cId, 코드값=cdva, 코드명=cNm, 코드값명=cdvaNm, 코드값약어명=cdvaDes, 코드값상세코드=cdvaDtlC, 코드타입=cTp, 타입설명=cTpDes, 코드값상세=cdvaDtl, 상위코드=hrkC, 시작일자=sttDt, 종료일자=endDt, 순서=cSqn.

구현 지침:
- 셀 문자열화: `const asText = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());` 빈 문자열 → null(옵션 필드) 또는 파싱 시 그대로(필수 필드는 서버 검증에 맡김).
- 숫자 필드(`mnuSotSqnSno`, `mnuDep`, `cSqn`): `asText` 후 `''`이면 null(cSqn) 또는 0 방지 위해 Number 변환, `Number.isNaN`이면 그대로 null 두고 서버 검증에 맡긴다(mnuSotSqnSno·mnuDep는 NaN이면 null → 서버 @NotNull이 걸러줌; 타입은 `number | null`).
- `bundleToSheetMatrices`는 각 행을 헤더 순서의 배열로 변환(null → '').
- `parseCommonDataSheets`는 시트별로 1행을 헤더로 읽어 헤더명→열 인덱스 맵을 만들고(순서 변경 허용), 2행부터 각 행을 파싱한다. 전부 빈 행은 건너뛴다.
- `toCellValue`는 `useTerminalBulkImportPage.ts:72-77`의 로직(수식 `result`, 리치텍스트 `text` 언랩)을 그대로 옮겨 export하고, Task 6에서 그 파일이 이 유틸을 import하도록 바꾸지는 않는다(기존 파일 무변경 원칙 — 중복 허용, 이 유틸 안에서만 사용·export).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/utils/commonDataMigration.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋 (it_frontend 저장소에서)**

```bash
cd C:\it\it_frontend
git add app/utils/commonDataMigration.ts tests/unit/utils/commonDataMigration.test.ts
git diff --cached --stat
git commit -m "feat: 공통 데이터 이관 xlsx 직렬화·파싱 유틸 추가"
```

---

### Task 6: [FE] 이관 화면 — composable + 페이지 + i18n

**Files:**
- Create: `it_frontend/app/composables/useCommonDataMigrationPage.ts`
- Create: `it_frontend/app/pages/admin/migration/common-data.vue`
- Modify: `it_frontend/i18n/messages/migration.ts` (ko·en 양쪽 트리에 `commonData` 네임스페이스 추가)
- Test: `it_frontend/tests/unit/composables/useCommonDataMigrationPage.test.ts`

**Interfaces:**
- Consumes: Task 5의 `COMMON_DATA_SHEETS`, `bundleToSheetMatrices`, `parseCommonDataSheets`, `toCellValue`, `CommonDataBundle`; 기존 `applyHeaderStyle`/`downloadWorkbook`(`~/utils/excel`), `FileDropzonePicker`(`select` 이벤트로 `File[]` 전달), `formatApiError`/`getErrorMessage`(`~/utils/common`), `TOAST_LIFE`(`~/utils/toast`)
- Produces: `useCommonDataMigrationPage()` 반환 `{ fileName, bundle, result, errorMessage, isReading, isDownloading, isSubmitting, isCommitted, hasData, canCommit, downloadAll, selectFile, commit }`
- API 응답 타입은 생성 타입 전-optional을 피하려 composable에 손 선언(선례: `useTerminalBulkImportPage.ts` L7-46):

```ts
export interface CommonDataTableSummary {
    table: string;
    added: number;
    updated: number;
    restored: number;
}
export interface CommonDataMigrationApiResponse {
    committed: boolean;
    summaries: CommonDataTableSummary[];
    warnings: string[];
    errors: string[];
}
```

- [ ] **Step 1: composable 작성 (구조는 `useTerminalBulkImportPage.ts`를 그대로 답습)**

```ts
import { computed, ref } from 'vue';
import { useToast } from 'primevue/usetoast';
import {
    bundleToSheetMatrices,
    COMMON_DATA_SHEETS,
    parseCommonDataSheets,
    toCellValue,
    type CommonDataBundle,
} from '~/utils/commonDataMigration';
import { applyHeaderStyle, downloadWorkbook } from '~/utils/excel';
import { formatApiError, getErrorMessage } from '~/utils/common';
import { TOAST_LIFE } from '~/utils/toast';

/* (위 Interfaces 절의 CommonDataTableSummary·CommonDataMigrationApiResponse 선언) */

/** 공통 데이터 이관 화면의 다운로드·업로드·dry-run·확정 반영 상태를 관리합니다. */
export function useCommonDataMigrationPage() {
    const toast = useToast();
    const { t } = useI18n({ useScope: 'global' });
    const { $apiFetch } = useNuxtApp();
    const bundle = ref<CommonDataBundle | null>(null);
    const fileName = ref<string | null>(null);
    const result = ref<CommonDataMigrationApiResponse | null>(null);
    const errorMessage = ref('');
    const isReading = ref(false);
    const isDownloading = ref(false);
    const isSubmitting = ref(false);
    const isCommitted = ref(false);

    const hasData = computed(() => bundle.value !== null);
    const canCommit = computed(
        () =>
            hasData.value &&
            Boolean(result.value) &&
            result.value!.errors.length === 0 &&
            !errorMessage.value &&
            !isCommitted.value,
    );

    /** 개발서버 전량을 내려받아 시트 5개 xlsx로 저장합니다. */
    async function downloadAll(): Promise<void> {
        isDownloading.value = true;
        try {
            const data = await $apiFetch<CommonDataBundle>(
                '/api/admin/migration/common-data/export',
            );
            const matrices = bundleToSheetMatrices(data);
            const { default: ExcelJS } = await import('exceljs');
            const wb = new ExcelJS.Workbook();
            for (const sheet of Object.values(COMMON_DATA_SHEETS)) {
                const ws = wb.addWorksheet(sheet.name);
                for (const row of matrices[sheet.name] ?? []) ws.addRow(row);
                applyHeaderStyle(ws);
            }
            await downloadWorkbook(
                wb,
                `공통데이터_${new Date().toISOString().slice(0, 10)}.xlsx`,
            );
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: t('migration.commonData.downloadError'),
                detail: formatApiError(getErrorMessage(error)),
                life: TOAST_LIFE.ERROR,
            });
        } finally {
            isDownloading.value = false;
        }
    }

    /** 업로드 파일을 파싱해 dry-run까지 수행합니다. */
    async function selectFile(file: File): Promise<void> {
        isReading.value = true;
        errorMessage.value = '';
        result.value = null;
        isCommitted.value = false;
        try {
            const { default: ExcelJS } = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());
            const matrices: Record<string, unknown[][]> = {};
            for (const ws of workbook.worksheets) {
                matrices[ws.name] = Array.from({ length: ws.rowCount }, (_, r) =>
                    Array.from({ length: ws.columnCount }, (_, c) =>
                        toCellValue(ws.getRow(r + 1).getCell(c + 1).value),
                    ),
                );
            }
            const parsed = parseCommonDataSheets(matrices);
            if (parsed.errors.length > 0) throw new Error(parsed.errors.join(' / '));
            bundle.value = parsed.bundle;
            fileName.value = file.name;
            result.value = await $apiFetch<CommonDataMigrationApiResponse>(
                '/api/admin/migration/common-data/dry-run',
                { method: 'POST', body: parsed.bundle },
            );
        } catch (error) {
            bundle.value = null;
            fileName.value = null;
            errorMessage.value = formatApiError(getErrorMessage(error));
            toast.add({
                severity: 'error',
                summary: t('migration.commonData.fileError'),
                detail: errorMessage.value,
                life: TOAST_LIFE.ERROR,
            });
        } finally {
            isReading.value = false;
        }
    }

    /** dry-run에 오류가 없을 때만 확정 반영합니다. */
    async function commit(): Promise<void> {
        if (!canCommit.value || !bundle.value) return;
        isSubmitting.value = true;
        try {
            result.value = await $apiFetch<CommonDataMigrationApiResponse>(
                '/api/admin/migration/common-data',
                { method: 'POST', body: bundle.value },
            );
            isCommitted.value = true;
            toast.add({
                severity: 'success',
                summary: t('migration.commonData.committed'),
                life: TOAST_LIFE.LONG,
            });
        } catch (error) {
            errorMessage.value = formatApiError(getErrorMessage(error));
            toast.add({
                severity: 'error',
                summary: t('migration.commonData.commitError'),
                detail: errorMessage.value,
                life: TOAST_LIFE.ERROR,
            });
        } finally {
            isSubmitting.value = false;
        }
    }

    return {
        bundle, fileName, result, errorMessage,
        isReading, isDownloading, isSubmitting, isCommitted,
        hasData, canCommit,
        downloadAll, selectFile, commit,
    };
}
```

- [ ] **Step 2: i18n 메시지 추가**

`i18n/messages/migration.ts`의 ko·en 트리 각각에 (기존 `terminalImport` 키 형태를 그대로 따라):

```ts
commonData: {
    title: '공통 데이터 이관',            // en: 'Common data migration'
    downloadAll: '전체 다운로드',          // en: 'Download all'
    downloadError: '다운로드 실패',        // en: 'Download failed'
    fileError: '파일을 읽지 못했습니다',    // en: 'Failed to read file'
    committed: '반영이 완료되었습니다',     // en: 'Applied successfully'
    commitError: '반영 실패',             // en: 'Apply failed'
    commit: '확정 반영',                  // en: 'Apply'
    dryRunSummary: '반영 예정 요약',       // en: 'Planned changes'
    table: '테이블',                      // en: 'Table'
    added: '추가',                        // en: 'Added'
    updated: '갱신',                      // en: 'Updated'
    restored: '부활',                     // en: 'Restored'
    warnings: '경고',                     // en: 'Warnings'
    errors: '오류',                       // en: 'Errors'
    uploadHelp: '개발서버에서 내려받은 공통데이터 xlsx를 올려주세요', // en: 'Upload the common-data xlsx downloaded from the dev server'
},
```

(파일의 실제 트리 구조·타입에 맞춰 배치. `npm run check:copy` 기준선을 늘리지 않도록 하드코딩 문구는 모두 i18n 키로.)

- [ ] **Step 3: 페이지 작성**

`app/pages/admin/migration/common-data.vue` — 구조·클래스는 `app/pages/admin/migration/index.vue`를 열어 같은 레이아웃 패턴을 따른다:

```vue
<script setup lang="ts">
import Button from 'primevue/button';
import Message from 'primevue/message';
import FileDropzonePicker from '~/components/common/FileDropzonePicker.vue';
import { useCommonDataMigrationPage } from '~/composables/useCommonDataMigrationPage';

definePageMeta({ middleware: 'admin' });

const { t } = useI18n({ useScope: 'global' });
const {
    fileName, result, errorMessage,
    isReading, isDownloading, isSubmitting, isCommitted,
    canCommit, downloadAll, selectFile, commit,
} = useCommonDataMigrationPage();

const onSelect = (files: File[]) => {
    const file = files[0];
    if (file) void selectFile(file);
};
</script>

<template>
    <div class="common-data-migration">
        <div class="common-data-migration__header">
            <h2>{{ t('migration.commonData.title') }}</h2>
            <Button
                :label="t('migration.commonData.downloadAll')"
                icon="pi pi-download"
                :loading="isDownloading"
                @click="downloadAll"
            />
        </div>

        <FileDropzonePicker
            :multiple="false"
            accept=".xlsx"
            :is-running="isReading || isSubmitting"
            :labels="{ help: t('migration.commonData.uploadHelp') }"
            input-test-id="common-data-file-input"
            @select="onSelect"
        />

        <Message v-if="errorMessage" severity="error">{{ errorMessage }}</Message>

        <section v-if="result" class="common-data-migration__result">
            <h3>{{ t('migration.commonData.dryRunSummary') }}</h3>
            <p v-if="fileName">{{ fileName }}</p>
            <table class="common-data-migration__summary">
                <thead>
                    <tr>
                        <th>{{ t('migration.commonData.table') }}</th>
                        <th>{{ t('migration.commonData.added') }}</th>
                        <th>{{ t('migration.commonData.updated') }}</th>
                        <th>{{ t('migration.commonData.restored') }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="summary in result.summaries" :key="summary.table">
                        <td>{{ summary.table }}</td>
                        <td>{{ summary.added }}</td>
                        <td>{{ summary.updated }}</td>
                        <td>{{ summary.restored }}</td>
                    </tr>
                </tbody>
            </table>

            <Message
                v-for="(warning, index) in result.warnings"
                :key="`w-${index}`"
                severity="warn"
            >
                {{ warning }}
            </Message>
            <Message v-for="(error, index) in result.errors" :key="`e-${index}`" severity="error">
                {{ error }}
            </Message>

            <Button
                :label="t('migration.commonData.commit')"
                icon="pi pi-check"
                :disabled="!canCommit"
                :loading="isSubmitting"
                @click="commit"
            />
            <Message v-if="isCommitted" severity="success">
                {{ t('migration.commonData.committed') }}
            </Message>
        </section>
    </div>
</template>

<style scoped>
.common-data-migration {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}
.common-data-migration__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.common-data-migration__summary {
    border-collapse: collapse;
    min-width: 24rem;
}
.common-data-migration__summary th,
.common-data-migration__summary td {
    border: 1px solid var(--p-surface-300);
    padding: 0.375rem 0.75rem;
    text-align: center;
}
</style>
```

(스타일 토큰·클래스 네이밍은 기존 마이그레이션 페이지와 어긋나면 그 페이지 쪽을 따른다.)

- [ ] **Step 4: composable 테스트 작성**

`tests/unit/composables/useCommonDataMigrationPage.test.ts` — 기존 composable 테스트의 mock 구성(`tests/unit/composables/` 아래 아무 파일이나 열어 `useNuxtApp`·`useToast`·`useI18n` mock 방식 확인)을 따라 최소 2케이스:
1. `dry-run 오류가 있으면 canCommit이 false다` — `$apiFetch` mock이 `errors: ['x']` 응답 → `canCommit.value === false`
2. `dry-run 오류가 없으면 canCommit이 true다`

(파일 파싱 경로는 Task 5 유틸 테스트가 담당하므로 selectFile 전체 흐름 대신 내부 상태를 직접 세팅해 computed만 검증해도 된다. computed 검증이 mock 구성상 어려우면 이 테스트는 dry-run 응답 상태 조작으로 대체한다.)

- [ ] **Step 5: 프론트 검증 명령 실행**

Run: `cd C:\it\it_frontend; npm run format:check; npm run check; npm test`
Expected: 모두 PASS. format 실패 시 `npm run format` 후 재확인.

- [ ] **Step 6: 커밋**

```bash
cd C:\it\it_frontend
git add app/composables/useCommonDataMigrationPage.ts app/pages/admin/migration/common-data.vue i18n/messages/migration.ts tests/unit/composables/useCommonDataMigrationPage.test.ts
git diff --cached --stat
git commit -m "feat: 공통 데이터 이관 관리자 화면 추가"
```

---

### Task 7: [DB] 메뉴 시드 마이그레이션

**Files:**
- Create: `it_database/migrations/V{YYYYMMDD}_{NNN}__SeedCommonDataMigrationMenu.sql` — 버전은 작성일 날짜로, `NNN`은 `it_database/migrations/` 디렉터리에서 같은 날짜의 기존 최대 번호+1 (먼저 `ls it_database/migrations/V{YYYYMMDD}_*.sql`로 확인해 번호 선점)

**Interfaces:**
- Consumes: 기존 시드 패턴 (`V20260822_001__SeedAdminMenuCatalogPathsAndAuthMapping.sql`의 CMENUD MERGE·CMENUA NOT EXISTS·GUID 식, `V20260829_003`의 CLANGM 갱신)
- Produces: `/admin/migration/common-data` 경로 카탈로그 + 「공통 데이터 이관」 메뉴(기존 `/admin/migration` 메뉴의 형제) + ITPAD001 권한 매핑 + 영문 메뉴명

- [ ] **Step 1: SQL 작성**

```sql
-- ============================================================================
-- 공통 데이터 이관 화면(/admin/migration/common-data) 메뉴 시드
-- ============================================================================
-- 1) TPRMPP_CMENUD: 경로 카탈로그 MERGE (멱등)
-- 2) TPRMPP_CMENUM: 기존 /admin/migration 메뉴의 형제로 「공통 데이터 이관」 추가
--    (시퀀스 채번, 이미 있으면 건너뜀 — 멱등)
-- 3) TPRMPP_CMENUA: ITPAD001 매핑 (NOT EXISTS 가드)
-- 4) TPRMPP_CLANGM: 영문 메뉴명
-- GUID는 BaseEntity.prePersist()와 같은 형식(UUID v4 소문자 dashed, GUID_PRG_SNO=1).
-- 선례: V20260822_001, V20260829_003
-- ============================================================================

MERGE INTO ITPOWN.TPRMPP_CMENUD target
USING (
    SELECT '/admin/migration/common-data' AS sre_pth,
           '공통 데이터 이관'               AS sre_mnu_nm,
           '메뉴·경로·공통코드·다국어 개발→운영 이관' AS rmk
      FROM DUAL
) source
ON (target.SRE_PTH = source.sre_pth)
WHEN NOT MATCHED THEN
    INSERT (SRE_PTH, SRE_MNU_NM, USE_YN, RMK)
    VALUES (source.sre_pth, source.sre_mnu_nm, 'Y', source.rmk);

DECLARE
    v_exists     NUMBER;
    v_parent_id  ITPOWN.TPRMPP_CMENUM.MNU_ID%TYPE;
    v_dep        ITPOWN.TPRMPP_CMENUM.MNU_DEP%TYPE;
    v_parent_whl ITPOWN.TPRMPP_CMENUM.WHL_MNU_PTH%TYPE;
    v_sort       ITPOWN.TPRMPP_CMENUM.MNU_SOT_SQN_SNO%TYPE;
    v_seq        NUMBER;
    v_new_id     ITPOWN.TPRMPP_CMENUM.MNU_ID%TYPE;
BEGIN
    SELECT COUNT(*) INTO v_exists
      FROM ITPOWN.TPRMPP_CMENUM
     WHERE SRE_PTH = '/admin/migration/common-data'
       AND DEL_YN = 'N';
    IF v_exists = 0 THEN
        -- 금융정보단말기 일괄업로드(/admin/migration) 메뉴의 형제로 배치한다.
        SELECT HRK_MNU_ID, MNU_DEP INTO v_parent_id, v_dep
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE SRE_PTH = '/admin/migration'
           AND MNU_TP_C = 'PGE'
           AND DEL_YN = 'N';
        SELECT WHL_MNU_PTH INTO v_parent_whl
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE MNU_ID = v_parent_id;
        SELECT NVL(MAX(MNU_SOT_SQN_SNO), 0) + 1 INTO v_sort
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE HRK_MNU_ID = v_parent_id
           AND DEL_YN = 'N';
        SELECT ITPOWN.SQ_TPRMPP_CMENUM_1.NEXTVAL INTO v_seq FROM DUAL;
        v_new_id := 'MNU' || LPAD(v_seq, 7, '0');

        INSERT INTO ITPOWN.TPRMPP_CMENUM
            (MNU_ID, HRK_MNU_ID, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO,
             HID_YN, MNU_DEP, WHL_MNU_PTH,
             DEL_YN, GUID, GUID_PRG_SNO,
             FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM)
        VALUES
            (v_new_id, v_parent_id, '공통 데이터 이관', 'PGE',
             '/admin/migration/common-data', v_sort,
             'N', v_dep, v_parent_whl || '/' || v_new_id,
             'N',
             LOWER(REGEXP_REPLACE(RAWTOHEX(SYS_GUID()),
                   '(.{8})(.{4})(.{4})(.{4})(.{12})', '\1-\2-\3-\4-\5')),
             1, 'MIGRATION', SYSDATE, 'MIGRATION', SYSDATE);

        INSERT INTO ITPOWN.TPRMPP_CMENUA
            (MNU_ID, ATH_ID, DEL_YN, GUID, GUID_PRG_SNO,
             FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM)
        VALUES
            (v_new_id, 'ITPAD001', 'N',
             LOWER(REGEXP_REPLACE(RAWTOHEX(SYS_GUID()),
                   '(.{8})(.{4})(.{4})(.{4})(.{12})', '\1-\2-\3-\4-\5')),
             1, 'MIGRATION', SYSDATE, 'MIGRATION', SYSDATE);

        INSERT INTO ITPOWN.TPRMPP_CLANGM
            (TC_ID_CONE, TC_COL_NM, DTT_LAN_C, TC_DES, DTT_NM,
             DEL_YN, GUID, GUID_PRG_SNO,
             FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM)
        VALUES
            (v_new_id, 'MNU_NM', 'en', 'Common data migration', '메뉴',
             'N',
             LOWER(REGEXP_REPLACE(RAWTOHEX(SYS_GUID()),
                   '(.{8})(.{4})(.{4})(.{4})(.{12})', '\1-\2-\3-\4-\5')),
             1, 'MIGRATION', SYSDATE, 'MIGRATION', SYSDATE);
    END IF;
END;
/

COMMIT;
```

작성 전 확인: ① `WHL_MNU_PTH` 실제 형식(`/MNU0000001/...`인지 `/0000001/...`인지)을 기존 데이터로 확인해 `v_parent_whl || '/' || v_new_id` 결합이 형제 행과 같은 형식이 되는지 검증(형제 행 `/admin/migration`의 WHL_MNU_PTH에서 자기 MNU_ID를 떼어낸 접두사와 v_parent_whl이 일치해야 한다), ② 컬럼명은 `it_database/ITPOWN_DDL_live.sql`의 TPRMPP_CMENUM 정의와 대조.

- [ ] **Step 2: 로컬 Flyway 적용 검증**

백엔드 로컬 프로파일 기동으로 Flyway가 적용하거나, 로컬 검증 절차(`it_database/docs/guides/migrations.md`)를 따른다. 적용 후:

```sql
SELECT MNU_ID, HRK_MNU_ID, WHL_MNU_PTH, MNU_SOT_SQN_SNO
  FROM ITPOWN.TPRMPP_CMENUM WHERE SRE_PTH = '/admin/migration/common-data';
SELECT COUNT(*) FROM ITPOWN.TPRMPP_CMENUA a
  JOIN ITPOWN.TPRMPP_CMENUM m ON m.MNU_ID = a.MNU_ID
 WHERE m.SRE_PTH = '/admin/migration/common-data' AND a.ATH_ID = 'ITPAD001';
```

Expected: 메뉴 1행(WHL_MNU_PTH가 형제와 같은 형식), 매핑 1건. `flyway_schema_history`에서 신규 버전 success=1 확인.

- [ ] **Step 3: 커밋 (it_database 저장소에서)**

```bash
cd C:\it\it_database
git add migrations/V*__SeedCommonDataMigrationMenu.sql
git diff --cached --stat
git commit -m "feat: 공통 데이터 이관 메뉴 시드 추가"
```

---

### Task 8: 통합 검증 · codegen · 마무리

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (codegen 재생성 산출물)
- Modify: `C:\it\versions.lock` (스크립트 산출물)
- Modify: `C:\it\TASK.md` (남은 후속 과제가 있으면 등재)

- [ ] **Step 1: 백엔드 기동 + OpenAPI codegen**

백엔드를 로컬 프로파일로 기동한 상태에서:

```bash
cd C:\it\it_frontend
npm run codegen
npm run codegen:check
```

Expected: `app/types/api.d.ts`에 `/api/admin/migration/common-data*` 경로 3개 추가, drift 검사 통과. (백엔드 기동이 환경상 불가능하면 이 단계를 사용자에게 보고하고 후속 과제로 `TASK.md`에 등재한다 — 조용히 건너뛰지 않는다.)

- [ ] **Step 2: 전체 Health Stack**

```bash
cd C:\it\it_backend
./gradlew test
```

```bash
cd C:\it\it_frontend
npm run format:check && npm run check && npm test
```

Expected: 모두 PASS.

- [ ] **Step 3: 수동 스모크 (선택, 로컬 백엔드+프론트 기동 시)**

관리자 로그인 → `/admin/migration/common-data` → [전체 다운로드]로 xlsx 확보 → 같은 파일 업로드 → dry-run 요약이 전부 `갱신`으로 나오는지 → [확정 반영] → 성공 토스트. (같은 서버 왕복이므로 added=0이어야 정상.)

- [ ] **Step 4: codegen 산출물 커밋 + versions.lock 갱신**

```bash
cd C:\it\it_frontend
git add app/types/api.d.ts
git diff --cached --stat
git commit -m "chore: 공통 데이터 이관 API 타입 재생성"
```

```powershell
cd C:\it
./scripts/update-versions-lock.ps1
git add versions.lock
git commit -m "chore: 공통 데이터 이관 호환 버전 기록"
```

- [ ] **Step 5: 계획·스펙 문서 정리**

- 이 계획 파일의 체크박스를 최종 상태로 갱신하고, 완료되면 `docs/superpowers/plans/` 규칙에 따라 위치 유지(이동은 사용자 지시 시).
- 미완(예: codegen 미실행)이 있으면 `C:\it\TASK.md`에 후속 과제로 등재.

```bash
cd C:\it
git add docs/superpowers/plans/2026-08-29-common-data-migration.md TASK.md
git diff --cached --stat
git commit -m "docs: 공통 데이터 이관 구현 계획 상태 갱신"
```
