# SEC-05 비게시판 업무 파일 읽기 인가 (종류별 부모권한 완전 매핑) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 업무 파일 읽기를 default-deny로 전환하고, 파일 종류(`PK_COL_NM`)별 authorizer가 부모 자원의 읽기 권한을 재사용하도록 매핑한다. 목록·메타·다운로드·미리보기에 동일 적용한다.

**Architecture:** 먼저 Flyway로 뒤바뀐 레거시 `PK_COL_NM`/`PK_CONE` 49건을 멱등 정규화하고, 부모 ID를 복구할 수 없는 행은 관리자 전용 격리 상태로 유지한다. 이후 `FileReadAuthorizer` 인터페이스와 종류별 레지스트리(미등록 종류=관리자만)를 도입한다. `FileOwnershipChecker`는 단건 권한 거부를 403으로 반환하고, `FileService.getFiles`는 같은 부모 판정을 요청당 한 번만 계산한다. 파일 정책은 현재 부모 상세 API보다 의도적으로 엄격한 파일 전용 경계이며, 네 HTTP 읽기 경로를 각각 검증한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, JUnit 5, Mockito, AssertJ. 통합 테스트는 로컬 Oracle `@Tag("it")` 하네스.

**참조 스펙:** `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md` §3.2

## Global Constraints

- 인가 전환 전에 복구 가능한 레거시 부모 키를 Flyway로 정규화한다.
- 부모 ID가 없거나 부모가 존재하지 않는 파일은 일반 사용자에게 허용하지 않고 관리자만 볼 수 있다.
- 미등록 종류, null 종류, null 부모 ID는 default-deny다.
- 비인증 사용자는 공개 게시판 파일을 포함해 파일 API에서 허용하지 않는다.
- 권한 없음은 `AccessDeniedException`으로 403, 파일 없음은 기존 `CustomGeneralException` 계약으로 구분한다.
- 목록·메타·다운로드·미리보기는 모두 같은 `FileOwnershipChecker` 정책을 통과한다.
- 목록의 부모 조회는 서로 다른 `(PK_COL_NM, PK_CONE)` 수만큼만 실행한다.
- 신규 JavaDoc과 인라인 주석은 한글로 작성한다.

**종류별 읽기 규칙(확정):**

| PK_COL_NM | 부모 | 규칙 |
| --- | --- | --- |
| `요구사항정의서` | `Brdocm` (`DOC_MNG_NO`) | 관리자 OR 작성자(`FST_ENR_USID`) OR 주관부서(`SVN_DPM_C==bbrC`) |
| `가이드문서` | `Bgdocm` | 전사 공개(인증 사용자 전체) — 명시적 allow |
| `사업계획서`·`타당성검토표`·`협의회관련자료` | 협의회(`IT_PTL_ASCT_ID`) | 관리자/정보보안관리자 OR 협의회 위원 OR 관련부서(협의회 사업 `BPROJM.SVN_DPM_C==bbrC`) |
| `공통게시판` | `Cblbcm` (`NAC_MNG_NO`) | 관리자 OR 게시물 공개(현행 유지) |
| (미등록 종류) | — | 관리자만 (default-deny, fail-safe) |

---

## File Structure

- Create: `it_database/migrations/V20260719_001__NormalizeCfilemParentKeys.sql`
  - 뒤바뀐 레거시 부모 키 49건을 멱등 정규화.
- Create: `it_backend/docs/guides/security/file-read-migration.md`
  - 사전/사후 SQL, 격리 파일 목록, 수동 재연결 절차.
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/FileReadAuthorizer.java` (인터페이스)
- Create: `.../infra/file/authz/FileReadAuthorizerRegistry.java` (종류→authorizer 매핑 + default-deny)
- Create: `.../infra/file/authz/GuideDocFileReadAuthorizer.java`
- Create: `.../infra/file/authz/BoardFileReadAuthorizer.java` (기존 게시물 가시성 로직 이관)
- Create: `.../infra/file/authz/RequirementDocFileReadAuthorizer.java`
- Create: `.../infra/file/authz/CouncilFileReadAuthorizer.java`
- Modify: `.../infra/file/FileOwnershipChecker.java` (canRead → 레지스트리 위임, 게시판 분기·boardPostRepository 제거)
- Create (test): `authz/FileReadAuthorizerRegistryTest.java`, `GuideDocFileReadAuthorizerTest.java`, `BoardFileReadAuthorizerTest.java`, `RequirementDocFileReadAuthorizerTest.java`, `CouncilFileReadAuthorizerTest.java`
- Modify (test): `infra/file/FileOwnershipCheckerTest.java` (게시판·비게시판 무조건 허용 테스트 이관/삭제, 레지스트리 위임 검증으로 전환)
- Modify: `infra/file/service/FileService.java`와 `FileServiceTest.java` (부모별 판정 캐시로 N+1 방지)
- Modify: `infra/file/controller/FileControllerTest.java` (목록·메타·다운로드·미리보기 HTTP 계약)
- Modify (docs): `it_backend/CLAUDE.md` §5, `it_backend/docs/guides/security/file-security.md`, `it_backend/docs/guides/security/data-scope.md`
- Create (통합): `.../infra/file/FileReadAuthorizationIT.java` (`@Tag("it")`)

---

## Task 0: 레거시 부모 키 정규화와 격리 배포 게이트

**Files:**
- Create: `it_database/migrations/V20260719_001__NormalizeCfilemParentKeys.sql`
- Create: `it_backend/docs/guides/security/file-read-migration.md`

**확인된 기준선(2026-07-19 로컬 Oracle, `DEL_YN='N'`):** 활성 57건은 뒤바뀐 요구사항정의서 20건 + 뒤바뀐 가이드문서 29건 + 정상 1건 + 부모 ID 복구 불가 7건이다. 정규화 후에는 정상 방향 50건과 격리 7건이 된다.

- [ ] **Step 1: 배포 전 분류 SQL 실행·보관**

```sql
SELECT CASE
         WHEN PK_CONE IN ('요구사항정의서', '가이드문서', '사업계획서',
                          '타당성검토표', '협의회관련자료', '공통게시판')
              AND PK_COL_NM IS NOT NULL THEN 'SWAPPED_RECOVERABLE'
         WHEN PK_COL_NM IN ('요구사항정의서', '가이드문서', '사업계획서',
                            '타당성검토표', '협의회관련자료', '공통게시판')
              AND PK_CONE IS NOT NULL THEN 'CANONICAL'
         ELSE 'QUARANTINED'
       END AS SHAPE,
       COUNT(*) AS CNT
FROM TPRMPP_CFILEM
WHERE DEL_YN = 'N'
GROUP BY CASE
           WHEN PK_CONE IN ('요구사항정의서', '가이드문서', '사업계획서',
                            '타당성검토표', '협의회관련자료', '공통게시판')
                AND PK_COL_NM IS NOT NULL THEN 'SWAPPED_RECOVERABLE'
           WHEN PK_COL_NM IN ('요구사항정의서', '가이드문서', '사업계획서',
                              '타당성검토표', '협의회관련자료', '공통게시판')
                AND PK_CONE IS NOT NULL THEN 'CANONICAL'
           ELSE 'QUARANTINED'
         END;
