# 주관부서명/주관팀명 컬럼(SVN_DPM_NM/SVN_TEM_NM) 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6개 테이블(BCOSTM/L, BPROJM/L, BRDOCM/L)에 주관부서명/주관팀명 컬럼을 추가하고, 코드 설정 시점에 이름을 함께 스냅샷 저장하며, 요구사항정의서 화면에 표시한다.

**Architecture:** 코드가 설정/변경되는 모든 지점에서 `OrgNameResolver`(신규)로 이름을 함께 resolve해 저장. 조회 시 저장값 우선, null이면 기존 CORGNI 조인 폴백. `*L` 로그 미러는 `ChangeLogEntityListener` 리플렉션 복사로 자동 반영(동명 필드 선언만 필요).

**Tech Stack:** Oracle(Flyway), Spring Boot 4 + JPA, Nuxt 4 + PrimeVue. 스펙: `docs/superpowers/specs/2026-07-08-svn-org-name-columns-design.md`

**주의(레포 구조):** it_backend / it_frontend / it_database 는 **각각 독립 git 저장소**입니다. 커밋은 반드시 해당 저장소 디렉토리에서 실행합니다 (`git -C C:\it\it_backend ...` 형태).

**주의(테스트):** 로컬 환경에서 `./gradlew test`는 워커 JVM 기동 크래시가 있습니다(메모리 참조). 테스트 실행이 실패하면 `./gradlew compileJava compileTestJava`로 컴파일 검증까지만 수행하고 그 사실을 보고합니다.

---

### Task 1: DB 마이그레이션 — 6개 테이블에 SVN_DPM_NM/SVN_TEM_NM 추가

**Files:**
- Create: `C:\it\it_database\migrations\V20260708_004__AddSvnOrgNameColumns.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- V20260708_004__AddSvnOrgNameColumns.sql
-- 운영DB-로컬DB Gap 분석 결과, 운영에만 존재하는 주관부서명/주관팀명 컬럼을 로컬에도 추가.
--   - TPRMPP_BCOSTM/BCOSTL, TPRMPP_BPROJM/BPROJL, TPRMPP_BRDOCM/BRDOCL (마스터 + 감사 로그 미러)
--   - SVN_DPM_NM VARCHAR2(100 CHAR) 주관부서명, SVN_TEM_NM VARCHAR2(100 CHAR) 주관팀명
-- 값은 코드(SVN_DPM_C/SVN_TEM_C) 설정 시점에 서비스 계층(OrgNameResolver)에서 CORGNI 조회로 채운다(저장 시점 스냅샷).
-- 모두 NULL 허용(기존 행 백필 없음, 운영과 동일). ALTER ... ADD는 컬럼을 테이블 끝에 추가한다(JPA는 컬럼명 매핑).
-- 멱등성: 컬럼이 이미 있으면 추가를 건너뛰고 코멘트만 재적용한다.
-- 주의: 적용 후 수정 금지(Flyway 체크섬 추적 대상). 추가 변경은 항상 새 버전 스크립트로 작성.
DECLARE
    PROCEDURE add_col_if_missing(p_table VARCHAR2, p_column VARCHAR2) IS
        v_cnt NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_cnt FROM all_tab_cols
         WHERE owner = 'ITPOWN' AND table_name = p_table AND column_name = p_column;
        IF v_cnt = 0 THEN
            EXECUTE IMMEDIATE 'ALTER TABLE ITPOWN.' || p_table
                || ' ADD (' || p_column || ' VARCHAR2(100 CHAR))';
        END IF;
    END;
BEGIN
    add_col_if_missing('TPRMPP_BCOSTM', 'SVN_DPM_NM');
    add_col_if_missing('TPRMPP_BCOSTM', 'SVN_TEM_NM');
    add_col_if_missing('TPRMPP_BCOSTL', 'SVN_DPM_NM');
    add_col_if_missing('TPRMPP_BCOSTL', 'SVN_TEM_NM');
    add_col_if_missing('TPRMPP_BPROJM', 'SVN_DPM_NM');
    add_col_if_missing('TPRMPP_BPROJM', 'SVN_TEM_NM');
    add_col_if_missing('TPRMPP_BPROJL', 'SVN_DPM_NM');
    add_col_if_missing('TPRMPP_BPROJL', 'SVN_TEM_NM');
    add_col_if_missing('TPRMPP_BRDOCM', 'SVN_DPM_NM');
    add_col_if_missing('TPRMPP_BRDOCM', 'SVN_TEM_NM');
    add_col_if_missing('TPRMPP_BRDOCL', 'SVN_DPM_NM');
    add_col_if_missing('TPRMPP_BRDOCL', 'SVN_TEM_NM');
END;
/

COMMENT ON COLUMN ITPOWN.TPRMPP_BCOSTM.SVN_DPM_NM IS '주관부서명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BCOSTM.SVN_TEM_NM IS '주관팀명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BCOSTL.SVN_DPM_NM IS '주관부서명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BCOSTL.SVN_TEM_NM IS '주관팀명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJM.SVN_DPM_NM IS '주관부서명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJM.SVN_TEM_NM IS '주관팀명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJL.SVN_DPM_NM IS '주관부서명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPROJL.SVN_TEM_NM IS '주관팀명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BRDOCM.SVN_DPM_NM IS '주관부서명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BRDOCM.SVN_TEM_NM IS '주관팀명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BRDOCL.SVN_DPM_NM IS '주관부서명';
COMMENT ON COLUMN ITPOWN.TPRMPP_BRDOCL.SVN_TEM_NM IS '주관팀명';
```

- [ ] **Step 2: 로컬 DB에 적용**

