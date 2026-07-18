# SEC-05 비게시판 업무 파일 읽기 인가 (종류별 부모권한 완전 매핑) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 업무 파일 읽기를 default-deny로 전환하고, 파일 종류(`PK_COL_NM`)별 authorizer가 부모 자원의 읽기 권한을 재사용하도록 매핑한다. 목록·메타·다운로드·미리보기에 동일 적용한다.

**Architecture:** `FileReadAuthorizer` 인터페이스와 이를 종류별로 수집하는 `FileReadAuthorizerRegistry`(미등록 종류=관리자만 허용)를 도입한다. `FileOwnershipChecker.canRead`가 레지스트리에 위임하도록 바꾸면 기존 단건(`checkReadAccess`)·목록(`FileService.getFiles`) 경로가 자동으로 새 규칙을 사용한다. 종류별 규칙은 CLAUDE.md §5·§6의 기존 부서·소유자 검증기를 재사용한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring Data JPA, JUnit 5, Mockito, AssertJ. 통합 테스트는 로컬 Oracle `@Tag("it")` 하네스.

**참조 스펙:** `docs/superpowers/specs/2026-07-19-security-error-handling-remediation-design.md` §3.2

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

- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/FileReadAuthorizer.java` (인터페이스)
- Create: `.../infra/file/authz/FileReadAuthorizerRegistry.java` (종류→authorizer 매핑 + default-deny)
- Create: `.../infra/file/authz/GuideDocFileReadAuthorizer.java`
- Create: `.../infra/file/authz/BoardFileReadAuthorizer.java` (기존 게시물 가시성 로직 이관)
- Create: `.../infra/file/authz/RequirementDocFileReadAuthorizer.java`
- Create: `.../infra/file/authz/CouncilFileReadAuthorizer.java`
- Modify: `.../infra/file/FileOwnershipChecker.java` (canRead → 레지스트리 위임, 게시판 분기·boardPostRepository 제거)
- Create (test): `authz/FileReadAuthorizerRegistryTest.java`, `GuideDocFileReadAuthorizerTest.java`, `BoardFileReadAuthorizerTest.java`, `RequirementDocFileReadAuthorizerTest.java`, `CouncilFileReadAuthorizerTest.java`
- Modify (test): `infra/file/FileOwnershipCheckerTest.java` (게시판·비게시판 무조건 허용 테스트 이관/삭제, 레지스트리 위임 검증으로 전환)
- Modify (docs): `it_backend/CLAUDE.md` §5, `it_backend/docs/guides/security/file-security.md`, `it_backend/docs/guides/security/data-scope.md`
- Create (통합): `.../infra/file/FileReadAuthorizationIT.java` (`@Tag("it")`)

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
        if (user != null && user.isAdmin()) {
            return true;
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
        return serviceRequestDocRepository
                .findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc(file.getPkCone(), "N")
                .map(doc -> user.getEno().equals(doc.getFstEnrUsid())
                        || (user.getBbrC() != null && user.getBbrC().equals(doc.getSvnDpmC())))
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
}
```

> 주의: `Basctm.getSno()`·`BprojmId`의 두 번째 인자 타입은 실제 시그니처(`Integer`)에 맞춘다. `CouncilService`가 `new BprojmId(council.getAbusMngNo(), council.getSno())`를 그대로 쓰므로 동일 타입이 보장된다. 컴파일 오류 시 `BprojmId` 생성자 시그니처를 확인해 리터럴 타입(`1` → 필요 시 `Integer.valueOf(1)`)을 맞춘다.

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
Expected: PASS. (`CouncilRepository.findByItPtlAsctIdAndDelYn`가 `Optional<Basctm>`을 반환하는지 확인 — `CouncilService.findActiveCouncil`이 동일 메서드를 `orElseThrow`로 사용하므로 Optional. 반환형이 다르면 로더를 맞춘다.)

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