```

결과와 격리 행의 `FL_MPN_ID, FL_NM, PK_COL_NM, PK_CONE`를 `file-read-migration.md` 배포 기록 표에 붙인다. 파일 경로나 파일 본문은 기록하지 않는다.

- [ ] **Step 2: 멱등 Flyway migration 작성**

```sql
UPDATE TPRMPP_CFILEM
SET PK_COL_NM = PK_CONE,
    PK_CONE = PK_COL_NM
WHERE PK_CONE IN ('요구사항정의서', '가이드문서', '사업계획서',
                  '타당성검토표', '협의회관련자료', '공통게시판')
  AND PK_COL_NM IS NOT NULL
  AND PK_COL_NM NOT IN ('요구사항정의서', '가이드문서', '사업계획서',
                        '타당성검토표', '협의회관련자료', '공통게시판');
```

Oracle은 같은 `SET` 절의 우변을 변경 전 행 기준으로 평가하므로 두 컬럼이 교환된다. 재실행 시 `PK_CONE`이 더 이상 종류 값이 아니어서 0건 갱신된다. 성공한 Flyway 파일은 이후 수정하지 않는다.

- [ ] **Step 3: 사후 게이트와 격리 목록 확인**

```sql
SELECT COUNT(*) AS RECOVERABLE_REMAINING
FROM TPRMPP_CFILEM
WHERE DEL_YN = 'N'
  AND PK_CONE IN ('요구사항정의서', '가이드문서', '사업계획서',
                  '타당성검토표', '협의회관련자료', '공통게시판')
  AND PK_COL_NM IS NOT NULL;

SELECT FL_MPN_ID, FL_NM, PK_COL_NM, PK_CONE
FROM TPRMPP_CFILEM
WHERE DEL_YN = 'N'
  AND (PK_COL_NM IS NULL OR PK_CONE IS NULL
       OR PK_COL_NM NOT IN ('요구사항정의서', '가이드문서', '사업계획서',
                            '타당성검토표', '협의회관련자료', '공통게시판'))