Bash에서 실행 (NLS_LANG 필수 — 미설정 시 한글 코멘트 ORA-01756 깨짐):

```bash
export NLS_LANG=AMERICAN_AMERICA.AL32UTF8
cat > /tmp/apply_v004.sql <<'EOF'
WHENEVER SQLERROR EXIT SQL.SQLCODE
ALTER SESSION SET CURRENT_SCHEMA = ITPOWN;
SET DEFINE OFF
@"C:\it\it_database\migrations\V20260708_004__AddSvnOrgNameColumns.sql"
EXIT;
EOF
sqlplus -S 'ITPAPP/kdb1234!!@127.0.0.1:11521/XEPDB1' @/tmp/apply_v004.sql
```

Expected: `PL/SQL procedure successfully completed.` + `Comment created.` × 12, exit code 0.

- [ ] **Step 3: 적용 검증**

```bash
export NLS_LANG=AMERICAN_AMERICA.AL32UTF8
cat > /tmp/verify_v004.sql <<'EOF'
SET LINESIZE 120
SET PAGESIZE 100
SELECT table_name, column_name, data_type, char_length
  FROM all_tab_columns
 WHERE owner='ITPOWN' AND column_name IN ('SVN_DPM_NM','SVN_TEM_NM')
 ORDER BY table_name, column_name;
EXIT;
EOF
sqlplus -S 'ITPAPP/kdb1234!!@127.0.0.1:11521/XEPDB1' @/tmp/verify_v004.sql
```

Expected: 12행 (6개 테이블 × 2컬럼), 모두 `VARCHAR2 100`.

- [ ] **Step 4: Commit (it_database 저장소)**

```bash
git -C C:\it\it_database add migrations/V20260708_004__AddSvnOrgNameColumns.sql
git -C C:\it\it_database commit -m "feat: 주관부서명/주관팀명 컬럼 추가 (6개 테이블, 운영 스키마 정합)"
```

---

### Task 2: OrgNameResolver — 조직코드→조직명 공통 해석기

**Files:**
- Create: `C:\it\it_backend\src\main\java\com\kdb\it\common\iam\service\OrgNameResolver.java`
- Test: `C:\it\it_backend\src\test\java\com\kdb\it\common\iam\service\OrgNameResolverTest.java`

- [ ] **Step 1: 실패하는 테스트 작성**

```java
package com.kdb.it.common.iam.service;

import com.kdb.it.common.iam.entity.CorgnI;
import com.kdb.it.common.iam.repository.OrganizationRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * {@link OrgNameResolver} 단위 테스트.
 */
@ExtendWith(MockitoExtension.class)
class OrgNameResolverTest {

    @Mock
    private OrganizationRepository organizationRepository;

    @InjectMocks
    private OrgNameResolver orgNameResolver;

    @Test
    @DisplayName("조직코드로 CORGNI를 조회해 조직명을 반환한다")
    void resolveName_returnsBbrNm() {
        CorgnI org = org.mockito.Mockito.mock(CorgnI.class);
        given(org.getBbrNm()).willReturn("정보기술부");
        given(organizationRepository.findById("BBR001")).willReturn(Optional.of(org));

        assertThat(orgNameResolver.resolveName("BBR001")).isEqualTo("정보기술부");
    }

    @Test
    @DisplayName("코드가 null 또는 공백이면 조회 없이 null을 반환한다")
    void resolveName_nullOrBlank_returnsNull() {
        assertThat(orgNameResolver.resolveName(null)).isNull();
        assertThat(orgNameResolver.resolveName("")).isNull();
        assertThat(orgNameResolver.resolveName("  ")).isNull();
        verifyNoInteractions(organizationRepository);
    }

    @Test
    @DisplayName("CORGNI에 등록되지 않은 코드는 null을 반환한다")
    void resolveName_unknownCode_returnsNull() {
        given(organizationRepository.findById("XXXXX")).willReturn(Optional.empty());

        assertThat(orgNameResolver.resolveName("XXXXX")).isNull();
    }
}
```

- [ ] **Step 2: 컴파일 실패 확인**

Run: `cd C:\it\it_backend && ./gradlew compileTestJava`
Expected: FAIL — `OrgNameResolver` 클래스 미존재 컴파일 오류.

- [ ] **Step 3: 구현**

```java
package com.kdb.it.common.iam.service;

import com.kdb.it.common.iam.entity.CorgnI;
import com.kdb.it.common.iam.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 조직코드 → 조직명 공통 해석기.
 *
 * <p>
 * 부서/팀 코드 모두 조직 마스터({@code TPRMPP_CORGNI})의 {@code PRLM_OGZ_C_CONE}을
 * 키로 사용하므로 단일 메서드로 해석합니다. 마스터 레코드에 주관부서명/주관팀명
 * 스냅샷(SVN_DPM_NM/SVN_TEM_NM)을 저장할 때 사용합니다.
 * </p>
 */
@Component
@RequiredArgsConstructor
public class OrgNameResolver {

    /** 조직(부점) 마스터 리포지토리: 조직코드→조직명 조회용 */
    private final OrganizationRepository organizationRepository;

    /**
     * 조직코드에 해당하는 조직명을 해석합니다.
     *
     * @param orgCode 조직코드 (부서코드 또는 팀코드)
     * @return 조직명. 코드가 null/공백이거나 CORGNI에 없으면 {@code null}
     */
    @Transactional(readOnly = true)
    public String resolveName(String orgCode) {
        if (orgCode == null || orgCode.isBlank()) {
            return null;
        }
        return organizationRepository.findById(orgCode)
                .map(CorgnI::getBbrNm)
                .orElse(null);
    }
}
```