`verifyWriteAccess`·`checkReadAccess`는 변경하지 않는다(둘 다 `canRead`/`fileRepository`만 사용). 클래스 javadoc의 "공통게시판이 아니면 항상 읽기 허용" 문구는 "종류별 authorizer로 판정(미등록=관리자만)"으로 정정한다.

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
        @DisplayName("레지스트리가 거부하면 CustomGeneralException 발생")
        void checkReadAccess_denied_throws() {
            Cfilem file = mock(Cfilem.class);
            given(fileRepository.findByFlMpnIdAndDelYn("FL_00000002", "N")).willReturn(Optional.of(file));
            CustomUserDetails user = new CustomUserDetails("E001", List.of("ITPZZ001"), "IT001");
            given(readAuthorizerRegistry.canRead(file, user)).willReturn(false);

            assertThatThrownBy(() -> fileOwnershipChecker.checkReadAccess("FL_00000002", user))
                    .isInstanceOf(CustomGeneralException.class)
                    .hasMessageContaining("파일 다운로드 권한이 없습니다");
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

## Task 7: 정책 문서 갱신 (CLAUDE.md §5·가이드 2종)

**Files:**
- Modify: `it_backend/CLAUDE.md`
- Modify: `it_backend/docs/guides/security/file-security.md`
- Modify: `it_backend/docs/guides/security/data-scope.md`

- [ ] **Step 1: CLAUDE.md §5 문구 정정**

`it_backend/CLAUDE.md` §5의 다음 문장을 교체한다:

- 기존: `파일 쓰기·삭제는 업로더 또는 관리자만 허용합니다. 공통게시판 연결 파일의 읽기는 게시물 공개 여부를 검증합니다. 그 외 업무 파일 읽기는 별도 소유권 제한이 구현된 것으로 간주하지 않습니다.`
- 변경: `파일 쓰기·삭제는 업로더 또는 관리자만 허용합니다. 파일 읽기는 파일 종류(PK_COL_NM)별 authorizer가 부모 자원 권한을 재사용해 판정합니다(default-deny, 미등록 종류는 관리자만). 공통게시판=게시물 공개 여부, 요구사항정의서=관리자/작성자/주관부서, 협의회 연계(사업계획서·타당성검토표·협의회관련자료)=관리자/정보보안관리자/협의회 위원/관련부서, 가이드문서=인증 사용자 전체.`

- [ ] **Step 2: file-security.md 갱신**

`it_backend/docs/guides/security/file-security.md`에서 "비게시판 파일 읽기 무제한" 취지의 서술을 위 종류별 규칙표(스펙 §3.2)로 대체하고, authorizer 레지스트리 구조와 default-deny 원칙을 명시한다.

- [ ] **Step 3: data-scope.md 갱신**

`it_backend/docs/guides/security/data-scope.md`에 파일 읽기 데이터 범위 항목을 추가/정정한다: 부서 스코프는 요구사항정의서=`Brdocm.SVN_DPM_C`, 협의회 연계=협의회 사업 `BPROJM.SVN_DPM_C`를 사용자 `bbrC`와 비교.

- [ ] **Step 4: 커밋**

```bash
cd it_backend
git add CLAUDE.md docs/guides/security/file-security.md docs/guides/security/data-scope.md
git commit -m "docs(security): 파일 읽기 인가 정책 종류별 부모권한 매핑으로 정정 (SEC-05)"
```

---

## Task 8: 통합 테스트 (@Tag("it"), 로컬 Oracle)

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/infra/file/FileReadAuthorizationIT.java`

> 로컬 Oracle 하네스(`integrationTest` 태스크, `@Tag("it")`)로 실제 부모 데이터·권한을 대조한다. 로컬 Oracle 미가동 환경에서는 이 태스크를 건너뛴다(CLAUDE.md §9).

- [ ] **Step 1: 종류별 허용/거부 통합 테스트 작성**

`FileReadAuthorizationIT.java`를 작성해 종류별로 (a) 권한 보유 사용자 허용, (b) 타부서/무권한 사용자 거부를 검증한다. 최소 시나리오:
- `요구사항정의서`: 주관부서 사용자 허용, 타부서 거부.
- 협의회 연계: 위원 허용, 비위원·타부서 거부.
- `가이드문서`: 임의 인증 사용자 허용.
- 미등록 종류: 일반 사용자 거부, 관리자 허용.
- 검증 지점은 목록(`FileService.getFiles`)과 단건(`FileOwnershipChecker.checkReadAccess`) 양쪽.

기존 `@Tag("it")` 통합 테스트(예: Repository 통합 테스트)의 하네스·픽스처 패턴을 따른다.

- [ ] **Step 2: 통합 테스트 실행(로컬 Oracle)**

Run: `cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.infra.file.FileReadAuthorizationIT"`
Expected: PASS(로컬 Oracle 가동 시). 미가동 시 스킵하고 단위 테스트만으로 진행.

- [ ] **Step 3: 커밋**

```bash
cd it_backend
git add src/test/java/com/kdb/it/infra/file/FileReadAuthorizationIT.java
git commit -m "test(file): 파일 읽기 인가 통합 테스트 추가 (SEC-05)"
```

---

## Task 9: 파일·인가 도메인 전체 회귀

**Files:** (없음 — 검증)

- [ ] **Step 1: 파일·인증 공통 변경 전체 테스트**

CLAUDE.md §9(파일 공통 변경)에 따라 clean 포함 실행:

Run: `cd it_backend && ./gradlew clean test`
Expected: BUILD SUCCESSFUL. (파일 락 시 `--no-daemon` 병행)

- [ ] **Step 2: 결과 확인**

전체 GREEN 확인. 특히 파일 업로드/조회 화면(요구사항정의서·가이드·협의회) 관련 서비스·컨트롤러 테스트에서 권한 변경으로 인한 회귀가 없는지 확인.

---

## Self-Review

- **Spec coverage(§3.2):** 파일 종류 집합 확정(요구사항정의서/가이드문서/사업계획서/타당성검토표/협의회관련자료/공통게시판 — recon으로 확정) ✓, resolver 레지스트리(Task 1) ✓, default-deny(레지스트리 미등록=관리자만) ✓, 목록·메타·다운로드·미리보기 동일 적용(모두 `canRead` 위임 — Task 6) ✓, 정책 문서 3종 갱신(Task 7) ✓, 통합 테스트(Task 8) ✓.
- **Placeholder scan:** 인터페이스·레지스트리·4개 authorizer·위임 전환은 완전한 코드로 기재. Task 8 통합 테스트는 시나리오·검증지점·명령을 구체화하되 픽스처는 기존 `@Tag("it")` 하네스 패턴을 따르도록 지시(로컬 Oracle 데이터 의존).
- **Type consistency:** 인터페이스 `boolean canRead(Cfilem, CustomUserDetails)` / `Set<String> supportedPkColNms()`가 5개 구현·레지스트리·테스트에서 동일. 리포지토리 finder 시그니처는 실제 확인값 사용(`findTopByDocMngNoAndDelYnOrderByDocVrsSnoDesc`, `findByItPtlAsctIdAndEnoAndDelYn`, `findByItPtlAsctIdAndDelYn`, `findByNacMngNoAndDelYn`, `projectRepository.findById(new BprojmId(abusMngNo, sno))`).
- **확인 필요(구현 시 1차 점검):** `CouncilRepository.findByItPtlAsctIdAndDelYn` 반환형이 `Optional<Basctm>`인지(=`findActiveCouncil` 사용 근거), `BprojmId(String, Integer)` 생성자 인자 타입. 상이하면 로더/리터럴 타입만 맞춘다.