ORDER BY FL_MPN_ID;
```

첫 쿼리는 반드시 0이어야 한다. 두 번째 결과는 관리자만 접근 가능한 격리 목록이며 자동 추정·삭제하지 않는다. 관리자가 원 업무 화면과 대조해 부모를 확정한 경우에만 기존 메타 수정 API로 재연결하고 변경 이력을 남긴다. 예상하지 못한 종류가 나오면 인가 코드 배포를 중단하고 authorizer 규칙을 먼저 확정한다.

- [ ] **Step 4: migration 적용·커밋**

Run: `cd it_backend && ./gradlew bootRun --args="--spring.profiles.active=local-int"`

Expected: 애플리케이션 기동 로그에서 `V20260719.001` migration 성공 확인. 확인 후 프로세스를 정상 종료하고 사후 SQL을 실행해 `RECOVERABLE_REMAINING=0`, 현재 기준 격리 7건을 확인한다. 운영은 `spring.flyway.enabled=false`이므로 승인된 DB 배포 절차에서 같은 migration을 먼저 적용한 뒤 애플리케이션을 배포한다.

```bash
cd C:/it
git add it_database/migrations/V20260719_001__NormalizeCfilemParentKeys.sql it_backend/docs/guides/security/file-read-migration.md
git commit -m "fix(data): 파일 부모 키 레거시 형태 정규화 (SEC-05)"
```

---

## Task 1: 인터페이스 + 레지스트리 (default-deny) — RED → GREEN

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/FileReadAuthorizer.java`
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/FileReadAuthorizerRegistry.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/file/authz/FileReadAuthorizerRegistryTest.java`

- [ ] **Step 1: 레지스트리 실패 테스트 작성**

Create `FileReadAuthorizerRegistryTest.java`:

```java
package com.kdb.it.infra.file.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class FileReadAuthorizerRegistryTest {

    private Cfilem fileOfKind(String kind) {
        Cfilem file = mock(Cfilem.class);
        when(file.getPkColNm()).thenReturn(kind);
        return file;
    }

    private FileReadAuthorizer authorizer(Set<String> kinds, boolean result) {
        return new FileReadAuthorizer() {
            @Override public Set<String> supportedPkColNms() { return kinds; }
            @Override public boolean canRead(Cfilem file, CustomUserDetails user) { return result; }
        };
    }

    @Test
    @DisplayName("등록된 종류는 해당 authorizer 결과로 위임한다")
    void registeredKind_delegates() {
        var registry = new FileReadAuthorizerRegistry(List.of(authorizer(Set.of("요구사항정의서"), true)));
        CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "IT001");
        assertThat(registry.canRead(fileOfKind("요구사항정의서"), user)).isTrue();
    }

    @Test
    @DisplayName("미등록 종류는 관리자만 허용한다(default-deny)")
    void unregisteredKind_adminOnly() {
        var registry = new FileReadAuthorizerRegistry(List.of(authorizer(Set.of("요구사항정의서"), true)));
        CustomUserDetails normal = new CustomUserDetails("E001", List.of("ITPZZ001"), "IT001");
        CustomUserDetails admin = new CustomUserDetails("A001", List.of("ITPAD001"), "IT001");
        assertThat(registry.canRead(fileOfKind("미지정종류"), normal)).isFalse();
        assertThat(registry.canRead(fileOfKind("미지정종류"), admin)).isTrue();
    }

    @Test
    @DisplayName("동일 종류를 두 authorizer가 등록하면 기동 시 예외로 막는다")
    void duplicateKind_throws() {
        assertThatThrownBy(() -> new FileReadAuthorizerRegistry(List.of(
                authorizer(Set.of("요구사항정의서"), true),
                authorizer(Set.of("요구사항정의서"), false))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("중복");
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.FileReadAuthorizerRegistryTest"`
Expected: 컴파일 실패 — `FileReadAuthorizer`/`FileReadAuthorizerRegistry` 미존재.

- [ ] **Step 3: 인터페이스 작성**

Create `FileReadAuthorizer.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.Set;

/**
 * 파일 종류(PK_COL_NM)별 읽기 권한 판정기.
 *
 * <p>각 구현은 담당 종류 집합({@link #supportedPkColNms()})을 선언하고,
 * 해당 종류 파일의 부모 자원 읽기 권한을 재사용해 읽기 가능 여부를 판정한다.</p>
 */
public interface FileReadAuthorizer {

    /** 이 판정기가 담당하는 파일 종류(PK_COL_NM) 집합. */
    Set<String> supportedPkColNms();

    /**
     * 읽기 가능 여부.
     *
     * @param file 대상 파일
     * @param user 현재 사용자(null이면 비인증)
     * @return 읽기 가능하면 true
     */
    boolean canRead(Cfilem file, CustomUserDetails user);
}
```

- [ ] **Step 4: 레지스트리 작성**

Create `FileReadAuthorizerRegistry.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 파일 종류별 {@link FileReadAuthorizer}를 수집·조회하는 레지스트리.
 *
 * <p>등록되지 않은 종류는 관리자만 허용한다(default-deny). 신규 종류 추가 시 authorizer 등록을 강제한다.</p>
 */
@Component
public class FileReadAuthorizerRegistry {

    private final Map<String, FileReadAuthorizer> byKind;

    public FileReadAuthorizerRegistry(List<FileReadAuthorizer> authorizers) {
        Map<String, FileReadAuthorizer> map = new HashMap<>();
        for (FileReadAuthorizer authorizer : authorizers) {
            for (String kind : authorizer.supportedPkColNms()) {
                FileReadAuthorizer previous = map.put(kind, authorizer);
                if (previous != null) {
                    throw new IllegalStateException("파일 종류 authorizer 중복 등록: " + kind);
                }
            }
        }
        this.byKind = Map.copyOf(map);
    }

    /**
     * 파일 읽기 가능 여부. 미등록 종류는 관리자만 허용한다(default-deny).
     */
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        FileReadAuthorizer authorizer = byKind.get(file.getPkColNm());
        if (authorizer == null) {
            return user != null && user.isAdmin();
        }
        return authorizer.canRead(file, user);
    }
}
```

- [ ] **Step 5: 통과 확인 + 커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.FileReadAuthorizerRegistryTest"`
Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/infra/file/authz/FileReadAuthorizer.java src/main/java/com/kdb/it/infra/file/authz/FileReadAuthorizerRegistry.java src/test/java/com/kdb/it/infra/file/authz/FileReadAuthorizerRegistryTest.java
git commit -m "feat(file): 파일 읽기 authorizer 인터페이스·레지스트리(default-deny) 추가 (SEC-05)"
```

---

## Task 2: 가이드문서 authorizer (전사 공개) — RED → GREEN

**Files:**
- Create: `.../infra/file/authz/GuideDocFileReadAuthorizer.java`
- Test: `.../infra/file/authz/GuideDocFileReadAuthorizerTest.java`

- [ ] **Step 1: 실패 테스트 작성**

Create `GuideDocFileReadAuthorizerTest.java`:

```java
package com.kdb.it.infra.file.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class GuideDocFileReadAuthorizerTest {

    private final GuideDocFileReadAuthorizer authorizer = new GuideDocFileReadAuthorizer();

    @Test
    @DisplayName("가이드문서 종류를 담당한다")
    void supports_guideDoc() {
        assertThat(authorizer.supportedPkColNms()).containsExactly("가이드문서");
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

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.GuideDocFileReadAuthorizerTest"`
Expected: 컴파일 실패 — 클래스 미존재.

- [ ] **Step 3: 구현**

Create `GuideDocFileReadAuthorizer.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * 가이드문서 첨부 읽기 판정기 — 전사 공개(인증 사용자 전체).
 *
 * <p>가이드는 전 직원 참고 자료이므로 인증된 사용자에게 읽기를 허용한다.
 * (default-deny의 명시적 예외)</p>
 */
@Component
public class GuideDocFileReadAuthorizer implements FileReadAuthorizer {

    @Override
    public Set<String> supportedPkColNms() {
        return Set.of("가이드문서");
    }

    @Override
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        return user != null; // 전사 공개: 인증 사용자 전체
    }
}
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.GuideDocFileReadAuthorizerTest"`
Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/infra/file/authz/GuideDocFileReadAuthorizer.java src/test/java/com/kdb/it/infra/file/authz/GuideDocFileReadAuthorizerTest.java
git commit -m "feat(file): 가이드문서 파일 전사 공개 authorizer 추가 (SEC-05)"
```

---

## Task 3: 게시판 authorizer (게시물 가시성 이관) — RED → GREEN

**Files:**
- Create: `.../infra/file/authz/BoardFileReadAuthorizer.java`
- Test: `.../infra/file/authz/BoardFileReadAuthorizerTest.java`

- [ ] **Step 1: 실패 테스트 작성**

기존 `FileOwnershipCheckerTest`의 게시물 가시성 시나리오를 authorizer 단위로 이관한다. Create `BoardFileReadAuthorizerTest.java`:

```java
package com.kdb.it.infra.file.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kdb.it.common.board.entity.Cblbcm;
import com.kdb.it.common.board.repository.BoardPostRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BoardFileReadAuthorizerTest {

    private final BoardPostRepository boardPostRepository = mock(BoardPostRepository.class);
    private final BoardFileReadAuthorizer authorizer = new BoardFileReadAuthorizer(boardPostRepository);

    private final CustomUserDetails normalUser = new CustomUserDetails("E001", List.of("ITPZZ001"), "IT001");
    private final CustomUserDetails adminUser = new CustomUserDetails("A001", List.of("ITPAD001"), "IT001");

    private Cfilem boardFile(String nacMngNo) {
        Cfilem file = mock(Cfilem.class);
        when(file.getPkCone()).thenReturn(nacMngNo);
        return file;
    }

    private Cblbcm post(String sreYn, LocalDate stt, LocalDate end) {
        return Cblbcm.builder()
                .nacMngNo("NAC-1").blbMngNo("BLBM-1").nacNm("게시물")
                .sreYn(sreYn).sttDt(stt).endDt(end)
                .nacInqNbr(0).flNbr(0).flApgYn("N").ancYn("N")
                .nacUnqId("NAC-1").nacGrpSqn(0).nacGrpLev(0).delYn("N")
                .build();
    }

    @Test
    @DisplayName("공통게시판 종류를 담당한다")
    void supports_board() {
        assertThat(authorizer.supportedPkColNms()).containsExactly("공통게시판");
    }

    @Test
    @DisplayName("관리자는 게시물 조회 없이 읽기 가능")
    void admin_canRead() {
        assertThat(authorizer.canRead(mock(Cfilem.class), adminUser)).isTrue();
    }

    @Test
    @DisplayName("게시물이 없으면 읽기 불가")
    void postNotFound_cannotRead() {
        given(boardPostRepository.findByNacMngNoAndDelYn("NAC-1", "N")).willReturn(Optional.empty());
        assertThat(authorizer.canRead(boardFile("NAC-1"), normalUser)).isFalse();
    }

    @Test
    @DisplayName("비공개(sreYn=N) 게시물은 읽기 불가")
    void hiddenPost_cannotRead() {
        given(boardPostRepository.findByNacMngNoAndDelYn("NAC-1", "N"))
                .willReturn(Optional.of(post("N", null, null)));
        assertThat(authorizer.canRead(boardFile("NAC-1"), normalUser)).isFalse();
    }

    @Test
    @DisplayName("공개중(sreYn=Y, 기간 내) 게시물은 읽기 가능")
    void visiblePost_canRead() {
        given(boardPostRepository.findByNacMngNoAndDelYn("NAC-1", "N"))
                .willReturn(Optional.of(post("Y", LocalDate.now().minusDays(1), LocalDate.now().plusDays(1))));
        assertThat(authorizer.canRead(boardFile("NAC-1"), normalUser)).isTrue();
    }

    @Test
    @DisplayName("공개 시작 전(sttDt 미래) 게시물은 읽기 불가")
    void notStartedPost_cannotRead() {
        given(boardPostRepository.findByNacMngNoAndDelYn("NAC-1", "N"))
                .willReturn(Optional.of(post("Y", LocalDate.now().plusDays(1), null)));
        assertThat(authorizer.canRead(boardFile("NAC-1"), normalUser)).isFalse();
    }

    @Test
    @DisplayName("공개 종료(endDt 과거) 게시물은 읽기 불가")
    void expiredPost_cannotRead() {
        given(boardPostRepository.findByNacMngNoAndDelYn("NAC-1", "N"))
                .willReturn(Optional.of(post("Y", null, LocalDate.now().minusDays(1))));
        assertThat(authorizer.canRead(boardFile("NAC-1"), normalUser)).isFalse();
    }

    @Test
    @DisplayName("비인증 사용자와 부모 ID 없는 파일은 읽기 불가")
    void unauthenticatedOrNullParent_cannotRead() {
        assertThat(authorizer.canRead(boardFile("NAC-1"), null)).isFalse();
        assertThat(authorizer.canRead(boardFile(null), normalUser)).isFalse();
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.BoardFileReadAuthorizerTest"`
Expected: 컴파일 실패 — 클래스 미존재.

- [ ] **Step 3: 구현 (FileOwnershipChecker.isPostVisible 로직 이관)**

Create `BoardFileReadAuthorizer.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.board.entity.Cblbcm;
import com.kdb.it.common.board.repository.BoardPostRepository;
import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.infra.file.entity.Cfilem;
import java.time.LocalDate;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 공통게시판 첨부 읽기 판정기 — 관리자 OR 게시물 공개(화면표시 + 공개기간).
 *
 * <p>기존 {@code FileOwnershipChecker}의 게시물 가시성 규칙을 이관한 것이다.</p>
 */
@Component
@RequiredArgsConstructor
public class BoardFileReadAuthorizer implements FileReadAuthorizer {

    private final BoardPostRepository boardPostRepository;

    @Override
    public Set<String> supportedPkColNms() {
        return Set.of("공통게시판");
    }

    @Override
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        if (user == null) {
            return false;
        }
        if (user.isAdmin()) {
            return true;
        }
        if (!org.springframework.util.StringUtils.hasText(file.getPkCone())) {
            return false;
        }
        return boardPostRepository.findByNacMngNoAndDelYn(file.getPkCone(), "N")
                .map(this::isPostVisible)
                .orElse(false);
    }

    /** 게시물 공개 여부 — 화면표시(sreYn=Y)이고 공개기간(sttDt~endDt) 내. */
    private boolean isPostVisible(Cblbcm post) {
        LocalDate today = LocalDate.now();
        return "Y".equals(post.getSreYn())
                && (post.getSttDt() == null || !post.getSttDt().isAfter(today))
                && (post.getEndDt() == null || !post.getEndDt().isBefore(today));
    }
}
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.BoardFileReadAuthorizerTest"`
Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/infra/file/authz/BoardFileReadAuthorizer.java src/test/java/com/kdb/it/infra/file/authz/BoardFileReadAuthorizerTest.java
git commit -m "feat(file): 공통게시판 파일 게시물 가시성 authorizer 추가 (SEC-05)"
```

---

## Task 4: 요구사항정의서 authorizer (부서·소유자·관리자) — RED → GREEN

**Files:**
- Create: `.../infra/file/authz/RequirementDocFileReadAuthorizer.java`
- Test: `.../infra/file/authz/RequirementDocFileReadAuthorizerTest.java`

> 배경: `Brdocm`은 복합키(`DOC_MNG_NO`,`DOC_VRS_SNO`) 버전 엔티티라 최신 버전 로더 `findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc(docMngNo,"N")`를 사용한다(리포지토리 `ServiceRequestDocRepository`). 주관부서 `getSvnDpmC()`, 작성자 `getFstEnrUsid()`.

- [ ] **Step 1: 실패 테스트 작성**

Create `RequirementDocFileReadAuthorizerTest.java`:

```java
package com.kdb.it.infra.file.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.document.entity.Brdocm;
import com.kdb.it.domain.budget.document.repository.ServiceRequestDocRepository;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RequirementDocFileReadAuthorizerTest {

    private final ServiceRequestDocRepository docRepository = mock(ServiceRequestDocRepository.class);
    private final RequirementDocFileReadAuthorizer authorizer =
            new RequirementDocFileReadAuthorizer(docRepository);

    private Cfilem file(String docMngNo) {
        Cfilem f = mock(Cfilem.class);
        when(f.getPkCone()).thenReturn(docMngNo);
        return f;
    }

    private Brdocm doc(String owner, String svnDpmC) {
        Brdocm d = mock(Brdocm.class);
        when(d.getFstEnrUsid()).thenReturn(owner);
        when(d.getSvnDpmC()).thenReturn(svnDpmC);
        return d;
    }

    @Test
    @DisplayName("요구사항정의서 종류를 담당한다")
    void supports_requirementDoc() {
        assertThat(authorizer.supportedPkColNms()).containsExactly("요구사항정의서");
    }

    @Test
    @DisplayName("관리자는 문서 조회 없이 읽기 가능")
    void admin_canRead() {
        CustomUserDetails admin = new CustomUserDetails("A001", List.of("ITPAD001"), "IT001");
        assertThat(authorizer.canRead(mock(Cfilem.class), admin)).isTrue();
    }

    @Test
    @DisplayName("작성자 본인은 읽기 가능")
    void owner_canRead() {
        given(docRepository.findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc("DOC-1", "N"))
                .willReturn(Optional.of(doc("E001", "DEPT-A")));
        CustomUserDetails owner = new CustomUserDetails("E001", List.of("ITPZZ001"), "DEPT-B");
        assertThat(authorizer.canRead(file("DOC-1"), owner)).isTrue();
    }

    @Test
    @DisplayName("주관부서 동일 사용자는 읽기 가능")
    void sameDept_canRead() {
        given(docRepository.findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc("DOC-1", "N"))
                .willReturn(Optional.of(doc("E001", "DEPT-A")));
        CustomUserDetails sameDept = new CustomUserDetails("E999", List.of("ITPZZ001"), "DEPT-A");
        assertThat(authorizer.canRead(file("DOC-1"), sameDept)).isTrue();
    }

    @Test
    @DisplayName("타부서·타인은 읽기 불가")
    void otherDeptOther_cannotRead() {
        given(docRepository.findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc("DOC-1", "N"))
                .willReturn(Optional.of(doc("E001", "DEPT-A")));
        CustomUserDetails other = new CustomUserDetails("E999", List.of("ITPZZ001"), "DEPT-B");
        assertThat(authorizer.canRead(file("DOC-1"), other)).isFalse();
    }

    @Test
    @DisplayName("문서가 없으면 읽기 불가")
    void docNotFound_cannotRead() {
        given(docRepository.findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc("DOC-X", "N"))
                .willReturn(Optional.empty());
        CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "DEPT-A");
        assertThat(authorizer.canRead(file("DOC-X"), user)).isFalse();
    }

    @Test
    @DisplayName("부모 ID가 없으면 읽기 불가")
    void nullParent_cannotRead() {
        CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "DEPT-A");
        assertThat(authorizer.canRead(file(null), user)).isFalse();
    }
}
```

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.RequirementDocFileReadAuthorizerTest"`
Expected: 컴파일 실패 — 클래스 미존재.

- [ ] **Step 3: 구현**

Create `RequirementDocFileReadAuthorizer.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.document.repository.ServiceRequestDocRepository;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.Objects;

/**
 * 요구사항정의서 첨부 읽기 판정기 — 관리자 OR 작성자 OR 주관부서.
 *
 * <p>부모 문서({@code Brdocm})의 최신 버전을 조회해 작성자({@code FST_ENR_USID}) 또는
 * 주관부서({@code SVN_DPM_C})와 현재 사용자를 비교한다.</p>
 */
@Component
@RequiredArgsConstructor
public class RequirementDocFileReadAuthorizer implements FileReadAuthorizer {

    private final ServiceRequestDocRepository serviceRequestDocRepository;

    @Override
    public Set<String> supportedPkColNms() {
        return Set.of("요구사항정의서");
    }

    @Override
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        if (user == null) {
            return false;
        }
        if (user.isAdmin()) {
            return true;
        }
        if (!org.springframework.util.StringUtils.hasText(file.getPkCone())) {
            return false;
        }
        return serviceRequestDocRepository
                .findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc(file.getPkCone(), "N")
                .map(doc -> Objects.equals(user.getEno(), doc.getFstEnrUsid())
                        || Objects.equals(user.getBbrC(), doc.getSvnDpmC()))
                .orElse(false);
    }
}
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.RequirementDocFileReadAuthorizerTest"`
Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/infra/file/authz/RequirementDocFileReadAuthorizer.java src/test/java/com/kdb/it/infra/file/authz/RequirementDocFileReadAuthorizerTest.java
git commit -m "feat(file): 요구사항정의서 파일 부서·소유자 authorizer 추가 (SEC-05)"
```

---

## Task 5: 협의회 연계 authorizer (관리자/정보보안+위원+관련부서) — RED → GREEN

**Files:**
- Create: `.../infra/file/authz/CouncilFileReadAuthorizer.java`
- Test: `.../infra/file/authz/CouncilFileReadAuthorizerTest.java`

> 배경: 세 종류 모두 `PK_CONE=IT_PTL_ASCT_ID`. 위원 여부는 `CommitteeRepository.findByItPtlAsctIdAndEnoAndDelYn(asctId, eno, "N")`. 관련부서는 협의회(`CouncilRepository.findByItPtlAsctIdAndDelYn`)→사업(`ProjectRepository.findById(new BprojmId(abusMngNo, sno))`)→`getSvnDpmC()`를 사용자 `bbrC`와 비교.

- [ ] **Step 1: 실패 테스트 작성**

Create `CouncilFileReadAuthorizerTest.java`:

```java
package com.kdb.it.infra.file.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.project.entity.Bprojm;
import com.kdb.it.domain.budget.project.entity.BprojmId;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.council.entity.Basctm;
import com.kdb.it.domain.council.entity.Bcmmtm;
import com.kdb.it.domain.council.repository.CommitteeRepository;
import com.kdb.it.domain.council.repository.CouncilRepository;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class CouncilFileReadAuthorizerTest {

    private final CouncilRepository councilRepository = mock(CouncilRepository.class);
    private final CommitteeRepository committeeRepository = mock(CommitteeRepository.class);
    private final ProjectRepository projectRepository = mock(ProjectRepository.class);
    private final CouncilFileReadAuthorizer authorizer =
            new CouncilFileReadAuthorizer(councilRepository, committeeRepository, projectRepository);

    private Cfilem file(String asctId) {
        Cfilem f = mock(Cfilem.class);
        when(f.getPkCone()).thenReturn(asctId);
        return f;
    }

    @Test
    @DisplayName("세 협의회 종류를 담당한다")
    void supports_threeCouncilKinds() {
        assertThat(authorizer.supportedPkColNms())
                .containsExactlyInAnyOrder("사업계획서", "타당성검토표", "협의회관련자료");
    }

    @Test
    @DisplayName("정보보안관리자는 위원·부서 조회 없이 읽기 가능")
    void infoSecAdmin_canRead() {
        CustomUserDetails infosec = new CustomUserDetails("S001", List.of("ITPAD002"), "IT001");
        assertThat(authorizer.canRead(mock(Cfilem.class), infosec)).isTrue();
    }

    @Test
    @DisplayName("해당 협의회 위원은 읽기 가능")
    void committeeMember_canRead() {
        given(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn("ASCT-1", "E001", "N"))
                .willReturn(Optional.of(mock(Bcmmtm.class)));
        CustomUserDetails member = new CustomUserDetails("E001", List.of("ITPZZ001"), "DEPT-B");
        assertThat(authorizer.canRead(file("ASCT-1"), member)).isTrue();
    }

    @Test
    @DisplayName("위원이 아니어도 협의회 사업 주관부서와 같은 부서면 읽기 가능")
    void sameProjectDept_canRead() {
        given(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn("ASCT-1", "E001", "N"))
                .willReturn(Optional.empty());
        Basctm council = mock(Basctm.class);
        when(council.getAbusMngNo()).thenReturn("ABUS-1");
        when(council.getSno()).thenReturn(1);
        given(councilRepository.findByItPtlAsctIdAndDelYn("ASCT-1", "N")).willReturn(Optional.of(council));
        Bprojm project = mock(Bprojm.class);
        when(project.getSvnDpmC()).thenReturn("DEPT-A");
        given(projectRepository.findById(new BprojmId("ABUS-1", 1))).willReturn(Optional.of(project));
        CustomUserDetails sameDept = new CustomUserDetails("E001", List.of("ITPZZ001"), "DEPT-A");
        assertThat(authorizer.canRead(file("ASCT-1"), sameDept)).isTrue();
    }

    @Test
    @DisplayName("위원도 아니고 타부서면 읽기 불가")
    void nonMemberOtherDept_cannotRead() {
        given(committeeRepository.findByItPtlAsctIdAndEnoAndDelYn("ASCT-1", "E001", "N"))
                .willReturn(Optional.empty());
        Basctm council = mock(Basctm.class);
        when(council.getAbusMngNo()).thenReturn("ABUS-1");
        when(council.getSno()).thenReturn(1);
        given(councilRepository.findByItPtlAsctIdAndDelYn("ASCT-1", "N")).willReturn(Optional.of(council));
        Bprojm project = mock(Bprojm.class);
        when(project.getSvnDpmC()).thenReturn("DEPT-A");
        given(projectRepository.findById(new BprojmId("ABUS-1", 1))).willReturn(Optional.of(project));
        CustomUserDetails other = new CustomUserDetails("E001", List.of("ITPZZ001"), "DEPT-B");
        assertThat(authorizer.canRead(file("ASCT-1"), other)).isFalse();
    }

    @Test
    @DisplayName("부모 ID가 없으면 읽기 불가")
    void nullParent_cannotRead() {
        CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "DEPT-A");
        assertThat(authorizer.canRead(file(null), user)).isFalse();
    }
}
```

`Basctm.getSno()`와 `BprojmId`의 두 번째 인자는 실제 코드에서 모두 `Integer`이며 테스트 리터럴 `1`은 autoboxing된다.

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.CouncilFileReadAuthorizerTest"`
Expected: 컴파일 실패 — 클래스 미존재.

- [ ] **Step 3: 구현**

Create `CouncilFileReadAuthorizer.java`:

```java
package com.kdb.it.infra.file.authz;

import com.kdb.it.common.system.security.CustomUserDetails;
import com.kdb.it.domain.budget.project.entity.BprojmId;
import com.kdb.it.domain.budget.project.repository.ProjectRepository;
import com.kdb.it.domain.council.repository.CommitteeRepository;
import com.kdb.it.domain.council.repository.CouncilRepository;
import com.kdb.it.infra.file.entity.Cfilem;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 협의회 연계 파일(사업계획서·타당성검토표·협의회관련자료) 읽기 판정기.
 *
 * <p>규칙: 관리자/정보보안관리자 OR 해당 협의회 위원 OR 협의회 사업 주관부서 동일.
 * 세 종류 모두 {@code PK_CONE}가 협의회ID({@code IT_PTL_ASCT_ID})이다.</p>
 */
@Component
@RequiredArgsConstructor
public class CouncilFileReadAuthorizer implements FileReadAuthorizer {

    private final CouncilRepository councilRepository;
    private final CommitteeRepository committeeRepository;
    private final ProjectRepository projectRepository;

    @Override
    public Set<String> supportedPkColNms() {
        return Set.of("사업계획서", "타당성검토표", "협의회관련자료");
    }

    @Override
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        if (user == null) {
            return false;
        }
        if (user.isAdmin() || user.isInfoSecAdmin()) {
            return true;
        }
        String asctId = file.getPkCone();
        if (!org.springframework.util.StringUtils.hasText(asctId)) {
            return false;
        }
        // 해당 협의회 위원 여부
        if (committeeRepository.findByItPtlAsctIdAndEnoAndDelYn(asctId, user.getEno(), "N").isPresent()) {
            return true;
        }
        // 관련 부서: 협의회 → 사업(BPROJM) 주관부서와 사용자 부서 비교
        return councilRepository.findByItPtlAsctIdAndDelYn(asctId, "N")
                .flatMap(council -> projectRepository.findById(
                        new BprojmId(council.getAbusMngNo(), council.getSno())))
                .map(project -> user.getBbrC() != null && user.getBbrC().equals(project.getSvnDpmC()))
                .orElse(false);
    }
}
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.authz.CouncilFileReadAuthorizerTest"`
Expected: PASS. 실제 repository의 `Optional<Basctm> findByItPtlAsctIdAndDelYn(String, String)`과 `BprojmId(String, Integer)` 생성자 시그니처를 그대로 사용한다.

```bash
cd it_backend
git add src/main/java/com/kdb/it/infra/file/authz/CouncilFileReadAuthorizer.java src/test/java/com/kdb/it/infra/file/authz/CouncilFileReadAuthorizerTest.java
git commit -m "feat(file): 협의회 연계 파일 위원·부서 authorizer 추가 (SEC-05)"
```

---

## Task 6: FileOwnershipChecker 위임 전환 + 테스트 정비 — RED → GREEN

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java`
- Modify (test): `it_backend/src/test/java/com/kdb/it/infra/file/FileOwnershipCheckerTest.java`

- [ ] **Step 1: FileOwnershipChecker를 레지스트리 위임으로 변경**

`FileOwnershipChecker.java`에서:
- import에 `com.kdb.it.infra.file.authz.FileReadAuthorizerRegistry` 추가, `com.kdb.it.common.board.entity.Cblbcm`·`com.kdb.it.common.board.repository.BoardPostRepository`·`java.time.LocalDate` import 제거.
- 필드에서 `private final BoardPostRepository boardPostRepository;` 제거, `private final FileReadAuthorizerRegistry readAuthorizerRegistry;` 추가(`fileRepository`는 유지).
- `canRead(Cfilem, CustomUserDetails)` 본문을 위임으로 교체하고, `isPostVisible` private 메서드는 삭제:

```java
    public boolean canRead(Cfilem file, CustomUserDetails user) {
        return readAuthorizerRegistry.canRead(file, user);
    }
```

`verifyWriteAccess`는 변경하지 않는다. `checkReadAccess`는 파일 없음과 권한 없음을 구분하도록 다음으로 변경하고 `org.springframework.security.access.AccessDeniedException`을 import한다. 클래스 JavaDoc의 "공통게시판이 아니면 항상 읽기 허용" 문구는 "종류별 authorizer로 판정(미등록=관리자만)"으로 정정한다.

```java
public void checkReadAccess(String flMpnId, CustomUserDetails user) {
    Cfilem file = fileRepository.findByFlMpnIdAndDelYn(flMpnId, "N")
            .orElseThrow(() -> new CustomGeneralException(
                    "파일을 찾을 수 없습니다: " + flMpnId));
    if (!canRead(file, user)) {
        throw new AccessDeniedException("파일 읽기 권한이 없습니다.");
    }
}
```

- [ ] **Step 2: FileOwnershipCheckerTest 정비**

- `@Mock BoardPostRepository boardPostRepository;` 제거 → `@Mock FileReadAuthorizerRegistry readAuthorizerRegistry;` 추가. import도 교체.
- 게시물 가시성 시나리오는 Task 3의 `BoardFileReadAuthorizerTest`로 이관됐으므로, 아래 테스트/중첩 클래스를 **삭제**한다:
  - `CanRead` 중첩 클래스 전체(`canRead_nonBoardAlwaysTrue`, `canRead_hiddenBoardPostDeniedForNonAdmin`)
  - `CheckReadAccessBoardFile` 중첩 클래스 전체(게시물 가시성 6개)
  - `CheckReadAccess`의 `checkReadAccess_nonBoardFile_alwaysPasses`, `checkReadAccess_boardFile_adminBypass`
  - 내부 헬퍼 `buildPost(...)`
- `VerifyWriteAccess` 중첩 클래스는 그대로 유지(레지스트리 무관).
- `CheckReadAccess` 중첩 클래스를 레지스트리 위임 검증으로 재작성한다:

```java
    @Nested
    @DisplayName("checkReadAccess — 레지스트리 판정 위임")
    class CheckReadAccess {

        @Test
        @DisplayName("레지스트리가 읽기 허용하면 예외 없이 통과한다")
        void checkReadAccess_allowed_passes() {
            Cfilem file = mock(Cfilem.class);
            given(fileRepository.findByFlMpnIdAndDelYn("FL_00000002", "N")).willReturn(Optional.of(file));
            CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "IT001");
            given(readAuthorizerRegistry.canRead(file, user)).willReturn(true);

            assertThatCode(() -> fileOwnershipChecker.checkReadAccess("FL_00000002", user))
                    .doesNotThrowAnyException();
        }

        @Test
        @DisplayName("레지스트리가 거부하면 AccessDeniedException 발생")
        void checkReadAccess_denied_throws() {
            Cfilem file = mock(Cfilem.class);
            given(fileRepository.findByFlMpnIdAndDelYn("FL_00000002", "N")).willReturn(Optional.of(file));
            CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "IT001");
            given(readAuthorizerRegistry.canRead(file, user)).willReturn(false);

            assertThatThrownBy(() -> fileOwnershipChecker.checkReadAccess("FL_00000002", user))
                    .isInstanceOf(AccessDeniedException.class)
                    .hasMessageContaining("파일 읽기 권한이 없습니다");
        }

        @Test
        @DisplayName("파일이 없으면 CustomGeneralException 발생")
        void checkReadAccess_fileNotFound_throws() {
            given(fileRepository.findByFlMpnIdAndDelYn("FL_00000099", "N")).willReturn(Optional.empty());
            CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "IT001");

            assertThatThrownBy(() -> fileOwnershipChecker.checkReadAccess("FL_00000099", user))
                    .isInstanceOf(CustomGeneralException.class)
                    .hasMessageContaining("파일을 찾을 수 없습니다");
        }
    }
```

미사용이 되는 import(`Cblbcm`, `BoardPostRepository`, `LocalDate`, `when`)는 제거한다.

- [ ] **Step 3: 실패 → 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.FileOwnershipCheckerTest"`
Expected: PASS. (구현 전 컴파일 실패 → 구현 후 통과. Step 1·2를 함께 반영하므로 최종 GREEN 확인.)

- [ ] **Step 4: 커밋**

```bash
cd it_backend
git add src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java src/test/java/com/kdb/it/infra/file/FileOwnershipCheckerTest.java
git commit -m "refactor(file): FileOwnershipChecker 읽기 판정을 authorizer 레지스트리로 위임 (SEC-05)"
```

---

## Task 7: 목록 부모 판정 캐시로 N+1 제거 (RED → GREEN)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java`

- [ ] **Step 1: 호출 횟수 실패 테스트 작성**

`FileServiceTest`의 `getFiles` 테스트에 다음을 추가한다.

- 같은 `PK_COL_NM=요구사항정의서`, `PK_CONE=DOC-1` 파일 3건 → `canRead` 1회, 응답 3건.
- `DOC-1`, `DOC-2` 각 1건 → `canRead` 2회.
- 같은 부모가 거부된 파일 3건 → `canRead` 1회, 빈 응답.
- 종류가 같아도 부모 ID가 다르면 캐시를 공유하지 않는다.

```java
verify(fileOwnershipChecker, times(1)).canRead(firstFile, user);
verify(fileOwnershipChecker, never()).canRead(secondFile, user);
```

첫 파일의 판정이 동일 부모 파일에 재사용되므로 두 번째·세 번째 파일에는 checker가 호출되지 않음을 명시적으로 검증한다.

- [ ] **Step 2: 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.service.FileServiceTest"`

Expected: 기존 stream filter가 파일 수만큼 checker를 호출해 실패.

- [ ] **Step 3: 요청 범위 캐시 구현**

`FileService`에 private key record를 추가한다.

```java
private record FileReadKey(String pkColNm, String pkCone) {
}
```

`getFiles` 반환부를 다음으로 교체하고 `java.util.HashMap`, `java.util.Map`을 import한다.

```java
Map<FileReadKey, Boolean> decisions = new HashMap<>();
return list.stream()
        .filter(file -> decisions.computeIfAbsent(
                new FileReadKey(file.getPkColNm(), file.getPkCone()),
                ignored -> fileOwnershipChecker.canRead(file, user)))
        .map(this::toResponse)
        .toList();
```

모든 authorizer는 `(PK_COL_NM, PK_CONE, user)`만으로 결정을 내린다는 불변식을 `FileReadAuthorizer` JavaDoc에 기록한다. 캐시는 메서드 지역 변수이므로 사용자·요청 사이에 공유되지 않는다.

- [ ] **Step 4: 통과 확인·커밋**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.service.FileServiceTest"`

Expected: PASS.

```bash
cd it_backend
git add src/main/java/com/kdb/it/infra/file/service/FileService.java src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java
git commit -m "perf(file): 목록 부모 인가 판정 요청 범위 캐시 적용 (SEC-05)"
```

---

## Task 8: 정책 문서 갱신 (CLAUDE.md §5·가이드 3종)

**Files:**
- Modify: `it_backend/CLAUDE.md`
- Modify: `it_backend/docs/guides/security/file-security.md`
- Modify: `it_backend/docs/guides/security/data-scope.md`
- Modify: `it_backend/docs/guides/security/file-read-migration.md`
- Modify: `TASK.md`

- [ ] **Step 1: CLAUDE.md §5 문구 정정**

`it_backend/CLAUDE.md` §5의 다음 문장을 교체한다:

- 기존: `파일 쓰기·삭제는 업로더 또는 관리자만 허용합니다. 공통게시판 연결 파일의 읽기는 게시물 공개 여부를 검증합니다. 그 외 업무 파일 읽기는 별도 소유권 제한이 구현된 것으로 간주하지 않습니다.`
- 변경: `파일 쓰기·삭제는 업로더 또는 관리자만 허용합니다. 파일 읽기는 파일 종류(PK_COL_NM)별 authorizer가 부모 자원 권한을 재사용해 판정합니다(default-deny, 미등록 종류는 관리자만). 공통게시판=게시물 공개 여부, 요구사항정의서=관리자/작성자/주관부서, 협의회 연계(사업계획서·타당성검토표·협의회관련자료)=관리자/정보보안관리자/협의회 위원/관련부서, 가이드문서=인증 사용자 전체.`

- [ ] **Step 2: file-security.md 갱신**

`it_backend/docs/guides/security/file-security.md`에서 "비게시판 파일 읽기 무제한" 취지의 서술을 위 종류별 규칙표(스펙 §3.2)로 대체하고, authorizer 레지스트리 구조와 default-deny 원칙을 명시한다.

- [ ] **Step 3: data-scope.md 갱신**

`it_backend/docs/guides/security/data-scope.md`에 파일 읽기 데이터 범위 항목을 추가/정정한다: 부서 스코프는 요구사항정의서=`Brdocm.SVN_DPM_C`, 협의회 연계=협의회 사업 `BPROJM.SVN_DPM_C`를 사용자 `bbrC`와 비교.

- [ ] **Step 4: 파일 전용 정책 경계와 후속 과제 기록**

`file-security.md`에 다음 경계를 명시한다.

```text
파일 authorizer는 부모 리소스의 현재 HTTP 엔드포인트를 재사용하는 것이 아니라,
문서화된 소유자·부서·위원 규칙을 파일 읽기에 적용하는 더 엄격한 전용 정책이다.
부모 상세 API의 인가 수준이 이 파일 정책보다 느슨하더라도 파일 권한을 완화하지 않는다.
```

`TASK.md`에는 요구사항정의서·협의회 부모 상세/목록 API가 같은 정책 컴포넌트를 사용하도록 통합하는 별도 보안 과제를 등록한다. 이 과제의 완료 조건은 부모 API별 403 통합 테스트와 파일 authorizer가 공유 policy를 호출하는 단위 테스트다.

- [ ] **Step 5: 커밋**

```bash
cd it_backend
git add CLAUDE.md docs/guides/security/file-security.md docs/guides/security/data-scope.md docs/guides/security/file-read-migration.md ../TASK.md
git commit -m "docs(security): 파일 읽기 인가 정책 종류별 부모권한 매핑으로 정정 (SEC-05)"
```

---

## Task 9: 네 HTTP 경로와 Oracle 정책 통합 테스트

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/infra/file/FileReadAuthorizationIT.java`
- Modify: `it_backend/src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java`

> MockMvc는 네 URL의 인가 연결과 403 계약을 검증하고, 로컬 Oracle 테스트는 실제 부모·부서·위원 조인을 검증한다. 둘 중 하나로 다른 하나를 대체하지 않는다.

- [ ] **Step 1: 네 HTTP 읽기 경로 MockMvc 테스트 작성**

`FileControllerTest`에 인증 일반 사용자로 다음을 검증한다.

| 경로 | 거부 시 기대 | 허용 시 기대 |
| --- | --- | --- |
| `GET /api/files?pkColNm=요구사항정의서&pkCone=DOC-1` | 200 + 빈 배열 | 200 + 허용 파일만 포함 |
| `GET /api/files/{flMpnId}` | 403 | 200 + 메타 DTO |
| `GET /api/files/{flMpnId}/download` | 403, `downloadFile` 미호출 | 200 + `Content-Disposition: attachment` |
| `GET /api/files/{flMpnId}/preview` | 403, `downloadFile` 미호출 | 200 + `Content-Disposition: inline` |

단건 거부 스텁은 공통으로 사용한다.

```java
doThrow(new AccessDeniedException("파일 읽기 권한이 없습니다."))
        .when(fileOwnershipChecker).checkReadAccess("FL-DENIED", userDetails);
```

목록은 `FileServiceTest`의 실제 필터 테스트로 정책을 증명하고, controller 테스트에서는 `fileService.getFiles(condition, userDetails)`에 인증 사용자가 정확히 전달되는지 `ArgumentCaptor`로 검증한다. 다운로드·미리보기 허용 테스트는 `ByteArrayResource`를 넣은 `FileDownloadResult`를 사용해 실제 파일시스템에 의존하지 않는다.

- [ ] **Step 2: MockMvc 실패 → 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.infra.file.controller.FileControllerTest" --tests "com.kdb.it.infra.file.service.FileServiceTest"`

Expected: 네 경로의 허용·거부와 403 계약 PASS.

- [ ] **Step 3: 로컬 Oracle 정책 통합 테스트 작성**

`FileReadAuthorizationIT`는 테스트마다 고유 접두부 `SEC05-{UUID}`를 사용해 부모와 `Cfilem`을 생성하고 `@AfterEach`에서 생성 역순으로 정리한다. 실제 repository와 authorizer를 사용해 다음을 검증한다.

- 요구사항정의서: 작성자, 주관부서 허용 / 타부서 거부.
- 협의회 연계 세 종류 각각: 관리자, 정보보안관리자, 위원, 사업 주관부서 허용 / 비위원·타부서 거부.
- 가이드문서: 인증 사용자 허용 / null 사용자 거부.
- 공통게시판: 공개기간 내 허용 / 숨김·기간 전·기간 후·부모 없음 거부.
- 미등록·null 종류, null 부모, 존재하지 않는 부모: 일반 사용자 거부 / 관리자 허용.
- `FileService.getFiles`: 같은 부모 여러 파일의 허용·거부 결과. 부모별 1회 호출 횟수는 Task 7의 Mockito 단위 테스트가 검증한다.
- `FileOwnershipChecker.checkReadAccess`: 허용은 통과, 거부는 `AccessDeniedException`.

테스트 데이터는 운영 기준선 행을 재사용하지 않고 직접 생성한다. 격리 7건은 별도 read-only 테스트에서 일반 사용자에게 노출되지 않는지만 확인하며 수정·삭제하지 않는다.

- [ ] **Step 4: 통합 테스트 실행(로컬 Oracle)**

Run: `cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.infra.file.FileReadAuthorizationIT"`

Expected: PASS. 로컬 Oracle 미가동이면 구현 완료로 간주하지 않고 환경을 기동한 뒤 재실행한다.

- [ ] **Step 5: 커밋**

```bash
cd it_backend
git add src/test/java/com/kdb/it/infra/file/FileReadAuthorizationIT.java src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java
git commit -m "test(file): 네 파일 읽기 경로와 부모 인가 통합 검증 (SEC-05)"
```

---

## Task 10: 파일·인가 도메인 전체 회귀

**Files:** (없음 — 검증)

- [ ] **Step 1: 파일·인증 공통 변경 전체 테스트**

CLAUDE.md §9(파일 공통 변경)에 따라 clean 포함 실행:

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL. (파일 락 시 `--no-daemon` 병행)

- [ ] **Step 2: 결과 확인**

전체 GREEN 확인. 특히 파일 업로드/조회 화면(요구사항정의서·가이드·협의회) 관련 서비스·컨트롤러 테스트에서 권한 변경으로 인한 회귀가 없는지 확인.

---

## NOT in scope

- 요구사항정의서·협의회 부모 API 자체의 인가 통합: 파일 정책은 즉시 엄격화하고, 부모 API는 Task 8에서 `TASK.md` 후속 보안 과제로 추적한다.
- 부모를 추정할 근거가 없는 격리 7건의 자동 연결·삭제: 잘못된 부모 연결이 정보 노출을 만들 수 있어 관리자 수동 확인만 허용한다.
- 파일 업로드·메타 수정 시 `pkColNm/pkCone`을 서버가 강제로 산정하는 변경: 읽기 경계와 별도의 쓰기 무결성 과제로 분리한다.
- 관리자 전용 Gemini 파일 분석 경로: 기존 관리자 인가를 유지하며 일반 파일 읽기 API 네 경로와 분리한다.

## What already exists

- 목록은 `FileService.getFiles`, 메타·다운로드·미리보기는 `FileOwnershipChecker.checkReadAccess`라는 공통 진입점을 이미 가진다.
- `GlobalExceptionHandler`에 `AccessDeniedException` 403 handler가 있으므로 새 응답 DTO를 만들지 않는다.
- 게시판 공개기간 판정, 요구사항 최신 문서 repository, 협의회·위원·사업 repository를 재사용한다.
- 파일 쓰기·삭제의 업로더/관리자 검증은 변경하지 않는다.

---

## Self-Review

- **Data readiness:** 활성 57건을 49건 정규화 + 1건 정상 + 7건 격리로 분류하고, Flyway 사후 0건 게이트를 둔다.
- **Spec coverage(§3.2):** 6개 종류, default-deny, 부모 규칙, 목록·메타·다운로드·미리보기, 정책 문서, Oracle 검증을 Task 0~10에 매핑했다.
- **HTTP semantics:** 목록 거부는 누락된 200 응답, 단건 세 경로 거부는 403이며 파일 없음과 구분한다.
- **Performance:** 목록 인가 repository 호출은 파일 수가 아니라 서로 다른 부모 키 수에 비례하고 호출 횟수 테스트가 있다.
- **Policy boundary:** 파일 전용 정책이 현재 부모 HTTP API보다 엄격할 수 있음을 명시하고 부모 API 통합은 추적 가능한 후속 과제로 남긴다.
- **Type consistency:** `boolean canRead(Cfilem, CustomUserDetails)`와 `Set<String> supportedPkColNms()`를 4개 구현·레지스트리·테스트에서 동일하게 사용한다. 실제 확인한 `Optional<Basctm>` 및 `BprojmId(String, Integer)` 시그니처를 사용한다.