- [ ] **Step 4: 테스트 실행**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.common.iam.service.OrgNameResolverTest"`
Expected: PASS (3 tests). 워커 크래시 시 `./gradlew compileJava compileTestJava` 성공으로 대체 확인 후 보고.

- [ ] **Step 5: Commit (it_backend 저장소)**

```bash
git -C C:\it\it_backend add src/main/java/com/kdb/it/common/iam/service/OrgNameResolver.java src/test/java/com/kdb/it/common/iam/service/OrgNameResolverTest.java
git -C C:\it\it_backend commit -m "feat: 조직코드→조직명 공통 해석기 OrgNameResolver 추가"
```

---

### Task 3: 엔티티 필드 추가 — Brdocm/BrdocmL (+ assignAuthorOrg 확장)

**Files:**
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\document\entity\Brdocm.java`
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\log\entity\BrdocmL.java`

- [ ] **Step 1: Brdocm에 이름 필드 추가 + assignAuthorOrg 시그니처 확장**

`Brdocm.java`의 `svnTemC` 필드 선언(89행) 바로 아래에 추가:

```java
    /** 주관부서명: 코드 설정 시점 CORGNI 조회 스냅샷 (조직명 변경 시에도 과거 기록 유지, 최대 100자) */
    @Column(name = "SVN_DPM_NM", length = 100, comment = "주관부서명")
    private String svnDpmNm;

    /** 주관팀명: 코드 설정 시점 CORGNI 조회 스냅샷 (최대 100자) */
    @Column(name = "SVN_TEM_NM", length = 100, comment = "주관팀명")
    private String svnTemNm;
```

기존 `assignAuthorOrg(String svnDpmC, String svnTemC)` 메서드를 다음으로 교체:

```java
    /**
     * 작성자 기준 주관부서/주관팀 코드·명 설정.
     *
     * <p>신규 생성 및 새 버전 생성 시 작성자(현재 로그인 사용자) 소속 부서·팀 코드로 채우고,
     * 조직명은 같은 시점의 CORGNI 조회 결과(스냅샷)로 저장합니다.
     * 변경 로그 스냅샷이 값을 복사하도록 반드시 INSERT 이전(save 호출 전)에 호출합니다.</p>
     *
     * @param svnDpmC  작성자 소속 부서코드
     * @param svnDpmNm 부서명 (코드 미등록 시 null 허용)
     * @param svnTemC  작성자 소속 팀코드
     * @param svnTemNm 팀명 (코드 미등록 시 null 허용)
     */
    public void assignAuthorOrg(String svnDpmC, String svnDpmNm, String svnTemC, String svnTemNm) {
        this.svnDpmC = svnDpmC;
        this.svnDpmNm = svnDpmNm;
        this.svnTemC = svnTemC;
        this.svnTemNm = svnTemNm;
    }
```

- [ ] **Step 2: BrdocmL에 동명 미러 필드 추가**

`BrdocmL.java`의 `svnTemC` 필드(52행) 아래에 추가:

```java
    @Column(name = "SVN_DPM_NM", length = 100, comment = "주관부서명")
    private String svnDpmNm;

    @Column(name = "SVN_TEM_NM", length = 100, comment = "주관팀명")
    private String svnTemNm;
```

- [ ] **Step 3: 컴파일 확인 (호출부 오류 확인)**

Run: `cd C:\it\it_backend && ./gradlew compileJava`
Expected: FAIL — `ServiceRequestDocService.java:193,271`의 기존 2-인자 `assignAuthorOrg` 호출 컴파일 오류. (Task 4에서 수정 — 이 시점의 실패는 정상이므로 커밋하지 않고 Task 4로 진행.)

---

### Task 4: ServiceRequestDocService — 생성/새버전 시 이름 함께 저장

**Files:**
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\document\service\ServiceRequestDocService.java`
- Test: `C:\it\it_backend\src\test\java\com\kdb\it\domain\budget\document\service\ServiceRequestDocServiceTest.java`

- [ ] **Step 1: 서비스 필드에 OrgNameResolver 주입 추가**

`ServiceRequestDocService`의 `private final AuthorOrgResolver authorOrgResolver;` 필드 옆에 추가:

```java
    /** 조직코드→조직명 해석기: 주관부서명/주관팀명 스냅샷 저장용 */
    private final OrgNameResolver orgNameResolver;
```

import 추가: `import com.kdb.it.common.iam.service.OrgNameResolver;`

- [ ] **Step 2: 생성 경로(:193 부근) 수정**

기존:
```java
        AuthorOrg authorOrg = authorOrgResolver.resolveCurrent();
        document.assignAuthorOrg(authorOrg.svnDpmC(), authorOrg.svnTemC());
```
변경:
```java
        AuthorOrg authorOrg = authorOrgResolver.resolveCurrent();
        // 주관부서명/주관팀명은 코드 설정 시점의 CORGNI 조회 스냅샷으로 함께 저장
        document.assignAuthorOrg(
                authorOrg.svnDpmC(), orgNameResolver.resolveName(authorOrg.svnDpmC()),
                authorOrg.svnTemC(), orgNameResolver.resolveName(authorOrg.svnTemC()));
```

- [ ] **Step 3: 새버전 경로(:271 부근) 동일 수정**

기존:
```java
        AuthorOrg authorOrg = authorOrgResolver.resolveCurrent();
        newEntity.assignAuthorOrg(authorOrg.svnDpmC(), authorOrg.svnTemC());
```
변경:
```java
        AuthorOrg authorOrg = authorOrgResolver.resolveCurrent();
        // 새 버전 행의 주관부서명/주관팀명도 새 버전 작성자 기준 스냅샷으로 저장
        newEntity.assignAuthorOrg(
                authorOrg.svnDpmC(), orgNameResolver.resolveName(authorOrg.svnDpmC()),
                authorOrg.svnTemC(), orgNameResolver.resolveName(authorOrg.svnTemC()));
```

- [ ] **Step 4: 기존 테스트 수정 + 신규 검증 추가**

`ServiceRequestDocServiceTest.java`:
1. `@Mock private OrgNameResolver orgNameResolver;` 필드 추가 (import: `com.kdb.it.common.iam.service.OrgNameResolver`).
2. `createDocument_populatesAuthorOrgFromCurrentUser` 테스트(:126)에 이름 스텁·검증 추가:

```java
        given(authorOrgResolver.resolveCurrent())
                .willReturn(new AuthorOrg("BBR001", "18010", "H001"));
        given(orgNameResolver.resolveName("BBR001")).willReturn("정보기술부");
        given(orgNameResolver.resolveName("18010")).willReturn("PMO팀");
```
저장 엔티티 캡처 후 기존 `assertThat(saved.getSvnDpmC())...` 검증 옆에:
```java
        assertThat(saved.getSvnDpmNm()).isEqualTo("정보기술부");
        assertThat(saved.getSvnTemNm()).isEqualTo("PMO팀");
```
3. `createNewVersion_populatesAuthorOrgFromCurrentUser`(:148)도 동일 패턴으로 이름 검증 추가.
4. CORGNI 미등록 케이스 신규 테스트:

```java
    @Test
    @DisplayName("생성 시 CORGNI에 없는 코드는 이름을 null로 저장한다")
    void createDocument_unknownOrgCode_storesNullNames() {
        given(authorOrgResolver.resolveCurrent())
                .willReturn(new AuthorOrg("ZZZ99", "99999", null));
        given(orgNameResolver.resolveName("ZZZ99")).willReturn(null);
        given(orgNameResolver.resolveName("99999")).willReturn(null);
        // 기존 createDocument 성공 테스트와 동일한 요청/스텁 구성 사용

        // ... service.createDocument(request) 호출 후 저장 엔티티 캡처 ...
        // assertThat(saved.getSvnDpmC()).isEqualTo("ZZZ99");
        // assertThat(saved.getSvnDpmNm()).isNull();
        // assertThat(saved.getSvnTemNm()).isNull();
    }
```
(요청/캡처 보일러플레이트는 파일 내 기존 `createDocument_populatesAuthorOrgFromCurrentUser`를 그대로 복사해 구성.)

- [ ] **Step 5: 테스트 실행**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.service.ServiceRequestDocServiceTest"`
Expected: PASS. 워커 크래시 시 compileJava/compileTestJava 성공으로 대체 확인.

- [ ] **Step 6: Commit**

```bash
git -C C:\it\it_backend add -A src/main/java/com/kdb/it/domain/budget/document src/main/java/com/kdb/it/domain/log/entity/BrdocmL.java src/test/java/com/kdb/it/domain/budget/document
git -C C:\it\it_backend commit -m "feat: 요구사항정의서 주관부서명/주관팀명 스냅샷 저장"
```

---

### Task 5: Bprojm/BprojmL — 필드 추가 + 생성/수정 경로 이름 저장

**Files:**
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\project\entity\Bprojm.java`
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\log\entity\BprojmL.java`
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\project\service\ProjectService.java`
- Test: `C:\it\it_backend\src\test\java\com\kdb\it\domain\budget\project\service\ProjectServiceTest.java`

- [ ] **Step 1: Bprojm 필드 + 이름 일괄 설정 메서드 추가**

`Bprojm.java`의 `svnTemC` 필드(78행) 아래에 필드 추가:

```java
    /** 주관부서명: 코드 설정 시점 CORGNI 조회 스냅샷 (조직명 변경 시에도 과거 기록 유지, 최대 100자) */
    @Column(name = "SVN_DPM_NM", length = 100, comment = "주관부서명")
    private String svnDpmNm;

    /** 주관팀명: 코드 설정 시점 CORGNI 조회 스냅샷 (최대 100자) */
    @Column(name = "SVN_TEM_NM", length = 100, comment = "주관팀명")
    private String svnTemNm;
```

`assignSvnTemC` 메서드(367행) 아래에 이름 설정 메서드 추가:

```java
    /**
     * 주관부서명/주관팀명 스냅샷 설정.
     *
     * <p>현재 엔티티에 설정된 주관부서코드/주관팀코드에 대응하는 조직명을 저장합니다.
     * 코드가 설정/변경되는 지점(생성·수정) 직후, INSERT/UPDATE flush 이전에 호출합니다.</p>
     *
     * @param svnDpmNm 주관부서명 (코드 미등록 시 null 허용)
     * @param svnTemNm 주관팀명 (코드 미등록 시 null 허용)
     */
    public void assignSvnOrgNames(String svnDpmNm, String svnTemNm) {
        this.svnDpmNm = svnDpmNm;
        this.svnTemNm = svnTemNm;
    }
```

- [ ] **Step 2: BprojmL에 동명 미러 필드 추가**

`BprojmL.java`의 `svnTemC` 필드(41행) 아래에 추가:

```java
    @Column(name = "SVN_DPM_NM", length = 100, comment = "주관부서명")
    private String svnDpmNm;

    @Column(name = "SVN_TEM_NM", length = 100, comment = "주관팀명")
    private String svnTemNm;
```

- [ ] **Step 3: ProjectService 생성 경로(:310 부근) 수정**

`OrgNameResolver` 주입 필드 추가 (기존 `authorOrgResolver` 필드 옆):

```java
    /** 조직코드→조직명 해석기: 주관부서명/주관팀명 스냅샷 저장용 */
    private final com.kdb.it.common.iam.service.OrgNameResolver orgNameResolver;
```

기존:
```java
        project.assignSvnTemC(authorOrgResolver.resolveCurrent().svnTemC());
        projectRepository.save(project);
```
변경:
```java
        project.assignSvnTemC(authorOrgResolver.resolveCurrent().svnTemC());
        // 주관부서명/주관팀명은 코드 설정 시점의 CORGNI 조회 스냅샷으로 함께 저장
        project.assignSvnOrgNames(
                orgNameResolver.resolveName(project.getSvnDpmC()),
                orgNameResolver.resolveName(project.getSvnTemC()));
        projectRepository.save(project);
```

- [ ] **Step 4: ProjectService 수정 경로(:424 update 호출 직후) 수정**

`project.update(new Bprojm.UpdateCommand(...));` 문 바로 다음에 추가:

```java
        // 수정으로 주관부서코드가 바뀔 수 있으므로 이름 스냅샷도 같은 시점 기준으로 갱신
        project.assignSvnOrgNames(
                orgNameResolver.resolveName(project.getSvnDpmC()),
                orgNameResolver.resolveName(project.getSvnTemC()));
```

- [ ] **Step 5: 기존 ProjectServiceTest에 mock 추가 + 검증 테스트**

`ProjectServiceTest.java`에 `@Mock private OrgNameResolver orgNameResolver;` 추가 (다른 `@Mock`들과 같은 위치, import `com.kdb.it.common.iam.service.OrgNameResolver`). lenient 기본 스텁이 필요하면 `@BeforeEach`에서:

```java
        org.mockito.Mockito.lenient().when(orgNameResolver.resolveName(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(null);
```

신규 테스트 (기존 create 성공 테스트의 요청 구성을 복사):

```java
    @Test
    @DisplayName("프로젝트 생성 시 주관부서명/주관팀명을 CORGNI 스냅샷으로 저장한다")
    void createProject_storesSvnOrgNameSnapshot() {
        // 기존 create 성공 테스트와 동일한 request/스텁 구성
        given(authorOrgResolver.resolveCurrent()).willReturn(new AuthorOrg("BBR001", "18010", "H001"));
        given(orgNameResolver.resolveName(request.getSvnDpmC())).willReturn("주관부서명A");
        given(orgNameResolver.resolveName("18010")).willReturn("PMO팀");

        // service.createProject(request) 호출 후 save 캡처
        // assertThat(saved.getSvnDpmNm()).isEqualTo("주관부서명A");
        // assertThat(saved.getSvnTemNm()).isEqualTo("PMO팀");
    }
```

- [ ] **Step 6: 테스트 실행**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.project.service.ProjectServiceTest"`
Expected: PASS (기존 + 신규). 워커 크래시 시 컴파일 검증 대체.

- [ ] **Step 7: Commit**

```bash
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/project src/main/java/com/kdb/it/domain/log/entity/BprojmL.java src/test/java/com/kdb/it/domain/budget/project
git -C C:\it\it_backend commit -m "feat: 정보화사업 주관부서명/주관팀명 스냅샷 저장"
```

---

### Task 6: Bcostm/BcostmL — 필드 추가 + 생성/수정 경로 이름 저장

**Files:**
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\cost\entity\Bcostm.java`
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\log\entity\BcostmL.java`
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\cost\service\CostService.java`
- Test: `C:\it\it_backend\src\test\java\com\kdb\it\domain\budget\cost\service\CostServiceTest.java`

- [ ] **Step 1: Bcostm 필드 + 이름 설정 메서드 추가**

`Bcostm.java`의 `svnTemC` 필드(123행) 아래에 추가:

```java
    /** 주관부서명: 코드 설정 시점 CORGNI 조회 스냅샷 (조직명 변경 시에도 과거 기록 유지, 최대 100자) */
    @Column(name = "SVN_DPM_NM", length = 100, comment = "주관부서명")
    private String svnDpmNm;

    /** 주관팀명: 코드 설정 시점 CORGNI 조회 스냅샷 (최대 100자) */
    @Column(name = "SVN_TEM_NM", length = 100, comment = "주관팀명")
    private String svnTemNm;
```

`assignPrlmHrkOgzCCone` 메서드(219행) 아래에 추가:

```java
    /**
     * 주관부서명/주관팀명 스냅샷 설정.
     *
     * <p>현재 엔티티에 설정된 담당부서코드/담당팀코드에 대응하는 조직명을 저장합니다.
     * 코드가 설정/변경되는 지점(생성·수정) 직후, INSERT/UPDATE flush 이전에 호출합니다.</p>
     *
     * @param svnDpmNm 주관부서명 (코드 미등록 시 null 허용)
     * @param svnTemNm 주관팀명 (코드 미등록 시 null 허용)
     */
    public void assignSvnOrgNames(String svnDpmNm, String svnTemNm) {
        this.svnDpmNm = svnDpmNm;
        this.svnTemNm = svnTemNm;
    }
```

- [ ] **Step 2: BcostmL에 동명 미러 필드 추가**

`BcostmL.java`의 `svnTemC` 필드(77행) 아래에 추가:

```java
    @Column(name = "SVN_DPM_NM", length = 100, comment = "주관부서명")
    private String svnDpmNm;

    @Column(name = "SVN_TEM_NM", length = 100, comment = "주관팀명")
    private String svnTemNm;
```

- [ ] **Step 3: CostService 생성 경로(:249-252) 수정**

`OrgNameResolver` 주입 필드 추가:

```java
    /** 조직코드→조직명 해석기: 주관부서명/주관팀명 스냅샷 저장용 */
    private final OrgNameResolver orgNameResolver;
```
import: `import com.kdb.it.common.iam.service.OrgNameResolver;`

기존:
```java
        Bcostm bcostm = request.toEntity(nextSno);
        // 인사상위조직코드내용(PRLM_HRK_OGZ_C_CONE)은 작성자(현재 로그인 사용자) 소속 상위조직코드로 자동 설정 (작성자 기준)
        bcostm.assignPrlmHrkOgzCCone(authorOrgResolver.resolveCurrent().prlmHrkOgzCCone());
        costRepository.save(bcostm);
```
변경 (`assignPrlmHrkOgzCCone` 다음 줄에 삽입):
```java
        Bcostm bcostm = request.toEntity(nextSno);
        // 인사상위조직코드내용(PRLM_HRK_OGZ_C_CONE)은 작성자(현재 로그인 사용자) 소속 상위조직코드로 자동 설정 (작성자 기준)
        bcostm.assignPrlmHrkOgzCCone(authorOrgResolver.resolveCurrent().prlmHrkOgzCCone());
        // 주관부서명/주관팀명은 코드 설정 시점의 CORGNI 조회 스냅샷으로 함께 저장
        bcostm.assignSvnOrgNames(
                orgNameResolver.resolveName(bcostm.getCostSvnDpmC()),
                orgNameResolver.resolveName(bcostm.getSvnTemC()));
        costRepository.save(bcostm);
```

- [ ] **Step 4: CostService 수정 경로(:325 target.update 호출 직후) 수정**

`target.update(...);` 문 바로 다음에 추가:

```java
        // 수정으로 담당부서/팀 코드가 바뀔 수 있으므로 이름 스냅샷도 같은 시점 기준으로 갱신
        target.assignSvnOrgNames(
                orgNameResolver.resolveName(target.getCostSvnDpmC()),
                orgNameResolver.resolveName(target.getSvnTemC()));
```

- [ ] **Step 5: CostServiceTest에 mock 추가 + 검증 테스트**

`CostServiceTest.java`에 `@Mock private OrgNameResolver orgNameResolver;` 추가. 기존 테스트가 깨지지 않도록 필요 시 lenient null 스텁 (Task 5 Step 5와 동일 패턴). 신규 테스트:

```java
    @Test
    @DisplayName("전산업무비 생성 시 주관부서명/주관팀명을 CORGNI 스냅샷으로 저장한다")
    void createCost_storesSvnOrgNameSnapshot() {
        // 기존 create 성공 테스트와 동일한 request/스텁 구성
        given(orgNameResolver.resolveName(request.getCostSvnDpmC())).willReturn("담당부서명A");
        given(orgNameResolver.resolveName(request.getSvnTemC())).willReturn("담당팀명A");

        // service 생성 호출 후 save 캡처
        // assertThat(saved.getSvnDpmNm()).isEqualTo("담당부서명A");
        // assertThat(saved.getSvnTemNm()).isEqualTo("담당팀명A");
    }
```

- [ ] **Step 6: 테스트 실행**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest"`
Expected: PASS. 워커 크래시 시 컴파일 검증 대체.

- [ ] **Step 7: Commit**

```bash
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/cost src/main/java/com/kdb/it/domain/log/entity/BcostmL.java src/test/java/com/kdb/it/domain/budget/cost
git -C C:\it\it_backend commit -m "feat: 전산업무비 주관부서명/주관팀명 스냅샷 저장"
```

---

### Task 7: 조회 폴백 — 저장값 우선, null이면 기존 CORGNI 조인

**Files:**
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\project\service\ProjectService.java:846-848, 951-958`
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\cost\service\CostService.java:666-668, 801-807`

- [ ] **Step 1: ProjectService 목록 주입부(:846-848) 수정**

기존:
```java
            if (response.getSvnDpmC() != null)
                response.setSvnDpmCNm(orgNameMap.get(response.getSvnDpmC()));
```
변경 (루프 안에서 `project` 변수 사용 가능 — `Bprojm project = projects.get(i);`):
```java
            if (project.getSvnDpmNm() != null)
                response.setSvnDpmCNm(project.getSvnDpmNm()); // 저장 스냅샷 우선
            else if (response.getSvnDpmC() != null)
                response.setSvnDpmCNm(orgNameMap.get(response.getSvnDpmC())); // 구데이터 폴백
```
(`dvmDpmCNm`은 스냅샷 컬럼이 없으므로 기존 로직 유지.)

- [ ] **Step 2: ProjectService 단건 조회부(:951-958 setCodeNames) 수정**

`setCodeNames(ProjectDto.Response response)`는 엔티티 접근이 없으므로, **호출부에서 스냅샷을 먼저 세팅**한다. `setCodeNames`를 호출하는 위치를 찾아(예: `getProject` 상세 조회) 그 직전에:

```java
        // 저장 스냅샷 우선 — setCodeNames의 CORGNI 조회는 null일 때만 폴백으로 동작
        if (project.getSvnDpmNm() != null) {
            response.setSvnDpmCNm(project.getSvnDpmNm());
        }
```
그리고 `setCodeNames` 내부의 주관부서 블록을 null 가드로 변경:
```java
        // 주관부서코드 → 주관부서명 (스냅샷이 이미 세팅됐으면 건너뜀)
        if (response.getSvnDpmCNm() == null
                && response.getSvnDpmC() != null && !response.getSvnDpmC().isEmpty()) {
            corgnIRepository.findById(response.getSvnDpmC())
                    .ifPresent(org -> response.setSvnDpmCNm(org.getBbrNm()));
        }
```

- [ ] **Step 3: CostService 목록 주입부(:666-668) 수정**

기존:
```java
            if (response.getCostSvnDpmC() != null)
                response.setCostSvnDpmNm(orgNameMap.get(response.getCostSvnDpmC()));
            if (response.getSvnTemC() != null)
                response.setSvnTemNm(orgNameMap.get(response.getSvnTemC()));
```
변경 (루프 안 `Bcostm cost = costs.get(i);` 사용):
```java
            if (cost.getSvnDpmNm() != null)
                response.setCostSvnDpmNm(cost.getSvnDpmNm()); // 저장 스냅샷 우선
            else if (response.getCostSvnDpmC() != null)
                response.setCostSvnDpmNm(orgNameMap.get(response.getCostSvnDpmC())); // 구데이터 폴백
            if (cost.getSvnTemNm() != null)
                response.setSvnTemNm(cost.getSvnTemNm());
            else if (response.getSvnTemC() != null)
                response.setSvnTemNm(orgNameMap.get(response.getSvnTemC()));
```

- [ ] **Step 4: CostService 단건 조회부(setCodeNames :801-807) 수정**

Task 7 Step 2와 동일 패턴 — `setCodeNames` 호출부 직전에 스냅샷 우선 세팅:

```java
        if (cost.getSvnDpmNm() != null) {
            response.setCostSvnDpmNm(cost.getSvnDpmNm());
        }
        if (cost.getSvnTemNm() != null) {
            response.setSvnTemNm(cost.getSvnTemNm());
        }
```
`setCodeNames` 내부 두 블록에 null 가드 추가:
```java
        if (response.getCostSvnDpmNm() == null
                && response.getCostSvnDpmC() != null && !response.getCostSvnDpmC().isEmpty()) {
            corgnIRepository.findById(response.getCostSvnDpmC())
                    .ifPresent(org -> response.setCostSvnDpmNm(org.getBbrNm()));
        }
        if (response.getSvnTemNm() == null
                && response.getSvnTemC() != null && !response.getSvnTemC().isEmpty()) {
            corgnIRepository.findById(response.getSvnTemC())
                    .ifPresent(org -> response.setSvnTemNm(org.getBbrNm()));
        }
```

- [ ] **Step 5: 테스트 실행 (기존 회귀 확인)**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.project.service.ProjectServiceTest" --tests "com.kdb.it.domain.budget.cost.service.CostServiceTest"`
Expected: PASS — 기존 테스트의 엔티티는 스냅샷 필드가 null이므로 폴백 경로로 기존 결과와 동일. 워커 크래시 시 컴파일 검증 대체.

- [ ] **Step 6: Commit**

```bash
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java
git -C C:\it\it_backend commit -m "feat: 주관부서명/팀명 조회 시 저장 스냅샷 우선, 구데이터는 CORGNI 폴백"
```

---

### Task 8: ServiceRequestDocDto Response에 이름 필드 노출

**Files:**
- Modify: `C:\it\it_backend\src\main\java\com\kdb\it\domain\budget\document\dto\ServiceRequestDocDto.java:160-210`

- [ ] **Step 1: Response 필드 추가**

`rvwFsgTlmDt` 필드(162행) 아래에 추가:

```java
        /** 주관부서명 (저장 스냅샷, 구버전 데이터는 null) */
        @Schema(description = "주관부서명")
        private String svnDpmNm;

        /** 주관팀명 (저장 스냅샷, 구버전 데이터는 null) */
        @Schema(description = "주관팀명")
        private String svnTemNm;
```

- [ ] **Step 2: fromEntity 매핑 추가**

`fromEntity`의 `.rvwFsgTlmDt(entity.getRvwFsgTlmDt())` 다음 줄에:

```java
                    .svnDpmNm(entity.getSvnDpmNm())
                    .svnTemNm(entity.getSvnTemNm())
```

- [ ] **Step 3: 컴파일 + 전체 문서 테스트**

Run: `cd C:\it\it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.document.*"`
Expected: PASS. 워커 크래시 시 컴파일 검증 대체.

- [ ] **Step 4: Commit**

```bash
git -C C:\it\it_backend add src/main/java/com/kdb/it/domain/budget/document/dto/ServiceRequestDocDto.java
git -C C:\it\it_backend commit -m "feat: 요구사항정의서 응답에 주관부서명/주관팀명 노출"
```

---

### Task 9: 프론트 — 요구사항정의서 목록/상세에 주관부서·팀명 표시

**Files:**
- Modify: `C:\it\it_frontend\app\composables\useDocuments.ts:21-35`
- Modify: `C:\it\it_frontend\app\pages\info\documents\list.vue` (작성자 컬럼 앞에 주관부서 컬럼)
- Modify: `C:\it\it_frontend\app\pages\info\documents\[id]\index.vue` (문서 개요 dl에 항목 추가)

- [ ] **Step 1: RequirementDocument 타입 확장**

`useDocuments.ts`의 `RequirementDocument` 인터페이스에 추가 (`rvwFsgTlmDt` 아래):

```ts
    svnDpmNm?: string; // 주관부서명 (저장 스냅샷, 구데이터 null)
    svnTemNm?: string; // 주관팀명 (저장 스냅샷, 구데이터 null)
```

- [ ] **Step 2: 목록 페이지에 주관부서 컬럼 추가**

`list.vue`의 등록일시 Column(290행 `field="fstEnrDtm"`) 앞에 삽입:

```vue
                    <!-- 주관부서 -->
                    <!-- 비율 고정 컬럼(10%) -->
                    <Column
                        field="svnDpmNm"
                        header="주관부서"
                        sortable
                        :style="{ width: '10%' }"
                        :pt="{ bodyCell: { style: 'text-align: center' } }"
                    >
                        <template #body="{ data }">
                            <span v-if="data.svnDpmNm">{{ data.svnDpmNm }}</span>
                            <span v-else class="text-zinc-400">-</span>
                        </template>
                    </Column>
```

기존 컬럼 폭 보정: `docMngNo` 14%→12%, `reqDttNo` 12%→10%, `bzDttNm` 12%→10% (합계 유지).

- [ ] **Step 3: 상세 페이지 문서 개요에 주관부서/팀 표시**

`[id]/index.vue`의 읽기 모드 핵심 정보 스트립(dl, `grid-cols-2 lg:grid-cols-4`)을 `lg:grid-cols-5`로 바꾸고, "업무구분" div 다음에 항목 추가:

```vue
                                <div class="p-4">
                                    <dt
                                        class="text-11 font-medium uppercase tracking-wide text-zinc-400 mb-1.5 flex items-center gap-1.5"
                                    >
                                        <i class="pi pi-building text-11" />주관부서/팀
                                    </dt>
                                    <dd
                                        class="font-semibold text-sm text-zinc-800 dark:text-zinc-100 whitespace-pre-wrap"
                                    >
                                        {{ doc.svnDpmNm || '-'
                                        }}{{ doc.svnTemNm ? ` / ${doc.svnTemNm}` : '' }}
                                    </dd>
                                </div>
```

주의: dl의 `[&>div:nth-child(3)]` 계열 반응형 보더 클래스는 4→5칸 변경에 맞춰 `[&>div:nth-child(5)]:border-t lg:[&>div:nth-child(5)]:border-t-0`를 추가.

- [ ] **Step 4: 정적 검증**

Run: `cd C:\it\it_frontend && npm run check`
Expected: 오류 0, 경고 0.

- [ ] **Step 5: Commit (it_frontend 저장소)**

```bash
git -C C:\it\it_frontend add app/composables/useDocuments.ts app/pages/info/documents/list.vue "app/pages/info/documents/[id]/index.vue"
git -C C:\it\it_frontend commit -m "feat: 요구사항정의서 목록/상세에 주관부서·팀명 표시"
```

---

### Task 10: 통합 검증 + 문서 갱신

**Files:**
- Modify: `C:\it\it_backend\CLAUDE.md` (§5.14.1 AuthorOrg 패턴 문단)
- Modify: `C:\it\it_backend\docs\guides\data-model.md` (필요 시 컬럼 추가 반영)

- [ ] **Step 1: 백엔드 전체 컴파일 + 테스트**

Run: `cd C:\it\it_backend && ./gradlew test`
Expected: PASS. 워커 크래시로 실행 불가 시 `./gradlew compileJava compileTestJava` 성공 확인 후 그 사실을 최종 보고에 명시.

- [ ] **Step 2: 프론트 전체 검증**

Run: `cd C:\it\it_frontend && npm run check && npm test`
Expected: 모두 통과.

- [ ] **Step 3: 수동 E2E 스모크 (서버 기동 상태라면)**

백엔드(`./gradlew bootRun`)와 프론트(`npm run dev`)가 떠 있으면:
1. 요구사항정의서 신규 작성 → 목록에서 주관부서 컬럼에 작성자 소속 부서명 표시 확인.
2. 상세 화면 문서 개요에 주관부서/팀 표시 확인.
3. DB 확인: `SELECT DOC_MNG_NO, SVN_DPM_C, SVN_DPM_NM, SVN_TEM_C, SVN_TEM_NM FROM ITPOWN.TPRMPP_BRDOCM ORDER BY FST_ENR_DTM DESC FETCH FIRST 3 ROWS ONLY;`
4. 로그 미러 확인: 동일 SELECT를 `TPRMPP_BRDOCL`에 대해 실행 — 이름 컬럼이 함께 복사됐는지 확인.
서버가 없으면 이 스텝은 스킵하고 보고에 명시.

- [ ] **Step 4: CLAUDE.md §5.14.1 갱신**

`it_backend/CLAUDE.md` §5.14.1의 "적용 컬럼(물리)" 문단에 다음 내용을 반영:

- 적용 컬럼에 `BPROJM/BCOSTM/BRDOCM.SVN_DPM_NM/SVN_TEM_NM`(주관부서명/주관팀명 스냅샷) 추가.
- "코드 설정 지점에서 `OrgNameResolver.resolveName()`로 이름을 함께 저장(저장 시점 스냅샷)하며, 조회 시 저장값 우선·null이면 CORGNI 조인 폴백" 규칙 1-2문장 추가.
- 마이그레이션 목록에 `V20260708_004__AddSvnOrgNameColumns.sql` 추가.

- [ ] **Step 5: data-model.md 확인 및 갱신**

`it_backend/docs/guides/data-model.md`에서 BPROJM/BCOSTM/BRDOCM 컬럼 목록이 개별 나열되어 있으면 SVN_DPM_NM/SVN_TEM_NM 추가. 테이블 매핑만 있으면 변경 불필요.

- [ ] **Step 6: Commit**

```bash
git -C C:\it\it_backend add CLAUDE.md docs/guides/data-model.md
git -C C:\it\it_backend commit -m "docs: 주관부서명/주관팀명 스냅샷 패턴 반영"
```
